#!/usr/bin/env python3
"""
Benchmark prototypu „nagraj gest → powtórz → wyzwalacz" na ruchu SYNTETYCZNYM.
Uruchom:  py tools/gesture_proto/evaluate.py                   (pełny, ~1 min)
          py tools/gesture_proto/evaluate.py --quick           (mniej powtórzeń, ~20 s)
          py tools/gesture_proto/evaluate.py --with-amplitude  (wariant: amplituda w podobieństwie)

Nie dotyka aplikacji ani Settings/. Kończy się kodem 1, gdy któreś kryterium PASS/FAIL nie
przejdzie — tak jak pozostałe testy w repo.

Co sprawdza:
  A. skuteczność rozpoznawania 7 gestów przy trzech poziomach niedokładności powtórzenia,
     dla 1 i 3 nagrań wzorca i dla trzech wyborów osi (gyro / both / magnitude);
  B. fałszywe odpalenia na „ruchu codziennym" (pochylanie jak myszą, podnoszenie, machanie);
  C. jak pokrętła Podobieństwo / Intensywność / Tempo przesuwają skuteczność i fałszywe odpalenia;
  D. praca na CIĄGŁYM strumieniu (segmentacja + cooldown): trafienia, pominięcia, fałszywe
     alarmy, opóźnienie od końca gestu do decyzji;
  E. koszt obliczeń w czystym Pythonie (czy zmieści się w wątku danych 50 Hz).
"""
from __future__ import annotations

import os
import random
import statistics
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gesture_dtw import Detector, Recognizer, merged_params, segment_take  # noqa: E402
from synth import GESTURES, LEVELS, NEGATIVES, PuckSim, make_take, perform  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

GEST = list(GESTURES.keys())
NEG = ["rest"] + list(NEGATIVES.keys())
QUICK = "--quick" in sys.argv
if "--with-amplitude" in sys.argv:        # wariant domyślnych: amplituda wchodzi też do podobieństwa
    import gesture_dtw
    gesture_dtw.DEFAULT_PARAMS["shapeOnly"] = False
N_TEST = 12 if QUICK else 30
SEED = 20260903

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


# ----------------------------------------------------------------------------
def build_recognizer(params, k_takes, rng, level=0.4, auto_threshold=True):
    rec = Recognizer(params)
    for name in GEST:
        for t in range(k_takes):
            samples, _ = make_take(name, level, rng)
            seg, _ = segment_take(samples, params)
            if seg is None:
                raise RuntimeError("wzorzec %s/%d: spotter nie wyciął gestu" % (name, t))
            rec.add_segment(name, seg, t)
    if auto_threshold and k_takes > 1:
        for name in GEST:
            thr = rec.suggest_threshold(name)
            if thr is not None:
                rec.thresholds[name] = thr
    return rec


def classify_take(rec, params, samples):
    seg, _ = segment_take(samples, params)
    if seg is None:
        return None
    return rec.classify(seg)


def run_matrix(rec, params, level, n, rng, **kw):
    """Zwraca: per gest (ok, confused, rejected, nosegment), per negatyw (fp, total)."""
    res = {}
    for name in GEST:
        ok = conf = rej = noseg = 0
        for _ in range(n):
            samples, _ = make_take(name, level, rng, **kw)
            c = classify_take(rec, params, samples)
            if c is None:
                noseg += 1
                continue
            acc = [r for r in c if r["accepted"]]
            if not acc:
                rej += 1
            elif acc[0]["name"] == name:
                ok += 1
            else:
                conf += 1
        res[name] = (ok, conf, rej, noseg)
    neg = {}
    for name in NEG:
        fp = 0
        for _ in range(n):
            samples, _ = make_take(name, level, rng)
            c = classify_take(rec, params, samples)
            if c and any(r["accepted"] for r in c):
                fp += 1
        neg[name] = (fp, n)
    return res, neg


def pct(a, b):
    return 100.0 * a / b if b else 0.0


def summarize(res, neg):
    tot = sum(sum(v) for v in res.values())
    ok = sum(v[0] for v in res.values())
    conf = sum(v[1] for v in res.values())
    rej = sum(v[2] for v in res.values())
    noseg = sum(v[3] for v in res.values())
    fp = sum(v[0] for v in neg.values())
    fpn = sum(v[1] for v in neg.values())
    return {"ok": pct(ok, tot), "conf": pct(conf, tot), "rej": pct(rej, tot), "noseg": pct(noseg, tot),
            "fp": pct(fp, fpn), "n": tot, "fpn": fpn}


