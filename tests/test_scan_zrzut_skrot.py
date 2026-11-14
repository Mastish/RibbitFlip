"""SKANER - ZRZUT PLANSZY SKROTEM KLAWISZOWYM (2026-09-21).

Zrzuty do skanera skrotem (ALT+R+1 do ALT+R+9). Kazdy zrzut calego ekranu od razu trafia
do skanera, z mozliwoscia konfiguracji, a zaraz po zrzucie da sie narysowac na nim strefy
albo przypisac do niego istniejace.

Czego pilnuje ten plik, po kolei:
  1. `zrzut_plan_akcji` - cyfra to NUMER PLANSZY: istniejaca dostaje nowy obraz (skanery zostaja),
     nieistniejaca dopisuje sie na koncu. To jest cale zachowanie skrotu w jednej czystej funkcji.
  2. Rdzen zapisu (`scan_zrzut_z_bajtow` / `scan_zrzut_z_obrazu`) - zmniejszanie, pomiar PRZED
     zmniejszeniem i to, ze ta sama tresc daje ten sam plik.
  3. `scan_zrzut_z_pliku` po refaktorze daje DOKLADNIE to, co dawal przedtem (deleguje do rdzenia).
  4. Ustawienia w pliku skrotow: domyslne, przezycie zapisu karty stopu awaryjnego, odrzucenie
     prefiksu, ktorego nie da sie nacisnac.
  5. Pelna akcja `scan_zrzut_skrotem` na atrapie kapsla, z podstawionym zrzutem - lacznie z tym,
     ze plansza LADUJE NA DYSKU (bez tego znika przy restarcie) i ze podmiana obrazu nie rozpina
     przypisanych skanerow.
  6. Prawdziwy zrzut monitora - tylko Windows z Pillow, inaczej pomijany. Sprawdza rozmiar
     wzgledem trybu monitora, czyli wylapuje blad swiadomosci DPI (1707x1067 zamiast 2560x1600).

⚠️ NIC TU NIE PISZE DO ZYWEGO `Settings/`: katalog jest podmieniany na tymczasowy, a "pokaz panel"
wylaczony - inaczej test wyciagalby okno na wierzch komus, kto akurat pracuje.

Bez znakow spoza ASCII w print() - konsola cp1250.
"""
import io
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402

_passed = 0
_failed = 0
_skipped = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


def skip(name, why):
    global _skipped
    _skipped += 1
    print("SKIP  %s  (%s)" % (name, why))


try:
    from PIL import Image
    MA_PILLOW = True
except Exception:
    MA_PILLOW = False


class BusStub:
    def __init__(self):
        self.events = []

    def now(self):
        return 1.0

    def publish(self, ev):
        self.events.append(ev)


# --- 1. PLAN AKCJI: co robi cyfra ------------------------------------------------------------
print("-- plan akcji (cyfra = numer planszy)")

check("pusty spis: pierwsza cyfra zaklada plansze 1", rf.zrzut_plan_akcji(0, 1) == ("dodaj", 1),
      rf.zrzut_plan_akcji(0, 1))
check("istniejaca plansza dostaje nowy OBRAZ, a nie kopie",
      rf.zrzut_plan_akcji(2, 1) == ("obraz", 1), rf.zrzut_plan_akcji(2, 1))
check("cyfra tuz za koncem spisu dopisuje na koncu",
      rf.zrzut_plan_akcji(2, 3) == ("dodaj", 3), rf.zrzut_plan_akcji(2, 3))
# Plansze nie maja dziur (spis jest lista, nie mapa), wiec "7" przy dwoch planszach robi TRZECIA.
# Powiadomienie mowi o tym wprost - patrz `scan_zrzut_skrotem`.
check("cyfra z sufitu tez dopisuje na koncu, bez dziur w spisie",
      rf.zrzut_plan_akcji(2, 7) == ("dodaj", 3), rf.zrzut_plan_akcji(2, 7))
check("smieci zamiast cyfry nie wywracaja akcji",
      rf.zrzut_plan_akcji(2, "x") == ("dodaj", 1), rf.zrzut_plan_akcji(2, "x"))
check("cyfra przychodzi z haka jako NAPIS i ma dzialac tak samo",
      rf.zrzut_plan_akcji(3, "2") == ("obraz", 2), rf.zrzut_plan_akcji(3, "2"))


# --- 2-3. RDZEN ZAPISU ZRZUTU ----------------------------------------------------------------
print("-- rdzen zapisu (bajty / obraz / plik)")

