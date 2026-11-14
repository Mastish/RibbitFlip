#!/usr/bin/env python3
"""
Syntetyczny kapsel do testów prototypu gestów (bez sprzętu).

Generuje pakiety 6×int16 przy 50 Hz DOKŁADNIE w układzie kanałów prawdziwego kapsla:
CH0-2 = żyroskop (131 LSB na °/s), CH3-5 = akcelerometr (2048 LSB na g), CH5 = oś kapsla.
Orientacja jest całkowana kwaternionem tym samym wzorem, którego używa PoseFilter, więc
grawitacja w kanałach akcelerometru zachowuje się jak na sprzęcie (przechył = zmiana CH3/CH4).

Gest to profil prędkości kątowej w układzie kapsla ω(u), u∈[0,1], plus opcjonalne przyspieszenie
liniowe (stuknięcia). „Wykonanie" gestu dostaje losowe odchyłki: amplitudę, tempo, obrót osi
ruchu (inny chwyt), nieliniowe tempo wewnątrz gestu, przechył startowy, drżenie ręki, szum
czujnika i bias żyroskopu. Poziom odchyłek 0..1 skaluje je wszystkie naraz.
"""
from __future__ import annotations

import math
import random

GYRO_LSB_PER_DPS = 131.0
DEG = math.pi / 180.0
TWO_PI = 2.0 * math.pi


# ----------------------------------------------------------------------------
#  kwaterniony (konwencja jak w PoseFilter: q = body→world, up_body = grawitacja w ciele)
# ----------------------------------------------------------------------------
def q_normalize(q):
    n = math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]) or 1.0
    return (q[0] / n, q[1] / n, q[2] / n, q[3] / n)


def q_integrate(q, wx, wy, wz, dt):
    """Ten sam wzór, co PoseFilter.update (ω w rad/s, układ ciała)."""
    qw, qx, qy, qz = q
    return q_normalize((
        qw + 0.5 * dt * (-qx * wx - qy * wy - qz * wz),
        qx + 0.5 * dt * (qw * wx + qy * wz - qz * wy),
        qy + 0.5 * dt * (qw * wy - qx * wz + qz * wx),
        qz + 0.5 * dt * (qw * wz + qx * wy - qy * wx),
    ))


def up_body(q):
    """Wektor „góra świata" widziany w układzie kapsla (= kierunek grawitacji, jak w PoseFilter)."""
    q0, q1, q2, q3 = q
    return (2.0 * (q1 * q3 - q0 * q2), 2.0 * (q0 * q1 + q2 * q3), q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3)


def q_axis_angle(axis, angle):
    ax, ay, az = axis
    n = math.sqrt(ax * ax + ay * ay + az * az) or 1.0
    s = math.sin(angle / 2.0)
    return q_normalize((math.cos(angle / 2.0), ax / n * s, ay / n * s, az / n * s))


def q_mul(a, b):
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    return (aw * bw - ax * bx - ay * by - az * bz,
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw)


def rotate_vec(q, v):
    """Obrót wektora kwaternionem: v' = q v q*."""
    qw, qx, qy, qz = q
    vx, vy, vz = v
    # t = 2 * cross(q.xyz, v); v' = v + qw*t + cross(q.xyz, t)
    tx = 2.0 * (qy * vz - qz * vy)
    ty = 2.0 * (qz * vx - qx * vz)
    tz = 2.0 * (qx * vy - qy * vx)
    return (vx + qw * tx + (qy * tz - qz * ty),
            vy + qw * ty + (qz * tx - qx * tz),
            vz + qw * tz + (qx * ty - qy * tx))


def random_rotation(rng, max_deg):
    """Losowy mały obrót (do max_deg) wokół losowej osi — „inaczej trzymany kapsel"."""
    if max_deg <= 0:
        return (1.0, 0.0, 0.0, 0.0)
    axis = (rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))
    return q_axis_angle(axis, rng.uniform(0, max_deg) * DEG)


def random_tilt(rng, max_deg):
    """Przechył startowy: obrót wokół losowej osi POZIOMEJ (kapsel leży krzywo)."""
    if max_deg <= 0:
        return (1.0, 0.0, 0.0, 0.0)
    phi = rng.uniform(0, TWO_PI)
    return q_axis_angle((math.cos(phi), math.sin(phi), 0.0), rng.uniform(0, max_deg) * DEG)


# ----------------------------------------------------------------------------
#  kształty
# ----------------------------------------------------------------------------
def bell(u, c, s):
    return math.exp(-0.5 * ((u - c) / s) ** 2)


