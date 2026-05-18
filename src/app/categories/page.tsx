import { FeaturePage } from "@/components/app-shell/feature-page";

export default function CategoriesPage() {
  return (
    <FeaturePage
      eyebrow="categories"
      title="Household categories"
      description="The MVP will start with a practical category tree for a two-person household and evolve from real transaction review. The category model is intentionally simple until live bank data is confirmed."
      cards={[
        {
          title: "Initial defaults",
          body: "Salary, Other Income, Rent, Groceries, Eating Out, Mobility, Health, Insurance, Utilities, Shopping, Leisure, Savings, Transfer, and Uncategorized.",
        },
        {
          title: "Later actions",
          body: "Rename, reorder, archive, and map categories to recurring DKB transaction patterns.",
        },
        {
          title: "MVP principle",
          body: "Keep the category list short enough to be usable every week, not theoretically perfect on day one.",
        },
      ]}
    />
  );
}
