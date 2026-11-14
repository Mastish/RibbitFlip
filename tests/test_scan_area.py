# GDZIE SKANER MA DZIALAC + SEKCJE. Uruchom: py tests/test_scan_area.py
#
# DWA ZLECENIA WLASCICIELA Z 2026-09-13, jedno po drugim:
#
#   „chce, zeby mozna bylo ustalic gdzie skaner ma dzialac. czyli przykladowo chce tylko na dolnej
#    1/3 ekranu na srodku (…) wtedy uzytkownik moze konkretne sekcje gier obslugiwac"
#   „ustalajac pozycje powinno dac sie wybrac proporcjonalne polozenie na ekranie, ale i pikselowy
#    zakres od do. bedzie to istotne w niektorych aplikacjach i parametrach ekranow"
#   „preset moze miec zdefiniowane np 3 rozne skanery. przy edycji pozwol wybrac ktory edytujesz"
#   „kolo wyboru to tylko przyklad. jesli cos innego wyzwoli skaner 1 — wtedy powinna pokazac sie
#    wybrana wersja skanera zapisana w danym presecie"
#
# CO TU JEST PRZYKLEJONE, i dlaczego kazde z tego jest decyzja:
#
#   * OBSZAR to pokretlo jak kazde inne — jedzie w presecie i w sekcji, wiec „sekcja" i „miejsce"
#     nie sa dwiema rzeczami do uzgadniania,
#   * od–do jest ZAWSZE od–do: prostokat narysowany od prawej do lewej to ten sam prostokat,
#     a zerowa szerokosc to pasek, ktory nie ma sie gdzie ruszyc,
#   * PLASKIE POLA KONFIGURACJI SA SEKCJA AKTYWNA. Jeden pisarz w kazda strone: zapis pokretel
#     przepisuje je do spisu, `activate_section` w druga. Dzieki temu silnik, scena, okno nad
#     pulpitem i presety nie wiedza, ze sekcje istnieja,
#   * SPIS SEKCJI NIE WCHODZI PRZEZ `/scan`. Zapis pokretel jest opozniony o 400 ms, wiec zalegly
#     pakiet niosl spis sprzed dodania sekcji i kasowal ja z powrotem (zlapane w klik-through),
#   * `scan:sekcja=N` to NUMER, nie nazwa: nazwe zmienia sie w biegu, a wpisana w regule zerwalaby
#     sie po cichu,
#   * przelaczenie sekcji NIE WLACZA modulu. Wlacznik to zgoda czlowieka na to, zeby cos przejelo
#     mu caly ekran — wyzwalacz z cudzego zestawu nie ma prawa jej udzielic za niego.
import os
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


def _read(*parts):
    with open(os.path.join(_ROOT, *parts), "r", encoding="utf-8") as f:
        return f.read()


class _Bus:
    def __init__(self):
        self.ev = []

    def now(self):
        return 0.0

    def publish(self, e):
        self.ev.append(e)


def _mod():
    return rf.ScanModule(_Bus(), "d0")


S = rf.ScanModule

print("--- obszar: pole jak kazde inne, wiec jedzie w presecie i w sekcji ---")
c = S.sanitize({})
check("domyslnie caly pulpit, procenty, 0..100 — czyli tak, jak bylo przed ta zmiana",
      c["obszar"] == "caly" and c["obszarJednostka"] == "procent"
      and (c["obszarX1"], c["obszarY1"], c["obszarX2"], c["obszarY2"]) == (0.0, 0.0, 100.0, 100.0), c["obszar"])
check("obie jednostki sa dozwolone (potrzebne sa obie)",
      S.sanitize({"obszarJednostka": "piksele"})["obszarJednostka"] == "piksele"
      and S.sanitize({"obszarJednostka": "cale"})["obszarJednostka"] == "procent")
check("nieznany rodzaj obszaru wraca do calego pulpitu, a nie do pustego prostokata",
      S.sanitize({"obszar": "bzdura"})["obszar"] == "caly")
