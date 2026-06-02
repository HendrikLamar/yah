import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Account } from '@/lib/types';
import AppHeader from '@/components/AppHeader';
import AccountsList from './AccountsList';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');

  const { data: accounts } = await db
    .from('accounts')
    .select('id, iban, name, account_type, is_joint, balance_cents, owner_label, display_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  return (
    <>
      <AppHeader email={user.email!} />
      <main style={{ maxWidth: 820, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: 22 }}>Konten verwalten</h1>
        <p style={{ color: '#8b98a5' }}>
          Vergib einen eigenen Namen pro Konto. Der Bankname bleibt erhalten und wird angezeigt, wenn kein eigener Name gesetzt ist.
        </p>
        <AccountsList accounts={(accounts ?? []) as Account[]} />
      </main>
    </>
  );
}
