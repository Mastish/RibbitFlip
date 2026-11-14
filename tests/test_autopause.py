# Test of AUTO-WSTRZYMANIE PRZY BEZCZYNNOSCI (auto-pause on stillness). Run: py tests/test_autopause.py
#
# The feature: a capsule left lying still stops driving anything, and the first movement gives it
# back. Written for the moment you put the capsule down mid-task — the cursor must not keep
# drifting, and you must not have to click anything either before or after.
#
# Four things are worth pinning down here, and "the outputs got cut" is only the first of them:
#
#   * THE TWO HOLDS ARE INDEPENDENT. `paused` belongs to the person, `auto_paused` to the capsule.
#     Movement lifting the automatic one must NOT un-hold a capsule somebody parked by hand, or
#     the emergency "stop this thing" would quietly undo itself the moment the desk was bumped.
#   * COMING BACK IS IMMEDIATE. The release sits in the packet parser, not in the 0.4 s session
#     poll, so it happens in the packet that carries the movement.
#   * A FRESH CONNECTION IS NOT IDLE. The countdown starts at connection (and at the moment the
#     feature is switched on), never at the epoch — otherwise a capsule out of a drawer would
#     arrive already held, which reads exactly like "the app is broken".
#   * SWITCHING IT OFF LETS GO. Leaving the flag up would strand a capsule with its outputs cut
#     and the one switch that explains why now reading "off".
#
# Nothing here touches the desktop or the Settings folder: the engines are stubs, and the clock is
# ours, so a 60 s stillness costs no wall time at all.
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
# PuckSource reads time.monotonic() directly, and a test that actually WAITED would spend minutes
# asleep through countdowns whose length it already knows. Same shim as tests/test_dwell.py: the
# module's `time` answers monotonic() from a number we move by hand and delegates everything else
# to the real module. Nothing outside ribbitflip_monitor sees it, and no thread of the app runs.
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
    """The bus. Records what was published so the idempotence check can count devmeta events."""

    def __init__(self):
        self.events = []
        self.power = {}

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)

    def devmeta_count(self):
        return sum(1 for e in self.events if e.get("t") == "devmeta")


class _StubTrig:
    """Just enough TriggerEngine for apply_arm(): a flag that remembers being set."""

    def __init__(self):
        self.armed = True
        self.set_calls = 0

    def set_armed(self, on):
        self.armed = bool(on)
        self.set_calls += 1


class _StubMidiMap:
    def __init__(self):
        self.parked = 0

    def emit_safe_values(self):
        self.parked += 1


class _FakeDevice:
    """A Device with only the parts _effective / apply_arm / _publish_meta actually read.

    Deliberately NOT the real Device: constructing one starts BLE, pads, audio and four threads,
    and none of that has an opinion about this feature."""

    def __init__(self, dev_id="d0"):
        self.id = dev_id
        self.slot = 0
        self.name = "Triki 1"
        self.color = "#8aa0b5"
        self.label = ""
        self.cap = ""
        self.muted = False
        self.paused = False
        self.auto_paused = False
        self.bound_addr = None
        self.trig = _StubTrig()
        self.midimap = _StubMidiMap()
        self.source = None
        self.dm = None

    # Copied in behaviour from the real Device.meta_dict, which is what the panel reads.
    def meta_dict(self):
        return {"dev": self.id, "slot": self.slot, "name": self.name, "color": self.color,
                "label": self.label, "cap": self.cap, "muted": self.muted,
                "paused": self.paused, "autoPaused": bool(self.auto_paused),
                "bound": bool(self.bound_addr)}


