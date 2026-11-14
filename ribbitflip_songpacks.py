"""RibbitBeat: pakiety MIDI z Hugging Face i import piosenki z adresu URL.

Zasada nadrzędna (handoff „Pakiety MIDI i licencje w Ribbit Beat”, 2026-10-03): autor RibbitFlipa nie hostuje
żadnej muzyki. W repozytorium leżą tylko manifesty (`packs/*.json`: tytuły, autorzy, licencje, skróty SHA-256
i położenie bajtów w plikach Parquet zbioru). Pliki MIDI pobiera aplikacja użytkownika, na jego kliknięcie,
wprost z Hugging Face, z PRZYPIĘTEJ rewizji zbioru, i zapisuje je bez zmian jako zwykłe `.mid` w katalogu danych
użytkownika (`%LOCALAPPDATA%\\RibbitFlip\\SongPacks\\<pakiet>\\`), razem z `pack.json` i `ATTRIBUTION.txt`.

Jak pobieramy: bez pyarrow (+30 MB w .exe). Manifest podaje dla
każdego utworu plik Parquet, grupę wierszy oraz przesunięcie i długość fragmentu kolumny `midi` w tej grupie.
Aplikacja robi jedno zapytanie HTTP z nagłówkiem `Range` na ten fragment, rozpakowuje go własnym czytnikiem
(Thrift Compact + Snappy, tylko to, co jest w tych plikach) i wybiera utwór PO SKRÓCIE SHA-256 z manifestu, a nie
po pozycji. Inny kodek albo przepakowany zbiór daje czytelny błąd, nigdy zły plik na dysku.

Import z adresu: użytkownik wkleja adres pliku MIDI (swojego albo takiego, którego może używać). Pobiera serwer
aplikacji, bo strona gry ma w CSP tylko `connect-src 'self'`: limit rozmiaru, limit czasu, tylko http/https
i sprawdzenie nagłówka `MThd`. Bajty wracają do gry, która zapisuje je jak plik przeciągnięty na okno.

Ten moduł nie zna serwera HTTP aplikacji: `obsluz_trase()` przyjmuje metodę, ścieżkę, zapytanie i ciało JSON
i oddaje (status, typ, bajty, nagłówki). Używają go ribbitflip_monitor.py (pod tokenem sesji) i tools/gry_serwer.py.
"""
import hashlib
import json
import os
import re
import shutil
import struct
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

UA = "RibbitFlip-RibbitBeat/1.0 (+https://github.com/Mastish/RibbitFlip)"
HF = "https://huggingface.co/datasets/%s/resolve/%s/%s"
LIMIT_URL = 8 * 1024 * 1024          # import z adresu: największy plik MIDI
CZAS_URL = 20                        # s, limit jednego połączenia przy imporcie z adresu
CZAS_HF = 60                         # s, limit jednego połączenia przy pobieraniu pakietu
BLOK = 64 * 1024
# Licencje, które mogą być w pakiecie (druga kontrola reguły 4 przy pobieraniu). BY i BY-SA wymagają autora pliku.
LICENCJE_PAKIETU = {
    "cc0_classics": {"cc0-1.0", "public-domain"},
    "basic_classics": {"cc-by-3.0", "cc-by-4.0", "cc-by-sa-3.0", "cc-by-sa-4.0", "public-domain"},
    "cc_by_classics": {"cc-by-3.0", "cc-by-4.0", "cc-by-sa-3.0", "cc-by-sa-4.0"},
}
WYMAGA_AUTORA = {"cc-by-3.0", "cc-by-4.0", "cc-by-sa-3.0", "cc-by-sa-4.0"}


# ---------------------------------------------------------------------------------------------
# KATALOGI
def katalog_pakietow():
    """Katalog danych użytkownika na pakiety, nigdy obok .exe. Test podstawia własny przez zmienną środowiska."""
    k = os.environ.get("RIBBITFLIP_SONGPACKS_DIR")
    if not k:
        baza = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Local")
        k = os.path.join(baza, "RibbitFlip", "SongPacks")
    return k


_KATALOG_MANIFESTOW = [None]


def ustaw_katalog_manifestow(k):
    _KATALOG_MANIFESTOW[0] = k


def katalog_manifestow():
    return _KATALOG_MANIFESTOW[0] or os.path.join(os.path.dirname(os.path.abspath(__file__)), "packs")


