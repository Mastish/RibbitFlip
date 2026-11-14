# Test of CONTROLLER BUTTONS as a mapping action (`pad:a`). Run: py tests/test_padout.py
#
# Two halves, and only the first one always runs:
#   * pure logic — name normalisation, spec routing, the import-safety verdict and the
#     "what does this setup need" answer. No pad, no driver, no side effects.
#   * the real thing — creates a virtual XInput pad, presses a button and reads the state
#     back through XInputGetState, i.e. through the same API a game uses. Skipped (not
#     failed) without vgamepad or the ViGEmBus driver, because that is a machine fact and
#     not a bug in this code.
#
# Reading the state back matters: everything up to `press_button` can be perfectly correct
# while the button never reaches Windows, and "the code looks right" is exactly the kind of
# proof that let a mapping ship dead once already.
import ctypes
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402

_passed = 0
_failed = 0
_skipped = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + detail) if detail else ""))


def skip(name, why):
    global _skipped
    _skipped += 1
    print("SKIP  %s  (%s)" % (name, why))


# ============================== 1. NAMES ==============================
GE = rf.GamepadEmitter

check("canonical name passes through", GE.pad_name("pad:a") == "a")
check("prefix optional", GE.pad_name("rt") == "rt")
check("case and spacing ignored", GE.pad_name(" PAD: LB ") == "lb")
check("separators ignored", GE.pad_name("pad:dpad_up") == "up" and GE.pad_name("pad:d-pad-up") == "up")
check("PlayStation face buttons", [GE.pad_name("pad:" + n) for n in ("cross", "circle", "square", "triangle")]
      == ["a", "b", "x", "y"])
check("PlayStation shoulders/triggers", [GE.pad_name("pad:" + n) for n in ("l1", "r1", "l2", "r2")]
      == ["lb", "rb", "lt", "rt"])
check("stick clicks", GE.pad_name("pad:l3") == "ls" and GE.pad_name("pad:r3") == "rs")
check("start/back synonyms", GE.pad_name("pad:options") == "start" and GE.pad_name("pad:select") == "back")
check("unknown button rejected", GE.pad_name("pad:turbo") is None)
check("empty rejected", GE.pad_name("") is None and GE.pad_name(None) is None)
check("every listed button has an alias-free name",
      all(GE.pad_name(b) == b for b in GE.PAD_BUTTONS + GE.PAD_TRIGGERS))

# ============================== 2. SPEC ROUTING ==============================
check("spec_is_pad recognises the prefix", rf.spec_is_pad("pad:a") and rf.spec_is_pad(" PAD:RT "))
check("spec_is_pad ignores keys/mouse", not rf.spec_is_pad("ctrl+c") and not rf.spec_is_pad("mouse:left"))
check("pad buttons are holdable", rf.spec_is_holdable("pad:a") and rf.spec_is_holdable("pad:lt"))
check("unknown pad name is NOT holdable", not rf.spec_is_holdable("pad:turbo"),
      "a hold would press something no release could clear")
check("keys stay holdable", rf.spec_is_holdable("w") and not rf.spec_is_holdable("mouse:scrollup"))


class _FakeKeys:
    def __init__(self):
        self.calls = []

    def tap(self, s):
        self.calls.append(("tap", s))

    def down(self, s):
        self.calls.append(("down", s))

    def up(self, s):
        self.calls.append(("up", s))

    def move(self, dx, dy):
        self.calls.append(("move", dx, dy))


class _FakePad:
    def __init__(self):
        self.calls = []

    def tap(self, s):
        self.calls.append(("tap", s))

    def press(self, s):
        self.calls.append(("press", s))

    def release(self, s):
        self.calls.append(("release", s))


keys, pad = _FakeKeys(), _FakePad()
out = rf.SlotOutput(keys, pad)
out.tap("space")
out.down("w")
out.up("w")
out.tap("pad:a")
out.down("pad:rt")
out.up("pad:rt")
out.move(3, 4)
check("keys/mouse go to the key emitter", keys.calls == [("tap", "space"), ("down", "w"), ("up", "w"), ("move", 3, 4)],
      str(keys.calls))
check("pad specs go to the pad", pad.calls == [("tap", "pad:a"), ("press", "pad:rt"), ("release", "pad:rt")],
      str(pad.calls))

