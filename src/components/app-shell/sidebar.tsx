"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getPrimaryNavigation } from "@/lib/app-shell/navigation";

import { useMobileSidebar } from "./mobile-sidebar-context";

type SidebarProps = {
  viewer: {
    displayName: string;
    email: string;
    householdName: string | null;
  } | null;
};

export function Sidebar({ viewer }: SidebarProps) {
  const pathname = usePathname();
  const { isOpen, close } = useMobileSidebar();
  const items = getPrimaryNavigation();

  const translateClass = isOpen ? "translate-x-0" : "-translate-x-full";

  return (
    <aside
      id="primary-sidebar"
      aria-label="Primary navigation"
      aria-modal={isOpen ? true : undefined}
      role={isOpen ? "dialog" : undefined}
      className={[
        "fixed inset-y-0 left-0 w-64 bg-surface-container-low border-r border-outline-variant z-50",
        "flex flex-col transition-transform duration-200",
        translateClass,
        "lg:translate-x-0",
      ].join(" ")}
    >
      <div className="p-lg border-b border-outline-variant">
        <div className="flex items-center gap-sm">
          <Icon name="account_balance" className="text-secondary" />
          <span className="text-headline-md text-primary">yah</span>
        </div>
        <p className="mt-xs text-label-md text-on-surface-variant uppercase tracking-wider">
          yet another haushaltsbuch
        </p>
      </div>

      <nav aria-label="Main" className="flex flex-col gap-xs py-lg flex-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const classes = [
            "flex items-center gap-md px-md py-sm text-label-md transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2",
            active
              ? "text-secondary font-bold border-r-4 border-secondary bg-surface-container-high"
              : "text-on-surface-variant hover:text-primary hover:bg-surface-container-high",
          ].join(" ");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={classes}
              onClick={close}
            >
              <Icon name={item.icon} filled={active} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-lg border-t border-outline-variant">
        {viewer ? (
          <form action={logoutAction}>
            <Button variant="ghost" size="sm" icon="logout" type="submit">
              Sign out
            </Button>
          </form>
        ) : (
          <Button variant="secondary" size="sm" icon="login" as="link" href="/settings">
            Sign in
          </Button>
        )}
      </div>
    </aside>
  );
}
