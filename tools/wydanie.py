# WYDANIE WERSJI — jedno polecenie zamiast pięciu ręcznych kroków.
#
#   py tools/wydanie.py                 stan: wersja, ostatni tag, co czeka w „Unreleased"
#   py tools/wydanie.py patch|minor|major|X.Y.Z          podgląd (nic nie zmienia)
#   py tools/wydanie.py patch|minor|major|X.Y.Z --go     wydaje
#
# „--go" robi dokładnie to, co opisuje CONTRIBUTING › „Changelog i wersje”, i nic więcej:
#   1. sprawdza: czyste drzewo, gałąź main, niepusta sekcja „Unreleased", testy changeloga i i18n,
#   2. przenosi wpisy z „Unreleased" pod „## [X.Y.Z] - RRRR-MM-DD",
#   3. wpisuje X.Y.Z do APP_VERSION w ribbitflip_monitor.py (jedyne miejsce z numerem),
#   4. commit „Release vX.Y.Z" i tag z adnotacją vX.Y.Z (treść taga = wpisy tej wersji).
# NIE wypycha i NIE publikuje — to zostaje ręczną decyzją człowieka.
#
# Który numer? SemVer, liczony z sekcji: „Removed" albo zmiana niezgodna wstecz → major,
# „Added" → minor, same „Fixed"/„Changed"/„Security" → patch. Skrypt podpowiada, człowiek wybiera.
#
# PIERWSZE WYDANIE (celowo 1.0.0): numer 1.0.0 stoi już
# w APP_VERSION, a taga v1.0.0 nie ma. Dlatego „X.Y.Z" RÓWNE obecnej wersji jest dozwolone, dopóki
# nie ma ani taga vX.Y.Z, ani datowanej sekcji „## [X.Y.Z] - data" (pierwsze_wydanie()). Wpisy
# z „Unreleased" wchodzą wtedy pod ISTNIEJĄCY nagłówek „## [X.Y.Z]", który dostaje datę; tekst, który
# już tam stoi, zostaje nad wpisami (przenies()). Niższy numer nadal nie przechodzi.
import datetime
import io
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHANGELOG = os.path.join(ROOT, "CHANGELOG.md")
MONITOR = os.path.join(ROOT, "ribbitflip_monitor.py")
TESTY = ("tests/test_changelog_style.py", "tests/test_i18n_dupes.py", "tests/test_i18n_quotes.py")
RE_WERSJA = re.compile(r'^APP_VERSION = "(\d+)\.(\d+)\.(\d+)"', re.M)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def czytaj(p):
    with io.open(p, encoding="utf-8", newline="") as f:     # newline="": CRLF/LF zostają, jakie były
        return f.read()


def zapisz(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)


def git(*a):
    r = subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    return r.returncode, r.stdout.strip()


def wersja_teraz():
    m = RE_WERSJA.search(czytaj(MONITOR))
    if not m:
        sys.exit("Nie widzę APP_VERSION w ribbitflip_monitor.py.")
    return tuple(int(x) for x in m.groups())


def unreleased(src):
    """(początek treści, koniec treści, treść) sekcji „Unreleased" — bez jej nagłówka."""
    m = re.search(r"^## \[Unreleased\][^\n]*\n", src, re.M)
    if not m:
        sys.exit("CHANGELOG.md nie ma sekcji ## [Unreleased].")
    nast = re.search(r"^## ", src[m.end():], re.M)
    koniec = m.end() + nast.start() if nast else len(src)
    return m.end(), koniec, src[m.end():koniec]


def sekcja_wersji(src, v):
    """Sekcja „## [v]" albo None: pocz (początek nagłówka), kon (koniec sekcji), data (to, co stoi za
    numerem, np. „2026-10-21"; pusty napis = nagłówek bez daty) i tresc (treść bez nagłówka)."""
    m = re.search(r"^## \[%s\]([^\n]*)\n" % re.escape(v), src, re.M)
    if not m:
        return None
    nast = re.search(r"^## ", src[m.end():], re.M)
    kon = m.end() + nast.start() if nast else len(src)
    return {"pocz": m.start(), "kon": kon, "data": m.group(1).strip(" -\r"), "tresc": src[m.end():kon]}


def pierwsze_wydanie(src, v, tag_istnieje):
    """Czy numer v, który już stoi w APP_VERSION, NIE był jeszcze wydany: nie ma taga i nie ma datowanej
    sekcji w CHANGELOG. Tylko wtedy wolno wydać ten sam numer, który jest w kodzie."""
    sek = sekcja_wersji(src, v)
    return not tag_istnieje and not (sek and sek["data"])


def przenies(src, v, dzis):
    """Nowa treść CHANGELOG: wpisy z „Unreleased" lądują pod „## [v] - dzis", a „Unreleased" zostaje pusty.
    Gdy sekcja „## [v]" już stoi bez daty (pierwsze wydanie), dostaje datę, a jej dotychczasowy tekst
    zostaje nad wpisami. Sekcja z datą = wersja już wydana: ValueError. Zakończenia linii jak w src."""
    nl = "\r\n" if "\r\n" in src else "\n"
    pocz, kon, tresc = unreleased(src)
    wpisy = tresc.strip("\r\n")
    naglowek = "## [%s] - %s" % (v, dzis)
    sek = sekcja_wersji(src, v)
    if sek is None:
        return src[:pocz] + nl + naglowek + nl + nl + wpisy + nl + nl + src[kon:]
    if sek["data"]:
        raise ValueError("Sekcja ## [%s] ma już datę %s: ta wersja jest wydana, podaj wyższy numer." % (v, sek["data"]))
    if sek["pocz"] < pocz:
        raise ValueError('Sekcja ## [%s] stoi nad „Unreleased".' % v)
    proza = sek["tresc"].strip("\r\n")
    cialo = (proza + nl + nl if proza else "") + wpisy
    ogon = src[sek["kon"]:]
    return (src[:pocz] + nl + src[kon:sek["pocz"]] + naglowek + nl + nl + cialo
            + (nl + nl if ogon else nl) + ogon)


