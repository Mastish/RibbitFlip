# Cel i zabezpieczenia: mapa kodu, który steruje komputerem

← [README](../../README.md) · [English](../en/purpose-and-safeguards.md) · [Bezpieczeństwo i prywatność](prywatnosc.md) · [`SECURITY.md`](../../.github/SECURITY.md)

RibbitFlip generuje naciśnięcia klawiszy, ruch i kliknięcia myszy, wirtualne pady, sygnały MIDI
i OSC, a na życzenie robi zrzut ekranu. Taki kod wygląda podejrzanie, gdy czyta się go bez
kontekstu, więc ta strona zbiera w jednym miejscu, **po co** jest każdy mechanizm, **kiedy**
działa, **czego nie robi** i **jak jest zabezpieczony**, z odnośnikiem do pliku i funkcji.
Każde zdanie opisuje to, co kod robi dziś. Te same informacje stoją w komentarzach przy kodzie.

## Do czego służy aplikacja

Żeby człowiek sterował **własnym** komputerem kontrolerem ruchu (kapslem Triki przez Bluetooth
LE): w grach, w programach muzycznych i w dostępności, gdy klawiatura i mysz są poza zasięgiem
(skanowanie ekranu jednym sygnałem, klik po zatrzymaniu kursora). Łańcuch jest zawsze ten sam:

**ruch kapsla → reguła, którą człowiek napisał albo wczytał → grupa wyjść, którą człowiek włączył → wejście w systemie.**

## Czego aplikacja nie robi

- **Nie podsłuchuje klawiatury.** Jedyny hak klawiatury (`PanicHotkey`) trzyma tylko zbiór
  klawiszy wciśniętych w tej chwili, żeby rozpoznać trzy skróty. Niczego nie zapisuje, nie loguje
  i nie wysyła. Haka myszy nie ma wcale.
- **Nie daje się sterować z sieci.** Każdy serwer słucha wyłącznie na `127.0.0.1` (panel HTTP,
  serwer ruchu DSU). Nie ma opcji zmiany adresu nasłuchu.
- **Nie ukrywa się.** Ikona w zasobniku (albo okno konsoli przy `--no-tray`), żadnego
  wstrzykiwania do innych procesów, żadnych plików z atrybutem ukrytym. Zamyka wyłącznie okna
  przeglądarki, które sama otworzyła dla nakładek i skanera.
- **Nie uruchamia się sama z Windows**, dopóki człowiek nie zaznaczy „Uruchamiaj przy starcie
  Windows” w menu ikony w zasobniku.
- **Nie wysyła danych.** Bez telemetrii, bez sprawdzania aktualizacji, bez kont. Ruch wychodzący
  powstaje tylko z działania człowieka (lista niżej).
- **Nie fotografuje ekranu sama.** Zrzut powstaje tylko z przycisku albo ze skrótu, który jest
  fabrycznie wyłączony. Obraz zostaje na dysku.
- **Nie wpisuje tekstu w imieniu asystenta AI.** Serwer MCP konfiguruje aplikację, ale nie ma
  narzędzia, które naciska klawisz, rusza myszą, robi zrzut albo czyta ekran. Uzbroić aplikację
  może tylko wtedy, gdy człowiek sam na to pozwoli w panelu.

## Mapa mechanizmów

### Wyjścia do systemu

