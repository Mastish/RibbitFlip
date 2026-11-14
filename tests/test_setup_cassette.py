# KASETA ZESTAWU: pole `cassette` (1–8) w kopercie zestawu i paczki na kilka kapsli.
# Uruchom: py tests/test_setup_cassette.py
#
# Prośba właściciela 2026-11-22: zestawy w panelu wyglądają jak filcowe kasety magnetofonowe, a autor
# wybiera przy zapisie jedną z ośmiu. Wybór jedzie w pliku, więc test pilnuje czterech rzeczy:
#   1. sanityzator: plik bez pola, ze śmieciem albo z liczbą spoza 1–8 dostaje kasetę domyślną (1),
#   2. zapis: koperta zestawu i paczki ZAWSZE niesie pole, także domyślne,
#   3. odczyt: indeks Biblioteki i podgląd importu (`setup_about`) oddają kasetę, a plik sprzed tej
#      zmiany czyta się jak kaseta 1 — i nadal nie jest „uszkodzony",
#   4. zgodność wstecz: pole leży na KOPERCIE, więc `setup_compat` nie zgłasza go jako nieznanej
#      grupy, a starszy build (który czyta tylko `config` / `devices`) nie ma o co się potknąć.
# Do tego: każdy zestaw z aplikacji (Presets/) i każda paczka w examples/ ma przypisaną kasetę,
# obrazki 1–8 leżą tam, gdzie szuka ich panel, a narzędzie MCP `save_setup` przyjmuje pole.
#
# Bez HTTP, bez BLE i bez zapisu w prawdziwym Settings/ — katalogi aplikacji podmienione na tymczasowe.
import json
import os
import shutil
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import ribbitflip_monitor as rf  # noqa: E402
import ribbitflip_mcp as mcp  # noqa: E402

try:
    sys.stdout.reconfigure(errors="replace")
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


# ---------------------------------------------------------------------------------------------
#  1. sanityzator
# ---------------------------------------------------------------------------------------------
S = rf._sanitize_cassette
check("stałe: 8 kaset, domyślna 1", rf.CASSETTE_COUNT == 8 and rf.CASSETTE_DEFAULT == 1)
for v, want in ((None, 1), (1, 1), (4, 4), (8, 8), ("5", 5), (2.0, 2), (0, 1), (9, 1), (-3, 1),
                (2.5, 1), ("x", 1), ("", 1), (True, 1), (False, 1), ([], 1), ({}, 1)):
    check("sanityzator %r -> %r" % (v, want), S(v) == want, repr(S(v)))

# ---------------------------------------------------------------------------------------------
#  2. zapis koperty (bez prawdziwego kapsla: build_setup i rejestr MIDI podmienione)
# ---------------------------------------------------------------------------------------------
_TMP = tempfile.mkdtemp(prefix="rf-kaseta-")
_orig = {k: getattr(rf, k) for k in ("build_setup", "load_midi_global", "SETUPS_DIR", "BUILTIN_SETUPS_DIR",
                                     "gameswitch_invalidate")}
rf.build_setup = lambda d: {"rules": [], "trigEnabled": True}
rf.load_midi_global = lambda: {}
rf.gameswitch_invalidate = lambda: None
rf.SETUPS_DIR = os.path.join(_TMP, "Library", "Setups")
rf.BUILTIN_SETUPS_DIR = os.path.join(_TMP, "Presets")
os.makedirs(rf.SETUPS_DIR, exist_ok=True)
os.makedirs(rf.BUILTIN_SETUPS_DIR, exist_ok=True)


class FakeDev:
    id = "d0"

    def meta_dict(self):
        return {"dev": "d0", "name": "Triki 1", "label": ""}


class FakeDM:
    def all(self):
        return [FakeDev()]


