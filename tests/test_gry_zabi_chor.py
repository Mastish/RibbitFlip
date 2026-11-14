# RibbitBeat (dawniej „Żabi chór”, web/gry/): czyste funkcje gry w Node + higiena plików. Run: py tests/test_gry_zabi_chor.py
#
# Co pilnuje:
#  1. notacja przeniesiona z Keyboard Trenera (midiOf, parseBars) i 19 wbudowanych piosenek (5 spokojniejszych + pakiet „Skoczne”): każdy takt
#     trzyma metrum (takt za krótki przesuwa resztę piosenki względem akompaniamentu),
#  2. parser SMF (parseMidiFile → piosenkaZMidi) na plikach WYGENEROWANYCH tutaj: format 1 z 4 głosami
#     i ścieżką dyrygenta, format 0 z dwoma kanałami, running status, note-on z velocity 0 jako note-off,
#     tempo i metrum, wspólny początek partii, oryginalne oktawy, fortepian na dwie ręce, plik nie-MIDI,
#  3. mapowanie przechyłu na wysokość (krańce, liniowość, odwrotność, EMA, przyciąganie),
#  4. punktację: celność klatki, oceny, kombo, mnożnik, punkty, maksimum, premia, gwiazdki, całkowanie klatek,
#  5. podział na tory (najwyżej 4, wspólny tor dla tej samej partii, nadmiarowi śpiewają z melodią),
#  6. wejście: kontrakt gracza ze strumienia aplikacji (devmeta/s/b/devgone, bit przycisku, zbocza) i boty,
#  7. higienę: node --check plików gry, słownik T bez pauz „—” i bez „puka”, ścieżki zasobów względne,
#  8. dźwięk liczbami (recenzja 1, M4): tests/gry_zabi_chor_dzwiek.mjs renderuje Odę na OfflineAudioContext
#     w prawdziwym Chromium i pilnuje szczytu wyjścia, proporcji żab do podkładu i słyszalności rechotu.
#     Potrzebuje globalnego @playwright/test; bez niego SKIP. Pliki WAV do odsłuchu zapisuje tylko ręcznie:
#       node tests/gry_zabi_chor_dzwiek.mjs --wav <katalog>
#  8b. paczki MIDI w bibliotece (10-19): tests/gry_paczki_biblioteka.mjs otwiera grę w Chromium przy UDAWANYCH
#     trasach /gry/api/ i pilnuje, że utwory pobranej paczki są kartami w „Moich” (zakładki Paczki już nie ma),
#     że „Pobierz paczkę” dokłada karty bez przeładowania, a „Usuń paczkę” je zabiera. Bez playwrighta SKIP.
#  9. recenzja 2 (w harnessie Node): tempo „kum” w pauzie (od razu, co 0,5 s, po 2 s co 0,7 s), aplauz kapslem
#     na wynikach (sumy, limit na gracza, „Największy aplauz”), rekord solisty zamiast nagród, żaba-duch.
# 10. runda 3: analizator partii trenera na gęstym pliku wielościeżkowym, parametry piosenki (melodia,
#     podkład, punkt podziału, fragment, powtórzenia, tempo, zapis per piosenka, scalanie z folderem),
#     funkcje folderu na atrapach uchwytów, normalizacja podwójnego ukośnika
#     (strona i tools/gry_serwer.py) oraz trasa /web/gry/ w aplikacji: kopia aplikacji w katalogu
#     tymczasowym na wolnym porcie (jak tests/test_mcp.py), bez dotykania prawdziwego Settings/.
# 11. RibbitBeat: klasyfikator trudności partii (cechy, progi, poziomy, wbudowane piosenki), premia za klik w rytm
#     (ocena krawędzi przycisku, dopasowanie do nuty, wysokość premii), precyzja i ranking
#     w dwóch kategoriach, ogień kombo, tablica wyników (klucz nazwa + rozmiar, konfiguracja, miejsce, rekord,
#     scalanie, przycięcie), poziomy botów, pad na atrapie Gamepad API oraz kalibracja: boty czterech poziomów
#     przez prawdziwą punktację na korpusie partii (tools/ribbitbeat_kalibracja.mjs --szybko --json).
# Funkcje JS są wycinane z plików po nazwie i liczone w Node (tests/gry_zabi_chor_harness.mjs). Brak Node =
# te sprawdzenia są pomijane (SKIP), nie udawane.
#
# Generator MIDI służy też do ręcznego smoke 4 torów:
#   py tests/test_gry_zabi_chor.py --zapisz-midi <katalog>/cztery-glosy.mid
# i upuszczenie pliku na okno gry. Melodie w plikach testowych są ułożone tutaj (zwykłe trójdźwięki
# C–F–G–C), nie pochodzą z żadnego utworu.
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRY = os.path.join(REPO, "web", "gry")
PLIKI_JS = ["piosenki.js", "glos.js", "wejscie.js", "zabi-chor.js", "biblioteka.js", "pakiety.js", "tablica.js"]

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # konsola cp1250 vs „…” w nazwach
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


