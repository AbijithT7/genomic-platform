const axios = require('axios');

/**
 * Curated knowledge base mapping major disease-associated and actionable genes
 * (including ACMG Secondary Findings and standard clinical panels) to their primary clinical conditions/syndromes.
 */
const GENE_DISEASE_MAP = {
  BRAF: 'BRAF-associated cancers (Melanoma, Colorectal, NSCLC, Thyroid)',
  BRCA1: 'Hereditary breast and ovarian cancer syndrome (HBOC)',
  BRCA2: 'Hereditary breast and ovarian cancer syndrome (HBOC) / Fanconi anemia',
  TP53: 'Li-Fraumeni syndrome (LFS) / Multiple cancer predisposition',
  KRAS: 'Somatic carcinoma (Pancreatic, Colorectal, NSCLC); Noonan syndrome',
  NRAS: 'Melanoma, Colorectal carcinoma; Noonan syndrome',
  HRAS: 'Costello syndrome; Bladder / Thyroid carcinoma',
  EGFR: 'Non-small cell lung carcinoma (NSCLC) / TKI response; Glioma',
  PIK3CA: 'PIK3CA-related overgrowth spectrum (PROS); Breast / Colorectal cancer',
  PTEN: 'Cowden syndrome / PTEN hamartoma tumor syndrome',
  APC: 'Familial adenomatous polyposis (FAP) / Colorectal cancer',
  MLH1: 'Lynch syndrome / Hereditary nonpolyposis colorectal cancer (HNPCC)',
  MSH2: 'Lynch syndrome / Hereditary nonpolyposis colorectal cancer (HNPCC)',
  MSH6: 'Lynch syndrome / Colorectal & Endometrial cancer',
  PMS2: 'Lynch syndrome / Colorectal cancer',
  RET: 'Multiple endocrine neoplasia type 2 (MEN2) / Medullary thyroid cancer',
  VHL: 'Von Hippel-Lindau syndrome / Clear cell renal carcinoma',
  RB1: 'Retinoblastoma / Osteosarcoma',
  PALB2: 'Hereditary breast and pancreatic cancer predisposition',
  ATM: 'Ataxia-telangiectasia / Cancer susceptibility',
  CHEK2: 'Hereditary breast and colorectal cancer susceptibility',
  CDH1: 'Hereditary diffuse gastric cancer (HDGC) / Lobular breast cancer',
  CFTR: 'Cystic fibrosis / Congenital absence of the vas deferens (CBAVD)',
  HFE: 'Hereditary hemochromatosis type 1 (HFE1)',
  MTHFR: 'MTHFR thermolabile polymorphism / Hyperhomocysteinemia',
  LDLR: 'Familial hypercholesterolemia (FH)',
  APOB: 'Familial hypercholesterolemia (FH)',
  PCSK9: 'Familial hypercholesterolemia (FH)',
  MYH7: 'Familial hypertrophic cardiomyopathy (HCM)',
  MYBPC3: 'Familial hypertrophic cardiomyopathy (HCM)',
  KCNQ1: 'Long QT syndrome type 1 (LQTS1)',
  KCNH2: 'Long QT syndrome type 2 (LQTS2)',
  SCN5A: 'Brugada syndrome / Long QT syndrome type 3 (LQTS3)',
  FBN1: 'Marfan syndrome',
  COL3A1: 'Vascular Ehlers-Danlos syndrome (vEDS)',
  SMAD3: 'Loeys-Dietz syndrome',
  TGFBR1: 'Loeys-Dietz syndrome',
  TGFBR2: 'Loeys-Dietz syndrome',
  RYR1: 'Malignant hyperthermia susceptibility (MHS)',
  CACNA1S: 'Malignant hyperthermia susceptibility / Hypokalemic periodic paralysis',
  GJB2: 'Non-syndromic sensorineural hearing loss (DFNB1)',
  PAH: 'Phenylketonuria (PKU)',
  HBB: 'Sickle cell disease / Beta-thalassemia',
  HEXA: 'Tay-Sachs disease',
  GBA: 'Gaucher disease / Parkinson\'s disease susceptibility',
  SMPD1: 'Niemann-Pick disease (Types A/B)',
  GLA: 'Fabry disease',
  DMD: 'Duchenne / Becker muscular dystrophy',
  NF1: 'Neurofibromatosis type 1 (NF1)',
  NF2: 'Neurofibromatosis type 2 / Schwannomatosis',
  TSC1: 'Tuberous sclerosis complex (TSC1)',
  TSC2: 'Tuberous sclerosis complex (TSC2)',
  WT1: 'Wilms tumor / Denys-Drash syndrome',
  MEN1: 'Multiple endocrine neoplasia type 1 (MEN1)',
  MUTYH: 'MUTYH-associated polyposis (MAP)',
  STK11: 'Peutz-Jeghers syndrome',
  SMAD4: 'Juvenile polyposis syndrome / Hereditary hemorrhagic telangiectasia',
  BMPR1A: 'Juvenile polyposis syndrome',
  CDKN2A: 'Familial melanoma / Pancreatic cancer',
  BAP1: 'BAP1 tumor predisposition syndrome',
  SDHB: 'Hereditary paraganglioma-pheochromocytoma syndrome',
  SDHD: 'Hereditary paraganglioma-pheochromocytoma syndrome',
  SDHC: 'Hereditary paraganglioma-pheochromocytoma syndrome',
  FH: 'Hereditary leiomyomatosis and renal cell cancer (HLRCC)',
  FLCN: 'Birt-Hogg-Dubé syndrome',
  RXFP2: 'Cryptorchidism susceptibility / Osteoporosis'
};

