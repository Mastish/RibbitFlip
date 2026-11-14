# Co potrafi RibbitFlip

← [README](../../README.md) · [English](../en/features.md)

## Moduły

Panel ma **dziewięć modułów**. Każdy ma własny przełącznik i kropkę w nawigacji, która pokazuje,
czy jest włączony. Możesz używać jednego albo kilku naraz.

| Moduł | Co robi | Czego wymaga |
|---|---|---|
| **Mapowanie** | Przechylenie, obrót albo kliknięcie kapsla naciska klawisz, klika myszą albo wciska przycisk pada. | ViGEmBus dla przycisków pada |
| **Koło wyboru** | Na ekranie pojawia się koło z maksymalnie 16 akcjami, a Ty wybierasz jedną ruchem kapsla. | – |
| **Mysz** | Kapsel prowadzi kursor myszy, a kliknięcie może zrobić się samo, gdy zatrzymasz kursor. | – |
| **Skaner** | Cały komputer obsłużysz jednym sygnałem: pasek jedzie przez ekran, a Ty go zatrzymujesz tam, gdzie ma kliknąć. | przeglądarka Edge, Chrome, Brave albo Vivaldi dla okna nad pulpitem |
| **Kontroler** | Kapsel udaje pad do gier: Xbox 360, DualShock 4 albo Wii. | ViGEmBus dla Xbox 360 i DualShock 4 |
| **MIDI** | Ruch kapsla steruje programem muzycznym: głośnością, filtrem albo nutami. | loopMIDI, żeby połączyć się z programem muzycznym |
| **OSC** | Wysyła ruch kapsla do programów od wizualizacji, świateł i sceny, np. TouchDesigner, Resolume, VRChat. | – |
| **Usługi** | Ruch kapsla wysyła polecenie do innej aplikacji albo urządzenia w sieci: Discorda, Home Assistanta, OBS Studio… | – |
| **Synth** | Kapsel gra dźwięki w przeglądarce jak instrument, każdy kapsel własnym głosem. | – (dźwięk nie opuszcza przeglądarki) |

MIDI i OSC to dwa popularne „języki", którymi porozumiewają się programy: MIDI to standard
instrumentów i programów muzycznych, a OSC to standard programów od obrazu, świateł i sceny.

Oprócz modułów panel ma ekrany **Zestawy** (gotowe i zapisane komplety ustawień), **Ustawienia**
(ustawienia całej aplikacji), **Nakładka** (małe okienka widoczne nad grą), **Czujnik** (podgląd
tego, co mierzy kapsel) i **Połączenie** (stan połączenia i bateria kapsla). Po prawej stronie panelu wybierasz
kapsel i oglądasz jego ruch na żywo.

W nawigacji **Synth** stoi w osobnej grupie **Wypróbuj**, razem z grą **RibbitBeat**, między modułami
a resztą ekranów. To najszybszy sposób, żeby zobaczyć i usłyszeć kapsel w akcji bez żadnej
konfiguracji. Synth zostaje przy tym instrumentem, który łączy się z resztą (mapowanie, pady
efektów), a RibbitBeat to gra rytmiczna dla kilku osób: kapsel, pad albo mysz i tablica wyników.

Każdy moduł ma te same trzy zakładki:

| Zakładka | Co w niej jest |
|---|---|
| **Konfiguracja** | Ustawienia modułu dla wybranego kapsla. Na górze jedno zdanie o tym, co ten kapsel ma ustawione i czy jest to zapisane. |
| **Biblioteka** | Twoje zapisane ustawienia modułu. Możesz je wczytać, opisać, przenieść na inny kapsel albo komuś wysłać. |
| **Informacje** | Poradnik modułu z rysunkami. |

**Nakładka** ma zakładki Nakładka · Ściąga · Informacje, a **Synth** dokłada **Brzmienia** między
Konfiguracją a Biblioteką.

**Trzy piętra ustawień.** Na wierzchu ekranu stoi to, czego używasz na co dzień, i jedna różowa
akcja główna. To, co ustawiasz raz, siedzi w zwijakach: zwinięty pokazuje w nagłówku obecne
wartości i liczbę zmian („zmienione: 3”), a w środku ma **Przywróć domyślne** z możliwością
cofnięcia. Rzadkie ustawienia są w jednym zwijaku **Zaawansowane** na dole ekranu. Kto woli widzieć
wszystko od razu, włącza **Rozwijaj wszystkie ustawienia** na ekranie **Ustawienia**, w karcie
„Wygląd panelu”.