| Mechanizm | Cel | Kiedy działa | Zabezpieczenia | Kod |
| --- | --- | --- | --- | --- |
| Klawiatura i mysz | klawisze, kombinacje, kliknięcia, przewijanie, klik w punkcie ekranu | na końcu łańcucha ruch → reguła → włączona grupa; przycisk Test w panelu | brak emitera przy `--no-keys`; bramka `armed` + włącznik grupy; stop awaryjny puszcza wszystko; tylko zapis wejścia, bez odczytu | `ribbitflip_monitor.py`: `KeyEmitter`, `SlotOutput` |
| Wirtualny pad (Xbox 360 / DualShock 4) | gry, które rozumieją tylko pad | moduł Kontroler włączony i kapsel uzbrojony | widoczne urządzenie w systemie (sterownik ViGEmBus); bez emitera przy `--no-keys`; stop awaryjny centruje drążek | `GamepadEmitter`, `AirMouse._tick` (`live`) |
| Wyzwalacze (Mapowanie) | próg na osi albo przycisk kapsla → akcja | reguła spełniona, emiter jest, `armed`, włącznik grupy (`_gate_for`) | rozbrojenie puszcza trzymane klawisze; reguły z importu przechodzą klasyfikator; `scan:stop` przechodzi zawsze | `TriggerEngine`, `DeviceManager._effective` |
| Sterowanie ruchem | kursor, drążek, krzyżak, klik po zatrzymaniu (dwell) | moduł włączony (domyślnie wyłączony) i kapsel uzbrojony | brak próbek przez 1,5 s puszcza wyjścia; wyłączony moduł liczy tylko podgląd | `AirMouse` |
| Koło wyboru | wybór akcji z koła wycinków | moduł włączony (domyślnie wyłączony), co najmniej dwa wycinki | akcja wychodzi tylko z uzbrojonego kapsla (`trig.armed`) przy włączonym kole i zwykłym emiterem; brak emitera przy `--no-keys` | `RadialMenu._fire` |
| Skaner (dostępność) | pasek przejeżdża po ekranie, jeden sygnał wybiera miejsce kliku | moduł włączony przez człowieka albo przez asystenta MCP, którego człowiek podłączył; okno nad pulpitem otwarte | wyzwalacz z zestawu nie włączy modułu; klik przez `/test-key` z tokenem i tylko przy uzbrojonym kapslu; Shift+R+F zamyka okno; okna-sieroty sprzątane przy starcie | `ScanModule`, `ScanOverlay`, `SlotOutput._scan` |
| MIDI OUT | nuty i CC do programów muzycznych | grupa MIDI włączona i kapsel uzbrojony | tylko wyjście, bez wejścia MIDI; nie powstaje przy `--no-midi`; panika MIDI i stop awaryjny gaszą dźwięki | `MidiEmitter`, `MidiMapper`, `midi_panic` |
| OSC OUT | wartości ruchu do TouchOSC, Resolume, VRChat, ESP32 | grupa OSC włączona i kapsel uzbrojony | tylko wysyłka na adres wpisany przez człowieka (domyślnie `127.0.0.1`), nic nie jest odczytywane; nie powstaje przy `--no-midi` | `OscEmitter` |
| Serwer ruchu DSU | ruch kapsla do emulatorów (Dolphin, Cemu i inne) | po włączeniu w karcie Kontroler | nasłuch tylko na `127.0.0.1`; obsługuje trzy zapytania odczytu, niczego nie naciska; nie powstaje przy `--no-midi` | `DsuServer` |
| Polecenia do kapsla | zapis bajtów do kapsla przez BLE (dioda, wybudzenie) | z panelu | tylko do połączonego kapsla, do 64 bajtów | `PuckSource.queue_command` |

### Odczyt ekranu i stanu systemu

| Mechanizm | Cel | Kiedy działa | Zabezpieczenia | Kod |
| --- | --- | --- | --- | --- |
| Zrzut ekranu | tło planszy skanera, na którym rysuje się obszar skanowania | przycisk „Zrzut ekranu” w zwijaku „Zaawansowane” Skanera lub na pasku nad pulpitem; skrót Alt+R+cyfra, fabrycznie wyłączony | bez zrzutów cyklicznych i bez odczytu tekstu; plik w `Settings/ScanTla/`; wyjeżdża tylko w zestawie skanera, który człowiek sam pobierze; MCP nie ma narzędzia do zrzutu | `zrzut_monitora`, `scan_zrzut_ekranu`, `scan_zrzut_skrotem`, `scan_zrzuty_spakuj` |
| Hak klawiatury | stop awaryjny Alt+R+F, zamknięcie skanera Shift+R+F, zrzut Alt+R+cyfra | gdy dany skrót jest włączony w Ustawieniach | trzyma tylko klawisze wciśnięte teraz i dwa liczniki; połyka wyłącznie klawisz kończący własny skrót; błąd przepuszcza klawisz; nie działa w kopii testowej `--allow-multi`; prawy Alt nigdy nie odpala | `PanicHotkey._match`, `hotkey_check` |
| Program na pierwszym planie | automatyczne wczytanie zestawu przypisanego do gry | tylko po włączeniu funkcji (domyślnie wyłączona) | czyta samą nazwę pliku `.exe`, bez tytułu i treści okna; nigdy nie uzbraja wyjść; wyłączona nie odpytuje | `GameSwitcher`, `_foreground_exe` |

