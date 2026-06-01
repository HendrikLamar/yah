const D=window.__FINANZ_DATA__;
const M=D.m,B=D.b,TX=D.tx,J=D.j,JX=D.jx,CO=D.c,CX=D.cx;
const round2=v=>Math.round(v*100)/100;
const eur=v=>v.toLocaleString('de-DE',{minimumFractionDigits:0,maximumFractionDigits:0})+' €';
const eur2=v=>v.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const C={acc:'#4dabf7',grn:'#51cf66',red:'#ff6b6b',yel:'#ffd43b',vio:'#b197fc',mut:'#8b98a5',
 pal:['#4dabf7','#51cf66','#ffd43b','#ff6b6b','#b197fc','#ffa94d','#63e6be','#f783ac','#a9e34b','#74c0fc','#ffc078','#e599f7','#868e96']};
Chart.defaults.color='#8b98a5';Chart.defaults.font.family="-apple-system,Segoe UI,Roboto,sans-serif";Chart.defaults.borderColor='#2d3742';
const esc=s=>(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

document.getElementById('meta').textContent=`DKB · 3 Konten · 01.01.–31.12.2025 · ${M.n_total+J.n} Buchungen analysiert`;

function initMeine(){
const G=M.accounts.giro,T=M.accounts.tages;
function cardHTML(a,emoji,sel,extraRow){return `<div class="card acard clickcard${sel?' selcard':''}" data-acct="${a.key}">
 <div class="anm">${emoji} ${a.name}</div><div class="aib">${a.iban} · ${a.n} Buchungen${a.key==='tages'?' · nur mit Giro gekoppelt':''}</div>
 <div class="abal">${eur2(a.end2025)}</div><div class="hint">Stand 31.12.2025</div>
 <div class="arow"><span>Δ 2025</span><span class="${a.net>=0?'green':'red'}">${(a.net>=0?'+':'')+eur2(a.net)}</span></div>
 ${extraRow||''}
 <div class="arow"><span>Stand 01.06.2026</span><span>${eur2(a.now)}</span></div></div>`;}
G.key='giro';T.key='tages';
let selAcct='giro', detailChart=null;
function renderCards(){
 document.getElementById('acards').innerHTML=
  cardHTML(G,'🏦',selAcct==='giro','')+
  cardHTML(T,'🐷',selAcct==='tages',`<div class="arow"><span>Zinsertrag 2025</span><span class="green">+${eur2(T.zins)}</span></div>`);
 document.querySelectorAll('#acards .clickcard').forEach(c=>c.onclick=()=>{selAcct=c.dataset.acct;renderCards();renderDetail();});
}
function renderDetail(){
 const isTG=selAcct==='tages', a=isTG?T:G;
 document.getElementById('detailtitle').textContent=`${a.name} im Detail`;
 if(detailChart)detailChart.destroy();
 detailChart=new Chart(detailchart,{type:'line',data:{labels:M.mlabels,datasets:[{label:'Saldo (Monatsende)',data:a.series,
  borderColor:isTG?C.vio:C.acc,backgroundColor:isTG?'rgba(177,151,252,.15)':'rgba(77,171,247,.15)',fill:true,tension:.25,pointRadius:3}]},
  options:{plugins:{legend:{display:false},title:{display:true,text:`Saldoentwicklung ${a.name} 2025`},tooltip:{callbacks:{label:c=>eur2(c.parsed.y)}}},
  scales:{y:{ticks:{callback:v=>eur(v)}}}}});
 if(isTG){
  document.getElementById('detailtable').innerHTML='<table><thead><tr><th>Datum</th><th>Vorgang</th><th>Art</th><th class="num">Betrag</th></tr></thead><tbody>'+
   T.txns.map(t=>{const kc={'Sparen-Zufluss':'tag fix','Entsparen-Abfluss':'tag var','Zinsen':'tag int'}[t.k]||'tag';
    const lbl={'Sparen-Zufluss':'Einzahlung','Entsparen-Abfluss':'Auszahlung','Zinsen':'Zinsen'}[t.k]||t.k;
    return `<tr><td>${t.d}</td><td>${esc(t.z)||esc(t.e)}</td><td><span class="${kc}">${lbl}</span></td><td class="num ${t.a<0?'amt-neg':'amt-pos'}">${eur2(t.a)}</td></tr>`}).join('')+
   `<tr class="sumrow"><td colspan="3">Einzahlungen / Auszahlungen / Zinsen</td><td class="num">+${eur(T.dep)} / −${eur(T.wd)} / +${eur2(T.zins)}</td></tr></tbody></table>`;
 }else{
  const order=["Einnahmen (Gehalt + Erstattungen)","Konsumausgaben","→ Sparen/Anlagen extern","← Anlage-Auszahlung","Darlehen / sonst. Transfers","↔ Interner Transfer Tagesgeld"];
  document.getElementById('detailtable').innerHTML='<div class="hint" style="margin-bottom:8px">Geldflüsse über das Girokonto 2025 (Start '+eur2(G.start2025)+' → Ende '+eur2(G.end2025)+'):</div>'+
   '<table><thead><tr><th>Geldfluss</th><th class="num">Betrag 2025</th></tr></thead><tbody>'+
   order.filter(k=>G.summary[k]!=null).map(k=>`<tr><td>${k}</td><td class="num ${G.summary[k]<0?'amt-neg':'amt-pos'}">${eur2(G.summary[k])}</td></tr>`).join('')+
   `<tr class="sumrow"><td>Netto-Veränderung</td><td class="num ${G.net<0?'amt-neg':'amt-pos'}">${eur2(G.net)}</td></tr></tbody></table>`+
   '<div class="hint" style="margin-top:8px">Einzelbuchungen des Girokontos siehst du unten unter „Einzelbuchungen" (Kontofilter = Girokonto).</div>';
 }
}
renderCards();renderDetail();

const kpis=[
 {lbl:'Echtes Einkommen',val:eur(M.echtes_eink),cls:'green',note:`Gehalt ${eur(M.gehalt_total)} + Erstatt. ${eur(M.erstatt_total)} + Zinsen`},
 {lbl:'Konsumausgaben',val:eur(M.konsum_total),cls:'red',note:`Ø ${eur(Math.round(M.konsum_total/12))}/Monat`},
 {lbl:'Operativer Saldo',val:(M.net_operativ>=0?'+':'')+eur(M.net_operativ),cls:M.net_operativ>=0?'green':'red',note:'Einkommen − Konsum'},
 {lbl:'Netto-Vermögensaufbau',val:(M.netto_verm>=0?'+':'')+eur(M.netto_verm),cls:M.netto_verm>=0?'acc':'red',note:`Sparquote ${M.sparquote} % · brutto gespart ${eur(M.spar_brutto)}`},
];
document.getElementById('kpis').innerHTML=kpis.map(k=>`<div class="card kpi"><div class="lbl">${k.lbl}</div><div class="val ${k.cls}">${k.val}</div><div class="note">${k.note}</div></div>`).join('');
document.getElementById('caveat').innerHTML=`<b>Wichtig – Korrektur durch das Tagesgeldkonto:</b> Mit dem zweiten Konto lassen sich interne Übertragungen sauber erkennen. Dadurch wurden <b>${eur(M.income_correction)}</b>, die vorher fälschlich als Einnahme galten, als Rücktransfers vom Tagesgeld entlarvt. Das echte Einkommen sinkt entsprechend, und der operative Saldo ist mit <b>${eur(M.net_operativ)}</b> leicht negativ: Der laufende Konsum lag 2025 etwas über dem verdienten Geld. Gedeckt wurde die Lücke über Anlage-Auszahlungen (${eur(M.anlage_ausz)} von Scalable) und Bewegungen auf dem Tagesgeld. Netto wuchs das Vermögen dennoch um ${eur(M.netto_verm)}, das Tagesgeld allein um +${eur(T.net)}.`;

new Chart(cashflow,{type:'bar',data:{labels:M.mlabels,datasets:[
 {label:'Gehalt',data:M.gehalt_m,backgroundColor:C.grn,stack:'in'},
 {label:'Erstattungen + Zinsen',data:M.erstatt_m,backgroundColor:'#2f9e44',stack:'in'},
 {label:'Konsum',data:M.konsum_m.map(v=>-v),backgroundColor:C.red,stack:'out'},
 {type:'line',label:'Operativer Saldo',data:M.net_m,borderColor:C.yel,backgroundColor:C.yel,tension:.3,pointRadius:3,fill:false}
]},options:{responsive:true,scales:{y:{ticks:{callback:v=>eur(v)}},x:{stacked:true}},
 plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+eur2(Math.abs(c.parsed.y))}}}}});

