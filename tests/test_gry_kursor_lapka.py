# RibbitBeat (web/gry/): sterowanie menu kapslem i padem, kursor z żabią łapką. Run: py tests/test_gry_kursor_lapka.py
#
# Kapsel i pad prowadzą w menu łapkę (js/kursor-lapka.js). Od 11-20 to jedyny tryb: przełącznika „Skoki/Łapka”
# w stopce już nie ma, bo przechył kapsla skaczący fokusem robił w menu chaos.
#
# Co pilnuje:
#  1. podpięcie: plik stylu i skrypt w index.html (skrypt PO zabi-chor.js), brak przełącznika w stopce; łapka to te same
#     rysunki i punkty kliknięcia co wskaźnik myszy gry (gry.css), a samego wskaźnika myszy moduł nie zmienia,
#  2. styki z resztą gry: krokPilotow oddaje kapsel łapce tylko w zwykłym menu (nie w samouczku i nie na polach
#     karty w kroku Rozgrywka), a pad w menu oddaje jej lewą gałkę i przycisk A,
#  3. napisy przełącznika w obu językach,
#  4. czyste funkcje modułu (node): przechył → punkt ekranu, gałka → prędkość, suwak → wartość,
#  5. prawdziwa przeglądarka (tests/gry_kursor_lapka.mjs, Chromium + Playwright): łapka kapsla i pada, kliknięcie,
#     cofanie, przewijanie listy, wygaszenie w kroku Rozgrywka i powrót do skoków.
# Brak Node albo globalnego @playwright/test = SKIP sprawdzeń w przeglądarce (nie udawane).
import json
import os
import re
import shutil
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRY = os.path.join(REPO, "web", "gry")

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
    with open(os.path.join(GRY, *czesci), encoding="utf-8") as f:
        return f.read()


