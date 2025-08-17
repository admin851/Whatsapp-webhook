// sheets.js
import { google } from "googleapis";
import fs from "fs";

// Authenticate with Google Sheets using service account JSON file
function getAuth() {
    return new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_CREDENTIALS_PATH, // secret file path
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
}

// Append a new row to a sheet
export async function appendRow(spreadsheetId, range, values) {
    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const request = {
        spreadsheetId,
        range, // e.g. "Sheet1!A:C"
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        resource: {
            values: [values],
        },
    };

    try {
        const response = await sheets.spreadsheets.values.append(request);
        console.log("✅ Row added:", response.data.updates);
        return response.data;
    } catch (error) {
        console.error("❌ Error appending row:", error);
        throw error;
    }
}
