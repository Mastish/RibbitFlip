# WERSJA I WYDANIE. Uruchom: py tests/test_wydanie.py
#
# Pilnuje, żeby numer wersji był jeden: APP_VERSION w ribbitflip_monitor.py równa się najnowszej
# wydanej sekcji CHANGELOG.md, wydane sekcje idą od najnowszej w dół, a narzędzie tools/wydanie.py
# liczy następny numer tak, jak mówi SemVer. Nic tu nie potrzebuje serwera, gita ani Windowsa.
# Od 2026-10-21 także: pierwsze wydanie pod numerem, który już stoi w kodzie (1.0.0 bez taga) — wpisy
# z „Unreleased" wchodzą pod istniejący nagłówek „## [1.0.0]", który dostaje datę (wydanie.przenies).
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import wydanie  # noqa: E402

_passed = _failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


src = io.open(os.path.join(ROOT, "CHANGELOG.md"), encoding="utf-8").read()
wydane = [tuple(int(x) for x in m) for m in re.findall(r"^## \[(\d+)\.(\d+)\.(\d+)\]", src, re.M)]
teraz = wydanie.wersja_teraz()

print("--- jeden numer wersji ---")
check("CHANGELOG.md ma choć jedną wydaną wersję", bool(wydane))
check("APP_VERSION = najnowsza wydana sekcja CHANGELOG.md", wydane and teraz == wydane[0],
      "%s vs %s" % (teraz, wydane[:1]))
check("wydane sekcje idą od najnowszej", wydane == sorted(wydane, reverse=True), wydane)
check("każda wersja występuje raz", len(wydane) == len(set(wydane)))
check("„Unreleased” stoi nad wydanymi", src.find("## [Unreleased]") < src.find("## [%d.%d.%d]" % wydane[0]))
daty = re.findall(r"^## \[\d+\.\d+\.\d+\] - (.+)$", src, re.M)
check("data wydania w formacie RRRR-MM-DD", all(re.fullmatch(r"\d{4}-\d{2}-\d{2}", d) for d in daty), daty)

print("\n--- następny numer (SemVer) ---")
check("patch", wydanie.nowa_wersja((1, 2, 3), "patch") == (1, 2, 4))
check("minor zeruje patch", wydanie.nowa_wersja((1, 2, 3), "minor") == (1, 3, 0))
check("major zeruje resztę", wydanie.nowa_wersja((1, 2, 3), "major") == (2, 0, 0))
check("numer podany wprost", wydanie.nowa_wersja((1, 2, 3), "1.10.0") == (1, 10, 0))
check("podpowiedź: Added → minor", wydanie.podpowiedz("### Added\n- **A:** b\n### Fixed\n- **C:** d") == "minor")
check("podpowiedź: same poprawki → patch", wydanie.podpowiedz("### Fixed\n- **C:** d") == "patch")
check("podpowiedź: Removed → major", wydanie.podpowiedz("### Removed\n- **C:** d") == "major")

print("\n--- pierwsze wydanie: ten sam numer, gdy nie ma taga ani daty ---")
LF = ("## [Unreleased]\n\n### Added\n- **A:** b\n\n### Fixed\n- **C:** d\n\n"
      "## [1.0.0]\n\nFirst public release. See the README.\n")
nowy = wydanie.przenies(LF, "1.0.0", "2026-10-21")
check("istniejący nagłówek dostaje datę i jest jeden",
      "## [1.0.0] - 2026-10-21\n" in nowy and nowy.count("## [1.0.0]") == 1, nowy)
check("tekst sekcji zostaje nad wpisami", nowy.index("First public release") < nowy.index("### Added"))
check("wpisy przeniesione w całości i w tej samej kolejności",
      nowy.endswith("See the README.\n\n### Added\n- **A:** b\n\n### Fixed\n- **C:** d\n"), repr(nowy[-80:]))
check("„Unreleased” zostaje pusty", re.search(r"^## \[Unreleased\]\n\n## \[1\.0\.0\] - ", nowy, re.M), repr(nowy[:50]))
check("plik kończy się jednym znakiem nowej linii", nowy.endswith("d\n") and not nowy.endswith("\n\n"))
nowy_crlf = wydanie.przenies(LF.replace("\n", "\r\n"), "1.0.0", "2026-10-21")
check("CRLF zostaje CRLF", "\n" not in nowy_crlf.replace("\r\n", "") and nowy_crlf == nowy.replace("\n", "\r\n"))
check("pierwsze_wydanie: bez taga i bez daty → wolno", wydanie.pierwsze_wydanie(LF, "1.0.0", False))
check("pierwsze_wydanie: tag istnieje → nie wolno", not wydanie.pierwsze_wydanie(LF, "1.0.0", True))
check("pierwsze_wydanie: sekcja z datą → nie wolno", not wydanie.pierwsze_wydanie(nowy, "1.0.0", False))
check("pierwsze_wydanie: brak sekcji i taga → wolno (zwykły nowy numer)", wydanie.pierwsze_wydanie(LF, "1.1.0", False))
try:
    wydanie.przenies(nowy, "1.0.0", "2026-10-22")
    check("datowanej sekcji nie da się wydać drugi raz", False, "brak ValueError")
except ValueError:
    check("datowanej sekcji nie da się wydać drugi raz", True)
src3 = nowy.replace("## [Unreleased]\n\n", "## [Unreleased]\n\n### Added\n- **N:** n\n\n", 1)
nowy3 = wydanie.przenies(src3, "1.1.0", "2026-11-01")
check("zwykłe wydanie: nowa sekcja nad poprzednią, poprzednia nietknięta",
      "## [Unreleased]\n\n## [1.1.0] - 2026-11-01\n\n### Added\n- **N:** n\n\n## [1.0.0] - 2026-10-21\n\nFirst public release" in nowy3
      and nowy3.endswith("- **C:** d\n"), repr(nowy3[:120]))
sek = wydanie.sekcja_wersji(src, "%d.%d.%d" % teraz)
check("CHANGELOG.md ma sekcję numeru z APP_VERSION (z datą = wydana, bez daty = pierwsze wydanie w toku)",
      sek is not None, teraz)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
