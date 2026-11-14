# CZUŁOŚĆ OSOBNO NA KAŻDĄ OŚ drążka analogowego. Uruchom: py tests/test_stick_sens.py
#
# One sensitivity knob for both axes is enough to walk a character around and wrong for AIMING:
# a camera wants to swing left and right fast and to creep up and down, which is the setting every
# shooter has under „sensitivity X / Y". Here it is a multiplier on the DEFLECTION, one per axis,
# applied before the dead zone and before the curve — so „mniej czułe" means what it says: you tilt
# further for the same push, and half the sensitivity tops that axis out at half a stick.
#
# THE THINGS WORTH PINNING, and why each of them is a decision rather than an accident:
#
#   * 1.0 on both axes has to be the OLD behaviour to the bit, or every saved capsule changes the
#     day it is loaded by a build that knows about this setting.
#   * the multiplier goes on the deflection ENTERING _shape_stick, not on the finished (sx, sy).
#     Applied at the end it would be scaled back down THROUGH the anti-deadzone, and a quiet Y axis
#     would land inside the GAME's own centre — the exact silence stickOuter exists to jump over.
#   * 0 is a REACHABLE setting, not a clamped-away accident (deliberately — the slider used to
#     stop at 0.10×). It takes that axis off the stick and leaves the other one alone; the panel
#     says which axis is off under the sliders, which is what the old floor was really guarding.
#   * only the 'gamepad' backend reads it. The touchpad backend reads the same pair of numbers as a
#     PLACE on the glass (halving Y would fence the finger into a band across the middle) and wsad
#     compares it against its own threshold.
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


class _RecKeys:
    """A key emitter that writes down what is held — the wsad backend's whole output."""

    def __init__(self):
        self.held = set()

    def down(self, spec):
        self.held.add(spec)

    def up(self, spec):
        self.held.discard(spec)


class _RecPad:
    """A pad that writes down what it was told, and nothing else."""

    def __init__(self):
        self.sticks = []
        self.touches = []

    def set_stick(self, which, x, y):
        self.sticks.append((which, round(x, 4), round(y, 4)))

    def set_touch(self, x, y, on=True):
        self.touches.append((round(x, 4), round(y, 4), bool(on)))

    def set_dpad(self, *a):
        pass

    def reset(self):
        pass

    def importable(self):
        return True

    @property
    def active(self):
        return True


def _mk(pad=None, keys=None, **cfg):
    m = rf.AirMouse(_StubB(), emitter=keys or object(), trig=_StubTrig(), gamepad=pad or _RecPad())
    base = {"enabled": True, "mode": "stick", "stickBackend": "gamepad",
            "stickSource": "filter", "stickMetricX": "roll", "stickMetricY": "pitch",
            "stickFilterScale": 45.0, "stickInner": 0.1, "stickOuter": 0.0, "stickExpo": 1.0,
            "stickAccel": 1.0}      # instant ramp: one tick is enough to reach the target
    base.update(cfg)
    m.set_config(base)
    return m


def _settle(m, ticks=8):
    """The stick RAMPS towards its target, so one tick is a position on the way there. A sample has
    to arrive for the target to be recomputed at all (`new` gates it) — its numbers are never read
    on the 3D-filter source, but the engine will not act on a capsule it has heard nothing from."""
    for _ in range(ticks):
        m.on_sample([0, 0, 0, 0, 0, 0])
        m.tick()


def _aim(m, roll=0.0, pitch=0.0):
    m.on_pose({"roll": roll, "pitch": pitch, "tilt": max(abs(roll), abs(pitch)), "twist": 0.0})
    _settle(m)
    return m._stick          # (sx, sy), screen convention: sy > 0 = down


print("--- the setting exists, defaults to neutral and reaches all the way down to 0 ---")
m = _mk()
check("both axes default to 1.0 — a capsule that never heard of this setting keeps its feel",
      m.cfg["stickSensX"] == 1.0 and m.cfg["stickSensY"] == 1.0,
      (m.cfg["stickSensX"], m.cfg["stickSensY"]))
m = _mk(stickSensX=0.0, stickSensY=99.0)
check("0 is kept (an axis may be switched off) and the top is still clamped to 3",
      m.cfg["stickSensX"] == 0.0 and m.cfg["stickSensY"] == 3.0,
      (m.cfg["stickSensX"], m.cfg["stickSensY"]))
m = _mk(stickSensX=-2.0)
check("...below zero there is nothing to mean — a negative is clamped, not mirrored",
      m.cfg["stickSensX"] == 0.0, m.cfg["stickSensX"])


print("\n--- 1.0 on both axes is the old behaviour, to the bit ---")
cfg = dict(_mk().cfg)
old = {k: v for k, v in cfg.items() if k not in ("stickSensX", "stickSensY")}
m = rf.AirMouse(_StubB(), emitter=object(), trig=_StubTrig(), gamepad=_RecPad())
m.set_config(old)                                  # a config written before the setting existed
before = m._calc_stick(4000.0, -2000.0, m.cfg)
m2 = _mk(stickSensX=1.0, stickSensY=1.0)
after = m2._calc_stick(4000.0, -2000.0, m2.cfg)
check("a config with no stickSens* keys shapes exactly like one with 1.0/1.0",
      before == after, (before, after))


print("\n--- less on one axis: tilt further, and the axis stops short of full ---")
full_y = _aim(_mk(), pitch=45.0)[1]                # neutral reference: full tilt forward
half_y = _aim(_mk(stickSensY=0.5), pitch=45.0)[1]
check("half the sensitivity is roughly half the push at full tilt",
      abs(half_y - full_y * 0.5) < 0.06, (full_y, half_y))
