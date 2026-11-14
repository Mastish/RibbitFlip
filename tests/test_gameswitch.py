# Test of AUTO SETS BY GAME — the set that loads itself when the game comes to the front.
# Run: py tests/test_gameswitch.py
#
# Three layers, none of them needing Windows, a capsule, or the owner's Settings/:
#   1. _sanitize_exe_list — what the panel's one text field is allowed to turn into. This is the
#      value that decides when the app reaches into the configuration on its own, so every way of
#      writing a program name badly is tested here rather than discovered later.
#   2. GameSwitcher — the decision, with the foreground, the library, the settings, the loading
#      and the clock all injected. That is the whole point of the class being pure: the rules
#      below (stability, 0/1/2+ matches, remembered answers, the anti-ping-pong latch, the
#      cooldown) are the feature, and they must be provable without alt-tabbing into a game.
#   3. the two files it persists — the settings and a saved set — on a temp directory.
#
# The one thing this must prove about LOADING is negative: an automatic load may change the
# configuration and must never arm an output group. The whole app rests on "a file cannot make
# your capsule start sending" (tests/test_setup_switches.py), and that promise gets strictly
# harder to keep the moment the app, rather than a person, decides when to load.
import json
import os
import shutil
import sys
import tempfile

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


# ---------------------------------------------------------------------------
#  1. exe normalisation
# ---------------------------------------------------------------------------
print("--- nazwy programow (normalizacja) --------------------------------")
S = rf._sanitize_exe_list

check("plain name gets .exe", S("eldenring") == ["eldenring.exe"], S("eldenring"))
check("case is flattened", S("EldenRing.EXE") == ["eldenring.exe"], S("EldenRing.EXE"))
check("commas split one field into many",
      S("eldenring.exe, cyberpunk2077.exe") == ["eldenring.exe", "cyberpunk2077.exe"],
      S("eldenring.exe, cyberpunk2077.exe"))
check("a list works as well as a line",
      S(["EldenRing", " cyberpunk2077.EXE "]) == ["eldenring.exe", "cyberpunk2077.exe"],
      S(["EldenRing", " cyberpunk2077.EXE "]))
# A path is cut to its last element: whose install directory it is has nothing to do with the
# question, and letting one in would make a set match on one machine and not on another.
check("a Windows path is cut to the file name",
      S(r"C:\Games\EldenRing\eldenring.exe") == ["eldenring.exe"],
      S(r"C:\Games\EldenRing\eldenring.exe"))
check("a unix path too", S("/opt/games/foo.exe") == ["foo.exe"], S("/opt/games/foo.exe"))
check("spaces inside a name survive",
      S("epic games launcher.exe") == ["epic games launcher.exe"],
      S("epic games launcher.exe"))
check("dots, dashes and underscores survive",
      S("re-volt_2.0.exe") == ["re-volt_2.0.exe"], S("re-volt_2.0.exe"))
check("rubbish characters are dropped, not escaped",
      S("elden<>ring|.exe") == ["eldenring.exe"], S("elden<>ring|.exe"))
check("an entry with nothing left is dropped whole", S("!!!, ***") == [], S("!!!, ***"))
check("empty input is an empty list", S("") == [] and S(None) == [] and S(123) == [],
      (S(""), S(None), S(123)))
check("duplicates collapse", S("a.exe, A.EXE, a") == ["a.exe"], S("a.exe, A.EXE, a"))
check("at most five", S("a,b,c,d,e,f,g") == ["a.exe", "b.exe", "c.exe", "d.exe", "e.exe"],
      S("a,b,c,d,e,f,g"))
long = S("x" * 400)
check("a very long name is capped at the limit",
      len(long) == 1 and len(long[0]) <= rf.GS_EXE_LEN, long)
check("...and still ends in .exe", long and long[0].endswith(".exe"), long)
check("a hostile list cannot make us loop", len(S(["a%d" % i for i in range(5000)])) == 5,
      len(S(["a%d" % i for i in range(5000)])))


# ---------------------------------------------------------------------------
#  2. the decision
# ---------------------------------------------------------------------------
print()
print("--- decyzja (GameSwitcher) ----------------------------------------")


