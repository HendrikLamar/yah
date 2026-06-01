import json
from collections import defaultdict, Counter
GIRO="DE30120300001030293144"; TAGES="DE62120300001021068935"; JOINT="DE55120300001064640491"
U=json.load(open("unified.json")); giro=U['giro']; tages=U['tages']
jm=json.load(open("joint_metrics.json")); jslim=json.load(open("joint_slim.json"))
m2=json.load(open("metrics2.json"))
MONTHS=m2['months']; ML=m2['mlabels']

# classify giro (reuse logic) - import from metrics3 by re-deriving via txns2_slim cat + need iban
# txns2_slim has cat & int but not iban; map by matching date+amt+emp is messy. Re-classify here:
import importlib.util
# simpler: load txns2_slim and attach iban from unified by index order (giro first 546)
slim=json.load(open("txns2_slim.json"))
giro_slim=[t for t in slim if t['acct']=="Giro"]
assert len(giro_slim)==len(giro), (len(giro_slim),len(giro))
for s,g in zip(giro_slim,giro):
    s['iban']=g['iban']; s['emp_full']=g['emp']

# ---- Combined income ----
# Hendrik echtes Einkommen (Gehalt+Erstatt+Zins) already in m2
hendrik_eink_m=[round(m2['gehalt_m'][i]+m2['erstatt_m'][i],2) for i in range(12)]  # erstatt_m already incl zins
# Sina contributions
sina_m=jm['inc_sina']; ext_m=jm['inc_ext']
comb_inc_m=[round(hendrik_eink_m[i]+sina_m[i]+ext_m[i],2) for i in range(12)]
hendrik_eink_tot=m2['echtes_eink']; sina_tot=jm['sina_total']; ext_tot=jm['ext_total']
comb_inc_tot=round(hendrik_eink_tot+sina_tot+ext_tot,2)

# ---- Combined expenses ----
# Hendrik personal: konsum categories, EXCLUDE iban==JOINT (transfers to joint) and internal
HARMON={"Gesundheit":"Gesundheit & Freizeit"}
KONSUM_H=set(m2['cat_total'].keys())  # Hendrik konsum cats
ccat_month=defaultdict(lambda:defaultdict(float)); ccat_tot=defaultdict(float); ccat_n=Counter()
hendrik_personal_m=defaultdict(float)
for s in giro_slim:
    if s['a']>=0: continue
    if s['iban']==JOINT: continue   # transfer to joint -> netted (replaced by joint detail)
    if s['c'] in KONSUM_H:
        cat=HARMON.get(s['c'],s['c'])
        ccat_month[cat][s['mo']]+=-s['a']; ccat_tot[cat]+=-s['a']; ccat_n[cat]+=1
        hendrik_personal_m[s['mo']]+=-s['a']
# Joint spending (all categories already real household)
joint_m=defaultdict(float)
for t in jslim:
    if t['a']<0:
        cat=t['c']
        ccat_month[cat][t['mo']]+=-t['a']; ccat_tot[cat]+=-t['a']; ccat_n[cat]+=1
        joint_m[t['mo']]+=-t['a']
comb_exp_m=[round(hendrik_personal_m[mo]+joint_m[mo],2) for mo in MONTHS]
comb_exp_tot=round(sum(ccat_tot.values()),2)
einmal=round(ccat_tot.get("Große Einmalposten",0),2)
comb_exp_laufend=round(comb_exp_tot-einmal,2)

# net
comb_net_op=round(comb_inc_tot-comb_exp_laufend,2)   # operativ ohne Einmalposten
comb_net_all=round(comb_inc_tot-comb_exp_tot,2)
comb_net_m=[round(comb_inc_m[i]-comb_exp_m[i],2) for i in range(12)]

out=dict(months=MONTHS,mlabels=ML,
 hendrik_eink_m=hendrik_eink_m, sina_m=sina_m, ext_m=ext_m, comb_inc_m=comb_inc_m, comb_exp_m=comb_exp_m, comb_net_m=comb_net_m,
 hendrik_eink_tot=round(hendrik_eink_tot,2), sina_tot=round(sina_tot,2), ext_tot=round(ext_tot,2), comb_inc_tot=comb_inc_tot,
 hendrik_share=round(hendrik_eink_tot/(hendrik_eink_tot+sina_tot)*100,1),
 cat_total={c:round(v,2) for c,v in ccat_tot.items()},
 cat_n=dict(ccat_n),
 cat_month={c:[round(ccat_month[c][mo],2) for mo in MONTHS] for c in ccat_tot},
 comb_exp_tot=comb_exp_tot, einmal=einmal, comb_exp_laufend=comb_exp_laufend,
 comb_net_op=comb_net_op, comb_net_all=comb_net_all,
 hendrik_personal_tot=round(sum(hendrik_personal_m.values()),2),
 joint_tot=round(sum(joint_m.values()),2),
)
json.dump(out,open("consol_metrics.json","w"),ensure_ascii=False,indent=1)
print(f"Haushaltseinkommen {comb_inc_tot:,.2f} (Hendrik {hendrik_eink_tot:,.0f} {out['hendrik_share']}% / Sina {sina_tot:,.0f} / extern {ext_tot:,.0f})")
print(f"Haushaltsausgaben gesamt {comb_exp_tot:,.2f} (davon Hendrik personal {out['hendrik_personal_tot']:,.0f} + Gemeinschaft {out['joint_tot']:,.0f})")
print(f"  laufend {comb_exp_laufend:,.2f} + Einmalposten {einmal:,.0f}")
print(f"Operativer Saldo laufend {comb_net_op:,.2f} | inkl. Einmalposten {comb_net_all:,.2f}")
print("\nKombinierte Kategorien:")
for c,v in sorted(ccat_tot.items(),key=lambda x:-x[1]):
    print(f"  {v:9.0f}  x{ccat_n[c]:3d}  {c}")

# combined expense txns for tab-3 drill-down
consol_slim=[]
for s in giro_slim:
    if s['a']<0 and s['iban']!=JOINT and s['c'] in KONSUM_H:
        cat=HARMON.get(s['c'],s['c'])
        consol_slim.append({"src":"Hendrik","d":s['d'],"mo":s['mo'],"e":s['emp_full'][:40],"z":s['z'],"a":s['a'],"c":cat})
for t in jslim:
    if t['a']<0:
        consol_slim.append({"src":"Gemeinschaft","d":t['d'],"mo":t['mo'],"e":t['e'],"z":t['z'],"a":t['a'],"c":t['c']})
json.dump(consol_slim,open("consol_slim.json","w"),ensure_ascii=False)
print("\nconsol_slim Buchungen:",len(consol_slim),"Summe",round(sum(t['a'] for t in consol_slim),2))
