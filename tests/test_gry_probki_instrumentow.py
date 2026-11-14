# RibbitBeat: instrumenty z PRAWDZIWYCH NAGRAŃ (web/assets/<instrument>/, receptury z `probkiRec` w js/glos.js) — 2026-10-21.
# Run: py tests/test_gry_probki_instrumentow.py
#
# Część instrumentów gra z próbek z otwartych plików audio, ale to ulepszenie istniejących instrumentów, a nie nowe
# instrumenty. Stąd dwie rzeczy, których pilnuje ten test:
#  1. ŻADNEGO NOWEGO INSTRUMENTU: każdy instrument z nagrań ma id z dotychczasowej listy 41 (nazwy PL/EN, rzadkości, zapisy
#     profili działają jak dotąd), a Krzyk zostaje jedynym bez `probkiRec` (jego tor z przesterem jest celowy).
#  2. PLIKI, nie kod, decydują o brzmieniu — więc testujemy pliki (jak tests/test_gry_krzyk.py): format PCM16 mono 22 050 Hz,
#     manifest `strefy: true` opisujący dokładnie te pliki, które leżą w katalogu, strój w 1 półtonie od nuty nominalnej,
#     pętla w pliku i ≥ 100 ms, strefy posortowane po stroju (silnik bierze najbliższą), równa głośność pętli w zestawie
#     (≤ 3 dB, inaczej instrument skacze z nuty na nutę), zapas na szczyt, i ROZMIAR: ≤ 160 kB na plik i ≤ 400 kB na zestaw,
#     bo RibbitBeat.spec pakuje całe web/assets.
# Do tego: licencja CC0 zapisana (third_party_licenses, docs/CREDITS.md, ZRODLA.md przy plikach), kod silnika ma to, bez
# czego nagrania grałyby źle (strefy zamiast rotacji, nastawy toru próbek dopiero po wczytaniu, oktawa próbki), i dźwięk
# liczbami w Chromium (tests/gry_probki_instrumentow.mjs: głos zastępczy, głośność wobec trąbki, wysokość na całej
# klawiaturze, nuta trzymana). Bez playwrighta ten ostatni punkt to SKIP, nie udawany PASS.
import json
import math
import os
import re
import shutil
import struct
import subprocess
import sys
import wave

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRY = os.path.join(REPO, "web", "gry", "js")
ASSETY = os.path.join(REPO, "web", "assets")
SR = 22050
MAKS_PLIK = 160 * 1024
MAKS_ZESTAW = 400 * 1024
MAKS_ROZRZUT_PETLI = 3.0   # dB między strefami jednego instrumentu
LICENCJA = os.path.join(REPO, "third_party_licenses", "vsco2-ce-LICENSE.txt")

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


def czytaj(*cz):
    return open(os.path.join(*cz), encoding="utf-8").read()


def db(v):
    return 20 * math.log10(max(v, 1e-9))


def rms(d):
    return math.sqrt(sum(v * v for v in d) / len(d)) if d else 0.0


def receptury(glos):
    """{id: tekst receptury} z tablicy RECEPTURY (jedna receptura = jedna linia zaczynająca się od `id:{`)."""
    blok = glos[glos.index("const RECEPTURY={"):glos.index("const Z_PROBEK=")]
    return dict(re.findall(r"^\s*([a-z]+):\s*(\{.*\})\}?[,;]?\s*(?://.*)?$", blok, re.M))


