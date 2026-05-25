import { describe, expect, it } from "vitest";

import {
  isWithin,
  nextPeriod,
  periodBoundsForDate,
  previousPeriod,
} from "../period";

describe("periodBoundsForDate", () => {
  it("computes a MONTHLY bound that ends on the last day of the month", () => {
    const bounds = periodBoundsForDate("MONTHLY", new Date("2026-02-15T12:00:00Z"));
    expect(bounds.start.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(bounds.end.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("handles February in a leap year correctly", () => {
    const bounds = periodBoundsForDate("MONTHLY", new Date("2024-02-15T12:00:00Z"));
    expect(bounds.end.toISOString().slice(0, 10)).toBe("2024-02-29");
  });

  it("QUARTERLY bounds align to calendar quarters", () => {
    const q1 = periodBoundsForDate("QUARTERLY", new Date("2026-02-15T12:00:00Z"));
    expect(q1.start.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(q1.end.toISOString().slice(0, 10)).toBe("2026-03-31");

    const q3 = periodBoundsForDate("QUARTERLY", new Date("2026-08-15T12:00:00Z"));
    expect(q3.start.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(q3.end.toISOString().slice(0, 10)).toBe("2026-09-30");
  });

  it("YEARLY bounds span the calendar year", () => {
    const bounds = periodBoundsForDate("YEARLY", new Date("2026-06-15T12:00:00Z"));
    expect(bounds.start.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(bounds.end.toISOString().slice(0, 10)).toBe("2026-12-31");
  });

  it("previous/next walk back and forth without overlap", () => {
    const current = periodBoundsForDate("MONTHLY", new Date("2026-03-15Z"));
    const prev = previousPeriod("MONTHLY", current);
    const next = nextPeriod("MONTHLY", current);
    expect(prev.end.getTime()).toBeLessThan(current.start.getTime());
    expect(next.start.getTime()).toBeGreaterThan(current.end.getTime());
    expect(prev.start.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(next.start.toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("DST-style boundary on a March transition holds in UTC", () => {
    const current = periodBoundsForDate("MONTHLY", new Date("2026-03-31T23:30:00Z"));
    expect(current.end.toISOString().slice(0, 10)).toBe("2026-03-31");
    expect(isWithin(new Date("2026-03-31T22:00:00Z"), current)).toBe(true);
    expect(isWithin(new Date("2026-04-01T00:00:01Z"), current)).toBe(false);
  });
});