const catEntries=Object.entries(M.cat_total).sort((a,b)=>b[1]-a[1]);
const catMax=catEntries[0][1];
new Chart(catdough,{type:'doughnut',data:{labels:catEntries.map(e=>e[0]),datasets:[{data:catEntries.map(e=>e[1]),backgroundColor:C.pal,borderWidth:1,borderColor:'#1a2027'}]},
 options:{onClick:(e,el)=>{if(el.length)selectCat(catEntries[el[0].index][0]);},
 plugins:{legend:{position:'right',labels:{boxWidth:11,font:{size:11}},onClick:(e,li)=>selectCat(catEntries[li.index][0])},
 tooltip:{callbacks:{label:c=>c.label+': '+eur2(c.parsed)}}}}});
document.getElementById('cattable').innerHTML='<table><thead><tr><th>Kategorie</th><th class="num">Jahr</th><th class="num">Ø/Mt</th><th class="num">Anteil</th></tr></thead><tbody>'+
 catEntries.map(([k,v])=>`<tr class="click" data-cat="${k}"><td>${k}</td><td class="num">${eur(v)}</td><td class="num">${eur(Math.round(v/12))}</td><td class="num">${(v/M.konsum_total*100).toFixed(0)}%<div class="bar"><i style="width:${v/catMax*100}%"></i></div></td></tr>`).join('')+
 `<tr class="sumrow"><td>Summe Konsum</td><td class="num">${eur(M.konsum_total)}</td><td class="num">${eur(Math.round(M.konsum_total/12))}</td><td class="num">100%</td></tr></tbody></table>`;
