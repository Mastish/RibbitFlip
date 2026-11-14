# Test of KLIK BEZ KLIKANIA (dwell-click). Run: py tests/test_dwell.py
#
# The feature: a cursor steered by a capsule that STOPS MOVING is the click. Written first as an
# accessibility aid — steering a pointer and pressing a button are two different abilities, and
# this removes the second one from the list of things you need — and useful with both hands busy.
#
# Three things are worth pinning down here, and none of them is "a click happened":
#
#   * ONE click per stop. After firing, the countdown stays disarmed until the cursor leaves the
#     calm radius. A pointer parked over a button must not press it every dwellMs forever.
#   * A HAND TREMOR IS NOT MOVEMENT. The displacement from the anchor is summed as a VECTOR, so a
#     pixel one way and a pixel back cancel, while a genuine drift adds up and re-anchors. Summing
#     path length instead would make every shaky hand fail to click, which is the exact user this
#     was written for.
#   * NOTHING LEAVES WHEN THE GROUP IS OFF. The click goes out through the ordinary emitter behind
#     the same `live` gate as every other output, and the countdown does not even start without it.
#
# Nothing here clicks anybody's desktop: the emitter is a recording stub, and the clock is ours,
# so a 900 ms stop costs no wall time at all.
import math
import os
import sys
import time as _real_time

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


# --- the clock -------------------------------------------------------------------------------
# AirMouse.tick() reads time.monotonic() directly, and a dwell test that actually WAITED would
# spend a minute of wall time sleeping through countdowns it already knows the length of. The
# module's `time` is swapped for a shim that answers monotonic() from a number we move by hand and
# delegates everything else to the real module — nothing outside ribbitflip_monitor sees it, and
# no thread of the app is running here.
class _Clock:
    def __init__(self, t0=1000.0):
        self.t = t0

    def monotonic(self):
        return self.t

    def advance(self, sec):
        self.t += sec

    def __getattr__(self, name):        # sleep / time / perf_counter / ... stay real
        return getattr(_real_time, name)


CLK = _Clock()
rf.time = CLK


class _StubB:
    def __init__(self):
        self.events = []

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)


class _StubTrig:
    armed = True


class _RecEmitter:
    """Writes down what it was asked to send. A real click would prove nothing extra and would
    land on whatever window the person running the tests is using."""

    def __init__(self):
        self.taps = []
        self.moves = []

    def tap(self, spec):
        self.taps.append(spec)

    def move(self, dx, dy):
        self.moves.append((dx, dy))

    def move_in(self, dx, dy, area):
        self.moves.append((dx, dy))

    def move_to(self, x, y):
        self.moves.append(("to", x, y))

    def scroll(self, dx, dy):
        pass


ZERO = [0, 0, 0, 0, 0, 0]


def _mk(**cfg):
    """A mouse-mode capsule with dwell on, velocity from a raw axis (the simplest path with a
    predictable px-per-sample answer). Returns (engine, emitter)."""
    em = _RecEmitter()
    m = rf.AirMouse(_StubB(), emitter=em, trig=_StubTrig(), gamepad=None)
    base = {"enabled": True, "mode": "mouse", "mouseSource": "axis",
            "mouseAxisX": 5, "mouseAxisY": 4, "mouseDeadzone": 35.0,
            "smooth": 0.0, "sensX": 0.035, "sensY": 0.035, "maxStep": 35,
            "mouseArea": "desktop", "mouseAreaPad": 0.0,
            "dwellOn": True, "dwellMs": 900.0, "dwellRadius": 12.0, "dwellClick": "left"}
    base.update(cfg)
    m.set_config(base)
    return m, em


def _run(m, ms, sample=None, pose=None, dt=0.008):
    """Drive the engine for `ms` of (fake) time. A sample has to arrive for the mouse branch to
    recompute at all, and the 3D filter drops a pose older than 0.6 s — so both are refreshed
    every tick, exactly as a connected capsule would."""
    n = max(1, int(round((ms / 1000.0) / dt)))
    for _ in range(n):
        CLK.advance(dt)
        if pose is not None:
            m.on_pose(dict(pose))
        m.on_sample(list(sample if sample is not None else ZERO))
        m.tick()


