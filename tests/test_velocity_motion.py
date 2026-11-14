# Unit test: velocity-from-motion-energy (MidiMapper). Run: py tests/test_velocity_motion.py
# No test framework and no hardware needed — it loads ribbitflip_monitor.py directly and
# drives MidiMapper with fake bus/MIDI/trigger objects. Exits 1 on the first failing batch.
import importlib.util, os, sys

# App root on sys.path — ribbitflip_monitor.py does `import ribbitflip_audio`.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _ROOT)

spec = importlib.util.spec_from_file_location(
    "rfmon", os.path.join(_ROOT, "ribbitflip_monitor.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class FakeBus:
    def now(self): return 0.0
    def publish(self, *a, **k): pass


class FakeMidi:
    def __init__(self): self.active = True; self.notes = []
    def note_on(self, ch, note, vel): self.notes.append(("on", ch, note, vel)); return True
    def note_off(self, ch, note, vel=0): self.notes.append(("off", ch, note, vel)); return True


class FakeTrig:
    armed = True


def make_mapper():
    midi = FakeMidi()
    mm = m.MidiMapper(FakeBus(), midi=midi, trig=FakeTrig(), slot=0)
    return mm, midi


def note_map(vel_source, velocity=100):
    return {"id": "t1", "srcKind": "filter", "metric": "tilt", "dest": "note",
            "mode": "threshold", "cmp": ">", "threshold": 10.0, "note": 60,
            "velocity": velocity, "velSource": vel_source, "enabled": True}


def fire_note(mm, midi, pose):
    """Enable one threshold note mapping, feed a below- then above-threshold pose, return the note-on velocity."""
    midi.notes.clear()
    # rising edge: first below threshold (releases), then above (fires note_on)
    mm.process(None, {"tilt": 0.0, "spin": pose["spin"]})
    mm.process(None, pose)
    ons = [n for n in midi.notes if n[0] == "on"]
    return ons[-1][3] if ons else None


def run():
    fails = []

    # 1) sanitize defaults: no velSource -> "fixed"; explicit motion preserved; junk -> fixed
    mm, midi = make_mapper()
    s_default = mm._sanitize_map({"dest": "note"})
    s_motion = mm._sanitize_map({"dest": "note", "velSource": "motion"})
    s_junk = mm._sanitize_map({"dest": "note", "velSource": "banana"})
    if s_default["velSource"] != "fixed": fails.append("default velSource should be 'fixed', got %r" % s_default["velSource"])
    if s_motion["velSource"] != "motion": fails.append("explicit motion not preserved")
    if s_junk["velSource"] != "fixed": fails.append("junk velSource should coerce to 'fixed'")

    # 2) FIXED source -> velocity identical to configured value (no regression)
    mm, midi = make_mapper()
    mm.set_config({"enabled": True, "mappings": [note_map("fixed", velocity=100)]})
    mm._spin_ema = 25000.0  # even huge energy must NOT affect a fixed mapping
    mm._spin_ts = 0.0
    v_fixed = fire_note(mm, midi, {"tilt": 90.0, "spin": 25000.0})
    if v_fixed != 100: fails.append("fixed velocity should be 100 regardless of energy, got %r" % v_fixed)

    mm, midi = make_mapper()
    mm.set_config({"enabled": True, "mappings": [note_map("fixed", velocity=42)]})
    v_fixed2 = fire_note(mm, midi, {"tilt": 90.0, "spin": 0.0})
    if v_fixed2 != 42: fails.append("fixed velocity should honor configured 42, got %r" % v_fixed2)

    # 3) _motion_velocity mapping: rest -> MIN(30), full-scale -> MAX(127), monotonic, clamped
    mm, midi = make_mapper()
    mm._spin_ema = 0.0
    v_rest = mm._motion_velocity()
    mm._spin_ema = mm.VEL_MOTION_FLOOR
    v_floor = mm._motion_velocity()
    mm._spin_ema = mm.VEL_MOTION_FLOOR + mm.VEL_MOTION_FULLSCALE * 0.5
    v_mid = mm._motion_velocity()
    mm._spin_ema = mm.VEL_MOTION_FLOOR + mm.VEL_MOTION_FULLSCALE
    v_full = mm._motion_velocity()
    mm._spin_ema = 1e9  # absurd energy -> still clamped
    v_over = mm._motion_velocity()
    if v_rest != 30: fails.append("rest velocity should be MIN 30, got %r" % v_rest)
    if v_floor != 30: fails.append("floor velocity should be 30, got %r" % v_floor)
    if not (30 < v_mid < 127): fails.append("mid velocity should be strictly between 30 and 127, got %r" % v_mid)
    if v_full != 127: fails.append("full-scale velocity should be MAX 127, got %r" % v_full)
    if v_over != 127: fails.append("over-scale velocity must clamp to 127, got %r" % v_over)
    if not (v_rest < v_mid < v_full): fails.append("velocity must grow monotonically with energy")
    # every value inside [30..127]
    for lbl, val in [("rest", v_rest), ("mid", v_mid), ("full", v_full), ("over", v_over)]:
        if not (30 <= val <= 127): fails.append("%s velocity out of [30..127]: %r" % (lbl, val))

    # 4) MOTION source through process(): low energy -> quiet note-on, high energy -> loud note-on
    mm, midi = make_mapper()
    mm.set_config({"enabled": True, "mappings": [note_map("motion")]})
    mm._spin_ema = 0.0; mm._spin_ts = 0.0
    v_low = fire_note(mm, midi, {"tilt": 90.0, "spin": 0.0})

    mm, midi = make_mapper()
    mm.set_config({"enabled": True, "mappings": [note_map("motion")]})
    mm._spin_ema = mm.VEL_MOTION_FLOOR + mm.VEL_MOTION_FULLSCALE; mm._spin_ts = 0.0
    v_high = fire_note(mm, midi, {"tilt": 90.0, "spin": mm.VEL_MOTION_FLOOR + mm.VEL_MOTION_FULLSCALE})
    if v_low is None or v_high is None: fails.append("motion note did not fire (low=%r high=%r)" % (v_low, v_high))
    elif not (v_low < v_high): fails.append("motion: high energy must be louder than low (low=%r high=%r)" % (v_low, v_high))
    if v_low is not None and not (30 <= v_low <= 127): fails.append("motion low velocity out of range: %r" % v_low)
    if v_high is not None and not (30 <= v_high <= 127): fails.append("motion high velocity out of range: %r" % v_high)

    if fails:
        print("FAIL (%d):" % len(fails))
        for f in fails: print("  -", f)
        return 1
    print("OK - all velocity-from-motion backend assertions passed")
    print("  fixed=100/42  rest=%d mid=%d full=%d over=%d  motion low=%s high=%s" % (
        v_rest, v_mid, v_full, v_over, v_low, v_high))
    return 0


if __name__ == "__main__":
    sys.exit(run())
