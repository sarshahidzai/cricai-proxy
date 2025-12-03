import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST; // cricbuzz-cricket.p.rapidapi.com
const BASE = `https://${RAPIDAPI_HOST}`;

async function fetchSeriesList() {
  // free endpoint → returns list of ongoing international series
  const url = `${BASE}/series/v1/international`;
  const res = await axios.get(url, {
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    },
  });
  return res.data.seriesMapProto || [];
}

async function fetchSeriesMatches(seriesId) {
  const url = `${BASE}/series/v1/${seriesId}`;
  const res = await axios.get(url, {
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    },
  });

  return res.data.matchDetails || [];
}

async function collectAllMatches() {
  const seriesList = await fetchSeriesList();
  let matches = [];

  for (const block of seriesList) {
    for (const series of block.series) {
      const id = series.id;
      const items = await fetchSeriesMatches(id);

      for (const m of items) {
        if (m.matchDetailsMap && m.matchDetailsMap.match) {
          matches.push(m.matchDetailsMap.match);
        }
      }
    }
  }

  return matches;
}

function formatMatch(m) {
  return {
    id: m.matchId,
    title: m.matchDesc,
    series: m.seriesName,
    format: m.matchFormat,
    state: m.state,
    status: m.status,
    team1: m.team1,
    team2: m.team2,
    venue: m.venueInfo,
    startTime: m.startDate,
    endTime: m.endDate,
  };
}

// ========== ENDPOINTS ========== //

app.get("/live", async (req, res) => {
  try {
    const matches = await collectAllMatches();
    const live = matches.filter((m) => m.state?.toLowerCase() === "in progress");

    res.json({
      live: live.map(formatMatch),
      count: live.length,
      updated: Date.now(),
    });
  } catch (err) {
    console.log("LIVE ERROR:", err.message);
    res.json({ live: [], error: true, message: err.message });
  }
});

app.get("/recent", async (req, res) => {
  try {
    const matches = await collectAllMatches();
    const recent = matches.filter(
      (m) => m.state?.toLowerCase() === "complete"
    );

    res.json({
      recent: recent.map(formatMatch),
      count: recent.length,
      updated: Date.now(),
    });
  } catch (err) {
    res.json({ recent: [], error: true, message: err.message });
  }
});

app.get("/upcoming", async (req, res) => {
  try {
    const matches = await collectAllMatches();
    const upcoming = matches.filter(
      (m) => m.state?.toLowerCase() === "preview"
    );

    res.json({
      upcoming: upcoming.map(formatMatch),
      count: upcoming.length,
      updated: Date.now(),
    });
  } catch (err) {
    res.json({ upcoming: [], error: true, message: err.message });
  }
});

// Scorecard (your old working endpoint)
app.get("/scorecard", async (req, res) => {
  try {
    const id = req.query.id;
    const url = `${BASE}/match/v2/${id}/scorecard`;

    const response = await axios.get(url, {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
    });

    res.json(response.data);
  } catch (err) {
    res.json({
      scorecard: false,
      error: true,
      message: "Error fetching scorecard",
      details: err.message,
    });
  }
});

app.listen(process.env.PORT || 10000, () =>
  console.log("CRICAI FREE PROXY RUNNING")
);
