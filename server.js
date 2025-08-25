// server.js
import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import { updateTeacherAndExportPDF } from "./sheets.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const SHEET_ID = process.env.SPREADSHEET_ID;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// In-memory state to track which users are waiting for teacher name
const waitingForTeacher = new Map();

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
        const msgBody = message.text?.body?.trim() || "";

        console.log(`📩 Message from ${from}: ${msgBody}`);

        // If user sent "/timetable", ask for teacher name
        if (msgBody.toLowerCase() === "/timetable") {
            waitingForTeacher.set(from, true);

            await sendWhatsAppMessage(
                from,
                "📘 Please enter the *teacher's name* to fetch the timetable."
            );
            return res.sendStatus(200);
        }

        // If user is expected to send teacher name
        if (waitingForTeacher.get(from)) {
            const teacherName = msgBody;
            waitingForTeacher.delete(from); // clear state

            try {
                const filePath = await updateTeacherAndExportPDF(SHEET_ID, teacherName);
                console.log(`✅ Timetable PDF generated for ${teacherName}: ${filePath}`);

                await sendWhatsAppDocument(from, filePath, `${teacherName}-timetable.pdf`);
            } catch (err) {
                console.error("❌ Failed to generate timetable:", err);
                await sendWhatsAppMessage(
                    from,
                    "⚠️ Sorry, I couldn't generate the timetable. Please try again."
                );
            }
            return res.sendStatus(200);
        }

        // Otherwise, ignore or send help
        await sendWhatsAppMessage(from, "❓ Send */timetable* to get started.");
        return res.sendStatus(200);
    }

    res.sendStatus(404);
});

// ✅ Helper: Send plain text message
async function sendWhatsAppMessage(to, text) {
    try {
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
    } catch (err) {
        console.error("❌ Failed to send WhatsApp message:", err.response?.data || err);
    }
}

// ✅ Helper: Send PDF document
async function sendWhatsAppDocument(to, filePath, fileName) {
    try {
        // Step 1: Upload the media
        const mediaRes = await axios.post(
            `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/media`,
            {
                messaging_product: "whatsapp",
                type: "application/pdf",
                file: filePath,
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    "Content-Type": "multipart/form-data",
                },
            }
        );

        const mediaId = mediaRes.data.id;

        // Step 2: Send the media by ID
        await axios.post(
            `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to,
                type: "document",
                document: {
                    id: mediaId,
                    filename: fileName,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    "Content-Type": "application/json",
                },
            }
        );

        console.log(`📤 PDF sent to ${to}`);
    } catch (err) {
        console.error("❌ Failed to send WhatsApp document:", err.response?.data || err);
    }
}

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
