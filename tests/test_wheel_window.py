# KOLO WYBORU PRZY KURSORZE. Run: py tests/test_wheel_window.py
#
# The feature: the koło wyboru can be drawn in a floating window of its own, centred ON THE MOUSE
# POINTER — where the eyes already are at the moment of choosing — instead of in whatever corner an
# overlay happens to have been parked in.
#
# It is deliberately NOT a new mechanism. It is one more overlay window, with a reserved id and one
# new flag (`followCursor`), so everything that already works for overlays works for it: on top,
# cut-out background, per-window settings, the settings file. What is new, and what is tested here:
#
#   * WHERE THE WINDOW GOES. Centred on the pointer and pushed back onto the screen the pointer is
#     on — including a monitor to the LEFT of the primary one, whose coordinates are negative. This
#     is the whole of the arithmetic and it is testable without a desktop, so it is tested without
#     one.
#   * ONCE, ON THE OPEN EDGE. The window is moved when the wheel APPEARS and at no other time: a
#     drawing that slid after the cursor while a slice was being aimed at would move the target
#     under the hand. So the engine says "it opened" exactly once per opening.
#   * IT NEVER TAKES A CLICK. It sits directly under the pointer, and in three of the five modes
#     the very next click is the one that CONFIRMS the choice. `in_grab` — the strip an ordinary
#     overlay keeps clickable — must answer "no" for this window, always.
#   * IT IS NOT ONE OF THE OVERLAYS ANYBODY PLACED. Out of every list (the tray, the panel, "open
#     all", the capsule switch), because one window with two switches in two places is a window
#     whose state nobody can predict — but answerable BY NAME, which is how its own card reads it.
#   * THE DEFAULTS IT IS BORN WITH. A plain "open" on that id must give a bare, click-through,
#     wheel-only square — not a 400x560 felt card carrying the whole cheat sheet over the pointer.
#     Sprawdzane PETLA po wszystkich czesciach sciagi, a nie wyliczanka nazw: wyliczanka jest
#     dokladnie tym, co 2026-09-01 przepuscilo spis wycinkow („wheel.list") nad gre.
#   * …I NIE ZAWSZE POD WSKAZNIKIEM (2026-09-06). „Na srodku ekranu" (showWhere == "center") to
#     DOKLADNIE to samo okno — ten sam id, ta sama zawartosc, ta sama nieklikalnosc — tylko
#     nieruchome i wysrodkowane. Wszystko, co pyta „czy to okno kola", pyta wiec PO IDENTYFIKATORZE,
#     a nie po tym, czy akurat chodzi za mysza; jedynym wyjatkiem jest przesuwanie na otwarcie kola,
#     bo tam „czy ma sie ruszyc" JEST tym pytaniem.
#
# Nothing here touches the owner's desktop or Settings/: the manager gets a settings file in a
# temporary folder, no window is ever opened, and the wheel engine is driven directly.
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

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
    """A manager on a settings file of its own, which can never launch a browser."""
    path = os.path.join(tempfile.mkdtemp(prefix="rf-wheelwin-"), "ribbitflip_overlay.json")
    if seed is not None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(seed, f)
    rf.OVERLAY_CONFIG_FILE = path
    m = rf.OverlayManager()
    m.available = lambda: (True, "")
    return m, path


# Two screens, side by side, with the SECOND one to the LEFT of the primary — which is what makes
# its x negative and is the case a "clamp to 0" would silently get wrong.
LEFT = {"x": -1920, "y": 0, "w": 1920, "h": 1080}
MAIN = {"x": 0, "y": 0, "w": 1920, "h": 1080}
TWO = [MAIN, LEFT]
DESK = (-1920, 0, 3840, 1080)


# ================================================== a. the id ==================================
print("\n--- the reserved id, and what it says about the capsule ---")
check("one wheel window per capsule, always the same id",
      rf.overlay_wheel_wid("d0") == "d0~kolo", rf.overlay_wheel_wid("d0"))
check("the capsule is still read straight out of it",
      rf.overlay_dev_of(rf.overlay_wheel_wid("d1")) == "d1")
check("recognised as the wheel window", rf.overlay_is_wheel_wid("d0~kolo") is True)
check("an ordinary window is not", rf.overlay_is_wheel_wid("d0") is False
      and rf.overlay_is_wheel_wid("d0~2") is False)
check("nothing in, nothing claimed", rf.overlay_is_wheel_wid("") is False
      and rf.overlay_is_wheel_wid(None) is False)
check("the id fits the 20-character ceiling every wid is read under",
      len(rf.overlay_wheel_wid("d7")) <= 20)
# The panel writes this id itself (rf-46b builds it from WH_CUR_SUF), so the two spellings have to
# be the same string or the card would be steering a window that does not exist. Both halves of the
# panel's wheel are read as one: rf-46-wheel.js draws it, rf-46b-wheel-card.js sets it up.
_RF46_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web", "js")
_rf46_src = ""
for _n in ("rf-46a-wheel-shape.js", "rf-46-wheel.js", "rf-46b-wheel-card.js",
           "rf-46c-wheel-tree.js", "rf-46d-wheel-stage.js", "rf-46d2-wheel-stage-aim.js",
           "rf-46d3-wheel-stage-life.js", "rf-46e-wheel-io.js", "rf-46f-wheel-share.js"):
    with open(os.path.join(_RF46_DIR, _n), "r", encoding="utf-8") as _f:
        _rf46_src += _f.read() + "\n"
check("the panel spells the same suffix (WH_CUR_SUF mirrors OVERLAY_WHEEL_SUFFIX)",
      ('WH_CUR_SUF = "' + rf.OVERLAY_WID_SEP + rf.OVERLAY_WHEEL_SUFFIX + '"') in _rf46_src)


# ============================================ b. the new window flag ===========================
print("\n--- followCursor, as it arrives from the panel ---")
check("off for an ordinary overlay — a cheat sheet has a place and stays in it",
      rf.OVERLAY_WIN_DEFAULTS["followCursor"] is False)
check("a config that says nothing about it keeps the default",
      rf._sanitize_overlay_win({})["followCursor"] is False)
check("switched on", rf._sanitize_overlay_win({"followCursor": True})["followCursor"] is True)
check("anything truthy is a yes (the panel sends booleans, a script may not)",
      rf._sanitize_overlay_win({"followCursor": 1})["followCursor"] is True)
check("...and anything falsy a no",
      rf._sanitize_overlay_win({"followCursor": 0})["followCursor"] is False)
_old = rf._sanitize_overlay_win({"theme": "dark"})      # a config from before the key existed
del _old["followCursor"]
check("a settings file written before the key gets it put back, not left missing",
      rf._sanitize_overlay_win({}, base=_old)["followCursor"] is False)
check("the key survives a round trip through the sanitizer",
      rf._sanitize_overlay_win({}, base=rf._sanitize_overlay_win(
          {"followCursor": True}))["followCursor"] is True)


# ======================================== c. the defaults it is born with ======================
print("\n--- what a wheel window IS, before anybody sets anything ---")
D = rf.OVERLAY_WHEEL_DEFAULTS
check("square: the drawing is a circle and it fills the window", D["w"] == D["h"])
check("it goes to the pointer", D["followCursor"] is True)
check("no card behind it — over a game the wheel should be the wheel", D["theme"] == "bare")
check("it never takes the mouse", D["clickThrough"] is True)
check("the wheel is what it shows", D["show"]["wheel"] is True and D["show"]["card"] is True)
# STRAZNIK TEGO BLEDU, A NIE WYLICZANKA NAZW (2026-09-06). Do dzis stala tu lista czesci wypisana
# z reki — i dokladnie tak samo wypisana z reki byla lista "co wylaczyc" w OVERLAY_WHEEL_DEFAULTS.
# Wiec kiedy 2026-09-01 doszedl "wheel.list" (SPIS WYCINKOW), nie dopisal go NIKT: ani kod, ani ten
# test. Spis — inaczej niz sam rysunek kola — stoi w kolumnie ZAWSZE, nie tylko gdy kolo jest
# otwarte, wiec po zamknieciu kola nad gra zostawal napis "Kolo wyboru · Trzymaj przycisk i pusc ·
# lewo · prawo" w oknie, ktorego nie da sie ani chwycic, ani zamknac: bez paska, bez ✕, przezroczyste
# dla klikniec. Pytamy wiec PETLA PO OVERLAY_SHOW_KEYS: czesc sciagi dolozona kiedys w przyszlosci
# ma zapalic ten test, a nie zostac nad gra.
_on = sorted(k for k in rf.OVERLAY_SHOW_KEYS if D["show"].get(k))
check("...and NOTHING else is — sprawdzone po WSZYSTKICH czesciach, nie po liscie z reki",
      _on == ["card", "wheel"], _on)
check("...i zadna czesc nie jest przy tym pominieta w danych",
      sorted(D["show"].keys()) == sorted(rf.OVERLAY_SHOW_KEYS),
      set(rf.OVERLAY_SHOW_KEYS) ^ set(D["show"]))
# SPIS WYCINKOW Z NAZWY, bo to on wisial nad gra i to jego nazwa jest umowa miedzy serwerem
# a `wheelColumnHtml` w rf-46g-wheel-list.js. Test po samej petli wyzej przeszedlby takze wtedy,
# gdyby ten klucz zniknal — a wtedy strona rysowalaby spis, o ktory serwer przestal pytac.
check("...a spis wycinkow ma tu wlasny wpis i jest WYLACZONY",
      "wheel.list" in D["show"] and D["show"]["wheel.list"] is False)
