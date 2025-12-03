// ======================================================================
// CRICAI FULL PROXY SERVER (Stable RapidAPI Version)
// ======================================================================

import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ===================================================
// ENVIRONMENT VARIABLES
// ===================================================
const RAPID_KEY = process.env.RAPIDAPI_KEY;
const RAPID_HOST = "cricbuzz-cricket.p.rapidapi.com";

if (!RAPID_KEY) {
  console.log("❌ Missing RAPIDAPI_KEY – add it in Render Environment");
}

// ===================================================
// HOME ROUTE
// ===================================================
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "CRICAI Proxy Server",
    time: Date.now(),
  });
});

// ===================================================
// GENERIC RAPIDAPI FORWARDER
// ===================================================
async function rapidProxy(path, params = {}) {
  const url = `https://${RAPID_HOST}${path}`;

  const response = await axios.get(url, {
    params: params,
    headers: {
      "x-rapidapi-key": RAPID_KEY,
      "x-rapidapi-host": RAPID_HOST,
    }
  });

  return response.data;
}

// ===================================================
// LIVE MATCHES
// ===================================================
app.get("/live", async (req, res) => {
  try {
    const data = await rapidProxy("/matches/v1/live");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================================================
// UPCOMING MATCHES
// ===================================================
app.get("/upcoming", async (req, res) => {
  try {
    const data = await rapidProxy("/matches/v1/upcoming");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================================================
// SCORECARD
// Example: /scorecard?matchId=12345
// ===================================================
app.get("/scorecard", async (req, res) => {
  const matchId = req.query.matchId;

  if (!matchId) {
    return res.json({ error: "matchId is required" });
  }

  try {
    const data = await rapidProxy("/matches/v1/scorecard", { matchId });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================================================
// START SERVER
// ===================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 CRICAI Proxy running on port ${PORT}`);
});
