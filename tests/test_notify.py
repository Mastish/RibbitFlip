# Test of the per-trigger SYSTEM notifications (tray balloon). Run: py tests/test_notify.py
#
# Two layers:
#   1. in-process — SystemNotifier (rate limiting, swallow counter, queue overflow, no-tray path),
#      sanitize_rules (does the setting survive a save?) and TriggerEngine (do the fire / active
#      hooks reach the notifier with the right text?),
#   2. E2E — the running app: GET/POST /notify, the anti-CSRF gate, and a rule with the option on
#      making a full round trip through POST /rules -> GET /rules.
#
# Like tests/test_mcp.py this runs a COPY of the app in a temp directory: the app writes Settings/
# next to the file it was started from, and the repo copy is the owner's real configuration.
import importlib.util
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
PORT = 8799

_passed = 0
_failed = 0


def _say(line):
    """The notifications carry ⌨, ·, — and Polish letters; a CP1250 console cannot encode them and
    the harness must not die reporting a result. Anything unprintable degrades to '?'."""
    enc = (sys.stdout.encoding or "utf-8")
    print(line.encode(enc, "replace").decode(enc, "replace"))


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        _say("PASS  %s" % name)
    else:
        _failed += 1
        _say("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


def http(port, path, payload=None, headers=None, method=None):
    url = "http://127.0.0.1:%d%s" % (port, path)
    data = None
    hdr = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    hdr.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=hdr,
                                 method=method or ("POST" if data is not None else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read()
            status = r.status
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    if not body:
        return status, None
    try:
        return status, json.loads(body.decode("utf-8"))
    except Exception:
        return status, body.decode("utf-8", "replace")


def start_app(sandbox, port, extra=None):
    # --allow-multi: the app refuses to start while another copy is running (SingleInstance), and a
    # test that only passes when the developer's own RibbitFlip happens to be closed is not a test.
    # The port has to be OURS. Something else listening there would answer the health check below,
    # and the whole test would quietly run against the wrong process — which is exactly how a
    # passing suite once "proved" a file it had never written.
    _probe = socket.socket()
    try:
        taken = (_probe.connect_ex(("127.0.0.1", port)) == 0)
    finally:
        _probe.close()
    if taken:
        raise AssertionError("port %d is already taken - close whatever is listening there "
                             "(a leftover RibbitFlip from an earlier run?)" % port)
    cmd = [sys.executable, os.path.join(sandbox, "ribbitflip_monitor.py"),
           "--simulate", "--no-open", "--no-midi", "--no-tray", "--allow-multi", "--port", str(port)]
    cmd += extra or []
    proc = subprocess.Popen(cmd, cwd=sandbox, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(100):
        time.sleep(0.1)
        if proc.poll() is not None:
            out = proc.stdout.read().decode("utf-8", "replace")
            raise AssertionError("app on port %d died at startup:\n%s" % (port, out))
        try:
            st, body = http(port, "/health")
            if st == 200 and isinstance(body, dict) and body.get("ok"):
                return proc
        except Exception:
            pass
    proc.terminate()
    raise AssertionError("app on port %d did not answer /health in 10 s" % port)


def session_token(port):
    st, html = http(port, "/")
    m = re.search(r'RIBBITFLIP_TOKEN="([^"]+)"', html if isinstance(html, str) else "")
    return m.group(1) if m else ""


def load_module(sandbox):
    """Import the sandbox copy so module-level state (Settings path) points at the temp dir."""
    sys.path.insert(0, sandbox)
    spec = importlib.util.spec_from_file_location(
        "rf_sandbox_monitor", os.path.join(sandbox, "ribbitflip_monitor.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class FakeIcon:
    """Stand-in for the pystray icon: records what would reach the Windows shell."""

    def __init__(self, boom=False):
        self.calls = []
        self.loud = []
        self.quiet = []
        self.boom = boom

    def notify(self, message, title=None):
        if self.boom:
            raise RuntimeError("shell said no")
        self.calls.append((title, message))
        self.loud.append((title, message))          # the public path always plays the sound

    loud = None
    quiet = None

    def _message(self, code, flags, **kw):
        """pystray's private Shell_NotifyIcon helper — the silent path goes through here."""
        if self.boom:
            raise RuntimeError("shell said no")
        self.calls.append((kw.get("szInfoTitle"), kw.get("szInfo")))
        self.quiet.append((kw.get("szInfoTitle"), kw.get("szInfo"), kw.get("dwInfoFlags")))


def drain(notifier, seconds=3.0):
    """Wait until the notifier's worker thread has emptied its queue."""
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        with notifier._cv:
            empty = not notifier._q
        if empty:
            time.sleep(0.05)
            return
        time.sleep(0.05)


def test_notifier(mod):
    # --- no tray = no notifications, and the app says so instead of pretending ---
    n = mod.SystemNotifier()
    check("fresh notifier without a tray icon is unavailable", n.available() is False)
    check("...and names the reason", n.reason() == "no-tray", n.reason())
    check("notify() on an unavailable notifier is a no-op, not a crash", n.notify("t", "m") is False)

    # --- normal delivery ---
    icon = FakeIcon()
    n = mod.SystemNotifier()
    n.GAP_S = 0.01                      # the test is about the logic, not about Windows' pacing
    n.attach(icon)
    check("attaching the tray icon makes it available", n.available() is True)
    n.notify("Tytul", "Wiadomosc", key="k1")
    drain(n)
    check("the message reaches the icon (title, body)",
          icon.calls == [("Tytul", "Wiadomosc")], icon.calls)

    # --- per-key cooldown + the swallow counter ---
    icon.calls.clear()
    for _ in range(7):
        n.notify("T", "spam", key="k2")
    drain(n)
    check("a burst on one key yields exactly one notification", len(icon.calls) == 1, icon.calls)
    n._seen["k2"][0] -= (n.COOLDOWN_S + 0.1)    # pretend the cooldown elapsed
    n.notify("T", "spam", key="k2")
    drain(n)
    check("the swallowed ones are counted, not lost silently",
          len(icon.calls) == 2 and icon.calls[1][1] == "spam (x7)", icon.calls)
    n._seen["k2"][0] -= (n.COOLDOWN_S + 0.1)
    n.notify("T", "spam", key="k2")
    drain(n)
    check("the counter resets once it has been reported",
          len(icon.calls) == 3 and icon.calls[2][1] == "spam", icon.calls)

    # --- different keys do not block each other ---
    icon.calls.clear()
    n.notify("T", "a", key="ka")
    n.notify("T", "b", key="kb")
    drain(n)
    check("two different triggers both get through", len(icon.calls) == 2, icon.calls)

    # --- queue overflow drops the OLDEST (a stale "it fired" is worth less) ---
    n2 = mod.SystemNotifier()
    n2.attach(icon)
    with n2._cv:                                 # fill the queue without letting the worker drain it
        for i in range(n2.QUEUE_MAX + 4):
            n2._q.append(("T", "m%d" % i))
        while len(n2._q) > n2.QUEUE_MAX:
            n2._q.popleft()
        kept = [m for _, m in n2._q]
    check("queue is capped at QUEUE_MAX", len(kept) == n2.QUEUE_MAX, kept)
    check("the newest entries survive, the oldest are dropped",
          kept[-1] == "m%d" % (n2.QUEUE_MAX + 3) and kept[0] == "m4", kept)
    n2.stop()

    # --- a shell that refuses: reported once, then the feature reports itself as broken ---
    boom = FakeIcon(boom=True)
    n3 = mod.SystemNotifier()
    n3.GAP_S = 0.01
    n3.attach(boom)
    n3.notify("T", "m", key="k")
    drain(n3)
    time.sleep(0.2)
    check("a failing shell call flips availability off instead of throwing",
          n3.available() is False and n3.reason() == "failed", n3.reason())
    n3.stop()
    n.stop()

    # --- silent by default, with the sound only when explicitly asked for ---
    icon2 = FakeIcon()
    n4 = mod.SystemNotifier()
    n4.GAP_S = 0.01
    n4.attach(icon2)
    n4.notify("T", "cicho", key="s1")
    drain(n4)
    check("the default is a SILENT notification (NIIF_NOSOUND via _message)",
          len(icon2.quiet) == 1 and not icon2.loud
          and icon2.quiet[0][2] == mod.NIIF_NOSOUND, (icon2.quiet, icon2.loud))
    n4.notify("T", "glosno", key="s2", silent=False)
    drain(n4)
    check("silent=False keeps the private path but drops NIIF_NOSOUND (sound via flags)",
          len(icon2.quiet) == 2 and not icon2.loud
          and icon2.quiet[1][:2] == ("T", "glosno")
          and not (icon2.quiet[1][2] & mod.NIIF_NOSOUND), (icon2.quiet, icon2.loud))
    n4.stop()

    # --- a shell that refuses the PRIVATE call must not lose the notification ---
    class HalfIcon(FakeIcon):
        def _message(self, code, flags, **kw):
            raise RuntimeError("no private API here")
    half = HalfIcon()
    n5 = mod.SystemNotifier()
    n5.GAP_S = 0.01
    n5.attach(half)
    n5.notify("T", "m", key="h1")
    drain(n5)
    time.sleep(0.2)
    check("if the silent path is unavailable the notification still goes out, with sound",
          half.loud == [("T", "m")] and n5._silent_ok is False, (half.loud, n5._silent_ok))
    n5.notify("T", "m2", key="h2")
    drain(n5)
    check("...and it does not retry the broken private call again",
          len(half.loud) == 2, half.loud)
    n5.stop()

    # --- text arriving from the browser ---
    check("_notify_str trims, caps the length and drops control characters",
          mod._notify_str("  a\nb\tc  ", 10) == "a b c", repr(mod._notify_str("  a\nb\tc  ", 10)))
    check("_notify_str caps at the limit", len(mod._notify_str("x" * 500, 60)) == 60)
    check("_notify_str survives None", mod._notify_str(None, 10) == "")


def test_goto(mod):
    """Click on a balloon: the target is cleaned, remembered per delivered balloon, and a click
    either fronts an open panel (SSE `goto`) or opens a new one at ?goto=."""
    T = mod.notify_target
    check("rule target keeps kind/id/dev", T({"kind": "rule", "id": "r1", "dev": "d0", "x": 1})
          == {"kind": "rule", "id": "r1", "dev": "d0"}, T({"kind": "rule", "id": "r1", "dev": "d0"}))
    check("unknown kind is dropped", T({"kind": "eval", "id": "x"}) is None)
    check("rule without id is dropped", T({"kind": "rule"}) is None)
    check("rest needs api and id", T({"kind": "rest", "id": "t"}) is None
          and T({"kind": "rest", "api": "a", "id": "t"}) == {"kind": "rest", "api": "a", "id": "t"})
    check("selector may only be a plain #id",
          T({"kind": "card", "sel": "#gsCard"}) == {"kind": "card", "sel": "#gsCard"}
          and T({"kind": "card", "sel": "body *"}) is None)
    check("ids with quotes do not pass", "id" not in (T({"kind": "card", "tab": "x", "id": 'a"]'}) or {}))

    icon = FakeIcon()
    n = mod.SystemNotifier()
    n.GAP_S = 0.01
    n.attach(icon)
    n.notify("T", "m", key="g1", target={"kind": "rule", "id": "r9", "dev": "d1"})
    drain(n)
    time.sleep(0.05)
    check("the delivered balloon remembers its target",
          n.last_target() == {"kind": "rule", "id": "r9", "dev": "d1"}, n.last_target())
    n.notify("T", "m2", key="g2")
    drain(n)
    time.sleep(0.05)
    check("a newer balloon without a target replaces it", n.last_target() is None, n.last_target())
    n.stop()

    b = mod.Broadcaster()
    q = b.subscribe()
    opened = []
    r = mod.notify_goto("http://x/", {"kind": "rule", "id": "r1", "dev": "d0"}, b,
                        front=lambda: True, opener=opened.append)
    ev = q.get_nowait() if not q.empty() else {}
    check("open panel on screen: fronted and told where to go via SSE",
          r == "fronted" and ev.get("t") == "goto" and ev.get("id") == "r1" and not opened, (r, ev))
    r = mod.notify_goto("http://x/", {"kind": "rule", "id": "r1"}, b,
                        front=lambda: False, opener=opened.append)
    check("panel not on screen: a new one opens at ?goto=",
          r == "opened" and opened and opened[-1].startswith("http://x/?goto=%7B"), opened)
    b.unsubscribe(q)
    r = mod.notify_goto("http://x/", None, b, front=lambda: True, opener=opened.append)
    check("no listener and no target: just opens the panel", r == "opened" and opened[-1] == "http://x/",
          opened)


def test_sanitizer(mod):
    r = mod.sanitize_rules([{"id": "r1", "keySpec": "space",
                             "toast": {"on": True, "mode": "active", "silent": False,
                                       "text": "Moja treść"}}])[0]
    check("the setting survives sanitize_rules",
          r["toast"] == {"on": True, "mode": "active", "silent": False, "text": "Moja treść"},
          r.get("toast"))
    r = mod.sanitize_rules([{"id": "r1", "keySpec": "space"}])[0]
    check("a rule without the field gets the off default, silent",
          r["toast"] == {"on": False, "mode": "fire", "silent": True, "text": ""}, r.get("toast"))
    r = mod.sanitize_rules([{"id": "r1", "toast": {"on": 1, "mode": "nonsense"}}])[0]
    check("an unknown mode falls back to 'fire' and silence stays the default",
          r["toast"] == {"on": True, "mode": "fire", "silent": True, "text": ""}, r.get("toast"))
    r = mod.sanitize_rules([{"id": "r1", "toast": "not a dict"}])[0]
    check("garbage in the field cannot break the engine",
          r["toast"] == {"on": False, "mode": "fire", "silent": True, "text": ""}, r.get("toast"))
    r = mod.sanitize_rules([{"id": "r1", "toast": {"on": True, "text": "a\nb" + "x" * 300}}])[0]
    check("custom text is one line and length-capped",
          "\n" not in r["toast"]["text"] and len(r["toast"]["text"]) == 120
          and r["toast"]["text"].startswith("a b"), r["toast"]["text"][:20])


def test_engine(mod):
    """The engine hooks: a rule with the option on must notify on fire and on both edges of the
    active state, and a rule without it must stay silent."""
    icon = FakeIcon()
    mod.NOTIFIER.GAP_S = 0.01
    mod.NOTIFIER.COOLDOWN_S = 0.0            # this test is about the hooks, not the rate limit
    mod.NOTIFIER.attach(icon)

    b = mod.Broadcaster()
    eng = mod.TriggerEngine(b, emitter=None, armed=True)
    eng.set_rules(mod.sanitize_rules([
        {"id": "loud", "label": "Skok", "keySpec": "space", "behavior": "once",
         "source": {"kind": "filter", "metric": "tilt"}, "cmp": ">", "threshold": 20,
         "toast": {"on": True, "mode": "fire"}},
        {"id": "quiet", "label": "Cichy", "keySpec": "enter", "behavior": "once",
         "source": {"kind": "filter", "metric": "tilt"}, "cmp": ">", "threshold": 20},
    ]))

    def pose(tilt):
        eng.last_pose = {"tilt": tilt, "twist": 0.0, "pitch": 0.0, "roll": 0.0}
        eng.last_pose_ts = time.monotonic()

    pose(0.0)
    eng.tick()
    icon.calls.clear()
    pose(40.0)                                # over the threshold -> both rules fire
    eng.tick()
    drain(mod.NOTIFIER)
    # Layout: line 1 is the app (from the AppUserModelID), line 2 = "<module> — <what>",
    # line 3 = what happened.
    check("a rule with the notification on announces its fire",
          len(icon.calls) == 1, icon.calls)
    check("line 2 is '<module> — <rule>'",
          icon.calls[0][0] == "Mapowanie — Skok", icon.calls[0][0])
    check("line 3 says what happened and which key went out",
          icon.calls[0][1].startswith("Wyzwolone") and "space" in icon.calls[0][1], icon.calls[0][1])
    check("a rule without the option stays silent (only one notification for two fires)",
          len(icon.calls) == 1, icon.calls)
    # the language the dashboard reported drives that wording
    mod.UI_STATE["lang"] = "en"
    icon.calls[:] = []
    pose(0.0); eng.tick(); pose(40.0); eng.tick()
    drain(mod.NOTIFIER)
    check("an English dashboard gets English notifications",
          len(icon.calls) == 1 and icon.calls[0][0] == "Mapping — Skok"
          and icon.calls[0][1].startswith("Triggered"), icon.calls)
    mod.UI_STATE["lang"] = "pl"

    # --- mode "active": one notification on the rising edge, one on the falling edge ---
    icon.calls.clear()
    eng.set_rules(mod.sanitize_rules([
        {"id": "held", "label": "Trzymany", "keySpec": "w", "behavior": "once",
         "source": {"kind": "filter", "metric": "tilt"}, "cmp": ">", "threshold": 20,
         "toast": {"on": True, "mode": "active"}},
    ]))
    pose(0.0)
    eng.tick()
    icon.calls.clear()
    pose(40.0)
    eng.tick()
    drain(mod.NOTIFIER)
    check("becoming active is announced",
          len(icon.calls) == 1 and icon.calls[0][1] == "Aktywny", icon.calls)
    pose(40.0)
    eng.tick()
    eng.tick()
    drain(mod.NOTIFIER)
    check("staying active does NOT repeat the notification", len(icon.calls) == 1, icon.calls)
    pose(0.0)
    eng.tick()
    drain(mod.NOTIFIER)
    check("the end of the episode is announced too",
          len(icon.calls) == 2 and icon.calls[1][1] == "Koniec", icon.calls)
    check("both edges carry the same '<module> — <rule>' line",
          all(c[0] == "Mapowanie — Trzymany" for c in icon.calls), icon.calls)

    # --- 'active' mode must not also fire the per-trigger notification ---
    check("mode 'active' does not additionally announce every fire",
          len(icon.calls) == 2, icon.calls)

    # --- the user's own wording replaces the generated body ---
    icon.calls[:] = []
    eng.set_rules(mod.sanitize_rules([
        {"id": "own", "label": "Nieuzywana etykieta", "keySpec": "q", "behavior": "once",
         "source": {"kind": "filter", "metric": "tilt"}, "cmp": ">", "threshold": 20,
         "toast": {"on": True, "mode": "fire", "text": "Skacz teraz!"}},
    ]))
    pose(0.0)
    eng.tick()
    icon.calls[:] = []
    pose(40.0)
    eng.tick()
    drain(mod.NOTIFIER)
    check("a custom text replaces the generated description (line 3), not the title",
          len(icon.calls) == 1 and icon.calls[0][1].startswith("Skacz teraz!")
          and icon.calls[0][0] == "Mapowanie — Nieuzywana etykieta", icon.calls)
    check("...and even a custom text keeps the 'nothing was actually sent' marker",
          "nie wysłano" in icon.calls[0][1], icon.calls[0][1])


def test_e2e(sandbox):
    proc = start_app(sandbox, PORT)
    try:
        tok = session_token(PORT)
        auth = {"X-RibbitFlip-Token": tok}
        check("session token extracted from the dashboard HTML", bool(tok))

        st, body = http(PORT, "/notify")
        check("GET /notify reports that --no-tray means no notifications",
              st == 200 and body.get("avail") is False and body.get("reason") == "no-tray", body)

        st, body = http(PORT, "/notify", {"title": "T", "message": "M"})
        check("POST /notify without the session token -> 403", st == 403, st)

        st, body = http(PORT, "/notify", {"title": "T", "message": "M"}, headers=auth)
        check("POST /notify with the token answers honestly (queued: no, reason: no-tray)",
              st == 200 and body.get("ok") is False and body.get("reason") == "no-tray", body)

        # --- the dashboard's language reaches the server, and survives a restart ---
        st, body = http(PORT, "/ui-lang", {"lang": "en"})
        check("POST /ui-lang without the session token -> 403", st == 403, st)
        st, body = http(PORT, "/ui-lang", {"lang": "en"}, headers=auth)
        check("POST /ui-lang with the token is accepted",
              st == 200 and body.get("ok") is True and body.get("lang") == "en", body)
        check("...and is written to disk, so a rule firing before the dashboard opens still matches",
              json.load(open(os.path.join(sandbox, "Settings", "ribbitflip_ui.json"),
                             encoding="utf-8")).get("lang") == "en")
        st, body = http(PORT, "/ui-lang", {"lang": "klingon"}, headers=auth)
        check("an unknown language falls back to Polish", body.get("lang") == "pl", body)

        # --- the per-rule setting makes a full round trip through the server ---
        rules = [{"id": "rt1", "label": "Test", "keySpec": "space", "enabled": True,
                  "source": {"kind": "filter", "metric": "tilt"}, "cmp": ">", "threshold": 25,
                  "behavior": "once",
                  "toast": {"on": True, "mode": "active", "silent": False, "text": "Ćwierć obrotu"}}]
        st, body = http(PORT, "/rules", {"rules": rules}, headers=auth)
        check("POST /rules accepts a rule carrying the notification setting", st == 200, (st, body))
        st, body = http(PORT, "/rules")
        got = (body or {}).get("rules", [])
        check("GET /rules returns the setting unchanged (mode, sound, own text)",
              len(got) == 1 and got[0].get("toast") == {"on": True, "mode": "active",
                                                        "silent": False, "text": "Ćwierć obrotu"}, got)
        check("the rules file on disk carries it too",
              json.load(open(os.path.join(sandbox, "Settings", "ribbitflip_rules.json"),
                             encoding="utf-8"))["rules"][0]["toast"]["mode"] == "active")

        # --- the app keeps running while a notifying rule fires with no tray to notify through ---
        time.sleep(1.5)
        check("the app survives a notifying rule with notifications unavailable",
              proc.poll() is None)
        st, body = http(PORT, "/health")
        check("/health still OK after that", st == 200 and body.get("ok") is True, body)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


def main():
    sandbox = tempfile.mkdtemp(prefix="rf_notify_test_")
    try:
        for f in ("ribbitflip_monitor.py", "ribbitflip_mcp.py", "ribbitflip_audio.py",
                  "ribbitflip_gesture.py",   # imported by the monitor since 2026-09-05 (recorded gestures)
                  "ribbitflip_songpacks.py", # imported by the monitor since 2026-10-03 (RibbitBeat song packs)
                  "ribbitflip_piosenki.py",  # imported by the monitor since 2026-10-04 (RibbitBeat songs with audio)
                  os.path.join("web", "ribbitflip_dashboard.html")):
            dst = os.path.join(sandbox, f)
            os.makedirs(os.path.dirname(dst) or sandbox, exist_ok=True)
            shutil.copy2(os.path.join(_ROOT, f), dst)
        print("sandbox: %s" % sandbox)
        cwd = os.getcwd()
        os.chdir(sandbox)
        try:
            mod = load_module(sandbox)
            test_notifier(mod)
            test_goto(mod)
            test_sanitizer(mod)
            test_engine(mod)
        finally:
            os.chdir(cwd)
        test_e2e(sandbox)
    finally:
        print()
        print("%d passed, %d failed" % (_passed, _failed))
        try:
            shutil.rmtree(sandbox, ignore_errors=True)
        except Exception:
            pass
    sys.exit(1 if _failed else 0)


if __name__ == "__main__":
    main()
