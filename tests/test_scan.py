"""SKANER EKRANU - modul serwera (2026-09-11).

Skaner to wybor jednym sygnalem: pasek jedzie sam, czlowiek go zatrzymuje, przeciecie dwoch
paskow jest punktem, w ktory pada klikniecie. Silnik siedzi w przegladarce (patrz komentarz nad
ScanModule), wiec po stronie serwera sprawdzamy dokladnie trzy rzeczy:

  1. SANITYZACJA - konfiguracja z panelu jest przycinana do zakresow, a slowa spoza listy wracaja
     do domyslnych. Panel przerysowuje sie z ODPOWIEDZI, wiec klamstwo tutaj zobaczy uzytkownik.
  2. ROUTING `scan:` - regula Mapowania z takim specem NIE naciska klawisza, tylko mowi modulowi
     "teraz". To jest cala roznica miedzy sygnalem a wyjsciem.
  3. BRAMKA - `scan:` slucha wlacznika modulu Skaner (nie grupy Mapowanie), a `scan:stop`
     przechodzi zawsze. Dla kogos, kto steruje komputerem jednym przelacznikiem, skaner jest
     jedyna droga do komputera - wylacznik, ktory go odcina, musi byc jeden i swiadomy.

Bez znakow spoza ASCII w print() - konsola cp1250.
"""
import base64
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402

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
    def __init__(self):
        self.events = []

    def now(self):
        return 1.0

    def publish(self, ev):
        self.events.append(ev)


class KeysStub:
    def __init__(self):
        self.taps = []
        self.downs = []
        self.ups = []

    def tap(self, spec):
        self.taps.append(spec)
        return True

    def down(self, spec):
        self.downs.append(spec)
        return True

    def up(self, spec):
        self.ups.append(spec)
        return True


class PadStub:
    def __init__(self):
        self.calls = []

    def tap(self, spec):
        self.calls.append(("tap", spec))
        return True

    def press(self, spec):
        self.calls.append(("press", spec))
        return True

    def release(self, spec):
        self.calls.append(("release", spec))
        return True


print("-- rozpoznanie specow")
check("scan: jest rozpoznawany", rf.spec_is_scan("scan:sygnal"))
check("wielkosc liter bez znaczenia", rf.spec_is_scan("SCAN:Cofnij"))
check("klawisz nie jest sygnalem skanera", not rf.spec_is_scan("ctrl+c"))
check("pad nie jest sygnalem skanera", not rf.spec_is_scan("pad:a"))
check("pusty spec nie jest sygnalem", not rf.spec_is_scan(""))

print("-- sanityzacja konfiguracji")
d = rf.ScanModule.sanitize({})
check("puste daje komplet domyslnych", set(d) == set(rf.ScanModule.DEFAULTS), sorted(set(d) ^ set(rf.ScanModule.DEFAULTS)))
check("domyslnie wylaczony", d["enabled"] is False)
check("domyslnie zawraca", d["kierunek"] == "wahadlo")
check("domyslnie dzwiek wylaczony", d["dzwiek"] is False)

d = rf.ScanModule.sanitize({"predkosc": 99999, "pasmoY": 0, "wyprzedzenie": -9999, "nawroty": 999})
check("predkosc przycieta z gory", d["predkosc"] == 6000, d["predkosc"])
check("pasmo przyciete z dolu", d["pasmoY"] == 8, d["pasmoY"])
check("wyprzedzenie przyciete", d["wyprzedzenie"] == -1000, d["wyprzedzenie"])
check("nawroty przyciete", d["nawroty"] == 20, d["nawroty"])

d = rf.ScanModule.sanitize({"tryb": "cokolwiek", "ruch": "galop", "kolejnosc": "Z"})
check("nieznany tryb wraca do domyslnego", d["tryb"] == "pasy", d["tryb"])
# „skokowy", bo od 2026-09-11 domyslny jest zestaw OSTROZNY (domyslnie aktywny
# profil powolny). Test pyta o to, czy smiec wraca DO DOMYSLNEJ — wiec czyta
# domyslna z modulu, zamiast powtarzac ja literalem, ktory rozjedzie sie przy nastepnej zmianie.
check("nieznany ruch wraca do domyslnego", d["ruch"] == rf.ScanModule.DEFAULTS["ruch"], d["ruch"])
check("domyslny profil jest wolny (zestaw Ostrozny)",
      rf.ScanModule.DEFAULTS["ruch"] == "skokowy" and rf.ScanModule.DEFAULTS["czasKroku"] >= 900
      and rf.ScanModule.DEFAULTS["opoznienieStartu"] >= 1000,
      (rf.ScanModule.DEFAULTS["ruch"], rf.ScanModule.DEFAULTS["czasKroku"],
       rf.ScanModule.DEFAULTS["opoznienieStartu"]))
check("nieznana kolejnosc wraca do domyslnej", d["kolejnosc"] == "Y-X", d["kolejnosc"])

d = rf.ScanModule.sanitize({"siatka": [99, 0]})
check("siatka przycieta do 1..6", d["siatka"] == [6, 1], d["siatka"])
d = rf.ScanModule.sanitize({"siatka": "bzdura"})
check("zepsuta siatka wraca do 2x2", d["siatka"] == [2, 2], d["siatka"])

d = rf.ScanModule.sanitize({"menuPozycje": ["lewy", "lewy", "usun", "", None]})
check("menu bez powtorek i pustych", d["menuPozycje"] == ["lewy", "usun"], d["menuPozycje"])
d = rf.ScanModule.sanitize({"menuPozycje": []})
check("puste menu wraca do domyslnego", len(d["menuPozycje"]) > 1, d["menuPozycje"])

d = rf.ScanModule.sanitize({"przyciemnienie": 5, "glosnosc": -3, "mnoznikDokladny": 9})
check("ulamki przyciete", d["przyciemnienie"] == 0.95 and d["glosnosc"] == 0.0 and d["mnoznikDokladny"] == 1.0,
      (d["przyciemnienie"], d["glosnosc"], d["mnoznikDokladny"]))
check("ulamki zostaja ulamkami", isinstance(d["przyciemnienie"], float))
check("liczby calkowite zostaja calkowite", isinstance(rf.ScanModule.sanitize({})["predkosc"], int))

d = rf.ScanModule.sanitize({"nieznanyKlucz": 7})
check("nieznany klucz nie wchodzi do konfiguracji", "nieznanyKlucz" not in d)

print("-- wymiary paska w kazdym stanie (zgloszenie 11.09)")
d = rf.ScanModule.sanitize({})
for k in ("pasmoY", "pasmoX", "pasmoDokladnyY", "pasmoDokladnyX", "pokrycieY", "pokrycieX"):
    check("jest %s" % k, k in d, sorted(d))
check("domyslnie pasek pokrywa caly obszar", d["pokrycieY"] == 100 and d["pokrycieX"] == 100)
d = rf.ScanModule.sanitize({"pokrycieY": 999, "pokrycieX": 0, "pasmoDokladnyY": 0, "pasmoDokladnyX": 900})
check("pokrycie przyciete z gory do 100", d["pokrycieY"] == 100, d["pokrycieY"])
check("pokrycie przyciete z dolu do 5", d["pokrycieX"] == 5, d["pokrycieX"])
check("dokladna linia ma minimum 2 px", d["pasmoDokladnyY"] == 2, d["pasmoDokladnyY"])
check("dokladna linia ma sufit 60 px", d["pasmoDokladnyX"] == 60, d["pasmoDokladnyX"])
check("stara nazwa `pasmoDokladne` znikla", "pasmoDokladne" not in d)

