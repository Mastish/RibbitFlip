"""RibbitBeat: pakiety piosenek z audio (format pakietu piosenki v1).

Pakiet to FOLDER `%LOCALAPPDATA%\\RibbitFlip\\Piosenki\\<slug>\\` zapisany przez Testownik konwertera audio → MIDI:
manifest.json, piosenka.mid, nuty.json, edycje.json, audio/*.ogg (albo .wav) i miks.json. Gra czyta go przez
trasy /gry/api/piosenki*, bo strona gry łączy się wyłącznie z serwerem aplikacji (CSP `connect-src 'self'`).
Audio pakietu to plik użytkownika: nie wychodzi poza komputer, a trasy oddają je tylko stronie gry.

Ten moduł nie zna serwera HTTP: `obsluz_trase()` ma kontrakt `ribbitflip_songpacks.obsluz_trase` i zwraca
(status, typ, bajty, nagłówki) albo None, gdy ścieżka nie jest nasza. Serwer pyta najpierw ten moduł, potem
pakiety MIDI. Używają go ribbitflip_monitor.py (pod tokenem sesji) i ribbitbeat_app.py. Tylko biblioteka
standardowa (bez soundfile itp.): manifest sprawdza `sprawdz_manifest`, audio idzie bajt w bajt.
"""
import json
import os
import re
import shutil
import uuid

SLUG_RE = re.compile(r"^[a-z0-9-]{1,60}$")
ID_UKLADU_RE = re.compile(r"^[a-z0-9_-]{1,40}$")
PLIKI_AUDIO = ("oryginal", "vocals", "drums", "bass", "other")
STEMY = ("vocals", "drums", "bass", "other")
ZRODLA_MIKSU = PLIKI_AUDIO + ("midi_vocal", "midi_bass", "midi_chords", "midi_drums")
WBUDOWANE_UKLADY = ("karaoke", "zabi_wokal", "oryginal_w_tle", "czysty_ribbitbeat")   # treść: pakiet-piosenki.js
AUDIO_RE = re.compile(r"^audio/[A-Za-z0-9_-]{1,40}\.(ogg|wav)$")
TYPY_AUDIO = {".ogg": "audio/ogg", ".wav": "audio/wav"}
MAKS_JSON = 32 * 1024 * 1024          # nuty.json długiej piosenki to kilkaset kB; większy plik nie jest naszym pakietem
MAKS_UKLADOW = 24


# ---------------------------------------------------------------------------------------------
# KATALOG
def katalog_piosenek():
    """Katalog pakietów piosenek w danych użytkownika, nigdy obok .exe. Test podstawia własny zmienną środowiska."""
    k = os.environ.get("RIBBITFLIP_PIOSENKI_DIR")
    if not k:
        baza = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Local")
        k = os.path.join(baza, "RibbitFlip", "Piosenki")
    return k


def _folder(slug):
    """Folder pakietu dla poprawnego slugu; ValueError dla wszystkiego innego (ukośniki, kropki, wielkie litery)."""
    if not isinstance(slug, str) or not SLUG_RE.fullmatch(slug):
        raise ValueError("Zły identyfikator piosenki.")
    return os.path.join(katalog_piosenek(), slug)


def _wewnatrz(baza, sciezka):
    """Czy `sciezka` (po rozwinięciu dowiązań) leży w `baza`. Druga zapora obok wzorców nazw."""
    try:
        b = os.path.realpath(baza)
        s = os.path.realpath(sciezka)
        return os.path.commonpath([b, s]) == b and s != b
    except ValueError:      # inne dyski w Windows
        return False


def _czytaj_json(sciezka):
    if os.path.getsize(sciezka) > MAKS_JSON:
        raise ValueError("plik za duży")
    with open(sciezka, "rb") as f:
        return json.loads(f.read().decode("utf-8"))


