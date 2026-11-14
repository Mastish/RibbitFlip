#!/usr/bin/env python3
"""
ribbitflip_audio.py
==============
Controls computer audio using the Triki motion controller (an unofficial,
independent hobby project - see README; not affiliated with Zabka).

Gestures (default):
  * SPIN                                  ->  volume +/-   (like a knob)
  * DOUBLE-TAP (two quick taps)           ->  toggles scrub mode;
      in this mode SPIN scrubs the track forward/back (auto-exit after inactivity)
  * SHAKE (a longer jerk)                 ->  play / pause
  * (optional, --enable-skip flag)
      QUICK SIDE TILT                     ->  previous / next track

Sends standard system media keys (volume up/down,
play/pause, next/prev), so it works with whatever is currently playing
(Spotify, YouTube, any player, etc.) on Windows, macOS, and Linux (X11).

The BLE protocol facts below (UUIDs, wake/sleep bytes, packet layout) were worked
out by the hobbyist community - docs/CREDITS.md names who, lists exactly what is
shared and shows the line-by-line comparison behind that claim. They are facts
about the device, not borrowed code: any program that talks to this puck must
send the identical bytes. The script itself is independent and relies only on
bleak and pynput.

Installation:
    pip install bleak pynput

Running:
    python ribbitflip_audio.py            # normal operation
    python ribbitflip_audio.py --debug    # preview raw data (for tuning)
    python ribbitflip_audio.py --enable-skip   # enables prev/next (experimental)

Important: Triki must be TURNED ON and paired with the COMPUTER (not actively
connected to a phone). Turn it on by pressing the center of the device.

Scope (for reviewers): a standalone console script, separate from the RibbitFlip app. It sends
only the media keys above plus the Left/Right arrows (seek mode), and only in response to the
capsule's motion; it opens no network socket and writes no files, and the only keys it watches
are its own stop combination. It connects to the first BLE device whose name starts with
--name. It has none of the app's switches, but it has the same emergency stop: Alt+R+F ends it
at once (`_start_stop_hotkey`), and Ctrl+C or closing the console window does too.
"""

import argparse
import asyncio
import math
import os
import struct
import sys
import time

# bleak is imported lazily (inside the BLE methods) - same as pynput below.
# This lets the module be imported without bleak (e.g. a monitor in simulation
# mode, which only uses GestureEngine and not the BLE connection).

# ----------------------------------------------------------------------------
#  BLE PROTOCOL (Nordic UART Service) - reverse-engineered by the community
# ----------------------------------------------------------------------------
RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"   # writing commands to the device
TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"   # notifications from the sensors

# "wake up IMU and start streaming" command, and "sleep"
WAKE_CMD  = b"\x20\x10\x00\xd0\x07\x34\x00\x03"
SLEEP_CMD = b"\x20\x00\x00\x00\x00\x00\x00"

# Data packet: 14 bytes, header 0x22 <button>, then 6 x int16 little-endian
#   [gx, gy, gz, ax, ay, az]  (GYROSCOPE X/Y/Z first, then accelerometer X/Y/Z)
# Measured on a real puck 2026-08-22: lying flat and untouched it reads roughly -2065 on CH5,
# which is 1 g at 2048 LSB/g, while CH0-2 sit at zero. So gravity lives in the SECOND triple.
# Until then this file had the two swapped, which made the rotation gesture read the
# accelerometer: a puck lying still reported ~15 deg/s of constant "rotation" and the volume
# would have crept on its own. Same order as ribbitflip_monitor.py's POSE_CAL_DEFAULT.
PACKET_LEN = 14
PACKET_HEADER = (0x22, 0x00)
# Byte 1 is NOT a fixed part of the header: the CatManch gist (see docs/CREDITS.md) documents it
# as the button state, 0 = released, 1 = held. Insisting on 0x00 there would drop every IMU frame
# for as long as the button is held, resync byte by byte and inflate the "rejected bytes" counter.
# Shared with ribbitflip_monitor.py (imports this module as `ta`) so both parsers cannot drift apart.
PACKET_FLAG_BYTES = (0x00, 0x01)

