#!/usr/bin/env python3
"""
Test NA SPRZĘCIE: nagrywanie i dopasowywanie gestów na żywo ze strumienia działającego RibbitFlipa.

Czyta wyłącznie `GET /stream` (te same zdarzenia `s`, które rysują oscyloskopy w panelu) oraz
`GET /pose` (kalibracja osi). Nic do aplikacji nie wysyła, nie dotyka Settings/, nie naciska
klawiszy — każde rozpoznanie tylko wypisuje w konsoli. Aplikacja może stać w trybie LIVE
z prawdziwym kapslem albo w symulacji z ręcznym prowadzeniem kapsla (widżet 3D).

  py tools/gesture_proto/live.py record --name potrzasniecie [--takes 3] [--seconds 4] [--dev d0]
  py tools/gesture_proto/live.py match  [--threshold 70] [--channels both] [--all]
  py tools/gesture_proto/live.py check          # walidacja krzyżowa: każde nagranie vs pozostałe
  py tools/gesture_proto/live.py list
  py tools/gesture_proto/live.py replay --file templates/potrzasniecie.json [--all]

Wzorce lądują w tools/gesture_proto/templates/<nazwa>.json razem z SUROWYMI próbkami, więc
parametry (osie, pasmo, próg…) można zmieniać bez ponownego nagrywania.
"""
from __future__ import annotations

import argparse
import json
import os
import queue
import sys
import threading
import time
import urllib.request
from collections import deque
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gesture_dtw import (CAL_DEFAULT, DEFAULT_PARAMS, Detector, Recognizer,  # noqa: E402
                         merged_params, segment_take)

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(HERE, "templates")
DEFAULT_URL = "http://127.0.0.1:8770"


# ----------------------------------------------------------------------------
#  strumień SSE aplikacji
# ----------------------------------------------------------------------------
class Clock:
    """Wygładzony zegar próbek. BLE oddaje pakiety paczkami (kilka z tym samym znacznikiem
    czasu), a przepróbkowanie w DTW liczy na równe odstępy — więc czas próbki to 85 % „poprzednia
    + nominalny odstęp" i 15 % chwili odbioru. Nominalny odstęp mierzony z ostatnich ~5 s."""

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


def fetch_json(url, timeout=3.0):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except Exception:
        return None


def fetch_cal(base, dev):
    cfg = fetch_json("%s/pose?dev=%s" % (base, dev))
    cal = cfg.get("cal") if isinstance(cfg, dict) else None
    if isinstance(cal, dict) and "acc" in cal and "gyr" in cal:
        return cal
    return dict(CAL_DEFAULT)


AUTO_DEV = "auto"          # „ten kapsel, który wysyła" — bez zgadywania numeru slotu
AUTO_SWITCH_S = 2.0        # po tylu sekundach ciszy aktywnego kapsla przejmuje go inny, który nadaje


