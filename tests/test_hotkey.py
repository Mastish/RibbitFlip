# Unit test: the emergency hotkey (PanicHotkey) — combination validation and the matcher.
# Run: py tests/test_hotkey.py
# No test framework and no keyboard needed: the matcher is fed synthetic hook events, so the
# whole state machine is exercised without installing a global hook or pressing anything.
#
# The point of the AltGr cases: on a Polish layout ą/ć/ę/ł/ń/ó/ś/ź/ż are written with
# AltGr+letter, and Windows implements AltGr as Ctrl + right Alt (with a phantom left Ctrl).
# A hotkey that fired while somebody writes their own name would be worse than no hotkey, so
# those cases are regression tests, not curiosities.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf  # noqa: E402

_passed = 0
_failed = 0

VK = {"alt_l": 0xA4, "alt_gr": 0xA5, "ctrl_l": 0xA2, "ctrl_r": 0xA3,
      "shift_l": 0xA0, "win_l": 0x5B,
      "r": 0x52, "f": 0x46, "l": 0x4C, "a": 0x41, "q": 0x51}
WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP = 0x0100, 0x0101, 0x0104, 0x0105


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s   %s" % (name, detail))


class _Data:
    def __init__(self, vk):
        self.vkCode = vk


class _FakeListener:
    """Stands in for pynput's listener: records how often an event was swallowed."""
    class Suppress(Exception):
        pass

    def __init__(self):
        self.suppressed = 0

    def suppress_event(self):
        self.suppressed += 1
        raise self.Suppress()


def make(combo="alt+r+f"):
    """A PanicHotkey wired to a fake listener — configure() without starting a real hook."""
    fired = []
    hk = rf.PanicHotkey(lambda c: fired.append(c))
    lst = _FakeListener()
    hk._listener = lst
    hk._suppress_exc = _FakeListener.Suppress
    toks = rf.hotkey_tokens(combo)
    hk._combo = combo
    hk._mod_sets = tuple(rf._HK_MOD_VKS[t] for t in toks if rf._hk_is_mod(t))
    hk._keys = frozenset(rf._hk_vk(t) for t in toks if not rf._hk_is_mod(t))
    hk._enabled = True
    # The dispatch normally runs on its own thread; here it is called inline so the test is
    # deterministic (a thread would make "did it fire" a race).
    hk._dispatch = lambda c: fired.append(c)
    return hk, lst, fired


def _feed(hk, msg, vk):
    # In production pynput's hook catches the suppression signal and returns 1 to Windows;
    # here the harness plays that role, so a swallowed event does not abort the test.
    try:
        hk._filter(msg, _Data(vk))
    except _FakeListener.Suppress:
        pass


def press(hk, *names, sys_key=False):
    for n in names:
        _feed(hk, WM_SYSKEYDOWN if sys_key else WM_KEYDOWN, VK[n])


def release(hk, *names, sys_key=False):
    for n in names:
        _feed(hk, WM_SYSKEYUP if sys_key else WM_KEYUP, VK[n])


print("--- validation --------------------------------------------------")
check("the default combination is legal and warning-free",
      rf.hotkey_check(rf.DEFAULT_PANIC_COMBO, probe=False) == {
          "ok": True, "error": None, "combo": "alt+r+f", "warnings": [], "probed": False},
      rf.hotkey_check(rf.DEFAULT_PANIC_COMBO, probe=False))
check("AltGr may not be part of a combination",
      rf.hotkey_check("altgr+l", probe=False)["error"] == "altgr")
check("a bare key is refused (it would fire while typing)",
      rf.hotkey_check("r", probe=False)["error"] == "nomod")
check("modifiers alone are refused",
      rf.hotkey_check("ctrl+shift", probe=False)["error"] == "nokey")
check("combinations Windows owns are refused",
      rf.hotkey_check("ctrl+alt+delete", probe=False)["error"] == "reserved"
      and rf.hotkey_check("alt+f4", probe=False)["error"] == "reserved")
check("Ctrl+Alt+<Polish letter> is flagged",
      any(w["code"] == "altgrletter" for w in rf.hotkey_check("ctrl+alt+l", probe=False)["warnings"]))
check("Alt+<letter> is flagged as menu-accelerator territory",
      any(w["code"] == "menu" for w in rf.hotkey_check("alt+f", probe=False)["warnings"]))
