import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../password";

describe("password hashing", () => {
  it("creates a non-plain-text hash that can be verified", () => {
    const password = "super-secret-123";
    const hash = hashPassword(password);

    expect(hash).not.toContain(password);
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword(password, hash)).toBe(true);
  });

  it("uses a random salt for each password hash", () => {
    const password = "same-password";
    const firstHash = hashPassword(password);
    const secondHash = hashPassword(password);

    expect(firstHash).not.toBe(secondHash);
    expect(verifyPassword(password, secondHash)).toBe(true);
  });

  it("rejects incorrect passwords and malformed hashes", () => {
    const hash = hashPassword("correct horse battery staple");

    expect(verifyPassword("wrong password", hash)).toBe(false);
    expect(verifyPassword("anything", "not-a-valid-hash")).toBe(false);
  });

  it("enforces a minimum password length before hashing", () => {
    expect(() => hashPassword("short")).toThrow(/at least 8/i);
  });
});
