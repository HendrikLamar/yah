import { redirect } from "next/navigation";

import { getCurrentViewer } from "@/lib/auth/session";

const LOGIN_REQUIRED_REDIRECT = "/settings?error=Bitte+einloggen";

export type ViewerHouseholdContext = {
  householdId: string;
  householdName: string;
  viewer: Awaited<ReturnType<typeof getCurrentViewer>>;
};

export async function getViewerHouseholdContext(): Promise<ViewerHouseholdContext> {
  const viewer = await getCurrentViewer();

  if (viewer?.householdId && viewer.householdName) {
    return {
      householdId: viewer.householdId,
      householdName: viewer.householdName,
      viewer,
    };
  }

  redirect(LOGIN_REQUIRED_REDIRECT);
}

type Viewer = ViewerHouseholdContext["viewer"];

type AccountVisibilityFilter =
  | {
      OR: [
        { visibilityOwnerType: "SHARED" },
        { visibilityOwnerUserId: string },
        { shares: { some: { sharedWithUserId: string } } },
      ];
    }
  | Record<string, never>;

type TransactionAccountVisibilityFilter =
  | {
      OR: [
        { account: { visibilityOwnerType: "SHARED" } },
        { account: { visibilityOwnerUserId: string } },
        { account: { shares: { some: { sharedWithUserId: string } } } },
      ];
    }
  | Record<string, never>;

export function buildAccountVisibilityFilter(viewer: Viewer): AccountVisibilityFilter {
  if (!viewer) {
    return {};
  }
  return {
    OR: [
      { visibilityOwnerType: "SHARED" },
      { visibilityOwnerUserId: viewer.userId },
      { shares: { some: { sharedWithUserId: viewer.userId } } },
    ],
  };
}

export function buildTransactionAccountVisibilityFilter(
  viewer: Viewer,
): TransactionAccountVisibilityFilter {
  if (!viewer) {
    return {};
  }
  return {
    OR: [
      { account: { visibilityOwnerType: "SHARED" } },
      { account: { visibilityOwnerUserId: viewer.userId } },
      { account: { shares: { some: { sharedWithUserId: viewer.userId } } } },
    ],
  };
}
