import os
import pickle
from typing import List

import uvicorn
import pandas as pd

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ---------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------

app = FastAPI(
    title="Genomic Variant ML Prediction Service",
    description=(
        "Microservice for predicting variant pathogenicity "
        "using a Random Forest trained on ClinVar-labelled variants."
    ),
    version="2.0.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Model configuration
# ---------------------------------------------------------

MODEL = None
MODEL_METADATA = {}

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "model.pkl"
)


# ---------------------------------------------------------
# Load model
# ---------------------------------------------------------

def load_or_train_model():
    """
    Load the trained model from model.pkl.

    If model.pkl does not exist, train a new model using
    train_model.py.
    """

    global MODEL
    global MODEL_METADATA

    if not os.path.exists(MODEL_PATH):

        print(
            f"Model file not found at {MODEL_PATH}."
        )

        print("Training a new model...")

        from train_model import train_and_save_model

        train_and_save_model()

    try:

        with open(MODEL_PATH, "rb") as f:
            artifact = pickle.load(f)

        # New model format:
        #
        # {
        #     "model": RandomForestClassifier,
        #     "features": [...],
        #     "dataset": "ClinVar",
        #     ...
        # }

        if isinstance(artifact, dict) and "model" in artifact:

            MODEL = artifact["model"]

            MODEL_METADATA = artifact

            print(
                f"Loaded ML model from {MODEL_PATH}"
            )

            print(
                f"Dataset: "
                f"{MODEL_METADATA.get('dataset', 'Unknown')}"
            )

            print(
                f"Training variants: "
                f"{MODEL_METADATA.get('dataset_size', 'Unknown')}"
            )

        else:

            # Backwards compatibility with the old model.pkl
            MODEL = artifact
            MODEL_METADATA = {}

            print(
                f"Loaded legacy ML model from {MODEL_PATH}"
            )

    except Exception as e:

        print(
            f"Error loading model: {e}"
        )

        raise RuntimeError(
            f"Could not load ML model: {e}"
        )


# Load model when the service starts.
load_or_train_model()


# ---------------------------------------------------------
# Request model
# ---------------------------------------------------------

class VariantFeatures(BaseModel):

    allele_frequency: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description=(
            "Population allele frequency "
            "(0.0 to 1.0)"
        ),
        example=0.00005,
    )

    cadd_score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description=(
            "CADD PHRED-scaled score"
        ),
        example=32.5,
    )


# ---------------------------------------------------------
# Response model
# ---------------------------------------------------------

class PredictionResponse(BaseModel):

    ml_score: float = Field(
        ...,
        description=(
            "Predicted probability of pathogenicity "
            "(0.0 to 1.0)"
        ),
    )

    classification: str = Field(
        ...,
        description=(
            "Model-based classification: "
            "Benign, VUS, or Pathogenic"
        ),
    )

    shap_explanation: str = Field(
        ...,
        description=(
            "Feature-based explanation "
            "for the prediction"
        ),
    )


# ---------------------------------------------------------
# Classification
# ---------------------------------------------------------

def classify_pathogenicity(
    prob_pathogenic: float
) -> str:

    """
    Convert the model probability into the
    application's three display categories.

    >= 0.80  -> Pathogenic
    < 0.20   -> Benign
    otherwise -> VUS
    """

    if prob_pathogenic >= 0.80:
        return "Pathogenic"

    if prob_pathogenic < 0.20:
        return "Benign"

    return "VUS"


# ---------------------------------------------------------
# Explanation
# ---------------------------------------------------------

