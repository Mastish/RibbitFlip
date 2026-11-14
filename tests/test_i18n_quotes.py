# HIGIENA SŁOWNIKA I18N: jeden styl cudzysłowów. Uruchom: py tests/test_i18n_quotes.py
#
# Zasada (plan UX, iteracja 2, pozycja 2.13): po polsku ZAWSZE „…”, po angielsku ZAWSZE “…”.
# Przed tą zmianą obok siebie stały trzy zapisy — PL „…" (ASCII zamykający), PL „…” oraz EN „…” /
# “…” — i na jednym ekranie (OSC, Kontroler, Połączenie, Mapowanie › Informacje) widać było dwa
# style naraz. Klucz I18N_EN musi równać się tekstowi w DOM, więc cudzysłów w kluczu i w źródle
# HTML/JS zmienia się RAZEM (tools/fix_quotes.mjs) — ten test pilnuje, że nic nie wróciło do starego
# zapisu i że klucze dalej pasują do źródła.
#
# Co sprawdza (bez serwera i przeglądarki):
#   1. rf-01-i18n.js: żaden klucz PL nie zawiera „…\" (ASCII zamykający), żadna wartość EN nie
#      zawiera U+201E („); wzorce dynamiczne za słownikiem (m=>"…") też bez „ po stronie EN.
#   2. Słowniki modułowe RF_*_I18N (rf-39b, rf-41, rf-44, rf-49k, rf-49m…): wartości EN bez „.
#   3. Wywołania _gl(pl, en) i pomocników o tej sygnaturze (_ra3T, _wheelT, _cfgT, _dmL, _tvL…):
#      drugi argument (EN) bez „.
#   4. Widoczny HTML/JS panelu (web/js/rf-*.js + web/ribbitflip_dashboard.html) po odcięciu
#      komentarzy // /* */ <!-- -->: brak „X" (co najmniej jeden znak między „ a ASCII ").
#   5. tools/fix_quotes.mjs na sucho zgłasza 0 literałów do zmiany (skrypt jest idempotentny — to
#      dowód, że kod i skrypt mówią jednym głosem). Pomijane, gdy nie ma Node.
#
# Konsola Windows bez UTF-8 (cp1250) wywraca print() na znakach spoza strony kodowej — wypisujemy
# z zamianą zamiast padać; liczy się PASS/FAIL, nie glify.
import io
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
JS_DIR = os.path.join(WEB, "js")
I18N = os.path.join(JS_DIR, "rf-01-i18n.js")
DASH = os.path.join(WEB, "ribbitflip_dashboard.html")

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
        print("FAIL  %s%s" % (name, ("  -- " + str(detail)[:400]) if detail else ""))


def read(p):
    with io.open(p, "r", encoding="utf-8") as f:
        return f.read()


def strip_comments(src):
    """Usuwa komentarze // i /* */ POZA literałami napisowymi; zachowuje nowe linie (numery linii).
    Template `…${…}…` jest czytany z dziurami: kod w ${…} to znów kod (może mieć własne literały,
    także zagnieżdżone template'y z apostrofem — rf-16 ma `${…\\`The device's…\\`}`), więc stos ramek:
    "tpl" = wnętrze template'u, "hole" = kod w ${…} z licznikiem klamer."""
    out = []
    i, n = 0, len(src)
    stack = []                       # ramki: ["tpl"] | ["hole", depth]
    while i < n:
        c = src[i]
        top = stack[-1] if stack else None
        if top and top[0] == "tpl":
            if c == "\\" and i + 1 < n:
                out.append(src[i:i + 2]); i += 2; continue
            if c == "`":
                out.append(c); i += 1; stack.pop(); continue
            if c == "$" and src.startswith("${", i):
                out.append("${"); i += 2; stack.append(["hole", 0]); continue
            out.append(c); i += 1; continue
        # kod (na wierzchu albo w dziurze template'u)
        if c == "`":
            out.append(c); i += 1; stack.append(["tpl"]); continue
        if c in ('"', "'"):
            q = c
            out.append(c)
            i += 1
            while i < n and src[i] != q:
                if src[i] == "\\" and i + 1 < n:
                    out.append(src[i:i + 2])
                    i += 2
                    continue
                if src[i] == "\n":                  # urwany literał — nie wychodzimy poza linię
                    break
                out.append(src[i])
                i += 1
            if i < n and src[i] == q:
                out.append(q)
                i += 1
            continue
        if src.startswith("//", i):
            while i < n and src[i] != "\n":
                i += 1
            continue
        if src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append("\n" * src.count("\n", i, j))
            i = j
            continue
        if top and top[0] == "hole":
            if c == "{":
                top[1] += 1
            elif c == "}":
                if top[1] == 0:
                    stack.pop()
                else:
                    top[1] -= 1
        out.append(c)
        i += 1
    return "".join(out)


