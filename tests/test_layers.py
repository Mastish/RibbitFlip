# Contract test: MAPPING LAYERS — one capsule, several sets of rules.
# Run: py tests/test_layers.py
#
# What is easy to break here, and silent when it breaks:
#
# 1. THE DEFAULT. Every rule written before layers existed has no `layer` field, and every one of
#    them has to keep working in every layer. The sanitiser fills in 0 ("Zawsze"); one typo there
#    and a person's whole set goes quiet on the day they update.
#
# 2. LEAVING A LAYER. A rule of the layer you just left must behave EXACTLY like a switched-off
#    one: let go of what it is holding, forget half-counted taps. Skip that and a movement key
#    stays down in a game with nothing on screen to say why.
#
# 3. THE SHIFT KEY. `layer:hold:N` is the one action that has to survive its own effect. A rule
#    filtered out the instant it switches the layer could never let go: releasing would put the
#    layer back, which would bring the rule back, which would press it again — a flip-flop at
#    tick rate that reads as "the capsule went mad".
#
# 4. LAYERS NEVER REACH THE OPERATING SYSTEM. `layer:2` is not a key. If it ever went to the
#    emitter, the app would try to press a button called "layer:2" — and the release of a held
#    one would do it too.
#
# The engine is driven directly, with no HTTP. The one part that needs a disk (does an old rules
# file still load?) is pointed at a temp directory first: this file must never touch the owner's
# Settings/.
import json
import os
import shutil
import sys
import tempfile
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

    def seen(self):
        return self.taps + self.downs + self.ups


def engine(rules, emitter=True):
    em = Emitter() if emitter else None
    t = rf.TriggerEngine(FakeBus(), emitter=em, armed=True)
    t.set_rules(rf.sanitize_rules(rules))
    t.on_pose({"tilt": 0.0, "twist": 0.0, "pitch": 0.0, "roll": 0.0})
    return t, em


def press(t, on=True):
    """The cap's tap sensor: a status packet with the button bit set, then a tick.

    Layout `21 <button> 00 00 00` — bytes 2..4 stay zero, because a rule bound to "any button
    activity" watches for ANY bit in bytes 1..4."""
    t.on_status(bytes([0x21, 0x01 if on else 0x00, 0x00, 0x00, 0x00]))
    t.tick()


def release(t, hold_ms=260):
    """Let go and wait out holdMs in REAL time — the button condition stays true for holdMs after
    the last pulse, measured against the clock, not against ticks."""
    t.on_status(bytes([0x21, 0x00, 0x00, 0x00, 0x00]))
    time.sleep(hold_ms / 1000.0)
    t.tick()


def btn(rid, key, layer=0, behavior="once", **extra):
    r = {"id": rid, "source": {"kind": "button", "any": True},
         "behavior": behavior, "keySpec": key, "layer": layer}
    r.update(extra)
    return r


# ------------------------------------------------------- 0. the sanitiser (g)
S = rf.sanitize_rules([
    {"id": "plain", "keySpec": "a"},                       # written before layers existed
    {"id": "two", "keySpec": "b", "layer": 2},
    {"id": "high", "keySpec": "c", "layer": 9},
    {"id": "neg", "keySpec": "d", "layer": -3},
    {"id": "junk", "keySpec": "e", "layer": "trzy"},
    {"id": "text", "keySpec": "f", "layer": "4"},
])
_by = {r["id"]: r for r in S}
check("a rule with no layer gets 0 (Zawsze)", _by["plain"]["layer"] == 0, _by["plain"]["layer"])
check("a real layer survives", _by["two"]["layer"] == 2, _by["two"]["layer"])
check("too high is clamped to 4", _by["high"]["layer"] == 4, _by["high"]["layer"])
check("negative is clamped to 0", _by["neg"]["layer"] == 0, _by["neg"]["layer"])
check("unreadable falls back to 0", _by["junk"]["layer"] == 0, _by["junk"]["layer"])
check("a numeric string is accepted", _by["text"]["layer"] == 4, _by["text"]["layer"])

# ------------------------------------------- 1. a rule listens in its own layer only (a)
t, em = engine([btn("l2", "media_next", layer=2)])
check("a capsule starts on layer 1", t.layer == 1, t.layer)
press(t)
check("a layer-2 rule is silent on layer 1", em.taps == [], str(em.taps))
release(t)

t.set_layer(2)
check("set_layer moves the capsule", t.layer == 2, t.layer)
press(t)
check("...and the same rule now fires", em.taps == ["media_next"], str(em.taps))

# ------------------------------------------------- 2. layer 0 fires in every layer (b)
t, em = engine([btn("always", "media_play_pause", layer=0)])
for lay in (1, 2, 3, 4):
    t.set_layer(lay)
    press(t)
    release(t)
check("a Zawsze rule fires in all four layers", len(em.taps) == 4, str(em.taps))