# BEZ PASKA JUZ W DANYCH, a nie dopiero w warunku po drodze. Strona i tak nigdy go w tym oknie nie
# rysuje, ale serwer czytal `winBar` ze zwyklych domyslnych i odpowiadal "pasek jest" — czyli trzymal
# NIENARYSOWANY prostokat lapiacy mysz (has_bar -> in_grab).
check("...i pasek jest wylaczony w samych domyslnych", D["winBar"] is False)
check("it has a name, so it is never an unlabelled twin in a list", bool(D["label"]))
check("the default side is inside the range the card's slider offers (180..560)",
      180 <= D["w"] <= 560, D["w"])

# ---- migracja dla tych, ktorzy kola przy kursorze JUZ UZYLI -----------------------------------
# Sama zmiana domyslnych nie zdejmuje niczego z ekranu: kto raz otworzyl to okno, ma jego `show`
# ZAPISANE na dysku — z odciskiem domyslnych z dnia zapisu, czyli z "wheel.list": true — i to zapis
# wygrywa scalanie z domyslnymi. Dlatego okno kola jako jedyne w tej funkcji ma zapis PRZEGRYWAJACY:
# wolno tak, bo edytor czesci dla niego jest schowany (rf-41c), wiec to `show` nigdy nie bylo
# niczyim wyborem.
_saved = {"w": 500, "h": 500, "theme": "neon", "opacity": 70, "winBar": True,
          "show": {"wheel.list": True, "head": True, "rules": True, "pose": True, "wheel": True}}
_mig = rf._sanitize_overlay_win(_saved, base=rf.OVERLAY_WHEEL_DEFAULTS)
_mig_on = sorted(k for k in rf.OVERLAY_SHOW_KEYS if _mig["show"].get(k))
check("zapisane okno kola gubi spis wycinkow i cala reszte sciagi",
      _mig_on == ["card", "wheel"], _mig_on)
check("...w tym sam „wheel.list”, czyli napis, ktory wisial nad gra",
      _mig["show"]["wheel.list"] is False)
check("...i pasek, o ktory nikt nie prosil, a ktory lapal mysz", _mig["winBar"] is False)
# …ale TYLKO czesci i pasek. Wielkosc, wyglad i przezroczystosc TEGO okna wybiera sie w karcie kola
# (sekcja "Gdzie pokazywac kolo") i na ekranie "Nakladka" — to sa czyjes wybory i migracja nie ma
# prawa ich cofnac. Inaczej "naprawa" napisu nad gra kasowalaby komus ustawiony rozmiar i styl.
check("...a to, co czlowiek naprawde wybieral, zostaje nietkniete",
      (_mig["w"], _mig["h"], _mig["theme"], _mig["opacity"]) == (500, 500, "neon", 70), _mig)
# ZWYKLA NAKLADKA NIE JEST CZYSZCZONA. Tam edytor czesci JEST widoczny, wiec `show` to lista
# ptaszkow, ktore ktos wlasnorecznie postawil — i skasowanie ich byloby dokladnie ta usterka,
# ktora ta migracja naprawia, tylko wieksza.
_plain = rf._sanitize_overlay_win(dict(_saved), base=None)
check("zwykle okno nakladki zostaje z tym, co zapisano — jego czesci sa czyims wyborem",
      _plain["show"]["wheel.list"] is True and _plain["show"]["head"] is True
      and _plain["show"]["rules"] is True and _plain["show"]["pose"] is True,
      {k: v for k, v in _plain["show"].items() if v})
check("...i jego pasek tez zostaje wlaczony, skoro tak stalo w zapisie",
      _plain["winBar"] is True)
# I TA SAMA ODPOWIEDZ PRZEZ MENEDZERA, czyli droga, ktora naprawde chodzi plik ustawien: to `_mk`
# wybiera baze po identyfikatorze okna, a nie wolajacy. Bez tego migracja dzialalaby w tescie
# i nie dzialalaby przy starcie aplikacji.
_MG, _ = mgr({"windows": {"d0~kolo": dict(_saved), "d0": dict(_saved)}})
_kw = sorted(k for k in rf.OVERLAY_SHOW_KEYS if _MG.wins["d0~kolo"].cfg["show"].get(k))
check("plik ustawien z „wheel.list” wczytuje sie juz oczyszczony",
      _kw == ["card", "wheel"] and _MG.wins["d0~kolo"].cfg["winBar"] is False, _kw)
check("...a stojaca obok zwykla nakladka tego samego kapsla nie",
      _MG.wins["d0"].cfg["show"]["wheel.list"] is True
      and _MG.wins["d0"].cfg["winBar"] is True)


# ============================================ d. where the window goes =========================
print("\n--- centred on the pointer ---")
check("dead centre of one screen",
      rf.overlay_cursor_rect(960, 540, 400, 400, screens=TWO) == (760, 340),
      rf.overlay_cursor_rect(960, 540, 400, 400, screens=TWO))
check("odd sizes round rather than drift",
      rf.overlay_cursor_rect(100, 100, 61, 61, screens=TWO) == (70, 70),
      rf.overlay_cursor_rect(100, 100, 61, 61, screens=TWO))

print("\n--- pushed back onto the screen the pointer is on ---")
check("left edge: half a wheel off-screen is half a wheel nobody can aim at",
      rf.overlay_cursor_rect(10, 540, 400, 400, screens=TWO) == (0, 340),
      rf.overlay_cursor_rect(10, 540, 400, 400, screens=TWO))
check("right edge", rf.overlay_cursor_rect(1910, 540, 400, 400, screens=TWO) == (1520, 340),
      rf.overlay_cursor_rect(1910, 540, 400, 400, screens=TWO))
check("bottom edge (this is the usual one — a wheel opened over a taskbar)",
      rf.overlay_cursor_rect(960, 1075, 400, 400, screens=TWO) == (760, 680),
      rf.overlay_cursor_rect(960, 1075, 400, 400, screens=TWO))
check("top edge", rf.overlay_cursor_rect(960, 3, 400, 400, screens=TWO) == (760, 0),
      rf.overlay_cursor_rect(960, 3, 400, 400, screens=TWO))
check("corner: both axes at once",
      rf.overlay_cursor_rect(1918, 1078, 400, 400, screens=TWO) == (1520, 680),
      rf.overlay_cursor_rect(1918, 1078, 400, 400, screens=TWO))

print("\n--- the second monitor, whose coordinates are negative ---")
check("centred there, not dragged onto the primary",
      rf.overlay_cursor_rect(-960, 540, 400, 400, screens=TWO) == (-1160, 340),
      rf.overlay_cursor_rect(-960, 540, 400, 400, screens=TWO))
check("its OUTER edge is clamped to -1920, not to 0",
      rf.overlay_cursor_rect(-1915, 540, 400, 400, screens=TWO) == (-1920, 340),
      rf.overlay_cursor_rect(-1915, 540, 400, 400, screens=TWO))
check("the seam between the two screens: the window stays on the LEFT one",
      rf.overlay_cursor_rect(-10, 540, 400, 400, screens=TWO) == (-400, 340),
      rf.overlay_cursor_rect(-10, 540, 400, 400, screens=TWO))
check("...and one pixel further right it belongs to the primary",
      rf.overlay_cursor_rect(10, 540, 400, 400, screens=TWO) == (0, 340),
      rf.overlay_cursor_rect(10, 540, 400, 400, screens=TWO))

print("\n--- the awkward answers ---")
check("a window wider than its screen goes to the edge rather than half off both sides",
      rf.overlay_cursor_rect(960, 540, 2400, 400, screens=TWO) == (0, 340),
      rf.overlay_cursor_rect(960, 540, 2400, 400, screens=TWO))
check("no monitor contains the pointer -> the desktop is the fallback",
      rf.overlay_cursor_rect(-1915, 540, 400, 400, screens=[], desktop=DESK) == (-1920, 340),
      rf.overlay_cursor_rect(-1915, 540, 400, 400, screens=[], desktop=DESK))
check("nothing to clamp against at all -> centred and left alone, not clamped to a guess",
      rf.overlay_cursor_rect(-5000, -5000, 400, 400) == (-5200, -5200),
      rf.overlay_cursor_rect(-5000, -5000, 400, 400))
check("a desktop of zero size is not a rectangle and is ignored",
      rf.overlay_cursor_rect(50, 50, 400, 400, desktop=(0, 0, 0, 0)) == (-150, -150),
      rf.overlay_cursor_rect(50, 50, 400, 400, desktop=(0, 0, 0, 0)))
check("nonsense in, no exception out",
      rf.overlay_cursor_rect(None, None, 400, 400) == (0, 0))
check("a monitor entry missing a field is skipped, not fatal",
      rf.overlay_cursor_rect(960, 540, 400, 400, screens=[{"x": 0, "y": 0}, MAIN]) == (760, 340))

# ---- …i drugie miejsce, ktore to samo okno umie zajac: SRODEK EKRANU --------------------------
# „Na srodku ekranu" (showWhere == "center", 2026-09-06) liczy sie tym samym `overlay_cursor_rect`,
# bo pytanie jest identyczne — „gdzie ma sie zaczac okno w×h, zeby jego srodek trafil w punkt".
# Zmienia sie wylacznie PUNKT: nie kursor, tylko srodek ekranu GLOWNEGO. Glowny, a nie ten pod mysza,
# i to jest cala rzecz: ten tryb jest dla kapsli, ktore kursora w ogole nie prowadza (czapka, glowa),
# wiec miejsce kola nie moze zalezec od tego, gdzie ktos zostawil wskaznik.
print("\n--- …i to samo okno postawione nieruchomo: srodek ekranu glownego ---")
_MC, _ = mgr()
_wc = _MC._mk(rf.overlay_wheel_wid("d0"))
_wc.cfg["w"], _wc.cfg["h"], _wc.hwnd = 360, 360, 0     # okna jeszcze nie ma: hwnd == 0
_mon_saved = rf.overlay_monitors_physical
try:
    # Kolejnosc z LEWYM ekranem na poczatku jest tu celowa: lista monitorow nie obiecuje, ze glowny
    # jest pierwszy, a szukanie „pierwszego z brzegu" dawaloby kolo na sasiednim ekranie.
    rf.overlay_monitors_physical = lambda: [LEFT, MAIN]
    _ok_c = _wc.center_on_screen()