# =================================================================== a. sanitize ===============
print("--- the settings are sanitised (a typo must not reach the emitter) ---")
m, _ = _mk(dwellMs=10, dwellRadius=0.4, dwellClick="pad:a")
check("a countdown shorter than the minimum is raised to it", m.cfg["dwellMs"] == 150.0, m.cfg["dwellMs"])
check("a radius under the minimum is raised to it", m.cfg["dwellRadius"] == 2.0, m.cfg["dwellRadius"])
check("an unknown click falls back to the left button", m.cfg["dwellClick"] == "left", m.cfg["dwellClick"])
m, _ = _mk(dwellMs=99999, dwellRadius=9999)
check("a countdown past the ceiling is cut to it", m.cfg["dwellMs"] == 5000.0, m.cfg["dwellMs"])
check("a radius past the ceiling is cut to it", m.cfg["dwellRadius"] == 200.0, m.cfg["dwellRadius"])
m, _ = _mk()
m.set_config({"dwellNonsense": 7})
check("a key nobody declared is dropped, not stored", "dwellNonsense" not in m.cfg, sorted(m.cfg)[:4])
check("the default is OFF — nothing starts clicking for anybody by surprise",
      rf.AirMouse.DEFAULTS["dwellOn"] is False)
check("every offered click is a token `mouse:` already understands",
      all(c in rf._MOUSE_AT_ACTIONS for c in rf.AirMouse._DWELL_CLICKS), rf.AirMouse._DWELL_CLICKS)

# ========================================================= b. velocity: one click per stop =====
print("\n--- Prędkość: standing still clicks, once ---")
m, em = _mk()
_run(m, 1200)
check("a still cursor clicks after the countdown", em.taps == ["mouse:left"], em.taps)
_run(m, 2000)
check("...and standing still longer does NOT click again", em.taps == ["mouse:left"], em.taps)

# a real move: 2000 LSB on the X channel is far past the dead zone and saturates maxStep (35 px)
MOVE = [0, 0, 0, 0, 0, 2000]
_run(m, 40, sample=MOVE)
check("moving the cursor really does move it", len(em.moves) > 0, em.moves[:3])
check("...and moving out of the radius arms the next click", m._dwell_armed is True)
_run(m, 1200)
check("after moving away, a new stop clicks again",
      em.taps == ["mouse:left", "mouse:left"], em.taps)

# ================================================================ c. a hand tremor is not a move
print("\n--- a tremor inside the radius does not reset the countdown ---")
m, em = _mk(mouseDeadzone=0.0)
JIT_A = [0, 0, 0, 0, 0, 30]     # ~1 px one way ...
JIT_B = [0, 0, 0, 0, 0, -30]    # ... and ~1 px back
for _ in range(75):             # 150 ticks = 1.2 s of shaking in place
    _run(m, 8, sample=JIT_A)
    _run(m, 8, sample=JIT_B)
check("a shaking hand still clicks — the displacement cancels", em.taps == ["mouse:left"], em.taps)
check("...and the cursor never wandered out of the calm radius",
      abs(m._dwell_off[0]) <= 2 and abs(m._dwell_off[1]) <= 2, m._dwell_off)

# a steady drift in ONE direction is the opposite case and must count as movement
m, em = _mk(mouseDeadzone=0.0)
_run(m, 1200, sample=JIT_A)     # ~1 px per tick, always the same way = 150 px of travel
check("a steady one-way creep is movement, so nothing clicks", em.taps == [], em.taps)

# ============================================================= d. pointing (absolute) ==========
print("\n--- Położenie (wskazywanie): the same rule, measured from the aimed-at point ---")
_real_area = rf.mouse_area
rf.mouse_area = lambda cfg, cursor=None: {"rect": (0, 0, 1001, 1001), "screen": None, "fallback": False}
try:
    m, em = _mk(mouseSource="filter", mouseAbsolute=True, mouseFilterScale=30.0,
                mouseFilterDead=0.0, mouseExpo=1.0, mouseArea="custom",
                mouseRectX=0, mouseRectY=0, mouseRectW=1001, mouseRectH=1001)
    LEVEL = {"roll": 0.0, "pitch": 0.0, "tilt": 0.0, "twist": 0.0}
    _run(m, 1200, pose=LEVEL)
    check("a capsule held still on a point clicks it", em.taps == ["mouse:left"], em.taps)
    check("...aiming at the middle of the area, which is where it was pointing",
          m._abs_pt == (500, 500), m._abs_pt)
    _run(m, 2000, pose=LEVEL)
    check("...and holding it there does not click again", em.taps == ["mouse:left"], em.taps)
    # 3 degrees of 30 = a tenth of the area = 50 px: well past a 12 px radius
    AIMED = {"roll": 3.0, "pitch": 0.0, "tilt": 3.0, "twist": 0.0}
    _run(m, 40, pose=AIMED)
    check("aiming somewhere else counts as movement", m._dwell_armed is True, m._dwell_anchor_dist)
    _run(m, 1200, pose=AIMED)
    check("...and the new place gets its own click",
          em.taps == ["mouse:left", "mouse:left"], em.taps)
