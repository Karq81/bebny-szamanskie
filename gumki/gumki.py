# Pojemnik na gumki do włosów (druk 3D) – korpus z okienkiem + pokrywka
import numpy as np, trimesh
from manifold3d import Manifold, CrossSection, set_circular_segments
set_circular_segments(96)

# --- parametry [mm] ---
H        = 120   # wysokość korpusu
R_IN     = 37    # promień wewnętrzny (średnica wnętrza 74 mm)
WALL     = 2.4   # grubość ścianki
BOTTOM   = 2.4   # grubość dna
N_RIBS   = 40    # liczba pionowych żeberek
RIB_R    = 1.6   # promień żeberka
WIN_W    = 54    # szerokość okienka (cięciwa)
WIN_Z0   = 14    # dół okienka od podłoża
WIN_Z1   = H-36  # góra okienka (nad nim pole na napis)
WIN_RAD  = 8     # zaokrąglenie rogów okienka
CLEAR    = 0.3   # luz pokrywki
LID_T    = 3     # grubość pokrywki
LIP_H    = 6     # wysokość kołnierza pokrywki
TEXT     = "Maya" # napis na froncie ("" = bez napisu)
FONT     = "Pacifico.ttf"
TEXT_W   = 58    # max szerokość napisu
TEXT_H   = 23    # max wysokość napisu
TEXT_Z   = H-19  # środek napisu (wysokość)
TEXT_UP  = 1.2   # o ile napis wystaje ponad żeberka

R_OUT = R_IN + WALL
def cyl(h, r, z=0): return Manifold.cylinder(h, r, r).translate((0,0,z))

def rounded_rect(w, h, r):
    sq = CrossSection.square((w-2*r, h-2*r), center=True)
    return sq.offset(r, CrossSection.JoinType.Round if hasattr(CrossSection,'JoinType') else 2)

def body():
    b = cyl(H, R_OUT)
    for i in range(N_RIBS):
        a = 2*np.pi*i/N_RIBS
        b += cyl(H, RIB_R).translate((R_OUT*np.cos(a), R_OUT*np.sin(a), 0))
    b -= cyl(H, R_IN, BOTTOM)
    # okienko: zaokrąglony prostokąt w płaszczyźnie XZ, wycięty od przodu (-Y)
    win = Manifold.extrude(rounded_rect(WIN_W, WIN_Z1-WIN_Z0, WIN_RAD), R_OUT+5)
    win = win.rotate((90,0,0)).translate((0,0,(WIN_Z0+WIN_Z1)/2))  # extrude idzie w -Y
    b -= win
    if TEXT:
        R_T = R_OUT + RIB_R
        zone = Manifold.cube((TEXT_W+12, R_T+5, TEXT_H+8)).translate((-(TEXT_W+12)/2, -(R_T+5), TEXT_Z-(TEXT_H+8)/2))
        band = (cyl(H, R_T) - cyl(H, R_IN+0.5)) ^ zone          # gładkie pole pod napisem
        txt  = Manifold.extrude(text_cs(), R_T+TEXT_UP+1).rotate((90,0,0)).translate((0,0,TEXT_Z))
        txt  = txt ^ (cyl(H, R_T+TEXT_UP) - cyl(H, R_OUT))
        b = b + band + txt
    return b

def text_cs():
    from matplotlib.textpath import TextPath
    from matplotlib.font_manager import FontProperties
    p = TextPath((0,0), TEXT, size=10, prop=FontProperties(fname=FONT))
    polys = [q for q in p.to_polygons() if len(q) > 2]
    pts = np.vstack(polys); mn, mx = pts.min(0), pts.max(0)
    k = min(TEXT_W/(mx[0]-mn[0]), TEXT_H/(mx[1]-mn[1])); c = (mn+mx)/2
    polys = [((q-c)*k).tolist() for q in polys]
    return CrossSection(polys, CrossSection.FillRule.EvenOdd if hasattr(CrossSection,'FillRule') else 1)

def lid():
    disc = cyl(LID_T, R_OUT + RIB_R)
    lip  = cyl(LIP_H, R_IN-CLEAR, LID_T) - cyl(LIP_H, R_IN-CLEAR-1.8, LID_T)
    return disc + lip    # drukować płaską stroną do stołu

def save(m, fn):
    me = m.to_mesh()
    trimesh.Trimesh(me.vert_properties[:,:3], me.tri_verts).export(fn)

save(body(), "gumki_korpus.stl")
save(lid(),  "gumki_pokrywka.stl")
print("ok")
