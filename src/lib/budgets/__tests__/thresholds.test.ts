import { describe, expect, it } from "vitest";

import { crossedThresholds, DEFAULT_THRESHOLDS } from "../thresholds";

describe("crossedThresholds", () => {
  it("returns nothing when below the lowest threshold", () => {
    expect(crossedThresholds(70, 100)).toEqual([]);
  });

  it("fires only the 0.80 alert at 80% spent", () => {
    expect(crossedThresholds(80, 100).map((c) => c.threshold)).toEqual([0.8]);
  });

  it("fires 0.80 and 1.00 once spent meets the cap", () => {
    expect(crossedThresholds(100, 100).map((c) => c.threshold)).toEqual([0.8, 1.0]);
  });

  it("fires all three when spent exceeds the 1.20 line", () => {
    expect(crossedThresholds(125, 100).map((c) => c.threshold)).toEqual(DEFAULT_THRESHOLDS as unknown as number[]);
  });

  it("returns nothing when the limit is non-positive", () => {
    expect(crossedThresholds(50, 0)).toEqual([]);
  });

  it("respects a custom threshold set", () => {
    expect(
      crossedThresholds(60, 100, [0.5, 1.0]).map((c) => c.threshold),
    ).toEqual([0.5]);
  });
});