const IGNORED_TERMS = [
  'not provided',
  'none provided',
  'not specified',
  'unspecified',
  'other',
  'see cases',
  'allhighlypenetrant',
  'inborn genetic diseases',
  'cancer',
  'malignant neoplastic disease',
  'tumor predisposition',
  'neoplastic syndromes, hereditary',
  'cardiovascular phenotype',
  'reclassified - adra2c polymorphism',
  'reclassified - adrb1 polymorphism',
  'disease',
  '.'
];

/**
 * Validates and cleans raw condition/disease text strings from clinical APIs.
 */
function cleanConditionString(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let str = raw
    .replace(/\[MIM:\d+\]/gi, '')
    .replace(/\[orphanet:\d+\]/gi, '')
    .replace(/\[medgen:[a-z0-9]+\]/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  str = str.replace(/^[;, ]+|[;, ]+$/g, '');
  if (str.length < 3) return null;

  const lower = str.toLowerCase();
  for (const term of IGNORED_TERMS) {
    if (lower === term || lower.startsWith(term + ';') || lower.endsWith(';' + term)) {
      return null;
    }
  }
  return str;
}

/**
 * Extracts condition and disease descriptions from diverse MyVariant annotations:
 * ClinVar RCV/traits, UniProt HumsaVar/phenotypes, CIViC, COSMIC, dbNSFP, and Gene mappings.
 */
function extractConditionsFromData(data) {
  if (!data) return null;
  const names = new Set();

  const add = (val) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach(add);
      return;
    }
    if (typeof val === 'string') {
      const c = cleanConditionString(val);
      if (c) names.add(c);
      return;
    }
    if (typeof val !== 'object') return;

    if (val.name) add(val.name);
    if (val.preferred_name) add(val.preferred_name);
    if (val.disease_name) add(val.disease_name);
    if (val.disease) add(val.disease);
    if (val.trait) add(val.trait);
    if (val.traits) add(val.traits);
    if (val.conditions) add(val.conditions);
    if (val.condition) add(val.condition);
    if (val.synonyms) add(val.synonyms);
    if (val.phenotype_disease) add(val.phenotype_disease);
  };

  // 1. ClinVar records
  if (data.clinvar) {
    const rcvList = Array.isArray(data.clinvar.rcv) ? data.clinvar.rcv : [data.clinvar.rcv];
    rcvList.filter(Boolean).forEach(rcv => {
      add(rcv.conditions);
      add(rcv.condition);
      add(rcv.trait);
      if (rcv.trait_name) add(rcv.trait_name);
    });
    add(data.clinvar.traits);
    add(data.clinvar.trait);
  }

  // 2. UniProt HumsaVar & phenotype associations
  if (data.uniprot?.humsavar?.disease_name) {
    add(data.uniprot.humsavar.disease_name);
  }
  if (data.uniprot?.phenotype_disease) {
    add(data.uniprot.phenotype_disease);
  }

  // 3. CIViC clinical evidence
  if (data.civic) {
    if (Array.isArray(data.civic.evidence_items)) {
      data.civic.evidence_items.forEach(item => add(item.disease));
    }
    if (data.civic.disease) add(data.civic.disease);
    if (data.civic.description && !names.size) {
      add(data.civic.description);
    }
  }

  // 4. COSMIC cancer associations
  if (data.cosmic) {
    const cosmicList = Array.isArray(data.cosmic) ? data.cosmic : [data.cosmic];
    cosmicList.forEach(c => {
      if (c.site_histology) add(c.site_histology);
      if (c.tumor_site) add(`${c.tumor_site} neoplasm`);
    });
  }

  // 5. dbNSFP ClinVar trait
  if (data.dbnsfp?.clinvar_trait) {
    add(data.dbnsfp.clinvar_trait);
  }

  // 6. Gene Symbol fallback from annotation
  const geneSymbol = data.clinvar?.gene?.symbol ||
    data.dbsnp?.gene?.symbol ||
    (Array.isArray(data.snpeff?.ann) ? data.snpeff.ann[0]?.genename : data.snpeff?.ann?.genename);

  if (geneSymbol && names.size === 0) {
    const upper = String(geneSymbol).toUpperCase();
    if (GENE_DISEASE_MAP[upper]) {
      names.add(GENE_DISEASE_MAP[upper]);
    }
  }

  const list = [...names].filter(Boolean);
  return list.slice(0, 2).join('; ') || null;
}

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Local in-memory caches for fast local lookups of ClinVar and CADD datasets
let localCaddMap = null;
let localClinvarMap = null;

