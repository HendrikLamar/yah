import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db/prisma";

export type AccountShareGrant = { accountId: string; role: "VIEWER" };

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashInvitationToken(token) };
}

export type InvitationStatus = "active" | "accepted" | "revoked" | "expired";

export function statusFor(invitation: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}, now: Date = new Date()): InvitationStatus {
  if (invitation.revokedAt) return "revoked";
  if (invitation.acceptedAt) return "accepted";
  if (invitation.expiresAt.getTime() < now.getTime()) return "expired";
  return "active";
}

export async function acceptInvitation(options: {
  tokenHash: string;
  userId: string;
  now?: Date;
}): Promise<{ householdId: string; appliedShareCount: number }> {
  const now = options.now ?? new Date();

  const claim = await prisma.invitation.updateMany({
    where: {
      tokenHash: options.tokenHash,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: { acceptedAt: now, acceptedByUserId: options.userId },
  });

  if (claim.count === 0) {
    const existing = await prisma.invitation.findUnique({
      where: { tokenHash: options.tokenHash },
      select: { revokedAt: true, acceptedAt: true, expiresAt: true },
    });
    if (!existing) throw new Error("Einladung nicht gefunden.");
    if (existing.revokedAt) throw new Error("Einladung wurde widerrufen.");
    if (existing.acceptedAt) throw new Error("Einladung wurde bereits angenommen.");
    if (existing.expiresAt.getTime() < now.getTime()) {
      throw new Error("Einladung ist abgelaufen.");
    }
    throw new Error("Einladung konnte nicht angenommen werden.");
  }

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: options.tokenHash },
  });
  if (!invitation) throw new Error("Einladung nicht gefunden.");

  await prisma.householdMember.upsert({
    where: {
      householdId_userId: {
        householdId: invitation.householdId,
        userId: options.userId,
      },
    },
    update: {},
    create: {
      householdId: invitation.householdId,
      userId: options.userId,
      membershipRole: "MEMBER",
    },
  });

  let appliedShareCount = 0;
  const grants = parseGrants(invitation.accountShareGrants);

  for (const grant of grants) {
    const account = await prisma.account.findFirst({
      where: { id: grant.accountId, householdId: invitation.householdId },
      select: { id: true },
    });
    if (!account) continue;

    await prisma.accountShare.upsert({
      where: {
        accountId_sharedWithUserId: {
          accountId: account.id,
          sharedWithUserId: options.userId,
        },
      },
      update: { role: grant.role },
      create: {
        accountId: account.id,
        sharedWithUserId: options.userId,
        role: grant.role,
        grantedByUserId: invitation.createdByUserId,
      },
    });
    appliedShareCount += 1;
  }

  return { householdId: invitation.householdId, appliedShareCount };
}

function parseGrants(value: unknown): AccountShareGrant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as { accountId?: unknown }).accountId === "string"
    ) {
      const grant = entry as { accountId: string; role?: unknown };
      return [{ accountId: grant.accountId, role: "VIEWER" as const }];
    }
    return [];
  });
}
