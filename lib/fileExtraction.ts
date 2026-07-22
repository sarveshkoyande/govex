import mammoth from "mammoth";
import JSZip from "jszip";

// Server-side text extraction for files pushed by the Power Automate
// OneDrive/SharePoint flow (see app/api/ingest/route.ts) — one library per
// format, no OCR, no layout preservation. A scanned (image-only) PDF comes
// back empty; callers should treat that as a failed extraction, never
// silently ingest zero-length text.
export type SupportedFileFormat = "txt" | "md" | "docx" | "pdf" | "pptx";

const EXTENSION_MAP: Record<string, SupportedFileFormat> = {
  txt: "txt",
  md: "md",
  docx: "docx",
  pdf: "pdf",
  pptx: "pptx",
};

export function detectFileFormat(fileName: string): SupportedFileFormat | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] ?? null;
}

// pptx has no ready-made "just give me the text" library worth adding for
// this — it's a zip of per-slide XML, and the text runs are always <a:t>
// elements, so unzip + regex is simpler and lighter than a full OOXML parser.
async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(/slide(\d+)\.xml$/.exec(a)![1], 10);
      const nb = parseInt(/slide(\d+)\.xml$/.exec(b)![1], 10);
      return na - nb;
    });

  const slideTexts: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("string");
    const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    if (runs.length > 0) slideTexts.push(runs.join(" "));
  }
  return slideTexts.map((text, i) => `Slide ${i + 1}: ${text}`).join("\n\n");
}

export async function extractText(fileName: string, buffer: Buffer): Promise<string> {
  const format = detectFileFormat(fileName);
  if (!format) {
    throw new Error(`Unsupported file type: "${fileName}". Supported: txt, md, docx, pdf, pptx.`);
  }

  switch (format) {
    case "txt":
    case "md":
      return buffer.toString("utf-8");
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "pdf": {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text;
    }
    case "pptx":
      return extractPptxText(buffer);
  }
}
