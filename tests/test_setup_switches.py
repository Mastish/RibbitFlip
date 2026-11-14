# Contract test: a setup carries CONFIGURATION, never arming.
# Run: py tests/test_setup_switches.py
#
# Importing a file must not switch an output group on. The group switch means "input may leave
# this machine now", which is the user's decision, taken in the panel — and the file may come
# from a stranger. This test drives the real engines (TriggerEngine / AirMouse / MidiMapper) so
# it also proves the merge semantics their set_config relies on: dropping the flag really does
# leave the live switch alone, rather than defaulting it to something.
#
# Disk is stubbed out: apply_setup saves through module-level functions, and the repo's own
# Settings/ is the owner's live configuration.
import os
import sys

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
        print("FAIL  %s   %s" % (name, detail))


class FakeBus:
    def __init__(self):
        self.events = []
        self.mouse = {}
        self.status = {}
        self.device = {}

    def now(self):
        return 0.0

    def publish(self, ev):
        self.events.append(ev)


class FakeSource:
    def __init__(self):
        self.power = {}

    def set_power(self, cfg):
        if isinstance(cfg, dict) and "idleMin" in cfg:
            self.power["idleMin"] = cfg["idleMin"]


class FakeDm:
    simulate = False


class FakeDevice:
    """Enough of a Device for apply_setup, with the REAL engines behind the switches."""
    id = "d0"

    def __init__(self):
        bus = FakeBus()
        self.bus = bus
        self.dm = FakeDm()
        self.trig = rf.TriggerEngine(bus, emitter=None, armed=True)
        self.mouse = rf.AirMouse(bus, emitter=None, trig=self.trig, gamepad=None)
        self.midimap = rf.MidiMapper(bus, midi=None, osc=None, trig=self.trig, slot=0)
        self.pose = rf.PoseFilter()
        self.source = FakeSource()
        self.cal = None

    def apply_cal(self, cal):
        self.cal = cal


# --- disk stubs -------------------------------------------------------------
_saved = {}
# `config_name` is here purely to mirror the real signature (a setup carries the NAME of its
# trigger list since 2026-08-28). What this test watches is still the switch, and only the switch.
rf.save_rules = lambda rules, dev=rf.DEFAULT_DEV, enabled=True, active_layer=None, config_name=None: _saved.__setitem__("rules", enabled)
rf.save_mouse = lambda cfg, dev=rf.DEFAULT_DEV: _saved.__setitem__("mouse", dict(cfg))
rf.save_midi = lambda cfg, dev=rf.DEFAULT_DEV: _saved.__setitem__("midi", dict(cfg))
rf.save_pose = lambda cfg, dev=rf.DEFAULT_DEV: _saved.__setitem__("pose", dict(cfg))
rf.save_power = lambda cfg, dev=rf.DEFAULT_DEV: _saved.__setitem__("power", dict(cfg))
rf.load_mouse = lambda dev=rf.DEFAULT_DEV: {}
rf.load_midi = lambda dev=rf.DEFAULT_DEV: {}
rf.load_pose = lambda dev=rf.DEFAULT_DEV: {}
rf.load_rules_enabled = lambda dev=rf.DEFAULT_DEV: True

# A setup made by somebody who had every group ON, with settings worth loading.
SHARED = {
    "trigEnabled": True,
    "rules": [{"id": "r1", "label": "skok", "keySpec": "space",
               "source": {"kind": "filter", "metric": "tilt"}, "threshold": 30}],
    "mouse": {"enabled": True, "mode": "stick", "sensX": 0.09, "stickWhich": "right"},
    "midi": {"enabled": True, "oscEnabled": True, "midiChannel": 7, "oscPrefix": "/gra"},
    "power": {"idleMin": 9.0},
}

print("--- a shared setup must not arm anything ---------------------------")
d = FakeDevice()
d.trig.set_enabled(False)
d.mouse.set_config({"enabled": False})
d.midimap.set_config({"enabled": False, "oscEnabled": False})

res = rf.apply_setup(d, SHARED, d.bus, mode="advanced")

check("Mapping stayed off", d.trig.enabled is False)
check("Motion control stayed off", d.mouse.get_config()["enabled"] is False)
check("MIDI stayed off", d.midimap.get_config()["enabled"] is False)
check("OSC stayed off", d.midimap.get_config()["oscEnabled"] is False)
check("...even though the file asked for all four",
      sorted(res["switchesKept"]) == ["midi", "mouse", "osc", "rules"], res["switchesKept"])
# `switchesOn` = the subset a "switch on" button may act on: wanted ON by the file, OFF here.
# Same four in this scenario — the file wanted everything on and the rig had everything off.
check("switchesOn names the same four (file on, rig off)",
      sorted(res.get("switchesOn") or []) == ["midi", "mouse", "osc", "rules"], res.get("switchesOn"))