document.querySelectorAll('#cattable tr.click').forEach(r=>r.onclick=()=>selectCat(r.dataset.cat));

const allCats=[...new Set(TX.map(t=>t.c))].sort();
const facct=document.getElementById('facct'),fcat=document.getElementById('fcat'),fmonth=document.getElementById('fmonth'),dtable=document.getElementById('dtable'),dcount=document.getElementById('dcount');
facct.innerHTML='<option value="">Alle Konten</option><option value="Giro">Girokonto</option><option value="Tagesgeld">Tagesgeldkonto</option>';
fcat.innerHTML='<option value="">Alle Kategorien</option>'+allCats.map(c=>`<option value="${c}">${c}</option>`).join('');
fmonth.innerHTML='<option value="">Ganzes Jahr</option>'+M.months.map((mo,i)=>`<option value="${mo}">${M.mlabels[i]} 2025</option>`).join('');
[facct,fcat,fmonth].forEach(s=>s.onchange=render);
document.getElementById('resetbtn').onclick=()=>{facct.value='';fcat.value='';fmonth.value='';render();};
function selectCat(c){fcat.value=c;facct.value='';render();document.getElementById('detail').scrollIntoView({behavior:'smooth'});}
function render(){
 const ac=facct.value,c=fcat.value,mo=fmonth.value;
 let rows=TX.filter(t=>(!ac||t.acct===ac)&&(!c||t.c===c)&&(!mo||t.mo===mo));
 rows.sort((a,b)=>a.a-b.a);
 const sO=rows.filter(r=>r.a<0).reduce((s,r)=>s+r.a,0),sI=rows.filter(r=>r.a>0).reduce((s,r)=>s+r.a,0);
 document.querySelectorAll('#cattable tr.click').forEach(r=>r.classList.toggle('active',r.dataset.cat===c));
 dcount.textContent=`${rows.length} Buchungen`;
 if(!rows.length){dtable.innerHTML='<div class="empty">Keine Buchungen für diese Auswahl.</div>';return;}
 const showCat=!c, showAcct=!ac;
 const span=1+(showAcct?1:0)+(showCat?1:0)+1;
 dtable.innerHTML='<table><thead><tr><th>Datum</th>'+(showAcct?'<th>Konto</th>':'')+(showCat?'<th>Kategorie</th>':'')+'<th>Empfänger / Auftraggeber</th><th>Verwendungszweck</th><th class="num">Betrag</th></tr></thead><tbody>'+
  (sO<0?`<tr class="sumrow"><td colspan="${span}">Summe Ausgaben</td><td class="num amt-neg">${eur2(sO)}</td></tr>`:'')+
  (sI>0?`<tr class="sumrow"><td colspan="${span}">Summe Eingänge</td><td class="num amt-pos">${eur2(sI)}</td></tr>`:'')+
  rows.map(r=>`<tr><td>${r.d}</td>`+(showAcct?`<td class="mut">${r.acct}</td>`:'')+(showCat?`<td class="mut">${r.c}${r.int?' <span class="tag int">intern</span>':''}</td>`:'')+`<td>${esc(r.e)}</td><td class="mut">${esc(r.z)}</td><td class="num ${r.a<0?'amt-neg':'amt-pos'}">${eur2(r.a)}</td></tr>`).join('')+
  '</tbody></table>';
}
render();

