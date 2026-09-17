const fs = require('fs');
const readline = require('readline');

/**
 * Parses raw INFO column key-value string from VCF (e.g., "AF=0.0001;GENE=BRAF;CLNDN=Colorectal_cancer;CLNSIG=Pathogenic")
 */
function parseInfoField(infoStr) {
  if (!infoStr || infoStr === '.' || typeof infoStr !== 'string') {
    return { gene: null, disease: null, clinvar_status: null, af: null, cadd: null };
  }

  const result = {
    gene: null,
    disease: null,
    clinvar_status: null,
    af: null,
    cadd: null,
  };

  let rawAc = null;
  let rawAn = null;

  const parts = infoStr.split(';');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;

    const key = part.slice(0, eqIdx).trim().toUpperCase();
    const val = part.slice(eqIdx + 1).trim();

    if ((key === 'GENE' || key === 'SYMBOL' || key === 'GENENAME') && !result.gene) {
      result.gene = val;
    } else if ((key === 'CLNDN' || key === 'DISEASE' || key === 'PHENOTYPE' || key === 'CONDITION') && !result.disease) {
      const cleanVal = val.replace(/_/g, ' ').replace(/\|/g, '; ');
      if (cleanVal && !['.', 'not_provided', 'not_specified'].includes(cleanVal.toLowerCase())) {
        result.disease = cleanVal;
      }
    } else if ((key === 'CLNSIG' || key === 'CLINVAR' || key === 'SIGNIFICANCE') && !result.clinvar_status) {
      result.clinvar_status = val.replace(/_/g, ' ');
    } else if ((key === 'AF' || key === 'GNOMAD_AF' || key === 'AF_EXOME' || key === '1000G_AF' || key === 'EUR_AF' || key === 'AF_POPMAX' || key === 'MAX_AF') && result.af === null) {
      const firstAf = val.split(',')[0].trim();
      const parsedAf = parseFloat(firstAf);
      if (!isNaN(parsedAf)) result.af = parsedAf;
    } else if (key === 'AC' && rawAc === null) {
      rawAc = val.split(',')[0].trim();
    } else if (key === 'AN' && rawAn === null) {
      rawAn = val.trim();
    } else if ((key === 'CADD' || key === 'CADD_PHRED' || key === 'CADD_SCORE' || key === 'CADDR' || key === 'CADDRAW') && result.cadd === null) {
      const firstCadd = val.split(',')[0].trim();
      const parsedCadd = parseFloat(firstCadd);
      if (!isNaN(parsedCadd)) result.cadd = parsedCadd;
    }
  }

  // If explicit AF was not found, compute from AC/AN if available
  if (result.af === null && rawAc !== null && rawAn !== null) {
    const acNum = parseFloat(rawAc);
    const anNum = parseFloat(rawAn);
    if (!isNaN(acNum) && !isNaN(anNum) && anNum > 0) {
      result.af = acNum / anNum;
    }
  }

  return result;
}

/**
 * Normalizes genome build string into standard tokens: 'hg19', 'hg38', or 'hg18'
 */
function normalizeGenomeBuild(buildStr) {
  if (!buildStr || typeof buildStr !== 'string') return 'hg19';
  const lower = buildStr.toLowerCase();
  if (lower.includes('38') || lower.includes('grch38')) return 'hg38';
  if (lower.includes('36') || lower.includes('hg18') || lower.includes('ncbi36')) return 'hg18';
  return 'hg19';
}

/**
 * Stream-based local VCF parser using native fs and readline modules.
 * Reads the VCF file line by line for memory safety and extracts
 * genome reference build, coordinates, alleles, rsIDs, and INFO clinical annotations.
 *
 * @param {string} filePath - Absolute or relative path to the .vcf file
 * @returns {Promise<Array<{ chrom: string, pos: number, ref: string, alt: string, qual: number|null, rsid: string|null, gene: string|null, disease: string|null, clinvar_status: string|null, af: number|null, cadd: number|null }>>}
 */
function parseVCF(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`VCF file not found at path: ${filePath}`));
    }

    const variants = [];
    let detectedReference = 'hg19';
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });

    fileStream.on('error', (err) => {
      reject(err);
    });

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      const trimmed = line.trim();

      // Check header lines for genome reference metadata
      if (trimmed.startsWith('##')) {
        const refMatch = trimmed.match(/^##(?:reference|assembly|source)=([^\r\n]+)/i);
        if (refMatch && refMatch[1]) {
          detectedReference = normalizeGenomeBuild(refMatch[1]);
        }
        return;
      }

      // Skip table header line starting with '#'
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }

      // Split data line by tab delimiter (or fallback to whitespace if non-standard)
      const cols = trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(/\s+/);
      if (cols.length < 4) {
        return;
      }

      const rawChrom = cols[0];
      const rawPos = cols[1];
      const rawId = cols[2];
      const rawRef = cols[3];
      const rawAlt = cols[4];
      const rawQual = cols[5];
      const rawInfo = cols[7];

      // Strip 'chr' prefix (e.g. 'chr7' -> '7', 'chrX' -> 'X')
      const chrom = rawChrom.replace(/^chr/i, '').trim();
      const pos = parseInt(rawPos, 10);
      const ref = rawRef.trim();

      // For ALT, if there are multiple alleles separated by commas, take the first one
      const alt = rawAlt ? rawAlt.split(',')[0].trim() : '';

      // Parse ID (rsID)
      const rsid = rawId && rawId !== '.' ? rawId.trim() : null;

      // Parse QUAL score (null if missing or '.')
      let qual = null;
      if (rawQual !== undefined && rawQual !== null && rawQual !== '.') {
        const parsedQual = parseFloat(rawQual);
        qual = isNaN(parsedQual) ? null : parsedQual;
      }

      // Parse INFO column
      const infoData = parseInfoField(rawInfo);

      if (chrom && !isNaN(pos) && ref && alt) {
        variants.push({
          chrom,
          pos,
          ref,
          alt,
          qual,
          rsid,
          gene: infoData.gene,
          disease: infoData.disease,
          clinvar_status: infoData.clinvar_status,
          af: infoData.af,
          cadd: infoData.cadd,
          referenceBuild: detectedReference,
        });
      }
    });

    rl.on('close', () => {
      variants.referenceBuild = detectedReference;
      resolve(variants);
    });

    rl.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = {
  parseVCF,
  parseVcf: parseVCF, // alias for convenience
  parseInfoField,
  normalizeGenomeBuild,
};

