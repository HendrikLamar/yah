export const DKB_DEFAULT_BANK_IDENTIFIER = "12030000";
export const DKB_DEFAULT_SERVER = "https://banking-dkb.s-fints-pt-dkb.de/fints30";
const REQUIRED_KEYS = [
  "DKB_FINTS_USER_ID",
  "DKB_FINTS_PIN",
  "DKB_FINTS_PRODUCT_ID",
] as const;

export type DkbEnvKey = (typeof REQUIRED_KEYS)[number];

export type DkbConfig = {
  bankIdentifier: string;
  server: string;
  userId: string;
  customerId: string;
  pin: string;
  productId: string;
  productVersion: string;
  days: number;
};

export type DkbParseResult =
  | { ok: true; config: DkbConfig }
  | { ok: false; missingKeys: DkbEnvKey[] };

export type DkbConnectionStatus = {
  state: "missing" | "partial" | "ready";
  summary: string;
  missingKeys: DkbEnvKey[];
};

export function parseDkbConfig(env: Record<string, string | undefined>): DkbParseResult {
  const missingKeys = REQUIRED_KEYS.filter((key) => !env[key]?.trim());

  if (missingKeys.length > 0) {
    return { ok: false, missingKeys };
  }

  const userId = env.DKB_FINTS_USER_ID!.trim();

  return {
    ok: true,
    config: {
      bankIdentifier: env.DKB_FINTS_BANK_IDENTIFIER?.trim() || DKB_DEFAULT_BANK_IDENTIFIER,
      server: env.DKB_FINTS_SERVER?.trim() || DKB_DEFAULT_SERVER,
      userId,
      customerId: env.DKB_FINTS_CUSTOMER_ID?.trim() || userId,
      pin: env.DKB_FINTS_PIN!.trim(),
      productId: env.DKB_FINTS_PRODUCT_ID!.trim(),
      productVersion: env.DKB_FINTS_PRODUCT_VERSION?.trim() || "0.1.0",
      days: Number(env.DKB_FINTS_DAYS?.trim() || "30"),
    },
  };
}

export function getDkbConnectionStatus(
  env: Record<string, string | undefined>,
): DkbConnectionStatus {
  const result = parseDkbConfig(env);

  if ("config" in result) {
    return {
      state: "ready",
      summary: "Ready for live DKB FinTS test.",
      missingKeys: [],
    };
  }

  return {
    state: result.missingKeys.length === REQUIRED_KEYS.length ? "missing" : "partial",
    summary: `Missing ${result.missingKeys.join(", ")} before the live DKB FinTS test can run.`,
    missingKeys: result.missingKeys,
  };
}
