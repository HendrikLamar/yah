import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMemberAccountIds } from '@/lib/memberAccounts';
import ImportForm from './ImportForm';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');

  const ids = await getMemberAccountIds(db, user.id);
  const { data: accounts } = ids.length
    ? await db.from('accounts')
        .select('id, name, iban, account_type, is_joint')
        .in('id', ids)
        .order('created_at', { ascending: true })
    : { data: [] };

  return <ImportForm accounts={accounts ?? []} />;
}
