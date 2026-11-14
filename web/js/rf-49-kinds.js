"use strict";
// ==================================================================================================
//  RODZAJE ZAPISANYCH RZECZY — JEDEN REJESTR
//
//  SKĄD TO SIĘ WZIĘŁO. Rodzaj pozycji („preset myszy", „zestaw", „preset osi 3D") był opisany
//  w PIĘTNASTU miejscach: `_LIBRARY_KINDS` na serwerze, `RFL_KINDS` / `RFL_LOAD` / `RFL_DEL` /
//  `RFL_SAVE` / `RFL_EXPLAIN` / `RFL_MOD` w Bibliotece, `MODS` w ramce modułu,
//  `RF_CFG_DESCRIBERS` w opisach, `RFS_KINDS` / `RFS_FILE_PFX` w kreatorze
//  posta, `PDC_KINDS` / `PDC_OPENER_ID` w oknie wymiany, `RFL_COPY` w oknie linku, gałęzie
//  `_rfDropDispatch` w snifferze i `_rfwFiles()` w rysunku „co jest czym". Analiza z 28.08 pisała
//  jeszcze o ośmiu miejscach — przez trzy dni zrobiło się piętnaście, a trzy ostatnie rodzaje
//  (mysz, MIDI/OSC, usługi sieciowe) przeszły przez sześć z nich.
//
//  CO Z TEGO WYNIKAŁO — nie teoria, zmierzone 31.08 na żywym serwerze:
//    * preset usług sieciowych upuszczony na okno kończył się „Pusty lub nieznany zestaw",
//    * preset koła pobrany z aplikacji nie wracał tą samą drogą (plik bez `kind`),
//    * presety myszy i MIDI dawało się POBRAĆ, a nie dawało wczytać — komunikat kazał ręcznie
//      skopiować plik do katalogu obok aplikacji.
//  Każdy z tych trzech błędów to ta sama pomyłka: rodzaj dołożony w jednym miejscu z piętnastu.
//
//  ZASADA, KTÓRA MA TO ZAMKNĄĆ NA STAŁE:
//      NOWY RODZAJ = JEDNA POZYCJA W TEJ TABLICY (+ jeden test kontraktu).
//  Wszystko inne ma się z niej wyliczać. Póki migracja pozostałych rejestrów trwa (etap E2),
//  ta tablica jest ŹRÓDŁEM dla nowych ścieżek i LUSTREM dla starych — a test kontraktu pilnuje,
//  żeby lustro nie skłamało.
//
//  Ładowany PRZED wszystkim, co go czyta (rf-49-cfgid i dalej). Wystawiony też na `window`,
//  bo `const` na górnym poziomie NIE trafia na `window`, a czytają go pliki, które w oknie
//  nakładki mogą się w ogóle nie załadować (stąd wszędzie `typeof`-owe bramki).
// ==================================================================================================

