# Contract test: VIRTUAL CONTROLLERS — the pad registry and who is plugged into what.
# Run: py tests/test_padshare.py
#
# A controller used to be a capsule's property: capsule 2 could be told to "play on the pad of"
# capsule 1. It is an object of its own now — created, named, removed — and capsules plug into it
# (mouse.padShare holds a pad id). What that has to keep doing, silently, forever:
#
#   * two players = two pads, one player with two capsules = both capsules on ONE pad, and the
#     wiring reaching BOTH consumers (the `pad:` mappings through SlotOutput and the stick/d-pad
#     through AirMouse) — get that wrong and the game reads the stick from one controller and never
#     sees the button pressed on the other, which looks like "the mapping is broken";
#   * the pre-pads vocabulary still loads. Every set exported before this change says "own" or a
#     capsule id, and the shipped two-capsule preset says BOTH. Those are translated against the
#     capsule's HOME pad, so a set applied capsule by capsule lands the same way whichever capsule
#     the applier reaches first — the failure that would otherwise split a pair silently;
#   * the ceiling (four — Windows shows a game no more) and the floor (the last controller cannot
#     be removed, or a capsule would have nowhere to plug in).
#
# No HTTP, no disk: DeviceManager is driven directly with a stub key emitter and the settings
# loaders/savers are stubbed out, so nothing here can press a key, create a real controller or
# touch the user's own configuration.
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


class Keys:
    """Stands in for the keyboard/mouse emitter: records, presses nothing."""

    def __init__(self):
        self.taps = []

    def tap(self, spec):
        self.taps.append(spec)

    def down(self, spec):
        pass

    def up(self, spec):
        pass


class Bus:
    def now(self):
        return 0.0

    def publish(self, ev):
        pass


class Args:
    simulate = True          # every output group starts off — this test never sends anything
    enable_skip = False
    name = "Triki"
    debug = False
    no_keys = True
    devices = 2


# --- the disk, stubbed. The registry and every mouse config live in memory for the run ---
_FILES = {}
rf.load_pads = lambda: dict(_FILES.get("pads", {}))
rf.save_pads = lambda payload: _FILES.__setitem__("pads", payload)
rf.load_mouse = lambda dev=rf.DEFAULT_DEV: dict(_FILES.get("mouse:" + dev, {}))
rf.save_mouse = lambda cfg, dev=rf.DEFAULT_DEV: _FILES.__setitem__("mouse:" + dev, dict(cfg))


def manager(n=2, keep_registry=False):
    if not keep_registry:
        _FILES.clear()
    dm = rf.DeviceManager.__new__(rf.DeviceManager)      # no BLE, no threads, no files
    dm.b = Bus()
    dm.args = Args()
    dm.key_emitter = Keys()
    dm.midi_emitter = None
    dm.osc_emitter = None
    dm.dsu = None                 # the motion server for emulators — no socket in a test
    dm.count = n
    dm.master_armed = True
    dm.default_id = rf.DEFAULT_DEV
    dm.simulate = True
    dm.enable_skip = False
    dm.devices = {}
    dm.order = []
    dm.pads = None
    dm._pads_lock = rf.threading.RLock()
    dm._pad_last = {}
    dm._pad_home = {}
    for i in range(n):
        dm._make_device(rf.DEFAULT_DEV if i == 0 else "d%d" % i, None)
    dm.init_pads()
    return dm


def emitter(dm, pid):
    p = dm.pad_get(pid)
    return p.emitter if p else None


# --- 1. the starting picture: one controller per capsule --------------------------------------
dm = manager(2)
d0, d1 = dm.devices["d0"], dm.devices["d1"]
P = [p.id for p in dm.pads]
check("two capsules start on two controllers", len(P) == 2, str(P))
check("...and each one's buttons go to its own",
      d0.out.gp is emitter(dm, P[0]) and d1.out.gp is emitter(dm, P[1]))
check("...and its stick goes to the same one",
      d0.mouse.gp is emitter(dm, P[0]) and d1.mouse.gp is emitter(dm, P[1]))

# --- 2. one player, two hands: both capsules on ONE controller ---------------------------------
dm.pad_assign("d1", P[0])
check("the capsule is plugged into the controller it was told to",
      d1.mouse.get_config()["padShare"] == P[0], repr(d1.mouse.get_config().get("padShare")))
check("capsule 2's BUTTONS now go to controller 1", d1.out.gp is emitter(dm, P[0]))
check("capsule 2's STICK goes there too", d1.mouse.gp is emitter(dm, P[0]))
check("capsule 1 is untouched", d0.out.gp is emitter(dm, P[0]))
check("the registry says both capsules are on it",
      dm.pads_state()["pads"][0]["caps"] == ["d0", "d1"], str(dm.pads_state()["pads"][0]["caps"]))

# a `pad:` mapping really lands on that emitter, not merely a reference that looks right: drive it
# through SlotOutput, which is what the trigger engine calls
sent = []
emitter(dm, P[0]).tap = lambda spec: sent.append(("pad1", spec))
emitter(dm, P[1]).tap = lambda spec: sent.append(("pad2", spec))
d1.out.tap("pad:rt")
check("a button pressed on capsule 2 fires controller 1", sent == [("pad1", "pad:rt")], str(sent))
sent.clear()
d1.out.tap("space")          # a keyboard spec must still go to the keyboard
check("keyboard mappings are unaffected", sent == [] and dm.key_emitter.taps == ["space"],
      str(sent) + str(dm.key_emitter.taps))

# --- 3. making, naming and removing controllers ------------------------------------------------
r = dm.pad_create("Lewa ręka")
check("a new controller can be created", r.get("ok") and len(dm.pads) == 3, str(r.get("error")))
new_id = r.get("id")
check("...and it starts empty", dm.pads_state()["pads"][2]["caps"] == [],
      str(dm.pads_state()["pads"][2]))