check("an everyday shortcut is flagged",
      any(w["code"] == "common" for w in rf.hotkey_check("ctrl+c", probe=False)["warnings"]))
check("normalisation puts modifiers first and lowercases",
      rf.normalize_combo("  F + Alt +R ") == "alt+f+r")

print("--- matcher -----------------------------------------------------")
hk, lst, fired = make()
press(hk, "alt_l")
press(hk, "r", sys_key=True)
check("Alt and the first key alone do not fire", fired == [] and lst.suppressed == 0, fired)
press(hk, "f", sys_key=True)
check("the completing key fires the stop", fired == ["alt+r+f"], fired)
check("...and that keystroke is swallowed, so no menu command runs", lst.suppressed == 1)

before = len(fired)
press(hk, "f", sys_key=True)
press(hk, "f", sys_key=True)
check("auto-repeat does not fire it again", len(fired) == before, fired)

release(hk, "f", sys_key=True)
check("the release of a swallowed press is swallowed too", lst.suppressed >= 2)
press(hk, "f", sys_key=True)
check("after a release the combination can fire again", len(fired) == before + 1, fired)

print("--- AltGr / Polish letters --------------------------------------")
hk, lst, fired = make()
# Writing 'ł': Windows sends a phantom left Ctrl + the right Alt, then L.
press(hk, "ctrl_l")
press(hk, "alt_gr")
press(hk, "l")
release(hk, "l", "alt_gr", "ctrl_l")
check("writing 'l with a stroke' fires nothing", fired == [] and lst.suppressed == 0, fired)

hk, lst, fired = make()
press(hk, "alt_gr")
press(hk, "r", sys_key=True)
press(hk, "f", sys_key=True)
check("the right Alt (AltGr) does not stand in for Alt in the combination", fired == [], fired)

hk, lst, fired = make()
press(hk, "alt_l", "alt_gr")
press(hk, "r", sys_key=True)
press(hk, "f", sys_key=True)
check("AltGr held blocks the hotkey even with the left Alt down as well", fired == [], fired)
release(hk, "alt_gr")
press(hk, "f", sys_key=True)
check("...and it works again the moment AltGr is released", fired == ["alt+r+f"], fired)

print("--- a combination whose keys are Polish letters ------------------")
hk, lst, fired = make("ctrl+alt+a")
press(hk, "ctrl_l")
press(hk, "alt_gr")
press(hk, "a")
check("Ctrl+Alt+A does not fire while 'a with a tail' is written", fired == [], fired)
release(hk, "a", "alt_gr", "ctrl_l")
press(hk, "ctrl_l", "alt_l")
press(hk, "a", sys_key=True)
check("...but the same combination fires on the LEFT Alt", fired == ["ctrl+alt+a"], fired)

print("--- switched off -------------------------------------------------")
hk, lst, fired = make()
hk._enabled = False
press(hk, "alt_l")
press(hk, "r", sys_key=True)
press(hk, "f", sys_key=True)
check("a disabled hotkey neither fires nor swallows", fired == [] and lst.suppressed == 0)

print("--- a test copy never takes the hook ------------------------------")
# Windows chains low-level hooks and asks the newest first; whoever fires swallows the key that
# completes the combination, so a copy started later inherits the panic key of the one already
# running. Measured on the real thing: two copies, the newer took 3 of 3 presses, the older 0.
# Hence: a --allow-multi copy must refuse the hook even when the panel switches it on.
blocked = rf.PanicHotkey(lambda c: None, blocked="kopia testowa")
st = blocked.configure(True, "alt+r+f")
check("a blocked copy reports the hotkey as unavailable, with a reason",
      st["available"] is False and st["reason"] == "kopia testowa" and st["blocked"] == "kopia testowa", st)
check("...and no listener was installed", blocked._listener is None)
normal = rf.PanicHotkey(lambda c: None)
check("an ordinary copy is not blocked", normal.state()["blocked"] == "")

print("--- self-test ----------------------------------------------------")
hk, lst, fired = make()
check("nothing is armed before the check is started",
      hk.test_state() == {"armed": False, "remaining": 0.0, "hit": False, "seenDuring": 0},
      hk.test_state())