print("-- kolor i krycie")
d = rf.ScanModule.sanitize({})
check("kolory sa w domyslnych", d["kolorY"] == "#ec1a83" and d["kolorX"] == "#6cb33f" and d["kolorDokladny"] == "#eaa32b",
      (d["kolorY"], d["kolorX"], d["kolorDokladny"]))
check("krycie domyslnie 26%", abs(d["kryciePasma"] - 0.26) < 1e-9, d["kryciePasma"])
d = rf.ScanModule.sanitize({"kolorY": "#00FF00"})
check("poprawny kolor przechodzi (male litery)", d["kolorY"] == "#00ff00", d["kolorY"])
for zly in ("czerwony", "#gggggg", "#fff", "", None, 7, "#00ff00; drop"):
    d = rf.ScanModule.sanitize({"kolorX": zly})
    check("zly kolor wraca do domyslnego (%r)" % (zly,), d["kolorX"] == "#6cb33f", d["kolorX"])
d = rf.ScanModule.sanitize({"kryciePasma": 5})
check("krycie przyciete do 1", d["kryciePasma"] == 1.0, d["kryciePasma"])
d = rf.ScanModule.sanitize({"kryciePasma": -1})
check("krycie przyciete do 0", d["kryciePasma"] == 0.0, d["kryciePasma"])
check("krycie zostaje ulamkiem", isinstance(rf.ScanModule.sanitize({"kryciePasma": 0.5})["kryciePasma"], float))

print("-- sygnaly")
bus = BusStub()
mod = rf.ScanModule(bus, "d0")
check("sygnal przechodzi", mod.signal("sygnal") is True)
check("sygnal trafil na strumien", bus.events and bus.events[-1]["t"] == "scan", bus.events[-1:])
check("sygnal niesie kapsla", bus.events[-1]["dev"] == "d0")
check("sygnal niesie rodzaj", bus.events[-1]["co"] == "sygnal")
check("cofniecie przechodzi", mod.signal("cofnij") is True)
check("stop przechodzi", mod.signal("stop") is True)
ile = len(bus.events)
check("nieznany sygnal odrzucony", mod.signal("zatancz") is False)
check("odrzucony sygnal nie trafia na strumien", len(bus.events) == ile)

print("-- routing przez wyjscie kapsla")
keys, pad = KeysStub(), PadStub()
bus2 = BusStub()
mod2 = rf.ScanModule(bus2, "d1")
out = rf.SlotOutput(keys, pad, mod2)
out.tap("scan:sygnal")
check("scan: nie idzie do klawiatury", keys.taps == [], keys.taps)
check("scan: nie idzie do pada", pad.calls == [], pad.calls)
check("scan: trafil do modulu", len(bus2.events) == 1 and bus2.events[0]["co"] == "sygnal", bus2.events)
out.down("scan:cofnij")
check("przytrzymanie tez wysyla sygnal", len(bus2.events) == 2 and bus2.events[1]["co"] == "cofnij", bus2.events)
out.up("scan:cofnij")
check("puszczenie jest ciche", len(bus2.events) == 2, bus2.events)
check("puszczenie nie idzie do klawiatury", keys.ups == [], keys.ups)
check("puszczenie zwraca prawde", out.up("scan:sygnal") is True)
out.tap("ctrl+c")
check("zwykly klawisz dalej dziala", keys.taps == ["ctrl+c"], keys.taps)
out.tap("pad:a")
check("pad dalej dziala", pad.calls == [("tap", "pad:a")], pad.calls)
brak = rf.SlotOutput(keys, pad, None)
check("bez modulu scan: nie wybucha", brak.tap("scan:sygnal") is False)

print("-- bramka: wlacznik modulu, nie grupa Mapowanie")
trig = rf.TriggerEngine(BusStub(), emitter=None, armed=True)
trig.enabled = False              # grupa Mapowanie WYLACZONA
wlaczony = {"v": True}
trig.scan_on = lambda: wlaczony["v"]
check("sygnal przechodzi mimo wylaczonego Mapowania", trig._gate_for("scan:sygnal") is True)
wlaczony["v"] = False
check("wylaczony modul zatrzymuje sygnal", trig._gate_for("scan:sygnal") is False)
check("stop przechodzi nawet przy wylaczonym module", trig._gate_for("scan:stop") is True)
check("klawisz dalej sluchaa Mapowania", trig._gate_for("ctrl+c") is False)
trig.scan_on = None
check("bez wpietego wlacznika spada na Mapowanie", trig._gate_for("scan:sygnal") is False)
trig.enabled = True
check("…i wtedy Mapowanie decyduje", trig._gate_for("scan:sygnal") is True)

print("-- zapis i odczyt")
_stary = rf.SETTINGS_DIR
try:
    tmp = tempfile.mkdtemp(prefix="rf-scan-test-")
    rf.SETTINGS_DIR = tmp
    cfg = rf.ScanModule.sanitize({"predkosc": 1234, "tryb": "cwiartki", "enabled": True})
    rf.save_scan(cfg, "d0")
    check("plik lezy w Settings", os.path.isfile(os.path.join(tmp, "ribbitflip_scan.json")))
    wczytane = rf.load_scan("d0")
    check("odczyt zwraca to samo", wczytane.get("predkosc") == 1234 and wczytane.get("tryb") == "cwiartki", wczytane.get("tryb"))
    rf.save_scan(cfg, "d2")
    check("drugi kapsel ma wlasny katalog", os.path.isfile(os.path.join(tmp, "d2", "ribbitflip_scan.json")))
    check("brak pliku to pusta konfiguracja, nie wyjatek", rf.load_scan("d7") == {})
    with open(os.path.join(tmp, "ribbitflip_scan.json"), "w", encoding="utf-8") as f:
        f.write("to nie jest JSON")
    check("zepsuty plik to pusta konfiguracja, nie wyjatek", rf.load_scan("d0") == {})
finally:
    rf.SETTINGS_DIR = _stary

print("-- konfiguracja modulu w calosci")
mod3 = rf.ScanModule(BusStub(), "d0")
check("na starcie wylaczony", mod3.enabled is False)
mod3.set_config({"enabled": True, "predkosc": 900})
check("wlaczenie widac", mod3.enabled is True)
check("ustawienie zapamietane", mod3.get_config()["predkosc"] == 900)
check("get_config zwraca kopie", (mod3.get_config() is not mod3.cfg))
mod3.set_enabled(False)
check("set_enabled gasi modul", mod3.enabled is False)
check("…nie ruszajac reszty", mod3.get_config()["predkosc"] == 900)


