import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildDashboardData } from '@/lib/buildDashboardData';
import { getMemberAccountIds } from '@/lib/memberAccounts';
import DashboardView from '@/components/DashboardView';
import AppHeader from '@/components/AppHeader';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');

  const ids = await getMemberAccountIds(db, user.id);

  let accounts: any[] = [];
  let txns: any[] = [];
  if (ids.length) {
    const [acctRes, txRes, memberRes] = await Promise.all([
      db.from('accounts').select('*').in('id', ids),
      db.from('transactions').select('*').in('account_id', ids)
        .order('booking_date', { ascending: false }).limit(5000),
      db.from('account_members').select('account_id').in('account_id', ids),
    ]);
    const counts = new Map<string, number>();
    for (const m of memberRes.data ?? []) counts.set(m.account_id, (counts.get(m.account_id) ?? 0) + 1);
    accounts = (acctRes.data ?? []).map((a) => ({ ...a, member_count: counts.get(a.id) ?? 1 }));
    txns = txRes.data ?? [];
  }

  const data = buildDashboardData(accounts as any, txns as any);

  if (!data) {
    return (
      <>
        <AppHeader email={user.email!} />
        <main style={{ maxWidth: 640, margin: '12vh auto', fontFamily: 'system-ui', textAlign: 'center' }}>
        <h1>💶 Willkommen</h1>
        <p style={{ color: '#8b98a5' }}>Noch keine Konten verbunden.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
          <a href="/connect" style={{ display: 'inline-block', padding: '10px 18px',
            background: '#4dabf7', color: '#0f1419', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
            Bankkonto verbinden
          </a>
          <a href="/import" style={{ display: 'inline-block', padding: '10px 18px',
            background: '#222b35', color: '#e6edf3', border: '1px solid #2d3742', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
            CSV importieren
          </a>
        </div>
        </main>
      </>
    );
  }
  return (
    <>
      <AppHeader email={user.email!} />
      <DashboardView data={data} />
    </>
  );
}
