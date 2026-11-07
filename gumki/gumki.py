# Pojemnik na gumki do włosów (druk 3D) – kubki do układania jeden na drugim + dekiel
#
# System łączenia:
#   góra kubka  -> niski kołnierz (pierścień) wystający ponad krawędź
#   dół kubka   -> wgłębienie od spodu, w które wchodzi kołnierz kubka niżej
#   dekiel      -> to samo wgłębienie co spód kubka, zamyka najwyższy kubek
# Kubek stoi płasko na stole (wgłębienie jest od spodu, nie wystaje).
import numpy as np, trimesh
from manifold3d import Manifold, CrossSection, JoinType, FillRule, set_circular_segments
set_circular_segments(128)

# --- parametry [mm] ---
H        = 120   # wysokość kubka (bez kołnierza)
R_IN     = 37    # promień wewnętrzny (średnica wnętrza 74 mm)
WALL     = 2.8   # grubość ścianki
FLOOR    = 2.4   # grubość dna (nad wgłębieniem)
N_RIBS   = 40    # liczba pionowych żeberek
RIB_R    = 1.6   # promień żeberka
WIN_W    = 54    # szerokość okienka (cięciwa)
WIN_Z0   = 16    # dół okienka od podłoża
WIN_Z1   = None  # góra okienka (auto: H-12, z napisem H-36)
WIN_RAD  = 8     # zaokrąglenie rogów okienka
# kołnierz / wgłębienie
COL_IN   = 1.0   # o ile kołnierz wchodzi do środka (poza ściankę)
COL_T    = 1.8   # grubość kołnierza
COL_H    = 4.0   # wysokość kołnierza
FIT      = 0.25  # luz pasowania (promieniowo) – przy ciasnym pasowaniu zwiększ do 0.35
LID_TOP  = 2.4   # grubość wierzchu dekla
# napis (opcjonalnie)
TEXT     = ""    # np. "Maya" ("" = bez napisu)
FONT     = "Pacifico.ttf"
TEXT_W, TEXT_H, TEXT_Z, TEXT_UP = 58, 23, H-19, 1.2

R_OUT   = R_IN + WALL
R_RIB   = R_OUT + RIB_R                 # zewnętrzny zasięg żeberek
COL_R0  = R_IN - COL_IN                 # kołnierz: promień wewn.
COL_R1  = COL_R0 + COL_T                # kołnierz: promień zewn.
REC_R   = COL_R1 + FIT                  # wgłębienie od spodu
REC_H   = COL_H + 0.3                   # głębokość wgłębienia
BASE    = REC_H + FLOOR                 # poziom dna w środku kubka
if WIN_Z1 is None: WIN_Z1 = H-36 if TEXT else H-12

def cyl(h, r, z=0): return Manifold.cylinder(h, r, r).translate((0,0,z))
def cone(h, r0, r1, z=0): return Manifold.cylinder(h, r0, r1).translate((0,0,z))
def ring(h, r0, r1, z=0): return cyl(h, r1, z) - cyl(h+0.02, r0, z-0.01)

def rounded_rect(w, h, r):
    return CrossSection.square((w-2*r, h-2*r), center=True).offset(r, JoinType.Round)

def revolve(pts):
    return Manifold.revolve(CrossSection([pts]), 128)

def cup():
    # przekrój ścianki (r, z): wgłębienie od spodu z fazką, dno, ścianka, fazka 45° i kołnierz
    prof = [(0, REC_H), (REC_R, REC_H), (REC_R, 0.6), (REC_R+0.6, 0), (R_OUT, 0), (R_OUT, H),
            (COL_R1, H), (COL_R1, H+COL_H), (COL_R0, H+COL_H), (COL_R0, H), (R_IN, H-COL_IN),
            (R_IN, BASE), (0, BASE)]
    b = revolve(prof)
    for i in range(N_RIBS):
        a = 2*np.pi*(i+0.37)/N_RIBS
        b += cyl(H, RIB_R).translate((R_OUT*np.cos(a), R_OUT*np.sin(a), 0))
    # okienko z przodu
    win = Manifold.extrude(rounded_rect(WIN_W, WIN_Z1-WIN_Z0, WIN_RAD), R_OUT+5)
    b -= win.rotate((90,0,0)).translate((0,0,(WIN_Z0+WIN_Z1)/2))
    if TEXT:
        zone = Manifold.cube((TEXT_W+12, R_RIB+5, TEXT_H+8)).translate((-(TEXT_W+12)/2, -(R_RIB+5), TEXT_Z-(TEXT_H+8)/2))
        b += ring(H, R_IN+0.5, R_RIB) ^ zone
        txt = Manifold.extrude(text_cs(), R_RIB+TEXT_UP+1).rotate((90,0,0)).translate((0,0,TEXT_Z))
        b += txt ^ ring(H, R_OUT, R_RIB+TEXT_UP)
    return b

def lid():
    # dekiel ma ten sam spód co kubek: wgłębienie na kołnierz.
    # Drukować wierzchem do stołu (wgłębieniem do góry) – bez podpór.
    t = REC_H + LID_TOP
    d = cyl(t, R_OUT)
    for i in range(N_RIBS):
        a = 2*np.pi*(i+0.37)/N_RIBS
        d += cyl(t, RIB_R).translate((R_OUT*np.cos(a), R_OUT*np.sin(a), 0))
    d -= revolve([(0, LID_TOP), (REC_R, LID_TOP), (REC_R, t-0.6), (REC_R+0.6, t+0.01), (0, t+0.01)]).translate((0,0,0))
    return d

def text_cs():
    from matplotlib.textpath import TextPath
    from matplotlib.font_manager import FontProperties
    p = TextPath((0,0), TEXT, size=10, prop=FontProperties(fname=FONT))
    polys = [q for q in p.to_polygons() if len(q) > 2]
    pts = np.vstack(polys); mn, mx = pts.min(0), pts.max(0)
    k = min(TEXT_W/(mx[0]-mn[0]), TEXT_H/(mx[1]-mn[1])); c = (mn+mx)/2
    return CrossSection([((q-c)*k).tolist() for q in polys], FillRule.EvenOdd)

def save(m, fn, check=True):
    me = m.to_mesh()
    t = trimesh.Trimesh(me.vert_properties[:,:3], me.tri_verts)
    assert t.is_watertight or not check, fn
    t.export(fn)

if __name__ == "__main__":
    c, l = cup(), lid()
    save(c, "gumki_kubek.stl")
    save(l, "gumki_dekiel.stl")
    gap = 2*R_RIB + 8
    save(c + c.translate((gap,0,0)), "gumki_2_kubki.stl")             # 2 kubki na jednym stole
    # podgląd złożenia: 2 kubki jeden na drugim + dekiel (nie do druku)
    stack = c + c.translate((0,0,H)) + l.mirror((0,0,1)).translate((0,0,2*H+REC_H+LID_TOP))
    save(stack, "podglad_zlozone.stl", check=False)
    print("REC_R", REC_R, "COL", COL_R0, COL_R1, "BASE", BASE)
