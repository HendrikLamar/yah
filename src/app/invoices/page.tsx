import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatIsoDate } from "@/lib/format";
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

  const candidatesByInvoice = new Map(
    await Promise.all(
      invoices.map(
        async (invoice) =>
          [
            invoice.id,
            await listMatchCandidatesForInvoice({
              householdId: context.householdId,
              invoiceId: invoice.id,
            }),
          ] as const,
      ),
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
    <>
      <PageHeader
        eyebrow="invoices"
        title="Invoice OCR and payment allocations"
        description={`Upload supplier invoices for ${context.householdName}, extract metadata from PDF/image evidence, map one invoice to many payments, and export a subsidy-proof schema.`}
        status={{
          label: context.viewer
            ? `Uploader: ${context.viewer.displayName}`
            : "Invoice workflow inactive",
          variant: "success",
        }}
      />

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 md:col-span-4">
          <MetricCard label="Invoices stored" value={String(allInvoices.length)} />
        </div>
        <div className="col-span-12 md:col-span-4">
          <MetricCard label="Fully matched" value={String(matchedCount)} />
        </div>
        <div className="col-span-12 md:col-span-4">
          <MetricCard label="Needs review" value={String(unmatchedCount)} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 xl:col-span-7">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-md">
              <div>
                <h3 className="text-headline-sm text-on-surface">Upload invoice</h3>
                <p className="mt-sm text-body-sm text-on-surface-variant">
                  PDFs are parsed directly. Image uploads run OCR. Leave fields blank to
                  auto-detect them from the document.
                </p>
              </div>
              <div className="flex flex-wrap gap-xs">
                <Button as="link" variant="ghost" size="sm" href="/invoices/export">
                  Export CSV
                </Button>
                <Button
                  as="link"
                  variant="ghost"
                  size="sm"
                  href="/invoices/export?format=subsidy"
                >
                  Export subsidy-proof v1
                </Button>
              </div>
            </div>

            <form action={uploadInvoiceAction} className="mt-md grid gap-md md:grid-cols-2">
              <FileField label="Invoice file" name="invoiceFile" />
              <TextField
                label="Vendor / supplier"
                name="vendorName"
                placeholder="optional if OCR finds it"
              />
              <TextField label="Invoice number" name="invoiceNumber" placeholder="optional" />
              <TextField label="Invoice date" name="invoiceDate" type="date" />
              <TextField label="Due date" name="dueDate" type="date" />
              <TextField
                label="Gross amount (EUR)"
                name="totalAmount"
                type="number"
                min="0.01"
                step="0.01"
              />
              <label className="block text-body-sm text-on-surface md:col-span-2">
                Notes
                <textarea
                  className="mt-xs min-h-28 w-full bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                  name="notes"
                />
              </label>
              <div className="md:col-span-2">
                <Button variant="secondary" icon="upload" type="submit">
                  Upload, extract, and match invoice
                </Button>
              </div>
            </form>

            {error ? (
              <div className="mt-md">
                <Badge variant="error" icon="error">
                  {error}
                </Badge>
              </div>
            ) : null}
            {uploaded ? (
              <div className="mt-md">
                <Badge variant="success" icon="check_circle">
                  {`Uploaded ${file ?? "invoice"} · ${renderStatus(status)}${
                    transaction ? ` · primary payment ${transaction}` : ""
                  }${allocations ? ` · ${allocations} linked payments` : ""}`}
                </Badge>
              </div>
            ) : null}
            {updated ? (
              <div className="mt-md">
                <Badge variant="success" icon="check_circle">
                  Invoice allocations updated.
                </Badge>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-5">
          <Card>
            <h3 className="text-headline-sm text-on-surface">What this supports</h3>
            <ul className="mt-md space-y-sm text-body-sm text-on-surface">
              <FeatureLine>
                extract supplier, invoice number, dates, and gross total from PDFs or OCR
                image uploads
              </FeatureLine>
              <FeatureLine>
                auto-suggest split allocations across multiple payments when one invoice was
                settled in parts
              </FeatureLine>
              <FeatureLine>
                allocate one bundled payment across several invoices by assigning partial
                amounts manually
              </FeatureLine>
              <FeatureLine>
                keep original documents downloadable and export a dedicated subsidy-proof
                CSV schema
              </FeatureLine>
              <FeatureLine>
                highlight open remainders so partially evidenced invoices stay visible in
                review
              </FeatureLine>
            </ul>
          </Card>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-md mb-md">
          <div>
            <h3 className="text-headline-sm text-on-surface">Invoice review queue</h3>
            <p className="mt-xs text-body-sm text-on-surface-variant">
              Allocate one or more payments per invoice, or re-use one bundled payment
              across several invoices.
            </p>
          </div>
          <div className="flex flex-wrap gap-xs">
            <FilterLink
              active={filter === "all"}
              href="/invoices?filter=all"
              label={`All (${allInvoices.length})`}
            />
            <FilterLink
              active={filter === "unmatched"}
              href="/invoices?filter=unmatched"
              label={`Needs review (${unmatchedCount})`}
            />
            <FilterLink
              active={filter === "matched"}
              href="/invoices?filter=matched"
              label={`Matched (${matchedCount})`}
            />
          </div>
        </div>

        <div className="space-y-md">
          {invoices.length === 0 ? (
            <div className="rounded-lg bg-surface-container-low px-md py-lg text-body-sm text-on-surface-variant">
              No invoices in this filter yet.
            </div>
          ) : null}

          {invoices.map((invoice) => {
            const candidates = candidatesByInvoice.get(invoice.id) ?? [];
            return (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                candidates={candidates}
                filter={filter}
              />
            );
          })}
        </div>
      </Card>
    </>
  );
}

function InvoiceCard({
  invoice,
  candidates,
  filter,
}: {
  invoice: InvoiceItem;
  candidates: Awaited<ReturnType<typeof listMatchCandidatesForInvoice>>;
  filter: InvoiceFilter;
}) {
  return (
    <article className="rounded-lg border border-outline-variant bg-surface-container-low p-md">
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div>
          <div className="text-body-md font-semibold text-on-surface">
            {invoice.vendorName}
          </div>
          <div className="mt-xs text-body-sm text-on-surface-variant">
            {invoice.fileName}
            {invoice.invoiceNumber ? ` · #${invoice.invoiceNumber}` : ""}
            {invoice.extractionMethod ? ` · ${invoice.extractionMethod}` : ""}
          </div>
          <div className="mt-xs text-body-sm text-on-surface">
            {formatIsoDate(invoice.invoiceDate)}
            {invoice.dueDate ? ` · due ${formatIsoDate(invoice.dueDate)}` : ""}
            {` · ${formatCurrency(Number(invoice.totalAmount))}`}
          </div>
          <div className="mt-xs text-body-sm text-on-surface-variant">
            Linked: {formatCurrency(invoice.derivedLinkedAmount)} · Remaining:{" "}
            {formatCurrency(invoice.derivedRemainingAmount)}
          </div>
          {invoice.notes ? (
            <div className="mt-xs text-body-sm text-on-surface-variant">{invoice.notes}</div>
          ) : null}
        </div>
        <div className="text-right">
          <div className="text-body-sm font-semibold text-on-surface">
            {renderStatus(invoice.derivedStatus)}
          </div>
          {invoice.derivedMatchConfidence ? (
            <div className="mt-xs text-label-md text-on-surface-variant">
              confidence {Math.round(Number(invoice.derivedMatchConfidence) * 100)}%
            </div>
          ) : null}
          {invoice.derivedMatchReason ? (
            <div className="mt-xs max-w-sm text-label-md text-on-surface-variant">
              {invoice.derivedMatchReason}
            </div>
          ) : null}
          <div className="mt-sm">
            <Button
              as="link"
              variant="ghost"
              size="sm"
              href={`/invoices/${invoice.id}/file`}
            >
              Download original
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-md grid gap-md xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-lg border border-outline-variant bg-surface p-md text-body-sm text-on-surface">
          <div className="text-label-md text-secondary uppercase tracking-wider">
            Current allocations
          </div>
          {invoice.paymentMatches.length > 0 ? (
            <div className="mt-sm space-y-sm">
              {invoice.paymentMatches.map((paymentMatch: PaymentMatchItem) => (
                <PaymentMatchRow
                  key={paymentMatch.id}
                  paymentMatch={paymentMatch}
                  invoiceId={invoice.id}
                  filter={filter}
                />
              ))}
            </div>
          ) : (
            <div className="mt-sm text-on-surface-variant">No payment linked yet.</div>
          )}
        </div>

        <div className="rounded-lg border border-outline-variant bg-surface p-md">
          <div className="text-label-md text-secondary uppercase tracking-wider">
            Suggested candidate payments
          </div>
          <div className="mt-sm space-y-sm">
            {candidates.length === 0 ? (
              <div className="text-body-sm text-on-surface-variant">
                No candidate payments found.
              </div>
            ) : null}
            {candidates.map((candidate) => (
              <form
                key={candidate.id}
                action={confirmInvoiceMatchAction}
                className="rounded-lg border border-outline-variant bg-surface-container-low p-sm"
              >
                <input name="invoiceId" type="hidden" value={invoice.id} />
                <input name="transactionId" type="hidden" value={candidate.id} />
                <input name="filter" type="hidden" value={filter} />
                <div className="text-body-sm text-on-surface">
                  {formatIsoDate(candidate.bookingDate)} ·{" "}
                  {formatCurrency(Math.abs(candidate.amount))} · {candidate.accountName}
                </div>
                <div className="mt-xs text-label-md text-on-surface-variant">
                  Available {formatCurrency(candidate.availableAmount)}
                  {candidate.reason ? ` · ${candidate.reason}` : ""}
                  {candidate.selected
                    ? ` · currently allocated ${formatCurrency(candidate.existingAllocatedAmount)}`
                    : ""}
                </div>
                <div className="mt-sm flex flex-wrap items-end gap-sm">
                  <label className="text-label-md text-on-surface-variant">
                    Allocation amount
                    <input
                      className="mt-xs w-32 rounded-lg border border-outline-variant bg-surface px-sm py-xs text-body-sm text-on-surface"
                      defaultValue={candidate.suggestedAllocationAmount.toFixed(2)}
                      min="0.01"
                      name="allocatedAmount"
                      step="0.01"
                      type="number"
                    />
                  </label>
                  <Button variant="secondary" size="sm" type="submit">
                    {candidate.selected ? "Update allocation" : "Allocate payment"}
                  </Button>
                </div>
              </form>
            ))}
          </div>
          {invoice.paymentMatches.length > 0 ? (
            <form action={clearInvoiceMatchAction} className="mt-md">
              <input name="invoiceId" type="hidden" value={invoice.id} />
              <input name="filter" type="hidden" value={filter} />
              <Button variant="ghost" size="sm" type="submit">
                Clear all allocations
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function PaymentMatchRow({
  paymentMatch,
  invoiceId,
  filter,
}: {
  paymentMatch: PaymentMatchItem;
  invoiceId: string;
  filter: InvoiceFilter;
}) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-low p-sm">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div className="text-body-sm">
          <div className="font-semibold text-on-surface">
            {paymentMatch.transaction.account.name}
          </div>
          <div className="text-on-surface-variant">
            {formatIsoDate(paymentMatch.transaction.bookingDate)}
          </div>
          <div className="text-on-surface">
            {formatCurrency(Math.abs(Number(paymentMatch.transaction.amount)))} total payment
          </div>
          <div className="text-on-surface">
            {formatCurrency(Number(paymentMatch.allocatedAmount))} allocated to this invoice
          </div>
          <div className="text-on-surface-variant">
            {paymentMatch.transaction.counterpartyName ?? paymentMatch.transaction.purposeRaw}
          </div>
          {paymentMatch.transaction.category ? (
            <div className="text-on-surface-variant">
              {paymentMatch.transaction.category.name}
            </div>
          ) : null}
        </div>
        <form action={clearInvoiceMatchAction}>
          <input name="invoiceId" type="hidden" value={invoiceId} />
          <input name="transactionId" type="hidden" value={paymentMatch.transaction.id} />
          <input name="filter" type="hidden" value={filter} />
          <Button variant="ghost" size="sm" type="submit">
            Remove allocation
          </Button>
        </form>
      </div>
    </div>
  );
}

function FilterLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Button as="link" variant={active ? "pill" : "ghost"} size="sm" href={href}>
      {label}
    </Button>
  );
}

function FileField({ label, name }: { label: string; name: string }) {
  return (
    <label className="block text-body-sm text-on-surface md:col-span-2">
      {label}
      <input
        accept=".pdf,image/*,application/pdf"
        className="mt-xs block w-full bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface file:mr-md file:rounded-lg file:border-0 file:bg-surface-container-high file:px-md file:py-xs file:text-label-md file:text-on-surface"
        name={name}
        required
        type="file"
      />
    </label>
  );
}

function TextField({
  label,
  name,
  type = "text",
  placeholder,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  min?: string;
  step?: string;
}) {
  return (
    <label className="block text-body-sm text-on-surface">
      {label}
      <input
        className="mt-xs w-full bg-surface border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
        name={name}
        type={type}
        placeholder={placeholder}
        min={min}
        step={step}
      />
    </label>
  );
}

function FeatureLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-sm">
      <Icon name="check_circle" filled className="text-secondary mt-0.5" />
      <span>{children}</span>
    </li>
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
