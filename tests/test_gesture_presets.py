# Contract test: the ready-made gestures in the mapping editor ("Wybierz z domyślnych").
# Run: py tests/test_gesture_presets.py
#
# The presets live in the BROWSER (web/js/rf-12c-gesture-presets.js) but every one of them ends up
# in the server-side sanitiser and then in the trigger engine, and both of those can turn a preset
# into something else WITHOUT SAYING SO:
#
# 1. THE SANITISER DROPS WHAT IT DOES NOT KNOW. `metric: "spin"` was not on its whitelist until
#    today; a rule that used it was silently rewritten to `tilt`, kept its threshold of 12000 and
#    therefore compared 12000 against an angle that never exceeds 180. Nothing errors, nothing
#    logs, the rule simply never fires. Every preset here is round-tripped through the REAL
#    sanitize_rules for exactly that reason.
#
# 2. THE SENSOR HAS A CEILING. The gyroscope is +-250 deg/s (131 LSB per deg/s, int16), so a twist
#    threshold above that is a gesture no hand can perform, and a spin threshold far above it is
#    the same thing in raw units. A preset offered in a dropdown has to be reachable by whoever
#    picks it, or the app is teaching people that gestures do not work.
#
# 3. THE BEHAVIOUR HAS TO MATCH THE PROMISE. "Długie przytrzymanie" must NOT fire on a short tap,
#    and "Podwójne kliknięcie" must NOT fire on a single one. Both are one field away from being
#    wrong in a way that reads as "the capsule is flaky".
#
# HOW THE PRESETS ARE READ. The source of truth is the .js file: it is parsed here (comments
# stripped, bare keys quoted, then json.loads) AND compared field by field against EXPECTED below.
# Parsing alone could pass on a mis-parse; a copy alone would drift away from the file without
# anybody noticing. Together they cannot: a mis-parse fails the comparison, and an edit to the .js
# fails it too and says which field moved.
#
# The engine is driven directly, with no HTTP and no disk: this file must never touch the owner's
# Settings/.
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf  # noqa: E402

_passed = 0
_failed = 0

PRESET_JS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                         "web", "js", "rf-12c-gesture-presets.js")

GYRO_MAX_DPS = 32767 / rf.PoseFilter.GYRO_LSB      # what the sensor can physically report (~250)
TWIST_MAX = 220.0        # deg/s - a turn threshold above this leaves no headroom to the ceiling
SPIN_MAX = 25000.0       # raw LSB (~190 deg/s of whole-vector energy)
TILT_MAX = 180.0         # degrees - tilt is a magnitude, it cannot exceed half a turn


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s   %s" % (name, detail))


def same(a, b):
    """Equal, counting 12000 and 12000.0 as the same thing (the sanitiser floats numbers)."""
    if isinstance(a, bool) or isinstance(b, bool):
        return a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return float(a) == float(b)
    return a == b


# --------------------------------------------------------------- reading the .js
def _strip_comments(src):
    """Remove // and /* */ comments, leaving string literals alone.

    A character scanner rather than a regex, because the descriptions are Polish prose and a
    regex would happily eat half a sentence that contained a slash.
    """
    out = []
    i, n = 0, len(src)
    in_str = None
    while i < n:
        c = src[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:          # an escaped character travels whole
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


def load_presets():
    with open(PRESET_JS, "r", encoding="utf-8") as f:
        src = _strip_comments(f.read())
    lit = _array_literal(src, "GESTURE_PRESETS")
    if lit is None:
        return None
    lit = re.sub(r'([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:', r'\1"\2":', lit)   # bare keys -> JSON keys
    lit = re.sub(r",(\s*[}\]])", r"\1", lit)                                  # trailing commas
    return json.loads(lit)


# What the six presets are FOR. Duplicated on purpose - see the header.
EXPECTED = [
    ("shake", "Potrząśnięcie",
     {"source": {"kind": "filter", "metric": "spin"}, "abs": False, "cmp": ">",
      "threshold": 12000, "thresholdHi": None, "behavior": "once"}),
    ("upsidedown", "Odwrócenie do góry dnem",
     {"source": {"kind": "filter", "metric": "tilt"}, "abs": False, "cmp": ">",
      "threshold": 155, "thresholdHi": None, "behavior": "dwell", "dwellMs": 400}),
    # Positive twist is counter-clockwise seen from above = a turn to the LEFT, and the shipped
    # "Media - pokrętło głośności" setup reads it the same way. The labels sit on the signs the
    # hardware actually produces, rather than the numbers being bent to the labels.
    ("turn-right", "Szybki obrót w prawo",
     {"source": {"kind": "filter", "metric": "twist"}, "abs": False, "cmp": "<",
      "threshold": -200, "thresholdHi": None, "behavior": "once"}),
    ("turn-left", "Szybki obrót w lewo",
     {"source": {"kind": "filter", "metric": "twist"}, "abs": False, "cmp": ">",
      "threshold": 200, "thresholdHi": None, "behavior": "once"}),
    ("double-click", "Podwójne kliknięcie przycisku",
     {"source": {"kind": "button", "any": True, "holdMs": 150}, "abs": False, "cmp": ">",
      "threshold": 0, "thresholdHi": None, "behavior": "multi", "crossings": 2, "windowMs": 600}),
    ("long-press", "Długie przytrzymanie przycisku",
     {"source": {"kind": "button", "any": True, "holdMs": 250}, "abs": False, "cmp": ">",
      "threshold": 0, "thresholdHi": None, "behavior": "dwell", "dwellMs": 600}),
]

PRESETS = load_presets()
check("the presets file parses", isinstance(PRESETS, list) and bool(PRESETS),
      "load_presets returned %r" % (PRESETS,))
if not PRESETS:
    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1)

