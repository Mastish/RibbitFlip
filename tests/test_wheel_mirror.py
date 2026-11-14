# KONTRAKT: SILNIK KOŁA ↔ JEGO LUSTRO W PRZEGLĄDARCE. Uruchom: py tests/test_wheel_mirror.py
#
# PO CO TO ISTNIEJE. Koło wyboru ma DWIE implementacje i będzie miało je zawsze:
#
#   • `RadialMenu` w ribbitflip_monitor.py — silnik. Czyta prawdziwy kapsel i naciska prawdziwe
#     klawisze. To on jest źródłem prawdy.
#   • scena podglądu w `web/js/rf-46d*.js` — lustro. Prowadzi się myszą, nic z niej nie wychodzi,
#     i jest jedynym miejscem, w którym człowiek uczy się, jak koło działa, ZANIM je włączy.
#
# Nie da się z nich zrobić jednego pliku: jedno chodzi w Pythonie na serwerze, drugie w JS w
# przeglądarce, a między nimi jest drut. Handoff z 2026-08-27 proponował scalenie i to była
# propozycja oparta na przypuszczeniu, że obie kopie są w JS — nie są. Skoro więc rozjazd jest
# strukturalnie możliwy, to ma być GŁOŚNY: ten plik karmi obie implementacje TYM SAMYM ciągiem
# ruchów ręki i porównuje odpowiedzi.
#
# DWIE WARSTWY, bo mają różną cenę:
#
#   1. STAŁE (zawsze) — liczby, które w JS są przepisane z klasy silnika (martwa strefa, próg
#      otwarcia, lista trybów, limity). Czytane regexem wprost z plików, zero zależności.
#   2. ZACHOWANIE (gdy jest czym) — ten sam scenariusz puszczony przez silnik i przez PRAWDZIWĄ
#      scenę w przeglądarce, a potem porównany. Wymaga Node z Playwrightem i działającej
#      aplikacji; bez nich mówi SKIP i podaje komendę, którą się to włącza. Regexowe udawanie,
#      że sprawdzamy logikę, byłoby gorsze niż uczciwe SKIP.
import json
import math
import os
import re
import subprocess
import sys
import time as _real_time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import ribbitflip_monitor as rf   # noqa: E402

_passed = 0
_failed = 0
_skipped = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


def skip(name, why):
    global _skipped
    _skipped += 1
    print("SKIP  %s  -> %s" % (name, why))


def _js(path):
    with open(os.path.join(ROOT, "web", "js", path), "r", encoding="utf-8") as f:
        return f.read()


JS_WHEEL = _js("rf-46-wheel.js")
JS_STAGE = _js("rf-46d-wheel-stage.js")
JS_LIFE = _js("rf-46d3-wheel-stage-life.js")


def _num(src, name):
    """Wartość `const NAZWA = 1.23;` z pliku JS. None, gdy stałej nie ma — brak jest wynikiem,
    a nie wyjątkiem: skasowana stała to dokładnie ten rozjazd, którego szukamy."""
    m = re.search(r"const\s+" + re.escape(name) + r"\s*=\s*(-?[0-9.]+)\s*;", src)
    return float(m.group(1)) if m else None


def _codes(src, name):
    """Kody z tabeli `const NAZWA = [ ["kod", ...], ... ]` albo z listy `["a","b"]`."""
    m = re.search(r"const\s+" + re.escape(name) + r"\s*=\s*\[(.*?)\n?\];", src, re.S)
    if not m:
        return None
    return re.findall(r'"([a-z-]+)"', m.group(1).split("[\n")[0] if False else m.group(1))


# ==============================================================================================
print("--- 1. stałe: to samo w silniku i w lustrze ---")
# ==============================================================================================
W = rf.RadialMenu