def strip_html_comments(src):
    return re.sub(r"<!--.*?-->", lambda m: "\n" * m.group(0).count("\n"), src, flags=re.S)


PAIR_RE = re.compile(r'"((?:[^"\\]|\\.)*)"\s*:\s*(?:"((?:[^"\\]|\\.)*)")?')


def literal_pairs(src, start_re, end_re=r"^\s*\};?\s*$"):
    """Pary (klucz, wartość|None, linia) literału obiektu od linii start_re do pierwszej linii end_re."""
    lines = src.split("\n")
    start = next((i for i, l in enumerate(lines) if re.search(start_re, l)), None)
    if start is None:
        return None
    end = next((i for i in range(start + 1, len(lines)) if re.match(end_re, lines[i])), len(lines))
    body = "\n".join(lines[start + 1:end])
    clean = strip_comments(body)
    pairs = []
    for m in PAIR_RE.finditer(clean):
        line = start + 2 + clean.count("\n", 0, m.start())
        pairs.append((m.group(1), m.group(2), line))
    return pairs, end


def lines_with(src, rx):
    return [(i + 1, l.strip()[:120]) for i, l in enumerate(src.split("\n")) if re.search(rx, l)]


# ---------------------------------------------------------------- 1. rf-01-i18n.js -----------
print("--- 1. rf-01-i18n.js: klucze „…”, wartości “…” ---")
src = read(I18N)
res = literal_pairs(src, r"^const I18N_EN=\{")
check("rf-01: literał I18N_EN znaleziony i ma > 2000 par", res is not None and len(res[0]) > 2000,
      None if res is None else len(res[0]))
pairs, dict_end = res if res else ([], 0)
bad_keys = [(l, k[:80]) for k, v, l in pairs if re.search(r'„[^„”"]*\\"', k)]
check("rf-01: żaden klucz PL nie zawiera „…\\\" (ASCII zamykający)", not bad_keys, bad_keys[:5])
bad_vals = [(l, v[:80]) for k, v, l in pairs if v and "„" in v]
check("rf-01: żadna wartość EN nie zawiera U+201E („)", not bad_vals, bad_vals[:5])
# wartość EN z ” bez otwierającego “ (np. „X” przepisane tylko w połowie)
# Wyjątek: cytat, który otwiera się w INNYM węźle tekstowym (rf-34: „pochylenie > 30 <b>ORAZ</b> … skok”)
# — wtedy klucz PL też ma ” bez „ i obie połówki są osobnymi parami.
half = [(l, v[:80]) for k, v, l in pairs if v and "”" in v and "“" not in v and not ("”" in k and "„" not in k)]
check("rf-01: żadna wartość EN nie ma ” bez “ (poza cytatem rozciętym na dwa węzły)", not half, half[:5])
tail = strip_comments("\n".join(src.split("\n")[dict_end:]))
dyn = lines_with(tail, r'=>\s*"[^"\n]*„')
check("rf-01: wzorce dynamiczne (m=>\"…\") po stronie EN bez „", not dyn, dyn[:5])

# ---------------------------------------------------------------- 2. słowniki modułowe --------
print("\n--- 2. słowniki modułowe RF_*_I18N ---")
js_files = sorted(f for f in os.listdir(JS_DIR) if re.match(r"rf-.*\.js$", f))
n_mod = 0
mod_bad = []
for fn in js_files:
    if fn == "rf-01-i18n.js":
        continue
    s = read(os.path.join(JS_DIR, fn))
    if not re.search(r"^\s*(const|var|let)\s+RF_[A-Z0-9_]*I18N\s*=\s*\{", s, re.M):
        continue
    r = literal_pairs(s, r"^\s*(const|var|let)\s+RF_[A-Z0-9_]*I18N\s*=\s*\{")
    if not r:
        continue
    n_mod += 1
    for k, v, l in r[0]:
        if v and "„" in v:
            mod_bad.append("%s:%d %s" % (fn, l, v[:60]))
        if re.search(r'„[^„”"]*\\"', k):
            mod_bad.append("%s:%d KEY %s" % (fn, l, k[:60]))
