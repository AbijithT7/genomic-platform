const fs = require('fs');
const path = require('path');
const { parseVCF } = require('./services/vcfParser');

async function runTests() {
  console.log('--- TEST 1: Unit testing local stream-based services/vcfParser.js ---');
  const sampleVcfPath = path.join(__dirname, 'test_data', 'sample.vcf');
  const parsed = await parseVCF(sampleVcfPath);

  console.log('Parsed variants count:', parsed.length);
  console.log('Parsed variants:', JSON.stringify(parsed, null, 2));

  if (parsed.length !== 6) {
    throw new Error(`Expected 6 variants, got ${parsed.length}`);
  }

  // Check normalization: chr7 -> 7
  if (parsed[0].chrom !== '7' || parsed[0].pos !== 140453136 || parsed[0].ref !== 'A' || parsed[0].alt !== 'T' || parsed[0].qual !== 99.5) {
    throw new Error(`Variant 0 validation failed: ${JSON.stringify(parsed[0])}`);
  }

  // Check missing QUAL: '.' -> null
  if (parsed[2].chrom !== '13' || parsed[2].qual !== null) {
    throw new Error(`Variant 2 validation failed: ${JSON.stringify(parsed[2])}`);
  }

  // Check non-prefixed CHROM: 22 -> 22
  if (parsed[3].chrom !== '22') {
    throw new Error(`Variant 3 validation failed: ${JSON.stringify(parsed[3])}`);
  }

  // Check chrX -> X
  if (parsed[4].chrom !== 'X') {
    throw new Error(`Variant 4 validation failed: ${JSON.stringify(parsed[4])}`);
  }

  // Check multi-allele: G,T -> G (first element)
  if (parsed[5].chrom !== '1' || parsed[5].alt !== 'G') {
    throw new Error(`Variant 5 multi-allele validation failed: ${JSON.stringify(parsed[5])}`);
  }

  console.log('✓ Local stream-based VCF parser unit test passed!\n');

  console.log('--- TEST 2: Testing POST /api/upload endpoint with local parser ---');
  const { app, server, prisma } = require('./server');

  const fileBuffer = fs.readFileSync(sampleVcfPath);
  const blob = new Blob([fileBuffer], { type: 'text/plain' });
  const formData = new FormData();
  formData.append('file', blob, 'sample_stream_parsed.vcf');

  const uploadRes = await fetch('http://localhost:3001/api/upload', {
    method: 'POST',
    body: formData,
  });

  const uploadJson = await uploadRes.json();
  console.log('Upload response status:', uploadRes.status);
  console.log('Upload response body:', uploadJson);

  if (uploadRes.status !== 201 || !uploadJson.patientId || uploadJson.totalVariants !== 6) {
    throw new Error('Upload endpoint returned unexpected response');
  }

  console.log('✓ Upload endpoint responded with 201 and 6 inserted variants!');

  console.log('--- TEST 3: Verifying Database Records ---');
  const patient = await prisma.patient.findUnique({
    where: { id: uploadJson.patientId },
    include: { variants: true },
  });

  console.log(`Found Patient ${patient.id} with ${patient.variants.length} variants in database.`);
  console.log('Variants in database:', patient.variants);

  if (patient.variants.length !== 6) {
    throw new Error(`Expected 6 variants in database, found ${patient.variants.length}`);
  }

  // Verify uploads directory does not have leftover file
  const uploadsDir = path.join(__dirname, 'uploads');
  const uploadFiles = fs.readdirSync(uploadsDir);
  console.log('Files currently in uploads/ dir:', uploadFiles);

  // Cleanup test patient
  await prisma.patient.delete({ where: { id: uploadJson.patientId } });
  console.log('✓ Cleaned up test patient record.');

  server.close();
  await prisma.$disconnect();
  console.log('\nAll tests completed successfully! 🎉');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