PAR = [
    ("martwa strefa domyślna", "WHEEL_DEAD_DEF", JS_WHEEL, W.DEAD),
    ("martwa strefa: dół zakresu", "WHEEL_DEAD_MIN", JS_WHEEL, W.DEAD_MIN),
    ("martwa strefa: góra zakresu", "WHEEL_DEAD_MAX", JS_WHEEL, W.DEAD_MAX),
    ("próg otwarcia wychyleniem", "WHEEL_OPEN_MAG", JS_WHEEL, W.OPEN_MAG),
    ("...odstęp progu od martwej strefy", "WHEEL_OPEN_GAP", JS_WHEEL, W.OPEN_GAP),
    ("...i jego sufit", "WHEEL_OPEN_CAP", JS_WHEEL, W.OPEN_CAP),
    ("najwięcej wycinków", "WHEEL_MAX_SLICES", JS_WHEEL, W.MAX_SLICES),
    ("najmniej wycinków", "WHEEL_MIN_SLICES", JS_WHEEL, W.MIN_SLICES),
    ("głębokość podmenu", "WHEEL_MAX_DEPTH", JS_WHEEL, W.MAX_DEPTH),
    ("odstęp między pasmami", "WHEEL_BAND_GAP", JS_WHEEL, W.BAND_GAP),
    # Jedyna stała trzymana po dwóch stronach w RÓŻNYCH jednostkach: silnik liczy w sekundach,
    # przeglądarka w milisekundach. Porównanie robi mnożnik niżej, nie drugi zapis liczby.
    ("po ilu koło się poddaje", "WHEEL_OPEN_TIMEOUT_MS", JS_WHEEL, W.OPEN_TIMEOUT * 1000.0),
]
for label, jsname, src, want in PAR:
    got = _num(src, jsname)
    check("%s: %s == %s" % (label, jsname, want), got is not None and abs(got - float(want)) < 1e-9,
          "JS=%s, silnik=%s" % (got, want))

# Lista trybów. Kolejność też ma znaczenie: karta rysuje z niej przełącznik, a człowiek uczy się
# pozycji, nie nazwy.
js_modes = _codes(JS_WHEEL, "WHEEL_MODES")
check("pięć sposobów sterowania, w tej samej kolejności", js_modes == list(W.CONFIRM_MODES),
      (js_modes, list(W.CONFIRM_MODES)))
js_sub = _codes(JS_WHEEL, "WHEEL_SUB")
check("trzy kształty podmenu, w tej samej kolejności", js_sub == list(W.SUBMENU_MODES),
      (js_sub, list(W.SUBMENU_MODES)))

# Które tryby otwiera samo wychylenie. W silniku nie ma na to jednej stałej — jest gałąź
# `_try_open`, więc pytamy o nią silnik BEZPOŚREDNIO, zamiast przepisywać listę po raz trzeci.
js_lean = _codes(JS_LIFE, "WHEEL_MODES_LEAN") or _codes(JS_WHEEL, "WHEEL_MODES_LEAN")
# „cycle" NIE JEST JUŻ OTWIERANY WYCHYLENIEM (2026-09-06): włącza go kliknięcie, tak samo jak
# przesuwa wybór i — przytrzymane — wyłącza. „release" i „click" nigdy nie były.
eng_lean = [m for m in W.CONFIRM_MODES if m not in ("release", "click", "cycle")]
check("te same tryby otwierane wychyleniem", js_lean == eng_lean, (js_lean, eng_lean))

# PRÓG UZBROJENIA. Obie implementacje mają startować ROZBROJONE — to jest cała treść poprawki
# z 2026-08-27 i najłatwiejsza rzecz do cichego cofnięcia przy następnym refaktorze sceny.
check("silnik startuje rozbrojony (_lean_used == True)",
      rf.RadialMenu(type("B", (), {"now": lambda s: 0.0, "publish": lambda s, e: None})())._lean_used
      is True)
m = re.search(r"leanUsed:\s*(true|false)", JS_STAGE)
check("...i scena startuje rozbrojona (leanUsed: true)", m is not None and m.group(1) == "true",
      m.group(1) if m else "brak pola leanUsed")
check("...a wyjście kursora poza scenę rozbraja z powrotem",
      re.search(r"mouseleave[\s\S]{0,600}?S\.leanUsed\s*=\s*true", JS_LIFE) is not None)


# ==============================================================================================
print("\n--- 2. zachowanie: ten sam scenariusz w silniku i w przeglądarce ---")
# ==============================================================================================
# SCENARIUSZE. Każdy to lista kroków (ms, mag, kąt w stopniach od 12:00 zgodnie z ruchem wskazówek,
# klik?). `mag` to długość wychylenia w ułamku promienia — jedyna liczba, którą silnik dostaje z
# ręki, i dokładnie ta sama, którą scena liczy z odległości kursora od środka.
SCEN = [
    ("wychylony od startu, nigdy w środku", "tilt-hold", 700,
     [(1500, 0.95, 0, False)]),
    ("środek, potem wychylenie i czekanie", "tilt-hold", 700,
     [(300, 0.0, 0, False), (1400, 0.95, 0, False)]),
    ("zmiana wycinka zeruje odliczanie", "tilt-hold", 700,
     [(300, 0.0, 0, False), (500, 0.95, 0, False), (400, 0.95, 90, False), (500, 0.95, 90, False)]),
    ("powrót do środka zamyka bez wyboru", "tilt-hold", 700,
     [(300, 0.0, 0, False), (400, 0.95, 0, False), (400, 0.0, 0, False), (600, 0.0, 0, False)]),
]

