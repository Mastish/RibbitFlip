# Contract test: the capsule button as a STATE, so "hold" can mean hold.
# Run: py tests/test_button_hold.py
#
# The button does not travel in a packet of its own on the units we have: it is byte 1 of every IMU
# frame, and the reader turns it into a 0x21 status packet ONLY WHEN IT CHANGES. Everything
# downstream therefore saw one event per press, and `holdMs` decided how long "held" lasted — 120 ms
# for a set built for jumping. That is right for a jump and wrong for a brake: the rule fires, the
# lamp blinks, the pad button lets go a tenth of a second later and the game stops braking while the
# thumb is still down. Nothing about it looks broken, which is what made it worth a test.
#
# What is checked: a unit that reports the level holds for as long as the button is down, a unit
# that does not keeps the old timeout reading, holdMs stays the FLOOR either way (the pad is polled,
# so a 20 ms tap has to be stretched or the game reads the state after it is over), a level that
# goes stale releases, and the whole thing end to end through the trigger engine — down once at the
# press, up at the release, with a stubbed emitter so nothing reaches a real controller.
#
# The Egging On set is checked here too, because it is the set this bug was found in: the brake is
# only a brake if the spec is a real controller button and the capsule holding it drives the pad the
# other one shares.
import io
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


class Bus:
    def __init__(self):
        self.events = []

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)


class Out:
    """Stands in for SlotOutput: records, presses nothing (no pad is ever created)."""

    def __init__(self):
        self.log = []

    def tap(self, spec):
        self.log.append(("tap", spec))

    def down(self, spec):
        self.log.append(("down", spec))

    def up(self, spec):
        self.log.append(("up", spec))


BTN = {"kind": "button", "any": True, "byte": 1, "bit": 0, "holdMs": 120}


def engine(emitter=None):
    e = rf.TriggerEngine(Bus(), emitter=emitter, armed=True)
    e.enabled = True
    return e


def over(e, src=None):
    return e._cond_over(src or BTN, False, ">", 0)[0]


def press(e, flag=0x01):
    """What the BLE reader does with a press: the level, then the change packet."""
    e.on_button_level(flag)
    e.on_status(bytes([0x21, flag, 0x00, 0x00, 0x00]))


# --- 1. a unit that says nothing about the level: the old reading, unchanged -----------------
e = engine()
e.on_status(bytes([0x21, 0x01, 0x00, 0x00, 0x00]))       # pulse only, no on_button_level
check("a pulse alone still reads as pressed", over(e))
e._btn_any_ts -= 0.3                                      # 300 ms later, holdMs = 120
check("...and lets go after holdMs", not over(e))

# --- 2. a unit that reports the level: held is held ------------------------------------------
e = engine()
press(e)
check("the press reads as pressed", over(e))
e._btn_any_ts -= 5.0                                      # long past any holdMs
e.on_button_level(0x01)                                   # ...but the thumb is still down
check("still pressed five seconds later, because the button is still down", over(e))
e.on_button_level(0x00)
e.on_status(bytes([0x21, 0x00, 0x00, 0x00, 0x00]))        # the release packet carries no bits
check("released the moment the button is released", not over(e))

# --- 3. holdMs is the FLOOR, not the ceiling: a 20 ms tap must survive a polled pad ----------
e = engine()
press(e)
e.on_button_level(0x00)                                   # let go almost immediately
check("a tap shorter than holdMs still reads as pressed", over(e))
e._btn_any_ts -= 0.3
check("...and expires on holdMs like before", not over(e))

# --- 4. a capsule that drops out mid-press must not leave the brake standing on --------------
e = engine()
press(e)
e._btn_any_ts -= 5.0
e._btn_lvl_ts -= 5.0                                      # no frames for five seconds = gone
check("a stale level does not hold the button down", not over(e))

# --- 5. a rule bound to a specific bit ------------------------------------------------------
e = engine()
e.on_button_level(0x01)
e.on_status(bytes([0x21, 0x01, 0x00, 0x00, 0x00]))
b1 = {"kind": "button", "any": False, "byte": 1, "bit": 0, "holdMs": 120}
b2 = {"kind": "button", "any": False, "byte": 2, "bit": 0, "holdMs": 120}
e._btn_high[(1, 0)] = e._btn_high.get((1, 0), 0) - 5.0    # past the timeout
check("byte 1 bit 0 follows the level", over(e, b1))
check("a bit in another byte keeps the pulse reading", not over(e, b2))

