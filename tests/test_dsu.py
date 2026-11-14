# Test of the MOTION SERVER for emulators (cemuhook / DSU). Run: py tests/test_dsu.py
#
# This is the output with the least room for "looks right": it is a binary protocol read by
# somebody else's program, so a field one byte off, a length that counts the wrong header or a
# CRC over the wrong bytes all produce the same symptom — Dolphin lists no controller and says
# nothing about why. So the test speaks the protocol back at the server over a REAL socket:
# it sends the same three requests a client sends and parses the answers byte by byte.
#
# Nothing here touches hardware or the system: a UDP socket on the loopback, and floats that
# were put in by hand. The server is not a system output at all — it answers a question when
# asked, and sends nothing to anybody who did not subscribe.
import os
import socket
import struct
import sys
import time
import zlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402

_passed = 0
_failed = 0
_skipped = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + detail) if detail else ""))


def skip(name, why):
    global _skipped
    _skipped += 1
    print("SKIP  %s  (%s)" % (name, why))


S = rf.DsuServer


# ============================== 1. FRAMING ==============================
# The numbers every implementation quotes: a version answer is 22 bytes, a data packet is 100,
# and the length field counts from after the 16-byte header (so it INCLUDES the message type).
def crc_ok(pkt):
    said = struct.unpack_from("<I", pkt, 8)[0]
    return said == (zlib.crc32(pkt[:8] + b"\x00\x00\x00\x00" + pkt[12:]) & 0xFFFFFFFF)


v = S._frame(S.MSG_VERSION, struct.pack("<H", S.PROTOCOL), 0xABCD1234)
check("server packets are marked DSUS", v[0:4] == b"DSUS")
check("protocol version on the wire is 1001", struct.unpack_from("<H", v, 4)[0] == 1001)
check("version answer is 22 bytes", len(v) == 22, "%d" % len(v))
check("length field counts everything after the 16-byte header",
      struct.unpack_from("<H", v, 6)[0] == len(v) - 16)
check("CRC is computed over the whole packet with the field zeroed", crc_ok(v))
check("sender id travels unchanged", struct.unpack_from("<I", v, 12)[0] == 0xABCD1234)
check("message type is echoed back", struct.unpack_from("<I", v, 16)[0] == S.MSG_VERSION)

srv = S()
srv._slots[0] = dict(S.blank_slot(), gyro=(1.5, -2.5, 3.5), accel=(0.25, -1.0, 0.5),
                     ts_us=987654321, battery=5, b2=0x20)     # b2 0x20 = Cross/A held
d = srv._pkt_data(0)
check("a data packet is 100 bytes", len(d) == 100, "%d" % len(d))
check("...announced as 84", struct.unpack_from("<H", d, 6)[0] == 84)
check("...with a valid CRC", crc_ok(d))
P = 20                                    # payload starts after the header
check("slot number leads the controller header", d[P + 0] == 0)
check("state says connected", d[P + 1] == 2)
check("model says full gyro (both sensors)", d[P + 2] == 2)
check("connection says Bluetooth, which is what the capsule is", d[P + 3] == 2)
check("battery is passed through", d[P + 10] == 5)
check("the connected flag is set", d[P + 11] == 1)
check("sticks sit at centre, because there are none",
      tuple(d[P + 20:P + 24]) == (128, 128, 128, 128))
check("motion timestamp lands at offset 48", struct.unpack_from("<Q", d, P + 48)[0] == 987654321)
check("accelerometer lands at 56, in order X Y Z",
      struct.unpack_from("<fff", d, P + 56) == (0.25, -1.0, 0.5))
check("gyroscope lands at 68, in order pitch yaw roll",
      struct.unpack_from("<fff", d, P + 68) == (1.5, -2.5, 3.5))
# A held button has to appear in BOTH halves of the report: the bitfield and the analog copy.
# Clients read one or the other, never both, so filling in only one loses half the emulators.
check("a held button reaches the packet both ways", d[P + 17] == 0x20 and d[P + 30] == 255,
      "buttons2=%#x analogA=%d" % (d[P + 17], d[P + 30]))