def wczytaj_manifesty():
    """{pack_id: manifest} z katalogu manifestów (pliki *.json z polem pack_id i listą songs)."""
    out = {}
    k = katalog_manifestow()
    if not os.path.isdir(k):
        return out
    for n in sorted(os.listdir(k)):
        if not n.endswith(".json") or "rejections" in n:
            continue
        try:
            with open(os.path.join(k, n), encoding="utf-8") as f:
                m = json.load(f)
        except Exception:
            continue
        if isinstance(m, dict) and m.get("pack_id") and isinstance(m.get("songs"), list):
            out[m["pack_id"]] = m
    return out


def nazwa_pliku(song_id):
    """Bezpieczna nazwa pliku utworu w katalogu pakietu (bez ścieżek i znaków, których Windows nie przyjmie)."""
    n = os.path.basename(str(song_id or "")).replace("\\", "_")
    n = re.sub(r'[<>:"/|?*\x00-\x1f]', "_", n).strip(" .") or "utwor"
    if not re.search(r"\.midi?$", n, re.I):
        n += ".mid"
    return n[:180]


def katalog_pakietu(pack_id):
    if not re.fullmatch(r"[a-z0-9_]{1,40}", str(pack_id or "")):
        raise ValueError("zły identyfikator pakietu")
    return os.path.join(katalog_pakietow(), pack_id)


# ---------------------------------------------------------------------------------------------
# CZYTNIK PARQUET (jedna kolumna BYTE_ARRAY, Snappy, strona słownika i strony PLAIN v1)
class NieobslugiwanyFormat(ValueError):
    pass


def _varint(b, i):
    r = s = 0
    while True:
        x = b[i]
        i += 1
        r |= (x & 0x7F) << s
        s += 7
        if x < 0x80:
            return r, i


def _zz(n):
    return (n >> 1) ^ -(n & 1)


def _pomin(b, i, t):
    if t in (1, 2):
        return i
    if t == 3:
        return i + 1
    if t in (4, 5, 6):
        return _varint(b, i)[1]
    if t == 7:
        return i + 8
    if t == 8:
        n, i = _varint(b, i)
        return i + n
    if t in (9, 10):
        h = b[i]
        i += 1
        n, et = h >> 4, h & 15
        if n == 15:
            n, i = _varint(b, i)
        for _ in range(n):
            i = i + 1 if et in (1, 2) else _pomin(b, i, et)
        return i
    if t == 12:
        return _struktura(b, i)[1]
    raise NieobslugiwanyFormat("typ Thrift %d" % t)


def _struktura(b, i):
    out = {}
    ost = 0
    while True:
        h = b[i]
        i += 1
        if h == 0:
            return out, i
        t, d = h & 15, h >> 4
        if d:
            pole = ost + d
        else:
            v, i = _varint(b, i)
            pole = _zz(v)
        ost = pole
        if t in (1, 2):
            out[pole] = (t == 1)
        elif t in (4, 5, 6):
            v, i = _varint(b, i)
            out[pole] = _zz(v)
        elif t == 12:
            out[pole], i = _struktura(b, i)
        else:
            i = _pomin(b, i, t)


def snappy(b):
    """Rozpakowanie formatu Snappy (blok surowy, bez ramek)."""
    n, i = _varint(b, 0)
    o = bytearray()
    while i < len(b):
        t = b[i]
        k = t & 3
        i += 1
        if k == 0:
            L = t >> 2
            if L >= 60:
                nb = L - 59
                L = int.from_bytes(b[i:i + nb], "little")
                i += nb
            L += 1
            o += b[i:i + L]
            i += L
            continue
        if k == 1:
            L = ((t >> 2) & 7) + 4
            off = ((t >> 5) << 8) | b[i]
            i += 1
        elif k == 2:
            L = (t >> 2) + 1
            off = b[i] | (b[i + 1] << 8)
            i += 2
        else:
            L = (t >> 2) + 1
            off = int.from_bytes(b[i:i + 4], "little")
            i += 4
        if off == 0 or off > len(o):
            raise NieobslugiwanyFormat("uszkodzony blok Snappy")
        for _ in range(L):
            o.append(o[-off])
    if len(o) != n:
        raise NieobslugiwanyFormat("zła długość bloku Snappy")
    return bytes(o)


