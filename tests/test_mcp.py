# E2E test of the MCP layer (/mcp). Run: py tests/test_mcp.py
#
# The app writes Settings/ and Library/ NEXT TO the file it was started from, so this harness
# copies ribbitflip_monitor.py + ribbitflip_mcp.py + ribbitflip_audio.py into a temp directory
# and launches THAT copy. Running the repo copy would mutate the owner's real configuration.
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
PORT = 8797
PORT_NOMCP = 8798
PORT_MODOFF = 8796   # kopia z --disable kontroler,skaner,kolo,osc (moduły wyłączone przy starcie)

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


def http(port, path, payload=None, headers=None, method=None):
    """Returns (status, parsed_json_or_raw_text)."""
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


def rpc(port, method, params=None, rid=1):
    msg = {"jsonrpc": "2.0", "method": method}
    if rid is not None:
        msg["id"] = rid
    if params is not None:
        msg["params"] = params
    return http(port, "/mcp", msg)


def call(port, tool, args=None, rid=1):
    """tools/call -> (structuredContent, isError). Raises on a JSON-RPC-level error."""
    st, res = rpc(port, "tools/call", {"name": tool, "arguments": args or {}}, rid)
    if not isinstance(res, dict) or "result" not in res:
        raise AssertionError("tools/call %s -> %s %s" % (tool, st, res))
    r = res["result"]
    return r.get("structuredContent"), bool(r.get("isError"))


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
    for _ in range(100):                       # ~10 s
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
    """The dashboard gets the anti-CSRF token injected into its HTML; POST endpoints need it."""
    st, html = http(port, "/")
    m = re.search(r'RIBBITFLIP_TOKEN="([^"]+)"', html if isinstance(html, str) else "")
    return m.group(1) if m else ""


