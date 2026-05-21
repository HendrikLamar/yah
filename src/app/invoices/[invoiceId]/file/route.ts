import { getViewerHouseholdContext } from "@/lib/household/viewer";

import { getInvoiceFileForHousehold } from "@/lib/invoices/invoice-queries";

type InvoiceFileRouteProps = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export async function GET(_request: Request, { params }: InvoiceFileRouteProps) {
  const context = await getViewerHouseholdContext();
  const { invoiceId } = await params;
  const invoice = await getInvoiceFileForHousehold({
    householdId: context.householdId,
    invoiceId,
  });

  return new Response(invoice.fileData, {
    headers: {
      "Content-Type": invoice.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${sanitizeFileName(invoice.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
}