srv._slots[0]["b2"] = 0
d2 = srv._pkt_data(0)
check("...and is absent when it is up", d2[P + 17] == 0 and d2[P + 30] == 0)
check("the packet counter moves", struct.unpack_from("<I", d2, P + 12)[0] >
      struct.unpack_from("<I", d, P + 12)[0])
check("a slot nobody fed produces no data packet", srv._pkt_data(3) is None)
check("...and reports itself disconnected in a ports answer",
      srv._pkt_ports(3)[P + 1] == 0)

# --- THE TOUCHPAD: a click in its own byte, a finger in its own record ---------------------
# Both were zero-filled padding until now, so nothing downstream would have noticed either being
# written into the wrong place. The click is byte 19; the two finger records are six bytes each
# at 36 and 42 — active, tracking id, then X and Y as little-endian u16.
srv._slots[0] = dict(S.blank_slot(), touch=1, tp1=1, tpid=7, tpx=1600, tpy=300)
d3 = srv._pkt_data(0)
check("the touchpad CLICK has a byte of its own, apart from the buttons",
      d3[P + 19] == 1 and d3[P + 16] == 0 and d3[P + 17] == 0,
      "click=%d b1=%#x b2=%#x" % (d3[P + 19], d3[P + 16], d3[P + 17]))
check("the finger is announced as active, with its tracking id",
      d3[P + 36] == 1 and d3[P + 37] == 7, "%r" % list(d3[P + 36:P + 38]))
check("...and its position lands at 38 and 40 as u16, in the DualShock's own grid",
      (struct.unpack_from("<H", d3, P + 38)[0], struct.unpack_from("<H", d3, P + 40)[0])
      == (1600, 300))
check("the second finger's record stays empty — one capsule is one hand",
      tuple(d3[P + 42:P + 48]) == (0,) * 6, "%r" % list(d3[P + 42:P + 48]))
srv._slots[0].update(touch=0, tp1=0)
d4 = srv._pkt_data(0)
check("lifting the finger clears the active flag but leaves it where it was",
      d4[P + 36] == 0 and struct.unpack_from("<H", d4, P + 38)[0] == 1600)
check("...and the click goes back up with it", d4[P + 19] == 0)


# ============================== 2. THE UNITS ==============================
# The one thing an emulator cannot work around. It integrates degrees per second into an angle
# and reads the accelerometer as gravity, so a wrong scale is a console that turns too slowly
# and a Wii Remote that thinks it is tilted.
check("the accelerometer scale is the measured one (2048 LSB = 1 g)", S.ACC_LSB_PER_G == 2048.0)
check("the gyro scale is the LSM6DSL figure, not the inherited MPU-6050 one",
      abs(S.GYRO_LSB_PER_DPS - 114.29) < 0.01 and S.GYRO_LSB_PER_DPS != 131.0,
      "%r" % S.GYRO_LSB_PER_DPS)


class FakeGp:
    """A controller-shaped sink. Motion now travels to whatever the capsule is plugged into, so
    the pipeline hands it to `airmouse.gp` — the same attribute a real pad hangs off."""
    motion = True

    def __init__(self):
        self.last = None

    def set_imu(self, gyro_dps, accel_g, src=None):
        self.last = {"gyro": gyro_dps, "accel": accel_g, "src": src}


class FakeAir:
    """Output surface present and the Controller module on: the motion gate is open (no trig =
    nothing disarms it). Pipeline._motion_gate closes for --no-keys and a switched-off module."""
    emitter = object()

    def __init__(self, gp):
        self.gp = gp

    def pad_output_on(self):
        return True


gp = FakeGp()
pipe = rf.Pipeline(None, airmouse=FakeAir(gp), dev_id="d2")
# Channels in the capsule's own order: 0-2 gyro, 3-5 accel (POSE_CAL_DEFAULT, confirmed
# independently against the frame layout). One g and one deg/s per axis, so the conversion
# is readable straight off the result.
pipe._feed_motion([114.29, 228.58, 342.87, 2048.0, 4096.0, -2048.0])
got = gp.last
check("the motion is stamped with the capsule it came from", got["src"] == "d2")
check("2048 LSB reads as exactly 1 g",
      abs(got["accel"][2] - 1.0) < 1e-6, "%r" % (got["accel"],))
