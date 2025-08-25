import fs from "fs";
import path from "path";
import { google } from "googleapis";
import sharp from "sharp";

const KEYFILEPATH = "./credentials.json"; // your service account key

// Auth
async function getAuth() {
    return new google.auth.GoogleAuth({
        keyFile: KEYFILEPATH,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
}

// ✅ Export timetable as PNG (not PDF)
export async function exportRangeAsPNG(spreadsheetId, sheetGid, outputPngPath) {
    const auth = await getAuth();
    const client = await auth.getClient();

    const url =
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?` +
        `format=pdf&gid=${encodeURIComponent(sheetGid)}&range=A1:J16` +
        `&size=A4&portrait=false&fitw=true&scale=4` +
        `&top_margin=0.00&bottom_margin=0.00&left_margin=0.00&right_margin=0.00` +
        `&horizontal_alignment=CENTER&vertical_alignment=CENTER` +
        `&gridlines=false&printtitle=false&sheetnames=false&pagenum=UNDEFINED`;

    const pdfTmp = path.resolve(`./tmp_export_${Date.now()}.pdf`);
    const res = await client.request({ url, responseType: "arraybuffer" });
    fs.writeFileSync(pdfTmp, Buffer.from(res.data));

    // Convert PDF → PNG
    await sharp(pdfTmp, { density: 300, page: 0 })
        .png()
        .toFile(outputPngPath);

    console.log("✅ PNG exported:", outputPngPath);

    try {
        fs.unlinkSync(pdfTmp);
    } catch { }

    return outputPngPath;
}
