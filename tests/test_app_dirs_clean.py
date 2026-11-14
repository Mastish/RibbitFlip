# -*- coding: utf-8 -*-
"""KORZEŃ KATALOGU APLIKACJI NALEŻY DO APLIKACJI.

Luźne pliki obok `RibbitFlip.exe` to bałagan, którego nie chce ani autor, ani użytkownicy.
Powód był prosty i powtarzalny: preset wylądował luzem obok
`RibbitFlip.exe`, bo „to blisko aplikacji".

Aplikacja trzyma w `_app_dir()` plik wykonywalny, `ribbitflip.log` i trzy katalogi, które sama
czyta i zapisuje: `Settings\\`, `Library\\` i `Zgloszenia\\`. Wszystko inne w tym miejscu jest
śmieciem: panel tego nie widzi, nikt tego nie czyta, a przy kopiowaniu albo spakowaniu aplikacji
jedzie razem z nią. Miejsce pliku do wczytania i tak NIE MA ZNACZENIA — zestaw i preset wczytuje
się upuszczeniem na okno albo przez „Wymianę", więc plik położony „bliżej aplikacji" nie staje się
przez to dostępniejszy.

Sprawdzane w obu korzeniach, bo `_app_dir()` to raz `dist\\` (uruchomienie z .exe), a raz katalog
skryptu (uruchomienie ze źródeł).

Uruchomienie: py tests/test_app_dirs_clean.py
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

passed = failed = 0


def ok(cond, msg):
    global passed, failed
    if cond:
        passed += 1
    else:
        failed += 1
        print("FAIL  %s" % msg)


for d in (os.path.join(ROOT, "dist"), ROOT):
    if not os.path.isdir(d):
        continue
    luzem = [f for f in os.listdir(d)
             if f.lower().endswith(".json") and os.path.isfile(os.path.join(d, f))]
    ok(not luzem, "luzne pliki .json w korzeniu %s: %s" % (d, luzem))

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
