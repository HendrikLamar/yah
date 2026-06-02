// Server-side Supabase client. Reads the auth cookie so RLS applies
// for the logged-in user. Use in Server Components / Route Handlers.
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: CookieToSet[]) => {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* called from a Server Component – safe to ignore */ }
        },
      },
    }
  );
}

// Service-role client for trusted server jobs (cron sync). Bypasses RLS,
// so ALWAYS scope queries by user_id yourself. Never import in client code.
import { createClient as createSb } from '@supabase/supabase-js';
export function createAdminClient() {
  return createSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
