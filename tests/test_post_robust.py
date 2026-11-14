# Test ODPORNOŚCI POST na złe ciało żądania (fala testów przed 1.0, 2026-10-15).
# Uruchom: py tests/test_post_robust.py
#
# Fuzzing żywej instancji znalazł trzy rzeczy, które ten plik przypina:
#   * ciało-skalar ("x", 7) wywracało handler na .get() i zrywało połączenie bez odpowiedzi,
#   * POST /mode bez pola `simulate` ({} albo lista) czytał się jak „prawdziwy kapsel” i restartował
#     aplikację z symulacji w tryb sprzętowy,
#   * samotny surogat UTF-16 ("\ud800", np. emoji ucięte w pół) przechodził przez json.loads,
#     a potem nie dawał się zakodować z powrotem — w nazwie wywracał /stream przy każdym połączeniu.
# Serwer stoi na make_handler z zaślepkami: bez BLE, bez emitera, bez zapisu w Settings/.
import http.client
import json
import os
import sys
import threading
from http.server import ThreadingHTTPServer

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
        print("FAIL  %s%s" % (name, ("  -> " + str(detail)) if detail else ""))


class _StubB:
    config = {"simulate": True}

    def publish(self, ev):
        pass


class _StubDM:
    """Jeden slot, który nic nie robi — /mode stoi za bramką „jest slot" (503 bez niego)."""

    devices = {"d0": object()}
    default_id = "d0"

    def get(self, dev_id):
        return self.devices.get(dev_id)


restarts = []
rf._do_mode_restart = lambda want: restarts.append(want)   # nigdy prawdziwy restart w teście

TOK = "t" * 32
Handler = rf.make_handler(_StubB(), _StubDM(), token=TOK, mcp_ctx={"enabled": False})
srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()


def post(path, body):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    try:
        c.request("POST", path, body=body, headers={
            "Content-Type": "application/json", "X-RibbitFlip-Token": TOK,
            "Host": "127.0.0.1:%d" % port, "Content-Length": str(len(body))})
        r = c.getresponse()
        return r.status, r.read()
    except Exception as e:
        return "EXC", repr(e).encode()
    finally:
        c.close()


for body in (b'"x"', b"7", b"true"):
    st, _ = post("/mode", body)
    check("ciało-skalar %s -> 400, a nie zerwane połączenie" % body.decode(), st == 400, st)

for body in (b"{}", b"[]", b'{"simulate":"no"}', b"null"):
    st, _ = post("/mode", body)
    check("/mode %s bez prawdziwego `simulate` -> 400" % body.decode(), st == 400, st)
check("…i żadna z tych prób nie zrestartowała aplikacji", restarts == [], restarts)

st, d = post("/mode", b'{"simulate":true}')
check("/mode w tym samym trybie -> 200 bez restartu", st == 200 and b'"restart": false' in d and restarts == [], (st, d))
st, d = post("/mode", b'{"simulate":false}')
__import__("time").sleep(0.8)   # restart idzie z threading.Timer(0.5) — najpierw odpowiedź, potem restart
check("/mode z prawdziwą zmianą -> restart zlecony", st == 200 and restarts == [False], (st, restarts))

# Samotny surogat: _read_json zamienia go na „?", więc dalej wszystko koduje się do UTF-8.
class _Fake:
    def __init__(self, raw):
        import io
        self.headers = {"Content-Length": str(len(raw))}
        self.rfile = io.BytesIO(raw)


raw = b'{"name":"a\\ud800b","emoji":"\\ud83d\\ude00","lista":["\\udfff"]}'
obj = Handler._read_json(_Fake(raw))
enc_ok = True
try:
    json.dumps(obj, ensure_ascii=False).encode("utf-8")
except UnicodeEncodeError:
    enc_ok = False
check("samotny surogat nie przeżywa _read_json (koduje się do UTF-8)", enc_ok, ascii(obj))
check("…zamieniony na „?”, reszta nazwy zostaje", obj.get("name") == "a?b" and obj.get("lista") == ["?"], ascii(obj))
check("…a poprawna para (emoji) zostaje emoji", obj.get("emoji") == "\U0001F600", ascii(obj))
check("zwykłe ciało bez \\u przechodzi bez zmian",
      Handler._read_json(_Fake('{"name":"Żaba 🐸"}'.encode("utf-8"))) == {"name": "Żaba 🐸"})

srv.shutdown()
print("\n%d passed, %d failed" % (_passed, _failed))
sys.exit(1 if _failed else 0)
