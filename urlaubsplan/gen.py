import datetime as dt, calendar
Y=2027
names=["Bahde","Pierre","Cuber","Paul","Steve","Rafał 1","Rafał 2","Kuba"]
blank=2
months=["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"]
wd="MDMDFSS"
hol={(1,1):"Neujahr",(3,26):"Karfreitag",(3,29):"Ostermontag",(5,1):"Tag der Arbeit",(5,6):"Christi Himmelfahrt",
 (5,17):"Pfingstmontag",(10,3):"Tag der Deutschen Einheit",(10,31):"Reformationstag",(12,25):"1. Weihnachtsfeiertag",(12,26):"2. Weihnachtsfeiertag"}
ferien=[("Weihnachtsferien",dt.date(2026,12,21),dt.date(2027,1,6)),("Osterferien",dt.date(2027,3,30),dt.date(2027,4,10)),
 ("Brückentag Himmelfahrt",dt.date(2027,5,7),dt.date(2027,5,7)),("Sommerferien",dt.date(2027,7,3),dt.date(2027,8,14)),
 ("Herbstferien",dt.date(2027,10,11),dt.date(2027,10,23)),("Weihnachtsferien",dt.date(2027,12,23),dt.date(2028,1,8))]
def isf(d): return any(a<=d<=b for _,a,b in ferien)
def month(m):
    n=calendar.monthrange(Y,m)[1]
    days=[dt.date(Y,m,d) for d in range(1,32) if d<=n]
    def cls(d): return "red" if d.weekday()>=5 or (d.month,d.day) in hol else ""
    def dcls(d): return cls(d) or ("fer" if isf(d) else "")
    h=f'<table class="m"><colgroup><col class="nc">'+'<col>'*31+'</colgroup>'
    h+=f'<tr class="t"><th class="name"></th><th colspan="31">{months[m-1]} {Y}</th></tr>'
    h+='<tr class="dn"><th class="name">Name</th>'+''.join(f'<td class="{dcls(d)}">{d.day}</td>' for d in days)+'<td class="x"></td>'*(31-n)+'</tr>'
    h+='<tr class="wd"><th class="name"></th>'+''.join(f'<td class="{cls(d)}">{wd[d.weekday()]}</td>' for d in days)+'<td class="x"></td>'*(31-n)+'</tr>'
    for nm in names+[""]*blank:
        h+=f'<tr class="p"><th class="name">{nm}</th>'+''.join(f'<td class="{cls(d)}"></td>' for d in days)+'<td class="x"></td>'*(31-n)+'</tr>'
    return h+'</table>'
fmt=lambda d:d.strftime("%d.%m.%y")
holrows=''.join(f'<tr><td>{v}</td><td>{dt.date(Y,*k).strftime("%d.%m.%Y")}</td></tr>' for k,v in sorted(hol.items()))
ferrows=''.join(f'<tr><td>{n}</td><td>{fmt(a)}{" – "+fmt(b) if a!=b else ""}</td></tr>' for n,a,b in ferien)
html=f'''<!doctype html><html><head><meta charset="utf-8"><style>
@page{{size:1189mm 841mm;margin:0}}
*{{box-sizing:border-box}}
body{{margin:0;width:1189mm;height:841mm;padding:14mm 16mm;font-family:Arial,Helvetica,sans-serif;color:#000}}
h1{{margin:0 0 6mm;font-size:16mm;text-align:center;letter-spacing:1mm}}
.grid{{display:grid;grid-template-columns:repeat(3,1fr);column-gap:9mm;row-gap:7mm}}
table.m{{border-collapse:collapse;width:100%;table-layout:fixed}}
col.nc{{width:40mm}}
td,th{{border:0.35mm solid #000;padding:0;text-align:center;font-size:4.6mm;height:12.4mm}}
tr.t th{{font-size:7.5mm;height:11mm;border-top:none;border-left:none;border-right:none}}
tr.t th.name{{border:none}}
tr.dn td{{font-weight:bold;font-size:4mm}}
tr.wd td{{font-weight:bold;font-size:4mm}}
th.name{{text-align:left;padding-left:2mm;font-size:6mm;font-weight:bold}}
.red{{background:#d2143a;color:#fff}}
.fer{{background:#ffe55c}}
td.x{{background:#bbb}}
.foot{{display:flex;gap:30mm;margin-top:9mm;font-size:6mm;align-items:flex-start}}
.foot table td{{border:none;text-align:left;font-size:5.6mm;height:auto;padding:0.6mm 8mm 0.6mm 0}}
.foot h3{{margin:0 0 2mm;font-size:7mm;text-decoration:underline}}
.hol h3,.hol td{{color:#c0102f}}
.leg{{display:flex;flex-direction:column;gap:3mm;font-size:5.6mm}}
.sw{{display:inline-block;width:10mm;height:6mm;border:0.35mm solid #000;vertical-align:middle;margin-right:3mm}}
</style></head><body>
<h1>Urlaubsplan {Y}</h1>
<div class="grid">{''.join(month(m) for m in range(1,13))}</div>
<div class="foot">
<div class="hol"><h3>Feiertage {Y} (Schleswig-Holstein)</h3><table>{holrows}</table></div>
<div><h3>Schulferien {Y} (Schleswig-Holstein)</h3><table>{ferrows}</table></div>
<div class="leg"><h3>Legende</h3>
<div><span class="sw" style="background:#d2143a"></span>Wochenende / Feiertag</div>
<div><span class="sw" style="background:#ffe55c"></span>Schulferien Schleswig-Holstein (Datum gelb)</div></div>
</div></body></html>'''
open("urlaubsplan_2027_A0.html","w").write(html)
