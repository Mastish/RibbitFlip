"""BEZPIECZNE WYJSCIA I ZAPIS USTAWIEN (2026-11-18). Uruchom: py tests/test_wyjscia_bezpieczne.py

Regresje z przegladu serwera przed wydaniem 1.0.0:

  A2  makro przerywa sie przy wylaczeniu grupy (Mapowanie, kolo), przy stopie awaryjnym
      (release_all) i przy zamknieciu, takze w srodku pauzy; klawisze z kroku `down` ida w gore,
  A3  warunek z NIE bez swiezych danych z kapsla jest niespelniony (nic nie zostaje wcisniete),
  A1  wyjscie z aplikacji (restart z panelu) najpierw zamyka bramki i zatrzymuje silniki,
      dopiero potem puszcza klawisze; nic nie wciska sie ponownie,
  A4  ruch pada (zyroskop DS4 / Wii) przechodzi przez bramki: uzbrojenie, wlacznik Kontrolera,
      --no-keys; przy zamknieciu bramki pad dostaje raz ramke spoczynkowa,
  A6  zapis atomowy i kopia uszkodzonego pliku zamiast cichego startu na pustym, A12 = zapis
      zwraca False przy bledzie,
  A7  MCP save_setup nie nadpisuje istniejacego zestawu, a zestaw z MCP wczytuje sie w trybie
      bezpiecznym,
  C-05 brak przenoszenia folderow Profiles/Setups obok EXE, C-06 proba zapisu katalogu ustawien.

Bez sprzetu, bez serwera: silniki na zaslepkach, Settings/ i Library/ w katalogu tymczasowym.
Bez znakow spoza ASCII w print() - konsola cp1250.
"""
import json
import os
import shutil
import sys
import tempfile
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402
import ribbitflip_mcp as mcp      # noqa: E402

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


class Bus:
    def __init__(self):
        self.ev = []

    def now(self):
        return time.time()

    def publish(self, e):
        self.ev.append(e)


class Emit:
    def __init__(self):
        self.log = []
        self.down_now = set()
        self.t0 = time.monotonic()
        self._lk = threading.Lock()

    def _l(self, k, s):
        with self._lk:
            self.log.append((time.monotonic() - self.t0, k, s))

    def tap(self, s):
        self._l("tap", s)

    def down(self, s):
        self._l("down", s)
        self.down_now.add(s)

    def up(self, s):
        self._l("up", s)
        self.down_now.discard(s)

    def mouse_release_all(self):
        pass

    def after(self, t):
        return [(k, s) for (tt, k, s) in self.log if tt >= t]

    def now(self):
        return time.monotonic() - self.t0


def phases(bus, rid):
    return [e.get("phase") for e in bus.ev if e.get("t") == "seqm" and e.get("id") == rid]


MACRO = "a; wait 150; b; down w; wait 3000; c; up w"

# ---------------------------------------------------------------- A2: makro a wylaczenie grupy
print("\n--- A2: makro ---")
for what in ("set_enabled(False)", "release_all (stop awaryjny)", "set_armed(False)", "zamkniecie (_stop)"):
    bus, e = Bus(), Emit()
    t = rf.TriggerEngine(bus, emitter=e, armed=True)
    t._launch_sequence({"id": "m1", "label": "x"}, MACRO)
    time.sleep(0.35)                       # po `down w`, w srodku pauzy 3 s
    check("A2 [%s] makro trzyma w przed stopem" % what, "w" in e.down_now, e.log)
    t_off = e.now()
    if what.startswith("set_enabled"):
        t.set_enabled(False)
    elif what.startswith("release_all"):
        t._release_all_held()              # = Device.release_outputs() z panic_stop / dm.release_all
    elif what.startswith("set_armed"):
        t.set_armed(False)
    else:
        t._stop = True
    time.sleep(0.15)
    out = [x for x in e.after(t_off) if x != ("up", "w")]
    check("A2 [%s] po stopie nic nie wychodzi" % what, out == [], out)
    check("A2 [%s] w puszczone" % what, "w" not in e.down_now, e.log)
    check("A2 [%s] makro zakonczone jako abort" % what, "abort" in phases(bus, "m1"), phases(bus, "m1"))
    ups = [x for x in e.after(0) if x == ("up", "w")]
    time.sleep(0.05)
    check("A2 [%s] w puszczone dokladnie raz" % what, len(ups) == 1, e.log)

