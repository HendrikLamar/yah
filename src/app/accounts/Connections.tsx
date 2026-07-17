'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { BankConnectionInfo } from '@/lib/types';
import { deleteConnection } from './actions';
import ConfirmDialog from './ConfirmDialog';

const STATUS_LABEL: Record<string, string> = {
  created: 'angelegt', linked: 'verbunden', expired: 'abgelaufen', error: 'Fehler',
};
const dateDe = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('de-DE') : null;

export default function Connections({ connections }: { connections: BankConnectionInfo[] }) {
  const router = useRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, start] = useTransition();

  if (!connections.length) return null;
  const target = connections.find((c) => c.id === confirmId);

  function remove(id: string) {
    setError('');
    start(async () => {
      const res = await deleteConnection(id);
      if (!res.ok) setError(res.error ?? 'Löschen fehlgeschlagen.');
      setConfirmId(null);
      router.refresh();
    });
  }

  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 17 }}>Bankverbindungen</h2>
      <p style={{ color: '#8b98a5', fontSize: 14 }}>
        Eine Verbindung ist der Zugriff auf eine Bank. Beim Löschen werden auch alle Konten
        dieser Verbindung samt Buchungen entfernt.
      </p>
      {error && <p style={{ color: '#e5534b', fontSize: 14 }}>{error}</p>}
      <div style={listBox}>
        {connections.map((c) => {
          const name = c.institution_name ?? 'Bankverbindung';
          const expiry = dateDe(c.consent_expires_at);
          return (
            <div key={c.id} style={row}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 14 }}>{name}</strong>
                <span style={statusBadge}>{STATUS_LABEL[c.status] ?? c.status}</span>
                <div style={{ color: '#8b98a5', fontSize: 13, marginTop: 3 }}>
                  {c.accounts.length === 1 ? '1 Konto' : `${c.accounts.length} Konten`}
                  {expiry && <> · Zustimmung bis {expiry}</>}
                </div>
              </div>
              <button
                aria-label={`Verbindung ${name} löschen`}
                onClick={() => setConfirmId(c.id)}
                style={btnDangerGhost}
              >
                Löschen
              </button>
            </div>
          );
        })}
      </div>
      {target && (
        <ConfirmDialog
          title={`Verbindung „${target.institution_name ?? 'Bankverbindung'}“ löschen?`}
          busy={busy}
          onConfirm={() => remove(target.id)}
          onCancel={() => setConfirmId(null)}
        >
          {target.accounts.length ? (
            <>
              Diese Konten werden mitsamt allen Buchungen gelöscht:
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {target.accounts.map((a) => <li key={a.id}>{a.name}</li>)}
              </ul>
            </>
          ) : (
            'Keine Konten betroffen.'
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}

const listBox: React.CSSProperties = {
  background: '#161b22', border: '1px solid #2d3742', borderRadius: 12, overflow: 'hidden',
};
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '13px 16px', borderBottom: '1px solid #2d3742',
};
const statusBadge: React.CSSProperties = {
  fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#222b35',
  color: '#8b98a5', marginLeft: 8,
};
const btnDangerGhost: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, border: '1px solid #e5534b', background: 'none',
  color: '#e5534b', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
};