check("the accelerometer arrives in the DualShock frame (X=left/right, Y=the face, Z=front/back)",
      [round(v, 4) for v in got["accel"]] == [2.0, -1.0, 1.0], "%r" % (got["accel"],))
check("114.29 LSB reads as exactly 1 deg/s",
      abs(got["gyro"][2] - 1.0) < 1e-4, "%r" % (got["gyro"],))
check("the gyro arrives as pitch, yaw, roll about those same axes",
      [round(v, 2) for v in got["gyro"]] == [2.0, 3.0, 1.0], "%r" % (got["gyro"],))
# A controller that carries no motion must not be fed at all — that is what keeps an ordinary
# Xbox pad free of a per-sample call it would only throw away.
gp.motion = False
gp.last = None
pipe._feed_motion([1000.0, 0, 0, 0, 0, 2048.0])
check("a controller without motion is not fed", gp.last is None)


# ============================== 3. A REAL CLIENT ==============================
# Everything above proves the bytes. This proves the socket: the same three requests Dolphin
# sends, over UDP, against a running server.
def free_port():
    for p in range(27760, 27790):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.bind(("127.0.0.1", p))
            return p
        except OSError:
            continue
        finally:
            s.close()
    return None


def client_pkt(msg_type, payload=b""):
    body = struct.pack("<I", msg_type) + payload
    head = (b"DSUC" + struct.pack("<HH", S.PROTOCOL, len(body)) +
            b"\x00\x00\x00\x00" + struct.pack("<I", 0x0BADF00D))
    pkt = head + body
    return pkt[:8] + struct.pack("<I", zlib.crc32(pkt) & 0xFFFFFFFF) + pkt[12:]


port = free_port()
if port is None:
    skip("live socket", "no free UDP port in 27760-27789")
else:
    live = S(port=port)
    if not live.start():
        skip("live socket", "could not bind 127.0.0.1:%d (%s)" % (port, live.last_err))
    else:
        try:
            c = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            c.settimeout(2.0)
            addr = ("127.0.0.1", port)

            c.sendto(client_pkt(S.MSG_VERSION), addr)
            r, _ = c.recvfrom(2048)
            check("a version request is answered",
                  r[0:4] == b"DSUS" and struct.unpack_from("<I", r, 16)[0] == S.MSG_VERSION)
            check("...with the version, and a CRC that checks out",
                  struct.unpack_from("<H", r, 20)[0] == 1001 and crc_ok(r))

            # "How many controllers have you got?" — asked for all four slots at once.
            c.sendto(client_pkt(S.MSG_PORTS, struct.pack("<i", 4) + bytes((0, 1, 2, 3))), addr)
            seen = []
            for _ in range(4):
                r, _ = c.recvfrom(2048)
                seen.append((r[20], r[21]))
            check("every slot asked about is answered for", sorted(s for s, _ in seen) == [0, 1, 2, 3],
                  "%r" % seen)
            check("...and all four say disconnected while no capsule has fed them",
                  all(st == 0 for _, st in seen), "%r" % seen)

            # Subscribe, then hand the server a sample and expect it on the wire.
            c.sendto(client_pkt(S.MSG_DATA, bytes((0, 0)) + b"\x00" * 6), addr)
            time.sleep(0.15)
            check("the data request is remembered as a subscription", live.status()["clients"] == 1,
                  "%r" % live.status())
            live.feed(0, gyro_dps=(10.0, 20.0, 30.0), accel_g=(0.0, 1.0, 0.0),
                      ts_us=42, button=False)
            r, _ = c.recvfrom(2048)
            check("a fed sample reaches a subscribed client", len(r) == 100 and crc_ok(r))
            check("...carrying the very numbers it was given",
                  struct.unpack_from("<fff", r, 20 + 56) == (0.0, 1.0, 0.0) and
                  struct.unpack_from("<fff", r, 20 + 68) == (10.0, 20.0, 30.0))
            check("...and the slot now reports itself connected", r[20 + 1] == 2)

            # A slot outside the protocol's four is dropped rather than wrapped onto another one.
            before = live.sent
            live.feed(9, gyro_dps=(1, 1, 1), accel_g=(0, 0, 0), ts_us=1)
            check("a slot past the protocol's four is dropped", live.sent == before)

            # There is no disconnect message in this protocol, so a client that stops asking has
            # to stop being sent to — otherwise the server sprays a dead address forever.
            live.CLIENT_TIMEOUT = 0.2
            time.sleep(0.35)
            before = live.sent
            live.feed(0, gyro_dps=(1, 1, 1), accel_g=(0, 0, 0), ts_us=2)
            check("a client that went quiet stops being sent to", live.sent == before,
                  "sent %d -> %d" % (before, live.sent))

            # Junk must not take the server down: it is a socket anyone on the machine can write to.
            c.sendto(b"nonsense", addr)
            c.sendto(b"DSUC" + b"\x00" * 40, addr)
            time.sleep(0.15)
            check("nonsense on the socket does not stop the server", live.running)
            c.close()
        finally:
            live.stop()
        check("stopping gives the port back", not live.running)
        again = S(port=port)
        check("...so it can be bound again", again.start())
        again.stop()


