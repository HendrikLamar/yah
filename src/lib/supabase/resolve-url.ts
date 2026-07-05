// Server-side Supabase base URL. In production the app talks to Kong over the
// internal compose network (SUPABASE_INTERNAL_URL=http://kong:8000) instead of
// hairpinning through the public edge; dev has no internal URL and falls back
// to the public one. Default params keep the literal process.env.* expressions
// so Next.js build-time inlining of NEXT_PUBLIC_* still applies.
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
