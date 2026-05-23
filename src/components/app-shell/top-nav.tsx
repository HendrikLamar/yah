"use client";

import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getPageTitleForPath } from "@/lib/app-shell/navigation";

import { useMobileSidebar } from "./mobile-sidebar-context";

type TopNavProps = {
  viewer: {
    displayName: string;
    email: string;
    householdName: string | null;
  } | null;
};

export function TopNav({ viewer }: TopNavProps) {
  const pathname = usePathname();
  const { toggle } = useMobileSidebar();
  const title = getPageTitleForPath(pathname);

  return (
    <header className="fixed top-0 left-0 right-0 lg:left-64 h-16 bg-surface border-b border-outline-variant z-40 px-lg flex items-center justify-between">
      <div className="flex items-center gap-md">
        <button
          aria-label="Open menu"
          className="lg:hidden p-xs rounded-lg hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          onClick={toggle}
          type="button"
        >
          <Icon name="menu" />
        </button>
        <p className="text-headline-sm font-bold text-primary">{title}</p>
      </div>

      <div className="flex items-center gap-md">
        {viewer ? (
          <div
            aria-label={`Signed in as ${viewer.displayName}${viewer.householdName ? ` (${viewer.householdName})` : ""}`}
            className="flex items-center gap-sm"
          >
            <div className="w-8 h-8 rounded-[9999px] border border-outline-variant flex items-center justify-center bg-surface-container-low">
              <Icon name="account_circle" />
            </div>
            <div className="hidden sm:block">
              <div className="text-body-sm font-semibold text-on-surface">
                {viewer.displayName}
              </div>
              <div className="text-body-sm text-on-surface-variant">
                {viewer.householdName ?? "No household"}
              </div>
            </div>
          </div>
        ) : (
          <Button variant="pill" size="sm" as="link" href="/settings">
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