# ----------------------------------------------------------------------------
def section_a_b():
    print("\n=== A/B. Skuteczność wg osi, liczby nagrań wzorca i niedokładności powtórzenia ===")
    print("(próg: auto z spójności 3 nagrań, dla 1 nagrania stały 70 %; ok = trafiony gest,")
    print(" pomył = inny gest, odrz = nic nie przeszło progu, FP = fałszywe odpalenie na ruchu codziennym)")
    print("%-10s %-3s %-8s %6s %6s %6s %6s" % ("osie", "nag", "poziom", "ok%", "pomył%", "odrz%", "FP%"))
    out = {}
    for channels in ("gyro", "both", "magnitude"):
        for k in (1, 3):
            params = merged_params({"channels": channels})
            rng = random.Random(SEED)
            rec = build_recognizer(params, k, rng)
            for lname, level in LEVELS.items():
                res, neg = run_matrix(rec, params, level, N_TEST, rng)
                s = summarize(res, neg)
                out[(channels, k, lname)] = (s, res, neg)
                print("%-10s %-3d %-8s %6.1f %6.1f %6.1f %6.1f" % (channels, k, lname, s["ok"], s["conf"], s["rej"], s["fp"]))
    # szczegóły dla rekomendowanego ustawienia
    s, res, neg = out[("gyro", 3, "srednia")]
    print("\nSzczegóły: osie=gyro, 3 nagrania, poziom średni — per gest (ok/pomył/odrz/brak segm.)")
    for name, v in res.items():
        print("  %-12s %3d %3d %3d %3d" % (name, *v))
    print("  negatywy (FP/n):", ", ".join("%s %d/%d" % (k, v[0], v[1]) for k, v in neg.items()))
    s_mag = out[("magnitude", 3, "srednia")]
    print("\nUwaga: tryb magnitude z definicji nie odróżnia gestów lustrzanych —")
    print("  flick_right/flick_left: %s" % {k: v for k, v in s_mag[1].items() if k.startswith("flick")})
    print("Informacyjnie, poziom duży: gyro %.1f %% vs both %.1f %% — akcelerometr w syntetyku nie pomaga,"
          % (out[("gyro", 3, "duza")][0]["ok"], out[("both", 3, "duza")][0]["ok"]))
    print("  bo ten sam obrót daje inną zmianę grawitacji z innego przechyłu startowego (patrz D).")

    check("A. gyro/3 nagrania/poziom mały: rozpoznanie >= 95 %", out[("gyro", 3, "mala")][0]["ok"] >= 95.0,
          "%.1f %%" % out[("gyro", 3, "mala")][0]["ok"])
    check("A. gyro/3 nagrania/poziom średni: rozpoznanie >= 90 %", s["ok"] >= 90.0, "%.1f %%" % s["ok"])
    check("A. gyro/3 nagrania/poziom średni: pomyłki między gestami <= 3 %", s["conf"] <= 3.0, "%.1f %%" % s["conf"])
    check("B. gyro/3 nagrania/poziom średni: fałszywe odpalenia na ruchu codziennym <= 3 %", s["fp"] <= 3.0,
          "%.1f %%" % s["fp"])
    check("A. 1 nagranie (stały próg 70 %) na poziomie średnim: rozpoznanie >= 85 %",
          out[("gyro", 1, "srednia")][0]["ok"] >= 85.0, "%.1f %%" % out[("gyro", 1, "srednia")][0]["ok"])
    return out


