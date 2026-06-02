'use client';
import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// App header with a profile dropdown (email, account management, logout).
// Logout mirrors the client auth pattern in src/app/login/page.tsx.
export default function AppHeader({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = (email[0] ?? '?').toUpperCase();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function logout() {
    await createClient().auth.signOut();
    window.location.href = '/login';
  }

  return (
    <header style={header}>
      <a href="/dashboard" style={{ color: '#e6edf3', textDecoration: 'none', fontWeight: 600 }}>💶 Finanz-Dashboard</a>
      <div ref={ref} style={{ position: 'relative' }}>
        <button aria-label="Profilmenü" onClick={() => setOpen((v) => !v)} style={avatar}>{initials}</button>
        {open && (
          <div style={menu}>
            <div style={{ padding: '8px 12px', color: '#8b98a5', fontSize: 13, borderBottom: '1px solid #2d3742' }}>
              {email}
            </div>
            <a href="/accounts" style={item}>Konten verwalten</a>
            <button onClick={logout} style={{ ...item, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
              Abmelden
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

const header: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 24px', borderBottom: '1px solid #2d3742', background: '#0f1419',
  fontFamily: 'system-ui',
};
const avatar: React.CSSProperties = {
  width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#4dabf7',
  color: '#0f1419', fontWeight: 700, cursor: 'pointer',
};
const menu: React.CSSProperties = {
  position: 'absolute', right: 0, top: 44, minWidth: 200, background: '#161b22',
  border: '1px solid #2d3742', borderRadius: 10, overflow: 'hidden', zIndex: 20,
  boxShadow: '0 8px 24px rgba(0,0,0,.4)',
};
const item: React.CSSProperties = {
  display: 'block', padding: '10px 12px', color: '#e6edf3', textDecoration: 'none', fontSize: 14,
};