# ---------------------------------------------------------------------------
#  ZESTAWY Z APLIKACJI W BIBLIOTECE (11.09)
#  Zasiew jest JEDNORAZOWY, a jego znacznik okazal sie tym, co najlatwiej zepsuc po cichu:
#  pierwsza wersja pisala go `datetime.now()` bez importu, wiec zestawy ladowaly na dysku,
#  wyjatek szedl w `except`, a flaga zostawala falszem — czyli skasowany zestaw wracalby
#  przy kazdym wejsciu w zakladke. Test pyta WPROST o flage, nie o same pliki.
# ---------------------------------------------------------------------------
print("-- zasiew zestawow z aplikacji")
_stary_dir, _stary_mark = rf.SCAN_PRESET_DIR, rf.SCAN_SEED_MARK
_tmp = tempfile.mkdtemp(prefix="rf-scan-seed-")
rf.SCAN_PRESET_DIR = os.path.join(_tmp, "ScanPresets")
rf.SCAN_SEED_MARK = os.path.join(_tmp, "seeded.json")
try:
    ZESTAWY = [{"name": "Ostrozny", "desc": "wolno", "config": {"ruch": "skokowy", "czasKroku": 900}},
               {"name": "Szybki", "desc": "szybko", "config": {"ruch": "plynny", "predkosc": 1500}}]
    check("na starcie nic nie jest zasiane", rf.scan_presets_seeded() is False)
    ile, items, _ = rf.seed_scan_presets(ZESTAWY)
    check("zasiew dodaje wszystkie zestawy", ile == 2, ile)
    check("znacznik zasiewu zapisany", rf.scan_presets_seeded() is True)
    check("zestawy sa na liscie", len(items) == 2, [i["name"] for i in items])
    check("zestaw niesie swoja konfiguracje",
          items[0]["config"].get("ruch") in ("skokowy", "plynny"), items[0]["config"].get("ruch"))
    check("preset nie niesie wlacznika", "enabled" not in items[0]["config"])
    ile2, _, _ = rf.seed_scan_presets(ZESTAWY)
    check("drugi zasiew nic nie robi", ile2 == 0, ile2)
    rf.delete_scan_preset("Szybki")
    ile3, items3, _ = rf.seed_scan_presets(ZESTAWY)
    check("skasowany zestaw NIE wraca sam", ile3 == 0 and len(items3) == 1, len(items3))
    ile4, items4, _ = rf.seed_scan_presets(ZESTAWY, restore=True)
    check("przywroc oddaje brakujacy", ile4 == 1 and len(items4) == 2, (ile4, len(items4)))
    rf.save_scan_preset("Ostrozny", {"ruch": "plynny", "predkosc": 999}, "moja przerobka")
    ile5, items5, _ = rf.seed_scan_presets(ZESTAWY, restore=True)
    mine = [i for i in items5 if i["name"] == "Ostrozny"][0]
    check("przywroc nie nadpisuje cudzej przerobki",
          ile5 == 0 and mine["config"].get("predkosc") == 999, (ile5, mine["config"].get("predkosc")))
