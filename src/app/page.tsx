import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  redirect(user ? '/dashboard' : '/login');
}
