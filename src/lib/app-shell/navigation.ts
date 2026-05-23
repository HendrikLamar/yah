import type { IconName } from "@/components/ui/icon";

export type NavigationItem = {
  href: string;
  label: string;
  icon: IconName;
};

const PRIMARY_NAVIGATION: NavigationItem[] = [
  { href: "/", label: "Overview", icon: "insights" },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/transactions", label: "Transactions", icon: "receipt_long" },
  { href: "/invoices", label: "Invoices", icon: "request_quote" },
  { href: "/accounts", label: "Accounts", icon: "account_balance" },
  { href: "/categories", label: "Categories", icon: "label" },
  { href: "/rules", label: "Rules", icon: "rule" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function getPrimaryNavigation(): NavigationItem[] {
  return PRIMARY_NAVIGATION;
}

export function getPageTitleForPath(pathname: string): string {
  const exact = PRIMARY_NAVIGATION.find((entry) => entry.href === pathname);
  if (exact) {
    return exact.label;
  }

  const nested = PRIMARY_NAVIGATION
    .filter((entry) => entry.href !== "/" && pathname.startsWith(`${entry.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0];

  return nested?.label ?? "yah";
}