# ===================== 3b. THE WII CONTROLLER AS A PAD =====================
# The point of the whole restructure: from the app's side this is the third kind of controller,
# and the SAME mappings have to work on it. If `pad:a` means something different here than on an
# Xbox pad, then it is not a third kind of controller, it is a second vocabulary.
class SinkServer:
    """A DsuServer-shaped sink: records slot state, opens no socket."""
    running = True

    def __init__(self):
        self.slots = {}
        self.motion = None

    def set_inputs(self, slot, **f):
        self.slots.setdefault(slot, S.blank_slot()).update(f)

    def feed(self, slot, gyro_dps, accel_g, ts_us, **_k):
        self.motion = (slot, tuple(gyro_dps), tuple(accel_g))


sink = SinkServer()
wii = rf.DsuPad(sink, 1)
check("a Wii controller reports itself as its own kind", wii.kind == "wii")
check("...and carries motion by definition, with no tick-box to forget",
      wii.motion is True and wii.set_motion(False) is False)
check("it speaks the same button names as a pad",
      wii.pad_name("pad:cross") == "a" and wii.pad_name("pad:l1") == "lb")

wii.press("pad:a")
check("`pad:a` presses Cross on the wire", sink.slots[1]["b2"] & 0x20 == 0x20,
      "%#x" % sink.slots[1]["b2"])
wii.release("pad:a")
check("...and lets go", sink.slots[1]["b2"] == 0)
wii.press("pad:start")
check("`pad:start` is Options", sink.slots[1]["b1"] & 0x08 == 0x08)
wii.release("pad:start")
wii.press("pad:back")
check("`pad:back` is Share", sink.slots[1]["b1"] & 0x01 == 0x01)
wii.release("pad:back")
wii.press("pad:guide")
check("`pad:guide` is the HOME byte, not a button bit",
      sink.slots[1]["home"] == 1 and sink.slots[1]["b1"] == 0 and sink.slots[1]["b2"] == 0)
wii.release("pad:guide")
wii.press("pad:rt")
check("a trigger is pressed analog AND digital, like a real pad",
      sink.slots[1]["rt"] == 255 and sink.slots[1]["b2"] & 0x02 == 0x02)
wii.release("pad:rt")
check("...and released both ways", sink.slots[1]["rt"] == 0 and sink.slots[1]["b2"] == 0)

wii.set_dpad(True, False, False, True)
check("the d-pad throws two independent bits (no hat here)",
      sink.slots[1]["b1"] == (0x10 | 0x20), "%#x" % sink.slots[1]["b1"])
wii.set_dpad(False, False, False, False)
check("...and clears them", sink.slots[1]["b1"] == 0)

