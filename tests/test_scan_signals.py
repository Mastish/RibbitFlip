# Contract test: the ready-made triggers of the scanner ("Czym sterujesz skanerem").
# Run: py tests/test_scan_signals.py
#
# WHY THIS FILE EXISTS. The scanner has no trigger engine of its own: its section writes ordinary
# Mapping rules with the action `scan:sygnal` / `scan:cofnij` / `scan:stop`. That is the right
# design, and it means every ready-made in web/js/rf-50i-scan-signals.js has to survive the SERVER
# sanitiser and then behave in the real trigger engine. Both can turn a ready-made into something
# else WITHOUT SAYING SO:
#
# 1. THE SANITISER DROPS WHAT IT DOES NOT KNOW. An unknown `metric` becomes `tilt` WITH THE
#    THRESHOLD KEPT, so `spin < 900` would quietly become "angle below 900 degrees" — true always.
#    Nothing errors, nothing logs. Every rule here is round-tripped through the REAL sanitize_rules.
#
# 2. THE SENSOR HAS A CEILING. The gyroscope is +-250 deg/s (131 LSB per deg/s), so a threshold
#    above it is a movement nobody can perform. For the person this section was written for — who
#    cannot press the button — an unreachable ready-made teaches them that "movement does not work
#    on my machine", which is the worst thing this app can say.
#
# 3. THE LIST IS CONCATENATED WITH GESTURE_PRESETS (rf-12c) in one dropdown. A key colliding
#    across the two files means `find(key)` returns the wrong one and the person gets a trigger
#    they did not choose. Nothing checks that but this.
#
# 4. `wymaga` DECIDES WHO SEES WHAT. The dropdown groups by it: movement-only first, button-only
#    after. Get it wrong on one entry and somebody who cannot press is offered a press.
#
# The engine is driven directly, with no HTTP and no disk: this file must never touch Settings/.
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf  # noqa: E402

_passed = 0
_failed = 0

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCAN_JS = os.path.join(ROOT, "web", "js", "rf-50i-scan-signals.js")
GEST_JS = os.path.join(ROOT, "web", "js", "rf-12c-gesture-presets.js")

GYRO_MAX_DPS = 32767 / rf.PoseFilter.GYRO_LSB      # what the sensor can physically report (~250)
TWIST_MAX = 220.0        # deg/s
SPIN_MAX = 25000.0       # raw LSB
TILT_MAX = 180.0         # tilt is a magnitude of a half turn
PITCH_ROLL_MAX = 90.0    # both are +-90 by construction
HOLD_MAX_MS = 3000       # a position you must hold longer than three seconds is not a trigger
WYMAGA_OK = ("przycisk", "ruch", "nagranie")


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s   %s" % (name, detail))


