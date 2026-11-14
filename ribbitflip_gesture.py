#!/usr/bin/env python3
"""
RibbitFlip — RECORDED GESTURES as a trigger source (`{"kind": "gesture", ...}`).

Instead of picking an axis, a threshold and a behaviour by hand, the user RECORDS a movement
(1–5 repetitions) and the rule fires whenever a similar movement is performed again. This module
is the whole of that: the signal path, the recorder, the comparison and the per-capsule hub the
trigger engine talks to. Pure stdlib on purpose — the app is frozen with PyInstaller and every
extra dependency is a build risk; the prototype in tools/gesture_proto/ proved the cost is a
fraction of a percent of one core, so nothing here needs numpy.

Signal path (the same raw 6×int16 packets at ~50 Hz the orientation filter reads):
  raw sample → axis calibration like PoseFilter (gyro = CH0-2, accel = CH3-5), gyro bias removed
  (EMA while still) → SEGMENTATION by motion energy (start above 20 °/s for two samples, end when
  the energy stays under max(10 °/s, 12 % of the peak) for `endHoldMs`) → features (smoothing,
  resampling to N points in time, axis choice) → DTW (Dynamic Time Warping, symmetric2 step,
  Sakoe-Chiba band) against every recording of the gesture → similarity 0–100 % plus two separate
  gates, intensity ratio and duration ratio → ≥ threshold → the condition is "over" for a short
  pulse, and the trigger engine treats it like any other rising edge.

Knobs a person sees (all derived from ONE slider unless overridden in the advanced card):
  accuracy 0..100 → threshold (similarity %), intensityTol and durationTol (accuracy_params);
  channels (gyro | both | accel | magnitude); endHoldMs (the pause that ends a gesture — longer
  when the gesture itself contains a stop, see the recorder); desc (how the gesture looks, for
  the list and the overlay cheat sheet).

Recordings travel INSIDE the rule (source.takes), each take packed as base64 of
uint16 dt_ms + 6×int16, so a preset, a setup or a shared file carries its gestures with no extra
plumbing and a rules file stays a few kilobytes per gesture. A take is a raw window: ≥ 0.4 s of
rest, the movement, a short tail — the templates are cut from it with the SAME segmenter that
cuts the live stream, so a knob changed later never needs the gesture recorded again.

Input here is the capsule's IMU and nothing else: no camera, no microphone, no keyboard or mouse
hook, no network, no file access. A recognised gesture only marks a rule's condition as met;
whether anything reaches the system is decided by TriggerEngine's usual gates (armed + Mapping).
"""
from __future__ import annotations

import base64
import math
import struct
import threading
import time
from collections import deque

GYRO_LSB_PER_DPS = 131.0                    # like PoseFilter.GYRO_LSB
GYRO_FULL_LSB = 250.0 * GYRO_LSB_PER_DPS    # sensor full scale (±250 °/s)
DEFAULT_G_LSB = 2048.0                      # ~1 g on a real capsule
CAL_DEFAULT = {"acc": [[3, 1], [4, 1], [5, 1]], "gyr": [[0, 1], [1, 1], [2, 1]]}
STILL_GYRO_LSB = 900.0                      # like PoseFilter.STILL_GYRO
STILL_ACC_LSB = 220.0                       # like PoseFilter.STILL_ACC

DEFAULT_PARAMS = {
    # --- recognition ---
    "channels": "gyro",       # gyro | accel | both | magnitude — the gyroscope does not depend on how the
                              # capsule lies at the start; the accelerometer (both) adds taps and position
                              # but the same turn looks different from a different starting lean
    "accelWeight": 0.7,       # weight of the accelerometer against the gyro in `both`
    "accelMode": "delta",     # delta = change against the rest before the gesture; absolute = with gravity
    "resampleN": 40,          # points a gesture is resampled to before DTW
    "smooth": 3,              # moving average over raw samples (1 = none)
    "band": 0.2,              # DTW band as a fraction of N (tempo tolerance INSIDE the gesture)
    "shapeOnly": True,        # True = similarity judges the SHAPE alone (each pass scaled by its own energy)
                              # and the strength of the gesture is the intensity gate's business alone
    "intensityTol": 2.0,      # energy ratio performance/template within [1/tol, tol]; 0 = off
    "durationTol": 1.8,       # duration ratio within [1/tol, tol]; 0 = off
    "threshold": 70.0,        # similarity threshold in %
    "simRef": 1.5,            # DTW distance (in template RMS units) at which similarity = 0 %
    # --- segmentation (units: °/s; an accelerometer jerk is converted as 1 g/sample = 100 °/s) ---
    "startEnergy": 20.0,      # a gesture starts when the energy exceeds this for 2 consecutive samples
    "endEnergy": 10.0,        # ...and ends when it stays under max(this, endFrac × peak) for endHoldMs
    "endFrac": 0.12,          # end relative to the peak: a hand that "does not get there" also ends a gesture
    "endHoldMs": 200,         # the pause that ends a gesture (a double tap with a longer pause → raise it)
    "minMs": 120,             # shorter = noise, not a gesture
    "maxMs": 4000,            # longer = close by force and judge (a hand-timed Start/Stop take may be long)
    "preRollMs": 100,         # how much rest from before the start goes into the segment
    "cooldownMs": 300,        # after a hit: silence, so one gesture cannot fire twice
}

WATCH_HZ = 25.0                 # points per second in the recorder's live picture (see GestureHub.watch)
WATCH_IDLE_S = 20.0             # a panel that has stopped re-arming is dropped (closed tab, lost window)
PULSE_S = 0.15                  # how long the condition stays "over" after a hit (the engine ticks at ~200 Hz)
RING_S = 12.0                   # raw samples kept for the recorder (a manual take is at most this long)
TAKE_LEAD_S = 0.6               # rest taken from BEFORE a movement into a take (gyro bias + rest vector)
TAKE_TAIL_S = 0.3               # rest added AFTER a movement
TAKE_MAX = 5                    # recordings per gesture
TAKE_ROWS_MAX = 600             # rows per take (12 s at 50 Hz)
TAKE_ROWS_MIN = 15
REC_MAX_S = 25.0                # an automatic recording session gives up after this long
REC_TAKES_MAX = 5
CHANNELS = ("gyro", "both", "accel", "magnitude")
COLLISION_WARN = 80.0           # another gesture this similar to a new recording → "they will be confused"
WIN_MARGIN = 5.0                # accepted matches this close to the best one fire too (same gesture, two rules)


def merged_params(p=None):
    out = dict(DEFAULT_PARAMS)
    if p:
        out.update({k: v for k, v in p.items() if k in DEFAULT_PARAMS})
    return out


