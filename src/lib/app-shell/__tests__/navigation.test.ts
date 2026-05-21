import { describe, expect, it } from "vitest";

import { getPageTitleForPath, getPrimaryNavigation } from "../navigation";

describe("getPrimaryNavigation", () => {
  it("returns the core MVP navigation in the intended order with icons", () => {
    expect(getPrimaryNavigation()).toEqual([
      { href: "/", label: "Overview", icon: "insights" },
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/transactions", label: "Transactions", icon: "receipt_long" },
      { href: "/accounts", label: "Accounts", icon: "account_balance" },
      { href: "/categories", label: "Categories", icon: "label" },
      { href: "/rules", label: "Rules", icon: "rule" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ]);
  });
});

describe("getPageTitleForPath", () => {
  it.each([
    ["/", "Overview"],
    ["/dashboard", "Dashboard"],
    ["/transactions", "Transactions"],
    ["/accounts", "Accounts"],
    ["/categories", "Categories"],
    ["/rules", "Rules"],
    ["/settings", "Settings"],
  ])("maps %s to %s", (path, expected) => {
    expect(getPageTitleForPath(path)).toBe(expected);
  });

  it("returns 'yah' for an unknown path", () => {
    expect(getPageTitleForPath("/unknown")).toBe("yah");
  });
});
