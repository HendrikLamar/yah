import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function RulesPage() {
  return (
    <>
      <PageHeader
        eyebrow="rules"
        title="Categorization rules"
        description="This page is reserved for deterministic automation rules such as REWE → Groceries or employer payment → Salary. Starting with explicit rules keeps the MVP debuggable and household-safe."
      />

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Rule types</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Contains, starts with, equals, regex, amount thresholds, and account-specific
              matching.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Rule outputs</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Set category, set shared/personal responsibility, and flag internal transfers.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Why rules first</h3>
            <p className="mt-md text-body-sm text-on-surface">
              They are predictable, explainable, and easy to override before any future
              ML-based suggestions are introduced.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