finally:
    rf.overlay_monitors_physical = _mon_saved
check("srodek ekranu GLOWNEGO, a nie pierwszego z listy",
      (_wc.cfg["x"], _wc.cfg["y"]) == (780, 360), (_wc.cfg.get("x"), _wc.cfg.get("y")))
check("...i miejsce jest ZAPISANE, choc okna jeszcze nie ma — odbierze je _place() przy starcie",
      _ok_c is True and _wc.hwnd == 0)
# Ekran glowny poznajemy po tym, ze zawiera punkt (0,0) — tak Windows definiuje uklad wspolrzednych
# pulpitu. Gdy monitorow nie da sie wyliczyc, zostaje `_screen()`, czyli wymiary ekranu glownego:
# odpowiedz awaryjna jest ta sama odpowiedzia, a nie zgadywaniem.
_wc.cfg["x"] = _wc.cfg["y"] = None
try:
    rf.overlay_monitors_physical = lambda: []
    _wc.center_on_screen()
finally:
    rf.overlay_monitors_physical = _mon_saved
check("...a bez listy monitorow okno i tak dostaje srodek, a nie rog",
      isinstance(_wc.cfg["x"], int) and isinstance(_wc.cfg["y"], int)
      and _wc.cfg["x"] > 0 and _wc.cfg["y"] > 0, (_wc.cfg["x"], _wc.cfg["y"]))
try:
    rf.overlay_monitors_physical = lambda: (_ for _ in ()).throw(RuntimeError("brak pulpitu"))
    _ok_boom = _wc.center_on_screen()
finally:
    rf.overlay_monitors_physical = _mon_saved
check("...a maszyna, ktora o monitory pytac nie umie, nie wywraca wlaczania kola", _ok_boom is True)


# ======================================= e. the manager keeps it apart =========================
print("\n--- it is not one of the overlays anybody placed ---")
M, _ = mgr()
M.first_wid("d0", create=True)          # the capsule's ordinary window
wid = M.wheel_wid("d0", create=True)
check("asking for it creates it", wid == "d0~kolo" and wid in M.wins)
check("...and it is born with the wheel defaults, not the ordinary ones",
      M.wins[wid].cfg["theme"] == "bare" and M.wins[wid].cfg["clickThrough"] is True
      and M.wins[wid].cfg["followCursor"] is True and M.wins[wid].cfg["show"]["head"] is False,
      M.wins[wid].cfg)
check("out of the capsule's list of windows (the tray, the panel, 'open all')",
      M.wids_for("d0") == ["d0"], M.wids_for("d0"))
check("...unless it is asked for by name",
      M.wids_for("d0", wheel=True) == ["d0", "d0~kolo"], M.wids_for("d0", wheel=True))
check("the capsule-level switch still means the ordinary window",
      M.first_wid("d0") == "d0")
check("out of the panel's list and its order",
      "d0~kolo" not in M.state()["windows"] and "d0~kolo" not in M.state()["order"],
      M.state()["order"])
check("but answerable BY NAME — this is how its own card reads it",
      M.state(wid)["window"]["win"] == "d0~kolo"
      and M.state(wid)["window"]["exists"] is True)
check("the numbered windows never collide with it",
      M.add("d0")[0] == "d0~2")
check("removing it is refused — it is switched off in its card, which is a close",
      M.remove(wid)[0] is False, M.remove(wid))
# …and the wheel window does not COUNT as one of the capsule's windows for that rule either: a
# capsule left with "one ordinary overlay + the wheel window" must still refuse to lose the first.
_Mr, _ = mgr()
_Mr.first_wid("d0", create=True)
_Mr.wheel_wid("d0", create=True)
check("...and the capsule's last ordinary window is still protected the same way",
      _Mr.remove("d0")[0] is False, _Mr.remove("d0"))

print("\n--- a capsule whose FIRST overlay ever is the wheel one ---")
M2, _ = mgr()
M2.wheel_wid("d3", create=True)
check("the ordinary window is made too, so the tray's switch has something to mean",
      M2.first_wid("d3") == "d3", M2.first_wid("d3"))
check("and it is first in the order (the wheel window came second)",
      M2._order[:2] == ["d3", "d3~kolo"], M2._order)

print("\n--- the settings file ---")
M3, path3 = mgr({"windows": {"d0~kolo": {"open": True, "w": 500, "h": 500, "opacity": 70}}})
check("a saved wheel window keeps what was set on it",
      M3.wins["d0~kolo"].cfg["w"] == 500 and M3.wins["d0~kolo"].cfg["opacity"] == 70)
check("...and what the file never mentioned comes from the WHEEL defaults, not the ordinary ones",
      M3.wins["d0~kolo"].cfg["followCursor"] is True
      and M3.wins["d0~kolo"].cfg["theme"] == "bare"
      and M3.wins["d0~kolo"].cfg["show"]["rules"] is False,
      M3.wins["d0~kolo"].cfg)
# Since 2026-09-03 BOTH kinds default to the "bare" look (new overlays come without a
# card), so the theme no longer tells them apart — followCursor and the rules block still do.
check("an ordinary window in the same file is untouched by any of that",
      rf._sanitize_overlay_win({})["followCursor"] is False
      and rf._sanitize_overlay_win({})["show"]["rules"] is True
      and rf._sanitize_overlay_win({})["theme"] == "bare")


# ========================================== f. it never takes a click ==========================
print("\n--- the strip an overlay keeps clickable: this window has none ---")
W = M.wins["d0~kolo"]
W.cfg["x"], W.cfg["y"], W.cfg["w"], W.cfg["h"] = 100, 100, 400, 400
W.grab = 60
check("not at the top, where every other overlay keeps its bar",
      W.in_grab(300, 110) is False)
check("not in the resize corner either", W.in_grab(495, 495) is False)
check("not under the pointer in the middle — which is where the pointer always is",
      W.in_grab(300, 300) is False)
_ord = M.wins["d0"]
_ord.cfg["x"], _ord.cfg["y"], _ord.cfg["w"], _ord.cfg["h"] = 100, 100, 400, 400
_ord.grab = 60
check("an ordinary overlay still keeps its bar (this is not a change to those)",
      _ord.in_grab(300, 110) is True and _ord.in_grab(300, 300) is False)
# OD 2026-09-06 ROZNICE ROBI IDENTYFIKATOR, A NIE FLAGA. Wczesniej wystarczylo pytac „czy chodzi
# za kursorem", bo okno kola zawsze chodzilo; przy „Na srodku ekranu" (showWhere == "center") ono
# STOI, a klikniecie zjadaloby dokladnie tak samo — w trybach „Kliknij, pochyl, kliknij", „Pochyl
# i kliknij" i „Przelaczaj klikniciami" nastepny klik JEST wyborem. Wiec pytanie brzmi „czym to
# okno jest", i to jest tu sprawdzane: ta sama odpowiedz z pogonia i bez niej.
check("...i to id, a nie flaga, jest tym, co je rozroznia",
      rf.overlay_is_wheel_wid(W.wid) is True and rf.overlay_is_wheel_wid(_ord.wid) is False)
W.cfg["followCursor"] = False                      # „Na srodku ekranu": okno stoi nieruchomo
check("okno kola stojace na srodku ekranu tez nie ma czesci klikalnej",
      W.follows_cursor() is False and W.in_grab(300, 110) is False
      and W.in_grab(300, 300) is False and W.in_grab(495, 495) is False)
W.cfg["winBar"] = True                             # …i nawet opisane „z paskiem"
check("...nawet gdy ustawienie mowi, ze pasek ma byc",
      W.has_bar() is False and W.in_grab(300, 110) is False)
W.cfg["winBar"] = False
W.cfg["followCursor"] = True
# …a zwykla nakladka nie zmienia sie od tego ani troche: gdyby warunek zostal napisany „byle nie
# followCursor", okno postawione recznie z ta flaga stracilby pasek bez powodu.
_ord.cfg["followCursor"] = True
check("...a zwykla nakladka z ta sama flaga PASEK ZACHOWUJE — to nie flaga o tym decyduje",
      _ord.in_grab(300, 110) is True)
_ord.cfg["followCursor"] = False


# ======================================= g. moved ONCE, on the open edge =======================
print("\n--- the wheel opening is what moves the window ---")


class _FakeWin:
    """An overlay window that counts how many times it was told to go to the pointer."""

    def __init__(self, follow=True, up=True):
        self.cfg = {"followCursor": follow}
        self.hwnd = 1 if up else 0
        self.n = 0

    def follows_cursor(self):
        return bool(self.cfg.get("followCursor"))

    def center_on_cursor(self):
        self.n += 1
        return True


M4, _ = mgr()
M4.first_wid("d0", create=True)
M4.wheel_wid("d0", create=True)
M4.wheel_wid("d1", create=True)
M4.wins["d0~kolo"] = _FakeWin()
M4.wins["d0"] = _FakeWin(follow=False)              # an ordinary overlay of the same capsule
M4.wins["d1~kolo"] = _FakeWin()                     # …and another capsule's wheel window
M4.wheel_opened("d0")
check("this capsule's wheel window was placed", M4.wins["d0~kolo"].n == 1)
check("its ordinary overlay was left exactly where the owner put it",
      M4.wins["d0"].n == 0)
