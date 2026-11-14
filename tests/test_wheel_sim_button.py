# Test of the CAPSULE BUTTON IN SIMULATION — the one input the test bench could not produce.
# Run: py tests/test_wheel_sim_button.py
#
# Why this file exists. The koło wyboru is worked with a button: four of its five modes wait for a
# press (held past holdMs, or tapped shorter than it), and the fifth watches a lean. In simulation
# there is no thumb, so the capsule's button comes from the dashboard — you drive the sphere by
# hand and press a button on screen. The report was that the wheel and the simulation did
# not get along, and the interesting part of the answer is where the seam actually is:
#
#   * THE PACKET PATH IS ALREADY RIGHT and must stay right. The hand-driven feeder writes the
#     button EXACTLY as hardware does — the level in byte 1 on EVERY 50 Hz frame, plus a 0x21
#     packet on the edge — so nothing downstream can tell a hand from a thumb. If anybody ever
#     "simplifies" that into a side call straight to the engine, `hold` rules and the wheel would
#     start behaving differently here than on a capsule, silently. That is what this file pins.
#   * A LEVEL THAT NOBODY REFRESHES IS NOT A PRESS. RadialMenu asks TriggerEngine.button_hold_state()
#     — held AND fresh — so the per-frame level is not decoration, it is the whole feature.
#   * A TAP MUST NEVER READ AS A HOLD. The dashboard's "Kliknij" button presses for VP_TAP_MS; the
#     lowest holdMs anybody may configure is RadialMenu.HOLD_MIN. Those two numbers live in two
#     languages and would drift apart on the first tidy-up, so the gap is asserted here.
#
# Nothing here touches anybody's desktop: no emitter, no Settings/ read or written, no BLE. Test A
# runs the real feeder for a third of a second of wall time (it IS a 50 Hz loop, and faking that
# clock would fake the thing under test); everything else is instant.
import collections
import os
import sys
import threading
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


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read(*parts):
    with open(os.path.join(ROOT, *parts), "r", encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------------------------------------
#  A — THE FEEDER. A hand on the sphere produces the SAME stream a capsule does.
# ---------------------------------------------------------------------------------------------
class _StubB:
    def __init__(self):
        self.events = []
        self.status = {}

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)

    def set_status(self, **kw):
        self.status.update(kw)

    def set_device(self, **kw):
        pass


class _StubPipe:
    """Swallows the IMU frames. This file is about the BUTTON; the motion has its own tests."""

    def __init__(self):
        self.n = 0

    def handle(self, sample, raw=None):
        self.n += 1


class _RecTrig:
    """Records what the feeder says about the button, and how often."""

    def __init__(self):
        self.levels = []      # every on_button_level(), in order
        self.status = []      # every 0x21 packet, as bytes

    def on_button_level(self, flag):
        self.levels.append(int(flag) & 0xFF)

    def on_status(self, pkt):
        self.status.append(bytes(pkt))


def _feeder():
    """A PuckSource wired to stubs, without building a Device (no BLE, no Settings, no emitter)."""
    src = rf.PuckSource.__new__(rf.PuckSource)
    src.pipeline = _StubPipe()
    src.b = _StubB()
    src.name = "Triki-TEST"
    src.trig = _RecTrig()
    src._stop = False
    src.bytes_total = 0
    src.pkt_imu = 0
    src.pkt_status = 0
    src._last_motion_t = _real_time.monotonic()
    src._stats_t = _real_time.monotonic()
    src._stats_imu = 0
    src._stats_bytes = 0
    src._virt_on = False
    src._virt_lock = threading.Lock()
    src._virt_q = (1.0, 0.0, 0.0, 0.0)
    src._virt_tgt = {"btn": False}
    src._virt_seen = 0.0
    src._cmd_queue = collections.deque()   # PuckSource.__init__ sets it; the sim loop drains it every frame
    src._auto_pause_release = lambda: None
    src._auto_pause_check = lambda now: None
    src._maybe_stats = lambda: None
    return src


