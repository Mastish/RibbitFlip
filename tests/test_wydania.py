# TRZY WYDANIA: pełne, Lite i sama gra. Uruchom: py tests/test_wydania.py
#
# Z jednego repozytorium wychodzą trzy pliki (build_exe.bat [full|lite|beat|all]; bez parametru pełny i gra):
#   RibbitFlip.exe       cała aplikacja (RibbitFlip.spec),
#   RibbitFlip-Essential.exe (wewnętrznie edycja „lite”)  aplikacja bez sekcji „Wypróbuj”: bez zakładki Synth i bez gry (RibbitFlip.spec, RF_EDITION=lite),
#   RibbitBeat.exe       sama gra, pełny ekran (RibbitBeat.spec, punkt wejścia ribbitbeat_app.py).
# Bez PyInstallera: spec-y wykonujemy z podstawionymi Analysis/PYZ/EXE i collect_all, więc test widzi DOKŁADNIE te
# listy plików i nazwy, które dostałby PyInstaller. Serwer gry uruchamiamy naprawdę (podproces, wolny port, --no-open).
# Flaga edycji w aplikacji (edition.txt → <html data-edition="lite"> → rf-34 chowa „Wypróbuj”) sprawdzana jest
# tu na kodzie; na żywo przeklikano ją w piaskownicy.
import ast
import io
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import types
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_passed = _failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


def czytaj(rel):
    return io.open(os.path.join(ROOT, rel), encoding="utf-8").read()


APP_VERSION = re.search(r'^APP_VERSION\s*=\s*"([^"]+)"', czytaj("ribbitflip_monitor.py"), re.M).group(1)


# ---- spec-y wykonane z atrapami PyInstallera ---------------------------------------------------
def wykonaj_spec(nazwa, edycja=None):
    """Zwraca dict: datas, excludes, name, console, icon, version (tekst pliku), collect (wołane collect_all)."""
    zebrane = {"collect": []}

    def collect_all(pakiet):
        zebrane["collect"].append(pakiet)
        return [], [], []

    hooks = types.ModuleType("PyInstaller.utils.hooks")
    hooks.collect_all = collect_all
    pi, piu = types.ModuleType("PyInstaller"), types.ModuleType("PyInstaller.utils")
    stare = {k: sys.modules.get(k) for k in ("PyInstaller", "PyInstaller.utils", "PyInstaller.utils.hooks")}
    sys.modules.update({"PyInstaller": pi, "PyInstaller.utils": piu, "PyInstaller.utils.hooks": hooks})

    class Analysis:
        def __init__(self, scripts, **k):
            zebrane["scripts"] = scripts
            zebrane["datas"] = list(k.get("datas") or [])
            zebrane["excludes"] = list(k.get("excludes") or [])
            self.pure, self.scripts, self.binaries, self.datas = [], [], [], []

    def PYZ(*a, **k):
        return None

    def EXE(*a, **k):
        zebrane.update(name=k.get("name"), console=k.get("console"), icon=k.get("icon"))
        zebrane["version"] = io.open(os.path.join(ROOT, k["version"]), encoding="utf-8").read()

    stare_env, stary_cwd = os.environ.get("RF_EDITION"), os.getcwd()
    if edycja is None:
        os.environ.pop("RF_EDITION", None)
    else:
        os.environ["RF_EDITION"] = edycja
    os.chdir(ROOT)
    try:
        exec(compile(czytaj(nazwa), nazwa, "exec"),
             {"__name__": "__spec__", "Analysis": Analysis, "PYZ": PYZ, "EXE": EXE})
    finally:
        os.chdir(stary_cwd)
        if stare_env is None:
            os.environ.pop("RF_EDITION", None)
        else:
            os.environ["RF_EDITION"] = stare_env
        for k, v in stare.items():
            if v is None:
                sys.modules.pop(k, None)
            else:
                sys.modules[k] = v
    return zebrane


