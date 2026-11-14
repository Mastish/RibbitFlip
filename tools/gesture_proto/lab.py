#!/usr/bin/env python3
"""
Laboratorium gestów — środowisko testowe prototypu na PRAWDZIWYM kapslu (albo w symulacji).

Uruchom RibbitFlipa jak zwykle i połącz kapsel (najlepiej z wyłączonym „Uzbrojone" albo z --no-keys,
żeby gesty nie naciskały klawiszy w trakcie prób), potem:

    py tools/gesture_proto/lab.py                       # http://127.0.0.1:8790/ (otwiera przeglądarkę)
    py tools/gesture_proto/lab.py --url http://127.0.0.1:8813 --dev d0 --port 8790 --no-open

Strona ma dwa poziomy. TRYB PROSTY (cała pierwsza strona): „Nagraj" → wykonaj gest → „Zakończ"
(albo koniec sam, gdy ruch ucichnie), jeden suwak „jak dokładnie trzeba powtórzyć gest", karty
gestów, które zapalają się przy rozpoznaniu, opcjonalny klawisz do naciśnięcia. ZAAWANSOWANE
(zwinięte): energia ruchu i segmentacja na żywo, krzywe ostatniego ruchu na tle wzorca, dziennik
z kandydatami, wszystkie pokrętła, walidacja krzyżowa nagrań, sesja testowa z licznikiem trafień.

Laboratorium czyta strumień aplikacji (GET /stream) i tnie go oraz rozpoznaje TU, w Pythonie — tym
samym kodem, który poszedłby do aplikacji — a przeglądarka jest tylko pulpitem. Gest może
opcjonalnie nacisnąć klawisz przez POST /test-key aplikacji (tylko gdy Uzbrojone).
Wzorce lądują w tools/gesture_proto/templates/ — te same pliki czyta live.py. Ustawienia
laboratorium (adres, kapsel, suwak, parametry) w tools/gesture_proto/lab_settings.json.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import queue
import re
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from collections import deque
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gesture_dtw import (CAL_DEFAULT, DEFAULT_PARAMS, GYRO_LSB_PER_DPS, Detector, _resample,  # noqa: E402
                         _smooth, merged_params, segment_take)
from live import (AUTO_DEV, TEMPLATES_DIR, Stream, build_recognizer, cross_check, fetch_cal,  # noqa: E402
                  fetch_json, load_templates, take_samples, template_path)

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SETTINGS_PATH = os.path.join(HERE, "lab_settings.json")
HTML_PATH = os.path.join(HERE, "lab.html")
PARAM_TYPES = {k: type(v) for k, v in DEFAULT_PARAMS.items()}
CHANNELS = ("gyro", "accel", "both", "magnitude")
LIMITS = {"threshold": (0, 100), "intensityTol": (0, 10), "durationTol": (0, 10), "band": (0.02, 0.6),
          "resampleN": (8, 200), "smooth": (1, 9), "accelWeight": (0, 3), "simRef": (0.5, 5),
          "startEnergy": (2, 200), "endEnergy": (1, 200), "endFrac": (0, 0.9), "endHoldMs": (40, 2000),
          "minMs": (40, 2000), "maxMs": (300, 10000), "preRollMs": (0, 500), "cooldownMs": (0, 5000)}
MANUAL_MAX_S = 25.0          # nagrywanie proste kończy się samo najpóźniej po tylu sekundach
TAKE_TAIL_S = 0.3            # ile spoczynku po ruchu dołożyć do nagrania powtórzenia


def coerce_params(p):
    """Słownik z przeglądarki/pliku → tylko znane klucze, właściwe typy, w granicach."""
    out = {}
    for k, v in (p or {}).items():
        if k not in DEFAULT_PARAMS:
            continue
        t = PARAM_TYPES[k]
        try:
            if t is bool:
                out[k] = (v.strip().lower() in ("1", "true", "tak", "on")) if isinstance(v, str) else bool(v)
            elif t is int:
                out[k] = int(round(float(v)))
            elif t is float:
                out[k] = float(v)
            else:
                out[k] = str(v)
        except (TypeError, ValueError):
            continue
        if k in LIMITS and not isinstance(out[k], bool):
            lo, hi = LIMITS[k]
            out[k] = max(lo, min(hi, out[k]))
    if out.get("channels") not in (None,) + CHANNELS:
        out["channels"] = "gyro"
    if "accelMode" in out and out["accelMode"] not in ("delta", "absolute"):
        out["accelMode"] = "delta"
    return out


def accuracy_params(v):
    """Jeden suwak „jak dokładnie trzeba powtórzyć gest" (0..100) → trzy parametry.
    50 = domyślne (próg 70 %, siła ×2, tempo ×1.8). Poniżej 20: siła i tempo bez znaczenia."""
    v = max(0.0, min(100.0, float(v)))
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


def _angle_deg(u, v):
    """Kąt między dwoma wektorami (stopnie); None, gdy któryś jest zerowy."""
    try:
        nu = math.sqrt(sum(c * c for c in u))
        nv = math.sqrt(sum(c * c for c in v))
        if nu < 1e-9 or nv < 1e-9:
            return None
        c = sum(a * b for a, b in zip(u, v)) / (nu * nv)
        return math.degrees(math.acos(max(-1.0, min(1.0, c))))
    except Exception:
        return None


def curves_of(seg, params, g_lsb):
    """Przebiegi do rysowania: żyro w °/s i zmiana akcelerometru w g, przepróbkowane jak do DTW."""
    n = max(8, int(params["resampleN"]))
    k = int(params["smooth"])
    g = _resample(seg.ts, _smooth(seg.g, k), n)
    a = _resample(seg.ts, _smooth(seg.a, k), n)
    return {"g": [[round(v / GYRO_LSB_PER_DPS, 1) for v in row] for row in g],
            "a": [[round((row[i] - seg.a0[i]) / g_lsb, 3) for i in range(3)] for row in a]}


class Lab:
    def __init__(self, url=None, dev=None):
        self.settings = self._load_settings()
        self.url = (url or self.settings.get("url") or "http://127.0.0.1:8770").rstrip("/")
        # "auto" = ten kapsel, który wysyła próbki (Stream w trybie auto); po podłączeniu Triki 5 na
        # slocie d4 laboratorium nie może sterczeć przy pustym d0.
        self.dev = dev or self.settings.get("dev") or AUTO_DEV
        self.active_dev = None if self.dev == AUTO_DEV else self.dev
        self._devstat = {}                         # dev -> {conn, msg, name, battery, rssi}
        self.params = merged_params(coerce_params(self.settings.get("params")))
        try:
            self.accuracy = max(0, min(100, int(self.settings.get("accuracy", 50))))
        except (TypeError, ValueError):
            self.accuracy = 50
        self.lock = threading.RLock()
        self.subs = {}
        self.ring = deque(maxlen=50 * 20)          # (ts, sample) — 20 s dla nagrywania
        self.last_ts = None
        self.last_rx = None
        self.rx_times = deque(maxlen=100)
        self.cal = dict(CAL_DEFAULT)
        self.templates = []
        self.rec = None
        self.det = None
        self._seg_id = None
        self._e_n = 0
        self._last_st = 0.0
        self.status = {"connected": False, "url": self.url, "dev": self.dev, "mode": "?", "conn": "?",
                       "msg": "łączę…", "name": None, "battery": None, "rssi": None, "hz": 0.0, "samples": 0}
        self.recording = None
        self.stats = {"segments": 0, "detections": {}, "rejected": 0}
        self.hits = {}
        self.last_sim = {}
        self._token = None
        self._gen = 0
        self.reload_templates()
        self.connect(self.url, self.dev)

    # ------------------------------------------------------------------ ustawienia
    def _load_settings(self):
        try:
            with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
                d = json.load(f)
                return d if isinstance(d, dict) else {}
        except Exception:
            return {}

    def _save_settings(self):
        try:
            with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
                json.dump({"url": self.url, "dev": self.dev, "accuracy": self.accuracy, "params": self.params},
                          f, ensure_ascii=False, indent=1)
        except Exception as e:
            print("nie zapisałem ustawień: %s" % e)

    # ------------------------------------------------------------------ SSE do przeglądarki
    def subscribe(self):
        q = queue.Queue(maxsize=2000)
        with self.lock:
            self.subs[q] = True
        return q

    def unsubscribe(self, q):
        with self.lock:
            self.subs.pop(q, None)

    def publish(self, ev):
        with self.lock:
            subs = list(self.subs)
        for q in subs:
            try:
                q.put_nowait(ev)
            except queue.Full:
                try:
                    q.get_nowait()
                    q.put_nowait(ev)
                except queue.Empty:
                    pass

    # ------------------------------------------------------------------ wzorce / silnik
    def reload_templates(self):
        with self.lock:
            self.templates = load_templates()
            self.rec = build_recognizer(self.templates, self.params, thresholds=True)
            self._rebuild_detector()

    def _rebuild_detector(self):
        old = self.det
        det = Detector(self.rec, self.params, self.cal)
        if old is not None:                         # bias i spoczynek przechodzą — bez ponownej rozgrzewki
            sp, so = det.spotter, old.spotter
            sp.bias = list(so.bias)
            sp.a_rest = list(so.a_rest) if so.a_rest else None
            sp._g_est = so._g_est
            sp._bias_n = so._bias_n
            sp._a_prev = so._a_prev
        self.det = det
        self._seg_id = None

    def _apply_params(self, p):
        with self.lock:
            self.params = merged_params({**self.params, **p})
            self.rec = build_recognizer(self.templates, self.params, thresholds=True)
            self._rebuild_detector()
        self._save_settings()
        self.publish({"t": "params", "params": self.params, "accuracy": self.accuracy})
        return self.params

    def set_params(self, p):
        return self._apply_params(coerce_params(p))

    def reset_params(self):
        with self.lock:
            self.accuracy = 50
        return self._apply_params(dict(DEFAULT_PARAMS))

    def set_accuracy(self, v):
        try:
            v = max(0, min(100, int(round(float(v)))))
        except (TypeError, ValueError):
            return {"ok": False, "error": "zła wartość"}
        with self.lock:
            self.accuracy = v
        self._apply_params(accuracy_params(v))
        return {"ok": True, "accuracy": v, "params": self.params}

    def gestures(self):
        out = []
        with self.lock:
            rec = self.rec
            for tpl in self.templates:
                name = tpl["name"]
                sims = rec.consistency(name)
                durs = [round(tk["gesture"][1] - tk["gesture"][0], 2) for tk in tpl["takes"] if tk.get("gesture")]
                out.append({"name": name, "takes": len(tpl["takes"]), "threshold": tpl.get("threshold"),
                            "effective": round(rec.threshold_for(name), 1), "testKey": tpl.get("testKey") or "",
                            "durations": durs, "consistency": round(min(sims), 1) if sims else None,
                            "suggested": round(rec.suggest_threshold(name), 1) if sims else None,
                            "created": tpl.get("created"), "channels": (tpl.get("params") or {}).get("channels"),
                            "hits": self.hits.get(name, 0), "lastSim": self.last_sim.get(name)})
        return out

    def _template(self, name):
        for tpl in self.templates:
            if tpl["name"] == name:
                return tpl
        return None

    def _write_template(self, tpl):
        os.makedirs(TEMPLATES_DIR, exist_ok=True)
        with open(template_path(tpl["name"]), "w", encoding="utf-8") as f:
            json.dump(tpl, f, ensure_ascii=False)

    def _free_name(self):
        names = {t["name"] for t in self.templates}
        n = 1
        while "Gest %d" % n in names:
            n += 1
        return "Gest %d" % n

    def update_gesture(self, name, threshold="keep", test_key="keep", new_name=None):
        with self.lock:
            tpl = self._template(name)
            if tpl is None:
                return {"ok": False, "error": "nie ma takiego gestu"}
            if threshold != "keep":
                tpl["threshold"] = None if threshold in (None, "") else max(0.0, min(100.0, float(threshold)))
            if test_key != "keep":
                tpl["testKey"] = str(test_key or "").strip()[:40]
            if new_name:
                new_name = new_name.strip()[:40]
                if new_name and new_name != name:
                    if self._template(new_name) is not None:
                        return {"ok": False, "error": "gest o tej nazwie już jest"}
                    try:
                        os.remove(template_path(name))
                    except OSError:
                        pass
                    tpl["name"] = new_name
                    self.hits[new_name] = self.hits.pop(name, 0)
            self._write_template(tpl)
        self.reload_templates()
        self.publish({"t": "gest", "gestures": self.gestures()})
        return {"ok": True}

    def delete_gesture(self, name):
        with self.lock:
            if self._template(name) is None:
                return {"ok": False, "error": "nie ma takiego gestu"}
            try:
                os.remove(template_path(name))
            except OSError as e:
                return {"ok": False, "error": str(e)}
            self.hits.pop(name, None)
            self.last_sim.pop(name, None)
        self.reload_templates()
        self.publish({"t": "gest", "gestures": self.gestures()})
        return {"ok": True}

    def template_curves(self, name, take):
        with self.lock:
            for n, t, seg in self.rec._raw:
                if n == name and t == take:
                    return {"ok": True, "name": n, "take": t, **curves_of(seg, self.params, self.rec.g_lsb)}
        return {"ok": False, "error": "brak"}

    def check(self):
        with self.lock:
            tpls = list(self.templates)
            params = dict(self.params)
        if not tpls:
            return {"ok": False, "error": "brak nagrań"}
        res = cross_check(tpls, params, file_thresholds=True)
        res["ok"] = True
        return res

    # ------------------------------------------------------------------ strumień aplikacji
    def connect(self, url, dev):
        with self.lock:
            self._gen += 1
            gen = self._gen
            self.url = (url or self.url).rstrip("/")
            self.dev = dev or self.dev
            self.active_dev = None if self.dev == AUTO_DEV else self.dev
            self._devstat = {}
            self.status.update({"connected": False, "url": self.url, "dev": self.active_dev or AUTO_DEV,
                                "want": self.dev, "msg": "łączę…", "conn": "?", "mode": "?", "name": None,
                                "battery": None, "rssi": None, "hz": 0.0})
        self._save_settings()
        threading.Thread(target=self._run, args=(gen,), daemon=True).start()
        self._publish_status()
        return self.status

    def devices(self, url=None):
        base = (url or self.url).rstrip("/")
        d = fetch_json(base + "/devices", timeout=3.0)
        if not isinstance(d, dict):
            return {"ok": False, "error": "aplikacja nie odpowiada pod %s" % base, "devices": []}
        devs = [{"dev": x.get("dev"), "name": x.get("name"), "color": x.get("color"), "bound": x.get("bound"),
                 "label": x.get("label")} for x in d.get("devices", [])]
        return {"ok": True, "devices": devs, "default": d.get("default")}

    def _run(self, gen):
        while gen == self._gen:
            with self.lock:
                dev_for_cal = self.active_dev
            cal = fetch_cal(self.url, dev_for_cal) if dev_for_cal else dict(CAL_DEFAULT)
            with self.lock:
                if gen != self._gen:
                    return
                self.cal = cal
                self._rebuild_detector()
            stream = Stream(self.url, self.dev, on_event=lambda k, p: self._on_event(gen, k, p))
            try:
                for ts, s in stream.samples(quiet=True):
                    if gen != self._gen:
                        break
                    self._on_sample(ts, s)
            finally:
                stream.close()
            if gen != self._gen:
                return
            with self.lock:
                self.status.update({"connected": False, "hz": 0.0,
                                    "msg": "brak połączenia z aplikacją pod %s — ponawiam za 3 s" % self.url})
            self._publish_status()
            time.sleep(3.0)

    _CONN_RANK = {"connected": 4, "sim": 4, "pairing": 3, "scanning": 2, "parked": 1}

    def _shown_dev(self):
        """Czyj stan pokazać: aktywnego kapsla (tego, który wysyła), a zanim jakiś wyśle — tego
        w najlepszym stanie (połączony > parowanie > szukanie), przy remisie o najniższym numerze."""
        if self.active_dev:
            return self.active_dev
        best, best_rank = None, -1
        for dev, s in sorted(self._devstat.items()):
            rank = self._CONN_RANK.get(s.get("conn"), 0)
            if rank > best_rank:
                best, best_rank = dev, rank
        return best

    def _refresh_shown(self):
        # pod blokadą
        shown = self._shown_dev()
        s = self._devstat.get(shown or "", {})
        self.status["dev"] = shown or AUTO_DEV
        self.status["want"] = self.dev
        self.status["conn"] = s.get("conn") or "?"
        self.status["msg"] = s.get("msg") or self.status.get("msg") or ""
        self.status["name"] = s.get("name")
        self.status["battery"] = s.get("battery")
        self.status["rssi"] = s.get("rssi")

    def _adopt_device(self, gen, dev):
        """Tryb auto wybrał kapsel: jego kalibracja osi, świeży detektor, stan w nagłówku."""
        cal = fetch_cal(self.url, dev)
        with self.lock:
            if gen != self._gen or self.active_dev != dev:
                return
            self.cal = cal
            self._rebuild_detector()
        self._publish_status()

    def _on_event(self, gen, kind, payload):
        if gen != self._gen:
            return
        with self.lock:
            st = self.status
            if kind == "status":
                st["connected"] = True
                st["msg"] = "połączono ze strumieniem"
            elif kind == "cfg":
                st["mode"] = "SYMULACJA" if payload.get("simulate") else "LIVE"
            elif kind == "devsel":
                self.active_dev = payload
                self._refresh_shown()
                threading.Thread(target=self._adopt_device, args=(gen, payload), daemon=True).start()
            elif kind in ("st", "dev"):
                dev = payload.get("dev") or self.active_dev or "d0"
                e = self._devstat.setdefault(dev, {})
                if kind == "st":
                    e["conn"] = payload.get("conn") or "?"
                    e["msg"] = payload.get("msg") or ""
                else:
                    e["name"] = payload.get("name")
                    e["battery"] = payload.get("battery")
                    e["rssi"] = payload.get("rssi")
                self._refresh_shown()
            elif kind == "error":
                st["connected"] = False
                st["msg"] = str(payload)
            elif kind == "end":
                st["connected"] = False
            elif kind == "stall":
                st["hz"] = 0.0
                st["msg"] = "brak próbek od 5 s — kapsel nie wysyła? uśpiony? pauza?"
        self._publish_status()

    def _publish_status(self):
        with self.lock:
            st = dict(self.status)
        self.publish({"t": "st", "app": st})

    def _on_sample(self, ts, s):
        now = time.monotonic()
        with self.lock:
            self.ring.append((ts, s))
            self.last_ts = ts
            self.last_rx = now
            self.rx_times.append(now)
            self.status["samples"] += 1
            det = self.det
            p = self.params
            ev = det.push(ts, s)
            sp = det.spotter
            seg = det.last_segment
            if seg is not None and id(seg) != self._seg_id:
                self._seg_id = id(seg)
                self._publish_segment(seg, det.last_candidates or [], ev)
            if ev is not None and self.recording is None:
                self._on_detect(ev)
            self._e_n += 1
            if self._e_n % 2 == 0:                     # 25 Hz wystarczy na oscyloskop
                code = {"idle": 0, "active": 1, "wait_still": 2}.get(sp.state, 0)
                end_thr = max(float(p["endEnergy"]), float(p["endFrac"]) * sp._peak) if code == 1 else float(p["endEnergy"])
                gs = sp._ring[-1][1] if sp._ring else (0.0, 0.0, 0.0)    # żyro po odjęciu biasu, LSB
                self.publish({"t": "e", "ts": round(ts, 3), "e": round(sp.energy, 1), "s": code, "end": round(end_thr, 1),
                              "g": [round(gs[0] / GYRO_LSB_PER_DPS, 1), round(gs[1] / GYRO_LSB_PER_DPS, 1),
                                    round(gs[2] / GYRO_LSB_PER_DPS, 1)]})
            if now - self._last_st >= 2.0:
                self._last_st = now
                if len(self.rx_times) >= 2:
                    span = self.rx_times[-1] - self.rx_times[0]
                    self.status["hz"] = round((len(self.rx_times) - 1) / span, 1) if span > 0 else 0.0
                self.status["connected"] = True
                pub_status = True
            else:
                pub_status = False
        if pub_status:
            self._publish_status()

    def _publish_segment(self, seg, cands, ev):
        # pod blokadą (wołane z _on_sample)
        self.stats["segments"] += 1
        best = cands[0] if cands else None
        tpl_curves = None
        start_diff = None
        if best is not None:
            for n, t, tseg in self.rec._raw:
                if n == best["name"] and t == best.get("take"):
                    tpl_curves = {"name": n, "take": t, **curves_of(tseg, self.params, self.rec.g_lsb)}
                    # Położenie startowe: kąt między wektorem grawitacji w spoczynku przed tym ruchem
                    # a tym samym wektorem sprzed nagrania wzorca. Duży kąt = kapsel trzymany inaczej,
                    # a wtedy ten sam ruch ręki trafia w inne osie czujnika i gest się nie łapie.
                    start_diff = _angle_deg(seg.a0, tseg.a0)
                    break
        if ev is not None:
            self.stats["detections"][ev["name"]] = self.stats["detections"].get(ev["name"], 0) + 1
        else:
            self.stats["rejected"] += 1
        out = []
        for r in cands[:5]:
            out.append({k: (round(v, 2) if isinstance(v, float) else v) for k, v in r.items()})
        self.publish({"t": "seg", "ts": round(seg.t_end, 3), "dur": round(seg.duration, 2),
                      "peak": round(seg.peak_dps()), "forced": seg.forced, "cands": out,
                      "startDiff": (round(start_diff) if start_diff is not None else None),
                      "curves": curves_of(seg, self.params, self.rec.g_lsb), "tpl": tpl_curves,
                      "detected": ev["name"] if (ev is not None and self.recording is None) else None,
                      "recording": self.recording is not None, "stats": self.stats})

    def _on_detect(self, ev):
        self.hits[ev["name"]] = self.hits.get(ev["name"], 0) + 1
        self.last_sim[ev["name"]] = round(ev["sim"], 1)
        self.publish({"t": "det", "name": ev["name"], "sim": round(ev["sim"], 1), "ts": round(ev["ts"], 3),
                      "duration": round(ev["duration"], 2), "intensity": round(ev["intensity"], 2),
                      "durRatio": round(ev["durRatio"], 2), "hits": self.hits[ev["name"]]})
        tpl = self._template(ev["name"])
        key = (tpl or {}).get("testKey") or ""
        if key:
            threading.Thread(target=self._send_key, args=(key,), daemon=True).start()

    # ------------------------------------------------------------------ klawisz testowy przez aplikację
    def _get_token(self, force=False):
        if self._token is not None and not force:
            return self._token
        try:
            with urllib.request.urlopen(self.url + "/", timeout=3) as r:
                html = r.read().decode("utf-8", "replace")
            m = re.search(r'window\.RIBBITFLIP_TOKEN="([^"]+)"', html)
            self._token = m.group(1) if m else ""
        except Exception:
            self._token = ""
        return self._token

    def _send_key(self, spec):
        body = {"sequence": spec} if (";" in spec or spec.startswith("wait ")) else {"keySpec": spec}
        res = None
        for attempt in (0, 1):
            tok = self._get_token(force=(attempt == 1))
            target = self.active_dev or (self.dev if self.dev != AUTO_DEV else None)
            req = urllib.request.Request("%s/test-key%s" % (self.url, ("?dev=" + target) if target else ""), method="POST",
                                         data=json.dumps(body).encode("utf-8"),
                                         headers={"Content-Type": "application/json", "X-RibbitFlip-Token": tok})
            try:
                with urllib.request.urlopen(req, timeout=3) as r:
                    res = json.loads(r.read().decode("utf-8", "replace"))
                break
            except urllib.error.HTTPError as e:
                if e.code == 403 and attempt == 0:
                    continue
                res = {"ok": False, "error": "HTTP %d" % e.code}
                break
            except Exception as e:
                res = {"ok": False, "error": str(e)}
                break
        res = res or {"ok": False, "error": "?"}
        self.publish({"t": "key", "spec": spec, "sent": bool(res.get("sent")), "ok": bool(res.get("ok")),
                      "error": res.get("error")})

    # ------------------------------------------------------------------ nagrywanie
    def _stream_now(self):
        with self.lock:
            if self.last_ts is None:
                return None
            return self.last_ts + (time.monotonic() - self.last_rx)

    def _ring_slice(self, t0, t1):
        with self.lock:
            return [(ts, s) for ts, s in self.ring if t0 <= ts <= t1]

    def start_record(self, name, mode="manual", takes=3, seconds=4.0, append=False):
        name = str(name or "").strip()[:40]
        mode = "countdown" if mode == "countdown" else "manual"
        try:
            takes = max(1, min(5, int(takes)))
            seconds = max(2.0, min(8.0, float(seconds)))
        except (TypeError, ValueError):
            return {"ok": False, "error": "zła liczba nagrań albo sekund"}
        with self.lock:
            if self.recording is not None:
                return {"ok": False, "error": "nagrywanie już trwa"}
            if not self.status.get("connected") or self.last_ts is None:
                return {"ok": False, "error": "brak strumienia z aplikacji — połącz kapsel"}
            if not name:
                name = self._free_name()
            append = bool(append) and self._template(name) is not None
            self.recording = {"name": name, "mode": mode, "takes": takes, "seconds": seconds, "cancel": False,
                              "stop": False, "append": append, "t_start": None}
        threading.Thread(target=(self._record_manual if mode == "manual" else self._record_countdown), daemon=True).start()
        return {"ok": True, "name": name, "mode": mode}

    def stop_record(self):
        with self.lock:
            if self.recording is None:
                return {"ok": False, "error": "nic nie nagrywam"}
            self.recording["stop"] = True
        return {"ok": True}

    def cancel_record(self):
        with self.lock:
            if self.recording is None:
                return {"ok": False, "error": "nic nie nagrywam"}
            self.recording["cancel"] = True
        return {"ok": True}

    def _rec_pub(self, R, phase, **kw):
        self.publish({"t": "rec", "phase": phase, "name": R["name"], "mode": R["mode"], "takes": R["takes"], **kw})

    def _take_from_window(self, t0w, t1w):
        """Wytnij jedno powtórzenie z okna strumienia [t0w, t1w] tym samym spotterem, co na żywo."""
        samples = self._ring_slice(t0w, t1w)
        if len(samples) < 15:
            return None, None
        t0 = samples[0][0]
        rel = [(round(ts - t0, 4), s) for ts, s in samples]
        seg, sp = segment_take(rel, self.params, self.cal)
        if seg is None:
            return None, None
        return {"samples": [[ts, *s] for ts, s in rel], "gesture": [round(seg.t_start, 3), round(seg.t_end, 3)]}, seg

    def _record_manual(self):
        """Tryb prosty: „Nagraj" → wykonaj gest N razy z krótkimi przerwami → koniec sam po N-tym
        powtórzeniu (albo „Zakończ" z tym, co się zebrało, albo MANUAL_MAX_S). Każdy ruch, który
        spotter zamknie na żywo, staje się jednym powtórzeniem."""
        R = self.recording
        try:
            t_start = self._stream_now()
            R["t_start"] = t_start
            target = R["takes"]
            self._rec_pub(R, "go", target=target, maxS=MANUAL_MAX_S,
                          msg="Wykonaj gest %d razy, z krótką przerwą między powtórzeniami" % target if target > 1
                          else "Wykonaj gest raz i zatrzymaj kapsel")
            collected = []
            seen = set()
            pending = []                       # (id, t_start, t_end) — czekają na ogon spoczynku
            while not R["stop"] and not R["cancel"]:
                time.sleep(0.05)
                now = self._stream_now()
                if now is None:
                    break
                with self.lock:
                    seg = self.det.last_segment
                    sid = id(seg) if seg is not None else None
                if seg is not None and sid not in seen and seg.t_end >= t_start - 0.2:
                    seen.add(sid)
                    pending.append((sid, seg.t_start, seg.t_end))
                ready = [p for p in pending if now >= p[2] + TAKE_TAIL_S]
                for p in ready:
                    pending.remove(p)
                    take, tseg = self._take_from_window(p[1] - 0.6, p[2] + TAKE_TAIL_S)
                    if take is None:
                        continue
                    collected.append(take)
                    self._rec_pub(R, "take", take=len(collected), target=target, duration=round(tseg.duration, 2),
                                  peak=round(tseg.peak_dps()), forced=tseg.forced)
                if len(collected) >= target:
                    break
                if now - t_start >= MANUAL_MAX_S:
                    break
            if R["cancel"]:
                self._rec_pub(R, "cancel", msg="anulowano")
                return
            now = self._stream_now()
            for p in pending:                  # „Zakończ" tuż po ruchu — dobierz to, co jeszcze czeka
                take, tseg = self._take_from_window(p[1] - 0.6, now)
                if take is not None and len(collected) < target:
                    collected.append(take)
                    self._rec_pub(R, "take", take=len(collected), target=target, duration=round(tseg.duration, 2),
                                  peak=round(tseg.peak_dps()), forced=tseg.forced)
            if not collected:                  # spotter na żywo nic nie zamknął — spróbuj z całego okna
                take, tseg = self._take_from_window(t_start - 0.6, now)
                if take is not None:
                    collected.append(take)
                    self._rec_pub(R, "take", take=1, target=target, duration=round(tseg.duration, 2),
                                  peak=round(tseg.peak_dps()), forced=tseg.forced)
            if not collected:
                self._rec_pub(R, "error", msg="Nie zauważyłem ruchu. Spróbuj jeszcze raz i machnij wyraźniej.")
                return
            self._finish(R, collected, set_threshold=False)
        except Exception as e:
            self._rec_pub(R, "error", msg="błąd: %s" % e)
        finally:
            with self.lock:
                self.recording = None

    def _record_countdown(self):
        """Tryb z odliczaniem 3-2-1 i stałym oknem na gest, kilka powtórzeń (panel zaawansowany)."""
        R = self.recording
        try:
            self._rec_pub(R, "warmup", msg="trzymaj kapsel nieruchomo…")
            time.sleep(1.2)
            takes = []
            attempts = 0
            while len(takes) < R["takes"] and attempts < R["takes"] + 3 and not R["cancel"]:
                attempts += 1
                for c in (3, 2, 1):
                    if R["cancel"]:
                        break
                    self._rec_pub(R, "countdown", take=len(takes) + 1, count=c)
                    time.sleep(0.7)
                if R["cancel"]:
                    break
                t_go = self._stream_now()
                if t_go is None:
                    self._rec_pub(R, "error", msg="brak próbek ze strumienia")
                    return
                self._rec_pub(R, "go", take=len(takes) + 1, msg="TERAZ — wykonaj gest raz")
                time.sleep(R["seconds"] + 0.15)
                samples = self._ring_slice(t_go - 0.8, t_go + R["seconds"])
                if len(samples) < 20:
                    self._rec_pub(R, "retry", take=len(takes) + 1, msg="za mało próbek — czy kapsel wysyła dane?")
                    continue
                t0 = samples[0][0]
                rel = [(round(ts - t0, 4), s) for ts, s in samples]
                seg, sp = segment_take(rel, self.params, self.cal)
                if seg is None:
                    self._rec_pub(R, "retry", take=len(takes) + 1, msg="nie wykryłem ruchu (szczyt poniżej progu startu) — powtórz")
                    continue
                takes.append({"samples": [[ts, *s] for ts, s in rel],
                              "gesture": [round(seg.t_start, 3), round(seg.t_end, 3)]})
                self._rec_pub(R, "take", take=len(takes), duration=round(seg.duration, 2), peak=round(seg.peak_dps()),
                              forced=seg.forced, gLsb=round(sp.g_est()))
            if not takes:
                self._rec_pub(R, "cancel" if R["cancel"] else "error", msg="brak udanych nagrań")
                return
            self._finish(R, takes, set_threshold=True)
        except Exception as e:
            self._rec_pub(R, "error", msg="błąd: %s" % e)
        finally:
            with self.lock:
                self.recording = None

    def _finish(self, R, takes, set_threshold):
        """Zapis wzorca (nowego albo dopisanie nagrań do istniejącego), spójność, kolizje."""
        with self.lock:
            old = self._template(R["name"])
            params_snapshot = dict(self.params)
            others = [t for t in self.templates if t["name"] != R["name"]]
        if R.get("append") and old is not None:
            all_takes = list(old["takes"]) + takes
            tpl = dict(old)
            tpl["takes"] = all_takes
            tpl["updated"] = datetime.now().isoformat(timespec="seconds")
        else:
            all_takes = takes
            tpl = {"name": R["name"], "created": datetime.now().isoformat(timespec="seconds"),
                   "dev": self.active_dev or self.dev,
                   "cal": self.cal, "gLsb": None,
                   "params": {k: params_snapshot[k] for k in ("channels", "band", "resampleN")},
                   "threshold": None, "testKey": (old or {}).get("testKey", ""), "takes": all_takes}
        rec = build_recognizer([tpl], params_snapshot, thresholds=False)
        sims = rec.consistency(R["name"])
        thr = rec.suggest_threshold(R["name"]) if sims else None
        tpl["consistency"] = round(min(sims), 1) if sims else None
        if set_threshold:
            tpl["threshold"] = round(thr, 1) if thr is not None else None
        collisions = []
        if others:
            rec_all = build_recognizer(others, params_snapshot, thresholds=False)
            worst = {}
            for take in takes:
                seg, _ = segment_take(take_samples(take), params_snapshot, self.cal)
                if seg is None:
                    continue
                for r in rec_all.classify(seg):
                    worst[r["name"]] = max(worst.get(r["name"], 0.0), r["sim"])
            collisions = [{"name": n, "sim": round(s, 1), "warn": s >= 80}
                          for n, s in sorted(worst.items(), key=lambda kv: -kv[1])[:3]]
        self._write_template(tpl)
        self.reload_templates()
        self._rec_pub(R, "done", count=len(all_takes), added=len(takes), consistency=[round(s, 1) for s in sims],
                      suggested=round(thr, 1) if thr is not None else None, threshold=tpl.get("threshold"),
                      collisions=collisions, cancelled=bool(R["cancel"]))
        self.publish({"t": "gest", "gestures": self.gestures()})

    # ------------------------------------------------------------------ migawka stanu
    def state(self):
        with self.lock:
            rec = self.recording
            return {"app": dict(self.status), "params": dict(self.params), "defaults": dict(DEFAULT_PARAMS),
                    "accuracy": self.accuracy, "gestures": self.gestures(),
                    "recording": ({"name": rec["name"], "mode": rec["mode"]} if rec else None),
                    "stats": dict(self.stats), "templatesDir": TEMPLATES_DIR}


# ----------------------------------------------------------------------------
#  HTTP
# ----------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    lab: Lab = None
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(n) if n else b""
            return json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            return {}

    def do_GET(self):
        path, _, qs = self.path.partition("?")
        q = parse_qs(qs)
        lab = self.lab
        if path in ("/", "/index.html"):
            try:
                with open(HTML_PATH, "rb") as f:
                    body = f.read()
            except OSError:
                return self._json({"error": "brak lab.html"}, 500)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        elif path == "/api/state":
            self._json(lab.state())
        elif path == "/api/devices":
            self._json(lab.devices((q.get("url") or [None])[0]))
        elif path == "/api/check":
            self._json(lab.check())
        elif path == "/api/curves":
            name = (q.get("name") or [""])[0]
            try:
                take = int((q.get("take") or ["0"])[0])
            except ValueError:
                take = 0
            self._json(lab.template_curves(name, take))
        elif path == "/api/events":
            self._sse()
        else:
            self._json({"error": "not found"}, 404)

    def do_POST(self):
        path = self.path.partition("?")[0]
        data = self._body()
        lab = self.lab
        if path == "/api/connect":
            self._json({"ok": True, "app": lab.connect(data.get("url"), data.get("dev"))})
        elif path == "/api/params":
            self._json({"ok": True, "params": lab.set_params(data)})
        elif path == "/api/params/reset":
            self._json({"ok": True, "params": lab.reset_params(), "accuracy": lab.accuracy})
        elif path == "/api/accuracy":
            self._json(lab.set_accuracy(data.get("value", 50)))
        elif path == "/api/record":
            self._json(lab.start_record(data.get("name"), data.get("mode", "manual"), data.get("takes", 3),
                                        data.get("seconds", 4), data.get("append", False)))
        elif path == "/api/record/stop":
            self._json(lab.stop_record())
        elif path == "/api/record/cancel":
            self._json(lab.cancel_record())
        elif path == "/api/gesture/update":
            self._json(lab.update_gesture(data.get("name"), data.get("threshold", "keep"), data.get("testKey", "keep"),
                                          data.get("newName")))
        elif path == "/api/gesture/delete":
            self._json(lab.delete_gesture(data.get("name")))
        elif path == "/api/testkey":
            spec = str(data.get("spec") or "").strip()[:40]
            if not spec:
                return self._json({"ok": False, "error": "pusty klawisz"})
            threading.Thread(target=lab._send_key, args=(spec,), daemon=True).start()
            self._json({"ok": True})
        else:
            self._json({"error": "not found"}, 404)

    def _sse(self):
        lab = self.lab
        q = lab.subscribe()
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self.end_headers()
            self._send_event({"t": "hello", **lab.state()})
            while True:
                try:
                    ev = q.get(timeout=10.0)
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    continue
                self._send_event(ev)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass
        finally:
            lab.unsubscribe(q)

    def _send_event(self, ev):
        self.wfile.write(("data: " + json.dumps(ev, ensure_ascii=False) + "\n\n").encode("utf-8"))
        self.wfile.flush()


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=None, help="adres RibbitFlipa (domyślnie ostatni użyty albo http://127.0.0.1:8770)")
    ap.add_argument("--dev", default=None, help="kapsel (d0…d4); domyślnie auto = ten, który wysyła")
    ap.add_argument("--port", type=int, default=8790, help="port laboratorium (domyślnie 8790)")
    ap.add_argument("--no-open", action="store_true", help="nie otwieraj przeglądarki")
    args = ap.parse_args(argv)
    lab = Lab(args.url, args.dev)
    Handler.lab = lab
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    srv.daemon_threads = True
    url = "http://127.0.0.1:%d/" % args.port
    print("Laboratorium gestów: %s   (aplikacja: %s, kapsel %s)   Ctrl+C kończy." % (url, lab.url, lab.dev))
    if not args.no_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
