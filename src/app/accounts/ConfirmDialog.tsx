'use client';
import { useEffect } from 'react';

// Minimal destructive-action confirm modal (backdrop + Escape close). Kept
// dependency-free and inline-styled like the rest of the /accounts UI.
export default function ConfirmDialog({ title, confirmLabel = 'Endgültig löschen', busy = false, onConfirm, onCancel, children }: {
  title: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div style={backdrop} onClick={onCancel} role="presentation">
      <div style={box} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <strong style={{ fontSize: 16 }}>{title}</strong>
        <div style={{ marginTop: 10, color: '#8b98a5', fontSize: 14, lineHeight: 1.5 }}>{children}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onCancel} disabled={busy} style={btnGhost}>Abbrechen</button>
          <button onClick={onConfirm} disabled={busy} style={btnDanger}>{busy ? '…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const box: React.CSSProperties = {
  background: '#161b22', border: '1px solid #2d3742', borderRadius: 12,
  padding: 20, maxWidth: 440, width: '100%', color: '#e6edf3', fontFamily: 'system-ui',
};
const btnGhost: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid #2d3742', background: 'none',
  color: '#e6edf3', cursor: 'pointer', fontWeight: 600,
};
const btnDanger: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, border: 'none', background: '#e5534b',
  color: '#0f1419', fontWeight: 600, cursor: 'pointer',
};
