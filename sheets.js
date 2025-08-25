// sheets.js
import { google } from "googleapis";
import fs from "fs";
import path from "path";

// Authenticate with Google Sheets using service account JSON file
function getAuth() {
    return new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_CREDENTIALS_PATH, // path to service account file
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
}

// ✅ Update teacher name in A1 and export as PDF
export async function updateTeacherAndExportPDF(spreadsheetId, teacherName) {
    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    // Step 1: Update A1 with teacher name
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "'Print (Teacher)'!A1",
        valueInputOption: "USER_ENTERED",
        resource: {
            values: [[teacherName]],
        },
    });

    console.log(`✏️ Updated 'Print (Teacher)'!A1 with ${teacherName}`);

    // Step 2: Export as PDF using Drive API
    const drive = google.drive({ version: "v3", auth });
    const destPath = path.resolve(`./timetable.pdf`);
    const dest = fs.createWriteStream(destPath);

    await new Promise((resolve, reject) => {
        drive.files
            .export(
                {
                    fileId: spreadsheetId,
                    mimeType: "application/pdf",
                },
                { responseType: "stream" }
            )
            .then((res) => {
                res.data
                    .on("end", () => {
                        console.log(`✅ PDF saved at ${destPath}`);
                        resolve();
                    })
                    .on("error", (err) => {
                        console.error("❌ Error downloading PDF:", err);
                        reject(err);
                    })
                    .pipe(dest);
            });
    });

    return destPath;
}
