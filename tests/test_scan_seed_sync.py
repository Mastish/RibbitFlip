"""SKANER - ZESTAWY Z APLIKACJI NADAZAJA ZA WERSJAMI (2026-10-02).

Zestaw z aplikacji („Ostrozny", „Szybki"...) poprawiony w nowej wersji
aplikacji ma dojechac do Biblioteki sam - ale TYLKO tam, gdzie nikt go nie ruszal. Przerobiony preset
zostaje przerobiony, a panel opisu proponuje „Zaktualizuj z aplikacji".

Mechanika (seed_scan_presets w ribbitflip_monitor.py): koperta presetu z zasiewu niesie
`zrodlo: {kod, rev, odcisk}`; `sync=True` porownuje wersje i odcisk tresci. Ten plik sprawdza po
kolei: swiezy zasiew, cicha podmiana nietknietego, `nowsza` przy przerobionym, wymuszona podmiane
i migracje plikow zasianych przed ta zmiana (bez `zrodlo`).

Wszystko w katalogu tymczasowym - prawdziwa Library nie jest dotykana.
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


def zestaw(kod, nazwa, rev, **cfg):
    return {"name": nazwa, "desc": "opis " + nazwa + " v%d" % rev, "kod": kod, "rev": rev,
            "config": dict({"tryb": "pasy", "configName": ""}, **cfg)}


def koperta(nazwa):
    with open(os.path.join(rf.SCAN_PRESET_DIR, nazwa + ".json"), encoding="utf-8") as f:
        return json.load(f)


def pozycja(items, nazwa):
    return ([i for i in items if i["name"] == nazwa] or [None])[0]


_stare = (rf.SETTINGS_DIR, rf.SCAN_PRESET_DIR, rf.SCAN_SEED_MARK)
_tmp = tempfile.mkdtemp(prefix="rf-scan-sync-")
try:
    rf.SETTINGS_DIR = os.path.join(_tmp, "Settings")
    rf.SCAN_PRESET_DIR = os.path.join(_tmp, "Library", "ScanPresets")
    rf.SCAN_SEED_MARK = os.path.join(rf.SETTINGS_DIR, "seeded.json")

    # --- 1. swiezy zasiew ------------------------------------------------------------------------
    print("-- swiezy zasiew")
    v1 = [zestaw("ostrozny", "Ostrozny", 1, ruch="skokowy", czasKroku=900),
          zestaw("szybki", "Szybki", 1, ruch="plynny", predkosc=1500)]
    ile, items, podm = rf.seed_scan_presets(v1, sync=True)
    check("zasiew z sync dodaje oba zestawy", ile == 2 and podm == 0, (ile, podm))
    k = koperta("Ostrozny")
    check("koperta niesie zrodlo z kodem i wersja",
          k.get("zrodlo", {}).get("kod") == "ostrozny" and k["zrodlo"].get("rev") == 1, k.get("zrodlo"))
    check("odcisk w kopercie = odcisk tresci pliku",
          k["zrodlo"].get("odcisk") == rf.scan_odcisk(k["config"]), k["zrodlo"].get("odcisk"))
    p = pozycja(items, "Ostrozny")
    check("lista mowi seeded/zrodlo/rev", p and p["seeded"] is True and p["zrodlo"] == "ostrozny"
          and p["zrodloRev"] == 1 and p["nowsza"] == 0, p and {x: p[x] for x in ("seeded", "zrodlo", "zrodloRev", "nowsza")})
    ile2, _, podm2 = rf.seed_scan_presets(v1, sync=True)
    check("ten sam zasiew drugi raz nic nie robi", ile2 == 0 and podm2 == 0, (ile2, podm2))

    # --- 2. rev+1, preset nietkniety -> cicha podmiana -------------------------------------------
    print("-- nowsza wersja, preset nietkniety")
    v2 = [zestaw("ostrozny", "Ostrozny", 2, ruch="skokowy", czasKroku=1100),
          zestaw("szybki", "Szybki", 2, ruch="plynny", predkosc=1700)]
    # Szybki przerabia uzytkownik (zapis zmian idzie ta sama droga, co w panelu).
    rf.save_scan_preset("Szybki", dict(koperta("Szybki")["config"], predkosc=1234), "moja wersja")
    check("zapis zmian nie odcina presetu od zrodla", koperta("Szybki").get("zrodlo", {}).get("kod") == "szybki")
    ile3, items3, podm3 = rf.seed_scan_presets(v2, sync=True)
    o = koperta("Ostrozny")
    check("nietkniety Ostrozny podmieniony po cichu", podm3 == 1 and o["config"]["czasKroku"] == 1100,
          (podm3, o["config"]["czasKroku"]))
    check("...ze zrodlem rev 2 i nowym odciskiem",
          o["zrodlo"]["rev"] == 2 and o["zrodlo"]["odcisk"] == rf.scan_odcisk(o["config"]), o["zrodlo"])
    check("...i z opisem nowej wersji", o.get("desc") == "opis Ostrozny v2", o.get("desc"))

    # --- 3. rev+1, preset przerobiony -> `nowsza`, config bez zmian ------------------------------
    print("-- nowsza wersja, preset przerobiony")
    sz = koperta("Szybki")
    check("przerobiony Szybki zostaje przerobiony", sz["config"]["predkosc"] == 1234, sz["config"]["predkosc"])
    check("...dostaje zrodlo.nowsza = 2, a rev zostaje 1",
          sz["zrodlo"].get("nowsza") == 2 and sz["zrodlo"].get("rev") == 1, sz["zrodlo"])
    check("...i opis autora", sz.get("desc") == "moja wersja", sz.get("desc"))
    p = pozycja(items3, "Szybki")
    check("lista mowi nowsza 2 przy zrodloRev 1", p["nowsza"] == 2 and p["zrodloRev"] == 1,
          {x: p[x] for x in ("nowsza", "zrodloRev")})
    _, _, podm4 = rf.seed_scan_presets(v2, sync=True)
    check("kolejny sync nie rusza ani jednego, ani drugiego", podm4 == 0, podm4)

    # --- 4. force -> podmiana mimo zmian --------------------------------------------------------
    print("-- Zaktualizuj z aplikacji (force)")
    rf.delete_scan_preset("Ostrozny")
    ile5, items5, podm5 = rf.seed_scan_presets([v2[1]], restore=True, force=["Szybki"])
    sz = koperta("Szybki")
    check("wymuszona podmiana zastepuje przerobke", podm5 == 1 and sz["config"]["predkosc"] == 1700,
          (podm5, sz["config"]["predkosc"]))
    check("...rev 2, bez `nowsza`", sz["zrodlo"].get("rev") == 2 and "nowsza" not in sz["zrodlo"], sz["zrodlo"])
    check("...a zawezony zestaw nie przywraca skasowanego Ostroznego",
          ile5 == 0 and pozycja(items5, "Ostrozny") is None, ile5)
    rf.save_scan_preset("Szybki", dict(koperta("Szybki")["config"], predkosc=555), "znow moja")
    _, _, podm6 = rf.seed_scan_presets(v2, sync=True, force=["Szybki"])
    check("force bez restore nic nie wymusza",
          podm6 == 0 and koperta("Szybki")["config"]["predkosc"] == 555, (podm6, koperta("Szybki")["config"]["predkosc"]))
    rf.seed_scan_presets([v2[1]], restore=True, force=["Szybki"])

    # --- 5. migracja: plik bez `zrodlo` ----------------------------------------------------------
    print("-- migracja plikow zasianych przed 02.10")
    rf.save_scan_preset("Cwiartki", {"tryb": "cwiartki", "siatka": [2, 2]}, "stary zasiew")
    rf.save_scan_preset("Radar", {"tryb": "radar", "stopnieNaSek": 120}, "czyjas przerobka")
    check("stare pliki nie maja zrodla", "zrodlo" not in koperta("Cwiartki") and "zrodlo" not in koperta("Radar"))
    v3 = [zestaw("cwiartki", "Cwiartki", 1, tryb="cwiartki", siatka=[2, 2]),
          zestaw("radar", "Radar", 1, tryb="radar", stopnieNaSek=90)]
    ile7, items7, podm7 = rf.seed_scan_presets(v3, sync=True)
    c = koperta("Cwiartki")
    check("plik rowny zestawowi dostaje zrodlo po cichu",
          c.get("zrodlo", {}).get("kod") == "cwiartki" and c["zrodlo"].get("rev") == 1, c.get("zrodlo"))
    check("...bez zmiany tresci i opisu", c["config"]["siatka"] == [2, 2] and c.get("desc") == "stary zasiew", c.get("desc"))
    r = koperta("Radar")
    check("plik rozny od zestawu zostaje czyja praca (bez zrodla)", "zrodlo" not in r, r.get("zrodlo"))
    check("...i bez zmiany tresci", r["config"]["stopnieNaSek"] == 120, r["config"]["stopnieNaSek"])
    check("migracja nie liczy sie jako podmiana ani dopisanie", ile7 == 0 and podm7 == 0, (ile7, podm7))
    check("lista: migrowany seeded, cudzy nie",
          pozycja(items7, "Cwiartki")["seeded"] is True and pozycja(items7, "Radar")["seeded"] is False)

    # --- 6. stary klient bez kodow ---------------------------------------------------------------
    print("-- klient bez kodow zestawow")
    stary = [{"name": "Szybki", "desc": "x", "config": {"tryb": "pasy", "predkosc": 99}}]
    _, _, podm8 = rf.seed_scan_presets(stary, sync=True)
    check("zestaw bez kodu nie nadpisuje istniejacego pliku",
          podm8 == 0 and koperta("Szybki")["config"]["predkosc"] == 1700, podm8)

    # --- 7. nowe pokretlo w aplikacji nie robi z nietknietego presetu przerobki ----------------
    # Sanityzacja dokłada każdy nowy klucz z DEFAULTS, więc „nietknięty" musi patrzeć na SUROWY plik.
    # Bez tego pierwsza aktualizacja z nowym pokrętłem zamieniłaby ciche podmiany w „jest nowsza wersja".
    print("-- nowy klucz w DEFAULTS po zasiewie")
    v4 = [zestaw("menu", "Menu", 1, menuAkcji=True)]
    rf.seed_scan_presets(v4, restore=True)
    rf.ScanModule.DEFAULTS["kluczZPrzyszlosci"] = 5
    try:
        _, _, podm9 = rf.seed_scan_presets([zestaw("menu", "Menu", 2, menuAkcji=True, czasBloku=1200)], sync=True)
        m = koperta("Menu")
        check("nietkniety preset po dodaniu pokretla nadal podmienia sie po cichu",
              podm9 == 1 and m["config"].get("czasBloku") == 1200 and "nowsza" not in m["zrodlo"], (podm9, m["zrodlo"]))
    finally:
        rf.ScanModule.DEFAULTS.pop("kluczZPrzyszlosci", None)
    # Stary zasiew (sprzed 02.10) bez klucza dodanego później: migracja zapisuje odcisk SUROWEGO pliku,
    # więc następny rev też go podmienia po cichu.
    _cfg = rf.scan_preset_config({"tryb": "radar", "stopnieNaSek": 90})
    _cfg.pop("szablonW", None)
    with open(os.path.join(rf.SCAN_PRESET_DIR, "Stary.json"), "w", encoding="utf-8") as f:
        json.dump({"app": "ribbitflip", "kind": "scan-preset", "version": 1, "name": "Stary", "desc": "",
                   "config": _cfg}, f, ensure_ascii=False)
    rf.seed_scan_presets([zestaw("stary", "Stary", 1, tryb="radar", stopnieNaSek=90)], sync=True)
    check("stary zasiew bez nowszego klucza zostaje zmigrowany", koperta("Stary").get("zrodlo", {}).get("kod") == "stary")
    _, _, podm10 = rf.seed_scan_presets([zestaw("stary", "Stary", 2, tryb="radar", stopnieNaSek=100)], sync=True)
    check("...a jego nastepna wersja podmienia sie po cichu",
          podm10 == 1 and koperta("Stary")["config"]["stopnieNaSek"] == 100, (podm10, koperta("Stary")["zrodlo"]))
finally:
    rf.SETTINGS_DIR, rf.SCAN_PRESET_DIR, rf.SCAN_SEED_MARK = _stare
    shutil.rmtree(_tmp, ignore_errors=True)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
