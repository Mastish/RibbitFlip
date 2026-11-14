# Test of the OBS Studio client (obs-websocket 5). Run: py tests/test_obs_ws.py
#
# Like the DSU test, this one speaks the protocol back at the code instead of inspecting it: a
# WebSocket client is a handshake, a mask and five opcodes, and every way of getting one of those
# wrong produces the SAME symptom — OBS says nothing and closes. So the test stands up a dummy
# obs-websocket server on the loopback and drives ObsClient against it exactly as the panel does.
#
# Nothing here touches OBS, the network beyond 127.0.0.1, or any output of the application. The
# dummy answers on an ephemeral port and dies with the process.
#
# THE AUTH VECTOR IS THE POINT OF SECTION 3. The digest is computed in the BROWSER (crypto.subtle)
# and this file computes it with hashlib, from the same formula written in the comment beside the
# JavaScript. If the two ever disagree, this test is where it shows up — the dummy knows the
# password, computes what it expects and refuses anything else.
#
#     authentication = base64(sha256( base64(sha256(password + salt)) + challenge ))
import base64
import hashlib
import json
import os
import socket
import struct
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_monitor as rf   # noqa: E402

_passed = 0
_failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print("PASS  %s" % name)
    else:
        _failed += 1
        print("FAIL  %s%s" % (name, ("  -> " + detail) if detail else ""))


GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def obs_auth(password, salt, challenge):
    """The digest the browser sends. Written out here so the JS has something to be wrong against."""
    secret = base64.b64encode(hashlib.sha256((password + salt).encode("utf-8")).digest()).decode()
    return base64.b64encode(hashlib.sha256((secret + challenge).encode("utf-8")).digest()).decode()


# ============================== dummy obs-websocket server ==============================
def _recv_exact(sock, n):
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("peer closed")
        buf += chunk
    return buf


def _srv_frame(opcode, payload):
    """A SERVER frame: final, unmasked (RFC 6455 §5.1 — only the client masks)."""
    n = len(payload)
    h = bytearray([0x80 | opcode])
    if n < 126:
        h.append(n)
    elif n < 65536:
        h.append(126)
        h += struct.pack(">H", n)
    else:
        h.append(127)
        h += struct.pack(">Q", n)
    return bytes(h) + payload


def _srv_read_frame(sock):
    h = _recv_exact(sock, 2)
    fin = bool(h[0] & 0x80)
    opcode = h[0] & 0x0F
    masked = bool(h[1] & 0x80)
    ln = h[1] & 0x7F
    if ln == 126:
        ln = struct.unpack(">H", _recv_exact(sock, 2))[0]
    elif ln == 127:
        ln = struct.unpack(">Q", _recv_exact(sock, 8))[0]
    key = _recv_exact(sock, 4) if masked else b""
    data = _recv_exact(sock, ln) if ln else b""
    if masked:
        data = bytes(b ^ key[i & 3] for i, b in enumerate(data))
    return opcode, data, masked, fin


