const fs = require('fs');
const path = require('path');
const { fetchFeatures } = require('./services/annotationService');

async function testPipeline() {
  console.log('--- TEST 1: Unit testing services/annotationService.js (MyVariant.info) ---');
  // Test well-known variant: BRAF V600E (chr7:140453136 A>T)
  console.log('Fetching MyVariant.info annotations for chr7:140453136 A>T (BRAF V600E)...');
  const brafFeat = await fetchFeatures('7', 140453136, 'A', 'T');
  console.log('BRAF V600E Features:', brafFeat);

  // Test non-existent / novel variant fallback
  console.log('Testing fallback for novel/unknown variant...');
  const unknownFeat = await fetchFeatures('1', 999999999, 'A', 'T');
  console.log('Unknown Variant Features (should be zeroes/null):', unknownFeat);

  if (unknownFeat.allele_frequency !== 0 || unknownFeat.cadd_score !== 0) {
    throw new Error('Fallback failed for unknown variant');
  }
  console.log('✓ Annotation service unit test passed!\n');

  console.log('--- TEST 2: Testing POST /api/analyze/:patientId End-to-End ---');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  // 1. Upload sample VCF to create a Patient and Variants
  const sampleVcfPath = path.join(__dirname, 'test_data', 'sample.vcf');
  const fileBuffer = fs.readFileSync(sampleVcfPath);
  const blob = new Blob([fileBuffer], { type: 'text/plain' });
  const formData = new FormData();
  formData.append('file', blob, 'pipeline_patient_test.vcf');

  const uploadRes = await fetch('http://localhost:3001/api/upload', {
    method: 'POST',
    body: formData,
  });
  const uploadData = await uploadRes.json();
  console.log('Upload Result:', uploadData);

  const patientId = uploadData.patientId;
  if (!patientId) throw new Error('Upload failed: missing patientId');

  // 2. Trigger the analysis pipeline
  console.log(`Triggering analysis pipeline for Patient ID: ${patientId}...`);
  const analyzeRes = await fetch(`http://localhost:3001/api/analyze/${patientId}`, {
    method: 'POST',
  });

  const analyzeData = await analyzeRes.json();
  console.log('Analyze Status:', analyzeRes.status);
  console.log('Analyze Response Summary:', {
    message: analyzeData.message,
    totalAnalyzed: analyzeData.data?.totalAnalyzed,
    pathogenicCount: analyzeData.data?.pathogenicCount,
    benignCount: analyzeData.data?.benignCount,
    vusCount: analyzeData.data?.vusCount,
  });

  if (analyzeRes.status !== 200) {
    throw new Error(`Analyze endpoint failed: ${JSON.stringify(analyzeData)}`);
  }

  // 3. Verify Database Records
  console.log('\n--- TEST 3: Verifying Database Evidence & Updated Variant Statuses ---');
  const updatedPatient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      variants: {
        include: {
          evidence: true,
        },
      },
    },
  });

  console.log(`Patient ${updatedPatient.id} has ${updatedPatient.variants.length} variants:`);
  for (const v of updatedPatient.variants) {
    console.log(`- [${v.status}] chr${v.chrom}:${v.pos} ${v.ref}>${v.alt} | ML: ${v.evidence?.ml_score} | Disease: ${v.evidence?.disease}`);
    console.log(`  SHAP: ${v.evidence?.shap_explanation}`);
    if (!v.evidence) {
      throw new Error(`Variant ${v.id} missing Evidence record!`);
    }
  }

  // Clean up test patient
  await prisma.patient.delete({ where: { id: patientId } });
  console.log('✓ Cleaned up test patient record from database.');

  await prisma.$disconnect();
  console.log('\nAll orchestration pipeline tests passed successfully! 🎉');
  process.exit(0);
}

testPipeline().catch((err) => {
  console.error('Pipeline test failed:', err);
  process.exit(1);
});
