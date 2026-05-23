ALTER TYPE "InvoiceMatchStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_MATCHED';

ALTER TABLE "InvoiceDocument"
  ADD COLUMN "documentSha256" TEXT,
  ADD COLUMN "extractedText" TEXT,
  ADD COLUMN "extractionMethod" TEXT,
  ADD COLUMN "extractionConfidence" DECIMAL(5,2);

CREATE TABLE "InvoicePaymentMatch" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "allocatedAmount" DECIMAL(14,2) NOT NULL,
  "matchStatus" "InvoiceMatchStatus" NOT NULL DEFAULT 'MANUALLY_CONFIRMED',
  "matchConfidence" DECIMAL(5,2),
  "matchReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoicePaymentMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoicePaymentMatch_invoiceId_transactionId_key"
  ON "InvoicePaymentMatch"("invoiceId", "transactionId");
CREATE INDEX "InvoicePaymentMatch_transactionId_createdAt_idx"
  ON "InvoicePaymentMatch"("transactionId", "createdAt");
CREATE INDEX "InvoicePaymentMatch_invoiceId_createdAt_idx"
  ON "InvoicePaymentMatch"("invoiceId", "createdAt");

ALTER TABLE "InvoicePaymentMatch"
  ADD CONSTRAINT "InvoicePaymentMatch_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "InvoiceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "InvoicePaymentMatch_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "InvoicePaymentMatch" (
  "id",
  "invoiceId",
  "transactionId",
  "allocatedAmount",
  "matchStatus",
  "matchConfidence",
  "matchReason",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('alloc_', "id"),
  "id",
  "matchedTransactionId",
  ABS("totalAmount"),
  CASE
    WHEN "matchStatus" = 'UNMATCHED' THEN 'MANUALLY_CONFIRMED'::"InvoiceMatchStatus"
    ELSE "matchStatus"
  END,
  "matchConfidence",
  COALESCE("matchReason", 'migrated legacy invoice link'),
  "createdAt",
  "updatedAt"
FROM "InvoiceDocument"
WHERE "matchedTransactionId" IS NOT NULL
ON CONFLICT ("invoiceId", "transactionId") DO NOTHING;
