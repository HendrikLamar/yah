-- CreateEnum
CREATE TYPE "InvoiceMatchStatus" AS ENUM ('UNMATCHED', 'AUTO_MATCHED', 'MANUALLY_CONFIRMED');

-- CreateTable
CREATE TABLE "InvoiceDocument" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "vendorName" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "matchStatus" "InvoiceMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedTransactionId" TEXT,
    "matchConfidence" DECIMAL(5,2),
    "matchReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceDocument_householdId_createdAt_idx" ON "InvoiceDocument"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "InvoiceDocument_householdId_matchStatus_invoiceDate_idx" ON "InvoiceDocument"("householdId", "matchStatus", "invoiceDate");

-- CreateIndex
CREATE INDEX "InvoiceDocument_matchedTransactionId_idx" ON "InvoiceDocument"("matchedTransactionId");

-- CreateIndex
CREATE INDEX "Transaction_householdId_categoryId_bookingDate_idx" ON "Transaction"("householdId", "categoryId", "bookingDate");

-- CreateIndex
CREATE INDEX "ImportBatch_userId_createdAt_idx" ON "ImportBatch"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_matchedTransactionId_fkey" FOREIGN KEY ("matchedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