# ---- generator plików MIDI ----------------------------------------------------------------------
def _vlq(n):
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.insert(0, (n & 0x7F) | 0x80)
        n >>= 7
    return bytes(out)


def _sciezka(zdarzenia, running_status):
    """zdarzenia: (tick, priorytet, bajty). Meta-zdarzenia kasują running status (tak każe SMF)."""
    out = bytearray()
    ost = 0
    status = None
    for tick, _, dane in sorted(zdarzenia, key=lambda e: (e[0], e[1])):
        out += _vlq(tick - ost)
        ost = tick
        if dane[0] < 0xF0:
            if running_status and dane[0] == status:
                out += dane[1:]
            else:
                out += dane
            status = dane[0]
        else:
            out += dane
            status = None
    out += b"\x00\xff\x2f\x00"
    return b"MTrk" + len(out).to_bytes(4, "big") + bytes(out)


def zbuduj_midi(glosy, bpm=100, metrum=(4, 4), tpq=480, format=1, running_status=True, off_velocity0=True):
    """glosy: [(nazwa albo None, kanał, [(midi, start w ćwierćnutach, długość w ćwierćnutach), …]), …]"""
    meta = [(0, -2, b"\xff\x51\x03" + round(60000000 / bpm).to_bytes(3, "big")),
            (0, -2, bytes([0xFF, 0x58, 0x04, metrum[0], {1: 0, 2: 1, 4: 2, 8: 3, 16: 4}[metrum[1]], 24, 8]))]

    def nuty(kanal, lista):
        zd = []
        for m, start, dl in lista:
            t0, t1 = round(start * tpq), round((start + dl) * tpq)
            zd.append((t0, 1, bytes([0x90 | kanal, m, 92])))
            zd.append((t1, 0, bytes([0x90 | kanal, m, 0]) if off_velocity0 else bytes([0x80 | kanal, m, 64])))
        return zd

    def nazwa(n):
        b = n.encode("latin-1")
        return [(0, -1, b"\xff\x03" + _vlq(len(b)) + b)]

    if format == 0:
        zd = list(meta)
        for n, kanal, lista in glosy:
            zd += nuty(kanal, lista)
        sciezki = [_sciezka(zd, running_status)]
    else:
        sciezki = [_sciezka(meta, running_status)]   # ścieżka dyrygenta: tempo i metrum, bez nut
        for n, kanal, lista in glosy:
            sciezki.append(_sciezka((nazwa(n) if n else []) + nuty(kanal, lista), running_status))
    naglowek = b"MThd" + (6).to_bytes(4, "big") + format.to_bytes(2, "big") + len(sciezki).to_bytes(2, "big") + tpq.to_bytes(2, "big")
    return naglowek + b"".join(sciezki)


def _ciag(nuty, start=0.0):
    """[(nazwa, długość), …] → [(midi, start, długość)] jedna po drugiej."""
    pc = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    out = []
    t = start
    for tok, dl in nuty:
        out.append((12 * (int(tok[-1]) + 1) + pc[tok[0]] + (1 if "#" in tok else 0), t, dl))
        t += dl
    return out


def cztery_glosy():
    """8 taktów 4/4, akordy C F G C a F G C. Alt wchodzi dopiero w 2. takcie."""
    sopran = _ciag([("E5", 1), ("D5", 1), ("C5", 1), ("E5", 1), ("F5", 1), ("A5", 1), ("G5", 1), ("F5", 1),
                    ("D5", 1), ("G5", 1), ("F5", 1), ("D5", 1), ("E5", 2), ("C5", 2),
                    ("C5", 1), ("E5", 1), ("A5", 1), ("G5", 1), ("F5", 1), ("E5", 1), ("D5", 1), ("C5", 1),
                    ("D5", 1), ("B4", 1), ("D5", 1), ("G5", 1), ("C5", 4)])
    alt = _ciag([("C5", 2), ("C5", 2), ("B4", 2), ("B4", 2), ("G4", 2), ("G4", 2), ("A4", 2), ("E4", 2),
                 ("A4", 2), ("A4", 2), ("G4", 2), ("F4", 2), ("E4", 4)], start=4)
    tenor = _ciag([("G3", 2), ("C4", 2), ("A3", 2), ("C4", 2), ("B3", 2), ("D4", 2), ("C4", 2), ("G3", 2),
                   ("A3", 2), ("C4", 2), ("A3", 2), ("F3", 2), ("G3", 2), ("B3", 2), ("C4", 4)])
    bas = _ciag([("C3", 4), ("F2", 4), ("G2", 4), ("C3", 4), ("A2", 4), ("F2", 4), ("G2", 4), ("C2", 4)])
    return zbuduj_midi([("Sopran", 0, sopran), ("Alt", 1, alt), ("Tenor", 2, tenor), ("Bas", 3, bas)], bpm=100)