**Jak działa zapisywanie:** zmiany w ustawieniach wybranego kapsla działają i zapisują się
w aplikacji od razu; do **Biblioteki** trafiają dopiero po „Zapisz zmiany". Bursztynowa kropka przy
module oznacza, że masz zmiany, których jeszcze nie ma w Bibliotece. Sam kapsel niczego nie
przechowuje: ustawienia każdego kapsla trzyma aplikacja na Twoim komputerze.

Wspólne dla wszystkich modułów:

- **Kilka kapsli naraz**, każdy z własnymi ustawieniami i kolorem.
- **Wymiana zestawów.** Zestaw wczytasz z pliku albo z odnośnika do posta na Discordzie (w ciągu
  25 s możesz to cofnąć). Kreator pomoże napisać post z Twoim zestawem. Zestaw może też wczytywać
  się sam, gdy przełączysz się na wskazaną grę.
- **Zestaw to kaseta.** Przyciskiem z kasetą obok **Zapisz zestaw** wybierasz jedną z ośmiu filcowych kaset;
  jedzie razem z plikiem, więc zestaw wygląda tak samo u każdego, kto go wczyta. Podgląd zestawu
  pokazuje kasetę, opis od twórcy i to, co zestaw robi, reguła po regule. Kliknięcie w kasetę
  własnego zestawu zmienia ją bez ponownego zapisywania.
- **Nakładki nad grą**: ściąga z Twoimi ustawieniami, koło wyboru i podgląd kapsla.
- **Powiadomienia Windows**, gdy zadziała wybrana reguła. Widać je, nawet gdy panel jest schowany
  za grą.
- **Odłożony kapsel przestaje sterować.** Gdy kapsel przez ustawiony czas się nie rusza, aplikacja wstrzymuje
  jego działanie, a ruch je przywraca.
- **Strojenie czułości**: wygładzanie ruchu, punkt zerowy, martwa strefa (mały ruch, który nic nie
  robi), zakres i krzywa.
- **Symulacja** z kapslem prowadzonym ręcznie myszą. Reguły reagują tak samo jak na prawdziwy
  kapsel.
- **Mniej naraz.** Przy pierwszym uruchomieniu panel pyta, do czego chcesz używać RibbitFlipa
  (granie, pomoc komuś w sterowaniu komputerem, muzyka i streaming albo wszystko). Moduły spoza
  wyboru stoją pod **Więcej modułów (N)** na dole listy modułów i dalej działają. Wybór zmienisz
  okiem nad nawigacją albo w **Ustawieniach** („Wybierz ponownie” w karcie „Wygląd panelu”). Żeby
  moduł w ogóle nie wstawał, uruchom aplikację z `--disable` (niżej).
- **Interfejs po polsku i po angielsku** oraz poradnik z rysunkami w zakładce **Informacje** każdego
  ekranu.
- **Przewodnik i pomoc** w pasku górnym: **Przewodnik** pokazuje panel krok po kroku, a **Pomoc
  i społeczność** ma odnośniki do strony projektu i serwera Discord.

