'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Account, SharedAccountCard } from '@/lib/types';
import { deleteAccount, renameAccount, setAccountHidden } from './actions';
import Members from './Members';
import InviteForm from './InviteForm';
import ConfirmDialog from './ConfirmDialog';

const TYPE_LABEL: Record<Account['account_type'], string> = {
  giro: 'Girokonto', savings: 'Tagesgeld / Sparen', joint: 'Gemeinschaftskonto',
};
const eur = (cents: number | null) =>
  ((cents ?? 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

function isShared(account: Account) {
  return (account.member_count ?? 1) > 1;
}

function AccountDetail({ card, currentUserId, onBack }: {
  card: SharedAccountCard; currentUserId: string; onBack: () => void;
}) {
  const router = useRouter();
  const { account, viewerRole, viewerHidden, txCount, members, pending } = card;
  const [name, setName] = useState(account.display_name ?? '');
  const [saving, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [manageError, setManageError] = useState('');
  const [managing, startManage] = useTransition();
  const shared = isShared(account);
  const isOwner = viewerRole === 'owner';
  const label = account.display_name ?? account.name;

  function save() {
    setSaved(false);
    start(async () => {
      await renameAccount(account.id, name);
      setSaved(true);
      router.refresh();
    });
  }

  function toggleHidden() {
    setManageError('');
    startManage(async () => {
      const res = await setAccountHidden(account.id, !viewerHidden);
      if (!res.ok) setManageError(res.error ?? 'Speichern fehlgeschlagen.');
      router.refresh();
    });
  }

  function removeAccount() {
    setManageError('');
    startManage(async () => {
      const res = await deleteAccount(account.id);
      if (!res.ok) setManageError(res.error ?? 'Löschen fehlgeschlagen.');
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="ap-detail">
      <button className="ap-mobile-back" onClick={onBack}>‹ Konten</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 18 }}>{account.name}</strong>
        <span style={shared ? badgeShared : badgePrivate}>
          {shared ? '👥 geteilt' : '🔒 privat'}
        </span>
        {viewerHidden && <span style={badgeHidden}>ausgeblendet</span>}
        <span style={{ color: '#8b98a5', fontSize: 13 }}>{TYPE_LABEL[account.account_type]}</span>
        {!isOwner && <span style={{ color: '#8b98a5', fontSize: 13 }}>· geteilt mit dir</span>}
        <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 18 }}>{eur(account.balance_cents)}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <input
          aria-label={`Anzeigename für ${account.name}`}
          placeholder={account.name}
          value={name}
          maxLength={60}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          style={input}
        />
        <button onClick={save} disabled={saving} style={btn}>
          {saving ? '…' : 'Speichern'}
        </button>
        {saved && !saving && <span style={{ color: '#51cf66', fontSize: 13 }}>gespeichert</span>}
      </div>

      <Members
        accountId={account.id}
        viewerRole={viewerRole}
        currentUserId={currentUserId}
        members={members}
        pending={pending}
      />
      {isOwner && <InviteForm accountId={account.id} />}

      {manageError && <p style={{ color: '#e5534b', fontSize: 14, marginTop: 14 }}>{manageError}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <button onClick={toggleHidden} disabled={managing} style={btnGhost}>
          {managing ? '…' : viewerHidden ? 'Einblenden' : 'Ausblenden'}
        </button>
        <span style={{ color: '#8b98a5', fontSize: 13 }}>
          Blendet das Konto nur für dich im Dashboard aus — andere Mitglieder sehen es weiterhin.
        </span>
      </div>

      {isOwner && (
        <div style={dangerZone}>
          {/* not a <strong>: accounts-two-pane.spec locates the account title via `.ap-detail strong` */}
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e5534b' }}>Gefahrenzone</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setConfirmOpen(true)} style={btnDangerGhost}>Konto löschen</button>
            <span style={{ color: '#8b98a5', fontSize: 13 }}>
              Entfernt das Konto endgültig, inklusive aller Buchungen.
            </span>
          </div>
        </div>
      )}

      {confirmOpen && (
        <ConfirmDialog
          title={`Konto „${label}“ löschen?`}
          busy={managing}
          onConfirm={removeAccount}
          onCancel={() => setConfirmOpen(false)}
        >
          {txCount === 1 ? '1 Buchung wird' : `${txCount} Buchungen werden`} endgültig gelöscht.
          {shared && (
            <p style={{ color: '#e5534b', marginTop: 8, marginBottom: 0 }}>
              ⚠️ Dieses Konto ist geteilt — Löschen entfernt es für alle Mitglieder.
            </p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

export default function AccountsList({ cards, currentUserId }: { cards: SharedAccountCard[]; currentUserId: string }) {
  const [selectedId, setSelectedId] = useState(cards[0]?.account.id ?? '');
  const [view, setView] = useState<'list' | 'detail'>('list');

  if (!cards.length) {
    return (
      <div style={{ ...emptyBox, marginTop: 16 }}>
        Noch keine Konten. Verbinde eine Bank oder importiere eine CSV-Datei, dann erscheinen sie hier.
      </div>
    );
  }

  // selectedId can dangle after a remove/leave shrinks the list — fall back to the first card.
  const active = cards.find((c) => c.account.id === selectedId) ?? cards[0];

  return (
    <>
      <style>{paneCss}</style>
      <div className="ap-pane" data-view={view}>
        <div className="ap-list">
          {cards.map((c) => {
            const a = c.account;
            const sel = a.id === active.account.id;
            return (
              <button
                key={a.id}
                className={`ap-item${sel ? ' sel' : ''}`}
                aria-current={sel ? 'true' : undefined}
                onClick={() => { setSelectedId(a.id); setView('detail'); }}
                style={c.viewerHidden ? { opacity: 0.55 } : undefined}
              >
                <span className="nm">
                  {a.name}
                  <span style={isShared(a) ? badgeShared : badgePrivate}>{isShared(a) ? '👥' : '🔒'}</span>
                  {c.viewerHidden && <span style={badgeHidden}>ausgeblendet</span>}
                </span>
                <span className="bl">{eur(a.balance_cents)}</span>
              </button>
            );
          })}
        </div>
        <AccountDetail
          key={active.account.id}
          card={active}
          currentUserId={currentUserId}
          onBack={() => setView('list')}
        />
      </div>
    </>
  );
}

const paneCss = `
.ap-pane{display:flex;border:1px solid #2d3742;border-radius:12px;overflow:hidden;background:#161b22;min-height:380px;margin-top:16px}
.ap-list{flex:0 0 220px;border-right:1px solid #2d3742}
.ap-item{display:block;width:100%;text-align:left;padding:13px 14px;cursor:pointer;border:none;border-bottom:1px solid #2d3742;border-left:3px solid transparent;background:none;color:#e6edf3;font:inherit}
.ap-item:hover{background:#1a2230}
.ap-item.sel{background:#1a2230;border-left-color:#4dabf7}
.ap-item .nm{font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px}
.ap-item .bl{display:block;font-size:13px;color:#8b98a5;margin-top:3px}
.ap-detail{flex:1;padding:20px;min-width:0}
.ap-mobile-back{display:none;background:none;border:none;color:#4dabf7;cursor:pointer;font-size:14px;padding:0;margin-bottom:12px;font-family:inherit}
@media (max-width:720px){
  .ap-pane{display:block}
  .ap-list{flex:none;border-right:none}
  .ap-pane[data-view="detail"] .ap-list{display:none}
  .ap-pane[data-view="list"] .ap-detail{display:none}
  .ap-pane[data-view="detail"] .ap-mobile-back{display:inline-block}
}
`;

const emptyBox: React.CSSProperties = {
  background: '#161b22', border: '1px solid #2d3742', borderRadius: 10, padding: 16, color: '#8b98a5',
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
const badgeHidden: React.CSSProperties = {
  fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(139,152,165,.18)', color: '#8b98a5',
};
const btnGhost: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, border: '1px solid #2d3742', background: 'none',
  color: '#e6edf3', fontWeight: 600, cursor: 'pointer',
};
const btnDangerGhost: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, border: '1px solid #e5534b', background: 'none',
  color: '#e5534b', fontWeight: 600, cursor: 'pointer',
};
const dangerZone: React.CSSProperties = {
  marginTop: 20, padding: 14, border: '1px solid rgba(229,83,75,.4)', borderRadius: 10,
};
