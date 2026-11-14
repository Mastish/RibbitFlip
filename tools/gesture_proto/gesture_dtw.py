#!/usr/bin/env python3
"""
RibbitFlip — PROTOTYP rozpoznawania NAGRANYCH gestów kapsla. Nie jest częścią aplikacji.

Pomysł: zamiast ręcznie ustawiać oś, próg i zachowanie reguły, użytkownik NAGRYWA gest
(1–3 powtórzenia), a potem każde wykonanie podobnego ruchu odpala wyzwalacz. Ten moduł
odpowiada na pytanie „czy to się da zrobić i jakie pokrętła musi mieć użytkownik".

Tor sygnału (ten sam, którym jedzie prawdziwy kapsel):
  próbka 6×int16 @ ~50 Hz  →  kalibracja osi (jak PoseFilter: gyr=CH0-2, acc=CH3-5)
  →  odjęcie biasu żyroskopu (EMA w spoczynku, jak PoseFilter.gbias)
  →  SEGMENTACJA po energii ruchu (|żyro| jak metryka `spin` + odchylenie akcelerometru)
  →  cechy: wygładzenie, przepróbkowanie do N punktów, wybór osi
  →  DTW (Dynamic Time Warping) z pasmem Sakoe-Chiba do każdego wzorca
  →  podobieństwo 0–100 % + osobne bramki intensywności i czasu trwania.

Pokrętła, które widzi użytkownik (DEFAULT_PARAMS):
  threshold     — „Podobieństwo" w %: jak wiernie trzeba powtórzyć gest.
  intensityTol  — „Intensywność": dopuszczalny stosunek energii wykonania do nagrania
                  (2.0 = od połowy do dwukrotności; 0 = bez znaczenia).
  durationTol   — to samo dla czasu trwania (wolniej/szybciej).
  band          — „Tolerancja tempa": ile DTW może rozciągać czas wewnątrz gestu.
  channels      — „Osie": gyro | accel | both | magnitude (ostatni ignoruje chwyt kapsla,
                  ale nie odróżnia lewo od prawo).
  shapeOnly     — (domyślnie tak) porównuj sam kształt; siła gestu tylko przez intensityTol.

Czysty stdlib (bez numpy) celowo: aplikacja jest budowana PyInstallerem z minimalnymi
zależnościami, więc to, co tu działa, da się przenieść 1:1.
"""
from __future__ import annotations

import math
from collections import deque

GYRO_LSB_PER_DPS = 131.0                    # jak PoseFilter.GYRO_LSB
GYRO_FULL_LSB = 250.0 * GYRO_LSB_PER_DPS    # pełna skala czujnika (±250 °/s)
DEFAULT_G_LSB = 2048.0                      # ~1 g na prawdziwym kapslu
CAL_DEFAULT = {"acc": [[3, 1], [4, 1], [5, 1]], "gyr": [[0, 1], [1, 1], [2, 1]]}
STILL_GYRO_LSB = 900.0                      # jak PoseFilter.STILL_GYRO
STILL_ACC_LSB = 220.0                       # jak PoseFilter.STILL_ACC

