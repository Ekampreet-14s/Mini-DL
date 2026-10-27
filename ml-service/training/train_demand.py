import json
import sys
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

sys.path.append(str(Path(__file__).resolve().parent.parent))
from preprocessing.features import time_series_split, mae, rmse, mape

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
DATA_CSV = ROOT / "datasets" / "demand.csv"
MODEL_DIR = ROOT / "models"
MODEL_DIR.mkdir(exist_ok=True)
CROPS = ["wheat", "paddy", "cotton", "maize"]
TEST_DAYS, VAL_DAYS = 60, 60


def load_demand_series(crop):
    df = pd.read_csv(DATA_CSV, parse_dates=["date"])
    df = df[df.crop == crop].groupby("date", as_index=False)["demand_index"].mean()
    df = df.sort_values("date")
    full_range = pd.date_range(df.date.min(), df.date.max(), freq="D")
    df = df.set_index("date").reindex(full_range).ffill().rename_axis("date").reset_index()
    return df


def add_features(df):
    df = df.copy()
    df["month_sin"] = np.sin(2 * np.pi * df["date"].dt.month / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["date"].dt.month / 12)
    for lag in [1, 7, 14, 28]:
        df[f"lag_{lag}"] = df["demand_index"].shift(lag)
    df["rolling_mean_7"] = df["demand_index"].rolling(7).mean()
    return df.dropna().reset_index(drop=True)


def main():
    metrics = {}
    for crop in CROPS:
        raw = load_demand_series(crop)
        feat = add_features(raw)
        feature_cols = ["month_sin", "month_cos", "lag_1", "lag_7", "lag_14", "lag_28", "rolling_mean_7"]
        train, val, test = time_series_split(feat, TEST_DAYS, VAL_DAYS)
        trainval = pd.concat([train, val])

        model = RandomForestRegressor(n_estimators=300, max_depth=8, random_state=42)
        model.fit(trainval[feature_cols], trainval["demand_index"])
        preds = model.predict(test[feature_cols])

        m = dict(
            mae=mae(test["demand_index"], preds),
            rmse=rmse(test["demand_index"], preds),
            mape=mape(test["demand_index"], preds),
        )
        print(crop, m)
        joblib.dump({"model": model, "feature_cols": feature_cols}, MODEL_DIR / f"demand_rf_{crop}.pkl")
        metrics[crop] = {
            **m,
            "last_demand": float(raw["demand_index"].iloc[-1]),
            "last_date": raw["date"].iloc[-1].strftime("%Y-%m-%d"),
        }

    with open(MODEL_DIR / "demand_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print("Saved demand metrics.")


if __name__ == "__main__":
    main()
