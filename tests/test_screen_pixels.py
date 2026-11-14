# PRAWDZIWE PIKSELE MONITORA vs PIKSELE KURSORA. Uruchom: py tests/test_screen_pixels.py
#
# CZEGO TO PILNUJE. Aplikacja jest procesem DPI-NIEŚWIADOMYM i to jest decyzja: kursor,
# `GetSystemMetrics` i `GetMonitorInfo` mówią wtedy jednym, zwirtualizowanym językiem, a na nim
# stoi ogrodzenie myszy, wskazywanie bezwzględne i każda akcja `@x,y`. Cena jest taka, że przy
# powiększeniu ekranu 150% monitor 2560×1600 przedstawia się w tym języku jako 1707×1067.
#
# Dla jednego pytania jest to odpowiedź FAŁSZYWA: „jaką rozdzielczość ma monitor, przy którym
# siedzę". Zadaje je skaner, bo plansza to ZRZUT EKRANU — plik o prawdziwych 2560 pikselach.
# Błąd: skaner brał rozdzielczość z wielkości okna, a nie faktyczne wymiary ekranu; trzeba je
# pobrać z systemu.
#
# Stąd `display_pixels()` (EnumDisplaySettings — czyta tryb ze sterownika, więc nie podlega
# wirtualizacji) i `_physical_for()`, który tę odpowiedź SPRAWDZA, zanim ją poda dalej. Testy niżej
# opisują właśnie to sprawdzanie, bo ono jest logiką, a nie wywołaniem Windowsa: wynik ze
# sterownika bywa niezgodny z resztą (obrócony ekran, tryb sprzed obrotu, bzdura) i wtedy lepiej
# zostać przy liczbach kursora niż pokazać człowiekowi liczbę, w którą sami nie wierzymy.
#
# Nic tu nie rusza ekranu ani kursora: `display_pixels` jest podmieniana na atrapę.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402

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
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


def z_atrapa(zwraca, name, w, h):
    """`_physical_for` z podstawioną odpowiedzią sterownika."""
    stary = rf.display_pixels
    rf.display_pixels = lambda _n: zwraca
    try:
        return rf._physical_for(name, w, h)
    finally:
        rf.display_pixels = stary


print("--- sterownik odpowiada sensownie ---")
check("powiększenie 150%: 1707×1067 kursora to 2560×1600 naprawdę",
      z_atrapa((2560, 1600), r"\\.\DISPLAY1", 1707, 1067) == (2560, 1600))
check("bez powiększenia obie pary są równe i nic się nie zmienia",
      z_atrapa((1920, 1080), r"\\.\DISPLAY1", 1920, 1080) == (1920, 1080))
check("powiększenie 125%: 1536×864 → 1920×1080",
      z_atrapa((1920, 1080), r"\\.\DISPLAY1", 1536, 864) == (1920, 1080))

print("\n--- odpowiedź, w którą nie wierzymy, jest ODRZUCANA ---")
# Sterownik, który podaje mniej niż widzi kursor, opisuje coś innego niż ten monitor: powiększenie
# ekranu nigdy nie ZMNIEJSZA, więc taka para nie ma prawa przejść.
check("fizyczny bok mniejszy od kursorowego → zostają liczby kursora",
      z_atrapa((1280, 800), r"\\.\DISPLAY1", 1707, 1067) == (1707, 1067))
check("proporcje z innej bajki → zostają liczby kursora",
      z_atrapa((3840, 1080), r"\\.\DISPLAY1", 1707, 1067) == (1707, 1067))
check("brak odpowiedzi (0, 0) → zostają liczby kursora",
      z_atrapa((0, 0), r"\\.\DISPLAY1", 1707, 1067) == (1707, 1067))
check("ekran o zerowym boku nie wywraca liczenia",
      z_atrapa((2560, 1600), r"\\.\DISPLAY1", 0, 0) == (0, 0))
check("bez nazwy urządzenia nie ma kogo pytać", rf._physical_for("", 1707, 1067) == (1707, 1067))

print("\n--- OBRÓCONY EKRAN: część sterowników podaje tryb SPRZED obrotu ---")
# Kursor widzi pion (1067×1707 po skalowaniu), sterownik mówi o poziomie (2560×1600). To nie jest
# bzdura, tylko ten sam tryb opisany przed obrotem — boki trzeba zamienić, a nie odrzucić.
check("boki zamienione, gdy dopiero po zamianie zgadzają się proporcje",
      z_atrapa((2560, 1600), r"\\.\DISPLAY1", 1067, 1707) == (1600, 2560))
check("…ale zamiana nie może przepchnąć pary mniejszej od kursorowej",
      z_atrapa((1067, 1707), r"\\.\DISPLAY1", 1707, 1067) == (1707, 1067))

print("\n--- co naprawdę stoi na tej maszynie (jeśli da się zapytać) ---")
scr = rf.list_screens(force=True)
if not scr:
    print("SKIP  brak monitorów do odczytania (nie-Windows albo brak dostępu)")
else:
    check("każdy ekran niesie `pw`/`ph`", all(("pw" in s and "ph" in s) for s in scr), scr)
    check("prawdziwe piksele nie są mniejsze niż kursorowe",
          all(s["pw"] + 1 >= s["w"] and s["ph"] + 1 >= s["h"] for s in scr),
          [(s["w"], s["h"], s["pw"], s["ph"]) for s in scr])
    check("…i mają te same proporcje",
          all(abs(s["pw"] / float(s["ph"]) - s["w"] / float(s["h"])) <= 0.02 * (s["w"] / float(s["h"]))
              for s in scr if s["h"] and s["ph"]),
          [(s["w"], s["h"], s["pw"], s["ph"]) for s in scr])
    # ⚠️ `w`/`h` MUSZĄ zostać w przestrzeni kursora — na nich stoi ogrodzenie myszy i `@x,y`.
    # Gdyby ktoś kiedyś „naprawił" je na fizyczne, pulpit przestałby się zgadzać z kursorem.
    x0, y0, dw, dh = rf.screen_bounds()
    if dw and dh:
        check("`w`/`h` nadal mówią w przestrzeni kursora (mieszczą się w pulpicie)",
              all(s["w"] <= dw + 1 and s["h"] <= dh + 1 for s in scr),
              (dw, dh, [(s["w"], s["h"]) for s in scr]))

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