# ----------------------------------------------------------------------------
#  TUNING PARAMETERS  <-- change gesture sensitivity here
# ----------------------------------------------------------------------------

# --- VOLUME / SCRUB (rotation) -------------------------------------
# Rotation axis. "gz" = rotation around the vertical axis (the puck lies flat and you spin it).
VOLUME_AXIS = "gz"
# Gyroscope sensitivity in LSB per degree/s.
# NOTE: 131 is the MPU-6050 figure for +-250 dps and it is inherited, not measured. The sensor in
# this puck is an ST LSM6DSL (identified from the PCB, see docs/CREDITS.md), whose ladder is
# 228.57 / 114.29 / 57.14 / 28.57 / 14.29 - 131 is not on it at any range. Left as it stands
# because the gesture thresholds below were tuned against this number, so changing one without
# the others would only move the problem; if rotation reacts too strongly or too weakly, this is
# the value to try (114.29 for +-250 dps).
GYRO_SENS_LSB_PER_DPS = 131.0
# Dead zone - rotations slower than this many degrees/s are ignored (noise).
GYRO_RATE_DEADZONE_DPS = 6.0
# How many degrees of rotation = one step. Separate for volume and for scrubbing.
DEGREES_PER_STEP = 12.0              # volume mode
SEEK_TWIST_DEGREES_PER_STEP = 12.0   # scrub mode (less = finer seek)

# --- TAPS: double tap (mode) and shake (play/pause) ---------------
# Both are detected from the accelerometer and distinguished by the DURATION of elevated force:
#   short pulse                -> tap; two in a row = double tap (mode)
#   longer, continuous jolting -> shake = play / pause
# "Elevated force" threshold relative to gravity (independent of sensor scale).
SHAKE_RATIO = 1.7
# A pulse SHORTER than this many seconds counts as a tap (knock).
TAP_MAX_DURATION_S = 0.13
# Elevated force sustained LONGER than this -> shake (play/pause).
SHAKE_MIN_DURATION_S = 0.18
# Maximum gap between two taps to count them as a double tap.
DOUBLE_TAP_WINDOW_S = 0.45
# After a double tap we enter scrub mode; it exits automatically after this many seconds
# without rotation.
SEEK_MODE_TIMEOUT_S = 4.0

# --- TRACK CHANGE (quick sideways flick, optional --enable-skip) ---------
# A vigorous flick on this axis -> previous / next track. Direction = side.
SKIP_AXIS = "gy"
# Threshold for detecting the start of motion (degrees/s) - below this is noise.
SEEK_DPS = 60.0
# Motion peak ABOVE this threshold (degrees/s) -> track change.
FLICK_DPS = 220.0
# Lockout after a track change (s), so one motion doesn't skip by two.
GESTURE_COOLDOWN_S = 0.6

# ----------------------------------------------------------------------------


class MediaKeys:
    """Sends system media keys via pynput."""

    def __init__(self):
        # Lazy import - this way --debug works even without a GUI environment.
        from pynput.keyboard import Controller, Key
        self._kb = Controller()
        self._Key = Key

    def _tap(self, key):
        self._kb.press(key)
        self._kb.release(key)

    def volume_up(self):     self._tap(self._Key.media_volume_up)
    def volume_down(self):   self._tap(self._Key.media_volume_down)
    def play_pause(self):    self._tap(self._Key.media_play_pause)
    def next_track(self):    self._tap(self._Key.media_next)
    def prev_track(self):    self._tap(self._Key.media_previous)
    # Seeking within the track. NOTE: these are NOT global media keys -
    # they only work in the ACTIVE window. By default arrow keys (YouTube and most
    # video players: +/- approx. 5 s). Want a bigger jump? Swap for the letters
    # 'l'/'j' (YouTube: +/- 10 s) - then use e.g. self._kb.press('l').
    def seek_forward(self):  self._tap(self._Key.right)
    def seek_back(self):     self._tap(self._Key.left)

    # Short beep on mode change (useful when the app
    # runs in the background without a window). Works on Windows; skipped on other systems.
    def _beep(self, freq):
        try:
            import winsound
            winsound.Beep(freq, 120)
        except Exception:
            pass

    def beep_on(self):   self._beep(1200)   # entering scrub mode
    def beep_off(self):  self._beep(600)    # back to volume


