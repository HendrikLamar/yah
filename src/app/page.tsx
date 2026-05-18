import { FeaturePage } from "@/components/app-shell/feature-page";
import { getDkbConnectorDescriptor } from "@/lib/banking/dkb-connector";

export default function HomePage() {
  const descriptor = getDkbConnectorDescriptor(process.env);
  const statusTone = descriptor.status === "ready_for_test" ? "success" : "warning";

  return (
    <FeaturePage
      eyebrow="overview"
      title="Project status before tonight's live DKB test"
      description="The product foundation can move forward without exposing credentials: app shell, connector abstraction, and the Python FinTS spike are in place. Tonight we only need to provide the real DKB data in .env.dkb.local and run the connection test."
      statusLabel={descriptor.summary}
      statusTone={statusTone}
      cards={[
        {
          title: "DKB connector spike",
          body: "The live test harness is ready. It bootstraps TAN mechanisms, discovers accounts, fetches balances, and attempts recent transactions.",
        },
        {
          title: "Safe fallback",
          body: "If DKB FinTS proves unreliable tonight, the MVP can still continue with DKB export ingestion while keeping the same downstream transaction pipeline.",
        },
        {
          title: "Next build targets",
          body: "After the bank test, the next implementation wave is account persistence, transaction import, categories, and reporting pages.",
        },
      ]}
    >
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-slate-100">Tonight&apos;s runbook</h3>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-black/40 p-4 text-sm text-emerald-200">
{`cd /home/pi/.hermes/hermes-agent/scratch/household-finance
cp .env.dkb.local.example .env.dkb.local
# fill in the real DKB values
npm run dkb:test`}
          </pre>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-slate-100">Connector capabilities</h3>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <li>• accounts: {descriptor.capabilities.listsAccounts ? "ready to attempt" : "not planned"}</li>
            <li>• balances: {descriptor.capabilities.fetchesBalances ? "ready to attempt" : "not planned"}</li>
            <li>• transactions: {descriptor.capabilities.fetchesTransactions ? "ready to attempt" : "not planned"}</li>
            <li>• interactive TAN: {descriptor.capabilities.needsInteractiveTan ? "supported in spike" : "not needed"}</li>
          </ul>
        </article>
      </section>
    </FeaturePage>
  );
}
