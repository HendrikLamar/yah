import { describe, expect, it } from "vitest";

import {
  FALLBACK_CONFIDENCE_THRESHOLD,
  isFallbackConfigured,
  shouldRunFallback,
  validateFallbackPayload,
} from "../ai-fallback";

describe("shouldRunFallback", () => {
  it("returns true when required fields are missing and confidence is below threshold", () => {
    expect(
      shouldRunFallback({
        vendorName: null,
        invoiceNumber: null,
        invoiceDate: null,
        totalAmount: null,
        confidence: 0,
      }),
    ).toBe(true);
  });

  it("returns false when all required fields are present", () => {
    expect(
      shouldRunFallback({
        vendorName: "Acme",
        invoiceNumber: "INV-1",
        invoiceDate: "2026-05-01",
        totalAmount: 100,
        confidence: 0.1,
      }),
    ).toBe(false);
  });

  it("returns false when confidence meets or exceeds threshold even if fields are missing", () => {
    expect(
      shouldRunFallback({
        vendorName: null,
        invoiceNumber: null,
        invoiceDate: null,
        totalAmount: null,
        confidence: FALLBACK_CONFIDENCE_THRESHOLD,
      }),
    ).toBe(false);
  });
});

describe("isFallbackConfigured", () => {
  it("requires both the flag and the API key", () => {
    expect(isFallbackConfigured({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isFallbackConfigured({ INVOICE_AI_FALLBACK_ENABLED: "true" } as never),
    ).toBe(false);
    expect(
      isFallbackConfigured({ ANTHROPIC_API_KEY: "sk-xxx" } as never),
    ).toBe(false);
    expect(
      isFallbackConfigured({
        INVOICE_AI_FALLBACK_ENABLED: "true",
        ANTHROPIC_API_KEY: "sk-xxx",
      } as never),
    ).toBe(true);
  });

  it("rejects flag values other than 'true'", () => {
    expect(
      isFallbackConfigured({
        INVOICE_AI_FALLBACK_ENABLED: "1",
        ANTHROPIC_API_KEY: "sk-xxx",
      } as never),
    ).toBe(false);
  });
});

describe("validateFallbackPayload", () => {
  it("rejects non-objects", () => {
    expect(validateFallbackPayload(null)).toBeNull();
    expect(validateFallbackPayload("string")).toBeNull();
    expect(validateFallbackPayload(42)).toBeNull();
  });

  it("coerces strings to numbers and normalises empty strings to null", () => {
    const result = validateFallbackPayload({
      vendorName: " Acme ",
      invoiceNumber: "",
      invoiceDate: "2026-05-01",
      dueDate: "2026-05-15",
      totalAmount: "123,45",
      currency: "EUR",
    });
    expect(result).toEqual({
      vendorName: "Acme",
      invoiceNumber: null,
      invoiceDate: "2026-05-01",
      dueDate: "2026-05-15",
      totalAmount: 123.45,
      currency: "EUR",
    });
  });

  it("rejects malformed dates", () => {
    const result = validateFallbackPayload({
      vendorName: "Acme",
      invoiceNumber: "INV-1",
      invoiceDate: "01/05/2026",
      dueDate: null,
      totalAmount: 100,
      currency: "EUR",
    });
    expect(result?.invoiceDate).toBeNull();
  });
});
