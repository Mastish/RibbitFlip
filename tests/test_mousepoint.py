# Test of a MOUSE ACTION AT A POINT of the screen (`mouse:left@960,540`). Run: py tests/test_mousepoint.py
#
# Three halves, and the last two are deliberately not the obvious ones:
#   * pure logic — parsing the spec, resolving percentages against the desktop, what is holdable,
#     what the import check calls it. No side effects at all.
#   * the press/release bookkeeping — driven through a STUB mouse controller, so the timed press,
#     the token that stops an old timer from cutting a new press short, and the anti-stuck release
#     are proven deterministically. A real click would be proof of nothing extra and would land on
#     whatever window the person is using right now.
#   * the pointer, for real — moves the cursor 2 px and reads it back through GetCursorPos, then
#     puts it back where it was. That is the one thing a stub cannot prove: that the coordinate we
#     compute is the coordinate Windows uses. Skipped (not failed) without pynput or off Windows.
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


def raises(fn, *a):
    try:
        fn(*a)
        return False
    except ValueError:
        return True
    except Exception:
        return False


# ---------------------------------------------------------------- parsing ---
print("\n--- spec parsing ---")
check("plain action unchanged", rf.parse_mouse_action("left") == ("left", None, None))
check("point", rf.parse_mouse_action("left@960,540") == ("left", ("960", "540"), None))
check("point + hold", rf.parse_mouse_action("right@50%,50%:800") == ("right", ("50%", "50%"), 800))
check("'800ms' also accepted", rf.parse_mouse_action("left@1,2:800ms")[2] == 800)
check("hold capped at 10 s", rf.parse_mouse_action("left@1,2:99999")[2] == rf.MOUSE_HOLD_MAX_MS)
check("spaces tolerated", rf.parse_mouse_action(" LEFT @ 960 , 540 ") == ("left", ("960", "540"), None))
check("negative coordinates (monitor to the left)",
      rf.parse_mouse_action("left@-1920,-100")[1] == ("-1920", "-100"))
check("move needs no button", rf.parse_mouse_action("move@0,0")[0] == "move")

print("\n--- spec parsing: what must be refused ---")
check("one coordinate", raises(rf.parse_mouse_action, "left@960"))
check("three coordinates", raises(rf.parse_mouse_action, "left@1,2,3"))
check("text instead of a number", raises(rf.parse_mouse_action, "left@srodek,540"))
check("hold that is not a number", raises(rf.parse_mouse_action, "left@1,2:zaraz"))
check("scroll cannot happen at a point", raises(rf.parse_mouse_action, "scrollup@1,2"))
check("relative nudge cannot happen at a point", raises(rf.parse_mouse_action, "moveup@1,2"))
check("a move has nothing to hold", raises(rf.parse_mouse_action, "move@1,2:500"))
check("percent out of range", raises(rf.parse_mouse_action, "left@900%,50%"))

# ------------------------------------------------------------- resolution ---
print("\n--- resolving a point to pixels ---")
x0, y0, w, h = rf.screen_bounds()
if w and h:
    check("pixels pass through", rf.resolve_screen_point(("100", "200")) == (100, 200))
    mid = rf.resolve_screen_point(("50%", "50%"))
    # ±1 px: a desktop with an odd width has no exact middle pixel, and which way that rounds
    # is not something a rule should depend on.
    check("50%,50% = middle of the desktop",
          abs(mid[0] - (x0 + w / 2)) <= 1 and abs(mid[1] - (y0 + h / 2)) <= 1,
          "got %r, desktop=%r" % (mid, (x0, y0, w, h)))
    check("0%,0% = top-left corner", rf.resolve_screen_point(("0%", "0%")) == (x0, y0))
    far = rf.resolve_screen_point((str(x0 + w + 5000), str(y0 + h + 5000)))
    check("a point past the edge is clamped ONTO the desktop",
          far == (x0 + w - 1, y0 + h - 1), "got %r" % (far,))
else:
    skip("resolving a point", "no desktop metrics (not Windows?)")