def _zapisz_atomowo(sciezka, dane):
    tmp = sciezka + ".tmp-%s" % uuid.uuid4().hex[:8]
    try:
        with open(tmp, "wb") as f:
            f.write(dane)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, sciezka)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


# ---------------------------------------------------------------------------------------------
# WALIDACJA MANIFESTU (kontrakt „Format pakietu piosenki v1”)
def _liczba(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and abs(x) != float("inf")


def sprawdz_manifest(m, slug=None):
    """Lista błędów manifestu (pusta = poprawny). `slug`: nazwa folderu, z którą manifest musi się zgadzać."""
    b = []
    if not isinstance(m, dict):
        return ["manifest nie jest obiektem JSON"]
    if m.get("wersja") != 1:
        b.append("wersja: oczekiwano 1")
    s = m.get("slug")
    if not isinstance(s, str) or not SLUG_RE.fullmatch(s):
        b.append("slug: oczekiwano [a-z0-9-]{1,60}")
    elif slug is not None and s != slug:
        b.append("slug: inny niż nazwa folderu")
    if not isinstance(m.get("tytul"), str) or not m.get("tytul").strip():
        b.append("tytul: pusty")
    mc = m.get("mapa_czasu")
    if not isinstance(mc, dict):
        b.append("mapa_czasu: brak")
    else:
        ud = mc.get("uderzenia_s")
        if not isinstance(ud, list) or len(ud) < 2 or not all(_liczba(u) for u in ud):
            b.append("mapa_czasu.uderzenia_s: co najmniej dwie liczby")
        elif any(ud[i + 1] <= ud[i] for i in range(len(ud) - 1)):
            b.append("mapa_czasu.uderzenia_s: czasy muszą rosnąć")
        if not isinstance(mc.get("tpq"), int) or isinstance(mc.get("tpq"), bool) or mc.get("tpq") <= 0:
            b.append("mapa_czasu.tpq: dodatnia liczba całkowita")
        if not _liczba(mc.get("wspolczynnik")) or mc.get("wspolczynnik") <= 0:
            b.append("mapa_czasu.wspolczynnik: liczba dodatnia")
        for k in ("start_tick", "start_s", "poczatek_u"):
            if k in mc and mc[k] is not None and not _liczba(mc[k]):
                b.append("mapa_czasu.%s: liczba" % k)
    t = m.get("tempo")
    if not isinstance(t, dict) or not _liczba(t.get("zapisane_bpm")) or not (10 <= t.get("zapisane_bpm") <= 400):
        b.append("tempo.zapisane_bpm: liczba 10–400")
    sc = m.get("sciezki")
    if not isinstance(sc, list):
        b.append("sciezki: lista")
    else:
        for i, x in enumerate(sc):
            if not (isinstance(x, dict) and isinstance(x.get("nazwa"), str) and isinstance(x.get("kanal"), int)
                    and 0 <= x.get("kanal") <= 15):
                b.append("sciezki[%d]: {nazwa, kanal 0–15}" % i)
    a = m.get("audio")
    if a is not None:
        if not isinstance(a, dict):
            b.append("audio: obiekt albo null")
        else:
            o = a.get("oryginal")
            if o is not None and not (isinstance(o, str) and AUDIO_RE.fullmatch(o)):
                b.append("audio.oryginal: audio/<nazwa>.ogg|.wav albo null")
            st = a.get("stemy") or {}
            if not isinstance(st, dict):
                b.append("audio.stemy: obiekt")
            else:
                for k, v in st.items():
                    if k not in STEMY:
                        b.append("audio.stemy: nieznany stem %s" % k)
                    elif v is not None and not (isinstance(v, str) and AUDIO_RE.fullmatch(v)):
                        b.append("audio.stemy.%s: audio/<nazwa>.ogg|.wav" % k)
    lic = m.get("licencja")
    if not isinstance(lic, dict) or not isinstance(lic.get("typ"), str):
        b.append("licencja: {typ, nazwa, do_udostepniania}")
    elif _ma_audio(m) and (lic.get("typ") != "uzytkownik" or lic.get("do_udostepniania") is not False):
        b.append("licencja: pakiet z audio to plik użytkownika (typ uzytkownik, do_udostepniania false)")
    u = m.get("uklad_domyslny")
    if u is not None and not (isinstance(u, str) and ID_UKLADU_RE.fullmatch(u)):
        b.append("uklad_domyslny: identyfikator układu")
    return b


def _ma_audio(m):
    a = m.get("audio") if isinstance(m, dict) else None
    if not isinstance(a, dict):
        return False
    st = a.get("stemy") or {}
    return bool(a.get("oryginal")) or (isinstance(st, dict) and any(st.values()))


def czytaj_manifest(slug):
    """(manifest, błędy). Brak pliku albo zły JSON to też błąd, nie wyjątek."""
    k = _folder(slug)
    p = os.path.join(k, "manifest.json")
    if not os.path.isfile(p):
        if not os.path.isdir(k):
            raise KeyError("Nie ma takiej piosenki.")
        return None, ["brak manifest.json"]
    try:
        m = _czytaj_json(p)
    except (OSError, ValueError) as e:
        return None, ["manifest.json: %s" % e]
    return m, sprawdz_manifest(m, slug)


def _sekundy(m):
    z = m.get("zrodlo") if isinstance(m.get("zrodlo"), dict) else {}
    return z.get("sekund") if _liczba(z.get("sekund")) else None


def lista():
    """Skrócone manifesty wszystkich pakietów; pakiet z błędnym manifestem ma pole `blad`."""
    k = katalog_piosenek()
    try:
        nazwy = sorted(os.listdir(k))
    except OSError:
        return []
    out = []
    for n in nazwy:
        if not SLUG_RE.fullmatch(n) or not os.path.isdir(os.path.join(k, n)):
            continue
        try:
            m, bledy = czytaj_manifest(n)
        except (KeyError, ValueError):
            continue
        if bledy:
            out.append({"slug": n, "blad": "; ".join(bledy[:4])})
            continue
        if not os.path.isfile(os.path.join(k, n, "piosenka.mid")):
            out.append({"slug": n, "blad": "brak piosenka.mid"})
            continue
        miks = _czytaj_miks(n)
        out.append({"slug": n, "tytul": m["tytul"], "sekundy": _sekundy(m),
                    "sciezki": [x.get("nazwa") for x in m.get("sciezki") or []],
                    "audio": _ma_audio(m),
                    "uklad_domyslny": (miks or {}).get("uklad_domyslny") or m.get("uklad_domyslny") or "karaoke",
                    "utworzono": m.get("utworzono")})
    return out


# ---------------------------------------------------------------------------------------------
# PLIKI PAKIETU
def _plik_audio(slug, nazwa):
    """Ścieżka pliku audio `nazwa` (oryginal | vocals | drums | bass | other) wg manifestu; KeyError, gdy go nie ma."""
    if nazwa not in PLIKI_AUDIO:
        raise ValueError("Nieznany plik audio.")
    m, bledy = czytaj_manifest(slug)
    if bledy:
        raise ValueError("Zły manifest: " + "; ".join(bledy[:3]))
    a = m.get("audio") or {}
    rel = a.get("oryginal") if nazwa == "oryginal" else (a.get("stemy") or {}).get(nazwa)
    if not rel or not AUDIO_RE.fullmatch(rel):
        raise KeyError("Ta piosenka nie ma takiego pliku audio.")
    k = _folder(slug)
    p = os.path.join(k, *rel.split("/"))
    if not _wewnatrz(k, p) or not os.path.isfile(p):
        raise KeyError("Brak pliku audio na dysku.")
    return p


def zakres(naglowek, rozmiar):
    """Nagłówek Range → (od, do) włącznie, None (cały plik) albo False (zakres niespełnialny). Jeden zakres."""
    if not naglowek:
        return None
    r = re.match(r"^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$", naglowek)
    if not r or (not r.group(1) and not r.group(2)):
        return None          # nieznana składnia albo kilka zakresów: cały plik (RFC 9110 pozwala zignorować)
    if not r.group(1):
        n = int(r.group(2))
        if n == 0 or rozmiar == 0:
            return False
        return max(0, rozmiar - n), rozmiar - 1
    od = int(r.group(1))
    do = int(r.group(2)) if r.group(2) else rozmiar - 1
    if od >= rozmiar or do < od:
        return False
    return od, min(do, rozmiar - 1)


def _odpowiedz_audio(p, naglowek_range):
    typ = TYPY_AUDIO[os.path.splitext(p)[1].lower()]
    rozmiar = os.path.getsize(p)
    z = zakres(naglowek_range, rozmiar)
    ng = {"Accept-Ranges": "bytes", "Cache-Control": "no-store"}
    if z is False:
        ng["Content-Range"] = "bytes */%d" % rozmiar
        return 416, typ, b"", ng
    with open(p, "rb") as f:
        if z is None:
            return 200, typ, f.read(), ng
        f.seek(z[0])
        dane = f.read(z[1] - z[0] + 1)
    ng["Content-Range"] = "bytes %d-%d/%d" % (z[0], z[1], rozmiar)
    return 206, typ, dane, ng


def _czytaj_miks(slug):
    p = os.path.join(_folder(slug), "miks.json")
    if not os.path.isfile(p):
        return None
    try:
        m = _czytaj_json(p)
    except (OSError, ValueError):
        return None
    return m if isinstance(m, dict) else None


def sprawdz_uklad(u):
    """Błąd układu miksu (napis) albo None. Głośności 0–1 (kontrakt v1, suwaki Testownika), nieznane źródła odrzucane."""
    if not isinstance(u, dict):
        return "układ nie jest obiektem"
    if not isinstance(u.get("id"), str) or not ID_UKLADU_RE.fullmatch(u["id"]):
        return "id układu: [a-z0-9_-]{1,40}"
    if not isinstance(u.get("nazwa", ""), str) or len(u.get("nazwa", "")) > 60:
        return "nazwa układu: do 60 znaków"
    z = u.get("zrodla")
    if not isinstance(z, dict):
        return "zrodla: obiekt"
    for k, v in z.items():
        if k not in ZRODLA_MIKSU:
            return "nieznane źródło %s" % k
        if not _liczba(v) or not 0 <= v <= 1:
            return "głośność %s: 0–1" % k
    if u.get("melodia_gracza", "spiew") not in ("spiew", "instrument"):
        return "melodia_gracza: spiew albo instrument"
    return None


def zapisz_miks(slug, d):
    """POST piosenki/miks: zapamiętany układ (`uklad_domyslny`) i opcjonalnie własne układy. Zapis atomowy."""
    k = _folder(slug)
    m, bledy = czytaj_manifest(slug)
    if bledy:
        raise ValueError("Zły manifest: " + "; ".join(bledy[:3]))
    stary = _czytaj_miks(slug) or {}
    uklady = stary.get("uklady") if isinstance(stary.get("uklady"), list) else []
    if "uklady" in d:
        if not isinstance(d["uklady"], list) or len(d["uklady"]) > MAKS_UKLADOW:
            raise ValueError("uklady: lista do %d układów" % MAKS_UKLADOW)
        for u in d["uklady"]:
            e = sprawdz_uklad(u)
            if e:
                raise ValueError(e)
        uklady = d["uklady"]
    wybor = d.get("uklad_domyslny")
    if wybor is not None:
        znane = set(WBUDOWANE_UKLADY) | {u.get("id") for u in uklady if isinstance(u, dict)}
        if not isinstance(wybor, str) or wybor not in znane:
            raise ValueError("Nieznany układ miksu.")
    nowy = dict(stary)
    nowy.update({"wersja": 1, "uklady": uklady})
    if wybor is not None:
        nowy["uklad_domyslny"] = wybor
    _zapisz_atomowo(os.path.join(k, "miks.json"), json.dumps(nowy, ensure_ascii=False, indent=1).encode("utf-8"))
    return nowy


def usun(slug):
    k = _folder(slug)
    if not os.path.isdir(k):
        return False
    if not _wewnatrz(katalog_piosenek(), k):
        raise ValueError("Folder poza katalogiem piosenek.")
    shutil.rmtree(k)
    return True


# ---------------------------------------------------------------------------------------------
# TRASY
def _json(status, obj):
    return (status, "application/json; charset=utf-8", json.dumps(obj, ensure_ascii=False).encode("utf-8"),
            {"Cache-Control": "no-store"})


def _plik(slug, nazwa):
    p = os.path.join(_folder(slug), nazwa)
    if not os.path.isfile(p):
        raise KeyError("Brak pliku %s w pakiecie." % nazwa)
    return p


def obsluz_trase(metoda, sciezka, zapytanie, dane, naglowki=None):
    """(status, typ, bajty, nagłówki) dla /gry/api/piosenki…, albo None, gdy ścieżka nie jest nasza.
    `zapytanie`: dict z parse_qs (listy), `dane`: ciało JSON albo None, `naglowki`: nagłówki żądania (Range)."""
    if not isinstance(sciezka, str) or not sciezka.startswith("/gry/api/piosenki"):
        return None
    r = sciezka[len("/gry/api/"):]
    if r != "piosenki" and not r.startswith("piosenki/"):
        return None
    q = {k: (v[0] if isinstance(v, list) else v) for k, v in (zapytanie or {}).items()}
    d = dane if isinstance(dane, dict) else {}
    slug = q.get("slug", "") if metoda == "GET" else d.get("slug", "")
    try:
        if metoda == "GET" and r == "piosenki":
            return _json(200, {"ok": True, "piosenki": lista()})
        if metoda == "GET" and r == "piosenki/manifest":
            m, bledy = czytaj_manifest(slug)
            if bledy:
                return _json(422, {"ok": False, "error": "Zły manifest: " + "; ".join(bledy[:4]), "bledy": bledy})
            return _json(200, {"ok": True, "manifest": m, "miks": _czytaj_miks(slug)})
        if metoda == "GET" and r == "piosenki/midi":
            with open(_plik(slug, "piosenka.mid"), "rb") as f:
                b = f.read()
            if b[:4] != b"MThd":
                return _json(422, {"ok": False, "error": "piosenka.mid nie jest plikiem MIDI."})
            return 200, "audio/midi", b, {"Cache-Control": "no-store"}
        if metoda == "GET" and r == "piosenki/nuty":
            return _json(200, {"ok": True, "nuty": _czytaj_json(_plik(slug, "nuty.json"))})
        if metoda == "GET" and r == "piosenki/miks":
            if not os.path.isdir(_folder(slug)):
                raise KeyError("Nie ma takiej piosenki.")
            return _json(200, {"ok": True, "miks": _czytaj_miks(slug)})
        if metoda == "GET" and r == "piosenki/audio":
            rng = None
            if naglowki is not None:
                rng = naglowki.get("Range") or naglowki.get("range")
            return _odpowiedz_audio(_plik_audio(slug, q.get("plik", "")), rng)
        if metoda == "POST" and r == "piosenki/miks":
            return _json(200, {"ok": True, "miks": zapisz_miks(slug, d)})
        if metoda == "POST" and r == "piosenki/usun":
            return _json(200, {"ok": usun(slug)})
    except KeyError as e:
        return _json(404, {"ok": False, "error": str(e).strip("'\"")})
    except ValueError as e:
        return _json(400, {"ok": False, "error": str(e)})
    except OSError as e:
        return _json(500, {"ok": False, "error": "Błąd dysku: %s" % e.strerror})
    return _json(404, {"ok": False, "error": "nieznana trasa"})
