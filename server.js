// server.js
import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import FormData from "form-data";
import { updateCell, exportRangeAsPNG } from "./sheets.js";

dotenv.config();
const app = express();
app.use(bodyParser.json());

// ------ Env vars ------
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

const SHEET_ID = process.env.SPREADSHEET_ID;   // timetable file ID
const PRINT_SHEET_GID = process.env.PRINT_SHEET_GID;  // 408465234

// Simple in-memory session store (per WhatsApp number)
const userSessions = Object.create(null);

// ------ Webhook verify ------
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified ✅");
        return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
});

// ------ WhatsApp message webhook ------
app.post("/webhook", async (req, res) => {
    try {
        const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (!message) return res.sendStatus(404);

        const from = message.from;
        const msgBody = message.text?.body?.trim() || "";

        console.log(`📩 Message from ${from}: ${msgBody}`);

        // Flow
        if (msgBody === "/timetable") {
            userSessions[from] = { step: "awaiting_teacher" };
            await sendText(from, "Please write teacher name");
        } else if (userSessions[from]?.step === "awaiting_teacher") {
            const teacherName = msgBody;

            // 1) Update A1 (clear first)
            await updateCell(SHEET_ID, "'Print (Teacher)'!A1", teacherName);

            // 2) Export A1:J16 to PNG (page-filled)
            const pngPath = `./timetable_${from}.png`;
            await exportRangeAsPNG(SHEET_ID, PRINT_SHEET_GID, pngPath);

            // 3) Send image to user
            await sendImage(from, pngPath);

            // Cleanup + reset state
            try { fs.unlinkSync(pngPath); } catch { }
            delete userSessions[from];
        } else {
            await sendText(from, "Send /timetable to get started.");
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Error in webhook flow:", err);
        try {
            const from = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
            if (from) await sendText(from, "Something went wrong. Please try again.");
        } catch { }
        res.sendStatus(200);
    }
});

// ------ Helpers: send text / image ------
async function sendText(to, text) {
    await axios.post(
        `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
        { messaging_product: "whatsapp", to, text: { body: text } },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
}

async function sendImage(to, filePath) {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));
    formData.append("messaging_product", "whatsapp");

    // 1) Upload media
    const uploadRes = await axios.post(
        `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/media`,
        formData,
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, ...formData.getHeaders() } }
    );

    const mediaId = uploadRes.data.id;

    // 2) Send image
    await axios.post(
        `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
        {
            messaging_product: "whatsapp",
            to,
            type: "image",
            image: { id: mediaId, caption: "🗓️ Your timetable" },
        },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
}

// ------ Start server ------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
