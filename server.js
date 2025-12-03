import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = "cricbuzz-cricket.p.rapidapi.com";

// -------------------------------
// Helper to call Cricbuzz API
// -------------------------------
async function callCricbuzz(path) {
  const url = `https://${RAPIDAPI_HOST}${path}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    },
  });

  if (!res.ok) {
    return {
      error: true,
      status: res.status,
      message: `Cricbuzz API Error ${res.status}`,
    };
  }

  return res.json();
}

// -------------------------------
// LIVE MATCHES
// -------------------------------
app.get("/live", async (req, res) => {
  const data = await callCricbuzz("/matches/v1/live");
  res.json(data);
});

// -------------------------------
// RECENT MATCHES
// -------------------------------
app.get("/recent", async (req, res) => {
  const data = await callCricbuzz("/matches/v1/recent");
  res.json(data);
});

// -------------------------------
// UPCOMING MATCHES
// -------------------------------
app.get("/upcoming", async (req, res) => {
  const data = await callCricbuzz("/matches/v1/upcoming");
  res.json(data);
});

// -------------------------------
// SCORECARD
// -------------------------------
app.get("/scorecard", async (req, res) => {
  const { id } = req.query;

  if (!id) return res.json({ error: true, message: "Missing ?id=" });

  const data = await callCricbuzz(`/mcenter/v1/${id}/hscard`);
  res.json(data);
});

// -------------------------------
// ROOT
// -------------------------------
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "CRICAI Proxy",
    message: "Running on upgraded RapidAPI plan",
    time: Date.now(),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("CRICAI PROXY RUNNING on", PORT));
