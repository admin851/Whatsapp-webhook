// server.js
const path = require("path");
const express = require("express");
const app = express();

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_secret_token";

app.use(express.json());

// ---- Privacy Policy route ----
app.get("/privacy", (req, res) => {
    res.sendFile(path.join(__dirname, "privacy.html"));
});

// ---- Webhook verification (GET) ----
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
});

// ---- Webhook receiver (POST) ----
app.post("/webhook", (req, res) => {
    console.log("Incoming webhook:", JSON.stringify(req.body, null, 2));
    res.sendStatus(200); // always acknowledge quickly
});

// ---- Start server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
