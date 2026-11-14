# RibbitBeat: pakiety piosenek z audio (faza 3 konwertera audio → MIDI). Run: py tests/test_gry_pakiety.py
#
# Co pilnuje:
#  1. trasy /gry/api/piosenki* (ribbitflip_piosenki.obsluz_trase) na katalogu tymczasowym: lista (z pakietem
#     o złym manifeście zgłoszonym polem `blad`), manifest, midi, nuty, miks, audio (cały plik i nagłówek Range:
#     206, sufiks, 416), POST miks (zapamiętany układ, własne układy, odrzucenie złych), POST usun,
#     path traversal w slugu i w ścieżce audio z manifestu, Cache-Control: no-store, trasy nie nasze = None,
#  2. walidator manifestu `sprawdz_manifest` i parser zakresu `zakres`,
#  3. funkcje mapy czasu i układów miksu z web/gry/js/pakiet-piosenki.js w Node
#     (tests/gry_pakiety_harness.mjs wycina je po nazwie): monotoniczność, odwracalność tick↔s, ekstrapolacja,
#     składanie układu (fold 2 / 0,5), fragment z powtórkami,
#  4. smoke aplikacji: kopia monitora w katalogu tymczasowym (--simulate --no-keys, wolny port,
#     RIBBITFLIP_PIOSENKI_DIR) → GET /gry/api/piosenki zwraca pakiet, audio z Range, POST z tokenem i bez,
#     a trasy pakietów MIDI (/gry/api/pakiety) nadal odpowiadają.
#
# Pakiet testowy (WAV 16-bit 2 s z modułu `wave`, 8 nut wokalu + 4 nuty basu) powstaje tutaj, nic z niego nie
# pochodzi z żadnego utworu. Pliki tekstowe pakietu zapisuje test do tests/fixtures/pakiet_piosenki/test-pakiet/
# (deterministycznie, bez audio: audio nie trafia do repozytorium); pełny pakiet z audio tylko w katalogu
# tymczasowym. Do ręcznego sprawdzenia gry w przeglądarce:
#   py tests/test_gry_pakiety.py --zapisz-pakiet <katalog>
# zapisuje pełny pakiet do <katalog>/test-pakiet/ (aplikacja z RIBBITFLIP_PIOSENKI_DIR=<katalog>).
import io
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import wave

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO)
FIXTURE = os.path.join(REPO, "tests", "fixtures", "pakiet_piosenki")
SLUG = "test-pakiet"
SR = 22050
_passed = _failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s   %s" % (name, detail))


# ---- pakiet testowy ------------------------------------------------------------------------------
TPQ = 480
BPM = 120
# 8 nut wokalu (ósemki, C-dur w górę i z powrotem) i 4 ćwierćnuty basu: 4 ćwierćnuty = 2 s przy 120 BPM
WOKAL = [(i * 240, 240, m) for i, m in enumerate([60, 62, 64, 65, 67, 65, 64, 62])]
BAS = [(i * 480, 480, m) for i, m in enumerate([36, 43, 41, 36])]
UDERZENIA = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5]   # ćwierćnuta = 1 uderzenie, nagranie równo w 120 BPM


def _vlq(n):
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.insert(0, (n & 0x7F) | 0x80)
        n >>= 7
    return bytes(out)


def _sciezka(zdarzenia):
    body = b"".join(_vlq(dt) + ev for dt, ev in zdarzenia) + b"\x00\xff\x2f\x00"
    return b"MTrk" + struct.pack(">I", len(body)) + body


def _nuty_sciezki(nazwa, kanal, nuty):
    ev = [(0, b"\xff\x03" + _vlq(len(nazwa)) + nazwa.encode("ascii"))]
    zd = []
    for t, d, m in nuty:
        zd.append((t, 1, bytes([0x90 | kanal, m, 90])))
        zd.append((t + d, 0, bytes([0x80 | kanal, m, 0])))
    zd.sort(key=lambda x: (x[0], x[1]))
    teraz = 0
    for t, _, b in zd:
        ev.append((t - teraz, b))
        teraz = t
    return _sciezka(ev)