# -------------------------------------------------------------- holdable ---
print("\n--- what can be held ---")
check("click at a point is holdable (= drag)", rf.spec_is_holdable("mouse:left@960,540"))
check("a press with its own duration is NOT holdable",
      not rf.spec_is_holdable("mouse:left@960,540:800"))
check("moving the pointer is not holdable", not rf.spec_is_holdable("mouse:move@1,2"))
check("double-click at a point is not holdable", not rf.spec_is_holdable("mouse:double@1,2"))
check("a malformed spec is not holdable", not rf.spec_is_holdable("mouse:left@bzdura"))
check("plain mouse button still holdable", rf.spec_is_holdable("mouse:left"))
check("keyboard untouched", rf.spec_is_holdable("w") and rf.spec_is_holdable("ctrl+c"))

# ---------------------------------------------------------- import safety ---
print("\n--- import safety verdict ---")
lv, why = rf._classify_spec("mouse:left")
check("a plain click stays safe", lv == "safe", why)
lv, why = rf._classify_spec("mouse:left@960,540")
check("a click at a point is risky", lv == "risky", "%s / %s" % (lv, why))
check("…and says why in plain words", "punkcie ekranu" in why, why)
lv, why = rf._classify_spec("mouse:move@960,540")
check("moving the pointer to a point is risky too", lv == "risky", why)
check("…and is described as moving, not clicking", "przenosi kursor" in why, why)
lv, why = rf._classify_spec("mouse:left@bzdura,540")
check("a malformed point is risky, not accepted", lv == "risky", why)

desc = rf._describe_rule({"source": {"kind": "filter", "metric": "tilt"},
                          "keySpec": "mouse:left@960,540:800"})
check("the import preview spells the action out",
      "klik lewym w punkcie 960,540" in desc and "800 ms" in desc, desc)

cls = rf._classify_rule({"keySpec": "mouse:right@50%,50%", "label": "menu"})
check("a rule with a point lands in 'risky' as a whole", cls["level"] == "risky", str(cls))

print("\n--- what a shared set needs ---")
px, pct = rf._rules_screen_points([
    {"keySpec": "mouse:left@960,540"},
    {"keySpec": "mouse:right@50%,50%"},
    {"keySpec": "w"},
    {"keySpec": "", "sequence": "mouse:move@10,10; wait 50; mouse:left"},   # a point inside a macro counts
])
check("pixel points counted", px == 2, "px=%d pct=%d" % (px, pct))
check("percent points counted apart", pct == 1, "px=%d pct=%d" % (px, pct))
check("a set with no points reports none", rf._rules_screen_points([{"keySpec": "space"}]) == (0, 0))

req = rf.setup_requirements({"rules": [{"keySpec": "mouse:left@960,540"}]}, {})
row = [r for r in req["requires"] if r["key"] == "screenpoint"]
check("a pixel point shows up as something to check", row and row[0]["have"] is None, str(req))
req = rf.setup_requirements({"rules": [{"keySpec": "mouse:left@50%,50%"}]}, {})
row = [r for r in req["requires"] if r["key"] == "screenpoint"]
check("percentages only = nothing to check", row and row[0]["have"] is True, str(req))
req = rf.setup_requirements({"rules": [{"keySpec": "space"}]}, {})
check("a set without points says nothing about screens",
      not [r for r in req["requires"] if r["key"] == "screenpoint"], str(req))

# ------------------------------------------------- press/release, stubbed ---
print("\n--- press / release bookkeeping (stub mouse) ---")


class _StubBtn:
    left = "L"
    right = "R"
    middle = "M"


class _StubMouse:
    def __init__(self):
        self.log = []
        self.position = (0, 0)

    def press(self, b):
        self.log.append(("press", b))

    def release(self, b):
        self.log.append(("release", b))

    def click(self, b, n=1):
        self.log.append(("click", b, n))


