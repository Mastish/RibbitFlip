# WEJŚCIE BANERA BUDOWANIA. Uruchom: py tests/test_build_banner.py
#
# `tools/build_banner.py` rysuje to, co `build_exe.bat` zostawia na ekranie na koniec: żabę, gdy
# build się udał, punkową czaszkę, gdy nie. Od 2026-09-15 rysunek nie pojawia się naraz — schodzi
# wierszami przez ~0,8 s, a z kolorem każdy wiersz ląduje przyciemniony i dochodzi do pełnej barwy.
#
# Co ten test pilnuje i dlaczego akurat to:
#
#   * OBRAZ PO ANIMACJI = OBRAZ SPRZED NIEJ. Wejście ma zmienić SPOSÓB pojawiania się, nie rysunek.
#     Ostatnia klatka każdego wiersza musi być dokładnie tym, co banner drukował wcześniej — inaczej
#     ktoś za pół roku zobaczy żabę w innych kolorach i nie będzie wiedział, czemu.
#   * NIKT NIE CZEKA. Build trwa minutę, ozdoba ma trwać ułamek sekundy. Suma drzemek + BEAT jest
#     ograniczona z góry dla KAŻDEGO rysunku z drabinki (żaba i czaszka, trzy szerokości).
#   * ANIMUJEMY TYLKO DO KONSOLI. Wyjście przekierowane do pliku albo log CI nic z opóźnień nie ma,
#     a `RF_BANNER_STATIC=1` to furtka dla kogoś, kto chce po prostu zobaczyć obrazek.
#   * WIERSZ NADPISUJE TYLKO SIEBIE. Żaba ma ~50 wierszy, a okno konsoli 30 — cokolwiek cofałoby
#     kursor o całe ekrany, trafiłoby w złe miejsce. W wyjściu nie wolno się pojawić niczemu poza
#     `\r` i `\x1b[K`; żadnego `\x1b[<n>A`.
#   * Ctrl+C KOŃCZY RYSUNEK, a nie zostawia pół żaby.
#
# Od 2026-09-22 doszły dwie rzeczy i dwa powody, żeby ich pilnować:
#
#   * NAPIS NA POCZĄTKU („start"): „ribbit" białe, „FLIP" różowe. Barwy nie pochodzą ze zdjęcia,
#     tylko ze słowa, więc test sprawdza to, czego nie widać w pliku z rysunkiem: że każdy znak
#     ma barwę, że są dokładnie dwie i że biel kończy się tam, gdzie zaczyna róż — przeplot
#     znaczyłby, że kolumna podziału rozjechała się z rysunkiem. Napis niczego nie orzeka
#     o buildzie (nie zaczął się), więc nie wolno mu wypisać ani „BUILD OK", ani „BUILD FAILED".
#   * SUMA KONTROLNA POD ŻABĄ. Ma się zgadzać z `certutil -hashfile` co do znaku, mieścić się
#     w jednej linii najwęższej konsoli, która w ogóle drukuje podsumowanie, i milczeć, gdy
#     pliku nie ma — banner leci po buildzie, więc brak `.exe` nie może być wyjątkiem.
#
# Nic tu nie potrzebuje serwera, przeglądarki ani prawdziwej konsoli — `sys.stdout` jest podmieniany
# na atrapę, a `time.sleep` na licznik drzemek, więc test jest natychmiastowy.
import importlib.util
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANNER = os.path.join(ROOT, "tools", "build_banner.py")

try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass

_spec = importlib.util.spec_from_file_location("build_banner", BANNER)
banner = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(banner)

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  | " + str(detail)) if detail else ""))


class Fake(object):
    """Konsola-atrapa: zapamiętuje, co dostała, i kłamie o byciu terminalem tyle, ile trzeba."""

    def __init__(self, tty=True, encoding="utf-8"):
        self.chunks = []
        self._tty = tty
        # `printable()` pyta strumień o kodowanie. Bez tego pola wynik testu zależałby od tego,
        # gdzie go uruchomiono: w konsoli (utf-8) rysunek z ramkami przechodzi, w potoku pod
        # cp1250 nie. Atrapa udaje konsolę, a osobna sekcja niżej sprawdza drugi przypadek.
        self.encoding = encoding

    def write(self, s):
        self.chunks.append(s)
        return len(s)

    def flush(self):
        pass

    def isatty(self):
        return self._tty

    @property
    def text(self):
        return "".join(self.chunks)