def format_zero():
    """Jedna ścieżka, dwa kanały, 3/4 w tempie 90, running status i note-off jako velocity 0."""
    melodia = _ciag([("G4", 1), ("A4", 1), ("B4", 1), ("C5", 1), ("B4", 1), ("A4", 1),
                     ("G4", 1), ("E4", 1), ("D4", 1), ("C4", 1), ("D4", 1), ("E4", 1)])
    bas = _ciag([("C3", 3), ("G2", 3), ("C3", 3), ("G2", 3)])
    return zbuduj_midi([(None, 0, melodia), (None, 1, bas)], bpm=90, metrum=(3, 4), format=0)


def fortepian():
    """Jedna ścieżka, jeden kanał, obie ręce naraz: melodia wysoko i bas nisko."""
    prawa = _ciag([(n, 1) for n in ["C5", "D5", "E5", "F5", "G5", "F5", "E5", "D5",
                                     "C5", "E5", "G5", "E5", "D5", "C5", "D5", "C5"]])
    lewa = _ciag([(n, 2) for n in ["C3", "G2", "C3", "G2", "C3", "G2", "C3", "G2"]])
    return zbuduj_midi([("Piano", 0, prawa + lewa)], bpm=96)


def gesty():
    """Gęsta aranżacja na 4 ścieżki bez nazw rąk (8 taktów 4/4, 132 BPM): smyczki prowadzą melodię
    ósemkami wysoko, arpeggio idzie szesnastkami przez dwie oktawy, pad trzyma trójdźwięki, bas gra
    ćwierćnuty. Takiego pliku nie da się zaśpiewać ścieżka po ścieżce, więc analizator trenera upraszcza
    go na melodię i bas (≥ 3 partie) i to uproszczenie jest domyślną melodią gry. Własne nuty testu."""
    akordy = [(60, 64, 67), (65, 69, 72), (67, 71, 74), (60, 64, 67), (57, 60, 64), (65, 69, 72), (67, 71, 74), (60, 64, 67)]
    smyczki, arp, pad, bas = [], [], [], []
    for k, (a, b, c) in enumerate(akordy):
        t0 = k * 4
        for i, d in enumerate([0, 2, 4, 2, 0, -3, 0, 2]):
            smyczki.append((c + 12 + d, t0 + i * 0.5, 0.5))
        tony = [a, b, c, a + 12, b + 12, c + 12, a + 12, c]
        for i in range(16):
            arp.append((tony[i % len(tony)] - 12, t0 + i * 0.25, 0.25))
        for m in (a, b, c):
            pad.append((m, t0, 4))
        for i in range(4):
            bas.append((a - 24, t0 + i, 1))
    return zbuduj_midi([("Strings", 0, smyczki), ("Arp", 1, arp), ("Pad", 2, pad), ("Bass", 3, bas)], bpm=132)


# ---- higiena ------------------------------------------------------------------------------------
def blok_slownika(src):
    i = src.find("const T={")
    j = src.find("\n  graczMysz:", i)
    k = src.find("};", j)
    return src[i:k + 2] if i >= 0 and k > i else ""


