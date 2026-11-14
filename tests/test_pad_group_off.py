"""Przyciski pada sluchaja modulu Kontroler, nie grupy Mapowanie (2026-09-08).

Historia: "analogi dzialaja, ale z przyciskami R2 i R3 nic sie nie pokazuje" na testerze pada.
Drazki szly grupa Sterowanie ruchem, przyciski grupa Mapowanie - a ta byla wylaczona. Samo
wlaczenie modulu Kontroler ma wysylac zmapowane przyciski kontrolera bez osobnej aktywacji
drugiego modulu. Wiec: wlacznik w naglowku karty
Kontroler (ruch wycelowany w pad) jest JEDYNA bramka dla `pad:`; Mapowanie zostaje przy klawiszach.
Sprawdzamy bramke w silniku (funkcjonalnie, na stubach), zwalnianie trzymanych przyciskow, pasek
z przyciskiem i dymek z powodem. Bez znakow spoza ASCII w print() - konsola cp1250.
"""
import os
import sys
import threading

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


_py = _read("ribbitflip_monitor.py")
_f42 = _read("web", "js", "rf-42-padview.js")
_f43 = _read("web", "js", "rf-43-controller-ui.js")
_f44 = _read("web", "js", "rf-44-pad-hub.js")
_g = _read("web", "js", "rf-39b-guides.js")
_html = _read("web", "ribbitflip_dashboard.html")
_css = _read("web", "css", "14c-controller.css")

print("\n--- silnik: ktora bramka dla ktorego spec-u ---")
e = rf.TriggerEngine.__new__(rf.TriggerEngine)
e.enabled = False
e.pad_on = lambda: True
check("pad:a wychodzi przy WYLACZONEJ grupie Mapowanie, gdy modul Kontroler jest wlaczony",
      e._gate_for("pad:a") is True)
check("...a klawisz przy tej samej konfiguracji NIE (Mapowanie dalej rzadzi klawiszami)",
      e._gate_for("a") is False)
e.enabled = True
e.pad_on = lambda: False
check("pad:rt NIE wychodzi przy wlaczonej grupie Mapowanie, gdy modul Kontroler jest wylaczony",
      e._gate_for("pad:rt") is False and e._gate_for("space") is True)
e.pad_on = None
check("bez podpietego modulu (stuby, testy) pad wraca do grupy Mapowanie jak dawniej",
      e._gate_for("pad:a") is True)
e.pad_on = lambda: (_ for _ in ()).throw(RuntimeError("x"))
check("wyjatek w bramce nie zabija odpalenia - wraca do grupy", e._gate_for("pad:a") is True)
check("fire uzywa bramki, a nie golego self.enabled",
      "self.armed and spec and self._gate_for(spec))" in _py
      and "self.armed and spec and self.enabled)" not in _py)

print("\n--- AirMouse: modul Kontroler = ruch wlaczony I wycelowany w pad ---")
m = rf.AirMouse.__new__(rf.AirMouse)
m._lock = threading.Lock()
m.cfg = {"enabled": True, "mode": "stick"}
on1 = m.pad_output_on()
m.cfg = {"enabled": True, "mode": "mouse"}
on2 = m.pad_output_on()
m.cfg = {"enabled": False, "mode": "dpad"}
on3 = m.pad_output_on()
check("stick+enabled = on; mouse+enabled = off; dpad+disabled = off", on1 is True and on2 is False and on3 is False)
check("Device podpina bramke do AirMouse", "self.trig.pad_on = self.mouse.pad_output_on" in _py)

print("\n--- wylaczenie modulu puszcza trzymane przyciski pada ---")
class _Em:
    def __init__(self): self.ups = []
    def up(self, spec): self.ups.append(spec)
e2 = rf.TriggerEngine.__new__(rf.TriggerEngine)
e2._lock = threading.Lock()
e2.emitter = _Em()
e2._rt = {"r1": {"held": True, "held_spec": "pad:rb", "over": True},
          "r2": {"held": True, "held_spec": "w", "over": True},
          "r3": {"held": False, "held_spec": "pad:a", "over": False}}
e2.release_pad_held()
check("release_pad_held puszcza TYLKO przyciski pada i tylko trzymane",
      e2.emitter.ups == ["pad:rb"] and e2._rt["r1"]["held"] is False and e2._rt["r2"]["held"] is True)
