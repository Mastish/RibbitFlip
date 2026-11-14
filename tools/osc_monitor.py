#!/usr/bin/env python3
"""Tiny zero-dependency OSC monitor for testing RibbitFlip's OSC output.

Listens for OSC-over-UDP messages and prints them, decoding the standard OSC 1.0
format (address + type-tag + float/int/bool/string args). Uses only the Python
standard library, so you can test OSC on Windows without installing anything.

Usage:
    python tools/osc_monitor.py            # listen on UDP :9000 (RibbitFlip default)
    python tools/osc_monitor.py 9001       # listen on a different port
    python tools/osc_monitor.py 9000 --lan # also accept packets from other machines on the LAN

Then in RibbitFlip's MIDI/OSC panel set OSC Host = 127.0.0.1, Port = 9000,
add an OSC mapping, enable the group, arm, and move the device (or use --simulate).

Developer tool only, not part of the app or its build. It listens on 127.0.0.1 unless you pass
--lan (then on all interfaces, so a test from another machine shows up), and it only prints what
arrives: it sends nothing, controls nothing and writes no files.
"""
import socket
import struct
import sys
import time


def _read_str(data, i):
    """Read an OSC null-terminated, 4-byte-padded string starting at offset i."""
    end = data.index(b"\x00", i)
    s = data[i:end].decode("utf-8", "replace")
    i = end + 1
    i += (4 - (i % 4)) % 4          # advance past padding to a 4-byte boundary
    return s, i


def decode(data):
    """Decode a single OSC message -> (address, [args]) or None if it isn't OSC."""
    try:
        address, i = _read_str(data, 0)
        if not address.startswith("/"):
            return None
        if i >= len(data) or data[i:i + 1] != b",":
            return address, []          # message with no type-tag / no args
        tags, i = _read_str(data, i)
        args = []
        for t in tags[1:]:              # skip the leading ','
            if t == "f":
                args.append(round(struct.unpack(">f", data[i:i + 4])[0], 4)); i += 4
            elif t == "i":
                args.append(struct.unpack(">i", data[i:i + 4])[0]); i += 4
            elif t == "d":
                args.append(round(struct.unpack(">d", data[i:i + 8])[0], 4)); i += 8
            elif t == "T":
                args.append(True)
            elif t == "F":
                args.append(False)
            elif t == "s":
                s, i = _read_str(data, i); args.append(s)
            else:
                args.append("<%s>" % t)
        return address, args
    except Exception:
        return None


def main():
    argv = [a for a in sys.argv[1:] if a != "--lan"]
    lan = "--lan" in sys.argv[1:]
    port = int(argv[0]) if argv else 9000
    host = "0.0.0.0" if lan else "127.0.0.1"       # the LAN only when asked for
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((host, port))
    print("OSC monitor listening on UDP %s:%d  (Ctrl+C to stop)" % (host, port), flush=True)
    while True:
        data, src = sock.recvfrom(65535)
        ts = time.strftime("%H:%M:%S")
        dec = decode(data)
        if dec:
            address, args = dec
            print("%s  %-28s %s" % (ts, address, args if args else ""), flush=True)
        else:
            print("%s  [non-OSC %dB] %s" % (ts, len(data), data[:40].hex()), flush=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nstopped.")
