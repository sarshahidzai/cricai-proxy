import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = "cricbuzz-cricket.p.rapidapi.com";
const BASE = "https://cricbuzz-cricket.p.rapidapi.com";

// ----------- CACHE (avoid 429) -------------
let cache = {
  live: { data: [], ts: 0 },
  recent: { data: [], ts: 0 },
  upcoming: { data: [], ts: 0 },
  scorecard: {}, // scorecards cached individually
};

const ttl = 15000; // 15 seconds cache

async function safeFetch(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
    });

    if (res.status === 429) {
      return { error: true, code: 429 };
    }

    if (!res.ok) {
      return { error: true, code: res.status };
    }

    return await res.json();
  } catch (e) {
    return { error: true, code: 500, message: e.message };
  }
}

// ----------- LIVE MATCHES --------------
app.get("/live", async (req, res) => {
  if (Date.now() - cache.live.ts < ttl) {
    return res.json({ live: cache.live.data, cached: true });
  }

  const url = `${BASE}/matches/v1/live`;
  const data = await safeFetch(url);

  if (data.error) {
    return res.json({ live: [], error: true, code: data.code });
  }

  cache.live = { data: data.typeMatches || [], ts: Date.now() };
  res.json({ live: cache.live.data, updated: cache.live.ts });
});

// ----------- RECENT MATCHES --------------
app.get("/recent", async (req, res) => {
  if (Date.now() - cache.recent.ts < ttl) {
    return res.json({ recent: cache.recent.data, cached: true });
  }

  const url = `${BASE}/matches/v1/recent`;
  const data = await safeFetch(url);

  if (data.error) {
    return res.json({ recent: [], error: true, code: data.code });
  }

  cache.recent = { data: data.typeMatches || [], ts: Date.now() };
  res.json({ recent: cache.recent.data, updated: cache.recent.ts });
});

// ----------- UPCOMING MATCHES --------------
app.get("/upcoming", async (req, res) => {
  if (Date.now() - cache.upcoming.ts < ttl) {
    return res.json({ upcoming: cache.upcoming.data, cached: true });
  }

  const url = `${BASE}/matches/v1/upcoming`;
  const data = await safeFetch(url);

  if (data.error) {
    return res.json({ upcoming: [], error: true, code: data.code });
  }

  cache.upcoming = { data: data.typeMatches || [], ts: Date.now() };
  res.json({ upcoming: cache.upcoming.data, updated: cache.upcoming.ts });
});

// ----------- SCORECARD --------------------
app.get("/scorecard", async (req, res) => {
  const id = req.query.id;
  if (!id) return res.json({ error: true, message: "Missing id" });

  if (cache.scorecard[id] && Date.now() - cache.scorecard[id].ts < ttl) {
    return res.json({ scorecard: cache.scorecard[id].data, cached: true });
  }

  const url = `${BASE}/mcenter/v1/${id}/hscard`;
  const data = await safeFetch(url);

  if (data.error) {
    return res.json({ scorecard: false, error: true, code: data.code });
  }

  cache.scorecard[id] = { data, ts: Date.now() };
  res.json({ scorecard: data, updated: cache.scorecard[id].ts });
});

// -------------------------------
app.get("/", (req, res) => {
  res.send("CRICAI Proxy is running.");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
