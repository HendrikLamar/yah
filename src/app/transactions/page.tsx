import { FeaturePage } from "@/components/app-shell/feature-page";

export default function TransactionsPage() {
  return (
    <FeaturePage
      eyebrow="transactions"
      title="Imported transaction feed"
      description="This page will show the unified review workflow for DKB giro and card transactions, including filters, manual categorization, and shared/personal responsibility assignment."
      cards={[
        {
          title: "Filters",
          body: "Date range, account, category, responsibility, income/expense, and uncategorized-only views.",
        },
        {
          title: "Bulk actions",
          body: "Apply categories, set shared vs personal responsibility, and flag internal transfers once imported data is live.",
        },
        {
          title: "Tonight's blocker",
          body: "We first need to prove that DKB accounts and recent transactions can be pulled reliably through the FinTS spike.",
        },
      ]}
    />
  );
}
