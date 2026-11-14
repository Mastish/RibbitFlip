# MODUŁY WYŁĄCZANE PRZY STARCIE: --disable / --only / --list-modules (2026-10-15). Uruchom:
#   py tests/test_moduly_startowe.py
#
# Trzy warstwy, od najtańszej:
#   1. funkcje w procesie: nazwy (aliasy, polskie znaki, nieznane, podstawowe), zależności w obie
#      strony (--disable nakladka gasi koło, --only kolo dokłada nakładkę), edycja Essential, mapa
#      tras (trasa wspólna MIDI i OSC, trasy celowo poza mapą), argparse z błędem i zmienną
#      środowiskową, argumenty restartu; wybór z panelu (2026-10-16): plik
#      Settings/ribbitflip_modules.json, pierwszeństwo wiersz poleceń > zmienna > plik, złe nazwy
#      w pliku, zapis atomowy, stan /modules/startup,
#   2. kopie aplikacji w katalogu tymczasowym (--simulate --no-keys --no-open --no-midi --no-tray
#      --allow-multi, wolny port) dla kilku kombinacji: /modules, /health, 404 z powodem na trasach
#      wyłączonych (GET i POST), działające trasy pozostałych, wątki silników, haki skanera, MCP,
#      tryby silnika ruchu, zła nazwa = kod 2 bez startu; plik z panelu, parametr ponad plikiem,
#      GET/POST /modules/startup (token, walidacja) i POST /modules/restart (nowa kopia na tym
#      samym porcie z wyborem),
#   3. smoke panelu w Playwright TYLKO headless (tests/moduly_startowe_smoke.mjs) na tych samych
#      kopiach, w tym klik w przełącznik i „Uruchom ponownie” w karcie; pomijany z komunikatem
#      SKIP, gdy nie ma node albo globalnego @playwright/test.
# Port 8770 nie jest ruszany; prawdziwe Settings/ i Library/ repozytorium też nie.
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import urllib.error

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO)
try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass
import ribbitflip_monitor as rf   # noqa: E402

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  " + name)
    else:
        _failed += 1
        print("FAIL  " + name + ("   -> " + str(detail)[:400] if detail != "" else ""))


# ---------------------------------------------------------------------------------------------
print("--- nazwy modułów ---")
check("aliasy, wielkość liter i polskie znaki: 'Koło, SKANER,wheel ,usługi,obs'",
      rf.parse_module_names("Koło, SKANER,wheel ,usługi,obs") == ["kolo", "skaner", "uslugi"],
      rf.parse_module_names("Koło, SKANER,wheel ,usługi,obs"))
check("pusty napis = pusta lista", rf.parse_module_names("") == [] and rf.parse_module_names(" , ") == [])
check("średnik też rozdziela", rf.parse_module_names("midi;osc") == ["midi", "osc"])
check("nazwa z panelu też działa ('Nakładka', 'Auto-zestawy wg gry')",
      rf.parse_module_names("Nakładka,Auto-zestawy wg gry") == ["nakladka", "autozestawy"])
try:
    rf.parse_module_names("kolo,foo")
    check("nieznana nazwa -> ValueError", False)
except ValueError as e:
    check("nieznana nazwa -> ValueError z listą poprawnych nazw",
          "foo" in str(e) and all(m in str(e) for m in rf.MODULE_IDS), e)
for core in ("mapowanie", "Czujnik", "połączenie", "zestawy", "konfiguracja", "przeglad"):
    try:
        rf.parse_module_names(core)
        check("moduł podstawowy '%s' -> ValueError" % core, False)
    except ValueError as e:
        check("moduł podstawowy '%s' -> ValueError 'podstawowy'" % core, "podstawowy" in str(e), e)
check("każdy moduł ma zakładkę albo jest kartą, wymagania wskazują istniejące moduły",
      all(all(r in rf.MODULE_IDS for r in m[4]) for m in rf.APP_MODULES))
check("aliasy nie zderzają się z id ani ze sobą",
      len({a for m in rf.APP_MODULES for a in m[5]} | set(rf.MODULE_IDS))
      == sum(len(m[5]) for m in rf.APP_MODULES) + len(rf.MODULE_IDS))

print("\n--- zależności ---")
off, notes = rf.resolve_modules(["nakladka"], None, "full")
check("--disable nakladka gasi też koło (requires:nakladka) i mówi o tym",
      off == {"nakladka": "disable", "kolo": "requires:nakladka"} and len(notes) == 1 and "kolo" in notes[0],
      (off, notes))
off, notes = rf.resolve_modules(["kolo"], None, "full")
check("--disable kolo nie rusza nakładki", off == {"kolo": "disable"} and not notes, off)
off, notes = rf.resolve_modules(None, ["kolo"], "full")
check("--only kolo dokłada nakładkę i mówi o tym; reszta wyłączona z powodem 'only'",
      "kolo" not in off and "nakladka" not in off and len(off) == len(rf.MODULE_IDS) - 2
      and set(off.values()) == {"only"} and len(notes) == 1 and "nakladka" in notes[0], (off, notes))
off, notes = rf.resolve_modules(None, ["midi"], "full")
check("--only midi: włączone tylko MIDI", set(rf.MODULE_IDS) - set(off) == {"midi"}, off)
off, _ = rf.resolve_modules([], None, "lite")
check("Essential: Synth i gra wyłączone z powodem 'edition'", off == {"synth": "edition", "gra": "edition"}, off)
off, _ = rf.resolve_modules(["synth"], None, "lite")
check("Essential + --disable synth: powód użytkownika wygrywa", off == {"synth": "disable", "gra": "edition"}, off)
off, _ = rf.resolve_modules([], None, "full")
check("bez parametrów nic nie jest wyłączone", off == {})