def wartosci_kolumny(fragment):
    """Wszystkie wartości BYTE_ARRAY z fragmentu kolumny: strona słownika i strony danych PLAIN v1 (Snappy)."""
    i = 0
    wartosci = []
    try:
        while i < len(fragment):
            nagl, j = _struktura(fragment, i)
            rozmiar = nagl[3]
            cialo = fragment[j:j + rozmiar]
            i = j + rozmiar
            typ = nagl[1]
            if typ == 2:                                   # DICTIONARY_PAGE
                if nagl.get(7, {}).get(2, 0) not in (0, 2):   # kodowanie PLAIN albo PLAIN_DICTIONARY
                    raise NieobslugiwanyFormat("kodowanie słownika")
                surowe = snappy(cialo)
                n = nagl[7][1]
                k = 0
                for _ in range(n):
                    L = struct.unpack_from("<i", surowe, k)[0]
                    wartosci.append(surowe[k + 4:k + 4 + L])
                    k += 4 + L
            elif typ == 0:                                 # DATA_PAGE v1
                if nagl.get(5, {}).get(2) == 0:            # PLAIN (wartości wprost)
                    surowe = snappy(cialo)
                    k = 4 + struct.unpack_from("<i", surowe, 0)[0]   # poziomy definicji (RLE, z długością)
                    while k < len(surowe):
                        L = struct.unpack_from("<i", surowe, k)[0]
                        wartosci.append(surowe[k + 4:k + 4 + L])
                        k += 4 + L
                # strony z indeksami słownika pomijamy: utwór i tak wybieramy po SHA-256
            elif typ == 3:
                raise NieobslugiwanyFormat("strona danych v2")
    except NieobslugiwanyFormat:
        raise
    except Exception as e:                                 # urwany albo cudzy format
        raise NieobslugiwanyFormat("nie udało się odczytać fragmentu kolumny: %s" % e)
    return wartosci


# ---------------------------------------------------------------------------------------------
# HTTP
class BrakSieci(Exception):
    pass


class ZbiorZdjety(Exception):
    pass


class Anulowano(Exception):
    pass


def _otworz(url, naglowki, czas):
    zad = urllib.request.Request(url, headers=dict({"User-Agent": UA}, **(naglowki or {})))
    try:
        return urllib.request.urlopen(zad, timeout=czas)
    except urllib.error.HTTPError as e:
        if e.code in (401, 403, 404, 410, 451):
            raise ZbiorZdjety("HTTP %d" % e.code)
        raise BrakSieci("HTTP %d" % e.code)
    except (urllib.error.URLError, OSError) as e:
        raise BrakSieci(str(getattr(e, "reason", e)))


def pobierz_zakres(url, od, ile, postep=None, anuluj=None, czas=CZAS_HF):
    """Bajty [od, od+ile) pliku spod adresu (Range). Serwer bez obsługi Range (200) też przejdzie: ucinamy sami."""
    odp = _otworz(url, {"Range": "bytes=%d-%d" % (od, od + ile - 1)}, czas)
    with odp:
        calosc = odp.status == 200
        bufor = bytearray()
        pominac = od if calosc else 0
        while True:
            if anuluj is not None and anuluj.is_set():
                raise Anulowano()
            try:
                kawalek = odp.read(BLOK)
            except OSError as e:
                raise BrakSieci(str(e))
            if not kawalek:
                break
            if pominac:
                ile_p = min(pominac, len(kawalek))
                kawalek = kawalek[ile_p:]
                pominac -= ile_p
            bufor += kawalek
            if postep:
                postep(len(kawalek))
            if len(bufor) >= ile:
                break
    if len(bufor) < ile:
        raise BrakSieci("połączenie urwało się w trakcie pobierania")
    return bytes(bufor[:ile])


# ---------------------------------------------------------------------------------------------
# DRUGA KONTROLA REGUŁ (aplikacja nie ufa ślepo manifestowi)
def utwor_poprawny(pack_id, s):
    """None, gdy utwór z manifestu może trafić na dysk, albo powód odrzucenia."""
    dozwolone = LICENCJE_PAKIETU.get(pack_id)
    if dozwolone is None:
        return "nieznany pakiet"
    if s.get("license") not in dozwolone:
        return "licencja %s poza pakietem" % s.get("license")
    if s.get("license") in WYMAGA_AUTORA and not (s.get("midi_author") or "").strip():
        return "brak autora pliku MIDI przy licencji %s" % s.get("license")
    if not re.fullmatch(r"[0-9a-f]{64}", str(s.get("sha256") or "")):
        return "brak skrótu SHA-256"
    if not s.get("source_url"):
        return "brak adresu źródła"
    for k in ("parquet_file", "row_group", "midi_chunk_offset", "midi_chunk_length"):
        if s.get(k) is None:
            return "brak położenia w zbiorze (%s)" % k
    return None