c = S.sanitize({"obszar": "wlasny", "obszarJednostka": "procent",
                "obszarX1": 80, "obszarX2": 20, "obszarY1": 90, "obszarY2": 10})
check("od–do zamienione miejscami to TEN SAM prostokat, nie blad",
      (c["obszarX1"], c["obszarX2"], c["obszarY1"], c["obszarY2"]) == (20.0, 80.0, 10.0, 90.0), c)
c = S.sanitize({"obszar": "wlasny", "obszarJednostka": "procent",
                "obszarX1": 50, "obszarX2": 50, "obszarY1": 10, "obszarY2": 90})
check("zerowa szerokosc wraca do pelnej — pasek musi miec sie gdzie ruszyc",
      c["obszarX1"] == 0.0 and c["obszarX2"] == 100.0 and c["obszarY2"] == 90.0, c)
c = S.sanitize({"obszar": "wlasny", "obszarJednostka": "procent", "obszarX2": 999})
check("w procentach sufitem jest 100, nie 32000", c["obszarX2"] == 100.0, c["obszarX2"])
c = S.sanitize({"obszar": "wlasny", "obszarJednostka": "piksele", "obszarX1": 100, "obszarX2": 3000})
check("...a w pikselach 3000 px to normalna wartosc", c["obszarX2"] == 3000.0, c["obszarX2"])
check("nazwa ekranu jest tekstem i ma sufit dlugosci",
      len(S.sanitize({"obszarMonitor": "x" * 500})["obszarMonitor"]) == 80)

print("\n--- sekcje: plaskie pola SA sekcja aktywna ---")
m = _mod()
c = m.get_config()
check("konfiguracja bez sekcji dostaje jedna, zbudowana z siebie — nie ma stanu 'bez sekcji'",
      len(c["sekcje"]) == 1 and c["sekcjaAktywna"] == 1 and c["sekcje"][0]["nazwa"], c["sekcje"])
check("sekcja nie niesie wlacznika modulu, nazwy presetu ani spisu sekcji",
      all(k not in c["sekcje"][0] for k in S._POZA_SEKCJA), list(c["sekcje"][0].keys())[:8])
c = m.sections_edit("dodaj", nazwa="Radar prawy")
check("nowa sekcja to KOPIA aktywnej, nie pusta kartka", len(c["sekcje"]) == 2 and c["sekcjaAktywna"] == 2)
u = dict(c)
u.update({"tryb": "radar", "obszar": "wlasny", "obszarX1": 50, "obszarY1": 0,
          "obszarX2": 100, "obszarY2": 100})
m.set_config(u)
c = m.get_config()
check("zmiana pokretla trafia TYLKO do sekcji aktywnej",
      c["sekcje"][1]["tryb"] == "radar" and c["sekcje"][0]["tryb"] == "pasy",
      (c["sekcje"][0]["tryb"], c["sekcje"][1]["tryb"]))
c = m.activate_section(1)
check("przelaczenie wraca do PELNYCH ustawien tamtej sekcji",
      c["sekcjaAktywna"] == 1 and c["tryb"] == "pasy" and c["obszar"] == "caly", (c["tryb"], c["obszar"]))
check("...i nie rusza sekcji, z ktorej wychodzimy",
      c["sekcje"][1]["tryb"] == "radar" and c["sekcje"][1]["obszarX1"] == 50.0)
c = m.activate_section(2)
check("i z powrotem", c["sekcjaAktywna"] == 2 and c["tryb"] == "radar" and c["obszarX1"] == 50.0)
check("sekcji poza zakresem nie ma — zwracamy None zamiast po cichu przelaczyc na cos innego",
      m.activate_section(9) is None and m.activate_section("abc") is None)
m2 = _mod()
for i in range(S.SEKCJI_MAX + 3):
    m2.sections_edit("dodaj")