`Ctrl`+`B` zwija lewą kolumnę panelu, `Ctrl`+`\` prawą.

## Słabszy komputer: uruchom tylko potrzebne moduły

Moduły, których nie potrzebujesz, możesz wyłączyć przy starcie aplikacji. Taki moduł nie wstaje
przez całe to uruchomienie: nie ma zakładki ani karty w panelu, nie liczy niczego w tle, nie
otwiera portów i nie zakłada skrótów klawiatury. To coś innego niż przełącznik **Wył./Wł.** w module
i chowanie zakładki: tamte zostawiają moduł gotowy do pracy, ten parametr zabiera go całkiem, aż do
następnego uruchomienia bez niego.

**Najprościej, w panelu:** na ekranie **Ustawienia** jest zwijak **Start programu** z przełącznikiem
przy każdym module. Wyłącz to, czego nie potrzebujesz, i kliknij **Uruchom
ponownie**. Wybór zapisuje się od razu w `Settings\ribbitflip_modules.json` i działa przy każdym
następnym starcie, także z menu Start i z autostartu, bez skrótu z parametrem. Zwijak pokazuje też
zależności: wyłączona Nakładka wyłącza razem z sobą Koło wyboru. Parametr startu i zmienna opisane
niżej mają pierwszeństwo przed tym wyborem. Gdy aplikację uruchomiono z którymś z nich, zwijak mówi
to wprost, a wybór czeka zapisany na start bez parametru.

| Nazwa | Moduł | Co oszczędza | Wymaga |
|---|---|---|---|
| `kolo` | Koło wyboru | pętlę koła na każdy kapsel i okno koła przy kursorze | `nakladka` |
| `mysz` | Mysz | pętlę ruchu na każdy kapsel (gdy wyłączysz też `kontroler`) | – |
| `kontroler` | Kontroler | pętlę ruchu (razem z `mysz`), wirtualne pady i serwer ruchu dla emulatorów | – |
| `skaner` | Skaner | dwa skróty klawiatury i okno nad pulpitem | – |
| `midi` | MIDI | port MIDI | – |
| `osc` | OSC | gniazdo sieciowe OSC | – |
| `uslugi` | Usługi | wysyłanie do usług i połączenie z OBS Studio | – |
| `synth` | Synth | dźwięk i rysowanie Syntha w panelu | – |
| `gra` | RibbitBeat | link do gry i jej strony | – |
| `nakladka` | Nakładka | okna nad grą | – |
| `autozestawy` | Auto-zestawy wg gry | sprawdzanie co sekundę, która gra jest na wierzchu | – |
| `mcp` | Serwer MCP | asystenta AI (to samo co `--no-mcp`) | – |

Zawsze działają, bo bez nich aplikacja nie ma sensu: **Mapowanie**, **Czujnik**, **Połączenie**,
**Przegląd wszystkich kapsli**, **Zestawy** i **Ustawienia** razem ze stopem awaryjnym.

Zależności:

- **Koło wyboru wymaga Nakładki**, bo koło pokazuje się w oknie nakładki (przy kursorze, na środku
  ekranu albo w nakładkach nad grą). `--disable nakladka` wyłącza też koło, a `--only kolo` sam
  dokłada Nakładkę. Aplikacja mówi o tym jednym zdaniem w konsoli.
- **Mysz i Kontroler** mają wspólny silnik ruchu. Wyłączenie jednego zabiera tylko jego tryby
  (kursor albo drążek i krzyżak), a silnik staje, dopiero gdy wyłączysz oba.
- **MIDI i OSC** mają wspólne ustawienia ruchu na kanały. Każde z nich możesz wyłączyć osobno.

Ustawienia wyłączonego modułu nie giną. Reguła z przyciskiem pada (przy wyłączonym Kontrolerze)
albo z sygnałem skanera (przy wyłączonym Skanerze) zostaje na liście **Mapowania** z plakietką
„moduł wyłączony przy starcie”, a edytor nie proponuje takich akcji do nowych reguł. Podgląd
zestawu przed wczytaniem pokazuje, które jego części dotyczą wyłączonych modułów: wczytają się
i zapiszą, ale zadziałają dopiero po uruchomieniu aplikacji bez parametru.

Jak to wpisać:

- `--disable kolo,skaner,midi` wyłącza wymienione moduły, a resztę zostawia,
- `--only mysz` zostawia tylko wymienione moduły (i to, czego wymagają) oraz moduły podstawowe,
- `--list-modules` pokazuje tę listę z nazwami po angielsku i kończy pracę.

Nazwy możesz pisać z polskimi znakami albo bez, wielkimi albo małymi literami, a także po
angielsku (`wheel`, `scanner`, `controller`, `services`, `overlay`, `game`, `autosets`). Nieznana
nazwa albo `--disable` razem z `--only` zatrzymuje start z komunikatem i listą poprawnych nazw.

Przykłady dla słabszego komputera:

```bash
RibbitFlip.exe --disable kolo,nakladka,skaner,synth,gra
```

Kapsel tylko naciska klawisze (Mapowanie) i prowadzi kursor (Mysz):

```bash
RibbitFlip.exe --only mysz
```

Kapsel jako kontroler muzyczny, bez całej reszty:

```bash
RibbitFlip.exe --only midi,osc
```

**Na stałe, ze skrótu:** kliknij prawym przyciskiem `RibbitFlip.exe`, wybierz „Utwórz skrót", potem
we właściwościach skrótu dopisz parametr w polu **Element docelowy** za cudzysłowem, np.
`"C:\RibbitFlip\RibbitFlip.exe" --disable kolo,skaner`. Zamiast parametru możesz też ustawić zmienną
środowiskową `RIBBITFLIP_DISABLE` albo `RIBBITFLIP_ONLY` z tą samą listą. Liczy się jedno źródło
naraz, w tej kolejności: parametr w wierszu poleceń, potem zmienna, na końcu wybór z panelu.

Co wyłączono, widać w panelu na ekranie **Ustawienia**: zwinięty **Start programu** mówi w nagłówku,
ile modułów jest wyłączonych. Przełączenie między **Live** a **Symulacją** zachowuje tę listę, a „Uruchamiaj przy
starcie Windows" w menu ikony przy zegarze zapamiętuje ją, jeśli włączysz to w takim uruchomieniu. Wersja **RibbitFlip
Essential** po prostu nie ma Syntha ani gry, więc tam tych dwóch nie trzeba wyłączać.

## Szczegóły funkcji

- **Warstwy.** Warstwa to osobny komplet reguł, między którymi się przełączasz, jak między
  zakładkami. W edytorze reguły wybierasz **Warstwę**: „Zawsze" albo jedną z czterech. Zmienia ją
  pasek „Warstwa: 1 2 3 4" albo sam kapsel: `layer:2`, `layer:next`, `layer:hold:2` (jak Shift).
- **Makra.** Makro to kilka akcji wykonanych po kolei jedną regułą.
- **Gotowe gesty.** Lista **„Gotowy gest"** w edytorze reguły sama wypełnia warunek, próg i czasy:
  potrząśnięcie, kapsel dnem do góry, szybki obrót w prawo i w lewo, dwuklik, długie
  przytrzymanie. Miara **„Wirowanie (|żyro|)"** liczy, jak mocno kapsel się rusza we wszystkich
  kierunkach, więc potrząśnięcie znaczy to samo niezależnie od tego, jak go trzymasz.
- **Nowa reguła** zaczyna się od kafli „Co ma zrobić kapsel?”: pochylenie w cztery strony, obrót
  albo kliknięcie przycisku. Pod kaflami są dwa inne wejścia: **Nagraj własny gest** i **Ustaw
  ręcznie**. W edytorze na wierzchu stoją nazwa i akcja, warunek i trzy podstawowe zachowania są
  w zwijaku **Warunek i zachowanie**, a dodatkowe warunki, rzadsze zachowania i sygnały
  w **Zaawansowane**.
- **Nagrany gest.** Powtarzasz gest dwa, trzy razy, suwakiem ustawiasz dokładność i wskazujesz
  akcję; wykres „Ruch kapsla na żywo” pokazuje, gdzie gest się zaczyna i kończy. W trybie
  zaawansowanym nagrany gest jest warunkiem, który łączysz z innymi.
- **Koło wyboru.** Pięć sposobów sterowania: *Trzymaj przycisk i puść*, *Pochyl i przytrzymaj*
  (bez przycisku), *Pochyl i kliknij*, *Kliknij, pochyl, kliknij* oraz *Przełączaj kliknięciami*,
  gdzie wszystko robi jeden przycisk, a wyzwalaczem (tym, co uruchamia regułę) może być samo
  pochylenie. **Gdzie pokazywać koło**: przy kursorze, w nakładkach, w obu albo na środku ekranu.
  Wygląd, sterowanie i miejsce koła to zwijaki z podsumowaniem, a strojenie sterowania, kształt
  podmenu i import pliku są w **Zaawansowane**. Gotowe koła wracają przyciskiem **Przywróć
  fabryczne** w Bibliotece, a podgląd w karcie obsłużysz strzałkami i Enterem.
- **Skaner ekranu.** Cztery sposoby wskazywania (paski, pola, elementy, radar), menu akcji (klik,
  dwuklik, prawy, przeciągnij, kopiuj, wklej, usuń, klawiatura ekranowa) i dopasowanie do tego,
  jak szybko reagujesz. Sygnał wybierasz osobno dla zatrzymania paska, cofnięcia o krok
  i przerwania. **Plansze** to zrzuty ekranu gry, po których skaner prowadzi pasek: skrót `Alt`+`R`
  i cyfra robi zrzut całego ekranu prosto do planszy 1–9 (włączasz go w zwijaku „Zrzut planszy
  skrótem” w **Zaawansowane**), a „Po zrzucie” wybiera, co dalej: edytor obszaru nad pulpitem
  (domyślnie), panel z tą planszą albo nic. Na wierzchu karty stoją podgląd, **SYGNAŁ** i różowe
  **Uruchom nad pulpitem**; plansze, trening i rzadkie pokrętła są w **Zaawansowane**. Zrzut możesz też wczytać z pliku, upuścić albo wkleić `Ctrl`+`V`
  i zaznaczyć na nim obszar myszą. Edytor nad pulpitem ma okno „⚙ Ustawienia" ze wszystkimi
  ustawieniami i sześcioma gotowymi zestawami, zakładkę „Wyzwalacze" oraz „🎯 Sygnał": próbę,
  w której pasek przejeżdża po prawdziwym ekranie i zaznacza, gdzie by kliknął, ale nie klika.
  Kończy ją „■ Koniec próby".
- **Nakładki.** Każdy kapsel może mieć kilka nazwanych okienek. Ekran **Nakładka** ustawia jedno
  naraz: na wierzchu podgląd, który jest prawdziwą nakładką, i zawartość okna, w zwijakach „Miejsce
  i wielkość” oraz „Wygląd tego okna”, a w **Zaawansowane** kafelki okienek, gotowce (*tylko
  kontroler*, *tylko koło wyboru*, *tylko wyzwalacze*, *tylko orientacja*) i nazwa. Wysokość
  okienko dopasowuje do treści, a układy okienek zapisujesz w **Bibliotece**.
- **Przód kapsla.** Kapsel jest okrągły, więc nie widać, gdzie ma przód, a od tego zależy, w którą
  stronę działa pochylenie „do przodu". Element nakładki *przód kapsla* pokazuje go jako kroplę:
  trzymasz kapsel pionowo jak kierownicę (przyciskiem do siebie) albo kładziesz go płasko, a kropla
  faluje, gdy kierunek jest zły, i uspokaja się, zielenieje, a po chwili przygasa, gdy kapsel mierzy
  w przód. Przód może być fabryczny albo Twój: w edytorze okienka **Pochyl do przodu** albo
  **Kierownica** ustawia go tam, gdzie chcesz (np. przy logo), osobno dla każdego kapsla. Ta sama
  kropla stoi w prawej kolumnie, w zwijaku **Przód kapsla** pod podglądem na żywo: rozwinięty ma te
  same ustawienia (przód, czułość, próg, stopnie, wycinek, przygaszanie) i przycisk **Pokaż
  w nakładce**. Ustawienia
  należą do kapsla, więc zmiana w panelu od razu zmienia nakładkę. **Świeć LED, gdy kapsel mierzy
  w przód** zapala diodę samego kapsla, więc przód znajdziesz bez patrzenia na ekran (działa też
  przy zamkniętym panelu).
- **Wygląd nakładek.** *Jasny*, *Ciemny* albo *Sama treść* (domyślny). Kliknięcia mogą przechodzić
  przez nakładkę do gry, pinezka trzyma okienko na wierzchu, a pasek okienka da się wyłączyć
  i ustawiać położenie suwakami X/Y. Nakładki otwierają się w przeglądarce Edge, Chrome, Brave albo
  Vivaldi. Gra w trybie pełnoekranowym wyłącznym zasłania każdą nakładkę; przełącz ją na „okno bez
  ramki".
- **Kontroler Wii** nie potrzebuje sterownika, ale Windows go nie widzi, więc zwykła gra też nie.
  Odbierają go emulatory: Dolphin, Cemu, Citra, yuzu, Ryujinx, PPSSPP (protokołem DSU). Jako
  jedyny przekazuje grze prawdziwy ruch kapsla. **DualShock 4** ma pole „żyroskop" (czyta je Steam
  Input i Cemu), klik touchpada `pad:touchpad`, a pochylenie kapsla może prowadzić palec po
  touchpadzie. Kilka kapsli może tworzyć jeden pad, a kapsel może działać jak gałka albo krzyżak.
- **Strojenie ruchu i kursora.** Wygładzanie, punkt zerowy, martwa strefa, zakres i krzywa dla
  każdej osi ruchu, z wykresami na żywo. Dla kursora: krzywa, dwustrefowe przyspieszenie,
  stabilizacja, samoczynne zerowanie i kalibracja.
- **Obszar kursora i wskazywanie.** Kapsel prowadzi kursor po całym ekranie, po wybranym
  monitorze, po tym, na którym stoi kursor, albo po własnym prostokącie. W trybie **Położenie**
  wychylenie mówi, gdzie kursor jest, a nie jak szybko jedzie.
- **Klik bez klikania.** **Czas zatrzymania** 0,15–5 s, **Promień spokoju** 2–60 px, **Rodzaj
  kliknięcia** (lewy, prawy, środkowy, podwójny). Klika raz i czeka na ruch. Startuje wyłączony.
- **Wstrzymanie odłożonego kapsla** na ekranie **Połączenie**, zwijak „Oszczędzanie baterii”:
  przełącznik „Wstrzymuj wyjścia przy bezczynności" i suwak „Po czasie" od 5 s do 10 min.
  Zatrzymuje działania kapsla, ale kapsel dalej nadaje, więc baterii nie oszczędza.
- **Zestawy wczytywane wg gry.** Pole „gra.exe” w zwijaku „Gra i opis” pod paskiem zapisu zestawu;
  pary widzisz w zwijaku „Auto-zestawy wg gry”. Automatyczne wczytanie nigdy niczego nie włącza.
- **MIDI.** Suwaki i pokrętła programu muzycznego (komunikaty CC, także 14-bitowe), nuty w skalach,
  pitch bend, aftertouch, program change, 18 krzywych i przycisk „panic", który ucisza wszystkie
  nuty. Nic nie trzeba doinstalowywać poza loopMIDI.
- **OSC.** RibbitFlip
  wysyła liczby (float, int) i wartości tak/nie (bool) do nazwanych urządzeń, każde z własnym
  adresem. Są profile popularnych odbiorników, a po przekroczeniu progu może pójść impuls, bramka
  albo przełącznik.
- **Synth.** Pole XY w przeglądarce: każdy kapsel ma własny kursor i głos, 35 dźwięków, sceny,
  dowolnie wiele pól, pola efektów, bramki, portamento, echo, wibrato z obrotu, rozpęd. Pady
  zaprogramowane same grają linię melodyczną albo rytm narysowany na siatce nut, a na każdej granej
  nucie śpiewa żaba; wszystkie grają we wspólnym tempie, więc się nie rozjeżdżają. Układ pól zapisujesz jako scenę, a dźwięki stroisz w zakładce **Brzmienia**.
  Tam lampa oscyloskopu pokazuje brzmienie na żywo, a pod pokrętłami rysujesz własną falę, ustawiasz
  korektor do czterech pasm na żywym widmie i zginasz odcinki obwiedni; „Zaskocz mnie" losuje całe
  brzmienie, a kostka na karcie modułu tylko ten moduł.
- **RibbitBeat.** Przycisk „RibbitBeat” pod Synthem, w grupie **Wypróbuj** w nawigacji, otwiera grę w nowej karcie: śpiewasz nuty piosenki z MIDI kapslem, gałką pada albo myszą. Gra zaczyna się od menu z naklejką żaby i dwoma przyciskami: **Zagraj** i **Utwory**. W **Utworach** jest cała biblioteka (zakładki Wszystkie, Wbudowane, Moje, Paczki, sortowanie alfabetyczne, ostatnio grane, najnowsze albo ulubione, serduszko przypina ulubiony utwór), karteczka „Jak dodać utwór” (z dysku, przeciągnięciem, z adresu, Ctrl+V albo z paczki) i „Autorzy i licencje”; na karcie utworu jego tablica wyników i plakietka licencji. Tablica rozpoznaje plik MIDI po zawartości (odcisk SHA-256), więc ten sam plik pod inną nazwą ma te same wyniki. **Zagraj** ma dwa kroki: 1 Piosenka (podgląd partii, przy więcej niż trzech partiach z rozwijaną listą do ich wyboru, trudność od 1 do 10, trzy najlepsze wyniki) i 2 Rozgrywka: skład graczy ustawiasz ręcznie (mysz, klawiatura W/S albo strzałki, pad, bot jednego z czterech poziomów, kapsel), każdy ma imię, kolor i miejsce na liście **Skład** (do 8 graczy), a cały skład zapamiętuje się do następnej gry; ustawienia są pogrupowane i opisane (Poziom gry, Trudność, Pomoce, Sterowanie, Ekran i tory, Dźwięk, Grafika) i wybierasz je kafelkami z obrazkami. Na górze stoją gotowe zestawy **Na luzie**, **Normalny**, **Wyzwanie** i **Mistrz**, a każda Twoja zmiana zapamiętuje się jako **Własne**. Tempo, czas na ruch przy dalekich skokach i każda pomoc (przyciąganie do nut od „Delikatnego” do „Z daleka”, żaba śpiewa sama, skok do nuty na klawiaturze, cicha podpowiedź melodii) pokazują mnożnik punktów: pomoc ułatwia grę, ale zmniejsza punkty mniej więcej o tyle, ile dokłada, a procent i gwiazdki liczą się zawsze z samego śpiewu. Kapsel dołącza przyciskiem na każdym ekranie i od razu steruje menu przechyłem i naciśnięciem (przytrzymanie cofa), a w kroku 2 zmienia swoją partię i instrument. W grze nuta wypełnia się kolorem celności, przy żabie lecą punkty, kombo i ogień rosną; przycisk w pauzie to rechot na wysokości przechyłu, dla zabawy, bez punktów i bez kary. Naciśnięcie dokładnie na początku nuty i puszczenie dokładnie na jej końcu (do 100 ms) daje „w punkt”: dużą premię rosnącą z serią, stempel i licznik w HUD; suwak „Czas na ruch” (0–150 %) zmienia luz na dalekie skoki i mnożnik punktów. Esc zatrzymuje piosenkę: w pauzie wracasz do gry (po odliczaniu 3, 2, 1), zaczynasz ją od nowa (R) albo wychodzisz (Q). Wibrato na długich nutach robisz każdym sterowaniem: myszą w lewo i w prawo, klawiszami Q i E (albo . i /) na przemian, prawą gałką pada albo bujając kapslem na boki. Przycisk **Jak grać** w menu (i pierwsze Zagraj) puszcza samouczek w prawdziwej grze, a koniec piosenki ma jingiel i konfetti w stylu wybranego motywu. Wyniki rozbijają punkty na oceny nut, premie, klik w rytm i „w punkt”. Trzy paczki muzyki klasycznej z IMSLP (ok. 530 utworów na licencjach CC0, CC BY i CC BY-SA) pobierasz jednym kliknięciem prosto z Hugging Face, z pełną informacją o autorach i licencjach. Każdy gracz zbiera **Sławę** (za piosenki, kombo, nowe utwory, precyzję; pierwsza piosenka dnia liczy się podwójnie), a odblokowania idą dwiema warstwami: **Plansza** (tło, widownia i klawisze jako jeden z 30 motywów, od filcu przez 8-bit, Halloween, komiks, piratów, disco i wyspę tiki po kuchnię, szachy, voodoo, giełdę, muchomory, złoto, Olimp, rysunek kredkami, prawdziwy, fotograficzny staw i salę wykładową Einsteina) i **Efekt** odblokowuje cała ekipa razem, czyli wszyscy grający na tym komputerze; planszę wybiera się jedną dla całej gry, a efekt każdy wybiera sobie z odblokowanych: to głowa śpiewającej żaby przeprojektowana w stylu motywu (w kosmosie astronauta, w Halloween mumia, w 8-bit pikselowy bohater starych platformówek, u piratów kapitan jak z filmu przygodowego) oraz ślad i iskry w kolorach motywu. Instrumentów jest 40 (od trąbki, chóru i pianina po saksofon, dudy, didgeridoo i śpiew operowy), każdy ma własną filcową ikonę i trzyma nutę tak długo, jak śpiewasz. Nowa ekipa śpiewa Ribbitem, a wszystko idzie jedną wspólną **drogą**: każdy wspólny poziom to jedno losowanie na poziomym kole nagród (najpierw kategoria, potem rzecz, od zwykłej do legendarnej i sekretnej; ostatnie losowanie daje dwie rzeczy; komplet po ok. 3–5 godzinach grania). Przy kilku graczach do wspólnej puli idzie średnia sława razy mnożnik (×1,25 za dwoje, ×1,4 za troje, ×1,5 od czterech), a koło rusza dopiero, gdy wszyscy przytrzymają swoje przyciski. W wynikach jest jeden pasek **Wspólny postęp** z następną nagrodą, a okno efektów ma sekcję **Wspólna droga**; niezdobyte rzeczy są tam zakryte kłódką. Skiny i sceny odblokowuje się osobno i po jednym, wyłącznie na kole (sława sama niczego nie otwiera): skin i scena tego samego motywu mają wspólną nazwę z rodzajem, np. „Sushi · skin” i „Sushi · scena”, a wylosowana scena zużywa losowanie jak instrument i skin (za darmo jest tylko sekretna karta). Pierwsze losowania przychodzą już w pierwszej piosence; w czwórkę ok. 80 % z 95 rzeczy jest po ok. 35 piosenkach, a komplet po ok. 65 (ok. 3 godziny), solo ok. 80 % po ok. 65 piosenkach, a komplet po ok. 4–5 godzinach; w wynikach widać, ile piosenek mniej więcej zostało do następnego losowania. 53 osiągnięcia dają sławę i skróty: osobno do skina albo do sceny, nigdy do obu naraz. W lobby nad kartami jest jeden pasek **Plansza** ze strzałkami, licznikiem sławy ekipy i oknem z podglądem na żywo, na karcie gracza jeden wiersz **Efekt** z oknem efektów i osiągnięć, a wyniki pokazują paski sławy gracza i planszy oraz awanse. Osiągnięcia (z licznikami postępu, np. „47 / 100”, i datą zdobycia) otwierasz też bez dołączania do składu: przyciskiem **Skin i osiągnięcia** w menu z plakietki „Grasz jako” albo w oknie **Profile** przy każdym profilu. Okno **Profile** zaznacza konto, którym grasz, a eksport mówi wprost, że tablica wyników, własne utwory i ulubione zostają w przeglądarce. Pad w bok na karuzeli piosenek zmienia piosenkę tak jak strzałki. Tło i efekty świetlne rysuje karta graficzna (WebGL2); bez niej gra zostaje przy klasycznej grafice. W menu jest odnośnik do serwera Discord, a na wynikach „Pochwal się na Discordzie” i „Kopiuj wynik”.
- **RibbitBeat jako osobny program.** Grę możesz pobrać też jako osobny plik `RibbitBeat.exe`: po uruchomieniu od razu otwiera się na pełnym ekranie, bez instalowania i bez aplikacji RibbitFlip. Grasz myszą, klawiaturą albo padem, a kapsle dołączają, gdy na tym samym komputerze działa też RibbitFlip. Pakiety utworów pobrane w aplikacji są od razu w grze i odwrotnie. Okno gry otwiera się w Edge albo Chrome; bez nich w domyślnej przeglądarce. Zamknięcie okna kończy grę.
- **Usługi.** 15 gotowych szablonów i 61 akcji, m.in. Discord, Slack, ntfy, n8n, Make.com, IFTTT, Home
  Assistant, Spotify, Philips Hue, WLED, Telegram, Twitch (z plakietką
  „niezweryfikowany"). Podstawianie wartości do treści (`{{var.x}}`), limity częstotliwości, dziennik
  wysyłek, w którym hasła są zamaskowane, i szyfrowany sejf na hasła. **OBS Studio**
  (8 akcji: scena, nagrywanie, powtórka, mikrofon) łączysz w zwijaku „OBS Studio” karty aplikacji.
- **Asystent AI (MCP).** MCP to sposób, w jaki asystent AI (np. czat z modelem językowym) może
  korzystać z programów na Twoim komputerze. [Serwer MCP](../MCP.md) ma trzynaście narzędzi
  i jest domyślnie wyłączony: włączasz go na ekranie **Ustawienia**, w **Zaawansowane**. Asystent ułoży zestaw,
  dobierze schemat do Twoich możliwości ruchowych, ustawi skaner ekranu i koło wyboru. Tryb
  bezpieczny odrzuca makra, systemowe kombinacje klawiszy i kliknięcia w punkt ekranu bez Twojej
  zgody, a modułów asystent sam nie włączy.
- **Zgłoś problem** w stopce przygotowuje paczkę z informacjami o błędzie (patrz
  [Społeczność](../../README.md#społeczność)). **Powiadomienia** idą z ikony w zasobniku, domyślnie wyłączone i bez
  dźwięku, najwyżej raz na 3 s.
- **Ikona w zasobniku** ma menu: otwórz panel · nakładki na wierzchu · uruchamiaj przy starcie
  Windows (domyślnie wyłączone) · otwórz folder aplikacji · zakończ.
