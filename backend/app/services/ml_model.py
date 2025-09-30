import os
import json
import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier


MODEL_PATH = os.path.join(os.path.dirname(__file__), "model_gbc.joblib")


FEATURES = [
    "docs_complete",            # bool -> 0/1
    "is_duplicate",             # bool -> 0/1
    "area_ha",                  # float
    "is_in_critical_wildlife_zone",  # bool -> 0/1
    "community_support",        # bool -> 0/1
]


def _to_feature_vector(claim: dict) -> np.ndarray:
    def b(x):
        return 1.0 if bool(x) else 0.0
    return np.array([
        b(claim.get("docs_complete")),
        b(claim.get("is_duplicate")),
        float(claim.get("area_ha", 0) or 0),
        b(claim.get("is_in_critical_wildlife_zone")),
        b(claim.get("community_support")),
    ], dtype=float)


def train_synthetic() -> GradientBoostingClassifier:
    # Synthetic training data
    rng = np.random.default_rng(42)
    n = 500
    X = rng.random((n, len(FEATURES)))
    # Make interpretable target: good if docs_complete & community_support & not duplicate & small area
    # Map random [0,1) to booleans for the first, second, fourth, fifth features
    Xb = (X > 0.5).astype(float)
    area = X[:, 2] * 12  # 0..12 ha
    y = (
        (Xb[:, 0] == 1.0) & (Xb[:, 1] == 0.0) & (Xb[:, 4] == 1.0) & (area < 3.0)
    ).astype(int)
    X[:, 0] = Xb[:, 0]
    X[:, 1] = Xb[:, 1]
    X[:, 2] = area
    X[:, 3] = Xb[:, 3]
    X[:, 4] = Xb[:, 4]

    model = GradientBoostingClassifier(random_state=42)
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)
    return model


def load_or_train_model() -> GradientBoostingClassifier:
    if os.path.exists(MODEL_PATH):
        return joblib.load(MODEL_PATH)
    return train_synthetic()


def score_with_model(model: GradientBoostingClassifier, claim: dict) -> dict:
    x = _to_feature_vector(claim).reshape(1, -1)
    p = float(model.predict_proba(x)[0, 1])
    score = int(round(p * 100))
    priority = "high" if score >= 70 else ("medium" if score >= 40 else "low")
    return {"score": score, "priority": priority, "prob": p}


