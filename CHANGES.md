# Voice assistant (added)
- **Speak to ask:** mic button in the AI Assistant. Your words appear live in the box and are sent automatically
  when you stop talking. Uses the browser's built-in Web Speech API - no new packages or API keys.
- **Hear the answer:** "Read replies aloud" toggle, plus a "Listen" button on every reply. Numbers are spoken
  naturally (rupees, per quintal, percent) and markdown symbols are stripped.
- **Hands-free chat:** talk back and forth without touching the keyboard; it stops on silence or any error.
- **Languages:** English, Hindi, Punjabi, Bengali. The reply is read in the language it is written in.
- **Short spoken answers:** when a question comes by voice, the backend (`voice: true` on `/api/agent/chat`)
  tells Gemini to answer in about 3 short sentences with no bullets or markdown.
- Files: `frontend/src/components/voice.js` (new), `AgentChat.jsx`, `global.css`,
  `backend/services/agentService.js`, `backend/controllers/agentController.js`.
- Browser support: speaking to the assistant works in Chrome, Edge and Safari (not Firefox). Reading replies
  aloud works everywhere. The mic needs HTTPS or localhost and an internet connection.

---

# Chat assistant fixes + professional profile page

## AI assistant (backend/services/agentService.js, agentTools.js, controllers/agentController.js)
- **Broken history after ~15 chats:** history was trimmed with a raw `slice`, which could cut a
  functionCall/functionResponse pair in half. Gemini rejects that with a 400 on every later message, so the
  chat died permanently. We now persist only plain user/assistant text and rebuild valid history each request
  (legacy stored conversations are sanitised automatically).
- **`list_price_alerts` crashed the request:** Gemini requires `functionResponse.response` to be an object;
  the tool returned an array. Non-object results are now wrapped as `{ result: ... }`, and call ids are echoed back.
- **Huge tool payloads:** price forecasts returned ~200 data points per call into the model and the database.
  Tools now return headline numbers + a few sample points.
- **"AQ." keys:** AI Studio now issues `AQ.` keys; they are normal Gemini Developer API keys. (An earlier version of this
  patch wrongly sent them to Vertex AI.) All keys now use the Gemini API; Vertex only with `GEMINI_USE_VERTEX=true`.
  If a model name is not found (404), the assistant tries `gemini-3.5-flash` then `gemini-2.5-flash`.
- Default model fixed to `gemini-2.5-flash` (code said `gemini-3.5-flash`, docs/.env said 2.5).
- Retries on 503/429/500 (Gemini "overloaded"), specific error messages (bad key, wrong model, quota, busy,
  network) instead of a misleading "key looks invalid" for every 400, input length limit.
- New `GET /api/agent/status` so the UI can show a "not configured" banner instead of failing silently.
- The assistant replies in the farmer's language (en/hi/pa/bn) and formats with short bullets/bold.
- Chat UI: formatted replies, typing indicator, timestamps, tool chips, Enter-to-send, Retry on failure,
  quick-question chips, confirm before clearing.

## Profile page (frontend/src/components/AccountView.jsx)
- Rebuilt as a profile hub: header card, 5 stat tiles, and tabs — Overview, Forecast history, Price alerts,
  Activity log, Settings (edit name/phone/location, change password).
- New endpoints: `GET /api/auth/overview`, `PUT /api/auth/profile`, `PUT /api/auth/password`.
- History is now actually recorded: forecasts (stored as slim summaries), alerts created/deleted/triggered,
  assistant questions, profile changes. Activity feed is capped at 200 entries.

## Security note
`backend/.env` in the original zip contained a real-looking Gemini key. Rotate it and never share/commit `.env`.
`.env.example` now contains placeholders only.

---

# Audit, fixes & agentic AI — AgriMarket AI Phase 1

## Added: agentic AI assistant + API (this pass)
- New backend: `services/agentService.js` (Claude tool-use loop via `@anthropic-ai/sdk`),
  `services/agentTools.js` (6 tools: price/demand forecast, weather, create/list alerts,
  check-alerts-now), `services/agentAutomation.js` (alert-sweep logic used both on-demand and,
  optionally, on an hourly cron), `models/AgentConversation.js` (persists chat history per user),
  `controllers/agentController.js` + `routes/agentRoutes.js` mounted at `/api/agent`
  (`POST /chat`, `GET /history`, `DELETE /history`, `POST /check-alerts`, all authenticated).
- Refactored `weatherController.js` to share its Open-Meteo call with the new `get_weather`
  tool via `services/weatherService.js`, instead of duplicating the fetch logic.
- `Alert` model gained `triggered`, `triggeredAt`, `createdBy` fields so alerts the agent creates
  are distinguishable and don't re-fire after they trigger once.
