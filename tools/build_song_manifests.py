"""Buduje manifesty pakietów MIDI RibbitBeat (narzędzie DEWELOPERSKIE, uruchamiane przy wydaniu).

    py -m pip install -r requirements-dev.txt          # pyarrow, huggingface_hub (nie trafiają do .exe)
    py tools/build_song_manifests.py                   # oba pakiety z przypiętych rewizji
    py tools/build_song_manifests.py --pakiet basic_classics --bez-weryfikacji

Wynik (w repo, BEZ plików MIDI): packs/cc0_classics.json, packs/basic_classics.json, packs/cc_by_classics.json
i raporty odrzuceń packs/<pakiet>.rejections.json z powodem dla każdego utworu. Pakiet B bierze kandydatów z
packs/basic_classics.curation.txt (kolejność = priorytet, najwyżej 60). Pakiet „Klasyka z atrybucją” (cc_by_classics)
to pliki ZBIORU CC0, które według IMSLP mają licencję CC BY albo CC BY-SA (kolumna zbioru opisuje je błędnie jako
domenę publiczną albo CC0); grają z pełną atrybucją jak pakiet B. Ten sam plik nie trafia do dwóch pakietów.
Przy pakiecie A powstaje też packs/cc0_allowlist.candidates.txt: współczesne utwory oznaczone w zbiorze CC0, które
odpadły na regułach 1–2, sprawdzone na IMSLP; do pakietu wchodzą dopiero po przeniesieniu do packs/cc0_allowlist.txt
(reguła 3: ręczna allowlista). Cache zapytań: tools/.cache/ (poza repo).

Reguły licencyjne (handoff „Pakiety MIDI i licencje w Ribbit Beat”, 2026-10-03, plus reguła 4b z fazy 0):
  1. kompozycja w domenie publicznej w UE: kompozytor zmarł najpóźniej w roku bieżącym minus 71,
  2. brak roku śmierci: utwór przechodzi tylko, gdy `year` ≤ 1870,
  3. utwory współczesne na CC0 wyłącznie z ręcznej allowlisty (packs/cc0_allowlist.txt),
  4. licencja pliku z kolumny `license` musi być dozwolona dla pakietu,
  4b. licencją utworu jest licencja ze strony utworu na IMSLP (pole Copyright w bloku pliku), bo kolumna zbioru bywa
      błędna (faza 0: ok. 12% próbki BY/BY-SA, w tym NC). Każda wzmianka o NonCommercial albo NoDerivs odrzuca;
      licencja z IMSLP spoza dozwolonych dla pakietu odrzuca; inna, ale dozwolona (np. zbiór BY-SA 4.0, IMSLP BY 3.0)
      przechodzi z licencją z IMSLP i trafia do manifestu razem z wartością ze zbioru (license_dataset). Brak wersji na
      IMSLP = wersja ze zbioru, o ile rodzina się zgadza; inaczej odrzucenie,
  5. CC BY / BY-SA: autor pliku MIDI wymagany (pakiet B: zawsze); bez niego utwór wypada.
Rok śmierci: strona kompozytora na IMSLP (`Category:<composer>`, pole Died Year, a gdy go nie ma, rok z pola Death Date,
np. „probably by 12 October 1591”; dopasowanie dokładne po nazwie z kolumny `composer`). Autor pliku: „MIDI file by X” w Performers, potem oczyszczone Publisher Information,
potem Performers, jeśli wygląda na nazwisko; konto, które wgrało plik (Uploader), nigdy.
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKS = os.path.join(ROOT, "packs")
CACHE = os.path.join(ROOT, "tools", ".cache")
UA = "RibbitFlip-manifest-builder/1.0 (+https://github.com/Mastish/RibbitFlip)"

ZBIORY = {
    "cc0": {"repo": "TiMauzi/imslp-midi-cc0-1.0", "revision": "703e983510885d9833dd1c534900e0eb258b69af"},
    "bysa": {"repo": "TiMauzi/imslp-midi-by-sa", "revision": "4c333afa85258eb4fd7873c42cffcb8ed3a77ab6"},
}
PAKIETY = {
    "cc0_classics": {"name": "Klasyka CC0", "name_en": "CC0 classics", "zbior": "cc0",
                     "description": "Wszystkie utwory ze zbioru CC0, które w UE są w domenie publicznej.",
                     "license_summary": "CC0 1.0 i domena publiczna",
                     "dozwolone_zbior": {None, "cc0-1.0"}, "dozwolone_imslp": {"cc0-1.0", "public-domain"},
                     "kuracja": None, "maks": None, "autor_zawsze": False},
    "basic_classics": {"name": "Podstawowe klasyki", "name_en": "Basic classics", "zbior": "bysa",
                       "description": "Wybrane rozpoznawalne utwory klasyczne na licencjach CC BY i CC BY-SA.",
                       "license_summary": "CC BY i CC BY-SA (3.0 i 4.0)",
                       "dozwolone_zbior": {None, "cc-by-3.0", "cc-by-4.0", "cc-by-sa-3.0", "cc-by-sa-4.0"},
                       "dozwolone_imslp": {"cc-by-3.0", "cc-by-4.0", "cc-by-sa-3.0", "cc-by-sa-4.0", "public-domain"},
                       "kuracja": "basic_classics.curation.txt", "maks": 60, "autor_zawsze": True},
    "cc_by_classics": {"name": "Klasyka z atrybucją", "name_en": "Attribution classics", "zbior": "cc0",
                       "description": "Utwory ze zbioru CC0, które według IMSLP mają licencję CC BY albo CC BY-SA. Grasz je "
                                      "z pełną informacją o autorach plików.",
                       "license_summary": "CC BY i CC BY-SA (3.0 i 4.0)",
                       "dozwolone_zbior": {None, "cc0-1.0"},
                       "dozwolone_imslp": {"cc-by-3.0", "cc-by-4.0", "cc-by-sa-3.0", "cc-by-sa-4.0"},
                       "kuracja": None, "maks": None, "autor_zawsze": True},
}
# Kolejność budowania: pakiet z kuracją pierwszy (jego utwory mają pierwszeństwo), potem reszta bez duplikatów.
KOLEJNOSC = ["basic_classics", "cc_by_classics", "cc0_classics"]
LICENCJE_URL = {
    "public-domain": "https://creativecommons.org/publicdomain/mark/1.0/",
    "cc0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "cc-by-3.0": "https://creativecommons.org/licenses/by/3.0/",
    "cc-by-4.0": "https://creativecommons.org/licenses/by/4.0/",
    "cc-by-sa-3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
    "cc-by-sa-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
}
KOLUMNY = ["file_name", "title", "composer", "year", "era", "key", "license", "midi_source", "metadata_source"]


# =============================================================================================
# REGUŁY (czyste funkcje, tests/test_song_manifests.py)
def rok_graniczny(rok_biezacy):
    """Ostatni rok śmierci kompozytora, przy którym kompozycja jest w UE w domenie publicznej (70 lat + rok)."""
    return int(rok_biezacy) - 71


def regula_domeny(rok_smierci, rok_utworu, granica, na_allowliscie=False):
    """Reguły 1–3: (True, None) albo (False, powód)."""
    if rok_smierci is not None:
        if rok_smierci <= granica:
            return True, None
        if na_allowliscie:
            return True, None
        return False, "reguła 1: kompozytor zmarł w %d, w UE chroniony (granica %d)" % (rok_smierci, granica)
    if rok_utworu is not None and rok_utworu <= 1870:
        return True, None
    if na_allowliscie:
        return True, None
    return False, "reguła 2: brak roku śmierci kompozytora, a utwór z %s (> 1870)" % (
        int(rok_utworu) if rok_utworu is not None else "nieznanego roku")


def licencja_z_tekstu(tekst):
    """Pole Copyright z IMSLP → {'id', 'rodzina', 'wersja', 'zakaz'} albo None (pusto/nieznane).
    rodzina: 'pd', 'cc0', 'by', 'by-sa'; wersja: '3.0', '4.0' albo None; zakaz: wzmianka o NC/ND."""
    t = (tekst or "").strip()
    if not t:
        return None
    n = t.lower().replace("_", " ")
    zakaz = bool(re.search(r"non[- ]?commercial|no[- ]?deriv|\bnc\b|\bnd\b|-nc|-nd", n))
    wm = re.search(r"\b([34])\.0\b", n)
    wersja = wm.group(0) if wm else None
    if "public domain" in n:
        return {"id": "public-domain", "rodzina": "pd", "wersja": None, "zakaz": zakaz}
    if "zero" in n or re.search(r"\bcc0\b", n):
        return {"id": "cc0-1.0", "rodzina": "cc0", "wersja": "1.0", "zakaz": zakaz}
    if "attribution" in n or re.search(r"\bcc[- ]by\b", n):
        sa = bool(re.search(r"share ?alike|sharealike|by-sa", n))
        rodz = "by-sa" if sa else "by"
        return {"id": ("cc-%s-%s" % (rodz, wersja)) if wersja else None, "rodzina": rodz, "wersja": wersja, "zakaz": zakaz}
    return {"id": None, "rodzina": "inna", "wersja": None, "zakaz": zakaz}


def _rodzina_zbioru(lic):
    if lic is None:
        return "pd", None
    if lic == "cc0-1.0":
        return "cc0", "1.0"
    m = re.fullmatch(r"cc-(by|by-sa)-([34]\.0)", lic)
    if m:
        return m.group(1), m.group(2)
    return "inna", None


def regula_licencji(pakiet, lic_zbioru, copyright_imslp):
    """Reguły 4 i 4b: (licencja_do_manifestu, None) albo (None, powód)."""
    P = PAKIETY[pakiet]
    if lic_zbioru not in P["dozwolone_zbior"]:
        return None, "reguła 4: licencja w zbiorze %s poza pakietem" % lic_zbioru
    imslp = licencja_z_tekstu(copyright_imslp)
    if imslp is None:
        return None, "reguła 4b: brak licencji na stronie IMSLP"
    if imslp["zakaz"]:
        return None, "reguła 4b: IMSLP podaje licencję z NC albo ND (%s)" % copyright_imslp.strip()[:80]
    rodz_z, wer_z = _rodzina_zbioru(lic_zbioru)
    if imslp["rodzina"] in ("pd", "cc0"):
        lic = "cc0-1.0" if imslp["rodzina"] == "cc0" else "public-domain"
    elif imslp["rodzina"] in ("by", "by-sa"):
        wersja = imslp["wersja"] or (wer_z if imslp["rodzina"] == rodz_z else None)
        if not wersja:
            return None, "reguła 4b: IMSLP %s bez wersji, a zbiór %s" % (copyright_imslp.strip()[:60], lic_zbioru)
        lic = "cc-%s-%s" % (imslp["rodzina"], wersja)
    else:
        return None, "reguła 4b: nieznana licencja na IMSLP (%s)" % copyright_imslp.strip()[:80]
    dozwolone = P["dozwolone_imslp"]
    if lic not in dozwolone:
        return None, "reguła 4b: IMSLP podaje %s, poza pakietem" % lic
    return lic, None


_NIE_OSOBA = re.compile(r"midi|photoscore|synth|general|editor|sibelius|finale|musescore|noteworthy|lilypond|"
                        r"computer|sequenc|audio|software|anonym|unknown|various|\bn/a\b", re.I)


def oczysc(v):
    """Wartość pola IMSLP bez linków, szablonów, adresów i dopisku z rokiem."""
    v = v or ""
    v = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", v)            # [[User:X|Y]] → Y
    v = re.sub(r"\[\[([^\]]*)\]\]", r"\1", v)                      # [[X]] → X
    v = re.sub(r"\[(?:mailto:|https?://)\S+\s+([^\]]*)\]", r"\1", v)   # [url Tekst] → Tekst
    v = re.sub(r"\[(?:mailto:|https?://)\S+\]", "", v)
    v = re.sub(r"\{\{[^{}]*\}\}", "", v)                           # szablony
    v = re.sub(r"<[^>]+>", "", v)
    v = re.sub(r"\S+@\S+\.\S+", "", v)                             # adresy e-mail
    v = re.sub(r"[,;]?\s*\(?\b(1[89]|20)\d\d\)?\.?\s*$", "", v.strip())   # „…, 2019.”
    return re.sub(r"\s+", " ", v).strip(" ,;.-")


def wyglada_na_osobe(v):
    if not v or _NIE_OSOBA.search(v) or len(v) > 60:
        return False
    slowa = v.replace(".", ". ").split()
    return 2 <= len(slowa) <= 5 and all(s[:1].isupper() or s.lower() in ("van", "von", "de", "da", "di", "der", "la", "le")
                                       for s in slowa)


def autor_midi(pola):
    """Autor sekwencji MIDI z pól bloku pliku na stronie IMSLP albo None."""
    perf = pola.get("Performers", "") or ""
    m = re.search(r"MIDI\s+(?:file|sequence|realization)\s+by\s+([^,;\n\]|}]+)", perf, re.I)
    if m:
        return oczysc(m.group(1))
    pub = oczysc(pola.get("Publisher Information", ""))
    if pub and not _NIE_OSOBA.search(pub):
        pub = re.sub(r"^[^:]{2,30}:\s*", "", pub) if re.match(r"^[A-ZÀ-Ž][\wÀ-ž .'-]{1,28}:\s", pub) else pub
        if pub:
            return pub
    p = oczysc(perf)
    if wyglada_na_osobe(p):
        return p
    return None


def regula_autora(pakiet, licencja, autor):
    """Reguła 5: (True, None) albo (False, powód)."""
    if autor:
        return True, None
    if licencja in ("cc-by-3.0", "cc-by-sa-3.0"):
        return False, "reguła 5: CC BY/BY-SA 3.0 bez ustalonego autora pliku MIDI"
    if PAKIETY[pakiet]["autor_zawsze"] and licencja and licencja.startswith("cc-by"):
        return False, "reguła 5: pakiet %s wymaga autora pliku MIDI" % PAKIETY[pakiet]["name"]
    return True, None


def pola_bloku(blok):
    """Pola bloku {{#fte:imslpaudio …}}: dzielenie po „|” na zerowej głębokości [[…]] i {{…}}."""
    b = blok
    if b.startswith("{{"):
        b = b[2:]
    if b.endswith("}}"):
        b = b[:-2]
    czesci, akt, gl, i = [], [], 0, 0
    while i < len(b):
        dwa = b[i:i + 2]
        if dwa in ("[[", "{{"):
            gl += 1
            akt.append(dwa)
            i += 2
            continue
        if dwa in ("]]", "}}") and gl > 0:
            gl -= 1
            akt.append(dwa)
            i += 2
            continue
        if b[i] == "|" and gl == 0:
            czesci.append("".join(akt))
            akt = []
        else:
            akt.append(b[i])
        i += 1
    czesci.append("".join(akt))
    pola = {}
    for c in czesci[1:]:
        if "=" in c:
            k, v = c.split("=", 1)
            pola[k.strip()] = v.strip()
    return pola


def blok_pliku(wikitext, nazwa_pliku):
    """Blok {{#fte:imslpaudio …}} strony utworu, w którym jest ten plik (pełna nazwa, z prefiksem PMLP…)."""
    if not wikitext:
        return None
    for kand in (nazwa_pliku, nazwa_pliku.replace("_", " ")):
        k = wikitext.find("=" + kand)
        while k >= 0:
            s = wikitext.rfind("{{#fte:imslp", 0, k)
            if s >= 0:
                gl, i = 0, s
                while i < len(wikitext):
                    if wikitext.startswith("{{", i):
                        gl += 1
                        i += 2
                        continue
                    if wikitext.startswith("}}", i):
                        gl -= 1
                        i += 2
                        if gl == 0:
                            return wikitext[s:i]
                        continue
                    i += 1
            k = wikitext.find("=" + kand, k + 1)
    return None


def rok_smierci_z_wikitext(w):
    m = re.search(r"\|\s*Died Year\s*=\s*(\d{3,4})", w or "")
    if m:
        return int(m.group(1))
    m = re.search(r"\|\s*Death Date\s*=\s*([^\n|]*)", w or "")   # „probably by 12 October 1591”, „c.1640”
    r = re.search(r"\b(\d{3,4})\b", m.group(1)) if m else None
    return int(r.group(1)) if r else None


# =============================================================================================
# IMSLP (cache na dysku, ~1 zapytanie/s)
class Imslp:
    def __init__(self, katalog, odstep=1.0):
        os.makedirs(katalog, exist_ok=True)
        self.plik = os.path.join(katalog, "imslp_wikitext.json")
        self.odstep = odstep
        self.ost = 0.0
        self.zapytan = 0
        try:
            with open(self.plik, encoding="utf-8") as f:
                self.cache = json.load(f)
        except Exception:
            self.cache = {}

    def zapisz(self):
        tmp = self.plik + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.cache, f, ensure_ascii=False)
        os.replace(tmp, self.plik)

    def wikitext(self, strona):
        if strona in self.cache:
            return self.cache[strona]
        czekaj = self.odstep - (time.time() - self.ost)
        if czekaj > 0:
            time.sleep(czekaj)
        url = "https://imslp.org/api.php?" + urllib.parse.urlencode(
            {"action": "parse", "page": strona, "prop": "wikitext", "format": "json", "redirects": 1})
        w = None
        for proba in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40) as r:
                    j = json.load(r)
                w = j.get("parse", {}).get("wikitext", {}).get("*")
                break
            except Exception:
                time.sleep(3 * (proba + 1))
        self.ost = time.time()
        self.zapytan += 1
        self.cache[strona] = w
        if self.zapytan % 25 == 0:
            self.zapisz()
        return w


