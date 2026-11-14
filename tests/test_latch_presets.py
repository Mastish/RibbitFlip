# Contract test: the 'latch' behaviour, and the setups that ship inside the app.
# Run: py tests/test_latch_presets.py
#
# Two things are checked here, both of which fail SILENTLY when they break.
#
# 1. LATCH. Every other behaviour is momentary — a rule is active exactly while its conditions
#    hold — so a setup could not remember anything. A latched rule stays active after the gesture
#    ends and other rules read that through the kind="trigger" condition they already had. The
#    trap is the edge: `over` now means "the switch is on", so the rising edge of the CONDITION
#    needs its own memory, or the state flips on every tick the gesture lasts.
#
# 2. THE BUILT-IN SETUPS. They are files in Presets/, so a typo in a name, a field the sanitiser
#    silently drops or a threshold outside the sensor's real range would all still "load fine"
#    and simply do nothing. The gyroscope is +-250 deg/s (131 LSB/deg/s, int16), so a twist
#    threshold above that can never be reached by any hand.
#
# The engine is driven directly, with no HTTP and no disk: this file must never touch the
# owner's Settings/.
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf  # noqa: E402

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
    t.set_rules(rf.sanitize_rules(rules))
    t.on_pose({"tilt": 0.0, "twist": 0.0, "pitch": 0.0, "roll": 0.0})
    return t, em


def press(t, on):
    """The cap's tap sensor: a status packet with the button bit set, then the engine ticks.

    Layout `21 <button> 00 00 00` — bytes 2..4 have to stay zero, because a rule bound to "any
    button activity" watches for ANY bit in bytes 1..4. This is not pedantry: both simulated
    pucks used to put a battery level and a counter there, which made every such rule fire twice
    a second forever.
    """
    t.on_status(bytes([0x21, 0x01 if on else 0x00, 0x00, 0x00, 0x00]))
    t.tick()


def release(t, hold_ms=260):
    """Let go and wait out holdMs in REAL time.

    The button condition is true for holdMs after the last pulse, and that window is measured
    against the clock, not against ticks — spinning the tick loop a thousand times does not make
    it lapse. A test that only ticks would see the condition stuck true and conclude the switch
    cannot be flipped back, which is exactly the wrong lesson.
    """
    t.on_status(bytes([0x21, 0x00, 0x00, 0x00, 0x00]))
    time.sleep(hold_ms / 1000.0)
    t.tick()


# ---------------------------------------------------------------- 1. latch
LATCH = [
    {"id": "mode", "label": "tryb", "source": {"kind": "button", "any": True},
     "behavior": "latch", "keySpec": ""},
    {"id": "gated", "label": "bramkowana", "source": {"kind": "trigger", "ref": "mode"},
     "behavior": "once", "keySpec": "media_next"},
]

t, em = engine(LATCH)
rt = t._rt

check("latch survives the sanitiser", t.snapshot_rules()[0]["behavior"] == "latch",
      t.snapshot_rules()[0]["behavior"])
t.tick()
check("a switch starts off", not rt["mode"]["over"])
check("a rule gated on it does not fire while it is off", em.taps == [], str(em.taps))

press(t, True)
check("the gesture turns it on", rt["mode"]["over"] is True)

for _ in range(20):          # the button stays 'held' for holdMs — this must NOT re-flip it
    t.tick()
check("holding the gesture does not flip it again", rt["mode"]["over"] is True)
check("the gated rule now fires", em.taps == ["media_next"], str(em.taps))

release(t)
check("it STAYS on after the gesture ends", rt["mode"]["over"] is True)

press(t, True)
check("the next gesture turns it off", rt["mode"]["over"] is False)
em.taps = []
t.tick()
check("the gated rule is silent again", em.taps == [], str(em.taps))

# a latch that also carries a key taps it on every flip, in both directions
t2, em2 = engine([{"id": "m", "source": {"kind": "button", "any": True},
                   "behavior": "latch", "keySpec": "media_play_pause"}])
press(t2, True)
release(t2)
press(t2, True)
check("a key on the switch is tapped on every flip",
      em2.taps == ["media_play_pause", "media_play_pause"], str(em2.taps))

# disabling the rule must not leave the state behind, or re-enabling it comes back inverted
t3, _ = engine(LATCH)
press(t3, True)
check("switch on before disabling", t3._rt["mode"]["over"] is True)
rules = t3.snapshot_rules()
rules[0]["enabled"] = False
t3.set_rules(rules)
t3.tick()
check("disabling the rule switches it off", t3._rt["mode"]["over"] is False)

# ------------------------------------------------- 2. the setups inside the app
GYRO_MAX_DPS = 32767 / rf.PoseFilter.GYRO_LSB      # what the sensor can physically report

names = rf.list_builtin_setups()
check("the app ships setups", len(names) >= 2, str(names))

for nm in names:
    env = rf.load_setup(nm)
    check("%s: loads by name" % nm, isinstance(env, dict), "load_setup returned %r" % (env,))
    if not isinstance(env, dict):
        continue
    check("%s: the name survives the file-name sanitiser" % nm,
          rf._safe_profile_name(env.get("name", "")) == nm,
          "%r -> %r" % (env.get("name"), rf._safe_profile_name(env.get("name", ""))))

    cfg = env.get("config") or {}
    raw = cfg.get("rules") or []
    clean = rf.sanitize_rules(raw)
    same = all(a.get(k) == b.get(k) for a, b in zip(raw, clean) for k in set(a) | set(b))
    check("%s: every field survives the sanitiser" % nm, len(raw) == len(clean) and same)

    an = rf.analyze_config(cfg)
    check("%s: loads in SAFE mode (nothing risky)" % nm, an["riskyCount"] == 0,
          json.dumps(an["rules"], ensure_ascii=False)[:200])

    for r in clean:
        src = r["source"]
        lo, hi = r["threshold"], r["thresholdHi"]
        if src.get("kind") == "filter" and src.get("metric") == "twist":
            worst = max(abs(lo), abs(hi or 0))
            check("%s / %s: the turn threshold is reachable by a hand" % (nm, r["id"]),
                  worst < GYRO_MAX_DPS,
                  "%.0f deg/s vs sensor ceiling %.0f" % (worst, GYRO_MAX_DPS))
        if r["cmp"] == "in":
            check("%s / %s: the range has both ends" % (nm, r["id"]), hi is not None and lo != hi,
                  "%s..%s" % (lo, hi))

    # every rule has to be able to fire on its own: a band nobody can enter is dead weight
    ids = {r["id"] for r in clean}
    check("%s: rule ids are unique" % nm, len(ids) == len(clean))

# Deleting is only ever allowed inside the user's own library. Guarded: if this machine happens
# to have a SAVED setup under the same name, delete_setup would remove that real file — a test
# must not eat somebody's work to prove a point.
shadowed = os.path.exists(os.path.join(rf.SETUPS_DIR, names[0] + ".json"))
if shadowed:
    print("SKIP  a built-in setup cannot be deleted (a saved setup shadows %r here)" % names[0])
else:
    check("a built-in setup cannot be deleted", rf.delete_setup(names[0]) is False)
    check("...and is still loadable afterwards", isinstance(rf.load_setup(names[0]), dict))

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
