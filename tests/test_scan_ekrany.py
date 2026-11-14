# SKANER PRZY KILKU MONITORACH. Uruchom: py tests/test_scan_ekrany.py
#
# ZGLOSZENIE WLASCICIELA (2026-09-25): „w ribbitflip - jak mam podlaczone dwa monitory - to preview
# rozdzialki nie dziala prawidlowo i screeny sa uciete jakby nie skalowaly sie do 2 monitorow".
# Decyzja: skaner pracuje na JEDNYM monitorze naraz (tym, na ktorym jest gra), a nie na calym
# pulpicie z kilku ekranow.
#
# CO TU JEST PRZYKLEJONE, i dlaczego kazde z tego jest decyzja:
#
#   * OKNO NAD PULPITEM STOI NA JEDNYM EKRANIE, W KIOSKU. Okno rozpiete na kilka monitorow dostaje
#     od Windowsa JEDNO powiekszenie, wiec przy laptopie 150% obok monitora 100% rysunek byl w zlej
#     skali na jednym z nich — i zadne doskalowanie tego nie naprawialo,
#   * KTORY EKRAN — jedna regula po obu stronach (`scan_ekran_docelowy` w serwerze, `ekranSkanera`
#     w modelu panelu). Serwer stawia wedlug niej okno, panel rysuje wedlug niej podglad; rozjazd
#     = podglad pokazuje inny ekran niz ten, nad ktorym jedzie pasek. Test porownuje je na tych
#     samych danych,
#   * PLANSZA PAMIETA SWOJ MONITOR (zrzut skrotem), a plansza bez tej pamieci trafia na monitor,
#     ktorego PRAWDZIWA rozdzielczosc jest rowna jej rozmiarowi — ale tylko gdy taki jest jeden,
#   * KLIK dalej idzie procentami CALEGO pulpitu, bo tak mowi `mouse:left@x%,y%` — okno na drugim
#     monitorze musi wiec dolozyc przesuniecie swojego ekranu. Bez tego klik z prawego monitora
#     ladowalby na lewym.
#
# UKLAD TESTOWY = realny przypadek uzycia: laptop 2560x1600 przy 150% (w przestrzeni kursora
# 1707x1067) jako glowny i zewnetrzny monitor 1920x1080 przy 100% po prawej.
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


D1 = "\\\\.\\DISPLAY1"
D2 = "\\\\.\\DISPLAY2"
D3 = "\\\\.\\DISPLAY3"
LAPTOP = {"i": 0, "name": D1, "primary": True, "x": 0, "y": 0, "w": 1707, "h": 1067,
          "pw": 2560, "ph": 1600}
ZEWN = {"i": 1, "name": D2, "primary": False, "x": 1707, "y": 0, "w": 1920, "h": 1080,
        "pw": 1920, "ph": 1080}
DWA = [LAPTOP, ZEWN]
PULPIT = {"x": 0, "y": 0, "w": 3627, "h": 1080}
# Monitor PO LEWEJ od glownego ma ujemne wspolrzedne — tak jak w `@x,y`.
LEWY = {"i": 0, "name": D3, "primary": False, "x": -1920, "y": 0, "w": 1920, "h": 1080,
        "pw": 1920, "ph": 1080}


def _pl(**kw):
    z = {"plik": "gra-1.jpg", "nazwa": "Gra", "sekcje": [1], "w": 0, "h": 0}
    z.update(kw)
    return z


