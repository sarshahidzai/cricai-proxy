import express from "express";
import axios from "axios";
import cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 10000;

const RAPIDAPI_BASE = process.env.RAPIDAPI_BASE;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

/* -------------------------------------------------------
   Helper: Standard RapidAPI fetch with retry on 429
--------------------------------------------------------*/
async function safeRapidAPI(path, params = {}) {
  try {
    const url = `${RAPIDAPI_BASE}${path}`;
    const headers = {
      "X-RapidAPI-Host": RAPIDAPI_HOST,
      "X-RapidAPI-Key": RAPIDAPI_KEY,
    };

    try {
      const res = await axios.get(url, { params, headers, timeout: 7000 });
      return { ok: true, data: res.data };
    } catch (err) {
      if (err.response?.status === 429) {
        await new Promise(r => setTimeout(r, 1500)); // retry after 1.5 sec

        const retry = await axios.get(url, { params, headers, timeout: 7000 });
        return { ok: true, data: retry.data };
      }
      throw err;
    }

  } catch (err) {
    return { ok: false, error: err };
  }
}

/* -------------------------------------------------------
   Updated Cricbuzz Scraper - December 2025
--------------------------------------------------------*/

async function scrapeCricbuzz(type) {
  const map = {
    live: "live-cricket-scores",
    recent: "cricket-match-results",
    upcoming: "cricket-schedule-upcoming",
  };

  try {
    const url = `https://www.cricbuzz.com/${map[type]}`;
    const html = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 7000
    });

    const $ = cheerio.load(html.data);
    const matches = [];

    // 🔥 NEW SELECTORS (Dec 2025)
    $(".cb-mtch-blk").each((_, el) => {
      const title = $(el).find(".cb-col-100 .text-hvr-underline").text().trim();
      const status = $(el).find(".cb-text-inprogress, .cb-text-complete, .cb-text-preview").text().trim();
      const summary = $(el).find(".cb-hmscg-bat-txt, .cb-lv-scrs-well").text().trim();

      if (title) {
        matches.push({
          title,
          status: status || "Unknown",
          summary: summary || "No summary"
        });
      }
    });

    return { ok: true, matches };

  } catch (err) {
    return { ok: false, matches: [] };
  }
}

/* -------------------------------------------------------
   LIVE
--------------------------------------------------------*/
app.get("/live", async (req, res) => {
  const api = await safeRapidAPI("/matches/v1/live");

  if (api.ok && api.data?.typeMatches?.length > 0) {
    return res.json({ live: api.data.typeMatches, updated: Date.now() });
  }

  const fb = await scrapeCricbuzz("live");
  return res.json({
    live: fb.matches,
    fallback: true,
    updated: Date.now()
  });
});

/* -------------------------------------------------------
   RECENT
--------------------------------------------------------*/
app.get("/recent", async (req, res) => {
  const api = await safeRapidAPI("/matches/v1/recent");

  if (api.ok && api.data?.typeMatches?.length > 0) {
    return res.json({ recent: api.data.typeMatches, updated: Date.now() });
  }

  const fb = await scrapeCricbuzz("recent");
  return res.json({
    recent: fb.matches,
    fallback: true,
    updated: Date.now()
  });
});

/* -------------------------------------------------------
   UPCOMING
--------------------------------------------------------*/
app.get("/upcoming", async (req, res) => {
  const api = await safeRapidAPI("/matches/v1/upcoming");

  if (api.ok && api.data?.typeMatches?.length > 0) {
    return res.json({ upcoming: api.data.typeMatches, updated: Date.now() });
  }

  const fb = await scrapeCricbuzz("upcoming");
  return res.json({
    upcoming: fb.matches,
    fallback: true,
    updated: Date.now()
  });
});

/* -------------------------------------------------------
   SCORECARD (Fix: Correct parameter name `id`)
--------------------------------------------------------*/
app.get("/scorecard", async (req, res) => {
  const id = req.query.id;

  if (!id) return res.json({ error: true, message: "Missing ?id=" });

  const api = await safeRapidAPI("/matches/get-scorecard-v2", { id });

  if (api.ok) {
    return res.json(api.data);
  }

  return res.json({
    scorecard: false,
    error: true,
    message: "Error fetching scorecard",
  });
});

/* -------------------------------------------------------
   SERVER START
--------------------------------------------------------*/
app.listen(PORT, () => {
  console.log("CRICAI Proxy running on port", PORT);
});