wii.set_stick("left", 0.0, 1.0)
check("the stick's up is up (DSU's bytes grow upwards, so nothing flips)",
      sink.slots[1]["ly"] == 255 and sink.slots[1]["lx"] == 128,
      "%r" % [sink.slots[1]["lx"], sink.slots[1]["ly"]])
wii.set_stick("right", -1.0, 0.0)
check("...and the right stick is its own", sink.slots[1]["rx"] == 1)

# The touchpad, both halves. The DSU protocol describes a DualShock-shaped device, so a Wii
# controller has one for the same reason it has two sticks: it is what the emulator is offered.
wii.press("pad:touchpad")
check("the touchpad click is its own byte here too, not a button bit",
      sink.slots[1]["touch"] == 1 and sink.slots[1]["b1"] == 0 and sink.slots[1]["b2"] == 0)
wii.release("pad:touchpad")
check("...and comes back up", sink.slots[1]["touch"] == 0)
check("a Wii controller says it has a touchpad", wii.supports_touch() is True)
wii.set_touch(0.5, 0.5)
GE_ = rf.GamepadEmitter
check("a finger lands on the SAME grid as on the DualShock — one surface, one unit",
      (sink.slots[1]["tp1"], sink.slots[1]["tpx"], sink.slots[1]["tpy"])
      == (1, round(0.5 * (GE_.TOUCH_W - 1)), round(0.5 * (GE_.TOUCH_H - 1))),
      "%r" % [sink.slots[1]["tp1"], sink.slots[1]["tpx"], sink.slots[1]["tpy"]])
_id1 = sink.slots[1]["tpid"]
wii.set_touch(0, 0, on=False)
check("lifting it clears the flag and leaves the position alone",
      sink.slots[1]["tp1"] == 0 and sink.slots[1]["tpx"] == round(0.5 * (GE_.TOUCH_W - 1)))
wii.set_touch(0.1, 0.9)
check("...and putting it back down is a new finger", sink.slots[1]["tpid"] != _id1)
wii.set_touch(-5.0, 5.0)
check("a value off the surface is clamped onto it",
      (sink.slots[1]["tpx"], sink.slots[1]["tpy"]) == (0, GE_.TOUCH_H - 1),
      "%r" % [sink.slots[1]["tpx"], sink.slots[1]["tpy"]])
wii.reset()
check("reset takes the finger off the glass and un-clicks it",
      sink.slots[1]["tp1"] == 0 and sink.slots[1]["touch"] == 0)

# Every button a mapping can name must reach something here too — the check that would catch a
# Wii controller quietly missing a button the other two have.
dead = []
for b_ in rf.GamepadEmitter.PAD_BUTTONS + rf.GamepadEmitter.PAD_TRIGGERS:
    before = dict(sink.slots[1])
    wii.press("pad:" + b_)
    if sink.slots[1] == before:
        dead.append(b_)
    wii.release("pad:" + b_)
check("every mappable button does something on a Wii controller too", not dead, "%s" % dead)

# Two capsules on one Wii controller: one slot has ONE motion channel, so the owner decides.
wii.motion_owner = "d0"
wii.set_imu((1.0, 2.0, 3.0), (0.0, 1.0, 0.0), src="d0")
check("the motion owner's tilt goes out", sink.motion is not None and sink.motion[0] == 1)
sink.motion = None
wii.set_imu((9.0, 9.0, 9.0), (0.0, 0.0, 1.0), src="d1")
check("...and a second capsule on the same controller does not fight it for the gyroscope",
      sink.motion is None)
wii.reset()
check("reset lets go of everything", sink.slots[1]["b1"] == 0 and sink.slots[1]["b2"] == 0
      and sink.slots[1]["lx"] == 128)

# It has to be shaped like the other pad, or re-plugging a capsule between the two kinds would
# need every caller downstream to know which one it is holding.
missing = [n for n in ("press", "release", "tap", "set_stick", "set_dpad", "set_imu", "reset",
                       "active", "supports_motion", "kind", "motion")
           if not hasattr(wii, n) or not hasattr(rf.GamepadEmitter("ds4"), n)]
check("a Wii controller is shaped exactly like a pad", not missing, "%s" % missing)


