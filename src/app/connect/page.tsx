import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ConnectPicker from './ConnectPicker';

export const dynamic = 'force-dynamic';

export default async function ConnectPage() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');

  return <ConnectPicker />;
}
