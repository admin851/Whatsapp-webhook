// sheets.js
import { google } from "googleapis";
import fs from "fs";

// ✅ Authenticate with Google Sheets using service account JSON file
function getAuth() {
    return new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
        scopes: [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ],
    });
}

// ✅ Update a single cell (overwrite A1 with teacher name)
export async function updateCell(spreadsheetId, range, value) {
    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // First clear the range
    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
    });

    // Then write value
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        resource: { values: [[value]] }
    });

    console.log(`✅ Updated ${range} with ${value}`);
}

// ✅ Export defined range as PDF
export async function exportSheetAsPDF(spreadsheetId, sheetGid, outputPath) {
    const auth = await getAuth();

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=pdf&gid=${sheetGid}&range=A1:J16`;

    const res = await auth.request({ url, responseType: "stream" });

    const dest = fs.createWriteStream(outputPath);
    await new Promise((resolve, reject) => {
        res.data.pipe(dest).on("finish", resolve).on("error", reject);
    });

    console.log("✅ PDF exported:", outputPath);
    return outputPath;
}
