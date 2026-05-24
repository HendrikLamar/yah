import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { getViewerHouseholdContext } from "@/lib/household/viewer";
import { parseTransactionCsv } from "@/lib/import/csv";

import { uploadCsvAction } from "../actions";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    account: {
      findFirst: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
    bankConnection: {
      upsert: vi.fn(),
    },
    transaction: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    importBatch: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/household/viewer", () => ({
  getViewerHouseholdContext: vi.fn(),
  buildAccountVisibilityFilter: () => ({}),
  buildTransactionAccountVisibilityFilter: () => ({}),
}));

vi.mock("@/lib/import/csv", () => ({
  parseTransactionCsv: vi.fn(() => []),
}));

vi.mock("@/lib/import/transaction-import", () => ({
  importCsvTransactions: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

function makeFormData(file: File, fields: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("csvFile", file);
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

describe("uploadCsvAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getViewerHouseholdContext).mockResolvedValue({
      householdId: "household-1",
      householdName: "Test",
      viewer: {
        userId: "user-1",
        email: "u@example.local",
        displayName: "User",
        householdId: "household-1",
        householdName: "Test",
      },
    });
  });

  it("redirects with a German error message when the parser reports missing columns", async () => {
    vi.mocked(parseTransactionCsv).mockImplementationOnce(() => {
      throw new Error("CSV file is missing required columns for booking date and amount.");
    });

    const file = new File(["junk"], "bad.csv", { type: "text/csv" });
    const formData = makeFormData(file, {
      accountMode: "new",
      accountName: "Test Account",
    });

    await expect(uploadCsvAction(formData)).rejects.toThrow(
      /REDIRECT:\/transactions\?error=CSV-Datei%20enth%C3%A4lt%20keine%20Spalten/,
    );
  });

  it("redirects with a date-format message when the parser reports an unsupported date", async () => {
    vi.mocked(parseTransactionCsv).mockImplementationOnce(() => {
      throw new Error("Unsupported date format: 99/99/9999");
    });

    const file = new File(["junk"], "bad.csv", { type: "text/csv" });
    const formData = makeFormData(file, {
      accountMode: "new",
      accountName: "Test Account",
    });

    await expect(uploadCsvAction(formData)).rejects.toThrow(
      /REDIRECT:\/transactions\?error=Datumsformat%20in%20der%20CSV/,
    );
  });

  it("redirects with the generic fallback for unknown parser failures", async () => {
    vi.mocked(parseTransactionCsv).mockImplementationOnce(() => {
      throw new Error("DB exploded mid-import");
    });

    const file = new File(["junk"], "bad.csv", { type: "text/csv" });
    const formData = makeFormData(file, {
      accountMode: "new",
      accountName: "Test Account",
    });

    await expect(uploadCsvAction(formData)).rejects.toThrow(
      /REDIRECT:\/transactions\?error=CSV-Import%20fehlgeschlagen/,
    );
  });

  it("redirects when the file is empty", async () => {
    const file = new File([""], "empty.csv", { type: "text/csv" });
    const formData = makeFormData(file, {
      accountMode: "new",
      accountName: "Test Account",
    });

    await expect(uploadCsvAction(formData)).rejects.toThrow(
      /REDIRECT:\/transactions\?error=Bitte%20eine%20CSV-Datei%20ausw%C3%A4hlen/,
    );
  });

  it("rejects existing-mode submissions without an accountId", async () => {
    const file = new File(["dummy"], "x.csv", { type: "text/csv" });
    const formData = makeFormData(file, { accountMode: "existing" });

    await expect(uploadCsvAction(formData)).rejects.toThrow(
      /REDIRECT:\/transactions\?error=Bitte%20ein%20bestehendes%20Konto/,
    );
  });

  it("rejects existing-mode submissions when an unknown account id is supplied", async () => {
    vi.mocked(prisma.account.findFirst).mockResolvedValue(null as never);

    const file = new File(["dummy"], "x.csv", { type: "text/csv" });
    const formData = makeFormData(file, {
      accountMode: "existing",
      accountId: "does-not-exist",
    });

    await expect(uploadCsvAction(formData)).rejects.toThrow(
      /REDIRECT:\/transactions\?error=Das%20gew%C3%A4hlte%20Konto/,
    );
  });
});
