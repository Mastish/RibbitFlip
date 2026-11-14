# Contract test: the two "starting point" setups that ship inside the app (Presets/), and the
# library's handling of a BUNDLE living among the setups.
# Run: py tests/test_start_presets.py
#
# Why these need a test at all: a preset is a FILE, so every way it can rot is silent. A typo in a
# padShare slot loads fine and quietly makes two pads out of what promises to be one; a rule spec
# the pad does not know loads fine and presses nothing; and a bundle listed among the setups used
# to be offered a "Wczytaj" that applied NOTHING (apply_setup knows no `devices`) while reporting
# only a generic failure. The checks below pin every one of those.
#
# No HTTP, no DeviceManager, no disk writes: this file must never touch the owner's Settings/.
import json
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


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P2 = os.path.join(ROOT, "Presets", "Pad na dwa kapsle (start).json")
P1 = os.path.join(ROOT, "Presets", "Pad na jeden kapsel (start).json")


def load(p):
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


# --- the two files parse and carry the envelope a share needs -------------------------------
b2 = load(P2)
s1 = load(P1)
check("bundle file parses + kind", b2.get("kind") == "bundle" and b2.get("app") == "ribbitflip")
check("setup file parses + kind", s1.get("kind") == "setup" and s1.get("app") == "ribbitflip")
for env, nm in ((b2, "bundle"), (s1, "setup")):
    check("%s: name/description/forApp/author present" % nm,
          all(str(env.get(k) or "").strip() for k in ("name", "description", "forApp", "author")))

# --- the two-capsule bundle: one pad, two hands ---------------------------------------------
devs = b2.get("devices") or []
check("bundle has exactly 2 devices", len(devs) == 2, str(len(devs)))
d0 = next((d for d in devs if d.get("slot") == "d0"), None)
d1 = next((d for d in devs if d.get("slot") == "d1"), None)
check("slots d0+d1 present", bool(d0 and d1))
if d0 and d1:
    m0 = d0["setup"]["mouse"]
    m1 = d1["setup"]["mouse"]
    check("d0 owns its pad", m0.get("padShare") == "own", str(m0.get("padShare")))
    check("d1 plays on d0's pad", m1.get("padShare") == "d0", str(m1.get("padShare")))
    check("d0 = left stick on the gamepad",
          m0.get("mode") == "stick" and m0.get("stickWhich") == "left"
          and m0.get("stickBackend") == "gamepad")
    check("d1 = right stick on the gamepad",
          m1.get("mode") == "stick" and m1.get("stickWhich") == "right"
          and m1.get("stickBackend") == "gamepad")
    check("both roles named for the import dialog",
          all(str((d.get("role") or {}).get("name") or "").strip() for d in (d0, d1)))
    # The camera hand is deliberately less sensitive than the movement hand — a starting point
    # that spins the camera at the movement hand's rate is a starting point people delete.
    check("camera hand gentler than movement hand",
          float(m1.get("stickFilterScale") or 0) > float(m0.get("stickFilterScale") or 0))

# --- every rule is safe and presses a button this pad actually has --------------------------
def rules_of(env):
    if env.get("kind") == "bundle":
        for dv in env.get("devices") or []:
            for r in (dv.get("setup") or {}).get("rules") or []:
                yield r
    else:
        for r in (env.get("config") or {}).get("rules") or []:
            yield r


for env, nm in ((b2, "bundle"), (s1, "setup")):
    rules = list(rules_of(env))
    check("%s: has at least one rule" % nm, len(rules) >= 1)
    for r in rules:
        cls = rf._classify_rule(r)
        check("%s: rule '%s' classifies safe" % (nm, r.get("id")),
              cls.get("level") == "safe", str(cls.get("reasons")))
        spec = str(r.get("keySpec") or "")
        check("%s: spec '%s' is a real pad button" % (nm, spec),
              spec.startswith("pad:") and bool(rf.GamepadEmitter.pad_name(spec[4:])))
        # A pad is POLLED, so a tap can fall between two polls; a hold with a floor survives it
        # (see the 2026-08-23 note at GamepadEmitter). A starting point must not teach the trap.
        check("%s: rule '%s' holds, not taps" % (nm, r.get("id")),
              r.get("behavior") == "hold" and int((r.get("source") or {}).get("holdMs") or 0) >= 60)

# --- the version check understands a bundle envelope ----------------------------------------
cmp2 = rf.setup_compat(b2)
check("setup_compat(bundle): nothing 'unknown'", cmp2.get("unknownGroups") == [],
      str(cmp2.get("unknownGroups")))
cmp1 = rf.setup_compat(s1)
check("setup_compat(setup): nothing 'unknown'", cmp1.get("unknownGroups") == [],
      str(cmp1.get("unknownGroups")))

# --- the library marks the bundle so the front can route it through the role dialog ---------
it2 = rf._library_entry("setup", rf.BUILTIN_SETUPS_DIR, "Pad na dwa kapsle (start)", official=True)
check("library entry: bundle flag + device count",
      it2.get("bundle") is True and it2.get("deviceCount") == 2, json.dumps(it2, default=str)[:200])
check("library entry: groups union says rules+mouse",
      set(it2.get("groups") or []) == {"rules", "trigEnabled", "mouse"}, str(it2.get("groups")))
check("library entry: rules counted across devices", it2.get("rules") == 2, str(it2.get("rules")))
it1 = rf._library_entry("setup", rf.BUILTIN_SETUPS_DIR, "Pad na jeden kapsel (start)", official=True)
check("library entry: plain setup has no bundle flag", "bundle" not in it1)

# --- the built-ins are actually listed --------------------------------------------------------
names = rf.list_builtin_setups()
check("both starting points ship in Presets/",
      "Pad na dwa kapsle (start)" in names and "Pad na jeden kapsel (start)" in names, str(names))

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
