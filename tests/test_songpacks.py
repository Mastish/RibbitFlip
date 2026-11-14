# RibbitBeat: pakiety MIDI i import z adresu (ribbitflip_songpacks.py, tools/build_song_manifests.py, packs/).
# Run: py tests/test_songpacks.py
#
# Co pilnuje (handoff „Pakiety MIDI i licencje w Ribbit Beat”, fazy 1–2):
#  1. reguły licencyjne skryptu manifestów (1–5 i 4b) na danych z ręki, w tym przypadki z fazy 0 (licencja NC
#     na IMSLP przy CC BY w zbiorze, autor „MIDI file by X”, szablony i adresy w polach IMSLP),
#  2. manifesty w packs/: przypięta rewizja, każdy utwór przechodzi kontrolę aplikacji, pakiet B ma 30–60 utworów
#     z autorem pliku, w repo nie ma żadnego pliku MIDI,
#  3. czytnik Parquet aplikacji na małym pliku tests/fixtures/songpacks_mini.parquet (syntetyczne MIDI, Snappy,
#     strona słownika, strony v1: tak samo jak w zbiorach TiMauzi),
#  4. pobieranie przez lokalny serwer z obsługą Range: całość (pliki, pack.json, ATTRIBUTION.txt), wznowienie bez
#     zbędnych zapytań, zły skrót, zbiór zdjęty (404), brak sieci, anulowanie, usuwanie pakietu,
#  5. trasy /gry/api/ i import z adresu (MIDI, nie-MIDI, za duży, 404, zły adres, ścieżki spoza katalogu pakietu).
# Bez sieci zewnętrznej: wszystko idzie przez 127.0.0.1.
import hashlib
import http.server
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import time

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO)
sys.path.insert(0, os.path.join(REPO, "tools"))
import ribbitflip_songpacks as sp          # noqa: E402
import build_song_manifests as bm          # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s   %s" % (name, detail))


FIX = os.path.join(REPO, "tests", "fixtures")
PARQUET = open(os.path.join(FIX, "songpacks_mini.parquet"), "rb").read()


# ---- lokalny serwer: Range, 404, spowolnienie, pliki do importu ---------------------------------------------------
class Serwer(http.server.BaseHTTPRequestHandler):
    zapytania = []
    opoznienie = 0.0
    pliki = {}

    def log_message(self, *a):
        pass

    def do_GET(self):
        Serwer.zapytania.append(self.path)
        if Serwer.opoznienie:
            time.sleep(Serwer.opoznienie)
        if self.path.startswith("/datasets/test/mini/resolve/abc123/data/mini.parquet"):
            dane = PARQUET
            rng = self.headers.get("Range")
            if rng:
                od, do_ = rng.split("=")[1].split("-")
                kawalek = dane[int(od):int(do_) + 1]
                self.send_response(206)
                self.send_header("Content-Range", "bytes %s-%s/%d" % (od, do_, len(dane)))
            else:
                kawalek = dane
                self.send_response(200)
            self.send_header("Content-Length", str(len(kawalek)))
            self.end_headers()
            self.wfile.write(kawalek)
            return
        if self.path in Serwer.pliki:
            typ, dane = Serwer.pliki[self.path]
            self.send_response(200)
            self.send_header("Content-Type", typ)
            self.send_header("Content-Length", str(len(dane)))
            self.end_headers()
            self.wfile.write(dane)
            return
        self.send_response(404)
        self.send_header("Content-Length", "0")
        self.end_headers()


def uruchom_serwer():
    s = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Serwer)
    s.daemon_threads = True
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def czekaj(zid, limit=15):
    t0 = time.time()
    while time.time() - t0 < limit:
        z = sp.zadanie(zid)
        if z and z["stan"] != "trwa":
            return z
        time.sleep(0.05)
    return sp.zadanie(zid)