check("there are exactly six of them", len(PRESETS) == len(EXPECTED),
      "%d vs %d" % (len(PRESETS), len(EXPECTED)))
check("keys are unique", len({p["key"] for p in PRESETS}) == len(PRESETS))
check("labels are unique", len({p["label"] for p in PRESETS}) == len(PRESETS))
check("every preset has a one-line description",
      all(str(p.get("desc") or "").strip() for p in PRESETS),
      str([p["key"] for p in PRESETS if not str(p.get("desc") or "").strip()]))
# A preset must never decide the ACTION: that is the one thing only the person picking it knows.
check("no preset carries an action",
      all("keySpec" not in p["rule"] and "sequence" not in p["rule"] for p in PRESETS),
      str([p["key"] for p in PRESETS if "keySpec" in p["rule"] or "sequence" in p["rule"]]))

by_key = {p["key"]: p for p in PRESETS}
for key, label, rule in EXPECTED:
    p = by_key.get(key)
    check("%s: still in the file" % key, p is not None)
    if not p:
        continue
    check("%s: label unchanged" % key, p["label"] == label, "%r vs %r" % (p["label"], label))
    check("%s: the rule matches the contract" % key, p["rule"] == rule,
          json.dumps(p["rule"], ensure_ascii=False, sort_keys=True))

# ------------------------------------------------- 1. round trip through the REAL sanitiser
for p in PRESETS:
    raw = dict(p["rule"])
    raw["id"] = "gp_" + p["key"]
    raw["label"] = p["label"]
    raw["enabled"] = True
    raw["keySpec"] = "space"          # the action the USER adds; the preset never sets it
    clean = rf.sanitize_rules([raw])
    check("%s: survives sanitize_rules" % p["key"], len(clean) == 1)
    if len(clean) != 1:
        continue
    c = clean[0]
    lost = []
    for k, v in raw.items():
        if k == "source":
            # the sanitiser fills a button source in (byte/bit) - what matters is that nothing the
            # preset SET was changed, hence a subset comparison rather than an equality
            got = c.get("source") or {}
            for sk, sv in v.items():
                if not same(got.get(sk), sv):
                    lost.append("source.%s" % sk)
        elif not same(c.get(k), v):
            lost.append(k)
    check("%s: every field survives the sanitiser" % p["key"], not lost, "changed: %s" % lost)
    check("%s: the action is untouched" % p["key"], c["keySpec"] == "space", c["keySpec"])