print("\n--- mapa tras ---")
_stary = dict(rf.MODULES_OFF)
try:
    rf.MODULES_OFF = {"kolo": "disable", "midi": "disable", "uslugi": "disable", "gra": "disable",
                      "skaner": "disable"}
    for p, want in (("/wheel", "kolo"), ("/wheelpresets", "kolo"), ("/wheelpresets/rename", "kolo"),
                    ("/midi/ports", "midi"), ("/midi/port", "midi"), ("/midi/panic", "midi"), ("/rest/config", "uslugi"), ("/rest/log/clear", "uslugi"),
                    ("/obs/connect", "uslugi"), ("/rest-presets", "uslugi"), ("/web/gry/", "gra"),
                    ("/web//gry/js/zabi-chor.js", "gra"), ("/gry/api/pakiety", "gra"), ("/scan/zrzut-ekranu", "skaner"),
                    ("/skaner-nakladka", "skaner"), ("/scan-preset/seed", "skaner")):
        check("trasa %s -> %s" % (p, want), rf.module_blocking(p) == want, rf.module_blocking(p))
    for p in ("/midi", "/osc-targets", "/midi/osc", "/midi/log/clear", "/test-midi", "/midi-preset/save",
              "/midi-presets", "/midi/learn", "/airmouse", "/cursor", "/screens", "/library", "/rules",
              "/stream", "/modules", "/health", "/", "/web/js/rf-00-core.js", "/wheelx", "/overlay", "/mcp",
              # wspólny plik panelu i gry: panel ładuje go zawsze, także bez modułu „gra" (2026-10-21)
              "/web/gry/js/probki-audio.js", "/web//gry//js//probki-audio.js"):
        check("trasa %s nie jest blokowana" % p, rf.module_blocking(p) is None, rf.module_blocking(p))
    for p in ("/web/gry/js/probki-audio.js.map", "/web/gry/js/probki-audio.json", "/web/gry/js/studio-probki.js"):
        check("trasa %s (gra, nie wspólny plik) -> gra" % p, rf.module_blocking(p) == "gra", rf.module_blocking(p))
    rf.MODULES_OFF = {"midi": "disable", "osc": "disable"}
    check("trasa wspólna /midi blokowana dopiero przy MIDI i OSC wyłączonych", rf.module_blocking("/midi") == "midi")
    check("…tak samo dziennik, test, nasłuch i presety MIDI i OSC",
          all(rf.module_blocking(p) == "midi" for p in ("/midi/log", "/test-midi", "/midi/learn", "/midi-presets",
                                                        "/midi-preset/load")))
    rf.MODULES_OFF = {"mysz": "disable"}
    check("preset myszy zostaje przy samej Myszy wyłączonej (czyta go też Kontroler)",
          rf.module_blocking("/mouse-presets") is None and rf.module_blocking("/mouse-preset/load") is None)
    rf.MODULES_OFF = {"mysz": "disable", "kontroler": "disable"}
    check("…i milknie, gdy wyłączone są oba", rf.module_blocking("/mouse-preset/load") == "mysz")
    pl, en = rf.module_off_message("midi")
    check("komunikat PL i EN mówi o parametrze startu", "--disable" in pl and "--disable" in en, (pl, en))
    rf.MODULES_OFF = {"kolo": "requires:nakladka", "nakladka": "disable"}
    pl, en = rf.module_off_message("kolo")
    check("komunikat zależności nazywa moduł wymagany", "Nakładka" in pl and "Overlay" in en, (pl, en))
    st = rf.modules_state()
    check("modules_state: pełny spis (12 + 6 podstawowych), off i powody",
          len(st["modules"]) == len(rf.APP_MODULES) + len(rf.CORE_MODULES) and st["off"] == ["kolo", "nakladka"]
          and next(m for m in st["modules"] if m["id"] == "kolo")["reason"] == "requires:nakladka"
          and all(m["enabled"] for m in st["modules"] if m["core"]), st["off"])
    rf.MODULES_OFF = {}
    check("nic wyłączone -> żadna trasa nie blokowana", rf.module_blocking("/wheel") is None)
finally:
    rf.MODULES_OFF = _stary

print("\n--- argparse, zmienne środowiskowe, restart ---")


_PLIKI = tempfile.mkdtemp(prefix="rf-moduly-plik-")
rf.MODULES_FILE = os.path.join(_PLIKI, "brak.json")   # nigdy plik z Settings/ repozytorium


def _plik(tresc):
    """Plik wyboru z panelu na czas jednego testu: dict/list -> JSON, str -> surowy tekst, None -> brak."""
    path = os.path.join(_PLIKI, "ribbitflip_modules.json")
    if os.path.exists(path):
        os.remove(path)
    if tresc is not None:
        with open(path, "w", encoding="utf-8") as f:
            f.write(tresc if isinstance(tresc, str) else json.dumps(tresc))
    return path


def _parse(argv, env=None, plik=None):
    """Ten sam parser co main() (zbudowany z jego źródła byłby kruchy, więc składamy minimalny
    z tymi samymi trzema opcjami) + prawdziwe _apply_module_args. `plik` = treść
    Settings/ribbitflip_modules.json (None = brak pliku)."""
    import argparse
    p = argparse.ArgumentParser(prog="rf")
    p.add_argument("--disable", action="append")
    p.add_argument("--only", action="append")
    p.add_argument("--list-modules", action="store_true")
    stare = {k: os.environ.pop(k, None) for k in ("RIBBITFLIP_DISABLE", "RIBBITFLIP_ONLY")}
    os.environ.update(env or {})
    stary_plik = rf.MODULES_FILE
    rf.MODULES_FILE = _plik(plik)
    stary_off, stary_src = dict(rf.MODULES_OFF), rf.MODULES_SOURCE
    import io
    import contextlib
    err, out = io.StringIO(), io.StringIO()
    try:
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(out):
            rf._apply_module_args(p, p.parse_args(argv))
        return 0, dict(rf.MODULES_OFF), rf.MODULES_SOURCE, out.getvalue() + err.getvalue()
    except SystemExit as e:
        return e.code, None, None, out.getvalue() + err.getvalue()
    finally:
        for k in ("RIBBITFLIP_DISABLE", "RIBBITFLIP_ONLY"):
            os.environ.pop(k, None)
            if stare[k] is not None:
                os.environ[k] = stare[k]
        rf.MODULES_OFF, rf.MODULES_SOURCE = stary_off, stary_src
        _plik(None)
        rf.MODULES_FILE = stary_plik


code, off, src, _ = _parse(["--disable", "kolo,skaner", "--disable", "midi"])
check("--disable powtarzalne i po przecinku", code == 0 and set(off) == {"kolo", "skaner", "midi"} and src == "cli",
      (code, off, src))
