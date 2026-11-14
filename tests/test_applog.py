# Test of the APP LOG ROLLOVER — ribbitflip.log. Run: py tests/test_applog.py
#
# Until 2026-08-26 this file had no ceiling. In a windowed build every print() goes there and
# the handle was a plain append, so one fault that prints in a loop left tens of MB next to the
# .exe (20.7 MB, measured on the author's own machine). The failure is quiet: nobody opens the
# log until something breaks, and by then the disk has been paying for it for weeks.
#
# What is checked here, and why each one earns its place:
#
#   * The ceiling is a KNOWN NUMBER, not a hope — generations x cap, and the cap has to be
#     bigger than the slice the crash report takes, or every report would be a truncated one.
#   * Rotation moves the bytes rather than dropping them: the old content has to be findable
#     in .log.1 afterwards, because that is the part that explains what happened.
#   * The rollover happens MID-RUN, not only at startup. The app lives in the tray for days;
#     a check that only runs on launch would let a single long session grow without end.
#   * A run always starts inside the budget — an oversized file left by an older build gets
#     rolled before the first line is written.
#   * The sink NEVER raises. It stands in for sys.stdout inside exception handlers; a print()
#     that throws there replaces the real fault with its own.
#   * The crash report reads BACKWARDS THROUGH the generations. Right after a rotation the
#     current file is a few lines long, and a report built from it alone would look complete
#     and say nothing.
#
# Nothing here touches the real ribbitflip.log: every write goes to a temp folder, and the size
# constants are lowered for the duration so the test stays quick.
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  <- " + str(detail)) if detail else ""))


