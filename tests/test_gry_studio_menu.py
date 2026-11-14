# RibbitBeat (web/gry/): zakryty przycisk „Studio instrumentów” w menu. Run: py tests/test_gry_studio_menu.py
#
# Wymaganie: „studio instrumentów w menu niech będzie od początku widoczne ale zakryte
# i z informacją »Graj więcej aby odblokować« 🙂 takie czarne holo połyskujące”.
#
# Co pilnuje:
#  1. kod: Studio.odswiez() nie chowa przycisku, tylko przełącza .holo / .zakryte i aria-disabled; podpis ma napis po polsku
#     i po angielsku; ikona sekretu dostaje `czekaj` (przygaszony „?”, aż Studio się odblokuje); CSS ma stan .zakryte;
#     w HTML przycisk startuje jako `hidden`, żeby bez js/studio.js nic nie wisiało w menu,
#  2. w prawdziwej przeglądarce (tests/gry_studio_menu.mjs, Chromium + Playwright): świeży profil = widoczny, zakryty,
#     z podpisem i kłódką, czarny filc, klik nic nie otwiera; po odblokowaniu = holo, podpis schowany, klik otwiera Studio;
#     ?odblokuj=1 = holo od razu.
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
    st = czytaj("js", "studio.js")
    css = czytaj("gry-studio.css")
    html = czytaj("index.html")

    # ---- 1. kod ------------------------------------------------------------------------------------------------
    check("studio.js: podpis zakrytego przycisku po polsku i po angielsku",
          'menuZakryte:L("Graj więcej, aby odblokować","Play more to unlock")' in st)
    check("studio.js: odswiez() nie chowa przycisku, tylko przełącza .holo / .zakryte i aria-disabled",
          'b.hidden=false;b.classList.toggle("holo",d);b.classList.toggle("zakryte",!d);b.setAttribute("aria-disabled",d?"false":"true")' in st
          and "b.hidden=!d" not in st)
    check("studio.js: zakryty przycisk pokazuje „???” zamiast nazwy, nazwa wraca po odblokowaniu",
          'nz.textContent=d?TX.menu:"???"' in st)
    check("studio.js: ikona sekretu czeka z przygaszonym „?”, aż Studio się odblokuje (czekaj)",
          'StudioIkona.zbuduj({rozmiar:"mala",czekaj:()=>!dostepne()})' in st)
    check("studio.js: nazwa i podpis to osobne spany, kłódka z zabi-chor.js (ZC_KLODKA) wstawiana w odswiez()",
          't.className="st-menu-nazwa"' in st and 'p.className="st-menu-podpis"' in st and 'kl.className="st-menu-klodka"' in st
          and 'kl.innerHTML=ZC_KLODKA' in st)
    check("studio.js: klik otwiera Studio tylko, gdy jest dostępne",
          re.search(r'b\.onclick=\(\)=>\{if\(dostepne\(\)&&typeof pokazLobby==="function"\)pokazLobby\("studioEkran"\);\};', st) is not None)
    check("gry-studio.css: stan .zakryte — czarny filc, połysk, podpis widoczny tylko w tym stanie",
          "#btnStudio.zakryte{" in css and "#btnStudio .st-menu-podpis{display:none}" in css
          and "#btnStudio.zakryte .st-menu-podpis{display:flex" in css and "#btnStudio.zakryte{animation:stHolo" in css)
    check("index.html: przycisk startuje jako hidden (bez js/studio.js nic nie wisi w menu)",
          re.search(r'<button id="btnStudio" class="menu-przycisk" type="button" hidden></button>', html) is not None)

    # ---- 2. prawdziwa przeglądarka -------------------------------------------------------------------------------
    node = shutil.which("node")
    if not node:
        print("SKIP  testy w przeglądarce   brak node w PATH")
        return
    r = subprocess.run([node, "--check", os.path.join(GRY, "js", "studio.js")], capture_output=True, text=True, encoding="utf-8")
    check("node --check web/gry/js/studio.js", r.returncode == 0, (r.stderr or "")[:400])

    harness = os.path.join(REPO, "tests", "gry_studio_menu.mjs")
    try:
        out = subprocess.run([node, harness], capture_output=True, text=True, timeout=300, encoding="utf-8")
        dane = json.loads(out.stdout.strip().splitlines()[-1])
    except Exception as e:
        check("gry_studio_menu.mjs zwraca JSON", False, str(e)[:400])
        return
    if "pominiete" in dane:
        print("SKIP  zakryte Studio w przeglądarce: " + dane["pominiete"])
        return
    for nazwa, ok, szczegol in dane.get("checks", []):
        check(nazwa, ok, szczegol)


if __name__ == "__main__":
    main()
    print("\n%d passed, %d failed" % (_passed, _failed))
    sys.exit(1 if _failed else 0)
