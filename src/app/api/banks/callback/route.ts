// GET /api/banks/callback?code=...&state=...  (Enable Banking redirects here
// after SCA). Exchanges the code for a session, stores the accounts, then
// runs an initial sync.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enablebanking } from '@/lib/enablebanking';
import { syncConnection } from '@/lib/sync';

export async function GET(req: NextRequest) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  if (!code || !state)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=connection`);

  // Scope by user_id AND reference — never trust state alone.
  const { data: conn } = await db.from('bank_connections')
    .select('*').eq('user_id', user.id).eq('reference', state).single();
  if (!conn) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=connection`);

  const session = await enablebanking.createSession(code);
  for (const acc of session.accounts) {
    await db.from('accounts').upsert({
      user_id: user.id, connection_id: conn.id, external_account_id: acc.uid,
      iban: acc.iban, name: acc.name, account_type: 'giro',
    }, { onConflict: 'external_account_id' });
  }
  await db.from('bank_connections')
    .update({ provider_session_id: session.session_id, status: 'linked' })
    .eq('id', conn.id).eq('user_id', user.id);
  await syncConnection(db as any, user.id, conn.id);

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?connected=1`);
}
