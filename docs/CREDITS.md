# Podziękowania / Credits

**[Polski](#polski)** · [English](#english)

---

## Polski

RibbitFlip to niezależna aplikacja, która stoi na pracy społeczności. Bez niej rozmowa ze sprzętem
w ogóle nie byłaby możliwa. Ten plik mówi dokładnie, co jest czyje: co pochodzi od innych ludzi,
ile tego jest i co napisano tutaj. Podziękowanie powinno być na tyle konkretne, żeby dało się je
sprawdzić.

### Odtworzenie protokołu BLE

Żeby w ogóle porozmawiać z kapslem „Triki”, trzeba znać kilka faktów o nim, a producent nie
publikuje żadnego z nich. Społeczność hobbystów ustaliła je, obserwując ruch Bluetooth urządzenia,
i RibbitFlip z tej wiedzy korzysta. Bez tej pracy ten projekt by nie powstał.

**Dokładnie to, co jest wspólne, w całości. Nic więcej nie ma:**

| Fakt | Wartość |
|---|---|
| Usługa Nordic UART, charakterystyka zapisu | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` |
| Usługa Nordic UART, charakterystyka powiadomień | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` |
| Charakterystyka diody LED (spoza specyfikacji NUS) | `6e400004-b5a3-f393-e0a9-e50e24dcca9e`, `0x01` włącza / `0x00` wyłącza |
| „Obudź IMU i zacznij nadawać” | `20 10 00 D0 07 34 00 03` |
| „Uśpij” | `20 00 00 00 00 00 00` |
| Pakiet IMU | 14 bajtów: `0x22`, potem bajt przycisku (`0x00` puszczony / `0x01` wciśnięty), potem 6 × `int16` little-endian: **gx, gy, gz, ax, ay, az**, czyli najpierw żyroskop, potem akcelerometr |
| Pakiet stanu | 5 bajtów, nagłówek `0x21`. Nie każdy egzemplarz je wysyła, zobacz uwagę niżej |

Dwa z tych wierszy były tu błędne do 2026-08-22. Poprawki warto napisać wprost, bo każdy, kto
skopiował tę tabelę, skopiował też błędy:

- **Kanały zaczynają się od żyroskopu.** Kapsel leżący płasko i nieruszany pokazuje na CH5 około
  −2065 LSB, czyli jedno g przy 2048 LSB/g, a CH0–CH2 stoją na zerze. Grawitacja jest więc w
  *drugiej* trójce. Filtr orientacji w tym projekcie zawsze miał to dobrze, ale jego własna
  dokumentacja i sterownik audio nie.
- **Bajt 1 to przycisk, a nie część nagłówka.** W nagraniu 720 ramek miał wartość `0x01` dokładnie
  w sześciu momentach, gdy tester wciskał i przytrzymywał przycisk, a w całym nagraniu nie
  przyszedł ani jeden pakiet `0x21`. Na tym egzemplarzu przycisk jest zgłaszany *tylko* tutaj.
  Upieranie się przy `0x00` w tym miejscu nie kończy się tylko utratą tych ramek: parser
  synchronizuje się wtedy bajt po bajcie przez treść i czasem bierze `0x21` ze środka odczytu
  czujnika za pakiet stanu, wymyślając naciśnięcia przycisku z szumu akcelerometru.

Te wartości to **fakty o fizycznym urządzeniu, a nie czyjś kod**. Każdy program, który rozmawia z
tym kapslem, musi użyć identycznych UUID i identycznych bajtów poleceń, inaczej sprzęt po prostu
nie odpowiada. Wypisujemy je tu otwarcie, żeby oddać zasługi i żeby następna osoba nie musiała
znowu podsłuchiwać ruchu BLE, żeby je znaleźć.

Wcześniejsza praca społeczności, która opisała ten protokół:

- **[`Wojtekb30/unofficial-triki-api-py`](https://github.com/Wojtekb30/unofficial-triki-api-py)**
  (MIT): nieoficjalne API w Pythonie na Bleak, które odbiera dane IMU z kapsla i opisuje protokół
  podany wyżej.
- **[`Maku-hub/TrikiScope`](https://github.com/Maku-hub/TrikiScope)**: uruchamia strumień
  poleceniem `20 10 00 D0 07 68 00 03` i podaje około 98 Hz, wobec wariantu `34 00` używanego
  tutaj. Właśnie ten jeden różniący się bajt doprowadził do roboczej hipotezy, że wybiera on
  częstotliwość wyjściową LSM6DSL (52 / 104 / 208 / 416 Hz). Na niej opiera się praca RibbitFlipa
  nad opóźnieniami.
- **[„Triki Device: BLE Protocol & Integration Guide” autorstwa `CatManch`](https://gist.github.com/CatManch/c9d58c38254471ffce2526f51955243a)**:
  jedyne znalezione dotąd publiczne źródło, które opisuje dwie rzeczy, na których RibbitFlip
  polega: że **charakterystykę LED trzeba zapisywać z potwierdzeniem** (zapis bez potwierdzenia
  może zostać po cichu zignorowany) i że **bajt 1 ramki `0x22` niesie stan przycisku**, a nie jest
  stałą częścią nagłówka. Oba źródła są wymienione w miejscu użycia w `ribbitflip_monitor.py` i
  `ribbitflip_audio.py`.
- Szersza dyskusja hobbystów, w której ruch Bluetooth tego urządzenia rozebrano na części i
  publicznie udostępniono. Wymieniamy ją tu bez wskazywania konkretnego wątku, bo żadnego źródła
  nie da się wskazać z pewnością. Zobacz uwagę na końcu tej sekcji.

### Co jest wspólne: zmierzone, a nie zadeklarowane

Podziękowanie niewiele znaczy, jeśli nikt nie może go sprawdzić, więc podajemy sprawdzenie i
metodę, żeby każdy mógł je powtórzyć. Oba pliki porównano linia po linii z kodem Pythona
RibbitFlipa, po usunięciu komentarzy, docstringów, pustych linii i różnic we wcięciach.

| Porównanie | Ich linie kodu | Identyczne linie | W tym nietrywialne | Najdłuższy identyczny ciąg |
|---|---|---|---|---|
| `TrikiPy.py` → `ribbitflip_audio.py` | 184 | 9 (4,9%) | **0** | 1 linia (`import asyncio`) |
| `TrikiPy.py` → `ribbitflip_monitor.py` | 184 | 11 (6,0%) | **0** | 3 linie (`return True` / `except Exception:` / `return False`) |
| `triki_airmouse.py` → `ribbitflip_audio.py` | 489 | 13 (2,7%) | 1 | 2 linie (`import math` / `import struct`) |
| `triki_airmouse.py` → `ribbitflip_monitor.py` | 489 | 25 (5,1%) | 1 | 2 linie (`import json` / `import math`) |

„Nietrywialna” znaczy dłuższa niż 25 znaków i niebędąca `import`. We wszystkich czterech
porównaniach pojawia się dokładnie jedna taka linia, w obu kierunkach:
`if __name__ == "__main__":`.

Jedno uczciwe zastrzeżenie, bo czytelnik, który położy pliki obok siebie, to zobaczy: procedura
składająca strumień powiadomień działa w obu projektach **tak samo**. Zbiera dane w buforze,
rozpoznaje `0x22 0x00`, rozpakowuje sześć liczb short little-endian od przesunięcia 2, przy
`0x21` odrzuca pięć bajtów, a przy czymkolwiek innym synchronizuje się od nowa. To zbieżność, a
nie kopiowanie: układ pakietu nie zostawia wyboru, a pomiar wyżej nie znajduje w tym fragmencie
ani jednej wspólnej linii.

Dla skali: `unofficial-triki-api-py` ma około 350 linii, udostępnia `TrikiDevice` i `TrikiKnob` i
kończy na odkodowanych wartościach czujnika. RibbitFlip ma około 37 000 linii: filtrowanie
orientacji (1-Euro i EMA, krzywe expo, kalibracja, automatyczne zerowanie), silnik wyzwalaczy,
generowanie klawiatury i myszy, wirtualny pad Xbox, MIDI z kwantyzacją do skali, OSC z profilami
odbiorników, klient REST z szyfrowanym sejfem poświadczeń, pad syntezatora WebAudio, lokalny
serwer HTTP z Server-Sent Events i dwujęzyczny panel w przeglądarce.

Jeśli Twoja praca przyczyniła się do odtworzenia protokołu kapsla i chcesz, żeby wymienić Cię z nazwy, albo jeśli
wymieniono tu źródło, którego być nie powinno, albo brakuje Twojego wątku, który powinien być
podlinkowany, otwórz zgłoszenie albo pull request. Ta sekcja powinna oddawać ludzi stojących za
tą pracą, a podziękowanie, za którym nie da się pójść, nikomu nie pomaga.

### Mysz powietrzna: pomysł, wykonanie niezależne

- **[`kub0vvik/TrikiAirMouse`](https://github.com/kub0vvik/TrikiAirMouse)**: mały projekt w
  Pythonie, który zamienia kapsel w mysz powietrzną. Dziękujemy mu za **pomysł**, że przechylanie
  kapsla może sterować kursorem Windows, bo od tego zaczęła się grupa sterowania ruchem w
  RibbitFlipie. Porównanie wyżej obejmuje też ten projekt: poza szablonowymi elementami języka nie
  ma wspólnego kodu. Tamten projekt opisuje nienazwany „filtr wygładzania ruchu”, a ścieżka
  kursora w RibbitFlipie jest własna: do wyboru filtr 1-Euro albo EMA, krzywa odpowiedzi, okrągła
  martwa strefa, zawężenie przy zerze, dwustrefowe przyspieszenie i ogranicznik kroku na próbkę.
  Wszystko to jest dostępne jako ustawienia w panelu.

### Dokumentacja sprzętu

RibbitFlip rozmawia z urządzeniem, dla którego nikt nie opublikował karty katalogowej. To, z czego
jest zbudowane, ustalili inni ludzie lutownicą i mikroskopem, i otwarcie się tym podzielili:

- **[`Piwencjusz/zabka-triki-hardware`](https://github.com/Piwencjusz/zabka-triki-hardware)**:
  zdjęcia płytki, rozkład wyprowadzeń SWD, zrzut zewnętrznej pamięci flash oraz identyfikacja
  głównego mikrokontrolera (Nordic **nRF52810**), czujnika ruchu (**ST LSM6DSL**) i zewnętrznej
  pamięci NOR flash (**Macronix MX25R8035F**).
- **[Fork `moe-takasaki`](https://github.com/moe-takasaki/zabka-triki-hardware)** (tsuki):
  głębsze badanie, czyli sondowanie J-Linkiem, odtworzenie wyprowadzeń nRF i ustalenie, że obrazy
  firmware przesyłane bezprzewodowo są **zaszyfrowane** (entropia ≈ 7,996 bita na bajt, brak
  tablicy wektorów Cortex-M), niezależnie od blokady APPROTECT urządzenia. Wynik negatywny, ale
  naprawdę przydatny: mówi wprost, że żaden wysiłek nie zamieni firmware producenta w spis
  poleceń.
- **[`AND-Y0`](https://github.com/AND-Y0)**: opis protokołu BLE w tym forku, ustalony niezależnie
  od źródeł wymienionych wyżej.

To, że czujnik to LSM6DSL, nie jest ciekawostką. Wyznacza zakres akcelerometru na ±16 g
(0,488 mg/LSB ⇒ około 2048 LSB/g, które zakłada ten kod) i ustawia możliwe częstotliwości
wyjściowe na drabince 52 / 104 / 208 / 416 Hz, na której opiera się hipoteza o ramce startowej
opisana wyżej.

Nic z tych repozytoriów nie zostało skopiowane do tego projektu. Nie mają licencji i żadna nie
jest potrzebna, żeby podziękować za fakt o fizycznym urządzeniu.

### Grafika kontrolerów: Gamepad Viewer

Rysunek pada w ściądze i w nakładkach **nie** jest nasz. Pliki SVG w
[`web/assets/gamepad/`](../web/assets/gamepad/) pochodzą z projektu
**[Gamepad Viewer](https://github.com/e7d/gamepad-viewer)** autorstwa **Michaëla „e7d” Ferranda**
(© 2017-2020, MIT, tekst w
[`third_party_licenses/gamepad-viewer-LICENSE.txt`](../third_party_licenses/gamepad-viewer-LICENSE.txt)).
Wzięliśmy je z **dwóch** jego folderów: `templates/xbox-one/` dla kontrolera Xbox 360 i
`templates/ds4/` (do [`web/assets/gamepad/ds4/`](../web/assets/gamepad/ds4/)) dla DualShock 4.
e7d z kolei dziękuje **mrmcpowned**, z którego oryginałów dla
**[gamepadviewer.com](https://gamepadviewer.com)** przerobiona jest ta skórka. Podziękowania
należą się więc obu, a ta grafika to w ogóle powód, dla którego aplikacja może pokazać, co
właśnie wciska.

**Trzeci kontroler nie jest ani ich, ani niczyj inny.** Rysunek Wii w
[`web/assets/gamepad/wii/`](../web/assets/gamepad/wii/) (Wii Remote, Nunchuk i wąski pasek na
to, co protokół DSU przenosi ponad nie) narysowano dla tego projektu skryptem
[`tools/wii_art.py`](../tools/wii_art.py) z prostych kształtów: biała obudowa, jak w Wii Remote,
z akcentami we własnej, espresso-brązowej palecie aplikacji. Gamepad Viewer nie ma szablonu Wii i
nie znaleźliśmy takiego na licencji, którą ta aplikacja mogłaby dołączyć. Do 2026-08-25 rodzaj
Wii pożyczał korpus DualShocka, z argumentem, że DSU opisuje urządzenie w kształcie DualShocka.
To prawda o transmisji, ale nieprawda o obrazku: wybierało się „Wii”, a widziało DualShocka.
Teraz trzy rodzaje to trzy rysunki, a ten nie niesie żadnych praw osób trzecich.

Obie jego części mają **proporcje z konturów dostarczonych przez właściciela**: Nunchuk od
pierwszego dnia, a pilot od 2026-08-25, kiedy to, co wcześniej rysowano na oko, zmierzono
względem konturu. Z tych konturów wzięto pomiary, czyli gdzie leży przycisk i jak jest duży, a
to kształt samego sprzętu. W wyniku nie ma ani jednej ścieżki z żadnego z nich: każdy kształt w
`wii/` to koło, zaokrąglony prostokąt albo krzywa wygenerowana przez własny generator projektu.

Co jeszcze jest nasze: CSS, który składa części
([`web/css/14b-gamepad.css`](../web/css/14b-gamepad.css), z geometrią przeniesioną z
`template.css` oryginału, dzięki której elementy trafiają na rysunek), oraz widżet, który
podświetla je na podstawie własnego strumienia danych RibbitFlipa
([`web/js/rf-42-padview.js`](../web/js/rf-42-padview.js)). Nie używamy żadnego JavaScriptu z
oryginału. Gamepad Viewer czyta Gamepad API przeglądarki, a to czyta, co aplikacja postanowiła
wcisnąć. Dlatego rysunek działa nawet przy rozbrojonych wszystkich wyjściach i może na czerwono
powiedzieć, że nic tak naprawdę nie wyszło z aplikacji.

**Dwie modyfikacje, obie celowe i obie odtwarzalne.** Wprowadza je
[`tools/gamepad_art.py`](../tools/gamepad_art.py), a nie ręczna edycja, więc każdy może je
powtórzyć na świeżo pobranych plikach oryginału i przeczytać każdą podmianę, którą wypisuje
skrypt. Po pierwsze, na przycisku Guide w dwóch plikach `base-*.svg` było narysowane **logo**
producenta konsoli (po jednym `<path>` w każdym). Oba usunęliśmy. Licencja MIT dotyczy praw
autorskich, a nie cudzego znaku towarowego, a tej aplikacji nikt nie firmuje. Po drugie,
**paletę** przeniesiono na paletę aplikacji: błyszczący czarny korpus oryginału stał się ciepłą
gamą espresso, nakładki „przycisk wciśnięty” przybrały bursztyn aplikacji, a A/B/X/Y zachowały
kodowanie kolorami we własnej palecie danych aplikacji. **Nie zmieniliśmy ani jednego kształtu,
ścieżki ani współrzędnej**, więc rysunek to nadal w całości praca e7d i mrmcpowned, tylko w innym
kolorze. Skórka DualShocka przechodzi te same dwa zabiegi (znak jej producenta to logo
PlayStation na przycisku PS, narysowane jako dwa `<path>`, oba usunięte) i ma własną mapę
kolorów symboli ✕ ○ □ △. Szczegóły w
[`web/assets/gamepad/README.md`](../web/assets/gamepad/README.md).

### Żaba: zrobiona tutaj, z maszyną w procesie

Punkowa żaba jest własna tego projektu: logo
([`docs/assets/logo-ribbitflip.png`](assets/logo-ribbitflip.png)), maskotka, głowa i napis, a
także filcowo-przeszywany wygląd, na którym zbudowana jest cała aplikacja. Została **złożona
tutaj**, a w procesie brały udział narzędzia generatywne: funkcje generatywne Adobe Photoshopa i
Google Gemini. Które z nich wykonało który etap, nie jest już zapisane, i ten plik nie udaje, że
jest inaczej. Mówimy to w ogóle dlatego, że zasada z początku tego dokumentu („podziękowanie
powinno być na tyle konkretne, żeby dało się je sprawdzić”) nie przestaje obowiązywać, gdy
współtwórcą jest maszyna. Warunki obu narzędzi pozwalają na komercyjne użycie tego, co tworzą,
więc niczego nie używamy ponad to, na co pozwolono.

**Uczciwa konsekwencja, powiedziana wprost, a nie ominięta:** materiał wytworzony wyłącznie przez
model nie ma autora-człowieka, a przeważające stanowisko w UE jest takie, że w ogóle nie jest to
utwór. W Stanach Zjednoczonych Copyright Office mówi to samo w sprawie rejestracji. Dlatego ten
projekt **nie** stawia „wszelkie prawa zastrzeżone” na tych pikselach, bo może w ogóle nie mieć
praw autorskich do wygenerowanych części, a zastrzeganie prawa, którego się nie ma, to kiepski
sposób prowadzenia otwartego repozytorium.

W zamian prosimy o coś węższego, co w ogóle nie zależy od autorstwa. Nazwa **RibbitFlip** i
znaki zbudowane z tej grafiki oznaczają *to* wydanie. **Nie obejmuje ich licencja MIT** w
[`LICENSE`](../LICENSE), która dotyczy kodu. Forkuj kod swobodnie, ale pod własną nazwą i z
własną grafiką, żeby nikt nie pomylił Twojej wersji z tą. Ta prośba dotyczy odróżniania wydań,
czyli tego, do czego służy znak, i obowiązuje niezależnie od tego, kto albo co trzymało pióro.

### Krzyki w RibbitBeat: nagrania z OpenGameArt

Instrument **Krzyk** w RibbitBeat gra na ośmiu prawdziwych nagraniach męskiego krzyku z paczki
[„Aargh! (male screams)”](https://opengameart.org/content/aargh-male-screams) (autor paczki: congusbongus). Pochodzą od trzech
osób i **zostały przez nas zmienione**: przycięte, zmniejszone do 32 kHz mono, głośność wyrównana, z odcinkiem zapętlonym tak,
żeby krzyk trwał, dopóki trzymasz nutę, i z podwyższaną albo obniżaną wysokością (pitch shift) do nuty.

- **Helmut Scream**: [creativeheroes](http://freesound.org/people/creativeheroes/sounds/84353/), licencja
  [CC BY 3.0](http://creativecommons.org/licenses/by/3.0/) (`aargh0`).
- **Male_Thijs_loud_scream**: [thanvannispen](http://freesound.org/people/thanvannispen/sounds/9432/), licencja
  [CC BY 3.0](http://creativecommons.org/licenses/by/3.0/) (`aargh1`, `aargh2`).
- **human male scream multi**: [JohnsonBrandEditing](http://freesound.org/people/JohnsonBrandEditing/sounds/173944/), licencja
  [CC0 1.0](http://creativecommons.org/publicdomain/zero/1.0/) (`aargh3` do `aargh7`).

Skrypt przetwarzania: `tools/ribbitbeat_krzyk_probki.py`; opis plików: `web/assets/krzyk/ZRODLA.md`.

### Instrumenty orkiestrowe w RibbitBeat: nagrania z VSCO 2 Community Edition

Trąbka, Flet, Smyczki, Wiolonczela, Pianino, Organy, Obój, Klarnet, Puzon i Tuba grają w RibbitBeat prawdziwymi nagraniami z
[VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE), otwartej biblioteki orkiestrowej Versilian Studios (Sam Gossner)
wydanej na [CC0 1.0](http://creativecommons.org/publicdomain/zero/1.0/). CC0 nie wymaga podpisu, ale podziękowanie się należy: bez
tej pracy instrumenty gry zostałyby przy oscylatorach. Nagrania **zostały przez nas zmienione**: z każdego zostaje ok. sekundy
(atak i zapętlony odcinek), mono 22 kHz, z wyrównaną głośnością, a w grze wysokość jest przestrajana do nuty gracza.
Skrypt: `tools/ribbitbeat_probki_instrumentow.py`; opis plików: `web/assets/<instrument>/ZRODLA.md`.

### Zależności open source

Zobacz [`third_party_licenses/README.md`](../third_party_licenses/README.md): **bleak**,
**pynput**, **vgamepad** (i projekt **ViGEmBus**, który opakowuje), **pystray** (ikona w
zasobniku, LGPL-3.0), **Pillow** (rysuje obraz ikony w zasobniku, licencja HPND / w stylu
MIT-CMU) i **PyInstaller**, każda z licencją i uwagami o dołączaniu.

Wbudowane melodie gry RibbitBeat (`web/gry/js/piosenki.js`) to utwory z domeny publicznej zapisane
tutaj w notacji tekstowej. Trzy z pakietu „Skoczne” (The Entertainer S. Joplina, W grocie Króla Gór
E. Griega, trio The Stars and Stripes Forever J. P. Sousy) przepisano z plików MIDI **Mutopia
Project** (mutopiaproject.org), oznaczonych tam jako Public Domain. Dziękujemy wolontariuszom
Mutopii za składanie nut, z których każdy może korzystać.

### Standardy

- **Nordic Semiconductor**: UUID usługi Nordic UART Service (NUS) używane do komunikacji BLE są
  częścią publicznie dostępnej dokumentacji nRF SDK i interoperacyjności Bluetooth firmy Nordic
  Semiconductor.
- **Web Audio API (W3C)**: biblioteka dźwięków i syntezator „Pad XY” w przeglądarce (oscylatory,
  filtry dwukwadratowe, obwiednie ADSR, pogłos splotowy z generowanej odpowiedzi impulsowej,
  przester soft-clip na `WaveShaper`) są zbudowane bezpośrednio na standardowym
  [Web Audio API](https://www.w3.org/TR/webaudio/). To oryginalny, ręcznie napisany silnik
  syntezy subtraktywnej, bez bibliotek audio osób trzecich i bez pożyczonego kodu DSP. Fonty
  używane w tym interfejsie są wymienione w
  [`third_party_licenses/README.md`](../third_party_licenses/README.md) (SIL OFL 1.1).

*RibbitFlip to nieoficjalny projekt hobbystyczny, niepowiązany z Żabką ani z żadną inną firmą,
przez nie niepopierany i niezwiązany z nimi. Zobacz zastrzeżenie w [README](../README.md).*

---

## English


RibbitFlip is an independent application, and it stands on community work that
made talking to the hardware possible at all. This file says precisely which is
which: what came from other people, what it amounts to, and what was written
here. Credit should be specific enough to be checked.

### BLE protocol reverse-engineering

Talking to the "Triki" puck at all requires knowing a handful of facts about it,
and the vendor publishes none of them. The hobbyist community worked them out by
watching the device's Bluetooth traffic, and RibbitFlip uses that knowledge.
Without that effort this project would not exist.

**Exactly what is shared, in full — this is the whole of it:**

| Fact | Value |
|---|---|
| Nordic UART service, write characteristic | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` |
| Nordic UART service, notify characteristic | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` |
| LED characteristic (not part of the NUS spec) | `6e400004-b5a3-f393-e0a9-e50e24dcca9e`, `0x01` on / `0x00` off |
| "Wake the IMU and start streaming" | `20 10 00 D0 07 34 00 03` |
| "Sleep" | `20 00 00 00 00 00 00` |
| IMU packet | 14 bytes: `0x22`, then a button byte (`0x00` released / `0x01` held), then 6 × little-endian `int16`: **gx, gy, gz, ax, ay, az** — gyroscope first, accelerometer second |
| Status packet | 5 bytes, header `0x21` — not every unit sends these; see the note below |

Two of those rows were wrong here until 2026-08-22, and the corrections are worth stating
plainly because anyone who copied this table copied the mistakes:

- **The channel order is gyroscope first.** A puck lying flat and untouched reads about
  −2065 LSB on CH5, which is one g at 2048 LSB/g, while CH0–CH2 sit at zero. Gravity is
  therefore in the *second* triple. This project's orientation filter always had it right;
  its own documentation and its audio driver did not.
- **Byte 1 is the button, not part of the header.** In a 720-frame recording it was `0x01`
  for exactly the six episodes the tester pressed and held, and in that whole recording not
  a single `0x21` packet arrived. On this unit the button is reported *only* here. Insisting
  on `0x00` there does not merely lose those frames: the parser resynchronises byte by byte
  through the payload and occasionally mistakes a `0x21` inside a sensor reading for a status
  packet, inventing button events out of accelerometer noise.

Those values are **facts about a physical device, not somebody's code**. Any
program that speaks to this puck has to use the identical UUIDs and the identical
command bytes, or the hardware simply does not answer. They are listed here in
the open, both to give credit and so the next person does not have to sniff BLE
traffic to find them again.

Prior community work that documented this protocol:

- **[`Wojtekb30/unofficial-triki-api-py`](https://github.com/Wojtekb30/unofficial-triki-api-py)**
  (MIT) — an unofficial Python/Bleak API that streams IMU data from the puck and
  documents the protocol above.
- **[`Maku-hub/TrikiScope`](https://github.com/Maku-hub/TrikiScope)** — starts the
  stream with `20 10 00 D0 07 68 00 03` and reports roughly 98 Hz, against the
  `34 00` variant used here. That single differing byte is what led to the working
  hypothesis that it selects the LSM6DSL output data rate (52 / 104 / 208 / 416 Hz),
  which is the basis of RibbitFlip's latency work.
- **[`CatManch`'s "Triki Device: BLE Protocol & Integration Guide"](https://gist.github.com/CatManch/c9d58c38254471ffce2526f51955243a)**
  — the only public source found so far that documents two things RibbitFlip acts on:
  that the **LED characteristic must be written with a response** (an unacknowledged
  write can be silently ignored), and that **byte 1 of the `0x22` frame carries the
  button state** rather than being a fixed part of the header. Both are credited at
  the point of use in `ribbitflip_monitor.py` and `ribbitflip_audio.py`.
- The wider hobbyist discussion in which this device's Bluetooth traffic was
  picked apart and shared publicly. It is credited here without naming a
  particular thread, because no specific source can be pointed at with confidence
  — see the note at the end of this section.

### What is shared, measured rather than asserted

Credit is worth little if nobody can check it, so here is the check, and the
method, so anyone can repeat it. Both files were compared line by line against
RibbitFlip's Python, after stripping comments, docstrings, blank lines and
indentation differences.

| Compared against | Their lines of code | Identical lines | Of those, non-trivial | Longest identical run |
|---|---|---|---|---|
| `TrikiPy.py` → `ribbitflip_audio.py` | 184 | 9 (4.9 %) | **0** | 1 line (`import asyncio`) |
| `TrikiPy.py` → `ribbitflip_monitor.py` | 184 | 11 (6.0 %) | **0** | 3 lines (`return True` / `except Exception:` / `return False`) |
| `triki_airmouse.py` → `ribbitflip_audio.py` | 489 | 13 (2.7 %) | 1 | 2 lines (`import math` / `import struct`) |
| `triki_airmouse.py` → `ribbitflip_monitor.py` | 489 | 25 (5.1 %) | 1 | 2 lines (`import json` / `import math`) |

"Non-trivial" means longer than 25 characters and not an `import`. Across all
four comparisons exactly one such line turns up, in both directions:
`if __name__ == "__main__":`.

One honest caveat, because a reader putting the files side by side will see it:
the routine that reassembles the notification stream follows the **same approach**
in both projects — accumulate into a buffer, recognise `0x22 0x00`, unpack six
little-endian shorts from offset 2, drop five bytes on `0x21`, resynchronise on
anything else. That is convergence, not copying: the packet layout leaves nothing
to choose, and the measurement above finds no shared line in it.

For scale: `unofficial-triki-api-py` is about 350 lines exposing `TrikiDevice`
and `TrikiKnob`, and stops at decoded sensor values. RibbitFlip is about
37 000 lines — orientation filtering (1-Euro and EMA, expo curves, calibration,
auto-tare), a trigger engine, keyboard and mouse emitters, a virtual Xbox pad,
MIDI with scale quantisation, OSC with receiver profiles, a REST client with an
encrypted credential vault, a WebAudio synth pad, a local HTTP server with
Server-Sent Events, and a bilingual browser panel.

If you were involved in reverse-engineering the puck's protocol and want to be
credited by name — or if a source is named here that should not be, or a thread of
yours is missing and should be linked — please open an issue or a pull request.
This section should reflect the people behind the underlying work, and a credit
nobody can follow helps nobody.

### Air-mouse: an idea, independently implemented

- **[`kub0vvik/TrikiAirMouse`](https://github.com/kub0vvik/TrikiAirMouse)** — a
  small Python project that turns the puck into an air mouse. It is credited for
  the **idea** that tilting the puck could drive the Windows cursor, which is
  where RibbitFlip's motion-control group started. The comparison above covers
  this project too: no shared code beyond language boilerplate. That project
  describes an unnamed "motion smoothing filter", while RibbitFlip's cursor path
  is its own — a 1-Euro filter or EMA by choice, a response curve, a radial dead
  zone, near-zero tightening, two-zone acceleration and a per-sample step limiter,
  all of them exposed as settings in the panel.

### Hardware documentation

RibbitFlip talks to a device nobody published a datasheet for. What it is made of was
worked out by other people, with a soldering iron and a microscope, and shared openly:

- **[`Piwencjusz/zabka-triki-hardware`](https://github.com/Piwencjusz/zabka-triki-hardware)**
  — PCB photos, the SWD pad pinout, an external-flash dump, and the identification of
  the main MCU (Nordic **nRF52810**), the motion sensor (**ST LSM6DSL**) and the
  external NOR flash (**Macronix MX25R8035F**).
- **[`moe-takasaki`'s fork](https://github.com/moe-takasaki/zabka-triki-hardware)** (tsuki)
  — the deeper dive: J-Link probing, an nRF pinout reconstruction, and the finding that
  the over-the-air firmware images are **encrypted** (entropy ≈ 7.996 bits/byte, no
  Cortex-M vector table) on top of the device's APPROTECT lock. A negative result, and a
  genuinely useful one: it says plainly that no amount of effort will turn the vendor
  firmware into a command reference.
- **[`AND-Y0`](https://github.com/AND-Y0)** — the BLE protocol description in that fork,
  arrived at independently of the sources above.

Knowing the sensor is an LSM6DSL is not trivia. It fixes the accelerometer full-scale
range at ±16 g (0.488 mg/LSB ⇒ the ~2048 LSB/g this code assumes), and it puts the
plausible output data rates on the 52 / 104 / 208 / 416 Hz ladder that the start-frame
hypothesis above rests on.

Nothing from those repositories is copied into this project; they carry no license, and
none is needed to credit a fact about a physical device.

### The controller artwork — Gamepad Viewer

The picture of the pad in the cheat sheet and in the overlays is **not** ours. The
SVGs under [`web/assets/gamepad/`](../web/assets/gamepad/) come from
**[Gamepad Viewer](https://github.com/e7d/gamepad-viewer)** by **Michaël "e7d" Ferrand**
(© 2017-2020, MIT — text in
[`third_party_licenses/gamepad-viewer-LICENSE.txt`](../third_party_licenses/gamepad-viewer-LICENSE.txt)),
taken from **two** of its folders: `templates/xbox-one/` for the Xbox 360 controller and
`templates/ds4/` (into [`web/assets/gamepad/ds4/`](../web/assets/gamepad/ds4/)) for the
DualShock 4. e7d in turn credits **mrmcpowned**, whose originals for
**[gamepadviewer.com](https://gamepadviewer.com)** that skin is reworked from, so the
thanks are owed to both, and the artwork is the reason this app can show you what it is
pressing at all.

**The third controller is not theirs and not anyone else's.** The Wii drawing in
[`web/assets/gamepad/wii/`](../web/assets/gamepad/wii/) — a Wii Remote, a Nunchuk and a
small strip for what the DSU protocol carries beyond them — was drawn for this project
by [`tools/wii_art.py`](../tools/wii_art.py), from primitives — a white shell, as a Wii
Remote is, with its accents in the app's own espresso palette.
Gamepad Viewer has no Wii template and none was found under a licence this app could
carry. Until 2026-08-25 the Wii kind borrowed the DualShock body, on the argument that
DSU describes a DualShock-shaped device: true of the wire, and false of the picture —
you picked "Wii" and were shown a DualShock. Three kinds now mean three drawings, and
this one carries no third-party rights at all.

Both halves of it are **proportioned from outlines the owner supplied** — the Nunchuk
from the day it appeared, the remote since 2026-08-25, when what had been drawn by eye
was measured against one. What was taken from those outlines is measurements: where a
button sits and how big it is, which is the shape of the hardware itself. Not one path
from either of them is in the output — every shape in `wii/` is a circle, a rounded
rectangle or a curve this project's own generator emits.

What is ours besides that: the CSS that composes the parts
([`web/css/14b-gamepad.css`](../web/css/14b-gamepad.css) — with the geometry ported from
upstream's `template.css`, which is what makes the pieces land on the drawing), and the
widget that lights them from RibbitFlip's own live stream
([`web/js/rf-42-padview.js`](../web/js/rf-42-padview.js)). None of upstream's JavaScript
is used: Gamepad Viewer reads the browser's Gamepad API, while this reads what the app
has decided to press — which is why the drawing still works with every output disarmed,
and can say in red that nothing actually left the app.

**Two modifications, both on purpose and both reproducible** — they are applied by
[`tools/gamepad_art.py`](../tools/gamepad_art.py) rather than by hand, so anyone can
re-derive them from a fresh upstream download and read every substitution the script
prints. First, the two `base-*.svg` had the console maker's **logo** drawn on the Guide
button (one `<path>` each); both were deleted. An MIT licence covers copyright, not
somebody's trademark, and this app is endorsed by nobody. Second, the **palette** was
moved onto this app's: upstream's glossy black body became a warm espresso ramp, the
"button is down" overlays became the app's amber, and A/B/X/Y kept their colour coding
in the app's own data palette. **Not one shape, path or coordinate was touched** — the
drawing is still entirely e7d's and mrmcpowned's work, wearing different paint. The
DualShock skin gets the same two treatments (its maker's mark is the PlayStation logo on
the PS button, drawn as two `<path>`s; both deleted), plus its own map for the ✕ ○ □ △
glyph colours. Details in
[`web/assets/gamepad/README.md`](../web/assets/gamepad/README.md).

### The frog — made here, with a machine in the loop

The punk frog is this project's own: the logo
([`docs/assets/logo-ribbitflip.png`](assets/logo-ribbitflip.png)), the mascot, the head and
the wordmark, plus the felt-and-stitch look the whole app is built on. It was **composed
here**, and generative tools were part of the chain — Adobe Photoshop's generative features
and Google Gemini. Which of the two produced which pass is no longer recorded, and this file
does not pretend otherwise; the point of saying it at all is that the standard set at the top
of this document ("credit should be specific enough to be checked") does not stop being true
when the contributor is a machine. Both tools' terms permit commercial use of what they
produce, so nothing here is used beyond what was granted.

**The honest consequence, stated rather than skirted:** material produced purely by a model
has no human author, and the prevailing reading in the EU is that such material is no work at
all — in the United States the Copyright Office says the same about registration. So this
project does **not** stamp "all rights reserved" on those pixels, because it may well hold no
copyright in the generated parts, and claiming a right one does not have is a poor way to run
an open repository.

What is asked instead is narrower and does not depend on authorship at all. The name
**RibbitFlip** and the marks built from this artwork identify *this* release. They are **not
covered by the MIT licence** in [`LICENSE`](../LICENSE), which covers the code. Fork the code
freely — under your own name and your own artwork, so that nobody mistakes your build for
this one. That request is about telling releases apart, which is what a mark is for, and it
holds whoever or whatever held the pen.

### Screams in RibbitBeat: recordings from OpenGameArt

The **Scream** instrument in RibbitBeat plays eight real recordings of a male scream from the pack
[“Aargh! (male screams)”](https://opengameart.org/content/aargh-male-screams) (pack by congusbongus). They come from three people
and **were modified by us**: trimmed, reduced to 32 kHz mono, loudness-matched, with one section looped so the scream lasts as long
as you hold the note, and pitch-shifted up or down to the note.

- **Helmut Scream**: [creativeheroes](http://freesound.org/people/creativeheroes/sounds/84353/), licence
  [CC BY 3.0](http://creativecommons.org/licenses/by/3.0/) (`aargh0`).
- **Male_Thijs_loud_scream**: [thanvannispen](http://freesound.org/people/thanvannispen/sounds/9432/), licence
  [CC BY 3.0](http://creativecommons.org/licenses/by/3.0/) (`aargh1`, `aargh2`).
- **human male scream multi**: [JohnsonBrandEditing](http://freesound.org/people/JohnsonBrandEditing/sounds/173944/), licence
  [CC0 1.0](http://creativecommons.org/publicdomain/zero/1.0/) (`aargh3` to `aargh7`).

Processing script: `tools/ribbitbeat_krzyk_probki.py`; file notes: `web/assets/krzyk/ZRODLA.md`.

### Orchestral instruments in RibbitBeat: recordings from VSCO 2 Community Edition

Trumpet, Flute, Strings, Cello, Piano, Organ, Oboe, Clarinet, Trombone and Tuba in RibbitBeat play real recordings from
[VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE), the open orchestral library by Versilian Studios (Sam Gossner)
released under [CC0 1.0](http://creativecommons.org/publicdomain/zero/1.0/). CC0 asks for no credit, but thanks are due: without
this work the game's instruments would have stayed on oscillators. The recordings **were modified by us**: about one second of each
is kept (the attack and one looped section), mono 22 kHz, loudness-matched, and in the game the pitch follows the player's note.
Processing script: `tools/ribbitbeat_probki_instrumentow.py`; file notes: `web/assets/<instrument>/ZRODLA.md`.

### Open-source dependencies

See [`third_party_licenses/README.md`](../third_party_licenses/README.md) for **bleak**, **pynput**,
**vgamepad** (and the **ViGEmBus** project it wraps), **pystray** (the tray icon, LGPL-3.0),
**Pillow** (renders the tray icon image, HPND / MIT-CMU-style licence), and **PyInstaller** — each
with its license and any bundling notes.

The built-in melodies of the RibbitBeat game (`web/gry/js/piosenki.js`) are public-domain works
written out here in text notation. Three from the “Skoczne” (lively) pack (S. Joplin's The
Entertainer, E. Grieg's In the Hall of the Mountain King, the trio of J. P. Sousa's The Stars and
Stripes Forever) were transcribed from **Mutopia Project** MIDI files (mutopiaproject.org), marked
there as Public Domain. Thank you to the Mutopia volunteers for engraving music anyone can use.

### Standards

- **Nordic Semiconductor** — the Nordic UART Service (NUS) UUIDs used for BLE
  communication are part of Nordic Semiconductor's publicly published nRF SDK /
  Bluetooth interoperability documentation.
- **Web Audio API (W3C)** — the in-browser "Pad XY" sound library / synth
  (oscillators, biquad filters, ADSR envelopes, convolution reverb from a
  generated impulse, `WaveShaper` soft-clip drive) is built directly on the
  standard [Web Audio API](https://www.w3.org/TR/webaudio/). It is an original,
  hand-written subtractive-synthesis engine — no third-party audio library or
  borrowed DSP code is used. Fonts rendered in that UI are credited under
  [`third_party_licenses/README.md`](../third_party_licenses/README.md) (SIL OFL 1.1).

---

*RibbitFlip is an unofficial hobby project and is not affiliated with, endorsed
by, or connected to Żabka or any other company. See the disclaimer in the
[README](../README.en.md).*
