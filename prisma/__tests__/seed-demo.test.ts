import { describe, expect, it } from "vitest";

import { shouldSeedDemoData } from "../seed-demo";

describe("shouldSeedDemoData", () => {
  it("defaults to false unless explicitly enabled", () => {
    expect(shouldSeedDemoData({})).toBe(false);
    expect(shouldSeedDemoData({ ENABLE_DEMO_DATA: "false" })).toBe(false);
  });

  it("only enables demo seeding for an explicit true flag", () => {
    expect(shouldSeedDemoData({ ENABLE_DEMO_DATA: "true" })).toBe(true);
  });
});