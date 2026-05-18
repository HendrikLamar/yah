import { prisma } from "@/lib/db/prisma";

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

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "hendrik@example.local" },
    update: {},
    create: {
      email: "hendrik@example.local",
      displayName: "Hendrik",
      passwordHash: "changeme",
      role: "ADMIN",
    },
  });

  const household = await prisma.household.upsert({
    where: { id: "yah-demo-household" },
    update: { name: "yah demo household" },
    create: {
      id: "yah-demo-household",
      name: "yah demo household",
    },
  });

  await prisma.householdMember.upsert({
    where: {
      householdId_userId: {
        householdId: household.id,
        userId: admin.id,
      },
    },
    update: { membershipRole: "ADMIN" },
    create: {
      householdId: household.id,
      userId: admin.id,
      membershipRole: "ADMIN",
    },
  });

  for (const [slug, name, kind] of SYSTEM_CATEGORIES) {
    await prisma.category.upsert({
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
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
