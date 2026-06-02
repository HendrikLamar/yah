'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Account } from '@/lib/types';
import { renameAccount } from './actions';

const TYPE_LABEL: Record<Account['account_type'], string> = {
  giro: 'Girokonto', savings: 'Tagesgeld / Sparen', joint: 'Gemeinschaftskonto',
};
const eur = (cents: number | null) =>
  ((cents ?? 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

function AccountRow({ account }: { account: Account }) {
  const router = useRouter();
  const [name, setName] = useState(account.display_name ?? '');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    start(async () => {
      await renameAccount(account.id, name);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div style={row}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong>{account.name}</strong>
        <span style={account.is_joint ? badgeShared : badgePrivate}>
          {account.is_joint ? '👥 geteilt' : '🔒 privat'}
        </span>
        <span style={{ color: '#8b98a5', fontSize: 13 }}>{TYPE_LABEL[account.account_type]}</span>
        <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{eur(account.balance_cents)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <input
          aria-label={`Anzeigename für ${account.name}`}
          placeholder={account.name}
          value={name}
          maxLength={60}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          style={input}
        />
        <button onClick={save} disabled={pending} style={btn}>
          {pending ? '…' : 'Speichern'}
        </button>
        {saved && !pending && <span style={{ color: '#51cf66', fontSize: 13 }}>gespeichert</span>}
      </div>
    </div>
  );
}

export default function AccountsList({ accounts }: { accounts: Account[] }) {
  if (!accounts.length) {
    return (
      <div style={{ ...row, color: '#8b98a5' }}>
        Noch keine Konten. Verbinde eine Bank oder importiere eine CSV-Datei, dann erscheinen sie hier.
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
      {accounts.map((a) => <AccountRow key={a.id} account={a} />)}
    </div>
  );
}

const row: React.CSSProperties = {
  background: '#161b22', border: '1px solid #2d3742', borderRadius: 10, padding: 16,
};
const input: React.CSSProperties = {
  flex: 1, padding: 8, borderRadius: 8, border: '1px solid #2d3742', background: '#0f1419', color: '#e6edf3',
};
const btn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, border: 'none', background: '#4dabf7', color: '#0f1419',
  fontWeight: 600, cursor: 'pointer',
};
const badgePrivate: React.CSSProperties = {
  fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#222b35', color: '#8b98a5',
};
const badgeShared: React.CSSProperties = {
  fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(177,151,252,.18)', color: '#b197fc',
};
