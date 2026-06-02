import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildDashboardData } from '@/lib/buildDashboardData';
import DashboardView from '@/components/DashboardView';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');

  const { data: accounts } = await db.from('accounts').select('*');
  const { data: txns } = await db.from('transactions')
    .select('*').order('booking_date', { ascending: false }).limit(5000);

  const data = buildDashboardData((accounts ?? []) as any, (txns ?? []) as any);

  if (!data) {
    return (
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
    );
  }
  return <DashboardView data={data} />;
}
