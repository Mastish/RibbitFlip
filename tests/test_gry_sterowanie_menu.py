# RibbitBeat (web/gry/): sterowanie działa w KAŻDYM menu gry. Run: py tests/test_gry_sterowanie_menu.py
#
# Sterowanie musi działać w każdym menu gry: gra jest przede wszystkim demonstracją kapsla
# w kontekście gry.
#
# Co pilnuje:
#  1. higiena: node --check plików, które sterują menu,
#  2. JEDNA definicja „jesteśmy w menu” (menuWlaczone) dla pada (Wejscie.ustawMenu) i dla kapsla (krokPilotow):
#     dopóki obie strony liczą to samo, nie da się dodać ekranu, na którym działa jedno, a drugie nie,
#  3. pilot kapsla liczy się w KAŻDEJ klatce gry (krok), a nie tylko w kroku lobby — inaczej w pauzie, na wynikach
#     i w samouczku kapsel nie rusza fokusu (tak było do 10-20),
#  4. KAŻDE okno gry jest w nakladkaLobby(): to ta lista mówi padowi i kapslowi, po czym chodzić i co zamyka
#     „wstecz”. Okna spoza listy zostawiały sterowanie na ekranie POD sobą. Nowe okno w kodzie = test czerwony,
#     dopóki ktoś nie dopisze go do listy albo do wyjątków (z powodem),
#  5. w prawdziwej przeglądarce (tests/gry_sterowanie_menu.mjs, Chromium + Playwright): pad i KAPSEL w menu
#     głównym, w Utworach, w oknach (tablica, licencje, pomoce, „Dodaj gracza”, lista partii), w pauzie,
#     na wynikach, w kole nagród, w samouczku oraz w oknach „Zgłoś błąd” i karty trybu oszusta.
#     Kapsel udajemy zdarzeniami strumienia aplikacji (devmeta/s/b), pad atrapą Gamepad API.
# Brak Node albo globalnego @playwright/test = SKIP sprawdzeń w przeglądarce (nie udawane).
import json
import os
import re
import shutil
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRY = os.path.join(REPO, "web", "gry")

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s   %s" % (name, detail))


def czytaj(*czesci):
    with open(os.path.join(GRY, *czesci), encoding="utf-8") as f:
        return f.read()


# Okna, które mają własne sterowanie i dlatego NIE są nakładkami lobby (powód przy każdym).
WYJATKI = {
    "samouczek": "dymek samouczka: własne A/B pada (js/jak-grac.js) i kapsel przez krokPilotow",
    "losPlanszy": "okno wyboru planszy: każdy gracz prowadzi SWÓJ kursor (krokWyboruPlanszy)",
    "szuflada": "szuflada podglądu stoi W ekranie, nie nad nim; „wstecz” zamyka ją osobno",
}


def okna_w_kodzie():
    """Id kontenerów okien (role=dialog / aria-modal) z plików gry i z index.html."""
    znalezione = {}
    for plik in sorted(os.listdir(os.path.join(GRY, "js"))):
        if not plik.endswith(".js"):
            continue
        src = czytaj("js", plik)
        for m in re.finditer(r'\.id\s*=\s*"([A-Za-z][A-Za-z0-9_-]*)"', src):
            okolica = src[max(0, m.start() - 500):m.start() + 500]
            if "aria-modal" in okolica or 'role","dialog"' in okolica:
                znalezione.setdefault(m.group(1), plik)
    html = czytaj("index.html")
    for m in re.finditer(r'<(\w+)\s+id="([A-Za-z][\w-]*)"([^>]*)>', html):
        if "tablica" in m.group(3) or 'role="dialog"' in m.group(3):
            znalezione.setdefault(m.group(2), "index.html")
    # same tytuły, opisy, przyciski i zakładki okien to nie okna
    return {i: p for i, p in znalezione.items()
            if not re.search(r"(Tytul|Opis|Tresc|Pole|Blad)$", i) and not re.match(r"(btn|zak|panel)", i)}