PRZYPADKI = [
    ("bez planszy i bez wskazania = glowny", {}, DWA, D1),
    ("wskazany ekran wygrywa", {"obszarMonitor": D2}, DWA, D2),
    ("wskazany ekran, ktorego nie ma = PIERWSZY z listy (jak obszarEkranu)",
     {"obszarMonitor": "\\\\.\\DISPLAY9"}, [ZEWN, LAPTOP], D2),
    ("plansza z drugiego monitora = drugi monitor",
     {"zrzuty": [_pl(monitor=D2, w=1920, h=1080)], "zrzutAktywny": 1}, DWA, D2),
    ("plansza BEZ pamieci monitora, rozmiar jak drugi = drugi",
     {"zrzuty": [_pl(w=1920, h=1080)], "zrzutAktywny": 1}, DWA, D2),
    ("plansza BEZ pamieci, rozmiar jak laptop w PRAWDZIWYCH pikselach = laptop",
     {"zrzuty": [_pl(w=2560, h=1600)], "zrzutAktywny": 1}, [ZEWN, dict(LAPTOP)], D1),
    ("plansza o rozmiarze, ktorego nie ma nikt = glowny",
     {"zrzuty": [_pl(w=1280, h=720)], "zrzutAktywny": 1}, DWA, D1),
    ("dwa monitory o tym samym rozmiarze = nie zgadujemy, glowny",
     {"zrzuty": [_pl(w=1920, h=1080)], "zrzutAktywny": 1}, [dict(LEWY, primary=True), ZEWN], D3),
    ("plansza zero (pulpit testowy) = glowny",
     {"zrzuty": [_pl(monitor=D2)], "zrzutAktywny": 0}, DWA, D1),
    ("wskazanie wygrywa z plansza",
     {"obszarMonitor": D1, "zrzuty": [_pl(monitor=D2)], "zrzutAktywny": 1}, DWA, D1),
    ("monitor planszy wypiety = dalej po rozmiarze",
     {"zrzuty": [_pl(monitor=D3, w=1920, h=1080)], "zrzutAktywny": 1}, DWA, D2),
]

print("-- serwer: ktory ekran")
for nazwa, cfg, ekrany, oczek in PRZYPADKI:
    s = rf.scan_ekran_docelowy(cfg, ekrany)
    check(nazwa, s is not None and s.get("name") == oczek, s and s.get("name"))
check("brak monitorow = nie wiemy", rf.scan_ekran_docelowy({}, []) is None)
check("smiec w konfiguracji nie wywraca",
      rf.scan_ekran_docelowy({"zrzuty": "x", "zrzutAktywny": "abc"}, DWA)["name"] == D1)

# --- model panelu: ta sama regula, te same dane --------------------------------------------------
_node = None
for _cand in ("node", "node.exe"):
    try:
        subprocess.run([_cand, "--version"], capture_output=True, check=True)
        _node = _cand
        break
    except Exception:
        continue

_JS = r"""
const RFS = require(process.argv[1]);
const dane = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const out = {};
out.reguly = dane.przypadki.map(function (p) {
  const s = RFS.ekranSkanera(p.cfg, { desktop: p.pulpit, screens: p.ekrany });
  return s ? s.name : null;
});
const E = { desktop: dane.pulpit, screens: dane.dwa };
out.bazaJeden = RFS.bazaProstokat({}, { desktop: dane.laptop, screens: [dane.laptop] });
out.bazaDwa = RFS.bazaProstokat({}, E);
out.bazaPlansza = RFS.bazaProstokat({ zrzuty: [{ plik: 'a.jpg', monitor: dane.d2 }], zrzutAktywny: 1 }, E);
out.bazaObszaru = RFS.bazaObszaru({ zrzuty: [{ plik: 'a.jpg', monitor: dane.d2 }], zrzutAktywny: 1 }, E);
// Okno stoi na drugim monitorze: dla niego „pulpitem" jest ten ekran.
const okno = RFS.ekranyNaOkno(Object.assign({}, E, { cursor: { x: 5, y: 5 } }), dane.d2);
out.okno = { desktop: okno.desktop, pulpit: okno.pulpit, okno: okno.okno, cursor: okno.cursor,
             ekrany: okno.screens.length };
out.oknoBezNazwy = RFS.ekranyNaOkno(E, '') === E;
out.oknoZniknelo = RFS.ekranyNaOkno(E, '\\\\.\\DISPLAY9') === E;
// Srodek drugiego monitora w pikselach okna → procent calego pulpitu.
out.klik = RFS.procentPulpitu({ x: 960, y: 540 }, okno, { x: 0, y: 0, w: 1920, h: 1080 });
out.klikJeden = RFS.procentPulpitu({ x: 853.5, y: 533.5 }, { desktop: dane.laptop, screens: [dane.laptop] },
                                   { x: 0, y: 0, w: 1707, h: 1067 });
// Obszar „prawa polowa" w oknie na drugim monitorze = prawa polowa TEGO ekranu, w pikselach okna.
out.obszar = RFS.obszarEkranu({ obszar: 'wlasny', obszarJednostka: 'procent', obszarX1: 50, obszarX2: 100,
                                obszarY1: 0, obszarY2: 100 }, { x: 0, y: 0, w: 1920, h: 1080 }, okno);
out.caly = RFS.obszarEkranu({ obszar: 'caly' }, { x: 0, y: 0, w: 1920, h: 1080 }, okno);
process.stdout.write(JSON.stringify(out));
"""