### Serwery i kanały sterowania

| Mechanizm | Cel | Kiedy działa | Zabezpieczenia | Kod |
| --- | --- | --- | --- | --- |
| Serwer HTTP panelu | panel w przeglądarce | cały czas działania aplikacji | nasłuch tylko na `127.0.0.1`; `Host` musi być `127.0.0.1` albo `localhost` (obrona przed DNS rebinding); obcy `Origin` odrzucony; token sesji przy każdym `POST`; limit treści 2 MB; pliki tylko z `web/` | `_bind_http`, `make_handler._csrf_reject` |
| Serwer MCP dla asystentów AI | asystent komponuje zestawy i reguły | po włączeniu w Ustawieniach, w zwijaku „Zaawansowane” (domyślnie wyłączony); `--no-mcp` blokuje na całe uruchomienie | tylko programy z tego komputera, żądanie z przeglądarkowym `Origin` odrzucone; te same funkcje czyszczące co panel; brak narzędzi do pisania, klikania i zrzutów; uzbrojenie, włączenie Skanera lub Koła i tryb zaawansowany serwer przepuszcza tylko przy włączniku „Asystent może uzbrajać” (domyślnie wyłączony); każda zmiana asystenta pokazuje dymek w panelu | `_serve_mcp`, `_require_consent`, `rfOnMcpAction`, `ribbitflip_mcp.py`, `tools/mcp_stdio_bridge.py` |
| Stop awaryjny | wyłączenie wyjść naraz | Alt+R+F (zmienialny), działa też przy schowanym panelu | wyłącza Mapowanie, Sterowanie ruchem, MIDI, OSC, Usługi, Syntezator, Skaner i Koło wyboru na każdym kapslu, puszcza klawisze, gasi nuty, zamyka okno skanera i okno koła przy kursorze; nie jest przełącznikiem, powrót to świadome kliknięcie. Główny przełącznik zostaje celowo: stop działa włącznikami modułów | `panic_stop`, `midi_panic`, `rfOnPanic` (`web/js/rf-39j-hotkey.js`) |

### Połączenia wychodzące (wszystkie z inicjatywy człowieka)

| Mechanizm | Cel | Kiedy działa | Zabezpieczenia | Kod |
| --- | --- | --- | --- | --- |
| Usługi sieciowe (HTTP) | reguła wysyła żądanie pod adres człowieka | reguła albo przycisk Test, moduł włączony (sprawdza panel) | bez śledzenia przekierowań; 30 s, 256 KiB odpowiedzi; nagłówki i treść nie trafiają do logu; nic o użytkowniku nie jest doklejane | `make_handler._rest_send` |
| OBS Studio | sterowanie OBS przez obs-websocket 5 | po połączeniu w karcie Usługi | tylko dosłowny adres IP pętli zwrotnej albo sieci prywatnej; hasło zostaje w przeglądarce | `ObsClient`, `ObsClient._host_reject` |
| Zestaw z odnośnika | pobranie udostępnionego zestawu | po wklejeniu odnośnika | tylko `https` z listy hostów (Discord, GitHub); 1 MiB; niczego nie stosuje, panel pokazuje podgląd bezpieczeństwa | `make_handler._setup_fetch` |
| Pakiety MIDI gry RibbitBeat | pliki MIDI z Hugging Face, import piosenki z adresu | po kliknięciu w grze | limit rozmiaru, kontrola nagłówka MIDI; import z adresu tylko z internetu: adresy tego komputera i sieci lokalnej, także po przekierowaniu, są odrzucane | `ribbitflip_songpacks.py`: `sprawdz_adres`, `_otworz_import`, `pobierz_zakres` |

### Obecność w systemie

