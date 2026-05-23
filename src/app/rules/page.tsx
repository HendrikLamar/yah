import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/db/prisma";
import {
  buildAccountVisibilityFilter,
  getViewerHouseholdContext,
} from "@/lib/household/viewer";

import {
  applyRuleToHistoryAction,
  deleteRuleAction,
  toggleRuleAction,
} from "./actions";
import {
  RuleForm,
  type AccountOption,
  type CategoryOption,
} from "./rule-form";

const FIELD_LABEL: Record<string, string> = {
  PURPOSE_RAW: "Verwendungszweck",
  COUNTERPARTY_NAME: "Auftraggeber",
  NORMALIZED_MERCHANT: "Norm. Händler",
  AMOUNT: "Betrag",
  DIRECTION: "Richtung",
  ACCOUNT_ID: "Konto",
};

const OPERATOR_LABEL: Record<string, string> = {
  CONTAINS: "enthält",
  EQUALS: "=",
  STARTS_WITH: "beginnt mit",
  REGEX: "regex",
  AMOUNT_GT: ">",
  AMOUNT_LT: "<",
};

type RulesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RulesPage({ searchParams }: RulesPageProps) {
  const context = await getViewerHouseholdContext();
  const resolved = searchParams ? await searchParams : {};
  const error = firstValue(resolved.error);
  const created = firstValue(resolved.created);
  const updated = firstValue(resolved.updated);
  const deleted = firstValue(resolved.deleted);
  const applied = firstValue(resolved.applied);
  const updatedRows = firstValue(resolved.updated);

  const [rules, categories, accounts] = await Promise.all([
    prisma.categorizationRule.findMany({
      where: { householdId: context.householdId },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      include: {
        actionCategory: { select: { name: true } },
        account: { select: { name: true } },
      },
    }),
    prisma.category.findMany({
      where: { householdId: context.householdId, isArchived: false },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true },
    }),
    prisma.account.findMany({
      where: {
        householdId: context.householdId,
        isActive: true,
        ...buildAccountVisibilityFilter(context.viewer),
      },
      select: { id: true, name: true, ibanLast4: true },
      orderBy: [{ visibilityOwnerType: "asc" }, { name: "asc" }],
    }),
  ]);

  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const accountOptions: AccountOption[] = accounts.map((a) => ({
    id: a.id,
    label: `${a.name}${a.ibanLast4 ? ` · ····${a.ibanLast4}` : ""}`,
  }));

  return (
    <>
      <PageHeader
        eyebrow="rules"
        title="Categorization rules"
        description="Deterministic rules applied at import time and on demand. Lower priority runs first. The first matching rule wins."
      />

      {error ? (
        <div className="mb-md">
          <Badge variant="error" icon="error">
            {error}
          </Badge>
        </div>
      ) : null}
      {created ? <SuccessBadge>Regel angelegt.</SuccessBadge> : null}
      {applied && updatedRows ? (
        <SuccessBadge>
          {applied} Treffer · {updatedRows} Transaktionen aktualisiert.
        </SuccessBadge>
      ) : null}
      {!applied && updated ? <SuccessBadge>Regel gespeichert.</SuccessBadge> : null}
      {deleted ? <SuccessBadge>Regel gelöscht.</SuccessBadge> : null}

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12">
          <Card>
            <h3 className="text-headline-sm text-on-surface mb-md">Neue Regel</h3>
            <RuleForm
              mode="create"
              categories={categoryOptions}
              accounts={accountOptions}
            />
          </Card>
        </div>
      </div>

      <Card>
        <h3 className="text-headline-sm text-on-surface mb-md">
          Existing rules ({rules.length})
        </h3>
        <DataTable
          columns={[
            { key: "priority", header: "Prio", render: (r) => String(r.priority) },
            { key: "name", header: "Name", render: (r) => r.name },
            {
              key: "match",
              header: "Match",
              render: (r) => (
                <span className="text-body-sm text-on-surface-variant">
                  {FIELD_LABEL[r.matchField]} {OPERATOR_LABEL[r.matchOperator]}{" "}
                  <code className="bg-surface-container-low px-xs rounded">{r.matchValue}</code>
                </span>
              ),
            },
            {
              key: "action",
              header: "Aktion",
              render: (r) => (
                <span className="text-body-sm text-on-surface-variant">
                  {r.actionCategory?.name ?? "—"}
                  {r.actionMarkTransfer ? " · Transfer" : ""}
                  {r.actionResponsibilityType
                    ? ` · ${r.actionResponsibilityType === "SHARED" ? "Geteilt" : "Privat"}`
                    : ""}
                </span>
              ),
            },
            {
              key: "scope",
              header: "Konto",
              render: (r) => (r.account ? r.account.name : "alle"),
            },
            {
              key: "enabled",
              header: "Status",
              render: (r) =>
                r.isEnabled ? (
                  <Badge variant="success" icon="check_circle">
                    aktiv
                  </Badge>
                ) : (
                  <Badge variant="neutral" icon="cancel">
                    aus
                  </Badge>
                ),
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (r) => (
                <div className="flex items-center gap-xs justify-end">
                  <form action={toggleRuleAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      type="hidden"
                      name="enable"
                      value={String(!r.isEnabled)}
                    />
                    <Button variant="ghost" size="sm" type="submit">
                      {r.isEnabled ? "aus" : "an"}
                    </Button>
                  </form>
                  <form action={applyRuleToHistoryAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button variant="ghost" size="sm" type="submit">
                      auf Verlauf anwenden
                    </Button>
                  </form>
                  <form action={deleteRuleAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button variant="ghost" size="sm" type="submit">
                      löschen
                    </Button>
                  </form>
                </div>
              ),
            },
          ]}
          rows={rules}
          getRowKey={(r) => r.id}
          emptyState="Noch keine Regeln. Erstelle die erste oben."
        />
      </Card>
    </>
  );
}

function SuccessBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-md">
      <Badge variant="success" icon="check_circle">
        {children}
      </Badge>
    </div>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
