# RibbitBeat (web/gry/): awatary żab kont (2026-10-19). Run: py tests/test_gry_awatary.py
#
# Awatary żab w „kto gra”, inne niż żaby dostępne do śpiewania.
# Co pilnuje:
#  1. higiena: node --check js/awatary.js, js/konta.js, js/profile.js, js/postepy.js, bez pauz „—” w nowym module,
#  2. kolejność skryptów i arkuszy: js/awatary.js przed js/konta.js i js/profile.js, klasy awatarów w CSS,
#  3. kontrakt okna „Kto gra na tym komputerze?” (js/konta.js): awatar na kaflu, przy zakładaniu konta, w podoknie
#     zmiany i na plakietce #menuKonto, zapis przez Postepy.awatar,
#  4. okno „Profile” (js/profile.js): awatar w wierszu profilu, na kaflu „Kto gra?” i w podoknie zmiany,
#  5. w Node (tests/gry_awatary_harness.mjs): lista awatarów (ile, unikalne id, ŻADNE id nie jest motywem, czyli
#     skinem do śpiewania), pliki naszywek (.webp z alfą we własnym katalogu, nic spoza listy, żaden nie jest
#     bajt w bajt skinem motywu ani klatką śpiewu: porównanie po skrócie SHA-1), znacznik <img> (ścieżka względna,
#     aria-hidden, puste alt, rozmiar tylko z opcji), domyślny awatar z klucza profilu dla kont bez zapisanego pola,
#     nazwy PL i EN każdego awatara, grupa radio wyboru (role, aria-label, aria-checked, klik) oraz pole `awatar`
#     w profilu (zapis, odczyt po przeładowaniu, złe id, zmiana nazwy, wyzerowanie, usunięcie, eksport i import).
#  6. grafiki powstają generatorem obrazów (Codex) skryptami poza repozytorium, nie w kodzie
#     (trzy referencje: logo, plansza stylu i zdjęcie naszywki).
# Brak Node = SKIP (nie udawane).
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
    html = czytaj("index.html")
    poz = lambda t: html.find(t) if html.find(t) >= 0 else 10 ** 9
    check("index.html: js/awatary.js przed js/konta.js i js/profile.js (oba je pokazują)",
          poz('<script src="js/awatary.js">') < poz('<script src="js/konta.js">') < poz('<script src="js/profile.js">'))

    aw = czytaj("js", "awatary.js")
    check("awatary.js: bez pauz „—” (jak reszta plików gry)", "—" not in aw)
    kod = re.sub(r"^\s*//.*$", "", aw, flags=re.M)   # nagłówek modułu wymienia skiny z nazwy, więc liczy się sam kod
    check("awatary.js: grafiki tylko z web/assets/frog/awatary/ (nigdy skiny motywów ani klatki śpiewu)",
          'KATALOG="../assets/frog/awatary/"' in kod and not re.search(r"motywy/|sing-|mascot|zaba-oszust", kod))
    pliki = sorted(f for f in os.listdir(os.path.join(REPO, "web", "assets", "frog", "awatary")) if f.endswith(".webp"))
    check("web/assets/frog/awatary/: dziesięć naszywek .webp z generatora (prompty_awatary.py → generuj_awatary.py → obrobka_awatary.py)",
          len(pliki) == 10, ", ".join(pliki))

    konta = czytaj("js", "konta.js")
    check("konta.js: awatar na kaflu konta, przy zakładaniu konta, w podoknie zmiany i na plakietce #menuKonto; zapis przez Postepy.awatar",
          "widokAwatar" in konta and "Awatary.wybor" in konta and "Postepy.awatar" in konta and
          "awatar-kafel" in konta and "awatar-plakietka" in konta and 'awatar:widokAwatar' in konta and
          'T.profAwatar' in konta and "menu-konto-inicjal" in konta,
          [s for s in ["widokAwatar", "Awatary.wybor", "Postepy.awatar", "awatar-kafel", "awatar-plakietka"] if s not in konta])
    check("konta.js: bez modułu awatarów okno działa jak przedtem (litera w kółku)",
          'typeof Awatary!=="undefined"' in konta and "toLocaleUpperCase" in konta)

    prof = czytaj("js", "profile.js")
    check("profile.js: awatar w wierszu profilu, na kaflu „Kto gra?” i w podoknie zmiany",
          "awatar:widokAwatar" in prof and "awatar-mini" in prof and "awatar-kafel-obraz" in prof and
          'pokaz("awatar"' in prof and "Postepy.awatar" in prof,
          [s for s in ["awatar:widokAwatar", "awatar-mini", "awatar-kafel-obraz", 'pokaz("awatar"'] if s not in prof])

    css = czytaj("gry-profile.css")
    check("gry-profile.css: klasy awatara (wiersz, kafel, przycisk, wybór) i zaznaczenie wybranej żaby",
          all(k in css for k in [".awatar-mini", ".awatar-kafel", ".awatar-kafel-obraz", ".awatar-opcja", ".awatar-paleta"]) and
          '.awatar-opcja[aria-checked="true"]' in css)
    check("gry-konta.css: awatar w kółku plakietki", ".awatar-plakietka" in czytaj("gry-konta.css"))

    for plik in ["awatary.js", "konta.js", "profile.js", "postepy.js"]:
        node = shutil.which("node")
        if not node:
            break
        r = subprocess.run([node, "--check", os.path.join(GRY, "js", plik)], capture_output=True, text=True, encoding="utf-8")
        check("node --check web/gry/js/" + plik, r.returncode == 0, (r.stderr or "")[:400])

    node = shutil.which("node")
    if not node:
        print("SKIP  testy w Node   brak node w PATH")
        return
    r = subprocess.run([node, os.path.join(REPO, "tests", "gry_awatary_harness.mjs")], capture_output=True, text=True, encoding="utf-8")
    try:
        wynik = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception:
        check("gry_awatary_harness.mjs zwraca JSON", False, (r.stderr or r.stdout or "")[:800])
        return
    for nazwa, ok, szczegol in wynik["checks"]:
        check(nazwa, ok, szczegol)


if __name__ == "__main__":
    main()
    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1 if _failed else 0)