SL4 = [{"label": "Góra", "spec": "up"}, {"label": "Prawo", "spec": "right"},
       {"label": "Dół", "spec": "down"}, {"label": "Lewo", "spec": "left"}]


class _Clock:
    def __init__(self, t0=1000.0):
        self.t = t0

    def monotonic(self):
        return self.t

    def __getattr__(self, n):
        return getattr(_real_time, n)


class _B:
    def now(self):
        return 0.0

    def publish(self, ev):
        pass


class _T:
    armed = True
    down = False
    fresh = True

    def button_hold_state(self, max_age=0.6):
        return (self.down and self.fresh), self.fresh


class _E:
    def __init__(self):
        self.taps = []

    def tap(self, spec):
        self.taps.append(spec)
        return True


def engine_run(mode, confirm_ms, steps):
    """Silnik przechodzi scenariusz i mówi, CO wyszło i ile razy koło się otworzyło."""
    clk = _Clock()
    old, rf.time = rf.time, clk
    try:
        em = _E()
        w = rf.RadialMenu(_B(), emitter=em, trig=_T())
        w.set_config({"enabled": True, "holdMs": 300.0, "confirm": mode,
                      "confirmMs": float(confirm_ms), "slices": [dict(s) for s in SL4]})
        opens = 0
        was = False
        for ms, mag, ang, _clk_ in steps:
            a = math.radians(ang)
            # ta sama zamiana kąta na parę osi, którą robi _vec w drugą stronę
            pose = {"tilt": mag * w.SCALE_DEG, "twist": 0.0,
                    "roll": mag * w.SCALE_DEG * math.sin(a),
                    "pitch": -mag * w.SCALE_DEG * math.cos(a)}
            for _ in range(max(1, int(round(ms / 20.0)))):
                clk.t += 0.02
                w.on_pose(dict(pose))
                w.tick()
                if w.open and not was:
                    opens += 1
                was = w.open
        # NUMERY WYCINKÓW, nie nazwy: przeglądarka chodzi po kole, które ten człowiek ma naprawdę
        # ustawione (test mu go nie podmienia), a silnik po swoich czterech — porównywalne jest
        # więc „który po kolei", nie „co dokładnie poszło".
        idx = [s["spec"] for s in SL4]
        return {"picks": [idx.index(t) for t in em.taps], "opens": opens}
    finally:
        rf.time = old


PORT = os.environ.get("RF_PORT", "8793")
HARNESS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wheel_mirror_harness.mjs")


def _app_up(port):
    try:
        urllib.request.urlopen("http://127.0.0.1:%s/" % port, timeout=1.5).read(1)
        return True
    except (urllib.error.URLError, OSError):
        return False


def browser_run(scen):
    """Scena w PRAWDZIWEJ przeglądarce przechodzi te same scenariusze. Jeden proces Node na
    wszystkie, bo start Chromium kosztuje więcej niż same scenariusze."""
    p = subprocess.run(["node", HARNESS, PORT, json.dumps(scen)],
                       capture_output=True, text=True, encoding="utf-8", cwd=ROOT, timeout=180)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout or "").strip()[-800:])
    return json.loads(p.stdout.strip().splitlines()[-1])


_why = None
if not os.path.exists(HARNESS):
    _why = "brak tests/wheel_mirror_harness.mjs"
elif not _app_up(PORT):
    _why = ("aplikacja nie odpowiada na porcie %s — uruchom: py ribbitflip_monitor.py --simulate "
            "--allow-multi --no-keys --no-open --no-tray --no-midi --no-mcp --port %s" % (PORT, PORT))

if _why:
    for name, _m, _c, _s in SCEN:
        skip("zachowanie: %s" % name, _why)
else:
    try:
        got = browser_run([{"name": n, "mode": m, "confirmMs": c, "steps": s} for n, m, c, s in SCEN])
    except Exception as e:                                    # noqa: BLE001
        got = None
        for name, _m, _c, _s in SCEN:
            skip("zachowanie: %s" % name, "harness nie wystartował: %s" % e)
    if got is not None:
        for (name, mode, cms, steps) in SCEN:
            eng = engine_run(mode, cms, steps)
            mir = got.get(name) or {}
            check("zachowanie: %s — wybrany ten sam wycinek" % name,
                  list(mir.get("picks") or []) == eng["picks"], (mir.get("picks"), eng["picks"]))
            check("zachowanie: %s — tyle samo razy koło stanęło" % name,
                  int(mir.get("opens", -1)) == eng["opens"], (mir.get("opens"), eng["opens"]))

print("\n%d passed, %d failed, %d skipped" % (_passed, _failed, _skipped))
sys.exit(1 if _failed else 0)