check("sufit sekcji to %d" % S.SEKCJI_MAX, len(m2.get_config()["sekcje"]) == S.SEKCJI_MAX,
      len(m2.get_config()["sekcje"]))
m3 = _mod()
check("ostatniej sekcji nie da sie usunac — skaner bez sekcji nie ma czego pokazac",
      m3.sections_edit("usun", 1) is None)
m3.sections_edit("dodaj", nazwa="Druga")
c = m3.sections_edit("usun", 2)
check("usuniecie aktywnej przenosi na sasiada, a plaskie pola ida za nia",
      len(c["sekcje"]) == 1 and c["sekcjaAktywna"] == 1)
c = m3.sections_edit("nazwij", 1, "Dolna listwa")
check("nazwanie", c["sekcje"][0]["nazwa"] == "Dolna listwa")
check("sekcja bez nazwy dostaje numer, a nie pusty wiersz w liscie",
      S.sanitize({"sekcje": [{"tryb": "pasy"}, {"tryb": "radar"}]})["sekcje"][1]["nazwa"] == "Sekcja 2")

print("\n--- spis sekcji NIE wchodzi przez /scan (zalegly zapis pokretel go kasowal) ---")
_py = _read("ribbitflip_monitor.py")
# ⚠️ Dzielimy po KOMENTARZU, nie po `if path == "/scan":` — ten sam napis konczy takze
# `elif path == "/scan":` w galezi GET, wiec split trafial w tamta i sprawdzal nie ten kod.
_h = _py.split("# SKANER per kapsel.")[1].split('if path == "/scan-preset/save":')[0]
check("endpoint podmienia sekcje na te, ktore modul ma TERAZ",
      'dd["sekcje"] = _teraz.get("sekcje")' in _h and 'dd["sekcjaAktywna"] = _teraz.get("sekcjaAktywna")' in _h)
check("...a spis ma wlasne wejscie", '/scan/sekcja' in _py and "def sections_edit" in _py)
check("panel tez nie stosuje odpowiedzi, jesli w miedzyczasie cos sie zmienilo",
      "nr === _SCAN.zapisNr" in _read("web", "js", "rf-50d-scan-card.js"))

print("\n--- `scan:sekcja=N`: numer, bezpieczny, bramkowany modulem ---")
check("parser bierze 1..%d i nic poza tym" % S.SEKCJI_MAX,
      rf.parse_scan_section("scan:sekcja=3") == 3 and rf.parse_scan_section("scan:sekcja3") == 3
      and rf.parse_scan_section("scan:sekcja=0") is None
      and rf.parse_scan_section("scan:sekcja=%d" % (S.SEKCJI_MAX + 1)) is None
      and rf.parse_scan_section("scan:sygnal") is None and rf.parse_scan_section("a") is None)
check("klasyfikator importu: bezpieczne (nic nie wychodzi z komputera)",
      rf._classify_spec("scan:sekcja=2")[0] == "safe")
check("...a zly numer jest ryzykowny i mowi, co wolno",
      rf._classify_spec("scan:sekcja=99")[0] == "risky"
      and "1..%d" % S.SEKCJI_MAX in rf._classify_spec("scan:sekcja=99")[1])
e = rf.TriggerEngine.__new__(rf.TriggerEngine)
e.enabled = False
e.pad_on = lambda: True
e.scan_on = lambda: True
check("przy wlaczonym module przechodzi nawet bez grupy Mapowanie", e._gate_for("scan:sekcja=2") is True)
e.scan_on = lambda: False
check("przy wylaczonym module NIE przechodzi — sekcja nie uzbraja skanera za czlowieka",
      e._gate_for("scan:sekcja=2") is False and e._gate_for("scan:stop") is True)