def tag_istnieje(v):
    kod, _ = git("rev-parse", "-q", "--verify", "refs/tags/v" + v)
    return kod == 0


def podpowiedz(tresc):
    sekcje = set(re.findall(r"^### (\w+)", tresc, re.M))
    if "Removed" in sekcje or re.search(r"BREAKING|niezgodn", tresc, re.I):
        return "major"
    return "minor" if "Added" in sekcje else "patch"


def nowa_wersja(stara, arg):
    if arg in ("major", "minor", "patch"):
        M, m, p = stara
        return {"major": (M + 1, 0, 0), "minor": (M, m + 1, 0), "patch": (M, m, p + 1)}[arg]
    if re.fullmatch(r"\d+\.\d+\.\d+", arg):
        return tuple(int(x) for x in arg.split("."))
    sys.exit("Podaj patch, minor, major albo numer X.Y.Z (dostałem: %r)." % arg)


def main():
    arg = [a for a in sys.argv[1:] if not a.startswith("--")]
    go = "--go" in sys.argv
    src = czytaj(CHANGELOG)
    stara = wersja_teraz()
    _, _, tresc = unreleased(src)
    wpisy = len(re.findall(r"^- ", tresc, re.M))
    _, tag = git("describe", "--tags", "--abbrev=0", "--match", "v*")
    print("Wersja teraz:   %d.%d.%d" % stara)
    print("Ostatni tag:    %s" % (tag or "brak"))
    print("Unreleased:     %d wpisów (%s)" % (wpisy, ", ".join(
        "%s %d" % (s, len(re.findall(r"^- ", b, re.M)))
        for s, b in re.findall(r"^### (\w+)\n(.*?)(?=^### |\Z)", tresc, re.M | re.S)) or "pusto"))
    if not wpisy:
        print("\nNie ma czego wydawać.")
        return
    v_stara = "%d.%d.%d" % stara
    pierwsze = pierwsze_wydanie(src, v_stara, tag_istnieje(v_stara))
    print("Podpowiedź:     %s" % podpowiedz(tresc))
    if pierwsze:
        print("Pierwsze wydanie: %s stoi już w APP_VERSION, bez taga i bez daty w CHANGELOG — ten numer wolno wydać." % v_stara)
    if not arg:
        print("\nWydanie: py tools/wydanie.py %s --go" % (v_stara if pierwsze else podpowiedz(tresc)))
        return

    nowa = nowa_wersja(stara, arg[0])
    v = "%d.%d.%d" % nowa
    if nowa < stara:
        sys.exit("Nowa wersja %s musi być wyższa od %s." % (v, v_stara))
    if nowa == stara:
        if not pierwsze:
            sys.exit("Wersja %s jest już wydana (tag v%s albo datowana sekcja w CHANGELOG) — podaj wyższy numer." % (v, v))
        print("Ten sam numer co w kodzie: wpisy z „Unreleased\" wejdą pod istniejący nagłówek ## [%s], który dostanie"
              " datę; jego dotychczasowy tekst zostaje nad wpisami." % v)
    dzis = datetime.date.today().isoformat()
    tresc_czysta = tresc.strip("\r\n")
    print("\n→ v%s z dnia %s" % (v, dzis))
    if not go:
        print("Podgląd — nic nie zmieniono. Dopisz --go, żeby wydać.")
        return

    # --- bramki: wydanie z brudnego drzewa albo bez testów to proszenie się o kłopoty ----------
    _, brud = git("status", "--porcelain")
    if brud:
        sys.exit("Drzewo nie jest czyste — najpierw commit albo stash:\n" + brud)
    _, galaz = git("rev-parse", "--abbrev-ref", "HEAD")
    if galaz != "main":
        sys.exit("Wydajemy z gałęzi main (jesteś na %s)." % galaz)
    kod, _ = git("rev-parse", "-q", "--verify", "refs/tags/v" + v)
    if kod == 0:
        sys.exit("Tag v%s już istnieje." % v)
    for t in TESTY:
        r = subprocess.run([sys.executable, t], cwd=ROOT, capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        if r.returncode:
            sys.exit("Test %s nie przechodzi — wydanie wstrzymane:\n%s" % (t, r.stdout[-1500:]))

    # --- zmiany w plikach -----------------------------------------------------------------------
    try:
        nowy = przenies(src, v, dzis)
    except ValueError as e:
        sys.exit(str(e))
    zapisz(CHANGELOG, nowy)
    mon = czytaj(MONITOR)
    zapisz(MONITOR, RE_WERSJA.sub('APP_VERSION = "%s"' % v, mon, count=1))

    for krok in (("add", "CHANGELOG.md", "ribbitflip_monitor.py"),
                 ("commit", "-q", "-m", "Release v" + v),
                 ("tag", "-a", "v" + v, "-m", "RibbitFlip v%s%s%s" % (v, "\n\n", tresc_czysta))):
        kod, out = git(*krok)
        if kod:
            sys.exit("git %s padł: %s" % (krok[0], out))
    print("Gotowe: commit „Release v%s” + tag v%s. Nic nie wypchnięto." % (v, v))
    print("Dalej (lokalnie, Windows): build_exe.bat → sprawdź .exe → py tools/przeglad_publikacji.py")
    print("Wypchnięcie, po zatwierdzeniu wydania: git push origin main --follow-tags")


if __name__ == "__main__":
    main()