def _sha(b):
    return hashlib.sha256(b).hexdigest()


def _zapisz_atomowo(sciezka, dane):
    tmp = sciezka + ".tmp-%s" % uuid.uuid4().hex[:8]
    with open(tmp, "wb") as f:
        f.write(dane)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, sciezka)


def _plik_ok(sciezka, sha):
    try:
        with open(sciezka, "rb") as f:
            return _sha(f.read()) == sha
    except OSError:
        return False


# ---------------------------------------------------------------------------------------------
# ATRYBUCJA
NAZWY_LICENCJI = {
    "public-domain": ("Domena publiczna", "https://creativecommons.org/publicdomain/mark/1.0/"),
    "cc0-1.0": ("CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/"),
    "cc-by-3.0": ("CC BY 3.0", "https://creativecommons.org/licenses/by/3.0/"),
    "cc-by-4.0": ("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"),
    "cc-by-sa-3.0": ("CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/"),
    "cc-by-sa-4.0": ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"),
}
ZMIANY = "Mapa rytmu wygenerowana automatycznie z pliku MIDI przez RibbitBeat."
# Wersja angielska opisu i skrótu licencji (10-18, B-10): manifesty w packs/ mają tylko name_en; pole z manifestu,
# jeśli kiedyś się pojawi, wygrywa.
OPISY_EN = {
    "basic_classics": ("Well-known classical pieces under CC BY and CC BY-SA licences.",
                       "CC BY and CC BY-SA (3.0 and 4.0)"),
    "cc0_classics": ("All pieces from the CC0 collection that are in the public domain in the EU.",
                     "CC0 1.0 and public domain"),
    "cc_by_classics": ("Pieces from the CC0 collection that IMSLP lists under CC BY or CC BY-SA. "
                       "You play them with full credit to the file authors.",
                       "CC BY and CC BY-SA (3.0 and 4.0)"),
}


def tekst_atrybucji(m, utwory):
    """Treść ATTRIBUTION.txt: pakiet, zbiór, podziękowanie dla IMSLP i pełna atrybucja każdego utworu."""
    w = ["%s (%s)" % (m.get("name") or m["pack_id"], m["pack_id"]),
         "Pobrane z Hugging Face: https://huggingface.co/datasets/%s (rewizja %s)" % (m.get("dataset"), m.get("revision")),
         "Zbiór: %s, autor zbioru: %s. Pliki MIDI pochodzą z IMSLP (https://imslp.org), dziękujemy!" % (
             m.get("dataset"), m.get("dataset_author") or "TiMauzi (Tim Sockel)"),
         "Pliki zapisane bez zmian. RibbitFlip nie hostuje tych plików i ich nie redystrybuuje.", ""]
    for s in utwory:
        nazwa, url = NAZWY_LICENCJI.get(s.get("license"), (s.get("license"), s.get("license_url") or ""))
        w.append("%s – %s" % (s.get("title") or s.get("id"), s.get("composer") or "?"))
        w.append("  plik: %s" % nazwa_pliku(s["id"]))
        if s.get("midi_author"):
            w.append("  autor pliku MIDI: %s" % s["midi_author"])
        w.append("  licencja: %s %s" % (nazwa, s.get("license_url") or url))
        w.append("  źródło: %s" % s.get("source_url"))
        if s.get("license") in WYMAGA_AUTORA:
            w.append("  zmiany: " + ZMIANY)
        w.append("")
    return "\r\n".join(w)


# ---------------------------------------------------------------------------------------------
# ZADANIA (pobieranie pakietu, import z adresu): wątek + stan do odpytywania
_ZADANIA = {}
_ZADANIA_ZAMEK = threading.Lock()
_POBIERA = {}          # pack_id -> id zadania (jedno pobieranie pakietu naraz)


def _nowe_zadanie(typ, **pola):
    zid = uuid.uuid4().hex[:12]
    z = dict({"id": zid, "typ": typ, "stan": "trwa", "bajty": 0, "bajtyRazem": 0, "utwory": 0, "utworyRazem": 0,
              "blad": None, "kod": None, "uwagi": [], "start": time.time(), "koniec": None}, **pola)
    z["_anuluj"] = threading.Event()
    with _ZADANIA_ZAMEK:
        # stare, skończone zadania sprzątamy (zostaje 20 ostatnich)
        konczone = sorted((x for x in _ZADANIA.values() if x["stan"] != "trwa"), key=lambda x: x["start"])
        for x in konczone[:-20]:
            _ZADANIA.pop(x["id"], None)
        _ZADANIA[zid] = z
    return z


