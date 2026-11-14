# Test PIĘTER WIDOCZNOŚCI (UX 261120 L1). Run: py tests/test_tiers.py
#
# Mechanizm (web/js/rf-28d-tiers.js): zwijak `details.cardfold` jako piętro 2 („Ustawiasz raz”,
# podsumowanie wartości i „zmienione: N” w nagłówku, „Przywróć domyślne” z „Cofnij”) albo piętro 3
# (`cardfold.adv`, „Zaawansowane”), plus preferencja „Rozwijaj wszystkie ustawienia”.
#
# Część statyczna pilnuje tego, co da się zepsuć bez uruchamiania strony: każdy zwijak ma nagłówek
# `summary` (bez niego nie ma gdzie pokazać stanu, a reguła mówi, że chowanie nie chowa zmian),
# skrypt stoi w panelu po rfFold/rfUndo i przed modułami, karta preferencji jest w starcie panelu,
# napisy mają klucze EN. Część żywa to tests/tiers_harness.mjs (Playwright, bez instancji).
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


def read(*p):
    with open(os.path.join(WEB, *p), encoding="utf-8") as f:
        return f.read()


html = read("ribbitflip_dashboard.html")
tiers = read("js", "rf-28d-tiers.js")
i18n = read("js", "rf-01-i18n.js")
boot = read("js", "rf-40-boot.js")

# --- każdy cardfold ma summary --------------------------------------------------------------
# Szablony HTML (panel i napisy w JS): po znaczniku <details … cardfold …> pierwszym elementem
# ma być <summary>. Między nimi wolno stać tylko białym znakom, sklejeniom napisów ('+')
# i komentarzom (HTML i // w JS).
DET = re.compile(r"<details\b[^>]*\bclass\s*=\s*[\"'][^\"']*\bcardfold(?![-\w])[^>]*>", re.S)
GLUE = re.compile(r"^(?:\s|['\"`+]|//[^\n]*\n|<!--.*?-->)*<summary\b", re.S)
bad = []
sources = [("ribbitflip_dashboard.html", html)]
for fn in sorted(os.listdir(os.path.join(WEB, "js"))):
    if fn.endswith(".js"):
        sources.append((fn, read("js", fn)))
count = 0
for name, src in sources:
    for m in DET.finditer(src):
        count += 1
        if not GLUE.match(src[m.end():m.end() + 400]):
            bad.append("%s:%d" % (name, src.count("\n", 0, m.start()) + 1))
check("szablony: znaleziono zwijaki cardfold", count >= 5, count)
check("szablony: każdy <details class=cardfold> zaczyna się od <summary>", not bad, bad)

# Zwijaki składane createElement("details") + className="cardfold…": summary dopisane obok.
bad = []
for name, src in sources:
    for m in re.finditer(r"className\s*=\s*[\"']cardfold(?![-\w])", src):
        near = src[max(0, m.start() - 300):m.end() + 600]
        if "createElement(\"details\")" not in near and "createElement('details')" not in near:
            continue
        if "summary" not in src[m.end():m.end() + 600]:
            bad.append("%s:%d" % (name, src.count("\n", 0, m.start()) + 1))
check("createElement: zwijak cardfold dostaje summary", not bad, bad)

# --- skrypt w panelu, we właściwej kolejności -----------------------------------------------
pos = {k: html.find('/web/js/%s"' % k) for k in ("rf-06-modals.js", "rf-28d-tiers.js", "rf-31e-mouse-ready.js", "rf-40-boot.js")}
check("panel ładuje rf-28d-tiers.js", pos["rf-28d-tiers.js"] > 0, pos)
check("rf-28d po rf-06 (rfFold, rfUndo) i przed modułami (Mysz) oraz startem",
      0 < pos["rf-06-modals.js"] < pos["rf-28d-tiers.js"] < pos["rf-31e-mouse-ready.js"] < pos["rf-40-boot.js"], pos)
check("start panelu tworzy kartę „Wygląd panelu” (initFoldPrefCard)", "initFoldPrefCard" in boot)
check("API: rfTier, rfTier.sync, rfTier.audit, rfFoldAllOn",
      all(s in tiers for s in ("window.rfTier =", "window.rfTier.sync", "window.rfTier.audit", "window.rfFoldAllOn")))
check("preferencja w localStorage ribbitflip.foldAll", '"ribbitflip.foldAll"' in tiers)
check("rfFold respektuje „Rozwijaj wszystkie ustawienia”", "rfFoldAllOn" in read("js", "rf-06-modals.js"))

# --- napisy -----------------------------------------------------------------------------------
for pl in ("Wygląd panelu", "Rozwijaj wszystkie ustawienia",
           "Zwinięte bloki ustawień startują otwarte. Niczego nie dodaje ani nie wyłącza."):
    check("klucz EN: %s" % pl, ('"%s":' % pl) in i18n)
check("napisy mechanizmu w obu językach (T(pl,en))",
      all(s in tiers for s in ('T("zmienione: ", "changed: ")', 'T("Przywróć domyślne", "Restore defaults")')))
check("bez myślnika-pauzy w napisach mechanizmu",
      not re.search(r'T\("[^"]*—', tiers))

# --- wzorzec na ekranie Mysz ------------------------------------------------------------------
mouse = read("js", "rf-31e-mouse-ready.js")
check("Mysz: „Dostrajanie ruchu” jest piętrem (rfTier z reset/take/restore)",
      re.search(r"rfTier\(document\.getElementById\(\"mTune\"\)", mouse) is not None
      and all(k in mouse for k in ("reset:", "take:", "restore:", "changed:")))

# --- część żywa -------------------------------------------------------------------------------
node = shutil.which("node")
if not node:
    print("SKIP  tiers_harness.mjs (brak node)")
else:
    r = subprocess.run([node, os.path.join(ROOT, "tests", "tiers_harness.mjs")], capture_output=True,
                       text=True, encoding="utf-8", errors="replace", timeout=180)
    out = (r.stdout or "") + (r.stderr or "")
    if "SKIP" in out and "0 passed, 0 failed" in out:
        print("SKIP  tiers_harness.mjs (brak @playwright/test)")
    else:
        for line in out.splitlines():
            if line.startswith(("PASS", "FAIL")):
                check("przeglądarka: " + line[6:].strip(), line.startswith("PASS"))
        check("przeglądarka: harness zakończył się bez błędu", r.returncode == 0, out[-600:])

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