def same(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return float(a) == float(b)
    return a == b


# --------------------------------------------------------------- reading the .js
def _strip_comments(src):
    """Remove // and /* */ comments, leaving string literals alone.

    A character scanner rather than a regex: the descriptions are Polish prose and a regex would
    happily eat half a sentence that contained a slash.
    """
    out = []
    i, n = 0, len(src)
    in_str = None
    while i < n:
        c = src[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(src[i + 1])
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in ('"', "'"):
            in_str = c
            out.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            while i < n and src[i] != "\n":
                i += 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            i += 2
            while i + 1 < n and not (src[i] == "*" and src[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def _array_literal(src, name):
    """The [...] that `const <name>=` is assigned, by bracket counting (strings excluded)."""
    m = re.search(r"const\s+%s\s*=\s*\[" % re.escape(name), src)
    if not m:
        return None
    start = m.end() - 1
    depth, i, n = 0, start, len(src)
    in_str = None
    while i < n:
        c = src[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in ('"', "'"):
            in_str = c
        elif c in "[{":
            depth += 1
        elif c in "]}":
            depth -= 1
            if depth == 0:
                return src[start:i + 1]
        i += 1
    return None


def load(path, name):
    with open(path, "r", encoding="utf-8") as f:
        src = _strip_comments(f.read())
    lit = _array_literal(src, name)
    if lit is None:
        return None
    lit = re.sub(r'([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:', r'\1"\2":', lit)
    lit = re.sub(r",(\s*[}\]])", r"\1", lit)
    return json.loads(lit)


# What the ready-mades are FOR. Duplicated on purpose: parsing alone could pass on a mis-parse,
# and a copy alone would drift away from the file without anybody noticing. Together they cannot.
#
# THE WHOLE RULE IS PINNED, not just the name. An earlier version of this file pinned only
# key/wymaga/label and checked thresholds against an UPPER bound ("can a human do this?"), which
# let the two changes that matter most slip through unseen: lowering a threshold until the trigger
# goes off by itself, and swapping the behaviour. Changing `behavior` from "once" to "continuous"
# turns a ready-made into something that sends a signal every 100 ms while you are leaning, and
# the engine section below could not tell the two apart either, because it drove one pose per state.
EXPECTED = [
    ("tap", "przycisk", "Puknięcie w kapsel",
     {"source": {"kind": "button", "any": True, "holdMs": 250}, "abs": False, "cmp": ">",
      "threshold": 0, "thresholdHi": None, "behavior": "once"}),
    ("tilt-right", "ruch", "Przechylenie w prawo",
     {"source": {"kind": "filter", "metric": "roll"}, "abs": False, "cmp": ">",
      "threshold": 35, "thresholdHi": None, "behavior": "once"}),
    ("tilt-left", "ruch", "Przechylenie w lewo",
     {"source": {"kind": "filter", "metric": "roll"}, "abs": False, "cmp": "<",
      "threshold": -35, "thresholdHi": None, "behavior": "once"}),
    ("nod", "ruch", "Skinienie w przód",
     {"source": {"kind": "filter", "metric": "pitch"}, "abs": False, "cmp": ">",
      "threshold": 30, "thresholdHi": None, "behavior": "once"}),
    ("nod-back", "ruch", "Odchylenie w tył",
     {"source": {"kind": "filter", "metric": "pitch"}, "abs": False, "cmp": "<",
      "threshold": -30, "thresholdHi": None, "behavior": "once"}),
    ("tilt-any", "ruch", "Wychylenie w dowolną stronę",
     {"source": {"kind": "filter", "metric": "tilt"}, "abs": False, "cmp": ">",
      "threshold": 40, "thresholdHi": None, "behavior": "once"}),
    ("hold-right", "ruch", "Przytrzymane przechylenie w prawo",
     {"source": {"kind": "filter", "metric": "roll"}, "abs": False, "cmp": ">",
      "threshold": 25, "thresholdHi": None, "behavior": "dwell", "dwellMs": 1500}),
    ("hold-nod", "ruch", "Przytrzymane skinienie",
     {"source": {"kind": "filter", "metric": "pitch"}, "abs": False, "cmp": ">",
      "threshold": 20, "thresholdHi": None, "behavior": "dwell", "dwellMs": 1500}),
    ("still", "ruch", "Znieruchomienie",
     {"source": {"kind": "filter", "metric": "spin"}, "abs": False, "cmp": "<",
      "threshold": 900, "thresholdHi": None, "behavior": "dwell", "dwellMs": 2500}),
]

PRESETS = load(SCAN_JS, "SKAN_ZRODLA_WLASNE")
check("the scanner's catalogue parses", isinstance(PRESETS, list) and bool(PRESETS),
      "load returned %r" % (PRESETS,))
if not PRESETS:
    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1)

GEST = load(GEST_JS, "GESTURE_PRESETS") or []
check("the mapping catalogue parses too", bool(GEST))

by_key = {p["key"]: p for p in PRESETS}

# ------------------------------------------------- 1. the shape of the catalogue
check("the catalogue holds what the contract says", len(PRESETS) == len(EXPECTED),
      "%d vs %d" % (len(PRESETS), len(EXPECTED)))
check("keys are unique", len({p["key"] for p in PRESETS}) == len(PRESETS))
check("labels are unique", len({p["label"] for p in PRESETS}) == len(PRESETS))
check("every entry has a one-line description",
      all(str(p.get("desc") or "").strip() for p in PRESETS),
      str([p["key"] for p in PRESETS if not str(p.get("desc") or "").strip()]))
# A ready-made must never decide the ACTION: in this section the action comes from the role box
# the person opened, and a ready-made that guessed it would overwrite that choice.
check("no entry carries an action",
      all("keySpec" not in p["rule"] and "sequence" not in p["rule"] for p in PRESETS),
      str([p["key"] for p in PRESETS if "keySpec" in p["rule"] or "sequence" in p["rule"]]))

for key, wymaga, label, rule in EXPECTED:
    p = by_key.get(key)
    check("%s: still in the file" % key, p is not None)
    if not p:
        continue
    check("%s: label unchanged" % key, p["label"] == label, "%r vs %r" % (p["label"], label))
    check("%s: `wymaga` unchanged" % key, p.get("wymaga") == wymaga,
          "%r vs %r" % (p.get("wymaga"), wymaga))
    # The WHOLE rule, field by field: threshold, comparison, behaviour and its timing. This is the
    # assertion that turns "somebody edited a number" from an invisible change into a red test.
    check("%s: the rule matches the contract" % key, p["rule"] == rule,
          json.dumps(p["rule"], ensure_ascii=False, sort_keys=True))

# Every entry must be readable in English too. The labels do not only sit in the dropdown — they are
# written into the RULE as its name (`_skanNowaRegula(spec, z.rule, _skanNazwa(z))`), so a missing
# pair leaves a Polish name on the Mapping list and on the cheat sheet of an English panel.
check("every entry has an English name",
      all(str(p.get("labelEn") or "").strip() for p in PRESETS),
      str([p["key"] for p in PRESETS if not str(p.get("labelEn") or "").strip()]))
check("every entry has an English description",
      all(str(p.get("descEn") or "").strip() for p in PRESETS),
      str([p["key"] for p in PRESETS if not str(p.get("descEn") or "").strip()]))
check("English names are unique too", len({p["labelEn"] for p in PRESETS}) == len(PRESETS))

check("every `wymaga` is one the dropdown groups by",
      all(p.get("wymaga") in WYMAGA_OK for p in PRESETS),
      str([(p["key"], p.get("wymaga")) for p in PRESETS if p.get("wymaga") not in WYMAGA_OK]))

# `wymaga` has to agree with the rule, or the grouping lies. This is the whole point of the field:
# somebody who cannot press the button must not be offered a press under "movement only".
for p in PRESETS:
    kind = (p["rule"].get("source") or {}).get("kind")
    expect = "przycisk" if kind == "button" else ("nagranie" if kind == "gesture" else "ruch")
    check("%s: `wymaga` matches the source" % p["key"], p.get("wymaga") == expect,
          "wymaga=%r but source.kind=%r" % (p.get("wymaga"), kind))

# THE REASON THIS SECTION EXISTS: most of the catalogue must work without the button.
bezprzycisku = [p for p in PRESETS if p.get("wymaga") == "ruch"]
check("most of the catalogue needs no button at all", len(bezprzycisku) >= len(PRESETS) - 2,
      "%d of %d need no button" % (len(bezprzycisku), len(PRESETS)))

# ------------------------------------------------- 2. no collision with the Mapping catalogue
# The dropdown is SKAN_ZRODLA_WLASNE.concat(GESTURE_PRESETS) and picks by key, so a duplicate key
# silently hands back the wrong entry.
gest_keys = {g["key"] for g in GEST}
gest_labels = {g["label"] for g in GEST}
collide_k = gest_keys & {p["key"] for p in PRESETS}
collide_l = gest_labels & {p["label"] for p in PRESETS}
check("no key collides with the Mapping ready-mades", not collide_k, str(sorted(collide_k)))
check("no label collides either", not collide_l, str(sorted(collide_l)))
check("every Mapping ready-made can be grouped as well",
      all(((g["rule"].get("source") or {}).get("kind") in ("button", "gesture", "filter", "axis"))
          for g in GEST),
      str([g["key"] for g in GEST]))

# ------------------------------------------------- 3. round trip through the REAL sanitiser
for p in PRESETS:
    raw = dict(p["rule"])
    raw["id"] = "scan_" + p["key"]
    raw["label"] = p["label"]
    raw["enabled"] = True
    raw["keySpec"] = "scan:sygnal"
    clean = rf.sanitize_rules([raw])
    check("%s: survives sanitize_rules" % p["key"], len(clean) == 1)
    if len(clean) != 1:
        continue
    c = clean[0]
    lost = []
    for k, v in raw.items():
        if k == "source":
            got = c.get("source") or {}
            for sk, sv in v.items():
                if not same(got.get(sk), sv):
                    lost.append("source.%s: %r -> %r" % (sk, sv, got.get(sk)))
        elif not same(c.get(k), v):
            lost.append("%s: %r -> %r" % (k, v, c.get(k)))
    check("%s: nothing the ready-made set was rewritten" % p["key"], not lost, "; ".join(lost))
    check("%s: the scanner action survives" % p["key"], c.get("keySpec") == "scan:sygnal",
          repr(c.get("keySpec")))

# ------------------------------------------------- 4. every threshold is reachable by a human
for p in PRESETS:
    src = p["rule"].get("source") or {}
    if src.get("kind") != "filter":
        continue
    metric = src.get("metric")
    vals = [abs(float(p["rule"].get("threshold") or 0))]
    if p["rule"].get("thresholdHi") is not None:
        vals.append(abs(float(p["rule"]["thresholdHi"])))
    worst = max(vals)
    if metric == "twist":
        check("%s: the turn threshold is reachable" % p["key"], worst <= TWIST_MAX,
              "%.0f deg/s vs limit %.0f (ceiling %.0f)" % (worst, TWIST_MAX, GYRO_MAX_DPS))
    elif metric == "spin":
        check("%s: the shake threshold is reachable" % p["key"], worst <= SPIN_MAX,
              "%.0f LSB vs limit %.0f" % (worst, SPIN_MAX))
    elif metric == "tilt":
        check("%s: the tilt threshold is an angle that exists" % p["key"], worst <= TILT_MAX,
              "%.0f deg" % worst)
    elif metric in ("pitch", "roll"):
        check("%s: the lean is within +-90 deg" % p["key"], worst <= PITCH_ROLL_MAX,
              "%.0f deg" % worst)

for p in PRESETS:
    if p["rule"].get("behavior") != "dwell":
        continue
    ms = int(p["rule"].get("dwellMs") or 0)
    check("%s: the hold is short enough to be a trigger" % p["key"], 0 < ms <= HOLD_MAX_MS,
          "%d ms vs limit %d" % (ms, HOLD_MAX_MS))

# `still` must sit under the number the firmware filter itself calls "not moving", otherwise the
# trigger would fire while the capsule is being carried.
still = by_key.get("still")
if still:
    check("`still` sits at the engine's own idea of stillness",
          float(still["rule"]["threshold"]) <= float(rf.PoseFilter.STILL_GYRO),
          "%s vs STILL_GYRO %s" % (still["rule"]["threshold"], rf.PoseFilter.STILL_GYRO))
    check("`still` compares downwards", still["rule"]["cmp"] == "<", still["rule"]["cmp"])


# ------------------------------------------------- the engine, driven by hand
class FakeBus:
    def __init__(self):
        self.events = []

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)


class Emitter:
    """Records what would have been sent, and presses nothing."""

    def __init__(self):
        self.taps = []
        self.downs = []
        self.ups = []

    def tap(self, spec):
        self.taps.append(spec)

    def down(self, spec):
        self.downs.append(spec)

    def up(self, spec):
        self.ups.append(spec)


def engine(rules):
    em = Emitter()
    t = rf.TriggerEngine(FakeBus(), emitter=em, armed=True)
    t.enabled = True
    t.set_rules(rf.sanitize_rules(rules))
    return t, em


def pose(t, spin=0.0, tilt=0.0, twist=0.0, pitch=0.0, roll=0.0):
    t.on_pose({"tilt": tilt, "twist": twist, "pitch": pitch, "roll": roll, "spin": spin})
    t.tick()


def click(t, down):
    """One edge of the capsule button: a 0x21 status packet, then a tick.

    Bytes 2..4 stay zero - a rule watching "any button activity" looks at ANY bit in bytes 1..4,
    and a battery level parked in byte 2 would make it fire forever.
    """
    t.on_status(bytes([0x21, 0x01 if down else 0x00, 0x00, 0x00, 0x00]))
    t.tick()


def rule_of(key, spec="scan:sygnal", **over):
    r = dict(by_key[key]["rule"])
    r["id"] = key
    r["label"] = by_key[key]["label"]
    r["enabled"] = True
    r["keySpec"] = spec
    r.update(over)
    return r


# 5. a lean in either direction, told apart by sign
t, em = engine([rule_of("tilt-right", "scan:sygnal"), rule_of("tilt-left", "scan:cofnij")])
pose(t, roll=50)
check("leaning right sends the signal only", em.taps == ["scan:sygnal"], str(em.taps))
pose(t, roll=0)
pose(t, roll=-50)
check("...and leaning left steps back only",
      em.taps == ["scan:sygnal", "scan:cofnij"], str(em.taps))

# 6. nodding forward and leaning back are a pair, not the same movement
t, em = engine([rule_of("nod", "scan:sygnal"), rule_of("nod-back", "scan:cofnij")])
pose(t, pitch=45)
check("a nod forward signals", em.taps == ["scan:sygnal"], str(em.taps))
pose(t, pitch=0)
pose(t, pitch=-45)
check("leaning back steps back", em.taps == ["scan:sygnal", "scan:cofnij"], str(em.taps))

# 7. the direction-free lean. `tilt` is a MAGNITUDE computed by the pose filter, so what has to be
#    proved here is that the rule reads that magnitude and NOT an axis - looping over roll and pitch
#    while setting `tilt` by hand (as an earlier version of this file did) runs the same test twice
#    and proves nothing. So: the axes are pushed to zero and only `tilt` is raised.
t, em = engine([rule_of("tilt-any")])
pose(t, tilt=55, roll=0.0, pitch=0.0)
check("tilt-any reads the magnitude, not an axis", em.taps == ["scan:sygnal"], str(em.taps))
check("tilt-any really is bound to `tilt`",
      (by_key["tilt-any"]["rule"]["source"] or {}).get("metric") == "tilt",
      str(by_key["tilt-any"]["rule"]["source"]))
# ...and a big lean on one axis with tilt still low must NOT fire, which is what tells this rule
# apart from `tilt-right`: the filter is the only thing allowed to decide what counts as leaning.
t, em = engine([rule_of("tilt-any")])
pose(t, tilt=10, roll=80, pitch=80)
check("tilt-any ignores the axes when the magnitude is small", em.taps == [], str(em.taps))

t, em = engine([rule_of("tilt-any")])
pose(t, tilt=20)
check("tilt-any ignores a small wobble", em.taps == [], str(em.taps))

# 7b. THE ONE READY-MADE FOR SOMEBODY WHO CAN PRESS. It is the first entry of the catalogue and the
#     only one in the "needs the button" group, so it deserves the engine and not just a round trip
#     through the sanitiser. What is being proved is the timing: a tap has to send the signal AT THE
#     PRESS. Until 2026-09-12 this entry carried `behavior:"taps"` with a 600 ms window, and that
#     branch decides only at the END of the window - in a module whose whole premise is "what counts
#     is the moment you were aiming at", 0.6 s late is a different field on the screen.
t, em = engine([rule_of("tap")])
click(t, True)
check("a tap on the capsule signals straight away", em.taps == ["scan:sygnal"], str(em.taps))
click(t, False)
for _ in range(14):                   # well past any 600 ms window
    time.sleep(0.05)
    t.tick()
check("...exactly once, with no second thought after a window",
      em.taps == ["scan:sygnal"], str(em.taps))
check("the tap ready-made carries no counting window",
      by_key["tap"]["rule"].get("behavior") == "once"
      and "windowMs" not in by_key["tap"]["rule"], str(by_key["tap"]["rule"]))

# 8. the held lean: a brush past the angle is not enough, staying there is.
#    The DROP-OUT test has to run against a hold the test can actually outlast - measuring 300 ms of
#    sleeps against the shipped 1500 ms would pass even if the reset were deleted from the engine,
#    which is exactly the bug this assertion exists to catch.
t, em = engine([rule_of("hold-right", dwellMs=250)])
pose(t, roll=40)
check("a brief lean is not a held lean", em.taps == [], str(em.taps))
for _ in range(3):                    # part of the way there...
    time.sleep(0.05)
    pose(t, roll=40)
pose(t, roll=0)                       # ...then out of the angle, which must zero the countdown
for _ in range(3):
    time.sleep(0.05)
    pose(t, roll=40)
check("letting go restarts the hold", em.taps == [], str(em.taps))
for _ in range(4):                    # and only a full, unbroken hold from there fires
    time.sleep(0.05)
    pose(t, roll=40)
check("...and a whole hold after that does fire", em.taps == ["scan:sygnal"], str(em.taps))

# The hold fires ONCE and does not turn into a repeater while you stay there. (The shipped 1500 ms
# is pinned as a NUMBER in EXPECTED; sleeping through it here would buy nothing but slow seconds.)
for _ in range(6):
    time.sleep(0.05)
    pose(t, roll=40)
check("...and keeps firing exactly once while held", em.taps == ["scan:sygnal"], str(em.taps))

# 9. stillness: it must NOT fire while the capsule is moving, and must fire once it settles -
#    then re-arm only after real movement, so a capsule left on the table is not a repeater.
t, em = engine([rule_of("still", dwellMs=250)])
for _ in range(8):
    time.sleep(0.05)
    pose(t, spin=4000)
check("a moving capsule is never still", em.taps == [], str(em.taps))
for _ in range(10):
    time.sleep(0.05)
    pose(t, spin=100)
check("going still fires once", em.taps == ["scan:sygnal"], str(em.taps))
for _ in range(10):
    time.sleep(0.05)
    pose(t, spin=100)
check("staying still does not fire again", em.taps == ["scan:sygnal"], str(em.taps))
pose(t, spin=5000)                    # move...
for _ in range(10):
    time.sleep(0.05)
    pose(t, spin=100)                 # ...and settle again
check("moving and settling again fires again",
      em.taps == ["scan:sygnal", "scan:sygnal"], str(em.taps))

# 10. THE SECOND DOOR: linking to a trigger you already have.
#     The section writes a scanner rule whose source is `{kind:"trigger", ref:<id>}`. The engine
#     reads the OTHER rule's state, so the borrowed trigger has to keep doing its own job too -
#     that is exactly what the explanation under the dropdown promises the person.
wlasny = {"id": "moj", "label": "Mój przechył", "enabled": True,
          "source": {"kind": "filter", "metric": "roll"}, "cmp": ">", "threshold": 30,
          "behavior": "once", "keySpec": "space"}
zaNim = {"id": "zanim", "label": "", "enabled": True,
         "source": {"kind": "trigger", "ref": "moj"}, "cmp": ">", "threshold": 0,
         "behavior": "once", "keySpec": "scan:sygnal"}
check("a trigger source survives the sanitiser",
      rf.sanitize_rules([zaNim])[0]["source"] == {"kind": "trigger", "ref": "moj"},
      str(rf.sanitize_rules([zaNim])[0]["source"]))

t, em = engine([wlasny, zaNim])
for _ in range(4):                    # the reference reads the stored state, so give it a tick
    pose(t, roll=50)
check("the borrowed trigger still presses its own key", "space" in em.taps, str(em.taps))
check("...and the scanner gets its signal from the same movement",
      "scan:sygnal" in em.taps, str(em.taps))

# A reference to a rule that no longer exists counts as false - it must not fire on its own.
t, em = engine([dict(zaNim)])
for _ in range(4):
    pose(t, roll=50)
check("a link to a deleted trigger fires nothing", em.taps == [], str(em.taps))

# 10b. THE PROMISE UNDER THE DROPDOWN: "the scanner will follow that trigger - INCLUDING its wait".
#      A `trigger` source reads the other rule's `over`, which is the RAW STATE OF ITS CONDITION and
#      goes true on the rising edge - long before a `dwell` rule acts. So a scanner rule left on
#      "once" would fire the instant the other condition is met and throw away the very safeguard
#      somebody set that trigger up for. `_skanZachowanieZa` (rf-50i) copies the wait across; this
#      is the assertion that says so.
zrodloDwell = {"id": "wolny", "label": "Długie przytrzymanie", "enabled": True,
               "source": {"kind": "filter", "metric": "roll"}, "cmp": ">", "threshold": 30,
               "behavior": "dwell", "dwellMs": 400, "keySpec": "space"}
naiwne = {"id": "naiwne", "label": "", "enabled": True,
          "source": {"kind": "trigger", "ref": "wolny"}, "cmp": ">", "threshold": 0,
          "behavior": "once", "keySpec": "scan:sygnal"}
zWaitem = dict(naiwne, id="zwaitem", behavior="dwell", dwellMs=400)

t, em = engine([zrodloDwell, dict(naiwne)])
pose(t, roll=50)
check("a link left on „once” throws the wait away (this is why it is copied)",
      em.taps == ["scan:sygnal"], str(em.taps))

t, em = engine([zrodloDwell, zWaitem])
pose(t, roll=50)
check("a link that copied the wait stays quiet at first", em.taps == [], str(em.taps))
for _ in range(12):
    time.sleep(0.05)
    pose(t, roll=50)
check("...and fires together with the trigger it follows",
      em.taps.count("scan:sygnal") == 1 and "space" in em.taps, str(em.taps))

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