class GestureEngine:
    """Converts the IMU data stream into audio actions."""

    def __init__(self, media: MediaKeys, debug=False, enable_skip=False):
        self.media = media
        self.debug = debug
        self.enable_skip = enable_skip

        self._last_t = None
        self._twist_deg = 0.0          # accumulated rotation (volume or seek)
        self._mag_baseline = None      # moving average of force (gravity)

        # twist control mode: "volume" or "seek"
        self._mode = "volume"
        self._seek_until = 0.0

        # tap/shake detector (episodes of elevated force)
        self._accel_hi = False
        self._accel_rise_t = 0.0
        self._shake_fired = False
        self._last_tap_t = 0.0

        # fast tilt detector (track change)
        self._flick_active = False
        self._flick_peak = 0.0
        self._flick_sign = 0
        self._flick_cd_until = 0.0

        self._dbg_last_print = 0.0

    @staticmethod
    def _axis(sample, name):
        gx, gy, gz, ax, ay, az = sample
        return {"gx": gx, "gy": gy, "gz": gz, "ax": ax, "ay": ay, "az": az}[name]

    def _enter_seek(self, now):
        self._mode = "seek"
        self._seek_until = now + SEEK_MODE_TIMEOUT_S
        self._twist_deg = 0.0
        self.media.beep_on()
        print(">>> TRYB PRZEWIJANIA WL - krec, aby przewijac (auto-wyjscie po bezruchu)")

    def _exit_seek(self, reason=""):
        self._mode = "volume"
        self.media.beep_off()
        suffix = f" - {reason}" if reason else ""
        print(f"<<< TRYB PRZEWIJANIA WYL{suffix} - krec = glosnosc")

    def feed(self, sample):
        gx, gy, gz, ax, ay, az = sample
        now = time.monotonic()
        dt = 0.0 if self._last_t is None else (now - self._last_t)
        self._last_t = now
        if dt <= 0.0 or dt > 0.5:
            # first packet or gap in the stream - skip integration
            dt = 0.0

        # auto-exit from seek mode after inactivity
        if self._mode == "seek" and now > self._seek_until:
            self._exit_seek("brak ruchu")

        # --- 1. ROTATION -> volume OR seek (depending on mode) ---
        rate_dps = self._axis(sample, VOLUME_AXIS) / GYRO_SENS_LSB_PER_DPS
        if abs(rate_dps) >= GYRO_RATE_DEADZONE_DPS and dt > 0.0:
            self._twist_deg += rate_dps * dt
            step = SEEK_TWIST_DEGREES_PER_STEP if self._mode == "seek" else DEGREES_PER_STEP
            steps = int(self._twist_deg / step)
            if steps != 0:
                self._twist_deg -= steps * step
                for _ in range(min(abs(steps), 5)):   # cap the burst: one fast spin must not fire dozens of key presses
                    if self._mode == "seek":
                        self.media.seek_forward() if steps > 0 else self.media.seek_back()
                    else:
                        self.media.volume_up() if steps > 0 else self.media.volume_down()
                if self._mode == "seek":
                    self._seek_until = now + SEEK_MODE_TIMEOUT_S  # refresh timeout
                if self.debug:
                    tag = "SEEK" if self._mode == "seek" else "VOL"
                    print(f"  [{tag}] {'+' if steps > 0 else '-'}{abs(steps)}")

        # --- 2. TAPS / SHAKE (accelerometer, force episodes) ---
        mag = math.sqrt(ax * ax + ay * ay + az * az)
        if self._mag_baseline is None:
            self._mag_baseline = mag
        else:
            self._mag_baseline += 0.05 * (mag - self._mag_baseline)  # EMA
        hi = self._mag_baseline > 0 and mag > self._mag_baseline * SHAKE_RATIO

        if hi and not self._accel_hi:
            # start of an elevated force episode
            self._accel_hi = True
            self._accel_rise_t = now
            self._shake_fired = False
        elif hi and self._accel_hi:
            # episode ongoing: if it lasts long enough -> shake = play/pause
            if not self._shake_fired and (now - self._accel_rise_t) >= SHAKE_MIN_DURATION_S:
                self.media.play_pause()
                self._shake_fired = True
                if self.debug:
                    print("  [PLAY/PAUSE] (potrzasniecie)")
        elif (not hi) and self._accel_hi:
            # end of episode
            self._accel_hi = False
            dur = now - self._accel_rise_t
            if not self._shake_fired and dur <= TAP_MAX_DURATION_S:
                # short pulse = tap
                if (now - self._last_tap_t) <= DOUBLE_TAP_WINDOW_S:
                    # second tap within the window = DOUBLE-CLICK -> switch mode
                    self._last_tap_t = 0.0
                    if self.debug:
                        print("  [DWUKLIK]")
                    if self._mode == "volume":
                        self._enter_seek(now)
                    else:
                        self._exit_seek("dwuklik")
                else:
                    self._last_tap_t = now
                    if self.debug:
                        print(f"  [stuk] ({dur * 1000:.0f} ms)")

        # --- 3. FAST TILT -> track change (optional --enable-skip) ---
        if self.enable_skip:
            rate = self._axis(sample, SKIP_AXIS) / GYRO_SENS_LSB_PER_DPS
            speed = abs(rate)
            if now >= self._flick_cd_until:
                if not self._flick_active:
                    if speed >= SEEK_DPS:                      # start of movement
                        self._flick_active = True
                        self._flick_peak = speed
                        self._flick_sign = 1 if rate > 0 else -1
                else:
                    if speed > self._flick_peak:               # movement ongoing
                        self._flick_peak = speed
                    if speed < SEEK_DPS:                       # end of movement
                        if self._flick_peak >= FLICK_DPS:      # it was vigorous
                            if self._flick_sign > 0:
                                self.media.next_track()
                                if self.debug:
                                    print(f"  [NEXT] szczyt={self._flick_peak:.0f} dps")
                            else:
                                self.media.prev_track()
                                if self.debug:
                                    print(f"  [PREV] szczyt={self._flick_peak:.0f} dps")
                            self._flick_cd_until = now + GESTURE_COOLDOWN_S
                        self._flick_active = False
                        self._flick_peak = 0.0
                        self._flick_sign = 0

        # --- Raw data preview (for threshold tuning) ---
        if self.debug and (now - self._dbg_last_print) > 0.1:
            self._dbg_last_print = now
            print(
                f"[{self._mode:6}] a=({ax:6},{ay:6},{az:6}) g=({gx:6},{gy:6},{gz:6}) "
                f"|a|={mag:7.0f} base={self._mag_baseline:7.0f}"
            )