print("\n--- droga wyzwalacza: przelacza sekcje i pokazuje ja ---")
_pokazane = []
_zap = rf._scan_overlay_show
rf._scan_overlay_show = lambda dev: _pokazane.append(dev) or True
try:
    m = _mod()
    m.sections_edit("dodaj", nazwa="Radar")
    u = dict(m.get_config()); u["tryb"] = "radar"; m.set_config(u)
    m.activate_section(1)
    out = rf.SlotOutput(None, None, m)
    ok = out.tap("scan:sekcja=2")
    check("tap przelacza aktywna sekcje i mowi, ze cos zrobil",
          ok is True and m.get_config()["sekcjaAktywna"] == 2 and m.get_config()["tryb"] == "radar")
    check("...i pokazuje okno nad pulpitem", _pokazane == ["d0"], _pokazane)
    check("sekcja, ktorej nie ma, nie udaje sukcesu", out.tap("scan:sekcja=6") is False)
    check("zwykle sygnaly ida jak dotad", out.tap("scan:sygnal") is True and out.up("scan:sygnal") is True)
finally:
    rf._scan_overlay_show = _zap
check("adres okna bierze sie z wlasnego portu (ta droga nie ma zadania HTTP)",
      "APP_BASE_URL" in _py and 'APP_BASE_URL = "http://127.0.0.1:%d" % int(args.port)' in _py)

print("\n--- 'konfiguracja sie zmienila' dociera do okna nad pulpitem ---")
m = _mod()
m.b.ev = []
u = dict(m.get_config()); u["predkosc"] = 1234
m.set_config(u)
check("zapis, ktory cos zmienil, rozglasza scan_cfg",
      [e["t"] for e in m.b.ev] == ["scan_cfg"], [e["t"] for e in m.b.ev])
m.b.ev = []
m.set_config(m.get_config())
check("...a zapis bez zmian milczy (inaczej kazdy ruch suwaka to pakiet)", m.b.ev == [])
m.b.ev = []
m.sections_edit("dodaj")
check("zmiana spisu tez rozglasza", [e["t"] for e in m.b.ev] == ["scan_cfg"])
check("pakiet jest PUSTY — okno i tak odpytuje /scan o calosc",
      all("sekcje" not in e for e in m.b.ev))
check("okno slucha tego i odswieza tez uklad monitorow",
      'm.t === "scan_cfg"' in _read("web", "js", "rf-50h-scan-overlay.js")
      and "wczytajEkrany().then(wczytajUstawienia)" in _read("web", "js", "rf-50h-scan-overlay.js"))

print("\n--- klucze po obu stronach + panel ---")
_m50 = _read("web", "js", "rf-50-scan-model.js")
for k in ("obszar", "obszarMonitor", "obszarJednostka", "obszarX1", "obszarY1", "obszarX2",
          "obszarY2", "sekcje", "sekcjaAktywna"):
    check("klucz `%s` jest po obu stronach" % k, k in S.DEFAULTS and (k + ":") in _m50)
_f50b = _read("web", "js", "rf-50b-scan-fields.js")
check("panel ma sekcje 'Gdzie skaner ma dzialac'", "Gdzie skaner ma działać" in _f50b)
check("...z gotowymi ksztaltami i jednostka", "'ksztalty'" in _f50b and "obszarJednostka" in _f50b)
check("...i z lista monitorow z serwera", "'EKRANY'" in _f50b and "ekranyOpcje" in _m50)
check("zmiana jednostki przelicza liczby, zeby prostokat nie skakal",
      "przeliczJednostke" in _m50 and "przeliczJednostke" in _f50b)
check("cwiartki: liczba pol wszerz i wzdluz zamiast czterech gotowych par",
      "typ: 'siatka'" in _f50b and "'2 × 2'" not in _f50b)
