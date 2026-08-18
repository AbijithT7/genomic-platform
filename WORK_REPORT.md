# Genomic Variant Interpretation Platform — Team Handover

**Last updated:** 19 August 2026  
**Purpose:** A practical introduction for any Team Nucleo member who needs to explain, run, demo, or extend the project.

> Important: this is an educational/prototype decision-support application. The model is trained on synthetic data and its output must never be used as a standalone clinical diagnosis.

## 1. What the project does

The platform accepts a Variant Call Format (VCF) file, stores its variants, enriches selected variants with public genomic evidence, estimates pathogenicity with a machine-learning service, and presents the findings in an interactive review dashboard and downloadable PDF.

The user flow is:

1. Upload a `.vcf` file.
2. The backend parses it line by line and stores the patient/case and variants in SQLite.
3. Select **Run Variant Analysis**.
4. The backend retrieves allele frequency, CADD, and ClinVar information from MyVariant.info (with safe fallbacks), then sends numerical features to the Python ML service.
5. The ML service returns a probability, classification, and explanation. The backend persists these as evidence and updates the variant status.
6. The frontend lets the reviewer search/filter variants, inspect an evidence drawer, and export priority findings to a PDF report.

## 2. Architecture

```text
React + Vite UI (5173)
        |
        | HTTP / Axios
        v
Express API + Prisma (3001) ----> SQLite database
        |
        | MyVariant.info annotation lookup
        |
        +----> FastAPI + Random Forest ML service (8000)
```

### Why this architecture?

- **React frontend:** fast, component-based interface for a table-heavy review workflow.
- **Express API:** handles uploads, validation, database access, and service orchestration in JavaScript.
- **FastAPI ML microservice:** keeps Python/scikit-learn code separate from Node.js while exposing a simple HTTP contract.
- **REST APIs:** make frontend/backend/ML components independently testable and replaceable. They also model how real clinical systems integrate distinct services.
- **Prisma + SQLite:** Prisma gives typed, readable database access; SQLite keeps local demos simple with no external database server.

## 3. Technology stack

| Area               | Technologies                                          | Role                                                              |
| ------------------ | ----------------------------------------------------- | ----------------------------------------------------------------- |
| Frontend           | React 19, Vite, Tailwind CSS 4                        | Dashboard, responsive UI, theme support                           |
| Frontend utilities | Axios, Lucide React, jsPDF, jspdf-autotable           | API calls, icons, PDF export                                      |
| Backend            | Node.js, Express, Multer, CORS, dotenv                | REST API, VCF upload, middleware/configuration                    |
| Data layer         | Prisma ORM, SQLite                                    | Patient, variant, and evidence persistence                        |
| Annotation source  | MyVariant.info API                                    | gnomAD allele frequency, CADD score, ClinVar data where available |
| ML service         | Python, FastAPI, Uvicorn, pandas, NumPy, scikit-learn | Prediction endpoint and model serving                             |
| ML model           | RandomForestClassifier                                | Prototype pathogenicity probability from two features             |

`xgboost` appears in `ml-service/requirements.txt`, but the active prediction path uses **RandomForestClassifier**, not XGBoost.

## 4. Inputs, outputs, and data model

### Accepted input

- A standard text VCF file with `.vcf` extension.
- Required data columns used by the parser: `CHROM`, `POS`, `REF`, `ALT`; `QUAL` is optional.
- Header/comment lines beginning with `#` are ignored.
- If a record contains multiple ALT alleles, the current parser retains only the first ALT allele.
- Upload size limit: **300 MB**.

The browser currently advertises `.vcf.gz`, but the Multer backend filter accepts only `.vcf`. Treat compressed VCF support as a known improvement item, not a completed feature.

### Persisted entities

| Entity     | Key fields                                                                     | Meaning                                     |
| ---------- | ------------------------------------------------------------------------------ | ------------------------------------------- |
| `Patient`  | `id`, `filename`, `date`                                                       | One uploaded case/file                      |
| `Variant`  | `patientId`, `chrom`, `pos`, `ref`, `alt`, `qual`, `status`                    | One called genomic change                   |
| `Evidence` | `variantId`, `frequency`, `conservation_score`, `ml_score`, `disease`, `shap_explanation` | Annotation, associated condition, and model result for one variant |

