// POST /api/banks/connect  { institutionId, accountType?, isJoint? }
// Starts a GoCardless requisition and returns the hosted consent `link`.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { gocardless } from '@/lib/gocardless';

export async function POST(req: NextRequest) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { institutionId, institutionName } = await req.json();
  const reference = `${user.id}:${crypto.randomUUID()}`;
  const redirect = `${process.env.NEXT_PUBLIC_APP_URL}/api/banks/callback`;

  const requisition = await gocardless.createRequisition(institutionId, redirect, reference);

  await db.from('bank_connections').insert({
    user_id: user.id, institution_id: institutionId, institution_name: institutionName,
    requisition_id: requisition.id, reference, status: 'created',
    consent_expires_at: new Date(Date.now() + 90 * 864e5).toISOString(),
  });

  return NextResponse.json({ link: requisition.link });
}