const stackCats=catEntries.slice(0,6).map(e=>e[0]);
const ds=stackCats.map((c,i)=>({label:c,data:M.cat_month[c],backgroundColor:C.pal[i]}));
const restData=M.mlabels.map((_,mi)=>catEntries.slice(6).reduce((s,[c])=>s+(M.cat_month[c]?M.cat_month[c][mi]:0),0));
ds.push({label:'Übrige',data:restData,backgroundColor:C.mut});
new Chart(catstack,{type:'bar',data:{labels:M.mlabels,datasets:ds},
 options:{responsive:true,scales:{x:{stacked:true},y:{stacked:true,ticks:{callback:v=>eur(v)}}},
 plugins:{legend:{labels:{boxWidth:11,font:{size:11}}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+eur2(c.parsed.y)}}}}});

document.getElementById('subtable').innerHTML='<table><thead><tr><th>Anbieter</th><th class="num">Buchungen</th><th class="num">Ø Betrag</th><th class="num">2025 gesamt</th><th class="num">Hochger. /Jahr</th></tr></thead><tbody>'+
 M.subs.map(s=>{const a=s.count>=6?Math.round(s.avg*12):s.total;return `<tr><td>${s.name}</td><td class="num">${s.count}</td><td class="num">${eur2(s.avg)}</td><td class="num">${eur2(s.total)}</td><td class="num">${eur(a)}</td></tr>`}).join('')+'</tbody></table>';

const bcats=Object.keys(B.budget),fixSet=new Set(B.fix),bsorted=bcats.sort((a,b)=>B.budget[b]-B.budget[a]);
new Chart(budgetchart,{type:'bar',data:{labels:bsorted,datasets:[{label:'€/Monat',data:bsorted.map(c=>B.budget[c]),backgroundColor:bsorted.map(c=>fixSet.has(c)?C.yel:C.acc)}]},
 options:{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>eur2(c.parsed.x)+'/Mt'}}},scales:{x:{ticks:{callback:v=>eur(v)}}}}});
document.getElementById('budgettable').innerHTML='<table><thead><tr><th>Kategorie</th><th>Typ</th><th class="num">€ / Monat</th></tr></thead><tbody>'+
 bsorted.map(c=>`<tr><td>${c}</td><td><span class="tag ${fixSet.has(c)?'fix':'var'}">${fixSet.has(c)?'fix':'variabel'}</span></td><td class="num">${eur(B.budget[c])}</td></tr>`).join('')+
 `<tr class="sumrow"><td>Fixkosten</td><td></td><td class="num yel">${eur(B.fix_sum)}</td></tr>`+
 `<tr class="sumrow"><td>Variable Kosten</td><td></td><td class="num acc">${eur(B.var_sum)}</td></tr>`+
 `<tr class="sumrow"><td>Gesamt-Budget</td><td></td><td class="num">${eur(B.fix_sum+B.var_sum)}</td></tr></tbody></table>`;