check("...i jest wolane po zapisie konfiguracji ruchu, gdy modul zgasl",
      "if not d.mouse.pad_output_on():" in _py and "d.trig.release_pad_held()" in _py)

print("\n--- zakladka Kontroler: pasek nazywa WLACZNIK MODULU, nie grupe ---")
check("pasek stoi pod naglowkiem konfiguracji", 'id="padOffNote" class="pad-offnote" role="status" hidden' in _html
      and _html.index('id="padCfgHead"') < _html.index('id="padOffNote"'))
_fn = _f43.split("function padOffNoteSync")[1].split("function padPartSync")[0]
check("warunek = modul Kontroler (enabled i tryb != mysz), z konfiguracji TEGO kapsla",
      'return !!(c.enabled&&c.mode!=="mouse");' in _fn and "padCfgOf(dev)" in _fn and "trigEnabled" not in _fn)
check("...tylko dla kapsli z mapowaniami pada", "specIsPad(r.keySpec)" in _fn)
check("przycisk: aktywny kapsel przez wlacznik karty (#kEnable), cudzy prosto do jego konfiguracji",
      'document.getElementById("kEnable"); if(k)k.click(); return;' in _fn
      and 'fetch("/airmouse?dev="+encodeURIComponent(dev)' in _fn and 'if(c.mode==="mouse")body.mode="stick";' in _fn)
check("...i osobne zdanie, gdy wyjscia nie sa uzbrojone", "const armedOff=!state.armed&&mem.some(hasPad);" in _fn)
check("lustro grupy Mapowanie zniknelo z ekranu Kontroler",
      'id="padTrigEnable"' not in _html and "Przyciski pada wychodzą razem z ruchem" in _html)
check("styl paska", ".pad-offnote{" in _css and ".pad-offnote[hidden]{display:none}" in _css)

print("\n--- zablokowane nacisniecie mowi dlaczego ---")
_t = _f42.split("function gpvBlockedToast")[1][:1800]
check("rf-42: tf z sent=false wola dymek, max raz na 8 s na kapsel",
      "if(m.sent===false)gpvBlockedToast(dev,btns[0]);" in _f42 and "_gpvBlockedT[dev]&&now-_gpvBlockedT[dev]<8000" in _t)
check("...powod: brak kontrolera, modul Kontroler, uzbrojenie, wstrzymanie",
      all(k in _t for k in ("nie jest przypięty do żadnego kontrolera", "moduł Kontroler tego kapsla jest wyłączony",
                            "nie są uzbrojone", "wstrzymany")) and "Mapowanie" not in _t)
# TRZY wystapienia w rf-42 od 2026-09-11: wpis slownika, podpis pod padem JEDNEGO kapsla
# (gpvFrame) i podpis pod padem SCALONYM (gpvPaintMerged). Liczba jest tu po to, zeby nowy podpis
# nie wrocil do starego, nieprawdziwego zdania o „grupie wyjscia" — a nie po to, zeby zabronic
# dolozenia podpisu. Kazdy kolejny ma mowic to samo i wtedy ta liczba rosnie razem z nim.
check("podpis pod rysunkiem (rf-42 i rf-44) kieruje do wlacznika modulu, nie do 'grupy wyjscia'",
      "sprawdź grupę wyjścia" not in _f42 and "sprawdź grupę wyjścia" not in _f44
      and _f42.count("sprawdź włącznik modułu Kontroler w nagłówku karty") == 3
      and _f44.count("sprawdź włącznik modułu Kontroler w nagłówku karty") == 1)

print("\n--- poradnik nadazyl ---")
check("poradnik Kontrolera nie mowi juz o lustrze grupy Mapowanie",
      "jest lustrem grupy" not in _g and "Ta lista wychodzi razem z grupą" not in _g.split('id:"kontroler"')[1][:14000])
check("...i mowi, ze przyciski sluchaja modulu Kontroler", "przyciski pada słuchają modułu <b>Kontroler</b>" in _g
      and "Pad rusza się i przyciski wychodzą <b>tylko gdy włącznik w nagłówku modułu jest na Wł.</b>" in _g)
check("...z parami EN do nowych zdan",
      '"Pad rusza się i przyciski wychodzą":"The pad moves and the buttons go out"' in _g
      and "pad buttons answer to the" in _g and "The readiness line under the module header says what is blocking" in _g)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
