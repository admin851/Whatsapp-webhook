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

// ✅ Webhook verification (for Meta)
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

// ✅ Incoming messages (optional, just for debugging)
app.post("/webhook", async (req, res) => {
    const body = req.body;

    if (body.object && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from;
        const msgBody = message.text?.body?.trim() || "";

        console.log(`📩 Incoming message from ${from}: ${msgBody}`);

        try {
            await sendText(from, "We got your message—thanks for reaching out!😊");
        } catch (err) {
            console.error("❌ Error replying:", err.response?.data || err.message);
        }

        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// ✅ Apps Script → POST /send
app.post("/send", async (req, res) => {
    try {
        const { to, variables } = req.body;

        if (!to || !variables) {
            return res.status(400).json({ error: "Missing 'to' or 'variables'" });
        }

        // Send template message
        const response = await axios.post(
            `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to,
                type: "template",
                template: {
                    name: "staff_feedback_update",
                    language: { code: "en" },
                    components: [
                        {
                            type: "body",
                            parameters: variables.map(v => ({ type: "text", text: v }))
                        }
                    ]
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log(`✅ Sent to ${to}`, response.data);
        res.json({ success: true });
    } catch (err) {
        console.error("❌ Error sending WhatsApp template:", err.response?.data || err.message);
        res.status(500).json({ error: "Failed to send template" });
    }
});

// ✅ Send plain text helper
async function sendText(to, text) {
    return axios.post(
        `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
        {
            messaging_product: "whatsapp",
            to,
            text: { body: text }
        },
        {
            headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json"
            }
        }
    );
}

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
