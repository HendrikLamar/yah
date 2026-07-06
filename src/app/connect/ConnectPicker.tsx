'use client';
import { useEffect, useMemo, useState } from 'react';

interface Bank { name: string; country: string; logo: string | null; beta: boolean; }

const COUNTRIES = [
  { code: 'DE', label: 'Deutschland' },
  { code: 'AT', label: 'Österreich' },
  { code: 'NL', label: 'Niederlande' },
  { code: 'FR', label: 'Frankreich' },
  { code: 'BE', label: 'Belgien' },
  { code: 'ES', label: 'Spanien' },
  { code: 'IT', label: 'Italien' },
  { code: 'FI', label: 'Finnland' },
];

export default function ConnectPicker() {
  const [country, setCountry] = useState('DE');
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('');
  const [connecting, setConnecting] = useState('');
  const [connectError, setConnectError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setBanks(null);
    setLoadError('');
    fetch(`/api/banks/institutions?country=${country}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((j) => { if (!cancelled) setBanks(j.banks ?? []); })
      .catch(() => { if (!cancelled) setLoadError('Bankenliste konnte nicht geladen werden.'); });
    return () => { cancelled = true; };
  }, [country, reloadKey]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (banks ?? []).filter((b) => !q || b.name.toLowerCase().includes(q));
  }, [banks, filter]);

  async function startConnect(bank: Bank) {
    setConnecting(bank.name);
    setConnectError('');
    try {
      const r = await fetch('/api/banks/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bank.name, country: bank.country }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.error ?? `${r.status}`);
      window.location.href = j.url;
    } catch {
      setConnectError('Verbindung konnte nicht gestartet werden. Bitte erneut versuchen.');
      setConnecting('');
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: '8vh auto', fontFamily: 'system-ui', color: '#e6edf3' }}>
      <h1 style={{ fontSize: 24 }}>Bankkonto verbinden</h1>
      <p style={{ color: '#8b98a5' }}>
        Wähle deine Bank aus. Du wirst zur Bank weitergeleitet und meldest dich dort an (PSD2-Kontozugriff,
        gültig bis zu 180 Tage). Danach werden Konten und Umsätze automatisch synchronisiert.
      </p>

      <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={inp} aria-label="Land">
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <input
          placeholder="Bank suchen (z. B. DKB)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={inp}
        />

        {banks === null && !loadError && <p style={hint}>Lade Bankenliste…</p>}

        {loadError && (
          <p style={{ color: '#ff6b6b' }}>
            {loadError}{' '}
            <button onClick={() => setReloadKey((k) => k + 1)} style={linkBtn}>Erneut versuchen</button>
          </p>
        )}

        {banks !== null && banks.length === 0 && (
          <p style={hint}>Für dieses Land sind keine Banken verfügbar.</p>
        )}
        {banks !== null && banks.length > 0 && visible.length === 0 && (
          <p style={hint}>Keine Bank passt zur Suche.</p>
        )}

        <div style={{ display: 'grid', gap: 8, maxHeight: '50vh', overflowY: 'auto' }}>
          {visible.map((b) => (
            <button key={b.name} onClick={() => startConnect(b)} disabled={!!connecting} style={bankBtn}>
              <span>{b.name}{b.beta ? ' (Beta)' : ''}</span>
              <span style={{ color: '#8b98a5' }}>{connecting === b.name ? 'Verbinde…' : '→'}</span>
            </button>
          ))}
        </div>

        {connectError && <p style={{ color: '#ff6b6b' }}>{connectError}</p>}
      </div>

      <p style={{ marginTop: 20 }}>
        <a href="/dashboard" style={{ color: '#4dabf7' }}>← Zurück zum Dashboard</a>
      </p>
    </main>
  );
}

const inp: React.CSSProperties = { padding: 10, borderRadius: 8, border: '1px solid #2d3742', background: '#222b35', color: '#e6edf3' };
const bankBtn: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px',
  borderRadius: 8, border: '1px solid #2d3742', background: '#222b35', color: '#e6edf3',
  cursor: 'pointer', textAlign: 'left', fontSize: 15,
};
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#4dabf7', cursor: 'pointer', padding: 0, font: 'inherit' };
const hint: React.CSSProperties = { color: '#8b98a5', margin: 0 };
