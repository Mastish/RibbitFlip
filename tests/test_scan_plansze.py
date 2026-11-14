"""SKANER - KASOWANIE PLANSZY (2026-09-21).

Dwa zgloszenia, jedno o bledzie i jedno o braku:

  1. "jak usune ostatnia plansze w skanerze - dodaja sie trzy nowe". Kasowanie dzialalo; plansze
     odbudowywala SANITYZACJA biegnaca zaraz po nim. Migracja ze starego pola `tlo` (zrzut lezal
     przy skanerze do 16.09) ruszala zawsze, gdy spis plansz wyszedl pusty - a pusty spis znaczy
     dwie rozne rzeczy: "stara konfiguracja, plansz jeszcze nie bylo" i "wlasnie skasowalem
     ostatnia". Trzy plansze, bo w trzech skanerach lezaly trzy rozne pliki.

  2. "moze usuniecie planszy niech usowa sie razem z grafika podegrana". Plik zostawal
     w `Settings/ScanTla` na zawsze - w jednej instancji lezaly dwa, na ktore nie wskazywalo
     juz nic.

Czego pilnuje ten plik, po kolei: ze migracja NADAL dziala dla starych konfiguracji (bo po to
jest), ze pusty spis podany wprost jest odpowiedzia, ze skasowana plansza zabiera swoje `tlo`
(inaczej wraca pod podglad tylnymi drzwiami) i ze plik ginie TYLKO wtedy, gdy nikt inny na niego
nie wskazuje - ani drugi kapsel, ani zapisany plik w Bibliotece.

Bez znakow spoza ASCII w print() - konsola cp1250.
"""
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


# --- 1. MIGRACJA: kiedy ma ruszyc, a kiedy nie ------------------------------------------------
print("-- migracja ze starego `tlo`")

def _stara(sekcje, akt=1):
    """Konfiguracja w ksztalcie, w jakim zapisuje ja aplikacja.

    ⚠️ PLASKIE POLA SA SEKCJA AKTYWNA (patrz `_sekcje_out`), wiec `tlo` na wierzchu jest kopia
    `tlo` sekcji aktywnej - tak wyglada kazdy prawdziwy plik (sprawdzone na prawdziwej
    konfiguracji: `sekcjaAktywna: 3`, a na wierzchu zrzut trzeciego skanera). Atrapa bez tego
    lustra mierzy wlasna pomylke: sanityzator nadpisuje sekcje aktywna polami plaskimi, czyli
    czysci jej zrzut, i test widzi o jedna plansze za malo."""
    out = {"sekcje": [dict(s) for s in sekcje], "sekcjaAktywna": akt}
    out["tlo"] = sekcje[akt - 1].get("tlo", "")
    return out


STARA = _stara([{"nazwa": "Plansza 4x4", "tlo": "a-11111111.jpg"},
                {"nazwa": "Caly ekran", "tlo": "b-22222222.jpg"},
                {"nazwa": "Panel opcji", "tlo": "c-33333333.jpg"}])

d = rf.ScanModule.sanitize(dict(STARA))
check("konfiguracja bez klucza `zrzuty` dostaje plansze z `tlo`", len(d["zrzuty"]) == 3,
      [z["plik"] for z in d["zrzuty"]])
check("migracja zachowuje pliki", [z["plik"] for z in d["zrzuty"]] ==
      ["a-11111111.jpg", "b-22222222.jpg", "c-33333333.jpg"], [z["plik"] for z in d["zrzuty"]])
check("migracja przypisuje skaner do swojej planszy",
      [z["sekcje"] for z in d["zrzuty"]] == [[1], [2], [3]], [z["sekcje"] for z in d["zrzuty"]])

# Dwa skanery zrobione na TYM SAMYM zrzucie zostaja jedna plansza - to jest powod, dla ktorego
# migracja grupuje po pliku, a nie przepisuje sekcja po sekcji.
d = rf.ScanModule.sanitize(_stara([{"nazwa": "A", "tlo": "a-11111111.jpg"},
                                   {"nazwa": "B", "tlo": "a-11111111.jpg"}]))
