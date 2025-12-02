// CRICAI Proxy Server v3 — Hybrid JSON + HTML
// - /status               → health check
// - /matches              → cleaned JSON from ESPN scoreboard
// - /cricbuzz, /cricbuzz/* → HTML proxy to Cricbuzz
// - /espn, /espn/*        → JSON / HTML proxy to ESPN cricket APIs
// - /yahoo, /yahoo/*      → HTML proxy to Yahoo Cricket

import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

// Common browser-like headers to reduce blocking
const BASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

// Simple helper for fetch with error handling
async function fetchWithType(url, type = "text", extraHeaders = {}) {
  const res = await fetch(url, {
    headers: {
      ...BASE_HEADERS,
      ...extraHeaders,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Upstream ${url} responded ${res.status}: ${body.slice(0, 200)}`);
  }

  if (type === "json") return res.json();
  return res.text();
}

/* ------------------------------------------------------------------ */
/* STATUS                                                              */
/* ------------------------------------------------------------------ */

app.get("/status", (req, res) => {
  res.json({
    status: "OK",
    service: "CRICAI Proxy Server",
    time: Date.now(),
  });
});

/* ------------------------------------------------------------------ */
/* CLEAN JSON MATCHES (ESPN SCOREBOARD)                               */
/* ------------------------------------------------------------------ */

const ESPN_SCOREBOARD =
  "https://site.web.api.espn.com/apis/site/v2/sports/cricket/scoreboard";

app.get("/matches", async (req, res) => {
  try {
    const data = await fetchWithType(ESPN_SCOREBOARD, "json", {
      Accept: "application/json, text/plain, */*",
    });

    // ESPN sometimes uses data.events, sometimes leagues[].events
    let events = [];
    if (Array.isArray(data?.events)) {
      events = data.events;
    } else if (Array.isArray(data?.leagues)) {
      for (const lg of data.leagues) {
        if (Array.isArray(lg.events)) events.push(...lg.events);
      }
    }

    const live = [];
    const upcoming = [];
    const recent = [];

    for (const ev of events) {
      const competition = ev?.competitions?.[0] || {};
      const comps = competition.competitors || [];
      const statusObj = ev?.status?.type || {};
      const state = (statusObj.state || "").toLowerCase();

      const match = {
        id: ev.id,
        uid: ev.uid,
        name: ev.name,
        shortName: ev.shortName,
        series: ev.series?.[0]?.name || null,
        startTime: ev.date,
        state,
        statusText:
          statusObj.description || statusObj.detail || statusObj.shortDetail,
        venue: competition.venue?.fullName || null,
        format: competition.format?.description || null,
        competitors: comps.map((c) => ({
          id: c.id,
          teamId: c.team?.id,
          team: c.team?.shortDisplayName || c.team?.name,
          score: c.score ?? null,
          homeAway: c.homeAway,
          winner: Boolean(c.winner),
        })),
      };

      if (state === "in") live.push(match);
      else if (state === "pre") upcoming.push(match);
      else if (state === "post") recent.push(match);
      else recent.push(match); // fallback
    }

    res.json({
      status: "success",
      source: "espn-scoreboard",
      live,
      upcoming,
      recent,
      meta: {
        total: events.length,
      },
    });
  } catch (err) {
    console.error("ERROR /matches:", err);
    res.status(500).json({
      status: "error",
      source: "espn-scoreboard",
      message: err.message || String(err),
    });
  }
});

/* ------------------------------------------------------------------ */
/* CRICBUZZ  (HTML proxy + path support)                               */
/* ------------------------------------------------------------------ */

// Root Cricbuzz home (HTML)
app.get("/cricbuzz", async (req, res) => {
  try {
    const url = "https://www.cricbuzz.com/";
    const html = await fetchWithType(url, "text", {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    });
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("ERROR /cricbuzz:", err);
    res.status(500).json({
      error: "cricbuzz_failed",
      message: err.message || String(err),
    });
  }
});

// Cricbuzz with arbitrary path, e.g. /cricbuzz/live-cricket-scores
app.get("/cricbuzz/*", async (req, res) => {
  try {
    const path = req.params[0] || "";
    const url = `https://www.cricbuzz.com/${path}`;
    const html = await fetchWithType(url, "text", {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    });
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("ERROR /cricbuzz/*:", err);
    res.status(500).json({
      error: "cricbuzz_failed",
      message: err.message || String(err),
    });
  }
});

/* ------------------------------------------------------------------ */
/* ESPN PROXY (JSON + path support)                                   */
/* ------------------------------------------------------------------ */

// Simple default scoreboard proxy
app.get("/espn", async (req, res) => {
  try {
    const json = await fetchWithType(ESPN_SCOREBOARD, "json", {
      Accept: "application/json, text/plain, */*",
    });
    res.json(json);
  } catch (err) {
    console.error("ERROR /espn:", err);
    res.status(500).json({
      error: "espn_failed",
      message: err.message || String(err),
    });
  }
});

// Generic ESPN proxy: /espn/apis/site/v2/sports/cricket/scoreboard
app.get("/espn/*", async (req, res) => {
  try {
    const path = req.params[0] || "";
    const url = `https://site.web.api.espn.com/${path}`;
    const data = await fetchWithType(url, "json", {
      Accept: "application/json, text/plain, */*",
    });
    res.json(data);
  } catch (err) {
    console.error("ERROR /espn/*:", err);
    res.status(500).json({
      error: "espn_failed",
      message: err.message || String(err),
    });
  }
});

/* ------------------------------------------------------------------ */
/* YAHOO CRICKET (HTML proxy + path support)                           */
/* ------------------------------------------------------------------ */

app.get("/yahoo", async (req, res) => {
  try {
    const url = "https://cricket.yahoo.com/";
    const html = await fetchWithType(url, "text", {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    });
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("ERROR /yahoo:", err);
    res.status(500).json({
      error: "yahoo_failed",
      message: err.message || String(err),
    });
  }
});

app.get("/yahoo/*", async (req, res) => {
  try {
    const path = req.params[0] || "";
    const url = `https://cricket.yahoo.com/${path}`;
    const html = await fetchWithType(url, "text", {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    });
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("ERROR /yahoo/*:", err);
    res.status(500).json({
      error: "yahoo_failed",
      message: err.message || String(err),
    });
  }
});

/* ------------------------------------------------------------------ */
/* ROOT                                                               */
/* ------------------------------------------------------------------ */

app.get("/", (req, res) => {
  res.send(
    "CRICAI Proxy Server v3 is running. Try /status, /matches, /cricbuzz, /espn, /yahoo"
  );
});

/* ------------------------------------------------------------------ */
/* START SERVER                                                       */
/* ------------------------------------------------------------------ */

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`CRICAI Proxy running on port ${PORT}`);
});
