import { fromPath } from "pdf2pic";
import path from "path";

export async function convertPDFToImage(pdfPath, outputPath) {
    const options = {
        density: 150,   // DPI (higher = clearer, bigger file)
        saveFilename: path.basename(outputPath, path.extname(outputPath)),
        savePath: path.dirname(outputPath),
        format: "png",
        width: 1000,    // adjust as needed
        height: 1414,
    };

    const storeAsImage = fromPath(pdfPath, options);

    try {
        const result = await storeAsImage(1); // ✅ FIX: removed `true`
        console.log("✅ PDF converted to image:", result.path);
        return result.path;
    } catch (err) {
        console.error("❌ PDF to Image conversion failed:", err);
        throw err;
    }
}