Relationships: one patient has many variants; one variant has at most one evidence record. Deleting a patient cascades to its variants and evidence.

### Outputs

- Variant classification: `Benign`, `VUS`, or `Pathogenic`.
- ML score: probability-like value from `0.0` to `1.0`.
- Short feature-based explanation and optional ClinVar note.
- Associated disease/condition when returned by ClinVar context or a known demo locus.
- Interactive evidence panel.
- PDF containing a summary, priority findings (Pathogenic + VUS), and interpretation disclaimer.

## 5. Core features

### Case intake and management

- Drag/drop or browse VCF upload.
- Stream-based parsing with `fs` + `readline`, avoiding reading the entire file into memory at once.
- Bulk database insertion in chunks of 1,000 variants.
- Recent-case selector and clear-all patient history action.

### Annotation and analysis

- Normalises chromosome/allele values and creates an HGVS-like query for MyVariant.info.
- Extracts gnomAD allele frequency, CADD Phred score, and ClinVar clinical significance when returned.
- Uses concurrent lookup with a 2.5-second request timeout, so an unavailable public API does not freeze the UI.
- Includes a few known prototype/demo loci with deterministic feature values.
- Limits a single analysis run to the first **50 variants** to keep the prototype responsive.
- Sends feature batches to `POST /predict` rather than calling the ML service once per variant.
- Validates the ML classification contract and falls back safely to `VUS` when an unexpected label is received.

### Review interface

- Light/dark themes and a custom clinical-genomics visual system.
- Table sorting that prioritises pathogenic variants, status filters, and search by coordinate, allele, status, or available gene text.
- Evidence drawer with score, population frequency, CADD, ClinVar context, and explanation.
- Custom 404 screen, metadata, and a clear empty state.
- Organised client-side PDF export.

## 6. Basic biology and genomics vocabulary

| Term                         | Team-friendly meaning                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DNA                          | The molecule carrying genetic instructions; it is made of bases A, C, G, and T.                                                                                                             |
| Gene                         | A DNA region that contributes to a functional product, usually a protein.                                                                                                                   |
| Genome                       | The complete set of genetic material.                                                                                                                                                       |
| Chromosome                   | A packaged DNA structure; humans normally have 23 pairs.                                                                                                                                    |
| Variant                      | A difference in DNA sequence relative to a reference genome. It is not automatically harmful.                                                                                               |
| Reference / alternate allele | The expected base(s) at a genomic location / the observed changed base(s). Example: `G → A`.                                                                                                |
| VCF                          | Standard tabular text format for storing called variants and metadata.                                                                                                                      |
| Allele frequency (AF)        | Proportion of people in a population carrying an allele. Very common variants are less likely to explain rare, highly penetrant disorders.                                                  |
| gnomAD                       | A population genetics resource often used to assess how common a variant is.                                                                                                                |
| CADD Phred score             | A computational score intended to rank predicted deleteriousness. Higher values generally indicate more concerning variants, but it is not diagnostic by itself.                            |
| ClinVar                      | Public archive of variant interpretations and supporting clinical assertions. Assertions can conflict or change.                                                                            |
| Pathogenic                   | Evidence supports disease causation for a stated condition/context.                                                                                                                         |
| Benign                       | Evidence supports a non-disease-causing interpretation.                                                                                                                                     |
| VUS                          | Variant of uncertain significance; there is not enough or not sufficiently consistent evidence to call it benign or pathogenic.                                                             |
| SHAP                         | A method normally used to explain model feature contribution. In this prototype, the returned text is a rule-based, feature-oriented explanation rather than a full SHAP-value computation. |

## 7. Model behaviour

The training script creates **10,000 synthetic records** using two features:

- `allele_frequency`, sampled log-uniformly from `1e-6` to `0.5`
- `cadd_score`, sampled from `0` to `40`

