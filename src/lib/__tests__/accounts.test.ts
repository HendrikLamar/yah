import { describe, it, expect } from 'vitest';
import { normalizeAccountName } from '../accounts';

describe('normalizeAccountName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeAccountName('  Mein Konto  ')).toBe('Mein Konto');
  });
  it('returns null for empty or whitespace-only input', () => {
    expect(normalizeAccountName('')).toBeNull();
    expect(normalizeAccountName('   ')).toBeNull();
    expect(normalizeAccountName('\t\n')).toBeNull();
  });
  it('caps the length at 60 characters (after trimming)', () => {
    const long = 'x'.repeat(80);
    expect(normalizeAccountName(`  ${long}  `)).toBe('x'.repeat(60));
  });
  it('passes through a normal name unchanged', () => {
    expect(normalizeAccountName('Girokonto')).toBe('Girokonto');
  });
});