check("ten sam plik w dwoch skanerach daje jedna plansze", len(d["zrzuty"]) == 1, d["zrzuty"])
check("jedna plansza niesie oba skanery", d["zrzuty"][0]["sekcje"] == [1, 2], d["zrzuty"][0])

# TO JEST BLAD Z ZGLOSZENIA. Pusty spis PODANY WPROST znaczy "nie ma plansz", a nie "policz je
# sobie sam ze starego pola".
zle = dict(STARA)
zle["zrzuty"] = []
d = rf.ScanModule.sanitize(zle)
check("pusty spis podany wprost zostaje pusty", d["zrzuty"] == [], d["zrzuty"])
check("pusty spis daje `zrzutAktywny` = 0", d["zrzutAktywny"] == 0, d["zrzutAktywny"])

# ...a spis, ktory JEST, nie dostaje niczego z `tlo` w prezencie.
d = rf.ScanModule.sanitize(dict(STARA, zrzuty=[{"plik": "d-44444444.jpg", "nazwa": "Menu",
                                                "sekcje": [1]}]))
check("podany spis nie jest uzupelniany z `tlo`", len(d["zrzuty"]) == 1, d["zrzuty"])
check("podany spis zostaje taki, jaki byl", d["zrzuty"][0]["plik"] == "d-44444444.jpg",
      d["zrzuty"][0])


# --- 2. KASOWANIE PLANSZY --------------------------------------------------------------------
print("-- kasowanie planszy")


def _modul(cfg=None):
    m = rf.ScanModule(BusStub(), "d0")
    if cfg is not None:
        m.cfg = rf.ScanModule.sanitize(cfg)
    return m


mod = _modul(dict(STARA))
check("start: trzy plansze z migracji", len(mod.cfg["zrzuty"]) == 3, mod.cfg["zrzuty"])
mod.screens_edit("usun", n=3)
check("po skasowaniu trzeciej zostaja dwie", len(mod.cfg["zrzuty"]) == 2, mod.cfg["zrzuty"])
mod.screens_edit("usun", n=2)
check("po skasowaniu drugiej zostaje jedna", len(mod.cfg["zrzuty"]) == 1, mod.cfg["zrzuty"])
cfg = mod.screens_edit("usun", n=1)
check("po skasowaniu OSTATNIEJ spis jest pusty", cfg["zrzuty"] == [], cfg["zrzuty"])
check("po skasowaniu ostatniej nie wracaja trzy nowe", len(mod.cfg["zrzuty"]) == 0,
      mod.cfg["zrzuty"])
check("pusty spis nie wskazuje zadnej planszy", mod.cfg["zrzutAktywny"] == 0,
      mod.cfg["zrzutAktywny"])
check("skanery zostaja na miejscu", len(mod.cfg["sekcje"]) == 3, len(mod.cfg["sekcje"]))

# Skasowana plansza zabiera swoje `tlo` - inaczej panel (rf-50d `_scanMaZrzut`) bierze zrzut
# stamtad, gdy spis jest pusty, i skasowany obraz wraca pod podglad.
check("kasowanie czysci `tlo` skanerow", all(not s.get("tlo") for s in mod.cfg["sekcje"]),
      [s.get("tlo") for s in mod.cfg["sekcje"]])
check("kasowanie czysci `tlo` pol plaskich", not mod.cfg.get("tlo"), mod.cfg.get("tlo"))

# ...ale TYLKO swoje. Kasowanie jednej planszy nie ma prawa ruszyc zrzutu drugiej.
mod = _modul(dict(STARA))
mod.screens_edit("usun", n=1)
check("kasowanie nie rusza `tlo` cudzych skanerow",
      [s.get("tlo") for s in mod.cfg["sekcje"]] == ["", "b-22222222.jpg", "c-33333333.jpg"],
      [s.get("tlo") for s in mod.cfg["sekcje"]])
check("pozostale plansze zostaja", len(mod.cfg["zrzuty"]) == 2, mod.cfg["zrzuty"])