check("another capsule's window was not touched", M4.wins["d1~kolo"].n == 0)
# …I TU `follows_cursor()` ZOSTAJE WLASCIWYM PYTANIEM (2026-09-06), choc w in_grab i has_bar
# przestalo nim byc. Przy „Na srodku ekranu" okno kola ma sie na otwarcie NIE RUSZAC — pominiecie
# go tutaj to nie przeoczenie, tylko cala roznica miedzy tymi dwoma miejscami. Miejsce dostalo raz,
# przy wlaczaniu (center_on_screen w wheel_apply_where), i ma tam zostac.
M4.wins["d0~kolo"].cfg["followCursor"] = False
M4.wheel_opened("d0")
check("okno kola stojace na srodku ekranu NIE idzie pod kursor przy otwarciu",
      M4.wins["d0~kolo"].n == 1, M4.wins["d0~kolo"].n)
M4.wins["d0~kolo"].cfg["followCursor"] = True
M4.wheel_opened("d0")
check("a second opening moves it again (the pointer has moved since)",
      M4.wins["d0~kolo"].n == 2)
M4.wins["d0~kolo"].hwnd = 0
M4.wheel_opened("d0")
check("a window that is not up is not asked to move",
      M4.wins["d0~kolo"].n == 2)


class _Boom(_FakeWin):
    def center_on_cursor(self):
        raise RuntimeError("no desktop here")


M4.wins["d0~kolo"] = _Boom()
try:
    M4.wheel_opened("d0")
    _ok = True
except Exception:
    _ok = False
check("a window that cannot be placed does not take the wheel down with it", _ok)


# ==================================== h. the engine says it exactly once =======================
print("\n--- the engine announces the opening, once per opening ---")


class _Bus:
    def __init__(self, dev):
        self.dev = dev
        self.sent = []

    def now(self):
        return 0.0

    def publish(self, ev):
        self.sent.append(ev)


_said = []
_real_hook = rf.overlay_wheel_opened
rf.overlay_wheel_opened = lambda dev: _said.append(dev)
try:
    menu = rf.RadialMenu(_Bus("d2"))
    menu.set_config({"enabled": True, "slices": [{"label": "A", "spec": "a"},
                                                 {"label": "B", "spec": "b"}]})
    slices = list(menu.cfg["slices"])
    menu._open(slices)
    check("opening the wheel names the capsule it belongs to", _said == ["d2"], _said)
    menu._close(False)
    check("closing says nothing — the window stays where it was put down", _said == ["d2"], _said)
    menu._open(slices)
    check("the next opening says it again", _said == ["d2", "d2"], _said)
    # A publish that is only a lean moving must NOT be read as an opening: the wheel is aimed at by
    # leaning, and a window that jumped to the cursor mid-aim would move the target under the hand.
    menu._publish(slices, force=True)
    check("merely redrawing an open wheel moves nothing", _said == ["d2", "d2"], _said)
finally:
    rf.overlay_wheel_opened = _real_hook

print("\n--- the hook itself is unbreakable by design ---")
_saved = rf.OVERLAY
try:
    rf.OVERLAY = None
    rf.overlay_wheel_opened("d0")          # no manager at all (this is what a test run looks like)
    rf.overlay_wheel_opened("")            # …and no capsule
    check("no overlay manager, no exception", True)
except Exception as e:
    check("no overlay manager, no exception", False, e)
finally:
    rf.OVERLAY = _saved


# ======================================== i. it comes back after a restart =====================
print("\n--- and it is the only overlay that re-opens by itself ---")
M5, _ = mgr({"windows": {"d0": {"open": True}, "d0~2": {"open": True},
                         "d0~kolo": {"open": True}, "d1~kolo": {"open": False}}})
_opened = []
M5.open = lambda wid, url: (_opened.append(wid), (True, ""))[1]
_where_saved = rf.wheel_show_where
rf.wheel_show_where = lambda dev, cfg=None: "both"      # every capsule still wants it there
try:
    back = M5.reopen_follow_cursor("http://127.0.0.1:8770/")
finally:
    rf.wheel_show_where = _where_saved
check("the wheel window that was up comes back", _opened == ["d0~kolo"], _opened)
check("...and says so", back == ["d0~kolo"], back)
check("windows the owner placed are NOT re-opened — that would rearrange their screen",
      "d0" not in _opened and "d0~2" not in _opened)
check("a wheel window that was switched off stays off", "d1~kolo" not in _opened)

# …and the window's own `open` flag is no longer the whole answer. „Gdzie pokazywać koło" is the
# switch now, so a capsule moved back to „W nakładkach" must not have the window rise from the dead
# on the next start just because it happened to be up when it was moved.
#
# „center" JEST NA TEJ LISCIE Z TEGO SAMEGO POWODU, CO „cursor" (2026-09-06). Nazwa metody mowi
# „follow cursor", ale pytanie brzmi „czy okno kola ma stac na ekranie" — a przy „Na srodku ekranu"
# to jest TO SAMO okno, tylko postawione gdzie indziej. Gdyby wypadlo z warunku, jedyna roznica
# byloby to, ze po restarcie aplikacji kolo przestaje sie pokazywac — czyli awaria, ktora wyglada
# jak „samo sie zepsulo przez noc" i ktorej nikt nie powiaze z wyborem miejsca.
print("\n--- …and only while the capsule still says the wheel belongs in a window of its own ---")
for _mode, _want in (("cursor", ["d0~kolo"]), ("both", ["d0~kolo"]), ("center", ["d0~kolo"]),
                     ("overlay", [])):
    M6, _ = mgr({"windows": {"d0": {"open": True}, "d0~kolo": {"open": True}}})
    _got = []
    M6.open = lambda wid, url: (_got.append(wid), (True, ""))[1]
    _where_saved = rf.wheel_show_where
    rf.wheel_show_where = lambda dev, cfg=None, _m=_mode: _m
    try:
        M6.reopen_follow_cursor("http://127.0.0.1:8770/")
    finally:
        rf.wheel_show_where = _where_saved
    check("„%s” -> %s" % (_mode, _want or "nic nie wstaje"), _got == _want, _got)

# Two capsules, two different answers: the respawn asks PER CAPSULE, not once for the app.
M7, _ = mgr({"windows": {"d0": {"open": True}, "d0~kolo": {"open": True},
                         "d1": {"open": True}, "d1~kolo": {"open": True}}})
_got7 = []
M7.open = lambda wid, url: (_got7.append(wid), (True, ""))[1]
_where_saved = rf.wheel_show_where
rf.wheel_show_where = lambda dev, cfg=None: "cursor" if dev == "d1" else "overlay"
try:
    M7.reopen_follow_cursor("http://127.0.0.1:8770/")
finally:
    rf.wheel_show_where = _where_saved
check("each capsule is asked about itself", _got7 == ["d1~kolo"], _got7)


# ============================================== j. the wiring =================================
print("\n--- the page and the app agree on what a wheel window looks like ---")
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(_ROOT, "ribbitflip_monitor.py"), "r", encoding="utf-8") as _f:
    _mon_src = _f.read()
check("the window is opened with the flag the page reads",
      '"&wheel=1" if overlay_is_wheel_wid(self.wid) else ""' in _mon_src)
with open(os.path.join(_ROOT, "web", "js", "rf-41-overlay.js"), "r", encoding="utf-8") as _f:
    _ovl_src = _f.read()
check("the page recognises it", 'RF_OVL_WHEEL=RF_OVL&&/[?&]wheel=1/.test(location.search)' in _ovl_src)
check("...and wears a class the stylesheet can hang the stripped-down chrome on",
      'classList.add("rf-ovl-wheel")' in _ovl_src)
# Od 2026-09-01 pasek pomija sie z DWOCH powodow, nie z jednego: okno kola nie ma czego lapac,
# a zywa miniatura w panelu (`preview=1`, rf-41d) nie jest oknem — ma konfiguracje obok siebie,
# w karcie. Warunek zostaje jednym warunkiem, zeby nie bylo dwoch miejsc decydujacych o pasku.
# Okno kola nie dostaje paska W OGOLE (nie ma czego lapac); zywa miniatura w panelu dostaje sam
# pasek, bez nasluchow — patrz test_overlay_manage.py.
# Od 2026-09-03 doszedl trzeci powod — ustawienie `winBar` — wiec wszystkie trzy stoja w jednym
# miejscu, w `ovlBarSync`. Okno kola jest tam odcinane PIERWSZE i bezwarunkowo: ustawienie go nie
# dotyczy, bo pasek pod wskaznikiem zjadlby klikniecie zatwierdzajace wybor.
check("no bar is built for it (nothing to grab, nothing to swallow a click)",
      "function ovlBarSync(want)" in _ovl_src and "if(RF_OVL_WHEEL)want=false;" in _ovl_src)
# …a po stronie aplikacji to samo pytanie brzmi OD 2026-09-06 „czy to okno kola", a nie „czy chodzi
# za kursorem". Dopoki bylo tylko „Przy kursorze", oba pytania mialy te sama odpowiedz; od „Na
# srodku ekranu" (showWhere == "center") okno STOI, a paska dalej miec nie moze — cecha tego okna
# jest to, CZYM JEST, a nie gdzie akurat stoi. Szukamy warunku doslownie, bo to jedno miejsce
# decyduje o tym, czy klikniecie zatwierdzajace wybor dojdzie do gry.
check("...and the app refuses to keep a strip of it clickable, whatever the setting says",
      "if overlay_is_wheel_wid(self.wid) or not self.has_bar():" in _mon_src)
check("the title-bar measurement is NOT skipped with it — that is what makes it frameless",
      "ovlReportChrome();" in _ovl_src)
# NIE MA GO NA PASKU ZADAN ANI W Alt+Tab . Objaw: pusta nakladka otwierala
# sie z przyciskiem RibbitFlip w pasku zadan i nic na niej nie bylo widac. Nie bylo,
# bo to okno stoi puste do chwili otwarcia kola; dopoki nie miala jeszcze wycietej belki
# przegladarki, zdradzala je czarna kreska, a odkad jest niewidzialne naprawde — sam przycisk
# z pusta miniatura. TYLKO TO OKNO: zwykla nakladka moze miec zdjete „na wierzchu" i wtedy przycisk
# bywa jedyna droga z powrotem do niej. Pytanie po IDENTYFIKATORZE, tak jak has_bar i in_grab.
check("the wheel window is kept off the taskbar, and only that window",
      "if overlay_is_wheel_wid(self.wid):\n                ex_want |= self.WS_EX_TOOLWINDOW" in _mon_src)
