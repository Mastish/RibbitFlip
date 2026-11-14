"""SKANER - STRAZNIK „ZMIENILES ZESTAW Z APLIKACJI, NIE PODBILES REV" (2026-10-02).

PO CO TO JEST. Zestawy z aplikacji („Ostrozny", „Szybki"...) mieszkaja w `NS.ZESTAWY` (rf-50b)
i sa zasiewane do Biblioteki kazdego uzytkownika. Od 02.10 poprawka zestawu dojezdza do ludzi SAMA:
przy wejsciu w modul serwer porownuje `rev` zestawu z tym, co zasial (`seed_scan_presets`),
i nietknieta kopie podmienia po cichu, a przerobionej proponuje „Zaktualizuj z aplikacji".
Wszystko to rusza WYLACZNIE po podbiciu `rev`. Zmiana liczb bez podbicia jest cicha: test zielony,
aplikacja wydana, a u ludzi zostaje stara wersja na zawsze - i nikt sie o tym nie dowie.

Dlatego migawka: dla kazdego zestawu para (rev, odcisk tresci {nazwa, opis, u, w}). Inna tresc
przy tym samym rev = FAIL z prosba o podbicie. Nowy rev = FAIL z prosba o odswiezenie migawki,
zeby migawka byla aktualizowana swiadomie, a nie przy okazji.

Czego migawka NIE pilnuje: `NS.DOMYSLNE` i `NS.WYGLAD_DOM`. Zestaw kladzie sie na nie jak na czysta
kartke, wiec zmiana domyslnej wartosci zmienia tez zestawy, ktore tego pokretla nie ustawiaja -
wtedy decyzje o podbiciu rev trzeba podjac samemu.

Polskie komunikaty w print() - stdout przestawiony na `errors="replace"` (konsola cp1250).
"""
import hashlib
import json
import os
import subprocess
import sys

try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_JS = os.path.join(_ROOT, "web", "js")

# Migawka: {kod: (rev, odcisk)}. Odswiezaj ja RAZEM z podbiciem `rev` w rf-50b - komunikat bledu
# podaje gotowa pare do wklejenia.
MIGAWKA = {
    "zrownowazony": (1, "da9d5a44d5c7674d047a94dc894a2e785d4af08f"),
    "ostrozny": (1, "5a8e808b165666db67ad54f6a7fda087e2094185"),
    "szybki": (1, "1cbaa6ead7d2bda590e3c5e410ade1e4b701e67c"),
    "cwiartki": (1, "ea185cf077c910d31f92a10960f8cc7dcbd9be82"),
    # „uchem" (Bez patrzenia) wyszedl z zasiewu razem z polami dzwieku (UX 261120, D11).
    "menu": (1, "aecd054068d0133065fdd629c77cd9c1edc3e3ef"),
}

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


def odcisk(z):
    """sha1 kanonicznego JSON-u tresci zestawu. `w` bywa nieobecne - liczy sie jak puste."""
    tresc = {"nazwa": z.get("nazwa"), "opis": z.get("opis"), "u": z.get("u") or {}, "w": z.get("w") or {}}
    raw = json.dumps(tresc, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def zestawy_z_js():
    kod = ("const p=require('path');const R=require(p.join(%s,'rf-50-scan-model.js'));"
           "require(p.join(%s,'rf-50b-scan-fields.js'));process.stdout.write(JSON.stringify(R.ZESTAWY));"
           % (json.dumps(_JS), json.dumps(_JS)))
    p = subprocess.run(["node", "-e", kod], capture_output=True, timeout=60)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode("utf-8", "replace")[-400:])
    return json.loads(p.stdout.decode("utf-8"))


def porownaj(migawka, zestawy):
    """Lista komunikatow o rozjazdach migawki z rf-50b (pusta = wszystko w porzadku)."""
    out = []
    for kod, z in zestawy.items():
        nazwa = z.get("nazwa") or kod
        rev = z.get("rev")
        teraz = odcisk(z)
        para = "(%s, \"%s\")" % (rev, teraz)
        if not isinstance(rev, int) or isinstance(rev, bool) or rev < 1:
            out.append("Zestaw „%s” nie ma `rev` (liczba od 1) — bez niego nie dojedzie do ludzi żadna poprawka." % nazwa)
            continue
        if kod not in migawka:
            out.append("Nowy zestaw „%s” — dopisz go do migawki w tym teście: \"%s\": %s" % (nazwa, kod, para))
            continue
        m_rev, m_odc = migawka[kod]
        if rev < m_rev:
            out.append("Zestaw „%s” ma rev %d, niższy niż w migawce (%d) — u ludzi z wyższą wersją nic się nie zmieni."
                       % (nazwa, rev, m_rev))
        elif rev == m_rev and teraz != m_odc:
            out.append("Zestaw „%s” zmienił treść bez podbicia rev — podbij `rev` w rf-50b i zaktualizuj migawkę "
                       "w tym teście: %s" % (nazwa, teraz))
        elif rev > m_rev:
            out.append("Zestaw „%s” ma nowy rev %d — to dobrze; zaktualizuj migawkę w tym teście: \"%s\": %s"
                       % (nazwa, rev, kod, para))
    for kod in migawka:
        if kod not in zestawy:
            out.append("Zestawu „%s” nie ma już w rf-50b — usuń go z migawki (zasiane kopie zostają u ludzi jako ich presety)." % kod)
    return out


print("-- straznik sam sie sprawdza (falszywe zestawy)")
_z = {"nazwa": "Próbny", "opis": "x", "u": {"tryb": "pasy", "czasKroku": 900}}
_m = {"probny": (1, odcisk(_z))}
check("ta sama tresc, ten sam rev: cisza", porownaj(_m, {"probny": dict(_z, rev=1)}) == [])
_inna = dict(_z, rev=1, u={"tryb": "pasy", "czasKroku": 950})
_k = porownaj(_m, {"probny": _inna})
check("inna tresc przy tym samym rev: prosba o podbicie z nowym odciskiem",
      len(_k) == 1 and "bez podbicia rev" in _k[0] and odcisk(_inna) in _k[0], _k)
_k = porownaj(_m, {"probny": dict(_inna, rev=2)})
check("nowy rev z nowa trescia: prosba o odswiezenie migawki",
      len(_k) == 1 and "nowy rev 2" in _k[0] and "zaktualizuj migawkę" in _k[0], _k)
check("nowy zestaw bez migawki: prosba o dopisanie", len(porownaj({}, {"probny": dict(_z, rev=1)})) == 1)
check("zestaw bez rev: blad", len(porownaj(_m, {"probny": _z})) == 1)

print("-- migawka zestawow z rf-50b")
try:
    ZESTAWY = zestawy_z_js()
except FileNotFoundError:
    ZESTAWY = None
    print("SKIP  brak node - migawka zestawow pominieta")
if ZESTAWY is not None:
    check("rf-50b ma piec zestawow (bez „Bez patrzenia\", D11)", len(ZESTAWY) == 5 and "uchem" not in ZESTAWY, sorted(ZESTAWY))
    for komunikat in porownaj(MIGAWKA, ZESTAWY):
        check("migawka zestawow", False, komunikat)
    if not _failed:
        print("    %d zestawow zgodnych z migawka" % len(ZESTAWY))

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
