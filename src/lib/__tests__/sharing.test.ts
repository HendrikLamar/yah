import { describe, it, expect } from 'vitest';
import { normalizeInviteEmail } from '../sharing';

describe('normalizeInviteEmail', () => {
  it('trims and lowercases a valid address', () => {
    expect(normalizeInviteEmail('  Foo.Bar@Example.COM ')).toBe('foo.bar@example.com');
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(normalizeInviteEmail('')).toBeNull();
    expect(normalizeInviteEmail('   ')).toBeNull();
  });

  it('returns null when there is no @', () => {
    expect(normalizeInviteEmail('not-an-email')).toBeNull();
  });

  it('returns null when local part or domain is missing', () => {
    expect(normalizeInviteEmail('@example.com')).toBeNull();
    expect(normalizeInviteEmail('foo@')).toBeNull();
    expect(normalizeInviteEmail('@')).toBeNull();
  });

  it('returns null when the domain has no dot', () => {
    expect(normalizeInviteEmail('foo@localhost')).toBeNull();
  });

  it('rejects internal whitespace', () => {
    expect(normalizeInviteEmail('foo bar@example.com')).toBeNull();
  });

  it('rejects addresses longer than 254 chars', () => {
    const long = `${'a'.repeat(250)}@ex.com`;
    expect(normalizeInviteEmail(long)).toBeNull();
  });

  it('accepts a normal address at the boundary length', () => {
    expect(normalizeInviteEmail('a@b.co')).toBe('a@b.co');
  });
});
