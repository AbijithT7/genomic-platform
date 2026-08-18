from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    print("[PASS] /health test passed:", data)


def test_predict():
    payload = [
        {"allele_frequency": 0.00002, "cadd_score": 34.0},  # Pathogenic
        {"allele_frequency": 0.15, "cadd_score": 5.2},     # Benign
        {"allele_frequency": 0.08, "cadd_score": 30.0},    # Benign (high CADD, common AF)
        {"allele_frequency": 0.0005, "cadd_score": 10.0},  # Benign (rare AF, low CADD)
    ]
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    predictions = response.json()
    print("[PASS] /predict test passed with results:")
    for idx, p in enumerate(predictions):
        print(f"  Variant {idx + 1}: ml_score = {p['ml_score']}, explanation = {p['shap_explanation']}")

    # Validation
    assert len(predictions) == 4
    assert predictions[0]["ml_score"] > 0.8
    assert predictions[1]["ml_score"] < 0.2


if __name__ == "__main__":
    test_health()
    test_predict()
    print("\nAll ML microservice tests passed successfully!")
