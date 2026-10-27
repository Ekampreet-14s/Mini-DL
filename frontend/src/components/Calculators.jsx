import { useState } from "react";

const money = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function Field({ label, value, onChange, step, min }) {
  return (
    <div>
      <label>{label}</label>
      <input type="number" value={value} min={min} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function StoragePlanner() {
  const [qty, setQty] = useState(100);
  const [daily, setDaily] = useState(4);
  const [days, setDays] = useState(30);
  const [gain, setGain] = useState(180);
  const [result, setResult] = useState(null);

  function calc() {
    if (qty <= 0 || daily < 0 || days <= 0 || gain < 0) {
      setResult({ error: true, text: "Please check your inputs — values must be positive." });
      return;
    }
    const cost = qty * daily * days;
    const gainTotal = qty * gain;
    const net = gainTotal - cost;
    setResult({ error: false, cost, gainTotal, net });
  }

  return (
    <article className="forecast-card">
      <div className="fc-head">
        <div><h3 className="fc-title">Storage Planner</h3><p className="fc-desc">Estimate storage cost and remaining stock value before deciding when to sell.</p></div>
        <span className="fc-badge badge-green">PLANNING</span>
      </div>
      <div className="extra-controls">
        <Field label="Quantity (quintal)" value={qty} onChange={setQty} min={1} />
        <Field label="Daily storage cost (₹/qtl)" value={daily} onChange={setDaily} min={0} step={0.5} />
        <Field label="Days to store" value={days} onChange={setDays} min={1} />
        <Field label="Expected price increase (₹/qtl)" value={gain} onChange={setGain} min={0} />
      </div>
      <button className="extra-btn" onClick={calc}>Calculate storage decision</button>
      <div className="extra-result">
        {!result && "Enter your values and calculate."}
        {result?.error && <span className="bad"><b>Check inputs:</b> {result.text}</span>}
        {result && !result.error && (
          <>
            <b>Storage cost:</b> {money(result.cost)} &nbsp; <b>Expected gain:</b> {money(result.gainTotal)}
            <br />
            <b className={result.net >= 0 ? "good" : "bad"}>{result.net >= 0 ? "Worth storing" : "Sell now"}</b>{" "}
            {result.net >= 0 ? "Net advantage of" : "Net disadvantage of"} {money(Math.abs(result.net))}
          </>
        )}
      </div>
    </article>
  );
}

export function ExpenseTracker() {
  const [yieldQty, setYieldQty] = useState(50);
  const [price, setPrice] = useState(2340);
  const [inputs, setInputs] = useState(18000);
  const [other, setOther] = useState(22000);
  const [result, setResult] = useState(null);

  function calc() {
    if (yieldQty <= 0 || price < 0 || inputs < 0 || other < 0) {
      setResult({ error: true });
      return;
    }
    const revenue = yieldQty * price;
    const cost = inputs + other;
    const profit = revenue - cost;
    const margin = revenue ? (profit / revenue) * 100 : 0;
    setResult({ revenue, cost, profit, margin });
  }

  return (
    <article className="forecast-card">
      <div className="fc-head">
        <div><h3 className="fc-title">Expense & Profit Tracker</h3><p className="fc-desc">Calculate crop-level revenue, total cost and estimated profit.</p></div>
        <span className="fc-badge badge-gold">FINANCE</span>
      </div>
      <div className="extra-controls">
        <Field label="Yield (quintal)" value={yieldQty} onChange={setYieldQty} min={1} />
        <Field label="Selling price (₹/qtl)" value={price} onChange={setPrice} min={0} />
        <Field label="Seed + fertilizer (₹)" value={inputs} onChange={setInputs} min={0} />
        <Field label="Labour + other cost (₹)" value={other} onChange={setOther} min={0} />
      </div>
      <button className="extra-btn" onClick={calc}>Calculate profit</button>
      <div className="extra-result">
        {!result && "Estimated profit will appear here."}
        {result?.error && <span className="bad">Please check your inputs.</span>}
        {result && !result.error && (
          <>
            <b>Revenue:</b> {money(result.revenue)}<br />
            <b>Total cost:</b> {money(result.cost)}<br />
            <b className={result.profit >= 0 ? "good" : "bad"}>Estimated profit {money(result.profit)}</b><br />
            <b>Margin:</b> {result.margin.toFixed(1)}%
          </>
        )}
      </div>
    </article>
  );
}

export function LoanCalculator() {
  const [amount, setAmount] = useState(200000);
  const [rate, setRate] = useState(8.5);
  const [months, setMonths] = useState(36);
  const [result, setResult] = useState(null);

  function calc() {
    if (amount <= 0 || rate < 0 || months <= 0) {
      setResult({ error: true });
      return;
    }
    const r = rate / 1200;
    const emi = r === 0 ? amount / months : (amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    const total = emi * months;
    const interest = total - amount;
    setResult({ emi, total, interest });
  }

  return (
    <article className="forecast-card">
      <div className="fc-head">
        <div><h3 className="fc-title">Loan EMI Calculator</h3><p className="fc-desc">Estimate monthly EMI and total repayment for farm financing.</p></div>
        <span className="fc-badge badge-green">FINANCE</span>
      </div>
      <div className="extra-controls">
        <Field label="Loan amount (₹)" value={amount} onChange={setAmount} min={1000} />
        <Field label="Annual interest (%)" value={rate} onChange={setRate} min={0} step={0.1} />
        <Field label="Tenure (months)" value={months} onChange={setMonths} min={1} />
      </div>
      <button className="extra-btn" onClick={calc}>Calculate EMI</button>
      <div className="extra-result">
        {!result && "EMI will appear here."}
        {result?.error && <span className="bad">Please check your inputs.</span>}
        {result && !result.error && (
          <>
            <b>Monthly EMI:</b> {money(result.emi)}<br />
            <b>Total repayment:</b> {money(result.total)}<br />
            <span className="warn">Interest cost: {money(result.interest)}</span>
          </>
        )}
      </div>
    </article>
  );
}

export function CropGuide() {
  const [season, setSeason] = useState("Kharif");
  const [water, setWater] = useState("High");
  const [soil, setSoil] = useState("Loamy");
  const [result, setResult] = useState(null);

  function calc() {
    const scores = {
      Wheat: (season === "Rabi" ? 40 : 10) + (water === "Medium" || water === "High" ? 30 : 10) + (soil === "Loamy" ? 25 : soil === "Clay" ? 20 : 12),
      Paddy: (season === "Kharif" ? 40 : 12) + (water === "High" ? 35 : water === "Medium" ? 22 : 5) + (soil === "Clay" ? 25 : soil === "Loamy" ? 22 : 10),
      Maize: (season === "Kharif" || season === "Zaid" ? 32 : 14) + (water === "Medium" || water === "High" ? 30 : 15) + (soil === "Loamy" ? 25 : 18),
      Cotton: (season === "Kharif" ? 40 : 10) + (water === "Low" || water === "Medium" ? 28 : 20) + (soil === "Sandy" || soil === "Loamy" ? 25 : 15),
    };
    const ranked = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
    const best = ranked[0];
    const alternatives = ranked.slice(1, 3).map((c) => `${c} (${Math.min(100, scores[c])}/100)`).join(", ");
    setResult({ best, score: Math.min(100, scores[best]), alternatives });
  }

  return (
    <article className="forecast-card">
      <div className="fc-head">
        <div><h3 className="fc-title">Crop Guide</h3><p className="fc-desc">Get a simple crop suitability score from season, water availability and soil type.</p></div>
        <span className="fc-badge badge-green">RECOMMENDER</span>
      </div>
      <div className="extra-controls">
        <div><label>Season</label>
          <select value={season} onChange={(e) => setSeason(e.target.value)}>
            <option>Kharif</option><option>Rabi</option><option>Zaid</option>
          </select>
        </div>
        <div><label>Water availability</label>
          <select value={water} onChange={(e) => setWater(e.target.value)}>
            <option>High</option><option>Medium</option><option>Low</option>
          </select>
        </div>
        <div><label>Soil</label>
          <select value={soil} onChange={(e) => setSoil(e.target.value)}>
            <option>Loamy</option><option>Clay</option><option>Sandy</option>
          </select>
        </div>
      </div>
      <button className="extra-btn" onClick={calc}>Recommend crop</button>
      <div className="extra-result">
        {!result && "Choose conditions to receive a recommendation."}
        {result && (
          <>
            <span className="advisor-badge">Best match</span> <b>{result.best}</b><br />
            Suitability: <b>{result.score}/100</b><br />
            Based on {season}, {water.toLowerCase()} water and {soil.toLowerCase()} soil.<br />
            <b>Other matches:</b> {result.alternatives}
          </>
        )}
      </div>
    </article>
  );
}

export function TransportPlanner() {
  const [distance, setDistance] = useState(45);
  const [load, setLoad] = useState(50);
  const [rate, setRate] = useState(35);
  const [price, setPrice] = useState(2340);
  const [result, setResult] = useState(null);

  function calc() {
    if (distance <= 0 || load <= 0 || rate < 0 || price < 0) {
      setResult({ error: true });
      return;
    }
    const cost = distance * rate;
    const gross = load * price;
    const net = gross - cost;
    const perQ = net / load;
    setResult({ cost, gross, net, perQ });
  }

  return (
    <article className="forecast-card">
      <div className="fc-head">
        <div><h3 className="fc-title">Transport Planner</h3><p className="fc-desc">Estimate transport cost and compare net earnings after delivery.</p></div>
        <span className="fc-badge badge-gold">LOGISTICS</span>
      </div>
      <div className="extra-controls">
        <Field label="Distance (km)" value={distance} onChange={setDistance} min={1} />
        <Field label="Load (quintal)" value={load} onChange={setLoad} min={1} />
        <Field label="Rate (₹/km)" value={rate} onChange={setRate} min={0} step={0.5} />
        <Field label="Mandi price (₹/qtl)" value={price} onChange={setPrice} min={0} />
      </div>
      <button className="extra-btn" onClick={calc}>Calculate net value</button>
      <div className="extra-result">
        {!result && "Transport-adjusted earnings will appear here."}
        {result?.error && <span className="bad">Please check your inputs.</span>}
        {result && !result.error && (
          <>
            <b>Transport cost:</b> {money(result.cost)}<br />
            <b>Gross value:</b> {money(result.gross)}<br />
            <b className={result.net >= 0 ? "good" : "bad"}>Net value {money(result.net)}</b> &nbsp; ({money(result.perQ)}/qtl)
          </>
        )}
      </div>
    </article>
  );
}