if not _node:
    print("SKIP  brak Node - porownanie z modelem panelu pominiete")
else:
    dane = {"przypadki": [{"cfg": c, "ekrany": e, "pulpit": PULPIT} for _n, c, e, _o in PRZYPADKI],
            "dwa": DWA, "laptop": LAPTOP, "pulpit": PULPIT, "d2": D2}
    p = subprocess.run([_node, "-e", _JS, os.path.join(_ROOT, "web", "js", "rf-50-scan-model.js")],
                       input=json.dumps(dane).encode("utf-8"), capture_output=True)
    if p.returncode != 0:
        check("model panelu sie wczytuje", False, p.stderr.decode("utf-8", "replace")[-600:])
    else:
        j = json.loads(p.stdout.decode("utf-8"))
        print("-- panel: ta sama regula co serwer")
        for (nazwa, _c, _e, oczek), js in zip(PRZYPADKI, j["reguly"]):
            check("JS = serwer: " + nazwa, js == oczek, js)
        print("-- panel: baza podgladu")
        check("jeden monitor: baza = caly pulpit, jak dotad",
              j["bazaJeden"] == {"x": 0, "y": 0, "w": 1707, "h": 1067}, j["bazaJeden"])
        check("dwa monitory bez planszy: baza = glowny, NIE oba naraz",
              j["bazaDwa"] == {"x": 0, "y": 0, "w": 1707, "h": 1067}, j["bazaDwa"])
        check("dwa monitory, plansza z drugiego: baza = drugi (proporcje 16:9, nie 3627x1080)",
              j["bazaPlansza"] == {"x": 1707, "y": 0, "w": 1920, "h": 1080}, j["bazaPlansza"])
        check("rozmiar bazy dla pikseli obszaru idzie za tym samym ekranem",
              j["bazaObszaru"] == {"w": 1920, "h": 1080}, j["bazaObszaru"])
        print("-- okno nad pulpitem na drugim monitorze")
        check("dla okna pulpitem jest JEGO ekran",
              j["okno"]["desktop"] == {"x": 1707, "y": 0, "w": 1920, "h": 1080}, j["okno"])
        check("prawdziwy pulpit zostaje do liczenia klikniecia",
              j["okno"]["pulpit"] == PULPIT and j["okno"]["okno"] == D2, j["okno"])
        check("reszta odpowiedzi /screens przechodzi nietknieta",
              j["okno"]["cursor"] == {"x": 5, "y": 5} and j["okno"]["ekrany"] == 2, j["okno"])
        check("bez nazwy ekranu (jeden monitor) uklad bez zmian", j["oknoBezNazwy"] is True)
        check("nazwa ekranu, ktorego juz nie ma = uklad bez zmian", j["oknoZniknelo"] is True)
        # Srodek drugiego monitora: x = 1707 + 960 = 2667 z 3627, y = 540 z 1080.
        kx, ky = j["klik"]["x"], j["klik"]["y"]
        check("klik na drugim monitorze niesie jego przesuniecie",
              abs(kx - 2667 / 3627 * 100) < 1e-9 and abs(ky - 50.0) < 1e-9, j["klik"])
        # A serwer rozwija procent z powrotem do punktu, w ktory ma trafic kursor.
        check("procent wraca do srodka drugiego monitora co do piksela",
              round(PULPIT["x"] + kx * PULPIT["w"] / 100) == 2667
              and round(PULPIT["y"] + ky * PULPIT["h"] / 100) == 540, (kx, ky))
        check("jeden monitor: klik liczy sie jak dotad",
              abs(j["klikJeden"]["x"] - 50) < 1e-9 and abs(j["klikJeden"]["y"] - 50) < 1e-9,
              j["klikJeden"])
        check("prawa polowa = prawa polowa TEGO ekranu, w pikselach okna",
              j["obszar"] == {"x": 960, "y": 0, "w": 960, "h": 1080}, j["obszar"])
        check("caly pulpit = cale okno", j["caly"] == {"x": 0, "y": 0, "w": 1920, "h": 1080}, j["caly"])


