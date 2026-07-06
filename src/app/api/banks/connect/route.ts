// POST /api/banks/connect  { name, country }
// Starts an Enable Banking authorization and returns the bank's consent `url`.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enablebanking } from '@/lib/enablebanking';

const MAX_CONSENT_SECONDS = 180 * 24 * 3600; // PSD2 cap

export async function POST(req: NextRequest) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const country = typeof body.country === 'string' ? body.country.trim().toUpperCase() : '';
  if (!name || !/^[A-Z]{2}$/.test(country))
    return NextResponse.json({ error: 'invalid bank selection' }, { status: 400 });

  // Server-side ASPSP lookup: validates the bank exists and gives us its
  // consent validity without trusting client-supplied numbers.
  const aspsps = await enablebanking.listAspsps(country);
  const aspsp = aspsps.find((a) => a.name === name);
  if (!aspsp) return NextResponse.json({ error: 'unknown bank' }, { status: 400 });

  const validSeconds = Math.min(aspsp.maximum_consent_validity ?? MAX_CONSENT_SECONDS, MAX_CONSENT_SECONDS);
  const validUntil = new Date(Date.now() + validSeconds * 1000);
  const reference = `${user.id}:${crypto.randomUUID()}`;

  const { url } = await enablebanking.startAuth({
    aspsp: aspsp.name, country,
    redirect: `${process.env.NEXT_PUBLIC_APP_URL}/api/banks/callback`,
    state: reference,
    validUntil: validUntil.toISOString(),
  });

  // provider_session_id stays null until the callback creates the session.
  await db.from('bank_connections').insert({
    user_id: user.id, institution_id: aspsp.name, institution_name: aspsp.name,
    reference, status: 'created', consent_expires_at: validUntil.toISOString(),
  });

  return NextResponse.json({ url });
}