def accuracy_params(v):
    """The ONE slider „how exactly does the gesture have to be repeated" (0..100) → three knobs.
    50 = the defaults (threshold 70 %, intensity ×2, tempo ×1.8). Under 20 strength and tempo do
    not matter at all. The mapping is the one the prototype lab was tuned with."""
    try:
        v = max(0.0, min(100.0, float(v)))
    except (TypeError, ValueError):
        v = 50.0
    thr = 50.0 + 0.4 * v

    def seg(lo_v, lo, hi_v, hi):
        f = (v - lo_v) / (hi_v - lo_v)
        return lo + (hi - lo) * f
    if v < 20:
        inten, dur = 0.0, 0.0
    elif v < 50:
        inten, dur = seg(20, 4.0, 50, 2.0), seg(20, 3.0, 50, 1.8)
    else:
        inten, dur = seg(50, 2.0, 100, 1.4), seg(50, 1.8, 100, 1.3)
    return {"threshold": round(thr, 1), "intensityTol": round(inten, 2), "durationTol": round(dur, 2)}


def cal_split(sample, cal=None):
    """6 raw channels → (gyro[3], accel[3]) in LSB, in the axis frame of the 3D calibration."""
    cal = cal or CAL_DEFAULT
    gy = cal["gyr"]
    ac = cal["acc"]
    g = [gy[0][1] * float(sample[gy[0][0]]), gy[1][1] * float(sample[gy[1][0]]), gy[2][1] * float(sample[gy[2][0]])]
    a = [ac[0][1] * float(sample[ac[0][0]]), ac[1][1] * float(sample[ac[1][0]]), ac[2][1] * float(sample[ac[2][0]])]
    return g, a


def norm_cal(cal):
    """A calibration dict the way PoseFilter keeps it ({acc:[[ch,sign]×3], gyr:[...]}) or the default."""
    if not isinstance(cal, dict):
        return CAL_DEFAULT
    out = {}
    for grp in ("acc", "gyr"):
        pairs = []
        for p in (cal.get(grp) or [])[:3]:
            try:
                ch = int(p[0]); s = -1 if int(p[1]) < 0 else 1
            except (TypeError, ValueError, IndexError):
                return CAL_DEFAULT
            if not (0 <= ch <= 5):
                return CAL_DEFAULT
            pairs.append([ch, s])
        if len(pairs) != 3:
            return CAL_DEFAULT
        out[grp] = pairs
    return out


# ----------------------------------------------------------------------------
#  Segment: one cut piece of the stream (calibrated, bias removed)
# ----------------------------------------------------------------------------
class Segment:
    __slots__ = ("ts", "g", "a", "a0", "t_start", "t_end", "forced")

    def __init__(self, ts, g, a, a0, t_start, t_end, forced=False):
        self.ts = ts          # timestamps [s]
        self.g = g            # gyro [LSB] after bias removal, list of 3-lists
        self.a = a            # accel [LSB]
        self.a0 = a0          # accel at rest just before the gesture [LSB]
        self.t_start = t_start
        self.t_end = t_end
        self.forced = forced  # closed by maxMs, not by coming to rest

    @property
    def duration(self):
        return self.t_end - self.t_start

    def peak_dps(self):
        return max((math.sqrt(x * x + y * y + z * z) for x, y, z in self.g), default=0.0) / GYRO_LSB_PER_DPS


# ----------------------------------------------------------------------------
#  Features
# ----------------------------------------------------------------------------
def _smooth(rows, k):
    if k <= 1 or len(rows) < k:
        return rows
    h = k // 2
    n = len(rows)
    dim = len(rows[0])
    out = []
    for i in range(n):
        lo = max(0, i - h)
        hi = min(n, i + h + 1)
        cnt = hi - lo
        out.append([sum(r[d] for r in rows[lo:hi]) / cnt for d in range(dim)])
    return out


def _resample(ts, rows, n):
    """Linear interpolation to n points evenly spaced in TIME (copes with uneven packet timing)."""
    if len(rows) == 1:
        return [list(rows[0]) for _ in range(n)]
    t0, t1 = ts[0], ts[-1]
    span = (t1 - t0) or 1e-9
    out = []
    j = 0
    m = len(rows)
    dim = len(rows[0])
    for k in range(n):
        t = t0 + span * k / (n - 1)
        while j < m - 2 and ts[j + 1] < t:
            j += 1
        ta, tb = ts[j], ts[j + 1]
        f = 0.0 if tb <= ta else max(0.0, min(1.0, (t - ta) / (tb - ta)))
        ra, rb = rows[j], rows[j + 1]
        out.append([ra[d] + (rb[d] - ra[d]) * f for d in range(dim)])
    return out


def extract_features(seg, params, g_lsb=DEFAULT_G_LSB):
    """Segment → (list of N feature vectors, rms). The RMS is taken BEFORE normalisation, in units
    of "gyro full scale = 1, 1 g = 1", so it measures how hard the gesture was performed."""
    p = params
    g = _smooth(seg.g, p["smooth"])
    a = _smooth(seg.a, p["smooth"])
    n = max(8, int(p["resampleN"]))
    g = _resample(seg.ts, g, n)
    a = _resample(seg.ts, a, n)
    mode = p["channels"]
    w = float(p["accelWeight"])
    a0 = seg.a0 if p["accelMode"] == "delta" else (0.0, 0.0, 0.0)
    feats = []
    for k in range(n):
        gx, gy, gz = (g[k][0] / GYRO_FULL_LSB, g[k][1] / GYRO_FULL_LSB, g[k][2] / GYRO_FULL_LSB)
        dax, day, daz = ((a[k][0] - a0[0]) / g_lsb, (a[k][1] - a0[1]) / g_lsb, (a[k][2] - a0[2]) / g_lsb)
        if mode == "gyro":
            v = [gx, gy, gz]
        elif mode == "accel":
            v = [dax, day, daz]
        elif mode == "magnitude":
            v = [math.sqrt(gx * gx + gy * gy + gz * gz), math.sqrt(dax * dax + day * day + daz * daz)]
        else:  # both
            v = [gx, gy, gz, w * dax, w * day, w * daz]
        feats.append(v)
    rms = math.sqrt(sum(sum(c * c for c in v) for v in feats) / n)
    return feats, rms