# ===================== 3c. THE ONE ERROR A PERSON EVER SEES =====================
# A failed bind is the only DsuServer error that reaches the screen, and it used to reach it as
# Python: "OSError: [WinError 10048] Tylko jedno użycie każdego adresu gniazda…" printed as the
# controller's STATE. 10048 is not a fault at all — it is what a second DSU server (or a second
# copy of this app) looks like — so it has to arrive as a sentence with a way out in it.
# bind_error is a pure function precisely so this can be checked without a socket.
def _oserr(num, msg="boom", win=False):
    e = OSError(num, msg)
    if win:
        e.winerror = num
    return e


code, msg = S.bind_error(_oserr(10048, "Tylko jedno użycie każdego adresu gniazda", win=True), 26760)
check("a taken port is recognised by its Windows number", code == "busy", "%r" % code)
check("...and named, with the port in it", "26760" in msg and "zajęty" in msg, msg)
check("...and says what to do about it", "port" in msg.lower() and "Zamknij" in msg, msg)
check("...with no Python left in the sentence",
      "OSError" not in msg and "WinError" not in msg and "Traceback" not in msg, msg)
check("the same number is recognised from errno, not just winerror",
      S.bind_error(_oserr(10048, "x"), 26760)[0] == "busy")
check("...and so is the POSIX spelling of the same thing",
      S.bind_error(_oserr(98, "Address already in use"), 26760)[0] == "busy" and
      S.bind_error(_oserr(48, "Address already in use"), 26760)[0] == "busy")
c2, m2 = S.bind_error(_oserr(13, "Permission denied"), 27000)
check("any other OSError gets the general sentence", c2 == "bind", "%r" % c2)
check("...carrying the OS's own short reason and nothing more",
      m2 == "Nie udało się uruchomić serwera DSU: Permission denied", m2)
check("...and a nameless exception still produces one line",
      S.bind_error(ValueError(), 27000)[1] == "Nie udało się uruchomić serwera DSU: ValueError")
long_ = S.bind_error(OSError(1, "x" * 500), 27000)[1]
check("...never longer than a status line", len(long_) < 200, "%d" % len(long_))

# And the whole way through: bind a port, then let a second server fall over it, and read the
# status the dashboard reads.
_p = free_port()
if _p is None:
    skip("busy port end to end", "no free UDP port")
else:
    hold = S(port=_p)
    if not hold.start():
        skip("busy port end to end", "could not bind 127.0.0.1:%d" % _p)
    else:
        try:
            second = S(port=_p)
            ok = second.start()
            st = second.status()
            check("a second server on the same port refuses to start", ok is False)
            check("...and says so as a sentence, in the status the tile reads",
                  st.get("errorCode") == "busy" and "OSError" not in (st.get("error") or ""),
                  "%r" % st)
            check("...while still carrying the address to point an emulator at",
                  st.get("port") == _p, "%r" % st.get("port"))
        finally:
            hold.stop()
    check("a server that started clean carries no error at all",
          hold.status()["error"] == "" and hold.status()["errorCode"] == "")


# ============================== 4. THE SETTING ==============================
_orig = rf.DSU_FILE
rf.DSU_FILE = os.path.join(os.environ.get("TEMP") or "/tmp", "rf-dsu-test.json")
try:
    try:
        os.remove(rf.DSU_FILE)
    except Exception:
        pass
    d0 = rf.load_dsu()
    check("with no file the port is cemuhook's default",
          d0 == {"port": 26760}, "%r" % d0)
    rf.save_dsu({"port": 27000})
    check("the setting survives a round trip", rf.load_dsu() == {"port": 27000})
    rf.save_dsu({"port": 3})
    check("a nonsense port falls back to the default rather than failing to bind later",
          rf.load_dsu()["port"] == 26760)
finally:
    try:
        os.remove(rf.DSU_FILE)
    except Exception:
        pass
    rf.DSU_FILE = _orig


print("\n%d passed, %d failed, %d skipped" % (_passed, _failed, _skipped))
sys.exit(1 if _failed else 0)