_tmp = tempfile.mkdtemp(prefix="rf-zrzut-")
_stare = (rf.SETTINGS_DIR, rf.SCAN_TLA_DIR, rf.HOTKEY_CONFIG_FILE)
rf.SETTINGS_DIR = _tmp
rf.SCAN_TLA_DIR = os.path.join(_tmp, "ScanTla")
rf.HOTKEY_CONFIG_FILE = os.path.join(_tmp, "ribbitflip_hotkey.json")
try:
    if not MA_PILLOW:
        skip("rdzen zapisu zrzutu", "brak Pillow")
    else:
        # Obraz wiekszy od typowego monitora: 3000x2000 to jednoczesnie test progu
        # SCAN_TLO_BOK (1920) i tego, ze zmierzony rozmiar jest sprzed zmniejszenia.
        duzy = Image.new("RGB", (3000, 2000), (20, 40, 60))
        for x in range(0, 3000, 37):      # troche tresci, zeby JPEG nie zszedl do zera
            for y in range(0, 2000, 53):
                duzy.putpixel((x, y), (200, 30, 90))

        nazwa, w, h, blad = rf.scan_zrzut_z_obrazu(duzy, "Sol Cesto")
        check("zrzut z obrazu zapisuje sie bez bledu", not blad and nazwa, (nazwa, blad))
        check("zmierzony rozmiar jest SPRZED zmniejszenia (rozdzielczosc ekranu)",
              (w, h) == (3000, 2000), (w, h))
        check("nazwa pliku przechodzi wzorzec serwera", bool(rf._SCAN_TLO_RE.fullmatch(nazwa)),
              nazwa)
        check("nazwa niesie podpowiedz z tytulu okna", nazwa.startswith("sol-cesto-"), nazwa)
        p = os.path.join(rf.SCAN_TLA_DIR, nazwa)
        check("plik naprawde lezy na dysku", os.path.isfile(p), p)
        with Image.open(p) as zap:
            check("dluzszy bok zmniejszony do progu", max(zap.size) <= rf.SCAN_TLO_BOK, zap.size)
            check("proporcje zachowane", abs(zap.width / zap.height - 1.5) < 0.01, zap.size)
        check("plik miesci sie w limicie", os.path.getsize(p) <= rf.SCAN_TLO_MAX,
              os.path.getsize(p))

        # TA SAMA TRESC = TEN SAM PLIK. Nazwa niesie skrot SHA1 zawartosci, wiec drugi identyczny
        # zrzut nie mnozy kopii - i to jest celowe (patrz `scan_tlo_zapisz`).
        nazwa2, _, _, _ = rf.scan_zrzut_z_obrazu(duzy, "Sol Cesto")
        check("ta sama tresc daje ta sama nazwe", nazwa2 == nazwa, (nazwa, nazwa2))
        inny = Image.new("RGB", (3000, 2000), (90, 10, 10))
        nazwa3, _, _, _ = rf.scan_zrzut_z_obrazu(inny, "Sol Cesto")
        check("inna tresc daje inna nazwe", nazwa3 and nazwa3 != nazwa, (nazwa, nazwa3))

        # Maly obraz nie jest ruszany progiem, ale nadal ma zmierzony rozmiar.
        maly = Image.new("RGB", (800, 600), (5, 5, 5))
        n4, w4, h4, b4 = rf.scan_zrzut_z_obrazu(maly, "menu gry")
        check("maly zrzut zapisuje sie i zachowuje rozmiar",
              not b4 and (w4, h4) == (800, 600), (n4, w4, h4, b4))

        # `scan_zrzut_z_pliku` po refaktorze DELEGUJE do rdzenia - wynik musi byc ten sam.
        sciezka = os.path.join(_tmp, "zrzut-testowy.png")
        duzy.save(sciezka, format="PNG")
        n5, w5, h5, b5 = rf.scan_zrzut_z_pliku(sciezka, "Sol Cesto")
        check("zrzut z pliku daje ten sam wynik, co zrzut z obrazu",
              not b5 and (n5, w5, h5) == (nazwa, 3000, 2000), (n5, w5, h5, b5))
        check("nieistniejaca sciezka nadal jest bledem, nie wyjatkiem",
              rf.scan_zrzut_z_pliku(os.path.join(_tmp, "nie-ma.png"))[3].startswith("nie ma"),
              rf.scan_zrzut_z_pliku(os.path.join(_tmp, "nie-ma.png")))
        check("pusty ciag bajtow to blad, nie zapis",
              rf.scan_zrzut_z_bajtow(b"", "cos")[3] == "pusty plik",
              rf.scan_zrzut_z_bajtow(b"", "cos"))

    # --- 4. USTAWIENIA W PLIKU SKROTOW -------------------------------------------------------
    print("-- ustawienia skrotu w pliku")

    cfg = rf.load_hotkey_config()
    # Fabryczne "Po zrzucie" to OKNO NAD PULPITEM (wczesniej bylo
    # "panel"). Skrot naciska sie spod gry, wiec odpowiedz "wracaj do panelu" zabierala czlowieka
    # stamtad, gdzie wlasnie byl. Wartosc trzyma jedna stala - panel i serwer maja ja rozna.
    check("fabryczne `Po zrzucie` to okno nad pulpitem", rf.ZRZUT_PO_DEFAULT == "pulpit",
          rf.ZRZUT_PO_DEFAULT)
    check("brak podklucza `zrzut` daje komplet fabrycznych ustawien",
          cfg["zrzut"] == {"enabled": False, "combo": rf.DEFAULT_ZRZUT_PREFIX, "dev": "",
                           "monitor": "kursor", "poZrzucie": rf.ZRZUT_PO_DEFAULT}, cfg["zrzut"])
    # ⚠️ TO JEST TA REGRESJA, KTOREJ PILNUJE CALA TA SEKCJA: karta "Stop awaryjny" zapisuje
    # WYLACZNIE swoja czesc, a plik jest wspolny dla trzech skrotow.
    rf.save_hotkey_config({"enabled": True, "combo": "ctrl+shift+q", "scan": cfg["scan"],
                           "zrzut": dict(cfg["zrzut"], enabled=True, combo="ctrl+alt",
                                         dev="d1", monitor="glowny", poZrzucie="pulpit")})
    rf.save_hotkey_config({"enabled": True, "combo": "alt+r+f", "scan": cfg["scan"]})
    po = rf.load_hotkey_config()
    check("zapis samej karty stopu NIE kasuje ustawien zrzutu",
          po["zrzut"] == {"enabled": True, "combo": "ctrl+alt", "dev": "d1",
                          "monitor": "glowny", "poZrzucie": "pulpit"}, po["zrzut"])

    # CO ZARAZ PO ZRZUCIE - trzy stany zamiast dawnego `pokazPanel` (druga iteracja, ten sam
    # dzien). Plik zapisany PRZED ta zmiana musi sie nadal czytac: `false` znaczylo dokladnie
    # dzisiejsze "nic", `true` - "panel". Bez tego przejscia ustawienie czlowieka przestawiloby
    # sie po cichu przy pierwszym uruchomieniu nowej wersji.
    for stare, chciane in ((False, "nic"), (True, "panel")):
        rf.save_hotkey_config({"enabled": True, "combo": "alt+r+f", "scan": cfg["scan"],
                               "zrzut": {"enabled": True, "pokazPanel": stare}})
        check("stary klucz pokazPanel=%r czyta sie jako %r" % (stare, chciane),
              rf.load_hotkey_config()["zrzut"]["poZrzucie"] == chciane,
              rf.load_hotkey_config()["zrzut"]["poZrzucie"])
    for dobry in rf.ZRZUT_PO:
        rf.save_hotkey_config({"enabled": True, "combo": "alt+r+f", "scan": cfg["scan"],
                               "zrzut": {"poZrzucie": dobry}})
        check("stan %r przechodzi" % dobry, rf.load_hotkey_config()["zrzut"]["poZrzucie"] == dobry)
    # ⚠️ MIGRACJA OBOWIAZUJE TYLKO TAM, GDZIE STARY KLUCZ NAPRAWDE JEST. Gdy nie ma ani
    # `poZrzucie`, ani `pokazPanel`, to nie jest stary plik - to nowa konfiguracja i ma dostac
    # DZISIEJSZE fabryczne. Do 22.09 czytalo sie to jako `pokazPanel=True`, czyli "panel", i po
    # zmianie domyslnej wartosci kazdy nowy uzytkownik dostawalby stara.
    rf.save_hotkey_config({"enabled": True, "combo": "alt+r+f", "scan": cfg["scan"],
                           "zrzut": {"enabled": True, "dev": "d1"}})
    check("podklucz `zrzut` bez obu kluczy bierze dzisiejsze fabryczne",
          rf.load_hotkey_config()["zrzut"]["poZrzucie"] == rf.ZRZUT_PO_DEFAULT,
          rf.load_hotkey_config()["zrzut"]["poZrzucie"])
    # Smiec wraca do domyslnego, a nie wywraca odczytu: pole ma trzy stany z listy, wiec pomylka
    # znaczy "nie wiem, co to", a nie "odmow uruchomienia aplikacji".
    for smiec in ("x", "", None, 7):
        rf.save_hotkey_config({"enabled": True, "combo": "alt+r+f", "scan": cfg["scan"],
                               "zrzut": {"poZrzucie": smiec}})
        czytane = rf.load_hotkey_config()["zrzut"]["poZrzucie"]
        check("smiec %r w `poZrzucie` daje %r" % (smiec, rf.ZRZUT_PO_DEFAULT),
              czytane == rf.ZRZUT_PO_DEFAULT, czytane)
    # A to NIE jest smiec, tylko ten sam stan zapisany inaczej - ma sie znormalizowac, nie spasc
    # na fabryczne (inaczej wpisana recznie wartosc po cichu zmienialaby ustawienie).
    rf.save_hotkey_config({"enabled": True, "combo": "alt+r+f", "scan": cfg["scan"],
                           "zrzut": {"poZrzucie": "PANEL "}})
    check("`PANEL ` normalizuje sie do `panel`",
          rf.load_hotkey_config()["zrzut"]["poZrzucie"] == "panel",
          rf.load_hotkey_config()["zrzut"]["poZrzucie"])
    with open(rf.HOTKEY_CONFIG_FILE, "r", encoding="utf-8") as f:
        surowy = json.load(f)
    check("podklucz `zrzut` jest naprawde w pliku, obok `scan`",
          isinstance(surowy.get("zrzut"), dict) and isinstance(surowy.get("scan"), dict),
          list(surowy))

    # Prefiks recznie wpisany na cos, czego nie da sie nacisnac -> fabryczny. Nie "prawie dziala":
    # skrot, ktory nie jest tym, co czlowiek wybral, jest gorszy od braku skrotu.
    for zly in ("altgr", "r", "", "zupelnie+nic"):
        rf.save_hotkey_config({"enabled": True, "combo": "alt+r+f", "scan": cfg["scan"],
                               "zrzut": {"enabled": True, "combo": zly}})
        check("nieuzywalny prefiks %r wraca do fabrycznego" % zly,
              rf.load_hotkey_config()["zrzut"]["combo"] == rf.DEFAULT_ZRZUT_PREFIX,
              rf.load_hotkey_config()["zrzut"]["combo"])
    # ...a prefiks z samych modyfikatorow JEST prawidlowy, choc `hotkey_check` sam w sobie
    # odrzucilby go jako skrot ("nokey"). Dopiero prefiks + cyfra jest kombinacja.
    rf.save_hotkey_config({"enabled": True, "combo": "alt+r+f", "scan": cfg["scan"],
                           "zrzut": {"enabled": True, "combo": "ctrl+shift"}})
    check("prefiks z samych modyfikatorow przechodzi",
          rf.load_hotkey_config()["zrzut"]["combo"] == "ctrl+shift",
          rf.load_hotkey_config()["zrzut"]["combo"])
    # Nieznany monitor tez spada na fabryczny, a nazwa urzadzenia przechodzi jak jest.
    rf.save_hotkey_config({"enabled": True, "combo": "alt+r+f", "scan": cfg["scan"],
                           "zrzut": {"monitor": "jakis-wymyslony"}})
    check("nieznany monitor wraca do 'kursor'",
          rf.load_hotkey_config()["zrzut"]["monitor"] == "kursor")
    rf.save_hotkey_config({"enabled": True, "combo": "alt+r+f", "scan": cfg["scan"],
                           "zrzut": {"monitor": "\\\\.\\DISPLAY2"}})
    check("nazwa urzadzenia monitora przechodzi jak jest",
          rf.load_hotkey_config()["zrzut"]["monitor"] == "\\\\.\\DISPLAY2",
          rf.load_hotkey_config()["zrzut"]["monitor"])

    # --- 5. PELNA AKCJA SKROTU ---------------------------------------------------------------
    print("-- pelna akcja skrotu")

    class DevStub:
        def __init__(self, dev, bus):
            self.id = dev
            self.name = "Triki 1"
            self.label = ""
            self.scan = rf.ScanModule(bus, dev)

    class DmStub:
        def __init__(self, bus, dev="d0"):
            self.simulate = False
            self.default_id = dev
            self.devices = {dev: DevStub(dev, bus)}
            self.order = [dev]

        def get(self, dev_id):
            return self.devices.get(dev_id) or self.devices.get(self.default_id)

        def all(self):
            return [self.devices[i] for i in self.order]

    if not MA_PILLOW:
        skip("pelna akcja skrotu", "brak Pillow")
    else:
        # ⚠️ `poZrzucie: "nic"` - test NIE ma prawa wyciagac okna na wierzch ani otwierac
        # nakladki komus, kto pracuje. Tryby "panel" i "pulpit" sprawdzamy nizej na atrapach.
        USTAWIENIA = {"enabled": True, "combo": "alt+r", "dev": "", "monitor": "kursor",
                      "poZrzucie": "nic"}
        _tytul_stary = rf._tytul_okna_na_wierzchu
        rf._tytul_okna_na_wierzchu = lambda: "Sol Cesto"

        def grab(obraz, uwaga=None):
            """Podstawiony `zrzut_monitora`: oddaje gotowy obraz zamiast pytac ekran."""
            def _fn(monitor="kursor"):
                info = {"monitor": "\\\\.\\DISPLAY1", "x": 0, "y": 0,
                        "w": obraz.width, "h": obraz.height}
                if uwaga:
                    info["uwaga"] = uwaga
                return obraz, info, ""
            return _fn

        try:
            bus = BusStub()
            dm = DmStub(bus)
            ekran1 = Image.new("RGB", (1920, 1080), (11, 22, 33))
            ekran1.putpixel((5, 5), (255, 0, 0))
            wynik = rf.scan_zrzut_skrotem(dm, bus, "alt+r+1", "1", USTAWIENIA,
                                          zrzut_fn=grab(ekran1))
            cfg0 = dm.get("d0").scan.cfg
            check("pierwszy zrzut zaklada jedna plansze", len(cfg0["zrzuty"]) == 1,
                  cfg0["zrzuty"])
            check("panel otwiera wlasnie ta plansze", cfg0["zrzutAktywny"] == 1,
                  cfg0["zrzutAktywny"])
            check("plansza dostala nazwe z tytulu okna gry",
                  cfg0["zrzuty"][0]["nazwa"] == "Sol Cesto", cfg0["zrzuty"][0])
            check("plansza niesie rozdzielczosc ekranu",
                  (cfg0["zrzuty"][0]["w"], cfg0["zrzuty"][0]["h"]) == (1920, 1080),
                  cfg0["zrzuty"][0])
            plik1 = cfg0["zrzuty"][0]["plik"]
            check("zrzut lezy na dysku",
                  os.path.isfile(os.path.join(rf.SCAN_TLA_DIR, plik1)), plik1)
            # ⚠️ MIGAWKA PAMIECI TO NIE DYSK. `screens_edit` zmienia `self.cfg` i rozglasza
            # `scan_cfg`, ale pliku NIE dotyka - bez `save_scan` plansza znika po restarcie.
            zapis = rf._dev_path("d0", "scan")
            check("konfiguracja skanera zostala ZAPISANA na dysk", os.path.isfile(zapis), zapis)
            with open(zapis, "r", encoding="utf-8") as f:
                z_dysku = json.load(f)
            check("zapisany plik niesie te sama plansze",
                  [z["plik"] for z in (z_dysku.get("zrzuty") or [])] == [plik1], z_dysku.get("zrzuty"))

            zdarzenia = [e for e in bus.events if e.get("t") == "scan_zrzut"]
            check("na strumien poszlo zdarzenie `scan_zrzut`", len(zdarzenia) == 1, bus.events)
            check("zdarzenie mowi, ze plansza jest NOWA",
                  zdarzenia[0]["ok"] is True and zdarzenia[0]["nowa"] is True
                  and zdarzenia[0]["n"] == 1 and zdarzenia[0]["dev"] == "d0",
                  zdarzenia[0])
            check("zdarzenie niesie kombinacje, ktora padla",
                  zdarzenia[0]["combo"] == "alt+r+1" and zdarzenia[0]["final"] == "1",
                  zdarzenia[0])
            check("zdarzenie niesie rozmiar zrzutu, zeby panel mogl go pokazac",
                  (zdarzenia[0]["w"], zdarzenia[0]["h"]) == (1920, 1080), zdarzenia[0])

            # Przypisujemy skaner do tej planszy - i sprawdzamy, ze DRUGI zrzut tego samego
            # widoku go NIE rozpina. To jest cala roznica miedzy "obraz" i "dodaj".
            dm.get("d0").scan.screens_edit("przypisz", n=1, sekcja=1, wlacz=True)
            przed = list(dm.get("d0").scan.cfg["zrzuty"][0]["sekcje"])
            check("skaner jest przypisany do planszy 1", przed == [1], przed)

            ekran2 = Image.new("RGB", (1920, 1080), (99, 88, 77))
            wynik2 = rf.scan_zrzut_skrotem(dm, bus, "alt+r+1", "1", USTAWIENIA,
                                           zrzut_fn=grab(ekran2))
            cfg0 = dm.get("d0").scan.cfg
            check("drugi zrzut na te sama cyfre NIE dodaje planszy", len(cfg0["zrzuty"]) == 1,
                  cfg0["zrzuty"])
            check("...ale podmienia obraz", cfg0["zrzuty"][0]["plik"] != plik1,
                  (plik1, cfg0["zrzuty"][0]["plik"]))
            check("...i zostawia przypisane skanery na miejscu",
                  cfg0["zrzuty"][0]["sekcje"] == [1], cfg0["zrzuty"][0])
            check("...i zostawia nazwe nadana wczesniej",
                  cfg0["zrzuty"][0]["nazwa"] == "Sol Cesto", cfg0["zrzuty"][0])
            check("zdarzenie mowi, ze plansza NIE jest nowa", wynik2["nowa"] is False, wynik2)

            # Cyfra z sufitu: przy jednej planszy "5" robi DRUGA, a nie piata.
            ekran3 = Image.new("RGB", (1280, 720), (1, 2, 3))
            wynik3 = rf.scan_zrzut_skrotem(dm, bus, "alt+r+5", "5", USTAWIENIA,
                                           zrzut_fn=grab(ekran3))
            cfg0 = dm.get("d0").scan.cfg
            check("cyfra z sufitu dopisuje kolejna plansze, bez dziur",
                  len(cfg0["zrzuty"]) == 2, cfg0["zrzuty"])
            check("zdarzenie podaje PRAWDZIWY numer planszy, a nie nacisnieta cyfre",
                  wynik3["n"] == 2 and wynik3["nowa"] is True, wynik3)
            check("panel otwiera nowa plansze", cfg0["zrzutAktywny"] == 2, cfg0["zrzutAktywny"])
            check("nowa plansza zaczyna bez skanerow (naleza do tamtego widoku)",
                  cfg0["zrzuty"][1]["sekcje"] == [], cfg0["zrzuty"][1])

            # Blad zrzutu ma byc POWIEDZIANY, a nie przemilczany: skrot naciska sie spod gry.
            bus.events.clear()
            zly = rf.scan_zrzut_skrotem(dm, bus, "alt+r+1", "1", USTAWIENIA,
                                        zrzut_fn=lambda m="kursor": (None, {}, "nie ma monitora"))
            check("nieudany zrzut zwraca blad zamiast rzucac",
                  zly["ok"] is False and zly["error"] == "nie ma monitora", zly)
            check("...i mowi o tym na strumieniu",
                  any(e.get("t") == "scan_zrzut" and e.get("ok") is False for e in bus.events),
                  bus.events)
            check("...i niczego nie dodaje do spisu plansz",
                  len(dm.get("d0").scan.cfg["zrzuty"]) == 2,
                  dm.get("d0").scan.cfg["zrzuty"])

            # Kapsel wskazany w ustawieniach, ktorego nie ma -> domyslny, a nie odmowa.
            wynik4 = rf.scan_zrzut_skrotem(dm, bus, "alt+r+1", "1",
                                           dict(USTAWIENIA, dev="d7"), zrzut_fn=grab(ekran3))
            check("nieznany kapsel w ustawieniach spada na domyslny",
                  wynik4["ok"] is True and wynik4["dev"] == "d0", wynik4)
        finally:
            rf._tytul_okna_na_wierzchu = _tytul_stary

    # --- 5b. CO ZARAZ PO ZRZUCIE -------------------------------------------------------------
    print("-- co zaraz po zrzucie (nic / panel / pulpit)")

    if not MA_PILLOW:
        skip("co zaraz po zrzucie", "brak Pillow")
    else:
        class OknoStub:
            """Atrapa `SCAN_OVERLAY`: zapamietuje, o co ja proszono, i udaje stan okna."""

            def __init__(self, otwarte=False, tryb="", dev=""):
                self.st = {"open": otwarte, "tryb": tryb, "dev": dev}
                self.wolania = []

            def stan(self):
                return dict(self.st)

            def open(self, base_url, dev=None, tryb="skan"):
                self.wolania.append({"base": base_url, "dev": dev, "tryb": tryb})
                self.st = {"open": True, "tryb": tryb, "dev": dev}
                return True, ""

        _tytul_stary = rf._tytul_okna_na_wierzchu
        _front_stary = rf._front_window_by_title
        _okno_stare = rf.SCAN_OVERLAY
        rf._tytul_okna_na_wierzchu = lambda: "Sol Cesto"
        fronty = []
        rf._front_window_by_title = lambda t, deadline=0.6: (fronty.append(t), True)[1]
        try:
            obraz = Image.new("RGB", (1280, 720), (7, 7, 7))

            def _grab(monitor="kursor"):
                return obraz, {"monitor": "\\\\.\\DISPLAY1", "x": 0, "y": 0, "w": 1280, "h": 720}, ""

            def _sesja(po, okno):
                """Swiezy kapsel + podstawiona nakladka, jedno nacisniecie skrotu."""
                del fronty[:]
                rf.SCAN_OVERLAY = okno
                bus = BusStub()
                dm = DmStub(bus, "d0")
                w = rf.scan_zrzut_skrotem(dm, bus, "alt+r+1", "1",
                                          dict(USTAWIENIA, poZrzucie=po), zrzut_fn=_grab)
                return w, dm, bus

            # a) "nic" - plansza zapisana, i tyle. Zadnego wyciagania panelu, zadnego okna.
            okno = OknoStub()
            w, dm, _bus = _sesja("nic", okno)
            check("tryb nic: plansza jednak powstala", w["ok"] is True and w["n"] == 1, w)
            check("tryb nic: panel NIE jest wyciagany na wierzch", fronty == [], fronty)
            check("tryb nic: okno nad pulpitem nie jest otwierane", okno.wolania == [], okno.wolania)
            check("tryb nic: zdarzenie niesie wybrany tryb", w["poZrzucie"] == "nic", w)
            check("tryb nic: zdarzenie nie mowi o oknie", "okno" not in w, w)

            # b) "panel" - dotychczasowe zachowanie.
            okno = OknoStub()
            w, dm, _bus = _sesja("panel", okno)
            check("tryb panel: panel wyciagany na wierzch po tytule RibbitFlip",
                  fronty == ["RibbitFlip"] and w["fronted"] is True, (fronty, w.get("fronted")))
            check("tryb panel: okno nad pulpitem nie jest otwierane", okno.wolania == [], okno.wolania)

            # c) "pulpit" przy ZAMKNIETYM oknie - staje EDYTOR obszaru na tym kapslu.
            okno = OknoStub()
            w, dm, _bus = _sesja("pulpit", okno)
            check("tryb pulpit: okno otwarte dokladnie raz", len(okno.wolania) == 1, okno.wolania)
            check("tryb pulpit: otwarte w trybie `edycja`, na tym kapslu",
                  okno.wolania and okno.wolania[0]["tryb"] == "edycja"
                  and okno.wolania[0]["dev"] == "d0", okno.wolania)
            check("tryb pulpit: panelu NIE wyciagamy (zaslonilby gre)",
                  fronty == [] and w["fronted"] is False, (fronty, w.get("fronted")))
            check("tryb pulpit: zdarzenie opisuje okno",
                  w.get("okno", {}).get("otwarte") is True
                  and w["okno"]["tryb"] == "edycja", w.get("okno"))

            # d) "pulpit", gdy nad pulpitem PRACUJE SKANER - nie przerywamy go.
            okno = OknoStub(otwarte=True, tryb="skan", dev="d0")
            w, dm, _bus = _sesja("pulpit", okno)
            check("tryb pulpit: pracujacego skanera nie przerywamy", okno.wolania == [], okno.wolania)
            check("tryb pulpit: ...ale plansza i tak powstaje", w["ok"] is True and w["n"] == 1, w)
            check("tryb pulpit: zdarzenie mowi, ze okno pracuje",
                  w.get("okno", {}).get("pracuje") is True, w.get("okno"))

            # e) "pulpit", gdy edytor JUZ stoi na tym kapslu - nie otwieramy drugi raz.
            #    Nakladka dostala `scan_cfg` ze `screens_edit` i sama przeladuje konfiguracje.
            okno = OknoStub(otwarte=True, tryb="edycja", dev="d0")
            w, dm, _bus = _sesja("pulpit", okno)
            check("tryb pulpit: stojacego edytora nie otwieramy drugi raz", okno.wolania == [],
                  okno.wolania)
            check("tryb pulpit: zdarzenie mowi, ze okno juz stalo",
                  w.get("okno", {}).get("stalo") is True, w.get("okno"))

            # f) "pulpit", gdy edytor stoi na INNYM kapslu - przestawiamy go na ten, ktory
            #    wlasnie dostal plansze; inaczej uchwyty stalyby nad cudza konfiguracja.
            okno = OknoStub(otwarte=True, tryb="edycja", dev="d3")
            w, dm, _bus = _sesja("pulpit", okno)
            check("tryb pulpit: edytor cudzego kapsla jest przestawiany na ten",
                  len(okno.wolania) == 1 and okno.wolania[0]["dev"] == "d0", okno.wolania)
        finally:
            rf._tytul_okna_na_wierzchu = _tytul_stary
            rf._front_window_by_title = _front_stary
            rf.SCAN_OVERLAY = _okno_stare

    # --- 6. PRAWDZIWY ZRZUT MONITORA ---------------------------------------------------------
    print("-- prawdziwy zrzut monitora")

    if not (sys.platform.startswith("win") and MA_PILLOW):
        skip("zrzut monitora glownego", "wymaga Windows z Pillow")
    else:
        im, info, blad = rf.zrzut_monitora("glowny")
        if blad or im is None:
            # Maszyna bez pulpitu (sesja bez okien, zdalny pulpit rozlaczony) - to nie jest blad
            # testu, ale ma byc widoczne w wyniku.
            skip("zrzut monitora glownego", blad or "brak obrazu")
        else:
            nazwa_mon = info.get("monitor") or ""
            pw, ph = rf.display_pixels(nazwa_mon)
            check("zrzut wyszedl niepusty", im.width > 0 and im.height > 0, im.size)
            # ⚠️ TO JEST TEST SWIADOMOSCI DPI. Bez przelaczenia watku na PER_MONITOR `ImageGrab`
            # oddaje obraz ZWIRTUALIZOWANY: przy powiekszeniu 150% monitor 2560x1600 daje plik
            # 1707x1067 - mniejszy i rozmyty, czyli plansze, po ktorej nie da sie mierzyc.
            if pw > 0 and ph > 0:
                check("zrzut ma PRAWDZIWA rozdzielczosc monitora, nie kursorowa",
                      (im.width, im.height) == (pw, ph),
                      "zrzut %dx%d, monitor %dx%d" % (im.width, im.height, pw, ph))
                check("przy zgodnym rozmiarze nie ma ostrzezenia", "uwaga" not in info, info)
            else:
                skip("porownanie z trybem monitora", "nie udalo sie odczytac trybu ekranu")
            check("info niesie nazwe urzadzenia monitora", bool(nazwa_mon), info)
            im.close()
