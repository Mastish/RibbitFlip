# -*- coding: utf-8 -*-
"""RIBBITBEAT: GRAFIKI MENU I PODMENU WCZYTANE POD EKRANEM WCZYTYWANIA (2026-11-18).

Objaw: menu, lobby i okna doczytywały obrazki dopiero przy pierwszym wejściu na dany ekran (kapsle, ikony
instrumentów, głowy robo-żab, kursory). Lista web/gry/js/zasoby-menu.js powstaje z tools/ribbitbeat_zasoby_menu.py,
a gra wczytuje ją w kroku „pliki menu”. Test pilnuje, żeby lista nie rozjechała się z katalogami grafik i żeby
krok był podpięty.

Statycznie, bez przeglądarki.

Uruchomienie: py tests/test_gry_zasoby_menu.py
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRY = os.path.join(ROOT, "web", "gry")
ASSETS = os.path.join(ROOT, "web", "assets")
sys.path.insert(0, os.path.join(ROOT, "tools"))
import ribbitbeat_zasoby_menu as narzedzie  # noqa: E402

passed = failed = 0


def ok(cond, msg):
    global passed, failed
    if cond:
        passed += 1
    else:
        failed += 1
        print("FAIL  %s" % msg)


def czytaj(*czesci):
    return io.open(os.path.join(GRY, *czesci), encoding="utf-8").read()


plik = czytaj("js", "zasoby-menu.js")
pliki = re.findall(r'^  "([^"]+)",$', plik, re.M)

ok(plik == narzedzie.tresc(narzedzie.lista()),
   "js/zasoby-menu.js jest aktualny (po zmianie grafik: py tools/ribbitbeat_zasoby_menu.py)")
ok(len(pliki) > 100, "lista ma grafiki menu (%d)" % len(pliki))
brak = [p for p in pliki if not os.path.isfile(os.path.join(ASSETS, *p.split("/")))]
ok(not brak, "każdy plik z listy istnieje w web/assets (brak: %s)" % ", ".join(brak[:5]))
ok(not [p for p in pliki if p.startswith(("motywy/", "fonts/"))],
   "na liście nie ma grafik motywów ani fontów (motyw ładuje lobby, fonty mają własny krok)")
for kat in ("icons/gry/", "caps/", "cursor/", "frog/robo/"):
    ok(any(p.startswith(kat) for p in pliki), "lista obejmuje %s" % kat)
kb = sum(os.path.getsize(os.path.join(ASSETS, *p.split("/"))) for p in pliki if p not in brak) // 1024
ok(kb < 8000, "lista nie puchnie ponad 8 MB (jest %d kB): to ma być krótki krok startu" % kb)

html = czytaj("index.html")
ok(html.count('<script src="js/zasoby-menu.js"></script>') == 1, "index.html ładuje js/zasoby-menu.js raz")
ok(html.index("js/zasoby-menu.js") < html.index("js/zabi-chor.js"), "lista ładuje się przed zabi-chor.js")

gra = czytaj("js", "zabi-chor.js")
ok('["pliki menu",()=>wczytajZasobyMenu(' in gra, "krok „pliki menu” jest w krokach ekranu wczytywania")
ok(gra.index('["obrazki",') < gra.index('["pliki menu",') < gra.index('["ekrany lobby",'),
   "pliki menu wczytują się przed rozgrzewką ekranów lobby")
m = re.search(r"function wczytajZasobyMenu\(postep\)\{(.*?)\n\}", gra, re.S)
ok(m is not None and "Promise.race" in m.group(1) and "ZC_PLIKI_MENU_MAKS_MS" in m.group(1),
   "wczytywanie plików menu ma limit czasu (brak pliku albo wolny dysk nie zatrzymuje startu)")
ok(m is not None and "R.zasobyMenu" in m.group(1), "wczytane obrazki zostają w pamięci (R.zasobyMenu)")

wcz = czytaj("js", "wczytywanie.js")
maks = re.search(r"const MAKS_MS=(\d+)", wcz)
ok(maks is not None and int(maks.group(1)) >= 12000, "bezpiecznik ekranu wczytywania mieści dłuższy start")

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
