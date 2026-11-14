# Licencje i informacje o oprogramowaniu osób trzecich / Third-Party Licenses & Notices

**[Polski](#polski)** · [English](#english)

---

## Polski

RibbitFlip jest udostępniany na licencji MIT (zobacz [`LICENSE`](../LICENSE)). Korzysta z
oprogramowania osób trzecich wymienionego niżej. Każdy z tych składników zachowuje własne prawa
autorskie i warunki licencji. Pełne teksty licencji z oryginalnych projektów leżą bez zmian w tym
folderze, obok tego pliku. Teksty licencji są wyłącznie po angielsku, bo tak brzmią oryginały, i
tylko one są wiążące. Ten plik je streszcza i opisuje, jak projekt ich przestrzega.

---

### bleak: licencja MIT

- Projekt: https://github.com/hbldh/bleak
- Prawa autorskie: Henrik Blidh i współtwórcy
- Licencja: MIT, zobacz [`third_party_licenses/bleak-LICENSE.txt`](bleak-LICENSE.txt)
- Użycie: importowana jako biblioteka Pythona do komunikacji Bluetooth LE z kapslem (Nordic UART
  Service). Bez modyfikacji.

---

### pynput: GNU Lesser General Public License v3.0 (LGPL-3.0)

- Projekt: https://github.com/moses-palmer/pynput
- Prawa autorskie: Moses Palmér i współtwórcy
- Licencja: LGPL-3.0, zobacz [`third_party_licenses/pynput-COPYING.LGPL.txt`](pynput-COPYING.LGPL.txt)
  (LGPL-3.0 to GPL-3.0 z dodatkowymi uprawnieniami; tekst bazowej GPL-3.0 jest dostępny u FSF pod
  adresem https://www.gnu.org/licenses/gpl-3.0.txt)
- Użycie: importowana **bez modyfikacji** jako biblioteka Pythona do symulowania klawiatury i
  myszy (silnik wyzwalaczy i wyjście myszy powietrznej).

**Jak ten projekt spełnia warunki LGPL-3.0**

- pynput jest używany wyłącznie jako niezmodyfikowana, dynamicznie importowana biblioteka. Własny
  kod RibbitFlipa (`ribbitflip_monitor.py`, `ribbitflip_audio.py`, `ribbitflip_dashboard.html` i
  front w `web/`) **nie** jest utworem zależnym od pynput i pozostaje na licencji MIT. Copyleft
  LGPL dotyczy wyłącznie samego pynput.
- Dokładna wersja pynput jest przypięta w [`requirements.txt`](../requirements.txt). Ponieważ
  RibbitFlip nie modyfikuje pynput, odnośnik do kanonicznego kodu źródłowego (wydania zgodnego z
  tą wersją) spełnia wymóg udostępnienia „odpowiadającego kodu źródłowego”.
- RibbitFlip może być rozpowszechniany jako jednoplikowy `.exe` z PyInstallera, który zawiera
  zamrożoną kopię pynput. Żeby zachować gwarantowaną przez LGPL swobodę podmiany na
  **zmodyfikowany** pynput, repozytorium udostępnia pełny kod źródłowy i przepis budowy
  ([`build_exe.bat`](../build_exe.bat) + [`RibbitFlip.spec`](../RibbitFlip.spec)). Każdy może
  więc podstawić zmodyfikowany pynput we własnym środowisku Pythona i samodzielnie zbudować plik
  wykonywalny.
- Niezmieniony tekst LGPL-3.0 pynput jest dołączony do kodu źródłowego, zgodnie z wymogiem.

---

### vgamepad: licencja MIT

- Projekt: https://github.com/yannbouteiller/vgamepad
- Prawa autorskie (c) 2021 Yann Bouteiller
- Licencja: MIT, zobacz [`third_party_licenses/vgamepad-LICENSE.txt`](vgamepad-LICENSE.txt)
- Użycie: importowana jako biblioteka Pythona do emulowania wirtualnego pada Xbox 360 (tryby
  wyjścia myszy powietrznej i pada). Opcjonalna, potrzebna tylko przy wyjściu na pad.

**Dołączony podskładnik: ViGEmClient.dll (x86 + x64).** Biblioteka kliencka trybu użytkownika,
z którą vgamepad łączy się w czasie działania, żeby rozmawiać ze sterownikiem ViGEmBus. Część
projektu ViGEmBus (Nefarius / Benjamin Höglinger-Stelzer i współtwórcy), na licencji MIT.
Rozpowszechniana jako część zamrożonej wersji i wymieniona tutaj zgodnie z warunkami MIT.
Oryginał: https://github.com/nefarius/ViGEmClient

**Sterownik jądra ViGEmBus (NIE jest dołączony).** **Sterownik trybu jądra** ViGEmBus to osobny
składnik osoby trzeciej. RibbitFlip nigdy nie instaluje, nie uruchamia automatycznie ani nie
wywołuje żadnego instalatora sterownika. Rozmawia tylko z już zainstalowanym przez użytkownika
sterownikiem ViGEmBus przez `ViGEmClient.dll`. Instalacja ViGEmBus to jednorazowy, ręczny krok,
który wykonuje użytkownik (zobacz README). Dostarczony [`RibbitFlip.spec`](../RibbitFlip.spec)
celowo **wyklucza** instalatory `ViGEmBusSetup_*.msi` z pakietu, żeby nie rozpowszechniać
instalatora cudzego sterownika. Jeśli chcesz korzystać z pada, pobierz ViGEmBus bezpośrednio z
https://github.com/nefarius/ViGEmBus/releases.

---

### pystray: GNU Lesser General Public License v3.0 (LGPL-3.0)

- Projekt: https://github.com/moses-palmer/pystray
- Prawa autorskie: Moses Palmér i współtwórcy
- Licencja: LGPL-3.0, zobacz [`third_party_licenses/pystray-COPYING.LGPL.txt`](pystray-COPYING.LGPL.txt)
  (dodatkowe uprawnienia nałożone na bazową GPL-3.0, której tekst jest w
  [`third_party_licenses/pystray-COPYING.txt`](pystray-COPYING.txt))
- Użycie: importowana **bez modyfikacji** jako biblioteka Pythona do wyświetlania ikony w
  zasobniku systemowym (obok zegara Windows) i jej menu. Obowiązują te same uwagi o LGPL-3.0 co
  przy pynput: pystray jest niezmodyfikowaną, dynamicznie importowaną biblioteką, własny kod
  RibbitFlipa **nie** jest od niej utworem zależnym i pozostaje na MIT, wersja jest przypięta w
  [`requirements.txt`](../requirements.txt), a repozytorium udostępnia pełny kod i przepis budowy,
  więc każdy może podstawić zmodyfikowany pystray we własnym środowisku Pythona i zbudować plik
  wykonywalny od nowa.

---

### Pillow (fork PIL): licencja MIT-CMU (liberalna)

- Projekt: https://github.com/python-pillow/Pillow
- Prawa autorskie: Jeffrey A. Clark i współtwórcy; Secret Labs AB; Fredrik Lundh
- Licencja: MIT-CMU (liberalna licencja w stylu MIT, którą Pillow odziedziczył po PIL; pakiet
  deklaruje `License-Expression: MIT-CMU`), zobacz
  [`third_party_licenses/pillow-LICENSE.txt`](pillow-LICENSE.txt)
- Użycie: dociągana przez pystray; służy tylko do rysowania obrazu ikony w zasobniku w czasie
  działania (`Image.new` + `ImageDraw`). Bez modyfikacji. Budowa celowo **wyklucza** numpy
  (opcjonalny akcelerator Pillow, z którego RibbitFlip nie korzysta).

---

### PyInstaller: GPL-2.0-or-later z wyjątkiem dla programu rozruchowego PyInstallera

- Projekt: https://pyinstaller.org
- Prawa autorskie: PyInstaller Development Team i współtwórcy
- Licencja: GPL-2.0-or-later **z wyraźnym wyjątkiem**, zobacz
  [`third_party_licenses/pyinstaller-COPYING.txt`](pyinstaller-COPYING.txt)
- Użycie: wyłącznie narzędzie budowy ([`build_exe.bat`](../build_exe.bat) +
  [`RibbitFlip.spec`](../RibbitFlip.spec)), które zamraża `ribbitflip_monitor.py` do
  `RibbitFlip.exe`. Nie jest importowany przez kod RibbitFlipa ani rozpowszechniany jako jego
  część.

Licencja PyInstallera zawiera wyjątek, który pozwala rozpowszechniać program rozruchowy (część
wbudowaną w każdy zamrożony plik wykonywalny) na **dowolnej** licencji wybranej przez autora
aplikacji. Budowa `RibbitFlip.exe` nie narzuca więc RibbitFlipowi warunków GPL. Na GPL pozostaje
tylko kod samego PyInstallera. Powstały `.exe` pozostaje na licencji MIT.

---

### Protokół Nordic UART Service (NUS): informacyjnie, bez dołączonego kodu

RibbitFlip rozmawia z kapslem przez **Nordic UART Service**, usługę Bluetooth LE opublikowaną
przez Nordic Semiconductor w dokumentacji nRF SDK (bazowy UUID
`6e400001-b5a3-f393-e0a9-e50e24dcca9e`, charakterystyki RX/TX `6e400002-…` / `6e400003-…`). Te
UUID to otwarty, szeroko stosowany standard interoperacyjności, używany przez tysiące urządzeń
BLE, a nie własność producenta kapsla. Nie dołączamy żadnego kodu Nordic Semiconductor.

Bajty poleceń budzenia i usypiania kapsla oraz układ pakietu akcelerometru i żyroskopu ustaliła
społeczność hobbystów, niezależnie odtwarzając obserwowalny ruch BLE urządzenia (zobacz
[`CREDITS.md`](../docs/CREDITS.md)). To faktyczne, funkcjonalne informacje o protokole (formaty
danych i bajty poleceń), używane w celu zapewnienia interoperacyjności.

---

### Fonty marki: Baloo 2, Nunito, JetBrains Mono, Titan One (SIL OFL 1.1)

**Panel w filcowej skórce** sam serwuje cztery otwarte kroje jako pliki `.woff2` z
[`web/assets/fonts/`](../web/assets/fonts/). Udostępnia je wyłącznie lokalny serwer panelu (bez
zewnętrznego CDN, więc działa offline i zgodnie z CSP). Strona projektu na GitHub Pages (`docs/`)
zawiera te same cztery. Wszystkie są na licencji **SIL Open Font License, wersja 1.1**, zobacz
[`third_party_licenses/SIL-OFL-1.1.txt`](SIL-OFL-1.1.txt).

- **Baloo 2**, © The Baloo 2 Project Authors (https://github.com/googlefonts/baloo). Nagłówki,
  tytuły, napis logo.
- **Nunito**, © The Nunito Project Authors (https://github.com/googlefonts/nunito). Tekst
  główny. Panel serwuje pięć statycznych wag (400–800), wyjętych narzędziem fontTools z
  oryginalnego pliku zmiennego bez zmian w kształtach; OFL na to pozwala, nazwa kroju nie jest zastrzeżona.
- **JetBrains Mono**, © 2020 The JetBrains Mono Project Authors
  (https://github.com/JetBrains/JetBrainsMono). Liczby, wartości hex, tekst o stałej szerokości.
- **Titan One**, © The Titan One Project Authors (https://github.com/googlefonts/titan-one). Krój
  nagłówkowy: jego ciężkie, zaokrąglone litery pasują do naszywanego, filcowego napisu w logo
  RibbitFlipa. Używany w H1 i nagłówkach sekcji strony projektu oraz w tytułach kart, sekcji i
  okien dialogowych panelu. Tylko w tytułach: ma jedną grubość, więc wszystko mniejsze niż około
  15 px zostaje przy Baloo 2.

Dołączamy tylko podzbiory woff2 `latin` i `latin-ext` (pliki o zmiennej grubości). OFL pozwala na
dołączanie i rozpowszechnianie, także osadzanie w dokumentach. Fonty są niezmienione i nie są
sprzedawane osobno.

---

### Gamepad Viewer (grafika kontrolerów): licencja MIT

- Projekt: https://github.com/e7d/gamepad-viewer (na żywo pod https://gamepad.e7d.io)
- Prawa autorskie (c) 2017-2020 Michaël „e7d” Ferrand
- Licencja: MIT, zobacz [`third_party_licenses/gamepad-viewer-LICENSE.txt`](gamepad-viewer-LICENSE.txt)
- Użycie: osiem plików SVG skórki `templates/xbox-one/`, skopiowanych do
  [`web/assets/gamepad/`](../web/assets/gamepad/) i rysowanych przez widżet „kontroler” w panelu.
  **Tylko grafika:** nie dołączamy żadnego pliku JavaScript ani CSS z tego projektu. Własny
  [`web/css/14b-gamepad.css`](../web/css/14b-gamepad.css) RibbitFlipa przenosi geometrię części z
  `template.css` oryginału, a [`web/js/rf-42-padview.js`](../web/js/rf-42-padview.js) steruje
  częściami na podstawie stanu aplikacji zamiast Gamepad API przeglądarki.
- Zmodyfikowane: **tak, dwukrotnie, i w sposób odtwarzalny.** Obie zmiany wprowadza
  [`tools/gamepad_art.py`](../tools/gamepad_art.py), który bierze folder świeżo pobranych plików
  oryginału i wypisuje każdą podmianę, więc różnicę da się odtworzyć, zamiast brać ją na wiarę.
  **(1)** Przycisk Guide w `base-black.svg` i `base-white.svg` miał logo producenta konsoli (po
  jednym `<path>` na plik). Oba usunęliśmy. Znaki towarowe nie są objęte licencją na prawa
  autorskie, a RibbitFlipa nikt nie firmuje. **(2)** Każdy kolor przemapowano według jasności na
  paletę aplikacji: ciepły korpus espresso zamiast błyszczącej czerni, bursztyn aplikacji w
  nakładkach „przycisk wciśnięty” i własna paleta danych aplikacji dla A/B/X/Y. **Nie zmieniono
  żadnego kształtu, ścieżki ani współrzędnej**, więc rysunek to nadal w całości praca autorów
  oryginału. Licencja MIT pozwala na obie zmiany. Zapisujemy je tutaj i w
  [`web/assets/gamepad/README.md`](../web/assets/gamepad/README.md), żeby różnica względem
  oryginału była czytelna jako celowa.

**Podziękowanie z oryginału, przeniesione dalej:** README e7d wymienia **mrmcpowned**
(https://gamepadviewer.com) jako autora oryginałów, z których przerobiono skórki. Obaj są
wymienieni w [`docs/CREDITS.md`](../docs/CREDITS.md).

---

### VSCO 2 Community Edition (nagrania instrumentów w RibbitBeat): CC0 1.0

- Projekt: VSCO 2 Community Edition, Versilian Studios LLC (Sam Gossner), https://github.com/sgossner/VSCO-2-CE
- Licencja: Creative Commons Zero 1.0 Universal (CC0), zobacz
  [`third_party_licenses/vsco2-ce-LICENSE.txt`](vsco2-ce-LICENSE.txt). CC0 nie wymaga przypisania; autorom
  dziękujemy w [`docs/CREDITS.md`](../docs/CREDITS.md).
- Użycie: po 3–4 nagrania pojedynczych nut dla instrumentów gry RibbitBeat Trąbka, Flet, Smyczki, Wiolonczela,
  Pianino, Organy, Obój, Klarnet, Puzon i Tuba, w [`web/assets/<instrument>/`](../web/assets/) (katalogi `trabka`,
  `flet`, `smyczki`, `wiolonczela`, `piano`, `organy`, `oboj`, `klarnet`, `puzon`, `tuba`), każdy z plikiem opisu
  `<instrument>.json` i z `ZRODLA.md`, gdzie stoi adres każdego nagrania źródłowego. Pakowane do `RibbitBeat.exe`
  i `RibbitFlip.exe` (całe `web/assets`).
- Zmodyfikowane: **tak, odtwarzalnie.** [`tools/ribbitbeat_probki_instrumentow.py`](../tools/ribbitbeat_probki_instrumentow.py)
  bierze pobrane nagrania i z każdego zostawia ok. 1 s: mono, 22 050 Hz, PCM16, przycięte do ataku i jednego
  zapętlonego odcinka (koniec zszyty z początkiem), z wyrównaną głośnością. W grze próbka jest przestrajana do
  nuty gracza (zmiana szybkości odtwarzania).

---

### Krzyki w RibbitBeat (instrument „Krzyk”): CC BY 3.0 i CC0 1.0

Osiem próbek w [`web/assets/krzyk/`](../web/assets/krzyk/) to przerobione nagrania z paczki
„Aargh! (male screams)” z OpenGameArt (https://opengameart.org/content/aargh-male-screams, paczkę zebrał
congusbongus). Pakowane do `RibbitBeat.exe`, `RibbitFlip.exe` i `RibbitFlip-Essential.exe`.

- **Helmut Scream**, autor: creativeheroes, http://freesound.org/people/creativeheroes/sounds/84353/,
  licencja Creative Commons Uznanie autorstwa 3.0 (CC BY 3.0), https://creativecommons.org/licenses/by/3.0/
  (plik `krzyk-1.wav`, z nagrania `aargh0`).
- **Male_Thijs_loud_scream**, autor: thanvannispen, http://freesound.org/people/thanvannispen/sounds/9432/,
  licencja CC BY 3.0, https://creativecommons.org/licenses/by/3.0/ (pliki `krzyk-2.wav` i `krzyk-3.wav`,
  z nagrań `aargh1` i `aargh2`).
- **human male scream multi**, autor: JohnsonBrandEditing,
  http://freesound.org/people/JohnsonBrandEditing/sounds/173944/, licencja CC0 1.0
  (pliki `krzyk-4.wav` do `krzyk-8.wav`, z nagrań `aargh3` do `aargh7`).
- **Zmienione:** przycięte, zmniejszone do 32 kHz mono, z wyrównaną głośnością i z zapętlonym odcinkiem
  (koniec zszyty z początkiem); w grze przestrajane do nuty gracza. Twórcy oryginałów nie popierają tego
  projektu ani tych zmian.

---

### Co dodatkowo zawiera spakowany `RibbitFlip.exe`

Jednoplikowy plik wykonywalny to zamrożona aplikacja w Pythonie, więc oprócz bibliotek
wymienionych wyżej zawiera środowisko uruchomieniowe CPython i natywne biblioteki, których ono
potrzebuje. Wymieniamy je osobno, bo pobrany `.exe` podróżuje bez tego repozytorium. Dlatego
budowa **dołącza też sam folder `third_party_licenses/`** (zobacz
[`RibbitFlip.spec`](../RibbitFlip.spec)), żeby każda kopia pliku wykonywalnego niosła ze sobą
pełne teksty licencji.

| Składnik w pliku wykonywalnym | Licencja | Tekst |
|---|---|---|
| Środowisko CPython: `python314.dll`, `base_library.zip`, moduły rozszerzeń biblioteki standardowej | PSF-2.0 (plus informacje, które CPython zawiera: bzip2, Zstandard, CWI, BeOpen, CNRI) | [`python-LICENSE.txt`](python-LICENSE.txt) |
| OpenSSL: `libssl-3.dll`, `libcrypto-3.dll` (używane przez `ssl`/`hashlib` Pythona) | Apache-2.0 | [`openssl-LICENSE-Apache-2.0.txt`](openssl-LICENSE-Apache-2.0.txt) |
| libffi: `libffi-8.dll` (używana przez `ctypes`, który obsługuje wyjście MIDI) | w stylu MIT | [`libffi-LICENSE.txt`](libffi-LICENSE.txt) |
| Expat: rozszerzenie `pyexpat` | MIT | [`expat-COPYING.txt`](expat-COPYING.txt) |
| PyWinRT (`winrt-runtime` i projekcje `winrt-Windows.*` dociągane przez bleak do obsługi BLE w Windows) | MIT, © Microsoft Corporation | [`pywinrt-LICENSE.txt`](pywinrt-LICENSE.txt) |
| ViGEmClient: `ViGEmClient.dll` (x86 + x64), dostarczana w `vgamepad` | MIT, © Benjamin Höglinger-Stelzer | [`ViGEmClient-LICENSE.txt`](ViGEmClient-LICENSE.txt) |
| defusedxml: dociągana przez mechanizm wtyczek Pillow | PSF-2.0 | [`defusedxml-LICENSE.txt`](defusedxml-LICENSE.txt) |
| olefile: dociągana przez Pillow (formaty obrazów w kontenerach OLE) | BSD-2-Clause | [`olefile-LICENSE.txt`](olefile-LICENSE.txt) |
| Środowisko Microsoft Visual C++: `VCRUNTIME140.dll`, `VCRUNTIME140_1.dll`, `MSVCP140.dll` | składnik redystrybucyjny Microsoft, rozpowszechniany bez zmian na warunkach redystrybucji Visual Studio | brak (Microsoft nie udostępnia tekstu do redystrybucji) |

**O OpenSSL i Apache-2.0 §4(d):** projekt OpenSSL nie dostarcza pliku `NOTICE` do swojej licencji
Apache-2.0, więc nie ma tekstu informacji do przekazania dalej. Sama licencja jest dołączona
wyżej.

**Jak powstała ta lista (żeby dało się ją sprawdzić):** odczytano ją ze spisu treści samej budowy
(`build*/RibbitFlip/EXE-00.toc`), a nie z założeń. Każdy wpis `BINARY`/`EXTENSION` stamtąd jest
wyjaśniony wyżej albo we wcześniejszej sekcji tego pliku.

---

### Oryginalna grafika: własna, bez licencji osób trzecich

Cała grafika w stylu filcu dołączona do projektu (zestaw ikon, napis i logo, kursory w kształcie
piankowej dłoni, sprite'y kapsla i pokrętła, sprite'y śpiewającej żaby, liść lilii i filcowa
tekstura tła) to **oryginalna grafika stworzona dla tego projektu** przez jego autora. Obejmuje ją
licencja MIT repozytorium (zobacz [`LICENSE`](../LICENSE)) i nie zawiera ona zasobów osób
trzecich. Konkretnie:

- wszystko w [`web/assets/`](../web/assets/) **oprócz** `web/assets/fonts/` (fonty OFL opisane
  wyżej), `web/assets/gamepad/` (grafika kontrolerów na MIT opisana wyżej), `web/assets/krzyk/`
  (nagrania CC BY 3.0 i CC0 opisane wyżej), katalogów instrumentów RibbitBeat z nagraniami VSCO 2 CE
  (opisane wyżej) i logo usług wymienionych niżej,
- oryginały w pełnej rozdzielczości w [`assets/`](../assets/): `assets/fullsize/`,
  `assets/caps/`, `assets/cursor/` oraz ikony aplikacji
  `assets/ribbitflip.ico`, `assets/ribbitflip_logo.png` i `assets/ribbitflip_head.png`,
- wszystko w [`docs/assets/`](../docs/assets/) **oprócz** `docs/assets/fonts/`: kopie ikon strony
  projektu, filcowa tekstura, kursory i zrzuty ekranu panelu ze sztucznymi danymi z symulacji. Dwa
  zrzuty (`screen-01-nakladka-w-grze.jpg`, `screen-03-skaner.jpg`) mają w tle cudze gry, pokazane
  tylko po to, żeby było widać nakładkę i skaner nad grą; prawa do tych gier mają ich twórcy.

Logo usług osób trzecich są tylko na przyciskach odnośników: Discord i Ko-fi
(`web/assets/icons/discord.png`, `kofi.png`, `kofi_cup.png` i ich kopie w `docs/assets/icons/`) oraz
GitHub (`docs/assets/icons/github.png`). Należą do właścicieli tych usług i nie są objęte licencją MIT
projektu. Wbudowane szablony REST API nazywają usługi wyłącznie tekstem. Dźwięki syntezatora powstają
w czasie działania przez WebAudio API przeglądarki; jedyne dołączone nagrania to próbki instrumentów
RibbitBeat (VSCO 2 CE, CC0) i krzyki (CC BY 3.0 i CC0), opisane wyżej.

---

## English

RibbitFlip is licensed under the MIT License (see [`LICENSE`](../LICENSE)). It
depends on the third-party software listed below. Each retains its own
copyright and license terms. Full upstream license texts are included verbatim
in this folder, next to this file.

---

### bleak — MIT License

- Project: https://github.com/hbldh/bleak
- Copyright: Henrik Blidh and contributors
- License: MIT — see [`third_party_licenses/bleak-LICENSE.txt`](bleak-LICENSE.txt)
- Usage: imported as a Python library for Bluetooth LE communication with the
  puck (Nordic UART Service). Unmodified.

---

### pynput — GNU Lesser General Public License v3.0 (LGPL-3.0)

- Project: https://github.com/moses-palmer/pynput
- Copyright: Moses Palmér and contributors
- License: LGPL-3.0 — see [`third_party_licenses/pynput-COPYING.LGPL.txt`](pynput-COPYING.LGPL.txt)
  (LGPL-3.0 is the GPL-3.0 plus additional permissions; the base GPL-3.0 text
  is available from the FSF at https://www.gnu.org/licenses/gpl-3.0.txt)
- Usage: imported **unmodified** as a Python library for keyboard/mouse input
  simulation (the trigger engine and air-mouse output).

**LGPL-3.0 compliance notes for this project**

- pynput is used strictly as an unmodified, dynamically-imported library.
  RibbitFlip's own source (`ribbitflip_monitor.py`, `ribbitflip_audio.py`,
  `ribbitflip_dashboard.html` and the front-end under `web/`) is **not** a
  derivative work of pynput and remains MIT-licensed. LGPL's copyleft attaches
  only to pynput itself.
- The exact pynput version is pinned in [`requirements.txt`](../requirements.txt).
  Because RibbitFlip does not modify pynput, linking to the canonical upstream
  source (the release matching that pin) satisfies the "corresponding source"
  requirement.
- RibbitFlip can be distributed as a one-file PyInstaller `.exe` that embeds a
  frozen copy of pynput. To preserve the LGPL-guaranteed freedom to relink a
  **modified** pynput, this repository ships its full source plus the build
  recipe ([`build_exe.bat`](../build_exe.bat) + [`RibbitFlip.spec`](../RibbitFlip.spec)),
  so anyone can substitute a modified pynput into their own Python environment
  and rebuild the executable themselves.
- pynput's unmodified LGPL-3.0 text is bundled with the source, as required.

---

### vgamepad — MIT License

- Project: https://github.com/yannbouteiller/vgamepad
- Copyright (c) 2021 Yann Bouteiller
- License: MIT — see [`third_party_licenses/vgamepad-LICENSE.txt`](vgamepad-LICENSE.txt)
- Usage: imported as a Python library to emulate a virtual Xbox 360 gamepad
  (the air-mouse / gamepad output modes). Optional — only needed if you use
  gamepad output.

**Bundled sub-component — ViGEmClient.dll (x86 + x64):** the userspace client
library vgamepad links against at runtime to talk to the ViGEmBus driver. Part
of the ViGEmBus project (Nefarius / Benjamin Höglinger-Stelzer and
contributors), MIT-licensed. Redistributed as part of a frozen build and
attributed here per MIT terms. Upstream: https://github.com/nefarius/ViGEmClient

**Kernel driver — ViGEmBus (NOT bundled):** the ViGEmBus **kernel-mode driver**
is a separate, third-party component. RibbitFlip never installs, auto-runs, or
invokes any driver installer — it only communicates with an already
user-installed ViGEmBus driver via `ViGEmClient.dll`. Installing ViGEmBus is a
one-time, manual, user-initiated step (see the README). The provided
[`RibbitFlip.spec`](../RibbitFlip.spec) deliberately **excludes** the
`ViGEmBusSetup_*.msi` installers from the packaged executable to avoid
redistributing a third-party driver installer; download ViGEmBus directly from
https://github.com/nefarius/ViGEmBus/releases if you want the gamepad feature.

---

### pystray — GNU Lesser General Public License v3.0 (LGPL-3.0)

- Project: https://github.com/moses-palmer/pystray
- Copyright: Moses Palmér and contributors
- License: LGPL-3.0 — see [`third_party_licenses/pystray-COPYING.LGPL.txt`](pystray-COPYING.LGPL.txt)
  (the additional permissions layered on the base GPL-3.0, whose text is in
  [`third_party_licenses/pystray-COPYING.txt`](pystray-COPYING.txt))
- Usage: imported **unmodified** as a Python library to show the system-tray icon
  (next to the Windows clock) and its menu. The same LGPL-3.0 compliance notes as
  pynput apply: pystray is used as an unmodified, dynamically-imported library;
  RibbitFlip's own source is **not** a derivative work of it and stays MIT-licensed;
  the version is pinned in [`requirements.txt`](../requirements.txt); and this repository
  ships its full source plus the build recipe so anyone can substitute a modified
  pystray into their own Python environment and rebuild the executable.

---

### Pillow (PIL fork) — MIT-CMU License (permissive)

- Project: https://github.com/python-pillow/Pillow
- Copyright: Jeffrey A. Clark and contributors; Secret Labs AB; Fredrik Lundh
- License: MIT-CMU (the permissive, MIT-style licence Pillow inherits from PIL;
  the package declares `License-Expression: MIT-CMU`) — see
  [`third_party_licenses/pillow-LICENSE.txt`](pillow-LICENSE.txt)
- Usage: pulled in by pystray; used only to draw the tray-icon image at runtime
  (`Image.new` + `ImageDraw`). Unmodified. The build deliberately **excludes** numpy
  (an optional Pillow accelerator that RibbitFlip does not use).

---

### PyInstaller — GPL-2.0-or-later, with the PyInstaller bootloader exception

- Project: https://pyinstaller.org
- Copyright: PyInstaller Development Team and contributors
- License: GPL-2.0-or-later **with an explicit exception** — see
  [`third_party_licenses/pyinstaller-COPYING.txt`](pyinstaller-COPYING.txt)
- Usage: build-time tool only ([`build_exe.bat`](../build_exe.bat) +
  [`RibbitFlip.spec`](../RibbitFlip.spec)) used to freeze `ribbitflip_monitor.py`
  into `RibbitFlip.exe`. Not imported by, or distributed as part of,
  RibbitFlip's own source.

PyInstaller's license includes an exception permitting the bootloader/runtime
stub embedded in every frozen executable to be distributed under **any** license
the application author chooses. Building `RibbitFlip.exe` therefore does not
impose GPL terms on RibbitFlip — only PyInstaller's own source remains GPL. The
resulting `.exe` stays MIT-licensed.

---

### Nordic UART Service (NUS) protocol — informational, no bundled code

RibbitFlip talks to the puck using the **Nordic UART Service**, a Bluetooth LE
service published by Nordic Semiconductor as part of its nRF SDK documentation
(base UUID `6e400001-b5a3-f393-e0a9-e50e24dcca9e`, RX/TX characteristics
`6e400002-…` / `6e400003-…`). These UUIDs are an open, widely-used
interoperability standard used by thousands of BLE peripherals — not
proprietary to the puck's manufacturer. No Nordic Semiconductor code is bundled.

The puck's specific wake/sleep command bytes and accelerometer/gyroscope packet
layout were determined by the hobbyist community through independent
reverse-engineering of the device's observable BLE traffic (see
[`CREDITS.md`](../docs/CREDITS.md)). This is factual, functional protocol information
(data formats and command bytes) used for interoperability purposes.

---

### Brand fonts — Baloo 2, Nunito, JetBrains Mono, Titan One (SIL OFL 1.1)

The **felt-skin dashboard UI** self-hosts four open-source typefaces as
`.woff2` files under [`web/assets/fonts/`](../web/assets/fonts/), served only by
the local dashboard server (no external CDN; offline- and CSP-safe). The
GitHub Pages landing (`docs/`) bundles the same four. All of them are licensed
under the **SIL Open Font License, Version 1.1** — see
[`third_party_licenses/SIL-OFL-1.1.txt`](SIL-OFL-1.1.txt).

- **Baloo 2** — © The Baloo 2 Project Authors
  (https://github.com/googlefonts/baloo). Display / headings / wordmark.
- **Nunito** — © The Nunito Project Authors
  (https://github.com/googlefonts/nunito). Body text. The panel serves five static weights (400–800),
  instanced with fontTools from the original variable file with no outline changes; the OFL
  allows this and the family has no Reserved Font Name.
- **JetBrains Mono** — © 2020 The JetBrains Mono Project Authors
  (https://github.com/JetBrains/JetBrainsMono). Numbers, hex, monospace.
- **Titan One** — © The Titan One Project Authors
  (https://github.com/googlefonts/titan-one). Headline face: its heavy rounded
  letterforms match the sewn-felt lettering of the RibbitFlip logo. Used for the
  landing page's H1 and section headings, and for the dashboard's card, section
  and dialog titles. Titles only — it ships in one weight, so anything smaller
  than ~15 px stays on Baloo 2.

Only the `latin` + `latin-ext` woff2 subsets are bundled (variable-weight
files). The OFL permits bundling and redistribution, including embedding in
documents; the fonts are unmodified and are not sold on their own.

---

### Gamepad Viewer (controller artwork) — MIT License

- Project: https://github.com/e7d/gamepad-viewer (live at https://gamepad.e7d.io)
- Copyright (c) 2017-2020 Michaël "e7d" Ferrand
- License: MIT — see [`third_party_licenses/gamepad-viewer-LICENSE.txt`](gamepad-viewer-LICENSE.txt)
- Usage: the eight SVGs of the `templates/xbox-one/` skin, copied into
  [`web/assets/gamepad/`](../web/assets/gamepad/) and drawn by the dashboard's
  "controller" widget. **Artwork only** — none of the project's JavaScript or CSS
  files are bundled. RibbitFlip's own
  [`web/css/14b-gamepad.css`](../web/css/14b-gamepad.css) ports the part geometry
  out of upstream's `template.css`, and
  [`web/js/rf-42-padview.js`](../web/js/rf-42-padview.js) drives the parts from this
  app's live state instead of the browser Gamepad API.
- Modified: **yes, twice — and reproducibly.** Both changes are applied by
  [`tools/gamepad_art.py`](../tools/gamepad_art.py), which takes a folder of freshly
  fetched upstream files and prints every substitution, so the difference can be
  re-derived rather than taken on trust. **(1)** The Guide button in `base-black.svg`
  and `base-white.svg` carried the console maker's logo (one `<path>` per file); both
  were removed. Trademarks are not covered by a copyright licence and RibbitFlip is
  endorsed by nobody. **(2)** Every colour was remapped onto this app's palette by
  luminance — a warm espresso body instead of glossy black, the app's amber for the
  "button is down" overlays, and the app's own data palette for A/B/X/Y. **No shape,
  path or coordinate was altered**, so the drawing is still entirely upstream's work.
  The MIT licence permits both; they are recorded here and in
  [`web/assets/gamepad/README.md`](../web/assets/gamepad/README.md) so that a diff
  against upstream reads as deliberate.

**Upstream's own attribution, carried forward:** e7d's README credits
**mrmcpowned** (https://gamepadviewer.com) as the author of the originals its skins
are reworked from. Both are named in [`docs/CREDITS.md`](../docs/CREDITS.md).

---

### VSCO 2 Community Edition (instrument recordings in RibbitBeat) — CC0 1.0

- Project: VSCO 2 Community Edition by Versilian Studios LLC (Sam Gossner), https://github.com/sgossner/VSCO-2-CE
- License: Creative Commons Zero 1.0 Universal (CC0) — see
  [`third_party_licenses/vsco2-ce-LICENSE.txt`](vsco2-ce-LICENSE.txt). CC0 requires no attribution; the authors
  are thanked in [`docs/CREDITS.md`](../docs/CREDITS.md).
- Usage: 3–4 single-note recordings each for RibbitBeat's Trumpet, Flute, Strings, Cello, Piano, Organ, Oboe,
  Clarinet, Trombone and Tuba, in [`web/assets/<instrument>/`](../web/assets/) (folders `trabka`, `flet`,
  `smyczki`, `wiolonczela`, `piano`, `organy`, `oboj`, `klarnet`, `puzon`, `tuba`), each with an
  `<instrument>.json` description and a `ZRODLA.md` listing the address of every source recording. Bundled into
  `RibbitBeat.exe` and `RibbitFlip.exe` (the whole of `web/assets`).
- Modified: **yes, reproducibly.** [`tools/ribbitbeat_probki_instrumentow.py`](../tools/ribbitbeat_probki_instrumentow.py)
  takes the downloaded recordings and keeps about one second of each: mono, 22,050 Hz, PCM16, trimmed to the
  attack and one looped section (its end cross-faded into its start), loudness-matched. In the game the sample is
  re-pitched to the player's note (playback-rate change).

---

### Screams in RibbitBeat (the “Krzyk” instrument): CC BY 3.0 and CC0 1.0

The eight samples in [`web/assets/krzyk/`](../web/assets/krzyk/) are modified recordings from the
“Aargh! (male screams)” pack on OpenGameArt (https://opengameart.org/content/aargh-male-screams,
collected by congusbongus). Bundled in `RibbitBeat.exe`, `RibbitFlip.exe` and `RibbitFlip-Essential.exe`.

- **Helmut Scream** by creativeheroes, http://freesound.org/people/creativeheroes/sounds/84353/,
  licensed under Creative Commons Attribution 3.0 (CC BY 3.0), https://creativecommons.org/licenses/by/3.0/
  (file `krzyk-1.wav`, from the recording `aargh0`).
- **Male_Thijs_loud_scream** by thanvannispen, http://freesound.org/people/thanvannispen/sounds/9432/,
  licensed under CC BY 3.0, https://creativecommons.org/licenses/by/3.0/ (files `krzyk-2.wav` and
  `krzyk-3.wav`, from the recordings `aargh1` and `aargh2`).
- **human male scream multi** by JohnsonBrandEditing,
  http://freesound.org/people/JohnsonBrandEditing/sounds/173944/, CC0 1.0
  (files `krzyk-4.wav` to `krzyk-8.wav`, from the recordings `aargh3` to `aargh7`).
- **Modified:** trimmed, downsampled to 32 kHz mono, level-matched and given a looped segment (end
  stitched to start); retuned to the player's note in the game. The original authors do not endorse
  this project or these changes.

---

### What the packaged `RibbitFlip.exe` additionally contains

The one-file executable is a frozen Python application, so besides the libraries
above it embeds the CPython runtime and the native libraries that runtime needs.
These are listed separately because a downloaded `.exe` travels without this
repository — the build therefore also **bundles the `third_party_licenses/`
folder itself** (see [`RibbitFlip.spec`](../RibbitFlip.spec)), so every copy of the
executable carries the full licence texts with it.

| Component in the executable | Licence | Text |
|---|---|---|
| CPython runtime — `python314.dll`, `base_library.zip`, standard-library extension modules | PSF-2.0 (plus the notices CPython incorporates: bzip2, Zstandard, CWI, BeOpen, CNRI) | [`python-LICENSE.txt`](python-LICENSE.txt) |
| OpenSSL — `libssl-3.dll`, `libcrypto-3.dll` (used by Python's `ssl`/`hashlib`) | Apache-2.0 | [`openssl-LICENSE-Apache-2.0.txt`](openssl-LICENSE-Apache-2.0.txt) |
| libffi — `libffi-8.dll` (used by `ctypes`, which drives the MIDI output) | MIT-style | [`libffi-LICENSE.txt`](libffi-LICENSE.txt) |
| Expat — `pyexpat` extension | MIT | [`expat-COPYING.txt`](expat-COPYING.txt) |
| PyWinRT (`winrt-runtime` + the `winrt-Windows.*` projections pulled in by bleak for Windows BLE) | MIT, © Microsoft Corporation | [`pywinrt-LICENSE.txt`](pywinrt-LICENSE.txt) |
| ViGEmClient — `ViGEmClient.dll` (x86 + x64), shipped inside `vgamepad` | MIT, © Benjamin Höglinger-Stelzer | [`ViGEmClient-LICENSE.txt`](ViGEmClient-LICENSE.txt) |
| defusedxml — pulled in by Pillow's plugin loader | PSF-2.0 | [`defusedxml-LICENSE.txt`](defusedxml-LICENSE.txt) |
| olefile — pulled in by Pillow (OLE-container image formats) | BSD-2-Clause | [`olefile-LICENSE.txt`](olefile-LICENSE.txt) |
| Microsoft Visual C++ runtime — `VCRUNTIME140.dll`, `VCRUNTIME140_1.dll`, `MSVCP140.dll` | Microsoft redistributable component, redistributed unmodified under the Visual Studio redistribution terms | — (no text is provided by Microsoft for redistribution) |

**On OpenSSL and Apache-2.0 §4(d):** the OpenSSL project does not ship a `NOTICE`
file with its Apache-2.0 licence, so there is no notice text to propagate; the
licence itself is included above.

**How this list was produced (so it can be re-checked):** it is read off the
build's own table of contents (`build*/RibbitFlip/EXE-00.toc`), not from
assumptions — every `BINARY`/`EXTENSION` entry there is accounted for above or by
a section earlier in this file.

---

### Original artwork — first-party, no third-party license

All felt-style artwork shipped with the project — the icon set, the wordmark and
logo, the foam-hand cursors, the capsule and knob sprites, the singing-frog
sprites, the lily pad and the felt background texture — is **original artwork
created for this project** by its author. It is covered by the repository's MIT
license (see [`LICENSE`](../LICENSE)) and involves no third-party assets. Concretely
that is:

- everything under [`web/assets/`](../web/assets/) **except** `web/assets/fonts/`
  (the OFL typefaces above), `web/assets/gamepad/` (the MIT controller artwork
  above), `web/assets/krzyk/` (the CC BY 3.0 and CC0 recordings above), the RibbitBeat
  instrument folders with VSCO 2 CE recordings (above) and the service logos listed below,
- the source-resolution originals under [`assets/`](../assets/) — `assets/fullsize/`,
  `assets/caps/`, `assets/cursor/`, plus the app icons
  `assets/ribbitflip.ico`, `assets/ribbitflip_logo.png` and
  `assets/ribbitflip_head.png`,
- everything under [`docs/assets/`](../docs/assets/) **except** `docs/assets/fonts/`
  — the landing page's icon copies, felt texture, cursors and the dashboard
  screenshots with synthetic simulation data. Two screenshots
  (`screen-01-nakladka-w-grze.jpg`, `screen-03-skaner.jpg`) show other people's games in the
  background, only so the overlay and the scanner can be seen over a game; those games belong to
  their makers.

Third-party service logos appear only on link buttons: Discord and Ko-fi
(`web/assets/icons/discord.png`, `kofi.png`, `kofi_cup.png` and their copies in `docs/assets/icons/`)
and GitHub (`docs/assets/icons/github.png`). They belong to those services and are not covered by
the project's MIT licence. The built-in REST API templates name their services in text only. The
synth sounds are generated at runtime by the browser's WebAudio API; the only bundled recordings are
the RibbitBeat instrument samples (VSCO 2 CE, CC0) and the screams (CC BY 3.0 and CC0), described above.
