# Test of KOŁO WYBORU (the radial menu). Run: py tests/test_wheel.py
#
# The feature: hold the capsule's button, lean the capsule towards a slice of a wheel drawn on the
# cheat sheet, let go — that slice's action is sent. A "weapon wheel", made of one press.
#
# What is worth pinning down here, and none of it is "a key was sent":
#
#   * THE PRESS IS THE WHOLE EVENT. Nothing happens while the button is going down (a wheel that
#     fired on the way in would be a trigger), nothing happens if it is let go before holdMs, and
#     one press opens the wheel exactly once — releasing is what ends it.
#   * THE MIDDLE IS AN ESCAPE HATCH. Letting go without leaning anywhere sends nothing. That is
#     what makes a wheel safe to open out of curiosity, so it has to be exact.
#   * A HAND ON A BORDER IS NOT A DECISION. Angular hysteresis, the same as the d-pad's: a wrist
#     resting between two slices must not machine-gun between them.
#   * THE GATE IS THE APP'S GATE. Opening is a picture and happens whether or not the capsule is
#     armed; SENDING goes through `armed`, exactly like every other output.
#   * A CAPSULE THAT WENT QUIET DID NOT LET GO. Losing the button reading mid-press must cancel,
#     not commit — otherwise walking out of Bluetooth range presses a key.
#
# Nothing here touches anybody's desktop: the emitter is a recording stub, no Settings/ is read or
# written, and the clock is ours, so a 300 ms hold costs no wall time at all.
import math
import os
import sys
import time as _real_time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402

try:
    # Konsola po polsku to cp1250, a nazwy sprawdzeń niosą „▲▼", „—" i polskie znaki. Bez tej
    # linii cały plik przewracał się na PIERWSZYM takim wyniku (UnicodeEncodeError w print),
    # więc podsumowania „N passed" nie dało się zobaczyć w konsoli Windows. Ta sama linia
    # co w test_devices_slots.py i pozostałych plikach z polskimi nazwami.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

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
# RadialMenu.tick() reads time.monotonic() directly, and a test that actually WAITED would spend
# its life sleeping through hold countdowns whose length it already knows. Same shim as
# test_dwell.py: the module's `time` answers monotonic() from a number we move by hand and
# delegates everything else to the real module.
class _Clock:
    def __init__(self, t0=1000.0):
        self.t = t0

    def monotonic(self):
        return self.t

    def advance(self, sec):
        self.t += sec

    def __getattr__(self, name):
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
    """The button as this engine reads it: a LEVEL plus whether anything said so recently."""

    def __init__(self, armed=True):
        self.armed = armed
        self.down = False
        self.fresh = True

    def button_hold_state(self, max_age=0.6):
        return (self.down and self.fresh), self.fresh


class _RecEmitter:
    def __init__(self):
        self.taps = []

    def tap(self, spec):
        self.taps.append(spec)
        return True


SL4 = [{"label": "Góra", "spec": "up"}, {"label": "Prawo", "spec": "right"},
       {"label": "Dół", "spec": "down"}, {"label": "Lewo", "spec": "left"}]


def _mk(slices=None, armed=True, arm=True, **cfg):
    """A capsule with the wheel switched on and four slices. Returns (engine, emitter, trig).

    `arm` STAWIA KAPSEL W ŚRODKU, zanim test cokolwiek zrobi. Silnik startuje ROZBROJONY (patrz
    RadialMenu._lean_home): kapsel, który ani razu nie powiedział „stoję prosto", nie ma prawa
    otworzyć koła zastanym pochyleniem — inaczej głowa przechylona w chwili włączenia koła
    wystrzeliwuje wycinek, zanim człowiek cokolwiek zrobi. Ręka trzymająca kapsel przed
    gestem jest właśnie w środku, więc każdy test zaczyna tam, gdzie zaczyna człowiek. Testy
    SAMEGO progu (sekcja „próg uzbrojenia") budują silnik z arm=False."""
    em = _RecEmitter()
    tr = _StubTrig(armed=armed)
    w = rf.RadialMenu(_StubB(), emitter=em, trig=tr)
    base = {"enabled": True, "holdMs": 300.0,
            "slices": [dict(s) for s in (SL4 if slices is None else slices)]}
    base.update(cfg)
    w.set_config(base)
    if arm:
        _run(w, 100, pose=CENTRE)
    return w, em, tr


def _lean(deg_roll, deg_pitch):
    """A pose the way PoseFilter hands one over: signed degrees per axis."""
    return {"tilt": math.hypot(deg_roll, deg_pitch), "twist": 0.0,
            "pitch": float(deg_pitch), "roll": float(deg_roll)}


def _run(w, ms, pose=None, dt=0.02):
    """Drive the engine for `ms` of (fake) time, refreshing the pose every tick the way a
    connected capsule would (the engine drops a pose older than 0.6 s)."""
    n = max(1, int(round((ms / 1000.0) / dt)))
    for _ in range(n):
        CLK.advance(dt)
        if pose is not None:
            w.on_pose(dict(pose))
        w.tick()


# Full lean, straight at each of the four compass points. Slice 0 sits at 12 o'clock and they run
# clockwise, so "up" means pitch NEGATIVE (screen convention: +y is down).
UP = _lean(0, -28)
RIGHT = _lean(28, 0)
DOWN = _lean(0, 28)
LEFT = _lean(-28, 0)
CENTRE = _lean(0, 0)


# =================================================================== a. sanitize ===============
print("--- the settings are sanitised (a typo must not reach the emitter) ---")
S = rf.RadialMenu.sanitize
c = S({"holdMs": 10, "slices": SL4})
check("a hold shorter than the minimum is raised to it", c["holdMs"] == 150.0, c["holdMs"])
c = S({"holdMs": 99999, "slices": SL4})
check("a hold past the ceiling is cut to it", c["holdMs"] == 5000.0, c["holdMs"])
c = S({"holdMs": "nonsense", "slices": SL4})
check("an unreadable hold leaves the default alone", c["holdMs"] == 300.0, c["holdMs"])

c = S({"slices": [{"label": "s%d" % i, "spec": "a"} for i in range(17)]})
check("a list longer than sixteen slices is cut to sixteen", len(c["slices"]) == 16,
      len(c["slices"]))
c = S({"slices": [{"label": "s%d" % i, "spec": "a"} for i in range(30)]})
check("...however much longer it was", len(c["slices"]) == 16, len(c["slices"]))
c = S({"enabled": True, "slices": [{"label": "s%d" % i, "spec": "a"} for i in range(12)]})
check("a twelve-slice wheel is a perfectly ordinary wheel",
      c["enabled"] is True and len(c["slices"]) == 12, len(c["slices"]))

c = S({"slices": [{"label": "x" * 90, "spec": "y" * 90}]})
check("an over-long label is trimmed", len(c["slices"][0]["label"]) == 24, c["slices"][0]["label"])
check("an over-long action is trimmed", len(c["slices"][0]["spec"]) == 40, c["slices"][0]["spec"])

c = S({"slices": [{"label": "Warstwa", "spec": "layer:2"}, {"label": "B", "spec": "b"}]})
check("a `layer:` action is refused — a wheel does not reshuffle the mapping under itself",
      c["slices"][0]["spec"] == "", c["slices"][0])
check("...and the slice itself survives, so nothing silently disappears from the list",
      len(c["slices"]) == 2 and c["slices"][0]["label"] == "Warstwa", c["slices"])

c = S({"enabled": True, "slices": SL4, "wheelNonsense": 7, "holdMs": 400})
check("a key nobody declared is dropped, not stored", "wheelNonsense" not in c, sorted(c))
check("the declared keys are all there",
      sorted(c) == ["alwaysOn", "configName", "confirm", "confirmMs", "deadzone", "enabled",
                    "holdMs", "iconChips", "look", "showWhere", "slices", "subOpenMs",
                    "submenuMode", "trigger", "triggerAxis", "triggerMag"], sorted(c))

# THE DEAD ZONE is a setting now. The default has to be bit-identical to the constant it replaced,
# or every wheel in the world moves under its owner the day they update.
check("the middle is exactly as big as it always was, unless somebody says otherwise",
      rf.RadialMenu.DEFAULTS["deadzone"] == rf.RadialMenu.DEAD, rf.RadialMenu.DEFAULTS["deadzone"])
check("a dead zone smaller than the floor is raised to it",
      S({"deadzone": 0.001})["deadzone"] == rf.RadialMenu.DEAD_MIN, S({"deadzone": 0.001}))
check("...and one past the ceiling is cut to it",
      S({"deadzone": 9})["deadzone"] == rf.RadialMenu.DEAD_MAX, S({"deadzone": 9}))
check("...and an unreadable one leaves the default alone",
      S({"deadzone": "duża"})["deadzone"] == rf.RadialMenu.DEAD, S({"deadzone": "duża"}))

# HOW THE WHEEL IS WORKED. Five ways, and the one everybody already has must survive the arrival
# of the other four untouched — that is the whole reason `release` is the default.
check("a config that says nothing about it is worked the old way",
      rf.RadialMenu.DEFAULTS["confirm"] == "release", rf.RadialMenu.DEFAULTS)
for m in ("release", "tilt-hold", "tilt-click", "click", "cycle"):
    check("mode '%s' is kept as asked" % m, S({"confirm": m, "slices": SL4})["confirm"] == m)
c = S({"confirm": "teleportacja", "slices": SL4})
check("a mode nobody implements falls back to the working one, not to nothing",
      c["confirm"] == "release", c["confirm"])
check("a wait shorter than the floor is raised to it",
      S({"confirmMs": 1})["confirmMs"] == 200.0, S({"confirmMs": 1})["confirmMs"])
check("...and one past the ceiling is cut to it",
      S({"confirmMs": 99999})["confirmMs"] == 3000.0, S({"confirmMs": 99999})["confirmMs"])
check("...and an unreadable one leaves the default alone",
      S({"confirmMs": "kiedyś"})["confirmMs"] == 600.0, S({"confirmMs": "kiedyś"})["confirmMs"])

# THE MACRO on a slice. Same field, same ceiling and same language as a rule's — see _fire().
c = S({"slices": [{"label": "A", "spec": "a", "sequence": "ctrl+c; wait 200; ctrl+v"},
                  {"label": "B", "spec": "b"}]})
check("a slice keeps the macro it was given",
      c["slices"][0]["sequence"] == "ctrl+c; wait 200; ctrl+v", c["slices"][0])
check("...and a slice without one carries an empty macro rather than nothing",
      c["slices"][1].get("sequence") == "", c["slices"][1])
c = S({"slices": [{"spec": "a", "sequence": "b;" * 400}]})
check("an over-long macro is trimmed to the same 500 a rule's is",
      len(c["slices"][0]["sequence"]) == 500, len(c["slices"][0]["sequence"]))
c = S({"slices": [{"spec": "layer:2", "sequence": "layer:2; a"}, {"spec": "b"}]})
check("`layer:` is still refused as a slice's plain action", c["slices"][0]["spec"] == "",
      c["slices"][0])
check("...but is allowed INSIDE a macro, exactly as it is in a rule's macro",
      c["slices"][0]["sequence"] == "layer:2; a", c["slices"][0])

# ILE RAZY NACISNĄĆ (`rep`). Klawisz głośności przesuwa suwak Windows o 2% na naciśnięcie, a koło
# zamyka się po wyborze — bez tego pola „Ciszej" wskazane raz było niesłyszalne i wyglądało na
# zepsute. Pole jest OPCJONALNE: jedynki nie zapisujemy, żeby
# koło sprzed tej zmiany wracało z sanitizera bajt w bajt takie, jakie przyszło.
c = S({"slices": [{"label": "Ciszej", "spec": "media_volume_down", "rep": 5},
                  {"label": "Wycisz", "spec": "media_volume_mute"},
                  {"label": "Raz", "spec": "a", "rep": 1},
                  {"label": "Dużo", "spec": "b", "rep": 999},
                  {"label": "Bzdura", "spec": "c", "rep": "pięć"}]})
check("a slice keeps the number of presses it was given", c["slices"][0]["rep"] == 5, c["slices"][0])
check("...a slice that never asked for one has no such field at all",
      "rep" not in c["slices"][1], c["slices"][1])
check("...and neither has one that asked for a single press — 1 IS an ordinary slice",
      "rep" not in c["slices"][2], c["slices"][2])
check("a count past the ceiling is cut to it",
      c["slices"][3]["rep"] == rf.RadialMenu.REP_MAX, c["slices"][3])
check("...and an unreadable one leaves the slice as an ordinary one",
      "rep" not in c["slices"][4], c["slices"][4])

c = S({"enabled": True, "slices": [{"label": "sam", "spec": "a"}]})
check("one slice is not a choice — it cannot be switched on", c["enabled"] is False, c)
c = S({"enabled": True, "slices": []})
check("...and neither can an empty wheel", c["enabled"] is False, c)
check("the default is OFF — nothing opens for anybody by surprise",
      rf.RadialMenu.DEFAULTS["enabled"] is False)

w, _, _ = _mk()
w.set_config({"slices": [{"spec": "a"}, {"spec": "b"}]})
check("a slice with no label of its own is kept, empty",
      w.get_config()["slices"][0]["label"] == "", w.get_config()["slices"])
check("the config handed back is a COPY — editing it cannot reach into the engine",
      w.get_config()["slices"] is not w.get_config()["slices"])

# =================================================================== b. sectors ================
print("\n--- which slice the lean points at ---")
w, _, _ = _mk()
SC = w._sector
for n in (2, 4, 8, 12, 16):
    step = 360.0 / n
    bad = []
    for i in range(n):
        a = math.radians(i * step)            # the CENTRE of slice i, measured from 12 o'clock
        nx, ny = 0.9 * math.sin(a), -0.9 * math.cos(a)
        idx, mag, _ang = SC(nx, ny, n, None)
        if idx != i:
            bad.append((i, idx))
    check("n=%d: every slice centre picks its own slice" % n, not bad, bad)

idx, mag, _ = SC(0.0, -0.9, 4, None)
check("straight up is slice 0 (12 o'clock)", idx == 0, idx)
idx, _, _ = SC(0.9, 0.0, 4, None)
check("straight right is slice 1 (clockwise)", idx == 1, idx)
idx, _, _ = SC(0.0, 0.9, 4, None)
check("straight down is slice 2", idx == 2, idx)
idx, _, _ = SC(-0.9, 0.0, 4, None)
check("straight left is slice 3", idx == 3, idx)

# the dead zone: the middle chooses nothing, and once something IS chosen it holds a bit longer
idx, mag, _ = SC(0.0, -0.1, 4, None)
check("a lean inside the dead zone chooses nothing", idx == -1, idx)
idx, _, _ = SC(0.0, -(rf.RadialMenu.DEAD - 0.02), 4, None)
check("...right up to the edge of it", idx == -1, idx)
idx, _, _ = SC(0.0, -(rf.RadialMenu.DEAD + 0.02), 4, None)
check("...and just past it, the slice fires", idx == 0, idx)
hold_r = rf.RadialMenu.DEAD * rf.RadialMenu.REL
idx, _, _ = SC(0.0, -(hold_r + 0.02), 4, 0)
check("coming back INSIDE the dead zone keeps the choice until 60% of it (anti-flicker)",
      idx == 0, idx)
idx, _, _ = SC(0.0, -(hold_r - 0.02), 4, 0)
check("...and below that it lets go", idx == -1, idx)

# angular hysteresis on a border between two slices (n=4: the border between 0 and 1 is at 45 deg)
def _at(deg, r=0.9):
    a = math.radians(deg)
    return r * math.sin(a), -r * math.cos(a)

idx, _, _ = SC(*_at(44.0), 4, None)
check("a fresh hand just before the border picks the earlier slice", idx == 0, idx)
idx, _, _ = SC(*_at(48.0), 4, 0)
check("a wrist wobbling 3 deg past the border does NOT switch slices", idx == 0, idx)
idx, _, _ = SC(*_at(60.0), 4, 0)
check("...but a real move past it does", idx == 1, idx)

# ...and on a CROWDED wheel the sticky band has to shrink with the slices it protects: a band
# wider than half a slice would mean overshooting a whole neighbour to reach the one you want.
H = rf.RadialMenu._hyst
for n in (2, 4, 8, 12, 16):
    check("n=%d: the sticky band is at most half a slice" % n, H(n) <= (360.0 / n) / 2.0 + 1e-9,
          (H(n), 360.0 / n))
check("on ordinary wheels it is still exactly the 7 degrees it always was",
      H(4) == rf.RadialMenu.ANG_HYST and H(8) == rf.RadialMenu.ANG_HYST, (H(4), H(8)))
# a sixteen-slice wheel: neighbouring centres must be told apart, sticky band and all
w16, _, _ = _mk(slices=[{"label": "s%d" % i, "spec": "k%d" % i} for i in range(16)])
bad16 = []
for i in range(16):
    a = math.radians(i * 22.5)
    idx, _, _ = w16._sector(0.9 * math.sin(a), -0.9 * math.cos(a), 16, (i - 1) % 16)
    if idx != i:
        bad16.append((i, idx))
check("n=16: aiming at a slice centre reaches it even from the slice next door", not bad16, bad16)

# the dead zone as a SETTING: the same geometry, moved
print("\n--- the middle is as big as you say it is ---")
w2, _, _ = _mk(deadzone=0.6)
check("a wide middle is what the engine reads", abs(w2._dead() - 0.6) < 1e-9, w2._dead())
idx, _, _ = w2._sector(0.0, -0.5, 4, None)
check("...so a lean that used to choose now chooses nothing", idx == -1, idx)
idx, _, _ = w2._sector(0.0, -0.7, 4, None)
check("...and it takes a bigger one to get out of it", idx == 0, idx)
w3, _, _ = _mk(deadzone=0.12)
idx, _, _ = w3._sector(0.0, -0.2, 4, None)
check("a narrow middle decides sooner", idx == 0, idx)

# ...and the opening bar of the lean-opened modes has to stay clear of it
w4, _, _ = _mk(confirm="tilt-hold")
check("by default the opening bar is the plain constant",
      abs(w4._open_bar() - rf.RadialMenu.OPEN_MAG) < 1e-9, w4._open_bar())
w5, _, _ = _mk(confirm="tilt-hold", deadzone=0.7)
check("a wide middle pushes the opening bar above it, not into it",
      w5._open_bar() >= 0.7 + rf.RadialMenu.OPEN_GAP - 1e-9, (w5._open_bar(), w5._dead()))
check("...and never past a lean a wrist can actually reach",
      w5._open_bar() <= rf.RadialMenu.OPEN_CAP, w5._open_bar())
check("...so there is always room between 'nothing chosen' and 'open the wheel'",
      w5._open_bar() > w5._dead(), (w5._open_bar(), w5._dead()))
w6, _, _ = _mk(confirm="tilt-hold", deadzone=0.7)
_run(w6, 600, pose=_lean(0, -24))     # 0.8 of the rim: enough at the default, not here
check("a lean that would open the default wheel does not open a wide-middle one",
      w6.open is False, (w6.open, w6._open_bar()))
_run(w6, 600, pose=_lean(0, -29))     # ~0.97
check("...and a bigger one still does", w6.open is True, w6.open)

# =================================================================== c. the hold ===============
print("\n--- how long the button has to be held ---")
w, em, tr = _mk(holdMs=300)
tr.down = True
_run(w, 200, pose=UP)
check("a press shorter than the hold does not open the wheel", w.open is False, w.open)
tr.down = False
_run(w, 60, pose=UP)
check("...and letting go early sends nothing", em.taps == [], em.taps)

w, em, tr = _mk(holdMs=300)
tr.down = True
_run(w, 400, pose=CENTRE)
check("holding past it opens the wheel", w.open is True, w.open)
check("...pointing at nothing to begin with", w.idx == -1, w.idx)
_run(w, 200, pose=RIGHT)
check("leaning picks a slice", w.idx == 1, w.idx)

# one press = one wheel. Letting go closes it; it must not spring back open on the same press.
w, em, tr = _mk(holdMs=200)
tr.down = True
_run(w, 400, pose=UP)
check("the wheel is open", w.open is True)
tr.down = False
_run(w, 40, pose=UP)
check("letting go closes it", w.open is False)
_run(w, 600, pose=UP)
check("...and it stays closed while nothing is pressed", w.open is False)
check("exactly one action went out", em.taps == ["up"], em.taps)

# =================================================================== d. the choice =============
print("\n--- letting go is what decides ---")
for pose, want, name in ((UP, "up", "up"), (RIGHT, "right", "right"),
                         (DOWN, "down", "down"), (LEFT, "left", "left")):
    w, em, tr = _mk(holdMs=200)
    tr.down = True
    _run(w, 400, pose=pose)
    tr.down = False
    _run(w, 40, pose=pose)
    check("leaning %s and letting go sends exactly its action" % name,
          em.taps == [want], em.taps)

