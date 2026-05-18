import { FeaturePage } from "@/components/app-shell/feature-page";
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

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId: context.householdId,
      ...visibilityFilter,
    },
    include: {
      account: true,
      category: true,
      responsibilityUser: true,
    },
    orderBy: {
      bookingDate: "desc",
    },
    take: 20,
  });

  return (
    <FeaturePage
      eyebrow="transactions"
      title="Imported movements, review queue and CSV fallback"
      description="If tonight's DKB test works, the same downstream transaction model is ready. If it does not, you can already upload CSV exports here and inspect the resulting analysis path."
      statusLabel={context.viewer ? `Importing for ${context.viewer.displayName}` : "Importing into demo household"}
      statusTone="success"
    >
      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-slate-100">Upload CSV fallback import</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Supported headers include DKB-style exports like <code>Buchungstag</code>, <code>Wertstellung</code>,
            <code>Auftraggeber / Begünstigter</code>, <code>Verwendungszweck</code> and <code>Betrag (EUR)</code>.
          </p>

          <form action={uploadCsvAction} className="mt-4 space-y-4">
            <label className="block text-sm text-slate-300">
              Account name for this import
              <input
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
                defaultValue={context.viewer ? `${context.viewer.displayName} CSV Import` : "CSV Import"}
                name="accountName"
                required
              />
            </label>
            <label className="block text-sm text-slate-300">
              CSV file
              <input
                accept=".csv,text/csv"
                className="mt-2 block w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
                name="csvFile"
                required
                type="file"
              />
            </label>
            <button className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950" type="submit">
              Parse and import CSV
            </button>
          </form>

          {error ? (
            <p className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </p>
          ) : null}
          {imported ? (
            <p className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Imported {imported} rows into <strong>{account ?? "CSV account"}</strong>
              {skipped ? ` · skipped duplicates: ${skipped}` : ""}
            </p>
          ) : null}
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-slate-100">Analysis pipeline now prepared</h3>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <li>• every imported row lands in the same Transaction model as future DKB imports</li>
            <li>• rows get a deterministic import hash so duplicate CSV uploads are skipped</li>
            <li>• new CSV accounts can be shared or private depending on who is signed in</li>
            <li>• uncategorized movements are visible immediately in the dashboard analysis</li>
          </ul>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold text-slate-100">Latest imported transactions</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="pb-3">Date</th>
                <th className="pb-3">Account</th>
                <th className="pb-3">Counterparty</th>
                <th className="pb-3">Purpose</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Owner</th>
                <th className="pb-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="border-t border-slate-800">
                  <td className="py-3">{transaction.bookingDate.toISOString().slice(0, 10)}</td>
                  <td className="py-3">{transaction.account.name}</td>
                  <td className="py-3">{transaction.counterpartyName ?? "—"}</td>
                  <td className="py-3">{transaction.purposeRaw}</td>
                  <td className="py-3">{transaction.category?.name ?? "Uncategorized"}</td>
                  <td className="py-3">
                    {transaction.responsibilityType === "SHARED"
                      ? "Shared"
                      : transaction.responsibilityUser?.displayName ?? "Private"}
                  </td>
                  <td className="py-3 text-right font-medium text-slate-100">
                    {formatCurrency(Number(transaction.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </FeaturePage>
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
