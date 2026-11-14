# SEVERAL OVERLAYS FOR ONE CAPSULE. Run: py tests/test_overlay_multi.py
#
# The overlay used to be one window per capsule, keyed by the capsule's slot. It is now one window
# per WINDOW: the stick can sit on the left of the screen and the button presses on the right, each
# in its own frame with its own switches. This checks the part of that which is arithmetic and
# bookkeeping — no Windows windows are opened here, and none are needed:
#
#   * the id ↔ capsule mapping, in both directions and for the ids written before today,
#   * what a window is CALLED (the tray, the panel and each window's own bar all ask this one
#     function, so it is the one place they can disagree),
#   * the manager: making, listing, copying, forgetting — and the two refusals that keep the model
#     honest (a capsule's last window is not removable; asking about a window does not create it),
#   * that two windows of one capsule really are independent, which is the whole point,
#   * the settings file: a config written before windows had ids loads as the capsule's first one.
import json
import os
import sys
import tempfile
import types

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
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


def mgr(seed=None):
    """A manager on a settings file of its own, never able to launch a browser (nothing here opens
    a window — `add` only does that when it is handed an address, and no test hands it one)."""
    path = os.path.join(tempfile.mkdtemp(prefix="rf-ovl-"), "ribbitflip_overlay.json")
    if seed is not None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(seed, f)
    rf.OVERLAY_CONFIG_FILE = path
    m = rf.OverlayManager()
    m.available = lambda: (True, "")     # "is there a Chromium here" is not what these tests are about
    return m, path


print("\n--- a window id carries its capsule ---")
check("a plain slot IS a window id — the capsule's first",
      rf.overlay_dev_of("d0") == "d0")
check("the second window of the same capsule", rf.overlay_dev_of("d0~2") == "d0")
check("…and the tenth", rf.overlay_dev_of("d1~10") == "d1")
check("nothing in, nothing out", rf.overlay_dev_of("") == "" and rf.overlay_dev_of(None) == "")

print("\n--- what a window is called ---")
check("one unnamed window is simply the capsule (no '· 1' about a choice nobody made)",
      rf.overlay_window_title("Triki 1", "", 0, 1) == "Triki 1")
check("named, and the name wins",
      rf.overlay_window_title("Triki 1", "drążek", 0, 2) == "Triki 1 · drążek")
check("unnamed, but no longer alone -> its number",
      rf.overlay_window_title("Triki 1", "", 1, 2) == "Triki 1 · 2")
check("whitespace is not a name", rf.overlay_window_title("Triki 1", "   ", 0, 1) == "Triki 1")

print("\n--- the name, as it arrives from the page ---")
_c = rf._sanitize_overlay_win({"label": "  drążek  "})
check("trimmed", _c["label"] == "drążek", _c["label"])
check("length-capped (it is drawn on a strip a few centimetres wide)",
      len(rf._sanitize_overlay_win({"label": "x" * 90})["label"]) == 24)
check("no name is an empty name, not a missing key",
      rf._sanitize_overlay_win({})["label"] == "")
check("null clears it", rf._sanitize_overlay_win({"label": None})["label"] == "")

print("\n--- making, listing, forgetting ---")
M, CFG_PATH = mgr()
check("a capsule with no overlay has no window stored", M.wids_for("d0") == [])
check("…and asking about one does NOT bring it into being",
      M.state("d0")["window"]["exists"] is False and M.wids_for("d0") == [], list(M.wins))
w0 = M.first_wid("d0", create=True)
check("the first window of a capsule keeps the plain slot as its id (so do its settings, and its "
      "browser profile)", w0 == "d0", w0)
w1, err = M.add("d0")
check("a second window gets a suffixed id", (w1, err) == ("d0~2", ""), (w1, err))
w2, _ = M.add("d0")
check("and a third", w2 == "d0~3", w2)
check("listed oldest first — the order the tray shows and the numbers come from",
      M.wids_for("d0") == ["d0", "d0~2", "d0~3"], M.wids_for("d0"))
check("another capsule is untouched by all of it", M.wids_for("d1") == [])
check("first_wid still answers the callers that only know a capsule",
      M.first_wid("d0") == "d0")