class Fake:
    """Everything the switcher reaches for, under our hand: the window in front, the library,
    the settings, the act of loading, both ways of speaking, and time itself."""

    def __init__(self, index=None, enabled=True, defaults=None):
        self.front = None
        self.index = index or {}
        self.cfg = {"enabled": enabled, "defaults": defaults or {}}
        self.t = 1000.0
        self.applied = []          # (kind, name) per load
        self.notes = []            # notification texts
        self.events = []           # SSE events
        self.ok = True             # what the next load reports

    # --- injected -----------------------------------------------------------
    def foreground(self):
        return self.front

    def matches(self, exe):
        return [dict(m) for m in self.index.get(exe, [])]

    def config(self):
        return self.cfg

    def apply(self, kind, name):
        self.applied.append((kind, name))
        return {"ok": self.ok, "kind": kind, "name": name,
                "error": (None if self.ok else "Brak zestawu")}

    def notify(self, title, msg):
        self.notes.append((title, msg))

    def publish(self, ev):
        self.events.append(ev)

    def clock(self):
        return self.t

    # --- helpers ------------------------------------------------------------
    def switcher(self, **kw):
        return rf.GameSwitcher(foreground=self.foreground, matches=self.matches,
                               config=self.config, apply_fn=self.apply,
                               notify=self.notify, publish=self.publish, clock=self.clock,
                               ignore={"ribbitflip.exe"}, **kw)


def M(name, kind="setup"):
    return {"kind": kind, "name": name, "forApp": ""}


IDX_ONE = {"eldenring.exe": [M("Souls")]}
IDX_TWO = {"eldenring.exe": [M("Souls"), M("Souls mysz")]}

# --- stability -------------------------------------------------------------
f = Fake(IDX_ONE)
gs = f.switcher()
f.front = "eldenring.exe"
check("one reading is not enough", gs.tick() is None and not f.applied)
r = gs.tick()
check("the second identical reading settles it",
      r and r["action"] == "applied" and f.applied == [("setup", "Souls")], (r, f.applied))

# A window that flashes past (a launcher, a notification stealing focus for a frame) must not
# count. This is the whole reason a reading has to repeat before it means anything.
f = Fake(IDX_ONE)
gs = f.switcher()
f.front = "eldenring.exe"
gs.tick()
f.front = "explorer.exe"      # one frame of something else
gs.tick()
f.front = "eldenring.exe"
gs.tick()                     # counter restarted: still only one reading of the game
check("a single frame of another window does not switch anything", not f.applied, f.applied)
gs.tick()
check("...and the game still lands once it has settled", f.applied == [("setup", "Souls")],
      f.applied)

# --- 0 / 1 / 2+ ------------------------------------------------------------
f = Fake(IDX_ONE)
gs = f.switcher()
f.front = "notepad.exe"
gs.tick()
r = gs.tick()
check("a program nothing claims is not an event", r is None and not f.applied and not f.events,
      (r, f.applied, f.events))

f = Fake(IDX_ONE)
gs = f.switcher()
f.front = "eldenring.exe"
gs.tick()
gs.tick()
ev = f.events[-1] if f.events else {}
check("one match loads it", f.applied == [("setup", "Souls")], f.applied)
check("...and says so on the stream",
      ev.get("t") == "game" and ev.get("exe") == "eldenring.exe"
      and (ev.get("applied") or {}).get("name") == "Souls", ev)
check("...and in a notification", len(f.notes) == 1 and "Souls" in f.notes[0][1], f.notes)

f = Fake(IDX_TWO)
gs = f.switcher()
f.front = "eldenring.exe"
gs.tick()
r = gs.tick()
ev = f.events[-1] if f.events else {}
check("two matches load NOTHING", not f.applied, f.applied)
check("...they ask instead",
      r and r["action"] == "ask" and ev.get("applied") is None
      and [m["name"] for m in ev.get("matches") or []] == ["Souls", "Souls mysz"], (r, ev))
check("...and the question reaches the desktop too", len(f.notes) == 1, f.notes)

# --- a remembered answer ---------------------------------------------------
f = Fake(IDX_TWO, defaults={"eldenring.exe": {"kind": "setup", "name": "Souls mysz"}})
gs = f.switcher()
f.front = "eldenring.exe"
gs.tick()
r = gs.tick()
check("a remembered answer settles two matches without asking",
      f.applied == [("setup", "Souls mysz")] and r["action"] == "applied", (f.applied, r))

# A remembered answer naming a set that is no longer there is not an answer. Quietly falling back
# to "nothing matched" would leave somebody wondering why their remembered game stopped working.
f = Fake(IDX_TWO, defaults={"eldenring.exe": {"kind": "setup", "name": "Skasowany"}})
gs = f.switcher()
f.front = "eldenring.exe"
gs.tick()
r = gs.tick()
check("a remembered answer pointing at a deleted set reopens the question",
      not f.applied and r["action"] == "ask", (f.applied, r))

# --- the anti-ping-pong latch ---------------------------------------------
f = Fake(IDX_ONE)
gs = f.switcher()
f.front = "eldenring.exe"
for _ in range(8):
    gs.tick()
