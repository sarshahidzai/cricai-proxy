// ======================================================
// CRICAI FULL PROXY SERVER (RapidAPI + Smart Cache + Meta)
// ======================================================

const express = require("express");
const axios = require("axios");
const cors = require("cors");

// ------------------------------------------------------
// ENVIRONMENT & AXIOS CLIENT
// ------------------------------------------------------
const PORT = process.env.PORT || 10000;
const RAPIDAPI_BASE =
  process.env.RAPIDAPI_BASE || "https://cricbuzz-cricket.p.rapidapi.com";
const RAPIDAPI_HOST =
  process.env.RAPIDAPI_HOST || "cricbuzz-cricket.p.rapidapi.com";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

if (!RAPIDAPI_KEY) {
  console.warn(
    "⚠️  Missing RAPIDAPI_KEY – please set it in Render Environment!"
  );
}

const api = axios.create({
  baseURL: RAPIDAPI_BASE,
  timeout: 8000,
  headers: {
    "x-rapidapi-host": RAPIDAPI_HOST,
    "x-rapidapi-key": RAPIDAPI_KEY,
  },
});

// ------------------------------------------------------
// SMART CACHE (OPTION A)
// ------------------------------------------------------
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const cacheStore = {}; // { [key]: { data, timestamp } }

function getCacheEntry(key) {
  const entry = cacheStore[key];
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  const isFresh = age < CACHE_TTL_MS;
  return { ...entry, isFresh, age };
}

async function fetchWithSmartCache(cacheKey, axiosConfig) {
  const cached = getCacheEntry(cacheKey);

  // 1️⃣ Fresh cache: return immediately
  if (cached && cached.isFresh) {
    return {
      data: cached.data,
      meta: {
        lastUpdated: cached.timestamp,
        fromCache: true,
        stale: false,
      },
    };
  }

  // 2️⃣ Try live RapidAPI request
  try {
    const response = await api.request(axiosConfig);
    const data = response.data;
    cacheStore[cacheKey] = { data, timestamp: Date.now() };

    return {
      data,
      meta: {
        lastUpdated: cacheStore[cacheKey].timestamp,
        fromCache: false,
        stale: false,
      },
    };
  } catch (err) {
    // 3️⃣ Fallback to stale cache if available
    if (cached) {
      const status = err.response?.status;
      const msg = status
        ? `Request failed with status code ${status}`
        : err.message || "Unknown error";

      return {
        data: cached.data,
        meta: {
          lastUpdated: cached.timestamp,
          fromCache: true,
          stale: true,
          error: msg,
        },
      };
    }

    // 4️⃣ No cache – bubble up error
    const status = err.response?.status;
    const msg = status
      ? `Request failed with status code ${status}`
      : err.message || "Unknown error";

    const error = new Error(msg);
    error.statusCode = status || 500;
    throw error;
  }
}

// ------------------------------------------------------
// META HELPERS (OPTION D)
// ------------------------------------------------------

