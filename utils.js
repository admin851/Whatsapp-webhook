import pdf from "pdf-poppler";
import path from "path";

// Convert first page of PDF to PNG
export async function convertPDFToImage(pdfPath, outputPath) {
    const opts = {
        format: "png",
        out_dir: path.dirname(outputPath),
        out_prefix: path.basename(outputPath, path.extname(outputPath)),
        page: 1,
    };

    try {
        await pdf.convert(pdfPath, opts);
        console.log("✅ PDF converted to image:", outputPath);
    } catch (err) {
        console.error("❌ PDF to Image conversion failed:", err);
        throw err;
    }
}