| Mechanizm | Cel | Kiedy działa | Zabezpieczenia | Kod |
| --- | --- | --- | --- | --- |
| Ikona w zasobniku | otwarcie panelu, nakładki, zakończenie | cały czas (bez niej okno konsoli przy `--no-tray`) | widoczna pozycja „Zakończ” | `_make_tray_image`, menu zasobnika |
| Autostart | start po zalogowaniu | tylko po zaznaczeniu pozycji w menu zasobnika | jedyny zapis do klucza `HKCU\…\Run`; bez praw administratora; widoczny w Menedżerze zadań; zdejmowany tym samym kliknięciem | `_set_autostart`, `_autostart_cmd` |
| Powiadomienia systemowe | informacja, że reguła zadziałała | po włączeniu powiadomień | wpis nazwy i ikony w `HKCU\Software\Classes\AppUserModelId` dopiero przy pierwszym powiadomieniu | `_register_app_user_model_id`, `SystemNotifier` |
| Nakładki | ściągawki i kulka orientacji nad grą | otwiera i zamyka człowiek | pokazują tylko stronę aplikacji z `127.0.0.1`; nie zabierają skupienia; nie wysyłają wejścia | `OverlayWindow`, `OverlayManager` |
| Uruchamianie procesów | okna przeglądarki dla nakładek i skanera, Eksplorator ze stałym folderem, otwarcie panelu, restart przy zmianie trybu | z działania człowieka | stała lista argumentów budowana przez aplikację, nigdy z danych żądania | `OverlayWindow.open`, `ScanOverlay.open`, `reveal_in_explorer`, `_open_panel`, `_do_mode_restart` |

## Tryby uruchomienia, które ograniczają wyjścia

| Przełącznik | Działanie |
| --- | --- |
| `--no-keys` | twarda blokada: nie powstaje emiter klawiatury, myszy ani przycisków pada; zostaje podgląd |
| `--simulate` | ruch udawany, klawisze prawdziwe; wszystkie grupy wyjść startują wyłączone, pierwsze włączenie wymaga potwierdzenia, a przełączniki z symulacji nie są zapisywane |
| `--no-mcp` | endpoint MCP zablokowany na całe uruchomienie |
| `--no-midi` | bez MIDI, OSC i serwera DSU |
| `--disable` / `--only` | wybrane moduły nie startują wcale |
| `--allow-multi` | kopia testowa: nie zakłada haka klawiatury |

## Import cudzych zestawów

Reguły z zestawów, paczek i profili spoza aplikacji przechodzą klasyfikator (`analyze_config`,
`_classify_rule`, `_classify_spec`). Kombinacje z klawiszem Windows, skróty systemowe (Alt+F4,
Ctrl+W, Alt+Tab i podobne), makra, klik w stałym punkcie ekranu i nieznane akcje są
„ryzykowne” i w trybie bezpiecznym zostają pominięte. Wczytany zestaw nigdy nie przełącza
włączników grup.

## Załatane 2026-10-16 i decyzje świadome

Pierwsza wersja tej mapy wypisała luki znalezione przy sprawdzaniu kodu. Wszystkie są załatane:

- **Stop awaryjny** wyłącza też Koło wyboru (`panic_stop`).
- **Asystent AI** nie uzbroi aplikacji, nie włączy Skanera ani Koła i nie wczyta reguł
  ryzykownych bez włącznika „Asystent może uzbrajać” w karcie Serwer MCP; sprawdza to serwer
  (`ribbitflip_mcp._require_consent`), nie tylko instrukcje dla modelu.
- **Każda zmiana asystenta** pokazuje dymek w panelu (`rfOnMcpAction`).
- **Import piosenki z adresu** pobiera tylko z internetu, każde przekierowanie przechodzi tę samą
  kontrolę (`sprawdz_adres`, `_otworz_import`).
- **`tools/osc_monitor.py`** słucha na `127.0.0.1`; sieć tylko z `--lan`.
- **`ribbitflip_audio.py`** ma ten sam stop awaryjny Alt+R+F.
- **`SECURITY.md` i strony prywatności** wymieniają wszystkie połączenia wychodzące, miejsca
  uruchamiania procesów, pliki poza folderem aplikacji i wpisy w rejestrze.

Dwie rzeczy zostają celowo, bo tak zaprojektowano aplikację (opis w `SECURITY.md`):

1. **Główny przełącznik startuje uzbrojony.** Zapisane włączniki grup działają od razu po
   połączeniu kapsla; każdy włącznik grupy włącza człowiek, a stop awaryjny je gasi.
2. **Token sesji nie uwierzytelnia lokalnych programów.** Granicą bezpieczeństwa jest nasłuch na
   `127.0.0.1`.
