# Test of the TOUCHPAD as an OUTPUT of the motion engine. Run: py tests/test_touchpad.py
#
# The click and the wire format are tested next door (test_padkind.py, test_dsu.py). What is
# tested here is the other half of the feature: a capsule's tilt aiming a FINGER at a place on
# the DualShock's glass, which rides on the analog stick's backend rather than on a fourth motion
# mode of its own.
#
# That decision is the thing worth pinning. A touchpad IS a two-axis absolute surface, so
# everything the stick already has — the 3D filter, the scale in degrees, the dead zone, expo,
# the entry ramp — is exactly what aiming a finger needs, already tuned and already calibrated by
# whoever tuned their stick. Only the MEANING of the final pair of numbers changes:
#
#   * a deflection becomes a place: centre plus half the surface, so full tilt reaches the edge;
#   * the dead zone becomes the moment the finger comes OFF the glass — because a stick springs
#     back to the middle and a finger does not, it lifts. A capsule sitting still would otherwise
#     read as a thumb parked in the centre of the touchpad forever.
#
# Nothing here plugs a controller into anybody's Windows: the pad is a recording stub.
import os
import sys

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


class _StubB:
    def __init__(self):
        self.events = []

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)


class _StubTrig:
    armed = True


class _RecPad:
    """A pad that writes down what it was told, and nothing else."""

    def __init__(self):
        self.touches = []          # (x, y, on)
        self.sticks = []
        self.resets = 0

    def set_touch(self, x, y, on=True):
        self.touches.append((round(x, 4), round(y, 4), bool(on)))

    def set_stick(self, which, x, y):
        self.sticks.append((which, round(x, 4), round(y, 4)))

    def set_dpad(self, *a):
        pass

    def reset(self):
        self.resets += 1

    def importable(self):
        return True

    @property
    def active(self):
        return True


def _mk(pad, **cfg):
    m = rf.AirMouse(_StubB(), emitter=object(), trig=_StubTrig(), gamepad=pad)
    base = {"enabled": True, "mode": "stick", "stickBackend": "touchpad",
            "stickSource": "filter", "stickMetricX": "roll", "stickMetricY": "pitch",
            "stickFilterScale": 45.0, "stickInner": 0.1, "stickOuter": 0.0, "stickExpo": 1.0,
            "stickAccel": 1.0}      # instant ramp: one tick is enough to reach the target
    base.update(cfg)
    m.set_config(base)
    return m


def _settle(m, ticks=8):
    """The stick RAMPS towards its target, so a single tick is a position on the way there.

    A sample has to arrive for the target to be recomputed at all (`new` gates it) — the numbers
    in it are never read on the 3D-filter source, which takes its angles from the pose, but the
    engine will not act on a capsule it has heard nothing from."""
    for _ in range(ticks):
        m.on_sample([0, 0, 0, 0, 0, 0])
        m.tick()


print("--- the config accepts the third backend ---")
m = _mk(_RecPad())
check("`touchpad` survives validation next to gamepad and wsad",
      m.cfg["stickBackend"] == "touchpad")
m2 = _mk(_RecPad(), stickBackend="nonsense")
check("...and anything else still falls back to the analog stick",
      m2.cfg["stickBackend"] == "gamepad")
check("it counts as needing the driver, exactly like the stick does",
      rf._needs_gamepad({"enabled": True, "mode": "stick", "stickBackend": "touchpad"}) is True)
check("...and a capsule driving WSAD keys still does not",
      rf._needs_gamepad({"enabled": True, "mode": "stick", "stickBackend": "wsad"}) is False)


print("\n--- a tilt becomes a place on the glass ---")
pad = _RecPad()
m = _mk(pad)
m.on_pose({"roll": 0.0, "pitch": 0.0, "tilt": 0.0, "twist": 0.0})
_settle(m)
check("a capsule held still leaves the finger OFF the glass, not parked in the middle",
      pad.touches and pad.touches[-1][2] is False, "%r" % (pad.touches[-1:],))

pad.touches.clear()
m.on_pose({"roll": 45.0, "pitch": 0.0, "tilt": 45.0, "twist": 0.0})   # full tilt right
_settle(m)
last = pad.touches[-1]
check("full tilt reaches the right-hand edge, at mid height",
      last[2] is True and last[0] > 0.99 and abs(last[1] - 0.5) < 0.01, "%r" % (last,))

pad.touches.clear()
m.on_pose({"roll": 0.0, "pitch": 45.0, "tilt": 45.0, "twist": 0.0})   # full tilt forward
_settle(m)
last = pad.touches[-1]
check("...and pitch runs DOWN the surface, the way a touchpad's Y grows",
      last[2] is True and last[1] > 0.99 and abs(last[0] - 0.5) < 0.01, "%r" % (last,))

pad.touches.clear()
m.on_pose({"roll": -22.5, "pitch": 0.0, "tilt": 22.5, "twist": 0.0})  # half tilt left
_settle(m)
last = pad.touches[-1]
check("half a tilt is halfway to the edge, not all the way",
      last[2] is True and 0.2 < last[0] < 0.35, "%r" % (last,))

pad.touches.clear()
m.on_pose({"roll": 2.0, "pitch": 1.0, "tilt": 2.0, "twist": 0.0})     # inside the dead zone
_settle(m)
check("inside the dead zone the finger comes off the glass",
      pad.touches[-1][2] is False, "%r" % (pad.touches[-1:],))


print("\n--- it never reaches the pad with the output switched off ---")
pad = _RecPad()
m = _mk(pad, enabled=False)
m.on_pose({"roll": 45.0, "pitch": 0.0, "tilt": 45.0, "twist": 0.0})
_settle(m)
check("a capsule whose group is off touches nothing", pad.touches == [], "%r" % pad.touches)
check("...but the preview still knows where the finger would be",
      m._touch_pt is not None and m._touch_pt[0] > 0.99, "%r" % (m._touch_pt,))
ev = [e for e in m.b.events if e.get("t") == "mouse" and e.get("backend") == "touchpad"]
check("...and says so on the wire, for the drawing", ev and "tp" in ev[-1], "%r" % (ev[-1:],))


print("\n--- switching away lets go ---")
pad = _RecPad()
m = _mk(pad)
m.on_pose({"roll": 45.0, "pitch": 0.0, "tilt": 45.0, "twist": 0.0})
_settle(m)
check("the finger is down to begin with", pad.touches[-1][2] is True)
cfg = dict(m.cfg)
cfg["stickBackend"] = "gamepad"
m.set_config(cfg)
_settle(m)
check("changing the backend releases the outputs (the pad is reset)", pad.resets >= 1)
check("...and the engine forgets where the finger was", m._touch_pt is None)

pad = _RecPad()
m = _mk(pad)
m.on_pose({"roll": 45.0, "pitch": 0.0, "tilt": 45.0, "twist": 0.0})
_settle(m)
cfg = dict(m.cfg)
cfg["enabled"] = False
m.set_config(cfg)
_settle(m)
n_after = len(pad.touches)
_settle(m)
check("switching the group off lifts the finger too", pad.resets >= 1)
check("...and nothing reaches the pad afterwards, however hard the capsule is tilted",
      len(pad.touches) == n_after, "%d new" % (len(pad.touches) - n_after))
# ...but the ENGINE keeps computing, exactly as it does for the cursor and the stick: the drawing
# has to follow a capsule that is being aimed before the group is armed, which is precisely when
# somebody is checking whether a freshly loaded set landed on the right hand.
check("...while the preview still follows the capsule",
      m._touch_pt is not None and m._touch_pt[0] > 0.99, "%r" % (m._touch_pt,))


print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
