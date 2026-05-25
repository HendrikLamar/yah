import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/db/prisma";
import {
  buildAccountVisibilityFilter,
  buildTransactionAccountVisibilityFilter,
  getViewerHouseholdContext,
} from "@/lib/household/viewer";
import {
  defaultSort,
  DEFAULT_PAGE_SIZE,
  parsePagination,
  parseUrlSearchParams,
} from "@/lib/search/transaction-search";
import {
  aggregateTransactions,
  searchTransactions,
  type GroupKey,
} from "@/lib/search/transaction-search-queries";

import { AggregatedView } from "./aggregated-view";
import { CsvUploadForm, type AccountOption } from "./csv-upload-form";
import { FilterPanel } from "./filter-panel";
import { ResultsTable } from "./results-table";
import { SearchBar } from "./search-bar";
import { ViewToggle } from "./view-toggle";

const PROVIDER_LABEL: Record<"DKB" | "CSV_UPLOAD", string> = {
  DKB: "DKB",
  CSV_UPLOAD: "CSV",
};

const VIEW_LABELS: Record<string, string> = {
  byCounterparty: "Empfänger",
  byCategory: "Kategorie",
  byMonth: "Monat",
  byAccount: "Konto",
};

type TransactionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const context = await getViewerHouseholdContext();
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const imported = firstValue(resolvedSearchParams.imported);
  const skipped = firstValue(resolvedSearchParams.skipped);
  const importedAccount = firstValue(resolvedSearchParams.imported_account);
  const error = firstValue(resolvedSearchParams.error);

  const view = firstValue(resolvedSearchParams.view) ?? "list";
  const groupBy = view !== "list" ? (view as GroupKey) : null;

  const filters = parseUrlSearchParams(resolvedSearchParams);
  const sort = defaultSort(filters);
  const pagination = parsePagination(firstValue(resolvedSearchParams.page), DEFAULT_PAGE_SIZE);
  const visibility = {
    householdId: context.householdId,
    ...buildTransactionAccountVisibilityFilter(context.viewer),
  };

  const [accounts, categories, listResult, aggregated] = await Promise.all([
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
    prisma.category.findMany({
      where: { householdId: context.householdId, isArchived: false },
      select: { id: true, slug: true, name: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    groupBy
      ? Promise.resolve(null)
      : searchTransactions({ filters, visibility, pagination, sort }),
    groupBy
      ? aggregateTransactions({ filters, visibility, groupBy })
      : Promise.resolve(null),
  ]);

  const accountFilterOptions = accounts.map((account) => ({
    value: account.name,
    label: account.name,
  }));
  const categoryFilterOptions = categories.map((category) => ({
    value: category.slug,
    label: category.name,
  }));

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
        title="Suche, Drill-down und CSV-Import"
        description="Mehrjährige Historie filtern, sortieren und gruppieren. URL ist Single Source of Truth, jede Spalte sortierbar."
        status={{
          label: context.viewer
            ? `Importing for ${context.viewer.displayName}`
            : "Importing into demo household",
          variant: "success",
        }}
      />

      <Card>
        <div className="space-y-md">
          <SearchBar />
          <div className="grid grid-cols-12 gap-gutter">
            <div className="col-span-12 lg:col-span-4">
              <FilterPanel
                accountOptions={accountFilterOptions}
                categoryOptions={categoryFilterOptions}
              />
            </div>
            <div className="col-span-12 lg:col-span-8 space-y-md">
              <div className="flex flex-wrap items-center justify-between gap-sm">
                <ViewToggle current={view} />
              </div>

              {groupBy && aggregated ? (
                <AggregatedView
                  rows={aggregated}
                  groupLabel={VIEW_LABELS[view] ?? "Gruppe"}
                />
              ) : listResult ? (
                <ResultsTable
                  rows={listResult.rows}
                  summary={listResult.summary}
                  sort={sort}
                  page={listResult.page}
                  pageSize={listResult.pageSize}
                  totalPages={listResult.totalPages}
                />
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-gutter my-lg">
        <div className="col-span-12 lg:col-span-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface">CSV-Import (Fallback)</h3>
            <p className="mt-sm text-body-sm text-on-surface-variant">
              Unterstützte Header u.a. <code>Buchungstag</code>, <code>Wertstellung</code>,
              <code> Auftraggeber / Begünstigter</code>, <code>Verwendungszweck</code>,
              <code> Betrag (EUR)</code>.
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
                  {`Imported ${imported} rows into ${importedAccount ?? "CSV account"}${
                    skipped ? ` · skipped duplicates: ${skipped}` : ""
                  }`}
                </Badge>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Filter-Hinweise</h3>
            <ul className="mt-md space-y-sm text-body-sm text-on-surface">
              <li className="flex items-start gap-sm">
                <Icon name="check_circle" filled className="text-secondary mt-0.5" />
                <span>Eigene Umbuchungen sind standardmäßig ausgeblendet (Toggle im Panel).</span>
              </li>
              <li className="flex items-start gap-sm">
                <Icon name="check_circle" filled className="text-secondary mt-0.5" />
                <span>Sortierung & Filter werden in der URL gespeichert — teilbar &amp; reload-fest.</span>
              </li>
              <li className="flex items-start gap-sm">
                <Icon name="check_circle" filled className="text-secondary mt-0.5" />
                <span>Gruppieren nach Empfänger / Kategorie / Monat / Konto über das Toggle oben.</span>
              </li>
              <li className="flex items-start gap-sm">
                <Icon name="check_circle" filled className="text-secondary mt-0.5" />
                <span>Sortier-Operatoren in der Suche unterstützt: <code>sort:amount.desc</code>.</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