w, em, tr = _mk(holdMs=200)
tr.down = True
_run(w, 400, pose=RIGHT)
_run(w, 200, pose=CENTRE)          # think better of it and come back to the middle
check("coming back to the middle un-picks the slice", w.idx == -1, w.idx)
tr.down = False
_run(w, 40, pose=CENTRE)
check("letting go in the middle sends NOTHING (that is the escape hatch)", em.taps == [], em.taps)

w, em, tr = _mk(holdMs=200)
tr.down = True
_run(w, 400, pose=UP)
_run(w, 200, pose=DOWN)            # change your mind while it is open
tr.down = False
_run(w, 40, pose=DOWN)
check("the slice you are on when you let go is the one that goes",
      em.taps == ["down"], em.taps)

# --- ILE RAZY NACISNĄĆ -------------------------------------------------------------------------
# Seria leci OSOBNYM WĄTKIEM (pętla koła nie może spać w środku wyboru), więc test na nią czeka
# zamiast zakładać, że zdążyła. Zegar w tym pliku jest sztuczny, ale `time.sleep` w serii jest
# prawdziwy — stąd czekanie w prawdziwych sekundach, z sufitem, żeby awaria nie wisiała.


def _wait_taps(em, n, sec=2.0):
    end = _real_time.monotonic() + sec
    while len(em.taps) < n and _real_time.monotonic() < end:
        _real_time.sleep(0.01)
    return em.taps


REP3 = [{"label": "Ciszej", "spec": "media_volume_down", "rep": 3},
        {"label": "Prawo", "spec": "right"},
        {"label": "Wycisz", "spec": "media_volume_mute"},
        {"label": "Lewo", "spec": "left"}]

w, em, tr = _mk(slices=REP3, holdMs=200)
tr.down = True
_run(w, 400, pose=UP)
tr.down = False
_run(w, 40, pose=UP)
check("a slice that asks for three presses sends three",
      _wait_taps(em, 3) == ["media_volume_down"] * 3, em.taps)

w, em, tr = _mk(slices=REP3, holdMs=200)
tr.down = True
_run(w, 400, pose=DOWN)
tr.down = False
_run(w, 40, pose=DOWN)
_real_time.sleep(0.2)
check("...while the slice beside it, without the field, still sends exactly one",
      em.taps == ["media_volume_mute"], em.taps)

# STOP AWARYJNY W POŁOWIE SERII ma ją urwać. Bez tego rozbrojony kapsel dosyłałby resztę
# naciśnięć — cicho, bo seria leci już własnym wątkiem i nikt jej nie pilnuje.
w, em, tr = _mk(slices=[{"label": "Dużo", "spec": "media_volume_down", "rep": 12},
                        {"label": "Prawo", "spec": "right"},
                        {"label": "Dół", "spec": "down"}, {"label": "Lewo", "spec": "left"}],
                holdMs=200)
tr.down = True
_run(w, 400, pose=UP)
tr.down = False
_run(w, 40, pose=UP)
_wait_taps(em, 2)                  # seria ruszyła
tr.armed = False                   # …i w tym momencie ktoś naciska stop awaryjny
_real_time.sleep(0.35)             # dłużej, niż zajęłoby dosłanie reszty
check("the emergency stop cuts a burst short instead of letting it finish",
      0 < len(em.taps) < 12, em.taps)

# ============================================================= e. the gates ====================
print("\n--- what is allowed to leave ---")
w, em, tr = _mk(holdMs=200, armed=False)
tr.down = True
_run(w, 400, pose=UP)
check("a capsule that is not armed still SHOWS the wheel", w.open is True, w.open)
check("...and still shows which slice is picked", w.idx == 0, w.idx)
tr.down = False
_run(w, 40, pose=UP)
check("...but nothing goes out of it", em.taps == [], em.taps)

w, em, tr = _mk(holdMs=200, enabled=False)
tr.down = True
_run(w, 800, pose=UP)
check("switched off, the engine is completely passive", w.open is False, w.open)
tr.down = False
_run(w, 40, pose=UP)
check("...and sends nothing", em.taps == [], em.taps)
check("...and says nothing on the wire either",
      [e for e in w.b.events if e.get("t") == "wheel"] == [], w.b.events)

w, em, tr = _mk(holdMs=200, slices=[{"label": "Nic", "spec": ""},
                                    {"label": "Coś", "spec": "b"}])
tr.down = True
_run(w, 400, pose=UP)
check("a slice with no action still highlights", w.idx == 0, w.idx)
tr.down = False
_run(w, 40, pose=UP)
check("...but letting go on it sends nothing", em.taps == [], em.taps)

# a capsule that stops answering did NOT let go
w, em, tr = _mk(holdMs=200)
tr.down = True
_run(w, 400, pose=UP)
check("the wheel is open before the capsule drops out", w.open is True)
tr.fresh = False
_run(w, 60, pose=UP)
check("losing the button reading closes the wheel", w.open is False)
check("...WITHOUT sending anything — walking out of range is not a choice",
      em.taps == [], em.taps)

# editing the slices while it is open must not commit whatever the list happens to say
w, em, tr = _mk(holdMs=200)
tr.down = True
_run(w, 400, pose=UP)
w.set_config({"slices": [{"label": "Inne", "spec": "x"}, {"label": "Y", "spec": "y"}]})
check("changing the settings closes an open wheel", w.open is False, w.open)
tr.down = False
_run(w, 40, pose=UP)
check("...and sends nothing while it does", em.taps == [], em.taps)

# ============================================================= f. what the panel is told =======
print("\n--- the live packets ---")
w, em, tr = _mk(holdMs=200)
tr.down = True
_run(w, 400, pose=CENTRE)
evs = [e for e in w.b.events if e.get("t") == "wheel"]
check("opening says so, exactly once", len(evs) == 1 and evs[0]["open"] is True, evs)
check("...and carries the labels to draw",
      evs[0]["labels"] == ["Góra", "Prawo", "Dół", "Lewo"], evs[0].get("labels"))
check("...and how many slices there are", evs[0]["n"] == 4, evs[0].get("n"))
_run(w, 600, pose=RIGHT)
evs = [e for e in w.b.events if e.get("t") == "wheel"]
check("moving the lean reports the new slice", evs[-1]["idx"] == 1, evs[-1])
check("...and how far out it is", 0.5 < float(evs[-1]["mag"]) <= 1.0, evs[-1].get("mag"))
n_moving = len(evs)
_run(w, 1000, pose=RIGHT)          # a whole second of holding perfectly still
evs = [e for e in w.b.events if e.get("t") == "wheel"]
check("a still hand does not flood the stream", len(evs) - n_moving <= 2, len(evs) - n_moving)
tr.down = False
_run(w, 40, pose=RIGHT)
evs = [e for e in w.b.events if e.get("t") == "wheel"]
check("closing ALWAYS reports, throttle or no throttle", evs[-1]["open"] is False, evs[-1])
check("...and the close packet un-picks the slice, so nothing stays lit", evs[-1]["idx"] == -1,
      evs[-1])

w, em, tr = _mk(holdMs=200)
tr.down = True
_run(w, 400, pose=CENTRE)
tr.down = False
_run(w, 40, pose=CENTRE)
evs = [e for e in w.b.events if e.get("t") == "wheel"]
check("a cancelled wheel still tells the panel to rub itself out",
      evs[-1]["open"] is False, evs[-1])

# ===================================================== g. the other four modes =================
# WHY THERE ARE FIVE. "Hold the button down and lean the same hand" asks for two things at once,
# and a hand that cannot give both cannot use the wheel at all. Each mode below takes one of those
# two away: tilt-hold drops the button entirely, click drops the holding, cycle drops the aiming.
# What every one of them has to prove is the same three things: that it opens ONLY when it should,
# that it sends EXACTLY ONE action, and that backing out sends none.
print("\n--- 2. Pochyl i przytrzymaj (no button at all) ---")
UP_S = _lean(0, -15)        # half a lean: past the dead zone, nowhere near the opening bar


def _cycle_home(w, ms=200):
    """Bring the capsule back to the middle. A wheel that has just closed will not open again
    until the lean comes home — otherwise letting go of the choice would immediately re-open."""
    _run(w, ms, pose=CENTRE)


w, em, tr = _mk(confirm="tilt-hold", confirmMs=300)
_run(w, 1000, pose=UP_S)
check("an ordinary lean does NOT open it — the opening bar is much higher on purpose",
      w.open is False, (w.open, rf.RadialMenu.OPEN_MAG))
check("...and sends nothing", em.taps == [], em.taps)
_run(w, 100, pose=UP)
check("a big lean held for less than the opening time is not an opening yet", w.open is False)
_run(w, 120, pose=UP)
check("...held past it, the wheel appears", w.open is True)
check("...pointing at the slice you leaned towards", w.idx == 0, w.idx)
check("nothing has gone out yet — appearing is not choosing", em.taps == [], em.taps)
_run(w, 400, pose=UP)
check("keeping the same slice for the wait sends it", em.taps == ["up"], em.taps)
check("...and the wheel goes away", w.open is False, w.open)
_run(w, 600, pose=UP)
check("...exactly once, however long you keep leaning", em.taps == ["up"], em.taps)

# the countdown belongs to a slice, not to the wheel
w, em, tr = _mk(confirm="tilt-hold", confirmMs=400)
_run(w, 200, pose=UP)          # ~150 of this opens the wheel, the rest starts counting
check("open on the first slice", w.open is True and w.idx == 0, (w.open, w.idx))
_run(w, 200, pose=UP)          # ~250 of the 400 done...
check("...and not sent yet", em.taps == [], em.taps)
_run(w, 200, pose=RIGHT)       # ...and then the hand moves
check("changing slice zeroes the count instead of inheriting it", em.taps == [], em.taps)
_run(w, 300, pose=RIGHT)       # now ~480 on the new one
check("...and the new slice sends when ITS own wait is up", em.taps == ["right"], em.taps)

w, em, tr = _mk(confirm="tilt-hold", confirmMs=400)
_run(w, 300, pose=UP)
_run(w, 200, pose=UP)
_run(w, 200, pose=CENTRE)
check("coming back to the middle puts the wheel away", w.open is False, w.open)
check("...with nothing sent — that is how you back out of this one", em.taps == [], em.taps)

w, em, tr = _mk(confirm="tilt-hold", confirmMs=300)
tr.fresh = False               # a capsule that never reports its button at all
_run(w, 300, pose=UP)
check("a capsule that says nothing about its button can still use this mode", w.open is True)
_run(w, 400, pose=UP)
check("...and can still choose with it", em.taps == ["up"], em.taps)

print("\n--- próg uzbrojenia: koło otwiera GEST, nie zastane pochylenie ---")
# ZGŁOSZENIE (handoff „koło: próg uzbrojenia", 2026-08-27): koło otwiera się i od razu wybiera.
# Zmierzone na silniku przed poprawką: kapsel wychylony od pierwszej klatki, nigdy nie postawiony
# prosto, po 1,5 s wysyłał `up` — nikt niczego nie wybierał, po prostu tak leżał.
#
# NIEZMIENNIK: nie da się wejść w OPEN bez wcześniejszego ARMED. Uzbraja WYŁĄCZNIE świeża pozycja
# w martwej strefie, więc ani cisza kapsla, ani zastany przechył nie są zgodą na cokolwiek.
# Dlaczego to nie jest kaprys: kapsel jeździ na czapce i przy głowie, a tam „ręka spoczywa
# prosto" nie jest stanem domyślnym — jest gestem, który trzeba wykonać.
# „cycle" NIE MA GO JUŻ NA LIŚCIE (2026-09-06): koła klikanego nie otwiera pochylenie, tylko
# kliknięcie, więc zastany przechył nie ma tam czego uzbrajać. Że i tam kapsel wychylony od startu
# niczego nie robi, sprawdza osobno sekcja trybu klikanego niżej.
for _m in ("tilt-hold", "tilt-click"):
    _pose = UP
    w, em, tr = _mk(confirm=_m, confirmMs=300, arm=False, alwaysOn=False)
    _run(w, 1500, pose=_pose)
    check("„%s”: kapsel wychylony od startu nie otwiera koła" % _m, w.open is False, w.open)
    check("...i nic nie wysyła", em.taps == [], em.taps)
    _run(w, 200, pose=CENTRE)                    # dopiero TO jest uzbrojeniem
    _run(w, 300, pose=_pose)
    check("...a po postawieniu kapsla prosto ten sam gest otwiera je normalnie", w.open is True,
          w.open)

# Milczący kapsel nie uzbraja. _vec() oddaje ciszę jako (0,0), więc bez warunku świeżości „nie
# wiem, gdzie jest ręka" czytałoby się jak „ręka stoi w środku" — i pierwszy pakiet z przechyłem
# otwierałby koło.
w, em, tr = _mk(confirm="tilt-hold", confirmMs=300, arm=False)
_run(w, 1000, pose=None)                         # kapsel nie mówi nic
_run(w, 1500, pose=UP)
check("cisza kapsla nie uzbraja progu", w.open is False and em.taps == [], (w.open, em.taps))

# Włączenie koła przełącznikiem trafia na rękę trzymającą kapsel tak, jak akurat go trzymała.
w, em, tr = _mk(confirm="tilt-hold", confirmMs=300)
_run(w, 200, pose=CENTRE)
w.set_config({"enabled": True, "holdMs": 300.0, "confirm": "tilt-hold", "confirmMs": 300.0,
              "deadzone": 0.4, "slices": [dict(s) for s in SL4]})
_run(w, 1500, pose=UP)
check("zmiana ustawień rozbraja próg — koło nie otwiera się pod zastanym pochyleniem",
      w.open is False and em.taps == [], (w.open, em.taps))
_run(w, 200, pose=CENTRE)
_run(w, 300, pose=UP)
check("...i wraca do życia po powrocie do środka", w.open is True, w.open)

print("\n--- 3. Pochyl i kliknij ---")
w, em, tr = _mk(confirm="tilt-click", holdMs=300)
_run(w, 300, pose=RIGHT)
check("a big lean opens it", w.open is True and w.idx == 1, (w.open, w.idx))
_run(w, 1000, pose=RIGHT)
check("...and it waits there without asking the hand for anything", w.open is True)
check("...sending nothing while it waits", em.taps == [], em.taps)
tr.down = True
_run(w, 100, pose=RIGHT)
tr.down = False
_run(w, 40, pose=RIGHT)
check("a click sends the slice being pointed at", em.taps == ["right"], em.taps)
check("...and closes the wheel", w.open is False, w.open)

w, em, tr = _mk(confirm="tilt-click", holdMs=300)
_run(w, 300, pose=LEFT)
_run(w, 200, pose=CENTRE)
check("coming home closes it here too", w.open is False, w.open)
tr.down = True
_run(w, 100, pose=CENTRE)
tr.down = False
_run(w, 40, pose=CENTRE)
check("...and a click that arrives afterwards hits nothing", em.taps == [], em.taps)

print("\n--- 4. Kliknij, pochyl, kliknij ---")


def _click(w, tr, pose, ms=100):
    tr.down = True
    _run(w, ms, pose=pose)
    tr.down = False
    _run(w, 40, pose=pose)


w, em, tr = _mk(confirm="click", holdMs=300)
_click(w, tr, CENTRE)
check("a click opens the wheel", w.open is True, w.open)
check("...pointing at nothing", w.idx == -1, w.idx)
_run(w, 200, pose=DOWN)
check("leaning points at a slice", w.idx == 2, w.idx)
check("...and sends nothing on its own", em.taps == [], em.taps)
_click(w, tr, DOWN)
check("the second click sends it", em.taps == ["down"], em.taps)
check("...and closes the wheel", w.open is False, w.open)
_run(w, 500, pose=DOWN)
check("...once, not once per tick", em.taps == ["down"], em.taps)

w, em, tr = _mk(confirm="click", holdMs=300)
_click(w, tr, CENTRE)
_run(w, 200, pose=LEFT)
_run(w, 200, pose=CENTRE)
_click(w, tr, CENTRE)
check("a second click with the capsule level sends nothing (the escape hatch)",
      em.taps == [], em.taps)
check("...and the wheel is gone", w.open is False, w.open)

w, em, tr = _mk(confirm="click", holdMs=300)
tr.down = True
_run(w, 600, pose=CENTRE)      # a long, "release-mode" press
check("holding the button does NOT open this one — that is what the click is for",
      w.open is False, w.open)
tr.down = False
_run(w, 40, pose=CENTRE)
check("...and letting go of that long press opens nothing either", w.open is False, w.open)
check("...and sends nothing", em.taps == [], em.taps)

w, em, tr = _mk(confirm="click", holdMs=300)
_click(w, tr, CENTRE)
_run(w, 200, pose=UP)
check("open and pointing somewhere", w.open is True and w.idx == 0, (w.open, w.idx))
_run(w, 8200, pose=UP)
check("a wheel left open gives up by itself after %ds" % rf.RadialMenu.OPEN_TIMEOUT,
      w.open is False, w.open)
check("...without sending the thing it happened to be pointing at", em.taps == [], em.taps)

print("\n--- 5. Przelaczaj klikniec1ami (for hands that cannot aim by leaning) ---")
# JEDEN GEST, TRZY ZNACZENIA (2026-09-06): klik budzi, kolejne kliki przesuwają, czekanie wysyła,
# a przytrzymanie wyłącza koło bez wysyłania. Pochylenie NIE ZNACZY TU JUŻ NIC — do tej pory koło
# otwierało się przechyłem w dół, czyli tryb dla rąk, które nie potrafią celować pochyleniem,
# zaczynał się od pochylenia.
w, em, tr = _mk(confirm="cycle", holdMs=300, confirmMs=500, alwaysOn=False)
_run(w, 400, pose=DOWN)
check("leaning down does NOT open it any more", w.open is False, w.open)
_run(w, 400, pose=UP)
check("...and neither does leaning any other way", w.open is False, w.open)
check("...nor does any of it send a thing", em.taps == [], em.taps)
_click(w, tr, CENTRE)
check("a click puts the wheel on screen", w.open is True, w.open)
check("...awake, so the next click already chooses", w._awake is True, w._awake)
check("...with nothing chosen yet — waking is not choosing", w.idx == -1, w.idx)
_run(w, 700, pose=CENTRE)      # dłużej niż confirmMs
check("...and waiting on a wheel nobody has chosen on sends nothing", em.taps == [], em.taps)
check("...and does not close it either — the clock only runs on a choice", w.open is True, w.open)
_click(w, tr, CENTRE)
check("the first click after waking lands on the first slice", w.idx == 0, w.idx)
_click(w, tr, CENTRE)
_click(w, tr, CENTRE)
check("each further click steps one along", w.idx == 2, w.idx)
_run(w, 200, pose=LEFT)
check("leaning does NOT move the choice in this mode", w.idx == 2, w.idx)
_click(w, tr, CENTRE)
_click(w, tr, CENTRE)
check("...and past the last slice it comes round to the first", w.idx == 0, w.idx)
check("nothing has gone out while stepping", em.taps == [], em.taps)
_run(w, 700, pose=CENTRE)
check("waiting after the last click sends the slice you stopped on", em.taps == ["up"], em.taps)
check("...and closes the wheel", w.open is False, w.open)

# PRZYTRZYMANIE = WYJŚCIE. Do 2026-09-06 wysyłało wybór od razu, czyli jedyny gest, który mógł
# wystrzelić akcję przez pomyłkę, robił to samo, co i tak robi czekanie — a tryb nie miał ŻADNEGO
# sposobu na „nie, jednak nic".
w, em, tr = _mk(confirm="cycle", holdMs=300, confirmMs=3000, alwaysOn=False)
_click(w, tr, CENTRE)          # obudzenie
_click(w, tr, CENTRE)
_click(w, tr, CENTRE)
check("stepped to the second slice", w.idx == 1, w.idx)
tr.down = True
_run(w, 400, pose=CENTRE)      # a long press, past holdMs
check("holding the button puts the wheel away instead of sending", em.taps == [], em.taps)
check("...and the wheel is gone", w.open is False, w.open)
tr.down = False
_run(w, 200, pose=CENTRE)
check("...and letting go of that long press does not bring it back",
      w.open is False and em.taps == [], (w.open, em.taps))
_click(w, tr, CENTRE)
check("...while an ordinary click afterwards opens it again", w.open is True, w.open)

# KOŁO OBUDZONE PRZEZ PRZYPADEK zasypia samo — i to jest cała cena pomyłkowego naciśnięcia.
w, em, tr = _mk(confirm="cycle", holdMs=300, confirmMs=400, alwaysOn=False)
_click(w, tr, CENTRE)
check("woken by accident", w.open is True and w.idx == -1, (w.open, w.idx))
_run(w, 3000, pose=CENTRE)
check("...still there while the give-up clock runs", w.open is True, w.open)
_run(w, 6000, pose=CENTRE)
check("...and after %ds of nobody touching it, it goes away" % rf.RadialMenu.OPEN_TIMEOUT,
      w.open is False, w.open)
check("...with nothing sent — no click means no choice was ever made", em.taps == [], em.taps)

