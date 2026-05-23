import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/db/prisma";
import { getViewerHouseholdContext } from "@/lib/household/viewer";

import { uploadCsvAction } from "./actions";

type TransactionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const context = await getViewerHouseholdContext();
  const visibilityFilter = context.viewer
    ? {
        OR: [
          { account: { visibilityOwnerType: "SHARED" as const } },
          { account: { visibilityOwnerUserId: context.viewer.userId } },
        ],
      }
    : {};
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const imported = firstValue(resolvedSearchParams.imported);
  const skipped = firstValue(resolvedSearchParams.skipped);
  const account = firstValue(resolvedSearchParams.account);
  const error = firstValue(resolvedSearchParams.error);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactions: any[] = await prisma.transaction.findMany({
    where: {
      householdId: context.householdId,
      ...visibilityFilter,
    },
    include: {
      account: true,
      category: true,
      responsibilityUser: true,
    },
    orderBy: { bookingDate: "desc" },
    take: 20,
  });

  return (
    <>
      <PageHeader
        eyebrow="transactions"
        title="Imported movements, review queue and CSV fallback"
        description="If tonight's DKB test works, the same downstream transaction model is ready. If it does not, you can already upload CSV exports here and inspect the resulting analysis path."
        status={{
          label: context.viewer
            ? `Importing for ${context.viewer.displayName}`
            : "Importing into demo household",
          variant: "success",
        }}
      />

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 lg:col-span-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Upload CSV fallback import</h3>
            <p className="mt-sm text-body-sm text-on-surface-variant">
              Supported headers include DKB-style exports like <code>Buchungstag</code>,{" "}
              <code>Wertstellung</code>, <code>Auftraggeber / Begünstigter</code>,{" "}
              <code>Verwendungszweck</code> and <code>Betrag (EUR)</code>.
            </p>

            <form action={uploadCsvAction} className="mt-md space-y-md">
              <label className="block text-body-sm text-on-surface">
                Account name for this import
                <div className="mt-xs relative">
                  <Icon
                    name="badge"
                    className="absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                  />
                  <input
                    className="w-full pl-[48px] pr-md py-md bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-body-md text-on-surface"
                    defaultValue={
                      context.viewer ? `${context.viewer.displayName} CSV Import` : "CSV Import"
                    }
                    name="accountName"
                    required
                  />
                </div>
              </label>

              <label className="block text-body-sm text-on-surface">
                CSV file
                <div className="mt-xs relative">
                  <Icon
                    name="upload_file"
                    className="absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                  />
                  <input
                    accept=".csv,text/csv"
                    className="block w-full pl-[48px] pr-md py-md bg-surface border border-outline-variant rounded-lg text-body-md text-on-surface file:mr-md file:rounded-lg file:border-0 file:bg-surface-container-high file:px-md file:py-xs file:text-label-md file:text-on-surface"
                    name="csvFile"
                    required
                    type="file"
                  />
                </div>
              </label>

              <Button variant="secondary" icon="upload" type="submit">
                Parse and import CSV
              </Button>
            </form>

            {error ? (
              <div className="mt-md">
                <Badge variant="error" icon="error">
                  {error}
                </Badge>
              </div>
            ) : null}
            {imported ? (
              <div className="mt-md">
                <Badge variant="success" icon="check_circle">
                  {`Imported ${imported} rows into ${account ?? "CSV account"}${
                    skipped ? ` · skipped duplicates: ${skipped}` : ""
                  }`}
                </Badge>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Analysis pipeline now prepared</h3>
            <ul className="mt-md space-y-sm text-body-sm text-on-surface">
              <li className="flex items-start gap-sm">
                <Icon name="check_circle" filled className="text-secondary mt-0.5" />
                <span>every imported row lands in the same Transaction model as future DKB imports</span>
              </li>
              <li className="flex items-start gap-sm">
                <Icon name="check_circle" filled className="text-secondary mt-0.5" />
                <span>rows get a deterministic import hash so duplicate CSV uploads are skipped</span>
              </li>
              <li className="flex items-start gap-sm">
                <Icon name="check_circle" filled className="text-secondary mt-0.5" />
                <span>new CSV accounts can be shared or private depending on who is signed in</span>
              </li>
              <li className="flex items-start gap-sm">
                <Icon name="check_circle" filled className="text-secondary mt-0.5" />
                <span>uncategorized movements are visible immediately in the dashboard analysis</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <Card>
        <h3 className="text-headline-sm text-on-surface mb-md">Latest imported transactions</h3>
        <DataTable
          columns={[
            {
              key: "date",
              header: "Date",
              render: (t) => t.bookingDate.toISOString().slice(0, 10),
            },
            { key: "account", header: "Account", render: (t) => t.account.name },
            {
              key: "counterparty",
              header: "Counterparty",
              render: (t) => t.counterpartyName ?? "—",
            },
            { key: "purpose", header: "Purpose", render: (t) => t.purposeRaw },
            {
              key: "category",
              header: "Category",
              render: (t) => t.category?.name ?? "Uncategorized",
            },
            {
              key: "owner",
              header: "Owner",
              render: (t) =>
                t.responsibilityType === "SHARED"
                  ? "Shared"
                  : t.responsibilityUser?.displayName ?? "Private",
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              tabularNums: true,
              render: (t) => <strong>{formatCurrency(Number(t.amount))}</strong>,
            },
          ]}
          rows={transactions}
          getRowKey={(t) => t.id}
          emptyState="No transactions imported yet — try a CSV above."
        />
      </Card>
    </>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
