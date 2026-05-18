import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string): string {
  assertPasswordStrength(password);

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");

  return `${HASH_PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [prefix, salt, expectedHash] = storedHash.split("$");

  if (!prefix || !salt || !expectedHash || prefix !== HASH_PREFIX) {
    return false;
  }

  const calculatedHash = scryptSync(password, salt, KEY_LENGTH).toString("hex");

  return timingSafeEqual(Buffer.from(calculatedHash, "hex"), Buffer.from(expectedHash, "hex"));
}

function assertPasswordStrength(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
}
