# Test of the PAD TYPE — one controller, two devices it can be. Run: py tests/test_padkind.py
#
# ViGEmBus emulates a wired Xbox 360 pad and a wired DualShock 4, so those are the two the
# registry can hold. The interesting part is not that a DS4 can be created; it is that the
# SAME mapping has to come out meaning the same thing on both, and the two devices disagree
# about almost every detail of how to say it:
#
#   * the d-pad is four independent buttons on XInput and ONE hat on the DualShock,
#   * the sticks' Y axis grows upwards on XInput and DOWNWARDS on the DualShock,
#   * L2/R2 are analog AND digital on the DualShock, analog only on XInput,
#   * the PS button is not an ordinary button at all — it lives in its own byte.
#
# Every one of those is a place where "it looked right" ships a pad that steers backwards or
# a trigger half the games ignore. So the whole first half runs against a RECORDING STUB in
# place of the vgamepad device: the real enums (they are just numbers, and getting them wrong
# is exactly the bug worth catching), our real _ensure_pad building the real maps, and a fake
# device that writes down what it was told. No driver, no virtual controller plugged into
# anybody's Windows, no button pressed into whatever window happens to be focused.
#
# The second half creates a REAL DualShock target and unplugs it again, to prove the device
# ViGEmBus builds is the one we ask for. It presses nothing. Skipped (not failed) without
# vgamepad or the driver, because that is a machine fact and not a bug in this code.
import ctypes
import json
import os
import sys
import tempfile

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


GE = rf.GamepadEmitter


# ============================== 1. THE TYPE ITSELF ==============================
check("both devices ViGEmBus can build are offered", GE.KINDS == ("x360", "ds4"))
check("every type has a name a person recognises",
      all(GE.KIND_LABEL.get(k) for k in GE.KINDS))
check("type normalised", GE.kind_ok("ds4") == "ds4" and GE.kind_ok("  DS4 ") == "ds4")
# The one that matters: a settings file or a request naming a device we cannot build must not
# take somebody's controller away. It falls back to the pad every game understands.
check("unknown type falls back to the Xbox pad, never to nothing",
      [GE.kind_ok(v) for v in ("wiimote", "switch-pro", "", None, 7)] == ["x360"] * 5)
check("default is the Xbox pad", GE().kind == "x360")
check("type survives the constructor", GE("ds4").kind == "ds4")


# ============================== 2. THE RECORDING STUB ==============================
class FakePad:
    """Stands in for VX360Gamepad / VDS4Gamepad and remembers what it was told."""

    def __init__(self):
        self.buttons = 0          # ordinary buttons, as a bitfield
        self.special = 0          # DS4's own byte (PS)
        self.hat = None           # DS4 d-pad direction
        self.lx = self.ly = 0.0
        self.rx = self.ry = 0.0
        self.lt = self.rt = 0.0
        self.updates = 0
        self.resets = 0
        self.ex = None            # the last EXTENDED report, when one was sent

    def press_button(self, button):
        self.buttons |= int(button)

    def release_button(self, button):
        self.buttons &= ~int(button)

    def press_special_button(self, special_button):
        self.special |= int(special_button)

    def release_special_button(self, special_button):
        self.special &= ~int(special_button)

    def directional_pad(self, direction):
        self.hat = int(direction)

    def left_joystick_float(self, x_value_float, y_value_float):
        self.lx, self.ly = x_value_float, y_value_float

    def right_joystick_float(self, x_value_float, y_value_float):
        self.rx, self.ry = x_value_float, y_value_float

    def left_trigger_float(self, value_float):
        self.lt = value_float

    def right_trigger_float(self, value_float):
        self.rt = value_float

    def update(self):
        self.updates += 1
        self.ex = None

    def update_extended_report(self, ex):
        self.updates += 1
        self.ex = ex

    def reset(self):
        self.__init__()
        self.resets = 1

    class _Rep:
        pass

    @property
    def report(self):
        """What the real VDS4Gamepad keeps as `.report` — the extended path copies its eight
        ordinary fields, so the stub has to have them or it would be testing a shape nobody
        ships."""
        r = FakePad._Rep()
        r.bThumbLX = 128 + round(self.lx * 127)
        r.bThumbLY = 128 + round(self.ly * 127)
        r.bThumbRX = 128 + round(self.rx * 127)
        r.bThumbRY = 128 + round(self.ry * 127)
        r.wButtons = self.buttons | (self.hat or 0)
        r.bSpecial = self.special
        r.bTriggerL = round(self.lt * 255)
        r.bTriggerR = round(self.rt * 255)
        return r


