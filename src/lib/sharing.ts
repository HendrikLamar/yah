// Pure helpers for account sharing. No React/DB so they stay unit-testable and
// reusable by server actions.

const MAX_EMAIL = 254; // RFC 5321 address length limit.

// Normalises an invite email: trims, lowercases, length-caps, and does a basic
// shape check (single local@domain with a dotted domain, no internal
// whitespace). Returns null for anything that can't be a sendable address so
// the caller can reject at the boundary before hitting the opaque RPC.
export function normalizeInviteEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL) return null;
  if (/\s/.test(email)) return null;
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return null;
  const domain = email.slice(at + 1);
  if (!domain || !domain.includes('.')) return null;
  return email;
}
