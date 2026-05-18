import { FeaturePage } from "@/components/app-shell/feature-page";
import { getDkbConnectorDescriptor } from "@/lib/banking/dkb-connector";

export default function AccountsPage() {
  const descriptor = getDkbConnectorDescriptor(process.env);

  return (
    <FeaturePage
      eyebrow="accounts"
      title="Connected accounts"
      description="After the live DKB test, this page will show discovered shared and personal accounts, their latest balances, and visibility ownership inside the household."
      statusLabel={`DKB connector: ${descriptor.status}`}
      statusTone={descriptor.status === "ready_for_test" ? "success" : "warning"}
      cards={[
        {
          title: "Ownership model",
          body: "Each account will be marked as shared, Hendrik-only, or wife-only, with visibility enforced from the start.",
        },
        {
          title: "Imported details",
          body: "Display name, masked IBAN, latest balance, sync status, and last successful refresh timestamp.",
        },
        {
          title: "Tonight's test outcome",
          body: descriptor.summary,
        },
      ]}
    />
  );
}
