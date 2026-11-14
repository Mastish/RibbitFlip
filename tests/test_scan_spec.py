# Contract test: `scan:` SPECS — the scanner's signals inside a mapping.
# Run: py tests/test_scan_spec.py
#
# A scanner signal is not output. It presses nothing: it is an answer given TO the app ("now",
# "step back", "stop"), exactly like a `layer:` action. Everything below follows from that one
# sentence, and every line of it was broken until 2026-09-13 because the safety classifier had a
# branch for `layer:` and none for `scan:`:
#
# 1. SAFE, NOT RISKY. `scan:sygnal` fell through to the generic branch and came back as "nietypowy
#    /nieznany klawisz". Safe mode DROPS risky rules — so a set built for somebody who drives the
#    computer with one signal arrived with its one signal removed, and the preview shown before
#    importing a shared set greeted them with a warning about an unknown key. This is the test
#    that keeps it safe.
#
# 2. A TYPO IS STILL RISKY. `scan:sygnał` (or any word the module does not know) has to stay
#    risky: it would sit in somebody's set looking like the way to stop a scanner and do nothing.
#
# 3. THE DESCRIPTION IS WHAT A PERSON READS. The line under a rule in the import preview said
#    "klawisz scan:sygnal", which tells the reader nothing about what they are agreeing to.
#
# 4. `scan:stop` PASSES THE GATE WITH THE MODULE SWITCHED OFF. The way out must not depend on the
#    thing it is getting out of.
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


class Bus:
    def now(self):
        return 0.0

    def publish(self, ev):
        pass


# --- 1. classification ------------------------------------------------------
for sig in rf.SCAN_SIGNALS:
    lvl, why = rf._classify_spec("scan:" + sig)
    check("scan:%s is classified safe" % sig, lvl == "safe", why)

check("upper case and spaces survive", rf._classify_spec("  SCAN:Sygnal ")[0] == "safe")

lvl, why = rf._classify_spec("scan:sygnał")
check("a misspelt signal stays risky", lvl == "risky", (lvl, why))
check("...and the reason names the allowed ones", "scan:stop" in why, why)

# --- 2. what it means for a whole rule --------------------------------------
rule = {"id": "s1", "label": "Sygnał", "enabled": True,
        "source": {"kind": "button", "any": True}, "keySpec": "scan:sygnal"}
info = rf._classify_rule(rule)
check("a scanner rule is a safe rule", info["level"] == "safe", info)
check("the description says what it does, not which key it presses",
      "sygnał skanera" in info["desc"], info["desc"])

stop = dict(rule, id="s2", label="Stop", keySpec="scan:stop")
check("scan:stop reads as stopping the scanner",
      "zatrzymaj" in rf._classify_rule(stop)["desc"], rf._classify_rule(stop)["desc"])
check("a misspelt signal is described as one, not as a key",
      "nieprawidłowy sygnał" in rf._describe_rule(dict(rule, keySpec="scan:bzdura")),
      rf._describe_rule(dict(rule, keySpec="scan:bzdura")))

# --- 3. the consequence: safe mode keeps the scheme --------------------------
cfg = {"rules": [rule, stop,
                 {"id": "m1", "label": "Makro", "source": {"kind": "button", "any": True},
                  "sequence": "a; wait 100; b"}]}
an = rf.analyze_config(cfg)
check("only the macro counts as risky", an["riskyCount"] == 1, an)
kept = [r for r in cfg["rules"] if rf._classify_rule(r)["level"] == "safe"]
check("safe mode keeps both scanner rules", [r["id"] for r in kept] == ["s1", "s2"], kept)

# --- 4. the gate ------------------------------------------------------------
eng = rf.TriggerEngine(Bus(), emitter=None, armed=True)
eng.enabled = False                      # the Mapping group is OFF
eng.scan_on = lambda: False              # ...and so is the Skaner module
check("scan:stop goes through with everything switched off", eng._gate_for("scan:stop") is True)
check("scan:sygnal does not - it answers the Skaner switch",
      eng._gate_for("scan:sygnal") is False)
eng.scan_on = lambda: True
check("...and goes through once the Skaner module is on",
      eng._gate_for("scan:sygnal") is True)
check("a key still answers the Mapping group", eng._gate_for("space") is False)

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
