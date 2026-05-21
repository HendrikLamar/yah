import { describe, expect, it } from "vitest";

import { hashPassword } from "../../src/lib/auth/password";

describe("seed hashPassword import", () => {
  it("produces a scrypt-prefixed hash (format contract)", () => {
    const hash = hashPassword("demo12345");
    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  it("produces distinct hashes for the same password (unique salts)", () => {
    expect(hashPassword("demo12345")).not.toBe(hashPassword("demo12345"));
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(() => hashPassword("short")).toThrow("at least 8 characters");
  });
});
