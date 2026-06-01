import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ImportForm from './ImportForm';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');

  const { data: accounts } = await db.from('accounts')
    .select('id, name, iban, account_type, is_joint').order('created_at', { ascending: true });

  return <ImportForm accounts={accounts ?? []} />;
}
