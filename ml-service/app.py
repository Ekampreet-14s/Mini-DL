import json
from pathlib import Path
from datetime import timedelta

import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from preprocessing.lstm_arch import build_lstm_model

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "models"
DATA_DIR = ROOT / "datasets"

app = FastAPI(title="AgriMarket AI ML Service")

CROPS = ["wheat", "paddy", "cotton", "maize"]
SEASONS = ["Kharif", "Rabi", "Zaid"]
WATER_LEVELS = ["Low", "Medium", "High"]
SOIL_TYPES = ["Sandy", "Loamy", "Clay"]

_price_metrics = json.loads((MODEL_DIR / "price_metrics.json").read_text())
_demand_metrics = json.loads((MODEL_DIR / "demand_metrics.json").read_text())
_recommend_metrics = json.loads((MODEL_DIR / "recommend_metrics.json").read_text())
_recommend_model = joblib.load(MODEL_DIR / "recommend_yield_rf.pkl")
_production_cost = pd.read_csv(DATA_DIR / "production_cost.csv")

_price_series_cache = {}
_demand_series_cache = {}
_demand_model_cache = {}
_lstm_model_cache = {}
LSTM_WINDOW = 30


def get_lstm_model(crop):
    if crop not in _lstm_model_cache:
        model = build_lstm_model(LSTM_WINDOW)
        model.load_weights(MODEL_DIR / f"price_lstm_{crop}.weights.h5")
        _lstm_model_cache[crop] = model
    return _lstm_model_cache[crop]


def get_price_series(crop):
    if crop not in _price_series_cache:
        df = pd.read_csv(DATA_DIR / "crop_prices.csv", parse_dates=["date"])
        df = df[df.crop == crop].groupby("date", as_index=False).agg(
            price_per_quintal=("price_per_quintal", "mean"),
            arrivals_tonnes=("arrivals_tonnes", "mean"),
        ).sort_values("date")
        _price_series_cache[crop] = df.reset_index(drop=True)
    return _price_series_cache[crop].copy()


def get_demand_series(crop):
    if crop not in _demand_series_cache:
        df = pd.read_csv(DATA_DIR / "demand.csv", parse_dates=["date"])
        df = df[df.crop == crop].groupby("date", as_index=False)["demand_index"].mean().sort_values("date")
        _demand_series_cache[crop] = df.reset_index(drop=True)
    return _demand_series_cache[crop].copy()


def get_demand_model(crop):
    if crop not in _demand_model_cache:
        _demand_model_cache[crop] = joblib.load(MODEL_DIR / f"demand_rf_{crop}.pkl")
    return _demand_model_cache[crop]


class PriceRequest(BaseModel):
    crop: str
    model: str = "auto"
    horizon_days: int = 90


class DemandRequest(BaseModel):
    crop: str
    horizon_weeks: int = 8


class RecommendRequest(BaseModel):
    season: str
    water_availability: str
    soil_type: str
    acres: float = 1.0


def _validate_crop(crop):
    if crop not in CROPS:
        raise HTTPException(status_code=400, detail=f"Unknown crop '{crop}'. Valid: {CROPS}")


def _validate_choice(value, choices, field):
    if value not in choices:
        raise HTTPException(status_code=400, detail=f"{field} must be one of {choices}")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict/price")
