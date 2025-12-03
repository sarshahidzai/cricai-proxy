import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const RAPID_KEY = process.env.RAPIDAPI_KEY;
const RAPID_HOST = process.env.RAPIDAPI_HOST;
const RAPID_BASE = process.env.RAPIDAPI_BASE;

// Helper for RapidAPI request
async function api(url) {
    try {
        const res = await axios.get(url, {
            headers: {
                "X-RapidAPI-Key": RAPID_KEY,
                "X-RapidAPI-Host": RAPID_HOST
            }
        });
        return { ok: true, data: res.data };
    } catch (err) {
        return { ok: false, code: err?.response?.status };
    }
}

// HOME
app.get("/", (req, res) => {
    res.json({ status: "OK", service: "CRICAI Proxy", time: Date.now() });
});

// =========================
//    FETCH ALL SERIES
// =========================
async function getAllSeries() {
    return api(`${RAPID_BASE}/series/v1`);
}

// =========================
//     LIVE MATCHES
// =========================
app.get("/live", async (req, res) => {
    const series = await getAllSeries();

    if (!series.ok)
        return res.json({ live: false, error: true, code: series.code });

    // extract only "In Progress" matches
    let liveList = [];

    series.data.seriesMap.forEach(group => {
        group.series.forEach(s => {
            if (s.state === "In Progress" && s.matches?.length) {
                liveList.push(...s.matches);
            }
        });
    });

    res.json({ live: liveList });
});

// =========================
//     UPCOMING MATCHES
// =========================
app.get("/upcoming", async (req, res) => {
    const series = await getAllSeries();

    if (!series.ok)
        return res.json({ upcoming: false, error: true, code: series.code });

    let upcomingList = [];

    series.data.seriesMap.forEach(group => {
        group.series.forEach(s => {
            if (s.state === "Preview" && s.matches?.length) {
                upcomingList.push(...s.matches);
            }
        });
    });

    res.json({ upcoming: upcomingList });
});

// =========================
//     RECENT MATCHES
// =========================
app.get("/recent", async (req, res) => {
    const series = await getAllSeries();

    if (!series.ok)
        return res.json({ recent: false, error: true, code: series.code });

    let recentList = [];

    series.data.seriesMap.forEach(group => {
        group.series.forEach(s => {
            if (s.state === "Complete" && s.matches?.length) {
                recentList.push(...s.matches);
            }
        });
    });

    res.json({ recent: recentList });
});

// =========================
//     SCORECARD (works)
// =========================
app.get("/scorecard", async (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Missing id" });

    const sc = await api(`${RAPID_BASE}/mcenter/v1/${id}/hscard`);
    if (!sc.ok) return res.json({ error: true, code: sc.code });

    res.json(sc.data);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("CRICAI Proxy running:", PORT));
