# Contract test: NAMED OSC DEVICES — the user makes them, a mapping picks one.
# Run: py tests/test_osc_targets.py
#
# OSC had ONE host:port for the whole application, which was the truth for exactly as long as "OSC"
# meant "the receiver". A set that drives a lamp on an ESP32 and a tablet running TouchOSC at the
# same time needs two, so a mapping now says WHICH device it talks to.
#
# What is easy to break here, and silent when it breaks:
#
# 1. THE ROUTING ITSELF. Every mapping snapshots its device WHEN IT COMPILES, exactly as it does its
#    full address. Miss a recompile after the registry changes and the panel shows the new address
#    while the packets keep going to the old one — nothing errors, nothing is logged, the lamp just
#    stops answering.
#
# 2. THE FALLBACK. A device id ("t3") is local to one machine, and the choice of device travels
#    inside a preset because it is CONTENT ("this one drives the lamp, that one the tablet"). On a
#    machine with no t3 the mapping has to play on the DEFAULT device, not go silent.
#
# 3. REMOVING A DEVICE. Three things in one order: park what talked to it (on the address that is
#    about to disappear — a lamp left on has no way back afterwards), repoint those mappings at the
#    default device AND WRITE THAT DOWN, and only then drop the row.
#
# 4. THE DEFAULT DEVICE IS NOT A ROW. It is host/port, it cannot be deleted, and mappings pointing
#    at it carry dst=None so that moving it reaches all of them at once.
#
# Nothing here touches the owner's Settings/ or Library/: both are pointed at a temp directory
# first, no HTTP server is started (the endpoint's logic is tested through the very methods the
# handler calls), and the UDP socket is a stub that records (payload, address) instead of sending.
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf  # noqa: E402

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("   -> " + str(detail)) if detail else ""))


class FakeBus:
    def __init__(self):
        self.events = []

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)

    def kinds(self, t):
        return [e for e in self.events if e.get("t") == t]


class FakeSock:
    """A connectionless UDP socket, minus the UDP. Records exactly what OscEmitter hands it."""

    def __init__(self):
        self.sent = []          # [(address, addr_tuple)]

    def sendto(self, data, addr):
        self.sent.append((_osc_addr(data), addr))
        return len(data)

    def close(self):
        pass


def _osc_addr(data):
    """The address out of an OSC packet — everything up to the first NUL."""
    i = data.find(b"\x00")
    return data[:i if i >= 0 else len(data)].decode("utf-8", "replace")


class FakeSource:
    def __init__(self):
        self.power = {}


class FakeDevice:
    """Enough of a Device for the registry to walk and for build_bundle to describe: an id, the
    REAL MidiMapper, and the other engines a set is built from."""

    def __init__(self, dev_id="d0", osc=None, slot=0):
        self.id = dev_id
        self.bus = FakeBus()
        self.midimap = rf.MidiMapper(self.bus, midi=None, osc=osc, trig=None, slot=slot)
        # SKANER wszedł do zestawu 2026-09-13 (`SETUP_KEYS` + `build_setup`), więc atrapa
        # kapsla bez niego przestała wystarczać: `build_setup` sięga po `d.scan.get_config()`.
        self.scan = rf.ScanModule(self.bus, dev_id)
        self.trig = rf.TriggerEngine(self.bus, emitter=None, armed=True)
        self.mouse = rf.AirMouse(self.bus, emitter=None, trig=self.trig, gamepad=None)
        self.source = FakeSource()

    def meta_dict(self):
        return {"dev": self.id, "name": self.id, "label": ""}


def emitter():
    oe = rf.OscEmitter("127.0.0.1", 9000)
    oe._sock = FakeSock()        # nothing leaves the machine, and every packet is inspectable
    return oe


def manager(devs, oe):
    """The REAL DeviceManager methods with none of its machinery (no BLE, no threads, no pads)."""
    dm = rf.DeviceManager.__new__(rf.DeviceManager)
    dm.b = FakeBus()
    dm.midi_emitter = None
    dm.osc_emitter = oe
    dm.simulate = False
    dm._osc_lock = threading.RLock()
    dm.devices = {d.id: d for d in devs}
    dm.order = [d.id for d in devs]
    return dm