def zadanie(zid):
    z = _ZADANIA.get(zid)
    if not z:
        return None
    return {k: v for k, v in z.items() if not k.startswith("_")}


def anuluj(zid):
    z = _ZADANIA.get(zid)
    if not z or z["stan"] != "trwa":
        return False
    z["_anuluj"].set()
    return True


def _zakoncz(z, stan, blad=None, kod=None):
    z["stan"], z["blad"], z["kod"], z["koniec"] = stan, blad, kod, time.time()


def stan_pakietow():
    """Lista pakietów z manifestów i stan instalacji u użytkownika."""
    out = []
    for pid, m in wczytaj_manifesty().items():
        k = katalog_pakietu(pid)
        pj = os.path.join(k, "pack.json")
        zainstalowane = {}
        if os.path.isfile(pj):
            try:
                with open(pj, encoding="utf-8") as f:
                    zainstalowane = {s["id"]: s for s in json.load(f).get("songs", [])}
            except Exception:
                zainstalowane = {}
        obecne = [s for s in m["songs"] if s["id"] in zainstalowane
                  and os.path.isfile(os.path.join(k, nazwa_pliku(s["id"])))]
        z = _ZADANIA.get(_POBIERA.get(pid) or "")
        en = OPISY_EN.get(pid, (None, None))
        out.append({"pack_id": pid, "name": m.get("name"), "name_en": m.get("name_en"), "description": m.get("description"),
                    "description_en": m.get("description_en") or en[0],
                    "license_summary": m.get("license_summary"),
                    "license_summary_en": m.get("license_summary_en") or en[1], "dataset": m.get("dataset"), "revision": m.get("revision"),
                    "songs_total": len(m["songs"]), "songs_installed": len(obecne),
                    "download_bytes": m.get("download_bytes"), "size_bytes": m.get("size_bytes"),
                    "zadanie": zadanie(z["id"]) if z else None, "katalog": k})
    return out


def lista_utworow(pack_id):
    """Zainstalowane utwory pakietu z pełną atrybucją (z pack.json, czyli z manifestu z chwili pobrania)."""
    k = katalog_pakietu(pack_id)
    try:
        with open(os.path.join(k, "pack.json"), encoding="utf-8") as f:
            pj = json.load(f)
    except Exception:
        return []
    return [dict(s, plik=nazwa_pliku(s["id"])) for s in pj.get("songs", [])
            if os.path.isfile(os.path.join(k, nazwa_pliku(s["id"])))]


def _pobieranie(z, m):
    pid = m["pack_id"]
    k = katalog_pakietu(pid)
    os.makedirs(k, exist_ok=True)
    utwory = []
    for s in m["songs"]:
        powod = utwor_poprawny(pid, s)
        if powod:
            z["uwagi"].append("%s: %s" % (s.get("id"), powod))
        else:
            utwory.append(s)
    z["utworyRazem"] = len(utwory)
    # wznowienie: utwory, które już są na dysku z poprawnym skrótem, pomijamy
    brak = []
    for s in utwory:
        if _plik_ok(os.path.join(k, nazwa_pliku(s["id"])), s["sha256"]):
            z["utwory"] += 1
        else:
            brak.append(s)
    grupy = {}
    for s in brak:
        grupy.setdefault((s["parquet_file"], s["row_group"], s["midi_chunk_offset"], s["midi_chunk_length"]), []).append(s)
    z["bajtyRazem"] = sum(g[3] for g in grupy)
    zle = 0
    try:
        for (plik, _rg, od, ile), lista in sorted(grupy.items()):
            if z["_anuluj"].is_set():
                raise Anulowano()
            url = HF % (m["dataset"], m["revision"], plik)

            def postep(n):
                z["bajty"] += n
            fragment = pobierz_zakres(url, od, ile, postep, z["_anuluj"])
            po_skrocie = {}
            for v in wartosci_kolumny(fragment):
                po_skrocie.setdefault(_sha(v), v)
            for s in lista:
                dane = po_skrocie.get(s["sha256"])
                if dane is None:
                    zle += 1
                    z["uwagi"].append("%s: plik w zbiorze nie zgadza się z manifestem (SHA-256)" % s["id"])
                    continue
                _zapisz_atomowo(os.path.join(k, nazwa_pliku(s["id"])), dane)
                z["utwory"] += 1
    except Anulowano:
        _zapisz_pack_json(m, k)
        return _zakoncz(z, "anulowane")
    except ZbiorZdjety as e:
        _zapisz_pack_json(m, k)
        return _zakoncz(z, "blad", "Zbioru nie ma już na Hugging Face (%s). Utwory pobrane wcześniej zostają." % e,
                        "zbior_zdjety")
    except BrakSieci as e:
        _zapisz_pack_json(m, k)
        return _zakoncz(z, "blad", "Brak połączenia z Hugging Face (%s). Pobierz jeszcze raz, gdy wróci internet: "
                                   "pobrane utwory zostaną." % e, "brak_sieci")
    except NieobslugiwanyFormat as e:
        _zapisz_pack_json(m, k)
        return _zakoncz(z, "blad", "Nieobsługiwany format zbioru: %s." % e, "format")
    except OSError as e:
        return _zakoncz(z, "blad", "Nie udało się zapisać pliku: %s" % e, "dysk")
    _zapisz_pack_json(m, k)
    if zle:
        return _zakoncz(z, "blad", "%d plików w zbiorze nie zgadza się z manifestem, więc ich nie zapisałem." % zle, "skrot")
    _zakoncz(z, "gotowe")