# ZEGAR PODDANIA MIERZY BEZCZYNNOŚĆ, nie długość całej rozmowy: przy szesnastu wycinkach i wolnej
# ręce osiem sekund od obudzenia kończyło się w połowie przebierania.
w, em, tr = _mk(confirm="cycle", holdMs=300, confirmMs=2500, alwaysOn=False)
_click(w, tr, CENTRE)
for _ in range(6):
    _run(w, 1800, pose=CENTRE)
    _click(w, tr, CENTRE)
check("clicking slowly for longer than the give-up timer keeps the wheel alive", w.open is True,
      w.open)
check("...and has sent nothing on the way", em.taps == [], em.taps)

print("\n--- „Koło zawsze widoczne” (tylko tryb klikany) ---")
# HANDOFF 2026-08-27, punkt 6: „Włączony: koło stoi na ekranie na stałe." Od 2026-09-06 ten klucz
# odpowiada już TYLKO na pytanie „czy uśpione koło widać": włącza się je klikaniem w obu
# ustawieniach.
w, em, tr = _mk(confirm="cycle", confirmMs=400, holdMs=300)
_run(w, 200, pose=CENTRE)
check("koło stoi od razu, bez żadnego gestu otwarcia", w.open is True, w.open)
check("...ale UŚPIONE: samo stanie na ekranie niczego nie słucha", w._awake is False, w._awake)
check("...z niczym wskazanym — wybór dalej chodzi klikaniem", w.idx == -1, w.idx)
_run(w, 15000, pose=CENTRE)
check("...i nie znika samo po 8 s, bo nie ma czego chować", w.open is True, w.open)
check("...ani nic nie wysyła, kiedy nikt nie kliknął", em.taps == [], em.taps)
_click(w, tr, CENTRE)
check("pierwszy klik BUDZI koło", w._awake is True, w._awake)
check("...i nic przy tym nie wybiera", w.idx == -1, w.idx)
_run(w, 600, pose=CENTRE)
check("...więc odczekanie po samym obudzeniu nie wysyła nic", em.taps == [], em.taps)
_click(w, tr, CENTRE)
check("dopiero następny klik siada na pierwszym wycinku", w.idx == 0, w.idx)
_run(w, 600, pose=CENTRE)
check("odczekanie wysyła wybrany wycinek", em.taps == ["up"], em.taps)
check("...a koło ZOSTAJE na ekranie", w.open is True, w.open)
check("...uśpione, żeby następne przypadkowe naciśnięcie znów tylko budziło",
      w._awake is False, w._awake)
check("...z wyborem zdjętym, żeby czekanie nie wysłało go drugi raz", w.idx == -1, w.idx)
_run(w, 1500, pose=CENTRE)
check("...i rzeczywiście drugi raz nie wysyła", em.taps == ["up"], em.taps)
_click(w, tr, CENTRE)
_click(w, tr, CENTRE)
_click(w, tr, CENTRE)
_run(w, 600, pose=CENTRE)
check("kolejny wybór działa tak samo", em.taps == ["up", "right"], em.taps)

# PRZYTRZYMANIE NAD STOJĄCYM KOŁEM USYPIA JE, ale rysunku nie zdejmuje: nie ma czego zamykać.
w, em, tr = _mk(confirm="cycle", confirmMs=3000, holdMs=300)
_click(w, tr, CENTRE)
_click(w, tr, CENTRE)
check("obudzone i ustawione na pierwszym wycinku", w._awake is True and w.idx == 0,
      (w._awake, w.idx))
tr.down = True
_run(w, 400, pose=CENTRE)
check("przytrzymanie usypia koło", w._awake is False, w._awake)
check("...nie wysyłając niczego", em.taps == [], em.taps)
check("...i zostawiając rysunek na ekranie, bo nie ma czego chować", w.open is True, w.open)
tr.down = False
_run(w, 2000, pose=CENTRE)
check("...a uśpione koło nie zaczyna odliczać samo z siebie", em.taps == [], em.taps)

# KOŁO OBUDZONE PRZEZ PRZYPADEK ZASYPIA SAMO także wtedy, gdy stoi na stałe — inaczej zostałoby
# uzbrojone na zawsze i następne trącenie przycisku już by wybierało.
w, em, tr = _mk(confirm="cycle", confirmMs=400, holdMs=300)
_click(w, tr, CENTRE)
check("obudzone", w._awake is True, w._awake)
_run(w, 9000, pose=CENTRE)
check("...po %ds bez jednego kliknięcia zasypia z powrotem" % rf.RadialMenu.OPEN_TIMEOUT,
      w._awake is False, w._awake)
check("...zostając na ekranie", w.open is True, w.open)
check("...i nic nie wysyłając", em.taps == [], em.taps)

# Wychylenie w tym trybie dalej niczego nie wnosi — także wtedy, gdy koło stoi.
w, em, tr = _mk(confirm="cycle", confirmMs=400, holdMs=300)
_run(w, 400, pose=DOWN)
check("pochylenie nie otwiera drugiego koła ani nic nie wybiera",
      w.open is True and w.idx == -1 and em.taps == [], (w.open, w.idx, em.taps))
check("...ani niczego nie budzi", w._awake is False, w._awake)

# …a w pozostałych czterech trybach klucz nie robi NIC: koło stojące bez przerwy zasłaniałoby grę.
for _m in ("release", "tilt-hold", "tilt-click", "click"):
    w, em, tr = _mk(confirm=_m, confirmMs=400, holdMs=300, alwaysOn=True)
    _run(w, 400, pose=CENTRE)
    check("„%s” nie stoi na stałe — tam pochylenie NIESIE wybór" % _m, w.open is False, w.open)

print("\n--- wyzwalacz z pochylenia (kapsel bez dostępnego przycisku) ---")
# HANDOFF 2026-08-27, punkt 7: ktoś nie jest w stanie kliknąć, ale jest w stanie pochylić — kapsel
# na czapce, przy głowie, przypięty do ubrania. W trybie klikanym wycinki lecą po kolei, więc
# kierunek NIC nie znaczy i wystarczy sygnał dwustanowy. To jest ŹRÓDŁO tego samego naciśnięcia,
# a nie szósty tryb koła.
TR = dict(confirm="cycle", trigger="tilt", confirmMs=800, holdMs=3000)
w, em, tr = _mk(**TR)
tr.fresh = False                     # kapsel, który o przycisku nie mówi NIC
_run(w, 200, pose=CENTRE)
check("kapsel bez przycisku obsługuje ten tryb w całości", w.open is True, w.open)
check("...i nic nie wybrał samym staniem prosto", w.idx == -1 and em.taps == [], (w.idx, em.taps))
_run(w, 200, pose=DOWN)              # pochylenie = naciśnięcie
_run(w, 200, pose=CENTRE)            # powrót = puszczenie
check("pierwsze skinienie BUDZI koło", w._awake is True and w.idx == -1, (w._awake, w.idx))
_run(w, 200, pose=DOWN)
_run(w, 200, pose=CENTRE)
check("...a następne przesuwa wybór o jeden", w.idx == 0, w.idx)
_run(w, 200, pose=LEFT)              # kierunek NIE MA ZNACZENIA
_run(w, 200, pose=CENTRE)
check("...w dowolną stronę, bo kierunek tu nic nie niesie", w.idx == 1, w.idx)
_run(w, 1000, pose=CENTRE)
check("odczekanie wysyła wybrany wycinek", em.taps == ["right"], em.taps)

# HISTEREZA: ręka drżąca DOKŁADNIE na progu nie ma prawa wygenerować serii przełączeń.
w, em, tr = _mk(confirm="cycle", trigger="tilt", triggerMag=0.5, confirmMs=3000, holdMs=3000)
tr.fresh = False
_run(w, 200, pose=CENTRE)
BAR = _lean(0, 15.0)                 # dokładnie 0,50 promienia przy SCALE_DEG=30
for _ in range(12):                  # mikrodrgania wokół progu
    _run(w, 60, pose=_lean(0, 15.3))
    _run(w, 60, pose=_lean(0, 14.7))
check("drżenie na samym progu nie przesuwa wyboru w kółko", w.idx <= 0, w.idx)

# WYBÓR OSI: przy części niepełnosprawności ruch boczny szyi jest niedostępny, więc „dowolny
# kierunek" nie może być jedyną odpowiedzią.
w, em, tr = _mk(confirm="cycle", trigger="tilt", triggerAxis="pitch", triggerMag=0.5,
                confirmMs=3000, holdMs=3000)
tr.fresh = False
_run(w, 200, pose=CENTRE)
_run(w, 200, pose=RIGHT)             # czysty roll — na osi „pitch" ma być niewidzialny
_run(w, 200, pose=CENTRE)
check("przy osi „w przód/w tył” przechył na bok nie jest wyzwoleniem",
      w._awake is False and w.idx == -1, (w._awake, w.idx))
_run(w, 200, pose=DOWN)              # to budzi…
_run(w, 200, pose=CENTRE)
_run(w, 200, pose=DOWN)              # …a to wybiera
_run(w, 200, pose=CENTRE)
check("...a skinienie w dół jest", w.idx == 0, w.idx)

# KAPSEL WYCHYLONY OD STARTU nie ma prawa nic obudzić: wychylenie zastane to pozycja, nie gest.
# W trybie klikanym pilnuje tego to samo, co wszędzie indziej — naciśnięcie dłuższe niż `holdMs`
# jest przytrzymaniem, a przytrzymanie nad uśpionym kołem przepada razem z całym naciśnięciem.
w, em, tr = _mk(confirm="cycle", trigger="tilt", triggerAxis="pitch", triggerMag=0.5,
                confirmMs=3000, holdMs=300, arm=False)
tr.fresh = False
_run(w, 2000, pose=DOWN)             # głowa pochylona od pierwszej klatki
check("kapsel wychylony od startu nie budzi koła", w._awake is False, w._awake)
_run(w, 300, pose=CENTRE)            # dopiero wyprostowanie kończy to naciśnięcie
check("...ani nie budzi go samo wyprostowanie", w._awake is False, w._awake)
_run(w, 200, pose=DOWN)
_run(w, 200, pose=CENTRE)
check("...a dopiero świeże skinienie", w._awake is True, w._awake)
check("...i nic po drodze nie poszło w świat", em.taps == [], em.taps)

# Wyzwalacz z pochylenia WYMUSZA koło stojące na stałe: kapsel bez dostępnego przycisku ma jeden
# sygnał i przy schowanym kole nie ma jak sprawdzić, czy skinienie w ogóle przechodzi.
w, em, tr = _mk(confirm="cycle", trigger="tilt", alwaysOn=False, holdMs=3000)
tr.fresh = False
_run(w, 200, pose=CENTRE)
check("koło stoi mimo wyłączonego „zawsze widoczne”, bo bez rysunku nie widać, czy sygnał przechodzi",
      w.open is True, w.open)

# …i nic z tego nie dotyczy pozostałych czterech trybów: tam przycisk i pochylenie mówią o czym
# innym, więc zlanie ich w jedno zabrałoby jedną z dwóch odpowiedzi.
w, em, tr = _mk(confirm="tilt-click", trigger="tilt", holdMs=300)
_run(w, 300, pose=RIGHT)
check("w „Pochyl i kliknij” pochylenie dalej tylko WSKAZUJE", w.open is True and em.taps == [],
      (w.open, em.taps))
_run(w, 600, pose=RIGHT)
check("...i samo z siebie nic nie wysyła", em.taps == [], em.taps)

# ===================================================== h. what the panel is told, per mode =====
print("\n--- the live packets carry the mode and the countdown ---")
w, em, tr = _mk(confirm="tilt-hold", confirmMs=1000)
_run(w, 300, pose=UP)
evs = [e for e in w.b.events if e.get("t") == "wheel"]
check("every packet says how the wheel is being worked",
      all(e.get("confirm") == "tilt-hold" for e in evs), evs[0])
_run(w, 500, pose=UP)
evs = [e for e in w.b.events if e.get("t") == "wheel" and e.get("open")]
cds = [float(e.get("cd") or 0) for e in evs]
check("the countdown is reported as it fills", max(cds) > 0.3, max(cds) if cds else None)
check("...and never past full", max(cds) <= 1.0, max(cds))
check("...climbing rather than jumping (the ring has to look continuous)",
      len([c for c in cds if 0.05 < c < 0.95]) >= 4, cds)

w, em, tr = _mk(confirm="cycle", confirmMs=800, holdMs=300)
_run(w, 300, pose=DOWN)
_run(w, 200, pose=CENTRE)
evs = [e for e in w.b.events if e.get("t") == "wheel"]
check("`cycle` says outright that the choice is clicked, not leaned",
      evs[-1].get("cyc") is True, evs[-1])
_run(w, 100, pose=LEFT)
evs = [e for e in w.b.events if e.get("t") == "wheel" and e.get("open")]
check("...and sends no needle, so the drawing cannot point at the wrong slice",
      float(evs[-1].get("mag") or 0) == 0.0, evs[-1])
w, em, tr = _mk(holdMs=200)
tr.down = True
_run(w, 400, pose=RIGHT)
evs = [e for e in w.b.events if e.get("t") == "wheel"]
check("the original mode still names itself in the packet",
      evs[-1].get("confirm") == "release", evs[-1])
check("...and still carries the needle it always did",
      float(evs[-1].get("mag") or 0) > 0.5, evs[-1])
check("...and says how big the middle is, so no drawing has to guess",
      abs(float(evs[-1].get("dz") or 0) - rf.RadialMenu.DEAD) < 1e-6, evs[-1].get("dz"))
w, em, tr = _mk(holdMs=200, deadzone=0.55)
tr.down = True
_run(w, 400, pose=RIGHT)
evs = [e for e in w.b.events if e.get("t") == "wheel"]
check("...the one that is actually set, not the built-in one",
      abs(float(evs[-1].get("dz") or 0) - 0.55) < 1e-6, evs[-1].get("dz"))

# ===================================================== i. a slice that runs a MACRO ============
# The point of this section is NOT "a macro works" — TriggerEngine has its own tests for that.
# It is that the wheel does not GROW ITS OWN macro runner: the steps below are executed by the
# rules' machinery, through a real TriggerEngine, which is why this test builds one instead of
# the stub the rest of the file uses.
print("\n--- a wycinek that runs a macro ---")


class _SeqEmitter:
    """Records what a macro actually does, in order: taps, and holds as a pair."""

    def __init__(self):
        self.log = []

    def tap(self, spec):
        self.log.append(("tap", spec))
        return True

    def down(self, spec):
        self.log.append(("down", spec))
        return True

    def up(self, spec):
        self.log.append(("up", spec))
        return True


def _mk_real(slices, armed=True, **cfg):
    """A wheel wired to a REAL TriggerEngine, whose button we drive by hand."""
    em = _SeqEmitter()
    tr = rf.TriggerEngine(_StubB(), emitter=em, armed=armed)
    w = rf.RadialMenu(_StubB(), emitter=em, trig=tr)
    base = {"enabled": True, "holdMs": 200.0, "slices": [dict(s) for s in slices]}
    base.update(cfg)
    w.set_config(base)
    return w, em, tr


def _btn(tr, down):
    """The button as the engine reads it: a level plus the moment it was last heard."""
    tr._btn_lvl = 1 if down else 0
    tr._btn_lvl_ts = CLK.t


def _settle(secs=2.0):
    """Macros run on a thread of their own and their pauses are REAL sleeps — so this is the one
    place in the file that waits on the wall clock."""
    for _ in range(int(secs / 0.02)):
        _real_time.sleep(0.02)


SEQ = [{"label": "Wklej", "spec": "x", "sequence": "down shift; wait 10; c; up shift"},
       {"label": "Zwykły", "spec": "b"}]

w, em, tr = _mk_real(SEQ)
_btn(tr, True)
for _ in range(20):
    CLK.advance(0.02)
    _btn(tr, True)
    w.on_pose(dict(UP))
    w.tick()
_btn(tr, False)
for _ in range(3):
    CLK.advance(0.02)
    _btn(tr, False)
    w.on_pose(dict(UP))
    w.tick()
_settle(1.0)
check("a slice with a macro runs the macro's steps, in order",
      em.log == [("down", "shift"), ("tap", "c"), ("up", "shift")], em.log)
check("...and does NOT also send the single action sitting in the same slice",
      ("tap", "x") not in em.log, em.log)

# the ordinary slice next to it is untouched by any of this. (DOWN, not RIGHT: on a TWO-slice
# wheel "right" is the border between the halves, and a test standing on a border proves nothing.)
w, em, tr = _mk_real(SEQ)
_btn(tr, True)
for _ in range(20):
    CLK.advance(0.02)
    _btn(tr, True)
    w.on_pose(dict(DOWN))
    w.tick()
_btn(tr, False)
for _ in range(3):
    CLK.advance(0.02)
    _btn(tr, False)
    w.on_pose(dict(DOWN))
    w.tick()
_settle(0.4)
check("a slice with no macro still sends its single action", em.log == [("tap", "b")], em.log)

# the gate. A macro is an output like any other and a paused capsule emits none.
w, em, tr = _mk_real(SEQ, armed=False)
_btn(tr, True)
for _ in range(20):
    CLK.advance(0.02)
    _btn(tr, True)
    w.on_pose(dict(UP))
    w.tick()
check("a paused capsule still SHOWS the wheel", w.open is True, w.open)
_btn(tr, False)
for _ in range(3):
    CLK.advance(0.02)
    _btn(tr, False)
    w.on_pose(dict(UP))
    w.tick()
_settle(0.6)
check("...but its macro never runs — the gate is the app's ordinary one", em.log == [], em.log)

# ===================================================== j. the guide matches the parser =========
# A guide that quietly stops describing the thing it documents is worse than no guide: people
# trust it. So the step KINDS and the alias words are read out of parse_sequence itself and each
# one has to be findable in the text the panel shows. Adding a step type to the parser without a
# line in the guide fails here, by name.
print("\n--- the macro guide still describes the parser ---")
import inspect  # noqa: E402
import re  # noqa: E402

_GUIDE_JS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                         "web", "js", "rf-12-preview-editor.js")
with open(_GUIDE_JS, "r", encoding="utf-8") as _f:
    _guide_src = _f.read()
_g0 = _guide_src.find("function macroGuideHtml")
# Ciecie po ZAMKNIECIU TEJ funkcji (`\n}` w pierwszej kolumnie), a nie po nastepnym `function`.
# Roznica jest istotna: miedzy nimi lezy komentarz, a ten ma prawo zawierac backticki — po ktorych
# `_body` nizej szuka konca szablonu. Komentarz z backtickiem rozciagal ciag az do siebie i jego
# wlasna proza wpadala do listy zdan „do przetlumaczenia" (2026-08-31).
_g1 = _guide_src.find("\n}\n", _g0)
GUIDE = _guide_src[_g0:(_g1 + 2) if _g1 > 0 else len(_guide_src)]
check("the guide is built by one function, called from both places that need it",
      _g0 > 0 and len(GUIDE) > 1500, len(GUIDE))

_PSRC = inspect.getsource(rf.parse_sequence)
KINDS = sorted(set(re.findall(r'steps\.append\(\("(\w+)"', _PSRC)))
check("the parser's step kinds were readable", len(KINDS) >= 5, KINDS)
# kind -> a phrase that MUST be in the guide if that kind exists. A kind with no entry here is
# a kind nobody wrote a line about, which is exactly what this section is for.
KIND_WORDS = {"key": "klawisz", "wait": "wait", "down": "down", "up": "up", "led": "led on"}
for k in KINDS:
    want = KIND_WORDS.get(k)
    check("step kind '%s' is described in the guide" % k,
          want is not None and want in GUIDE,
          "brak wpisu w KIND_WORDS — dopisz akapit do poradnika" if want is None else want)

ALIASES = set()
for _grp in re.findall(r"in \(([^)]*)\)", _PSRC):
    for _lit in re.findall(r'"([^"]+)"', _grp):
        ALIASES.add(_lit.strip())
check("the parser's alias words were readable", len(ALIASES) >= 12, sorted(ALIASES))
_missing = sorted(a for a in ALIASES if a not in GUIDE)
check("every word the parser accepts is written down somewhere in the guide",
      not _missing, _missing)
for _lit in ("500", "10000", "40"):
    check("the guide states the limit %s" % _lit, _lit in GUIDE)
check("...and the 'ms' shorthand the parser also accepts", "ms" in GUIDE)

# THE ENGLISH HALF. The panel translates whole TEXT NODES against an exact-match dictionary, so
# "it is also in English" means precisely this: every sentence-shaped run of text between two tags
# has a key in I18N_EN. Anything else is a paragraph that silently stays Polish for half the users.
_I18N_JS = os.path.join(os.path.dirname(_GUIDE_JS), "rf-01-i18n.js")
with open(_I18N_JS, "r", encoding="utf-8") as _f:
    _i18n_src = _f.read()