# ----------------------------------------------------------------------------
#  DTW
# ----------------------------------------------------------------------------
def dtw(A, B, band):
    """Normalised DTW distance, "symmetric2" step (the diagonal counts double, side steps single;
    normalised by n+m) — the default of the R `dtw` package. For a diagonal path the result is the
    mean local distance per step. Sakoe-Chiba band: |i-j| <= band*max(n,m)."""
    n, m = len(A), len(B)
    w = max(int(round(band * max(n, m))), abs(n - m), 1)
    INF = float("inf")
    prev = [INF] * (m + 1)
    prev[0] = 0.0
    dist = math.dist
    for i in range(1, n + 1):
        cur = [INF] * (m + 1)
        ai = A[i - 1]
        lo = max(1, i - w)
        hi = min(m, i + w)
        cj_1 = INF
        for j in range(lo, hi + 1):
            d = dist(ai, B[j - 1])
            best = prev[j - 1] + d          # diagonal: 2d
            up = prev[j]                    # up: d
            if up < best:
                best = up
            if cj_1 < best:                 # sideways: d
                best = cj_1
            cj_1 = d + best
            cur[j] = cj_1
        prev = cur
    return prev[m] / (n + m)


def _scaled(feats, s):
    inv = 1.0 / (s or 1e-9)
    return [[c * inv for c in v] for v in feats]


class Template:
    __slots__ = ("take", "feats", "rms", "duration", "norm", "peak_dps")

    def __init__(self, take, feats, rms, duration, peak_dps):
        self.take = take
        self.feats = feats
        self.rms = rms
        self.duration = duration
        self.peak_dps = peak_dps
        self.norm = _scaled(feats, rms)


def compare(tpl, feats, rms, duration, params):
    """One performance against one template → similarity and the two gates."""
    p = params
    B = _scaled(feats, rms if p["shapeOnly"] else tpl.rms)
    d = dtw(tpl.norm, B, p["band"])
    sim = max(0.0, 100.0 * (1.0 - d / float(p["simRef"])))
    r_int = rms / (tpl.rms or 1e-9)
    r_dur = duration / (tpl.duration or 1e-9)
    tol_i = float(p["intensityTol"] or 0)
    tol_d = float(p["durationTol"] or 0)
    ok_int = True if tol_i <= 0 else (1.0 / tol_i <= r_int <= tol_i)
    ok_dur = True if tol_d <= 0 else (1.0 / tol_d <= r_dur <= tol_d)
    return {"sim": sim, "dist": d, "intensity": r_int, "durRatio": r_dur,
            "okIntensity": ok_int, "okDuration": ok_dur}


def best_match(templates, feats, rms, duration, params):
    """The closest of a gesture's recordings, with the verdict already applied."""
    best = None
    for tpl in templates:
        r = compare(tpl, feats, rms, duration, params)
        if best is None or r["sim"] > best["sim"]:
            best = r
    if best is None:
        return None
    thr = float(params["threshold"])
    best["threshold"] = thr
    best["accepted"] = bool(best["sim"] >= thr and best["okIntensity"] and best["okDuration"])
    best["why"] = ("" if best["accepted"] else
                   "sim" if best["sim"] < thr else
                   "intensity" if not best["okIntensity"] else "duration")
    return best


# ----------------------------------------------------------------------------
#  Spotter: cutting the stream by motion energy
# ----------------------------------------------------------------------------
class Spotter:
    """Cuts "something moved … and went quiet" pieces out of a continuous stream.

    push(ts, sample) → Segment or None. Keeps the gyro bias and the accelerometer rest vector
    exactly the way PoseFilter does (EMA only while still), so a gesture starts from zero
    whatever the capsule's position and however the sensor drifts."""

    def __init__(self, params=None, cal=None, g_lsb=None):
        self.p = merged_params(params)
        self.cal = cal or CAL_DEFAULT
        self.g_lsb = g_lsb                 # None = estimate from |accel| at rest
        self._g_est = None
        self.bias = [0.0, 0.0, 0.0]
        self.a_rest = None                 # accel at rest (EMA, only while the gyro is quiet)
        self._a_prev = None
        self._bias_n = 0
        keep_s = (self.p["maxMs"] + self.p["preRollMs"] + self.p["endHoldMs"]) / 1000.0 + 0.5
        self._ring = deque()               # (ts, g_sub, a)
        self._keep_s = keep_s
        self.state = "idle"                # idle | active | wait_still
        self._above = 0
        self._t_start = None
        self._a0 = None
        self._below_since = None
        self._peak = 0.0
        self.energy = 0.0
        self.segments = 0

    def g_est(self):
        if self.g_lsb:
            return self.g_lsb
        return self._g_est if (self._g_est and self._g_est > 500.0) else DEFAULT_G_LSB

    def push(self, ts, sample):
        g, a = cal_split(sample, self.cal)
        gs = [g[0] - self.bias[0], g[1] - self.bias[1], g[2] - self.bias[2]]
        amag = math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2)
        gmag = math.sqrt(gs[0] ** 2 + gs[1] ** 2 + gs[2] ** 2)
        gmag_raw = math.sqrt(g[0] ** 2 + g[1] ** 2 + g[2] ** 2)
        # Motion energy: rotation (|gyro| in °/s, like the `spin` metric) OR an accelerometer jerk
        # (sample-to-sample change, 1 g/sample = 100 °/s). A jerk, not a deviation from rest: a slow
        # lean is not energy, and a gesture that ends in a different position must be closable.
        jerk = 0.0 if self._a_prev is None else math.dist(a, self._a_prev) / self.g_est()
        self._a_prev = a
        e = max(gmag / GYRO_LSB_PER_DPS, jerk * 100.0)
        self.energy = e
        # Rest: gyro bias, accelerometer rest vector, 1 g estimate. Stillness is judged from the RAW
        # |gyro| (like PoseFilter.STILL_GYRO), not the bias-corrected one: a bias polluted by the
        # movement at start-up would otherwise never heal, because it would itself keep the
        # "energy" above the stillness threshold. The true bias is small (< 7 °/s).
        if gmag_raw < STILL_GYRO_LSB:
            if jerk * self.g_est() < STILL_ACC_LSB:
                k = 0.2 if self._bias_n < 25 else 0.02   # quick start, then slow drift tracking
                self._bias_n += 1
                for i in range(3):
                    self.bias[i] += k * (g[i] - self.bias[i])
                if 300.0 < amag < 40000.0:
                    self._g_est = amag if self._g_est is None else self._g_est + 0.05 * (amag - self._g_est)
            if self.a_rest is None:
                self.a_rest = list(a)
            else:
                for i in range(3):
                    self.a_rest[i] += 0.05 * (a[i] - self.a_rest[i])
        elif self.a_rest is None:
            self.a_rest = list(a)
        self._ring.append((ts, gs, a))
        while self._ring and ts - self._ring[0][0] > self._keep_s:
            self._ring.popleft()
        p = self.p
        if self.state == "idle":
            if e > p["startEnergy"]:
                self._above += 1
                if self._above >= 2:
                    self.state = "active"
                    self._t_start = ts
                    self._a0 = list(self.a_rest)
                    self._below_since = None
                    self._peak = e
            else:
                self._above = 0
            return None
        if self.state == "wait_still":
            if e < p["endEnergy"]:
                if self._below_since is None:
                    self._below_since = ts
                elif (ts - self._below_since) * 1000.0 >= p["endHoldMs"]:
                    self.state = "idle"
                    self._above = 0
            else:
                self._below_since = None
            return None
        # active
        if e > self._peak:
            self._peak = e
        end_thr = max(float(p["endEnergy"]), float(p["endFrac"]) * self._peak)
        if e < end_thr:
            if self._below_since is None:
                self._below_since = ts
            elif (ts - self._below_since) * 1000.0 >= p["endHoldMs"]:
                seg = self._close(self._below_since + 0.04, forced=False)
                self.state = "idle"
                self._above = 0
                return seg
        else:
            self._below_since = None
        if (ts - self._t_start) * 1000.0 >= p["maxMs"]:
            seg = self._close(ts, forced=True)
            self.state = "wait_still"
            self._below_since = None
            return seg
        return None

    def _close(self, t_end, forced):
        p = self.p
        t0 = self._t_start - p["preRollMs"] / 1000.0
        ts, gg, aa = [], [], []
        pre = []
        for t, gs, a in self._ring:
            if t0 <= t <= t_end:
                ts.append(t)
                gg.append(gs)
                aa.append(a)
                if t < self._t_start:
                    pre.append(a)
        self.segments += 1
        if len(ts) < 3 or (ts[-1] - ts[0]) * 1000.0 < p["minMs"]:
            return None
        # Accelerometer reference = the mean of the samples JUST before the start (pre-roll), not
        # the slow rest EMA: after a series of gestures the capsule lies differently than a moment
        # ago and the EMA does not keep up.
        a0 = [sum(a[i] for a in pre) / len(pre) for i in range(3)] if pre else self._a0
        return Segment(ts, gg, aa, a0, self._t_start, ts[-1], forced)

    def reset(self):
        self.state = "idle"
        self._above = 0
        self._below_since = None