def main():
    html = czytaj("index.html")
    zc = czytaj("js", "zabi-chor.js")
    wej = czytaj("js", "wejscie.js")
    en = czytaj("js", "jezyk-en.js")
    css = czytaj("gry-kursor.css")

    # ---- 1. podpięcie ------------------------------------------------------------------------------------------
    check("index.html ładuje gry-kursor.css", '<link rel="stylesheet" href="gry-kursor.css">' in html)
    check("index.html ładuje js/kursor-lapka.js po zabi-chor.js",
          0 < html.find('src="js/zabi-chor.js"') < html.find('src="js/kursor-lapka.js"'))
    check("stopka menu nie ma przełącznika Skoki/Łapka (od 11-20 łapka to jedyny tryb kapsla)", 'id="menuSterowanie"' not in html)
    check("moduł nie zmienia wskaźnika myszy (gra ma swój, blok „KURSOR” w gry.css)", "cursor:url" not in css and "cursor:var" not in css)
    gry_css = czytaj("gry.css")
    for plik, bok, punkt in [("hand-idle-36.png", 36, "15 3"), ("hand-idle-hot-38.png", 38, "16 4"), ("hand-press-36.png", 36, "15 3")]:
        x, y = punkt.split()
        check("poza łapki %s: ten sam plik i punkt kliknięcia (%s) co wskaźnik myszy w gry.css" % (plik, punkt),
              os.path.isfile(os.path.join(REPO, "web", "assets", "cursor", plik)) and
              ("cursor:url(../assets/cursor/%s) %s, auto !important" % (plik, punkt)) in gry_css and
              ('plik:"%s",bok:%d,punkt:[%s,%s]' % (plik, bok, x, y)) in czytaj("js", "kursor-lapka.js"))
    check("numerek gracza stoi na kółku w kolorze kapsla (--kolor), z napisem dobranym do tła (--napis)",
          re.search(r"\.lapka-nr\{[^}]*background:var\(--kolor[^}]*color:var\(--napis", css) is not None)
    check("łapka nie łapie kliknięć (pointer-events:none)", re.search(r"\.lapka\{[^}]*pointer-events:none", css) is not None)

    # ---- 2. styki ----------------------------------------------------------------------------------------------
    m = re.search(r"function krokPilotow\(dt\)\{.*?\n\}", zc, re.S)
    pilot = m.group(0) if m else ""
    hak = "if(!dymek&&typeof KursorLapka!==\"undefined\"&&KursorLapka.aktywny()){"
    check("krokPilotow oddaje kapsel łapce w menu i w kroku Rozgrywka (nie w samouczku)", hak in pilot and "KursorLapka.krokKapsla(w,z,dt);continue;}" in pilot)
    check("…i robi to PRZED odsianiem klatek bez zdarzeń (łapka rusza się co klatkę)",
          0 < pilot.find(hak) < pilot.find("if(!(z.gora||z.dol||z.lewo||z.prawo||z.ok||z.wstecz))continue;"))
    check("…a po obsłudze dźwigni koła nagród (tam przycisk nie klika)", 0 < pilot.find("Nagrody.przytrzymaj(dol,w.id)") < pilot.find(hak))
    m = re.search(r"function krokPadaWMenu\(p,teraz,przed,sek\)\{.*?\n  \}", wej, re.S)
    pad = m.group(0) if m else ""
    check("pad w menu pyta łapkę, czy przejmuje gałkę i A", "KursorLapka.przejmujePada()" in pad and "KursorLapka.krokPada(p)" in pad)
    check("A na padzie klika łapką, a bez widocznej łapki po staremu („ok”)",
          'if(teraz[0]&&!przed[0]&&!(lapka&&KursorLapka.klik("pad-"+p.index)))akcjaMenu("ok");' in pad)
    check("gałka w trybie łapki nie skacze fokusem, krzyżak tak", "if(!kier&&!lapka){" in pad and "for(const i in PAD.KRZYZAK)if(teraz[i])kier=PAD.KRZYZAK[i];" in pad)

    # ---- 3. napisy ---------------------------------------------------------------------------------------------
    klucze = ["sterEtykieta", "sterAria", "sterFokus", "sterKursor", "sterOpisFokus", "sterOpisKursor"]
    check("napisów dawnego przełącznika nie ma (PL i EN)", not any(re.search(r"%s:\"" % k, zc + en) for k in klucze))

    # ---- 4. czyste funkcje -------------------------------------------------------------------------------------
    node = shutil.which("node")
    if not node:
        print("SKIP  node --check, funkcje modułu i test w przeglądarce   brak node w PATH")
        return
    for plik in ["kursor-lapka.js", "wejscie.js", "zabi-chor.js"]:
        r = subprocess.run([node, "--check", os.path.join(GRY, "js", plik)], capture_output=True, text=True, encoding="utf-8")
        check("node --check web/gry/js/" + plik, r.returncode == 0, (r.stderr or "")[:400])
    skrypt = """
const K=require(%s);const C=K.C,w=[];
const p=(a,b)=>K.pozaNaEkran(a,b,1000,600);
w.push(["kapsel płasko = środek ekranu",p(0,0).x===500&&p(0,0).y===300]);
w.push(["przechył w bok do zakresu = prawy brzeg, dalej już nie wychodzi",p(0,C.ZAKRES_X).x===999&&p(0,C.ZAKRES_X*3).x===999]);
w.push(["dodatni pitch spycha łapkę w dół, ujemny do góry",p(C.ZAKRES_Y,0).y===599&&p(-C.ZAKRES_Y,0).y===0]);
w.push(["połowa zakresu = ćwierć ekranu od środka",Math.abs(p(0,-C.ZAKRES_X/2).x-250)<1e-9]);
w.push(["gałka w martwej strefie stoi",K.osGalki(C.PAD_MARTWA*.9)===0&&K.osGalki(-C.PAD_MARTWA*.9)===0]);
w.push(["gałka do oporu = pełna prędkość, ze znakiem",K.osGalki(1)===1&&K.osGalki(-1)===-1]);
w.push(["małe wychylenie gałki jest wolniejsze niż liniowe (precyzja)",K.osGalki(.5)>0&&K.osGalki(.5)<(.5-C.PAD_MARTWA)/(1-C.PAD_MARTWA)]);
w.push(["suwak: środek 0..100 = 50, krok 5 dociąga",K.wartoscSuwaka("0","100","1",.5)===50&&K.wartoscSuwaka("0","100","5",.52)===50]);
w.push(["suwak: brak max = 100, wartość nie wychodzi poza zakres",K.wartoscSuwaka("","","",2)===100&&K.wartoscSuwaka("10","20","1",-1)===10]);
w.push(["moduł startuje w trybie łapki (jedynym dla gracza)",K.tryb()==="kursor"&&K.aktywny()&&K.przejmujePada()]);
w.push(["napis numerka: ciemny na jasnym kapslu, biały na ciemnym",K.kolorNapisu("#f0a92c")==="#1b1917"&&K.kolorNapisu("#294aa8")==="#ffffff"&&K.kolorNapisu("zielony")==="#ffffff"]);
console.log(JSON.stringify(w));
""" % json.dumps(os.path.join(GRY, "js", "kursor-lapka.js"))
    r = subprocess.run([node, "-e", skrypt], capture_output=True, text=True, encoding="utf-8")
    try:
        for nazwa, ok in json.loads(r.stdout.strip().splitlines()[-1]):
            check(nazwa, ok)
    except Exception as e:
        check("funkcje modułu liczą się w node", False, (str(e) + " " + (r.stderr or ""))[:400])

    # ---- 5. prawdziwa przeglądarka -----------------------------------------------------------------------------
    harness = os.path.join(REPO, "tests", "gry_kursor_lapka.mjs")
    try:
        out = subprocess.run([node, harness], capture_output=True, text=True, timeout=420, encoding="utf-8")
        dane = json.loads(out.stdout.strip().splitlines()[-1])
    except Exception as e:
        check("gry_kursor_lapka.mjs zwraca JSON", False, str(e)[:400])
        return
    if "pominiete" in dane:
        print("SKIP  łapka w przeglądarce: " + dane["pominiete"])
        return
    for nazwa, ok, szczegol in dane.get("checks", []):
        check(nazwa, ok, szczegol)


if __name__ == "__main__":
    main()
    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1 if _failed else 0)
