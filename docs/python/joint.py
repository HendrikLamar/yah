import csv, json
from collections import defaultdict, Counter
GIRO="DE30120300001030293144"; TAGES="DE62120300001021068935"; JOINT="DE55120300001064640491"
def amt(s):
    s=s.strip().replace(".","").replace(",",".")
    try:return float(s)
    except:return 0.0
with open("gemeinschaft.csv",encoding="utf-8-sig") as f: lines=f.readlines()
for i,l in enumerate(lines):
    if l.startswith('"Buchungsdatum"'): hdr=i;break
rows=list(csv.reader(lines[hdr:],delimiter=";"))[1:]
J=[]
for r in rows:
    if len(r)<9: continue
    a=amt(r[8])
    if a==0: continue
    dd,mm,yy=r[0].split(".")
    mo=f"20{yy}-{int(mm):02d}"
    J.append(dict(date=r[0],month=mo,emp=" ".join(r[4].split()),auftrag=" ".join(r[3].split()),
        zweck=" ".join(r[5].split()),typ=r[6],amt=round(a,2),iban=r[7].strip(),
        internal=(r[7].strip() in (GIRO,TAGES))))

def classify(t):
    e=t['emp'].lower(); z=t['zweck'].lower(); full=e+" "+z
    if t['amt']>0:
        if t['internal']: return ("Einzahlung · Hendrik","Einnahmen")
        if "sina unseld" in t['auftrag'].lower(): return ("Einzahlung · Sina","Einnahmen")
        return ("Erstattung / extern","Einnahmen")
    # expenses
    if "kathrin schneider" in e or "wohnmobilkauf" in z: return ("Große Einmalposten","Einmalig")
    if "katharina katz" in e or ("miete" in z and "kepler" in z): return ("Miete","Konsum")
    if "kka goettingen" in e or "kka" in e: return ("Kita & Kinder","Konsum")
    if "kinderarzt" in e: return ("Kita & Kinder","Konsum")
    if any(k in e for k in ["tieraerztlich","kleintierpraxis","drachenladen"]): return ("Haustier & Tierarzt","Konsum")
    if any(k in e for k in ["baloise"]): return ("Versicherungen","Konsum")
    if any(k in e for k in ["ewe vertrieb","vodafone","rundfunk ard"]): return ("Energie, Telekom & Rundfunk","Konsum")
    food=["lidl","kaufland","dm drogerie","rossmann","rewe","edeka","penny","aldi","tegut","alnatura","viani","go asia","hofpfisterei","baeckerei","feinbaeckerei","chasmeisterei","norma","tania mohamed","incoop","goettingen 24","fausto"]
    if any(k in full for k in food): return ("Lebensmittel & Drogerie","Konsum")
    health=["apotheke","friseur","egym","wellpass","sport-club","stadtbibliothek","egapark","naturerlebnis"]
    if any(k in full for k in health): return ("Gesundheit & Freizeit","Konsum")
    mob=["tankstelle","star tankstelle","classic gottingen","aral","jet ","oil 2","hoyer","olv","kfz-","campingplatz","camping","db ","bahn"]
    if any(k in full for k in mob): return ("Mobilität & Reise","Konsum")
    gastro=["osteria","braeu","gaststaette","cron u. lanz","cafe inti","restaurant","schloss burger","mcdonald","burger king","amavi","bullerjahn","bottles","dean david","haferkater","boyer","zum wenigemarkt","giesinger","rumpler","rice","chi "]
    if any(k in full for k in gastro): return ("Restaurants & Gastronomie","Konsum")
    if any(k in e for k in ["bundeskasse","stadtkasse","dkb ag","schilderpraegerei stamer"]): return ("Steuern & Gebühren","Konsum")
    # private transfers
    if any(k in e for k in ["frido unseld","sina unseld","hendrik windel","klaus-hagen hage","almuth sowa","marlies","keven kracht","vielen dank","insl/kyritz","weirauch"]): return ("Transfers / Privat","Transfers")
    shop=["ikea","toom","deichmann","tchibo","thalia","soestrene","idee.creativ","butlers","gries deco","mcpaper","h+m","ernstings","hugendubel","nanu nana","covermade","galeria","fritz berger","buchhandlung","sonderp.baum","post ag","creativmarkt","schilder"]
    if any(k in full for k in shop): return ("Shopping & Sonstiges","Konsum")
    return ("Shopping & Sonstiges","Konsum")

for t in J: t['cat'],t['grp']=classify(t)