print("\n--- one more window starts as a copy of the first, minus two things ---")
M.configure("d0", {"theme": "bare", "opacity": 55, "label": "drążek",
                   "show": {"pad": True, "rules": False}, "x": 100, "y": 200})
w3, _ = M.add("d0")
c3 = M.wins[w3].cfg
check("the look is inherited — that is what 'one more of these' means",
      c3["theme"] == "bare" and c3["opacity"] == 55 and c3["show"]["pad"] is True, c3["theme"])
check("the POSITION is not: it would land exactly on the window it was copied from and look like "
      "nothing had happened", c3["x"] is None and c3["y"] is None, (c3["x"], c3["y"]))
check("the NAME is not: it is the owner's to give", c3["label"] == "", c3["label"])
# WHICH window it copies: the panel's ＋ belongs to a capsule and gets its first window; the one in
# an overlay's own drawer belongs to THAT window, and "another one like this" has to mean this one.
M.configure("d0~2", {"theme": "dark", "opacity": 33})
w4, _ = M.add("d0", src="d0~2")
check("asked from inside a window, the copy is of THAT window",
      M.wins[w4].cfg["theme"] == "dark" and M.wins[w4].cfg["opacity"] == 33,
      (M.wins[w4].cfg["theme"], M.wins[w4].cfg["opacity"]))
w5, _ = M.add("d0", src="d1~9")     # another capsule's window, or a typo
check("a source that is not this capsule's is ignored rather than obeyed",
      M.wins[w5].cfg["theme"] == "bare", M.wins[w5].cfg["theme"])
for _w in (w4, w5):
    M.remove(_w)

print("\n--- two windows of one capsule are independent ---")
M.configure("d0~2", {"theme": "felt", "show": {"pose": False}, "label": "klikanie"})
a, b = M.wins["d0"].cfg, M.wins["d0~2"].cfg
check("the second one's look did not leak into the first",
      a["theme"] == "bare" and b["theme"] == "felt", (a["theme"], b["theme"]))
check("nor did its switches", a["show"]["pose"] is True and b["show"]["pose"] is False)
check("nor its name", a["label"] == "drążek" and b["label"] == "klikanie")
check("both still belong to the same capsule",
      M.wins["d0"].dev == "d0" and M.wins["d0~2"].dev == "d0")

print("\n--- forgetting one ---")
ok, why = M.remove("d0~3")
check("an extra window can be removed", ok and not why, (ok, why))
check("…and it is gone from the list", "d0~3" not in M.wids_for("d0"), M.wids_for("d0"))
for _w in list(M.wids_for("d0"))[1:]:
    M.remove(_w)
ok, why = M.remove("d0")
check("the LAST window of a capsule is not removable — it is the switch itself",
      ok is False and why, (ok, why))
check("so it is still there", M.wids_for("d0") == ["d0"])
check("removing something that was never there is not an error", M.remove("d9~7")[0] is True)

print("\n--- a stop, not a design limit ---")
M2, _ = mgr()
M2.first_wid("d0", create=True)
made = [M2.add("d0")[0] for _ in range(rf.OVERLAY_MAX_PER_DEV + 2)]
check("it stops at the ceiling and says why rather than making window 500",
      len([m for m in made if m]) == rf.OVERLAY_MAX_PER_DEV - 1        # one was already there
      and len(M2.wids_for("d0")) == rf.OVERLAY_MAX_PER_DEV,
      (len(M2.wids_for("d0")), made))
check("and the refusal is a sentence, not silence", bool(M2.add("d0")[1]))

print("\n--- what the tray and the panel list ---")
M3, _ = mgr()
M3.first_wid("d0", create=True)
M3.add("d0")
rows = M3.rows([("d0", "Triki 1"), ("d1", "Triki 2")])
check("a row per window, plus a row for the capsule that has none yet",
      [r["win"] for r in rows] == ["d0", "d0~2", "d1"], [r["win"] for r in rows])
check("two windows of one capsule are told apart by their number",
      [r["title"] for r in rows[:2]] == ["Triki 1 · 1", "Triki 1 · 2"], [r["title"] for r in rows])