# --- plansza pamieta monitor ---------------------------------------------------------------------
print("-- plansza pamieta, z ktorego monitora jest")


class _Bus:
    def __init__(self):
        self.ev = []

    def publish(self, e):
        self.ev.append(e)

    def now(self):
        return 0.0


m = rf.ScanModule(_Bus(), dev="t-ekrany")
m.screens_edit("dodaj", nazwa="Gra", plik="gra-aaaa1111.jpg", w=1920, h=1080, monitor=D2)
z = m.cfg["zrzuty"][0]
check("zrzut skrotem zapisuje monitor", z.get("monitor") == D2, z)
check("sanityzacja go nie zjada", m.sanitize(m.cfg)["zrzuty"][0].get("monitor") == D2)
m.screens_edit("obraz", n=1, plik="gra-bbbb2222.jpg", w=2560, h=1600, monitor=D1)
check("nowy obraz z innego monitora = nowy monitor", m.cfg["zrzuty"][0].get("monitor") == D1)
m.screens_edit("obraz", n=1, plik="gra-cccc3333.jpg", w=1280, h=720)
check("obraz wgrany z pliku ZDEJMUJE stara pamiec (opisywala poprzedni obraz)",
      "monitor" not in m.cfg["zrzuty"][0], m.cfg["zrzuty"][0])
m.screens_edit("dodaj", nazwa="Menu", plik="menu-dddd4444.jpg", w=1920, h=1080)
check("plansza wgrana z pliku nie ma klucza monitor (zadnego szumu w presecie)",
      "monitor" not in m.cfg["zrzuty"][1], m.cfg["zrzuty"][1])
m.screens_edit("obraz", n=2, plik="menu-eeee5555.jpg", w=1920, h=1080, monitor=D2)
m.screens_edit("zdejmij", n=2)
check("zdjety obraz zabiera pamiec monitora", "monitor" not in m.cfg["zrzuty"][1],
      m.cfg["zrzuty"][1])
check("zlosliwie dluga nazwa monitora jest przycinana",
      len(m.sanitize({"zrzuty": [_pl(monitor="X" * 500)]})["zrzuty"][0]["monitor"]) == 80)

# --- okna nad pulpitem: po jednym na kazdym ekranie ----------------------------------------------
# Zgloszenie 26.09: „nakladka na pulpit powinna obslugiwac dwa pulpity". Kazdy monitor dostaje
# WLASNE okno w kiosku (wlasna skala), a skaner PRACUJE na jednym — tym, ktory wskazuje regula.
print("-- okna nad pulpitem: po jednym na kazdym ekranie")
import tempfile  # noqa: E402


class _Proc:
    def __init__(self, args):
        self.args, self.pid, self.zyje = args, 4242, True

    def poll(self):
        return None if self.zyje else 0

    def terminate(self):
        self.zyje = False

    def wait(self, timeout=None):
        self.zyje = False
        return 0


def _arg(proc, nazwa):
    for x in proc.args[1:]:
        if x == nazwa:
            return True
        if x.startswith(nazwa + "="):
            return x.split("=", 1)[1]
    return None


_uruchomione = []
_tmp = tempfile.mkdtemp(prefix="rf-ekrany-")
_bylo = (rf.list_screens, rf.subprocess.Popen, rf.ScanOverlay._exe, rf.ScanOverlay._dopilnuj,
         rf.ScanOverlay.sprzataj_sieroty, rf.SETTINGS_DIR)