def generate_explanation(
    allele_frequency: float,
    cadd_score: float,
    prob_pathogenic: float
) -> str:

    """
    Generate a human-readable explanation.

    NOTE:
    This is a feature-based explanation, not a true SHAP
    calculation. The API field keeps the existing name
    'shap_explanation' so the frontend remains compatible.
    """

    classification = classify_pathogenicity(
        prob_pathogenic
    )

    # Very rare variant + high CADD.
    if (
        classification == "Pathogenic"
        and cadd_score >= 20
        and allele_frequency < 0.01
    ):

        return (
            f"Model predicted pathogenicity "
            f"(score: {prob_pathogenic:.2f}). "
            f"The variant has a high CADD score "
            f"({cadd_score:.1f}) and low population "
            f"frequency ({allele_frequency:.5f})."
        )

    # Benign prediction with common frequency.
    if (
        classification == "Benign"
        and allele_frequency >= 0.01
    ):

        return (
            f"Model predicted benign "
            f"(score: {prob_pathogenic:.2f}). "
            f"The variant has a relatively common "
            f"population frequency "
            f"({allele_frequency:.4f})."
        )

    # Benign prediction with low CADD.
    if (
        classification == "Benign"
        and cadd_score < 20
    ):

        return (
            f"Model predicted benign "
            f"(score: {prob_pathogenic:.2f}). "
            f"The CADD score is relatively low "
            f"({cadd_score:.1f})."
        )

    # VUS.
    if classification == "VUS":

        return (
            f"Model prediction is uncertain "
            f"(score: {prob_pathogenic:.2f}). "
            f"CADD score: {cadd_score:.1f}; "
            f"population frequency: "
            f"{allele_frequency:.5f}."
        )

    # Generic pathogenic explanation.
    if classification == "Pathogenic":

        return (
            f"Model predicted pathogenicity "
            f"(score: {prob_pathogenic:.2f}). "
            f"CADD score: {cadd_score:.1f}; "
            f"population frequency: "
            f"{allele_frequency:.5f}."
        )

    return (
        f"Model prediction: {classification} "
        f"(score: {prob_pathogenic:.2f}). "
        f"CADD score: {cadd_score:.1f}; "
        f"population frequency: "
        f"{allele_frequency:.5f}."
    )


# ---------------------------------------------------------
# Root endpoint
# ---------------------------------------------------------

@app.get("/")
def root():

    return {
        "status": "ok",
        "service": "Genomic Variant ML Prediction Service",
        "model_loaded": MODEL is not None,
        "model_type": "RandomForestClassifier",
        "dataset": MODEL_METADATA.get(
            "dataset",
            "Unknown"
        ),
        "endpoints": {
            "health": "GET /health",
            "model_info": "GET /model-info",
            "predict": "POST /predict",
        },
    }


# ---------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------

@app.get("/health")
def health():

    if MODEL is None:

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML Model is not initialized",
        )

    return {
        "status": "healthy",
        "model": "RandomForestClassifier",
        "features": [
            "allele_frequency",
            "cadd_score"
        ],
        "dataset": MODEL_METADATA.get(
            "dataset",
            "Unknown"
        ),
    }


# ---------------------------------------------------------
# Model information endpoint
# ---------------------------------------------------------

@app.get("/model-info")
def model_info():

    if MODEL is None:

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML Model is not loaded",
        )

    return {
        "model_type": MODEL_METADATA.get(
            "model_type",
            "RandomForestClassifier"
        ),
        "dataset": MODEL_METADATA.get(
            "dataset",
            "Unknown"
        ),
        "dataset_size": MODEL_METADATA.get(
            "dataset_size",
            None
        ),
        "features": MODEL_METADATA.get(
            "features",
            [
                "allele_frequency",
                "cadd_score"
            ]
        ),
        "random_state": MODEL_METADATA.get(
            "random_state",
            None
        ),
    }


# ---------------------------------------------------------
# Prediction endpoint
# ---------------------------------------------------------

@app.post(
    "/predict",
    response_model=List[PredictionResponse]
)
def predict(
    variants: List[VariantFeatures]
):

    """
    Accept a list of genomic variant features and return
    pathogenicity probabilities and classifications.
    """

    if MODEL is None:

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model is not loaded",
        )

    if not variants:
        return []

    try:

        # -------------------------------------------------
        # Build feature dataframe
        # -------------------------------------------------

        feature_df = pd.DataFrame([
            {
                "allele_frequency": variant.allele_frequency,
                "cadd_score": variant.cadd_score,
            }
            for variant in variants
        ])

        # -------------------------------------------------
        # Predict probability
        # -------------------------------------------------

        probabilities = MODEL.predict_proba(
            feature_df
        )

        # Random Forest binary classification:
        #
        # column 0 = probability of class 0 (Benign)
        # column 1 = probability of class 1 (Pathogenic)

        if probabilities.shape[1] < 2:

            raise RuntimeError(
                "Model does not contain both "
                "Benign and Pathogenic classes."
            )

        pathogenic_probs = probabilities[:, 1]

        # -------------------------------------------------
        # Build responses
        # -------------------------------------------------

        results = []

        for i, variant in enumerate(variants):

            score = float(
                pathogenic_probs[i]
            )

            classification = classify_pathogenicity(
                score
            )

            explanation = generate_explanation(
                variant.allele_frequency,
                variant.cadd_score,
                score
            )

            results.append(
                {
                    "ml_score": round(
                        score,
                        3
                    ),
                    "classification": classification,
                    "shap_explanation": explanation,
                }
            )

        return results

    except Exception as e:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}",
        )


# ---------------------------------------------------------
# Run server
# ---------------------------------------------------------

if __name__ == "__main__":

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )