import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getDkbConnectorDescriptor } from "@/lib/banking/dkb-connector";

export default function AccountsPage() {
  const descriptor = getDkbConnectorDescriptor(process.env);

  return (
    <>
      <PageHeader
        eyebrow="accounts"
        title="Connected accounts"
        description="After the live DKB test, this page will show discovered shared and personal accounts, their latest balances, and visibility ownership inside the household."
        status={{
          label: `DKB connector: ${descriptor.status}`,
          variant: descriptor.status === "ready_for_test" ? "success" : "neutral",
        }}
      />

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Ownership model</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Each account will be marked as shared, Hendrik-only, or wife-only, with visibility
              enforced from the start.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Imported details</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Display name, masked IBAN, latest balance, sync status, and last successful refresh
              timestamp.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Tonight's test outcome</h3>
            <p className="mt-md text-body-sm text-on-surface">{descriptor.summary}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
