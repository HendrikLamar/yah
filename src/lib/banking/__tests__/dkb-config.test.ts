import { describe, expect, it } from "vitest";

import {
  DKB_DEFAULT_BANK_IDENTIFIER,
  DKB_DEFAULT_SERVER,
  getDkbConnectionStatus,
  parseDkbConfig,
} from "../dkb-config";

describe("parseDkbConfig", () => {
  it("uses DKB defaults when optional values are omitted", () => {
    const result = parseDkbConfig({
      DKB_FINTS_USER_ID: "demo-user",
      DKB_FINTS_PIN: "secret",
      DKB_FINTS_PRODUCT_ID: "yah-local",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected config to parse");
    }

    expect(result.config.bankIdentifier).toBe(DKB_DEFAULT_BANK_IDENTIFIER);
    expect(result.config.server).toBe(DKB_DEFAULT_SERVER);
    expect(result.config.customerId).toBe("demo-user");
    expect(result.config.days).toBe(30);
  });

  it("returns missing required keys instead of throwing", () => {
    const result = parseDkbConfig({
      DKB_FINTS_USER_ID: "demo-user",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected parse failure");
    }

    expect(result.missingKeys).toEqual([
      "DKB_FINTS_PIN",
      "DKB_FINTS_PRODUCT_ID",
    ]);
  });
});

describe("getDkbConnectionStatus", () => {
  it("reports ready when the required credentials are present", () => {
    const result = getDkbConnectionStatus({
      DKB_FINTS_USER_ID: "demo-user",
      DKB_FINTS_PIN: "secret",
      DKB_FINTS_PRODUCT_ID: "yah-local",
    });

    expect(result.state).toBe("ready");
    expect(result.summary).toContain("Ready for live DKB FinTS test");
  });

  it("reports partial when credentials are incomplete", () => {
    const result = getDkbConnectionStatus({
      DKB_FINTS_USER_ID: "demo-user",
      DKB_FINTS_PRODUCT_ID: "yah-local",
    });

    expect(result.state).toBe("partial");
    expect(result.missingKeys).toEqual(["DKB_FINTS_PIN"]);
    expect(result.summary).toContain("Missing");
  });

  it("reports missing when nothing is configured", () => {
    const result = getDkbConnectionStatus({});

    expect(result.state).toBe("missing");
    expect(result.missingKeys).toEqual([
      "DKB_FINTS_USER_ID",
      "DKB_FINTS_PIN",
      "DKB_FINTS_PRODUCT_ID",
    ]);
  });
});