DEFAULT_PARAMS = {
    # --- rozpoznawanie ---
    "channels": "gyro",       # gyro | accel | both | magnitude — żyroskop nie zależy od tego, jak
                              # kapsel leży w chwili startu; akcelerometr (both) dokłada stuknięcia
                              # i położenie, ale ten sam obrót wygląda inaczej z innego przechyłu
    "accelWeight": 0.7,       # waga akcelerometru wobec żyroskopu w trybie both
    "accelMode": "delta",     # delta = zmiana względem spoczynku sprzed gestu; absolute = z grawitacją
    "resampleN": 40,          # do ilu punktów przepróbkować gest przed DTW
    "smooth": 3,              # średnia krocząca na surowych próbkach (1 = brak)
    "band": 0.2,              # pasmo DTW jako ułamek N (tolerancja tempa wewnątrz gestu)
    "shapeOnly": True,        # True = podobieństwo ocenia SAM KSZTAŁT (każdy przebieg skalowany własną
                              # energią), a o sile gestu decyduje wyłącznie bramka intensityTol;
                              # False = amplituda wchodzi też do podobieństwa
    "intensityTol": 2.0,      # stosunek energii wykonanie/wzorzec w [1/tol, tol]; 0 = wyłącz
    "durationTol": 1.8,       # stosunek czasu trwania w [1/tol, tol]; 0 = wyłącz
    "threshold": 70.0,        # próg podobieństwa w %
    "simRef": 1.5,            # dystans DTW (w jednostkach RMS wzorca), przy którym podobieństwo = 0 %
    # --- segmentacja (jednostki: °/s; szarpnięcie akcelerometru przeliczane 1 g/próbkę = 100 °/s) ---
    "startEnergy": 20.0,      # start gestu, gdy energia > tyle przez 2 kolejne próbki
    "endEnergy": 10.0,        # koniec, gdy energia < max(tyle, endFrac × szczyt gestu) przez endHoldMs
    "endFrac": 0.12,          # koniec względem szczytu: ręka, która „nie dostaje", też kończy gest
    "endHoldMs": 200,         # przerwa kończąca gest (dwuklik z dłuższą przerwą = podnieś)
    "minMs": 120,             # krótszy segment = szum, nie gest
    "maxMs": 2500,            # dłuższy = zamknij na siłę i oceń
    "preRollMs": 100,         # ile spoczynku sprzed startu wziąć do segmentu
    "cooldownMs": 300,        # po odpaleniu: cisza, żeby jeden gest nie strzelił dwa razy
}


def merged_params(p=None):
    out = dict(DEFAULT_PARAMS)
    if p:
        out.update({k: v for k, v in p.items() if k in DEFAULT_PARAMS})
    return out


def cal_split(sample, cal=None):
    """6 surowych kanałów → (żyro[3], akcel[3]) w LSB, w układzie osi z kalibracji 3D."""
    cal = cal or CAL_DEFAULT
    gy = cal["gyr"]
    ac = cal["acc"]
    g = [gy[0][1] * float(sample[gy[0][0]]), gy[1][1] * float(sample[gy[1][0]]), gy[2][1] * float(sample[gy[2][0]])]
    a = [ac[0][1] * float(sample[ac[0][0]]), ac[1][1] * float(sample[ac[1][0]]), ac[2][1] * float(sample[ac[2][0]])]
    return g, a


# ----------------------------------------------------------------------------
#  Segment: wycięty kawałek strumienia (po kalibracji i odjęciu biasu)
# ----------------------------------------------------------------------------
class Segment:
    __slots__ = ("ts", "g", "a", "a0", "t_start", "t_end", "forced")

    def __init__(self, ts, g, a, a0, t_start, t_end, forced=False):
        self.ts = ts          # znaczniki czasu [s]
        self.g = g            # żyro [LSB] po odjęciu biasu, lista 3-elementowych list
        self.a = a            # akcel [LSB]
        self.a0 = a0          # akcel w spoczynku tuż przed gestem [LSB]
        self.t_start = t_start
        self.t_end = t_end
        self.forced = forced  # zamknięty przez maxMs, nie przez uspokojenie

    @property
    def duration(self):
        return self.t_end - self.t_start

    def peak_dps(self):
        return max((math.sqrt(x * x + y * y + z * z) for x, y, z in self.g), default=0.0) / GYRO_LSB_PER_DPS


# ----------------------------------------------------------------------------
#  Cechy
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
    """Liniowa interpolacja do n punktów równo rozłożonych w CZASIE (radzi sobie z nierównym
    tempem pakietów i z przerzedzonym strumieniem)."""
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
    """Segment → (lista N wektorów cech, rms). RMS liczony PRZED normalizacją, w jednostkach
    „pełna skala żyro = 1, 1 g = 1", więc jest miarą intensywności wykonania."""
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
    """Znormalizowany dystans DTW, krok „symmetric2" (przekątna liczy się podwójnie, kroki
    boczne pojedynczo; normalizacja przez n+m) — ten sam, co domyślny w pakiecie R `dtw`.
    Dla ścieżki diagonalnej wynik = średni dystans lokalny na krok. Pasmo Sakoe-Chiba:
    |i-j| <= band*max(n,m). Dystans lokalny = euklidesowy (math.dist, w C)."""
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
            best = prev[j - 1] + d          # przekątna: 2d
            up = prev[j]                    # w górę: d
            if up < best:
                best = up
            if cj_1 < best:                 # w bok: d
                best = cj_1
            cj_1 = d + best
            cur[j] = cj_1
        prev = cur
    return prev[m] / (n + m)


