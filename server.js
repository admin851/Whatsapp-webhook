// server.js
import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(bodyParser.json());

// 🔑 Env vars
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
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
        const from = message.from;
        const msgBody = message.text?.body?.trim() || "";

        console.log(`📩 Message from ${from}: ${msgBody}`);

        try {
            // Always reply with same text
            await sendText(from, "Hi, thank you for your corporation.");
        } catch (err) {
            console.error("❌ Error in sending message:", err);
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

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