# Kolo: makro wycinka slucha wlacznika kola, nie Mapowania.
bus, e = Bus(), Emit()
t = rf.TriggerEngine(bus, emitter=e, armed=True)
t.enabled = False                          # Mapowanie wylaczone - kolo ma dzialac dalej
flag = {"on": True}
t._launch_sequence({"id": "wheel:0", "label": "x"}, "a; wait 200; b", gate=lambda: flag["on"])
time.sleep(0.05)
flag["on"] = False                         # stop awaryjny wylacza kolo
time.sleep(0.3)
check("A2 makro kola: krok przed wylaczeniem poszedl", ("tap", "a") in e.after(0), e.log)
check("A2 makro kola: po wylaczeniu kola nic", ("tap", "b") not in e.after(0), e.log)

# Regula przy Mapowaniu wylaczonym nie wystartuje, a zwykle makro dochodzi do konca.
bus, e = Bus(), Emit()
t = rf.TriggerEngine(bus, emitter=e, armed=True)
t._launch_sequence({"id": "m2", "label": "x"}, "a; wait 50; down x; wait 30; up x; b")
time.sleep(0.4)
check("A2 zwykle makro przechodzi w calosci",
      e.after(0) == [("tap", "a"), ("down", "x"), ("up", "x"), ("tap", "b")], e.log)
check("A2 zwykle makro konczy sie 'done'", "done" in phases(bus, "m2"), phases(bus, "m2"))

# Podglad (send=False) gra do konca takze rozbrojony - nic nie wciska.
bus, e = Bus(), Emit()
t = rf.TriggerEngine(bus, emitter=e, armed=False)
t.run_steps("prev", "podglad", rf.parse_sequence("a; wait 30; b"), send=False)
check("A2 podglad gra do konca bez wysylania", "done" in phases(bus, "prev") and e.log == [], (phases(bus, "prev"), e.log))

# ---------------------------------------------------------------- A3: NIE bez danych
print("\n--- A3: NIE bez danych ---")
rules = rf.sanitize_rules([{"id": "n1", "enabled": True, "source": {"kind": "filter", "metric": "tilt"},
                            "cmp": ">", "threshold": 30, "neg": True, "behavior": "hold", "keySpec": "w"}])
bus, e = Bus(), Emit()
t = rf.TriggerEngine(bus, emitter=e, armed=True)
t.set_rules(rules)
for _ in range(5):
    t.tick()
check("A3 NIE(pochylenie) bez kapsla nic nie wciska", e.log == [], e.log)
t.on_pose({"tilt": 5.0, "twist": 0.0, "pitch": 0.0, "roll": 0.0, "spin": 0.0})
t.tick()
check("A3 NIE(pochylenie) ze swiezymi danymi dziala jak dotad", "w" in e.down_now, e.log)
t.last_pose_ts = time.monotonic() - 5.0     # kapsel zasnal / wyszedl z zasiegu
t.tick()
check("A3 utrata danych puszcza klawisz", "w" not in e.down_now and ("up", "w") in e.after(0), e.log)

rules = rf.sanitize_rules([{"id": "n2", "enabled": True, "source": {"kind": "axis", "channel": 3},
                            "cmp": ">", "threshold": 1000, "neg": True, "behavior": "continuous",
                            "intervalMs": 10, "keySpec": "space"}])
bus, e = Bus(), Emit()
t = rf.TriggerEngine(bus, emitter=e, armed=True)
t.set_rules(rules)
for _ in range(5):
    t.tick()
check("A3 NIE(os) 'ciagle' bez danych nic nie wysyla", e.log == [], e.log)

rules = rf.sanitize_rules([{"id": "n3", "enabled": True, "source": {"kind": "button", "any": True},
                            "neg": True, "behavior": "hold", "keySpec": "shift"}])
bus, e = Bus(), Emit()
t = rf.TriggerEngine(bus, emitter=e, armed=True)
t.set_rules(rules)
for _ in range(3):
    t.tick()
check("A3 NIE(przycisk) bez kapsla nic nie wciska", e.log == [], e.log)
t.on_sample((0, 0, 0, 0, 0, 16384))         # kapsel zyje, przycisk puszczony
t.tick()
check("A3 NIE(przycisk) z zywym kapslem dziala", "shift" in e.down_now, e.log)

rules = rf.sanitize_rules([
    {"id": "base", "enabled": True, "source": {"kind": "axis", "channel": 3}, "cmp": ">",
     "threshold": 1000, "behavior": "once", "keySpec": ""},
    {"id": "n4", "enabled": True, "source": {"kind": "trigger", "ref": "base"}, "neg": True,
     "behavior": "hold", "keySpec": "q"}])