class DummyObs:
    """Just enough obs-websocket 5 to be indistinguishable from OBS at this end of the wire."""

    def __init__(self, password=None, send_hello=True, bad_accept=False):
        self.password = password
        self.send_hello = send_hello
        self.bad_accept = bad_accept
        self.salt = "s4lt-for-the-test"
        self.challenge = "ch4llenge-for-the-test"
        self.requests = []          # (requestType, requestData)
        self.identify = None        # the `d` of the Identify the client sent
        self.all_masked = True      # every client frame carried the mask bit
        self.all_final = True
        self.pongs = []             # payloads of the pongs the client sent back
        self.handshake_key = ""
        self.conn = None
        self.ready = threading.Event()
        self.fail_next = None       # {"code":..,"comment":..} — refuse the next request
        self._stop = False
        self.srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.srv.bind(("127.0.0.1", 0))
        self.srv.listen(1)
        self.port = self.srv.getsockname()[1]
        self.thread = threading.Thread(target=self._run, daemon=True, name="dummy-obs")
        self.thread.start()

    # -- lifecycle -----------------------------------------------------
    def kill_connection(self):
        """What OBS being closed looks like from here."""
        c = self.conn
        self.conn = None
        if c is not None:
            try:
                c.shutdown(socket.SHUT_RDWR)
            except Exception:
                pass
            try:
                c.close()
            except Exception:
                pass

    def stop(self):
        self._stop = True
        self.kill_connection()
        try:
            self.srv.close()
        except Exception:
            pass

    def send_ping(self, payload=b"rf-ping"):
        self.conn.sendall(_srv_frame(0x9, payload))

    # -- protocol ------------------------------------------------------
    def _run(self):
        try:
            conn, _ = self.srv.accept()
        except Exception:
            return
        self.conn = conn
        try:
            self._handshake(conn)
            if not self.send_hello:
                self.ready.set()
                while not self._stop:       # accepted, upgraded, and then eloquently silent
                    time.sleep(0.05)
                return
            hello = {"op": 0, "d": {"obsWebSocketVersion": "5.4.2", "rpcVersion": 1}}
            if self.password:
                hello["d"]["authentication"] = {"challenge": self.challenge, "salt": self.salt}
            conn.sendall(_srv_frame(0x1, json.dumps(hello).encode("utf-8")))
            self.ready.set()
            self._loop(conn)
        except Exception:
            pass

    def _handshake(self, conn):
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = conn.recv(4096)
            if not chunk:
                raise ConnectionError("no handshake")
            head += chunk
        lines = head.split(b"\r\n\r\n", 1)[0].decode("latin-1").split("\r\n")
        key = ""
        for ln in lines[1:]:
            k, _, v = ln.partition(":")
            if k.strip().lower() == "sec-websocket-key":
                key = v.strip()
        self.handshake_key = key
        accept = base64.b64encode(hashlib.sha1((key + GUID).encode("ascii")).digest()).decode()
        if self.bad_accept:
            accept = base64.b64encode(b"x" * 20).decode()
        conn.sendall(("HTTP/1.1 101 Switching Protocols\r\n"
                      "Upgrade: websocket\r\n"
                      "Connection: Upgrade\r\n"
                      "Sec-WebSocket-Accept: %s\r\n\r\n" % accept).encode("ascii"))

    def _loop(self, conn):
        while not self._stop:
            opcode, data, masked, fin = _srv_read_frame(conn)
            if not masked:
                self.all_masked = False
            if not fin:
                self.all_final = False
            if opcode == 0xA:
                self.pongs.append(data)
                continue
            if opcode == 0x8:
                return
            if opcode != 0x1:
                continue
            msg = json.loads(data.decode("utf-8"))
            op = msg.get("op")
            d = msg.get("d") or {}
            if op == 1:
                self.identify = d
                if self.password:
                    want = obs_auth(self.password, self.salt, self.challenge)
                    if d.get("authentication") != want:
                        # What OBS does with a wrong password: close, code 4009.
                        conn.sendall(_srv_frame(0x8, struct.pack(">H", 4009) + b"auth"))
                        return
                conn.sendall(_srv_frame(0x1, json.dumps(
                    {"op": 2, "d": {"negotiatedRpcVersion": 1}}).encode("utf-8")))
            elif op == 6:
                self.requests.append((d.get("requestType"), d.get("requestData")))
                if self.fail_next:
                    st = {"result": False, "code": self.fail_next.get("code", 600),
                          "comment": self.fail_next.get("comment", "")}
                    self.fail_next = None
                    body = {"op": 7, "d": {"requestType": d.get("requestType"),
                                           "requestId": d.get("requestId"), "requestStatus": st}}
                else:
                    body = {"op": 7, "d": {"requestType": d.get("requestType"),
                                           "requestId": d.get("requestId"),
                                           "requestStatus": {"result": True, "code": 100},
                                           "responseData": {"echo": d.get("requestData")}}}
                conn.sendall(_srv_frame(0x1, json.dumps(body).encode("utf-8")))


def client(**kw):
    c = rf.ObsClient()
    c.connect_timeout = kw.pop("connect_timeout", 3.0)
    c.request_timeout = kw.pop("request_timeout", 3.0)
    c.identify_window = kw.pop("identify_window", 30.0)
    return c


# ============================== 1. HANDSHAKE (RFC 6455) ==============================
print("\n-- 1. uzgadnianie WebSocket --")