finally:
    rf.SETTINGS_DIR, rf.SCAN_TLA_DIR, rf.HOTKEY_CONFIG_FILE = _stare
    shutil.rmtree(_tmp, ignore_errors=True)


# --- 8. MARKUP SEKCJI W KARCIE ---------------------------------------------------------------
# Dwie rzeczy, ktorych nie widac w konfiguracji, a ktore decyduja o tym, czy czlowiek te funkcje
# w ogole znajdzie i co dostanie fabrycznie. Grep po zrodle, jak w `test_hotkey` - przegladarki
# do tego nie trzeba, a regresja jest jednoznakowa (`open` usuniete, `"panel"` wpisane z powrotem).
print("\n-- markup sekcji (rf-50o)")
with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "web", "js", "rf-50o-scan-zrzut-skrot.js"), "r", encoding="utf-8") as _f:
    _zr_js = _f.read()
# Od UX 261120 (D12) sekcja stoi ZWINIETA, ale jej naglowek mowi droge: stan, klawisze, „Ustaw".
check("sekcja zrzutu stoi zwinieta, z podsumowaniem w naglowku",
      'id="scanSkrot">' in _zr_js and 'id="scanSkrot" open>' not in _zr_js
      and 'id="skrotSumStan"' in _zr_js and 'id="skrotSumKlawisze"' in _zr_js and 'id="skrotUstaw"' in _zr_js)
check("panel podswietla te sama fabryczna pigulke, co serwer",
      ('c.poZrzucie || "%s"' % rf.ZRZUT_PO_DEFAULT) in _zr_js
      and ('m.poZrzucie || "%s"' % rf.ZRZUT_PO_DEFAULT) in _zr_js)

print("\n%d passed, %d failed, %d skipped" % (_passed, _failed, _skipped))
sys.exit(1 if _failed else 0)
