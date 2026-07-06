// GET /api/banks/institutions?country=DE  -> ASPSP list for the connect picker.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enablebanking } from '@/lib/enablebanking';

export async function GET(req: NextRequest) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const country = (req.nextUrl.searchParams.get('country') ?? 'DE').toUpperCase();
  if (!/^[A-Z]{2}$/.test(country))
    return NextResponse.json({ error: 'invalid country' }, { status: 400 });

  const aspsps = await enablebanking.listAspsps(country);
  return NextResponse.json({
    banks: aspsps.map((a) => ({ name: a.name, country: a.country, logo: a.logo ?? null, beta: a.beta ?? false })),
  });
}
