import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Load env variables from Render
const API_KEY = process.env.RAPIDAPI_KEY;
const API_HOST = process.env.RAPIDAPI_HOST;
const API_BASE = process.env.RAPIDAPI_BASE;

if (!API_KEY || !API_HOST || !API_BASE) {
  console.log("❌ Missing ENV variables");
}

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "x-rapidapi-key": API_KEY,
    "x-rapidapi-host": API_HOST,
  }
});

// ===========================
// HOME
// ===========================
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "CRICAI Proxy Server",
    time: Date.now()
  });
});

// ===========================
// LIVE MATCHES
// ===========================
app.get("/live", async (req, res) => {
  try {
    const r = await api.get("/matches/v1/live");
    res.json(r.data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ===========================
// RECENT MATCHES
// ===========================
app.get("/recent", async (req, res) => {
  try {
    const r = await api.get("/matches/v1/recent");
    res.json(r.data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ===========================
// UPCOMING MATCHES
// ===========================
app.get("/upcoming", async (req, res) => {
  try {
    const r = await api.get("/matches/v1/upcoming");
    res.json(r.data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ===========================
// SCORECARD
// ===========================
app.get("/scorecard", async (req, res) => {
  const matchId = req.query.id;
  if (!matchId) return res.json({ error: "matchId is required" });

  try {
    const r = await api.get(`/mcenter/v1/${matchId}/hscard`);
    res.json(r.data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ===========================
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`🚀 CRICAI Proxy running on ${port}`);
});
