# Erste Schritte mit Claude Code

Diese Anleitung bringt dich (und Claude Code) im Repo `finanz-webservice/` zum Laufen. Sie ist bewusst knapp gehalten — Architektur und Begründungen stehen in `docs/IMPLEMENTATION_PLAN.md`, der Fahrplan in `docs/ROADMAP.md`.

## 0. Claude Code öffnen

Installieren (falls noch nicht): siehe https://docs.claude.com/claude-code. Dann im Projektordner starten:

```bash
cd finanz-webservice
claude
```

Tipp: Lass Claude Code zuerst den Plan lesen. Guter Einstiegs-Prompt:

> Lies `docs/IMPLEMENTATION_PLAN.md` und `docs/ROADMAP.md`. Fasse den aktuellen Stand und die nächsten zwei Phasen in Stichpunkten zusammen, bevor wir loslegen.

## 1. Git initialisieren (einmalig, falls notwendig)

Das Repo wurde in einer Sandbox erstellt, in der Git nicht initialisiert werden konnte. Lokal auf deinem Mac:

```bash
rm -rf .git        # evtl. kaputtes .git aus der Sandbox entfernen
./init-git.sh      # git init + erster Commit
# optional: git remote add origin <DEINE-REPO-URL> && git push -u origin main
```

## 2. Abhängigkeiten & Umgebung

```bash
npm install
cp .env.example .env.local
```

Dann `.env.local` ausfüllen:

- **Supabase**: Projekt auf https://supabase.com anlegen (EU-Region) → `Project Settings → API` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **GoCardless**: Account auf https://bankaccountdata.gocardless.com → `Developers → User Secrets` → `GOCARDLESS_SECRET_ID/KEY`.
- **Secrets**: `openssl rand -base64 32` für `TOKEN_ENCRYPTION_KEY` und `CRON_SECRET`.

## 3. Datenbank-Schema einspielen

Im Supabase-Dashboard → `SQL Editor` → Inhalt von `supabase/migrations/0001_init.sql` einfügen und ausführen. Damit entstehen alle Tabellen inkl. Row Level Security.

## 4. Lokal starten

```bash
npm run dev      # http://localhost:3000
npm run typecheck   # TypeScript prüfen
```

Beim ersten Start landest du auf `/login` → registrieren → `/dashboard` (noch leer, weil keine Konten verbunden sind).

## 5. Was als Nächstes zu bauen ist

Empfohlene Reihenfolge (Details: Roadmap):

1. **Phase 1 — Auth fertig**: Logout-Button, Profil, E-Mail-Bestätigung testen.
2. **Phase 2 — Dashboard aus DB**: `src/lib/buildDashboardData.ts` vollständig auf das View-Format mappen (`docs/DATA_SHAPE.md`). Als schnellster Weg zu echten Daten zuerst einen **CSV-Import** bauen (die DKB-Exporte, die wir schon kennen), bevor die Live-Bank-Anbindung dran ist.
3. **Phase 3/4 — Bank + Auto-Sync**: GoCardless Connect/Callback testen, dann Vercel-Cron.

### Gute Prompts für Claude Code

- „Implementiere Phase 2 aus der Roadmap: ein CSV-Upload unter `/import`, der eine DKB-Umsatzliste parst, kategorisiert (`src/lib/categorize.ts`) und in `transactions` schreibt. Danach `buildDashboardData()` für den Tab ‚Meine Konten' vervollständigen, sodass `docs/dashboard-reference.html` mit echten DB-Daten gerendert wird."
- „Vervollständige `buildDashboardData()` exakt nach `docs/DATA_SHAPE.md`. Nutze die Python-Referenz in `docs/python/` als Vorlage für die Berechnungen und schreibe Unit-Tests für `analytics.ts`."
- „Richte den GoCardless-Verbindungs-Flow als `/connect`-Seite mit Bank-Auswahl ein und teste den Callback im Sandbox-Modus von GoCardless."

## 6. Wichtige Dateien auf einen Blick

| Datei | Zweck |
|---|---|
| `docs/IMPLEMENTATION_PLAN.md` | Architektur, Phasen, Sicherheit, Kosten |
| `docs/DATA_SHAPE.md` | exaktes JSON-Format, das der View erwartet |
| `docs/dashboard-reference.html` | das freigegebene Dashboard (Referenz) |
| `docs/python/` | Berechnungs-Logik des Prototyps (Vorlage für den TS-Port) |
| `supabase/migrations/0001_init.sql` | DB-Schema + RLS |
| `src/lib/categorize.ts` · `analytics.ts` | Kategorisierung & Auswertung |
| `src/lib/gocardless.ts` · `sync.ts` | Bank-Anbindung & Sync |
| `src/app/api/...` | Connect/Callback/Sync/Cron-Endpoints |
| `src/components/DashboardView.tsx` | bindet den freigegebenen View ein |

## 7. Deployment (wenn es läuft)

Vercel-Projekt mit dem Repo verbinden, alle Env-Variablen dort eintragen, `vercel.json` registriert den 6-Stunden-Cron automatisch. EU-Region für Datenschutz wählen.

---

**Merksatz:** Frontend bleibt unverändert (es gefällt dir ja so). Alle Arbeit passiert dahinter — DB, Auth, Bank-Sync, und das Mapping der Daten ins bestehende View-Format.
