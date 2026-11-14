"""Ikony instrumentów (web/assets/icons/gry/instr-*.webp) nie mogą być ucięte (2026-10-20).

Błąd: część ikon instrumentów była ucinana w wyborze. Przyczyna była w grafice,
nie w układzie: ikony wycinał z arkuszy 4×2 (Codex) skrypt tnący PO GRANICY KOMÓRKI, więc naklejka,
która wychodziła poza swoją kratkę, traciła kawałek. Trąbka straciła czarę (31 px prostej krawędzi),
smyczki ślimak (9 px), puzon czarę (8 px).

Jak to poznać bez oglądania: każda naklejka jest obrysowana grubą ciemną nicią, więc skrajny
nieprzezroczysty piksel wiersza albo kolumny jest CIEMNY i zwykle częściowo przezroczysty (wygładzanie).
Ucięcie zostawia prostą linię jasnych pikseli o pełnym kryciu — i to właśnie łapie ten test.

    py tests/test_ikony_instrumenty.py

Bez Pillow test się pomija (SKIP), nie udaje, że przeszedł.
"""
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IKONY = os.path.join(REPO, "web", "assets", "icons", "gry")
PROG_A = 24        # piksel „jest”
PELNY = 200        # pełne krycie
JASNY = 240        # suma RGB: nie obrys
MIN_CIAG = 6       # tyle pikseli prostej krawędzi uznajemy za ucięcie
# „Krzyk” to kadr twarzy po szyję: rysunek celowo dotyka dolnej krawędzi pliku (10-19)
WYJATKI = {"instr-krzyk.webp": {"dolny"}}
# ikony GRUP instrumentów (zapas dla plikPiktogramu, starsza partia, 90 px) nie są naklejkami z drogi nagród
GRUPY = {"instr-dety.webp", "instr-elektroniczny.webp", "instr-klawisz.webp", "instr-strunowy.webp"}

WYNIK = {"ok": 0, "zle": 0}


def check(nazwa, warunek, info=""):
    if warunek:
        WYNIK["ok"] += 1
        print("PASS  %s" % nazwa)
    else:
        WYNIK["zle"] += 1
        print("FAIL  %s   %s" % (nazwa, info))


try:
    from PIL import Image
except ImportError:
    print("SKIP  ikony instrumentów: brak Pillow")
    print("0 passed, 0 failed")
    sys.exit(0)


def ciecia(sciezka):
    """{bok: długość prostej jasnej krawędzi} dla boków, które wyglądają na ucięte."""
    im = Image.open(sciezka).convert("RGBA")
    w, h = im.size
    px = im.load()

    def jasny(p):
        return p[3] > PELNY and (p[0] + p[1] + p[2]) > JASNY

    def skraj(bok, i):
        if bok in ("prawy", "lewy"):
            rng = range(w - 1, -1, -1) if bok == "prawy" else range(w)
            for x in rng:
                if px[x, i][3] > PROG_A:
                    return x, px[x, i]
        else:
            rng = range(h - 1, -1, -1) if bok == "dolny" else range(h)
            for y in rng:
                if px[i, y][3] > PROG_A:
                    return y, px[i, y]
        return None

    out = {}
    for bok in ("prawy", "lewy", "gorny", "dolny"):
        n = h if bok in ("prawy", "lewy") else w
        naj = bie = 0
        ost = None
        for i in range(n):
            r = skraj(bok, i)
            if r is None:
                bie, ost = 0, None
                continue
            k, p = r
            if k == ost and jasny(p):
                bie += 1
                naj = max(naj, bie)
            else:
                bie, ost = (1 if jasny(p) else 0), k
        if naj >= MIN_CIAG:
            out[bok] = naj
    return out, im.size


pliki = sorted(f for f in os.listdir(IKONY) if f.startswith("instr-") and f.endswith(".webp"))
check("katalog ikon instrumentów nie jest pusty (%d plików)" % len(pliki), len(pliki) >= 40, IKONY)

zle = {}
for f in pliki:
    c, rozmiar = ciecia(os.path.join(IKONY, f))
    c = {k: v for k, v in c.items() if k not in WYJATKI.get(f, set())}
    if c:
        zle[f] = "%dx%d %s" % (rozmiar[0], rozmiar[1], c)
check("żadna ikona instrumentu nie ma prostej, pozbawionej obrysu krawędzi (ucięcia)",
      not zle, "; ".join("%s %s" % (k, v) for k, v in sorted(zle.items())))

# naklejki trzymają dłuższy bok 96 px plus 8 px przezroczystego marginesu z każdej strony
zly_bok = {}
for f in pliki:
    if f in GRUPY:
        continue
    im = Image.open(os.path.join(IKONY, f))
    bb = im.convert("RGBA").getchannel("A").point(lambda v: 255 if v > PROG_A else 0).getbbox()
    if not bb:
        zly_bok[f] = "pusty plik"
        continue
    dluzszy = max(bb[2] - bb[0], bb[3] - bb[1])
    if dluzszy != 96:
        zly_bok[f] = "dłuższy bok rysunku %d px" % dluzszy
check("rysunek każdej ikony ma dłuższy bok 96 px (jak reszta naklejek gry)",
      not zly_bok, "; ".join("%s: %s" % (k, v) for k, v in sorted(zly_bok.items())))

print("%d passed, %d failed" % (WYNIK["ok"], WYNIK["zle"]))
sys.exit(1 if WYNIK["zle"] else 0)
