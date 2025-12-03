import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const BASE_URL = "https://cricbuzz-cricket.p.rapidapi.com";

const headers = {
  "x-rapidapi-key": RAPIDAPI_KEY,
  "x-rapidapi-host": "cricbuzz-cricket.p.rapidapi.com"
};

// Helper function
async function api(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers });
  return res.json();
}

/* ------------------------------
   STATUS CHECK
------------------------------ */
app.get("/status", (req, res) => {
  res.json({
    status: "OK",
    service: "CRICAI API v1 (RapidAPI)",
    time: Date.now()
  });
});

/* ------------------------------
   LIVE MATCHES 
------------------------------ */
app.get("/live", async (req, res) => {
  try {
    const data = await api("/matches/v1/live");
    res.json({ status: "success", live: data });
  } catch (err) {
    res.json({ status: "error", error: err.toString() });
  }
});

/* ------------------------------
   UPCOMING MATCHES 
------------------------------ */
app.get("/upcoming", async (req, res) => {
  try {
    const data = await api("/matches/v1/upcoming");
    res.json({ status: "success", upcoming: data });
  } catch (err) {
    res.json({ status: "error", error: err.toString() });
  }
});

/* ------------------------------
   RECENT / COMPLETED MATCHES 
------------------------------ */
app.get("/recent", async (req, res) => {
  try {
    const data = await api("/matches/v1/recent");
    res.json({ status: "success", recent: data });
  } catch (err) {
    res.json({ status: "error", error: err.toString() });
  }
});

/* ------------------------------
   MATCH DETAIL 
------------------------------ */
app.get("/match/:id", async (req, res) => {
  try {
    const data = await api(`/matches/v1/${req.params.id}`);
    res.json({ status: "success", match: data });
  } catch (err) {
    res.json({ status: "error", error: err.toString() });
  }
});

/* ------------------------------
   LIVE SCORECARD 
------------------------------ */
app.get("/score/:id", async (req, res) => {
  try {
    const data = await api(`/mcenter/v1/${req.params.id}/scard`);
    res.json({ status: "success", score: data });
  } catch (err) {
    res.json({ status: "error", error: err.toString() });
  }
});

/* ------------------------------
   COMMENTARY 
------------------------------ */
app.get("/commentary/:id", async (req, res) => {
  try {
    const data = await api(`/mcenter/v1/${req.params.id}/comm`);
    res.json({ status: "success", commentary: data });
  } catch (err) {
    res.json({ status: "error", error: err.toString() });
  }
});

/* ------------------------------
   TEAMS 
------------------------------ */
app.get("/teams", async (req, res) => {
  try {
    const data = await api("/teams/v1/international");
    res.json({ status: "success", teams: data });
  } catch (err) {
    res.json({ status: "error", error: err.toString() });
  }
});

/* ------------------------------
   SERIES 
------------------------------ */
app.get("/series", async (req, res) => {
  try {
    const data = await api("/series/v1/international");
    res.json({ status: "success", series: data });
  } catch (err) {
    res.json({ status: "error", error: err.toString() });
  }
});

/* ------------------------------
   START SERVER
------------------------------ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`CRICAI API running on ${PORT}`));