const RF_KINDS = {
  // ---------------------------------------------------------------------------------------------
  //  PIĘTRO 2-3: rzeczy, które opisują CAŁĄ konfigurację, a nie jeden moduł
  // ---------------------------------------------------------------------------------------------
  setup: {
    lib: "setup", env: "setup", key: null, tab: null,
    api: { list: "/setups", listKey: "setups", save: "/setup/save",
           load: "/setup/load", del: "/setup/delete" },
    carrier: "capsule", frame: false, file: "ribbitflip-setup-",
    // Zestaw nie należy do żadnego modułu — jest o całej aplikacji naraz, i tak się nazywa.
    // Ikona = ta sama kaseta, co w nawigacji (rf-34): zakładka i plakietka w Bibliotece to jedno miejsce.
    mod: { pl: "Zestawy", en: "Setups" }, icon: "kaseta",
    pl: { one: "Zestaw", many: "Zestawy", prefix: "" },
    en: { one: "Setup", many: "Setups", prefix: "" },
    dir: "Library/Setups",
    tags: null,   // czytane na żywo z konfiguracji — patrz rfPostModuleTags
    shareId: "setup",
    // Lista modułów odpowiada RF_SETUP_SECTIONS (rf-28): Skaner jest w zestawie od 13.09, Koło i Usługi
    // nie. Zmiana tamtej listy = zmiana tego zdania (pilnuje tests/test_kinds_contract.py).
    explain: ["Zestaw to ustawienia pod jedną grę: Mapowanie, Mysz i Kontroler, MIDI i OSC, Skaner, Osie 3D, Bateria i Synth. Koło wyboru i Usługi zapisujesz osobno. Wczytanie podmienia wszystkie ustawienia naraz.",
               "A setup holds the settings for one game: Mapping, Mouse and Controller, MIDI and OSC, Scanner, 3D axes, Battery and Synth. The selection wheel and Services are saved separately. Loading one replaces all those settings at once."],
    todo: ["", ""],
    share: true, importable: true, dropVia: "setup"
  },
  bundle: {
    // Mieszka w tym samym katalogu co zestawy i w tej samej szufladzie Biblioteki — bo to jest
    // zestaw, tylko na kilka kapsli. Osobnym rodzajem jest dlatego, że przy WCZYTANIU wymaga
    // decyzji (który kapsel bierze którą rolę), a przy WYSYŁANIU innego tytułu i innego tagu.
    lib: "setup", env: "bundle", key: null, tab: null,
    api: { list: "/setups", listKey: "setups", load: "/bundle/apply" },
    carrier: "capsule", frame: false, file: "ribbitflip-bundle-",
    pl: { one: "Zestaw na kilka kapsli", many: "Zestawy na kilka kapsli",
          prefix: "Zestaw na kilka kapsli" },
    en: { one: "Multi-capsule set", many: "Multi-capsule sets", prefix: "Multi-capsule set" },
    dir: "Library/Setups",
    tags: null,   // jak zestaw; tag „Kilka kapsli" dokłada się z liczby kapsli w pliku
    shareId: "bundle",
    explain: ["Kompletny zestaw na kilka kapsli naraz: każdy dostaje własną rolę (np. kierowanie, akcje) razem z całą swoją konfiguracją.",
               "A complete set for several capsules at once: each gets its own role (steering, actions, and so on) together with its whole configuration."],
    todo: ["przypiszesz swoje kapsle do ról autora; aplikacja zapyta, bo kolejność parowania u każdego jest inna.",
            "you assign your own capsules to the author's roles; the app asks, because everybody's pairing order is different."],
    share: true, importable: true, dropVia: "bundle"
  },

  // ---------------------------------------------------------------------------------------------
  //  PIĘTRO 1: presety modułów. `key` to klucz adaptera (rf-49 `rfCfgIdRegister`) i opisu (rf-49k)
  // ---------------------------------------------------------------------------------------------
  profile: {
    lib: "profile", env: "profile", key: "trig", tab: "mapowanie", icon: "map",
    api: { list: "/profiles", listKey: "profiles", save: "/profile/save",
           load: "/profile/load", del: "/profile/delete" },
    carrier: "capsule", frame: true, file: "ribbitflip-profile-",
    mod: { pl: "Mapowanie", en: "Mapping" },
    pl: { one: "Preset wyzwalaczy", many: "Presety wyzwalaczy", prefix: "Preset wyzwalaczy" },
    en: { one: "Trigger preset", many: "Trigger presets", prefix: "Trigger preset" },
    // ⚠️ Koperta presetu wyzwalaczy jako JEDYNA bywa GOŁĄ TABLICĄ reguł (pliki sprzed kopert)
    // albo obiektem `{app:"ribbitflip-wyzwalacze", rules:[…]}`. Sniffer ma na to własną gałąź
    // i tak zostaje — `env` opisuje postać dzisiejszą, nie wszystkie historyczne.
    dir: "Library/Profiles",
    tags: ["Mapowanie"],
    shareId: "trig",
    explain: ["Same reguły „próg → klawisz”. Wczytanie podmienia wyzwalacze i nie rusza osi, myszy ani MIDI.",
               "Nothing but the “threshold → key” rules. Loading one replaces the triggers and leaves the axes, the mouse and MIDI alone."],
    todo: ["", ""],
    share: true, importable: true, dropVia: "profile"
  },
  pose: {
    lib: "pose", env: "pose-preset", key: "pose", tab: "czujnik", icon: "axes",
    api: { list: "/pose-presets", listKey: "presets", save: "/pose-preset/save",
           load: "/pose-preset/load", del: "/pose-preset/delete" },
    carrier: "capsule", frame: false, file: "ribbitflip-pose-",
    // ⚠️ `ownLabel`: szuflada nazywa się „Osie 3D", a NIE „Czujnik". Zakładka jest miejscem,
    // preset jest rzeczą — a obok w Bibliotece stoją „Mapowanie" i „Mysz", czyli rodzaje.
    // `card` mówi, DO CZEGO w tej zakładce dojechać, bo osie są w niej zwijaną sekcją.
    mod: { pl: "Osie 3D", en: "3D axes" }, ownLabel: true, card: "poseCalFold",
    pl: { one: "Preset osi 3D", many: "Presety osi 3D", prefix: "Preset osi 3D" },
    en: { one: "3D axis preset", many: "3D axis presets", prefix: "3D axis preset" },
    // Osie nie mają opisu autora (`desc`) — jako jedyny preset modułu. Pole zostaje puste,
    // zamiast udawać, że jest.
    noDesc: true,
    dir: "Library/AxisPresets",
    tags: [],     // osie nie są modułem — zasilają wyzwalacze, ruch, MIDI i pady naraz
    shareId: "axis",
    explain: ["Strojenie kapsla z zakładki Czujnik: kanały osi, filtr, czułość, odwrócenie i tor sygnału. Dotyczy kapsla, który masz teraz wybrany do edycji.",
               "The capsule tuning from the Sensor tab: axis channels, filter, sensitivity, inversion and the signal chain. Applies to the capsule you currently have selected for editing."],
    todo: ["sprawdź strojenie u siebie i popraw, jeśli trzeba: jest robione pod konkretny egzemplarz kapsla.",
            "check the tuning on your own capsule and adjust if needed: it was done for one particular unit."],
    share: true, importable: true, dropVia: "pose"
  },
  mouse: {
    lib: "mouse", env: "mouse-preset", key: "mouse", tab: "mysz", icon: "mmouse",
    api: { list: "/mouse-presets", listKey: "presets", save: "/mouse-preset/save",
           load: "/mouse-preset/load", del: "/mouse-preset/delete" },
    carrier: "capsule", frame: true, file: "ribbitflip-mouse-",
    mod: { pl: "Mysz", en: "Mouse" },
    pl: { one: "Preset myszy", many: "Presety myszy", prefix: "Preset myszy" },
    en: { one: "Mouse preset", many: "Mouse presets", prefix: "Mouse preset" },
    // Kontroler dzieli ten preset z Myszą i to nie jest oszczędność: obie zakładki stoją nad
    // JEDNYM configem kapsla (`state.mouse`), a kapsel ma jeden tryb ruchu naraz.
    alsoTab: "kontroler",
    dir: "Library/MousePresets",
    tags: [],     // ⚠️ Tagu „Mysz" NIE MA na tym serwerze i nigdy nie było — sprawdzone na żywym
    //         serwerze 2026-09-02 (słownik: RF_FORUM_TAGS w rf-00-core). Cały ruch to JEDEN tag,
    //         „🖱️ Sterowanie ruchem", ale należy on do KONFIGURACJI, nie do tego presetu: preset
    //         myszy niesie samo zachowanie, więc rodzaj stoi w TYTULE wątku, jak przy osiach 3D.
    shareId: "mouse",
    explain: ["Zachowanie sterowania ruchem: tryb, źródła, czułości, wygładzanie, drążek, krzyżak i klik bez klikania. Nie niesie przełącznika, przypisania kapsla do pada ani obszaru kursora. Te zostają Twoje.",
               "How the motion control behaves: the mode, the sources, the sensitivities, the smoothing, the stick, the d-pad and clicking without clicking. It carries no group switch, no controller assignment and no cursor area. Those stay yours."],
    todo: ["", ""],
    share: true, importable: true, dropVia: "preset"
  },
  scan: {
    // SKANER EKRANU. Wpis dołożony 11.09 — do tego dnia moduł miał własną bibliotekę (`rf-50j`),
    // ale rejestr panelu o nim nie wiedział, więc plik `scan-preset` upuszczony na okno kończył
    // jako „Pusty lub nieznany zestaw", a w Bibliotece wszystkich modułów nie było ani jego chipa,
    // ani przycisku „Wymiana". Dokładnie ten błąd opisuje nagłówek tego pliku — rodzaj dołożony
    // w jednym miejscu z piętnastu. Złapał go `test_kinds_contract.py`.
    lib: "scan", env: "scan-preset", key: "scan", tab: "skaner", icon: "celownik",
    api: { list: "/scan-presets", listKey: "presets", save: "/scan-preset/save",
           load: "/scan-preset/load", del: "/scan-preset/delete" },
    // Nośnikiem jest KAPSEL: to jest strojenie POD JEDNĄ OSOBĘ — jej czas reakcji, jej tempo,
    // jej szerokość pasma. Dwie osoby z dwoma kapslami mają dwa różne komplety.
    carrier: "capsule", frame: true, file: "ribbitflip-skaner-",
    mod: { pl: "Skaner", en: "Scanner" },
    pl: { one: "Preset skanera", many: "Presety skanera", prefix: "Preset skanera" },
    en: { one: "Scanner preset", many: "Scanner presets", prefix: "Scanner preset" },
    dir: "Library/ScanPresets",
    tags: [],
    shareId: "scan",
    // ⚠️ TEN OPIS CZYTA KTOŚ, KTO WŁAŚNIE POBRAŁ CUDZY PLIK — i od 13.09 preset niesie o dwie
    // rzeczy więcej, niż mówił: GDZIE skaner pracuje (obszar) i ILE różnych skanerów w sobie ma
    // (sekcje). Przemilczenie obszaru byłoby tu najdroższe: prostokąt policzony pod czyjś ekran
    // albo pod jedną grę u kogoś innego wypada w innym miejscu, a skaner wygląda wtedy na zepsuty.
    explain: ["Całe strojenie skanowania ekranu: sposób wskazywania, tempo paska, szerokości pasm, czasy dostępności (postój przed ruszeniem, czas przytrzymania, przerwa po wyborze), dociąganie do celu i wygląd. Niesie też OBSZAR (gdzie na ekranie skaner pracuje) i wszystkie zapisane w nim sekcje, czyli osobne skanery przełączane akcją scan:sekcja=N. Od 20.09 niesie też ZRZUTY PLANSZ, czyli obrazy, na których autor wyznaczał obszary; wchodzą do Twojego katalogu zrzutów. Nie niesie włącznika modułu ani reguł, które dają sygnał. Te zostają przy Tobie.",
               "The whole screen-scanning setup: how you point, the bar's tempo, the band widths, the accessibility timings (delay before it starts, acceptance time, post-selection pause), snapping to targets and the look. It also carries the AREA (where on the screen the scanner works) and every section saved in it, that is separate scanners switched with the scan:sekcja=N action. Since 20.09 it also carries the VIEWS' SCREENSHOTS, the pictures the author set the areas on; they land in your screenshots folder. It carries neither the module switch nor the rules that provide the signal. Those stay yours."],
    todo: ["czas reakcji jest osobisty: zmierz „wyprzedzenie” u siebie w Treningu celności, bo preset niesie czyjeś. Sprawdź też obszar każdej sekcji: prostokąt ustawiony pod czyjś ekran albo pod jedną grę u Ciebie wypadnie gdzie indziej.",
            "reaction time is personal: measure the lead in the accuracy training, because the preset carries somebody else's. Check each section's area too: a rectangle set for somebody else's screen, or for one game, lands elsewhere on yours."],
    // CO JESZCZE JEDZIE W PLIKU POZA `config` (2026-09-20). `carry` — pola koperty przepisywane
    // przy imporcie (miniatura, czyli obrazek wiersza w Bibliotece; bez tego ginęła po drodze).
    // `onImport` — nazwa funkcji, która ma coś rozpakować ZANIM preset zostanie zapisany; tutaj
    // zrzuty plansz, bo bez nich kolega dostaje obszary bez obrazu, na którym je ustawiano.
    carry: ["miniatura"], onImport: "rfScanImportObrazy",
    share: true, importable: true, dropVia: "preset"
  },
  midi: {
    lib: "midi", env: "midi-preset", key: "midi", tab: "midi", icon: "midi",
    api: { list: "/midi-presets", listKey: "presets", save: "/midi-preset/save",
           load: "/midi-preset/load", del: "/midi-preset/delete" },
    carrier: "capsule", frame: true, file: "ribbitflip-midi-",
    mod: { pl: "MIDI i OSC", en: "MIDI and OSC" },
    pl: { one: "Preset MIDI i OSC", many: "Presety MIDI i OSC", prefix: "Preset MIDI i OSC" },
    en: { one: "MIDI and OSC preset", many: "MIDI and OSC presets", prefix: "MIDI and OSC preset" },
    // Jeden plik, dwa wyjścia i dwie zakładki — jak wyżej przy myszy i kontrolerze.
    alsoTab: "osc",
    dir: "Library/MidiPresets",
    tags: [],     // Tagi 🎼 MIDI i 📡 OSC na forum SĄ (potwierdzone 2026-09-02), ale preset bywa
    //         wyłącznie OSC-owy albo wyłącznie MIDI-owy, więc zaznaczenie obu byłoby nieprawdą —
    //         to trzeba policzyć z pliku (E6), a nie wpisać na sztywno tutaj.
    shareId: "midi",
    explain: ["Cała lista mapowań na wyjście muzyczne (MIDI i OSC razem) wraz ze skalą. Nie niesie przełączników grup, kanału MIDI ani prefiksu adresów OSC. Te zostają Twoje, bo odróżniają kapsle od siebie.",
               "The whole list of mappings to the musical output (MIDI and OSC together), plus the scale. It carries no group switches, no MIDI channel and no OSC address prefix. Those stay yours, because they are what tells your capsules apart."],
    todo: ["", ""],
    share: true, importable: true, dropVia: "preset"
  },
  rest: {
    lib: "rest", env: "rest-preset", key: "rest", tab: "restapi", icon: "rest",
    api: { list: "/rest-presets", listKey: "presets", save: "/rest-preset/save",
           load: "/rest-preset/load", del: "/rest-preset/delete" },
    // Nośnikiem jest APLIKACJA, nie kapsel: wyzwalacz sam mówi, którego kapsla słucha.
    carrier: "app", frame: true, file: "ribbitflip-rest-",
    mod: { pl: "Usługi sieciowe", en: "Network services" },
    pl: { one: "Preset usług sieciowych", many: "Presety usług sieciowych",
          prefix: "Preset usług sieciowych" },
    en: { one: "Network-service preset", many: "Network-service presets",
          prefix: "Network-service preset" },
    dir: "Library/RestPresets",
    tags: [],     // tag 🌐 REST API na forum jest (2026-09-02), ale należy do PACZKI akcji;
    //         preset usług sieciowych to co innego, więc rodzaj stoi w tytule wątku (E7)
    shareId: "rest",
    explain: ["Zestaw akcji sieciowych razem z ich wyzwalaczami: żądania HTTP, sterowanie OBS-em i zmienne, do których się odwołują. Nie niesie przełącznika modułu ani adresu OBS-a; to zostaje przy tym komputerze. Hasła i tokeny są w sejfie, nigdy w pliku presetu.",
               "A set of network actions together with their triggers: HTTP requests, OBS control and the variables they refer to. It carries neither the module switch nor the OBS address; those stay with this computer. Passwords and tokens live in the vault, never in a preset file."],
    todo: ["wpisz własne poświadczenie w sejfie i ustaw adres bazowy, bo preset ich nie niesie.",
            "put your own credential in the vault and set the base URL, because the preset carries neither."],
    share: true, importable: true, dropVia: "preset"
  },
  wheel: {
    // ⚠️ JEDYNY PRESET, KTÓRY NIE JEST PLIKIEM W KATALOGU: koło trzyma swoje presety jako listę
    // w `Settings/ribbitflip_wheel_presets.json`. Dlatego `dir` jest pusty, a `api.save` przyjmuje
    // CAŁY preset (`{name, category, config}`), nie parę `{name, config}`. Wciągnięcie tego do
    // Biblioteki globalnej to etap E4 (magazyn jako para funkcji, nie katalog).
    lib: "wheel", env: "wheel-preset", key: "wheel", tab: "kolo", icon: "radial",
    api: { list: "/wheelpresets", listKey: "presets", save: "/wheelpresets",
           del: "/wheelpresets/delete" },
    carrier: "capsule", frame: true, file: "ribbitflip-kolo-", inSettings: true,
    mod: { pl: "Koło wyboru", en: "Selection wheel" },
    pl: { one: "Preset koła", many: "Presety koła", prefix: "Preset koła" },
    en: { one: "Wheel preset", many: "Wheel presets", prefix: "Wheel preset" },
    // Koło ma WŁASNY kreator posta (rf-46f) i to jest świadomy wyjątek: jego preset mieści się
    // w TREŚCI wpisu (blok ```json), więc nie potrzebuje załącznika — a cały ostatni krok
    // wspólnego kreatora jest o załączniku.
    ownWizard: true,
    dir: "Settings/ribbitflip_wheel_presets.json",
    // ⚠️ NAZWA TAGA JEST JEDNA: „🎡 Koło wyboru" z RF_FORUM_TAGS.zestawyExtra (rf-00-core, odczyt
    // z żywego serwera 2026-09-02). Napisana tu literałem, a nie odczytana ze stałej, z jednego
    // powodu: ten plik bywa uruchamiany BEZ reszty aplikacji (tests/kinds_harness.mjs wciąga sam
    // rejestr do `vm`, bez rf-00-core), więc twarde odwołanie wywaliłoby harness na starcie.
    tags: ["Koło wyboru"],
    shareId: "wheel",
    explain: ["Całe koło jednego kapsla: wycinki z akcjami, podmenu, sposób wyboru i wygląd. Nie niesie przełącznika On ani miejsca wyświetlania. Te zostają przy kapslu i przy Twoim ekranie.",
               "One capsule's whole wheel: the slices with their actions, the submenus, how you pick and how it looks. It carries no On switch and no display location. Those stay with the capsule and with your screen."],
    todo: ["akcje wycinków to zwykłe skróty klawiszowe, więc sprawdź je u siebie: w Twojej grze mogą znaczyć co innego.",
            "the slices' actions are ordinary keyboard shortcuts, so check them on your side: they may mean something else in your game."],
    share: true, importable: true, dropVia: "wheel"
  },
  synth: {
    lib: "synth", env: "synth-scene", key: "synth", tab: "pad", icon: "synth",
    api: { list: "/synth-scenes", listKey: "scenes", save: "/synth-scene/save",
           del: "/synth-scene/delete" },
    carrier: "app", frame: true, file: "ribbitflip-synth-", inSettings: true,
    mod: { pl: "Synth", en: "Synth" },
    pl: { one: "Scena syntezatora", many: "Sceny syntezatora", prefix: "Scena syntezatora" },
    en: { one: "Synth scene", many: "Synth scenes", prefix: "Synth scene" },
    dir: "Settings/ribbitflip_synth.json",
    tags: [],
    shareId: "synth",
    explain: ["Instrumenty i dźwięki pól XY razem z efektami: to, co syntezator gra i czym. Należy do aplikacji, nie do kapsla: kapsle po prostu w to grają.",
               "The XY pads' instruments and sounds together with the effects: what the synth plays and with what. It belongs to the app, not to a capsule: capsules simply play into it."],
    todo: ["", ""],
    // Zapis przyjmuje `state`, nie `config` — scena jest nieprzezroczystą paczką stanu silnika
    // dźwięku, a nie listą pokręteł, i serwer sprawdza jej KOPERTĘ, nie treść (`_synth_blob_ok`).
    saveField: "state",
    // DO WYMIANY OD ETAPU E4: dopiero od chwili, w której Biblioteka umie scenę OPISAĆ (ile padów,
    // ile WŁASNYCH brzmień autora), da się uczciwie powiedzieć, co jedzie w pliku. Wcześniej byłby
    // to nieprzezroczysty blob z nazwą.
    share: true, importable: true, dropVia: "preset"
  },
  overlay: {
    // Układ OKIEN nakładek. W Bibliotece ma sens (to jest nazwana rzecz, którą się nosi),
    // ale na forum nie: układ okien opisuje CZYJŚ ekran — liczbę monitorów, ich rozdzielczość
    // i to, gdzie ktoś trzyma grę. U drugiej osoby te współrzędne nie znaczą nic.
    lib: "overlay", env: "overlay-layout", key: "overlay", tab: "wszystkie", icon: "axes",
    api: { list: "/overlay-layouts", listKey: "layouts", save: "/overlay-layout/save",
           load: "/overlay-layout/apply", del: "/overlay-layout/delete" },
    carrier: "app", frame: false, file: "ribbitflip-nakladki-", inSettings: true,
    mod: { pl: "Nakładka", en: "Overlay" },
    pl: { one: "Układ nakładek", many: "Układy nakładek", prefix: "Układ nakładek" },
    en: { one: "Overlay layout", many: "Overlay layouts", prefix: "Overlay layout" },
    dir: "Settings/ribbitflip_overlay_layouts.json",
    tags: [],
    shareId: "overlay",
    explain: ["Nazwany układ okien nakładek: które okna są otwarte, gdzie stoją i jak duże są. Opisuje TWÓJ ekran, więc u kogoś innego te współrzędne znaczą co innego.",
               "A named layout of the overlay windows: which are open, where they sit and how big they are. It describes YOUR screen, so on somebody else's those coordinates mean something else."],
    todo: ["", ""],
    // ⛔ POZA WYMIANĄ ŚWIADOMIE: układ opisuje TWÓJ ekran — ile masz monitorów, jakiej są
    // rozdzielczości i gdzie trzymasz grę. U drugiej osoby te współrzędne znaczą co innego, więc
    // „podziel się układem" byłoby obietnicą, której plik nie może dotrzymać. W Bibliotece jest,
    // bo własny układ warto mieć zapisany i móc go pobrać na wszelki wypadek.
    share: false, importable: false, dropVia: null
  },

  // ---------------------------------------------------------------------------------------------
  //  POZA PIĘTRAMI: jedyna rzecz, która DOKŁADA, a nie zastępuje
  // ---------------------------------------------------------------------------------------------
  pack: {
    // Paczka akcji REST nie leży w bibliotece i leżeć nie ma: biblioteka jest o rzeczach, które
    // się NOSI, a paczka wchodzi DO wybranej aplikacji i niczego nie kasuje. Ma tu pozycję,
    // żeby kreator posta, okno linku i sniffer czytały o niej z tego samego miejsca, co o reszcie.
    lib: null, env: "rest-actions", key: null, tab: "restapi", icon: "rest",
    api: {}, carrier: "app", frame: false, file: "ribbitflip-akcje-",
    pl: { one: "Paczka akcji REST", many: "Paczki akcji REST", prefix: "Paczka REST" },
    en: { one: "REST action pack", many: "REST action packs", prefix: "REST pack" },
    adds: true,
    tags: ["REST API"],
    shareId: "pack",
    explain: ["Wywołania HTTP razem z gotowymi ruchami, które je odpalają. Bez tokenów i haseł.",
               "The HTTP calls together with the ready-made movements that fire them. No tokens or passwords."],
    todo: ["wpisz własne poświadczenie w sejfie i ustaw adres bazowy, bo paczka ich nie niesie.",
            "put your own credential in the vault and set the base URL, because the pack carries neither."],
    share: true, importable: true, dropVia: "pack"
  }
};
window.RF_KINDS = RF_KINDS;

