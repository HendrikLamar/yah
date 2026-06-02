// Protects app routes: refreshes the Supabase session cookie and redirects
// unauthenticated users away from /dashboard, /connect and /accounts.
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet: CookieToSet[]) => toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const protectedPath = /^\/(dashboard|connect|accounts)/.test(req.nextUrl.pathname);
  if (protectedPath && !user) return NextResponse.redirect(new URL('/login', req.url));
  return res;
}

export const config = { matcher: ['/dashboard/:path*', '/connect/:path*', '/accounts/:path*'] };