def cel(d):
    return str(d[1]).replace("\\", "/").strip("/")


def zrodlo(d):
    return str(d[0]).replace("\\", "/")


print("--- RibbitFlip.spec: pełny (bez RF_EDITION) ---")
pelny = wykonaj_spec("RibbitFlip.spec")
check("nazwa .exe: RibbitFlip", pelny.get("name") == "RibbitFlip", pelny.get("name"))
check("cały web/ jedną krotką, razem z grą", ("web", "web") in pelny["datas"])
check("manifesty pakietów w packs/", sum(1 for d in pelny["datas"] if cel(d) == "packs") == 3)
check("bez edition.txt (pełny = brak pliku)", not any(zrodlo(d).endswith("edition.txt") for d in pelny["datas"]))
check("BLE, klawiatura, pad i tray zebrane jak dotąd",
      all(p in pelny["collect"] for p in ("bleak", "pynput", "vgamepad", "pystray")), pelny["collect"])
check("VersionInfo: OriginalFilename RibbitFlip.exe, opis bez „Lite”",
      "'OriginalFilename', 'RibbitFlip.exe'" in pelny["version"] and "RibbitFlip Essential" not in pelny["version"])
check("RF_EDITION=full daje to samo co brak zmiennej",
      wykonaj_spec("RibbitFlip.spec", "full").get("name") == "RibbitFlip")

print("\n--- RibbitFlip.spec: Lite (RF_EDITION=lite) ---")
lite = wykonaj_spec("RibbitFlip.spec", "lite")
check("nazwa .exe: RibbitFlip-Essential", lite.get("name") == "RibbitFlip-Essential", lite.get("name"))
check("nie ma krotki całego web/", ("web", "web") not in lite["datas"])
WSPOLNY = "web/gry/js/probki-audio.js"   # jeden plik panelu i gry: zostaje w Essential (RibbitFlip.spec, 2026-10-21)
check("żaden plik spod web/gry/ poza wspólnym js/probki-audio.js",
      not any((cel(d) == "web/gry" or cel(d).startswith("web/gry/") or "/web/gry/" in "/" + zrodlo(d)) and zrodlo(d) != WSPOLNY
              for d in lite["datas"]),
      [d for d in lite["datas"] if "gry" in zrodlo(d) and zrodlo(d) != WSPOLNY][:3])
check("wspólny js/probki-audio.js JEST w Essential (panel ładuje go zawsze; Synth › Próbka i Studio gry dzielą obróbkę)",
      any(zrodlo(d) == WSPOLNY and cel(d) == "web/gry/js" for d in lite["datas"]),
      [d for d in lite["datas"] if "probki-audio" in zrodlo(d)])
check("żaden manifest pakietów", not any(cel(d) == "packs" or zrodlo(d).startswith("packs/") for d in lite["datas"]))
check("reszta panelu jest: powłoka, rf-34-tabs.js i obrazki",
      ("web/ribbitflip_dashboard.html", "web") in [(zrodlo(d), cel(d)) for d in lite["datas"]]
      and any(zrodlo(d) == "web/js/rf-34-tabs.js" and cel(d) == "web/js" for d in lite["datas"])
      and any(cel(d).startswith("web/assets") for d in lite["datas"]))
_ed = [d for d in lite["datas"] if zrodlo(d).endswith("edition.txt")]
check("edition.txt w korzeniu zasobów, z treścią „lite”",
      len(_ed) == 1 and cel(_ed[0]) in ("", ".")
      and io.open(os.path.join(ROOT, _ed[0][0]), encoding="utf-8").read().strip() == "lite", _ed)
check("VersionInfo: „RibbitFlip Essential” i OriginalFilename RibbitFlip-Essential.exe",
      "'FileDescription', 'RibbitFlip Essential" in lite["version"]
      and "'OriginalFilename', 'RibbitFlip-Essential.exe'" in lite["version"])