try:
    rf.SETTINGS_DIR = _tmp
    rf.list_screens = lambda force=False: [dict(s) for s in DWA]
    rf.subprocess.Popen = lambda args, **kw: _uruchomione.append(_Proc(args)) or _uruchomione[-1]
    rf.ScanOverlay._exe = lambda self: "C:/fake/msedge.exe"
    rf.ScanOverlay._dopilnuj = lambda self, *a, **k: None
    rf.ScanOverlay.sprzataj_sieroty = lambda self, port=None, pod="": 0

    zyw = rf.ScanModule(_Bus(), dev="t-okno")
    zyw.screens_edit("dodaj", nazwa="Gra", plik="gra-ffff6666.jpg", w=1920, h=1080, monitor=D2)
    o = rf.ScanOverlays()
    ok, blad = o.open("http://127.0.0.1:65530", "t-okno", "edycja")
    check("dwa monitory = dwa okna", ok is True and len(_uruchomione) == 2, (ok, blad, len(_uruchomione)))
    ekrany_okien = [rf.urllib.parse.unquote(str(_arg(p, "--app")).split("&ekran=")[1])
                    if "&ekran=" in str(_arg(p, "--app")) else "" for p in _uruchomione] \
        if hasattr(rf, "urllib") else []
    import urllib.parse  # noqa: E402
    ekrany_okien = [urllib.parse.unquote(str(_arg(p, "--app")).split("&ekran=")[1])
                    for p in _uruchomione if "&ekran=" in str(_arg(p, "--app"))]
    check("kazde okno zna SWOJ ekran", sorted(ekrany_okien) == sorted([D1, D2]), ekrany_okien)
    check("kazde okno w kiosku (wlasna skala)", all(_arg(p, "--kiosk") is True for p in _uruchomione))
    for p in _uruchomione:
        mon = ZEWN if D2 in urllib.parse.unquote(str(_arg(p, "--app"))) else LAPTOP
        x, y = [int(v) for v in str(_arg(p, "--window-position")).split(",")]
        w, h = [int(v) for v in str(_arg(p, "--window-size")).split(",")]
        check("okno %s wstaje w srodku SWOJEGO monitora" % mon["name"][-8:],
              mon["x"] <= x and x + w <= mon["x"] + mon["w"] and mon["y"] <= y and y + h <= mon["y"] + mon["h"],
              (x, y, w, h))
    profile = [_arg(p, "--user-data-dir") for p in _uruchomione]
    check("osobny profil przegladarki na kazdy ekran (inaczej drugi kiosk nie wstanie)",
          len(set(profile)) == 2, profile)
    znaczniki = [str(_arg(p, "--app")).split("mark=")[1].split("&")[0] for p in _uruchomione]
    check("znaczniki okien sie roznia i niosa ekran",
          len(set(z[:len("RFSKAN-65530-e0-")] for z in znaczniki)) == 2, znaczniki)
    check("okno na ekranie SKANERA otwiera sie ostatnie (w edycji dostaje skupienie)",
          D2 in urllib.parse.unquote(str(_arg(_uruchomione[-1], "--app"))))
    st = o.stan()
    check("stan: skaner pracuje na drugim, okna stoja na obu",
          st["open"] is True and st["ekran"] == D2 and st["ekrany"] == sorted([D1, D2]), st)
    ok2, _b = o.open("http://127.0.0.1:65530", "t-okno", "edycja")
    check("to samo otwarcie drugi raz = nic nowego", ok2 is True and len(_uruchomione) == 2)
    check("pomiar widoku trafia do okna SWOJEGO ekranu",
          o.set_widok({"x": 0, "y": 0, "w": 1707, "h": 1067}, D1) is True
          and o.okna[D1].widok == (0, 0, 1707, 1067) and o.okna[D2].widok is None)
    check("oczko schowanego edytora tez", o.set_klik({"x": 1, "y": 2, "w": 30, "h": 30}, D2) is True
          and o.okna[D2].klik == (1, 2, 30, 30) and o.okna[D1].klik is None)

    # Przelaczona plansza (laptop) = inny ekran skanera, ale okna ZOSTAJA: zmienia sie tylko rola.
    zyw.screens_edit("dodaj", nazwa="Laptop", plik="lap-gggg7777.jpg", w=2560, h=1600, monitor=D1)
    check("zmiana planszy nie otwiera okien od nowa", len(_uruchomione) == 2)
    check("…a skaner pracuje teraz na laptopie", o.stan()["ekran"] == D1, o.stan())

    # Chowanie na czas zrzutu: wszystkie okna.
    slad = []
    for nazwa, okno in o.okna.items():
        okno.hwnd = 100 + len(slad)
        okno._win_show = (lambda n: (lambda hwnd, co: slad.append((n, co))))(nazwa)
        okno._pauza = lambda s: None
        slad.append((nazwa, "start"))
    slad[:] = []
    schowane = o.zrzut_ukryj()
    check("zrzut chowa KAZDE okno", sorted(n for n, c in slad if c == "schowaj") == sorted([D1, D2]), slad)
    o.zrzut_pokaz(schowane)
    check("…i kazde pokazuje z powrotem",
          sorted(n for n, c in slad if c in ("pokaz", "aktywuj")) == sorted([D1, D2]), slad)

    ok3 = o.close()
    check("zamkniecie gasi wszystkie okna", all(not p.zyje for p in _uruchomione) and o.is_open() is False,
          [p.zyje for p in _uruchomione])

    # Jeden monitor: dokladnie droga sprzed zmiany.
    rf.list_screens = lambda force=False: [dict(LAPTOP)]
    o2 = rf.ScanOverlays()
    o2.open("http://127.0.0.1:65531", "t-okno", "podglad")
    a2 = _uruchomione[-1].args
    check("jeden monitor: jedno okno, kiosk, bez nazwy ekranu",
          len(o2.okna) == 1 and "--kiosk" in a2 and not any("&ekran=" in x for x in a2)
          and o2.stan()["ekrany"] == [] and o2.stan()["ekran"] == "", a2)
    o2.close()

    def _wybuch(force=False):
        raise RuntimeError("brak Windowsa")

    rf.list_screens = _wybuch
    o3 = rf.ScanOverlays()
    o3.open("http://127.0.0.1:65532", "t-okno", "podglad")
    check("nie wiemy, ile ekranow = jedno okno zwykle na caly pulpit (droga bezpieczna)",
          len(o3.okna) == 1 and "--kiosk" not in _uruchomione[-1].args, _uruchomione[-1].args)
    o3.close()