def main():
    sandbox = tempfile.mkdtemp(prefix="rf_mcp_test_")
    proc = proc2 = proc3 = None
    try:
        # web/ribbitflip_dashboard.html rides along so GET / works (that is where the session
        # token is injected). The rest of web/ is not needed: _serve_html reads the single file.
        for f in ("ribbitflip_monitor.py", "ribbitflip_mcp.py", "ribbitflip_audio.py",
                  "ribbitflip_gesture.py",   # imported by the monitor since 2026-09-05 (recorded gestures)
                  "ribbitflip_songpacks.py", # imported by the monitor since 2026-10-03 (RibbitBeat song packs)
                  "ribbitflip_piosenki.py",  # imported by the monitor since 2026-10-04 (RibbitBeat songs with audio)
                  os.path.join("web", "ribbitflip_dashboard.html")):
            dst = os.path.join(sandbox, f)
            os.makedirs(os.path.dirname(dst) or sandbox, exist_ok=True)
            shutil.copy2(os.path.join(_ROOT, f), dst)
        print("sandbox: %s" % sandbox)
        proc = start_app(sandbox, PORT)
        tok = session_token(PORT)
        auth = {"X-RibbitFlip-Token": tok}
        check("session token extracted from the dashboard HTML", bool(tok))

        # --- 0. opt-in: MCP is OFF on a fresh install -----------------------
        st, body = http(PORT, "/health")
        check("fresh install: /health reports mcp=false", body.get("mcp") is False, body)
        st, body = http(PORT, "/mcp", {"jsonrpc": "2.0", "id": 1, "method": "ping"})
        check("fresh install: POST /mcp -> 403", st == 403, st)
        st, body = http(PORT, "/mcp/config")
        check("GET /mcp/config: disabled, not locked, url points at this port",
              body.get("ok") is True and body.get("enabled") is False
              and body.get("locked") is False
              and body.get("url") == "http://127.0.0.1:%d/mcp" % PORT, body)
        st, body = http(PORT, "/mcp/config", {"enabled": True})
        check("POST /mcp/config without the session token -> 403", st == 403, st)
        st, body = http(PORT, "/mcp", {"jsonrpc": "2.0", "id": 1, "method": "ping"})
        check("still off after the unauthenticated attempt", st == 403, st)
        st, body = http(PORT, "/mcp/config", {"enabled": True}, headers=auth)
        check("POST /mcp/config {enabled:true} with the token succeeds",
              body.get("ok") is True and body.get("enabled") is True, body)
        st, body = http(PORT, "/mcp/config")
        check("GET /mcp/config now reports enabled", body.get("enabled") is True, body)
        st, body = http(PORT, "/health")
        check("/health follows the runtime flip", body.get("mcp") is True, body)
        check("the settings file was written",
              os.path.exists(os.path.join(sandbox, "Settings", "ribbitflip_mcp.json")))

        # --- 0b. consent to arm is checked by the SERVER (2026-10-16) ---------------------
        st, body = http(PORT, "/mcp/config")
        check("fresh install: allowArm is off", body.get("allowArm") is False, body)
        call(PORT, "set_output", {"master": False}, rid=900)
        out, err = call(PORT, "set_output", {"master": True}, rid=901)
        check("without consent set_output(master=true) is refused", err, out)
        st, body = http(PORT, "/health")
        check("...and the app stays disarmed", body.get("master") is False, body)
        out, err = call(PORT, "set_rules", {"rules": [], "mode": "advanced"}, rid=903)
        check("without consent mode='advanced' is refused", err, out)
        out, err = call(PORT, "set_module_config", {"module": "wheel", "enabled": True}, rid=904)
        check("without consent switching the wheel on is refused", err, out)
        out, err = call(PORT, "set_module_config",
                        {"module": "scan", "config": {"enabled": True}}, rid=905)
        check("...also when 'enabled' is smuggled inside config", err, out)
        out, err = call(PORT, "set_output", {"master": False}, rid=906)
        check("disarming always passes", not err and out.get("masterArmed") is False, out)
        st, body = http(PORT, "/mcp/config", {"allowArm": True}, headers=auth)
        check("POST /mcp/config {allowArm:true} keeps MCP on",
              body.get("ok") is True and body.get("allowArm") is True and body.get("enabled") is True, body)
        with open(os.path.join(sandbox, "Settings", "ribbitflip_mcp.json"), encoding="utf-8") as f:
            saved = json.load(f)
        check("both switches are saved", saved == {"enabled": True, "allowArm": True}, saved)
        out, err = call(PORT, "set_output", {"master": True}, rid=907)
        check("with consent set_output(master=true) arms", not err and out.get("masterArmed") is True, out)

        # --- 1. initialize / notifications ---------------------------------
        st, res = rpc(PORT, "initialize", {"protocolVersion": "2025-06-18",
                                           "capabilities": {},
                                           "clientInfo": {"name": "test", "version": "0"}})
        init = res.get("result") if isinstance(res, dict) else {}
        check("initialize returns a supported protocolVersion",
              st == 200 and init.get("protocolVersion") in ("2025-06-18", "2025-03-26"), res)
        check("initialize serverInfo.name == 'ribbitflip'",
              (init.get("serverInfo") or {}).get("name") == "ribbitflip", init.get("serverInfo"))
        check("initialize advertises tools capability + instructions",
              "tools" in (init.get("capabilities") or {}) and bool(init.get("instructions")), init)
        st, body = http(PORT, "/mcp", {"jsonrpc": "2.0", "method": "notifications/initialized"})
        check("notifications/initialized -> HTTP 202 with no body", st == 202 and not body, (st, body))
        st, res = rpc(PORT, "ping", {}, rid=2)
        check("ping -> empty result", st == 200 and res.get("result") == {}, res)

        # --- 2. tools/list --------------------------------------------------
        st, res = rpc(PORT, "tools/list", {}, rid=3)
        tools = (res.get("result") or {}).get("tools") or []
        names = sorted(t.get("name") for t in tools)
        expect = sorted(["get_overview", "get_mapping_reference", "get_accessibility_guide",
                         "check_accessibility", "get_module_config", "set_module_config",
                         "set_scanner_layout", "get_setup", "analyze_setup", "apply_setup",
                         "set_rules", "save_setup", "set_output"])
        check("tools/list returns exactly the %d tools" % len(expect), names == expect, names)
        check("every tool has an inputSchema + description",
              all(isinstance(t.get("inputSchema"), dict) and t.get("description") for t in tools))

        # --- 3. get_overview ------------------------------------------------
        ov, err = call(PORT, "get_overview", rid=4)
        devs = {d["id"] for d in (ov or {}).get("devices", [])}
        check("get_overview lists slot d0", not err and "d0" in devs, ov)
        check("get_overview reports simulate mode",
              (ov.get("app") or {}).get("mode") == "simulate", ov.get("app"))
        # An assistant with no eyes debugs what it can see. `paused` cuts every output while the
        # groups still report enabled=true, and `padShare` is the only thing that says WHERE a
        # `pad:` mapping lands — without either, "it does nothing" has no visible cause.
        d0 = next((d for d in (ov or {}).get("devices", []) if d.get("id") == "d0"), {})
        check("overview device carries the pause flag",
              "paused" in d0 and isinstance(d0["paused"], bool), d0)
        check("overview device carries padShare",
              "padShare" in d0 and isinstance(d0["padShare"], str), d0)
        check("overview device still carries muted separately from paused",
              "muted" in d0 and isinstance(d0["muted"], bool), d0)
        # The idle hold. A THIRD flag, and it has to be readable on its own: a capsule reading
        # armed=false with paused=false is not broken, it is lying on the desk — and an assistant
        # that cannot see that difference would talk a human into "resuming" a capsule that is
        # going to resume itself the moment they pick it up.
        check("overview device carries the idle-hold flag",
              "autoPaused" in d0 and isinstance(d0["autoPaused"], bool), d0)
        check("a capsule nobody held reads both holds as off",
              d0.get("paused") is False and d0.get("autoPaused") is False, d0)
        pads = (ov or {}).get("pads") or {}
        check("overview carries the controller registry",
              isinstance(pads.get("list"), list) and isinstance(pads.get("free"), list)
              and isinstance(pads.get("kinds"), list), pads)
        check("registry advertises all three controller kinds",
              {"x360", "ds4", "wii"} <= {k.get("id") for k in (pads.get("kinds") or [])},
              pads.get("kinds"))
        check("registry says whether the pad driver is reachable",
              "driverAvail" in pads and isinstance(pads.get("driverAvail"), (bool, type(None))),
              pads.get("driverAvail"))
        # Auto sets by game. In the overview because it is the one thing that can rewrite the
        # whole configuration with nobody touching anything — without it, "the mapping is not
        # what I left it as" has an invisible cause.
        gsw = (ov or {}).get("gameSwitch") or {}
        check("overview carries the auto-set-by-game state",
              isinstance(gsw.get("enabled"), bool) and "lastExe" in gsw
              and isinstance(gsw.get("defaultsCount"), int), gsw)
        check("...off by default, so it never surprises a fresh install",
              gsw.get("enabled") is False, gsw)
        check("...and explains itself to an assistant",
              isinstance(gsw.get("note"), str) and "exe" in gsw.get("note", ""), gsw.get("note"))
        # OBS Studio, driven from the "Uslugi sieciowe" tab. In the overview for the same reason
        # as everything else here: an OBS action sent over a link nobody opened fails exactly the
        # way a wrong action fails, and an assistant with no eyes would then debug the action.
        obs = (ov or {}).get("obs") or {}
        check("overview carries the OBS link state",
              isinstance(obs.get("connected"), bool) and isinstance(obs.get("identified"), bool),
              obs)
        check("...disconnected on a fresh start, because nothing connects by itself",
              obs.get("connected") is False and obs.get("identified") is False, obs)
        check("...naming where it would connect",
              "host" in obs and "port" in obs, obs)
        check("...and explaining itself to an assistant",
              isinstance(obs.get("note"), str) and "obs-websocket" in obs.get("note", ""),
              obs.get("note"))
        check("every pad row names itself and its kind",
              all({"id", "kind", "caps"} <= set(p) for p in (pads.get("list") or [])),
              pads.get("list"))
        # The capsule's padShare must be answerable FROM the registry — a pad id nothing
        # describes is the state this section exists to prevent.
        _ids = {p.get("id") for p in (pads.get("list") or [])}
        check("padShare resolves against the registry (or is 'off'/'own')",
              d0.get("padShare") in _ids | {"off", "own", ""},
              {"padShare": d0.get("padShare"), "pads": sorted(_ids)})
        # KOŁO WYBORU. Its own engine and its own file, so it is invisible in every other field
        # here — and "holding the button does nothing" has exactly two causes worth naming, both
        # of which are these two numbers.
        check("overview device carries the wheel switch",
              "wheelEnabled" in d0 and isinstance(d0["wheelEnabled"], bool), d0)
        check("...and how many slices it has to choose between",
              isinstance(d0.get("wheelSlices"), int), d0)
        check("a fresh capsule has the wheel off and empty",
              d0.get("wheelEnabled") is False and d0.get("wheelSlices") == 0, d0)

        # --- 4. get_mapping_reference ---------------------------------------
        ref, err = call(PORT, "get_mapping_reference", rid=5)
        R = (ref or {}).get("reference") or {}
        check("reference carries the rule schema keys",
              not err and {"keySpec", "behavior", "threshold", "source"} <= set(R.get("ruleSchema", {})),
              list(R.get("ruleSchema", {}))[:6])
        check("reference carries both worked examples",
              {"gamePreset", "midiPreset"} <= set(R.get("examples", {})), list(R.get("examples", {})))
        check("reference documents sources, safety and the macro DSL",
              {"filter", "axis", "button", "trigger"} <= set(R.get("sources", {}))
              and "modes" in R.get("safety", {}) and "steps" in R.get("sequenceDsl", {}))
        # Battery saving vs the idle hold. Both keys have to be in the reference or a model will
        # never offer the feature; and the descriptions have to keep them APART, because reaching
        # for autoSleep when somebody asks for "stop it while it lies there" costs a reconnection
        # every time they pick the capsule up.
        _pw = R.get("power", {})
        check("reference documents the idle-hold power keys",
              {"autoPause", "autoPauseSec"} <= set(_pw), list(_pw))
        check("...and says it is not the same thing as sleeping",
              "autoSleep" in str(_pw.get("autoPause", "")), _pw.get("autoPause"))
        # Round-trip through the REAL set_power (POST /power -> PuckSource.set_power -> GET /power),
        # not a unit stub: the clamp lives there, and this is also what proves the two new keys are
        # persisted with the rest of the dict rather than dropped by a whitelist upstream.
        st, body = http(PORT, "/power?dev=d0", {"autoPause": True, "autoPauseSec": 45},
                        headers=auth)
        check("POST /power accepts the idle-hold settings",
              st == 200 and body.get("autoPause") is True and body.get("autoPauseSec") == 45, body)
        st, body = http(PORT, "/power?dev=d0", {"autoPauseSec": 99999}, headers=auth)
        check("POST /power clamps an absurd delay to the 3600 s ceiling",
              body.get("autoPauseSec") == 3600, body)
        st, body = http(PORT, "/power?dev=d0", {"autoPauseSec": "kwiatek"}, headers=auth)
        check("POST /power ignores a delay that is not a number",
              body.get("autoPauseSec") == 3600, body)
        st, body = http(PORT, "/power?dev=d0", headers=auth)
        check("GET /power reports the idle-hold settings back",
              body.get("autoPause") is True and body.get("autoPauseSec") == 3600, body)
        # ...and put the slot back the way the rest of the suite expects to find it.
        http(PORT, "/power?dev=d0", {"autoPause": False, "autoPauseSec": 60}, headers=auth)
        # The filter metrics are enumerated in three places here (shape, ranges, thresholds) and the
        # sanitiser drops any name missing from its own whitelist WITHOUT a word, so a metric the
        # reference forgets is one a model will never offer and one the app would silently rewrite
        # to 'tilt'. 'spin' is the newest and the easiest to leave out: it is the only one that is
        # neither an angle nor a rate.
        _flt = R.get("sources", {}).get("filter", {}) or {}
        check("the filter source lists every metric the sanitiser accepts",
              all(m in (_flt.get("shape", {}) or {}).get("metric", "")
                  for m in ("tilt", "twist", "pitch", "roll", "spin")),
              (_flt.get("shape", {}) or {}).get("metric"))
        check("spin has a range of its own, in the units it really uses",
              "LSB" in ((_flt.get("ranges", {}) or {}).get("spin") or ""),
              (_flt.get("ranges", {}) or {}).get("spin", "")[:120])
        check("...and the thresholds section says what a shake is worth",
              "spin" in ((_flt.get("typicalThresholds", {}) or {}).get("_appliesTo") or ""),
              (_flt.get("typicalThresholds", {}) or {}).get("_appliesTo", "")[:160])

        # --- 4b. the reference must describe TODAY'S engine ------------------
        # The header of ribbitflip_mcp.py promises these are transcribed from the runtime
        # sanitizers and kept in sync. A reference that is merely stale is worse than a missing
        # one: the model composes against it confidently and the app silently drops the fields.
        _ks = R.get("keySpec", {})
        check("padButtons include the touchpad click",
              "touchpad" in (_ks.get("padButtons") or []), _ks.get("padButtons"))
        check("reference states which kinds actually HAVE a touchpad",
              set(( _ks.get("padOnly") or {}).get("touchpad") or []) == {"ds4", "wii"},
              _ks.get("padOnly"))
        _pn = _ks.get("padNote") or ""
        check("padNote names all three controller kinds",
              all(k in _pn for k in ("'x360'", "'ds4'", "'wii'")), _pn[:120])
        check("padNote no longer claims the pad is always an Xbox one",
              "virtual Xbox controller" not in _pn, _pn[:120])
        check("padNote says the Wii pad is invisible outside emulators",
              "DSU" in _pn and "emulator" in _pn, _pn[:160])
        check("padNote says ds4 is the one that carries a gyroscope",
              "GYROSCOPE" in _pn or "gyroscope" in _pn, _pn[:160])
        check("padNote warns that pad:touchpad on x360 reports sent:false",
              "sent:false" in _pn, _pn[:160])
        _sm = (R.get("mouse", {}) or {}).get("stickMode", {}) or {}
        check("stickBackend offers the touchpad backend",
              "touchpad" in (_sm.get("stickBackend") or ""), _sm.get("stickBackend"))
        check("the touchpad backend is explained as a surface, not a stick",
              "glass" in (_sm.get("stickBackendNote") or "")
              and "LIFTS" in (_sm.get("stickBackendNote") or ""), _sm.get("stickBackendNote"))
        # KLIK BEZ KLIKANIA. Documented AND proven through the real sanitizer in the same breath:
        # a reference that describes a field the engine does not have is exactly the "stale is
        # worse than missing" failure this section exists to catch.
        _mm = (R.get("mouse", {}) or {}).get("mouseMode", {}) or {}
        check("reference documents the dwell click at all",
              {"dwellOn", "dwellMs", "dwellRadius", "dwellClick"} <= set(_mm), sorted(_mm))
        check("dwellOn says it is an accessibility aid and that it is gated like every output",
              "accessibility" in (_mm.get("dwellOn") or "")
              and "armed" in (_mm.get("dwellOn") or ""), (_mm.get("dwellOn") or "")[:200])
        check("dwellClick enumerates exactly the four clicks the engine accepts",
              all("'%s'" % c in (_mm.get("dwellClick") or "")
                  for c in ("left", "right", "middle", "double")), _mm.get("dwellClick"))
        # Round trip through AirMouse.set_config on the LIVE engine: out-of-range and a typo'd
        # click must come back clamped and defaulted, which is what the ranges above promise.
        out, err = call(PORT, "apply_setup", {"config": {"mouse": {
            "dwellOn": True, "dwellMs": 99999, "dwellRadius": 0.1, "dwellClick": "pad:a"}}}, rid=141)
        gs, _ = call(PORT, "get_setup", rid=142)
        _dw = (((gs or {}).get("setup") or {}).get("config") or {}).get("mouse") or {}
        check("the engine clamps dwellMs to the documented ceiling",
              not err and abs(float(_dw.get("dwellMs") or 0) - 5000.0) < 1e-9, _dw.get("dwellMs"))
        check("...clamps dwellRadius to the documented floor",
              abs(float(_dw.get("dwellRadius") or 0) - 2.0) < 1e-9, _dw.get("dwellRadius"))
        check("...and rewrites an unknown click to 'left' instead of raising on every stop",
              _dw.get("dwellClick") == "left", _dw.get("dwellClick"))
        call(PORT, "apply_setup", {"config": {"mouse": {
            "dwellOn": False, "dwellMs": 900, "dwellRadius": 12, "dwellClick": "left"}}}, rid=143)

        _ps = ((R.get("mouse", {}) or {}).get("common", {}) or {}).get("padShare") or ""
        check("padShare documents the 'off' value",
              "'off'" in _ps and "sent:false" in _ps, _ps[-260:])
        check("padShare distinguishes 'off' from an empty value",
              "nobody has said yet" in _ps, _ps[-260:])
        _df = R.get("deviceFlags") or ""
        check("reference explains the muted / paused device flags",
              "muted" in _df and "paused" in _df and "apply_setup" in _df, _df[:160])
        check("deviceFlags says paused cuts EVERY output with the link still up",
              "EVERY output" in _df, _df[:200])
        check("deviceFlags points at the module matrix and the per-module switches",
              "Modu" in _df and "trigEnabled" in _df and "oscEnabled" in _df, _df[-260:])

        # The reference used to tell the model that simulation holds the keyboard and mouse back.
        # It does not - only --no-keys does - and an assistant that believes otherwise will arm a
        # group thinking nothing can reach the desktop. This guard is deliberately phrased both
        # ways: the false sentence must be gone AND the true warning must be present, because
        # deleting the lie without replacing it would also pass a "not in" check.
        _blob = json.dumps(R, ensure_ascii=False)
        check("the false 'simulation holds keys back' claim is gone",
              "held back" not in _blob and "only keys and mouse" not in _blob)
        _sil = " ".join((R.get("padsSynth", {}) or {}).get("whySilentChecklist", []))
        check("the checklist warns that every output is real in simulation",
              "EVERY output is real" in _sil and "--no-keys" in _sil, _sil[-320:])
        check("the checklist says the groups start switched off",
              "STARTS SWITCHED OFF" in _sil, _sil[-320:])
        # ...and the flag it points the model at has to actually exist in the payload
        check("overview.app reports sendKeys",
              isinstance((ov.get("app") or {}).get("sendKeys"), bool), ov.get("app"))

        # The gaps a blind comprehension probe found: fields the model could see but not read.
        check("reference explains that armed is derived, not a switch",
              "DERIVED" in _df and "masterArmed" in _df, _df[-320:])
        _cs = R.get("connStates") or {}
        check("reference lists every connection state",
              {"connected", "sim", "scanning", "pairing", "idle", "parked",
               "disconnected", "init"} <= set(_cs), sorted(_cs))
        check("connStates explain themselves",
              all(isinstance(v, str) and len(v) > 12 for v in _cs.values()), _cs)
        check("pads note explains what 'active' means and that pads are lazy",
              "lazily" in (pads.get("note") or "") and "DSU server is listening" in (pads.get("note") or ""),
              (pads.get("note") or "")[:200])
        _mn = (R.get("mouse", {}) or {}).get("note") or ""
        check("mouse note warns the subsections are documentation, not JSON",
              "FLAT under 'mouse'" in _mn and "stickMode:{" in _mn, _mn[-260:])
        check("padShare says the legacy values are accepted on write too",
              "on WRITE as well as on load" in _ps and "becomes 'own'" in _ps, _ps[-320:])

        # EVERY documented pad button, through the real sanitizer. The reference is hand-copied
        # from the engine, so the failure mode is not "a button is missing" but "a button is
        # listed that the app silently drops" — the model then writes a rule that never fires and
        # nothing anywhere says why. One rule per button, read back, compared literally.
        # MAPPING LAYERS. The field is invisible when it works (0 = every layer) and invisible when
        # it does not: a rule the sanitiser silently drops the layer from simply works everywhere,
        # and one the model writes with a layer the sanitiser rewrites simply never fires. Both
        # halves are checked through the REAL sanitiser, not against the reference's own words.
        check("reference documents the rule's layer field",
              "layer" in R.get("ruleSchema", {}), list(R.get("ruleSchema", {})))
        _lay = str(R.get("ruleSchema", {}).get("layer") or "")
        check("the layer field explains that 0 means every layer",
              "0 =" in _lay and "every layer" in _lay, _lay[:160])
        check("keySpec lists the layer actions",
              {"layer:2", "layer:next", "layer:hold:2"} <= set(_ks.get("layerActions") or []),
              _ks.get("layerActions"))
        _ln = _ks.get("layerNote") or ""
        check("layerNote says a layer action reaches nothing outside the app",
              "goes NOWHERE" in _ln and "presses no key" in _ln, _ln[:160])

        # KOŁO WYBORU. Documented AND proven through the REAL sanitizer in the same breath — the
        # wheel is deliberately NOT a setup group, so the only way to write it is its own
        # endpoint, and a reference that named a field apply_setup could carry would be a lie.
        _wh = R.get("wheel", {}) or {}
        check("reference documents the selection wheel", bool(_wh), list(R)[:12])
        check("...with every config field it accepts",
              {"enabled", "holdMs", "confirm", "confirmMs", "deadzone", "slices"}
              <= set(_wh.get("config", {})), sorted(_wh.get("config", {})))
        check("...and all five ways of working it",
              {"release", "tilt-hold", "tilt-click", "click", "cycle"}
              <= set(_wh.get("confirmModes", {})), sorted(_wh.get("confirmModes", {})))
        check("...saying which of them need no button held",
              "8 seconds" in (_wh.get("timeout") or ""), (_wh.get("timeout") or "")[:120])
        check("...and that the lean-opened ones fight a capsule that steers",
              "fight the steering" in (_wh.get("openBar") or ""), (_wh.get("openBar") or "")[:200])
        check("...that a slice can run a macro, and that it beats the single action",
              "WINS over" in (_wh.get("sequence") or ""), (_wh.get("sequence") or "")[:160])
        check("...and what the live packet carries",
              all(k in (_wh.get("liveStream") or "") for k in ("confirm", "cd", "cyc", "dz")),
              (_wh.get("liveStream") or "")[:200])
        check("the macro DSL documents the layer step and its limits",
              any("layer:" in k for k in (R.get("sequenceDsl", {}).get("steps", {})))
              and "500" in (R.get("sequenceDsl", {}).get("limits") or ""),
              sorted(R.get("sequenceDsl", {}).get("steps", {})))
        check("...saying it is NOT a setup group",
              "NOT a setup group" in (_wh.get("whereItLives") or ""),
              (_wh.get("whereItLives") or "")[:120])
        check("...that a slice speaks the same language as keySpec, minus layers",
              "keySpec" in (_wh.get("spec") or "") and "layer:" in (_wh.get("spec") or ""),
              (_wh.get("spec") or "")[:160])
        check("...and that sending goes through the ordinary arm gate",
              "armed" in (_wh.get("gates") or ""), (_wh.get("gates") or "")[:160])
        check("...and that the wheel does not swallow the button",
              "does NOT swallow" in (_wh.get("collision") or ""),
              (_wh.get("collision") or "")[:120])

        # The round trip. Everything the reference promises about clamping, asked of the engine:
        # nine slices offered, eight kept; an out-of-range hold cut; a `layer:` action emptied;
        # a field nobody declared dropped. Written through the endpoint the reference names.
        st, w0 = http(PORT, "/wheel?dev=d0", headers=auth)
        check("GET /wheel answers with a config", st == 200 and isinstance(w0, dict), (st, w0))
        st, w1 = http(PORT, "/wheel?dev=d0", payload={
            "enabled": True, "holdMs": 99999, "wheelNonsense": 7,
            "confirm": "teleportacja", "confirmMs": 99999, "deadzone": 9,
            "slices": ([{"label": "x" * 90, "spec": "layer:2",
                         "sequence": "layer:2; " + "b;" * 400}]
                       + [{"label": "s%d" % i, "spec": "a"} for i in range(16)])}, headers=auth)
        check("POST /wheel is accepted", st == 200 and (w1 or {}).get("ok") is True, (st, w1))
        check("...the hold is clamped to the documented ceiling",
              (w1 or {}).get("holdMs") == 5000, (w1 or {}).get("holdMs"))
        check("...a mode nobody implements falls back to the working one",
              (w1 or {}).get("confirm") == "release", (w1 or {}).get("confirm"))
        check("...the confirm wait is clamped to the documented ceiling",
              (w1 or {}).get("confirmMs") == 3000, (w1 or {}).get("confirmMs"))
        check("...and so is the dead zone",
              (w1 or {}).get("deadzone") == 0.7, (w1 or {}).get("deadzone"))
        check("...seventeen slices become sixteen", len((w1 or {}).get("slices") or []) == 16,
              len((w1 or {}).get("slices") or []))
        check("...an over-long macro is trimmed to the documented 500",
              len(((w1 or {}).get("slices") or [{}])[0].get("sequence", "")) == 500,
              len(((w1 or {}).get("slices") or [{}])[0].get("sequence", "")))
        check("...and a `layer:` STEP inside that macro survives, as the reference says",
              ((w1 or {}).get("slices") or [{}])[0].get("sequence", "").startswith("layer:2;"),
              ((w1 or {}).get("slices") or [{}])[0].get("sequence", "")[:20])
        st, w3 = http(PORT, "/wheel?dev=d0", payload={
            "enabled": True, "confirm": "cycle", "confirmMs": 900, "deadzone": 0.5,
            "slices": [{"label": "A", "spec": "a"}, {"label": "B", "sequence": "b; wait 50; c"}]},
            headers=auth)
        check("a whole five-mode config round-trips through the real sanitizer",
              (w3 or {}).get("confirm") == "cycle" and (w3 or {}).get("confirmMs") == 900
              and (w3 or {}).get("deadzone") == 0.5, w3)
        check("...macro and all", ((w3 or {}).get("slices") or [{}, {}])[1].get("sequence")
              == "b; wait 50; c", (w3 or {}).get("slices"))
        check("...an over-long label is trimmed to 24",
              len(((w1 or {}).get("slices") or [{}])[0].get("label", "")) == 24,
              ((w1 or {}).get("slices") or [{}])[0])
        check("...and a `layer:` action is emptied, as the reference says",
              ((w1 or {}).get("slices") or [{}])[0].get("spec") == "",
              ((w1 or {}).get("slices") or [{}])[0])
        check("...while a key nobody declared never comes back",
              "wheelNonsense" not in (w1 or {}), sorted(w1 or {}))
        st, w2 = http(PORT, "/wheel?dev=d0",
                      payload={"enabled": True, "slices": [{"label": "sam", "spec": "a"}]},
                      headers=auth)
        check("one slice cannot switch the wheel on, and the answer says why",
              (w2 or {}).get("enabled") is False and (w2 or {}).get("error"), w2)
        # put it back the way it was found — the harness runs on a copy, but a test that leaves
        # a switched-on wheel behind would make the next section's overview read differently
        http(PORT, "/wheel?dev=d0",
             payload={"enabled": False, "holdMs": 300, "confirm": "release", "confirmMs": 600,
                      "deadzone": 0.34, "slices": []}, headers=auth)
        check("layerNote says only the hold form is holdable",
              "only holdable form" in _ln, _ln[:400])
        check("overview reports which layer each capsule is on",
              isinstance(d0.get("activeLayer"), int) and 1 <= d0["activeLayer"] <= 4,
              d0.get("activeLayer"))
        _lrules = [{"id": "lay%d" % n, "label": "warstwa %d" % n,
                    "source": {"kind": "filter", "metric": "tilt"},
                    "cmp": ">", "threshold": 30, "keySpec": "space", "layer": n}
                   for n in (0, 1, 4)]
        _lrules.append({"id": "layswitch", "source": {"kind": "button", "any": True},
                        "keySpec": "layer:hold:2", "behavior": "hold"})
        _out, _err = call(PORT, "apply_setup", {"config": {"rules": _lrules}}, rid=66)
        _gs, _ = call(PORT, "get_setup", rid=67)
        _back = {r["id"]: r for r in ((_gs.get("setup") or {}).get("config") or {}).get("rules", [])}
        check("every documented layer survives the real sanitizer",
              not _err and all(_back.get("lay%d" % n, {}).get("layer") == n for n in (0, 1, 4)),
              {k: v.get("layer") for k, v in _back.items()})
        check("a layer: action is not dropped as risky",
              _back.get("layswitch", {}).get("keySpec") == "layer:hold:2",
              _back.get("layswitch"))
        call(PORT, "set_rules", {"rules": []}, rid=68)

        _pb = _ks.get("padButtons") or []
        _rules = [{"id": "padbtn%d" % i, "label": "pad %s" % b,
                   "source": {"kind": "filter", "metric": "tilt"},
                   "cmp": ">", "threshold": 30, "keySpec": "pad:%s" % b, "behavior": "hold"}
                  for i, b in enumerate(_pb)]
        _out, _err = call(PORT, "apply_setup", {"config": {"rules": _rules}}, rid=63)
        _gs, _ = call(PORT, "get_setup", rid=64)
        _back = {r["id"]: r for r in ((_gs.get("setup") or {}).get("config") or {}).get("rules", [])}
        _lost = [b for i, b in enumerate(_pb) if "padbtn%d" % i not in _back]
        _bent = [b for i, b in enumerate(_pb)
                 if "padbtn%d" % i in _back and _back["padbtn%d" % i].get("keySpec") != "pad:%s" % b]
        check("every documented pad button survives the real sanitizer",
              not _err and not _lost and not _bent, {"dropped": _lost, "rewritten": _bent})
        call(PORT, "set_rules", {"rules": []}, rid=65)

        # the examples must survive the real sanitizers unchanged in meaning
        game = R["examples"]["gamePreset"]["config"]
        out, err = call(PORT, "analyze_setup", {"config": game}, rid=6)
        an = (out or {}).get("analysis") or {}
        check("game example is fully safe (0 risky)",
              not err and an.get("ruleCount") == 6 and an.get("riskyCount") == 0, an)

        # both examples must survive the REAL sanitizers with their meaning intact —
        # a reference the app would silently rewrite is worse than no reference
        out, err = call(PORT, "apply_setup", {"config": game}, rid=61)
        gs, _ = call(PORT, "get_setup", rid=62)
        back = {r["id"]: r for r in ((gs.get("setup") or {}).get("config") or {}).get("rules", [])}
        check("game example round-trips unchanged",
              not err and len(back) == 6
              and back["g_left"]["keySpec"] == "a" and back["g_left"]["behavior"] == "hold"
              and back["g_left"]["threshold"] == -25.0
              and back["g_jump"]["source"]["kind"] == "button"
              and back["g_jump"]["source"]["any"] is True, list(back))
        # The shake in that example is the one rule whose metric the sanitizer used to rewrite to
        # 'tilt' without a word - which left a threshold of 12000 sitting on an angle that never
        # passes 180, i.e. a rule that could not fire and did not say so.
        check("the shake keeps its metric and its threshold through the sanitizer",
              (back.get("g_shake", {}).get("source", {}) or {}).get("metric") == "spin"
              and back.get("g_shake", {}).get("threshold") == 12000.0,
              back.get("g_shake"))
        midi_cfg = R["examples"]["midiPreset"]["config"]
        out, err = call(PORT, "apply_setup", {"config": midi_cfg}, rid=63)
        gs, _ = call(PORT, "get_setup", rid=64)
        mc = ((gs.get("setup") or {}).get("config") or {}).get("midi") or {}
        maps = {m["id"]: m for m in mc.get("mappings", [])}
        check("midi example round-trips unchanged",
              not err and mc.get("scale") == "pentatonic_minor"
              and maps["m_mod"]["dest"] == "cc" and maps["m_mod"]["cc"] == 1
              and maps["m_mod"]["inHi"] == 60.0
              and maps["m_note"]["dest"] == "note" and maps["m_note"]["loNote"] == 48
              and maps["m_note"]["velSource"] == "motion", mc)
        # The example's own "enabled": true is a GROUP SWITCH, not a setting, and a setup never
        # flips one in either direction (tests/test_setup_switches.py holds that contract). It has
        # to be reported as kept, or an assistant says "it is running" over a silent puck.
        check("the midi example's switch stayed off and was reported as kept",
              mc.get("enabled") is False and "midi" in (out.get("switchesKept") or []),
              (mc.get("enabled"), (out or {}).get("switchesKept")))
        call(PORT, "apply_setup", {"config": {"midi": {"enabled": False, "mappings": []},
                                              "rules": []}}, rid=65)

        # --- 5. set_rules (safe rule) ---------------------------------------
        rule = {"id": "t_tilt", "label": "Tilt -> A", "source": {"kind": "filter", "metric": "tilt"},
                "cmp": ">", "threshold": 30.0, "behavior": "once", "keySpec": "a"}
        out, err = call(PORT, "set_rules", {"rules": [rule]}, rid=7)
        check("set_rules stored 1 rule", not err and out.get("count") == 1, out)
        st, body = http(PORT, "/rules?dev=d0", headers={"X-RibbitFlip-Token": ""})
        # /rules requires the session token, so a 403 here is expected and correct; verify
        # through the MCP read path instead.
        gs, err = call(PORT, "get_setup", rid=8)
        live = ((gs or {}).get("setup") or {}).get("config") or {}
        check("get_setup sees the same rule live",
              not err and len(live.get("rules") or []) == 1
              and live["rules"][0]["keySpec"] == "a", live.get("rules"))

        # --- 6. safe vs advanced --------------------------------------------
        risky = {"id": "t_macro", "label": "macro", "source": {"kind": "filter", "metric": "tilt"},
                 "cmp": ">", "threshold": 40.0, "behavior": "once",
                 "sequence": "cmd+r; wait 100; x"}
        out, err = call(PORT, "set_rules", {"rules": [risky], "mode": "safe"}, rid=9)
        check("safe mode drops the risky rule",
              not err and out.get("droppedRisky") == 1 and out.get("count") == 0, out)
        out, err = call(PORT, "set_rules", {"rules": [risky], "mode": "advanced"}, rid=10)
        check("advanced mode keeps the risky rule",
              not err and out.get("count") == 1 and out.get("droppedRisky") == 0, out)
        check("the kept rule is reported as risky",
              (out.get("rules") or [{}])[0].get("level") == "risky", out.get("rules"))
        out, err = call(PORT, "set_rules", {"rules": []}, rid=11)
        check("empty list clears the rules", not err and out.get("count") == 0, out)

        # append is an UPSERT by id — a client retry must not duplicate rules
        a25 = dict(rule, id="up_a", threshold=25.0)
        a30 = dict(rule, id="up_a", threshold=30.0)
        b_rule = dict(rule, id="up_b", keySpec="b")
        call(PORT, "set_rules", {"rules": [a25]}, rid=111)
        out, err = call(PORT, "set_rules", {"rules": [a30, b_rule], "append": True}, rid=112)
        gs, _ = call(PORT, "get_setup", rid=113)
        got = {r["id"]: r for r in (((gs or {}).get("setup") or {}).get("config") or {}).get("rules", [])}
        check("append upserts by id (no duplicate, newest wins)",
              not err and out.get("count") == 2 and len(got) == 2
              and got["up_a"]["threshold"] == 30.0, out)
        call(PORT, "set_rules", {"rules": []}, rid=114)

        # --- 7. apply_setup with an inline config ---------------------------
        cfg = {"rules": [rule], "mouse": {"enabled": True, "mode": "mouse", "sensX": 0.05}}
        out, err = call(PORT, "apply_setup", {"config": cfg}, rid=12)
        check("apply_setup applied both groups",
              not err and {"rules", "mouse"} <= set(out.get("applied") or []), out)
        ov, _ = call(PORT, "get_overview", rid=13)
        d0 = [d for d in ov["devices"] if d["id"] == "d0"][0]
        gs, _ = call(PORT, "get_setup", rid=131)
        mouse = (((gs or {}).get("setup") or {}).get("config") or {}).get("mouse") or {}
        # sensX defaults to 0.035, so 0.05 proves the settings really landed on the live engine.
        check("apply_setup loaded the motion settings",
              d0.get("mouseMode") == "mouse" and abs(float(mouse.get("sensX") or 0) - 0.05) < 1e-9,
              (d0.get("mouseMode"), mouse.get("sensX")))
        check("...but left the group switch alone, and said so",
              d0.get("mouseEnabled") is False and "mouse" in (out.get("switchesKept") or []),
              (d0.get("mouseEnabled"), (out or {}).get("switchesKept")))

        # --- 8. analyze_setup counts risky rules ----------------------------
        out, err = call(PORT, "analyze_setup", {"config": {"rules": [rule, risky]}}, rid=14)
        an = (out or {}).get("analysis") or {}
        check("analyze_setup: 2 rules, 1 risky",
              not err and an.get("ruleCount") == 2 and an.get("riskyCount") == 1, an)
        gs, _ = call(PORT, "get_setup", rid=15)
        check("analyze_setup changed nothing",
              len((((gs or {}).get("setup") or {}).get("config") or {}).get("rules") or []) == 1)

        # --- 9. save_setup / get_setup{name} / apply_setup{name} ------------
        out, err = call(PORT, "save_setup", {"name": "test-mcp", "forApp": "harness"}, rid=16)
        check("save_setup returned ok", not err and out.get("name") == "test-mcp", out)
        path = os.path.join(sandbox, "Library", "Setups", "test-mcp.json")
        check("Setup file exists in the sandbox Library/Setups/", os.path.exists(path), path)
        check("saved Setup lists itself in setups", "test-mcp" in (out.get("setups") or []), out)
        gs, err = call(PORT, "get_setup", {"name": "test-mcp"}, rid=17)
        env = (gs or {}).get("setup") or {}
        check("get_setup{name} round-trips the envelope",
              not err and env.get("kind") == "setup" and env.get("author") == "mcp"
              and len((env.get("config") or {}).get("rules") or []) == 1, env.get("config"))
        out, err = call(PORT, "set_rules", {"rules": []}, rid=18)
        out, err = call(PORT, "apply_setup", {"name": "test-mcp"}, rid=19)
        check("apply_setup{name} restores the saved rules",
              not err and "rules" in (out.get("applied") or []), out)
        gs, _ = call(PORT, "get_setup", rid=20)
        check("restored rule is back on the slot",
              len((((gs or {}).get("setup") or {}).get("config") or {}).get("rules") or []) == 1)
        out, err = call(PORT, "get_setup", {"name": "nope-does-not-exist"}, rid=21)
        check("get_setup of a missing Setup is a tool error", err is True, out)
        out, err = call(PORT, "apply_setup", {"config": cfg, "name": "test-mcp"}, rid=22)
        check("apply_setup rejects config+name together", err is True, out)

        # --- 10. set_output --------------------------------------------------
        out, err = call(PORT, "set_output", {"master": False}, rid=23)
        check("set_output disarmed the master", not err and out.get("masterArmed") is False, out)
        st, body = http(PORT, "/health")
        check("/health agrees master is off", body.get("master") is False, body)
        check("/health reports mcp enabled", body.get("mcp") is True, body)
        out, err = call(PORT, "set_output", {"master": True}, rid=24)
        check("set_output can arm again", not err and out.get("masterArmed") is True, out)
        call(PORT, "set_output", {"master": False}, rid=25)

        # --- 10b. the accessibility guide -------------------------------------
        # The layer that decides WHICH mechanism to spend a movement on. Everything else in this
        # file checks that the app can be configured; this checks that it can be configured for a
        # body that cannot do what the default scheme assumes.
        gd, err = call(PORT, "get_accessibility_guide", rid=30)
        guide = (gd or {}).get("guide") or {}
        check("get_accessibility_guide answers", not err and bool(guide), gd)
        for key in ("askFirst", "abilityProfile", "mechanisms", "recipes", "antiPatterns",
                    "tuningLoop", "onlyAHumanCanDo"):
            check("the guide carries '%s'" % key, bool(guide.get(key)), list(guide))
        mech = {m.get("id") for m in guide.get("mechanisms") or []}
        # The three that answer "I cannot press buttons", "I cannot aim" and "I cannot hold".
        for m in ("scanner", "wheelCycle", "dwellClick", "behaviours", "pose"):
            check("the guide knows the '%s' mechanism" % m, m in mech, sorted(mech))
        check("every mechanism says who can set it",
              all(x.get("setBy") for x in guide.get("mechanisms") or []))
        check("the guide covers the modules only a human can reach",
              set(["recordAGesture", "overlays", "emergencyHotkey"])
              <= set((guide.get("onlyAHumanCanDo") or {}).keys()),
              list((guide.get("onlyAHumanCanDo") or {}).keys()))
        check("the instructions sent at initialize point at the guide",
              "get_accessibility_guide" in (init.get("instructions") or ""),
              (init.get("instructions") or "")[:120])

        # --- 10c. check_accessibility ----------------------------------------
        # An empty profile must NOT come back green: that reads as approval and means nothing.
        res, err = call(PORT, "check_accessibility", {}, rid=31)
        check("no ability profile -> fit 'unknown', not 'ok'",
              not err and res.get("fit") == "unknown" and res.get("askFirst"), res)

        hold_rule = {"id": "chk_hold", "label": "Przechyl -> W", "enabled": True,
                     "source": {"kind": "filter", "metric": "pitch"},
                     "cmp": "<", "threshold": -35.0, "behavior": "hold", "keySpec": "w"}
        res, err = call(PORT, "check_accessibility",
                        {"ability": {"canHold": False, "rangeDeg": 15, "signals": 2,
                                     "stopGesture": "potrząśnięcie"},
                         "config": {"rules": [hold_rule]}}, rid=32)
        finds = (res or {}).get("findings") or []
        check("a held key is a mismatch for somebody who cannot hold",
              res.get("fit") == "mismatch"
              and any("hold" in f.get("what", "") or "holds" in f.get("what", "")
                      for f in finds), res)
        check("...and a threshold past their range is caught too",
              any("reach" in f.get("what", "") for f in finds), finds)
        check("every finding says what to do instead", all(f.get("fix") for f in finds), finds)
        res, err = call(PORT, "check_accessibility",
                        {"ability": {"canHold": True, "canRepeatFast": True, "tremor": False,
                                     "rangeDeg": 60, "signals": 4, "steersPointer": True,
                                     "stopGesture": "skrót awaryjny"},
                         "config": {"rules": [hold_rule]}}, rid=33)
        check("the same scheme fits somebody who can do it", res.get("fit") == "ok", res)

        # --- 10d. the scanner, end to end -------------------------------------
        mod, err = call(PORT, "get_module_config", {"module": "scan"}, rid=34)
        check("get_module_config reads the scanner", not err and mod.get("module") == "scan", mod)
        check("...with the Polish keys the panel writes",
              "predkosc" in (mod.get("config") or {}), list(mod.get("config") or {})[:8])
        check("a fresh scanner is off", (mod.get("config") or {}).get("enabled") is False, mod)

        mod, err = call(PORT, "set_module_config",
                        {"module": "scan", "config": {"czasKroku": 1300, "odbicie": 200}},
                        rid=35)
        cfg = (mod or {}).get("config") or {}
        check("set_module_config writes the scanner", not err and cfg.get("czasKroku") == 1300, mod)
        check("...and a partial write keeps everything else",
              cfg.get("opoznienieStartu") == 1000 and cfg.get("tryb") == "pasy", cfg)
        check("...and clamps what is out of range",
              (call(PORT, "set_module_config",
                    {"module": "scan", "config": {"predkosc": 999999}}, rid=36)[0]
               or {}).get("config", {}).get("predkosc") == 6000)

        # The sets that ship with the app are seeded BY THE PANEL (the browser holds their
        # contents), so a sandbox starts with an empty library - save one the app's own way and
        # then load it from here, which is the path a person's saved scanner set really takes.
        st, body = http(PORT, "/scan-preset/save",
                        {"name": "Wolny test", "desc": "powolny",
                         "config": {"czasKroku": 1500, "opoznienieStartu": 2200,
                                    "predkosc": 300}},
                        headers=auth)
        check("a scanner set can be saved the panel's way", body.get("ok") is True, body)
        mod, err = call(PORT, "get_module_config", {"module": "scan"}, rid=36.1)
        check("...and get_module_config lists it",
              any(p.get("name") == "Wolny test" for p in mod.get("presets") or []),
              mod.get("presets"))
        res, err = call(PORT, "set_module_config",
                        {"module": "scan", "preset": "Wolny test"}, rid=36.2)
        cfg = (res or {}).get("config") or {}
        check("loading a set by name lands its timings",
              not err and cfg.get("czasKroku") == 1500 and cfg.get("opoznienieStartu") == 2200,
              res)
        check("...and the capsule carries its name", cfg.get("configName") == "Wolny test", cfg)
        check("...while the module switch is NOT carried by a set",
              cfg.get("enabled") is False, cfg)
        res, err = call(PORT, "set_module_config",
                        {"module": "scan", "preset": "nie ma takiego"}, rid=36.3)
        check("an unknown scanner set is refused, not silently ignored", err, res)
        res, err = call(PORT, "set_module_config",
                        {"module": "wheel", "preset": "nie ma takiego"}, rid=36.4)
        check("...and the same for a wheel", err, res)

        # Switching it on without a way to drive or stop it has to be SAID, not silently accepted.
        mod, err = call(PORT, "set_module_config", {"module": "scan", "enabled": True}, rid=37)
        warn = " ".join((mod or {}).get("warnings") or [])
        check("turning the scanner on warns that nothing drives it",
              "scan:sygnal" in warn and "scan:stop" in warn, mod)
        rules_scan = [
            {"id": "sk_sygnal", "label": "Sygnał", "enabled": True,
             "source": {"kind": "button", "any": True}, "behavior": "once",
             "keySpec": "scan:sygnal"},
            {"id": "sk_stop", "label": "Stop", "enabled": True,
             "source": {"kind": "filter", "metric": "spin"}, "cmp": ">", "threshold": 12000.0,
             "behavior": "once", "keySpec": "scan:stop"},
        ]
        out, err = call(PORT, "set_rules", {"rules": rules_scan}, rid=38)
        # THE regression this whole feature stands on: safe mode must keep the scanner's signals.
        check("safe mode keeps both scanner rules",
              not err and out.get("count") == 2 and out.get("droppedRisky") == 0, out)
        mod, err = call(PORT, "get_module_config", {"module": "scan"}, rid=39)
        check("the scanner now sees its signals in the rules",
              (mod.get("signalsInRules") or {}).get("sygnal") == 1
              and (mod.get("signalsInRules") or {}).get("stop") == 1, mod)
        check("...and still reports what is blocking it (no window open)",
              any("window" in b for b in mod.get("blocking") or []), mod.get("blocking"))
        ov, err = call(PORT, "get_overview", rid=40)
        d0 = next((d for d in (ov or {}).get("devices", []) if d.get("id") == "d0"), {})
        check("the overview reports the scanner too",
              d0.get("scanEnabled") is True and d0.get("scanMode") == "pasy"
              and (d0.get("scanSignals") or {}).get("stop") == 1, d0)

        res, err = call(PORT, "check_accessibility",
                        {"ability": {"signals": 1, "canHold": False, "tremor": True,
                                     "reactionMs": 700, "stopGesture": "potrząśnięcie"}},
                        rid=41)
        finds = (res or {}).get("findings") or []
        check("the check reads the LIVE scanner and likes a stop being there",
              not err and not any("scan:stop" in f.get("what", "") for f in finds), res)
        check("...and suggests the reaction-time correction for somebody who answers late",
              any("wyprzedzenie" in f.get("fix", "") for f in finds), finds)
        # The scheme that is RIGHT for one signal (scanner + a way out) must not come back as a
        # mismatch just because stopping costs a second movement - that reads as "wrong scheme"
        # and the advice under it would be to use the scanner they are already using.
        res, err = call(PORT, "check_accessibility",
                        {"ability": {"signals": 1, "canHold": False, "tremor": True}}, rid=41.1)
        finds = (res or {}).get("findings") or []
        check("one signal + a stop is a question, not a mismatch",
              res.get("fit") == "check"
              and any("stopping takes one more" in f.get("what", "") for f in finds), res)
        check("...and the mapped stop is named as needing confirmation with the person",
              any("whether THEY can make it" in f.get("what", "") for f in finds), finds)

        # The window over the desktop opens a BROWSER on the machine running this test, so only
        # the refusal path is exercised here - never the one that puts a window on somebody's
        # screen in the middle of a test run.
        call(PORT, "set_module_config", {"module": "scan", "enabled": False}, rid=42)
        res, err = call(PORT, "set_module_config",
                        {"module": "scan", "window": "open"}, rid=43)
        check("opening the window is refused while the module is off", err, res)
        res, err = call(PORT, "set_module_config",
                        {"module": "scan", "window": "close"}, rid=44)
        check("closing it is always allowed", not err and res.get("windowOpen") is False, res)
        res, err = call(PORT, "set_module_config", {"module": "wheel", "window": "open"}, rid=45)
        check("'window' is refused for the wheel", err, res)

        # --- 10e. the wheel ---------------------------------------------------
        mod, err = call(PORT, "get_module_config", {"module": "wheel"}, rid=46)
        check("get_module_config reads the wheel", not err and mod.get("module") == "wheel", mod)
        res, err = call(PORT, "set_module_config",
                        {"module": "wheel",
                         "config": {"confirm": "cycle", "confirmMs": 900, "deadzone": 0.5,
                                    "slices": [{"label": "Enter", "spec": "enter"},
                                               {"label": "Wstecz", "spec": "esc"},
                                               {"label": "Klik", "spec": "mouse:left"}]},
                         "enabled": True}, rid=47)
        cfg = (res or {}).get("config") or {}
        check("the wheel takes the aiming-free mode",
              not err and cfg.get("confirm") == "cycle" and cfg.get("enabled") is True, res)
        check("...with three slices and a wide dead zone",
              len(cfg.get("slices") or []) == 3 and cfg.get("deadzone") == 0.5, cfg)
        res, err = call(PORT, "set_module_config",
                        {"module": "wheel", "config": {"slices": [{"label": "Tylko jeden",
                                                                   "spec": "a"}],
                                                       "enabled": True}}, rid=48)
        check("a one-slice wheel cannot be switched on",
              (res or {}).get("config", {}).get("enabled") is False, res)
        res, err = call(PORT, "set_module_config", {"module": "kolo"}, rid=49)
        check("an unknown module is refused", err, res)

        # --- 11. transport security -----------------------------------------
        st, body = http(PORT, "/mcp", {"jsonrpc": "2.0", "id": 1, "method": "ping"},
                        headers={"Origin": "http://127.0.0.1:%d" % PORT})
        check("POST /mcp with a same-origin Origin header -> 403", st == 403, st)
        st, body = http(PORT, "/mcp", {"jsonrpc": "2.0", "id": 1, "method": "ping"},
                        headers={"Origin": "https://evil.example"})
        check("POST /mcp with a foreign Origin -> 403", st == 403, st)
        st, body = http(PORT, "/mcp", {"jsonrpc": "2.0", "id": 1, "method": "ping"},
                        headers={"Host": "evil.example"})
        check("POST /mcp with a rebound Host -> 403", st == 403, st)
        st, body = http(PORT, "/mcp", method="GET")
        check("GET /mcp -> 405", st == 405, st)
        # bodyless POST: the existing endpoints reject BEFORE reading the body, and a socket
        # closed over unread bytes would give the client an RST instead of the 403.
        st, body = http(PORT, "/rules", method="POST")
        check("regression: POST /rules without the session token is still 403", st == 403, st)
        st, res = rpc(PORT, "tools/call", {"name": "no_such_tool", "arguments": {}}, rid=26)
        check("unknown tool -> JSON-RPC -32602",
              (res.get("error") or {}).get("code") == -32602, res)
        st, res = rpc(PORT, "no/such/method", {}, rid=27)
        check("unknown method -> JSON-RPC -32601",
              (res.get("error") or {}).get("code") == -32601, res)
        st, body = http(PORT, "/mcp", [{"jsonrpc": "2.0", "id": 1, "method": "ping"}])
        check("batched request -> -32600",
              st == 400 and (json.loads(body)["error"]["code"] if isinstance(body, str)
                             else body["error"]["code"]) == -32600, (st, body))

        # --- 12. stdio bridge -------------------------------------------------
        bridge = subprocess.run(
            [sys.executable, os.path.join(_ROOT, "tools", "mcp_stdio_bridge.py"),
             "--port", str(PORT)],
            input=(json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                               "params": {"protocolVersion": "2025-06-18"}}) + "\n"
                   + json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n"
                   ).encode("utf-8"),
            capture_output=True, timeout=30)
        lines = [l for l in bridge.stdout.decode("utf-8", "replace").splitlines() if l.strip()]
        check("stdio bridge relays exactly one reply (notification swallowed)", len(lines) == 1,
              lines)
        check("stdio bridge reply is the initialize result",
              bool(lines) and json.loads(lines[0]).get("result", {}).get("serverInfo", {})
              .get("name") == "ribbitflip", lines[:1])

        # --- 13. runtime switch off ------------------------------------------
        st, body = http(PORT, "/mcp/config", {"enabled": False}, headers=auth)
        check("POST /mcp/config {enabled:false} disables at runtime",
              body.get("ok") is True and body.get("enabled") is False, body)
        st, body = http(PORT, "/mcp", {"jsonrpc": "2.0", "id": 1, "method": "ping"})
        check("after the switch-off /mcp answers 403 again (no restart needed)", st == 403, st)
        http(PORT, "/mcp/config", {"enabled": True}, headers=auth)

        # --- 14. --no-mcp is a hard lock the UI cannot override ---------------
        proc2 = start_app(sandbox, PORT_NOMCP, ["--no-mcp"])
        # NOTE: the same sandbox now holds Settings/ribbitflip_mcp.json with enabled:true,
        # so this instance also proves the CLI flag outranks the saved setting.
        st, body = http(PORT_NOMCP, "/mcp", {"jsonrpc": "2.0", "id": 1, "method": "ping"})
        check("--no-mcp: POST /mcp -> 403", st == 403, st)
        st, body = http(PORT_NOMCP, "/health")
        check("--no-mcp: /health reports mcp=false", body.get("mcp") is False, body)
        st, body = http(PORT_NOMCP, "/mcp/config")
        check("--no-mcp: GET /mcp/config reports locked",
              body.get("locked") is True and body.get("enabled") is False, body)
        tok2 = session_token(PORT_NOMCP)
        st, body = http(PORT_NOMCP, "/mcp/config", {"enabled": True},
                        headers={"X-RibbitFlip-Token": tok2})
        check("--no-mcp: the dashboard switch is refused",
              body.get("ok") is False and body.get("locked") is True, body)
        st, body = http(PORT_NOMCP, "/mcp", {"jsonrpc": "2.0", "id": 1, "method": "ping"})
        check("--no-mcp: /mcp still 403 after the refused attempt", st == 403, st)

        # --- 15. modules switched off at start (--disable / --only) -----------
        # Tools that WRITE a module which did not start refuse with module_off_message instead of
        # saving quietly; rules and setups that merely USE such a module are saved, with a note.
        pad_rule = {"id": "mo_pad", "label": "pad A", "enabled": True,
                    "source": {"kind": "button", "any": True}, "keySpec": "pad:a"}
        ov, err = call(PORT, "get_overview")
        check("all modules on: get_overview.app.modulesOff == []",
              not err and (ov.get("app") or {}).get("modulesOff") == [], (ov or {}).get("app"))
        sr, err = call(PORT, "set_rules", {"rules": [pad_rule], "mode": "advanced"})
        check("all modules on: set_rules with pad: has no modulesOff note",
              not err and "modulesOff" not in sr, sr)
        call(PORT, "set_rules", {"rules": []})
        proc3 = start_app(sandbox, PORT_MODOFF, ["--disable", "kontroler,skaner,kolo,osc"])

        def _err_text(tool, args):
            st, res = rpc(PORT_MODOFF, "tools/call", {"name": tool, "arguments": args})
            r = (res or {}).get("result") or {}
            txt = " ".join(c.get("text", "") for c in (r.get("content") or []) if isinstance(c, dict))
            return bool(r.get("isError")), txt

        ov, err = call(PORT_MODOFF, "get_overview")
        check("modules off: get_overview.app.modulesOff lists them",
              not err and (ov.get("app") or {}).get("modulesOff") == ["kolo", "kontroler", "osc", "skaner"],
              (ov or {}).get("app"))
        for tool, args, mid in (("set_module_config", {"module": "wheel", "config": {"holdMs": 400}}, "kolo"),
                                ("set_module_config", {"module": "scan", "enabled": True}, "skaner"),
                                ("set_scanner_layout", {"views": [{"nazwa": "Menu"}]}, "skaner"),
                                ("set_output", {"oscPort": 9100}, "osc")):
            e, txt = _err_text(tool, args)
            check("modules off: %s %s -> error naming '%s' and the start option" % (tool, sorted(args), mid),
                  e and ("'%s'" % mid) in txt and "--disable / --only" in txt and "Nothing was written" in txt, txt[:300])
        mc, err = call(PORT_MODOFF, "get_module_config", {"module": "wheel"})
        check("modules off: get_module_config still reads, with moduleOff said",
              not err and "switched off" in str(mc.get("moduleOff")), (mc or {}).get("moduleOff"))
        sr, err = call(PORT_MODOFF, "set_rules", {"rules": [pad_rule], "mode": "advanced"})
        check("modules off: set_rules with pad: is saved, with a modulesOff note",
              not err and sr.get("count") == 1 and [m["module"] for m in sr.get("modulesOff", [])] == ["kontroler"]
              and "restarted" in sr.get("modulesOffNote", ""), sr)
        cfg = {"rules": [pad_rule], "midi": {"enabled": False, "oscEnabled": True},
               "scan": {"enabled": True}}
        an, err = call(PORT_MODOFF, "analyze_setup", {"config": cfg})
        check("modules off: analyze_setup lists kontroler, skaner and osc parts",
              not err and [m["module"] for m in an.get("modulesOff", [])] == ["kontroler", "skaner", "osc"]
              and "warning" in an, an.get("modulesOff") if isinstance(an, dict) else an)
        ap, err = call(PORT_MODOFF, "apply_setup", {"config": cfg, "mode": "advanced"})
        check("modules off: apply_setup applies everything and reports modulesOff",
              not err and "rules" in ap.get("applied", []) and "scan" in ap.get("applied", [])
              and len(ap.get("modulesOff", [])) == 3 and ap.get("modulesOffNote"), ap)

    finally:
        for p in (proc, proc2, proc3):
            if p is not None:
                try:
                    p.terminate()
                    p.wait(timeout=5)
                except Exception:
                    try:
                        p.kill()
                    except Exception:
                        pass
        shutil.rmtree(sandbox, ignore_errors=True)

    print("\n%d passed, %d failed" % (_passed, _failed))
    return 1 if _failed else 0


if __name__ == "__main__":
    sys.exit(main())