document.getElementById('budgetnote').innerHTML=`Bei Ø <b>${eur(B.gehalt_mo)}/Monat</b> Netto-Gehalt liegt das Konsum-Budget von <b>${eur(B.fix_sum+B.var_sum)}/Monat</b> rund ${eur(Math.abs(B.gehalt_mo-(B.fix_sum+B.var_sum)))} darüber – 2025 wurde die Lücke über Erstattungen und Vermögens-Rückflüsse gedeckt. Größter Hebel: <b>Shopping & Sonstiges</b> und <b>Kreditkarte (AMEX)</b>. Tipp: einen festen Sparbetrag direkt zu Monatsbeginn aufs Tagesgeld buchen ("pay yourself first") statt nur den Rest.`;
}/* end initMeine */

// ===== shared helpers =====
function drillRender(el,countEl,rows,opt){opt=opt||{};
 rows=rows.slice().sort((a,b)=>a.a-b.a);
 const sO=rows.filter(r=>r.a<0).reduce((s,r)=>s+r.a,0),sI=rows.filter(r=>r.a>0).reduce((s,r)=>s+r.a,0);
 countEl.textContent=`${rows.length} Buchungen`;
 if(!rows.length){el.innerHTML='<div class="empty">Keine Buchungen für diese Auswahl.</div>';return;}
 const cols=1+(opt.showSrc?1:0)+(opt.showCat?1:0)+1;
 el.innerHTML='<table><thead><tr><th>Datum</th>'+(opt.showSrc?'<th>Quelle</th>':'')+(opt.showCat?'<th>Kategorie</th>':'')+'<th>Empfänger / Auftraggeber</th><th>Verwendungszweck</th><th class="num">Betrag</th></tr></thead><tbody>'+
  (sO<0?`<tr class="sumrow"><td colspan="${cols}">Summe Ausgaben</td><td class="num amt-neg">${eur2(sO)}</td></tr>`:'')+
  (sI>0?`<tr class="sumrow"><td colspan="${cols}">Summe Eingänge</td><td class="num amt-pos">${eur2(sI)}</td></tr>`:'')+
  rows.map(r=>`<tr><td>${r.d}</td>`+(opt.showSrc?`<td class="mut">${r.src}</td>`:'')+(opt.showCat?`<td class="mut">${r.c}</td>`:'')+`<td>${esc(r.e)}</td><td class="mut">${esc(r.z)}</td><td class="num ${r.a<0?'amt-neg':'amt-pos'}">${eur2(r.a)}</td></tr>`).join('')+
  '</tbody></table>';
}
function doughnut(canvas,entries,onClick){return new Chart(canvas,{type:'doughnut',data:{labels:entries.map(e=>e[0]),datasets:[{data:entries.map(e=>e[1]),backgroundColor:C.pal,borderWidth:1,borderColor:'#1a2027'}]},
 options:{onClick:(e,el)=>{if(el.length&&onClick)onClick(entries[el[0].index][0]);},
 plugins:{legend:{position:'right',labels:{boxWidth:11,font:{size:11}},onClick:(e,li)=>{if(onClick)onClick(entries[li.index][0]);}},
 tooltip:{callbacks:{label:c=>c.label+': '+eur2(c.parsed)}}}}});}
function catTable(el,entries,total,onClick,selId){const max=entries[0][1];
 el.innerHTML='<table><thead><tr><th>Kategorie</th><th class="num">Jahr</th><th class="num">Ø/Mt</th><th class="num">Anteil</th></tr></thead><tbody>'+
  entries.map(([k,v])=>`<tr class="click" data-cat="${k}"><td>${k}</td><td class="num">${eur(v)}</td><td class="num">${eur(Math.round(v/12))}</td><td class="num">${(v/total*100).toFixed(0)}%<div class="bar"><i style="width:${v/max*100}%"></i></div></td></tr>`).join('')+
  `<tr class="sumrow"><td>Summe Ausgaben</td><td class="num">${eur(total)}</td><td class="num">${eur(Math.round(total/12))}</td><td class="num">100%</td></tr></tbody></table>`;
 el.querySelectorAll('tr.click').forEach(r=>r.onclick=()=>onClick(r.dataset.cat));}