# --- THE EXTENDED REPORT, AS ViGEm's HEADER DECLARES IT -----------------------------------
# Transcribed from ViGEm/Common.h, byte-packed exactly as the header packs it (pshpack1.h /
# poppack.h). This is the ORACLE: the app writes the report by offset, and these three classes
# are what says whether those offsets are the header's. Deliberately NOT imported from vgamepad,
# whose mirror of the same struct is unpacked — that is the bug being guarded against, so using
# it here would be marking one's own homework.
class _ExTouch(ctypes.Structure):
    _pack_ = 1
    _fields_ = [("bPacketCounter", ctypes.c_ubyte),
                ("bIsUpTrackingNum1", ctypes.c_ubyte),
                ("bTouchData1", ctypes.c_ubyte * 3),
                ("bIsUpTrackingNum2", ctypes.c_ubyte),
                ("bTouchData2", ctypes.c_ubyte * 3)]


class _ExSub(ctypes.Structure):
    _pack_ = 1
    _fields_ = [("bThumbLX", ctypes.c_ubyte), ("bThumbLY", ctypes.c_ubyte),
                ("bThumbRX", ctypes.c_ubyte), ("bThumbRY", ctypes.c_ubyte),
                ("wButtons", ctypes.c_ushort), ("bSpecial", ctypes.c_ubyte),
                ("bTriggerL", ctypes.c_ubyte), ("bTriggerR", ctypes.c_ubyte),
                ("wTimestamp", ctypes.c_ushort), ("bBatteryLvl", ctypes.c_ubyte),
                ("wGyroX", ctypes.c_short), ("wGyroY", ctypes.c_short), ("wGyroZ", ctypes.c_short),
                ("wAccelX", ctypes.c_short), ("wAccelY", ctypes.c_short), ("wAccelZ", ctypes.c_short),
                ("_bUnknown1", ctypes.c_ubyte * 5), ("bBatteryLvlSpecial", ctypes.c_ubyte),
                ("_bUnknown2", ctypes.c_ubyte * 2), ("bTouchPacketsN", ctypes.c_ubyte),
                ("sCurrentTouch", _ExTouch), ("sPreviousTouch", _ExTouch * 2)]


class _ExSpec(ctypes.Union):
    _pack_ = 1
    _fields_ = [("Report", _ExSub), ("ReportBuffer", ctypes.c_ubyte * 63)]


def _decode(ex):
    """The bytes the driver would read, seen through the header's own layout.

    Reading `ex.Report.wGyroX` directly would ask vgamepad's misaligned struct where the gyro is,
    which is the very thing under test — so the 63 bytes are copied out and re-read here."""
    spec = _ExSpec()
    ctypes.memmove(ctypes.byref(spec), bytes(ex.ReportBuffer[:63]), 63)
    return spec.Report


def _touch_xy(t):
    """The 12-bit X and Y out of a touch packet's three shared bytes."""
    d = t.bTouchData1
    return (d[0] | ((d[1] & 0x0F) << 8), ((d[1] & 0xF0) >> 4) | (d[2] << 4))


class FakeVg:
    """The vgamepad module with the REAL enums and a stub in place of the device."""

    def __init__(self, real):
        self.XUSB_BUTTON = real.XUSB_BUTTON
        self.DS4_BUTTONS = real.DS4_BUTTONS
        self.DS4_SPECIAL_BUTTONS = real.DS4_SPECIAL_BUTTONS
        self.DS4_DPAD_DIRECTIONS = real.DS4_DPAD_DIRECTIONS
        self.DS4_REPORT_EX = real.win.vigem_commons.DS4_REPORT_EX
        self.made = []

    def VX360Gamepad(self):
        p = FakePad()
        self.made.append("x360")
        return p

    def VDS4Gamepad(self):
        p = FakePad()
        self.made.append("ds4")
        return p


