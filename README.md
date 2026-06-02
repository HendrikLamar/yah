# 💶 Finanz-Webservice

Persönliches Finanz-Dashboard als Web-App: Sign-up/Login, Bank-Anbindung über
PSD2 (GoCardless Bank Account Data) mit geplantem Sync, Postgres-Datenbank.
Das Frontend ist das bereits abgenommene 3-Tab-Dashboard
(Meine Konten · Gemeinschaftskonto · Haushalt gesamt) — unverändert übernommen.

## Stack
- **Next.js 14** (App Router, TypeScript) — UI + API-Routes
- **Supabase** — Postgres, Auth, Row Level Security
- **GoCardless Bank Account Data** — PSD2-Aggregator (DKB & EU-Banken)
- **Vercel** — Hosting + Cron (Sync alle 6 h)

## Architektur (Kurz)
```
Browser ──▶ Next.js (Vercel)
              │  Auth (Supabase) · RLS pro user
              ├─ /api/banks/connect   → GoCardless Requisition → Consent-Link
              ├─ /api/banks/callback  → Konten speichern + erster Sync
              ├─ /api/sync            → manueller Sync
              └─ /api/cron/sync       → Vercel Cron (4×/Tag, PSD2-Limit)
                       │
                       ▼
                 Supabase Postgres  ──RLS──▶  Dashboard (Server Component)
                                              └─ buildDashboardData() → View
```

## Setup
1. **Repo & Deps**
   ```bash
   npm install
   cp .env.example .env.local   # Werte eintragen
   ```
2. **Supabase**: Projekt anlegen → `supabase/migrations/0001_init.sql` im SQL-Editor
   ausführen → URL + anon key + service-role key in `.env.local`.
3. **GoCardless**: Account auf https://bankaccountdata.gocardless.com → User Secrets
   erzeugen → `GOCARDLESS_SECRET_ID/KEY` setzen.
4. **Secrets**: `openssl rand -base64 32` für `TOKEN_ENCRYPTION_KEY` und `CRON_SECRET`.
5. **Start**: `npm run dev` → http://localhost:3000

## Deployment (Vercel)
- Repo verbinden, Env-Variablen setzen. `vercel.json` registriert den Cron.
- Cron sendet `Authorization: Bearer $CRON_SECRET` an `/api/cron/sync`.

## Wichtige Hinweise
- **PSD2-Limits**: Banken erlauben oft nur ~4 Abrufe/Tag/Konto. „Live" = Sync alle 6 h.
  Nutzer-Consent läuft nach ~90 Tagen ab → Re-Auth-Flow nötig (TODO).
- **Sicherheit**: Service-Role-Key nur serverseitig. RLS schützt jede Tabelle.
  Keine Bank-Zugangsdaten speichern (übernimmt GoCardless).
- **DSGVO**: Datensparsamkeit, Export/Löschung pro Nutzer, AVV mit Aggregator/Hostern.

## Was noch zu tun ist (siehe `docs/ROADMAP.md`)
- `buildDashboardData()` vollständig auf das View-Format mappen (`docs/DATA_SHAPE.md`)
- Bank-Auswahl-Dialog (`/connect`) + Re-Consent-Flow
- Kontotypen/Eigentümer setzen (giro/savings/joint) + Kategorie-Editor
- Tests, Fehler-/Rate-Limit-UI, Logging/Monitoring

## Struktur
```
src/
  app/            Seiten (login, dashboard) + API-Routes
  components/     DashboardView (lädt den freigegebenen View aus /public)
  lib/            supabase/ · gocardless.ts · categorize.ts · analytics.ts · sync.ts
supabase/migrations/  SQL-Schema + RLS
public/           dashboard.css · dashboard-skeleton.html · dashboard-view.js
docs/             ROADMAP.md · DATA_SHAPE.md · dashboard-reference.html · python/
```
