"""Serwer gier panelu na czas prac nad nimi (Żabi chór i następne).

    py tools/gry_serwer.py --port 8777 --app 8772

* serwuje katalog web/ statycznie: gra jest pod http://127.0.0.1:8777/gry/ (adres / przekierowuje tam),
* przekazuje GET /stream do aplikacji RibbitFlip (http://127.0.0.1:<app>/stream), strumieniowo i bez
  buforowania, żeby gra w trybie ?zywe=1 widziała kapsle tej aplikacji,
* obsługuje trasy /gry/api/ RibbitBeata tymi samymi modułami co aplikacja i RibbitBeat.exe: pakiety MIDI z Hugging Face
  i import z adresu (ribbitflip_songpacks.py) oraz pakiety piosenek z audio z konwertera (ribbitflip_piosenki.py,
  /gry/api/piosenki*); katalogi podają --pakiety i --piosenki (domyślnie osobne katalogi testowe w %TEMP%, nie profil
  użytkownika). Bez tras piosenek gra logowała 404 w konsoli przy każdym starcie (2026-10-21).

Sama aplikacja serwuje grę pod /web/gry/ (przycisk „Gra” pod Synthem). Ten serwer zostaje do prac nad grą:
pliki bez pamięci podręcznej i strumień kapsli z aplikacji na innym porcie, pod JEDNYM adresem (aplikacja nie
ma CORS, więc strona z innego portu nie mogłaby czytać jej /stream). Do aplikacji idzie jak zwykła karta tej
samej maszyny (Host 127.0.0.1, bez Origin), czyli przez tę samą bramkę co panel. Adres z podwójnym ukośnikiem
(np. /gry//) przekierowuje na poprawny, bo inaczej ścieżki względne (../assets/) liczyłyby się źle.

Słucha wyłącznie na 127.0.0.1. Port 8770 to działająca aplikacja: tu go nie używamy (do symulacji
uruchom osobną kopię: ribbitflip_monitor.py --simulate --no-open --allow-multi --port 8772).
"""
import argparse
import functools
import http.client
import http.server
import json
import os
import re
import sys
from urllib.parse import parse_qs

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ribbitflip_songpacks as rsp   # noqa: E402  (ten sam moduł tras /gry/api/ co w aplikacji)
import ribbitflip_piosenki as rpi    # noqa: E402  (pakiety piosenek z audio: /gry/api/piosenki*, jak w aplikacji i RibbitBeat.exe)

KATALOG_WEB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web")
# MIME podane wprost: na Windows `mimetypes` czyta rejestr i potrafi dać .js jako text/plain albo .mid
# jako audio/mid, a przeglądarka przy pobieraniu fontu chce font/woff2.
TYPY = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".mid": "audio/midi",
    ".midi": "audio/midi",
    ".txt": "text/plain; charset=utf-8",
}