M3.configure("d0~2", {"label": "klikanie"})
rows = M3.rows([("d0", "Triki 1"), ("d1", "Triki 2")])
check("…and by their name once one has been given",
      rows[1]["title"] == "Triki 1 · klikanie", rows[1]["title"])
check("the capsule with no overlay is listed as itself, and marked as not yet made",
      rows[2]["title"] == "Triki 2" and rows[2]["exists"] is False, rows[2])
check("nothing running, and nothing pretending to be",
      not any(r["running"] for r in rows))

print("\n--- the settings file ---")
# The path is a module global (that is how load and save find it), so point it back at M's own
# file: every manager made since then has moved it to theirs.
rf.OVERLAY_CONFIG_FILE = CFG_PATH
M._save_now()
with open(CFG_PATH, "r", encoding="utf-8") as f:
    saved = json.load(f)
check("keyed by window id", list(saved["windows"].keys()) == ["d0"], list(saved["windows"]))
check("with the name in it", saved["windows"]["d0"]["label"] == "drążek")

# A file written before a capsule could have more than one window: plain slot names, no label key.
M4, _ = mgr({"windows": {"d0": {"theme": "dark", "x": 40, "y": 60, "w": 320, "h": 400},
                         "d1": {"theme": "felt"}}})
check("an old settings file loads with nothing to migrate — those keys ARE window ids",
      sorted(M4.wins) == ["d0", "d1"], sorted(M4.wins))
check("…each one its capsule's first window",
      M4.first_wid("d0") == "d0" and M4.wins["d0"].dev == "d0")
check("what it said is kept", M4.wins["d0"].cfg["theme"] == "dark" and M4.wins["d0"].cfg["x"] == 40)
check("what it never heard of gets a default", M4.wins["d0"].cfg["label"] == "")
check("and one more window can be added next to it", M4.add("d0")[0] == "d0~2")

print("\n--- the capsule-level switch, with several windows behind it ---")
M5, _ = mgr()
M5.first_wid("d0", create=True)
M5.add("d0")
check("nothing is running, so the capsule reads as off", M5.running_for("d0") == [])


class _FakeProc:
    """A window that is up, without a window: `running()` asks the process first."""

    def poll(self):
        return None


M5.wins["d0~2"].proc = _FakeProc()
check("one window up = the capsule is on (that is what the pill and the tray row show)",
      M5.running_for("d0") == ["d0~2"], M5.running_for("d0"))
check("…and 'any overlay at all' agrees", M5.state()["anyRunning"] is True)

print("\n--- the window's own bar, as a setting ---")
# 2026-09-03, wymaganie: „dodaj możliwość wyłączenia handla nakładki (wtedy edycja
# pozycji jest możliwa wyłącznie poprzez stronę)". Trzy rzeczy muszą być prawdą naraz: domyślnie
# pasek JEST, plik sprzed tej zmiany też go ma, a okno bez paska nie zostawia nad grą ani jednego
# niewidzialnego prostokąta, który łapie mysz.
check("pasek jest domyślnie", rf.OVERLAY_WIN_DEFAULTS["winBar"] is True)
check("…a więc plik ustawień sprzed tej zmiany opisuje okna Z paskiem, a nie bez",
      rf._sanitize_overlay_win({})["winBar"] is True)
check("wyłączenie przechodzi", rf._sanitize_overlay_win({"winBar": False})["winBar"] is False)
check("i wraca", rf._sanitize_overlay_win({"winBar": True},
                                          base=rf._sanitize_overlay_win({"winBar": False}))["winBar"] is True)
check("cokolwiek innego jest czytane jako prawda/fałsz, a nie przepisywane",
      rf._sanitize_overlay_win({"winBar": "nie"})["winBar"] is True
      and rf._sanitize_overlay_win({"winBar": 0})["winBar"] is False)
M6, _ = mgr()
_w = M6._mk("d0")
_w.cfg.update({"x": 100, "y": 100, "w": 400, "h": 500})
_w.grab = 60
check("okno z paskiem trzyma go klikalnym — to jest wyjście z „przepuszczaj kliknięcia”",
      _w.has_bar() is True and _w.in_grab(150, 120) is True)
