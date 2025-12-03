import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

// ------------------------------
// ENVIRONMENT CONFIG
// ------------------------------
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = "cricbuzz-cricket.p.rapidapi.com";
const BASE = "https://cricbuzz-cricket.p.rapidapi.com";

// ------------------------------
// GLOBAL CACHE (prevents 429)
// ------------------------------
let CACHE = {
  live: { data: [], ts: 0 },
  recent: { data: [], ts: 0 },
  upcoming: { data: [], ts: 0 },
  scorecard: {},
};

const CACHE_TTL = 30 * 1000; // 30 seconds

function isFresh(ts) {
  return Date.now() - ts < CACHE_TTL;
}

// ------------------------------
// GENERIC FETCH WRAPPER
// ------------------------------
async function rapidFetch(path) {
  const url = `${BASE}${path}`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
    });

    if (!res.ok) {
      return { error: true, status: res.status };
    }

    const json = await res.json();
    return { error: false, json };
  } catch (err) {
    return { error: true, status: 500, message: err.message };
  }
}

// ------------------------------
// LIVE MATCHES
// ------------------------------
app.get("/live", async (req, res) => {
  if (isFresh(CACHE.live.ts)) {
    return res.json({ live: CACHE.live.data, cached: true });
  }

  // MAIN source
  let main = await rapidFetch("/matches/v1/live");

  // fallback source (if 404 or empty)
  if (main.error || !main.json?.typeMatches?.length) {
    main = await rapidFetch("/matches/v1/live?status=all");
  }

  if (main.error) {
    return res.json({ live: [], error: true, code: main.status });
  }

  const list = main.json.typeMatches || [];

  CACHE.live = { data: list, ts: Date.now() };

  return res.json({
    live: list,
    count: list.length,
    updated: Date.now(),
  });
});

// ------------------------------
// UPCOMING MATCHES
// ------------------------------
app.get("/upcoming", async (req, res) => {
  if (isFresh(CACHE.upcoming.ts)) {
    return res.json({ upcoming: CACHE.upcoming.data, cached: true });
  }

  let main = await rapidFetch("/matches/v1/upcoming");

  if (main.error || !main.json?.typeMatches?.length) {
    main = await rapidFetch("/matches/v1/schedule");
  }

  if (main.error) {
    return res.json({ upcoming: [], error: true, code: main.status });
  }

  const list = main.json.typeMatches || [];

  CACHE.upcoming = { data: list, ts: Date.now() };

  return res.json({
    upcoming: list,
    count: list.length,
    updated: Date.now(),
  });
});

// ------------------------------
// RECENT MATCHES
// ------------------------------
app.get("/recent", async (req, res) => {
  if (isFresh(CACHE.recent.ts)) {
    return res.json({ recent: CACHE.recent.data, cached: true });
  }

  let main = await rapidFetch("/matches/v1/recent");

  if (main.error || !main.json?.typeMatches?.length) {
    main = await rapidFetch("/matches/v1/results");
  }

  if (main.error) {
    return res.json({ recent: false, error: true, code: main.status });
  }

  const list = main.json.typeMatches || [];

  CACHE.recent = { data: list, ts: Date.now() };

  return res.json({
    recent: list,
    count: list.length,
    updated: Date.now(),
  });
});

// ------------------------------
// SCORECARD (RapidAPI v2 endpoint ONLY)
// ------------------------------
app.get("/scorecard", async (req, res) => {
  const id = req.query.id;
  if (!id) {
    return res.json({
      scorecard: false,
      error: true,
      message: "Missing id"
    });
  }

  // Cache check
  if (CACHE.scorecard[id] && isFresh(CACHE.scorecard[id].ts)) {
    return res.json(CACHE.scorecard[id].data);
  }

  // Only working endpoint for your RapidAPI plan
  const data = await rapidFetch(`/matches/get-scorecard-v2?matchId=${id}`);

  if (data.error || !data.json) {
    return res.json({
      scorecard: false,
      error: true,
      message: "Error fetching scorecard",
      details: data.status
    });
  }

  const payload = {
    scorecard: data.json,
    updated: Date.now()
  };

  CACHE.scorecard[id] = { data: payload, ts: Date.now() };

  return res.json(payload);
});

// ------------------------------
// RUN SERVER
// ------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("CRICAI Proxy running on port", PORT);
});
