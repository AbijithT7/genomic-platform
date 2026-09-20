# GENOMIX - Genomic Intelligence & Variant Interpretation Platform

An end-to-end clinical genomics platform for automated genomic variant interpretation. GENOMIX combines stream-based VCF ingestion, multi-tiered clinical annotation (MyVariant.info, Ensembl, and ClinVar), a Random Forest ML pathogenicity classifier trained on real ClinVar data with feature explanations, curated gene-disease mappings, and a scientific bioinformatics web dashboard with publication-ready clinical PDF report export.

---

## Table of Contents

- [Authors & Contributors](#authors--contributors)
- [System Architecture](#system-architecture)
- [Live Deployment](#live-deployment)
- [Primary Clinical Workflow](#primary-clinical-workflow)
- [Key Features](#key-features)
- [Machine Learning & Decision Boundaries](#machine-learning--decision-boundaries)
- [User Interface & Workspace Navigation](#user-interface--workspace-navigation)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
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
| **Caleb Kurian George** | Clinical Annotation, Frontend Systems and Live Hosting | Vellore Institute of Technology (VIT), Chennai |

---

## System Architecture

GENOMIX is deployed as a three-service application:

```text
              ┌──────────────────────────────────────┐
              │                Vercel                │
              │        React + Vite Frontend         │
              │          Public web dashboard        │
              └──────────────────┬───────────────────┘
                                 │
                           HTTPS REST API
                                 │
                                 ▼
              ┌──────────────────────────────────────┐
              │                Render                │
              │       Node.js + Express Backend      │
              │       VCF ingestion and pipeline     │
              └──────────────────┬───────────────────┘
                                 │
                            HTTPS /predict
                                 │
                                 ▼
              ┌───────────────────────────────────────┐
              │                Render                 │
              │        Python FastAPI ML Service      │
              │         Random Forest predictions     │
              └──────────────────┬────────────────────┘
                                 │
                          Database queries
                                 │
                                 ▼
              ┌──────────────────────────────────────┐
              │               Supabase               │
              │        Managed PostgreSQL Database   │
              │              Prisma ORM              │
              └──────────────────────────────────────┘
                        
```

### Request Flow

1. **VCF Upload**: The Vercel-hosted frontend sends a multipart request to the Render-hosted Express backend.
2. **VCF Ingestion**: The backend parses the VCF file, detects the genome build, extracts variant information, and stores patient and variant records in Supabase PostgreSQL through Prisma.
3. **Clinical Annotation**: The backend retrieves annotation data from MyVariant.info and Ensembl, with local ClinVar/CADD and VCF INFO fallbacks.
4. **Machine Learning**: The backend sends numerical features to the Render-hosted FastAPI service through `POST /predict`.
5. **Persistence**: ML predictions and evidence are written back to Supabase.
6. **Review and Reporting**: The frontend retrieves the processed results and provides filtering, variant inspection, and PDF report export.

---

## Live Deployment

| Component | Hosting Provider |
| :--- | :--- |
| Frontend | Vercel | 
| Backend API | Render |
| ML Service | Render | 
| Database | Supabase | 

> **Note:** The frontend's ML status indicator checks the deployed ML health endpoint from the user's browser. Browser privacy tools, ad blockers, or extensions may block this request and cause the interface to display `Offline` even when the ML service itself is operational.

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

- **Stream-Based VCF Ingestion**: Memory-safe line-by-line parser (`services/vcfParser.js`) supporting standard VCF v4.2+, rsIDs, genotype columns, and INFO tags (`GENE`, `CLNDN`, `CLNSIG`, `AF`, `CADD`).
- **Dynamic Genome Assembly Awareness**: Automatically extracts reference assembly headers (`hg19`, `GRCh37`, `hg38`, `GRCh38`) and routes queries to the corresponding genomic coordinate space.
- **Multi-Tiered Annotation Pipeline**: Automated resolution cascading through MyVariant.info, Ensembl REST APIs, local ClinVar & CADD lookup maps, and embedded VCF tags.
- **Supervised Random Forest Classifier**: Trained on curated ClinVar-labelled variants with continuous CADD PHRED scores and population allele frequencies.
- **Strict Non-Imputation Policy**: Missing annotations are never assigned synthetic `0.0` values. If a feature cannot be resolved, the variant is flagged as VUS with an explicit audit narrative.
- **Feature-Based Model Narrative**: Plain-language explanations detailing how allele rarity and conservation scores influenced the classification.
- **Curated Gene-Disease Knowledge Base**: Mappings for actionable and ACMG genes (*BRAF*, *BRCA1*, *BRCA2*, *TP53*, *KRAS*, *EGFR*, *PIK3CA*, *HFE*, *CFTR*, *MTHFR*).
- **Working Real-Time Search**: Instant filtering across chromosome, coordinate position, REF, ALT, gene symbol, rsID, condition/phenotype, and classification status.
- **High-Contrast Dark & Light Modes**: Accessible, readable contrast in both themes, featuring a subtle 3D molecular background texture and custom gene favicon.
- **Clinical Review Report Export**: Vector PDF export with case metadata, priority findings, and clinical bioinformatics notes.

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

You will need three terminals to run the platform **locally**:

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

## Environment Variables

### Frontend

For the deployed frontend, the backend API URL is configured in Vercel:

```env
VITE_API_URL=https://genomix-backend.onrender.com/api
```

The frontend currently checks the deployed ML service using:

```text
https://genomix-ml-service.onrender.com/health
```

If the ML URL is later moved back to configuration, use the Vite-exposed variable name:

```env
VITE_ML_SERVICE_URL=https://genomix-ml-service.onrender.com
```

> Vite variables must begin with `VITE_` to be available in browser-side code. After changing a Vercel environment variable, trigger a new deployment because the value is embedded at build time.

### Backend

The Render backend should contain the ML service URL and the Supabase PostgreSQL connection string:

```env
ML_SERVICE_URL=https://genomix-ml-service.onrender.com
DATABASE_URL=<your Supabase pooled or direct PostgreSQL connection string>
DIRECT_URL=<your Supabase direct PostgreSQL connection string, if required by Prisma>
```

Do not commit `.env` files, database passwords, API keys, or other secrets to the repository.

---

## Deployment

### Frontend — Vercel

1. Import the repository into Vercel.
2. Set the frontend root directory to `frontend` if the repository is configured as a monorepo.
3. Configure the required Vite environment variables.
4. Build the frontend using the project's Vite build command.
5. Deploy and verify that the frontend calls the Render backend rather than `localhost`.

### Backend — Render

1. Create a Render Web Service for the `backend` directory.
2. Install dependencies with `npm install`.
3. Run Prisma generation and database setup as required by the deployment configuration.
4. Start the Express server using the production start command.
5. Add `ML_SERVICE_URL` and the Supabase database variables in Render's environment settings.
6. Verify the backend health endpoint.

### ML Service — Render

1. Create a Render Web Service for the `ml-service` directory.
2. Install Python dependencies from `requirements.txt`.
3. Start FastAPI with Uvicorn, binding to `0.0.0.0` and Render's provided `$PORT`.
4. Confirm that `model.pkl` is available in the deployed service.
5. Verify `/health`, `/model-info`, and `/docs`.
6. Confirm that the backend can reach the ML service through `ML_SERVICE_URL`.

### Database — Supabase

1. Create a PostgreSQL project in Supabase.
2. Copy the appropriate connection string into the backend's Render environment variables.
3. Run Prisma database synchronization or migrations from the backend project.
4. Confirm that patient, variant, and evidence records persist after deployment.

## Project Structure

```
genomic_platform/
├── backend/                       # Node.js + Express API server
│   ├── prisma/                    # Prisma schema and database configuration
│   │   ├── schema.prisma          # Patient, Variant, Evidence relational models
│   │   └── seed.js                # Database seeding script
│   ├── routes/                    # API route controllers
│   │   └── upload.js              # Multi-part VCF upload, validation & ingestion
│   ├── services/                  # Core bioinformatics & pipeline services
│   │   ├── annotationService.js   # Multi-tier annotation (MyVariant, Ensembl, local ClinVar/CADD)
│   │   ├── pipelineService.js     # Orchestration, ML batching & SQLite upserts
│   │   └── vcfParser.js           # Line-by-line stream VCF parser
│   ├── test_data/                 # Backend test datasets
│   │   ├── sample.vcf             # Minimal 6-variant pipeline test file
│   │   └── SIH_Live_Demo.vcf      # 10-variant live hackathon presentation dataset
│   ├── uploads/                   # Staged upload directory (.gitkeep)
│   ├── server.js                  # Express application entry point
│   ├── test-db.js                 # Prisma database verification script
│   ├── test-pipeline.js           # End-to-end annotation & ML test script
│   └── test-upload.js             # Multipart upload verification script
│
├── frontend/                      # React 19 + Vite client dashboard
│   ├── public/                    # Static assets
│   │   ├── favicon.svg            # Custom DNA double-helix SVG favicon
│   │   └── dna-helix.png          # High-resolution molecular background asset
│   └── src/
│       ├── components/            # UI components
│       │   ├── EvidenceDrawer.jsx # Slide-out clinical variant evidence inspector
│       │   ├── ExportReportButton.jsx # Vector PDF clinical report generator
│       │   ├── FileUpload.jsx     # Drag-and-drop VCF ingestion hero & sample downloader
│       │   ├── NotFoundPage.jsx   # Clinical 404 fallback page
│       │   └── VariantTable.jsx   # High-density multi-field searchable variant table
│       ├── lib/                   # API clients & utility functions
│       │   ├── api.js             # Axios client for backend endpoints
│       │   └── utils.js           # Formatting and styling helper utilities
│       ├── App.jsx                # Root application layout, navigation & state
│       ├── index.css              # Design system styling & high-contrast themes
│       └── main.jsx               # React DOM application mount point
│
├── ml-service/                    # Python FastAPI machine learning microservice
│   ├── data/                      # Training datasets & CADD PHRED lookup caches
│   │   ├── model_training_data.csv# Curated ClinVar training dataset
│   │   └── cadd_results.tsv.gz    # Compressed CADD PHRED score cache
│   ├── clean_training_data.py     # Final training dataset cleaning & balancing
│   ├── evaluate.py                # Model evaluation (ROC-AUC, PR-AUC, metrics)
│   ├── main.py                    # FastAPI application & /predict endpoint
│   ├── make_cadd_input.py         # CADD batch coordinate input generator
│   ├── make_training_subset.py    # Stratified ClinVar training subset builder
│   ├── merge_dataset.py           # Feature merger combining ClinVar & CADD scores
│   ├── model.pkl                  # Serialized RandomForest model artifact
│   ├── prepare_dataset.py         # ClinVar raw VCF parser & label extractor
│   ├── requirements.txt           # Python dependencies (fastapi, uvicorn, scikit-learn, pandas)
│   ├── test_predict.py            # ML microservice unit test script
│   └── train_model.py             # RandomForest model training & serialization
│
├── scripts/                       # Utility & presentation scripts
│   └── generate_sih_demo.js       # Generates SIH_Live_Demo.vcf for presentations
│
├── sample_patient.vcf             # Primary curated test VCF (10 balanced clinical profiles)
├── heavy_pathogenic.vcf           # High-risk oncology profile test VCF (5 pathogenic + 1 benign)
├── mixed_profile.vcf              # Mixed clinical profile test VCF (2 pathogenic + 4 benign)
├── LICENSE                        # Project license
└── README.md                      # Comprehensive platform documentation
```

---

## Database Models

Managed through Prisma (`backend/prisma/schema.prisma`) and hosted in Supabase PostgreSQL:

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

### Express API — Local: `http://localhost:3001`  |  Production: `https://genomix-backend.onrender.com`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Backend and PostgreSQL connectivity check |
| `POST` | `/api/upload` | Multipart `.vcf` upload, assembly detection, and stream ingestion |
| `POST` | `/api/analyze/:patientId` | Triggers annotation and ML prediction pipeline for cohort |
| `GET` | `/api/patients` | List all patient records with nested variants and evidence |
| `GET` | `/api/patients/:id` | Retrieve single patient record by UUID |
| `DELETE` | `/api/patients/:id` | Delete patient record (cascades to variants & evidence) |
| `DELETE` | `/api/patients` | Reset / clear all patient history in database |
| `GET` | `/api/variants` | Query variants with filters (`?patientId=`, `?chrom=`, `?status=`) |
| `GET` | `/api/evidence/variant/:variantId` | Fetch evidence and feature explanations for a variant |

### Python ML Service — Local: `http://localhost:8000`  |  Production: `https://genomix-ml-service.onrender.com`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health, model type, and feature schema verification |
| `GET` | `/model-info` | Metadata on trained model, dataset size, and input features |
| `POST` | `/predict` | Batch prediction: accepts `[{ allele_frequency, cadd_score }]` and returns predictions |

---

## Sample Testing VCFs

The repository includes curated, production-grade test VCF files designed to validate clinical classification accuracy across oncology, rare disease, carrier status, and benign polymorphisms:

### 1. Primary Test Profile — [`sample_patient.vcf`](./sample_patient.vcf)
A comprehensive 10-variant profile covering actionable oncogenes, cystic fibrosis carrier status, and diverse benign polymorphisms:

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

### 2. Specialized Profiles
- **[`heavy_pathogenic.vcf`](./heavy_pathogenic.vcf)** — High-risk cancer profile containing 5 high-penetrance oncogenic variants (*BRAF*, *KRAS*, *TP53*, *BRCA1*, *PIK3CA*) and 1 benign control.
- **[`mixed_profile.vcf`](./mixed_profile.vcf)** — Mixed clinical profile containing 2 pathogenic variants (*BRAF*, *CFTR*) and 4 benign polymorphisms (*COMT*, *ACTN3*, *MCM6*, *MTHFR*).
- **[`backend/test_data/SIH_Live_Demo.vcf`](./backend/test_data/SIH_Live_Demo.vcf)** — Curated dataset generated for live hackathon presentations and clinical demonstrations.

### Testing in 3 Steps:
1. Drag and drop [`sample_patient.vcf`](./sample_patient.vcf) into the **Analyze a VCF** hero box (or click **Download sample VCF** in the web interface).
2. Click **Run Analysis** to execute automated annotation and ML classification.
3. Review results in the **Variant Analysis Table**, click any row to open the **Variant Inspector**, and click **Export PDF Report** for a formatted clinical review document.

