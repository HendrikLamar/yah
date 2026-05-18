import { describe, expect, it } from "vitest";

import { getDkbConnectorDescriptor } from "../dkb-connector";

describe("getDkbConnectorDescriptor", () => {
  it("reports ready_for_test when the required env vars exist", () => {
    const descriptor = getDkbConnectorDescriptor({
      DKB_FINTS_USER_ID: "demo-user",
      DKB_FINTS_PIN: "secret",
      DKB_FINTS_PRODUCT_ID: "yah-local",
    });

    expect(descriptor.status).toBe("ready_for_test");
    expect(descriptor.displayName).toBe("DKB FinTS");
    expect(descriptor.capabilities.fetchesTransactions).toBe(true);
  });

  it("reports missing_config when the live test inputs are incomplete", () => {
    const descriptor = getDkbConnectorDescriptor({
      DKB_FINTS_USER_ID: "demo-user",
    });

    expect(descriptor.status).toBe("missing_config");
    expect(descriptor.summary).toContain("Missing");
  });
});
