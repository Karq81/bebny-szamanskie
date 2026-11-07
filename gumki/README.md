# Pojemnik na gumki do włosów – kubki do układania (druk 3D)

Okrągłe kubki z żeberkami i okienkiem z przodu. Kubki stawia się jeden na drugim:
góra kubka ma niski kołnierz, a spód kolejnego kubka ma wgłębienie, w które ten kołnierz wchodzi.
Najwyższy kubek zamyka się deklem (ma takie samo wgłębienie jak spód kubka).
Każdy kubek stoi też płasko na stole.

| Plik | Opis |
|---|---|
| `gumki_kubek.stl` | jeden kubek – Ø ~83 mm × 124 mm (120 + kołnierz 4 mm), wnętrze Ø 74 mm |
| `gumki_2_kubki.stl` | 2 kubki obok siebie na jednym stole (~174 × 83 mm) |
| `gumki_dekiel.stl` | dekiel – drukować tak jak jest (wierzchem do stołu) |
| `podglad_zlozone.stl` | tylko podgląd: 2 kubki + dekiel złożone (nie do druku) |
| `gumki.scad` | projekt w OpenSCAD (`part = "kubek" / "dekiel" / "2_kubki" / "zlozone"`) |
| `gumki.py` | generator STL (Python + manifold3d) |

## Druk
- PLA lub PETG, warstwa 0,2 mm, 3 obrysy, bez podpór.
- Górna krawędź okienka to mostek ok. 40 mm – zwykle drukuje się bez podpór.
- Pasowanie: luz 0,25 mm. Jeśli kubki wchodzą za ciasno → `FIT = 0.35`, za luźno → `FIT = 0.15`
  (najlepiej najpierw wydrukować dekiel i jeden kubek i sprawdzić).

## Napis (opcjonalnie)
W `gumki.py` ustaw `TEXT = "Maya"`, w `gumki.scad` `TEXT_ON=true;`. Czcionka Pacifico (SIL OFL) – plik `Pacifico.ttf`.
