"""SKANER EKRANU - kontrakt miedzy silnikiem w przegladarce a modulem serwera (2026-09-11).

Silnik skanera siedzi w JS (rf-50-scan-model.js), a konfiguracje trzyma Python (ScanModule).
To znaczy, ze ten sam komplet nazw istnieje w dwoch miejscach - i ze rozjazd MIEDZY NIMI jest
cichy: pokretlo o nazwie, ktorej druga strona nie zna, zapisze sie i zniknie przy pierwszym
odczycie, bez jednego bledu w konsoli. Dokladnie to sprawdza ten plik.

Sprawdzamy tez, czy zestawy z panelu przechodza przez sanityzator serwera bez zmian: zestaw,
ktorego serwer po cichu poprawia, to zestaw, ktory nie robi tego, co obiecuje jego opis.

Bez znakow spoza ASCII w print() - konsola cp1250.
"""
import json
import os
import re
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
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


def _read(*parts):
    with open(os.path.join(_ROOT, *parts), "r", encoding="utf-8") as f:
        return f.read()


def _klucze_obiektu(tekst, nazwa):
    """Nazwy kluczy obiektu `nazwa = { ... }` z pliku JS - z pierwszego poziomu."""
    i = tekst.index(nazwa)
    i = tekst.index("{", i)
    glebokosc, j = 0, i
    while j < len(tekst):
        if tekst[j] == "{":
            glebokosc += 1
        elif tekst[j] == "}":
            glebokosc -= 1
            if glebokosc == 0:
                break
        j += 1
    cialo = tekst[i + 1:j]
    # Komentarze PRZED wycinaniem: `// px: ile` dalby klucz-widmo „px".
    cialo = re.sub(r"//[^\n]*", "", cialo)
    cialo = re.sub(r"/\*.*?\*/", "", cialo, flags=re.S)
    # tylko pierwszy poziom: wycinamy zagniezdzone nawiasy klamrowe i kwadratowe
    plaskie, gl = [], 0
    for z in cialo:
        if z in "{[":
            gl += 1
        elif z in "}]":
            gl -= 1
        elif gl == 0:
            plaskie.append(z)
    return set(re.findall(r"(\w+)\s*:", "".join(plaskie)))


_model = _read("web", "js", "rf-50-scan-model.js")
_pola = _read("web", "js", "rf-50b-scan-fields.js")
_karta = _read("web", "js", "rf-50d-scan-card.js")

JS = _klucze_obiektu(_model, "NS.DOMYSLNE =") | _klucze_obiektu(_pola, "NS.WYGLAD_DOM =")
PY = set(rf.ScanModule.DEFAULTS)

print("-- komplet nazw po obu stronach")
check("JS nie ma nazwy, ktorej nie zna serwer", not (JS - PY), sorted(JS - PY))
check("serwer nie ma nazwy, ktorej nie zna JS", not (PY - JS - {"enabled"}), sorted(PY - JS - {"enabled"}))
check("`enabled` jest wylacznie po stronie serwera (wlacznik modulu)", "enabled" in PY and "enabled" not in JS)
check("komplet jest niepusty i nietrywialny", len(JS) > 25, len(JS))

print("-- zakresy przycinaja tylko to, co istnieje")
zakresy = {k for k, _lo, _hi in rf.ScanModule._ZAKRESY}
check("kazdy przycinany klucz jest w domyslnych", not (zakresy - PY), sorted(zakresy - PY))
slowa = set(rf.ScanModule._SLOWA)
check("kazdy klucz slownikowy jest w domyslnych", not (slowa - PY), sorted(slowa - PY))

print("-- podzial na ustawienia i wyglad jest zupelny")
m = re.search(r"const SCAN_WYGLAD_KLUCZE = \[([^\]]*)\]", _karta, re.S)
wyglad_karta = set(re.findall(r'"(\w+)"', m.group(1))) if m else set()
wyglad_js = _klucze_obiektu(_pola, "NS.WYGLAD_DOM =")
check("karta dzieli dokladnie te klucze, ktore panel uwaza za wyglad",
      wyglad_karta == wyglad_js, sorted(wyglad_karta ^ wyglad_js))

print("-- zestawy przechodza przez sanityzator bez poprawek")
# Kazdy zestaw w rf-50b podaje PELNY komplet ustawien skanowania (po zgloszeniu z 10.09, gdzie
# zestawy nakladaly sie na siebie i „Szybki" dziedziczyl czas przytrzymania po „Ostroznym").
for m in re.finditer(r"u:\s*\{([^}]*)\}", _pola):
    cialo = m.group(1)
    ust = {}
    for para in re.finditer(r"(\w+)\s*:\s*('([^']*)'|-?[\d.]+|true|false|\[[^\]]*\])", cialo):
        k, surowe = para.group(1), para.group(2)
        if surowe.startswith("'"):
            ust[k] = para.group(3)
        elif surowe.startswith("["):
            liczby = re.findall(r"\d+", surowe)
            napisy = re.findall(r"'([^']*)'", surowe)
            ust[k] = [int(x) for x in liczby] if liczby else napisy
        elif surowe in ("true", "false"):
            ust[k] = (surowe == "true")
        else:
            ust[k] = float(surowe) if "." in surowe else int(surowe)
    if not ust:
        continue
    czyste = rf.ScanModule.sanitize(ust)
    rozne = {k: (v, czyste.get(k)) for k, v in ust.items()
             if k in czyste and czyste[k] != v and not (isinstance(v, (int, float)) and abs(czyste[k] - v) < 1e-9)}
    check("zestaw przechodzi bez poprawek (%s)" % ", ".join(sorted(ust)[:3]), not rozne, rozne)