def _scaled(feats, s):
    inv = 1.0 / (s or 1e-9)
    return [[c * inv for c in v] for v in feats]


class Template:
    __slots__ = ("name", "take", "feats", "rms", "duration", "norm", "peak_dps")

    def __init__(self, name, take, feats, rms, duration, peak_dps):
        self.name = name
        self.take = take
        self.feats = feats
        self.rms = rms
        self.duration = duration
        self.peak_dps = peak_dps
        self.norm = _scaled(feats, rms)


def compare(tpl, feats, rms, duration, params):
    """Jedno porównanie wykonania z jednym wzorcem → słownik z podobieństwem i bramkami."""
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


# ----------------------------------------------------------------------------
#  Spotter: segmentacja strumienia po energii ruchu
# ----------------------------------------------------------------------------
class Spotter:
    """Wycina z ciągłego strumienia kawałki „coś się ruszyło … i ucichło".

    push(ts, sample) → Segment albo None. Utrzymuje bias żyroskopu i wektor spoczynkowy
    akcelerometru dokładnie tak, jak robi to PoseFilter (EMA tylko w bezruchu), więc gest
    zaczyna się od zera niezależnie od tego, jak kapsel leżał i jak dryfuje czujnik."""

    def __init__(self, params=None, cal=None, g_lsb=None):
        self.p = merged_params(params)
        self.cal = cal or CAL_DEFAULT
        self.g_lsb = g_lsb                 # None = oszacuj z |akcel| w spoczynku
        self._g_est = None
        self.bias = [0.0, 0.0, 0.0]
        self.a_rest = None                 # akcel w spoczynku (EMA, tylko gdy żyro milczy)
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

    # --- pomocnicze ---
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
        # Energia ruchu: obrót (|żyro| w °/s, jak metryka `spin`) ALBO szarpnięcie akcelerometru
        # (zmiana z próbki na próbkę, 1 g/próbkę = 100 °/s). Szarpnięcie, nie odchylenie od
        # spoczynku: powolny przechył nie jest energią, a gest, który kończy się w innym
        # położeniu kapsla, musi się dać zamknąć.
        jerk = 0.0 if self._a_prev is None else math.dist(a, self._a_prev) / self.g_est()
        self._a_prev = a
        e = max(gmag / GYRO_LSB_PER_DPS, jerk * 100.0)
        self.energy = e
        # --- spoczynek: bias żyro, wektor spoczynkowy akcel, szacunek 1 g ---
        # Bezruch oceniany z SUROWEGO |żyro| (jak PoseFilter.STILL_GYRO), nie z wartości po odjęciu
        # biasu: bias zanieczyszczony ruchem z chwili startu nigdy by się wtedy nie naprawił, bo sam
        # trzymałby „energię" ponad progiem bezruchu. Prawdziwy bias jest mały (< 7 °/s), więc surowa
        # wartość w spoczynku zawsze pod próg schodzi.
        if gmag_raw < STILL_GYRO_LSB:
            if jerk * self.g_est() < STILL_ACC_LSB:
                k = 0.2 if self._bias_n < 25 else 0.02   # szybki start, potem wolne śledzenie dryfu
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
        # Punkt odniesienia akcelerometru = średnia z próbek TUŻ przed startem (pre-roll), nie
        # wolna EMA spoczynku: po serii gestów kapsel leży inaczej niż chwilę temu i EMA nie nadąża.
        a0 = [sum(a[i] for a in pre) / len(pre) for i in range(3)] if pre else self._a0
        return Segment(ts, gg, aa, a0, self._t_start, ts[-1], forced)

    def reset(self):
        self.state = "idle"
        self._above = 0
        self._below_since = None


def segment_take(samples, params=None, cal=None, g_lsb=None):
    """Offline: z jednego NAGRANIA (spoczynek → gest → spoczynek) wytnij gest tym samym
    spotterem, którym tnie się strumień na żywo. Zwraca (segment o największej energii albo
    None, spotter). `samples` = lista (ts, [ch0..ch5])."""
    sp = Spotter(params, cal, g_lsb)
    segs = []
    for ts, s in samples:
        seg = sp.push(ts, s)
        if seg is not None:
            segs.append(seg)
    # nagranie, które kończy się w ruchu, zamykamy „na siłę"
    if sp.state == "active" and samples:
        seg = sp._close(samples[-1][0], forced=True)
        if seg is not None:
            segs.append(seg)
    best, best_e = None, -1.0
    for seg in segs:
        e = sum(math.sqrt(x * x + y * y + z * z) for x, y, z in seg.g)
        if e > best_e:
            best, best_e = seg, e
    return best, sp


