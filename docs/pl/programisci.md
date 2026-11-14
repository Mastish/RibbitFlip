# Dla programistów

← [README](../../README.md) · [English](../en/developers.md)

**Uruchamianie ze źródeł.** Potrzebujesz Windowsa i Pythona 3.10 lub nowszego.

```bash
pip install -r requirements.txt
python ribbitflip_monitor.py --simulate     # bez sprzętu: ruch udawany, wyjścia prawdziwe
python ribbitflip_monitor.py                # prawdziwy kapsel, pełne sterowanie
```

W obu przypadkach startuje lokalny serwer `http://127.0.0.1:8770/` i otwiera się panel
w przeglądarce. Flaga `--simulate` robi to samo co przełącznik **LIVE / Symulacja** w panelu.

> **Podpowiedź dla Windows:** jeśli `python` otwiera Microsoft Store („Python was not found"),
> użyj launchera **`py`**: `py ribbitflip_monitor.py`.

## Pod maską

Trzy elementy, wszystkie na Twoim komputerze:

1. **Kapsel** wysyła po BLE dane z 6-osiowego IMU oraz stan przycisku, baterii i siły sygnału
   (usługa w stylu Nordic UART, `6e4000xx`, odtworzona przez społeczność, patrz
   [`CREDITS.md`](../CREDITS.md)).
2. **`ribbitflip_monitor.py`** dekoduje pakiety, stabilizuje pozycję (filtr 1-Euro, krzywa expo,
   kalibracja, auto-tare) i wykonuje reguły, które ustawisz.
3. **Moduły wyjścia** zamieniają wynik w realne sterowanie: klawisze, ruch myszy, wirtualny pad,
   komunikaty MIDI/OSC, wywołania REST.

Panel to statyczna strona serwowana przez ten sam lokalny proces. Dane na żywo odbiera przez
Server-Sent Events. Zero budowania, zero bundlera, zero chmury.

**Układ repozytorium**

```text
ribbitflip_monitor.py     klient BLE, potok pozycji, silniki wyjścia, lokalny serwer HTTP (prawie 28 tys. linii)
ribbitflip_audio.py       samodzielny skrypt audio, bez panelu
ribbitflip_gesture.py     nagrane gesty: nagrywanie i porównywanie ruchu
ribbitflip_mcp.py         serwer MCP dla asystentów AI
web/                      cały front: powłoka HTML + 149 modułów JS (rf-NN-*.js, ładowane po kolei) + 29 plików CSS
docs/                     strona projektu, zrzuty ekranu, diagramy, MCP.md
examples/                 oczyszczone przykłady konfiguracji
Presets/                  zestawy dołączone do programu (tylko do odczytu, wbudowane w .exe)
tests/                    skrypty testowe w Pythonie + harnessy Node
tools/                    osc_monitor.py, mcp_stdio_bridge.py, build_banner.py (+ build_banner_art.txt,
                          make_banner_art.py), gamepad_art.py, wii_art.py
RibbitFlip.spec           przepis PyInstallera na jednoplikowy .exe
```

**Potok sygnału** (klasy w `ribbitflip_monitor.py`)

```
PuckSource → DeviceBus → Device → PoseFilter → TriggerEngine │ AirMouse │ MidiMapper
                                                             └→ KeyEmitter · GamepadEmitter
                                                                MidiEmitter · OscEmitter
```

**Lokalny serwer** nasłuchuje wyłącznie na `127.0.0.1:8770` (zmiana przez `--port`). `GET /stream`
to strumień Server-Sent Events, którego słucha panel; do tego ponad 100 ścieżek JSON. Każde
wywołanie zmieniające stan niesie nagłówek CSRF `X-RibbitFlip-Token`, a obce źródła odrzuca
bramka Host/Origin. Serwer słucha wyłącznie na adresie lokalnym (loopback) i to jest granica
bezpieczeństwa: token sesji zatrzymuje inne strony w przeglądarce, ale nie inne programy
uruchomione na Twoim koncie.

**Połączenia wychodzące.** Usługi sieciowe: tylko http/https, bez przekierowań. Klient OBS:
websocket (obs-websocket) tylko na adres lokalny albo w sieci domowej; hasło do OBS i tokeny usług
zostają w przeglądarce, dalej jedzie tylko podpis. Pobranie zestawu z odnośnika (`/setup/fetch`):
tylko https i tylko z listy dozwolonych hostów: CDN Discorda, `raw.githubusercontent.com` i gist.
Paczka diagnostyczna to zip z listy dozwolonych plików, bez sejfu haseł, profilu przeglądarki
nakładek, zawartości zestawów i nazwy konta Windows; klucze zredagowane, adres Bluetooth przycięty,
zapisywany do katalogu `Zgloszenia/`. Pełny model: [`SECURITY.md`](../../.github/SECURITY.md).

**Konfiguracja na dysku** to zwykły JSON obok pliku wykonywalnego, w folderach `Settings`
i `Library`: osobny komplet dla każdego slotu urządzenia (`*_rules.json`, `*_midi.json`,
`*_mouse.json`, `*_pose.json`, `*_power.json`, `*_wheel.json`, `*_devices.json`), kilka plików
wspólnych (m.in. `Settings/ribbitflip_synth.json`, dziennik usług
`Settings/ribbitflip_rest_log.jsonl`, profil przeglądarki nakładek `Settings/OverlayBrowser/`) oraz
zestawy do dzielenia się. Kształty plików: [`examples/`](../../examples).

**Sejf na sekrety.** Dane logowania do usług szyfruje przeglądarka (WebCrypto, PBKDF2-SHA-256,
310 000 iteracji → AES-GCM-256). Hasło ani jawna treść nie trafiają do procesu Pythona.

**Wyjścia w szczegółach.** OSC wysyła float/int/bool po UDP. Kontroler Wii wychodzi protokołem
DSU na `127.0.0.1:26760`. MIDI idzie przez systemowy `winmm`, bez dodatkowych bibliotek. Synth
gra przez WebAudio.

**Skrypt audio** [`ribbitflip_audio.py`](../../ribbitflip_audio.py) steruje głośnością bez panelu,
a [`ribbitflip_audio_launcher.vbs`](../../examples/ribbitflip_audio_launcher.vbs) uruchamia go cicho.

## Flagi wiersza poleceń

Przy zwykłym używaniu żadna flaga nie jest potrzebna. Te przydają się, gdy uruchamiasz
aplikację ze źródeł albo ze skrótu:

| Flaga | Kiedy się przydaje |
|---|---|
| `--simulate` | Chcesz wypróbować aplikację bez kapsla. Ruch jest udawany, ale wyjścia działają naprawdę, dlatego moduły startują wyłączone. |
| `--no-keys` | Chcesz obejrzeć kapsel bez ryzyka: do systemu nie wyjdzie żaden klawisz ani ruch myszy. |
| `--port <liczba>` | Port `8770` zajmuje już inny program. |
| `--no-mcp` | Chcesz na stałe zablokować asystenta AI, niezależnie od przełącznika w panelu. |
| `--disable <moduły>` | Komputer jest słabszy i chcesz, żeby wymienione moduły w ogóle nie wstawały, np. `--disable kolo,skaner`. |
| `--only <moduły>` | Odwrotnie: wstają tylko wymienione moduły, ich wymagania i moduły podstawowe. |
| `--list-modules` | Chcesz zobaczyć nazwy modułów i zależności. |

Lista modułów, zależności i przykłady: [Słabszy komputer](funkcje.md#słabszy-komputer-uruchom-tylko-potrzebne-moduły).
Co w danym uruchomieniu działa, mówi `GET /modules` (powód przy każdym wyłączonym module i nazwy
wątków silników), a trasy wyłączonego modułu odpowiadają `404` z polami `disabled`, `module` i `error`.
Wybór z panelu leży w `Settings/ribbitflip_modules.json` (`{"disable": [...]}`) i liczy się tylko
wtedy, gdy milczą parametr i zmienne. Czyta go `GET /modules/startup`, zapisuje `POST /modules/startup`
(z tokenem sesji, te same nazwy co `--disable`), a `POST /modules/restart` uruchamia aplikację ponownie.

Pozostałe flagi służą do testów i diagnostyki. Opisuje je
[`CONTRIBUTING.md`](../../.github/CONTRIBUTING.md), a wypisze `python ribbitflip_monitor.py --help`.

**Test OSC bez dodatkowych programów.** Uruchom `python tools/osc_monitor.py` (nasłuch na UDP
`127.0.0.1:9000`; z `--lan` usłyszy też inny komputer), dodaj mapowanie OSC i włącz moduł: komunikaty wypisują się na żywo. Działa też
[Protokol](https://hexler.net/protokol) (darmowy, od twórców TouchOSC).

## Budowa `.exe`

Plik z Releases jest niepodpisany, a program z założenia wciska klawisze i rusza myszą, więc
zbudowanie go samodzielnie to najprostszy sposób, żeby sprawdzić, co uruchamiasz: te same źródła,
Twój komputer, Twoja kopia. Licencje `pynput` i `pystray` (LGPL) i tak wymagają jawnego przepisu.

Potrzebujesz Windowsa i Pythona 3.10 lub nowszego. Wersja 1.0.0 powstała na Pythonie 3.14
i PyInstallerze 6.19.

```bash
pip install -r requirements.txt
pip install pyinstaller
build_exe.bat        # albo: py -m PyInstaller --noconfirm --clean RibbitFlip.spec
```

`build_exe.bat` woła to samo polecenie, ale najpierw sprawdza, czy aplikacja nie jest uruchomiona,
i używa launchera `py`, więc nie trafia w zaślepkę ze Sklepu Microsoft.

**Trzy warianty.** Bez parametru (dwuklik) powstają pełna aplikacja i gra, `RibbitFlip.exe` i `RibbitBeat.exe`;
`build_exe.bat full` buduje samą aplikację. `build_exe.bat essential` buduje
`RibbitFlip-Essential.exe` bez Syntha i bez gry (ten sam przepis `RibbitFlip.spec` ze zmienną
`RF_EDITION=lite`, bo w kodzie ta edycja nazywa się „lite”), `build_exe.bat beat` buduje samą grę `RibbitBeat.exe` z przepisu
`RibbitBeat.spec` (punkt wejścia `ribbitbeat_app.py`, bez bibliotek BLE i klawiatury, około 13 MB),
a `build_exe.bat all` wszystkie trzy po kolei.

**Co powstaje:** jeden plik `dist/RibbitFlip.exe`, około 26 MB, z `bleak`, `pynput`, `vgamepad`,
`pystray`, frontem `web/`, zestawami z `Presets/`, ikonami i tekstami licencji. **Nie ma** w nim
instalatora ViGEmBus (sterownik [instalujesz osobno](https://github.com/nefarius/ViGEmBus/releases))
ani `numpy`. **Świeży plik startuje pusty**: Ustawienia, Biblioteka i zgłoszenia leżą obok `.exe`,
więc kopia w `dist/` nie widzi konfiguracji pliku pobranego z Releases.

**Kiedy coś pójdzie nie tak:**

| Co widzisz | Co to znaczy |
|---|---|
| `Python was not found` | `python` trafił w zaślepkę ze Sklepu Microsoft. Użyj `py`. |
| `PermissionError: [WinError 5] ... dist\RibbitFlip.exe` | Stara kopia jeszcze chodzi i Windows trzyma plik. Zamknij ją z zasobnika. |
| `No module named objc` | Backend BLE dla macOS, na Windowsie nieużywany. Bez znaczenia. |
| `UPX is not available` | Plik wyjdzie trochę większy, nic więcej się nie zmienia. |
| Antywirus kasuje świeżo zbudowany plik | Program z PyInstallera, który wciska klawisze, z zewnątrz wygląda jak keylogger. Dodaj wyjątek na folder i zgłoś fałszywy alarm. Szerzej w [FAQ na stronie projektu](https://mastish.github.io/RibbitFlip/#faq). |

**Suma kontrolna.** Na koniec `build_exe.bat` wypisuje pod żabą SHA-256 świeżego pliku (to samo
policzy `certutil -hashfile dist\RibbitFlip.exe SHA256`). Odpowiada ona na pytanie, czy kopia
z pendrive'a to ta sama, która wyszła z Twojego komputera. Dwa buildy z tych samych źródeł nie są
identyczne co do bajtu, bo PyInstaller wpisuje w plik ścieżki i znaczniki czasu, więc porównanie
z wydaniem niczego nie rozstrzygnie.

Nie chcesz niczego budować? Uruchom aplikację ze źródeł, jak opisano na początku części
[Dla programistów](#dla-programistów).