# Sam bit nie wystarcza: pasek zadan czyta go przy POKAZYWANIU okna, wiec bez schowania i pokazania
# z powrotem przycisk zostaje do konca sesji. To jedyne ShowWindow w calej aplikacji — i ma sie
# wykonac wylacznie wtedy, gdy ten jeden bit naprawde sie zmienil (czyli raz, po znalezieniu okna),
# bo _apply wola sie po kazdym ustawieniu i miganie oknem przy kazdym ruchu suwakiem byloby gorsze
# od przycisku, ktory usuwamy.
check("...by hiding and re-showing it, and only when that one bit actually flips",
      "flips_taskbar = bool((ex_want ^ ex) & self.WS_EX_TOOLWINDOW)" in _mon_src
      and "u.ShowWindow(hwnd, self.SW_HIDE)" in _mon_src
      and "u.ShowWindow(hwnd, self.SW_SHOWNOACTIVATE)" in _mon_src)
check("...with argtypes declared for it, like every other call in _u32",
      "u.ShowWindow.argtypes = [wt.HWND, ctypes.c_int]" in _mon_src)
# Jedno miejsce przyznaje ten bit i ani jedno wiecej — inaczej „ktore okna znikaja z paska zadan"
# przestaloby miec jedna odpowiedz, dokladnie tak, jak rozjechalby sie pasek, gdyby o niego pytac
# w dwoch miejscach (patrz has_bar wyzej).
check("an ordinary overlay keeps its taskbar button — one place grants the bit, and only one",
      _mon_src.count("ex_want |= self.WS_EX_TOOLWINDOW") == 1)
with open(os.path.join(_ROOT, "web", "css", "15-overlay.css"), "r", encoding="utf-8") as _f:
    _css = _f.read()
# Rogu do ciagniecia nie ma juz NIGDZIE (2026-09-01): okno mierzy sie samo, wiec `.ovl-size`
# przestal istniec razem z regula, ktora go tu chowala.
check("the stylesheet hides the bar and the notes",
      "html.rf-ovl-wheel .ovl-bar" in _css and "html.rf-ovl-wheel .ovl-note" in _css
      and ".ovl-size" not in _css)
check("...and lets the wheel fill the window",
      "html.rf-ovl-wheel .ov-wheel" in _css)
check("the wheel's own card carries the section that steers it",
      'id="whCurSec"' in _rf46_src and 'id="whWhereSeg"' in _rf46_src)
# …and it steers it through the WHEEL's config, not with a switch of its own: the segment writes
# `showWhere` to /wheel and the SERVER opens or closes this window. Two places writing one window
# is a window whose state nobody can predict, which is the whole reason it is kept out of the lists.
check("the segment writes the place, and nothing in the card opens the window behind its back",
      "state.wheel.showWhere = v" in _rf46_src
      and 'act: want ? "open" : "close"' not in _rf46_src)
check("the app opens and closes it from the setting",
      "def wheel_apply_where" in _mon_src and 'cfg.get("showWhere") != was_where' in _mon_src)
# The card used to be a collapsed <details> squeezed into the Mapping tab, and it remembered how it
# had been left. It is a TAB of its own now (the radial menu is a module between mapping and mouse,
# not part of mapping), so it unfolds like every other
# module card — and the fold's localStorage key is gone rather than left behind to rot.
check("the card is a plain card in a tab of its own",
      'id="wheelCard"' in _rf46_src and 'id="wheelFold"' not in _rf46_src
      and "WH_FOLD_KEY" not in _rf46_src)
_TABS_JS = os.path.join(_ROOT, "web", "js", "rf-34-tabs.js")
with open(_TABS_JS, "r", encoding="utf-8") as _f:
    _tabs_src = _f.read()
check("...registered in the tab bar between Mapowanie and Mysz",
      _tabs_src.index('{id:"mapowanie"') < _tabs_src.index('{id:"kolo"')
      < _tabs_src.index('{id:"mysz"'))
check("...with a panel of its own that the card is mounted into",
      'mk("kolo")' in _tabs_src and "pKolo.appendChild(_whHost.firstElementChild)" in _tabs_src)
check("...and a status dot that follows the wheel's own switch, not the triggers'",
      'set("wheel",!!(state.wheel&&state.wheel.enabled));' in _tabs_src
      and 'set("map",!!state.trigEnabled);' in _tabs_src)

# ============================== f. the card after the 2026-08-26 rebuild ======================
# The card used to be a column of sliders with a 200x200 preview square in the corner. The owner
# picked the shape of the prototype instead (kept outside the repository):
# a LIVE STAGE on the left, foldable EDITING SECTIONS on the right. These checks pin down the parts
# of that shape that other things depend on — the ids the frame loop and the tests reach for, and
# the promise that nothing done on the stage leaves the browser.
print("\n--- karta po przebudowie: scena + sekcje ---")
with open(os.path.join(_ROOT, "web", "ribbitflip_dashboard.html"), "r", encoding="utf-8") as _f:
    _dash_css = _f.read()
check("the card is laid out as a stage plus an editing column",
      'id="whStage"' in _rf46_src and 'id="whEdit"' in _rf46_src and 'class="wh-body"' in _rf46_src)
check("the stage carries the container the frame loop draws into",
      'id="whPreview"' in _rf46_src and "function whPreviewFrame" in _rf46_src)
# THE DRAWING IS A VECTOR, and it is the SAME drawing everywhere (the
# mock-up looked far nicer and ran far more smoothly). The point of the port is that the
# pretty renderer IS the production one - so there is no second drawing to drift from the first,
# and no canvas left behind to rot.
check("the wheel is drawn as SVG, by one renderer for every surface",
      "function wheelSvgInto" in _rf46_src and "<svg viewBox=" in _rf46_src)
check("...and the canvas renderer is gone rather than left as dead code",
      "wheelDrawInto" not in _rf46_src and "drawWheelCanvas" not in _rf46_src)
# A packet arrives 25 times a second, per capsule. Rebuilding the DOM at that rate is exactly what
# the owner was warning about, so the renderer splits into "build" (rare) and "paint" (often) and
# the split is keyed on the STRUCTURE - the pointed-at slice must not rebuild anything.
check("the tree is rebuilt only when the structure changes, never on a plain pointer move",
      "function _whKey" in _rf46_src and "function _whBuild" in _rf46_src
      and "function _whPaint" in _rf46_src and "if (!S || S.key !== key)" in _rf46_src)
# THE NEEDLE MUST NOT TAKE THE LONG WAY ROUND. The direction arrives normalised to 0..360 — the
# engine's packet and the card's stage both compute it that way — but a CSS transition animates the
# NUMBER, not the direction: between 359 and 1 it sees 358 degrees and drives the needle all the way
# round backwards. The first slice sits at twelve o'clock, i.e. exactly on the 0/360 seam, so the
# owner saw it every single time a hand crossed between the first slice and the last one
# ("przeskakuje między pierwszym a ostatnim rekordem", klik-through 2026-08-26).
#
# So the drawing keeps an ACCUMULATOR and feeds THAT to rotate(). This is checked by RUNNING the
# real function, not by reading it: the arithmetic is three lines and every one of them is a place
# to get a sign wrong.
print("\n--- wskazowka: kat ciagly, nie modulo ---")
_node = shutil.which("node")
_unwrap = re.search(r"function whUnwrapDeg\(prev, raw\) \{.*?\n\}", _rf46_src, re.S)
check("the drawing has a place where the angle is made continuous", bool(_unwrap))
check("...and the needle is drawn from it, never from the raw packet angle",
      "whUnwrapDeg(S._ang, st.ang)" in _rf46_src
      and 'rotate(" + _whF2(+st.ang' not in _rf46_src)
if _unwrap and _node:
    _js = _unwrap.group(0) + """
var out = [];
[[350,355,2,8],[8,2,355,350],[0,90,180,270,0,90],[180,181,179,180]].forEach(function(seq){
  var prev = null, vals = [];
  seq.forEach(function(a){ prev = whUnwrapDeg(prev, a); vals.push(prev); });
  out.push(vals);
});
console.log(JSON.stringify(out));
"""
    _p = subprocess.run([_node, "-e", _js], capture_output=True, text=True)
    try:
        _seqs = json.loads(_p.stdout.strip())
    except Exception:
        _seqs = None
    check("running it: a hand crossing twelve o'clock never makes the needle travel more than it did",
          bool(_seqs) and all(abs(v[i] - v[i - 1]) < 30
                              for v in _seqs[:2] + [_seqs[3]] for i in range(1, len(v))),
          _seqs)
    # …and the SIGN still says which way the hand went: three quarter-turns clockwise must keep
    # growing, not wrap back to zero on the fourth.
    check("...and a full turn keeps going the same way instead of snapping back",
          bool(_seqs) and _seqs[2] == [0, 90, 180, 270, 360, 450], _seqs[2] if _seqs else None)
else:
    check("running it: a hand crossing twelve o'clock never makes the needle travel more than it did",
          False, "brak `node` w PATH — tej funkcji nie da się uruchomić inaczej niż w JS")
    check("...and a full turn keeps going the same way instead of snapping back", False, "j.w.")

with open(os.path.join(_ROOT, "web", "css", "17-wheel.css"), "r", encoding="utf-8") as _f:
    _wcss = _f.read()
check("smoothness is CSS, because the packets arrive in steps",
      "transition:transform var(--w-anim)" in _wcss and "@keyframes whBloom" in _wcss)
