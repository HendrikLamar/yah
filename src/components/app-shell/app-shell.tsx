import type { ReactNode } from "react";

import { getCurrentViewer } from "@/lib/auth/session";

import { MobileSidebarProvider } from "./mobile-sidebar-context";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const viewer = await getCurrentViewer();
  const viewerProps = viewer
    ? {
        displayName: viewer.displayName,
        email: viewer.email,
        householdName: viewer.householdName,
      }
    : null;

  return (
    <MobileSidebarProvider>
      <div className="min-h-screen bg-background">
        <Sidebar viewer={viewerProps} />
        <TopNav viewer={viewerProps} />
        <main className="pt-16 lg:ml-64 px-gutter">
          <div className="mx-auto max-w-[1280px] py-lg">{children}</div>
        </main>
      </div>
    </MobileSidebarProvider>
  );
}
