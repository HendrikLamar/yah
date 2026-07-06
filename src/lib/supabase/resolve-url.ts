// Server-side Supabase base URL. In production the app talks to Kong over the
// internal compose network (SUPABASE_INTERNAL_URL=http://kong:8000) instead of
// hairpinning through the public edge; dev has no internal URL and falls back
// to the public one. Default params keep the literal process.env.* expressions
// so Next.js build-time inlining of NEXT_PUBLIC_* still applies.

// @supabase/ssr derives its session cookie name from the Supabase URL's first
// hostname label. Browser and server resolve DIFFERENT URLs in production
// (api.yah.… vs kong:8000), so the derived names diverge and the server never
// sees the session. Every cookie-using client must pass this fixed name.
export const AUTH_COOKIE_NAME = 'sb-yah-auth-token';

export function resolveSupabaseUrl(
  internalUrl: string | undefined = process.env.SUPABASE_INTERNAL_URL,
  publicUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL
): string {
  const url = internalUrl || publicUrl;
  if (!url) {
    throw new Error(
      'Supabase URL not configured: set SUPABASE_INTERNAL_URL or NEXT_PUBLIC_SUPABASE_URL'
    );
  }
  return url;
}
