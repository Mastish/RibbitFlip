# Contract test: THE RANGE LABORATORY SHOWS THE SAME NUMBERS THE ENGINE COMPUTES.
# Run: py tests/test_midi_lab.py
#
# The mapping editor grew a laboratory: a live input band in the source's own units, the response
# curve with its ends labelled, and an output bar in the RECEIVER's units. A picture like that is
# only worth having while it agrees with the engine — a chart that lies about the engine is worse
# than no chart at all. Two halves, tested here in one go:
#
# 1. SERVER. The `mo` preview event now carries `x` — the input AFTER the physical stages (P2–P5),
#    in degrees / degrees-per-second / raw LSB. The existing `v` is 0..1 after the curve, so it can
#    never answer "where am I inside the window"; only `x` can, and only the server knows it (the
#    browser sees a pose rounded to 0.1°, without the calibration signs, and gets no telemetry at
#    all for a capsule that is not the focused slot). The silent failure here is `x` arriving
#    normalised: 45° would come out as 0.5, the axis would still be labelled in degrees, and the
#    dot would sit at the left edge for every mapping in the app.
#
# 2. PANEL. Field ids (the editor reads the form BY ID, so a typo in the new template quietly stops
#    saving half a mapping), the axis table against `_sanitize_map`'s defaults, the silent
#    recompute on a source change (allowed only while the user has not typed the numbers), the
#    output scale per destination, and the learning flow — which lives entirely on the server, so
#    the panel only has to send the right bodies and read the preview off `mo`.
#
# Nothing here starts a server or a browser: the engine is exercised through MidiMapper directly,
# and the panel through its own flat scripts run in Node's `vm` with stubbed globals.
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf  # noqa: E402

_passed = 0
_failed = 0


def _say(s):
    # Konsola Windows bywa w cp1250, a nazwy sprawdzen z harnessu niosa polskie znaki i cudzyslowy
    # drukarskie. Wyjatek kodowania w linii RAPORTU zabralby dokladnie te informacje, dla ktorej
    # test istnieje.
    enc = getattr(sys.stdout, "encoding", None) or "utf-8"
    print(s.encode(enc, "replace").decode(enc, "replace"))


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        _say("PASS  %s" % name)
    else:
        _failed += 1
        _say("FAIL  %s%s" % (name, ("   -> " + str(detail)) if detail else ""))


class FakeBus:
    def __init__(self):
        self.events = []

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)


def mapper(mappings, bus=None):
    bus = bus or FakeBus()
    mm = rf.MidiMapper(bus, midi=None, osc=None, trig=None, slot=0)
    mm.set_config({"enabled": True, "oscEnabled": True, "midiChannel": 0,
                   "oscPrefix": "/rf", "mappings": mappings})
    return mm, bus


def last_mo(bus):
    for ev in reversed(bus.events):
        if ev.get("t") == "mo":
            return ev
    return None


def pump(mm, bus, pose, sample=None, n=12):
    """Feed the chain until a preview event comes out.

    The window is ~66 ms of REAL time (`time.monotonic`), so a tight loop of process() calls
    produces exactly one event and then goes quiet — hence the short sleeps."""
    bus.events[:] = []
    for i in range(n):
        mm.process(sample, pose)
        ev = last_mo(bus)
        if ev is not None:
            return ev
        time.sleep(0.02)
    return last_mo(bus)


POSE = {"tilt": 45.0, "twist": 0.0, "pitch": 0.0, "roll": 0.0, "spin": 0.0}

print("--- serwer: `mo` niesie wejscie w JEDNOSTKACH ZRODLA ---------------")
mm, bus = mapper([{"id": "m1", "srcKind": "filter", "metric": "tilt", "dest": "cc",
                   "cc": 74, "inLo": 0, "inHi": 90, "rateMs": 5}])
ev = pump(mm, bus, dict(POSE))
check("zdarzenie podgladu w ogole przyszlo", ev is not None and ev.get("items"))
it = (ev.get("items") or [{}])[0] if ev else {}
check("`x` jest obecne", "x" in it, json.dumps(it))
# TO JEST TA ASERCJA: 45 stopni ma przyjsc jako 45, a nie jako 0.5 po normalizacji.
check("`x` w stopniach zrodla (45 stopni -> 45, nie 0.5)",
      abs(float(it.get("x", -1)) - 45.0) < 0.001, it.get("x"))
check("...a `v` dalej jest znormalizowane 0..1",
      0.0 <= float(it.get("v", -1)) <= 1.0 and abs(float(it.get("v", 0)) - 0.5) < 0.01, it.get("v"))
check("stary kontrakt nietkniety: id / v / o / s / n",
      all(k in it for k in ("id", "v", "o", "s", "n")), sorted(it.keys()))

# Surowa os: `x` musi byc w LSB (i ze znakiem kalibracji, ktorego przegladarka nie zna).
mm2, bus2 = mapper([{"id": "m2", "srcKind": "axis", "ch": 0, "dest": "cc", "cc": 1,
                     "inLo": -16000, "inHi": 16000, "rateMs": 5}])
