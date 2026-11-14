# PRZÓD KAPSLA (2026-09-29) — element nakładki „przód kapsla” i zapis przodu na kapsel.
# Uruchom: py tests/test_front.py
#
# Sprawdza:
#   1. sanitize_front / load_front / save_front: zawijanie kąta, śmieci, scalanie częściowego zapisu,
#      wygląd kropli (czułość, próg, trzy przełączniki) NA KAPSEL, plik per kapsel (d0 płasko, d1 w katalogu),
#   2. okno nakładki: blok „front” wyłączony, skala — i NIC z wyglądu kropli (należy do kapsla),
#   3. lustro serwer ↔ strona: kolejność, OVL_PARTS, OVL_SCALE_PARTS, CSS, <script>, wspólny komponent
#      w edytorze nakładki i w prawej kolumnie, zdarzenie `front`,
#   4. matematykę rf-41e w Node (gdy jest): kąt przodu na tarczy, pochylenie do przodu, reguła „mierzy” z histerezą.
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import ribbitflip_monitor as rf  # noqa: E402

P = F = 0


def check(name, cond, info=""):
    global P, F
    if cond:
        P += 1
    else:
        F += 1
        print("FAIL:", name, info)


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


# ---- 1. zapis przodu ------------------------------------------------------------------------
s = rf.sanitize_front
check("domyślnie fabryczny + wygląd", s({}) == dict(rf.FRONT_DEFAULTS), s({}))
check("wygląd domyślny: ±12°, 15°, wszystko włączone",
      (s({})["tol"], s({})["min"], s({})["num"], s({})["tolShow"], s({})["fade"]) == (12, 15, True, True, True))
check("czułość i próg przycięte", (s({"tol": 99, "min": 1})["tol"], s({"tol": 99, "min": 1})["min"]) == (45, 5))
check("częściowy zapis nie rusza przodu", s({"tol": 20}, {"deg": 40, "how": "kierownica"})["deg"] == 40.0)
check("częściowy zapis nie rusza wyglądu", s({"deg": 10}, {"tol": 30, "fade": False})["tol"] == 30
      and s({"deg": 10}, {"tol": 30, "fade": False})["fade"] is False)
check("przełączniki jako bool", s({"num": 0})["num"] is False)
check("kąt zawinięty do ±180", s({"deg": 270})["deg"] == -90.0, s({"deg": 270}))
check("kąt -190 → 170", s({"deg": -190})["deg"] == 170.0)
check("śmieci → 0", s({"deg": "abc"})["deg"] == 0.0 and s(None)["deg"] == 0.0)
check("NaN → 0", s({"deg": float("nan")})["deg"] == 0.0)
check("nieznany sposób → pochylenie przy kącie ≠ 0", s({"deg": 30, "how": "xyz"})["how"] == "pochylenie")
check("znany sposób zostaje", s({"deg": 30, "how": "kierownica"})["how"] == "kierownica")
check("zaokrąglenie do 0,1°", s({"deg": 12.3456})["deg"] == 12.3)
check("zepsuty zapis na dysku → wartości fabryczne", s({}, {"tol": "x", "deg": "y"})["deg"] == 0.0)

tmp = tempfile.mkdtemp(prefix="rf-front-")
old = rf.SETTINGS_DIR
try:
    rf.SETTINGS_DIR = tmp
    check("brak pliku → fabryczny", rf.load_front("d0") == dict(rf.FRONT_DEFAULTS))
    rf.save_front({"deg": 42, "how": "kierownica"}, "d0")
    rf.save_front({"deg": -15, "how": "pochylenie"}, "d1")
    check("d0 w korzeniu Settings", os.path.isfile(os.path.join(tmp, "ribbitflip_front.json")))
    check("d1 w swoim katalogu", os.path.isfile(os.path.join(tmp, "d1", "ribbitflip_front.json")))
    check("odczyt d0", rf.load_front("d0")["deg"] == 42.0 and rf.load_front("d0")["how"] == "kierownica", rf.load_front("d0"))
    check("odczyt d1 niezależny", rf.load_front("d1")["deg"] == -15.0 and rf.load_front("d1")["how"] == "pochylenie")
    rf.save_front(rf.sanitize_front({"tol": 25, "fade": False}, rf.load_front("d0")), "d0")
    _f0 = rf.load_front("d0")
    check("wygląd zapisany na kapsel, przód został", _f0["tol"] == 25 and _f0["fade"] is False and _f0["deg"] == 42.0, _f0)
    check("wygląd d1 nietknięty", rf.load_front("d1")["tol"] == 12)
    with open(os.path.join(tmp, "ribbitflip_front.json"), "w", encoding="utf-8") as f:
        f.write("{zepsuty")
    check("zepsuty plik → fabryczny", rf.load_front("d0")["deg"] == 0.0)