def stream(mapper, tilt):
    """One sample through the engine. The pause is not decoration: `rateMs` is an UPPER limit on
    packet rate, so two calls in the same millisecond would be one packet and the test would be
    measuring the rate limiter instead of the routing."""
    time.sleep(0.02)
    mapper.process(None, {"tilt": float(tilt), "spin": 0.0})


def a_map(mid, addr, target="", **kw):
    m = {"id": mid, "srcKind": "filter", "metric": "tilt", "dest": "osc", "addr": addr,
         "oscTarget": target, "oscProfile": "unit", "mode": "continuous",
         "inLo": 0, "inHi": 90, "rateMs": 5}
    m.update(kw)
    return m


# A sandbox for Settings/ — including the global MIDI/OSC file, whose path is a module constant
# computed at import time from the REAL settings directory.
_TMP = tempfile.mkdtemp(prefix="rf-osctgt-")
rf.SETTINGS_DIR = os.path.join(_TMP, "Settings")
rf.MIDI_GLOBAL_FILE = os.path.join(rf.SETTINGS_DIR, "ribbitflip_midi_global.json")
rf.SETUPS_DIR = os.path.join(_TMP, "Library", "Setups")
rf.MIDI_PRESET_DIR = os.path.join(_TMP, "Library", "MidiPresets")
for _d in (rf.SETTINGS_DIR, rf.SETUPS_DIR, rf.MIDI_PRESET_DIR):
    os.makedirs(_d, exist_ok=True)

