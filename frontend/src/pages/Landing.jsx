import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import ChatFab from "../components/ChatFab";
import FarmScene from "../components/FarmScene";
import MandiTicker from "../components/MandiTicker";

const NAV_ITEMS = [
  { id: "problem", key: "nav.problem" },
  { id: "features", key: "nav.features" },
  { id: "demo", key: "nav.demo" },
  { id: "stack", key: "nav.stack" },
  { id: "flow", key: "nav.flow" },
  { id: "team", key: "nav.team" },
];

const CROP_DATA = {
  wheat: { past: [150, 140, 155, 130, 138, 105, 115, 95], future: [95, 80, 88, 60, 50], reco: "sell" },
  cotton: { past: [120, 128, 118, 132, 120, 140, 130, 120], future: [120, 132, 128, 142, 150], reco: "sell" },
  paddy: { past: [100, 108, 102, 112, 118, 110, 120, 128], future: [128, 118, 132, 140, 150], reco: "sell" },
  maize: { past: [90, 98, 92, 100, 95, 105, 98, 108], future: [108, 120, 112, 100, 90], reco: "wait" },
};
const CROPS = ["wheat", "cotton", "paddy", "maize"];
const REFERENCE_PRICE = { wheat: 2150, cotton: 6800, paddy: 1950, maize: 1850 };

function pathFromPoints(points, xStep, xStart) {
  return points.map((y, i) => (i === 0 ? "M" : "L") + (xStart + i * xStep) + "," + y).join(" ");
}

const FEATURE_MODULES = [
  {
    tone: undefined,
    tagKey: "features.tag.forecast",
    headKey: "features.mod1.h",
    items: [
      { nameKey: "features.f1.name", descKey: "features.f1.desc", tech: "LSTM · ARIMA · XGBoost" },
      { nameKey: "features.f2.name", descKey: "features.f2.desc", tech: "Time-Series ML" },
      { nameKey: "features.f3.name", descKey: "features.f3.desc", tech: "Python / ML" },
      { nameKey: "features.f4.name", descKey: "features.f4.desc", tech: "ML" },
      { nameKey: "features.f5.name", descKey: "features.f5.desc", tech: "ML + business rules" },
    ],
  },
  {
    tone: "market",
    tagKey: "features.tag.market",
    headKey: "features.mod2.h",
    items: [
      { nameKey: "features.f6.name", descKey: "features.f6.desc", tech: "MongoDB + APIs" },
      { nameKey: "features.f7.name", descKey: "features.f7.desc", tech: "Weather API" },
      { nameKey: "features.f8.name", descKey: "features.f8.desc", tech: "React + Charts" },
      { nameKey: "features.f9.name", descKey: "features.f9.desc", tech: "Python" },
      { nameKey: "features.f10.name", descKey: "features.f10.desc", tech: "Pandas + ML" },
    ],
  },
  {
    tone: "farmer",
    tagKey: "features.tag.farmer",
    headKey: "features.mod3.h",
    items: [
      { nameKey: "features.f11.name", descKey: "features.f11.desc", tech: "React.js" },
      { nameKey: "features.f12.name", descKey: "features.f12.desc", tech: "Node.js" },
      { nameKey: "features.f13.name", descKey: "features.f13.desc", tech: "Translation API" },
      { nameKey: "features.f14.name", descKey: "features.f14.desc", tech: "Speech Recognition" },
      { nameKey: "features.f15.name", descKey: "features.f15.desc", tech: "LLM / API" },
    ],
  },
  {
    tone: "admin",
    tagKey: "features.tag.admin",
    headKey: "features.mod4.h",
    items: [{ nameKey: "features.f16.name", descKey: "features.f16.desc", tech: "React + Node.js" }],
  },
];

const FLOW_STEPS = ["s1", "s2", "s3", "s4"];
const STACK_ITEMS = [
  { key: "s1", value: "Python" },
  { key: "s2", value: "Time-Series ML" },
  { key: "s3", value: "React.js" },
  { key: "s4", value: "Node.js" },
  { key: "s5", value: "MongoDB" },
  { key: "s6", value: "Pandas" },
  { key: "s7", value: "Weather API" },
  { key: "s8", value: "LLM / Speech" },
];