def section_c():
    print("\n=== C. Pokrętła użytkownika (osie=gyro, 3 nagrania, poziom średni) ===")
    base = merged_params({"channels": "gyro"})
    rng = random.Random(SEED + 1)
    rec = build_recognizer(base, 3, rng, auto_threshold=False)

    print("\nC1. Podobieństwo (próg %): skuteczność vs fałszywe odpalenia")
    print("%6s %6s %6s %6s" % ("próg", "ok%", "pomył%", "FP%"))
    sweep = {}
    for thr in (50, 60, 70, 80, 90):
        rec.set_params({"threshold": float(thr)})
        res, neg = run_matrix(rec, rec.p, 0.6, N_TEST, random.Random(SEED + 2))
        s = summarize(res, neg)
        sweep[thr] = s
        print("%6d %6.1f %6.1f %6.1f" % (thr, s["ok"], s["conf"], s["fp"]))
    check("C1. próg 70 %: rozpoznanie >= 90 % i FP <= 3 %", sweep[70]["ok"] >= 90.0 and sweep[70]["fp"] <= 3.0,
          "ok %.1f FP %.1f" % (sweep[70]["ok"], sweep[70]["fp"]))
    check("C1. wyższy próg = mniej odpaleń (monotonicznie)",
          all(sweep[a]["ok"] >= sweep[b]["ok"] - 0.5 for a, b in ((50, 60), (60, 70), (70, 80), (80, 90))))

    print("\nC2. Intensywność: gest wykonany 0.5× / 1× / 2× mocniej niż nagranie; próg 70 %")
    print("     (wzorce nagrane DELIKATNIE, szczyt ~100 °/s, żeby 2× nie uderzało w sufit czujnika 250 °/s;")
    print("      tolerancja 1.5 = od 0.67× do 1.5×; 2.0 = od 0.5× do 2×; 0 = bez limitu)")
    print("%-10s %8s %8s %8s" % ("tolerancja", "0.5×", "1×", "2×"))
    inten = {}
    rec_soft = Recognizer(base)
    rng_soft = random.Random(SEED + 9)
    skipped = []
    for name in GEST:
        for t in range(3):
            samples, _ = make_take(name, 0.4, rng_soft, amp=0.5)
            seg, _ = segment_take(samples, base)
            if seg is None:          # za delikatny gest nie przekracza progu startu — to też wynik
                skipped.append(name)
                break
            rec_soft.add_segment(name, seg, t)
    if skipped:
        print("     (pominięte: %s — przy połowie siły nie przekraczają progu startu segmentacji)" % ", ".join(sorted(set(skipped))))
    for tol, shape in ((1.5, False), (2.0, False), (0, False), (0, True)):
        rec_soft.set_params({"threshold": 70.0, "intensityTol": tol, "shapeOnly": shape})
        row = []
        for amp in (0.25, 0.5, 1.0):
            res, _ = run_matrix_pos_only(rec_soft, rec_soft.p, 0.3, N_TEST // 2, random.Random(SEED + 3), amp=amp)
            s = summarize(res, {})
            row.append(s["ok"])
        inten[(tol, shape)] = row
        print("%-10s %7.1f%% %7.1f%% %7.1f%%%s" % (str(tol), *row, "   (sam kształt)" if shape else ""))
    # 1× przy tolerancji 1.5 i DELIKATNYCH wzorcach: ±12 % odchyłki amplitudy plus szum czujnika
    # względnie większy niż przy mocnym geście — 85 % to uczciwa poprzeczka dla najściślejszej bramki.
    check("C2. tolerancja 1.5 odrzuca wykonanie 0.5× i 2× (>= 80 % odrzuceń), przepuszcza 1× (>= 85 %)",
          inten[(1.5, False)][0] <= 20.0 and inten[(1.5, False)][2] <= 20.0 and inten[(1.5, False)][1] >= 85.0,
          str(inten[(1.5, False)]))
    check("C2. sam kształt + bez limitu intensywności: 0.5× i 2× przechodzą (>= 80 %)",
          inten[(0, True)][0] >= 80.0 and inten[(0, True)][2] >= 80.0, str(inten[(0, True)]))
    print("     → z amplitudą (domyślnie) samo podobieństwo też karze inną siłę gestu; „sam kształt” ją ignoruje,")
    print("       a o sile decyduje wtedy wyłącznie bramka intensywności.")

    print("\nC3. Tempo: gest wykonany 0.5× / 1× / 2× szybciej; próg 70 %, tolerancja czasu 1.8 vs 0")
    print("%-10s %8s %8s %8s" % ("tol.czasu", "0.5×", "1×", "2×"))
    tempo = {}
    for tol in (1.8, 0):
        rec.set_params({"threshold": 70.0, "intensityTol": 0, "durationTol": tol})
        row = []
        for spd in (0.5, 1.0, 2.0):
            res, _ = run_matrix_pos_only(rec, rec.p, 0.3, N_TEST // 2, random.Random(SEED + 4), speed=spd)
            row.append(summarize(res, {})["ok"])
        tempo[tol] = row
        print("%-10s %7.1f%% %7.1f%% %7.1f%%" % (str(tol), *row))
    check("C3. przepróbkowanie w czasie: bez limitu czasu gest 2× szybszy nadal rozpoznany (>= 80 %)",
          tempo[0][2] >= 80.0, str(tempo[0]))
    check("C3. tolerancja czasu 1.8 odrzuca gest 2× wolniejszy (<= 30 % przyjęć)", tempo[1.8][0] <= 30.0,
          str(tempo[1.8]))

    print("\nC4. Pasmo DTW (tolerancja tempa wewnątrz gestu), poziom duży, próg 70 %")
    print("%-6s %6s %6s %6s" % ("pasmo", "ok%", "pomył%", "FP%"))
    for band in (0.05, 0.15, 0.25, 0.4):
        rec.set_params({"threshold": 70.0, "intensityTol": 2.0, "durationTol": 1.8, "band": band})
        res, neg = run_matrix(rec, rec.p, 1.0, N_TEST // 2, random.Random(SEED + 5))
        s = summarize(res, neg)
        print("%-6s %6.1f %6.1f %6.1f" % (band, s["ok"], s["conf"], s["fp"]))
    rec.set_params({"band": 0.25})

    print("\nC5. Tylko kształt (shapeOnly) vs z amplitudą, poziom duży, próg 70 %")
    for so in (False, True):
        rec.set_params({"shapeOnly": so, "intensityTol": 2.0})
        res, neg = run_matrix(rec, rec.p, 1.0, N_TEST // 2, random.Random(SEED + 6))
        s = summarize(res, neg)
        print("  shapeOnly=%-5s ok %.1f %%  pomył %.1f %%  FP %.1f %%" % (so, s["ok"], s["conf"], s["fp"]))
    rec.set_params({"shapeOnly": False})


def run_matrix_pos_only(rec, params, level, n, rng, **kw):
    res = {}
    for name in GEST:
        if not any(t.name == name for t in rec.templates):
            continue
        ok = conf = rej = noseg = 0
        for _ in range(n):
            samples, _ = make_take(name, level, rng, **kw)
            c = classify_take(rec, params, samples)
            if c is None:
                noseg += 1
                continue
            acc = [r for r in c if r["accepted"]]
            if not acc:
                rej += 1
            elif acc[0]["name"] == name:
                ok += 1
            else:
                conf += 1
        res[name] = (ok, conf, rej, noseg)
    return res, {}


# ----------------------------------------------------------------------------
def stream_run(channels, rng_seed, n_events):
    params = merged_params({"channels": channels})
    rng = random.Random(rng_seed)
    rec = build_recognizer(params, 3, rng)
    sim = PuckSim(rng)
    det = Detector(rec, params)
    truth = []
    sim.rest(1.5)
    negs = list(NEGATIVES.keys())
    for _ in range(n_events):
        if rng.random() < 0.6:
            name, is_g = rng.choice(GEST), True
        else:
            name, is_g = rng.choice(negs), False
        t0, t1 = perform(sim, name, 0.6, rng)
        truth.append([name, t0, t1, is_g, None])
        sim.rest(rng.uniform(0.5, 1.5))
    sim.rest(1.0)
    events = []
    t_cpu = time.perf_counter()
    for ts, s in sim.samples:
        ev = det.push(ts, s)
        if ev is not None:
            events.append(ev)
    t_cpu = time.perf_counter() - t_cpu
    return sim, det, truth, events, t_cpu


def section_d():
    print("\n=== D. Ciągły strumień: segmentacja + rozpoznawanie + cooldown ===")
    n_events = 30 if QUICK else 80
    print("  osie both (żyro + akcelerometr) dla porównania: ", end="")
    sim_b, det_b, truth_b, events_b, _ = stream_run("both", SEED + 7, n_events)
    hits_b = 0
    for ev in events_b:
        for tr in truth_b:
            if tr[3] and tr[4] is None and tr[0] == ev["name"] and tr[1] - 0.2 <= ev["t_start"] <= tr[2] + 0.3:
                tr[4] = ev
                hits_b += 1
                break
    n_gb = sum(1 for t in truth_b if t[3])
    print("trafienia %d/%d (ten sam strumień, te same wzorce)" % (hits_b, n_gb))
    sim, det, truth, events, t_cpu = stream_run("gyro", SEED + 7, n_events)
    stream_s = sim.samples[-1][0]
    # dopasowanie zdarzeń do prawdy
    hits = wrong = false_alarm = 0
    lat = []
    for ev in events:
        m = None
        for tr in truth:
            if tr[1] - 0.2 <= ev["t_start"] <= tr[2] + 0.3:
                m = tr
                break
        if m is None:
            false_alarm += 1
        elif m[3] and m[0] == ev["name"] and m[4] is None:
            m[4] = ev
            hits += 1
            lat.append((ev["ts"] - m[2]) * 1000.0)
        else:
            wrong += 1
    n_g = sum(1 for t in truth if t[3])
    n_n = len(truth) - n_g
    misses = sum(1 for t in truth if t[3] and t[4] is None)
    print("  osie gyro (domyślne): strumień %.0f s @50 Hz, gestów %d, ruchów codziennych %d" % (stream_s, n_g, n_n))
    print("  trafienia %d/%d, pominięcia %d, zły gest %d, fałszywe alarmy %d" % (hits, n_g, misses, wrong, false_alarm))
    if lat:
        print("  opóźnienie decyzji od końca gestu: mediana %.0f ms, max %.0f ms" % (statistics.median(lat), max(lat)))
    print("  segmentów wyciętych: %d; CPU całego strumienia %.0f ms (%.2f %% czasu rzeczywistego)"
          % (det.spotter.segments, t_cpu * 1000.0, 100.0 * t_cpu / stream_s))
    check("D. strumień: trafienia >= 90 %", pct(hits, n_g) >= 90.0, "%d/%d" % (hits, n_g))
    check("D. strumień: fałszywe alarmy + zły gest <= 1 na minutę",
          (false_alarm + wrong) <= max(1.0, stream_s / 60.0), "%d w %.0f s" % (false_alarm + wrong, stream_s))
    check("D. strumień: CPU < 10 % czasu rzeczywistego (czysty Python)", t_cpu / stream_s < 0.10,
          "%.1f %%" % (100.0 * t_cpu / stream_s))
    if lat:
        check("D. opóźnienie decyzji: mediana <= 250 ms (endHoldMs 150 + zamknięcie)", statistics.median(lat) <= 250.0,
              "%.0f ms" % statistics.median(lat))


def section_e():
    print("\n=== E. Koszt obliczeń (czysty Python, bez numpy) ===")
    params = merged_params({"channels": "both"})     # 6 wymiarów = najdroższy wariant
    rng = random.Random(SEED + 8)
    rec = build_recognizer(params, 3, rng)
    samples, _ = make_take("circle", 0.6, rng)
    seg, _ = segment_take(samples, params)
    reps = 20
    t = time.perf_counter()
    for _ in range(reps):
        rec.classify(seg)
    per = (time.perf_counter() - t) / reps * 1000.0
    print("  classify() z %d wzorcami (7 gestów × 3 nagrania): %.1f ms na segment" % (len(rec.templates), per))
    print("  → %.2f ms na jeden wzorzec; wykonywane RAZ na gest, nie na próbkę" % (per / len(rec.templates)))
    det = Detector(rec, params)
    t = time.perf_counter()
    for ts, s in samples:
        det.spotter.push(ts, s)
    per_s = (time.perf_counter() - t) / len(samples) * 1e6
    print("  spotter.push() na próbkę: %.0f µs (przy 50 Hz budżet to 20 000 µs)" % per_s)
    check("E. classify <= 60 ms dla 21 wzorców", per <= 60.0, "%.1f ms" % per)
    check("E. spotter.push <= 200 µs na próbkę", per_s <= 200.0, "%.0f µs" % per_s)


def main():
    print("RibbitFlip — prototyp gestów nagrywanych: benchmark syntetyczny (%s%s)" % (
        "szybki" if QUICK else "pełny", ", podobieństwo z amplitudą" if "--with-amplitude" in sys.argv else ", sam kształt"))
    t0 = time.perf_counter()
    section_a_b()
    section_c()
    section_d()
    section_e()
    print("\n%d PASS, %d FAIL (%.0f s)" % (_passed, _failed, time.perf_counter() - t0))
    sys.exit(1 if _failed else 0)


if __name__ == "__main__":
    main()
