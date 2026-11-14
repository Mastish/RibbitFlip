"""STOP AWARYJNY A KOLO WYBORU (2026-10-16). Uruchom: py tests/test_panic_wheel.py

Do dzis `panic_stop` gasil Mapowanie, Sterowanie ruchem, MIDI, OSC, Uslugi i Skaner, ale nie
dotykal kola, a bramka kola (`RadialMenu._fire`) pytala tylko o `trig.armed`, czyli o glowny
wlacznik, ktorego stop celowo nie rusza. Wlaczone kolo wysylalo wiec klawisze dalej, pod
komunikatem „wszystkie moduly wylaczone". Tu pilnujemy trzech rzeczy:

  1. po stopie wlacznik kola stoi na wylaczonym, na kazdym kapslu, i tak trafia do pliku
     (w symulacji plik zachowuje to, co mial tryb prawdziwy - ta sama zasada co przy reszcie),
  2. kolo wylaczone nie wysyla niczego, nawet gdy wybor trafil w nie w chwili stopu,
  3. okno kola przy kursorze, jesli stalo, zostaje zamkniete.

Nic tu nie dotyka pulpitu ani prawdziwych ustawien: Settings/ to katalog tymczasowy, a REST,
powiadomienia, okna i MIDI sa zaslepkami.

Bez znakow spoza ASCII w print() - konsola cp1250.
"""
import json
import os
import shutil
import sys
import tempfile

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
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


class BusStub:
    def __init__(self):
        self.events = []

    def now(self):
        return 1.0

    def publish(self, ev):
        self.events.append(ev)


class TrigStub:
    """Mapowanie juz wylaczone, glowny wlacznik uzbrojony - dokladnie stan, w ktorym kolo
    przeciekalo: `armed` stoi, bo stop go nie rusza."""

    def __init__(self):
        self.armed = True
        self.enabled = False

    def set_enabled(self, on):
        self.enabled = on

    def snapshot_rules(self):
        return []


class CfgStub:
    def __init__(self):
        self.cfg = {"enabled": False}

    def get_config(self):
        return dict(self.cfg)

    def set_config(self, c):
        self.cfg.update(c)

    def request_release(self):
        pass


class ScanStub:
    enabled = False

    def get_config(self):
        return {"enabled": False}


class TapRec:
    def __init__(self):
        self.taps = []

    def tap(self, spec):
        self.taps.append(spec)
        return True


class DevStub:
    def __init__(self, dev_id, bus):
        self.id = dev_id
        self.trig = TrigStub()
        self.mouse = CfgStub()
        self.midimap = CfgStub()
        self.scan = ScanStub()
        self.em = TapRec()
        self.wheel = rf.RadialMenu(bus, emitter=self.em, trig=self.trig)
        self.wheel.set_config({"enabled": True, "holdMs": 300.0,
                               "slices": [{"label": "A", "spec": "a"},
                                          {"label": "B", "spec": "b"}]})


class DmStub:
    def __init__(self, devs, simulate=False):
        self.devs = devs
        self.simulate = simulate
        self.midi_emitter = None

    def all(self):
        return list(self.devs)

    def release_all(self):
        pass


class WinStub:
    def __init__(self, up):
        self.up = up

    def running(self):
        return self.up


class OverlayStub:
    """Kapsel d0 ma okno kola przy kursorze i ono stoi; d1 nigdy go nie mial."""

    def __init__(self):
        self.wins = {"d0~kolo": WinStub(True)}
        self.closed = []

    def wheel_wid(self, dev, create=False):
        wid = dev + "~kolo"
        return wid if wid in self.wins else None

    def close(self, wid):
        self.closed.append(wid)
        self.wins[wid].up = False
        return True


class NotifierStub:
    def notify(self, *a, **k):
        pass


class OknoSkaneraStub:
    def close(self):
        return False


_tmp = tempfile.mkdtemp(prefix="rf-panic-wheel-")
_saved = {k: getattr(rf, k) for k in ("SETTINGS_DIR", "OVERLAY", "NOTIFIER", "SCAN_OVERLAY",
                                       "load_rest_config", "save_rest_config")}
try:
    rf.SETTINGS_DIR = _tmp
    rf.NOTIFIER = NotifierStub()
    rf.SCAN_OVERLAY = OknoSkaneraStub()
    rf.load_rest_config = lambda: {"enabled": False}
    rf.save_rest_config = lambda cfg: True

    print("-- stop gasi kolo na kazdym kapslu")
    rf.OVERLAY = OverlayStub()
    bus = BusStub()
    devs = [DevStub("d0", bus), DevStub("d1", bus)]
    os.makedirs(os.path.join(_tmp, "d1"), exist_ok=True)
    check("przed stopem kolo jest wlaczone",
          all(d.wheel.get_config()["enabled"] for d in devs))
    res = rf.panic_stop(DmStub(devs), bus, source="hotkey", combo="alt+r+f")
    check("po stopie kolo jest wylaczone na obu kapslach",
          not any(d.wheel.get_config()["enabled"] for d in devs),
          [d.wheel.get_config()["enabled"] for d in devs])
    check("lista wylaczonych wymienia kolo kazdego kapsla",
          "d0:wheel" in res["stopped"] and "d1:wheel" in res["stopped"], res["stopped"])
    with open(rf._dev_path("d1", "wheel"), encoding="utf-8") as f:
        zapis = json.load(f)
    check("wylaczenie trafia do pliku (przetrwa restart)", zapis.get("enabled") is False, zapis)
    check("panel dostaje wheel_cfg z enabled=false",
          any(e.get("t") == "wheel_cfg" and e.get("enabled") is False for e in bus.events))
    check("zdarzenie panic wymienia kolo",
          any(e.get("t") == "panic" and "d0:wheel" in e.get("stopped", []) for e in bus.events))

    print("-- okno kola przy kursorze")
    check("stojace okno zostaje zamkniete", rf.OVERLAY.closed == ["d0~kolo"], rf.OVERLAY.closed)
    check("i jest na liscie wylaczonych", "d0:wheel-okno" in res["stopped"], res["stopped"])
    res2 = rf.panic_stop(DmStub(devs), BusStub())
    check("drugi stop: nic do wylaczenia, bez klamstwa",
          not [x for x in res2["stopped"] if "wheel" in x], res2["stopped"])

    print("-- wylaczone kolo nie wysyla")
    d = devs[0]
    d.wheel._fire({"label": "A", "spec": "a"}, "wheel:0")
    check("wybor po stopie nie naciska klawisza", d.em.taps == [], d.em.taps)
    d.wheel.set_config({"enabled": True})
    d.wheel._fire({"label": "A", "spec": "a"}, "wheel:0")
    check("kontrola: wlaczone kolo naciska", d.em.taps == ["a"], d.em.taps)

    print("-- symulacja: plik zachowuje przelacznik trybu prawdziwego")
    bus3 = BusStub()
    rf.OVERLAY = OverlayStub()
    dev3 = DevStub("d1", bus3)
    with open(rf._dev_path("d1", "wheel"), "w", encoding="utf-8") as f:
        json.dump({"enabled": True}, f)
    rf.panic_stop(DmStub([dev3], simulate=True), bus3)
    with open(rf._dev_path("d1", "wheel"), encoding="utf-8") as f:
        zapis = json.load(f)
    check("silnik wylaczony", dev3.wheel.get_config()["enabled"] is False)
    check("plik w symulacji trzyma enabled z trybu prawdziwego", zapis.get("enabled") is True, zapis)
finally:
    for k, v in _saved.items():
        setattr(rf, k, v)
    shutil.rmtree(_tmp, ignore_errors=True)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