check("...and the axis genuinely cannot reach the rim any more",
      half_y < 0.6, half_y)
sx, sy = _aim(_mk(stickSensY=0.5), roll=45.0)
check("the OTHER axis is untouched — this is per-axis, not a quieter stick",
      abs(sx - full_y) < 1e-9 and abs(sy) < 1e-9, (sx, sy))

# The point of the whole feature, said as one number: a diagonal comes out flatter than it went in.
sx, sy = _aim(_mk(stickSensY=0.4), roll=45.0, pitch=45.0)
check("a 45° diagonal leaves with Y at ~40% of X — fast sideways, gentle up and down",
      sx > 0.5 and abs(sy / sx - 0.4) < 0.02, (sx, sy))


print("\n--- 0 on one axis: that axis leaves the stick, the other one is untouched ---")
# The whole point of allowing 0: an aiming stick that only turns sideways. The axis has to go
# COMPLETELY quiet (not „almost", which is what the old 0.1 floor gave) and it may not drag the
# other one down with it — the direction is taken from the pair, so a bug here would show up as
# a sideways push that also shrank.
full_x = _aim(_mk(), roll=45.0)[0]
sx, sy = _aim(_mk(stickSensY=0.0), roll=45.0, pitch=45.0)
check("Y at 0 is silent even at full tilt forward", abs(sy) < 1e-9, sy)
check("...and X still reaches exactly as far as it did on its own",
      abs(sx - full_x) < 1e-9, (sx, full_x))
sx, sy = _aim(_mk(stickSensX=0.0), roll=45.0, pitch=45.0)
check("the same the other way round: X off, the vertical push intact",
      abs(sx) < 1e-9 and abs(sy - full_x) < 1e-9, (sx, sy))
pad = _RecPad()
m = _mk(pad, stickSensX=0.0, stickSensY=0.0)
m.on_pose({"roll": 45.0, "pitch": 45.0, "tilt": 45.0, "twist": 0.0})
_settle(m)
check("both axes at 0 park the stick at rest instead of dividing by a zero magnitude",
      pad.sticks and pad.sticks[-1][1] == 0.0 and pad.sticks[-1][2] == 0.0,
      "%r" % (pad.sticks[-1:],))


print("\n--- more on one axis: full deflection arrives sooner ---")
sx, _ = _aim(_mk(), roll=22.5)                     # half tilt, neutral sensitivity
check("half a tilt is about half a stick at 1.0", 0.4 < sx < 0.55, sx)
sx2, _ = _aim(_mk(stickSensX=2.0), roll=22.5)
check("...and doubling the sensitivity reaches the rim at that same half tilt",
      sx2 > 0.99, sx2)


print("\n--- it is the ANALOG STICK's setting, and nobody else's ---")
pad = _RecPad()
m = _mk(pad, stickBackend="touchpad", stickSensY=0.1)
m.on_pose({"roll": 0.0, "pitch": 45.0, "tilt": 45.0, "twist": 0.0})
_settle(m)
last = pad.touches[-1]
check("a finger on the glass still reaches the bottom edge — a place is not a push",
      last[2] is True and last[1] > 0.99, "%r" % (last,))

keys = _RecKeys()
m = _mk(keys=keys, stickBackend="wsad", stickSensY=0.1, stickWsadThr=0.5)
_aim(m, pitch=45.0)
check("WSAD still holds S at full tilt — it has a threshold of its own",
      keys.held == {"s"}, "%r" % (keys.held,))

# ...and the mouse is a different engine path entirely (sensX/sensY, px per sample). Pinned here
# because „ma to wpływać tylko na ruch analoga" was the request, and a cursor quietly slowed down
# by a stick setting is exactly the failure this line would catch.
m = _mk(mode="mouse", stickSensX=0.1, stickSensY=0.1)
check("the cursor's own sensitivity is left alone",
      abs(m.cfg["sensX"] - rf.AirMouse.DEFAULTS["sensX"]) < 1e-9
      and abs(m.cfg["sensY"] - rf.AirMouse.DEFAULTS["sensY"]) < 1e-9,
      (m.cfg["sensX"], m.cfg["sensY"]))


print("\n--- what actually reaches the controller ---")
pad = _RecPad()
m = _mk(pad, stickSensY=0.5)
m.on_pose({"roll": 45.0, "pitch": 45.0, "tilt": 45.0, "twist": 0.0})
_settle(m)
which, gx, gy = pad.sticks[-1]
check("the pad is pushed on the left stick, sideways further than up",
      which == "left" and gx > 0.5 and abs(gy) < gx * 0.6, "%r" % (pad.sticks[-1],))
check("...and up is still up (XInput flips the screen's Y)", gy < 0.0, gy)


print("\n--- the setting travels with the capsule ---")
m = _mk(stickSensX=1.5, stickSensY=0.6)
ev = [e for e in m.b.events if e.get("t") == "mouse_cfg"]
check("it goes out on `mouse_cfg`, so the panel and the preset both see it",
      ev and abs(ev[-1].get("stickSensX", 0) - 1.5) < 1e-9
      and abs(ev[-1].get("stickSensY", 0) - 0.6) < 1e-9,
      "%r" % ({k: v for k, v in (ev[-1:] or [{}])[0].items() if "Sens" in k},))


print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