# A capsule plugged into NO controller (the tray in the Kontrolery strip): SlotOutput carries
# gp=None and a pad press has to come back as a quiet False. Two ways to get this wrong, and both
# have a test: raising would print a stack trace per press and cost the rule its own exception
# handler, and returning None would be read as "sent" and the dashboard would light the button
# green for a press that went nowhere. The keyboard half must keep working — that is the whole
# point of letting a capsule have no pad.
nokeys = _FakeKeys()
noout = rf.SlotOutput(nokeys, None)
check("no pad: tap answers False", noout.tap("pad:a") is False)
check("no pad: down answers False", noout.down("pad:rt") is False)
check("no pad: up answers False", noout.up("pad:rt") is False)
noout.tap("space")
noout.down("w")
check("no pad: keys still go out", nokeys.calls == [("tap", "space"), ("down", "w")], str(nokeys.calls))
check("no pad: nothing reached a pad", pad.calls == [("tap", "pad:a"), ("press", "pad:rt"), ("release", "pad:rt")],
      "the fake pad was touched by the padless output")
check("padShare 'off' is a value the config keeps", rf.PAD_SHARE_OFF == "off")

# ============================== 3. IMPORT SAFETY ==============================
check("a pad button is safe", rf._classify_spec("pad:a") == ("safe", ""))
check("an analog trigger is safe", rf._classify_spec("pad:rt")[0] == "safe")
check("an unknown pad button is risky", rf._classify_spec("pad:turbo")[0] == "risky")
check("safe mode keeps a pad rule",
      rf._classify_rule({"keySpec": "pad:a"})["level"] == "safe")

# ============================== 4. "WILL IT WORK HERE" ==============================
_caps_none = {"padModule": False, "padDriver": False, "padActive": False, "midiPorts": []}
_req = lambda cfg: {r["key"]: r for r in rf.setup_requirements(cfg, _caps_none)["requires"]}  # noqa: E731

check("a mapping with a pad button asks for the pad",
      _req({"rules": [{"keySpec": "pad:a"}]}).get("pad", {}).get("have") is False)
check("a pad button inside a MACRO asks for it too",
      "pad" in _req({"rules": [{"sequence": "w; wait 100; down pad:rt; wait 50; up pad:rt"}]}),
      "a pad: buried in step three needs the driver as much as a plain one")
check("a keyboard-only setup does not",
      "pad" not in _req({"rules": [{"keySpec": "space"}, {"sequence": "a; wait 50; b"}]}))
check("motion control still asks on its own",
      "pad" in _req({"mouse": {"enabled": True, "mode": "stick", "stickBackend": "gamepad"}}))

# ============================== 5. THE REAL PAD ==============================
# XInput button bits, as the OS reports them. GUIDE (0x0400) is deliberately absent:
# XInputGetState never reports it (only the undocumented ...Ex does), so it cannot be
# verified this way and is not claimed here.
_XI = {"up": 0x0001, "down": 0x0002, "left": 0x0004, "right": 0x0008,
       "start": 0x0010, "back": 0x0020, "ls": 0x0040, "rs": 0x0080,
       "lb": 0x0100, "rb": 0x0200, "a": 0x1000, "b": 0x2000, "x": 0x4000, "y": 0x8000}


class _XGamepad(ctypes.Structure):
    _fields_ = [("wButtons", ctypes.c_ushort), ("bLeftTrigger", ctypes.c_ubyte),
                ("bRightTrigger", ctypes.c_ubyte), ("sThumbLX", ctypes.c_short),
                ("sThumbLY", ctypes.c_short), ("sThumbRX", ctypes.c_short),
                ("sThumbRY", ctypes.c_short)]


class _XState(ctypes.Structure):
    _fields_ = [("dwPacketNumber", ctypes.c_ulong), ("Gamepad", _XGamepad)]


def _xinput():
    for dll in ("XInput1_4.dll", "xinput1_3.dll", "XInput9_1_0.dll"):
        try:
            return ctypes.windll.LoadLibrary(dll)
        except Exception:
            continue
    return None


def _read(xi, idx):
    st = _XState()
    if xi.XInputGetState(idx, ctypes.byref(st)) != 0:
        return None
    return st.Gamepad


def _wait_for(xi, idx, want, timeout=1.0):
    """Poll until want(gamepad) is true. A virtual pad's state is not visible the
    instant update() returns — the driver and XInput are two hops away."""
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        g = _read(xi, idx)
        if g is not None and want(g):
            return True
        time.sleep(0.01)
    return False


