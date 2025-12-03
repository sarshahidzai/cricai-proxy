import express from "express";
import axios from "axios";
import cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 10000;

const RAPIDAPI_BASE = process.env.RAPIDAPI_BASE;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

/* ---------------------------------------
   HELPER: Safe API fetch with fallback
----------------------------------------*/
async function safeRapidAPI(path, params = {}) {
  try {
    const url = `${RAPIDAPI_BASE}${path}`;
    const res = await axios.get(url, {
      params,
      headers: {
        "X-RapidAPI-Host": RAPIDAPI_HOST,
        "X-RapidAPI-Key": RAPIDAPI_KEY,
      },
      timeout: 8000,
    });

    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/* ---------------------------------------
   HTML SCRAPER (Fallback)
----------------------------------------*/
async function scrapeMatches(type = "live") {
  const mapping = {
    live: "live-cricket-scores",
    recent: "cricket-match-results",
    upcoming: "cricket-schedule-upcoming",
  };

  const url = `https://www.cricbuzz.com/${mapping[type]}`;

  try {
    const html = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(html.data);
    const matches = [];

    $(".cb-mtch-lst").each((_, el) => {
      const title = $(el).find(".cb-lv-scr-mtch-hdr").text().trim();
      const status = $(el).find(".cb-text-inprogress, .cb-text-complete, .cb-text-preview").text().trim();
      const teams = $(el).find(".cb-lv-scrs-well").text().trim();

      if (title) {
        matches.push({
          title,
          status: status || null,
          summary: teams || null,
        });
      }
    });

    return { ok: true, matches };

  } catch (err) {
    return { ok: false, error: err };
  }
}

/* ---------------------------------------
   ENDPOINT: /live
----------------------------------------*/
app.get("/live", async (req, res) => {
  const api = await safeRapidAPI("/matches/v1/live");

  if (api.ok && api.data?.typeMatches?.length > 0) {
    return res.json({
      live: api.data.typeMatches,
      updated: Date.now(),
    });
  }

  const fb = await scrapeMatches("live");
  return res.json({
    live: fb.ok ? fb.matches : [],
    fallback: true,
    updated: Date.now(),
  });
});

/* ---------------------------------------
   ENDPOINT: /recent
----------------------------------------*/
app.get("/recent", async (req, res) => {
  const api = await safeRapidAPI("/matches/v1/recent");

  if (api.ok && api.data?.typeMatches?.length > 0) {
    return res.json({
      recent: api.data.typeMatches,
      updated: Date.now(),
    });
  }

  const fb = await scrapeMatches("recent");
  return res.json({
    recent: fb.ok ? fb.matches : [],
    fallback: true,
    updated: Date.now(),
  });
});

/* ---------------------------------------
   ENDPOINT: /upcoming
----------------------------------------*/
app.get("/upcoming", async (req, res) => {
  const api = await safeRapidAPI("/matches/v1/upcoming");

  if (api.ok && api.data?.typeMatches?.length > 0) {
    return res.json({
      upcoming: api.data.typeMatches,
      updated: Date.now(),
    });
  }

  const fb = await scrapeMatches("upcoming");
  return res.json({
    upcoming: fb.ok ? fb.matches : [],
    fallback: true,
    updated: Date.now(),
  });
});

/* ---------------------------------------
   SCORECARD (no fallback)
----------------------------------------*/
app.get("/scorecard", async (req, res) => {
  const id = req.query.id;
  if (!id) return res.json({ error: true, message: "Missing id" });

  const api = await safeRapidAPI(`/matches/get-scorecard-v2`, { matchId: id });

  if (api.ok) {
    return res.json(api.data);
  }

  return res.json({
    scorecard: false,
    error: true,
    message: "Failed to fetch scorecard",
  });
});

/* ---------------------------------------
   SERVER START
----------------------------------------*/
app.listen(PORT, () => {
  console.log("CRICAI Proxy running on port", PORT);
});