class RibbitFlipAudio:
    def __init__(self, name="Triki", debug=False, enable_skip=False):
        self.name = name
        self.debug = debug
        self.enable_skip = enable_skip
        self._buf = bytearray()
        self._engine = None
        self._client = None
        self.scan_s = 8.0     # length of a single BLE scan
        self.retry_s = 5.0    # delay before the next attempt when no device is found

    def _on_notify(self, _sender, data):
        self._buf.extend(data)
        while len(self._buf) >= PACKET_LEN:
            if self._buf[0] == PACKET_HEADER[0] and self._buf[1] in PACKET_FLAG_BYTES:
                pkt = self._buf[:PACKET_LEN]
                sample = struct.unpack("<hhhhhh", pkt[2:14])  # gx,gy,gz,ax,ay,az
                self._buf = self._buf[PACKET_LEN:]
                if self._engine:
                    self._engine.feed(sample)
            elif self._buf[0] == 0x21:
                # status packet (5 bytes): buttons/touch/battery — not needed here, skipped.
                # ribbitflip_monitor.py decodes these.
                self._buf = self._buf[5:]
            else:
                self._buf.pop(0)            # offset mismatch - shift by 1 byte

    async def _scan(self):
        """Performs a single BLE scan. Returns the device or None."""
        from bleak import BleakScanner
        try:
            for d in await BleakScanner.discover(timeout=self.scan_s):
                if d.name and d.name.startswith(self.name):
                    return d
        except Exception as e:
            if self.debug:
                print(f"[skan blad] {e}")
        return None

    async def _session(self, device):
        """A single connection - lasts until disconnection or an error."""
        from bleak import BleakClient
        self._buf = bytearray()  # drop any partial packet left over from the previous session
        async with BleakClient(device.address) as client:
            self._client = client
            await client.start_notify(TX_UUID, self._on_notify)
            await client.write_gatt_char(RX_UUID, WAKE_CMD, response=False)

            print(f"Polaczono z {device.name}. Sterowanie aktywne.")
            print("  Krec        -> glosnosc")
            print("  Dwuklik     -> tryb przewijania (potem krec = seek)")
            print("  Potrzasnij  -> play / pause")
            if self.enable_skip:
                print("  Szybki wychyl -> poprzedni / nastepny utwor")

            try:
                while client.is_connected:
                    await asyncio.sleep(1.0)
            finally:
                try:
                    await client.write_gatt_char(RX_UUID, SLEEP_CMD, response=False)
                    await client.stop_notify(TX_UUID)
                except Exception:
                    pass
        print("Rozlaczono - czekam na ponowne polaczenie...")

    async def run(self):
        try:
            media = MediaKeys()
        except Exception as e:
            print(f"Nie udalo sie zainicjalizowac klawiszy multimedialnych: {e}")
            print("Zainstaluj zaleznosc:  pip install pynput")
            print("(Na Linuksie sterowanie klawiszami dziala pod X11; na Wayland bywa ograniczone.)")
            return

        self._engine = GestureEngine(media, self.debug, self.enable_skip)

        print(f"Start. Czekam na Triki (nazwa zaczyna sie od '{self.name}')...")
        print("Wlacz kontroler nacisnieciem srodka z 'Z'. Ctrl+C aby zakonczyc.\n")

        # Main loop: scan -> connect -> return to scanning after disconnect.
        while True:
            device = await self._scan()
            if not device:
                await asyncio.sleep(self.retry_s)
                continue
            try:
                await self._session(device)
            except Exception as e:
                if self.debug:
                    print(f"[sesja przerwana] {e}")
            await asyncio.sleep(2.0)  # brief pause before scanning again