_f50h = _read("web", "js", "rf-50h-scan-overlay.js")
check("okno nad pulpitem liczy KLIK z calego okna, a pasek z obszaru",
      # Od 26.09 procent kliku liczy `procentPulpitu`: przy oknie na jednym z kilku monitorow
      # doklada przesuniecie tego ekranu wzgledem calego pulpitu (tests/test_scan_ekrany.py).
      "RFScan.procentPulpitu(wynik.punkt, ekrany, pelne())" in _f50h
      # Od 26.09 obszar liczy sie ze skanerem „przypietym" do jego ekranu (`zMonitorem`): okno
      # na innym monitorze nie moze rysowac u siebie obszaru, ktory lezy obok.
      and "RFScan.obszarEkranu(RFScan.zMonitorem(u, RFScan.ekranyPelne(ekrany)), pelne(), ekrany)" in _f50h)
check("pasek sekcji podpowiada, co wpisac w wyzwalacz",
      '"scan:sekcja=" + akt' in _read("web", "js", "rf-50k-scan-sections.js"))
check("...i jest ladowany w panelu", "rf-50k-scan-sections.js" in _read("web", "ribbitflip_dashboard.html"))
_f10 = _read("web", "js", "rf-10-triggers-model.js")
check("akcje sekcji sa na liscie szybkiego wyboru (kolo i reguly biora z niej)",
      '["scan:sekcja=1"' in _f10 and '["scan:sekcja=4"' in _f10)

print("\n--- ZESTAW niesie skaner (dolozone po rebuildzie) ---")
# „nie widze, zeby solcesto bylo aktywnym zestawem" — bo zestaw POWSTAL przed modulem Skaner
# (11.09) i nikt go nie dopisal do SETUP_KEYS. Paczka pod gre nie miala wiec jak przyniesc
# ustawien skanera ani jego sekcji.
check("skaner jest grupa zestawu", "scan" in rf.SETUP_KEYS)
check("...i wchodzi do pliku razem z sekcjami", '"scan": d.scan.get_config()' in _py)
check("...a jego WLACZNIK nie — zestaw nigdy nie uzbraja",
      '"scan": ("enabled",)' in _py)
check("apply_setup zapisuje skaner i przepisuje wlacznik wprost (set_config ZASTEPUJE, nie laczy)",
      'applied.append("scan")' in _py and '_scfg["enabled"] = d.scan.enabled' in _py)
check("podglad wie, co autor mial wlaczone i co zestaw wymieni",
      'if isinstance(sc, dict) and sc.get("enabled")' in _py
      and '("scan", ("scan", "configName"), "scan")' in _py)
check("lista grup paczki bierze sie z SETUP_KEYS, a nie z wlasnej kopii",
      "a[\"groups\"] = [g for g in SETUP_KEYS" in _py)
check("panel nazywa te grupe po ludzku, a nie 'scan'",
      'scan:["Skaner","Scanner"]' in _read("web", "js", "rf-28-setups.js")
      and 'key==="scan"' in _read("web", "js", "rf-39j-hotkey.js"))

import json as _json
_zestaw = os.path.join(_ROOT, "Library", "Setups", "Sol Cesto (skaner).json")
if os.path.exists(_zestaw):
    _z = _json.load(open(_zestaw, encoding="utf-8"))
    _s = _z["devices"][0]["setup"]
    _a = rf.analyze_config(_s)
    check("paczka Sol Cesto: podglad widzi skaner i nie ma w niej nic ryzykownego",
          "scan" in _a["groups"] and _a["riskyCount"] == 0 and _a["level"] == "safe", _a["groups"])
    check("...niesie trzy sekcje", [x["nazwa"] for x in _s["scan"]["sekcje"]]
          == ["Plansza 4×4", "Cały ekran", "Panel opcji"],
          [x["nazwa"] for x in _s["scan"]["sekcje"]])
    check("...ma sygnal i cofanie WLACZONE, a przelaczniki sekcji WYLACZONE (nic nie robi za czlowieka)",
          sum(1 for r in _s["rules"] if r.get("enabled")) == 2
          and all(not r.get("enabled") for r in _s["rules"] if "sekcja" in (r.get("keySpec") or "")))
    check("...i mowi grze, do czego jest", _z.get("exe") == ["solcesto.exe"], _z.get("exe"))
