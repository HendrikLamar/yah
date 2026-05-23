import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/db/prisma";
import { formatDateRange, formatMaskedIban, formatNumber } from "@/lib/format";
import {
  buildAccountVisibilityFilter,
  getViewerHouseholdContext,
} from "@/lib/household/viewer";

type AccountRow = {
  id: string;
  name: string;
  ibanLast4: string | null;
  accountType: "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "OTHER";
  visibilityOwnerType: "SHARED" | "USER";
  ownerDisplayName: string | null;
  provider: "DKB" | "CSV_UPLOAD";
  transactionCount: number;
  earliestBookingDate: Date | null;
  latestBookingDate: Date | null;
  shareCount: number;
};

const ACCOUNT_TYPE_LABEL: Record<AccountRow["accountType"], string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  CREDIT_CARD: "Credit card",
  OTHER: "Other",
};

const PROVIDER_LABEL: Record<AccountRow["provider"], string> = {
  DKB: "DKB",
  CSV_UPLOAD: "CSV upload",
};

export default async function AccountsPage() {
  const context = await getViewerHouseholdContext();

  const accounts = await prisma.account.findMany({
    where: {
      householdId: context.householdId,
      isActive: true,
      ...buildAccountVisibilityFilter(context.viewer),
    },
    include: {
      bankConnection: { select: { provider: true } },
      visibilityOwnerUser: { select: { displayName: true } },
      _count: { select: { transactions: true, shares: true } },
    },
    orderBy: [{ visibilityOwnerType: "asc" }, { name: "asc" }],
  });

  const accountIds = accounts.map((account) => account.id);
  const ranges = accountIds.length
    ? await prisma.transaction.groupBy({
        by: ["accountId"],
        where: {
          householdId: context.householdId,
          accountId: { in: accountIds },
        },
        _min: { bookingDate: true },
        _max: { bookingDate: true },
      })
    : [];
  const rangeByAccount = new Map(ranges.map((range) => [range.accountId, range]));

  const rows: AccountRow[] = accounts.map((account) => {
    const range = rangeByAccount.get(account.id);
    return {
      id: account.id,
      name: account.name,
      ibanLast4: account.ibanLast4,
      accountType: account.accountType,
      visibilityOwnerType: account.visibilityOwnerType,
      ownerDisplayName: account.visibilityOwnerUser?.displayName ?? null,
      provider: account.bankConnection.provider,
      transactionCount: account._count.transactions,
      earliestBookingDate: range?._min.bookingDate ?? null,
      latestBookingDate: range?._max.bookingDate ?? null,
      shareCount: account._count.shares,
    };
  });

  const sharedCount = rows.filter((row) => row.visibilityOwnerType === "SHARED").length;
  const privateCount = rows.length - sharedCount;

  return (
    <>
      <PageHeader
        eyebrow="accounts"
        title="Your accounts"
        description={`Accounts visible to you in ${context.householdName}: shared accounts plus your own private ones. Visibility is enforced on every query — partners only see what you've marked as shared.`}
        status={{
          label: `${rows.length} visible · ${sharedCount} shared · ${privateCount} private`,
          variant: "success",
        }}
      />

      <Card>
        <DataTable
          columns={[
            { key: "name", header: "Account", render: (account) => account.name },
            {
              key: "iban",
              header: "IBAN",
              render: (account) => formatMaskedIban(account.ibanLast4),
            },
            {
              key: "type",
              header: "Type",
              render: (account) => ACCOUNT_TYPE_LABEL[account.accountType],
            },
            {
              key: "visibility",
              header: "Visibility",
              render: (account) =>
                account.visibilityOwnerType === "SHARED" ? (
                  <Badge variant="info" icon="group">
                    Shared with household
                  </Badge>
                ) : (
                  <Badge variant="neutral" icon="lock">
                    Private — {account.ownerDisplayName ?? "you"}
                  </Badge>
                ),
            },
            {
              key: "provider",
              header: "Source",
              render: (account) => PROVIDER_LABEL[account.provider],
            },
            {
              key: "transactions",
              header: "Transactions",
              align: "right",
              tabularNums: true,
              render: (account) => formatNumber(account.transactionCount),
            },
            {
              key: "period",
              header: "Period",
              render: (account) =>
                account.earliestBookingDate && account.latestBookingDate
                  ? formatDateRange(account.earliestBookingDate, account.latestBookingDate)
                  : "—",
            },
            {
              key: "shared",
              header: "Geteilt mit",
              render: (account) =>
                account.shareCount > 0 ? `${account.shareCount} Person(en)` : "—",
            },
            {
              key: "manage",
              header: "",
              align: "right",
              render: (account) => (
                <Button
                  as="link"
                  href={`/accounts/${account.id}/access`}
                  variant="ghost"
                  size="sm"
                >
                  Zugriff verwalten
                </Button>
              ),
            },
          ]}
          rows={rows}
          getRowKey={(account) => account.id}
          emptyState="No accounts yet — upload a CSV on the Transactions page to get started."
        />
      </Card>
    </>
  );
}
