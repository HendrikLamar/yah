'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { IncomingInvitation } from '@/lib/types';
import { respondToInvitation } from './actions';

export default function Invitations({ invitations }: { invitations: IncomingInvitation[] }) {
  if (!invitations.length) return null;
  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 16, color: '#b197fc' }}>Einladungen</h2>
      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        {invitations.map((inv) => <InvitationRow key={inv.invitation_id} inv={inv} />)}
      </div>
    </section>
  );
}

function InvitationRow({ inv }: { inv: IncomingInvitation }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  function respond(accept: boolean) {
    setError('');
    start(async () => {
      const res = await respondToInvitation(inv.invitation_id, accept);
      if (!res.ok) { setError(res.error ?? 'Fehler'); return; }
      router.refresh();
    });
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 14 }}>
        <strong>{inv.inviter_email}</strong> möchte das Konto{' '}
        <strong>{inv.account_label}</strong> mit dir teilen.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => respond(true)} disabled={pending} style={accept}>
          {pending ? '…' : 'Annehmen'}
        </button>
        <button onClick={() => respond(false)} disabled={pending} style={decline}>
          Ablehnen
        </button>
        {error && <span style={{ color: '#ff6b6b', fontSize: 13, alignSelf: 'center' }}>{error}</span>}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'rgba(177,151,252,.08)', border: '1px solid rgba(177,151,252,.3)',
  borderRadius: 10, padding: 14,
};
const accept: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 8, border: 'none', background: '#b197fc', color: '#0f1419',
  fontWeight: 600, cursor: 'pointer',
};
const decline: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 8, border: '1px solid #2d3742', background: '#222b35', color: '#e6edf3',
  cursor: 'pointer',
};
