import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/db/prisma";
import { formatNumber } from "@/lib/format";
import { getViewerHouseholdContext } from "@/lib/household/viewer";

const KIND_LABEL: Record<"INCOME" | "EXPENSE" | "TRANSFER", string> = {
  INCOME: "Einnahmen",
  EXPENSE: "Ausgaben",
  TRANSFER: "Umbuchungen",
};

export default async function CategoriesPage() {
  const context = await getViewerHouseholdContext();

  const categories = await prisma.category.findMany({
    where: { householdId: context.householdId },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    include: { _count: { select: { transactions: true } } },
  });

  const grouped = new Map<string, typeof categories>();
  for (const category of categories) {
    const arr = grouped.get(category.kind) ?? [];
    arr.push(category);
    grouped.set(category.kind, arr);
  }

  return (
    <>
      <PageHeader
        eyebrow="categories"
        title="Household categories"
        description="System categories seeded for the household. CRUD (rename, archive, custom categories) ships in a follow-up — system categories cover the MVP."
      />

      <div className="grid grid-cols-12 gap-gutter">
        {Array.from(grouped.entries()).map(([kind, items]) => (
          <div key={kind} className="col-span-12">
            <Card>
              <h3 className="text-headline-sm text-on-surface mb-md">
                {KIND_LABEL[kind as keyof typeof KIND_LABEL] ?? kind}
              </h3>
              <DataTable
                columns={[
                  { key: "name", header: "Name", render: (c) => c.name },
                  { key: "slug", header: "Slug", render: (c) => c.slug },
                  {
                    key: "system",
                    header: "Typ",
                    render: (c) =>
                      c.isSystem ? (
                        <Badge variant="info" icon="label">
                          System
                        </Badge>
                      ) : (
                        <Badge variant="neutral">Custom</Badge>
                      ),
                  },
                  {
                    key: "archived",
                    header: "Status",
                    render: (c) =>
                      c.isArchived ? (
                        <Badge variant="neutral" icon="cancel">
                          archiviert
                        </Badge>
                      ) : (
                        <Badge variant="success" icon="check_circle">
                          aktiv
                        </Badge>
                      ),
                  },
                  {
                    key: "count",
                    header: "Transaktionen",
                    align: "right",
                    tabularNums: true,
                    render: (c) => formatNumber(c._count.transactions),
                  },
                ]}
                rows={items}
                getRowKey={(c) => c.id}
                emptyState="Keine Kategorien in diesem Typ."
              />
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}