def _zapisz_pack_json(m, k):
    """pack.json i ATTRIBUTION.txt z utworami, które naprawdę leżą na dysku (także po przerwaniu)."""
    obecne = [s for s in m["songs"] if os.path.isfile(os.path.join(k, nazwa_pliku(s["id"])))]
    meta = {kk: v for kk, v in m.items() if kk != "songs"}
    meta["installed_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    meta["songs"] = obecne
    _zapisz_atomowo(os.path.join(k, "pack.json"), json.dumps(meta, ensure_ascii=False, indent=1).encode("utf-8"))
    _zapisz_atomowo(os.path.join(k, "ATTRIBUTION.txt"), tekst_atrybucji(m, obecne).encode("utf-8"))


def start_pobierania(pack_id):
    m = wczytaj_manifesty().get(pack_id)
    if not m:
        raise KeyError("nieznany pakiet")
    stare = _ZADANIA.get(_POBIERA.get(pack_id) or "")
    if stare and stare["stan"] == "trwa":
        return zadanie(stare["id"])
    z = _nowe_zadanie("pakiet", pack_id=pack_id)
    _POBIERA[pack_id] = z["id"]
    threading.Thread(target=_bezpiecznie, args=(_pobieranie, z, m), daemon=True, name="songpack-" + pack_id).start()
    return zadanie(z["id"])


def _bezpiecznie(fn, z, *a):
    try:
        fn(z, *a)
    except Exception as e:                                   # nic nie może zostawić zadania w stanie „trwa”
        if z["stan"] == "trwa":
            _zakoncz(z, "blad", "Nieoczekiwany błąd: %s" % e, "inny")


def usun_pakiet(pack_id):
    k = katalog_pakietu(pack_id)
    z = _ZADANIA.get(_POBIERA.get(pack_id) or "")
    if z and z["stan"] == "trwa":
        z["_anuluj"].set()
        for _ in range(50):
            if z["stan"] != "trwa":
                break
            time.sleep(.1)
    if os.path.isdir(k):
        shutil.rmtree(k)
    return True


def plik_utworu(pack_id, song_id):
    k = katalog_pakietu(pack_id)
    sciezka = os.path.join(k, nazwa_pliku(song_id))
    if os.path.dirname(os.path.abspath(sciezka)) != os.path.abspath(k):
        raise ValueError("zła nazwa utworu")
    with open(sciezka, "rb") as f:
        return f.read()


# ---- import z adresu URL ----
def nazwa_z_adresu(url, naglowek=None):
    if naglowek:
        mm = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", naglowek, re.I)
        if mm:
            return urllib.parse.unquote(mm.group(1)).strip() or "piosenka.mid"
    sciezka = urllib.parse.urlparse(url).path
    n = urllib.parse.unquote(os.path.basename(sciezka)) or "piosenka"
    if not re.search(r"\.midi?$", n, re.I):
        n += ".mid"
    return n[:120]


def _adres_lokalny(host):
    """Czy nazwa albo adres wskazuje ten komputer albo sieć lokalną (pętla zwrotna, sieć prywatna,
    link-local, adres zarezerwowany). Nazwę rozwiązujemy: `moj-router.lan` i nazwa w internecie
    wskazująca 127.0.0.1 to ten sam przypadek co wpisany wprost adres. Brak odpowiedzi DNS = nie
    lokalny; samo połączenie i tak wtedy się nie uda i powie to swoim zdaniem."""
    import ipaddress
    import socket
    h = str(host or "").strip().strip("[]").lower()
    if not h:
        return True
    if h == "localhost" or h.endswith(".localhost"):
        return True
    try:
        adresy = [ipaddress.ip_address(h)]
    except ValueError:
        try:
            adresy = [ipaddress.ip_address(a[4][0].split("%")[0])
                      for a in socket.getaddrinfo(h, None)]
        except (OSError, ValueError):
            return False
    return any(a.is_loopback or a.is_private or a.is_link_local or a.is_reserved
               or a.is_unspecified or a.is_multicast for a in adresy)


def sprawdz_adres(url):
    """None albo powód, dla którego adresu nie pobieramy.

    TYLKO INTERNET (2026-10-16). Import piosenki to jedyne miejsce gry, w które wkleja się adres
    podany przez obcego człowieka, a pobiera go serwer aplikacji, nie przeglądarka. Bez tej
    granicy wklejony odnośnik mógł sięgnąć do routera, drukarki albo usługi na tym komputerze.
    Pliki MIDI leżą w internecie, więc adres lokalny odrzucamy z jednym zdaniem dlaczego."""
    u = urllib.parse.urlparse(str(url or "").strip())
    if u.scheme not in ("http", "https") or not u.hostname:
        return "To nie wygląda na adres strony (http albo https)."
    if _adres_lokalny(u.hostname):
        return "Ten adres wskazuje ten komputer albo sieć lokalną. Import działa tylko z internetu."
    return None


class _PrzekierowanieTylkoDoInternetu(urllib.request.HTTPRedirectHandler):
    """Przekierowanie przechodzi tą samą kontrolą co adres wklejony: inaczej strona w internecie
    mogłaby odesłać import pod adres lokalny jednym nagłówkiem `Location`."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        powod = sprawdz_adres(newurl)
        if powod:
            # BrakSieci, nie HTTPError: idzie prosto do `_import_url`, który pokaże to zdanie.
            raise BrakSieci("strona przekierowała import pod adres lokalny, więc go przerwaliśmy")
        return urllib.request.HTTPRedirectHandler.redirect_request(
            self, req, fp, code, msg, headers, newurl)


def _otworz_import(url, naglowki, czas):
    """`_otworz` dla importu z adresu: ta sama obsługa błędów, ale każde przekierowanie sprawdzone."""
    zad = urllib.request.Request(url, headers=dict({"User-Agent": UA}, **(naglowki or {})))
    try:
        return urllib.request.build_opener(_PrzekierowanieTylkoDoInternetu()).open(zad, timeout=czas)
    except urllib.error.HTTPError as e:
        if e.code in (401, 403, 404, 410, 451):
            raise ZbiorZdjety("HTTP %d" % e.code)
        raise BrakSieci("HTTP %d" % e.code)
    except (urllib.error.URLError, OSError) as e:
        raise BrakSieci(str(getattr(e, "reason", e)))


def _import_url(z, url):
    try:
        odp = _otworz_import(url, {"Accept": "audio/midi, audio/x-midi, application/octet-stream, */*"}, CZAS_URL)
    except ZbiorZdjety as e:
        return _zakoncz(z, "blad", "Pod tym adresem nie ma pliku (%s)." % e, "brak_pliku")
    except BrakSieci as e:
        return _zakoncz(z, "blad", "Nie udało się połączyć: %s." % e, "brak_sieci")
    with odp:
        dl = int(odp.headers.get("Content-Length") or 0)
        if dl > LIMIT_URL:
            return _zakoncz(z, "blad", "Plik jest za duży (%d MB), a pliki MIDI mają zwykle kilkadziesiąt KB." % (dl // 1048576),
                            "za_duzy")
        z["bajtyRazem"] = dl
        bufor = bytearray()
        while True:
            if z["_anuluj"].is_set():
                return _zakoncz(z, "anulowane")
            try:
                k = odp.read(BLOK)
            except OSError as e:
                return _zakoncz(z, "blad", "Połączenie urwało się: %s." % e, "brak_sieci")
            if not k:
                break
            bufor += k
            z["bajty"] = len(bufor)
            if len(bufor) > LIMIT_URL:
                return _zakoncz(z, "blad", "Plik jest za duży, a pliki MIDI mają zwykle kilkadziesiąt KB.", "za_duzy")
        nazwa = nazwa_z_adresu(odp.geturl() or url, odp.headers.get("Content-Disposition"))
    dane = bytes(bufor)
    if not dane.startswith(b"MThd"):
        mm = re.search(rb"MThd", dane[:4096])
        if not mm:
            return _zakoncz(z, "blad", "To nie jest plik MIDI (brak nagłówka MThd). Wklej adres samego pliku .mid, "
                                       "a nie strony, na której jest link.", "nie_midi")
        dane = dane[mm.start():]   # plik z nagłówkiem RIFF (RMID) albo śmieciem przed MThd
    z["_wynik"] = dane
    z["nazwa"] = nazwa
    z["rozmiar"] = len(dane)
    _zakoncz(z, "gotowe")


def start_importu_url(url):
    powod = sprawdz_adres(url)
    if powod:
        raise ValueError(powod)
    z = _nowe_zadanie("url", url=str(url).strip()[:500])
    threading.Thread(target=_bezpiecznie, args=(_import_url, z, z["url"]), daemon=True, name="midi-url").start()
    return zadanie(z["id"])


def wynik_importu(zid):
    z = _ZADANIA.get(zid)
    if not z or z["stan"] != "gotowe" or "_wynik" not in z:
        return None, None
    return z["_wynik"], z.get("nazwa")


# ---------------------------------------------------------------------------------------------
# TRASY (wspólne dla aplikacji i tools/gry_serwer.py)
def _json(status, obj):
    return status, "application/json; charset=utf-8", json.dumps(obj, ensure_ascii=False).encode("utf-8"), {}


def obsluz_trase(metoda, sciezka, zapytanie, dane):
    """(status, typ, bajty, nagłówki) dla /gry/api/…, albo None, gdy ścieżka nie jest nasza.
    `zapytanie`: dict z parse_qs (listy), `dane`: ciało JSON albo None."""
    if not sciezka.startswith("/gry/api/"):
        return None
    q = {k: (v[0] if isinstance(v, list) else v) for k, v in (zapytanie or {}).items()}
    d = dane if isinstance(dane, dict) else {}
    r = sciezka[len("/gry/api/"):]
    try:
        if metoda == "GET" and r == "pakiety":
            return _json(200, {"ok": True, "pakiety": stan_pakietow(), "katalog": katalog_pakietow()})
        if metoda == "GET" and r == "pakiety/utwory":
            return _json(200, {"ok": True, "utwory": lista_utworow(q.get("pack", ""))})
        if metoda == "GET" and r == "pakiety/plik":
            try:
                dane_b = plik_utworu(q.get("pack", ""), q.get("song", ""))
            except (OSError, ValueError):
                return _json(404, {"ok": False, "error": "Nie ma tego utworu na dysku."})
            return 200, "audio/midi", dane_b, {}
        if metoda == "GET" and r == "zadanie":
            z = zadanie(q.get("id", ""))
            return _json(200 if z else 404, {"ok": bool(z), "zadanie": z})
        if metoda == "GET" and r == "import-url/wynik":
            dane_b, nazwa = wynik_importu(q.get("id", ""))
            if dane_b is None:
                return _json(404, {"ok": False, "error": "Nie ma wyniku tego pobierania."})
            return 200, "audio/midi", dane_b, {"X-Nazwa-Pliku": urllib.parse.quote(nazwa or "piosenka.mid")}
        if metoda == "POST" and r == "pakiety/pobierz":
            return _json(200, {"ok": True, "zadanie": start_pobierania(d.get("pack", ""))})
        if metoda == "POST" and r == "pakiety/usun":
            return _json(200, {"ok": usun_pakiet(d.get("pack", ""))})
        if metoda == "POST" and r == "zadanie/anuluj":
            return _json(200, {"ok": anuluj(d.get("id", ""))})
        if metoda == "POST" and r == "import-url":
            return _json(200, {"ok": True, "zadanie": start_importu_url(d.get("url", ""))})
    except KeyError as e:
        return _json(404, {"ok": False, "error": str(e).strip("'")})
    except ValueError as e:
        return _json(400, {"ok": False, "error": str(e)})
    return _json(404, {"ok": False, "error": "nieznana trasa"})
