import { getViewerHouseholdContext } from "@/lib/household/viewer";
import { prisma } from "@/lib/db/prisma";
import { buildStandardExportRows, buildSubsidyExportRows, escapeCsvCell } from "@/lib/invoices/export";

export async function GET(request: Request) {
  const context = await getViewerHouseholdContext();
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "subsidy" ? "subsidy" : "standard";

  const invoices = await prisma.invoiceDocument.findMany({
    where: {
      householdId: context.householdId,
    },
    include: {
      uploadedByUser: true,
      matchedTransaction: {
        include: {
          account: true,
          category: true,
        },
      },
      paymentMatches: {
        include: {
          transaction: {
            include: {
              account: true,
              category: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const rows = format === "subsidy" ? buildSubsidyExportRows(invoices) : buildStandardExportRows(invoices);
  const csv = rows.map((row: Array<string | number>) => row.map((cell: string | number) => escapeCsvCell(String(cell ?? ""))).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${format === "subsidy" ? "subsidy-proof-v1" : "invoice-payment-links"}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