class Clock(object):
    """Zamiast czekać — notuje, ile czekania by było."""

    def __init__(self):
        self.naps = []

    def sleep(self, seconds):
        self.naps.append(seconds)


def with_console(fn, tty=True, colour=None, env=None):
    """Uruchamia fn() z podmienionym stdout, zegarem i środowiskiem. Zwraca (Fake, Clock)."""
    out, clock = Fake(tty), Clock()
    old_out, old_time, old_colour = sys.stdout, banner.time, banner.COLOUR
    old_env = {k: os.environ.get(k) for k in (env or {})}
    try:
        for k, v in (env or {}).items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        sys.stdout, banner.time = out, clock
        if colour is not None:
            banner.COLOUR = colour
        fn()
    finally:
        sys.stdout, banner.time, banner.COLOUR = old_out, old_time, old_colour
        for k, v in old_env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
    return out, clock


def as_console(fn, encoding="utf-8"):
    """Uruchamia fn() tak, jakby po drugiej stronie stał terminal o danym kodowaniu. Potrzebne
    wszędzie, gdzie pada `art_for` — wybór rysunku zależy od tego, czy strumień umie napisać
    jego znaki, więc bez podstawienia wynik zależałby od tego, gdzie test uruchomiono."""
    old, sys.stdout = sys.stdout, Fake(True, encoding)
    try:
        return fn()
    finally:
        sys.stdout = old


def art_pair(kind="ok", width=120, spare=0, encoding="utf-8"):
    return as_console(lambda: banner.art_for(kind, width, spare), encoding)


def statics(art, ink, colour=False):
    """Wiersze tak, jak drukował je banner przed dodaniem wejścia. Kolor trzeba ustawić TUTAJ —
    `render` czyta globalne `COLOUR`, a `with_console` przywraca je zaraz po rysowaniu."""
    old, banner.COLOUR = banner.COLOUR, colour
    try:
        return [banner.render(l, ink[i] if i < len(ink) else "") for i, l in enumerate(art)]
    finally:
        banner.COLOUR = old


def settled(text):
    """To, co ZOSTAJE na ekranie: z każdej linii ostatnia klatka, bez końcowego \\x1b[K."""
    rows = []
    for seg in text.split("\n"):
        last = seg.split("\r")[-1]
        if last.endswith(banner.CLEAR):
            last = last[: -len(banner.CLEAR)]
        rows.append(last)
    while rows and rows[-1] == "":
        rows.pop()
    return rows


print("--- paleta: przyciemnienie zostaje w palecie i naprawdę przyciemnia ---")