_body = GUIDE[GUIDE.find("`"):GUIDE.rfind("`") + 1]
# What is inside <code> is a sample of the macro language, and the macro language has no English
# version — `wait 100` is `wait 100` in every panel. Everything else is prose and must be paired.
_body = re.sub(r"<code>.*?</code>", " ", _body, flags=re.S)
_nodes = []
for _raw in re.split(r"<[^>]*>", _body):
    _t = " ".join(_raw.replace("&nbsp;", " ").split()).strip(" `;")
    # Runs shorter than a dozen characters are punctuation and glue between <code> tokens, and
    # a run with no letter at all is a token, not a sentence.
    if len(_t) >= 12 and re.search(r"[A-Za-zĄąĆćĘꣳŃńÓóŚśŹźŻż]", _t):
        _nodes.append(_t)
check("the guide has real prose in it to translate", len(_nodes) >= 15, len(_nodes))
_untranslated = [t for t in _nodes if ('"%s"' % t) not in _i18n_src]
check("every sentence of the guide has an English pair in rf-01-i18n.js",
      not _untranslated, _untranslated[:4])

# ================================================= k. GDZIE POKAZYWAĆ KOŁO ====================
# One setting instead of three switches. The wheel can be drawn on the cheat sheet, in the ordinary
# overlays and in the little window at the pointer, and before this key each of those was switched
# on separately - so the commonest wish ("put it under my cursor") produced TWO wheels at once.
#
# What has to be exact, and none of it is "a key was stored":
#   * NONSENSE FALLS BACK TO THE OVERLAYS, never to the window at the pointer: a typo in somebody's
#     shared config must not open a window on their desktop.
#   * A CONFIG FROM BEFORE THE KEY KEEPS DOING WHAT IT WAS DOING. That is what the migration is
#     for, and it reads the ONE thing that says so: whether that capsule's `<dev>~kolo` window was
#     left open.
#   * THE PACKET CARRIES IT. An overlay is a separate page with no settings card; the only moment
#     the answer matters is the moment the packet arrives.
#   * THE SERVER OWNS THE WINDOW. Choosing a place must open or close the real window, or the
#     setting is only a word in a file.
print("\n--- the setting itself ---")
check("a wheel nobody has touched draws in the ordinary overlays",
      rf.RadialMenu.DEFAULTS["showWhere"] == "overlay", rf.RadialMenu.DEFAULTS["showWhere"])
# CZTERY MIEJSCA OD 2026-09-06. „center" — okienko NIERUCHOME na środku ekranu — jest dołożone
# NA KOŃCU krotki, i to jest celowe: kolejność jest tu walidacyjna, więc czyta się ją jak historię
# tego ustawienia, a nie jak układ przycisków (o tym decyduje WH_WHERE w rf-46b). Wyliczanka stoi
# co do znaku, bo lustro tej krotki żyje w przeglądarce: gdyby serwer znał piąte miejsce, którego
# karta nie oferuje, ustawienie dałoby się zapisać i nie dałoby się zobaczyć.
check("four places, and exactly these four",
      rf.RadialMenu.SHOW_WHERE == ("overlay", "cursor", "both", "center"), rf.RadialMenu.SHOW_WHERE)
for _v in rf.RadialMenu.SHOW_WHERE:
    check("'%s' is stored as asked" % _v,
          rf.RadialMenu.sanitize({"showWhere": _v})["showWhere"] == _v)
for _junk in ("kursor", "", None, 7, "BOTH", ["cursor"]):
    check("nonsense (%r) falls back to the overlays, not to somebody's desktop" % (_junk,),
          rf.RadialMenu.sanitize({"showWhere": _junk})["showWhere"] == "overlay",
          rf.RadialMenu.sanitize({"showWhere": _junk})["showWhere"])
check("a config that says nothing about it keeps what the wheel already had",
      rf.RadialMenu.sanitize({"holdMs": 400},
                             base=rf.RadialMenu.sanitize({"showWhere": "both"}))["showWhere"]
      == "both")
_old_cfg = rf.RadialMenu.sanitize({"deadzone": 0.4})
del _old_cfg["showWhere"]                       # a config from before the key existed
check("...and a base written before the key gets the default put back, not left missing",
      rf.RadialMenu.sanitize({}, base=_old_cfg)["showWhere"] == "overlay")
_w_where, _, _ = _mk(showWhere="cursor")
check("the engine answers with the place it is running on", _w_where.show_where() == "cursor")
_w_where.set_config({"showWhere": "nonsense"})
check("...and never with one nobody implements", _w_where.show_where() == "overlay")
# …i to samo dla czwartego miejsca, osobno: „center" przechodzi przez DWIE bramki (sanitize przy
# zapisie, show_where przy czytaniu przez silnik) i wystarczy, żeby którakolwiek go nie znała,
# a ustawienie da się kliknąć i nie da się utrzymać — wróci jako „W nakładkach" po pierwszym
# zapisie, co czyta się jak przycisk, który sam się odklika.
_w_ctr, _, _ = _mk(showWhere="center")
check("„center” dojeżdża do silnika w całości, a nie wraca jako „overlay”",
      _w_ctr.show_where() == "center", _w_ctr.show_where())
check("...i przeżywa zapis przez sanitizer bez zmiany",
      rf.RadialMenu.sanitize({}, base=rf.RadialMenu.sanitize(
          {"showWhere": "center"}))["showWhere"] == "center")

print("\n--- migration: a config from before the setting keeps doing what it did ---")
import shutil  # noqa: E402
import tempfile  # noqa: E402

_MIG = tempfile.mkdtemp(prefix="rf-wheel-where-")
_sd_saved, _oc_saved = rf.SETTINGS_DIR, rf.OVERLAY_CONFIG_FILE
rf.SETTINGS_DIR = _MIG
rf.OVERLAY_CONFIG_FILE = os.path.join(_MIG, "ribbitflip_overlay.json")


def _seed(wheel_cfg, overlay_windows):
    """A capsule d0 whose wheel config and overlay file say exactly this. Returns the wheel path."""
    import json as _json
    wp = os.path.join(_MIG, "ribbitflip_wheel.json")
    with open(wp, "w", encoding="utf-8") as f:
        _json.dump(wheel_cfg, f)
    with open(rf.OVERLAY_CONFIG_FILE, "w", encoding="utf-8") as f:
        _json.dump({"windows": overlay_windows}, f)
    return wp


_OLD = {"enabled": True, "holdMs": 300, "slices": [{"label": "A", "spec": "a"},
                                                   {"label": "B", "spec": "b"}]}
_p = _seed(_OLD, {"d0": {"open": True}, "d0~kolo": {"open": True}})
check("the window at the pointer was ON -> the wheel was in BOTH places, and stays there",
      rf.load_wheel("d0")["showWhere"] == "both", rf.load_wheel("d0"))
check("...which is what the read-only helper answers too", rf.wheel_show_where("d0") == "both")
import json as _json2  # noqa: E402
with open(_p, "r", encoding="utf-8") as _f:
    check("...and NOTHING was written: a read must not rewrite the file it just read",
          "showWhere" not in _json2.load(_f))
_seed(_OLD, {"d0": {"open": True}, "d0~kolo": {"open": False}})
check("a window that exists but was switched OFF drew nothing -> the overlays only",
      rf.load_wheel("d0")["showWhere"] == "overlay", rf.load_wheel("d0"))
_seed(_OLD, {"d0": {"open": True}})
check("a capsule that never had the window -> the overlays only",
      rf.load_wheel("d0")["showWhere"] == "overlay")
_seed(_OLD, {})
check("no overlay file worth reading -> the overlays only, not a guess",
      rf.load_wheel("d0")["showWhere"] == "overlay")
_seed(dict(_OLD, showWhere="cursor"), {"d0~kolo": {"open": True}})
check("a config that ALREADY says where is left alone, whatever the window is doing",
      rf.load_wheel("d0")["showWhere"] == "cursor")
_seed(dict(_OLD, showWhere="bzdura"), {"d0~kolo": {"open": True}})
check("...even when what it says is nonsense — that is the sanitizer's job, not migration's",
      rf.load_wheel("d0").get("showWhere") == "bzdura"
      and rf.wheel_show_where("d0") == "overlay", rf.load_wheel("d0"))
# CZYTANIE Z DYSKU ZNA CZWARTE MIEJSCE. Ten pomocnik jest jedyną odpowiedzią, jaką ma odradzanie
# okna przy starcie (reopen_follow_cursor woła go, zanim cokolwiek nasłuchuje), więc gdyby „center"
# spadało tu na wartość awaryjną, okno na środku ekranu po prostu nie wracałoby po restarcie —
# a plik na dysku mówiłby, że powinno.
_seed(dict(_OLD, showWhere="center"), {"d0~kolo": {"open": True}})
check("„center” z pliku jest czytane jako „center”, a nie awaryjnie jako „overlay”",
      rf.wheel_show_where("d0") == "center", rf.wheel_show_where("d0"))
check("...i migracja nie dotyka konfiguracji, która już mówi gdzie",
      rf.load_wheel("d0")["showWhere"] == "center")
check("migrating something that is not a config at all does not explode",
      rf.wheel_where_migrate(None, "d0") is None
      and rf.wheel_where_migrate({}, "")["showWhere"] == "overlay")
check("the window of ANOTHER capsule does not migrate this one",
      rf.wheel_where_migrate({}, "d1", wins={"d0~kolo": {"open": True}})["showWhere"] == "overlay")
check("...and its own does", rf.wheel_where_migrate(
    {}, "d1", wins={"d1~kolo": {"open": True}})["showWhere"] == "both")

print("\n--- the packet says where, on every publish ---")
_w_pk, _, _tr_pk = _mk(showWhere="cursor")
_tr_pk.down = True
_run(_w_pk, 400, CENTRE)                      # opens on the hold edge
_pkts = [e for e in _w_pk.b.events if e.get("t") == "wheel"]
check("there is a packet at all", len(_pkts) >= 1, len(_pkts))
check("every one of them carries the place", all("where" in e for e in _pkts),
      [e for e in _pkts if "where" not in e][:1])
check("...and it is the one the engine is running on",
      all(e["where"] == "cursor" for e in _pkts), {e.get("where") for e in _pkts})
_w_pk.set_config({"showWhere": "overlay"})
_tr_pk.down = False                           # let go, so the next hold is a fresh press
_run(_w_pk, 100, CENTRE)
_w_pk.b.events.clear()
_tr_pk.down = True
_run(_w_pk, 400, CENTRE)
_pk2 = [e for e in _w_pk.b.events if e.get("t") == "wheel"]
check("changing the place changes what the next packets say",
      _pk2 and all(e["where"] == "overlay" for e in _pk2), {e.get("where") for e in _pk2})

print("\n--- the server opens and closes the window itself ---")


class _FakeWheelWin:
    """The window itself, reduced to the two things wheel_apply_where touches: the settings it
    carries and „postaw mnie na środku ekranu". Counting the calls instead of moving anything is
    the whole point — a real center_on_screen asks Windows about the monitors."""

    def __init__(self):
        self.cfg = {"followCursor": True}
        self.centered = 0

    def center_on_screen(self):
        self.centered += 1
        return True


class _FakeMgr:
    """An overlay manager that records what it was asked to do and never launches anything."""

    def __init__(self, existing=()):
        self.wins = {w: _FakeWheelWin() for w in existing}
        self.log = []
        self.fail = ""

    def wheel_wid(self, dev, create=False):
        wid = rf.overlay_wheel_wid(dev)
        if create:
            self.wins.setdefault(wid, _FakeWheelWin())
            self.log.append(("create", wid))
            return wid
        return wid if wid in self.wins else None

    # OD 2026-09-06 wołane przy KAŻDYM postawieniu okna: „center" różni się od „cursor" wyłącznie
    # tym, czy okno ma chodzić za myszą, a przestawienie musi działać w OBIE strony (patrz niżej).
    # Atrapa idzie tą samą drogą, co panel — przez menedżera, a nie przez `w.cfg[...] = …` z boku,
    # bo to menedżer jest jedynym miejscem, które sanityzuje i zamawia zapis.
    def configure(self, wid, patch):
        w = self.wins.setdefault(wid, _FakeWheelWin())
        w.cfg.update(patch)
        self.log.append(("configure", wid, dict(patch)))
        return w.cfg

    def open(self, wid, url):
        self.log.append(("open", wid))
        return (False, self.fail) if self.fail else (True, "")

    def close(self, wid):
        self.log.append(("close", wid))
        return True


_m = _FakeMgr()
up, why = rf.wheel_apply_where("d0", "cursor", "http://127.0.0.1:8827/", mgr=_m)
check("'cursor' makes the window exist and stand up",
      up is True and why == "" and ("open", "d0~kolo") in _m.log, _m.log)
_m = _FakeMgr()
up, _ = rf.wheel_apply_where("d0", "both", "http://127.0.0.1:8827/", mgr=_m)
check("'both' does the same — it is still the window at the pointer",
      up is True and ("open", "d0~kolo") in _m.log, _m.log)
_m = _FakeMgr(existing=["d0~kolo"])
up, _ = rf.wheel_apply_where("d0", "overlay", mgr=_m)
check("'overlay' puts it away", up is False and _m.log == [("close", "d0~kolo")], _m.log)
_m = _FakeMgr()
up, _ = rf.wheel_apply_where("d0", "overlay", mgr=_m)
check("...and a window that was never made is not made just to be closed",
      up is False and _m.log == [], _m.log)
_m = _FakeMgr()
_m.fail = "brak przegladarki"
up, why = rf.wheel_apply_where("d0", "cursor", mgr=_m)
check("a machine that cannot open one says so instead of pretending",
      up is False and why == "brak przegladarki", (up, why))

# ---- „Na środku ekranu": TO SAMO okno, tylko nieruchome ---------------------------------------
# Czwarte miejsce nie dokłada ani okna, ani ścieżki — dokłada JEDNĄ różnicę: `followCursor`. Trzy
# rzeczy muszą tu być prawdą naraz, i każda z nich zawiodła kiedyś osobno w prototypie:
#   * okno ma STANĄĆ (want == True), a nie zostać zamknięte razem z „W nakładkach",
#   * ma mieć `followCursor: False`, bo inaczej pierwsze otwarcie koła ściągnęłoby je pod kursor
#     (wheel_opened rusza dokładnie te okna, które deklarują pogoń) — i „środek ekranu" trwałby
#     do pierwszego naciśnięcia przycisku,
#   * miejsce ma być nadane PRZED open(), bo okno startuje asynchronicznie: `_place()` poda
#     zapisane x/y przeglądarce jako --window-position, a centrowanie „po fakcie" byłoby
#     mignięciem z rogu ekranu na środek.
_m = _FakeMgr()
up, why = rf.wheel_apply_where("d0", "center", "http://127.0.0.1:8827/", mgr=_m)
_kinds = [e[0] for e in _m.log]
check("„center” też stawia okno — to jedno i to samo <dev>~kolo",
      up is True and why == "" and ("open", "d0~kolo") in _m.log, _m.log)
check("...i wyłącza pogoń za kursorem, bo inaczej pierwsze otwarcie koła ściągnęłoby je pod mysz",
      _m.wins["d0~kolo"].cfg.get("followCursor") is False, _m.wins["d0~kolo"].cfg)
check("...i to przez menedżera, a nie po cichu w cfg obok niego",
      ("configure", "d0~kolo", {"followCursor": False}) in _m.log, _m.log)
check("...okno dostaje środek ekranu RAZ, i przed otwarciem (bo x/y jedzie w --window-position)",
      _m.wins["d0~kolo"].centered == 1
      and _kinds.index("configure") < _kinds.index("open"), (_m.wins["d0~kolo"].centered, _kinds))
_m = _FakeMgr()
rf.wheel_apply_where("d0", "cursor", "http://127.0.0.1:8827/", mgr=_m)
check("„cursor” włącza pogoń z powrotem — przestawianie działa w OBIE strony",
      _m.wins["d0~kolo"].cfg.get("followCursor") is True, _m.wins["d0~kolo"].cfg)
check("...i nikt wtedy nie stawia okna na środku ekranu",
      _m.wins["d0~kolo"].centered == 0, _m.wins["d0~kolo"].centered)
# Przejście MIĘDZY tymi dwoma miejscami na jednym oknie jest tym, co naprawdę robi człowiek
# w karcie — i tym, co zawiodłoby, gdyby flaga była nadawana tylko przy pierwszym postawieniu.
_m = _FakeMgr()
for _mode, _want_follow in (("center", False), ("cursor", True), ("center", False),
                            ("both", True), ("center", False)):
    rf.wheel_apply_where("d0", _mode, "http://127.0.0.1:8827/", mgr=_m)
    check("„%s” -> followCursor == %s" % (_mode, _want_follow),
          _m.wins["d0~kolo"].cfg.get("followCursor") is _want_follow,
          _m.wins["d0~kolo"].cfg)
_m = _FakeMgr(existing=["d0~kolo"])
up, _ = rf.wheel_apply_where("d0", "overlay", mgr=_m)
check("...a „W nakładkach” zamyka je tak samo, cokolwiek stało tam wcześniej",
      up is False and _m.log == [("close", "d0~kolo")], _m.log)


class _BoomMgr(_FakeMgr):
    def open(self, wid, url):
        raise RuntimeError("no desktop here")


up, why = rf.wheel_apply_where("d0", "cursor", mgr=_BoomMgr())
check("a manager that throws does not take the request down with it", up is False and why)
check("no manager at all is simply nothing to do",
      rf.wheel_apply_where("d0", "cursor", mgr=None if rf.OVERLAY is None else _FakeMgr())[0]
      in (False, True))
check("no capsule named, nothing done", rf.wheel_apply_where("", "cursor", mgr=_FakeMgr()) == (False, ""))

rf.SETTINGS_DIR, rf.OVERLAY_CONFIG_FILE = _sd_saved, _oc_saved
shutil.rmtree(_MIG, ignore_errors=True)

print("\n--- the card and the engine spell it the same way ---")
# TWO FILES, one subject. rf-46-wheel.js draws the wheel (the overlay loads it without any card at
# all) and rf-46b-wheel-card.js is the settings tab. The checks below are about "the panel and the
# engine agree", so they read BOTH — which half a string lives in is an organisation detail, and a
# test that cared would break on every tidy-up without anything actually being wrong.
_RF46_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web", "js")
_rf46_w = ""
for _n in ("rf-46-wheel.js", "rf-46b-wheel-card.js", "rf-46c-wheel-tree.js"):
    with open(os.path.join(_RF46_DIR, _n), "r", encoding="utf-8") as _f:
        _rf46_w += _f.read() + "\n"
for _v in rf.RadialMenu.SHOW_WHERE:
    check("the panel offers '%s'" % _v, ('["%s",' % _v) in _rf46_w)
check("the old single switch is gone from the card",
      'id="whCurOn"' not in _rf46_w and "whCurToggle" not in _rf46_w)
check("...and the segment took its place", 'id="whWhereSeg"' in _rf46_w)
# ZWYKŁA NAKŁADKA PYTA Z LISTY POZYTYWNEJ, a nie „byle nie »przy kursorze«" (2026-09-06). Póki
# miejsca były trzy, jedno wykluczenie starczało za wyliczenie — przy czwartym („center") ten sam
# warunek kazałby nakładce rysować koło RÓWNOLEGLE z okienkiem na środku ekranu, czyli dawałby dwa
# koła naraz: dokładnie tę usterkę, dla której wybór miejsca w ogóle powstał. Szukamy WARUNKU,
# a nie samego istnienia funkcji, bo to on jest tą decyzją.
check("the ordinary overlay is what gets suppressed, not the panel's cheat sheet",
      "function whDrawHere" in _rf46_w
      and 'return !where || where === "overlay" || where === "both";' in _rf46_w)
check("...a okienko koła rysuje wszędzie POZA „W nakładkach” — jedno okno, dwa sposoby stawiania",
      'if (typeof RF_OVL_WHEEL !== "undefined" && RF_OVL_WHEEL) return where !== "overlay";'
      in _rf46_w)
check("...i ściąga w panelu rysuje ZAWSZE: to powierzchnia, na której się ten wybór ustawia",
      'if (typeof RF_OVL === "undefined" || !RF_OVL) return true;' in _rf46_w)
check("the suppression is in the DRAWING, so nobody's `show.wheel` is rewritten",
      "whDrawHere(st)" in _rf46_w and "act: \"config\", config: state.wheelWin" in _rf46_w)

# KLIKNIĘTY KAFEL ODPOWIADA OD RAZU: po kliknięciu „Edytujesz teraz” ma się zmienić od razu,
# inaczej to nieintuicyjne. Plakietka czekała
# wcześniej na odpowiedź serwera i kafel wyglądał na martwy. Test pilnuje KOLEJNOŚCI, bo to ona jest
# tą decyzją: odświeżenie pasa stoi PRZED `fetch`, nie tylko po nim.
_wfs = _rf46_w[_rf46_w.find("function wheelFetchState"):]
_wfs = _wfs[:_wfs.find("\n}")]
check("pas kafli odświeża się PRZED zapytaniem o konfigurację",
      0 < _wfs.find("wheelCapsSync()") < _wfs.find("fetch("),
      (_wfs.find("wheelCapsSync()"), _wfs.find("fetch(")))