const INITIAL_MANDI_ROWS = [
  { mandi: "Khanna", price: 2180, distance: 12, trend: "+3.2%" },
  { mandi: "Ludhiana", price: 2210, distance: 28, trend: "+1.8%" },
  { mandi: "Rajpura", price: 2095, distance: 19, trend: "-0.6%" },
  { mandi: "Patiala", price: 2150, distance: 35, trend: "+2.1%" },
];

export default function Landing() {
  const { t, fmt } = useLanguage();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const els = document.querySelectorAll(".problem-card, .module, .demo-card, .flow-step, .stack-item, .section-head, .team-band > *");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => { el.classList.add("reveal"); io.observe(el); });
    return () => io.disconnect();
  }, []);

  const [activeCrop, setActiveCrop] = useState("wheat");
  const cropInfo = CROP_DATA[activeCrop];
  const futureXStep = 160 / (cropInfo.future.length - 1);

  const [calcCrop, setCalcCrop] = useState("wheat");
  const [calcPrice, setCalcPrice] = useState("");
  const [calcResult, setCalcResult] = useState(null);

  function runCalc() {
    const price = parseFloat(calcPrice);
    if (!price || price <= 0) {
      setCalcResult({ empty: true, detailText: t("calc.detail.enterPrice") });
      return;
    }
    const ref = REFERENCE_PRICE[calcCrop];
    const diffPct = ((price - ref) / ref) * 100;
    const sell = diffPct >= -3;
    const pctText = Math.abs(diffPct).toFixed(1) + "%";
    const cropName = t("crop." + calcCrop);
    const vals = { price, ref, pct: pctText, crop: cropName };
    const detailText = sell
      ? fmt(diffPct >= 0 ? t("calc.detail.sellAbove") : t("calc.detail.sellWithin"), vals)
      : fmt(t("calc.detail.hold"), vals);
    setCalcResult({ sell, verdictText: sell ? t("calc.verdict.sell") : t("calc.verdict.hold"), detailText });
  }

  const [mandiRows, setMandiRows] = useState(INITIAL_MANDI_ROWS);
  const [sortState, setSortState] = useState({ key: null, dir: 1 });
  const maxPrice = Math.max(...mandiRows.map((r) => r.price));

  function sortBy(key) {
    const dir = sortState.key === key ? -sortState.dir : 1;
    setSortState({ key, dir });
    const sorted = [...mandiRows].sort((a, b) => {
      let va = a[key];
      let vb = b[key];
      if (key === "trend") {
        va = parseFloat(va);
        vb = parseFloat(vb);
      }
      if (typeof va === "string") return va.localeCompare(vb) * dir;
      return (va - vb) * dir;
    });
    setMandiRows(sorted);
  }

  const [alertPrice, setAlertPrice] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [alertSaved, setAlertSaved] = useState(false);

  function submitAlert(e) {
    e.preventDefault();
    const val = parseFloat(alertPrice);
    if (!val || val <= 0) return;
    setAlerts((a) => [...a, { crop: "wheat", price: val }]);
    setAlertPrice("");
    setAlertSaved(true);
    setTimeout(() => setAlertSaved(false), 3000);
  }

  function removeAlert(idx) {
    setAlerts((a) => a.filter((_, i) => i !== idx));
  }

  function scrollTo(id) {
    setNavOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div>
      <header className="nav">
        <div className="nav-inner">
          <div className="brand">
            <svg className="brand-mark" viewBox="0 0 28 28" fill="none">
              <path
                d="M14 25C14 25 5 20.5 5 12.5C5 7.8 8.6 4 13 4C13 4 14 9 14 14C14 9 15 4 15 4C19.4 4 23 7.8 23 12.5C23 20.5 14 25 14 25Z"
                fill="#d3a542"
              />
            </svg>
            AgriMarket AI
          </div>
          <nav className={"nav-links" + (navOpen ? " open" : "")}>
            {NAV_ITEMS.map((item) => (
              <button key={item.id} type="button" onClick={() => scrollTo(item.id)}>
                {t(item.key)}
              </button>
            ))}
          </nav>
          <div className="nav-right">
            <div className="auth-group">
              <Link to="/login" className="btn-outline-auth">
                {t("auth.login")}
              </Link>
              <Link to="/login" className="nav-cta">
                {t("auth.register")}
              </Link>
            </div>
            <button
              className="nav-toggle"
              aria-label="Open menu"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((o) => !o)}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      <section className="hero" style={{ borderBottom: "none", paddingBottom: 0 }}>
        <FarmScene />
        <div className="hero-inner">
          <div>
            <div className="hero-eyebrow">
              <span className="dot"></span> <span>{t("hero.eyebrow")}</span>
            </div>
            <h1>{t("hero.h1")}</h1>
            <p className="hero-sub">{t("hero.sub")}</p>
            <div className="hero-actions">
              <button type="button" className="btn-primary" onClick={() => scrollTo("demo")}>
                {t("hero.cta1")}
              </button>
              <button type="button" className="btn-ghost" onClick={() => scrollTo("flow")}>
                {t("hero.cta2")}
              </button>
            </div>
          </div>

          <div className="hero-chart-box">
            <div className="hero-chart-top">
              <div className="crop-select" role="group" aria-label="Choose a crop">
                {CROPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={activeCrop === c ? "active" : ""}
                    onClick={() => setActiveCrop(c)}
                  >
                    {t("crop." + c)}
                  </button>
                ))}
              </div>
            </div>
            <div className="hero-chart-label">
              <span>{t("crop." + activeCrop + ".chartLabel")}</span>
              <span>90-DAY FORECAST</span>
            </div>
            <svg viewBox="0 0 460 220" width="100%" style={{ overflow: "visible" }}>
              <line x1="0" y1="55" x2="460" y2="55" stroke="rgba(233,220,179,0.12)" strokeWidth="1" />
              <line x1="0" y1="110" x2="460" y2="110" stroke="rgba(233,220,179,0.12)" strokeWidth="1" />
              <line x1="0" y1="165" x2="460" y2="165" stroke="rgba(233,220,179,0.12)" strokeWidth="1" />
              <line x1="300" y1="0" x2="300" y2="200" stroke="rgba(233,220,179,0.18)" strokeWidth="1" strokeDasharray="3 4" />
              <path
                d={pathFromPoints(cropInfo.past, 300 / 7, 0)}
                fill="none"
                stroke="#e9dcb3"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pathFromPoints(cropInfo.future, futureXStep, 300)}
                fill="none"
                stroke="#f4a41c"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="1 7"
              />
              <circle cx="300" cy="95" r="4" fill="#f4efe1" />
              <circle cx="460" cy={cropInfo.future[cropInfo.future.length - 1]} r="4" fill="#f4a41c" />
              <text x="0" y="200" fill="rgba(233,220,179,0.45)" fontFamily="IBM Plex Mono" fontSize="10">
                TODAY -90D
              </text>
              <text x="270" y="200" fill="rgba(233,220,179,0.45)" fontFamily="IBM Plex Mono" fontSize="10">
                TODAY
              </text>
              <text x="405" y="200" fill="#f4a41c" fontFamily="IBM Plex Mono" fontSize="10">
                +90D EST.
              </text>
            </svg>
            <div className="hero-reco">
              <span className={"badge" + (cropInfo.reco !== "sell" ? " wait" : "")}>
                {cropInfo.reco === "sell" ? t("badge.sell") : t("badge.hold")}
              </span>
              <span>{t("crop." + activeCrop + ".recoText")}</span>
            </div>
          </div>
        </div>

        <div className="wrap">
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="num">16</div>
              <div className="lbl">{t("hero.stat1")}</div>
            </div>
            <div className="hero-stat">
              <div className="num">3</div>
              <div className="lbl">{t("hero.stat2")}</div>
            </div>
            <div className="hero-stat">
              <div className="num">4</div>
              <div className="lbl">{t("hero.stat3")}</div>
            </div>
            <div className="hero-stat">
              <div className="num">1</div>
              <div className="lbl">{t("hero.stat4")}</div>
            </div>
          </div>
        </div>
      </section>

      <MandiTicker />

      <section id="problem">
        <div className="wrap">
          <div className="section-head">
            <div className="section-num">{t("problem.num")}</div>
            <div>
              <h2>{t("problem.h2")}</h2>
              <p>{t("problem.p")}</p>
            </div>
          </div>
          <div className="problem-grid">
            {["c1", "c2", "c3"].map((c, i) => (
              <div className="problem-card" key={c}>
                <div className="fig">{["₹", "?", "◷"][i]}</div>
                <h3>{t("problem." + c + ".h")}</h3>
                <p>{t("problem." + c + ".p")}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features">
        <div className="wrap">
          <div className="section-head">
            <div className="section-num">{t("features.num")}</div>
            <div>
              <h2>{t("features.h2")}</h2>
              <p>{t("features.p")}</p>
            </div>
          </div>

          {FEATURE_MODULES.map((mod, i) => (
            <div className="module" data-tone={mod.tone} key={i}>
              <div className="module-head">
                <span className="tag">{t(mod.tagKey)}</span>
                <h3>{t(mod.headKey)}</h3>
              </div>
              {mod.items.map((it) => (
                <div className="feature-row" key={it.nameKey}>
                  <div className="feature-name">{t(it.nameKey)}</div>
                  <div className="feature-desc">{t(it.descKey)}</div>
                  <div className="feature-tech">{it.tech}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section id="demo" className="demo-band">
        <div className="wrap">
          <div className="section-head">
            <div className="section-num">{t("demo.num")}</div>
            <div>
              <h2>{t("demo.h2")}</h2>
              <p>{t("demo.p")}</p>
            </div>
          </div>
          <div className="demo-grid">
            <div className="demo-card">
              <h3>{t("demo.c1.title")}</h3>
              <p className="demo-note">{t("demo.c1.note")}</p>
              <div className="field-row">
                <label htmlFor="calcCrop">{t("demo.c1.cropLabel")}</label>
                <select id="calcCrop" value={calcCrop} onChange={(e) => setCalcCrop(e.target.value)}>
                  {CROPS.map((c) => (
                    <option key={c} value={c}>
                      {t("crop." + c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <label htmlFor="calcPrice">{t("demo.c1.priceLabel")}</label>
                <input
                  type="number"
                  id="calcPrice"
                  placeholder={t("demo.c1.pricePh")}
                  min="1"
                  value={calcPrice}
                  onChange={(e) => setCalcPrice(e.target.value)}
                />
              </div>
              <button className="demo-btn" type="button" onClick={runCalc}>
                {t("demo.c1.btn")}
              </button>
              {calcResult && (
                <div className={"result-box show" + (calcResult.sell === false ? " hold" : "")}>
                  <div
                    className="verdict"
                    style={{ color: calcResult.empty ? undefined : calcResult.sell ? "var(--field-green)" : "var(--clay)" }}
                  >
                    {calcResult.empty ? "—" : calcResult.verdictText}
                  </div>
                  <div>{calcResult.detailText}</div>
                </div>
              )}
            </div>

            <div className="demo-card">
              <h3>{t("demo.c2.title")}</h3>
              <p className="demo-note">{t("demo.c2.note")}</p>
              <table className="compare-table">
                <thead>
                  <tr>
                    {[
                      ["mandi", "demo.c2.thMandi"],
                      ["price", "demo.c2.thPrice"],
                      ["distance", "demo.c2.thDistance"],
                      ["trend", "demo.c2.thTrend"],
                    ].map(([key, key18n]) => (
                      <th key={key} onClick={() => sortBy(key)} style={{ cursor: "pointer" }}>
                        {t(key18n)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mandiRows.map((r) => {
                    const isBest = r.price === maxPrice;
                    const trendColor = r.trend.indexOf("-") === 0 ? "var(--berry)" : "var(--field-green)";
                    return (
                      <tr key={r.mandi}>
                        <td>
                          {r.mandi} {isBest && <span title={t("table.bestPrice")}>★</span>}
                        </td>
                        <td className={isBest ? "best" : ""}>₹{r.price.toLocaleString("en-IN")}</td>
                        <td>{r.distance}</td>
                        <td style={{ color: trendColor }}>{r.trend}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <p className="demo-note" style={{ marginTop: 22, marginBottom: 8 }}>
                {t("demo.c2.alertNote")}
              </p>
              <form style={{ display: "flex", gap: 8, flexWrap: "wrap" }} onSubmit={submitAlert}>
                <input
                  type="number"
                  placeholder={t("demo.c2.alertPh")}
                  min="1"
                  required
                  value={alertPrice}
                  onChange={(e) => setAlertPrice(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 140,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(26,31,22,0.18)",
                    fontFamily: "'Inter',sans-serif",
                  }}
                />
                <button className="demo-btn" type="submit">
                  {t("demo.c2.alertBtn")}
                </button>
              </form>
              {alertSaved && <div className="form-msg show">{t("demo.c2.alertMsg")}</div>}
              <div className="alert-list">
                {alerts.map((a, i) => (
                  <div className="alert-chip" key={i}>
                    <span>{fmt(t("alert.chipText"), { crop: t("crop." + a.crop), price: a.price })}</span>
                    <button type="button" onClick={() => removeAlert(i)}>
                      {t("alert.remove")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="flow">
        <div className="wrap">
          <div className="section-head">
            <div className="section-num">{t("flow.num")}</div>
            <div>
              <h2>{t("flow.h2")}</h2>
              <p>{t("flow.p")}</p>
            </div>
          </div>
          <div className="flow">
            {FLOW_STEPS.map((s) => (
              <div className="flow-step" key={s}>
                <div className="idx">{t("flow." + s + ".idx")}</div>
                <h4>{t("flow." + s + ".h")}</h4>
                <p>{t("flow." + s + ".p")}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="stack" className="stack-band">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div className="section-num" style={{ color: "var(--harvest-gold)" }}>
              {t("stack.num")}
            </div>
            <div>
              <h2 style={{ color: "var(--wheat)" }}>{t("stack.h2")}</h2>
              <p style={{ color: "rgba(233,220,179,0.65)" }}>{t("stack.p")}</p>
            </div>
          </div>
          <div className="stack-grid">
            {STACK_ITEMS.map((s) => (
              <div className="stack-item" key={s.key}>
                <div className="k">{t("stack." + s.key + ".k")}</div>
                <div className="v">{s.value}</div>
                <div className="d">{t("stack." + s.key + ".d")}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="team">
        <div className="wrap">
          <div className="team-band">
            <div>
              <div className="section-num">{t("team.num")}</div>
              <h2 style={{ marginTop: 8 }}>AgriMarket AI</h2>
              <p style={{ marginTop: 14, color: "rgba(26,31,22,0.68)", lineHeight: 1.65, maxWidth: "46ch" }}>
                {t("team.intro")}
              </p>
            </div>
            <div>
              <div className="info-line">
                <span className="k">{t("team.k.project")}</span>
                <span className="v">AgriMarket AI</span>
              </div>
              <div className="info-line">
                <span className="k">{t("team.k.category")}</span>
                <span className="v">{t("team.v.category")}</span>
              </div>
              <div className="info-line">
                <span className="k">{t("team.k.format")}</span>
                <span className="v">{t("team.v.format")}</span>
              </div>
              <div className="info-line">
                <span className="k">{t("team.k.stack")}</span>
                <span className="v">Python · React.js · Node.js · MongoDB</span>
              </div>
              <div className="info-line">
                <span className="k">{t("team.k.modeling")}</span>
                <span className="v">Time-Series ML</span>
              </div>
              <div className="info-line">
                <span className="k">{t("team.k.status")}</span>
                <span className="v">{t("team.v.status")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap footer-inner">
          <span>{t("footer.tagline")}</span>
          <span className="mono">2026</span>
        </div>
      </footer>

      <ChatFab />
    </div>
  );
}