def _start_stop_hotkey():
    """Emergency stop for this script: Alt+R+F (the app's default) ends it at once, even while
    the console is behind a game or a full-screen player. Same idea as the app's PanicHotkey: the
    pynput hotkey only compares the keys held now against this one combination, keeps nothing
    and logs nothing. Without pynput's listener (unlikely, the script needs pynput anyway) the
    script still runs and Ctrl+C remains the way out."""
    try:
        from pynput import keyboard
    except Exception:
        return None

    def _stop():
        print("\nStop awaryjny (Alt+R+F): koncze.", flush=True)
        os._exit(0)          # media keys are taps, nothing is held down, so a hard exit is safe

    try:
        hk = keyboard.GlobalHotKeys({"<alt>+r+f": _stop})
        hk.daemon = True
        hk.start()
        return hk
    except Exception:
        return None


def main():
    p = argparse.ArgumentParser(description="Sterowanie audio kontrolerem RibbitFlip.")
    p.add_argument("--name", default="Triki", help="poczatek nazwy BLE urzadzenia")
    p.add_argument("--debug", action="store_true", help="podglad surowych danych IMU")
    p.add_argument("--enable-skip", action="store_true",
                   help="wlacz szybki wychyl w bok = poprzedni/nastepny utwor (eksperymentalne)")
    args = p.parse_args()

    app = RibbitFlipAudio(name=args.name, debug=args.debug, enable_skip=args.enable_skip)
    if _start_stop_hotkey() is not None:
        print("Stop awaryjny: Alt+R+F (albo Ctrl+C w tym oknie).")
    try:
        asyncio.run(app.run())
    except KeyboardInterrupt:
        print("\nPrzerwano.")
        sys.exit(0)


if __name__ == "__main__":
    main()