def main():
    if "--zapisz-gesty" in sys.argv:
        cel = sys.argv[sys.argv.index("--zapisz-gesty") + 1]
        os.makedirs(os.path.dirname(os.path.abspath(cel)), exist_ok=True)
        with open(cel, "wb") as f:
            f.write(gesty())
        print("zapisano", cel)
        return
    if "--zapisz-midi" in sys.argv:
        cel = sys.argv[sys.argv.index("--zapisz-midi") + 1]
        os.makedirs(os.path.dirname(os.path.abspath(cel)), exist_ok=True)
        with open(cel, "wb") as f:
            f.write(cztery_glosy())
        print("zapisano", cel)
        return

    # --- 7. higiena (bez Node) ---
    for nazwa in ["index.html", "gry.css"] + ["js/" + p for p in PLIKI_JS]:
        check("plik gry istnieje: web/gry/" + nazwa, os.path.isfile(os.path.join(GRY, nazwa)))
    zc = open(os.path.join(GRY, "js", "zabi-chor.js"), encoding="utf-8").read()
    slownik = blok_slownika(zc)
    check("słownik T jest na początku zabi-chor.js i da się go wyciąć", len(slownik) > 2000 and zc.find("const T={") < 2500,
          zc.find("const T={"))
    check("słownik T: bez pauz „—” w tekstach dla ludzi", "—" not in slownik,
          [l.strip() for l in slownik.splitlines() if "—" in l][:3])
    check("słownik T: „kapsel”, nigdy „puk”", not re.search(r"\bpuk", slownik, re.I))
    html = open(os.path.join(GRY, "index.html"), encoding="utf-8").read()
    css = open(os.path.join(GRY, "gry.css"), encoding="utf-8").read()
    wszystkie_js = "".join(open(os.path.join(GRY, "js", p), encoding="utf-8").read() for p in PLIKI_JS)
    check("zasoby względne: żadnego /web/assets ani /assets od korzenia (gra działa pod /gry/ i /web/gry/)",
          not re.search(r"""["'(]/(web/)?assets/""", html + css + wszystkie_js))
    check("index.html nie ładuje CSS aplikacji (fonty z własnego @font-face)",
          "/web/css/" not in html and "01-assets-tokens" not in html and "@font-face" in css)
    check("index.html ładuje 4 skrypty gry jako zwykłe <script src>, bez modułów ES",
          all('<script src="js/%s"></script>' % p in html for p in PLIKI_JS) and 'type="module"' not in html)
    # 10-03 „UI jak w grze”, 10-20 bez osobnych Utworów: trzy ekrany przed grą, gniazda na przenoszone elementy
    check("index.html: ekrany lobby menu, krok 1 i krok 2 (jedno #lobby, S.ekran \"lobby\"); osobnych Utworów nie ma",
          all('id="%s" class="lobby-ekran' % e in html for e in ["menu", "wybor", "konfiguracja"]) and html.count('id="lobby"') == 1 and
          'id="utwory"' not in html and 'id="btnUtwory"' not in html)
    check("index.html: biblioteka, podgląd partii i pasek stanu są raz, z gniazdami w ekranach",
          all(html.count('id="%s"' % e) == 1 for e in ["biblioteka", "podgladPartii", "lobbyStan", "btnStart", "siatkaGraczy", "ustawienia"]) and
          html.count('data-gniazdo="biblioteka"') == 1 and html.count('data-gniazdo="podglad"') == 2 and html.count('data-gniazdo="stan"') == 2)
    # 11-19 (wcześniej czarny pasek „Dodaj utwory” z 10-20): dwie zakładki kroku 1, „Wybierz utwór” ALBO „Wgraj własny”
    check("index.html: krok 1 ma dwie zakładki, #btnWybierzUtwor (wybrana) i #btnDodajUtwory z panelem #dodajPanel",
          html.count('role="tab"') == 2 and 'role="tablist"' in html and 'aria-controls="dodajPanel"' in html and
          html.find('id="wybor"') < html.find('id="btnWybierzUtwor"') < html.find('class="zrodlo-albo"') <
          html.find('id="btnDodajUtwory"') < html.find('id="dodajPanel"') < html.find('id="konfiguracja"'))
    # 11-19: gra jest dla każdego, więc napisy dla gracza nie odsyłają do prywatnych narzędzi autora
    check("napisy gry (PL i EN) nie wspominają Keyboard Trenera",
          not any(("Keyboard Tren" in w or "Keyboard Train" in w) and not w.lstrip().startswith("//")
                  for n in ("zabi-chor.js", "jezyk-en.js")
                  for w in open(os.path.join(GRY, "js", n), encoding="utf-8").read().splitlines()))
    # ekran wczytywania ma naklejkę z żabą „RIBBIT BEAT” (mascot-beat.webp, od 10-17), menu od 10-18 samą naklejkę z nazwą
    # (naklejka-nazwa.webp, napis wycięty z tej samej grafiki); mascot.png zostaje dla Pages i README
    check("index.html: ekran wczytywania z żabą ../assets/frog/mascot-beat.webp (plik istnieje)",
          'class="wcz-zaba" src="../assets/frog/mascot-beat.webp"' in html and os.path.isfile(os.path.join(REPO, "web", "assets", "frog", "mascot-beat.webp")))
    check("index.html: menu z samą naklejką z nazwą ../assets/frog/naklejka-nazwa.webp, bez żaby (plik istnieje)",
          re.search(r'id="naklejka"[^>]*>\s*<img class="naklejka-obraz" src="\.\./assets/frog/naklejka-nazwa\.webp"', html) is not None
          and 'class="naklejka-obraz" src="../assets/frog/mascot-beat.webp"' not in html
          and os.path.isfile(os.path.join(REPO, "web", "assets", "frog", "naklejka-nazwa.webp")))
    check("index.html: harness 2/2 nadal przekazuje auto, boty, mysz, partie i czekaj do ZC.init",
          all(k in html for k in ['auto:tak("auto")', 'boty:liczba("boty",0)', 'mysz:tak("mysz")', "partie:partie==null", 'czekaj:liczba("czekaj",3)']))
    check("gry.css: naklejka maskotki bez animacji przy prefers-reduced-motion",
          re.search(r"prefers-reduced-motion:no-preference\)\{\s*\.menu-naklejka\.naklej", css) is not None)
    check("każdy plik JS gry zaczyna się od \"use strict\"",
          all(open(os.path.join(GRY, "js", p), encoding="utf-8").read().startswith('"use strict";') for p in PLIKI_JS))
    check("kopie z Keyboard Trenera są podpisane", "Przeniesione z Keyboard Trenera (ten sam autor)" in wszystkie_js)

    node = shutil.which("node")
    if not node:
        print("SKIP  brak node — sprawdzenia JS (node --check, funkcje gry) pominięte")
    else:
        for p in PLIKI_JS:
            r = subprocess.run([node, "--check", os.path.join(GRY, "js", p)], capture_output=True, text=True, encoding="utf-8")
            check("node --check web/gry/js/" + p, r.returncode == 0, (r.stderr or "")[:400])
        harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gry_zabi_chor_harness.mjs")
        katalog = tempfile.mkdtemp(prefix="zabi-chor-")
        try:
            pliki = []
            for nazwa, dane in [("cztery.mid", cztery_glosy()), ("zero.mid", format_zero()),
                                ("fortepian.mid", fortepian()), ("smiec.bin", b"RIFF\x00\x00\x00\x00nie-midi"),
                                ("gesty.mid", gesty())]:
                sciezka = os.path.join(katalog, nazwa)
                with open(sciezka, "wb") as f:
                    f.write(dane)
                pliki.append(sciezka)
            out = subprocess.run([node, harness] + pliki, capture_output=True, text=True, timeout=90, encoding="utf-8")
            data = json.loads(out.stdout.strip().splitlines()[-1])
            for name, ok, detail in data.get("checks", []):
                check("gra: " + name, ok, detail)
        except Exception as e:
            check("gra: harness Node uruchamia się", False, str(e))
        finally:
            shutil.rmtree(katalog, ignore_errors=True)
        sprawdz_kalibracje(node)
        dzwiek = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gry_zabi_chor_dzwiek.mjs")
        try:
            out = subprocess.run([node, dzwiek], capture_output=True, text=True, timeout=180, encoding="utf-8")
            data = json.loads(out.stdout.strip().splitlines()[-1])
            if "pominiete" in data:
                print("SKIP  dźwięk offline: " + data["pominiete"])
            for name, ok, detail in data.get("checks", []):
                check("dźwięk: " + name, ok, detail)
        except Exception as e:
            check("dźwięk: harness offline uruchamia się", False, str(e))
        paczki = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gry_paczki_biblioteka.mjs")
        try:
            out = subprocess.run([node, paczki], capture_output=True, text=True, timeout=240, encoding="utf-8")
            data = json.loads(out.stdout.strip().splitlines()[-1])
            if "pominiete" in data:
                print("SKIP  paczki w bibliotece: " + data["pominiete"])
            for name, ok, detail in data.get("checks", []):
                check("paczki: " + name, ok, detail)
        except Exception as e:
            check("paczki: harness biblioteki uruchamia się", False, str(e))

    sprawdz_adres_i_serwer(node)
    sprawdz_trase_aplikacji()

    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1 if _failed else 0)