d = DummyObs()
c = client()
r = c.connect("127.0.0.1", d.port)
check("a correct Sec-WebSocket-Accept is accepted", r.get("ok") is True, json.dumps(r))
check("the key the client offered is 16 random bytes, base64",
      len(base64.b64decode(d.handshake_key)) == 16, repr(d.handshake_key))
c.disconnect()
d.stop()

d = DummyObs(bad_accept=True)
c = client()
r = c.connect("127.0.0.1", d.port)
check("a WRONG Sec-WebSocket-Accept is refused", r.get("ok") is False)
check("...tagged for the panel to phrase", r.get("code") == "handshake", json.dumps(r))
check("...and the reason names the key", "klucz" in (r.get("error") or "").lower(), repr(r.get("error")))
check("...and nothing is left connected", c.state()["connected"] is False)
d.stop()

# Somebody else's HTTP server on that port: answers 200, not 101.
plain = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
plain.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
plain.bind(("127.0.0.1", 0))
plain.listen(1)
_pport = plain.getsockname()[1]


def _plain_server():
    try:
        cn, _ = plain.accept()
        cn.recv(4096)
        cn.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nhi")
        cn.close()
    except Exception:
        pass


threading.Thread(target=_plain_server, daemon=True).start()
c = client(connect_timeout=2.0)
r = c.connect("127.0.0.1", _pport)
check("a plain HTTP server is not mistaken for OBS", r.get("ok") is False)
check("...and the reason says so", "websocket" in (r.get("error") or "").lower(), repr(r.get("error")))
plain.close()

# Nothing listening at all.
free = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
free.bind(("127.0.0.1", 0))
_free_port = free.getsockname()[1]
free.close()
c = client(connect_timeout=2.0)
r = c.connect("127.0.0.1", _free_port)
check("a closed port is reported, not swallowed", r.get("ok") is False)
# Either code is honest here and the platform picks: Windows often lets a connection to a
# just-closed loopback port sit until it times out instead of answering with a reset.
check("...tagged so the card can phrase it",
      r.get("code") in ("refused-tcp", "timeout"), json.dumps(r))
check("...with advice about the OBS setting", "WebSocket" in (r.get("error") or ""), repr(r.get("error")))


# ============================== 2. FRAMING ==============================
print("\n-- 2. ramkowanie --")

F = rf.ObsClient._mask_frame


def unmask(fr):
    """Decode one client frame the way a server does. Returns (opcode, payload, masked, fin)."""
    fin = bool(fr[0] & 0x80)
    opcode = fr[0] & 0x0F
    masked = bool(fr[1] & 0x80)
    ln = fr[1] & 0x7F
    i = 2
    if ln == 126:
        ln = struct.unpack_from(">H", fr, i)[0]
        i += 2
    elif ln == 127:
        ln = struct.unpack_from(">Q", fr, i)[0]
        i += 8
    key = fr[i:i + 4] if masked else b""
    i += 4 if masked else 0
    data = fr[i:i + ln]
    if masked:
        data = bytes(b ^ key[j & 3] for j, b in enumerate(data))
    return opcode, data, masked, fin


small = F(0x1, b"a" * 10)
check("a client frame always sets the mask bit", (small[1] & 0x80) != 0)
check("a short payload uses the 7-bit length", (small[1] & 0x7F) == 10, "%d" % (small[1] & 0x7F))
check("...and unmasks back to what went in", unmask(small)[1] == b"a" * 10)
check("...marked FINAL (this client never fragments)", unmask(small)[3] is True)

mid = F(0x1, b"b" * 300)
check("126..65535 bytes switch to the 16-bit length", (mid[1] & 0x7F) == 126)
check("...whose value is the real length", struct.unpack_from(">H", mid, 2)[0] == 300)
check("...and the payload survives", unmask(mid)[1] == b"b" * 300)

big = F(0x1, b"c" * 70000)
check("65536+ bytes switch to the 64-bit length", (big[1] & 0x7F) == 127)
check("...whose value is the real length", struct.unpack_from(">Q", big, 2)[0] == 70000)
check("...and the payload survives", unmask(big)[1] == b"c" * 70000)

k1 = F(0x1, b"same payload every time")[2:6]
k2 = F(0x1, b"same payload every time")[2:6]
check("the masking key is fresh per frame", k1 != k2, "%r == %r" % (k1, k2))

check("a pong is opcode 0xA", unmask(F(0xA, b"x"))[0] == 0xA)

