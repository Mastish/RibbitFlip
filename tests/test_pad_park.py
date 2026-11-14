# RUCH ZAPARKOWANY — modul Kontroler wlaczony, drazek stoi. Uruchom: py tests/test_pad_park.py
#
# SKAD TO SIE WZIELO. Blad: wylaczenie sterowania prawym analogiem odpinalo caly kontroler,
# jakby te kontrolki byly ze soba powiazane. Byly: wlacznik
# jednej czesci pada (#padPartDrive) pisal w `mouse.enabled`, a `AirMouse.pad_output_on()` to
# `enabled AND mode != "mouse"` — czyli ten sam flag, ktory decyduje, czy mapowania `pad:` maja
# dokad isc. Zgaszenie drazka gasilo wiec caly modul razem z przyciskami i przestawialo wlacznik
# w naglowku karty.
#
# Ten sam brak gryzl z drugiej strony w zestawach do gier: kapsel „tylko przycisk" MUSIAL miec
# wlaczone sterowanie ruchem, wiec drazek parkowano arytmetycznie (czulosc 0,10x pod martwa strefa
# 0,90). Jedno pole `padPark` zamyka oba przypadki: `enabled` znaczy MODUL, `padPark` znaczy RUCH.
#
# CO TU PILNUJEMY, i dlaczego kazde z tego jest decyzja, a nie przypadkiem:
#
#   * park NIE zamyka modulu — pad_output_on() ma dalej mowic „tak", inaczej zgloszenie wraca,
#   * park gasi WYJSCIE, nie liczenie — podglad pada na ekranie ma dalej chodzic za kapslem
#     (ta sama zasada, co przy wylaczonej grupie: „SWITCHED OFF STILL COMPUTES"),
#   * wejscie w park puszcza to, co bylo trzymane — drazek wraca na srodek, klawisze WSAD/krzyzaka
#     ida w gore; inaczej zaparkowanie w ruchu zostawia wcisniety kierunek na zawsze,
#   * tryb myszy park ignoruje — to wyjscie na pada, a kursor jest innym wyjsciem,
#   * BRAK klucza w starym pliku znaczy dokladnie False (lekcja `dpadInner`, gdzie brak klucza byl
#     dowodem „stary format" i po cichu przeliczal martwa strefe krzyzaka).
#
# Nic tutaj nie wpina kontrolera do czyjegos Windowsa: pad jest nagrywajaca atrapa.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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


def _read(*parts):
    with open(os.path.join(_ROOT, *parts), "r", encoding="utf-8") as f:
        return f.read()


class _StubB:
    def __init__(self):
        self.events = []

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)


class _StubTrig:
    armed = True


class _RecKeys:
    def __init__(self):
        self.held = set()

    def down(self, spec):
        self.held.add(spec)

    def up(self, spec):
        self.held.discard(spec)


class _RecPad:
    """A pad that writes down what it was told, and nothing else."""

    def __init__(self):
        self.sticks = []
        self.dpads = []
        self.resets = 0

    def set_stick(self, which, x, y):
        self.sticks.append((which, round(x, 4), round(y, 4)))

    def set_dpad(self, *a):
        self.dpads.append(tuple(bool(v) for v in a))

    def set_touch(self, *a):
        pass

    def reset(self):
        self.resets += 1

    def importable(self):
        return True

    @property
    def active(self):
        return True


def _mk(pad=None, keys=None, **cfg):
    m = rf.AirMouse(_StubB(), emitter=keys or object(), trig=_StubTrig(), gamepad=pad or _RecPad())
    base = {"enabled": True, "mode": "stick", "stickBackend": "gamepad",
            "stickSource": "filter", "stickMetricX": "roll", "stickMetricY": "pitch",
            "stickFilterScale": 45.0, "stickInner": 0.1, "stickOuter": 0.0, "stickExpo": 1.0,
            "stickAccel": 1.0}      # instant ramp: one tick is enough to reach the target
    base.update(cfg)
    m.set_config(base)
    return m


def _aim(m, roll=0.0, pitch=0.0, ticks=8):
    m.on_pose({"roll": roll, "pitch": pitch, "tilt": max(abs(roll), abs(pitch)), "twist": 0.0})
    for _ in range(ticks):
        m.on_sample([0, 0, 0, 0, 0, 0])
        m.tick()
    return m._stick


print("--- pole istnieje, domyslnie nic nie zmienia, a jego BRAK znaczy False ---")
m = _mk()
check("padPark domyslnie False — kapsel, ktory nigdy o tym polu nie slyszal, zachowuje sie jak dotad",
      rf.AirMouse.DEFAULTS["padPark"] is False and m.cfg["padPark"] is False, m.cfg.get("padPark"))
m = _mk(padPark="tak")
check("wartosc z cudzego pliku jest sprowadzana do boola, nie przepuszczana jako napis",
      m.cfg["padPark"] is True, repr(m.cfg["padPark"]))
