import express from "express";
import axios from "axios";
import cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 10000;

const RAPIDAPI_BASE = process.env.RAPIDAPI_BASE;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

/* -------------------------------------------------------
   Safe RapidAPI request with guaranteed fallback on 429
--------------------------------------------------------*/
async function safeRapidAPI(path, params = {}) {
  const url = `${RAPIDAPI_BASE}${path}`;
  const headers = {
    "X-RapidAPI-Host": RAPIDAPI_HOST,
    "X-RapidAPI-Key": RAPIDAPI_KEY,
  };

  try {
    let res = await axios.get(url, { params, headers, timeout: 6000 });
    return { ok: true, data: res.data };
  } catch (err) {
    // If rate-limited, retry once
    if (err.response?.status === 429) {
      try {
        await new Promise(r => setTimeout(r, 1500)); // wait 1.5s
        let retry = await axios.get(url, { params, headers, timeout: 6000 });
        return { ok: true, data: retry.data };
      } catch {
        return { ok: false, error: "429 RATE_LIMIT" };
      }
    }

    return { ok: false, error: err.message };
  }
}

/* -------------------------------------------------------
   Updated Cricbuzz Scraper (Dec 2025 layout)
--------------------------------------------------------*/
async function scrape(type) {
  const map = {
    live: "live-cricket-scores",
    recent: "cricket-match-results",
    upcoming: "cricket-schedule-upcoming",
  };

  try {
    const url = `https://www.cricbuzz.com/${map[type]}`;
    const html = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 7000,
    });

    const $ = cheerio.load(html.data);
    const matches = [];

    // NEW selectors (Dec 2025)
    $(".cb-mtch-blk").each((_, el) => {
      const title = $(el).find(".text-hvr-underline").text().trim();
      const status = $(el)
        .find(".cb-text-complete, .cb-text-inprogress, .cb-text-preview")
        .text()
        .trim();
      const summary = $(el)
        .find(".cb-hmscg-bat-txt, .cb-lv-scrs-well")
        .text()
        .trim();

      if (title) {
        matches.push({
          title,
          status: status || "Unknown",
          summary: summary || "",
        });
      }
    });

    return matches;
  } catch {
    return [];
  }
}

/* -------------------------------------------------------
   LIVE endpoint — NOW GUARANTEED to return fallback
--------------------------------------------------------*/
app.get("/live", async (req, res) => {
  const api = await safeRapidAPI("/matches/v1/live");

  if (api.ok && api.data?.typeMatches?.length > 0) {
    return res.json({
      live: api.data.typeMatches,
      fallback: false,
      updated: Date.now(),
    });
  }

  // Fallback ALWAYS triggers on 429 or failure
  const fb = await scrape("live");

  return res.json({
    live: fb,
    fallback: true,
    updated: Date.now(),
  });
});

/* -------------------------------------------------------
   RECENT
--------------------------------------------------------*/
app.get("/recent", async (req, res) => {
  const api = await safeRapidAPI("/matches/v1/recent");

  if (api.ok && api.data?.typeMatches?.length > 0) {
    return res.json({
      recent: api.data.typeMatches,
      fallback: false,
      updated: Date.now(),
    });
  }

  const fb = await scrape("recent");

  return res.json({
    recent: fb,
    fallback: true,
    updated: Date.now(),
  });
});

/* -------------------------------------------------------
   UPCOMING
--------------------------------------------------------*/
app.get("/upcoming", async (req, res) => {
  const api = await safeRapidAPI("/matches/v1/upcoming");

  if (api.ok && api.data?.typeMatches?.length > 0) {
    return res.json({
      upcoming: api.data.typeMatches,
      fallback: false,
      updated: Date.now(),
    });
  }

  const fb = await scrape("upcoming");

  return res.json({
    upcoming: fb,
    fallback: true,
    updated: Date.now(),
  });
});

/* -------------------------------------------------------
   SCORECARD
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
    message: "Failed to fetch scorecard",
  });
});

/* -------------------------------------------------------
   Start Server
--------------------------------------------------------*/
app.listen(PORT, () => {
  console.log("CRICAI Proxy running on port " + PORT);
});
