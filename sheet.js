import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config(); // Render injects env automatically, local .env only if present

const app = express();
app.use(bodyParser.json());

// ================== ENV CONFIG ==================
const PORT = process.env.PORT || 10000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const GOOGLE_CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_RANGE = process.env.SHEET_RANGE || "Sheet1!A:Z";

// ================== GOOGLE SHEETS ==================
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const auth = new google.auth.GoogleAuth({
    keyFile: GOOGLE_CREDENTIALS_PATH,
    scopes: SCOPES,
});
const sheets = google.sheets({ version: "v4", auth });

async function appendRow(values) {
    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_RANGE,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [values],
            },
        });
        console.log("✅ Row added:", response.data.updates.updatedRange);
    } catch (err) {
        console.error("❌ Error appending row:", err);
    }
}

// ================== WHATSAPP HANDLER ==================
app.post("/webhook", async (req, res) => {
    try {
        const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (message) {
            const from = message.from; // phone number
            const text = message.text?.body || "N/A";
            const timestamp = new Date().toISOString();

            console.log(`📩 New message from ${from}: ${text}`);

            // Save to Google Sheets
            await appendRow([timestamp, from, text]);

            // Send back a reply
            await axios.post(
                "https://graph.facebook.com/v20.0/me/messages",
                {
                    messaging_product: "whatsapp",
                    to: from,
                    text: { body: `You said: ${text}` },
                },
                {
                    headers: {
                        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Webhook error:", err);
        res.sendStatus(500);
    }
});

// ================== VERIFICATION ==================
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ Webhook verified!");
        res.status(200).send(challenge);
    } else {
        console.log("❌ Verification failed.");
        res.sendStatus(403);
    }
});

// ================== START SERVER ==================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