check("...carrying the name it was given", dm.pad_get(new_id).name == "Lewa ręka")
dm.pad_rename(new_id, "Prawa ręka")
check("it can be renamed", dm.pad_get(new_id).name == "Prawa ręka")

while len(dm.pads) < rf.PAD_MAX:
    dm.pad_create()
r = dm.pad_create()
check("the fourth is the last one Windows would show",
      r.get("ok") is False and len(dm.pads) == rf.PAD_MAX, str(len(dm.pads)))

dm.pad_assign("d1", new_id)
r = dm.pad_delete(new_id)
check("removing a controller moves its capsules somewhere real",
      r.get("ok") and d1.mouse.get_config()["padShare"] == r.get("movedTo"),
      "%s -> %s" % (r.get("movedTo"), d1.mouse.get_config().get("padShare")))
check("...and re-wires them to that controller's emitter",
      d1.out.gp is emitter(dm, r.get("movedTo")) and d1.mouse.gp is emitter(dm, r.get("movedTo")))
while len(dm.pads) > 1:
    dm.pad_delete(dm.pads[-1].id)
r = dm.pad_delete(dm.pads[0].id)
check("the last controller cannot be removed", r.get("ok") is False and len(dm.pads) == 1,
      str(r.get("error")))

# --- 4. the pre-pads vocabulary, in BOTH application orders ------------------------------------
# "own" on one capsule and the other capsule's id on the second is how every two-capsule set
# written before this change says "one player, two hands" — including the one shipped in Presets/.
def apply_legacy(order):
    m = manager(2)
    vals = {"d0": "own", "d1": "d0"}
    for dev in order:
        m.devices[dev].mouse.set_config({"padShare": vals[dev]})
        m.rewire_pads()
    return m


for order in (["d0", "d1"], ["d1", "d0"]):
    m = apply_legacy(order)
    a, b = m.devices["d0"], m.devices["d1"]
    check("a pre-pads set lands both capsules on ONE controller (order %s)" % "/".join(order),
          a.mouse.get_config()["padShare"] == b.mouse.get_config()["padShare"]
          and a.out.gp is b.out.gp,
          "%s / %s" % (a.mouse.get_config().get("padShare"), b.mouse.get_config().get("padShare")))

# ...and the opposite set — two players — splits them again, whichever order it arrives in
for order in (["d0", "d1"], ["d1", "d0"]):
    m = apply_legacy(order)                      # start from the shared state
    for dev in order:
        m.devices[dev].mouse.set_config({"padShare": "own"})
        m.rewire_pads()
    a, b = m.devices["d0"], m.devices["d1"]
    check("...and a two-player set splits them again (order %s)" % "/".join(order),
          a.mouse.get_config()["padShare"] != b.mouse.get_config()["padShare"]
          and a.out.gp is not b.out.gp,
          "%s / %s" % (a.mouse.get_config().get("padShare"), b.mouse.get_config().get("padShare")))

# a set built on a machine with more controllers than this one has
m = manager(2)
seat = m.devices["d1"].mouse.get_config()["padShare"]
m.devices["d1"].mouse.set_config({"padShare": "p9"})
m.rewire_pads()
check("a controller that is not on this machine leaves the capsule where it was",
      m.devices["d1"].mouse.get_config()["padShare"] == seat,
      repr(m.devices["d1"].mouse.get_config().get("padShare")))

m.devices["d1"].mouse.set_config({"padShare": "nonsense"})
check("a typo is rejected by the sanitiser", m.devices["d1"].mouse.get_config()["padShare"] == "own",
      repr(m.devices["d1"].mouse.get_config().get("padShare")))
m.rewire_pads()
check("...and comes back as a real controller",
      rf._is_pad_id(m.devices["d1"].mouse.get_config()["padShare"]),
      repr(m.devices["d1"].mouse.get_config().get("padShare")))

# --- 5. a capsule going away must not leave anything pointing at nothing -----------------------
dm2 = manager(2)
a, b = dm2.devices["d0"], dm2.devices["d1"]
pid = a.mouse.get_config()["padShare"]
dm2.pad_assign("d1", pid)
check("shared before removal", b.out.gp is emitter(dm2, pid))
a.stop = lambda: None
a.release_outputs = lambda: None
dm2._persist_meta = lambda: None
dm2._remove_device(a)
check("after the other capsule is gone, this one still plays on the same controller",
      b.out.gp is emitter(dm2, pid) and b.mouse.get_config()["padShare"] == pid,
      repr(b.mouse.get_config().get("padShare")))

# --- 6. the setting still travels inside a Setup ----------------------------------------------
cfg = rf.build_setup(b)
check("the controller is carried by a saved setup", cfg["mouse"].get("padShare") == pid,
      repr(cfg["mouse"].get("padShare")))

# --- 7. the registry survives a restart --------------------------------------------------------
dm3 = manager(2)
dm3.pad_rename(dm3.pads[0].id, "Kanapa")
dm3.pad_assign("d1", dm3.pads[0].id)
dm4 = manager(2, keep_registry=True)             # same "files", fresh manager = a restart
check("a restart brings the controllers back", [p.name for p in dm4.pads][0] == "Kanapa",
      str([p.name for p in dm4.pads]))
check("...with the capsules still plugged into the same ones",
      dm4.devices["d0"].mouse.get_config()["padShare"]
      == dm4.devices["d1"].mouse.get_config()["padShare"] == dm4.pads[0].id,
      "%s / %s" % (dm4.devices["d0"].mouse.get_config().get("padShare"),
                   dm4.devices["d1"].mouse.get_config().get("padShare")))

print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