else:
    check("paczka Sol Cesto lezy w Library/Setups", False, _zestaw)

print("\n--- DZIELENIE SIE wie o obszarze i o sekcjach ---")
# „i dzielenie sie tez niech bedzie ogarniete pod ta architekture" — bo opis, ktory czyta osoba
# POBIERAJACA plik, milczal o dwoch rzeczach, ktore preset od 13.09 niesie: gdzie skaner pracuje
# i ile ma sekcji. Przemilczenie obszaru jest tu najdrozsze: prostokat spod czyjegos ekranu
# wypada gdzie indziej i skaner wyglada na zepsuty.
_kinds = _read("web", "js", "rf-49-kinds.js")
_scan_kind = _kinds.split("  scan: {")[1].split("  midi: {")[0]
check("opis presetu skanera mowi o OBSZARZE", "OBSZAR" in _scan_kind and "AREA" in _scan_kind)
check("...i o sekcjach, razem z zapisem, ktorym sie je przelacza",
      "scan:sekcja=N" in _scan_kind and "sekcje" in _scan_kind and "every section saved in it" in _scan_kind)
check("...a podpowiedz kaze sprawdzic obszar u siebie",
      "Sprawdź też obszar każdej sekcji" in _scan_kind and "Check each section's area" in _scan_kind)
check("preset dalej NIE niesie wlacznika modulu (to sie nie zmienilo)",
      "Nie niesie włącznika modułu" in _scan_kind)
_share = _read("web", "js", "rf-39f-share.js")
check("kreator podpowiada domene 'Dostepnosc', gdy skaner jest wlaczony",
      'rfPostOn("scanEnable")' in _share and 't.g === "accessibility"' in _share)
check("...i NIE wymysla taga modulu, ktorego serwer nie ma",
      '"Skaner"' not in _share and '"Scanner"' not in _share)

print("--- ekrany interfejsu: jeden zrzut, kilka skanerow (i ten sam skaner na kilku ekranach) ---")
# Jeden wgrany zrzut moze miec przypisane skanery 1 i 2, a drugi na przyklad 1, 3 i 4; chodzi
# o obsluge interfejsow kapslem. Przypisanie trzyma EKRAN, bo tylko wtedy ten sam skaner moze byc na kilku.
_baza = {"tlo": "menu-11111111.jpg",
         "sekcje": [{"nazwa": "A", "tlo": "menu-11111111.jpg"},
                    {"nazwa": "B", "tlo": "menu-11111111.jpg"},
                    {"nazwa": "C", "tlo": "plansza-22222222.jpg"}],
         "sekcjaAktywna": 1}
_c = S.sanitize(_baza)
check("stary zrzut przy sekcji zamienia sie w EKRAN (migracja)", len(_c["zrzuty"]) == 2,
      [(z["nazwa"], z["sekcje"]) for z in _c["zrzuty"]])
check("sekcje z TYM SAMYM zrzutem laduja na jednym ekranie, a nie na dwoch identycznych",
      _c["zrzuty"][0]["sekcje"] == [1, 2] and _c["zrzuty"][1]["sekcje"] == [3],
      [(z["plik"], z["sekcje"]) for z in _c["zrzuty"]])
check("po migracji otwarty jest ten ekran, na ktorym pracuje edytowany skaner",
      _c["zrzutAktywny"] == 1, _c["zrzutAktywny"])
_c["zrzuty"][1]["sekcje"] = [1, 3]
_c2 = S.sanitize(_c)
check("ten sam skaner wolno wpisac na dwa ekrany",
      _c2["zrzuty"][0]["sekcje"] == [1, 2] and _c2["zrzuty"][1]["sekcje"] == [1, 3],
      [z["sekcje"] for z in _c2["zrzuty"]])