# ----------------------------------------------------------------------------
#  Takes: the raw windows a rule carries
# ----------------------------------------------------------------------------
_ROW = struct.Struct("<Hhhhhhh")       # dt_ms (uint16) + 6 × int16


def encode_take(rows):
    """[(ts_s, [6 ints]), …] → {"d": base64}. Timestamps become deltas in ms (uint16), samples
    int16 — the wire format of the capsule. The first delta is 0."""
    out = bytearray()
    prev = None
    for ts, s in rows:
        dt = 0 if prev is None else max(0, min(65535, int(round((ts - prev) * 1000.0))))
        prev = ts
        vals = [max(-32768, min(32767, int(v))) for v in list(s)[:6]]
        while len(vals) < 6:
            vals.append(0)
        out += _ROW.pack(dt, *vals)
    return {"d": base64.b64encode(bytes(out)).decode("ascii")}


def decode_take(take):
    """{"d": base64} → [(ts_s, [6 ints]), …] with ts starting at 0, or None when unreadable."""
    if not isinstance(take, dict):
        return None
    try:
        raw = base64.b64decode(str(take.get("d") or ""), validate=True)
    except Exception:
        return None
    if len(raw) % _ROW.size or not raw:
        return None
    rows = []
    t = 0.0
    for i in range(0, len(raw), _ROW.size):
        dt, *vals = _ROW.unpack_from(raw, i)
        if rows:
            t += dt / 1000.0
        rows.append((t, list(vals)))
    return rows


def take_rows(take):
    """Rows of a take, whatever shape it arrived in: the packed form, or the prototype's
    [[ts, ch0..ch5], …] list (accepted so a lab recording can be pasted into a rule)."""
    if isinstance(take, dict) and "d" in take:
        return decode_take(take)
    if isinstance(take, dict) and isinstance(take.get("samples"), list):
        try:
            rows = [(float(r[0]), [int(v) for v in r[1:7]]) for r in take["samples"]]
        except (TypeError, ValueError, IndexError):
            return None
        return rows
    return None


def sanitize_take(take):
    """A take as it will be stored: packed, row count within limits, ints int16. None = drop it."""
    rows = take_rows(take)
    if not rows:
        return None
    rows = rows[:TAKE_ROWS_MAX]
    if len(rows) < 3:
        return None
    return encode_take(rows)


def sanitize_source(src):
    """The canonical shape of a `gesture` source. Forgiving on purpose — this arrives in shared
    files, and one odd field must not stop a whole rule list from loading."""
    src = src if isinstance(src, dict) else {}

    def _num(v, lo, hi, dflt):
        try:
            x = float(v)
        except (TypeError, ValueError):
            return dflt
        if x != x:
            return dflt
        return max(lo, min(hi, x))

    def _opt(v, lo, hi):
        return None if v is None or v == "" else _num(v, lo, hi, None)

    takes = []
    for t in (src.get("takes") or [])[:TAKE_MAX] if isinstance(src.get("takes"), list) else []:
        st = sanitize_take(t)
        if st is not None:
            takes.append(st)
    ch = src.get("channels")
    return {
        "kind": "gesture",
        "takes": takes,
        "accuracy": int(_num(src.get("accuracy", 50), 0, 100, 50)),
        "threshold": _opt(src.get("threshold"), 0, 100),
        "intensityTol": _opt(src.get("intensityTol"), 0, 10),
        "durationTol": _opt(src.get("durationTol"), 0, 10),
        "channels": ch if ch in CHANNELS else "gyro",
        "endHoldMs": int(_num(src.get("endHoldMs", 200), 40, 2000, 200)),
        "desc": str(src.get("desc") or "").strip()[:200],
    }


def source_params(src):
    """Recognition parameters of one gesture source: the accuracy slider supplies the three
    gates unless the advanced card overrode one of them explicitly."""
    src = src if isinstance(src, dict) else {}
    ap = accuracy_params(src.get("accuracy", 50))
    p = {"channels": src.get("channels") if src.get("channels") in CHANNELS else "gyro",
         "endHoldMs": int(max(40, min(2000, src.get("endHoldMs") or 200)))}
    for k in ("threshold", "intensityTol", "durationTol"):
        v = src.get(k)
        p[k] = float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else ap[k]
    return merged_params(p)