check("the same game in front, read many times, is loaded ONCE", f.applied == [("setup", "Souls")],
      f.applied)
check("...and the stream carries one event, not eight", len(f.events) == 1, len(f.events))

# Alt-tabbing out to a browser and back is not a game starting.
f = Fake(IDX_ONE)
gs = f.switcher()
f.front = "eldenring.exe"
gs.tick(); gs.tick()
f.t += 60                    # well past the cooldown, so only the latch can be stopping it
f.front = "chrome.exe"
gs.tick(); gs.tick()
f.front = "eldenring.exe"
gs.tick(); gs.tick()
check("alt-tab out and back does not load it again", f.applied == [("setup", "Souls")], f.applied)

# ...but another claimed game taking the front IS a new decision, and going back to the first one
# after that is another.
f = Fake({"a.exe": [M("A")], "b.exe": [M("B")]})
gs = f.switcher()
for exe in ("a.exe", "b.exe", "a.exe"):
    f.front = exe
    gs.tick(); gs.tick()
    f.t += 60
check("a different game is a new decision, and coming back is another",
      f.applied == [("setup", "A"), ("setup", "B"), ("setup", "A")], f.applied)

# --- the cooldown ----------------------------------------------------------
f = Fake({"a.exe": [M("A")], "b.exe": [M("B")]})
gs = f.switcher()
f.front = "a.exe"
gs.tick(); gs.tick()
f.front = "b.exe"
gs.tick(); gs.tick()
check("a second game inside the cooldown is ignored", f.applied == [("setup", "A")], f.applied)
f.t += rf.GS_COOLDOWN_S + 0.1
gs.tick()
check("...and lands once the quiet time is over", f.applied == [("setup", "A"), ("setup", "B")],
      f.applied)

# --- our own window, and no answer at all ----------------------------------
f = Fake(IDX_ONE)
gs = f.switcher()
f.front = "eldenring.exe"
gs.tick()
f.front = "ribbitflip.exe"    # the dashboard coming to the front
gs.tick()
f.front = "eldenring.exe"
gs.tick()
check("our own window is not a window change", f.applied == [("setup", "Souls")], f.applied)

f = Fake(IDX_ONE)
gs = f.switcher()
f.front = "eldenring.exe"
gs.tick()
f.front = None                # the probe could not answer
gs.tick()
f.front = "eldenring.exe"
gs.tick()
check("a reading we could not take is not a window change either",
      f.applied == [("setup", "Souls")], f.applied)

# --- a load that failed ----------------------------------------------------
f = Fake(IDX_ONE)
f.ok = False
gs = f.switcher()
f.front = "eldenring.exe"
gs.tick()
r = gs.tick()
ev = f.events[-1] if f.events else {}
check("a failed load is reported as one, not as a success",
      r["action"] == "failed" and ev.get("applied") is None and ev.get("error"), (r, ev))
check("...and stays quiet on the desktop", not f.notes, f.notes)

# --- the latch, set from outside (the dialog answered) ---------------------
f = Fake(IDX_TWO)
gs = f.switcher()
f.front = "eldenring.exe"
gs.tick(); gs.tick()
check("the question was asked once", len(f.events) == 1, len(f.events))
gs.latch("eldenring.exe")     # the user picked a set in the panel; the panel says so
f.t += 60
gs.tick(); gs.tick()
check("...and is not asked again after the panel answered it", len(f.events) == 1, len(f.events))

# --- reset (the feature switched off and on again) -------------------------
f = Fake(IDX_ONE)
gs = f.switcher()
f.front = "eldenring.exe"
gs.tick()
gs.reset()
gs.tick()
check("after a reset a reading has to settle again", not f.applied, f.applied)
gs.tick()
check("...and then it works as before", f.applied == [("setup", "Souls")], f.applied)

# --- the state an outside reader sees --------------------------------------
f = Fake(IDX_ONE)
gs = f.switcher()
check("nothing seen yet reads as nothing, not as a guess", gs.state()["lastExe"] is None)
f.front = "notepad.exe"
gs.tick(); gs.tick()
check("what is in front is reported even when nothing claims it",
      gs.state()["lastExe"] == "notepad.exe", gs.state())


# ---------------------------------------------------------------------------
#  2b. it must never arm anything
# ---------------------------------------------------------------------------
print()
print("--- automatyczne wczytanie NIE uzbraja ----------------------------")


