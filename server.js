// server.js
import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import { appendRow } from "./sheets.js";

dotenv.config();
const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const SHEET_ID = process.env.SPREADSHEET_ID;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ✅ Webhook verification
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified ✅");
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// ✅ Webhook to receive messages
app.post("/webhook", async (req, res) => {
    const body = req.body;

    if (body.object && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from; // sender's number
        const msgBody = message.text?.body || "";

        console.log(`📩 Message from ${from}: ${msgBody}`);

        // Save to Google Sheet
        try {
            await appendRow(
                SHEET_ID,
                "Sheet1!A:C",
                [from, msgBody, new Date().toISOString()]
            );
        } catch (err) {
            console.error("❌ Failed to write to sheet:", err);
        }

        // Auto-reply
        try {
            await axios.post(
                `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
                {
                    messaging_product: "whatsapp",
                    to: from,
                    text: { body: "✅ Got it! Your message is saved in Google Sheets." },
                },
                {
                    headers: {
                        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                }
            );
        } catch (err) {
            console.error("❌ Failed to send reply:", err.response?.data || err);
        }

        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