check("...and the systemwide request for less motion switches it off",
      "@media (prefers-reduced-motion:reduce)" in _wcss)
# ============================ THE WHEEL APPEARS, IT DOES NOT MATERIALISE ========================
# The owner, after the first klik-through of the rebuilt card: "w prototypie koło pokazuje się po
# kliknięciu wraz z animacją. w aplikacji już tego nie ma." The animation was in the stylesheet all
# along — what was missing was the MOMENT: the stage kept the wheel open for ever, so `open` never
# went false->true and nothing had an edge to bloom on.
#
# So these checks are about the EDGE, not about the pretty part: every keyframe the prototype has,
# the hook that fires on the rising edge, and the one that lets the drawing outlive the closing by
# exactly as long as the collapse lasts.
print("\n--- rozkwit i zwiniecie: sciezka animacji otwarcia ---")
with open(os.path.join(_ROOT, "web", "css", "03-triggers.css"), "r", encoding="utf-8") as _f:
    _tr_css = _f.read()
check("all three opening keyframes are there, with the prototype's starting scales",
      "@keyframes whBloom{" in _wcss and "scale(.6)" in _wcss
      and "@keyframes whBloomBand{" in _wcss and "scale(.7)" in _wcss
      and "@keyframes whBloomHub{" in _wcss and "scale(.55)" in _wcss)
check("...and a closing one, shorter than the opening and without the spring",
      "@keyframes whShut{" in _wcss and ".wh-svg.wh-close{" in _wcss
      and "calc(var(--w-anim) * .55)" in _wcss and "scale(.72)" in _wcss)
check("the slices, the hub and the second ring each have their own bloom",
      ".wh-svg.wh-open .wh-sl-anim{" in _wcss and ".wh-svg.wh-open .wh-hub{" in _wcss
      and ".wh-svg.wh-open .wh-hub-g{" in _wcss
      and '.wh-svg.wh-grow .wh-sl[data-b="1"] .wh-sl-anim' in _wcss)
check("...and less motion switches the collapse off as well",
      ".wh-svg.wh-close{animation:none" in _wcss.split("prefers-reduced-motion")[1])
# THE HOOK. `_whBloom` is called from the paint pass on the rising edge of `open` and nowhere else:
# a bloom replayed on every packet (25 a second, per capsule) would be a flicker, not an animation.
check("the drawing blooms on the rising edge of `open`, not on every packet",
      "if (st.open && !S.open) _whBloom(S, \"wh-open\")" in _rf46_src
      and "S.open = !!st.open;" in _rf46_src)
check("...and it restarts the animation instead of re-adding a class that is already there",
      "void S.root.offsetWidth;" in _rf46_src)
check("...and stepping into a submenu blooms the NEW ring only",
      "else if (st.open && nb > S.nbSeen) _whBloom(S, \"wh-grow\")" in _rf46_src)
# The stagger: the root unrolls in order (that is how a list is read), a ring of children opens
# FROM THE MIDDLE outwards, because that is where its parent — and the eye — already is.
check("the slices are staggered, and the children's ring from the middle out",
      "WHEEL_STAGGER_MS = 22" in _rf46_src
      and "Math.round(Math.abs(i - (n - 1) / 2)) * WHEEL_STAGGER_MS" in _rf46_src)
# THE CLOSE. A surface used to wipe its container the instant the wheel went away, so the wheel
# vanished in one frame however nicely it had arrived. Now it says "close" and gets the cleaning
# in a callback, after the collapse.
check("closing is one function for every surface, and the cleanup waits for it",
      "function whPlayClose" in _rf46_src and "function whCancelClose" in _rf46_src
      and "WHEEL_CLOSE_MS" in _rf46_src)
check("...and a wheel that comes back mid-collapse keeps its drawing",
      "whCancelClose(c);" in _rf46_src and 'classList.remove("wh-close")' in _rf46_src)
check("...and less motion skips the collapse instead of stretching it",
      "function whLessMotion" in _rf46_src and "whLessMotion()) { if (done) done(); return; }" in _rf46_src)
# THE STAGE. This is where the owner saw it missing: the sandbox now starts CLOSED, with an
# invitation in the middle, and every way in and out goes through one pair of functions.
print("\n--- scena: koło zaczyna zamknięte, tak jak w prototypie ---")
check("the stage no longer claims the wheel is open for ever",
      "open: !!S.open, idx:" in _rf46_src and "open: true, idx:" not in _rf46_src)
check("...and it has one way in and one way out",
      "function whStageOpen" in _rf46_src and "function whStageClose" in _rf46_src)
check("a click opens it in the middle, a held button under the pointer",
      'whStageOpen("click")' in _rf46_src and 'whStageOpen("hold", S.px, S.py)' in _rf46_src)
check("...and choosing a leaf or cancelling closes it again",
      'if (_whStageCommit() === "close") whStageClose();' in _rf46_src
      and 'return "close";' in _rf46_src and 'return "stay";' in _rf46_src)
check("...and Escape closes the wheel before it leaves the enlarged stage",
      "if (state.wheelStage.open && whStageSrc() === \"mouse\") {" in _rf46_src)
# EDITING WITH THE WHEEL DOWN. A change made in the editor has to be VISIBLE, so it opens the wheel
# itself — and leaves it open, because while setting a wheel up one looks at the wheel.
check("editing opens the wheel by itself, through the two funnels a person's change goes down",
      "function whStageWake" in _rf46_src
      and "if (typeof whStageWake === \"function\") whStageWake();" in _rf46_src)
check("...and the invitation on the closed stage says both ways of opening it",
      'id="whScenePrompt"' in _rf46_src and "Kliknij, żeby otworzyć koło" in _rf46_src
      and "Click to open the wheel" in _rf46_src)
check("...and it gets out of the way the moment the wheel stands",
      "function _whStageShown" in _rf46_src and ".wh-scene.is-open .wh-scene-open{opacity:0}" in _tr_css)
check("the surface looks differ in TOKENS, not in rules",
      '.wh-svg[data-look="dark"]' in _wcss and '.wh-svg[data-look="bare"]' in _wcss
      and "--w-slice" in _wcss)
# PIEC WYGLADOW, JEDNA LISTA. Wyglad jest wlasnoscia OKNA, wiec kanon stoi po stronie nakladki
# (RF_LOOKS w rf-41-overlay.js, ladowany i przez panel, i przez strone nakladki). Dwie listy tego
# samego juz raz sie rozjechaly: ta sama wartosc "felt" nazywala sie w nakladce "Jasna karta",
# a w kole "Jasny", i tylko jedna z nich znala Neon.
check("kanon wygladow stoi po stronie okna (RF_LOOKS)", "const RF_LOOKS=[" in _ovl_src)
# OD 2026-08-31 KARTA KOLA NIE MA WLASNEGO ZESTAWU WYGLADOW. Stalo w niej piec przyciskow nad scena
# i drugie piec w sekcji "Wyglad" — dwa komplety od JEDNEJ wartosci, ktora jest ustawieniem OKNA,
# nie kola: nad gra kolo bierze wyglad tej nakladki, w ktorej stoi, wiec ten wybor i tak nie mowil
# prawdy o pozostalych oknach. Scena rysuje wiec jeden wyglad — obszywany sciegiem "felt".
# Szukamy KODU, nie slowa: "WH_CUR_LOOKS" zostaje w komentarzu, ktory tlumaczy, dokad ta lista
# poszla — a sprawdzanie nieobecnosci slowa jest sprawdzianem, ktory ktos "naprawi" przez zmiane
# nazwy w komentarzu.
check("karta kola nie ma juz WLASNYCH pigulek wygladu",
      "const WH_CUR_LOOKS" not in _rf46_src and 'class="wh-look"' not in _rf46_src
      and 'id="whStageLooks"' not in _rf46_src and 'id="whCurLooks"' not in _rf46_src)
check("...scena rysuje jeden wyglad i jest to ten obszywany sciegiem",
      'const WH_STAGE_LOOK = "felt"' in _rf46_src and "look: WH_STAGE_LOOK" in _rf46_src
      and 'data-look="felt"' in _rf46_src)
check("...a scieg w rysunku ma wlasnie ten wyglad",
      '.wh-svg[data-look="felt"] .wh-stitch' in _wcss)
# ODZYSKANY 2026-09-06, ALE NIE JAKO DRUGI KOMPLET. Wybor stylu wrocil do karty kola, bo to tutaj
# wybiera sie miejsce Z OKIENKIEM — a skora tego okienka jest nastepna decyzja, ktora z tego wynika,
# wiec kazanie komus przejsc na ekran "Nakladka" bylo prowadzeniem go po jedno klikniecie gdzie
# indziej. Ratunkiem przed powtorka z 08-31 jest to, ze to NIE jest drugi zestaw: te same kafle
# (.ovm-theme + .ovl-thumb), ta sama lista kodow (OVL_WHEEL_THEMES z RF_LOOKS) i ta sama wartosc
# okna — a wiec jedno ustawienie ogladane z dwoch stron, a nie dwa ustawienia o tej samej nazwie.
check("styl okienka stoi w sekcji „Gdzie pokazywac kolo”, a nie w „Wygladzie”",
      'id="whCurThemeRow"' in _rf46_src and 'id="whCurThemes"' in _rf46_src
      and _rf46_src.index('id="whCurSec"') < _rf46_src.index('id="whCurThemes"'))
check("...i jest ZBUDOWANY z kanonu, a nie z drugiej listy nazw",
      "OVL_WHEEL_THEMES" in _rf46_src and 'class="ovm-theme" data-theme="' in _rf46_src
      and "ovl-thumb ovl-thumb-" in _rf46_src and 'class="ovm-th-lbl"' in _rf46_src)
check("...zapalony jest ten wyglad, ktory okno naprawde nosi (a bez zapisu — „bare”)",
      'cfg.theme || "bare"' in _rf46_src
      and 'b.classList.toggle("on", b.dataset.theme === cur)' in _rf46_src)
