# -*- coding: utf-8 -*-
"""RIBBITBEAT: PRÓBA EKRANÓW POD ZASŁONĄ STARTU (2026-11-18).

Objaw: pierwsze otwarcie ekranu lobby albo okna zacinało (wybór piosenki, Rozgrywka, Nagrody, Zgłoś błąd), każde
następne już nie, bo karta graficzna kompiluje programy przy pierwszym rysowaniu danego rodzaju rzeczy. Gra robi
więc to pierwsze otwarcie sama, pod zasłoną wczytywania (zabi-chor.js: probaEkranow). Żeby było to bezpieczne:
  * dopóki stoi zasłona, klawiatura i mysz nie docierają do gry (wczytywanie.js, pierwszy skrypt strony),
  * dźwięki interfejsu milczą, pad nie kręci kołem nagród, zapisany skład się nie odtwarza,
  * po próbie gra wraca do menu, także po błędzie.

Statycznie, bez przeglądarki; zachowanie w przeglądarce sprawdza smoke poza repozytorium.

Uruchomienie: py tests/test_gry_proba_ekranow.py
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
skrypty = re.findall(r'<script src="(js/[^"]+)"></script>', html)
ok(skrypty and skrypty[0] == "js/wczytywanie.js", "wczytywanie.js jest pierwszym skryptem strony (jego nasłuchy stoją przed innymi)")

wcz = czytaj("js", "wczytywanie.js")
m = re.search(r'for\(const z of \[([^\]]+)\]\)\s*addEventListener\(z,e=>\{if\(!gotowe\)e\.stopImmediatePropagation\(\);\},true\)', wcz)
ok(m is not None, "pod zasłoną zdarzenia wejścia są zatrzymywane w fazie przechwytywania, dopóki zasłona stoi")
zdarzenia = re.findall(r'"([a-z]+)"', m.group(1)) if m else []
for z in ("keydown", "keyup", "pointerdown", "click"):
    ok(z in zdarzenia, "zasłona zatrzymuje %s" % z)
ok(m is not None and "preventDefault" not in wcz[m.start():m.end()], "zasłona niczego nie anuluje (F5 i F11 działają dalej)")

gra = czytaj("js", "zabi-chor.js")
ok('["próba ekranów",()=>probaEkranow()]' in gra, "krok „próba ekranów” jest w krokach ekranu wczytywania")
ok(gra.index('["ekrany lobby",') < gra.index('["próba ekranów",') < gra.index('["menu",async'),
   "próba ekranów idzie po rozgrzewce ekranów lobby, przed pokazaniem menu")
f = re.search(r"async function probaEkranow\(\)\{(.*?)\n\}\n", gra, re.S)
ok(f is not None, "jest probaEkranow()")
cialo = f.group(1) if f else ""
ok('S.lobbyEkran!=="menu"' in cialo and "S.autoStart!=null" in cialo, "próba rusza tylko z menu (start od razu w Rozgrywce ją pomija)")
ok("S.skladOdtworzony=true" in cialo and "S.skladOdtworzony=sklad" in cialo, "zapisany skład nie odtwarza się w próbie i flaga wraca")
ok("finally{" in cialo and cialo.index("finally{") < cialo.index("S.probaEkranow=false"), "flaga próby gaśnie w finally (także po błędzie)")
ok('pokazLobby("menu")' in cialo[cialo.index("finally{"):] if "finally{" in cialo else False, "po próbie gra wraca do menu także po błędzie")
ok("Glos.wycisz(true)" in cialo and "Glos.wycisz(false)" in cialo, "dźwięk gry wyciszony na czas próby i przywrócony")
ok("LobbyScena.tempo(.5)" in cialo and "LobbyScena.tempo(1)" in cialo, "tempo przejść wraca do zwykłego")
ok("Wczytywanie.gotowe" in cialo, "próba przerywa się, gdy bezpiecznik zdjął zasłonę")

ok("S.probaEkranow" in czytaj("js", "dzwieki-ui.js"), "dźwięki interfejsu milczą w próbie ekranów")
nag = czytaj("js", "nagrody.js")
p = re.search(r"function przytrzymajZew\(wcisniete,kto\)\{\s*if\(([^\n]+)\)return false;", nag)
ok(p is not None and "S.probaEkranow" in p.group(1), "pad nie kręci kołem nagród w próbie ekranów")
ls = czytaj("js", "lobby-scena.js")
ok("tempo:tempoPrzejscia" in ls and "CZAS_BAZA" in ls, "lobby-scena.js udostępnia tempo przejścia i trzyma czasy bazowe")

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
