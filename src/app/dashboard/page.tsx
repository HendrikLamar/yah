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
        <form action="/api/banks/connect" method="post">
          {/* In der echten App: Bank-Auswahl-Dialog -> POST mit institutionId */}
          <a href="/connect" style={{ display: 'inline-block', marginTop: 16, padding: '10px 18px',
            background: '#4dabf7', color: '#0f1419', borderRadius: 8, fontWeight: 600, textDecoration: 'none' }}>
            Bankkonto verbinden
          </a>
        </form>
      </main>
    );
  }
  return <DashboardView data={data} />;
}
