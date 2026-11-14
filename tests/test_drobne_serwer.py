"""DROBNE POPRAWKI SERWERA PRZED 1.0.0 (2026-11-18). Uruchom: py tests/test_drobne_serwer.py

Regresje z przegladu serwera (druga runda, po A1-A7 z tests/test_wyjscia_bezpieczne.py):

  A10 prawy Alt (AltGr) wstrzykniety przez program albo z zagubionym puszczeniem nie wycisza
      skrotu awaryjnego; prawdziwie trzymany AltGr dalej go blokuje,
  A11 /rest/send i /obs/send odmawiaja przy wylaczonym module Uslugi albo rozbrojonym przycisku
      wlacznika; /test-key z okna skanera odmawia przy wylaczonym Skanerze; zwykly Test dalej
      dziala przy wylaczonej grupie Mapowanie (bez uzbrojenia to sam podglad),
  A13 paczka zgloszenia: krotkie sekrety w adresach, dane logowania w adresie, pary
      nazwa=wartosc i tekst wpisywany przez makra sa ukryte,
  A9  menu zasobnika ma pozycje Stop awaryjny wolajaca panic_stop(source="tray"),
  L   zatrzask (latch) wraca na wylaczony, gdy kapsel milknie, a regula na nim stojaca puszcza
      klawisz; po powrocie danych przelacza dopiero nowe zbocze,
  W5  auto-zestaw wg gry: kapsel aktywny w panelu (POST /ui-active), kopia przed wczytaniem,
      nazwa kopii i sekcja pad w odpowiedzi i w zdarzeniu `game`.

Czesc E2E uruchamia kopie testowa na porcie 8793 (--simulate --no-keys --no-tray --no-open
--allow-multi) w katalogu tymczasowym i zamyka ja po PID. Port 8770 nie jest ruszany.
Bez znakow spoza ASCII w print() - konsola cp1250.
"""
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _ROOT)
import ribbitflip_monitor as rf   # noqa: E402

PORT = 8793
_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        d = ("  -> " + str(detail)) if detail else ""
        print(("FAIL  %s%s" % (name, d)).encode("ascii", "replace").decode("ascii"))


# =============================================================== A10: AltGr
print("--- A10: AltGr a skrot awaryjny ---")
WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP = 0x0100, 0x0101, 0x0104, 0x0105
VK = {"alt_l": 0xA4, "alt_gr": 0xA5, "ctrl_l": 0xA2, "r": 0x52, "f": 0x46, "l": 0x4C}


class _Data:
    def __init__(self, vk, flags=0):
        self.vkCode = vk
        self.flags = flags


class _FakeListener:
    class Suppress(Exception):
        pass

    def suppress_event(self):
        raise self.Suppress()


def hk_make(combo="alt+r+f"):
    fired = []
    hk = rf.PanicHotkey(lambda c: fired.append(c))
    hk._listener = _FakeListener()
    hk._suppress_exc = _FakeListener.Suppress
    toks = rf.hotkey_tokens(combo)
    hk._combo = combo
    hk._mod_sets = tuple(rf._HK_MOD_VKS[t] for t in toks if rf._hk_is_mod(t))
    hk._keys = frozenset(rf._hk_vk(t) for t in toks if not rf._hk_is_mod(t))
    hk._enabled = True
    hk._dispatch = lambda c: fired.append(c)
    return hk, fired


def feed(hk, msg, name, flags=0):
    try:
        hk._filter(msg, _Data(VK[name], flags))
    except _FakeListener.Suppress:
        pass


def combo(hk):
    feed(hk, WM_SYSKEYDOWN, "alt_l")
    feed(hk, WM_SYSKEYDOWN, "r")
    feed(hk, WM_SYSKEYDOWN, "f")
    for k in ("f", "r", "alt_l"):
        feed(hk, WM_SYSKEYUP, k)


hk, fired = hk_make()
feed(hk, WM_SYSKEYDOWN, "alt_gr", flags=0x10)          # regula trzyma alt_gr (wstrzykniete)
combo(hk)
check("A10 wstrzykniety AltGr nie wycisza skrotu", fired == ["alt+r+f"], fired)

hk, fired = hk_make()
feed(hk, WM_SYSKEYDOWN, "alt_gr")                        # fizyczny AltGr, puszczenie zginelo
hk._altgr_ts = time.monotonic() - (hk._ALTGR_STALE_S + 0.5)
combo(hk)
check("A10 AltGr bez puszczenia wygasa po kilku sekundach", fired == ["alt+r+f"], fired)
check("A10 ...choc 0xA5 dalej jest w _down (stan haka sie nie psuje)", VK["alt_gr"] in hk._down)

