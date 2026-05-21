import { FeaturePage } from "@/components/app-shell/feature-page";
import { getViewerHouseholdContext } from "@/lib/household/viewer";
import {
  listInvoicesForHousehold,
  listMatchCandidatesForInvoice,
} from "@/lib/invoices/invoice-queries";

import {
  clearInvoiceMatchAction,
  confirmInvoiceMatchAction,
  uploadInvoiceAction,
} from "./actions";

type InvoiceItem = Awaited<ReturnType<typeof listInvoicesForHousehold>>[number];
type PaymentMatchItem = InvoiceItem["paymentMatches"][number];

type InvoicesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type InvoiceFilter = "all" | "matched" | "unmatched";

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const context = await getViewerHouseholdContext();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const uploaded = firstValue(resolvedSearchParams.uploaded);
  const updated = firstValue(resolvedSearchParams.updated);
  const error = firstValue(resolvedSearchParams.error);
  const file = firstValue(resolvedSearchParams.file);
  const status = firstValue(resolvedSearchParams.status);
  const transaction = firstValue(resolvedSearchParams.transaction);
  const allocations = firstValue(resolvedSearchParams.allocations);
  const filter = parseFilter(firstValue(resolvedSearchParams.filter));

  const invoices = await listInvoicesForHousehold({
    householdId: context.householdId,
    filter,
    take: 30,
  });

  const candidatesByInvoice: Map<string, Awaited<ReturnType<typeof listMatchCandidatesForInvoice>>> = new Map(
    await Promise.all(
      invoices.map(async (invoice) => [
        invoice.id,
        await listMatchCandidatesForInvoice({
          householdId: context.householdId,
          invoiceId: invoice.id,
        }),
      ] as const),
    ),
  );

  const allInvoices = await listInvoicesForHousehold({
    householdId: context.householdId,
    filter: "all",
    take: 200,
  });

  const matchedCount = allInvoices.filter((invoice) => invoice.derivedRemainingAmount === 0).length;
  const unmatchedCount = allInvoices.length - matchedCount;

  return (
    <FeaturePage
      eyebrow="invoices"
      title="Invoice OCR and payment allocations"
      description={`Upload supplier invoices for ${context.householdName}, extract metadata from PDF/image evidence, map one invoice to many payments, and export a subsidy-proof schema.`}
      statusLabel={context.viewer ? `Uploader: ${context.viewer.displayName}` : "Invoice workflow inactive"}
      statusTone="success"
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Invoices stored" value={String(allInvoices.length)} />
        <MetricCard label="Fully matched" value={String(matchedCount)} />
        <MetricCard label="Needs review" value={String(unmatchedCount)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Upload invoice</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                PDFs are parsed directly. Image uploads run OCR. Leave supplier, date, invoice number, or amount blank when you want the backend to auto-detect them from the document.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-400 hover:text-emerald-300"
                href="/invoices/export"
              >
                Export CSV
              </a>
              <a
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-400 hover:text-emerald-300"
                href="/invoices/export?format=subsidy"
              >
                Export subsidy-proof v1
              </a>
            </div>
          </div>

          <form action={uploadInvoiceAction} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-slate-300 md:col-span-2">
              Invoice file
              <input
                accept=".pdf,image/*,application/pdf"
                className="mt-2 block w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
                name="invoiceFile"
                required
                type="file"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Vendor / supplier
              <input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" name="vendorName" placeholder="optional if OCR finds it" />
            </label>
            <label className="block text-sm text-slate-300">
              Invoice number
              <input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" name="invoiceNumber" placeholder="optional" />
            </label>
            <label className="block text-sm text-slate-300">
              Invoice date
              <input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" name="invoiceDate" type="date" />
            </label>
            <label className="block text-sm text-slate-300">
              Due date
              <input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" name="dueDate" type="date" />
            </label>
            <label className="block text-sm text-slate-300">
              Gross amount (EUR)
              <input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" min="0.01" name="totalAmount" step="0.01" type="number" />
            </label>
            <label className="block text-sm text-slate-300 md:col-span-2">
              Notes
              <textarea className="mt-2 min-h-28 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" name="notes" />
            </label>
            <button className="justify-self-start rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 md:col-span-2" type="submit">
              Upload, extract, and match invoice
            </button>
          </form>

          {error ? (
            <p className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>
          ) : null}
          {uploaded ? (
            <p className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Uploaded <strong>{file ?? "invoice"}</strong> · {renderStatus(status)}
              {transaction ? ` · primary payment ${transaction}` : ""}
              {allocations ? ` · ${allocations} linked payments` : ""}
            </p>
          ) : null}
          {updated ? (
            <p className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Invoice allocations updated.
            </p>
          ) : null}
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-slate-100">What this supports</h3>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <li>• extract supplier, invoice number, dates, and gross total from PDFs or OCR image uploads</li>
            <li>• auto-suggest split allocations across multiple payments when one invoice was settled in parts</li>
            <li>• allocate one bundled payment across several invoices by assigning partial amounts manually</li>
            <li>• keep original documents downloadable and export a dedicated subsidy-proof CSV schema</li>
            <li>• highlight open remainders so partially evidenced invoices stay visible in review</li>
          </ul>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Invoice review queue</h3>
            <p className="mt-2 text-sm text-slate-400">Allocate one or more payments per invoice, or re-use one bundled payment across several invoices.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <FilterLink active={filter === "all"} href="/invoices?filter=all" label={`All (${allInvoices.length})`} />
            <FilterLink active={filter === "unmatched"} href="/invoices?filter=unmatched" label={`Needs review (${unmatchedCount})`} />
            <FilterLink active={filter === "matched"} href="/invoices?filter=matched" label={`Matched (${matchedCount})`} />
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {invoices.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-6 text-sm text-slate-300">
              No invoices in this filter yet.
            </div>
          ) : null}

          {invoices.map((invoice: InvoiceItem) => {
            const candidates = candidatesByInvoice.get(invoice.id) ?? [];
            return (
              <article key={invoice.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-slate-100">{invoice.vendorName}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {invoice.fileName}
                      {invoice.invoiceNumber ? ` · #${invoice.invoiceNumber}` : ""}
                      {invoice.extractionMethod ? ` · ${invoice.extractionMethod}` : ""}
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      {invoice.invoiceDate.toISOString().slice(0, 10)}
                      {invoice.dueDate ? ` · due ${invoice.dueDate.toISOString().slice(0, 10)}` : ""}
                      {` · ${formatCurrency(Number(invoice.totalAmount))}`}
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      Linked: {formatCurrency(invoice.derivedLinkedAmount)} · Remaining: {formatCurrency(invoice.derivedRemainingAmount)}
                    </div>
                    {invoice.notes ? <div className="mt-2 text-sm text-slate-400">{invoice.notes}</div> : null}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-100">{renderStatus(invoice.derivedStatus)}</div>
                    {invoice.derivedMatchConfidence ? (
                      <div className="mt-1 text-xs text-slate-400">confidence {Math.round(Number(invoice.derivedMatchConfidence) * 100)}%</div>
                    ) : null}
                    {invoice.derivedMatchReason ? <div className="mt-1 max-w-sm text-xs text-slate-400">{invoice.derivedMatchReason}</div> : null}
                    <a
                      className="mt-3 inline-block rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-emerald-400 hover:text-emerald-300"
                      href={`/invoices/${invoice.id}/file`}
                    >
                      Download original
                    </a>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Current allocations</div>
                    {invoice.paymentMatches.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        {invoice.paymentMatches.map((paymentMatch: PaymentMatchItem) => (
                          <div key={paymentMatch.id} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-slate-100">{paymentMatch.transaction.account.name}</div>
                                <div>{paymentMatch.transaction.bookingDate.toISOString().slice(0, 10)}</div>
                                <div>{formatCurrency(Math.abs(Number(paymentMatch.transaction.amount)))} total payment</div>
                                <div>{formatCurrency(Number(paymentMatch.allocatedAmount))} allocated to this invoice</div>
                                <div className="text-slate-400">{paymentMatch.transaction.counterpartyName ?? paymentMatch.transaction.purposeRaw}</div>
                                {paymentMatch.transaction.category ? (
                                  <div className="text-slate-500">{paymentMatch.transaction.category.name}</div>
                                ) : null}
                              </div>
                              <form action={clearInvoiceMatchAction}>
                                <input name="invoiceId" type="hidden" value={invoice.id} />
                                <input name="transactionId" type="hidden" value={paymentMatch.transaction.id} />
                                <input name="filter" type="hidden" value={filter} />
                                <button className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-rose-400 hover:text-rose-300" type="submit">
                                  Remove allocation
                                </button>
                              </form>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-slate-400">No payment linked yet.</div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Suggested candidate payments</div>
                    <div className="mt-3 space-y-3">
                      {candidates.length === 0 ? <div className="text-sm text-slate-400">No candidate payments found.</div> : null}
                      {candidates.map((candidate) => (
                        <form key={candidate.id} action={confirmInvoiceMatchAction} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                          <input name="invoiceId" type="hidden" value={invoice.id} />
                          <input name="transactionId" type="hidden" value={candidate.id} />
                          <input name="filter" type="hidden" value={filter} />
                          <div className="text-sm text-slate-100">
                            {candidate.bookingDate.toISOString().slice(0, 10)} · {formatCurrency(Math.abs(candidate.amount))} · {candidate.accountName}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            Available {formatCurrency(candidate.availableAmount)}
                            {candidate.reason ? ` · ${candidate.reason}` : ""}
                            {candidate.selected ? ` · currently allocated ${formatCurrency(candidate.existingAllocatedAmount)}` : ""}
                          </div>
                          <div className="mt-3 flex flex-wrap items-end gap-3">
                            <label className="text-xs text-slate-400">
                              Allocation amount
                              <input
                                className="mt-1 w-32 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                                defaultValue={candidate.suggestedAllocationAmount.toFixed(2)}
                                min="0.01"
                                name="allocatedAmount"
                                step="0.01"
                                type="number"
                              />
                            </label>
                            <button className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950" type="submit">
                              {candidate.selected ? "Update allocation" : "Allocate payment"}
                            </button>
                          </div>
                        </form>
                      ))}
                    </div>
                    {invoice.paymentMatches.length > 0 ? (
                      <form action={clearInvoiceMatchAction} className="mt-4">
                        <input name="invoiceId" type="hidden" value={invoice.id} />
                        <input name="filter" type="hidden" value={filter} />
                        <button className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-rose-400 hover:text-rose-300" type="submit">
                          Clear all allocations
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </FeaturePage>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilter(value: string | undefined): InvoiceFilter {
  if (value === "matched" || value === "unmatched") {
    return value;
  }

  return "all";
}

function renderStatus(status: string | undefined | null) {
  switch (status) {
    case "AUTO_MATCHED":
      return "Auto-matched";
    case "MANUALLY_CONFIRMED":
      return "Confirmed";
    case "PARTIALLY_MATCHED":
      return "Partially matched";
    case "UNMATCHED":
      return "Needs review";
    default:
      return "Stored";
  }
}

function FilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <a
      className={active
        ? "rounded-full bg-emerald-400 px-4 py-2 font-semibold text-slate-950"
        : "rounded-full border border-slate-700 px-4 py-2 font-semibold text-slate-100 hover:border-emerald-400 hover:text-emerald-300"}
      href={href}
    >
      {label}
    </a>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-50">{value}</p>
    </article>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
