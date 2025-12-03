// ======================================================================
// CRICAI FULL PROXY SERVER (RapidAPI Stable Version + Fallback Cache)
// ======================================================================

import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ======================================================================
// ENVIRONMENT VARIABLES
// ======================================================================
const RAPID_KEY = process.env.RAPIDAPI_KEY;
const RAPID_HOST = process.env.RAPIDAPI_HOST || "cricket-live-data.p.rapidapi.com";
const RAPID_BASE = process.env.RAPIDAPI_BASE || "https://cricket-live-data.p.rapidapi.com";

if (!RAPID_KEY) {
  console.log("❌ Missing RAPIDAPI_KEY");
}

// ======================================================================
// CACHE SYSTEM FOR FALLBACKS
// ======================================================================
let CACHE = {
  live: null,
  upcoming: null,
  recent: null,
  scorecard: {} // scorecard[id] = cached data
};

// Helper to call RapidAPI safely
async function callRapidAPI(endpoint, params = {}) {
  const url = `${RAPID_BASE}${endpoint}`;
  
  try {
    const response = await axios.get(url, {
      params,
      headers: {
        "X-RapidAPI-Key": RAPID_KEY,
        "X-RapidAPI-Host": RAPID_HOST
      }
    });
    return { ok: true, data: response.data };
  } catch (err) {
    return { ok: false, error: err?.response?.status || err.message };
  }
}

// ======================================================================
// HOME ROUTE
// ======================================================================
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "CRICAI Proxy Server",
    time: Date.now()
  });
});

// ======================================================================
// LIVE MATCHES (with fallback)
// ======================================================================
app.get("/live", async (req, res) => {
  const api = await callRapidAPI("/match/live");

  if (api.ok) {
    CACHE.live = api.data;
    return res.json(api.data);
  }

  // FALLBACK
  if (CACHE.live) {
    return res.json({
      live: CACHE.live,
      error: true,
      message: "Live API failed — serving cached data.",
      lastUpdated: Date.now()
    });
  }

  return res.status(500).json({
    live: false,
    error: true,
    message: "Unexpected error fetching live matches.",
    details: api.error
  });
});

// ======================================================================
// UPCOMING MATCHES (with fallback)
// ======================================================================
app.get("/upcoming", async (req, res) => {
  const api = await callRapidAPI("/match/upcoming");

  if (api.ok) {
    CACHE.upcoming = api.data;
    return res.json(api.data);
  }

  // FALLBACK
  if (CACHE.upcoming) {
    return res.json({
      upcoming: CACHE.upcoming,
      error: true,
      message: "Upcoming API failed — serving cached data.",
      lastUpdated: Date.now()
    });
  }

  return res.status(500).json({
    upcoming: false,
    error: true,
    message: "Unexpected error fetching upcoming matches.",
    details: api.error
  });
});

// ======================================================================
// RECENT MATCHES (with fallback)
// ======================================================================
app.get("/recent", async (req, res) => {
  const api = await callRapidAPI("/match/recent");

  if (api.ok) {
    CACHE.recent = api.data;
    return res.json(api.data);
  }

  // FALLBACK
  if (CACHE.recent) {
    return res.json({
      recent: CACHE.recent,
      error: true,
      message: "Recent API failed — serving cached data.",
      lastUpdated: Date.now()
    });
  }

  return res.status(500).json({
    recent: false,
    error: true,
    message: "Unexpected error fetching recent matches.",
    details: api.error
  });
});

// ======================================================================
// SCORECARD (with per-match fallback)
// ======================================================================
app.get("/scorecard", async (req, res) => {
  const matchId = req.query.id;

  if (!matchId) {
    return res.status(400).json({ error: "matchId is required" });
  }

  const api = await callRapidAPI("/match/scorecard", { matchId });

  if (api.ok) {
    CACHE.scorecard[matchId] = api.data;
    return res.json(api.data);
  }

  // FALLBACK
  if (CACHE.scorecard[matchId]) {
    return res.json({
      scorecard: CACHE.scorecard[matchId],
      error: true,
      message: "Scorecard API failed — serving cached data.",
      lastUpdated: Date.now()
    });
  }

  return res.status(500).json({
    scorecard: false,
    error: true,
    message: "Unexpected error fetching scorecard.",
    details: api.error
  });
});

// ======================================================================
// START SERVER
// ======================================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 CRICAI Proxy running on port ${PORT}`);
});
