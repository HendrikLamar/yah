import { roundToCents } from "./utils";

type PaymentMatchExport = {
  id: string;
  allocatedAmount: unknown;
  matchReason?: string | null;
  transaction: {
    id: string;
    bookingDate: Date;
    amount: unknown;
    counterpartyName?: string | null;
    purposeRaw?: string | null;
    account: { name: string };
    category?: { name: string } | null;
  };
};

type InvoiceExport = {
  id: string;
  fileName: string;
  vendorName: string;
  invoiceNumber?: string | null;
  invoiceDate: Date;
  dueDate?: Date | null;
  totalAmount: unknown;
  currency: string;
  matchStatus: string;
  matchConfidence?: unknown;
  matchReason?: string | null;
  notes?: string | null;
  documentSha256?: string | null;
  matchedTransaction?: { id: string } | null;
  uploadedByUser?: { displayName?: string | null } | null;
  paymentMatches: PaymentMatchExport[];
};

export function buildStandardExportRows(invoices: InvoiceExport[]) {
  return [
    [
      "invoice_id",
      "file_name",
      "vendor_name",
      "invoice_number",
      "invoice_date",
      "due_date",
      "total_amount_eur",
      "currency",
      "match_status",
      "match_confidence",
      "match_reason",
      "primary_transaction_id",
      "linked_payment_count",
      "linked_amount_eur",
      "remaining_amount_eur",
      "uploaded_by",
    ],
    ...invoices.map((invoice) => {
      const linkedAmount = sumAllocatedAmount(invoice.paymentMatches);
      const remainingAmount = Math.max(0, roundToCents(Number(invoice.totalAmount) - linkedAmount));
      return [
        invoice.id,
        invoice.fileName,
        invoice.vendorName,
        invoice.invoiceNumber ?? "",
        invoice.invoiceDate.toISOString().slice(0, 10),
        invoice.dueDate?.toISOString().slice(0, 10) ?? "",
        Number(invoice.totalAmount).toFixed(2),
        invoice.currency,
        invoice.matchStatus,
        invoice.matchConfidence ? Number(invoice.matchConfidence).toFixed(2) : "",
        invoice.matchReason ?? "",
        invoice.matchedTransaction?.id ?? invoice.paymentMatches?.[0]?.transaction?.id ?? "",
        String(invoice.paymentMatches?.length ?? 0),
        linkedAmount.toFixed(2),
        remainingAmount.toFixed(2),
        invoice.uploadedByUser?.displayName ?? "",
      ];
    }),
  ];
}

export function buildSubsidyExportRows(invoices: InvoiceExport[]) {
  return [
    [
      "schema_version",
      "beleg_id",
      "beleg_dateiname",
      "beleg_sha256",
      "lieferant",
      "rechnungsnummer",
      "rechnungsdatum",
      "faellig_am",
      "waehrung",
      "rechnungsbetrag_brutto",
      "zuordnung_id",
      "zahlungs_id",
      "zahlungsdatum",
      "zahlungskonto",
      "zahlung_gegenpartei",
      "zahlungsreferenz",
      "zugeordneter_betrag",
      "offener_restbetrag",
      "kostenkategorie",
      "nachweis_status",
      "bearbeiter",
      "kommentar",
    ],
    ...invoices.flatMap((invoice) => {
      const paymentMatches = invoice.paymentMatches ?? [];
      const totalAmount = Number(invoice.totalAmount);
      const linkedAmount = sumAllocatedAmount(paymentMatches);
      const remainingAmount = Math.max(0, roundToCents(totalAmount - linkedAmount)).toFixed(2);

      if (paymentMatches.length === 0) {
        return [[
          "subsidy-proof-v1",
          invoice.id,
          invoice.fileName,
          invoice.documentSha256 ?? "",
          invoice.vendorName,
          invoice.invoiceNumber ?? "",
          invoice.invoiceDate.toISOString().slice(0, 10),
          invoice.dueDate?.toISOString().slice(0, 10) ?? "",
          invoice.currency,
          totalAmount.toFixed(2),
          "",
          "",
          "",
          "",
          "",
          "",
          "0.00",
          remainingAmount,
          "",
          "rechnung_offen",
          invoice.uploadedByUser?.displayName ?? "",
          invoice.notes ?? invoice.matchReason ?? "",
        ]];
      }

      return paymentMatches.map((paymentMatch) => [
        "subsidy-proof-v1",
        invoice.id,
        invoice.fileName,
        invoice.documentSha256 ?? "",
        invoice.vendorName,
        invoice.invoiceNumber ?? "",
        invoice.invoiceDate.toISOString().slice(0, 10),
        invoice.dueDate?.toISOString().slice(0, 10) ?? "",
        invoice.currency,
        totalAmount.toFixed(2),
        paymentMatch.id,
        paymentMatch.transaction.id,
        paymentMatch.transaction.bookingDate.toISOString().slice(0, 10),
        paymentMatch.transaction.account.name,
        paymentMatch.transaction.counterpartyName ?? "",
        paymentMatch.transaction.purposeRaw ?? "",
        Number(paymentMatch.allocatedAmount).toFixed(2),
        remainingAmount,
        paymentMatch.transaction.category?.name ?? "",
        remainingAmount === "0.00" ? "vollstaendig_nachgewiesen" : "teilweise_nachgewiesen",
        invoice.uploadedByUser?.displayName ?? "",
        invoice.notes ?? paymentMatch.matchReason ?? invoice.matchReason ?? "",
      ]);
    }),
  ];
}

export function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.split("\"").join("\"\"")}"`;
  }

  return value;
}

function sumAllocatedAmount(matches: Array<{ allocatedAmount: unknown }> | undefined) {
  return roundToCents((matches ?? []).reduce((sum, match) => sum + Number(match.allocatedAmount ?? 0), 0));
}

