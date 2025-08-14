const express = require("express");
const app = express();

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_secret_token";

app.use(express.json());

// Verification endpoint
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Receive messages
app.post("/webhook", (req, res) => {
    console.log("Incoming webhook:", JSON.stringify(req.body, null, 2));
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