_S = _feeder()
_S.set_virtual({"on": True, "pitch": 0.0, "roll": 0.0})
_real_time.sleep(0.10)                       # let the 50 Hz loop settle at rest
_before = len(_S.trig.levels)
_S.set_virtual({"on": True, "btn": True})    # …thumb down
_real_time.sleep(0.16)
_held = _S.trig.levels[_before + 1:]         # skip the frame straddling the change
_press_pkts = list(_S.trig.status)
_S.set_virtual({"on": True, "btn": False})   # …and up
_real_time.sleep(0.12)
_after = _S.trig.levels[-3:]
_all_pkts = list(_S.trig.status)
_S.set_virtual({"on": False})
_real_time.sleep(0.08)

check("the button is reported on EVERY frame, not only when it changes",
      len(_held) >= 5, "%d frames in 160 ms" % len(_held))
check("…and every one of those frames says HELD",
      _held and all(v == 0x01 for v in _held), sorted(set(_held)))
check("letting go is on the level too", _after and all(v == 0x00 for v in _after), _after)
check("a press also sends a 0x21 packet, on the edge",
      any(p[:2] == b"\x21\x01" for p in _press_pkts), [p.hex() for p in _press_pkts[-3:]])
check("…and so does letting go",
      any(p[:2] == b"\x21\x00" for p in _all_pkts[len(_press_pkts):] or _all_pkts),
      [p.hex() for p in _all_pkts[-3:]])
# BYTES 2-4 STAY ZERO. A rule bound to "any button activity" fires on ANY bit in bytes 1..4, so a
# battery level or a counter parked there would make every such rule permanently true — and only
# in simulation, which is the worst place for a difference to live.
check("the packet is byte-for-byte the hardware shape (21 <btn> 00 00 00)",
      all(len(p) == 5 and p[0] == 0x21 and p[2:] == b"\x00\x00\x00" for p in _all_pkts),
      [p.hex() for p in _all_pkts[:3]])
check("the packets are not a substitute for the level — both travel",
      len(_S.trig.levels) > len(_all_pkts) * 3,
      "%d levels vs %d packets" % (len(_S.trig.levels), len(_all_pkts)))

# A KEEPALIVE MUST NOT DROP THE PRESS. A dashboard in a background tab only says "still here" every
# few seconds, and that word carries no `btn`. If an absent field meant "let go", every wheel gesture
# would end the moment the user looked at another window.
_K = _feeder()
_K.set_virtual({"on": True, "btn": True})
_real_time.sleep(0.06)
_K.set_virtual({"on": True})                 # keepalive: pose only, no `btn`
check("a keepalive without `btn` leaves the press alone", _K.virtual_state()["btn"] is True,
      _K.virtual_state())
_K.set_virtual({"on": False})
_real_time.sleep(0.06)


# ---------------------------------------------------------------------------------------------
#  B — THE SEAM. That level, through a REAL TriggerEngine, is enough to work the wheel.
# ---------------------------------------------------------------------------------------------
# test_wheel.py drives the engine through a stub that answers button_hold_state() directly. Here the
# answer is computed by the real TriggerEngine from the real per-frame level, which is the piece the
# simulation actually feeds — and the piece that would break if the feeder ever stopped repeating it.
class _Clock:
    def __init__(self, t0=5000.0):
        self.t = t0

    def monotonic(self):
        return self.t

    def advance(self, sec):
        self.t += sec

    def __getattr__(self, name):
        return getattr(_real_time, name)


CLK = _Clock()
rf.time = CLK

SL4 = [{"label": "Góra", "spec": "", "sequence": "wait 10"},
       {"label": "Prawo", "spec": "", "sequence": "wait 10"},
       {"label": "Dół", "spec": "", "sequence": "wait 10"},
       {"label": "Lewo", "spec": "", "sequence": "wait 10"}]


class _RecEmitter:
    def __init__(self):
        self.taps = []

    def tap(self, spec):
        self.taps.append(spec)
        return True


