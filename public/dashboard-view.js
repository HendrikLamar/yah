// Renders the per-account dashboard from window.__FINANZ_DATA__:
//   { meta, accounts: AccountView[], consolidated: ConsolidatedView | null }
// One tab per account that has data, rendered with a shared role-adaptive
// panel; a "Haushalt gesamt" tab only when the consolidated view is present.
// All numbers arrive in EUR. Every chart/table guards against empty data so a
// tab with no categorised expenses renders a message instead of crashing.
const D = window.__FINANZ_DATA__;
const eur = v => (v || 0).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
const eur2 = v => (v || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const esc = s => (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const C = {
  acc: '#4dabf7', grn: '#51cf66', red: '#ff6b6b', yel: '#ffd43b', vio: '#b197fc', mut: '#8b98a5',
  pal: ['#4dabf7', '#51cf66', '#ffd43b', '#ff6b6b', '#b197fc', '#ffa94d', '#63e6be', '#f783ac', '#a9e34b', '#74c0fc', '#ffc078', '#e599f7', '#868e96'],
};
Chart.defaults.color = '#8b98a5';
Chart.defaults.font.family = '-apple-system,Segoe UI,Roboto,sans-serif';
Chart.defaults.borderColor = '#2d3742';
const ROLE_EMOJI = { giro: '🏦', tages: '🐷', joint: '👨‍👩‍👧' };
const ROLE_CAPTION = {
  giro: 'Girokonto: Einnahmen, Ausgaben und Saldoentwicklung dieses Kontos.',
  tages: 'Spar-/Tagesgeldkonto: Zu- und Abflüsse sowie Zinsen dieses Kontos.',
  joint: 'Gemeinschaftskonto: Einnahmen und Ausgaben dieses geteilten Kontos.',
};

const meta = D.meta;
document.getElementById('year').textContent = meta.year;
document.getElementById('meta').textContent =
  `${meta.n_accounts} ${meta.n_accounts === 1 ? 'Konto' : 'Konten'} · ${meta.n_total} Buchungen · Gesamtsaldo ${eur2(meta.total_balance)}`;
document.getElementById('foot').textContent =
  'Automatisch erstellt aus den importierten Umsätzen. Interne Transfers zwischen eigenen Konten werden über die Gegenkonto-IBAN erkannt und nicht doppelt gezählt. Kategorien stammen aus Empfänger & Verwendungszweck – einzelne Buchungen können abweichen.';

// ---- generic renderers (all guard empty data) ----------------------------
const el = (panel, name) => panel.querySelector(`[data-el="${name}"]`);
const sortEntries = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]);

function emptyCard(canvas, msg) {
  const card = canvas.closest('.card');
  if (card) card.innerHTML = `<div class="empty">${msg}</div>`;
}

function kpiHTML(items) {
  return items.map(k => `<div class="card kpi"><div class="lbl">${k.lbl}</div><div class="val ${k.cls}">${k.val}</div><div class="note">${k.note || ''}</div></div>`).join('');
}

function seriesChart(canvas, labels, series) {
  new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Saldo (Monatsende)', data: series, borderColor: C.acc, backgroundColor: 'rgba(77,171,247,.15)', fill: true, tension: .25, pointRadius: 3 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => eur2(c.parsed.y) } } }, scales: { y: { ticks: { callback: v => eur(v) } } } },
  });
}

function cashflowChart(canvas, labels, inc, exp) {
  const net = labels.map((_, i) => Math.round((inc[i] - exp[i]) * 100) / 100);
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels, datasets: [
        { label: 'Einnahmen', data: inc, backgroundColor: C.grn, stack: 'in' },
        { label: 'Ausgaben', data: exp.map(v => -v), backgroundColor: C.red, stack: 'out' },
        { type: 'line', label: 'Saldo', data: net, borderColor: C.yel, backgroundColor: C.yel, tension: .3, pointRadius: 3, fill: false },
      ],
    },
    options: { scales: { x: { stacked: true }, y: { ticks: { callback: v => eur(v) } } }, plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ': ' + eur2(Math.abs(c.parsed.y)) } } } },
  });
}