# ------------------------------------------------- 2. thresholds a hand can actually reach
for p in PRESETS:
    src = p["rule"].get("source") or {}
    if src.get("kind") != "filter":
        continue
    metric = src.get("metric")
    worst = max(abs(float(p["rule"].get("threshold") or 0)),
                abs(float(p["rule"].get("thresholdHi") or 0)))
    if metric == "twist":
        check("%s: the turn threshold leaves headroom to the ceiling" % p["key"],
              worst <= TWIST_MAX,
              "%.0f deg/s vs limit %.0f (sensor ceiling %.0f)" % (worst, TWIST_MAX, GYRO_MAX_DPS))
        check("%s: ...and is below the sensor ceiling at all" % p["key"], worst < GYRO_MAX_DPS,
              "%.0f vs %.0f" % (worst, GYRO_MAX_DPS))
    elif metric == "spin":
        check("%s: the shake threshold is reachable" % p["key"], worst <= SPIN_MAX,
              "%.0f LSB (= %.0f deg/s) vs limit %.0f" % (worst, worst / rf.PoseFilter.GYRO_LSB, SPIN_MAX))
    elif metric == "tilt":
        check("%s: the tilt threshold is an angle that exists" % p["key"], worst <= TILT_MAX,
              "%.0f deg" % worst)

# ------------------------------------------------- 3. 'spin' is a source, not a typo
src = rf._sanitize_source({"kind": "filter", "metric": "spin"})
check("spin passes _sanitize_source unchanged", src == {"kind": "filter", "metric": "spin"}, str(src))
check("an unknown metric still falls back to tilt",
      rf._sanitize_source({"kind": "filter", "metric": "wobble"})["metric"] == "tilt")
check("spin survives a whole rule",
      rf.sanitize_rules([{"id": "s", "source": {"kind": "filter", "metric": "spin"},
                          "cmp": ">", "threshold": 12000}])[0]["source"]["metric"] == "spin")


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


def pose(t, spin=0.0, tilt=0.0, twist=0.0):
    t.on_pose({"tilt": tilt, "twist": twist, "pitch": 0.0, "roll": 0.0, "spin": spin})
    t.tick()


def click(t, down):
    """One edge of the capsule button: a 0x21 status packet, then a tick.

    Bytes 2..4 stay zero - a rule watching "any button activity" looks at ANY bit in bytes 1..4,
    and a battery level parked in byte 2 would make it fire forever.
    """
    t.on_status(bytes([0x21, 0x01 if down else 0x00, 0x00, 0x00, 0x00]))
    t.tick()


def preset_rule(key, spec="space"):
    r = dict(by_key[key]["rule"])
    r["id"] = key
    r["label"] = by_key[key]["label"]
    r["enabled"] = True
    r["keySpec"] = spec
    return r


# ------------------------------------------------- 4. the shake fires on energy, not on an angle
t, em = engine([preset_rule("shake", "media_next")])
pose(t, spin=5000)
check("a nudge does not count as a shake", em.taps == [], str(em.taps))
pose(t, spin=15000)
check("a real shake fires", em.taps == ["media_next"], str(em.taps))
pose(t, spin=16000)
check("holding the shake does not fire again (once)", em.taps == ["media_next"], str(em.taps))
pose(t, spin=1000)
pose(t, spin=15000)
check("the next shake fires again", em.taps == ["media_next", "media_next"], str(em.taps))

# the angle metrics must be left out of it: a cap lying flat and shaken has tilt 0
t2, em2 = engine([preset_rule("shake", "space")])
pose(t2, spin=15000, tilt=0.0)
check("a shake with the cap flat still fires", em2.taps == ["space"], str(em2.taps))

# ------------------------------------------------- 5. double click: two clicks, not one
t3, em3 = engine([preset_rule("double-click", "space")])
click(t3, True)
click(t3, False)
time.sleep(0.20)                    # holdMs is 150 ms and is measured against the clock
t3.tick()
check("one click is not a double click", em3.taps == [], str(em3.taps))
click(t3, True)
check("two clicks inside the window fire", em3.taps == ["space"], str(em3.taps))

# ...and two clicks FURTHER APART than the window do not
t4, em4 = engine([preset_rule("double-click", "space")])
click(t4, True)
click(t4, False)
time.sleep(0.75)                    # windowMs is 600 ms
t4.tick()
click(t4, True)
check("two clicks too far apart do not fire", em4.taps == [], str(em4.taps))

# ------------------------------------------------- 6. long press: held, not tapped
t5, em5 = engine([preset_rule("long-press", "space")])
click(t5, True)
click(t5, False)                    # a tap: the condition lapses after holdMs (250 ms)
for _ in range(10):
    time.sleep(0.05)
    t5.tick()
check("a short tap is not a long press", em5.taps == [], str(em5.taps))

