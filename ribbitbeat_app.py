"""RibbitBeat jako osobny program (RibbitBeat.exe, RibbitBeat.spec): sama gra, bez aplikacji RibbitFlip.

Co robi po dwukliku:
* stawia mały serwer HTTP wyłącznie na 127.0.0.1, zawsze na porcie PORT_GRY (38770; zajęty: wolny od systemu),
  bo przeglądarka trzyma zapis gry osobno dla każdego portu,
* serwuje grę pod /gry/ i jej obrazki/fonty pod /assets/ (ten sam układ co web/ aplikacji, więc względne
  ścieżki gry `../assets/…` działają bez zmian w plikach gry),
* obsługuje trasy /gry/api/ (pakiety MIDI z Hugging Face, import piosenki z adresu) TYM SAMYM modułem co
  aplikacja (ribbitflip_songpacks.py), z tym samym katalogiem pakietów użytkownika
  (%LOCALAPPDATA%\\RibbitFlip\\SongPacks), więc pakiet pobrany w aplikacji jest od razu w grze i odwrotnie,
* przekazuje GET /stream do aplikacji RibbitFlip na porcie 8770, jeśli ta działa: wtedy gra widzi kapsle.
  Gdy aplikacji nie ma, strumień i tak odpowiada 200 i czeka (komentarze SSE co kilka sekund), aż aplikacja
  wstanie. Odpowiedź 502/503 zamknęłaby EventSource na stałe z błędem w konsoli, a gra bez aplikacji jest
  pełnoprawną grą: mysz, klawiatura i pad działają bez niej,
* otwiera grę w oknie pełnoekranowym Edge albo Chrome (`--app`, własny profil w
  %LOCALAPPDATA%\\RibbitBeat\\Przegladarka) i kończy pracę, gdy to okno się zamknie. Bez Edge i Chrome:
  domyślna przeglądarka i okienko „zamknij, aby zakończyć”.

Jedna instancja (mutex jak w aplikacji). Drugie uruchomienie nie stawia drugiego serwera, tylko otwiera
okno gry pod adresem pierwszego (zapisanym w %LOCALAPPDATA%\\RibbitBeat\\adres.txt).

Do prac i testów:
    py ribbitbeat_app.py --no-open --port 8781      sam serwer, bez okna i bez mutexu (Ctrl+C kończy)
    py ribbitbeat_app.py --app 8772                 strumień kapsli z kopii aplikacji na innym porcie

Nie importuje ribbitflip_monitor.py: to cała aplikacja (BLE, wyjścia, tray) i startuje przy imporcie.
"""
import argparse
import http.client
import http.server
import json
import os
import re
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from urllib.parse import parse_qs

import ribbitflip_songpacks as rsp   # te same trasy /gry/api/ co w aplikacji i w tools/gry_serwer.py
import ribbitflip_piosenki as rpi    # pakiety piosenek z audio (trasy /gry/api/piosenki*), jak w aplikacji


def _resource_dir():
    """Katalog zasobów: w .exe (PyInstaller onefile) rozpakowany `sys._MEIPASS`, ze źródeł katalog skryptu."""
    return getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))


KATALOG_WEB = os.path.join(_resource_dir(), "web")
# Tylko to, czego gra używa. Ze źródeł web/ ma w sobie cały panel aplikacji; tu go nie wystawiamy, żeby
# serwer ze źródeł zachowywał się tak samo jak .exe, w którym panelu w ogóle nie ma.
DOZWOLONE = ("gry", "assets")
PORT_APLIKACJI = 8770
DANE = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Local"),
                    "RibbitBeat")
