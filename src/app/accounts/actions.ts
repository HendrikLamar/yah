'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccountName } from '@/lib/accounts';

// Renames one account for the signed-in user. Auth is checked at the top and
// the update is account-scoped (id + user_id) as defense-in-depth on top of RLS.
export async function renameAccount(id: string, rawName: string): Promise<{ ok: boolean; error?: string }> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'not authenticated' };

  const display_name = normalizeAccountName(rawName ?? '');
  const { error } = await db
    .from('accounts')
    .update({ display_name })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/accounts');
  revalidatePath('/dashboard');
  return { ok: true };
}