try:
    import vgamepad as _real_vg
    _enums_ok = all(hasattr(_real_vg, n) for n in
                    ("XUSB_BUTTON", "DS4_BUTTONS", "DS4_SPECIAL_BUTTONS", "DS4_DPAD_DIRECTIONS"))
except Exception:
    _real_vg, _enums_ok = None, False


def emitter(kind):
    """A live emitter of the given type wired to a stub device (no driver, no side effects)."""
    gp = GE(kind)
    gp._vg = FakeVg(_real_vg)
    gp._imp = True
    gp.TAP_MS = 1
    assert gp._ensure_pad(), "the stub device should always come up"
    return gp, gp._pad


if not _enums_ok:
    skip("mapping onto both devices", "vgamepad not importable — no enums to map onto")
else:
    D = _real_vg.DS4_DPAD_DIRECTIONS
    B4 = _real_vg.DS4_BUTTONS
    BX = _real_vg.XUSB_BUTTON

    # --- which device gets built ---
    gp, pad = emitter("ds4")
    check("a DualShock pad asks vgamepad for a DualShock", gp._vg.made == ["ds4"])
    gp2, _ = emitter("x360")
    check("an Xbox pad asks vgamepad for an Xbox pad", gp2._vg.made == ["x360"])

    # --- the sticks: same float in, same direction out ---
    gp, pad = emitter("x360")
    gp.set_stick("left", 0.0, 1.0)
    check("XInput stick up is up", pad.ly == 1.0)
    gp, pad = emitter("ds4")
    gp.set_stick("left", 0.0, 1.0)
    check("DualShock stick up is up (its byte grows downwards, so the sign flips)",
          pad.ly == -1.0, "ly=%r" % pad.ly)
    gp.set_stick("right", -0.5, -0.25)
    check("DualShock X axis is NOT flipped", pad.rx == -0.5, "rx=%r" % pad.rx)
    check("DualShock right stick down is down", pad.ry == 0.25, "ry=%r" % pad.ry)

    # --- the d-pad: four buttons vs one hat ---
    gp, pad = emitter("x360")
    gp.set_dpad(True, False, False, True)
    check("XInput d-pad presses two independent buttons",
          pad.buttons == (int(BX.XUSB_GAMEPAD_DPAD_UP) | int(BX.XUSB_GAMEPAD_DPAD_RIGHT)))
    gp.set_dpad(False, False, False, False)
    check("XInput d-pad releases them again", pad.buttons == 0)

    gp, pad = emitter("ds4")
    HAT = [((False, False, False, False), D.DS4_BUTTON_DPAD_NONE),
           ((True,  False, False, False), D.DS4_BUTTON_DPAD_NORTH),
           ((True,  False, False, True),  D.DS4_BUTTON_DPAD_NORTHEAST),
           ((False, False, False, True),  D.DS4_BUTTON_DPAD_EAST),
           ((False, True,  False, True),  D.DS4_BUTTON_DPAD_SOUTHEAST),
           ((False, True,  False, False), D.DS4_BUTTON_DPAD_SOUTH),
           ((False, True,  True,  False), D.DS4_BUTTON_DPAD_SOUTHWEST),
           ((False, False, True,  False), D.DS4_BUTTON_DPAD_WEST),
           ((True,  False, True,  False), D.DS4_BUTTON_DPAD_NORTHWEST)]
    bad = []
    for args, want in HAT:
        gp.set_dpad(*args)
        if pad.hat != int(want):
            bad.append("%s -> %s, wanted %s" % (args, pad.hat, int(want)))
    check("DualShock d-pad resolves all eight directions and neutral", not bad, "; ".join(bad))
    # A hat cannot be in two places, and neither can a thumb: opposites cancel rather than
    # picking whichever one was written last.
    gp.set_dpad(True, True, False, False)
    check("DualShock d-pad: up+down cancel instead of fighting",
          pad.hat == int(D.DS4_BUTTON_DPAD_NONE))

    # A mapping (`pad:up`) throws the same switch the motion d-pad throws. On XInput that is two
    # independent buttons and could never clash; on the DualShock both write ONE hat, so if they
    # did not share the state, whichever wrote last would erase the other.
    gp, pad = emitter("ds4")
    gp.set_dpad(False, False, True, False)      # motion: west
    gp.press("pad:up")                          # mapping: north, at the same time
    check("DualShock: a mapped direction combines with the motion d-pad",
          pad.hat == int(D.DS4_BUTTON_DPAD_NORTHWEST), "hat=%r" % pad.hat)
    gp.release("pad:up")
    check("...and letting it go leaves the other one held", pad.hat == int(D.DS4_BUTTON_DPAD_WEST))

    # --- the triggers: analog on both, digital as well on the DualShock ---
    gp, pad = emitter("x360")
    gp.press("pad:rt")
    check("XInput trigger is analog only", pad.rt == 1.0 and pad.buttons == 0)
    gp, pad = emitter("ds4")
    gp.press("pad:rt")
    check("DualShock trigger is pressed analog AND digital (a real one reports both)",
          pad.rt == 1.0 and pad.buttons == int(B4.DS4_BUTTON_TRIGGER_RIGHT),
          "rt=%r buttons=%r" % (pad.rt, pad.buttons))
    gp.release("pad:rt")
    check("...and released both ways", pad.rt == 0.0 and pad.buttons == 0)

    # --- the face buttons: one canonical name, the right bit on each device ---
    gp, pad = emitter("ds4")
    gp.press("pad:a")
    check("`pad:a` is Cross on a DualShock", pad.buttons == int(B4.DS4_BUTTON_CROSS))
    gp.release("pad:a")
    gp.press("pad:cross")
    check("...and so is `pad:cross`, the name printed on that pad",
          pad.buttons == int(B4.DS4_BUTTON_CROSS))
    gp.release("pad:cross")
    gp.press("pad:back")
    check("`pad:back` is Share", pad.buttons == int(B4.DS4_BUTTON_SHARE))
    gp.release("pad:back")
    gp.press("pad:start")
    check("`pad:start` is Options", pad.buttons == int(B4.DS4_BUTTON_OPTIONS))
    gp.release("pad:start")
    # The PS button is not in the button word at all — pressing it as one would silently do nothing.
    gp.press("pad:guide")
    check("`pad:guide` is PS, and PS lives in its own byte",
          pad.special == int(_real_vg.DS4_SPECIAL_BUTTONS.DS4_SPECIAL_BUTTON_PS) and pad.buttons == 0,
          "special=%r buttons=%r" % (pad.special, pad.buttons))
    gp.release("pad:guide")
    check("...and comes back up", pad.special == 0)

    # Every button a mapping can name has to reach SOMETHING on both devices. This is the test
    # that would have caught a DualShock quietly missing a button the Xbox pad has.
    for kind in GE.KINDS:
        gp, pad = emitter(kind)
        dead = []
        for b in GE.PAD_BUTTONS + GE.PAD_TRIGGERS:
            if not GE.has_button(b, kind):
                continue          # not on this device at all — checked on its own, below
            before = (pad.buttons, pad.special, pad.hat, pad.lt, pad.rt)
            try:
                gp.press("pad:" + b)
            except Exception as e:
                dead.append("%s raised %s" % (b, e.__class__.__name__))
                continue
            if (pad.buttons, pad.special, pad.hat, pad.lt, pad.rt) == before:
                dead.append("%s changed nothing" % b)
            gp.release("pad:" + b)
        check("every mappable button does something on %s" % GE.KIND_LABEL[kind],
              not dead, "; ".join(dead))

    # --- a button THIS device does not have ---
    # An Xbox 360 pad has no touchpad, and the two wrong answers are "press nothing" and "unknown
    # button". The first loses the mapping in silence; the second sends somebody hunting for a
    # typo in a name spelled perfectly right. So it raises, and the message names the device.
    gp, pad = emitter("x360")
    try:
        gp.press("pad:touchpad")
        check("the touchpad click is refused on an Xbox pad", False, "it was accepted")
    except ValueError as e:
        check("the touchpad click is refused on an Xbox pad", True)
        check("...and the message says which device, not 'unknown button'",
              "Xbox 360" in str(e) and "touchpad" in str(e), str(e))
    except Exception as e:
        check("the touchpad click is refused on an Xbox pad", False,
              "wrong exception: %s" % e.__class__.__name__)
    before = (pad.buttons, pad.special, pad.hat)
    gp.release("pad:touchpad")     # a hold can survive a type change: releasing must be a no-op
    check("...and releasing it is a quiet no-op rather than a crash",
          (pad.buttons, pad.special, pad.hat) == before)
    check("its aliases resolve to the same name",
          [GE.pad_name("pad:" + n) for n in ("tp", "touch", "touchpad", "TP-Click")]
          == ["touchpad"] * 4)

    # --- swapping the device under a live pad ---
    gp, pad = emitter("ds4")
    gp.press("pad:a")
    gp.set_dpad(True, False, False, False)
    changed = gp.set_kind("x360")
    check("switching the type reports that it changed", changed is True)
    check("...unplugs the old device", gp._pad is None and gp.active is False)
    check("...lets go of everything first (nothing stays held on a device that is gone)",
          pad.resets == 1 and pad.buttons == 0)
    check("...and forgets the d-pad it was holding",
          not any(gp._dp.values()), "%r" % gp._dp)
    check("switching to the same type is not a change", gp.set_kind("x360") is False)
    gp._vg = FakeVg(_real_vg)                  # the next use builds the NEW device
    gp.press("pad:a")
    check("the new device is the one that was asked for", gp._vg.made == ["x360"])
    check("...and it is usable straight away", gp._pad.buttons == int(BX.XUSB_GAMEPAD_A))
    # A pad whose creation failed used to stay dead forever, on purpose (no retry storms). A new
    # DEVICE is a new question, though — the driver may well have the other one.
    gp2 = GE("x360")
    gp2._pad_failed = True
    gp2.set_kind("ds4")
    check("a failed pad gets a fresh chance after a type change", gp2._pad_failed is False)