def _live_pad_test():
    gp = rf.GamepadEmitter()
    if not gp.importable():
        return skip("live pad", "no vgamepad module")
    if rf.GamepadEmitter.driver_present() is False:
        return skip("live pad", "no ViGEmBus driver")
    xi = _xinput()
    if xi is None:
        return skip("live pad", "no XInput DLL to read the state back with")
    before = {i for i in range(4) if _read(xi, i) is not None}
    try:
        gp.press("pad:a")
    except Exception as e:
        return skip("live pad", "cannot create the pad: %s" % e)
    idx = None
    for i in range(4):
        if i in before:
            continue
        if _wait_for(xi, i, lambda g: g.wButtons & _XI["a"], 2.0):
            idx = i
            break
    if idx is None:
        # A pad exists but we cannot tell WHICH slot is ours (e.g. all four were already
        # taken). Not a failure of the code under test — say so instead of inventing a verdict.
        gp.reset()
        return skip("live pad", "created, but no free XInput slot to read it back from")
    check("held button is visible to XInput", True)
    # …every listed button an Xbox pad HAS. `pad:touchpad` is on the list for the DualShock and
    # the Wii controller and is declared missing here (PAD_ONLY), which is a different thing from
    # being forgotten: pressing it on this device raises rather than doing nothing.
    GE_ = rf.GamepadEmitter
    want = {b for b in GE_.PAD_BUTTONS if GE_.has_button(b, "x360")}
    check("every listed button has an XInput mapping", set(gp._btn) == want,
          "listed but unmapped: %s" % sorted(want - set(gp._btn)))
    gp.release("pad:a")
    check("release clears it", _wait_for(xi, idx, lambda g: not (g.wButtons & _XI["a"])))

    for nm in ("b", "x", "y", "lb", "rb", "start", "back", "ls", "rs", "up", "down", "left", "right"):
        gp.press("pad:" + nm)
        ok = _wait_for(xi, idx, lambda g, m=_XI[nm]: g.wButtons & m)
        gp.release("pad:" + nm)
        check("button %s reaches XInput" % nm, ok)

    gp.press("pad:lt")
    check("LT is a full analog press", _wait_for(xi, idx, lambda g: g.bLeftTrigger > 200))
    gp.release("pad:lt")
    check("LT returns to zero", _wait_for(xi, idx, lambda g: g.bLeftTrigger == 0))
    gp.press("pad:rt")
    check("RT is a full analog press", _wait_for(xi, idx, lambda g: g.bRightTrigger > 200))
    gp.release("pad:rt")

    # A tap has to be VISIBLE (that is the whole reason it is held for TAP_MS) and then gone.
    gp.tap("pad:a")
    check("tap is long enough for a poll to catch it",
          _wait_for(xi, idx, lambda g: g.wButtons & _XI["a"], 0.5),
          "an instant press+release falls between two XInput polls")
    check("tap releases itself",
          _wait_for(xi, idx, lambda g: not (g.wButtons & _XI["a"]), 1.0))

    # A hold that lands inside a previous tap's window must survive it: the tap's timer
    # is not allowed to release a button somebody else is now holding.
    gp.tap("pad:b")
    time.sleep(rf.GamepadEmitter.TAP_MS / 2000.0)
    gp.press("pad:b")
    time.sleep(rf.GamepadEmitter.TAP_MS / 1000.0 + 0.15)
    check("a hold overrides a tap's pending auto-release",
          bool((_read(xi, idx) or _XGamepad()).wButtons & _XI["b"]))
    gp.release("pad:b")

    gp.reset()
    check("reset leaves nothing pressed", _wait_for(xi, idx, lambda g: g.wButtons == 0))


def _no_pad_is_loud():
    """Without a pad a mapping must FAIL, not silently do nothing — the stick can degrade
    to an on-screen preview, a button press has nothing to degrade to."""
    gp = rf.GamepadEmitter()
    gp._imp = False          # pretend vgamepad is not installed
    try:
        gp.press("pad:a")
        check("missing pad raises instead of no-op", False, "press() returned quietly")
    except RuntimeError:
        check("missing pad raises instead of no-op", True)
    except Exception as e:
        check("missing pad raises instead of no-op", False, "wrong exception: %r" % e)
    try:
        gp.tap("pad:turbo")
        check("unknown button raises", False, "tap() accepted a made-up button")
    except ValueError:
        check("unknown button raises", True)
    except Exception as e:
        check("unknown button raises", False, "wrong exception: %r" % e)
    gp.release("pad:a")      # must not raise: nothing was pressed
    check("release of a never-pressed button is harmless", True)


_no_pad_is_loud()
_live_pad_test()

print("\n%d passed, %d failed, %d skipped" % (_passed, _failed, _skipped))
sys.exit(1 if _failed else 0)