# End to end: a payload past the 7-bit boundary has to survive the real socket, and a ping from
# the server has to come back as a pong from the reader thread.
d = DummyObs()
c = client()
r = c.connect("127.0.0.1", d.port)
check("connected to the dummy for the framing round-trip", r.get("ok") is True, json.dumps(r))
long_name = "S" * 400
c.send("SetCurrentProgramScene", {"sceneName": long_name})
check("a 16-bit-length frame arrives intact at the server",
      d.requests and d.requests[-1][1].get("sceneName") == long_name)
check("every frame the client sent was masked", d.all_masked is True)
check("every frame the client sent was final", d.all_final is True)
d.send_ping(b"are-you-there")
t0 = time.monotonic()
while not d.pongs and time.monotonic() - t0 < 2.0:
    time.sleep(0.02)
check("a ping is answered with a pong", bool(d.pongs))
check("...carrying the ping's own payload", d.pongs and d.pongs[-1] == b"are-you-there",
      repr(d.pongs[-1] if d.pongs else None))
c.disconnect()
d.stop()


# ============================== 3. obs-websocket 5 HANDSHAKE ==============================
print("\n-- 3. przeplyw Hello / Identify --")

d = DummyObs(password=None)
c = client()
r = c.connect("127.0.0.1", d.port)
check("Hello without authentication identifies straight away", r.get("identified") is True, json.dumps(r))
check("...and does not ask for a password", r.get("needAuth") is False)
check("...state agrees", c.state()["identified"] is True)
check("...the OBS version from Hello is passed on", c.state().get("obsVersion") == "5.4.2")
check("Identify subscribes to NO events", (d.identify or {}).get("eventSubscriptions") == 0,
      json.dumps(d.identify))
check("...and declares rpcVersion 1", (d.identify or {}).get("rpcVersion") == 1)
check("...and carries no authentication when none was asked for",
      "authentication" not in (d.identify or {}))
c.disconnect()
d.stop()

d = DummyObs(password="zaba123")
c = client()
r = c.connect("127.0.0.1", d.port)
check("Hello WITH authentication stops at needAuth", r.get("needAuth") is True, json.dumps(r))
check("...connected but not identified", r.get("connected") is True and r.get("identified") is False)
check("...and hands the challenge to the browser", r.get("challenge") == d.challenge)
check("...and the salt", r.get("salt") == d.salt)
check("state reports the half-open link", c.state()["connected"] is True and
      c.state()["identified"] is False and c.state()["needAuth"] is True)
r = c.send("GetVersion", {})
check("nothing can be sent before identifying", r.get("ok") is False and "Nie połączono" in r.get("error", ""))

digest = obs_auth("zaba123", d.salt, d.challenge)
r = c.identify(digest)
check("the digest computed from the documented formula is accepted", r.get("ok") is True, json.dumps(r))
check("...and the connection is identified", c.state()["identified"] is True)
check("...the server saw exactly the digest we computed",
      (d.identify or {}).get("authentication") == digest)
check("...and needAuth is over", c.state()["needAuth"] is False)
c.disconnect()
d.stop()

d = DummyObs(password="zaba123")
c = client()
c.connect("127.0.0.1", d.port)
r = c.identify(obs_auth("zle-haslo", d.salt, d.challenge))
check("a WRONG password is refused", r.get("ok") is False, json.dumps(r))
check("...tagged refused, so the card can say it with diacritics", r.get("code") == "refused", json.dumps(r))
check("...with advice about the OBS password", "hasło" in (r.get("error") or "").lower(),
      repr(r.get("error")))
check("...and leaves nothing connected", c.state()["connected"] is False)
d.stop()

d = DummyObs(password="zaba123")
c = client()
c.connect("127.0.0.1", d.port)
r = c.identify("")
check("an empty digest is refused before it reaches OBS", r.get("ok") is False)
check("...and the link is still there to try again", c.state()["needAuth"] is True)
c.disconnect()
d.stop()

# identify() without a connection at all.
c = client()
r = c.identify("whatever")
check("identify with no connection says to connect first", r.get("ok") is False and
      "Połącz" in (r.get("error") or ""), repr(r.get("error")))

