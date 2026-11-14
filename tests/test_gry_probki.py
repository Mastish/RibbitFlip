# RibbitBeat: własne próbki w Studiu instrumentów (2026-10-19 wieczór).
# Run: py tests/test_gry_probki.py
#
# Co pilnuje:
#  1. higienę plików: node --check studio-probki.js i studio.js, kolejność skryptów w index.html
#     (studio-probki.js PO biblioteka.js, bo korzysta z jej bibIdb*, i PRZED studio.js),
#  2. umowę między Studiem a silnikiem: `probkaRoot` i `probkaPetla` muszą znaczyć to samo po obu stronach
#     (studio.js je wystawia, glos.js czyta) — rozjechanie się tych nazw to instrument grający nie tę nutę,
#     co pokazuje pokrętło, i nikt by tego nie zauważył poza uchem,
#  3. magazyn bajtów: IndexedDB `zabi-chor` w wersji 3 z magazynem `probki` i kluczami do sprzątania sierot,
#     oraz to, że próbki NIE lądują w localStorage (tam idzie tylko tożsamość: id, sr, długość, źródło),
#  4. mikrofon: zgoda pytana dopiero w `nagraj()`, strumień gaszony w `zamknij()`, a `zamknij()` wołany też
#     przy wyjściu z ekranu Studia (żadnej zapalonej diody po wyjściu),
#  5. czyste funkcje w Node (tests/gry_probki_harness.mjs): WAV PCM16 w obie strony tym samym parserem, co
#     próbki z web/assets/, przycięcie ciszy i wyrównanie poziomu, wykrycie stroju (piła 110–880 Hz, szum → null),
#     tablica próbek silnika z unieważnianiem buforów przy podmianie oraz receptura, którą Studio podaje
#     silnikowi (brak próbki = ani jednego nowego klucza, pętla w sekundach, przycinanie z pliku).
#  6. prywatność: mikrofon dopisany do docs/pl/prywatnosc.md, docs/en/privacy.md i .github/SECURITY.md.
# Brak Node = sprawdzenia z punktu 5 są pomijane (SKIP), nie udawane.
import json
import os
import shutil
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRY = os.path.join(REPO, "web", "gry")
JS = os.path.join(GRY, "js")

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


def czytaj(*czesci):
    return open(os.path.join(*czesci), encoding="utf-8").read()


