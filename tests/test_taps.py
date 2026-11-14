# Contract test: DOKŁADNIE N PUKNIĘĆ (`behavior: "taps"`). Uruchom: py tests/test_taps.py
#
# Po co to zachowanie istnieje. Potrzebny był jeden przycisk kapsla, który
# umie cztery rzeczy naraz: „klik, dwuklik, a prawy klik to przytrzymanie przez ustawioną długość
# czasu… mouseclick nie mam pomysłu. może trzy szybkie?". Na istniejącym `multi` nie da się tego
# zbudować: `multi` strzela W CHWILI, w której doliczy N, więc reguła „1×" wysyła lewy przycisk
# przy PIERWSZYM naciśnięciu dwukliku, a reguła „2×" dokłada do tego dwuklik. Dwie akcje na jeden
# gest — i nie ma jak tego rozstrzygnąć po fakcie.
#
# `taps` przenosi decyzję na KONIEC OKNA: liczy naciśnięcia i dopiero, gdy okno minie, sprawdza,
# czy było ich dokładnie tyle, ile prosi reguła. Ceną jest opóźnienie pojedynczego puknięcia
# o długość okna — ta sama cena, którą płaci dwuklik myszy w każdym systemie.
#
# Co jest tu pilnowane i co cicho pęka, gdy pęknie:
#   1. jedno puknięcie NIE strzela przy dwukliku (inaczej każdy dwuklik niesie ze sobą lewy klik),
#   2. akcja idzie na koniec okna, nie przy zboczu (inaczej wracamy do `multi`),
#   3. PRZYTRZYMANIE NIE JEST PUKNIĘCIEM — warunek wciąż trwający na koniec okna kasuje gest;
#      bez tego „przytrzymaj = prawy" i „puknij = lewy" na jednym przycisku wykluczają się,
#   4. gotowy zestaw czterech reguł (lewy / dwuklik / środkowy / prawy) działa RAZEM.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
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
        print("FAIL  %s   %s" % (name, detail))


class Bus:
    def __init__(self):
        self.events = []

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)


class Out:
    """Zamiast SlotOutput: zapisuje, nie naciska niczego."""

    def __init__(self):
        self.log = []

    def tap(self, spec):
        self.log.append(("tap", spec))

    def down(self, spec):
        self.log.append(("down", spec))

    def up(self, spec):
        self.log.append(("up", spec))


BTN = {"kind": "button", "any": True, "byte": 1, "bit": 0, "holdMs": 120}
WIN = 400


def engine(out):
    e = rf.TriggerEngine(Bus(), emitter=out, armed=True)
    e.enabled = True
    return e


def rule(rid, need, spec, beh="taps", **kw):
    r = {"id": rid, "label": rid, "enabled": True, "source": dict(BTN), "abs": False,
         "cmp": ">", "threshold": 0, "behavior": beh, "crossings": need, "windowMs": WIN,
         "keySpec": spec, "extraConditions": []}
    r.update(kw)
    return r


def press(e):
    e.on_button_level(0x01)
    e.on_status(bytes([0x21, 0x01, 0x00, 0x00, 0x00]))


def release(e):
    e.on_button_level(0x00)
    e.on_status(bytes([0x21, 0x00, 0x00, 0x00, 0x00]))


def tap(e, n=1):
    """n pełnych puknięć: naciśnij, przelicz, puść, odczekaj, przelicz.

    ⚠️ ODSTĘP MIĘDZY PUKNIĘCIAMI JEST CZĘŚCIĄ GESTU. Naciśnięcie trzyma się przez `holdMs`
    (podłoga 120 ms — test_button_hold), więc dwa puknięcia szybsze niż ta podłoga zlewają się
    w JEDNO zbocze i silnik ma prawo policzyć je jako jedno. Tu odstęp jest odmierzany przez
    postarzenie znaczników; na żywo robi to ręka. To także realne ograniczenie funkcji: okno
    puknięć musi być wyraźnie dłuższe od `holdMs`, inaczej „dwuklik" nie ma jak powstać."""
    for _ in range(n):
        press(e)
        e.tick()
        release(e)
        e.tick()
        e._btn_any_ts -= 0.15                      # tyle, ile trwa przerwa między puknięciami
        for k in list(getattr(e, "_btn_high", {}) or {}):
            e._btn_high[k] -= 0.15
        e.tick()


def window_out(e, held=False):
    """Upływ okna — przez postarzenie znaczników, tak samo, jak robi to test przycisku
    (`e._btn_any_ts -= 0.3`). Czekanie prawdziwych 0,4 s kosztowałoby sekundy i niczego by nie
    dowiodło.

    ⚠️ POSTARZYĆ TRZEBA TEŻ PRZYCISK, nie tylko okno. Naciśnięcie trzyma się przez `holdMs`
    (podłoga 120 ms — patrz test_button_hold), więc bez tego warunek jest na koniec okna WCIĄŻ
    spełniony i gest słusznie przepada jako „przytrzymanie". Na żywo te 120 ms mija samo, bo okno
    puknięć jest od niego dłuższe; w teście czas trzeba przesunąć ręcznie.
    `held=True` znaczy „kciuk nadal na przycisku" — poziom jest wtedy odnawiany."""
    dt = (WIN / 1000.0) + 0.05
    for rt in e._rt.values():
        if rt.get("seq_start"):
            rt["seq_start"] -= dt
    e._btn_any_ts -= dt
    for k in list(getattr(e, "_btn_high", {}) or {}):
        e._btn_high[k] -= dt
    if held:
        e.on_button_level(0x01)
    e.tick()


