import { google } from "googleapis";
import fs from "fs";
import { PDFDocument } from "pdf-lib";

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

// ✅ Crop PDF using values from .env
export async function cropPDF(inputPath, outputPath) {
    const bytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(bytes);

    // Read crop margins from .env (default 0 if not set)
    const cutLeft = parseInt(process.env.CROP_LEFT || "0", 10);
    const cutRight = parseInt(process.env.CROP_RIGHT || "0", 10);
    const cutTop = parseInt(process.env.CROP_TOP || "0", 10);
    const cutBottom = parseInt(process.env.CROP_BOTTOM || "0", 10);

    const pages = pdfDoc.getPages();
    for (const page of pages) {
        const { width, height } = page.getSize();

        const left = cutLeft;
        const bottom = cutBottom;
        const newWidth = width - cutLeft - cutRight;
        const newHeight = height - cutTop - cutBottom;

        page.setCropBox(left, bottom, newWidth, newHeight);
    }

    const croppedBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, croppedBytes);
    console.log(
        `✂️ PDF cropped with margins L:${cutLeft} R:${cutRight} T:${cutTop} B:${cutBottom} → ${outputPath}`
    );
    return outputPath;
}