class _FakeDM:
    """The real DeviceManager methods under test, bound to one fake slot.

    _effective / apply_arm / set_paused / set_auto_paused are borrowed from the class itself rather
    than reimplemented — a copy of the OR would pass this suite while the app kept the old rule."""

    def __init__(self, dev, bus):
        self.devices = {dev.id: dev}
        self.order = [dev.id]
        self.b = bus
        self.master_armed = True
        self.simulate = True

    def get(self, dev_id):
        return self.devices.get(dev_id)

    def all(self):
        return [self.devices[i] for i in self.order if i in self.devices]

    _effective = rf.DeviceManager._effective
    apply_arm = rf.DeviceManager.apply_arm
    _publish_meta = rf.DeviceManager._publish_meta
    set_paused = rf.DeviceManager.set_paused
    set_auto_paused = rf.DeviceManager.set_auto_paused


class _StubPipeline:
    def handle(self, sample, raw=None):
        pass


def make_rig(auto_pause=True, secs=60):
    """A source wired to a fake slot, exactly the way Device.__init__ wires the real one."""
    bus = _StubB()
    dev = _FakeDevice()
    dm = _FakeDM(dev, bus)
    dev.dm = dm
    src = rf.PuckSource(_StubPipeline(), bus, name="Triki")
    dev.source = src
    src.device = dev
    src.set_power({"autoPause": auto_pause, "autoPauseSec": secs})
    return bus, dev, dm, src


# =============================================================================================
#  (a) set_power validates and clamps
# =============================================================================================
_bus, _dev, _dm, src = make_rig(auto_pause=False)
check("autoPause defaults to off",
      src.power["autoPause"] is False, src.power)
check("autoPauseSec defaults to 60 s",
      src.power["autoPauseSec"] == 60, src.power)

src.set_power({"autoPauseSec": 45})
check("a sane delay is taken as an int",
      src.power["autoPauseSec"] == 45 and isinstance(src.power["autoPauseSec"], int), src.power)
src.set_power({"autoPauseSec": 1})
check("a delay below the floor clamps to 5 s", src.power["autoPauseSec"] == 5, src.power)
src.set_power({"autoPauseSec": 99999})
check("a delay above the ceiling clamps to 3600 s", src.power["autoPauseSec"] == 3600, src.power)
src.set_power({"autoPauseSec": "kwiatek"})
check("a delay that is not a number is ignored, not crashed on",
      src.power["autoPauseSec"] == 3600, src.power)
src.set_power({"autoPauseSec": None})
check("None is ignored too", src.power["autoPauseSec"] == 3600, src.power)
src.set_power({"autoPause": "tak"})
check("autoPause takes whatever it is given as a boolean",
      src.power["autoPause"] is True, src.power)
# The neighbouring keys must survive: set_power is one endpoint for the whole panel, and the
# dashboard posts every field at once.
src.set_power({"autoSleep": True, "idleMin": 7, "autoPause": True, "autoPauseSec": 30})
check("the sleep settings still round-trip alongside the new ones",
      src.power["autoSleep"] is True and src.power["idleMin"] == 7.0
      and src.power["autoPauseSec"] == 30, src.power)


# =============================================================================================
#  (b) stillness past the threshold cuts the outputs
# =============================================================================================
bus, dev, dm, src = make_rig(secs=60)
check("b: a fresh slot is armed", dm._effective(dev) is True and dev.trig.armed is True)

CLK.advance(59.0)
src._auto_pause_check(CLK.monotonic())
check("b: one second short of the threshold changes nothing",
      dev.auto_paused is False and dm._effective(dev) is True)

CLK.advance(1.5)
src._auto_pause_check(CLK.monotonic())
check("b: past the threshold the capsule holds itself",
      dev.auto_paused is True, dev.auto_paused)
check("b: ...and _effective() says nothing may leave",
      dm._effective(dev) is False and dev.trig.armed is False)
check("b: ...and the panel was told, with the reason",
      bus.events[-1].get("t") == "devmeta" and bus.events[-1].get("autoPaused") is True,
      bus.events[-1])
check("b: ...while the MANUAL hold was never touched", dev.paused is False)
# OSC receivers get parked on the way down, exactly as they do for a hand-set hold — a servo left
# wherever the last packet put it is worse than one told to go home.
check("b: OSC targets were parked on the way down", dev.midimap.parked == 1, dev.midimap.parked)

