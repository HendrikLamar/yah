import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        eyebrow="categories"
        title="Household categories"
        description="The MVP will start with a practical category tree for a two-person household and evolve from real transaction review. The category model is intentionally simple until live bank data is confirmed."
      />

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Initial defaults</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Salary, Other Income, Rent, Groceries, Eating Out, Mobility, Health, Insurance,
              Utilities, Shopping, Leisure, Savings, Transfer, and Uncategorized.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Later actions</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Rename, reorder, archive, and map categories to recurring DKB transaction patterns.
            </p>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface">MVP principle</h3>
            <p className="mt-md text-body-sm text-on-surface">
              Keep the category list short enough to be usable every week, not theoretically
              perfect on day one.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
