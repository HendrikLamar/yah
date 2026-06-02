'use client';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { importDkbCsv, type ImportState } from './actions';

interface AccountOption {
  id: string; name: string; iban: string | null; account_type: string; is_joint: boolean;
}

const initial: ImportState = { ok: false, message: '' };

export default function ImportForm({ accounts }: { accounts: AccountOption[] }) {
  const [state, formAction] = useFormState(importDkbCsv, initial);
  const [mode, setMode] = useState<'existing' | 'new'>(accounts.length ? 'existing' : 'new');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [accountType, setAccountType] = useState('giro');

  const selected = accounts.find((a) => a.id === accountId);
  const showPartner = mode === 'new' ? accountType === 'joint' : !!selected?.is_joint;

  return (
    <main style={{ maxWidth: 560, margin: '8vh auto', fontFamily: 'system-ui', color: '#e6edf3' }}>
      <h1 style={{ fontSize: 24 }}>CSV-Import (DKB Umsatzliste)</h1>
      <p style={{ color: '#8b98a5' }}>
        Lade eine klassische DKB-Umsatzliste (CSV, Semikolon-getrennt) hoch. Die Buchungen werden automatisch
        kategorisiert und doppelte Einträge übersprungen.
      </p>

      <form action={formAction} style={{ display: 'grid', gap: 14, marginTop: 16 }}>
        <input type="file" name="file" accept=".csv,text/csv" required style={inp} />

        {accounts.length === 0 && <input type="hidden" name="mode" value="new" />}

        {accounts.length > 0 && (
          <fieldset style={fs}>
            <legend>Zielkonto</legend>
            <label style={radio}>
              <input type="radio" name="mode" value="existing" checked={mode === 'existing'}
                onChange={() => setMode('existing')} /> Bestehendes Konto
            </label>
            {mode === 'existing' && (
              <select name="account_id" value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inp}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}{a.iban ? ` · ${a.iban}` : ''}</option>
                ))}
              </select>
            )}
            <label style={radio}>
              <input type="radio" name="mode" value="new" checked={mode === 'new'}
                onChange={() => setMode('new')} /> Neues Konto anlegen
            </label>
          </fieldset>
        )}

        {mode === 'new' && (
          <fieldset style={fs}>
            <legend>Neues Konto</legend>
            <input name="name" placeholder="Kontoname (z. B. Girokonto)" style={inp} />
            <select name="account_type" value={accountType} onChange={(e) => setAccountType(e.target.value)} style={inp}>
              <option value="giro">Girokonto</option>
              <option value="savings">Tagesgeld / Sparkonto</option>
              <option value="joint">Gemeinschaftskonto</option>
            </select>
            <input name="owner_label" placeholder="Inhaber-Label (optional, z. B. Hendrik)" style={inp} />
            <p style={hint}>Die IBAN wird automatisch aus der CSV übernommen.</p>
          </fieldset>
        )}

        {showPartner && (
          <input name="partner_name" placeholder="Name des Partners (für Einzahlungs-Zuordnung, z. B. Sina)" style={inp} />
        )}

        <SubmitButton />
      </form>

      {state.message && (
        <p style={{ color: state.ok ? '#51cf66' : '#ff6b6b', minHeight: 20, marginTop: 12 }}>{state.message}</p>
      )}
      <p style={{ marginTop: 20 }}>
        <a href="/dashboard" style={{ color: '#4dabf7' }}>← Zurück zum Dashboard</a>
      </p>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} style={btn}>{pending ? 'Importiere…' : 'Importieren'}</button>;
}

const inp: React.CSSProperties = { padding: 10, borderRadius: 8, border: '1px solid #2d3742', background: '#222b35', color: '#e6edf3' };
const btn: React.CSSProperties = { padding: 10, borderRadius: 8, border: 'none', background: '#4dabf7', color: '#0f1419', fontWeight: 600, cursor: 'pointer' };
const fs: React.CSSProperties = { display: 'grid', gap: 8, border: '1px solid #2d3742', borderRadius: 8, padding: 12 };
const radio: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' };
const hint: React.CSSProperties = { color: '#8b98a5', fontSize: 13, margin: 0 };