# With the feature off, the same stillness must do nothing at all.
bus2, dev2, dm2, src2 = make_rig(auto_pause=False, secs=60)
CLK.advance(600.0)
src2._auto_pause_check(CLK.monotonic())
check("b: with the feature off, stillness is not a hold",
      dev2.auto_paused is False and dm2._effective(dev2) is True)


# =============================================================================================
#  (c) movement gives it back at once
# =============================================================================================
bus, dev, dm, src = make_rig(secs=10)
CLK.advance(11.0)
src._auto_pause_check(CLK.monotonic())
check("c: held after 11 s of stillness", dev.auto_paused is True)

_before = bus.devmeta_count()
src._last_motion_t = CLK.monotonic()      # what the parser does when a packet carries movement
src._auto_pause_release()
check("c: the first movement lifts the hold", dev.auto_paused is False)
check("c: ...and the outputs are live again",
      dm._effective(dev) is True and dev.trig.armed is True)
check("c: ...and the panel heard about it",
      bus.devmeta_count() == _before + 1, (bus.devmeta_count(), _before))

# ...and the same movement while nothing is held costs nothing but the test.
_before = bus.devmeta_count()
src._auto_pause_release()
check("c: releasing an unheld capsule publishes nothing",
      bus.devmeta_count() == _before, bus.devmeta_count())


# =============================================================================================
#  (d) the manual hold is untouched, in both directions
# =============================================================================================
bus, dev, dm, src = make_rig(secs=10)
dm.set_paused(dev.id, True)
check("d: the hand-set hold cuts the outputs",
      dev.paused is True and dm._effective(dev) is False)

CLK.advance(20.0)
src._auto_pause_check(CLK.monotonic())
check("d: a held capsule can still go idle-held as well",
      dev.auto_paused is True and dev.paused is True)

src._last_motion_t = CLK.monotonic()
src._auto_pause_release()
check("d: movement lifts ONLY the automatic hold",
      dev.auto_paused is False and dev.paused is True, (dev.auto_paused, dev.paused))
check("d: ...so a capsule parked by hand stays parked",
      dm._effective(dev) is False and dev.trig.armed is False)

# The other direction: an idle hold must not survive as an invisible second lock once the person
# has explicitly asked for the capsule back.
bus, dev, dm, src = make_rig(secs=10)
CLK.advance(20.0)
src._auto_pause_check(CLK.monotonic())
dm.set_paused(dev.id, True)               # hand-hold a capsule that is already idle-held
check("d: both holds can be up at once", dev.paused is True and dev.auto_paused is True)


# =============================================================================================
#  (e) resuming by hand clears the idle hold too
# =============================================================================================
dm.set_paused(dev.id, False)
check("e: resuming by hand lifts BOTH holds",
      dev.paused is False and dev.auto_paused is False, (dev.paused, dev.auto_paused))
check("e: ...so the capsule really is working again",
      dm._effective(dev) is True and dev.trig.armed is True)
# ...and the countdown starts again from the click, not from the last movement — otherwise the
# capsule would be re-held on the very next poll and the button would look broken.
src._auto_pause_check(CLK.monotonic())
check("e: ...and it is not re-held on the next poll",
      dev.auto_paused is False, dev.auto_paused)
CLK.advance(20.0)
src._auto_pause_check(CLK.monotonic())
check("e: ...but putting it down again still holds it", dev.auto_paused is True)


# =============================================================================================
#  (f) switching the feature off lets go
# =============================================================================================
bus, dev, dm, src = make_rig(secs=10)
CLK.advance(20.0)
src._auto_pause_check(CLK.monotonic())
check("f: held before we start", dev.auto_paused is True)

src.set_power({"autoPause": False})
check("f: switching the feature off releases the capsule at once",
      dev.auto_paused is False, dev.auto_paused)
check("f: ...and the outputs are live again", dm._effective(dev) is True)
CLK.advance(600.0)
src._auto_pause_check(CLK.monotonic())
check("f: ...and stay live, however long it lies there", dev.auto_paused is False)


