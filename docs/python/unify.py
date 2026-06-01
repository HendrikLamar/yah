import csv, json
from collections import defaultdict
GIRO="DE30120300001030293144"; TAGES="DE62120300001021068935"
def parse(path,acct,self_iban,other_iban):
    with open(path,encoding="utf-8-sig") as f: lines=f.readlines()
    for i,l in enumerate(lines):
        if l.startswith('"Buchungsdatum"'): hdr=i;break
    rows=list(csv.reader(lines[hdr:],delimiter=";"))[1:]
    out=[]
    for r in rows:
        if len(r)<9: continue
        s=r[8].strip().replace(".","").replace(",",".")
        try: a=float(s)
        except: a=0.0
        if a==0: continue
        dd,mm,yy=r[0].split(".")
        mo=f"20{yy}-{int(mm):02d}"
        iban=r[7].strip()
        internal = iban==other_iban
        out.append(dict(acct=acct,date=r[0],month=mo,emp=" ".join(r[4].split()),
            zweck=" ".join(r[5].split()),typ=r[6],amt=round(a,2),iban=iban,internal=internal))
    return out

giro=parse("/sessions/friendly-gallant-davinci/mnt/Finanzen/01-06-2026_Umsatzliste_Girokonto_DE30120300001030293144.csv","Giro",GIRO,TAGES)
tages=parse("tagesgeld.csv","Tagesgeld",TAGES,GIRO)

# Tagesgeld interest = Eingang with own IBAN (not from Giro), DKB Abrechnung
for t in tages:
    if t['iban'].startswith("1021068935") or (t['emp'].lower().startswith("dkb") and not t['internal']):
        t['kind']="Zinsen"
    elif t['internal'] and t['amt']>0: t['kind']="Sparen-Zufluss"   # Giro->Tagesgeld deposit
    elif t['internal'] and t['amt']<0: t['kind']="Entsparen-Abfluss" # Tagesgeld->Giro
    else: t['kind']="Sonstige"

json.dump({"giro":giro,"tages":tages},open("unified.json","w"),ensure_ascii=False)

# Reconciliation internal
gi_in=sum(t['amt'] for t in giro if t['internal'])
tg_in=sum(t['amt'] for t in tages if t['internal'])
print("Giro internal net:",round(gi_in,2),"| Tagesgeld internal net:",round(tg_in,2),"| Summe (soll 0):",round(gi_in+tg_in,2))

# Tagesgeld balances
end=2905.22
net=sum(t['amt'] for t in tages)
start=round(end-net,2)
print(f"\nTagesgeld: Start {start}  +Netto {round(net,2)} = Ende {end}")
zins=sum(t['amt'] for t in tages if t['kind']=="Zinsen")
dep=sum(t['amt'] for t in tages if t['kind']=="Sparen-Zufluss")
wd=sum(t['amt'] for t in tages if t['kind']=="Entsparen-Abfluss")
print(f"Zinsen {round(zins,2)} | Einzahlungen {round(dep,2)} | Auszahlungen {round(wd,2)}")

# corrected income: internal inflows to Giro that were counted as income
internal_giro_in=[t for t in giro if t['internal'] and t['amt']>0]
print("\nInterne Zuflüsse auf Giro (waren teils faelschlich Einkommen):")
for t in internal_giro_in: print(f"  {t['date']} {t['amt']:9.2f}  {t['zweck'][:30]}")
print("Summe:",round(sum(t['amt'] for t in internal_giro_in),2))
