const axios = require("axios");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

const client = axios.create({ baseURL: ML_SERVICE_URL, timeout: 15000 });

async function predictPrice({ crop, model = "auto", horizonDays = 90 }) {
  const { data } = await client.post("/predict/price", {
    crop,
    model,
    horizon_days: horizonDays,
  });
  return data;
}

async function predictDemand({ crop, horizonWeeks = 8 }) {
  const { data } = await client.post("/predict/demand", {
    crop,
    horizon_weeks: horizonWeeks,
  });
  return data;
}

module.exports = { predictPrice, predictDemand };
