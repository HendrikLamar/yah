// User-facing account-label rules. `name` is bank-provided and immutable; the
// user may set an optional `display_name` shown instead. Kept pure (no React,
// no DB) so it is unit-testable and reusable by the rename server action.

const MAX_NAME = 60;

// Normalises a rename input: trims, caps at 60 chars, and maps an empty or
// whitespace-only value to null so the label falls back to the bank `name`.
export function normalizeAccountName(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_NAME);
}
