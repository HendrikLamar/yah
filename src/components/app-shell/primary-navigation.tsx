"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getPrimaryNavigation } from "@/lib/app-shell/navigation";

export function PrimaryNavigation() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {getPrimaryNavigation().map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "rounded-full px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-emerald-400 text-slate-950"
                : "bg-slate-800 text-slate-200 hover:bg-slate-700",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