finally:
    (rf.list_screens, rf.subprocess.Popen, rf.ScanOverlay._exe, rf.ScanOverlay._dopilnuj,
     rf.ScanOverlay.sprzataj_sieroty, rf.SETTINGS_DIR) = _bylo

# --- sygnal niesie ekran, na ktorym skaner pracuje ------------------------------------------------
print("-- sygnal wskazuje JEDNO okno")
_bylo_ls = rf.list_screens
try:
    rf.list_screens = lambda force=False: [dict(s) for s in DWA]
    bus = _Bus()
    sm = rf.ScanModule(bus, dev="t-syg")
    sm.screens_edit("dodaj", nazwa="Gra", plik="gra-hhhh8888.jpg", w=1920, h=1080, monitor=D2)
    sm.signal("sygnal")
    ev = [e for e in bus.ev if e.get("t") == "scan"]
    check("sygnal przy dwoch monitorach mowi, ktore okno ma zareagowac",
          ev and ev[-1].get("ekran") == D2, ev)
    rf.list_screens = lambda force=False: [dict(LAPTOP)]
    sm.signal("sygnal")
    ev = [e for e in bus.ev if e.get("t") == "scan"]
    check("przy jednym monitorze sygnal jest jak dotad (bez ekranu)", "ekran" not in ev[-1], ev[-1])
finally:
    rf.list_screens = _bylo_ls

# --- zrzut wskazanego ekranu: przycisk w karcie i w pasku nakladki -------------------------------
print("-- zrzut wskazanego ekranu")
try:
    from PIL import Image
    _ma_pillow = True
except Exception:
    _ma_pillow = False
if not _ma_pillow:
    print("SKIP  brak Pillow - zrzut wskazanego ekranu pominiety")
