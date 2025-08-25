import fs from "fs";
import { google } from "googleapis";
import sharp from "sharp";

export async function exportRangeAsImage(spreadsheetId, sheetGid, outputPath) {
    const auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json", // service account JSON
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    // 1. Export as PDF
    const res = await drive.files.export(
        {
            fileId: spreadsheetId,
            mimeType: "application/pdf",
        },
        { responseType: "arraybuffer" }
    );

    const pdfPath = outputPath.replace(".png", ".pdf");
    fs.writeFileSync(pdfPath, Buffer.from(res.data));
    console.log(`✅ PDF saved at ${pdfPath}`);

    // 2. Convert PDF → PNG (no crop/resize)
    await sharp(pdfPath, { density: 300 }) // high resolution
        .png()
        .toFile(outputPath);

    console.log(`✅ PNG saved at ${outputPath}`);
    return outputPath;
}