_smiec = S.sanitize({"sekcje": [{"nazwa": "A"}, {"nazwa": "B"}],
                     "zrzuty": [{"plik": "../tajne.jpg", "sekcje": [1]},
                                {"plik": "ok-12345678.jpg", "sekcje": [1, 9, "x"]},
                                {"plik": "ok-12345678.jpg", "sekcje": [2]}]})
check("sciezka zamiast nazwy zrzutu wypada z listy", len(_smiec["zrzuty"]) == 1,
      [z["plik"] for z in _smiec["zrzuty"]])
check("numer skanera spoza spisu i smiec zamiast liczby tez wypadaja",
      _smiec["zrzuty"][0]["sekcje"] == [1, 2], _smiec["zrzuty"][0]["sekcje"])
check("ten sam plik dwa razy to JEDEN ekran (przypisania sie sumuja)",
      len(_smiec["zrzuty"]) == 1 and _smiec["zrzuty"][0]["sekcje"] == [1, 2])
check("jawne zero zostaje zerem: zaden ekran, czyli piaskownica i wszystkie obrysy",
      S.sanitize(dict(_c2, zrzutAktywny=0))["zrzutAktywny"] == 0)
check("brak klucza wybiera ekran edytowanego skanera",
      S.sanitize({k: v for k, v in _c2.items() if k != "zrzutAktywny"})["zrzutAktywny"] == 1)
check("numer ekranu spoza spisu nie udaje, ze cos wybrano",
      S.sanitize(dict(_c2, zrzutAktywny=9))["zrzutAktywny"] == 0)

_m = _mod()
_m.set_config({"sekcje": [{"nazwa": "1"}, {"nazwa": "2"}, {"nazwa": "3"}, {"nazwa": "4"}], "sekcjaAktywna": 1})
_m.screens_edit("dodaj", plik="menu-11111111.jpg", nazwa="Menu")
_m.screens_edit("dodaj", plik="plansza-22222222.jpg", nazwa="Plansza")
# ⚠️ Od 16.09 DRUGI ekran zaczyna PUSTY (patrz blok o przeplywie nizej), wiec skanery dopisujemy
# tak, jak robi to czlowiek chipami: kazdy jawnie. Ekran 2 dostaje tez skaner 1 - o to chodzilo
# w tym przykladzie (drugi zrzut ma TEZ skaner 1).
for _s in (1, 3, 4):
    _m.screens_edit("przypisz", n=2, sekcja=_s, wlacz=True)
_m.screens_edit("przypisz", n=1, sekcja=2, wlacz=True)
_cfg = _m.get_config()
check("dwa ekrany z przykladu: 1+2 oraz 1+3+4",
      _cfg["zrzuty"][0]["sekcje"] == [1, 2] and _cfg["zrzuty"][1]["sekcje"] == [1, 3, 4],
      [z["sekcje"] for z in _cfg["zrzuty"]])
_cfg = _m.sections_edit("usun", 2)
check("skasowanie skanera PRZENUMEROWUJE przypisania, zamiast wskazywac cudze",
      _cfg["zrzuty"][0]["sekcje"] == [1] and _cfg["zrzuty"][1]["sekcje"] == [1, 2, 3],
      [z["sekcje"] for z in _cfg["zrzuty"]])
check("ten sam zrzut wgrany drugi raz nie mnozy ekranow, tylko go wybiera",
      len(_m.screens_edit("dodaj", plik="menu-11111111.jpg")["zrzuty"]) == 2)
check("zle zadanie konczy sie odmowa, a nie polowiczna zmiana",
      _m.screens_edit("przypisz", n=9, sekcja=1) is None and _m.screens_edit("bzdura") is None)
_zr = _read("ribbitflip_monitor.py")
check("spis ekranow NIE wchodzi przez /scan (to samo zabezpieczenie, co przy sekcjach)",
      'dd["zrzuty"] = _teraz.get("zrzuty")' in _zr)
