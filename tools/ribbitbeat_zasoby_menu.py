# -*- coding: utf-8 -*-
"""Lista grafik menu i podmenu RibbitBeat do wczytania pod ekranem wczytywania (narzędzie DEWELOPERSKIE).

    py tools/ribbitbeat_zasoby_menu.py            # zapisuje web/gry/js/zasoby-menu.js
    py tools/ribbitbeat_zasoby_menu.py --sprawdz  # nic nie zapisuje; kod wyjścia 1, gdy plik jest nieaktualny

Gra doczytywała obrazki menu, lobby i okien dopiero przy pierwszym wejściu na dany ekran (kapsle, ikony instrumentów,
głowy robo-żab, kursory), co było widać jako zacięcie albo pusty kafel. Przeglądarka nie umie wylistować katalogu,
więc lista powstaje tutaj i trafia do repo jako zwykły plik JS; gra wczytuje ją w kroku „pliki menu”
(web/gry/js/zabi-chor.js: wczytajZasobyMenu).

Co wchodzi na listę:
  * całe katalogi grafik interfejsu gry (KATALOGI),
  * pojedyncze pliki z innych katalogów, wskazane po nazwie w kodzie gry (js, css, html),
  * ikony panelu, których gra używa przez nazwę („app/kosz” w zabi-chor.js, ikona("kosz") w Studiu).
Co NIE wchodzi: grafiki motywów (web/assets/motywy, 27 MB; gra ładuje motyw wybranej planszy w lobby), fonty
(mają własny krok wczytywania) i wszystko, czego gra nie używa.

Po dodaniu albo usunięciu grafiki w tych katalogach uruchom narzędzie jeszcze raz; pilnuje tego
tests/test_gry_zasoby_menu.py.
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "web", "assets")
GRY = os.path.join(ROOT, "web", "gry")
WYNIK = os.path.join(GRY, "js", "zasoby-menu.js")

KATALOGI = ["icons/gry", "caps", "cursor", "frog", "flagi", "koncert", "knobs"]
OBRAZKI = (".png", ".webp", ".svg", ".jpg", ".jpeg", ".gif")
POMIN_KATALOGI = ("motywy/", "fonts/")


def z_katalogow():
    pliki = set()
    for kat in KATALOGI:
        for sciezka, _, nazwy in os.walk(os.path.join(ASSETS, *kat.split("/"))):
            for n in nazwy:
                if n.lower().endswith(OBRAZKI):
                    pliki.add(os.path.relpath(os.path.join(sciezka, n), ASSETS).replace(os.sep, "/"))
    return pliki


def z_kodu():
    """Pliki wskazane w kodzie gry dosłownie: ../assets/<ścieżka>.<rozszerzenie obrazka>."""
    wzor = re.compile(r"\.\./assets/([A-Za-z0-9_./-]+?\.(?:png|webp|svg|jpe?g|gif))")
    pliki = set()
    zrodla = [os.path.join(GRY, n) for n in os.listdir(GRY) if n.endswith((".css", ".html"))]
    for sciezka, _, nazwy in os.walk(os.path.join(GRY, "js")):
        zrodla += [os.path.join(sciezka, n) for n in nazwy if n.endswith(".js") and n != "zasoby-menu.js"]
    for z in zrodla:
        for m in wzor.finditer(io.open(z, encoding="utf-8").read()):
            p = m.group(1)
            if not p.startswith(POMIN_KATALOGI) and os.path.isfile(os.path.join(ASSETS, *p.split("/"))):
                pliki.add(p)
        # ikony panelu po nazwie: "app/<nazwa>" (ikonaFilc w zabi-chor.js) i ikona("<nazwa>") w Studiu → icons/<nazwa>.png
        tekst = io.open(z, encoding="utf-8").read()
        nazwy = re.findall(r'"app/([a-z0-9_-]+)"', tekst)
        if os.path.basename(z).startswith("studio"):
            nazwy += re.findall(r'ikona\("([a-z0-9_-]+)"', tekst)
        for n in nazwy:
            if os.path.isfile(os.path.join(ASSETS, "icons", n + ".png")):
                pliki.add("icons/%s.png" % n)
    return pliki


def lista():
    return sorted(z_katalogow() | z_kodu())


def tresc(pliki):
    wiersze = ['"use strict";',
               "// ===== RIBBITBEAT: grafiki menu i podmenu do wczytania pod ekranem wczytywania =====",
               "// PLIK GENEROWANY: py tools/ribbitbeat_zasoby_menu.py (nie edytuj ręcznie; pilnuje tests/test_gry_zasoby_menu.py).",
               "// Ścieżki względem web/assets/. Gra wczytuje je w kroku „pliki menu” (zabi-chor.js: wczytajZasobyMenu).",
               "const ZC_ZASOBY_MENU=["]
    wiersze += ['  "%s",' % p for p in pliki]
    wiersze += ["];", 'if(typeof window!=="undefined")window.ZC_ZASOBY_MENU=ZC_ZASOBY_MENU;', ""]
    return "\n".join(wiersze)


def main():
    pliki = lista()
    nowa = tresc(pliki)
    stara = io.open(WYNIK, encoding="utf-8").read() if os.path.isfile(WYNIK) else None
    kb = sum(os.path.getsize(os.path.join(ASSETS, *p.split("/"))) for p in pliki) // 1024
    if "--sprawdz" in sys.argv:
        print("zasoby-menu.js: %s (%d plików, %d kB)" % ("aktualny" if stara == nowa else "NIEAKTUALNY", len(pliki), kb))
        return 0 if stara == nowa else 1
    io.open(WYNIK, "w", encoding="utf-8", newline="\n").write(nowa)
    print("zapisano %s: %d plików, %d kB" % (os.path.relpath(WYNIK, ROOT), len(pliki), kb))
    return 0


if __name__ == "__main__":
    sys.exit(main())