MUTEX = "RibbitBeat.SingleInstance"
# Stały port, bo przeglądarka trzyma zapis gry (localStorage) osobno dla każdego adresu
# z portem, a wcześniej port był losowy przy każdym starcie, więc każde uruchomienie zaczynało od pustego zapisu. Teraz
# zawsze ten sam port.
#
# DLACZEGO PONIŻEJ 49152. Pierwszy wybór, 64767, przestał się dać zająć: Windows oddaje
# WinError 10013, bo Hyper-V (WSL, Docker, Sandbox) rezerwuje sobie przy starcie systemu całe setki portów Z ZAKRESU
# DYNAMICZNEGO — na przykład 49152–65535 (`netsh int ipv4 show dynamicport tcp`), a 64767 wpadło w zarezerwowane
# 64701–64800 (`netsh interface ipv4 show excludedportrange protocol=tcp`). Te rezerwacje zmieniają się po każdym
# restarcie, więc KAŻDY port z zakresu dynamicznego prędzej czy później przepadnie razem z zapisem gry. 38770 leży
# poniżej zakresu dynamicznego, czyli poza zasięgiem tego mechanizmu, i łatwo je zapamiętać: 8770 to port aplikacji
# RibbitFlip. Zajęty port = wolny od systemu na tę sesję (zapis z PORT_GRY wtedy niewidoczny, ale nietknięty).
PORT_GRY = 38770
# ?zywe=1: gra łączy się z /stream także poza aplikacją (pod /gry/ domyślnie tego nie robi, patrz index.html gry).
SCIEZKA_GRY = "/gry/?zywe=1"

# MIME podane wprost: na Windows `mimetypes` czyta rejestr i potrafi dać .js jako text/plain.
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
# Ta sama polityka co strona gry w aplikacji (_serve_html): gra łączy się wyłącznie z tym serwerem.
CSP = ("default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; "
       "base-uri 'none'; form-action 'none'; frame-ancestors 'none'")


