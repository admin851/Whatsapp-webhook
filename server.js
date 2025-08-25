// server.js
import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import FormData from "form-data";
import { updateCell, exportSheetAsPDF } from "./sheets.js";
import { convertPDFToImage } from "./utils.js";   // ✅ now using pdf2pic

dotenv.config();
const app = express();
app.use(bodyParser.json());

// 🔑 Env vars
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const SHEET_ID = process.env.SPREADSHEET_ID;
const PRINT_SHEET_GID = process.env.PRINT_SHEET_GID;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// In-memory conversation state
const userSessions = {};

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
        const from = message.from;
        const msgBody = message.text?.body?.trim() || "";

        console.log(`📩 Message from ${from}: ${msgBody}`);

        try {
            if (msgBody === "/timetable") {
                userSessions[from] = { step: "awaiting_teacher" };
                await sendText(from, "Please write teacher name");
            }
            else if (userSessions[from]?.step === "awaiting_teacher") {
                const teacherName = msgBody;

                // 1. Update A1
                await updateCell(SHEET_ID, "'Print (Teacher)'!A1", teacherName);

                // 2. Export as PDF
                const pdfPath = `./${from}_timetable.pdf`;
                await exportSheetAsPDF(SHEET_ID, PRINT_SHEET_GID, pdfPath);

                // 3. Convert PDF -> Image
                const imgPath = `./${from}_timetable.png`;
                await convertPDFToImage(pdfPath, imgPath);

                // 4. Send Image
                await sendImage(from, imgPath);

                delete userSessions[from]; // reset state
            }
            else {
                await sendText(from, "Send /timetable to get started.");
            }
        } catch (err) {
            console.error("❌ Error in flow:", err);
            await sendText(from, "Something went wrong. Please try again later.");
        }

        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// ✅ Send plain text message
async function sendText(to, text) {
    await axios.post(
        `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
        {
            messaging_product: "whatsapp",
            to,
            text: { body: text },
        },
        {
            headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json",
            },
        }
    );
}

// ✅ Send Image
async function sendImage(to, filePath) {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));
    formData.append("type", "image");
    formData.append("messaging_product", "whatsapp");

    const uploadRes = await axios.post(
        `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/media`,
        formData,
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, ...formData.getHeaders() } }
    );

    const mediaId = uploadRes.data.id;

    await axios.post(
        `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
        {
            messaging_product: "whatsapp",
            to,
            type: "image",
            image: {
                id: mediaId,
                caption: "🖼️ Here is your timetable",
            },
        },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
}

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
