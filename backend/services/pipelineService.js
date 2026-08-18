const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
const { fetchFeatures, fetchFeaturesBatch } = require("./annotationService");

const prisma = new PrismaClient();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
const ALLOWED_CLASSIFICATIONS = ["Benign", "VUS", "Pathogenic"];

/**
 * Analyzes variants for a specific patient by:
 * 1. Fetching patient variants from Prisma.
 * 2. Querying MyVariant.info annotations (up to 50 variants).
 * 3. Batching features to the Python ML service for pathogenicity & SHAP explanations.
 * 4. Upserting Evidence records and updating Variant statuses in Prisma.
 *
 * @param {string} patientId - UUID of the patient
 * @returns {Promise<Object>} Analysis results and summary
 */
async function analyzePatientVariants(patientId) {
  // 1. Check patient existence
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      variants: {
        orderBy: { pos: "asc" },
      },
    },
  });

  if (!patient) {
    throw new Error(`Patient not found with ID: ${patientId}`);
  }

  if (!patient.variants || patient.variants.length === 0) {
    return {
      patientId,
      message: "No variants found for this patient to analyze",
      totalAnalyzed: 0,
      results: [],
    };
  }

  // 2. Limit to first 50 variants for prototype
  const targetVariants = patient.variants.slice(0, 50);
  console.log(
    `[Pipeline] Annotating ${targetVariants.length} variants in parallel for patient ${patientId}...`,
  );

  // Fetch MyVariant.info annotations with fast parallel batcher
  const annotations = await fetchFeaturesBatch(targetVariants);

  // 3. Format numerical features for the Python ML service
  const featuresPayload = annotations.map((feat) => ({
    allele_frequency: feat.allele_frequency,
    cadd_score: feat.cadd_score,
  }));

  console.log(
    `[Pipeline] Sending batch of ${featuresPayload.length} variants to ML service at ${ML_SERVICE_URL}/predict...`,
  );

  let predictions = [];
  try {
    const mlResponse = await axios.post(
      `${ML_SERVICE_URL}/predict`,
      featuresPayload,
      {
        timeout: 15000,
        headers: { "Content-Type": "application/json" },
      },
    );
    predictions = mlResponse.data;
  } catch (mlErr) {
    console.error("[Pipeline] Error calling ML service:", mlErr.message);
    throw new Error(
      `ML prediction service error: ${mlErr.message}. Ensure the Python service is running on port 8000.`,
    );
  }

  // 4. Upsert evidence into Prisma and update Variant status
  const analyzedResults = [];

  for (let i = 0; i < targetVariants.length; i++) {
    const variant = targetVariants[i];
    const feat = annotations[i];
    const pred = predictions[i] || {
      ml_score: 0,
      classification: "VUS",
      shap_explanation: "Prediction unavailable",
    };
    const classification = pred.classification;
    let status = "VUS";

    if (ALLOWED_CLASSIFICATIONS.includes(classification)) {
      status = classification;
    } else {
      console.warn(
        `WARN: Invalid classification received from ML service: ${classification}`,
      );
    }

    let finalDisease = feat.disease || null;
    if (!finalDisease) {
      if (status === "Benign") {
        finalDisease = "No known disease risk (Benign / Common polymorphism)";
      } else if (status === "Pathogenic") {
        finalDisease = "Pathogenic variant (Clinical correlation required)";
      }
    }

    const explanationParts = [pred.shap_explanation];
    if (feat.clinvar_status) explanationParts.push(`(ClinVar: ${feat.clinvar_status})`);
    if (finalDisease) explanationParts.push(`(Disease: ${finalDisease})`);
    const explanation = explanationParts.join(" ");

    // Upsert Evidence table
    const evidence = await prisma.evidence.upsert({
      where: { variantId: variant.id },
      update: {
        frequency: feat.allele_frequency,
        conservation_score: feat.cadd_score,
        ml_score: pred.ml_score,
        clinvar_status: feat.clinvar_status || null,
        disease: finalDisease,
        shap_explanation: explanation,
      },
      create: {
        variantId: variant.id,
        frequency: feat.allele_frequency,
        conservation_score: feat.cadd_score,
        ml_score: pred.ml_score,
        clinvar_status: feat.clinvar_status || null,
        disease: finalDisease,
        shap_explanation: explanation,
      },
    });

    // Update Variant status
    const updatedVariant = await prisma.variant.update({
      where: { id: variant.id },
      data: { status },
    });

    analyzedResults.push({
      variantId: variant.id,
      chrom: variant.chrom,
      pos: variant.pos,
      ref: variant.ref,
      alt: variant.alt,
      status,
      features: feat,
      ml_score: pred.ml_score,
      shap_explanation: explanation,
      evidenceId: evidence.id,
    });
  }

  console.log(
    `[Pipeline] Successfully processed ${analyzedResults.length} variants for patient ${patientId}`,
  );

  return {
    patientId,
    patientFilename: patient.filename,
    totalAnalyzed: analyzedResults.length,
    pathogenicCount: analyzedResults.filter((r) => r.status === "Pathogenic")
      .length,
    benignCount: analyzedResults.filter((r) => r.status === "Benign").length,
    vusCount: analyzedResults.filter((r) => r.status === "VUS").length,
    results: analyzedResults,
  };
}

module.exports = {
  analyzePatientVariants,
};
