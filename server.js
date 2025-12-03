import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Load RapidAPI info
const RAPID_KEY = process.env.RAPIDAPI_KEY;
const RAPID_HOST = process.env.RAPIDAPI_HOST || "cricbuzz-cricket.p.rapidapi.com";
const RAPID_BASE = process.env.RAPIDAPI_BASE || "https://cricbuzz-cricket.p.rapidapi.com";

// Local fallback cache
let CACHE = {
  live: null,
  upcoming: null,
  recent: null,
  scorecard: {}
};

// Safe wrapper for API calls
async function callAPI(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        "X-RapidAPI-Key": RAPID_KEY,
        "X-RapidAPI-Host": RAPID_HOST
      }
    });
    return { ok: true, data: response.data };
  } catch (err) {
    return { ok: false, code: err?.response?.status };
  }
}

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "CRICAI Proxy Server",
    time: Date.now()
  });
});

// ================= LIVE ==================
app.get("/live", async (req, res) => {
  const url = `${RAPID_BASE}/matches/v1/live`;
  const api = await callAPI(url);

  if (api.ok) {
    CACHE.live = api.data;
    return res.json(api.data);
  }

  if (CACHE.live) {
    return res.json({
      live: CACHE.live,
      error: true,
      message: "Live API failed, using cached result",
      code: api.code
    });
  }

  return res.status(500).json({
    live: false,
    error: true,
    message: "Failed to fetch live matches",
    code: api.code
  });
});

// ================= UPCOMING ==================
app.get("/upcoming", async (req, res) => {
  const url = `${RAPID_BASE}/matches/v1/upcoming`;
  const api = await callAPI(url);

  if (api.ok) {
    CACHE.upcoming = api.data;
    return res.json(api.data);
  }

  if (CACHE.upcoming) {
    return res.json({
      upcoming: CACHE.upcoming,
      error: true,
      message: "Upcoming API failed, using cached",
      code: api.code
    });
  }

  return res.status(500).json({
    upcoming: false,
    error: true,
    message: "Failed to fetch upcoming matches",
    code: api.code
  });
});

// ================= RECENT ==================
app.get("/recent", async (req, res) => {
  const url = `${RAPID_BASE}/matches/v1/recent`;
  const api = await callAPI(url);

  if (api.ok) {
    CACHE.recent = api.data;
    return res.json(api.data);
  }

  if (CACHE.recent) {
    return res.json({
      recent: CACHE.recent,
      error: true,
      message: "Recent API failed, using cached",
      code: api.code
    });
  }

  return res.status(500).json({
    recent: false,
    error: true,
    message: "Failed to fetch recent matches",
    code: api.code
  });
});

// ================= SCORECARD ==================
app.get("/scorecard", async (req, res) => {
  const matchId = req.query.id;
  if (!matchId) return res.status(400).json({ error: "matchId required" });

  const url = `${RAPID_BASE}/mcenter/v1/${matchId}/hscard`;
  const api = await callAPI(url);

  if (api.ok) {
    CACHE.scorecard[matchId] = api.data;
    return res.json(api.data);
  }

  if (CACHE.scorecard[matchId]) {
    return res.json({
      scorecard: CACHE.scorecard[matchId],
      error: true,
      message: "Scorecard API failed, using cached",
      code: api.code
    });
  }

  return res.status(500).json({
    scorecard: false,
    error: true,
    message: "Failed to fetch scorecard",
    code: api.code
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 CRICAI Proxy running on port ${PORT}`)
);
