-- Enums
CREATE TYPE "ShareRole" AS ENUM ('VIEWER');
CREATE TYPE "InvitationRole" AS ENUM ('MEMBER');

-- AccountShare: per-account access grants beyond the SHARED visibility flag
CREATE TABLE "AccountShare" (
  "id"               TEXT NOT NULL,
  "accountId"        TEXT NOT NULL,
  "sharedWithUserId" TEXT NOT NULL,
  "role"             "ShareRole" NOT NULL DEFAULT 'VIEWER',
  "grantedByUserId"  TEXT NOT NULL,
  "grantedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountShare_accountId_sharedWithUserId_key"
  ON "AccountShare" ("accountId", "sharedWithUserId");
CREATE INDEX "AccountShare_sharedWithUserId_idx"
  ON "AccountShare" ("sharedWithUserId");

ALTER TABLE "AccountShare"
  ADD CONSTRAINT "AccountShare_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AccountShare_sharedWithUserId_fkey"
    FOREIGN KEY ("sharedWithUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AccountShare_grantedByUserId_fkey"
    FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invitation: link-based or email-based invites bound to a household
CREATE TABLE "Invitation" (
  "id"                 TEXT NOT NULL,
  "householdId"        TEXT NOT NULL,
  "email"              TEXT,
  "tokenHash"          TEXT NOT NULL,
  "role"               "InvitationRole" NOT NULL DEFAULT 'MEMBER',
  "accountShareGrants" JSONB,
  "createdByUserId"    TEXT NOT NULL,
  "acceptedByUserId"   TEXT,
  "acceptedAt"         TIMESTAMP(3),
  "revokedAt"          TIMESTAMP(3),
  "expiresAt"          TIMESTAMP(3) NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation" ("tokenHash");
CREATE INDEX "Invitation_householdId_expiresAt_idx"
  ON "Invitation" ("householdId", "expiresAt");

ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Invitation_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Invitation_acceptedByUserId_fkey"
    FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