check("…i tylko pasek, nie całą treść", _w.in_grab(150, 300) is False)
_w.cfg["winBar"] = False
check("bez paska nie ma czego trzymać klikalnym: nad grą nie zostaje niewidzialny prostokąt "
      "zjadający kliknięcia", _w.has_bar() is False and _w.in_grab(150, 120) is False)
check("…i stan mówi to samo, co in_grab (panel i testy czytają jedną odpowiedź)",
      _w.state()["grab"] == 0 and _w.state()["hasBar"] is False, _w.state()["grab"])
_w.cfg["winBar"] = True
check("z powrotem włączony pasek znów melduje swoją wysokość",
      _w.state()["grab"] == 60 and _w.state()["hasBar"] is True)
# Okno koła nie ma paska NIGDY — stoi dokładnie tam, gdzie patrzą oczy w chwili wyboru, a klikalny
# pasek zjadałby kliknięcie zatwierdzające. Ustawienie go nie dotyczy.
#
# ODPOWIEDŹ PADA DWA RAZY, I OBIE MUSZĄ BYĆ „nie" (2026-09-06). Do dziś to okno rodziło się
# z `winBar: True` (dziedziczonym po zwykłej nakładce) i dopiero `has_bar()` mówiło „nie" —
# czyli serwer trzymał u siebie NIENARYSOWANY prostokąt, a przed jego skutkami chronił jeden
# warunek po drodze. Teraz „nie" stoi już w DANYCH (OVERLAY_WHEEL_DEFAULTS["winBar"]), a warunek
# zostaje jako druga linia: konfiguracja przychodzi też z panelu i z zasobnika, więc ktoś może
# to okno opisać „z paskiem" i odpowiedź dalej ma brzmieć tak samo.
_k = M6._mk(rf.overlay_wheel_wid("d0"))
check("okno koła rodzi się BEZ paska — nie ma niewidzialnego prostokąta do obrony",
      _k.cfg.get("winBar") is False and _k.has_bar() is False)
_k.cfg["winBar"] = True
check("…a nawet opisane „z paskiem” dalej go nie ma: paska pod kołem być nie może",
      _k.has_bar() is False and _k.in_grab(150, 120) is False)
_k.cfg["winBar"] = False
check("…a okno, o które panel dopytał, zanim powstało, odpowiada tym samym",
      M6.state("d9~kolo")["window"]["hasBar"] is False
      and M6.state("d9")["window"]["hasBar"] is True)

print("\n--- what the panel is handed ---")
st = M5.state()
check("windows keyed by id, each saying whose capsule it is",
      st["windows"]["d0~2"]["dev"] == "d0" and st["windows"]["d0~2"]["win"] == "d0~2",
      st["windows"]["d0~2"])
check("in a stated order — the panel numbers them by it",
      st["order"][:2] == ["d0", "d0~2"], st["order"])
# (Spelled out rather than drawn with the fullwidth plus the button wears: a Polish console is
#  cp1250 and printing that character kills the run before the result is in.)
check("and the ceiling is published, so the plus button can say when it is out of room",
      st["maxPerDev"] == rf.OVERLAY_MAX_PER_DEV)
one = M5.state("d0~2")["window"]
check("asking about one window answers about that one",
      one["win"] == "d0~2" and one["running"] is True and one["exists"] is True, one)

print("\n--- the tray's row per window: a checkbox that closes as well as opens ---")
# ZGŁOSZENIE WŁAŚCICIELA (2026-09-03): „zamykać się nie da przez tray". Ten blok trzyma trzy
# rzeczy, z których każda po cichu przestałaby działać przy najbliższej zmianie menu:
#   • wiersz jest PRZEŁĄCZNIKIEM, a nie „otwórz": okno stojące na ekranie dostaje `close`;
#   • `checked=` jest FUNKCJĄ, nie wartością — inaczej ptaszek zamarzłby na stanie z chwili
#     zbudowania menu, a na Windows menu buduje się raz (patrz `tray_menu_refresh`);
#   • podmenu powstaje z FUNKCJI (`pystray.Menu(callable)`), więc okno dołożone albo zamknięte
#     gdzie indziej pojawia się w nim przy najbliższym przebudowaniu.
# Bez prawdziwego pystray i bez ikony w zasobniku: podstawiamy moduł, bo to jedyne, czego dotyka
# `_start_tray_thread`, a prawdziwa ikona byłaby oknem na biurku uruchamiającego test.