A biological-inspired logistic formula creates synthetic labels. A Random Forest with 150 trees and maximum depth 8 is trained, then serialized to `ml-service/model.pkl`.

The serving service converts model probability to labels:

|        Score | Label      |
| -----------: | ---------- |
|     `< 0.20` | Benign     |
| `0.20–<0.80` | VUS        |
|     `≥ 0.80` | Pathogenic |

These thresholds are a prototype design choice. In real clinical use, they require validation on labelled clinical data, calibration, and governance.

## 8. Important API endpoints

| Method   | Endpoint                           | Used for                                   |
| -------- | ---------------------------------- | ------------------------------------------ |
| `GET`    | `/api/health`                      | Backend/database health check              |
| `POST`   | `/api/upload`                      | Multipart VCF upload and parsing           |
| `POST`   | `/api/analyze/:patientId`          | Run annotation + ML pipeline               |
| `GET`    | `/api/patients`                    | List uploaded cases with variants/evidence |
| `GET`    | `/api/patients/:id`                | Load one case                              |
| `DELETE` | `/api/patients`                    | Clear all local data                       |
| `GET`    | `/api/variants`                    | Variant retrieval/filtering                |
| `GET`    | `/api/evidence/variant/:variantId` | Evidence drawer data                       |
| `GET`    | `http://127.0.0.1:8000/health`     | ML service health                          |
| `POST`   | `http://127.0.0.1:8000/predict`    | Batch feature prediction                   |

## 9. How to run locally

1. **ML service**
   ```bash
   cd ml-service
   pip install -r requirements.txt
   python -m uvicorn main:app --port 8000 --reload
   ```
2. **Backend**
   ```bash
   cd backend
   npm install
   npx prisma db push
   npm run dev
   ```
3. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Open the frontend URL shown by Vite (normally `http://localhost:5173`).

Health check URLs:

- `http://localhost:3001/api/health`
- `http://127.0.0.1:8000/health`

## 10. Key files to know

| File                                             | Responsibility                                |
| ------------------------------------------------ | --------------------------------------------- |
| `frontend/src/App.jsx`                           | Screen state, upload/analysis actions, layout |
| `frontend/src/components/VariantTable.jsx`       | Search, filters, sorting, row selection       |
| `frontend/src/components/EvidenceDrawer.jsx`     | Detailed evidence display                     |
| `frontend/src/components/ExportReportButton.jsx` | PDF layout and download                       |
| `backend/routes/upload.js`                       | Upload validation, parsing, storage           |
| `backend/services/vcfParser.js`                  | Line-by-line VCF parser                       |
| `backend/services/annotationService.js`          | MyVariant.info lookup and feature extraction  |
| `backend/services/pipelineService.js`            | Annotation-to-ML-to-database orchestration    |
| `backend/prisma/schema.prisma`                   | Database schema                               |
| `ml-service/main.py`                             | FastAPI prediction service                    |
| `ml-service/train_model.py`                      | Synthetic-data model training                 |

## 11. Known limitations and responsible-use notes

- Synthetic training data means reported evaluation metrics do **not** demonstrate clinical performance.
- Only two ML features are used; real interpretation uses phenotype, inheritance, segregation, transcript consequences, coverage/quality, literature, and expert review.
- MyVariant.info can be incomplete, rate-limited, or unavailable. The current fallback produces zero-valued features, which must not be over-interpreted.
- The pipeline processes only the first 50 variants of a patient in this prototype.
- Multi-allelic VCF records keep only the first ALT value.
- This implementation is not designed for protected health information, authentication, audit trails, or clinical compliance.

## 12. Recommended next work

1. Add genuine `.vcf.gz` decompression or remove the frontend acceptance claim.
2. Replace synthetic data with consented, curated, labelled data and perform external validation/calibration.
3. Include more biologically relevant features and real explainability values.
4. Process all variants through a queued/background job with progress reporting.
5. Add authentication, access control, encrypted storage, audit logs, and deployment configuration before handling real patient data.
6. Add tests for malformed VCF files, annotation timeouts, ML contract failures, PDF export, and end-to-end analysis.