function getLocalCaddMap() {
  if (localCaddMap !== null) return localCaddMap;
  localCaddMap = new Map();
  try {
    const caddGzPath = path.join(__dirname, '..', '..', 'ml-service', 'data', 'cadd_results.tsv.gz');
    if (fs.existsSync(caddGzPath)) {
      const buffer = fs.readFileSync(caddGzPath);
      const unzipped = zlib.gunzipSync(buffer).toString('utf8');
      const lines = unzipped.split('\n');
      for (const line of lines) {
        if (!line || line.startsWith('#')) continue;
        const parts = line.split('\t');
        if (parts.length >= 6) {
          const chrom = parts[0].replace(/^chr/i, '').trim();
          const pos = parts[1].trim();
          const ref = parts[2].trim().toUpperCase();
          const alt = parts[3].trim().toUpperCase();
          const phred = parseFloat(parts[5].trim());
          if (!isNaN(phred)) {
            localCaddMap.set(`${chrom}:${pos}:${ref}:${alt}`, phred);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[AnnotationService] Notice: Could not load local CADD file:', err.message);
  }
  return localCaddMap;
}

function getLocalClinvarMap() {
  if (localClinvarMap !== null) return localClinvarMap;
  localClinvarMap = new Map();
  try {
    const csvPath = path.join(__dirname, '..', '..', 'ml-service', 'data', 'model_training_data.csv');
    if (fs.existsSync(csvPath)) {
      const content = fs.readFileSync(csvPath, 'utf8');
      const lines = content.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        if (cols.length >= 8) {
          const chrom = cols[0].replace(/^chr/i, '').trim();
          const pos = cols[1].trim();
          const ref = cols[2].trim().toUpperCase();
          const alt = cols[3].trim().toUpperCase();
          const clinvar_status = cols[5].trim();
          const af = parseFloat(cols[6].trim());
          const cadd = parseFloat(cols[7].trim());
          localClinvarMap.set(`${chrom}:${pos}:${ref}:${alt}`, {
            allele_frequency: isNaN(af) ? null : af,
            cadd_score: isNaN(cadd) ? null : cadd,
            clinvar_status: clinvar_status || null,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[AnnotationService] Notice: Could not load local ClinVar training data:', err.message);
  }
  return localClinvarMap;
}

/**
 * Extracts numeric CADD score from MyVariant document across various field structures.
 */
function extractCaddScore(data) {
  if (!data) return null;
  if (data.cadd) {
    if (typeof data.cadd.phred === 'number') return data.cadd.phred;
    if (typeof data.cadd.phred === 'string') {
      const p = parseFloat(data.cadd.phred);
      if (!isNaN(p)) return p;
    }
    if (Array.isArray(data.cadd.phred) && data.cadd.phred.length > 0) {
      const p = parseFloat(data.cadd.phred[0]);
      if (!isNaN(p)) return p;
    }
    if (Array.isArray(data.cadd)) {
      for (const item of data.cadd) {
        if (item && item.phred !== undefined && item.phred !== null) {
          const p = parseFloat(item.phred);
          if (!isNaN(p)) return p;
        }
      }
    }
  }
  if (data.dbnsfp?.cadd_phred !== undefined && data.dbnsfp?.cadd_phred !== null) {
    const val = Array.isArray(data.dbnsfp.cadd_phred) ? data.dbnsfp.cadd_phred[0] : data.dbnsfp.cadd_phred;
    const p = parseFloat(val);
    if (!isNaN(p)) return p;
  }
  return null;
}

/**
 * Extracts population allele frequency from MyVariant document across gnomAD, dbSNP, 1000G, and ExAC.
 */
function parseFreqValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return parseFreqValue(value.af ?? value.AF ?? value.freq);
  }
  const raw = Array.isArray(value) ? value[0] : value;
  const val = parseFloat(raw);
  if (!isNaN(val) && val >= 0 && val <= 1) return val;
  return null;
}

function extractAlleleFrequency(data, cleanAlt) {
  if (!data) return null;

  const gnomadExome = parseFreqValue(data.gnomad_exome?.af?.af) ?? parseFreqValue(data.gnomad_exome?.af);
  if (gnomadExome !== null) return gnomadExome;

  const gnomadGenome = parseFreqValue(data.gnomad_genome?.af?.af) ?? parseFreqValue(data.gnomad_genome?.af);
  if (gnomadGenome !== null) return gnomadGenome;

  if (data.dbsnp?.alleles && Array.isArray(data.dbsnp.alleles)) {
    const matched = data.dbsnp.alleles.find(a => a.allele === cleanAlt) || data.dbsnp.alleles[1];
    if (matched?.freq) {
      const freqObj = matched.freq;
      const f = parseFreqValue(freqObj.gnomad) ?? parseFreqValue(freqObj['1000genomes']) ?? parseFreqValue(freqObj.topmed) ?? parseFreqValue(freqObj.exac);
      if (f !== null) return f;
    }
  }
  const caddAf = parseFreqValue(data.cadd?.['1000g']?.af) ?? parseFreqValue(data.cadd?.esp?.af);
  if (caddAf !== null) return caddAf;

  const kg = parseFreqValue(data['1000genomes']?.af);
  if (kg !== null) return kg;

  const exac = parseFreqValue(data.exac?.af);
  if (exac !== null) return exac;

  return null;
}

function ensemblBaseForBuild(genomeBuild) {
  return genomeBuild === 'hg38' ? 'https://rest.ensembl.org' : 'https://grch37.rest.ensembl.org';
}

function asAnnotationDocs(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.filter(Boolean);
  if (Array.isArray(payload.hits)) return payload.hits.filter(Boolean);
  if (payload._id || payload.clinvar || payload.cadd || payload.dbsnp || payload.snpeff) return [payload];
  return [];
}

function scoreAnnotationDoc(doc, normChrom, numPos, cleanRef, cleanAlt, cleanRsid = null) {
  if (!doc) return -1;
  let score = 0;
  const id = String(doc._id || '');
  const idMatch = id.match(/chr([0-9XYM]+):g\.(\d+)([ACGTN]+)>([ACGTN]+)/i);
  if (idMatch) {
    if (idMatch[1].toUpperCase() === String(normChrom).toUpperCase()) score += 2;
    if (parseInt(idMatch[2], 10) === numPos) score += 6;
    const idRef = idMatch[3].toUpperCase();
    const idAlt = idMatch[4].toUpperCase();
    if (idRef === cleanRef && idAlt === cleanAlt) score += 8;
    else if (idRef === cleanAlt && idAlt === cleanRef) score += 4;
  }
  if (doc.hg19?.start && parseInt(doc.hg19.start, 10) === numPos) {
    score += 6;
  }
  const docRef = String(doc.vcf?.ref || doc.cadd?.ref || '').toUpperCase();
  const docAlt = String(doc.vcf?.alt || doc.cadd?.alt || '').toUpperCase();
  if (docRef === cleanRef && docAlt === cleanAlt) score += 4;
  else if (docRef === cleanAlt && docAlt === cleanRef) score += 2;

  if (cleanRsid) {
    const docRsid = String(doc.dbsnp?.rsid || (id.startsWith('rs') ? id : ''));
    if (docRsid.toLowerCase() === cleanRsid.toLowerCase()) {
      score += 15;
    }
  }
  if (extractCaddScore(doc) !== null) score += 10;
  if (extractAlleleFrequency(doc, cleanAlt) !== null || extractAlleleFrequency(doc, cleanRef) !== null) score += 5;
  return score;
}

function pickAnnotationDoc(docs, normChrom, numPos, cleanRef, cleanAlt, cleanRsid = null) {
  if (!docs.length) return null;
  let best = docs[0];
  let bestScore = -1;
  for (const doc of docs) {
    const s = scoreAnnotationDoc(doc, normChrom, numPos, cleanRef, cleanAlt, cleanRsid);
    if (s > bestScore) {
      best = doc;
      bestScore = s;
    }
  }
  return best;
}

/**
 * Ensembl REST API fallback for allele frequencies and CADD scores
 */
function parseEnsemblVepEntry(entry, cleanAlt, cleanRef) {
  if (!entry) return { af: null, cadd: null, gene: null };
  let af = null;
  let cadd = null;
  let gene = null;

  if (Array.isArray(entry.colocated_variants)) {
    for (const cv of entry.colocated_variants) {
      if (!cv.frequencies) continue;
      const altFreqs = cv.frequencies[cleanAlt] || cv.frequencies[cleanRef] || Object.values(cv.frequencies)[0];
      if (!altFreqs) continue;
      const parsed = parseFreqValue(altFreqs.gnomadg) ?? parseFreqValue(altFreqs.gnomade) ?? parseFreqValue(altFreqs.af) ?? parseFreqValue(altFreqs.eur);
      if (parsed !== null) {
        if (cv.frequencies[cleanAlt]) {
          af = parsed;
        } else if (cv.frequencies[cleanRef] && !cv.frequencies[cleanAlt]) {
          af = parsed <= 1 ? Number((1 - parsed).toPrecision(6)) : parsed;
        } else {
          af = parsed;
        }
        break;
      }
    }
  }

  if (Array.isArray(entry.transcript_consequences)) {
    for (const tc of entry.transcript_consequences) {
      if (!gene && tc.gene_symbol) gene = tc.gene_symbol;
      if (cadd === null && tc.cadd_phred !== undefined && tc.cadd_phred !== null) {
        const parsed = parseFloat(tc.cadd_phred);
        if (!isNaN(parsed)) cadd = parsed;
      }
    }
  }

  return { af, cadd, gene };
}

async function fetchEnsemblFallback(normChrom, numPos, cleanRef, cleanAlt, cleanRsid, genomeBuild = 'hg19') {
  const base = ensemblBaseForBuild(genomeBuild);
  const urls = [];
  if (cleanRsid) {
    urls.push(`${base}/vep/human/id/${encodeURIComponent(cleanRsid)}`);
    urls.push(`${base}/variation/human/${encodeURIComponent(cleanRsid)}`);
  }
  if (cleanRef && cleanAlt && cleanAlt !== '.') {
    urls.push(`${base}/vep/human/hgvs/${encodeURIComponent(`${normChrom}:g.${numPos}${cleanRef}>${cleanAlt}`)}`);
  }

  for (const url of urls) {
    try {
      const resp = await axios.get(url, {
        timeout: 8000,
        headers: { Accept: 'application/json' },
      });

      if (Array.isArray(resp.data) && resp.data.length > 0) {
        return parseEnsemblVepEntry(resp.data[0], cleanAlt, cleanRef);
      }

      if (resp.data && (resp.data.MAF !== undefined || resp.data.minor_allele_freq !== undefined)) {
        const maf = parseFreqValue(resp.data.MAF ?? resp.data.minor_allele_freq);
        const minor = String(resp.data.minor_allele || '').toUpperCase();
        let af = maf;
        if (maf !== null && minor) {
          if (minor === cleanAlt) af = maf;
          else if (minor === cleanRef) af = Number((1 - maf).toPrecision(6));
        }
        return { af, cadd: null, gene: null };
      }
    } catch (_) {
      continue;
    }
  }
  return null;
}

/**
 * Fetches variant annotations and population allele frequencies from MyVariant.info API,
 * Ensembl REST API, local datasets, and VCF annotations.
 *
 * @param {string} chrom - Chromosome name (e.g., '7', 'chr7')
 * @param {number|string} pos - Genomic position
 * @param {string} ref - Reference allele
 * @param {string} alt - Alternate allele
 * @param {string} [rsid] - dbSNP ID if known (e.g. 'rs121913527')
 * @param {string} [geneHint] - Associated gene if annotated in VCF
 * @param {string} [diseaseHint] - Condition/disease if annotated in VCF
 * @param {number} [vcfAf] - Allele frequency parsed from VCF INFO column
 * @param {number} [vcfCadd] - CADD score parsed from VCF INFO column
 * @param {string} [genomeBuild] - Reference assembly ('hg19', 'hg38', 'hg18')
 * @returns {Promise<{ allele_frequency: number, cadd_score: number, clinvar_status: string|null, disease: string|null, gene: string|null }>}
 */
async function fetchFeatures(chrom, pos, ref, alt, rsid = null, geneHint = null, diseaseHint = null, vcfAf = null, vcfCadd = null, genomeBuild = 'hg19') {
  const normChrom = String(chrom).replace(/^chr/i, '').trim();
  const numPos = parseInt(pos, 10);
  const cleanRef = String(ref || '').trim().toUpperCase();
  const cleanAlt = String(alt || '').trim().toUpperCase();
  const cleanGene = geneHint ? String(geneHint).trim().toUpperCase() : null;
  const cleanRsid = rsid && typeof rsid === 'string' && rsid.trim().startsWith('rs') ? rsid.trim() : null;
  const cleanBuild = (genomeBuild && typeof genomeBuild === 'string') ? genomeBuild.toLowerCase() : 'hg19';

  const parsedVcfAf = (vcfAf !== null && vcfAf !== undefined && vcfAf !== '' && !isNaN(parseFloat(vcfAf))) ? parseFloat(vcfAf) : null;
  const parsedVcfCadd = (vcfCadd !== null && vcfCadd !== undefined && vcfCadd !== '' && !isNaN(parseFloat(vcfCadd))) ? parseFloat(vcfCadd) : null;

  // Local curated datasets (coordinate-keyed; used only when they actually match)
  const clinvarMap = getLocalClinvarMap();
  const localClinvar = clinvarMap.get(`${normChrom}:${numPos}:${cleanRef}:${cleanAlt}`);
  const caddMap = getLocalCaddMap();
  const localCadd = caddMap.get(`${normChrom}:${numPos}:${cleanRef}:${cleanAlt}`);

  // Query MyVariant.info. rsID first: VCF coordinates can disagree with GRCh37 for the same rsID.
  const hgvsId = `chr${normChrom}:g.${numPos}${cleanRef}>${cleanAlt}`;
  const candidateUrls = [];

  if (cleanRsid) {
    candidateUrls.push(`https://myvariant.info/v1/variant/${encodeURIComponent(cleanRsid)}`);
    candidateUrls.push(`https://myvariant.info/v1/query?q=dbsnp.rsid:${cleanRsid}`);
  }

  if (cleanBuild === 'hg38') {
    candidateUrls.push(`https://myvariant.info/v1/variant/${encodeURIComponent(hgvsId)}?assembly=hg38`);
    candidateUrls.push(`https://myvariant.info/v1/variant/${encodeURIComponent(hgvsId)}`);
  } else {
    candidateUrls.push(`https://myvariant.info/v1/variant/${encodeURIComponent(hgvsId)}`);
    candidateUrls.push(`https://myvariant.info/v1/variant/${encodeURIComponent(hgvsId)}?assembly=hg38`);
  }

  let data = null;
  const collectedDocs = [];

  for (const url of candidateUrls) {
    try {
      const response = await axios.get(url, {
        timeout: 8000,
        headers: { Accept: 'application/json' },
        validateStatus: (status) => status < 500,
      });

      const docs = asAnnotationDocs(response.data);
      if (docs.length > 0) {
        collectedDocs.push(...docs);
      }
    } catch (_) {
      continue;
    }
  }

  if (collectedDocs.length > 0) {
    data = pickAnnotationDoc(collectedDocs, normChrom, numPos, cleanRef, cleanAlt, cleanRsid);
  }

  // Multi-doc CADD & AF aggregation across all candidate hits
  let apiCadd = extractCaddScore(data);
  if (apiCadd === null) {
    for (const doc of collectedDocs) {
      const c = extractCaddScore(doc);
      if (c !== null) {
        apiCadd = c;
        break;
      }
    }
  }

  let apiAf = extractAlleleFrequency(data, cleanAlt) ?? extractAlleleFrequency(data, cleanRef);
  if (apiAf === null) {
    for (const doc of collectedDocs) {
      const f = extractAlleleFrequency(doc, cleanAlt) ?? extractAlleleFrequency(doc, cleanRef);
      if (f !== null) {
        apiAf = f;
        break;
      }
    }
  }

  // Ensembl GRCh37 (or GRCh38) fallback for AF / CADD / gene when MyVariant is incomplete
  let ensemblData = null;
  const needEnsembl = !data || apiAf === null || apiCadd === null;
  if (needEnsembl) {
    ensemblData = await fetchEnsemblFallback(normChrom, numPos, cleanRef, cleanAlt, cleanRsid, cleanBuild);
  }

  // Resolve Allele Frequency: API → Ensembl → local → VCF. Never invent 0.
  if (apiAf === null && ensemblData?.af !== null && ensemblData?.af !== undefined) {
    apiAf = ensemblData.af;
  }

  // Check liftOver coordinates in doc.hg19 for local lookup
  const hg19Pos = data?.hg19?.start || null;
  const localClinvarByHg19 = hg19Pos ? clinvarMap.get(`${normChrom}:${hg19Pos}:${cleanRef}:${cleanAlt}`) : null;
  const localCaddByHg19 = hg19Pos ? caddMap.get(`${normChrom}:${hg19Pos}:${cleanRef}:${cleanAlt}`) : null;

  let finalAf = null;
  if (apiAf !== null) {
    finalAf = apiAf;
  } else if (localClinvar?.allele_frequency !== null && localClinvar?.allele_frequency !== undefined) {
    finalAf = localClinvar.allele_frequency;
  } else if (localClinvarByHg19?.allele_frequency !== null && localClinvarByHg19?.allele_frequency !== undefined) {
    finalAf = localClinvarByHg19.allele_frequency;
  } else if (parsedVcfAf !== null) {
    finalAf = parsedVcfAf;
  }

  // Resolve CADD: API → Ensembl → local → VCF. Never invent 0.
  if (apiCadd === null && ensemblData?.cadd !== null && ensemblData?.cadd !== undefined) {
    apiCadd = ensemblData.cadd;
  }

  let finalCadd = null;
  if (apiCadd !== null) {
    finalCadd = apiCadd;
  } else if (localCadd !== undefined && localCadd !== null) {
    finalCadd = localCadd;
  } else if (localCaddByHg19 !== undefined && localCaddByHg19 !== null) {
    finalCadd = localCaddByHg19;
  } else if (localClinvar?.cadd_score !== null && localClinvar?.cadd_score !== undefined) {
    finalCadd = localClinvar.cadd_score;
  } else if (localClinvarByHg19?.cadd_score !== null && localClinvarByHg19?.cadd_score !== undefined) {
    finalCadd = localClinvarByHg19.cadd_score;
  } else if (parsedVcfCadd !== null) {
    finalCadd = parsedVcfCadd;
  }

  // 7. Extract ClinVar status
  let clinvarStatus = null;
  if (Array.isArray(data?.clinvar?.rcv) && data.clinvar.rcv.length > 0) {
    clinvarStatus = data.clinvar.rcv[0]?.clinical_significance || null;
  } else if (data?.clinvar?.rcv?.clinical_significance) {
    clinvarStatus = data.clinvar.rcv.clinical_significance;
  } else if (data?.clinvar?.clinical_significance) {
    clinvarStatus = data.clinvar.clinical_significance;
  } else if (localClinvar?.clinvar_status) {
    clinvarStatus = localClinvar.clinvar_status;
  } else if (localClinvarByHg19?.clinvar_status) {
    clinvarStatus = localClinvarByHg19.clinvar_status;
  }
  if (!clinvarStatus) {
    for (const doc of collectedDocs) {
      const s = doc?.clinvar?.rcv?.[0]?.clinical_significance || doc?.clinvar?.rcv?.clinical_significance || doc?.clinvar?.clinical_significance;
      if (s) {
        clinvarStatus = s;
        break;
      }
    }
  }

  // 8. Extract Gene symbol
  let gene = data?.clinvar?.gene?.symbol ||
    data?.dbsnp?.gene?.symbol ||
    (Array.isArray(data?.snpeff?.ann) ? data.snpeff.ann[0]?.genename : data?.snpeff?.ann?.genename) ||
    ensemblData?.gene ||
    cleanGene ||
    null;
  if (!gene) {
    for (const doc of collectedDocs) {
      const g = doc?.clinvar?.gene?.symbol || doc?.dbsnp?.gene?.symbol || doc?.snpeff?.ann?.[0]?.genename || doc?.snpeff?.ann?.genename;
      if (g) {
        gene = g;
        break;
      }
    }
  }

  // 9. Extract Disease condition
  let disease = extractConditionsFromData(data);
  if (!disease) {
    for (const doc of collectedDocs) {
      const d = extractConditionsFromData(doc);
      if (d) {
        disease = d;
        break;
      }
    }
  }
  if (!disease && diseaseHint) {
    disease = cleanConditionString(diseaseHint);
  }
  if (!disease && gene && GENE_DISEASE_MAP[gene.toUpperCase()]) {
    disease = GENE_DISEASE_MAP[gene.toUpperCase()];
  }

  return {
    allele_frequency: finalAf,
    cadd_score: finalCadd,
    clinvar_status: clinvarStatus,
    disease,
    gene,
  };
}

/**
 * Concurrent batch feature retriever with chunked execution
 * to balance performance and avoid API rate limits.
 */
async function fetchFeaturesBatch(variants) {
  const results = [];
  const chunkSize = 5;

  for (let i = 0; i < variants.length; i += chunkSize) {
    const chunk = variants.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(v =>
      fetchFeatures(
        v.chrom,
        v.pos,
        v.ref,
        v.alt,
        v.rsid,
        v.gene,
        v.disease,
        v.vcfAf,
        v.vcfCadd,
        v.genomeBuild
      ).catch(() => {
        let fallbackDisease = v.disease ? cleanConditionString(v.disease) : null;
        const g = (v.gene || '').toUpperCase();
        if (!fallbackDisease && g && GENE_DISEASE_MAP[g]) {
          fallbackDisease = GENE_DISEASE_MAP[g];
        }
        return {
          allele_frequency: (v.vcfAf !== null && v.vcfAf !== undefined && v.vcfAf !== '' && !isNaN(parseFloat(v.vcfAf))) ? parseFloat(v.vcfAf) : null,
          cadd_score: (v.vcfCadd !== null && v.vcfCadd !== undefined && v.vcfCadd !== '' && !isNaN(parseFloat(v.vcfCadd))) ? parseFloat(v.vcfCadd) : null,
          clinvar_status: null,
          disease: fallbackDisease,
          gene: v.gene || null
        };
      })
    );
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  return results;
}

module.exports = {
  fetchFeatures,
  fetchFeaturesBatch,
  GENE_DISEASE_MAP,
  cleanConditionString,
  extractConditionsFromData,
  extractCaddScore,
  extractAlleleFrequency,
  getLocalCaddMap,
  getLocalClinvarMap,
};