# Klikniecie w kafel ma przemalowac okno OD RAZU. Zwloka 220 ms w whCurSend jest dla SUWAKA
# (przezroczystosc przychodzi kilkanascie razy na sekunde); tu jest jedno klikniecie, wiec karta
# i okno rozjechalyby sie na cwierc sekundy bez powodu.
check("...a klikniecie idzie do okna natychmiast, nie przez zwloke suwaka",
      "whCurSend({ theme: t.dataset.theme }, true)" in _rf46_src)
# …i zdanie obok nie moze juz odsylac na ekran "Nakladka": wskazywaloby droge do miejsca, w ktorym
# ta osoba wlasnie jest. Zostaje jedyna rzecz, ktorej same przyciski nie mowia — CZYM ten styl jest
# (skora OKNA, nie ksztalt kola), bo w sekcji "Wyglad" cztery suwaki wyzej opisuja KOLO.
check("...i karta mowi, czym ten styl jest, zamiast odsylac gdzie indziej",
      "ubiera OKNO, a nie samo koło" in _rf46_src
      and "Wybierasz go w sekcji „Gdzie pokazywać koło”." in _rf46_src
      and "nosi teraz wygląd" not in _rf46_src)
# …A KAFLE MUSZA MIEC CZYM SIE NARYSOWAC W PANELU. Ich wyglad mieszka w dwoch arkuszach ekranu
# „Nakladka" (.ovm-themes/.ovm-theme w 23-overlay-manage.css, .ovl-thumb w 15-overlay.css), a karta
# kola stoi w innej zakladce — wiec gdyby ktorykolwiek z nich byl ladowany tylko przez strone
# nakladki, przyciski w karcie bylyby golym tekstem bez paskow. Sprawdzane w HTML-u, bo to on
# decyduje, co panel w ogole wczytuje.
check("arkusze, ktore rysuja te kafle, sa wczytane takze w panelu",
      "/web/css/23-overlay-manage.css" in _dash_css and "/web/css/15-overlay.css" in _dash_css
      and "/web/css/03-triggers.css" in _dash_css)
# PODWOJNA KLASA W SELEKTORZE NIE JEST OZDOBA. 03-triggers.css wczytuje sie PRZED tamtymi dwoma,
# a `.wh-themes` ma te sama wage co `.ovm-themes` — przy rownej wadze wygrywa arkusz pozniejszy,
# wiec zawezenie siatki napisane samym `.wh-themes` byloby regula martwa i kafle rozjechalyby sie
# na szerokosc kolumny edycji. Test pilnuje KOLEJNOSCI, bo to ona jest tu powodem.
check("...i zawezenie siatki jest napisane tak, zeby wygrac z arkuszem ladowanym pozniej",
      ".ovm-themes.wh-themes{" in _tr_css
      and _dash_css.index("/web/css/03-triggers.css")
      < _dash_css.index("/web/css/23-overlay-manage.css"))
# Martwe reguly po pigulkach z 08-31 poszly razem z ich powrotem w innej postaci — zostawienie ich
# oznaczaloby dwa opisy tego samego wiersza, z ktorych jeden nie dotyczy niczego na ekranie.
# Szukamy REGULY, a nie slowa: „.wh-look" zostaje w komentarzu, ktory tlumaczy, co tu stalo i czemu
# wrocilo inaczej — a sprawdzanie nieobecnosci slowa kasowaloby to wyjasnienie.
check("...a po dawnych pigulkach wygladu nie zostal martwy zestaw regul",
      not re.search(r"\.wh-looks?\s*[{:.,]", _tr_css),
      (re.search(r"\.wh-looks?\s*[{:.,]", _tr_css) or [""])[0])
# PODPOWIEDZI SA DWIE, BO ZALEZA OD POWIERZCHNI ("Sama tresc" zostawia w zwyklej nakladce kule,
# strzalki i napisy, a w okienku kola samo kolo) — ale obie sa budowane z tej samej listy kodow.
check("dwa zestawy podpowiedzi, jeden kanon kodow",
      "const OVL_WHEEL_HINTS=" in _ovl_src and "const OVL_WHEEL_THEMES=RF_LOOKS.map" in _ovl_src
      and "Bez karty: nad grą zostaje samo koło" in _ovl_src)
for _look in ("felt", "dark", "bare", "neon", "glass"):
    check("wyglad „%s”: jest w kanonie" % _look,
          ('k:"%s"' % _look) in _ovl_src, _look)
    # …i serwer musi go przyjac: wyglad, ktorego nie zna sanitizer, wracalby po zapisie jako
    # "felt" i przycisk wygladalby na zepsuty.
    check("...a serwer go przyjmuje i oddaje",
          rf._sanitize_overlay_win({"theme": _look})["theme"] == _look, _look)
    # …i musi miec czym pomalowac SAMA NAKLADKE, nie tylko kolo w niej. Bez palety neonowa
    # nakladka bylaby kremowa karta z neonowym kolem w srodku.
    if _look != "felt":                      # felt = paleta domyslna, nie ma czego nadpisywac
        check("...i nakladka wie, jak go pomalowac",
              ('data-theme="%s"' % _look) in _css, _look)
# Dwa nowe sa przeniesione z prototypu, wiec musza miec wlasne TOKENY, a nie sam wpis na liscie.
check("„Neon” i „Szkło” podmieniaja tokeny rysunku",
      '.wh-svg[data-look="neon"]' in _wcss and '.wh-svg[data-look="glass"]' in _wcss)
# SZKLO ROZMYWA PODKLAD HTML-OWY, nie SVG: backdrop-filter nie dziala wprost na elementach SVG
# w czesci przegladarek. Tarcza potrzebuje promienia kola, ktorego sama nie zna - wpisuje go
# rysunek przy budowie.
check("...a „Szkło” ma podkład pod SVG i zna promień koła",
      '.wh-svg[data-look="glass"]::before' in _wcss and "--wh-r" in _wcss
      and "--wh-r:" in _rf46_src)
# Nad gra tlo okna jest WYCIETE, wiec nie ma czego rozmywac - blur rozmywalby jednolita plame
# koloru dziury i zamazywal samo ciecie.
check("...ale rozmycie tylko tam, gdzie jest co rozmywać",
      "html:not(.rf-ovl) .wh-svg[data-look=\"glass\"]::before" in _wcss)
# Over a game the window background is CUT AWAY, so letters need a halo drawn AWAY from the key
# colour - a blend towards it disappears with it. Same trick the rest of the bare overlay uses.
check("...and letters over a cut-out background keep a halo",
      'html.rf-ovl[data-theme="bare"] .wh-lab' in _wcss)
check("the stylesheet is loaded by the page that draws the wheel", "17-wheel.css" in _dash_css)
# DWA ZRODLA PODGLADU: mysz (symulacja) i prawdziwy kapsel (ten sam strumien, co nakladka).
check("the stage can be driven by the capsule as well as by the mouse",
      'WH_SRC_MODES = ["mouse", "puck"]' in _rf46_src and 'WH_SRC_KEY = "rf.wheel.src"' in _rf46_src)
check("...and in that mode it shows the LIVE packet, not an imagined one",
      'if (src === "puck")' in _rf46_src and "st = live; labels = live.labels;" in _rf46_src)
# The wheel being off is a thing to SAY, not to fix behind somebody back: arming an output is a
# decision, and in simulation it has a question of its own (rfSimConfirmOn).
# The name appears in a COMMENT there, saying why the button does not do it — so the check is for
# a CALL, not for the word. A check that a word is absent is a check somebody will "fix" by
# renaming it.
check("...and an empty capsule preview points at the switch instead of flipping it",
      "function _whStageOff" in _rf46_src
      and "rfSimConfirmOn(" not in _rf46_src.split("function whInitStage")[1]
      and "wh-poke" in _rf46_src)
# SEKCJI „zestawy" (siatka kafli presetow) JUZ NIE MA — audyt UX 2026-09-02, znalezisko #25/#26:
# pokazywala te same presety, co zakladka „Biblioteka" modulu, z inna plakietka i innym kompletem
# akcji, a zaden inny modul listy presetow w Konfiguracji nie ma. Pilnujemy, ze nie wrocila.
# UX 261120 L4e: trzy piętra. Wycinki na wierzchu, Wygląd / Sterowanie / Gdzie jako zwijaki
# piętra 2 (_whTier), strojenie sterowania, podmenu i zapis w jednym „Zaawansowane” (_whAdvGrp).
check("...and a section for 'wycinki'", '_whSec("wycinki"' in _rf46_src)
for _sec in ("wyglad", "sterowanie", "gdzie"):
    check("...and a tier-2 fold for '%s'" % _sec, '_whTier("%s"' % _sec in _rf46_src, _sec)
for _sec in ("strojenie", "podmenu", "zapis"):
    check("...and a group in 'Advanced' for '%s'" % _sec, '_whAdvGrp("%s"' % _sec in _rf46_src, _sec)
check("...and ONE 'Advanced' fold at the bottom of the column",
      _rf46_src.count('class="cardfold adv"') == 1 and 'id="whAdv"' in _rf46_src)
check("...and NO second preset list inside the configuration tab",
      '_whSec("zestawy"' not in _rf46_src and 'id="whPresetTiles"' not in _rf46_src)
check("the three shape sliders are on the card",
      'id="whSize"' in _rf46_src and 'id="whGap"' in _rf46_src and 'id="whCorner"' in _rf46_src)
# ONE number for the wheel's size. The window at the pointer used to have a slider of its own, and
# a person setting it wondered why the widget on the cheat sheet stayed the size it was.
check("the old window-size slider is gone, and the window follows the wheel's size instead",
      'id="whCurSize"' not in _rf46_src and "function whPushWinSize" in _rf46_src)
