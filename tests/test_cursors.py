# KURSORY „DŁOŃ Z PIANKI". Uruchom: py tests/test_cursors.py
#
# Trzy katalogi, każdy z innego powodu:
#   * assets/cursor/       — duże źródła (256 px), z których wycięto kursory; nazwy jak w aplikacji,
#   * web/assets/cursor/   — kursory aplikacji (rf-04-asset-cursor.js) i gry (web/gry/gry.css),
#   * docs/assets/cursor/  — kopie dla strony projektu: GitHub Pages serwuje tylko docs/, więc
#                            strona nie może sięgnąć do web/.
# Test pilnuje, żeby kopie na stronie nie rozjechały się z aplikacją (bajt w bajt), żeby każdy
# kursor, o który prosi kod, istniał, i żeby w katalogach nie leżało nic, czego nikt nie używa.
#
# RIBBITBEAT (10-19). Gra bierze te same rysunki, ale SAMYM CSS-em i ŚCIEŻKĄ WZGLĘDNĄ, bo chodzi pod
# trzema adresami: /web/gry/ (aplikacja), /gry/ (RibbitBeat.exe) i /gry/ (tools/gry_serwer.py).
# Ścieżka bezwzględna panelu („/web/assets/…”) działa tylko w pierwszym, więc test tego pilnuje —
# razem z punktem czułym, bez którego kliknięcie ląduje kilkanaście pikseli obok palca.
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web", "assets", "cursor")
DOCS = os.path.join(ROOT, "docs", "assets", "cursor")
SRC = os.path.join(ROOT, "assets", "cursor")
_passed = _failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


def czytaj(*p):
    with io.open(os.path.join(ROOT, *p), encoding="utf-8") as f:
        return f.read()


app = set(re.findall(r"cursor/([\w-]+\.png)", czytaj("web", "js", "rf-04-asset-cursor.js")))
strona = set(re.findall(r"assets/cursor/([\w-]+\.png)", czytaj("docs", "index.html")))
gra_css = czytaj("web", "gry", "gry.css")
gra = set(re.findall(r"cursor/([\w-]+\.png)", gra_css))

print("--- aplikacja ---")
check("rf-04 prosi o kursory", len(app) >= 5, app)
check("każdy kursor aplikacji istnieje", all(os.path.exists(os.path.join(WEB, f)) for f in app),
      [f for f in app if not os.path.exists(os.path.join(WEB, f))])
check("w web/assets/cursor nie ma nieużywanych plików", set(os.listdir(WEB)) <= (app | gra),
      set(os.listdir(WEB)) - (app | gra))

print("\n--- RibbitBeat (web/gry/gry.css) ---")
check("gra prosi o kursory", len(gra) >= 5, gra)
check("każdy kursor gry istnieje", all(os.path.exists(os.path.join(WEB, f)) for f in gra),
      [f for f in gra if not os.path.exists(os.path.join(WEB, f))])
# gra chodzi pod /gry/ i pod /web/gry/, więc ścieżka MUSI być względna wobec web/gry/gry.css
zle_sciezki = [u for u in re.findall(r"url\(([^)]*cursor/[\w-]+\.png)\)", gra_css)
               if u.strip("'\"") != "../assets/cursor/" + u.strip("'\"").rsplit("/", 1)[-1]]
check("gra sięga po kursory ścieżką względną ../assets/cursor/…", not zle_sciezki, zle_sciezki)
# bez punktu czułego przeglądarka bierze lewy górny róg obrazka
bez_punktu = re.findall(r"url\(\.\./assets/cursor/[\w-]+\.png\)(?!\s*-?\d+\s+-?\d+)", gra_css)
check("każdy kursor gry ma podany punkt czuły", not bez_punktu, bez_punktu)
# mysz jest instrumentem: nad płótnami gry kursor znika, ale HUD i pauza (nad nimi) zostają klikalne
check("nad polem gry kursor znika (#gra .plotno)", re.search(r"#gra\s+\.plotno\{cursor:none", gra_css) is not None)

print("\n--- strona projektu ---")
check("strona ma otwartą dłoń (przesuwalny zrzut) i pięść (przeciąganie)",
      {"hand-hover-36.png", "hand-grab-36.png"} <= strona, strona)
check("każdy kursor strony istnieje w docs/", all(os.path.exists(os.path.join(DOCS, f)) for f in strona),
      [f for f in strona if not os.path.exists(os.path.join(DOCS, f))])
check("w docs/assets/cursor nie ma nieużywanych plików", set(os.listdir(DOCS)) <= strona, set(os.listdir(DOCS)) - strona)
rozne = [f for f in os.listdir(DOCS)
         if not os.path.exists(os.path.join(WEB, f))
         or open(os.path.join(DOCS, f), "rb").read() != open(os.path.join(WEB, f), "rb").read()]
check("kopie na stronie = kursory aplikacji, bajt w bajt", not rozne, rozne)

print("\n--- źródła ---")
zrodla = set(os.listdir(SRC))
check("źródła nazwane jak kursory (hand-*.png)", all(re.fullmatch(r"hand-[\w-]+\.png", f) for f in zrodla), zrodla)
bez = sorted({re.sub(r"-\d+\.png$", ".png", f).replace("-hot", "") for f in app} - zrodla)
check("każdy kursor aplikacji ma źródło", not bez, bez)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