check("setup_wants_on reads the file alone",
      sorted(rf.setup_wants_on(SHARED)) == ["midi", "mouse", "osc", "rules"], rf.setup_wants_on(SHARED))
check("_kept_by_one carries only what may be switched on",
      rf._kept_by_one(d, res) == [{"dev": "d0", "name": "d0", "groups": res["switchesOn"]}], rf._kept_by_one(d, res))

print("--- ...while everything else IS loaded -----------------------------")
check("rules loaded", len(d.trig.snapshot_rules()) == 1 and d.trig.snapshot_rules()[0]["keySpec"] == "space")
check("motion settings loaded", d.mouse.get_config()["mode"] == "stick"
      and abs(d.mouse.get_config()["sensX"] - 0.09) < 1e-9
      and d.mouse.get_config()["stickWhich"] == "right")
check("MIDI settings loaded", d.midimap.get_config()["midiChannel"] == 7
      and d.midimap.get_config()["oscPrefix"] == "/gra")
check("power loaded", d.source.power.get("idleMin") == 9.0 if hasattr(d, "source") else True)
check("every group reported as applied",
      sorted(res["applied"]) == ["midi", "mouse", "power", "rules"], res["applied"])

print("--- the saved switch matches the live one, not the file ------------")
check("saved Mapping switch is the live one (off)", _saved.get("rules") is False, _saved.get("rules"))
check("saved motion switch is the live one (off)", _saved.get("mouse", {}).get("enabled") is False)
check("saved MIDI switch is the live one (off)", _saved.get("midi", {}).get("enabled") is False)

print("--- a setup cannot switch a running group OFF either ---------------")
d2 = FakeDevice()
d2.trig.set_enabled(True)
d2.mouse.set_config({"enabled": True})
d2.midimap.set_config({"enabled": True, "oscEnabled": True})
res2 = rf.apply_setup(d2, {"trigEnabled": False, "rules": [],
                           "mouse": {"enabled": False, "sensX": 0.05},
                           "midi": {"enabled": False, "oscEnabled": False}}, d2.bus, mode="advanced")
check("Mapping still on", d2.trig.enabled is True)
check("Motion control still on", d2.mouse.get_config()["enabled"] is True)
check("MIDI still on", d2.midimap.get_config()["enabled"] is True)
check("OSC still on", d2.midimap.get_config()["oscEnabled"] is True)
check("...and the settings around them still applied",
      abs(d2.mouse.get_config()["sensX"] - 0.05) < 1e-9)
check("all four reported as kept", sorted(res2["switchesKept"]) == ["midi", "mouse", "osc", "rules"],
      res2["switchesKept"])
# ...but NONE of them may be offered as "switch on": the file wanted them OFF. Before 2026-09-13 the
# panel's "Włącz teraz" note listed these too, telling the reader to switch on what was already on.
check("nothing to switch ON when the file wanted everything off", res2.get("switchesOn") == [], res2.get("switchesOn"))
check("...so the per-capsule list for the panel is empty", rf._kept_by_one(d2, res2) == [], rf._kept_by_one(d2, res2))
check("setup_wants_on of an all-off file is empty",
      rf.setup_wants_on({"trigEnabled": False, "mouse": {"enabled": False}, "midi": {}}) == [])

print("--- half on, half off: only the off half is offered ----------------")
d4 = FakeDevice()
d4.trig.set_enabled(True)                       # Mapping already on here
d4.mouse.set_config({"enabled": False})         # motion off here
d4.midimap.set_config({"enabled": False, "oscEnabled": True})
res4 = rf.apply_setup(d4, SHARED, d4.bus, mode="advanced")
check("kept = the two the file disagreed with (mouse, midi)",
      sorted(res4["switchesKept"]) == ["midi", "mouse"], res4["switchesKept"])
check("switchesOn = the same two, because the file wanted them on",
      sorted(res4["switchesOn"]) == ["midi", "mouse"], res4["switchesOn"])
check("Mapping and OSC untouched (already on)", d4.trig.enabled is True and d4.midimap.get_config()["oscEnabled"] is True)

print("--- safe mode still drops risky rules ------------------------------")
d3 = FakeDevice()
res3 = rf.apply_setup(d3, {"rules": [
    {"id": "ok", "keySpec": "space", "source": {"kind": "filter", "metric": "tilt"}},
    {"id": "bad", "keySpec": "cmd+r", "source": {"kind": "filter", "metric": "tilt"}},
]}, d3.bus, mode="safe")
check("the Windows-key rule was dropped", res3["droppedRisky"] == 1 and len(d3.trig.snapshot_rules()) == 1,
      res3)

print()
print("OK" if not _failed else "FAILED", "- %d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
