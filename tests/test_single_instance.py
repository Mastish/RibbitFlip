# Unit test: the single-instance guard (SingleInstance + the exclusive HTTP port).
# Run: py tests/test_single_instance.py
# No app and no hardware: the mutex is asked for twice in this very process (the name is
# machine-wide, so a second handle sees the first one exactly as a second .exe would), and the
# port is bound with the same server class the app uses.
#
# The point of the port cases: on Windows a second process CAN bind a port that is already being
# listened on, because http.server sets SO_REUSEADDR and Windows reads that as "share". That is
# not a curiosity - it is how one app quietly became two, with the panel talking to one process
# and the other one still emitting. Case 3 is the regression test for the fix; case 4 is the
# regression test for the fix not breaking a normal restart.
import os
import socket
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf  # noqa: E402

_passed = 0
_failed = 0
def _free_port(avoid=()):
    """A port nobody listens on RIGHT NOW. Fixed numbers broke on this machine: 8790/8791/8813 are
    exactly where the browser harnesses expect their test copies of the app (tests/*.cjs, *.mjs),
    so with those copies up the very first bind died with WinError 10048."""
    while True:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.bind(("127.0.0.1", 0))
        p = s.getsockname()[1]
        s.close()
        if p != 8770 and p not in avoid:      # never the app's default: a real copy may want it
            return p


PORT = _free_port()  # nothing of ours listens here; the app's default is 8770
# A name of our own, not the production one: that mutex belongs to whatever RibbitFlip the
# developer has open, and a test that only passes when they close it is not a test.
NAME = "RibbitFlip.SingleInstance.test"


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s   %s" % (name, detail))


def _handler():
    """A do-nothing handler class: these cases never serve a request, they only bind."""
    from http.server import BaseHTTPRequestHandler
    return BaseHTTPRequestHandler


print("--- the mutex ----------------------------------------------------")
first = rf.SingleInstance(NAME)
check("the first copy gets in", first.acquire() is True)

second = rf.SingleInstance(NAME)
check("the second copy is turned away", second.acquire() is False)

check("...and asking again does not change the answer", second.acquire() is False)
check("the holder keeps saying yes to itself", first.acquire() is True)

first.release()
check("after the handover the next copy gets in", second.acquire() is True,
      "release() must free the name - the /mode restart depends on it")
second.release()

check("a released guard leaves nothing behind", rf.SingleInstance(NAME).acquire() is True)

print("--- the port -----------------------------------------------------")
srv = rf._bind_http(PORT, _handler())
try:
    def _second_bind(reuse):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        if reuse:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", PORT))
            s.listen(1)
            return True
        except OSError:
            return False
        finally:
            s.close()

    check("a second listener is refused (this is the bug that split the app)",
          _second_bind(reuse=True) is False,
          "SO_EXCLUSIVEADDRUSE is missing: two processes can serve the same port again")
    check("...even without asking to reuse the address", _second_bind(reuse=False) is False)
finally:
    srv.server_close()

# A restart must still work with connections lingering in TIME_WAIT - the app is quit and started
# again far more often than it is launched twice, and a guard that blocks THAT is the worse bug.
srv = rf._bind_http(PORT, _handler())
cl = socket.socket()
cl.connect(("127.0.0.1", PORT))
conn, _ = srv.socket.accept()
conn.close()                      # server side closes first -> TIME_WAIT on our port
cl.close()
srv.server_close()
try:
    again = rf._bind_http(PORT, _handler())
    again.server_close()
    check("the port comes back for a restart, TIME_WAIT and all", True)
except OSError as e:
    check("the port comes back for a restart, TIME_WAIT and all", False, str(e))

print("--- the note: where does the running copy answer? ----------------")
# The mutex is machine-wide, the port is not. A copy started with --port 8806 holds the one name,
# so a second launch that only knows the default asks 8770, hears nothing, and reports a zombie -
# about a copy that is healthy one port over. That happened (23.08); these are its regression tests.
# The note is written to a temp path, never the real one: the production file belongs to whatever
# RibbitFlip the developer has open, and a test that stomps on it is a bug, not a test.
import json                                                              # noqa: E402
import subprocess                                                        # noqa: E402
import tempfile                                                          # noqa: E402
import threading                                                         # noqa: E402
from http.server import BaseHTTPRequestHandler, HTTPServer               # noqa: E402

PORT_NOTE = _free_port(avoid=(PORT,))   # the port the "running copy" of these cases answers on
_tmp = tempfile.mkdtemp(prefix="rf-instance-")
rf.INSTANCE_FILE = os.path.join(_tmp, ".instance.json")


def _write_note(**kw):
    with open(rf.INSTANCE_FILE, "w", encoding="utf-8") as f:
        json.dump(kw, f)


rf._instance_publish(PORT_NOTE)
note = rf._instance_read()
check("the copy that binds a port writes down where it answers",
      (note or {}).get("port") == PORT_NOTE and (note or {}).get("pid") == os.getpid())

_write_note(pid=os.getpid() + 1, port=PORT_NOTE, exe="somebody-else.exe")
rf._instance_forget()
check("quitting does not erase somebody else's note",
      rf._instance_read() is not None,
      "the /mode restart publishes over ours while we exit - erasing that hides the fresh copy")

rf._instance_publish(PORT_NOTE)
rf._instance_forget()
check("quitting takes our own note down", rf._instance_read() is None)

