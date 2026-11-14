# Test: OKNO WYMIANY MUSI MOWIC TAM, GDZIE STOI CZLOWIEK.
# Uruchom: py tests/test_share_hub_message.py
#
# Zgloszony blad: "w presecie - przycisk wymiana nic nie aktywuje".
# Zmierzone na zywej instancji: sam przycisk "Wymiana" w stopce listy presetow otwieral okno
# poprawnie we wszystkich 15 miejscach, w ktorych stoi. Martwy byl PIERWSZY WIERSZ tego okna
# ("Podziel sie tym: ...") w module bez zapisanego presetu: okno sie zamykalo, a wyjasnienie szlo
# przez flashTrigMsg do #trigMsg - elementu, ktory mieszka w panelu "Konfiguracja" Mapowania.
# Przycisk, ktory to wywolal, stoi w panelu "Biblioteka", i to w KAZDYM module. Nieaktywny panel ma
# display:none, wiec zdanie ladowalo w polu, ktorego nie widac. Z zewnatrz: nie dzialo sie NIC.
#
# Dlaczego bylo ciche: gałaz komunikatu znala trzy rodzaje ("trig", "axis", "pack"), a od 31.08
# rodzaje dokłada rejestr (rf-49-kinds). Mysz, skaner, MIDI/OSC, uslugi, kolo i syntezator wpadaly
# do gałezi "trig" i pisaly w ciemno - szesc modulow na dziewiec. Po poprawce glosnik wybiera sie
# po tym, CO WIDAC (#trigMsg z offsetParent), a nie po nazwie rodzaju.
#
# Ciezar sprawdzenia jest w tests/share_hub_harness.mjs: prawdziwy rejestr rodzajow + prawdziwy
# rf-39l w `vm`, wiec rodzaj dopisany jutro jest sprawdzony razem z reszta. Tu zostaje to, co
# widac w samych zrodlach, i podsumowanie.
import json
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_passed = 0
_failed = 0


def _say(s):
    # Konsola Windows bywa w cp1250, a nazwy sprawdzen z harnessu niosa polskie znaki i cudzyslowy
    # drukarskie. Wyjatek kodowania w linii RAPORTU zabralby dokladnie te informacje, po ktora sie tu
    # przyszlo.
    enc = getattr(sys.stdout, "encoding", None) or "utf-8"
    print(s.encode(enc, "replace").decode(enc, "replace"))


def check(name, ok, detail=""):
    global _passed, _failed
    if ok:
        _passed += 1
        _say("  OK   %s" % name)
    else:
        _failed += 1
        _say("  FAIL %s%s" % (name, ("  <- " + str(detail)) if detail else ""))


HUB = open(os.path.join(REPO, "web", "js", "rf-39l-share-hub.js"), encoding="utf-8").read()

print("--- zrodlo: jeden glosnik, wybierany po tym, co widac -------------")
check("a1. glosnik istnieje jako jedna funkcja", "function _pdcSay(" in HUB)
check("a2. ...i pyta o widocznosc pola komunikatu, a nie o nazwe rodzaju",
      'getElementById("trigMsg")' in HUB and "offsetParent" in HUB)
check("a3. gałaz pustej biblioteki mowi przez niego", "_pdcSay(_pdcTx(say));" in HUB)
# Kazde z tych trzech jest osobna droga wyjscia; brak ostatniej znaczy, ze w srodowisku bez czaszki
# (okno nakladki laduje ulamek plikow) zdanie znow przepadnie po cichu.
check("a4. ...i ma trzy drogi: pole pod lista, czaszka, notka w rogu",
      "flashTrigMsg(text)" in HUB and "rfSkullSay(text" in HUB and "rfToast(text" in HUB)

print("\n--- panel: kazdy rodzaj z rejestru, oba stany #trigMsg ------------")
harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "share_hub_harness.mjs")
try:
    p = subprocess.run(["node", harness], capture_output=True, text=True,
                       encoding="utf-8", timeout=60)
    out = json.loads((p.stdout or "").strip().splitlines()[-1]) if p.returncode == 0 else None
except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
    p, out = None, None
    _say("POMINIETO  panel (Node): %s" % e)
if out is None and p is not None:
    check("harness panelu wystartowal", False, (p.stderr or p.stdout or "")[-300:])
for nm, ok, detail in (out or {}).get("checks", []):
    check(nm, ok, detail)

_say("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