t6, em6 = engine([preset_rule("long-press", "space")])
t6.on_status(bytes([0x21, 0x01, 0x00, 0x00, 0x00]))
for _ in range(16):                 # ...and the unit keeps SAYING the button is down
    t6.on_button_level(1)
    t6.tick()
    time.sleep(0.05)
check("holding it past dwellMs fires", em6.taps == ["space"], str(em6.taps))

# ------------------------------------------------- 7. the two turns are opposite gestures
right = by_key["turn-right"]["rule"]
left = by_key["turn-left"]["rule"]
check("turning right and left are opposite signs",
      float(right["threshold"]) * float(left["threshold"]) < 0,
      "%s / %s" % (right["threshold"], left["threshold"]))
check("each turn compares in the direction its sign points",
      right["cmp"] == "<" and left["cmp"] == ">",
      "%s / %s" % (right["cmp"], left["cmp"]))

t7, em7 = engine([preset_rule("turn-right", "right"), preset_rule("turn-left", "left")])
pose(t7, twist=-230)
check("a brisk turn right sends only the right-hand key", em7.taps == ["right"], str(em7.taps))
pose(t7, twist=0)
pose(t7, twist=230)
check("...and a turn the other way only the left-hand one",
      em7.taps == ["right", "left"], str(em7.taps))

# ------------------------------------------------- 8. upside down needs the dwell to elapse
t8, em8 = engine([preset_rule("upsidedown", "space")])
pose(t8, tilt=170)
check("being upside down for an instant is not enough", em8.taps == [], str(em8.taps))
for _ in range(10):
    time.sleep(0.05)
    pose(t8, tilt=170)
check("staying upside down fires", em8.taps == ["space"], str(em8.taps))

# ------------------------------------------------- 9. Mapping start tiles (UX 261120, P-G1-01)
# The six tiles of an empty Mapping ("Co ma zrobić kapsel?") live in the same file as TRIG_TILES.
# Signs follow the shipped setup "Media - cztery strony" and the Scanner's lean signals: left
# roll < -25, right roll > 25, FORWARD pitch < -25, BACK pitch > 25. "Kliknięcie przycisku" is
# `once`, not a counted tap: a tap waits out its window and a jump key would come 0.35 s late.
def load_tiles():
    with open(PRESET_JS, "r", encoding="utf-8") as f:
        src = _strip_comments(f.read())
    lit = _array_literal(src, "TRIG_TILES")
    if lit is None:
        return None
    lit = re.sub(r'([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:', r'\1"\2":', lit)
    lit = re.sub(r",(\s*[}\]])", r"\1", lit)
    return json.loads(lit)


TILES_EXPECTED = [
    ("lean-left", "Pochyl w lewo", {"source": {"kind": "filter", "metric": "roll"}, "abs": False, "cmp": "<",
     "threshold": -25, "thresholdHi": None, "behavior": "hold"}),
    ("lean-right", "Pochyl w prawo", {"source": {"kind": "filter", "metric": "roll"}, "abs": False, "cmp": ">",
     "threshold": 25, "thresholdHi": None, "behavior": "hold"}),
    ("lean-fwd", "Pochyl do przodu", {"source": {"kind": "filter", "metric": "pitch"}, "abs": False, "cmp": "<",
     "threshold": -25, "thresholdHi": None, "behavior": "hold"}),
    ("lean-back", "Pochyl do tyłu", {"source": {"kind": "filter", "metric": "pitch"}, "abs": False, "cmp": ">",
     "threshold": 25, "thresholdHi": None, "behavior": "hold"}),
    ("turn-any", "Obróć kapsel", {"source": {"kind": "filter", "metric": "twist"}, "abs": True, "cmp": ">",
     "threshold": 200, "thresholdHi": None, "behavior": "once"}),
    ("click-once", "Kliknięcie przycisku", {"source": {"kind": "button", "any": True, "holdMs": 250}, "abs": False,
     "cmp": ">", "threshold": 0, "thresholdHi": None, "behavior": "once"}),
]
TILES = load_tiles()
check("tiles: TRIG_TILES parses", isinstance(TILES, list) and bool(TILES))
TILES = TILES or []
check("tiles: exactly six, in the order of the grid",
      [t["key"] for t in TILES] == [k for k, _, _ in TILES_EXPECTED], [t["key"] for t in TILES])