hk.arm_test(30)
press(hk, "q")                      # an ordinary keystroke: seen, but not the combination
release(hk, "q")
mid = hk.test_state()
check("keys that are not the combination count as 'we see the keyboard'",
      mid["armed"] and not mid["hit"] and mid["seenDuring"] == 2, mid)
press(hk, "alt_l")
press(hk, "r", sys_key=True)
press(hk, "f", sys_key=True)
hit = hk.test_state()
check("the combination is recorded as a hit", hit["hit"] is True, hit)
check("...and it still fired the stop (the check watches, it does not intercept)",
      fired == ["alt+r+f"], fired)
release(hk, "f", sys_key=True)
release(hk, "r", sys_key=True)
release(hk, "alt_l")
hk2, lst2, fired2 = make()
hk2.arm_test(30)
hk2._test_until = 0.0               # window closed with nothing pressed
closed = hk2.test_state()
check("a closed window with no keys at all is distinguishable from an eaten combination",
      closed["armed"] is False and closed["seenDuring"] == 0 and closed["hit"] is False, closed)

print("--- the second hotkey: closing the scanner's window (2026-09-15) --")
# Two hooks, two jobs. The emergency stop DISARMS THE WHOLE APP; closing the scanner's window is
# an everyday move you make after every scan. Sharing one combination meant that "I am done
# scanning" also silenced mappings, MIDI, OSC, the Synth and the network services — which is
# exactly what must not happen.
check("the scanner combination is valid and not the panic one",
      rf.hotkey_check(rf.DEFAULT_SCAN_COMBO, probe=False)["ok"]
      and rf.DEFAULT_SCAN_COMBO != rf.DEFAULT_PANIC_COMBO, rf.DEFAULT_SCAN_COMBO)
_sk, _sklst, _skfired = make(rf.DEFAULT_SCAN_COMBO)
press(_sk, "shift_l")
press(_sk, "r")
press(_sk, "f")
check("the scanner combination fires and swallows the completing key",
      _skfired == [rf.DEFAULT_SCAN_COMBO] and _sklst.suppressed == 1, (_skfired, _sklst.suppressed))
press(_sk, "alt_l")                 # the panic combination's modifier, with shift still down
check("...and the panic keys do not fire it a second time", len(_skfired) == 1, _skfired)

# Each instance carries its OWN factory combination: a scanner hotkey hand-edited into nonsense
# has to fall back to Shift+R+F, never to the panic key — that would silently move the emergency
# stop onto a second shortcut nobody chose.
_own = rf.PanicHotkey(lambda c: None, default=rf.DEFAULT_SCAN_COMBO)
check("an instance reports its own default", _own.state()["default"] == rf.DEFAULT_SCAN_COMBO)
_own.configure(False, "zupelnie+nic")
check("an unusable combination falls back to that instance's default",
      _own.state()["combo"] == rf.DEFAULT_SCAN_COMBO, _own.state()["combo"])
check("the panic instance still falls back to the panic default",
      rf.PanicHotkey(lambda c: None).state()["default"] == rf.DEFAULT_PANIC_COMBO)

print("--- both hotkeys share one settings file --------------------------")
import json as _json          # noqa: E402
import shutil as _shutil      # noqa: E402
import tempfile as _tempfile  # noqa: E402

_tmp = _tempfile.mkdtemp(prefix="rf-hotkey-")
_sd, _hf = rf.SETTINGS_DIR, rf.HOTKEY_CONFIG_FILE
rf.SETTINGS_DIR, rf.HOTKEY_CONFIG_FILE = _tmp, os.path.join(_tmp, "ribbitflip_hotkey.json")
try:
    _cfg = rf.load_hotkey_config()
    check("no file means both hotkeys on, both factory",
          _cfg["combo"] == rf.DEFAULT_PANIC_COMBO and _cfg["enabled"]
          and _cfg["scan"] == {"enabled": True, "combo": rf.DEFAULT_SCAN_COMBO}, _cfg)
    # ⚠️ THE REGRESSION THIS GUARDS: the panel's card saves the PANIC hotkey only, and the file is
    # shared. Without the merge in save_hotkey_config, every "Zmień skrót" would quietly wipe the
    # scanner's shortcut back to factory on the next start.
    rf.save_hotkey_config({"enabled": True, "combo": "ctrl+shift+q",
                           "scan": {"enabled": False, "combo": "ctrl+alt+k"}})
    rf.save_hotkey_config({"enabled": False, "combo": "ctrl+shift+q"})   # panel-style save
    _cfg = rf.load_hotkey_config()
    check("saving only the panic half keeps the scanner half",
          _cfg["scan"] == {"enabled": False, "combo": "ctrl+alt+k"} and _cfg["enabled"] is False,
          _cfg)
    with open(rf.HOTKEY_CONFIG_FILE, "w", encoding="utf-8") as _f:
        _json.dump({"enabled": True, "combo": "alt+r+f",
                    "scan": {"enabled": True, "combo": "zupelnie+nic"}}, _f)
    check("a hand-edited scanner combination falls back to factory",
          rf.load_hotkey_config()["scan"]["combo"] == rf.DEFAULT_SCAN_COMBO)
