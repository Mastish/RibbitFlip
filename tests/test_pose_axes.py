# Regression test: the 3D filter's pitch/roll must not jump. Run: py tests/test_pose_axes.py
# No test framework and no hardware needed — it loads ribbitflip_monitor.py directly and drives
# PoseFilter with PHYSICALLY CONSISTENT IMU samples: accelerometer and gyroscope are both derived
# from one quaternion trajectory, so a jump on the output can only come from the filter, never
# from the test data. Exits 1 on the first failing batch.
#
# What this guards. pitch/roll used to be atan2(vx, vz) and atan2(vy, vz) — a shared denominator
# that passes through zero the moment the capsule stands upright. Leaning purely sideways past
# vertical therefore flipped `pitch` (an axis nothing had touched) between −180° and +180° frame
# after frame. Those two numbers drive triggers, the stick, the d-pad, the 3D-filter mouse mode
# and MIDI/OSC, so the spike fired keys and slammed faders on a capsule that was standing still.
# The scenarios below all cross or sit on that line; the old formula fails most of them by
# hundreds of degrees, and the pure-lean readings pin the values that must NOT drift, so a future
# "improvement" cannot quietly re-scale what people's saved thresholds mean.
import importlib.util
import math
import os
import random
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _ROOT)

spec = importlib.util.spec_from_file_location(
    "rfmon", os.path.join(_ROOT, "ribbitflip_monitor.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

G = 2048.0          # accelerometer LSB per g
GYRO_LSB = 131.0    # gyroscope LSB per deg/s
DEG = math.pi / 180.0
DT = 1.0 / 100.0    # 100 Hz


# ---------------------------------------------------------------- kinematics
def q_norm(q):
    n = math.sqrt(sum(v * v for v in q)) or 1.0
    return [v / n for v in q]


def q_integrate(q, w, dt):
    """q̇ = 0.5·q⊗ω with ω in the body frame — the same convention PoseFilter integrates."""
    wx, wy, wz = w
    qw, qx, qy, qz = q
    return q_norm([qw + 0.5 * dt * (-qx * wx - qy * wy - qz * wz),
                   qx + 0.5 * dt * (qw * wx + qy * wz - qz * wy),
                   qy + 0.5 * dt * (qw * wy - qx * wz + qz * wx),
                   qz + 0.5 * dt * (qw * wz + qx * wy - qy * wx)])


def up_in_body(q):
    """World +Z expressed in the capsule's own frame = what the accelerometer feels at rest."""
    w, x, y, z = q
    return (2 * (x * z - w * y), 2 * (w * x + y * z), w * w - x * x - y * y + z * z)


def q_tilt(axis, deg):
    """Quaternion for a plain lean of `deg` about body axis 0=X (sideways) or 1=Y (fore/aft)."""
    a = deg * DEG / 2
    q = [math.cos(a), 0.0, 0.0, 0.0]
    q[axis + 1] = math.sin(a)
    return q


def sample_from(q, w_body, rnd, acc_sigma=7.0, gyr_sigma=5.0):
    """Orientation + turn rate -> the six raw channels, inverting POSE_CAL_DEFAULT
    (all-positive since 2026-08-20: ax=+CH3, ay=+CH4, az=+CH5, gx=CH0, gy=CH1, gz=CH2)."""
    ux, uy, uz = up_in_body(q)
    ax, ay, az = G * ux, G * uy, G * uz
    gx, gy, gz = (w_body[0] / DEG * GYRO_LSB,
                  w_body[1] / DEG * GYRO_LSB,
                  w_body[2] / DEG * GYRO_LSB)
    if acc_sigma:
        ax += rnd.gauss(0, acc_sigma); ay += rnd.gauss(0, acc_sigma); az += rnd.gauss(0, acc_sigma)
    if gyr_sigma:
        gx += rnd.gauss(0, gyr_sigma); gy += rnd.gauss(0, gyr_sigma); gz += rnd.gauss(0, gyr_sigma)
    return tuple(int(max(-32768, min(32767, round(v))))
                 for v in (gx, gy, gz, ax, ay, az))


def drive(w_profile, dur=6.0, q0=None, seed=1):
    """Run one scenario through a real PoseFilter; returns its pose dicts in order."""
    rnd = random.Random(seed)
    pf = m.PoseFilter()
    q = q_norm(list(q0) if q0 else [1.0, 0.0, 0.0, 0.0])
    out = []
    t = 0.0
    for _ in range(int(dur / DT)):
        out.append(dict(drive_t=t, **pf.update(sample_from(q, w_profile(t), rnd), t)))
        q = q_integrate(q, w_profile(t), DT)
        t += DT
    return out


def worst_step(rows, key, skip=1.0):
    """Largest change of `key` between consecutive samples, ignoring the filter's start-up."""
    prev, worst, when = None, 0.0, 0.0
    for r in rows:
        if r["drive_t"] < skip:
            prev = r[key]
            continue
        if prev is not None and abs(r[key] - prev) > worst:
            worst, when = abs(r[key] - prev), r["drive_t"]
        prev = r[key]
    return worst, when


# ---------------------------------------------------------------- scenarios
def const(w):
    return lambda t: w


def lean_then_spin(axis, deg, rate=60.0, spin_dps=180.0):
    """Lean the capsule over, then spin it about its own axis — the ordinary two-part gesture,
    and the one that used to walk pitch/roll straight through the discontinuity."""
    t_end = deg / rate

    def prof(t):
        if t < t_end:
            w = [0.0, 0.0, 0.0]
            w[axis] = rate * DEG
            return tuple(w)
        return (0.0, 0.0, spin_dps * DEG)
    return prof


def swing(axis, amp_deg, period):
    k = amp_deg * DEG * 2 * math.pi / period

    def prof(t):
        w = [0.0, 0.0, 0.0]
        w[axis] = k * math.cos(2 * math.pi * t / period)
        return tuple(w)
    return prof


# name, profile, duration, starting orientation
SCENARIOS = [
    ("resting flat",                    const((0, 0, 0)),          6.0, None),
    ("fore/aft lean to 150 deg",        const((0, 25 * DEG, 0)),   6.0, None),
    ("sideways lean to 150 deg",        const((25 * DEG, 0, 0)),   6.0, None),
    ("spinning flat at 180 deg/s",      const((0, 0, 180 * DEG)),  6.0, None),
    ("lean 85 deg + spin",              lean_then_spin(0, 85),     6.0, None),
    ("lean 110 deg + spin",             lean_then_spin(0, 110),    8.0, None),
    ("full 360 deg roll-over",          const((60 * DEG, 0, 0)),   6.0, None),
    ("swing +/-110 deg through level",  swing(0, 110, 3.0),        9.0, None),
    ("resting ON EDGE (95 deg)",        const((0, 0, 0)),          6.0, q_tilt(0, -95)),
    ("upside down + spin",              const((0, 0, 120 * DEG)),  6.0, q_tilt(0, -175)),
]

# A single frame may never move an angle by more than this. Real motion is bounded by the sample
# rate (180 deg/s at 100 Hz = 1.8 deg per frame), so 25 deg is far above anything physical and far
# below the 180 deg flip this test exists to catch.
MAX_STEP = 25.0
MAX_TWIST_STEP = 200.0      # deg/s, and a rate may legitimately change fast


def run():
    fails = []
    worst_overall = 0.0
    for name, prof, dur, q0 in SCENARIOS:
        rows = drive(prof, dur=dur, q0=q0)
        bad = []
        for key, limit in (("pitch", MAX_STEP), ("roll", MAX_STEP),
                           ("tilt", MAX_STEP), ("twist", MAX_TWIST_STEP)):
            step, when = worst_step(rows, key)
            if key in ("pitch", "roll", "tilt"):
                worst_overall = max(worst_overall, step)
            if step > limit:
                bad.append("%s: %s jumped %.1f in one frame at t=%.2fs (limit %.0f)"
                           % (name, key, step, when, limit))
        fails.extend(bad)
        print("%s  %-34s worst frame-to-frame step %.1f deg"
              % ("FAIL" if bad else "PASS", name,
                 max(worst_step(rows, "pitch")[0], worst_step(rows, "roll")[0])))

    # A plain lean must read as the lean angle itself — this is what saved trigger thresholds mean.
    before = len(fails)
    for axis, key, other in ((1, "pitch", "roll"), (0, "roll", "pitch")):
        for deg in (10, 30, 45, 60, 90):
            rows = drive(const((0, 0, 0)), dur=3.0, q0=q_tilt(axis, deg if axis == 0 else -deg))
            p = rows[-1]
            if abs(abs(p[key]) - deg) > 1.5:
                fails.append("plain %s lean of %d deg reads %.1f (expected %d)"
                             % (key, deg, abs(p[key]), deg))
            if abs(p[other]) > 1.5:
                fails.append("plain %s lean of %d deg leaked %.1f into %s"
                             % (key, deg, p[other], other))
            if abs(p["tilt"] - deg) > 1.5:
                fails.append("plain %s lean of %d deg reads tilt %.1f" % (key, deg, p["tilt"]))
    print("%s  a plain lean of 10/30/45/60/90 deg reads back as that angle, no leak to the other axis"
          % ("PASS" if len(fails) == before else "FAIL"))

    # Declared range: PoseFilter clamps pitch/roll to +/-90, and the metric tables in
    # web/js/rf-10-triggers-model.js and rf-20-gate-model.js must say the same thing.
    before = len(fails)
    for axis, key in ((1, "pitch"), (0, "roll")):
        rows = drive(const((0, 0, 0)), dur=3.0, q0=q_tilt(axis, 140 if axis == 0 else -140))
        if abs(rows[-1][key]) > 90.0:
            fails.append("%s left the declared +/-90 range: %.1f" % (key, rows[-1][key]))
        if rows[-1]["tilt"] < 130.0:
            fails.append("tilt should still report past vertical, got %.1f" % rows[-1]["tilt"])
    print("%s  past vertical the reading folds inside +/-90 while tilt keeps counting to 180"
          % ("PASS" if len(fails) == before else "FAIL"))

    before = len(fails)
    for path, needle in ((os.path.join(_ROOT, "web", "js", "rf-10-triggers-model.js"),
                          '["pitch","Przechył przód/tył","°",-90,90]'),
                         (os.path.join(_ROOT, "web", "js", "rf-20-gate-model.js"),
                          '["pitch","Przechył przód/tył","°",-90,90]')):
        with open(path, encoding="utf-8") as fh:
            if needle not in fh.read():
                fails.append("%s no longer declares pitch as +/-90" % os.path.basename(path))
    print("%s  the JS metric tables declare the same +/-90 range as the filter"
          % ("PASS" if len(fails) == before else "FAIL"))

    if fails:
        print("\nFAIL (%d):" % len(fails))
        for f in fails:
            print("  -", f)
        return 1
    print("\nOK - pose axes stay continuous (worst step across all scenarios: %.1f deg)" % worst_overall)
    return 0


if __name__ == "__main__":
    sys.exit(run())