# --- 1. jedno puknięcie: akcja DOPIERO na koniec okna ----------------------------------------
print("\n--- jedno puknięcie ---")
out = Out(); e = engine(out)
e.set_rules([rule("t1", 1, "mouse:left")])
tap(e)
check("zaraz po puknięciu jeszcze nic nie poszło (okno trwa)", out.log == [], str(out.log))
window_out(e)
check("...a na koniec okna idzie lewy klik", out.log == [("tap", "mouse:left")], str(out.log))
window_out(e)
check("...i tylko raz — puste okno niczego nie powtarza",
      out.log == [("tap", "mouse:left")], str(out.log))

# --- 2. dwuklik NIE niesie ze sobą pojedynczego klika ----------------------------------------
# To jest sedno całej zmiany: na `multi` ten sam scenariusz dawał lewy klik przy pierwszym
# naciśnięciu i dopiero potem dwuklik.
print("\n--- dwa puknięcia ---")
out = Out(); e = engine(out)
e.set_rules([rule("t1", 1, "mouse:left"), rule("t2", 2, "mouse:double")])
tap(e, 2)
check("w trakcie okna cisza", out.log == [], str(out.log))
window_out(e)
check("na koniec okna idzie SAM dwuklik", out.log == [("tap", "mouse:double")], str(out.log))

# --- 3. trzy puknięcia: ani lewy, ani dwuklik ------------------------------------------------
print("\n--- trzy puknięcia ---")
out = Out(); e = engine(out)
e.set_rules([rule("t1", 1, "mouse:left"), rule("t2", 2, "mouse:double"),
             rule("t3", 3, "mouse:middle")])
tap(e, 3)
window_out(e)
check("na koniec okna idzie sam środkowy", out.log == [("tap", "mouse:middle")], str(out.log))

# --- 4. przytrzymanie nie jest puknięciem ----------------------------------------------------
print("\n--- przytrzymanie ---")
out = Out(); e = engine(out)
e.set_rules([rule("t1", 1, "mouse:left")])
press(e)
e.tick()                                   # naciśnięty i TRZYMANY — nie puszczamy
window_out(e, held=True)
check("gest przepada, gdy na koniec okna przycisk wciąż jest wciśnięty", out.log == [], str(out.log))
release(e)
e.tick()
check("...i puszczenie po fakcie też niczego nie wysyła", out.log == [], str(out.log))

# --- 5. GOTOWY ZESTAW: lewy / dwuklik / środkowy + prawy z przytrzymania ---------------------
print("\n--- cztery gesty na jednym przycisku ---")
SET = [rule("mbtn-tap1", 1, "mouse:left"), rule("mbtn-tap2", 2, "mouse:double"),
       rule("mbtn-tap3", 3, "mouse:middle"),
       rule("mbtn-hold", 1, "mouse:right", beh="dwell", dwellMs=600)]
for n, want in ((1, "mouse:left"), (2, "mouse:double"), (3, "mouse:middle")):
    out = Out(); e = engine(out)
    e.set_rules([dict(r) for r in SET])
    tap(e, n)
    window_out(e)
    check("%d× → %s (i nic poza tym)" % (n, want), out.log == [("tap", want)], str(out.log))
out = Out(); e = engine(out)
e.set_rules([dict(r) for r in SET])
press(e)
e.tick()
rt = e._rt.get("mbtn-hold") or {}
if rt.get("dwell_start"):
    rt["dwell_start"] -= 1.0               # 0,6 s przytrzymania minęło (silnik liczy `dwell_start`)
e.on_button_level(0x01)                    # kciuk nadal leży na przycisku
e.tick()
window_out(e, held=True)                   # okno puknięć mija, a kciuk NADAL leży na przycisku
check("przytrzymanie → prawy klik, bez lewego po drodze",
      out.log == [("tap", "mouse:right")], str(out.log))

# --- 6. sanityzator ---------------------------------------------------------------------------
print("\n--- sanityzator ---")
s = rf.sanitize_rules([rule("t", 1, "mouse:left")])[0]
check("zachowanie „taps\" przechodzi przez sanityzator", s["behavior"] == "taps", s["behavior"])
check("...i jedno puknięcie zostaje jedynką", s["crossings"] == 1, s["crossings"])
m = rf.sanitize_rules([rule("m", 1, "a", beh="multi")])[0]
check("przy „multi\" podłoga nadal wynosi 2 (1× to po prostu „jednorazowo\")",
      m["crossings"] == 2, m["crossings"])
b = rf.sanitize_rules([rule("b", 99, "a")])[0]
check("sufit ośmiu puknięć trzyma", b["crossings"] == 8, b["crossings"])
u = rf.sanitize_rules([{"id": "u", "behavior": "cokolwiek", "source": dict(BTN)}])[0]
check("nieznane zachowanie wraca do „once\"", u["behavior"] == "once", u["behavior"])

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
