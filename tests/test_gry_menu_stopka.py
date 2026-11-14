# -*- coding: utf-8 -*-
"""MENU RIBBITBEAT: JEDNA PODPOWIEDŹ, JAK DOŁĄCZYĆ (2026-10-26).

Błąd: stopka menu z czekającym kapslem pokazywała tę samą informację dwa razy.
Nad pigułką z klawiszami („… Kapsel dołącza przyciskiem, potem przechyłem prowadzi łapkę, a naciśnięciem klika.”)
stała taśma stanu z drugim zdaniem o tym samym („Dołączasz przyciskiem kapsla albo pada…”), bo
#lobbyStan wędruje do gniazda „stan” każdego ekranu razem z tym zdaniem. W menu taśma ma pokazywać
tylko kapsle czekające na przycisk i łączność; na ekranach lobby (stopka bez pigułki) zdanie zostaje.

Statycznie, bez przeglądarki: struktura index.html i reguła w gry-menu-koncert.css.

Uruchomienie: py tests/test_gry_menu_stopka.py
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRY = os.path.join(ROOT, "web", "gry")

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


html = czytaj("index.html")
stopka = html[html.index('<div class="menu-stopka">'):]
stopka = stopka[:stopka.index('<div class="menu-linki">')]
ok('class="menu-dol" data-gniazdo="stan"' in stopka, "taśma stanu menu (gniazdo „stan”) siedzi w .menu-stopka")
ok('data-t="menuKlawisze"' in stopka, "pigułka z klawiszami siedzi w .menu-stopka")

schowek = html[html.index('id="lobbyStan"'):]
schowek = schowek[:schowek.index("</div>\n  </div>")] if "</div>\n  </div>" in schowek else schowek[:600]
ok('class="jak-dolaczyc"' in schowek, "zdanie „jak dołączyć” należy do #lobbyStan (wędruje z nim)")
ok('id="czekajace"' in schowek, "lista czekających kapsli należy do #lobbyStan")
ok(html.count('data-gniazdo="stan"') >= 2, "gniazdo „stan” jest w menu i na ekranach lobby")

css = czytaj("gry-menu-koncert.css")
ok(re.search(r"\.menu-stopka\s+\.menu-dol\s+\.jak-dolaczyc\s*\{\s*display\s*:\s*none", css) is not None,
   "w menu taśma stanu nie powtarza zdania „jak dołączyć”")
SAMO = re.compile(r"(^|\})\s*\.jak-dolaczyc\s*\{[^}]*display\s*:\s*none", re.M)   # reguła z samym .jak-dolaczyc
ok(SAMO.search(css) is None and SAMO.search(czytaj("gry.css")) is None,
   "poza menu zdanie zostaje (żadnej reguły chowającej je wszędzie)")

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
