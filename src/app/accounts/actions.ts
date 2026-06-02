'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeInviteEmail } from '@/lib/sharing';

export interface ActionResult { ok: boolean; error?: string }

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