class Obsluga(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map, **TYPY)
    port_aplikacji = 8772

    def do_GET(self):
        sciezka = self.path.split("?", 1)[0]
        if "//" in sciezka:
            # /gry// i podobne: ścieżki względne (../assets/) liczyłyby się od pustego katalogu
            cel = re.sub(r"/{2,}", "/", sciezka) + (("?" + self.path.split("?", 1)[1]) if "?" in self.path else "")
            self.send_response(301)
            self.send_header("Location", cel)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if sciezka == "/stream":
            return self._strumien()
        if sciezka.startswith("/gry/api/"):
            return self._api("GET", None)
        if sciezka == "/":
            self.send_response(302)
            self.send_header("Location", "/gry/")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        return super().do_GET()

    def do_POST(self):
        sciezka = self.path.split("?", 1)[0]
        if not sciezka.startswith("/gry/api/"):
            return self.send_error(404)
        try:
            n = int(self.headers.get("Content-Length") or 0)
            dane = json.loads(self.rfile.read(n).decode("utf-8")) if n else None
        except Exception:
            return self.send_error(400, "Nieprawidłowy JSON")
        return self._api("POST", dane)

    def _api(self, metoda, dane):
        czesci = self.path.split("?", 1)
        q = parse_qs(czesci[1]) if len(czesci) > 1 else {}
        try:
            # kolejność jak w ribbitbeat_app.py: piosenki z audio (czytają Range z nagłówków), potem pakiety MIDI
            w = rpi.obsluz_trase(metoda, czesci[0], q, dane, naglowki=self.headers)
            if w is None:
                w = rsp.obsluz_trase(metoda, czesci[0], q, dane)
        except Exception as e:
            w = (500, "application/json; charset=utf-8",
                 json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8"), {})
        if w is None:
            return self.send_error(404)
        status, typ, body, naglowki = w
        self.send_response(status)
        self.send_header("Content-Type", typ)
        self.send_header("Content-Length", str(len(body)))
        for k, v in naglowki.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # pliki gry zmieniają się w trakcie prac: bez pamięci podręcznej, każdy F5 widzi ostatnią wersję
        if not self.path.startswith("/stream"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _strumien(self):
        try:
            polaczenie = http.client.HTTPConnection("127.0.0.1", self.port_aplikacji, timeout=5)
            polaczenie.request("GET", self.path, headers={"Accept": "text/event-stream", "Cache-Control": "no-cache"})
            # gniazdo trzeba złapać PRZED getresponse(): odpowiedź bez długości i z „Connection: close”
            # zabiera je połączeniu (polaczenie.sock staje się None), a czytamy z niego dalej
            gniazdo = polaczenie.sock
            odp = polaczenie.getresponse()
        except OSError as e:
            self.send_error(502, "Aplikacja RibbitFlip nie odpowiada na porcie %d (%s)" % (self.port_aplikacji, e))
            return
        if odp.status != 200:
            self.send_error(502, "Aplikacja odpowiedziała %d" % odp.status)
            polaczenie.close()
            return
        gniazdo.settimeout(None)   # strumień może milczeć dowolnie długo
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        self.end_headers()
        try:
            while True:
                kawalek = odp.read1(65536)   # tyle, ile już przyszło: bez czekania na pełny bufor
                if not kawalek:
                    break
                self.wfile.write(kawalek)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass   # karta zamknięta albo aplikacja zatrzymana: EventSource sam się połączy ponownie
        finally:
            polaczenie.close()
        self.close_connection = True

    def log_message(self, fmt, *args):
        if "/stream" in (self.path or "") or (len(args) > 1 and str(args[1])[:1] in "45"):
            sys.stderr.write("[gry] " + (fmt % args) + "\n")


def main():
    p = argparse.ArgumentParser(description="Serwer gier RibbitFlip: web/ statycznie + /stream z aplikacji")
    p.add_argument("--port", type=int, default=8777, help="port tego serwera (domyślnie 8777)")
    p.add_argument("--app", type=int, default=8772, help="port aplikacji RibbitFlip z /stream (domyślnie 8772)")
    p.add_argument("--pakiety", default=os.path.join(os.environ.get("TEMP", "."), "ribbitbeat-pakiety-test"),
                   help="katalog pakietów MIDI (domyślnie testowy w %%TEMP%%, nie profil użytkownika)")
    p.add_argument("--piosenki", default=os.path.join(os.environ.get("TEMP", "."), "ribbitbeat-piosenki-test"),
                   help="katalog pakietów piosenek z audio (domyślnie testowy w %%TEMP%%, nie %%LOCALAPPDATA%%\\RibbitFlip\\Piosenki)")
    a = p.parse_args()
    os.environ["RIBBITFLIP_SONGPACKS_DIR"] = a.pakiety
    os.environ["RIBBITFLIP_PIOSENKI_DIR"] = a.piosenki
    if a.port == 8770:
        sys.exit("Port 8770 należy do aplikacji. Wybierz inny, np. --port 8777.")
    Obsluga.port_aplikacji = a.app
    serwer = http.server.ThreadingHTTPServer(("127.0.0.1", a.port), functools.partial(Obsluga, directory=KATALOG_WEB))
    serwer.daemon_threads = True
    print("Gry: http://127.0.0.1:%d/gry/   (strumień kapsli z http://127.0.0.1:%d/stream)" % (a.port, a.app))
    try:
        serwer.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        serwer.server_close()


if __name__ == "__main__":
    main()
