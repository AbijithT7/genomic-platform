const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding initial genomic data...');

  const patient = await prisma.patient.create({
    data: {
      filename: 'sample_patient_BRCA1.vcf',
      variants: {
        create: [
          {
            chrom: 'chr17',
            pos: 43044295,
            ref: 'G',
            alt: 'A',
            status: 'pathogenic',
            evidence: {
              create: {
                frequency: 0.00003,
                conservation_score: 0.992,
                ml_score: 0.965,
                shap_explanation: JSON.stringify({
                  features: {
                    phylop_conservation: 0.45,
                    population_frequency: -0.35,
                    sift_score: 0.2
                  },
                  summary: 'High phylogenetic conservation and ultra-rare population frequency driving pathogenic prediction'
                })
              }
            }
          },
          {
            chrom: 'chr13',
            pos: 32315474,
            ref: 'C',
            alt: 'T',
            status: 'benign',
            evidence: {
              create: {
                frequency: 0.045,
                conservation_score: 0.12,
                ml_score: 0.05,
                shap_explanation: JSON.stringify({
                  features: {
                    phylop_conservation: -0.4,
                    population_frequency: -0.5,
                    sift_score: -0.1
                  },
                  summary: 'Common population polymorphism with low conservation score'
                })
              }
            }
          }
        ]
      }
    }
  });

  console.log(`Seeded patient ${patient.id} with variants & evidence.`);
}

seed()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
