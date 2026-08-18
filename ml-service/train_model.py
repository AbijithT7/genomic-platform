import os
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score


def generate_synthetic_data(n_samples: int = 10000, random_state: int = 42) -> pd.DataFrame:
    """
    Generates a synthetic DataFrame of mock variants with continuous features,
    probability-based pathogenicity, and sampled binary target labels.
    """
    np.random.seed(random_state)

    cadd_score = np.random.uniform(0.0, 40.0, n_samples)

    # Sample allele frequency from a log-uniform distribution in [1e-6, 0.5].
    log_min = np.log10(1e-6)
    log_max = np.log10(0.5)
    allele_frequency = 10 ** np.random.uniform(log_min, log_max, n_samples)

    df = pd.DataFrame({
        "allele_frequency": allele_frequency,
        "cadd_score": cadd_score,
    })

    logit = (
        (df["cadd_score"] - 20.0) / 4.0
        - np.log10(df["allele_frequency"] + 1e-5) * 0.8
        - 3.0
    )
    prob_pathogenic = 1.0 / (1.0 + np.exp(-logit))

    # Sample binary labels from the continuous probability for realistic uncertainty.
    df["pathogenic"] = np.random.binomial(1, prob_pathogenic).astype(int)

    return df


def train_and_save_model():
    print("Generating 10,000 synthetic genomic variant records...")
    df = generate_synthetic_data(n_samples=10000)

    print(f"Pathogenic variants: {df['pathogenic'].sum()} / {len(df)}")

    X = df[["allele_frequency", "cadd_score"]]
    y = df["pathogenic"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("Training RandomForestClassifier...")
    clf = RandomForestClassifier(n_estimators=150, max_depth=8, random_state=42)
    clf.fit(X_train, y_train)

    y_pred_proba = clf.predict_proba(X_test)[:, 1]
    y_pred = clf.predict(X_test)

    print("\n--- Evaluation Report on Test Split ---")
    print(classification_report(y_test, y_pred, target_names=["Benign (0)", "Pathogenic (1)"]))
    print(f"ROC-AUC Score: {roc_auc_score(y_test, y_pred_proba):.4f}")

    # Retrain on full dataset for production deployment
    clf.fit(X, y)

    # Save model.pkl in ml-service directory
    output_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(output_dir, "model.pkl")

    with open(model_path, "wb") as f:
        pickle.dump(clf, f)

    print(f"\nModel successfully trained and serialized to: {model_path}")
    return model_path


if __name__ == "__main__":
    train_and_save_model()
