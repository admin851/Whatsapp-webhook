import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import fs from "fs";
import { setTeacherName, exportTimetableAsPDF } from "./sheets.js";

const app = express();
app.use(bodyParser.json());

const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const spreadsheetId = process.env.SPREADSHEET_ID;

// Track user conversation state
const userStates = new Map();

/**
 * Send text message via WhatsApp API
 */
async function sendText(to, text) {
    await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: text },
        }),
    });
}

/**
 * Send PDF document via WhatsApp API
 */
async function sendPDF(to, filePath) {
    const fileData = fs.readFileSync(filePath);
    const formData = new FormData();
    formData.append("file", new Blob([fileData]), "timetable.pdf");
    formData.append("messaging_product", "whatsapp");

    // Step 1: Upload media to WhatsApp
    const uploadRes = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/media`,
        {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        }
    );

    const uploadJson = await uploadRes.json();
    if (!uploadJson.id) {
        console.error("Media upload failed:", uploadJson);
        return;
    }

    // Step 2: Send media as message
    await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "document",
            document: {
                id: uploadJson.id,
                caption: "Here is your timetable 📄",
                filename: "timetable.pdf",
            },
        }),
    });
}

app.post("/webhook", async (req, res) => {
    try {
        const entry = req.body.entry?.[0]?.changes?.[0]?.value;
        const message = entry?.messages?.[0];
        const from = message?.from;
        const text = message?.text?.body?.trim();

        if (!from || !text) return res.sendStatus(200);

        console.log(`📩 Message from ${from}: ${text}`);

        // If user sends /timetable → ask teacher name
        if (text.toLowerCase() === "/timetable") {
            userStates.set(from, { awaitingTeacher: true });
            await sendText(from, "Please enter the teacher name 🧑‍🏫");
            return res.sendStatus(200);
        }

        // If user is awaiting teacher name
        if (userStates.get(from)?.awaitingTeacher) {
            userStates.delete(from); // reset state
            await setTeacherName(spreadsheetId, text);
            const pdfPath = await exportTimetableAsPDF(spreadsheetId);
            await sendPDF(from, pdfPath);
            return res.sendStatus(200);
        }

        // Default fallback
        await sendText(from, "Send /timetable to get timetable 📅");

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Error in webhook flow:", err);
        res.sendStatus(500);
    }
});

// Verification for webhook
app.get("/webhook", (req, res) => {
    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === verifyToken) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

app.listen(3000, () => console.log("🚀 Server running on port 3000"));
