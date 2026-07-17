'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeInviteEmail } from '@/lib/sharing';

export interface ActionResult { ok: boolean; error?: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidate() {
  revalidatePath('/accounts');
  revalidatePath('/dashboard');
}

// Renames the shared account label. Any member may rename; the rename_account
// RPC (SECURITY DEFINER) enforces membership and only touches display_name.
export async function renameAccount(id: string, rawName: string): Promise<ActionResult> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'not authenticated' };

  const { error } = await db.rpc('rename_account', { p_account_id: id, p_display_name: rawName ?? '' });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// Invites a user by email. Opaque by design: a well-formed email always yields
// a neutral success — the caller never learns whether the address is
// registered, already a member, or already invited (the RPC returns void
// regardless). Only a clearly-malformed address is rejected at the boundary.
export async function inviteToAccount(accountId: string, rawEmail: string): Promise<ActionResult> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'not authenticated' };

  const email = normalizeInviteEmail(rawEmail ?? '');
  if (!email) return { ok: false, error: 'Bitte eine gültige E-Mail-Adresse eingeben.' };

  const { error } = await db.rpc('invite_to_account', { p_account_id: accountId, p_email: email });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// Invitee accepts (true) or declines (false) their own pending invitation.
export async function respondToInvitation(invitationId: string, accept: boolean): Promise<ActionResult> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'not authenticated' };

  const { error } = await db.rpc('respond_to_invitation', { p_invitation_id: invitationId, p_accept: accept });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// Owner revokes a pending invitation they sent.
export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'not authenticated' };

  const { error } = await db.rpc('revoke_invitation', { p_invitation_id: invitationId });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// Owner removes a (non-owner) member from an account.
export async function removeMember(accountId: string, userId: string): Promise<ActionResult> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'not authenticated' };

  const { error } = await db.rpc('remove_member', { p_account_id: accountId, p_user_id: userId });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// A non-owner member leaves an account.
export async function leaveAccount(accountId: string): Promise<ActionResult> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'not authenticated' };

  const { error } = await db.rpc('leave_account', { p_account_id: accountId });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// Owner hard-deletes an account; transactions/members/invitations cascade in
// the DB. If it was the last account on its bank connection, the now-empty
// connection row is removed too (the consent is useless without accounts).
export async function deleteAccount(accountId: string): Promise<ActionResult> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'not authenticated' };
  if (!UUID_RE.test(accountId ?? '')) return { ok: false, error: 'invalid account id' };

  // Defense-in-depth: verify owner membership before the RLS-enforced delete.
  const { data: membership } = await db.from('account_members')
    .select('role').eq('account_id', accountId).eq('user_id', user.id).maybeSingle();
  if (membership?.role !== 'owner') return { ok: false, error: 'not the owner of this account' };

  const { data: account } = await db.from('accounts')
    .select('connection_id').eq('id', accountId).maybeSingle();
  if (!account) return { ok: false, error: 'account not found' };

  const { error } = await db.from('accounts').delete().eq('id', accountId);
  if (error) return { ok: false, error: error.message };

  if (account.connection_id) {
    const { data: remaining } = await db.from('accounts')
      .select('id').eq('connection_id', account.connection_id).eq('user_id', user.id).limit(1);
    if (!remaining?.length) {
      await db.from('bank_connections').delete()
        .eq('id', account.connection_id).eq('user_id', user.id);
    }
  }
  revalidate();
  return { ok: true };
}

// Deletes a bank connection and everything it exposed. The accounts FK is
// ON DELETE SET NULL, so child accounts are deleted explicitly first —
// otherwise they'd linger as orphans instead of cascading their transactions.
export async function deleteConnection(connectionId: string): Promise<ActionResult> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'not authenticated' };
  if (!UUID_RE.test(connectionId ?? '')) return { ok: false, error: 'invalid connection id' };

  const { data: conn } = await db.from('bank_connections')
    .select('id').eq('id', connectionId).eq('user_id', user.id).maybeSingle();
  if (!conn) return { ok: false, error: 'connection not found' };

  const { error: accErr } = await db.from('accounts').delete()
    .eq('connection_id', connectionId).eq('user_id', user.id);
  if (accErr) return { ok: false, error: accErr.message };

  const { error } = await db.from('bank_connections').delete()
    .eq('id', connectionId).eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// Toggles the caller's own dashboard-hide flag for an account. Per-member by
// design; the set_account_hidden RPC (SECURITY DEFINER) only touches the
// caller's membership row — account_members has no client UPDATE policy.
export async function setAccountHidden(accountId: string, hidden: boolean): Promise<ActionResult> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'not authenticated' };
  if (!UUID_RE.test(accountId ?? '')) return { ok: false, error: 'invalid account id' };
  if (typeof hidden !== 'boolean') return { ok: false, error: 'invalid hidden flag' };

  const { error } = await db.rpc('set_account_hidden', { p_account_id: accountId, p_hidden: hidden });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