code, off, src, txt = _parse(["--disable", "nakladka"])
check("--disable nakladka: kolo też, zdanie w konsoli", code == 0 and off.get("kolo") == "requires:nakladka"
      and "[moduly]" in txt, (off, txt))
code, off, src, txt = _parse(["--disable", "foo"])
check("nieznana nazwa: kod 2 i lista poprawnych", code == 2 and "kolo" in txt and "autozestawy" in txt, (code, txt))
code, off, src, txt = _parse(["--disable", "kolo", "--only", "midi"])
check("--disable i --only naraz: kod 2", code == 2 and "--only" in txt, (code, txt))
code, off, src, txt = _parse(["--only", ","])
check("--only bez nazw: kod 2", code == 2, (code, txt))
code, off, src, txt = _parse([], {"RIBBITFLIP_DISABLE": "synth, gra"})
check("RIBBITFLIP_DISABLE działa, gdy wiersz poleceń milczy", code == 0 and set(off) == {"synth", "gra"} and src == "env",
      (code, off, src))
code, off, src, txt = _parse(["--disable", "midi"], {"RIBBITFLIP_DISABLE": "synth"})
check("wiersz poleceń wygrywa ze zmienną", code == 0 and set(off) == {"midi"} and src == "cli", (off, src))
code, off, src, txt = _parse([], {"RIBBITFLIP_ONLY": "mysz"})
check("RIBBITFLIP_ONLY działa", code == 0 and set(rf.MODULE_IDS) - set(off) == {"mysz"}, off)
code, off, src, txt = _parse([], {"RIBBITFLIP_DISABLE": "xyz"})
check("zła nazwa w zmiennej: kod 2 i nazwa zmiennej w komunikacie", code == 2 and "RIBBITFLIP_DISABLE" in txt, txt)
code, off, src, txt = _parse(["--list-modules"])
check("--list-modules: kod 0, każdy moduł i lista podstawowych",
      code == 0 and all(m in txt for m in rf.MODULE_IDS) and "mapowanie" in txt and "nakladka" in txt, (code, txt[:200]))

print("\n--- wybór z panelu: plik Settings/ribbitflip_modules.json ---")
code, off, src, txt = _parse([], plik={"disable": ["skaner", "Nakładka"]})
check("plik działa, gdy milczą wiersz poleceń i zmienne (z zależnością koła)",
      code == 0 and off == {"skaner": "disable", "nakladka": "disable", "kolo": "requires:nakladka"} and src == "file",
      (code, off, src))
code, off, src, txt = _parse([], {"RIBBITFLIP_DISABLE": "synth"}, plik={"disable": ["skaner"]})
check("zmienna wygrywa z plikiem (całe źródło, bez łączenia list)", code == 0 and set(off) == {"synth"} and src == "env",
      (off, src))
code, off, src, txt = _parse(["--disable", "midi"], {"RIBBITFLIP_DISABLE": "synth"}, plik={"disable": ["skaner"]})
check("wiersz poleceń wygrywa z plikiem i zmienną", code == 0 and set(off) == {"midi"} and src == "cli", (off, src))
code, off, src, txt = _parse(["--only", "mysz"], plik={"disable": ["skaner"]})
check("--only też wygrywa z plikiem", code == 0 and set(rf.MODULE_IDS) - set(off) == {"mysz"} and src == "cli", src)
code, off, src, txt = _parse([], plik={"disable": ["kolo", "zaba", "mapowanie", 7]})
check("zła nazwa w pliku nie zatrzymuje startu: odpada ze zdaniem w konsoli, reszta działa",
      code == 0 and off == {"kolo": "disable"} and src == "file" and txt.count("pominieto") == 3, (code, off, txt))
for zly in ("{nie json", '["kolo"]', '{"disable": "kolo"}', '{"disable": []}', ""):
    code, off, src, txt = _parse([], plik=zly)
    check("plik %r: start bez wyłączonych modułów" % zly[:20], code == 0 and off == {} and src == "", (code, off, src))

_stary_plik, _stary_off, _stary_src = rf.MODULES_FILE, dict(rf.MODULES_OFF), rf.MODULES_SOURCE
try:
    rf.MODULES_FILE = _plik(None)
    check("save_modules_file: zapis atomowy, bez pliku .tmp",
          rf.save_modules_file(["skaner", "nakladka"]) and not os.path.exists(rf.MODULES_FILE + ".tmp")
          and json.load(open(rf.MODULES_FILE, encoding="utf-8")) == {"disable": ["skaner", "nakladka"]})
    check("load_modules_file czyta to samo", rf.load_modules_file() == (["skaner", "nakladka"], []), rf.load_modules_file())
    rf.MODULES_OFF, rf.MODULES_SOURCE = {}, ""
    st = rf.modules_startup_state()
    check("startup_state: następny start z zależnością, czeka na restart",
          st["disable"] == ["skaner", "nakladka"] and st["next"] == ["kolo", "nakladka", "skaner"]
          and st["nextWhy"]["kolo"] == "requires:nakladka" and st["pending"] is True and st["overridden"] is False, st)
    rf.MODULES_OFF, rf.MODULES_SOURCE = {"kolo": "requires:nakladka", "nakladka": "disable", "skaner": "disable"}, "file"
    st = rf.modules_startup_state()
    check("startup_state: plik zgodny z tym uruchomieniem -> nic nie czeka", st["pending"] is False and st["source"] == "file", st)
    rf.MODULES_OFF, rf.MODULES_SOURCE = {"midi": "disable"}, "cli"
    st = rf.modules_startup_state()
    check("startup_state: parametr startu -> overridden, bez restartu (plik nie wygra)",
          st["overridden"] is True and st["pending"] is False and st["current"] == ["midi"], st)
    rf.MODULES_OFF, rf.MODULES_SOURCE = {"synth": "edition", "gra": "edition"}, ""
    st = rf.modules_startup_state()
    check("startup_state: edycja Essential osobno, nie jako wybór", st["edition"] == ["gra", "synth"]
          and "synth" not in st["next"] and st["current"] == [], st)
    rf.MODULES_OFF, rf.MODULES_SOURCE = {"skaner": "disable"}, "file"
    pl, en = rf.module_off_message("skaner")
    check("komunikat 404 przy wyborze z panelu wskazuje Konfigurację, nie parametr",
          "Konfiguracji" in pl and "Configuration" in en and "--disable" not in pl, (pl, en))
