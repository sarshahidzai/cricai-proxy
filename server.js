import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

// ---------- STATUS ----------
app.get("/status", (req, res) => {
  res.json({ status: "OK", service: "CRICAI Proxy Server", time: Date.now() });
});

// ---------- CRICBUZZ ----------
app.get("/cricbuzz", async (req, res) => {
  try {
    const url = "https://www.cricbuzz.com/";
    const response = await fetch(url);
    const html = await response.text();
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: "Cricbuzz fetch failed", details: err.toString() });
  }
});

// ---------- ESPN ----------
app.get("/espn", async (req, res) => {
  try {
    const api =
      "https://site.web.api.espn.com/apis/v2/sports/cricket/scoreboard";
    const response = await fetch(api);
    const json = await response.json();
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: "ESPN fetch failed", details: err.toString() });
  }
});

// ---------- YAHOO CRICKET ----------
app.get("/yahoo", async (req, res) => {
  try {
    const url = "https://cricket.yahoo.com/";
    const response = await fetch(url);
    const html = await response.text();
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: "Yahoo fetch failed", details: err.toString() });
  }
});

// ---------- ROOT ----------
app.get("/", (req, res) => {
  res.send("CRICAI Proxy Server is running.");
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`CRICAI Proxy running on port ${PORT}`);
});
