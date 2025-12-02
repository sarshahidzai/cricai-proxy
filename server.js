
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ========== CONFIG ==========
const PORT = process.env.PORT || 3000;
const CRICBUZZ_URL = "https://www.cricbuzz.com";
const ESPN_URL = "https://site.web.api.espn.com/apis/v2/sports/cricket";
const YAHOO_URL = "https://cricket.yahoo.net";

// Logging helper
function log(type, msg) {
    console.log(`[${new Date().toISOString()}] [${type}]`, msg);
}

// Proxy Engine
async function proxy(url) {
    try {
        log("FETCH", url);
        const res = await fetch(url, {
            headers: { "User-Agent": "CRICAI Proxy Server" }
        });
        return await res.text();
    } catch (err) {
        log("ERROR", err.toString());
        return JSON.stringify({ error: "Failed", detail: err.toString() });
    }
}

// Routes
app.get("/", (req, res) => {
    res.json({
        status: "CRICAI Proxy v2 running",
        endpoints: ["/cricbuzz", "/espn", "/yahoo"]
    });
});

app.get("/cricbuzz", async (req, res) => {
    const html = await proxy(CRICBUZZ_URL);
    res.send(html);
});

app.get("/espn", async (req, res) => {
    const json = await proxy(`${ESPN_URL}/scoreboard`);
    res.send(json);
});

app.get("/yahoo", async (req, res) => {
    const html = await proxy(YAHOO_URL);
    res.send(html);
});

// Start server
app.listen(PORT, () => {
    log("START", `CRICAI Proxy running on ${PORT}`);
});
