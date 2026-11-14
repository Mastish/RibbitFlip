"""SKANER ZE ZRZUTU EKRANU - narzedzie MCP `set_scanner_layout` (2026-09-20).

Przeplyw, ktory to obsluguje: czlowiek pokazuje screena z gry, asystent go oglada, mierzy na nim
prostokat i opisuje plansze wraz ze skanerami. Sprawdzamy tu piec rzeczy, z ktorych kazda potrafi
sklamac po cichu - czyli zwrocic "ok" i zostawic skaner gdzie indziej, niz wskazuje odpowiedz:

  1. PIKSELE ZRZUTU -> PROCENTY EKRANU. Zmierzyc da sie tylko piksele obrazka; zapisany procent
     przezyje zmiane monitora. Bez rozdzielczosci planszy zostaje piksel i musi paść ostrzezenie.
  2. SIATKA MA `poziomyMax:1`. Zmierzona siatka 4x4 jest juz wlasciwym rozmiarem - dalszy podzial
     trafia MIEDZY pola. Obie wartosci sa prawidlowe osobno, wiec sanityzator tego nie zlapie.
  3. NOWY SKANER LADUJE NA WYBRANEJ PLANSZY. `sections_edit("dodaj")` przypisuje do planszy
     AKTYWNEJ - bez jawnego "wybierz" wszystko wladowaloby sie na pierwsza.
  4. DRUGIE WYWOLANIE EDYTUJE, NIE DUBLUJE (dopasowanie po nazwie), a `replace` kasuje po nazwach
     PO wszystkim - kazde usuniecie przenumerowuje reszte.
  5. SPIS IDZIE WYLACZNIE TA DROGA. `POST /scan` (czyli `set_config`) wiezie POKRETLA i spis
     IGNORUJE - to jest powod istnienia tego narzedzia, wiec pilnujemy tego wprost.

Bez znakow spoza ASCII w print() - konsola cp1250.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402
import ribbitflip_mcp as mcp      # noqa: E402

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


class BusStub:
    def now(self):
        return 1.0

    def publish(self, *a, **kw):
        pass


class TrigStub:
    def __init__(self, rules=()):
        self.rules = list(rules)

    def snapshot_rules(self):
        return list(self.rules)


class DevStub:
    def __init__(self):
        self.id = "d0"
        self.scan = rf.ScanModule(BusStub(), "d0")
        self.trig = TrigStub()


class DmStub:
    def __init__(self, d):
        self.devices = {"d0": d}
        self.default_id = "d0"
        self.master_armed = True
        self._d = d

    def get(self, _id):
        return self._d


def make_ctx(zapisy):
    d = DevStub()
    return d, {
        "dm": DmStub(d), "b": BusStub(), "port": 8770,
        "fn": {
            "save_scan": lambda cfg, dev=None: zapisy.append(cfg),
            "load_scan": lambda dev=None: {},
            "sim_keep_switches": lambda dm, cfg, stary, klucze: cfg,
            # Zrzut z dysku udawany: sprawdzamy TLUMACZENIE pikseli na procenty, a nie Pillow.
            "scan_zrzut_z_pliku": lambda p, podp="": ("plansza-1234abcd.jpg", 1920, 1080, ""),
        },
    }


def call(ctx, args):
    return mcp._t_set_scanner_layout(ctx, args)


# --- 1. piksele zrzutu -> procenty ekranu -----------------------------------
zapisy = []
d, ctx = make_ctx(zapisy)
out = call(ctx, {"views": [{
    "name": "Plansza", "image": "C:/zrzuty/plansza.png",
    "scanners": [{"name": "Siatka 4x4", "mode": "cwiartki", "grid": [4, 4],
                  "gridOrder": "wiersze",
                  "area": {"unit": "px", "x1": 480, "y1": 108, "x2": 1440, "y2": 972}}],
}]})
cfg = d.scan.get_config()
s = cfg["sekcje"][0]
check("obszar zapisany w procentach", s["obszarJednostka"] == "procent", s["obszarJednostka"])
check("480/1920 -> 25%", abs(s["obszarX1"] - 25.0) < 0.01, s["obszarX1"])
check("1440/1920 -> 75%", abs(s["obszarX2"] - 75.0) < 0.01, s["obszarX2"])
check("108/1080 -> 10%", abs(s["obszarY1"] - 10.0) < 0.01, s["obszarY1"])
check("972/1080 -> 90%", abs(s["obszarY2"] - 90.0) < 0.01, s["obszarY2"])
check("obszar wlasny", s["obszar"] == "wlasny", s["obszar"])
check("rozdzielczosc planszy z pliku", (cfg["zrzuty"][0]["w"], cfg["zrzuty"][0]["h"]) == (1920, 1080),
      cfg["zrzuty"][0])
check("konfiguracja zapisana na dysk", len(zapisy) == 1, len(zapisy))

# --- 2. siatka dostaje poziomyMax:1 i zachowuje kolejnosc wierszami ---------
check("siatka 4x4 zapisana", s["siatka"] == [4, 4], s["siatka"])
check("siatka nie dzieli sie dalej", s["poziomyMax"] == 1, s["poziomyMax"])
check("kolejnosc wierszami", s["cwiartkiKolejnosc"] == "wiersze", s["cwiartkiKolejnosc"])
check("ostrzezenie o poziomyMax padlo",
      any("levels" in w for w in out.get("warnings") or []), out.get("warnings"))

# --- 3. procenty podane wprost ida bez przeliczania -------------------------
zapisy = []
d2, ctx2 = make_ctx(zapisy)
call(ctx2, {"views": [{"name": "Opcje", "width": 1920, "height": 1080, "scanners": [
    {"name": "Lista", "mode": "pasy", "axis": "Y", "passes": 1, "bandY": 60,
     "area": {"unit": "percent", "x1": 30, "y1": 20, "x2": 70, "y2": 80}}]}]})
s2 = d2.scan.get_config()["sekcje"][0]
check("procenty bez przeliczania", (s2["obszarX1"], s2["obszarY2"]) == (30.0, 80.0),
      (s2["obszarX1"], s2["obszarY2"]))
check("jedna os zapisana", s2["kolejnosc"] == "Y", s2["kolejnosc"])
check("jeden przebieg", s2["przebiegi"] == 1, s2["przebiegi"])
check("pasmo z narzedzia", s2["pasmoY"] == 60, s2["pasmoY"])

# --- 4. bez rozdzielczosci: piksele + ostrzezenie, nie ciche zgadywanie -----
zapisy = []
d3, ctx3 = make_ctx(zapisy)
out3 = call(ctx3, {"views": [{"name": "Grupa bez zrzutu", "scanners": [
    {"name": "Pasek", "area": {"unit": "px", "x1": 0, "y1": 900, "x2": 1920, "y2": 1080}}]}]})
s3 = d3.scan.get_config()["sekcje"][0]
check("bez rozdzielczosci zostaja piksele", s3["obszarJednostka"] == "piksele", s3["obszarJednostka"])
check("piksele niezmienione", (s3["obszarX2"], s3["obszarY1"]) == (1920.0, 900.0),
      (s3["obszarX2"], s3["obszarY1"]))
check("ostrzezenie o braku rozdzielczosci",
      any("PIXELS" in w for w in out3.get("warnings") or []), out3.get("warnings"))
check("plansza bez obrazka to grupa", not d3.scan.get_config()["zrzuty"][0]["plik"],
      d3.scan.get_config()["zrzuty"][0])

# --- 5. kazdy skaner ladvuje na SWOJEJ planszy ------------------------------
zapisy = []
d4, ctx4 = make_ctx(zapisy)
call(ctx4, {"views": [
    {"name": "Menu", "width": 1920, "height": 1080, "scanners": [
        {"name": "Przyciski menu", "mode": "pasy", "axis": "Y",
         "area": {"unit": "px", "x1": 700, "y1": 300, "x2": 1200, "y2": 800}}]},
    {"name": "Plansza gry", "width": 1920, "height": 1080, "scanners": [
        {"name": "Zetony", "mode": "cwiartki", "grid": [4, 4],
         "area": {"unit": "px", "x1": 480, "y1": 108, "x2": 1440, "y2": 972}},
        {"name": "Pasek akcji", "mode": "pasy", "axis": "X",
         "area": {"unit": "px", "x1": 0, "y1": 960, "x2": 1920, "y2": 1080}}]},
]})
cfg4 = d4.scan.get_config()
nazwy = [s["nazwa"] for s in cfg4["sekcje"]]
check("trzy skanery", nazwy == ["Przyciski menu", "Zetony", "Pasek akcji"], nazwy)
check("dwie plansze", [z["nazwa"] for z in cfg4["zrzuty"]] == ["Menu", "Plansza gry"],
      [z["nazwa"] for z in cfg4["zrzuty"]])
check("Menu ma tylko swoj skaner", cfg4["zrzuty"][0]["sekcje"] == [1], cfg4["zrzuty"][0]["sekcje"])
check("Plansza gry ma swoje dwa", cfg4["zrzuty"][1]["sekcje"] == [2, 3], cfg4["zrzuty"][1]["sekcje"])
lay = mcp._scan_layout_out(cfg4)
check("layout opowiada plansze skanerami",
      lay["views"][1]["scanners"] == ["Zetony", "Pasek akcji"], lay["views"][1])
check("layout nie zglasza sierot", "onNoView" not in lay, lay.get("onNoView"))

# --- 6. drugie wywolanie EDYTUJE, nie dubluje ------------------------------
call(ctx4, {"views": [{"name": "Plansza gry", "width": 1920, "height": 1080, "scanners": [
    {"name": "Zetony", "speed": 420}]}]})
cfg5 = d4.scan.get_config()
check("bez duplikatu planszy", len(cfg5["zrzuty"]) == 2, [z["nazwa"] for z in cfg5["zrzuty"]])
check("bez duplikatu skanera", len(cfg5["sekcje"]) == 3, [s["nazwa"] for s in cfg5["sekcje"]])
zet = next(s for s in cfg5["sekcje"] if s["nazwa"] == "Zetony")
check("predkosc podmieniona", zet["predkosc"] == 420, zet["predkosc"])
check("obszar z pierwszego wywolania zostal", abs(zet["obszarX1"] - 25.0) < 0.01, zet["obszarX1"])

# --- 7. replace kasuje to, czego nie wymieniono ----------------------------
call(ctx4, {"replace": True, "views": [{"name": "Plansza gry", "width": 1920, "height": 1080,
                                        "scanners": [{"name": "Zetony"}]}]})
cfg6 = d4.scan.get_config()
check("replace zostawil jedna plansze", [z["nazwa"] for z in cfg6["zrzuty"]] == ["Plansza gry"],
      [z["nazwa"] for z in cfg6["zrzuty"]])
check("replace zostawil jeden skaner", [s["nazwa"] for s in cfg6["sekcje"]] == ["Zetony"],
      [s["nazwa"] for s in cfg6["sekcje"]])
check("przypisanie przezylo przenumerowanie", cfg6["zrzuty"][0]["sekcje"] == [1],
      cfg6["zrzuty"][0]["sekcje"])

# --- 8. pulpit testowy (plansza zerowa) ------------------------------------
call(ctx4, {"testDesktop": {"width": 2560, "height": 1440},
            "views": [{"name": "Plansza gry", "scanners": []}]})
cfg7 = d4.scan.get_config()
check("rozmiar pulpitu testowego", (cfg7["szablonW"], cfg7["szablonH"]) == (2560, 1440),
      (cfg7["szablonW"], cfg7["szablonH"]))

# --- 9. POWOD ISTNIENIA NARZEDZIA: `set_module_config` spisu NIE przyjmuje --
# Pokretla jada z opoznieniem, wiec zalegly pakiet niesie spis SPRZED dodania planszy. Ta sama
# bramka stoi na `POST /scan` od 13.09; tu pilnujemy, zeby droga MCP nie byla dziura obok niej.
d8, ctx8 = make_ctx([])
call(ctx8, {"views": [{"name": "Jedyna", "scanners": [{"name": "Skaner A"}]}]})
podrobka = dict(d8.scan.get_config())
podrobka["sekcje"] = list(podrobka["sekcje"]) + [dict(podrobka["sekcje"][0], nazwa="Przemycony")]
podrobka["zrzuty"] = list(podrobka["zrzuty"]) + [{"plik": "", "nazwa": "Przemycona", "sekcje": []}]
podrobka["predkosc"] = 333
out8 = mcp._t_set_module_config(ctx8, {"module": "scan", "config": podrobka})
po = d8.scan.get_config()
check("set_module_config nie doklada skanera", [s["nazwa"] for s in po["sekcje"]] == ["Skaner A"],
      [s["nazwa"] for s in po["sekcje"]])
check("set_module_config nie doklada planszy", [z["nazwa"] for z in po["zrzuty"]] == ["Jedyna"],
      [z["nazwa"] for z in po["zrzuty"]])
check("ale pokretlo z tego samego pakietu wchodzi", po["predkosc"] == 333, po["predkosc"])
check("i mowi, ze spis pominal",
      any("set_scanner_layout" in w for w in out8.get("warnings") or []), out8.get("warnings"))

# --- 10. odmowy sa czytelne, a nie ciche ------------------------------------
for zly, czego in (
    ({"views": []}, "pusta lista plansz"),
    ({"views": [{"name": ""}]}, "plansza bez nazwy"),
    ({"views": [{"name": "X", "scanners": [{"name": ""}]}]}, "skaner bez nazwy"),
    ({"views": [{"name": "X", "scanners": [
        {"name": "S", "area": {"x1": 10, "y1": 10, "x2": 10, "y2": 90}}]}]}, "prostokat bez szerokosci"),
    ({"views": [{"name": "X", "scanners": [
        {"name": "S", "area": {"x1": 10, "y1": 10, "x2": 90}}]}]}, "prostokat bez rogu"),
):
    d9, ctx9 = make_ctx([])
    try:
        call(ctx9, zly)
        check("odmowa: " + czego, False, "przeszlo bez bledu")
    except mcp.ToolError as e:
        check("odmowa: " + czego, bool(str(e)), str(e))

# --- 11. ostrzezenia o tym, czego narzedzie NIE robi ------------------------
d10, ctx10 = make_ctx([])
out10 = call(ctx10, {"views": [{"name": "A", "scanners": [{"name": "S1"}, {"name": "S2"}]}]})
ostrz = " | ".join(out10.get("warnings") or [])
check("mowi o braku scan:sygnal", "scan:sygnal" in ostrz, ostrz)
check("mowi o braku scan:stop", "scan:stop" in ostrz, ostrz)
check("mowi o braku scan:sekcja przy dwoch skanerach", "scan:sekcja" in ostrz, ostrz)
check("mowi, ze modul zostaje wylaczony", "still off" in ostrz, ostrz)
check("nie wlacza modulu sam", not d10.scan.get_config()["enabled"])

d11, ctx11 = make_ctx([])
d11.trig.rules = [{"keySpec": "scan:sygnal", "enabled": True},
                  {"keySpec": "scan:stop", "enabled": True},
                  {"keySpec": "scan:sekcja=nast", "enabled": True}]
out11 = call(ctx11, {"views": [{"name": "A", "scanners": [{"name": "S1"}, {"name": "S2"}]}]})
ostrz11 = " | ".join(out11.get("warnings") or [])
check("z regulami nie marudzi o sygnal", "scan:sygnal" not in ostrz11, ostrz11)
check("z regulami nie marudzi o sekcje", "scan:sekcja" not in ostrz11, ostrz11)

# --- 12. narzedzie jest wystawione i opisane -------------------------------
t = next((x for x in mcp.TOOLS if x["name"] == "set_scanner_layout"), None)
check("narzedzie w TOOLS", t is not None)
check("narzedzie w tablicy wywolan", mcp._IMPL.get("set_scanner_layout") is not None)
check("opis odsyla do reference.scan", t and "fromAScreenshot" in t["description"], "")
ref = mcp.MAPPING_REFERENCE["scan"]
for k in ("areaWhereItWorks", "severalScanners", "viewsOfTheGame", "fromAScreenshot"):
    check("reference.scan." + k, k in ref)
check("przepis ma kroki", len(ref["fromAScreenshot"]["steps"]) >= 4)
check("przepis mapuje ksztalt na tryb", len(ref["fromAScreenshot"]["modeFromShape"]) >= 3)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
