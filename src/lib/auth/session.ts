import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { prisma } from "@/lib/db/prisma";

const SESSION_COOKIE_NAME = "yah_session";
const SESSION_DURATION_DAYS = 30;

export type AuthenticatedViewer = {
  userId: string;
  email: string;
  displayName: string;
  householdId: string | null;
  householdName: string | null;
};

export async function getCurrentViewer(): Promise<AuthenticatedViewer | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashSessionToken(sessionToken);
  const session = await prisma.userSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          householdMemberships: {
            include: {
              household: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
    },
  });

  if (!session) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.userSession.delete({ where: { id: session.id } });
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  // If session has an explicit active household, use it directly
  if (session.activeHouseholdId) {
    const household = await prisma.household.findUnique({
      where: { id: session.activeHouseholdId },
    });

    if (household) {
      return {
        userId: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        householdId: household.id,
        householdName: household.name,
      };
    }
  }

  const primaryMembership = session.user.householdMemberships[0] ?? null;

  return {
    userId: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    householdId: primaryMembership?.householdId ?? null,
    householdName: primaryMembership?.household.name ?? null,
  };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  // Check which household the user belongs to
  const membership = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: true },
    orderBy: { createdAt: "asc" },
  });

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      activeHouseholdId: membership?.householdId ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await prisma.userSession.deleteMany({
      where: { tokenHash: hashSessionToken(sessionToken) },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
