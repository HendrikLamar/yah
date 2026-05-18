import type { ReactNode } from "react";

import { PrimaryNavigation } from "./primary-navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-black/20">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
              yah · yet another haushaltsbuch
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Household finance manager scaffold
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                Built for a shared household with personal plus common DKB accounts,
                starting with a safe connection spike before the full importer.
              </p>
            </div>
          </div>
          <PrimaryNavigation />
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
