'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [msg, setMsg] = useState('');
  const db = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('…');
    const fn = mode === 'login'
      ? db.auth.signInWithPassword({ email, password: pw })
      : db.auth.signUp({ email, password: pw });
    const { error } = await fn;
    if (error) return setMsg(error.message);
    if (mode === 'signup') return setMsg('Bestätigungs-E-Mail gesendet. Bitte Postfach prüfen.');
    window.location.href = '/dashboard';
  }

  return (
    <main style={{ maxWidth: 360, margin: '12vh auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 24 }}>💶 Finanz-Dashboard</h1>
      <p style={{ color: '#8b98a5' }}>{mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <input placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)}
          style={inp} type="email" required />
        <input placeholder="Passwort" value={pw} onChange={(e) => setPw(e.target.value)}
          style={inp} type="password" required />
        <button style={btn}>{mode === 'login' ? 'Login' : 'Sign-up'}</button>
      </form>
      <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        style={{ ...btn, background: 'transparent', color: '#4dabf7', marginTop: 8 }}>
        {mode === 'login' ? 'Noch kein Konto? Registrieren' : 'Schon registriert? Login'}
      </button>
      <p style={{ color: '#ffd43b', minHeight: 20 }}>{msg}</p>
    </main>
  );
}
const inp: React.CSSProperties = { padding: 10, borderRadius: 8, border: '1px solid #2d3742', background: '#222b35', color: '#e6edf3' };
const btn: React.CSSProperties = { padding: 10, borderRadius: 8, border: 'none', background: '#4dabf7', color: '#0f1419', fontWeight: 600, cursor: 'pointer' };