def predict_price(req: PriceRequest):
    crop = req.crop.lower()
    _validate_crop(crop)
    metrics = _price_metrics[crop]
    model_choice = req.model if req.model != "auto" else metrics["best_model"]
    if model_choice not in ("LSTM", "ARIMA", "XGBoost"):
        raise HTTPException(status_code=400, detail="model must be LSTM, ARIMA, XGBoost or auto")

    series_df = get_price_series(crop)
    last_date = series_df["date"].iloc[-1]
    horizon = max(1, min(req.horizon_days, 180))
    future_dates = [last_date + timedelta(days=i + 1) for i in range(horizon)]

    if model_choice == "ARIMA":
        fit = joblib.load(MODEL_DIR / f"price_arima_{crop}.pkl")
        forecast = fit.get_forecast(steps=horizon).predicted_mean
        forecast = np.asarray(forecast).tolist()

    elif model_choice == "XGBoost":
        bundle = joblib.load(MODEL_DIR / f"price_xgb_{crop}.pkl")
        model, cols = bundle["model"], bundle["feature_cols"]
        hist_prices = series_df["price_per_quintal"].tolist()
        hist_arrivals = series_df["arrivals_tonnes"].tolist()
        forecast = []
        for i, d in enumerate(future_dates):
            month_sin = np.sin(2 * np.pi * d.month / 12)
            month_cos = np.cos(2 * np.pi * d.month / 12)
            lag_1 = hist_prices[-1]
            lag_7 = hist_prices[-7]
            lag_14 = hist_prices[-14]
            lag_30 = hist_prices[-30]
            roll7 = np.mean(hist_prices[-7:])
            roll7_std = np.std(hist_prices[-7:])
            roll30 = np.mean(hist_prices[-30:])
            arrivals = np.mean(hist_arrivals[-7:])
            row = pd.DataFrame([{
                "month_sin": month_sin, "month_cos": month_cos,
                "lag_1": lag_1, "lag_7": lag_7, "lag_14": lag_14, "lag_30": lag_30,
                "rolling_mean_7": roll7, "rolling_std_7": roll7_std,
                "rolling_mean_30": roll30, "arrivals_tonnes": arrivals,
            }])[cols]
            pred = float(model.predict(row)[0])
            forecast.append(pred)
            hist_prices.append(pred)
            hist_arrivals.append(arrivals)

    else:
        model = get_lstm_model(crop)
        scaler = joblib.load(MODEL_DIR / f"price_lstm_scaler_{crop}.pkl")
        hist = series_df["price_per_quintal"].values[-LSTM_WINDOW:].tolist()
        forecast = []
        for _ in future_dates:
            scaled_window = scaler.transform(np.array(hist[-LSTM_WINDOW:]).reshape(-1, 1)).flatten()
            x = scaled_window.reshape(1, LSTM_WINDOW, 1)
            pred_scaled = model.predict(x, verbose=0)[0][0]
            pred = float(scaler.inverse_transform([[pred_scaled]])[0][0])
            forecast.append(pred)
            hist.append(pred)

    current_price = float(series_df["price_per_quintal"].iloc[-1])
    final_price = float(forecast[-1])
    pct_change = (final_price - current_price) / current_price * 100
    confidence = max(50, min(97, round(100 - metrics[model_choice]["mape"] * 4, 1)))

    return {
        "success": True,
        "data": {
            "crop": crop,
            "model": model_choice,
            "current_price": round(current_price, 2),
            "forecast_price": round(final_price, 2),
            "pct_change": round(pct_change, 2),
            "confidence": confidence,
            "horizon_days": horizon,
            "history": [
                {"date": d.strftime("%Y-%m-%d"), "price": round(p, 2)}
                for d, p in zip(series_df["date"].tail(120), series_df["price_per_quintal"].tail(120))
            ],
            "forecast": [
                {"date": d.strftime("%Y-%m-%d"), "price": round(p, 2)}
                for d, p in zip(future_dates, forecast)
            ],
            "model_comparison": {
                m: {"mae": metrics[m]["mae"], "rmse": metrics[m]["rmse"], "mape": metrics[m]["mape"]}
                for m in ("LSTM", "ARIMA", "XGBoost")
            },
            "best_model": metrics["best_model"],
        },
        "message": "Prediction generated successfully",
    }


@app.post("/predict/demand")
def predict_demand(req: DemandRequest):
    crop = req.crop.lower()
    _validate_crop(crop)
    bundle = get_demand_model(crop)
    model, cols = bundle["model"], bundle["feature_cols"]

    series_df = get_demand_series(crop)
    last_date = series_df["date"].iloc[-1]
    horizon_days = max(7, min(req.horizon_weeks, 26) * 7)
    hist = series_df["demand_index"].tolist()
    future_dates = [last_date + timedelta(days=i + 1) for i in range(horizon_days)]

    forecast = []
    for d in future_dates:
        dow = d.weekday()
        feat_row = {
            "month_sin": np.sin(2 * np.pi * d.month / 12), "month_cos": np.cos(2 * np.pi * d.month / 12),
            "dow_sin": np.sin(2 * np.pi * dow / 7), "dow_cos": np.cos(2 * np.pi * dow / 7),
            "lag_1": hist[-1], "lag_2": hist[-2], "lag_3": hist[-3],
            "lag_7": hist[-7], "lag_14": hist[-14], "lag_21": hist[-21], "lag_28": hist[-28],
            "rolling_mean_7": np.mean(hist[-7:]), "rolling_mean_14": np.mean(hist[-14:]),
            "rolling_std_7": np.std(hist[-7:]),
            "ewm_7": pd.Series(hist[-14:]).ewm(span=7, adjust=False).mean().iloc[-1],
        }
        row = pd.DataFrame([feat_row])[cols]
        pred = float(np.clip(model.predict(row)[0], 0, 100))
        forecast.append(pred)
        hist.append(pred)

    weekly = [round(float(np.mean(forecast[i:i + 7])), 1) for i in range(0, len(forecast), 7)]
    current = float(series_df["demand_index"].iloc[-1])
    avg_forecast = float(np.mean(forecast))
    trend = "Rising" if avg_forecast > current + 2 else ("Falling" if avg_forecast < current - 2 else "Stable")
    level = "High" if avg_forecast >= 65 else ("Medium" if avg_forecast >= 40 else "Low")

    return {
        "success": True,
        "data": {
            "crop": crop,
            "model": bundle.get("model_type", "RandomForest"),
            "current_demand_index": round(current, 1),
            "predicted_demand_index": round(avg_forecast, 1),
            "demand_trend": trend,
            "demand_level": level,
            "weekly_forecast": weekly,
            "horizon_weeks": req.horizon_weeks,
            "accuracy": {
                "mape": round(_demand_metrics[crop]["mape"], 2),
                "mae": round(_demand_metrics[crop]["mae"], 2),
            },
        },
        "message": "Prediction generated successfully",
    }