finally:
    rf.SETTINGS_DIR = old
    shutil.rmtree(tmp, ignore_errors=True)
check("przód NIE jest w konfiguracji pozy (presety osi)", "front" not in rf._pose_full_cfg({"front": 30}))

# ---- 2. domyślne okno nakładki ----------------------------------------------------------------
D = rf.OVERLAY_WIN_DEFAULTS
check("blok front wyłączony domyślnie", D["show"]["front"] is False)
check("skala front 100", D["scaleParts"]["front"] == 100)
check("okno NIE trzyma wyglądu kropli (należy do kapsla)",
      not any(k.startswith("front.") for k in D["show"]) and "frontTol" not in D and "frontMin" not in D)
c = rf._sanitize_overlay_win({"frontTol": 20})
check("stare pole okna odrzucane", "frontTol" not in c)
c = rf._sanitize_overlay_win({"show": {"front": True}, "scaleParts": {"front": 180}})
check("show.front i skala przechodzą", c["show"]["front"] is True and c["scaleParts"]["front"] == 180)
check("okno koła nie pokazuje przodu", rf.OVERLAY_WHEEL_DEFAULTS["show"]["front"] is False)
check("front w kolejności bloków, po orientacji",
      rf.OVERLAY_ORDER_KEYS.index("front") == rf.OVERLAY_ORDER_KEYS.index("pose") + 1)

# ---- 3. lustro serwer ↔ strona -----------------------------------------------------------------
ovl = read("web/js/rf-41-overlay.js")
check("OVL_PARTS zna front", '{key:"front", label:"przód kapsla", cls:"ovl-no-front"}' in ovl)
check("OVL_PARTS bez drobiazgów kropli", '{key:"front.' not in ovl)
check("OVL_SCALE_PARTS zna front", '{key:"front", label:"przód kapsla"}' in ovl)
check("OVL_ORDER_SEL i OVL_PART_SEL znają front", ovl.count('front:".ov-front"') == 2)
css = read("web/css/15-overlay.css")
check("CSS chowa w panelu", ".ov-front{display:none}" in css)
check("CSS chowa przełącznikiem okna", ".ov-col.ovl-no-front .ov-front{display:none!important}" in css)
check("CSS skaluje", "zoom:var(--sc-front,1)" in css)
check("kolumna ma płótno", 'class="ov-front"' in read("web/js/rf-11-devices-ui.js"))
check("pętla klatek rysuje", "drawFrontAll(root)" in read("web/js/rf-12-preview-editor.js"))
check("skrypt w panelu", '<script src="/web/js/rf-41e-overlay-front.js"></script>' in read("web/ribbitflip_dashboard.html"))
ed = read("web/js/rf-41c-overlay-editor.js")
check("edytor nakładki: wspólny komponent", 'frontSettingsHtml("ovl")' in ed and "frontSettingsWire(host)" in ed
      and "frontSettingsSync(fs, w.dev)" in ed)
check("edytor nakładki: bez własnych kopii kontrolek", "ovm-front" not in ed and "_ovmFront" not in ed)
fr = read("web/js/rf-41e-overlay-front.js")
# edytor nakładki podpina komponent na `document` (bez setAttribute) — wywrotka zabijała cały initOvlManage
check("frontSettingsWire znosi document jako pojemnik", "if (host.setAttribute) host.setAttribute(" in fr)
check("komponent: przód, trzy przyciski, dwa suwaki, trzy przełączniki",
      all('data-fs="%s"' % k in fr for k in ("stat", "tilt", "wheel", "reset", "tol", "min", "num", "tolShow", "fade")))
check("prawa kolumna: wiersz powiązania z nakładką", 'data-fs="linkBtn"' in fr and "ovmSend(w.win, { show: { front: want } }" in fr)
check("kropla czyta wygląd z kapsla, nie z okna", "drawFront(c, D, frontOpt(D))" in fr and "OVL.cfg.frontTol" not in fr)
rc = read("web/js/rf-34c-rcol.js")
check("prawa kolumna buduje i rysuje kafel", "frontRailTile()" in rc and "frontRailDraw(now)" in rc)
check("zdarzenie front w panelu i nakładce", 'if(t==="front")' in read("web/js/rf-08-sse-ui.js"))
check("serwer rozsyła zdarzenie po zapisie", '"t": "front"' in read("ribbitflip_monitor.py"))
check("rf-34c w limicie 500 linii", rc.count("\n") <= 500, rc.count("\n"))
mon = read("ribbitflip_monitor.py")
check("GET i POST /front", mon.count('path == "/front"') == 2)

