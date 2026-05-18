import { FeaturePage } from "@/components/app-shell/feature-page";

export default function RulesPage() {
  return (
    <FeaturePage
      eyebrow="rules"
      title="Categorization rules"
      description="This page is reserved for deterministic automation rules such as REWE → Groceries or employer payment → Salary. Starting with explicit rules keeps the MVP debuggable and household-safe."
      cards={[
        {
          title: "Rule types",
          body: "Contains, starts with, equals, regex, amount thresholds, and account-specific matching.",
        },
        {
          title: "Rule outputs",
          body: "Set category, set shared/personal responsibility, and flag internal transfers.",
        },
        {
          title: "Why rules first",
          body: "They are predictable, explainable, and easy to override before any future ML-based suggestions are introduced.",
        },
      ]}
    />
  );
}