# ---- 11. kalibracja klasyfikatora trudności na botach ------------------------------------------------
def sprawdz_kalibracje(node):
    skrypt = os.path.join(REPO, "tools", "ribbitbeat_kalibracja.mjs")
    try:
        out = subprocess.run([node, skrypt, "--szybko", "--json"], capture_output=True, text=True, timeout=240, encoding="utf-8")
        d = json.loads(out.stdout.strip().splitlines()[-1])["podsumowanie"]
    except Exception as e:
        check("kalibracja: skrypt działa", False, str(e))
        return
    check("kalibracja: ocena trudności koreluje z nutami zgubionymi przez bota Średniego (Pearson ≥ 0,85)",
          d["pearsonSredni"] >= .85, d["pearsonSredni"])
    check("kalibracja: zgodność rang z sumą trzech botów (Spearman ≥ 0,85)", d["spearmanTrzyBoty"] >= .85, d["spearmanTrzyBoty"])
    poz = d["botyNaPoziomach"]
    kolejne = ["latwa", "srednia", "trudna", "bardzoTrudna", "ekstremalna"]
    sr = [poz[k]["sredni"] for k in kolejne if poz[k]["partii"]]
    check("kalibracja: precyzja bota Średniego spada z każdym poziomem trudności", all(a > b for a, b in zip(sr, sr[1:])), sr)
    check("kalibracja: drabina poziomów: łatwą gra bot Łatwy (≥ 70%), średnią Średni, trudną Trudny, bardzo trudną Mistrz (≥ 80%)",
          poz["latwa"]["latwy"] >= 70 and poz["srednia"]["sredni"] >= 80 and poz["trudna"]["trudny"] >= 80 and
          poz["bardzoTrudna"]["mistrz"] >= 80, json.dumps(poz))
    boty = ["latwy", "sredni", "trudny", "mistrz"]
    check("kalibracja: na każdym poziomie trudności lepszy bot trafia nie mniej niż słabszy (±3 pp)",
          all(poz[k][b2] + 3 >= poz[k][b1] for k in kolejne if poz[k]["partii"] for b1, b2 in zip(boty, boty[1:])), json.dumps(poz))
    # 10-20 (zgłoszenie: „bot mistrz nie ma żadnego snapowania do nut a i tak miażdży”): ślad = odsetek czasu nuty,
    # przez który żaba NA niej stoi, czyli dokładnie to, co widać na taśmie toru. Ma zgadzać się z wynikiem, bo inaczej
    # tor pokazuje co innego, niż mówią punkty — tak było przed zatrzaskiem (różnice do 21 pp).
    slad = d["sladNaPoziomach"]
    check("kalibracja: ślad bota rośnie z jego poziomem na każdej trudności partii",
          all(slad[k][b2] + 3 >= slad[k][b1] for k in kolejne if poz[k]["partii"] for b1, b2 in zip(boty, boty[1:])), json.dumps(slad))
    roznice = {k + "/" + b: poz[k][b] - slad[k][b] for k in kolejne if poz[k]["partii"] for b in boty}
    check("kalibracja: ślad nie kłamie — wynik bota nie wyprzedza jego śladu o więcej niż 15 pp",
          max(roznice.values()) <= 15, json.dumps({k: v for k, v in roznice.items() if v > 8}))