# ------------------------------------------------------ 3. an action switches the layer (c)
t, em = engine([btn("go2", "layer:2")])
press(t)
check("the action layer:2 switches the capsule", t.layer == 2, t.layer)
check("...and nothing was pressed on the machine", em.seen() == [], str(em.seen()))

# it also works with no emitter at all (--no-keys / simulation)
t, _ = engine([btn("go3", "layer:3")], emitter=False)
press(t)
check("a layer switch works with no emitter (--no-keys)", t.layer == 3, t.layer)

# ...and with the Mapping group switched off: the way OUT of a layer must not die with the group
t, em = engine([btn("go4", "layer:4")])
t.set_enabled(False)
press(t)
check("a layer switch works with the Mapping group off", t.layer == 4, t.layer)

# --------------------------------------------- 4. layer:next cycles what exists (d)
t, em = engine([btn("nx", "layer:next"), btn("only3", "a", layer=3)])
press(t)
check("layer:next goes to the only layer that has rules", t.layer == 3, t.layer)
release(t)
press(t)
check("...and wraps back to layer 1", t.layer == 1, t.layer)
release(t)

t, em = engine([btn("nx", "layer:next"), btn("two", "a", layer=2), btn("four", "b", layer=4)])
seen = []
for _ in range(4):
    press(t)
    seen.append(t.layer)
    release(t)
check("layer:next walks 1 -> 2 -> 4 -> 1 and skips the empty layer 3",
      seen == [2, 4, 1, 2], str(seen))

t, em = engine([btn("nx", "layer:next"), btn("home", "a", layer=1)])
press(t)
check("with only layer 1 in use, layer:next does nothing", t.layer == 1, t.layer)

t, em = engine([btn("nx", "layer:next"), btn("home", "a", layer=0)])
press(t)
check("with only Zawsze rules, layer:next does nothing", t.layer == 1, t.layer)

# ------------------------------------------------------------- 5. the shift key (e)
t, em = engine([btn("sh", "layer:hold:2", behavior="hold")])
check("layer:hold is holdable", rf.spec_is_holdable("layer:hold:2"))
check("a plain layer switch is NOT holdable", not rf.spec_is_holdable("layer:2"))
press(t)
check("holding the shift moves to its layer", t.layer == 2, t.layer)
for _ in range(20):        # the button stays 'held' for holdMs — this must not oscillate
    t.tick()
check("...and keeping it held stays there", t.layer == 2, t.layer)
release(t)
check("letting go comes back", t.layer == 1, t.layer)
check("the shift never reached the machine", em.seen() == [], str(em.seen()))

# a shift pressed from another layer comes back to THAT one, not to 1
t, em = engine([btn("sh", "layer:hold:4", behavior="hold")])
t.set_layer(3)
press(t)
check("the shift works from any layer", t.layer == 4, t.layer)
release(t)
check("...and returns where it was pressed from", t.layer == 3, t.layer)

# a shift that lives in layer 1 must not flip-flop: it is exempt from its own filter
t, em = engine([btn("sh", "layer:hold:2", behavior="hold", layer=1)])
press(t)
check("a shift assigned to layer 1 still switches", t.layer == 2, t.layer)
for _ in range(30):
    t.tick()
check("...and does not flip-flop while held", t.layer == 2, t.layer)
release(t)
check("...and still lets go", t.layer == 1, t.layer)

# the master switch must not strand a held shift in a foreign layer
t, em = engine([btn("sh", "layer:hold:3", behavior="hold")])
press(t)
check("shift held before disarming", t.layer == 3, t.layer)
t.set_armed(False)
check("disarming releases the held shift too", t.layer == 1, t.layer)
check("...without handing 'layer:hold:3' to the emitter", em.ups == [], str(em.ups))

# ------------------------------- 6. leaving a layer lets go of what it was holding (f)
t, em = engine([btn("walk", "space", behavior="hold", layer=1)])
press(t)
check("a hold rule presses on its own layer", em.downs == ["space"], str(em.downs))
t.set_layer(2)
t.tick()
check("switching layers releases the key it was holding", em.ups == ["space"], str(em.ups))
check("...and the rule reads as not active", not t._rt["walk"]["over"])

# a half-counted multi does not survive the switch either
t, em = engine([btn("dbl", "media_next", behavior="multi", layer=1,
                    crossings=3, windowMs=5000)])
press(t)
release(t)
check("one tap counted", t._rt["dbl"].get("seq_count") == 1, t._rt["dbl"].get("seq_count"))
t.set_layer(2)
t.tick()
check("leaving the layer forgets the half-counted taps",
      not t._rt["dbl"].get("seq_count"), t._rt["dbl"].get("seq_count"))

