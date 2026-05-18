import { scryptSync, randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { shouldSeedDemoData } from "./seed-demo";

const prisma = (() => {
  if (!shouldSeedDemoData(process.env)) {
    return null;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for seeding.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
})();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `scrypt$${salt}$${hash}`;
}

const SYSTEM_CATEGORIES = [
  ["salary", "Salary", "INCOME"],
  ["other-income", "Other Income", "INCOME"],
  ["rent", "Rent", "EXPENSE"],
  ["groceries", "Groceries", "EXPENSE"],
  ["eating-out", "Eating Out", "EXPENSE"],
  ["mobility", "Mobility", "EXPENSE"],
  ["health", "Health", "EXPENSE"],
  ["insurance", "Insurance", "EXPENSE"],
  ["utilities", "Utilities", "EXPENSE"],
  ["shopping", "Shopping", "EXPENSE"],
  ["leisure", "Leisure", "EXPENSE"],
  ["savings", "Savings", "EXPENSE"],
  ["transfer", "Transfer", "TRANSFER"],
  ["uncategorized", "Uncategorized", "EXPENSE"],
] as const;

const DEMO_PASSWORD = "demo12345";
const HOUSEHOLD_ID = "yah-demo-household";
const SHARED_CONNECTION_ID = "yah-demo-dkb";
const CSV_CONNECTION_ID = "yah-demo-csv";

async function main() {
  if (!shouldSeedDemoData(process.env)) {
    console.log("Skipping demo seed because ENABLE_DEMO_DATA is not true.");
    return;
  }

  if (!prisma) {
    throw new Error("DATABASE_URL is required for seeding.");
  }

  const [hendrikPasswordHash, partnerPasswordHash] = [
    hashPassword(DEMO_PASSWORD),
    hashPassword(DEMO_PASSWORD),
  ];

  const hendrik = await prisma.user.upsert({
    where: { email: "hendrik@example.local" },
    update: {
      displayName: "Hendrik",
      passwordHash: hendrikPasswordHash,
      role: "ADMIN",
    },
    create: {
      email: "hendrik@example.local",
      displayName: "Hendrik",
      passwordHash: hendrikPasswordHash,
      role: "ADMIN",
    },
  });

  const partner = await prisma.user.upsert({
    where: { email: "frau@example.local" },
    update: {
      displayName: "Frau",
      passwordHash: partnerPasswordHash,
      role: "MEMBER",
    },
    create: {
      email: "frau@example.local",
      displayName: "Frau",
      passwordHash: partnerPasswordHash,
      role: "MEMBER",
    },
  });

  const household = await prisma.household.upsert({
    where: { id: HOUSEHOLD_ID },
    update: { name: "yah demo household" },
    create: {
      id: HOUSEHOLD_ID,
      name: "yah demo household",
    },
  });

  await prisma.householdMember.upsert({
    where: {
      householdId_userId: {
        householdId: household.id,
        userId: hendrik.id,
      },
    },
    update: { membershipRole: "ADMIN" },
    create: {
      householdId: household.id,
      userId: hendrik.id,
      membershipRole: "ADMIN",
    },
  });

  await prisma.householdMember.upsert({
    where: {
      householdId_userId: {
        householdId: household.id,
        userId: partner.id,
      },
    },
    update: { membershipRole: "MEMBER" },
    create: {
      householdId: household.id,
      userId: partner.id,
      membershipRole: "MEMBER",
    },
  });

  const categories = new Map<string, string>();

  for (const [slug, name, kind] of SYSTEM_CATEGORIES) {
    const category = await prisma.category.upsert({
      where: {
        householdId_slug: {
          householdId: household.id,
          slug,
        },
      },
      update: { name, kind },
      create: {
        householdId: household.id,
        slug,
        name,
        kind,
        isSystem: true,
      },
    });

    categories.set(slug, category.id);
  }

  const dkbConnection = await prisma.bankConnection.upsert({
    where: { id: SHARED_CONNECTION_ID },
    update: {
      householdId: household.id,
      provider: "DKB",
      status: "ACTIVE",
      lastErrorMessage: null,
    },
    create: {
      id: SHARED_CONNECTION_ID,
      householdId: household.id,
      provider: "DKB",
      status: "ACTIVE",
    },
  });

  const csvConnection = await prisma.bankConnection.upsert({
    where: { id: CSV_CONNECTION_ID },
    update: {
      householdId: household.id,
      provider: "CSV_UPLOAD",
      status: "ACTIVE",
      lastErrorMessage: null,
    },
    create: {
      id: CSV_CONNECTION_ID,
      householdId: household.id,
      provider: "CSV_UPLOAD",
      status: "ACTIVE",
    },
  });

  const sharedAccount = await prisma.account.upsert({
    where: {
      bankConnectionId_externalAccountId: {
        bankConnectionId: dkbConnection.id,
        externalAccountId: "shared-checking",
      },
    },
    update: {
      householdId: household.id,
      name: "Gemeinschaftskonto",
      visibilityOwnerType: "SHARED",
      visibilityOwnerUserId: null,
    },
    create: {
      householdId: household.id,
      bankConnectionId: dkbConnection.id,
      externalAccountId: "shared-checking",
      name: "Gemeinschaftskonto",
      ibanLast4: "4321",
      visibilityOwnerType: "SHARED",
    },
  });

  const hendrikAccount = await prisma.account.upsert({
    where: {
      bankConnectionId_externalAccountId: {
        bankConnectionId: dkbConnection.id,
        externalAccountId: "hendrik-private",
      },
    },
    update: {
      householdId: household.id,
      name: "Hendrik Privat",
      visibilityOwnerType: "USER",
      visibilityOwnerUserId: hendrik.id,
    },
    create: {
      householdId: household.id,
      bankConnectionId: dkbConnection.id,
      externalAccountId: "hendrik-private",
      name: "Hendrik Privat",
      ibanLast4: "9876",
      visibilityOwnerType: "USER",
      visibilityOwnerUserId: hendrik.id,
    },
  });

  const partnerAccount = await prisma.account.upsert({
    where: {
      bankConnectionId_externalAccountId: {
        bankConnectionId: dkbConnection.id,
        externalAccountId: "frau-private",
      },
    },
    update: {
      householdId: household.id,
      name: "Frau Privat",
      visibilityOwnerType: "USER",
      visibilityOwnerUserId: partner.id,
    },
    create: {
      householdId: household.id,
      bankConnectionId: dkbConnection.id,
      externalAccountId: "frau-private",
      name: "Frau Privat",
      ibanLast4: "1234",
      visibilityOwnerType: "USER",
      visibilityOwnerUserId: partner.id,
    },
  });

  const csvFallbackAccount = await prisma.account.upsert({
    where: {
      bankConnectionId_externalAccountId: {
        bankConnectionId: csvConnection.id,
        externalAccountId: "csv-fallback",
      },
    },
    update: {
      householdId: household.id,
      name: "CSV Fallback Import",
      visibilityOwnerType: "SHARED",
      visibilityOwnerUserId: null,
    },
    create: {
      householdId: household.id,
      bankConnectionId: csvConnection.id,
      externalAccountId: "csv-fallback",
      name: "CSV Fallback Import",
      visibilityOwnerType: "SHARED",
    },
  });

  await prisma.accountBalance.deleteMany({
    where: {
      accountId: {
        in: [sharedAccount.id, hendrikAccount.id, partnerAccount.id, csvFallbackAccount.id],
      },
    },
  });

  await prisma.accountBalance.createMany({
    data: [
      { accountId: sharedAccount.id, balanceDate: new Date("2026-05-18"), balanceAmount: 4125.4 },
      { accountId: hendrikAccount.id, balanceDate: new Date("2026-05-18"), balanceAmount: 1640.13 },
      { accountId: partnerAccount.id, balanceDate: new Date("2026-05-18"), balanceAmount: 980.55 },
      { accountId: csvFallbackAccount.id, balanceDate: new Date("2026-05-18"), balanceAmount: 0 },
    ],
  });

  const demoTransactions: Array<{
    importHash: string;
    accountId: string;
    bookingDate: Date;
    amount: number;
    direction: "INCOME" | "EXPENSE";
    counterpartyName: string;
    purposeRaw: string;
    categoryId: string | null | undefined;
    responsibilityType: "SHARED" | "USER";
    responsibilityUserId?: string;
    isInternalTransfer?: boolean;
  }> = [
    {
      importHash: "demo-salary-hendrik-2026-05",
      accountId: sharedAccount.id,
      bookingDate: new Date("2026-05-02"),
      amount: 3200,
      direction: "INCOME",
      counterpartyName: "Arbeitgeber GmbH",
      purposeRaw: "Salary May 2026",
      categoryId: categories.get("salary"),
      responsibilityType: "USER",
      responsibilityUserId: hendrik.id,
    },
    {
      importHash: "demo-rent-2026-05",
      accountId: sharedAccount.id,
      bookingDate: new Date("2026-05-03"),
      amount: -1240,
      direction: "EXPENSE",
      counterpartyName: "Hausverwaltung Katz",
      purposeRaw: "Miete Mai",
      categoryId: categories.get("rent"),
      responsibilityType: "SHARED",
    },
    {
      importHash: "demo-rewe-2026-05-05",
      accountId: sharedAccount.id,
      bookingDate: new Date("2026-05-05"),
      amount: -84.21,
      direction: "EXPENSE",
      counterpartyName: "REWE BERLIN",
      purposeRaw: "Wocheneinkauf",
      categoryId: categories.get("groceries"),
      responsibilityType: "SHARED",
    },
    {
      importHash: "demo-parkster-2026-05-06",
      accountId: hendrikAccount.id,
      bookingDate: new Date("2026-05-06"),
      amount: -12.5,
      direction: "EXPENSE",
      counterpartyName: "Parkster",
      purposeRaw: "Parkticket Innenstadt",
      categoryId: categories.get("mobility"),
      responsibilityType: "USER",
      responsibilityUserId: hendrik.id,
    },
    {
      importHash: "demo-zalando-2026-05-07",
      accountId: partnerAccount.id,
      bookingDate: new Date("2026-05-07"),
      amount: -79.9,
      direction: "EXPENSE",
      counterpartyName: "Zalando",
      purposeRaw: "Sommerjacke",
      categoryId: categories.get("shopping"),
      responsibilityType: "USER",
      responsibilityUserId: partner.id,
    },
    {
      importHash: "demo-cafe-2026-05-08",
      accountId: sharedAccount.id,
      bookingDate: new Date("2026-05-08"),
      amount: -26.7,
      direction: "EXPENSE",
      counterpartyName: "Cafe Botanico",
      purposeRaw: "Frühstück Samstag",
      categoryId: categories.get("eating-out"),
      responsibilityType: "SHARED",
    },
    {
      importHash: "demo-energy-2026-05-10",
      accountId: sharedAccount.id,
      bookingDate: new Date("2026-05-10"),
      amount: -119,
      direction: "EXPENSE",
      counterpartyName: "Stadtwerke",
      purposeRaw: "Abschlag Strom",
      categoryId: categories.get("utilities"),
      responsibilityType: "SHARED",
    },
    {
      importHash: "demo-bookstore-2026-05-11",
      accountId: hendrikAccount.id,
      bookingDate: new Date("2026-05-11"),
      amount: -38.5,
      direction: "EXPENSE",
      counterpartyName: "Buchladen Mitte",
      purposeRaw: "Fachbuch TypeScript",
      categoryId: null,
      responsibilityType: "USER",
      responsibilityUserId: hendrik.id,
    },
    {
      importHash: "demo-health-2026-05-12",
      accountId: partnerAccount.id,
      bookingDate: new Date("2026-05-12"),
      amount: -22.4,
      direction: "EXPENSE",
      counterpartyName: "Apotheke am Markt",
      purposeRaw: "Apothekenkauf",
      categoryId: categories.get("health"),
      responsibilityType: "USER",
      responsibilityUserId: partner.id,
    },
    {
      importHash: "demo-transfer-2026-05-13",
      accountId: sharedAccount.id,
      bookingDate: new Date("2026-05-13"),
      amount: -300,
      direction: "EXPENSE",
      counterpartyName: "Hendrik Privat",
      purposeRaw: "Umbuchung Monatsbudget",
      categoryId: categories.get("transfer"),
      responsibilityType: "USER",
      responsibilityUserId: hendrik.id,
      isInternalTransfer: true,
    },
  ] as const;

  for (const transaction of demoTransactions) {
    await prisma.transaction.upsert({
      where: { importHash: transaction.importHash },
      update: {
        householdId: household.id,
        accountId: transaction.accountId,
        bookingDate: transaction.bookingDate,
        amount: transaction.amount,
        direction: transaction.direction,
        counterpartyName: transaction.counterpartyName,
        purposeRaw: transaction.purposeRaw,
        categoryId: transaction.categoryId ?? null,
        responsibilityType: transaction.responsibilityType,
        responsibilityUserId: transaction.responsibilityUserId ?? null,
        isInternalTransfer: transaction.isInternalTransfer ?? false,
      },
      create: {
        householdId: household.id,
        accountId: transaction.accountId,
        bookingDate: transaction.bookingDate,
        amount: transaction.amount,
        direction: transaction.direction,
        counterpartyName: transaction.counterpartyName,
        purposeRaw: transaction.purposeRaw,
        categoryId: transaction.categoryId ?? null,
        responsibilityType: transaction.responsibilityType,
        responsibilityUserId: transaction.responsibilityUserId ?? null,
        isInternalTransfer: transaction.isInternalTransfer ?? false,
        importHash: transaction.importHash,
      },
    });
  }

  await prisma.categorizationRule.upsert({
    where: { id: "demo-rule-groceries" },
    update: {
      householdId: household.id,
      name: "REWE => Groceries",
      matchField: "COUNTERPARTY_NAME",
      matchOperator: "CONTAINS",
      matchValue: "REWE",
      actionCategoryId: categories.get("groceries") ?? null,
      actionResponsibilityType: "SHARED",
      createdByUserId: hendrik.id,
    },
    create: {
      id: "demo-rule-groceries",
      householdId: household.id,
      name: "REWE => Groceries",
      matchField: "COUNTERPARTY_NAME",
      matchOperator: "CONTAINS",
      matchValue: "REWE",
      actionCategoryId: categories.get("groceries") ?? null,
      actionResponsibilityType: "SHARED",
      createdByUserId: hendrik.id,
    },
  });

  console.log(`Demo household ready. Login with hendrik@example.local / ${DEMO_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma?.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma?.$disconnect();
    process.exit(1);
  });
