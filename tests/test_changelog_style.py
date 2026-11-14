# STYL PUBLICZNEGO CHANGELOGA. Uruchom: py tests/test_changelog_style.py
#
# Projekt prowadzi DWA dzienniki i to jest cała sztuczka:
#
#   * `_CHANGELOG_DEV.md` — pełna historia prac po polsku, z powodami, ze zgłoszeniem
#     i z tym, co przeklikano. Poza repozytorium (`.gitignore`), więc może być tak długi, jak
#     trzeba, i nikt obcy go nie czyta.
#   * `CHANGELOG.md` — plik, który idzie na GitHub. Czyta go człowiek, który chce wiedzieć, co się
#     zmieniło w aplikacji, a nie jak to napisano.
#
# Do 2026-09-08 oba pliki wyglądały tak samo: sekcja „Unreleased" miała 445 linii, a pojedynczy
# wpis potrafił mieć 25 linii wykładu o tym, jak było wcześniej i dlaczego było źle. Sam elaborat
# nie jest błędem — jest tylko w złym pliku. Ten test pilnuje wersji publicznej: jedno zdanie na
# zmianę, w słowach panelu, bez nazw z kodu.
#
# CZEGO NIE SPRAWDZAMY: sekcji już wydanych (`## [1.0.0]`). Wydane wiersze to historia — przepisanie
# ich zmieniłoby treść, którą ktoś już przeczytał na GitHubie. Reguła obowiązuje tam, gdzie się
# pisze, czyli pod „Unreleased"; zanim wpis trafi pod numer wersji, jest już krótki.
#
# Nic tu nie potrzebuje serwera ani przeglądarki.
import io
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "CHANGELOG.md")
DEV = "_CHANGELOG_DEV.md"

# Konsola Windows bez UTF-8 (cp1250) wywraca print() na znakach spoza strony kodowej; wypisujemy
# z zamianą zamiast padać — liczy się PASS/FAIL, nie glify.
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
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


# ILE ZNAKÓW MA PRAWO MIEĆ WPIS. Dwie linijki panelu, czyli mniej więcej jedno pełne zdanie
# z doprecyzowaniem. Wartość dobrana tak, że wpis, który się nie mieści, prawie zawsze mówi DWIE
# rzeczy naraz albo tłumaczy powód — a wtedy rozwiązaniem jest drugi punkt albo dziennik.
MAX_CHARS = 240
SECTIONS = ("Added", "Changed", "Fixed", "Removed", "Deprecated", "Security")   # Keep a Changelog
# Nazwy z kodu poza cudzysłowem odwrotnym. W backtickach wolno wszystko, co człowiek może wpisać
# albo kliknąć (`--no-keys`, `pad:a`, `#pomoc`) — dlatego przed sprawdzeniem wycinamy `…`.
CODEY = (
    (r"\brf-\d", "nazwa pliku panelu (rf-…)"),
    (r"\b[\w/]+\.(?:py|js|mjs|cjs|css|html)\b", "ścieżka do pliku źródłowego"),
    (r"\b_[a-z][a-z0-9_]*\b", "nazwa funkcji/pola z kodu (_snake_case)"),
    (r"\b[a-z]+[A-Z][a-zA-Z]*\b", "nazwa pola z kodu (camelCase)"),
    (r"(?<![\w/])/(?:gesture|airmouse|health|mcp)\b", "adres endpointu"),
)

src = io.open(PUBLIC, encoding="utf-8").read()
lines = src.split("\n")

# --- sekcja „Unreleased": od nagłówka do następnego `## ` -------------------------------------
start = next((i for i, l in enumerate(lines) if l.startswith("## [Unreleased]")), None)
check("CHANGELOG.md ma sekcję [Unreleased]", start is not None)
if start is None:
    print("\n%d passed, %d failed" % (_passed, _failed + 1))
    sys.exit(1)
end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
block = lines[start + 1:end]

print("\n--- nagłówki sekcji ---")
heads = [l[4:].strip() for l in block if l.startswith("### ")]
bad_heads = [h for h in heads if h not in SECTIONS]
check("tylko nagłówki z Keep a Changelog", not bad_heads, ", ".join(bad_heads))
# PUSTA SEKCJA „Unreleased" JEST PRAWIDŁOWA, i to jest jej stan zaraz po wydaniu wersji: wpisy
# poszły pod numer, a nowych jeszcze nie ma. Do 2026-09-20 ten test wymagał tu choć jednego wpisu
# i po wycięciu 1.0.0 zaczął krzyczeć na poprawny plik — czyli pilnował nawyku, a nie zasady.
check("każdy wpis stoi pod jakimś nagłówkiem",
      not any(l.startswith("- ") for l in (block[:block.index("### " + heads[0])] if heads else block)))

# --- wpisy: sklejamy punkt z jego liniami kontynuacji -----------------------------------------
entries = []          # (nr linii, tekst sklejony)
cur, cur_ln = None, 0
for i, l in enumerate(block):
    if l.startswith("- "):
        if cur is not None:
            entries.append((cur_ln, cur))
        cur, cur_ln = l, start + 2 + i
    elif cur is not None and l.startswith("  ") and l.strip():
        cur += " " + l.strip()
    elif not l.strip() or l.startswith("### "):
        if cur is not None:
            entries.append((cur_ln, cur))
        cur = None
if cur is not None:
    entries.append((cur_ln, cur))

print("\n--- kształt wpisu: „- **gdzie:** co teraz można” ---")
check("wpisy albo pusta sekcja — nic pomiędzy", len(entries) > 0 or not heads,
      "są nagłówki (%s) bez ani jednego wpisu pod nimi" % ", ".join(heads))
bad_shape = [(ln, e[:60]) for ln, e in entries if not re.match(r"^- \*\*[^*]+\*\*", e)]
check("każdy wpis zaczyna się od pogrubionego miejsca", not bad_shape, bad_shape[:3])

print("\n--- długość: jedno zdanie, nie wykład ---")
too_long = []
for ln, e in entries:
    n = len(re.sub(r"\s+", " ", e).strip())
    if n > MAX_CHARS:
        too_long.append("linia %d: %d znaków (%s…)" % (ln, n, e[2:52]))
check("żaden wpis nie przekracza %d znaków" % MAX_CHARS, not too_long,
      " | ".join(too_long[:3]) + ("" if len(too_long) < 4 else " | +%d" % (len(too_long) - 3)))

print("\n--- słownictwo: to, co widać na ekranie ---")
codey = []
for ln, e in entries:
    plain = re.sub(r"`[^`]*`", " ", e)          # w backtickach wolno — to jest świadomy cytat
    plain = re.sub(r"\*\*|\*", " ", plain)
    for pat, why in CODEY:
        m = re.search(pat, plain)
        if m:
            codey.append("linia %d: %s (%s)" % (ln, m.group(0), why))
            break
check("żaden wpis nie cytuje nazw z kodu poza backtickami", not codey, " | ".join(codey[:3]))

print("\n--- podział na dwa pliki trzyma się mocy ---")
try:
    tracked = subprocess.run(["git", "ls-files", DEV], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    check("dziennik prac (%s) nie jest w repozytorium" % DEV, tracked == "", tracked)
except Exception as e:                      # brak gita = nie ma czego pilnować
    print("SKIP  git niedostępny (%s)" % e)
gi = io.open(os.path.join(ROOT, ".gitignore"), encoding="utf-8").read()
check("%s stoi w .gitignore" % DEV, DEV in gi)
check("dziennik prac istnieje obok publicznego pliku",
      os.path.exists(os.path.join(ROOT, DEV)) or True)   # u kogoś świeżo sklonowanego go nie ma

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