class _TrayMenuItem:
    def __init__(self, text, action, checked=None, radio=False, default=False,
                 visible=True, enabled=True):
        self.src, self.action, self.chk = text, action, checked

    @property
    def text(self):
        return self.src() if callable(self.src) else self.src

    @property
    def checked(self):
        return self.chk(self) if callable(self.chk) else self.chk


class _TrayMenu:
    SEPARATOR = object()

    def __init__(self, *items):
        self._items = items

    @property
    def items(self):
        one = self._items[0] if len(self._items) == 1 else None
        if one is not None and not isinstance(one, _TrayMenuItem) and callable(one):
            return one()          # …tak samo, jak robi to prawdziwy pystray (Menu.items)
        return self._items


class _TrayIcon:
    def __init__(self, *a, **k):
        self.menu = a[3] if len(a) > 3 else None

    def run(self):
        pass

    def update_menu(self):
        pass


class _TrayWin:
    """Okno, które albo stoi na ekranie, albo nie — bez Windows i bez przeglądarki."""

    def __init__(self, up):
        self.up = up
        self.cfg = {"label": ""}

    def running(self):
        return self.up


class _TrayOverlay:
    def __init__(self):
        self.wins = {"d0": _TrayWin(True), "d0~2": _TrayWin(False)}
        self.did = []

    def rows(self, devices):
        return [{"win": w, "dev": "d0", "title": "Triki 1 - " + w,
                 "running": self.wins[w].running(), "exists": True} for w in self.wins]

    def open(self, wid, url):
        self.did.append(("open", wid))
        self.wins[wid].up = True

    def close(self, wid):
        self.did.append(("close", wid))
        self.wins[wid].up = False

    def close_all(self):
        self.did.append(("close_all",))

    def state(self, win=None):
        return {"anyRunning": any(w.running() for w in self.wins.values())}


class _TrayDev:
    def __init__(self, i, n):
        self.id, self.name = i, n


class _TrayDM:
    def all(self):
        return [_TrayDev("d0", "Triki 1")]


_tray_mod = types.ModuleType("pystray")
_tray_mod.Menu, _tray_mod.MenuItem, _tray_mod.Icon = _TrayMenu, _TrayMenuItem, _TrayIcon
_saved = (sys.modules.get("pystray"), rf.OVERLAY, rf._make_tray_image, rf.NOTIFIER._icon)
try:
    sys.modules["pystray"] = _tray_mod
    FAKE = _TrayOverlay()
    rf.OVERLAY = FAKE
    rf._make_tray_image = lambda: None
    holder = {}
    started = rf._start_tray_thread("http://127.0.0.1:8770/", lambda: None, holder, _TrayDM())
    check("menu w zasobniku się zbudowało", started and holder.get("icon") is not None)
    top = [i for i in holder["icon"].menu.items if i is not _TrayMenu.SEPARATOR]
    ovl = [i for i in top if "adki na wierzchu" in i.text or "Overlays on top" in i.text]
    check("jest pozycja „Nakładki na wierzchu”", len(ovl) == 1, [i.text for i in top])
    sub = [i for i in ovl[0].action.items if i is not _TrayMenu.SEPARATOR]
    rows_ = [i for i in sub if i.text.startswith("Triki 1 - ")]
    check("po jednym wierszu na okno, nazwanym tak, jak w panelu i na pasku okna",
          [i.text for i in rows_] == ["Triki 1 - d0", "Triki 1 - d0~2"], [i.text for i in rows_])
    check("wiersz jest PTASZKIEM: okno stojące na ekranie jest odhaczone, pozostałe nie",
          [i.checked for i in rows_] == [True, False], [i.checked for i in rows_])
    check("…a ptaszek jest funkcją, więc czyta stan okna, a nie zapamiętaną wartość",
          all(callable(i.chk) for i in rows_))
    rows_[0].action(holder["icon"], rows_[0])
    check("kliknięcie wiersza okna, które STOI, zamyka je (to jest zgłoszona usterka)",
          FAKE.did == [("close", "d0")], FAKE.did)
    check("…i ptaszek gaśnie sam, bo czyta okno", rows_[0].checked is False)
    rows_[1].action(holder["icon"], rows_[1])
    check("kliknięcie wiersza okna, którego NIE MA na ekranie, otwiera je",
          FAKE.did == [("close", "d0"), ("open", "d0~2")], FAKE.did)
    check("…i to samo w drugą stronę: teraz ten wiersz jest odhaczony",
          rows_[1].checked is True)
    # PODMENU POWSTAJE Z FUNKCJI. Gdyby było zbudowaną raz listą, okno dołożone gdzie indziej
    # (panel, szuflada ⚙, drugi egzemplarz tego menu) nie pojawiłoby się w nim nigdy.
    FAKE.wins["d0~3"] = _TrayWin(False)
    again = [i.text for i in ovl[0].action.items
             if i is not _TrayMenu.SEPARATOR and i.text.startswith("Triki 1 - ")]
    check("podmenu liczy się na nowo przy każdym otwarciu — nowe okno jest w nim od razu",
          again == ["Triki 1 - d0", "Triki 1 - d0~2", "Triki 1 - d0~3"], again)
    close_all = [i for i in sub if "Zamknij wszystkie" in i.text or "Close all" in i.text]
    check("„Zamknij wszystkie” zostaje — to jedyne wyjście z nakładki przepuszczającej kliknięcia",
          len(close_all) == 1)