finally:
    rf.SETTINGS_DIR, rf.HOTKEY_CONFIG_FILE = _sd, _hf
    _shutil.rmtree(_tmp, ignore_errors=True)

print("--- the third hotkey: a prefix plus one of 1..9 (2026-09-21) -------")
# A DIFFERENT SHAPE of combination, and the reason the class grew `finals=`: this hotkey is not
# one combination but a PREFIX (alt+r) plus any of nine finishing keys, and the key that finished
# it carries meaning — it is the scanner's view number. Nine separate low-level hooks would be
# nine places Windows asks about every keystroke on the machine, and the digit would still have
# to travel back to the caller somehow.
VK.update({str(d): 0x30 + d for d in range(10)})


def make_finals(prefix="alt+r", finals=rf.ZRZUT_FINALS):
    """A PanicHotkey in the prefix+final variant, wired to a fake listener.
    `fired` collects (full combination, final key) — both halves matter to the caller."""
    fired = []
    hk = rf.PanicHotkey(lambda c, f: fired.append((c, f)), default=rf.DEFAULT_ZRZUT_PREFIX)
    lst = _FakeListener()
    hk._listener = lst
    hk._suppress_exc = _FakeListener.Suppress
    # Inline dispatch, like make() above: a thread would turn "did it fire" into a race.
    hk._dispatch = lambda c, f=None: fired.append((c + "+" + f, f))
    hk.configure(True, prefix, finals=finals)
    return hk, lst, fired


hk, lst, fired = make_finals()
check("the prefix alone fires nothing and is not swallowed",
      (press(hk, "alt_l"), press(hk, "r", sys_key=True), fired == [] and lst.suppressed == 0)[-1],
      fired)
press(hk, "1", sys_key=True)
check("the first digit fires it, and the callback gets the digit as well",
      fired == [("alt+r+1", "1")], fired)
check("...and only the digit is swallowed, so the game still sees Alt+R", lst.suppressed == 1)
press(hk, "1", sys_key=True)
press(hk, "1", sys_key=True)
check("auto-repeat of the same digit does not fire it again", len(fired) == 1, fired)
# THE POINT OF A PER-DIGIT LATCH: "hold Alt+R, tap 1, then 2, then 3" is three screenshots.
press(hk, "2", sys_key=True)
press(hk, "3", sys_key=True)
check("holding the prefix and tapping other digits fires once per digit",
      [f[1] for f in fired] == ["1", "2", "3"], fired)
release(hk, "1", sys_key=True)
press(hk, "1", sys_key=True)
check("a released digit may fire again without releasing the prefix",
      [f[1] for f in fired] == ["1", "2", "3", "1"], fired)
press(hk, "9", sys_key=True)
check("the last digit of the range works too", fired[-1] == ("alt+r+9", "9"), fired[-1])
press(hk, "f", sys_key=True)
check("a key outside the range fires nothing (alt+r+f is the emergency stop)",
      len(fired) == 5, fired)

hk, lst, fired = make_finals()
press(hk, "alt_l")
press(hk, "1", sys_key=True)
check("the prefix's own key must be held too - Alt+1 alone does nothing",
      fired == [] and lst.suppressed == 0, fired)

# Rule 2 holds here exactly as for the other two hooks: AltGr held means somebody is writing a
# Polish letter, whatever the combination is.
hk, lst, fired = make_finals()
press(hk, "alt_gr")
press(hk, "r", sys_key=True)
press(hk, "1", sys_key=True)
check("AltGr held fires nothing", fired == [] and lst.suppressed == 0, fired)