# The 30-second window: a link nobody identifies expires instead of waiting forever.
d = DummyObs(password="zaba123")
c = client(identify_window=0.3)
c.connect("127.0.0.1", d.port)
time.sleep(0.5)
r = c.identify(obs_auth("zaba123", d.salt, d.challenge))
check("a stale half-open link expires", r.get("ok") is False, json.dumps(r))
check("...tagged expired", r.get("code") == "expired", json.dumps(r))
check("...and says to connect again", "jeszcze raz" in (r.get("error") or ""), repr(r.get("error")))
check("...and is closed", c.state()["connected"] is False)
d.stop()


# ============================== 4. REQUEST / RESPONSE (op 6 / op 7) ==============================
print("\n-- 4. zadanie i odpowiedz --")

d = DummyObs()
c = client()
c.connect("127.0.0.1", d.port)
r = c.send("SetCurrentProgramScene", {"sceneName": "Kamera"})
check("a successful request comes back ok", r.get("ok") is True, json.dumps(r))
check("...with the OBS success code", r.get("status") == 100)
check("...carrying responseData as the body", json.loads(r["body"])["echo"]["sceneName"] == "Kamera")
check("...and a duration", isinstance(r.get("ms"), int))
check("the server received the requestType verbatim", d.requests[-1][0] == "SetCurrentProgramScene")

r = c.send("StartRecord", None)
check("a request with no data is allowed", r.get("ok") is True, json.dumps(r))
check("...and arrives as an empty object", d.requests[-1][1] == {})

r = c.send("", {})
check("an empty requestType is refused before the socket", r.get("ok") is False and
      "requestType" in (r.get("error") or ""))
check("...with a code the panel can phrase itself", r.get("code") == "no-requesttype", json.dumps(r))
r = c.send("SetInputMute", ["not", "an", "object"])
check("a non-object requestData is refused", r.get("ok") is False and
      "obiekt" in (r.get("error") or ""))
check("...also with a code", r.get("code") == "bad-data", json.dumps(r))

d.fail_next = {"code": 600, "comment": "No source was found by the name of `Mikrofon`."}
r = c.send("SetInputMute", {"inputName": "Mikrofon", "inputMuted": True})
check("a refusal from OBS is reported as a failure", r.get("ok") is False, json.dumps(r))
check("...quoting the code", r.get("status") == 600)
check("...and the comment OBS gave", "Mikrofon" in (r.get("error") or ""), repr(r.get("error")))
check("...tagged obs-refused, with the comment on its own field for the panel",
      r.get("code") == "obs-refused" and "Mikrofon" in (r.get("comment") or ""), json.dumps(r))

# Two requests in flight keep their own answers apart (requestId matching).
res = {}


def _fire(key, scene):
    res[key] = c.send("SetCurrentProgramScene", {"sceneName": scene})


t1 = threading.Thread(target=_fire, args=("a", "Scena-A"))
t2 = threading.Thread(target=_fire, args=("b", "Scena-B"))
t1.start()
t2.start()
t1.join(5)
t2.join(5)
check("two concurrent requests both succeed",
      res.get("a", {}).get("ok") is True and res.get("b", {}).get("ok") is True, json.dumps(res))
check("...and each gets ITS OWN answer back",
      json.loads(res["a"]["body"])["echo"]["sceneName"] == "Scena-A" and
      json.loads(res["b"]["body"])["echo"]["sceneName"] == "Scena-B")
c.disconnect()
d.stop()


# ============================== 5. THE LINK GOING AWAY ==============================
print("\n-- 5. zerwane polaczenie --")

d = DummyObs()
c = client(request_timeout=1.5)
c.connect("127.0.0.1", d.port)
check("connected before the server goes", c.state()["connected"] is True)
d.kill_connection()
t0 = time.monotonic()
while c.state()["connected"] and time.monotonic() - t0 < 3.0:
    time.sleep(0.02)
check("the state falls when OBS closes the socket", c.state()["connected"] is False)
check("...and identified falls with it", c.state()["identified"] is False)
check("...and the reason is kept for the panel", bool(c.state().get("lastError")),
      json.dumps(c.state()))
r = c.send("StartRecord", {})
check("sending afterwards fails with a Polish reason",
      r.get("ok") is False and "Nie połączono z OBS" in r.get("error", ""), json.dumps(r))
