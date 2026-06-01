# Implementation Plan — Finanz-Webservice

Aus dem fertigen 3-Tab-Dashboard soll ein vollwertiger Webservice werden: mit Sign-up/Login, Bank-Anbindung (Live-Sync) und Datenbank im Hintergrund. Dieses Dokument beschreibt Architektur, Vorgehen in Phasen, Aufwand, Sicherheit/DSGVO, Kosten und Risiken. Der Tech-Stack ist festgelegt auf **Next.js + Supabase + GoCardless Bank Account Data**, Hosting auf **Vercel**.

---

## 1. Leitidee

Das bestehende, abgenommene Dashboard bleibt das Frontend — unverändert im Aussehen. Es wird lediglich von „eingebettete JSON-Datei" auf „Daten aus der Datenbank" umgestellt. Alles Neue (Auth, Bank-Sync, DB) liegt dahinter. So bleibt das, was dir gefällt, erhalten, und wir bauen nur das Fundament darunter neu.

---

## 2. Zielarchitektur

```
                         ┌─────────────────────────────────────┐
   Browser  ───────────▶ │  Next.js auf Vercel                 │
   (Dashboard)           │   • Auth-Session (Supabase Cookie)  │
                         │   • Server Components rendern den    │
                         │     View aus DB-Daten                │
                         │   • API-Routes:                      │
                         │       /api/banks/connect             │
                         │       /api/banks/callback            │
                         │       /api/sync                      │
                         │       /api/cron/sync  ◀── Vercel Cron│
                         └───────────────┬─────────────────────┘
                                         │
              ┌──────────────────────────┼───────────────────────────┐
              ▼                          ▼                           ▼
   ┌────────────────────┐   ┌──────────────────────────┐  ┌────────────────────┐
   │ Supabase Postgres  │   │ GoCardless Bank Acct Data │  │ Supabase Auth      │
   │  + Row Level Sec.  │   │  (PSD2-Aggregator, DKB…)  │  │  (Sign-up/Login)   │
   └────────────────────┘   └──────────────────────────┘  └────────────────────┘
```

Kernprinzipien: **Row Level Security** (jeder Nutzer sieht nur seine Daten), **keine Bank-Zugangsdaten bei uns** (übernimmt der Aggregator), **Sync per Zeitplan** statt Echtzeit (PSD2-Grenzen), **Beträge in Integer-Cent** in der DB.

---

## 3. Datenmodell (Postgres)

Vollständig in `supabase/migrations/0001_init.sql`. Tabellen:

| Tabelle | Zweck |
|---|---|
| `profiles` | 1:1 zum Auth-User (Anzeigename) |
| `bank_connections` | eine Bank-Einwilligung (GoCardless „Requisition"), Consent-Ablauf (~90 Tage) |
| `accounts` | Konten je Verbindung; `account_type` (giro/savings/joint), `is_joint`, `owner_label`, letzter Saldo |
| `transactions` | Buchungen; Betrag in Cent, `category`, `category_group`, `is_internal`, Dedupe über `gc_transaction_id` |
| `category_rules` | nutzereigene Kategorisierungs-Regeln (überschreiben die Default-Engine) |
| `sync_logs` | Protokoll der Sync-Läufe (ok/rate_limited/error) |

Alle Tabellen mit RLS-Policy „nur Eigentümer". Ein Trigger legt beim Sign-up automatisch ein `profiles`-Zeile an.

---

## 4. Bank-Anbindung (GoCardless Bank Account Data)

**Verbindungs-Flow (einmalig pro Bank):**

1. Nutzer wählt Bank (z. B. DKB) → `POST /api/banks/connect`.
2. Wir erstellen eine *Requisition* und erhalten einen gehosteten Consent-Link.
3. Nutzer authentifiziert sich bei seiner Bank (SCA / TAN) auf der Aggregator-Seite.
4. Rücksprung auf `/api/banks/callback` → wir holen die freigegebenen Konten und speichern sie.
5. Sofortiger Erst-Sync der Buchungen.

**Sync-Flow (laufend):**

- `GET /api/cron/sync` läuft per Vercel Cron alle 6 Stunden (= 4×/Tag).
- Holt je Konto Salden + gebuchte Transaktionen, kategorisiert sie und schreibt sie dedupliziert in die DB.

**Realität „Live":** Banken limitieren PSD2-Zugriffe auf oft **~4 Abrufe pro Tag, Konto und Bereich** (Details/Salden/Umsätze). Echtzeit-Push gibt es nicht. „Live-Update" heißt hier: aktueller Stand mit wenigen Stunden Verzug, plus „Jetzt aktualisieren"-Button (der ins Limit zählt). Der Consent läuft nach ~90 Tagen ab → es braucht einen **Re-Consent-Flow** (rechtzeitige Erinnerung + erneute Bank-Anmeldung).

---

## 5. Kategorisierung & Auswertung

Die Logik aus dem Prototyp wird nach TypeScript portiert:

- `src/lib/categorize.ts` — Regel-Engine (Empfänger/Verwendungszweck → Kategorie + Gruppe), plus nutzerdefinierte Overrides aus `category_rules`.
- `src/lib/analytics.ts` — Aggregationen: Cashflow/Monat, Kategorie-Summen, **Erkennung interner Transfers** (Gegenkonto-IBAN ∈ eigene Konten) und **Konsolidierung** (Haushalt gesamt, Netting der Beiträge ans Gemeinschaftskonto).
- `src/lib/buildDashboardData.ts` — setzt daraus exakt das JSON-Format zusammen, das der View erwartet (dokumentiert in `docs/DATA_SHAPE.md`).

Die Python-Skripte des Prototyps liegen als Referenz in `docs/python/`.

---

## 6. Sicherheit & DSGVO

Finanzdaten sind besonders schützenswert — von Tag 1 mitgedacht:

- **Mandanten-Trennung** über RLS auf jeder Tabelle (auth.uid()).
- **Service-Role-Key** ausschließlich serverseitig (Cron); nie ins Frontend.
- **Keine Bankzugangsdaten** speichern — SCA passiert beim Aggregator.
- **Verschlüsselung**: Supabase verschlüsselt at-rest/in-transit; sensible Zusatz-Token zusätzlich mit `TOKEN_ENCRYPTION_KEY`.
- **DSGVO**: Datensparsamkeit, Daten-Export & -Löschung pro Nutzer (Recht auf Vergessenwerden), Auftragsverarbeitungsverträge (AVV) mit Supabase, Vercel und GoCardless, Verarbeitungsverzeichnis, Datenschutzerklärung. EU-Region für DB/Hosting wählen.
- **Härtung**: Rate-Limiting der eigenen Endpoints, Secret-Schutz des Cron-Endpoints (Bearer), Audit über `sync_logs`.

---

## 7. Phasen-Roadmap

| Phase | Inhalt | Ergebnis | grobe Dauer¹ |
|---|---|---|---|
| **0 — Setup** | Repo (steht), Supabase-Projekt, Schema einspielen, Env, Deploy-Pipeline | App läuft leer auf Vercel | 0,5–1 Tag |
| **1 — Auth** | Sign-up/Login (Supabase), geschützte Routen, Profil | Nutzer können sich anmelden | 1–2 Tage |
| **2 — Daten-Import (CSV)** | CSV-Upload als Fallback + `buildDashboardData()` vollständig → View zeigt echte DB-Daten | Dashboard live aus DB (ohne Bank) | 2–4 Tage |
| **3 — Bank-Anbindung** | GoCardless Connect/Callback, Konten + Erst-Sync | DKB verbunden, echte Umsätze | 3–5 Tage |
| **4 — Auto-Sync** | Vercel Cron, Dedupe, Rate-Limit-Handling, Sync-Status-UI | „Live"-Aktualisierung | 2–3 Tage |
| **5 — Mehrkonten & Konsolidierung** | Kontotypen (giro/savings/joint), interne Transfers, 3-Tab-Konsolidierung in TS | Volle Funktion wie Prototyp | 3–5 Tage |
| **6 — Feinschliff** | Re-Consent-Flow, Kategorie-Editor, Budget-Engine, Fehler-/Leer-Zustände, Tests, Monitoring | produktionsreif | 4–6 Tage |

¹ Richtwerte für eine Person mit Next.js-Erfahrung; parallelisierbar.

**Empfohlene Reihenfolge der ersten zwei Wochen:** Phase 0 → 1 → 2 (damit du das geliebte Dashboard schnell mit echten — zunächst per CSV importierten — DB-Daten siehst), dann 3 → 4 für die Bank-Automatik.

---

## 8. Kosten (Größenordnung, bitte aktuell prüfen)

- **Supabase**: Free-Tier für Start; Pro ab ca. 25 $/Monat bei mehr Volumen.
- **Vercel**: Hobby kostenlos (inkl. Cron); Pro ab ca. 20 $/Monat für produktiv.
- **GoCardless Bank Account Data**: kostenloser Tier für geringes Volumen; darüber nutzungsabhängig — vor Produktivbetrieb Konditionen/Quoten verifizieren.
- **Domain**: ~10–15 €/Jahr.

Für ein privates/kleines Projekt: zunächst **0 €** möglich.

---

## 9. Risiken & offene Punkte

- **PSD2-Quoten**: harte Abruf-Limits → Sync-Frequenz und „Aktualisieren"-Button entsprechend gestalten; Nutzererwartung an „Live" managen.
- **Consent-Ablauf (90 Tage)**: ohne Re-Consent-Flow reißt der Sync ab → früh einplanen.
- **Datenqualität**: Verwendungszwecke/Empfänger sind uneinheitlich → Kategorie-Editor + Lernregeln vorsehen.
- **Compliance**: AVVs, Datenschutzerklärung, ggf. Impressum, falls öffentlich.
- **Mehrbenutzer-Gemeinschaftskonto**: Wenn später auch Sina einen Login bekommen soll, braucht es ein Freigabe-/Haushalts-Konzept (geteilte Konten zwischen zwei Nutzern).

---

## 10. Was bereits im Repo liegt

Lauffähiges Gerüst mit: Next.js-Struktur, vollständigem DB-Schema inkl. RLS, Supabase-Clients, GoCardless-Wrapper, Sync-Routine, Kategorisierungs-Engine (TS-Port), API-Routes (connect/callback/sync/cron), Login-Seite, Dashboard-Seite, Middleware-Schutz und dem **unveränderten, freigegebenen View** als statische Assets in `public/`. Die Haupt-Restarbeit ist `buildDashboardData()` vollständig auf das dokumentierte Format zu mappen (Phase 2/5).