try:
    # ---------------------------------------------------------------------------
    #  1. what a device is allowed to be
    # ---------------------------------------------------------------------------
    print("--- sanityzacja rejestru ------------------------------------------")
    ok_id = rf.OscEmitter.target_id_ok
    check("t1 i t99 to identyfikatory", ok_id("t1") and ok_id("t99"))
    check("t0, t100, p1, puste i 'tx' — nie",
          not any(ok_id(v) for v in ("t0", "t100", "p1", "", "tx", "T1", None)))
    S = rf.OscEmitter.sanitize_targets
    check("wiersz bez adresu odpada", S([{"id": "t1", "host": "  ", "port": 9000}]) == [])
    check("port poza 1–65535 odpada",
          S([{"id": "t1", "host": "h", "port": 0}]) == []
          and S([{"id": "t1", "host": "h", "port": 70000}]) == [])
    check("port jako tekst przechodzi jako liczba",
          S([{"id": "t1", "host": "h", "port": "9000"}])[0]["port"] == 9000)
    check("nazwa przycięta do 40 znaków",
          len(S([{"id": "t1", "name": "x" * 90, "host": "h", "port": 9000}])[0]["name"]) == 40)
    check("powtórzony identyfikator odpada",
          len(S([{"id": "t1", "host": "a", "port": 1}, {"id": "t1", "host": "b", "port": 2}])) == 1)
    check("sufit %d urządzeń" % rf.OscEmitter.TARGET_MAX,
          len(S([{"id": "t%d" % i, "host": "h", "port": 9000} for i in range(1, 40)]))
          == rf.OscEmitter.TARGET_MAX)
    check("nie-lista to pusty rejestr", S({"id": "t1"}) == [] and S(None) == [])

    # ---------------------------------------------------------------------------
    #  2. CRUD przez DeviceManager: odpowiedź, rozgłoszenie, zapis na dysk
    # ---------------------------------------------------------------------------
    print("\n--- tworzenie, nazwa, adres, zapis --------------------------------")
    oe = emitter()
    d0 = FakeDevice("d0", oe)
    dm = manager([d0], oe)
    r = dm.osc_target_create("Lampa ESP32", "192.168.0.50", 9000)
    check("create odpowiada całym rejestrem",
          r["ok"] and r["id"] == "t1" and len(r["oscTargets"]) == 1
          and r["oscTargetMax"] == rf.OscEmitter.TARGET_MAX, r)
    check("…i mówi, gdzie stoi cel domyślny",
          r["oscHost"] == "127.0.0.1" and r["oscPort"] == 9000, (r["oscHost"], r["oscPort"]))
    check("każda akcja rozgłasza `osctargets`", len(dm.b.kinds("osctargets")) == 1,
          [e.get("t") for e in dm.b.events])
    check("zapisane na dysk",
          rf.load_midi_global().get("oscTargets") == [{"id": "t1", "name": "Lampa ESP32",
                                                       "host": "192.168.0.50", "port": 9000}],
          rf.load_midi_global())
    r = dm.osc_target_create("", "", 9000)
    check("urządzenie bez adresu odrzucone ze zdaniem",
          r["ok"] is False and "adres" in r["error"] and len(r["oscTargets"]) == 1, r)
    r = dm.osc_target_rename("t1", "Lampa nad stołem")
    check("rename zmienia nazwę i nic więcej",
          r["ok"] and r["oscTargets"][0]["name"] == "Lampa nad stołem"
          and r["oscTargets"][0]["host"] == "192.168.0.50", r["oscTargets"])
    r = dm.osc_target_edit("t1", "192.168.0.77", 9001)
    check("edit przenosi urządzenie pod inny adres",
          r["ok"] and r["oscTargets"][0]["host"] == "192.168.0.77"
          and r["oscTargets"][0]["port"] == 9001, r["oscTargets"])
    r = dm.osc_target_edit("t1", "192.168.0.77", 0)
    check("zły port odrzucony, a wiersz zostaje NIETKNIĘTY",
          r["ok"] is False and oe.target_get("t1")["port"] == 9001, oe.targets_list())
    r = dm.osc_target_rename("t9", "widmo")
    check("nieznane urządzenie: odmowa, nie cisza", r["ok"] is False and "Nie ma" in r["error"], r)
    for i in range(2, rf.OscEmitter.TARGET_MAX + 1):
        dm.osc_target_create("u%d" % i, "10.0.0.%d" % i, 9000)
    r = dm.osc_target_create("o jeden za dużo", "10.0.0.99", 9000)
    check("sufit broniony ludzkim zdaniem",
          r["ok"] is False and str(rf.OscEmitter.TARGET_MAX) in r["error"], r.get("error"))

    # ---------------------------------------------------------------------------
    #  3. WYSYŁKA IDZIE DO SWOJEGO URZĄDZENIA
    # ---------------------------------------------------------------------------
    print("\n--- routing: dwa mapowania, dwa urządzenia ------------------------")
    oe = emitter()
    d0 = FakeDevice("d0", oe)
    dm = manager([d0], oe)
    dm.osc_target_create("Lampa", "10.1.1.1", 7001)      # t1
    dm.osc_target_create("Tablet", "10.1.1.2", 7002)     # t2
    d0.midimap.set_config({"oscEnabled": True,
                           "mappings": [a_map("mL", "/lampa", "t1"),
                                        a_map("mT", "/tablet", "t2"),
                                        a_map("mD", "/dom", "")]})
    oe._sock.sent = []
    stream(d0.midimap, 45.0)
    by_addr = {a: t for a, t in oe._sock.sent}
    check("mapowanie z t1 trafia w adres t1",
          by_addr.get("/ribbitflip/lampa") == ("10.1.1.1", 7001), oe._sock.sent)
    check("mapowanie z t2 trafia w adres t2",
          by_addr.get("/ribbitflip/tablet") == ("10.1.1.2", 7002), oe._sock.sent)
    check("mapowanie bez urządzenia trafia w cel domyślny",
          by_addr.get("/ribbitflip/dom") == ("127.0.0.1", 9000), oe._sock.sent)

    print("\n--- przeniesienie urządzenia dogania skompilowane mapowania -------")
    dm.osc_target_edit("t1", "10.9.9.9", 7009)
    oe._sock.sent = []
    stream(d0.midimap, 20.0)
    by_addr = {a: t for a, t in oe._sock.sent}
    check("po zmianie adresu pakiet leci pod NOWY",
          by_addr.get("/ribbitflip/lampa") == ("10.9.9.9", 7009), oe._sock.sent)

    print("\n--- przeniesienie CELU DOMYŚLNEGO ---------------------------------")
    dm.set_osc_target("10.5.5.5", 5555)
    oe._sock.sent = []
    stream(d0.midimap, 70.0)
    by_addr = {a: t for a, t in oe._sock.sent}
    check("mapowanie bez urządzenia idzie za celem domyślnym",
          by_addr.get("/ribbitflip/dom") == ("10.5.5.5", 5555), oe._sock.sent)
    check("…a nazwane urządzenia to nie rusza",
          by_addr.get("/ribbitflip/tablet") == ("10.1.1.2", 7002), oe._sock.sent)

    # ---------------------------------------------------------------------------
    #  4. nieznany identyfikator = cel domyślny (preset z cudzej maszyny)
    # ---------------------------------------------------------------------------
    print("\n--- nieznane urządzenie gra na cel domyślny -----------------------")
    oe = emitter()
    d0 = FakeDevice("d0", oe)
    d0.midimap.set_config({"oscEnabled": True, "mappings": [a_map("mX", "/obce", "t7")]})
    check("wybór autora ZOSTAJE w konfiguracji",
          d0.midimap.get_config()["mappings"][0]["oscTarget"] == "t7",
          d0.midimap.get_config()["mappings"][0]["oscTarget"])
    oe._sock.sent = []
    stream(d0.midimap, 45.0)
    check("…ale pakiet leci na cel domyślny, a nie w próżnię",
          oe._sock.sent and oe._sock.sent[0][1] == ("127.0.0.1", 9000), oe._sock.sent)
    check("identyfikator o złym kształcie jest jednak czyszczony",
          rf.MidiMapper(FakeBus(), midi=None, osc=None, trig=None, slot=0)
            ._sanitize_map({"dest": "osc", "addr": "/a", "oscTarget": "kot"})["oscTarget"] == "")
    check("cel OSC nie przykleja się do mapowania MIDI",
          rf.MidiMapper(FakeBus(), midi=None, osc=None, trig=None, slot=0)
            ._sanitize_map({"dest": "cc", "oscTarget": "t1"})["oscTarget"] == "")

    # ---------------------------------------------------------------------------
    #  5. parkowanie na zboczu wyłączenia grupy
    # ---------------------------------------------------------------------------
    print("\n--- parkowanie idzie na urządzenie MAPOWANIA ----------------------")
    oe = emitter()
    d0 = FakeDevice("d0", oe)
    dm = manager([d0], oe)
    dm.osc_target_create("Lampa", "10.1.1.1", 7001)
    d0.midimap.set_config({"oscEnabled": True,
                           "mappings": [a_map("mL", "/lampa", "t1", safeOnDisarm=0.0),
                                        a_map("mD", "/dom", "", safeOnDisarm=0.0)]})
    oe._sock.sent = []
    d0.midimap.set_config({"oscEnabled": False})       # zbocze opadające grupy OSC
    parked = {a: t for a, t in oe._sock.sent}
    check("parkowanie mapowania z urządzeniem idzie na TO urządzenie",
          parked.get("/ribbitflip/lampa") == ("10.1.1.1", 7001), oe._sock.sent)
    check("…a mapowania bez urządzenia na cel domyślny",
          parked.get("/ribbitflip/dom") == ("127.0.0.1", 9000), oe._sock.sent)

    # ---------------------------------------------------------------------------
    #  6. usunięcie urządzenia: parkuj → przestaw → zapisz → dopiero usuń
    # ---------------------------------------------------------------------------
    print("\n--- usunięcie urządzenia ------------------------------------------")
    oe = emitter()
    d0, d1 = FakeDevice("d0", oe), FakeDevice("d1", oe, slot=1)
    dm = manager([d0, d1], oe)
    dm.osc_target_create("Lampa", "10.1.1.1", 7001)                 # t1
    dm.osc_target_create("Tablet", "10.1.1.2", 7002)                # t2
    d0.midimap.set_config({"oscEnabled": True,
                           "mappings": [a_map("mL", "/lampa", "t1", safeOnDisarm=0.0),
                                        a_map("mT", "/tablet", "t2")]})
    d1.midimap.set_config({"oscEnabled": True,
                           "mappings": [a_map("mL2", "/lampa2", "t1", safeOnDisarm=0.0)]})
    oe._sock.sent = []
    r = dm.osc_target_delete("t1")
    check("odpowiedź liczy przepięte mapowania (oba kapsle)",
          r["ok"] and r["moved"] == 2, r)
    check("…i urządzenia już nie ma", oe.target_get("t1") is None and len(r["oscTargets"]) == 1)
    check("parkowanie poszło na USUWANY adres, zanim zniknął",
          ("/ribbitflip/lampa", ("10.1.1.1", 7001)) in oe._sock.sent
          and ("/ribbitflip/dev2/lampa2", ("10.1.1.1", 7001)) in oe._sock.sent, oe._sock.sent)
    check("mapowania wskazują teraz cel domyślny",
          d0.midimap.get_config()["mappings"][0]["oscTarget"] == ""
          and d1.midimap.get_config()["mappings"][0]["oscTarget"] == "")
    check("…a mapowanie na t2 nietknięte",
          d0.midimap.get_config()["mappings"][1]["oscTarget"] == "t2")
    check("rejestr liczy mapowania ze WSZYSTKICH kapsli, nie tylko z edytowanego",
          [t["uses"] for t in dm.osc_targets_state()["oscTargets"]] == [1],
          dm.osc_targets_state()["oscTargets"])
    with open(rf._dev_path("d0", "midi"), "r", encoding="utf-8") as f:
        saved = json.load(f)
    check("przepięcie ZAPISANE do pliku kapsla",
          saved["mappings"][0]["oscTarget"] == "" and saved["mappings"][1]["oscTarget"] == "t2",
          saved["mappings"])
    check("rejestr bez usuniętego też zapisany",
          [t["id"] for t in rf.load_midi_global().get("oscTargets", [])] == ["t2"],
          rf.load_midi_global().get("oscTargets"))
    oe._sock.sent = []
    stream(d0.midimap, 45.0)
    check("przepięte mapowanie mówi teraz do celu domyślnego",
          {a: t for a, t in oe._sock.sent}.get("/ribbitflip/lampa") == ("127.0.0.1", 9000),
          oe._sock.sent)

    print("\n--- usunięcie przy WYŁĄCZONEJ grupie nic nie wysyła ---------------")
    oe = emitter()
    d0 = FakeDevice("d0", oe)
    dm = manager([d0], oe)
    dm.osc_target_create("Lampa", "10.1.1.1", 7001)
    d0.midimap.set_config({"oscEnabled": False,
                           "mappings": [a_map("mL", "/lampa", "t1", safeOnDisarm=0.0)]})
    oe._sock.sent = []
    r = dm.osc_target_delete("t1")
    check("rozbrojony kapsel nie wypuszcza pakietu przy usuwaniu",
          r["moved"] == 1 and oe._sock.sent == [], oe._sock.sent)

    # ---------------------------------------------------------------------------
    #  7. stary plik globalny + środowisko dla panelu
    # ---------------------------------------------------------------------------
    print("\n--- stary plik globalny bez urządzeń ------------------------------")
    rf.save_midi_global({"midiPortIndex": -1, "oscHost": "192.168.1.9", "oscPort": 8000})
    oe = emitter()
    d0 = FakeDevice("d0", oe)
    dm = manager([d0], oe)
    dm.init_midi()
    check("wczytuje się jak dotąd, z pustym rejestrem",
          oe.host == "192.168.1.9" and oe.port == 8000 and oe.targets_list() == [],
          (oe.host, oe.port, oe.targets_list()))
    env = dm.osc_targets_state()
    check("GET /midi niesie rejestr, sufit i cel domyślny",
          env["oscTargets"] == [] and env["oscTargetMax"] == rf.OscEmitter.TARGET_MAX
          and env["oscHost"] == "192.168.1.9" and env["oscPort"] == 8000 and env["oscAvail"],
          env)
    dm.osc_target_create("Lampa", "10.1.1.1", 7001)
    check("…i po dodaniu urządzenie w nim jest",
          [t["id"] for t in dm.osc_targets_state()["oscTargets"]] == ["t1"])

    # ---------------------------------------------------------------------------
    #  8. zestaw wielokapslowy: rejestr jedzie razem z nim
    # ---------------------------------------------------------------------------
    print("\n--- zestaw (bundle): urządzenia jadą i wracają --------------------")
    env = {"app_config": {"midiGlobal": {
        "midiPortIndex": -1, "oscHost": "127.0.0.1", "oscPort": 9000,
        "oscTargets": [{"id": "t1", "name": "Lampa", "host": "10.4.4.4", "port": 7100},
                       {"id": "t0", "name": "śmieć", "host": "x", "port": 1},
                       {"id": "t2", "name": "Bez adresu", "host": "", "port": 7100}]}},
        "devices": []}
    oe = emitter()
    d0 = FakeDevice("d0", oe)
    dm = manager([d0], oe)
    res = rf.apply_bundle(dm, env, None, mode="safe", mapping=[])
    check("zestaw przywraca rejestr", "midiGlobal" in res["applied"], res)
    check("…przez sanityzację (śmieciowe wiersze odpadają)",
          [t["id"] for t in oe.targets_list()] == ["t1"], oe.targets_list())
    check("…i od razu w żywej aplikacji, nie dopiero po restarcie",
          oe.target_get("t1")["host"] == "10.4.4.4", oe.targets_list())
    check("plik globalny też sanityzowany",
          [t["id"] for t in rf.load_midi_global()["oscTargets"]] == ["t1"],
          rf.load_midi_global())
    check("build_bundle niesie rejestr dalej",
          [t["id"] for t in rf.build_bundle(dm)["app_config"]["midiGlobal"]["oscTargets"]] == ["t1"],
          rf.build_bundle(dm)["app_config"]["midiGlobal"])

    # ---------------------------------------------------------------------------
    #  9. preset MIDI/OSC niesie wybór urządzenia
    # ---------------------------------------------------------------------------
    print("\n--- preset: `oscTarget` to TREŚĆ zestawu --------------------------")
    pcfg = rf.midi_preset_config({"mappings": [a_map("mL", "/lampa", "t1")],
                                  "oscPrefix": "/moje", "enabled": True})
    check("wybór urządzenia jedzie w presecie",
          pcfg["mappings"][0]["oscTarget"] == "t1", pcfg["mappings"][0])
    check("…a prefiks i przełączniki dalej NIE",
          "oscPrefix" not in pcfg and "enabled" not in pcfg and "oscEnabled" not in pcfg,
          sorted(pcfg.keys()))
    check("`oscTarget` jest polem sanityzacji (odcisk panelu je liczy)",
          "oscTarget" in rf.MidiMapper(FakeBus(), midi=None, osc=None, trig=None, slot=0)
            ._sanitize_map({"dest": "osc"}))

    # ---------------------------------------------------------------------------
    #  10. przycisk „Test wyjścia" celuje tam, gdzie mapowanie
    # ---------------------------------------------------------------------------
    print("\n--- test wyjścia zna urządzenie mapowania -------------------------")
    oe = emitter()
    d0 = FakeDevice("d0", oe)
    dm = manager([d0], oe)
    dm.osc_target_create("Lampa", "10.1.1.1", 7001)
    d0.midimap.set_config({"oscEnabled": True, "mappings": [a_map("mL", "/lampa", "t1")]})
    res = d0.midimap.test_value(1.0, "mL", "/lampa")
    check("test_value oddaje adres, wartość i urządzenie",
          res is not None and len(res) == 3 and res[0] == "/ribbitflip/lampa"
          and res[2] == ("10.1.1.1", 7001), res)
    res_def = d0.midimap.test_value(1.0, None, "/nie-ma-takiego")
    check("nieznany adres nadal daje None (klient ma zapasową drogę)", res_def is None, res_def)

    # ---------------------------------------------------------------------------
    #  11. panel: lista urządzeń i wybór w edytorze mapowania
    # ---------------------------------------------------------------------------
    # Serwer może routować bez zarzutu, a człowiek i tak straci pracę — jeżeli pole wyboru
    # „poprawi" nieznane urządzenie z cudzego presetu na puste. Harness liczy to bez przeglądarki.
    print("\n--- panel: lista urządzeń i pole wyboru ---------------------------")
    harness = os.path.join(os.path.dirname(os.path.abspath(__file__)), "osc_targets_harness.mjs")
    try:
        p = subprocess.run(["node", harness], capture_output=True, text=True,
                           encoding="utf-8", timeout=60)
        out = json.loads((p.stdout or "").strip().splitlines()[-1]) if p.returncode == 0 else None
    except (OSError, ValueError, IndexError, subprocess.SubprocessError) as e:
        p, out = None, None
        print("POMINIETO  panel (Node): %s" % e)
    if out is None and p is not None:
        check("harness panelu wystartował", False, (p.stderr or p.stdout or "")[-300:])
    for nm, ok, detail in (out or {}).get("checks", []):
        check(nm, ok, detail)

finally:
    shutil.rmtree(_TMP, ignore_errors=True)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