class ArmSpy:
    """Stands in for the loading step and records everything it was asked to do. The point is
    what is ABSENT: no call may carry an output switch."""

    def __init__(self):
        self.calls = []

    def __call__(self, kind, name):
        self.calls.append((kind, name))
        return {"ok": True, "kind": kind, "name": name}


spy = ArmSpy()
f = Fake(IDX_ONE)
gs = rf.GameSwitcher(foreground=f.foreground, matches=f.matches, config=f.config,
                     apply_fn=spy, notify=f.notify, publish=f.publish, clock=f.clock)
f.front = "eldenring.exe"
gs.tick(); gs.tick()
check("loading is asked for by kind and name only — nothing else can ride along",
      spy.calls == [("setup", "Souls")], spy.calls)
# The proof that a set carries no arming at all is tests/test_setup_switches.py; what THIS test
# adds is that the automatic path reaches the very same function with the very same two
# arguments, so there is no second door through which a switch could be flipped.
check("the switcher owns no way to arm anything",
      not any(hasattr(gs, a) for a in ("arm", "set_armed", "enable_group", "master")),
      [a for a in dir(gs) if "arm" in a.lower()])


# ---------------------------------------------------------------------------
#  3. the two files
# ---------------------------------------------------------------------------
print()
print("--- pliki (ustawienia + zestaw) -----------------------------------")

_tmp = tempfile.mkdtemp(prefix="rf-gameswitch-")
_orig = {"SETTINGS_DIR": rf.SETTINGS_DIR, "GAMESWITCH_CONFIG_FILE": rf.GAMESWITCH_CONFIG_FILE,
         "SETUPS_DIR": rf.SETUPS_DIR, "_LIBRARY_KINDS": rf._LIBRARY_KINDS,
         "list_builtin_setups": rf.list_builtin_setups}