def take_segment(take, params, cal=None):
    """One take → (Segment covering the WHOLE movement, info) with the same segmenter that cuts
    the live stream. A take whose movement contains a pause longer than endHoldMs comes out of
    the segmenter in several pieces; they are merged into one span here and `pauseMs` says how
    long the longest gap was, so the recorder can raise endHoldMs — otherwise the live stream
    would be cut at that pause too and the gesture would never match its own recording.
    (None, info) when the take holds no movement at all."""
    rows = take_rows(take)
    info = {"duration": 0.0, "peak": 0.0, "pauseMs": 0, "pieces": 0, "rows": len(rows or [])}
    if not rows or len(rows) < 3:
        return None, info
    sp = Spotter(params, cal)
    hist = []                       # (ts, gyro-bias, accel) for every row, like the spotter's ring
    segs = []
    for ts, s in rows:
        seg = sp.push(ts, s)
        hist.append(sp._ring[-1])
        if seg is not None:
            segs.append(seg)
    if sp.state == "active":       # the take ends mid-movement: close by force, like the live path
        seg = sp._close(rows[-1][0], forced=True)
        if seg is not None:
            segs.append(seg)
    if not segs:
        return None, info
    info["pieces"] = len(segs)
    t_start = segs[0].t_start
    t_end = segs[-1].t_end
    pause = 0.0
    for a, b in zip(segs, segs[1:]):
        pause = max(pause, b.t_start - a.t_end)
    info["pauseMs"] = int(round(pause * 1000.0))
    if len(segs) == 1:
        seg = segs[0]
    else:
        t0 = t_start - params["preRollMs"] / 1000.0
        sel = [h for h in hist if t0 <= h[0] <= t_end]
        pre = [h[2] for h in sel if h[0] < t_start]
        a0 = [sum(a[i] for a in pre) / len(pre) for i in range(3)] if pre else segs[0].a0
        seg = Segment([h[0] for h in sel], [h[1] for h in sel], [h[2] for h in sel], a0,
                      t_start, t_end, any(s.forced for s in segs))
    info["duration"] = round(seg.duration, 3)
    info["peak"] = round(seg.peak_dps(), 1)
    info["tStart"] = round(t_start, 3)
    info["tEnd"] = round(t_end, 3)
    return seg, info


def suggest_end_hold(pause_ms, current):
    """The end-of-gesture pause that keeps a recording with a `pause_ms` stop in one piece:
    the stop and a half, plus a margin, rounded up to 50 ms — never lower than what is set."""
    if not pause_ms:
        return current
    want = int(math.ceil((pause_ms * 1.5 + 100) / 50.0) * 50)
    return max(int(current or 200), min(2000, want))


def templates_for(src, cal=None, params=None):
    """The recordings of one source as templates (skipping takes without movement)."""
    params = params or source_params(src)
    out = []
    for i, take in enumerate((src or {}).get("takes") or []):
        seg, _ = take_segment(take, params, cal)
        if seg is None:
            continue
        feats, rms = extract_features(seg, params)
        out.append(Template(i, feats, rms, seg.duration, seg.peak_dps()))
    return out


def consistency(templates, params):
    """Pairwise similarities between the recordings of one gesture (each as a template for the
    rest). Empty with fewer than two recordings."""
    sims = []
    for i, a in enumerate(templates):
        for j, b in enumerate(templates):
            if i == j:
                continue
            sims.append(compare(a, b.feats, b.rms, b.duration, params)["sim"])
    return sims


def suggest_threshold(sims, margin=10.0, lo=40.0, hi=90.0):
    if not sims:
        return None
    return max(lo, min(hi, min(sims) - margin))


def analyze(src, cal=None, others=()):
    """Everything the editor says after a recording: per-take verdicts, how alike the takes are,
    a threshold suggestion, and which OTHER gestures of this capsule are close enough to be
    confused with it. `others` = [(ckey, label, source), …]."""
    src = sanitize_source(src)
    params = source_params(src)
    segs, tinfo = [], []
    for take in src["takes"]:
        seg, info = take_segment(take, params, cal)
        info["ok"] = seg is not None
        tinfo.append(info)
        if seg is not None:
            segs.append(seg)
    tpls = []
    for i, seg in enumerate(segs):
        feats, rms = extract_features(seg, params)
        tpls.append(Template(i, feats, rms, seg.duration, seg.peak_dps()))
    sims = consistency(tpls, params)
    pause = max([t["pauseMs"] for t in tinfo] + [0])
    collisions = []
    for ckey, label, osrc in others:
        try:
            op = source_params(osrc)
            otpl = templates_for(osrc, cal, op)
        except Exception:
            continue
        if not otpl:
            continue
        worst = 0.0
        for seg in segs:
            feats, rms = extract_features(seg, op)
            r = best_match(otpl, feats, rms, seg.duration, op)
            if r is not None:
                worst = max(worst, r["sim"])
        collisions.append({"ckey": ckey, "label": label, "sim": round(worst, 1),
                           "warn": worst >= COLLISION_WARN})
    collisions.sort(key=lambda c: -c["sim"])
    return {
        "ok": True,
        "takes": tinfo,
        "usable": len(segs),
        "consistency": [round(s, 1) for s in sims],
        "minConsistency": (round(min(sims), 1) if sims else None),
        "suggested": (round(suggest_threshold(sims), 1) if sims else None),
        "threshold": round(float(params["threshold"]), 1),
        "intensityTol": params["intensityTol"],
        "durationTol": params["durationTol"],
        "pauseMs": pause,
        "suggestedEndHoldMs": (suggest_end_hold(pause, src["endHoldMs"]) if pause > 0 else None),
        "collisions": collisions[:3],
    }


# ----------------------------------------------------------------------------
#  Clock: BLE hands packets over in bunches with the same timestamp
# ----------------------------------------------------------------------------
class Clock:
    """Smoothed sample clock. BLE delivers packets in bunches (several with one timestamp) and
    the resampling inside DTW counts on even spacing — so a sample's time is 85 % "previous +
    nominal step" and 15 % the moment it arrived. The nominal step is measured over ~5 s."""

    def __init__(self):
        self.t = None
        self.raw = deque(maxlen=250)

    def next(self, raw):
        self.raw.append(raw)
        if len(self.raw) >= 50:
            dt = (self.raw[-1] - self.raw[0]) / (len(self.raw) - 1)
            dt = max(0.005, min(0.1, dt))
        else:
            dt = 0.02
        if self.t is None:
            self.t = raw
        else:
            self.t = 0.85 * (self.t + dt) + 0.15 * raw
        return self.t