check("...i jeszcze raz po niej, gdy karta ma już swoje wycinki",
      _wfs.count("wheelCapsSync()") == 2, _wfs.count("wheelCapsSync()"))
# Natychmiastowa plakietka jest bezpieczna WYŁĄCZNIE dzięki tej bramce: w oknie między kliknięciem
# a nadejściem konfiguracji `state.wheelDev` jest puste, więc zapis nie ma dokąd pójść i nie da się
# nadpisać koła kapsla, który właśnie zszedł z karty.
check("zapis odmawia, dopóki karta nie należy do aktywnego kapsla",
      'if (!dev || dev !== (state.activeDeviceId || "d0")) return;' in _rf46_w)
check("karta mówi „wczytuję” dopiero po chwili, a nie przy każdym kliknięciu",
      "_whCardBusy(true), 120" in _rf46_w and 'b.setAttribute("aria-busy", "true")' in _rf46_w)

# ============================================================= l. the wiring ===================
print("\n--- the engine is plugged in where it says it is ---")
check("the config file has a name of its own",
      rf._DEV_BASENAMES.get("wheel") == "ribbitflip_wheel.json", rf._DEV_BASENAMES.get("wheel"))
check("the cheat sheet knows about the part",
      rf.OVERLAY_WIN_DEFAULTS["show"].get("wheel") is True)
check("...and it has a size of its own",
      rf.OVERLAY_WIN_DEFAULTS["scaleParts"].get("wheel") == 100)
check("the pipeline can carry a wheel", "wheel" in rf.Pipeline.__init__.__code__.co_varnames)

# The wheel is a MODULE now, not a fold inside the Mapping tab, so it has to appear everywhere the
# other modules do — otherwise it is a thing you can switch on in one place and cannot find in any
# of the others. (Owner's decision, 2026-08-26.)
print("\n--- koło jest osobnym modułem, nie sekcją w Mapowaniu ---")
with open(os.path.join(_RF46_DIR, "rf-45-devmods.js"), "r", encoding="utf-8") as _f:
    _dm = _f.read()
check("the capsule x module matrix has a column of its own for it",
      '{key:"wheel",grp:"wheel"' in _dm)
check("...which switches it per capsule through the wheel's own endpoint",
      'url="/wheel"+q;body={enabled:!!want}' in _dm)
check("...and asks the server for its state like every other column",
      'fetch("/wheel"+q)' in _dm)
with open(os.path.join(_RF46_DIR, "rf-39j-hotkey.js"), "r", encoding="utf-8") as _f:
    _hk = _f.read()
check("the group has a name of its own, so its toasts say what was switched on",
      'if(key==="wheel")' in _hk)

# ================================================== m. PODMENU: sanityzacja ====================
# From here down: slices that carry other slices. Everything above this line describes the wheel as
# it was BEFORE submenus and every one of those checks still has to pass unchanged — that is the
# actual contract, not a nice-to-have: somebody's ribbitflip_wheel.json written last month has to
# come back out of this engine as the wheel they set up.
print("\n--- podmenu: co silnik naprawdę zapisuje ---")
S = rf.RadialMenu.sanitize
_MENU = [
    {"label": "Media", "icon": "🎵", "color": "#EAA32B", "children": [
        {"label": "Graj", "spec": "media:play"},
        {"label": "Dalej", "spec": "media:next", "children": [
            {"label": "Głębiej", "spec": "a", "children": [{"label": "Za głęboko", "spec": "b"}]}]},
    ]},
    {"label": "Zwykły", "spec": "x"},
]
c = S({"enabled": True, "slices": _MENU})
_m = c["slices"][0]
check("a slice keeps its children", len(rf.RadialMenu.kids(_m) or []) == 2, _m)
check("...its icon", _m.get("icon") == "🎵", _m.get("icon"))
check("...and its colour, normalised to lower case", _m.get("color") == "#eaa32b", _m.get("color"))
_lvl2 = _m["children"][1]
check("a second level may carry a third", len(rf.RadialMenu.kids(_lvl2) or []) == 1, _lvl2)
_lvl3 = _lvl2["children"][0]
check("...and the third one is the last: a fourth is dropped, not stored",
      "children" not in _lvl3, _lvl3)
check("...while the slice itself survives, so nothing silently disappears",
      _lvl3.get("label") == "Głębiej", _lvl3)

check("a slice with no children carries no children key at all — an old file comes back unchanged",
      c["slices"][1] == {"label": "Zwykły", "spec": "x", "sequence": ""}, c["slices"][1])
_flat = S({"enabled": True, "slices": SL4})
check("...and a whole flat wheel round-trips to exactly what it always was",
      _flat["slices"] == [{"label": s["label"], "spec": s["spec"], "sequence": ""} for s in SL4],
      _flat["slices"])

check("an icon longer than a hand can read is clipped",
      S({"slices": [{"label": "a", "icon": "🎵🎵🎵🎵🎵🎵"}]})["slices"][0]["icon"]
      == "🎵🎵🎵🎵"[:rf.RadialMenu.ICON_MAX],
      S({"slices": [{"label": "a", "icon": "🎵🎵🎵🎵🎵🎵"}]})["slices"][0].get("icon"))
for _bad in ("red", "#ab", "#gggggg", "rgb(1,2,3)", "#12345678"):
    check("a colour that is not #rrggbb is dropped: %r" % _bad,
          "color" not in S({"slices": [{"label": "a", "color": _bad}]})["slices"][0])
check("sixteen is the ceiling INSIDE a submenu too, not only at the root",
      len(S({"slices": [{"label": "p", "children": [{"label": "c%d" % i} for i in range(30)]}]})
          ["slices"][0]["children"]) == rf.RadialMenu.MAX_SLICES)
check("an empty children list is not a submenu",
      "children" not in S({"slices": [{"label": "a", "children": []}]})["slices"][0])
check("nonsense in place of children is dropped, not crashed on",
      "children" not in S({"slices": [{"label": "a", "children": "tak"}]})["slices"][0])
check("children keep the same house rules: a `layer:` action is emptied there as well",
      S({"slices": [{"label": "p", "children": [{"label": "c", "spec": "layer:2"}]}]})
      ["slices"][0]["children"][0]["spec"] == "")

for _v in rf.RadialMenu.SUBMENU_MODES:
    check("the shape '%s' is stored as asked" % _v, S({"submenuMode": _v})["submenuMode"] == _v)
check("a shape nobody implements falls back to the one that always fits",
      S({"submenuMode": "spirala"})["submenuMode"] == "replace")
check("a config written before submenus existed reads as 'replace'",
      S({"enabled": True, "slices": SL4})["submenuMode"] == "replace")
check("subOpenMs is clamped at both ends",
      (S({"subOpenMs": 10})["subOpenMs"], S({"subOpenMs": 9000})["subOpenMs"])
      == (rf.RadialMenu.SUBOPEN_MIN, rf.RadialMenu.SUBOPEN_MAX))
check("...and nonsense in it leaves the default standing",
      S({"subOpenMs": "wkrótce"})["subOpenMs"] == rf.RadialMenu.DEFAULTS["subOpenMs"])
check("the coloured discs are a plain switch", S({"iconChips": 1})["iconChips"] is True)

# ================================================== n. PASMA: jedna geometria ==================
# The engine picks a RING from how far the capsule leans, and the browser draws those rings from
# the same numbers — sent in the packet as `geom`. If the two ever compute it separately they drift,
# and a hand aimed at a ring it can SEE starts selecting the one underneath it.
print("\n--- pasma: silnik i rysunek liczą to raz ---")
wg, _, _ = _mk()
for _dz in (0.10, 0.34, 0.5, 0.7):
    wg.cfg["deadzone"] = _dz
    g1 = wg.band_geom(1)
    check("with one ring, dz=%.2f, the geometry IS the old wheel" % _dz,
          len(g1) == 1 and abs(g1[0][0] - _dz) < 1e-9 and abs(g1[0][1] - 1.0) < 1e-9, g1)
wg.cfg["deadzone"] = 0.34
for _nb in (1, 2, 3):
    g = wg.band_geom(_nb)
    th = [b - a for a, b in g]
    check("%d rings: the outermost still reaches the rim" % _nb, abs(g[-1][1] - 1.0) < 1e-9, g)
    check("...they are all the same thickness, so children are never the thinner target" % (),
          max(th) - min(th) < 1e-9, th)
    check("...and they do not overlap", all(g[i][1] < g[i + 1][0] for i in range(_nb - 1)), g)
check("more rings means everything shrinks together, middle included",
      wg.band_geom(3)[0][0] < wg.band_geom(2)[0][0] < wg.band_geom(1)[0][0],
      [wg.band_geom(i)[0][0] for i in (1, 2, 3)])
# The drawing gets the rings in the packet and does not work them out — except in the card's little
# preview, which has to build a packet before the server has sent one. That copy of the formula is
# the one place the two could drift apart, so the numbers it uses are pinned to the engine's here.
_MIRROR = [("WHEEL_BAND_GAP", rf.RadialMenu.BAND_GAP), ("WHEEL_BAND_MIN", rf.RadialMenu.BAND_MIN),
           ("WHEEL_MAX_BANDS", rf.RadialMenu.MAX_BANDS), ("WHEEL_ARC_PER", rf.RadialMenu.ARC_PER_DEG),
           ("WHEEL_ARC_MAX", rf.RadialMenu.ARC_MAX_DEG), ("WHEEL_MAX_DEPTH", rf.RadialMenu.MAX_DEPTH),
           ("WHEEL_ICON_MAX", rf.RadialMenu.ICON_MAX), ("WHEEL_MAX_SLICES", rf.RadialMenu.MAX_SLICES),
           ("WHEEL_DEAD_DEF", rf.RadialMenu.DEAD), ("WHEEL_DEAD_MIN", rf.RadialMenu.DEAD_MIN),
           ("WHEEL_DEAD_MAX", rf.RadialMenu.DEAD_MAX)]
for _n, _v in _MIRROR:
    # The VALUE, not its spelling: 0.3 and 0.30 are the same number and only one of them reads well
    # next to 0.34 in the source.
    _m = re.search(r"^const %s = ([0-9.]+);" % _n, _rf46_w, re.M)
    check("the drawing mirrors %s exactly" % _n,
          _m is not None and abs(float(_m.group(1)) - float(_v)) < 1e-12,
          _m.group(1) if _m else "brak")
for _v in rf.RadialMenu.SUBMENU_MODES:
    check("...and offers the shape '%s'" % _v, ('["%s", "' % _v) in _rf46_w)

# ================================================== o. celowanie po pasmach ====================
print("\n--- podmenu: pochylenie wybiera obręcz ---")
TREE = [{"label": "Media", "children": [{"label": "Graj", "spec": "p"},
                                        {"label": "Stop", "spec": "s"},
                                        {"label": "Dalej", "spec": "n"},
                                        {"label": "Wstecz", "spec": "b"}]},
        {"label": "Prawo", "spec": "right"},
        {"label": "Dół", "spec": "down"},
        {"label": "Lewo", "spec": "left"}]
# Two leans straight UP, at two distances: one lands on the main ring, one on the children's.
UP_MID = _lean(0, -12)      # |lean| = 0.40 of the rim
UP_FAR = _lean(0, -29)      # |lean| = 0.97

w, em, tr = _mk(slices=TREE, submenuMode="ring", subOpenMs=300)
tr.down = True
_run(w, 350, pose=CENTRE)
check("the wheel opens on the root, as it always did", w.open is True and w.path == [], w.path)
_run(w, 200, pose=UP_MID)
check("a middling lean points at the parent", (w._band, w.idx) == (0, 0), (w._band, w.idx))
check("...and does not open it yet — the wait has not run out", w.path == [], w.path)
_run(w, 200, pose=UP_MID)
check("standing still on a parent opens its children by itself", w.path == [0], w.path)
_run(w, 100, pose=UP_FAR)
check("...and leaning further reaches into them", (w._band, w.idx) == (1, 0), (w._band, w.idx))
_run(w, 100, pose=_lean(0, -60))
check("a lean past the rim still means the outermost ring (nieskończona krawędź)",
      (w._band, w.idx) == (1, 0), (w._band, w.idx))
_run(w, 200, pose=UP_MID)
check("coming back in points at the parent again", (w._band, w.idx) == (0, 0), (w._band, w.idx))
check("...without closing anything: the ring it opened is still up", w.path == [0], w.path)
_run(w, 200, pose=CENTRE)
check("the middle is still the middle", w.idx == -1, w.idx)
tr.down = False
_run(w, 60, pose=CENTRE)
check("letting go in the middle sends nothing at all", em.taps == [], em.taps)
check("...and closes the wheel", w.open is False, w.open)

# ================================================== p. nawigacja per tryb ======================
print("\n--- podmenu: „Trzymaj przycisk i puść” ---")
w, em, tr = _mk(slices=TREE, submenuMode="ring", subOpenMs=300)
tr.down = True
_run(w, 350, pose=CENTRE)
_run(w, 450, pose=UP_MID)          # otwiera podmenu czekaniem
_run(w, 100, pose=UP_FAR)          # ...i wchodzi w nie pochyleniem
tr.down = False
_run(w, 60, pose=UP_FAR)
check("letting go on a CHILD sends the child's action", em.taps == ["p"], em.taps)
check("...and closes the wheel", w.open is False, w.open)

w, em, tr = _mk(slices=TREE, submenuMode="ring", subOpenMs=300)
tr.down = True
_run(w, 350, pose=CENTRE)
_run(w, 450, pose=UP_MID)
tr.down = False
_run(w, 60, pose=UP_MID)
check("letting go on a PARENT sends nothing — a parent is a door, not an action",
      em.taps == [], em.taps)
check("...and the wheel stays up instead of vanishing under the hand", w.open is True, w.open)
check("...with its children still open", w.path == [0], w.path)
_run(w, 100, pose=UP_FAR)
check("it keeps aiming with the button up now", (w._band, w.idx) == (1, 0), (w._band, w.idx))
_click(w, tr, UP_FAR)
check("...and a CLICK is what confirms from here on", em.taps == ["p"], em.taps)
check("...which closes it", w.open is False, w.open)

w, em, tr = _mk(slices=TREE, submenuMode="replace", subOpenMs=300)
tr.down = True
_run(w, 350, pose=CENTRE)
_run(w, 450, pose=UP_MID)
check("in „Zastąp koło” the children take the parent's place", w.path == [0], w.path)
check("...so there is exactly one ring drawn", len(w._lay["vis"]) == 1, w._lay["vis"])
_run(w, 450, pose=CENTRE)
check("...and sitting in the MIDDLE long enough is how you go back up", w.path == [], w.path)
tr.down = False
_run(w, 60, pose=CENTRE)
check("nothing was sent by any of that", em.taps == [], em.taps)

print("\n--- podmenu: „Kliknij, pochyl, kliknij” ---")
w, em, tr = _mk(slices=TREE, confirm="click", submenuMode="ring", holdMs=300)
_click(w, tr, CENTRE)
check("a click opens it", w.open is True, w.open)
_run(w, 200, pose=UP_MID)
_click(w, tr, UP_MID)
check("a click on a parent opens its children instead of sending", w.path == [0], w.path)
check("...and sends nothing", em.taps == [], em.taps)
_run(w, 200, pose=UP_FAR)
_click(w, tr, UP_FAR)
check("a click on a child sends the child", em.taps == ["p"], em.taps)
check("...and closes the wheel", w.open is False, w.open)

w, em, tr = _mk(slices=TREE, confirm="click", submenuMode="ring", holdMs=300)
_click(w, tr, CENTRE)
_run(w, 200, pose=UP_MID)
_click(w, tr, UP_MID)
check("in a submenu", w.path == [0], w.path)
_run(w, 200, pose=CENTRE)
_click(w, tr, CENTRE)
check("a click in the middle goes back a level rather than cancelling outright",
      w.open is True and w.path == [], (w.open, w.path))
_click(w, tr, CENTRE)
check("...and at the root the same click IS the cancel", w.open is False, w.open)
check("nothing was sent on the way out", em.taps == [], em.taps)

print("\n--- podmenu: „Pochyl i przytrzymaj” ---")
w, em, tr = _mk(slices=TREE, confirm="tilt-hold", submenuMode="ring", confirmMs=400)
_run(w, 300, pose=UP_FAR)          # duże pochylenie otwiera koło
check("a big lean opens it", w.open is True, w.open)
_run(w, 500, pose=UP_MID)          # ...a wypełniony łuk na RODZICU
check("a full countdown on a parent opens it instead of firing", w.path == [0], w.path)
check("...and sends nothing", em.taps == [], em.taps)
_run(w, 600, pose=UP_FAR)          # ...i dopiero na dziecku wysyła
check("a full countdown on a child sends it", em.taps == ["p"], em.taps)
check("...and closes the wheel", w.open is False, w.open)

print("\n--- podmenu: „Przełączaj kliknięciami” ---")
w, em, tr = _mk(slices=TREE, confirm="cycle", confirmMs=600, submenuMode="arc", holdMs=300)
check("the wheel just stands there in this mode", w.open is True, w.open)
_click(w, tr, CENTRE)              # budzi
_click(w, tr, CENTRE)
check("the first click after waking lands on the first slice — the parent", w.idx == 0, w.idx)
_run(w, 800, pose=CENTRE)          # odczekanie = zatwierdzenie
check("confirming a parent opens it and the wheel lives on",
      w.open is True and w.path == [0], (w.open, w.path))
check("...and sends nothing", em.taps == [], em.taps)
_lay = w._lay
check("inside a submenu the list grows a „Wstecz” at position zero",
      _lay["vis"][0][0].get("back") is True, _lay["vis"][0][0])
check("...and it draws as one ring, whatever the shape says — clicks cannot aim at a second one",
      len(_lay["vis"]) == 1 and _lay["mode"] == "replace", (len(_lay["vis"]), _lay["mode"]))
check("the wheel still points at nothing until the next click", w.idx == -1, w.idx)
check("...and it is still awake — walking into a submenu is not an ending",
      w._awake is True, w._awake)
_click(w, tr, CENTRE)
check("the first click in a submenu lands on „Wstecz”", w.idx == 0, w.idx)
_run(w, 800, pose=CENTRE)
check("...and confirming it goes one level up", w.open is True and w.path == [], (w.open, w.path))
check("...without sending anything", em.taps == [], em.taps)
# WYJŚCIE Z PODMENU BEZ WYBIERANIA. „Wstecz" cofa o poziom, a przytrzymanie kończy całą rozmowę
# od razu — z dowolnej głębokości, bez klikania się z powrotem do korzenia.
_click(w, tr, CENTRE)
_run(w, 800, pose=CENTRE)          # wchodzimy w podmenu z powrotem
check("back inside the submenu", w.path == [0], w.path)
tr.down = True
_run(w, 400, pose=CENTRE)
tr.down = False
_run(w, 60, pose=CENTRE)
check("holding the button puts the wheel to sleep from inside a submenu too",
      w._awake is False, w._awake)
check("...at the root, so the next wake starts from the top", w.path == [], w.path)
check("...and sends nothing", em.taps == [], em.taps)

# ZEGAR PODDANIA RUSZA OD NOWA PO WEJŚCIU W PODMENU: wejście jest czynnością, a nie bezczynnością,
# a po nim koło stoi z niczym wybranym — czyli dokładnie w stanie, którego ten zegar pilnuje.
w, em, tr = _mk(slices=TREE, confirm="cycle", confirmMs=600, holdMs=300)
_click(w, tr, CENTRE)              # budzi
_run(w, 6000, pose=CENTRE)         # …i prawie doczekało do poddania
_click(w, tr, CENTRE)              # pierwszy wycinek: rodzic
_run(w, 800, pose=CENTRE)          # odczekanie wchodzi w podmenu
check("we are inside the submenu", w.path == [0] and w._awake is True, (w.path, w._awake))
_run(w, 6000, pose=CENTRE)
check("...and the give-up clock started again there, instead of firing straight after entry",
      w.open is True and w._awake is True, (w.open, w._awake))
check("...with nothing sent", em.taps == [], em.taps)

print("\n--- podmenu: rodzic nigdy nie wysyła ---")
_LOUD = [{"label": "Rodzic", "spec": "x", "sequence": "a; b",
          "children": [{"label": "Dziecko", "spec": "c"}, {"label": "Drugie", "spec": "d"}]},
         {"label": "Zwykły", "spec": "z"}]
w, em, tr = _mk(slices=_LOUD, submenuMode="ring", subOpenMs=300)
tr.down = True
_run(w, 350, pose=CENTRE)
_run(w, 200, pose=UP_MID)          # na rodzicu, ale krócej niż subOpenMs
tr.down = False
_run(w, 60, pose=UP_MID)
check("a parent's own action is never sent, even when somebody filled one in",
      em.taps == [], em.taps)
check("...letting go on it opens its children instead", w.open is True and w.path == [0], w.path)

