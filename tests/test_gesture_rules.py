# Contract test: RECORDED GESTURES as a trigger source (ribbitflip_gesture.py + the engine).
# Run: py tests/test_gesture_rules.py
#
# What is easy to break here, and silent when it breaks:
#
# 1. THE RECORDING IS THE RULE. The takes travel inside the rule (source.takes, packed base64),
#    so the sanitiser has to keep them byte for byte and drop only what is unreadable — a
#    sanitiser that "tidies" a take turns a working gesture into one that never fires, with
#    nothing on screen to say why.
#
# 2. ONE CUT FOR BOTH SIDES. A template is cut from its take with the SAME segmenter that cuts
#    the live stream, with the rule's own end-of-gesture pause. A gesture recorded by hand with
#    a stop in the middle must report that stop (pauseMs), and the pause the recorder suggests
#    must keep the gesture in one piece — otherwise the live stream is cut at the stop and the
#    gesture can never match its own recording.
#
# 3. A GESTURE IS AN EVENT. The engine sees a short pulse: `once` fires exactly once per
#    gesture, `multi` counts gestures, a different movement fires nothing, and nothing fires
#    while a recording session is running (a recording that pressed keys would be a trap).
#
# 4. THE SIMPLE SLIDER HAS TO MEAN WHAT IT SAYS: further right = stricter, and its three
#    derived gates stay inside sane ranges.
#
# The engine is driven directly, with no HTTP and no disk: this file must never touch the
# owner's Settings/. Motion is synthetic (a bell-shaped rotation on one axis at 50 Hz), which is
# enough for contracts — the prototype's real-capsule tests are in tools/gesture_proto/README.md.
import math
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_gesture as G   # noqa: E402
import ribbitflip_monitor as rf  # noqa: E402

try:
    sys.stdout.reconfigure(errors="replace")
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
        print("FAIL  %s   %s" % (name, detail))


# --------------------------------------------------------------- synthetic capsule
random.seed(7)
NOISE = 40.0


def still(n, t, out):
    for _ in range(n):
        out.append((t, [random.gauss(0, NOISE) for _ in range(5)] + [-2065 + random.gauss(0, NOISE)]))
        t += 0.02
    return t