# a latch does not come back inverted
t, em = engine([btn("mode", "", behavior="latch", layer=1)])
press(t)
check("the switch is on", t._rt["mode"]["over"] is True)
t.set_layer(3)
t.tick()
check("leaving the layer switches it off", t._rt["mode"]["over"] is False)

# ...and a rule gated on an off-layer trigger stops firing
t, em = engine([btn("mode", "", behavior="latch", layer=1),
                {"id": "gated", "source": {"kind": "trigger", "ref": "mode"},
                 "behavior": "once", "keySpec": "media_next", "layer": 0}])
press(t)
check("the gated Zawsze rule fires while the switch is on",
      em.taps == ["media_next"], str(em.taps))
em.taps = []
t.set_layer(2)
t.tick()
t.tick()
check("...and goes quiet once its switch left the active layer", em.taps == [], str(em.taps))

# ---------------------------------------------------- 7. layers in a macro step
t, em = engine([btn("mac", "", sequence="layer:3; media_next")])
t.run_steps("mac", "test", rf.parse_sequence("layer:3; media_next"), send=True)
check("a macro step switches the layer", t.layer == 3, t.layer)
check("...and the rest of the macro still presses keys", em.taps == ["media_next"], str(em.taps))

# ------------------------------------------------------------ 8. the classifier
check("layer: is classified safe", rf._classify_spec("layer:2")[0] == "safe",
      rf._classify_spec("layer:2"))
check("layer:next is classified safe", rf._classify_spec("layer:next")[0] == "safe")
check("layer:hold:4 is classified safe", rf._classify_spec("layer:hold:4")[0] == "safe")
check("a nonsense layer action is risky, not silently dead",
      rf._classify_spec("layer:9")[0] == "risky", rf._classify_spec("layer:9"))
check("layer:hold:0 is risky", rf._classify_spec("layer:hold:0")[0] == "risky")
_d = rf._describe_rule({"source": {"kind": "button", "any": True}, "keySpec": "layer:2"})
check("a layer switch describes itself in Polish", "przełącza na warstwę 2" in _d, _d)
_d = rf._describe_rule({"source": {"kind": "button", "any": True}, "keySpec": "layer:hold:2"})
check("a shift describes itself as held", "póki trzymasz" in _d, _d)
_d = rf._describe_rule({"source": {"kind": "button", "any": True}, "keySpec": "a", "layer": 3})
check("a rule bound to one layer says so", "tylko warstwa 3" in _d, _d)
_d = rf._describe_rule({"source": {"kind": "button", "any": True}, "keySpec": "a"})
check("a Zawsze rule says nothing extra", "warstwa" not in _d, _d)

# --------------------------------------------- 9. old files load on layer 1 (h)
_tmp = tempfile.mkdtemp(prefix="rf-layers-")
_real_settings = rf.SETTINGS_DIR
try:
    rf.SETTINGS_DIR = _tmp
    path = rf._dev_path("d0", "rules")

    def write(obj):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False)

    write([{"id": "old", "keySpec": "a"}])            # the oldest shape: a bare list
    check("a bare-list rules file loads on layer 1", rf.load_rules_layer("d0") == 1,
          rf.load_rules_layer("d0"))
    check("...and its rules come out as Zawsze",
          rf.load_rules("d0")[0]["layer"] == 0, rf.load_rules("d0")[0])

    write({"enabled": True, "rules": [{"id": "old", "keySpec": "a"}]})
    check("an envelope without activeLayer loads on layer 1", rf.load_rules_layer("d0") == 1,
          rf.load_rules_layer("d0"))

    write({"enabled": False, "activeLayer": 3, "rules": []})
    check("a saved layer is read back", rf.load_rules_layer("d0") == 3, rf.load_rules_layer("d0"))
    write({"enabled": True, "activeLayer": 77, "rules": []})
    check("a corrupt saved layer is clamped", rf.load_rules_layer("d0") == 4,
          rf.load_rules_layer("d0"))

    # saving rules without saying anything about layers must not move the capsule
    write({"enabled": True, "activeLayer": 2, "rules": []})
    rf.save_rules([{"id": "x", "keySpec": "a"}], "d0", True)
    check("saving rules alone leaves the layer alone", rf.load_rules_layer("d0") == 2,
          rf.load_rules_layer("d0"))
    rf.save_rules([{"id": "x", "keySpec": "a"}], "d0", True, 4)
    check("...and passing one writes it", rf.load_rules_layer("d0") == 4,
          rf.load_rules_layer("d0"))
    with open(path, "r", encoding="utf-8") as f:
        _env = json.load(f)
    check("the file keeps the Mapping switch next to the layer",
          _env.get("enabled") is True and _env.get("activeLayer") == 4, _env)
finally:
    rf.SETTINGS_DIR = _real_settings
    shutil.rmtree(_tmp, ignore_errors=True)

check("the owner's Settings/ was left alone", rf.SETTINGS_DIR == _real_settings)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
