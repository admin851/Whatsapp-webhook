import fs from "fs";
import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
});

const sheets = google.sheets({ version: "v4", auth });
const drive = google.drive({ version: "v3", auth });

/**
 * Writes teacher name in A1 of "Print (Teacher)" sheet
 */
export async function setTeacherName(spreadsheetId, teacherName) {
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Print (Teacher)!A1",
        valueInputOption: "RAW",
        requestBody: {
            values: [[teacherName]],
        },
    });
}

/**
 * Exports timetable sheet as PDF and saves locally
 */
export async function exportTimetableAsPDF(spreadsheetId, sheetGid = "0") {
    const destPath = "./timetable.pdf";
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?` +
        new URLSearchParams({
            format: "pdf",
            portrait: "false",
            size: "A4",
            gid: sheetGid,
        });

    const res = await drive.files.export(
        { fileId: spreadsheetId, mimeType: "application/pdf" },
        { responseType: "stream" }
    );

    return new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(destPath);
        res.data
            .on("end", () => resolve(destPath))
            .on("error", reject)
            .pipe(dest);
    });
}
