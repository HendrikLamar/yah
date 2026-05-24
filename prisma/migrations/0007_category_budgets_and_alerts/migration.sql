-- Issue #17: per-category budget limits with alerts
-- Adds three nullable fields to Category (system rows simply start with no limit),
-- a BudgetPeriod enum, and a CategoryLimitAlert table with a dedup unique key on
-- (categoryId, periodStart, threshold) so we don't re-fire the same alert.

CREATE TYPE "BudgetPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

ALTER TABLE "Category"
  ADD COLUMN "limitAmount"   DECIMAL(14, 2),
  ADD COLUMN "limitPeriod"   "BudgetPeriod",
  ADD COLUMN "limitRollover" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE "CategoryLimitAlert" (
  "id"             TEXT NOT NULL,
  "categoryId"     TEXT NOT NULL,
  "periodStart"    TIMESTAMP(3) NOT NULL,
  "periodEnd"      TIMESTAMP(3) NOT NULL,
  "threshold"      DECIMAL(5, 2) NOT NULL,
  "spentAmount"    DECIMAL(14, 2) NOT NULL,
  "limitAmount"    DECIMAL(14, 2) NOT NULL,
  "triggeredAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "channel"        TEXT NOT NULL DEFAULT 'in_app',
  "acknowledgedAt" TIMESTAMP(3),
  CONSTRAINT "CategoryLimitAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoryLimitAlert_categoryId_periodStart_threshold_key"
  ON "CategoryLimitAlert" ("categoryId", "periodStart", "threshold");

CREATE INDEX "CategoryLimitAlert_categoryId_acknowledgedAt_idx"
  ON "CategoryLimitAlert" ("categoryId", "acknowledgedAt");

ALTER TABLE "CategoryLimitAlert"
  ADD CONSTRAINT "CategoryLimitAlert_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