def hann(u):
    return 0.5 * (1.0 - math.cos(TWO_PI * u))


def _zero(u):
    return (0.0, 0.0, 0.0)


# name → factory(rng) → (czas trwania [s], ω(u) [°/s, układ kapsla], a_lin(u) [g] albo None)
def _shake(rng):
    return 0.7, (lambda u: (220.0 * math.sin(TWO_PI * 3 * u) * hann(u),
                            30.0 * math.sin(TWO_PI * 3 * u + 0.5) * hann(u), 0.0)), None


def _flick_right(rng):
    return 0.55, (lambda u: (0.0, 0.0, -230.0 * bell(u, 0.35, 0.10) + 120.0 * bell(u, 0.72, 0.14))), None


def _flick_left(rng):
    return 0.55, (lambda u: (0.0, 0.0, 230.0 * bell(u, 0.35, 0.10) - 120.0 * bell(u, 0.72, 0.14))), None


def _nod(rng):
    return 0.8, (lambda u: (0.0, 200.0 * bell(u, 0.3, 0.1) - 200.0 * bell(u, 0.7, 0.1), 0.0)), None


def _circle(rng):
    return 1.0, (lambda u: (140.0 * math.cos(TWO_PI * u) * math.sqrt(hann(u)),
                            140.0 * math.sin(TWO_PI * u) * math.sqrt(hann(u)), 0.0)), None


def _zigzag(rng):
    return 0.8, (lambda u: (0.0, 0.0, 200.0 * math.sin(TWO_PI * 2 * u) * hann(u))), None


def _double_tap(rng):
    # stuknięcie = krótki impuls przyspieszenia wzdłuż osi kapsla z odbiciem; żyro prawie nic
    def lin(u):
        return (0.0, 0.0,
                1.0 * bell(u, 0.30, 0.03) - 0.45 * bell(u, 0.37, 0.03)
                + 1.0 * bell(u, 0.60, 0.03) - 0.45 * bell(u, 0.67, 0.03))
    return 0.6, (lambda u: (12.0 * bell(u, 0.3, 0.05) + 12.0 * bell(u, 0.6, 0.05), 6.0 * bell(u, 0.45, 0.1), 0.0)), lin


def _slow_tilt(rng):
    # powolne pochylenie i powrót — tak wygląda sterowanie kursorem albo drążkiem
    return 1.6, (lambda u: (0.0, 30.0 * math.sin(TWO_PI * u), 0.0)), None


def _pickup(rng):
    # podniesienie z biurka, obrót w dłoni, odłożenie
    def lin(u):
        return (0.0, 0.0, 0.5 * bell(u, 0.25, 0.05) - 0.4 * bell(u, 0.8, 0.06))
    return 1.2, (lambda u: (60.0 * bell(u, 0.3, 0.15), 40.0 * bell(u, 0.5, 0.2), -50.0 * bell(u, 0.75, 0.15))), lin


def _wobble(rng):
    # „machanie bez sensu": 2 sinusoidy na oś, do ~70 °/s, losowe fazy i częstotliwości
    comps = [[(rng.uniform(20, 45), rng.uniform(0.6, 2.2), rng.uniform(0, TWO_PI)) for _ in range(2)] for _ in range(3)]
    dur = 1.5

    def om(u):
        t = u * dur
        return tuple(sum(a * math.sin(TWO_PI * f * t + ph) for a, f, ph in comps[i]) * hann(u) for i in range(3))
    return dur, om, None


GESTURES = {
    "shake": _shake,
    "flick_right": _flick_right,
    "flick_left": _flick_left,
    "nod": _nod,
    "circle": _circle,
    "zigzag": _zigzag,
    "double_tap": _double_tap,
}
NEGATIVES = {
    "slow_tilt": _slow_tilt,
    "pickup": _pickup,
    "wobble": _wobble,
}


def profile(name, rng):
    f = GESTURES.get(name) or NEGATIVES.get(name)
    if f is None:
        raise KeyError(name)
    return f(rng)


