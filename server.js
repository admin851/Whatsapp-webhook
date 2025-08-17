// server.js
import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express().use(bodyParser.json());
const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// ✅ Webhook verification
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("Webhook verified ✅");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// ✅ Incoming messages handler
app.post("/webhook", async (req, res) => {
    try {
        const body = req.body;

        if (body.object) {
            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const message = changes?.value?.messages?.[0];

            if (message) {
                const from = message.from; // user phone number
                console.log("📩 Received message from:", from);

                // Instead of plain text → send interactive buttons
                await sendInteractiveButtons(from);
            }

            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error("❌ Error handling webhook:", error.message);
        res.sendStatus(500);
    }
});

// ✅ Send Interactive Buttons
async function sendInteractiveButtons(to) {
    try {
        const response = await axios.post(
            "https://graph.facebook.com/v19.0/" + process.env.PHONE_NUMBER_ID + "/messages",
            {
                messaging_product: "whatsapp",
                to,
                type: "interactive",
                interactive: {
                    type: "button",
                    body: {
                        text: "Hey 👋, choose one option:"
                    },
                    action: {
                        buttons: [
                            {
                                type: "reply",
                                reply: {
                                    id: "btn_yes",
                                    title: "Yes ✅"
                                }
                            },
                            {
                                type: "reply",
                                reply: {
                                    id: "btn_no",
                                    title: "No ❌"
                                }
                            }
                        ]
                    }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("✅ Interactive message sent:", response.data);
    } catch (error) {
        console.error("❌ Error sending interactive message:", error.response?.data || error.message);
    }
}

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
