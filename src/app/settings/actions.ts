"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSession, destroyCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  clearLoginRateLimit,
  registerFailedLoginAttempt,
  throwIfLoginRateLimited,
} from "@/lib/auth/login-rate-limit";

export async function registerAction(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const householdName = String(formData.get("householdName") ?? "").trim();

  if (!displayName || !email || !password || !householdName) {
    redirect("/settings?error=Bitte+alle+Felder+ausf%C3%BCllen");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    redirect("/settings?error=Es+gibt+bereits+ein+Konto+mit+dieser+E-Mail");
  }

  const passwordHash = hashPassword(password);
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        role: "ADMIN",
      },
    });

    const household = await tx.household.create({
      data: {
        name: householdName,
      },
    });

    await tx.householdMember.create({
      data: {
        householdId: household.id,
        userId: user.id,
        membershipRole: "ADMIN",
      },
    });

    return { userId: user.id };
  });

  await createSession(result.userId);
  redirect("/dashboard?auth=registered");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ipAddress = await getClientIpAddress();

  if (!email || !password) {
    redirect("/settings?error=E-Mail+und+Passwort+sind+erforderlich");
  }

  try {
    throwIfLoginRateLimited(email, ipAddress);
  } catch {
    redirect("/settings?error=Zu+viele+fehlgeschlagene+Anmeldungen.+Bitte+sp%C3%A4ter+erneut+versuchen");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    registerFailedLoginAttempt(email, ipAddress);
    redirect("/settings?error=Ung%C3%BCltige+Anmeldedaten");
  }

  clearLoginRateLimit(email, ipAddress);
  await createSession(user.id);
  redirect("/dashboard?auth=logged-in");
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/settings?auth=logged-out");
}

async function getClientIpAddress() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return requestHeaders.get("x-real-ip");
}
