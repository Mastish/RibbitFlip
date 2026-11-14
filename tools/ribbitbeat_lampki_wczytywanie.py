# -*- coding: utf-8 -*-
"""RibbitBeat: lampy girlandy na ekranie wczytywania w trzech kolorach, w jednym pliku.

Bierze filcową żarówkę z menu (web/assets/koncert/lampa.webp) i składa trzy warianty obok siebie: róż, bursztyn
(oryginał) i zieleń. Barwa zmienia się tylko na nasyconych pikselach, czyli na kuli; oprawka i sznur zostają.
Ekran wczytywania (web/gry/index.html, .wcz-lampa) wybiera kolor przez object-position, więc ładuje jeden plik.

Po podmianie lampa.webp uruchom ponownie, a potem `py tools/ribbitbeat_zasoby_menu.py`.

    py tools/ribbitbeat_lampki_wczytywanie.py
"""
import colorsys
import os

from PIL import Image

KONCERT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web", "assets", "koncert")
# (barwa 0–1 albo None = bez zmian, mnożnik nasycenia, mnożnik jasności)
WARIANTY = [(329 / 360.0, .95, 1.0), (None, 1.0, 1.0), (86 / 360.0, .72, .98)]


def wariant(im, barwa, nasycenie, jasnosc):
    wynik = im.copy()
    if barwa is None:
        return wynik
    px = wynik.load()
    for y in range(wynik.height):
        for x in range(wynik.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
            if s < .25:
                continue
            k = min(1.0, (s - .25) / .2)   # miękkie przejście przy oprawce
            r2, g2, b2 = colorsys.hsv_to_rgb(barwa, min(1.0, s * nasycenie), min(1.0, v * jasnosc))
            px[x, y] = (round(r + (r2 * 255 - r) * k), round(g + (g2 * 255 - g) * k), round(b + (b2 * 255 - b) * k), a)
    return wynik


def main():
    im = Image.open(os.path.join(KONCERT, "lampa.webp")).convert("RGBA")
    pasek = Image.new("RGBA", (im.width * len(WARIANTY), im.height))
    for i, w in enumerate(WARIANTY):
        pasek.paste(wariant(im, *w), (im.width * i, 0))
    cel = os.path.join(KONCERT, "lampki-wczytywanie.webp")
    pasek.save(cel, "WEBP", quality=84, method=6)
    print("zapisano %s: %d×%d, %d kB" % (os.path.relpath(cel), pasek.width, pasek.height, os.path.getsize(cel) // 1024))


if __name__ == "__main__":
    main()