try:
    e = rf.setup_envelope(FakeDev(), "Test", "opis", cassette=6)
    check("zestaw: kaseta z zapisu", e.get("cassette") == 6, e.get("cassette"))
    e = rf.setup_envelope(FakeDev(), "Test", "opis")
    check("zestaw bez wyboru: kaseta 1 zapisana wprost", e.get("cassette") == 1, e)
    e = rf.setup_envelope(FakeDev(), "Test", "opis", cassette="99")
    check("zestaw ze śmieciem: kaseta 1", e.get("cassette") == 1, e.get("cassette"))
    check("kaseta na kopercie, nie w config", "cassette" not in (e.get("config") or {}))
    b = rf.build_bundle(FakeDM(), "Paczka", "opis", cassette=3)
    check("paczka: kaseta z zapisu", b.get("cassette") == 3, b.get("cassette"))
    check("paczka bez wyboru: kaseta 1", rf.build_bundle(FakeDM(), "P").get("cassette") == 1)
    check("paczka: kaseta poza devices", all("cassette" not in (dv.get("setup") or {})
                                             for dv in b.get("devices") or []))

    # zapis na dysk i odczyt przez indeks Biblioteki — ta sama droga, co /setup/save + /library
    rf.save_setup("Z kasetą", rf.setup_envelope(FakeDev(), "Z kasetą", cassette=7))
    stary = {"app": "ribbitflip", "kind": "setup", "version": 1, "name": "Stary",
             "description": "plik sprzed kaset", "config": {"rules": []}}
    with open(os.path.join(rf.SETUPS_DIR, "Stary.json"), "w", encoding="utf-8") as f:
        json.dump(stary, f)
    zly = dict(stary, name="Zły", cassette="różowa")
    with open(os.path.join(rf.SETUPS_DIR, "Zły.json"), "w", encoding="utf-8") as f:
        json.dump(zly, f)
    it7 = rf._library_entry("setup", rf.SETUPS_DIR, "Z kasetą")
    its = rf._library_entry("setup", rf.SETUPS_DIR, "Stary")
    itz = rf._library_entry("setup", rf.SETUPS_DIR, "Zły")
    check("indeks: kaseta z pliku", it7.get("cassette") == 7, it7)
    check("indeks: stary plik bez pola = kaseta 1", its.get("cassette") == 1, its)
    check("indeks: stary plik nie jest uszkodzony", not its.get("broken"), its)
    check("indeks: śmieć w polu = kaseta 1, plik czytelny", itz.get("cassette") == 1 and not itz.get("broken"), itz)
    check("load_setup oddaje pole bez zmian", (rf.load_setup("Z kasetą") or {}).get("cassette") == 7)

    # zmiana SAMEJ kasety zapisanego zestawu (`/setup/cassette`): jedno pole, reszta pliku nietknięta
    przed = rf.load_setup("Stary")
    ok, why = rf.set_setup_cassette("Stary", 6)
    po = rf.load_setup("Stary")
    check("zmiana kasety: ok", ok and why is None, (ok, why))
    check("zmiana kasety: pole zapisane", po.get("cassette") == 6, po.get("cassette"))
    check("zmiana kasety: reszta pliku bez zmian",
          {k: v for k, v in po.items() if k != "cassette"} == przed, po)
    ok, why = rf.set_setup_cassette("Stary", "śmieć")
    check("zmiana kasety na śmieć = kaseta 1", ok and rf.load_setup("Stary").get("cassette") == 1)
    check("zmiana kasety: brak zestawu", rf.set_setup_cassette("Nie ma takiego", 3) == (False, "missing"))
    check("zmiana kasety: pusta nazwa", rf.set_setup_cassette("", 3) == (False, "name"))
    with open(os.path.join(rf.BUILTIN_SETUPS_DIR, "Wbudowany.json"), "w", encoding="utf-8") as f:
        json.dump(dict(stary, name="Wbudowany", cassette=2), f)
    check("zmiana kasety: zestaw z aplikacji odmawia", rf.set_setup_cassette("Wbudowany", 5) == (False, "builtin"))
    with open(os.path.join(rf.BUILTIN_SETUPS_DIR, "Wbudowany.json"), "r", encoding="utf-8") as f:
        check("zestaw z aplikacji nietknięty", json.load(f).get("cassette") == 2)
    check("zmiana kasety nie tworzy kopii w Library/Setups",
          not os.path.exists(os.path.join(rf.SETUPS_DIR, "Wbudowany.json")))
finally:
    for k, v in _orig.items():
        setattr(rf, k, v)
    shutil.rmtree(_TMP, ignore_errors=True)

