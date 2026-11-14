# RibbitBeat: pole „Zaśpiewaj” w Studiu instrumentów (2026-10-21).
# Run: py tests/test_gry_spiew.py
#
# Klawiatura Studia daje trzynaście nut i nic nie mówi o tym, co instrument robi POMIĘDZY nimi. Pole
# „Zaśpiewaj” prowadzi wysokość myszą tak, jak tor w grze — i o to właśnie chodzi w tym teście: żeby
# „tak, jak w grze” było PRAWDĄ, a nie deklaracją.
#
# Największe zagrożenie dla tej funkcji nie jest techniczne, tylko redakcyjne: ktoś (albo ja za pół roku)
# przepisze wzór myszy do studio.js „żeby było pod ręką”, gra zmieni swój — i pole zacznie uczyć złych
# odruchów, nie wywalając się ani razu. Dlatego test pilnuje, że studio.js NIE MA własnych kopii, tylko
# woła funkcje gry, i że bierze ustawienia gracza, a nie własne liczby.
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(REPO, "web", "gry", "js")

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
    studio = czytaj(JS, "studio.js")
    zabi = czytaj(JS, "zabi-chor.js")
    html = czytaj(REPO, "web", "gry", "index.html")
    css = czytaj(REPO, "web", "gry", "gry-studio.css")

    # ---- 1. mapowanie jest WOŁANE z gry, nie przepisane ----------------------------------------
    for nazwa in ("stopnieNaPolton", "wygladzEMA"):
        check("zabi-chor.js wystawia `%s` jako funkcję globalną" % nazwa,
              ("\nfunction %s(" % nazwa) in zabi)
        check("studio.js woła `%s` z gry, zamiast mieć własną kopię" % nazwa,
              (nazwa + "(") in studio and ("function %s(" % nazwa) not in studio)
    check("index.html ładuje zabi-chor.js PRZED studio.js (inaczej tych funkcji jeszcze nie ma)",
          html.index('src="js/zabi-chor.js"') < html.index('src="js/studio.js"'))

    # ---- 2. liczby pochodzą z gry i z ustawień gracza -------------------------------------------
    check("zakres myszy to USTAWIENIE GRACZA (`S.ust.zakres`), nie stała w Studiu",
          "S.ust.zakres" in studio)
    check("„odwróć” gracza też jest respektowane (`S.ust.odwroc`)", "S.ust.odwroc" in studio)
    check("próg wibrata to `ZC_PUNKTY.WIB_PROG`, nie wklejona liczba", "ZC_PUNKTY.WIB_PROG" in studio)
    check("otwarcie filtra liczone tym samym wzorem, co w `krokGracza` (.35 + .5·poz)",
          ".35+.5*" in studio and ".35+.5*" in zabi)
    check("stałe czasowe wygładzania takie jak w grze (0,06 s wysokość, 0,12 s wibrato)",
          "SPIEW_TAU_P=.06" in studio and "SPIEW_TAU_W=.12" in studio
          and ",.06)" in zabi and ",.12)" in zabi)
    check("wibrato z myszy liczone jak w wejscie.js (prędkość pozioma × 0,5, wygładzana 0,6/0,4)",
          "SPIEW_WIB_MYSZ=.5" in studio and ".6*spiew.vx+.4*" in studio)

    # ---- 3. higiena: głos i pętla klatek nie zostają po wyjściu ---------------------------------
    check("wyjście ze Studia gasi śpiewanie (`spiewStop` w `zamknijEkran`)",
          "function zamknijEkran(" in studio
          and studio.index("function zamknijEkran(") < studio.index("spiewStop();if(spiew.raf)"))
    check("pętla klatek chodzi TYLKO w trakcie śpiewania",
          "spiew.raf=spiew.gra?requestAnimationFrame(spiewKlatka):0" in studio)
    check("puszczenie myszy zwalnia głos przez `puść` (ta sama droga, co klawisze)",
          'puść("spiew",true)' in studio)
    check("wysokość kolumny lampy uwzględnia pole (inaczej lampa liczy się jakby go nie było)",
          "refy.spiew?refy.spiew.pole.offsetHeight" in studio)

    # ---- 4. CSS: pasek musi mieć wysokość i łapać palec -----------------------------------------
    check(".st-spiew ma `flex:none` (w kolumnie flex skurczyłby się do zera)",
          ".st-spiew{flex:none" in css)
    check(".st-spiew ma `touch-action:none` (bez tego palec przewija ekran zamiast prowadzić nutę)",
          "touch-action:none" in css.split(".st-spiew{")[1].split("}")[0])

    # ---- 5. składnia ----------------------------------------------------------------------------
    node = shutil_which("node")
    if not node:
        print("SKIP  node --check (brak Node)")
        return
    r = subprocess.run([node, "--check", os.path.join(JS, "studio.js")], capture_output=True, text=True)
    check("node --check web/gry/js/studio.js", r.returncode == 0, (r.stderr or "")[:300])


def shutil_which(x):
    import shutil
    return shutil.which(x)


if __name__ == "__main__":
    main()
    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1 if _failed else 0)
