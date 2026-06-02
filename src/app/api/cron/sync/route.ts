// GET /api/cron/sync  -> scheduled by Vercel Cron (see vercel.json, every 6h
// = 4x/day, within GoCardless' ~4 calls/day/scope limit). Uses the service-role
// client and iterates every linked connection across all users.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { syncConnection } from '@/lib/sync';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const db = createAdminClient();
  const { data: conns } = await db.from('bank_connections')
    .select('id, user_id').eq('status', 'linked');
  let ok = 0, failed = 0;
  for (const c of conns ?? []) {
    const r = await syncConnection(db as any, c.user_id, c.id);
    r.ok ? ok++ : failed++;
  }
  return NextResponse.json({ synced: ok, failed });
}
