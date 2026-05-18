import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearLoginRateLimit,
  registerFailedLoginAttempt,
  throwIfLoginRateLimited,
} from "../login-rate-limit";

describe("login rate limiting", () => {
  beforeEach(() => {
    clearLoginRateLimit();
    vi.useRealTimers();
  });

  it("blocks login after repeated failed attempts for the same email and ip", () => {
    for (let index = 0; index < 5; index += 1) {
      expect(() => throwIfLoginRateLimited("hendrik@example.local", "127.0.0.1")).not.toThrow();
      registerFailedLoginAttempt("hendrik@example.local", "127.0.0.1");
    }

    expect(() => throwIfLoginRateLimited("hendrik@example.local", "127.0.0.1")).toThrow(
      /too many login attempts/i,
    );
  });

  it("clears counters after a successful login", () => {
    registerFailedLoginAttempt("hendrik@example.local", "127.0.0.1");
    registerFailedLoginAttempt("hendrik@example.local", "127.0.0.1");

    clearLoginRateLimit("hendrik@example.local", "127.0.0.1");

    expect(() => throwIfLoginRateLimited("hendrik@example.local", "127.0.0.1")).not.toThrow();
  });
});