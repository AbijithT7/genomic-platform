# Genomic Variant Interpretation Platform

An end-to-end fullstack platform for genomic variant interpretation, combining stream-based VCF ingestion, MyVariant.info annotations, Random Forest ML pathogenicity predictions, and an editorial dark mode React dashboard.

---

## 🏗️ System Architecture

```
[React Vite Frontend (Port 5173)]
   │
   ├── 1. POST /api/upload (VCF drag-and-drop) ───> [Node.js Express Server (Port 3001)]
   │                                                 ├── Stream-parses VCF line-by-line (services/vcfParser.js)
   │                                                 ├── Creates Patient record & bulk-inserts Variants into SQLite
   │                                                 └── Returns { patientId, filename, totalVariants, patient }
   │
   ├── 2. POST /api/analyze/:patientId ──────────> [Node.js Express Server (Port 3001)]
   │                                                 ├── Queries MyVariant.info for gnomAD AF, CADD, ClinVar
   │                                                 ├── Batches features to Python ML Service
   │                                                 │     └── POST /predict (Port 8000) -> { ml_score, shap_explanation }
   │                                                 ├── Upserts Evidence records in SQLite
   │                                                 └── Classifies Variant status (Pathogenic, Benign, VUS)
   │
   └── 3. Interactive Variant Table & Evidence Drawer
```

---

## 🚀 Quick Start Guide

### 1. Start the Python ML Prediction Service (Port 8000)
```bash
cd ml-service
pip install -r requirements.txt

# (Optional) Retrain the RandomForest model:
python train_model.py

# Start the FastAPI server:
python -m uvicorn main:app --port 8000 --reload
```

### 2. Start the Node.js Express Backend (Port 3001)
```bash
cd backend
npm install
npx prisma db push
npm run dev
```

### 3. Start the React Frontend (Port 5173)
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173** in your browser.

---

## 🗄️ Database Models (`backend/prisma/schema.prisma`)

- **`Patient`**: `id`, `filename`, `date`, `variants[]`
- **`Variant`**: `id`, `patientId`, `chrom`, `pos`, `ref`, `alt`, `qual`, `status`, `evidence?`
- **`Evidence`**: `id`, `variantId`, `frequency`, `conservation_score`, `ml_score`, `shap_explanation`

---

## 📡 API Directory

### Node.js Backend (`http://localhost:3001`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend & SQLite connectivity status |
| `POST` | `/api/upload` | Multipart VCF file upload and stream-parsing |
| `POST` | `/api/analyze/:patientId` | Triggers MyVariant.info annotation & ML prediction pipeline |
| `GET` | `/api/patients` | List all patients with nested variants and evidence |
| `DELETE` | `/api/patients` | Clears all patient history, cascading to all variants & evidence |
| `GET` | `/api/patients/:id` | Get patient details by ID |
| `DELETE` | `/api/patients/:id` | Delete a single patient record |
| `GET` | `/api/variants` | Query variants (supports `?patientId=`, `?chrom=`, `?status=`) |
| `GET` | `/api/evidence/variant/:variantId` | Fetch evidence and SHAP explanation for a variant |

### Python ML Microservice (`http://127.0.0.1:8000`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Model status & feature schema metadata |
| `POST` | `/predict` | Evaluates feature batch `[{ allele_frequency, cadd_score }]` returning `ml_score` and `shap_explanation` |