def stub_emitter():
    """A KeyEmitter with the mouse half replaced — no pynput, no real input."""
    e = rf.KeyEmitter.__new__(rf.KeyEmitter)
    import threading
    e._lock = threading.Lock()
    e._mouse = _StubMouse()
    e._Button = _StubBtn
    e._mdown = set()
    e._mtok = {}
    e._mtimers = {}
    e._mseq = 0
    e._mouse_ctrl = lambda: e._mouse
    return e


e = stub_emitter()
e.tap("mouse:left@10,20")
check("a click at a point moves first, then clicks",
      e._mouse.position == rf.resolve_screen_point(("10", "20")) and e._mouse.log == [("click", "L", 1)],
      str((e._mouse.position, e._mouse.log)))

e = stub_emitter()
e.tap("mouse:move@30,40")
check("move-only presses nothing", e._mouse.log == [], str(e._mouse.log))
check("…but does move the pointer", e._mouse.position == rf.resolve_screen_point(("30", "40")))

e = stub_emitter()
e.down("mouse:left@10,20")
check("hold: pointer moved and the button is down",
      e._mouse.log == [("press", "L")] and "left" in e._mdown, str(e._mouse.log))
e.up("mouse:left@10,20")
check("release lets go", e._mouse.log[-1] == ("release", "L") and not e._mdown, str(e._mouse.log))

e = stub_emitter()
e.down("mouse:left@10,20")
pos_after_down = e._mouse.position
e._mouse.position = (999, 999)          # the person moved the mouse mid-drag
e.up("mouse:left@10,20")
check("release does NOT teleport back (a drag stays a drag)",
      e._mouse.position == (999, 999) and pos_after_down != (999, 999))

e = stub_emitter()
e.tap("mouse:left@10,20:60")
check("timed press goes down immediately", e._mouse.log == [("press", "L")], str(e._mouse.log))
time.sleep(0.13)
check("…and lets go on its own", e._mouse.log == [("press", "L"), ("release", "L")], str(e._mouse.log))
check("…leaving nothing marked as held", not e._mdown and not e._mtok)

e = stub_emitter()
e.tap("mouse:left@10,20:60")
time.sleep(0.02)
e.down("mouse:left@10,20")              # a hold arriving inside the timed press takes ownership
time.sleep(0.12)
check("an old timer must not cut a newer press short",
      "left" in e._mdown and e._mouse.log.count(("release", "L")) == 0, str(e._mouse.log))
e.up("mouse:left@10,20")
check("…and that press still releases normally", not e._mdown)

e = stub_emitter()
e.tap("mouse:click@10,20:5000")         # a different spelling of the same button
check("'click' and 'left' are the same button", e._mdown == {"left"}, str(e._mdown))
e.mouse_release_all()
check("anti-stuck releases what we hold",
      e._mouse.log[-1] == ("release", "L") and not e._mdown, str(e._mouse.log))
check("…and cancels the pending timer", not e._mtimers and not e._mtok)
time.sleep(0.05)
check("…so the cancelled timer stays silent",
      e._mouse.log.count(("release", "L")) == 1, str(e._mouse.log))

e = stub_emitter()
e.mouse_release_all()
check("anti-stuck with nothing held sends no stray mouse-up", e._mouse.log == [], str(e._mouse.log))

# --------------------------------------------------- the pointer, for real ---
print("\n--- the pointer, for real (GetCursorPos) ---")
here = rf.cursor_pos()
if here is None:
    skip("real pointer move", "cannot read the cursor position (not Windows?)")
else:
    try:
        import pynput.mouse  # noqa: F401
        real = rf.KeyEmitter()
    except Exception as ex:
        real = None
        skip("real pointer move", "pynput unavailable: %s" % ex)
    if real is not None:
        target = (here[0] + 2, here[1] + 2)
        try:
            real.tap("mouse:move@%d,%d" % target)
            time.sleep(0.05)
            got = rf.cursor_pos()
            check("the computed coordinate is the one Windows uses", got == target,
                  "asked %r, got %r" % (target, got))
        finally:
            real.tap("mouse:move@%d,%d" % here)   # put the pointer back where it was

print("\n%d passed, %d failed, %d skipped" % (_passed, _failed, _skipped))
sys.exit(1 if _failed else 0)
