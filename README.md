# AgriMarket AI

## Fixed in this pass (see CHANGES.md for details)
`ml-service/models/price_xgb_*.pkl` were corrupted/version-incompatible pickles: on reload they
predicted ~₹330 for prices that should be ~₹2,700, and used recursively (as the app does for
multi-day forecasts) this diverged into negative prices within days. All price models
(ARIMA/XGBoost/LSTM, all 4 crops) were retrained and re-saved in a clean environment; this is
already done for you — the `models/` folder in this package is the fixed one. Everything else
(backend, frontend, demand model) checked out working as-is.

## Structure
- `frontend/` — React (Vite) app. `npm install && npm run dev`
- `backend/` — Express API. `npm install && npm run start` (needs MongoDB + the ML service running)
- `ml-service/` — FastAPI ML service. `pip install -r requirements.txt`, then generate data + train once, then serve.

## First-time setup (run in this order)

### 1. ML service
```
cd ml-service
pip install -r requirements.txt
python preprocessing/generate_synthetic_data.py   # writes datasets/*.csv (SYNTHETIC — see note below)
python training/train_price.py                    # trains + saves LSTM/ARIMA/XGBoost per crop
python training/train_demand.py                   # trains + saves Random Forest demand model per crop
uvicorn app:app --host 0.0.0.0 --port 8000
```

### 2. Backend
```
cd backend
cp .env.example .env         # fill in MONGO_URI, a real JWT_SECRET, and GEMINI_API_KEY
npm install
npm run start                # http://localhost:5000
```
Needs a real MongoDB instance — local install, Docker (`docker run -p 27017:27017 mongo`), or a free MongoDB Atlas cluster. This was NOT run against a live database in the build environment (no MongoDB available there) — please verify this leg yourself. `GEMINI_API_KEY` (a key from aistudio.google.com/apikey — new keys start with `AQ.`, older ones with `AIza`; both work) is only needed for the AI Assistant chat — everything else works without it.

### 3. Frontend
```
cd frontend
cp .env.example .env         # VITE_API_URL, defaults to http://localhost:5000/api
npm install
npm run dev
```

## Important: synthetic data
`ml-service/datasets/*.csv` are SYNTHETIC — generated with realistic seasonality/trend/noise, not real mandi prices. The training and inference pipeline (feature engineering, train/val/test split, ARIMA/XGBoost/LSTM, saved models, FastAPI serving) is fully real and will work identically once you replace the CSVs with real data matching the documented column schema (see top of `generate_synthetic_data.py`).

## What's built (Phase 1)
- Auth: register/login/JWT/bcrypt, MongoDB User model
- Price forecasting: LSTM + ARIMA + XGBoost, real train/test metrics, `/predict/price`
- Demand forecasting: Random Forest, `/predict/demand`
- Dashboard: Crop Forecasting, Demand Forecasting, Model Comparison, Storage Planner, Expense/Profit Tracker, Loan EMI Calculator, Crop Guide, Transport Planner, My Account — all wired to real backend/ML calls or real client-side math (no mock data)
- Weather proxy endpoint (Open-Meteo, no key needed) — backend only, no dashboard card yet
- Price alerts CRUD API — backend only, no dashboard UI yet

## AI Assistant (agentic, Gemini-powered)
A chat assistant lives in the dashboard ("AI Assistant" tab, and on Overview). It's a real
agentic loop, not a scripted chatbot: it calls tools to look things up and take action, and
decides for itself which tools to use and when.

- **Backend:** `backend/services/agentService.js` runs the loop against the Google Gemini API
  (`@google/genai`) with tools defined in `backend/services/agentTools.js`. Conversation
  history is persisted per user in Mongo (`AgentConversation` model) so it survives across
  sessions. Routes: `POST /api/agent/chat`, `GET /api/agent/history`, `DELETE /api/agent/history`,
  `POST /api/agent/check-alerts` — all under `requireAuth`.
- **Tools available to the agent:** `get_price_forecast`, `get_demand_forecast`, `get_weather`,
  `create_price_alert`, `list_price_alerts`, `check_alerts_now`. It only creates an alert when
  the farmer has actually asked for one — see the system prompt in `agentService.js`.
- **Setup:** set `GEMINI_API_KEY` in `backend/.env` (get one at
  aistudio.google.com/apikey). Optionally set `GEMINI_MODEL` (defaults to `gemini-2.5-flash`).
  Without a key, the chat endpoint returns a clear 503 rather than crashing.
- **Frontend:** `frontend/src/components/AgentChat.jsx` — a chat bubble UI with starter
  suggestions and small "Checked price forecast" / "Created a price alert" notes under
  assistant replies so it's clear when the agent acted rather than just talked.

### Background automation (Phase 2 — built, off by default)
`backend/services/agentAutomation.js` can sweep every user's active price alerts against the
latest forecast and log a notification (reusing the existing `User.activity` feed) when one
triggers. It's callable right now via the agent's `check_alerts_now` tool or
`POST /api/agent/check-alerts`. To turn on the fully automatic hourly sweep, set
`ENABLE_ALERT_CRON=true` in `backend/.env` — no code changes needed; `server.js` wires up
`node-cron` for you when that flag is on.

## Not built yet (Phase 2 candidates)
- Crop recommendation model (section 7 of original spec)
- Profit prediction regression model (section 8)
- Sell/Wait recommendation logic (section 9)
- Market/location comparison across mandis (section 10)
- Demand-supply opportunity analysis (section 14)
- Frontend UI for price alerts and weather
- Multi-language (en/hi/pa/bn) — original static site had this; not ported