# ----------------------------------------------------------------------------
#  Recognizer: wzorce + klasyfikacja segmentu
# ----------------------------------------------------------------------------
class Recognizer:
    def __init__(self, params=None, g_lsb=DEFAULT_G_LSB):
        self.p = merged_params(params)
        self.g_lsb = g_lsb
        self.templates = []                # Template
        self._raw = []                     # (name, take, Segment) — do przeliczenia po zmianie parametrów
        self.thresholds = {}               # per gest (brak = wspólny p["threshold"])

    def set_params(self, params):
        self.p = merged_params({**self.p, **(params or {})})
        raw = self._raw
        self.templates = []
        self._raw = []
        for name, take, seg in raw:
            self.add_segment(name, seg, take)

    def add_segment(self, name, seg, take=0):
        feats, rms = extract_features(seg, self.p, self.g_lsb)
        self.templates.append(Template(name, take, feats, rms, seg.duration, seg.peak_dps()))
        self._raw.append((name, take, seg))

    def names(self):
        out = []
        for t in self.templates:
            if t.name not in out:
                out.append(t.name)
        return out

    def threshold_for(self, name):
        t = self.thresholds.get(name)
        return float(self.p["threshold"]) if t is None else float(t)

    def classify(self, seg):
        """Segment → lista kandydatów (po jednym na gest, najlepszy wzorzec), posortowana malejąco.
        `accepted` = podobieństwo ≥ próg gestu ORAZ bramki intensywności i czasu."""
        feats, rms = extract_features(seg, self.p, self.g_lsb)
        best = {}
        for tpl in self.templates:
            r = compare(tpl, feats, rms, seg.duration, self.p)
            r["name"] = tpl.name
            r["take"] = tpl.take
            cur = best.get(tpl.name)
            if cur is None or r["sim"] > cur["sim"]:
                best[tpl.name] = r
        out = []
        for name, r in best.items():
            thr = self.threshold_for(name)
            r["threshold"] = thr
            r["accepted"] = bool(r["sim"] >= thr and r["okIntensity"] and r["okDuration"])
            out.append(r)
        out.sort(key=lambda r: -r["sim"])
        return out

    def consistency(self, name):
        """Podobieństwa parami między nagraniami jednego gestu (każde jako wzorzec dla pozostałych)."""
        tpls = [t for t in self.templates if t.name == name]
        sims = []
        for i, a in enumerate(tpls):
            for j, b in enumerate(tpls):
                if i == j:
                    continue
                r = compare(a, b.feats, b.rms, b.duration, self.p)
                sims.append(r["sim"])
        return sims

    def suggest_threshold(self, name, margin=10.0, lo=40.0, hi=90.0):
        sims = self.consistency(name)
        if not sims:
            return None
        return max(lo, min(hi, min(sims) - margin))


# ----------------------------------------------------------------------------
#  Detector: spotter + recognizer + cooldown = to, co w aplikacji byłoby źródłem reguły
# ----------------------------------------------------------------------------
class Detector:
    def __init__(self, recognizer, params=None, cal=None, g_lsb=None):
        self.rec = recognizer
        self.p = merged_params({**recognizer.p, **(params or {})})
        self.spotter = Spotter(self.p, cal, g_lsb)
        self._quiet_until = -1e9
        self.last_candidates = None
        self.last_segment = None

    def push(self, ts, sample):
        seg = self.spotter.push(ts, sample)
        if seg is None:
            return None
        cands = self.rec.classify(seg)
        self.last_candidates = cands
        self.last_segment = seg
        if not cands or ts < self._quiet_until:
            return None
        top = cands[0]
        if not top["accepted"]:
            return None
        self._quiet_until = ts + self.p["cooldownMs"] / 1000.0
        return {"name": top["name"], "sim": top["sim"], "ts": ts, "t_start": seg.t_start,
                "t_end": seg.t_end, "duration": seg.duration, "intensity": top["intensity"],
                "durRatio": top["durRatio"], "candidates": cands}
