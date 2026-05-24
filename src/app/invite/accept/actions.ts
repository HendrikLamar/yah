"use server";

import { redirect } from "next/navigation";

import { getCurrentViewer, setActiveHouseholdForCurrentSession } from "@/lib/auth/session";
import {
  acceptInvitation,
  hashInvitationToken,
} from "@/lib/sharing/invitations";

export async function acceptInvitationAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) {
    redirect("/invite/accept?error=Token+fehlt");
  }

  const viewer = await getCurrentViewer();
  if (!viewer) {
    redirect(
      `/settings?error=${encodeURIComponent(
        "Bitte einloggen oder registrieren, um die Einladung anzunehmen.",
      )}&inviteToken=${encodeURIComponent(token)}`,
    );
  }

  let result: Awaited<ReturnType<typeof acceptInvitation>>;
  try {
    result = await acceptInvitation({
      tokenHash: hashInvitationToken(token),
      userId: viewer.userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Einladung konnte nicht angenommen werden.";
    redirect(`/invite/accept?error=${encodeURIComponent(message)}&token=${encodeURIComponent(token)}`);
  }

  await setActiveHouseholdForCurrentSession(result.householdId);

  redirect("/accounts?invite=accepted");
}