def zbuduj_midi():
    usq = int(60_000_000 / BPM)
    dyr = _sciezka([(0, b"\xff\x51\x03" + usq.to_bytes(3, "big")), (0, b"\xff\x58\x04\x04\x02\x18\x08")])
    sc = [dyr, _nuty_sciezki("Vocal", 3, WOKAL), _nuty_sciezki("Bass", 2, BAS)]
    return b"MThd" + struct.pack(">IHHH", 6, 1, len(sc), TPQ) + b"".join(sc)


def _sek(tick):
    return tick / TPQ * 60.0 / BPM


def zbuduj_wav(rodzaj):
    """2 s mono 16-bit: wokal = sinus nut wokalu, bas = sinus basu, perkusja = kliknięcia na uderzeniach,
    reszta = cichy szum tonalny, oryginał = suma."""
    n = int(SR * 2.0)
    x = [0.0] * n

    def ton(nuty, amp):
        for t, d, m in nuty:
            f = 440.0 * 2 ** ((m - 69) / 12.0)
            a, b = int(_sek(t) * SR), min(n, int(_sek(t + d) * SR))
            for i in range(a, b):
                x[i] += amp * math.sin(2 * math.pi * f * (i - a) / SR) * min(1.0, (b - i) / 200.0)

    if rodzaj in ("vocals", "oryginal"):
        ton(WOKAL, 0.3)
    if rodzaj in ("bass", "oryginal"):
        ton(BAS, 0.25)
    if rodzaj in ("drums", "oryginal"):
        for u in UDERZENIA:
            a = int(u * SR)
            for i in range(a, min(n, a + 600)):
                x[i] += 0.5 * math.exp(-(i - a) / 90.0) * (1 if (i // 7) % 2 else -1)
    if rodzaj in ("other", "oryginal"):
        for i in range(n):
            x[i] += 0.05 * math.sin(2 * math.pi * 330 * i / SR)
    bio = io.BytesIO()
    with wave.open(bio, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", max(-32767, min(32767, int(v * 32767)))) for v in x))
    return bio.getvalue()


def manifest(slug=SLUG):
    return {
        "wersja": 1, "slug": slug, "tytul": "Pakiet testowy (8 nut)", "utworzono": "2026-10-04T12:00:00",
        "konwerter": {"wersja": "test", "wariant": "test", "metoda_melodii": "test", "separator": "test"},
        "zrodlo": {"nazwa_pliku": "test.wav", "sha256": "0" * 64, "sekund": 2.0, "sr": SR},
        "tempo": {"zapisane_bpm": BPM, "wykryte_bpm": BPM, "uderzen_na_cwiercnute": 1},
        "metrum": "4/4",
        "mapa_czasu": {"uderzenia_s": UDERZENIA, "tpq": TPQ, "wspolczynnik": 1, "start_tick": 0, "start_s": 0.0},
        "sciezki": [{"nazwa": "Vocal", "kanal": 3, "nut": len(WOKAL)}, {"nazwa": "Bass", "kanal": 2, "nut": len(BAS)}],
        "audio": {"oryginal": "audio/oryginal.wav",
                  "stemy": {k: "audio/%s.wav" % k for k in ("vocals", "drums", "bass", "other")},
                  "kodek": "wav", "sr": SR},
        "licencja": {"typ": "uzytkownik", "nazwa": "plik użytkownika", "do_udostepniania": False},
        "edycje": False, "uklad_domyslny": "karaoke"}


def nuty_json():
    def lista(nuty):
        return [{"t_s": round(_sek(t), 4), "d_s": round(_sek(d), 4), "tick": t, "d_tick": d, "m": m, "v": 90}
                for t, d, m in nuty]
    return {"sciezki": {"Vocal": lista(WOKAL), "Bass": lista(BAS)}}


MIKS = {"wersja": 1, "uklady": [{"id": "moj_bas", "nazwa": "Sam bas", "melodia_gracza": "spiew",
                                 "zrodla": {"bass": 1, "drums": 0.5, "midi_bass": 0}}]}


def zapisz_pakiet(baza, slug=SLUG, z_audio=True):
    k = os.path.join(baza, slug)
    os.makedirs(os.path.join(k, "audio"), exist_ok=True)

    def js(nazwa, obj):
        with open(os.path.join(k, nazwa), "w", encoding="utf-8", newline="\n") as f:
            json.dump(obj, f, ensure_ascii=False, indent=1)
            f.write("\n")
    js("manifest.json", manifest(slug))
    js("nuty.json", nuty_json())
    js("edycje.json", {"wersja": 1, "operacje": []})
    js("miks.json", MIKS)
    with open(os.path.join(k, "piosenka.mid"), "wb") as f:
        f.write(zbuduj_midi())
    if z_audio:
        for r in ("oryginal", "vocals", "drums", "bass", "other"):
            with open(os.path.join(k, "audio", r + ".wav"), "wb") as f:
                f.write(zbuduj_wav(r))
    else:
        try:
            os.rmdir(os.path.join(k, "audio"))
        except OSError:
            pass
    return k


# ---- 1. trasy i walidator ------------------------------------------------------------------------
def sprawdz_trasy():
    import importlib
    katalog = tempfile.mkdtemp(prefix="rb-piosenki-")
    os.environ["RIBBITFLIP_PIOSENKI_DIR"] = katalog
    try:
        import ribbitflip_piosenki as rp
        importlib.reload(rp)
        zapisz_pakiet(katalog)
        # pakiet z zepsutym manifestem i folder, który nie jest pakietem (wielkie litery)
        zly = os.path.join(katalog, "zly-pakiet")
        os.makedirs(zly)
        with open(os.path.join(zly, "manifest.json"), "w", encoding="utf-8") as f:
            f.write('{"wersja": 2, "slug": "zly-pakiet"}')
        os.makedirs(os.path.join(katalog, "Obcy"))

        def T(metoda, sc, q=None, d=None, ng=None):
            return rp.obsluz_trase(metoda, "/gry/api/" + sc, {k: [v] for k, v in (q or {}).items()}, d, naglowki=ng)

        def J(w):
            return json.loads(w[2].decode("utf-8"))

        check("trasy nie nasze → None (pakiety MIDI, piosenkix, poza /gry/api/)",
              T("GET", "pakiety") is None and T("GET", "piosenkix") is None
              and rp.obsluz_trase("GET", "/web/gry/", {}, None) is None)
        w = T("GET", "piosenki")
        lst = J(w)["piosenki"]
        dobry = [x for x in lst if x["slug"] == SLUG]
        zle = [x for x in lst if x["slug"] == "zly-pakiet"]
        check("GET piosenki: 200, pakiet z tytułem, sekundami, ścieżkami, audio, układem i datą",
              w[0] == 200 and dobry and dobry[0]["tytul"].startswith("Pakiet testowy") and dobry[0]["sekundy"] == 2.0
              and dobry[0]["sciezki"] == ["Vocal", "Bass"] and dobry[0]["audio"] is True
              and dobry[0]["uklad_domyslny"] == "karaoke" and dobry[0]["utworzono"], lst)
        check("GET piosenki: zły manifest zgłoszony polem `blad`, folder spoza wzorca slugu pominięty",
              zle and "blad" in zle[0] and "wersja" in zle[0]["blad"] and not any(x["slug"] == "Obcy" for x in lst), lst)
        check("odpowiedzi JSON mają Cache-Control: no-store", w[3].get("Cache-Control") == "no-store", w[3])
        check("GET piosenki nie zdradza ścieżki katalogu (brak pola katalog, nazwy użytkownika)",
              "katalog" not in J(w) and katalog.encode("utf-8") not in w[2] and katalog.replace("\\", "\\\\").encode("utf-8") not in w[2])
        w = T("GET", "piosenki/manifest", {"slug": SLUG})
        check("GET piosenki/manifest: manifest i miks", w[0] == 200 and J(w)["manifest"]["slug"] == SLUG
              and J(w)["miks"]["uklady"][0]["id"] == "moj_bas", w[:2])
        w = T("GET", "piosenki/manifest", {"slug": "zly-pakiet"})
        check("GET piosenki/manifest złego pakietu: 422 z listą błędów", w[0] == 422 and J(w)["bledy"], w[:3])
        w = T("GET", "piosenki/manifest", {"slug": "nie-ma-takiej"})
        check("GET piosenki/manifest nieznanego slugu: 404", w[0] == 404, w[:2])
        for zly_slug in ("..", "../x", "a/b", "A", "a\\b", "", "x" * 61, "%2e%2e", SLUG + "\n", "\n" + SLUG):
            w = T("GET", "piosenki/manifest", {"slug": zly_slug})
            if w[0] != 400:
                break
        check("path traversal i zły slug (.., ../x, a/b, wielkie litery, 61 znaków, slug z \\n na końcu…): 400", w[0] == 400, (zly_slug, w[:3]))
        w = T("GET", "piosenki/midi", {"slug": SLUG})
        check("GET piosenki/midi: audio/midi, plik zaczyna się od MThd", w[0] == 200 and w[1] == "audio/midi"
              and w[2][:4] == b"MThd", w[:2])
        w = T("GET", "piosenki/nuty", {"slug": SLUG})
        check("GET piosenki/nuty: ścieżki Vocal (8 nut) i Bass (4)", w[0] == 200 and len(J(w)["nuty"]["sciezki"]["Vocal"]) == 8
              and len(J(w)["nuty"]["sciezki"]["Bass"]) == 4, w[:2])
        w = T("GET", "piosenki/miks", {"slug": SLUG})
        check("GET piosenki/miks: zawartość miks.json", w[0] == 200 and J(w)["miks"]["uklady"][0]["nazwa"] == "Sam bas", w[:2])
        # audio
        caly = T("GET", "piosenki/audio", {"slug": SLUG, "plik": "oryginal"})
        rozmiar = len(caly[2])
        check("GET piosenki/audio (oryginal): 200 audio/wav, nagłówek RIFF, Accept-Ranges",
              caly[0] == 200 and caly[1] == "audio/wav" and caly[2][:4] == b"RIFF" and caly[3].get("Accept-Ranges") == "bytes"
              and rozmiar > SR * 2 * 2, (caly[0], caly[1], rozmiar))
        wokal = T("GET", "piosenki/audio", {"slug": SLUG, "plik": "vocals"})[2]
        w = T("GET", "piosenki/audio", {"slug": SLUG, "plik": "vocals"}, ng={"Range": "bytes=0-99"})
        check("Range bytes=0-99: 206, 100 bajtów, Content-Range", w[0] == 206 and len(w[2]) == 100 and w[2] == wokal[:100]
              and w[3].get("Content-Range") == "bytes 0-99/%d" % rozmiar, (w[0], len(w[2]), w[3]))
        w = T("GET", "piosenki/audio", {"slug": SLUG, "plik": "vocals"}, ng={"range": "bytes=-10"})
        check("Range bytes=-10 (sufiks, nagłówek małymi literami): ostatnie 10 bajtów", w[0] == 206 and len(w[2]) == 10
              and w[3]["Content-Range"] == "bytes %d-%d/%d" % (rozmiar - 10, rozmiar - 1, rozmiar), (w[0], w[3]))
        w = T("GET", "piosenki/audio", {"slug": SLUG, "plik": "vocals"}, ng={"Range": "bytes=%d-" % (rozmiar - 4)})
        check("Range bytes=N- : reszta pliku", w[0] == 206 and len(w[2]) == 4, (w[0], len(w[2])))
        w = T("GET", "piosenki/audio", {"slug": SLUG, "plik": "vocals"}, ng={"Range": "bytes=%d-" % (rozmiar + 5)})
        check("Range poza plikiem: 416 z Content-Range */rozmiar", w[0] == 416 and w[3]["Content-Range"] == "bytes */%d" % rozmiar,
              (w[0], w[3]))
        w = T("GET", "piosenki/audio", {"slug": SLUG, "plik": "vocals"}, ng={"Range": "bytes=0-1,5-9"})
        check("Range z kilkoma zakresami: cały plik (200)", w[0] == 200 and len(w[2]) == rozmiar, w[0])
        w = T("GET", "piosenki/audio", {"slug": SLUG, "plik": "../manifest.json"})
        w2 = T("GET", "piosenki/audio", {"slug": SLUG, "plik": "midi"})
        check("GET piosenki/audio z plikiem spoza listy (../manifest.json, midi): 400", w[0] == 400 and w2[0] == 400, (w[:2], w2[:2]))
        check("zakres(): składnia i granice", rp.zakres(None, 10) is None and rp.zakres("bytes=2-4", 10) == (2, 4)
              and rp.zakres("bytes=8-50", 10) == (8, 9) and rp.zakres("bytes=-3", 10) == (7, 9) and rp.zakres("bytes=5-2", 10) is False
              and rp.zakres("bytes=-0", 10) is False and rp.zakres("items=0-1", 10) is None and rp.zakres("bytes=-50", 10) == (0, 9))
        # ścieżka audio z manifestu prowadząca poza pakiet
        m = manifest()
        m["audio"]["stemy"]["vocals"] = "audio/../../x.wav"
        m2 = manifest()
        m2["audio"]["oryginal"] = "C:/Windows/win.ini"
        check("walidator odrzuca ścieżkę audio poza audio/ (.. i ścieżka bezwzględna)",
              any("vocals" in b for b in rp.sprawdz_manifest(m)) and any("oryginal" in b for b in rp.sprawdz_manifest(m2)))
        # miks
        w = T("POST", "piosenki/miks", d={"slug": SLUG, "uklad_domyslny": "zabi_wokal"})
        with open(os.path.join(katalog, SLUG, "miks.json"), encoding="utf-8") as f:
            zapis = json.load(f)
        check("POST piosenki/miks: zapamiętany układ w miks.json, własne układy zostają",
              w[0] == 200 and zapis.get("uklad_domyslny") == "zabi_wokal" and zapis["uklady"][0]["id"] == "moj_bas"
              and zapis["wersja"] == 1, (w[:2], zapis))
        lst = J(T("GET", "piosenki"))["piosenki"]
        check("GET piosenki po zapisie: uklad_domyslny z miks.json", [x for x in lst if x["slug"] == SLUG][0]["uklad_domyslny"] == "zabi_wokal")
        w = T("POST", "piosenki/miks", d={"slug": SLUG, "uklad_domyslny": "moj_bas"})
        check("POST piosenki/miks: można wybrać własny układ", w[0] == 200 and J(w)["miks"]["uklad_domyslny"] == "moj_bas")
        w = T("POST", "piosenki/miks", d={"slug": SLUG, "uklad_domyslny": "nie-ma"})
        check("POST piosenki/miks z nieznanym układem: 400", w[0] == 400, w[:3])
        bledne = [{"id": "x", "zrodla": {"bass": 3}}, {"id": "x", "zrodla": {"bass": 1.5}}, {"id": "x", "zrodla": {"gitara": 1}}, {"id": "../x", "zrodla": {}},
                  {"id": "x", "zrodla": {"bass": 1}, "melodia_gracza": "taniec"}, {"id": "x", "zrodla": {"bass": True}}]
        kody = [T("POST", "piosenki/miks", d={"slug": SLUG, "uklady": [u]})[0] for u in bledne]
        check("POST piosenki/miks ze złym układem (głośność 3 i 1,5 poza 0–1, nieznane źródło, zły id, melodia, bool): 400",
              kody == [400] * len(bledne), kody)
        w = T("POST", "piosenki/miks", d={"slug": SLUG, "uklady": [{"id": "pol", "nazwa": "Pół", "zrodla": {"oryginal": 0.5}}],
                                          "uklad_domyslny": "pol"})
        check("POST piosenki/miks z nowymi układami i wyborem z nich", w[0] == 200 and J(w)["miks"]["uklady"][0]["id"] == "pol"
              and J(w)["miks"]["uklad_domyslny"] == "pol", w[:3])
        check("zapis miks.json atomowy: brak plików .tmp-*", not any(".tmp-" in n for n in os.listdir(os.path.join(katalog, SLUG))))
        w = T("POST", "piosenki/miks", d={"slug": "../" + SLUG, "uklad_domyslny": "karaoke"})
        check("POST piosenki/miks ze złym slugiem: 400", w[0] == 400, w[:2])
        # walidator
        check("sprawdz_manifest: pakiet testowy bez błędów", rp.sprawdz_manifest(manifest(), SLUG) == [],
              rp.sprawdz_manifest(manifest(), SLUG))
        przypadki = {
            "slug inny niż folder": (lambda m: m, "inny-slug"),
            "uderzenia nie rosną": (lambda m: m["mapa_czasu"].update(uderzenia_s=[0, 1, 1, 2]) or m, None),
            "jedno uderzenie": (lambda m: m["mapa_czasu"].update(uderzenia_s=[0]) or m, None),
            "tpq 0": (lambda m: m["mapa_czasu"].update(tpq=0) or m, None),
            "wspolczynnik ujemny": (lambda m: m["mapa_czasu"].update(wspolczynnik=-1) or m, None),
            "tempo 0": (lambda m: m["tempo"].update(zapisane_bpm=0) or m, None),
            "kanał 16": (lambda m: m["sciezki"][0].update(kanal=16) or m, None),
            "stem nieznany": (lambda m: m["audio"]["stemy"].update(gitara="audio/g.wav") or m, None),
            "audio mp3": (lambda m: m["audio"].update(oryginal="audio/o.mp3") or m, None),
            "audio publiczne": (lambda m: m["licencja"].update(do_udostepniania=True) or m, None),
            "brak tytułu": (lambda m: m.update(tytul="  ") or m, None),
            "wersja 2": (lambda m: m.update(wersja=2) or m, None)}
        zle = [n for n, (f, s) in przypadki.items() if not rp.sprawdz_manifest(f(manifest()), s)]
        check("sprawdz_manifest łapie %d rodzajów błędów" % len(przypadki), not zle, zle)
        bez_audio = manifest()
        bez_audio["audio"] = None
        bez_audio["licencja"] = {"typ": "pd", "nazwa": "x", "do_udostepniania": True}
        check("sprawdz_manifest: pakiet bez audio może mieć inną licencję, .ogg też przechodzi",
              rp.sprawdz_manifest(bez_audio) == [] and not rp.sprawdz_manifest(
                  dict(manifest(), audio={"oryginal": "audio/oryginal.ogg", "stemy": {}, "kodek": "vorbis", "sr": 44100})))
        # usuwanie
        w = T("POST", "piosenki/usun", d={"slug": SLUG})
        check("POST piosenki/usun: folder znika, lista bez pakietu", w[0] == 200 and J(w)["ok"] is True
              and not os.path.exists(os.path.join(katalog, SLUG))
              and not any(x["slug"] == SLUG for x in J(T("GET", "piosenki"))["piosenki"]), w[:3])
        w = T("POST", "piosenki/usun", d={"slug": SLUG})
        w2 = T("POST", "piosenki/usun", d={"slug": ".."})
        w3 = T("POST", "piosenki/usun", d={"slug": SLUG + "\n"})
        check("POST piosenki/usun ze slugiem zakończonym \\n: 400 (fullmatch)", w3[0] == 400, w3[:3])
        check("POST piosenki/usun drugi raz: ok false; slug '..': 400", J(w)["ok"] is False and w2[0] == 400, (w[:3], w2[:2]))
        check("katalog z RIBBITFLIP_PIOSENKI_DIR", rp.katalog_piosenek() == katalog)
        os.environ.pop("RIBBITFLIP_PIOSENKI_DIR")
        check("katalog domyślny: %LOCALAPPDATA%\\RibbitFlip\\Piosenki",
              rp.katalog_piosenek().replace("/", "\\").endswith("RibbitFlip\\Piosenki"))
    finally:
        os.environ.pop("RIBBITFLIP_PIOSENKI_DIR", None)
        shutil.rmtree(katalog, ignore_errors=True)


# ---- 2. funkcje gry w Node -----------------------------------------------------------------------
def sprawdz_harness():
    node = shutil.which("node")
    if not node:
        print("SKIP  brak node: funkcje mapy czasu i układów nie sprawdzone")
        return
    for plik in ("web/gry/js/pakiet-piosenki.js", "tests/gry_pakiety_harness.mjs"):
        r = subprocess.run([node, "--check", os.path.join(REPO, plik)], capture_output=True, text=True, encoding="utf-8")
        check("node --check %s" % plik, r.returncode == 0, r.stderr[:300])
    r = subprocess.run([node, os.path.join(REPO, "tests", "gry_pakiety_harness.mjs")], capture_output=True, text=True,
                       encoding="utf-8", timeout=120)
    try:
        wynik = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as e:
        check("harness gry_pakiety_harness.mjs zwraca JSON", False, "%s %s" % (e, (r.stderr or r.stdout)[-800:]))
        return
    for nazwa, ok, szczegol in wynik["checks"]:
        check("[JS] " + nazwa, ok, szczegol)


# ---- 3. smoke aplikacji ------------------------------------------------------------------------
def _wolny_port():
    import socket
    for _ in range(50):
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        if not 8760 <= port <= 8799:
            return port
    raise RuntimeError("brak wolnego portu")


def _http(port, sciezka, metoda="GET", cialo=None, naglowki=None):
    import http.client
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=15)
    c.request(metoda, sciezka, body=cialo, headers=naglowki or {})
    r = c.getresponse()
    body = r.read()
    ng = {k.lower(): v for k, v in r.getheaders()}
    c.close()
    return r.status, ng, body


def sprawdz_aplikacje():
    if os.environ.get("ZC_BEZ_APLIKACJI"):
        print("SKIP  smoke aplikacji (ZC_BEZ_APLIKACJI)")
        return
    import re
    import time
    piaskownica = tempfile.mkdtemp(prefix="rb-pakiety-app-")
    proc = None
    try:
        for f in ("ribbitflip_monitor.py", "ribbitflip_mcp.py", "ribbitflip_audio.py", "ribbitflip_gesture.py",
                  "ribbitflip_songpacks.py", "ribbitflip_piosenki.py", os.path.join("web", "ribbitflip_dashboard.html")):
            cel = os.path.join(piaskownica, f)
            os.makedirs(os.path.dirname(cel), exist_ok=True)
            shutil.copy2(os.path.join(REPO, f), cel)
        shutil.copytree(os.path.join(REPO, "web", "gry"), os.path.join(piaskownica, "web", "gry"))
        shutil.copytree(os.path.join(REPO, "packs"), os.path.join(piaskownica, "packs"))
        piosenki = os.path.join(piaskownica, "Piosenki")
        zapisz_pakiet(piosenki)
        port = _wolny_port()
        srod = dict(os.environ, RIBBITFLIP_SONGPACKS_DIR=os.path.join(piaskownica, "SongPacks"),
                    RIBBITFLIP_PIOSENKI_DIR=piosenki)
        proc = subprocess.Popen([sys.executable, os.path.join(piaskownica, "ribbitflip_monitor.py"), "--simulate", "--no-keys",
                                 "--no-open", "--no-midi", "--no-tray", "--allow-multi", "--port", str(port)],
                                cwd=piaskownica, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=srod)
        gotowa = False
        for _ in range(150):
            time.sleep(0.1)
            if proc.poll() is not None:
                break
            try:
                if _http(port, "/health")[0] == 200:
                    gotowa = True
                    break
            except Exception:
                pass
        check("aplikacja (kopia, --simulate --no-keys) wstaje z RIBBITFLIP_PIOSENKI_DIR", gotowa)
        if not gotowa:
            return
        st, ng, body = _http(port, "/gry/api/piosenki")
        lst = json.loads(body.decode("utf-8")).get("piosenki", []) if st == 200 else []
        check("aplikacja: GET /gry/api/piosenki zwraca pakiet testowy", st == 200 and [x["slug"] for x in lst] == [SLUG]
              and "no-store" in ng.get("cache-control", ""), (st, body[:200]))
        st, ng, body = _http(port, "/gry/api/piosenki/audio?slug=%s&plik=drums" % SLUG, naglowki={"Range": "bytes=0-15"})
        check("aplikacja: audio z Range → 206 i 16 bajtów", st == 206 and len(body) == 16 and body[:4] == b"RIFF"
              and ng.get("content-range", "").startswith("bytes 0-15/"), (st, ng))
        st, _, body = _http(port, "/gry/api/piosenki/midi?slug=%s" % SLUG)
        check("aplikacja: GET /gry/api/piosenki/midi", st == 200 and body[:4] == b"MThd", st)
        st7, _, body7 = _http(port, "/gry/api/pakiety")
        try:
            pak = json.loads(body7.decode("utf-8"))
        except Exception:
            pak = {}
        check("aplikacja: trasy pakietów MIDI (/gry/api/pakiety) nadal odpowiadają",
              st7 == 200 and "basic_classics" in [p.get("pack_id") for p in pak.get("pakiety", [])], (st7, body7[:200]))
        st8, _, _ = _http(port, "/gry/api/nie-ma-takiej")
        check("aplikacja: nieznana trasa /gry/api/ nadal 404", st8 == 404, st8)
        cialo = json.dumps({"slug": SLUG, "uklad_domyslny": "czysty_ribbitbeat"}).encode("utf-8")
        st, _, _ = _http(port, "/gry/api/piosenki/miks", "POST", cialo, {"Content-Type": "application/json"})
        check("aplikacja: POST piosenki/miks bez tokenu sesji → 403", st == 403, st)
        _, _, strona = _http(port, "/web/gry/")
        tok = re.search(rb'RIBBITFLIP_TOKEN\s*=\s*"([^"]+)"', strona)
        st, _, body = _http(port, "/gry/api/piosenki/miks", "POST", cialo,
                            {"Content-Type": "application/json", "X-RibbitFlip-Token": tok.group(1).decode() if tok else ""})
        check("aplikacja: POST piosenki/miks z tokenem → zapis", st == 200 and json.loads(body.decode("utf-8"))["miks"]["uklad_domyslny"]
              == "czysty_ribbitbeat", (st, body[:200]))
        st, _, _ = _http(port, "/web/gry/js/pakiet-piosenki.js")
        check("aplikacja: plik web/gry/js/pakiet-piosenki.js idzie statyką gry", st == 200, st)
    except Exception as e:
        check("smoke aplikacji wykonuje się", False, repr(e))
    finally:
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except Exception:
                proc.kill()
        shutil.rmtree(piaskownica, ignore_errors=True)


def sprawdz_higiene():
    with open(os.path.join(REPO, "web", "gry", "index.html"), encoding="utf-8") as f:
        ix = f.read()
    a, b = ix.find('src="js/tablica.js"'), ix.find('src="js/pakiet-piosenki.js"')
    check("index.html gry: jeden <script> pakiet-piosenki.js, po tablica.js", ix.count("pakiet-piosenki.js") == 1 and 0 <= a < b)
    with open(os.path.join(REPO, "web", "gry", "js", "pakiet-piosenki.js"), encoding="utf-8") as f:
        js = f.read()
    import re
    styl = js[js.find("function ppStyl("):js.find("document.head.append(s);")]
    klasy = set(re.findall(r"\.pp-[a-z-]+", styl))
    check("pakiet-piosenki.js: bez pauz, style tylko .pp-miks* (inne .pp-* to podgląd partii)",
          chr(0x2014) not in js and klasy and all(k.startswith(".pp-miks") for k in klasy), klasy)


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    if "--zapisz-pakiet" in sys.argv:
        cel = sys.argv[sys.argv.index("--zapisz-pakiet") + 1]
        print("pakiet:", zapisz_pakiet(cel))
        return
    # tekstowa część pakietu w repozytorium (bez audio), zawsze taka sama
    k = zapisz_pakiet(FIXTURE, z_audio=False)
    check("fixture tests/fixtures/pakiet_piosenki/test-pakiet: bez plików audio",
          not os.path.exists(os.path.join(k, "audio")) and os.path.isfile(os.path.join(k, "manifest.json")))
    sprawdz_trasy()
    sprawdz_harness()
    sprawdz_higiene()
    sprawdz_aplikacje()
    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1 if _failed else 0)


if __name__ == "__main__":
    main()