# ===================== 2b. THE GYROSCOPE (DualShock only) =====================
# The one capability the two pad types do NOT share. An Xbox 360 pad has no gyroscope and XInput
# has nowhere to put one, so the question is not "should we send it" but "can this pad carry it
# at all" — and the answer has to be the same whether it is asked by the interface, by a settings
# file or by a pad's constructor.
if _enums_ok:
    x = GE("x360")
    check("an Xbox pad says it cannot carry motion", x.supports_motion() is False)
    check("...and switching it on is refused rather than remembered",
          x.set_motion(True) is False and x.motion is False)
    ds = GE("ds4")
    check("a DualShock says it can", ds.supports_motion() is True)
    check("...and takes the switch", ds.set_motion(True) is True and ds.motion is True)
    check("switching it on twice is not a change", ds.set_motion(True) is False)
    # A pad built from a settings file that says motion on an Xbox pad must not come up with it on.
    check("a registry claiming motion on an Xbox pad is not believed",
          rf.VirtualPad("p1", "", "x360", True).motion is False)
    check("...and is on a DualShock", rf.VirtualPad("p1", "", "ds4", True).motion is True)

    # THE LAYOUT ITSELF, before anything is read out of it. The offsets the app writes to are a
    # table of numbers, and a table drifts; this pins it against the structure ViGEm's header
    # declares — byte-packed (pshpack1.h), which is the whole point, since the layout IS the wire
    # format. vgamepad ships an UNPACKED mirror of the same struct: 72 bytes where the driver
    # reads 63, every field from wTimestamp down one two-byte slot late, and no error anywhere
    # because the call takes a pointer. That is why the report is written by offset.
    check("the extended report is the 63 bytes the driver reads",
          ctypes.sizeof(_ExSpec) == 63 and GE.EX_LEN == 63, "%d" % ctypes.sizeof(_ExSpec))
    check("...and the app's offsets are the header's offsets",
          (GE.EX_TS, GE.EX_BATT, GE.EX_IMU, GE.EX_TOUCH_N, GE.EX_TOUCH)
          == (_ExSub.wTimestamp.offset, _ExSub.bBatteryLvl.offset, _ExSub.wGyroX.offset,
              _ExSub.bTouchPacketsN.offset, _ExSub.sCurrentTouch.offset),
          "app %r vs header %r" % ((GE.EX_TS, GE.EX_BATT, GE.EX_IMU, GE.EX_TOUCH_N, GE.EX_TOUCH),
                                   (_ExSub.wTimestamp.offset, _ExSub.bBatteryLvl.offset,
                                    _ExSub.wGyroX.offset, _ExSub.bTouchPacketsN.offset,
                                    _ExSub.sCurrentTouch.offset)))

    # The report itself. With motion off a DualShock sends the ordinary report; with it on, the
    # EXTENDED one — the same 63-byte shape a real DualShock sends, gyro and accelerometer included.
    gp, pad = emitter("ds4")
    gp.press("pad:a")
    check("with the gyroscope off, the ordinary report goes out", pad.ex is None)
    gp.set_motion(True)
    gp.set_imu(gyro_dps=(90.0, -45.0, 0.0), accel_g=(0.0, 1.0, 0.0))
    check("with it on, the extended report goes out instead", pad.ex is not None)
    r = _decode(pad.ex)
    check("...carrying the buttons that were already pressed",
          r.wButtons & int(B4.DS4_BUTTON_CROSS) == int(B4.DS4_BUTTON_CROSS),
          "wButtons=%#x" % r.wButtons)
    check("90 deg/s lands as the DualShock's own units (16.384 LSB per deg/s)",
          r.wGyroX == round(90.0 * GE.DS4_GYRO_LSB_PER_DPS), "%r" % r.wGyroX)
    check("...and keeps its sign", r.wGyroY == round(-45.0 * GE.DS4_GYRO_LSB_PER_DPS))
    check("1 g lands as 8192, which is what a DualShock reports for gravity",
          r.wAccelY == 8192, "%r" % r.wAccelY)
    check("the timestamp is filled in", r.wTimestamp != 0)
    # The capsule reaches ±16 g and a DualShock's report only ±4. Clamping matters more than it
    # sounds: a wrapped int16 reads as a violent shove in the OPPOSITE direction.
    gp.set_imu(gyro_dps=(0, 0, 0), accel_g=(8.0, 0.0, 0.0))
    check("an impact past the DualShock's range is clamped, never wrapped",
          _decode(pad.ex).wAccelX == 32767, "%r" % _decode(pad.ex).wAccelX)
    gp.set_motion(False)
    gp.press("pad:b")
    check("switching the gyroscope off goes back to the ordinary report", pad.ex is None)
    # An Xbox pad must never take the extended path, whatever it was fed beforehand.
    gp2, pad2 = emitter("ds4")
    gp2.set_motion(True)
    gp2.set_imu(gyro_dps=(10, 10, 10), accel_g=(0, 1, 0))
    gp2.set_kind("x360")
    check("changing type to a pad with no gyroscope switches motion off with it",
          gp2.motion is False)
    gp2._vg = FakeVg(_real_vg)
    gp2.press("pad:a")
    check("...and that pad then sends ordinary reports", gp2._pad.ex is None)


