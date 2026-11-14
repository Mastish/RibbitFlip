# RibbitBeat (web/gry/): kto wybiera planszę i jak wygląda jej wybór. Run: py tests/test_gry_wybor_planszy.py
#
# Wymagania: przy wyborze planszy widać awatar gracza wybierającego, plansze są posortowane według jakości,
# wybór planszy przez gracza pomija losowanie z poprzedniej planszy, są też opcje „wybierz losową”
# i „wybierają wszyscy”.
#
# Co pilnuje:
#  1. kod: trzy tryby w jednym miejscu (ZC_PLANSZA_TRYBY), tryb w ustawieniach gry (S.ust.planszaTryb),
#     wskazanie planszy w oknie „Plansza” przestawia tryb na „ta”, a napisy trybów są po polsku i angielsku,
#  2. w prawdziwej przeglądarce (tests/gry_wybor_planszy.mjs, Chromium + Playwright): pasek „Plansza” z trzema
#     opcjami, okno po „Śpiewamy!” (kafle wg rzadkości, awatar wybierającego na liście i na kaflu z kursorem),
#     „Wybierz losową” bez wybierania, „Ta plansza” bez okna i pamięć trybu między grami.
# Czyste funkcje (planPlanszy, planszeWgJakosci) liczy tests/test_gry_zabi_chor.py w harnessie Node.
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


def main():
    zc = czytaj("js", "zabi-chor.js")
    en = czytaj("js", "jezyk-en.js")

    # ---- 1. kod ------------------------------------------------------------------------------------------------
    check("zabi-chor.js: trzy tryby planszy stoją w jednej stałej (ZC_PLANSZA_TRYBY)",
          re.search(r'const ZC_PLANSZA_TRYBY=\["wszyscy","los","ta"\]', zc) is not None)
    check("zabi-chor.js: tryb planszy ma domyślną wartość w ustawieniach gry (zapis w localStorage)",
          re.search(r"planszaTryb:\"wszyscy\"", zc) is not None)
    check("zabi-chor.js: „Śpiewamy!” pyta planPlanszy, co zrobić z planszą (okno / losowanie / bez okna)",
          re.search(r"function rozstrzygnijPlansze\(\)\{[\s\S]{0,400}?planPlanszy\(trybPlanszy\(\)", zc) is not None)
    check("zabi-chor.js: wskazanie planszy w oknie „Plansza” przestawia tryb na „ta” (pominięte losowanie)",
          re.search(r"function wybierzWspolny\(tor,v\)\{[\s\S]{0,300}?S\.ust\.planszaTryb=\"ta\";zapiszUstawienia\(\)", zc) is not None)
    check("zabi-chor.js: okno wyboru układa kafle wg jakości (planszeWgJakosci) i znakuje ich rzadkość",
          "planszeWgJakosci(Postepy.drabinka(tor)" in zc and "k.dataset.rz=rz" in zc)
    check("zabi-chor.js: żeton wybierającego to awatar konta, a bez modułu awatarów zostaje kropka",
          re.search(r"function znaczekGracza\(g,klasa\)\{[\s\S]{0,320}?plansza-kropka", zc) is not None
          and "Awatary.dla(Postepy.kluczProfilu(n),Postepy.awatar(n))" in zc)
    check("gry.css: opcje trybu i awatar w oknie mają swoje style (plansza-tryb, wp-awatar)",
          all(s in czytaj("gry.css") for s in [".plansza-tryb{", ".plansza-tryb-opcja{", ".wp-awatar{", '.wp-kafel[data-rz="legendarny"]']))
    for klucz in ["planszaTrybEt", "planszaTryb_wszyscy", "planszaTryb_los", "planszaTryb_ta",
                  "planszaTrybOpis_wszyscy", "planszaTrybOpis_los", "planszaTrybOpis_ta", "wpLosTytul", "wpLosOpis"]:
        check("napis %s jest po polsku i po angielsku" % klucz,
              (klucz + ":\"") in zc and (klucz + ":\"") in en)

    # ---- 2. prawdziwa przeglądarka -------------------------------------------------------------------------------
    node = shutil.which("node")
    if not node:
        print("SKIP  testy w przeglądarce   brak node w PATH")
        return
    r = subprocess.run([node, "--check", os.path.join(GRY, "js", "zabi-chor.js")], capture_output=True, text=True, encoding="utf-8")
    check("node --check web/gry/js/zabi-chor.js", r.returncode == 0, (r.stderr or "")[:400])

    harness = os.path.join(REPO, "tests", "gry_wybor_planszy.mjs")
    try:
        out = subprocess.run([node, harness], capture_output=True, text=True, timeout=420, encoding="utf-8")
        dane = json.loads(out.stdout.strip().splitlines()[-1])
    except Exception as e:
        check("gry_wybor_planszy.mjs zwraca JSON", False, str(e)[:400])
        return
    if "pominiete" in dane:
        print("SKIP  wybór planszy w przeglądarce: " + dane["pominiete"])
        return
    for nazwa, ok, szczegol in dane.get("checks", []):
        check(nazwa, ok, szczegol)


if __name__ == "__main__":
    main()
    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1 if _failed else 0)