def lum(index):
    if 16 <= index <= 231:
        n = index - 16
        return sum((0, 95, 135, 175, 215, 255)[c] for c in (n // 36, (n // 6) % 6, n % 6))
    if 232 <= index <= 255:
        return 3 * (8 + (index - 232) * 10)
    return 0


inks = sorted(set(banner.INK.values()))
check("factor 1.0 nie rusza indeksu", all(banner.shade(i, 1.0) == i for i in inks))
bad = [i for i in inks if not 0 <= banner.shade(i, banner.FADE[0]) <= 255]
check("przyciemniony indeks zostaje w zakresie 0-255", not bad, bad)
lighter = [i for i in inks if lum(banner.shade(i, banner.FADE[0])) >= lum(i)]
check("każda barwa palety faktycznie ciemnieje", not lighter, lighter)
check("klatki pośrednie kończą się na pełnej barwie", banner.FADE[-1] == 1.0, banner.FADE)

print("\n--- obraz po wejściu jest tym samym obrazem, co bez wejścia ---")
art, ink = art_pair("ok", 120)
check("najszerszy rysunek się wczytał", bool(art) and len(art) > 30, len(art or []))
for colour in (False, True):
    out, _ = with_console(lambda: banner.draw(art, ink, banner.ENTRANCE), colour=colour)
    check("kolor=%s: to, co zostaje na ekranie = stary rysunek" % colour,
          settled(out.text) == statics(art, ink, colour))
    check("kolor=%s: tyle wierszy, ile ma rysunek" % colour,
          out.text.count("\n") == len(art), out.text.count("\n"))

print("\n--- wiersz nadpisuje wyłącznie siebie ---")
out, _ = with_console(lambda: banner.draw(art, ink, banner.ENTRANCE), colour=True)
moves = re.findall(r"\x1b\[[0-9]*[A-DEFGHJSTfd]", out.text)
check("żadnego ruchu kursora poza \\r i \\x1b[K", not moves, sorted(set(moves))[:5])
check("z kolorem klatka pośrednia różni się od docelowej",
      any(len(seg.split("\r")) > 2 and seg.split("\r")[1] != seg.split("\r")[-1]
          for seg in out.text.split("\n")))
out, _ = with_console(lambda: banner.draw(art, ink, banner.ENTRANCE), colour=False)
check("bez koloru wejście nie emituje ani jednego escape'u", "\x1b" not in out.text)

print("\n--- nikt nie czeka ---")
check("ENTRANCE mieści się w ułamku sekundy", 0 < banner.ENTRANCE <= 1.0, banner.ENTRANCE)
check("BEAT jest tylko oddechem", 0 <= banner.BEAT <= 0.3, banner.BEAT)
worst = 0.0
for kind in ("ok", "fail"):
    for width in (120, 84, 64):
        a, i_ = art_pair(kind, width)
        if not a:
            continue
        for colour in (False, True):
            _, clock = with_console(lambda: banner.draw(a, i_, banner.ENTRANCE), colour=colour)
            worst = max(worst, sum(clock.naps))
            check("%s/%d kolor=%s: wejście trwa >= ENTRANCE" % (kind, width, colour),
                  sum(clock.naps) >= banner.ENTRANCE - 1e-6, sum(clock.naps))
check("najdłuższe wejście z drabinki + BEAT <= 1,2 s", worst + banner.BEAT <= 1.2, worst)

print("\n--- animujemy tylko wtedy, gdy po drugiej stronie jest konsola ---")
cases = [
    ("wyjście do pliku (nie-tty)", False, {}),
    ("RF_BANNER_STATIC=1", True, {"RF_BANNER_STATIC": "1"}),
    ("CI=1", True, {"CI": "1"}),
]
for label, tty, env in cases:
    full = dict({"RF_BANNER_STATIC": None, "CI": None, "COLUMNS": "120"}, **env)
    out, clock = with_console(lambda: banner.main(["ok"]), tty=tty, env=full)
    check("%s: zero drzemek" % label, clock.naps == [], clock.naps)
    check("%s: rysunek i tak jest" % label, len(out.text.split("\n")) > 30)
out, clock = with_console(lambda: banner.main(["ok"]), tty=True,
                          env={"RF_BANNER_STATIC": None, "CI": None, "COLUMNS": "120"})
check("konsola bez furtek: wejście się odbywa", len(clock.naps) > 10, len(clock.naps))
check("po rysunku jest oddech przed podsumowaniem", banner.BEAT in clock.naps)

print("\n--- Ctrl+C w trakcie kończy rysunek, nie zostawia pół żaby ---")
real_land = banner.land
STOP_AT = 5


def impatient(line, key_row, step):
    if impatient.seen == STOP_AT:
        raise KeyboardInterrupt
    impatient.seen += 1
    return real_land(line, key_row, step)


for colour in (False, True):
    impatient.seen = 0
    banner.land = impatient
    try:
        out, clock = with_console(lambda: banner.draw(art, ink, banner.ENTRANCE), colour=colour)
    finally:
        banner.land = real_land
    check("kolor=%s: Ctrl+C nie gubi ani jednego wiersza" % colour,
          settled(out.text) == statics(art, ink, colour))
    check("kolor=%s: po przerwaniu nikt już nie czeka" % colour,
          len(clock.naps) <= STOP_AT * len(banner.FADE), len(clock.naps))

print("\n--- wąska konsola: sama proza, bez animacji czegokolwiek ---")
out, clock = with_console(lambda: banner.main(["ok"]), tty=True,
                          env={"RF_BANNER_STATIC": None, "CI": None, "COLUMNS": "40"})
check("poniżej najwęższego rysunku nie ma co animować", clock.naps == [], clock.naps)
check("podsumowanie mimo to pada", "BUILD OK" in out.text)

print("\n--- napis startowy: ribbit białe, FLIP różowe ---")
WIDE = art_pair("start", 200)[0]
WORD_LADDER = [("szeroki", 200), ("wąski", max(len(l) for l in WIDE) - 1)]
for label, room in WORD_LADDER:
    a, i_ = art_pair("start", room)
    check("%s: rysunek mieści się w %d kolumnach" % (label, room),
          bool(a) and banner.PAD + max(len(l) for l in a) <= room,
          (banner.PAD, max(len(l) for l in (a or [""]))))
    holes = [(r, c) for r, line in enumerate(a) for c, ch in enumerate(line)
             if ch != " " and (r >= len(i_) or c >= len(i_[r]) or i_[r][c] == " ")]
    check("%s: każdy znak rysunku ma barwę" % label, not holes, holes[:3])
    letters = set(ch for row in i_ for ch in row if ch != " ")
    check("%s: barwy są dokładnie dwie" % label, letters == {"w", "P"}, sorted(letters))
    white = [c for row in i_ for c, ch in enumerate(row) if ch == "w"]
    pink = [c for row in i_ for c, ch in enumerate(row) if ch == "P"]
    check("%s: biel kończy się tam, gdzie zaczyna róż" % label,
          bool(white) and bool(pink) and max(white) < min(pink),
          (max(white or [-1]), min(pink or [-1])))
    old, banner.COLOUR = banner.COLOUR, True
    try:
        painted = "".join(banner.render(l, i_[k] if k < len(i_) else "") for k, l in enumerate(a))
    finally:
        banner.COLOUR = old
    codes = set(re.findall(r"\x1b\[38;5;(\d+)m", painted))
    check("%s: na ekranie lądują barwy 'w' i 'P' z palety" % label,
          codes == {str(banner.INK["w"]), str(banner.INK["P"])}, sorted(codes))
check("poniżej najwęższego rysunku zostaje proza", art_pair("start", 12)[0] is None)

print("\n--- okno na styk: rysunek oddaje margines, nie szczegóły ---")
# Margines był do 2026-09-22 rezerwowany z OBU stron, choć prawy nigdy nie jest drukowany — przez
# to rysunek szeroki dokładnie na okno spadał o szczebel niżej z powodu dwóch niewidocznych kolumn.
tight = max(len(l) for l in WIDE)
a, i_ = art_pair("start", tight)
check("okno dokładnie na rysunek bierze TEN SAM rysunek",
      bool(a) and max(len(l) for l in a) == tight, max(len(l) for l in (a or [""])))
check("i drukuje go bez marginesu", banner.PAD == 0, banner.PAD)
# Przy PAD 0 kursor po ostatnim znaku stoi w ostatniej kratce, a kasowanie do końca linii
# wyczyściłoby właśnie tę kratkę — czyli zjadło ostatni znak wiersza.
out, _ = with_console(lambda: banner.draw(a, i_, banner.ENTRANCE), colour=True)
check("bez marginesu nie ma czyszczenia do końca linii", banner.CLEAR not in out.text)
check("każdy wiersz kończy się swoim znakiem",
      all(not row.split("\r")[-1].endswith(" ") for row in out.text.split("\n") if row.strip()))
a2, _ = art_pair("start", tight, spare=1)
check("konsola bez VT (kolumna zapasowa) schodzi o szczebel niżej",
      a2 is None or max(len(l) for l in a2) < tight, max(len(l) for l in (a2 or [""])))
check("żaba przy 120 kolumnach nadal z pełnym marginesem",
      bool(art_pair("ok", 120)[0]) and banner.PAD == banner.MARGIN, banner.PAD)

print("\n--- rysunek, którego strumień nie umie napisać, nie jest wybierany ---")
# Rysunki bywają z ramek (U+2550…), a te w potoku pod stroną kodową 1250 nie tyle brzydko wyglądają,
# co WYWALAJĄ print(). Lepszy jest szczebel niżej albo sama proza niż seria znaków zapytania.
for enc in ("utf-8", "cp1250", "ascii"):
    for room in (200, 80, 40, 20):
        got = art_pair("start", room, encoding=enc)[0]
        try:
            "\n".join(got or []).encode(enc)
            fine = True
        except Exception:
            fine = False
        check("%s przy %d kolumnach: wybrany rysunek da się napisać" % (enc, room), fine,
              (got or [""])[0][:20])
banner_chars = set("".join(WIDE) + "".join(art_pair("start", 40)[0] or []))
check("drabinka napisu ma rysunek spoza ASCII (inaczej ta sekcja niczego nie pilnuje)",
      any(ord(c) > 127 for c in banner_chars))

print("\n--- napis schodzi tak samo szybko jak żaba i czaszka ---")
# Napis ma się pojawiać tak szybko jak żaba i czaszka (wcześniej pokazywał się bardzo
# powoli). Napis miał przez pół dnia
# własne, dłuższe wejście — teraz jest jedno ENTRANCE dla wszystkich trzech rysunków.
check("napis nie ma własnego wejścia", not hasattr(banner, "WORDMARK_ENTRANCE"))
check("tempo to wejście najwyższego rysunku rozłożone na jego wiersze",
      abs(banner.PACE * 50 - banner.ENTRANCE) < 1e-9, banner.PACE)
clean = {"RF_BANNER_STATIC": None, "CI": None, "COLUMNS": "130"}
out, clock = with_console(lambda: banner.main(["start"]), tty=True, env=clean)
rows = len(WIDE)
check("napis schodzi wierszami", len(clock.naps) >= rows, len(clock.naps))
check("i w tempie rysunków, nie w ich czasie",
      rows * banner.PACE - 1e-6 <= sum(clock.naps) <= rows * banner.PACE + 0.05, sum(clock.naps))
_, frog = with_console(lambda: banner.main(["ok"]), tty=True, env=clean)
check("czyli szybciej niż żaba, bo jest niższy", sum(clock.naps) < sum(frog.naps),
      (sum(clock.naps), sum(frog.naps)))
check("napis nie orzeka niczego o buildzie", "BUILD" not in out.text)
check("po napisie nie ma oddechu na podsumowanie", banner.BEAT not in clock.naps)
moves = re.findall(r"\x1b\[[0-9]*[A-DEFGHJSTfd]", out.text)
check("napis też nie rusza kursorem poza \\r i \\x1b[K", not moves, sorted(set(moves))[:5])
for label, tty, env in cases:
    out, clock = with_console(lambda: banner.main(["start"]), tty=tty, env=dict(clean, **env))
    check("napis, %s: zero drzemek" % label, clock.naps == [], clock.naps)
    check("napis, %s: i tak się pojawia" % label, len(out.text.split("\n")) > 10)
out, clock = with_console(lambda: banner.main(["start"]), tty=True, env=dict(clean, COLUMNS="12"))
check("wąska konsola: sama nazwa jedną linią", "RibbitFlip" in out.text)
check("wąska konsola: nie ma czego animować", clock.naps == [], clock.naps)

print("\n--- suma kontrolna pod żabą ---")
import hashlib
import tempfile

blob = os.urandom(3000)
handle, tmp = tempfile.mkstemp(prefix="rf-banner-")
os.write(handle, blob)
os.close(handle)
try:
    check("suma zgadza się z hashlib", banner.digest(tmp) == hashlib.sha256(blob).hexdigest())
    check("brak pliku to None, nie wyjątek", banner.digest(tmp + ".nie-ma") is None)
    old_exe, banner.EXE = banner.EXE, tmp
    try:
        out, _ = with_console(lambda: banner.main(["ok"]), tty=True,
                              env=dict(clean, RF_BANNER_STATIC="1"))
        line = [l for l in out.text.split("\n") if "SHA-256" in l]
        check("pod podsumowaniem jest jedna linia z sumą", len(line) == 1, line)
        check("i jest w niej ta suma", hashlib.sha256(blob).hexdigest() in line[0])
        check("mieści się w 80 kolumnach", len(line[0]) <= 80, len(line[0]))
        old_art, banner.ART_FILE = banner.ART_FILE, banner.ART_FILE + ".nie-ma"
        try:
            out, _ = with_console(lambda: banner.main(["start"]), tty=True,
                                  env=dict(clean, RF_BANNER_STATIC="1"))
            check("bez pliku rysunku zostaje sama nazwa", "RibbitFlip" in out.text)
            out, _ = with_console(lambda: banner.main(["ok"]), tty=True,
                                  env=dict(clean, RF_BANNER_STATIC="1"))
            check("bez pliku rysunku fakty i suma i tak padają",
                  "BUILD OK" in out.text and "SHA-256" in out.text)
        finally:
            banner.ART_FILE = old_art
        banner.EXE = tmp + ".nie-ma"
        out, _ = with_console(lambda: banner.main(["ok"]), tty=True,
                              env=dict(clean, RF_BANNER_STATIC="1"))
        check("bez pliku banner o sumie milczy", "SHA-256" not in out.text)
        check("ale build nadal jest OK", "BUILD OK" in out.text)
    finally:
        banner.EXE = old_exe
finally:
    os.unlink(tmp)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
