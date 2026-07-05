import { describe, it, expect } from 'vitest';
import { resolveSupabaseUrl } from '../resolve-url';

describe('resolveSupabaseUrl', () => {
  it('prefers the internal URL when set (server-side prod path)', () => {
    expect(resolveSupabaseUrl('http://kong:8000', 'https://api.yah.example.com'))
      .toBe('http://kong:8000');
  });
  it('falls back to the public URL when internal is unset (dev path)', () => {
    expect(resolveSupabaseUrl(undefined, 'http://localhost:54321'))
      .toBe('http://localhost:54321');
  });
  it('treats an empty internal URL as unset', () => {
    expect(resolveSupabaseUrl('', 'https://api.yah.example.com'))
      .toBe('https://api.yah.example.com');
  });
  it('throws when neither URL is configured', () => {
    expect(() => resolveSupabaseUrl(undefined, undefined))
      .toThrow(/SUPABASE_INTERNAL_URL|NEXT_PUBLIC_SUPABASE_URL/);
  });
  it('throws when both are empty strings', () => {
    expect(() => resolveSupabaseUrl('', '')).toThrow();
  });
});
