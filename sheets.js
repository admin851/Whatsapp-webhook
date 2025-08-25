// sheets.js
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import sharp from "sharp";

// -------------------- Auth --------------------
function getAuth() {
    return new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
        scopes: [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive.readonly",
        ],
    });
}

// -------------------- Update Cell (clear first) --------------------
export async function updateCell(spreadsheetId, range, value) {
    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.clear({ spreadsheetId, range });
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        resource: { values: [[value]] },
    });

    console.log(`✅ Updated ${range} with ${value}`);
}

// -------------------- Export A1:J16 as PNG (page-filled) --------------------
// We export as PDF using tuned print params (fit-to-width, landscape, zero margins),
// then convert the first page to PNG using sharp, and return the PNG file path.
export async function exportRangeAsPNG(spreadsheetId, sheetGid, outputPngPath) {
    const auth = await getAuth();
    const gid = String(sheetGid);

    // Print/Export parameters to make the table fill the page nicely.
    // Notes:
    // - portrait=false  -> Landscape
    // - fitw=true       -> Fit to width
    // - scale=4         -> "Actual size" style zoom (keeps it large without cropping)
    // - margins set to 0 (can switch to Narrow by using 0.25/0.5 if you prefer)
    // - gridlines=false, sheetnames=false, pagenum=UNDEFINED to keep it clean
    const url =
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?` +
        `format=pdf&gid=${encodeURIComponent(gid)}&range=A1:J16` +
        `&size=A4&portrait=false&fitw=true&scale=4` +
        `&top_margin=0.00&bottom_margin=0.00&left_margin=0.00&right_margin=0.00` +
        `&horizontal_alignment=CENTER&vertical_alignment=CENTER` +
        `&gridlines=false&printtitle=false&sheetnames=false&pagenum=UNDEFINED`;

    // Download PDF to a temp file
    const pdfTmp = path.resolve(`./tmp_export_${Date.now()}.pdf`);
    const res = await (await auth.getClient()).request({ url, responseType: "stream" });
    await new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(pdfTmp);
        res.data.pipe(dest).on("finish", resolve).on("error", reject);
    });

    // Convert first page to PNG (300 DPI for clarity)
    await sharp(pdfTmp, { density: 300 }).png().toFile(outputPngPath);
    console.log("✅ PNG exported:", outputPngPath);

    // Cleanup temp PDF
    try { fs.unlinkSync(pdfTmp); } catch { }

    return outputPngPath;
}