# ========================= 2b. THE TOUCHPAD =========================
# Two separate things that share a name, and keeping them apart is the point: the CLICK is an
# ordinary mapped button in its own byte, the SURFACE is a finger at a place. On a real pad you
# can rest a finger without clicking and click without sliding, and so can this.
def test_touchpad():
    if not _enums_ok:
        return skip("touchpad", "vgamepad not importable")
    S4 = _real_vg.DS4_SPECIAL_BUTTONS

    # --- the click ---
    gp, pad = emitter("ds4")
    gp.press("pad:touchpad")
    check("the touchpad click is a special button, not an ordinary one",
          pad.special & int(S4.DS4_SPECIAL_BUTTON_TOUCHPAD) == int(S4.DS4_SPECIAL_BUTTON_TOUCHPAD)
          and pad.buttons == 0, "special=%#x buttons=%#x" % (pad.special, pad.buttons))
    gp.press("pad:guide")
    check("...and shares that byte with PS without either clearing the other",
          pad.special == int(S4.DS4_SPECIAL_BUTTON_TOUCHPAD) | int(S4.DS4_SPECIAL_BUTTON_PS),
          "%#x" % pad.special)
    gp.release("pad:touchpad")
    check("releasing one leaves the other alone", pad.special == int(S4.DS4_SPECIAL_BUTTON_PS),
          "%#x" % pad.special)

    # --- the surface ---
    gp, pad = emitter("ds4")
    check("a DualShock says it has a touchpad", gp.supports_touch() is True)
    check("...and an Xbox pad says it has not", GE("x360").supports_touch() is False)
    check("no finger yet, so the ordinary report goes out", pad.ex is None)
    gp.set_touch(0.5, 0.5)
    check("a finger puts the report on the extended shape", pad.ex is not None)
    t = _decode(pad.ex).sCurrentTouch
    check("one touch packet is announced", _decode(pad.ex).bTouchPacketsN == 1)
    check("the finger is DOWN (bit 7 clear)", not (t.bIsUpTrackingNum1 & 0x80),
          "%#x" % t.bIsUpTrackingNum1)
    x, y = _touch_xy(t)
    # The middle of the pad, in the DualShock's own grid. Checked as a NUMBER rather than as
    # "roughly central": the two 12-bit fields share a byte, and a packing mistake there reads as
    # a plausible-looking position that is wrong by a nibble.
    check("the middle of the pad lands in the middle of its grid",
          (x, y) == (round(0.5 * (GE.TOUCH_W - 1)), round(0.5 * (GE.TOUCH_H - 1))),
          "(%d, %d)" % (x, y))
    gp.set_touch(1.0, 1.0)
    x, y = _touch_xy(_decode(pad.ex).sCurrentTouch)
    check("the far corner is the last cell of the grid, never past it",
          (x, y) == (GE.TOUCH_W - 1, GE.TOUCH_H - 1), "(%d, %d)" % (x, y))
    gp.set_touch(-3.0, 9.0)
    x, y = _touch_xy(_decode(pad.ex).sCurrentTouch)
    check("...and a value off the surface is clamped onto it", (x, y) == (0, GE.TOUCH_H - 1),
          "(%d, %d)" % (x, y))
    id_down = _decode(pad.ex).sCurrentTouch.bIsUpTrackingNum1 & 0x7F

    gp.set_touch(0, 0, on=False)
    t = _decode(pad.ex).sCurrentTouch
    check("lifting the finger sends one more report saying so (bit 7 set)",
          bool(t.bIsUpTrackingNum1 & 0x80), "%#x" % t.bIsUpTrackingNum1)
    check("...keeping the coordinates where the finger left them, as a real pad does",
          _touch_xy(t) == (0, GE.TOUCH_H - 1), "%r" % (_touch_xy(t),))
    gp.press("pad:b")
    check("...after which the ordinary report is enough again", pad.ex is None)
    gp.set_touch(0.25, 0.25)
    check("a finger put back down is a NEW finger (a new tracking number)",
          (_decode(pad.ex).sCurrentTouch.bIsUpTrackingNum1 & 0x7F) != id_down)
    check("the second finger is always reported up",
          bool(_decode(pad.ex).sCurrentTouch.bIsUpTrackingNum2 & 0x80))

    # The two halves do not collide: a finger on the glass and the gyro switched on have to
    # travel in the SAME report, and whichever was written second must not blank the other.
    gp.set_motion(True)
    gp.set_imu(gyro_dps=(90.0, 0.0, 0.0), accel_g=(0.0, 1.0, 0.0))
    r = _decode(pad.ex)
    check("motion and a finger ride in one report",
          r.wGyroX == round(90.0 * GE.DS4_GYRO_LSB_PER_DPS)
          and not (r.sCurrentTouch.bIsUpTrackingNum1 & 0x80),
          "gyro=%r up=%#x" % (r.wGyroX, r.sCurrentTouch.bIsUpTrackingNum1))
    gp.reset()
    check("reset takes the finger off the glass", gp._touch is None)

    # An Xbox pad has no touchpad. Unlike a MAPPING, which raises because a person typed it, this
    # is fed by the motion engine at the capsule's rate — so it has to be a quiet no-op, or a pad
    # type switched underneath it becomes a stream of errors.
    gx, padx = emitter("x360")
    gx.set_touch(0.5, 0.5)
    check("a finger on a pad with no touchpad is quietly ignored",
          gx._touch is None and padx.ex is None)


