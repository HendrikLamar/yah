export type InvoiceFallbackInput = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

export type InvoiceFallbackPayload = {
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  totalAmount: number | null;
  currency: string;
};

export type InvoiceFallbackResult = {
  payload: InvoiceFallbackPayload;
  provider: string;
  model: string;
};

export type InvoiceFallbackProvider = (
  input: InvoiceFallbackInput,
) => Promise<InvoiceFallbackResult>;

export type FallbackDecisionInput = {
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  totalAmount: number | null;
  confidence: number;
};

export const FALLBACK_CONFIDENCE_THRESHOLD = 0.4;

export function shouldRunFallback(input: FallbackDecisionInput): boolean {
  const missingRequired =
    !input.vendorName ||
    !input.invoiceNumber ||
    !input.invoiceDate ||
    input.totalAmount === null;
  return missingRequired && input.confidence < FALLBACK_CONFIDENCE_THRESHOLD;
}

export function isFallbackConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.INVOICE_AI_FALLBACK_ENABLED !== "true") return false;
  if (!env.ANTHROPIC_API_KEY) return false;
  return true;
}

export function validateFallbackPayload(value: unknown): InvoiceFallbackPayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const vendorName = optionalString(record.vendorName);
  const invoiceNumber = optionalString(record.invoiceNumber);
  const invoiceDate = optionalIsoDate(record.invoiceDate);
  const dueDate = optionalIsoDate(record.dueDate);
  const totalAmount = optionalNumber(record.totalAmount);
  const currency = optionalString(record.currency) ?? "EUR";

  return {
    vendorName,
    invoiceNumber,
    invoiceDate,
    dueDate,
    totalAmount,
    currency,
  };
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function optionalIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export async function callAnthropicVisionFallback(
  input: InvoiceFallbackInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<InvoiceFallbackResult> {
  if (!isFallbackConfigured(env)) {
    throw new Error("Invoice AI fallback is not configured.");
  }

  const model = env.INVOICE_AI_FALLBACK_MODEL ?? "claude-haiku-4-5-20251001";
  const apiKey = env.ANTHROPIC_API_KEY as string;

  const dataUri = `data:${input.mimeType};base64,${input.buffer.toString("base64")}`;

  const body = {
    model,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "url", url: dataUri },
          },
          {
            type: "text",
            text: `Extract invoice metadata from this document. Respond with ONLY a JSON object (no prose, no code fence) matching this shape:
{
  "vendorName": string | null,
  "invoiceNumber": string | null,
  "invoiceDate": "YYYY-MM-DD" | null,
  "dueDate": "YYYY-MM-DD" | null,
  "totalAmount": number | null,
  "currency": "EUR" | "USD" | "GBP" | "CHF" | string | null
}
Use null when a field is not present. Numbers must be plain decimals (no currency symbols).`,
          },
        ],
      },
    ],
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const textBlock = json.content?.find((c) => c.type === "text");
  if (!textBlock?.text) {
    throw new Error("Anthropic API returned no text content.");
  }

  const parsed = safeJsonParse(textBlock.text);
  const payload = validateFallbackPayload(parsed);
  if (!payload) {
    throw new Error("AI fallback returned an invalid payload.");
  }

  return { payload, provider: "anthropic", model };
}

function safeJsonParse(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