function stackChart(canvas,entries,catMonth,labels){const top=entries.slice(0,6).map(e=>e[0]);
 const ds=top.map((c,i)=>({label:c,data:catMonth[c],backgroundColor:C.pal[i]}));
 const rest=labels.map((_,mi)=>entries.slice(6).reduce((s,e)=>s+((catMonth[e[0]]||[])[mi]||0),0));
 if(entries.length>6)ds.push({label:'Übrige',data:rest,backgroundColor:C.mut});
 return new Chart(canvas,{type:'bar',data:{labels,datasets:ds},options:{scales:{x:{stacked:true},y:{stacked:true,ticks:{callback:v=>eur(v)}}},plugins:{legend:{labels:{boxWidth:11,font:{size:11}}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+eur2(c.parsed.y)}}}}});}

// ===== Tab 2: Gemeinschaftskonto =====
function initJoint(){const labels=J.mlabels;
 const k=[
  {lbl:'Einzahlungen gesamt',val:eur(J.einn_total),cls:'green',note:`Sina ${eur(J.sina_total)} · Hendrik ${eur(J.hendrik_total)}`},
  {lbl:'Ausgaben gesamt',val:eur(J.ausg_total),cls:'red',note:'inkl. großer Einmalposten'},
  {lbl:'Laufende Ausgaben',val:eur(J.ausg_laufend),cls:'red',note:`Ø ${eur(Math.round(J.ausg_laufend/12))}/Monat (ohne Einmalposten)`},
  {lbl:'Beitrag Sina : Hendrik',val:`${J.sina_share} : ${(100-J.sina_share).toFixed(1)}`,cls:'acc',note:'Anteil an den Einzahlungen (%)'},
 ];
 jkpis.innerHTML=k.map(x=>`<div class="card kpi"><div class="lbl">${x.lbl}</div><div class="val ${x.cls}">${x.val}</div><div class="note">${x.note}</div></div>`).join('');
 jcaveat.innerHTML=`<b>Gemeinschaftskonto:</b> Beide zahlen ein (Sina ${eur(J.sina_total)}, du ${eur(J.hendrik_total)}), davon laufen Miete, Kita, Lebensmittel & Co. Deine Einzahlungen erscheinen auch in deinem Giro als Ausgabe – das ist gewollt (dein Haushaltsanteil) und wird hier <b>nicht</b> herausgerechnet. Der große Einmalposten ist der Wohnmobilkauf (${eur(J.cat_total['Große Einmalposten']||20000)}).`;
 jacctib.textContent=`DE55 … 0491 · ${J.n} Buchungen`;
 jacctbal.textContent=eur2(J.end2025);
 jacctnet.textContent=(J.net>=0?'+':'')+eur2(J.net); jacctnet.className=J.net>=0?'green':'red';
 jacctnow.textContent=eur2(J.now);
 jsplitnote.innerHTML=`<div class="hint">Beitrag zu den Einzahlungen:</div><div style="font-size:16px;font-weight:600;margin-top:4px"><span class="vio">Sina ${J.sina_share}%</span> &nbsp;·&nbsp; <span class="acc">Hendrik ${(100-J.sina_share).toFixed(1)}%</span></div>`;
 new Chart(jsplitchart,{type:'bar',data:{labels,datasets:[
   {label:'Sina',data:J.inc_sina,backgroundColor:C.vio,stack:'in'},
   {label:'Hendrik',data:J.inc_hendrik,backgroundColor:C.acc,stack:'in'},
   {label:'extern',data:J.inc_ext,backgroundColor:C.mut,stack:'in'}]},
   options:{plugins:{title:{display:true,text:'Einzahlungen pro Monat'},legend:{labels:{boxWidth:11}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+eur2(c.parsed.y)}}},scales:{x:{stacked:true},y:{stacked:true,ticks:{callback:v=>eur(v)}}}}});
 const jnet=labels.map((_,i)=>round2(J.inc_sina[i]+J.inc_hendrik[i]+J.inc_ext[i]-J.ausg_m[i]));
 new Chart(jcashflow,{type:'bar',data:{labels,datasets:[
   {label:'Einzahlung Sina',data:J.inc_sina,backgroundColor:C.vio,stack:'in'},
   {label:'Einzahlung Hendrik',data:J.inc_hendrik,backgroundColor:C.acc,stack:'in'},
   {label:'extern',data:J.inc_ext,backgroundColor:'#2f9e44',stack:'in'},
   {label:'Ausgaben',data:J.ausg_m.map(v=>-v),backgroundColor:C.red,stack:'out'},
   {type:'line',label:'Saldo',data:jnet,borderColor:C.yel,backgroundColor:C.yel,tension:.3,pointRadius:3,fill:false}]},
   options:{scales:{x:{stacked:true},y:{ticks:{callback:v=>eur(v)}}},plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+eur2(Math.abs(c.parsed.y))}}}}});
 const entries=Object.entries(J.cat_total).sort((a,b)=>b[1]-a[1]);
 doughnut(jcatdough,entries,jSelCat);
 catTable(jcattable,entries,J.ausg_total,jSelCat);
 const cats=[...new Set(JX.map(t=>t.c))].sort();
 jfcat.innerHTML='<option value="">Alle Kategorien</option>'+cats.map(c=>`<option value="${c}">${c}</option>`).join('');
 jfmonth.innerHTML='<option value="">Ganzes Jahr</option>'+J.months.map((mo,i)=>`<option value="${mo}">${labels[i]} 2025</option>`).join('');
 [jfcat,jfmonth].forEach(s=>s.onchange=jRender);
 jreset.onclick=()=>{jfcat.value='';jfmonth.value='';jRender();};
 jRender();
 stackChart(jcatstack,entries,J.cat_month,labels);
}
function jSelCat(c){jfcat.value=c;jRender();document.getElementById('jdetail').scrollIntoView({behavior:'smooth'});}
function jRender(){const c=jfcat.value,mo=jfmonth.value;
 let rows=JX.filter(t=>(!c||t.c===c)&&(!mo||t.mo===mo));
 document.querySelectorAll('#jcattable tr.click').forEach(r=>r.classList.toggle('active',r.dataset.cat===c));
 drillRender(jdtable,jdcount,rows,{showCat:!c});}

