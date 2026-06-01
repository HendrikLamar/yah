import json
from collections import defaultdict, Counter
U=json.load(open("unified.json"))
giro=U['giro']; tages=U['tages']
prev=json.load(open("metrics.json"))

def classify(t):
    e=t['emp'].lower(); z=t['zweck'].lower(); full=e+" | "+z
    if t['internal']: return ("Interner Transfer (Tagesgeld)","Intern")
    if t['typ']=="Eingang":
        if "lohn" in z or "gehalt" in z: return ("Einnahmen · Gehalt","Einnahmen")
        if "scalable" in z: return ("Anlage-Auszahlung (Scalable)","Entsparen")
        if "kapitalanlage" in z or "gesellschafterdarlehen" in z or z=="umbuchen" or "umbuch" in z: return ("Darlehen / sonst. Transfer","Transfers")
        if z.startswith("sf-") or "sf-b" in z or "sf-r" in z or "erstattung" in z or "tk-beleg" in z or "beitragserstattung" in z or "nachzahlung" in z or "druck.at" in z: return ("Einnahmen · Erstattungen","Einnahmen")
        if "paypal" in z or "abbuchung" in z: return ("Einnahmen · Erstattungen","Einnahmen")
        return ("Einnahmen · Erstattungen","Einnahmen")
    if "scalable" in full or ("herr hendrik windel" in e and "sparen" in z) or "huw invest" in e or "kapitalrücklage" in z or "scalable instant" in z:
        return ("Sparen & Investitionen","Vermögen")
    if "myotwin" in e and "gesellschafterdarlehen" in z: return ("Darlehen / sonst. Transfer","Transfers")
    if e in ("hendrik windel","hendrik uwe windel","herr hendrik windel") and (z=="" or "scalable" in z):
        return ("Sparen & Investitionen","Vermögen")
    if "sina unseld" in e:
        if "womo" in z: return ("Shopping & Sonstiges","Konsum")
        if "darl" in z: return ("Kredite & Darlehen","Konsum")
        return ("Wohnen & Haushalt","Konsum")
    if "ewe" in z: return ("Wohnen & Haushalt","Konsum")
    if "bundeskasse" in e: return ("Kredite & Darlehen","Konsum")
    if any(k in e for k in ["nurnberger leben","barmenia","envivas","versicherung","lebensvers"]): return ("Versicherungen","Konsum")
    if "american express" in e: return ("Kreditkarte (AMEX)","Konsum")
    if "georg-august-uni" in e and "sport" in z: return ("Abos & Medien","Konsum")
    abos=["spotify","disneyplus","disney","netflix","frankfurter allgemeine","faz","spiegel","heise","göttinger tageblatt","gottinger tageblatt","goettinger.tagebla","fraenk","bitwarden","hetzner","amazon media","amazon digital","kindle","audible","prime","fiverr","stickerapp"]
    if any(k in full for k in abos): return ("Abos & Medien","Konsum")
    food=["lidl","rewe","penny","norma","edeka","kaufland","aldi","dm.drogerie","rossmann","backerei","baeckerei","hofpfisterei","feinbackerei","thiele","muehlenbaeck","viani","fausto kaffee","kr.nahvers","nahversorgung","yormas","bro.s.markt","fam..coop","amambiente","dtv.tabak"]
    if any(k in full for k in food): return ("Lebensmittel & Drogerie","Konsum")
    mob=["tankstelle","classic.tank","shell","esso","total.service","aspit","brennero","trento","mantova","gavio","db.vertrieb","db vertrieb","db.fernverkehr","db.s","deutsche bahn","mvg","bvg","u4.vienna","call.a.bike","lime.fahrt","bolt.eu","bolt.eur","parkster","park.parchi","riverty.com.bvg","fahrzeugtechnik","weezevent","ticket.io","eventim","cinemaxx","hallenbad","naturerlebnisbad","knattercamping"]
    if any(k in full for k in mob): return ("Mobilität & Reise","Konsum")
    if any(k in full for k in ["apotheke","zahnarzt","praxis dr","hupach","fitness.first"]): return ("Gesundheit","Konsum")
    gastro=["burger.king","burger king","mcdonald","istanbull","bistro","gastronomie","hans.im.glueck","espresso.house","restfreizeit","htl.rest","kurdische.bistro","chili","chi.thu","quick.service","waldwirtschaft","zimtschnecken","bazis","olmo","pasticceria","manner","leboq","safkan","theil.gastro","storia","el.punto","la.baracchina","valcanover","gnp.calceran","so.pe.ti","fritz.berger.freizeit","sumup","espresso","kaffee","baracchina"]
    if any(k in full for k in gastro): return ("Restaurants & Gastronomie","Konsum")
    if any(k in full for k in ["gaa","sb.ellieh","markt4.5.8","fischmarkt","indu.gaa","kaufland.goe","greismar","sparkasse.","volksbank.ks","deutsche.bank.ag/goet",".deutsche.bank"]): return ("Bargeld","Bargeld")
    if any(k in full for k in ["amnesty","wikimedia","mariana cannabis","philisterverein","gna ev","ipp-sozialwerk","sozialwerk","aenania","spc.wannda","dr..eckart"]): return ("Spenden & Beiträge","Konsum")
    if any(k in full for k in ["bundeskasse","stadtkasse","stadt duderstadt","landkreis","georg-august-uni","dkb ag","toto-lotto","toto.lotto","gez","rundfunk"]): return ("Steuern & Gebühren","Konsum")
    return ("Shopping & Sonstiges","Konsum")