class Obsluga(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map, **TYPY)
    port_aplikacji = PORT_APLIKACJI
    protocol_version = "HTTP/1.0"

    def __init__(self, *a, **k):
        super().__init__(*a, directory=KATALOG_WEB, **k)

    # ---- bramka: tylko ta maszyna i tylko ta strona -------------------------------------------
    def _obcy(self):
        """Powód odmowy albo None. Host musi być pętlą zwrotną (obrona przed DNS rebinding: obca nazwa
        wskazująca na 127.0.0.1 przychodzi z SWOJĄ nazwą w Host), a Origin, jeśli jest, musi być nasz:
        obca strona w przeglądarce nie może zlecić temu serwerowi pobierania ani kasowania pakietów."""
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip().lower()
        if host not in ("127.0.0.1", "localhost"):
            return "Zly Host"   # ASCII: powód idzie w linii statusu HTTP (latin-1)
        origin = self.headers.get("Origin")
        if origin is not None:
            port = self.server.server_address[1]
            if origin not in ("http://127.0.0.1:%d" % port, "http://localhost:%d" % port):
                return "Obce zrodlo"
        return None

    def do_GET(self):
        powod = self._obcy()
        if powod:
            return self.send_error(403, powod)
        sciezka = self.path.split("?", 1)[0]
        if "//" in sciezka:
            # /gry// i podobne: ścieżki względne (../assets/) liczyłyby się od pustego katalogu
            cel = re.sub(r"/{2,}", "/", sciezka) + (("?" + self.path.split("?", 1)[1]) if "?" in self.path else "")
            return self._przekieruj(301, cel)
        if sciezka == "/":
            return self._przekieruj(302, SCIEZKA_GRY)
        if sciezka == "/stream":
            return self._strumien()
        if sciezka.startswith("/gry/api/"):
            return self._api("GET", None)
        if sciezka == "/gry":
            return self._przekieruj(301, "/gry/" + (("?" + self.path.split("?", 1)[1]) if "?" in self.path else ""))
        czesci = [c for c in sciezka.split("/") if c]
        if not czesci or czesci[0] not in DOZWOLONE:
            return self.send_error(404, "Not found")
        return super().do_GET()

    def do_HEAD(self):
        powod = self._obcy()
        if powod:
            return self.send_error(403, powod)
        czesci = [c for c in self.path.split("?", 1)[0].split("/") if c]
        if not czesci or czesci[0] not in DOZWOLONE or czesci[1:2] == ["api"]:
            return self.send_error(404, "Not found")
        return super().do_HEAD()

    def _odrzuc(self, kod, powod):
        """Odmowa POST-a z przeczytanym ciałem: zamknięcie gniazda z nieprzeczytanymi bajtami Windows kwituje
        RST i klient widzi zerwane połączenie zamiast powodu (to samo robi _drain_body w aplikacji)."""
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if 0 < n <= 2_000_000:
                self.rfile.read(n)
        except Exception:
            pass
        return self.send_error(kod, powod)

    def do_POST(self):
        powod = self._obcy()
        if powod:
            return self._odrzuc(403, powod)
        sciezka = self.path.split("?", 1)[0]
        if not sciezka.startswith("/gry/api/"):
            return self._odrzuc(404, "Not found")
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n > 2_000_000:
                raise ValueError("za duże")
            dane = json.loads(self.rfile.read(n).decode("utf-8")) if n else None
        except Exception:
            return self.send_error(400, "Nieprawidlowy JSON")
        return self._api("POST", dane)

    def list_directory(self, path):
        # katalog bez index.html nie jest stroną: zamiast spisu plików zwykłe 404
        self.send_error(404, "Not found")
        return None

    def _przekieruj(self, kod, cel):
        self.send_response(kod)
        self.send_header("Location", cel)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _api(self, metoda, dane):
        czesci = self.path.split("?", 1)
        try:
            q = parse_qs(czesci[1]) if len(czesci) > 1 else {}
            w = rpi.obsluz_trase(metoda, czesci[0], q, dane, naglowki=self.headers)
            if w is None:
                w = rsp.obsluz_trase(metoda, czesci[0], q, dane)
        except Exception as e:
            w = (500, "application/json; charset=utf-8",
                 json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8"), {})
        if w is None:
            return self.send_error(404, "Not found")
        status, typ, body, naglowki = w
        self.send_response(status)
        self.send_header("Content-Type", typ)
        self.send_header("Content-Length", str(len(body)))
        for k, v in naglowki.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        if not self.path.startswith("/stream"):
            self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        if self.path.split("?", 1)[0] in ("/gry/", "/gry/index.html"):
            self.send_header("Content-Security-Policy", CSP)
        super().end_headers()

    # ---- /stream: kapsle z aplikacji RibbitFlip, jeśli działa --------------------------------
    def _polacz_z_aplikacja(self):
        """(połączenie, gniazdo, odpowiedź) strumienia aplikacji albo None, gdy aplikacja nie odpowiada."""
        try:
            pol = http.client.HTTPConnection("127.0.0.1", self.port_aplikacji, timeout=3)
            pol.request("GET", self.path, headers={"Accept": "text/event-stream", "Cache-Control": "no-cache"})
            # gniazdo trzeba złapać PRZED getresponse(): odpowiedź bez długości i z „Connection: close”
            # zabiera je połączeniu (pol.sock staje się None), a czytamy z niego dalej
            gniazdo = pol.sock
            odp = pol.getresponse()
        except OSError:
            return None
        if odp.status != 200:
            pol.close()
            return None
        return pol, gniazdo, odp

    def _strumien(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True
        try:
            self.wfile.write(b": RibbitBeat\n\n")
            self.wfile.flush()
            while not getattr(self.server, "zamykam", False):
                p = self._polacz_z_aplikacja()
                if p is None:
                    # aplikacji nie ma: komentarz SSE (gra go ignoruje) i ponowna próba za chwilę;
                    # zapis do zamkniętej karty rzuca wyjątek i kończy tę pętlę
                    self.wfile.write(b": czekam na RibbitFlip\n\n")
                    self.wfile.flush()
                    time.sleep(3)
                    continue
                pol, gniazdo, odp = p
                try:
                    gniazdo.settimeout(None)   # strumień może milczeć dowolnie długo
                    while True:
                        kawalek = odp.read1(65536)   # tyle, ile już przyszło: bez czekania na pełny bufor
                        if not kawalek:
                            break                     # aplikacja zamknięta: wracamy do czekania
                        self.wfile.write(kawalek)
                        self.wfile.flush()
                except (http.client.HTTPException, socket.timeout):
                    pass
                finally:
                    pol.close()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass   # okno gry zamknięte

    def log_message(self, fmt, *args):
        # .exe bez konsoli nie ma stderr; ze źródeł logujemy tylko błędy
        if sys.stderr is not None and len(args) > 1 and str(args[1])[:1] in "45":
            try:
                sys.stderr.write("[ribbitbeat] " + (fmt % args) + "\n")
            except Exception:
                pass


def uruchom_serwer(port=None, port_aplikacji=PORT_APLIKACJI):
    """Serwer na 127.0.0.1 w wątku w tle; port None = PORT_GRY (zajęty: wolny od systemu), 0 = wolny od systemu.
    Zwraca (serwer, adres bazowy)."""
    Obsluga.port_aplikacji = port_aplikacji
    rsp.ustaw_katalog_manifestow(os.path.join(_resource_dir(), "packs"))
    if port is None:
        try:
            serwer = http.server.ThreadingHTTPServer(("127.0.0.1", PORT_GRY), Obsluga)
        except OSError as e:
            print("RibbitBeat: port %d zajęty (%s), biorę wolny; zapis gry z tego portu będzie niewidoczny w tej sesji"
                  % (PORT_GRY, e), flush=True)
            serwer = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Obsluga)
    else:
        serwer = http.server.ThreadingHTTPServer(("127.0.0.1", port), Obsluga)
    serwer.daemon_threads = True
    threading.Thread(target=serwer.serve_forever, name="ribbitbeat-http", daemon=True).start()
    return serwer, "http://127.0.0.1:%d" % serwer.server_address[1]


def zatrzymaj_serwer(serwer):
    serwer.zamykam = True
    serwer.shutdown()
    serwer.server_close()


# ---- jedna instancja ------------------------------------------------------------------------------
_UCHWYT = []


def jedyna_instancja():
    """True = jesteśmy jedyni. Ten sam sposób co SingleInstance aplikacji: nazwany mutex w sesji
    użytkownika; zapytanie, które się nie uda, nie blokuje programu."""
    if os.name != "nt":
        return True
    try:
        import ctypes
        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.CreateMutexW.argtypes = (ctypes.c_void_p, ctypes.c_int, ctypes.c_wchar_p)
        k32.CreateMutexW.restype = ctypes.c_void_p
        h = k32.CreateMutexW(None, 0, MUTEX)
        err = ctypes.get_last_error()
        if not h:
            return True
        if err == 183:   # ERROR_ALREADY_EXISTS
            k32.CloseHandle(ctypes.c_void_p(h))
            return False
        _UCHWYT.append(h)   # trzymamy do końca procesu
        return True
    except Exception:
        return True


# ---- okno gry -------------------------------------------------------------------------------------
def znajdz_przegladarke():
    """Pełna ścieżka do msedge.exe, a gdy go nie ma, do chrome.exe; None, gdy nie ma żadnej z nich."""
    pf = [os.environ.get(k) for k in ("ProgramFiles(x86)", "ProgramFiles", "ProgramW6432", "LOCALAPPDATA")]
    pf = [p for p in pf if p]
    for exe, podkatalog in (("msedge.exe", os.path.join("Microsoft", "Edge", "Application")),
                            ("chrome.exe", os.path.join("Google", "Chrome", "Application"))):
        for baza in pf:
            s = os.path.join(baza, podkatalog, exe)
            if os.path.isfile(s):
                return s
        s = _z_rejestru(exe)
        if s:
            return s
    return None


def _z_rejestru(exe):
    try:
        import winreg
    except ImportError:
        return None
    for galaz in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        try:
            with winreg.OpenKey(galaz, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\\" + exe) as k:
                s = winreg.QueryValue(k, None)
        except OSError:
            continue
        s = (s or "").strip().strip('"')
        if s and os.path.isfile(s):
            return s
    return None


def otworz_okno(przegladarka, url):
    """Okno gry w trybie aplikacji, na pełnym ekranie, z własnym profilem (osobny proces przeglądarki,
    niezależny od zwykłych kart użytkownika). Zwraca Popen."""
    profil = os.path.join(DANE, "Przegladarka")
    os.makedirs(profil, exist_ok=True)
    return subprocess.Popen([przegladarka, "--app=" + url, "--start-fullscreen", "--user-data-dir=" + profil,
                             "--no-first-run", "--no-default-browser-check", "--disable-features=Translate"])


def komunikat(tekst, tytul="RibbitBeat"):
    """Okienko systemowe (bez tkintera: .exe ma być mały). Blokuje do zamknięcia."""
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, tekst, tytul, 0x40)   # MB_ICONINFORMATION
    except Exception:
        try:
            input(tekst + "\n[Enter kończy] ")
        except Exception:
            pass


def _zapisz_adres(url):
    try:
        os.makedirs(DANE, exist_ok=True)
        with open(os.path.join(DANE, "adres.txt"), "w", encoding="utf-8") as f:
            f.write(url)
    except OSError:
        pass


def _czytaj_adres():
    try:
        with open(os.path.join(DANE, "adres.txt"), encoding="utf-8") as f:
            url = f.read().strip()
        return url if re.fullmatch(r"http://127\.0\.0\.1:\d+/gry/\S*", url) else None
    except OSError:
        return None


def pokaz_gre(url, czekaj):
    """Otwiera okno gry. `czekaj`: czy czekać do jego zamknięcia (pierwsza instancja) czy nie (druga)."""
    przegladarka = znajdz_przegladarke()
    if przegladarka:
        try:
            start = time.monotonic()
            proc = otworz_okno(przegladarka, url)
            if not czekaj:
                return
            proc.wait()
            # Proces, który kończy się od razu, przekazał okno przeglądarce już działającej na tym profilu
            # (np. po awarii poprzedniego uruchomienia). Wtedy nie wiemy, kiedy okno się zamknie: serwer
            # zostaje do zamknięcia okienka, tak samo jak bez Edge i Chrome.
            if time.monotonic() - start > 5:
                return
        except OSError:
            webbrowser.open(url)
    else:
        webbrowser.open(url)
    if czekaj:
        komunikat("RibbitBeat działa pod adresem\n%s\n\nZamknij to okno, aby zakończyć grę." % url)


def main(argv=None):
    p = argparse.ArgumentParser(description="RibbitBeat: gra rytmiczna RibbitFlip jako osobny program")
    p.add_argument("--port", type=int, default=None,
                   help="port serwera (domyślnie %d, żeby zapis gry przetrwał restart; 0 = wolny od systemu)" % PORT_GRY)
    p.add_argument("--app", type=int, default=PORT_APLIKACJI,
                   help="port aplikacji RibbitFlip, z której idą kapsle (domyślnie %d)" % PORT_APLIKACJI)
    p.add_argument("--no-open", action="store_true",
                   help="sam serwer: bez okna gry i bez blokady jednej instancji (prace i testy)")
    a = p.parse_args(argv)
    if a.port == PORT_APLIKACJI:
        sys.exit("Port %d należy do aplikacji RibbitFlip. Wybierz inny." % PORT_APLIKACJI)

    if a.no_open:
        serwer, baza = uruchom_serwer(a.port, a.app)
        if sys.stdout is not None:
            print("RibbitBeat: %s/gry/   (kapsle z http://127.0.0.1:%d/stream)" % (baza, a.app), flush=True)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            pass
        finally:
            zatrzymaj_serwer(serwer)
        return

    if not jedyna_instancja():
        url = _czytaj_adres()
        if url:
            pokaz_gre(url, czekaj=False)
        else:
            komunikat("RibbitBeat już działa.")
        return

    serwer, baza = uruchom_serwer(a.port, a.app)
    url = baza + SCIEZKA_GRY
    _zapisz_adres(url)
    try:
        pokaz_gre(url, czekaj=True)
    finally:
        zatrzymaj_serwer(serwer)


if __name__ == "__main__":
    main()
