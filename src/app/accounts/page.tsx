import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMemberAccountIds } from '@/lib/memberAccounts';
import type {
  Account, IncomingInvitation, MemberInfo, MembershipRole, OutgoingInvitation, SharedAccountCard,
} from '@/lib/types';
import AppHeader from '@/components/AppHeader';
import AccountsList from './AccountsList';
import Invitations from './Invitations';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');

  const ids = await getMemberAccountIds(db, user.id);

  const { data: myMemberships } = await db
    .from('account_members').select('account_id, role').eq('user_id', user.id);
  const roleByAccount = new Map<string, MembershipRole>(
    (myMemberships ?? []).map((m) => [m.account_id as string, m.role as MembershipRole]),
  );

  const { data: accounts } = ids.length
    ? await db
        .from('accounts')
        .select('id, iban, name, account_type, is_joint, balance_cents, owner_label, display_name')
        .in('id', ids)
        .order('created_at', { ascending: true })
    : { data: [] as Account[] };

  const cards: SharedAccountCard[] = await Promise.all(
    (accounts ?? []).map(async (a): Promise<SharedAccountCard> => {
      const viewerRole = roleByAccount.get(a.id) ?? 'member';
      const { data: members } = await db.rpc('list_account_members', { p_account_id: a.id });
      let pending: OutgoingInvitation[] = [];
      if (viewerRole === 'owner') {
        const { data: inv } = await db.rpc('list_account_invitations', { p_account_id: a.id });
        pending = (inv ?? []) as OutgoingInvitation[];
      }
      const memberList = (members ?? []) as MemberInfo[];
      return {
        account: { ...(a as Account), member_count: memberList.length || 1 },
        viewerRole,
        members: memberList,
        pending,
      };
    }),
  );

  const { data: incomingRows } = await db.rpc('my_invitations');
  const incoming = (incomingRows ?? []) as IncomingInvitation[];

  return (
    <>
      <AppHeader email={user.email!} />
      <main style={{ maxWidth: 820, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: 22 }}>Konten verwalten</h1>
        <p style={{ color: '#8b98a5' }}>
          Vergib einen eigenen Namen pro Konto, lade weitere Personen ein und verwalte geteilte Konten.
        </p>
        <Invitations invitations={incoming} />
        <AccountsList cards={cards} currentUserId={user.id} />
      </main>
    </>
  );
}