# ---- 10. runda 3: podwójny ukośnik, serwer gier, trasa w aplikacji --------------------------------
def _wolny_port():
    import socket
    for _ in range(20):
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        if not 8760 <= port <= 8799:          # z dala od portów aplikacji i sesji (8770 to domyślny port aplikacji)
            return port
    raise RuntimeError("brak wolnego portu")


def _http(port, sciezka, przekierowania=False):
    import http.client
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=15)
    c.request("GET", sciezka)
    r = c.getresponse()
    body = r.read()
    naglowki = {k.lower(): v for k, v in r.getheaders()}
    c.close()
    return r.status, naglowki, body


def sprawdz_adres_i_serwer(node):
    html = open(os.path.join(GRY, "index.html"), encoding="utf-8").read()
    glowa = html[:html.find("</head>")]
    skrypt = re.search(r"<script>\s*(.*?)</script>", glowa, re.S)
    poz = lambda t: glowa.find(t) if glowa.find(t) >= 0 else len(glowa)
    pierwszy = bool(skrypt) and "location.replace" in skrypt.group(1) and skrypt.start() < poz("<link") and skrypt.start() < poz("<script src")
    check("adres: skrypt normalizujący ukośniki stoi w <head> przed pierwszym <link> i przed skryptami gry", bool(pierwszy))
    if node and skrypt:
        kod = skrypt.group(1)
        prog = ("const wyniki=[];for(const [p,s] of [['/gry//','?zywe=0'],['/web//gry///','']," +
                "['/web/gry/','?x=1'],['/gry/index.html','']]){let doc=null;const location={pathname:p,search:s,hash:'',replace:u=>{doc=u;}};" +
                "(function(location){" + kod.replace('"use strict";', "") + "})(location);wyniki.push(doc);}console.log(JSON.stringify(wyniki));")
        r = subprocess.run([node, "-e", prog], capture_output=True, text=True, encoding="utf-8")
        try:
            wyn = json.loads(r.stdout.strip().splitlines()[-1])
        except Exception:
            wyn = r.stderr[:300]
        check("adres: /gry// → /gry/?zywe=0, /web//gry/// → /web/gry/, poprawny adres bez przeładowania",
              wyn == ["/gry/?zywe=0", "/web/gry/", None, None], wyn)
    # tools/gry_serwer.py: 301 na znormalizowany adres z zachowaniem zapytania
    import importlib.util, threading, functools, http.server
    spec = importlib.util.spec_from_file_location("gry_serwer_test", os.path.join(REPO, "tools", "gry_serwer.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    port = _wolny_port()
    serwer = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(mod.Obsluga, directory=mod.KATALOG_WEB))
    watek = threading.Thread(target=serwer.serve_forever, daemon=True)
    watek.start()
    try:
        st, ng, _ = _http(port, "/gry//?zywe=0")
        check("tools/gry_serwer.py: /gry//?zywe=0 → 301 na /gry/?zywe=0", st == 301 and ng.get("location") == "/gry/?zywe=0", (st, ng.get("location")))
        st, ng, body = _http(port, "/gry/")
        check("tools/gry_serwer.py: /gry/ serwuje grę", st == 200 and b"<title>" in body, st)
        # 10-21: trasy pakietów piosenek z audio (ribbitflip_piosenki) jak w aplikacji i RibbitBeat.exe — bez nich
        # gra logowała 404 w konsoli przy każdym starcie. Katalog podstawiony, żeby nie czytać prawdziwego profilu użytkownika.
        import json as _json
        stare_piosenki = os.environ.get("RIBBITFLIP_PIOSENKI_DIR")
        os.environ["RIBBITFLIP_PIOSENKI_DIR"] = tempfile.mkdtemp(prefix="zabi-chor-piosenki-")
        try:
            st, ng, body = _http(port, "/gry/api/piosenki")
            odp = _json.loads(body.decode("utf-8")) if st == 200 else None
            check("tools/gry_serwer.py: /gry/api/piosenki → 200, JSON z pustą listą piosenek",
                  st == 200 and isinstance(odp, dict) and odp.get("ok") is True and odp.get("piosenki") == [], (st, body[:120]))
            st, ng, body = _http(port, "/gry/api/piosenki/manifest?slug=nie-ma-takiej")
            check("tools/gry_serwer.py: manifest nieznanej piosenki → błąd w JSON, nie wyjątek", st in (404, 422) and b'"ok": false' in body, (st, body[:120]))
            st, ng, body = _http(port, "/gry/api/nie-ma")
            check("tools/gry_serwer.py: nieznana trasa /gry/api/ nadal 404", st == 404, st)
        finally:
            if stare_piosenki is None:
                os.environ.pop("RIBBITFLIP_PIOSENKI_DIR", None)
            else:
                os.environ["RIBBITFLIP_PIOSENKI_DIR"] = stare_piosenki
    finally:
        serwer.shutdown()
        serwer.server_close()


def sprawdz_trase_aplikacji():
    """Kopia aplikacji w katalogu tymczasowym (Settings/ i Library/ powstają tam, nie w repo), wolny port."""
    if os.environ.get("ZC_BEZ_APLIKACJI"):
        print("SKIP  trasa /web/gry/ w aplikacji (ZC_BEZ_APLIKACJI)")
        return
    import time
    piaskownica = tempfile.mkdtemp(prefix="zabi-chor-app-")
    proc = None
    try:
        for f in ("ribbitflip_monitor.py", "ribbitflip_mcp.py", "ribbitflip_audio.py", "ribbitflip_gesture.py",
                  "ribbitflip_songpacks.py", "ribbitflip_piosenki.py",
                  os.path.join("web", "ribbitflip_dashboard.html"), os.path.join("web", "assets", "frog", "sing-2-96.png"),
                  os.path.join("web", "assets", "icons", "gry", "puchar.webp"), os.path.join("web", "assets", "motywy", "filc", "fan-0.webp")):
            cel = os.path.join(piaskownica, f)
            os.makedirs(os.path.dirname(cel), exist_ok=True)
            shutil.copy2(os.path.join(REPO, f), cel)
        shutil.copytree(GRY, os.path.join(piaskownica, "web", "gry"))
        shutil.copytree(os.path.join(REPO, "packs"), os.path.join(piaskownica, "packs"))
        port = _wolny_port()
        srod = dict(os.environ, RIBBITFLIP_SONGPACKS_DIR=os.path.join(piaskownica, "SongPacks"))
        proc = subprocess.Popen([sys.executable, os.path.join(piaskownica, "ribbitflip_monitor.py"), "--simulate", "--no-keys",
                                 "--no-open", "--no-midi", "--no-tray", "--allow-multi", "--port", str(port)],
                                cwd=piaskownica, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=srod)
        gotowa = False
        for _ in range(150):
            time.sleep(0.1)
            if proc.poll() is not None:
                break
            try:
                st, _, _ = _http(port, "/health")
                if st == 200:
                    gotowa = True
                    break
            except Exception:
                pass
        check("aplikacja (kopia, --simulate) wstaje na wolnym porcie", gotowa)
        if not gotowa:
            return
        st, ng, body = _http(port, "/web/gry/")
        csp = ng.get("content-security-policy", "")
        check("trasa /web/gry/: 200, text/html, strona gry z tokenem sesji wstrzykniętym jak w panelu",
              st == 200 and ng.get("content-type", "").startswith("text/html") and "<title>RibbitBeat".encode("utf-8") in body
              and b"RIBBITFLIP_TOKEN" in body, (st, ng.get("content-type")))
        check("trasa /web/gry/: CSP bez wyjątków (connect-src 'self'), wyszukiwarki bitmidi już nie ma",
              "connect-src 'self';" in csp and "bitmidi" not in csp and "base-uri 'none'" in csp and "default-src 'none'" in csp, csp)
        st7, ng7, body7 = _http(port, "/gry/api/pakiety")
        try:
            pak = json.loads(body7.decode("utf-8"))
        except Exception:
            pak = {}
        check("trasa /gry/api/pakiety w aplikacji: JSON z pakietami z packs/ (pakiety MIDI)",
              st7 == 200 and "basic_classics" in [p.get("pack_id") for p in pak.get("pakiety", [])], (st7, body7[:200]))
        st2, ng2, _ = _http(port, "/")
        csp2 = ng2.get("content-security-policy", "")
        check("panel bez zmian: jego CSP nadal ma connect-src 'self' (bez bitmidi)",
              st2 == 200 and "connect-src 'self';" in csp2 and "bitmidi" not in csp2, csp2)
        st3, ng3, _ = _http(port, "/web/gry?zywe=0")
        check("trasa /web/gry (bez ukośnika): 301 na /web/gry/ z zapytaniem", st3 == 301 and ng3.get("location") == "/web/gry/?zywe=0",
              (st3, ng3.get("location")))
        st4, _, body4 = _http(port, "/web/gry//")
        check("trasa /web/gry//: strona gry (sama poprawi adres, zanim wczyta zasoby)", st4 == 200 and b"location.replace" in body4, st4)
        st5, ng5, _ = _http(port, "/web/gry/js/biblioteka.js")
        st6, ng6, _ = _http(port, "/web/assets/frog/sing-2-96.png")
        check("pliki gry i ../assets idą zwykłą statyką aplikacji", st5 == 200 and "javascript" in ng5.get("content-type", "")
              and st6 == 200 and ng6.get("content-type") == "image/png", (st5, st6))
        # 10-15: ikony filcowe gry i grafiki motywów to WebP; allowlista STATIC_TYPES musi je znać, inaczej 404 w aplikacji
        st8, ng8, _ = _http(port, "/web/assets/icons/gry/puchar.webp")
        st9, ng9, _ = _http(port, "/web/assets/motywy/filc/fan-0.webp")
        check("WebP (ikony filcowe gry, grafiki motywów) idą statyką aplikacji jako image/webp",
              st8 == 200 and st9 == 200 and ng8.get("content-type") == "image/webp" == ng9.get("content-type"), (st8, st9))
    except Exception as e:
        check("trasa /web/gry/ w aplikacji: test się wykonuje", False, repr(e))
    finally:
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except Exception:
                proc.kill()
        shutil.rmtree(piaskownica, ignore_errors=True)


if __name__ == "__main__":
    main()
