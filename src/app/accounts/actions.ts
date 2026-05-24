"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { getViewerHouseholdContext } from "@/lib/household/viewer";
import { generateInvitationToken } from "@/lib/sharing/invitations";

const INVITE_TOKEN_COOKIE = "yah_invite_token";

function redirectAccounts(query: Record<string, string>): never {
  const params = new URLSearchParams(query);
  redirect(`/accounts?${params.toString()}`);
}

export async function shareAccountWithMemberAction(formData: FormData) {
  const context = await getViewerHouseholdContext();
  if (!context.viewer) redirect("/settings?error=Bitte+einloggen");

  const accountId = String(formData.get("accountId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();

  if (!accountId || !userId) {
    redirectAccounts({ error: "Bitte Konto und Empfänger wählen." });
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, householdId: context.householdId },
    select: { id: true, visibilityOwnerType: true, visibilityOwnerUserId: true },
  });
  if (!account) redirectAccounts({ error: "Konto nicht gefunden." });

  const member = await prisma.householdMember.findFirst({
    where: { householdId: context.householdId, userId },
    select: { userId: true },
  });
  if (!member) redirectAccounts({ error: "Person ist kein Haushaltsmitglied." });

  await prisma.accountShare.upsert({
    where: {
      accountId_sharedWithUserId: { accountId, sharedWithUserId: userId },
    },
    update: {},
    create: {
      accountId,
      sharedWithUserId: userId,
      role: "VIEWER",
      grantedByUserId: context.viewer.userId,
    },
  });

  redirectAccounts({ shared: "1" });
}

export async function revokeAccountShareAction(formData: FormData) {
  const context = await getViewerHouseholdContext();
  if (!context.viewer) redirect("/settings?error=Bitte+einloggen");

  const shareId = String(formData.get("shareId") ?? "").trim();
  if (!shareId) redirectAccounts({ error: "Freigabe nicht gefunden." });

  const share = await prisma.accountShare.findUnique({
    where: { id: shareId },
    include: { account: { select: { householdId: true } } },
  });
  if (!share || share.account.householdId !== context.householdId) {
    redirectAccounts({ error: "Freigabe nicht gefunden." });
  }

  await prisma.accountShare.delete({ where: { id: shareId } });
  redirectAccounts({ revoked: "1" });
}

export async function createShareableInviteAction(formData: FormData) {
  const context = await getViewerHouseholdContext();
  if (!context.viewer) redirect("/settings?error=Bitte+einloggen");

  const accountId = String(formData.get("accountId") ?? "").trim();
  const expiryHoursRaw = String(formData.get("expiryHours") ?? "24").trim();
  const expiryHours = Number(expiryHoursRaw);

  if (!accountId) redirectAccounts({ error: "Konto fehlt." });
  if (Number.isNaN(expiryHours) || expiryHours <= 0 || expiryHours > 24 * 30) {
    redirectAccounts({ error: "Ablaufzeit ungültig." });
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, householdId: context.householdId },
    select: { id: true },
  });
  if (!account) redirectAccounts({ error: "Konto nicht gefunden." });

  const { token, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  await prisma.invitation.create({
    data: {
      householdId: context.householdId,
      tokenHash,
      role: "MEMBER",
      accountShareGrants: [{ accountId, role: "VIEWER" }],
      createdByUserId: context.viewer.userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(INVITE_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 120,
  });

  redirect(`/accounts/${accountId}/access?inviteCreated=1`);
}

export async function revokeInvitationAction(formData: FormData) {
  const context = await getViewerHouseholdContext();
  if (!context.viewer) redirect("/settings?error=Bitte+einloggen");

  const invitationId = String(formData.get("invitationId") ?? "").trim();
  if (!invitationId) redirectAccounts({ error: "Einladung nicht gefunden." });

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, householdId: context.householdId },
    select: { id: true },
  });
  if (!invitation) redirectAccounts({ error: "Einladung nicht gefunden." });

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { revokedAt: new Date() },
  });

  redirect("/settings?invite=revoked");
}
