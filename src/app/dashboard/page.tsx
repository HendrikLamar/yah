import { FeaturePage } from "@/components/app-shell/feature-page";

export default function DashboardPage() {
  return (
    <FeaturePage
      eyebrow="dashboard"
      title="Household dashboard"
      description="This page will become the main monthly overview for Hendrik and his wife: balances, income vs expenses, uncategorized items, and shared versus personal spending."
      cards={[
        {
          title: "Planned widgets",
          body: "Current month income, current month expenses, net cashflow, account balances, and uncategorized transaction count.",
        },
        {
          title: "Audience-aware view",
          body: "Shared data plus the signed-in user's personal accounts, without leaking the spouse's private accounts.",
        },
        {
          title: "Depends on",
          body: "Successful DKB validation, account persistence, transaction import, and category assignment.",
        },
      ]}
    />
  );
}