def classify_tg(t):
    if t['kind']=="Zinsen": return ("Einnahmen · Zinsen","Einnahmen")
    if t['kind']=="Sparen-Zufluss": return ("Sparen (Tagesgeld-Einzahlung)","Vermögen")
    if t['kind']=="Entsparen-Abfluss": return ("Entsparen (Tagesgeld-Auszahlung)","Entsparen")
    return ("Sonstige","Sonstige")

for t in giro: t['cat'],t['grp']=classify(t)
for t in tages: t['cat'],t['grp']=classify_tg(t)
all_tx=giro+tages
MONTHS=[f"2025-{m:02d}" for m in range(1,13)]
ML=["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"]

gehalt_m=defaultdict(float); erstatt_m=defaultdict(float); zins_m=defaultdict(float)
for t in giro:
    if t['cat']=="Einnahmen · Gehalt": gehalt_m[t['month']]+=t['amt']
    elif t['cat']=="Einnahmen · Erstattungen": erstatt_m[t['month']]+=t['amt']
for t in tages:
    if t['cat']=="Einnahmen · Zinsen": zins_m[t['month']]+=t['amt']

KONSUM=["Wohnen & Haushalt","Kredite & Darlehen","Lebensmittel & Drogerie","Versicherungen",
 "Abos & Medien","Mobilität & Reise","Restaurants & Gastronomie","Gesundheit",
 "Shopping & Sonstiges","Kreditkarte (AMEX)","Bargeld","Spenden & Beiträge","Steuern & Gebühren"]
cat_month=defaultdict(lambda:defaultdict(float)); cat_total=defaultdict(float); cat_n=Counter()
for t in giro:
    if t['cat'] in KONSUM and t['amt']<0:
        cat_month[t['cat']][t['month']]+=-t['amt']; cat_total[t['cat']]+=-t['amt']; cat_n[t['cat']]+=1
konsum_m={m:sum(cat_month[c][m] for c in KONSUM) for m in MONTHS}
konsum_total=sum(cat_total.values())
gehalt_total=sum(gehalt_m.values()); erstatt_total=sum(erstatt_m.values()); zins_total=sum(zins_m.values())
echtes_eink=gehalt_total+erstatt_total+zins_total
net_m=[round(gehalt_m[m]+erstatt_m[m]+zins_m[m]-konsum_m[m],2) for m in MONTHS]
net_operativ=echtes_eink-konsum_total

# Vermögen
spar_ext=sum(-t['amt'] for t in giro if t['cat']=="Sparen & Investitionen")
spar_tg_dep=sum(t['amt'] for t in tages if t['cat']=="Sparen (Tagesgeld-Einzahlung)")
tg_wd=sum(-t['amt'] for t in tages if t['cat']=="Entsparen (Tagesgeld-Auszahlung)")
anlage_ausz=sum(t['amt'] for t in giro if t['cat']=="Anlage-Auszahlung (Scalable)")
spar_brutto=spar_ext+spar_tg_dep
entsparen=tg_wd+anlage_ausz
netto_verm=spar_brutto-entsparen
sparquote=round(netto_verm/echtes_eink*100,1) if echtes_eink else 0

