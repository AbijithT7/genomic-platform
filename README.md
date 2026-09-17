# GENOMIX — Genomic Intelligence & Variant Interpretation Platform

An end-to-end clinical genomics platform for automated genomic variant interpretation. GENOMIX combines stream-based VCF ingestion, multi-tiered clinical annotation (MyVariant.info, Ensembl, and ClinVar), a Random Forest ML pathogenicity classifier trained on real ClinVar data with feature explanations, curated gene-disease mappings, and a scientific bioinformatics web dashboard with publication-ready clinical PDF report export.

---

## Table of Contents

- [Authors & Contributors](#authors--contributors)
- [System Architecture](#system-architecture)
- [Primary Clinical Workflow](#primary-clinical-workflow)
- [Key Features](#key-features)
- [Machine Learning & Decision Boundaries](#machine-learning--decision-boundaries)
- [User Interface & Workspace Navigation](#user-interface--workspace-navigation)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Database Models](#database-models)
- [API Reference](#api-reference)
- [Sample Testing VCF](#sample-testing-vcf)

---

## Authors & Contributors

Developed by students from **Vellore Institute of Technology (VIT), Chennai**:

| Name | Role / Focus | Institution |
| :--- | :--- | :--- |
| **Abijith Thennarasu** | Fullstack Architecture, ML Microservice & Pipeline | Vellore Institute of Technology (VIT), Chennai |
| **Alvin Binoy** | Bioinformatics Pipeline & Data Engineering | Vellore Institute of Technology (VIT), Chennai |
| **Caleb Kurian George** | Clinical Annotation & Frontend Systems | Vellore Institute of Technology (VIT), Chennai |

---

## System Architecture

```
[ React + Vite Client (Port 5173) ]
   │
   ├── 1. POST /api/upload (VCF Stream Ingestion) ──────────────────> [ Node.js Express Server (Port 3001) ]
   │                                                                     ├── Line-by-line stream parser (services/vcfParser.js)
   │                                                                     ├── Extracts genome build (hg19/GRCh37 vs hg38/GRCh38)
   │                                                                     ├── Extracts rsIDs, REF/ALT, INFO tags (GENE, CLNDN, AF, CADD)
   │                                                                     ├── Creates Patient record & bulk-inserts Variants (status: pending)
   │                                                                     └── Returns { patientId, filename, totalVariants, patient }
   │
   ├── 2. POST /api/analyze/:patientId (Clinical Annotation & ML) ──> [ Node.js Express Server (Port 3001) ]
   │                                                                     ├── Multi-tiered feature annotation (services/annotationService.js):
   │                                                                     │     1. MyVariant.info queries across hg19 & hg38
   │                                                                     │     2. Ensembl REST API fallback (grch37 / rest.ensembl.org)
   │                                                                     │     3. Local ClinVar & CADD cached datasets
   │                                                                     │     4. Direct VCF INFO tag fallback (AF, CADD, GENE, CLNSIG)
   │                                                                     ├── Non-Imputation Data Policy:
   │                                                                     │     • No false zero-fill defaults for AF or CADD
   │                                                                     │     • Missing features classified transparently as VUS
   │                                                                     ├── Batches numerical features to Python FastAPI Service:
   │                                                                     │     └── POST /predict (Port 8000) -> { ml_score, classification, shap_explanation }
   │                                                                     ├── Upserts Evidence in SQLite with nullable features & explanations
   │                                                                     └── Classifies Variant status (Pathogenic, Benign, VUS)
   │
   └── 3. Scientific Workspace & Reporting
         ├── Ingest VCF Hero with drag-and-drop & demo files
         ├── Cohort summary metrics cards & classification distribution bar
         ├── High-density Variant Analysis Table with real-time multi-field search
         ├── Slide-out Variant Inspector with biological metrics & model narrative
         ├── Dedicated "How It Works" educational walkthrough
         └── Publication-ready Clinical PDF Review Report generation
```

---

## Primary Clinical Workflow

GENOMIX is structured around the natural clinical genomics workflow:

$$\text{Upload VCF} \longrightarrow \text{Run Analysis} \longrightarrow \text{Review Cohort} \longrightarrow \text{Inspect Variant} \longrightarrow \text{Export PDF}$$

1. **Upload VCF**: Ingest a standard `.vcf` or compressed `.vcf.gz` file at the top of the workspace.
2. **Run Analysis**: Streamline variants through multi-source clinical annotation and the Random Forest classifier.
3. **Review Cohort**: Inspect summary statistics (Total, Pathogenic, VUS, Benign) and risk distribution boundaries.
4. **Inspect Variant**: Click any variant in the table to open the slide-out inspector detailing population frequency, CADD deleteriousness, ClinVar consensus, and feature explanations.
5. **Export PDF**: Generate a structured, print-ready clinical summary report with priority findings.

---

## Key Features

- **Stream-Based VCF Ingestion** — Memory-safe line-by-line parser (`services/vcfParser.js`) supporting standard VCF v4.2+, rsIDs, genotype columns, and INFO tags (`GENE`, `CLNDN`, `CLNSIG`, `AF`, `CADD`).
- **Dynamic Genome Assembly Awareness** — Automatically extracts reference assembly headers (`hg19`, `GRCh37`, `hg38`, `GRCh38`) and routes queries to the corresponding genomic coordinate space.
- **Multi-Tiered Annotation Pipeline** — Automated resolution cascading through MyVariant.info, Ensembl REST APIs, local ClinVar & CADD lookup maps, and embedded VCF tags.
- **Supervised Random Forest Classifier** — Trained on curated ClinVar-labelled variants with continuous CADD PHRED scores and population allele frequencies.
- **Strict Non-Imputation Policy** — Missing annotations are never assigned synthetic `0.0` values. If a feature cannot be resolved, the variant is flagged as VUS with an explicit audit narrative.
- **Feature-Based Model Narrative** — Plain-language explanations detailing how allele rarity and conservation scores influenced the classification.
- **Curated Gene-Disease Knowledge Base** — Mappings for actionable and ACMG genes (*BRAF*, *BRCA1*, *BRCA2*, *TP53*, *KRAS*, *EGFR*, *PIK3CA*, *HFE*, *CFTR*, *MTHFR*).
- **Working Real-Time Search** — Instant filtering across chromosome, coordinate position, REF, ALT, gene symbol, rsID, condition/phenotype, and classification status.
- **High-Contrast Dark & Light Modes** — Accessible, readable contrast in both themes, featuring a subtle 3D molecular background texture and custom gene favicon.
- **Clinical Review Report Export** — Vector PDF export with case metadata, priority findings, and clinical bioinformatics notes.

---

## Machine Learning & Decision Boundaries

### Model Architecture
- **Algorithm**: Supervised Random Forest Classifier (`RandomForestClassifier`)
- **Microservice**: Python FastAPI service on port `8000`
- **Trained Features**: Strictly evaluated on two biological features:
  1. `allele_frequency`: Population frequency from gnomAD and 1000 Genomes ($0.0 \le \text{AF} \le 1.0$).
  2. `cadd_score`: Combined Annotation Dependent Depletion PHRED score ($0.0 \le \text{CADD} \le 100.0$).

### Standardized Decision Boundaries

| Score Range | Classification | Clinical Interpretation | Action / Next Step |
| :--- | :--- | :--- | :--- |
| **$\text{Score} \ge 0.80$** | **Pathogenic** | High probability of disease causation / deleteriousness | Priority clinical review; molecular validation |
| **$0.20 \le \text{Score} < 0.80$** | **VUS** | Variant of Uncertain Significance | Review family history, functional assays, or literature |
| **$\text{Score} < 0.20$** | **Benign** | Low predicted deleteriousness; tolerated polymorphism | Neutral classification |

---

## User Interface & Workspace Navigation

### Sidebar Organization

- **WORKSPACE**
  - `Overview` — Cohort interpretation summary, statistics cards, and risk distribution bar.
  - `Analyze VCF` — Landing hero with drag-and-drop file ingestion, file selector, and sample VCF download.
  - `Variants` — High-density Variant Analysis Table with live filtering and row inspection.
- **OUTPUT**
  - `Reports` — Formatted clinical PDF report generator with priority findings.
- **SYSTEM**
  - `How It Works` — Plain-English guide explaining VCF files, automated annotations, ML thresholds, and workflow steps.
  - `Settings` — Theme switcher (Dark/Light mode), service connectivity status, and database reset.
- **STATUS & CASE SUMMARY**
  - `Active Analysis Card` — Displays uploaded filename, variant count, genome build, and live status (`Analyzed`, `Ready`, or `Idle`).
  - `System Status` — Live operational indicators for `● API` (`:3001`) and `● ML` (`:8000`).

---

## Quick Start

You will need three terminals to run the platform locally:

### 1. Python ML Service (Port 8000)

```bash
cd ml-service
pip install -r requirements.txt

# Start the FastAPI server
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Health check verification:
```bash
curl http://localhost:8000/health
# Returns: {"status":"healthy","model":"RandomForestClassifier","features":["allele_frequency","cadd_score"],"dataset":"ClinVar"}
```

### 2. Node.js Express Backend (Port 3001)

```bash
cd backend
npm install
npx prisma db push
npm run dev
```

Backend health check:
```bash
curl http://localhost:3001/api/patients
```

### 3. React Frontend (Port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open **`http://localhost:5173`** in your browser.

---

## Project Structure

```
genomic_platform/
├── backend/                       # Node.js + Express API server
│   ├── prisma/                    # Prisma SQLite schema & migrations
│   │   └── schema.prisma          # Patient, Variant, Evidence models
│   ├── routes/                    # API route controllers
│   │   └── upload.js              # Multi-part VCF upload & ingestion
│   ├── services/                  # Core pipeline services
│   │   ├── annotationService.js   # MyVariant.info, Ensembl & ClinVar resolution
│   │   ├── pipelineService.js     # ML orchestration & SQLite upserts
│   │   └── vcfParser.js           # Line-by-line stream VCF parser
│   ├── server.js                  # Express application entry point
│   └── test-pipeline.js           # Integration test suite
│
├── frontend/                      # React + Vite client application
│   ├── public/                    # Static assets
│   │   ├── favicon.svg            # Custom DNA helix tab icon
│   │   └── dna-helix.png          # Low-opacity 3D molecular background
│   └── src/
│       ├── components/            # UI components
│       │   ├── EvidenceDrawer.jsx # Slide-out variant evidence inspector
│       │   ├── ExportReportButton.jsx # Vector PDF report generator
│       │   ├── FileUpload.jsx     # Hero VCF ingestion component
│       │   ├── NotFoundPage.jsx   # Fallback 404 handler
│       │   └── VariantTable.jsx   # Multi-field searchable variant grid
│       ├── lib/                   # API clients & utilities
│       │   └── api.js             # Axios client for backend endpoints
│       ├── App.jsx                # Main application layout & state
│       ├── index.css              # Design system & accessible themes
│       └── main.jsx               # React DOM mount point
│
├── ml-service/                    # Python FastAPI machine learning microservice
│   ├── data/                      # Training datasets & CADD caches
│   │   ├── model_training_data.csv# Curated ClinVar training dataset
│   │   └── cadd_results.tsv.gz    # Compressed CADD PHRED lookup cache
│   ├── main.py                    # FastAPI application & /predict endpoint
│   ├── train_model.py             # RandomForest training script
│   ├── requirements.txt           # Python dependencies (uvicorn, fastapi, scikit-learn, pandas)
│   └── model.pkl                  # Serialized RandomForest model artifact
│
├── sample_patient.vcf             # Verified test VCF with 10 clinical profiles
├── heavy_pathogenic.vcf           # High-risk cancer profile test VCF
├── mixed_profile.vcf              # Mixed clinical profile test VCF
├── patient.vcf                    # Standard patient test VCF
└── README.md                      # Platform documentation
```

---

## Database Models

Managed via Prisma (`backend/prisma/schema.prisma`):

```prisma
model Patient {
  id        String    @id @default(uuid())
  filename  String
  date      DateTime  @default(now())
  variants  Variant[]
}

model Variant {
  id          String    @id @default(uuid())
  patientId   String
  chrom       String
  pos         Int
  ref         String
  alt         String
  qual        Float?
  rsid        String?
  gene        String?
  genomeBuild String    @default("hg19")
  status      String    @default("pending")
  patient     Patient   @relation(fields: [patientId], references: [id], onDelete: Cascade)
  evidence    Evidence?
}

model Evidence {
  id                 String   @id @default(uuid())
  variantId          String   @unique
  frequency          Float?
  conservation_score Float?
  ml_score           Float?
  clinvar_status     String?
  disease            String?
  shap_explanation   String?
  variant            Variant  @relation(fields: [variantId], references: [id], onDelete: Cascade)
}
```

---

## API Reference

### Express API — `http://localhost:3001`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Backend and SQLite connectivity check |
| `POST` | `/api/upload` | Multipart `.vcf` upload, assembly detection, and stream ingestion |
| `POST` | `/api/analyze/:patientId` | Triggers annotation and ML prediction pipeline for cohort |
| `GET` | `/api/patients` | List all patient records with nested variants and evidence |
| `GET` | `/api/patients/:id` | Retrieve single patient record by UUID |
| `DELETE` | `/api/patients/:id` | Delete patient record (cascades to variants & evidence) |
| `DELETE` | `/api/patients` | Reset / clear all patient history in database |
| `GET` | `/api/variants` | Query variants with filters (`?patientId=`, `?chrom=`, `?status=`) |
| `GET` | `/api/evidence/variant/:variantId` | Fetch evidence and feature explanations for a variant |

### Python ML Service — `http://localhost:8000`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health, model type, and feature schema verification |
| `GET` | `/model-info` | Metadata on trained model, dataset size, and input features |
| `POST` | `/predict` | Batch prediction endpoint: accepts `[{ allele_frequency, cadd_score }]` and returns `[{ ml_score, classification, shap_explanation }]` |

---

## Sample Testing VCF

The repository includes a curated sample file [`sample_patient.vcf`](file:///C:/Users/abijith/Desktop/genomic_platform/sample_patient.vcf) containing 10 diverse variants spanning high-risk oncogenes, recessive carrier status, and common benign polymorphisms:

| Variant Coordinate | Gene | Associated Clinical Condition | ClinVar Assertion | Expected Status |
| :--- | :--- | :--- | :--- | :--- |
| `chr7:140453136 A>T` | *BRAF* | Colorectal Carcinoma / Melanoma | Pathogenic | **Pathogenic** (Score: ~0.999) |
| `chr17:41276045 C>T` | *BRCA1* | Hereditary Breast & Ovarian Cancer | Pathogenic | **Pathogenic** (Score: ~1.000) |
| `chr17:7577120 C>T` | *TP53* | Li-Fraumeni Syndrome | Pathogenic | **Pathogenic** (Score: ~0.995) |
| `chr12:25398284 C>T` | *KRAS* | Pancreatic & Colorectal Carcinoma | Pathogenic | **Pathogenic** (Score: ~0.998) |
| `chr7:117199644 ATCT>A` | *CFTR* | Cystic Fibrosis | Pathogenic | **VUS** (Score: ~0.554) |
| `chr1:11856378 G>A` | *MTHFR* | Hyperhomocysteinemia | Benign | **Benign** (Score: ~0.000) |
| `chr6:26093141 G>A` | *HFE* | Hereditary Hemochromatosis | Benign | **Benign** (Score: ~0.007) |
| `chr2:136608646 G>A` | *MCM6* | Lactase Persistence | Benign | **Benign** (Score: ~0.000) |
| `chr22:19951271 G>A` | *COMT* | Pain Sensitivity Modulation | Benign | **Benign** (Score: ~0.000) |
| `chr11:66560624 C>T` | *ACTN3* | Athletic Performance Polymorphism | Benign | **Benign** (Score: ~0.000) |

### Testing in 3 Steps:
1. Drag and drop `sample_patient.vcf` into the **Analyze a VCF** hero box (or click **Download sample VCF** in the web interface).
2. Click **Run Analysis** to execute automated annotation and ML classification.
3. Review the results in the **Variant Analysis Table**, click any row to open the **Variant Inspector**, and click **Export PDF Report** for a formatted clinical review document.