MONTHS=[f"2025-{m:02d}" for m in range(1,13)]
ML=["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"]

# income split
inc_sina=defaultdict(float); inc_hendrik=defaultdict(float); inc_ext=defaultdict(float)
for t in J:
    if t['amt']<=0: continue
    if t['cat']=="Einzahlung · Sina": inc_sina[t['month']]+=t['amt']
    elif t['cat']=="Einzahlung · Hendrik": inc_hendrik[t['month']]+=t['amt']
    else: inc_ext[t['month']]+=t['amt']

CATS=["Große Einmalposten","Miete","Kita & Kinder","Lebensmittel & Drogerie","Energie, Telekom & Rundfunk",
 "Versicherungen","Haustier & Tierarzt","Gesundheit & Freizeit","Mobilität & Reise","Restaurants & Gastronomie",
 "Shopping & Sonstiges","Transfers / Privat","Steuern & Gebühren"]
cat_month=defaultdict(lambda:defaultdict(float)); cat_total=defaultdict(float); cat_n=Counter()
for t in J:
    if t['amt']<0:
        cat_month[t['cat']][t['month']]+=-t['amt']; cat_total[t['cat']]+=-t['amt']; cat_n[t['cat']]+=1
ausg_total=sum(cat_total.values())
sina_total=sum(inc_sina.values()); hendrik_total=sum(inc_hendrik.values()); ext_total=sum(inc_ext.values())
einn_total=sina_total+hendrik_total+ext_total

end2025=2137.90
net=round(sum(t['amt'] for t in J),2); start2025=round(end2025-net,2)
by_month=defaultdict(float)
for t in J: by_month[t['month']]+=t['amt']
cum=start2025; series=[]
for m in MONTHS: cum+=by_month[m]; series.append(round(cum,2))

# without große einmalposten
ausg_laufend=ausg_total-cat_total["Große Einmalposten"]

out=dict(months=MONTHS,mlabels=ML,
 inc_sina=[round(inc_sina[m],2) for m in MONTHS],
 inc_hendrik=[round(inc_hendrik[m],2) for m in MONTHS],
 inc_ext=[round(inc_ext[m],2) for m in MONTHS],
 ausg_m=[round(sum(cat_month[c][m] for c in CATS),2) for m in MONTHS],
 cat_total={c:round(cat_total[c],2) for c in CATS if cat_total[c]>0},
 cat_n={c:cat_n[c] for c in CATS if cat_total[c]>0},
 cat_month={c:[round(cat_month[c][m],2) for m in MONTHS] for c in CATS if cat_total[c]>0},
 sina_total=round(sina_total,2),hendrik_total=round(hendrik_total,2),ext_total=round(ext_total,2),
 einn_total=round(einn_total,2),ausg_total=round(ausg_total,2),ausg_laufend=round(ausg_laufend,2),
 sina_share=round(sina_total/(sina_total+hendrik_total)*100,1),
 end2025=end2025,start2025=start2025,net=net,now=4886.81,n=len(J),series=series,
)
json.dump(out,open("joint_metrics.json","w"),ensure_ascii=False,indent=1)
slim=[{"acct":"Gemeinschaft","d":t['date'],"mo":t['month'],"e":t['emp'][:40],"z":t['zweck'][:90],"a":t['amt'],"c":t['cat'],"int":1 if t['internal'] else 0} for t in J]
json.dump(slim,open("joint_slim.json","w"),ensure_ascii=False)

print(f"Buchungen {len(J)} | Einnahmen {einn_total:,.2f} (Sina {sina_total:,.0f} / Hendrik {hendrik_total:,.0f} / extern {ext_total:,.0f})")
print(f"Beitrag Sina {out['sina_share']}% : Hendrik {100-out['sina_share']:.1f}%")
print(f"Ausgaben {ausg_total:,.2f} (davon Einmalposten {cat_total['Große Einmalposten']:,.0f}; laufend {ausg_laufend:,.2f})")
print(f"Saldo: Start {start2025} -> Ende {end2025} (Δ{net:+.2f}); min Saldoverlauf {min(series)}")
print("\nKategorien:")
for c in sorted(CATS,key=lambda x:-cat_total[x]):
    if cat_total[c]>0: print(f"  {cat_total[c]:9.0f}  x{cat_n[c]:3d}  {c}")
# check uncategorized leakage
chk=sum(t['amt'] for t in J if t['amt']<0)
print(f"\nSumme Kategorien {ausg_total:.2f} vs Rohausgänge {-chk:.2f} diff {ausg_total-(-chk):.2f}")