check("...bo ma wlasne wejscie", "/scan/zrzut" in _zr)

print("--- grupy skanerow i przeplyw: screen, skanery, drugi screen, kolejne skanery ---")
# Scenariusz: uzytkownik wgrywa zrzut z gry, dodaje do niego kilka skanerow mapujacych rozne
# miejsca klikania, potem kolejny zrzut i kolejne skanery (1+).
_m2 = _mod()
_m2.screens_edit("dodaj", plik="menu-11111111.jpg", nazwa="Menu")
check("pierwszy ekran bierze skaner, ktory juz jest",
      _m2.get_config()["zrzuty"][0]["sekcje"] == [1], _m2.get_config()["zrzuty"])
_m2.sections_edit("dodaj", "Przyciski")
_m2.sections_edit("dodaj", "Lista")
check("skanery domapowane na tym ekranie zostaja przy nim",
      _m2.get_config()["zrzuty"][0]["sekcje"] == [1, 2, 3], _m2.get_config()["zrzuty"])
_m2.screens_edit("dodaj", plik="plansza-22222222.jpg", nazwa="Plansza")
check("DRUGI ekran zaczyna pusty - nie zabiera skanerow pierwszemu",
      _m2.get_config()["zrzuty"][1]["sekcje"] == [], _m2.get_config()["zrzuty"])
_m2.sections_edit("dodaj", "Plansza 4x4")
_m2.sections_edit("dodaj", "Panel")
_cfg2 = _m2.get_config()
check("kolejne skanery ladują na ekranie, ktory jest WYBRANY",
      _cfg2["zrzuty"][0]["sekcje"] == [1, 2, 3] and _cfg2["zrzuty"][1]["sekcje"] == [4, 5],
      [z["sekcje"] for z in _cfg2["zrzuty"]])

# GRUPA to ekran BEZ zrzutu („pozwol tez grupowac skanery"). Zrzut jest wygoda, nie warunkiem.
_g = _m2.screens_edit("dodaj", nazwa="Ulubione")
check("grupa bez zrzutu powstaje", _g is not None and _g["zrzuty"][-1]["plik"] == "",
      _g and [(z["nazwa"], z["plik"]) for z in _g["zrzuty"]])
check("...ale wpis bez zrzutu I bez nazwy nie ma o czym mowic", _m2.screens_edit("dodaj") is None)
_m2.screens_edit("przypisz", n=3, sekcja=1, wlacz=True)
_m2.screens_edit("przypisz", n=3, sekcja=4, wlacz=True)
check("do grupy wchodza skanery z ROZNYCH ekranow (po to jest)",
      _m2.get_config()["zrzuty"][2]["sekcje"] == [1, 4], _m2.get_config()["zrzuty"][2])

# NASTEPNY SKANER W GRUPIE - jeden gest kapsla na caly widok.
check("`scan:sekcja=nast` jest rozpoznawane", rf.parse_scan_section("scan:sekcja=nast") == "nast"
      and rf.parse_scan_section("scan:sekcja=2") == 2 and rf.parse_scan_section("scan:sekcja=x") is None)
_m2.screens_edit("wybierz", n=3)          # grupa: skanery 1 i 4
_m2.activate_section(1)
_kolo = []
for _ in range(4):
    _n = _m2.next_section()
    _m2.activate_section(_n)
    _kolo.append(_n)
check("cykl chodzi TYLKO po skanerach wybranej grupy", _kolo == [4, 1, 4, 1], _kolo)
_m2.screens_edit("wybierz", n=0)
_m2.activate_section(1)
_kolo2 = []
for _ in range(3):
    _n = _m2.next_section()
    _m2.activate_section(_n)
    _kolo2.append(_n)
check("bez wybranej grupy cykl obchodzi wszystkie skanery", _kolo2 == [2, 3, 4], _kolo2)
_m3 = _mod()
check("przy jednym skanerze nie ma na co przelaczac", _m3.next_section() is None)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
