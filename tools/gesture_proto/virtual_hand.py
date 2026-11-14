#!/usr/bin/env python3
"""
„Wirtualna ręka" do testów BEZ sprzętu: prowadzi symulowany kapsel osobnej, testowej instancji
RibbitFlipa przez POST /virtual (ta sama droga, którą idzie widżet 3D, gdy ciągnie go mysz) i wykonuje
zaplanowane gesty. Dzięki temu laboratorium (lab.py) i live.py da się przećwiczyć na sucho.

Instancja testowa — kopia aplikacji w osobnym folderze, żeby nie ruszać Settings/ produkcji:
    py ribbitflip_monitor.py --simulate --no-keys --no-open --no-tray --allow-multi --port 8846
Potem:
    py tools/gesture_proto/virtual_hand.py --url http://127.0.0.1:8846 --delays 5,3,3 nod nod nod
Gesty: nod (kiwnięcie), flick (obrót w bok), shake (potrząśnięcie), circle (kółko);
--delays to sekundy oczekiwania PRZED każdym gestem (ostatnia wartość powtarzana), --amp i --speed
skalują siłę i tempo. Nie kierować tego na produkcyjną instancję (8770): w trybie LIVE /virtual
i tak odmówi, ale po co ryzykować.
"""
import argparse
import json
import math
import re
import sys
import time
import urllib.request

RATE = 25.0


def get_token(base):
    with urllib.request.urlopen(base + "/", timeout=5) as r:
        html = r.read().decode("utf-8", "replace")
    m = re.search(r'window\.RIBBITFLIP_TOKEN="([^"]+)"', html)
    return m.group(1) if m else ""


def post(base, tok, path, body):
    req = urllib.request.Request(base + path, data=json.dumps(body).encode("utf-8"), method="POST",
                                 headers={"Content-Type": "application/json", "X-RibbitFlip-Token": tok})
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def bell(u, c, s):
    return math.exp(-0.5 * ((u - c) / s) ** 2)


# name -> (duration s, fn(u) -> (pitch, roll, twist) degrees)
GESTURES = {
    "nod":   (0.7, lambda u: (50.0 * math.sin(math.pi * u), 0.0, 0.0)),
    "flick": (0.6, lambda u: (0.0, 0.0, -70.0 * math.sin(math.pi * u))),
    "shake": (0.8, lambda u: (0.0, 35.0 * math.sin(2 * math.pi * 3 * u) * math.sin(math.pi * u), 0.0)),
    "circle": (1.0, lambda u: (35.0 * math.sin(2 * math.pi * u) * math.sin(math.pi * u),
                               35.0 * math.cos(2 * math.pi * u) * math.sin(math.pi * u), 0.0)),
}


def perform(base, tok, dev, name, amp=1.0, speed=1.0):
    dur, fn = GESTURES[name]
    dur /= speed
    n = int(dur * RATE)
    t0 = time.monotonic()
    for i in range(n + 1):
        u = i / n
        p, r, t = fn(u)
        post(base, tok, "/virtual?dev=" + dev, {"on": True, "pitch": p * amp, "roll": r * amp, "twist": t * amp})
        target = t0 + (i + 1) / RATE
        d = target - time.monotonic()
        if d > 0:
            time.sleep(d)
    post(base, tok, "/virtual?dev=" + dev, {"on": True, "pitch": 0.0, "roll": 0.0, "twist": 0.0})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8846")
    ap.add_argument("--dev", default="d0")
    ap.add_argument("--delays", default="5.1,6.1,6.1", help="sekundy oczekiwania PRZED każdym gestem")
    ap.add_argument("--amp", type=float, default=1.0)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("gestures", nargs="+")
    a = ap.parse_args()
    tok = get_token(a.url)
    delays = [float(x) for x in a.delays.split(",")]
    # włącz sterowanie ręczne i ustaw poziomo (keepalive co ~1 s, bo po VIRTUAL_TIMEOUT wraca sinusoida)
    post(a.url, tok, "/virtual?dev=" + a.dev, {"on": True, "pitch": 0.0, "roll": 0.0, "twist": 0.0})
    for i, name in enumerate(a.gestures):
        wait = delays[min(i, len(delays) - 1)]
        t_end = time.monotonic() + wait
        while time.monotonic() < t_end:
            post(a.url, tok, "/virtual?dev=" + a.dev, {"on": True, "pitch": 0.0, "roll": 0.0, "twist": 0.0})
            time.sleep(min(0.8, max(0.0, t_end - time.monotonic())))
        print("%7.2f  gest %s" % (time.monotonic(), name), flush=True)
        perform(a.url, tok, a.dev, name, a.amp, a.speed)
    time.sleep(1.5)
    post(a.url, tok, "/virtual?dev=" + a.dev, {"on": False})


if __name__ == "__main__":
    sys.exit(main() or 0)
