import express from "express";
import bodyParser from "body-parser";
import { exportRangeAsPNG } from "./sheets.js";
import fs from "fs";

const app = express();
app.use(bodyParser.json());

// ENV variables
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

app.post("/webhook", async (req, res) => {
    try {
        const body = req.body;
        console.log("Webhook received:", JSON.stringify(body, null, 2));

        if (body.object === "whatsapp_business_account") {
            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const messages = changes?.value?.messages;

            if (messages && messages[0]) {
                const from = messages[0].from;
                const text = messages[0].text?.body?.toLowerCase() || "";

                if (text.includes("timetable")) {
                    const outputPath = `./timetable_${Date.now()}.png`;
                    await exportRangeAsPNG(SPREADSHEET_ID, "408465234", outputPath);

                    await sendImage(from, outputPath);
                    fs.unlinkSync(outputPath);
                }
            }
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Error in webhook flow:", err);
        res.sendStatus(500);
    }
});

// ✅ send image via WhatsApp
async function sendImage(to, filePath) {
    const url = "https://graph.facebook.com/v20.0/me/messages";
    const data = {
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: {
            link: `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/static/${filePath.split("/").pop()}`
        },
    };

    await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    console.log("📤 Image sent to", to);
}

// Serve static files (images)
app.use("/static", express.static("./"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
