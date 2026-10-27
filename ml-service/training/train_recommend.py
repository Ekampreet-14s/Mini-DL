import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import KFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
DATA_CSV = ROOT / "datasets" / "crop_recommendation.csv"
MODEL_DIR = ROOT / "models"
MODEL_DIR.mkdir(exist_ok=True)

FEATURE_COLS = ["crop", "season", "water_availability", "soil_type"]
TARGET_COL = "avg_yield_qtl_per_acre"


def mae(y_true, y_pred):
    return float(np.mean(np.abs(np.asarray(y_true) - np.asarray(y_pred))))


def rmse(y_true, y_pred):
    return float(np.sqrt(np.mean((np.asarray(y_true) - np.asarray(y_pred)) ** 2)))


def r2(y_true, y_pred):
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    return float(1 - ss_res / ss_tot)


def build_pipeline():
    preprocess = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore"), FEATURE_COLS),
    ])
    model = RandomForestRegressor(n_estimators=300, max_depth=6, random_state=42)
    return Pipeline([("preprocess", preprocess), ("model", model)])


def main():
    df = pd.read_csv(DATA_CSV)
    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    cv = KFold(n_splits=5, shuffle=True, random_state=42)
    cv_preds = cross_val_predict(build_pipeline(), X, y, cv=cv)

    cv_metrics = {
        "mae": round(mae(y, cv_preds), 3),
        "rmse": round(rmse(y, cv_preds), 3),
        "r2": round(r2(y, cv_preds), 3),
    }
    print("5-fold CV metrics:", cv_metrics)

    final_pipeline = build_pipeline()
    final_pipeline.fit(X, y)
    joblib.dump(final_pipeline, MODEL_DIR / "recommend_yield_rf.pkl")

    metrics = {
        "cv_5fold": cv_metrics,
        "n_samples": len(df),
        "features": FEATURE_COLS,
        "target": TARGET_COL,
    }
    with open(MODEL_DIR / "recommend_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print("Saved recommend_yield_rf.pkl and recommend_metrics.json")


if __name__ == "__main__":
    main()
