import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency, formatIsoDate } from "@/lib/format";
import {
  buildAccountVisibilityFilter,
  buildTransactionAccountVisibilityFilter,
  getViewerHouseholdContext,
} from "@/lib/household/viewer";

import { CsvUploadForm, type AccountOption } from "./csv-upload-form";

const PROVIDER_LABEL: Record<"DKB" | "CSV_UPLOAD", string> = {
  DKB: "DKB",
  CSV_UPLOAD: "CSV",
};

type TransactionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const context = await getViewerHouseholdContext();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const imported = firstValue(resolvedSearchParams.imported);
  const skipped = firstValue(resolvedSearchParams.skipped);
  const account = firstValue(resolvedSearchParams.account);
  const error = firstValue(resolvedSearchParams.error);

  const [transactions, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        householdId: context.householdId,
        ...buildTransactionAccountVisibilityFilter(context.viewer),
      },
      select: {
        id: true,
        bookingDate: true,
        amount: true,
        purposeRaw: true,
        counterpartyName: true,
        responsibilityType: true,
        account: { select: { name: true } },
        category: { select: { name: true } },
        responsibilityUser: { select: { displayName: true } },
      },
      orderBy: { bookingDate: "desc" },
      take: 20,
    }),
    prisma.account.findMany({
      where: {
        householdId: context.householdId,
        isActive: true,
        ...buildAccountVisibilityFilter(context.viewer),
      },
      select: {
        id: true,
        name: true,
        ibanLast4: true,
        bankConnection: { select: { provider: true } },
      },
      orderBy: [{ visibilityOwnerType: "asc" }, { name: "asc" }],
    }),
  ]);

  const accountOptions: AccountOption[] = accounts.map((account) => {
    const provider = account.bankConnection.provider as keyof typeof PROVIDER_LABEL;
    const providerLabel = PROVIDER_LABEL[provider] ?? account.bankConnection.provider;
    const ibanSuffix = account.ibanLast4 ? ` · ····${account.ibanLast4}` : "";
    return {
      id: account.id,
      label: `${account.name} · ${providerLabel}${ibanSuffix}`,
    };
  });

  const defaultNewAccountName = context.viewer
    ? `${context.viewer.displayName} CSV Import`
    : "CSV Import";

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

            <CsvUploadForm
              accounts={accountOptions}
              defaultNewAccountName={defaultNewAccountName}
            />

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
              render: (t) => formatIsoDate(t.bookingDate),
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