def _rig(**cfg):
    """A real TriggerEngine + a real RadialMenu, fed the way the simulation feeds them."""
    tr = rf.TriggerEngine(_StubB(), emitter=None, armed=True)
    w = rf.RadialMenu(_StubB(), emitter=_RecEmitter(), trig=tr)
    base = {"enabled": True, "holdMs": 300.0, "confirmMs": 600.0,
            "slices": [dict(s) for s in SL4]}
    base.update(cfg)
    w.set_config(base)
    fired = []
    tr._launch_sequence = lambda r, seq, gate=None: fired.append(r.get("id"))
    # UZBROJENIE PROGU (2026-08-27). Silnik startuje rozbrojony: kapsel, który ani razu nie
    # powiedział „stoję prosto", nie ma prawa otworzyć koła zastanym pochyleniem. Ręka, która za
    # chwilę wykona gest, jest właśnie w środku — więc symulacja też tam zaczyna. Patrz
    # RadialMenu._lean_home i sekcja „próg uzbrojenia" w tests/test_wheel.py.
    for _ in range(6):
        CLK.advance(0.02)
        w.on_pose(dict(CENTRE))
        tr.on_button_level(0x00)
        w.tick()
    return w, tr, fired


def _lean(roll, pitch):
    return {"tilt": (roll * roll + pitch * pitch) ** 0.5, "twist": 0.0,
            "pitch": float(pitch), "roll": float(roll)}


UP = _lean(0, -28)          # slice 0 sits at 12 o'clock (screen convention: +y is down)
CENTRE = _lean(0, 0)


def _drive(w, tr, ms, btn, pose, dt=0.02):
    """Exactly what PuckSource._run_virtual does per frame: refresh the pose, refresh the button
    LEVEL, let the engine tick. No shortcuts — that is the whole point of this test."""
    for _ in range(max(1, int(round((ms / 1000.0) / dt)))):
        CLK.advance(dt)
        w.on_pose(dict(pose))
        tr.on_button_level(0x01 if btn else 0x00)
        w.tick()


# release — hold, lean, let go
_w, _tr, _fired = _rig(confirm="release")
_drive(_w, _tr, 400, True, UP)
check("release: the simulated hold opens the wheel", _w.open, _w.open)
check("…aimed where the hand leans", _w.idx == 0, _w.idx)
_drive(_w, _tr, 60, False, UP)
check("release: letting go sends the slice", _fired == ["wheel:0"], _fired)

# tilt-hold — no button at all
_w, _tr, _fired = _rig(confirm="tilt-hold")
_drive(_w, _tr, 300, False, UP)
check("tilt-hold: a big lean opens it with the button up", _w.open, _w.open)
_drive(_w, _tr, 700, False, UP)
check("tilt-hold: waiting it out sends the slice", _fired == ["wheel:0"], _fired)

# tilt-click — lean opens, a TAP decides
_w, _tr, _fired = _rig(confirm="tilt-click")
_drive(_w, _tr, 300, False, UP)
check("tilt-click: the lean opens it", _w.open, _w.open)
_drive(_w, _tr, 80, True, UP)      # a VP_TAP_MS-length press
_drive(_w, _tr, 60, False, UP)
check("tilt-click: an 80 ms tap decides", _fired == ["wheel:0"], _fired)

# click — a tap opens, the lean points, a tap decides
_w, _tr, _fired = _rig(confirm="click")
_drive(_w, _tr, 80, True, CENTRE)
_drive(_w, _tr, 60, False, CENTRE)
check("click: a tap opens the wheel", _w.open, _w.open)
_drive(_w, _tr, 200, False, UP)
_drive(_w, _tr, 80, True, UP)
_drive(_w, _tr, 60, False, UP)
check("click: a second tap sends what the lean points at", _fired == ["wheel:0"], _fired)