# Grupa (plansza bez obrazka) tez sie kasuje - i nie zabiera ze soba niczyjego zrzutu.
mod = _modul(_stara([{"nazwa": "A", "tlo": "a-11111111.jpg"}]))
mod.screens_edit("dodaj", nazwa="Grupa 2")
check("grupa doszla do spisu", len(mod.cfg["zrzuty"]) == 2, mod.cfg["zrzuty"])
mod.screens_edit("usun", n=2)
check("grupa sie skasowala", len(mod.cfg["zrzuty"]) == 1, mod.cfg["zrzuty"])
check("kasowanie grupy nie rusza `tlo`", mod.cfg["sekcje"][0].get("tlo") == "a-11111111.jpg",
      mod.cfg["sekcje"][0].get("tlo"))


# --- 3. PLIK ZRZUTU NA DYSKU ------------------------------------------------------------------
print("-- sprzatanie plikow zrzutow")

_stare = (rf.SETTINGS_DIR, rf.SCAN_TLA_DIR, rf.LIBRARY_DIR)
_tmp = tempfile.mkdtemp(prefix="rf-plansze-")
try:
    rf.SETTINGS_DIR = os.path.join(_tmp, "Settings")
    rf.SCAN_TLA_DIR = os.path.join(rf.SETTINGS_DIR, "ScanTla")
    rf.LIBRARY_DIR = os.path.join(_tmp, "Library")
    os.makedirs(rf.SCAN_TLA_DIR)
    os.makedirs(rf.LIBRARY_DIR)

    def _zrzut(nazwa):
        p = os.path.join(rf.SCAN_TLA_DIR, nazwa)
        with open(p, "wb") as f:
            f.write(b"\xff\xd8\xff nie-obraz-ale-plik")
        return p

    def _jest(nazwa):
        return os.path.isfile(os.path.join(rf.SCAN_TLA_DIR, nazwa))

    # a) nikt inny nie trzyma pliku -> ginie razem z plansza
    _zrzut("a-11111111.jpg")
    _zrzut("b-22222222.jpg")
    mod = _modul(_stara([{"nazwa": "A", "tlo": "a-11111111.jpg"},
                         {"nazwa": "B", "tlo": "b-22222222.jpg"}]))
    check("start: oba pliki sa", _jest("a-11111111.jpg") and _jest("b-22222222.jpg"))
    mod.screens_edit("usun", n=1)
    check("plik skasowanej planszy zniknal z dysku", not _jest("a-11111111.jpg"))
    check("plik planszy, ktora zostala, lezy dalej", _jest("b-22222222.jpg"))

    # b) ten sam zrzut na planszy DRUGIEGO kapsla -> plik zostaje
    _zrzut("a-11111111.jpg")
    os.makedirs(os.path.join(rf.SETTINGS_DIR, "d1"), exist_ok=True)
    with open(os.path.join(rf.SETTINGS_DIR, "d1", "ribbitflip_scan.json"), "w",
              encoding="utf-8") as f:
        json.dump({"zrzuty": [{"plik": "a-11111111.jpg", "nazwa": "Menu", "sekcje": [1]}]}, f)
    mod = _modul(_stara([{"nazwa": "A", "tlo": "a-11111111.jpg"}]))
    mod.screens_edit("usun", n=1)
    check("zrzut uzywany przez drugi kapsel zostaje na dysku", _jest("a-11111111.jpg"))
    check("`kto_uzywa` nazywa kapsla po imieniu",
          rf.scan_tlo_kto_uzywa("a-11111111.jpg", "d0") == "kapsel d1",
          rf.scan_tlo_kto_uzywa("a-11111111.jpg", "d0"))

    # c) ten sam zrzut w zapisanym pliku Biblioteki -> plik zostaje
    shutil.rmtree(os.path.join(rf.SETTINGS_DIR, "d1"))
    os.makedirs(os.path.join(rf.LIBRARY_DIR, "ScanPresets"), exist_ok=True)
    with open(os.path.join(rf.LIBRARY_DIR, "ScanPresets", "Sol Cesto.json"), "w",
              encoding="utf-8") as f:
        json.dump({"kind": "scan-preset", "name": "Sol Cesto",
                   "config": {"zrzuty": [{"plik": "a-11111111.jpg", "nazwa": "Plansza",
                                          "sekcje": [1]}]}}, f)
    mod = _modul(_stara([{"nazwa": "A", "tlo": "a-11111111.jpg"}]))
    mod.screens_edit("usun", n=1)
    check("zrzut z zapisanego presetu zostaje na dysku", _jest("a-11111111.jpg"))
    check("`kto_uzywa` nazywa plik po imieniu",
          rf.scan_tlo_kto_uzywa("a-11111111.jpg", "d0") == 'zapisany plik „Sol Cesto”',
          rf.scan_tlo_kto_uzywa("a-11111111.jpg", "d0"))

    # d) ten sam zrzut pod DRUGA plansza tej samej konfiguracji -> plik zostaje
    os.remove(os.path.join(rf.LIBRARY_DIR, "ScanPresets", "Sol Cesto.json"))
    # Dwa skanery ustawione na TYM SAMYM zrzucie: sanityzator scala je w jedna plansze, wiec
    # jej skasowanie musi zabrac `tlo` obu - inaczej plik zostaje przy zyciu bez planszy.
    mod = _modul(_stara([{"nazwa": "A", "tlo": "a-11111111.jpg"},
                         {"nazwa": "B", "tlo": "a-11111111.jpg"}]))
    check("dwa skanery na jednym zrzucie to jedna plansza", len(mod.cfg["zrzuty"]) == 1,
          mod.cfg["zrzuty"])
    mod.screens_edit("usun", n=1)
    check("kasowanie czysci `tlo` OBU skanerow tego zrzutu",
          all(not s.get("tlo") for s in mod.cfg["sekcje"]),
          [s.get("tlo") for s in mod.cfg["sekcje"]])
    check("plik zniknal, bo nikt juz na niego nie wskazuje", not _jest("a-11111111.jpg"))

    # e) "zdejmij" (sam obraz z planszy) tez sprzata - to ta sama droga
    _zrzut("e-55555555.jpg")
    mod = _modul({"sekcje": [{"nazwa": "A"}], "sekcjaAktywna": 1,
                  "zrzuty": [{"plik": "e-55555555.jpg", "nazwa": "Menu", "sekcje": [1]}]})
    mod.screens_edit("zdejmij", n=1)
    check("po `zdejmij` plansza zostaje jako grupa", len(mod.cfg["zrzuty"]) == 1
          and not mod.cfg["zrzuty"][0]["plik"], mod.cfg["zrzuty"])
    check("po `zdejmij` plik zniknal z dysku", not _jest("e-55555555.jpg"))

    # f) samo przelaczanie plansz niczego nie kasuje
    _zrzut("f-66666666.jpg")
    mod = _modul({"sekcje": [{"nazwa": "A"}], "sekcjaAktywna": 1,
                  "zrzuty": [{"plik": "f-66666666.jpg", "nazwa": "Menu", "sekcje": [1]}]})
    mod.screens_edit("wybierz", n=0)
    mod.screens_edit("wybierz", n=1)
    mod.screens_edit("nazwij", n=1, nazwa="Inaczej")
    check("wybieranie i nazywanie nie kasuje pliku", _jest("f-66666666.jpg"))

    # g) nieistniejacy plik nie wywraca kasowania planszy
    mod = _modul(_stara([{"nazwa": "A", "tlo": "g-77777777.jpg"}]))
    cfg = mod.screens_edit("usun", n=1)
    check("plansza ze zrzutem, ktorego nie ma na dysku, kasuje sie normalnie",
          cfg is not None and cfg["zrzuty"] == [], cfg)
finally:
    rf.SETTINGS_DIR, rf.SCAN_TLA_DIR, rf.LIBRARY_DIR = _stare
    shutil.rmtree(_tmp, ignore_errors=True)


print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