check("...and the size a capsule had under the old slider is carried over, once",
      "function _whAdoptOldSize" in _rf46_src)
check("the stage has three layouts and remembers which one it is in",
      'WH_STAGE_MODES = ["wide", "zoom", "mini"]' in _rf46_src
      and 'WH_STAGE_KEY = "rf.wheel.stage"' in _rf46_src
      and "localStorage.setItem(WH_STAGE_KEY" in _rf46_src)
check("...and Escape leaves the enlarged one",
      'if (e.key !== "Escape") return;' in _rf46_src and 'whSetStageMode("wide")' in _rf46_src)
# THE PROMISE THAT MATTERS MOST. The stage is a sandbox: a choice made on it must not reach the
# emitter, the simulation gate or the armed switch. It is a browser-side drawing and nothing else,
# so the whole of "choosing" ends at a line in the log and a toast.
# The two markers below bracket _whStageCommit itself and have to stay in the SAME file as it
# (rf-46d3): the journal moved to rf-46d2 when the stage was split into three, and a marker that
# sits in an EARLIER file would silently widen this slice to "everything after the commit".
check("choosing on the stage stays in the browser: no engine call, no arming",
      "/wheel" not in _rf46_src.split("function _whStageCommit")[1].split("function whStageNote")[0]
      and "rfSimConfirmOn" not in _rf46_src.split("function _whStageCommit")[1]
          .split("function whStageNote")[0])
check("...and it says so out loud, under the stage",
      "nic st\u0105d nie idzie do gry" in _rf46_src)
# The starter sets overwrite every slice, so they ask first — and they never touch the On switch.
check("a starter set asks before it overwrites",
      "function whApplyPreset" in _rf46_src and "_whAsk(" in _rf46_src)
check("...and an import cannot arm the wheel behind the person's back",
      "enabled: !!state.wheel.enabled" in _rf46_src)
check("import is sanitised BY THE SERVER, not by the browser",
      '_whImport' in _rf46_src and 'method: "POST"' in _rf46_src.split("function _whImport")[1]
      and "onWheelCfg(m)" in _rf46_src.split("function _whImport")[1])
# Both directions of the selection: the row being edited lights up on the stage, and a slice
# clicked on the stage selects its row. Without the second one the stage would be a picture next
# to a form rather than the same wheel.
check("the selection works both ways",
      "function whFocusRow" in _rf46_src and "whFocusRow(hv.idx)" in _rf46_src)
# The card writes its own messages now: flashTrigMsg paints into #trigMsg, which lives in the
# Mapping tab — since the wheel got a tab of its own, those messages landed where nobody was
# looking.
check("the card's messages land on the card, not in another tab",
      "function whToast" in _rf46_src and 'id="whToast"' in _rf46_src)
_DASH = os.path.join(_ROOT, "web", "ribbitflip_dashboard.html")
with open(_DASH, "r", encoding="utf-8") as _f:
    _dash = _f.read()
_ORDER = ["rf-46a-wheel-shape.js", "rf-46-wheel.js", "rf-46b-wheel-card.js",
          "rf-46c-wheel-tree.js", "rf-46d-wheel-stage.js", "rf-46e-wheel-io.js"]
check("every file of the family is loaded, in dependency order",
      all(_n in _dash for _n in _ORDER)
      and [_dash.index(_n) for _n in _ORDER] == sorted(_dash.index(_n) for _n in _ORDER),
      [_n for _n in _ORDER if _n not in _dash])

# ================== l. THE STAGE: ITS SIZE, ITS STICKINESS, ITS ENLARGED SELF =================
# Owner, 2026-08-26: "preview menu kolowego jest troche za malym obszarem, a po powiekszeniu nie
# dziala" and, with a marked-up screenshot: "jak scrolluje w dol, to zeby to radial menu bylo
# przystickowane po lewej stronie. i tez niech to lewe menu ma wielkosc od gory do dolu tego
# elementu ui".
#
# Three faults, and each of them was INVISIBLE in the source: every rule involved was present and
# spelled correctly, and none of them did what it said.
#
#   1. "Powieksz" laid the stage out as `position:absolute; inset:8px` — but the stage is a GRID
#      CHILD carrying `align-self:start`, and for an absolutely positioned grid child that one
#      property beats the `top`/`bottom` pair. The box stopped stretching and shrank to its own
#      content, i.e. to the row of buttons. Measured: stage 63px tall, scene 1px, the drawing's
#      container 0px, and the wheel fell to the renderer's 60px floor at the top edge. So the
#      overlay DID open, empty and dead. Hence: an explicit `align-self:stretch` in zoom, and a
#      renderer that WAITS for a real size instead of drawing a dot into nothing.
#   2. The stage was 360px tall next to a 750px-wide column, and the wheel is measured by the
#      SHORTER side — so most of the width stood empty. And it was drawn at its true diameter, so
#      a 120px wheel became a dot in a field. Now the stage asks for ~85% of its shorter side,
#      whatever the configured size is, and the caption says what the size in the game really is.
#   3. `position:sticky` was on the stage from the start and NEVER worked: `.card` has
#      `overflow:hidden`, which makes the card a scroll container, and a sticky box clings to the
#      nearest one of those — one that never scrolls. Measured: scrolling by 1200px moved the
#      stage by 1200px. `overflow:clip` on this one card clips exactly the same and is not a
#      scroll container, so the stage finally sticks.
print("\n--- scena: wielkosc, lepkosc i tryb powiekszony ---")
check("the stage asks for a diameter of its own, instead of the one the game will use",
      "function whStageSizePx" in _rf46_src
      and "size: whStageSizePx(host, st && st.look)" in _rf46_src)
check("...and the renderer accepts that request without a second geometry",
      "opts.size > 0" in _rf46_src and "want / 2)" in _rf46_src)
# A stage whose wheel is the same size at 120 px and at 640 px teaches that the slider does
# nothing. Owner, minutes after the first fix: "wielkosc kola nie dziala. za kazdym razem jest
# wielkie niewazne co robie." So the scale is agreed-upon, not fixed: the whole range of the
# slider stretches over a share of the stage, a quarter of it at the smallest, nearly all of it
# at the largest.
check("...and the size that was set still SHOWS, stretched across the stage instead of ignored",
      "WH_STAGE_FILL_MIN = 0.25" in _rf46_src and "WH_STAGE_FILL_MAX = 0.92" in _rf46_src
      and "function whStageFill" in _rf46_src
      and "(s - WHEEL_SIZE_MIN) / span" in _rf46_src)
check("...and pointing, needle and clamping all read THAT radius, never a remembered one",
      "whStageSizePx(host, st && st.look) || wheelLook" in _rf46_src
      and _rf46_src.count("_whStageR(host") >= 3)
# A container with no size is not a small container. Drawing the 60px minimum into a strip one
# pixel high is what "Powieksz nie dziala" looked like from the outside.
check("a container without a size is waited out, not drawn into",
      "if (cw < 2 || ch < 2) return;" in _rf46_src)
check("the enlarged stage is told to stretch, against the alignment it carries from the grid",
      'data-stage="zoom"] .wh-stage' in _tr_css
      and "align-self:stretch" in _tr_css.split('data-stage="zoom"] .wh-stage')[1][:400])
check("...and its height is fixed rather than merely floored, so it cannot outgrow the window",
      'data-stage="zoom"] .wh-body{height:clamp(' in _tr_css)
check("the card clips without becoming a scroll container, so sticky can work at all",
      "#wheelCard{overflow:clip}" in _tr_css)
check("...and the stage stops below the app's own sticky bars, not underneath them",
      "--wh-top:var(--rf-sticky-top" in _tr_css and "top:var(--wh-top)" in _tr_css)
# Measured, not guessed, and measured ONCE for the whole application (rf-40 `rfWatchModHead`):
# this file used to measure the app's tab bar here, which the three-column rebuild (2026-08-29)
# removed — the measurement fell through to the header alone and the stage parked 67 px too high,
# with its own button bar behind the module bar. The same number was guessed separately by the
# mouse preview, the controller map and the scanner preview, so it lives in one variable now.
check("...measured for every sticky column at once, so this file no longer measures anything",
      "function whStageTopPx" not in _rf46_src and "function whStageTopSync" not in _rf46_src
      and "--rf-sticky-top" in _rf46_src)
check("...and in two columns it reaches from that stop down to the bottom of the window",
      "@media (min-width:981px)" in _tr_css
      and 'data-stage="wide"] .wh-stage{height:calc(100vh - var(--wh-top' in _tr_css)
# One column means the stage sits ABOVE the editing, so pinning it would eat the window it shares
# with the row being edited.
check("...but is NOT pinned when the two columns collapse into one",
      ".wh-stage{position:static}" in _tr_css)
# The stage is no longer a 1:1 picture, so the number has to be said out loud somewhere.
check("the caption says the size the wheel will really have in the game",
      "W grze koło ma " in _rf46_src and " px średnicy" in _rf46_src
      and "In the game the wheel is " in _rf46_src)
# The old sentence warned that the preview had been shrunk. Scaling is the rule now, so the
# warning would contradict the caption standing next to it. Looked for as a STRING (opening quote
# included) rather than as a word: the word still stands in the comment that explains why it went.
check("...and the old warning about a scaled-down preview is gone, not left to contradict it",
      '"Podgląd pomniejszony' not in _rf46_src and '"Preview scaled down' not in _rf46_src)
# Enlarging is a deliberate act, and the enlarged stage can be taller than what is on screen.
# Restoring a remembered layout is not, and must not throw the page around.
check("enlarging brings the stage into view; restoring the remembered layout does not scroll",
      'whSetStageMode(whStageMode() === "zoom" ? "wide" : "zoom", true)' in _rf46_src
      and 'if (user && m === "zoom")' in _rf46_src
      and "whSetStageMode(whStageMode());" in _rf46_src)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