else:
    class _Dev:
        def __init__(self, dev, bus):
            self.id, self.name, self.label = dev, "Triki 1", ""
            self.scan = rf.ScanModule(bus, dev)

    class _Dm:
        def __init__(self, bus, dev="t-zrz"):
            self.simulate, self.default_id = False, dev
            self.devices = {dev: _Dev(dev, bus)}
            self.order = [dev]

        def get(self, dev_id):
            return self.devices.get(dev_id) or self.devices.get(self.default_id)

        def all(self):
            return [self.devices[i] for i in self.order]

    _tmp2 = tempfile.mkdtemp(prefix="rf-zrzut-ekranu-")
    _st = (rf.SETTINGS_DIR, rf.SCAN_TLA_DIR, rf._tytul_okna_na_wierzchu, rf.NOTIFIER.notify,
           rf._front_window_by_title)
    powiadomienia, proszono = [], []
    try:
        rf.SETTINGS_DIR = _tmp2
        rf.SCAN_TLA_DIR = os.path.join(_tmp2, "ScanTla")
        rf._tytul_okna_na_wierzchu = lambda: ""
        rf.NOTIFIER.notify = lambda *a, **k: powiadomienia.append(a)
        # ⚠️ Test NIE ma prawa wyciagac na wierzch prawdziwego okna panelu (zrodlo „panel").
        wyciagniete = []
        rf._front_window_by_title = lambda t: wyciagniete.append(t) or True

        def _grab(monitor="kursor"):
            proszono.append(monitor)
            # Kolor zalezy od ekranu: ten sam obraz dwa razy to ta sama plansza (nazwa pliku niesie
            # skrot tresci), a tu chcemy dwoch roznych zdjec.
            kolor = (40, 60, 80) if monitor == D2 else (90, 20, 20)
            return Image.new("RGB", (1920, 1080), kolor), {"monitor": monitor, "w": 1920, "h": 1080}, ""

        bus = _Bus()
        dm = _Dm(bus)
        w = rf.scan_zrzut_ekranu(dm, bus, "t-zrz", D2, "panel", zrzut_fn=_grab)
        z = dm.get("t-zrz").scan.cfg["zrzuty"]
        check("fotografowany jest WSKAZANY ekran", proszono == [D2], proszono)
        check("powstaje nowa plansza, ktora pamieta swoj ekran",
              w.get("ok") is True and len(z) == 1 and z[0].get("monitor") == D2, (w, z))
        check("z panelu: panel pokazuje plansze (kursor w polu nazwy)", w.get("poZrzucie") == "panel", w)
        w2 = rf.scan_zrzut_ekranu(dm, bus, "t-zrz", D1, "nakladka", zrzut_fn=_grab)
        z = dm.get("t-zrz").scan.cfg["zrzuty"]
        check("drugi zrzut = DRUGA plansza (przycisk nie podmienia istniejacych)",
              len(z) == 2 and z[1].get("monitor") == D1 and w2.get("n") == 2, z)
        check("z paska nakladki: nic sie nie wyciaga na wierzch",
              w2.get("poZrzucie") == "nic" and len(wyciagniete) == 1, (w2, wyciagniete))
        check("zamowiony zrzut nie wysyla powiadomienia systemowego", powiadomienia == [], powiadomienia)
        check("plansza z panelu nie nazywa sie oknem aplikacji",
              all("RibbitFlip" not in (x.get("nazwa") or "") for x in z), z)
    finally:
        (rf.SETTINGS_DIR, rf.SCAN_TLA_DIR, rf._tytul_okna_na_wierzchu, rf.NOTIFIER.notify,
         rf._front_window_by_title) = _st

# Nasze wlasne okna nie sa nazwa gry (plansza nazywala sie „RibbitFlip · RFOVL-76623b").
import inspect  # noqa: E402
_zr_tytul = inspect.getsource(rf._tytul_okna_na_wierzchu)
check("tytul okna aplikacji (panel, nakladki) nie trafia do nazwy planszy",
      '"RFSKAN-"' in _zr_tytul and '"RFOVL-"' in _zr_tytul and '"RibbitFlip" in t' in _zr_tytul)

# --- zrodla: strona i panel naprawde uzywaja wspolnej reguly -------------------------------------
print("-- zrodla")


def _read(*parts):
    with open(os.path.join(_ROOT, *parts), "r", encoding="utf-8") as f:
        return f.read()


_h = _read("web", "js", "rf-50h-scan-overlay.js")
check("okno czyta swoj ekran z adresu", 'par.get("ekran")' in _h and "ekranyNaOkno" in _h)
check("klik idzie przez procentPulpitu", "RFScan.procentPulpitu(" in _h)
check("panel bierze baze z modelu", "RFScan.bazaProstokat(" in _read("web", "js", "rf-50d-scan-card.js"))
check("pasek edytora stoi na ekranie okna, nie na glownym",
      "e.okno" in _read("web", "js", "rf-50m-scan-overlay-edit.js"))

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
