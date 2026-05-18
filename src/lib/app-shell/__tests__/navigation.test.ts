import { describe, expect, it } from "vitest";

import { getPrimaryNavigation } from "../navigation";

describe("getPrimaryNavigation", () => {
  it("returns the core MVP navigation in the intended order", () => {
    expect(getPrimaryNavigation()).toEqual([
      { href: "/", label: "Overview" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/transactions", label: "Transactions" },
      { href: "/rules", label: "Rules" },
      { href: "/categories", label: "Categories" },
      { href: "/accounts", label: "Accounts" },
      { href: "/settings", label: "Settings" },
    ]);
  });
});
