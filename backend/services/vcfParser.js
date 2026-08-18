const fs = require('fs');
const readline = require('readline');

/**
 * Parses raw INFO column key-value string from VCF (e.g., "AF=0.0001;GENE=BRAF;CLNDN=Colorectal_cancer;CLNSIG=Pathogenic")
 */
function parseInfoField(infoStr) {
  if (!infoStr || infoStr === '.' || typeof infoStr !== 'string') {
    return { gene: null, disease: null, clinvar_status: null, af: null };
  }

  const result = {
    gene: null,
    disease: null,
    clinvar_status: null,
    af: null,
  };

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
    } else if ((key === 'AF' || key === 'GNOMAD_AF' || key === 'AF_EXOME') && result.af === null) {
      const parsedAf = parseFloat(val);
      if (!isNaN(parsedAf)) result.af = parsedAf;
    }
  }

  return result;
}

/**
 * Stream-based local VCF parser using native fs and readline modules.
 * Reads the VCF file line by line for memory safety and extracts
 * genomic coordinates, reference/alternate alleles, rsIDs, and INFO clinical annotations.
 *
 * @param {string} filePath - Absolute or relative path to the .vcf file
 * @returns {Promise<Array<{ chrom: string, pos: number, ref: string, alt: string, qual: number|null, rsid: string|null, gene: string|null, disease: string|null, clinvar_status: string|null, af: number|null }>>}
 */
function parseVCF(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`VCF file not found at path: ${filePath}`));
    }

    const variants = [];
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

      // Skip empty lines and comment/header lines starting with '#'
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
        });
      }
    });

    rl.on('close', () => {
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
};

