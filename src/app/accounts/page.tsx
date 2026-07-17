import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMemberAccountIds } from '@/lib/memberAccounts';
import type {
  Account, BankConnectionInfo, IncomingInvitation, MemberInfo, MembershipRole,
  OutgoingInvitation, SharedAccountCard,
} from '@/lib/types';
import AppHeader from '@/components/AppHeader';
import AccountsList from './AccountsList';
import Connections from './Connections';
import Invitations from './Invitations';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');

  const ids = await getMemberAccountIds(db, user.id);

  const { data: myMemberships } = await db
    .from('account_members').select('account_id, role, hidden').eq('user_id', user.id);
  const roleByAccount = new Map<string, MembershipRole>(
    (myMemberships ?? []).map((m) => [m.account_id as string, m.role as MembershipRole]),
  );
  const hiddenByAccount = new Map<string, boolean>(
    (myMemberships ?? []).map((m) => [m.account_id as string, !!m.hidden]),
  );

  const { data: accounts } = ids.length
    ? await db
        .from('accounts')
        .select('id, iban, name, account_type, is_joint, balance_cents, owner_label, display_name, connection_id')
        .in('id', ids)
        .order('created_at', { ascending: true })
    : { data: [] as (Account & { connection_id: string | null })[] };

  const cards: SharedAccountCard[] = await Promise.all(
    (accounts ?? []).map(async (a): Promise<SharedAccountCard> => {
      const viewerRole = roleByAccount.get(a.id) ?? 'member';
      const [{ data: members }, { count: txCount }] = await Promise.all([
        db.rpc('list_account_members', { p_account_id: a.id }),
        db.from('transactions').select('*', { count: 'exact', head: true }).eq('account_id', a.id),
      ]);
      let pending: OutgoingInvitation[] = [];
      if (viewerRole === 'owner') {
        const { data: inv } = await db.rpc('list_account_invitations', { p_account_id: a.id });
        pending = (inv ?? []) as OutgoingInvitation[];
      }
      const memberList = (members ?? []) as MemberInfo[];
      return {
        account: { ...(a as Account), member_count: memberList.length || 1 },
        viewerRole,
        viewerHidden: hiddenByAccount.get(a.id) ?? false,
        txCount: txCount ?? 0,
        members: memberList,
        pending,
      };
    }),
  );

  // The viewer's own bank connections (never shared), each with the child
  // accounts a delete would take with it.
  const { data: connRows } = await db
    .from('bank_connections')
    .select('id, institution_name, status, consent_expires_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  const connections: BankConnectionInfo[] = (connRows ?? []).map((c) => ({
    ...(c as Omit<BankConnectionInfo, 'accounts'>),
    accounts: (accounts ?? [])
      .filter((a) => (a as { connection_id?: string | null }).connection_id === c.id)
      .map((a) => ({ id: a.id, name: a.display_name ?? a.name })),
  }));

  const { data: incomingRows } = await db.rpc('my_invitations');
  const incoming = (incomingRows ?? []) as IncomingInvitation[];

  return (
    <>
      <AppHeader email={user.email!} />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
        <a href="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, color: '#4dabf7',
          fontSize: 14, textDecoration: 'none', marginBottom: 14,
        }}>
          ← Zurück zum Dashboard
        </a>
        <h1 style={{ fontSize: 22 }}>Konten verwalten</h1>
        <p style={{ color: '#8b98a5' }}>
          Vergib einen eigenen Namen pro Konto, lade weitere Personen ein und verwalte geteilte Konten.
        </p>
        <Invitations invitations={incoming} />
        <AccountsList cards={cards} currentUserId={user.id} />
        <Connections connections={connections} />
      </main>
    </>
  );
}
