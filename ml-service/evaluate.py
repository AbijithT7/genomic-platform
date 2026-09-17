import os
import pickle
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
from prepare_dataset import prepare_dataset


def load_model(model_path: str = "model.pkl"):
    """Load the trained model from pickle file."""
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}")

    with open(model_path, "rb") as f:
        model = pickle.load(f)

    print(f"Model loaded from {model_path}")
    return model


def evaluate_model(
    model,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    output_dir: str = None
) -> dict:
    """
    Evaluate model performance and return metrics.

    Args:
        model: Trained scikit-learn model
        X_test: Test features
        y_test: Test target labels
        output_dir: Directory to save evaluation results (optional)

    Returns:
        Dictionary containing evaluation metrics
    """
    # Make predictions
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]

    # Calculate metrics
    report = classification_report(y_test, y_pred, output_dict=True)
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    cm = confusion_matrix(y_test, y_pred)

    # Compile results
    results = {
        "classification_report": report,
        "roc_auc_score": roc_auc,
        "confusion_matrix": cm.tolist(),
        "accuracy": report["accuracy"],
        "precision": report["weighted avg"]["precision"],
        "recall": report["weighted avg"]["recall"],
        "f1_score": report["weighted avg"]["f1-score"]
    }

    # Print results
    print("\n=== Model Evaluation Results ===")
    print(f"Accuracy:  {results['accuracy']:.4f}")
    print(f"Precision: {results['precision']:.4f}")
    print(f"Recall:    {results['recall']:.4f}")
    print(f"F1-Score:  {results['f1_score']:.4f}")
    print(f"ROC-AUC:   {results['roc_auc_score']:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    print("\nConfusion Matrix:")
    print(cm)

    # Save results if output directory provided
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        results_path = os.path.join(output_dir, "evaluation_results.txt")
        with open(results_path, "w") as f:
            f.write("=== Model Evaluation Results ===\n")
            f.write(f"Accuracy:  {results['accuracy']:.4f}\n")
            f.write(f"Precision: {results['precision']:.4f}\n")
            f.write(f"Recall:    {results['recall']:.4f}\n")
            f.write(f"F1-Score:  {results['f1_score']:.4f}\n")
            f.write(f"ROC-AUC:   {results['roc_auc_score']:.4f}\n\n")
            f.write("Classification Report:\n")
            f.write(classification_report(y_test, y_pred))
            f.write("\n\nConfusion Matrix:\n")
            f.write(str(cm))
        print(f"\nEvaluation results saved to {results_path}")

    return results


def main():
    """Main evaluation function."""
    print("Starting model evaluation...")

    # Load model
    model = load_model()

    # Load or prepare test dataset
    # For evaluation, we'll use a separate test set or generate new data
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    test_data_path = os.path.join(data_dir, "test_genomic_variants.csv")

    # Try to load existing test data, otherwise generate
    if os.path.exists(test_data_path):
        print(f"Loading test data from {test_data_path}")
        test_df = pd.read_csv(test_data_path)
        X_test = test_df[["allele_frequency", "cadd_score"]]
        y_test = test_df["pathogenic"]
    else:
        print("Generating test dataset...")
        # Generate test data with different random state to avoid overlap with training
        X_test, y_test = prepare_dataset(
            n_samples=2000,  # Smaller test set
            random_state=123,  # Different seed
            save_path=test_data_path
        )

    print(f"Test dataset shape: {X_test.shape}")
    print(f"Test pathogenic variants: {y_test.sum()} / {len(y_test)} ({y_test.mean()*100:.1f}%)")

    # Evaluate model
    results = evaluate_model(model, X_test, y_test)

    print("\nEvaluation completed successfully!")


if __name__ == "__main__":
    main()