check("...and with the code the panel turns into a sentence with diacritics",
      r.get("code") == "no-link", json.dumps(r))
check("nothing reconnects by itself", c.state()["connected"] is False)
d.stop()

# A deliberate disconnect leaves no farewell error hanging next to the button that caused it.
d = DummyObs()
c = client()
c.connect("127.0.0.1", d.port)
c.disconnect()
time.sleep(0.3)
check("a disconnect the user asked for is not an error",
      c.state().get("lastError") in (None, ""), json.dumps(c.state()))
check("...and everything is off afterwards",
      c.state()["connected"] is False and c.state()["identified"] is False and
      c.state()["needAuth"] is False)
check("...and the OBS version does not outlive the link it described",
      "obsVersion" not in c.state(), json.dumps(c.state()))
d.stop()

# A second connect replaces the first rather than stacking on it.
d1 = DummyObs()
d2 = DummyObs()
c = client()
c.connect("127.0.0.1", d1.port)
c.connect("127.0.0.1", d2.port)
check("connecting again moves the link to the new server", c.state()["port"] == d2.port,
      "%d != %d" % (c.state()["port"], d2.port))
r = c.send("GetVersion", {})
check("...and the new server is the one that answers", r.get("ok") is True and bool(d2.requests))
check("...while the old one got nothing more", not d1.requests)
c.disconnect()
d1.stop()
d2.stop()


# ============================== 6. WHERE OBS MAY LIVE ==============================
print("\n-- 6. dozwolone adresy --")

R = rf.ObsClient._host_reject
check("localhost is allowed", R("localhost") is None)
check("127.0.0.1 is allowed", R("127.0.0.1") is None)
check("::1 is allowed", R("::1") is None)
check("a LAN address 192.168.x is allowed", R("192.168.0.12") is None)
check("a LAN address 10.x is allowed", R("10.20.30.40") is None)
check("a LAN address 172.16-31.x is allowed", R("172.20.4.4") is None)
check("172.32.x is NOT private and is refused", R("172.32.4.4") is not None)
check("a public address is refused", R("93.184.216.34") is not None)
check("...saying why, in Polish", "publiczny" in (R("93.184.216.34") or ""))
check("a public IPv6 address is refused", R("2606:4700:4700::1111") is not None)
check("a hostname is refused rather than resolved", R("obs.example.com") is not None)
check("...telling the user to give an address", "adres IP" in (R("obs.example.com") or ""))

c = client()
r = c.connect("93.184.216.34", 4455)
check("connect() stops at the address check, before any socket", r.get("ok") is False)
check("...tagged public-host", r.get("code") == "public-host", json.dumps(r))
check("...and stays disconnected", c.state()["connected"] is False)
r = c.connect("127.0.0.1", 70000)
check("a port outside 1-65535 is refused", r.get("ok") is False and "Port" in r.get("error", ""))
check("...tagged bad-port", r.get("code") == "bad-port", json.dumps(r))
check("_host_reject keeps its one-value shape for direct callers",
      isinstance(R("93.184.216.34"), str) and R("127.0.0.1") is None)


# ============================== 7. A SERVER THAT NEVER SPEAKS ==============================
print("\n-- 7. cisza po uzgodnieniu --")

d = DummyObs(send_hello=False)
c = client(connect_timeout=0.8)
t0 = time.monotonic()
r = c.connect("127.0.0.1", d.port)
took = time.monotonic() - t0
check("a server that upgrades and then says nothing times out", r.get("ok") is False, json.dumps(r))
check("...within roughly the connect timeout, not forever", took < 4.0, "%.2fs" % took)
check("...and leaves nothing connected", c.state()["connected"] is False)
d.stop()


# ============================== 8. WIRED INTO THE APP ==============================
print("\n-- 8. podlaczenie do aplikacji --")

check("the application holds ONE OBS client", isinstance(getattr(rf, "OBS", None), rf.ObsClient))
_st = rf.OBS.state()
check("...which starts disconnected", _st["connected"] is False and _st["identified"] is False)
check("...and reports the shape the panel and MCP read",
      all(k in _st for k in ("connected", "identified", "needAuth", "host", "port")),
      json.dumps(_st))

print("\n=== %d PASS, %d FAIL ===" % (_passed, _failed))
sys.exit(1 if _failed else 0)