# ----------------------------------------------------------------------------
#  GestureHub: one per capsule, owned by its TriggerEngine
# ----------------------------------------------------------------------------
class _Group:
    """The gesture conditions sharing one end-of-gesture pause, and the spotter that cuts for
    them. Within a group the best accepted match wins, so two similar gestures never fire
    together on one movement — the prototype's finding that the RIGHT one wins when both are
    recorded only holds if they are judged against the same cut."""
    __slots__ = ("spotter", "entries", "quiet_until")

    def __init__(self, spotter):
        self.spotter = spotter
        self.entries = []
        self.quiet_until = -1e9


class GestureHub:
    def __init__(self, cal=None):
        self.cal = norm_cal(cal)
        self._lock = threading.Lock()
        self._rules = []
        self._groups = {}          # endHoldMs -> _Group
        self._fired = {}           # ckey -> time.monotonic() of the last hit
        self._last = {}            # ckey -> {sim, ts, accepted}
        self._trial = None         # the editor's draft: {"spotter", "templates", "params", "label"}
        self._rec = None           # recording session
        self._watch = None         # the recorder's live picture: {"spotter", "until", "at", "hold"}
        self._clock = Clock()
        self._ring = deque()       # (ts, sample) — the last RING_S seconds
        self._last_ts = None
        self._last_rx = 0.0
        self.emit = None           # callable(event dict) — set by the engine

    # ------------------------------------------------------------------ configuration
    def has_rules(self):
        return bool(self._groups)

    def set_cal(self, cal):
        with self._lock:
            self.cal = norm_cal(cal)
            self._rebuild(reuse=False)
            # The live picture is cut from the same calibrated frame, and the calibration says
            # WHICH channels are the gyroscope — after a re-mapping a stale spotter would draw the
            # energy of the wrong three. Rebuilt in place rather than dropped: the panel's next
            # heartbeat is up to eight seconds away, and a blank chart right after somebody
            # recalibrated their capsule reads as "the recorder broke".
            W = self._watch
            if W is not None:
                W["spotter"] = Spotter(merged_params({"endHoldMs": W["hold"]}), self.cal)

    def set_rules(self, rules):
        with self._lock:
            self._rules = [r for r in (rules or []) if isinstance(r, dict)]
            self._rebuild(reuse=True)

    @staticmethod
    def conditions(rules):
        """Every gesture condition of a rule list as (ckey, rule, source). The main condition is
        keyed by the rule id, extra condition N by "<id>#N" — the engine asks by that key."""
        out = []
        for r in rules or []:
            if not isinstance(r, dict):
                continue
            rid = str(r.get("id") or "")
            src = r.get("source") or {}
            if isinstance(src, dict) and src.get("kind") == "gesture":
                out.append((rid, r, src))
            for i, c in enumerate(r.get("extraConditions") or []):
                cs = (c or {}).get("source") or {}
                if isinstance(cs, dict) and cs.get("kind") == "gesture":
                    out.append(("%s#%d" % (rid, i), r, cs))
        return out

    def _rebuild(self, reuse):
        old = self._groups if reuse else {}
        groups = {}
        for ckey, r, src in self.conditions(self._rules):
            params = source_params(src)
            tpls = templates_for(src, self.cal, params)
            if not tpls:
                continue
            key = int(params["endHoldMs"])
            g = groups.get(key)
            if g is None:
                sp = old[key].spotter if key in old else Spotter(params, self.cal)
                sp.cal = self.cal
                g = groups[key] = _Group(sp)
                if key in old:
                    g.quiet_until = old[key].quiet_until
            g.entries.append({"ckey": ckey, "rid": str(r.get("id") or ""),
                              "label": str(r.get("label") or ""), "templates": tpls, "params": params})
        self._groups = groups
        keep = {e["ckey"] for g in groups.values() for e in g.entries}
        for k in list(self._fired):
            if k not in keep:
                del self._fired[k]
        for k in list(self._last):
            if k not in keep:
                del self._last[k]

    def set_trial(self, src, label=""):
        """The rule being EDITED, unsaved: judged on every movement like a saved one, but it
        fires nothing — its verdict rides on the stream so the editor can show "last movement:
        84 %". None clears it."""
        with self._lock:
            if not src:
                self._trial = None
                return False
            src = sanitize_source(src)
            params = source_params(src)
            tpls = templates_for(src, self.cal, params)
            if not tpls:
                self._trial = None
                return False
            old = self._trial
            sp = (old["spotter"] if old and int(old["params"]["endHoldMs"]) == int(params["endHoldMs"])
                  else Spotter(params, self.cal))
            sp.cal = self.cal
            self._trial = {"spotter": sp, "templates": tpls, "params": params,
                           "label": str(label or "")[:60], "set": time.monotonic()}
            return True

    def others_for(self, ckey):
        """(ckey, label, source) of every gesture condition EXCEPT `ckey` — what a new recording
        is checked against for collisions."""
        with self._lock:
            return [(k, str(r.get("label") or ""), src)
                    for k, r, src in self.conditions(self._rules) if k != ckey]

    # ------------------------------------------------------------------ the engine's questions
    def over(self, ckey, now=None):
        ts = self._fired.get(ckey)
        if ts is None:
            return False
        return ((time.monotonic() if now is None else now) - ts) <= PULSE_S

    def last(self, ckey):
        return self._last.get(ckey)

    # ------------------------------------------------------------------ the data thread
    def push(self, ts_raw, sample):
        """One raw sample. Returns nothing; every verdict goes out through `emit`."""
        events = []
        mono = time.monotonic()
        with self._lock:
            ts = self._clock.next(ts_raw)
            self._last_ts = ts
            self._last_rx = mono
            self._ring.append((ts, sample))
            while self._ring and ts - self._ring[0][0] > RING_S:
                self._ring.popleft()
            for g in self._groups.values():
                seg = g.spotter.push(ts, sample)
                if seg is not None:
                    events.append(self._judge_group(g, seg, ts, mono))
            if self._trial is not None:
                seg = self._trial["spotter"].push(ts, sample)
                if seg is not None:
                    events.append(self._judge_trial(seg, ts))
            if self._rec is not None:
                events.extend(self._rec_push(ts, sample))
            if self._watch is not None:
                events.extend(self._watch_push(ts, sample, mono))
        self._emit_all(events)

    def _emit_all(self, events):
        em = self.emit
        if em is None:
            return
        for ev in events:
            if ev is None:
                continue
            try:
                em(ev)
            except Exception:
                pass

    @staticmethod
    def _seg_event(seg):
        return {"t": "gest", "dur": round(seg.duration, 2), "peak": int(round(seg.peak_dps())),
                "forced": bool(seg.forced)}

    @staticmethod
    def _compact(r):
        return {"ckey": r.get("ckey"), "rid": r.get("rid"), "sim": round(r["sim"], 1),
                "accepted": bool(r["accepted"]), "intensity": round(r["intensity"], 2),
                "durRatio": round(r["durRatio"], 2), "threshold": round(r["threshold"], 1),
                "why": r.get("why", "")}

    def _judge_group(self, g, seg, ts, mono):
        cache = {}
        results = []
        for e in g.entries:
            p = e["params"]
            ch = p["channels"]
            if ch not in cache:
                cache[ch] = extract_features(seg, p)
            feats, rms = cache[ch]
            r = best_match(e["templates"], feats, rms, seg.duration, p)
            if r is None:
                continue
            r["ckey"] = e["ckey"]
            r["rid"] = e["rid"]
            results.append(r)
            self._last[e["ckey"]] = {"sim": round(r["sim"], 1), "ts": ts, "accepted": bool(r["accepted"])}
        results.sort(key=lambda r: -r["sim"])
        hits = []
        # No hits while a recording session runs: the movement being recorded is often close
        # to an existing gesture (a variant, a re-recording), and a saved rule pressing keys
        # into the game every time the person repeats it would make recording a trap. The
        # verdicts are still computed and shown, so a collision is visible while it happens.
        if ts >= g.quiet_until and self._rec is None:
            best = next((r for r in results if r["accepted"]), None)
            if best is not None:
                # The best match wins over a DIFFERENT gesture that merely resembles it (a single
                # flick inside a zigzag reads 80–90 %), but rules that recorded the SAME movement
                # — a key and a layer switch on one gesture, or `once` next to a double-gesture
                # `multi` — score alike and all fire. The margin tells the two cases apart.
                hits = [r for r in results if r["accepted"] and r["sim"] >= best["sim"] - WIN_MARGIN]
        for r in hits:
            self._fired[r["ckey"]] = mono
        if hits:
            g.quiet_until = ts + g.spotter.p["cooldownMs"] / 1000.0
        ev = self._seg_event(seg)
        ev["hit"] = hits[0]["ckey"] if hits else None
        ev["hits"] = [r["ckey"] for r in hits]
        ev["cands"] = [self._compact(r) for r in results[:3]]
        return ev

    def _judge_trial(self, seg, ts):
        tr = self._trial
        feats, rms = extract_features(seg, tr["params"])
        r = best_match(tr["templates"], feats, rms, seg.duration, tr["params"])
        ev = self._seg_event(seg)
        ev["trial"] = (self._compact({**r, "ckey": None, "rid": None}) if r else None)
        return ev

    # ------------------------------------------------------------------ the live picture
    #
    # WHAT THE SEGMENTER SEES, WHILE IT SEES IT. The recorder used to answer only after the fact:
    # a movement either became a take or it did not, and a gesture that came out too weak, or got
    # cut in half at a pause, looked exactly like one that never arrived. This streams the same
    # motion energy the cut is made from, together with the two lines that decide where a gesture
    # begins and ends and which of the three states the segmenter is in — so the picture in the
    # editor is the decision itself, not a drawing of it. (The prototype lab had this from the
    # start; it is the one thing everybody tuning a gesture asked for.)
    #
    # ITS OWN SPOTTER, on purpose. The rules' spotters come and go with the rule list, and the
    # recorder's exists only between Record and the last take — a picture built on either would go
    # blank exactly between two attempts, which is when somebody is looking hardest.
    def watch(self, on, end_hold_ms=200):
        """Arm (or drop) the live picture. Re-arming is how a panel says it is still there: the
        stream stops by itself WATCH_IDLE_S after the last call, so a closed tab cannot leave the
        bus carrying 25 points a second for nobody."""
        with self._lock:
            if not on:
                self._watch = None
                return {"ok": True, "watch": False}
            try:
                hold = int(max(40, min(2000, int(end_hold_ms))))
            except (TypeError, ValueError):
                hold = 200
            W = self._watch
            # A changed pause is a changed picture (the "waiting for rest" band is measured with
            # it), so the spotter is rebuilt — but only then: rebuilding on every heartbeat would
            # throw away the gyro bias and make the trace jump every few seconds.
            if W is None or W["hold"] != hold:
                W = self._watch = {"spotter": Spotter(merged_params({"endHoldMs": hold}), self.cal),
                                   "hold": hold, "at": 0.0}
            W["until"] = time.monotonic() + WATCH_IDLE_S
            return {"ok": True, "watch": True, "hz": WATCH_HZ, "endHoldMs": hold}

    _WATCH_STATE = {"idle": 0, "active": 1, "wait_still": 2}

    def _watch_push(self, ts, sample, mono):
        W = self._watch
        if mono > W["until"]:
            self._watch = None
            return []
        sp = W["spotter"]
        sp.push(ts, sample)      # whatever segment it closes is nobody's — only its energy and state are read
        if ts - W["at"] < 1.0 / WATCH_HZ:
            return []
        W["at"] = ts
        p = sp.p
        # The end line MOVES: once a gesture is open it is the larger of the floor and a fraction
        # of the peak so far, which is exactly why it has to be sent rather than assumed — "a hand
        # that does not get back to rest still ends the gesture" is invisible without it.
        end = float(p["endEnergy"])
        if sp.state == "active":
            end = max(end, float(p["endFrac"]) * sp._peak)
        return [{"t": "gene", "e": round(sp.energy, 1), "s": self._WATCH_STATE.get(sp.state, 0),
                 "start": float(p["startEnergy"]), "end": round(end, 1)}]

    # ------------------------------------------------------------------ recording
    def stream_now(self):
        with self._lock:
            return self._stream_now()

    def _stream_now(self):
        if self._last_ts is None:
            return None
        return self._last_ts + (time.monotonic() - self._last_rx)

    def _ring_slice(self, t0, t1):
        return [(ts, s) for ts, s in self._ring if t0 <= ts <= t1]

    def record_state(self):
        with self._lock:
            R = self._rec
            if R is None:
                return {"active": False}
            return {"active": True, "mode": R["mode"], "collected": R["collected"], "target": R["target"]}

    def record_start(self, mode="auto", takes=3, end_hold_ms=200, channels="gyro"):
        """Start a session. auto: every movement the capsule makes is one take, until `takes`
        of them are in or the session times out. manual: from now until record_stop() is one
        take — for gestures with a stop in the middle, which the automatic cut would end early."""
        mode = "manual" if mode == "manual" else "auto"
        try:
            takes = max(1, min(REC_TAKES_MAX, int(takes)))
        except (TypeError, ValueError):
            takes = 3
        try:
            end_hold = int(max(40, min(2000, int(end_hold_ms))))
        except (TypeError, ValueError):
            end_hold = 200
        with self._lock:
            if self._rec is not None:
                return {"ok": False, "error": "nagrywanie już trwa"}
            now = self._stream_now()
            if now is None or (time.monotonic() - self._last_rx) > 2.0:
                return {"ok": False, "error": "brak strumienia z kapsla — połącz kapsel albo włącz sterowanie ręczne"}
            params = merged_params({"endHoldMs": end_hold,
                                    "channels": channels if channels in CHANNELS else "gyro"})
            self._rec = {"mode": mode, "target": (1 if mode == "manual" else takes), "params": params,
                         "spotter": Spotter(params, self.cal), "collected": 0, "pending": [],
                         "t_start": now, "t0": now, "end_hold": end_hold, "last_seg_end": None}
            ev = {"t": "grec", "phase": "go", "mode": mode, "target": self._rec["target"], "take": 0}
        self._emit_all([ev])
        return {"ok": True, "mode": mode, "target": (1 if mode == "manual" else takes)}

    def record_stop(self):
        """manual: cut the take from Start to now. auto: finish with what was collected."""
        events = []
        with self._lock:
            R = self._rec
            if R is None:
                return {"ok": False, "error": "nic nie nagrywam"}
            now = self._stream_now() or R["t0"]
            if R["mode"] == "manual":
                events.extend(self._rec_manual_take(R, now))
                self._rec = None
            else:
                for p in list(R["pending"]):       # „Zakończ" right after a movement — take what waits
                    events.extend(self._rec_take(R, p[0], min(now, p[1] + TAKE_TAIL_S)))
                R["pending"] = []
                events.append(self._rec_done(R))
                self._rec = None
        self._emit_all(events)
        return {"ok": True}

    def record_cancel(self):
        with self._lock:
            if self._rec is None:
                return {"ok": False, "error": "nic nie nagrywam"}
            mode = self._rec["mode"]
            self._rec = None
        self._emit_all([{"t": "grec", "phase": "cancel", "mode": mode}])
        return {"ok": True}

    def _rec_done(self, R):
        if R["collected"]:
            return {"t": "grec", "phase": "done", "mode": R["mode"], "take": R["collected"], "target": R["target"]}
        return {"t": "grec", "phase": "error", "mode": R["mode"],
                "msg": "Nie zauważyłem ruchu. Spróbuj jeszcze raz i machnij wyraźniej."}

    def _rec_push(self, ts, sample):
        """auto mode, one sample: cut a take out of every movement the recording spotter closes,
        once the rest after it (or the next movement) says where the take ends."""
        R = self._rec
        events = []
        if R["mode"] != "auto":
            return events
        sp = R["spotter"]
        seg = sp.push(ts, sample)
        # The next movement started before the tail after the previous one ran out: end the
        # pending take just before it, or the next repetition's beginning would be glued on.
        if R["pending"] and sp.state == "active" and sp._t_start is not None:
            for p in list(R["pending"]):
                if sp._t_start > p[1]:
                    R["pending"].remove(p)
                    events.extend(self._rec_take(R, p[0], max(p[1], sp._t_start - 0.02)))
        if seg is not None:
            R["pending"].append((seg.t_start, seg.t_end))
        for p in list(R["pending"]):
            if ts >= p[1] + TAKE_TAIL_S:
                R["pending"].remove(p)
                events.extend(self._rec_take(R, p[0], p[1] + TAKE_TAIL_S))
        if self._rec is not None and R["collected"] >= R["target"]:
            events.append(self._rec_done(R))
            self._rec = None
        elif self._rec is not None and ts - R["t_start"] >= REC_MAX_S:
            events.append(self._rec_done(R))
            self._rec = None
        return events

    def _rec_take(self, R, t_start, t_end):
        """Window [movement start − lead, t_end] → one take event (or nothing, when the cut
        holds no usable movement — a twitch the spotter opened and closed at once)."""
        rows = self._ring_slice(t_start - TAKE_LEAD_S, t_end)
        if len(rows) < TAKE_ROWS_MIN:
            return []
        t0 = rows[0][0]
        take = encode_take([(ts - t0, s) for ts, s in rows])
        seg, info = take_segment(take, R["params"], self.cal)
        if seg is None:
            return []
        R["collected"] += 1
        return [{"t": "grec", "phase": "take", "mode": R["mode"], "take": R["collected"], "target": R["target"],
                 "data": take, "duration": info["duration"], "peak": info["peak"],
                 "pauseMs": info["pauseMs"], "forced": bool(seg.forced)}]

    def _rec_manual_take(self, R, now):
        """Start … Stop → one take: the window trimmed to the movement it holds (with the rest
        before and after), plus the longest stop inside it, so the panel can widen endHoldMs."""
        rows = self._ring_slice(R["t0"] - TAKE_LEAD_S, now)
        if len(rows) < TAKE_ROWS_MIN:
            return [{"t": "grec", "phase": "error", "mode": "manual", "msg": "Za mało próbek — czy kapsel wysyła dane?"}]
        t0 = rows[0][0]
        rel = [(ts - t0, s) for ts, s in rows]
        # Find the movement with a segmenter that never splits on a pause: the whole window is
        # one gesture by definition — that is what Start/Stop means.
        wide = merged_params({**R["params"], "endHoldMs": 2000, "maxMs": int(RING_S * 1000)})
        seg, info = take_segment(encode_take(rel), wide, self.cal)
        if seg is None:
            return [{"t": "grec", "phase": "error", "mode": "manual",
                     "msg": "Nie zauważyłem ruchu między Start a Stop. Spróbuj jeszcze raz i machnij wyraźniej."}]
        a, b = info["tStart"] - TAKE_LEAD_S, info["tEnd"] + TAKE_TAIL_S
        cut = [(ts, s) for ts, s in rel if a <= ts <= b]
        if len(cut) < TAKE_ROWS_MIN:
            cut = rel
        c0 = cut[0][0]
        take = encode_take([(ts - c0, s) for ts, s in cut])
        # …and the stops inside it, judged with the pause the rule will actually use.
        _, info2 = take_segment(take, R["params"], self.cal)
        R["collected"] += 1
        return [{"t": "grec", "phase": "take", "mode": "manual", "take": 1, "target": 1, "data": take,
                 "duration": info2["duration"] or info["duration"], "peak": info2["peak"] or info["peak"],
                 "pauseMs": info2["pauseMs"], "forced": False,
                 "suggestedEndHoldMs": (suggest_end_hold(info2["pauseMs"], R["end_hold"]) if info2["pauseMs"] else None)},
                {"t": "grec", "phase": "done", "mode": "manual", "take": 1, "target": 1}]