# --- 6. end to end: behaviour "hold" through the trigger engine ------------------------------
out = Out()
e = engine(out)
e.set_rules([{"id": "brake", "label": "Hamowanie", "enabled": True, "source": dict(BTN),
              "abs": False, "cmp": ">", "threshold": 0, "behavior": "hold",
              "keySpec": "pad:ls", "extraConditions": []}])
e.tick()
check("nothing is pressed before the button is", out.log == [], str(out.log))
press(e)
e.tick()
check("the pad button goes down on the press", out.log == [("down", "pad:ls")], str(out.log))
e._btn_any_ts -= 5.0
e.on_button_level(0x01)
e.tick()
e.tick()
check("and stays down while the thumb is down", out.log == [("down", "pad:ls")], str(out.log))
e.on_button_level(0x00)
e.on_status(bytes([0x21, 0x00, 0x00, 0x00, 0x00]))
e.tick()
check("and comes up on the release",
      out.log == [("down", "pad:ls"), ("up", "pad:ls")], str(out.log))

# --- 7. the same, from the other side: a unit WITHOUT the level ------------------------------
# This is the behaviour the Egging On jump has always had and still has: a 120 ms stab of RT.
out = Out()
e = engine(out)
e.set_rules([{"id": "jump", "enabled": True, "source": dict(BTN), "abs": False, "cmp": ">",
              "threshold": 0, "behavior": "hold", "keySpec": "pad:rt", "extraConditions": []}])
e.on_status(bytes([0x21, 0x01, 0x00, 0x00, 0x00]))
e.tick()
e._btn_any_ts -= 0.3
e.tick()
check("a pulse-only unit still gets press and release",
      out.log == [("down", "pad:rt"), ("up", "pad:rt")], str(out.log))

# --- 8. the Egging On set: what the two buttons actually do ----------------------------------
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# The copy in `dist/Library/Setups/` is OPTIONAL and the one in `examples/` is not. The library
# next to the .exe belongs to whoever runs the app: it is empty in a fresh clone and empty again
# after somebody clears it, so demanding a file there would fail this test on every machine but
# one. The set that carries the contract is the tracked example; the library copy is checked too
# when it happens to be there, because the two drifting apart is worth catching.
paths = [(os.path.join(ROOT, "examples", "egging-on-2-kapsle.bundle.json"), True),
         (os.path.join(ROOT, "dist", "Library", "Setups", "Egging On (2 kapsle).json"), False)]
for p, wymagany in paths:
    if not os.path.exists(p):
        if wymagany:
            check("set present: %s" % os.path.basename(p), False, p)
        continue
    b = json.load(io.open(p, encoding="utf-8"))
    devs = {d.get("slot"): d for d in b.get("devices", [])}
    tag = os.path.basename(os.path.dirname(p))
    d0 = devs.get("d0", {}).get("setup", {})
    d1 = devs.get("d1", {}).get("setup", {})
    specs0 = [r.get("keySpec") for r in d0.get("rules", [])]
    specs1 = [r.get("keySpec") for r in d1.get("rules", [])]
    check("[%s] the rolling capsule brakes with the left stick click" % tag,
          specs0 == ["pad:ls"], str(specs0))
    check("[%s] the other one jumps on the right trigger" % tag,
          specs1 == ["pad:rt"], str(specs1))
    check("[%s] both specs are buttons this pad has" % tag,
          rf.GamepadEmitter.pad_name("pad:ls") == "ls"
          and rf.GamepadEmitter.pad_name("pad:rt") == "rt")
    check("[%s] both rules hold rather than tap" % tag,
          all(r.get("behavior") == "hold" for r in d0.get("rules", []) + d1.get("rules", [])))
    # The set asks for Mapping on BOTH capsules now. It cannot switch it on (no set can), but a
    # set whose file says "off" would not even be reported as a switch the reader has to flip.
    check("[%s] the set declares Mapping on both capsules" % tag,
          d0.get("trigEnabled") is True and d1.get("trigEnabled") is True,
          "%s / %s" % (d0.get("trigEnabled"), d1.get("trigEnabled")))
    check("[%s] the brake capsule owns the pad, the jump capsule shares it" % tag,
          d0.get("mouse", {}).get("padShare") == "own"
          and d1.get("mouse", {}).get("padShare") == "d0",
          "%s / %s" % (d0.get("mouse", {}).get("padShare"), d1.get("mouse", {}).get("padShare")))
    # Both buttons land on ONE controller: the brake is pressed by the capsule that owns the pad,
    # the jump by the one pointing at it. If that ever came apart, the game would read a brake on
    # one controller and a jump on another and obey neither reliably.
    check("[%s] the set still says which game it is for" % tag,
          str(b.get("forApp", "")).lower().startswith("egging on"), repr(b.get("forApp")))

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