check("ten sam APP_VERSION", "'FileVersion', '%s'" % APP_VERSION in lite["version"])
try:
    wykonaj_spec("RibbitFlip.spec", "nieznana")
    check("nieznana edycja zatrzymuje build", False)
except SystemExit:
    check("nieznana edycja zatrzymuje build", True)

print("\n--- RibbitBeat.spec: sama gra ---")
beat = wykonaj_spec("RibbitBeat.spec")
check("punkt wejścia ribbitbeat_app.py", beat.get("scripts") == ["ribbitbeat_app.py"], beat.get("scripts"))
check("nazwa .exe: RibbitBeat, bez konsoli", beat.get("name") == "RibbitBeat" and beat.get("console") is False)
check("bez collect_all (żadnego bleak/pynput/vgamepad/pystray)", beat["collect"] == [], beat["collect"])
check("bleak, pynput, vgamepad, pystray wykluczone wprost",
      all(p in beat["excludes"] for p in ("bleak", "pynput", "vgamepad", "pystray")), beat["excludes"])
_bd = [(zrodlo(d), cel(d)) for d in beat["datas"]]
check("gra, jej zasoby, manifesty, licencje i LICENSE",
      ("web/gry", "web/gry") in _bd and ("web/assets", "web/assets") in _bd
      and sum(1 for z, c in _bd if c == "packs") == 3
      and ("third_party_licenses", "third_party_licenses") in _bd and ("LICENSE", "") in [(z, c.strip(".")) for z, c in _bd],
      _bd)
check("bez panelu aplikacji (nie ma całego web/)", ("web", "web") not in _bd)
check("ikona istnieje", beat.get("icon") and os.path.isfile(os.path.join(ROOT, beat["icon"])), beat.get("icon"))
check("VersionInfo: ProductName RibbitBeat, ten sam APP_VERSION",
      "'ProductName', 'RibbitBeat'" in beat["version"] and "'ProductVersion', '%s'" % APP_VERSION in beat["version"])
_uzywa = set(re.findall(r"\.\./assets/([a-z]+)/", "".join(
    czytaj(os.path.join("web", "gry", f)) for f in ("index.html", "gry.css"))
    + "".join(czytaj(os.path.join("web", "gry", "js", f)) for f in os.listdir(os.path.join(ROOT, "web", "gry", "js"))
              if f.endswith(".js"))))
check("każdy katalog ../assets/<x>/, którego gra używa, istnieje w web/assets",
      _uzywa and all(os.path.isdir(os.path.join(ROOT, "web", "assets", x)) for x in _uzywa), sorted(_uzywa))

print("\n--- ribbitbeat_app.py: kompilacja i serwer ---")
r = subprocess.run([sys.executable, "-m", "py_compile", os.path.join(ROOT, "ribbitbeat_app.py")],
                   capture_output=True, text=True)
check("py_compile ribbitbeat_app.py", r.returncode == 0, r.stderr)
src_beat = czytaj("ribbitbeat_app.py")
check("nie importuje ribbitflip_monitor (cała aplikacja)", not re.search(r"^\s*(import|from)\s+ribbitflip_monitor", src_beat, re.M))
check("słucha wyłącznie na 127.0.0.1", '("127.0.0.1", port)' in src_beat and "0.0.0.0" not in src_beat)
check("okno: Edge, potem Chrome, --app i pełny ekran z własnym profilem",
      src_beat.find("msedge.exe") < src_beat.find("chrome.exe") and "--start-fullscreen" in src_beat
      and "--user-data-dir=" in src_beat and "App Paths" in src_beat)
check("jedna instancja przez CreateMutexW", "CreateMutexW" in src_beat)