- Background automation ships fully working but **off by default**
  (`ENABLE_ALERT_CRON=false` in `.env.example`) per your "background automation later" request —
  flip the flag when you're ready, no code changes needed.
- Frontend: new `components/AgentChat.jsx` chat UI (message history, starter suggestions,
  "tool used" notes under replies), added as its own "AI Assistant" tab and featured on Overview.
- Verified: all backend files pass `node --check`; all new modules `require()` cleanly; the
  tool-executor functions were run live against the (fixed) ml-service and returned correct
  data; frontend builds and lints clean with the new component. The live Claude round-trip
  itself (the actual `/api/agent/chat` call) needs your own `ANTHROPIC_API_KEY` to test — I
  don't have one in this sandbox — but it follows the standard Anthropic Messages API tool-use
  pattern and the tool layer it depends on is confirmed working.

---

# Audit & fixes — AgriMarket AI Phase 1

## What was checked
- `backend/`: syntax-checked every `.js` file, read every controller/route/model/middleware,
  cross-checked request/response shapes against the frontend's `api/` calls.
- `frontend/`: `npm install`, `npm run build` (vite), `npx oxlint` — all clean. Read every
  page/component and confirmed API wiring matches the backend routes.
- `ml-service/`: installed `requirements.txt`, ran the FastAPI service, and hit `/health`,
  `/predict/price` (all 3 models × all 4 crops × several horizons), `/predict/demand`
  (all 4 crops), and `/metrics/price` directly with curl.

## Bug found: XGBoost price forecasts were broken
**Symptom:** `/predict/price` with `model=XGBoost` (or `auto`, which resolves to XGBoost for
wheat/paddy/maize) returned nonsense — e.g. wheat forecast of **-₹349/quintal** on a current
price of ₹2,683, even at a 7-day horizon.

**Root cause:** the shipped `models/price_xgb_*.pkl` files were pickled with a different
XGBoost build than the one in `requirements.txt`/the runtime environment. This is a known
XGBoost footgun — reloading an `XGBRegressor` pickled by an incompatible version silently
produces a model with a corrupted `base_score`, so predictions come out shifted by a roughly
constant, wrong amount. It wasn't a recursive-forecast drift problem: even running the model on
real, in-distribution historical rows (the exact same kind of data it was evaluated on during
training) returned ~330 instead of ~2,700. ARIMA, LSTM, and the Random Forest demand model
were unaffected (different serialization paths).

**Fix:** re-ran `training/train_price.py` in this environment so every ARIMA/XGBoost/LSTM
model and `models/price_metrics.json` were regenerated fresh, using the exact package versions
pinned in `requirements.txt`. Verified afterwards that all 4 crops × 3 models × multiple
horizons return sane, bounded forecasts consistent with the historical price series.

**Lesson for going forward:** don't commit trained model binaries to source control /
zip archives across environments unless you pin and verify the exact serialization library
version on both ends. Safer options: re-train as part of setup (what the README already tells
you to do), or use `model.save_model()` (JSON/UBJ) instead of `joblib`/pickle for XGBoost,
which is version-stable.

## Everything else
No other functional bugs found. Minor cleanup only:
- Removed a stray empty directory `backend/{config,models,routes,controllers,middleware,services,utils}`
  and a matching one under `ml-service/` — leftover from a `mkdir {a,b,c}` typo during scaffolding,
  harmless but confusing.
- `node_modules/` and `frontend/dist/` were stripped before zipping (see run steps in README) —
  reinstall with `npm install`.

## Not re-verified live
MongoDB isn't installable/reachable in the sandbox this audit ran in, so the auth/alerts flows
were verified by full code review (request validation, bcrypt hashing, JWT signing/verification,
error handling) rather than a live end-to-end run. Everything reads correctly; connect a real
Mongo instance per the README and it should work as written. If you hit anything, it's most
likely a `.env` / connection-string issue, not application logic.

---

# Vibrant frontend refresh
- Fonts (Fraunces, Inter, IBM Plex Mono) are now loaded in `frontend/index.html` (they were referenced but never loaded).
- Removed a stale "simplified landing page" CSS block from `global.css` that squeezed the hero and overrode `.btn-primary`.
- New theme layer `frontend/src/styles/vibrant.css` (imported in `App.jsx`). Delete that import to revert the look.
- New components: `FarmScene.jsx` (SVG farm landscape), `MandiTicker.jsx` (sample price ticker).
- `Landing.jsx` (scene, ticker, scroll reveal), `AuthPage.jsx` (scene), `Dashboard.jsx` (greeting banner).