# ================================================== q. pakiet SSE ==============================
print("\n--- pakiet „wheel”: rysunek dostaje wszystko, liczy nic ---")
w, em, tr = _mk(slices=SL4)
tr.down = True
_run(w, 350, pose=CENTRE)
_run(w, 100, pose=UP)
_pk = [e for e in w.b.events if e.get("t") == "wheel"][-1]
for _k in ("open", "idx", "n", "mag", "ang", "dz", "confirm", "cyc", "cd", "labels", "where"):
    check("a flat wheel still carries '%s', exactly as before" % _k, _k in _pk, sorted(_pk))
for _k in ("mode", "crumbs", "bands", "sel", "geom", "chips", "clk"):
    check("...and now also '%s'" % _k, _k in _pk, sorted(_pk))
check("a wheel with no children is ONE band", len(_pk["bands"]) == 1, _pk["bands"])
check("...whose geometry is the old wheel's",
      _pk["geom"] == [[round(w._dead(), 4), 1.0]], _pk["geom"])
check("...with no crumbs to show", _pk["crumbs"] == [], _pk["crumbs"])
check("...and labels that are still the root's", _pk["labels"] == [s["label"] for s in SL4],
      _pk["labels"])
check("...and the selection said twice, the old way and the new one",
      _pk["idx"] == 0 and _pk["sel"] == {"band": 0, "idx": 0}, (_pk["idx"], _pk["sel"]))
tr.down = False
_run(w, 60, pose=CENTRE)

w, em, tr = _mk(slices=TREE, submenuMode="arc", subOpenMs=300)
tr.down = True
_run(w, 350, pose=CENTRE)
_run(w, 500, pose=UP_MID)
_pk = [e for e in w.b.events if e.get("t") == "wheel"][-1]
check("with a submenu open the packet carries two bands", len(_pk["bands"]) == 2, _pk["bands"])
check("...the crumb trail of the parents", _pk["crumbs"] == ["Media"], _pk["crumbs"])
check("...which parent is standing open", _pk["bands"][0]["openIdx"] == 0, _pk["bands"][0])
check("...the geometry of both rings", len(_pk["geom"]) == 2, _pk["geom"])
check("...the shape being drawn", _pk["mode"] == "arc", _pk["mode"])
check("...and each item's icon, colour and whether it is a door",
      _pk["bands"][0]["items"][0]["sub"] is True
      and _pk["bands"][0]["items"][1]["sub"] is False, _pk["bands"][0]["items"][:2])
check("an arc of children is NOT a full circle", _pk["bands"][1]["full"] is False, _pk["bands"][1])
check("...and its angular range is as wide as the children need",
      abs((_pk["bands"][1]["a1"] - _pk["bands"][1]["a0"]) - 4 * rf.RadialMenu.ARC_PER_DEG) < 0.1,
      (_pk["bands"][1]["a0"], _pk["bands"][1]["a1"]))
_run(w, 100, pose=UP_FAR)
_pk = [e for e in w.b.events if e.get("t") == "wheel"][-1]
check("labels, idx and n describe the ACTIVE band, so an old drawing shows the right one",
      _pk["labels"] == ["Graj", "Stop", "Dalej", "Wstecz"] and _pk["n"] == 4
      and _pk["sel"]["band"] == 1 and _pk["idx"] == _pk["sel"]["idx"] >= 0,
      (_pk["labels"], _pk["n"], _pk["sel"]))
# An EVEN number of children in an arc puts the parent's bisector between two of them, so leaning
# straight at the parent lands on a neighbour rather than "the middle child" — there is no middle
# child. Worth pinning down: it looks like an off-by-one until you draw it.
check("...and an even arc has no middle child to land on", _pk["sel"]["idx"] in (1, 2),
      _pk["sel"])
tr.down = False
_run(w, 60, pose=CENTRE)

check("a full circle of children in „Pełna obręcz”",
      _mk(slices=TREE, submenuMode="ring")[0].submenu_mode() == "ring")


# ================================================== r. WYGLĄD RYSUNKU (`look`) ================
# Trzy liczby o KSZTAŁCIE koła: średnica, odstęp między wycinkami i zaokrąglenie ich rogów.
# Żyją w konfiguracji i jadą w pakiecie z tego samego powodu, co `dz` i `chips`: okno nakładki to
# osobna strona bez karty ustawień, więc nie ma kogo o nie spytać.
print("\n--- wygląd: co silnik naprawdę zapisuje ---")
_D = rf.RadialMenu.DEFAULTS["look"]
check("a config that says nothing about it gets the whole shape, not half of it",
      sorted(S({})["look"]) == ["corner", "gapDeg", "size"], S({})["look"])
check("...with the defaults picked out of the prototype",
      S({})["look"] == {"size": 360.0, "gapDeg": 3.0, "corner": 10.0}, S({})["look"])
check("a gap past the ceiling is cut to it",
      S({"look": {"gapDeg": 99}})["look"]["gapDeg"] == rf.RadialMenu.GAP_MAX)
check("...and one below the floor raised to it",
      S({"look": {"gapDeg": -5}})["look"]["gapDeg"] == rf.RadialMenu.GAP_MIN)
check("a rounding past the ceiling is cut to it",
      S({"look": {"corner": 99}})["look"]["corner"] == rf.RadialMenu.CORNER_MAX)
check("a wheel bigger than the ceiling is cut to it",
      S({"look": {"size": 5000}})["look"]["size"] == rf.RadialMenu.SIZE_MAX)
check("...and a wheel smaller than the floor raised to it",
      S({"look": {"size": 1}})["look"]["size"] == rf.RadialMenu.SIZE_MIN)
check("an unreadable number leaves its default alone",
      S({"look": {"gapDeg": "szeroki", "size": None}})["look"] == _D,
      S({"look": {"gapDeg": "szeroki", "size": None}})["look"])
check("a key nobody declared is dropped from `look` too, not stored",
      "blask" not in S({"look": {"blask": 1}})["look"], S({"look": {"blask": 1}})["look"])
check("`look` that is not a dictionary at all falls back to the default shape",
      S({"look": "ładnie"})["look"] == _D, S({"look": "ładnie"})["look"])
# THE ONE THAT WOULD BITE SILENTLY: DEFAULTS holds a dict, so a sanitizer handing that very object
# back would let the first slider drag edit the defaults of every wheel in the app.
_c1 = S({})
_c1["look"]["gapDeg"] = 7.0
check("the sanitizer hands back a FRESH dictionary, never the defaults themselves",
      rf.RadialMenu.DEFAULTS["look"]["gapDeg"] == 3.0 and S({})["look"]["gapDeg"] == 3.0,
      rf.RadialMenu.DEFAULTS["look"])
_w, _, _ = _mk()
_w.set_config({"look": {"gapDeg": 1.5, "corner": 4, "size": 500}, "slices": SL4})
check("the engine stores what it was asked for",
      _w.get_config()["look"] == {"size": 500.0, "gapDeg": 1.5, "corner": 4.0},
      _w.get_config()["look"])
check("...and hands back a copy of it, so editing the answer cannot reach the engine",
      _w.get_config()["look"] is not _w.get_config()["look"])
check("look() answers the same thing the config does",
      _w.look() == _w.get_config()["look"], _w.look())
_old = dict(rf.RadialMenu.DEFAULTS)
del _old["look"]
check("a config written before the key existed gets it put back, not left missing",
      S({}, base=_old)["look"] == _D, S({}, base=_old)["look"])

print("\n--- wygląd: rysunek dostaje go w pakiecie ---")
_w, _em, _tr = _mk(slices=SL4)
_w.set_config({"look": {"gapDeg": 2.0, "corner": 6, "size": 480}})
_tr.down = True
_run(_w, 350, pose=CENTRE)
_run(_w, 100, pose=UP)
_pk = [e for e in _w.b.events if e.get("t") == "wheel"][-1]
check("every packet carries the shape", "look" in _pk, sorted(_pk))
check("...as the engine actually has it, not as it was asked",
      _pk["look"] == {"size": 480.0, "gapDeg": 2.0, "corner": 6.0}, _pk.get("look"))
_tr.down = False
_run(_w, 60, pose=CENTRE)
# The drawing mirrors the same three numbers, so a limit changed on one side and not the other
# would let the panel offer a wheel the engine refuses to store.
_JS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "web", "js", "rf-46a-wheel-shape.js")
with open(_JS, "r", encoding="utf-8") as _f:
    _shape = _f.read()
for _nm, _v in (("WHEEL_GAP_MAX", rf.RadialMenu.GAP_MAX), ("WHEEL_GAP_MIN", rf.RadialMenu.GAP_MIN),
                ("WHEEL_CORNER_MAX", rf.RadialMenu.CORNER_MAX),
                ("WHEEL_CORNER_MIN", rf.RadialMenu.CORNER_MIN),
                ("WHEEL_SIZE_MAX", rf.RadialMenu.SIZE_MAX),
                ("WHEEL_SIZE_MIN", rf.RadialMenu.SIZE_MIN),
                ("WHEEL_SIZE_DEF", rf.RadialMenu.DEFAULTS["look"]["size"]),
                ("WHEEL_GAP_DEF", rf.RadialMenu.DEFAULTS["look"]["gapDeg"]),
                ("WHEEL_CORNER_DEF", rf.RadialMenu.DEFAULTS["look"]["corner"])):
    check("the drawing mirrors %s" % _nm,
          ("%s = %d" % (_nm, int(_v))) in _shape, _nm)

# ============================================ s. WIELKOŚĆ PISMA (`fontScale`) =================
# A MULTIPLIER, not a size in pixels — there is no single size to set: the label is worked out from
# the ring's thickness and the middle from the hub's radius. And it is the ONE key in `look` that is
# only written when it says something, so that a wheel saved before it existed comes back out of the
# sanitizer byte for byte.
print("\n--- wielkość pisma: krotność, nie piksele ---")
check("a wheel that says nothing about it does not GET the key",
      "fontScale" not in S({})["look"], S({})["look"])
check("...and one that says 1.0 does not store it either — at 1.0 it changes nothing",
      "fontScale" not in S({"look": {"fontScale": 1.0}})["look"],
      S({"look": {"fontScale": 1.0}})["look"])
check("a multiplier that says something IS stored",
      S({"look": {"fontScale": 1.25}})["look"]["fontScale"] == 1.25)
check("past the ceiling it is cut to it",
      S({"look": {"fontScale": 9}})["look"]["fontScale"] == rf.RadialMenu.FONT_MAX)
check("...and below the floor raised to it",
      S({"look": {"fontScale": 0.1}})["look"]["fontScale"] == rf.RadialMenu.FONT_MIN)
check("an unreadable multiplier leaves the shape alone",
      S({"look": {"fontScale": "duże"}})["look"] == _D,
      S({"look": {"fontScale": "duże"}})["look"])
check("it survives a round trip through the engine",
      _mk(slices=SL4, look={"fontScale": 1.4})[0].look().get("fontScale") == 1.4)
_w, _em, _tr = _mk(slices=SL4)
_w.set_config({"look": {"fontScale": 1.5, "size": 400}})
_tr.down = True
_run(_w, 350, pose=CENTRE)
_run(_w, 100, pose=UP)
_pk = [e for e in _w.b.events if e.get("t") == "wheel"][-1]
check("...and travels in the packet, like the rest of the shape",
      _pk["look"].get("fontScale") == 1.5, _pk.get("look"))
_tr.down = False
_run(_w, 60, pose=CENTRE)
for _nm, _v in (("WHEEL_FONT_MIN", rf.RadialMenu.FONT_MIN),
                ("WHEEL_FONT_MAX", rf.RadialMenu.FONT_MAX),
                ("WHEEL_FONT_DEF", rf.RadialMenu.FONT_DEF)):
    _m = re.search(r"%s = ([0-9.]+)" % _nm, _shape)
    check("the drawing mirrors %s" % _nm,
          _m is not None and abs(float(_m.group(1)) - float(_v)) < 1e-12,
          _m.group(1) if _m else "brak")
check("...and a missing key reads as 1.0 there too, not as zero",
      "fontScale: isFinite(f) ?" in _shape and "WHEEL_FONT_DEF" in _shape)
# The drawing multiplies EVERY piece of lettering by it — labels, icons and the middle — and caps
# each one by the room it has, so a big multiplier cannot push a name out of its own slice.
_JS_W = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-46-wheel.js")
with open(_JS_W, "r", encoding="utf-8") as _f:
    _draw = _f.read()
check("labels, icons and the middle all go through the multiplier",
      _draw.count("_whFs(") == 3, _draw.count("_whFs("))
check("...with a ceiling worked out from the room each one has",
      "look.fontScale, ring * 0.46" in _draw and "look.fontScale, hubR * 0.34" in _draw)
check("at 1.0 the helper is a no-op, by construction",
      "Math.min(base * (fs > 0 ? fs : 1), Math.max(base, room))" in _shape)
# The size is written into the tree as an ATTRIBUTE, so the tree has to be rebuilt when it changes —
# without this the slider would do nothing until somebody happened to add a slice.
check("the multiplier is part of the structure signature",
      "Math.round((look.fontScale || 1) * 100)" in _draw)

# ============================================ t. PIERŚCIEŃ ODLICZANIA =========================
# In the modes that confirm by WAITING, the only thing standing between "it is thinking" and "it is
# broken" is seeing how much time is left. The ring lives on the hub's circumference and closes from
# twelve o'clock, which is also where the first slice sits.
print("\n--- odliczanie: pierścień w środku koła ---")
_CSS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "web", "css", "17-wheel.css")
with open(_CSS, "r", encoding="utf-8") as _f:
    _wcss2 = _f.read()
check("the hub carries a countdown ring", 'class="wh-dwell"' in _draw)
check("...measured in hundredths, so cd=0.5 is half the circumference",
      'pathLength="100"' in _draw and 'stroke-dasharray="100"' in _draw
      and "Math.round(100 - cd * 100)" in _draw)
check("...starting at twelve o'clock, like the first slice",
      "transform:rotate(-90deg)" in _wcss2)
check("...in the accent colour, thick enough to read",
      ".wh-dwell{fill:none;stroke:var(--w-accent);stroke-width:3.2" in _wcss2)
check("...and it is only lit while something is really counting",
      '_whCls(S.dwell, "run", cd > 0.01)' in _draw and ".wh-dwell.run{opacity:1}" in _wcss2)
# „Less motion" may not take this away: it is not decoration, it is how long is left. The media
# query only drops its TRANSITION, so it steps instead of gliding.
_rm = _wcss2.split("prefers-reduced-motion")[-1]
check("less motion keeps the ring, it only stops it gliding",
      "wh-dwell" in _rm
      and re.search(r"\.wh-dwell[^{]*\{[^}]*(display\s*:\s*none|opacity\s*:\s*0)", _rm) is None,
      _rm[:120])

# ============================================ u. PRESETY KOŁA =================================
# A preset is a whole wheel under a name, minus the On switch. Stored once for every slot, because
# what is being saved is a MENU somebody designed, not a property of the capsule it was typed on.
print("\n--- presety: całe koło pod nazwą ---")
_pdir = tempfile.mkdtemp(prefix="rf-presets-")
_old_pf, _old_sd = rf.WHEEL_PRESETS_FILE, rf.SETTINGS_DIR
rf.WHEEL_PRESETS_FILE = os.path.join(_pdir, "presets.json")
rf.SETTINGS_DIR = _pdir
try:
    check("nothing saved yet reads as an empty list, not as an error",
          rf.load_wheel_presets() == [])
    _ok, _err, _lst = rf.wheel_preset_put(
        {"name": "  Elden Ring  ", "category": "Gry",
         "config": {"enabled": True, "confirm": "tilt-hold", "slices": SL4,
                    "look": {"fontScale": 1.3}}})
    check("a preset is stored under its trimmed name", _ok and _lst[0]["name"] == "Elden Ring",
          (_ok, _err))
    check("...with its category and the moment it was saved",
          _lst[0]["category"] == "Gry" and len(_lst[0]["created"]) >= 10, _lst[0].get("created"))
    check("THE ON SWITCH IS NOT PART OF IT — a file may not arm an output",
          "enabled" not in _lst[0]["config"], sorted(_lst[0]["config"]))
    check("...but the whole rest of the wheel is",
          _lst[0]["config"]["confirm"] == "tilt-hold"
          and _lst[0]["config"]["look"]["fontScale"] == 1.3)
    check("the config goes through the engine's own sanitizer, not a second one",
          rf.wheel_preset_put({"name": "Brudny", "config": {
              "slices": [{"label": "x" * 99, "spec": "layer:2"}, {"label": "b"}],
              "confirm": "spirala"}})[2][-1]["config"]["confirm"] == "release")
    check("...so a name past the ceiling arrives trimmed, not refused",
          len(rf.load_wheel_presets()[-1]["config"]["slices"][0]["label"])
          == rf.RadialMenu.LABEL_MAX)
    check("a nameless preset is refused, and says so",
          rf.wheel_preset_put({"name": "  ", "config": {"slices": SL4}})[:2]
          == (False, "Podaj nazwę presetu."))
    check("...and so is a wheel with nothing to choose between",
          rf.wheel_preset_put({"name": "Puste", "config": {"slices": []}})[0] is False)
    _n0 = len(rf.load_wheel_presets())
    rf.wheel_preset_put({"name": "elden ring", "category": "Soulsy", "config": {"slices": SL4}})
    check("the same name saved again REPLACES, it does not pile up (case and spaces do not count)",
          len(rf.load_wheel_presets()) == _n0, [p["name"] for p in rf.load_wheel_presets()])
    check("...in place, so the list somebody is reading does not reshuffle",
          rf.load_wheel_presets()[0]["category"] == "Soulsy")
    _ok, _err, _lst = rf.wheel_preset_rename("Elden Ring", "Elden Ring 2", "Gry")
    check("renaming changes the label and leaves the wheel alone",
          _ok and _lst[0]["name"] == "Elden Ring 2" and _lst[0]["category"] == "Gry")
    check("...and refuses to make two presets with one name",
          rf.wheel_preset_rename("Brudny", "Elden Ring 2", "")[:2]
          == (False, "Preset o tej nazwie już jest."))
    check("deleting takes one out and answers with the list",
          [p["name"] for p in rf.wheel_preset_drop("Elden Ring 2")] == ["Brudny"])
    check("...and deleting one nobody has is not an error",
          len(rf.wheel_preset_drop("nie ma takiego")) == 1)
    # The ceiling is a real refusal rather than a silent drop: a preset that vanished on save is
    # worse than one that was never offered.
    for _i in range(rf.WHEEL_PRESET_MAX):
        rf.wheel_preset_put({"name": "P%d" % _i, "config": {"slices": SL4}})
    check("past the ceiling the file says no, out loud",
          rf.wheel_preset_put({"name": "jeszcze jeden", "config": {"slices": SL4}})[1]
          is not None)
    check("...and stops exactly at the ceiling",
          len(rf.load_wheel_presets()) == rf.WHEEL_PRESET_MAX,
          len(rf.load_wheel_presets()))
    # A file somebody hand-edited into nonsense costs the presets, never the panel.
    with open(rf.WHEEL_PRESETS_FILE, "w", encoding="utf-8") as _f:
        _f.write("{to nie jest json")
    check("a broken file reads as an empty list rather than taking the app down",
          rf.load_wheel_presets() == [])
finally:
    rf.WHEEL_PRESETS_FILE, rf.SETTINGS_DIR = _old_pf, _old_sd
    shutil.rmtree(_pdir, ignore_errors=True)

# ============================================ v. PIASKOWNICA GRA USTAWIONY TRYB ===============
# The stage used to know two gestures — click to open, click to pick — which is the "click, lean,
# click" mode, and it played them whatever was set in the card. Somebody who had picked "lean and
# hold" got a preview where nothing counted down and nothing was ever confirmed, and learnt from it
# that the mode is broken (owner, 2026-08-26).
print("\n--- piaskownica: myszą gra się to, co jest ustawione ---")
_JS_L = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-46d3-wheel-stage-life.js")
with open(_JS_L, "r", encoding="utf-8") as _f:
    _life = _f.read()
check("the sandbox asks what mode is set", "function _whMode" in _life
      and "function _whLeanMode" in _life and "function _whWaitMode" in _life)
check("...opens the wheel by LEAN in the modes that have no button",
      "wheelOpenBar(dz)" in _life and 'whStageOpen("lean")' in _life)
check("...and closes it again when the pointer comes back to the middle",
      "S.open && mag < dz" in _life)
check("the countdown is worked out from the same clock the engine uses",
      "function _whStageTick" in _life and "S.cd = Math.max(0, Math.min(1," in _life)
check("...and a change of target zeroes it, exactly like in the engine",
      'if (key !== S.cdKey) { S.cdKey = key; S.cdT = Date.now(); S.cd = 0; return; }' in _life)
check("a parent opens on subOpenMs, a leaf confirms on confirmMs",
      "function _whStageCdMs" in _life and "+W.subOpenMs || 300" in _life
      and "+W.confirmMs || 600" in _life)
check("clicks STEP the choice in „step through it with clicks”",
      "function _whStageStep" in _life and '(cur + 1) % n' in _life)