finally:
    if _saved[0] is None:
        sys.modules.pop("pystray", None)
    else:
        sys.modules["pystray"] = _saved[0]
    rf.OVERLAY, rf._make_tray_image, rf.NOTIFIER._icon = _saved[1], _saved[2], _saved[3]

print("\n--- and the tick stays honest when a window goes away by itself ---")
# ⚠️ TO JEST WŁAŚCIWA PRZYCZYNA „zamykać się nie da przez tray". Na Windows pystray BUDUJE MENU RAZ
# (Icon.update_menu → jeden HMENU; popup już go tylko pokazuje), więc ptaszek jest MIGAWKĄ. Okno
# zamknięte przez aplikację przebudowuje menu samo — ale okno, które zniknęło samo (ktoś zamknął
# jego okno przeglądarki, przeglądarka padła), nie mówiło nikomu. Wiersz zostawał odhaczony przy
# oknie, którego już nie było, a naciśnięcie go OTWIERAŁO drugie zamiast cokolwiek zamknąć.
# Pilnuje tego teraz obserwator w OverlayManager._thru_watch: raz na sekundę porównuje, które okna
# stoją, i przy zmianie każe przebudować menu.
if sys.platform == "win32":
    import threading
    import time

    M10, _ = mgr()
    M10.first_wid("d0", create=True)
    _hits = []
    _real_refresh = rf.tray_menu_refresh
    try:
        rf.tray_menu_refresh = lambda: _hits.append(1)
        threading.Thread(target=M10._thru_watch, name="test-overlay-watch", daemon=True).start()
        time.sleep(1.3)
        _base = len(_hits)                      # pierwsze przejście ustala punkt odniesienia
        M10.wins["d0"].proc = _FakeProc()       # …okno „wstało" bez wiedzy aplikacji
        time.sleep(1.6)
        check("obserwator zauważa okno, które pojawiło się bez udziału aplikacji",
              len(_hits) > _base, (len(_hits), _base))
        _mid = len(_hits)
        M10.wins["d0"].proc = None              # …i zniknęło tak samo cicho
        time.sleep(1.6)
        check("…i takie, które zniknęło samo — czyli ptaszek w zasobniku przestaje kłamać",
              len(_hits) > _mid, (len(_hits), _mid))
        _end = len(_hits)
        time.sleep(1.6)
        check("bez zmiany nic nie przebudowuje menu (inaczej byłoby to odświeżanie co sekundę)",
              len(_hits) == _end, (len(_hits), _end))
    finally:
        rf.tray_menu_refresh = _real_refresh
        M10.wins.clear()                        # wątek jest demonem: zostawiamy mu pustą listę
else:
    print("POMINIETO  obserwator nakladek (tylko Windows)")

print("\n%d PASS / %d FAIL" % (_passed, _failed))
sys.exit(1 if _failed else 0)