finally:
    _plik(None)
    rf.MODULES_FILE, rf.MODULES_OFF, rf.MODULES_SOURCE = _stary_plik, _stary_off, _stary_src

import argparse  # noqa: E402
_stary_state, _stary_off, _stary_src = dict(rf._MODE_STATE), dict(rf.MODULES_OFF), rf.MODULES_SOURCE
try:
    rf._MODE_STATE["args"] = argparse.Namespace(no_keys=True, enable_skip=False, name="Triki", port=8799, devices=1,
                                                debug=False, no_midi=True, no_tray=True, allow_multi=True, no_mcp=True)
    rf.MODULES_OFF = {"kolo": "requires:nakladka", "nakladka": "disable", "gra": "edition"}
    rf.MODULES_SOURCE = "file"
    check("restart przy wyborze z panelu NIE dokleja --disable (nowa kopia czyta plik, parametr by z nim wygrał)",
          "--disable" not in rf._build_restart_argv(True) and "--disable" not in rf._autostart_cmd(),
          (rf._build_restart_argv(True), rf._autostart_cmd()))
    rf.MODULES_SOURCE = "env"
    check("restart przy zmiennej niesie listę jak dotąd", "--disable" in rf._build_restart_argv(True))
    rf.MODULES_SOURCE = "cli"
    argv = rf._build_restart_argv(True)
    i = argv.index("--disable") if "--disable" in argv else -1
    check("restart (przełączenie trybu) niesie rozwiązaną listę bez edycji i --no-mcp",
          i > 0 and argv[i + 1] == "kolo,nakladka" and "--no-mcp" in argv, argv)
    check("autostart z Windows niesie tę samą listę", rf._autostart_cmd().endswith("--no-open --disable kolo,nakladka"),
          rf._autostart_cmd())
    rf.MODULES_OFF = {}
    check("restart bez wyłączonych modułów nie dokleja --disable", "--disable" not in rf._build_restart_argv(False))
    check("autostart bez wyłączonych modułów bez zmian", rf._autostart_cmd().endswith("--no-open"), rf._autostart_cmd())
    src = open(os.path.join(REPO, "ribbitflip_monitor.py"), encoding="utf-8").read()
    check("zasobnik: pozycja „Nakładki na wierzchu” znika bez modułu Nakładka",
          'visible=module_on("nakladka")' in src)
finally:
    rf._MODE_STATE.clear()
    rf._MODE_STATE.update(_stary_state)
    rf.MODULES_OFF, rf.MODULES_SOURCE = _stary_off, _stary_src

print("\n--- silnik ruchu: tryby wyłączonych modułów ---")
_stary_off = dict(rf.MODULES_OFF)
try:
    am = rf.AirMouse(rf._NullBus() if hasattr(rf, "_NullBus") else None, emitter=None, trig=None, gamepad=None)
    am.allowed_modes = ("stick", "dpad")          # Mysz wyłączona
    am.set_config({"enabled": True, "mode": "mouse"})
    check("Mysz wyłączona: tryb kursora nie włącza silnika", am.get_config()["enabled"] is False)
    am.set_config({"enabled": True, "mode": "stick"})
    check("…a drążek Kontrolera tak", am.get_config()["enabled"] is True)
    am.allowed_modes = ("mouse",)                 # Kontroler wyłączony
    am.set_config({"enabled": True, "mode": "dpad"})
    check("Kontroler wyłączony: krzyżak nie włącza silnika", am.get_config()["enabled"] is False)
except Exception as e:                            # noqa: BLE001
    check("AirMouse da się zbudować bez urządzenia", False, repr(e))
finally:
    rf.MODULES_OFF = _stary_off

# ---------------------------------------------------------------------------------------------
# Kopie aplikacji. Jeden katalog tymczasowy na wszystkie kombinacje (kolejno, każda na nowym
# porcie); Settings/ i Library/ powstają tam, nie w repozytorium.


