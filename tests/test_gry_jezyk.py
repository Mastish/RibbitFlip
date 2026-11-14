# RibbitBeat (web/gry/): wersja angielska gry (2026-10-10).
# Run: py tests/test_gry_jezyk.py
#
# Co pilnuje (tests/gry_jezyk_harness.mjs w Node, bez przeglądarki):
#  1. node --check js/jezyk.js i js/jezyk-en.js,
#  2. każdy klucz słownika T z zabi-chor.js ma tłumaczenie w RB_EN.T: niepuste, z tymi samymi {zmiennymi}, obiekty
#     i listy o tych samych kluczach i długościach, bez nadmiarowych kluczy, bez polskich liter (poza nazwami własnymi),
#  3. osiągnięcia i kategorie (postepy.js), wbudowane piosenki (piosenki.js) i każdy plik motywu (pole en) mają EN,
#  4. wybór języka w jezyk.js (od 10-10 domyślnie polski): ?jezyk=, zapis gry ważny, dopóki jawny wybór w panelu ten sam,
#     jawny wybór w panelu (ribbitflip.lang); Windows, przeglądarka i RIBBITFLIP_LANG nie głosują; ustaw() zapisuje, wysyła „rb-jezyk”
#     i przeładowuje; RBJezyk.blad tłumaczy komunikaty parsera MIDI i serwera,
#  5. index.html ładuje jezyk.js i jezyk-en.js przed piosenki.js (kolejne pliki tłumaczą definicje przy wczytaniu).
# Polska gra (domyślna w testach) jest pilnowana bez zmian przez test_gry_zabi_chor.py i test_gry_postepy.py.
# Brak Node = SKIP (nie udawane).
import json
import os
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


def main():
    html = open(os.path.join(GRY, "index.html"), encoding="utf-8").read()
    poz = lambda t: html.find(t) if html.find(t) >= 0 else 10 ** 9
    check("index.html: jezyk.js, potem jezyk-en.js, oba przed piosenki.js",
          poz('<script src="js/jezyk.js">') < poz('<script src="js/jezyk-en.js">') < poz('<script src="js/piosenki.js">'))
    node = shutil.which("node")
    if not node:
        print("SKIP  testy w Node   brak node w PATH")
        return
    for p in ["jezyk.js", "jezyk-en.js"]:
        r = subprocess.run([node, "--check", os.path.join(GRY, "js", p)], capture_output=True, text=True, encoding="utf-8")
        check("node --check web/gry/js/" + p, r.returncode == 0, (r.stderr or "")[:400])
    r = subprocess.run([node, os.path.join(REPO, "tests", "gry_jezyk_harness.mjs")], capture_output=True, text=True, encoding="utf-8")
    try:
        wynik = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception:
        check("gry_jezyk_harness.mjs zwraca JSON", False, (r.stderr or r.stdout or "")[:600])
        return
    for nazwa, ok, szczegol in wynik["checks"]:
        check(nazwa, ok, szczegol)


if __name__ == "__main__":
    main()
    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1 if _failed else 0)
