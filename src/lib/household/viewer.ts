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
