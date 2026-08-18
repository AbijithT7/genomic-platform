const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing Prisma SQLite operations...');

  // 1. Create Patient
  const patient = await prisma.patient.create({
    data: {
      filename: 'sample_patient_001.vcf',
    },
  });
  console.log('Created Patient:', patient);

  // 2. Create Variant for Patient
  const variant = await prisma.variant.create({
    data: {
      patientId: patient.id,
      chrom: 'chr7',
      pos: 140453136,
      ref: 'A',
      alt: 'T',
      status: 'pathogenic',
    },
  });
  console.log('Created Variant:', variant);

  // 3. Create Evidence for Variant
  const evidence = await prisma.evidence.create({
    data: {
      variantId: variant.id,
      frequency: 0.00012,
      conservation_score: 0.985,
      ml_score: 0.942,
      shap_explanation: JSON.stringify({
        feature_importance: {
          conservation: 0.42,
          allele_frequency: -0.31,
          protein_domain: 0.27
        }
      }),
    },
  });
  console.log('Created Evidence:', evidence);

  // 4. Query with full relations
  const fullPatient = await prisma.patient.findUnique({
    where: { id: patient.id },
    include: {
      variants: {
        include: {
          evidence: true,
        },
      },
    },
  });
  console.log('Full Query Result:', JSON.stringify(fullPatient, null, 2));

  // Clean up test data
  await prisma.patient.delete({ where: { id: patient.id } });
  console.log('Cleaned up test record. Database verification completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during test:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