# cycle — a tap WAKES, taps step, waiting sends. The lean means nothing here at all.
_w, _tr, _fired = _rig(confirm="cycle", confirmMs=900.0)
_drive(_w, _tr, 300, False, _lean(0, 28))
check("cycle: the wheel is standing there, leaning changed nothing", _w.open, _w.open)
_drive(_w, _tr, 80, True, CENTRE)
_drive(_w, _tr, 60, False, CENTRE)
check("cycle: the first tap wakes it without choosing", _w.idx == -1, _w.idx)
_drive(_w, _tr, 80, True, CENTRE)
_drive(_w, _tr, 60, False, CENTRE)
check("cycle: a tap steps the choice", _w.idx == 0, _w.idx)
_drive(_w, _tr, 80, True, CENTRE)
_drive(_w, _tr, 60, False, CENTRE)
check("…and another tap steps it again", _w.idx == 1, _w.idx)
_drive(_w, _tr, 1000, False, CENTRE)
check("cycle: waiting sends the slice the taps landed on", _fired == ["wheel:1"], _fired)

# THE CAPSULE THAT WENT QUIET. Manual control ends (tab closed, watchdog, "Koniec") while the button
# is down: the level stops being refreshed and the wheel must CANCEL rather than commit, exactly as
# it does when a real capsule walks out of Bluetooth range.
_w, _tr, _fired = _rig(confirm="release")
_drive(_w, _tr, 400, True, UP)
check("release: open before the hand lets go of the app", _w.open, _w.open)
for _ in range(40):                      # 0.8 s of nobody saying anything (max_age is 0.6 s)
    CLK.advance(0.02)
    _w.on_pose(dict(UP))
    _w.tick()
check("a stream that stopped is not a release — the wheel closes", not _w.open, _w.open)
check("…and nothing was sent", _fired == [], _fired)

rf.time = _real_time


# ---------------------------------------------------------------------------------------------
#  C — THE DASHBOARD'S HALF OF THE CONTRACT.
# ---------------------------------------------------------------------------------------------
# The button a person actually presses lives in the browser, so the two ends have to agree about it.
# Read as text, the same way test_wheel.py checks that the drawing mirrors the engine's limits.
_HTML = _read("web", "ribbitflip_dashboard.html")
_VP = _read("web", "js", "rf-14b-virtualpuck.js")
_I18N = _read("web", "js", "rf-01-i18n.js")

check("manual control offers a HOLD button", 'id="poseVBtn"' in _HTML)
check("…and it says out loud that it is held (aria-pressed)",
      'id="poseVBtn"' in _HTML and 'aria-pressed' in _HTML.split('id="poseVBtn"')[1][:200])
check("manual control offers a TAP button", 'id="poseVTap"' in _HTML)
check("…wired to the same button path", "vpTap(" in _VP and "poseVTap" in _VP)

# THE NUMBER THAT MATTERS. A tap is only a tap if it is shorter than the shortest holdMs anybody can
# configure — otherwise the "Kliknij" button would quietly open the wheel instead of deciding in it.
_tap_ms = None
for _line in _VP.splitlines():
    if _line.strip().startswith("const VP_TAP_MS"):
        _tap_ms = float(_line.split("=")[1].split(";")[0])
        break
check("the dashboard declares how long a tap is (VP_TAP_MS)", _tap_ms is not None, _tap_ms)
check("…and a tap can never be read as a hold (VP_TAP_MS < RadialMenu.HOLD_MIN)",
      _tap_ms is not None and _tap_ms < rf.RadialMenu.HOLD_MIN,
      "%s vs %s" % (_tap_ms, rf.RadialMenu.HOLD_MIN))
# …and long enough that the 50 Hz feeder cannot miss it between two frames.
check("…and long enough for the 50 Hz stream to see it (at least 3 frames)",
      _tap_ms is not None and _tap_ms >= 60.0, _tap_ms)

# THE HOLD SURVIVES A SHAKY HAND. `pointerleave` used to end the press, so drifting three pixels off
# the button let go of the capsule mid-gesture — on a gesture that lasts half a second.
_wire = _VP.split('getElementById("poseVBtn")')[-1][:1200]
check("the hold is kept with pointer capture, not by hovering",
      "setPointerCapture" in _wire, _wire[:120])
check("…so leaving the button no longer lets go",
      "pointerleave" not in _wire, "pointerleave still wired to the capsule button")

for _pl in ("Kliknij", "Przycisk kapsla"):
    check("the new label has English (%s)" % _pl, ('"%s":' % _pl) in _I18N, _pl)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