# Accounts anchored to end-2025
giro_end2025=3466.11; giro_net=round(sum(t['amt'] for t in giro),2); giro_start2025=round(giro_end2025-giro_net,2)
tg_end2025=3293.62; tg_net=round(sum(t['amt'] for t in tages),2); tg_start2025=round(tg_end2025-tg_net,2)
by_month=defaultdict(float)
for t in tages: by_month[t['month']]+=t['amt']
cum=tg_start2025; tg_series=[]
for m in MONTHS:
    cum+=by_month[m]; tg_series.append(round(cum,2))

# Tagesgeld txn list (display)
tg_list=[{"d":t['date'],"e":t['emp'][:34],"z":t['zweck'][:46],"a":t['amt'],"k":t['kind']} for t in sorted(tages,key=lambda x:x['date'])]

out=dict(
 months=MONTHS, mlabels=ML,
 gehalt_m=[round(gehalt_m[m],2) for m in MONTHS],
 erstatt_m=[round(erstatt_m[m]+zins_m[m],2) for m in MONTHS],
 konsum_m=[round(konsum_m[m],2) for m in MONTHS],
 net_m=net_m,
 cat_total={c:round(cat_total[c],2) for c in KONSUM},
 cat_n={c:cat_n[c] for c in KONSUM},
 cat_month={c:[round(cat_month[c][m],2) for m in MONTHS] for c in KONSUM},
 gehalt_total=round(gehalt_total,2),erstatt_total=round(erstatt_total,2),zins_total=round(zins_total,2),
 echtes_eink=round(echtes_eink,2),konsum_total=round(konsum_total,2),net_operativ=round(net_operativ,2),
 spar_ext=round(spar_ext,2),spar_tg_dep=round(spar_tg_dep,2),tg_wd=round(tg_wd,2),anlage_ausz=round(anlage_ausz,2),
 spar_brutto=round(spar_brutto,2),entsparen=round(entsparen,2),netto_verm=round(netto_verm,2),sparquote=sparquote,
 subs=prev['subs'],
 accounts=dict(
   giro=dict(name="Girokonto",iban="DE30 … 3144",end2025=giro_end2025,net=giro_net,start2025=giro_start2025,now=1909.08,n=len(giro)),
   tages=dict(name="Tagesgeldkonto",iban="DE62 … 8935",end2025=tg_end2025,net=tg_net,start2025=tg_start2025,now=2905.22,
              n=len(tages),zins=round(zins_total,2),dep=round(spar_tg_dep,2),wd=round(tg_wd,2),series=tg_series,txns=tg_list),
 ),
 n_giro=len(giro), n_tages=len(tages), n_total=len(all_tx), income_correction=6737.86,
)
json.dump(out,open("metrics2.json","w"),ensure_ascii=False,indent=1)
slim=[{"acct":t['acct'],"d":t['date'],"mo":t['month'],"e":t['emp'][:40],"z":t['zweck'][:90],"a":t['amt'],"c":t['cat'],"int":1 if t['internal'] else 0} for t in all_tx]
json.dump(slim,open("txns2_slim.json","w"),ensure_ascii=False)

print(f"Einkommen(korr) {echtes_eink:,.2f} = Gehalt {gehalt_total:,.0f}+Erstatt {erstatt_total:,.0f}+Zins {zins_total:,.2f}")
print(f"Konsum {konsum_total:,.2f} | Operativer Saldo {net_operativ:,.2f}")
print(f"Sparen brutto {spar_brutto:,.0f} (ext {spar_ext:,.0f}+TG {spar_tg_dep:,.0f}) | Entsparen {entsparen:,.0f} (TG {tg_wd:,.0f}+Anlage {anlage_ausz:,.0f})")
print(f"Netto-Vermögensaufbau {netto_verm:,.0f} | Sparquote {sparquote}%")
print(f"Giro 2025: {giro_start2025} -> {giro_end2025} (Δ{giro_net:+.2f})")
print(f"Tagesgeld 2025: {tg_start2025} -> {tg_end2025} (Δ{tg_net:+.2f}), Zins {zins_total:.2f}")
print("TG Saldoverlauf (Monatsende):",tg_series)
print("min Saldo:",min(tg_series))