finally:
    rf.mouse_area = _real_area

# ================================================================ e. switched off ==============
print("\n--- switched off, and not live ---")
m, em = _mk(dwellOn=False)
_run(m, 2500)
check("with the feature off, nothing ever clicks", em.taps == [], em.taps)
check("...and no countdown is left running underneath", m._dwell_since == 0.0, m._dwell_since)

# ================================================================ f. group not armed ===========
m, em = _mk(enabled=False)
_run(m, 2500)
check("a capsule whose group is OFF clicks nothing", em.taps == [], em.taps)
check("...and its countdown does not even start", m._dwell_since == 0.0, m._dwell_since)


class _Disarmed:
    armed = False


m, em = _mk()
m.trig = _Disarmed()
_run(m, 2500)
check("paused (master disarmed) clicks nothing either", em.taps == [], em.taps)
check("...and starts no countdown either", m._dwell_since == 0.0, m._dwell_since)

# The emitter is what --no-keys takes away, and the click must simply not happen then.
m2 = rf.AirMouse(_StubB(), emitter=None, trig=_StubTrig(), gamepad=None)
m2.set_config({"enabled": True, "mode": "mouse", "mouseSource": "axis", "dwellOn": True})
_run(m2, 2500)
check("with no emitter at all (--no-keys) the tick survives the countdown", m2._dwell_since == 0.0)

# ================================================================ g. resets ====================
print("\n--- the countdown is thrown away on every release ---")
m, em = _mk()
_run(m, 700)
check("mid-countdown, nothing has clicked yet", em.taps == [], em.taps)
m._release_all_outputs()
check("releasing the outputs disarms the countdown", m._dwell_since == 0.0 and m._dwell_armed is True)
_run(m, 400)
check("...so the old deadline does not fire", em.taps == [], em.taps)
_run(m, 800)
check("...and the click comes a full countdown after the reset", em.taps == ["mouse:left"], em.taps)

# switching Prędkość <-> Położenie changes what "standing still" is measured in
rf.mouse_area = lambda cfg, cursor=None: {"rect": (0, 0, 1001, 1001), "screen": None, "fallback": False}
try:
    m, em = _mk(mouseSource="filter", mouseFilterScale=30.0, mouseFilterDead=0.0,
                mouseArea="custom", mouseRectW=1001, mouseRectH=1001)
    LEVEL = {"roll": 0.0, "pitch": 0.0, "tilt": 0.0, "twist": 0.0}
    _run(m, 700, pose=LEVEL)
    m.set_config({"mouseAbsolute": True})
    _run(m, 400, pose=LEVEL)
    check("switching to pointing throws the half-finished countdown away", em.taps == [], em.taps)
    _run(m, 800, pose=LEVEL)
    check("...and the click comes a full countdown after the switch",
          em.taps == ["mouse:left"], em.taps)
finally:
    rf.mouse_area = _real_area

# leaving mouse mode altogether releases everything, dwell included
m, em = _mk()
_run(m, 700)
m.set_config({"mode": "dpad"})
_run(m, 400)
check("leaving the mouse mode cancels the countdown too",
      em.taps == [] and m._dwell_since == 0.0, (em.taps, m._dwell_since))

# ================================================================ h. which click ===============
print("\n--- the kind of click that is sent ---")
for name in ("left", "right", "middle", "double"):
    m, em = _mk(dwellClick=name)
    _run(m, 1200)
    check("dwellClick=%s sends mouse:%s" % (name, name), em.taps == ["mouse:" + name], em.taps)

# ================================================================ i. telemetry =================
print("\n--- what the panel is told ---")
m, em = _mk()
_run(m, 400)
ev = [e for e in m.b.events if e.get("t") == "mouse"][-1]
check("the live packet says the feature is on", ev.get("dwOn") is True, ev.get("dwOn"))
check("...and how far through the stop we are", 0.2 < float(ev.get("dw") or 0) < 0.8, ev.get("dw"))
_run(m, 900)
ev = [e for e in m.b.events if e.get("t") == "mouse"][-1]
check("after the click the ring goes back to empty", float(ev.get("dw") or 0) == 0.0, ev.get("dw"))
m2, _ = _mk(dwellOn=False)
_run(m2, 200)
ev = [e for e in m2.b.events if e.get("t") == "mouse"][-1]
check("switched off, the packet says so and carries no progress",
      ev.get("dwOn") is False and "dw" not in ev, ev.get("dwOn"))

rf.time = _real_time
print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