try:
    setups = os.path.join(_tmp, "Setups")
    os.makedirs(setups, exist_ok=True)
    rf.SETTINGS_DIR = _tmp
    rf.GAMESWITCH_CONFIG_FILE = os.path.join(_tmp, "ribbitflip_gameswitch.json")
    rf.SETUPS_DIR = setups
    # _LIBRARY_KINDS was bound to the real folder at import time, so redirecting SETUPS_DIR alone
    # would leave library_index reading the owner's library. (Worth knowing for any future test.)
    rf._LIBRARY_KINDS = dict(rf._LIBRARY_KINDS, setup=setups)
    rf.list_builtin_setups = lambda: []      # the shipped presets are not part of this question

    # --- settings round trip ----------------------------------------------
    check("a missing file means OFF with nothing remembered",
          rf.load_gameswitch_config() == {"enabled": False, "defaults": {}},
          rf.load_gameswitch_config())

    rf.save_gameswitch_config({"enabled": True,
                               "defaults": {"EldenRing": {"kind": "setup", "name": "Souls"}}})
    got = rf.load_gameswitch_config()
    check("what was saved comes back", got["enabled"] is True, got)
    check("...with the program name normalised on the way in",
          got["defaults"] == {"eldenring.exe": {"kind": "setup", "name": "Souls"}}, got)

    rf.save_gameswitch_config({"enabled": True, "wolnyKlucz": 1, "defaults": {
        "a.exe": {"kind": "setup", "name": "A", "cosDziwnego": True},
        "b.exe": {"kind": "wynalazek", "name": "B"},
        "c.exe": {"kind": "setup"},                 # no name = no answer
        "!!!": {"kind": "setup", "name": "D"},      # no usable program name
        "e.exe": "nie-slownik",
    }})
    got = rf.load_gameswitch_config()
    check("an unknown top-level key does not survive", "wolnyKlucz" not in got, got)
    check("an unknown key inside an answer does not survive",
          got["defaults"].get("a.exe") == {"kind": "setup", "name": "A"}, got["defaults"])
    check("an invented kind falls back to a plain set",
          got["defaults"].get("b.exe", {}).get("kind") == "setup", got["defaults"])
    check("an answer with no set named is dropped", "c.exe" not in got["defaults"], got["defaults"])
    check("an answer with no usable program is dropped", len(got["defaults"]) == 2, got["defaults"])

    with open(rf.GAMESWITCH_CONFIG_FILE, "w", encoding="utf-8") as fh:
        fh.write("{ to nie jest json")
    check("a damaged file reads as OFF, not as a crash",
          rf.load_gameswitch_config() == {"enabled": False, "defaults": {}},
          rf.load_gameswitch_config())

    with open(rf.GAMESWITCH_CONFIG_FILE, "w", encoding="utf-8") as fh:
        json.dump({"enabled": "tak", "defaults": "też nie"}, fh)
    check("wrong types read as OFF too",
          rf.load_gameswitch_config() == {"enabled": False, "defaults": {}},
          rf.load_gameswitch_config())

    # --- the envelope round trip, and the index built from it --------------
    env = {"app": "ribbitflip", "kind": "setup", "name": "Souls",
           "forApp": "Elden Ring", "description": "", "author": "", "rev": 1,
           "exe": rf._sanitize_exe_list("EldenRing, C:/x/launcher.EXE"),
           "config": {"rules": []}}
    check("save_setup writes it", rf.save_setup("Souls", env) is True)
    back = rf.load_setup("Souls")
    check("the programs survive the round trip",
          back.get("exe") == ["eldenring.exe", "launcher.exe"], back.get("exe"))

    entry = [x for x in rf.library_index().get("setup", []) if x["name"] == "Souls"]
    check("the library row carries them too",
          entry and entry[0].get("exe") == ["eldenring.exe", "launcher.exe"],
          entry and entry[0].get("exe"))

    rf.gameswitch_invalidate()
    ms = rf.gameswitch_matches("EldenRing.exe")
    check("a saved set is found by its program, however the name is written",
          [m["name"] for m in ms] == ["Souls"] and ms[0]["kind"] == "setup", ms)
    check("a program nothing claims finds nothing", rf.gameswitch_matches("notepad.exe") == [],
          rf.gameswitch_matches("notepad.exe"))

    # Two sets on one game — sorted, so the dialog does not reshuffle between two readings.
    env2 = dict(env, name="Souls mysz")
    rf.save_setup("Souls mysz", env2)
    env3 = dict(env, name="Aaa")
    rf.save_setup("Aaa", env3)
    ms = rf.gameswitch_matches("eldenring.exe")
    check("every set claiming the game is found, in a stable order",
          [m["name"] for m in ms] == ["Aaa", "Souls", "Souls mysz"], ms)

    # Saving must drop the cache by itself — somebody who has just typed a game name is about to
    # start that game to see whether it works, and a 30 s wait would read as "it does not".
    rf.save_setup("Nowy", dict(env, name="Nowy", exe=["swiezy.exe"]))
    check("a set saved a moment ago is already matchable",
          [m["name"] for m in rf.gameswitch_matches("swiezy.exe")] == ["Nowy"],
          rf.gameswitch_matches("swiezy.exe"))
    rf.delete_setup("Nowy")
    check("...and a deleted one stops matching at once",
          rf.gameswitch_matches("swiezy.exe") == [], rf.gameswitch_matches("swiezy.exe"))

    # A multi-capsule set living among the setups is matched as a BUNDLE: it is loaded down a
    # different road, and which road has to be part of the match rather than guessed later.
    rf.save_setup("Duet", {"app": "ribbitflip", "kind": "bundle", "name": "Duet",
                           "exe": ["duet.exe"], "devices": [{"slot": "d0", "setup": {}}]})
    ms = rf.gameswitch_matches("duet.exe")
    check("a multi-capsule set is matched as one", ms and ms[0]["kind"] == "bundle", ms)

    # A file that will not parse must not take the whole index down with it.
    with open(os.path.join(setups, "Zepsuty.json"), "w", encoding="utf-8") as fh:
        fh.write("{ nie json")
    rf.gameswitch_invalidate()
    check("a corrupted file in the library does not break matching",
          [m["name"] for m in rf.gameswitch_matches("eldenring.exe")] == ["Aaa", "Souls", "Souls mysz"],
          rf.gameswitch_matches("eldenring.exe"))

    # --- gameswitch_apply refuses what it cannot honestly do ---------------
    class NoDm:
        default_id = "d0"

        def get(self, _):
            return None

        def all(self):
            return []

    check("loading a set that is not there says so",
          rf.gameswitch_apply(NoDm(), None, "setup", "NieMaTakiego").get("error") == "Brak zestawu",
          rf.gameswitch_apply(NoDm(), None, "setup", "NieMaTakiego"))
    check("loading with no name says so too",
          rf.gameswitch_apply(NoDm(), None, "setup", "").get("ok") is False)
    check("a one-capsule set with no capsule paired fails loudly, not silently",
          rf.gameswitch_apply(NoDm(), None, "setup", "Souls") ==
          {"ok": False, "error": "Brak slotu urządzenia"},
          rf.gameswitch_apply(NoDm(), None, "setup", "Souls"))
finally:
    for k, v in _orig.items():
        setattr(rf, k, v)
    rf.gameswitch_invalidate()
    shutil.rmtree(_tmp, ignore_errors=True)

print()
print("OK" if not _failed else "FAILED", "- %d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
