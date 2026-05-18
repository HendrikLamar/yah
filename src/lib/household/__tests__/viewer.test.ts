import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentViewer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

import { getViewerHouseholdContext } from "../viewer";

vi.mock("@/lib/auth/session", () => ({
  getCurrentViewer: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    household: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

describe("getViewerHouseholdContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users instead of falling back to demo household data", async () => {
    vi.mocked(getCurrentViewer).mockResolvedValue(null);

    await expect(getViewerHouseholdContext()).rejects.toThrow(
      "REDIRECT:/settings?error=Bitte+einloggen",
    );
    expect(prisma.household.findUnique).not.toHaveBeenCalled();
  });

  it("returns the signed-in viewer household context", async () => {
    vi.mocked(getCurrentViewer).mockResolvedValue({
      userId: "user-1",
      email: "hendrik@example.local",
      displayName: "Hendrik",
      householdId: "household-1",
      householdName: "Hendrik Haushalt",
    });

    await expect(getViewerHouseholdContext()).resolves.toEqual({
      householdId: "household-1",
      householdName: "Hendrik Haushalt",
      viewer: {
        userId: "user-1",
        email: "hendrik@example.local",
        displayName: "Hendrik",
        householdId: "household-1",
        householdName: "Hendrik Haushalt",
      },
    });
    expect(prisma.household.findUnique).not.toHaveBeenCalled();
  });
});