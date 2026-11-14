# Test of the CURSOR AREA and the POINTING mode of the air mouse. Run: py tests/test_mousearea.py
#
# Three layers, each for its own reason:
#   * pure arithmetic — mouse_area() against a SUBSTITUTED two-monitor layout. Without that the
#     test would only ever describe the machine it happens to run on (one screen here, three on
#     somebody else's desk) and the answer has to be the same on both.
#   * the fence — move_in() against a STUB mouse controller. A real cursor move would prove
#     nothing extra and would land in whatever the person is doing right now (see the project
#     rule about not switching outputs on during tests).
#   * pointing, end to end — AirMouse.tick() with a substituted 3D filter and the same stub:
#     a tilt goes in, a point on the screen comes out. Including the promise the mode rests on:
#     a capsule lying still must NOT re-place the cursor, or the real mouse becomes unusable.
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


# Two monitors: the primary 1920x1080 at (0,0) with a 48 px taskbar, and a 2560x1440 to the right
# shifted UP (negative y — exactly the case where "percent of the desktop" starts lying).
SCR = [
    {"i": 0, "name": r"\\.\DISPLAY1", "primary": True,
     "x": 0, "y": 0, "w": 1920, "h": 1080, "wx": 0, "wy": 0, "ww": 1920, "wh": 1032},
    {"i": 1, "name": r"\\.\DISPLAY2", "primary": False,
     "x": 1920, "y": -200, "w": 2560, "h": 1440, "wx": 1920, "wy": -200, "ww": 2560, "wh": 1440},
]
DESK = (0, -200, 4480, 1640)
MAIN = (0, 0, 1920, 1080)
RIGHT = (1920, -200, 2560, 1440)


def area(cursor=None, **cfg):
    return rf.mouse_area(cfg, cursor=cursor, screens=SCR, desktop=DESK)


print("\n--- which rectangle ---")
check("whole desktop = every monitor together", area(mouseArea="desktop")["rect"] == DESK)
check("no settings at all = whole desktop (behaviour before this feature)", area()["rect"] == DESK)
check("a chosen monitor", area(mouseArea="monitor", mouseMonitor=r"\\.\DISPLAY2")["rect"] == RIGHT)
_fb = area(mouseArea="monitor", mouseMonitor=r"\\.\DISPLAY7")
check("unplugged monitor -> primary, but VISIBLY (fallback)",
      _fb["rect"] == MAIN and _fb["fallback"] is True, _fb)
_np = area(mouseArea="monitor")
check("no monitor named -> primary, and that is not a fallback",
      _np["rect"] == MAIN and _np["fallback"] is False, _np)
check("monitor under the cursor: pointer on the right screen",
      area(cursor=(2500, 300), mouseArea="cursor")["rect"] == RIGHT)
check("monitor under the cursor: pointer on the left screen",
      area(cursor=(100, 100), mouseArea="cursor")["rect"] == MAIN)
check("pointer nowhere (between screens) -> primary",
      area(cursor=(99999, 99999), mouseArea="cursor")["rect"] == MAIN)
check("work area leaves the taskbar alone",
      area(mouseArea="monitor", mouseMonitor=r"\\.\DISPLAY1", mouseAreaWork=True)["rect"]
      == (0, 0, 1920, 1032))
check("margin insets every side",
      area(mouseArea="monitor", mouseMonitor=r"\\.\DISPLAY1", mouseAreaPad=40)["rect"]
      == (40, 40, 1840, 1000))
check("a margin bigger than the screen does not invert the rectangle",
      area(mouseArea="custom", mouseRectX=0, mouseRectY=0, mouseRectW=100, mouseRectH=100,
           mouseAreaPad=500)["rect"][2] >= 8)
check("a rectangle of one's own",
      area(mouseArea="custom", mouseRectX=200, mouseRectY=100, mouseRectW=800, mouseRectH=600)["rect"]
      == (200, 100, 800, 600))
_big = area(mouseArea="custom", mouseRectX=4000, mouseRectY=1000, mouseRectW=9000, mouseRectH=9000)["rect"]
check("a rectangle written on somebody else's desktop is clamped into ours",
      _big[0] + _big[2] <= DESK[0] + DESK[2] and _big[1] + _big[3] <= DESK[1] + DESK[3], _big)
_nr = area(mouseArea="custom")
check("a rectangle nobody ever drew = whole desktop + a visible fallback",
      _nr["rect"] == DESK and _nr["fallback"] is True, _nr)
check("an unknown area kind is the desktop, not an exception",
      rf.mouse_area({"mouseArea": "whatever"}, screens=SCR, desktop=DESK)["rect"] == DESK)
