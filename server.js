import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());

// Load environment variables
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "cricket-live-data.p.rapidapi.com";

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "CRICAI Proxy Server",
    time: Date.now()
  });
});

/* ---------------------------------------------------------
   🔵 1. LIVE MATCHES — /live
---------------------------------------------------------- */
app.get("/live", async (req, res) => {
  try {
    const url = `https://${RAPIDAPI_HOST}/matches/get-live-matches-v1`;

    const response = await axios.get(url, {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST
      }
    });

    if (!response.data || response.data.length === 0) {
      return res.json({
        live: false,
        matches: [],
        message: "No live matches at the moment.",
        reason: "Possibly in mid-innings break or match has not started.",
        lastUpdated: Date.now()
      });
    }

    return res.json({
      live: true,
      matches: response.data,
      lastUpdated: Date.now()
    });

  } catch (error) {
    if (error.response?.status === 403) {
      return res.json({
        live: false,
        matches: [],
        message: "Live feed temporarily restricted (403).",
        reason: "Cricbuzz may be blocking automated requests.",
        lastUpdated: Date.now()
      });
    }

    return res.json({
      live: false,
      error: true,
      message: "Unexpected error fetching live matches.",
      details: error.message,
      lastUpdated: Date.now()
    });
  }
});

/* ---------------------------------------------------------
   🔵 2. UPCOMING MATCHES — /upcoming
---------------------------------------------------------- */
app.get("/upcoming", async (req, res) => {
  try {
    const url = `https://${RAPIDAPI_HOST}/matches/get-upcoming-matches-v1`;

    const response = await axios.get(url, {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST
      }
    });

    if (!response.data || response.data.length === 0) {
      return res.json({
        upcoming: false,
        matches: [],
        message: "No upcoming matches found.",
        lastUpdated: Date.now()
      });
    }

    return res.json({
      upcoming: true,
      matches: response.data,
      lastUpdated: Date.now()
    });

  } catch (error) {
    if (error.response?.status === 403) {
      return res.json({
        upcoming: false,
        matches: [],
        message: "Upcoming match feed unavailable (403).",
        lastUpdated: Date.now()
      });
    }

    return res.json({
      upcoming: false,
      error: true,
      message: "Unexpected error fetching upcoming matches.",
      details: error.message,
      lastUpdated: Date.now()
    });
  }
});

/* ---------------------------------------------------------
   🔵 3. RECENT MATCHES — /recent
---------------------------------------------------------- */
app.get("/recent", async (req, res) => {
  try {
    const url = `https://${RAPIDAPI_HOST}/matches/get-recent-matches-v1`;

    const response = await axios.get(url, {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST
      }
    });

    if (!response.data || response.data.length === 0) {
      return res.json({
        recent: false,
        matches: [],
        message: "No recent matches available.",
        lastUpdated: Date.now()
      });
    }

    return res.json({
      recent: true,
      matches: response.data,
      lastUpdated: Date.now()
    });

  } catch (error) {
    if (error.response?.status === 403) {
      return res.json({
        recent: false,
        matches: [],
        message: "Recent matches feed restricted (403).",
        lastUpdated: Date.now()
      });
    }

    return res.json({
      recent: false,
      error: true,
      message: "Unexpected error fetching recent matches.",
      details: error.message,
      lastUpdated: Date.now()
    });
  }
});

/* ---------------------------------------------------------
   🔵 4. SCORECARD — /scorecard?id=XXXX
---------------------------------------------------------- */
app.get("/scorecard", async (req, res) => {
  const matchId = req.query.id;

  if (!matchId) {
    return res.json({
      scorecard: false,
      error: true,
      message: "matchId is required",
      lastUpdated: Date.now()
    });
  }

  try {
    const url = `https://${RAPIDAPI_HOST}/matches/get-scorecard-v2?matchId=${matchId}`;

    const response = await axios.get(url, {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST
      }
    });

    if (!response.data) {
      return res.json({
        scorecard: false,
        message: "No scorecard found for this match.",
        lastUpdated: Date.now()
      });
    }

    return res.json({
      scorecard: true,
      data: response.data,
      lastUpdated: Date.now()
    });

  } catch (error) {
    if (error.response?.status === 403) {
      return res.json({
        scorecard: false,
        message: "Scorecard restricted (403).",
        lastUpdated: Date.now()
      });
    }

    return res.json({
      scorecard: false,
      error: true,
      message: "Unexpected error fetching scorecard.",
      details: error.message,
      lastUpdated: Date.now()
    });
  }
});

/* ---------------------------------------------------------
   START SERVER
---------------------------------------------------------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`CRICAI Proxy running on port ${PORT}`);
});