check("słowniki modułowe (%d plików): wartości EN bez „, klucze bez „…\\\"" % n_mod, n_mod >= 4 and not mod_bad,
      mod_bad[:5] or n_mod)

# ---------------------------------------------------------------- 3. _gl(pl, en) --------------
print("\n--- 3. _gl(pl, en) i pomocnicy modułów: drugi argument bez „ ---")
GL_RE = re.compile(r'(?:\b_gl|\b_[A-Za-z0-9]+[TL]|\b_ra5Pick|\b_rfwMore)\(\s*"(?:[^"\\]|\\.)*"\s*,\s*"(?:[^"\\]|\\.)*„')
gl_bad = []
for fn in js_files:
    s = strip_comments(read(os.path.join(JS_DIR, fn)))
    for m in GL_RE.finditer(s):
        gl_bad.append("%s:%d %s" % (fn, s.count("\n", 0, m.start()) + 1, m.group(0)[-60:]))
check("web/js: 0 wywołań _gl/_xxT/_xxL z „ w argumencie EN", not gl_bad, gl_bad[:5])

# ---------------------------------------------------------------- 4. widoczny HTML/JS ---------
print("\n--- 4. web/js + dashboard.html: brak „X\" poza komentarzami ---")
# „ + co najmniej jeden znak nie będący cudzysłowem + ASCII " (w literałach "…" to \").
# Zero znaków między „ a " to legalne sklejenie ("Usunięto „" + nazwa + "”") — nie liczy się.
# W JS nieuciekniony " po „X bywa po prostu KOŃCEM literału "…" (klucz „Przykład ORAZ: „pochylenie > 30"
# w rf-01 — cytat zamyka się w innym węźle): jeśli przed nim w tej linii stoi nieparzysta liczba
# nieuciekniętych ", to ogranicznik, nie cudzysłów w tekście. Uciekniony \" jest zawsze tekstem.
ASCII_CLOSE = re.compile(r'„[^„”"“\n\\]+(\\"|")')
UNESC_DQ = re.compile(r'(?<!\\)"')
vis_bad = []
for fn in js_files + ["ribbitflip_dashboard.html"]:
    p = os.path.join(JS_DIR if fn.endswith(".js") else WEB, fn)
    s = read(p)
    s = strip_html_comments(strip_comments(s)) if fn.endswith(".js") else strip_html_comments(s)
    for m in ASCII_CLOSE.finditer(s):
        if fn.endswith(".js") and m.group(1) == '"':
            ls = s.rfind("\n", 0, m.start()) + 1
            if len(UNESC_DQ.findall(s[ls:m.end() - 1])) % 2 == 1:
                continue
        vis_bad.append("%s:%d %s" % (fn, s.count("\n", 0, m.start()) + 1, m.group(0)[:60]))
check("web/js/rf-*.js + dashboard.html: 0 wystąpień „X\" w kodzie i tekście (komentarze pominięte)", not vis_bad, vis_bad[:6])
for fn in ("rf-34-tabs.js", "rf-39b-guides.js", "ribbitflip_dashboard.html"):
    hits = [b for b in vis_bad if b.startswith(fn + ":")]
    check("%s: 0 wystąpień „X\"" % fn, not hits, hits[:3])

# ---------------------------------------------------------------- 5. tools/fix_quotes.mjs ----
print("\n--- 5. tools/fix_quotes.mjs na sucho: nic do zmiany ---")
tool = os.path.join(ROOT, "tools", "fix_quotes.mjs")
check("tools/fix_quotes.mjs istnieje", os.path.isfile(tool))
try:
    p = subprocess.run(["node", tool], capture_output=True, text=True, encoding="utf-8", timeout=120, cwd=ROOT)
    out = (p.stdout or "") + (p.stderr or "")
    m = re.search(r"RAZEM: (\d+) litera", out)
    check("fix_quotes.mjs (raport) zgłasza 0 literałów do zmiany", m is not None and m.group(1) == "0",
          out.strip().splitlines()[-3:] if out.strip() else p.returncode)
except (OSError, subprocess.SubprocessError) as e:  # noqa: BLE001
    print("POMINIETO  fix_quotes.mjs (Node): %s" % e)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