def main():
    glos = czytaj(GRY, "glos.js")
    rec = receptury(glos)
    check("RECEPTURY: nadal 41 instrumentów gry (żadnego nowego, żadnego usuniętego)", len(rec) == 41, "%d: %s" % (len(rec), sorted(rec)))
    z_nagran = {k: v for k, v in rec.items() if "probkiRec:" in v}
    zestawy = {k: re.search(r'probki:"([a-z]+)"', v).group(1) for k, v in z_nagran.items() if re.search(r'probki:"([a-z]+)"', v)}
    check("są instrumenty z nagrań (`probki` + `probkiRec`)", len(z_nagran) >= 1 and len(zestawy) == len(z_nagran), sorted(z_nagran))
    check("Krzyk zostaje przy swoim torze (bez `probkiRec`, z przesterem)", "krzyk" in rec and "probkiRec" not in rec["krzyk"] and "znieksz:3" in rec["krzyk"])

    # ---- te same id co dotąd: nazwy PL i EN, czyli instrument istniał zanim dostał nagrania ----
    pl = re.search(r"instrumentyGracza:\{(.*?)\}", czytaj(GRY, "zabi-chor.js"), re.S).group(1)
    en = re.search(r"instrumentyGracza:\{(.*?)\}", czytaj(GRY, "jezyk-en.js"), re.S).group(1)
    for k in sorted(z_nagran):
        check("%s: istniejący instrument (ma nazwę PL i EN)" % k, re.search(r"\b%s:" % k, pl) and re.search(r"\b%s:" % k, en))

    # ---- silnik: to, bez czego nagrania grałyby źle ----
    check("glos.js: zestaw ze strefami gra najbliższą próbkę zamiast rotacji", "if(L.strefy)return L[d.indexOf(m)];" in glos)
    check("glos.js: manifest `strefy` trafia do tablicy próbek i do buforów", "wpis.strefy=!!m.strefy" in glos and "m[k].strefy=!!s.strefy" in glos)
    check("glos.js: nastawy toru próbek DOPIERO gdy próbki są (głos zastępczy = dawna receptura bajt w bajt)",
          "if(P&&r.probkiRec)r=Object.assign({},r,Z_PROBEK,r.probkiRec);" in glos)
    z_probek = re.search(r"const Z_PROBEK=\{(.*?)\};", glos).group(1)
    for klucz in ("szarp:null", "znieksz:0", "puch:0", "am:0", "wah:null", "wib:0"):
        check("Z_PROBEK zdejmuje z nagrania to, co formowało oscylatory (%s)" % klucz, klucz in z_probek, z_probek)
    check("glos.js: `probkaOkt` przestraja próbkę i wybór strefy o oktawy (jak `okt` oscylatorów)",
          "const oktP=12*(r.probkaOkt||0);" in glos and "wybierzProbke(P,wysP(pt)+oktP)" in glos and "(polton+oktP-z.root)/12" in glos)
    # przejścia „organiczne”: mniej płynnego zjazdu wysokości, bez kliku przy wejściu na nutę, smyczek rusza się przy ruchach
    check("glos.js: `legato` = kroki na nuty z miękkim wejściem; decyzja co wywołanie, przed ogranicznikiem",
          "const krok=!!(legatoP&&spiewa&&krokP(polton,ostCele,t));" in glos and "if(!krok&&((dp<.02&&" in glos and "(+legatoP.czas||.08)/3" in glos)
    check("glos.js: `artyk` = nowa nuta to nowe źródło z właściwej strefy, przenikane ze starym", "if(krok&&artykP)startProbki(t,artykP)" in glos
          and "sg.gain.setTargetAtTime(1,t,zl/3)" in glos and "wybierzProbke(P,wysP(pt)+oktP)" in glos)
    # krok ma trafiać w nuty grane w grze: krok staje na nutach piosenki, nie na każdym półtonie zjazdu
    check("glos.js: KROK — histereza .15, zasięg nut piosenki .75, zwłoka .07 s dla półtonu spoza piosenki",
          "const KROK={H:.15,R:.75,ZWLOKA:.07};" in glos)
    check("glos.js: kandydat = najbliższa nuta piosenki w jej zasięgu, inaczej najbliższy półton",
          "if(Number.isFinite(b)&&p>=lo-KROK.R&&p<=hi+KROK.R){zNutP=true;return b;}" in glos and "return Math.round(p);" in glos)
    check("glos.js: nuta piosenki od razu, obcy półton dopiero po zwłoce, zmiana tylko o histerezę bliżej",
          "if(k===nutaP||Math.abs(p-k)+KROK.H>=Math.abs(p-nutaP)){kandN=NaN;return false;}" in glos
          and "if(zNutP||!(S&&S.length)){nutaP=k;kandN=NaN;return true;}" in glos and "if(t-kandT>=KROK.ZWLOKA){nutaP=k;kandN=NaN;return true;}" in glos)
    check("glos.js: swoboda intonacji najwyżej pół półtonu (głos nie podjeżdża za zjazdem przed krokiem)",
          "nutaP+swobodaP*Math.max(-.5,Math.min(.5,polton-nutaP))" in glos)
    check("glos.js: nowa nuta startuje od razu na nucie piosenki; szarpnięcie oscylatorów skokowo razem z krokiem",
          "nutaP=kandydatP(Number.isFinite(ostP)?ostP:60,ostCele);kandN=NaN;" in glos and "if(r.szarp&&spiewa){if(legatoP){if(krok)uderz(t);}" in glos)
    check("glos.js: głos ma stan() (nuta, kroki, artykulacje) do diagnostyki i testów", "stan(){return {nuta:nutaP,kroki:nKrok,artyk:nArtyk,skok:!!legatoP,probki:!!P};}" in glos)
    # szum smyczka od ruchu
    # wysokości wywalony; zmianę smyczka niesie samo nagranie (`artyk` od 0)
    check("glos.js: bez szumu smyczka od ruchu wysokości (`smyk`)", "smykG" not in glos and "smyk:{" not in glos and "r.smyk" not in glos)
    check("glos.js: ogon puszczonej nuty gaśnie przy nowej (nie wraca przez obwiednię)", "zrStary=z;" in glos and "if(zrStary){const z=zrStary;zrStary=null;" in glos)
    # przełącznik „jak ma brzmieć” dla każdego instrumentu
    # domyślny tryb instrumentu to ten, w którym brzmi najlepiej (np. krzyk skokowo)
    skok_dom = ("smyczki", "flet", "organy", "okaryna", "gwizdek", "harmonijka", "klarnet", "oboj", "tuba", "dudy", "wiolonczela", "chiptune",
                "robot", "piano", "epiano", "guitar", "bas", "impuls", "hammond", "chor", "trance", "sub", "krzyk")
    for k, v in sorted(rec.items()):
        ma = "legato:{" in v
        check("%s: domyślnie %s" % (k, "skokowo (`legato` w recepturze)" if k in skok_dom else "płynnie (bez `legato`)"), ma == (k in skok_dom), v)
    check("glos.js: głos bierze `opcje.przejscia` (skok | plynne), domyślnie z receptury (`legato`, także z probkiRec bez plików)",
          "function glosZaby(rodzaj,sk,nr,cel,opcje)" in glos and 'opcje&&opcje.przejscia==="skok"?true:opcje&&opcje.przejscia==="plynne"?false:!!legatoRec' in glos
          and "(rOrg.probkiRec&&rOrg.probkiRec.legato&&" in glos)
    check("glos.js: skokowo bez własnych nastaw = LEGATO_DOM, a głos z próbek także ARTYK_DOM",
          "const LEGATO_DOM={czas:.07,swoboda:.25},ARTYK_DOM={od:.012,zlep:.04};" in glos and "const legatoP=skokP?(legatoRec||LEGATO_DOM):null;" in glos and ":ARTYK_DOM):null" in glos)
    check("glos.js: skokowo działa też na oscylatorach (ta sama wysokość `wys` dla oscylatorów i próbki)",
          "const fq=hz(wys)*okt;" in glos and "oscy.forEach((o,i)=>o.frequency.setTargetAtTime(fq*krotnosc[i],t,tau));" in glos)
    check("glos.js: `domyslnePrzejscia`, `probka` i `fraza` biorą tryb; API ma domyslnePrzejscia",
          "function domyslnePrzejscia(rodzaj)" in glos and "function probka(rodzaj,ponowna,opcje)" in glos and "function fraza(rodzaj,opcje)" in glos and "glos,domyslnePrzejscia," in glos)
    check("Krzyk: skokowo — nowy półton to nowy krzyk od początku",
          "legato:{czas:.06,swoboda:.3},artyk:{od:0,zlep:.03}" in rec["krzyk"])
    zc = czytaj(GRY, "zabi-chor.js")
    css = czytaj(REPO, "web", "gry", "gry.css")
    en = czytaj(GRY, "jezyk-en.js")
    # przełącznik stoi w oknie konfiguracji gracza, nie przy instrumentach, a gracz wybiera dla instrumentu płynnie,
    # skokowo albo domyślnie: przełącznik w oknie „Pomoce” (bot: „Poziom”), wybór dla pary
    # (gracz, instrument), trzy opcje: domyślnie, płynnie, skokowo
    check("gracz: wybór przejść dla pary (gracz, instrument) w S.ust.przejsciaGraczy[gracz][instrument], brak klucza = domyślnie",
          "przejsciaGraczy:{}" in zc and 'const ZC_PRZEJSCIA_GRACZA=["auto","plynne","skok"];' in zc
          and 'const w=(S.ust.przejsciaGraczy||{})[g&&g.id],v=w&&typeof w==="object"?w[id||instrumentGracza(g)]:null;' in zc
          and 'return v==="auto"?Glos.domyslnePrzejscia(id):v;' in zc
          and 'if(v==="plynne"||v==="skok")m[id]=v;else delete m[id];' in zc
          and "if(Object.keys(m).length)w[g.id]=m;else delete w[g.id];" in zc)
    pomoce = zc[zc.index("function otworzPomoceGracza(g,powrot){"):zc.index("function obrazInstrumentu(box,id){")]
    poziom = zc[zc.index("function otworzWyborPoziomu(g,powrot){"):zc.index("// Karta bota (poziom")]
    instr = zc[zc.index("function otworzWyborInstrumentu(g,powrot){"):zc.index("function otworzSceneWspolna(")]
    check("okno „Pomoce: <gracz>”: grupa „Przejścia między nutami” pod sumą punktów",
          "const przejscia=grupaPrzejsc(g,()=>{if(S.gracze.includes(g)){rysujGraczy();odswiez();}});" in pomoce
          and "cialo.append(suma,przejscia.w);" in pomoce)
    check("okno bota „Poziom: <bot>”: ta sama grupa pod siatką poziomów", "const przejscia=grupaPrzejsc(g," in poziom and "cialo.append(rz,przejscia.w);" in poziom)
    check("grupa przejść: kafelki jak pomoce (piktogram trybu nut / instrumentu), plakietka „bez mnożnika”, opis, odsłuch po kliku",
          'piktogram("tryb","plynny")' in zc and 'piktogram("tryb","klasyczny")' in zc and 'piktogram("instrument",instrumentGracza(g))' in zc
          and 'pl=h("span","ust-mn",T.mnBezMnoznika);pl.dataset.stan="bez";' in zc
          and "ustawPrzejsciaGracza(g,v);odswiez();odsluchajInstrument(instrumentGracza(g),przejsciaGracza(g));if(poZmianie)poZmianie();" in zc)
    check("karta: wymuszony tryb jako ikonka na kaflu „Pomoce” (bot: „Poziom”) i zdanie w dymku; „jak instrument” = nic",
          "const przI=ikonkaPrzejsc(g);" in zc and "+dymekPrzejsc(g);" in zc and 'h("span","kw-pomoce-ikony kw-przejscia-ikona")' in zc
          and 'return v==="auto"?"":ikonaFilc(v==="skok"?"tryb-klasyczny":"tryb-plynny");' in zc)
    check("nie na instrumentach: bez przełącznika pod kaflem instrumentu i w oknie instrumentów",
          "przyciskPrzejsc" not in zc and "kw-przejscia\"" not in zc and ".kw-przejscia{" not in css and "instr-przejscia" not in instr
          and "instr-przejscia" not in css)
    check("okno instrumentów: odsłuch po wyborze instrumentu w trybie gracza", "odsluchajInstrument(id,przejsciaGracza(g,id));" in instr)
    check("gra: krok gracza (ludzie i boty) podaje głosowi nuty piosenki wokół linii (nutyGlosu)",
          "function nutyGlosu(nuty,idx,b,out)" in zc
          and "g.glos.ustaw(semi,.35+.5*g.poz,g.wib,undefined,nutyGlosu(def.nuty,idx,b1,g.nutyGlosu||(g.nutyGlosu=[])))" in zc)
    check("gra: nutyGlosu — na nucie ona sama, w zjeździe także nuta docelowa, w krótkiej przerwie poprzednia i następna",
          "if(idx>=0){const n=nuty[idx];out.push(n.m);if(n.p&&b>=n.t+n.d*n.p.od)out.push(n.p.do);return out;}" in zc
          and "if(j>0){const a=nuty[j-1],z=nuty[j];if(z.t-(a.t+a.d)<=1)out.push(a.p?a.p.do:a.m,z.m);}" in zc)
    check("gra: głos gracza i odsłuch powstają z trybem przejść gracza",
          zc.count("{przejscia:przejsciaGracza(g)}") >= 2 and "Glos.probka(v,false,przejscia?{przejscia}:undefined)" in zc
          and "odsluchajInstrument(instrumentGracza(g),przejsciaGracza(g))" in zc)
    for k in ("przejsciaTytul", "przejsciaTytulInstr", "przejscia_auto", "przejscia_plynne", "przejscia_skok", "przejsciaTryb_plynne", "przejsciaTryb_skok",
              "przejsciaOpis_auto", "przejsciaOpis_plynne", "przejsciaOpis_skok", "przejsciaDymek_auto", "przejsciaKafel"):
        check("teksty przełącznika PL i EN: %s" % k, (k + ':"') in zc and (k + ':"') in en)
    for k, v in sorted(z_nagran.items()):
        pr = re.search(r"probkiRec:\{(.*)\}\}", v).group(1)
        if k in ("piano", "organy"):
            check("%s: klawisz nie gnie dźwięku (legato ze swobodą 0) i artykułuje całym atakiem (`artyk` od 0)" % k,
                  "swoboda:0" in pr and "artyk:{od:0" in pr, pr)
        elif k in ("smyczki", "wiolonczela"):
            check("%s: zmiana smyczka całym atakiem z nagrania (`artyk` od 0), bez szumu od ruchu" % k, "artyk:{od:0" in pr and "smyk" not in pr, pr)
        elif k in ("puzon", "trabka"):
            check("%s: BEZ legato i artykulacji — ślizg suwaka / „luźne przesunięcia” trąbki zostają" % k,
                  "legato" not in pr and "artyk" not in pr and "smyk" not in pr, pr)
        else:
            check("%s: dęty — półtony z miękkim wejściem i „język” (`artyk` od > 0)" % k,
                  "legato:{" in pr and re.search(r"artyk:\{od:\.0\d", pr) is not None and "smyk" not in pr, pr)
    check("glos.js: wszystkie zestawy z receptur ładują się przy utworzeniu kontekstu",
          "for(const k of INSTRUMENTY_GRACZA)if(RECEPTURY[k].probki)zaladujProbki(RECEPTURY[k].probki);" in glos)
    check("glos.js: tor próbek Krzyku i Studia nienaruszony (`probkaRoot`, `probkaPetla`, `probkaStaly`, `loopEnd` przycięte)",
          "r.probkaRoot" in glos and "r.probkaPetla" in glos and "r.probkaStaly===true" in glos and "Math.min(pet[1],p.buf.duration)" in glos)
    for k, v in sorted(z_nagran.items()):
        okt = re.search(r"\bokt:(-?\d)", v)
        pokt = re.search(r"probkaOkt:(-?\d)", v)
        check("%s: `probkaOkt` zgadza się z `okt` głosu zastępczego (ta sama oktawa z nagrań i z oscylatorów)" % k,
              (int(pokt.group(1)) if pokt else 0) == (int(okt.group(1)) if okt else 0), v)

    # ---- pliki ----
    for k, zestaw in sorted(zestawy.items()):
        kat = os.path.join(ASSETY, zestaw)
        man_p = os.path.join(kat, zestaw + ".json")
        check("%s: katalog web/assets/%s/ z manifestem i ZRODLA.md" % (k, zestaw),
              os.path.isfile(man_p) and os.path.isfile(os.path.join(kat, "ZRODLA.md")), kat)
        if not os.path.isfile(man_p):
            continue
        man = json.load(open(man_p, encoding="utf-8"))
        probki = man.get("probki") or []
        check("%s: manifest: sr %d, `strefy: true`, 3–4 strefy, źródło CC0" % (k, SR),
              man.get("sr") == SR and man.get("strefy") is True and 3 <= len(probki) <= 4
              and (man.get("zrodlo") or {}).get("licencja") == "CC0-1.0", json.dumps({x: man.get(x) for x in ("sr", "strefy", "zrodlo")}, ensure_ascii=False))
        pliki = sorted(f for f in os.listdir(kat) if f.endswith(".wav"))
        check("%s: manifest opisuje dokładnie te pliki, które leżą w katalogu" % k, sorted(m["plik"] for m in probki) == pliki,
              "%s vs %s" % (sorted(m["plik"] for m in probki), pliki))
        roots, petle, razem = [], [], 0
        for m in probki:
            sciezka = os.path.join(kat, m["plik"])
            if not os.path.isfile(sciezka):
                check("%s: plik %s istnieje" % (k, m["plik"]), False)
                continue
            razem += os.path.getsize(sciezka)
            check("%s: %s ≤ %d kB" % (k, m["plik"], MAKS_PLIK // 1024), os.path.getsize(sciezka) <= MAKS_PLIK, "%d B" % os.path.getsize(sciezka))
            with wave.open(sciezka, "rb") as w:
                kan, szer, czest, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
                d = [v / 32768.0 for v in struct.unpack("<%dh" % n, w.readframes(n))]
            check("%s: %s PCM16 mono %d Hz" % (k, m["plik"], SR), kan == 1 and szer == 2 and czest == SR, "kanały %d, bajty %d, %d Hz" % (kan, szer, czest))
            od, do_ = m["petla"]
            s, e = int(round(od * SR)), int(round(do_ * SR))
            check("%s: %s pętla mieści się w pliku i trwa ≥ 100 ms" % (k, m["plik"]), 0 < s < e <= n and (e - s) / SR >= .1,
                  "pętla %d..%d, plik %d próbek" % (s, e, n))
            check("%s: %s strój %.2f w 1 półtonie od nuty nominalnej %s" % (k, m["plik"], m["root"], m.get("nuta")),
                  isinstance(m.get("nuta"), int) and abs(m["root"] - m["nuta"]) <= 1.0)
            szczyt = max(abs(v) for v in d)
            check("%s: %s zapas na szczyt (nic nie obcięte)" % (k, m["plik"]), szczyt <= .985, "szczyt %.3f" % szczyt)
            s, e = max(0, min(s, n - 1)), max(1, min(e, n))
            petle.append(db(rms(d[s:e])))
            roots.append(m["root"])
        check("%s: zestaw ≤ %d kB razem (RibbitBeat.spec pakuje całe web/assets)" % (k, MAKS_ZESTAW // 1024), razem <= MAKS_ZESTAW, "%d kB" % (razem // 1024))
        if roots:
            check("%s: strefy posortowane po stroju i co najmniej 4,5 półtonu od siebie (pianino: C i G co kwartę/kwintę)" % k,
                  roots == sorted(roots) and all(b - a >= 4.5 for a, b in zip(roots, roots[1:])), str(roots))
            check("%s: pętle stref równie głośne (≤ %.0f dB rozrzutu)" % (k, MAKS_ROZRZUT_PETLI), max(petle) - min(petle) <= MAKS_ROZRZUT_PETLI,
                  "rozrzut %.1f dB (%s)" % (max(petle) - min(petle), ", ".join("%.1f" % p for p in petle)))

    # ---- licencje i podziękowania ----
    tp = czytaj(REPO, "third_party_licenses", "README.md")
    pl_cz, en_cz = tp.split("## English", 1) if "## English" in tp else (tp, "")
    check("third_party_licenses/README.md: sekcja VSCO 2 Community Edition po polsku i po angielsku",
          "VSCO 2 Community Edition" in pl_cz and "VSCO 2 Community Edition" in en_cz and "vsco2-ce-LICENSE.txt" in tp)
    check("third_party_licenses/vsco2-ce-LICENSE.txt: tekst CC0 1.0", os.path.isfile(LICENCJA) and "CC0 1.0 Universal" in czytaj(LICENCJA))
    cr = czytaj(REPO, "docs", "CREDITS.md")
    check("docs/CREDITS.md: podziękowanie dla VSCO 2 CE (PL i EN)", cr.count("VSCO 2 Community Edition") >= 2)
    spec = czytaj(REPO, "RibbitBeat.spec")
    check("RibbitBeat.spec pakuje całe web/assets (nowe katalogi jadą same)", "('web/assets', 'web/assets')" in spec)

    # ---- kod i dźwięk w Chromium ----
    node = shutil.which("node")
    if not node:
        print("SKIP  brak node — node --check i pomiar dźwięku pominięte")
    else:
        r = subprocess.run([node, "--check", os.path.join(GRY, "glos.js")], capture_output=True, text=True, encoding="utf-8")
        check("node --check glos.js", r.returncode == 0, r.stderr)
        harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gry_probki_instrumentow.mjs")
        try:
            out = subprocess.run([node, harness], capture_output=True, text=True, timeout=300, encoding="utf-8", cwd=REPO)
            linie = [l for l in (out.stdout or "").strip().splitlines() if l.strip()]
            dane = json.loads(linie[-1]) if linie else {}
            if "pominiete" in dane:
                print("SKIP  dźwięk w Chromium: " + dane["pominiete"])
            else:
                for n, ok, det in dane.get("checks", []):
                    check("Chromium: " + n, ok, det)
                if not dane.get("checks"):
                    check("Chromium: harness zwrócił wyniki", False, (out.stdout or "")[-800:] + (out.stderr or "")[-800:])
        except Exception as e:
            check("Chromium: harness uruchamia się", False, str(e))


if __name__ == "__main__":
    main()
    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1 if _failed else 0)
