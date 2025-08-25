import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { exportRangeAsImage } from "./sheets.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const TIMETABLE_GID = process.env.TIMETABLE_GID || 0;

// ✅ Webhook verification
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ Webhook verified!");
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// ✅ Webhook receiver
app.post("/webhook", async (req, res) => {
    try {
        const entry = req.body.entry?.[0]?.changes?.[0]?.value;
        const message = entry?.messages?.[0];

        if (message?.text?.body?.toLowerCase() === "/timetable") {
            const from = message.from;

            // Export timetable to PNG
            const imgPath = "./timetable.png";
            await exportRangeAsImage(SPREADSHEET_ID, TIMETABLE_GID, imgPath);

            // Upload image to WhatsApp
            const mediaRes = await fetch(
                `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/media`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    },
                    body: new URLSearchParams({
                        messaging_product: "whatsapp",
                        type: "image/png",
                        file: fs.createReadStream(imgPath), // stream upload
                    }),
                }
            );
            const mediaData = await mediaRes.json();
            console.log("Media upload response:", mediaData);

            // Send message with uploaded image
            await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: from,
                    type: "image",
                    image: { id: mediaData.id },
                }),
            });
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Error in webhook flow:", err);
        res.sendStatus(500);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