_old = {k: v for k, v in dict(_mk().cfg).items() if k != "padPark"}
m = rf.AirMouse(_StubB(), emitter=object(), trig=_StubTrig(), gamepad=_RecPad())
m.set_config(_old)                      # konfiguracja sprzed istnienia pola
check("brak klucza w starym pliku = False i ZADNEJ migracji po jego nieobecnosci",
      m.cfg["padPark"] is False, m.cfg["padPark"])


print("\n--- park NIE zamyka modulu: mapowania `pad:` maja dalej dokad isc ---")
m = _mk(padPark=True)
check("pad_output_on() przy zaparkowanym ruchu dalej mowi TAK (to byl caly sens zgloszenia)",
      m.pad_output_on() is True)
m = _mk(padPark=True, mode="mouse")
check("...ale tryb myszy to nadal NIE modul Kontroler", m.pad_output_on() is False)
m = _mk(padPark=True, enabled=False)
check("...a wylaczony modul zostaje wylaczony — park go nie wskrzesza", m.pad_output_on() is False)
check("pad_output_on nie czyta padPark ani slowem",
      "padPark" not in _read("ribbitflip_monitor.py").split("def pad_output_on")[1].split("def get_config")[0]
      .split('"""')[2])


print("\n--- park gasi WYJSCIE, nie liczenie ---")
pad = _RecPad()
m = _mk(pad=pad)
sx, sy = _aim(m, roll=45.0)
check("bez parku pelny przechyl jedzie na pada", len(pad.sticks) > 0 and abs(sx) > 0.5, (len(pad.sticks), sx))
pad = _RecPad()
m = _mk(pad=pad, padPark=True)
sx, sy = _aim(m, roll=45.0)
check("z parkiem pad nie dostaje ANI JEDNEGO wychylenia", pad.sticks == [], pad.sticks[:3])
check("...a podglad na ekranie dalej chodzi za kapslem (rysunek pada nie zamarza)",
      abs(sx) > 0.5, (sx, sy))


print("\n--- zaparkowanie W RUCHU puszcza to, co bylo trzymane ---")
pad = _RecPad()
m = _mk(pad=pad)
_aim(m, roll=45.0)
before = pad.resets
cfg = dict(m.get_config()); cfg["padPark"] = True
m.set_config(cfg)
_aim(m, roll=45.0)
check("przejscie live -> park wola reset pada (drazek wraca na srodek)", pad.resets > before,
      (before, pad.resets))
keys = _RecKeys()
m = _mk(keys=keys, stickBackend="wsad", stickWsadThr=0.3,
        stickUp="w", stickDown="s", stickLeft="a", stickRight="d")
_aim(m, roll=45.0)
check("WSAD: bez parku kierunek jest trzymany", keys.held == {"d"}, keys.held)
cfg = dict(m.get_config()); cfg["padPark"] = True
m.set_config(cfg)
_aim(m, roll=45.0)
check("...a po zaparkowaniu nie zostaje wcisniety zaden klawisz", keys.held == set(), keys.held)


print("\n--- krzyzak parkuje sie tak samo jak drazek ---")
pad = _RecPad()
m = _mk(pad=pad, mode="dpad", dpadBackend="gamepad", dpadSource="filter",
        dpadMetricX="roll", dpadMetricY="pitch", dpadFilterScale=45.0, dpadFilterDead=5.0)
_aim(m, roll=45.0)
check("bez parku krzyzak wychodzi na pada", len(pad.dpads) > 0, len(pad.dpads))
pad = _RecPad()
m = _mk(pad=pad, padPark=True, mode="dpad", dpadBackend="gamepad", dpadSource="filter",
        dpadMetricX="roll", dpadMetricY="pitch", dpadFilterScale=45.0, dpadFilterDead=5.0)
_aim(m, roll=45.0)
check("z parkiem nie wychodzi nic", pad.dpads == [], pad.dpads[:3])


print("\n--- tryb myszy park IGNORUJE: to wyjscie na pada, kursor jest innym wyjsciem ---")
_py = _read("ribbitflip_monitor.py")
check("warunek w on_sample jest zawezony do trybow pada",
      'if cfg["padPark"] and mode in ("stick", "dpad"):' in _py and "live = False" in _py)


print("\n--- podglad importu czyta POLE, a arytmetyke zostawia dla starych paczek ---")
f = rf.setup_motion_facts({"mouse": {"mode": "stick", "enabled": True, "padPark": True,
                                     "stickBackend": "gamepad", "stickSensX": 1.0,
                                     "stickSensY": 1.0, "stickInner": 0.08}})
check("pole wystarczy: `parked` bez zerowania czulosci liczbami", f["parked"] is True, f)
f = rf.setup_motion_facts({"mouse": {"mode": "stick", "enabled": True,
                                     "stickBackend": "gamepad", "stickSensX": 0.1,
                                     "stickSensY": 0.1, "stickInner": 0.9}})
check("stara paczka (czulosc 0,10x pod martwa strefa 0,90) dalej czyta sie jako zaparkowana",
      f["parked"] is True, f)
f = rf.setup_motion_facts({"mouse": {"mode": "dpad", "enabled": True, "padPark": True,
                                     "dpadBackend": "gamepad"}})