# ---- 4. matematyka rf-41e w Node ---------------------------------------------------------------
node = shutil.which("node")
if node:
    js = read("web/js/rf-41e-overlay-front.js")
    prog = js + r"""
;const q=(ax,deg)=>{const h=deg*Math.PI/360,s=Math.sin(h);return [Math.cos(h),ax[0]*s,ax[1]*s,ax[2]*s];};
const out={};
// kapsel pionowo, „w górę” = +X (przód fabryczny u góry) → kąt na tarczy 0, mierzy
let g=frontGeom(q([0,1,0],-90),0); out.pion=g.pion; out.beta=Math.round(g.beta);
out.m1=frontAims(g,12,15,false);
// ten sam kapsel z przodem ustawionym na 40° → przód 40° od celu, nie mierzy
g=frontGeom(q([0,1,0],-90),40); out.beta40=Math.round(g.beta); out.m2=frontAims(g,12,15,false);
// histereza: 14° od celu — nie zapala z wyłączonego, trzyma z zapalonego
g=frontGeom(q([0,1,0],-90),14); out.h_off=frontAims(g,12,15,false); out.h_on=frontAims(g,12,15,true);
// płasko, pochylony o 30° krawędzią +X w dół → do przodu +30, w bok 0, mierzy
g=frontGeom(q([0,1,0],30),0); out.flatF=Math.round(g.pf.f); out.flatR=Math.round(g.pf.r); out.m3=frontAims(g,12,15,false);
// płasko prawie bez pochylenia → poniżej progu
g=frontGeom(q([0,1,0],5),0); out.m4=frontAims(g,12,15,false);
console.log(JSON.stringify(out));
"""
    # przeglądarkowe globalne, których plik używa poza testowanymi funkcjami — stuby
    stub = "const performance={now:()=>0};const fetch=()=>Promise.reject();const state={devices:{}};const _cvT=x=>x;const window={};\n"
    r = subprocess.run([node, "-"], input=stub + prog, capture_output=True, text=True, encoding="utf-8")  # stdin: `-e` z całym frontem przekracza limit wiersza poleceń Windows (WinError 206)
    try:
        o = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception:
        o = {}
        print(r.stderr)
    check("pionowo rozpoznane", o.get("pion") is True, o)
    check("przód fabryczny u góry = 0°", o.get("beta") == 0, o)
    check("mierzy w celu", o.get("m1") is True, o)
    check("przód własny 40° → 40° od celu", abs(o.get("beta40", 0)) == 40 and o.get("m2") is False, o)
    check("histereza: 14° nie zapala", o.get("h_off") is False, o)
    check("histereza: 14° trzyma", o.get("h_on") is True, o)
    check("płasko: 30° do przodu, 0° w bok", abs(o.get("flatF", 0)) == 30 and o.get("flatR") == 0, o)
    check("płasko do przodu mierzy", o.get("m3") is (o.get("flatF", 0) > 0), o)
    check("płasko 5° poniżej progu", o.get("m4") is False, o)
else:
    print("(brak Node — pomijam matematykę rf-41e)")

# ---- 5. dioda „świeć LED, gdy kapsel mierzy w przód” (FrontLed, po stronie serwera) --------------
import math as _m


def _qa(ax, deg):
    h = _m.radians(deg) / 2
    return (_m.cos(h), ax[0] * _m.sin(h), ax[1] * _m.sin(h), ax[2] * _m.sin(h))


def _qm(a, b):
    return (a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3], a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
            a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1], a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0])


UP = _qa((0, 1, 0), -90)                      # pionowo, przód fabryczny u góry
cfg = rf.sanitize_front({"led": True})
check("dioda domyślnie wyłączona", rf.FRONT_DEFAULTS["led"] is False and rf.sanitize_front({})["led"] is False)
check("aims: przód u góry", rf.front_aims(UP, cfg) is True)
check("aims: 40° obok → nie", rf.front_aims(_qm(UP, _qa((0, 0, 1), 40)), cfg) is False)
check("aims: histereza 14°", rf.front_aims(_qm(UP, _qa((0, 0, 1), 14)), cfg, False) is False
      and rf.front_aims(_qm(UP, _qa((0, 0, 1), 14)), cfg, True) is True)
