"""Panel z poprzedniego uruchomienia odswieza sie sam (2026-09-07).

Objaw po przebudowie EXE: "nie dziala drag n drop, oraz nie dziala przypiecie
z dropdown" - a w piaskownicy to samo dzialalo. Przyczyna: karta panelu otwarta PRZED restartem
programu dalej zyje (strumien laczy sie na nowo, liczby ida), ale kazdy zapis niesie STARY token
sesji i dostaje 403. Jedynym sladem byl dymek "Serwer nieosiagalny" - nieprawdziwy, bo serwer stal.

Sprawdzamy statycznie trzy ogniwa: serwer nazywa swoje uruchomienie i mowi to stronie (wstrzykniecie
+ pierwszy `cfg` strumienia), strona porownuje i przeladowuje sie (rf-08 -> rf-05), a 403 na
zapisie z tokenem konczy sie tym samym (rf-05). Bez znakow spoza ASCII w print() - konsola cp1250.
"""
import os
import re
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


_py = _read("ribbitflip_monitor.py")
_f05 = _read("web", "js", "rf-05-tooltip-state.js")
_f08 = _read("web", "js", "rf-08-sse-ui.js")

print("\n--- serwer nazywa swoje uruchomienie ---")
check("BOOT_ID istnieje i jest losowy per proces (nie jest tokenem sesji)",
      isinstance(rf.BOOT_ID, str) and re.fullmatch(r"[0-9a-f]{8}", rf.BOOT_ID) is not None
      and "BOOT_ID = secrets.token_hex(4)" in _py)
check("...wstrzykniety do panelu obok tokenu",
      'window.RIBBITFLIP_BOOT=\\"%s\\"' in _py and "json.dumps(load_hidden_tabs()), BOOT_ID," in _py)
check("...i wysylany w pierwszym `cfg` kazdego strumienia (strumien nie niesie tokenu)",
      '{"t": "cfg", "boot": BOOT_ID, **self.b.config}' in _py
      and "session_token" not in _py.split("def _serve_stream")[1].split("def ")[1])

print("\n--- strona porownuje i przeladowuje sie ---")
check("rf-08: `cfg` z obcym boot = przeladowanie, nie dalsza praca",
      'm.boot&&window.RIBBITFLIP_BOOT&&m.boot!==window.RIBBITFLIP_BOOT' in _f08
      and 'rfStaleReload("boot");return;' in _f08)
check("...ale strona bez wstrzyknietego boot (stary HTML) nic nie robi",
      "window.RIBBITFLIP_BOOT&&" in _f08)
check("rf-05: przeladowanie jest JEDNO (straznik) i opozniane, zeby dymek zdazyl sie pokazac",
      "function rfStaleReload(why)" in _f05 and "if(_rfStaleT)return;" in _f05
      and "setTimeout(function(){try{location.reload();}catch(e){}},700)" in _f05)
check("...po powrocie strona mowi jednym zdaniem, co sie stalo - i tylko raz",
      'sessionStorage.getItem("rf.staleReload")' in _f05
      and 'sessionStorage.removeItem("rf.staleReload")' in _f05
      and "Panel odświeżony po ponownym uruchomieniu RibbitFlipa" in _f05
      and "Panel reloaded after RibbitFlip restarted" in _f05)

print("\n--- 403 na zapisie z tokenem to ta sama wiadomosc, tylko spozniona ---")
check("rf-05: 403 na zadaniu, ktore nioslo token, wola rfStaleReload",
      'if(r&&r.status===403)rfStaleReload("403")' in _f05)
check("...tylko dla zapisow z tokenem, nie dla GET-ow",
      '_m!=="GET"&&_m!=="HEAD"&&window.RIBBITFLIP_TOKEN)\n      _p.then' in _f05
      or '_m!=="GET"&&_m!=="HEAD"&&window.RIBBITFLIP_TOKEN)\r\n      _p.then' in _f05)
check("...a wywolujacy dalej dostaje SWOJA odpowiedz (obserwacja na galezi, nie w torze)",
      "return _p;" in _f05 and ".catch(function(){});" in _f05)
check("rf-05 laduje sie przed rf-08 (rf-08 wola rfStaleReload z rf-05)",
      _read("web", "ribbitflip_dashboard.html").index("rf-05-tooltip-state.js")
      < _read("web", "ribbitflip_dashboard.html").index("rf-08-sse-ui.js"))

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