check("krzyzak tez ma teraz odpowiedz — arytmetycznie nie dalo sie go zaparkowac",
      f.get("parked") is True, f)
f = rf.setup_motion_facts({"mouse": {"mode": "stick", "enabled": True,
                                     "stickBackend": "gamepad", "stickSensX": 1.0,
                                     "stickSensY": 1.0, "stickInner": 0.08}})
check("...a zwykly zestaw nie jest nagle 'tylko przyciskiem'", f["parked"] is False, f)


print("\n--- panel: dwa wlaczniki, dwa pola ---")
_f43 = _read("web", "js", "rf-43-controller-ui.js")
_f31 = _read("web", "js", "rf-31-mouse-ui.js")
_f15 = _read("web", "js", "rf-15-motionmode.js")
_f44 = _read("web", "js", "rf-44-pad-hub.js")
_html = _read("web", "ribbitflip_dashboard.html")
_i18n = _read("web", "js", "rf-01-i18n.js")
_drive = _f43.split("const _driveToggle")[1].split("if(drive)drive.onclick")[0]
check("wylaczenie czesci pada pisze padPark, a NIE gasi m.enabled",
      "m.padPark=true;" in _drive and "m.enabled=false" not in _drive, _drive[-400:])
check("...wlaczenie zdejmuje park razem z wycelowaniem",
      "m.enabled=true;" in _drive and "m.padPark=false;" in _drive)
check("stan przelacznika czesci uwzglednia park",
      "const parked=!!(m.padPark&&m.mode!==\"mouse\");" in _drive)
check("wlacznik naglowka karty (#kEnable) dalej swieci od MODULU, nie od parku",
      'const _mouseOn=!!(m.enabled&&m.mode==="mouse"), _padOn=!!(m.enabled&&m.mode!=="mouse");' in _f15)
check("wlaczenie karty ruchu odparkowuje (On, przy ktorym nic nie jedzie, bylby kolejnym klamstwem)",
      "m.mode=modeOf();m.enabled=true;m.padPark=false;" in _f31)
check("padPark jest w MOUSE_KEYS — inaczej park nie przezylby odswiezenia strony",
      '"padPark",' in _f15.split("const MOUSE_KEYS=[")[1].split("];")[0])
check("kropka kapsla w koncentratorze padow gasnie przy parku",
      'const liveMotion=!!(cfg.enabled&&cfg.mode!=="mouse"&&!cfg.padPark);' in _f44)


print("\n--- panel mowi, ktory ze stanow to jest ---")
check("czesc pada ma osobne zdanie dla parku (wycelowana i niewycelowana)",
      "Modul jest wlaczony i przyciski pada dzialaja, ale ruch kapsla jest zaparkowany."
      .replace("Modul", "Moduł").replace("wlaczony", "włączony").replace("dzialaja", "działają") in _f43
      and "nie prowadzi teraz żadnej części pada." in _f43)
check("...z parami EN", '"The module is on and the pad buttons work, but the capsule\'s motion is parked."' in _f43
      and "it is driving no part of the pad right now." in _f43)
check("chip karty mowi 'zaparkowany', a nie 'nieaktywny' (to dwa rozne stany)",
      '"○ ruch zaparkowany"' in _f15 and '"○ ruch zaparkowany":"○ motion parked"' in _i18n)
check("linia karty Kontroler nie mowi juz 'NA ZYWO' przy zaparkowanym ruchu",
      'if(side==="k"&&_park)return' in _f15 and "const _park=!!(m.padPark&&m.mode!==\"mouse\");" in _f15)
# Rzeczownik („drazek" / „krzyzak") przychodzi w MIANOWNIKU, bo w pozostalych zdaniach jest
# podmiotem. Zdanie parku musi byc tak ulozone, zeby i tu nim byl: pierwsza wersja skladala sie
# w „nie prowadzi drazek", co nie jest polszczyzna. Przyklejone do testu, zeby nie wrocilo.
check("...i sklada sie po polsku: rzeczownik jest PODMIOTEM ('drazek stoi'), nie dopelnieniem",
      "ale ruch jest zaparkowany: " in _f15 and '+noun+_gl(" stoi.' in _f15
      and "nie prowadzi \"+noun" not in _f15)
check("karta Myszy nie twierdzi, ze ruch 'steruje teraz kontrolerem', kiedy stoi",
      "ale jest tam zaparkowany" in _f15)
check("komunikat o wirtualnym padzie rozroznia 'pad istnieje' od 'drazek nim steruje'",
      "Przyciski wychodzą, ale ruch kapsla nie prowadzi drążka (zaparkowany)." in _f15
      and "Przyciski wychodzą, ale ruch kapsla nie prowadzi drążka (zaparkowany).\":" in _i18n)
check("podpowiedz przelacznika mowi, ze OFF parkuje, a nie gasi modul",
      "Wyłączenie PARKUJE sam ruch" in _html and "mapowania przycisków pada dalej wychodzą" in _html)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