finally:
    rf.SCAN_PRESET_DIR, rf.SCAN_SEED_MARK = _stary_dir, _stary_mark
    shutil.rmtree(_tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
#  ZRZUT EKRANU GRY POD PODGLADEM (14.09)
#  W konfiguracji lezy SAMA NAZWA PLIKU, a plik w Settings/ScanTla. Nazwa przychodzi z panelu,
#  wiec moze byc czymkolwiek - i to jest jedyne miejsce, ktore decyduje, co jest nazwa zrzutu.
#  Gdyby przepuscila sciezke, trasa /scan/tlo czytalaby dowolny plik z dysku.
# ---------------------------------------------------------------------------
print("-- zrzut ekranu pod podgladem")


def _png(w=8, h=6):
    """Najmniejszy prawdziwy PNG - do sprawdzenia podpisu pliku, nie obrazu."""
    import struct
    import zlib

    def kawalek(typ, dane):
        c = typ + dane
        return struct.pack(">I", len(dane)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    surowe = b"".join(b"\x00" + b"\x10\x20\x30" * w for _ in range(h))
    return (b"\x89PNG\r\n\x1a\n"
            + kawalek(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + kawalek(b"IDAT", zlib.compress(surowe)) + kawalek(b"IEND", b""))


check("domyslnie bez zrzutu", rf.ScanModule.sanitize({})["tlo"] == "")
check("nazwa zrzutu przechodzi", rf.ScanModule.sanitize({"tlo": "sol-cesto-ab12cd34.jpg"})["tlo"]
      == "sol-cesto-ab12cd34.jpg")
for zly in ("../ribbitflip_rules.json", "..\\ribbitflip_rules.json", "C:/Windows/win.ini",
            "plik.exe", "plik.jpg.exe", "", None, 17, "katalog/plik.jpg", ".jpg",
            "a" * 90 + ".jpg"):
    check("odrzucone: %r" % (zly,), rf.ScanModule.sanitize({"tlo": zly})["tlo"] == "",
          rf.ScanModule.sanitize({"tlo": zly})["tlo"])
# Plik z INNEJ maszyny (preset od kogos) ma prawo zostac w konfiguracji: panel powie o tym wprost,
# a ciche skasowanie nazwy zabraloby ja z presetu przy pierwszym odczycie.
check("nieistniejacy plik NIE jest kasowany z konfiguracji",
      rf.ScanModule.sanitize({"tlo": "czegos-takiego-tu-nie-ma-00000000.jpg"})["tlo"]
      == "czegos-takiego-tu-nie-ma-00000000.jpg")

_stare_tla = rf.SCAN_TLA_DIR
_tmp2 = tempfile.mkdtemp(prefix="rf-scan-tla-")
rf.SCAN_TLA_DIR = _tmp2
try:
    import base64 as _b64
    dane = "data:image/png;base64," + _b64.b64encode(_png()).decode()
    nazwa, blad = rf.scan_tlo_zapisz(dane, "Sol Cesto — plansza.png")
    check("zapis zrzutu sie udaje", bool(nazwa) and not blad, (nazwa, blad))
    check("nazwa bez ogonkow i bez powtorzonego rozszerzenia",
          nazwa.startswith("sol-cesto-plansza-") and nazwa.endswith(".png"), nazwa)
    check("zapisana nazwa przechodzi sanityzacje", rf.scan_tlo_nazwa(nazwa) == nazwa)
    check("sciezka wskazuje na istniejacy plik", rf.scan_tlo_sciezka(nazwa) is not None)
    nazwa2, _ = rf.scan_tlo_zapisz(dane, "zupelnie inna nazwa.png")
    check("ten sam obraz to ten sam plik (skrot w nazwie)",
          nazwa2.endswith(nazwa[-13:]) and len(os.listdir(_tmp2)) == 2, os.listdir(_tmp2))
    check("sciezka spoza katalogu nie istnieje", rf.scan_tlo_sciezka("../ribbitflip_rules.json") is None)
    # Podpis pliku, nie naglowek: „data:image/png" w tresci nic nie kosztuje podrobic.
    _, blad2 = rf.scan_tlo_zapisz("data:image/png;base64," + _b64.b64encode(b"to nie png").decode())
    check("tresc bez podpisu PNG odrzucona", bool(blad2), blad2)
    _, blad3 = rf.scan_tlo_zapisz("data:text/html;base64,AAAA")
    check("nie-obraz odrzucony", bool(blad3), blad3)
    _, blad4 = rf.scan_tlo_zapisz("data:image/png;base64," + _b64.b64encode(
        b"\x89PNG\r\n\x1a\n" + b"x" * (rf.SCAN_TLO_MAX + 10)).decode())
    check("za duzy zrzut odrzucony", bool(blad4), blad4)
finally:
    rf.SCAN_TLA_DIR = _stare_tla
    shutil.rmtree(_tmp2, ignore_errors=True)

# ---------------------------------------------------------------------------
#  OKNO NAD PULPITEM: DWA TRYBY (14.09)
#  „skan" klika naprawde, „podglad" tylko rysuje obrys obszaru. Trybu nie da sie przelaczyc
#  w locie - strona czyta go z adresu przy starcie - wiec `open` musi umiec zamknac i otworzyc
#  okno od nowa. Tu sprawdzamy sam kontrakt stanu; uruchomienia przegladarki nie testujemy.
# ---------------------------------------------------------------------------
print("-- okno nad pulpitem: stan i tryb")


class ProcStub:
    """Proces przegladarki: `zyje=False` = zakonczony (to jest przypadek z przekazanym profilem)."""

    def __init__(self, zyje=True):
        self.zyje = zyje
        self.ubity = False

    def poll(self):
        return None if self.zyje else 0

    def terminate(self):
        self.ubity = True
        self.zyje = False

    def wait(self, timeout=None):
        return 0


_okno = rf.ScanOverlay()
st = _okno.stan()
check("zamkniete okno nie ma trybu",
      # `ekran` (26.09) = monitor, na ktorym stoi okno przy kilku ekranach; zamkniete nie stoi nigdzie.
      st == {"open": False, "tryb": "", "dev": "", "widok": None, "korekt": 0, "ekran": "",
             "klik": None}, st)
# `klik` = prostokat oczka schowanego edytora obszaru (16.09). Zamkniete okno nie ma zadnego:
# mysz bierze cale okno, bo edytor zawsze wstaje odsloniety.
check("oczko: prostokat wchodzi", _okno.set_klik({"x": 800, "y": 1000, "w": 46, "h": 46}) is True
      and _okno.stan()["klik"] == [800, 1000, 46, 46], _okno.stan())
check("oczko: `null` oddaje mysz calemu oknu",
      _okno.set_klik(None) is True and _okno.stan()["klik"] is None, _okno.stan())
check("oczko: prostokat bez rozmiaru odrzucony",
      _okno.set_klik({"x": 1, "y": 1, "w": 0, "h": 9}) is False and _okno.stan()["klik"] is None)
check("oczko: smiec zamiast liczb odrzucony",
      _okno.set_klik({"x": "abc", "y": 1, "w": 4, "h": 4}) is False and _okno.stan()["klik"] is None)

# ---------------------------------------------------------------------------
#  OCZKO: KIEDY OKNO BIERZE MYSZ, A KIEDY JA ODDAJE (16.09)
#
#  Sedno zgloszenia „oczko «ukryj»" nie jest w wygladzie, tylko w KLIKNIECIACH: schowany edytor
#  ma przepuszczac mysz do pulpitu wszedzie poza oczkiem. Robi to `_pilnuj_myszy`, chodzac za
#  kursorem i przestawiajac WS_EX_TRANSPARENT — a tego NIE DA SIE sprawdzic na zywym oknie bez
#  odebrania czlowiekowi przy klawiaturze myszy na calym ekranie. Sprawdzamy wiec sama arytmetyke
#  na atrapach `user32`: to ona decyduje, czy oczko jest twarde, i to w niej mozna sie pomylic.
class _CtypesStub:
    @staticmethod
    def byref(x):
        return x


class _WtStub:
    class POINT:
        def __init__(self):
            self.x = 0
            self.y = 0


class _U32Stub:
    """Tyle `user32`, ile widzi `_pilnuj_myszy`: kursor i styl rozszerzony okna."""

    def __init__(self, x, y, ex=0):
        self.poz = (x, y)
        self.ex = ex
        self.zapisy = []

    def GetCursorPos(self, p):
        p.x, p.y = self.poz
        return True

    def GetWindowLongW(self, hwnd, idx):
        return self.ex

    def SetWindowLongW(self, hwnd, idx, v):
        self.ex = v
        self.zapisy.append(v)
        return 0


PRZEZR = rf.ScanOverlay.WS_EX_TRANSPARENT


def _pilnuj(x, y, rect, tryb="edycja", ex=0):
    o = rf.ScanOverlay()
    o.tryb = tryb
    o.klik = rect
    u = _U32Stub(x, y, ex)
    czekaj = o._pilnuj_myszy(_CtypesStub, _WtStub, u, 1)
    return czekaj, u


_c, _u = _pilnuj(820, 1020, (800, 1000, 46, 46))
check("oczko: kursor NA oczku - okno bierze mysz", _u.ex & PRZEZR == 0 and _c == 0.08, (_u.ex, _c))
_c, _u = _pilnuj(400, 300, (800, 1000, 46, 46))
check("oczko: kursor obok - klikniecia leca do pulpitu", _u.ex & PRZEZR == PRZEZR and _c == 0.08, (_u.ex, _c))
# Krawedzie: lewy gorny rog NALEZY do oczka, prawy dolny juz nie (polprzedzial, jak wszedzie).
_c, _u = _pilnuj(800, 1000, (800, 1000, 46, 46))
check("oczko: lewy gorny rog jest na oczku", _u.ex & PRZEZR == 0, _u.ex)
_c, _u = _pilnuj(846, 1046, (800, 1000, 46, 46))
check("oczko: piksel za prawym dolnym rogiem juz nie", _u.ex & PRZEZR == PRZEZR, _u.ex)
# Odsloniety edytor: cale okno bierze mysz, nawet jesli poprzedni stan mowil inaczej.
_c, _u = _pilnuj(400, 300, None, ex=PRZEZR)
check("odsloniety edytor zdejmuje przepuszczanie", _u.ex & PRZEZR == 0 and _c == 2.0, (_u.ex, _c))
# Skan i podglad maja WS_EX_TRANSPARENT zalozone raz, przy ostylowaniu — pilnowanie myszy ma
# tam NIE RUSZAC stylu (inaczej pasek skanera zaczalby lapac klikniecia).
_c, _u = _pilnuj(400, 300, (800, 1000, 46, 46), tryb="skan", ex=PRZEZR)
check("skan: pilnowanie myszy nie dotyka stylu", _u.zapisy == [] and _c == 2.0, (_u.zapisy, _c))
_okno.proc, _okno.tryb, _okno.dev = ProcStub(), "podglad", "d1"
st = _okno.stan()
check("otwarte okno mowi tryb i kapsel",
      st["open"] and st["tryb"] == "podglad" and st["dev"] == "d1", st)
check("zamkniecie czysci tryb", _okno.close() is True and _okno.stan()["tryb"] == "")

# ---------------------------------------------------------------------------
#  OKNO, KTOREGO PROCESU NIE MAMY - objaw: nakladka zostawala na ekranie nawet
#  po wylaczeniu procesow i nie dalo sie jej zamknac.
#  Chromium, ktoremu kaze sie uzyc profilu trzymanego przez inna kopie, PRZEKAZUJE jej zadanie
#  i konczy prace. Zmierzone: proces z mark=RFSKAN-...-25498dad w wierszu polecenia, a na ekranie
#  okno o tytule RFSKAN-...-2549e213. Zywa nakladka to zywe OKNO, nie nasz proces - inaczej
#  panel pokazuje "W aplikacji" nad stojacym oknem, a `close()` nie ma czego zamykac.
# ---------------------------------------------------------------------------
print("-- okno nad pulpitem: zyje OKNO, nie proces")
_o2 = rf.ScanOverlay()
_o2.proc, _o2.hwnd, _o2.tryb, _o2.dev = ProcStub(zyje=False), 4242, "skan", "d0"
_o2._zyje_okno = lambda hwnd: hwnd == 4242
check("martwy proces + zywe okno = nakladka STOI", _o2.is_open() is True)
st = _o2.stan()
check("stan mowi prawde o trybie stojacego okna", st["open"] and st["tryb"] == "skan", st)

# Zamkniecie takiego okna: WM_CLOSE (tu nie ma go jak wyslac, wiec zaslepka gasi okno sama)
# i stan wyczyszczony. Bez tego nie dalo sie zgasic nakladki NICZYM.
_zyje = {"tak": True}
_o2._zyje_okno = lambda hwnd: _zyje["tak"]
_o2.hwnd, _o2.proc = 4242, None


def _gasi(*_a):
    _zyje["tak"] = False
    return True


_o2._ubij_wlasciciela = _gasi
check("okno bez naszego procesu daje sie zamknac", _o2.close() is True)
check("po zamknieciu nakladka nie stoi", _o2.is_open() is False and _o2.stan()["tryb"] == "")

# Nic nie stoi i nie ma czego zamiatac - `close()` mowi "nie bylo nic", a nie "zamknieto".
_o3 = rf.ScanOverlay()
_o3._zyje_okno = lambda hwnd: False
_o3.sprzataj_sieroty = lambda port=None: 0
check("zamkniecie pustego okna zwraca False", _o3.close() is False)

# Okno, o ktorym nigdy nie wiedzielismy (przekazany profil): `close()` schodzi do zamiatania
# po przedrostku i mowi, ze cos zgasilo.
_o4 = rf.ScanOverlay()
_o4._zyje_okno = lambda hwnd: False
_zamiecione = []
_o4.sprzataj_sieroty = lambda port=None: (_zamiecione.append(port), 1)[1]
check("brak procesu i uchwytu = zamiatanie po przedrostku",
      _o4.close() is True and len(_zamiecione) == 1, _zamiecione)

# Bramka na czas wstawania okna: proces juz sie skonczyl, tytulu jeszcze nie ma. Bez niej panel
# dostawal w tej szparze "zamkniete" i sam przestawial przelacznik z powrotem.
_o5 = rf.ScanOverlay()
_o5._zyje_okno = lambda hwnd: False
_o5.proc, _o5.szukam, _o5.tryb = ProcStub(zyje=False), True, "podglad"
check("szukanie okna liczy sie jak otwarte", _o5.is_open() is True)
_o5.szukam = False
check("po nieudanym szukaniu nakladka nie stoi", _o5.is_open() is False)

# ---------------------------------------------------------------------------
#  PRZEDROSTEK TYTULU NIESIE PORT - przy --allow-multi na maszynie chodza dwie kopie aplikacji
#  (druga do testow), a zamiatanie po samym "RFSKAN-" gasiloby nakladke tej drugiej.
# ---------------------------------------------------------------------------
#  PASEK TYTULU OKNA NAKLADKI - objaw: nakladka na pulpicie otwierala sie
#  kilkadziesiat pikseli ponizej gornej krawedzi ekranu, bo na gorze stal pasek okna. Przegladarka w trybie --app rysuje swoj pasek tytulu WEWNATRZ obszaru klienta, wiec
#  Windows go nie widzi i mierzy go strona. Serwer podnosi okno o te pikseli i tyle samo dokłada
#  wysokosci - bo skaner liczy klikniecie jako PROCENT okna, a widok nizszy i przesuniety w dol
#  znaczy klik padajacy wyzej, niz widac pasek.
print("-- widok okna nakladki rowno z pulpitem")
_o7 = rf.ScanOverlay()
check("brak liczb odrzucony", _o7.set_widok(None) is False and _o7.widok is None)
check("smiec odrzucony", _o7.set_widok({"x": "a", "y": 0, "w": 1, "h": 2}) is False)
check("pomiar w trakcie zmiany rozmiaru odrzucony",
      _o7.set_widok({"x": 0, "y": 0, "w": 120, "h": 90}) is False and _o7.widok is None)
check("sensowny widok zapisany",
      _o7.set_widok({"x": 0, "y": 35, "w": 1707, "h": 1032}) is True
      and _o7.widok == (0, 35, 1707, 1032))
check("pomiar jest pilny", _o7.widok_nowy is True and _o7._budzik.is_set())
check("ten sam widok nie jest nowina",
      _o7.set_widok({"x": 0, "y": 35, "w": 1707, "h": 1032}) is False)
# Rownosc z luzem: przy 150% zamiana pikseli CSS na wirtualizowane wypada czasem na pol piksela.
check("widok rowny pulpitowi rozpoznany", _o7._widok_rowny((0, 0, 1707, 1067), 0, 0, 1707, 1067))
check("roznica jednego piksela to nadal rownosc",
      _o7._widok_rowny((1, 0, 1707, 1066), 0, 0, 1707, 1067))
check("pasek 35 px to NIE rownosc",
      not _o7._widok_rowny((0, 35, 1707, 1032), 0, 0, 1707, 1067))
check("brak pomiaru to nie rownosc", not _o7._widok_rowny(None, 0, 0, 1707, 1067))


class _Fn:
    """Wywolywalna zaslepka, ktora PRZYJMUJE `argtypes`/`restype`.

    Metoda zwyczajna ich nie przyjmuje ("'method' object has no attribute 'argtypes'"), a kod
    produkcyjny je ustawia i ma to robic: bez `argtypes` uchwyt okna idzie do 64-bitowego API
    jako C `int` i obcina sie w polowie (ta sama pulapka, co przy HWND_TOPMOST)."""

    def __init__(self, fn):
        self._fn = fn

    def __call__(self, *a, **k):
        return self._fn(*a, **k)


class _FakeDll:
    """gdi32 na niby - oddaje uchwyt regionu i notuje, o jaki prostokat poproszono."""

    def __init__(self, dziennik):
        self.dziennik = dziennik
        self.CreateRectRgn = _Fn(self._rgn)

    def _rgn(self, a, b, c, d):
        self.dziennik.append(("rgn", a, b, c, d))
        return 777

    def __getattr__(self, _n):
        return _Fn(lambda *a, **k: None)


class _FakeCtypes:
    def __init__(self, dziennik):
        self._d = dziennik

    def WinDLL(self, _nazwa, **_k):
        return _FakeDll(self._d)

    def byref(self, x):
        return x

    def __getattr__(self, _n):
        return _Fn(lambda *a, **k: None)


class _FakeRect:
    """Prostokat okna, ktory `GetWindowRect` ma "wypelnic" - zaslepka podaje go z gory."""

    def __init__(self, l, t, r, b):
        self.left, self.top, self.right, self.bottom = l, t, r, b


class _FakeU32:
    """user32 na niby. Oddaje TRZY pomiary, z ktorych kod sklada prawde o polozeniu widoku:
    prostokat okna, rozmiar obszaru klienta i narozik klienta na ekranie. Notuje SetWindowPos
    i SetWindowRgn, zeby dalo sie sprawdzic ARYTMETYKE."""

    def __init__(self, dziennik, okno=(0, 0, 1721, 1084), klient=(1707, 1077), naroznik=(7, 0)):
        self._d = dziennik
        self._okno = okno
        self._klient = klient
        self._naroznik = naroznik
        self.SetWindowPos = _Fn(self._pos)
        self.SetWindowRgn = _Fn(self._rgn)
        self.GetWindowRect = _Fn(self._wrect)
        self.GetClientRect = _Fn(self._crect)
        self.ClientToScreen = _Fn(self._c2s)

    def _wrect(self, hwnd, wsk):
        l, t, w, h = self._okno
        wsk.left, wsk.top, wsk.right, wsk.bottom = l, t, l + w, t + h
        return True

    def _crect(self, hwnd, wsk):
        wsk.left, wsk.top, wsk.right, wsk.bottom = 0, 0, self._klient[0], self._klient[1]
        return True

    def _c2s(self, hwnd, pkt):
        pkt.x, pkt.y = self._naroznik
        return True

    def _pos(self, hwnd, po, x, y, w, h, flagi):
        self._d.append(("pos", x, y, w, h))
        return True

    def _rgn(self, hwnd, rgn, odswiez):
        self._d.append(("setrgn", rgn))
        return True


class _FakeWt:
    HWND = int
    HRGN = int
    BOOL = int
    RECT = staticmethod(lambda: _FakeRect(0, 0, 0, 0))
    POINT = staticmethod(lambda a=0, b=0: _FakePoint(a, b))


class _FakePoint:
    def __init__(self, x, y):
        self.x, self.y = x, y


# PRZYPADEK Z MASZYNY WLASCICIELA (zmierzony 15.09, powiekszenie ekranu 150%):
#   OKNO (0,0) 1721x1084 | KLIENT narozik (7,0) rozmiar 1707x1077 | WIDOK 1708x1049
# Czyli 7 px obramowania z boku i 28 px paska, ktory Chromium rysuje sobie w obszarze klienta
# (1077-1049). Widok lezy na ekranie w (7,28) i to JEGO narozik ma trafic w narozik pulpitu.
_log = []
_o8 = rf.ScanOverlay()
check("poprawka zostala zastosowana",
      _o8._ustaw_okno(_FakeCtypes(_log), _FakeWt(), _FakeU32(_log),
                      1234, 0, 0, 0, 1707, 1067, (0, 0, 1708, 1049)) is True)
check("okno idzie o odstepy widoku, nie okna",
      ("pos", -7, -28, 1721, 1102) in _log, _log)
check("szerokosc: roznica 1 px z zaokraglenia DPI jest POMINIETA",
      not any(z[0] == "pos" and z[3] != 1721 for z in _log), _log)
# ⚠️ REGIONU NIE MA I TO JEST DECYZJA. Pierwsza wersja (15.09) odcinala pasek przegladarki
# przez `SetWindowRgn` - i UKRYWALA NAKLADKE: region 1138x711 zamiast 1707x1067, czyli dokladnie
# dwie trzecie. `SetWindowRgn` mowi w pikselach FIZYCZNYCH niezaleznie od przestrzeni DPI watku,
# a ten watek stoi w wirtualizowanej. Objaw: okno na chwile pojawialo sie nad gra
# i od razu znikalo. Ten test pilnuje, zeby region tu nie wrocil bez przeliczenia geometrii.
check("regionu NIE zakladamy (patrz nota o pikselach fizycznych)",
      not any(z[0] in ("rgn", "setrgn") for z in _log), _log)
# DRUGIE PODEJSCIE PO UDANEJ POPRAWCE = zadnego ruchu. Zaslepka opisuje teraz okno PO ruchu:
# stoi w (-7,-28), narozik klienta na (0,-28), pasek 1077-1049 = 28, czyli widok zaczyna sie
# dokladnie w (0,0). Zostaje sama roznica wysokosci (18 px), o ktora prosimy RAZ - Chromium
# przycina i powtarzanie konczylo sie oknem rosnacym po 1-2 px na pomiar.
_log_b = []
check("po udanej poprawce drugie podejscie jest ODMOWIONE",
      _o8._ustaw_okno(_FakeCtypes(_log_b), _FakeWt(),
                      _FakeU32(_log_b, okno=(-7, -28, 1721, 1084), klient=(1707, 1077),
                               naroznik=(0, -28)),
                      1234, 0, 0, 0, 1707, 1067, (0, 0, 1708, 1049)) is False
      and not _log_b, _log_b)

# Bez pomiaru (pierwsze wejscie na ekran) stawiamy wprost na pulpicie i zdejmujemy region.
_log2 = []
rf.ScanOverlay()._ustaw_okno(_FakeCtypes(_log2), _FakeWt(), _FakeU32(_log2),
                             1234, 0, 0, 0, 1707, 1067, None, pierwsze=True)
check("bez pomiaru okno kryje pulpit jeden do jednego",
      ("pos", 0, 0, 1707, 1067) in _log2, _log2)
check("bez pomiaru tez zadnego regionu",
      not any(z[0] in ("rgn", "setrgn") for z in _log2), _log2)

# Pulpit z monitorem po lewej ma ujemne wspolrzedne - odstepy licza sie od NICH, nie od zera.
_log3 = []
rf.ScanOverlay()._ustaw_okno(_FakeCtypes(_log3), _FakeWt(),
                             _FakeU32(_log3, okno=(-1920, -200, 3854, 1097),
                                      klient=(3840, 1090), naroznik=(-1913, -200)),
                             1234, 0, -1920, -200, 3840, 1080, (0, 0, 3840, 1062))
check("ujemny naroznik pulpitu policzony poprawnie",
      ("pos", -1927, -228, 3854, 1115) in _log3, _log3)

# POMIAR ZE SRODKA UKLADANIA STRONY musi byc ODRZUCONY. Widok zglaszany, zanim strona sie
# rozlozy, daje "pasek" liczony w setkach pikseli - a poprawka o tyle podnioslaby okno o pol
# ekranu i wygladala jak nakladka, ktora zniknela.
_log4 = []
check("absurdalny pasek odrzucony, okno NIE rusza",
      rf.ScanOverlay()._ustaw_okno(_FakeCtypes(_log4), _FakeWt(), _FakeU32(_log4),
                                   1234, 0, 0, 0, 1707, 1067, (0, 0, 1708, 400)) is False
      and not _log4, _log4)

# NIC DO POPRAWIENIA = zadnego ruchu. To jedyny uczciwy test na "juz dobrze": porownanie
# z ostatnim ZADANYM prostokatem tego nie lapie, bo Chromium przycina wysokosc, wiec zadanie
# i stan faktyczny roznia sie na zawsze (okno przestawialo sie w kolko o te same dwa piksele).
_log5 = []
_o9 = rf.ScanOverlay()
# Liczby SPOJNE: pasek = klient 1077 - widok 1067 = 10, narozik klienta na -10, czyli widok
# zaczyna sie dokladnie w (0, 0) i ma dokladnie rozmiar pulpitu.
check("widok w narozniku i w rozmiarze = brak ruchu",
      _o9._ustaw_okno(_FakeCtypes(_log5), _FakeWt(),
                      _FakeU32(_log5, okno=(-7, -10, 1721, 1102), klient=(1707, 1077),
                               naroznik=(0, -10)),
                      1234, 0, 0, 0, 1707, 1067, (0, 0, 1707, 1067)) is False
      and not _log5, _log5)

# ⚠️ ROZMIAR MA WIEKSZY LUZ NIZ POLOZENIE: zaleznosc "rozmiar okna -> rozmiar widoku" nie jest
# przy 150% jeden do jednego, wiec gonienie dokladnej szerokosci to gonienie wlasnego ogona.
check("luz rozmiaru jest wiekszy od luzu polozenia",
      rf.ScanOverlay.WIDOK_LUZ_ROZMIAR > rf.ScanOverlay.WIDOK_LUZ,
      (rf.ScanOverlay.WIDOK_LUZ, rf.ScanOverlay.WIDOK_LUZ_ROZMIAR))
_log6 = []
# Widok zglaszany jako 1710x1065 zamiast 1707x1067: trzy piksele szerzej i dwa krocej, czyli
# dokladnie to, co robi zaokraglanie DIP-ow przy 150%. Zadna z tych roznic nie ma ruszyc okna.
check("roznica rozmiaru z zaokraglenia DPI nie rusza okna",
      rf.ScanOverlay()._ustaw_okno(_FakeCtypes(_log6), _FakeWt(),
                                   _FakeU32(_log6, okno=(-7, -10, 1721, 1102),
                                            klient=(1707, 1077), naroznik=(0, -10)),
                                   1234, 0, 0, 0, 1707, 1067, (0, 0, 1710, 1065)) is False
      and not _log6, _log6)

# Sufit poprawek: przegladarka, ktora po kazdym przesunieciu zglasza nowy widok, nie moze
# kazac przestawiac okna co pol sekundy (to „okno czasem podskakuje" z rf-41).
check("sufit poprawek jest maly i skonczony",
      isinstance(rf.ScanOverlay.KOREKT_MAX, int) and 1 <= rf.ScanOverlay.KOREKT_MAX <= 10,
      rf.ScanOverlay.KOREKT_MAX)

print("-- przedrostek tytulu okna niesie port")
check("port z adresu", rf.ScanOverlay._port_z("http://127.0.0.1:8781") == "8781")
check("dziwny adres nie wywraca", rf.ScanOverlay._port_z(None) == "x")
_o6 = rf.ScanOverlay()
check("przedrostek zawiera port", _o6._prefiks("8770") == "RFSKAN-8770-")
check("przedrostki dwoch kopii sie NIE pokrywaja",
      not _o6._prefiks("8770").startswith(_o6._prefiks("8781")))
check("przedrostek zaczyna sie od wspolnego znacznika",
      _o6._prefiks("8770").startswith(rf.ScanOverlay.MARK_PREFIX))

print("-- skrot zamykajacy okno nad pulpitem (Shift+R+F, 2026-09-15)")
# ZGLOSZENIE WLASCICIELA: „wylaczenie tej nakladki na pulpicie i wejscie na symulacje niech nie
# bedzie po alt+r+f, a po shift+r+f, zeby nie wyzwalalo to wylaczania wszystkich modulow".
# Tu pilnujemy DOKLADNIE tej roznicy: `scan_overlay_stop` zamyka okno i rozglasza to panelowi,
# ale nie wola niczego, co gasi moduly (tym jest `panic_stop` i taki ma zostac).


class _OknoStub:
    def __init__(self, bylo=True):
        self.bylo, self.zamkniete = bylo, 0

    def close(self):
        self.zamkniete += 1
        return self.bylo


_okno_bylo = rf.SCAN_OVERLAY
try:
    rf.SCAN_OVERLAY = _OknoStub(True)
    _bus9 = BusStub()
    _wynik = rf.scan_overlay_stop(_bus9, source="hotkey", combo="shift+r+f")
    _ev = [e for e in _bus9.events if e.get("t") == "scan_okno"]
    check("skrot zamyka okno", rf.SCAN_OVERLAY.zamkniete == 1 and _wynik == {"closed": True},
          _wynik)
    check("panel dowiaduje sie strumieniem, z kombinacja",
          len(_ev) == 1 and _ev[0]["open"] is False and _ev[0]["combo"] == "shift+r+f"
          and _ev[0]["source"] == "hotkey", _ev)
    # Idempotencja: drugie nacisniecie przy zamknietym oknie to nie blad i nie ma o czym krzyczec.
    rf.SCAN_OVERLAY = _OknoStub(False)
    _bus10 = BusStub()
    check("zamkniete okno: bez wyjatku, bez klamstwa o zamknieciu",
          rf.scan_overlay_stop(_bus10) == {"closed": False}
          and [e for e in _bus10.events if e.get("t") == "scan_okno"][0]["zamkniete"] is False)
finally:
    rf.SCAN_OVERLAY = _okno_bylo

print("-- tryb kiosku tylko przy jednym monitorze")
# Kiosk daje widok ROWNY pulpitowi (stad naprawa „caly ekran nie pokrywa calego ekranu"), ale
# pokrywa JEDEN ekran. Przy dwoch monitorach procenty klikniecia liczone od pulpitu rozjechalyby
# sie z widokiem obejmujacym polowe, wiec tam zostaje okno zwykle.
_ekrany_bylo = rf.list_screens
try:
    rf.list_screens = lambda: [{"i": 0}]
    check("jeden monitor = kiosk", rf.ScanOverlay()._jeden_monitor() is True)
    rf.list_screens = lambda: [{"i": 0}, {"i": 1}]
    check("dwa monitory = okno zwykle", rf.ScanOverlay()._jeden_monitor() is False)

    def _wybuch():
        raise RuntimeError("brak Windowsa")

    rf.list_screens = _wybuch
    check("nie wiemy ile ekranow = droga bezpieczna", rf.ScanOverlay()._jeden_monitor() is False)
finally:
    rf.list_screens = _ekrany_bylo

print("--- miniatura presetu: zrzut jedzie w kopercie, nie obok niej ---")
# Preset moze dostac miniature ze zrzutow ekranu uzytych w skanerze; za duze zrzuty sa od razu
# konwertowane i zmniejszane. Zmniejsza przegladarka (canvas),
# serwer pilnuje tylko tego, co przyjmuje i co oddaje.
check("data URL obrazka przechodzi", rf.scan_miniatura("data:image/jpeg;base64,/9j/4AAQSkZJRg==") != "")
check("png i webp tez (przegladarka wysyla jpeg, ale format nie jest tu istota)",
      rf.scan_miniatura("data:image/png;base64,iVBORw0KGgo=") != ""
      and rf.scan_miniatura("data:image/webp;base64,UklGRg==") != "")
check("cokolwiek innego to brak miniatury, a nie blad zapisu",
      rf.scan_miniatura("http://gdzies/obrazek.jpg") == ""
      and rf.scan_miniatura("data:text/html;base64,PHNjcmlwdD4=") == ""
      and rf.scan_miniatura("") == "")
check("za duza miniatura wypada (sufit 300 kB)",
      rf.scan_miniatura("data:image/jpeg;base64," + "A" * (rf.SCAN_MINIATURA_MAX + 10)) == "")
_mini = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
_nazwa = "test-miniatura-" + str(os.getpid())
try:
    rf.save_scan_preset(_nazwa, rf.ScanModule.sanitize({}), "opis", _mini)
    _plik = os.path.join(rf.SCAN_PRESET_DIR, _nazwa + ".json")
    with open(_plik, encoding="utf-8") as f:
        _env = json.load(f)
    check("miniatura lezy w KOPERCIE presetu (jedzie razem z plikiem do kolegi)",
          _env.get("miniatura") == _mini)
    # ⚠️ Zapis samego opisu NIE MOZE kasowac obrazka - okno „zmien nazwe i opis" idzie ta sama droga.
    rf.save_scan_preset(_nazwa, rf.ScanModule.sanitize({}), "inny opis")
    with open(_plik, encoding="utf-8") as f:
        _env2 = json.load(f)
    check("zapis samego opisu zostawia miniature na miejscu",
          _env2.get("miniatura") == _mini and _env2.get("desc") == "inny opis")
    _items = {i["name"]: i for i in rf.scan_preset_items()}
    check("lista presetow mowi TYLKO, czy miniatura jest (obraz idzie osobna trasa)",
          _items.get(_nazwa, {}).get("miniatura") is True)
    _row = {}
    rf._library_facts("scan", _row, _env)
    check("wiersz Biblioteki mowi, co preset niesie (opis, skanery, ekrany) i ze ma miniature",
          _row.get("cover") is True and _row.get("desc") == "opis" and _row.get("sekcje") >= 1)
finally:
    rf.delete_scan_preset(_nazwa)


# ----------------------------------------------------------------------------------------------
#  ZRZUTY PLANSZ JADA RAZEM Z PRESETEM (2026-09-20)
#
#  Zrzuty ekranu skanera maja jechac razem z presetem udostepnianym w bibliotece. Wczesniej
#  preset niosl SAME NAZWY plikow, wiec kolega dostawal plansze bez obrazow.
#
#  Sprawdzamy trzy rzeczy, bo kazda z nich psuje sie po cichu:
#    1. UMOWA NAZW - plik zapisany u kolegi musi miec DOKLADNIE te nazwe, ktora nosi plansza
#       w konfiguracji; inaczej plansze wskazuja w pustke, a panel mowi „nie ma tego zrzutu".
#    2. BRAMKI - nazwa ze sciezka i tresc niezgodna z rozszerzeniem musza byc odrzucone: to jest
#       plik z internetu, wiec zapisujemy go tak ostroznie, jak czytamy.
#    3. PAKOWANIE - do koperty wchodza tylko zrzuty, ktore NAPRAWDE leza na tym komputerze.
print("\n--- zrzuty plansz w pliku presetu ---")
_stare_tla = rf.SCAN_TLA_DIR
rf.SCAN_TLA_DIR = tempfile.mkdtemp(prefix="rf-scantla-")
try:
    # Najmniejszy poprawny JPEG: sam podpis wystarczy, bo serwer nie dekoduje pikseli.
    _jpg = b"\xff\xd8\xff" + b"0" * 64
    _url = "data:image/jpeg;base64," + base64.b64encode(_jpg).decode("ascii")
    _nz, _bl = rf.scan_zrzut_zapisz_pod("menu-ab12cd34.jpg", _url)
    check("zrzut z presetu zapisuje sie POD NAZWA Z PRESETU", _nz == "menu-ab12cd34.jpg" and not _bl,
          (_nz, _bl))
    check("...i lezy w katalogu zrzutow",
          os.path.isfile(os.path.join(rf.SCAN_TLA_DIR, "menu-ab12cd34.jpg")))
    check("sciezka w nazwie jest odrzucana, a nie obcinana",
          rf.scan_zrzut_zapisz_pod("../poza/menu.jpg", _url)[0] == "")
    check("tresc niezgodna z rozszerzeniem jest odrzucana",
          rf.scan_zrzut_zapisz_pod("menu-ab12cd34.png", _url)[0] == "")
    check("cokolwiek, co nie jest obrazem, jest odrzucane",
          rf.scan_zrzut_zapisz_pod("menu-ff000000.jpg", "data:text/plain;base64,QUJD")[0] == "")

    _cfg = rf.ScanModule.sanitize({
        "zrzuty": [{"plik": "menu-ab12cd34.jpg", "nazwa": "Menu", "sekcje": [1]},
                   {"plik": "brak-99999999.jpg", "nazwa": "Nie ma", "sekcje": []}],
        "zrzutAktywny": 1})
    _pak = rf.scan_zrzuty_spakuj(_cfg)
    check("do koperty wchodzi zrzut, ktory jest na dysku", "menu-ab12cd34.jpg" in _pak)
    check("...i NIE wchodzi ten, ktorego nie ma (nie zmyslamy obrazu)", "brak-99999999.jpg" not in _pak)
    check("obraz jedzie jako data URL", str(_pak.get("menu-ab12cd34.jpg", "")).startswith("data:image/jpeg;base64,"))

    # Pelna droga: zapis presetu -> pobranie pliku (`/library/item`) -> koperta z obrazami.
    _nazwa2 = "__test_wymiany__"
    try:
        rf.save_scan_preset(_nazwa2, _cfg, "dwie plansze")
        _env3 = rf.library_item("scan", _nazwa2)
        check("pobrany plik presetu niesie obrazy plansz",
              isinstance(_env3, dict) and "menu-ab12cd34.jpg" in (_env3.get("obrazy") or {}))
        check("kazda plansza z obrazem ma swoj obraz pod SWOJA nazwa",
              all(z["plik"] in (_env3.get("obrazy") or {})
                  for z in (_env3.get("config") or {}).get("zrzuty", [])
                  if z.get("plik") and z["plik"] != "brak-99999999.jpg"))
        # ⚠️ Plik NA DYSKU zostaje lekki: obrazy dokladane sa dopiero przy pobieraniu.
        with open(os.path.join(rf.SCAN_PRESET_DIR, _nazwa2 + ".json"), encoding="utf-8") as f:
            _zapisany = json.load(f)
        check("preset w bibliotece zostaje lekki (obrazy tylko w pobranym pliku)",
              "obrazy" not in _zapisany)
    finally:
        rf.delete_scan_preset(_nazwa2)
finally:
    shutil.rmtree(rf.SCAN_TLA_DIR, ignore_errors=True)
    rf.SCAN_TLA_DIR = _stare_tla


print("\n--- edytor obszaru nad pulpitem: czym zaczyna (rf-50m) ---")
# Okno do robienia i edycji stref ma ZAWSZE zaczynac od "Wszystkie
# skanery" tej planszy. Do 22.09 wybor szedl do localStorage pod klucz `rf.scan.pozostale` — TEN
# SAM, ktorego uzywa oczko w pasku plansz w karcie — wiec jedno klikniecie oczka kiedys tam
# otwieralo edytor bez cudzych obrysow i nic w oknie nie tlumaczylo, dlaczego ich nie ma.
# Grep po zrodle, bo zachowanie przy OTWARCIU okna jest wlasnie tym, czego harness (juz otwarty
# edytor) nie widzi, a regresja jest jednolinijkowa.
with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "web", "js", "rf-50m-scan-overlay-edit.js"), "r", encoding="utf-8") as _f:
    _ed_js = _f.read()
check("edytor zaczyna od pokazywania wszystkich skanerow planszy",
      "let pokazujInne = true;" in _ed_js)
check("...i nie wciaga zapamietanego zawezenia z poprzedniego okna",
      "localStorage.getItem(" not in _ed_js and "localStorage.setItem(" not in _ed_js)


print("\n--- opis presetu z tablicy pol (harness node, 02.10) ---")
# Opis skanera w Bibliotece jest POCHODNA `RFScan.POLA` (rf-50b2). Harness pilnuje, ze kazde pole
# widoczne w karcie ma wpis w opisie — czyli ze nowe pokretlo pojawia sie tam samo.
import subprocess   # noqa: E402
_h = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scan_opisz_harness.cjs")
try:
    _p = subprocess.run(["node", _h], capture_output=True, text=True, encoding="utf-8", timeout=60)
    _ost = [l for l in (_p.stdout or "").strip().splitlines() if "passed" in l]
    check("opis z tablicy pol: harness przechodzi (node)", _p.returncode == 0,
          (_p.returncode, (_ost[-1] if _ost else (_p.stderr or "")[:300]).encode("ascii", "replace").decode("ascii")))
    if _ost:
        print("    " + _ost[-1])
except FileNotFoundError:
    print("SKIP  brak node - harness opisu pominiety")

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