# ----------------------------------------------------------------------------
#  symulowany kapsel
# ----------------------------------------------------------------------------
class PuckSim:
    def __init__(self, rng, g_lsb=2048.0, rate=50.0, gyro_noise=60.0, acc_noise=30.0,
                 bias=None, q0=None, tremor_dps=2.0):
        self.rng = rng
        self.g_lsb = g_lsb
        self.dt = 1.0 / rate
        self.gyro_noise = gyro_noise
        self.acc_noise = acc_noise
        self.bias = list(bias) if bias is not None else [rng.uniform(-250, 250) for _ in range(3)]
        self.q = q0 or (1.0, 0.0, 0.0, 0.0)
        self.t = 0.0
        self.samples = []                  # (ts, [ch0..ch5])
        self.tremor = tremor_dps
        self._tf = [rng.uniform(6.0, 11.0) for _ in range(3)]
        self._tp = [rng.uniform(0, TWO_PI) for _ in range(3)]
        self._walk = [0.0, 0.0, 0.0]

    def _emit(self, omega_dps, lin_g):
        rng = self.rng
        w = []
        for i in range(3):
            self._walk[i] = 0.97 * self._walk[i] + rng.gauss(0, 0.15)         # wolne błądzenie (std ≈ 0.6)
            trem = self.tremor * (0.6 * math.sin(TWO_PI * self._tf[i] * self.t + self._tp[i]) + self._walk[i])
            w.append(omega_dps[i] + trem)
        self.q = q_integrate(self.q, w[0] * DEG, w[1] * DEG, w[2] * DEG, self.dt)
        ux, uy, uz = up_body(self.q)
        acc = (ux + lin_g[0], uy + lin_g[1], uz + lin_g[2])
        ch = [w[i] * GYRO_LSB_PER_DPS + self.bias[i] + rng.gauss(0, self.gyro_noise) for i in range(3)]
        ch += [acc[i] * self.g_lsb + rng.gauss(0, self.acc_noise) for i in range(3)]
        self.samples.append((round(self.t, 4), [max(-32768, min(32767, int(round(v)))) for v in ch]))
        self.t += self.dt

    def rest(self, seconds):
        t0 = self.t
        for _ in range(int(round(seconds / self.dt))):
            self._emit((0.0, 0.0, 0.0), (0.0, 0.0, 0.0))
        return t0, self.t

    def motion(self, seconds, omega_fn, lin_fn=None, rot=None, warp=0.0, amp=1.0):
        """Wykonaj profil przez `seconds`. rot = kwaternion obracający oś ruchu (inny chwyt),
        warp = nieliniowe tempo wewnątrz gestu (|warp| ≤ 0.12 zachowuje monotoniczność)."""
        t0 = self.t
        n = max(2, int(round(seconds / self.dt)))
        for i in range(n):
            u = i / (n - 1)
            if warp:
                u = min(1.0, max(0.0, u + warp * math.sin(TWO_PI * u)))
            w = omega_fn(u)
            w = (w[0] * amp, w[1] * amp, w[2] * amp)
            l = lin_fn(u) if lin_fn else (0.0, 0.0, 0.0)
            l = (l[0] * amp, l[1] * amp, l[2] * amp)
            if rot is not None:
                w = rotate_vec(rot, w)
                l = rotate_vec(rot, l)
            self._emit(w, l)
        return t0, self.t


LEVELS = {"mala": 0.3, "srednia": 0.6, "duza": 1.0}


def perform(sim, name, level, rng, amp=None, speed=None, grip_deg=None, warp=None):
    """Jedno wykonanie gestu z odchyłkami skalowanymi poziomem 0..1."""
    dur, om, lin = profile(name, rng)
    amp = amp if amp is not None else 1.0 + rng.uniform(-0.4, 0.4) * level
    speed = speed if speed is not None else 1.0 + rng.uniform(-0.4, 0.4) * level
    rot = random_rotation(rng, (20.0 * level) if grip_deg is None else grip_deg)
    warp = warp if warp is not None else rng.uniform(-0.12, 0.12) * level
    return sim.motion(dur / speed, om, lin, rot, warp, amp)


def make_take(name, level, rng, pre=0.7, post=0.6, tilt_deg=None, **kw):
    """Nagranie: spoczynek → gest → spoczynek, świeży kapsel (losowy bias i przechył startowy).
    Zwraca (próbki, (t0, t1) gestu). name="rest" = sam spoczynek."""
    q0 = random_tilt(rng, (30.0 * level) if tilt_deg is None else tilt_deg)
    sim = PuckSim(rng, q0=q0)
    sim.rest(pre)
    if name == "rest":
        t0, t1 = sim.rest(1.0)
    else:
        t0, t1 = perform(sim, name, level, rng, **kw)
    sim.rest(post)
    return sim.samples, (t0, t1)
