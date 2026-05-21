export type NavigationItem = {
  href: string;
  label: string;
  icon: string;
};

const PRIMARY_NAVIGATION: NavigationItem[] = [
  { href: "/", label: "Overview", icon: "insights" },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/transactions", label: "Transactions", icon: "receipt_long" },
  { href: "/accounts", label: "Accounts", icon: "account_balance" },
  { href: "/categories", label: "Categories", icon: "label" },
  { href: "/rules", label: "Rules", icon: "rule" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function getPrimaryNavigation(): NavigationItem[] {
  return PRIMARY_NAVIGATION;
}

export function getPageTitleForPath(pathname: string): string {
  const item = PRIMARY_NAVIGATION.find((entry) => entry.href === pathname);
  return item?.label ?? "yah";
}