for key, label, rule in TILES_EXPECTED:
    t = next((x for x in TILES if x["key"] == key), None)
    if t is None:
        check("tiles: %s still in the file" % key, False)
        continue
    check("tiles: %s label" % key, t["label"] == label, t["label"])
    check("tiles: %s rule matches the sign convention" % key, t["rule"] == rule,
          json.dumps(t["rule"], ensure_ascii=False, sort_keys=True))
    check("tiles: %s has an English name and an icon slot" % key, bool(t.get("en")) and bool(t.get("ico")))
    raw = dict(t["rule"], id="tile_" + key, label=label, enabled=True, keySpec="a")
    clean = rf.sanitize_rules([raw])
    ok = (len(clean) == 1
          and all(same(clean[0].get(k), v) for k, v in raw.items() if k != "source")
          and all(same((clean[0].get("source") or {}).get(sk), sv) for sk, sv in raw["source"].items()))
    check("tiles: %s survives sanitize_rules unchanged" % key, ok, clean)
check("tiles: the four leans carry the words for the live direction step",
      all((t.get("dir") or {}).get("pl") and (t.get("dir") or {}).get("en")
          for t in TILES if t["key"].startswith("lean-")))
check("tiles: no tile carries an action",
      not any("keySpec" in t["rule"] or "sequence" in t["rule"] for t in TILES))
check("tiles: keys do not collide with GESTURE_PRESETS",
      not ({t["key"] for t in TILES} & {p["key"] for p in PRESETS}))


def tile_rule(key, spec):
    t = next(x for x in TILES if x["key"] == key)
    return dict(t["rule"], id="tile_" + key, label=t["label"], enabled=True, keySpec=spec)


def lean(t, roll=0.0, pitch=0.0):
    t.on_pose({"tilt": 0.0, "twist": 0.0, "pitch": pitch, "roll": roll, "spin": 0.0})
    t.tick()


if TILES:
    t9, em9 = engine([tile_rule("lean-left", "a"), tile_rule("lean-right", "d"),
                      tile_rule("lean-fwd", "w"), tile_rule("lean-back", "s")])
    lean(t9, roll=-30)
    check("tiles: leaning left holds only the left key", em9.downs == ["a"], str(em9.downs))
    lean(t9, roll=0)
    check("tiles: ...and lets it go when the capsule comes back", em9.ups == ["a"], str(em9.ups))
    lean(t9, pitch=-30)
    check("tiles: forward is negative pitch", em9.downs == ["a", "w"], str(em9.downs))
    lean(t9, pitch=0)
    lean(t9, roll=10)
    check("tiles: a small lean presses nothing", em9.downs == ["a", "w"], str(em9.downs))
    t10, em10 = engine([tile_rule("click-once", "space")])
    click(t10, True)
    check("tiles: one click fires at once (no counted-tap wait)", em10.taps == ["space"], str(em10.taps))


# UX 261120 L4e: edytor wyzwalacza na trzech piętrach. Warunek główny i trzy podstawowe zachowania
# w „Warunek i zachowanie” (piętro 2), rzadkie zachowania z liczbą i oknem czasu (`crossings`,
# `windowMs`: te same 2 i 600 ms w każdej regule gotowych zestawów), dodatkowe warunki i sygnały
# w jednym „Zaawansowane” (piętro 3), oba przez rfTier z licznikiem zmian.
_ED = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web", "js",
                        "rf-12-preview-editor.js"), encoding="utf-8").read()
check("tiers: the editor has a tier-2 fold and ONE advanced fold",
      'id="edTune"' in _ED and 'class="cardfold adv col2 ed-fold ed-adv" id="edAdv"' in _ED
      and _ED.count("cardfold adv") == 1)
check("tiers: the rare behaviours sit in Advanced",
      'const ED_BEH_MORE=["multi","taps","dwell","latch"]' in _ED)
check("tiers: both folds go through rfTier with a change counter",
      'rfTier(tune,' in _ED and 'rfTier(adv,"mapowanie.edytor.zaawansowane"' in _ED
      and "changed:()=>edAdvChanged(d)" in _ED)
check("tiers: crossings and window count as changed only when they differ from 2 and 600 ms",
      "+d.crossings!==2" in _ED and "+d.windowMs!==600" in _ED)
check("tiers: Save is the one main action of the editor", 'class="btn rf-cta" id="edSave"' in _ED)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