// Safely parse number from string/number
function toNumber(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// --- Match list meta (live/recent/upcoming) --------------
function buildMatchListMeta(raw, cacheMeta) {
  const simplifiedMatches = [];

  if (Array.isArray(raw?.typeMatches)) {
    raw.typeMatches.forEach((tm) => {
      const seriesMatches = tm.seriesMatches || [];
      seriesMatches.forEach((sm) => {
        const wrapper = sm.seriesAdWrapper;
        if (!wrapper || !Array.isArray(wrapper.matches)) return;

        const seriesName = wrapper.seriesName;
        wrapper.matches.forEach((match) => {
          const info = match.matchInfo || {};
          const score = match.matchScore || {};
          const team1 = info.team1 || {};
          const team2 = info.team2 || {};

          const t1Score = score.team1Score?.inngs1 || {};
          const t2Score = score.team2Score?.inngs1 || {};

          const t1Runs = toNumber(t1Score.runs);
          const t1Overs = toNumber(t1Score.overs);
          const t2Runs = toNumber(t2Score.runs);
          const t2Overs = toNumber(t2Score.overs);

          const t1RR =
            t1Runs !== null && t1Overs && t1Overs > 0
              ? Number((t1Runs / t1Overs).toFixed(2))
              : null;
          const t2RR =
            t2Runs !== null && t2Overs && t2Overs > 0
              ? Number((t2Runs / t2Overs).toFixed(2))
              : null;

          simplifiedMatches.push({
            matchId: info.matchId,
            seriesName: seriesName || info.seriesName,
            matchDesc: info.matchDesc,
            matchFormat: info.matchFormat,
            state: info.state,
            status: info.status,
            startDate: info.startDate,
            endDate: info.endDate,
            venue: info.venueInfo?.ground,
            city: info.venueInfo?.city,
            team1: {
              id: team1.teamId,
              name: team1.teamName,
              shortName: team1.teamSName,
              score: {
                runs: t1Runs,
                wickets: toNumber(t1Score.wickets),
                overs: t1Overs,
                runRate: t1RR,
              },
            },
            team2: {
              id: team2.teamId,
              name: team2.teamName,
              shortName: team2.teamSName,
              score: {
                runs: t2Runs,
                wickets: toNumber(t2Score.wickets),
                overs: t2Overs,
                runRate: t2RR,
              },
            },
          });
        });
      });
    });
  }

  return {
    lastUpdated: cacheMeta.lastUpdated,
    cache: {
      fromCache: cacheMeta.fromCache,
      stale: cacheMeta.stale,
      error: cacheMeta.error || null,
      ttlMs: CACHE_TTL_MS,
    },
    matchCount: simplifiedMatches.length,
    matches: simplifiedMatches,
  };
}

// --- Scorecard meta (per match) ---------------------------
function buildScorecardMeta(raw, matchId, cacheMeta) {
  const inningsSummary = [];
  const topBatters = [];
  const topBowlers = [];

  if (Array.isArray(raw?.scorecard)) {
    raw.scorecard.forEach((inngs) => {
      const team = inngs.batTeamDetails?.batTeamName || "";
      const runs = toNumber(inngs.scoreDetails?.runs);
      const wickets = toNumber(inngs.scoreDetails?.wickets);
      const overs = toNumber(inngs.scoreDetails?.overs);

      const rr =
        runs !== null && overs && overs > 0
          ? Number((runs / overs).toFixed(2))
          : null;

      inningsSummary.push({
        inningsId: inngs.inningsId,
        team,
        runs,
        wickets,
        overs,
        runRate: rr,
      });

      // Batters
      const batList = inngs.batTeamDetails?.batsmenData || {};
      Object.values(batList).forEach((b) => {
        topBatters.push({
          name: b.batName,
          runs: toNumber(b.runs),
          balls: toNumber(b.balls),
          fours: toNumber(b.fours),
          sixes: toNumber(b.sixes),
          strikeRate: toNumber(b.strikeRate),
          outDesc: b.outDesc,
          team,
        });
      });

      // Bowlers
      const bowlList = inngs.bowlTeamDetails?.bowlersData || {};
      Object.values(bowlList).forEach((bo) => {
        topBowlers.push({
          name: bo.bowlName,
          overs: toNumber(bo.overs),
          maidens: toNumber(bo.maidens),
          runs: toNumber(bo.runs),
          wickets: toNumber(bo.wickets),
          economy: toNumber(bo.economy),
          team: bo.teamName || "",
        });
      });
    });
  }

  // Simple ranking helpers
  topBatters.sort((a, b) => (b.runs || 0) - (a.runs || 0));
  topBowlers.sort((a, b) => (b.wickets || 0) - (a.wickets || 0));

  return {
    matchId,
    lastUpdated: cacheMeta.lastUpdated,
    cache: {
      fromCache: cacheMeta.fromCache,
      stale: cacheMeta.stale,
      error: cacheMeta.error || null,
      ttlMs: CACHE_TTL_MS,
    },
    inningsSummary,
    topBatters: topBatters.slice(0, 5),
    topBowlers: topBowlers.slice(0, 5),
  };
}

// ------------------------------------------------------
// EXPRESS APP
// ------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "CRICAI Proxy Server",
    time: Date.now(),
  });
});