function doughnut(canvas, entries, onClick) {
  if (!entries.length) { emptyCard(canvas, 'Keine kategorisierten Ausgaben.'); return; }
  new Chart(canvas, {
    type: 'doughnut',
    data: { labels: entries.map(e => e[0]), datasets: [{ data: entries.map(e => e[1]), backgroundColor: C.pal, borderWidth: 1, borderColor: '#1a2027' }] },
    options: {
      onClick: (e, hit) => { if (hit.length && onClick) onClick(entries[hit[0].index][0]); },
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 11, font: { size: 11 } }, onClick: (e, li) => { if (onClick) onClick(entries[li.index][0]); } },
        tooltip: { callbacks: { label: c => c.label + ': ' + eur2(c.parsed) } },
      },
    },
  });
}

function catTable(node, entries, total, onClick) {
  if (!entries.length) { node.innerHTML = '<div class="empty">Keine kategorisierten Ausgaben.</div>'; return; }
  const max = entries[0][1];
  node.innerHTML = '<table><thead><tr><th>Kategorie</th><th class="num">Jahr</th><th class="num">Ø/Mt</th><th class="num">Anteil</th></tr></thead><tbody>'
    + entries.map(([k, v]) => `<tr class="click" data-cat="${esc(k)}"><td>${esc(k)}</td><td class="num">${eur(v)}</td><td class="num">${eur(Math.round(v / 12))}</td><td class="num">${total ? (v / total * 100).toFixed(0) : 0}%<div class="bar"><i style="width:${max ? v / max * 100 : 0}%"></i></div></td></tr>`).join('')
    + `<tr class="sumrow"><td>Summe Ausgaben</td><td class="num">${eur(total)}</td><td class="num">${eur(Math.round(total / 12))}</td><td class="num">100%</td></tr></tbody></table>`;
  node.querySelectorAll('tr.click').forEach(r => r.onclick = () => onClick && onClick(r.dataset.cat));
}

function stackChart(canvas, entries, catMonth, labels) {
  if (!entries.length) { emptyCard(canvas, 'Keine kategorisierten Ausgaben.'); return; }
  const top = entries.slice(0, 6).map(e => e[0]);
  const ds = top.map((c, i) => ({ label: c, data: catMonth[c] || new Array(12).fill(0), backgroundColor: C.pal[i] }));
  const rest = labels.map((_, mi) => entries.slice(6).reduce((s, e) => s + ((catMonth[e[0]] || [])[mi] || 0), 0));
  if (entries.length > 6) ds.push({ label: 'Übrige', data: rest, backgroundColor: C.mut });
  new Chart(canvas, {
    type: 'bar', data: { labels, datasets: ds },
    options: { scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: v => eur(v) } } }, plugins: { legend: { labels: { boxWidth: 11, font: { size: 11 } } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + eur2(c.parsed.y) } } } },
  });
}

// Filtered transaction table. opt.showAcct/showCat add columns.
function drillTable(node, countNode, rows, opt) {
  opt = opt || {};
  rows = rows.slice().sort((a, b) => a.a - b.a);
  const sO = rows.filter(r => r.a < 0).reduce((s, r) => s + r.a, 0);
  const sI = rows.filter(r => r.a > 0).reduce((s, r) => s + r.a, 0);
  countNode.textContent = `${rows.length} Buchungen`;
  if (!rows.length) { node.innerHTML = '<div class="empty">Keine Buchungen für diese Auswahl.</div>'; return; }
  const cols = 1 + (opt.showAcct ? 1 : 0) + (opt.showCat ? 1 : 0) + 1;
  node.innerHTML = '<table><thead><tr><th>Datum</th>' + (opt.showAcct ? '<th>Konto</th>' : '') + (opt.showCat ? '<th>Kategorie</th>' : '') + '<th>Empfänger / Auftraggeber</th><th>Verwendungszweck</th><th class="num">Betrag</th></tr></thead><tbody>'
    + (sO < 0 ? `<tr class="sumrow"><td colspan="${cols}">Summe Ausgaben</td><td class="num amt-neg">${eur2(sO)}</td></tr>` : '')
    + (sI > 0 ? `<tr class="sumrow"><td colspan="${cols}">Summe Eingänge</td><td class="num amt-pos">${eur2(sI)}</td></tr>` : '')
    + rows.map(r => `<tr><td>${r.d}</td>` + (opt.showAcct ? `<td class="mut">${esc(r.acct)}</td>` : '') + (opt.showCat ? `<td class="mut">${esc(r.c)}${r.int ? ' <span class="tag int">intern</span>' : ''}</td>` : '') + `<td>${esc(r.e)}</td><td class="mut">${esc(r.z)}</td><td class="num ${r.a < 0 ? 'amt-neg' : 'amt-pos'}">${eur2(r.a)}</td></tr>`).join('')
    + '</tbody></table>';
}

