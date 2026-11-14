# PAUZY W SŁOWNIKU RAMY. Uruchom: py tests/test_ui_dashes.py
#
# Teksty ramy (nawigacja, pasek górny, karta stanu, widoczność modułów, przewodnik, „Kup mi kawę”)
# piszemy bez myślników-pauz (—): w panelu czytają się jak szew między dwoma zdaniami, które powinny
# być osobno albo połączone dwukropkiem. Przegląd UX 2026-11-20 (P-G0-14) wyczyścił ramę; ten test
# pilnuje, żeby pauza do niej nie wróciła. Sprawdza WYŁĄCZNIE napisy (literały w kodzie bez
# komentarzy, atrybuty paska górnego, klucze sekcji ramy w słowniku), nie komentarze ani moduły.
#
# Nic tu nie potrzebuje serwera ani przeglądarki.
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(ROOT, "web", "js")
try:
    sys.stdout.reconfigure(errors="replace")
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
        print("FAIL  %s%s" % (name, ("  -- " + str(detail)[:600]) if detail else ""))


def read(p):
    with io.open(p, "r", encoding="utf-8") as f:
        return f.read()


def strip_comments(src):
    """Usuwa komentarze // i /* */ poza literałami napisowymi."""
    out, i, n, q = [], 0, len(src), None
    while i < n:
        c = src[i]
        if q:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(src[i + 1]); i += 2; continue
            if c == q:
                q = None
            i += 1; continue
        if c in "\"'`":
            q = c; out.append(c); i += 1; continue
        if src.startswith("//", i):
            j = src.find("\n", i); i = n if j < 0 else j; continue
        if src.startswith("/*", i):
            j = src.find("*/", i + 2); i = n if j < 0 else j + 2; continue
        out.append(c); i += 1
    return "".join(out)


STR = re.compile(r'"((?:[^"\\\n]|\\.)*)"|\'((?:[^\'\\\n]|\\.)*)\'|`((?:[^`\\]|\\.)*)`', re.S)


def literals(src):
    for m in STR.finditer(strip_comments(src)):
        yield next(g for g in m.groups() if g is not None)


def dashed(strings):
    return [s[:90] for s in strings if "—" in s]


# 1. Pliki ramy w całości (same napisy).
for fn in ["rf-34b-cols.js", "rf-48-tabvis.js", "rf-39p-tour.js", "rf-39e-kofi.js"]:
    bad = dashed(literals(read(os.path.join(JS, fn))))
    check("%s: napisy bez pauz" % fn, not bad, bad)

# 2. rf-34-tabs.js trzyma też poradnik Mapowania, więc tylko rejestr TABS i dymki kropek.
tabs = read(os.path.join(JS, "rf-34-tabs.js"))
blk = tabs[tabs.index("const TABS=["):tabs.index("];", tabs.index("const TABS=["))]
check("rf-34 TABS: etykiety i dymki bez pauz", not dashed(literals(blk)), dashed(literals(blk)))
dots = tabs[tabs.index("function updateTabDots(){"):tabs.index("window.updateTabDots=updateTabDots;")]
check("rf-34 updateTabDots: dymki kropek bez pauz", not dashed(literals(dots)), dashed(literals(dots)))
check("rf-34: nazwa dostępna pozycji skleja napis i dymek dwukropkiem",
      'b.setAttribute("aria-label",t.label+": "+' in tabs)

# 3. rf-49m: podpowiedzi pod-zakładek i ich sklejenie z nazwą.
mt = read(os.path.join(JS, "rf-49m-modtabs.js"))
panes = mt[mt.index("const PANES = ["):mt.index("];", mt.index("const PANES = ["))]
check("rf-49m PANES: podpowiedzi bez pauz", not dashed(literals(panes)), dashed(literals(panes)))
check("rf-49m: dymek zakładki skleja nazwę i podpowiedź dwukropkiem",
      'b.title = _t(p.pl, p.en) + ": " + _t(p.hint[0], p.hint[1]);' in mt)

# 4. Pasek górny w HTML: title i aria-label.
html = read(os.path.join(ROOT, "web", "ribbitflip_dashboard.html"))
hdr = html[html.index("<header>"):html.index("</header>")]
attrs = re.findall(r'(?:title|aria-label)="([^"]*)"', hdr)
check("pasek górny: dymki i nazwy dostępne bez pauz", attrs and not dashed(attrs), dashed(attrs))

# 5. Słownik: klucze sekcji ramy (UX 261120 A2) bez pauz.
i18n = read(os.path.join(JS, "rf-01-i18n.js"))
a2 = i18n[i18n.index("// ===== UX 261120 A2"):i18n.index("// (koniec sekcji A2)")]
keys = re.findall(r'^\s*"((?:[^"\\]|\\.)*)"\s*:', a2, re.M) + re.findall(r',"((?:[^"\\]|\\.)*)"\s*:', a2)
check("rf-01 sekcja A2: %d kluczy, żaden z pauzą" % len(keys), keys and not dashed(keys), dashed(keys))

# 6. Zdjęte zdania z pauzą nie wracają do słownika ani do ramy.
GONE = ["Ściąga wszystkich kapsli — i stąd wypuszczasz okna nad grę",
        "Ustawienia samego programu — stop awaryjny, serwer MCP dla asystentów AI, zgłoszenie problemu",
        "Włączony — wspólny dla wszystkich kapsli", "Wyłączony — wspólny dla wszystkich kapsli",
        "Przewodnik po panelu — pokaże krok po kroku, gdzie co jest",
        "Tryb pracy — kliknij, aby przełączyć (restart aplikacji)"]
back = [g for g in GONE if g in i18n or g in tabs or g in html or g in mt]
check("zdjęte zdania z pauzą nie wróciły", not back, back)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
