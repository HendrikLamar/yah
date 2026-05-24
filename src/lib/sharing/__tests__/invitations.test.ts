import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    invitation: { findUnique: vi.fn(), update: vi.fn() },
    householdMember: { upsert: vi.fn() },
    account: { findFirst: vi.fn() },
    accountShare: { upsert: vi.fn() },
  },
}));

import { hashInvitationToken, statusFor } from "../invitations";

describe("hashInvitationToken", () => {
  it("is deterministic", () => {
    expect(hashInvitationToken("abc")).toBe(hashInvitationToken("abc"));
  });

  it("differs by input", () => {
    expect(hashInvitationToken("abc")).not.toBe(hashInvitationToken("abcd"));
  });
});

describe("statusFor", () => {
  const now = new Date("2026-05-23T12:00:00Z");

  it("returns 'revoked' when revokedAt is set", () => {
    expect(
      statusFor(
        {
          revokedAt: new Date("2026-05-20"),
          acceptedAt: null,
          expiresAt: new Date("2026-06-01"),
        },
        now,
      ),
    ).toBe("revoked");
  });

  it("returns 'accepted' when acceptedAt is set (and not revoked)", () => {
    expect(
      statusFor(
        {
          revokedAt: null,
          acceptedAt: new Date("2026-05-21"),
          expiresAt: new Date("2026-06-01"),
        },
        now,
      ),
    ).toBe("accepted");
  });

  it("returns 'expired' when expiresAt is in the past", () => {
    expect(
      statusFor(
        {
          revokedAt: null,
          acceptedAt: null,
          expiresAt: new Date("2026-05-01"),
        },
        now,
      ),
    ).toBe("expired");
  });

  it("returns 'active' otherwise", () => {
    expect(
      statusFor(
        {
          revokedAt: null,
          acceptedAt: null,
          expiresAt: new Date("2026-06-01"),
        },
        now,
      ),
    ).toBe("active");
  });
});
