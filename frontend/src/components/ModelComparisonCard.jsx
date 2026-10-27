import { useEffect, useState } from "react";
import api from "../api/client";

const CROPS = ["wheat", "paddy", "cotton", "maize"];
const APPROACH = {
  LSTM: "Deep learning sequence model",
  ARIMA: "Statistical time-series model",
  XGBoost: "Gradient-boosted trees",
};
const STRENGTH = {
  LSTM: "Non-linear temporal patterns",
  ARIMA: "Interpretable trend/seasonality",
  XGBoost: "Feature-rich prediction",
};

export default function ModelComparisonCard() {
  const [crop, setCrop] = useState("wheat");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await api.post("/ml/price-forecast", { crop, model: "auto", horizonDays: 30 });
        if (cancelled) return;
        const cmp = data.data.model_comparison;
        setRows(
          Object.keys(cmp).map((m) => ({
            model: m,
            confidence: Math.max(50, Math.min(97, Math.round(100 - cmp[m].mape * 4))),
            best: m === data.data.best_model,
          }))
        );
      } catch {
        if (!cancelled) setError("Could not load model comparison.");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [crop]);

  return (
    <article className="forecast-card full">
      <div className="fc-head">
        <div>
          <h3 className="fc-title">Model Comparison</h3>
          <p className="fc-desc">Quickly compare the three crop forecasting approaches, evaluated on held-out test data.</p>
        </div>
        <span className="fc-badge badge-green">DECISION SUPPORT</span>
      </div>

      <div className="fc-field" style={{ maxWidth: 220, marginBottom: 12 }}>
        <label>Crop</label>
        <select value={crop} onChange={(e) => setCrop(e.target.value)}>
          {CROPS.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>

      {error && <div className="forecast-output" style={{ color: "#b91c1c" }}>{error}</div>}

      {rows && (
        <div style={{ overflowX: "auto" }}>
          <table className="compare-table">
            <thead><tr><th>Model</th><th>Approach</th><th>Strength</th><th>Confidence</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.model}>
                  <td><strong>{r.model}</strong>{r.best ? " ★" : ""}</td>
                  <td>{APPROACH[r.model]}</td>
                  <td>{STRENGTH[r.model]}</td>
                  <td>{r.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
