import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { getDkbConnectorDescriptor } from "@/lib/banking/dkb-connector";

export default function HomePage() {
  const descriptor = getDkbConnectorDescriptor(process.env);
  const statusVariant = descriptor.status === "ready_for_test" ? "success" : "neutral";

  return (
    <>
      <PageHeader
        eyebrow="overview"
        title="Project status before tonight's live DKB test"
        description="The product foundation can move forward without exposing credentials: app shell, connector abstraction, and the Python FinTS spike are in place. Tonight we only need to provide the real DKB data in .env.dkb.local and run the connection test."
        status={{ label: descriptor.summary, variant: statusVariant }}
      />

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">DKB connector spike</h3>
            <p className="mt-md text-body-sm text-on-surface">
              The live test harness is ready. It bootstraps TAN mechanisms, discovers accounts,
              fetches balances, and attempts recent transactions.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Safe fallback</h3>
            <p className="mt-md text-body-sm text-on-surface">
              If DKB FinTS proves unreliable tonight, the MVP can still continue with DKB export
              ingestion while keeping the same downstream transaction pipeline.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Next build targets</h3>
            <p className="mt-md text-body-sm text-on-surface">
              After the bank test, the next implementation wave is account persistence,
              transaction import, categories, and reporting pages.
            </p>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 lg:col-span-7">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Tonight's runbook</h3>
            <pre className="mt-md bg-surface-container-low rounded-lg p-md font-mono text-body-sm text-on-surface overflow-x-auto">
{`cd /home/pi/.hermes/hermes-agent/scratch/household-finance
cp .env.dkb.local.example .env.dkb.local
# fill in the real DKB values
npm run dkb:test`}
            </pre>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Connector capabilities</h3>
            <ul className="mt-md space-y-sm text-body-sm text-on-surface">
              <CapabilityRow
                ready={descriptor.capabilities.listsAccounts}
                label="accounts"
                trueText="ready to attempt"
                falseText="not planned"
              />
              <CapabilityRow
                ready={descriptor.capabilities.fetchesBalances}
                label="balances"
                trueText="ready to attempt"
                falseText="not planned"
              />
              <CapabilityRow
                ready={descriptor.capabilities.fetchesTransactions}
                label="transactions"
                trueText="ready to attempt"
                falseText="not planned"
              />
              <CapabilityRow
                ready={descriptor.capabilities.needsInteractiveTan}
                label="interactive TAN"
                trueText="supported in spike"
                falseText="not needed"
              />
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function CapabilityRow({
  ready,
  label,
  trueText,
  falseText,
}: {
  ready: boolean;
  label: string;
  trueText: string;
  falseText: string;
}) {
  return (
    <li className="flex items-start gap-sm">
      <Icon
        name={ready ? "check_circle" : "cancel"}
        filled={ready}
        className={ready ? "text-secondary mt-0.5" : "text-on-surface-variant mt-0.5"}
      />
      <span>
        {label}: {ready ? trueText : falseText}
      </span>
    </li>
  );
}