ev2 = pump(mm2, bus2, dict(POSE), sample=[8000, 0, 0, 0, 0, 0])
it2 = (ev2.get("items") or [{}])[0] if ev2 else {}
check("os surowa: `x` w LSB, nie w 0..1", abs(abs(float(it2.get("x", 0))) - 8000.0) < 0.5,
      it2.get("x"))

# Filtr fizyczny (mediana / wygladzanie) siedzi PRZED tym odczepem — `x` ma byc sygnalem, ktory
# lancuch naprawde normalizuje, bo inaczej wykres pokazywalby co innego niz zakres opisuje.
mm3, bus3 = mapper([{"id": "m3", "srcKind": "filter", "metric": "tilt", "dest": "cc", "cc": 2,
                     "inLo": 0, "inHi": 90, "rateMs": 5, "medN": 3}])
for v in (30.0, 30.0, 30.0):
    mm3.process(None, {"tilt": v})
time.sleep(0.08)                                 # okno podgladu ma sie otworzyc PRZED skokiem
bus3.events[:] = []
mm3.process(None, {"tilt": 90.0})                # JEDEN skok, mediana 3 go zjada
ev3 = last_mo(bus3)
it3 = (ev3.get("items") or [{}])[0] if ev3 else {}
check("`x` czytane PO filtrach fizycznych (pojedynczy skok nie przechodzi)",
      float(it3.get("x", 999)) < 60.0, it3.get("x"))

print("\n--- serwer: nauka zakresu dalej dziala na tym samym sygnale -------")
mm4, bus4 = mapper([{"id": "m4", "srcKind": "filter", "metric": "tilt", "dest": "cc", "cc": 3,
                     "inLo": 0, "inHi": 90, "rateMs": 5}])
r = mm4.learn_start("m4", seconds=30.0, mode="minmax", symmetric=False, margin_pct=0.0)
check("start nauki przyjety", r.get("ok"), r)
for a in range(0, 61, 2):
    mm4.process(None, {"tilt": float(a)})
st = mm4.learn_state()
check("podglad nauki niesie narastajace min/max", st and st["lo"] == 0.0 and st["hi"] == 60.0, st)
ev4 = pump(mm4, bus4, {"tilt": 30.0}, n=6)
check("`learn` jedzie na istniejacym zdarzeniu `mo` (zero nowych kanalow)",
      ev4 is not None and "learn" in ev4, list((ev4 or {}).keys()))
res = mm4.learn_apply("m4")
check("apply wpisuje nauczony zakres", res.get("ok") and abs(res["inHi"] - 60.0) < 0.01, res)
check("...i mapowanie faktycznie go ma",
      abs(mm4.get_config()["mappings"][0]["inHi"] - 60.0) < 0.01,
      mm4.get_config()["mappings"][0]["inHi"])
bad = mapper([{"id": "m5", "srcKind": "filter", "metric": "tilt", "dest": "cc", "cc": 4}])[0]
bad.learn_start("m5", seconds=30.0)
for a in (30.0, 30.5, 31.0):
    bad.process(None, {"tilt": a})
    bad.process(None, {"tilt": a})
check("smieciowa nauka odrzucona, stare wartosci nietkniete",
      not bad.learn_apply("m5").get("ok")
      and bad.get_config()["mappings"][0]["inHi"] == 90.0)

print("\n--- panel: laboratorium zakresu (Node) ---------------------------")
# Domyslne okna prosto z silnika — panel musi je znac co do liczby, bo na nich opiera ciche
# przeliczenie przy zmianie zrodla.
DEFAULTS = {}
for key in ("tilt", "twist", "pitch", "roll", "spin", "axis"):
    src = {"id": "x", "dest": "cc"}
    if key == "axis":
        src.update({"srcKind": "axis", "ch": 0})
    else:
        src.update({"srcKind": "filter", "metric": key})
    mmx, _ = mapper([src])
    got = mmx.get_config()["mappings"][0]
    DEFAULTS[key] = [got["inLo"], got["inHi"]]
_say("domyslne z silnika: %s" % json.dumps(DEFAULTS))

harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "midi_lab_harness.mjs")
payload = json.dumps({"defaults": DEFAULTS}, ensure_ascii=False)
out = None
p = None
try:
    p = subprocess.run(["node", harness, payload], capture_output=True, text=True,
                       encoding="utf-8", timeout=90)
    out = json.loads((p.stdout or "").strip().splitlines()[-1]) if p.returncode == 0 else None
except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
    _say("POMINIETO  panel (Node): %s" % e)
if out is None and p is not None:
    check("harness laboratorium wystartowal", False, (p.stderr or p.stdout or "")[-600:])
for nm, ok, detail in (out or {}).get("checks", []):
    check(nm, ok, detail)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