bus, e = Bus(), Emit()
t = rf.TriggerEngine(bus, emitter=e, armed=True)
t.set_rules(rules)
for _ in range(3):
    t.tick()
check("A3 NIE(inna regula) bez kapsla nic nie wciska", "q" not in e.down_now, e.log)

# ---------------------------------------------------------------- A1: kolejnosc przy wyjsciu
print("\n--- A1: wyjscie z aplikacji ---")


class DevStub:
    def __init__(self, trig):
        self.trig = trig

    def stop(self):
        self.trig._stop = True

    def release_outputs(self):
        self.trig._release_all_held()


class DmStub:
    def __init__(self, trig):
        self.d = DevStub(trig)

    def set_master_armed(self, on):
        self.d.trig.set_armed(on)

    def stop_all(self):
        self.d.stop()

    def release_all(self):
        self.d.release_outputs()


rules = rf.sanitize_rules([{"id": "h1", "enabled": True, "source": {"kind": "axis", "channel": 3},
                            "cmp": ">", "threshold": 1000, "behavior": "hold", "keySpec": "w"}])
bus, e = Bus(), Emit()
t = rf.TriggerEngine(bus, emitter=e, armed=True)
t.set_rules(rules)
th = threading.Thread(target=t.run, daemon=True)
th.start()
stop_feed = threading.Event()


def feed():
    while not stop_feed.is_set():
        t.on_sample((0, 0, 0, 5000, 0, 0))   # warunek trwa caly czas
        time.sleep(0.01)


threading.Thread(target=feed, daemon=True).start()
time.sleep(0.15)
check("A1 regula trzyma w przed wyjsciem", "w" in e.down_now, e.log)
t_rel = e.now()
rf.release_outputs_for_exit(DmStub(t))
time.sleep(0.3)                              # zamykanie nakladek, httpd.shutdown()
check("A1 po release_outputs_for_exit w puszczone", "w" not in e.down_now, e.after(t_rel))
check("A1 nic nie wcisnelo sie ponownie", ("down", "w") not in e.after(t_rel), e.after(t_rel))
stop_feed.set()
th.join(1)
check("A1 petla regul zatrzymana", not th.is_alive())

# ---------------------------------------------------------------- A4: ruch pada
print("\n--- A4: ruch pada ---")


class GP:
    motion = True

    def __init__(self):
        self.imu = 0
        self.rest = 0

    def set_imu(self, **k):
        self.imu += 1

    def rest_imu(self, src=None):
        self.rest += 1


class AM:
    def __init__(self, emitter, pad_on=True):
        self.gp = GP()
        self.emitter = emitter
        self._pad_on = pad_on

    def pad_output_on(self):
        return self._pad_on

    def on_sample(self, s):
        pass

    def on_pose(self, p):
        pass


S = (10, 20, 30, 0, 0, 16384)
tr = rf.TriggerEngine(Bus(), emitter=None, armed=True)
am = AM(emitter=object())
p = rf.Pipeline(Bus(), trig=tr, airmouse=am, midimap=None, dev_id="d0", wheel=None)
p.handle(S)
check("A4 bramki otwarte: ruch idzie do pada", am.gp.imu == 1, am.gp.imu)
tr.armed = False                              # glowny wlacznik / pauza / autopauza
p.handle(S)
p.handle(S)
check("A4 rozbrojony: ruch nie idzie", am.gp.imu == 1, am.gp.imu)
check("A4 rozbrojony: jedna ramka spoczynkowa", am.gp.rest == 1, am.gp.rest)
tr.armed = True
am._pad_on = False                            # Kontroler wylaczony (tez po stopie awaryjnym)
p.handle(S)
check("A4 Kontroler wylaczony: ruch nie idzie", am.gp.imu == 1, am.gp.imu)
am2 = AM(emitter=None)                        # --no-keys
p2 = rf.Pipeline(Bus(), trig=rf.TriggerEngine(Bus(), emitter=None, armed=True), airmouse=am2,
                 midimap=None, dev_id="d0", wheel=None)
p2.handle(S)
check("A4 --no-keys: ruch nie idzie i nic nie wyrownuje", am2.gp.imu == 0 and am2.gp.rest == 0,
      (am2.gp.imu, am2.gp.rest))

try:
    ge = rf.GamepadEmitter()
    calls = []
    ge._ensure_pad = lambda: calls.append(1) or False
    ge.motion = True
    ge.kind = "ds4"
    ge.rest_imu()
    check("A4 rest_imu nie tworzy pada, gdy ruchu nie bylo", calls == [] and ge._imu is None, calls)
    ge._imu = ((5.0, 5.0, 5.0), (0.3, 0.9, 0.1))
    ge._active = False
    ge.reset()
    check("A4 reset pada poziomuje ruch", ge._imu == rf.IMU_REST, ge._imu)
