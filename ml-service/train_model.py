import os
import pickle

import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split


# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

RANDOM_STATE = 42

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_PATH = os.path.join(
    BASE_DIR,
    "data",
    "model_training_data.csv"
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "model.pkl"
)


# ---------------------------------------------------------
# Load real ClinVar dataset
# ---------------------------------------------------------

def load_training_data():

    print("Loading real ClinVar training dataset...")

    df = pd.read_csv(
        DATA_PATH,
        low_memory=False
    )

    print(f"Dataset size: {len(df):,}")

    # Features used by the model.
    X = df[
        [
            "allele_frequency",
            "cadd_score"
        ]
    ].copy()

    # Target.
    y = df["label"].astype(int)

    return X, y


# ---------------------------------------------------------
# Train and evaluate
# ---------------------------------------------------------

def train_and_save_model():

    X, y = load_training_data()

    print()
    print("===================================")
    print("DATASET")
    print("===================================")
    print(f"Total variants: {len(X):,}")
    print(f"Benign:         {(y == 0).sum():,}")
    print(f"Pathogenic:     {(y == 1).sum():,}")

    # -----------------------------------------------------
    # Train/test split
    # -----------------------------------------------------

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=RANDOM_STATE,
        stratify=y
    )

    print()
    print("===================================")
    print("TRAIN / TEST SPLIT")
    print("===================================")
    print(f"Training variants: {len(X_train):,}")
    print(f"Testing variants:  {len(X_test):,}")

    # -----------------------------------------------------
    # Random Forest
    # -----------------------------------------------------

    print()
    print("Training Random Forest...")

    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        random_state=RANDOM_STATE,
        class_weight="balanced",
        n_jobs=-1
    )

    clf.fit(
        X_train,
        y_train
    )

    # -----------------------------------------------------
    # Predictions
    # -----------------------------------------------------

    y_pred = clf.predict(X_test)

    y_pred_proba = clf.predict_proba(
        X_test
    )[:, 1]

    # -----------------------------------------------------
    # Evaluation
    # -----------------------------------------------------

    print()
    print("===================================")
    print("MODEL EVALUATION")
    print("===================================")

    print()
    print("Classification Report:")
    print(
        classification_report(
            y_test,
            y_pred,
            target_names=[
                "Benign",
                "Pathogenic"
            ]
        )
    )

    roc_auc = roc_auc_score(
        y_test,
        y_pred_proba
    )

    print(
        f"ROC-AUC: {roc_auc:.4f}"
    )

    print()
    print("Confusion Matrix:")

    print(
        confusion_matrix(
            y_test,
            y_pred
        )
    )

    # -----------------------------------------------------
    # Feature importance
    # -----------------------------------------------------

    print()
    print("===================================")
    print("FEATURE IMPORTANCE")
    print("===================================")

    for feature, importance in zip(
        X.columns,
        clf.feature_importances_
    ):
        print(
            f"{feature}: {importance:.4f}"
        )

    # -----------------------------------------------------
    # Retrain using all available data
    # -----------------------------------------------------

    print()
    print("Retraining model on complete dataset...")

    clf.fit(
        X,
        y
    )

    # -----------------------------------------------------
    # Save model
    # -----------------------------------------------------

    artifact = {
        "model": clf,
        "features": [
            "allele_frequency",
            "cadd_score"
        ],
        "dataset": "ClinVar",
        "dataset_size": len(X),
        "random_state": RANDOM_STATE,
        "model_type": "RandomForestClassifier"
    }

    with open(
        MODEL_PATH,
        "wb"
    ) as f:

        pickle.dump(
            artifact,
            f
        )

    print()
    print("===================================")
    print("MODEL SAVED")
    print("===================================")
    print(f"Model: {MODEL_PATH}")
    print("===================================")

    return MODEL_PATH


# ---------------------------------------------------------
# Entry point
# ---------------------------------------------------------

if __name__ == "__main__":
    train_and_save_model()