test_touchpad()


# ============================== 3. THE REGISTRY ==============================
# The type is a property of the CONTROLLER, so it has to survive a restart — and a file written
# before types existed has to keep meaning what it meant, which is an Xbox pad.
_pads_dir = tempfile.mkdtemp(prefix="rf-padkind-")
_pads_file = os.path.join(_pads_dir, "pads.json")
_orig_pads_file = rf.PADS_FILE
rf.PADS_FILE = _pads_file
try:
    rf.save_pads({"pads": [{"id": "p1", "name": "lewa", "kind": "ds4", "motion": True},
                           {"id": "p2", "name": "", "kind": "x360"}],
                  "home": {}})
    back = rf.load_pads()
    check("the type is written to the registry file",
          [p.get("kind") for p in back["pads"]] == ["ds4", "x360"])

    pads = []
    for it in json.loads(open(_pads_file, "r", encoding="utf-8").read())["pads"]:
        pads.append(rf.VirtualPad(it["id"], it.get("name") or "", it.get("kind"),
                                  it.get("motion")))
    check("a controller read back from the file is the device it was",
          [p.kind for p in pads] == ["ds4", "x360"])
    check("the gyroscope setting survives a restart too",
          [p.motion for p in pads] == [True, False], "%r" % [p.motion for p in pads])
    check("VirtualPad.kind is the emitter's, not a copy that can drift",
          pads[0].kind == pads[0].emitter.kind)
    pads[0].emitter.set_kind("x360")
    check("...so a swap shows up on the pad itself", pads[0].kind == "x360")

    # The one that keeps old installs working: no `kind` key at all.
    old = rf.VirtualPad("p1", "sprzed typów", None)
    check("a registry written before types existed still means the Xbox pad", old.kind == "x360")
