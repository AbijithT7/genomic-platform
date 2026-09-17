const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { fetchFeaturesBatch } = require("./annotationService");
const { parseVCF } = require("./vcfParser");

const prisma = new PrismaClient();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
const ALLOWED_CLASSIFICATIONS = ["Benign", "VUS", "Pathogenic"];

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function variantKey(chrom, pos, ref, alt) {
  return `${String(chrom).replace(/^chr/i, "")}:${pos}:${String(ref).toUpperCase()}:${String(alt).toUpperCase()}`;
}

function parseStoredVcfMeta(explanation) {
  if (!explanation || typeof explanation !== "string") return {};
  const rsidRaw = (explanation.match(/rsid:([^;]*)/) || [])[1];
  const geneRaw = (explanation.match(/gene:([^;]*)/) || [])[1];
  const afRaw = (explanation.match(/af:([^;]*)/) || [])[1];
  const caddRaw = (explanation.match(/cadd:([^;]*)/) || [])[1];
  const buildRaw = (explanation.match(/build:([^;\s]*)/) || [])[1];
  const rsid = rsidRaw && rsidRaw.trim().startsWith("rs") ? rsidRaw.trim() : null;
  return {
    rsid,
    gene: geneRaw && geneRaw.trim() ? geneRaw.trim() : null,
    vcfAf: finiteOrNull(afRaw),
    vcfCadd: finiteOrNull(caddRaw),
    genomeBuild: buildRaw && buildRaw.trim() ? buildRaw.trim() : null,
  };
}

async function loadParsedVcfLookup(patientId) {
  const persistentVcfPath = path.join(__dirname, "..", "uploads", `${patientId}.vcf`);
  if (!fs.existsSync(persistentVcfPath)) return new Map();
  try {
    const parsed = await parseVCF(persistentVcfPath);
    const map = new Map();
    for (const pv of parsed) {
      const key = variantKey(pv.chrom, pv.pos, pv.ref, pv.alt);
      if (!map.has(key)) map.set(key, pv);
    }
    map.referenceBuild = parsed.referenceBuild || "hg19";
    return map;
  } catch (err) {
    console.warn(`[Pipeline] Could not re-parse stored VCF: ${err.message}`);
    return new Map();
  }
}