print("-- spec `scan:` rozumiany tak samo po obu stronach")
js_scan = re.search(r"function specIsScan\(spec\)\{return (/\^scan:/i)", _read("web", "js", "rf-10-triggers-model.js"))
check("panel zna predykat specIsScan", bool(js_scan))
check("szybki wybor akcji oferuje sygnal skanera",
      '"scan:sygnal"' in _read("web", "js", "rf-10-triggers-model.js"))
for spec in ("scan:sygnal", "scan:cofnij", "scan:stop"):
    check("serwer rozpoznaje %s" % spec, rf.spec_is_scan(spec))
    check("%s nie jest padem ani warstwa" % spec,
          not rf.spec_is_pad(spec) and not rf.spec_is_layer(spec))

print("-- katalog akcji: kody, ktore serwer musi umiec wyslac")
kody = set(re.findall(r"\{ kod: '(\w+)'", _model))
check("katalog nie jest pusty", len(kody) > 10, len(kody))
mysz = set(re.findall(r"\{ kod: '(\w+)', pl: '[^']*', en: '[^']*', rodzaj: 'mysz'", _model))
przekladnia = set(re.findall(r"(\w+): \"(?:left|right|middle|double|move)\"", _read("web", "js", "rf-50h-scan-overlay.js")))
check("kazda akcja myszy ma przeklad na spec `mouse:`",
      not (mysz - przekladnia - {"przeciagnij", "przewinDol", "przewinGore"}),
      sorted(mysz - przekladnia - {"przeciagnij", "przewinDol", "przewinGore"}))

print("-- kratka: wierszami / kolumnami (harness w Node na PRAWDZIWYM modelu)")
# Reszta tego pliku czyta kod jako TEKST i pilnuje nazw. Tu jest inaczej: model skanera nie dotyka
# przegladarki i sam sie eksportuje, wiec harness uruchamia go naprawde i przejezdza kratke.
# Wymaganie dotyczy ZACHOWANIA ("najpierw wiersze, potem kolumny"), a nazwy
# kluczy moga sie zgadzac przy zupelnie zlej kolejnosci zapalania.
# --- WIDELKI: JS musi znac dokladnie te same, co serwer -------------------------------------
# Od 16.09 przy kazdym suwaku stoi pole do wpisania wartosci SPOZA suwaka: suwaki m.in.
# predkosci koncza sie na 100 px/s, a niektorzy uzytkownicy potrzebuja wolniej.
# Pole przyjmuje `RFScan.ZAKRESY`, wiec te liczby musza byc lustrem `ScanModule._ZAKRESY` — inaczej
# panel albo przyjmuje wartosc, ktora serwer po cichu przytnie, albo odmawia czegos, co serwer zna.
print("\n-- widelki wartosci: JS == serwer")
_zak_js = {}
_blok = _model[_model.index("NS.ZAKRESY = {"):]
_blok = _blok[:_blok.index("};")]
for _n, _lo, _hi in re.findall(r"(\w+)\s*:\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]", _blok):
    _zak_js[_n] = (float(_lo), float(_hi))
_zak_py = {n: (float(lo), float(hi)) for n, lo, hi in rf.ScanModule._ZAKRESY}
check("JS zna widelki kazdego pokretla, ktore przycina serwer",
      not (set(_zak_py) - set(_zak_js)), sorted(set(_zak_py) - set(_zak_js)))
check("JS nie wymysla widelek, ktorych serwer nie ma",
      not (set(_zak_js) - set(_zak_py)), sorted(set(_zak_js) - set(_zak_py)))
_rozne = {n: (_zak_js[n], _zak_py[n]) for n in set(_zak_js) & set(_zak_py) if _zak_js[n] != _zak_py[n]}
check("liczby sa te same po obu stronach", not _rozne, _rozne)

_node = None
for _cand in ("node", "node.exe"):
    try:
        subprocess.run([_cand, "--version"], capture_output=True, check=True)
        _node = _cand
        break
    except Exception:
        continue
if not _node:
    print("SKIP  brak Node - harness kratki pominiety")
else:
    # Drugi harness (`scan_ramka`) sprawdza to samo co pierwszy — zachowanie zywego modelu — tylko
    # dla ruchu RAMKI: podglad w karcie jest lepki i jedzie ze strona, wiec ekran przesuwa sie
    # w srodku przejazdu (zgloszenie 14.09: „przy scrollowaniu najezdza poza swoje okno").
    for _harness in ("scan_grid_harness.mjs", "scan_ramka_harness.mjs"):
        _p = subprocess.run([_node, os.path.join(_ROOT, "tests", _harness)], capture_output=True)
        if _p.returncode != 0:
            check("harness %s sie uruchamia" % _harness, False,
                  _p.stderr.decode("utf-8", "replace")[-500:])
            continue
        for _nazwa, _ok, _det in json.loads(_p.stdout.decode("utf-8"))["checks"]:
            check(_nazwa.encode("ascii", "replace").decode("ascii"), _ok, _det)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