// Rodzaje, które są PRESETEM MODUŁU wczytywanym wspólną drogą importu (rf-29d). Zestaw, bundle
// i paczka mają własne ścieżki z własnymi bramkami (podgląd bezpieczeństwa, wybór ról, przegląd
// akcji) i nie wolno ich obejść.
const RF_KIND_PRESETS = ["profile", "pose", "mouse", "midi", "rest", "wheel", "scan"];
window.RF_KIND_PRESETS = RF_KIND_PRESETS;

// Każdy rodzaj nosi swój identyfikator w sobie, żeby wywołujący nie musiał go dźwigać osobno.
for (const _id in RF_KINDS) RF_KINDS[_id].id = _id;

// Rodzaj po jego identyfikatorze.
function rfKind(id) { return RF_KINDS[String(id || "")] || null; }

// Rodzaj po kopercie pliku (`kind` w środku). To jest jedyne miejsce, w którym plik zamienia się
// w decyzję „co z tym zrobić" — sniffer ma z tego korzystać, zamiast mnożyć gałęzie `if`.
function rfKindByEnv(envKind) {
  const k = String(envKind || "").trim();
  if (!k) return null;
  for (const id in RF_KINDS) if (RF_KINDS[id].env === k) return RF_KINDS[id];
  return null;
}

