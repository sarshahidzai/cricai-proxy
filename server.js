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

// --------------------------------------
// GET VALID MATCH IDs (for scorecard fallback)
// --------------------------------------
app.get("/match-ids", async (req, res) => {
  try {
    // Fetch recent matches
    let recent = await rapidFetch("/matches/v1/recent");
    if (recent.error) recent = await rapidFetch("/matches/v1/results");

    // Fetch upcoming matches
    let upcoming = await rapidFetch("/matches/v1/upcoming");
    if (upcoming.error) upcoming = await rapidFetch("/matches/v1/schedule");

    // Fetch live matches
    let live = await rapidFetch("/matches/v1/live");
    if (live.error) live = await rapidFetch("/matches/v1/live?status=all");

    // Extract match IDs from any dataset
    const extractIds = (json) => {
      if (!json || !json.typeMatches) return [];
      let out = [];

      json.typeMatches.forEach(tm => {
        if (!tm.seriesMatches) return;

        tm.seriesMatches.forEach(series => {
          if (!series.seriesAdWrapper || !series.seriesAdWrapper.matches) return;

          series.seriesAdWrapper.matches.forEach(m => {
            if (m.matchInfo?.matchId) {
              out.push({
                matchId: m.matchInfo.matchId,
                matchDesc: m.matchInfo.matchDesc,
                seriesName: m.matchInfo.seriesName,
                team1: m.matchInfo.team1?.teamName,
                team2: m.matchInfo.team2?.teamName
              });
            }
          });
        });
      });

      return out;
    };

    const ids = {
      live: extractIds(live.json),
      recent: extractIds(recent.json),
      upcoming: extractIds(upcoming.json),
    };

    return res.json({
      success: true,
      updated: Date.now(),
      ...ids
    });

  } catch (err) {
    return res.json({
      success: false,
      message: "Failed to load match IDs",
      error: err.message
    });
  }
});



// --------------------------------------
// SCORECARD (smart v1 → v2 fallback)
// --------------------------------------
app.get("/scorecard", async (req, res) => {
  const id = req.query.id;
  if (!id) return res.json({ error: true, message: "Missing match ID" });

  // Cached?
  if (CACHE.scorecard[id] && isFresh(CACHE.scorecard[id].ts)) {
    return res.json(CACHE.scorecard[id].data);
  }

  // ---- STEP 1: Try RapidAPI v1 endpoint
  let v1 = await rapidFetch(`/matches/v1/${id}/scorecard`);

  // ---- STEP 2: If v1 fails OR returns empty → Try RapidAPI v2
  let final = v1;
  if (v1.error || !v1.json) {
    final = await rapidFetch(`/matches/get-scorecard-v2?matchId=${id}`);
  }

  // ---- STEP 3: If BOTH fail → return descriptive error
  if (final.error || !final.json) {
    return res.json({
      scorecard: false,
      error: true,
      message: "Scorecard not available",
      details: final.status || "Unknown error",
    });
  }

  // ---- STEP 4: Save to cache
  const payload = {
    scorecard: final.json,
    updated: Date.now(),
    id,
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