# =============================================================================================
#  (g) a fresh start / a freshly enabled feature is not "already idle"
# =============================================================================================
# The clock has been running for the whole suite, so a source that counted from the epoch would be
# thousands of seconds idle the moment it was built. That is the bug this guards.
bus, dev, dm, src = make_rig(secs=60)
src._auto_pause_check(CLK.monotonic())
check("g: a capsule that has just connected is not held",
      dev.auto_paused is False, CLK.monotonic() - src._last_motion_t)

# Switching the feature ON next to a capsule that has been lying still since lunch must not cut it
# in the same breath: the countdown starts at the click.
bus, dev, dm, src = make_rig(auto_pause=False, secs=60)
CLK.advance(3600.0)
src.set_power({"autoPause": True})
src._auto_pause_check(CLK.monotonic())
check("g: switching the feature on does not hold the capsule instantly",
      dev.auto_paused is False, CLK.monotonic() - src._last_motion_t)
CLK.advance(61.0)
src._auto_pause_check(CLK.monotonic())
check("g: ...it holds one full delay later", dev.auto_paused is True)


# =============================================================================================
#  (h) the setters are idempotent
# =============================================================================================
# The check runs on the session's 0.4 s poll and the release runs per packet (~50/s). A setter that
# published on every call would stream devmeta at the panel for as long as the capsule lay still.
bus, dev, dm, src = make_rig(secs=10)
CLK.advance(20.0)
src._auto_pause_check(CLK.monotonic())
_after_first = bus.devmeta_count()
_arm_calls = dev.trig.set_calls
for _ in range(50):
    src._auto_pause_check(CLK.monotonic())
check("h: repeating the check while already held publishes nothing more",
      bus.devmeta_count() == _after_first, (bus.devmeta_count(), _after_first))
check("h: ...and does not re-arm the engines either",
      dev.trig.set_calls == _arm_calls, (dev.trig.set_calls, _arm_calls))

_before = bus.devmeta_count()
check("h: set_auto_paused with the value it already has returns None",
      dm.set_auto_paused(dev.id, True) is None)
check("h: ...and publishes nothing", bus.devmeta_count() == _before)
check("h: set_auto_paused on an unknown slot is a no-op, not a crash",
      dm.set_auto_paused("d99", True) is None)

_before = bus.devmeta_count()
for _ in range(50):
    src._auto_pause_release()
    src._auto_pause_release()
check("h: repeated releases after the first publish nothing",
      bus.devmeta_count() == _before + 1, (bus.devmeta_count(), _before))


# =============================================================================================
#  (i) a source with no slot behind it must not explode
# =============================================================================================
# PuckSource.set_power runs in Device.__init__ BEFORE `source.device` is assigned, so every one of
# these paths is genuinely reached with no device attached.
lone = rf.PuckSource(_StubPipeline(), _StubB(), name="Triki")
lone.set_power({"autoPause": True, "autoPauseSec": 5})
CLK.advance(60.0)
try:
    lone._auto_pause_check(CLK.monotonic())
    lone._auto_pause_release()
    lone._set_auto_paused(True)
    _ok = True
except Exception as e:                      # noqa: BLE001 — the point is that nothing escapes
    _ok = False
    print("   -> %r" % (e,))
check("i: a source with no slot attached is a no-op, not a crash", _ok)


# =============================================================================================
#  (j) meta_dict carries the flag to the panel
# =============================================================================================
bus, dev, dm, src = make_rig(secs=10)
check("j: meta_dict reports the idle hold off",
      dev.meta_dict().get("autoPaused") is False, dev.meta_dict())
CLK.advance(20.0)
src._auto_pause_check(CLK.monotonic())
check("j: meta_dict reports the idle hold on",
      dev.meta_dict().get("autoPaused") is True, dev.meta_dict())
check("j: ...and keeps it apart from the hand-set one",
      dev.meta_dict().get("paused") is False, dev.meta_dict())


print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
