'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { inviteToAccount } from './actions';

// Always shows a neutral confirmation on a well-formed email — never reveals
// whether the address is registered (preserves the opaque-invite guarantee).
export default function InviteForm({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSent(false);
    start(async () => {
      const res = await inviteToAccount(accountId, email);
      if (!res.ok) { setError(res.error ?? 'Fehler'); return; }
      setEmail('');
      setSent(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 12, borderTop: '1px solid #2d3742', paddingTop: 12 }}>
      <div style={{ fontSize: 13, color: '#8b98a5', marginBottom: 6 }}>Person einladen</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="email"
          aria-label="E-Mail-Adresse einladen"
          placeholder="email@beispiel.de"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setSent(false); setError(''); }}
          style={input}
        />
        <button type="submit" disabled={pending || !email} style={btn}>
          {pending ? '…' : 'Einladen'}
        </button>
      </div>
      {sent && <div style={{ color: '#51cf66', fontSize: 13, marginTop: 8 }}>Einladung gesendet.</div>}
      {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginTop: 8 }}>{error}</div>}
    </form>
  );
}

const input: React.CSSProperties = {
  flex: 1, padding: 8, borderRadius: 8, border: '1px solid #2d3742', background: '#0f1419', color: '#e6edf3',
};
const btn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, border: 'none', background: '#4dabf7', color: '#0f1419',
  fontWeight: 600, cursor: 'pointer',
};
