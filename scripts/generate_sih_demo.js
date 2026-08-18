const fs = require('fs');
const path = require('path');

/**
 * Script to generate a realistic demo VCF file (SIH_Live_Demo.vcf)
 * for hackathon presentations and live clinical demonstrations.
 * 
 * Dataset Composition (10 total variants):
 * - Rows 1-8: Common benign polymorphisms (high allele frequency, non-pathogenic)
 * - Row 9: BRAF V600E (chr7:140453136 A>T) - High CADD, rare AF, Pathogenic
 * - Row 10: BRCA1 mutation (chr17:43044295 G>A) - High CADD, rare AF, Pathogenic
 */

function generateVcfContent() {
  const headers = [
    '##fileformat=VCFv4.2',
    '##fileDate=' + new Date().toISOString().split('T')[0].replace(/-/g, ''),
    '##source=SmartIndiaHackathonGenomicEngine_v2.0',
    '##reference=GRCh38/hg38',
    '##FILTER=<ID=PASS,Description="All filters passed">',
    '##INFO=<ID=AF,Number=A,Type=Float,Description="Allele Frequency in gnomAD / 1000 Genomes">',
    '##INFO=<ID=DP,Number=1,Type=Integer,Description="Approximate Read Depth">',
    '##INFO=<ID=GENE,Number=1,Type=String,Description="Associated Gene Symbol">',
    '##INFO=<ID=CLNSIG,Number=.,Type=String,Description="ClinVar Clinical Significance">',
    '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO'
  ];

  const variants = [
    // 1-8: Common benign polymorphisms across Chromosome 1 and Chromosome 2
    { chrom: 'chr1', pos: 11873, id: 'rs1801133', ref: 'G', alt: 'A', qual: '99.0', filter: 'PASS', info: 'AF=0.45;DP=120;CLNSIG=Benign' },
    { chrom: 'chr1', pos: 69511, id: 'rs1800562', ref: 'A', alt: 'G', qual: '95.0', filter: 'PASS', info: 'AF=0.38;DP=115;CLNSIG=Benign' },
    { chrom: 'chr1', pos: 876499, id: 'rs75377567', ref: 'A', alt: 'G', qual: '99.5', filter: 'PASS', info: 'AF=0.42;DP=130;CLNSIG=Benign' },
    { chrom: 'chr1', pos: 925952, id: 'rs9442372', ref: 'G', alt: 'A', qual: '85.0', filter: 'PASS', info: 'AF=0.28;DP=100;CLNSIG=Benign' },
    { chrom: 'chr2', pos: 27468131, id: 'rs1801131', ref: 'T', alt: 'G', qual: '90.0', filter: 'PASS', info: 'AF=0.35;DP=110;CLNSIG=Benign' },
    { chrom: 'chr2', pos: 47630206, id: 'rs6725887', ref: 'C', alt: 'T', qual: '92.5', filter: 'PASS', info: 'AF=0.51;DP=140;CLNSIG=Benign' },
    { chrom: 'chr2', pos: 136608646, id: 'rs4988235', ref: 'C', alt: 'T', qual: '98.0', filter: 'PASS', info: 'AF=0.68;DP=150;CLNSIG=Benign' },
    { chrom: 'chr2', pos: 217436034, id: 'rs1333049', ref: 'G', alt: 'C', qual: '88.0', filter: 'PASS', info: 'AF=0.47;DP=105;CLNSIG=Benign' },

    // 9: Known Pathogenic BRAF V600E Mutation
    { chrom: 'chr7', pos: 140453136, id: 'rs121913527', ref: 'A', alt: 'T', qual: '100.0', filter: 'PASS', info: 'AF=0.00000398;DP=250;GENE=BRAF;CLNSIG=Pathogenic' },

    // 10: Known Pathogenic BRCA1 Mutation
    { chrom: 'chr17', pos: 43044295, id: 'rs80357906', ref: 'G', alt: 'A', qual: '99.0', filter: 'PASS', info: 'AF=0.00003;DP=200;GENE=BRCA1;CLNSIG=Pathogenic' }
  ];

  const lines = [
    ...headers,
    ...variants.map(v => `${v.chrom}\t${v.pos}\t${v.id}\t${v.ref}\t${v.alt}\t${v.qual}\t${v.filter}\t${v.info}`)
  ];

  return lines.join('\n') + '\n';
}

function main() {
  const content = generateVcfContent();
  
  // Output targets
  const rootDir = path.resolve(__dirname, '..');
  const targetPaths = [
    path.join(rootDir, 'SIH_Live_Demo.vcf'),
    path.join(rootDir, 'scripts', 'SIH_Live_Demo.vcf'),
    path.join(rootDir, 'backend', 'test_data', 'SIH_Live_Demo.vcf')
  ];

  // Ensure directories exist
  const backendTestDataDir = path.join(rootDir, 'backend', 'test_data');
  if (!fs.existsSync(backendTestDataDir)) {
    fs.mkdirSync(backendTestDataDir, { recursive: true });
  }

  targetPaths.forEach(targetPath => {
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log(`[SUCCESS] Generated: ${targetPath}`);
  });

  console.log('\n--- VCF Summary ---');
  console.log('Total Variants: 10');
  console.log('- 8 Benign Polymorphisms (chr1, chr2)');
  console.log('- 1 Pathogenic BRAF V600E (chr7:140453136 A>T)');
  console.log('- 1 Pathogenic BRCA1 (chr17:43044295 G>A)');
  console.log('Ready for live hackathon presentation upload!');
}

main();