hk, fired = hk_make()
feed(hk, WM_SYSKEYDOWN, "alt_gr")                        # prawdziwie trzymany: dalej blokuje
combo(hk)
check("A10 swiezy fizyczny AltGr dalej blokuje (polskie litery)", fired == [], fired)
feed(hk, WM_SYSKEYUP, "alt_gr", flags=0x10)              # puszczenie, nawet wstrzykniete, zwalnia
combo(hk)
check("A10 puszczenie AltGr przywraca skrot", fired == ["alt+r+f"], fired)

hk, fired = hk_make()
feed(hk, WM_KEYDOWN, "ctrl_l")
feed(hk, WM_SYSKEYDOWN, "alt_gr")
feed(hk, WM_KEYDOWN, "l")
check("A10 pisanie litery l z kreska niczego nie odpala", fired == [], fired)

# =============================================================== A11: bramka (jednostkowo)
print("\n--- A11: bramka wyjsc ---")
for k in ("rest_off", "disarmed", "scan_off"):
    pl, en = rf.output_gate_message(k)
    check("A11 komunikat %s ma PL i EN" % k, bool(pl) and bool(en) and pl != en and "—" not in pl)
_tmp = tempfile.mkdtemp(prefix="rf_drobne_")
_old_rest = rf.REST_CONFIG_FILE
try:
    rf.REST_CONFIG_FILE = os.path.join(_tmp, "rest.json")

    class _Dm:
        master_armed = True
    dm = _Dm()
    check("A11 brak pliku uslug = modul wylaczony", rf.rest_send_gate(dm) == "rest_off")
    rf.save_rest_config({"enabled": True})
    check("A11 modul wlaczony i uzbrojone = wolno", rf.rest_send_gate(dm) is None)
    dm.master_armed = False
    check("A11 rozbrojony wlacznik = odmowa", rf.rest_send_gate(dm) == "disarmed")
    rf.save_rest_config({"enabled": False})
    dm.master_armed = True
    check("A11 modul wylaczony = odmowa", rf.rest_send_gate(dm) == "rest_off")
finally:
    rf.REST_CONFIG_FILE = _old_rest
    shutil.rmtree(_tmp, ignore_errors=True)

# =============================================================== A13: redakcja paczki
print("\n--- A13: redakcja paczki zgloszenia ---")
R = rf._diag_redact
L = rf._diag_scrub_log
check("A13 krotki klucz w zapytaniu adresu", "abc123" not in R("https://api.example.com/v1?key=abc123&dev=d1"))
check("A13 ...a zwykly parametr zostaje", "dev=d1" in R("https://api.example.com/v1?key=abc123&dev=d1"))
check("A13 access_token w adresie w dzienniku", "qq1" not in L("[rest] https://h.example/?access_token=qq1 ok"))
check("A13 dane logowania w adresie", "tajne" not in R("https://jan:tajne@host.example/p")
      and "jan" not in L("wyslano https://jan:tajne@host.example/p"))
check("A13 haslo w tresci formularza", "hunter2" not in R("password=hunter2&user=jan")
      and "user=jan" in R("password=hunter2&user=jan"))
check("A13 token w JSON wpisanym jako tekst", "s3cr" not in R('{"token": "s3cr"}'))
check("A13 para naglowka po nazwie (apiKey)", R(["apiKey", "zz"])[1] != "zz")
check("A13 keySpec i nazwy klawiszy zostaja", R("keySpec=ctrl+c") == "keySpec=ctrl+c")
check("A13 adres lokalny bez sekretow bez zmian",
      L("http://127.0.0.1:8770/x?dev=d1") == "http://127.0.0.1:8770/x?dev=d1")
once = L("https://h.example/?key=abc")
check("A13 drugie przejscie niczego nie psuje", L(once) == once, once)
m = rf._diag_mask_macro("h; a; s; l; o; enter; wait 100; ctrl+c; shift+X; down w; up w\n1;2")
check("A13 makro: pojedyncze znaki ukryte",
      not re.search(r"(^|[;\s])[hasloXw12]($|[;\s])", m), m)
check("A13 makro: budowa zostaje (enter, wait, ctrl+c, down/up)",
      all(t in m for t in ("enter", "wait 100", "ctrl+c", "shift+", "down ", "up ")), m)