def main():
    # ---- 1. reguły ------------------------------------------------------------------------------------------------
    check("reguła 1: rok graniczny 2026 → zmarli do 1955", bm.rok_graniczny(2026) == 1955)
    rd = bm.regula_domeny
    check("reguła 1: zmarł 1955 przechodzi, 1956 odpada", rd(1955, 1950, 1955)[0] and not rd(1956, 1900, 1955)[0])
    check("reguła 2: brak roku śmierci: utwór z 1870 przechodzi, z 1871 i bez roku odpada",
          rd(None, 1870, 1955)[0] and not rd(None, 1871, 1955)[0] and not rd(None, None, 1955)[0])
    check("reguła 3: allowlista przepuszcza współczesny utwór CC0", rd(2001, 1999, 1955, True)[0])
    lt = bm.licencja_z_tekstu
    check("licencja z IMSLP: BY 4.0, BY-SA 3.0, PD, CC0, NC i ND rozpoznane",
          lt("Creative Commons Attribution 4.0")["id"] == "cc-by-4.0" and
          lt("Creative Commons Attribution-ShareAlike 3.0")["id"] == "cc-by-sa-3.0" and
          lt("Creative Commons Attribution Share Alike")["rodzina"] == "by-sa" and
          lt("Public Domain")["id"] == "public-domain" and lt("Creative Commons Zero 1.0")["id"] == "cc0-1.0" and
          lt("Creative Commons Attribution Non-commercial 4.0")["zakaz"] and
          lt("Creative Commons Attribution-NoDerivs 3.0")["zakaz"] and lt("") is None)
    rl = bm.regula_licencji
    check("reguła 4b: zbiór CC BY 4.0, IMSLP NonCommercial (Mozart K.424, Händel z WIMA) → odrzucenie",
          rl("basic_classics", "cc-by-4.0", "Creative Commons Attribution Non-commercial 4.0")[0] is None)
    check("reguła 4b: zbiór BY-SA 4.0, IMSLP BY 3.0 → licencja z IMSLP (cc-by-3.0)",
          rl("basic_classics", "cc-by-sa-4.0", "Creative Commons Attribution 3.0") == ("cc-by-3.0", None))
    check("reguła 4b: IMSLP bez wersji przy tej samej rodzinie → wersja ze zbioru",
          rl("basic_classics", "cc-by-sa-3.0", "Creative Commons Attribution Share Alike") == ("cc-by-sa-3.0", None))
    check("reguła 4b: IMSLP bez wersji przy innej rodzinie → odrzucenie",
          rl("basic_classics", "cc-by-sa-3.0", "Creative Commons Attribution")[0] is None)
    check("reguła 4: licencja w zbiorze spoza pakietu (BY-NC) → odrzucenie",
          rl("basic_classics", "cc-by-nc-4.0", "Creative Commons Attribution 4.0")[0] is None)
    check("pakiet A: tylko domena publiczna i CC0, CC BY z IMSLP odpada",
          rl("cc0_classics", None, "Public Domain") == ("public-domain", None) and
          rl("cc0_classics", "cc0-1.0", "Creative Commons Zero") == ("cc0-1.0", None) and
          rl("cc0_classics", None, "Creative Commons Attribution 4.0")[0] is None)
    check("pakiet „Klasyka z atrybucją”: ze zbioru CC0 bierze tylko CC BY i BY-SA z IMSLP, domena publiczna i NC odpadają",
          rl("cc_by_classics", "cc0-1.0", "Creative Commons Attribution 4.0") == ("cc-by-4.0", None) and
          rl("cc_by_classics", None, "Creative Commons Attribution Share Alike 3.0") == ("cc-by-sa-3.0", None) and
          rl("cc_by_classics", "cc0-1.0", "Public Domain")[0] is None and
          rl("cc_by_classics", "cc0-1.0", "Creative Commons Attribution Non-commercial 3.0")[0] is None)
    am = bm.autor_midi
    check("autor: „MIDI file by Pierre Gouin” wygrywa z wydawcą i kontem (Keanur)",
          am({"Performers": "MIDI file by Pierre Gouin", "Publisher Information": "Montréal: Les Éditions Outremontaises, 2008",
              "Uploader": "[[User:Keanur|Keanur]]"}) == "Pierre Gouin")
    check("autor: Publisher Information bez roku i adresu e-mail (Lanoiselée), Performers „MIDI” pomijane",
          am({"Performers": "MIDI", "Publisher Information": "Marc Lanoiselée [mailto:marc@example.org marc@example.org], 2014."})
          == "Marc Lanoiselée")
    check("autor: szablon {{knuth}} w wydawcy → nazwisko z Performers",
          am({"Performers": "Jürgen Knuth", "Publisher Information": "{{knuth}}"}) == "Jürgen Knuth")
    check("autor: sam program do nut („PhotoScore”) i puste pola → brak autora",
          am({"Performers": "PhotoScore", "Publisher Information": ""}) is None and am({}) is None)
    ra = bm.regula_autora
    check("reguła 5: BY 3.0 bez autora odpada, pakiet B zawsze wymaga autora, PD w pakiecie A nie",
          not ra("basic_classics", "cc-by-3.0", None)[0] and not ra("basic_classics", "cc-by-4.0", None)[0]
          and ra("cc0_classics", "public-domain", None)[0] and not ra("cc_by_classics", "cc-by-4.0", None)[0])
    blok = ("{{#fte:imslpaudio\n|File Name 1=PMLP1-a.mid\n|File Description 1=I\n|File Name 2=PMLP1-b.mid\n"
            "|Performers=MIDI file by [[User:Jan|Jan Nowak]]\n|Copyright={{CC-BY-4.0}} Creative Commons Attribution 4.0\n"
            "|Uploader=[[User:X|X]]\n}}\n")
    wiki = "intro\n" + blok + "{{#fte:imslpaudio\n|File Name 1=PMLP1-c.mid\n|Copyright=Public Domain\n}}\n"
    b2 = bm.blok_pliku(wiki, "PMLP1-b.mid")
    pola = bm.pola_bloku(b2 or "")
    check("blok IMSLP: plik znaleziony po pełnej nazwie w bloku z kilkoma plikami, pola z linkami w środku całe",
          b2 is not None and pola.get("Performers") == "MIDI file by [[User:Jan|Jan Nowak]]" and
          "Attribution 4.0" in pola.get("Copyright", "") and bm.blok_pliku(wiki, "PMLP9-x.mid") is None, pola)
    check("rok śmierci ze strony kompozytora (Died Year)",
          bm.rok_smierci_z_wikitext("{{#fte:person\n|Born Year=1810\n|Died Year=1849\n}}") == 1849 and
          bm.rok_smierci_z_wikitext("") is None)
    check("rok śmierci z pola Death Date, gdy brak Died Year („probably by 12 October 1591”, „c.1640”)",
          bm.rok_smierci_z_wikitext("{{#fte:person\n|Death Date=probably by 12 October 1591\n}}") == 1591 and
          bm.rok_smierci_z_wikitext("|Death Date=c.1640\n|Born Year=1580") == 1640 and
          bm.rok_smierci_z_wikitext("|Death Date=\n|Died Year=") is None)

    # ---- 2. manifesty w repo --------------------------------------------------------------------------------------
    sp.ustaw_katalog_manifestow(os.path.join(REPO, "packs"))
    mani = sp.wczytaj_manifesty()
    check("packs/: są trzy manifesty (basic_classics, cc_by_classics, cc0_classics)",
          set(mani) >= {"cc0_classics", "basic_classics", "cc_by_classics"} and set(mani) <= set(sp.LICENCJE_PAKIETU),
          sorted(mani))
    gdzie = {}
    for pid, m in mani.items():
        for s in m["songs"]:
            gdzie.setdefault(s["id"], []).append(pid)
    check("żaden plik MIDI nie jest w dwóch pakietach", not [i for i, p in gdzie.items() if len(p) > 1],
          [(i, p) for i, p in gdzie.items() if len(p) > 1][:3])
    for pid, m in mani.items():
        zle = [(s["id"], sp.utwor_poprawny(pid, s)) for s in m["songs"] if sp.utwor_poprawny(pid, s)]
        check("%s: przypięta rewizja (SHA commita) i każdy utwór przechodzi kontrolę aplikacji" % pid,
              len(m.get("revision") or "") == 40 and not zle and m["songs"], zle[:3])
        check("%s: rozmiar pobrania = suma różnych fragmentów kolumny midi" % pid,
              m["download_bytes"] == sum({(s["parquet_file"], s["midi_chunk_offset"]): s["midi_chunk_length"]
                                          for s in m["songs"]}.values()))
    if "basic_classics" in mani:
        b = mani["basic_classics"]["songs"]
        check("pakiet B: 30–60 utworów, każdy z autorem pliku MIDI i licencją BY/BY-SA albo PD",
              30 <= len(b) <= 60 and all(s["midi_author"] for s in b), len(b))
    if "cc0_classics" in mani:
        a = mani["cc0_classics"]["songs"]
        check("pakiet A: tylko CC0 i domena publiczna, kompozytorzy zmarli do roku granicznego albo utwory do 1870",
              all(s["license"] in ("cc0-1.0", "public-domain") for s in a) and
              all((s["composer_death_year"] or 0) <= mani["cc0_classics"]["pd_cutoff_year"] or (s["year"] or 9999) <= 1870
                  for s in a), len(a))
    if "cc_by_classics" in mani:
        c = mani["cc_by_classics"]["songs"]
        check("pakiet „Klasyka z atrybucją”: tylko CC BY/BY-SA, każdy utwór z autorem pliku MIDI",
              c and all(s["license"].startswith("cc-by") and s["midi_author"] for s in c), len(c))
    midi_w_repo = [os.path.join(d, f) for d, _, fs in os.walk(os.path.join(REPO, "packs")) for f in fs if f.lower().endswith((".mid", ".midi"))]
    check("w packs/ nie ma żadnego pliku MIDI (tylko manifesty, kuracja i raporty odrzuceń)", not midi_w_repo, midi_w_repo)

    # ---- 3. czytnik -----------------------------------------------------------------------------------------------
    m0 = json.load(open(os.path.join(FIX, "songpacks_mini.json"), encoding="utf-8"))
    s0 = m0["songs"][0]
    frag = PARQUET[s0["midi_chunk_offset"]:s0["midi_chunk_offset"] + s0["midi_chunk_length"]]
    skroty = {hashlib.sha256(v).hexdigest() for v in sp.wartosci_kolumny(frag)}
    check("czytnik: fragment kolumny midi z grupy 0 daje wszystkie 3 pliki tej grupy (wybór po SHA-256)",
          {s["sha256"] for s in m0["songs"][:3]} <= skroty and len(skroty) == 3)
    try:
        sp.wartosci_kolumny(frag[:len(frag) // 2])
        urwany = False
    except sp.NieobslugiwanyFormat:
        urwany = True
    check("czytnik: urwany fragment = czytelny błąd formatu, nie zły plik", urwany)
    try:
        sp.snappy(b"\x05\x0c\x00\x01")
        zly = False
    except sp.NieobslugiwanyFormat:
        zly = True
    check("snappy: uszkodzony blok = błąd formatu", zly)

    # ---- 4. pobieranie ----------------------------------------------------------------------------------------------
    srv = uruchom_serwer()
    port = srv.server_address[1]
    tmp = tempfile.mkdtemp(prefix="songpacks-test-")
    os.environ["RIBBITFLIP_SONGPACKS_DIR"] = os.path.join(tmp, "SongPacks")
    kat_m = os.path.join(tmp, "packs")
    os.makedirs(kat_m)
    sp.ustaw_katalog_manifestow(kat_m)
    sp.HF = "http://127.0.0.1:%d/datasets/%%s/resolve/%%s/%%s" % port

    def zapisz_manifest(m):
        with open(os.path.join(kat_m, "basic_classics.json"), "w", encoding="utf-8") as f:
            json.dump(m, f)

    try:
        zapisz_manifest(m0)
        Serwer.zapytania = []
        z = czekaj(sp.start_pobierania("basic_classics")["id"])
        k = sp.katalog_pakietu("basic_classics")
        pliki_ok = all(os.path.isfile(os.path.join(k, sp.nazwa_pliku(s["id"]))) and
                       hashlib.sha256(open(os.path.join(k, sp.nazwa_pliku(s["id"])), "rb").read()).hexdigest() == s["sha256"]
                       for s in m0["songs"])
        check("pobieranie: 6 utworów z 2 fragmentów (2 zapytania Range), skróty zgodne, stan „gotowe”",
              z["stan"] == "gotowe" and z["utwory"] == 6 and pliki_ok and len(Serwer.zapytania) == 2, (z, Serwer.zapytania))
        pj = json.load(open(os.path.join(k, "pack.json"), encoding="utf-8"))
        atr = open(os.path.join(k, "ATTRIBUTION.txt"), encoding="utf-8").read()
        check("pobieranie: pack.json z utworami i ATTRIBUTION.txt z autorem, licencją, źródłem i informacją o zmianach",
              len(pj["songs"]) == 6 and pj["revision"] == "abc123" and "Autor Testowy" in atr and "CC BY 4.0" in atr
              and "https://example.org/test-0.mid" in atr and "Mapa rytmu wygenerowana automatycznie" in atr)
        check("pobieranie: żadnych plików tymczasowych w katalogu pakietu",
              not [f for f in os.listdir(k) if ".tmp-" in f])
        stan = {p["pack_id"]: p for p in sp.stan_pakietow()}["basic_classics"]
        check("stan pakietów: 6 z 6 zainstalowanych, lista utworów z pack.json",
              stan["songs_installed"] == 6 and len(sp.lista_utworow("basic_classics")) == 6)
        # 10-18 (B-10): wersja angielska karty paczki i marka bez spacji w atrybucji
        check("stan pakietów: description_en i license_summary_en (wersja EN karty paczki)",
              bool(stan.get("description_en")) and bool(stan.get("license_summary_en"))
              and not re.search(r"[ąćęłńóśźż]", stan["description_en"] + stan["license_summary_en"], re.I), stan)
        check("atrybucja: marka „RibbitBeat” bez spacji", "Ribbit Beat" not in atr and "RibbitBeat" in atr)
        check("OPISY_EN: wpis dla każdego z trzech manifestów packs/",
              all(p in sp.OPISY_EN for p in ("basic_classics", "cc0_classics", "cc_by_classics")))
        # wznowienie
        os.remove(os.path.join(k, sp.nazwa_pliku(m0["songs"][4]["id"])))
        Serwer.zapytania = []
        z = czekaj(sp.start_pobierania("basic_classics")["id"])
        check("wznowienie: brakuje 1 pliku z grupy 1 → jedno zapytanie, reszta pominięta po skrócie",
              z["stan"] == "gotowe" and len(Serwer.zapytania) == 1 and z["utwory"] == 6, (z, Serwer.zapytania))
        Serwer.zapytania = []
        z = czekaj(sp.start_pobierania("basic_classics")["id"])
        check("wznowienie: komplet na dysku → zero zapytań", z["stan"] == "gotowe" and not Serwer.zapytania)
        # zły skrót
        sp.usun_pakiet("basic_classics")
        m1 = json.loads(json.dumps(m0))
        m1["songs"][1]["sha256"] = "0" * 64
        zapisz_manifest(m1)
        z = czekaj(sp.start_pobierania("basic_classics")["id"])
        check("zły skrót: plik z niezgodnym SHA-256 nie trafia na dysk, reszta tak, czytelny błąd",
              z["stan"] == "blad" and z["kod"] == "skrot" and z["utwory"] == 5 and
              not os.path.exists(os.path.join(k, sp.nazwa_pliku(m1["songs"][1]["id"]))), z)
        # zbiór zdjęty
        sp.usun_pakiet("basic_classics")
        m2 = json.loads(json.dumps(m0))
        m2["revision"] = "zdjety"
        zapisz_manifest(m2)
        z = czekaj(sp.start_pobierania("basic_classics")["id"])
        check("zbiór zdjęty (404): czytelny komunikat, kod zbior_zdjety", z["stan"] == "blad" and z["kod"] == "zbior_zdjety"
              and "Hugging Face" in (z["blad"] or ""), z)
        # brak sieci
        zapisz_manifest(m0)
        sp.HF = "http://127.0.0.1:9/datasets/%s/resolve/%s/%s"
        z = czekaj(sp.start_pobierania("basic_classics")["id"])
        check("brak sieci: czytelny komunikat, kod brak_sieci", z["stan"] == "blad" and z["kod"] == "brak_sieci", z)
        sp.HF = "http://127.0.0.1:%d/datasets/%%s/resolve/%%s/%%s" % port
        # anulowanie
        Serwer.opoznienie = 0.6
        zid = sp.start_pobierania("basic_classics")["id"]
        time.sleep(0.1)
        sp.anuluj(zid)
        z = czekaj(zid)
        Serwer.opoznienie = 0.0
        check("anulowanie: stan „anulowane”, pack.json zapisany z tym, co już jest", z["stan"] == "anulowane" and
              os.path.isfile(os.path.join(k, "pack.json")), z)
        # usuwanie i kontrola utworów
        sp.usun_pakiet("basic_classics")
        check("usunięcie pakietu kasuje jego katalog", not os.path.exists(k))
        bez_autora = dict(m0["songs"][0], midi_author="")
        check("kontrola aplikacji: CC BY bez autora i licencja spoza pakietu są odrzucane",
              sp.utwor_poprawny("basic_classics", bez_autora) and
              sp.utwor_poprawny("cc0_classics", dict(m0["songs"][0], license="cc-by-4.0")))

        # ---- 5. trasy i import z adresu ------------------------------------------------------------------------
        r = sp.obsluz_trase("GET", "/gry/api/pakiety", {}, None)
        j = json.loads(r[2])
        check("trasa GET /gry/api/pakiety: lista pakietów z liczbą utworów i rozmiarem",
              r[0] == 200 and j["pakiety"][0]["songs_total"] == 6, j)
        r = sp.obsluz_trase("POST", "/gry/api/pakiety/pobierz", {}, {"pack": "basic_classics"})
        zid = json.loads(r[2])["zadanie"]["id"]
        czekaj(zid)
        r = sp.obsluz_trase("GET", "/gry/api/zadanie", {"id": [zid]}, None)
        check("trasy: POST pobierz + GET zadanie", json.loads(r[2])["zadanie"]["stan"] == "gotowe")
        r = sp.obsluz_trase("GET", "/gry/api/pakiety/plik", {"pack": ["basic_classics"], "song": [m0["songs"][2]["id"]]}, None)
        check("trasa GET plik: bajty utworu z dysku (audio/midi)", r[0] == 200 and r[1] == "audio/midi" and
              hashlib.sha256(r[2]).hexdigest() == m0["songs"][2]["sha256"])
        r1 = sp.obsluz_trase("GET", "/gry/api/pakiety/plik", {"pack": ["basic_classics"], "song": ["..\\..\\x.mid"]}, None)
        r2 = sp.obsluz_trase("GET", "/gry/api/pakiety/plik", {"pack": ["../x"], "song": ["a.mid"]}, None)
        check("trasa GET plik: ścieżki spoza katalogu pakietu odpadają (404/400)", r1[0] == 404 and r2[0] in (400, 404),
              (r1[0], r2[0]))
        check("trasa obca: None (serwer obsłuży sam), nieznana /gry/api/: 404",
              sp.obsluz_trase("GET", "/inne", {}, None) is None and sp.obsluz_trase("GET", "/gry/api/xyz", {}, None)[0] == 404)
        midi = open(os.path.join(k, sp.nazwa_pliku(m0["songs"][0]["id"])), "rb").read()
        Serwer.pliki = {"/utwor.mid": ("audio/midi", midi), "/strona.html": ("text/html", b"<html>nie midi</html>"),
                        "/rmid.mid": ("audio/midi", b"RIFF\x00\x00\x00\x00RMIDdata" + midi),
                        "/duzy.mid": ("audio/midi", b"MThd" + b"\x00" * 64)}

        def importuj(url):
            r = sp.obsluz_trase("POST", "/gry/api/import-url", {}, {"url": url})
            j = json.loads(r[2])
            if not j.get("ok"):
                return None, j.get("error")
            return czekaj(j["zadanie"]["id"]), None
        baza = "http://127.0.0.1:%d" % port
        # 10-16 import przyjmuje tylko adresy z internetu; lokalny serwer testu przepuszczamy podmianą sprawdzenia
        _, blad = importuj(baza + "/utwor.mid")
        check("import z adresu: adres lokalny (127.0.0.1) odrzucony od razu", blad and "lokaln" in blad, blad)
        sp._adres_lokalny, prawdziwy_lokalny = (lambda h: False), sp._adres_lokalny
        z, _ = importuj(baza + "/utwor.mid")
        wyn = sp.obsluz_trase("GET", "/gry/api/import-url/wynik", {"id": [z["id"]]}, None)
        check("import z adresu: plik MIDI pobrany przez serwer, nazwa z adresu w nagłówku",
              z["stan"] == "gotowe" and wyn[2] == midi and wyn[3].get("X-Nazwa-Pliku") == "utwor.mid", z)
        z, _ = importuj(baza + "/rmid.mid")
        wyn = sp.obsluz_trase("GET", "/gry/api/import-url/wynik", {"id": [z["id"]]}, None)
        check("import z adresu: plik RMID (RIFF) dostaje bajty od nagłówka MThd", z["stan"] == "gotowe" and wyn[2] == midi)
        z, _ = importuj(baza + "/strona.html")
        check("import z adresu: strona zamiast pliku = błąd nie_midi z podpowiedzią", z["kod"] == "nie_midi", z)
        z, _ = importuj(baza + "/nie-ma.mid")
        check("import z adresu: 404 = błąd brak_pliku", z["kod"] == "brak_pliku", z)
        stary = sp.LIMIT_URL
        sp.LIMIT_URL = 20
        z, _ = importuj(baza + "/duzy.mid")
        sp.LIMIT_URL = stary
        check("import z adresu: plik ponad limit = błąd za_duzy", z["kod"] == "za_duzy", z)
        sp._adres_lokalny = prawdziwy_lokalny
        _, blad = importuj("file:///C:/Windows/win.ini")
        check("import z adresu: tylko http i https (file:// odrzucone od razu)", blad and "http" in blad, blad)
        check("nazwa z adresu: rozszerzenie .mid dopisane, nagłówek Content-Disposition ma pierwszeństwo",
              sp.nazwa_z_adresu("https://x.org/a/piosenka") == "piosenka.mid" and
              sp.nazwa_z_adresu("https://x.org/dl?id=7", 'attachment; filename="Moja Piosenka.mid"') == "Moja Piosenka.mid")
    finally:
        srv.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)

    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1 if _failed else 0)


if __name__ == "__main__":
    main()