except Exception as ex:      # konstruktor zalezny od srodowiska - nie blokuje reszty
    check("A4 GamepadEmitter bez sterownika", False, repr(ex))

srv = rf.DsuServer.__new__(rf.DsuServer)
srv._lock = threading.Lock()
srv._slots = {}
pushed = []
srv.push = lambda slot: pushed.append(slot)
srv.rest(1)
check("A4 DSU: nieznany slot nie staje sie podlaczony", srv._slots == {} and pushed == [], srv._slots)
srv._slots[1] = {"gyro": (9.0, 9.0, 9.0), "accel": (0.5, 0.5, 0.5), "ts_us": 0}
srv.rest(1)
check("A4 DSU: slot wyrownany", srv._slots[1]["gyro"] == (0.0, 0.0, 0.0)
      and tuple(srv._slots[1]["accel"]) == (0.0, 1.0, 0.0) and pushed == [1], srv._slots[1])

# ---------------------------------------------------------------- A6 / A12: zapis
print("\n--- A6/A12: zapis ustawien ---")
tmp = tempfile.mkdtemp(prefix="rf-test-zapis-")
old_settings, old_setups, old_builtin = rf.SETTINGS_DIR, rf.SETUPS_DIR, rf.BUILTIN_SETUPS_DIR
try:
    rf.SETTINGS_DIR = os.path.join(tmp, "Settings")
    rf.SETUPS_DIR = os.path.join(tmp, "Library", "Setups")
    rf.BUILTIN_SETUPS_DIR = os.path.join(tmp, "Presets")
    os.makedirs(rf.BUILTIN_SETUPS_DIR)
    r1 = rf.sanitize_rules([{"id": "r1", "enabled": True, "keySpec": "a"}])
    check("A12 save_rules zwraca True", rf.save_rules(r1, "d0", True) is True)
    check("A6 reguly wracaja z dysku", [r["id"] for r in rf.load_rules("d0")] == ["r1"])
    left = [f for f in os.listdir(rf.SETTINGS_DIR) if f.endswith(".tmp")]
    check("A6 brak plikow tymczasowych po zapisie", left == [], left)
    for fn, arg in ((rf.save_mouse, {"enabled": False}), (rf.save_midi, {"enabled": False}),
                    (rf.save_wheel, {"enabled": False}), (rf.save_scan, {"enabled": False}),
                    (rf.save_power, {"x": 1})):
        check("A12 %s zwraca True" % fn.__name__, fn(arg, "d0") is True)

    # uszkodzony plik: kopia + domyslne, oryginal nie znika przed zapisem
    path = rf._dev_path("d0", "rules")
    with open(path, "w", encoding="utf-8") as f:
        f.write('{"enabled": true, "rules": [{"id": "r1", "keySp')
    got = rf.load_rules("d0")
    copies = [f for f in os.listdir(rf.SETTINGS_DIR) if ".uszkodzony-" in f]
    check("A6 uszkodzony plik regul -> pusta lista (start z domyslnymi)", got == [], got)
    check("A6 uszkodzony plik ma kopie", len(copies) == 1, copies)
    if copies:
        with open(os.path.join(rf.SETTINGS_DIR, copies[0]), encoding="utf-8") as f:
            check("A6 kopia ma tresc oryginalu", f.read().startswith('{"enabled": true, "rules"'))
    rf.load_rules_enabled("d0")
    rf.load_rules_layer("d0")
    copies2 = [f for f in os.listdir(rf.SETTINGS_DIR) if ".uszkodzony-" in f]
    check("A6 kopia robiona raz na uruchomienie", len(copies2) == 1, copies2)
    check("A6 uszkodzony plik widoczny w SETTINGS_CORRUPT",
          any(c.get("file") == path for c in rf.SETTINGS_CORRUPT), rf.SETTINGS_CORRUPT)

    # dwa watki pisza ten sam plik, trzeci czyta: zawsze poprawny JSON
    target = os.path.join(rf.SETTINGS_DIR, "wyscig.json")
    errors = []

    def writer(tag):
        for i in range(60):
            try:
                rf._write_json_atomic(target, {"tag": tag, "i": i, "pad": "x" * 2000})
            except Exception as ex:
                errors.append(repr(ex))

    def reader():
        for _ in range(200):
            try:
                with open(target, encoding="utf-8") as f:
                    json.load(f)
            except FileNotFoundError:
                pass
            except PermissionError:
                pass
            except Exception as ex:
                errors.append("czytanie: " + repr(ex))

    rf._write_json_atomic(target, {"tag": "start"})
    ths = [threading.Thread(target=writer, args=("A",)), threading.Thread(target=writer, args=("B",)),
           threading.Thread(target=reader)]
    for x in ths:
        x.start()
    for x in ths:
        x.join()
    check("A6 rownolegly zapis i odczyt bez polowy pliku", errors == [], errors[:3])

    # A12: zapis do miejsca, w ktore nie da sie pisac
    rf.SETTINGS_DIR = os.path.join(tmp, "plik-zamiast-katalogu")
    with open(rf.SETTINGS_DIR, "w") as f:
        f.write("x")
    check("A12 save_rules przy bledzie zwraca False", rf.save_rules(r1, "d0", True) is False)
    check("A12 save_mouse przy bledzie zwraca False", rf.save_mouse({}, "d0") is False)
    ok, err = rf._probe_dir_writable(rf.SETTINGS_DIR)
    check("C-06 proba zapisu wykrywa brak prawa zapisu", ok is False and bool(err), (ok, err))
    ok, err = rf._probe_dir_writable(os.path.join(tmp, "Settings"))
    check("C-06 proba zapisu w zwyklym katalogu = True", ok is True and err == "", (ok, err))
    check("C-06 proba nie zostawia smieci",
          not [f for f in os.listdir(os.path.join(tmp, "Settings")) if f.startswith(".rf-probe-")])
    rf.SETTINGS_DIR = os.path.join(tmp, "Settings")

    # ------------------------------------------------------------ A7: MCP save_setup
    print("\n--- A7: MCP save_setup ---")
    with open(os.path.join(rf.BUILTIN_SETUPS_DIR, "Multimedia.json"), "w", encoding="utf-8") as f:
        json.dump({"app": "ribbitflip", "kind": "setup", "name": "Multimedia", "config": {"rules": []}}, f)
    mine = {"app": "ribbitflip", "kind": "setup", "name": "Moj", "config": {"rules": r1}}
    check("A7 zapis zestawu uzytkownika", rf.save_setup("Moj", mine) is True)
    ctx = {"b": None, "fn": {"safe_profile_name": rf._safe_profile_name, "sanitize_rules": rf.sanitize_rules,
                             "save_setup": rf.save_setup, "list_setups": rf.list_setups,
                             "analyze_config": rf.analyze_config}}
    risky = {"rules": [{"id": "x1", "enabled": True, "keySpec": "win+r", "behavior": "once"}]}
    out = mcp._t_save_setup(ctx, {"name": "Moj", "config": risky})
    check("A7 istniejacy zestaw nie zostal nadpisany", rf.load_setup("Moj") == mine, rf.load_setup("Moj"))
    check("A7 zestaw z MCP zapisany pod wolna nazwa", out.get("name") == "Moj (2)" and out.get("requestedName") == "Moj", out)
    env = rf.load_setup("Moj (2)") or {}
    check("A7 zestaw z MCP ma source=mcp", env.get("source") == "mcp", env)
    check("A7 zestaw z MCP wczytuje sie w trybie bezpiecznym", rf.setup_trust_mode(env) == "safe")
    check("A7 zestaw uzytkownika zostaje zaufany", rf.setup_trust_mode(mine) == "advanced")
    out = mcp._t_save_setup(ctx, {"name": "multimedia", "config": risky})
    check("A7 nazwa wbudowanego zestawu tez jest zajeta", out.get("name") == "multimedia (2)", out)
    out = mcp._t_save_setup(ctx, {"name": "Nowy", "config": risky})
    check("A7 wolna nazwa zostaje bez zmian", out.get("name") == "Nowy" and "requestedName" not in out, out)
finally:
    rf.SETTINGS_DIR, rf.SETUPS_DIR, rf.BUILTIN_SETUPS_DIR = old_settings, old_setups, old_builtin
    shutil.rmtree(tmp, ignore_errors=True)

# ---------------------------------------------------------------- C-05 / C-06 statycznie
print("\n--- C-05 / C-06 ---")
src = open(rf.__file__, encoding="utf-8").read()
check("C-05 brak migracji folderow Profile/Zestawy obok EXE",
      '("Zestawy", "Setups")' not in src and '("Profile", "Profiles")' not in src)
check("C-06 /health niesie settingsWritable i settingsDir",
      '"settingsWritable": bool(SETTINGS_WRITABLE)' in src and '"settingsDir": SETTINGS_DIR' in src)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