def _wolny_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def _http(port, path, method="GET", body=None, token=None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request("http://127.0.0.1:%d%s" % (port, path), data=data, method=method)
    req.add_header("Host", "127.0.0.1:%d" % port)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("X-RibbitFlip-Token", token)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def _j(b):
    try:
        return json.loads(b.decode("utf-8"))
    except Exception:
        return {}


PIASKOWNICA = tempfile.mkdtemp(prefix="rf-moduly-")
for f in os.listdir(REPO):
    if f.startswith("ribbitflip_") and f.endswith(".py"):
        shutil.copy2(os.path.join(REPO, f), os.path.join(PIASKOWNICA, f))
shutil.copytree(os.path.join(REPO, "web"), os.path.join(PIASKOWNICA, "web"))
shutil.copytree(os.path.join(REPO, "packs"), os.path.join(PIASKOWNICA, "packs"))

NODE = shutil.which("node")
PW = os.path.join(os.environ.get("APPDATA", ""), "npm", "node_modules", "@playwright", "test")
SMOKE = os.path.join(REPO, "tests", "moduly_startowe_smoke.mjs")
BEZ_PRZEGLADARKI = os.environ.get("RF_MODULY_BEZ_PRZEGLADARKI")


def _zamknij_okna_piaskownicy():
    """Zamknij okna przeglądarki, które otworzyły kopie z tej piaskownicy (nakładki, skaner).

    `terminate()` to na Windows TerminateProcess: kopia nie dostaje szansy zamknąć okien, które
    sama postawiła, więc nakładki Edge z profilem `<piaskownica>/Settings/OverlayBrowser/...`
    zostawały na pasku zadań po każdym przebiegu (po testach zostawała masa procesów
    z żabą na pasku zadań). Dopasowanie
    po nazwie katalogu piaskownicy, więc nie ruszy okien żywej aplikacji ani innych testów."""
    if os.name != "nt":
        return
    znacznik = os.path.basename(os.path.normpath(PIASKOWNICA))
    skrypt = ("Get-CimInstance Win32_Process -Filter \"Name='msedge.exe' OR Name='chrome.exe'\" | "
              "Where-Object { $_.CommandLine -like '*%s*' } | "
              "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" % znacznik)
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", skrypt], capture_output=True, timeout=30)
    except Exception:
        pass


class Kopia:
    def __init__(self, extra, env=None):
        self.port = _wolny_port()
        self.extra = extra
        self.opis = " ".join(extra) or (("env " + " ".join("%s=%s" % kv for kv in env.items())) if env
                                        else "bez parametrów")
        srod = dict(os.environ, RIBBITFLIP_SONGPACKS_DIR=os.path.join(PIASKOWNICA, "SongPacks"))
        for k in ("RIBBITFLIP_DISABLE", "RIBBITFLIP_ONLY", "RIBBITFLIP_EDITION"):
            srod.pop(k, None)
        srod.update(env or {})
        self.proc = subprocess.Popen(
            [sys.executable, os.path.join(PIASKOWNICA, "ribbitflip_monitor.py"), "--simulate", "--no-keys",
             "--no-open", "--no-midi", "--no-tray", "--allow-multi", "--port", str(self.port)] + extra,
            cwd=PIASKOWNICA, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=srod)
        self.ok = False
        for _ in range(200):
            time.sleep(0.1)
            if self.proc.poll() is not None:
                break
            try:
                st, _b = _http(self.port, "/health")
                if st == 200:
                    self.ok = True
                    break
            except Exception:
                pass
        self.token = None
        if self.ok:
            time.sleep(0.6)                       # wątki silników kapsla po /health
            st, html = _http(self.port, "/")
            m = re.search(rb'RIBBITFLIP_TOKEN="([^"]+)"', html)
            self.token = m.group(1).decode() if m else None
            self.html = html

    def get(self, path):
        return _http(self.port, path)

    def post(self, path, body=None):
        return _http(self.port, path, "POST", body if body is not None else {}, self.token)

    def stop(self):
        try:
            self.proc.terminate()
            self.proc.wait(timeout=10)
        except Exception:
            try:
                self.proc.kill()
            except Exception:
                pass
        _zamknij_okna_piaskownicy()

    def smoke(self, oczekiwane_off, src="", restart=None):
        if BEZ_PRZEGLADARKI:
            print("SKIP  smoke panelu (RF_MODULY_BEZ_PRZEGLADARKI)")
            return
        if not NODE or not os.path.isdir(PW):
            print("SKIP  smoke panelu: brak node albo globalnego @playwright/test")
            return
        env = dict(os.environ, RF_URL="http://127.0.0.1:%d/" % self.port, RF_OFF=",".join(sorted(oczekiwane_off)),
                   RF_SRC=src, RF_RESTART=restart or "")
        r = subprocess.run([NODE, SMOKE], cwd=REPO, env=env, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=300)
        zle = [ln for ln in r.stdout.splitlines() if ln.strip().startswith("ZLE")]
        check("smoke panelu (headless) %s: %s" % (self.opis,
                                                  (r.stdout.strip().splitlines() or ["?"])[-1]),
              r.returncode == 0, "\n".join(zle[:10]) or r.stdout[-800:] + r.stderr[-400:])


def kombinacja(extra, oczekiwane_off, body, env=None):
    k = Kopia(extra, env)
    print("\n--- kopia aplikacji: %s ---" % k.opis)
    try:
        check("kopia wstaje (%s)" % k.opis, k.ok,
              (k.proc.stdout.read().decode("utf-8", "replace")[-600:] if k.proc.poll() is not None else "timeout"))
        if not k.ok:
            return
        st, b = k.get("/modules")
        mods = _j(b)
        check("/modules: lista wyłączonych = %s" % sorted(oczekiwane_off),
              st == 200 and mods.get("off") == sorted(oczekiwane_off), (st, mods.get("off")))
        st, b = k.get("/health")
        check("/health: modulesOff", _j(b).get("modulesOff") == sorted(oczekiwane_off), _j(b).get("modulesOff"))
        inj = re.search(rb"window\.RIBBITFLIP_MODULES=(\{.*?\});", k.html)
        inj = json.loads(inj.group(1)) if inj else {}
        check("panel dostaje listę w <head> razem z trasami",
              inj.get("off") == sorted(oczekiwane_off) and len(inj.get("routes", [])) == len(rf.MODULE_ROUTES), inj.get("off"))
        body(k, mods)
        k.smoke(oczekiwane_off, mods.get("source", ""))
    finally:
        k.stop()


def _off404(k, path, mod, post=False):
    st, b = k.post(path) if post else k.get(path)
    j = _j(b)
    check("%s %s -> 404 z modułem %s i zdaniem PL/EN" % ("POST" if post else "GET", path, mod),
          st == 404 and j.get("disabled") is True and j.get("module") == mod and j.get("error") and j.get("errorEn"),
          (st, b[:200]))


def _on200(k, path, post=None):
    st, b = k.post(path, post) if post is not None else k.get(path)
    check("%s %s działa (200)" % ("POST" if post is not None else "GET", path), st == 200, (st, b[:200]))


def _bez_parametrow(k, mods):
    check("wszystkie moduły włączone, źródło puste", all(m["enabled"] for m in mods["modules"]) and mods["source"] == "",
          mods.get("off"))
    th = mods.get("threads", [])
    check("wątki: trig, ruch i koło kapsla d0 oraz obserwator gry",
          {"rf-trig-d0", "rf-motion-d0", "rf-wheel-d0", "game-watch"} <= set(th), th)
    for p in ("/wheel", "/midi", "/scan", "/rest/config", "/synth", "/overlay", "/gameswitch",
              "/pads", "/web/gry/"):
        _on200(k, p)
    _on200(k, "/osc-targets", {"op": "list"})


def _kolo_skaner_midi(k, mods):
    check("źródło: wiersz poleceń", mods["source"] == "cli")
    th = mods.get("threads", [])
    check("brak wątku koła, ruch i trig są", "rf-wheel-d0" not in th and "rf-motion-d0" in th and "rf-trig-d0" in th, th)
    for p, m in (("/wheel", "kolo"), ("/wheelpresets", "kolo"), ("/scan", "skaner"), ("/scan-presets", "skaner"),
                 ("/skaner-nakladka", "skaner"), ("/midi/ports", "midi")):
        _off404(k, p, m)
    for p, m in (("/wheel", "kolo"), ("/scan/sygnal", "skaner"), ("/midi/panic", "midi"), ("/midi/port", "midi")):
        _off404(k, p, m, post=True)
    for p in ("/midi", "/midi-presets", "/airmouse", "/rules", "/overlay", "/cursor", "/library"):
        _on200(k, p)
    _on200(k, "/osc-targets", {"op": "list"})
    st, b = k.get("/hotkey")
    h = _j(b)
    check("haki skanera niezałożone, z powodem w /hotkey",
          h.get("scan", {}).get("available") is False and "Skaner" in str(h.get("scan", {}).get("reason")),
          h.get("scan"))


def _tylko_mysz(k, mods):
    off = set(mods["off"])
    check("--only mysz: zostaje tylko Mysz", set(rf.MODULE_IDS) - off == {"mysz"}, mods["off"])
    th = mods.get("threads", [])
    check("wątek ruchu jest (Mysz), koła i obserwatora gry nie ma",
          "rf-motion-d0" in th and "rf-wheel-d0" not in th and "game-watch" not in th, th)
    for p, m in (("/pads", "kontroler"), ("/dsu", "kontroler"), ("/midi", "midi"), ("/overlay", "nakladka"),
                 ("/gameswitch", "autozestawy"), ("/rest/config", "uslugi"), ("/synth", "synth"), ("/gry/api/pakiety", "gra"),
                 ("/web/gry/", "gra")):
        _off404(k, p, m)
    _off404(k, "/pads", "kontroler", post=True)
    st, b = k.post("/airmouse", {"enabled": True, "mode": "stick"})
    check("POST /airmouse z drążkiem: Kontroler wyłączony, silnik zostaje wyłączony", st == 200 and _j(b).get("enabled") is False,
          (st, b[:200]))
    st, b = k.post("/airmouse", {"enabled": True, "mode": "mouse"})
    check("POST /airmouse z kursorem: Mysz działa, silnik się włącza", st == 200 and _j(b).get("enabled") is True, (st, b[:200]))
    k.post("/airmouse", {"enabled": False})
    st, b = k.get("/airmouse")
    check("GET /airmouse nie ładuje vgamepad (Kontroler wyłączony)", st == 200 and _j(b).get("gpMod") in (False, None)
          and _j(k.get("/modules")[1])["heavy"].get("vgamepad") is False, _j(b).get("gpMod"))
    st, b = k.get("/mcp/config")
    check("MCP wyłączony na stałe (locked) jak przy --no-mcp", _j(b).get("locked") is True and _j(b).get("enabled") is False, b[:200])
    req = urllib.request.Request("http://127.0.0.1:%d/mcp" % k.port, data=b'{"jsonrpc":"2.0","id":1,"method":"ping"}',
                                 method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        urllib.request.urlopen(req, timeout=5)
        check("POST /mcp -> 403", False)
    except urllib.error.HTTPError as e:
        check("POST /mcp -> 403 (zablokowany)", e.code == 403, e.code)


def _bez_nakladki(k, mods):
    m = {x["id"]: x for x in mods["modules"]}
    check("koło wyłączone przez zależność od nakładki", m["kolo"]["reason"] == "requires:nakladka"
          and m["nakladka"]["reason"] == "disable", (m["kolo"], m["nakladka"]))
    _off404(k, "/overlay", "nakladka")
    _off404(k, "/overlay-layouts", "nakladka")
    st, b = k.get("/wheel")
    j = _j(b)
    check("GET /wheel: 404 i zdanie o wymaganej Nakładce", st == 404 and "Nakładka" in j.get("error", ""), j)


def _minimum(k, mods):
    th = mods.get("threads", [])
    check("bez Myszy i Kontrolera: brak wątku ruchu; bez auto-zestawów: brak obserwatora gry",
          "rf-motion-d0" not in th and "game-watch" not in th and "rf-trig-d0" in th, th)
    for p, m in (("/rest/config", "uslugi"), ("/obs/state", "uslugi"), ("/synth", "synth"), ("/gameswitch", "autozestawy"),
                 ("/midi", "midi")):
        _off404(k, p, m)
    _off404(k, "/rest/send", "uslugi", post=True)
    _off404(k, "/synth-scene/save", "synth", post=True)
    for p in ("/wheel", "/scan", "/overlay", "/rules", "/airmouse", "/setups"):
        _on200(k, p)


def _env(k, mods):
    check("źródło: zmienna środowiskowa", mods["source"] == "env", mods["source"])
    _off404(k, "/synth", "synth")


# ---------------------------------------------------------------------------------------------
# SPÓJNOŚĆ PO WYŁĄCZENIU (2026-10-16): zestawy mówią, które ich części nie zadziałają do restartu
# (setup_modules_off), a MCP odmawia zapisu modułu, który nie wstał (tests/test_mcp.py, sekcja 15).
_PAD = {"id": "s_pad", "label": "pad A", "enabled": True, "source": {"kind": "button", "any": True}, "keySpec": "pad:a"}
_SCAN_MAKRO = {"id": "s_scan", "label": "skan", "enabled": True, "source": {"kind": "button", "any": True},
               "keySpec": "", "sequence": "wait 50; scan:sygnal"}
_ZESTAW = {"rules": [_PAD, _SCAN_MAKRO], "mouse": {"enabled": True, "mode": "stick"},
           "midi": {"enabled": True, "oscEnabled": True}, "scan": {"enabled": False, "sekcje": [{"n": 1}]}}


def _spojnosc_w_procesie():
    stary = dict(rf.MODULES_OFF)
    try:
        rf.MODULES_OFF = {}
        check("setup_modules_off: nic nie wyłączone -> pusta lista", rf.setup_modules_off(_ZESTAW) == [])
        rf.MODULES_OFF = {"kontroler": "disable", "skaner": "disable", "osc": "disable"}
        mo = {m["module"]: m for m in rf.setup_modules_off(_ZESTAW)}
        check("setup_modules_off: Kontroler (reguła pad: i gałka), Skaner (makro scan: i sekcje), OSC; bez MIDI",
              set(mo) == {"kontroler", "skaner", "osc"}
              and {"key": "padRules", "n": 1} in mo["kontroler"]["parts"]
              and {"key": "motion", "mode": "stick"} in mo["kontroler"]["parts"]
              and {"key": "scanRules", "n": 1} in mo["skaner"]["parts"] and {"key": "scan"} in mo["skaner"]["parts"]
              and mo["osc"]["name"] == "OSC" and mo["kontroler"]["nameEn"] == "Controller", mo)
        two = rf.setup_modules_off([_ZESTAW, {"rules": [_PAD]}])
        check("setup_modules_off: paczka na dwa kapsle sumuje reguły w jednej odpowiedzi",
              {"key": "padRules", "n": 2} in two[0]["parts"] and two[0]["module"] == "kontroler", two)
        rq = rf.setup_requirements(_ZESTAW, {})
        check("setup_requirements niesie modulesOff, a requiresLevel go nie liczy",
              len(rq.get("modulesOff", [])) == 3 and all(r["key"] != "kontroler" for r in rq["requires"]), rq)
        rf.MODULES_OFF = {"mysz": "disable"}
        check("setup_modules_off: zestaw z gałką nie dotyczy Myszy",
              rf.setup_modules_off(_ZESTAW) == [], rf.setup_modules_off(_ZESTAW))
    finally:
        rf.MODULES_OFF = stary
    src = open(os.path.join(REPO, "ribbitflip_mcp.py"), encoding="utf-8").read()
    check("MCP: set_module_config, set_scanner_layout i set_output pilnują modułów wyłączonych",
          src.count("_require_module(ctx,") >= 4)


def _spojnosc(k, mods):
    st, b = k.post("/setup/analyze", {"config": _ZESTAW})
    j = _j(b)
    check("analiza zestawu: modulesOff = kontroler, skaner, osc (kolejność modułów)",
          st == 200 and [m["module"] for m in j.get("modulesOff", [])] == ["kontroler", "skaner", "osc"], (st, b[:300]))
    st, b = k.post("/bundle/analyze", {"bundle": {"app": "ribbitflip", "kind": "bundle", "version": 1,
                                                  "devices": [{"slot": "d0", "setup": _ZESTAW}]}})
    check("analiza paczki: modulesOff też", st == 200 and len(_j(b).get("modulesOff", [])) == 3, (st, b[:300]))
    st, b = k.post("/setup", {"config": _ZESTAW, "mode": "advanced"})
    j = _j(b)
    check("wczytanie zestawu: wszystko zapisane, odpowiedź mówi, czego nie użyje do restartu",
          st == 200 and j.get("ok") and "rules" in j.get("applied", []) and len(j.get("modulesOff", [])) == 3, (st, b[:300]))
    st, b = k.get("/rules")
    ids = [r.get("id") for r in (_j(b).get("rules") or [])]
    check("reguły pad: i scan: zostały na kapslu (nie usunięte)", "s_pad" in ids and "s_scan" in ids, ids)


def _plik_kopii(tresc):
    """Plik wyboru z panelu w Settings/ piaskownicy (wspólny dla kopii, więc każdy scenariusz sprząta)."""
    path = os.path.join(PIASKOWNICA, "Settings", "ribbitflip_modules.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        os.remove(path)
    if tresc is not None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(tresc, f)
    return path


def _z_pliku(k, mods):
    check("źródło: plik z panelu", mods["source"] == "file", mods["source"])
    _off404(k, "/scan", "skaner")
    st, b = k.get("/scan")
    check("404 przy wyborze z panelu odsyła do Konfiguracji", "Konfiguracji" in _j(b).get("error", ""), b[:200])
    st, b = k.get("/modules/startup")
    j = _j(b)
    check("GET /modules/startup: wybór z pliku, zgodny z tym uruchomieniem",
          st == 200 and j.get("disable") == ["skaner", "nakladka"] and j.get("pending") is False
          and j.get("overridden") is False and j.get("current") == ["kolo", "nakladka", "skaner"], j)
    st, b = _http(k.port, "/modules/startup", "POST", {"disable": ["midi"]}, None)
    check("POST /modules/startup bez tokenu -> 403", st == 403, (st, b[:120]))
    for zle in ({"disable": ["zaba"]}, {"disable": ["mapowanie"]}, {"disable": "kolo"}, {"disable": [1]}, {}):
        st, b = k.post("/modules/startup", zle)
        check("POST /modules/startup %s -> 400 z powodem" % json.dumps(zle, ensure_ascii=False),
              st == 400 and _j(b).get("ok") is False and _j(b).get("error"), (st, b[:160]))
    check("…i plik po złym zapisie bez zmian",
          json.load(open(_plik_sciezka(), encoding="utf-8")) == {"disable": ["skaner", "nakladka"]})
    st, b = k.post("/modules/startup", {"disable": ["MIDI", "wheel", "midi"]})
    j = _j(b)
    check("POST /modules/startup: aliasy i powtórzenia, następny start inny -> pending",
          st == 200 and j.get("disable") == ["midi", "kolo"] and j.get("next") == ["kolo", "midi"] and j.get("pending") is True, j)
    check("…zapisane w Settings/ribbitflip_modules.json",
          json.load(open(_plik_sciezka(), encoding="utf-8")) == {"disable": ["midi", "kolo"]})
    st, b = k.post("/modules/startup", {"disable": ["skaner", "nakladka"]})     # z powrotem, dla smoke
    check("powrót do wyboru z pliku -> nic nie czeka", _j(b).get("pending") is False, b[:200])


def _plik_sciezka():
    return os.path.join(PIASKOWNICA, "Settings", "ribbitflip_modules.json")


def _parametr_i_plik(k, mods):
    check("parametr wygrywa z plikiem: źródło cli", mods["source"] == "cli" and mods["off"] == ["midi"], mods.get("off"))
    j = _j(k.get("/modules/startup")[1])
    check("/modules/startup: overridden, plik czeka, bez restartu",
          j.get("overridden") is True and j.get("pending") is False and j.get("disable") == ["skaner"], j)
    _on200(k, "/scan")


def _restart_po_wyborze():
    """Wybór w panelu -> „Uruchom ponownie” -> nowa kopia na tym samym porcie z tym wyborem."""
    _plik_kopii(None)
    k = Kopia([])
    print("\n--- restart po wyborze z panelu (POST /modules/restart) ---")
    nowy = None
    try:
        check("kopia wstaje (restart)", k.ok)
        if not k.ok:
            return
        pid0 = _j(k.get("/modules")[1]).get("pid")
        st, b = k.post("/modules/startup", {"disable": ["skaner", "nakladka"]})
        check("zapis wyboru przed restartem", st == 200 and _j(b).get("pending") is True, b[:200])
        st, b = _http(k.port, "/modules/restart", "POST", {}, None)
        check("POST /modules/restart bez tokenu -> 403", st == 403, st)
        st, b = k.post("/modules/restart")
        check("POST /modules/restart -> ok, restart", st == 200 and _j(b).get("restart") is True, b[:200])
        mods = {}
        for _ in range(150):
            time.sleep(0.2)
            try:
                mods = _j(k.get("/modules")[1])
            except Exception:
                continue
            if mods.get("pid") and mods.get("pid") != pid0:
                nowy = mods["pid"]
                break
        check("nowa kopia wstała na tym samym porcie (inny pid), stara się zamknęła",
              nowy is not None and k.proc.wait(timeout=10) == 0, (pid0, mods.get("pid")))
        check("po restarcie wyłączone to, co wybrano w panelu (z zależnością), źródło: plik",
              mods.get("off") == ["kolo", "nakladka", "skaner"] and mods.get("source") == "file", (mods.get("off"), mods.get("source")))
        check("…i nic nie czeka na kolejny restart", _j(k.get("/modules/startup")[1]).get("pending") is False)
        _off404(k, "/overlay", "nakladka")
    finally:
        k.stop()
        if nowy:
            try:
                os.kill(nowy, 15)
            except Exception:
                pass
            time.sleep(0.5)
        _plik_kopii(None)


def _restart_z_panelu():
    """To samo kliknięciem w karcie, w przeglądarce headless (smoke z RF_RESTART)."""
    if BEZ_PRZEGLADARKI or not NODE or not os.path.isdir(PW):
        print("SKIP  restart z panelu: brak przeglądarki")
        return
    _plik_kopii(None)
    k = Kopia([])
    print("\n--- restart kliknięciem w karcie (headless) ---")
    pid = None
    try:
        check("kopia wstaje (restart z panelu)", k.ok)
        if not k.ok:
            return
        k.smoke(set(), "", restart="skaner")
        mods = _j(k.get("/modules")[1])
        pid = mods.get("pid")
        check("po kliknięciu serwer wstał bez Skanera, wybór z pliku",
              mods.get("off") == ["skaner"] and mods.get("source") == "file" and k.proc.poll() is not None, mods.get("off"))
    finally:
        k.stop()
        if pid and pid != k.proc.pid:
            try:
                os.kill(pid, 15)
            except Exception:
                pass
            time.sleep(0.5)
        _plik_kopii(None)


try:
    kombinacja([], set(), _bez_parametrow)
    kombinacja(["--disable", "kolo,skaner", "--disable", "midi"], {"kolo", "skaner", "midi"}, _kolo_skaner_midi)
    kombinacja(["--only", "mysz"], set(rf.MODULE_IDS) - {"mysz"}, _tylko_mysz)
    kombinacja(["--disable", "nakladka"], {"nakladka", "kolo"}, _bez_nakladki)
    kombinacja(["--disable", "mysz,kontroler,midi,osc,uslugi,synth,gra,autozestawy,mcp"],
               {"mysz", "kontroler", "midi", "osc", "uslugi", "synth", "gra", "autozestawy", "mcp"}, _minimum)
    kombinacja([], {"synth"}, _env, env={"RIBBITFLIP_DISABLE": "synth"})
    _spojnosc_w_procesie()
    kombinacja(["--disable", "kontroler,skaner,osc"], {"kontroler", "skaner", "osc"}, _spojnosc)
    _plik_kopii({"disable": ["skaner", "nakladka"]})
    kombinacja([], {"skaner", "nakladka", "kolo"}, _z_pliku)
    _plik_kopii({"disable": ["skaner"]})
    kombinacja(["--disable", "midi"], {"midi"}, _parametr_i_plik)
    _plik_kopii(None)
    _restart_po_wyborze()
    _restart_z_panelu()

    # EDYCJA ESSENTIAL NA ŻYWO (2026-10-21): panel ładuje web/gry/js/probki-audio.js zawsze (wspólna obróbka
    # próbek z grą), więc ten JEDEN plik przechodzi obok bramki „gry w tej paczce nie ma”; reszta gry nadal 404.
    print("\n--- Essential (RIBBITFLIP_EDITION=lite): wspólny js/probki-audio.js przechodzi, gra nie ---")
    k = Kopia([], env={"RIBBITFLIP_EDITION": "lite"})
    try:
        check("Essential: kopia wstaje", k.ok)
        if k.ok:
            st, body = k.get("/web/gry/js/probki-audio.js")
            check("Essential: /web/gry/js/probki-audio.js -> 200 i treść ProbkiAudio",
                  st == 200 and b"ProbkiAudio" in body, (st, len(body)))
            for p in ("/web/gry/js/zabi-chor.js", "/web/gry/", "/web/gry/js/probki-audio.js.map"):
                st, body = k.get(p)
                check("Essential: %s -> 404" % p, st == 404, st)
            check("Essential: panel ma <html data-edition=\"lite\">", b'data-edition="lite"' in k.html)
    finally:
        k.stop()

    print("\n--- zła nazwa: aplikacja nie wstaje ---")
    r = subprocess.run([sys.executable, os.path.join(PIASKOWNICA, "ribbitflip_monitor.py"), "--simulate", "--no-keys",
                        "--no-open", "--no-tray", "--allow-multi", "--port", str(_wolny_port()), "--disable", "kolo,zaba"],
                       cwd=PIASKOWNICA, capture_output=True, text=True, timeout=60, encoding="utf-8", errors="replace")
    check("--disable kolo,zaba: kod 2, nazwa i lista poprawnych w komunikacie",
          r.returncode == 2 and "zaba" in r.stderr and "nakladka" in r.stderr, (r.returncode, r.stderr[-300:]))
finally:
    _zamknij_okna_piaskownicy()
    shutil.rmtree(PIASKOWNICA, ignore_errors=True)
    shutil.rmtree(_PLIKI, ignore_errors=True)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
