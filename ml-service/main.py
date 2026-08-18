import os
import pickle
from typing import List
import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Genomic Variant ML Prediction Service",
    description="Microservice for predicting variant pathogenicity and generating explanations using RandomForest.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model container
MODEL = None
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model.pkl")


def load_or_train_model():
    """Loads model.pkl or triggers training if model file does not exist."""
    global MODEL
    if os.path.exists(MODEL_PATH):
        try:
            with open(MODEL_PATH, "rb") as f:
                MODEL = pickle.load(f)
            print(f"Loaded ML model from {MODEL_PATH}")
        except Exception as e:
            print(f"Error loading {MODEL_PATH}: {e}. Retraining...")
            from train_model import train_and_save_model
            train_and_save_model()
            with open(MODEL_PATH, "rb") as f:
                MODEL = pickle.load(f)
    else:
        print(f"Model file not found at {MODEL_PATH}. Training new model...")
        from train_model import train_and_save_model
        train_and_save_model()
        with open(MODEL_PATH, "rb") as f:
            MODEL = pickle.load(f)


# Load model at startup
load_or_train_model()


class VariantFeatures(BaseModel):
    allele_frequency: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Allele frequency across population databases (0.0 to 1.0)",
        example=0.00005,
    )
    cadd_score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="CADD Phred-scaled conservation & deleteriousness score",
        example=32.5,
    )


class PredictionResponse(BaseModel):
    ml_score: float = Field(..., description="Pathogenicity probability score (0.0 to 1.0)")
    classification: str = Field(..., description="Clinical interpretation label: Benign, VUS, or Pathogenic")
    shap_explanation: str = Field(..., description="Feature-based interpretability summary")


def classify_pathogenicity(prob_pathogenic: float) -> str:
    """Maps continuous probability to Benign/VUS/Pathogenic with fixed thresholds."""
    if prob_pathogenic >= 0.80:
        return "Pathogenic"
    if prob_pathogenic < 0.20:
        return "Benign"
    return "VUS"


def generate_explanation(allele_frequency: float, cadd_score: float, prob_pathogenic: float) -> str:
    """Generates an intuitive feature importance / SHAP explanation summary."""
    classification = classify_pathogenicity(prob_pathogenic)

    if classification == "Pathogenic":
        return (
            f"Flagged pathogenic (score: {prob_pathogenic:.2f}): High CADD score ({cadd_score:.1f} > 25.0) "
            f"combined with ultra-rare population frequency ({allele_frequency:.5f} < 0.01)."
        )
    if classification == "VUS":
        return (
            f"Classified VUS (score: {prob_pathogenic:.2f}): Mixed evidence from CADD ({cadd_score:.1f}) "
            f"and allele frequency ({allele_frequency:.5f}) keeps this in an uncertain range."
        )

    if cadd_score > 25.0 and allele_frequency >= 0.01:
        return (
            f"Classified benign (score: {prob_pathogenic:.2f}): High CADD score ({cadd_score:.1f}) is "
            f"mitigated by high population frequency ({allele_frequency:.4f} >= 0.01)."
        )
    if cadd_score <= 25.0 and allele_frequency < 0.01:
        return (
            f"Classified benign (score: {prob_pathogenic:.2f}): Rare allele frequency ({allele_frequency:.5f}) "
            f"but non-deleterious CADD score ({cadd_score:.1f} <= 25.0)."
        )

    return (
        f"Classified benign (score: {prob_pathogenic:.2f}): Low CADD score ({cadd_score:.1f}) "
        f"and common population polymorphism ({allele_frequency:.4f})."
    )


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Genomic Variant ML Prediction Service",
        "model_loaded": MODEL is not None,
        "endpoints": {
            "health": "GET /health",
            "predict": "POST /predict",
        },
    }


@app.get("/health")
def health():
    if MODEL is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML Model is not initialized",
        )
    return {"status": "healthy", "model": "RandomForestClassifier", "features": ["allele_frequency", "cadd_score"]}


@app.post("/predict", response_model=List[PredictionResponse])
def predict(variants: List[VariantFeatures]):
    """
    Accepts a list of VariantFeatures and runs model.predict_proba()
    to return pathogenicity probability (ml_score) and explanation.
    """
    if MODEL is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model is not loaded",
        )

    if not variants:
        return []

    try:
        # Prepare feature matrix with exact feature names
        import pandas as pd
        feature_df = pd.DataFrame(
            [{"allele_frequency": v.allele_frequency, "cadd_score": v.cadd_score} for v in variants]
        )

        # Predict probabilities: class 0 (benign), class 1 (pathogenic)
        probabilities = MODEL.predict_proba(feature_df)

        # Handle binary classification case
        if probabilities.shape[1] > 1:
            pathogenic_probs = probabilities[:, 1]
        else:
            pathogenic_probs = probabilities[:, 0]

        results = []
        for i, v in enumerate(variants):
            score = float(pathogenic_probs[i])
            rounded_score = round(score, 3)
            classification = classify_pathogenicity(score)
            explanation = generate_explanation(v.allele_frequency, v.cadd_score, score)
            results.append({
                "ml_score": rounded_score,
                "classification": classification,
                "shap_explanation": explanation,
            })

        return results

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}",
        )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