# A prefix of modifiers ALONE is legal here (it is not a hotkey on its own — the digit completes
# it), which is why configure() validates prefix+digit rather than the prefix.
hk, lst, fired = make_finals("ctrl+shift")
check("a modifiers-only prefix is accepted", hk.state()["combo"] == "ctrl+shift",
      hk.state()["combo"])
press(hk, "ctrl_l", "shift_l")
press(hk, "4")
check("...and fires on a digit", fired == [("ctrl+shift+4", "4")], fired)

_zl = rf.PanicHotkey(lambda c, f: None, default=rf.DEFAULT_ZRZUT_PREFIX)
_zl.configure(False, "zupelnie+nic", finals=rf.ZRZUT_FINALS)
check("an unusable prefix falls back to this instance's factory one",
      _zl.state()["combo"] == rf.DEFAULT_ZRZUT_PREFIX, _zl.state()["combo"])
check("the state says which finishing keys are in play",
      _zl.state()["finals"] == list(rf.ZRZUT_FINALS), _zl.state()["finals"])
check("an ordinary hotkey reports no finishing keys",
      rf.PanicHotkey(lambda c: None).state()["finals"] == [])
# The factory prefix must not BE either of the other two hotkeys, or two hooks would fight over
# the same keys and the one that swallows the final key wins silently.
check("the factory prefix is not the panic or the scanner combination",
      rf.DEFAULT_ZRZUT_PREFIX not in (rf.DEFAULT_PANIC_COMBO, rf.DEFAULT_SCAN_COMBO))
check("the factory prefix plus a digit is a legal combination",
      rf.hotkey_check(rf.DEFAULT_ZRZUT_PREFIX + "+1", probe=False)["ok"],
      rf.hotkey_check(rf.DEFAULT_ZRZUT_PREFIX + "+1", probe=False))

print("--- 'unavailable' is not 'switched off' (2026-09-21) ---------------")
# The panel greyed its own switch out and locked the feature away for good, because it read
# `available` as "the hotkey can be had". It means "the hook is up RIGHT NOW", and a hotkey that
# is switched off has no hook by design — configure(enabled=False) calls stop(). These two cases
# pin down what the state really reports, so the panel is never tempted to guess again.
_off = rf.PanicHotkey(lambda c: None).configure(False, "alt+r+f")
check("a switched-off hotkey reports available=False - that is normal, not a failure",
      _off["available"] is False, _off)
check("...and nothing blocks it, so the panel must still let you switch it back on",
      _off["blocked"] == "", _off)
_blk = rf.PanicHotkey(lambda c: None, blocked="kopia testowa").configure(True, "alt+r+f")
check("a blocked copy (--allow-multi) refuses the hook even when switched on",
      _blk["available"] is False, _blk)
check("...and says why", _blk["reason"] == "kopia testowa", _blk)
check("...through `blocked`, which is the ONLY real unavailability the panel may act on",
      bool(_blk["blocked"]), _blk)

# Static check of the two panel cards. Both draw the same switch from the same state, so they must
# read it the same way; they drifted apart once already and only one of them was fixed.
_JS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web", "js")
with open(os.path.join(_JS_DIR, "rf-39j-hotkey.js"), "r", encoding="utf-8") as _f:
    _hk_js = _f.read()
check("the emergency stop card greys out only a blocked copy or a hook that failed while on",
      "dead=!!_hkState.blocked||(!!_hkState.enabled&&!_hkState.available)" in _hk_js)
check("...and no longer treats a plain `available` of False as dead",
      "dead=!_hkState.available" not in _hk_js)
check("...while its switch refuses the click only in a blocked copy",
      "if(_hkState.blocked){" in _hk_js)
with open(os.path.join(_JS_DIR, "rf-50o-scan-zrzut-skrot.js"), "r", encoding="utf-8") as _f:
    _zr_js = _f.read()
check("the board-grab card keeps the very same condition, so the two cards cannot drift apart",
      "const martwy = !!c.blocked || (!!c.enabled && !c.available);" in _zr_js)

print()
print("OK" if not _failed else "FAILED", "- %d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