def wolny_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def http(port, sciezka, metoda="GET", dane=None, naglowki=None, czytaj_ile=None):
    req = urllib.request.Request("http://127.0.0.1:%d%s" % (port, sciezka), data=dane, method=metoda,
                                 headers=naglowki or {})

    class BezPrzekierowan(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None

    otw = urllib.request.build_opener(BezPrzekierowan)
    try:
        with otw.open(req, timeout=5) as o:
            return o.status, dict((k.lower(), v) for k, v in o.headers.items()), o.read(czytaj_ile) if czytaj_ile else o.read()
    except urllib.error.HTTPError as e:
        return e.code, dict((k.lower(), v) for k, v in e.headers.items()), e.read()


r = subprocess.run([sys.executable, os.path.join(ROOT, "ribbitbeat_app.py"), "--no-open", "--port", "8770"],
                   capture_output=True, text=True, timeout=20)
check("port 8770 (działająca aplikacja) odrzucony", r.returncode != 0 and "8770" in (r.stderr + r.stdout))

port, pusty = wolny_port(), wolny_port()   # `pusty`: port, na którym NIE ma aplikacji RibbitFlip
pakiety = tempfile.mkdtemp(prefix="rf-wydania-pakiety-")
proc = subprocess.Popen([sys.executable, os.path.join(ROOT, "ribbitbeat_app.py"), "--no-open", "--port", str(port),
                         "--app", str(pusty)],
                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                        env=dict(os.environ, RIBBITFLIP_SONGPACKS_DIR=pakiety))
try:
    gotowy = False
    for _ in range(100):
        time.sleep(0.1)
        if proc.poll() is not None:
            break
        try:
            gotowy = http(port, "/gry/")[0] == 200
            if gotowy:
                break
        except Exception:
            pass
    check("serwer gry wstaje na wolnym porcie z --no-open", gotowy)
    if gotowy:
        st, ng, body = http(port, "/gry/")
        check("/gry/: 200, HTML gry", st == 200 and ng.get("content-type", "").startswith("text/html")
              and b"RibbitBeat" in body)
        check("/gry/: CSP z connect-src 'self' i nosniff",
              "connect-src 'self'" in ng.get("content-security-policy", "") and ng.get("x-content-type-options") == "nosniff")
        st, ng, _ = http(port, "/gry/js/zabi-chor.js")
        check("/gry/js/zabi-chor.js: 200 jako JavaScript", st == 200 and "javascript" in ng.get("content-type", ""))
        st, ng, _ = http(port, "/assets/frog/sing-0-96.png")
        check("/assets/frog/sing-0-96.png: 200 (względne ../assets/ gry)", st == 200 and ng.get("content-type") == "image/png")
        check("/web/gry/nie-ma.js: 404", http(port, "/web/gry/nie-ma.js")[0] == 404)
        check("/web/ribbitflip_dashboard.html: 404 (panelu tu nie ma)", http(port, "/web/ribbitflip_dashboard.html")[0] == 404)
        check("/js/ (poza gry/ i assets/): 404", http(port, "/js/rf-34-tabs.js")[0] == 404)
        check("katalog bez index.html nie wystawia spisu plików", http(port, "/gry/js/")[0] == 404)
        st, ng, body = http(port, "/gry/api/pakiety")
        try:
            j = json.loads(body.decode("utf-8"))
        except Exception:
            j = {}
        check("/gry/api/pakiety: 200 JSON z trzema pakietami z manifestów",
              st == 200 and "json" in ng.get("content-type", "") and j.get("ok") is True and len(j.get("pakiety") or []) == 3,
              (st, str(j)[:120]))
        check("katalog pakietów: ten, który podała aplikacja (zmienna środowiska w teście)",
              os.path.normcase(os.path.normpath(j.get("katalog", ""))) == os.path.normcase(os.path.normpath(pakiety)))
        st, _, body = http(port, "/gry/api/nie-ma-takiej")
        check("nieznana trasa /gry/api/: 404 JSON", st == 404 and b'"ok": false' in body)
        st, ng, _ = http(port, "/")
        check("/ przekierowuje do gry z kapslami (?zywe=1)", st == 302 and ng.get("location") == "/gry/?zywe=1")
        check("obcy Host: 403 (DNS rebinding)", http(port, "/gry/", naglowki={"Host": "zly.example"})[0] == 403)
        check("POST z obcej strony (Origin): 403",
              http(port, "/gry/api/pakiety/usun", "POST", b"{}", {"Origin": "http://zly.example",
                                                                  "Content-Type": "application/json"})[0] == 403)
        st, _, body = http(port, "/gry/api/pakiety/usun", "POST", b'{"pack":"cc0_classics"}',
                           {"Origin": "http://127.0.0.1:%d" % port, "Content-Type": "application/json"})
        check("POST ze strony gry: przechodzi do trasy (200)", st == 200, (st, body[:80]))
        st, ng, body = http(port, "/stream", czytaj_ile=12)
        check("/stream bez aplikacji: 200 text/event-stream z komentarzem, nie błąd (EventSource zostaje otwarty)",
              st == 200 and ng.get("content-type", "").startswith("text/event-stream") and body.startswith(b": RibbitBeat"),
              (st, ng.get("content-type"), body))
finally:
    proc.kill()
    proc.wait(timeout=10)

print("\n--- ribbitflip_monitor.py: flaga edycji ---")
src_mon = czytaj("ribbitflip_monitor.py")
_fn = next((n for n in ast.parse(src_mon).body if isinstance(n, ast.FunctionDef) and n.name == "_edition"), None)
check("jest funkcja _edition()", _fn is not None)
if _fn is not None:
    kat = tempfile.mkdtemp(prefix="rf-wydania-edycja-")
    ns = {"os": os, "_resource_dir": lambda: kat}
    exec(compile(ast.Module(body=[_fn], type_ignores=[]), "_edition", "exec"), ns)
    stare_env = os.environ.pop("RIBBITFLIP_EDITION", None)
    try:
        check("brak edition.txt = full", ns["_edition"]() == "full")
        io.open(os.path.join(kat, "edition.txt"), "w", encoding="utf-8").write("lite\n")
        check("edition.txt z „lite” = lite", ns["_edition"]() == "lite")
        io.open(os.path.join(kat, "edition.txt"), "w", encoding="utf-8").write("cokolwiek")
        check("inna treść = full", ns["_edition"]() == "full")
        os.environ["RIBBITFLIP_EDITION"] = "lite"
        check("RIBBITFLIP_EDITION=lite nadpisuje plik (prace ze źródeł)", ns["_edition"]() == "lite")
    finally:
        os.environ.pop("RIBBITFLIP_EDITION", None)
        if stare_env is not None:
            os.environ["RIBBITFLIP_EDITION"] = stare_env
check("edycja czytana z _resource_dir()/edition.txt", 'os.path.join(_resource_dir(), "edition.txt")' in src_mon)
check("_serve_html: Lite dopisuje data-edition do <html>",
      re.search(r'if EDITION == "lite":\s*\r?\n\s*body = body\.replace\(b"<html", b\'<html data-edition="lite"\', 1\)', src_mon))
check("Lite: /web/gry/… odpowiada 404 przed trasami gry, poza wspólnym js/probki-audio.js (SHARED_GAME_FILE)",
      re.search(r'elif EDITION == "lite" and re\.match\(r"/web/\+gry\(\?:/\|\$\)", path\) \\\r?\n'
                r'\s*and not re\.fullmatch\(r"/web/\+gry" \+ SHARED_GAME_FILE, path\):(?:\s*#[^\r\n]*)*\s*self\.send_error\(404',
                src_mon) and src_mon.find('EDITION == "lite" and re.match') < src_mon.find('elif path == "/web/gry":'))
check("SHARED_GAME_FILE wskazuje js/probki-audio.js i siedzi w trasie „gra” jako wyjątek (ten sam wzorzec idzie do przeglądarki)",
      re.search(r'^SHARED_GAME_FILE = r"/\+js/\+probki-audio\[\.\]js"', src_mon, re.M)
      and 're.compile(r"/web/+gry(?!" + SHARED_GAME_FILE + r"$)(?:/.*)?|/gry/api/.*"), ("gra",)' in src_mon)
_gry_api = src_mon[src_mon.find("def _gry_api("):]
check("Lite: /gry/api/ (GET i POST) odpowiada 404",
      re.search(r'def _gry_api\(self, metoda, data\):\s*\r?\n\s*"""[^"]*"""\s*\r?\n\s*if EDITION == "lite":\s*\r?\n\s*return self\.send_error\(404',
                _gry_api[:600]))

print("\n--- rf-34-tabs.js: Lite chowa „Wypróbuj” ---")
src_tabs = czytaj(os.path.join("web", "js", "rf-34-tabs.js"))
_tabs_end = src_tabs.find("const btns={};")
_filtr = src_tabs.find('if(RF_LITE)for(let i=TABS.length-1;i>=0;i--)if(TABS[i].grp==="play")TABS.splice(i,1);')
check("flaga z <html data-edition>", 'const RF_LITE=document.documentElement.dataset.edition==="lite";' in src_tabs)
check("pozycje grp:\"play\" wypadają z TABS, zanim powstaną przyciski", 0 < _filtr < _tabs_end, (_filtr, _tabs_end))
_gra = src_tabs.find('a.id="rfNavGra"')
_straz = src_tabs.rfind("if(RF_LITE){", 0, _gra)
check("link #rfNavGra nie powstaje w Lite (wcześniejszy return)",
      _straz > 0 and "return;" in src_tabs[_straz:_gra] and src_tabs.find("})();", _straz) > _gra)
check("pusta karta #rfPlayCard chowana", 'getElementById("rfPlayCard")' in src_tabs[_straz:_gra]
      and "pc.hidden=true" in src_tabs[_straz:_gra])

print("\n--- build_exe.bat i baner ---")
bat = czytaj("build_exe.bat")
check("parametry: nic/full, lite, beat, all", all(w in bat for w in ("(full lite beat all)", ":build", "call :build full",
                                                                      "call :build lite", "call :build beat")))
# gra buduje się też jako exe: dwuklik = pełny RibbitFlip.exe i RibbitBeat.exe, „full” = sam pełny
_dom = bat[bat.find('else if /I "%_WHAT%"=="default" ('):]
_dom = _dom[:_dom.find(") else (")]
check("dwuklik (bez parametru) buduje RibbitFlip.exe, potem RibbitBeat.exe",
      'if "%_WHAT%"=="" set "_WHAT=default"' in bat and "call :build full" in _dom and "call :build beat" in _dom
      and _dom.find("call :build full") < _dom.find("call :build beat") and "call :build lite" not in _dom)
check("Lite: RF_EDITION=lite; pełny jawnie full", 'set "RF_EDITION=lite"' in bat and 'set "RF_EDITION=full"' in bat)
check("RibbitBeat buduje się z RibbitBeat.spec", 'set "_SPEC=RibbitBeat.spec"' in bat)
check("blokada pliku sprawdzana dla budowanego .exe", '"IMAGENAME eq %_EXE%"' in bat and '/C:"%_EXE%"' in bat)
check("baner dostaje ścieżkę .exe (--exe)", bat.count('--exe "dist\\%_EXE%"') == 3, bat.count('--exe "dist\\%_EXE%"'))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import build_banner  # noqa: E402

_stary = build_banner.EXE
try:
    build_banner.EXE = os.path.join(ROOT, "dist", "RibbitBeat.exe")
    fakty = " ".join(t for t, _ in build_banner.summary("ok", None))
    check("podsumowanie mówi o RibbitBeat.exe, nie o RibbitFlip.exe",
          os.path.join("dist", "RibbitBeat.exe") in fakty and "RibbitFlip.exe" not in fakty, fakty)
    check("i nazywa produkt RibbitBeat", ("RibbitBeat " + APP_VERSION) in fakty, fakty)
finally:
    build_banner.EXE = _stary

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