check("aims: płasko do przodu 30°", rf.front_aims(_qa((0, 1, 0), 30), cfg) is True)
check("aims: płasko 5° poniżej progu", rf.front_aims(_qa((0, 1, 0), 5), cfg) is False)
check("aims: własny przód 40°", rf.front_aims(_qm(UP, _qa((0, 0, 1), 40)), rf.sanitize_front({"deg": -40})) is True)


class _Trig:
    def __init__(self):
        self.w = []

    def _led(self, on):
        self.w.append(bool(on))


t = _Trig()
g = rf.FrontLed("", t)
g.set_cfg({"led": True})
g.tick(UP, 1.00)
check("zapala przy wejściu w cel", t.w == [True], t.w)
for i in range(20):
    g.tick(UP, 1.1 + i * 0.1)
check("bez powtórnych zapisów w celu", t.w == [True], t.w)
g.tick(UP, 7.5)
check("ponawia świecenie po 5 s (reguła LED mogła zgasić)", t.w == [True, True], t.w)
g.tick(_qm(UP, _qa((0, 0, 1), 60)), 7.6)
check("gasi po wyjściu z celu", t.w[-1] is False and len(t.w) == 3, t.w)
g.tick(UP, 7.7)
g.set_cfg({"led": False})
check("wyłączenie opcji gasi zapaloną diodę", t.w[-1] is False and len(t.w) == 5, t.w)
g.tick(UP, 9.0)
check("wyłączony strażnik nie rusza diody", len(t.w) == 5, t.w)
t2 = _Trig(); g2 = rf.FrontLed("", t2); g2.tick(UP, 1.0)
check("bez opcji nic nie pisze", t2.w == [])
check("komponent ma przełącznik diody i lampkę", 'data-fs="led"' in fr and 'data-fs="lamp"' in fr)
# KOLEJNOŚĆ: przyciski ustawiania przodu tuż pod kroplą, „po co” na końcu
_h = fr[fr.index("function frontSettingsHtml"):fr.index("function _fsDev")]
_i = [_h.index(x) for x in ('data-fs="stat"', 'data-fs="tilt"', 'data-fs="led"', 'data-fs="tol"', 'data-fs="num"', 'class="fs-why"')]
check("kolejność: przód i przyciski → dioda → suwaki → przełączniki → opis", _i == sorted(_i), _i)
check("pipeline ma strażnika i woła go po pozie", "self.front_led.tick(self.pose.q, now)" in mon)
check("zapis przodu przestawia strażnika", "fl.set_cfg(cfg)" in mon)
_rv = mon[mon.index("    def _run_virtual"):mon.index("    def _run_virtual") + 9000]
check("„Steruj ręcznie” opróżnia kolejkę poleceń (dioda widoczna w symulacji)", "self._drain_commands_sim()" in _rv)
if node:
    # dioda i kropla muszą zgadzać się co do stopnia — ta sama reguła w Pythonie i w JS
    import random
    random.seed(7)
    qs = []
    for _ in range(40):
        ax = [random.uniform(-1, 1) for _ in range(3)]
        n = _m.sqrt(sum(x * x for x in ax)) or 1
        qs.append(_qa([x / n for x in ax], random.uniform(-180, 180)))
    prog = read("web/js/rf-41e-overlay-front.js") + "\n;const QS=" + json.dumps(qs) + \
        ";console.log(JSON.stringify(QS.map(q=>frontAims(frontGeom(q,25),12,15,false))));"
    stub = "const performance={now:()=>0};const fetch=()=>Promise.reject();const state={devices:{}};const _cvT=x=>x;const window={};\n"
    r = subprocess.run([node, "-"], input=stub + prog, capture_output=True, text=True, encoding="utf-8")  # stdin: `-e` z całym frontem przekracza limit wiersza poleceń Windows (WinError 206)
    try:
        js_out = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception:
        js_out = None
    py_out = [rf.front_aims(q, rf.sanitize_front({"deg": 25})) for q in qs]
    check("Python i JS: ta sama reguła na 40 losowych orientacjach", js_out == py_out, (js_out, py_out))

print("%d passed, %d failed" % (P, F))
sys.exit(1 if F else 0)