check("...and a wheel woken by accident there sends nothing, it just goes back to sleep",
      "if (cyc && (!S.awake || S.clicks <= 0))" in _life and "function _whStageSleep" in _life)
check("...while the first click only WAKES it, exactly as the engine does",
      "if (!S.awake) {" in _life and "S.awake = true;" in _life)
check("...and holding the button is the way out of it",
      "function _whStageCycHold" in _life and "+((state.wheel || {}).holdMs)" in _life)
# A CALL, not the word: the name appears in a comment in _whStageOff, saying why the button there
# does NOT arm anything. A check that a word is absent is a check somebody will "fix" by renaming.
check("nothing on that path reaches the server or the arming switch",
      "/wheel" not in _life.split("function _whStageTick")[1].split("function _whStageCdMs")[0]
      and "rfSimConfirmOn(" not in _life)
# The opening bar has to be the engine's, or the preview would open where a real lean would not.
for _nm, _v in (("WHEEL_OPEN_MAG", rf.RadialMenu.OPEN_MAG),
                ("WHEEL_OPEN_GAP", rf.RadialMenu.OPEN_GAP),
                ("WHEEL_OPEN_CAP", rf.RadialMenu.OPEN_CAP)):
    _m = re.search(r"^const %s = ([0-9.]+);" % _nm, _draw, re.M)
    check("the drawing mirrors %s" % _nm,
          _m is not None and abs(float(_m.group(1)) - float(_v)) < 1e-12,
          _m.group(1) if _m else "brak")
_wb, _, _ = _mk()
for _dz in (0.10, 0.34, 0.7):
    _wb.cfg["deadzone"] = _dz
    check("...and the same bar for dz=%.2f" % _dz,
          abs(_wb._open_bar() - min(rf.RadialMenu.OPEN_CAP,
                                    max(rf.RadialMenu.OPEN_MAG, _dz + rf.RadialMenu.OPEN_GAP)))
          < 1e-12)

# ============================================ w. PUSTE POLE ==================================
# A slice with no action, no macro and no children. Asked for by the owner (2026-08-27) in exactly
# these words: "dodaj możliwość dodania pustego pola (bez przycisku), które jak jest wybrane - nie
# działa. dla osób, które nie umieją utrzymać przycisku prosto równo."
#
# WHAT IS ACTUALLY BEING PINNED DOWN HERE, and it is not "nothing was sent" — an empty slice would
# send nothing by accident anyway, because _fire has neither a spec nor a macro to run:
#
#   * IT IS NOT A NEW SETTING. "Empty" is read off the fields a slice already has, so every wheel
#     ever saved loads unchanged and typing an action takes the state away by itself. A test that
#     lets a new key creep into the config is the one that matters here.
#   * IT ENDS THE WHEEL, in all five modes. A slice that quietly did nothing AND left the wheel
#     hanging would be worse than no feature at all: the next press would meet a wheel already up.
#   * IN tilt-hold THE COUNTDOWN DOES NOT RUN. That is the whole accessibility promise: a hand may
#     REST on this slice. A ring creeping round the hub would say "something is about to go out",
#     which is the opposite of what the slice is for.
#   * THE CLOSING PACKET SAYS WHY. One key, on one packet, so a drawing can say "nothing went out"
#     instead of leaving a person guessing from the absence of an effect.
print("\n--- puste pole: wycinek, który nic nie wysyła ---")
E = rf.RadialMenu.is_empty
check("a slice with neither an action nor a macro is empty",
      E({"label": "Odpocznij", "spec": "", "sequence": ""}) is True)
check("...whitespace is not an action", E({"label": "x", "spec": "  ", "sequence": " "}) is True)
check("a slice with an action is not", E({"label": "x", "spec": "a", "sequence": ""}) is False)
check("...nor is one with a macro", E({"label": "x", "spec": "", "sequence": "ctrl+c"}) is False)
check("...nor is a parent, however bare it looks",
      E({"label": "x", "spec": "", "sequence": "", "children": [{"spec": "a"}]}) is False)
check("...nor is the synthetic „Wstecz” — that one is a door",
      E(dict(rf.RadialMenu.BACK_ITEM)) is False)
check("...and nonsense is not an empty slice either", E(None) is False and E("x") is False)

# ZERO NEW CONFIG KEYS. This is the promise the whole feature rests on: an empty slice travels in
# presets, exports and old files as an ordinary slice, because that is exactly what it is.
SL_MT = [{"label": "Góra", "spec": "up"}, {"label": "Odpocznij", "spec": "", "sequence": ""},
         {"label": "Dół", "spec": "down"}, {"label": "Lewo", "spec": "left"}]
c = rf.RadialMenu.sanitize({"enabled": True, "slices": SL_MT})
check("an empty slice comes out of the sanitizer byte for byte as it went in",
      c["slices"][1] == {"label": "Odpocznij", "spec": "", "sequence": ""}, c["slices"][1])
check("...and the config grows no key for it",
      sorted(c) == ["alwaysOn", "configName", "confirm", "confirmMs", "deadzone", "enabled",
                    "holdMs", "iconChips", "look", "showWhere", "slices", "subOpenMs",
                    "submenuMode", "trigger", "triggerAxis", "triggerMag"], sorted(c))
check("...a wheel made only of empty slices is still a wheel (2 is 2)",
      rf.RadialMenu.sanitize({"enabled": True, "slices": [{"label": "a"}, {"label": "b"}]})
      ["enabled"] is True)


def _wheel_packets(w):
    return [e for e in w.b.events if e.get("t") == "wheel"]


# --- 1. „Trzymaj przycisk i puść" -------------------------------------------------------------
w, em, tr = _mk(SL_MT)
tr.down = True
_run(w, 400, pose=RIGHT)
check("the wheel opens on the empty slice like on any other",
      w.open is True and w.idx == 1, (w.open, w.idx))
tr.down = False
_run(w, 40, pose=RIGHT)
check("letting go on it sends nothing", em.taps == [], em.taps)
check("...and the wheel closes, exactly as cancelling does", w.open is False, w.open)
_pk = _wheel_packets(w)
check("the closing packet says WHAT ended the wheel",
      (_pk[-1].get("end") or {}).get("why") == "empty", _pk[-1].get("end"))
check("...and which slice it was, by name",
      (_pk[-1].get("end") or {}).get("path") == ["Odpocznij"], _pk[-1].get("end"))
check("...and no other packet carries the signal",
      not any("end" in p for p in _pk[:-1]), [i for i, p in enumerate(_pk) if "end" in p])
check("every slice of the packet says whether it is empty",
      [i["empty"] for i in _pk[-1]["bands"][0]["items"]] == [False, True, False, False],
      _pk[-1]["bands"][0]["items"])

# CANCELLING IS NOT AN EMPTY SLICE. Both end with nothing sent, and the person must be able to tell
# them apart — one is "I changed my mind", the other is "I landed where nothing happens".
w, em, tr = _mk(SL_MT)
tr.down = True
_run(w, 400, pose=CENTRE)
tr.down = False
_run(w, 40, pose=CENTRE)
check("letting go in the middle still just cancels", w.open is False and em.taps == [])
check("...without the empty-slice signal",
      not any("end" in p for p in _wheel_packets(w)))

# --- 2. „Pochyl i przytrzymaj": THE RESTING PLACE ---------------------------------------------
w, em, tr = _mk(SL_MT, confirm="tilt-hold", confirmMs=300)
_run(w, 300, pose=RIGHT)
check("a big lean opens it on the empty slice", w.open is True and w.idx == 1, (w.open, w.idx))
_run(w, 2000, pose=RIGHT)
check("the countdown never starts there — this is a place to rest, not a decision",
      w._cd == 0.0, w._cd)
check("...so nothing is ever sent, however long the hand stays", em.taps == [], em.taps)
check("...and the wheel is still up, waiting for a real choice", w.open is True, w.open)
check("...and the drawing is told the ring is not running",
      _wheel_packets(w)[-1]["cd"] == 0.0, _wheel_packets(w)[-1]["cd"])
_run(w, 400, pose=DOWN)
check("moving off it to a real slice sends that one, with its own full wait",
      em.taps == ["down"], em.taps)

w, em, tr = _mk(SL_MT, confirm="tilt-hold", confirmMs=300)
_run(w, 300, pose=RIGHT)
_run(w, 1500, pose=RIGHT)
_run(w, 200, pose=CENTRE)
check("resting on it and then coming home closes the wheel with nothing sent",
      w.open is False and em.taps == [], (w.open, em.taps))
check("...and that is a cancel, so it carries no signal either",
      not any("end" in p for p in _wheel_packets(w)))

# --- 3. „Pochyl i kliknij" ---------------------------------------------------------------------
w, em, tr = _mk(SL_MT, confirm="tilt-click", holdMs=300)
_run(w, 300, pose=RIGHT)
check("open on the empty slice", w.open is True and w.idx == 1, (w.open, w.idx))
tr.down = True
_run(w, 100, pose=RIGHT)
tr.down = False
_run(w, 40, pose=RIGHT)
check("a click on it sends nothing and closes the wheel",
      em.taps == [] and w.open is False, (em.taps, w.open))
check("...saying why", (_wheel_packets(w)[-1].get("end") or {}).get("why") == "empty")

# --- 4. „Kliknij, pochyl, kliknij" -------------------------------------------------------------
w, em, tr = _mk(SL_MT, confirm="click", holdMs=300)
tr.down = True
_run(w, 100, pose=CENTRE)
tr.down = False
_run(w, 40, pose=CENTRE)
check("a click opens it", w.open is True, w.open)
_run(w, 100, pose=RIGHT)
tr.down = True
_run(w, 100, pose=RIGHT)
tr.down = False
_run(w, 40, pose=RIGHT)
check("the deciding click on an empty slice sends nothing and closes it",
      em.taps == [] and w.open is False, (em.taps, w.open))
check("...saying why", (_wheel_packets(w)[-1].get("end") or {}).get("why") == "empty")

# --- 5. „Przełączaj kliknięciami" --------------------------------------------------------------
# Here the countdown DOES run over an empty slice, and that is deliberate: waiting is the only way
# this mode confirms anything, so a frozen ring would leave the wheel with no way out at all. What
# it confirms is still "nothing" — the wheel closes and no key goes anywhere.
w, em, tr = _mk(SL_MT, confirm="cycle", confirmMs=300, holdMs=400, alwaysOn=False)
_click(w, tr, DOWN)
check("a click opens it", w.open is True, w.open)
for _ in range(2):
    tr.down = True
    _run(w, 100, pose=DOWN)
    tr.down = False
    _run(w, 40, pose=DOWN)
check("two clicks step the choice onto the empty slice", w.idx == 1, w.idx)
_run(w, 400, pose=DOWN)
check("waiting it out sends nothing", em.taps == [], em.taps)
check("...and closes the wheel rather than leaving it hanging", w.open is False, w.open)
check("...saying why", (_wheel_packets(w)[-1].get("end") or {}).get("why") == "empty")

# --- 6. W PODMENU ------------------------------------------------------------------------------
# The signal carries the whole path, because "Odpocznij" alone would not say which one: a wheel may
# have a resting place on every level, and that is a perfectly sensible wheel.
SL_SUB = [{"label": "Media", "spec": "", "sequence": "",
           "children": [{"label": "Cisza", "spec": "media:mute"},
                        {"label": "Odpocznij", "spec": "", "sequence": ""}]},
          {"label": "Dół", "spec": "down"}]
w, em, tr = _mk(SL_SUB, submenuMode="replace", subOpenMs=200)
tr.down = True
_run(w, 400, pose=UP)          # otwiera koło, wskazuje rodzica („Media")
_run(w, 300, pose=UP)          # …i po subOpenMs wchodzi w jego dzieci
check("the parent's children are open", w.path == [0], w.path)
_run(w, 100, pose=DOWN)        # dzieci: 0 = „Cisza" (góra), 1 = „Odpocznij" (dół)
check("pointing at the empty child", w.idx == 1, w.idx)
tr.down = False
_run(w, 40, pose=DOWN)
check("letting go on it sends nothing", em.taps == [], em.taps)
_end = (_wheel_packets(w)[-1].get("end") or {})
check("...and the signal names the whole path to it",
      _end.get("path") == ["Media", "Odpocznij"], _end)
# „Media" has neither an action nor a macro of its own — and is still not an empty slice, because
# it has somewhere to lead. The distinction matters: a door that drew itself as a resting place
# would be the one slice on the wheel that lies about what it does.
check("a parent is NOT an empty slice, however bare its own fields are",
      _wheel_packets(w)[-1]["bands"][0]["items"][0]["empty"] is False,
      _wheel_packets(w)[-1]["bands"][0]["items"][0])

# --- 7. RYSUNEK, EDYTOR I SCENA ----------------------------------------------------------------
# One idea, four surfaces: the drawing has to look calmer, the editor has to say "puste", the
# sandbox has to answer "nothing was sent", and the guide has to explain what it is for.
_JS_C = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-46c-wheel-tree.js")
with open(_JS_C, "r", encoding="utf-8") as _f:
    _tree = _f.read()
_JS_B = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-46b-wheel-card.js")
with open(_JS_B, "r", encoding="utf-8") as _f:
    _card = _f.read()
_JS_S = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-46d-wheel-stage.js")
with open(_JS_S, "r", encoding="utf-8") as _f:
    _stage = _f.read()
_CSS_W = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                      "web", "css", "17-wheel.css")
with open(_CSS_W, "r", encoding="utf-8") as _f:
    _wcss = _f.read()
_CSS_T = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                      "web", "css", "03-triggers.css")
with open(_CSS_T, "r", encoding="utf-8") as _f:
    _tcss = _f.read()

check("the editor works out „empty” from the fields, it never writes it onto a slice",
      "function whIsEmptySlice" in _tree and ".empty =" not in _tree
      and "empty:" not in _tree)
check("...both add buttons dodają DOKŁADNIE ten sam obiekt",
      "function whAddSlice" in _tree
      and _tree.count('sl.push({ label: "", spec: "", sequence: "" })') == 1)
check("...and the card wires the second one to it",
      'id="whAddEmpty"' in _card and "whAddSlice(true)" in _card
      and "whAddSlice(false)" in _card)
check("...with the count guarding both", 'getElementById("whAddEmpty")' in _tree
      and "adm.disabled = full" in _tree)
check("the badge lives in every row and is shown by the row's class",
      "wh-badge-empty" in _tree and ".wh-slice.is-empty .wh-badge-empty{display:block}" in _tcss
      and ".wh-badge-empty{display:none" in _tcss)
check("...and it flips under the fingers, without redrawing the list",
      # 5 = the definition + typing, quick pick, macro and the "press a key" capture (⌨)
      "function whMarkEmpty" in _tree and _tree.count("whMarkEmpty(row") == 5)
check("the action fields are muted, not disabled — typing is how you stop being empty",
      ".wh-slice.is-empty .wh-spec" in _tcss
      and ".wh-slice.is-empty .wh-spec[disabled]" not in _tcss
      and ".wh-slice.is-empty:focus-within .wh-spec" in _tcss)
# ▲▼ były jedynymi kontrolkami poniżej 10 px (8 px glif w 20×13 px), potem 22×16. Od UX 261120
# (P-G1-10, P0) cel ma co najmniej 28×24 px, na znakach ▴ ▾ z fontu filcowego: trafienie palcem
# opiekuna jest ważniejsze niż wiersz wycinka o jedną linijkę niższy.
_ord = _tcss.split(".wh-ord button{", 1)[1].split("}", 1)[0] if ".wh-ord button{" in _tcss else ""
check("the order arrows are a 28×24 px target",
      "height:24px" in _ord and "width:28px" in _ord
      and "font-size:8px" not in _ord and "height:13px" not in _ord and "height:16px" not in _ord)
check("...drawn with the felt-font glyphs ▴ ▾",
      ">▴</button>" in _tree and ">▾</button>" in _tree and ">▲</button>" not in _tree)
# Usunięcie wycinka od razu, z „Cofnij” przez wspólny rfUndo (rf-06), jak reguła w Mapowaniu.
check("deleting a slice gives Undo through rfUndo, with the whole wheel and the level in the snapshot",
      "rfUndo({" in _tree and "state.wheel.slices = snap.slices" in _tree and "state.wheelPath = snap.path" in _tree)
check("the drawing gives an empty slice no icon and no chip",
      "const mt = !!it.empty;" in _draw and 'const ico = mt ? "" : String(it.icon || "");' in _draw
      and 'const col = mt ? "" : _whCol(it.color);' in _draw)
check("...marks it in the tree, so it is part of the structure signature",
      '(mt ? " is-empty" : "")' in _draw and "(s.empty ? 16 : 0)" in _draw)
check("...and the middle of the wheel says it out loud instead of how to confirm",
      'if (it.empty) s += \'<div class="wh-hub-hint">\' + e(_wheelT("nic nie wysyła"' in _draw)
check("...also to a screen reader", '"puste pole, nic nie wysyła"' in _draw)
check("the drawing is calmer, and its highlight is neutral rather than the accent",
      ".wh-sl.is-empty{--sc:var(--w-dim)}" in _wcss
      and ".wh-sl.is-empty .wh-fill{opacity:" in _wcss)
check("the sandbox mirrors the flag into its own packet",
      "empty: whIsEmptySlice(s)" in _stage)
check("...does not count down over it in „lean and hold”",
      "_whStageHoverEmpty()" in _life and "function _whStageEmptyAt" in _life)
check("...says „nothing was sent” after picking one",
      '_wheelT("Nic nie wysłano (puste pole)", "Nothing sent (empty slice)")' in _life)
check("...and writes it in the log with the difference marked",
      'whStageLog(whCrumbLabels().concat([it.label || _wheelT("bez nazwy", "unnamed")]), "empty")'
      in _life)
check("the same answer arrives from a REAL capsule, through the closing packet",
      "function _whStageEnd" in _life and "live._whEndDone" in _life
      and "_whStageEnd(live)" in _stage)
_JS_I = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-01-i18n.js")
with open(_JS_I, "r", encoding="utf-8") as _f:
    _i18n = _f.read()
# The label lost its textual "+" (the .bic-plus PNG stands in front of it, like every other "add"
# button of the panel — UX iteration 1, item 1.12), so the key is the bare noun phrase.
check("the new button has English", '"puste pole":"empty slice"' in _i18n)
# The badge is composed with _wheelT at RENDER time, so the DOM walker cannot reach it — the list
# has to be drawn again on a language switch, and then walked (setLang calls applyLang BEFORE this
# hook, and the rows' static titles are Polish in the HTML).
check("switching the language redraws the slice list and re-walks it",
      "whRenderSlices();" in _card.split("function whRelang")[1].split("\n}")[0]
      and "applyLang(box)" in _card.split("function whRelang")[1].split("\n}")[0])
_JS_T = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-34-tabs.js")
with open(_JS_T, "r", encoding="utf-8") as _f:
    _tabs = _f.read()
# PORADNIK KOŁA PRZEPROWADZIŁ SIĘ 2026-08-31 z rf-34 (sekcja „8." poradnika Mapowania) do rf-39b,
# gdzie mieszkają poradniki wszystkich pozostałych modułów — koło dostało własną zakładkę
# „Informacje". Ta asercja pilnuje TREŚCI, nie adresu pliku, więc szuka jej tam, gdzie teraz jest.
# W rf-34 sprawdzamy przy okazji, że po sekcji został ODSYŁACZ, a nie dziura: czytelnik Mapowania
# ma się dowiedzieć, że koło istnieje i gdzie o nim przeczyta.
_JS_G = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-39b-guides.js")
with open(_JS_G, "r", encoding="utf-8") as _f:
    _guides = _f.read()
check("the guide explains what an empty slice is FOR, not just that it exists",
      "Wycinek może być PUSTY" in _guides and "nie utrzyma przycisku równo" in _guides
      and '"Wycinek może być PUSTY":"A slice can be EMPTY"' in _i18n)
check("the wheel guide has a tab of its own, and Mapping points at it",
      'id:"kolo",panel:"tab-kolo"' in _guides
      and "8. Koło wyboru" in _tabs and "Informacje" in _tabs.split("8. Koło wyboru")[1][:600])


# ------------------------------------------------------------------------------------------
#  SPIS WYCINKÓW W KOLUMNIE KAPSLA (rf-46g) — ściąga „Nakładka"
# ------------------------------------------------------------------------------------------
# Ściąga jest spisem tego, co WYSYŁA każdy kapsel, a koła w tym spisie nie było: rysunek pojawiał
# się tam wyłącznie na sekundy wyboru, więc ekran odpowiadał na swoje własne pytanie połowicznie.
# Koło jest przy tym ustawiane PER KAPSEL, a panel znał dotąd tylko konfigurację tego jednego,
# który jest edytowany — stąd rozgłoszenie `wheel_cfg` i cała reszta poniżej.
_JS_M = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-46g-wheel-list.js")
with open(_JS_M, "r", encoding="utf-8") as _f:
    _wlist = _f.read()