def main():
    probki = czytaj(JS, "studio-probki.js")
    wspolne = czytaj(REPO, "web", "gry", "js", "probki-audio.js")
    studio = czytaj(JS, "studio.js")
    glos = czytaj(JS, "glos.js")
    biblio = czytaj(JS, "biblioteka.js")
    html = czytaj(GRY, "index.html")

    # ---- 1. higiena plików ----------------------------------------------------------------------
    poz = lambda t: html.find(t) if html.find(t) >= 0 else 10 ** 9
    check("index.html: studio-probki.js po biblioteka.js i przed studio.js",
          poz('<script src="js/biblioteka.js">') < poz('<script src="js/studio-probki.js">') < poz('<script src="js/studio.js">'))
    check("index.html: wspólna obróbka próbek (js/probki-audio.js) przed studio-probki.js",
          poz('<script src="js/probki-audio.js">') < poz('<script src="js/studio-probki.js">'))
    kod = "\n".join(w.split("//")[0] for w in wspolne.splitlines())   # bez komentarzy: te wolno wymieniać oba programy
    check("probki-audio.js nie woła ani silnika gry, ani silnika panelu, ani DOM (jest wspólny)",
          "Glos." not in kod and "PadAudio." not in kod and "document." not in kod,
          [t for t in ("Glos.", "PadAudio.", "document.") if t in kod])
    check("studio-probki.js nie powtarza obróbki dźwięku, tylko bierze ją z ProbkiAudio",
          "ProbkiAudio" in probki and "function przytnij(" not in probki and "function wykryjRoot(" not in probki)

    # ---- 2. umowa Studio ↔ silnik ---------------------------------------------------------------
    check("glos.js: receptura może nieść własny strój próbki (`probkaRoot`)", "r.probkaRoot" in glos)
    check("glos.js: receptura może nieść własną pętlę (`probkaPetla`)", "r.probkaPetla" in glos)
    # 10-20: receptura niesie TYLKO to, co nie dotyka bajtów (strój z centami albo „nie przestrajaj”). Pętla
    # przeszła DO BAJTÓW, bo zlepek jej szwu zmienia próbki wokół miejsca zawrotu — gdyby została w recepturze,
    # nie dałoby się jej zlepić w ogóle (jedno źródło buforowe nie umie przenikać się ze sobą).
    check("studio.js: receptura niesie strój albo „nie przestrajaj”, a pętli NIE niesie",
          "r.probkaRoot=" in studio and "r.probkaStaly=" in studio and "r.probkaPetla=" not in studio)
    check("glos.js: „nie przestrajaj” (strój null) trzyma tempo odtwarzania na 1",
          "z.root==null?1:" in glos and "r.probkaStaly===true" in glos)
    check("studio.js: zestaw próbek nazywa StudioProbki (jedno miejsce na przedrostek „u-”)",
          "StudioProbki.zarejestrujEdycje" in studio and 'nazwaZestawu=id=>"u-"+id' in probki)
    check("studio-probki.js: do silnika idzie wynik `wytnij` (wycinek, poziom, kierunek, zlepek), nie surowe bajty",
          "A.wytnij(p,e||{})" in probki and "function zarejestrujEdycje(" in probki
          and "Glos.ustawProbki(nazwa,[{sr:w.sr,dane:w.dane" in probki)
    check("studio-probki.js: nastawy domyślne zostają pod gołym „u-<id>” (instrumenty sprzed zmiany bez ruchu)",
          "if(domyslna(e))return nazwaZestawu(id);" in probki)
    check("studio.js: zestawy zostawione przez kręcenie wycinkiem są sprzątane",
          "StudioProbki.sprzatajZestawy(uzywaneZestawy())" in studio and "function sprzatajZestawy(" in probki)
    check("studio.js: wszystkie nowe nastawy próbki są w zapisie instrumentu",
          all(("probka" + k + ":") in studio for k in ["Cent", "Staly", "Start", "Koniec", "Poziom", "Wstecz", "Zlep"]))
    check("studio.js: „Przytnij ciszę” przestawia znaczniki, a bajty rusza dopiero „Przytnij na stałe”",
          'ustawWartosc("probkaStart"' in studio and "function przytnijNaStaleProbke(" in studio
          and "StudioProbki.wycinek(p," in studio)
    check("glos.js: brak pętli w recepturze = próbka gra raz (źródło nie jest zapętlane)",
          "if(pet){src.loop=true;" in glos)
    check("glos.js: podmiana zestawu unieważnia bufory przez `wersja`",
          'nazwa+"#"+(s.wersja||1)' in glos)
    check("glos.js: `ustawProbki` i `usunProbki` są w API silnika",
          "ustawProbki,usunProbki" in glos and "parsujWav," in glos)

    # ---- 3. magazyn bajtów ----------------------------------------------------------------------
    check("biblioteka.js: baza w wersji 3 z magazynem `probki`",
          "indexedDB.open(ZC_BIBLIO.BAZA,3)" in biblio and 'createObjectStore("probki")' in biblio)
    check("biblioteka.js: `bibIdbKeys` (do sprzątania osieroconych próbek)", "async function bibIdbKeys(" in biblio)
    check("studio-probki.js: bajty idą do magazynu `probki`, nie do localStorage",
          'SKLEP="probki"' in probki and "localStorage." not in probki)
    check("studio-probki.js: sprzątanie sierot przy starcie", "async function sprzataj(" in probki and "bibIdbKeys(SKLEP)" in probki)
    check("studio.js: sprzątanie dostaje listę używanych próbek", "StudioProbki.sprzataj(ids)" in studio)
    check("studio.js: bajty usuwanego instrumentu giną tylko, gdy nikt ich nie używa",
          "probkaUzywana(pid)" in studio)
    check("studio.js: w zapisie Studia zostaje sama tożsamość próbki (id, sr, długość, źródło)",
          "probkaOk(q.probka)?{id:q.probka.id,sr:+q.probka.sr,dl:+q.probka.dl" in studio)

    # ---- 4. mikrofon ----------------------------------------------------------------------------
    # Jedno `getUserMedia` w całym pliku, w `otworz()`, a wołają je tylko dwie drogi — obie z przycisku pod
    # palcem człowieka: „Nagraj” i „Podsłuch”. Nigdy start programu, nigdy nic w tle.
    check("probki-audio.js: o zgodę pyta dopiero przycisk („Nagraj” albo „Podsłuch”)",
          wspolne.count("getUserMedia(") == 1 and "function otworz(" in wspolne
          and wspolne.index("function otworz(") < wspolne.index("navigator.mediaDevices.getUserMedia({audio")
          and "function nagraj(" in wspolne and "function podsluch(" in wspolne
          and "otworz(opcje.urzadzenie).then" in wspolne and "otworz(urzadzenie).then" in wspolne)
    check("probki-audio.js: wybrany mikrofon zniknął = kod „brak”, nie cicha podmiana na inny",
          "deviceId={exact:urzadzenie}" in wspolne)
    check("probki-audio.js: `zamknij()` gasi ścieżki strumienia",
          "for(const t of g.strum.getTracks())t.stop()" in wspolne)
    check("probki-audio.js: odmowa zgody wraca kodem, nie wyjątkiem",
          '"zgoda"' in wspolne and "NotAllowedError" in wspolne and "NotFoundError" in wspolne)
    check("studio.js: wyjście z ekranu Studia gasi mikrofon",
          "StudioProbki.zamknij()" in studio and studio.index("function zamknijEkran(") < studio.index("try{StudioProbki.zamknij();}catch(e){}"))
    check("studio.js: każdy kod błędu mikrofonu ma własne zdanie po polsku i po angielsku",
          all(("bProbka" + k) in studio for k in ["Zgoda", "Brak", "Zajetymik", "Zajete", "Nieobslugiwane",
                                                  "Krotkie", "Cisza", "Format", "Duzy", "Blad"]))

    # ---- 6. prywatność --------------------------------------------------------------------------
    pl = czytaj(REPO, "docs", "pl", "prywatnosc.md")
    en = czytaj(REPO, "docs", "en", "privacy.md")
    sec = czytaj(REPO, ".github", "SECURITY.md")
    check("docs/pl/prywatnosc.md: mikrofon opisany", "mikrofon" in pl.lower())
    check("docs/en/privacy.md: microphone described", "microphone" in en.lower())
    check(".github/SECURITY.md: mikrofon po polsku i po angielsku",
          "mikrofon" in sec.lower() and "microphone" in sec.lower())

    # ---- 5. czyste funkcje w Node ----------------------------------------------------------------
    node = shutil.which("node")
    if not node:
        print("SKIP  sprawdzenia w Node (node --check, czyste funkcje)   brak node w PATH")
        return
    for p in ["web/gry/js/probki-audio.js", "web/gry/js/studio-probki.js", "web/gry/js/studio.js",
              "web/gry/js/glos.js", "web/gry/js/biblioteka.js"]:
        r = subprocess.run([node, "--check", os.path.join(REPO, *p.split("/"))], capture_output=True, text=True, encoding="utf-8")
        check("node --check " + p, r.returncode == 0, (r.stderr or "")[:400])
    r = subprocess.run([node, os.path.join(REPO, "tests", "gry_probki_harness.mjs")],
                       capture_output=True, text=True, encoding="utf-8")
    try:
        wynik = json.loads((r.stdout or "").strip().splitlines()[-1])
    except Exception:
        check("gry_probki_harness.mjs zwraca JSON", False, (r.stderr or r.stdout or "")[:600])
        return
    for nazwa, ok, szczegol in wynik["checks"]:
        check(nazwa, ok, szczegol)


if __name__ == "__main__":
    main()
    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1 if _failed else 0)
