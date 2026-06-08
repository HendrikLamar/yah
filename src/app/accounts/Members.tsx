'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MemberInfo, MembershipRole, OutgoingInvitation } from '@/lib/types';
import { removeMember, leaveAccount, revokeInvitation } from './actions';

interface Props {
  accountId: string;
  viewerRole: MembershipRole;
  currentUserId: string;
  members: MemberInfo[];
  pending: OutgoingInvitation[];
}

export default function Members({ accountId, viewerRole, currentUserId, members, pending }: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState('');
  // Which destructive action is awaiting a confirming second click: 'remove:<userId>' or 'leave'.
  const [confirmKey, setConfirmKey] = useState('');
  const isOwner = viewerRole === 'owner';

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError('');
    setConfirmKey('');
    start(async () => {
      const res = await fn();
      if (!res.ok) { setError(res.error ?? 'Fehler'); return; }
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid #2d3742', paddingTop: 12 }}>
      <div style={{ fontSize: 13, color: '#8b98a5', marginBottom: 6 }}>Mitglieder</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {members.map((m) => {
          const removeKey = `remove:${m.user_id}`;
          return (
            <li key={m.user_id} style={memberRow}>
              <span>
                {m.email}
                {m.role === 'owner' && <span style={tag}>Eigentümer</span>}
                {m.user_id === currentUserId && <span style={{ color: '#8b98a5', fontSize: 12 }}> (du)</span>}
              </span>
              {isOwner && m.role !== 'owner' && (
                confirmKey === removeKey ? (
                  <span style={confirmWrap}>
                    <button onClick={() => run(() => removeMember(accountId, m.user_id))} disabled={busy} style={dangerBtn}>
                      Wirklich entziehen?
                    </button>
                    <button onClick={() => setConfirmKey('')} disabled={busy} style={cancelBtn}>
                      Abbrechen
                    </button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmKey(removeKey)} style={dangerBtn}>
                    Zugriff entziehen
                  </button>
                )
              )}
              {!isOwner && m.user_id === currentUserId && (
                confirmKey === 'leave' ? (
                  <span style={confirmWrap}>
                    <button onClick={() => run(() => leaveAccount(accountId))} disabled={busy} style={dangerBtn}>
                      Wirklich verlassen?
                    </button>
                    <button onClick={() => setConfirmKey('')} disabled={busy} style={cancelBtn}>
                      Abbrechen
                    </button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmKey('leave')} style={dangerBtn}>
                    Konto verlassen
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>

      {isOwner && pending.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: '#8b98a5', margin: '10px 0 6px' }}>Ausstehende Einladungen</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
            {pending.map((p) => (
              <li key={p.invitation_id} style={memberRow}>
                <span style={{ color: '#8b98a5' }}>{p.invitee_email} · ausstehend</span>
                <button onClick={() => run(() => revokeInvitation(p.invitation_id))} disabled={busy} style={linkBtn}>
                  zurückziehen
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

const memberRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14,
};
const tag: React.CSSProperties = {
  marginLeft: 8, fontSize: 11, padding: '1px 6px', borderRadius: 999, background: '#222b35', color: '#8b98a5',
};
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#ff8787', cursor: 'pointer', fontSize: 13, padding: 0,
};
const dangerBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #3a2630', color: '#ff8787', cursor: 'pointer',
  fontSize: 13, padding: '4px 10px', borderRadius: 7,
};
const cancelBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #2d3742', color: '#8b98a5', cursor: 'pointer',
  fontSize: 13, padding: '4px 10px', borderRadius: 7,
};
const confirmWrap: React.CSSProperties = {
  display: 'flex', gap: 6, alignItems: 'center',
};