tmp = tempfile.mkdtemp(prefix="rf_applog_")
_real_cap, _real_gens = rf.APP_LOG_MAX_BYTES, rf.APP_LOG_GENERATIONS
try:
    # ---------------------------------------------------------------- a. the ceiling ----------
    print("--- a. sufit jest liczba, nie nadzieja ---")
    check("a1. sufit na pokolenie jest ustawiony", rf.APP_LOG_MAX_BYTES > 0,
          rf.APP_LOG_MAX_BYTES)
    check("a2. sa co najmniej dwa pokolenia", rf.APP_LOG_GENERATIONS >= 2,
          rf.APP_LOG_GENERATIONS)
    check("a3. sufit calosci ponizej 16 MB",
          rf.APP_LOG_MAX_BYTES * rf.APP_LOG_GENERATIONS <= 16 * 1024 * 1024,
          rf.APP_LOG_MAX_BYTES * rf.APP_LOG_GENERATIONS)
    check("a4. pokolenie miesci ogon zgloszenia w calosci",
          rf.APP_LOG_MAX_BYTES > rf.DIAG_LOG_TAIL_BYTES,
          "%d vs %d" % (rf.APP_LOG_MAX_BYTES, rf.DIAG_LOG_TAIL_BYTES))
    base = os.path.join(tmp, "ribbitflip.log")
    check("a5. nazwy pokolen to .log, .log.1, .log.2",
          rf._app_log_paths(base) == [base, base + ".1", base + ".2"],
          rf._app_log_paths(base))

    # ---------------------------------------------------------------- b. rotation -------------
    print("\n--- b. rotacja przesuwa bajty, nie gubi ---")
    for i, txt in enumerate(("najstarszy", "sredni", "najnowszy")):
        open(rf._app_log_paths(base)[2 - i], "w", encoding="utf-8").write(txt)
    rf._app_log_rotate(base)
    check("b1. najnowszy zjechal do .1",
          os.path.isfile(base + ".1")
          and open(base + ".1", encoding="utf-8").read() == "najnowszy")
    check("b2. sredni zjechal do .2",
          os.path.isfile(base + ".2")
          and open(base + ".2", encoding="utf-8").read() == "sredni")
    check("b3. najstarszy wypadl poza sufit", not os.path.isfile(base + ".3"))
    check("b4. biezacego pliku nie ma, nastepny zapis go tworzy", not os.path.isfile(base))

    # Age retention: a generation older than APP_LOG_MAX_DAYS goes on the next rotation.
    # The old mtime is planted on .1, not on .2: .2 is the one rotation drops as the oldest
    # generation anyway, so planting it there would prove nothing. os.replace keeps the mtime,
    # so the aged .1 lands in .2 and has to be removed by the AGE check, not by the shuffle.
    open(base, "w", encoding="utf-8").write("swiezy")
    old = time.time() - (rf.APP_LOG_MAX_DAYS + 1) * 86400.0
    os.utime(base + ".1", (old, old))
    rf._app_log_rotate(base)
    check("b5. pokolenie starsze niz %d dni jest kasowane" % rf.APP_LOG_MAX_DAYS,
          not os.path.isfile(base + ".2"))
    for p in rf._app_log_paths(base):
        try:
            os.remove(p)
        except OSError:
            pass

    # ---------------------------------------------------------------- c. mid-run rollover -----
    print("\n--- c. przewijanie W TRAKCIE dzialania, nie tylko przy starcie ---")
    rf.APP_LOG_MAX_BYTES = 4096                 # the class reads the global on every write
    log = rf._RollingLog(base)
    line = "x" * 200 + "\n"
    for i in range(200):                        # ~40 KB through a 4 KB ceiling
        log.write("%03d %s" % (i, line))
    log.write("OSTATNIA LINIA\n")
    log.flush()
    check("c1. biezacy plik zostal pod sufitem",
          os.path.getsize(base) <= rf.APP_LOG_MAX_BYTES,
          os.path.getsize(base))
    total = sum(os.path.getsize(p) for p in rf._app_log_paths(base) if os.path.isfile(p))
    check("c2. calosc na dysku miesci sie w sufit x pokolenia",
          total <= rf.APP_LOG_MAX_BYTES * rf.APP_LOG_GENERATIONS, total)
    check("c3. liczba plikow nie przekracza liczby pokolen",
          len([p for p in rf._app_log_paths(base) if os.path.isfile(p)])
          <= rf.APP_LOG_GENERATIONS)
    check("c4. ostatnia linia jest w biezacym pliku",
          "OSTATNIA LINIA" in open(base, encoding="utf-8", errors="replace").read())
    check("c5. starsza tresc przetrwala w .1", os.path.isfile(base + ".1")
          and len(open(base + ".1", encoding="utf-8", errors="replace").read()) > 0)
    log.close()

    # ---------------------------------------------------------------- d. startup --------------
    print("\n--- d. uruchomienie zaczyna w budzecie ---")
    for p in rf._app_log_paths(base):
        try:
            os.remove(p)
        except OSError:
            pass
    open(base, "w", encoding="utf-8").write("Z" * (rf.APP_LOG_MAX_BYTES + 100))
    log = rf._RollingLog(base)                  # older build left an oversized file behind
    log.write("po restarcie\n")
    log.flush()
    check("d1. zastany przerost zjechal do .1", os.path.isfile(base + ".1")
          and os.path.getsize(base + ".1") > rf.APP_LOG_MAX_BYTES)
    check("d2. nowy przebieg pisze do swiezego pliku",
          os.path.getsize(base) < 1024, os.path.getsize(base))
    log.close()

    # A file left by a build WITHOUT the cap (here 10x over) must not survive as a generation:
    # rolling it into .1 and keeping it would make the advertised ceiling a lie for 30 days.
    for p in rf._app_log_paths(base):
        try:
            os.remove(p)
        except OSError:
            pass
    open(base, "w", encoding="utf-8").write("Z" * (rf.APP_LOG_MAX_BYTES * 10))
    log = rf._RollingLog(base)
    log.write("po restarcie\n")
    log.flush()
    check("d3. plik rozdety przez wersje bez sufitu nie zostaje jako pokolenie",
          not os.path.isfile(base + ".1"))
    check("d4. po sprzataniu calosc jest w budzecie",
          sum(os.path.getsize(p) for p in rf._app_log_paths(base) if os.path.isfile(p))
          <= rf.APP_LOG_MAX_BYTES * rf.APP_LOG_GENERATIONS)

    # ---------------------------------------------------------------- e. never raises ---------
    print("\n--- e. sink nie rzuca (stoi za print() w obsludze bledu) ---")
    check("e1. isatty() odpowiada bez wyjatku", log.isatty() is False)
    check("e2. fileno() dziala (subprocess/os.dup)", isinstance(log.fileno(), int))
    log._f.close()                              # simulate the handle dying under the sink
    try:
        log.write("po zamknieciu uchwytu\n")
        log.flush()
        ok = True
    except Exception as e:
        ok = False
        print("      %r" % (e,))
    check("e3. zapis po zamknieciu uchwytu nie wywraca print()", ok)
    check("e4. delegacja atrybutow nie wpada w rekurencje",
          isinstance(getattr(log, "mode", ""), str))

    # ---------------------------------------------------------------- f. crash report ---------
    print("\n--- f. zgloszenie czyta WSTECZ przez pokolenia ---")
    for p in rf._app_log_paths(base):
        try:
            os.remove(p)
        except OSError:
            pass
    open(base + ".1", "w", encoding="utf-8").write("STARE: tu sie zepsulo\n")
    open(base, "w", encoding="utf-8").write("NOWE: kilka linii po rotacji\n")
    src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "ribbitflip_monitor.py"), "r", encoding="utf-8").read()
    check("f1. sekcja dziennika iteruje po pokoleniach",
          "_app_log_paths(log_path)" in src)
    check("f2. dziennik nadal idzie przez redakcje, nie surowy",
          "_diag_scrub_log(txt)" in src)
    check("f3. _ensure_std_streams uzywa przewijanego sinka",
          "_RollingLog(os.path.join(_app_dir(), APP_LOG_NAME))" in src)
    check("f4. nigdzie nie zostal goly append do dziennika",
          'open(os.path.join(_app_dir(), "ribbitflip.log"), "a"' not in src)
finally:
    rf.APP_LOG_MAX_BYTES, rf.APP_LOG_GENERATIONS = _real_cap, _real_gens
    shutil.rmtree(tmp, ignore_errors=True)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
