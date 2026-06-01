// POST /api/sync  -> sync all of the current user's connections on demand.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncConnection } from '@/lib/sync';

export async function POST() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data: conns } = await db.from('bank_connections')
    .select('id').eq('user_id', user.id).eq('status', 'linked');
  const results = [];
  for (const c of conns ?? []) results.push(await syncConnection(db as any, user.id, c.id));
  return NextResponse.json({ results });
}