def strona_z_adresu(url):
    return urllib.parse.unquote(url.split("/wiki/", 1)[1]).replace("_", " ")


def plik_z_adresu(url):
    return urllib.parse.unquote(url.split("/wiki/File:", 1)[1])


# =============================================================================================
# ZBIÓR (pyarrow + HfFileSystem, tylko kolumny metadanych i `midi` potrzebnych grup)
def wiersze_zbioru(klucz, log):
    """Wiersze zbioru z położeniem fragmentu kolumny `midi` (cache w tools/.cache/rows_<klucz>.json)."""
    Z = ZBIORY[klucz]
    plik_cache = os.path.join(CACHE, "rows_%s_%s.json" % (klucz, Z["revision"][:10]))
    if os.path.isfile(plik_cache):
        with open(plik_cache, encoding="utf-8") as f:
            return json.load(f)
    import pyarrow.parquet as pq
    from huggingface_hub import HfApi, HfFileSystem
    pliki = sorted(f for f in HfApi().list_repo_files(Z["repo"], repo_type="dataset", revision=Z["revision"])
                   if f.endswith(".parquet"))
    fs = HfFileSystem()
    out = []
    for plik in pliki:
        with fs.open("datasets/%s@%s/%s" % (Z["repo"], Z["revision"], plik), "rb", block_size=64 * 1024) as fh:
            pf = pq.ParquetFile(fh)
            md = pf.metadata
            nazwy = [md.schema.column(i).name for i in range(md.num_columns)]
            im = nazwy.index("midi")
            for rg in range(md.num_row_groups):
                cc = md.row_group(rg).column(im)
                if cc.compression != "SNAPPY":
                    raise SystemExit("%s rg %d: kodek %s, czytnik aplikacji zna tylko SNAPPY" % (plik, rg, cc.compression))
                ofs = [o for o in (cc.dictionary_page_offset, cc.data_page_offset) if o is not None and o > 0]
                od = min(ofs)
                t = pf.read_row_group(rg, columns=KOLUMNY).to_pylist()
                for r in t:
                    r.update(parquet_file=plik, row_group=rg, midi_chunk_offset=od, midi_chunk_length=cc.total_compressed_size)
                    out.append(r)
        log("  %s: %d wierszy" % (plik, len(out)))
    os.makedirs(CACHE, exist_ok=True)
    with open(plik_cache, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    return out


def skroty_midi(klucz, grupy, log):
    """{file_name: (sha256, rozmiar)} dla wierszy z podanych grup (plik, rg); czyta kolumny file_name i midi."""
    Z = ZBIORY[klucz]
    plik_cache = os.path.join(CACHE, "sha_%s_%s.json" % (klucz, Z["revision"][:10]))
    cache = {}
    if os.path.isfile(plik_cache):
        with open(plik_cache, encoding="utf-8") as f:
            cache = json.load(f)
    brak = sorted({g for g in grupy if "%s#%d" % g not in cache})
    if brak:
        import pyarrow.parquet as pq
        from huggingface_hub import HfFileSystem
        fs = HfFileSystem()
        for plik, rg in brak:
            with fs.open("datasets/%s@%s/%s" % (Z["repo"], Z["revision"], plik), "rb", block_size=64 * 1024) as fh:
                t = pq.ParquetFile(fh).read_row_group(rg, columns=["file_name", "midi"]).to_pylist()
            cache["%s#%d" % (plik, rg)] = {r["file_name"]: [hashlib.sha256(r["midi"]).hexdigest(), len(r["midi"])] for r in t}
            log("  skróty %s grupa %d: %d plików" % (plik, rg, len(t)))
            with open(plik_cache, "w", encoding="utf-8") as f:
                json.dump(cache, f)
    out = {}
    for g in grupy:
        out.update({k: tuple(v) for k, v in cache["%s#%d" % g].items()})
    return out


def weryfikuj_czytnikiem(klucz, utwory, log):
    """Każdy fragment kolumny `midi` pobrany tak jak w aplikacji (Range + własny czytnik): wszystkie skróty z manifestu
    muszą się w nim znaleźć. Inaczej aplikacja nie umiałaby pobrać pakietu."""
    sys.path.insert(0, ROOT)
    import ribbitflip_songpacks as sp
    Z = ZBIORY[klucz]
    grupy = {}
    for s in utwory:
        grupy.setdefault((s["parquet_file"], s["midi_chunk_offset"], s["midi_chunk_length"]), set()).add(s["sha256"])
    for (plik, od, ile), skroty in sorted(grupy.items()):
        frag = sp.pobierz_zakres(sp.HF % (Z["repo"], Z["revision"], plik), od, ile)
        jest = {hashlib.sha256(v).hexdigest() for v in sp.wartosci_kolumny(frag)}
        if not skroty <= jest:
            raise SystemExit("%s @%d: czytnik aplikacji nie znalazł %d skrótów" % (plik, od, len(skroty - jest)))
    log("  czytnik aplikacji: %d fragmentów, wszystkie skróty znalezione" % len(grupy))


# =============================================================================================
def zbuduj(pakiet, imslp, rok, log, weryfikuj=True, zajete=None):
    """Manifest pakietu i lista odrzuceń. `zajete`: {id pliku: pakiet} już przyjęte do innych pakietów."""
    zajete = zajete or {}
    P = PAKIETY[pakiet]
    Z = ZBIORY[P["zbior"]]
    granica = rok_graniczny(rok)
    log("== %s (%s @ %s), granica roku śmierci %d" % (pakiet, Z["repo"], Z["revision"][:10], granica))
    wiersze = wiersze_zbioru(P["zbior"], log)
    allow = set()
    pa = os.path.join(PACKS, "cc0_allowlist.txt")
    if pakiet == "cc0_classics" and os.path.isfile(pa):
        allow = {l.split("#")[0].strip() for l in open(pa, encoding="utf-8") if l.split("#")[0].strip()}
    if P["kuracja"]:
        with open(os.path.join(PACKS, P["kuracja"]), encoding="utf-8") as f:
            kolejnosc = [l.split("#")[0].strip() for l in f if l.split("#")[0].strip()]
        po_id = {r["file_name"]: r for r in wiersze}
        kandydaci = [po_id[i] for i in kolejnosc if i in po_id]
        odrzucone = [{"id": i, "powod": "brak w zbiorze"} for i in kolejnosc if i not in po_id]
    else:
        kandydaci, odrzucone = list(wiersze), []
    przyjete = []
    for n, r in enumerate(kandydaci):
        if P["maks"] and len(przyjete) >= P["maks"]:
            odrzucone.append({"id": r["file_name"], "title": r["title"], "composer": r["composer"],
                              "powod": "poza limitem %d utworów pakietu" % P["maks"]})
            continue
        if n % 50 == 0:
            log("  %d/%d (zapytań do IMSLP: %d)" % (n, len(kandydaci), imslp.zapytan))
        baza = {"id": r["file_name"], "title": r["title"], "composer": r["composer"]}
        if r["file_name"] in zajete:
            odrzucone.append(dict(baza, powod="już w pakiecie %s" % zajete[r["file_name"]]))
            continue
        if r["license"] not in P["dozwolone_zbior"]:
            odrzucone.append(dict(baza, powod="reguła 4: licencja w zbiorze %s" % r["license"]))
            continue
        smierc = rok_smierci_z_wikitext(imslp.wikitext("Category:" + r["composer"])) if r["composer"] else None
        rok_utworu = int(r["year"]) if r["year"] is not None else None
        ok, powod = regula_domeny(smierc, rok_utworu, granica, r["file_name"] in allow)
        if not ok:
            odrzucone.append(dict(baza, powod=powod))
            continue
        w = imslp.wikitext(strona_z_adresu(r["metadata_source"]))
        blok = blok_pliku(w, plik_z_adresu(r["midi_source"]))
        if not blok:
            odrzucone.append(dict(baza, powod="reguła 4b: nie znalazłem pliku na stronie utworu w IMSLP"))
            continue
        pola = pola_bloku(blok)
        lic, powod = regula_licencji(pakiet, r["license"], pola.get("Copyright", ""))
        if not lic:
            odrzucone.append(dict(baza, powod=powod))
            continue
        autor = autor_midi(pola)
        ok, powod = regula_autora(pakiet, lic, autor)
        if not ok:
            odrzucone.append(dict(baza, powod=powod))
            continue
        przyjete.append(dict(r, composer_death_year=smierc, license_imslp=lic, midi_author=autor))
    imslp.zapisz()
    grupy = {(r["parquet_file"], r["row_group"]) for r in przyjete}
    skroty = skroty_midi(P["zbior"], grupy, log)
    utwory = []
    for r in przyjete:
        sha, rozm = skroty[r["file_name"]]
        utwory.append({"id": r["file_name"], "title": r["title"], "composer": r["composer"],
                       "composer_death_year": r["composer_death_year"], "year": int(r["year"]) if r["year"] is not None else None,
                       "era": r["era"], "key": r["key"], "license": r["license_imslp"], "license_dataset": r["license"],
                       "license_url": LICENCJE_URL[r["license_imslp"]], "midi_author": r["midi_author"],
                       "source_url": r["midi_source"], "metadata_url": r["metadata_source"], "sha256": sha, "size_bytes": rozm,
                       "parquet_file": r["parquet_file"], "row_group": r["row_group"],
                       "midi_chunk_offset": r["midi_chunk_offset"], "midi_chunk_length": r["midi_chunk_length"]})
    if weryfikuj and utwory:
        weryfikuj_czytnikiem(P["zbior"], utwory, log)
    fragmenty = {(s["parquet_file"], s["midi_chunk_offset"]): s["midi_chunk_length"] for s in utwory}
    manifest = {"pack_id": pakiet, "name": P["name"], "name_en": P["name_en"], "description": P["description"],
                "version": datetime.date.today().isoformat(), "dataset": Z["repo"], "revision": Z["revision"],
                "dataset_author": "TiMauzi (Tim Sockel)", "dataset_url": "https://huggingface.co/datasets/" + Z["repo"],
                "source": "IMSLP (https://imslp.org), pliki zebrane 21–22 lipca 2024",
                "license_summary": P["license_summary"], "pd_cutoff_year": granica,
                "parquet_files": sorted({s["parquet_file"] for s in utwory}),
                "download_bytes": sum(fragmenty.values()), "size_bytes": sum(s["size_bytes"] for s in utwory),
                "songs": utwory}
    return manifest, odrzucone


def kandydaci_allowlisty(imslp, rok, log):
    """Reguła 3: współczesne utwory oznaczone w zbiorze CC0, które odpadły na regułach 1–2. Każdy sprawdzony na IMSLP:
    licencja pliku MIDI oraz licencje WSZYSTKICH plików na stronie utworu (nuty i nagrania: gdy kompozytor sam oddał
    utwór, wszystkie są CC0 albo domeną publiczną). Wynik do przejrzenia: packs/cc0_allowlist.candidates.txt."""
    granica = rok_graniczny(rok)
    wiersze = wiersze_zbioru("cc0", log)
    linie, po_komp = [], {}
    for r in wiersze:
        if r["license"] != "cc0-1.0" or not r["composer"]:
            continue
        smierc = rok_smierci_z_wikitext(imslp.wikitext("Category:" + r["composer"]))
        rok_u = int(r["year"]) if r["year"] is not None else None
        if regula_domeny(smierc, rok_u, granica)[0]:
            continue
        w = imslp.wikitext(strona_z_adresu(r["metadata_source"]))
        blok = blok_pliku(w, plik_z_adresu(r["midi_source"]))
        if not blok:
            continue
        pola = pola_bloku(blok)
        lic = licencja_z_tekstu(pola.get("Copyright", ""))
        if not lic or lic["zakaz"] or lic["rodzina"] not in ("cc0", "pd"):
            continue
        wszystkie = [licencja_z_tekstu(c) for c in re.findall(r"\|\s*Copyright\s*=\s*([^\n|]*)", w or "")]
        caly_cc0 = all(x and not x["zakaz"] and x["rodzina"] in ("cc0", "pd") for x in wszystkie)
        po_komp[r["composer"]] = po_komp.get(r["composer"], 0) + 1
        linie.append((r["composer"], r["title"] or "", "%s  # %s | %s | MIDI na IMSLP: %s | %s | autor pliku: %s" % (
            r["file_name"], r["composer"], (r["title"] or "")[:60], lic["id"],
            "wszystkie pliki utworu CC0/PD (%d)" % len(wszystkie) if caly_cc0 else "UWAGA: inne licencje na stronie utworu",
            autor_midi(pola) or "?")))
    linie = [l for _, _, l in sorted(linie, key=lambda x: (-po_komp[x[0]], x[0], x[1]))]   # kompozytorami, od najliczniejszych
    imslp.zapisz()
    with open(os.path.join(PACKS, "cc0_allowlist.candidates.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("# Kandydaci do packs/cc0_allowlist.txt (reguła 3: współczesne utwory oddane przez kompozytora na CC0).\n"
                "# Wygenerowane %s skryptem tools/build_song_manifests.py. Do pakietu A NIE wchodzą automatycznie: autor\n"
                "# RibbitFlipa przenosi zaakceptowane linie do packs/cc0_allowlist.txt i przebudowuje manifesty.\n"
                "# Kompozytorzy: %s\n\n" % (datetime.date.today().isoformat(),
                                          ", ".join("%s (%d)" % kv for kv in sorted(po_komp.items(), key=lambda x: -x[1]))))
        f.write("\n".join(linie) + "\n")
    log("  kandydaci do allowlisty: %d utworów, %d kompozytorów" % (len(linie), len(po_komp)))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--pakiet", choices=list(PAKIETY), action="append")
    ap.add_argument("--rok", type=int, default=datetime.date.today().year, help="rok bieżący dla reguły 1")
    ap.add_argument("--bez-weryfikacji", action="store_true", help="bez odczytu fragmentów czytnikiem aplikacji")
    ap.add_argument("--bez-kandydatow", action="store_true", help="bez listy kandydatów do allowlisty (reguła 3)")
    a = ap.parse_args()
    log = lambda s: print(s, flush=True)
    imslp = Imslp(CACHE)
    wybrane = a.pakiet or list(KOLEJNOSC)
    # utwory już przyjęte do pakietów: z tego przebiegu i z manifestów pakietów, których teraz nie budujemy
    zajete = {}
    for pakiet in KOLEJNOSC:
        if pakiet not in wybrane and os.path.isfile(os.path.join(PACKS, pakiet + ".json")):
            with open(os.path.join(PACKS, pakiet + ".json"), encoding="utf-8") as f:
                zajete.update({s["id"]: pakiet for s in json.load(f)["songs"]})
    for pakiet in [p for p in KOLEJNOSC if p in wybrane]:
        m, odrz = zbuduj(pakiet, imslp, a.rok, log, not a.bez_weryfikacji, zajete)
        zajete.update({s["id"]: pakiet for s in m["songs"]})
        with open(os.path.join(PACKS, pakiet + ".json"), "w", encoding="utf-8", newline="\n") as f:
            json.dump(m, f, ensure_ascii=False, indent=1)
            f.write("\n")
        with open(os.path.join(PACKS, pakiet + ".rejections.json"), "w", encoding="utf-8", newline="\n") as f:
            json.dump({"pack_id": pakiet, "rejected": len(odrz), "songs": odrz}, f, ensure_ascii=False, indent=1)
            f.write("\n")
        log("  zapisano: %d utworów (%.1f MB pobrania), odrzuconych %d" % (
            len(m["songs"]), m["download_bytes"] / 1e6, len(odrz)))
    if "cc0_classics" in wybrane and not a.bez_kandydatow:
        kandydaci_allowlisty(imslp, a.rok, log)
    imslp.zapisz()


if __name__ == "__main__":
    main()