// ===== Tab 3: Haushalt gesamt =====
function initConsol(){const labels=CO.mlabels;
 const k=[
  {lbl:'Haushaltseinkommen',val:eur(CO.comb_inc_tot),cls:'green',note:`Hendrik ${eur(CO.hendrik_eink_tot)} · Sina ${eur(CO.sina_tot)}`},
  {lbl:'Laufende Ausgaben',val:eur(CO.comb_exp_laufend),cls:'red',note:`Ø ${eur(Math.round(CO.comb_exp_laufend/12))}/Monat`},
  {lbl:'Operativer Saldo (laufend)',val:(CO.comb_net_op>=0?'+':'')+eur(CO.comb_net_op),cls:CO.comb_net_op>=0?'green':'red',note:'Einkommen − laufende Ausgaben'},
  {lbl:'Große Einmalposten',val:eur(CO.einmal),cls:'yel',note:'Wohnmobilkauf 2025'},
 ];
 ckpis.innerHTML=k.map(x=>`<div class="card kpi"><div class="lbl">${x.lbl}</div><div class="val ${x.cls}">${x.val}</div><div class="note">${x.note}</div></div>`).join('');
 ccaveat.innerHTML=`<b>Haushalt gesamt – konsolidiert:</b> Deine Konten (Giro + Tagesgeld) und das Gemeinschaftskonto zusammengeführt; interne Überweisungen (deine Beiträge ans Gemeinschaftskonto und Giro↔Tagesgeld) sind herausgerechnet, damit nichts doppelt zählt. Einkommen = dein Verdienst (${eur(CO.hendrik_eink_tot)}) + Sinas Einzahlungen (${eur(CO.sina_tot)}). Ausgaben = deine persönlichen Ausgaben (${eur(CO.hendrik_personal_tot)}) + echte Haushaltsausgaben (${eur(CO.joint_tot)}). <b>Ohne</b> den einmaligen Wohnmobilkauf bleibt ein Überschuss von <b>${eur(CO.comb_net_op)}</b>; inklusive landet ihr bei ${eur(CO.comb_net_all)}.`;
 const incE=[['Hendrik (Verdienst)',CO.hendrik_eink_tot],['Sina (Einzahlungen)',CO.sina_tot]];
 if(CO.ext_tot>0)incE.push(['extern',CO.ext_tot]);
 new Chart(cincchart,{type:'doughnut',data:{labels:incE.map(e=>e[0]),datasets:[{data:incE.map(e=>e[1]),backgroundColor:[C.acc,C.vio,C.mut],borderWidth:1,borderColor:'#1a2027'}]},
  options:{plugins:{legend:{position:'right',labels:{boxWidth:11}},tooltip:{callbacks:{label:c=>c.label+': '+eur2(c.parsed)}}}}});
 cinctable.innerHTML='<table><thead><tr><th>Quelle</th><th class="num">Jahr</th><th class="num">Anteil</th></tr></thead><tbody>'+
  incE.map(e=>`<tr><td>${e[0]}</td><td class="num">${eur(e[1])}</td><td class="num">${(e[1]/CO.comb_inc_tot*100).toFixed(0)}%</td></tr>`).join('')+
  `<tr class="sumrow"><td>Gesamt</td><td class="num">${eur(CO.comb_inc_tot)}</td><td class="num">100%</td></tr></tbody></table>`;
 new Chart(ccashflow,{type:'bar',data:{labels,datasets:[
   {label:'Hendrik Verdienst',data:CO.hendrik_eink_m,backgroundColor:C.acc,stack:'in'},
   {label:'Sina Einzahlung',data:CO.sina_m,backgroundColor:C.vio,stack:'in'},
   {label:'extern',data:CO.ext_m,backgroundColor:'#2f9e44',stack:'in'},
   {label:'Ausgaben',data:CO.comb_exp_m.map(v=>-v),backgroundColor:C.red,stack:'out'},
   {type:'line',label:'Saldo',data:CO.comb_net_m,borderColor:C.yel,backgroundColor:C.yel,tension:.3,pointRadius:3,fill:false}]},
   options:{scales:{x:{stacked:true},y:{ticks:{callback:v=>eur(v)}}},plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+eur2(Math.abs(c.parsed.y))}}}}});
 const entries=Object.entries(CO.cat_total).sort((a,b)=>b[1]-a[1]);
 doughnut(ccatdough,entries,cSelCat);
 catTable(ccattable,entries,CO.comb_exp_tot,cSelCat);
 const cats=[...new Set(CX.map(t=>t.c))].sort();
 cfsrc.innerHTML='<option value="">Alle Quellen</option><option value="Hendrik">Hendrik (persönlich)</option><option value="Gemeinschaft">Gemeinschaftskonto</option>';
 cfcat.innerHTML='<option value="">Alle Kategorien</option>'+cats.map(c=>`<option value="${c}">${c}</option>`).join('');
 cfmonth.innerHTML='<option value="">Ganzes Jahr</option>'+CO.months.map((mo,i)=>`<option value="${mo}">${labels[i]} 2025</option>`).join('');
 [cfsrc,cfcat,cfmonth].forEach(s=>s.onchange=cRender);
 creset.onclick=()=>{cfsrc.value='';cfcat.value='';cfmonth.value='';cRender();};
 cRender();
 stackChart(ccatstack,entries,CO.cat_month,labels);
}
function cSelCat(c){cfcat.value=c;cfsrc.value='';cRender();document.getElementById('cdetail').scrollIntoView({behavior:'smooth'});}
function cRender(){const sr=cfsrc.value,c=cfcat.value,mo=cfmonth.value;
 let rows=CX.filter(t=>(!sr||t.src===sr)&&(!c||t.c===c)&&(!mo||t.mo===mo));
 document.querySelectorAll('#ccattable tr.click').forEach(r=>r.classList.toggle('active',r.dataset.cat===c));
 drillRender(cdtable,cdcount,rows,{showSrc:!sr,showCat:!c});}

// ===== Tab switching =====
const inited={meine:true};
function showTab(name){
 document.querySelectorAll('.tabpanel').forEach(p=>p.classList.toggle('show',p.id==='tab-'+name));
 document.querySelectorAll('.tabbtn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
 if(!inited[name]){inited[name]=true;({gemeinschaft:initJoint,haushalt:initConsol})[name]();}
 window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.tabbtn').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));

initMeine();
document.getElementById('foot').textContent='Analyse automatisch erstellt aus den DKB-Umsatzlisten (Giro, Tagesgeld, Gemeinschaftskonto). Interne Transfers per Gegenkonto-IBAN erkannt. Kategorisierung über Empfänger & Verwendungszweck – einzelne Buchungen können abweichen.';