// Rodzaj po szufladzie Biblioteki (`kind` w /library). Zestaw i bundle dzielą jedną szufladę,
// więc odpowiedzią jest ten pierwszy — to on odpowiada za listę, a bundle poznaje się po fladze.
function rfKindByLib(libKind) {
  const k = String(libKind || "");
  for (const id in RF_KINDS) if (RF_KINDS[id].lib === k) return RF_KINDS[id];
  return null;
}

// LICZEBNIK. „2 aplikacji, 1 wyzwalaczy" to zdanie, po którym widać, że interfejs tłumaczyła
// maszyna. Polski ma trzy formy i wybiera je po ostatniej cyfrze — poza nastkami, gdzie nie.
// Ta sama arytmetyka stoi od 2026-08-22 w kreatorze posta (`_rfsPl` w rf-39f); tutaj jest jej
// miejsce docelowe, bo pytają o nią wszystkie rodzaje, a nie tylko kreator.
function rfPl(n, f1, f2, f5, e1, e2) {
  const v = Math.abs(n || 0), t = v % 10, h = v % 100;
  const pl = (v === 1) ? f1 : (t >= 2 && t <= 4 && (h < 12 || h > 14)) ? f2 : f5;
  return (typeof _gl === "function") ? _gl(pl, v === 1 ? e1 : e2) : pl;
}