check("unknown desktop size = no fence (None), not a guess",
      rf.mouse_area({"mouseArea": "desktop"}, screens=[], desktop=(0, 0, 0, 0))["rect"] is None)

print("\n--- which monitor is a point on ---")
check("screen_at hits the right one", rf.screen_at(2000, 0, SCR)["name"] == r"\\.\DISPLAY2")
check("screen_at hits the left one", rf.screen_at(10, 10, SCR)["name"] == r"\\.\DISPLAY1")
check("screen_at off the desktop -> primary", rf.screen_at(-9999, -9999, SCR)["primary"] is True)


print("\n--- the fence (KeyEmitter.move_in) ---")


class _StubMouse:
    """Stub pynput controller: records what it was asked to do instead of moving a real cursor."""

    def __init__(self):
        self.moves = []
        self.pos = None

    def move(self, dx, dy):
        self.moves.append((dx, dy))

    @property
    def position(self):
        return self.pos

    @position.setter
    def position(self, p):
        self.pos = p


class _StubEmitter(rf.KeyEmitter):
    def __init__(self):
        import threading
        self._lock = threading.Lock()
        self.stub = _StubMouse()

    def _mouse_ctrl(self):
        return self.stub


em = _StubEmitter()
BOX = (100, 100, 800, 600)          # x, y, w, h -> the bottom-right pixel is (899, 699)
em.stub.moves.clear()
em.move_in(50, 50, BOX, cur=(400, 400))
check("a move inside the area passes through untouched", em.stub.moves == [(50, 50)], em.stub.moves)
em.stub.moves.clear()
em.move_in(9000, 0, BOX, cur=(400, 400))
check("a move past the right edge is cut at the edge", em.stub.moves == [(499, 0)], em.stub.moves)
em.stub.moves.clear()
em.move_in(-9000, -9000, BOX, cur=(400, 400))
check("a move past the top-left corner is cut", em.stub.moves == [(-300, -300)], em.stub.moves)
em.stub.moves.clear()
em.move_in(10, 0, BOX, cur=(899, 400))
check("already at the edge, further out = no move at all (no jitter)", em.stub.moves == [], em.stub.moves)
em.stub.moves.clear()
em.move_in(1, 1, BOX, cur=(5000, 5000))
check("a pointer carried out by hand is pulled back in on the first capsule move",
      em.stub.moves == [(-4101, -4301)], em.stub.moves)
em.stub.moves.clear()
em.move_in(7, 3, None, cur=(400, 400))
check("no area = the move the mouse always made", em.stub.moves == [(7, 3)], em.stub.moves)


print("\n--- pointing (AirMouse.tick, from a tilt to a point) ---")


class _StubB:
    def __init__(self):
        self.mouse = {}
        self.events = []

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)


class _StubTrig:
    armed = True


def _mk(**cfg):
    """An AirMouse with the monitor layout substituted — the real desktop is never touched."""
    m = rf.AirMouse(_StubB(), emitter=em, trig=_StubTrig(), gamepad=None)
    base = {"enabled": True, "mode": "mouse", "mouseSource": "filter", "mouseAbsolute": True,
            "smooth": 0.0, "mouseFilterScale": 30.0, "mouseFilterDead": 0.0,
            "mouseArea": "custom", "mouseRectX": 100, "mouseRectY": 100,
            "mouseRectW": 801, "mouseRectH": 601}       # middle: (500, 400)
    base.update(cfg)
    m.set_config(base)
    return m