def main():
    zc = czytaj("js", "zabi-chor.js")

    # ---- 2. jedna definicja menu dla obu sterowań --------------------------------------------------------------
    check("zabi-chor.js: pad dostaje menu z menuWlaczone (Wejscie.ustawMenu)",
          re.search(r"Wejscie\.ustawMenu\(menuWlaczone\s*,\s*nawigujLobby\)", zc) is not None)
    check("zabi-chor.js: kapsel liczy menu tą samą funkcją (krokPilotow → menuWlaczone)",
          re.search(r"function krokPilotow\(dt\)\{[\s\S]{0,900}?menuWlaczone\(\)", zc) is not None)
    check("zabi-chor.js: menuWlaczone obejmuje lobby, pauzę, wyniki i koło nagród",
          all(s in (re.search(r"function menuWlaczone\(\)\{[\s\S]*?\n\}", zc) or re.match("", "")).group(0)
              for s in ['S.ekran==="lobby"', "S.pauza", 'S.ekran==="wyniki"', "Nagrody.otwarte"]))

    # ---- 3. pilot w każdej klatce, nie tylko w lobby ------------------------------------------------------------
    krok = re.search(r"function krok\(dtWymuszone\)\{[\s\S]*?\n\}", zc)
    check("zabi-chor.js: krok() woła krokPilotow bezwarunkowo (pauza i wyniki to też menu)",
          krok is not None and re.search(r"^\s*krokPilotow\(", krok.group(0), re.M) is not None,
          "krokPilotow wołane warunkowo albo wcale")
    check("zabi-chor.js: w kroku lobby nie ma już osobnego pilota kapsla", "krokKapslaWLobby" not in zc)
    check("zabi-chor.js: w kole nagród przycisk kapsla jedzie do dźwigni, nie do pilota",
          re.search(r"if\(kolo\)\{[\s\S]{0,300}?Nagrody\.przytrzymaj\(dol,w\.id\)[\s\S]{0,120}?z\.ok=false;z\.wstecz=false;", zc) is not None)
    check("zabi-chor.js: wejście w menu z trzymanym kapslem nie klika i nie cofa (blokada)",
          re.search(r"if\(menu&&!pilotMenuPrzed\)[\s\S]{0,260}?blokada:!!w\.przycisk", zc) is not None)
    check("zabi-chor.js: na wynikach kapsel nie robi dwóch rzeczy naraz (pilot zamiast „jeszcze raz”)",
          re.search(r'S\.ekran==="wyniki"&&g&&w\.zrodlo!=="kapsel"', zc) is not None)
    check("jak-grac.js: samouczek mówi, kiedy stoi dymek (JakGrac.dymek dla pilota kapsla)",
          "get dymek()" in czytaj("js", "jak-grac.js"))

    # ---- 4. każde okno gry jest w nakladkaLobby() ---------------------------------------------------------------
    linia = re.search(r"function nakladkaLobby\(\)\{return \[([\s\S]*?)\]", zc)
    wliscie = set(re.findall(r'el\("([^"]+)"\)', linia.group(1))) if linia else set()
    check("zabi-chor.js: nakladkaLobby() ma okna dodane w 10-20 (Zgłoś błąd, karta trybu oszusta, lista partii)",
          {"zglosBlad", "menuDodatek", "ppWyborLista"} <= wliscie, sorted(wliscie))
    okna = okna_w_kodzie()
    brakuje = {i: p for i, p in okna.items() if i not in wliscie and i not in WYJATKI}
    check("każde okno gry jest w nakladkaLobby() albo ma udokumentowany wyjątek",
          not brakuje, "poza listą: " + ", ".join("%s (%s)" % (i, p) for i, p in sorted(brakuje.items())))
    check("lista partii w podglądzie ma czym się zamykać („wstecz” pada i kapsla)",
          "Biblioteka.zamknijWybor()" in zc and "zamknijWybor:" in czytaj("js", "biblioteka.js"))

    # ---- 1. higiena --------------------------------------------------------------------------------------------
    node = shutil.which("node")
    if not node:
        print("SKIP  node --check i testy w przeglądarce   brak node w PATH")
        return
    for plik in ["zabi-chor.js", "wejscie.js", "jak-grac.js", "biblioteka.js", "nagrody.js"]:
        r = subprocess.run([node, "--check", os.path.join(GRY, "js", plik)], capture_output=True, text=True, encoding="utf-8")
        check("node --check web/gry/js/" + plik, r.returncode == 0, (r.stderr or "")[:400])

    # ---- 5. prawdziwa przeglądarka -----------------------------------------------------------------------------
    harness = os.path.join(REPO, "tests", "gry_sterowanie_menu.mjs")
    try:
        out = subprocess.run([node, harness], capture_output=True, text=True, timeout=420, encoding="utf-8")
        dane = json.loads(out.stdout.strip().splitlines()[-1])
    except Exception as e:
        check("gry_sterowanie_menu.mjs zwraca JSON", False, str(e)[:400])
        return
    if "pominiete" in dane:
        print("SKIP  sterowanie w przeglądarce: " + dane["pominiete"])
        return
    for nazwa, ok, szczegol in dane.get("checks", []):
        check(nazwa, ok, szczegol)


if __name__ == "__main__":
    main()
    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1 if _failed else 0)
