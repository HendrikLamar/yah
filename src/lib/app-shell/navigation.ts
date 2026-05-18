export type NavigationItem = {
  href: string;
  label: string;
};

const PRIMARY_NAVIGATION: NavigationItem[] = [
  { href: "/", label: "Overview" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/rules", label: "Rules" },
  { href: "/categories", label: "Categories" },
  { href: "/accounts", label: "Accounts" },
  { href: "/settings", label: "Settings" },
];

export function getPrimaryNavigation(): NavigationItem[] {
  return PRIMARY_NAVIGATION;
}