_tmp = tempfile.mkdtemp(prefix="rf_drobne_diag_")
try:
    p = os.path.join(_tmp, "ribbitflip_rules.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump({"enabled": True, "rules": [{"id": "r1", "keySpec": "w", "sequence": "1; 2; 3; 4; enter"}]}, f)
    out = json.loads(rf._diag_slot_bytes(p).decode("utf-8"))
    check("A13 plik regul: makro z PIN-em ukryte", "1" not in out["rules"][0]["sequence"].replace("•", ""),
          out["rules"][0]["sequence"])
    check("A13 plik regul: reszta bez zmian", out["rules"][0]["keySpec"] == "w" and out["enabled"] is True)
    with open(p, "w", encoding="utf-8") as f:
        f.write('{"rules": [{"sequence": "t; a; j; n; e"}  zepsute')
    raw = rf._diag_slot_bytes(p).decode("utf-8")
    check("A13 zepsuty plik regul: makro wyciete po ksztalcie", "t; a; j" not in raw, raw)
finally:
    shutil.rmtree(_tmp, ignore_errors=True)
src = open(rf.__file__, encoding="utf-8").read()
check("A13 pliki kapsli w paczce ida przez _diag_slot_bytes",
      src.count("_diag_slot_bytes(p)") == 2 and '("Settings/" + name, _diag_bytes(p))' not in src)

# =============================================================== A9: zasobnik
print("\n--- A9: Stop awaryjny w zasobniku ---")
tray = src[src.index("def _start_tray_thread"):src.index("# ---- One RibbitFlip at a time")]
check("A9 menu zasobnika ma pozycje Stop awaryjny (PL i EN)",
      '"Stop awaryjny' in tray and '"Emergency stop' in tray)
check("A9 pozycja wola panic_stop z source=tray na osobnym watku",
      'panic_stop(dm, bc, source="tray")' in tray and "threading.Thread(target=lambda: panic_stop" in tray)

# =============================================================== L: zatrzask po rozlaczeniu
print("\n--- L: zatrzask po rozlaczeniu kapsla ---")


class Bus:
    def __init__(self):
        self.ev = []

    def now(self):
        return time.time()

    def publish(self, e):
        self.ev.append(e)


class Emit:
    def __init__(self):
        self.taps, self.downs, self.ups = [], [], []

    def tap(self, s):
        self.taps.append(s)

    def down(self, s):
        self.downs.append(s)

    def up(self, s):
        self.ups.append(s)


em = Emit()
t = rf.TriggerEngine(Bus(), emitter=em, armed=True)
t.set_rules(rf.sanitize_rules([
    {"id": "mode", "source": {"kind": "button", "any": True}, "behavior": "latch", "keySpec": "f13"},
    {"id": "jedz", "source": {"kind": "trigger", "ref": "mode"}, "behavior": "hold", "keySpec": "w"},
]))
t.on_pose({"tilt": 0.0, "twist": 0.0, "pitch": 0.0, "roll": 0.0})
t.on_status(bytes([0x21, 0x01, 0, 0, 0]))
t.tick()
t.tick()
check("L zatrzask wlaczony gestem", t._rt["mode"]["over"] is True and t._rt["mode"].get("latched") is True)
check("L regula na zatrzasku trzyma W", em.downs == ["w"], em.downs)
t.on_status(bytes([0x21, 0x00, 0, 0, 0]))
time.sleep(0.3)
t.tick()
check("L z zywym kapslem zatrzask trwa", t._rt["mode"]["over"] is True)
taps_before = list(em.taps)
time.sleep(rf.TriggerEngine.DATA_FRESH_S + 0.15)          # kapsel milknie
t.tick()
t.tick()
check("L bez swiezych danych zatrzask sie zwalnia", t._rt["mode"]["over"] is False
      and not t._rt["mode"].get("latched"))
check("L ...i W zostaje puszczone", em.ups == ["w"], em.ups)
check("L ...bez stukniecia klawisza zatrzasku", em.taps == taps_before, em.taps)
t.on_status(bytes([0x21, 0x01, 0, 0, 0]))              # wraca z wcisnietym przyciskiem
t.tick()
check("L po powrocie danych warunek juz spelniony nie przelacza", t._rt["mode"]["over"] is False)
t.on_status(bytes([0x21, 0x00, 0, 0, 0]))
time.sleep(0.3)
t.tick()
t.on_status(bytes([0x21, 0x01, 0, 0, 0]))
t.tick()
check("L nowe zbocze znowu wlacza", t._rt["mode"]["over"] is True)

# =============================================================== W5: zdarzenie `game`
print("\n--- W5: zdarzenie game ---")
pub = []
gs = rf.GameSwitcher(foreground=lambda: "gra.exe",
                     matches=lambda exe: [{"kind": "setup", "name": "Gra"}],
                     config=lambda: {"enabled": True, "defaults": {}},
                     apply_fn=lambda k, n: {"ok": True, "kind": "setup", "name": n, "dev": "d1",
                                            "devName": "Lewy", "devVia": "panel",
                                            "backup": {"name": "Przed auto-zestawem (Lewy)",
                                                       "kind": "setup", "dev": "d1"},
                                            "pad": {"pads": [1]}},
                     publish=pub.append, stable=1, cooldown=0)
gs.tick()
gs.tick()                                  # pierwszy odczyt tylko zapamietuje okno
ev = pub[-1] if pub else {}
check("W5 zdarzenie game niesie kapsel, kopie i pad",
      ev.get("t") == "game" and ev.get("dev") == "d1"
      and ev.get("backup") == {"name": "Przed auto-zestawem (Lewy)", "kind": "setup", "dev": "d1"}
      and ev.get("pad") == {"pads": [1]} and (ev.get("applied") or {}).get("backup") == ev.get("backup"), ev)


# =============================================================== E2E
def http(path, payload=None, headers=None):
    url = "http://127.0.0.1:%d%s" % (PORT, path)
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    hdr = {"Content-Type": "application/json"}
    hdr.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=hdr, method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read()
            st = r.status
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    try:
        return st, json.loads(body.decode("utf-8"))
    except Exception:
        return st, body.decode("utf-8", "replace")


print("\n--- E2E (port %d) ---" % PORT)
sandbox = tempfile.mkdtemp(prefix="rf_drobne_e2e_")
proc = None
try:
    s = socket.socket()
    taken = s.connect_ex(("127.0.0.1", PORT)) == 0
    s.close()
    if taken:
        raise AssertionError("port %d zajety" % PORT)
    for f in ("ribbitflip_monitor.py", "ribbitflip_mcp.py", "ribbitflip_audio.py", "ribbitflip_gesture.py",
              "ribbitflip_songpacks.py", "ribbitflip_piosenki.py", os.path.join("web", "ribbitflip_dashboard.html")):
        dst = os.path.join(sandbox, f)
        os.makedirs(os.path.dirname(dst) or sandbox, exist_ok=True)
        shutil.copy2(os.path.join(_ROOT, f), dst)
    proc = subprocess.Popen([sys.executable, os.path.join(sandbox, "ribbitflip_monitor.py"), "--simulate",
                             "--no-keys", "--no-open", "--no-midi", "--no-tray", "--allow-multi",
                             "--devices", "2", "--port", str(PORT)],
                            cwd=sandbox, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ok = False
    for _ in range(150):
        time.sleep(0.1)
        try:
            st, b = http("/health")
            if st == 200 and isinstance(b, dict) and b.get("ok"):
                ok = True
                break
        except Exception:
            pass
    check("E2E kopia testowa wstala", ok)
    st, html = http("/")
    mt = re.search(r'RIBBITFLIP_TOKEN="([^"]+)"', html if isinstance(html, str) else "")
    A = {"X-RibbitFlip-Token": mt.group(1) if mt else ""}

    # --- A11 /rest/send, /obs/send
    req = {"url": "http://127.0.0.1:1/", "method": "GET", "timeoutMs": 500}
    st, b = http("/rest/send", req, A)
    check("A11 /rest/send przy wylaczonych Uslugach odmawia", isinstance(b, dict) and b.get("ok") is False
          and b.get("gate") == "rest_off" and b.get("errorEn"), b)
    st, b = http("/obs/send", {"requestType": "GetVersion"}, A)
    check("A11 /obs/send przy wylaczonych Uslugach odmawia", isinstance(b, dict) and b.get("gate") == "rest_off", b)
    http("/rest/config", {"config": {"enabled": True}}, A)
    st, b = http("/rest/send", req, A)
    check("A11 po wlaczeniu Uslug bramka przepuszcza (blad sieci, nie bramki)",
          isinstance(b, dict) and not b.get("gate"), b)
    http("/arm", {"armed": False}, A)
    st, b = http("/rest/send", req, A)
    check("A11 rozbrojony wlacznik = odmowa /rest/send", isinstance(b, dict) and b.get("gate") == "disarmed", b)
    http("/arm", {"armed": True}, A)
    st, b = http("/panic", {"source": "test"}, A)
    st, b = http("/rest/send", req, A)
    check("A11 po stopie awaryjnym /rest/send odmawia", isinstance(b, dict) and b.get("gate") == "rest_off", b)

    # --- A11 /test-key
    st, b = http("/test-key?dev=d0", {"keySpec": "f24"}, A)
    check("A11 zwykly Test przy wylaczonym Mapowaniu nie jest odrzucany", isinstance(b, dict) and b.get("ok") is True, b)
    ref = {"Referer": "http://127.0.0.1:%d/skaner-nakladka?dev=d0&mark=x" % PORT}
    ref.update(A)
    st, b = http("/test-key?dev=d0", {"keySpec": "mouse:left@50%,50%"}, ref)
    check("A11 klik okna skanera przy wylaczonym Skanerze odmawia",
          isinstance(b, dict) and b.get("ok") is False and b.get("gate") == "scan_off", b)
    st, b = http("/test-key?dev=d0", {"sequence": "mouse:left@50%,50%; wait 10"}, ref)
    check("A11 makro okna skanera tez odmawia", isinstance(b, dict) and b.get("gate") == "scan_off", b)

    # --- W5 /ui-active + /gameswitch/apply
    st, b = http("/ui-active", {"dev": "d1"}, A)
    check("W5 /ui-active zapamietuje kapsel", isinstance(b, dict) and b.get("dev") == "d1", b)
    st, b = http("/setup/save?dev=d1", {"name": "Gra testowa", "exe": ["gra-testowa.exe"],
                                         "pad": {"probny": 1}}, A)
    check("W5 zestaw zapisany", isinstance(b, dict) and b.get("ok"), b)
    st, b = http("/gameswitch/apply", {"kind": "setup", "name": "Gra testowa"}, A)
    check("W5 zestaw trafia na kapsel aktywny w panelu", isinstance(b, dict) and b.get("dev") == "d1"
          and b.get("devVia") == "panel", b)
    bo = (b.get("backup") if isinstance(b, dict) else None) or {}
    bk = bo.get("name") if isinstance(bo, dict) else None
    check("W5 odpowiedz niesie kopie jako {name, kind, dev}", bool(bk) and bk.startswith("Przed auto-zestawem")
          and bo.get("kind") == "setup" and bo.get("dev") == "d1", b)
    check("W5 odpowiedz niesie sekcje pad", isinstance(b, dict) and b.get("pad") == {"probny": 1}, b)
    st, lst = http("/setups")
    names = (lst or {}).get("setups", []) if isinstance(lst, dict) else []
    check("W5 kopia jest w Bibliotece", bk in names, names)
    bfile = os.path.join(sandbox, "Library", "Setups", (bk or "x") + ".json")
    benv = json.load(open(bfile, encoding="utf-8")) if os.path.isfile(bfile) else {}
    check("W5 kopia ma znacznik autoBackup i nie zglasza sie do gry",
          benv.get("autoBackup") is True and not benv.get("exe") and benv.get("backupOf") == "d1", benv)
    n0 = len(names)
    st, b2 = http("/gameswitch/apply", {"kind": "setup", "name": "Gra testowa"}, A)
    st, lst = http("/setups")
    check("W5 ponowne wczytanie tego samego zestawu nie robi nowej kopii",
          isinstance(b2, dict) and (b2.get("backup") or {}).get("name") == bk
          and len(lst.get("setups", [])) == n0, (b2, lst))
    http("/ui-active", {"dev": "nie-ma"}, A)
    st, b3 = http("/gameswitch/apply", {"kind": "setup", "name": "Gra testowa"}, A)
    check("W5 bez znanego kapsla aktywnego zestaw idzie na pierwszy", isinstance(b3, dict)
          and b3.get("dev") == "d0" and b3.get("devVia") == "first", b3)
    b3o = (b3.get("backup") if isinstance(b3, dict) else None) or {}
    check("W5 kopia pierwszego kapsla ma wlasna nazwe i dev d0", b3o.get("name") and b3o.get("name") != bk
          and b3o.get("dev") == "d0", b3)
    st, bl = http("/setup/load?dev=d1", {"name": bk}, A)
    check("W5 Cofnij: kopia wczytuje sie przez /setup/load?dev=", isinstance(bl, dict) and bl.get("ok"), bl)
except AssertionError as e:
    check("E2E przebieg", False, e)
finally:
    if proc is not None:
        try:
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            proc.kill()
        try:
            proc.wait(timeout=10)
        except Exception:
            pass
    shutil.rmtree(sandbox, ignore_errors=True)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
