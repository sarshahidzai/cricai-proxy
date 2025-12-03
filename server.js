import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// =============== ENV VARIABLES ===============
const RAPID_KEY = process.env.RAPIDAPI_KEY;
const RAPID_HOST = "cricbuzz-cricket.p.rapidapi.com";

if (!RAPID_KEY) {
  console.log("❌ Missing RAPIDAPI_KEY in Render Environment!");
}

// =============================================
// HOME
// =============================================
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "CRICAI Proxy Server",
    time: Date.now(),
  });
});

// =============================================
// LIVE MATCHES
// =============================================
app.get("/live", async (req, res) => {
  try {
    const response = await axios.get(
      `https://${RAPID_HOST}/matches/v1/live`,
      {
        headers: {
          "X-RapidAPI-Key": RAPID_KEY,
          "X-RapidAPI-Host": RAPID_HOST,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// =============================================
// RECENT MATCHES
// =============================================
app.get("/recent", async (req, res) => {
  try {
    const response = await axios.get(
      `https://${RAPID_HOST}/matches/v1/recent`,
      {
        headers: {
          "X-RapidAPI-Key": RAPID_KEY,
          "X-RapidAPI-Host": RAPID_HOST,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// =============================================
// UPCOMING MATCHES
// =============================================
app.get("/upcoming", async (req, res) => {
  try {
    const response = await axios.get(
      `https://${RAPID_HOST}/matches/v1/upcoming`,
      {
        headers: {
          "X-RapidAPI-Key": RAPID_KEY,
          "X-RapidAPI-Host": RAPID_HOST,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// =============================================
// FULL SCORECARD BY MATCH ID
// =============================================
app.get("/scorecard", async (req, res) => {
  const matchId = req.query.id;

  if (!matchId) {
    return res.json({ error: "matchId is required" });
  }

  try {
    const response = await axios.get(
      `https://${RAPID_HOST}/mcenter/v1/${matchId}/scard`,
      {
        headers: {
          "X-RapidAPI-Key": RAPID_KEY,
          "X-RapidAPI-Host": RAPID_HOST,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// =============================================
// START SERVER
// =============================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 CRICAI Proxy running on port ${PORT}`);
});
