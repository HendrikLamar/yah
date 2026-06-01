# Dashboard-Datenformat (`window.__FINANZ_DATA__`)

`public/dashboard-view.js` (der unveränderte, freigegebene View) erwartet ein Objekt
`{ m, b, tx, j, jx, c, cx }`. `buildDashboardData()` muss genau diese Form liefern.
Beträge im View sind in **Euro** (nicht Cent).

## `m` — Meine Konten (Giro + Tagesgeld)
| Feld | Typ | Bedeutung |
|---|---|---|
| `months` | `string[12]` | `"2025-01"…` |
| `mlabels` | `string[12]` | `"Jan"…"Dez"` |
| `gehalt_m`, `erstatt_m`, `konsum_m`, `net_m` | `number[12]` | Monatswerte Cashflow |
| `gehalt_total`, `erstatt_total`, `zins_total`, `echtes_eink`, `konsum_total`, `net_operativ` | `number` | Jahressummen |
| `spar_brutto`, `entsparen`, `netto_verm`, `sparquote`, `anlage_ausz` | `number` | Vermögensbewegungen |
| `income_correction` | `number` | durch Tagesgeld erkannte Falsch-Einnahmen |
| `cat_total` | `{cat: number}` | Konsum je Kategorie |
| `cat_month` | `{cat: number[12]}` | Konsum je Kategorie/Monat |
| `subs` | `{name,count,avg,total}[]` | Abos & Versicherungen |
| `accounts.giro` / `accounts.tages` | Objekt | `{name,iban,end2025,net,start2025,now,n,series[12], …}`; Tagesgeld zusätzlich `zins,dep,wd,txns[]`; Giro zusätzlich `summary{}` |
| `n_total` | `number` | Anzahl Buchungen |

## `b` — Budget 2026
`{ budget: {cat: number}, fix: string[], fix_sum, var_sum, gehalt_mo }`

## `tx` — Einzelbuchungen meine Konten
`{acct:"Giro"|"Tagesgeld", d, mo, e, z, a, c, int}[]`

## `j` / `jx` — Gemeinschaftskonto (Metriken / Buchungen)
`j`: `months, mlabels, inc_sina[12], inc_hendrik[12], inc_ext[12], ausg_m[12],
cat_total{}, cat_month{}, sina_total, hendrik_total, ext_total, einn_total,
ausg_total, ausg_laufend, sina_share, start2025, end2025, net, now, n, series[12]`.
`jx`: `{acct:"Gemeinschaft", d, mo, e, z, a, c, int}[]`.

## `c` / `cx` — Haushalt gesamt (konsolidiert)
`c`: `months, mlabels, hendrik_eink_m[12], sina_m[12], ext_m[12], comb_inc_m[12],
comb_exp_m[12], comb_net_m[12], hendrik_eink_tot, sina_tot, ext_tot, comb_inc_tot,
cat_total{}, cat_month{}, comb_exp_tot, einmal, comb_exp_laufend, comb_net_op,
comb_net_all, hendrik_personal_tot, joint_tot`.
`cx`: `{src:"Hendrik"|"Gemeinschaft", d, mo, e, z, a, c}[]`.

> Referenz-Implementierung der Berechnung: `docs/python/` (Prototyp) und
> `src/lib/analytics.ts` (TS-Port, in Arbeit). `docs/dashboard-reference.html`
> ist das exakte, freigegebene Dashboard mit eingebetteten Beispieldaten.
