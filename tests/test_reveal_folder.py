# Test przycisku "Folder" przy Dzienniku wysylek (i jego blizniaka w "Zglos problem").
# Uruchom: py tests/test_reveal_folder.py
#
# DLACZEGO TEN TEST W OGOLE POWSTAL. Przycisk "Folder" zglaszany byl jako niedzialajacy, a
# pomiar na zywej instancji (2026-09-12) pokazal cos innego niz awarie: serwer odpowiadal
# {"ok": true}, os.startfile nie rzucal wyjatku, okno Eksploratora POWSTAWALO — tylko nie
# wychodzilo na wierzch, bo w chwili klikniecia pierwszoplanowa jest przegladarka, a Windows
# pozwala oddac pierwszy plan wylacznie procesowi, ktory go trzyma. Gdy folder byl juz otwarty,
# nie dzialo sie dokladnie nic. Do tego panel wyrzucal odpowiedz do kosza (.catch pusty, zero
# .then), wiec kazda z przyczyn wygladala identycznie: cisza.
#
# Stad ksztalt asercji. Nie sprawdzamy "czy endpoint istnieje" — to sprawdzal stary test i
# wlasnie ta warstwa NIE padla. Sprawdzamy trzy rzeczy, ktore padly:
#   1. serwer oddaje odpowiedz, z ktorej da sie cokolwiek wywnioskowac (pola `fronted`/`path`),
#   2. panel te odpowiedz CZYTA (jest `.then`, a `.catch` nie jest pusty),
#   3. otwieranie idzie przez wspolny `reveal_in_explorer`, ktory tworzy katalog i probuje
#      wyciagnac okno na wierzch — a nie przez goly os.startfile.
#
# Nic tu nie otwiera zadnego okna: `reveal_in_explorer` jest wolany wylacznie na sciezce, ktora
# nie istnieje i istniec nie moze, zeby zmierzyc kontrakt zwracanej krotki bez skutkow ubocznych.
import inspect
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  [%s]" % detail) if detail else ""))


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRV = open(os.path.join(ROOT, "ribbitflip_monitor.py"), "r", encoding="utf-8").read()
CLI = open(os.path.join(ROOT, "web", "js", "rf-36-rest-e3.js"), "r", encoding="utf-8").read()

# ── a. wspolny pomocnik ────────────────────────────────────────────────────────────────────
check("a1. reveal_in_explorer istnieje", hasattr(rf, "reveal_in_explorer"))
check("a2. przyjmuje plik do podswietlenia",
      "select_file" in inspect.signature(rf.reveal_in_explorer).parameters)
# Kod pomocnika BEZ docstringa: opis celowo cytuje `os.startfile(folder)` jako to, czym ta
# funkcja NIE jest, wiec szukanie tego napisu w calym zrodle trafialoby we wlasny komentarz.
_REVEAL = inspect.getsource(rf.reveal_in_explorer).split('"""')[-1]
_ODP = rf.reveal_in_explorer("\0niemozliwa\0sciezka")
check("a3. oddaje trojke (ok, blad, czy_na_wierzchu)",
      isinstance(_ODP, tuple) and len(_ODP) == 3, repr(_ODP))
check("a4. tworzy katalog, zanim go otworzy (os.startfile tego nie robil)",
      "os.makedirs(folder, exist_ok=True)" in _REVEAL)
check("a5. otwiera przez explorer.exe /select, a nie przez os.startfile",
      "/select," in _REVEAL and "os.startfile" not in _REVEAL)
check("a6. probuje wyciagnac okno na wierzch", "_front_explorer_window" in _REVEAL)
check("a7. wyciaganie na wierzch uzywa AttachThreadInput (bez niego SetForegroundWindow "
      "z procesu w tle jest odrzucane)",
      "AttachThreadInput" in inspect.getsource(rf._front_explorer_window))
check("a8. niczego nie rzuca przy sciezce nie do otwarcia", _ODP[0] is False)

# ── b. endpointy ───────────────────────────────────────────────────────────────────────────
check("b1. /rest/log/open uzywa wspolnego pomocnika",
      "reveal_in_explorer(SETTINGS_DIR, REST_LOG_FILE)" in SRV)
check("b2. /rest/log/open podswietla PLIK dziennika, nie tylko katalog",
      "REST_LOG_FILE" in SRV.split('path == "/rest/log/open"')[1][:400])
check("b3. odpowiedz niesie `fronted` — panel musi umiec odroznic 'otwarte' "
      "od 'otwarte i widoczne'",
      '"fronted"' in SRV.split('path == "/rest/log/open"')[1][:600])
check("b4. odpowiedz niesie sciezke do pokazania czlowiekowi",
      '"path": SETTINGS_DIR' in SRV.split('path == "/rest/log/open"')[1][:600])
check("b5. /diag/open dostal to samo leczenie",
      "reveal_in_explorer(folder)" in SRV)
check("b6. w obsludze obu endpointow nie zostalo gole os.startfile",
      "os.startfile" not in SRV.split('path == "/rest/log/open"')[1][:600]
      and "os.startfile" not in SRV.split('path == "/diag/open"')[1][:600])
check("b7. endpoint stoi PRZED bramka slotu (dziala bez sparowanego kapsla)",
      SRV.index('path == "/rest/log/open"')
      < SRV.index("d = self.dm.get(self._dev_id())   # target slot"))

# ── c. panel czyta odpowiedz ───────────────────────────────────────────────────────────────
# To jest warstwa, na ktorej funkcja realnie padla: zadanie wychodzilo, odpowiedz wracala,
# nikt jej nie czytal. Asercja "czy w zrodle jest napis /rest/log/open" tego NIE widzi.
_seg = CLI.split('.ra-log-open')[-1][:2600]
check("c1. panel czyta odpowiedz (.then po fetchu)", ".then(" in _seg)
check("c2. panel rozroznia przypadek 'okno nie weszlo na wierzch'", "fronted" in _seg)
check("c3. panel mowi, co poszlo nie tak, gdy ok!==true", "j.ok!==true" in _seg)
check("c4. panel daje sciezke do schowka, gdy okna nie widac", "writeText" in _seg)
check("c5. .catch nie jest juz pusty", ".catch(function(){});" not in _seg)
check("c6. komunikaty ida przez _ra3T (dwujezycznosc modulu)", "_ra3T(" in _seg)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