function fillMonths(select, months, labels) {
  select.innerHTML = '<option value="">Ganzes Jahr</option>' + months.map((mo, i) => `<option value="${mo}">${labels[i]} ${meta.year}</option>`).join('');
}
function fillCats(select, rows) {
  const cats = [...new Set(rows.map(t => t.c))].sort();
  select.innerHTML = '<option value="">Alle Kategorien</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

// ---- account panel -------------------------------------------------------
function renderAccount(view, panel) {
  const badge = view.shared ? ' <span class="shared-badge">👥 geteilt</span>' : '';
  el(panel, 'acard').innerHTML =
    `<div class="anm">${ROLE_EMOJI[view.role] || '🏦'} ${esc(view.label)}${badge}</div>
     <div class="aib">${esc(view.iban)} · ${view.n} Buchungen</div>
     <div class="abal">${eur2(view.end)}</div><div class="hint">Saldo Jahresende</div>
     <div class="arow"><span>Δ ${meta.year}</span><span class="${view.net >= 0 ? 'green' : 'red'}">${(view.net >= 0 ? '+' : '') + eur2(view.net)}</span></div>
     <div class="arow"><span>Aktueller Stand</span><span>${eur2(view.now)}</span></div>`;

  el(panel, 'caption').innerHTML = `<b>${esc(view.label)}:</b> ${ROLE_CAPTION[view.role] || ''}`;

  el(panel, 'kpis').innerHTML = kpiHTML([
    { lbl: 'Einnahmen', val: eur(view.income), cls: 'green', note: meta.year + ' (ohne interne Transfers)' },
    { lbl: 'Ausgaben', val: eur(view.expenses), cls: 'red', note: `Ø ${eur(Math.round(view.expenses / 12))}/Monat` },
    { lbl: 'Operativer Saldo', val: (view.net_op >= 0 ? '+' : '') + eur(view.net_op), cls: view.net_op >= 0 ? 'green' : 'red', note: 'Einnahmen − Ausgaben' },
    { lbl: 'Aktueller Kontostand', val: eur2(view.now), cls: 'acc', note: 'letzter bekannter Stand' },
  ]);

  seriesChart(el(panel, 'series'), view.mlabels, view.series);
  cashflowChart(el(panel, 'cashflow'), view.mlabels, view.inc_m, view.exp_m);

  const entries = sortEntries(view.cat_total);
  const fcat = el(panel, 'fcat'), fmonth = el(panel, 'fmonth'), dtable = el(panel, 'dtable'), count = el(panel, 'count');
  function jump(c) { fcat.value = c; render(); el(panel, 'anchor').scrollIntoView({ behavior: 'smooth' }); }
  function render() {
    const c = fcat.value, mo = fmonth.value;
    const rows = view.tx.filter(t => (!c || t.c === c) && (!mo || t.mo === mo));
    panel.querySelectorAll('[data-el="cattable"] tr.click').forEach(r => r.classList.toggle('active', r.dataset.cat === c));
    drillTable(dtable, count, rows, { showCat: !c });
  }
  doughnut(el(panel, 'dough'), entries, jump);
  catTable(el(panel, 'cattable'), entries, view.expenses, jump);
  fillCats(fcat, view.tx);
  fillMonths(fmonth, view.months, view.mlabels);
  [fcat, fmonth].forEach(s => s.onchange = render);
  el(panel, 'reset').onclick = () => { fcat.value = ''; fmonth.value = ''; render(); };
  render();
  stackChart(el(panel, 'stack'), entries, view.cat_month, view.mlabels);
}

// ---- consolidated panel --------------------------------------------------
function renderConsolidated(cons, panel) {
  el(panel, 'caption').innerHTML =
    '<b>Haushalt gesamt:</b> alle Konten zusammengeführt. Interne Überweisungen zwischen deinen eigenen Konten sind herausgerechnet, damit nichts doppelt zählt.';

  el(panel, 'kpis').innerHTML = kpiHTML([
    { lbl: 'Haushaltseinkommen', val: eur(cons.income), cls: 'green', note: meta.year },
    { lbl: 'Ausgaben', val: eur(cons.expenses), cls: 'red', note: `Ø ${eur(Math.round(cons.expenses / 12))}/Monat` },
    { lbl: 'Operativer Saldo', val: (cons.net_op >= 0 ? '+' : '') + eur(cons.net_op), cls: cons.net_op >= 0 ? 'green' : 'red', note: 'Einnahmen − Ausgaben' },
    { lbl: 'Gesamtvermögen', val: eur2(cons.total_balance), cls: 'acc', note: `${cons.accounts.length} Konten` },
  ]);

  el(panel, 'acards').innerHTML = cons.accounts.map(a =>
    `<div class="card acard"><div class="anm">${ROLE_EMOJI[a.role] || '🏦'} ${esc(a.label)}</div>
     <div class="abal">${eur2(a.balance)}</div><div class="hint">Aktueller Stand</div>
     <div class="arow"><span>Δ ${meta.year}</span><span class="${a.net >= 0 ? 'green' : 'red'}">${(a.net >= 0 ? '+' : '') + eur2(a.net)}</span></div></div>`).join('');

  cashflowChart(el(panel, 'cashflow'), cons.mlabels, cons.inc_m, cons.exp_m);

  const entries = sortEntries(cons.cat_total);
  const facct = el(panel, 'facct'), fcat = el(panel, 'fcat'), fmonth = el(panel, 'fmonth'), dtable = el(panel, 'dtable'), count = el(panel, 'count');
  function jump(c) { fcat.value = c; facct.value = ''; render(); el(panel, 'anchor').scrollIntoView({ behavior: 'smooth' }); }
  function render() {
    const ac = facct.value, c = fcat.value, mo = fmonth.value;
    const rows = cons.tx.filter(t => (!ac || t.acct === ac) && (!c || t.c === c) && (!mo || t.mo === mo));
    panel.querySelectorAll('[data-el="cattable"] tr.click').forEach(r => r.classList.toggle('active', r.dataset.cat === c));
    drillTable(dtable, count, rows, { showAcct: !ac, showCat: !c });
  }
  doughnut(el(panel, 'dough'), entries, jump);
  catTable(el(panel, 'cattable'), entries, cons.expenses, jump);
  facct.innerHTML = '<option value="">Alle Konten</option>' + cons.accounts.map(a => `<option value="${esc(a.label)}">${esc(a.label)}</option>`).join('');
  fillCats(fcat, cons.tx);
  fillMonths(fmonth, cons.months, cons.mlabels);
  [facct, fcat, fmonth].forEach(s => s.onchange = render);
  el(panel, 'reset').onclick = () => { facct.value = ''; fcat.value = ''; fmonth.value = ''; render(); };
  render();
  stackChart(el(panel, 'stack'), entries, cons.cat_month, cons.mlabels);
}

// ---- tab assembly --------------------------------------------------------
const tabbar = document.getElementById('tabbar');
const panelsRoot = document.getElementById('panels');
const acctTpl = document.getElementById('tpl-account');
const consTpl = document.getElementById('tpl-consolidated');

const tabs = D.accounts.map(view => ({
  label: `${ROLE_EMOJI[view.role] || '🏦'} ${view.label}${view.shared ? ' 👥' : ''}`,
  build: panel => renderAccount(view, panel),
  tpl: acctTpl,
}));
if (D.consolidated) {
  tabs.push({ label: '🏠 Haushalt gesamt', build: panel => renderConsolidated(D.consolidated, panel), tpl: consTpl });
}

const built = [];
function showTab(i) {
  tabbar.querySelectorAll('.tabbtn').forEach((b, bi) => b.classList.toggle('active', bi === i));
  panelsRoot.querySelectorAll('.tabpanel').forEach((p, pi) => p.classList.toggle('show', pi === i));
  if (!built[i]) { built[i] = true; tabs[i].build(panelsRoot.children[i]); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

tabs.forEach((tab, i) => {
  const btn = document.createElement('button');
  btn.className = 'tabbtn' + (i === 0 ? ' active' : '');
  btn.textContent = tab.label;
  btn.onclick = () => showTab(i);
  tabbar.appendChild(btn);

  const panel = tab.tpl.content.firstElementChild.cloneNode(true);
  if (i === 0) panel.classList.add('show');
  panelsRoot.appendChild(panel);
});

if (tabs.length) showTab(0);
