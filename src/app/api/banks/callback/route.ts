// GET /api/banks/callback?ref=...  (GoCardless redirects here after SCA)
// Fetches the linked accounts, stores them, then runs an initial sync.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { gocardless } from '@/lib/gocardless';
import { syncConnection } from '@/lib/sync';

export async function GET(req: NextRequest) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);

  const ref = req.nextUrl.searchParams.get('ref');
  const { data: conn } = await db.from('bank_connections')
    .select('*').eq('user_id', user.id)
    .eq(ref ? 'reference' : 'user_id', ref ?? user.id)
    .order('created_at', { ascending: false }).limit(1).single();
  if (!conn) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=connection`);

  const requisition = await gocardless.getRequisition(conn.requisition_id);
  for (const gcAccountId of requisition.accounts ?? []) {
    const details = await gocardless.getAccountDetails(gcAccountId).catch(() => null);
    const acc = details?.account ?? {};
    await db.from('accounts').upsert({
      user_id: user.id, connection_id: conn.id, gc_account_id: gcAccountId,
      iban: acc.iban ?? null, name: acc.name ?? acc.product ?? 'Konto',
      account_type: 'giro',
    }, { onConflict: 'gc_account_id' });
  }
  await db.from('bank_connections').update({ status: 'linked' }).eq('id', conn.id);
  await syncConnection(db as any, user.id, conn.id);

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?connected=1`);
}
