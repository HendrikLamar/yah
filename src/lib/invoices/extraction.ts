import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const OCR_LANGUAGES = "deu+eng";
const MIN_PDF_TEXT_LENGTH = 40;
const MAX_PDF_OCR_PAGES = 3;

type InvoiceExtractionPayload = {
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  totalAmount: number | null;
  currency: string;
};

export type InvoiceExtractionResult = InvoiceExtractionPayload & {
  text: string;
  method: "pdf-text" | "pdf-ocr" | "image-ocr" | "plain-text" | "unknown";
  confidence: number;
  documentSha256: string;
};

export function parseInvoiceMetadataFromText(text: string): InvoiceExtractionPayload {
  const normalizedText = text.replace(/\r/g, "");
  const lines = normalizedText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const invoiceNumber =
    firstRegexMatch(normalizedText, [
      /(?:rechnung\s*(?:nummer|nr\.?)|rechnungsnummer)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/.]+)/i,
      /(?:invoice\s*(?:number|no\.?))\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/.]+)/i,
    ]) ?? null;

  const invoiceDate = findDate(normalizedText, [
    /(?:rechnungsdatum|invoice date|datum)\s*[:#-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  ]);

  const dueDate = findDate(normalizedText, [
    /(?:fällig(?: am)?|zahlbar bis|due date|due)\s*[:#-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  ]);

  const totalAmount = findAmount(normalizedText);
  const vendorName = findVendorName(lines);
  const hasStructuredInvoiceSignals = Boolean(invoiceNumber || invoiceDate || dueDate || totalAmount !== null);

  return {
    vendorName: hasStructuredInvoiceSignals ? vendorName : null,
    invoiceNumber,
    invoiceDate,
    dueDate,
    totalAmount,
    currency: "EUR",
  };
}

export async function extractInvoiceMetadataFromFile(file: File, prereadBuffer?: Buffer): Promise<InvoiceExtractionResult> {
  const buffer = prereadBuffer ?? Buffer.from(await file.arrayBuffer());
  const mimeType = (file.type || guessMimeType(file.name)).toLowerCase();
  const documentSha256 = createHash("sha256").update(buffer).digest("hex");

  let text = "";
  let method: InvoiceExtractionResult["method"] = "unknown";

  if (mimeType.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
    text = await extractTextFromPdf(buffer);
    method = text.length >= MIN_PDF_TEXT_LENGTH ? "pdf-text" : "pdf-ocr";

    if (text.length < MIN_PDF_TEXT_LENGTH) {
      text = await extractTextFromPdfViaOcr(buffer);
    }
  } else if (mimeType.startsWith("image/")) {
    text = await extractTextFromImage(buffer);
    method = "image-ocr";
  } else if (mimeType.startsWith("text/")) {
    text = buffer.toString("utf8");
    method = "plain-text";
  }

  const parsed = parseInvoiceMetadataFromText(text);
  const confidence = calculateExtractionConfidence(parsed);

  return {
    ...parsed,
    text,
    method,
    confidence,
    documentSha256,
  };
}

function calculateExtractionConfidence(payload: InvoiceExtractionPayload) {
  let score = 0;

  if (payload.vendorName) score += 0.25;
  if (payload.invoiceNumber) score += 0.15;
  if (payload.invoiceDate) score += 0.2;
  if (payload.dueDate) score += 0.1;
  if (payload.totalAmount) score += 0.3;

  return Number(Math.min(1, score).toFixed(2));
}

async function extractTextFromPdf(buffer: Buffer) {
  return withTempFile(buffer, ".pdf", async (filePath) => {
    try {
      const { stdout } = await execFileAsync("pdftotext", ["-layout", "-nopgbrk", filePath, "-"]);
      return stdout.trim();
    } catch {
      return "";
    }
  });
}

async function extractTextFromPdfViaOcr(buffer: Buffer) {
  return withTempDir(async (dir) => {
    const pdfPath = path.join(dir, `document-${randomUUID()}.pdf`);
    await writeFile(pdfPath, buffer);

    try {
      await execFileAsync("pdftoppm", ["-f", "1", "-l", String(MAX_PDF_OCR_PAGES), "-png", pdfPath, path.join(dir, "page")]);
    } catch {
      throw new Error("PDF OCR is unavailable. Install poppler-utils in the app runtime.");
    }

    const pageFiles = (await readdir(dir))
      .filter((entry) => entry.startsWith("page-") && entry.endsWith(".png"))
      .sort();

    const texts = await Promise.all(
      pageFiles.map(async (pageFile) => extractTextFromImage(await readFile(path.join(dir, pageFile)))),
    );
    return texts.join("\n").trim();
  });
}

async function extractTextFromImage(buffer: Buffer) {
  return withTempFile(buffer, ".png", async (filePath) => {
    try {
      const { stdout } = await execFileAsync("tesseract", [filePath, "stdout", "-l", OCR_LANGUAGES, "--psm", "6"]);
      return stdout.trim();
    } catch {
      throw new Error("Image OCR is unavailable. Install tesseract-ocr plus German/English language packs in the app runtime.");
    }
  });
}

async function withTempFile<T>(buffer: Buffer, extension: string, callback: (filePath: string) => Promise<T>) {
  return withTempDir(async (dir) => {
    const filePath = path.join(dir, `document-${randomUUID()}${extension}`);
    await writeFile(filePath, buffer);
    return callback(filePath);
  });
}

async function withTempDir<T>(callback: (dir: string) => Promise<T>) {
  const dir = await mkdtemp(path.join(tmpdir(), "yah-invoice-"));
  try {
    return await callback(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function findVendorName(lines: string[]) {
  const candidate = lines.find((line) => {
    const lowered = line.toLowerCase();
    return (
      line.length >= 4
      && !/[0-9]{2,}/.test(line)
      && !/^(rechnung|invoice|fällig|due|betrag|gesamt|mwst|ust|steuer|seite|page)\b/i.test(lowered)
    );
  });

  return candidate ?? null;
}

function findDate(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const normalized = normalizeDate(match?.[1]);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function findAmount(text: string) {
  const labelledPattern = /(?:gesamt(?:betrag|summe)?|rechnungsbetrag|zu zahlen|summe|total(?: due)?|betrag)\s*[:#-]?\s*([0-9][0-9.\s]*,[0-9]{2}|[0-9][0-9,\s]*\.[0-9]{2})\s*(EUR|€)?/gi;
  let labelledMatch: RegExpExecArray | null = null;
  let lastLabelledAmount: number | null = null;

  while ((labelledMatch = labelledPattern.exec(text)) !== null) {
    const amount = normalizeAmount(labelledMatch[1]);
    if (amount !== null) {
      lastLabelledAmount = amount;
    }
  }

  if (lastLabelledAmount !== null) {
    return lastLabelledAmount;
  }

  const fallbackAmounts: number[] = [];
  const fallbackPattern = /([0-9][0-9.\s]*,[0-9]{2}|[0-9][0-9,\s]*\.[0-9]{2})\s*(EUR|€)?/g;
  let fallbackMatch: RegExpExecArray | null = null;
  while ((fallbackMatch = fallbackPattern.exec(text)) !== null) {
    const amount = normalizeAmount(fallbackMatch[1]);
    if (amount !== null) {
      fallbackAmounts.push(amount);
    }
  }

  return fallbackAmounts.length > 0 ? Math.max(...fallbackAmounts) : null;
}

function normalizeDate(raw?: string | null) {
  if (!raw) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!match) {
    return null;
  }

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${month}-${day}`;
}

function normalizeAmount(raw: string) {
  const cleaned = raw.replace(/\s+/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function firstRegexMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1]?.trim();
    if (match) {
      return match;
    }
  }

  return null;
}

function guessMimeType(fileName: string) {
  if (fileName.toLowerCase().endsWith(".pdf")) {
    return "application/pdf";
  }

  return "application/octet-stream";
}