app.get("/status", (req, res) => {
  res.json({
    status: "OK",
    service: "CRICAI Proxy Server",
    time: Date.now(),
  });
});

// ------------------------------------------------------
// LIVE MATCHES
// ------------------------------------------------------
// RapidAPI endpoint: GET /matches/v1/live
app.get("/live", async (req, res) => {
  try {
    const { data, meta } = await fetchWithSmartCache("live", {
      method: "GET",
      url: "/matches/v1/live",
    });

    const cricaiMeta = buildMatchListMeta(data, meta);

    // Preserve original Cricbuzz structure and just add CRICAI block
    const enhanced = {
      ...data,
      cricaiMeta,
    };

    res.json(enhanced);
  } catch (err) {
    const message = "Unexpected error fetching live matches.";
    const details = err.message || "Unknown error";

    res.status(err.statusCode || 502).json({
      live: false,
      error: true,
      message,
      details,
      lastUpdated: Date.now(),
    });
  }
});

// ------------------------------------------------------
// RECENT MATCHES
// ------------------------------------------------------
// RapidAPI endpoint: GET /matches/v1/recent
app.get("/recent", async (req, res) => {
  try {
    const { data, meta } = await fetchWithSmartCache("recent", {
      method: "GET",
      url: "/matches/v1/recent",
    });

    const cricaiMeta = buildMatchListMeta(data, meta);

    const enhanced = {
      ...data,
      cricaiMeta,
    };

    res.json(enhanced);
  } catch (err) {
    const message = "Unexpected error fetching recent matches.";
    const details = err.message || "Unknown error";

    res.status(err.statusCode || 502).json({
      recent: false,
      error: true,
      message,
      details,
      lastUpdated: Date.now(),
    });
  }
});

// ------------------------------------------------------
// UPCOMING MATCHES
// ------------------------------------------------------
// RapidAPI endpoint: GET /matches/v1/upcoming
app.get("/upcoming", async (req, res) => {
  try {
    const { data, meta } = await fetchWithSmartCache("upcoming", {
      method: "GET",
      url: "/matches/v1/upcoming",
    });

    const cricaiMeta = buildMatchListMeta(data, meta);

    const enhanced = {
      ...data,
      cricaiMeta,
    };

    res.json(enhanced);
  } catch (err) {
    const message = "Unexpected error fetching upcoming matches.";
    const details = err.message || "Unknown error";

    res.status(err.statusCode || 502).json({
      upcoming: false,
      error: true,
      message,
      details,
      lastUpdated: Date.now(),
    });
  }
});

// ------------------------------------------------------
// SCORECARD BY MATCH ID
// ------------------------------------------------------
// RapidAPI endpoint: GET /mcenter/v1/{matchId}/hscard
app.get("/scorecard", async (req, res) => {
  const matchId = req.query.id;

  if (!matchId) {
    return res.status(400).json({
      scorecard: false,
      error: true,
      message: "matchId is required",
      lastUpdated: Date.now(),
    });
  }

  const cacheKey = `scorecard:${matchId}`;

  try {
    const { data, meta } = await fetchWithSmartCache(cacheKey, {
      method: "GET",
      url: `/mcenter/v1/${encodeURIComponent(matchId)}/hscard`,
    });

    const cricaiMeta = buildScorecardMeta(data, matchId, meta);

    const enhanced = {
      ...data,
      cricaiMeta,
    };

    res.json(enhanced);
  } catch (err) {
    const message = "Unexpected error fetching scorecard.";
    const details = err.message || "Unknown error";

    res.status(err.statusCode || 502).json({
      scorecard: false,
      error: true,
      message,
      details,
      lastUpdated: Date.now(),
    });
  }
});

// ------------------------------------------------------
// START SERVER
// ------------------------------------------------------
app.listen(PORT, () => {
  console.log(
    `✅ CRICAI Proxy Server running on port ${PORT} (env: ${
      process.env.NODE_ENV || "development"
    })`
  );
});