# A live "already running copy": answers /health the way the app does, on a port nobody guesses.
srv = HTTPServer(("127.0.0.1", PORT_NOTE), type("H", (BaseHTTPRequestHandler,), {
    "do_GET": lambda s: (s.send_response(200), s.send_header("Content-Length", "12"), s.end_headers(),
                         s.wfile.write(b'{"ok": true}')) and None,
    "log_message": lambda s, *a: None,
}))
threading.Thread(target=srv.serve_forever, daemon=True).start()
try:
    rf._instance_publish(PORT_NOTE)
    url, alive, tried, _n = rf._locate_running_instance(8770)
    check("a copy on another port is found, not declared dead",
          alive is True and url.endswith(":%d/" % PORT_NOTE),
          "this is the false 'running but not answering' report: %s alive=%s" % (url, alive))
    check("...and the message can say which ports were asked", tried == "%d, 8770" % PORT_NOTE, tried)

    rf._instance_forget()
    _url2, alive2, tried2, _n2 = rf._locate_running_instance(8770)
    check("with no note it still asks the port this launch was given",
          alive2 is False and tried2 == "8770", tried2)

    _write_note(pid=os.getpid(), port="nonsense", exe="x.exe")
    url3, alive3, tried3, _n3 = rf._locate_running_instance(PORT_NOTE)
    check("a corrupt note is ignored, not fatal (it is a file on disk)",
          alive3 is True and tried3 == str(PORT_NOTE), "%s / %s" % (url3, tried3))
finally:
    srv.shutdown()
    srv.server_close()

print("--- naming a process for the Task Manager ------------------------")
me = os.path.basename(sys.executable)
check("a live process can be named", rf._process_image(os.getpid()) == me,
      "got %r, expected %r" % (rf._process_image(os.getpid()), me))

with subprocess.Popen([sys.executable, "-c", "pass"]) as _pr:
    _pr.wait()
    _dead = _pr.pid          # handles close on leaving the with-block: the PID is then really gone
check("a dead process is not named (os.kill(pid, 0) would have KILLED it on Windows)",
      rf._process_image(_dead) is None)

_write_note(pid=os.getpid(), port=PORT_NOTE, exe=me)
check("the note's owner is named for the Task Manager",
      rf._instance_owner(rf._instance_read()) == "%s, PID %d" % (me, os.getpid()))

_write_note(pid=os.getpid(), port=PORT_NOTE, exe="not-what-is-running.exe")
check("a recycled PID is refused rather than sent to End Task",
      rf._instance_owner(rf._instance_read()) == "",
      "Windows reuses PIDs; naming a stranger's process is worse than saying nothing")

check("no note, no name", rf._instance_owner(None) == "")

print("--- otwieranie panelu --------------------------------------------")
# APLIKACJA BEZ OKNA: kiedy przeglądarka się nie otworzy, na ekranie nie ma NIC — tylko żaba
# w zasobniku, na Windows 11 domyślnie pod strzałką. Dla człowieka wygląda to jak „nie odpala się"
# i tak też zostało zgłoszone (2026-08-28). Dlatego: (1) `webbrowser.open` zwracające False MUSI
# liczyć się jako porażka — samo nie rzuca, więc kod patrzący wyłącznie na wyjątek meldował sukces,
# (2) po nim idą kolejne drogi, (3) porażka ma zostawić ślad.
_real_wb = rf.webbrowser.open
_real_start = getattr(rf.os, "startfile", None)
_real_run = rf.subprocess.run
_tries = []
try:
    rf.webbrowser.open = lambda u: (_tries.append("webbrowser"), False)[1]
    if _real_start is not None:
        rf.os.startfile = lambda u: (_tries.append("startfile"), (_ for _ in ()).throw(OSError("nie ma czym")))[1]
    rf.subprocess.run = lambda *a, **k: (_tries.append("start"), (_ for _ in ()).throw(OSError("brak cmd")))[1]
    ok, why = rf._browser_open("http://127.0.0.1:1/")
    check("a browser that only RETURNS False counts as a failure", ok is False)
    check("...and the next ways are tried, not skipped",
          _tries[0] == "webbrowser" and len(_tries) == (3 if _real_start is not None else 1),
          "próby: %s" % _tries)
    check("the failure says WHY, so a log can answer 'nothing happened'", len(why) == len(_tries))

    _tries.clear()
    rf.webbrowser.open = lambda u: (_tries.append("webbrowser"), True)[1]
    ok2, why2 = rf._browser_open("http://127.0.0.1:1/")
    check("a browser that opens stops the chain right there",
          ok2 is True and _tries == ["webbrowser"] and why2 == [])
finally:
    rf.webbrowser.open = _real_wb
    if _real_start is not None:
        rf.os.startfile = _real_start
    rf.subprocess.run = _real_run

# JEDNA DROGA DO PRZEGLĄDARKI. Start, ikona w zasobniku i drugie uruchomienie muszą pytać o to samo
# — inaczej jedna z tych trzech ścieżek znów będzie milczeć, gdy przeglądarka nie wstanie.
_src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                         "ribbitflip_monitor.py"), "r", encoding="utf-8").read()
check("nothing opens a browser behind the helper's back",
      _src.count("webbrowser.open(") == 1,      # jedyne miejsce: droga pierwsza w _browser_open
      "surowe wywołania: %d" % _src.count("webbrowser.open("))
check("the second launch believes the RESULT, not the absence of an exception",
      "opened, _ = _browser_open(" in _src)
check("a windowless build gets told where the panel is",
      "def _open_panel" in _src and "_startup_box" in _src.split("def _open_panel", 1)[1][:2000]
      and "daemon=True" in _src.split("def _open_panel", 1)[1][:2000],
      "okienko musi iść na osobny wątek — MessageBox blokuje swój do kliknięcia")

try:
    os.remove(rf.INSTANCE_FILE)
    os.rmdir(_tmp)
except OSError:
    pass

print()
print("%s - %d passed, %d failed" % ("OK" if not _failed else "PROBLEMY", _passed, _failed))
sys.exit(1 if _failed else 0)