function attachAnnotationInputs(variants, parsedVcfMap) {
  return variants.map((variant) => {
    const key = variantKey(variant.chrom, variant.pos, variant.ref, variant.alt);
    const fromFile = parsedVcfMap.get(key) || {};
    const fromEvidence = parseStoredVcfMeta(variant.evidence?.shap_explanation);
    const storedAf = finiteOrNull(fromFile.af);
    const storedCadd = finiteOrNull(fromFile.cadd);
    return {
      ...variant,
      rsid: variant.rsid || fromFile.rsid || fromEvidence.rsid || null,
      gene: variant.gene || fromFile.gene || fromEvidence.gene || null,
      disease: fromFile.disease || null,
      vcfAf: storedAf !== null ? storedAf : fromEvidence.vcfAf,
      vcfCadd: storedCadd !== null ? storedCadd : fromEvidence.vcfCadd,
      genomeBuild:
        variant.genomeBuild ||
        fromFile.referenceBuild ||
        parsedVcfMap.referenceBuild ||
        fromEvidence.genomeBuild ||
        "hg19",
    };
  });
}

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
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      variants: {
        include: { evidence: true },
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

  const targetVariants = patient.variants.slice(0, 50);
  console.log(
    `[Pipeline] Annotating ${targetVariants.length} variants in parallel for patient ${patientId}...`,
  );

  const parsedVcfMap = await loadParsedVcfLookup(patientId);
  const annotationInputs = attachAnnotationInputs(targetVariants, parsedVcfMap);
  const annotations = await fetchFeaturesBatch(annotationInputs);

  const featuresPayload = [];
  const payloadIndexByVariant = [];

  for (let i = 0; i < annotationInputs.length; i++) {
    const variant = annotationInputs[i];
    const feat = annotations[i];
    const af = finiteOrNull(feat.allele_frequency);
    const cadd = finiteOrNull(feat.cadd_score);
    const label = `${variant.chrom}:${variant.pos} ${variant.ref}>${variant.alt}`;

    console.log(
      `[ML INPUT] ${label} | AF=${af === null ? "missing" : af} | CADD=${cadd === null ? "missing" : cadd}`,
    );

    if (af === null || cadd === null) {
      continue;
    }

    payloadIndexByVariant.push(i);
    featuresPayload.push({
      allele_frequency: clamp(af, 0, 1),
      cadd_score: clamp(cadd, 0, 100),
    });
  }

  console.log(
    `[Pipeline] Sending batch of ${featuresPayload.length} variants to ML service at ${ML_SERVICE_URL}/predict...`,
  );

  let predictions = [];
  if (featuresPayload.length > 0) {
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
  }

  const predictionByVariant = new Array(annotationInputs.length).fill(null);
  for (let p = 0; p < payloadIndexByVariant.length; p++) {
    predictionByVariant[payloadIndexByVariant[p]] = predictions[p] || null;
  }

  const analyzedResults = [];

  for (let i = 0; i < targetVariants.length; i++) {
    const variant = annotationInputs[i];
    const feat = annotations[i];
    const af = finiteOrNull(feat.allele_frequency);
    const cadd = finiteOrNull(feat.cadd_score);
    const pred = predictionByVariant[i];
    const missingAnnotations = af === null || cadd === null;

    let status = "VUS";
    let mlScore = null;
    let shapExplanation = null;
    let classification = "VUS";

    if (missingAnnotations) {
      shapExplanation =
        "Model not applied: allele frequency and/or CADD score could not be annotated. Dummy AF=0/CADD=0 defaults were not used.";
      console.log(
        `[ML OUTPUT] ${variant.chrom}:${variant.pos} ${variant.ref}>${variant.alt} | score=n/a | classification=VUS`,
      );
    } else if (!pred) {
      shapExplanation = "Prediction unavailable";
      console.log(
        `[ML OUTPUT] ${variant.chrom}:${variant.pos} ${variant.ref}>${variant.alt} | score=n/a | classification=VUS`,
      );
    } else {
      mlScore = pred.ml_score;
      classification = pred.classification;
      shapExplanation = pred.shap_explanation;
      if (ALLOWED_CLASSIFICATIONS.includes(classification)) {
        status = classification;
      } else {
        console.warn(
          `WARN: Invalid classification received from ML service: ${classification}`,
        );
      }
      console.log(
        `[ML OUTPUT] ${variant.chrom}:${variant.pos} ${variant.ref}>${variant.alt} | score=${mlScore} | classification=${status}`,
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

    const explanationParts = [shapExplanation];
    if (feat.clinvar_status) explanationParts.push(`(ClinVar: ${feat.clinvar_status})`);
    if (finalDisease) explanationParts.push(`(Disease: ${finalDisease})`);
    const explanation = explanationParts.filter(Boolean).join(" ");

    // Prisma requires floats; store 0 only when the model was not applied, paired with an explicit explanation.
    const storedFrequency = af === null ? null : af;
    const storedCadd = cadd === null ? null : cadd;
    const storedMlScore = mlScore === null ? null : mlScore;

    const evidence = await prisma.evidence.upsert({
      where: { variantId: variant.id },
      update: {
        frequency: storedFrequency,
        conservation_score: storedCadd,
        ml_score: storedMlScore,
        clinvar_status: feat.clinvar_status || null,
        disease: finalDisease,
        shap_explanation: explanation,
      },
      create: {
        variantId: variant.id,
        frequency: storedFrequency,
        conservation_score: storedCadd,
        ml_score: storedMlScore,
        clinvar_status: feat.clinvar_status || null,
        disease: finalDisease,
        shap_explanation: explanation,
      },
    });

    await prisma.variant.update({
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
      ml_score: storedMlScore,
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
