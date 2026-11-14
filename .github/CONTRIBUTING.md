# Jak pomóc w rozwoju RibbitFlipa / Contributing to RibbitFlip

**[Polski](#polski)** · [English](#english)

---

## Polski

Dzięki za zainteresowanie! RibbitFlip to mały projekt hobbystyczny rozwijany po godzinach, więc
odpowiedzi mogą chwilę potrwać. Zgłoszenia i niewielkie, konkretne pull requesty są mile widziane.

### Przygotowanie środowiska

```bash
git clone <adres-twojego-forka>
cd RibbitFlip
pip install -r requirements.txt
python ribbitflip_monitor.py --simulate     # działa bez sprzętu
```

Panel otwiera się pod adresem `http://127.0.0.1:8770/`. `--simulate` podaje sztuczne dane z
czujnika, więc cały interfejs i wszystkie wyjścia da się rozwijać bez fizycznego kapsla.

### Przełączniki wiersza poleceń

README wymieniają tylko cztery przełączniki, których może potrzebować użytkownik. Pełna lista, do
pracy nad kodem i do testów:

| Przełącznik | Znaczenie |
|---|---|
| `--simulate` | Sztuczny ruch, bez sprzętu. Wyjście jest prawdziwe: moduły startują wyłączone, a pierwsze włączenie prosi o potwierdzenie. |
| `--no-keys` | Prawdziwy kapsel, ale aplikacja nie wysyła żadnego zdarzenia klawiatury ani myszy (tylko podgląd). |
| `--port <int>` | Port serwera (domyślnie `8770`). |
| `--no-mcp` | Twardo wyłącza endpoint MCP (`/mcp`). |
| `--no-open` | Nie otwiera przeglądarki przy starcie. |
| `--no-tray` | Bez ikony w zasobniku: tryb konsolowy, `Ctrl+C` zamyka. Używany przez testy. |
| `--allow-multi` | Pozwala uruchomić drugą kopię. Normalnie jest blokowana, bo obie przechwytywałyby klawiaturę i dzieliły port. Tylko do testów. |
| `--debug` | Wypisuje surowe pakiety w konsoli. |
| `--devices <int>` | Liczba miejsc na urządzenia tworzonych przy starcie (domyślnie `1`). Przycisk „Dodaj kapsel” w panelu robi to samo w trakcie pracy. |
| `--name <str>` | Przedrostek nazwy rozgłaszanej przez BLE, którego szuka aplikacja (domyślnie `Triki`). |
| `--no-midi` | Nie tworzy wyjścia MIDI/OSC. |
| `--enable-skip` | Przechył w bok przełącza utwory (dawne gesty audio). |
| `--version` | Wypisuje wersję i kończy działanie. |

### Budowa projektu

| Ścieżka | Co to jest |
|---|---|
| `ribbitflip_monitor.py` | Główna aplikacja: obsługa BLE, lokalny serwer HTTP oraz silniki reguł, myszy powietrznej, pada i MIDI/OSC. |
| `ribbitflip_audio.py` | Samodzielny, minimalny skrypt gestów audio i wspólne stałe protokołu BLE. |
| `ribbitflip_mcp.py` | Opcjonalny endpoint MCP dla asystentów AI (domyślnie wyłączony, `--no-mcp` blokuje go na stałe). |
| `web/` | Cały front: `ribbitflip_dashboard.html` (szkielet HTML i słownik tłumaczeń PL/EN), `web/js/` (127 modułów o nazwach `rf-NN-*.js`, zwykłe skrypty ładowane w stałej kolejności), `web/css/` (27 plików), `web/assets/` (grafiki i fonty OFL). Serwowany pod `/` i `/web/*`, wbudowany w plik EXE. |
| `assets/` | Grafiki źródłowe: ikony aplikacji i pełnowymiarowe oryginały obrazów pomniejszonych do `web/assets/`. |
| `Presets/` | Zestawy dołączone do aplikacji (np. `Pad na dwa kapsle (start).json`), tylko do odczytu, wbudowane w EXE. To nie to samo co własne zestawy użytkownika w `Library/Setups/`. |
| `RibbitFlip.spec` / `build_exe.bat` | Przepis budowy PyInstallera. |
| `examples/` | Oczyszczone przykładowe pliki konfiguracji, dwa zestawy do udostępniania i opcjonalny skrypt VBScript uruchamiany przy logowaniu. |
| `tests/` | Zwykłe skrypty testowe (`tests/test_*.py`, uruchamiane przez `py tests/test_x.py`, każdy wypisuje linie PASS/FAIL) i harnessy Node (`tests/*_harness.mjs`), które uruchamia jako podproces odpowiadający im test w Pythonie. Na przykład `kinds_harness.mjs` uruchamia `test_kinds_contract.py`, a `cfghub_modules_harness.mjs` zarówno `test_midi_config.py`, jak i `test_mouse_config.py`. Trzy testy poruszają prawdziwą myszą i klawiaturą: `test_hotkey.py`, `test_mousearea.py`, `test_mousepoint.py`. |
| `tools/` | `osc_monitor.py` (podgląd OSC przez UDP bez zależności) i `mcp_stdio_bridge.py` (most stdio↔HTTP dla klientów MCP) są dla użytkowników. Reszta to pomocnicze narzędzia budowy, niewchodzące do EXE: `build_banner.py` z `build_banner_art.txt` (napis, żaba i czaszka, które wypisuje `build_exe.bat`) oraz `make_banner_art.py` (generuje tę grafikę od nowa), a także `gamepad_art.py` i `wii_art.py` (wygenerowały rysunki kontrolerów w `web/assets/gamepad/`). |
| `docs/` | Strona projektu na GitHub Pages i dokumentacja uzupełniająca (przewodnik MCP, podziękowania, źródła paczek REST). |
| `third_party_licenses/` | Teksty licencji zależności i plik z informacjami (`README.md`), wbudowane w EXE. |

### Zasady

- **Małe, skupione pull requesty.** Jedna zmiana na PR znacznie ułatwia przegląd.
- **Komentarze w kodzie są po angielsku.** Dopasuj się do otaczającego stylu.
- **Dokumentacja jest dwujęzyczna.** README ma osobny plik na każdy język (`README.md` po polsku,
  `README.en.md` po angielsku), a `docs/pl/` ma swój odpowiednik w `docs/en/`. Pozostałe pliki
  (ten, `SECURITY.md`, `docs/CREDITS.md`, `docs/MCP.md` i inne) mają w jednym pliku sekcję
  polską i angielską. Zmieniając jedną wersję językową, popraw też drugą. Przy rozbieżności
  wiążąca jest wersja polska. Wyjątek: `CHANGELOG.md` prowadzimy tylko po angielsku.
- **Changelog i wersje.** Każda zmiana, którą zauważy użytkownik, dostaje jeden wpis w
  `CHANGELOG.md` pod `## [Unreleased]`, w sekcji Added, Changed, Fixed albo Removed: najpierw
  pogrubione miejsce w panelu, potem to, co teraz można zrobić, słowami panelu. Bez uzasadnień,
  historii błędu i nazw z kodu. Kształt wpisów sprawdza `tests/test_changelog_style.py`. Numer
  wersji jest w jednym miejscu, `APP_VERSION` w `ribbitflip_monitor.py`, i podbija go tylko
  `py tools/wydanie.py`, które przenosi wpisy pod nową wersję i zakłada tag.
- **Nie psuj modelu bezpieczeństwa.** Serwer nasłuchuje tylko na pętli zwrotnej, a zmiany stanu
  wymagają tokenu sesji. Szczegóły w [`SECURITY.md`](SECURITY.md).
- **Front zostaje bez zależności.** Bez bundlera, bez frameworków, bez npm. `web/js/*.js` to
  zwykłe skrypty dzielące jeden globalny zasięg leksykalny: bez `import`/`export`, bez opakowań
  IIFE, z `"use strict";` na początku każdego pliku.
- **Testuj przed wypchnięciem.** Minimum:
  1. `py -m py_compile ribbitflip_monitor.py ribbitflip_audio.py ribbitflip_mcp.py`
  2. `for f in web/js/*.js; do node --check "$f"; done`
  3. Uruchom cały folder `tests/`: `for t in tests/test_*.py; do py "$t" || echo "FAIL $t"; done`.
     Trzy z tych testów sterują prawdziwą myszą i klawiaturą (`test_hotkey.py`,
     `test_mousearea.py`, `test_mousepoint.py`), więc nie dotykaj ich w trakcie.
  4. Uruchom z `--simulate` i sprawdź, że panel ładuje się bez błędów w konsoli.
- **Listy istotne dla bezpieczeństwa.** Nowa trasa HTTP, która zmienia stan, należy do `do_POST`,
  gdzie centralnie działa bramka CSRF/Host/Origin. Nie rób z niej `GET` ze skutkami ubocznymi, bo
  taki dostaje tylko sprawdzenie Host/Origin. Jeśli zmiana dotyka `STATIC_DIRS`/`STATIC_TYPES`
  (listy dozwolonych plików statycznych) albo `DIAG_GLOBAL_FILES` (co może trafić do paczki
  diagnostycznej), przejrzyj ją drugi raz. Zobacz [`SECURITY.md`](SECURITY.md).
- **Organizacja kodu** (odsyła tu kilka komentarzy w kodzie):
  - **Rozmiar pliku:** miękki limit to 500 linii na plik `web/js`, twardy to 800. Powyżej 500
    podziel plik tematycznie przy najbliższej zmianie, powyżej 800 podziel go, zanim dodasz coś
    nowego. Pliki po podziale nazywają się od rodzica (`rf-34-tabs.js` → `rf-34b-cols.js`), żeby
    kolejność ładowania była oczywista.
  - **Kolejność ładowania:** pliki ładują się w kolejności z `web/ribbitflip_dashboard.html`.
    Wszystko, co plik wywołuje *w trakcie ładowania*, musi być zdefiniowane we wcześniejszym
    pliku. Wywołania późniejsze, ze zdarzeń, mogą sięgać do przodu.
  - **Montowanie to nie działanie:** moduł może się załadować bez jednego błędu i nigdy nie
    zadziałać, bo nikt nie zarejestrował jego obsługi ani go nie wywołał. Test modułu interfejsu
    klika przycisk albo wyzwala zdarzenie i sprawdza efekt. Samo „przestrzeń nazw istnieje”
    niczego nie dowodzi.
  - **Ikony:** interaktywny interfejs (przyciski, nawigacja, statusy) używa ikon SVG, nie emoji
    ani znaków z fontu, żeby rozmiar, kolor i kontrast były takie same w każdym systemie.
- **Nie dodawaj grafik chronionych znakami towarowymi.** Projekt ma pozostać wyraźnie
  nieoficjalny i niepowiązany z nikim (zobacz zastrzeżenie w README).

### Zgłaszanie błędów i pomysłów

Pytania, pomoc w konfiguracji i ogólne rozmowy najlepiej prowadzić na
[serwerze Discord](https://discord.gg/tyv2MjjVdb): forum `#pomoc` służy do pomocy, `#pomysły` do
propozycji funkcji. GitHub Issues są na powtarzalne błędy i zgłoszenia dotyczące kodu. Opisz kroki
prowadzące do błędu i napisz, czy pracujesz na prawdziwym sprzęcie, czy z `--simulate`. Sprawy
bezpieczeństwa zgłaszaj zgodnie z [`SECURITY.md`](SECURITY.md), a nie w publicznym zgłoszeniu ani
na Discordzie.

---

## English

Thanks for your interest! RibbitFlip is a small hobby project maintained in spare
time, so responses may be slow — but issues and focused pull requests are welcome.

### Development setup

```bash
git clone <your-fork-url>
cd RibbitFlip
pip install -r requirements.txt
python ribbitflip_monitor.py --simulate     # runs with no hardware
```

The dashboard opens at `http://127.0.0.1:8770/`. `--simulate` feeds synthetic
sensor data so you can develop the whole UI/output pipeline without a physical
puck.

### Command-line flags

The READMEs only list the four flags a user may need. The full set, for development and tests:

| Flag | Meaning |
|---|---|
| `--simulate` | Synthetic motion, no hardware. Output is real; modules start off and the first switch-on asks for confirmation. |
| `--no-keys` | Real capsule, but no keyboard or mouse event is ever created (monitor only). |
| `--port <int>` | Server port (default `8770`). |
| `--no-mcp` | Hard-disable the MCP endpoint (`/mcp`). |
| `--no-open` | Do not open the browser on start. |
| `--no-tray` | No tray icon: console mode, `Ctrl+C` quits. Used by the tests. |
| `--allow-multi` | Let a second copy start. Normally refused, since both would hook the keyboard and share the port. Tests only. |
| `--debug` | Print raw packets to the console. |
| `--devices <int>` | Number of device slots to create on start (default `1`); the panel's "Add capsule" does the same at run time. |
| `--name <str>` | BLE advertised-name prefix to look for (default `Triki`). |
| `--no-midi` | Do not create the MIDI/OSC output. |
| `--enable-skip` | Side tilt skips tracks (the old audio gestures). |
| `--version` | Print the version and exit. |

### Project layout

| Path | What it is |
|---|---|
| `ribbitflip_monitor.py` | Main app: BLE plumbing, local HTTP server, and the trigger / air-mouse / gamepad / MIDI-OSC engines. |
| `ribbitflip_audio.py` | Standalone minimal audio-gesture script + the shared BLE protocol constants. |
| `ribbitflip_mcp.py` | The optional MCP endpoint for AI assistants (off by default, `--no-mcp` hard-locks it). |
| `web/` | The whole front-end: `ribbitflip_dashboard.html` (HTML shell + PL/EN i18n dictionary), `web/js/` (127 modules named `rf-NN-*.js`, plain classic scripts loaded in a fixed order), `web/css/` (27 files), `web/assets/` (images + OFL fonts). Served at `/` and `/web/*`, bundled into the EXE. |
| `assets/` | Source artwork: app icons, full-resolution originals of the images that were scaled down into `web/assets/`. |
| `Presets/` | Setups that ship with the app (e.g. `Pad na dwa kapsle (start).json`) — read-only, bundled into the EXE. Not the same as a user's own saved setups in `Library/Setups/`. |
| `RibbitFlip.spec` / `build_exe.bat` | PyInstaller build recipe. |
| `examples/` | Sanitized example config files, two shareable bundle setups, and the optional VBScript login launcher. |
| `tests/` | Plain test scripts (`tests/test_*.py`, run with `py tests/test_x.py`, each printing PASS/FAIL lines) plus Node harnesses (`tests/*_harness.mjs`) that a matching Python test drives as a subprocess — e.g. `kinds_harness.mjs` is driven by `test_kinds_contract.py`, `cfghub_modules_harness.mjs` by both `test_midi_config.py` and `test_mouse_config.py`. Three tests move the real mouse/keyboard: `test_hotkey.py`, `test_mousearea.py`, `test_mousepoint.py`. |
| `tools/` | `osc_monitor.py` (zero-dependency OSC-over-UDP monitor) and `mcp_stdio_bridge.py` (stdio↔HTTP bridge for MCP clients) are meant to be run directly by users; the rest are build-time helpers, not shipped in the EXE: `build_banner.py` + `build_banner_art.txt` (the wordmark, frog and skull `build_exe.bat` prints) and `make_banner_art.py` (regenerates that art), `gamepad_art.py` / `wii_art.py` (generated the controller drawings under `web/assets/gamepad/`). |
| `docs/` | GitHub Pages landing page + supplementary docs (MCP guide, credits, REST pack sources). |
| `third_party_licenses/` | Dependency licence texts + the notices file (`README.md`), bundled into the EXE. |

### Guidelines

- **Keep PRs small and focused.** One change per PR is much easier to review.
- **Comments are in English.** Match the surrounding style.
- **Documentation is bilingual.** The README has one file per language (`README.md` in Polish,
  `README.en.md` in English), and `docs/pl/` is mirrored by `docs/en/`. The other files (this
  one, `SECURITY.md`, `docs/CREDITS.md`, `docs/MCP.md` and the rest) keep a Polish and an
  English section in a single file. When you change one language, update the other. If the two
  disagree, the Polish text is the one that counts. The exception is `CHANGELOG.md`, which is
  kept in English only.
- **Changelog and versions.** Every change a user will notice gets one line in `CHANGELOG.md`
  under `## [Unreleased]`, in Added, Changed, Fixed or Removed: first the place in the panel in
  bold, then what you can now do, in the panel's own words. No reasons, no story of the bug, no
  names from the source; `tests/test_changelog_style.py` checks the shape. The version number
  lives in one place, `APP_VERSION` in `ribbitflip_monitor.py`, and only `py tools/wydanie.py`
  bumps it: it moves the entries under the new version and tags the commit.
- **Don't break the safety model.** The server binds to loopback only and gates
  state changes behind the session token — see [`SECURITY.md`](SECURITY.md).
- **The front-end stays dependency-free.** No bundler, no frameworks, no npm.
  `web/js/*.js` are classic scripts sharing one global lexical scope — no
  `import`/`export`, no IIFE wrappers, `"use strict";` at the top of each file.
- **Test before you push.** At minimum:
  1. `py -m py_compile ribbitflip_monitor.py ribbitflip_audio.py ribbitflip_mcp.py`
  2. `for f in web/js/*.js; do node --check "$f"; done`
  3. Run the whole `tests/` folder: `for t in tests/test_*.py; do py "$t" || echo "FAIL $t"; done`.
     Three of these drive the real mouse/keyboard (`test_hotkey.py`, `test_mousearea.py`,
     `test_mousepoint.py`) — keep your hands off both while they run.
  4. Run with `--simulate` and confirm the dashboard loads with 0 console errors.
- **Security-relevant lists.** A new HTTP route that changes state belongs in `do_POST`,
  where the CSRF/Host/Origin gate is enforced centrally — not as a side-effecting `GET`,
  which only gets the Host/Origin check. If your change touches `STATIC_DIRS`/`STATIC_TYPES`
  (the static-file allowlists) or `DIAG_GLOBAL_FILES` (what the diagnostic bundle may
  contain), give it a second look; see [`SECURITY.md`](SECURITY.md).
- **Code organisation** (several comments in the code point here):
  - **File size:** a soft limit of 500 lines per `web/js` file and a hard one of 800. Past 500,
    split by topic at the next change; past 800, split before adding anything new. Split files
    are named after their parent (`rf-34-tabs.js` → `rf-34b-cols.js`) so load order stays obvious.
  - **Load order:** files load in the order listed in `web/ribbitflip_dashboard.html`. Anything a
    file calls *while loading* must be defined in an earlier file; calls made later, from events,
    may reach forward.
  - **Mounting is not working:** a module can load without a single error and still never run —
    nobody registered its handler, nobody called it. A test for a UI module clicks the button or
    fires the event and checks the effect; "the namespace exists" proves nothing.
  - **Icons:** interactive UI (buttons, navigation, status) uses SVG icons, not emoji or font
    glyphs, so size, colour and contrast stay the same on every system.
- **Don't add trademarked assets.** Keep the project's unofficial, unaffiliated
  status clear (see the README disclaimer).

### Reporting bugs / ideas

For questions, setup help, and general discussion, the
[Discord server](https://discord.gg/tyv2MjjVdb) is the place to be — the `#pomoc` forum
for help, `#pomysły` for feature ideas. GitHub Issues are for reproducible bugs and
code-level reports: open one with steps to reproduce (and whether you're on real
hardware or `--simulate`). For security issues, please follow
[`SECURITY.md`](SECURITY.md) instead of filing a public issue or posting on Discord.