// Nazwa rodzaju w języku panelu. Trzy formy, bo polszczyzna ich potrzebuje: „Preset myszy"
// (jeden), „Presety myszy" (nagłówek szuflady), „Preset myszy: Precyzja" (tytuł wątku).
function rfKindName(K, form) {
  if (!K) return "";
  const f = form || "one";
  const pl = (K.pl || {})[f] || "", en = (K.en || {})[f] || pl;
  return (typeof _gl === "function") ? _gl(pl, en) : pl;
}

// ADAPTER MODUŁU dla tego rodzaju — albo `null`. Najpierw rejestr zakładek (rf-49
// `rfCfgIdRegister`), bo tam siedzi ten, który naprawdę się zamontował; potem stała modułu,
// bo rejestr wypełnia się dopiero przy budowie ramki, a import bywa wcześniej.
//
// ⚠️ ADAPTERY SĄ `const` NA GÓRNYM POZIOMIE, WIĘC NIE MA ICH NA `window` — deklaracja leksykalna
// nie zakłada właściwości obiektu globalnego. `window["MOUSE_CFG_ADAPTER"]` jest tu zawsze
// `undefined` i gasiłoby całą funkcję po cichu (ta sama pułapka, co `window.state` opisana
// w rf-49j). Dlatego każdy jest sięgany po nazwie, przez `typeof`, w osobnej funkcji.
const _RF_KIND_ADAPTER = {
  trig:    () => (typeof TRIG_CFG_ADAPTER    !== "undefined") ? TRIG_CFG_ADAPTER    : null,
  mouse:   () => (typeof MOUSE_CFG_ADAPTER   !== "undefined") ? MOUSE_CFG_ADAPTER   : null,
  midi:    () => (typeof MIDI_CFG_ADAPTER    !== "undefined") ? MIDI_CFG_ADAPTER    : null,
  pose:    () => (typeof POSE_CFG_ADAPTER    !== "undefined") ? POSE_CFG_ADAPTER    : null,
  rest:    () => (typeof REST_CFG_ADAPTER    !== "undefined") ? REST_CFG_ADAPTER    : null,
  wheel:   () => (typeof WHEEL_CFG_ADAPTER   !== "undefined") ? WHEEL_CFG_ADAPTER   : null,
  scan:    () => (typeof SCAN_CFG_ADAPTER    !== "undefined") ? SCAN_CFG_ADAPTER    : null,
  synth:   () => (typeof SYNTH_SCENE_ADAPTER !== "undefined") ? SYNTH_SCENE_ADAPTER : null,
  overlay: () => (typeof OVL_LAYOUT_ADAPTER  !== "undefined") ? OVL_LAYOUT_ADAPTER  : null
};
function rfKindAdapter(K) {
  if (!K || !K.key) return null;
  try {
    if (K.tab && typeof rfCfgIdEntry === "function") {
      const e = rfCfgIdEntry(K.tab);
      if (e && e.adapter) return e.adapter;
    }
  } catch (err) { /* ramka jeszcze nie stanęła */ }
  const fn = _RF_KIND_ADAPTER[K.key];
  try { return (fn && fn()) || null; } catch (err) { return null; }
}
