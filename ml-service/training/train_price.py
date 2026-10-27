import json
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from xgboost import XGBRegressor
from statsmodels.tsa.arima.model import ARIMA
from sklearn.preprocessing import MinMaxScaler

sys.path.append(str(Path(__file__).resolve().parent.parent))
from preprocessing.features import load_crop_series, add_time_features, time_series_split, mae, rmse, mape
from preprocessing.lstm_arch import build_lstm_model

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
DATA_CSV = ROOT / "datasets" / "crop_prices.csv"
MODEL_DIR = ROOT / "models"
MODEL_DIR.mkdir(exist_ok=True)

CROPS = ["wheat", "paddy", "cotton", "maize"]
LSTM_WINDOW = 30
TEST_DAYS = 90
VAL_DAYS = 90


def train_arima(train_val_series, test_series):
    model = ARIMA(train_val_series.values, order=(5, 1, 1))
    fit = model.fit()
    forecast = fit.forecast(steps=len(test_series))
    m = dict(mae=mae(test_series, forecast), rmse=rmse(test_series, forecast), mape=mape(test_series, forecast))
    return fit, forecast, m


def build_lag_frame(df):
    feat_df = add_time_features(df).dropna().reset_index(drop=True)
    feature_cols = [
        "month_sin", "month_cos", "lag_1", "lag_7", "lag_14", "lag_30",
        "rolling_mean_7", "rolling_std_7", "rolling_mean_30", "arrivals_tonnes",
    ]
    return feat_df, feature_cols


def train_xgboost(df):
    feat_df, feature_cols = build_lag_frame(df)
    train, val, test = time_series_split(feat_df, TEST_DAYS, VAL_DAYS)
    trainval = pd.concat([train, val])
    model = XGBRegressor(
        n_estimators=400, max_depth=4, learning_rate=0.03,
        subsample=0.8, colsample_bytree=0.8, random_state=42,
    )
    model.fit(trainval[feature_cols], trainval["price_per_quintal"])
    preds = model.predict(test[feature_cols])
    m = dict(
        mae=mae(test["price_per_quintal"], preds),
        rmse=rmse(test["price_per_quintal"], preds),
        mape=mape(test["price_per_quintal"], preds),
    )
    return model, feature_cols, preds, m


def make_sequences(values, window):
    X, y = [], []
    for i in range(window, len(values)):
        X.append(values[i - window:i])
        y.append(values[i])
    return np.array(X), np.array(y)


def train_lstm(df):
    from tensorflow import keras

    prices = df["price_per_quintal"].values.reshape(-1, 1)
    n = len(prices)
    test_start = n - TEST_DAYS
    val_start = test_start - VAL_DAYS

    scaler = MinMaxScaler()
    scaler.fit(prices[:val_start])
    scaled = scaler.transform(prices)

    X, y = make_sequences(scaled.flatten(), LSTM_WINDOW)
    split_test = test_start - LSTM_WINDOW
    split_val = val_start - LSTM_WINDOW

    X_train, y_train = X[:split_val], y[:split_val]
    X_val, y_val = X[split_val:split_test], y[split_val:split_test]
    X_test, y_test = X[split_test:], y[split_test:]

    X_train = X_train.reshape(-1, LSTM_WINDOW, 1)
    X_val = X_val.reshape(-1, LSTM_WINDOW, 1)
    X_test = X_test.reshape(-1, LSTM_WINDOW, 1)

    model = build_lstm_model(LSTM_WINDOW)
    model.fit(
        X_train, y_train, validation_data=(X_val, y_val),
        epochs=80, batch_size=32, verbose=0,
        callbacks=[keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True)],
    )

    pred_scaled = model.predict(X_test, verbose=0).flatten()
    pred = scaler.inverse_transform(pred_scaled.reshape(-1, 1)).flatten()
    actual = scaler.inverse_transform(y_test.reshape(-1, 1)).flatten()

    m = dict(mae=mae(actual, pred), rmse=rmse(actual, pred), mape=mape(actual, pred))
    return model, scaler, pred, m


def main():
    all_metrics = {}
    for crop in CROPS:
        print(f"\n=== Training models for {crop} ===")
        df = load_crop_series(DATA_CSV, crop)
        series = df["price_per_quintal"]
        train, val, test = time_series_split(df, TEST_DAYS, VAL_DAYS)
        trainval_series = pd.concat([train, val])["price_per_quintal"]
        test_series = test["price_per_quintal"]

        arima_fit, arima_pred, arima_m = train_arima(trainval_series, test_series)
        print("ARIMA:", arima_m)
        joblib.dump(arima_fit, MODEL_DIR / f"price_arima_{crop}.pkl")

        xgb_model, xgb_cols, xgb_pred, xgb_m = train_xgboost(df)
        print("XGBoost:", xgb_m)
        joblib.dump({"model": xgb_model, "feature_cols": xgb_cols}, MODEL_DIR / f"price_xgb_{crop}.pkl")

        lstm_model, lstm_scaler, lstm_pred, lstm_m = train_lstm(df)
        print("LSTM:", lstm_m)
        lstm_model.save_weights(MODEL_DIR / f"price_lstm_{crop}.weights.h5")
        joblib.dump(lstm_scaler, MODEL_DIR / f"price_lstm_scaler_{crop}.pkl")

        candidates = {"ARIMA": arima_m, "XGBoost": xgb_m, "LSTM": lstm_m}
        best_model = min(candidates, key=lambda k: candidates[k]["rmse"])

        all_metrics[crop] = {
            "ARIMA": arima_m, "XGBoost": xgb_m, "LSTM": lstm_m,
            "best_model": best_model,
            "last_price": float(series.iloc[-1]),
            "last_date": df["date"].iloc[-1].strftime("%Y-%m-%d"),
        }
        print(f"Best model for {crop}: {best_model}")

    with open(MODEL_DIR / "price_metrics.json", "w") as f:
        json.dump(all_metrics, f, indent=2)
    print("\nSaved metrics to", MODEL_DIR / "price_metrics.json")


if __name__ == "__main__":
    main()