def stream_thread(base, dev, q, stop):
    """Wątek: łączy się z /stream (z filtrem ?dev=… albo bez niego dla trybu auto), wrzuca
    (ts_raw, sample, dev) do kolejki; komunikaty stanu jako ("status", tekst) i zdarzenia
    st / dev / cfg z aplikacji (każde ze swoim `dev`)."""
    auto = (dev in (None, "", AUTO_DEV))
    url = "%s/stream" % base if auto else "%s/stream?dev=%s" % (base, dev)
    req = urllib.request.Request(url, headers={"Accept": "text/event-stream"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            q.put(("status", "połączono z %s" % url))
            for raw in resp:
                if stop.is_set():
                    break
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data:"):
                    continue
                try:
                    ev = json.loads(line[5:].strip())
                except Exception:
                    continue
                t = ev.get("t")
                evdev = ev.get("dev")
                if not auto and evdev not in (None, dev) and t in ("s", "st", "dev"):
                    continue
                if t == "s":
                    a = ev.get("a")   # historyczna nazwa: CH0-2 = ŻYROSKOP
                    g = ev.get("g")   # historyczna nazwa: CH3-5 = AKCELEROMETR
                    if not (isinstance(a, list) and isinstance(g, list) and len(a) == 3 and len(g) == 3):
                        continue
                    q.put(("s", float(ev.get("ts", time.monotonic())), [a[0], a[1], a[2], g[0], g[1], g[2]],
                           evdev or dev))
                elif t in ("st", "dev"):
                    q.put((t, ev))
                elif t == "cfg":
                    q.put(("cfg", ev))
    except Exception as e:
        q.put(("error", "strumień: %s" % e))
    q.put(("end", None))


class Stream:
    """Klient strumienia. `on_event(kind, payload)` dostaje: status (tekst), st (stan połączenia
    kapsla), dev (nazwa/bateria/RSSI), cfg (tryb), error (tekst), end, stall (brak próbek),
    devsel (id kapsla wybranego w trybie auto). Tryb auto (dev="auto" albo None): słucha całego
    strumienia i bierze próbki z tego kapsla, który je wysyła; gdy ten zamilknie na AUTO_SWITCH_S,
    a inny nadaje, przełącza się na niego. Zdarzenia st/dev przekazuje z ich `dev`, więc odbiorca
    sam decyduje, czyj stan pokazać."""

    def __init__(self, base, dev, on_event=None):
        self.q = queue.Queue()
        self.stop = threading.Event()
        self.clock = Clock()
        self.on_event = on_event
        self.auto = (dev in (None, "", AUTO_DEV))
        self.active = None if self.auto else dev
        self._seen = {}
        self.th = threading.Thread(target=stream_thread, args=(base, dev, self.q, self.stop), daemon=True)
        self.th.start()
        self.n = 0
        self.t_first = None

    def _event(self, kind, payload, quiet):
        if self.on_event is not None:
            try:
                self.on_event(kind, payload)
            except Exception:
                pass
        if quiet:
            return
        if kind == "status":
            print("  [%s]" % payload)
        elif kind == "devsel":
            print("  [kapsel: %s — ten, który wysyła]" % payload)
        elif kind == "st":
            if self.auto and payload.get("dev") not in (None, self.active):
                return
            print("  [%s: %s]" % (payload.get("conn"), payload.get("msg", "")))
        elif kind == "cfg":
            print("  [tryb: %s]" % ("SYMULACJA" if payload.get("simulate") else "LIVE"))
        elif kind == "error":
            print("  BŁĄD %s" % payload)
        elif kind == "end":
            print("  strumień zakończony")
        elif kind == "stall":
            print("  … brak próbek od 5 s (kapsel nie wysyła? panel w trybie pauzy?)")

    def samples(self, seconds=None, quiet=False):
        """Generator (ts_wygładzony, sample). Kończy po `seconds` (od pierwszej próbki) albo gdy
        strumień padnie."""
        t_end = None
        while not self.stop.is_set():
            try:
                item = self.q.get(timeout=5.0)
            except queue.Empty:
                self._event("stall", None, quiet)
                continue
            kind = item[0]
            if kind == "s":
                evdev = item[3]
                if self.auto:
                    now = time.monotonic()
                    self._seen[evdev] = now
                    if self.active is None or (evdev != self.active and
                                               now - self._seen.get(self.active, 0.0) > AUTO_SWITCH_S):
                        self.active = evdev
                        self._event("devsel", evdev, quiet)
                    if evdev != self.active:
                        continue
                ts = self.clock.next(item[1])
                self.n += 1
                if t_end is None and seconds is not None:
                    t_end = ts + seconds
                yield ts, item[2]
                if t_end is not None and ts >= t_end:
                    return
            elif kind in ("error", "end"):
                self._event(kind, item[1], quiet or (kind == "error" and self.stop.is_set()))
                return
            else:
                self._event(kind, item[1], quiet)

    def close(self):
        self.stop.set()


# ----------------------------------------------------------------------------
#  wzorce na dysku
# ----------------------------------------------------------------------------
def template_path(name):
    safe = "".join(c if (c.isalnum() or c in "-_") else "_" for c in name.strip())
    return os.path.join(TEMPLATES_DIR, safe + ".json")


def load_templates():
    out = []
    if not os.path.isdir(TEMPLATES_DIR):
        return out
    for fn in sorted(os.listdir(TEMPLATES_DIR)):
        if fn.endswith(".json"):
            try:
                with open(os.path.join(TEMPLATES_DIR, fn), "r", encoding="utf-8") as f:
                    out.append(json.load(f))
            except Exception as e:
                print("  pomijam %s: %s" % (fn, e))
    return out


def take_samples(take):
    return [(float(r[0]), [int(v) for v in r[1:7]]) for r in take["samples"]]


def build_recognizer(tpls, params, exclude=None, thresholds=True):
    """Recognizer ze wszystkich nagrań (z pominięciem `exclude` = (nazwa, indeks nagrania))."""
    rec = Recognizer(params)
    for tpl in tpls:
        cal = tpl.get("cal") or CAL_DEFAULT
        for i, take in enumerate(tpl["takes"]):
            if exclude == (tpl["name"], i):
                continue
            seg, _ = segment_take(take_samples(take), params, cal, tpl.get("gLsb"))
            if seg is None:
                print("  %s/%d: spotter nie znalazł gestu w nagraniu" % (tpl["name"], i + 1))
                continue
            rec.add_segment(tpl["name"], seg, i)
        if thresholds and tpl.get("threshold") is not None:
            rec.thresholds[tpl["name"]] = float(tpl["threshold"])
    return rec


def params_from_args(args):
    p = {}
    for key in ("channels", "threshold", "band", "intensityTol", "durationTol", "resampleN",
                "startEnergy", "endEnergy", "endHoldMs", "cooldownMs"):
        v = getattr(args, key, None)
        if v is not None:
            p[key] = v
    if getattr(args, "shape_only", False):
        p["shapeOnly"] = True
    return merged_params(p)


# ----------------------------------------------------------------------------
#  komendy
# ----------------------------------------------------------------------------
def cmd_record(args):
    os.makedirs(TEMPLATES_DIR, exist_ok=True)
    params = params_from_args(args)
    cal = fetch_cal(args.url, args.dev)
    print("Nagrywanie gestu „%s” z %s (kapsel %s), kalibracja osi: %s" % (args.name, args.url, args.dev, json.dumps(cal)))
    st = Stream(args.url, args.dev)
    takes = []
    try:
        # rozgrzewka: bias żyroskopu i wektor spoczynku — jak w aplikacji, kapsel ma chwilę poleżeć
        print("Połóż kapsel / trzymaj nieruchomo — zbieram 2 s spoczynku…")
        rest = list(st.samples(seconds=2.0))
        if len(rest) < 20:
            print("Za mało próbek (%d) — czy kapsel wysyła dane? Sprawdź panel." % len(rest))
            return 1
        hz = len(rest) / max(1e-6, rest[-1][0] - rest[0][0])
        print("  ok, %d próbek, ~%.0f Hz" % (len(rest), hz))
        attempts = 0
        while len(takes) < args.takes and attempts < args.takes + 3:
            attempts += 1
            print("\nNagranie %d/%d — za chwilę wykonaj gest RAZ i zatrzymaj kapsel." % (len(takes) + 1, args.takes))
            for c in (3, 2, 1):
                print("  %d…" % c)
                for _ in st.samples(seconds=0.7, quiet=True):
                    pass
            print("  >>> TERAZ <<<")
            samples = [(ts, s) for ts, s in rest[-40:]]        # 0,8 s spoczynku sprzed gestu
            samples += list(st.samples(seconds=args.seconds, quiet=True))
            t0 = samples[0][0]
            rel = [(round(ts - t0, 4), s) for ts, s in samples]
            seg, sp = segment_take(rel, params, cal)
            if seg is None:
                print("  nie wykryłem ruchu (energia szczytowa poniżej progu startu). Powtórz to nagranie.")
                rest = samples[-40:]
                continue
            print("  gest %.2f s, szczyt %.0f °/s, %d próbek, 1 g ≈ %.0f LSB%s" % (
                seg.duration, seg.peak_dps(), len(seg.ts), sp.g_est(), " (zamknięty na siłę — za długi?)" if seg.forced else ""))
            takes.append({"samples": [[ts, *s] for ts, s in rel], "gesture": [round(seg.t_start, 3), round(seg.t_end, 3)]})
            rest = samples[-40:]
    finally:
        st.close()
    if len(takes) < 1:
        print("Brak nagrań.")
        return 1
    tpl = {"name": args.name, "created": datetime.now().isoformat(timespec="seconds"), "dev": args.dev,
           "cal": cal, "gLsb": None, "params": {k: params[k] for k in ("channels", "band", "resampleN")},
           "threshold": None, "takes": takes}
    # spójność nagrań → proponowany próg
    rec = build_recognizer([tpl], params, thresholds=False)
    if len(takes) >= 2:
        sims = rec.consistency(args.name)
        thr = rec.suggest_threshold(args.name)
        tpl["threshold"] = round(thr, 1) if thr is not None else None
        print("\nSpójność nagrań: min %.0f %%, śr. %.0f %% → proponowany próg podobieństwa %.0f %%"
              % (min(sims), sum(sims) / len(sims), thr))
        if min(sims) < 60:
            print("  ⚠ nagrania różnią się między sobą — powtórz spokojniej albo wybierz prostszy gest")
    else:
        print("\nJedno nagranie: próg zostaje domyślny (%.0f %%). Dwa–trzy nagrania dają lepszy próg." % params["threshold"])
    # kolizje z gestami już zapisanymi
    others = [t for t in load_templates() if t["name"] != args.name]
    if others:
        rec_all = build_recognizer(others, params, thresholds=False)
        worst = {}
        for take in takes:
            seg, _ = segment_take(take_samples(take), params, cal)
            for r in rec_all.classify(seg):
                worst[r["name"]] = max(worst.get(r["name"], 0.0), r["sim"])
        for name, sim in sorted(worst.items(), key=lambda kv: -kv[1])[:3]:
            flag = " ⚠ za blisko — te dwa gesty będą się mylić" if sim >= 80 else ""
            print("  podobieństwo do „%s”: %.0f %%%s" % (name, sim, flag))
    with open(template_path(args.name), "w", encoding="utf-8") as f:
        json.dump(tpl, f, ensure_ascii=False)
    print("Zapisano %s" % template_path(args.name))
    return 0


def print_candidates(cands, prefix="    "):
    for r in cands[:3]:
        print("%s%-16s %5.1f %%  intens. %.2f×%s  czas %.2f×%s" % (
            prefix, r["name"], r["sim"], r["intensity"], "" if r["okIntensity"] else "✗",
            r["durRatio"], "" if r["okDuration"] else "✗"))


def run_detector(samples_iter, det, show_all):
    n_seg = 0
    for ts, s in samples_iter:
        ev = det.push(ts, s)
        seg = det.last_segment
        if seg is not None and det.spotter.segments != n_seg:
            n_seg = det.spotter.segments
            if ev is not None:
                print("%8.2f s  ▶ GEST: %-16s %5.1f %%  (%.2f s, intens. %.2f×)" % (
                    ts, ev["name"], ev["sim"], ev["duration"], ev["intensity"]))
                if show_all:
                    print_candidates(ev["candidates"])
            elif show_all:
                print("%8.2f s  · ruch %.2f s, szczyt %.0f °/s — nic nie przeszło" % (ts, seg.duration, seg.peak_dps()))
                print_candidates(det.last_candidates or [])


def cmd_match(args):
    tpls = load_templates()
    if not tpls:
        print("Brak wzorców w %s — najpierw `record`." % TEMPLATES_DIR)
        return 1
    params = params_from_args(args)
    rec = build_recognizer(tpls, params, thresholds=(args.threshold is None))
    cal = tpls[0].get("cal") or fetch_cal(args.url, args.dev)
    det = Detector(rec, params, cal)
    print("Wzorce: %s" % ", ".join("%s (%d nagr., próg %.0f %%)" % (n, sum(1 for t in rec.templates if t.name == n), rec.threshold_for(n)) for n in rec.names()))
    print("Osie: %s · pasmo %.2f · intensywność ×%s · czas ×%s · %s" % (
        params["channels"], params["band"], params["intensityTol"] or "∞", params["durationTol"] or "∞",
        "sam kształt" if params["shapeOnly"] else "kształt + amplituda"))
    print("Słucham %s (kapsel %s). Ctrl+C kończy.%s\n" % (args.url, args.dev, "  Pokazuję każdy ruch (--all)." if args.all else ""))
    st = Stream(args.url, args.dev)
    try:
        run_detector(st.samples(), det, args.all)
    except KeyboardInterrupt:
        pass
    finally:
        st.close()
    return 0


def cmd_replay(args):
    with open(args.file, "r", encoding="utf-8") as f:
        tpl = json.load(f)
    tpls = load_templates()
    params = params_from_args(args)
    rec = build_recognizer(tpls, params, thresholds=(args.threshold is None))
    for i, take in enumerate(tpl["takes"]):
        print("nagranie %d/%d:" % (i + 1, len(tpl["takes"])))
        det = Detector(rec, params, tpl.get("cal"), tpl.get("gLsb"))
        run_detector(take_samples(take), det, True)
    return 0


def cross_check(tpls, params, file_thresholds=True):
    """Walidacja krzyżowa: każde nagranie rozpoznawane wzorcami zbudowanymi z POZOSTAŁYCH nagrań,
    plus kolizje między gestami. Zwraca słownik (używany przez `check` i przez laboratorium)."""
    rows = []
    total = ok = conf = rej = 0
    for tpl in tpls:
        cal = tpl.get("cal") or CAL_DEFAULT
        for i, take in enumerate(tpl["takes"]):
            rec = build_recognizer(tpls, params, exclude=(tpl["name"], i), thresholds=file_thresholds)
            row = {"name": tpl["name"], "take": i + 1}
            if not any(t.name == tpl["name"] for t in rec.templates):
                row["note"] = "jedyne nagranie tego gestu — nie ma z czym porównać"
                rows.append(row)
                continue
            seg, _ = segment_take(take_samples(take), params, cal, tpl.get("gLsb"))
            if seg is None:
                row["note"] = "brak segmentu"
                rows.append(row)
                continue
            cands = rec.classify(seg)
            total += 1
            acc = [r for r in cands if r["accepted"]]
            if not acc:
                rej += 1
                row["result"] = "rejected"
            elif acc[0]["name"] == tpl["name"]:
                ok += 1
                row["result"] = "ok"
            else:
                conf += 1
                row["result"] = "confused"
            own = next((r for r in cands if r["name"] == tpl["name"]), None)
            best_other = next((r for r in cands if r["name"] != tpl["name"]), None)
            row["own"] = round(own["sim"], 1) if own else 0.0
            row["threshold"] = round(rec.threshold_for(tpl["name"]), 1)
            row["okIntensity"] = bool(own and own["okIntensity"])
            row["okDuration"] = bool(own and own["okDuration"])
            if best_other:
                row["other"] = best_other["name"]
                row["otherSim"] = round(best_other["sim"], 1)
            rows.append(row)
    collisions = []
    if len(tpls) > 1:
        rec_all = build_recognizer(tpls, params, thresholds=False)
        for tpl in tpls:
            worst = {}
            for take in tpl["takes"]:
                seg, _ = segment_take(take_samples(take), params, tpl.get("cal"), tpl.get("gLsb"))
                if seg is None:
                    continue
                for r in rec_all.classify(seg):
                    if r["name"] != tpl["name"]:
                        worst[r["name"]] = max(worst.get(r["name"], 0.0), r["sim"])
            if worst:
                n2, s2 = max(worst.items(), key=lambda kv: kv[1])
                collisions.append({"a": tpl["name"], "b": n2, "sim": round(s2, 1), "warn": s2 >= 80})
    return {"rows": rows, "total": total, "ok": ok, "confused": conf, "rejected": rej,
            "collisions": collisions, "pass": bool(total and ok == total)}


def cmd_check(args):
    tpls = load_templates()
    if not tpls:
        print("Brak wzorców.")
        return 1
    params = params_from_args(args)
    print("Walidacja krzyżowa: każde nagranie rozpoznawane wzorcami zbudowanymi z POZOSTAŁYCH nagrań.")
    print("(próg z pliku wzorca albo --threshold; ✓ = trafiony gest, ✗ = inny gest, – = nic nie przeszło)\n")
    res = cross_check(tpls, params, file_thresholds=(args.threshold is None))
    marks = {"ok": "✓", "confused": "✗", "rejected": "–"}
    for row in res["rows"]:
        if "note" in row:
            print("%-16s nagr. %d: %s" % (row["name"], row["take"], row["note"]))
            continue
        other = ("   najbliższy inny: %s %.1f %%" % (row["other"], row["otherSim"])) if "other" in row else ""
        print("%-16s nagr. %d: %s własny %5.1f %% (próg %.0f)%s" % (
            row["name"], row["take"], marks[row["result"]], row["own"], row["threshold"], other))
    if res["total"]:
        print("\nRazem: %d nagrań — trafione %d (%.0f %%), pomylone %d, odrzucone %d" % (
            res["total"], res["ok"], 100.0 * res["ok"] / res["total"], res["confused"], res["rejected"]))
        print("PASS" if res["pass"] else "FAIL  (do strojenia: próg, osie, intensywność — albo powtórz nagrania)")
    if res["collisions"]:
        print("\nKolizje między gestami (max podobieństwo nagrań jednego do wzorców drugiego):")
        for c in res["collisions"]:
            print("  %-16s ↔ %-16s %5.1f %%%s" % (c["a"], c["b"], c["sim"], "  ⚠" if c["warn"] else ""))
    return 0


def cmd_list(args):
    tpls = load_templates()
    if not tpls:
        print("Brak wzorców w %s" % TEMPLATES_DIR)
        return 0
    for t in tpls:
        durs = ["%.2f" % (tk["gesture"][1] - tk["gesture"][0]) for tk in t["takes"]]
        print("%-16s %d nagr. (%s s)  próg %s  %s  osie %s" % (
            t["name"], len(t["takes"]), "/".join(durs), t.get("threshold"), t.get("created", ""),
            (t.get("params") or {}).get("channels", "?")))
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--dev", default=AUTO_DEV, help="slot kapsla (d0…d4); domyślnie auto = ten, który wysyła")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def tuning(p):
        p.add_argument("--channels", choices=("gyro", "accel", "both", "magnitude"))
        p.add_argument("--threshold", type=float)
        p.add_argument("--band", type=float)
        p.add_argument("--intensityTol", type=float, dest="intensityTol")
        p.add_argument("--durationTol", type=float, dest="durationTol")
        p.add_argument("--shape-only", action="store_true", dest="shape_only")
        p.add_argument("--startEnergy", type=float, dest="startEnergy")
        p.add_argument("--endEnergy", type=float, dest="endEnergy")
        p.add_argument("--endHoldMs", type=float, dest="endHoldMs")
        p.add_argument("--cooldownMs", type=float, dest="cooldownMs")

    p = sub.add_parser("record", help="nagraj gest (1-3 powtórzenia) z żywego strumienia")
    p.add_argument("--name", required=True)
    p.add_argument("--takes", type=int, default=3)
    p.add_argument("--seconds", type=float, default=4.0)
    tuning(p)
    p = sub.add_parser("match", help="rozpoznawaj na żywo")
    p.add_argument("--all", action="store_true", help="pokazuj każdy wycięty ruch, nie tylko rozpoznane")
    tuning(p)
    p = sub.add_parser("check", help="walidacja krzyżowa zapisanych nagrań")
    tuning(p)
    p = sub.add_parser("replay", help="przepuść zapisane nagranie przez detektor")
    p.add_argument("--file", required=True)
    tuning(p)
    sub.add_parser("list", help="wypisz wzorce")
    args = ap.parse_args(argv)
    return {"record": cmd_record, "match": cmd_match, "check": cmd_check, "replay": cmd_replay, "list": cmd_list}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main() or 0)
