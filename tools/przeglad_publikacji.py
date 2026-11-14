# PRZEGLĄD PRZED PUBLIKACJĄ — lista do odhaczenia, zanim cokolwiek stanie się
# publiczne (repozytorium przełączone na publiczne, wydanie na GitHubie, paczka dla ludzi).
#
#   py tools/przeglad_publikacji.py            wszystko, co śledzi git (pierwsza publikacja)
#   py tools/przeglad_publikacji.py --od v1.1.0   tylko pliki zmienione od tego taga (kolejne wydania)
#
# Wynik: build/przeglad-publikacji.md (build/ jest w .gitignore). Na górze pliki z ostrzeżeniami,
# niżej reszta pogrupowana po katalogach, każda z polem [ ] do odhaczenia. Skrypt NICZEGO nie
# blokuje i niczego nie wysyła — mówi, na co spojrzeć, a decyzję podejmuje człowiek.
import io
import os
import re
import subprocess
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WYNIK = os.path.join(ROOT, "build", "przeglad-publikacji.md")
DUZY = 1024 * 1024

# Co w publicznym pliku zwykle jest wpadką. Wzorce celowo szerokie: fałszywy alarm kosztuje
# spojrzenie, przeoczony kosztuje wyciek.
PODEJRZANE = (
    (r"[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s\"']+", "ścieżka z nazwą użytkownika Windows"),
    (r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[bap]-[A-Za-z0-9-]{10,})",
     "wygląda na token / klucz API"),
    (r"(?i)\b(?:password|passwd|hasło|haslo|secret|api[_-]?key)\s*[:=]\s*[\"'][^\"']{4,}", "hasło / sekret w kodzie"),
    (r"\b[\w.+-]+@(?!users\.noreply\.github\.com|anthropic\.com|example\.(?:com|org))[\w-]+\.[\w.]+\b",
     "adres e-mail"),
    (r"\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b", "adres IP sieci lokalnej"),
)
# PRYWATNE WZORCE (nazwiska, firma, adresy) NIE STOJĄ W TYM PLIKU: plik jest publiczny, więc lista
# „czego szukać" sama byłaby wyciekiem. Każdy trzyma swoje w tools/przeglad_publikacji.local.txt
# (w .gitignore): jeden wzorzec regex na linię, opcjonalnie „ | opis". Puste linie i # pomijamy.
LOKALNE = os.path.join(ROOT, "tools", "przeglad_publikacji.local.txt")
if os.path.exists(LOKALNE):
    with io.open(LOKALNE, encoding="utf-8") as _f:
        for _l in _f:
            _l = _l.strip()
            if _l and not _l.startswith("#"):
                _w, _, _o = _l.partition(" | ")
                # A control character in a pattern (e.g. a backspace where "\b" was meant, written
                # by a shell that expanded the escape) makes the pattern silently never match, so a
                # broken private list would pass every file. Refuse to run instead.
                if any(ord(c) < 32 for c in _w):
                    sys.exit("BŁĄD: wzorzec w %s zawiera znak sterujący (np. backspace zamiast \\b): %r"
                             % (os.path.basename(LOKALNE), _w))
                PODEJRZANE += ((_w.strip(), _o.strip() or "prywatny wzorzec"),)
TEKSTOWE = (".py", ".js", ".mjs", ".cjs", ".css", ".html", ".md", ".txt", ".json", ".yml", ".yaml",
            ".bat", ".spec", ".gitignore", ".gitattributes", ".svg", ".csv")
OBRAZY = (".jpg", ".jpeg", ".png", ".webp", ".gif")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def git(*a):
    return subprocess.run(["git", "-c", "core.quotepath=off", *a], cwd=ROOT, capture_output=True,
                          text=True, encoding="utf-8").stdout


def pliki(od):
    if od:
        out = git("diff", "--name-only", "--diff-filter=ACMR", od, "HEAD")
    else:
        out = git("ls-files")
    return [p for p in out.splitlines() if p.strip()]


def uwagi_tekst(sciezka):
    try:
        with io.open(os.path.join(ROOT, sciezka), encoding="utf-8", errors="replace") as f:
            tekst = f.read()
    except OSError:
        return []
    wynik = []
    for wzor, opis in PODEJRZANE:
        trafienia = set(m.group(0) for m in re.finditer(wzor, tekst))
        if trafienia:
            przyklad = ", ".join(sorted(trafienia)[:3])
            wynik.append("%s: `%s`%s" % (opis, przyklad, " (+%d)" % (len(trafienia) - 3) if len(trafienia) > 3 else ""))
    return wynik


def uwagi_obraz(sciezka):
    try:
        from PIL import Image
        with Image.open(os.path.join(ROOT, sciezka)) as im:
            exif = im.getexif()
            wynik = []
            if exif and exif.get_ifd(0x8825):
                wynik.append("EXIF zawiera GPS (miejsce zrobienia zdjęcia)")
            if exif and any(exif.get(k) for k in (0x013B, 0x8298, 0x010F, 0x0110)):
                wynik.append("EXIF: autor / aparat")
            return wynik + ["zrzut ekranu — sprawdź, czy nie widać prywatnych okien, nazwisk, powiadomień"]
    except Exception:
        return ["obraz — obejrzyj ręcznie"]


def main():
    od = sys.argv[sys.argv.index("--od") + 1] if "--od" in sys.argv else ""
    lista = pliki(od)
    ostrzezenia, grupy = [], defaultdict(list)
    razem = 0
    for p in lista:
        pelna = os.path.join(ROOT, p)
        rozm = os.path.getsize(pelna) if os.path.exists(pelna) else 0
        razem += rozm
        ext = os.path.splitext(p)[1].lower() or os.path.basename(p)
        uw = uwagi_tekst(p) if ext in TEKSTOWE else uwagi_obraz(p) if ext in OBRAZY else []
        if rozm > DUZY:
            uw.append("duży plik: %.1f MB" % (rozm / DUZY))
        wiersz = "- [ ] `%s` — %s" % (p, "%.0f kB" % (rozm / 1024) if rozm >= 1024 else "%d B" % rozm)
        if uw and ext not in OBRAZY:
            ostrzezenia.append(wiersz + "".join("\n  - ⚠️ " + u for u in uw))
        else:
            grupy[p.split("/")[0] if "/" in p else "(korzeń)"].append(
                wiersz + ("".join("\n  - " + u for u in uw) if uw else ""))

    zakres = "zmienione od `%s`" % od if od else "wszystko, co śledzi git"
    md = ["# Przegląd przed publikacją", "",
          "Zakres: %s · %d plików · %.1f MB · commit `%s`" % (zakres, len(lista), razem / DUZY,
                                                             git("rev-parse", "--short", "HEAD").strip()),
          "", "Odhacz plik, gdy go obejrzysz. Publikuj dopiero, gdy wszystko jest odhaczone.", "",
          "## ⚠️ Do sprawdzenia w pierwszej kolejności (%d)" % len(ostrzezenia), ""]
    md += ostrzezenia or ["Brak — żaden plik tekstowy nie trafił na wzorce."]
    for g in sorted(grupy, key=lambda k: (k != "(korzeń)", k)):
        md += ["", "## %s (%d)" % (g, len(grupy[g])), ""] + grupy[g]
    os.makedirs(os.path.dirname(WYNIK), exist_ok=True)
    with io.open(WYNIK, "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")
    print("%d plików (%s), %d z ostrzeżeniami → %s" % (len(lista), zakres, len(ostrzezenia),
                                                      os.path.relpath(WYNIK, ROOT)))


if __name__ == "__main__":
    main()