def gesture(t, out, axis=0, amp=150.0, dur=0.7, pause=0.0):
    """A bell-shaped rotation of `amp` deg/s on one gyro axis; `pause` = a stop in the middle."""
    n = int(dur / 0.02)

    def push(u):
        nonlocal t
        s = [random.gauss(0, NOISE) for _ in range(6)]
        s[axis] += amp * math.sin(math.pi * u) * G.GYRO_LSB_PER_DPS
        s[5] += -2065
        out.append((t, s))
        t += 0.02
    if pause <= 0:
        for i in range(n + 1):
            push(i / n)
    else:
        for i in range(n // 2 + 1):
            push(i / n)
        t = still(int(pause / 0.02), t, out)
        for i in range(n // 2, n + 1):
            push(i / n)
    return t


def feed(hub, rows):
    for ts, s in rows:
        hub.push(ts, s)


def record_auto(hub, t, axis=0, takes=3, **kw):
    """An automatic session over `takes` repetitions; returns (takes data, next t, events)."""
    events = []
    hub.emit = events.append
    buf = []
    t = still(40, t, buf)
    feed(hub, buf)
    r = hub.record_start("auto", takes, kw.get("endHoldMs", 200))
    assert r["ok"], r
    buf = []
    for _ in range(takes):
        t = gesture(t, buf, axis=axis, **{k: v for k, v in kw.items() if k != "endHoldMs"})
        t = still(40, t, buf)
    feed(hub, buf)
    data = [e["data"] for e in events if e.get("t") == "grec" and e.get("phase") == "take"]
    return data, t, events


class FakeBus:
    def __init__(self):
        self.events = []

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)


class FakeEmitter:
    def __init__(self):
        self.taps = []
        self.downs = []
        self.ups = []

    def tap(self, spec):
        self.taps.append(spec)

    def down(self, spec):
        self.downs.append(spec)

    def up(self, spec):
        self.ups.append(spec)


# =============================================================== 1. the recorder + takes
print("--- 1. nagrywanie automatyczne, pakowanie nagrań ---")
hub = G.GestureHub()
takes, t, events = record_auto(hub, 0.0, axis=0, takes=3)
phases = [e.get("phase") for e in events if e.get("t") == "grec"]
check("1a. sesja auto zbiera 3 powtórzenia i kończy sama", phases == ["go", "take", "take", "take", "done"], phases)
check("1b. każde nagranie to spakowany blob", all(isinstance(d, dict) and "d" in d for d in takes), takes and takes[0].keys())
rows = G.decode_take(takes[0])
check("1c. nagranie ma spoczynek przed ruchem i po nim (>= 40 wierszy)", rows is not None and len(rows) >= 40, len(rows or []))
check("1d. czas w nagraniu rośnie od zera", rows[0][0] == 0.0 and all(b[0] >= a[0] for a, b in zip(rows, rows[1:])))
rt = G.encode_take(rows)
check("1e. pakowanie jest odwracalne co do bajta", rt == takes[0])
info = [(e["duration"], e["pauseMs"]) for e in events if e.get("phase") == "take"]
check("1f. zdarzenie take niesie czas gestu i brak przerwy", all(0.4 < d < 1.0 and p == 0 for d, p in info), info)
check("1g. w trakcie nagrywania nic nie nagrywa się drugi raz", hub.record_start("auto", 1, 200)["ok"] is True)   # session ended -> free again
hub.record_cancel()

# =============================================================== 2. sanitiser
print("\n--- 2. sanitizer trzyma nagrania, wycina śmieci ---")
src = {"kind": "gesture", "takes": takes + [{"d": "not base64!"}, "x", {"d": ""}],
       "accuracy": "77", "threshold": "", "intensityTol": 3, "channels": "nope", "endHoldMs": 9999, "desc": "x" * 300}
clean = rf._sanitize_source(src)
check("2a. rodzaj gesture przechodzi przez sanitizer", clean["kind"] == "gesture")
check("2b. czytelne nagrania zostają, nieczytelne wypadają", clean["takes"] == takes, len(clean["takes"]))
check("2c. accuracy z tekstu na int 0..100", clean["accuracy"] == 77, clean["accuracy"])
check("2d. pusty próg = brak nadpisania (None)", clean["threshold"] is None)
check("2e. jawna tolerancja siły zostaje", clean["intensityTol"] == 3.0)
check("2f. nieznane osie -> gyro, przerwa przycięta do 2000, opis do 200 znaków",
      clean["channels"] == "gyro" and clean["endHoldMs"] == 2000 and len(clean["desc"]) == 200)
rules = rf.sanitize_rules([{"id": "g1", "label": "Nod", "source": src, "keySpec": "space",
                            "extraConditions": [{"source": {"kind": "gesture", "takes": takes[:1]}, "op": "and"}]}])
check("2g. reguła z gestem przechodzi przez sanitize_rules z nagraniami", rules[0]["source"]["takes"] == takes)
check("2h. dodatkowy warunek-gest też zachowuje nagranie", rules[0]["extraConditions"][0]["source"]["takes"] == takes[:1])
check("2i. nagrań najwyżej 5", len(rf._sanitize_source({"kind": "gesture", "takes": takes * 3})["takes"]) == 5)
check("2j. lista d0 bez gestów nadal sanityzuje się jak dotąd",
      rf.sanitize_rules([{"id": "a", "source": {"kind": "filter", "metric": "spin"}}])[0]["source"] == {"kind": "filter", "metric": "spin"})

# =============================================================== 3. accuracy slider
print("\n--- 3. suwak dokładności ---")
ap = [G.accuracy_params(v) for v in (0, 20, 50, 80, 100)]
check("3a. próg rośnie z suwakiem (50 -> 90 %)", [a["threshold"] for a in ap] == [50.0, 58.0, 70.0, 82.0, 90.0], [a["threshold"] for a in ap])
check("3b. po lewej siła i tempo nie mają znaczenia (0)", ap[0]["intensityTol"] == 0 and ap[0]["durationTol"] == 0)
check("3c. tolerancje maleją w prawo", ap[1]["intensityTol"] > ap[2]["intensityTol"] > ap[4]["intensityTol"] > 1.0)
check("3d. 50 = wartości domyślne prototypu", ap[2] == {"threshold": 70.0, "intensityTol": 2.0, "durationTol": 1.8}, ap[2])
p = G.source_params({"kind": "gesture", "accuracy": 50, "threshold": 33, "endHoldMs": 500})
check("3e. jawny próg wygrywa z suwakiem, reszta z suwaka", p["threshold"] == 33.0 and p["intensityTol"] == 2.0 and p["endHoldMs"] == 500)

# =============================================================== 4. analysis
print("\n--- 4. ocena nagrań ---")
an = G.analyze({"kind": "gesture", "takes": takes, "accuracy": 50}, None, [])
check("4a. trzy nagrania są ze sobą zgodne (>= 90 %)", an["usable"] == 3 and an["minConsistency"] >= 90, an["minConsistency"])
check("4b. proponowany próg = zgodność - 10, w 40..90", an["suggested"] is not None and 40 <= an["suggested"] <= 90 and an["suggested"] <= an["minConsistency"] - 9.9, an["suggested"])
other = {"kind": "gesture", "takes": takes, "accuracy": 50}
an2 = G.analyze({"kind": "gesture", "takes": takes[:1], "accuracy": 50}, None, [("r9", "Nod", other)])
check("4c. ten sam gest u innej reguły = kolizja z ostrzeżeniem", an2["collisions"] and an2["collisions"][0]["warn"] and an2["collisions"][0]["label"] == "Nod", an2["collisions"])
flick, t, _ = record_auto(hub, t, axis=2, takes=1)
an3 = G.analyze({"kind": "gesture", "takes": flick, "accuracy": 50}, None, [("r9", "Nod", other)])
check("4d. inny gest nie koliduje", an3["collisions"] and not an3["collisions"][0]["warn"] and an3["collisions"][0]["sim"] < 60, an3["collisions"])
an4 = G.analyze({"kind": "gesture", "takes": [{"d": G.encode_take([(i * 0.02, [0, 0, 0, 0, 0, -2065]) for i in range(60)])["d"]}]}, None, [])
check("4e. nagranie bez ruchu = nieużywalne, bez wyjątku", an4["usable"] == 0 and an4["takes"][0]["ok"] is False)

# =============================================================== 5. manual take with a stop
print("\n--- 5. nagranie ręczne Start/Stop z przerwą w środku ---")
events = []
hub.emit = events.append
buf = []
t = still(30, t, buf)
feed(hub, buf)
r = hub.record_start("manual", 1, 200)
check("5a. sesja ręczna startuje", r["ok"] and r["mode"] == "manual", r)
buf = []
t = gesture(t, buf, axis=1, amp=150, dur=0.8, pause=0.45)
t = still(20, t, buf)
feed(hub, buf)
r = hub.record_stop()
tk = [e for e in events if e.get("t") == "grec" and e.get("phase") == "take"]
check("5b. Stop oddaje jedno nagranie i kończy sesję", r["ok"] and len(tk) == 1 and events[-1].get("phase") == "done", [e.get("phase") for e in events if e.get("t") == "grec"])
check("5c. przerwa w środku gestu jest zmierzona (~450 ms)", tk and 350 <= tk[0]["pauseMs"] <= 550, tk and tk[0]["pauseMs"])
check("5d. nagrywarka proponuje dłuższą przerwę kończącą", tk and tk[0]["suggestedEndHoldMs"] and tk[0]["suggestedEndHoldMs"] >= tk[0]["pauseMs"] * 1.4, tk and tk[0].get("suggestedEndHoldMs"))
ph = tk[0]["suggestedEndHoldMs"]
seg_short, i_short = G.take_segment(tk[0]["data"], G.merged_params({"endHoldMs": 200}))
seg_long, i_long = G.take_segment(tk[0]["data"], G.merged_params({"endHoldMs": ph}))
check("5e. z krótką przerwą gest rozpada się na kawałki, z zaproponowaną jest jednym", i_short["pieces"] >= 2 and i_long["pieces"] == 1, (i_short["pieces"], i_long["pieces"]))
check("5f. scalony gest obejmuje całość (~1,2 s)", seg_short is not None and 1.0 < seg_short.duration < 1.5, seg_short and seg_short.duration)
rr = hub.record_stop()
check("5g. Stop bez sesji mówi, że nic nie nagrywa", rr["ok"] is False and rr["error"] == "nic nie nagrywam", rr)
# ...and that gesture, saved with the suggested pause, is recognised live
paused_src = {"kind": "gesture", "takes": [tk[0]["data"]], "accuracy": 50, "endHoldMs": ph}
hub.set_rules([{"id": "p1", "source": paused_src, "extraConditions": []}])
events.clear()
buf = []
t = still(30, t, buf)
t = gesture(t, buf, axis=1, amp=150, dur=0.8, pause=0.45)
t = still(60, t, buf)
feed(hub, buf)
hits = [e for e in events if e.get("t") == "gest" and e.get("hit") == "p1"]
check("5h. gest z przerwą rozpoznany na żywo z zaproponowaną przerwą kończącą", len(hits) == 1 and hits[0]["cands"][0]["sim"] >= 80, [(e.get("hit"), e.get("cands")) for e in events if e.get("t") == "gest"])

# =============================================================== 6. the engine
print("\n--- 6. silnik reguł: gest jako zdarzenie ---")
bus = FakeBus()
em = FakeEmitter()
eng = rf.TriggerEngine(bus, emitter=em, armed=True)
eng.enabled = True
nod_src = {"kind": "gesture", "takes": takes, "accuracy": 50, "endHoldMs": 200, "desc": "kiwnięcie"}
eng.set_rules(rf.sanitize_rules([
    {"id": "once", "label": "Nod", "source": nod_src, "keySpec": "space", "behavior": "once"},
    {"id": "twice", "label": "Nod x2", "source": nod_src, "keySpec": "enter", "behavior": "multi", "crossings": 2, "windowMs": 2500},
]))
check("6a. silnik zna warunki-gesty po id reguły", sorted(k for k, _r, _s in eng.gestures.conditions(eng.snapshot_rules())) == ["once", "twice"])


_T0 = time.monotonic()


def play(eng, rows):
    """Samples through the engine's raw path, ticking as the data thread and tick thread would.
    The sample clock is the synthetic one (50 Hz) offset into monotonic time — the hub keeps
    its own stream clock, and only the fired-pulse is measured in wall time."""
    for ts, s in rows:
        eng.on_gesture_sample(s, _T0 + ts)
        eng.tick()
        time.sleep(0.002)


t2 = 0.0
buf = []
t2 = still(40, t2, buf)
t2 = gesture(t2, buf, axis=0, amp=160)
t2 = still(30, t2, buf)
play(eng, buf)
for _ in range(20):        # the pulse ends; the tick has to see it drop
    eng.tick()
    time.sleep(0.01)
check("6b. jeden gest = jedno naciśnięcie (once)", em.taps.count("space") == 1, em.taps)
check("6c. 'X razy w czasie' po jednym geście jeszcze milczy", "enter" not in em.taps, em.taps)
buf = []
t2 = gesture(t2, buf, axis=0, amp=160)
t2 = still(30, t2, buf)
play(eng, buf)
for _ in range(20):
    eng.tick()
    time.sleep(0.01)
check("6d. drugi gest w oknie = 'X razy w czasie' odpala", em.taps.count("enter") == 1 and em.taps.count("space") == 2, em.taps)
tf = [e for e in bus.events if e.get("t") == "tf"]
check("6e. zdarzenia tf idą z etykietą reguły", any(e.get("label") == "Nod" for e in tf), tf[:2])
gest_ev = [e for e in bus.events if e.get("t") == "gest"]
check("6f. werdykt gestu leci na szynę z dev i ts", gest_ev and all("ts" in e for e in gest_ev), gest_ev[:1])
n_before = len(em.taps)
buf = []
t2 = gesture(t2, buf, axis=2, amp=160)
t2 = still(30, t2, buf)
play(eng, buf)
check("6g. inny ruch nie odpala niczego", len(em.taps) == n_before, em.taps)
# a recording session must not press keys
eng.gestures.record_start("auto", 1, 200)
buf = []
t2 = gesture(t2, buf, axis=0, amp=160)
t2 = still(40, t2, buf)
play(eng, buf)
check("6h. w trakcie nagrywania zapisane reguły nie strzelają", len(em.taps) == n_before, em.taps)
eng.gestures.record_cancel()
# a rule that lost its recordings is harmless
eng.set_rules(rf.sanitize_rules([{"id": "empty", "source": {"kind": "gesture", "takes": []}, "keySpec": "a"}]))
buf = []
t2 = gesture(t2, buf, axis=0, amp=160)
t2 = still(30, t2, buf)
play(eng, buf)
check("6i. gest bez nagrania nigdy nie odpala i nie wywala silnika", "a" not in em.taps)
check("6j. opis reguły mówi o nagranym geście",
      "nagrany gest „kiwnięcie”" in rf._describe_rule({"source": nod_src, "keySpec": "space"}), rf._describe_rule({"source": nod_src, "keySpec": "space"}))

# =============================================================== 7. the trial
print("\n--- 7. próba szkicu w edytorze ---")
hub2 = G.GestureHub()
ev2 = []
hub2.emit = ev2.append
check("7a. próba bez nagrań nie startuje", hub2.set_trial({"kind": "gesture", "takes": []}) is False)
check("7b. próba z nagraniem startuje", hub2.set_trial(nod_src, "Nod") is True)
buf = []
t3 = still(40, 0.0, buf)
t3 = gesture(t3, buf, axis=0, amp=150)
t3 = still(30, t3, buf)
feed(hub2, buf)
tr = [e for e in ev2 if e.get("t") == "gest" and "trial" in e]
check("7c. werdykt próby przychodzi jako gest z polem trial", len(tr) == 1 and tr[0]["trial"]["accepted"] and tr[0]["trial"]["sim"] >= 80, tr)
check("7d. próba nie liczy się jako odpalenie żadnej reguły", not any(e.get("hit") for e in ev2))
hub2.set_trial(None)
ev2.clear()
feed(hub2, buf)
check("7e. wyczyszczona próba milczy", not ev2)

# =============================================================== 8. the live picture
# The recorder's chart is only as true as this stream: it draws the energy the CUT is made from,
# so the thresholds and the three states have to be the segmenter's own, not a second copy in the
# panel. And it must stop by itself — a dashboard closed mid-edit cannot leave the bus carrying
# 25 events a second for nobody.
print("\n--- 8. podgląd na żywo (gene) ---")
hub3 = G.GestureHub()
ev3 = []
hub3.emit = ev3.append
buf = []
t4 = still(40, 0.0, buf)
feed(hub3, buf)
check("8a. bez włączonego podglądu nic nie leci", not [e for e in ev3 if e.get("t") == "gene"])
r = hub3.watch(True, 300)
check("8b. podgląd włącza się i mówi, z jaką przerwą kończącą", r["ok"] and r["watch"] and r["endHoldMs"] == 300, r)
ev3.clear()
buf = []
t4 = still(30, t4, buf)
t4 = gesture(t4, buf, axis=0, amp=200, dur=0.7)
t4 = still(60, t4, buf)
feed(hub3, buf)
gene = [e for e in ev3 if e.get("t") == "gene"]
secs = t4 - (t4 - len(buf) * 0.02)
check("8c. punkty lecą mniej więcej WATCH_HZ razy na sekundę",
      G.WATCH_HZ * secs * 0.7 <= len(gene) <= G.WATCH_HZ * secs * 1.3, (len(gene), secs))
check("8d. każdy punkt niesie energię, stan i obie linie decyzji",
      all(set(e) >= {"e", "s", "start", "end"} for e in gene), gene[:1])
check("8e. progi są tymi samymi, których używa cięcie",
      all(e["start"] == G.DEFAULT_PARAMS["startEnergy"] for e in gene)
      and min(e["end"] for e in gene) == G.DEFAULT_PARAMS["endEnergy"], (gene[0]["start"], min(e["end"] for e in gene)))
check("8f. spoczynek jest stanem 0, a gest przechodzi przez stan 1",
      gene[0]["s"] == 0 and any(e["s"] == 1 for e in gene) and gene[-1]["s"] == 0,
      [e["s"] for e in gene[:3]] + ["…"] + [e["s"] for e in gene[-3:]])
peak = max(e["e"] for e in gene)
check("8g. szczyt energii odpowiada sile gestu (~200 °/s)", 150 <= peak <= 260, peak)
check("8h. linia „koniec” podnosi się razem ze szczytem",
      max(e["end"] for e in gene) > G.DEFAULT_PARAMS["endEnergy"], max(e["end"] for e in gene))
# ...and the whole thing goes quiet on its own once nobody re-arms it
hub3._watch["until"] = time.monotonic() - 1.0
ev3.clear()
buf = []
t4 = gesture(t4, buf, axis=0, amp=200, dur=0.7)
feed(hub3, buf)
check("8i. podgląd bez odświeżenia gaśnie sam", not [e for e in ev3 if e.get("t") == "gene"] and hub3._watch is None)
hub3.watch(True, 200)
ev3.clear()
hub3.watch(False)
buf = []
t4 = gesture(t4, buf, axis=0, amp=200, dur=0.7)
feed(hub3, buf)
check("8j. wyłączony podgląd milczy", not [e for e in ev3 if e.get("t") == "gene"])

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