check("the slice list has its own file, drawn from the capsule's own config",
      "function wheelColumnHtml" in _wlist and "D.wheelCfg" in _wlist)
# FEWER THAN TWO SLICES IS NOT A WHEEL (RadialMenu.MIN_SLICES): a capsule nobody ever gave a wheel
# must not get a list in its column about a feature it does not use.
check("a capsule without a wheel gets no list", "sl.length < 2" in _wlist and 'return "";' in _wlist)
# A switched-off wheel STAYS in the list, only dimmed: "it is there but off" is a different answer
# from "there is none", and the cheat sheet is read at a glance.
check("a switched-off wheel is dimmed, not hidden", 'is-off' in _wlist and "W.enabled" in _wlist)
check("modes are named from WHEEL_MODES, the same table the card uses", "WHEEL_MODES.find" in _wlist)
# The redraw is guarded by a SIGNATURE of what is on screen: `wheel_cfg` arrives on every config
# change, including a drag of the size slider, and rebuilding five columns per step would be felt.
check("the cheat sheet is redrawn only when the list itself changed",
      "function wheelColSig" in _wlist and "changed && typeof renderOverview" in _wlist)
_JS_S = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-08-sse-ui.js")
with open(_JS_S, "r", encoding="utf-8") as _f:
    _sse = _f.read()
# ABOVE the active-capsule gate, for the same reason the LED and the pad are: the cheat sheet draws
# every capsule at once, so a config that only reached the edited one would leave four columns mute.
check("wheel_cfg is kept for EVERY capsule, not just the active one",
      't==="wheel_cfg"' in _sse
      and _sse.index('t==="wheel_cfg"') < _sse.index("if(!activeNow)return;"))
_JS_D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-11-devices-ui.js")
with open(_JS_D, "r", encoding="utf-8") as _f:
    _dev = _f.read()
check("the list sits between the live wheel and the rules",
      _dev.index("wheelOverviewHtml(dev)") < _dev.index("wheelColumnHtml(dev)")
      < _dev.index('<div class="ov-rules">'))
# The server has to SAY it, and twice: broadcast on change, snapshot for a window that opens later.
_PY_SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "ribbitflip_monitor.py")
with open(_PY_SRC, "r", encoding="utf-8") as _f:
    _src_py = _f.read()
check("the engine broadcasts its config, and a fresh client gets a snapshot",
      'def _emit_cfg' in _src_py and '"t": "wheel_cfg"' in _src_py
      and _src_py.count('"wheel_cfg"') >= 2)

# ------------------------------------------------------------------------------------------
#  KOŁO STOI W KOLUMNIE TAKŻE ZAMKNIĘTE (rysunek spoczynkowy)
# ------------------------------------------------------------------------------------------
# Kolumna kapsla to zestaw obrazków widocznych ZAWSZE (kula orientacji, kontroler, pasek naciśnięć);
# koło było jedynym, które pokazywało się wyłącznie na te dwie sekundy, w których ktoś je trzyma —
# więc na pytanie „czy ten kapsel ma koło i jak ono wygląda" ściąga nie odpowiadała, choć moduł był
# włączony: moduł koła był włączony, a koła nie było widać.
check("a closed wheel still has something to show: a packet built from the config alone",
      "function wheelIdleState" in _wlist and "idle: true" in _wlist
      and "bands: [{ items: items" in _wlist)
# THE SAME THRESHOLD AS THE LIST, so the picture and the list appear and vanish together — a column
# that says "there is a wheel" in words and nothing in shape would be answering itself twice.
check("the idle drawing obeys the same two-slice threshold as the list",
      "sl.length < WHEEL_MIN_SLICES" in _wlist)
_JS_W = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-46-wheel.js")
with open(_JS_W, "r", encoding="utf-8") as _f:
    _wheel_js = _f.read()
check("the frame loop draws the idle wheel when no live packet says otherwise",
      "wheelIdleState(D)" in _wheel_js and "const live = !!(st && st.open)" in _wheel_js)
# OVER THE GAME NOTHING CHANGES: rf-41 decided the wheel "costs no room until somebody holds the
# button", and a permanent square in a small overlay window would be a change nobody asked for.
check("...but only in the panel — the overlay over the game stays as it was",
      "function whIdleHere" in _wheel_js and "!RF_OVL" in _wheel_js)
# A hint that says "let go to cancel" over a wheel nobody opened would be the one untrue sentence
# on the whole cheat sheet.
check("the idle hub says nothing about letting go", "!small && !st.idle" in _wheel_js)
# The idle picture is a THUMBNAIL: true-to-game size answers "how much room will this take", which
# is a question for the moment of choosing, not for a column read at a glance.
check("the idle drawing drops the inline size and lets the CSS ceiling hold it",
      "if (st && st.idle) {" in _wheel_js and 'c.style.maxHeight = "";' in _wheel_js)
# …and it is DIMMED, because in a column full of live graphs brightness is what the eye follows.
_CSS_OV = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "web", "css", "13-dialogs-overview.css")
with open(_CSS_OV, "r", encoding="utf-8") as _f:
    _css_ov = _f.read()
check("a resting wheel is quieter than a live one",
      ".ov-wheel.is-idle{opacity:" in _css_ov and "max-height:220px" in _css_ov)

# ------------------------------------------------------------------------------------------
#  PAS KAPSLI W ZAKŁADCE (rf-46h) — czyje koło ustawiasz i co mają pozostałe
# ------------------------------------------------------------------------------------------
# Koło jest ustawiane PER KAPSEL, a karta pokazywała zawsze dokładnie jedno — tego kapsla, który
# był podświetlony w „Urządzeniach Triki" na górze strony. Nic na tej zakładce o tym nie mówiło,
# więc koło zrobione „dla Triki 3" zapisało się Triki 5 (zgłoszone 2026-08-28). Odpowiedź jest ta
# sama, co w zakładce „Kontroler", i celowo wygląda tak samo: pas kafli u góry + nagłówek nazywający
# ten jeden kapsel, którego ustawienia są pod spodem.
_JS_HUB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "web", "js", "rf-46h-wheel-caps.js")
with open(_JS_HUB, "r", encoding="utf-8") as _f:
    _caps = _f.read()
check("the tab has a strip of capsules, one tile each",
      "function wheelCapsHtml" in _caps and "function wheelCapsRender" in _caps
      and 'className = "wh-caps-tile' in _caps)
# ⚠️ REGRESJA NAZWY. `.wh-hub` to ŚRODEK KOŁA w rysunku (wh-hub-title/hint/crumb obok). Pas kapsli
# nazwany tak samo zabierał tamtemu jego reguły i dostawał jego — kafle wylądowały pod kartą, a
# każde koło w aplikacji dostało w środek ramkę i odstępy. Prefiks pasa musi zostać inny.
check("the strip does NOT borrow the class name of the wheel's own centre",
      "wh-hub" not in _caps
      and ".wh-caps{" in _wcss2 and ".wh-hub{" not in _wcss2.split("PAS KAPSLI")[-1])
check("a tile is the click that switches which capsule you edit",
      "switchDevice(dev)" in _caps and 'setAttribute("role", "button")' in _caps
      and '"Enter" || e.key === " "' in _caps)
# ⚠️ REGRESJA DOMKNIĘCIA. Kafle są przerysowywane rzadko — tanie odświeżenie przestawia klasy
# i teksty, a uchwyty zostają te same. Warunek „nie rób nic, bo TEN kafel jest edytowany" zapisany
# w chwili rysowania zamrażał odpowiedź sprzed przełączenia: kafel kapsla, który był edytowany przy
# pierwszym rysowaniu (czyli pierwszy w pasie), po przejściu na inny przestawał reagować na klik.
# Objaw: klik działał na kapslach 2, 3 i 4, a na 1 nie.
check("the click reads WHO is being edited now, not who was when it was drawn",
      "if (!active && typeof switchDevice" not in _caps
      and "const flip = () => {" in _caps and "_whCapsCfg(state.devices[dev]" in _caps)
# Lista rozwijana robi to samo, co klik w kafel — przy pięciu kapslach pas bywa szerszy niż okno,
# a wybór z listy jest jedyną drogą dla kogoś, kto nie celuje myszą.
check("...and so is the picker next to the heading",
      'id="whCapsPick"' in _caps and "function _whCapsPickRender" in _caps)
# UX 261120 L4e: pasek „Konfiguracja koła: Triki 1” zdjęty jak w Skanerze; kapsel nazywa chip
# w nagłówku modułu, a pas kafli (od dwóch kapsli) i lista wyboru mówią, który jest edytowany.
check("no separate 'Wheel configuration: <capsule>' bar above the card",
      'id="whCfgTitle"' not in _caps and 'id="whCfgHead"' not in _caps
      and "function _whCapsHeadSync" not in _caps)
# Kafel POKAZUJE koło, a nie opisuje je: ten sam renderer co scena i nakładka, tylko mały.
check("each tile draws the real wheel, with the one renderer",
      "wheelIdleState(" in _caps and "wheelSvgInto(host" in _caps
      and "WH_CAPS_MINI_PX" in _caps)
# Silnik odmawia włączenia koła bez wycinków (POST /wheel) — przełącznik na kaflu nie udaje,
# że się da, tylko mówi, czego brakuje.
check("a wheel with no slices cannot be switched on from the tile",
      "n < WHEEL_MIN_SLICES" in _caps and "Dodaj wycinki, zanim włączysz koło" in _caps)
# …a włączenie CUDZEGO koła przechodzi przez tę samą bramkę symulacji, co każde inne wyjście.
check("switching another capsule's wheel on still asks in simulation",
      'rfSimConfirmOn(true, apply, "wheel")' in _caps)
# Rysunek liczy się z WYMIARU pojemnika, a schowana zakładka wymiaru nie ma — więc pas dostaje
# swoje koła przy wejściu w zakładkę, PO nadaniu panelowi klasy `active`.
_JS_T = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-34-tabs.js")
with open(_JS_T, "r", encoding="utf-8") as _f:
    _tabs_js = _f.read()
check("entering the tab is what gives the tiles their drawings",
      'id==="kolo"&&typeof wheelCapsDraw==="function"' in _tabs_js
      and _tabs_js.index("rfStagger(_active)") < _tabs_js.index('id==="kolo"&&typeof wheelCapsDraw'))
with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "web", "ribbitflip_dashboard.html"), "r", encoding="utf-8") as _f:
    _html_caps = _f.read()
check("the strip is loaded after the list it borrows wheelIdleState from",
      _html_caps.index("rf-46g-wheel-list.js") < _html_caps.index("rf-46h-wheel-caps.js"))

# ------------------------------------------------------------------------------------------
#  TOŻSAMOŚĆ KONFIGURACJI NA KAPSLU (rf-46j)
# ------------------------------------------------------------------------------------------
# Koło kapsla było bezimienne: presety leżały w osobnej bibliotece, wczytanie robiło kopię i na tym
# związek się kończył — więc „co ten kapsel ma", „czy to jeszcze to, co zapisałem" i „które kapsle
# mają to samo" nie miały odpowiedzi nigdzie. Zapis ma więc siedzieć na kapslu, żeby użytkownik
# pracował na konfiguracjach.
check("a capsule's wheel carries the NAME of what it is running",
      "configName" in rf.RadialMenu.DEFAULTS
      and rf.RadialMenu.sanitize({"configName": "  Multi \n media  "})["configName"] == "Multi media")
check("...trimmed to the same length a preset name is",
      len(rf.RadialMenu.sanitize({"configName": "x" * 90})["configName"]) == rf.WHEEL_PRESET_NAME_MAX)
# ZAPISANEJ FLAGI „ZMIENIONE" NIE MA I NIE MOŻE BYĆ: rozjechałaby się z prawdą przy pierwszym
# zapisie, którego nikt nie przewidział. Panel liczy ją, porównując odciski (whCfgFingerprint).
check("...and nothing stores whether it was changed", "configDirty" not in rf.RadialMenu.DEFAULTS)
# GDZIE POKAZYWAĆ KOŁO ZOSTAJE PRZY KAPSLU (celowo). Preset, który wiózł to
# ze sobą, po cichu przenosił komuś koło w inne miejsce ekranu.
_pre = rf.sanitize_wheel_preset({"name": "T", "config": {"showWhere": "cursor", "configName": "X",
                                                         "enabled": True, "slices": SL4}})
check("a preset carries neither the place, nor the switch, nor a second name",
      "showWhere" not in _pre["config"] and "enabled" not in _pre["config"]
      and "configName" not in _pre["config"], sorted(_pre["config"]))
_JS_CFG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "web", "js", "rf-46j-wheel-config.js")
with open(_JS_CFG, "r", encoding="utf-8") as _f:
    _cfgjs = _f.read()
with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "web", "js", "rf-46e-wheel-io.js"), "r", encoding="utf-8") as _f:
    _io = _f.read()
check("the panel derives 'changed' instead of trusting a stored flag",
      "function whCfgFingerprint" in _cfgjs and "function whCfgState" in _cfgjs
      and "dirty: whCfgFingerprint(cfg) !== whCfgFingerprint(p.config" in _cfgjs)
# Odcisk musi obejmować DOKŁADNIE to, co preset zapisuje — pole liczone po jednej stronie robiłoby
# z każdego kapsla „zmieniony" od chwili wczytania.
check("the fingerprint covers exactly what a preset stores",
      "const WH_CFG_FIELDS" in _cfgjs and "showWhere" not in _cfgjs.split("WH_CFG_FIELDS")[1][:400]
      and "toFixed(3)" in _cfgjs)
with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "web", "js", "rf-46k-wheel-adapter.js"), "r", encoding="utf-8") as _f:
    _adapt = _f.read()
# ZAPIS, „ZAPISZ JAKO", PRZYWRÓCENIE I KOPIA NA INNY KAPSEL — po audycie UX 2026-09-02 idą tą samą
# drogą, co w pozostałych siedmiu modułach: przez adapter (rf-46k) do wspólnych okien rf-49a.
# Do tego dnia koło miało własny pasek z drugim kompletem tych samych czterech przycisków, a na
# jednym ekranie stały DWA identyczne „Zapisz zmiany". Pasek i jego cztery funkcje zniknęły; test
# pilnuje teraz, że każda z tych czynności nadal ma dokładnie jedno wejście.
check("saving, saving-as, reverting and copying all live on the capsule",
      '"/wheelpresets"' in _adapt and "overwrite: function" in _adapt
      and "applyPreset: function" in _adapt and "applyPresetOn: function" in _adapt)
check("...and the wheel's own duplicate action bar is gone",
      "function wheelCfgBarHtml" not in _cfgjs and "function whCfgSaveChanges" not in _cfgjs
      and 'id="whCfgBar"' not in _cfgjs)
# Kopiowanie NIE przenosi miejsca wyświetlania ani przełącznika On kapsla-celu.
check("a copy leaves the target capsule's own place and switch alone",
      "delete body.showWhere" in _adapt)
# Zmiana nazwy konfiguracji musi iść za kapslami, które ją noszą.
check("renaming a configuration follows the capsules that carry it",
      "function whCfgFollowRename" in _cfgjs
      and "whCfgFollowRename(old, String(name" in _adapt)
check("the presets no longer smuggle the place into a capsule",
      '"showWhere",' not in _io.split("const WH_PRESET_KEYS")[1][:260]
      and "showWhere: W.showWhere" not in _io)
check("loading a preset gives the capsule that configuration's name",
      "if (label) W.configName = String(label);" in _io)

# ------------------------------------------------------------------------------------------
#  ŚCIĄGA JEST ZAKŁADKĄ („Nakładka"), NIE OSOBNYM EKRANEM
# ------------------------------------------------------------------------------------------
# Wchodziło się w nią przyciskiem, który chował pasek zakładek i podgląd na żywo — jedno kliknięcie
# wyprowadzało z panelu do czegoś, co wyglądało jak inna aplikacja, i wracało się stamtąd własnym
# przyciskiem. Osobnym ekranem zostaje wyłącznie okno `?view=overview` (drugi monitor / telefon).
check("the cheat sheet is a tab in the bar", '{id:"wszystkie"' in _tabs and 'label:"Nakładka"' in _tabs)
# The name is the whole point of the rename: „Mapowania" sat next to „Mapowanie" and differed by one
# letter, while being a different thing entirely.
check('its name no longer collides with „Mapowanie"', '"Mapowania"' not in _tabs)
check("the screen-toggle button is gone from the header and from the bar",
      "ovScreenBtn" not in _tabs)
_JS_H = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "ribbitflip_dashboard.html")
with open(_JS_H, "r", encoding="utf-8") as _f:
    _html = _f.read()
check("...and out of the page as well", 'id="ovScreenBtn"' not in _html)
_JS_P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "web", "js", "rf-12-preview-editor.js")
with open(_JS_P, "r", encoding="utf-8") as _f:
    _prev = _f.read()
check("nothing toggles the overview-only screen any more", "toggleOverviewScreen" not in _prev)
# THE ONE THAT WOULD FAIL SILENTLY: every drawing in the cheat sheet hangs off `onAll`, which used
# to read one body class. As a tab that class is absent — so orientation, motion, presses, the pad
# and the wheel would all freeze, with nothing in the console to say why.
check("the cheat sheet's drawings recognise it as a TAB, not only as the separate screen",
      'contains("overview-only")||!!_tab("tab-wszystkie")' in _prev)
# The separate window keeps its way into the full panel; a tab must not offer a "back" button.
check("the way back belongs to the separate window only",
      'IS_OVERVIEW)\n      ? `<button class="btn ov-back"' in _prev)

# --- WYCINEK MOŻE URUCHOMIĆ SKANER ------------------------------------------------------------
# Poradnik koła obiecuje od 2026-09-20 cały rozdział na ten temat: „wycinek wysyła taką samą
# akcję, jak reguła Mapowania — a to znaczy, że może też uruchomić skaner ekranu", i pokazuje
# `scan:sekcja=2` w tabeli. To nie było nigdzie przypięte testem, a stoi na dwóch rzeczach, które
# łatwo zepsuć osobno: sanitizer wycinków nie może ścinać `scan:` tak, jak ścina `layer:`,
# a wyjście, które dostaje koło, musi być tym ROUTUJĄCYM (SlotOutput), nie samą klawiaturą.
print("\n--- wycinek koła uruchamia skaner (rozdział poradnika, 2026-09-20) ---")
_sl = rf.RadialMenu.sanitize({"slices": [{"label": "Plansza", "spec": "scan:sekcja=2"},
                                         {"label": "Stop", "spec": "scan:stop"},
                                         {"label": "Warstwa", "spec": "layer:2"}]})["slices"]
check("`scan:sekcja=2` przechodzi przez sanitizer wycinków", _sl[0]["spec"] == "scan:sekcja=2", _sl[0])
check("`scan:stop` też", _sl[1]["spec"] == "scan:stop", _sl[1])
check("...a `layer:` nadal jest ścinane (to nie jest pojedyncza akcja)", _sl[2]["spec"] == "", _sl[2])


class _StubKeys:
    def __init__(self):
        self.taps = []

    def tap(self, spec):
        self.taps.append(spec)
        return True


class _StubScan:
    dev = "d0"

    def __init__(self):
        self.sekcje = []
        self.sygnaly = []

    def activate_section(self, n):
        self.sekcje.append(n)
        return n

    def signal(self, co):
        self.sygnaly.append(co)
        return True


_keys, _scan = _StubKeys(), _StubScan()
_show = rf._scan_overlay_show
rf._scan_overlay_show = lambda dev: None          # nie otwieramy okna nad pulpitem w teście
try:
    _out = rf.SlotOutput(_keys, None, _scan)
    _out.tap("scan:sekcja=2")
    _out.tap("scan:stop")
    _out.tap("ctrl+c")
finally:
    rf._scan_overlay_show = _show
check("wyjście kapsla kieruje `scan:sekcja=N` do skanera, nie do klawiatury",
      _scan.sekcje == [2] and "scan:sekcja=2" not in _keys.taps, (_scan.sekcje, _keys.taps))
check("`scan:stop` idzie jako sygnał skanera", _scan.sygnaly == ["stop"], _scan.sygnaly)
check("zwykły klawisz nadal jedzie do klawiatury", _keys.taps == ["ctrl+c"], _keys.taps)

# UX 261120 L4e: wiersz wycinka zwinięty do nagłówka (ikona, nazwa, skrót akcji, plakietki);
# reszta pól po kliknięciu wiersza. Rozwinięty jest wiersz zaznaczony albo z otwartym makrem.
check("L4e: a slice row has a head with icon, name and the action shortcut",
      'class="wh-slice-head"' in _tree and "wh-h-name" in _tree and "wh-h-key" in _tree
      and "function _whHeadKey" in _tree)
check("L4e: the row opens with the selection (focus or macro row)",
      "const opened = focus || open;" in _tree and "function _whOpenSync" in _tree)
check("L4e: typing in the open row updates its head without a redraw",
      _tree.count("_whHeadSync(row, S())") >= 5)

rf.time = _real_time
print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
