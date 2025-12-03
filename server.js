// ==================================================================
// CRICAI FULL PROXY SERVER (Stable RapidAPI Version) - CommonJS
// ==================================================================

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// =========================
// ENVIRONMENT VARIABLES
// =========================
const RAPID_KEY = process.env.RAPIDAPI_KEY;
const RAPID_HOST = "cricbuzz-cricket.p.rapidapi.com";

if (!RAPID_KEY) {
  console.log("❌ Missing RAPIDAPI_KEY — add it in Render Environment");
}

// =========================
// HOME ROUTE
// =========================
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "CRICAI Proxy Server",
    time: Date.now(),
    routes: ["/matches", "/match?id=1234"]
  });
});

// =========================
// GET MATCHES
// =========================
app.get("/matches", async (req, res) => {
  try {
    const response = await axios.get(
      "https://cricbuzz-cricket.p.rapidapi.com/matches/v1/recent",
      {
        headers: {
          "x-rapidapi-key": RAPID_KEY,
          "x-rapidapi-host": RAPID_HOST,
        },
      }
    );

    res.json({
      status: "success",
      source: "rapidapi-cricbuzz",
      data: response.data,
    });
  } catch (err) {
    console.error("Error /matches:", err.message);
    res.status(500).json({ error: "Failed to load matches" });
  }
});

// =========================
// GET MATCH DETAILS
// =========================
app.get("/match", async (req, res) => {
  const id = req.query.id;

  if (!id) return res.json({ error: "Match ID required ?id=1234" });

  try {
    const response = await axios.get(
      "https://cricbuzz-cricket.p.rapidapi.com/mcenter/v1/" + id,
      {
        headers: {
          "x-rapidapi-key": RAPID_KEY,
          "x-rapidapi-host": RAPID_HOST,
        },
      }
    );

    res.json({
      status: "success",
      matchId: id,
      source: "rapidapi-cricbuzz",
      data: response.data,
    });
  } catch (err) {
    console.error("Error /match:", err.message);
    res.status(500).json({ error: "Failed to load match details" });
  }
});

// ==================================================================
// START SERVER
// ==================================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 CRICAI Proxy running on ${PORT}`);
});