finally:
    rf.PADS_FILE = _orig_pads_file
    try:
        os.remove(_pads_file)
        os.rmdir(_pads_dir)
    except Exception:
        pass


# ============================== 4. THE REAL DEVICE ==============================
# Creates a DualShock target through ViGEmBus and unplugs it. Presses nothing: a virtual pad's
# buttons reach whatever is reading that pad, and a test has no business typing into somebody's
# game. This proves the one thing the stub cannot — that the driver builds what we ask for.
def _real_ds4():
    try:
        import vgamepad  # noqa: F401
    except Exception as e:
        return skip("real DualShock device", "vgamepad missing (%s)" % e.__class__.__name__)
    if GE.driver_present() is False:
        return skip("real DualShock device", "ViGEmBus driver not installed")
    gp = GE("ds4")
    try:
        ok = gp._ensure_pad()
    except Exception as e:
        return check("real DualShock device is created", False, "%s: %s" % (e.__class__.__name__, e))
    if not ok:
        return skip("real DualShock device", "pad could not be created (driver?)")
    check("ViGEmBus builds a DualShock when asked for one",
          gp._pad.__class__.__name__ == "VDS4Gamepad", gp._pad.__class__.__name__)
    check("...and the emitter knows what it is holding", gp.active and gp.kind == "ds4")
    # The decisive one for the gyroscope: the EXTENDED report is a different ioctl, and whether
    # ViGEmBus accepts it cannot be settled by a stub. A rejection surfaces as the one-shot
    # warning set_imu prints, so an unchanged flag IS the proof it went through.
    gp.set_motion(True)
    gp.set_imu(gyro_dps=(30.0, 0.0, 0.0), accel_g=(0.0, 1.0, 0.0))
    check("ViGEmBus accepts the extended report, so real motion reaches Windows",
          gp._imu_warned is False and gp.active)
    gp.set_kind("x360")            # unplug it again; nothing was ever pressed
    check("...and it unplugs cleanly", gp._pad is None)


_real_ds4()


print("\n%d passed, %d failed, %d skipped" % (_passed, _failed, _skipped))
sys.exit(1 if _failed else 0)