@app.post("/predict/recommend")
def predict_recommend(req: RecommendRequest):
    season = req.season.strip().title()
    water = req.water_availability.strip().title()
    soil = req.soil_type.strip().title()
    _validate_choice(season, SEASONS, "season")
    _validate_choice(water, WATER_LEVELS, "water_availability")
    _validate_choice(soil, SOIL_TYPES, "soil_type")
    acres = max(0.1, min(req.acres, 1000))

    query = pd.DataFrame([
        {"crop": crop, "season": season, "water_availability": water, "soil_type": soil}
        for crop in CROPS
    ])
    predicted_yield = _recommend_model.predict(query)

    results = []
    for crop, yield_qtl in zip(CROPS, predicted_yield):
        price_series = get_price_series(crop)
        current_price = float(price_series["price_per_quintal"].iloc[-1])

        cost_row = _production_cost[
            (_production_cost.crop == crop) & (_production_cost.season == season)
        ]
        if cost_row.empty:
            cost_row = _production_cost[_production_cost.crop == crop]
        if cost_row.empty:
            raise HTTPException(
                status_code=500,
                detail=f"No production cost data available for crop '{crop}'. "
                        "Check production_cost.csv coverage.",
            )
        cost_breakdown = {
            "seed": float(cost_row["seed_cost"].mean()),
            "fertilizer": float(cost_row["fertilizer_cost"].mean()),
            "labour": float(cost_row["labour_cost"].mean()),
            "irrigation": float(cost_row["irrigation_cost"].mean()),
            "other": float(cost_row["other_cost"].mean()),
        }
        cost_per_acre = sum(cost_breakdown.values())

        revenue_per_acre = float(yield_qtl) * current_price
        profit_per_acre = revenue_per_acre - cost_per_acre
        margin_pct = (profit_per_acre / revenue_per_acre * 100) if revenue_per_acre > 0 else 0.0

        results.append({
            "crop": crop,
            "predicted_yield_qtl_per_acre": round(float(yield_qtl), 2),
            "current_price_per_quintal": round(current_price, 2),
            "cost_breakdown_per_acre": {k: round(v, 2) for k, v in cost_breakdown.items()},
            "total_cost_per_acre": round(cost_per_acre, 2),
            "total_cost": round(cost_per_acre * acres, 2),
            "expected_revenue_per_acre": round(revenue_per_acre, 2),
            "expected_profit_per_acre": round(profit_per_acre, 2),
            "expected_profit_total": round(profit_per_acre * acres, 2),
            "profit_margin_pct": round(margin_pct, 1),
        })

    results.sort(key=lambda r: r["expected_profit_per_acre"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1

    return {
        "success": True,
        "data": {
            "season": season,
            "water_availability": water,
            "soil_type": soil,
            "acres": acres,
            "recommended_crop": results[0]["crop"],
            "ranking": results,
            "model_accuracy": {
                "r2": round(_recommend_metrics["cv_5fold"]["r2"], 3),
                "mae_qtl_per_acre": round(_recommend_metrics["cv_5fold"]["mae"], 2),
            },
        },
        "message": "Recommendation generated successfully",
    }


@app.get("/metrics/price")
def price_metrics():
    return {"success": True, "data": _price_metrics}


@app.get("/metrics/demand")
def demand_metrics():
    return {"success": True, "data": _demand_metrics}


@app.get("/metrics/recommend")
def recommend_metrics():
    return {"success": True, "data": _recommend_metrics}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