_real = (rf.list_screens, rf.screen_bounds, rf.cursor_pos)
rf.list_screens = lambda force=False: [dict(s) for s in SCR]
rf.screen_bounds = lambda: DESK
rf.cursor_pos = lambda: (400, 400)
try:
    am = _mk()
    am.on_pose({"roll": 0.0, "pitch": 0.0, "tilt": 0.0, "twist": 0.0})
    am.on_sample([0, 0, 0, 0, 0, 0])
    em.stub.pos = None
    am.tick()
    check("a capsule held level points at the MIDDLE of the area", em.stub.pos == (500, 400), em.stub.pos)

    am.on_pose({"roll": 30.0, "pitch": -30.0, "tilt": 0.0, "twist": 0.0})
    am.on_sample([0, 0, 0, 0, 0, 1])
    am.tick()
    check("full tilt points at the corner", em.stub.pos == (900, 100), em.stub.pos)

    am.on_pose({"roll": 15.0, "pitch": 0.0, "tilt": 0.0, "twist": 0.0})
    am.on_sample([0, 0, 0, 0, 0, 2])
    am.tick()
    check("half the tilt = half the way to the edge", em.stub.pos == (700, 400), em.stub.pos)

    am.on_pose({"roll": 90.0, "pitch": 0.0, "tilt": 0.0, "twist": 0.0})
    am.on_sample([0, 0, 0, 0, 0, 3])
    am.tick()
    check("tilting past the range does not leave the area", em.stub.pos == (900, 400), em.stub.pos)

    em.stub.pos = None
    am.on_sample([0, 0, 0, 0, 0, 4])          # same pose, new sample
    am.tick()
    check("a still capsule does NOT re-place the cursor (the real mouse keeps working)",
          em.stub.pos is None, em.stub.pos)

    inv = _mk(mouseInvertX=True)
    inv.on_pose({"roll": 30.0, "pitch": 0.0, "tilt": 0.0, "twist": 0.0})
    inv.on_sample([0, 0, 0, 0, 0, 0])
    em.stub.pos = None
    inv.tick()
    check("axis inversion applies to pointing too", em.stub.pos == (100, 400), em.stub.pos)

    dz = _mk(mouseFilterDead=6.0)             # 6 of 30 degrees = the first 20% is silent
    dz.on_pose({"roll": 6.0, "pitch": 0.0, "tilt": 0.0, "twist": 0.0})
    dz.on_sample([0, 0, 0, 0, 0, 0])
    em.stub.pos = None
    dz.tick()
    check("the dead zone holds the cursor in the middle", em.stub.pos == (500, 400), em.stub.pos)

    ax = _mk(mouseSource="axis", mouseAxisX=5, mouseAxisY=4, mouseDeadzone=0.0,
             sensX=0.1, sensY=0.1, maxStep=50)
    ax.on_sample([0, 0, 0, 0, 100, 100])
    em.stub.pos = None
    em.stub.moves.clear()
    ax.tick()
    check("pointing from a raw axis falls back to moving the cursor",
          em.stub.pos is None and em.stub.moves != [], (em.stub.pos, em.stub.moves))

    off = _mk(enabled=False)
    off.on_pose({"roll": 30.0, "pitch": 0.0, "tilt": 0.0, "twist": 0.0})
    off.on_sample([0, 0, 0, 0, 0, 0])
    em.stub.pos = None
    off.tick()
    check("a switched-off group moves nothing but still computes the preview",
          em.stub.pos is None and off._abs[0] > 0.9, (em.stub.pos, off._abs))

    # velocity + the same area: the cursor is PUSHED, and the fence still holds it in.
    # The pointer sits at (880, 400) and the right edge of the area is 900.
    rf.cursor_pos = lambda: (880, 400)
    vel = _mk(mouseAbsolute=False, mouseEdgeFollow=False, maxStep=200)
    vel.on_pose({"roll": 30.0, "pitch": 0.0, "tilt": 0.0, "twist": 0.0})
    vel.on_sample([0, 0, 0, 0, 0, 0])
    em.stub.moves.clear()
    vel.tick()
    check("velocity + area: a 200 px step is cut to the 20 px left to the edge",
          em.stub.moves == [(20, 0)], em.stub.moves)

    # the same capsule with no area configured: nothing gets in the way of the full step
    free = _mk(mouseAbsolute=False, mouseEdgeFollow=False, maxStep=200, mouseArea="desktop")
    free.on_pose({"roll": 30.0, "pitch": 0.0, "tilt": 0.0, "twist": 0.0})
    free.on_sample([0, 0, 0, 0, 0, 0])
    em.stub.moves.clear()
    free.tick()
    check("velocity with no area: the whole step goes through", em.stub.moves == [(200, 0)], em.stub.moves)
finally:
    rf.list_screens, rf.screen_bounds, rf.cursor_pos = _real

print("\n--- config validation ---")
_am = rf.AirMouse(_StubB(), emitter=None, trig=_StubTrig(), gamepad=None)
_am.set_config({"mouseArea": "whatever", "mouseAreaPad": 9999, "mouseRectW": -5})
_c = _am.get_config()
check("a typo'd area kind comes back as the desktop", _c["mouseArea"] == "desktop", _c["mouseArea"])
check("the margin is clamped", _c["mouseAreaPad"] == 500.0, _c["mouseAreaPad"])
check("a negative width is clamped to zero", _c["mouseRectW"] == 0.0, _c["mouseRectW"])
check("pointing is off by default", _am.DEFAULTS["mouseAbsolute"] is False)
check("the area is the whole desktop by default", _am.DEFAULTS["mouseArea"] == "desktop")

print("\n%d PASS / %d FAIL" % (_passed, _failed))
sys.exit(1 if _failed else 0)