# ---------------------------------------------------------------------------------------------
#  3. podgląd importu: setup_about / analyze_bundle
# ---------------------------------------------------------------------------------------------
check("setup_about: kaseta z pliku", rf.setup_about({"cassette": 5}).get("cassette") == 5)
check("setup_about: stary plik = 1", rf.setup_about({"description": "x"}).get("cassette") == 1)
check("setup_about: zawsze trzy pola", set(rf.setup_about({})) == {"description", "howto", "cassette"})
ab = rf.analyze_bundle({"kind": "bundle", "cassette": 4, "devices": [{"slot": "d0", "setup": {}}]})
check("analyze_bundle niesie kasetę", ab.get("cassette") == 4, ab.get("cassette"))

# ---------------------------------------------------------------------------------------------
#  4. zgodność wstecz: pole nie jest grupą konfiguracji
# ---------------------------------------------------------------------------------------------
c1 = rf.setup_compat({"kind": "setup", "version": 1, "cassette": 3, "config": {"rules": []}})
check("compat zestawu: kaseta to nie nieznana grupa", c1["unknownGroups"] == [], c1)
c2 = rf.setup_compat({"kind": "bundle", "version": 1, "cassette": 3,
                      "devices": [{"slot": "d0", "setup": {"rules": []}}]})
check("compat paczki: kaseta to nie nieznana grupa", c2["unknownGroups"] == [], c2)
check("format zestawu bez zmiany numeru (stary build czyta plik w całości)", rf.SETUP_FORMAT == 1)
check("kaseta nie jest w SETUP_KEYS ani SETUP_META_KEYS",
      "cassette" not in rf.SETUP_KEYS and "cassette" not in rf.SETUP_META_KEYS)

# ---------------------------------------------------------------------------------------------
#  5. zestawy z aplikacji i przykłady mają przypisane kasety
# ---------------------------------------------------------------------------------------------
pliki = [os.path.join(ROOT, "Presets", n) for n in sorted(os.listdir(os.path.join(ROOT, "Presets")))
         if n.endswith(".json")]
pliki += [os.path.join(ROOT, "examples", n) for n in sorted(os.listdir(os.path.join(ROOT, "examples")))
          if n.endswith(".bundle.json")]
check("są pliki do sprawdzenia", len(pliki) >= 10, len(pliki))
for p in pliki:
    with open(p, "r", encoding="utf-8") as f:
        d = json.load(f)
    k = d.get("cassette")
    check("kaseta 1–8: %s" % os.path.relpath(p, ROOT),
          isinstance(k, int) and not isinstance(k, bool) and 1 <= k <= 8, repr(k))

# ---------------------------------------------------------------------------------------------
#  6. obrazki kaset leżą tam, gdzie szuka ich panel
# ---------------------------------------------------------------------------------------------
for i in range(1, 9):
    for w in (160, 360):
        p = os.path.join(ROOT, "web", "assets", "kasety", "%d-%d.png" % (i, w))
        check("obrazek kasety %d-%d.png" % (i, w), os.path.isfile(p) and os.path.getsize(p) > 1000)
check("ikona modułu kaseta.png", os.path.isfile(os.path.join(ROOT, "web", "assets", "icons", "kaseta.png")))
with open(os.path.join(ROOT, "web", "js", "rf-28e-kasety.js"), "r", encoding="utf-8") as f:
    JS = f.read()
for i in range(1, 9):
    check("rf-28e zna kasetę %d" % i, ('%d:' % i) in JS and ('/web/assets/kasety/' in JS))

# ---------------------------------------------------------------------------------------------
#  7. MCP: save_setup przyjmuje kasetę, a słownik pól koperty ją wymienia
# ---------------------------------------------------------------------------------------------
tool = next((t for t in mcp.TOOLS if t.get("name") == "save_setup"), None)
props = ((tool or {}).get("inputSchema") or {}).get("properties") or {}
check("MCP save_setup: pole cassette 1–8",
      props.get("cassette", {}).get("type") == "integer"
      and props["cassette"].get("minimum") == 1 and props["cassette"].get("maximum") == 8, props.get("cassette"))
check("MCP: kaseta przez sanityzator monitora", mcp._cassette_arg({"fn": {"sanitize_cassette": S}}, "4") == 4)
check("MCP: bez sanityzatora kaseta 1", mcp._cassette_arg({}, 4) == 1)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
