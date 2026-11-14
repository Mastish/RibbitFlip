"use strict";
// ===================== i18n (PL ↔ EN) =====================
// PL→EN dictionary for static UI strings. Dynamic data (hex/numbers) is not translated.
// Translation works via a DOM-walker + MutationObserver (also catches dynamically rendered content).
// Keys are the Polish source text with runs of whitespace collapsed to single spaces, so a key
// must match the rendered string exactly (punctuation and quote characters included) to hit.
// EN values use British spelling (behaviour, colour, centre, grey, -ise). Dolphin's own labels
// ("Controller Settings", "Motion Input") keep their original spelling.
const I18N_EN={
 // ===== TYTUŁ OKNA =====
 // Walker chodzi po document.body, więc <title> z <head> NIE jest tłumaczony — i celowo: to samo
 // okno z ?overlay=1 nadpisuje document.title znacznikiem, po którym serwer znajduje nakładkę
 // wśród innych okien systemu, a przetłumaczenie tytułu odebrałoby mu ją. Para stoi tutaj, żeby
 // angielskie brzmienie tytułu było ZAPISANE w jednym miejscu z resztą napisów, gdyby kiedyś
 // jakaś powierzchnia (pasek zadań, zrzut ekranu w zgłoszeniu) miała je czytać.
 "RibbitFlip — panel":"RibbitFlip — dashboard",
 // ===== UKŁAD TRZECH KOLUMN (2026-08-29) =====
 // Nawigacja w lewej kolumnie, kapsle i podgląd w prawej, ekran „Przegląd" w środkowej.
 // Etykiety samych modułów mają swoje klucze niżej (to te same napisy, co na starym pasku);
 // tutaj tylko to, co powstało razem z nowym układem.
 "Nawigacja":"Navigation","Moduł":"Module",
 // Trzecia sekcja lewej kolumny (2026-10-03): Synth i link do gry RibbitBeat, „obok” modułów.
 "Wypróbuj":"Try it out",
 // ===== OSIE 3D =====
 // Osie NIE mają własnej zakładki (etap 2 ją wprowadził, etap 4 cofnął — wróciły do Czujnika).
 // Zostaje sama nazwa rodzaju presetu: Biblioteka podpisuje nią szufladę i chipy modułu.
 // Klucze zakładki („Przejdź do Osi 3D", tytuł modułu, podpis kafla) skasowane razem z napisami.
 "Osie 3D":"3D axes",
 // Pas naciśnięć w prawej kolumnie (rf-34f). Wykresy kanałów zeszły z kolumny do Czujnika (UX 261120 L23).
 "Naciśnięcia":"Presses",
 "Naciśnięcia przycisku kapsla — kreska to moment wciśnięcia, pasek to czas trzymania; ta sama oś czasu co przebieg wyżej":"Capsule button presses — the hairline is the moment of the press, the bar is how long it was held; same time axis as the trace above",
 // Odnośnik w nagłówku sekcji „Podgląd na żywo" (etap 6a). Napisy przycisku sterowania ręcznego
 // („Steruj ręcznie" / „Wróć do animacji" i obie podpowiedzi) mają już swoje klucze niżej, przy
 // karcie orientacji — bliźniaczy przycisk przy miniaturze celowo używa DOKŁADNIE tych samych
 // napisów, więc nie dokłada tu ani jednego klucza.
 "Zobacz szczegóły":"See details",
 "Pełne karty podglądu i strojenie osi kapsla stoją na ekranie Czujnik":"The full preview cards and the capsule's axis tuning live on the Sensor screen",
 // Dymki kropek stanu w nawigacji (rf-34 updateTabDots) — zastąpiły legendę kolorów z lewej kolumny.
 "Włączony na wybranym kapslu":"On for the selected capsule",
 "Wyłączony na wybranym kapslu":"Off for the selected capsule",
 "Kapsle i podgląd":"Capsules and preview",
 // Zdanie składane z nazwą kapsla: nazwa siedzi w osobnym <b data-noi18n>, więc kluczem jest
 // sama reszta zdania. Walker zwija białe znaki, więc wiodąca spacja nie przeszkadza.
 "jest wstrzymany, nic nie wychodzi":"is on hold, nothing is going out",
 "Zwiń lewy panel (Ctrl+B)":"Collapse the left panel (Ctrl+B)",
 "Rozwiń lewy panel (Ctrl+B)":"Expand the left panel (Ctrl+B)",
 "Zwiń prawy panel (Ctrl+\\)":"Collapse the right panel (Ctrl+\\)",
 "Rozwiń prawy panel (Ctrl+\\)":"Expand the right panel (Ctrl+\\)",
 "Przegląd":"Overview","Przegląd wszystkich kapsli":"All capsules at a glance",
 "Nie wiesz, który kapsel to który? Potrząśnij nim, a jego pigułka zamiga.":"Not sure which capsule is which? Give it a shake and its pill will blink.",
 "Upuść plik JSON":"Drop a JSON file","zestaw · kilka kapsli · presety · paczka REST":"setup · multi-capsule · presets · REST pack",
 "Wczytuję jeden plik naraz — wybieram pierwszy.":"Loading one file at a time — using the first.",
 "To nie jest plik JSON.":"That is not a JSON file.","Nie rozpoznano pliku.":"File not recognised.",
 "Nie rozpoznano pliku — nieprawidłowy JSON.":"File not recognised — invalid JSON.",
 "Nie udało się odczytać pliku.":"Could not read the file.",
 "Zatrzask: po puszczeniu żaba zostaje i gra — wyłącz zatrzask albo Kill, by ją zwolnić":"Latch: after release the frog stays and keeps playing — turn latch off or hit Kill to release it",
 "Wycisz dźwięk":"Mute sound","Wznów dźwięk":"Unmute sound","Edytuj kapsel":"Edit capsule","Usuń kapsel":"Remove capsule","kliknij mnie":"click me",
 // The capsule bar: the sound switch and the state written on the pill as a word instead of a hue.
 // Keys must match the rendered string EXACTLY — these are painted by devStateWord() in rf-11b and
 // by the pill renderer in rf-11. (The hold switch left the pill on 2026-08-25 for the „Moduły"
 // matrix, which composes its own labels with _gl() and so needs no keys here.)
 "wstrzymany":"on hold","parowanie":"pairing","szukam":"searching",
 "niesparowany":"unpaired","rozłączony":"disconnected",
 // The hold the capsule puts on ITSELF after lying still (Connection tab → „Wstrzymuj wyjścia przy
 // bezczynności"). A separate word from plain „wstrzymany" because the two are undone differently:
 // this one lifts on the first movement, the other waits for a click in „Moduły".
 "wstrzymany (bezczynność)":"on hold (idle)",
 "wstrzymany, bo leży nieruchomo (rusz nim, żeby wrócił)":"on hold, because it is lying still (move it to bring it back)",
 "wstrzymany, bo leży nieruchomo — rusz nim, żeby wrócił":"on hold, because it is lying still — move it to bring it back",
 "Wstrzymuj wyjścia przy bezczynności":"Hold the outputs when nothing moves",
 "Po czasie":"After",
 "Kapsel odłożony na bok przestaje sterować, pierwszy ruch przywraca działanie od razu. To co innego niż usypianie kapsla: tu nic się nie rozłącza.":"A capsule put aside stops steering, and the first movement gives it straight back. This is not the same as putting the capsule to sleep: nothing disconnects here.",
 "wyciszony dźwięk":"sound muted","wstrzymany, nic z niego nie wychodzi":"on hold, nothing gets out of it",
 "Ten kapsel jest wstrzymany, więc nic z niego nie wychodzi: ani dźwięk, ani klawisze. Wznów go w sekcji Moduły nad pigułkami kapsli, w kolumnie Cały kapsel.":"This capsule is on hold, so nothing gets out of it: no sound, no keystrokes. Resume it in the Modules section above the capsule pills, in the Whole capsule column.",
 "Ten kapsel ma wyciszony dźwięk, więc nie gra na żadnym padzie. Klawisze i MIDI dalej z niego lecą.":"This capsule has its sound muted, so it plays on no pad. Keystrokes and MIDI still go out.",
 // Reads in the same order the buttons sit in on the pill (edit · sleep · mute · remove), then
 // points at the fold that took the hold switch over.
 "Realny":"Real","Symulacja":"Simulation",
 "Nowy wyzwalacz":"New trigger","Dodaj warunek":"Add condition","Nowe mapowanie":"New mapping",

 // Virtual-pad buttons: the quick-pick list in the mapping editor, the macro-library chips and
 // the category that holds them. Only the descriptive halves need translating — "A", "LB", "Start"
 // are what is printed on the pad in both languages.
 "🎮 Pad: LB (górny lewy)":"🎮 Pad: LB (left bumper)","🎮 Pad: RB (górny prawy)":"🎮 Pad: RB (right bumper)",
 "🎮 Pad: LT (spust lewy)":"🎮 Pad: LT (left trigger)","🎮 Pad: RT (spust prawy)":"🎮 Pad: RT (right trigger)",
 "🎮 Pad: krzyżak ↑":"🎮 Pad: D-pad ↑","🎮 Pad: krzyżak ↓":"🎮 Pad: D-pad ↓",
 "🎮 Pad: krzyżak ←":"🎮 Pad: D-pad ←","🎮 Pad: krzyżak →":"🎮 Pad: D-pad →",
 "🎮 Pad: klik lewym drążkiem (L3)":"🎮 Pad: left stick click (L3)",
 "🎮 Pad: klik prawym drążkiem (R3)":"🎮 Pad: right stick click (R3)",
 "🎮 Kontroler":"🎮 Controller",
 "🎮 krzyżak ↑":"🎮 D-pad ↑","🎮 krzyżak ↓":"🎮 D-pad ↓","🎮 krzyżak ←":"🎮 D-pad ←","🎮 krzyżak →":"🎮 D-pad →",
 "⬇ trzymaj 🎮 RT":"⬇ hold 🎮 RT","⬆ puść 🎮 RT":"⬆ release 🎮 RT",
 "np. right, ctrl+c, mouse:left, pad:a":"e.g. right, ctrl+c, mouse:left, pad:a",
 // A click at a POINT of the screen (rf-12b). The live readout and the flashes are composed with
 // _ptT() at the moment they are written (they contain coordinates); everything below is the
 // static half of the panel, which has to change language while the panel is already open.
 "🖱 Punkt na ekranie…":"🖱 Point on screen…","🖱 Punkt na ekranie":"🖱 Point on screen",
 "Klik w konkretnym miejscu ekranu — podaj X i Y albo wskaż punkt kursorem":
   "A click at a specific place on screen — type X and Y or point the cursor at it",
 "🎯 Wskaż kursorem…":"🎯 Point the cursor…","⏹ Weź teraz":"⏹ Take it now",
 "piksele":"pixels","% pulpitu":"% of desktop","Klikaj":"Click","Sposób":"How","przez":"for",
 "jeden klik":"one click","dwuklik":"double-click","przytrzymanie przez…":"press and hold for…",
 "trzymaj, dopóki trwa warunek":"hold while the condition lasts",
 "lewym":"left","prawym":"right","środkowym":"middle","bez klikania, sam kursor":"no click, cursor only",
 "Ustaw jako akcję":"Set as the action","Dodaj do makra":"Add to the macro","Zwiń":"Collapse",
 "pulpit: nie znam rozmiaru":"desktop — size unknown","ustaw kursor na celu…":"put the cursor on the target…",
 "nie widzę kursora":"cannot see the cursor","Wskazywanie punktu anulowane":"Point picking cancelled",
 "Nie udało się odczytać pozycji kursora":"Could not read the cursor position",
 "Nie znam rozmiaru pulpitu, zostaję przy pikselach":"I don't know the desktop size — staying in pixels",
 "🖱 punkt na ekranie…":"🖱 point on screen…","🖱 kursor na środek":"🖱 cursor to the middle",
 "Kursor skacze w to miejsce i klika w to, co się tam akurat znajduje. Działa w oknach, menu i grach z widocznym kursorem; gry czytające mysz „surowo” (FPS) potrafią taki skok zignorować. Piksele są przypisane do TWOJEGO ekranu, więc zestaw dla innej osoby zapisz w procentach. Przy wysyłce zestawu taka reguła liczy się jako ryzykowna i tryb bezpieczny ją pominie.":
   "The cursor jumps there and clicks whatever happens to be at that spot — fine in windows, menus and games that show a cursor; games reading the mouse “raw” (FPS) may ignore the jump. Pixels belong to YOUR screen — write a set meant for somebody else in percentages. When a set is shared, such a rule counts as risky and safe mode skips it.",
 "Gdy okno musi zdążyć zauważyć najechanie, użyj makra:":"When a window needs a moment to notice the hover, use a macro:",
 "🎮 Wirtualny kontroler działa, więc przyciski polecą do gry tak jak z pada.":"🎮 The virtual controller is running, so buttons reach the game exactly like a real pad's.",
 "🎮 Pad utworzy się przy pierwszym użyciu (potrzebny sterownik ViGEmBus).":"🎮 The pad will be created on first use (the ViGEmBus driver is required).",
 "⚠ Brak modułu vgamepad, więc przyciski kontrolera nigdzie nie polecą. Zainstaluj vgamepad i sterownik ViGEmBus.":"⚠ The vgamepad module is missing, so controller buttons will go nowhere. Install vgamepad and the ViGEmBus driver.",
 // („Kanał (— slotu)" was the label of the per-mapping channel field until it was renamed to
 //  „Kanał mapowania (puste = kanał grupy)" — the old wording read as a shrug, not a field name.)
 "Wygładzanie (ms)":"Smoothing (ms)","wycentrowane (środek)":"centred (bipolar)",
 "Martwa strefa środka (±%)":"Centre dead zone (±%)","CC #":"CC #","CC # (para: CC i CC+32)":"CC # (pair: CC & CC+32)",
 "Wyjście CC (min–max)":"CC output (min–max)","Wyjście aftertouch (min–max)":"Aftertouch output (min–max)",
 "Program # (0–127)":"Program # (0–127)","zatrzask nuty (przełącznik)":"note latch (toggle)",
 "Typ OSC":"OSC type","float (zakres)":"float (range)",
 // OSC receiver profiles + edge behaviours (rf-16). The profile names the pair (argument type,
 // range) a receiver expects; the behaviour says when and for how long. The "what goes out"
 // line under the fields is built with _gl() instead — it is broken up by <b> values.
 "Profil odbiornika":"Receiver profile","Zachowanie na progu":"Behaviour at the threshold",
 "Czas impulsu (ms)":"Pulse length (ms)","Wartość przy rozbrojeniu":"Value on disarm",
 "— nie parkuj":"— do not park",
 "Cyfrowy ON/OFF":"Digital ON/OFF","Serwo 0–180°":"Servo 0–180°",
 "Własny — typ i zakres ręcznie":"Custom — type and range by hand",
 "Impuls — jeden komunikat na zboczu":"Impulse — a single message at the crossing",
 "Bramka — trzyma, dopóki próg jest przekroczony":"Gate — held while the threshold stays crossed",
 "Przełącznik — każde zbocze zmienia stan":"Latch — every crossing flips the state",
 "Impuls X ms — sam wraca do spoczynku":"Timed pulse — returns to rest on its own",
 // the three cards of the OSC output section: what · when · what happens when it goes down
 "Co leci do odbiornika":"What the receiver gets","Kiedy i jak długo":"When and for how long",
 "Gdy wyjście gaśnie":"When the output goes down","Zakres (min–max)":"Range (min–max)",
 "Zakres roboczy (min–max)":"Working range (min–max)","własny zakres roboczy":"custom working range",
 "Serwo 0–270°":"Servo 0–270°","Serwo 0–360°":"Servo 0–360°",
 "Serwo — szerokość impulsu 1000–2000 µs":"Servo — pulse width 1000–2000 µs",
 "Tempo i niezawodność":"Pace and reliability","Limit prędkości (jedn./s)":"Speed limit (units/s)",
 "Powtarzaj co (ms)":"Repeat every (ms)",
 "Odstęp to górna granica tempa — ile komunikatów na sekundę najwyżej. Limit prędkości działa w jednostkach wyjścia: dla serwa 0–180 wpisanie 90 znaczy „pełny przejazd nie szybciej niż w 2 sekundy” i chroni mechanikę przed skokiem. Powtarzanie to dolna granica: UDP nie potwierdza dostarczenia, więc bez niego nieruchomy kapsel oznacza zupełną ciszę, a zgubiony ostatni pakiet gestu zostawia odbiornik na złej wartości na zawsze. 0 = wyłączone (poniżej 100 ms silnik też traktuje jak 0).":"The interval is the upper bound on pace — at most this many messages per second. The speed limit works in output units: on a 0–180 servo, 90 means “full travel no faster than 2 seconds” and protects the mechanism from a jump. Repeating is the lower bound: UDP does not acknowledge delivery, so without it a motionless capsule means total silence, and a lost final packet of a gesture leaves the receiver at the wrong value for good. 0 = off (the engine also treats anything below 100 ms as 0).",
 "Ustawiasz typ i zakres sam. Profil to gotowa para dla typowych odbiorników.":"You set the type and the range yourself. A profile is a ready-made pair for the usual receivers.",
 "To decyduje, KIEDY komunikat leci — jaka wartość, ustala profil obok. Impuls X ms wraca do spoczynku sam, bez czekania, aż zejdziesz poniżej progu (minimum 20 ms).":"This decides WHEN a message is sent — WHICH value is the profile's job, next to it. A timed pulse returns to rest on its own, without waiting for you to drop back below the threshold (20 ms minimum).",
 "Jeden komunikat przy rozbrojeniu, wyłączeniu grupy OSC i rozłączeniu kapsla. Puste = nie parkuj — odbiornik zostaje tam, gdzie zastał go ostatni pakiet. Przełącznik i impuls parkują się same.":"One message on disarm, when the OSC group is switched off and when the capsule disconnects. Empty = do not park — the receiver stays wherever the last packet left it. A latch and a pulse park themselves.",
 "próg (zbocze)":"threshold (edge)","🎵 Nuta":"🎵 Note","MIDI panic — zatrzymano nuty":"MIDI panic — notes stopped",
 "Wyślij All Notes Off na wszystkich kanałach (zatrzymaj wiszące nuty)":"Send All Notes Off on every channel (stop hanging notes)",
 "Przełączyć na symulację?":"Switch to simulation?","Przełączyć na tryb LIVE?":"Switch to LIVE mode?",
 "Aplikacja zrestartuje się z danymi syntetycznymi — bez sprzętu i bez BLE. Wyzwalacze działają NAPRAWDĘ: klawisze, mysz, pad, MIDI i OSC lecą do systemu. Wszystkie grupy wyjść wystartują wyłączone.":"The app will restart with synthetic data — no hardware, no BLE. Triggers work FOR REAL: keys, mouse, pad, MIDI and OSC reach the system. Every output group will start switched off.",
 "Aplikacja zrestartuje się i połączy z fizycznym Triki przez BLE. Wysyłka klawiszy / MIDI będzie aktywna.":"The app will restart and connect to the physical Triki over BLE. Key / MIDI output will be active.",
 "Przełącz i zrestartuj":"Switch & restart","Anuluj":"Cancel","Potwierdź":"Confirm","Uwaga":"Notice",
 "Przełączam na symulację…":"Switching to simulation…","Przełączam na tryb LIVE…":"Switching to LIVE mode…",
 "Czekam na ponowne połączenie…":"Waiting to reconnect…","Nie udało się przełączyć trybu.":"Could not switch the mode.",
 "Usunąć kapsel?":"Remove this capsule?","Nie można usunąć ostatniego kapsla.":"The last capsule cannot be removed.",
 "Usunąć preset osi?":"Delete axis preset?",
 "Brak nagranych próbek. Kliknij „Nagrywaj CSV”, wykonaj ruch, potem „Pobierz”.":"No samples recorded. Click “Record CSV”, make a move, then “Download”.",
 "inspektor urządzenia":"device inspector",
 // the claim under the wordmark — kept word for word in step with the project page's header
 "Skumaj swój Triki z komputerem":"Make your Triki go from Ribbit to Bit","Wszystkie kapsle — ściąga":"All capsules — cheat sheet","mapowania + aktywacje na żywo (podgląd dla grającego) · koło wyboru pokazuje się tu i w nakładce na czas wybierania":"mappings + live activations (preview for the player) · the selection wheel appears here and in the overlay for as long as you are choosing","🪟 Otwórz w oknie":"🪟 Open in window","Mapowania":"Mappings","Dodaj kapsel":"Add a capsule","Dodaj pierwszy kapsel":"Add the first capsule","łączę…":"connecting…","połączono":"connected","rozłączono":"disconnected","SYMULACJA — dane syntetyczne":"SIMULATION — synthetic data","⚠ SYMULACJA":"⚠ SIMULATION",
 "Okno":"Window","⏸ Pauza":"⏸ Pause","▶ Wznów":"▶ Resume","Wyczyść":"Clear",
 "Nagrywaj CSV":"Record CSV","⏹ Zatrzymaj nagrywanie":"⏹ Stop recording","Pobierz":"Download",
 "Orientacja 3D":"3D orientation","Filtr (akcel+żyro)":"Filter (accel+gyro)","Akcel (CH3-5)":"Accel (CH3-5)","Żyro (CH0-2)":"Gyro (CH0-2)",
 "Wyśrodkuj":"Recenter","wygładź":"smooth","pochylenie":"tilt","· obrót":"· rotation",
 // manual control of the simulated capsule (virtual puck)
 "Steruj ręcznie":"Take control","Wróć do animacji":"Back to the animation",
 "Chwyć kapsel myszą — testuj wyzwalacze bez sprzętu":"Grab the capsule with the mouse — test triggers with no hardware",
 "Wyłącz sterowanie ręczne i wróć do animacji":"Switch manual control off and go back to the animation",
 "Przycisk kapsla":"Capsule button",
 "Trzymaj przycisk":"Hold button","Puść przycisk":"Release button","Edytuj kapsel…":"Edit capsule…","Trzymaj przycisk / Puść przycisk.":"Hold button / Release button.","Przełącznik: pierwsze kliknięcie wciska przycisk kapsla i go zostawia, drugie puszcza. W tym czasie ręka jest wolna, więc możesz pochylać kulą albo klikać w grze. Puszczają go też „Przycisk kapsla”, „Kliknij”, spacja i koniec sterowania.":"A toggle: the first click presses the capsule button and leaves it down, the second releases it. Your hand is free meanwhile, so you can tilt the sphere or click in the game. “Capsule button”, “Tap”, Space and ending manual control release it too.","Wygląd i edycja kapsla":"Capsule look and editing",
 "Kliknij, a kapsel trzyma przycisk wciśnięty, aż klikniesz drugi raz. Ręka jest wolna: możesz pochylać kulą albo klikać w grze.":"Click and the capsule keeps its button pressed until you click again. Your hand is free: tilt the sphere or click in the game.",
 "Przytrzymaj myszą, a kapsel trzyma wciśnięty przycisk tak długo, jak długo trzymasz. Spacja robi to samo.":"Hold it with the mouse and the capsule keeps its button pressed for as long as you hold. Space does the same.",
 "Kliknij":"Tap",
 "Krótkie stuknięcie przycisku kapsla. Tego potrzebują tryby koła wyboru, w których wybiera się kliknięciem.":"A short tap of the capsule button. This is what the radial menu's click modes need.",
 "Przycisk kapsla i „Kliknij”.":"The capsule button and “Tap”.",
 "Pierwszy trzyma przycisk tak długo, jak długo trzymasz mysz, drugi stuka nim krótko. Koło wyboru w trybie „trzymaj i puść” otwiera się pierwszym, a tryby klikane („kliknij”, „pochyl i kliknij”, „krokowy”) obsługuje drugi. Pochylenie zostaje tam, gdzie je zostawisz, więc możesz najpierw wycelować kulą, a dopiero potem sięgnąć po przycisk.":"The first holds the button for as long as you hold the mouse, the second taps it briefly. The radial menu's “hold and release” mode opens with the first one; the click modes (“click”, “lean and click”, “step”) run on the second. The tilt stays where you leave it, so you can aim with the sphere first and reach for the button afterwards.",
 "— koniec. Spacja i strzałki działają naraz, więc tak zrobisz pełny gest koła jedną ręką.":"— done. Space and the arrows work at the same time, so this is how you do the whole radial-menu gesture with one hand.",
 // Jedyne wystąpienie w całym panelu (pogrubiony klawisz w „Jak sterować?"), więc klucz nie ma
 // czego przetłumaczyć przypadkiem. Zostawał po angielsku jako „spacja" od zawsze.
 "spacja":"space",
 "Pady są wyłączone.":"The pads are off.",
 "Po włączeniu zagrasz od razu: rusz kapslem albo przeciągnij palcem lub myszą po padzie.":"Once on, you can play right away: move the capsule or drag a finger or the mouse across the pad.",
 "Włącza pady, odblokowuje dźwięk w przeglądarce i włącza granie z ruchu kapsla na pierwszym padzie":"Switches the pads on, unlocks sound in the browser and turns on play-from-motion on the first pad",
 "Włącz pady":"Switch the pads on",
 // manual control lifted into its own movable in-app window (rf-14c)
 "Sterowanie ręczne kapslem":"Driving the capsule by hand",
 "Sterowanie ręczne kapslem — okienko, które można przeciągnąć":"Driving the capsule by hand — a window you can drag",
 "🗗 Okienko":"🗗 Window","⇱ Przypnij":"⇱ Pin back","⇱ Przypnij z powrotem":"⇱ Pin it back",
 "— sterowanie wyskakuje jako osobne okienko nad aplikacją: przeciągasz je za pasek, gdzie chcesz, i widzisz kapsel obok wyzwalaczy, podglądu krzyżaka albo listy MIDI.":"— the controls pop out as a separate window above the app: drag it by its bar wherever you like and watch the capsule next to your triggers, the d-pad preview or the MIDI list.",
 "wraca z kartą na jej miejsce; położenie okienka jest zapamiętywane.":"puts the card back where it belongs; the window position is remembered.",
 "Otwórz sterowanie w osobnym okienku, które można przeciągnąć po ekranie":"Open the controls in a separate window you can drag around the screen",
 "Przypnij kartę z powrotem na jej miejsce":"Pin the card back where it belongs",
 "Koniec sterowania ręcznego — kapsel wraca do własnego ruchu":"End manual control — the capsule goes back to its own movement",
 "Orientacja 3D jest teraz w osobnym okienku":"3D orientation is in a separate window now",
 "Przeciągnij je za pasek tam, gdzie potrzebujesz — albo przypnij z powrotem tutaj.":"Drag it by its bar wherever you need it — or pin it back here.",
 "RĘCZNIE":"BY HAND","Wypoziomuj":"Level it","Koniec":"Done",
 "Skąd bierze się ruch kapsla":"Where the capsule's movement comes from",
 "ruch: ręcznie":"moved by hand","ruch: animacja":"moved by animation","ruch: kapsel":"moved by capsule",
 "brak sygnału":"no signal","kapsel śpi":"capsule asleep",
 "Kapsel prowadzony myszą/klawiaturą — pakiety są prawdziwe":"Capsule driven by mouse/keyboard — the packets are real",
 "Symulacja porusza kapslem sama — kliknij „Steruj ręcznie”, żeby przejąć":"The simulation moves the capsule on its own — click “Take control” to take over",
 "Ruch z prawdziwego kapsla przez Bluetooth":"Movement from a real capsule over Bluetooth",
 "Nic nie płynie — kapsel jest szukany albo uśpiony":"Nothing is arriving — the capsule is being searched for or asleep",
 "Kapsel śpi — oszczędza baterię":"The capsule is asleep — saving battery",
 "Ustaw kapsel płasko i wyzeruj obrót (klawisz 0)":"Lay the capsule flat and zero the rotation (key 0)",
 "Koniec sterowania ręcznego — kapsel wraca do własnego ruchu (Esc)":"End manual control — the capsule goes back to its own movement (Esc)",
 "chwyć kulę — pochyl · chwyć literę osi — zakręć wokół niej · Ctrl — co 5°":"grab the sphere — tilt · grab an axis letter — turn about it · Ctrl — 5° steps",
 "Litery osi to uchwyty.":"The axis letters are handles.",
 "Podgląd „Filtr” a osie.":"The “Filter” preview and the axes.",
 "Kapsel obraca się dokładnie wokół chwyconej litery, ale litery mogą lekko odjechać: czujnik nie widzi obrotu wokół pionu, więc podgląd odtwarza go z żyroskopu. Prawdziwy kapsel zachowuje się tak samo. Chcesz, żeby stały jak wryte — przełącz podgląd na „Żyro”.":"The capsule turns about exactly the letter you grabbed, but the letters may wander a little: the sensor cannot see turn about the vertical, so the preview rebuilds it from the gyro. A real capsule behaves the same way. If you want them nailed down, switch the preview to “Gyro”.",
 "Prawy przycisk":"Right button",
 "— skrót na obrót wokół pionu, bez celowania w literę: prowadź rękę po okręgu wokół środka kuli.":"— a shortcut for turning about the vertical without aiming at a letter: lead your hand around the centre of the sphere.",
 "Jak sterować?":"How do I drive it?",
 "Lewy przycisk — pochylasz.":"Left button — you tilt it.",
 "Od siebie: dalsza krawędź kapsla idzie w dół, do siebie: w górę. Na boki: przechył lewo/prawo. Możesz go przewracać bez końca — nie ma martwego punktu.":"Away from you: the capsule's far edge goes down; towards you: up. Sideways: roll left/right. You can keep rolling it over — there is no dead spot.",
 "Prawy przycisk — kręcisz jak pokrętłem.":"Right button — you turn it like a knob.",
 "Kółko myszy — obrót co 6°":"Mouse wheel — rotate in 6° steps",
 "(z Shiftem co 18°). Szybko zakręć i puść: kapsel kręci się dalej i wyhamowuje.":"(18° with Shift). Spin it fast and let go: the capsule keeps turning and winds down.",
 "Klawiatura":"Keyboard",
 "(kliknij kulę): strzałki — pochylanie,":"(click the sphere): arrows — tilt,",
 "— obrót,":"— rotate,","— przycisk kapsla,":"— capsule button,","— wypoziomuj,":"— level it,","— koniec.":"— done.",
 "— krok co 5° (obrót co 15°).":"— in whole 5° steps (15° for rotation).",
 "— ćwierć prędkości na ostatnie stopnie przed progiem.":"— a quarter of the speed for the last degrees before a threshold.",
 "z lewym przyciskiem — obrót zamiast pochylania.":"with the left button — rotate instead of tilt.",
 "Liczby ↕ ↔ ↻ pod kulą":"The ↕ ↔ ↻ numbers under the sphere",
 "można kliknąć i wpisać dokładny kąt (Enter zatwierdza, Esc anuluje).":"can be clicked and typed into for an exact angle (Enter confirms, Esc cancels).",
 "strzałki i Q/E — obracaj · spacja — przycisk · 0 — wypoziomuj · Esc — koniec":"arrows and Q/E — move it · space — button · 0 — level it · Esc — done",
 "Kliknij liczbę, aby wpisać dokładny kąt":"Click a number to type an exact angle",
 "wyzwalacze, MIDI i OSC działają naprawdę · klawisze i mysz nie wychodzą (symulacja)":"triggers, MIDI and OSC really run · keys and mouse do not leave the app (simulation)",
 "widok „Akcel” nie pokazuje obrotu":"the “Accel” view does not show rotation",
 "widok „Filtr” odtwarza kierunek — osie mogą odjeżdżać":"the “Filter” view rebuilds direction — the axes can wander",
 "podgląd „Żyro” — wiernie trzyma osie pod ręką":"“Gyro” preview — holds the axes true under the hand",
 "Pokaż wiernie":"Show it true",
 "Przełącz podgląd tak, aby wiernie pokazywał obrót kapsla":"Switch the preview so it shows the capsule turning faithfully",
 "Orientacja 3D — w symulacji można chwycić kapsel myszą i sterować nim ręcznie":"3D orientation — in simulation you can grab the capsule with the mouse and drive it by hand",
 "Sterowanie ręczne działa w trybie symulacji":"Manual control works in simulation mode",
 "Nie udało się włączyć sterowania ręcznego.":"Could not switch manual control on.",
 "Utracono połączenie z serwerem — koniec sterowania ręcznego.":"Lost the connection to the server — manual control is off.",
 "Serwer nie odpowiada — sterowanie ręczne niedostępne.":"The server is not answering — manual control is unavailable.",
 "tryb: FILTR":"mode: FILTER","yaw względny":"relative yaw","○ szukam urządzenia…":"○ searching for device…","uśpiony":"asleep",
 "łączę z kapslem":"connecting to capsule","brak połączenia z kapslem":"no connection to the capsule","oszczędzanie baterii":"battery saving","szukam…":"searching…",
 "Kanały 0–2":"Channels 0–2","⌖ klik":"⌖ click",
 "Kanały 3–5":"Channels 3–5",
 "(brak danych filtra — czekam na pakiety)":"(no filter data — waiting for packets)","(brak naciśnięć w oknie)":"(no presses in window)",
 "Pochylenie":"Tilt","Pitch":"Pitch","Roll":"Roll","Obrót":"Rotation","Mapowanie":"Mapping","📡 Czujnik":"📡 Sensor","🔌 Połączenie":"🔌 Connection",
 "Czujnik":"Sensor","Połączenie":"Connection","Sterowanie ruchem":"Motion control",
 "MIDI / OSC":"MIDI / OSC",
 "surowe odczyty czujnika (LSB) · auto-detekcja grawitacji/ruchu":"raw sensor counts (LSB) · auto-detect gravity/motion",
 "● grawitacja/offset":"● gravity/offset","– spoczynek":"– at rest","↻ RUCH":"↻ MOTION",
 "Akcel · Pitch (przód/tył)":"Accel · Pitch (fwd/back)","odwróć":"invert",
 "Akcel · Roll (lewo/prawo)":"Accel · Roll (left/right)","Akcel · Oś kapsla (pion)":"Accel · Capsule axis (vertical)",
 "Żyro · oś Pitch":"Gyro · Pitch axis","Żyro · oś Roll":"Gyro · Roll axis","Żyro · Twist (obrót)":"Gyro · Twist (rotation)",
 "Czułość filtra (gładko ↔ ostro)":"Filter sensitivity (smooth ↔ sharp)",
 "włącz":"enable",
 "przód/tył":"fwd/back","w bok":"sideways",
 // which capsule everything below is being set for
 // („Aktualnie edytowany:" i jego dymek zdjęte 2026-08-30 razem z paskiem `.tab-owner`;
 //  „edytowany" ZOSTAJE — to plakietka na samej pigułce kapsla, `.dp-edited` w rf-11)
 "edytowany":"editing",
 // Sensor-tab guide (the rest of that sentence is built by _axT in rf-33b — no keys needed)
 "wyjściach":"outputs",
 "⚙ Dostrajanie osi (zaawansowane)":"⚙ Per-axis tuning (advanced)",
 // 2026-08-20: the block covers the four filter axes AND the six raw channels, so the guide text
 // changed with it. The keys are the WHOLE text node after whitespace normalisation.
 "— osobny tor dla każdej z czterech osi filtra 3D oraz dla każdego z sześciu surowych kanałów czujnika (akcelerometr, żyroskop): wygładzanie, punkt zerowy, martwa strefa, zakres i krzywa. Opis niżej, w sekcji „Dostrajanie sygnału — co pokazują dwa wykresy”.":"— a chain of its own for each of the four 3D-filter axes AND for each of the six raw sensor channels (accelerometer, gyroscope): smoothing, zero point, dead zone, range and curve. Described below, under “Signal tuning — what the two plots show”.",
 // the two live pictures under each tuned axis
 "kształt toru":"chain shape","na żywo":"live","wejście":"input","po torze":"after the chain",
 "(brak danych z kapsla)":"(no data from the capsule)",
 "Wszystko, co ustawiasz w zakładkach poniżej — osie 3D, wyzwalacze, sterowanie ruchem, MIDI/OSC — dotyczy tego kapsla. Kliknij inny, żeby edytować jego.":"Everything you set in the tabs below — 3D axes, triggers, motion control, MIDI/OSC — belongs to this capsule. Click another one to edit that one instead.",
 // per-axis tuning (opt-in block under the axis map)
 "wyłączone":"off","włączone, bez zmian":"on, nothing changed","wszystkie domyślne":"all at defaults",
 "włącz dostrajanie tej osi":"tune this axis","EMA (stałe)":"EMA (steady)","Adaptacyjne":"Adaptive",
 "Punkt zerowy (trym)":"Zero point (trim)","Pełne wychylenie przy":"Full deflection at","Maksimum na wyjściu":"Output maximum","Krzywa (expo)":"Curve (expo)",
 "Przywróć domyślne dla tej osi":"Restore this axis to defaults",
 "Uspokaja oś, zanim cokolwiek ją przeskaluje. EMA = stałe opóźnienie. Adaptacyjne = mocno wygładza w spoczynku, prawie bez opóźnienia gdy naprawdę ruszasz. 0 ms = brak.":"Settles the axis before anything rescales it. EMA = constant lag. Adaptive = heavy smoothing at rest, almost no lag once you really move. 0 ms = off.",
 "Przesuwa punkt zerowy osi — gdy trzymasz kapsel pod naturalnym kątem i chcesz, żeby to było „zero”":"Shifts the axis zero — for when you hold the capsule at a natural angle and want that to read as zero",
 "Poniżej tej wartości oś raportuje 0 — gasi drżenie ręki. Reszta zakresu jest przeskalowana, więc pełne wychylenie nadal osiągasz.":"Below this the axis reports 0 — it kills hand tremor. The rest of the range is rescaled, so full deflection is still within reach.",
 "Przy jakim wychyleniu oś ma osiągnąć maksimum. Mniej = czulej. Powyżej tej wartości oś się nasyca.":"How far you lean before the axis reaches its maximum. Less = more sensitive. Past it the axis saturates.",
 "Ile wynosi to maksimum na wyjściu. Para „pełne przy → maksimum” to całe mapowanie zakresu tej osi.":"What that maximum is on the output. The pair “full at → maximum” is this axis's whole range mapping.",
 "Kształt odpowiedzi. 1 = liniowo. Powyżej 1 = precyzyjniej przy zerze, mocniej dopiero przy dużym wychyleniu. Poniżej 1 = odwrotnie.":"Shape of the response. 1 = linear. Above 1 = finer near zero, strong only at a big lean. Below 1 = the other way round.",
 "🎨 Presety osi:":"🎨 Axis presets:","🧲 Kopiuj osie 3D z:":"🧲 Copy 3D axes from:","⤵ Wczytaj z Triki":"⤵ Load from Triki","— inny Triki —":"— another Triki —","— wybierz —":"— choose —",
 "Wczytaj":"Load","Zapisz":"Save","Przyciski / status (0x21)":"Buttons / status (0x21)",
 "naciśnij / stuknij kapsel":"press / tap the capsule","Surowy strumień (hex)":"Raw stream (hex)","dowód, że dane są prawdziwe":"proof of real data",
 "ostatni IMU:":"last IMU:","Jak skonfigurować wyzwalacze?":"How to set up triggers?","Co to jest wyzwalacz?":"What is a trigger?",
 "obróć kapsel → strzałka w prawo":"rotate the capsule → right arrow","). Klikasz":"). You click","+ Nowy wyzwalacz":"+ New trigger","i ustawiasz 4 rzeczy poniżej.":"and set the 4 things below.",
 "1. Źródło — skąd brać sygnał":"1. Source — where the signal comes from","Filtr 3D":"3D filter","— gotowe wielkości:":"— ready-made values:",
 "Czułość i kierunek (znak) osi":"Axis sensitivity and direction (sign)","dostosujesz w zakładce":"adjust in tab",
 "Przycisk":"Button","— fizyczny przycisk na kapslu. Działa":"— physical button on the capsule. Works","od razu":"right away","Trzymaj (ms)":"Hold (ms)",
 "Oś (CH)":"Axis (CH)","— surowy kanał czujnika (dla zaawansowanych).":"— raw sensor channel (advanced).","2. Warunek i próg — kiedy ma zadziałać":"2. Condition and threshold — when it fires",
 "Ustaw":"Set","kiedy":"when","sygnał uruchamia akcję, np.":"the signal triggers the action, e.g.","pochylenie > 30":"tilt > 30","Podgląd na żywo":"Live preview",
 "pokazuje wartość i poziomą":"shows the value and a horizontal","linię progu":"threshold line","Warunki — jak działają (ważne)":"Conditions — how they work (important)",
 "Wyzwalacz może mieć":"A trigger can have","kilka warunków":"several conditions","Warunek 1":"Condition 1","źródło + porównanie + próg":"source + comparison + threshold",
 "obrót < -50":"rotation < -50","jej":"its","warunek jest właśnie spełniony.":"condition is currently met.","Warunek spełniony":"Condition met",
 "Łączenie":"Combining","ORAZ":"AND","= wszystkie muszą być spełnione naraz;":"= all must be met at once;","LUB":"OR","Akcja odpala dopiero, gdy":"The action fires only when",
 "cały":"the whole","ile warunków jest teraz spełnionych":"how many conditions are met now","3. Akcja — co ma się stać":"3. Action — what should happen",
 "Klawisz":"Key","— spacja, strzałki,":"— space, arrows,","Mysz":"Mouse","— klik / scroll / ruch (":"— click / scroll / move (","Makro":"Macro",
 "Punkt na ekranie":"Point on screen",
 ": klik w konkretnym miejscu, a nie tam, gdzie akurat stoi kursor. Przycisk „Punkt na ekranie…” otwiera panel: X i Y (albo „Wskaż kursorem” z odliczaniem), przycisk lewy/prawy/środkowy, a niżej jeden klik, dwuklik, przytrzymanie przez zadany czas albo trzymanie tak długo, jak trwa warunek. Procenty przeżyją wysłanie zestawu komuś o innym ekranie, piksele nie. Zapis:":
   ": a click at a specific place, not wherever the cursor happens to be. The “Point on screen…” button opens a panel: X and Y (or “Point the cursor” with a countdown), the left/right/middle button, and below that one click, a double-click, a press held for a given time, or a press held for as long as the condition lasts. Percentages survive sharing a set with somebody whose screen is a different size; pixels do not. Written as:",
 "Kontroler":"Controller",
 "— przycisk wirtualnego pada Xbox (":"— a button on the virtual Xbox pad (",
 "): A/B/X/Y, LB/RB, spusty LT/RT, krzyżak, Start, Back, klik drążkiem. Takie mapowania ustawiasz w zakładce „Kontroler”: klikasz przycisk na rysunku pada, a pod spodem otwiera się jego panel. Wszystkie razem stoją w spisie „Mapowania pada”, który karta pokazuje, gdy żadna część nie jest wybrana. To pad tego kapsla, ten sam, którym steruje ruch. Domyślnie dwa kapsle to dwa kontrolery, czyli dwaj gracze; jeden gracz obiema rękami ustawia w sekcji „Kontrolery” wspólny kontroler, a jego numer widać wtedy na rysunku pada w miejscu logo. Wymaga sterownika ViGEmBus — bez niego reguła nie wysyła nic i mówi o tym wprost, bo przycisk pada nie ma czym się zastąpić.":"): A/B/X/Y, LB/RB, the LT/RT triggers, the d-pad, Start, Back, stick clicks. You set these mappings up in the “Controller” tab: click a button on the pad drawing and its panel opens underneath. All of them together are listed under “Pad mappings”, which the card shows whenever no part is selected. It is this capsule's pad, the same one the motion drives. By default two capsules are two controllers, so two players; one player using both hands picks a shared controller under “Controllers”, and its number then shows on the pad drawing where the logo goes. Needs the ViGEmBus driver — without it the rule sends nothing and says so, because a pad button has nothing to fall back to.",
 "— kilka klawiszy po kolei z odstępami (":"— several keys in sequence with delays (","4. Zachowanie — jak ma reagować":"4. Behaviour — how it reacts",
 "Jednorazowo":"Once","— raz na każde przekroczenie.":"— once per crossing.","Ciągłe":"Continuous","— powtarza co X ms, dopóki warunek spełniony.":"— repeats every X ms while the condition holds.",
 "Przytrzymaj":"Hold","— trzyma klawisz, dopóki warunek spełniony (ruch w grach).":"— holds the key while the condition holds (movement in games).",
 "Sekwencja / wieloklik":"Sequence / multi-click","podwójny / potrójny klik":"double / triple click","przycisku w zadanym odstępie.":"of the button within a set interval.",
 // WARSTWY MAPOWAŃ — poradnik zakładki Mapowanie. Fragmenty są krótkie, bo walker tłumaczy WĘZŁY
 // tekstowe, a każdy <b> w akapicie rozcina je na osobne klucze.
 "5. Warstwy — kilka kompletów wyzwalaczy na jednym kapslu":"5. Layers — several sets of triggers on one capsule",
 "Jeden kapsel może mieć do":"One capsule can hold up to","czterech warstw":"four layers",
 ": inne wyzwalacze w grze, inne przy filmie. Każda reguła ma pole":": one set for a game, another for a film. Every rule has a",
 "w sekcji „Zachowanie”.":"field in the “Behaviour” section.",
 "(domyślnie) — reguła działa w każdej warstwie. Tak ma każda reguła napisana, zanim warstwy powstały, więc dotychczasowe zestawy zachowują się bez zmian.":"(the default) — the rule works in every layer. So does every rule written before layers existed, which is why the sets you already have behave exactly as before.",
 "Warstwa 1–4":"Layer 1–4",
 "— reguła nasłuchuje tylko wtedy, gdy ta warstwa jest aktywna. W pozostałych śpi dokładnie tak, jak wyłączona: puszcza trzymany klawisz i zeruje liczniki, więc przełączenie warstwy nigdy nie zostawi wciśniętego klawisza w grze. Na liście widać ją wtedy przygaszoną, z plakietką":"— the rule listens only while that layer is the active one. In the others it sleeps exactly like a switched-off rule: it lets go of the key it was holding and clears its counters, so switching layers can never leave a key held down in a game. The list shows it dimmed, with the plaque",
 "Warstwę przełączasz na dwa sposoby: paskiem":"There are two ways to switch: the strip",
 "„Warstwa: 1 2 3 4”":"“Layer: 1 2 3 4”",
 "nad listą (pojawia się, gdy któraś reguła używa warstw) albo":"above the list (it appears once some rule uses layers), or",
 "samym kapslem":"the capsule itself","— regułą z akcją":"— a rule whose action is",
 "(przełącz na stałe),":"(switch and stay),",
 "(następna warstwa, w której coś jest) lub":"(the next layer that has anything in it) or",
 "z zachowaniem":"with the behaviour",
 "(warstwa 2, póki trzymasz — jak Shift). Akcje warstwy nie wychodzą do systemu: nie naciskają żadnego klawisza i działają nawet przy wyłączonej grupie „Mapowanie”, żeby z warstwy zawsze dało się wrócić.":"(layer 2 while you hold it — like Shift). Layer actions never reach the operating system: they press no key at all and work even with the “Mapping” group switched off, so there is always a way back out of a layer.",
 // …i sam przełącznik: pasek nad listą, plakietka przy regule, pole w edytorze, szybki wybór akcji.
 "Warstwa:":"Layer:","Warstwa":"Layer","Warstwa mapowań":"Mapping layer","Zawsze":"Always",
 "Warstwa 1":"Layer 1","Warstwa 2":"Layer 2","Warstwa 3":"Layer 3","Warstwa 4":"Layer 4",
 "reguła spoza aktywnej warstwy śpi tak samo, jak wyłączona":"a rule outside the active layer sleeps exactly like a switched-off one",
 "Warstwy to kilka kompletów wyzwalaczy na jednym kapslu. „Zawsze” znaczy, że ta reguła działa w każdej z nich. Warstwę przełączasz paskiem nad listą albo regułą z akcją „Warstwa”.":"Layers are several sets of triggers on one capsule. “Always” means this rule works in all of them. You switch layers with the strip above the list, or with a rule whose action is “Layer”.",
 "🗂 Przełącz na warstwę 1":"🗂 Switch to layer 1","🗂 Przełącz na warstwę 2":"🗂 Switch to layer 2",
 "🗂 Przełącz na warstwę 3":"🗂 Switch to layer 3","🗂 Przełącz na warstwę 4":"🗂 Switch to layer 4",
 "🗂 Następna warstwa":"🗂 Next layer","🗂 Warstwa 2, póki trzymasz":"🗂 Layer 2 while held",
 // „Wybierz z domyślnych" — gotowe gesty w edytorze reguły (rf-12c + the row in rf-12) and their
 // paragraph in the guide. The names double as the rule's own label, so they have to read like one.
 "Gotowy gest":"Ready-made gesture","Wybierz z domyślnych…":"Pick from the defaults…",
 "wypełnia warunek i zachowanie, akcję dopisujesz sam":"fills in the condition and the behaviour; the action is yours to add",
 "Gotowy gest wypełnia warunek, próg i zachowanie. Akcję (klawisz albo przycisk pada) wybierasz sam, a wszystko możesz jeszcze poprawić.":"A ready-made gesture fills in the condition, the threshold and the behaviour. The action (a key or a pad button) is yours to pick, and all of it stays editable.",
 "Potrząśnięcie":"Shake","Strzela raz przy energicznym potrząśnięciu kapslem.":"Fires once when the capsule is shaken briskly.",
 "Odwrócenie do góry dnem":"Turned upside down",
 "Działa, gdy kapsel jest odwrócony dnem do góry przez chwilę.":"Works when the capsule is held upside down for a moment.",
 "Szybki obrót w prawo":"Quick turn to the right","Strzela raz przy szybkim obrocie kapsla w prawo.":"Fires once on a quick turn of the capsule to the right.",
 "Szybki obrót w lewo":"Quick turn to the left","Strzela raz przy szybkim obrocie kapsla w lewo.":"Fires once on a quick turn of the capsule to the left.",
 "Podwójne kliknięcie przycisku":"Double click of the button",
 "Dwa kliknięcia przycisku kapsla w niecałą sekundę.":"Two clicks of the capsule button inside a second.",
 "Długie przytrzymanie przycisku":"Long press of the button",
 "Działa dopiero po przytrzymaniu przycisku kapsla przez 0,6 s.":"Works only after the capsule button has been held for 0.6 s.",
 // …and the paragraph the guide gives them. Written as three text nodes around two <b> fragments
 // that are keys in their own right above („Gotowy gest", „Wirowanie (|żyro|)"), so the sentence
 // survives being bolded — the walker translates whole text nodes, never parts of one.
 "Gotowe gesty":"Ready-made gestures",
 
 ". Wybierasz z niej gest, a warunek, próg i zachowanie wypełniają się same, gotowe do poprawek. Zostaje Ci dopisać akcję, bo tego żaden szablon za Ciebie nie wie.":" list. Pick a gesture from it and the condition, the threshold and the behaviour fill themselves in, ready to be tweaked. All that is left is the action, because no template can know that one for you.",
 "Do wyboru: potrząśnięcie, odwrócenie kapsla dnem do góry, szybki obrót w prawo i w lewo, podwójne kliknięcie przycisku i długie przytrzymanie przycisku.":"On offer: a shake, the capsule turned upside down, a quick turn right and left, a double click of the button and a long press of the button.",
 "Potrząśnięcie korzysta z metryki":"The shake uses the",
 ", czyli energii ruchu. To nie jest kąt: liczy się w surowych LSB (131 LSB to 1°/s) i nie zmienia się razem z czułością osi, więc potrząśnięcie znaczy to samo na każdym ustawieniu.":" metric, that is the energy of the motion. It is not an angle: it counts in raw LSB (131 LSB is 1°/s) and it does not move with the axis sensitivity, so a shake means the same thing on any setting.",
 "6. Uruchomienie i bezpieczeństwo":"6. Activation and safety","Klawisze idą do Windows":"Keys go to Windows","tylko gdy grupa „Mapowanie” jest włączona":"only when the “Mapping” group is enabled",
 "(Testuj) wysyła do":"(Test) sends to","aktywnego okna":"the active window","Presety wyzwalaczy":"Trigger presets","zapisują całe zestawy reguł (np. osobne na każdą grę).":"save whole rule sets (e.g. per game).",
 "Od czego zacząć?":"Where to start?","Źródło":"Source","Filtr 3D → Pochylenie":"3D filter → Tilt",". Przechyl kapsel — postać idzie.":". Tilt the capsule — the character moves.",
 // PORADNIK PISANIA MAKR (macroGuideHtml w rf-12). Ten sam tekst stoi w edytorze wyzwalacza i
 // w karcie koła wyboru, więc pary są tu raz. Całymi zdaniami, bo walker podmienia węzeł tekstowy
 // w całości; próbki składni (<code>) zostają nietłumaczone — `wait 100` znaczy to samo wszędzie.
 // Test tests/test_wheel.py pilnuje, że KAŻDE zdanie poradnika ma tu swoją parę.
 "Jak pisać makra ręcznie?":"How do I write macros by hand?",
 // — 2026-08-31: poradnik makr wyprowadzony z miejsc pracy na spód zakładki „Informacje" modułu
 //   (rf-49m). Tam, gdzie stał, zostaje jednolinijkowy odsyłacz z przyciskiem.
 "Składnię opisuje poradnik":"The syntax is explained in the guide",
 "Jak pisać makra ręcznie":"How do I write macros by hand",
 "— stoi na spodzie zakładki":"— it sits at the bottom of this module's",
 "tego modułu.":"tab.",
 "Otwórz poradnik":"Open the guide",
 "Z czego składa się makro":"What a macro is made of",
 "Makro to kilka kroków wykonywanych po kolei, od lewej do prawej. Kroki oddzielasz średnikiem albo nową linią, a spacje wokół kroku nie mają znaczenia.":
   "A macro is several steps carried out one after another, left to right. You separate them with a semicolon or a new line, and spaces around a step make no difference.",
 "Klawisz lub akcja":"A key or an action",
 "Jeden krok wciska i od razu puszcza.":"One step presses it and lets go straight away.",
 "Odstęp w milisekundach, zanim ruszy następny krok.":"A gap in milliseconds before the next step starts.",
 "Przytrzymanie":"Holding down",
 "Wciska i trzyma, dopóki nie puści tego osobny krok.":"Presses and keeps holding until a separate step lets it go.",
 "Puszczenie":"Letting go",
 "Puszcza klawisz przytrzymany wcześniej.":"Releases a key that was held down earlier.",
 "Dioda kapsla":"The capsule's LED",
 "Zapala albo gasi diodę w samym kapslu.":"Lights the LED in the capsule itself, or puts it out.",
 "Limity":"Limits",
 "Całe makro: najwyżej 500 znaków.":"The whole macro: 500 characters at most.",
 "Jeden krok: najwyżej 40 znaków.":"A single step: 40 characters at most.",
 "Pauza: od 0 do 10000 ms, czyli najwyżej dziesięć sekund. Dłuższa liczba jest przycinana do tego.":
   "A pause: from 0 to 10000 ms, so ten seconds at the outside. A longer number is cut down to that.",
 "Wielkość liter w słowach kluczowych nie ma znaczenia, a w nazwie klawisza zostaje taka, jaka została wpisana.":
   "Upper and lower case make no difference in the keywords, and in a key's name they stay exactly as typed.",
 "Pusty krok i podwójny średnik są pomijane bez ostrzeżenia.":"An empty step and a doubled semicolon are skipped without a word.",
 "Trzy przykłady, od najprostszego":"Three examples, simplest first",
 "Kopiuj, odczekaj chwilę, wklej.":"Copy, wait a moment, paste.",
 "Trzymaj shift przez pół sekundy i wciśnij w środku klawisz w.":"Hold shift for half a second and press w in the middle of it.",
 "Przycisk pada, chwila przerwy, klik w samym środku ekranu.":"A pad button, a short gap, a click in the very middle of the screen.",
 "Pułapki":"Traps",
 "Kroki „down” i „up” bez nazwy klawisza to zwykłe strzałki w dół i w górę, a nie przytrzymanie.":
   "The steps “down” and “up” with no key name after them are simply the down and up arrows, not a hold.",
 "Naciśnięcie przycisku pada musi TRWAĆ. Gra odpytuje kontroler kilkadziesiąt razy na sekundę i naciśnięcie krótsze niż jedno takie pytanie potrafi jej umknąć, więc zamiast jednego kroku napisz przytrzymanie, krótką pauzę i puszczenie.":
   "A pad button press has to LAST. A game asks the controller a few dozen times a second, and a press shorter than the gap between two of those questions can be missed entirely — so instead of one step, write a hold, a short pause and a release.",
 "Makro wykonuje się w całości i nie da się go przerwać w połowie. Przerywa je dopiero wstrzymanie kapsla albo zamknięcie aplikacji, a wszystko, co zostało przytrzymane, jest wtedy puszczane.":
   "A macro runs all the way through and cannot be stopped half-way. Only pausing the capsule or closing the app cuts it short, and anything left held down is released when that happens.",
 "Makro jest polem ryzykownym przy wczytywaniu cudzego zestawu: tryb bezpieczny je pomija, bo cudza sekwencja może wcisnąć dowolny skrót w Twoim systemie.":
   "A macro counts as a risky field when somebody else's setup is loaded: safe mode drops it, because another person's sequence can press any shortcut at all on your machine.",
 "W kole wyboru krok „layer:” w makrze działa, choć ta sama akcja wpisana jako pojedyncza akcja wycinka jest odrzucana przy zapisie.":
   "In the selection wheel a “layer:” step inside a macro does work, even though the same action written as a slice's single action is refused when saved.",
 // KOŁO WYBORU (rf-46). Zdania składane w locie (opis pod listą, sekundy, liczby wycinków) budują
 // się przez _gl() w samym module — tutaj stoi to, co jest w HTML-u karty i w atrybutach.
 "Koło wyboru":"Selection wheel",
 // Zwijana sekcja: podtytuł na pasku i plakietka ze stanem (tę drugą składa _gl() w rf-46).
 // GDZIE POKAZYWAĆ KOŁO — sekcja na dole karty: jeden wybór na CZTERY miejsca (przy kursorze,
 // w nakładkach, w obu, na środku ekranu), a pod nim ustawienia okienka. Motywy i „Przezroczystość"
 // mają klucze w rf-41 (RF_OVL_I18N dosypuje je do tego samego słownika), więc tu stoi tylko to,
 // czego tam nie ma. Zdanie pod segmentem składa _gl() w rf-46 (_whWhereNote), bo zmienia się
 // razem z wyborem.
 "Gdzie pokazywać koło":"Where to show the wheel",
 "Przy kursorze":"At the pointer",
 "W nakładkach":"In the overlays",
 "W obu":"In both",
 // CZWARTE MIEJSCE (2026-09-06). To NIE jest nowe okno: „Na środku ekranu" stawia dokładnie to samo
 // okienko, co „Przy kursorze" (wid „<kapsel>~kolo"), tylko nieruchomo i na środku ekranu zamiast
 // pod wskaźnikiem. Stąd jedno słowo różnicy w opisie („zawsze w tym samym miejscu"): reszta —
 // przezroczystość, styl okienka, bok liczony z „Wielkości koła" — działa tu tak samo.
 // Etykieta jest NAJDŁUŻSZA z czterech w obu językach, więc to ona rozstrzyga o szerokości segmentu.
 "Na środku ekranu":"In the middle of the screen",
 "Koło pokazuje się w okienku wokół wskaźnika myszy — tam, gdzie i tak patrzysz w chwili wyboru":
   "The wheel appears in a little window around the mouse pointer — where you are looking at the moment of choosing anyway",
 "Koło pokazuje się w nakładkach nad grą, tam gdzie je postawisz":
   "The wheel appears in the overlays over the game, wherever you have put them",
 "Koło pokazuje się jednocześnie przy kursorze i w nakładkach":
   "The wheel appears at the pointer and in the overlays at the same time",
 "Koło pokazuje się w okienku na środku ekranu — zawsze w tym samym miejscu, nieruchomo":
   "The wheel appears in a window in the middle of the screen — always in the same place, standing still",
 // STYL OKIENKA WRÓCIŁ DO KARTY KOŁA (2026-09-06), ale w sekcji „Gdzie pokazywać koło", a nie
 // w „Wyglądzie": styl należy do OKNA, więc stoi tam, gdzie się to okno w ogóle wybiera — i pokazuje
 // się dopiero wtedy, gdy wybrane miejsce jakieś okno ma. Miniaturki są WSPÓLNE z ekranem „Nakładka"
 // (.ovm-theme/.ovl-thumb), a nazwy pięciu wyglądów („Jasny", „Ciemny", „Sama treść", „Neon",
 // „Szkło") mają pary niżej — to te same napisy, więc nie dokładamy tu ani jednego.
 // ⚠️ „Motyw okienka" (klucz niżej) to POPRZEDNIE brzmienie tej samej etykiety, z czasów gdy wybór
 // stał w sekcji „Wygląd". Nowy wiersz mówi „Styl", bo tak nazywa tę rzecz zdanie-odsyłacz i ekran
 // „Nakładka"; ta sama angielska strona celowo, żeby jedno ustawienie nie miało dwóch brzmień.
 "Styl okienka":"Window look",
 "Styl okienka koła":"The wheel window's look",
 "Koło przy kursorze":"The wheel at the pointer",
 "Bok okienka w pikselach ekranu. Samo koło zajmuje około 88% tej wartości.":
   "The side of the window, in screen pixels. The wheel itself takes about 88% of it.",
 "Bez karty: nad grą zostaje samo koło":"No card: over the game there is only the wheel",
 "Jak mocno koło przygasa nad grą. 100% = pełna moc koloru.":
   "How far the wheel dims over the game. 100% = full strength.",
 "Czas przytrzymania":"Hold time",
 "Jak długo trzeba trzymać przycisk, zanim pokaże się koło. Krócej = szybciej, ale zwykłe kliknięcie łatwiej wtedy pomylić z otwarciem koła.":
   "How long the button has to be held before the wheel appears. Shorter is quicker, but an ordinary click is then easier to confuse with opening the wheel.",
 // Reszta podpowiedzi z karty koła (rf-46b): wszystkie stoją w atrybucie `title`, więc chodzi po
 // nich ten sam walker co po tekście — brakowało wyłącznie par.
 "Czym otwierasz koło i czym zatwierdzasz wybór. Wybierz ruch, który Twojej ręce przychodzi najłatwiej.":
   "How you open the wheel and how you confirm the pick. Choose the motion your hand finds easiest.",
 "Ile trzeba wytrzymać na wybranym wycinku (albo odczekać po ostatnim kliknięciu), żeby wybór poszedł do systemu":
   "How long you have to stay on the chosen slice (or wait after the last click) before the pick goes to the system",
 "Jak duży jest środek koła, w którym nic nie jest wskazane":
   "How big the middle of the wheel is — the part where nothing is being pointed at",
 "Jak długo trzeba wskazywać wycinek z podmenu, zanim otworzy się ono samo. Dotyczy trzymanego przycisku — tam nie ma czym kliknąć.":
   "How long you have to point at a slice with a submenu before it opens on its own. This is for the held button — there is nothing to click with there.",
 "Pod ikoną wycinka rysuje się kółko w jego kolorze. Na kole bez kolorów to tylko szare monety, dlatego domyślnie wyłączone.":
   "A dot in the slice's colour is drawn under its icon. On a wheel with no colours those are just grey coins, which is why it is off by default.",
 // Trzy sposoby pokazywania podmenu (WHEEL_SUB w rf-46): etykiety mają EN w samej tablicy,
 // podpowiedzi pod nimi nie — stąd pary.
 "Dzieci wchodzą w miejsce rodzica, na tym samym pierścieniu. Zawsze się mieści, bo koło nie rośnie.":
   "The children take the parent's place on the same ring. It always fits, because the wheel never grows.",
 "Dzieci wychodzą krótkim łukiem tuż nad rodzicem. Widać całą drogę naraz, więc łatwiej wrócić.":
   "The children come out as a short arc just above the parent. The whole path is visible at once, so stepping back is easier.",
 "Dzieci obejmują całe koło drugą obręczą. Duże cele — dla rąk, którym trudno trafić w wąski łuk.":
   "The children wrap the whole wheel in a second ring. Big targets — for hands that struggle with a narrow arc.",
 "Dodaj wycinek":"Add a slice","Usuń ten wycinek":"Remove this slice","Szybki wybór akcji":"Quick action pick",
 "nazwa, np. Apteczka":"name, e.g. Medkit","akcja, np. 1, mouse:left, pad:a":"action, e.g. 1, mouse:left, pad:a",
 "podgląd":"preview",
 "Koło wyboru — przytrzymaj przycisk kapsla, pochyl, puść":
   "Selection wheel — hold the capsule button, lean, let go",
 "koło wyboru":"selection wheel",
 // Akapit „8. Koło wyboru" w poradniku Mapowania (rf-34). Dwa węzły wokół <b>koło wyboru</b>
 // — do 2026-09-02 zostawały po polsku, bo par nie było wcale.
 "8. Koło wyboru":"8. The selection wheel",
 "Kapsel ma jeden przycisk, a akcji zwykle potrzeba więcej — od tego jest":"The capsule has one button and you usually need more actions than that — hence the",
 ": przytrzymujesz przycisk, pochylasz kapsel w stronę wycinka i puszczasz. Ma własny ekran w nawigacji, a wszystko o nim stoi w jego zakładce":": hold the button, tilt the capsule towards a slice and let go. It has its own entry in the navigation, and everything about it lives in that entry's tab",
 "Koło potrzebuje co najmniej dwóch wycinków, żeby dało się je włączyć.":
   "The wheel needs at least two slices before it can be switched on.",
 // KOŁO WYBORU — przebudowana karta (2026-08-26): scena podglądu po lewej, zwijane sekcje po
 // prawej. Zdania składane w locie (opisy pod kontrolkami, dziennik, sekundy) budują się przez _gl()
 // w samych modułach rf-46*; tutaj stoi to, co jest w HTML-u karty i w atrybutach.
 // PUSTE POLE (2026-08-27). Przycisk pod listą wycinków i jego opis; plakietka w wierszu, treść
 // środka koła i komunikaty sceny składają się przez _wheelT() w modułach rf-46*, więc kluczy tu
 // nie mają.
 "puste pole":"empty slice",
 "Dodaj puste pole: wycinek bez akcji. Wybranie go nic nie wysyła, koło po prostu się zamyka. To bezpieczne miejsce na puszczenie przycisku, gdy ręka zjedzie w bok.":
   "Add an empty slice: one with no action. Picking it sends nothing, the wheel simply closes. That is a safe place to let the button go when your hand drifts.",
 "Wycinki i podmenu":"Slices and submenus","Podmenu":"Submenus",
 "Wygląd":"Look","Sterowanie":"How it is worked","Zapis":"Saving",
 // PRESETY — całe koło pod nazwą (sekcja, która zastąpiła „Zestawy startowe", 2026-08-26).
 // ⚠️ SEKCJI „PRESETY" W KARCIE KOŁA NIE MA OD 2026-09-02 (audyt UX #25/#26): jej siatka kafli
 // pokazywała te same presety, co zakładka „Biblioteka" modułu, tylko z inną plakietką i innym
 // kompletem akcji. Klucze jej przycisków i zdań usunięte razem z nią; napisy, które zostały
 // (nagłówek „Presety", pole importu), mają pary niżej. Samo słowo „Presety" zostaje — czyta je
 // jeszcze kilka innych miejsc panelu.
 "Presety":"Presets",
 "Wklej JSON koła albo preset z forum. Preset wyląduje w zakładce „Biblioteka”, koło wczytasz od razu.":
   "Paste a wheel's JSON or a preset from the forum. A preset lands in the “Library” tab, a wheel loads straight away.",
 "Miejsce":"Place",
 "Wielkość koła":"Wheel size",
 "Średnica koła w pikselach ekranu. Jedna liczba na wszystkie miejsca: okienko przy kursorze, nakładkę nad grą i podgląd obok.":
   "The wheel's diameter in screen pixels. One number for every place: the window at the pointer, the overlay over the game and the preview beside this.",
 "Odstęp wycinków":"Gap between slices",
 "Przerwa między sąsiednimi wycinkami, w stopniach. Zero = wycinki stykają się, tak jak koło wyglądało wcześniej.":
   "The gap between two neighbouring slices, in degrees. Zero = the slices touch, which is how the wheel used to look.",
 "Zaokrąglenie rogów":"Rounded corners",
 "Promień zaokrąglenia narożników wycinka. Działa tylko wtedy, gdy wycinki mają odstęp.":
   "How far a slice's corners are rounded. It only shows when the slices have a gap between them.",
 "Wielkość pisma":"Lettering size",
 "Nazwy wycinków, ikony i treść środka naraz — w procentach tego, co rysunek policzy sam. Podnieś, gdy czytasz koło z drugiego końca pokoju.":
   "The slice names, the icons and the middle all at once — as a percentage of what the drawing works out for itself. Raise it when you read the wheel from across the room.",
 "Kolorowe kółka pod ikonami":"Coloured discs under the icons",
 "Motyw okienka":"Window look",
 // PIĘĆ WYGLĄDÓW OKIENKA KOŁA (2026-08-27; „Neon" i „Szkło" przeniesione z prototypu)
 "Neon":"Neon","Szkło":"Glass",
 // NAZWY WYGLĄDÓW zostają: czyta je lista stylów okien (RF_LOOKS) na ekranie „Nakładka".
 // ⚠️ DWADZIEŚCIA PAR OD PUNKTU PORADNIKA O WYGLĄDACH ZNIKŁO STĄD 2026-09-02 (audyt UX #30) —
 // razem z samym punktem, który mówił, że styl okienka przy kursorze wybiera się „w tej karcie,
 // w sekcji Wygląd". Nie wybiera się go tam od 2026-08-31: styl należy do OKNA i ustawia się go
 // na ekranie „Nakładka". Nowe pary stoją niżej, przy przepisanym punkcie. Przy okazji odeszły
 // dwa klucze-ułamki („, sekcja", „, więc"), które ten słownik sam odradza: pasują do dowolnego
 // węzła o tej treści w całym panelu.
 "Jasny":"Light","Ciemny":"Dark","Sama treść":"Content only",
 "Prawie czarne wycinki, świecące krawędzie — do ciemnych gier":
   "Near-black slices with glowing edges — for dark games",
 "Matowa szyba: jasne półprzezroczyste wycinki, miękki cień":
   "Frosted glass: bright translucent slices and a soft shadow",
 "Czas do zatwierdzenia":"Time to confirm","Martwa strefa":"Dead zone","Czas otwarcia podmenu":"Submenu opening time",
 // KOŁO ZAWSZE WIDOCZNE + WYZWALACZ Z POCHYLENIA (2026-08-27)
 "Koło zawsze widoczne":"The wheel is always there",
 "Koło stoi na ekranie bez przerwy, więc klikanie od razu przesuwa wybór. Wyłączone: pojawia się dopiero po przechyleniu kapsla w dół i chowa po wyborze.":
   "The wheel just stands on the screen, so clicking already steps the choice. Switched off, it turns up only after the capsule is leaned downwards and goes away once something is picked.",
 "Wyzwalacz":"Trigger",
 // Opcja wyzwalacza „Pochylenie" mówi po angielsku „A lean", ale goły klucz „Pochylenie" należy
 // do nazwy osi filtra („Tilt", legenda „Filtr 3D — osie" — wyżej). Dwa znaczenia, jeden napis,
 // a tłumacz chodzi po dokładnym tekście węzła — więc opcję składa rf-46b przez _wheelT() na
 // <option data-noi18n> i klucza tu nie ma. Drugi wpis nadpisywał pierwszy i legenda mówiła „A lean".
 "Czym przesuwa się wybór: przyciskiem kapsla albo samym pochyleniem. Pochylenie jest dla kogoś, kto nie ma jak nacisnąć — kapsel na czapce, przy głowie, przypięty do ubrania.":
   "What steps the choice: the capsule's button, or a lean on its own. The lean is for somebody with no way to press — a capsule on a cap, by the head, clipped to clothing.",
 "Kierunek":"Direction","Dowolny kierunek":"Any direction",
 "Tylko w przód i w tył":"Forwards and back only","Tylko na boki":"Sideways only",
 "Skinienie w dół jest łatwiejsze i mniej męczące niż przechył na bok, a przy części niepełnosprawności ruch boczny szyi jest niedostępny":
   "A nod downwards is easier and less tiring than a lean to the side, and with some disabilities sideways neck movement is not available at all",
 "Siła pochylenia":"How far to lean",
 "Jak mocno trzeba pochylić kapsel, żeby to się liczyło jako naciśnięcie. Za nisko — wyzwoli się samo; za wysoko — będzie nieosiągalne.":
   "How far the capsule has to lean before it counts as a press. Too little and it trips by itself; too much and it is out of reach.",
 "Pozycja zerowa":"The neutral position","⌖ Wyśrodkuj kapsel":"⌖ Centre the capsule",
 "Ustaw obecne położenie kapsla jako neutralne. To ta sama kalibracja, co na ekranie „Mysz” — jedna pozycja zerowa dla całej aplikacji.":
   "Set the capsule's current position as the neutral one. This is the same calibration as on the “Mouse” screen — one neutral position for the whole app.",
 // PRESETY: jedna lista (2026-08-27). Od 2026-09-02 lista jest w zakładce „Biblioteka" modułu,
 // a „↺ Przywróć fabryczne" stoi w jej nagłówku — napis i podpowiedź składa `_gl` w rf-46k, więc
 // klucz zostaje wyłącznie jako zapasowa droga dla walkera (obie strony mówią to samo).
 "↺ Przywróć fabryczne":"↺ Restore the factory ones",
 // SCENA: klawiatura i czytnik ekranu (2026-08-27)
 "Podgląd koła wyboru. Strzałki przechodzą po wycinkach, Enter wybiera, Escape zamyka.":
   "The selection wheel preview. The arrow keys step through the slices, Enter picks, Escape closes.",
 "Ostatnie wybory":"Last choices","Podgląd koła wyboru":"Selection wheel preview",
 "⤢ Powiększ":"⤢ Enlarge","⤡ Zmniejsz":"⤡ Shrink","⤡ Zwiń":"⤡ Collapse","⤢ Podgląd":"⤢ Preview",
 "Rozłóż podgląd na całą kartę (Esc wraca)":"Spread the preview over the whole card (Esc brings it back)",
 "Wróć do zwykłego układu (albo naciśnij Esc)":"Back to the ordinary layout (or press Esc)",
 "Zwiń podgląd i oddaj całą szerokość edycji":"Collapse the preview and give the whole width to editing",
 "Pokaż podgląd koła":"Show the wheel preview",
 "Przesuń wyżej":"Move up","Przesuń niżej":"Move down","makro":"macro",
 "Importuj JSON":"Import JSON",
 // SEKCJA „ZAPIS" PO AUDYCIE UX (2026-09-02, #27/#38). „Eksportuj JSON" zniknął — ten sam plik
 // pobiera się z Biblioteki („Pobierz"). „Przywróć domyślne" nazywało się jak dwa inne „Przywróć"
 // na tym samym ekranie (odrzucenie zmian w bloku stanu i dołożenie presetów fabrycznych), więc
 // mówi teraz, CO cofa i czego nie rusza. Klucze poprzednich napisów usunięte razem z nimi.
 "Ustawienia domyślne (wycinki zostają)":"Default settings (the slices stay)",
 "Cofnij ustawienia koła do domyślnych: sposób sterowania, czasy, martwą strefę, kształt podmenu i wygląd. Lista wycinków zostaje nietknięta.":
   "Put the wheel's settings back to their defaults: the way it is worked, the timings, the dead zone, the submenu shape and the look. The list of slices is left untouched.",
 // Edytor makra wycinka (rf-46c) — ta sama maszyneria, co w Mapowaniu, więc i te same słowa tam,
 // gdzie brzmią tak samo. „Nagraj makro" zamiast „Nagraj klawisze": tu chodzi o cały wycinek.
 "Nagraj makro":"Record a macro","Makro wycinka":"The slice's macro",
 "jak pisać makra?":"how do I write macros?",
 "Pauza:":"A pause:",
 "Kliknij element z biblioteki = dodaj, albo":"Click an item from the library to add it, or",
 "nagraj":"record","na żywo. Podgląd:":"live. Preview:",
 "Makro — kilka kroków po kolei zamiast jednej akcji":"A macro — several steps in a row instead of one action",
 // Scena podglądu: czym jest napędzana i co mówi, gdy nie ma czego pokazać.
 "Myszą":"By mouse","Kapslem":"By capsule","Czym sterować podglądem":"What drives the preview",
 "Wodzisz myszą po scenie. To symulacja: nic z niej nie idzie do systemu.":
   "You move the mouse over the stage. It is a simulation: nothing from it reaches the system.",
 "Scena pokazuje na żywo koło z prawdziwego kapsla — trzymasz przycisk i pochylasz, tak jak w grze":
   "The stage shows the wheel live from the real capsule — you hold the button and lean it, just as in a game",
 "Włącz koło, żeby zobaczyć podgląd z kapsla.":"Switch the wheel on to see the preview from the capsule.",
 "Pokaż przełącznik On":"Show the On switch",
 "⏻ Uzbrojone":"⏻ Armed","⏻ Wstrzymane":"⏻ Paused",
 // — 2026-09-02: przycisk #armBtn wrócił do nagłówka (rf-34), a linijka „parametry:" w stopce
 //   mówi o nim własnym członem (rfCfgLineSync w rf-08).
 "wyjście wstrzymane":"output paused",
 "Główny przełącznik wyjścia. Wstrzymane = nic nie wychodzi z żadnego modułu.":"Master output switch. Paused = nothing leaves any module.",
 "▶ Makro w toku:":"▶ Macro running:",
 "Etykieta":"Label",
 "Nazwa — tak kapsel podpisuje się wszędzie w aplikacji.":"Name — this is how the capsule signs itself everywhere in the app.",
 "Etykieta — nieobowiązkowy dopisek dla siebie, np. „Lewa ręka”. Widać go tylko w dymku pigułki.":"Label — an optional note to yourself, e.g. “Left hand”. It shows only in the pill's tooltip.",
 "Auto-wczytywanie: nazwa pliku gry, np. eldenring.exe. Gdy ta gra znajdzie się na wierzchu, aplikacja sama wczyta ten zestaw. Kilka nazw oddziel przecinkiem. Wielkość liter nie ma znaczenia — zapisuję małymi.":"Auto-loading: the game's file name, e.g. eldenring.exe. When that game comes to the front, the app loads this setup by itself. Separate several names with commas. Capitalisation does not matter — I store it in lower case.",
 "Kapsel jest uśpiony — obudź go, żeby nagrywać.":"The capsule is asleep — wake it up to record.","Warunek 1 (główny)":"Condition 1 (main)","Oś":"Axis","Kanał":"Channel","Warunek":"Condition","wart. > próg":"val > thr","wart. < próg":"val < thr",
 "wart. ≥ próg":"val ≥ thr","wart. ≤ próg":"val ≤ thr","w zakresie x..y":"in range x..y","poza zakresem x..y":"outside range x..y","Od (x)":"From (x)","Do (y)":"To (y)","od":"from","do":"to",
 "podgląd · 2 linie = granice zakresu":"preview · 2 lines = range bounds","podgląd na żywo · linia = próg":"live preview · line = threshold","+ Dodaj warunek":"+ Add condition",
 "Źródło warunku":"Condition source","Rodzaj akcji":"Action kind","Orientacja":"Orientation",
 "Zachowanie":"Behaviour","Sekwencja":"Sequence","X razy w czasie":"X times in window","Po odczekaniu":"After time","jedna akcja na każde przekroczenie progu":"one action per threshold crossing","Akcja":"Action","Pojedyncza":"Single","Sekwencja (makro)":"Sequence (macro)",
 "Klawisz / akcja":"Key / action","⌨ Naciśnij klawisz…":"⌨ Press a key…","— szybki wybór —":"— quick pick —","⏯ Play / Pauza":"⏯ Play / Pause","🔊 Głośność +":"🔊 Volume +","🔉 Głośność −":"🔉 Volume −",
 // REGUŁA BEZ KLAWISZA — pozycja listy i trzy zdania, które ją tłumaczą. Napisy stoją w HTML po
 // polsku (a nie składane przez _gl), bo ich TREŚĆ się nie zmienia — zmienia się tylko to, czy są
 // widoczne; podmiana węzła przez walker jest więc tańsza i nie zamraża języka z chwili zapisu.
 "— bez klawisza (tylko wyzwalacz) —":"— no key (trigger only) —",
 "Ta reguła nic nie naciska. Liczy warunki, zapala się na liście i publikuje zdarzenie — może się na niej oprzeć wyzwalacz w module Usługi sieciowe albo warunek Wyzwalacz w innej regule.":"This rule presses nothing. It still counts its conditions, lights up in the list and publishes an event — a trigger in the Network services module, or a Trigger condition in another rule, can rely on it.",
 "Ta reguła nic nie naciska. Liczy warunki, zapala się na liście i publikuje zdarzenie, więc może się na niej oprzeć warunek Wyzwalacz w innej regule. Moduł Usługi sieciowe wyłączono przy starcie, więc jego wyzwalacze teraz jej nie usłyszą.":"This rule presses nothing. It still counts its conditions, lights up in the list and publishes an event, so a Trigger condition in another rule can rely on it. The Network services module was switched off at start, so its triggers will not hear this rule now.",
 "⚠ Moduł Kontroler wyłączono przy starcie aplikacji, więc przyciski pada w tej regule teraz nic nie zrobią. Reguła się zapisze i zadziała po uruchomieniu aplikacji bez parametru --disable / --only.":"⚠ The Controller module was switched off when the app started, so the pad buttons in this rule do nothing now. The rule is saved and works again once the app starts without --disable / --only.",
 "⚠ Moduł Skaner wyłączono przy starcie aplikacji, więc sygnały skanera w tej regule teraz nic nie zrobią. Reguła się zapisze i zadziała po uruchomieniu aplikacji bez parametru --disable / --only.":"⚠ The Scanner module was switched off when the app started, so the scanner signals in this rule do nothing now. The rule is saved and works again once the app starts without --disable / --only.",
 "Bez klawisza odstęp nie schodzi poniżej 200 ms — powtarzane zdarzenie leci do odbiorcy, a nie do systemu.":"With no key the interval does not go below 200 ms — the repeated event goes to a listener, not to the system.",
 "Bez klawisza nie ma czego trzymać: reguła pozostaje aktywna przez cały czas spełnienia warunku i zgłasza się raz, na wejściu. Powtarzanie daje zachowanie Ciągłe.":"With no key there is nothing to hold: the rule stays active for as long as the condition holds and reports once, on entry. For repeating, use the Continuous behaviour.",
 "🔇 Wycisz":"🔇 Mute","⏭ Następny":"⏭ Next","⏮ Poprzedni":"⏮ Previous","→ Strzałka w prawo":"→ Right arrow","← Strzałka w lewo":"← Left arrow","↑ Strzałka w górę":"↑ Up arrow","↓ Strzałka w dół":"↓ Down arrow",
 "␣ Spacja":"␣ Space","⏎ Enter":"⏎ Enter","⎋ Esc":"⎋ Esc","Alt+Tab (przełącz okno)":"Alt+Tab (switch window)","🖱 Klik lewy":"🖱 Left click","🖱 Klik prawy":"🖱 Right click","🖱 Klik środkowy":"🖱 Middle click",
 "🖱 Dwuklik":"🖱 Double-click","🖱 Scroll ↑":"🖱 Scroll ↑","🖱 Scroll ↓":"🖱 Scroll ↓","🖱 Kursor ↑":"🖱 Cursor ↑","🖱 Kursor ↓":"🖱 Cursor ↓","🖱 Kursor ←":"🖱 Cursor ←","🖱 Kursor →":"🖱 Cursor →",
 "świeć, gdy aktywny":"glow when active","💡 zaświeć LED przy wyzwoleniu":"💡 light LED on trigger","na":"for","ms":"ms","(0 = zostaw zapalony)":"(0 = leave on)","Zapisz wyzwalacz":"Save trigger",
 // Rule-editor sections. The first three deliberately repeat the guide's own headings (minus the
 // number), so the editor and the „Jak skonfigurować wyzwalacze?" guide name the same things alike.
 "Warunki — kiedy ma zadziałać":"Conditions — when it fires","Zachowanie — jak ma reagować":"Behaviour — how it reacts",
 "Akcja — co ma się stać":"Action — what should happen","Sygnały — jak ma dać znać":"Signals — how it tells you",
 "Podświetlenie":"Lights","wysyłaj powiadomienie":"send a notification",
 "🔔 powiadomienie systemowe Windows":"🔔 Windows system notification","przy zadziałaniu":"when it goes off",
 "gdy staje się aktywny (i gdy przestaje)":"when it becomes active (and when it stops)",
 "dymek Windows z ikony w zasobniku — widoczny też, gdy panel jest schowany za grą. Nie częściej niż raz na 3 s; zdławione zadziałania dolicza licznik „(x7)”":
   "a Windows balloon from the tray icon — visible even with the dashboard behind a game. No more often than once every 3 s; whatever is swallowed is counted as “(x7)”",
 "🔔 Powiadomienie Windows":"🔔 Windows notification","bez dźwięku":"no sound","Treść powiadomienia":"Notification text",
 "Kiedy ma zadziałać":"When it fires",   // heading of the REST trigger's source band
 // Mapping guide, section 6 (the guide itself is built inline in rf-34-tabs.js, not in RF_GUIDES).
 // Whole sentences as keys, never fragments: this dictionary is global and exact-match, so a key
 // like "W polu" would hijack any other node that happens to read exactly that.
 "7. 🔔 Powiadomienie systemowe Windows":"7. 🔔 Windows system notification",
 "Wybrana reguła może się odzywać dymkiem Windows z ikony w zasobniku — widać go nawet wtedy, gdy panel jest schowany za grą, a działa też przy panelu zamkniętym.":
   "A chosen rule can speak up with a Windows balloon from the tray icon — visible even with the panel hidden behind a game, and it works with the panel closed too.",
 
 "pole „bez dźwięku” jest zaznaczone domyślnie — reguła potrafi zadziałać kilkadziesiąt razy w sesji, a dzwonek za każdym razem szybko męczy.":
   "the “no sound” box is ticked by default — a rule can go off dozens of times in a session, and a chime each time wears thin fast.",
 "w polu pod spodem wpisujesz własne zdanie (np. „Skacz!”). Puste = nazwa reguły i klawisz.":
   "the field below takes your own sentence (e.g. “Jump!”). Empty = the rule's name and key.",
 "dymek ma trzy linie — „RibbitFlip” z żabką, pod spodem „Mapowanie — nazwa reguły”, a najniżej Twój opis albo to, co się właśnie stało.":
   "the balloon has three lines — “RibbitFlip” with the frog, then “Mapping — rule name”, and at the bottom your description, or whatever just happened.",
 "nie częściej niż raz na 3 s dla jednej reguły; zdławione zadziałania dolicza licznik „(x7)”. Start z flagą --no-tray odbiera ikonę w zasobniku, więc dymka nie będzie — aplikacja powie to od razu przy włączaniu opcji.":
   "no more often than once every 3 s per rule; whatever is swallowed is counted as “(x7)”. Starting with the --no-tray flag takes the tray icon away, so there will be no balloon — the app says so the moment you switch the option on.",
 "puste = nazwa wyzwalacza i akcji":"empty = the trigger's and the action's name",
 // Poradnik Mapowania, sekcja 8 (KOŁO WYBORU). Do 2026-08-26 nie miała ani jednej pary i cała
 // zostawała po polsku — dopisane razem z pięcioma trybami sterowania i makrami w wycinkach.
 // Klucze to CAŁE węzły tekstowe z rf-34-tabs.js, łącznie z myślnikiem albo dwukropkiem na
 // początku: walker dopasowuje dokładnie to, co stoi między dwoma znacznikami.
 "8. 🎯 Koło wyboru — jeden przycisk, kilka akcji":"8. 🎯 Selection wheel — one button, several actions",
 "Kapsel ma jeden przycisk, a akcji zwykle potrzeba więcej. Koło wyboru rozwiązuje to bez wymyślania kolejnych gestów:":
   "A capsule has one button, and you usually need more actions than that. The selection wheel solves it without inventing further gestures:",
 "przytrzymaj przycisk":"hold the button down",
 ", a na ekranie pojawi się koło z wycinkami;":", and a wheel of slices appears on screen;",
 "pochyl kapsel":"lean the capsule",
 "w stronę wycinka i":"towards a slice and",
 "puść przycisk":"let the button go",
 "— pójdzie jego akcja. Jak koło broni w grach.":"— its action goes out. Just like a weapon wheel in a game.",
 "Gdzie to ustawisz:":"Where you set it up:",
 "własna zakładka":"a tab of its own,",
 // Punkt „Gdzie to ustawisz" dostał 2026-08-27 zdanie o układzie karty (podgląd po lewej, sekcje po
 // prawej), więc dawny jednolity kawałek rozpadł się na trzy: proza — <b>żywy podgląd</b> — proza.
 "żywy podgląd":"live preview",
 ", po prawej kolumna zwijanych sekcji, w których się edytuje. Dodajesz wycinki (od 2 do 16), każdy dostaje nazwę i akcję — tę samą, co wyzwalacz: klawisz,":
   ", on the right a column of collapsible sections, and that is where the editing happens. You add slices (from 2 to 16), each with a name and an action — the same kind a trigger takes: a key,",
 "Wycinek może otwierać PODMENU":"A slice can open a SUBMENU",
 "zamiast wysyłać akcję — przycisk":"instead of sending an action — the",
 "podmenu":"submenu",
 "w jego wierszu robi listę poziom niżej, a nad listą pojawiają się okruszki, którymi wracasz. Poziomy są trzy i tyle: czwarty pierścień celuje się z pamięci, której nikt nie ma. Wycinek z podmenu nie wysyła nic — to drzwi, nie akcja — więc jego pole akcji jest wtedy nieaktywne.":
   "button in its row makes a list one level down, and crumbs appear above the list to take you back. Three levels and no more: a fourth ring is aimed at from memory nobody has. A slice with a submenu sends nothing — it is a door, not an action — so its action field is inactive.",
 "Zastąp koło":"Replace the wheel",
 "— dzieci wchodzą w miejsce rodzica, na tym samym pierścieniu. Zawsze się mieści.":
   "— the children take the parent's place on the same ring. It always fits.",
 "Łuk nad wycinkiem":"An arc above the slice",
 "— dzieci wychodzą krótkim łukiem tuż nad rodzicem, reszta pierścienia przygasa. Widać całą drogę naraz.":
   "— the children come out as a short arc just above the parent and the rest of the ring dims. The whole path is visible at once.",
 "Pełna obręcz":"A whole second ring",
 "— dzieci obejmują całe koło drugą obręczą. Duże cele, dla rąk, którym trudno trafić w wąski łuk.":
   "— the children take a whole second ring. Big targets, for hands that find a narrow arc hard to hit.",
 "Pochylenie wybiera obręcz:":"The lean picks the ring:",
 "im dalej odchylisz kapsel, tym dalszy pierścień wskazujesz — środek, pierścień główny, dzieci, wnuki. Wycinek, który ma podmenu, ma przy krawędzi trzy kropki, więc widać to, zanim się w niego wejdzie. Wycinek może też dostać":
   "the further you lean the capsule, the further out the ring you are pointing at — the middle, the main ring, the children, the grandchildren. A slice with a submenu carries three dots at its edge, so you can see it before going in. A slice can also be given an",
 "ikonę":"icon",
 "(emoji) i":"(an emoji) and a",
 "kolor":"colour",
 "Im więcej wycinków, tym precyzyjniej trzeba celować":"The more slices there are, the more precisely you have to aim",
 "— rozsądny zakres to 4–8, szesnaście ma sens tylko wtedy, gdy koło jest duże i dobrze znane.":
   "— 4 to 8 is the sensible range, and sixteen only makes sense on a wheel that is big and well known.",
 // ŻYWY PODGLĄD (2026-08-27) — punkt o scenie po lewej stronie karty. Nazwy własne biorą się
 // z samej karty, żeby poradnik mówił to, co stoi na przyciskach: „Ostatnie wybory" to „Last
 // choices", a przełącznik źródła podglądu to „By mouse" / „By capsule" (rf-46d-wheel-stage.js).
 "Podgląd jest żywy i można w nim klikać.":"The preview is live and you can click in it.",
 "Wodzisz myszą po kole, wchodzisz w podmenu, wracasz środkiem; przytrzymanie lewego przycisku stawia koło pod kursorem, tak jak robi to prawdziwe okienko przy kursorze.":
   "You run the mouse round the wheel, go into a submenu and come back through the middle; holding the left button puts the wheel under the pointer, just as the real window at the pointer does.",
 "Nic z podglądu nie idzie do systemu ani do gry":"Nothing from the preview reaches the system or the game",
 "— to symulacja w przeglądarce, a jej wyniki lądują tylko w liście „Ostatnie wybory”. Kliknięcie wycinka zaznacza jego wiersz w edytorze i odwrotnie: wiersz, w którym stoisz, podświetla się na kole. Przełącznikiem":
   "— it is a simulation in the browser, and what comes of it lands only in the “Last choices” list. Clicking a slice selects its row in the editor, and the other way round: the row you are standing on lights up on the wheel. The",
 "Myszą / Kapslem":"By mouse / By capsule",
 "przestawiasz podgląd na stan z PRAWDZIWEGO kapsla — trzymasz przycisk, pochylasz i widzisz duże koło zamiast kafelka w rogu. Przyciski":
   "switch moves the preview onto the state of a REAL capsule — you hold the button, lean, and see the big wheel instead of the tile in the corner. The",
 "(Esc wraca) i":"(Esc brings it back) and",
 "oddają miejsce temu, czego akurat potrzeba więcej; układ jest zapamiętywany.":
   "buttons give the room to whichever side needs more of it at that moment; the layout is remembered.",
 // PUSTE POLE (2026-08-27) — nowy punkt tej sekcji. Klucze to CAŁE węzły tekstowe, więc zdanie
 // rozcięte znacznikiem <b> daje trzy pary, a nie jedną.
 "Wycinek może być PUSTY":"A slice can be EMPTY",
 "i to jest osobne, celowe ustawienie: pole bez akcji i bez makra. Wybranie go nic nie wysyła, koło po prostu się zamyka, tak samo jak przy anulowaniu. Dodaje je przycisk":
   "and that is a setting of its own, on purpose: a slice with no action and no macro. Picking it sends nothing, the wheel simply closes, exactly as it does when you cancel. It is added by the",
 "pod listą wycinków; nazwa jest nieobowiązkowa, więc możesz je podpisać „odpocznij” albo zostawić bez podpisu. Na kole rysuje się spokojniej od reszty, bez ikony, a w środku koła stoi nad nim zdanie":
   "button under the list of slices; the name is optional, so you can label it “rest” or leave it unlabelled. On the wheel it is drawn more quietly than the rest, with no icon, and the middle of the wheel says over it",
 "nic nie wysyła":"sends nothing",
 // Poradnik koła: „ile razy nacisnąć" — pole ×N w wierszu wycinka (2026-09-10).
 "Wycinek może nacisnąć akcję KILKA RAZY":"A slice can press its action SEVERAL TIMES",
 "— pole „×” w jego wierszu (od 1 do 20). Klawisz głośności przesuwa suwak Windows o 2%, a koło zamyka się po wyborze, więc „Ciszej” wskazane raz bywa niesłyszalne; przy ×5 jedno wskazanie to jeden wyraźny krok głośności. Zostaw 1 tam, gdzie akcja ma pójść dokładnie raz: przełącznik (wyciszenie, start i pauza) powtórzony sam by się cofnął. Wycinek z podmenu albo z makrem nie ma czego powtarzać, więc pole jest przy nim nieaktywne.":
   "— the “×” field in its row (1 to 20). A volume key moves the Windows slider by 2% and the wheel closes after a pick, so picking the quieter slice once can be inaudible; at ×5 one pick is one clear volume step. Leave it at 1 where the action must go exactly once: a toggle (mute, play and pause) repeated would simply undo itself. A slice with a submenu or a macro has nothing to repeat, so the field is inactive there.",
 ". Po co: ręka, która nie utrzyma przycisku równo, potrzebuje miejsca, na którym wolno wylądować bez skutków. W trybie „Pochyl i przytrzymaj” pierścień odliczania na pustym polu w ogóle nie rusza, więc można na nim odpocząć dowolnie długo.":
   ". What it is for: a hand that cannot hold the button steady needs somewhere it may land without consequences. In “Lean and hold it there” the countdown ring does not move at all over an empty slice, so you can rest on it for as long as you like.",
 "Wycinek może wykonać MAKRO":"A slice can run a MACRO",
 // Punkt o makrach urósł 2026-08-27 (cały edytor zamiast samego pola), więc kawałków jest teraz
 // pięć zamiast dwóch — pogrubione „ten sam edytor makra" i „Nagraj makro" rozcinają prozę.
 ", a nie tylko jedną akcję: przycisk ⛓ w wierszu wycinka odsłania":
   ", not just a single action: the ⛓ button in a slice's row reveals",
 "ten sam edytor makra, co w Mapowaniu":"the same macro editor as in Mapping",
 "— pole na sekwencję (":"— a field for the sequence (",
 "), podgląd kroków, bibliotekę gotowych elementów i przycisk":
   "), a preview of the steps, a library of ready-made pieces and the",
 ", który zapisuje naciskane klawisze razem z pauzami (Esc kończy nagranie). Otwarty jest zawsze jeden wiersz naraz, a pozostałe wycinki z makrem pokazują je jednym zdaniem podglądu. Wpisane makro ma pierwszeństwo — pojedyncza akcja tego wycinka jest wtedy pomijana. Składnię opisuje zwijany":
   "button, which writes down the keys you press together with the pauses between them (Esc ends the recording). Only one row is open at a time, and the other slices with a macro show theirs as a single line of preview. A macro takes precedence — that slice's single action is then skipped. The syntax is described in the collapsible",
 "poradnik pisania makr":"guide to writing macros",
 "na dole karty, ten sam, co w edytorze wyzwalacza.":"at the bottom of the card, the same one as in the trigger editor.",
 "Pięć sposobów sterowania":"Five ways to work it",
 "(lista":"(the",
 "w karcie) — bo „trzymaj przycisk i jednocześnie pochylaj tę samą rękę” nie każdej ręce wychodzi:":
   "list in the card) — because “hold a button while tilting the same hand” is not something every hand manages:",
 "Trzymaj przycisk i puść":"Hold the button and let go",
 "— sposób pierwotny i domyślny. Przytrzymanie otwiera, puszczenie zatwierdza, puszczenie na środku anuluje.":
   "— the original way, and the default. Holding opens it, letting go confirms, letting go in the middle cancels.",
 "Pochyl i przytrzymaj":"Lean and hold it there",
 "— bez przycisku w ogóle. Mocne pochylenie otwiera koło, utrzymanie wskazania na jednym wycinku przez":
   "— no button at all. A hard lean opens the wheel, and keeping the pointer on one slice for the",
 "wysyła je, wyprostowanie kapsla zamyka bez akcji.":"sends it; straightening the capsule closes it with nothing sent.",
 "Pochyl i kliknij":"Lean, then click",
 "— otwiera się pochyleniem, zatwierdza kliknięciem przycisku.":"— opens with a lean, confirms with a click of the button.",
 "Kliknij, pochyl, kliknij":"Click, lean, click",
 "— kliknięcie otwiera koło i zostaje ono otwarte samo, bez trzymania czegokolwiek; drugie kliknięcie zatwierdza, a przy kapslu ustawionym prosto anuluje.":
   "— a click opens the wheel and it stays open on its own, with nothing to hold; a second click confirms, or cancels if the capsule is held level.",
 "Przełączaj kliknięciami":"Step through it with clicks",
 // Trzy pary opisujące ten tryb PRZED przepisaniem punktu wypadły stąd 2026-08-27: ich tekstu nie
 // ma już nigdzie w web/, a żywe kawałki tego punktu stoją niżej, przy „Przełączaj kliknięciami".
 "Tryby otwierane pochyleniem gryzą się z prowadzeniem kursora.":"The lean-opened modes clash with steering the cursor.",
 "Jeśli TEN SAM kapsel prowadzi mysz albo gałkę, jego pochylenia mają już swoje zadanie i koło będzie się otwierać w środku celowania. Najlepiej dać te tryby kapslowi, który nie steruje kursorem. Dlatego próg otwarcia jest wysoki i nie ma na niego suwaka: musi być wyraźnie większy niż wszystko, co robi się przy zwykłym sterowaniu. Dotyczy to dwóch trybów pochyleniowych —":
   "If THE SAME capsule drives the mouse or the stick, its tilts already have a job, and the wheel will keep opening in the middle of your aiming. These modes are happiest on a capsule that is not steering the cursor. That is why the opening bar is high and has no slider: it has to stay clearly above anything ordinary steering does. This is about the two lean-opened modes —",
 "nie czyta pochylenia w ogóle, więc jest tu bezpieczny.":
   "does not read the lean at all, so it is safe here.",
 "to środek koła, w którym nic nie jest wskazane. Suwak w karcie pozwala ją zwęzić (szybszy wybór małym ruchem) albo poszerzyć (spokojniejsza ręka nic nie wybiera przez przypadek). Przy bardzo szerokiej strefie próg otwarcia w trybach pochyleniowych podnosi się sam, żeby zostać wyraźnie poza nią.":
   "is the middle of the wheel, where nothing is picked. The slider in the card narrows it (a small movement already decides) or widens it (a less steady hand picks nothing by accident). With a very wide zone the opening bar of the lean-opened modes raises itself, so as to stay clearly outside it.",
 "Wszystkie trzy koła":"All three wheels that need",
 "bez trzymania":"nothing held down",
 "(pochyleniowe i „Kliknij, pochyl, kliknij”) zamykają się same po":
   "(the lean-opened ones and “Click, lean, click”) close by themselves after",
 "8 sekundach":"8 seconds",
 "bez decyzji i nic wtedy nie wysyłają.":"with no decision made, and send nothing when they do.",
 // ——— PORADNIK, sekcja 8: próg uzbrojenia, klawiatura, „zawsze widoczne", wyzwalacz, presety
 //     (2026-08-27). Klucze są kawałkami tekstu tak, jak dzieli je walker: pogrubienie kończy
 //     kawałek, więc każdy <b> ma własny wpis, a proza wokół niego własny.
 "bez decyzji i nic wtedy nie wysyłają. W trybie":
   "with no decision made, and send nothing when they do. In",
 "ten sam czas WYŁĄCZA koło zamiast je chować: włączone i zostawione samo sobie po prostu przygasa, a stojące na stałe zostaje na ekranie, bo tam nie ma czego chować.":
   "the same span SWITCHES THE WHEEL OFF rather than putting it away: switched on and left alone it simply dims, and a wheel that stands there permanently stays on screen, because there is nothing there to put away.",
 "Koło otwiera GEST, nie zastane pochylenie.":"The wheel is opened by a GESTURE, not by a lean it found already there.",
 "Zanim pochylenie zacznie cokolwiek znaczyć, kapsel musi raz powiedzieć „stoję prosto” — czyli trafić do martwej strefy. Kapsel, który w chwili włączenia koła już leży na boku albo siedzi na przechylonej głowie, nie otworzy niczego i niczego nie wyśle, dopóki nie wróci do środka. W podglądzie widać to jako":
   "Before a lean means anything at all, the capsule has to say “I am standing straight” once — that is, reach the dead zone. A capsule that is already lying on its side, or sitting on a tilted head, at the moment the wheel is switched on opens nothing and sends nothing until it comes home. In the preview this shows as",
 "dwa przerywane okręgi":"two dashed circles",
 "na zamkniętej scenie, bo progi są dwa: w mniejszy trzeba":
   "on the closed stage, because there are two thresholds: the smaller one has to be",
 "wejść":"entered",
 "(to martwa strefa — stąd wychylenie zaczyna cokolwiek znaczyć), a większy trzeba":
   "(that is the dead zone — a lean starts to mean something from there), and the larger one has to be",
 "przekroczyć":"crossed",
 "(to próg otwarcia, celowo dużo dalej niż martwa strefa — inaczej koło otwierałoby się przy zwykłym sterowaniu kursorem). Po wejściu w mniejszy oba zmieniają barwę, a na większym pojawia się podpis „przekrocz tę linię”.":
   "(that is the opening bar, deliberately much further out than the dead zone — otherwise the wheel would open during ordinary steering). Once you are inside the smaller one both change colour, and the larger one gets a “cross this line” label.",
 "Podgląd da się obsłużyć klawiaturą.":"The preview can be worked from the keyboard.",
 "Tabulatorem dochodzisz do sceny, strzałki przechodzą po wycinkach, a":
   "Tab takes you to the stage, the arrow keys step through the slices, and",
 "Enter albo spacja wybiera od razu":"Enter or the space bar picks straight away",
 "— bez przytrzymywania czegokolwiek, bo wymuszone trzymanie jest barierą przy drżeniu i słabym chwycie. Esc zamyka koło. Czytnik ekranu mówi przy każdej zmianie, co jest wskazane („Widok zadań — 2 z 6”), i co zostało wybrane.":
   "— with nothing held down, because a forced hold is a barrier for a shaking hand and a weak grip. Escape closes the wheel. A screen reader says what is being pointed at on every change (“Task view — 2 of 6”), and what was picked.",
 // „Przełączaj kliknięciami" — punkt przepisany 2026-09-06 (klik włącza, klik przesuwa,
 // przytrzymanie wyłącza), więc i kawałki są nowe. Poprzednie zniknęły razem z tekstem: ich
 // treści nie ma już nigdzie w web/.
 "— dla osób, którym celowanie pochyleniem sprawia trudność, i jedyny tryb, w którym":
   "— for people who find aiming by leaning hard, and the one mode in which",
 "pochylanie nie znaczy zupełnie nic":"leaning means nothing whatsoever",
 ". Wszystko robi ten sam przycisk, a koło mówi w środku, co znaczy on TERAZ: pierwsze kliknięcie":
   ". It is all done with the same button, and the middle of the wheel says what that button means RIGHT NOW: the first click",
 "włącza koło":"switches the wheel on",
 "i niczego przy tym nie wybiera, każde następne przechodzi na kolejny wycinek,":
   "and picks nothing while doing it, every further click steps to the next slice,",
 "odczekanie":"waiting",
 "wysyła ten, na którym stanąłeś, a":"sends the one you stopped on, and",
 "przytrzymanie przycisku wyłącza koło":"holding the button switches the wheel off",
 "i nie wysyła nic. Wyłączone koło jest przygaszone, więc widać z drugiego końca pokoju, czy słucha; to co innego niż przełącznik On na kaflu kapsla, którym włącza się cały moduł. Dlaczego pierwsze kliknięcie tylko włącza: bez tego jedno przypadkowe naciśnięcie — rękaw, zagłówek, ręka szukająca oparcia — od razu stawiało wybór na pierwszym wycinku i po chwili wysyłało jego akcję. Ten tryb ma dwa własne ustawienia:":
   "and sends nothing. A switched-off wheel is dimmed, so you can tell from across the room whether it is listening; this is a different thing from the On switch on the capsule's tile, which turns the whole module on. Why the first click only switches it on: without that, a single accidental press — a sleeve, a headrest, a hand steadying itself — put the choice on the first slice at once and sent its action a moment later. This mode has two settings of its own:",
 "(domyślnie włączone) — wyłączone koło stoi na ekranie przygaszone i mówi w środku, że czeka na kliknięcie: widać, gdzie jest i co ma, zanim się je włączy, a po wysłaniu akcji zostaje w tym samym miejscu i znów jest wyłączone. Bez tego ustawienia wyłączonego koła nie widać wcale, a na ekranie stawia je to samo kliknięcie, które je włącza.":
   "(on by default) — a switched-off wheel stands there dimmed, saying in the middle that it is waiting for a click: you can see where it is and what is on it before switching it on, and after an action goes out it stays in the same place, switched off again. Without this setting a switched-off wheel is not on screen at all, and the same click that switches it on is what puts it there.",
 "Włączone i zostawione samo sobie wyłącza się po 8 sekundach":
   "Switched on and left alone, it switches itself off after 8 seconds",
 "bez wysyłania czegokolwiek — tyle kosztuje pomyłkowe naciśnięcie.":
   "without sending anything — that is the whole price of an accidental press.",
 ". To drugie jest dla kogoś, kto nie ma jak nacisnąć: kapsel na czapce, przy głowie, przypięty do ubrania. Ponieważ wycinki lecą po kolei,":
   ". The second is for somebody with no way to press: a capsule on a cap, by the head, clipped to clothing. Because the slices come round in order,",
 "kierunek nic tu nie znaczy":"the direction means nothing here",
 "kliknięcia":"click","w dół":"downwards",
 "— liczy się samo wyjście poza próg i powrót. Wybierasz jeszcze":
   "— all that counts is crossing the threshold and coming back. You also pick a",
 "(dowolny / tylko w przód i w tył / tylko na boki — skinienie w dół jest łatwiejsze niż przechył na bok, a przy części niepełnosprawności ruch boczny szyi jest niedostępny) oraz":
   "(any / forwards and back only / sideways only — a nod downwards is easier than a lean to the side, and with some disabilities sideways neck movement is not available at all) and",
 "Siłę pochylenia":"How far to lean",
 ". ⚠️ Zanim zaczniesz, ustaw kapsel tak, jak będzie noszony, i naciśnij":
   ". ⚠️ Before you start, put the capsule where it will be worn and press",
 ": kapsel na czapce ma inny punkt zerowy niż na stole i inny dla każdej głowy, więc bez tego próg będzie albo nieosiągalny, albo wyzwoli się sam. Sprawdź też suwak":
   ": a capsule on a cap has a different zero from one on a desk, and a different one for every head, so without this the threshold is either out of reach or trips by itself. Check the",
 // Ta sama para stoi w karcie koła jako etykieta suwaka (_whHoldRole w rf-46b) — tam przez
 // _wheelT, czyli poza słownikiem. Tutaj jest KAWAŁKIEM PORADNIKA i bez niej zostałby po polsku.
 "Przytrzymanie wyłącza koło":"Hold switches it off",
 ": skinienie trwa dłużej niż kliknięcie palcem, a pochylenie utrzymane ponad ten czas wyłącza koło. Przy tym wyzwalaczu koło stoi zawsze i nie da się tego wyłączyć — bez rysunku na ekranie nie miałbyś jak sprawdzić, czy skinienie w ogóle przechodzi przez próg.":
   " slider as well: a nod lasts longer than a tap of a finger, and a lean held past that time switches the wheel off. With this trigger the wheel always stands there and that cannot be switched off — without the drawing on screen you would have no way of telling whether a nod is getting past the threshold at all.",
 // WYGLĄD, ZAPIS I PRESETY W PORADNIKU — przepisane 2026-09-02 (audyt UX #25/#26/#27/#30/#38).
 // Poprzedni komplet par opisywał ekran, którego już nie ma: pięć przycisków stylu „w tej karcie,
 // w sekcji Wygląd" (styl należy do OKNA i wybiera się go na ekranie „Nakładka"), siatkę presetów
 // w Konfiguracji (jest w zakładce „Biblioteka") i przycisk „Eksportuj JSON" (plik pobiera się
 // z Biblioteki). Zniknęły z nim także dwa klucze-ułamki („, sekcja" i „, więc"), które ten sam
 // słownik ostrzega, żeby ich nie zakładać: pasują do dowolnego węzła o tej treści w całym panelu.
 // Klucze są CAŁYMI węzłami tekstowymi, tak jak dzieli je walker: pogrubiony wstęp osobno, reszta
 // akapitu osobno.
 "Wygląd: w tej karcie ustawiasz LICZBY, a styl przy oknie.":
   "The look: in this card you set the NUMBERS, the style belongs to the window.",
 "Sekcja „Wygląd” daje cztery suwaki kształtu: wielkość koła (średnica w pikselach — jedna liczba na wszystkie miejsca naraz: okienko przy kursorze, nakładkę nad grą i podgląd obok), odstęp wycinków, zaokrąglenie rogów i wielkość pisma. Odstęp wycina się ze ŚRODKA wycinka, więc celujesz dokładnie tam, gdzie dotąd — zmienia się rysunek, nie granice.":
   "The “Look” section gives you four shape sliders: the wheel's size (the diameter in pixels — one number for every place at once: the window at the pointer, the overlay over the game and the preview beside it), the gap between slices, the rounding of the corners and the lettering size. The gap is taken out of the MIDDLE of a slice, so you aim exactly where you did before — what changes is the drawing, not the borders.",
 "Styl należy do OKNA, nie do koła.":"The style belongs to the WINDOW, not to the wheel.",
 "To samo koło wygląda inaczej w każdej nakładce, nad którą stoi, więc jeden przycisk w karcie koła nie mówiłby prawdy o pozostałych oknach. Stylów jest pięć: Jasny (kremowa karta jak w panelu), Ciemny (lepszy nad jasną grą), Sama treść (bez karty, zostaje sama zawartość), Neon (granatowa karta i prawie czarne wycinki ze świecącymi krawędziami) oraz Szkło (jasna, chłodna karta i wycinki jak matowa szyba).":
   "The same wheel looks different in every overlay it stands over, so one chooser in the wheel's card could not tell the truth about the other windows. There are five styles: Light (the cream card from the panel), Dark (better over a bright game), Content only (no card, just the contents), Neon (a navy card and near-black slices with glowing edges) and Glass (a bright, cool card with slices like frosted glass).",
 "Okienko przy kursorze ustawia się na ekranie „Nakładka”.":
   "The window at the pointer is set up on the “Overlay” screen.",
 "W karcie „Nakładki nad grą” stoi kafel z kreskowaną obwódką podpisany „koło przy kursorze” — to w nim wybierasz jego styl. Zwykłą nakładkę ustawia się tam samo albo w jej własnej szufladzie ⚙, sekcja Wygląd. Zdanie na dole sekcji Wygląd w karcie koła mówi, jaki styl nosi teraz to okienko, i prowadzi we właściwe miejsce.":
   "In the “Overlays over the game” card there is a dashed tile labelled “wheel at the pointer” — that is where you pick its style. An ordinary overlay is set up in the same place, or in its own ⚙ drawer, the Look section. The sentence at the bottom of the Look section in the wheel's card says which style that little window is wearing right now, and takes you to the right place.",
 "Podgląd obok rysuje jeden styl — ten obszywany ściegiem.":
   "The preview beside it draws one style — the stitched one.",
 "I tak ma być: podgląd pokazuje KSZTAŁT, czyli dokładnie to, co ustawiają suwaki. Różne okna mogą wyglądać różnie i o to chodzi: nakładka dla widzów bywa jasna, a okienko przy kursorze neonowe, bo jedno stoi nad streamem, a drugie nad grą.":
   "And that is as it should be: the preview shows the SHAPE, which is exactly what the sliders set. Different windows may look different and that is the point: the overlay for viewers is often bright while the window at the pointer is neon, because one sits over a stream and the other over the game.",
 "⚠️ Nad grą tło okna jest wycięte, więc Szkło nie ma czego rozmyć i zostaje tam matową tarczą — a jego karta jest nieprzezroczysta, bo półprzezroczysta zniknęłaby razem z wycięciem.":
   "⚠️ Over a game the window's background is cut away, so Glass has nothing to blur and stays a frosted disc there — and its card is opaque, because a translucent one would vanish along with the cut-out.",
 // ZAPIS — bez eksportu (plik pobiera się w Bibliotece) i z przyciskiem, który mówi, co cofa.
 "na dole kolumny:":"at the bottom of the column:",
 "wczytuje cudze koło albo preset z forum — przez tę samą sanityzację, co zwykły zapis, więc obcięte nazwy, odrzucone":
   "loads somebody else's wheel or a preset from the forum — through the same sanitising as an ordinary save, so trimmed names, rejected",
 "i za głębokie drzewo zobaczysz od razu na liście. Import nigdy nie włącza koła za Ciebie. Drugi przycisk,":
   "steps and too deep a tree show up on the list at once. An import never switches the wheel on for you. The other button,",
 ", cofa sposób sterowania, czasy, martwą strefę, kształt podmenu i wygląd, a listy wycinków nie rusza. Eksportu tu nie ma: gotowy plik do wysłania komuś pobierzesz w zakładce „Biblioteka” przyciskiem „Pobierz”.":
   ", puts back the way the wheel is worked, the timings, the dead zone, the submenu shape and the look, and leaves the list of slices alone. There is no export here: the file to send somebody you download in the “Library” tab with “Download”.",
 // PRESETY: jedna lista — i stoi w zakładce „Biblioteka" tego modułu, jak w każdym innym module.
 "Presety stoją w zakładce „Biblioteka” i jest to JEDNA lista":
   "The presets live in the “Library” tab and they are ONE list",
 "— Twoje własne i te trzy, które przychodzą z aplikacją (Multimedia z głośnością w podmenu, Zrzuty i schowek, Okna). Fabryczne poznasz po plakietce „z aplikacji”; wolno je wczytać, zapisać pod własną nazwą, pobrać jako plik, wysłać na forum i usunąć — a przycisk „↺ Przywróć fabryczne” w nagłówku listy dokłada z powrotem te, których brakuje: nie rusza Twoich i nie zmienia koła na kapslu. Skasowany przykład nie wraca sam przy aktualizacji: wraca wtedy, kiedy o to poprosisz. Wczytanie presetu NADPISUJE wszystkie wycinki tego kapsla, więc pyta o zgodę; przełącznika On nie rusza.":
   "— your own and the three that come with the app (Multimedia with the volume in a submenu, Screenshots and clipboard, Windows). You know the factory ones by the “from the app” badge; you may load them, save them under a name of your own, download them as a file, post them on the forum and delete them — while the “↺ Restore the factory ones” button in the list header puts back the ones that are missing: it leaves yours alone and does not change the wheel on the capsule. A deleted example does not come back by itself at the next update: it comes back when you ask for it. Loading a preset OVERWRITES every slice on this capsule, so it asks first; it does not touch the On switch.",
 // Plakietka wbudowanego presetu — ta sama, którą nosi lista Biblioteki.
 "z aplikacji":"from the app",
 "Zapisz jako…":"Save as…",
 // NAZWANA KONFIGURACJA KAPSLA. Punkt nie miał ani jednej pary i cały zostawał po polsku; przy
 // okazji przepisania (pasek akcji koła zniknął) dostaje je w całości.
 "Kapsel nosi NAZWANĄ konfigurację":"A capsule carries a NAMED configuration",
 ", więc nie musisz pamiętać, skąd wzięło się jego koło. Mówi ją PIERWSZA LINIA zakładki „Konfiguracja”, a razem z nią stoją tam przyciski, gdy jest co zrobić: „Zapisz zmiany” (nadpisuje konfigurację tym, co masz teraz) i „Przywróć” (odrzuca zmiany i wraca do zapisanej wersji). Kapsel, którego koło nie ma jeszcze nazwy, dostaje w tym samym miejscu „Utwórz preset”. Reszta porządków siedzi w zakładce „Biblioteka”: zapis pod nową nazwą („+ Zapisz obecne jako…”), wczytanie, „Wczytaj na…” (to samo koło na drugim kapslu), „Pobierz”, zmiana nazwy i usunięcie. Kropka przy nazwie na kaflu kapsla mówi, że koło różni się od zapisanej wersji. Zmiany działają od razu, tak jak w całej aplikacji: nazwa mówi, CZYM to jest, a nie zastępuje zapisywania.":
   ", so you never have to remember where its wheel came from. The FIRST LINE of the “Configuration” tab says the name, and the buttons stand right next to it whenever there is something to do: “Save the changes” (overwrites the configuration with what you have now) and “Revert” (drops the changes and goes back to the saved version). A capsule whose wheel has no name yet gets “Create a preset” in the same place. The rest of the tidying lives in the “Library” tab: saving under a new name (“+ Save the current one as…”), loading, “Load onto…” (the same wheel on another capsule), “Download”, renaming and deleting. The dot beside the name on a capsule's tile says the wheel differs from the saved version. Changes take effect at once, as everywhere in this app: a name says WHAT this is, it does not replace saving.",
 // GDZIE POKAZYWAĆ KOŁO — dwa punkty poradnika, każdy w dwóch kawałkach (pogrubiony wstęp + reszta
 // akapitu), bo tak dzieli tekst walker. Poprzednie klucze („Koło przy kursorze:", „przełącznik na
 // dole sekcji…") opisywały przełącznik, którego już nie ma, więc zniknęły razem z nim.
 "Gdzie je zobaczysz — i to jest jeden wybór:":"Where you see it — and it is one choice:",
 "koło umie się narysować w trzech miejscach: na ściądze (zakładka „Wszystko”), w nakładkach nad grą i w osobnym okienku wokół wskaźnika myszy. Na dole sekcji wybierasz jedno z trzech — „Przy kursorze”, „W nakładkach” albo „W obu” — więc koło nie pokazuje się w dwóch miejscach naraz, chyba że sam o to poprosisz („W obu” ma sens, gdy nakładka jest dla widzów, a okienko dla Ciebie). Poza chwilą wyboru koła nie ma wcale — nie zajmuje miejsca, dopóki nie jest otwarte.":
   "the wheel can be drawn in three places: on the cheat sheet (the “All” tab), in the overlays over the game, and in a little window of its own around the mouse pointer. At the bottom of the section you pick one of the three — “At the pointer”, “In the overlays” or “In both” — so the wheel never appears in two places at once unless you ask for it (“In both” makes sense when the overlay is for viewers and the little window is for you). Outside the moment of choosing, the wheel is simply not there — it takes up no room until it is open.",
 "Przy kursorze:":"At the pointer:",
 // Wielkość okienka przeniosła się 2026-08-27 do suwaka „Wielkość koła", więc punkt odsyła teraz
 // do sekcji Wygląd — a pogrubiona nazwa suwaka rozcina akapit na dwa kawałki zamiast jednego.
 "koło pokazuje się dokładnie wokół wskaźnika myszy — tam, gdzie i tak patrzysz w chwili wyboru, zamiast w rogu ekranu. Okienko jest niewidoczne, dopóki koło nie jest otwarte, nigdy nie łapie kliknięć (więc kliknięcie zatwierdzające trafia do gry), a jego wygląd i przezroczystość ustawiasz tuż pod wyborem (wielkość bierze się z suwaka":
   "the wheel appears right around the mouse pointer — where you are already looking at the moment of choosing, instead of in a corner of the screen. The window is invisible until the wheel opens, it never takes a click (so the click that confirms reaches the game), and its look and transparency are set right below the choice (the size comes from the",
 "w sekcji Wygląd — jedna liczba na wszystkie miejsca). Nakładki nad grą wtedy koła nie rysują, ale ich własne ustawienia zostają nietknięte, więc powrót do „W nakładkach” przywraca dokładnie to, co było. Ściąga w panelu pokazuje koło zawsze, bo to na niej je ustawiasz.":
   "slider in the Look section — one number for every place). The overlays over the game do not draw the wheel then, but their own switches are left untouched, so going back to “In the overlays” restores exactly what was there. The cheat sheet in the panel always shows the wheel, because that is where you set it up.",
 "Środek to wyjście awaryjne:":"The middle is the escape hatch:",
 "puszczenie przycisku, kiedy kapsel stoi prosto, nie wysyła nic. Otwarcie koła „na próbę” jest więc bezpieczne.":
   "letting the button go with the capsule held level sends nothing. Opening the wheel just to look is therefore safe.",
 "Bramka jest ta sama:":"The gate is the same one:",
 "akcja idzie do Windows tylko wtedy, gdy kapsel jest":"the action reaches Windows only while the capsule is",
 "uzbrojony":"armed",
 "— wstrzymany kapsel pokaże koło, ale niczego nie wyśle.":"— a paused capsule shows the wheel but sends nothing at all.",
 "Ten sam przycisk może mieć wyzwalacz.":"That same button can also have a trigger on it.",
 "Jeśli masz regułę na przycisk kapsla, przy każdym otwarciu koła ona też zadziała — koło niczego nie przechwytuje. To celowe (czasem właśnie tego się chce), ale jeśli przeszkadza, wyłącz tę regułę albo przepnij ją na inny warunek.":
   "If you have a rule bound to the capsule's button, it fires every time the wheel opens — the wheel swallows nothing. That is deliberate (sometimes it is exactly what you want), but if it gets in the way, switch that rule off or move it to another condition.",
 "Wycinek bez akcji i bez makra tylko się podświetla. Akcja warstwy (":
   "A slice with neither an action nor a macro merely highlights. A layer action (",
 ") wpisana jako pojedyncza akcja wycinka jest odrzucana przy zapisie, ale":
   ") written as a slice's single action is refused when saved, but",
 "w kroku makra działa":"inside a macro step it works",
 "własna treść — puste = nazwa wyzwalacza i klawisz":"your own wording — empty = the trigger's name and key",
 // the trigger log prints these two for a macro rule: the server sends them as the "key" and, for
 // an unnamed rule, as the name as well
 "(sekwencja)":"(macro)","sekwencja":"macro","🖱 Mysz":"🖱 Mouse","🎮 Gałka":"🎮 Stick","✛ Krzyżak":"✛ D-pad","Gałka":"Stick","Krzyżak":"D-pad",
 "▶ Włącz":"▶ Enable",
 "🖱 ruch":"🖱 move","🖱 scroll":"🖱 scroll","○ wyłączony":"○ disabled",
 "Oś pozioma (X)":"Horizontal axis (X)","Oś pionowa (Y)":"Vertical axis (Y)","Odwróć X":"Invert X","Odwróć Y":"Invert Y","LSB — szum przy środku ignorowany":"LSB — noise near centre ignored",
"Źródło ruchu":"Motion source","📈 Oś (prędkość z żyro)":"📈 Axis (velocity from gyro)","🧭 Filtr 3D (pochylenie → ruch kursora)":"🧭 3D filter (tilt → cursor motion)",
 "Filtr 3D: oś X":"3D filter: axis X","· Y":"· Y","· pełna prędkość przy":"· full speed at","° wychylenia":"° deflection","Bez sztywnego zakresu — po max wychyleniu kursor sunie dalej/szybciej":"No hard range — past max deflection the cursor keeps moving/faster",
 "Czułość X":"Sensitivity X","Czułość Y":"Sensitivity Y","Wygładzanie":"Smoothing","Maks. krok":"Max step","px":"px","Scroll: kręcenie zamiast ruchu kursora":"Scroll: spinning instead of cursor motion",
 // PRĘDKOŚĆ / POŁOŻENIE + OBSZAR KURSORA (mapka monitorów). Zdania składane w JS idą przez _gl()
 // w rf-15/rf-31b i nie potrzebują tu wpisu — poniżej jest sam statyczny HTML karty.
 "Ruch kapsla to":"Capsule motion means","Prędkość":"Speed","Położenie (wskazywanie)":"Position (pointing)",
 "Wychylenie mówi, JAK SZYBKO kursor jedzie. Puszczasz kapsel — kursor zostaje tam, gdzie dojechał.":
   "The tilt says HOW FAST the cursor travels. Let go and it stays where it got to.",
 "Wychylenie mówi, GDZIE kursor jest: kapsel wskazuje punkt w obszarze jak pilot. Wymaga źródła „Filtr 3D”.":
   "The tilt says WHERE the cursor is: the capsule points at a spot in the area, like a remote. Needs the “3D filter” source.",
 "Obszar kursora":"Cursor area", "Ogranicz do":"Limit to","🖥 Cały pulpit (wszystkie monitory)":"🖥 The whole desktop (every monitor)",
 "📺 Wybrany monitor":"📺 A chosen monitor","🎯 Monitor, na którym stoi kursor":"🎯 Whichever monitor the cursor is on",
 "🔲 Własny prostokąt":"🔲 A rectangle of my own","Monitor":"Monitor",
 "Pomiń pasek zadań":"Skip the taskbar","Margines":"Margin","px od krawędzi":"px from the edge",
 "Szerokość":"Width","Wysokość":"Height",
 "🎯 Lewy górny róg…":"🎯 Top-left corner…","🎯 Prawy dolny róg…":"🎯 Bottom-right corner…",
 "📺 Weź z monitora":"📺 Take a monitor's size",
 "Ustaw kursor w lewym górnym rogu obszaru — po odliczaniu wezmę jego pozycję":
   "Put the cursor in the top-left corner of the area — I take its position when the countdown ends",
 "Ustaw kursor w prawym dolnym rogu obszaru — po odliczaniu wezmę jego pozycję":
   "Put the cursor in the bottom-right corner of the area — I take its position when the countdown ends",
 "Wpisz do pól prostokąt monitora zaznaczonego na mapce":"Fill the fields with the rectangle of the monitor picked on the map",
 "szukam monitorów…":"looking for monitors…","brak połączenia z serwerem":"no connection to the server",
 "wskazywanie":"pointing","obszar nieznany":"area unknown",
 "Krzywa odpowiedzi":"Response curve", // Renamed 2026-09-02: „Siła wygładzania" and „Stabilizacja kursora (drżenie ręki)" sat one under
 // the other and read as two names for one idea. They are two fields (state.mouse.smooth averages
 // samples, state.mouse.tighten is a jitter THRESHOLD), so the labels now say which is which.
 "Stabilizacja kursora (próg drżenia ręki)":"Cursor stabilization (hand-tremor threshold)",
 "0 = wył. · tłumi mikro-drgania, nie odcina ruchu":"0 = off · damps micro-tremor without cutting motion",
 "0 = wył. · tłumi mikro-drgania, nie odcina ruchu · działa tylko ze źródłem 📈 Oś":
   "0 = off · damps micro-tremor without cutting motion · only with the 📈 Axis source",
 "Próg drżenia: ruchy mniejsze od niego są tłumione, większe idą w całości. Inny suwak niż „Siła wygładzania”, który uśrednia wszystko po równo.":
   "A tremor threshold: movement smaller than it is damped, anything larger passes whole. A different slider from “Smoothing strength”, which averages everything equally.",
 "Klasyczne (EMA)":"Classic (EMA)","Adaptacyjne (1€)":"Adaptive (1€)","algorytm „One Euro Filter” — mocno wygładza powolne ruchy, nie opóźnia szybkich":"the “One Euro Filter” algorithm — smooths slow motion heavily without delaying fast moves",
 "Siła wygładzania":"Smoothing strength",
 "Siła wygładzania (uśrednianie)":"Smoothing strength (averaging)",
 "uśrednia kolejne próbki — inny suwak niż „Stabilizacja kursora”":
   "averages consecutive samples — a different slider from “Cursor stabilization”",
 "Uśrednia kolejne próbki ruchu: większe = płynniej, ale kursor odrobinę zostaje za ręką. Inny suwak niż „Stabilizacja kursora”.":
   "Averages consecutive motion samples: higher = smoother, but the cursor trails your hand a little. A different slider from “Cursor stabilization”.",
 "Stabilność w spoczynku":"Rest stability","mniejsze = stabilniej w bezruchu (tłumi drżenie)":"lower = steadier at rest (damps tremor)",
 "Reaktywność ruchu":"Motion responsiveness","większe = mniejsze opóźnienie przy szybkim ruchu":"higher = less lag on fast motion",
 "Akceleracja (dwie czułości: wolno/szybko)":"Acceleration (two sensitivities: slow/fast)","Włącz akcelerację — wolno = precyzyjnie, szybko = jeszcze szybciej":"Enable acceleration — slow move precise, fast move faster",
 "Czułość przy szybkim ruchu":"Fast sensitivity","Próg wolny":"Slow threshold","Próg szybki":"Fast threshold","jedn. prędkości":"velocity units",
 // „∡" fell back to a font in which it read as the digit 4 — „Martwa strefa 4" — so the unit is a
 // word now. The old pairs stay: a saved layout or an older cached page can still carry the glyph.
 "Martwa strefa (kąt)":"Dead zone (angle)",
 "— martwa strefa wokół środka (filtr 3D)":"— angular silence around centre (3D filter)",
 "— za nią załącza się kierunek":"— past it the direction fires",
 "Martwa strefa ∡":"Angular dead zone ∡","° — martwa strefa wokół środka (filtr 3D)":"° — angular silence around centre (3D filter)","° (filtr 3D)":"° (3D filter)",
 "pełna prędkość przy":"full speed at",
 "Wii (emulator)":"Wii (emulator)",
 "Auto-środkowanie żyro przy bezruchu":"Auto-centre gyro when still",
 // KLIK BEZ KLIKANIA. „Dwell click" to nazwa, pod którą tę funkcję zna reszta świata narzędzi
 // dostępności, więc angielska strona panelu mówi ich językiem, a nie kalką z polskiego.
 "Klik bez klikania":"Click without clicking", // Gesty przycisku kapsla (rf-31d, 2026-09-10) — sekcja karty „Mysz" i nowe zachowanie reguły.
 "Przycisk kapsla klika myszą":"The capsule button clicks the mouse",
 // „Przytrzymanie" ma już swoje tłumaczenie („Holding down") — dokładanie drugiego złamałoby
 // zasadę „jedno polskie słowo, jedno angielskie" (pilnuje jej test_i18n_dupes). Pole dostaje
 // więc własną, dłuższą nazwę, która i tak mówi więcej: co znaczy tu przytrzymanie.
 "Okno puknięć":"Tap window","Przytrzymanie to":"A hold is",
 "Dokładnie N puknięć":"Exactly N taps",
 "DOKŁADNIE N puknięć w oknie czasu, decyzja na jego końcu: jedno puknięcie i dwuklik mogą wtedy stać na tym samym przycisku, bo pojedyncze czeka, czy nie przyjdzie drugie. Przytrzymanie nie liczy się jako puknięcie":
   "EXACTLY N taps within a time window, decided at its end: a single tap and a double-tap can then sit on the same button, because the single one waits to see whether a second is coming. A hold does not count as a tap",
 "Liczba puknięć":"Number of taps",
 "Akcja idzie DOPIERO na koniec okna i tylko wtedy, gdy puknięć było dokładnie tyle. Dzięki temu „1 puknięcie” i „2 puknięcia” mogą stać na jednym przycisku: pojedyncze czeka, czy nie przyjdzie drugie — i o tyle się spóźnia. Przytrzymanie nie liczy się jako puknięcie, więc „przytrzymaj” (Po odczekaniu) da się dołożyć obok.":
   "The action goes out ONLY at the end of the window, and only if there were exactly that many taps. That is what lets “1 tap” and “2 taps” sit on one button: the single one waits to see whether a second is coming — and is that much late. A hold does not count as a tap, so “hold” (After waiting) can be added beside it.",
 "Czas zatrzymania":"Dwell time","jak długo kursor ma stać, zanim padnie klik":"how long the cursor must stand still before it clicks",
 "Promień spokoju":"Calm radius", "Rodzaj kliknięcia":"Click type","Lewy":"Left","Prawy":"Right","Środkowy":"Middle","Podwójny":"Double",
 "Odwróć":"Invert","Krzywa X":"Curve X","Krzywa Y":"Curve Y","Liniowa":"Linear","Precyzyjna":"Precise","Czuła":"Sensitive",
 // Dymek pól „Krzywa X/Y" w padach (rf-23 PAD_CURVE_TIP). Nazwy krzywych są od 2026-09-02 te same,
 // co w MIDI/OSC, więc dymek wymienia je razem ze wzorem — tak jak lista krzywych w rf-16.
 "Krzywa odpowiedzi — te same trzy co w MIDI i OSC: Liniowa = t · Precyzyjna (kwadrat) = t² · Czuła (pierwiastek) = √t":"Response curve — the same three as in MIDI and OSC: Linear = t · Precise (square) = t² · Sensitive (sqrt) = √t",
 "wykładnicza mocna":"strong exponential","logarytmiczna":"logarithmic",
 "Tryb scrolla, gdy wybrana oś przekroczy próg (zamiast ruchu)":"Scroll mode when the chosen axis exceeds the threshold (instead of motion)","Oś scrolla":"Scroll axis","Próg scrolla":"Scroll threshold","Czułość scrolla":"Scroll sensitivity",
 "Gałka analogowa":"Analog stick","Źródło wychylenia":"Deflection source","📈 Oś (surowy kanał)":"📈 Axis (raw channel)","🧭 Filtr 3D (pochylenie/obrót)":"🧭 3D filter (tilt/rotation)","· pełne":"· full","° (lub °/s dla obrotu)":"° (or °/s for rotation)",
 "Przyspieszenie wejścia":"Input acceleration","płynnie ↔ natychmiast":"smooth ↔ instant","Wyjście":"Output","🎮 Drążek analogowy (kontroler)":"🎮 Analog stick (controller)","⌨ Klawiatura WSAD (skosy = combo)":"⌨ WASD keyboard (diagonals = combo)",
 // The third output had no pair at all, so the picker offered two English options and one Polish.
 "🖐 Palec na touchpadzie (DualShock)":"🖐 A finger on the touchpad (DualShock)",
 // Notka pod tym wyjściem (#mStickTpNote w HTML) nie miała ŻADNEJ pary i w EN stała w całości po
 // polsku. Walker tnie ją na węzły tekstowe wokół pogrubień, więc klucze = całe węzły (pogrubienia
 // osobno); jednowyrazowe klucze („podnosi się", „powierzchnię", „kliknięcie") nie kolidują z innymi
 // węzłami panelu (sprawdzone grepem). Myślnik U+2014 i ⚠️ z U+FE0F jak w HTML.
 "Pochylenie kapsla = miejsce na panelu.":"The capsule's tilt = a spot on the touchpad.",
 "Pełne pochylenie sięga krawędzi, a wewnątrz martwej strefy palec":"A full tilt reaches the edge, and inside the dead zone the finger",
 "podnosi się":"lifts off",
 "z panelu — bo drążek wraca na środek, a palec nie.":"the pad — because a stick returns to centre and a finger does not.",
 "⚠️ Panel dotykowy ma tylko DualShock 4 i kontroler Wii. Samą":"⚠️ Only the DualShock 4 and the Wii controller have a touchpad. The bare",
 "powierzchnię":"surface",
 "czyta niewiele programów: Steam Input (jako gładzik/gesty) i emulatory mówiące DS4/DSU. Zwykła gra bez Steam Input zobaczy tylko":"is read by few programs: Steam Input (as a trackpad/gestures) and emulators that speak DS4/DSU. An ordinary game without Steam Input will only see a",
 "kliknięcie":"click",
 "panelu, nie palec.":"of the pad, not the finger.",
 "Drążek":"Stick","Lewy (LS)":"Left (LS)","Prawy (RS)":"Right (RS)","Pełne wychylenie":"Full deflection","Martwa strefa wewn.":"Inner dead zone","Anti-deadzone":"Anti-deadzone","Krzywa odpowiedzi (expo)":"Response curve (expo)",
 // The one word on that panel that was never translated, standing right next to „Martwa strefa
 // wewn." as if the two were unrelated ideas. Named in Polish, with the borrowed term kept in
 // brackets because that is what every forum thread about it calls it.
 "Strefa rozruchu (anti-deadzone)":"Start-up zone (anti-deadzone)",
 "Gry mają własną martwą strefę przy środku drążka. To pole ją przeskakuje: minimalne wychylenie kapsla wychodzi już za nią, więc postać rusza od razu, zamiast po chwili.":"Games have a dead zone of their own around the stick's centre. This field jumps over it: the slightest tilt of the capsule already lands outside it, so the character starts moving at once instead of a moment later.",
 "1 = liniowo · >1 = precyzja przy środku":"1 = linear · >1 = precision near centre",
  // Czułość osobno na każdą oś — mnożnik wychylenia drążka, po jednym na X i Y. „Oś" zostaje
  // w nazwie po obu stronach: bez niego „Czułość X" byłaby tym samym napisem, co suwak myszy
  // dwie karty obok, a to dwa różne ustawienia w dwóch różnych jednostkach.
 "Czułość osi X":"Axis X sensitivity","Czułość osi Y":"Axis Y sensitivity",
 "Mnożnik wychylenia w poziomie. Więcej = kamera skręca na boki szybciej przy tym samym pochyleniu kapsla. 0,00 wyłącza tę oś.":"A multiplier on the sideways deflection. More = the camera swings left and right faster for the same tilt of the capsule. 0.00 switches this axis off.",
 "Mnożnik wychylenia w pionie. Mniej = w górę i w dół idzie delikatniej, choćbyś pochylił kapsel na maksa. 0,00 wyłącza tę oś.":"A multiplier on the vertical deflection. Less = up and down stay gentle however far you tilt the capsule. 0.00 switches this axis off.",
 "1,00 = bez zmian · niżej = trzeba pochylić dalej i oś nie dochodzi do końca · 0,00 = oś wyłączona · do celowania zwykle X wyżej niż Y":"1.00 = unchanged · lower = you tilt further and the axis stops short of full · 0.00 = axis off · for aiming, X is usually higher than Y",
 "Próg WSAD":"WASD threshold","wychylenie → klawisz":"deflection → key","Klawisze WSAD (klik → naciśnij klawisz; skos = dwa naraz):":"WASD keys (click → press a key; diagonal = two at once):",
 "Krzyżak (D-pad)":"D-pad","⌨ Klawiatura":"⌨ Keyboard","🎮 Kontroler (D-pad)":"🎮 Controller (D-pad)","Skosy (8 kierunków)":"Diagonals (8 directions)","Próg":"Threshold","LSB":"LSB","Histereza":"Hysteresis",
  // d-pad: how many keys at once + the key-zone overlay on the preview
 "Klawisze naraz":"Keys at once","Jeden kierunek":"One direction","Dwa (skosy ↖↗↙↘)":"Two (diagonals ↖↗↙↘)",
 "Krzyżak wciska zawsze jeden klawisz — wygrywa kierunek dominujący, jak w prawdziwym krzyżaku 4-kierunkowym":"The d-pad always holds a single key — the dominant direction wins, like a real 4-way d-pad",
 "Ruch po przekątnej — dwa klawisze kierunku naraz (↖↗↙↘), ważne w grach retro":"Diagonal movement — two direction keys at once (↖↗↙↘), important in retro games",
 "Na skosie trzymane są DWA klawisze naraz (np. ↑ + →). Niektóre gry tego nie lubią.":"On a diagonal TWO keys are held at once (e.g. ↑ + →). Some games dislike that.",
 "Zawsze najwyżej jeden wciśnięty klawisz — przekątna wybiera kierunek o większym wychyleniu.":"At most one key held at any time — on a diagonal the larger deflection wins.",
 "Pokaż strefy klawiszy na podglądzie":"Show key zones on the preview",
 "— przerywane linie progu i podpisy „gdzie który klawisz”":"— dashed threshold lines and “which key goes where” labels",
 "Rysuje na podglądzie przerywane granice progów i pokazuje, który klawisz wciśnie się w której strefie":"Draws the threshold borders on the preview and shows which key fires in which zone",
 "skosy · 2 klawisze":"diagonals · 2 keys","1 klawisz naraz":"1 key at a time","(1,00 = próg)":"(1.00 = threshold)",
 "martwa strefa":"dead zone",
 "przeciągnij — martwa strefa":"drag — the dead zone",
 "°":"°",
 "skala":"scale",
 "° — za nią załącza się kierunek":"° — a direction fires past it",
 "Jak daleko trzeba pochylić kapsel, żeby kierunek się załączył — w środku panuje cisza":"How far the capsule has to lean before a direction fires — the middle stays silent",
 "Jak daleko sięga podgląd — czyli ile wychylenia uznajemy za „na maksa”":"How far the preview reaches — how much lean counts as “all the way”",
 "Ile pełnego wychylenia zostaje ciszą. Za martwą strefą kierunek się załącza — dokładnie jak w gałce":"How much of the full deflection stays silent. Past the dead zone a direction fires — exactly like the stick",
 "⌨ Krzyżak wysyła klawisze kierunków — najwyżej jeden naraz (bez skosów).":"⌨ The d-pad sends direction keys — at most one at a time (no diagonals).",
 "Klawisze kierunków (klik → naciśnij klawisz):":"Direction keys (click → press a key):","⌨ Krzyżak wysyła klawisze kierunków. Skosy (8 kier.) = dwa klawisze naraz.":"⌨ D-pad sends direction keys. Diagonals (8 dir.) = two keys at once.",
 "🔀 Auto-przełączanie trybu wg pozycji (filtr 3D / oś)":"🔀 Auto mode switch by position (3D filter / axis)","Włącz — o faktycznym trybie decyduje warunek, a nie część pada, którą klikniesz":"Enable — the effective mode comes from the condition, not from the pad part you click",
 "Warunek:":"Condition:","🧭 Filtr 3D":"🧭 3D filter","📈 Oś (CH)":"📈 Axis (CH)","zapobiega migotaniu":"anti-flicker","Gdy":"When","spełniony":"met","gdy":"when","nie":"not","wyłączone — tryb wybierasz przełącznikiem powyżej":"disabled — mode from the segment above",
 "Połączenie z urządzeniem":"Device connection","Status":"Status","● Symulacja":"● Simulation","● Połączono":"● Connected","○ Szukam…":"○ Searching…","○ Rozłączono":"○ Disconnected","Uśpiony":"Asleep","○ Start":"○ Start",
 "Nazwa":"Name","Adres":"Address","Bateria":"Battery","Częstotliwość":"Frequency","Przepływ":"Throughput","Pakiety IMU":"IMU packets","Pakiety status":"Status packets","Odrzucone B":"Dropped B","Czas sesji":"Session time",
 "Oszczędzanie baterii":"Battery saving","Uśpij":"Sleep",
 "Auto-uśpienie po":"Auto-sleep after","min bezczynności":"min idle","Odczyt baterii co":"Read battery every","s":"s","(rzadziej = mniej zapytań przez Bluetooth)":"(less often = fewer Bluetooth queries)",
 "Zaawansowane: częstotliwość strumienia (eksperymentalne)":"Advanced: stream frequency (experimental)","Komenda wybudzenia":"Wake command","↺ Domyślna (≈50 Hz)":"↺ Default (≈50 Hz)",
 "LED / komendy urządzenia":"LED / device commands","steruj diodą kapsla i wysyłaj surowe komendy BLE":"control the capsule LED and send raw BLE commands","LED":"LED","sterujesz zapisem":"is controlled by writing","(włącz) /":"(on) /","(wyłącz) do charakterystyki":"(off) to characteristic",
 ". Możesz też wysłać dowolną surową komendę BLE (np.":". You can also send any raw BLE command (e.g.","SLEEP":"SLEEP","Charakterystyka (UUID zapisu)":"Characteristic (write UUID)",
 "RX 6e400002 (komendy — potwierdzone)":"RX 6e400002 (commands — confirmed)","6e400004 (LED — zweryfikowane)":"6e400004 (LED — verified)","Własny UUID…":"Custom UUID…","Własny UUID":"Custom UUID","Hex":"Hex","▶ Wyślij":"▶ Send","Presety:":"Presets:","LED OFF":"LED OFF",
 "Uśpij i odłącz. Kapsel przechodzi w tryb uśpienia i nie zużywa baterii, ale wymaga ponownego podłączenia.":"Sleep and disconnect. The capsule goes into sleep mode and stops using battery, but has to be connected again.",
 "Obudź kapsla. Trzeba go połączyć na nowo.":"Wake the capsule. It has to be connected again.",
 "Nie udało się wysłać polecenia do kapsla.":"Could not send the command to the capsule.",
 "Nagrywanie danych (CSV)":"Data recording (CSV)","surowe próbki 6 kanałów + status → plik CSV":"raw 6-channel samples + status → CSV file",
 "zaznacz, co ma trafić do pliku, potem naciśnij „Nagrywaj CSV”":"tick what should go into the file, then press “Record CSV”",
 "Zaznacz najpierw, co nagrywać, bo plik wyszedłby pusty.":"Tick what to record first, otherwise the file would come out empty.",
 "Kanały czujnika (CH0–CH5)":"Sensor channels (CH0–CH5)",
 "Sześć surowych wartości z akcelerometru i żyroskopu, tak jak przyszły z kapsla":"The six raw values from the accelerometer and gyroscope, exactly as the capsule sent them",
 "Pakiety statusu 0x21 (przycisk)":"Status packets 0x21 (button)",
 "Pięć bajtów, w których kapsel melduje naciśnięcie. To tutaj widać klikanie.":"The five bytes in which the capsule reports a press. This is where clicking shows up.",
 "Filtr 3D (pochylenie, obrót, pitch, roll)":"3D filter (tilt, twist, pitch, roll)",
 "Wynik filtra orientacji, czyli to, co widzi mapowanie ruchu":"The output of the orientation filter, which is what motion mapping sees",
 "Wyzwalacze (co się odpaliło)":"Triggers (what fired)",
 "Moment, w którym reguła włącza się, wyłącza albo zwiększa licznik odpaleń":"The moment a rule switches on, switches off or bumps its fire counter",
 "Surowy hex ramki":"Raw frame hex",
 "Cała ramka bajt po bajcie. Przydatne, gdy trzeba sprawdzić coś, czego kolumny nie pokazują.":"The whole frame byte by byte. Useful when something has to be checked that the columns do not show.",
 "Wszystkie kapsle (domyślnie tylko oglądany)":"All capsules (by default only the viewed one)",
 "Nagrywaj też kapsle, których akurat nie oglądasz. Bez tego naciśnięcie na innym kapslu nie trafi do pliku.":"Also record capsules you are not currently viewing. Without this, a press on another capsule never reaches the file.","parametry:":"parameters:","tryb":"mode","symulacja":"simulation","· sterowanie klawiaturą/myszą":"· keyboard/mouse control",
 // Dwa człony tej samej linijki stopki, które nie miały par (walker zostawiał je po polsku).
 "podgląd (--no-keys)":"preview (--no-keys)","WŁĄCZONE":"ON","LIVE (realny Triki)":"LIVE (a real Triki)",
"Odejmuje bieżące przesunięcie od wykresów. Zmienia tylko obraz, dane i wyjścia zostają bez zmian":"Subtracts the current offset from the charts. Only the picture changes, data and outputs stay as they are",
"Czyści wykresy, dziennik wyzwalaczy i surowy strumień. Nagranie CSV zostaje do pobrania":"Clears the charts, the trigger log and the raw stream. The CSV recording stays available to download",
"Przywraca fabryczną mapę kanałów, czułość, przyspieszenie, odbicie i kierunki przechyłu. Dostrajania torów nie rusza":"Restores the factory channel map, response, gain, mirror and tilt directions. Chain tuning is left alone",
 "Kliknij — wyjaśnienie podglądu i trybów":"Click — explanation of the preview and modes","Ustawienia orientacji (kliknij, aby przypiąć)":"Orientation settings (click to pin)","Ustawienia orientacji":"Orientation settings",
 "Wyśrodkuj — wyzeruj obrót i ustaw bieżące położenie jako odniesienie":"Recenter — zero the rotation and set the current position as reference","Kliknij, aby wpisać wartość":"Click to type a value","nazwa presetu osi":"axis preset name","Usuń wybrany preset osi":"Delete selected axis preset",
 "Wczytaj konfigurację z pliku JSON":"Load config from a JSON file","nazwa nowego presetu":"new preset name","Usuń wybrany preset":"Delete the selected preset",
 // The „Wymiana" buttons — one label, one icon, one tooltip for every place things get saved: the
 // trigger preset bar, the axis preset bar, the setup card, the bundle row and the REST application
 // card (the last one built in JS, rf-36, and written in Polish precisely so this entry catches it).
 // „Discord" named the destination; „Wymiana" names what the button does, which is the same
 // everywhere. Everything inside the window they open is composed with _gl().
 "Wymiana":"Exchange",
 "Podziel się na forum, zobacz cudze albo wczytaj od kogoś":"Share on the forum, see what others posted, or load one from them",
 // The hub's footer shortcut, for handing a file over without a post at all (rf-39l).
 "Zapisze plik tam, gdzie lądują Twoje pobrane pliki":"Saves the file wherever your downloads go",
 "np. Przewijaj w prawo":"e.g. Scroll right","Ustaw na bieżącą wartość":"Set from current value","Ustaw próg z bieżącej wartości":"Set threshold from current value",
 "np. right, ctrl+c, mouse:left":"e.g. right, ctrl+c, mouse:left","Wyłącz":"Disable","Włącz":"Enable","Testuj klawisz":"Test key","Edytuj":"Edit",
 // JEDYNA para „Usuń" (drugą, „Remove", miały domyślne etykiety rfModal). Delete = kasuje zapisany wpis;
 // gdzie coś tylko schodzi z listy (kapsel w hubie, akcja REST), kod podaje _gl("Usuń","Remove").
 "Usuń":"Delete",
 "Włącz/wyłącz sterowanie":"Enable/disable control",
 "Klawisz dla kierunku GÓRA":"Key for UP","Klawisz dla kierunku DÓŁ":"Key for DOWN","Klawisz dla kierunku LEWO":"Key for LEFT","Klawisz dla kierunku PRAWO":"Key for RIGHT",
 "Uśpij urządzenie — zatrzymaj strumień":"Put the device to sleep — stop the stream","Włącz LED (0x01 na 6e400004)":"Turn LED on (0x01 to 6e400004)","Wyłącz LED (0x00 na 6e400004)":"Turn LED off (0x00 to 6e400004)","SLEEP — wyłącz strumień danych kapsla":"SLEEP — stop the capsule data stream",
 "Rozpocznij / zatrzymaj nagrywanie surowych próbek do CSV":"Start / stop recording raw samples to CSV","Pobierz nagrane surowe próbki jako CSV":"Download recorded raw samples as CSV","Naciśnięcia przycisku w czasie — długość paska to czas trzymania; ta sama oś czasu i zoom co wykres powyżej":"Button presses over time — the bar's length is how long it was held; same time axis and zoom as the chart above",
 "— podgląd ruchu i granie":"— motion preview & play","Synth":"Synth",
 "⛶ Pełny ekran":"⛶ Full screen","Pełny ekran pada (Esc — wyjście)":"Pad full screen (Esc to exit)",
 "▶ Włącz pad":"▶ Enable pad","⏹ Wyłącz pad":"⏹ Disable pad",
 "Włącz/wyłącz Synth (dźwięk i podgląd 2D — lokalnie w przeglądarce)":"Enable/disable the Synth (sound and 2D preview — local to the browser)",
 "Dźwięk":"Sound","Skala":"Scale","Oktawy":"Octaves","Ruch urządzeń":"Device motion","Efekty":"Effects",
 "Przejście":"Transition","⊓⊓ Skokowe":"⊓⊓ Stepped","〜 Płynne":"〜 Smooth",
 "▶ Graj z ruchu":"▶ Play from motion","⏹ Graj z ruchu":"⏹ Play from motion",
 "Co steruje osią X (wysokość nuty)":"What drives the X axis (note pitch)","Co steruje osią Y (barwa / jasność)":"What drives the Y axis (timbre / brightness)",
 "Zakres wychylenia mapowany na cały pad":"Deflection range mapped onto the whole pad",
 "〰 Echo":"〰 Echo","Echo (delay) dźwięku lokalnego":"Echo (delay) of the local sound",
 "≈ Wibrato z obrotu":"≈ Vibrato from twist",
 "∞ Zatrzask":"∞ Latch",
 "🎳 Momentum":"🎳 Momentum","Momentum (trackball): po puszczeniu żaba zachowuje pęd i sunie dalej z wytracaniem, odbijając się od krawędzi — jak podkręcona kula. Zatrzask ma pierwszeństwo. To zachowanie instrumentu, nie dekoracja (działa też przy „ograniczonym ruchu”).":"Momentum (trackball): on release the frog keeps its momentum and coasts on with decay, bouncing off the edges — like a spun ball. Latch takes priority. This is instrument behaviour, not decoration (works even under reduced motion).",
 "Głośność dźwięku lokalnego":"Local sound volume","Najniższa nuta pada":"Lowest note of the pad","Ile oktaw mieści pad":"How many octaves the pad spans",
 "💥 Velocity z ruchu":"💥 Motion velocity",
 "Velocity z ruchu: głośność NOWEJ nuty rośnie z energią gestu — szybki ruch kapsla/dotyku gra głośniej, spokojne wejście ciszej. Nie zmienia brzmienia, gdy wyłączone.":"Motion velocity: a NEW note gets louder with gesture energy — fast capsule/touch plays louder, gentle entry quieter. No sound change when off.",
 "🎚 stała":"🎚 fixed","💥 z ruchu":"💥 from motion","Wartość velocity":"Velocity value",
 // — sound editor: expanded synth + selectable library —
 "🎛 Oscylatory":"🎛 Oscillators","Filtr":"Filter","📉 Obwiednia głośności":"📉 Volume envelope","✨ Charakter":"✨ Character",
 "Fala":"Wave","Oktawa":"Octave","Sub-oktawa":"Sub-octave","2. oscylator":"2nd oscillator",
 "Osc 2 — fala":"Osc 2 — wave","Osc 2 — półtony":"Osc 2 — semitones","Osc 2 — detune":"Osc 2 — detune","Osc 2 — miks":"Osc 2 — mix",
 "Typ filtra":"Filter type","Dolnoprzepustowy":"Low-pass","Górnoprzepustowy":"High-pass","Pasmowy":"Band-pass","Wycinający":"Notch",
 "Rezonans Q":"Resonance Q","Obwiednia filtra":"Filter envelope","Czas obwiedni":"Env time","Rozświetlenie":"Brightening",
 "Typ":"Type","Ciągły (legato)":"Sustained (legato)","Szarpany (pluck)":"Plucked","Atak":"Attack","Zanik":"Decay","Podtrzymanie":"Sustain","Zwolnienie":"Release","Głośność":"Volume",
 "Drive":"Drive","Rechot żaby":"Frog croak","Tempo rechotu":"Croak rate","Szum (efekt)":"Noise (fx)",
 "Szum to samodzielny efekt dźwiękowy — zastępuje oscylatory i filtr.":"Noise is a standalone effect sound — it replaces the oscillators and filter.",
 // Błędy serwera przy zapisie próbki (trasy /synth-probka): serwer odpowiada po polsku i nie zna języka panelu.
 "Nie udało się odczytać próbki.":"Couldn't read the sample.",
 "To nie wygląda na próbkę dźwięku.":"That doesn't look like a sound sample.",
 "To nie jest plik WAV.":"That is not a WAV file.",
 "Próbka musi być WAV PCM 16-bit mono.":"The sample has to be 16-bit mono PCM WAV.",
 "Ta próbka nie ma w sobie dźwięku.":"There is no sound in this sample.",
 "To nie jest identyfikator próbki.":"That is not a sample id.",
 "Nie udało się zapisać próbki.":"Couldn't save the sample.",
 // ===== KARTA „PRÓBKA" W EDYTORZE BRZMIEŃ (rf-25f, 2026-10-19) =====
 // Napisy, które skrypt składa w locie (komunikaty błędów mikrofonu, „Nagrywam… 2,4 s"), mają swoje zdania
 // w samym rf-25f przez `_gl` — tu stoi to, co jest w HTML-u i chodzi po nim walker.
 "🎙 Próbka":"🎙 Sample",
 "Nagraj coś mikrofonem albo wczytaj dźwięk z dysku. Brzmienie zagra tym po całej skali.":
   "Record something with the microphone or load a sound from your disk. The sound plays it across the scale.",
 "⏺ Nagraj":"⏺ Record","⏹ Zatrzymaj":"⏹ Stop","Nagrywam…":"Recording…",
 "Mikrofon włącza się dopiero teraz i gaśnie po nagraniu":"The microphone turns on only now and goes off after recording",
 "Wczytaj dźwięk":"Load a sound",
 "Wybierz plik z dysku albo upuść go na tę kartę":"Pick a file from your disk or drop it on this card",
 "Nie ma jeszcze próbki. Nagraj albo wczytaj dźwięk.":"No sample yet. Record or load a sound.",
 "Przebieg próbki":"Sample waveform",
 "▶ Odsłuchaj":"▶ Listen","Zagraj próbkę brzmieniem, jak usłyszy ją pad":"Play the sample through the sound, as the pad will hear it",
 "🎯 Wykryj nutę":"🎯 Detect note","Znajdź nutę, którą słychać w próbce":"Find the note the sample sings",
 "✂ Przytnij ciszę":"✂ Trim silence","Przestaw znaczniki na granice ciszy. Bajty zostają całe":"Move the markers to the edges of the silence. The bytes stay whole",
 "Usuń próbkę":"Remove sample","Usuń próbkę i wróć do fal":"Remove the sample and go back to waves",
 "Którą nutę słychać w próbce. Od niej liczy się cała skala":"Which note the sample sings. The whole scale is counted from it",
 "Zapętl":"Loop",
 "Od tego miejsca próbka zaczyna się powtarzać":"The sample starts repeating from here",
 "Tu pętla wraca na swój początek":"Here the loop jumps back to its start",
 // — więcej kontroli nad próbką (2026-10-20): wycinek, poziom, centy, wstecz, zlepek, wejście mikrofonowe —
 "Mikrofon":"Microphone","Z którego mikrofonu nagrywać":"Which microphone to record from",
 "🎧 Podsłuch":"🎧 Monitor","Otwórz mikrofon i pokaż poziom, jeszcze nic nie nagrywając":"Open the microphone and show the level without recording anything yet",
 "Podsłuch":"Monitoring",
 "Odliczaj 3-2-1":"Count 3-2-1 in","Trzy sekundy na wzięcie oddechu, zanim ruszy nagranie":"Three seconds to take a breath before the recording starts",
 "Wyrównaj poziom":"Even out the level",
 "Nowe nagranie dostaje poziom 1,00×. Bez tego zostaje tak ciche albo tak głośne, jak wyszło":
   "A new recording gets level 1.00×. Without this it stays as quiet or as loud as it came out",
 "Przebieg próbki — przeciągnij znaczniki, żeby wybrać kawałek":"Sample waveform — drag the markers to pick the piece you want",
 "🔒 Przytnij na stałe":"🔒 Trim for good",
 "Zostaw w pliku sam wycinek. Tego się nie cofnie, ale plik jest mniejszy":"Leave only the chosen piece in the file. There is no undo for this, but the file gets smaller",
 "💾 Zapisz WAV":"💾 Save WAV","Zapisz to, co słychać, jako plik WAV":"Save what you hear as a WAV file",
 "Dostrój":"Fine tune","Dostrojenie w centach: pół tonu to 100 centów, a pokrętło nuty skacze po 50":
   "Fine tuning in cents: a semitone is 100 cents, and the note knob jumps by 50",
 "Nie przestrajaj":"Don't re-tune","Klaśnięcie, bęben albo słowo gra tak samo na całej skali":"A clap, a drum or a word plays the same across the whole scale",
 "Wycinek od":"Piece from","Od tego miejsca nagrania próbka zaczyna grać":"The sample starts playing from this point of the recording",
 "Wycinek do":"Piece to","Tu próbka się kończy. Resztę nagrania słychać nie będzie":"This is where the sample ends. The rest of the recording will not be heard",
 "Jak głośno gra nagranie. 1,00× to tyle, ile w nim zapisano":"How loud the recording plays. 1.00× is as much as was saved in it",
 // „Gra wstecz", nie samo „Wstecz": tamto słowo jest już przyciskiem „Back" w kreatorze i walker nie zna kontekstu
 "Gra wstecz":"Plays backwards","Próbka gra od końca do początku":"The sample plays from its end to its start",
 "Zlepek":"Seam","Zlewa koniec pętli z jej początkiem, żeby szew nie trzaskał":"Blends the end of the loop into its start so the seam doesn't click",
 "Próbka zastępuje oscylatory: nuta rozciąga ją w górę i w dół, a filtr, obwiednia i efekty działają jak zwykle. Znaczniki na przebiegu przeciąga się myszą.":
   "The sample replaces the oscillators: the note stretches it up and down, and the filter, envelope and effects work as usual. The markers on the waveform are dragged with the mouse.",
 "Biblioteka brzmień":"Sound library","bazowe":"base","własne":"custom","zmienione":"changed",
 "Zapisz zmiany":"Save the changes","✕ Anuluj edycję":"✕ Cancel edit","↺ Przywróć domyślny":"↺ Reset to default","🎲 Zaskocz mnie":"🎲 Surprise me",
 "Wylosuj brzmienie do dostrojenia":"Randomise a sound to fine-tune",
 "Systemowe menu wyboru emoji otworzysz skrótem Win + kropka":"Open the system emoji picker with Win + period","Przywróć fabryczne ustawienia tego brzmienia bazowego":"Restore this base sound to factory settings",
 // — per-pad gate (when the pad is allowed to sound) + predefined gate library —
 "Tonika":"Root note","Skala pada":"Pad scale",
 "🔊 Zawsze gra":"🔊 Always plays","📐 Pochyl, by grać":"📐 Tilt to play","🛏️ Płasko, by grać":"🛏️ Flat to play",
 "🌀 Kręć, by grać":"🌀 Spin to play","🧘 Znieruchom, by grać":"🧘 Hold still to play","💥 Potrząśnij, by grać":"💥 Shake to play",
 "🎵 Rytm — ćwierćnuty":"🎵 Rhythm — quarters","🎶 Rytm — ósemki":"🎶 Rhythm — eighths","⚡ Rytm — szesnastki":"⚡ Rhythm — sixteenths",
 "🩴 Rytm — na „i”":"🩴 Rhythm — offbeat","🐎 Rytm — galop":"🐎 Rhythm — gallop","🌫️ Rytm — trans (3-3-2)":"🌫️ Rhythm — trance (3-3-2)",
 "Bez bramkowania — pad gra normalnie.":"No gating — the pad plays normally.",
 "Gra, gdy pochylenie ≥ progu.":"Plays when tilt ≥ threshold.",
 "Gra, gdy prędkość obrotu ≥ progu.":"Plays when spin speed ≥ threshold.","Gra, gdy obrót ≤ progu (bez ruchu).":"Plays when spin ≤ threshold (still).",
 "Gra, gdy urządzenie jest w ruchu.":"Plays when the device is moving.",
 "Tnie dźwięk w rytmie ćwierćnut.":"Chops the sound in a quarter-note rhythm.","Pompuje dźwięk ósemkami.":"Pumps the sound in eighths.",
 "Szybkie, staccatowe cięcie 16-tkowe.":"Fast, staccato sixteenth-note chop.","Gra na słabej części taktu (offbeat).":"Plays on the offbeat.",
 "Galopujący, żywy rytm.":"A galloping, lively rhythm.","Klasyczny wzór trance 3-3-2.":"Classic 3-3-2 trance pattern.",
 "Próg pochylenia":"Tilt threshold","Próg obrotu":"Spin threshold","Czułość ruchu":"Motion sensitivity","Tempo":"Tempo",
 "Roll (lewo/prawo)":"Roll (left/right)","Pitch (przód/tył)":"Pitch (fwd/back)",
 "Pochylenie (0–90°)":"Tilt (0–90°)","Obrót (°/s)":"Twist (°/s)",
 "🐸 Ribbit":"🐸 Ribbit","🎹 Syntezator":"🎹 Synth lead","🪕 Struna":"🪕 Pluck","🎺 Trąbka":"🎺 Trumpet",
 "🪗 Organy":"🪗 Organ","😗 Gwizd":"😗 Whistle","🔔 Marimba":"🔔 Marimba","🎻 Smyczki":"🎻 Strings","🛸 Wobble":"🛸 Wobble",
 "🌫 Przestrzeń":"🌫 Ambient pad","Bas":"Bass","🌪 Szum":"🌪 Noise",
 "🛎 Dzwon":"🛎 Bell","🧪 Kwas":"🧪 Acid","🎼 Pianino elektryczne":"🎼 E-piano","🎤 Chórek":"🎤 Choir",
 "🧸 Pozytywka":"🧸 Music box","🛰 Kosmos":"🛰 Cosmos","🤘 Przester":"🤘 Overdrive","🚨 Syrena":"🚨 Siren",
 "🎷 Klarnet":"🎷 Clarinet","🤖 Robot":"🤖 Robot",
 // 12 brzmień bazowych z 2026-10-02 (fala własna / korektor / krzywizny obwiedni, rf-17)
 "🔆 Pulsar":"🔆 Pulsar","⛪ Hammond":"⛪ Hammond","🗣 Wokoder":"🗣 Vocoder","📻 Radio":"📻 Radio",
 "🦢 Wiolonczela":"🦢 Cello","🌊 Przypływ":"🌊 Tide","🪘 Kalimba":"🪘 Kalimba","🥂 Szkło":"🥂 Glass",
 "💧 Kropla":"💧 Droplet","🎸 Gitara basowa":"🎸 Bass guitar","🫧 Bańka":"🫧 Bubble","🪷 Ropucha":"🪷 Toad",
 "1 okt.":"1 oct.","2 okt.":"2 oct.","3 okt.":"3 oct.","4 okt.":"4 oct.",
 "od C1":"from C1","od C2":"from C2","od C3":"from C3","od C4":"from C4","od C5":"from C5",
 "Kapsle Triki":"Triki capsules",
 "°/s · prędkość":"°/s · speed",
 "Reguła „gdy coś zrobisz kapslem → wykonaj akcję” (np.":"A rule “when you do something with the capsule → run an action” (e.g.",
 ", Pitch, Roll, Wirowanie. Najłatwiejsze („przechyl” / „obróć”). Zalecane na start — i właśnie od niego otwiera się nowy wyzwalacz.":", Pitch, Roll, Spin. The easiest (“tilt” / “twist”). Recommended to start — and it is what a new trigger opens on.",
 "(mapowanie kanałów, „odwróć” oraz „Przyspieszenie wychylenia”).":"(channel mapping, “invert” and “Deflection boost”).",
 "(tryb „Auto”) — nie trzeba uczyć. Ustaw":"(“Auto” mode) — no training needed. Set",
 "= minimum, jak długo po naciśnięciu uznawać przycisk za wciśnięty. Przytrzymany przycisk trzyma tyle, ile go trzymasz, więc dla akcji typu „hamuj, dopóki trzymam” nic tu nie musisz zmieniać. „Konkretny bit” tylko dla zaawansowanych.":"= the minimum time a press counts as held. A button you keep down stays held for as long as you hold it, so for something like “brake while I hold this” there is nothing here to change. “Specific bit” for advanced users only.",
 "— ruszaj kapslem i ustaw próg tak, żeby linia była przekraczana wtedy, kiedy akcja ma się odpalić.":"— move the capsule and set the threshold so the line is crossed when you want to fire.",
 ", każdy w osobnej karcie (":", each in its own card (",
 "= główny, kolejne dodajesz „+ Dodaj warunek”). Każdy warunek to:":"= main, add more with “+ Add condition”). Each condition is:",
 ", albo przycisk wciśnięty). Karta świeci na pomarańczowo, gdy":", or a button is held). The card glows orange when",
 "= wartość przekracza próg zgodnie z porównaniem (":"= the value crosses the threshold per the comparison (",
 "); dla przycisku = wciśnięty.":"); for a button = held.",
 "= wystarczy dowolny. Wybierasz to listą obok „+ Dodaj warunek”.":"= any one is enough. You pick this from the list next to “+ Add condition”.",
 "wyzwalacz jest spełniony (wg ORAZ/LUB). Licznik przy nagłówku sekcji „Warunki — kiedy ma zadziałać” pokazuje":"the trigger is met (per AND/OR). The counter next to the “Conditions — when it fires” heading shows",
 // — 2026-09-02: trzy zachowania i dwie możliwości edytora, których poradnik nie wymieniał
 //   (zatrzask „Przełącznik", źródło warunku „Wyzwalacz", pole „NIE"). Klucze są krótkie i urwane,
 //   bo każdy <b> w akapicie rozcina węzeł tekstowy na osobny klucz.
 
 "trzyma stan „włączony / wyłączony”, a pozostałe pytają ją o niego zamiast powtarzać jej warunek.":"behaviour holds an “on / off” state, and the rest ask it about that instead of repeating its condition.",
 "— pole obok przełącznika źródła w karcie warunku ODWRACA go: warunek liczy się jako spełniony wtedy, kiedy nie jest spełniony (np. „przycisk NIE wciśnięty”, „pochylenie NIE większe niż 30”). Karta z zaznaczonym NIE ma inną ramkę, żeby dało się to zobaczyć bez czytania.":"— the box next to the source switch in a condition card INVERTS it: the condition counts as met exactly when it is NOT met (e.g. “the button is NOT held”, “tilt is NOT above 30”). A card with NOT ticked gets a different frame, so you can see it without reading.",
 
 "(np. „bieg włączony” na podwójne kliknięcie przycisku).":"condition (e.g. “running is on”, flipped by a double click of the button).",
 "(szary — 0, pomarańczowy — część, zielony — wszystkie).":"(grey 0 → orange some → green all).",
 "Przykład ORAZ: „pochylenie > 30":"AND example: “tilt > 30",
 // cudzysłów zamyka się w INNYM węźle niż się otwiera (<b>ORAZ</b> w środku cytatu), stąd ” bez „ w kluczu
 "przycisk wciśnięty → skok” (skok tylko gdy pochylasz i trzymasz przycisk).":"button held → jump” (jump only when you tilt and hold the button).",
 "… Kliknij „Naciśnij klawisz…” by przechwycić dowolny.":"… Click “Press a key…” to capture any one.",
 "— N przekroczeń progu/zakresu (lub kliknięć) w zadanym czasie, np.":"— N threshold/range crossings (or clicks) within a time window, e.g.",
 "spełnienia warunku (np. „w zakresie przez 1 s”).":"the condition holding (e.g. “in range for 1 s”).",
 "(przycisk „▶ Włącz” w nagłówku sekcji). Przycisk":"(the “▶ Enable” button in the section header). The button",
 "— przy teście przełącz się na okno docelowe (gra/notatnik).":"— when testing, switch to the target window (game/notepad).",
 ", próg ~30, akcja = strzałka, zachowanie =":", threshold ~30, action = arrow, behaviour =",
 "Podgląd:":"Preview:",
 "Szczegóły":"Details",
 "Odwróć oś":"Invert axis",
 "włączone":"enabled",
 "niezależnie":"independently",
 "🎹 Wyjście MIDI":"🎹 MIDI output",
 "Kanał MIDI (1–16)":"MIDI channel (1–16)",
 // „📡 Wyjście OSC" was the card's name until it became „Cel domyślny OSC"; the key outlived the
 // card by a few releases and the OSC guide was the last text quoting it. Dropped with that rewrite.
 "📡 Cel domyślny OSC":"📡 Default OSC target",
 // „ODBIORNIK", NOT „URZĄDZENIE": in this app a device is the CAPSULE, and the OSC card was
 // renamed on 2026-09-03 („Odbiorniki OSC", „Dodaj odbiornik OSC", the mapping editor field
 // „Odbiornik"). The four keys below are the fold under the OSC tab, moved to the same word.
 "Odbiorniki OSC — kilka maszyn naraz":"OSC receivers — several machines at once",
 "Cel domyślny stoi w tej liście jako pierwszy wiersz i nie da się go usunąć — dzięki temu usunięcie dowolnego odbiornika zawsze ma dokąd przenieść mapowania. Zanim odbiornik zniknie, dostaje jeszcze wartości parkowania tych mapowań, które do niego mówiły, więc nie zostaje z zapaloną lampą ani wykręconym serwem. Zestaw zapisany jako preset niesie wybór odbiornika razem z mapowaniem; wczytany na komputerze, który takiego odbiornika nie ma, zagra na cel domyślny, zamiast milczeć.":"The default target is the first row of that list and cannot be removed — which is what gives every other receiver somewhere to move its mappings to. Before a receiver goes, it still gets the parking values of the mappings that talked to it, so nothing is left with a lamp on or a servo wound up. A set saved as a preset carries the choice of receiver along with the mapping; loaded on a machine that has no such receiver, it plays on the default target instead of going silent.",
 "Jak połączyć z DAW / wizualami? — wymagania zewnętrzne":"How to connect to a DAW / visuals? — external requirements",
 // ── OSC tab: the "how it works" guide (rf-34). Split the same way the loopMIDI block below is:
 // one key per paragraph / list item, plus the bold term in front of each dash.
 // send journal (rf-16b). The kind labels and the empty state go through _gl() in that file —
 // these are the parts built once at init, which the walker can key on.
 "Dziennik wysyłek OSC":"OSC send journal","Dziennik wysyłek MIDI":"MIDI send journal",
 "każde zdarzenie osobno · sterowanie ciągłe streszczane co 2 s":"every event on its own · a continuous stream summarised every 2 s",
 "nuty i zdarzenia osobno · sterowanie ciągłe streszczane co 2 s":"notes and events on their own · a continuous stream summarised every 2 s",
 "każdy pakiet":"every packet",
 "Pokazuj każdy pakiet z osobna zamiast podsumowania co dwie sekundy. Przy sterowaniu ciągłym bufor 800 wpisów zapełnia się w kilkanaście sekund.":"Show every packet on its own instead of a summary every two seconds. With a continuous mapping the 800-entry buffer fills up in under twenty seconds.",
 "Co leci po kablu":"What goes down the wire",
 "Profil odbiornika — czym jest, a czym nie jest":"The receiver profile — what it is, and what it is not",
 "Samo OSC nie zna pojęcia „PWM”, „serwo” ani „DAC”. Na drucie są tylko trzy typy: liczba całkowita, zmiennoprzecinkowa i wartość logiczna. Profil jest więc NAZWĄ dla pary (typ argumentu, zakres), jakiej oczekuje Twój odbiornik — wygodą, żebyś nie musiał pamiętać, że „serwo” to liczba całkowita przycięta do 0–180. Co zrobi z tą liczbą, nadal decyduje program albo szkic po drugiej stronie.":"OSC itself knows nothing about “PWM”, “servos” or “DACs”. There are only three types on the wire: integer, float and boolean. A profile is therefore a NAME for the pair (argument type, range) your receiver expects — a convenience, so you do not have to remember that “servo” means an integer clamped to 0–180. What happens to that number is still up to the program or the sketch on the other side.",
 "— liczba zmiennoprzecinkowa 0..1, konwencja programów AV: TouchOSC, Resolume, TouchDesigner, VRChat.":"— a float 0..1, the convention of AV software: TouchOSC, Resolume, TouchDesigner, VRChat.",
 "— wartość logiczna: na drucie jedzie sam tag prawda/fałsz, bez ciała wiadomości.":"— a boolean: the wire carries the true/false tag alone, with no message body.",
 "— liczba całkowita 0..100, wypełnienie w procentach.":"— an integer 0..100, duty cycle in percent.",
 "Serwo 0–180°, 0–270°, 0–360°":"Servo 0–180°, 0–270°, 0–360°",
 "— liczba całkowita, kąt w stopniach. Wybierz ten, który odpowiada Twojemu serwu. Uwaga: „serwo 360” bywa dwuznaczne — profil opisuje serwo POZYCYJNE o zakresie 360°, a nie serwo ciągłego obrotu, w którym liczba oznacza prędkość i kierunek, a nie kąt. Do takiego użyj profilu PWM albo szerokości impulsu i pamiętaj, że wartość środkowa oznacza postój.":"— an integer, an angle in degrees. Pick the one that matches your servo. Careful: “360 servo” is ambiguous — this profile describes a POSITIONAL servo with a 360° range, not a continuous-rotation one, where the number means speed and direction rather than an angle. For those use the PWM or pulse-width profile, and remember that the middle value means stopped.",
 "— drugi powszechny dialekt serw: zamiast kąta wysyłasz długość impulsu sterującego, zwykle 1000 µs dla jednej skrajności, 1500 µs dla środka i 2000 µs dla drugiej.":"— the other common servo dialect: instead of an angle you send the length of the control pulse, usually 1000 µs for one end, 1500 µs for the middle and 2000 µs for the other.",
 "Zakres roboczy — ile z odbiornika naprawdę używasz":"The working range — how much of the receiver you actually use",
 "Liczby przy profilu to pełne możliwości odbiornika, a nie zakres, którego musisz użyć. Zaznacz „własny zakres roboczy”, a mapowanie będzie pracować tylko w wybranym oknie — profil zostaje, razem ze swoimi zabezpieczeniami. Wpisane wartości są przycinane do możliwości profilu, więc serwa 0–180° nie da się poprosić o 250. Odwrócenie okna (min większy od max) odwraca kierunek: największe wychylenie kapsla daje najmniejszą wartość.":"The numbers next to a profile are the receiver's full span, not the range you have to use. Tick “custom working range” and the mapping will work inside the window you choose — the profile stays, and so do its guard rails. What you type is clamped to what the profile allows, so a 0–180° servo can never be asked for 250. Reversing the window (min above max) reverses the direction: the largest tilt gives the smallest value.",
 "To nie jest funkcja tylko dla serw. Przykłady, w których okno jest ważniejsze od pełnego zakresu: mechanika pozwala serwu na 10–25° i dalej uderza w ogranicznik, wentylator na PWM dławi się poniżej 30%, dioda mruga przy najniższym wypełnieniu, przetwornik ma bezpieczne okno napięcia, a suwak w programie AV nie powinien schodzić do zera.":"This is not a servo-only feature. Cases where the window matters more than the full span: the mechanism only leaves a servo 10–25° before it hits an end stop, a PWM fan stalls below 30%, an LED flickers at the lowest duty, a converter has a safe voltage window, and a fader in AV software should not drop to zero.",
 "— liczba całkowita, gdy odbiornik liczy w skali dziesięciobitowej.":"— an integer, for a receiver that counts on a ten-bit scale.",
 "DAC 8-bit / 12-bit":"8-bit / 12-bit DAC",
 "— 0..255 albo 0..4095. Rozdzielone celowo: ESP32 ma przetwornik ośmiobitowy, a Due czy MCP4725 dwunastobitowy, więc jeden wspólny preset musiałby okłamać jednego z nich.":"— 0..255 or 0..4095. Split on purpose: an ESP32 has an eight-bit converter while a Due or an MCP4725 has a twelve-bit one, so a single shared preset would have to lie to one of them.",
 "Własny":"Custom",
 "— typ i zakres ustawiasz ręcznie. Tak działały wszystkie mapowania, zanim profile powstały, i tak nadal działają Twoje stare mapowania — nic im się nie zmieniło.":"— you set the type and the range by hand. That is how every mapping worked before profiles existed, and how your old mappings still work — nothing about them changed.",
 "Zachowanie na progu — druga, niezależna oś":"Behaviour at the threshold — the second, independent axis",
 "Profil mówi, JAKA wartość poleci. Zachowanie mówi, KIEDY i JAK DŁUGO. To są dwie osobne decyzje, dlatego są dwoma osobnymi polami: dzięki temu da się ustawić „impuls 300 ms, ale wartością PWM 100%”. Pole pojawia się tylko w trybie progowym — w ciągłym wartość płynie razem z ruchem i nie ma żadnego zbocza.":"The profile says WHICH value is sent. The behaviour says WHEN and FOR HOW LONG. Those are two separate decisions, which is why they are two separate fields: it makes “a 300 ms pulse, but at PWM 100%” expressible. The field only appears in threshold mode — in continuous mode the value flows along with the movement and there is no edge at all.",
 "Impuls":"Impulse","Bramka":"Gate","Przełącznik":"Latch","Impuls X ms":"Timed pulse",
 "— jeden komunikat w chwili przekroczenia progu.":"— a single message the moment the threshold is crossed.",
 "— wartość górna, dopóki próg jest przekroczony, i dolna, gdy sygnał zejdzie poniżej.":"— the high value while the threshold stays crossed, and the low one once the signal drops below it.",
 "— każde przekroczenie progu zmienia stan na przeciwny, jak włącznik światła. Powrót poniżej progu nic nie wysyła.":"— every crossing flips the state, like a light switch. Dropping back below the threshold sends nothing.",
 "— wartość górna, a po zadanym czasie odbiornik dostaje dolną, bez czekania, aż zejdziesz poniżej progu. Minimum to 20 ms, bo zbocze opadające jedzie na strumieniu próbek z kapsla (około 50 Hz) — krótszego impulsu nie dałoby się dotrzymać, tylko obiecać.":"— the high value, and after the time you set the receiver gets the low one, without waiting for you to drop back below the threshold. The floor is 20 ms, because the falling edge rides on the capsule's sample stream (about 50 Hz) — a shorter pulse could not be kept, only promised.",
 "Tempo i niezawodność — tylko w trybie ciągłym":"Pace and reliability — continuous mode only",
 "Trzy pola pilnują, żeby strumień nie zalał odbiornika ani nie urwał się niezauważenie. W trybie progowym ich nie ma, bo tam komunikat leci na zboczu i żadne z nich nic by nie robiło.":"Three fields keep the stream from flooding the receiver or dying unnoticed. They are absent in threshold mode, where the message goes out on the edge and none of them would do anything.",
 "Min odstęp":"Minimum interval","Limit prędkości":"Speed limit","Powtarzaj co":"Repeat every",
 "— górna granica tempa, czyli ile komunikatów na sekundę najwyżej. Chroni odbiornik przed zalaniem.":"— the upper bound on pace, i.e. at most this many messages per second. Keeps the receiver from being flooded.",
 "— w jednostkach wyjścia na sekundę. Dla serwa 0–180 wpisanie 90 znaczy „pełny przejazd nie szybciej niż w dwie sekundy”. Bez tego gwałtowny ruch kapsla to dla mechaniki skok z jednej skrajności w drugą; z tym serwo dostaje gwarantowany czas przejazdu. Zero wyłącza limit.":"— in output units per second. On a 0–180 servo, 90 means “full travel no faster than two seconds”. Without it a sharp move of the capsule is, for the mechanism, a jump from one end to the other; with it the servo gets a guaranteed travel time. Zero switches the limit off.",
 "— dolna granica, czyli bicie serca strumienia. UDP nie potwierdza dostarczenia niczego: bez powtarzania nieruchomy kapsel oznacza zupełną ciszę, więc odbiornik nie odróżni „leży spokojnie” od „padło Wi-Fi”, a zgubiony ostatni pakiet gestu zostawia go na złej wartości już na zawsze. Z powtarzaniem błąd naprawia się sam w ciągu jednego okresu. Zero wyłącza, a wartości poniżej 100 ms silnik też traktuje jak zero. Powtarzanie nigdy nie przyspieszy strumienia ponad zadeklarowany minimalny odstęp.":"— the lower bound, i.e. the stream's heartbeat. UDP acknowledges nothing: without repeating, a motionless capsule means total silence, so the receiver cannot tell “lying still” from “the Wi-Fi died”, and a lost final packet of a gesture leaves it at the wrong value for good. With repeating the error heals itself within one period. Zero switches it off, and the engine also treats anything below 100 ms as zero. Repeating can never make the stream faster than the declared minimum interval.",
 "Wartość przy rozbrojeniu — czyli parkowanie":"Value on disarm — parking, that is",
 "UDP nie ma potwierdzeń ani zamykania połączenia. Gdy rozbroisz aplikację, wyłączysz grupę OSC albo kapsel się rozłączy, odbiornik po prostu zostaje na ostatniej wartości, jaką dostał: serwo wykręcone, lampa zapalona. To pole wysyła wtedy jeden komunikat z wartością bezpieczną. Puste znaczy „nie parkuj”. Przełącznik i impuls parkują się same na wartości dolnej, więc nie zostawisz po sobie zapalonego światła.":"UDP has no acknowledgements and no closing of a connection. When you disarm the app, switch the OSC group off or the capsule disconnects, the receiver simply stays at the last value it got: the servo turned out, the lamp lit. This field then sends one message with a safe value. Empty means “do not park”. A latch and a pulse park themselves at the low value, so you will not leave a light on behind you.",
 "Jak sprawdzić, że działa":"How to check that it works",
 "Przycisk „Test wyjścia” w edytorze mapowania wysyła komunikat tą samą ścieżką co silnik — z typem i wartością z profilu, a nie z zastępczą jedynką. Żeby zobaczyć drugi koniec bez żadnego sprzętu, uruchom w katalogu aplikacji skrypt nasłuchujący z folderu tools (wypisuje pakiety na żywo) albo darmowy program Protokol od twórców TouchOSC.":"The “Test output” button in the mapping editor sends a message down the same path the engine uses — with the type and the value from the profile, not a stand-in 1. To watch the other end with no hardware at all, run the listener script from the tools folder in the app's directory (it prints packets live), or the free Protokol app by the TouchOSC makers.",
 "Od czego zacząć: „Nowe mapowanie OSC”, źródło Pochylenie, profil „Serwo 0–180°”, tryb Ciągły. Przechyl kapsel — po drugiej stronie masz kąt 0–180. Potem przełącz tryb na Próg i pobaw się zachowaniami; linijka pod polami zawsze pokazuje, co dokładnie poleci.":"Where to start: “New OSC mapping”, source Tilt, profile “Servo 0–180°”, mode Continuous. Tilt the capsule — the other end gets an angle of 0–180. Then switch the mode to Threshold and play with the behaviours; the line under the fields always shows exactly what will be sent.",
 "Windows nie ma wbudowanego wirtualnego portu MIDI. Aby Twój program zobaczył RibbitFlip jako urządzenie MIDI, użyj darmowego":"Windows has no built-in virtual MIDI port. So your program sees RibbitFlip as a MIDI device, use the free",
 "— tworzy „wirtualny kabel MIDI” między tą aplikacją a DAW/wizualami.":"— it creates a “virtual MIDI cable” between this app and your DAW/visuals.",
 "Uruchom loopMIDI → na dole wpisz nazwę portu (np.":"Run loopMIDI → at the bottom type a port name (e.g.",
 "🔄 Odśwież":"🔄 Refresh",
 "i wybierz ten port na liście „Port MIDI OUT” wyżej.":"and pick that port from the “MIDI OUT port” list above.",
 "wejście MIDI":"MIDI input",
 "Bez loopMIDI MIDI trafia tylko do wbudowanego „Microsoft GS Wavetable Synth” (usłyszysz dźwięki, ale DAW go nie zobaczy). loopMIDI to darmowy program zewnętrzny (Tobias Erichsen) —":"Without loopMIDI, MIDI only reaches the built-in “Microsoft GS Wavetable Synth” (you'll hear sounds, but a DAW won't see it). loopMIDI is free third-party software (Tobias Erichsen) —",
 "; nie dołączamy go do RibbitFlip, aby uszanować licencję autora.":"; we don't bundle it with RibbitFlip, to respect the author's license.",
 "na adres aplikacji nasłuchującej (np.":"to the address of the listening app (e.g.",
 "🎛 Cele MIDI — co wybrać dla którego parametru":"🎛 MIDI targets — what to pick for each parameter",
 "— standardowy Control Change 0–127 (głośność, filtr, dowolny fader w DAW).":"— standard Control Change 0–127 (volume, filter, any fader in a DAW).",
 "— para CC (numer + numer+32) dla precyzji 0–16383 (płynne przemiaty bez schodków).":"— a CC pair (number + number+32) for 0–16383 precision (smooth sweeps without stepping).",
 "— 14-bit, wycentrowany (środek 8192) — naturalny dla pitch/roll; włącz":"— 14-bit, centred (middle 8192) — natural for pitch/roll; enable",
 "martwą strefę środka":"the centre dead zone",
 "— nacisk kanału (channel pressure) 0–127 — do vibrato / dynamiki.":"— channel pressure 0–127 — for vibrato / dynamics.",
 "— Program Change: przełącza preset w DAW; działa tylko w":"— Program Change: switches the preset in a DAW; works only in",
 "(każde przekroczenie włącza/wyłącza).":"(each crossing toggles on/off).",
 "Dodatkowo każde mapowanie ma własny":"Additionally, each mapping has its own",
 "kanał":"channel",
 "(— = kanał slotu),":"(— = slot channel),",
 "wygładzanie":"smoothing",
 "(0–500 ms) i — dla celów dwubiegunowych —":"(0–500 ms) and — for bipolar targets —",
 "z martwą strefą środka. Przycisk":"with a centre dead zone. The",
 "u dołu wysyła „All Notes Off” na wszystkich kanałach (gasi wiszące nuty).":"button at the bottom sends “All Notes Off” on every channel (kills hanging notes).",
 "źródło (oś / pochylenie) → komunikat MIDI; pasek = wartość na żywo":"source (axis / tilt) → a MIDI message; the bar = live value",
 // — MIDI and OSC split into two tabs with independent switches —
 "Kontroler MIDI":"MIDI controller","Kontroler OSC":"OSC controller",
 "Nowe mapowanie OSC":"New OSC mapping",
 "Brak mapowań MIDI. Kliknij „Nowe mapowanie”, wybierz źródło (np. Pochylenie) i cel (CC, Nuta, Pitch Bend…).":"No MIDI mappings. Click “New mapping”, pick a source (e.g. Tilt) and a target (CC, Note, Pitch Bend…).",
 "⚠ NA ŻYWO — MIDI wysyłane z ruchu urządzenia.":"⚠ LIVE — MIDI sent from device motion.",
 
 
 "źródło (oś / pochylenie) → adres OSC; pasek = wartość na żywo":"source (axis / tilt) → OSC address; the bar = live value",
 "Gdy włączone, ruch kapsla wysyła MIDI (CC, nuty) do DAW, Resolume czy wizualizacji.":"When on, the capsule's motion sends MIDI (CC, notes) to a DAW, Resolume or visuals.",
 "OSC po UDP":"OSC over UDP",
 "niezależnie od MIDI":"independently of MIDI",
 // Pary „Zapisano — mapowanie jest teraz na ekranie OSC/MIDI ✓" ODESZŁY razem z rozwijakiem, który
 // przerzucał mapowanie między protokołami. Protokół wybiera zakładka, a drugą drogę robi kopia.
 "Zapisano mapowanie ✓":"Mapping saved ✓",
 "Kopia jako mapowanie OSC — uzupełnij adres i zapisz":"A copy as an OSC mapping — fill in the address and save",
 "Kopia jako mapowanie MIDI — sprawdź numer CC i zapisz":"A copy as a MIDI mapping — check the CC number and save",
 // — mapping-row and mapping-editor buttons (rf-16). „✓ Zapisz mapowanie" is deliberately NOT
 //   „Zapisz zmiany": that second label belongs to the Library, where it means „write the
 //   capsule's configuration into the preset". Two buttons with one label on one screen, doing
 //   two different things, is the cheapest way to somebody else's mistake.
 "Usuń mapowanie":"Delete the mapping",
 "✓ Dodaj mapowanie":"✓ Add the mapping","✓ Zapisz mapowanie":"✓ Save the mapping",
 // Nagłówek edytora MIDI/OSC: „✎ Edytujesz: <b>nazwa</b>" — słowo przed pogrubieniem jest osobnym
 // węzłem i nie miało pary (nazwa w <b> jest składana przez _gl w rf-16, więc klucza nie potrzebuje).
 "✎ Edytujesz:":"✎ Editing:",
 "▷ Test":"▷ Test","Testuj mapowanie":"Test the mapping","▷ Test wyjścia":"▷ Test the output",
 "Kanał mapowania (puste = kanał grupy)":"Mapping channel (empty = the group's channel)",
 // — the OSC screen: what is per capsule and what is shared by the whole app (rf-49e / the card
 //   headers). The sub-tab above says „settings of this module on the selected capsule", so the
 //   two cards that are NOT per capsule have to say so themselves.
 "host i port wspólne dla wszystkich kapsli":"host and port shared by every capsule",
 "Tu mówi każde mapowanie, któremu nie wskazano odbiornika. Prefiks adresu jest własny dla każdego kapsla.":"Every mapping with no receiver picked talks here. The address prefix belongs to each capsule separately.",
 // — response curves (easing) + visual preview —
 "Krzywa (easing)":"Curve (easing)","↕ odbij krzywą":"↕ flip the curve",
 "Podgląd — tak będzie wyglądał ruch":"Preview — how the motion will feel",
 "na pasku: szary = czas (jednostajnie) · różowy = ruch po tej krzywej · zielony = wyjście na żywo":"on the strip: grey = time (uniform) · pink = motion along this curve · green = live output",
 "Podstawowe":"Basic","Esowate":"S-shaped","Mocne kontrasty":"Strong contrasts","Specjalne":"Special",
 "Precyzyjna (kwadrat)":"Precise (square)","Precyzyjna mocna":"Precise strong",
 "Precyzyjna skrajna":"Precise extreme","Czuła (pierwiastek)":"Sensitive (sqrt)","Czuła mocna":"Sensitive strong",
 "Czuła (klasyczna)":"Sensitive (classic)","Esowata łagodna":"Smooth S","Esowata mocna":"Smoother S",
 "Sinus — wejście":"Sine — in","Sinus — wyjście":"Sine — out","Sinus — oba końce":"Sine — in-out",
 "Kołowa — wejście":"Circular — in","Kołowa — wyjście":"Circular — out","Kołowa — oba końce":"Circular — in-out",
 "Wykładnicza — wejście":"Exponential — in","Wykładnicza — wyjście":"Exponential — out",
 "Schodkowa":"Stepped","Własna (bezier)":"Custom (bezier)",
 "Precyzyjna (kwadrat) — starszy zapis":"Precise (square) — older spelling",
 // Wzory w `title` przy opcjach krzywej (MI_CURVES w rf-16): większość to sam wzór, ale cztery
 // niosą zdanie po polsku, a jedna jest samym słowem.
 "t^0.55 — zachowana dla zgodności":"t^0.55 — kept for compatibility",
 "smoothstep — najlepsza domyślna dla serwa":"smoothstep — the best default for a servo",
 "złożenie":"a composition of both",
 "floor(t·n)/(n−1) — wartości dyskretne, n = curveN (domyślnie 8)":
   "floor(t·n)/(n−1) — discrete values, n = curveN (8 by default)",
 "t² — starszy klucz, to samo co „Precyzyjna (kwadrat)”":"t² — an older key, the same as “Precise (square)”",
 "cubic-bezier(x1,y1,x2,y2) z pola curveBez":"cubic-bezier(x1,y1,x2,y2) from the curveBez field",
 "Oś (kanał)":"Axis (channel)",
 "Pady grające":"Play pads",
 "dotknij pada albo rusz kapslem, żeby zagrać · dźwięk lokalny, nie wysyła MIDI ani OSC":"touch a pad or move the capsule to play · local sound, sends no MIDI or OSC",
 "Biblioteka dźwięków":"Sound library",
 "własne brzmienia i ich edycja":"your own sounds and their editor",
 "Pętla testowa":"Test loop",
 "klik = osobna nuta · przeciągnij = jedna długa (przytrzymana) · klik w nutę = usuń. Zapętl, by usłyszeć":"click = a separate note · drag = one long (held) · click a note = delete. Loop it to hear",
 "▶ Zapętl":"▶ Loop",
 "🔊 Głośność":"🔊 Volume",
 "Jasność":"Brightness",
 "Cięcie basu":"Bass cut",
 "Oś X":"X axis",
 "Oś Y":"Y axis",
 "Dodaj pad grający":"Add a play pad",
 "Pady efektów":"Effect pads",
 "pady XY sterujące efektami":"XY pads that drive effects",
 "Dodaj pad efektów":"Add an effect pad",
 "Mapowanie kanałów":"Channel mapping",
 "= szybciej osiągasz wychylenie,":"= you reach full deflection faster,",
 "(5 bajtów). Znaczenie bajtów nieudokumentowane —":"(5 bytes). The meaning of the bytes is undocumented —",
 "i obserwuj, które bity się zmieniają (podświetlone na żółto). B0 to nagłówek.":"and watch which bits change (highlighted in yellow). B0 is the header.",
 "Niższa częstotliwość = mniej prądu, ale wyzwalacze reagują wolniej. Komenda wybudzenia (hex) pochodzi z inżynierii wstecznej —":"A lower frequency = less power, but less responsive triggers. The wake command (hex) comes from reverse-engineering —",
 "zmień i obserwuj „Częstotliwość (Hz)”":"change it and watch “Frequency (Hz)”",
 "w panelu połączenia. Domyślna ≈ 50 Hz. Po zmianie: Uśpij → Wznów (lub połącz ponownie).":"in the connection panel. Default ≈ 50 Hz. After a change: Sleep → Resume (or reconnect).",
 "to jeden plik z konfiguracją aplikacji + zestawem każdego urządzenia (np. kapsel 1 i 2). Przy imporcie z pliku pojawia się":"is a single file with the app config + the setup of every device (e.g. capsule 1 and 2). When importing from a file you get a",
 "podgląd bezpieczeństwa":"safety preview",
 ": możesz wczytać":": you can load",
 "0 pakietów":"0 packets",
 "Kompakt":"Compact",
 "Orientacja:":"Orientation:",
 // Kula albo kapsel w podglądzie orientacji (rf-14d) — karta Czujnik i pasek ściągi.
 "Model:":"Model:",
 "Co pokazuje podgląd 3D: kulę z siatką osi albo model kapsla":"What the 3D preview shows: the ball with the axis grid, or a model of the capsule",
 // Skin kapsla (2026-11-19): wybór obok „Kapsel”, lista w rf-14d (KAPSEL_SKINY).
 "Wygląd kapsla: ta sama grafika w pigułce i w podglądzie 3D":"Capsule look: the same picture on the pill and in the 3D preview",
 "Klasyczny":"Classic","Strzałki":"Arrows","Osie":"Axes","Szew":"Seam","Punk":"Punk","Piorun":"Lightning",
 "Czaszka":"Skull","Żaba":"Frog","Irokez":"Mohawk","Czaszka z ćwiekami":"Studded skull",
 "Najważniejsze + odliczanie":"Essentials + counting time",
 "Kula orientacji 3D":"3D orientation sphere",
 "Inklinometr 2D — pochylenie + obrót":"2D inclinometer — tilt + twist",
 "— korekta kierunku nakładana na kalibrację osi 3D":"— direction fix on top of the 3D axis calibration",

 // — text-node fragments: inline markup splits sentences, so each fragment needs its own key —
 "i":"and",
 "Nazwa pada":"Pad name",
 "Brzmienie tego pada":"This pad's sound",
 "Otwiera zakładkę Brzmienia z pustym brzmieniem: ustaw je, nazwij i zapisz, a pojawi się na liście brzmień każdego pada":"Opens the Sounds tab with a blank sound: shape it, name it and save it, and it appears in every pad's list of sounds",
 "Wibrato z obrotu":"Vibrato from twist",
 "🎹 MIDI → DAW / VJ (Ableton, Reaper, FL Studio, Resolume) — wymaga loopMIDI":"🎹 MIDI → DAW / VJ (Ableton, Reaper, FL Studio, Resolume) — requires loopMIDI",
 "(np.":"(e.g.",
 "(gdy >1 warunek):":"(when >1 condition):",
 "— aktywuje po X ms":"— activates after X ms",
 "nieprzerwanego":"of uninterrupted",
 "Prefiks adresu":"Address prefix",
 "🎼 Skala":"🎼 Scale",
 "Rodzaj":"Type",
 "przeczytaj":"read",
 "Pobierz i zainstaluj":"Download and install",
 ") i kliknij":") and click",
 "Tutaj kliknij":"Here click",
 "W DAW / Resolume wybierz ten sam port jako":"In your DAW / Resolume pick the same port as",
 "— gotowe, od teraz steruje ruch kapsla.":"— done, the capsule’s motion controls it.",
 "instalujesz je samodzielnie":"you install it yourself",
 "📡 OSC (TouchOSC, Resolume, TouchDesigner, VRChat) — bez instalacji":"📡 OSC (TouchOSC, Resolume, TouchDesigner, VRChat) — no install",
 "lokalnie, albo IP tabletu/telefonu z TouchOSC w tej samej sieci Wi‑Fi). Cel OSC ma":"locally, or the IP of a tablet/phone running TouchOSC on the same Wi‑Fi network). The OSC target has",
 "typ argumentu":"argument type",
 "lub":"or",
 "wycentrowane":"centred",
 "trybie progowym":"threshold mode",
 "(na zboczu).":"(on the edge).",
 "Nuta":"Note",
 "— nuta ze skali; w trybie progowym opcja":"— a note from the scale; in threshold mode the option",
 "zatrzask":"latch",
 "wycentrowanie":"centering",
 "🎚 Filtr":"🎚 Filter",
 "▶ Testuj":"▶ Test",
 "Od nuty":"From note",
 "🖱 Drag dotyku":"🖱 Touch drag",
 "≈ Wibrato":"≈ Vibrato",
 "Efekty pada:":"Pad effects:",
 // — pad effect switches (bypass only; the slider level is kept) —
 "Wł.":"On","Wył.":"Off",
 "Włącz lub wyłącz ten efekt — poziom suwaka zostaje zapamiętany":"Turn this effect on or off — the slider level is remembered",
 "Jasność — włącznik efektu":"Brightness — effect switch",
 "Cięcie basu — włącznik efektu":"Bass cut — effect switch",
 "Tremolo — włącznik efektu":"Tremolo — effect switch",
 "Zakres ±":"Range ±",
 "Przyspieszenie wychylenia":"Deflection boost",
 "(zakres":"(range",
 "Pakiet statusu":"Status packet",
 "Zapisz zestaw":"Save setup",
 "tylko bezpieczne":"only the safe",
 "wszystko":"everything",
 "obok aplikacji.":"next to the app.",
 // — attribute values (only the attributes listed in _i18nAttrs are ever translated) —
 "Wykresy spełnienia warunków + postęp":"Condition-satisfaction charts + progress",
 "Gdy kapsel leży nieruchomo >2 s, powoli zeruje dryf żyroskopu (kanały ruchu). Nie rusza akcelerometru.":"When the capsule lies still >2 s, it slowly zeroes the gyroscope drift (motion channels). It does not touch the accelerometer.",
 "Odśwież listę portów MIDI":"Refresh the MIDI port list",
 "Włącz/wyłącz pady (dźwięk i podgląd — lokalnie w przeglądarce)":"Enable/disable the pads (sound and preview — local to the browser)",
 "Zatrzymaj zacięte / wiszące dźwięki (panika)":"Stop stuck / hanging sounds (panic)",
 // #padKill — jedyny angielski napis w polskim panelu do 2026-09-02 („Kill stuck audio"), przy
 // polskim dymku tuż obok. Teraz po polsku, a parę czyta spacer i18n jak każdą inną.
 "⏹ Ucisz zacięte dźwięki":"⏹ Silence stuck audio",
 "np. Moja Żaba":"e.g. My Frog",
 "Zagraj krótkie demo (arpeggio)":"Play a short demo (arpeggio)",
 "Naciśnij i przytrzymaj, aby usłyszeć atak/podtrzymanie/zwolnienie":"Press and hold to hear attack/sustain/release",
 "Ciągły dźwięk — słyszysz zmiany parametrów na żywo":"Continuous sound — hear parameter changes live",
 // pads: the third transition mode — no scale, no notes, pitch straight off the pad's width
 "∿ Superpłynne":"∿ Ultra-smooth",
 "Przejścia":"Transitions","Kto gra":"Who plays it","Brzmienie":"Sound","Po puszczeniu":"After release",
 // pads: what the vertical axis steers, and across how much of that parameter
 "↕ Oś Y steruje":"↕ Y axis steers","↕ Zakres osi Y":"↕ Y axis range",
 "Jasność + głośność":"Brightness + loudness","Tylko jasność (barwa)":"Brightness only (tone)",
 "Tylko głośność":"Loudness only","Wibrato":"Vibrato","Nic — Y nie zmienia dźwięku":"Nothing — Y leaves the sound alone",
 // …and the targets that reach the sound's character: the optgroup headings, the entries and the
 // one-line hint shown under the select (rf-19 PAD_Y_TARGETS)
 "Barwa i filtr":"Tone and filter","Głośność i czas":"Loudness and time","Zagęszczenie":"Thickening",
 "Jasność + rezonans":"Brightness + resonance","Rezonans filtra":"Filter resonance",
 "Obwiednia filtra (kop na starcie)":"Filter envelope (kick at the start)",
 "Atak (jak szybko wchodzi)":"Attack (how fast it comes in)","Wybrzmienie (jak długo gaśnie)":"Tail (how long it fades)",
 "Rozstrojenie (unison)":"Detune (unison)",
 "Wyżej = jaśniej i głośniej naraz.":"Higher = brighter and louder at once.",
 "Wyżej = filtr otwiera się szerzej.":"Higher = the filter opens wider.",
 "Wyżej = jaśniej i ostrzej — klasyczne przeciągnięcie filtra.":"Higher = brighter and sharper — the classic filter sweep.",
 "Wyżej = mocniejsze podbicie przy odcięciu, aż do gwizdu.":"Higher = a stronger peak at the cutoff, up to a whistle.",
 "Wyżej = mocniejszy kop filtra w chwili uderzenia. Słychać dopiero od NASTĘPNEJ nuty. Nie dotyczy 🌪 Szumu.":"Higher = a harder filter kick at the strike. Takes effect on the NEXT note. Does not apply to 🌪 Noise.",
 "Wyżej = głośniej.":"Higher = louder.",
 "Wyżej = leniwiej narasta: z uderzenia robi się nabrzmiewanie. Słychać dopiero od NASTĘPNEJ nuty.":"Higher = a lazier rise: a strike turns into a swell. Takes effect on the NEXT note.",
 "Wyżej = dłuższy ogon. Przy szarpanych liczy się miejsce uderzenia, przy ciągłych — miejsce puszczenia.":"Higher = a longer tail. For plucked sounds what counts is where you strike, for sustained ones where you let go.",
 "Wyżej = grubiej: dochodzi para rozstrojonych oscylatorów, na zerze zupełnie cicha. Nie dotyczy 🌪 Szumu.":"Higher = thicker: a detuned pair of oscillators joins in, dead silent at zero. Does not apply to 🌪 Noise.",
 "Wyżej = głębsze wibrato.":"Higher = deeper vibrato.",
 "Wyżej = więcej brudu. Nie dotyczy 🌪 Szumu.":"Higher = more grit. Does not apply to 🌪 Noise.",
 "Y nie rusza dźwięku — pad gra samą wysokością.":"Y leaves the sound alone — the pad plays on pitch only.",
 "Co zmienia pionowe położenie na padzie — od barwy i głośności po rezonans, atak, wybrzmienie, rozstrojenie i przester. „Nic” zostawia Y bez wpływu na dźwięk: pad gra wtedy samą wysokością.":"What the vertical position on the pad changes — from tone and loudness to resonance, attack, tail, detune and drive. “Nothing” leaves Y with no effect on the sound: the pad then plays on pitch alone.",
 "Wycinek zakresu tego parametru, na który rozciąga się wysokość pada. Dół padu = pierwsza liczba, góra = druga. Można je odwrócić — wtedy na dole jest więcej.":"The slice of that parameter's range the pad's height is stretched over. Bottom of the pad = the first number, top = the second. Swap them and the bottom gets more.",
 "Przejścia między dźwiękami":"Transitions between sounds",
 "Skokowe: natychmiastowy skok na kolejną nutę skali, bez ślizgu":"Stepped: an instant jump to the next note of the scale, no slide",
 "Płynne: portamento — dźwięk zjeżdża między nutami, tym dłużej im większy skok":"Smooth: portamento — the sound slides between notes, longer the bigger the leap",
 "Superpłynne: bez skali i bez nut — cała szerokość padu to jedno pasmo wysokości, dźwięk idzie za palcem bez żadnych progów":"Ultra-smooth: no scale and no notes — the pad's whole width is one pitch band, the sound follows your finger with no steps at all",
 "Superpłynne gra bez skali — skala i tonika nic tu nie zmieniają":"Ultra-smooth plays without a scale — the scale and root change nothing here",
 "Zapisz brzmienie na liście":"Save the sound to the list",
 "Odtwórz / zatrzymaj pętlę":"Play / stop the loop",
 "Tempo pętli":"Loop tempo",
 "Swing — przesuwa co drugą 16-tkę (shuffle)":"Swing — shifts every other 16th (shuffle)",
 "Wyczyść pętlę":"Clear the loop",
 "Duplikuj do własnego brzmienia":"Duplicate into your own sound",
 "Pełny ekran":"Full screen",
 "Płynne przejścia (portamento)":"Smooth transitions (portamento)",
 "Dodaj kolejny niezależny pad grający":"Add another independent play pad",
 "Dodaj pad sterujący efektami":"Add a pad that controls effects",
 "Skopiuj konfigurację osi 3D z wybranego Triki do bieżącego":"Copy the 3D axis config from the selected Triki to the current one",
 "Kapsel przyjmuje tylko jedno połączenie naraz. Jeśli nie chce się połączyć, zamknij Żappkę na telefonie oraz inne programy sterujące kapslem, odczekaj chwilę i spróbuj ponownie.":"The capsule accepts only one connection at a time. If it will not connect, close the Żappka app on your phone and any other program that talks to the capsule, wait a moment and try again.",
 "Odczyt baterii jest orientacyjny — tanie urządzenia BLE raportują poziom zgrubnie (często pokazują 100% niemal do końca, potem szybko spadają). Traktuj to jako przybliżenie, a nie dokładny pomiar.":"The battery reading is approximate — cheap BLE devices report the level roughly (they often show 100% almost to the end, then drop fast). Treat it as an estimate, not an exact percentage.",
 "Filtr min":"Filter min",
 "Filtr max":"Filter max",
 "Usuń brzmienie":"Delete sound",
 // — attribute values: title / aria-label / placeholder —
 "Wybór urządzenia":"Device selection",
 "Dodaj kolejny kapsel — okienko parowania samo go poszuka":"Add another capsule — the pairing window finds it for you",
 "Sposób wyświetlania orientacji — kliknij „?” po wyjaśnienie":"Orientation display mode — click “?” for an explanation",
 "Wygładzanie podglądu orientacji":"Orientation preview smoothing",
 "Poziom wygładzenia (0 = surowo, 1 = bardzo gładko)":"Smoothing level (0 = raw, 1 = very smooth)",
 "krótki opis (co robi)":"short description (what it does)",
 // Placeholder pola „dla" w pasku zapisu zestawu (#setupFor) — brzmienie jak w poradniku Zestawów
 // (rf-39b cytuje „for the program/game"). Etykieta dostępna tego pola NIE dubluje tego klucza.
 "dla programu/gry":"for the program/game",
 // Etykiety dostępne pól paska „Zapisz obecną konfigurację jako zestaw" i wyszukiwarki
 // Biblioteki (aria-label w HTML) — placeholder nie jest nazwą kontrolki. „Nazwa zestawu"
 // ma już swój klucz niżej (okno wymiany) i NIE jest tu dublowana.
 "Dla programu lub gry":"For a program or game",
 "Plik gry (auto-wczytywanie)":"Game executable (auto-load)",
 "Krótki opis zestawu":"Short setup description",
 "Szukaj w bibliotece":"Search the library",
 // — data-rftip tooltips: hardcoded Polish titles that never pass through _gl —
 "Zamknij":"Close",
 "Przywróć domyślny":"Reset to default",
 "Usuń warunek":"Remove condition",
 "Jak łączyć z dotychczasowym wynikiem (lewo→prawo)":"How to combine with the result so far (left→right)",
 "NEGUJ (NOT) — liczy się jako spełniony, gdy warunek NIE jest spełniony":"NEGATE (NOT) — counts as met when the condition is NOT met",
 "Aktywuj po N przekroczeniach progu/zakresu w zadanym czasie (np. 3× w 2 s)":"Fire after N threshold/range crossings within a set time window (e.g. 3× in 2 s)",
 "Aktywuj po X ms nieprzerwanego spełnienia warunku":"Fire after X ms of uninterrupted condition satisfaction",
 "Kliknij, potem naciśnij fizyczny przycisk na kapslu":"Click, then press the physical button on the capsule",
 "Biblioteka elementów — wybierz kategorię":"Element library — pick a category",
 "Przeciągnij, aby zmienić kolejność":"Drag to reorder",
 "Anuluj edycję i wróć do tworzenia nowego":"Cancel editing and go back to creating a new one",
 "Otwórz ściągę w osobnym oknie (2. monitor / telefon)":"Open the cheat sheet in a separate window (2nd monitor / phone)",
 "Orientacja 3D — nachylenie + obrót":"3D orientation — tilt + twist",
 "Przeciągnij, by zmienić wysokość podglądu 3D":"Drag to change the 3D preview height",
 "Podgląd sterowania ruchem (mysz / gałka / krzyżak)":"Motion control preview (mouse / stick / d-pad)",
 "Ruch po przekątnej — dwa klawisze kierunku naraz (↖↗↙↘)":"Diagonal movement — two direction keys at once (↖↗↙↘)",
 "Zapomnij ten kapsel i usuń slot":"Forget this capsule and remove the slot",
 "Graj z ruchu przypisanych kapsli":"Play from the motion of assigned capsules",
 "Musi zostać co najmniej jeden pad":"At least one pad must remain",
 "Usuń ten pad grający":"Delete this play pad",
 "Usuń ten pad efektów":"Delete this effect pad",
 "Którym padem grającym steruje ten pad efektów":"Which play pad this effect pad controls",
 // Podpisy sekcji w karcie pada efektów (rf-25 `renderFxPads`). „Steruje padem grającym" stoi teraz
 // nad wyborem celu, który do 2026-09-02 pokazywał się dopiero od drugiego pada grającego.
 "Steruje padem grającym":"Controls the play pad",
 "Efekt na osiach":"Effect on the axes",
 "Drag — jak ospale albo żwawo efekt goni wskazane miejsce":"Drag — how lazily/responsively the effect reaches the target position",
 "Echo":"Echo",
 // Portret aktywnego kapsla nad „Moduł" w nawigacji (rf-34b `buildNavCap`). Nazwa kapsla NIE ma tu
 // klucza i mieć go nie może — to podpis człowieka, więc nosi `data-noi18n`. Stan pod nią jest tym
 // samym napisem, co w pigułce (connWord, klucze niżej), więc tłumaczy się sam.
 "Poprzedni kapsel":"Previous capsule",
 "Następny kapsel":"Next capsule",
 // connWord device-status pills (used both as device-selector title and as text pill)
 "● połączony":"● connected",
 "● symulacja":"● simulation",
 "○ szukam":"○ searching",
 "○ rozłączony":"○ disconnected",
 "○ start":"○ start",
 "◌ parowanie…":"◌ pairing…",
 "○ niesparowany":"○ unpaired",
 // Ogony dymka pigułki kapsla (`_devpillState` w rf-11), doklejane po " · " — walker tłumaczy
 // każdy człon osobno, więc muszą tu stać jako samodzielne klucze.
 // ⚠️ Wersja z NAWIASAMI, nie z przecinkiem. Wyżej stoi „wstrzymany, nic z niego nie wychodzi",
 // ale kod od zawsze buduje „wstrzymany (nic z niego nie wychodzi)" — tamten klucz nigdy nie miał
 // w co trafić i po angielsku w dymku zostawał polski ogon. Złapane 2026-08-29 (etap 6c), gdy
 // zwinięty pasek zrobił z dymka JEDYNE miejsce z opisem kapsla.
 "wstrzymany (nic z niego nie wychodzi)":"on hold (nothing gets out of it)",
 "sterowany ręcznie":"driven by hand",
 // 🌐 Uslugi sieciowe — static card labels (runtime-composed strings go through _gl instead)
 "Usługi sieciowe":"Network services",
 // The TAB label is the short word, and only there — see the note beside TABS in rf-34-tabs.js.
 "Usługi":"Services",
 // 🎬 OBS Studio card (rf-38b-obs.js). The lead is three text nodes, because of the <b> in the
 // middle — the walker translates each one on its own, so each one needs its own entry.
 "Steruj OBS-em ruchem kapsla: przełącz scenę, włącz nagrywanie, zapisz powtórkę. Najpierw w OBS otwórz":"Drive OBS with the capsule's motion: switch a scene, start recording, save a replay. First, in OBS, open",
 "Narzędzia → Ustawienia serwera WebSocket":"Tools → WebSocket Server Settings",
 "Adres OBS-a":"OBS address",
 "Hasło z sejfu":"Password from the vault",
 "Rozłącz":"Disconnect",
 "Otwórz połączenie z OBS Studio":"Open the connection to OBS Studio",
 "Zamknij połączenie z OBS Studio":"Close the connection to OBS Studio",
 // action editor + application settings, on the OBS transport
 "Żądanie OBS":"OBS request",
 "Wyśle do OBS żądanie GetVersion — sprawdza samo połączenie, w scenie nic się nie zmienia":"Sends a GetVersion request to OBS — it checks the connection itself and changes nothing in the scene",
 "Aplikacje i usługi":"Applications and services",
 "Wysyłka automatyczna":"Automatic sending",
 "Sejf poświadczeń":"Credential vault",
 // 🌐 Uslugi sieciowe — application cards, action library, request preview, send log
 "Dodaj pustą aplikację docelową":"Add an empty target application",
 "Utwórz aplikację z gotowego szablonu":"Create an application from a ready-made template",
 "Nazwa aplikacji":"Application name",
 "Adres bazowy":"Base URL",
 "Usuń tę aplikację":"Remove this application",
 "Sekcje aplikacji":"Application sections",
 "Dodaj nową akcję do biblioteki tej aplikacji":"Add a new action to this application's library",
 "👁 Podgląd":"👁 Preview",
 "Wyślij tę akcję teraz":"Send this action now",
 "Podgląd żądania bez wysyłki":"Preview the request without sending",
 "Edytuj akcję":"Edit action",
 "Duplikuj akcję":"Duplicate action",
 "Usuń akcję":"Remove action",
 "Nazwa akcji":"Action name",
 "Opis — co ta akcja robi":"Description — what this action does",
 "np. wysyła powiadomienie na telefon":"e.g. sends a notification to the phone",
 "Metoda":"Method",
 "Ścieżka":"Path",
 "/webhook/moj-hak — albo pełny adres https://…":"/webhook/my-hook — or a full https://… address",
 "Parametry adresu":"URL parameters",
 "Nagłówki tej akcji":"Headers of this action",
 "Treść wiadomości":"Message body",
 "Typ treści":"Body type",
 "Szablon treści":"Body template",
 "Wstaw dane z kapsla — kliknij, żeby dodać w miejscu kursora:":"Insert capsule data — click to add at the cursor:",
 "Poświadczenie tej akcji":"Credential for this action",
 "Ta akcja nie wysyła treści.":"This action sends no body.",
 "Zwykły tekst — możesz użyć {{placeholderów}}.":"Plain text — you can use {{placeholders}}.",
 "nazwa=wartość temat={{var.temat}}":"name=value topic={{var.temat}}",
 "https://127.0.0.1:8123 — albo pełny adres webhooka":"https://127.0.0.1:8123 — or a full webhook address",
 "Poświadczenie":"Credential",
 "Limit czasu (ms)":"Timeout (ms)",
 "Nagłówki wspólne dla wszystkich akcji":"Headers shared by all actions",
 "Test połączenia":"Connection test",
 "Wyślij GET na adres bazowy i sprawdź, czy aplikacja odpowiada":"Send a GET to the base URL and check whether the application answers",
 "nazwa":"name",
 "wartość":"value",
 "nazwa parametru":"parameter name",
 "nazwa nagłówka":"header name",
 "Usuń ten wiersz":"Remove this row",
 "Dziennik wysyłek":"Send log",
 "ostatnie 100 wpisów · tylko w pamięci przeglądarki · sekrety zamaskowane":"last 100 entries · browser memory only · secrets masked",
 "Wyczyść dziennik":"Clear the log",
 "Pokaż lub ukryj odpowiedź":"Show or hide the response",
 // 🌐 Uslugi sieciowe — triggers (rows, source switch, live reading)
 "Min. odstęp (ms)":"Min. gap (ms)",
 "Ile razy ten wyzwalacz zadziałał w tej sesji":"How many times this trigger fired in this session",
 "Włącz lub wyłącz ten wyzwalacz":"Turn this trigger on or off",
 "Usuń ten wyzwalacz":"Remove this trigger",
 "Rodzaj źródła wyzwalacza":"Kind of trigger source",
 "Dodaj wyzwalacz, który sam wyśle wybraną akcję":"Add a trigger that sends the chosen action by itself",
 "Kapsel":"Capsule",
 "Reguła":"Rule",
 "Teraz":"Now",
 "Tryb":"Mode",
 "Czas utrzymania (ms)":"Hold time (ms)",
 "> większe niż":"> greater than",
 "< mniejsze niż":"< less than",
 // ——— musical scales (MI_SCALES in rf-16-midi.js) — the same list feeds the MIDI card,
 //     the synth pad and the pad gate, so it must be translated as a whole: leaving even one
 //     entry out makes the dropdown half-Polish in English mode.
 "chromatyczna":"chromatic","dur (majorowa)":"major","moll (minorowa)":"minor",
 "moll harmoniczna":"harmonic minor","pentatonika dur":"major pentatonic",
 "pentatonika moll":"minor pentatonic","bluesowa":"blues","dorycka":"Dorian",
 "frygijska":"Phrygian","lidyjska":"Lydian","miksolidyjska":"Mixolydian","całotonowa":"whole tone",
 // ——— "Variables" card; its remaining labels are translated at runtime by _ra5T ———
 "Zmienne":"Variables",
 "własne wartości wstawiane w akcjach przez {{var.nazwa}}":"your own values inserted into actions via {{var.name}}",
 "Nazwa zmiennej":"Variable name",
 "Wartość zmiennej":"Variable value",
 "Ten token wstawiasz w treści akcji":"Paste this token into the action content",
 "Usuń tę zmienną":"Remove this variable",
 // ——— coverage sweep: toasts, statuses, editor labels ———
 // rf-06 / rf-08 — restart overlay and the stream status pill
 "Restartuję…":"Restarting…",
 "łączę ze strumieniem…":"connecting to the stream…",
 "serwer offline — wznawiam…":"server offline — retrying…",
 // rf-10 / rf-12 / rf-20 — filter-metric names (rule list, rule editor, pad gate)
 "Obrót (twist)":"Twist (rotation)","Przechył przód/tył":"Pitch (fwd/back)","Przechył w bok":"Roll (sideways)",
 "Pochylenie (°)":"Tilt (°)","Obrót (twist) (°/s)":"Twist (rotation) (°/s)",
 "Przechył przód/tył (°)":"Pitch (fwd/back) (°)","Przechył w bok (°)":"Roll (sideways) (°)",
 // Wirowanie = |gyro| motion energy. The unit is LSB and not °/s on purpose (raw, not gain-scaled),
 // so the unit stays "LSB" in English too — a translated one would suggest translated numbers.
 "Wirowanie (|żyro|)":"Spin (|gyro|)","Wirowanie (|żyro|) (LSB)":"Spin (|gyro|) (LSB)",
 "Wirowanie":"Spin","🧭 Wirowanie (|żyro|)":"🧭 Spin (|gyro|)",
 "🧭 Pochylenie":"🧭 Tilt","🧭 Obrót (twist)":"🧭 Twist (rotation)",
 "🧭 Przechył przód/tył":"🧭 Pitch (fwd/back)","🧭 Przechył w bok":"🧭 Roll (sideways)","przycisk":"button",
 // Pusty stan listy wyzwalaczy nie chodzi już przez słownik: pięć kluczy sklejanych po
 // przecinku („Brak wyzwalaczy. Kliknij", „filtrze 3D" i trzy kawałki zdania) zdjęte razem z
 // żargonem, na który wskazywały — zdanie powstaje przez `_gl` przy renderze (rf-10).
 // rf-11 — device editor + cheat-sheet placeholders
 "Grafika kapsla":"Capsule artwork","Wygląd kapsla":"Capsule look","Ta sama grafika w pigułce i w podglądzie 3D.":"The same picture on the pill and in the 3D preview.","np. Lewa ręka / Gracz 1":"e.g. Left hand / Player 1",
 "Brak urządzeń.":"No devices.","— brak mapowań —":"— no mappings —",
 // rf-12 — behavior stage labels (rule row progress + condition preview)
 "poniżej progu":"below threshold","⚡ aktywowano":"⚡ fired","⚡ aktywne":"⚡ active",
 "⬇ trzymane":"⬇ held","zwolnione":"released",
 "● reguła AKTYWNA":"● rule ACTIVE","– reguła nieaktywna":"– rule inactive",
 "warunki w czasie (~6 s)":"conditions over time (~6 s)",
 "● spełniony":"● met","– niespełniony":"– not met",
 "● spełniony (NEGUJ)":"● met (NEGATE)","– niespełniony (NEGUJ)":"– not met (NEGATE)",
 // rf-12 — rule editor: behavior fields, macro editor, condition cards
 "Interwał":"Interval","Wciśnij i":"Press and","TRZYMAJ":"HOLD",
 "klawisz/przycisk dopóki wartość jest powyżej progu (puść po zejściu) — idealne do ruchu w grach (np. trzymaj W przy wychyle). Dla scroll/ruchu myszy (brak „trzymania”) = powtarzaj co":"key/button while the value stays above the threshold (released once it drops) — ideal for movement in games (e.g. hold W while tilting). For scroll / mouse motion (nothing to “hold”) = repeat every",
 "Liczba kliknięć":"Number of clicks","Liczba przekroczeń":"Number of crossings","w oknie":"in a window",
 "2 = podwójny klik":"2 = double click","3 = potrójny":"3 = triple",
 "— wszystkie w zadanym odstępie czasu.":"— all within the given time span.",
 "np. 3 = potrójne „stuknięcie” progu w zadanym czasie uruchamia akcję (jak 10101).":"e.g. 3 = a triple “tap” of the threshold within the time window fires the action (like 10101).",
 "Nagraj klawisze":"Record keys","nagrywa naciskane klawisze razem z pauzami":"records your keys with their gaps",
 "⌨ Klawisze":"⌨ Keys","⌨ Kombinacje":"⌨ Combos","⬇⬆ Przytrzymanie":"⬇⬆ Hold","⏱ Pauzy":"⏱ Waits",
 "Kroki oddziel":"Separate steps with a","średnikiem":"semicolon","lub nową linią. Pauza:":"or a new line. Wait:",
 ". Kliknij element z biblioteki = dodaj, albo":". Click a library item = add, or",
 "— wybierz wyzwalacz —":"— choose a trigger —",
 "💡 Warunek jest spełniony, gdy wybrany wyzwalacz jest":"💡 The condition is met while the chosen trigger is",
 "AKTYWNY":"ACTIVE","NIE":"NOT",
 "(jego warunek przekroczony) w tej chwili. Pozwala warstwować sterowanie — np. „strzelaj tylko gdy idziesz” albo z":"(its condition crossed) right now. Lets you layer controls — e.g. “shoot only while walking”, or with",
 ": „skok tylko gdy NIE biegniesz”.":": “jump only while NOT running”.",
 "Brak innych wyzwalaczy":"No other triggers",
 "— najpierw utwórz inny wyzwalacz, potem się do niego odwołaj.":"— create another trigger first, then reference it.",
 "Metryka":"Metric","Trzymaj":"Hold","Bajt":"Byte",
 "Auto — reaguj na dowolne wciśnięcie (bez uczenia bitu)":"Auto — react to any press (no bit learning)",
 "ms — minimum, jak długo po naciśnięciu uznawać za wciśnięty (przytrzymany przycisk trzyma tyle, ile go trzymasz)":"ms — the minimum time a press counts as held (a button you keep down stays held for as long as you hold it)",
 "Krótkie vs długie przyciśnięcie:":"Short vs long press:","krótkie = zachowanie":"short = behaviour",
 "„Jednorazowo”":"“Once”","długie przyciśnięcie":"long press","= zachowanie":"= behaviour","„Po czasie”":"“After time”",
 "(poniżej) + ustaw czas (np. 600 ms) — odpali dopiero po przytrzymaniu przycisku tyle czasu. Kapsel przez cały czas mówi, że przycisk jest wciśnięty, więc „Trzymaj” możesz zostawić na domyślnej wartości.":"(below) + set the time (e.g. 600 ms) — it fires only after the button has been held that long. The capsule keeps reporting the button as down, so you can leave “Hold” at its default.",
 "konkretny bit (zaawansowane)":"specific bit (advanced)","Wykryj przycisk":"Learn the bit",
 "Łączenie: każdy warunek ma własny":"Combining: each condition has its own","ORAZ/LUB":"AND/OR",
 "+ opcjonalnie":"+ optionally","— liczone lewo→prawo, bez nawiasów":"— evaluated left→right, no parentheses",
 "naciśnij przycisk — zaświeci, gdy wciśnięty":"press the button — it lights up while held",
 "podgląd · stan wskazanego wyzwalacza (aktywny = spełniony)":"preview · state of the chosen trigger (active = met)",
 "naciśnij przycisk na kapslu…":"press a button on the capsule…",
 "Naciśnij teraz przycisk na urządzeniu…":"Now press a button on the device…",
 "naciśnij teraz…":"press a key now…","Wpisz sekwencję":"Enter a sequence","Wybierz klawisz / akcję":"Choose a key / action",
 "Brak akcji":"No action",
 // rf-12 — output status note, "click the target window" overlay, test-result toasts
 "Kliknij teraz w OKNO DOCELOWE":"Now click the TARGET WINDOW",
 "Notatnik, przeglądarkę, grę… — tam trafią klawisze":"Notepad, a browser, a game… — that is where the input lands",
 "wysyłam:":"sending:","Esc = anuluj":"Esc = cancel","Test anulowany":"Test cancelled",
 "Serwer nieosiągalny — uruchom ponownie RibbitFlip.exe":"Server unreachable — restart RibbitFlip.exe",
 // rf-13 — battery saving + 3D axis presets (flash messages). The trigger-preset bar next to them
 // builds its own text with _gl(), so nothing from it needs a key here.
 "Serwer nieosiągalny":"Server unreachable","Zapisano":"Saved","Usypiam…":"Going to sleep…","Wznawiam…":"Resuming…",
 "Błąd wczytania":"Could not load",
 "Wybierz Triki, z którego skopiować osie 3D":"Choose the Triki to copy the 3D axes from",
 "Ten Triki nie ma zapisanych osi 3D":"This Triki has no saved 3D axes",
 "Podaj nazwę presetu osi":"Enter an axis preset name","Błąd zapisu presetu osi":"Could not save the axis preset",
 "Błąd wczytania presetu":"Could not load the preset","Wybierz preset osi z listy":"Choose an axis preset from the list",
 "Wybierz preset osi do usunięcia":"Choose an axis preset to delete",
 // rf-14 — 2D inclinometer caption
 "widok 2D — inklinometr (pochylenie) + obrót":"2D view — inclinometer (tilt) + twist",
 // rf-15 — virtual-controller availability notes (stick / d-pad)
 // RUCH ZAPARKOWANY (`padPark`): pad ISTNIEJE i przyciski przez niego wychodzą, tylko ruch kapsla
 // nie prowadzi drążka/krzyżaka. Osobne zdania, bo „aktywny" i „steruje" to dwie różne odpowiedzi.
 "🎮 Wirtualny kontroler aktywny — przyciski wychodzą, ale ruch kapsla nie prowadzi krzyżaka (zaparkowany).":
   "🎮 Virtual controller active — the buttons go out, but the capsule's motion is not driving the d-pad (parked).",
 "○ ruch zaparkowany":"○ motion parked",
 "🔌 Ten kapsel nie gra na żadnym kontrolerze, więc drążek nie ma dokąd wyjść. Przypnij go w sekcji Kontrolery.":
   "🔌 This capsule plays on no controller, so the stick has nowhere to go. Plug it in under Kontrolery.",
 "🔌 Ten kapsel nie gra na żadnym kontrolerze, więc krzyżak nie ma dokąd wyjść. Przypnij go w sekcji Kontrolery albo przełącz na „Klawiatura”.":
   "🔌 This capsule plays on no controller, so the d-pad has nowhere to go. Plug it in under Kontrolery, or switch to “Keyboard”.",
 "🎮 Krzyżak steruje D-padem wirtualnego kontrolera (skosy natywnie).":"🎮 The d-pad drives the virtual controller's D-pad (diagonals natively).",
 "🎮 Pad utworzy się przy starcie (potrzebny ViGEmBus). Bez niego przełącz na „Klawiatura”.":"🎮 The pad is created at start (ViGEmBus required). Without it switch to “Keyboard”.",
 "⚠ Brak modułu vgamepad — wybierz „Klawiatura” albo zainstaluj vgamepad + ViGEmBus.":"⚠ No vgamepad module — pick “Keyboard” or install vgamepad + ViGEmBus.",
 // rf-16 — MIDI/OSC: axis sources, mapping editor, routing warning, status footers
 "CH0 (żyro X)":"CH0 (gyro X)","CH1 (żyro Y)":"CH1 (gyro Y)","CH2 (żyro Z)":"CH2 (gyro Z)",
 "CH3 (akcel X)":"CH3 (accel X)","CH4 (akcel Y)":"CH4 (accel Y)","CH5 (akcel Z)":"CH5 (accel Z)",
 "Podgląd krzywej odpowiedzi":"Response curve preview","— brak (wyłączony) —":"— none (off) —","⟂ próg":"⟂ threshold",
 "Cel":"Target","Nazwa (opcjonalnie)":"Name (optional)","np. Głośność / Bas":"e.g. Volume / Bass",
 "Wielkość":"Metric","Kanał (oś)":"Channel (axis)","Wejście — min":"Input — min","Wejście — max":"Input — max",
 // mapping editor — the range laboratory (rf-16c): input band, threshold trace, output bar.
 // The head lines („teraz 34.2 °", „● WYZWALA — teraz …") are COMPOSED with numbers, so they go
 // through _gl()/_cvT() at paint time and only the bare words need a key here.
 "Zakres — co ma pokryć całą skalę wyjścia":"Range — what should cover the whole output scale",
 "Próg — kiedy mapowanie się odzywa":"Threshold — when the mapping speaks up",
 "Jasny prostokąt to okno, które ma pokryć całą skalę wyjścia. Kropka to wartość teraz, blady pas to zakres realnie wykorzystany w ostatnich sekundach.":"The light rectangle is the window that should cover the whole output scale. The dot is the value right now, the pale band is the range actually used over the last few seconds.",
 "Przebieg pokazuje ostatnie sekundy ruchu. Komunikat leci w chwili przekroczenia progu, nie przez cały czas.":"The trace shows the last few seconds of movement. The message goes out the moment the threshold is crossed, not all the time.",
 // „Dopasuj" NIE dostaje klucza: słownik nakładki (rf-41) niesie już to słowo w innym znaczeniu,
 // a Object.assign robi z tego jedną wartość dla całego panelu — tutaj idzie przez _gl() w rf-16.
 "Wejście":"Input","teraz":"now","zwolnienie":"release",
 // Suwaki zakresu (pas A i pas C) podpisane są sąsiednim polem, nie własnym <label>, więc nazwę
 // niosą w aria-label — a ten walker tłumaczy tak samo jak zwykły tekst. Same „min"/„max" przy
 // polach klucza nie potrzebują: brzmią tak samo w obu językach.
 "Wejście min":"Input min","Wejście max":"Input max",
 "Wyjście min":"Output min","Wyjście max":"Output max",
 "⤢ Dopasuj do obserwowanego":"⤢ Fit to what was observed",
 "Wpisze do pól to, co kapsel realnie pokrył w ostatnich sekundach, z 5% zapasu":"Puts into the fields what the capsule actually covered over the last few seconds, with 5% to spare",
 // mapping editor — sections (input · response · output) and the hint under each of them
 // Protokół wybiera ZAKŁADKA, nie rozwijak: w MIDI zostaje wybór rodzaju komunikatu, w OSC nie ma
 // czego wybierać, więc stoi tam stała etykieta 📡 OSC i zdanie o tym, gdzie mieszka adres.
 "Komunikat MIDI":"MIDI message",
 "adres i odbiornik ustawiasz w sekcji Wyjście":"the address and the receiver are set in the Output section",
 "Skopiuj jako mapowanie OSC":"Copy as an OSC mapping",
 "Skopiuj jako mapowanie MIDI":"Copy as a MIDI mapping",
 "Tworzy drugie mapowanie z tego samego ruchu, tyle że na OSC — oryginał MIDI zostaje na miejscu":"Makes a second mapping out of the same movement, only on OSC — the MIDI original stays where it is",
 "Tworzy drugie mapowanie z tego samego ruchu, tyle że na MIDI — oryginał OSC zostaje na miejscu":"Makes a second mapping out of the same movement, only on MIDI — the OSC original stays where it is",
 "Wejście — co steruje wartością":"Input — what drives the value",
 "Działa na zboczu: komunikat leci w chwili przekroczenia progu, nie przez cały czas.":"Edge-triggered: the message goes out the moment the threshold is crossed, not all the time.",
 "Zakres min–max to wychylenie, które ma pokryć całą skalę wyjścia (pochylenie/obrót w stopniach, surowa oś w LSB).":"The min–max range is the deflection that should cover the whole output scale (tilt/rotation in degrees, a raw axis in LSB).",
 "Reakcja — jak ruch zamienia się w wartość":"Response — how motion turns into a value",
 "Krzywa decyduje, czy początek ruchu działa delikatnie, czy od razu mocno. Podgląd obok liczy dokładnie tę samą krzywą co silnik.":"The curve decides whether the start of the movement acts gently or hits hard right away. The preview next to it plots exactly the curve the engine uses.",
 "Wyjście — co leci przez OSC":"Output — what goes out over OSC",
 "Wyjście — co leci do MIDI":"Output — what goes out to MIDI",
 "Zamienia końce zakresu miejscami — największe wychylenie daje najmniejszą wartość":"Swaps the ends of the range — the largest deflection gives the smallest value",
 "Odbija krzywą — to, co działo się na początku ruchu, dzieje się na końcu":"Flips the curve — what happened at the start of the movement now happens at the end",
 "Dolna granica odstępu między komunikatami — chroni odbiornik przed zalaniem":"Lower bound on the gap between messages — keeps the receiver from being flooded",
 "Wyślij testowy komunikat teraz — bez ruszania kapslem":"Send a test message now — without moving the capsule",
 "powyżej >":"above >","poniżej <":"below <","|wartość| bezwzgl.":"|value| absolute",
 // Edytor wyzwalacza: brak sterownika pada we wzorze „brakuje czegoś spoza aplikacji" (2026-10-15).
 "Ten wyzwalacz potrzebuje sterownika ViGEmBus":"This trigger needs the ViGEmBus driver",
 "Ten wyzwalacz potrzebuje modułu vgamepad i sterownika ViGEmBus":"This trigger needs the vgamepad module and the ViGEmBus driver",
 "Bez tego przyciski kontrolera nigdzie nie polecą. Zainstaluj sterownik, a wyzwalacz zacznie działać bez zmian.":"Without it the controller buttons go nowhere. Install the driver and the trigger will work as it is.",
 "Pobierz ViGEmBus ↗":"Download ViGEmBus ↗",
 "MIDI włączone, ale nie dotrze do żadnej aplikacji":"MIDI is on, but it will not reach any application",
 "Co zrobić:":"What to do:","1) zainstaluj":"1) install",
 ", 2) utwórz w nim port (np.":", 2) create a port in it (e.g.","), 3) kliknij":"), 3) click",
 "przy „Port OUT”, 4) wybierz ten port na liście.":"next to “MIDI OUT port”, 4) pick that port from the list.",
 "✅ OSC działa już teraz (bez loopMIDI).":"✅ OSC already works right now (no loopMIDI).",
 "Port MIDI OUT nie jest gotowy.":"The MIDI OUT port is not ready.",
 // Ostrzeżenie MIDI mówi teraz, KTÓRY to przypadek, i daje radę pasującą do niego (2026-09-10).
 // Jedno „zainstaluj loopMIDI" na wszystko kosztowało użytkownika niepotrzebną reinstalację
 // programu, który miał — tylko wyłączony.
 "MIDI jest niedostępne w tym systemie (winmm).":"MIDI is unavailable on this system (winmm).",
 "Nie znalazłem loopMIDI na tym komputerze, a Windows nie ma własnego wirtualnego portu MIDI.":
   "I could not find loopMIDI on this computer, and Windows has no virtual MIDI port of its own.",
 "loopMIDI jest zainstalowany, ale nie jest uruchomiony — jego porty istnieją tylko wtedy, gdy program działa.":
   "loopMIDI is installed but not running — its ports exist only while the program is running.",
 "loopMIDI działa, ale nie ma w nim ani jednego portu.":"loopMIDI is running, but it has no port in it.",
 "Nie widzę wirtualnego portu MIDI — loopMIDI albo nie jest zainstalowany, albo nie jest uruchomiony (jego porty istnieją tylko wtedy, gdy program działa).":
   "I cannot see a virtual MIDI port — loopMIDI is either not installed or not running (its ports exist only while the program is running).",
 "Nie wybrano/nie otwarto portu MIDI OUT.":"No MIDI OUT port has been picked or opened.",
 "Wybrany port to „Microsoft GS Wavetable Synth” (syntezator; ShowMIDI ani DAW go nie zobaczą).":
   "The picked port is “Microsoft GS Wavetable Synth” (a synth; neither ShowMIDI nor a DAW will see it).",
 "Bez winmm ta aplikacja nie ma jak wysłać MIDI. OSC działa niezależnie i nie potrzebuje niczego instalować.":
   "Without winmm this app has no way to send MIDI. OSC works independently and needs nothing installed.",
 "Uruchom loopMIDI (zwykle chowa się przy zegarku), upewnij się, że ma na liście port, potem kliknij „🔄 Odśwież” przy „Port OUT” i wybierz ten port. Nie musisz niczego instalować ponownie.":
   "Start loopMIDI (it usually hides near the clock), make sure it has a port on its list, then click “🔄 Refresh” next to “MIDI OUT port” and pick that port. You do not need to reinstall anything.",
 "W oknie loopMIDI wpisz nazwę na dole (np. RibbitFlip), kliknij „+”, potem „🔄 Odśwież” przy „Port OUT” i wybierz ten port.":
   "In the loopMIDI window type a name at the bottom (for example RibbitFlip), click “+”, then “🔄 Refresh” next to “MIDI OUT port” and pick that port.",
 "Jeśli loopMIDI już masz, po prostu go uruchom i kliknij „🔄 Odśwież” przy „Port OUT”. Jeśli nie masz:":
   "If you already have loopMIDI, just start it and click “🔄 Refresh” next to “MIDI OUT port”. If you do not:",
 "Wybierz port na liście „Port OUT”. Jeśli go tam nie ma, kliknij obok „🔄 Odśwież”.":
   "Pick a port from the “MIDI OUT port” list. If it is not there, click “🔄 Refresh” beside it.",
 "Wybierz na liście „Port OUT” port z loopMIDI zamiast syntezatora.":
   "In the “MIDI OUT port” list pick the loopMIDI port instead of the synth.",
 "Kliknij „🔄 Odśwież” przy „Port OUT” i wybierz port jeszcze raz.":
   "Click “🔄 Refresh” next to “MIDI OUT port” and pick the port again.",
 "⚠ włączone, ale MIDI nie ma jak wyjść na zewnątrz — patrz ostrzeżenie wyżej.":"⚠ enabled, but MIDI has no way out — see the warning above.",
 "⚠ włączone, ale wyjście OSC jest niedostępne w tym systemie (moduł UDP nie wstał) — nic nie zostanie wysłane.":"⚠ enabled, but the OSC output is unavailable on this system (the UDP module did not start) — nothing will be sent.",
 // rf-17 / rf-19 / rf-20 — pad axis sources, effect parameters, gate metrics, rhythms
 "CH0 · żyro X":"CH0 · gyro X","CH1 · żyro Y":"CH1 · gyro Y","CH2 · żyro Z":"CH2 · gyro Z",
 "CH3 · akcel X":"CH3 · accel X","CH4 · akcel Y":"CH4 · accel Y","CH5 · akcel Z":"CH5 · accel Z","🎚 Bas":"🎚 Bass",
 "Echo — czas":"Echo — time","Echo — sprzężenie":"Echo — feedback","Pogłos":"Reverb",
 "Wah (filtr)":"Wah (filter)","Panorama":"Pan",
 "Energia ruchu":"Motion energy","> próg":"> threshold","< próg":"< threshold","≥ próg":"≥ threshold","≤ próg":"≤ threshold",
 "🎵 Ćwierćnuty":"🎵 Quarters","🎶 Ósemki":"🎶 Eighths","⚡ Szesnastki":"⚡ Sixteenths",
 "🩴 Na „i” (offbeat)":"🩴 On the “and” (offbeat)","🐎 Galop":"🐎 Gallop","🌫️ Trans 3-3-2":"🌫️ Trance 3-3-2",
 // rf-23 / rf-25 — capsule pickers and the sound editor
 "brak połączonych urządzeń — dotyk zawsze gra":"no connected devices — touch always plays",
 // Panel „Kapsle" na padzie do grania (rf-23 :285): nagłówek i podpowiedź są osobnymi węzłami
 // tekstowymi (span w div), więc dwa klucze; pusty stan tego panelu ma parę wyżej.
 "Kapsle":"Capsules","kliknij kapsel, żeby ustawić jego osie":"click a capsule to set its axes",
 // rf-29 — setup / bundle import-export messages
 "Zły plik":"Bad file","Błąd analizy pliku":"File analysis failed","Błąd: nieprawidłowy JSON":"Error: invalid JSON",
 "Pobrano zestaw na kilka kapsli (wszystkie kapsle)":"Downloaded the multi-capsule set (every capsule)",
 "Błąd pobierania zestawu na kilka kapsli":"Could not download the multi-capsule set",
 "Błąd analizy zestawu na kilka kapsli":"Multi-capsule set analysis failed",
 "Podaj nazwę zestawu":"Enter a setup name","Usunięto zestaw":"Setup deleted","Nie usunięto":"Not deleted",
 "Nie zapisano":"Not saved","Nie wczytano":"Not loaded","Import zestawu":"Import setup",
 "Wybierz zestaw z listy":"Choose a setup from the list",
 // rf-31 / rf-32 — motion-control calibration, raw commands, macro run + key recorder
 "Wyśrodkowano (kalibracja)":"Recentered (calibration)",
 "✕ serwer nieosiągalny":"✕ server unreachable","Wpisz hex":"Enter hex",
 "▶ liczę czas…":"▶ counting…","⛔ okno minęło (reset)":"⛔ window elapsed (reset)",
 "⌨ wysyłane":"⌨ sending","podgląd (bez wysyłki)":"preview (not sent)",
 "␣ spacja":"␣ space","🖱 kursor ↑":"🖱 cursor ↑","🖱 kursor ↓":"🖱 cursor ↓",
 "⬇ trzymaj ␣":"⬇ hold ␣","⬆ puść ␣":"⬆ release ␣","⬇ trzymaj w":"⬇ hold w","⬆ puść w":"⬆ release w",
 "⬇ trzymaj Shift":"⬇ hold Shift","⬆ puść Shift":"⬆ release Shift",
 "⬇ trzymaj 🖱L":"⬇ hold 🖱L","⬆ puść 🖱L":"⬆ release 🖱L",
 "nagrywam":"recording","— rejestruję":"— capturing","wciśnięcie i puszczenie":"press and release",
 "(przytrzymanie = down…up); Esc kończy":"(hold = down…up); Esc ends",
 "nagrywa wciśnięcie+puszczenie (przytrzymanie)":"records press+release (hold)",
 // rf-36 — Uslugi sieciowe: send-log card + {{token}} chip tooltips
 "sekrety zamaskowane · zapis na dysku z rotacją":"secrets masked · written to disk with rotation",
 "Otwórz folder Settings z plikiem dziennika":"Open the Settings folder with the log file",
 "Pobierz cały dziennik jako plik JSONL":"Download the whole log as a JSONL file",
 "Wyczyść dziennik (widok ORAZ plik na dysku)":"Clear the log (the view AND the file on disk)",
 "Pochylenie kapsla 0–90°":"Capsule tilt 0–90°","Przechył przód-tył":"Pitch (front-back)","Przechył boczny":"Roll (side to side)",
 "Obrót w °/s":"Twist in °/s","Identyfikator slotu (d0, d1…)":"Slot identifier (d0, d1…)","Nazwa kapsla":"Capsule name",
 "Nazwa wyzwalacza (puste przy wysyłce ręcznej)":"Trigger name (empty for manual sends)","Klawisz wyzwalacza":"Trigger key",
 "Ile razy wyzwalacz się odpalił":"How many times the trigger fired","Czas wysyłki w formacie ISO":"Send time in ISO format",
 "Czas wysyłki w sekundach UNIX":"Send time in UNIX seconds","Licznik wysyłek w tej sesji":"Send counter for this session",
 "Nazwa tej aplikacji":"This application's name","Nazwa tej akcji":"This action's name",
 "Surowy kanał CH0 — tylko aktywny kapsel":"Raw channel CH0 — active capsule only",
 "Surowy kanał CH1 — tylko aktywny kapsel":"Raw channel CH1 — active capsule only",
 "Surowy kanał CH2 — tylko aktywny kapsel":"Raw channel CH2 — active capsule only",
 "Surowy kanał CH3 — tylko aktywny kapsel":"Raw channel CH3 — active capsule only",
 "Surowy kanał CH4 — tylko aktywny kapsel":"Raw channel CH4 — active capsule only",
 "Surowy kanał CH5 — tylko aktywny kapsel":"Raw channel CH5 — active capsule only",
 // server-sent errors (ribbitflip_monitor.py) that land in toasts verbatim
 "Mapowanie jest wyłączone — włącz je, żeby nauczyć zakresu":"The mapping is off — turn it on to learn the range",
 "Brak próbek — czy kapsel wysyła dane?":"No samples — is the capsule sending data?",
 "Za mały ruch — zakres byłby nadwrażliwy":"Too little motion — the range would be oversensitive",
 "Mapowanie zniknęło w trakcie nauki":"The mapping disappeared while learning",
 "Nie ma takiego mapowania":"No such mapping","Nauka nie jest uruchomiona":"Learning is not running",
 "Nauka dotyczy innego mapowania":"Learning belongs to a different mapping",
 "Pusty lub nieznany zestaw":"Empty or unknown setup","Brak zestawu":"No setup",
 "Pusty lub nieznany zestaw na kilka kapsli":"Empty or unknown multi-capsule set","Brak presetu":"No such preset","Brak presetu osi":"No axis preset",
 "Brak presetu myszy":"No mouse preset","Brak presetu MIDI/OSC":"No MIDI/OSC preset",
 "Brak presetu usług sieciowych":"No web-services preset","Brak nazwy zestawu":"No setup name",
 // Raw hex commands (queue_command / _drain_commands_sim): the answer to POST /command lands in
 // #cmdResult behind "✕ " and the simulation verdict rides in the SSE "cmd" event behind
 // "○ symulacja (brak urządzenia): <hex> — …" — the patterns below split the tail and look it up here.
 "Nieprawidłowy hex (użyj par bajtów, np. 20 10 00)":"Invalid hex (use byte pairs, e.g. 20 10 00)",
 "Pusta komenda":"Empty command","Za długa komenda (max 64 bajty)":"Command too long (max 64 bytes)",
 "symulacja — brak urządzenia (komenda nie wysłana)":"simulation — no device (command not sent)",
 "serwer nieosiągalny":"server unreachable",
 // OSC devices (osc_target_* handlers) and the DSU port check (Controller › Wii). The port sentence is
 // also enforced in the panel before the request goes out (rf-44), so it reaches a toast only from a
 // caller that skipped the field's own guard.
 "Nie ma takiego urządzenia OSC":"No such OSC device",
 "Port musi być z zakresu 1024-65535":"Port must be in the 1024-65535 range",
 // POST /config and the setup upload
 "Config zbyt duży (max 500 000 bajtów)":"Config too large (max 500 000 bytes)",
 "To zestaw na kilka kapsli — wczytaj go z Biblioteki (przejdzie przez wybór ról) albo przez okno Wymiany":"This is a multi-capsule set — load it from the Library (it goes through the role picker) or through the Exchange window",
 // REST action validation (_err in the /rest handler)
 "Brak URL":"No URL","Nieprawidłowy URL":"Invalid URL","Dozwolone tylko http/https":"Only http/https are allowed",
 "Niedozwolona metoda":"Method not allowed","Nagłówki muszą być obiektem":"Headers must be an object",
 "Za dużo nagłówków (max 50)":"Too many headers (max 50)","Nagłówki muszą być parami tekst → tekst":"Headers must be text → text pairs",
 "Nazwa nagłówka zbyt długa (max 200)":"Header name too long (max 200)","Wartość nagłówka zbyt długa (max 4000)":"Header value too long (max 4000)",
 "Body musi być tekstem":"Body must be text","Body zbyt duże (max 1 000 000 znaków)":"Body too large (max 1 000 000 characters)",
 // obs-websocket transport (ObsLink: handshake, frames, identify) — the sentences a failed connection
 // test shows on the OBS card; the ones with a number or an address in them are in I18N_EN_PATTERNS
 "Serwer zamknął połączenie w trakcie uzgadniania WebSocket":"The server closed the connection during the WebSocket handshake",
 "Odpowiedź uzgadniania WebSocket jest zbyt duża":"The WebSocket handshake reply is too large",
 "Serwer odpowiedział błędnym kluczem WebSocket":"The server answered with a wrong WebSocket key",
 "Podzielone ramki WebSocket nie są obsługiwane":"Fragmented WebSocket frames are not supported",
 "OBS zamknął połączenie zaraz po uzgodnieniu":"OBS closed the connection right after the handshake",
 "OBS przysłał ramkę binarną — nieobsługiwane":"OBS sent a binary frame — not supported",
 "OBS przysłał wiadomość, której nie da się odczytać":"OBS sent a message that cannot be read",
 "brak połączenia":"no connection","Brak podpisu hasła":"Missing password signature",
 "Brak nazwy żądania OBS (requestType)":"Missing OBS request name (requestType)",
 "Dane żądania OBS muszą być obiektem":"OBS request data must be an object",
 // controllers (pad_* handlers), config save, preset import
 "Ruch niesie tylko pad DualShock 4 — pad Xbox 360 nie ma żyroskopu":"Only the DualShock 4 pad carries motion — the Xbox 360 pad has no gyroscope",
 "Serwer kontrolera Wii niedostępny":"The Wii controller server is unavailable",
 "Config nie jest serializowalny":"The config cannot be serialised","Pusty preset":"Empty preset",
 // mouse action spec parser (_mouse_coord / _parse_mouse_spec) — the reasons behind a refused
 // click rule, appended to the analysis lines the patterns below split on " · "
 "brak współrzędnej":"missing coordinate",
 "samo przesunięcie kursora nie ma czego trzymać":"a bare cursor move has nothing to hold",
 "nie znam rozmiaru pulpitu, więc nie policzę procentów; podaj piksele":"the desktop size is unknown, so percentages cannot be worked out; give pixels",
 // connection pill + pairing: whatever set_status(msg=…) puts in #connText / #connHint
 "SYMULACJA — kapsel prowadzony ręcznie":"SIMULATION — capsule driven by hand",
 "Uśpiono — kliknij Wznów lub naciśnij środek Triki":"Asleep — click Resume or press the middle of the Triki",
 "Uśpiono — oszczędzanie baterii":"Asleep — saving battery","Uśpiono (symulacja)":"Asleep (simulation)",
 "Rozłączono — czekam…":"Disconnected — waiting…",
 "Szukam nowego urządzenia — obudź kapsel, który chcesz dodać…":"Looking for a new device — wake the capsule you want to add…",
 "Szukam nowego urządzenia — obudź kapsel, który chcesz dodać":"Looking for a new device — wake the capsule you want to add",
 "Nie ma już innych kapsli w zasięgu — szukam dalej…":"No other capsules in range — still looking…",
 "Nie znaleziono nowego kapsla — ponawiam…":"No new capsule found — trying again…",
 "Niesparowany — kliknij „Dodaj kapsel”":"Unpaired — click “Add a capsule”",
 // Alias: a server started before the button was renamed (the owner's running instance until its
 // next restart) still sends the old status text — the panel must not show it in Polish in EN.
 "Niesparowany — kliknij „Dodaj urządzenie”":"Unpaired — click “Add a capsule”",
 // device slots, controllers and outputs
 "Brak slotu urządzenia":"No device slot","Parowanie już trwa":"Pairing is already running",
 "Nie można dodać slotu":"Could not add a slot","Nie można wznowić parowania":"Could not resume pairing",
 "Nie można usunąć (ostatni slot?)":"Could not remove it (the last slot?)",
 "Musi zostać co najmniej jeden kontroler":"At least one controller has to stay",
 "Nie ma takiego kontrolera":"No such controller","Nie ma takiego kapsla":"No such capsule",
 "MIDI OUT niedostępne (winmm)":"MIDI OUT unavailable (winmm)","OSC niedostępne":"OSC unavailable",
 // MCP endpoint
 "MCP niedostępny":"MCP is unavailable",
 "Uruchomiono z --no-mcp — przełącznik zablokowany":"Started with --no-mcp — the switch is locked",
 "Błąd zapisu ustawień MCP":"Could not save the MCP settings",
 // config, vault and the emergency-shortcut layer
 "Błąd zapisu configu":"Could not save the config","Błąd usuwania sejfu":"Could not delete the vault",
 "Błąd zapisu sejfu":"Could not save the vault",
 "Plik sejfu istnieje, ale jest niekompletny (uszkodzony zapis).":"The vault file is there but incomplete (a damaged write).",
 "Warstwa skrótu niepodłączona":"The shortcut layer is not connected",
 "warstwa skrótu niepodłączona":"the shortcut layer is not connected",
 "kopia testowa (--allow-multi) nie przejmuje skrótu awaryjnego":"a test copy (--allow-multi) does not take over the emergency shortcut",
 // OBS card (ObsLink._fail / _drop — the panel reads `code`, this is the fallback sentence)
 "Błąd połączenia z OBS":"OBS connection error",
 "To nie jest serwer obs-websocket 5 (brak wiadomości Hello)":"This is not an obs-websocket 5 server (no Hello message)",
 "Brak otwartego połączenia z OBS — najpierw kliknij „Połącz”":"No open connection to OBS — click “Connect” first",
 "Upłynął czas na podanie hasła — połącz się jeszcze raz":"The password window has expired — connect again",
 "Nie połączono z OBS":"Not connected to OBS","Nie udało się wysłać do OBS":"Could not send it to OBS",
 "Połączenie z OBS zostało zerwane":"The connection to OBS was lost",
 "Połączenie z OBS zostało zamknięte":"The connection to OBS was closed",
 "OBS zamknął połączenie":"OBS closed the connection","OBS odmówił":"OBS refused",
 "OBS nie odpowiedział w wyznaczonym czasie":"OBS did not answer in time",
 "OBS nie potwierdził połączenia (brak Identified)":"OBS did not confirm the connection (no Identified)",
 "OBS odrzucił połączenie — sprawdź hasło serwera WebSocket":"OBS refused the connection — check the WebSocket server password",
 "Podaj adres IP, nie nazwę (dozwolone: localhost albo adres w sieci lokalnej, np. 192.168.0.12)":"Enter an IP address, not a name (allowed: localhost or an address on the local network, e.g. 192.168.0.12)",
 // ——— tip jar (#rfKofi): the mug in the corner + its hover note ———
 "Dobrze się bawisz z RibbitFlipem?":"Having fun with RibbitFlip?",
 "Możesz postawić mi kawę albo podrzucić link do apki znajomym. Pomaga też krótki film wrzucony do social mediów, bo to najszybsza droga, żeby inni poznali aplikację. Projekt rozwijam sam, po godzinach. Takie drobne gesty trzymają go przy życiu i sprawiają, że do niego wracam.":"You can buy me a coffee or pass the app link to a friend. A short video posted on social media helps too, because it is the fastest way for others to discover the app. I build it solo, after hours. Small gestures like that keep it alive and keep me coming back to it.",
 // wiersz z wezwaniem na dole karty zniknął — pigułka pod nim robi dokładnie to samo, więc linia
 // tylko powtarzała kliknięcie, które już tam było. Klucze („Postaw kawę na Ko-fi", wariant z ☕)
 // usunięte razem z nim.
 "Kup mi kawę":"Buy me a coffee",
 "Kup mi kawę, okno Ko-fi otworzy się w aplikacji":"Buy me a coffee, the Ko-fi window opens inside the app",
 // ——— the Ko-fi panel the mug opens (.rfk-*, rf-39e-kofi.js) ———
 "Postaw mi kawę":"Buy me a coffee",
 "Postaw mi kawę na Ko-fi":"Buy me a coffee on Ko-fi",
 "Wczytuję Ko-fi…":"Loading Ko-fi…",
 "Ko-fi się nie wczytuje. Sprawdź połączenie z internetem.":"Ko-fi is not loading. Check your internet connection.",
 "Płatność obsługuje Ko-fi. RibbitFlip nie widzi Twoich danych.":"Ko-fi handles the payment. RibbitFlip never sees your details.",
 "Otwórz w przeglądarce ↗":"Open in your browser ↗",
 // ——— app bar: link out to the project's own page ———
 "Strona projektu":"Project page",
 // Still live: the „Konfiguracje" guide (rf-39b) names the wizard by its own heading.
 "Podziel się":"Share",
 "Twój nick (autor)":"Your nick (author)",
 "Podziel się zestawem":"Share your setup",
 "Podziel się zestawem na Discordzie":"Share your setup on Discord",
 "Tytuł wątku":"Post title",
 "Treść posta":"Post body",
 "Kopiuj":"Copy",
 "Post wychodzi z Twojego konta, więc jest podpisany i możesz go potem poprawić.":"The post goes out from your own account, so it carries your name and you can edit it later.",
 // ——— biblioteka zapisanych rzeczy (rf-39i) ———
 "Zestawy":"Setups",
 "Presety osi 3D":"3D axis presets",
 "Kompletna konfiguracja pod jedną grę lub program: wyzwalacze, ruch, MIDI i OSC, osie 3D, bateria. Wczytanie wymienia wszystko naraz.":"The complete configuration for one game or program: triggers, motion, MIDI and OSC, 3D axes, battery. Loading one replaces everything at once.",
 "Same reguły „próg → klawisz”. Wczytanie podmienia wyzwalacze i nie rusza osi, myszy ani MIDI.":"Nothing but the “threshold → key” rules. Loading one replaces the triggers and leaves the axes, the mouse and MIDI alone.",
 "Strojenie kapsla z zakładki Czujnik: kanały osi, filtr, czułość, odwrócenie i tor sygnału. Dotyczy kapsla, który masz teraz wybrany do edycji.":"The capsule tuning from the Sensor tab: axis channels, filter, sensitivity, inversion and the signal chain. Applies to the capsule you currently have selected for editing.",
 "Zapisz obecne wyzwalacze jako preset:":"Save the current triggers as a preset:",
 "Zapisz obecne osie 3D jako preset:":"Save the current 3D axes as a preset:",
 "Zapisz obecne ustawienia ruchu jako preset:":"Save the current motion settings as a preset:",
 "Zapisz obecny zestaw mapowań jako preset:":"Save the current mapping set as a preset:",
 "Zapisz obecne ustawienia jako preset:":"Save the current settings as a preset:",
 "nazwa presetu":"preset name",
 "Zapisz preset":"Save the preset",
 "Podaj nazwę presetu":"Give the preset a name",
 "Nie udało się zapisać":"Could not save",
 "Biblioteka":"Library", "Brzmienia":"Sounds",
 "Biblioteka wszystkich modułów":"Library of all modules",   // h2 karty #libraryCard (Zestawy) — pigułki modułów zostają „Biblioteka"
 "wszystko, co masz zapisane na tym komputerze: zestawy, wyzwalacze, osie":"everything you have saved on this computer: setups, triggers, axes",
 // ——— the exchange row at the top of the Library tab (static markup, #exchangeHero) ———
 "Zapisz tę pozycję do pliku, nic u Ciebie nie ruszając":"Save this item to a file without touching anything of yours",
 "gotowe zestawy od ludzi i Twoje dla nich, na forum #zestawy":"ready-made setups from people and yours for them, on the #zestawy forum",
 "Weź gotowy zestaw":"Take a ready-made setup",
 "Może ktoś już ustawił Twoją grę. Zajrzyj na forum albo wczytaj plik lub odnośnik.":"Somebody may already have set up your game. Look at the forum, or load a file or a link.",
 "Podziel się swoim":"Share yours",
 "Kreator ułoży post za Ciebie: tytuł, tagi i plik.":"The wizard writes the post for you: the title, the tags and the file.",
 // The third room, one quiet line under the two tiles (#xhShowcase). The channel name sits in
 // its own `data-noi18n` span, so the key stops just before it and the arrow is left alone.
 "Masz coś fajnego? Pokaż to na":"Made something neat? Show it on",
 "Jak działa dzielenie się?":"How does sharing work?",
 // the chip on that last button is built ONCE at boot (rf-39l initExchangeHero), so unlike the
 // one inside the exchange window it has to survive a language switch through the dictionary
 "zacznij tu":"start here",
 // ——— saving the current configuration, now a row inside the Library card ———
 "Zapisz obecną konfigurację jako zestaw:":"Save the current configuration as a setup:",
 "podmienia konfigurację od razu (da się cofnąć),":"swaps the configuration in at once (it can be undone),",
 "szukaj po nazwie, grze albo autorze…":"search by name, game or author…",
 "Wczytuję bibliotekę…":"Loading the library…",
 "Nie masz zapisanych wyzwalaczy. Zapiszesz je na ekranie Mapowanie, gdy ułożysz zestaw reguł.":"You have no saved triggers. You save them on the Mapping screen once you have a set of rules.",
 "Nie masz zapisanych ustawień osi. Zapiszesz je na ekranie Czujnik, po skalibrowaniu kapsla.":"You have no saved axis settings. You save them on the Sensor screen after calibrating the capsule.",
 // Puste szuflady profili myszy i zestawów mapowań — zdania stawiane przez _rflEmpty (rf-39i).
 // Ta pierwsza przyjechała z presetami myszy i pary nigdy nie dostała.
 // ——— kreator posta: kroki ———
 "Kreator posta z zestawem":"Setup post wizard",
 "Plik":"File","Tagi":"Tags","Podpis":"Signature","Podgląd":"Preview",
 "Podziel się na forum":"Share on the forum",
 // Singular forms: the wizard's "kind of file" chips. The library's pills use the plural ones above.
 "Zestaw":"Setup",
 "Preset wyzwalaczy":"Trigger preset",
 "Preset osi 3D":"3D axis preset",
 "Zacznijmy od tego, czym się dzielisz. Od rodzaju zależą tagi, treść posta i plik do pobrania.":"Let us start with what you are sharing. The kind decides the tags, the body of the post and the file you download.",
 "Rodzaj pliku:":"Kind of file:",
 "Paczka akcji REST":"REST action pack",
 "Co to robi, w dwóch zdaniach.":"What it does, in two sentences.",
 "Wstecz":"Back","Dalej":"Next","Przejdź na Discord ↗":"Go to Discord ↗",
 "Nazwa zestawu":"Setup name",
 "np. Precyzyjne czasówki":"e.g. Precise time attack",
 "Gra lub program":"Game or program",
 "np. Trackmania":"e.g. Trackmania",
 "Krótki opis":"Short description",
 "Co ten zestaw robi, w dwóch zdaniach.":"What this setup does, in two sentences.",
 "Tak wygląda Twój wątek po opublikowaniu.":"This is what your thread looks like once published.",
 "Zastosowanie. Wybierz przynajmniej jedno:":"Use. Pick at least one:",
 // Multi-capsule sets (rf-29c/rf-39f): roles authored at export, assigned at import.
 "Role kapsli — co robi każdy z nich w tej grze:":"Capsule roles — what each one does in this game:",
 "np. Kierowanie":"e.g. Steering","np. Skok i strzał":"e.g. Jump and shoot",
 "jak go trzymasz (nieobowiązkowe)":"how you hold it (optional)",
 // Last step: the publish checklist, one action button inside each numbered step.
 "Opublikuj w 4 krokach:":"Publish in 4 steps:",
 "Pobierz plik na dysk.":"Download the file to disk.",
 "Otwórz forum i kliknij „Nowy post”.":"Open the forum and click “New post”.",
 "Wklej tytuł i treść:":"Paste the title and the body:",
 "Zaznacz tagi i przeciągnij pobrany plik do posta:":"Tick the tags and drag the downloaded file into the post:",
 "żadna grupa wyjścia nie jest włączona, więc nie mam czego podpowiedzieć":"no output group is switched on, so there is nothing to suggest",
 "Pobierz plik .json":"Download the .json file",
 // ——— „load from somebody" window (rf-29b): only what is still written in Polish in the code —
 // the titles, the intro and the notes are built with _gl() now, so they need no key here ———
 "Adres pliku":"File address",
 "Pobieram tylko z załączników Discorda i z GitHuba.":"I only fetch from Discord attachments and from GitHub.",
 "Wersja tego zestawu. Podnieś ją, gdy publikujesz poprawkę.":"Revision of this setup. Raise it when you publish a fix.",
 // ——— canvas labels (rendered via _cvT — the DOM walker never sees fillText) + toast fallbacks ———
 "aktywny":"active","nieaktywny":"inactive","WCIŚNIĘTY":"PRESSED","zwolniony":"released",
 "próg":"threshold","przód":"front","tył":"back","NA ŻYWO":"LIVE","błąd":"error",
 "zagraj, aby zobaczyć widmo":"play to see the spectrum",
 "tryb myszy wyłączony":"mouse mode off","tryb gałki wyłączony":"stick mode off",
 "tryb krzyżaka wyłączony":"d-pad mode off","tryb sterowania wyłączony":"control mode off",
 "podgląd idzie za kapslem":"preview follows the capsule","pokaz (brak sygnału)":"demo (no signal)",
 // ——— live-scan sweep: fragments whose markup drifted from the old keys + option/name gaps ———
 "OSC działa od razu po sieci UDP i ma teraz":"OSC works right away over the UDP network and now has",
 "własny ekran „📡 OSC”":"its own “📡 OSC” screen",
 "z osobnym włącznikiem. Tam ustaw":"with its own enable switch. There, set the",
 "Piła":"Saw","Kwadrat":"Square","Trójkąt":"Triangle","Sinus":"Sine",
 "Syntezator":"Synth","Struna":"String","Trąbka":"Trumpet","Przestrzeń":"Space","Organy":"Organ","Gwizd":"Whistle","Smyczki":"Strings","Szum":"Noise",
 "wyciszony":"muted",
 // „Przester" = BRZMIENIE („🤘 Overdrive"). Ten sam wyraz jako parametr efektu (pokrętło / oś Y) brzmi
 // „Drive" i jest składany przez _gl() w rf-19 — jeden klucz, jedno znaczenie (był tu duplikat „Drive").
 "Dzwon":"Bell","Kwas":"Acid","Pianino elektryczne":"E-piano","Chórek":"Choir","Pozytywka":"Music box","Kosmos":"Cosmos","Przester":"Overdrive","Syrena":"Siren","Klarnet":"Clarinet",
 // 12 brzmień bazowych z 2026-10-02 — „Szkło":"Glass" już jest (wygląd okienka koła), ta sama para, więc bez duplikatu
 "Pulsar":"Pulsar","Hammond":"Hammond","Wokoder":"Vocoder","Radio":"Radio","Wiolonczela":"Cello","Przypływ":"Tide",
 "Kalimba":"Kalimba","Kropla":"Droplet","Gitara basowa":"Bass guitar","Bańka":"Bubble","Ropucha":"Toad",
 // kostki losowania per moduł (rf-25 randomizePatch); „Zaskocz mnie" ma swoją parę przy „Wylosowano brzmienie"
 "Wylosowano: Oscylatory":"Randomised: Oscillators","Wylosowano: Filtr":"Randomised: Filter",
 "Wylosowano: Obwiednia":"Randomised: Envelope","Wylosowano: Charakter":"Randomised: Character",
 // ——— cheat-sheet exit + overview odds and ends ———
 "brak orientacji":"no orientation",
 "Wróć do panelu głównego":"Back to the main dashboard",
 "← Wróć do panelu":"← Back to the dashboard",
 "cyklicznie, póki spełnione":"repeats while true",
 "Reguła z Mapowania":"Rule from Mapping",
 "Własny próg ruchu (jak w Synth)":"Custom motion threshold (like Synth)",
 // ——— final language pass: single nodes and attributes the earlier sweeps walked past ———
 "Filtr modułów":"Module filter",
 "Kolor":"Colour",
 "osie tego kapsla na tym padzie":"this capsule's axes on this pad",
 "Kreator zgłoszenia na forum pomocy":"Wizard for a post on the help forum",
 "Chwyć kulę — kapsel od razu przejdzie pod Twoją rękę":"Grab the ball — the capsule follows your hand at once",
 "Otwórz Ko-fi w przeglądarce ↗":"Open Ko-fi in your browser ↗",
 "Otwórz pełny panel w tym oknie":"Open the full dashboard in this window",
 "Zwiń ustawienia kapsla":"Collapse this capsule's settings",
 "Ruch kapsla napędza tę część pada. Włączenie odbiera ruch myszy albo drugiej połówce, bo kapsel ma jeden tryb ruchu naraz. Wyłączenie PARKUJE sam ruch: mapowania przycisków pada dalej wychodzą, a ustawienia zostają.":
   "The capsule's motion drives this half of the pad. Turning it on takes the motion from the mouse or the other half (one motion mode at a time). Turning it off PARKS only the motion: pad button mappings still go out, settings stay.",
 "Port 26760 jest zajęty — działa już inny serwer DSU albo druga kopia aplikacji. Zamknij go albo zmień port.":
   "Port 26760 is taken — another DSU server or a second copy of the app is already running. Close it or change the port.",
 "np. 6e400004-b5a3-f393-e0a9-e50e24dcca9e":"e.g. 6e400004-b5a3-f393-e0a9-e50e24dcca9e",
 "np. 20 10 00 d0 07 34 00 03":"e.g. 20 10 00 d0 07 34 00 03",
 "nazwa (np. Minecraft)":"name (e.g. Minecraft)",
 "np. Kursor ucieka w prawo po wczytaniu zestawu":"e.g. The cursor drifts to the right after a setup is loaded",
 "np. za każdym razem po wczytaniu zestawu; od wersji 1.0.0":"e.g. every time a setup is loaded; since version 1.0.0",
 "puść shift":"release shift",
 "Pauza":"Pause",
 "3× w 2 s":"3× in 2 s",
 // Wycinki trzech FABRYCZNYCH kół (WHEEL_FACTORY w ribbitflip_monitor.py). „Kopiuj" i „Głośność"
 // miały pary od dawna, więc te koła i tak wychodziły w angielskim pół na pół — reszta wyrównuje.
 "Następny":"Next","Poprzedni":"Previous","Głośniej":"Louder","Ciszej":"Quieter","Wycisz":"Mute",
 "Zrzut ekranu":"Screenshot","Wklej":"Paste","Wytnij":"Cut","Cofnij":"Undo",
 "Kopiuj i wklej":"Copy and paste","Przełącz okno":"Switch window","Widok zadań":"Task view",
 "Pulpit":"Desktop","Przypnij w lewo":"Snap left","Przypnij w prawo":"Snap right","Maksymalizuj":"Maximise",
 // ——— opisy rzeczy DOSTARCZANYCH Z APLIKACJĄ: presetów z Presets/ i fabrycznych kół
 // (WHEEL_FACTORY w ribbitflip_monitor.py). Nazwy zostają — to nazwy plików i wpisów w bibliotece
 // — ale zdanie „co to jest" jest zwykłą prozą i renderuje się jako CAŁY węzeł, więc ma parę.
 // Opisy zestawów z Library/ takich par NIE dostają: tamto jest już biblioteką użytkownika.
 // KLUCZ CZTERECH OSTATNICH PAR JEST UCIĘTY do 200 znaków — i tak ma być. Serwer tnie opis na
 // PROFILE_DESC_MAX (=200) zanim go poda, więc w DOM-ie stoi dokładnie ten prefiks, urwany
 // w połowie słowa; klucz z pełnym zdaniem nie trafiłby w nic. Angielska strona jest za to
 // całym zdaniem: nie ma powodu przepisywać obcięcia, którego nikt nie chciał.
 "Odtwarzacz pod jednym przyciskiem. Głośność siedzi w podmenu, bo to trzy akcje z rzędu.":
   "A media player under one button. Volume sits in a submenu, because that is three actions in a row.",
 "Kopiuj, wklej, cofnij i wycinek ekranu. Ostatni wycinek to makro: kopiuje i od razu wkleja.":
   "Copy, paste, undo and a screen clip. The last slice is a macro: it copies and pastes straight away.",
 "Układanie okien Windows: przełączanie, przypinanie do boków, pulpit. Nic tu nie zamyka programu.":
   "Laying out windows in Windows: switching, snapping to the sides, the desktop. Nothing here closes a program.",
 "Kapsel w dłoni, cztery strony świata: przechył w prawo to następny utwór, w lewo poprzedni, w tył głośniej, w przód ciszej. Kliknięcie przycisku to start i pauza. Przechył na ukos nie robi nic, więc t":
   "The capsule in your hand, four points of the compass: lean it right for the next track, left for the previous one, back for louder, forward for quieter. Clicking the button is play and pause. A diagonal lean does nothing, so it is hard to hit two actions at once. If one of the pairs works the wrong way round, flip that axis on the Sensor tab, in the “Flip the lean direction” row.",
 "Kapsel leży płasko na biurku i pracuje jak pokrętło: obrót w prawo podgłaśnia, w lewo przycisza, a im szybciej kręcisz, tym szybciej idzie. Kliknięcie przycisku kapsla to start i pauza. Wszystko dział":
   "The capsule lies flat on the desk and works like a knob: turn it right to raise the volume, left to lower it, and the faster you turn, the faster it moves. Clicking the capsule's button is play and pause. All of it works only while the capsule lies flat, so picking it up changes nothing. If the volume goes the other way, swap the keys in the louder and quieter rules.",
 "Uniwersalny punkt wyjścia na jeden kapsel: pochylenie steruje lewym drążkiem pada Xbox (ruch postaci), a przycisk kapsla wciska A. Po wczytaniu włącz sterowanie w zakładce Kontroler oraz grupę Mapowan":
   "A general starting point for one capsule: leaning drives the left stick of an Xbox pad (the character's movement) and the capsule's button presses A. Once it is loaded, switch the control on in the Controller tab and switch the Mapping group on. Needs the ViGEmBus driver. Sensitivity and dead zone are tuned by clicking the left stick on the pad drawing; you add more buttons by clicking them on the same drawing.",
 "Uniwersalny punkt wyjścia: DWA kapsle jako JEDEN pad Xbox. Lewa ręka prowadzi lewym drążkiem (ruch postaci), prawa prawym (kamera). Przycisk lewego kapsla wciska LB, przycisk prawego A. Kapsel prawej":
   "A general starting point: TWO capsules as ONE Xbox pad. The left hand drives the left stick (the character's movement), the right hand the right one (the camera). The left capsule's button presses LB, the right one's presses A. The right-hand capsule is set to play on the first one's pad, so the game sees one player rather than two pads. Once it is loaded, switch the control on in the Controller tab on both capsules and switch the Mapping group on. Needs the ViGEmBus driver. Sensitivities and dead zones are tuned by clicking the sticks on the pad drawing.",
 // Pole „dla” (forApp) tych samych czterech zestawów z Presets/. W wierszu Biblioteki (rf-39i3)
 // pozycje `official` nie mają data-noi18n, więc walker tłumaczy je tą parą; pole „dla” zestawów
 // UŻYTKOWNIKA blokadę zachowuje i par nie dostaje.
 "dowolna gra (pad Xbox)":"any game (Xbox pad)",
 "Spotify, YouTube, dowolny odtwarzacz":"Spotify, YouTube, any player",
 // ===== NAGRANE GESTY (rf-12d / rf-12e) =====
 // Napisy edytora i nagrywarki siedzą w słowniku modułowym RF_GEST_I18N (rf-12d). Tu stoi tylko
 // zdanie błędu, które wysyła SERWER (POST /gesture/analyze) — harness tests/i18n_server_errors
 // czyta wyłącznie ten plik, więc klucz musi być tutaj.
 "Nie udało się ocenić nagrań":"Could not judge the recordings",
 // Wymiary paska w każdym z jego stanów oraz kolor i krycie (2026-09-11). „Wysokość" i „szerokość"
 // znaczą co innego dla paska poziomego i pionowego, więc każda para nazywa OŚ, a nie wymiar.
 "Szerokość paska poziomego":"Width of the horizontal bar",
 "Wysokość paska pionowego":"Height of the vertical bar",
 "Ile obszaru pasek zajmuje wszerz. To wygląd, nie zasięg wyboru — krótszy pasek mniej zasłania, a gdzie skaner szuka, mówi obrys.":
   "How much of the area the bar spans. This is looks, not reach — a shorter bar hides less, and the outline still shows where the scanner is searching.",
 "Grubość dokładnej linii poziomej":"Thickness of the fine horizontal line",
 "Grubość dokładnej linii pionowej":"Thickness of the fine vertical line",
 "Kolor paska poziomego":"Colour of the horizontal bar",
 "Kolor paska pionowego":"Colour of the vertical bar",
 "Kolor dokładnego przebiegu":"Colour of the fine pass",
 "Krycie wypełnienia paska":"Bar fill opacity",
 "Ile widać przez pasek. Obrys i kreska w środku zostają wyraźne przy każdym ustawieniu — gaśnie samo wypełnienie.":
   "How much shows through the bar. The outline and the centre line stay crisp at any setting — only the fill fades.",
 // ===== SKANER EKRANU (rf-50*) =====
 // Etykiety pokręteł, opisy pod nimi, opcje i zestawy modułu „Skaner”. Wzięte wprost ze
 // słownika prototypu (poza repozytorium), żeby angielska
 // wersja modułu nie powstawała drugi raz ręcznie. Teksty liczone w locie mają angielski
 // przy sobie (`_scanT`) i par tu nie mają — stoją tu tylko napisy, które walker znajdzie
 // w DOM-ie.
 " (przebieg dokładny)":" (fine pass)",
 "0 = nigdy nie odpoczywa. Bez tego ekran potrafi migać w kółko.":"0 = it never rests. Without this the screen can blink forever.",
 "Akcja domyślna":"Default action",
 "Bez patrzenia":"Eyes-free",
 "Brak presetu skanera":"No such scanner preset",
 "Cały pulpit":"The whole desktop",
 "Cały pulpit to cały ekran. Przy kilku monitorach skaner pracuje na jednym z nich: na tym, z którego jest plansza, a bez planszy na głównym. Jeden ekran wskazuje monitor wprost. Własny prostokąt wyznaczasz sam i to on pozwala obsługiwać konkretną część gry albo aplikacji.":"The whole desktop is the whole screen. With several monitors the scanner works on one of them: the one the view comes from, and without a view on the main one. One screen names the monitor outright. A rectangle of your own you set yourself, and that is what lets you work one particular part of a game or an application.",
 "Chwila, w której nie przyjmujemy nic — na przypadkowe drugie naciśnięcie.":"A moment when nothing is accepted — for an accidental second press.",
 "Co się dzieje po wskazaniu":"What happens after pointing",
 "Co skaner robi we wskazanym punkcie, kiedy nie pyta o akcję.":"What the scanner does at the point you picked when it is not asking about the action.",
 "Cofnij zmianę":"Undo",
 "Czas jednego elementu":"Time per item",
 "Czas jednego pola":"Time per field",
 "Czas na rozejrzenie się, zanim cokolwiek ruszy. W Androidzie „opóźnienie pierwszego elementu”.":"Time to look around before anything moves. Android calls it “delay on first item”.",
 "Czasy — to tu mieszka dostępność":"Timing — where accessibility lives",
 "Czekaj na sygnał":"Wait for a signal",
 "Czekam na sygnał":"Waiting for a signal",
 "Czekanie na sygnał daje chwilę spokoju. Nowy przejazd od razu przydaje się wtedy, gdy klikasz kilka rzeczy po kolei.":"Waiting for a signal gives you a moment of calm. Starting a new pass straight away helps when you are clicking several things one after another.",
 "Dla wprawionych: jeden przebieg, wąskie pasmo, mocne dociąganie.":"For the practised: one pass, narrow band, strong snapping.",
 "Dociąganie do celu":"Snap to target",
 "Dodaj kolejny poziom szczegółu":"Add another level of detail",
 "Dojedź paskami":"Finish with bars",
 "Dokładny przebieg wolniejszy":"Fine pass slower by",
 "Domyślny kompromis: dwa przebiegi, płynny pasek, zawracanie.":"The default compromise: two passes, smooth bar, turns around.",
 "Drugi przebieg wraca w to samo pasmo wolniej i cienką linią. Tak robi to Apple w Switch Control: najpierw z grubsza, potem dokładnie.":"The second pass returns into the same band, slower and as a thin line. Apple’s Switch Control does exactly this: coarse first, then fine.",
 "Drugi przejazd wraca cienką linią i to ona wyznacza ostateczny punkt. Im cieńsza, tym celniej, ale tym trudniej trafić w moment.":"The second pass comes back as a thin line and that line fixes the final point. The thinner it is, the more accurate it gets and the harder it becomes to catch the moment.",
 "Drżenie i odbicie styku. Zwykle wystarcza 10–100 ms.":"Tremor and contact bounce. 10–100 ms is usually enough.",
 "Dwa (zgrubny + dokładny)":"Two (coarse + fine)",
 "Dwie osie to dwa sygnały. Tam, gdzie liczy się tylko wysokość, na przykład w liście albo w menu, jedna oś wystarczy i kosztuje o sygnał mniej.":"Two axes mean two signals. Where only the height matters, in a list or a menu for instance, one axis is enough and costs one signal less.",
 "Dziennik kliknięć":"Click log",
 "Ekran":"Screen",
 "Ekran dzieli się na pola. Zwykle najszybsze do dużych przycisków.":"The screen splits into fields. Usually fastest for big buttons.",
 "Elementy ekranu":"Screen items",
 "Gdy skaner czeka na sygnał, obszar z sekcji „Gdzie skaner ma działać” świeci półprzezroczyście — po zmianie kształtu albo liczb od razu widać, co się wpisało. 0 wyłącza wypełnienie i zostaje sam obrys. W oknie nad pulpitem obszar podświetla się na chwilę po każdej zmianie i zawsze samym obrysem, bo Windows wycina z tego okna jeden kolor.":
   "While the scanner waits for a signal, the area from the “Where the scanner works” section glows half-transparent — change the shape or the numbers and you see straight away what you typed. 0 turns the fill off and leaves the outline alone. In the window above the desktop the area lights up for a moment after every change, and always as an outline only, because Windows cuts one colour out of that window.",
 // Przełącznik miejsca skanera (15.09) — segment, podpis paska i panel pilota. Do 14.09 ten
 // segment wybierał tylko, gdzie oglądać OBRYS obszaru; teraz mówi, GDZIE JEST SKANER, więc
 // zmieniły się wszystkie trzy napisy razem z tytułem podpowiedzi.
 "Gdzie jest skaner":"Where the scanner is",
 // Przycisk uruchamiający skaner nad pulpitem NIE MIAŁ pary od 11.09 — po angielsku pokazywał
 // polski napis. Wychodzi przy okazji, bo dwa nowe komunikaty cytują go po imieniu.
 "Uruchom nad pulpitem":"Run over the desktop",
 "W symulacji":"In the simulation",
 "Jedno albo drugie: skaner pracuje w symulacji tej karty (pulpit testowy albo wgrana plansza) ALBO w oknie nad prawdziwym pulpitem. „W symulacji” zamyka okno nad pulpitem — także pracujący skaner.":"One or the other: the scanner works in the simulation of this card (the test desktop or a loaded view) OR in a window over the real desktop. “In the simulation” closes the window over the desktop — a working scanner included.",
 /* PLANSZE, CZYLI WIDOKI GRY (20.09). Po polsku „ekran" znaczyło w tej karcie i monitor, i widok
    gry; po angielsku „screen" ma dokładnie tę samą wadę, więc para dla „Plansza" to „View",
    a nie „Screen" — inaczej angielska wersja odziedziczyłaby dwuznaczność, którą polska właśnie
    straciła. Pulpit testowy (plansza zerowa) to „Test desktop". */
 "Plansze":"Views",
 "widoki gry na Twoim ekranie — każdy ma swoje skanery":"the game's views on your screen — each has its own scanners",
 "Plansze tej konfiguracji":"Views in this configuration",
 "Wgraj zrzut widoku gry — stanie się tłem podglądu, więc obszar skanowania wyznaczysz na prawdziwym obrazie. Możesz też upuścić plik na podgląd albo wkleić zrzut ze schowka (Ctrl+V).":"Load a screenshot of a game view — it becomes the background of the preview, so you set the scanning area on the real picture. You can also drop a file on the preview or paste a screenshot from the clipboard (Ctrl+V).",
 "Nowa grupa skanerow bez zrzutu. Przydaje sie, gdy chcesz pogrupowac skanery, a zdjecia widoku nie masz albo nie potrzebujesz.":"A new group of scanners without a screenshot. Handy when you want to group scanners and have no picture of the view, or do not need one.",
 "Wybrana":"Selected",
 "Nazwa tej planszy — po niej poznasz ją w spisie i przy skanerze.":"This view's name — you recognise it by this in the list and next to the scanner.",
 "Szerokość ekranu tej planszy w pikselach":"The width of this view's screen in pixels",
 "Wysokość ekranu tej planszy w pikselach":"The height of this view's screen in pixels",
 "Szerokość ekranu, z którego pochodzi ta plansza.":"The width of the screen this view comes from.",
 "Wysokość ekranu, z którego pochodzi ta plansza.":"The height of the screen this view comes from.",
 "↺ jak mój ekran":"↺ like my screen",
 "Wstaw rozdzielczość monitora, przy którym siedzisz.":"Use the resolution of the monitor you are sitting at.",
 "Usuń tę planszę":"Delete this view",
 "Zdejmuje obraz z tej planszy — zostaje grupa o tej samej nazwie i z tymi samymi skanerami. Sam zrzut znika też z dysku, chyba że trzyma go inna plansza, drugi kapsel albo zapisany plik.":"Takes the picture off this view — a group with the same name and the same scanners is left. The screenshot itself goes from the disk too, unless another view, another capsule or a saved file still holds it.",
 "Usuń tę planszę ze spisu. Skanery zostają, znika tylko ich przypisanie do niej — razem z planszą znika też jej zrzut z dysku.":"Delete this view from the list. The scanners stay, only their assignment to it goes — and the view takes its screenshot off the disk with it.",
 "Skaner jest na pulpicie":"The scanner is on the desktop",
 "Podgląd w aplikacji jest wyłączony, żeby dwa skanery nie pokazywały dwóch różnych rzeczy naraz. Przyciski niżej sterują oknem nad pulpitem.":"The preview in the app is off, so that two scanners do not show two different things at once. The buttons below drive the window over the desktop.",
 "■ Zamknij okno nad pulpitem":"■ Close the window over the desktop",
 // PIGUŁKI SKANERÓW (rf-50k). Pasek składa się w JS, ale te napisy są stałe. Same NAZWY skanerów
 // niosą `data-noi18n` — to podpisy człowieka, nie klucze słownika.
 "Edytujesz skaner":"You are editing scanner",
 "Skanery w tej konfiguracji":"Scanners in this configuration",
 "＋ Dodaj":"＋ Add",
 "🗑 Usuń":"🗑 Delete",
 "Pokazuj w podglądzie obszary pozostałych skanerów, każdy w swoim kolorze. Wyłączone — widać tylko ten, który edytujesz.":"Show the other scanners' areas in the preview, each in its own colour. Off — only the one you are editing is drawn.",
 "👁 Pozostałe w podglądzie":"👁 Others in the preview",
 // Zdanie o tym, CO stoi nad pulpitem, oraz komunikaty po zamknięciu jadą przez `_scanT(pl, en)`
 // w rf-50l — niosą EN przy sobie i nie przechodzą przez ten słownik (element ma `data-noi18n`,
 // bo napis powstaje w JS).
 "Gdzie skaner ma działać":"Where the scanner works",
 "Górna i dolna krawędź. „Dolna 1/3” to od 66,7% do 100%.":"The top and bottom edge. “The bottom 1/3” is from 66.7% to 100%.",
 "Gotowe kształty":"Ready-made shapes",
 "Gotowe. Sygnał zaczyna od nowa.":"Done. The signal starts a new round.",
 "Grubość linii":"Line thickness",
 "Grubość obrysu i linii pomocniczych. Podnieś ją, gdy patrzysz na ekran z daleka.":"The thickness of the outline and of the guide lines. Raise it when you look at the screen from a distance.",
 "Grubość paska jadącego w dół, czyli dokładność pierwszego trafienia. Przy jednym przebiegu to ona decyduje, jak blisko celu wylądujesz.":"The thickness of the bar travelling downwards, which is also how accurate the first hit is. With a single pass it alone decides how close to the target you land.",
 "Głośność przyszłych dźwięków skanera. Na razie nie ma czego ściszać.":"The volume of the scanner's future sounds. For now there is nothing to turn down.",
 "Ignoruj powtórkę w ciągu":"Ignore a repeat within",
 "Ile pól wszerz i ile wzdłuż. Dobierz je do tego, co jest na ekranie: rząd ikon na dole obsługuje się siatką 6 × 1 szybciej niż kwadratem, bo każde zbędne pole to czekanie przy każdym wyborze. Pola zapalają się od lewej górnej, wierszami, jak przy czytaniu.":"How many fields across and how many down. Match them to what is on the screen: a row of icons along the bottom is handled faster by a 6 × 1 grid than by a square, because every field too many is a wait at every choice. Fields light up from the top left, row by row, the way you read.",
 "Ile poziomów szczegółu":"Levels of detail",
 "Ile prędkości zostaje na drugi przejazd. Im mniej, tym wolniej wraca cienka linia i tym łatwiej zatrzymać ją dokładnie tam, gdzie trzeba.":"How much of the speed is left for the second pass. The less it is, the slower the thin line comes back and the easier it gets to stop it exactly where you want.",
 "Ile razy z rzędu wybrane pole ma się stać nowym obszarem. Każdy poziom to jeden sygnał więcej. Skaner kończy wcześniej, gdy pole zejdzie poniżej progu niżej.":"How many times in a row the picked field becomes the new area. Every level is one more signal. The scanner stops sooner when a field drops below the threshold below.",
 "Ile trzymać, żeby się liczyło":"How long to hold for it to count",
 "Im wolniej, tym łatwiej trafić i tym dłużej trwa przejazd. Zacznij nisko, przyspieszaj dopiero wtedy, gdy trafianie zaczyna wychodzić za każdym razem.":"The slower it goes, the easier it is to hit and the longer a pass takes. Start low and speed up only once hitting works every time.",
 "Jak skanujemy":"How it scans",
 "Jak szybko promień obraca się wokół środka. Pierwszy sygnał zatrzymuje go i ustala kierunek.":"How fast the beam turns around the centre. The first signal stops it and fixes the direction.",
 "Jak szybko punkt biegnie wzdłuż promienia po wybraniu kierunku. Drugi sygnał ustala odległość od środka.":"How fast the dot runs along the beam once the direction has been chosen. The second signal fixes the distance from the centre.",
 "Jeden":"One",
 "Jeden ekran":"One screen",
 "Jedno kliknięcie zamiast czterech liczb. Kształt jest proporcją, więc wpisuje się w procentach i przenosi między ekranami.":"One click instead of four numbers. A shape is a proportion, so it is written in percent and carries over between screens.",
 "Jednostka":"Unit",
 "Kalibracja opóźnienia":"Reaction-time calibration",
 "Każde pole osobno":"Each field on its own",
 "Klawiatura ekranowa":"On-screen keyboard",
 "Kliknij dwa razy":"Double click",
 "Kliknij środek":"Click its centre",
 "Kolejność osi":"Axis order",
 "Kolejność w kratce":"Order in the grid",
 "Kolor drugiego, cienkiego przejazdu. Trzeci kolor mówi wprost, że to już dopracowywanie, a nie szukanie.":"The colour of the second, thin pass. A third colour says plainly that this is fine tuning rather than searching.",
 "Kolor paska jadącego w bok. Dwa różne kolory od razu mówią, która oś jest w ruchu.":"The colour of the bar travelling sideways. Two different colours say at once which axis is moving.",
 "Kolor paska jadącego w dół. Dobierz taki, który odcina się od tego, po czym zwykle klikasz.":"The colour of the bar travelling downwards. Pick one that stands out from whatever you usually click on.",
 "Kolumnami":"By columns",
 "Kończ na nim":"Stop there",
 "Kończ na nim — wybrane pole jest ostatnie, a co skaner w nim zrobi, mówi „W ostatnim polu” niżej. Dodaj kolejny poziom szczegółu — wybrane pole staje się nowym obszarem i dzieli się tak samo jeszcze raz, co kosztuje kolejny sygnał.":"Stop there — the picked field is the last one, and what the scanner does in it is set by “In the last field” below. Add another level of detail — the picked field becomes the new area and is divided the same way once more, which costs one more signal.",
 "Kończ, gdy pole zejdzie poniżej":"Finish when a field drops below",
 "Lewa i prawa krawędź prostokąta, liczone w poprzek bazy.":"The left and right edge of the rectangle, measured across the base.",
 "Menu akcji":"Action menu",
 "Miejsce na dźwięk kroków i wyboru. Przełącznik zapisuje się z konfiguracją, ale skaner jeszcze nie gra.":"Room for the sound of steps and choices. The switch is saved with the configuration, but the scanner does not play anything yet.",
 "Miękka łuna wokół paska. Pomaga go znaleźć na pstrym tle, na jednolitym bywa zbędna.":"A soft glow around the bar. It helps to find it on a busy background, on a plain one it tends to be unnecessary.",
 "Naciśnij sygnał, żeby zacząć.":"Press the signal to start.",
 "Najpierw w bok, potem w dół":"Across first, then down",
 "Najpierw w dół, potem w bok":"Down first, then across",
 "Na pulpicie":"Over the desktop",
 "Nic, wróć":"Cancel",
 "O ile pasek przeskakuje. 0 = o własną grubość. Mniejszy skok niż grubość znaczy, że pola na siebie zachodzą — nic nie umknie między nimi.":"How far the bar jumps. 0 = by its own thickness. A step smaller than the thickness means the fields overlap, so nothing slips between them.",
 "Obok — {0} px":"Missed by {0} px",
 "Obrót promienia":"Ray rotation",
 "Obszar":"Area",
 "Od góry":"From the top",
 "Od lewej":"From the left",
 "Odpoczywam":"Resting",
 "Odsiewa muśnięcia i drgnięcia przycisku SYGNAŁ na tej karcie. ⚠️ Na kapsel NIE działa: reguła wysyła impuls w chwili ruchu i nie mówi, jak długo trzymałeś — po stronie kapsla odpowiednikiem jest zachowanie „Po odczekaniu” w samym wyzwalaczu (gotowce „Przytrzymane…” w sekcji „Czym sterujesz skanerem”). Pozycję i tak bierzemy z chwili NACIŚNIĘCIA, bo wtedy człowiek celował.":"Filters out brushes and tremors on the SIGNAL button of this card. ⚠️ It does NOT apply to the capsule: the rule sends a pulse the moment you move and never says how long you held — on the capsule side the equivalent is the “After a wait” behaviour of the trigger itself (the “Held…” ready-mades in “What drives the scanner”). The position still comes from the moment of the PRESS, because that is when you were aiming.",
 "Ostrożny":"Gentle",
 "Pasek staje na końcu na tyle czasu, zanim ruszy z powrotem. Chwila oddechu i ostatnia szansa na sygnał.":"The bar stands still at the end for this long before moving back. A breath, and a last chance to signal.",
 "Paski jadą już tylko wewnątrz wybranego pola i biorą swoje ustawienia z sekcji „Jak jedzie pasek”. Grubość przycina się do pola: pasek ustawiony na cały ekran zajmowałby je w całości i nie miałby po czym jechać.":
   "The bars now run inside the chosen field only, and take their settings from the “How the bar travels” section. The thickness is trimmed to the field: a bar set for the whole screen would fill it completely and have nowhere to travel.",
 "Pasy":"Bars",
 "Pasy — dwa paski wyznaczają punkt. Ćwiartki — ekran dzieli się na pola i zawęża, aż zostanie jedno małe. Radar — najpierw kierunek, potem odległość.":"Bars — two bars pin down a point. Blocks — the screen splits into fields and narrows until one small field is left. Radar — direction first, then distance.",
 "Piksele":"Pixels",
 "Po akcji":"After an action",
 "Po dojechaniu do końca":"When it reaches the end",
 "Po kolei":"One by one",
 "Po wskazaniu punktu skaner pyta: kliknij, prawy, kopiuj, usuń…":"After pointing, the scanner asks: click, right-click, copy, delete…",
 "Po wybraniu pola":"Once a field is picked",
 "Podgląd obszaru":"Area preview",
 "Podgląd obszaru na postoju":"Area preview while idle",
 "Podpis przy pasku":"Label next to the bar",
 "Podział":"Split",
 "Podział na pola":"Fields across and down",
 "Podział przestaje się zawężać, gdy pole zrobi się mniejsze niż tyle, a skaner klika jego środek. Mniej znaczy celniej, ale o rundę dłużej.":"The split stops narrowing once a field gets smaller than this, and the scanner clicks its centre. Less means more accurate but one round longer.",
 "Podział przestaje się zawężać, gdy pole zrobi się mniejsze niż tyle, a skaner kończy na nim. Mniej znaczy celniej, ale o rundę dłużej.":"The division stops narrowing once a field gets smaller than this, and the scanner stops there. Less means more precise, but one round longer.",
 "Pola zapalają się od lewej górnej, potem prawa górna, lewa dolna, prawa dolna — jak czytanie.":"Fields light up from the top left, then top right, bottom left, bottom right — like reading.",
 "Postój na krańcu":"Pause at the end",
 "Postój przed ruszeniem":"Pause before starting",
 "Poświata":"Glow",
 "Procenty":"Percent",
 "Procenty przeżywają zmianę rozdzielczości i działają tak samo na każdym ekranie. Piksele są dokładne co do jednego — przydają się tam, gdzie znasz dokładne wymiary okna albo interfejsu gry.":"Percentages survive a change of resolution and work the same on every screen. Pixels are exact to the one — they help where you know the exact size of a window or of a game interface.",
 "Przebiegi na oś":"Passes per axis",
 "Przeciągnij":"Drag",
 "Przejazdy, zanim odpocznie":"Passes before it rests",
 "Przerwa po wyborze":"Pause after a choice",
 "Przerwa po wyborze — odrzucone":"Pause after a choice — ignored",
 "Przewiń w dół":"Scroll down",
 "Przewiń w górę":"Scroll up",
 "Przy pasku jedzie mały podpis z nazwą osi i z tym, czy to już dokładny przejazd. Pomaga na początku, potem zwykle się go wyłącza.":"A small label travels next to the bar with the name of the axis and with whether this is already the accurate pass. It helps at the start, later it usually gets switched off.",
 "Przy własnym prostokącie ten ekran jest BAZĄ: procenty liczą się z jego boków, a piksele od jego lewego górnego rogu.":"With a rectangle of your own this screen is the BASE: the percentages are taken from its sides, and the pixels from its top-left corner.",
 "Przy „wierszami” skaner zapala najpierw całe wiersze, a dopiero w wybranym wierszu jego pola: dwa krótkie przejazdy zamiast jednego długiego. Przy siatce 4 × 4 to do 8 zapaleń zamiast 16.":"With “by rows” the scanner lights whole rows first and only then the fields of the row you pick: two short runs instead of one long one. On a 4 × 4 grid that is up to 8 lights instead of 16.",
 "Przyciemnienie poza obszarem":"Dimming outside the area",
 "Prędkość paska":"Bar speed",
 "Prędkość punktu":"Dot speed",
 "Punkt przeskakuje na najbliższy przycisk, jeśli jest bliżej niż tyle. Najtańszy skok celności.":"The point jumps to the nearest button if it is closer than this. The cheapest gain in accuracy there is.",
 "Punkt przeskakuje na najbliższy przycisk, jeśli jest bliżej niż tyle. Najtańszy skok celności. Nad prawdziwym pulpitem jest wyłączone, bo tam nie znamy przycisków Windowsa, więc skaner klika dokładnie tam, gdzie wskażesz.":"The point jumps to the nearest button if it is closer than this. The cheapest gain in accuracy there is. Above the real desktop it is switched off, because there we do not know the buttons of Windows, so the scanner clicks exactly where you point.",
 "Pytaj, co zrobić w tym punkcie":"Ask what to do at this point",
 "Płynny":"Smooth",
 "Radar":"Radar",
 "Ruch paska":"Bar movement",
 "SYGNAŁ":"SIGNAL",
 "Skaner czyta pozycję sprzed tylu milisekund. Zmierz to w „Treningu” — zwykle 150–350 ms.":"The scanner reads the position from this many milliseconds ago. Measure it under “Practice” — usually 150–350 ms.",
 "Skaner ekranu":"Screen scanner",
 "Skaner odpoczywa. Naciśnij sygnał, żeby wznowić.":"The scanner is resting. Press the signal to resume.",
 "Skanuję":"Scanning",
 "Skok":"Step",
 "Skokowy":"Stepped",
 "Skokowy przeskakuje o zadany skok — trafia się w POLE, a nie w moment. Przy nierównym czasie reakcji bywa różnicą między „nie da się” a „da się”.":"Stepped jumps by a fixed step — you hit a FIELD, not a moment. With an uneven reaction time it can be the difference between “impossible” and “doable”.",
 "Sposób wskazywania":"Pointing method",
 "Szerokość paska pionowego":"Width of the vertical bar",
 "Szybki":"Fast",
 "Teraz wskaż drugi punkt":"Now point at the second spot",
 "To samo dla linii pionowej, ustawiane osobno.":"The same for the vertical line, set separately.",
 "To samo dla paska jadącego w bok. Ustawia się osobno, bo ekran jest szerszy niż wyższy i w poziomie zwykle można pozwolić sobie na więcej.":"The same for the bar travelling sideways. It is set separately because the screen is wider than it is tall, so horizontally you can usually afford more.",
 "To samo w pionie i też tylko wygląd. Krótsze paski mniej zasłaniają to, w co celujesz.":"The same vertically, and also purely a matter of looks. Shorter bars hide less of what you are aiming at.",
 "Ton pozycji (skanowanie uchem)":"Position tone (scanning by ear)",
 "Ton pozycji, ruch skokowy, wolno. Do skanowania uchem.":"Position tone, stepped movement, slow. For scanning by ear.",
 "Trafione":"Hit",
 "Trening":"Practice",
 "Trening celności":"Accuracy practice",
 "Tyle pasek stoi w jednym polu, zanim przeskoczy dalej. To cały czas, jaki masz na sygnał, więc daj sobie zapas ponad własną reakcję.":"The bar stands in one field for this long before it jumps on. That is all the time you get for a signal, so leave yourself a margin over your own reaction.",
 "Tyle świeci jedno pole, zanim zapali się następne. Przy menu akcji dotyczy też pozycji tego menu.":"One field stays lit for this long before the next one lights up. With the action menu it applies to the menu items as well.",
 "Tylko przesuń kursor":"Move pointer only",
 "Tylko w bok (jedna oś)":"Across only (one axis)",
 "Tylko w dół (jedna oś)":"Down only (one axis)",
 "W ostatnim polu":"In the last field",
 "W aplikacji":"In the app",
 "Wgraj zrzut ekranu gry — stanie się tłem podglądu, więc obszar skanowania wyznaczysz na prawdziwym obrazie. Możesz też upuścić plik na podgląd albo wkleić zrzut ze schowka (Ctrl+V).":"Load a screenshot of the game — it becomes the background of the preview, so you set the scanning area on the real picture. You can also drop a file on the preview or paste a screenshot from the clipboard (Ctrl+V).",
 "Wiersz, potem element":"Row, then item",
 "Wierszami":"By rows",
 "Własny prostokąt":"A rectangle of your own",
 "Wolno, szeroko, skokowo. Na start i przy nierównym ruchu.":"Slow, wide, stepped. For starting out and for uneven movement.",
 "Wraca na początek":"Jumps back to the start",
 "Wszystko poza obszarem, w którym skaner akurat szuka, gaśnie. Działa w podglądzie i w piaskownicy. Nad prawdziwym pulpitem zostaje sam obrys, bo Windows umie przygasić okno tylko w całości.":"Everything outside the area the scanner is currently searching goes dark. It works in the preview and in the sandbox. Above the real desktop only the outline is left, because Windows can dim a window as a whole and no other way.",
 "Wybierz akcję":"Pick an action",
 "Wybierz, co zrobić w tym punkcie.":"Choose what to do at this point.",
 "Wyprzedzenie (poprawka na reakcję)":"Lead (reaction-time correction)",
 "Wysokość dźwięku ma mówić, gdzie stoi pasek, żeby dało się skanować z zamkniętymi oczami. Tak jak wyżej: ustawienie się zapisuje, dźwięku jeszcze nie ma.":"The pitch is meant to say where the bar stands, so that scanning with your eyes closed becomes possible. As above: the setting is saved, the sound is not there yet.",
 "Wysokość dźwięku mówi, gdzie stoi pasek. Spróbuj z zamkniętymi oczami.":"The pitch tells you where the bar is. Try it with your eyes closed.",
 "Wysokość paska poziomego":"Height of the horizontal bar",
 "Wzór":"Pattern",
 "Z menu akcji":"With action menu",
 "Za chwilę ruszy…":"Starting in a moment…",
 "Za chwilę…":"About to start…",
 "Za krótkie naciśnięcie — odrzucone":"Too short a press — ignored",
 "Za szybko po poprzednim — odrzucone":"Too soon after the last one — ignored",
 "Zacznij od nowa":"Start again",
 "Zamiast klikać od razu, skaner przejedzie po liście akcji poniżej.":"Instead of clicking straight away, the scanner runs through the action list below.",
 "Zatrzymaj na elemencie.":"Stop on the item.",
 "Zatrzymaj na polu, w którym jest cel.":"Stop on the field that holds your target.",
 "Zatrzymaj na wierszu z celem.":"Stop on the row with your target.",
 "Zatrzymaj pasek dokładnie na kresce. 7 prób.":"Stop the bar exactly on the line. 7 tries.",
 "Zatrzymaj pionowy pasek na celu.":"Stop the vertical bar on your target.",
 "Zatrzymaj poziomy pasek na wysokości celu.":"Stop the horizontal bar at the height of your target.",
 "Zatrzymaj promień na kierunku celu.":"Stop the ray in the direction of your target.",
 "Zatrzymaj punkt na celu.":"Stop the dot on your target.",
 "Zawraca":"Turns around",
 "Zawracanie jest łagodniejsze dla oka: pasek nigdy nie znika, więc nie trzeba go szukać od nowa.":"Turning around is gentler on the eye: the bar never disappears, so you never have to find it again.",
 "Zaznacz wszystko":"Select all",
 "Zaznacz, co ma się pojawiać w menu akcji. Każda pozycja to sekunda czekania przy każdym kliknięciu, więc mniej znaczy szybciej.":"Tick what should appear in the action menu. Every entry is a second of waiting on every click, so fewer means faster.",
 "Zdejmij":"Remove",
 "Zdejmuje zrzut z tej sekcji skanera. Plik zostaje w Settings/ScanTla — wgranie go ponownie nic nie kosztuje.":"Takes the screenshot off this scanner section. The file stays in Settings/ScanTla — loading it again costs nothing.",
 "Zrzut gry":"Game screenshot",
 "Zrównoważony":"Balanced",
 // Przycisk wgrania zrzutu ma ikonę na początku, więc alfabet sekcji zaczyna się dla niego od
 // emoji — jak przy pozycjach „🎮 Pad:" wyżej. Stoi na końcu, żeby nie rozbijać porządku liter.
 "🖼️ Wgraj zrzut…":"🖼️ Load a screenshot…",
 "mysz":"mouse",
 "opóźnienie":"lag",
 "poziom":"across",
 "prób":"tries",
 "skaner":"scanner",
 "w menu":"in menu",
 "{0} celów":"{0} targets",
 "Ćwiartki":"Blocks",
 "Środkowy przycisk":"Middle click",
 // Sekcja „Co daje sygnał" (rf-50i) — które ruchy kapsla wyzwalają skaner.
 "Co daje sygnał":"What provides the signal",
 "Puknięcie w kapsel":"A tap on the capsule",
 "Najprostsze i domyślne: jedno naciśnięcie przycisku kapsla.":
   "The simplest and the default: one press of the capsule's button.",
 "Przechylenie w prawo":"Lean to the right",
 "Kapsel odchylony w bok — dla rąk, którym łatwiej przechylić niż nacisnąć.":
   "The capsule leaned sideways — for hands that find leaning easier than pressing.",
 "Przechylenie w lewo":"Lean to the left",
 "Skinienie w przód":"A nod forward",
 "Pochylenie kapsla do przodu. Przy kapslu na głowie to zwykłe kiwnięcie.":
   "The capsule tipped forward. With the capsule on your head, that is an ordinary nod.",
 "Otwórz w Mapowaniu":"Open in Mapping",
 "Te same reguły, tylko z pełnym edytorem: progi, warunki dodatkowe, warstwy.":
   "The same rules, only with the full editor: thresholds, extra conditions, layers.",
 "Co ma wyzwalać skaner":"What should trigger the scanner",
 "Który sygnał":"Which signal",
 "Konfiguracje skanera":"Scanner configurations",
 "Najpierw włącz moduł Skaner na tym kapslu.":"Switch the Scanner module on for this capsule first.",
 "Nie ma takiej sekcji skanera.":"There is no such scanner section.",
 "Nie ma takiego ekranu skanera.":"There is no such scanner screen.",
 // 20.09: „ekran" → „plansza" (patrz nota przy „Plansze" wyżej). Stary klucz zostaje, bo czyta
 // go aplikacja, która jeszcze nie ma tej wersji serwera.
 "Nie ma takiej planszy skanera.":"There is no such scanner view.",
 // — Synth: pad backgrounds (rf-24b) — names, descriptions (option titles) and the header/fx controls —
 "Zwykłe":"Plain",
 "Klasyczne niebieskie tło pada, bez reakcji na dźwięk.":"The classic blue pad, no reaction to sound.",
 "Haft":"Embroidery",
 "Kanwa i krzyżyki: korektor wyszywany nitką, a każda żaba wyszywa pole w swoim kolorze.":"Canvas and cross-stitch: an equaliser sewn in thread, and each frog stitches a patch in its own colour.",
 "Staw":"Pond",
 "Woda z góry, liczona jak prawdziwa: wodą porusza tylko żaba. Płynąc zostawia smugę fal, jej śpiew i bas drżą na tafli, uderzenie to plusk pod nią.":"Water seen from above, simulated like the real thing: only the frog moves it. Swimming leaves a trail of waves, its singing and the bass tremble on the surface, a hit is a splash under it.",
 "Staw: ciekły metal":"Pond: liquid metal",
 "Tafla ciekłego srebra w ciemności. Światło stoi tylko z boków, więc spokojna tafla jest czarna, a odblask wyłania się dopiero na zboczach fal od żaby: z lewej zielony, z prawej różowy. Metal jest cięższy od wody, więc fala szybko gaśnie. Każda żaba świeci swoim kolorem na falach wokół siebie.":"A sheet of liquid silver in the dark. The light stands only at the sides, so a calm surface is black and the glint appears only on the slopes of the frog's waves: green from the left, pink from the right. Metal is heavier than water, so the wave dies out quickly. Every frog glows in its own colour on the waves around it.",
 "Sprej z zaciekami":"Spray with drips",
 "Każda żaba maluje sprejem po betonie swoim kolorem, a głośność to ciśnienie w puszce. Gdzie farby jest dużo, spływają zacieki, od cienkich strużek po grube, z kroplą na końcu. Po odjeździe żaby farba jeszcze chwilę sama cieknie, każdy zaciek inaczej długo, a potem zastyga. Stara farba powoli blednie.":"Every frog sprays its own colour on concrete, and loudness is the pressure in the can. Where the paint is heavy, runs drip down, from thin trickles to fat ones, with a bead at the end. After the frog moves on the paint keeps running for a while, each run for its own time, then sets. Old paint slowly fades.",
 "Akwarela":"Watercolour",
 "Każda żaba maluje swoim kolorem po mokrym papierze. Barwniki rozlewają się, mieszają jak farby i schną z ciemniejszym brzegiem. Uderzenie to kropla czystej wody pod żabą, która wypycha kolor w kalafiorowy wykwit. Żaba ciągnie za sobą mokrą farbę w wiry.":"Each frog paints in its own colour on wet paper. The pigments spread, mix like paint and dry with a darker edge. A hit is a drop of clean water under the frog that pushes the colour out into a cauliflower bloom. The frog drags the wet paint behind it into swirls.",
 "Rafa: sitodruk":"Reef: riso print",
 "Grube kropki odbite z dwóch bębnów na kremowym papierze: fluorescencyjny róż i morska zieleń, lekko rozjechane jak w risografie. Żaba jest dziobem łodzi: rozpycha kropki na boki, a na pustym papierze powoli pączkują nowe. Bas je nadmuchuje. Szybka żaba ciągnie kropki za sobą, a w jej kilwaterze pączkują nowe.":"Fat dots printed from two drums on cream paper: fluorescent pink and sea green, slightly off register like a risograph. The frog is a bow: it shoves the dots aside, and new ones slowly bud on the empty paper. The bass puffs them up. A fast frog drags the dots along, and new ones bud in its wake.",
 "Skrzek":"Frogspawn",
 "Żabi skrzek w ciemnej wodzie: galaretowate kulki z jasną otoczką i bursztynowym jądrem. Sam leży spokojnie, kulki tylko lekko oddychają. Ruch żaby wyciera skrzek, a w wytartym śladzie tuż za nią pojawiają się drobne jajeczka w jej kolorze, które dzielą się i rosną, aż po kilku sekundach zarosną ślad. Uderzenie albo nowa nuta składa pod żabą grudkę skrzeku.":"Frogspawn in dark water: jelly balls with a bright rim and an amber nucleus. Left alone it lies calm, the balls only breathe a little. A moving frog wipes the spawn away, and in the wiped trail right behind it small eggs in its colour appear, dividing and growing until after a few seconds they fill the trail. A hit or a new note lays a clump of spawn under the frog.",
 "Rafa: riso":"Reef: riso",
 "Labirynt odbity na risografie na kremowym papierze: niebieskie linie leżą na różowym rastrze cienia, a oba bębny są lekko rozjechane i przekrzywione. Półprzezroczysta farba jest ziarnista i miejscami niedobita, a tam, gdzie kolory się nakładają, wychodzi fiolet. Żaba czesze labirynt: linie układają się wzdłuż jej drogi i zostają jak ślad grzebienia, a potem powoli wracają do własnych wirów. Bas pogrubia linie. Żaba ciągnie labirynt za sobą i wycina w nim świeży rowek, w który linie potem wrastają.":"A maze printed on a risograph on cream paper: blue lines sit on a pink halftone shadow, and the two drums are slightly off register and askew. The translucent ink is grainy and under-inked in places, and where the colours overlap they turn violet. The frog combs the maze: the lines line up along its path and stay like the trace of a comb, then slowly curl back to their own swirls. The bass thickens the lines. The frog drags the maze along and cuts a fresh groove in it that the lines then grow back into.",
 "Rafa: metaliczny staw":"Reef: metal pond",
 "Rafa odlana z wypolerowanego chromu w oświetlonym studiu: cienkie, miękko zaokrąglone linie papilarne odbijają softbox, zimną listwę świetlną, różowy i limonkowy panel oraz rząd lamp u góry, które grają w rytm widma. Żaba wytapia pod sobą lustrzane wgłębienie, które drobno faluje, żarzy się do białości pod żabą i stygnie przez pomarańcz do jej koloru. Gdy żaba odpłynie, metal krystalizuje się z powrotem w linie papilarne. Głośność rozjaśnia softbox, a uderzenie dzwoni metalem. Bas wprawia cały odlew w drżenie, głośne granie wije liniami, a uderzenie puszcza od każdej żaby pierścień po metalu.":"A reef cast in polished chrome in a lit studio: thin, softly rounded fingerprint lines reflect a softbox, a cold strip light, a pink and a lime panel and a row of lights at the top that play the spectrum. The frog melts a mirror hollow under itself that ripples finely, glows white-hot under the frog and cools through orange to its colour. When the frog swims off, the metal crystallises back into fingerprint lines. The volume brightens the softbox, and a hit rings the metal. The bass sets the whole cast shivering, loud playing makes the lines wriggle, and a hit sends a ring across the metal from every frog.",
 // Synth — third batch of pad backgrounds (print off register, hair and cloth, play things)
 "Staw: riso":"Pond: riso",
 "Staw wydrukowany na risografie: zbocza fal od strony światła odbijają się różowym rastrem, od strony cienia morską zielenią, a oba bębny są lekko rozjechane. Spokojna woda to prawie czysty papier, a każde kółko od żaby wychodzi w dwóch farbach.":"The pond printed on a risograph: wave slopes facing the light come out in a pink halftone, the shaded ones in sea green, and the two drums sit slightly off register. Calm water is almost bare paper, and every ring from the frog prints in two inks.",
 "Wycinanka":"Paper cut",
 "Pagórki z darcia kolorowego papieru ułożone warstwami, każda rzuca cień na tę za nią. Każda warstwa słucha innego pasma dźwięku: najdalsza basu, najbliższa wysokich tonów. Bas nadmuchuje tylne wzgórza szeroko i obło, wysokie tony wyostrzają szczyty z przodu, a w każdej warstwie lewa strona to dół jej pasma, prawa jego góra. Bas odrywa też warstwy od siebie, więc cienie się wydłużają. Żaba wciska papier w dół.":"Hills of torn coloured paper laid in layers, each casting a shadow on the one behind. Every layer listens to its own band of the sound: the farthest to the bass, the nearest to the treble. The bass swells the back hills broad and round, the treble sharpens the peaks in front, and within each layer the left side is the low end of its band and the right side its top. The bass also pulls the layers apart, so the shadows grow longer. The frog presses the paper down.",
 "Welur":"Velvet",
 "Ciemnoróżowy welur z połyskiem. Żaba przeczesuje włos swoją drogą i zostawia na tkaninie ślad jaśniejszy albo ciemniejszy, zależnie od kierunku. Głośność rozświetla połysk. Światło powoli się przesuwa, więc welur mieni się sam.":"Deep pink velvet with a sheen. The frog brushes the pile along its path and leaves a trail on the fabric, lighter or darker depending on the direction. Loudness brightens the sheen. The light slowly moves, so the velvet shimmers by itself.",
 "Cekiny":"Sequins",
 "Tkanina z dużymi dwustronnymi cekinami, jak na bluzie. Żaba przejeżdżając w dół albo w bok odwraca je na stronę w swoim kolorze, a jadąc w górę z powrotem na srebro. W spoczynku cekiny leżą matowo: błyska tylko ten, który się właśnie obraca, i gaśnie we własnym tempie, a czasem pojedynczy cekin sam złapie światło. Bas przepuszcza po nich falę połysku.":"Fabric with large reversible sequins, like on a sweatshirt. Brushing down or sideways the frog flips them to the side in its colour, brushing up flips them back to silver. At rest the sequins lie matte: only a sequin that is turning flashes and fades at its own pace, and now and then a single sequin catches the light by itself. The bass sends a wave of sheen across them.",
 "Koszulka termo":"Hypercolor tee",
 "Bawełna, która zmienia kolor od ciepła, jak koszulki z lat 90. Żaba grzeje materiał, a głośne granie grzeje mocniej: morski przechodzi w róż, a najgorętsze miejsca w żółć. Ciepło rozlewa się i powoli stygnie, a fałdy lekko drgają z basem. Uderzenie to błysk ciepła.":"Cotton that changes colour with warmth, like the tees of the nineties. The frog warms the fabric, and loud playing warms it more: sea blue turns pink, and the hottest spots turn yellow. The warmth spreads and slowly cools, and the folds tremble a little with the bass. A hit is a flash of warmth.",
 "Lampa lava":"Lava lamp", "Lampa lava v2":"Lava lamp v2", "Lampa lava: lampa jak prawdziwa, widziana przez szkło. Wosk jest bryłą w trzech wymiarach: żarówka pod dnem prześwietla go od spodu, więc cienkie brzegi i krople tuż nad kałużą świecą gorącym bursztynem, a grube jądra ciemnieją do głębokiej czerwieni. Kule noszą odbicie okna ze szkła, miękki rąbek i poświatę w cieczy, a ciecz nad żarówką drga jak ciepłe powietrze nad grzejnikiem. Cykl jest spokojny: z kałuży pączkują kule, odrywają się z szyjką, płyną w górę jak grzybki z ogonkiem, stygną, zawisają w pół drogi i opadają długimi łzami do kałuży, która faluje przy każdym dotyku. Żaba to ciepły palec na szkle: wosk w pobliżu grzeje się, unosi i płynie ku niej, barwiąc się jej kolorem. Każda żaba nosi też swój bąbel wosku: płynie za nią, zlewa się z mijanym woskiem i warstwami, a po odejściu żaby zostaje w lampie. Żaba w dolnym lub górnym pasie szybko wyciąga kulę z warstwy. Bas rozgrzewa żarówkę, uderzenie to puknięcie w szkło: wosk drży, a warstwy się marszczą.":"Lava lamp: a lamp like the real thing, seen through the glass. The wax is a solid in three dimensions: the bulb under the base lights it from below, so thin edges and drops just above the puddle glow hot amber while thick cores darken to deep red. The balls carry the window's reflection off the glass, a soft rim and a halo in the liquid, and the liquid above the bulb shimmers like warm air over a heater. The cycle is calm: balls bud from the puddle, break away with a neck, rise like little mushrooms with a tail, cool, hang halfway and sink as long tears into the puddle, which ripples at every touch. The frog is a warm finger on the glass: wax nearby heats up, lifts and flows towards it, taking on its colour. Every frog also wears its own bubble of wax: it follows the frog, blends with the wax and the layers it passes and stays in the lamp when the frog leaves. A frog in the bottom or top strip quickly pulls a ball out of that layer. The bass heats the bulb, a hit is a tap on the glass: the wax quivers and the layers wrinkle.", "Lampa lava v2: jak zwykła lampa, ale każda żaba nosi wokół siebie bąbel wosku. Bąbel płynie za żabą z opóźnieniem, rozciąga się w ruchu, zlewa się z mijanym woskiem i łączy się z dolną kałużą i górną warstwą jak wosk z woskiem: warstwa podciąga się do niego, a odciągnięty ciągnie za sobą woskową szyjkę, aż ta puści. Nie znika: gdy żaba odejdzie, bąbel zostaje i dryfuje z woskiem, a kolejna żaba go przejmuje. Dolna kałuża i górna warstwa falują przy każdym dotyku wosku: kula albo bąbel wciska się w nie, a fala rozchodzi się na boki i powoli gaśnie. Bas grzeje mocniej, więc pączkuje więcej kul.":"Lava lamp v2: like the plain lamp, but every frog carries a bubble of wax around it. The bubble follows the frog with a lag, stretches as it moves, blends with the wax it passes and joins the bottom puddle and the top layer like wax joins wax: the layer rises to meet it, and pulled away it drags a neck of wax along until it lets go. It never disappears: when the frog leaves, the bubble stays and drifts with the wax, and the next frog takes it over. The bottom puddle and the top layer ripple at every touch of wax: a ball or a bubble presses into them, and the wave runs off to the sides and slowly dies down. The bass heats harder, so more balls bud.", "Deskorolka":"Skate bowl", "Stary, pusty basen do jazdy na deskorolce w kształcie nerki, widziany z góry w 3D, cały w kadrze, z gładkim dnem, graffiti, pęknięciami i śladami kół. Deska jedzie za żabą, czuje grawitację i pochyla się w zakrętach. Każda nowa nuta albo szybkie machnięcie żabą to wyskok, a trik zależy od kierunku ruchu żaby w tej chwili: w miejscu ollie, do przodu kickflip, do tyłu heelflip, w bok shove-it w jedną albo drugą stronę, a po skosie varial, hardflip albo inward heelflip; szybciej wychodzą podwójne, 360 flip i laser flip. Druga nuta w powietrzu dokłada trik spóźniony (late flip, late shove-it, impossible), a przy nieruchomej żabie łapie deskę: nosegrab, tailgrab, indy, melon, a w wysokim locie method i stalefish. Kickflip, a w locie druga nuta z żabą dalej pędzącą do przodu, to RibbitFlip: deska robi jeszcze jeden flip i salto jak skacząca żaba. To najwyżej punktowany trik, ogłaszany wielkim komiksowym wybuchem. Krążenie żabą wokół deski dokręca obrót. Wylądujesz prosto, trik się liczy; krzywo, to gleba i koniec kombinacji. Na krawędzi deska grinduje albo ślizga się, zależnie od kąta wjazdu i miejsca żaby: 50-50, 5-0, nosegrind, smith, feeble, crooked, boardslide i lipslide; przesuwając żabę zmieniasz grind w trakcie. Triki składają się w kombo z punktami i rekordem, wynik jest w lewym górnym rogu. Pod spodem deski są naklejki z żabą, liściem lilii i gwiazdką. Bez żaby deska stacza się na dno.":"An old, empty kidney-shaped skate pool seen from above in 3D, all in the frame, with a smooth floor, graffiti, cracks and wheel marks. The board follows the frog, feels gravity and leans into the turns. Every new note or a quick flick of the frog is a pop, and the trick depends on the direction the frog moves at that moment: still for an ollie, forward for a kickflip, back for a heelflip, sideways for a shove-it either way, and diagonally for a varial, hardflip or inward heelflip; faster gives doubles, a 360 flip and a laser flip. A second note in the air adds a late trick (late flip, late shove-it, impossible), and with the frog held still it grabs the board: nosegrab, tailgrab, indy, melon, and method and stalefish on a big air. A kickflip, then a second note in the air with the frog still racing forward, is a RibbitFlip: the board flips once more and somersaults like a jumping frog. It is the highest-scoring trick, announced by a big comic-book burst. Circling the frog around the board adds spin. Land straight and the trick counts; land crooked and it is a bail that ends the combo. On the coping the board grinds or slides, depending on the angle it comes in at and where the frog is: 50-50, 5-0, nosegrind, smith, feeble, crooked, boardslide and lipslide; moving the frog switches the grind on the way. Tricks build a combo with points and a record, with the score in the top-left corner. Under the deck there are stickers with a frog, a lily pad and a star. Without the frog the board rolls down to the bottom.",
 "Lampa lava: gęsty wosk powoli krąży w ciepłej cieczy. Z kałuży na dnie pączkują kule, rosną, odrywają się i płyną w górę, wydłużając się w krople. U góry rozlewają się w górnej warstwie wosku, która z czasem kapie z powrotem, a spadające krople roztapiają się w kałuży na dnie. Spotykające się kule zlewają się w większe, a duże z czasem pękają na dwie. Bas grzeje mocniej, więc pączkuje więcej kul. Żaba łagodnie rozpycha wosk i barwi go swoim kolorem, a grana w dolnym lub górnym pasie wyciąga z niego kulę: im dłużej brzmi, tym większą.":"A lava lamp: thick wax slowly circles in warm liquid. Balls bud from the puddle at the bottom, grow, break away and rise, stretching into drops. At the top they spread into the upper layer of wax, which in time drips back down, and the falling drops melt into the puddle at the bottom. Balls that meet merge into bigger ones, and big ones split in two in time. The bass heats harder, so more balls bud. The frog gently pushes the wax aside and tints it with its colour, and played in the bottom or top strip it pulls a ball out of it: the longer it sounds, the bigger the ball.",
 "Płonący papier":"Burning paper",
 "Żaba jest zapałką: gdzie przejdzie, papier się zwęgla, a brzeg żarzy. Głośne granie podsyca ogień. Po kilku sekundach spalone miejsca odrastają: najpierw zwęglony brzeg, potem przypalenie, na końcu czysty papier. Nad żarem unosi się dym: żaba ciągnie go za sobą, a po skręcie smuga wygina się i zostaje w tyle.":"The frog is a match: wherever it goes, the paper chars and its edge glows. Loud playing feeds the fire. After a few seconds the burnt places grow back: first the charred edge, then the scorch, finally clean paper. Smoke rises above the embers: the frog drags it along, and when it turns the plume bends and stays behind.",
 "Dwie rurki neonu za wypukłą szybą oscyloskopu: różowa rysuje przebieg dźwięku, zielona widmo. Ekran w matowej, ciemnej obudowie ma zaokrąglone rogi, lekko wygina obraz ku brzegom i ciemnieje w rogach. Pod rurkami tli się zielonkawy luminofor, po ekranie biegną ledwo widoczne linie, a na szkle stoi stały odblask. Przy uderzeniu neon się zacina. Każda żaba nosi neonowy pierścień w swoim kolorze.":"Two neon tubes behind the bulging glass of an oscilloscope: the pink one draws the sound's waveform, the green one the spectrum. The screen in a matt dark housing has rounded corners, bends the picture slightly towards its edges and darkens in the corners. A greenish phosphor glows under the tubes, barely visible lines run across the screen, and a fixed reflection sits on the glass. On a hit the neon flickers. Every frog wears a neon ring in its own colour.",
 "Poziomice":"Contour lines",
 "Mapa o gładkich poziomicach: zielone doliny przechodzą w różowe szczyty, linie są czarne. Głośność powoli podnosi teren, żaba usypuje pagórek, co piąta poziomica jest pogrubiona.":"A map with smooth contour lines: green valleys turn into pink peaks, the lines are black. Loudness slowly raises the terrain, the frog piles up a hill, every fifth contour line is bold.",
 "Poziomice: filc":"Contour lines: felt",
 "Drobna, płynna mapa z wyspami i zatokami. Każde pole między poziomicami to kawałek filcu w jednym twardym kolorze, stopniowanym od zieleni w dolinach przez krem do różu na szczytach. Poziomice są wyszyte ciągłym ściegiem czarnej nitki, co piąta grubiej.":"A fine, flowing map with islands and bays. Each field between contour lines is a piece of felt in one hard colour, stepped from green in the valleys through cream to pink on the peaks. The contour lines are sewn in a continuous black-thread stitch, every fifth heavier.",
 "Tło":"Background",
 "Ustawienia":"Settings",
 "Tło pada — reaguje na dźwięk tego pada":"Pad background — it reacts to this pad's sound",
 "Tło pada":"Pad background",
 "Pokaż albo schowaj żaby na tym padzie":"Show or hide the frogs on this pad", "Żaby":"Frogs", "Pokaż albo schowaj widok skali: kolumny nut, linie pomocnicze i nazwy nut":"Show or hide the scale view: note columns, guide lines and note names",
 "Pokaż albo schowaj ustawienia pada":"Show or hide the pad settings",
 "Pokaż ustawienia pada":"Show the pad settings",
 "Tło pada efektów — reaguje na dźwięk pada, którym ten pad steruje":"Effect pad background — it reacts to the sound of the pad this one steers",
 "Tło pada efektów":"Effect pad background",
 "Pokaż albo schowaj siatkę i opisy osi na tym padzie":"Show or hide the grid and axis labels on this pad",
 "Nie udało się zrobić zrzutu ekranu.":"Could not take the screenshot.",
 // Synth — programmed pads (rf-25b): a written melody line or drum pattern that plays itself
 "Pady zaprogramowane":"Programmed pads",
 "zapisana melodia albo rytm, gra sam · kapsel nim nie steruje, pad efektów może":"a written melody or rhythm that plays itself · no capsule steers it, an effect pad can",
 "Uruchom albo zatrzymaj wszystkie pady zaprogramowane naraz, równo w takt":"Start or stop every programmed pad at once, locked to the same beat",
 "▶ Graj wszystkie":"▶ Play all",
 "Dodaj pad, który sam gra zapisaną linię melodyczną albo rytm":"Add a pad that plays a written melody line or rhythm by itself",
 "Dodaj pad zaprogramowany":"Add a programmed pad",
 "Wspólne tempo padów zaprogramowanych":"Shared tempo of the programmed pads",
 "Tempo wspólne dla wszystkich padów zaprogramowanych — grają zawsze równo w takt":"One tempo for every programmed pad — they always play locked to the same beat",
 "tempo i swing są wspólne, więc pady nigdy się nie rozjadą":"tempo and swing are shared, so the pads never drift apart",
 "Dodaj pad":"Add a pad",
 "nowy pad pojawi się w swojej sekcji powyżej":"the new pad shows up in its own section above",
 "Pad grający":"Play pad",
 "grasz palcem albo kapslem":"you play it with a finger or a capsule",
 "Pad zaprogramowany":"Programmed pad",
 "zapisana melodia albo rytm, gra sam":"a written melody or rhythm that plays itself",
 "Pad efektów":"Effect pad",
 "kręci efektami innego pada":"turns the effects of another pad",
 "Pad perkusyjny: każdy wiersz to inny bęben":"Drum pad: every row is a different drum",
 "Zestaw perkusyjny":"Drum kit",
 "Wczytaj gotowy wzór — zastępuje nuty tego pada":"Load a ready pattern — it replaces this pad's notes",
 "Wczytaj wzór…":"Load a pattern…",
 "🎵 Melodia — przykład":"🎵 Melody — example",
 "🥁 Perkusja — rytm":"🥁 Drums — beat",
 "Usuń ten pad zaprogramowany":"Remove this programmed pad",
 "Odtwórz / zatrzymaj ten pad (w pełnym ekranie także spacja)":"Play / stop this pad (Space too, in full screen)",
 "▶ Graj":"▶ Play",
 "Swing":"Swing",
 "Kroki":"Steps",
 "Długość pętli w szesnastkach":"Loop length in sixteenth notes",
 "Usuń wszystkie nuty tego pada":"Remove every note on this pad",
 "Jasność i siła nut — to samo, co wysokość palca na padzie grającym":"Brightness and strength of the notes — the same as finger height on a play pad",
 "Barwa":"Tone",
 "Echo tego pada":"This pad's echo",
 "klik = uderzenie · przeciągnij w bok = kilka uderzeń · klik w uderzenie = usuń · klik w nazwę bębna = odsłuch":"click = a hit · drag sideways = several hits · click a hit = remove · click a drum name = listen",
 "klik = nuta · przeciągnij w bok = jedna dłuższa nuta · klik w nutę = usuń · klik w nazwę nuty = odsłuch":"click = a note · drag sideways = one longer note · click a note = remove · click a note name = listen",
 "Hi-hat otwarty":"Open hi-hat",
 "Hi-hat":"Hi-hat",
 "Klask":"Clap",
 "Rimshot":"Rimshot",
 "Tom wysoki":"High tom",
 "Tom niski":"Low tom",
 "Werbel":"Snare",
 "Stopa":"Kick",

 // ===== OSCYLOSKOP W BIBLIOTECE DŹWIĘKÓW (2026-10-02) =====
 // rf-25c + dashboard: narzędzia fali i nowa fala „Własna” w edytorze. Od etapu E6 narzędzia i krzywe żyją na
 // płaskich panelach w kartach modułów (rf-25e), a lampa jest tylko wizualizacją — pary klawiszy dawnych kanałów
 // odeszły razem z nimi. „Fala”, „Barwa” i „Wyczyść” mają już swoje pary wyżej; napisy
 // na samych ekranach (canvas) idą przez _gl() w rf-25c i rf-25e, bo walker canvasu nie widzi.
 "Obwiednia":"Envelope",
 "Własna":"Custom",
 "Sposób rysowania fali":"How to shape the wave",
 "Rysuj":"Draw",
 "Rysuj palcem albo myszą jeden okres fali":"Draw one period of the wave with a finger or the mouse",
 "Harmoniczne":"Harmonics",
 "Ustaw głośność 16 harmonicznych, jak suwaki w organach":"Set the level of 16 harmonics, like the drawbars of an organ",
 "Wygładź":"Smooth",
 "Wygładź kształt fali: barwa robi się łagodniejsza":"Smooth the wave shape: the tone gets softer",
 "Zacznij od czystego sinusa":"Start again from a pure sine",
 // etap E2 — korektor: narzędzia; podpisy na ekranie i odczyt krzyżyka idą przez _gl() w rf-25e
 "+ Pasmo":"+ Band",
 "Dodaj pasmo przy 1 kHz (najwyżej cztery)":"Add a band at 1 kHz (four at most)",
 "Usuń pasmo":"Remove band",
 "Usuń wybrane pasmo":"Remove the picked band",
 "Q −":"Q −",
 "Szersze pasmo: mniejsze Q":"Wider band: lower Q",
 "Q +":"Q +",
 "Węższe pasmo: większe Q":"Narrower band: higher Q",
 "Wyzeruj":"Reset",
 "Usuń wszystkie pasma: brzmienie bez korektora":"Remove all bands: the sound with no equaliser",
 // etap E3 — obwiednia: narzędzia; podpisy przy punktach, siatka czasu i odczyt krzyżyka idą przez _gl() w rf-25e
 "Domyślny kształt":"Default shape",
 "Przywróć wszystkim odcinkom domyślny kształt, taki jak w brzmieniu bez zgięć":"Give every segment its default shape back, as in a sound with no bends",
 "Bez obwiedni filtra":"No filter envelope",
 "Ustaw obwiednię filtra na zero: filtr nie rusza się przy nucie":"Set the filter envelope to zero: the filter stays put on each note",
 // etap E5 — okrągła lampa i pulpit obok: podpisy sekcji, okrągłe klawisze podglądu (ikona
 // i podpis to osobne węzły, więc dawne „▶ Testuj” / „⬇ Przytrzymaj” / „🔁 Podgląd ciągły” nie wystarczą),
 // wskaźnik poziomu i Powiększ („⤢ Powiększ” i „⤡ Zmniejsz” mają już pary wyżej). „Podgląd”
 // i „Przytrzymaj” też są wyżej.
 "Testuj":"Test",
 "Podgląd ciągły":"Continuous preview",
 "Poziom":"Level",
 "Wskaźnik poziomu":"Level meter",
 "Powiększ albo zmniejsz tarczę oscyloskopu":"Enlarge or shrink the oscilloscope dial",
 // 2026-10-03: legenda pod tarczą (napisy zeszły ze szkła lampy)
 "przebieg":"waveform",
 "widmo":"spectrum",
 // — rack edytora (E4a) —
 // pasek brzmienia, kolumna z listą i kostki modułów. „bazowe”, „własne”, „zmienione” (plakietka rodzaju i wiersze
 // listy), „Brzmienie”, „Nazwa”, „Głośność”, „Pętla testowa” i nagłówki modułów mają już pary wyżej. Plakietkę
 // i dymki wpisuje rf-25d po polsku, a tłumaczy je walker; napisy składane z nazwą brzmienia (aria-label ▶)
 // i chwilowe komunikaty w #seMsg idą przez _gl() w rf-25d.
 "nowe":"new",
 "Nowe brzmienie, jeszcze nie zapisane":"A new sound, not saved yet",
 "niezapisane zmiany":"unsaved changes",
 "Lista brzmień":"Sound list",
 "Pokaż albo schowaj listę brzmień":"Show or hide the sound list",
 "szukaj brzmienia…":"search sounds…",
 "Szukaj brzmienia po nazwie":"Search sounds by name",
 "Rodzaj brzmienia":"Kind of sound",
 "Wszystkie":"All",
 "Bazowe":"Base",
 "Własne":"Custom",
 "Zmienione":"Changed",
 "Wyczyść formularz i zacznij nowe brzmienie od ustawień domyślnych":"Clear the form and start a new sound from the default settings",
 "⧉ Duplikuj":"⧉ Duplicate",
 "Skopiuj edytowane brzmienie (wersję zapisaną) do nowego własnego":"Copy the sound you are editing (as saved) into a new custom sound",
 "Nic tu nie pasuje do wyszukiwania":"Nothing here matches the search",
 "Posłuchaj bez wczytywania":"Listen without loading it",
 "Losuj ten moduł":"Randomise this module",
 // — płaskie edytory (E6) —
 // lampa jest tylko wizualizacją, a krzywe edytuje się na płaskich panelach w kartach modułów (rf-25e). Klawisze
 // narzędzi paneli mają te same napisy co dawne narzędzia kanałów (pary wyżej), „Obwiednia” (etykieta panelu
 // obwiedni) też; podpisy na ekranach paneli idą przez _gl() w rf-25e. Pary przełącznika stylu lampy („Styl”,
 // „Pierścień”, „Linia”, ich dymki i pokrętło) odeszły w E7 razem z przełącznikiem: lampa ma jeden obraz.
 "Edytor fali":"Wave editor",
 "Korektor":"Equaliser",
 // — runda naprawcza po przeglądzie (2026-10-02) —
 // opisy skrótów klawiszowych paneli (ukryty span, na który wskazuje aria-describedby ekranu, rf-25e HELP) i nazwy
 // kostek w nagłówkach kart (aria-label, bo sam dymek „Losuj ten moduł” nie mówi, który to moduł)
 "Klawiatura w trybie Harmoniczne: [ i ] wybierają słupek, strzałki w górę i w dół zmieniają jego głośność, Shift daje większy krok.":"Keyboard in Harmonics mode: [ and ] pick a bar, the up and down arrows change its level, Shift takes a bigger step.",
 "Klawiatura: [ i ] wybierają pasmo, strzałki w lewo i w prawo zmieniają częstotliwość, w górę i w dół wzmocnienie, Page Up i Page Down szerokość pasma, Delete usuwa pasmo, Insert albo plus dodaje nowe, Shift daje większy krok.":"Keyboard: [ and ] pick a band, the left and right arrows change the frequency, up and down the gain, Page Up and Page Down the bandwidth, Delete removes the band, Insert or plus adds a new one, Shift takes a bigger step.",
 "Klawiatura: 1, 2 i 3 wybierają punkt (atak, zanik z podtrzymaniem, zwolnienie), strzałki w lewo i w prawo zmieniają czas, w górę i w dół podtrzymanie albo zgięcie odcinka, Page Up i Page Down zgięcie, Shift daje większy krok.":"Keyboard: 1, 2 and 3 pick a point (attack, decay with sustain, release), the left and right arrows change the time, up and down the sustain or the bend of the segment, Page Up and Page Down the bend, Shift takes a bigger step.",
 "Losuj: Oscylatory":"Randomise: Oscillators",
 "Losuj: Filtr":"Randomise: Filter",
 "Losuj: Obwiednia głośności":"Randomise: Volume envelope",
 "Losuj: Charakter":"Randomise: Character",

 // ===== GRA RIBBITBEAT (dawniej „Żabi chór”) W MENU (2026-10-02, nazwa 2026-10-03) =====
 // rf-34: link „RibbitBeat” pod Synthem otwiera web/gry/ w nowej karcie (to nie zakładka: bez panelu, kropki
 // i wiersza w „Widoczności zakładek”). Napis to nazwa gry, więc bez pary; tłumaczy się tylko dymek.
 // Sama gra mówi po polsku ze słownika T w web/gry/js/zabi-chor.js.
 "RibbitBeat: śpiewaj kapslem, padem albo myszą do nut z MIDI, otwiera się w nowej karcie":"RibbitBeat: sing the notes of a MIDI song with a capsule, a gamepad or the mouse, opens in a new tab",

 // ===== MODUŁY WYŁĄCZONE PRZY STARCIE (--disable / --only, 2026-10-15) =====
 // rf-00b-modules.js: karta na górze zakładki Konfiguracja; nazwy modułów idą z serwera w obu językach.
 
 "parametr --disable albo --only":"the --disable or --only option",
 "Aplikacja wstała bez tych modułów: nie mają zakładek ani kart, nie zajmują procesora i nie odpowiadają na zapytania. Żeby znów z nich korzystać, uruchom aplikację bez tego parametru.":"The app started without these modules: they have no tabs or cards, use no processor time and do not answer requests. To use them again, start the app without that option.",
 "wyłączony razem z modułem, którego potrzebuje":"switched off together with a module it needs",
 // Wybór w panelu (2026-10-16): karta jest zawsze, przełącznik na moduł, zapis do Settings i restart.
 
 "Wyłączony moduł nie wstaje razem z aplikacją: nie ma zakładki ani karty, nie zajmuje procesora i nie odpowiada na zapytania. Wybór zapisuje się od razu, a działa po ponownym uruchomieniu.":"A module that is switched off does not start with the app: it has no tab or card, uses no processor time and does not answer requests. Your choice is saved straight away and takes effect after a restart.",
 "Włącz albo wyłącz moduł przy następnym starcie":"Switch the module on or off for the next start",
 "wyłączy się razem z modułem":"switches off together with the module",
 
 "W tym uruchomieniu wyłączone:":"Switched off in this run:",
 "W tym uruchomieniu działają wszystkie moduły.":"All modules are running in this run.",
 "Parametr startu ma pierwszeństwo":"The start option takes priority",
 "Zmiana zadziała po ponownym uruchomieniu":"The change takes effect after a restart",
 "Tak działa to uruchomienie":"This is how the app is running now",
 "Uruchom ponownie":"Restart",
 "Zamyka aplikację i uruchamia ją od nowa z tym wyborem":"Closes the app and starts it again with this choice",
 "Uruchamiam ponownie…":"Restarting…",
 "Nie udało się zapisać wyboru":"Could not save the choice",
 "Pole disable musi być listą nazw modułów":"disable must be a list of module names",
 "Nie udało się zapisać pliku w Settings":"Could not write the file in Settings",
 "Nie udało się uruchomić ponownie":"Could not restart",
 "Aplikację uruchomiono z parametrem --disable albo --only (albo zmienną RIBBITFLIP_DISABLE lub RIBBITFLIP_ONLY), więc teraz liczy się on, a nie ten wybór. Wybór czeka zapisany i zadziała, gdy uruchomisz aplikację bez parametru.":"The app was started with the --disable or --only option (or the RIBBITFLIP_DISABLE or RIBBITFLIP_ONLY variable), so that option counts now, not this choice. The choice stays saved and takes effect when you start the app without the option.",

 // ===== UX 261120 A1: wspólne komponenty =====
 // (koniec sekcji A1)
 // ===== UX 261120 A2: rama aplikacji =====
 // Nawigacja w jednej karcie: sekcje „Moduły” i „Narzędzia”, ekran programu „Ustawienia” (D1).
 "Moduły":"Modules","Narzędzia":"Tools","Skaner":"Scanner",
 // Dymki pozycji nawigacji bez pauz. Nazwa dostępna „Nakładki” to napis + dymek sklejone w rf-34
 // (WCAG 2.5.3), więc jej klucza NIE MA dosłownie w źródłach. Nie usuwać jako „martwego”.
 "Skaner ekranu: obsługa jednym sygnałem":"Screen scanner: works with a single signal",
 "Usługi sieciowe: HTTP i OBS Studio":"Network services: HTTP and OBS Studio",
 "Ściąga wszystkich kapsli. Stąd wypuszczasz okna nad grę":"The cheat sheet of every capsule. This is where you send windows above the game",
 "Nakładka: ściąga wszystkich kapsli. Stąd wypuszczasz okna nad grę":"Overlay: the cheat sheet of every capsule. This is where you send windows above the game",
 // Kropki stanu: Usługi i Skaner wspólne dla wszystkich kapsli; trzeci stan przy wstrzymanym sterowaniu.
 "Włączony, wspólny dla wszystkich kapsli":"On, shared by every capsule",
 "Wyłączony, wspólny dla wszystkich kapsli":"Off, shared by every capsule",
 "Włączony, ale sterowanie jest wstrzymane":"On, but control is paused",
 // Karta stanu w prawej kolumnie (rf-34b paintOuts). Nazwa kapsla stoi obok, w osobnym węźle.
 "Co teraz wychodzi z":"Going out now from",
 "Sterowanie wstrzymane, nic nie wychodzi.":"Control is paused, nothing is going out.",
 "Włącz sterowanie":"Turn control on",
 "Nic nie wychodzi. Włącz moduł albo wczytaj zestaw.":"Nothing is going out. Turn a module on or load a setup.",
 // Aplikacja nie odpowiada (rf-08 rfOfflineSet).
 "RibbitFlip nie odpowiada.":"RibbitFlip is not responding.",
 "Uruchom aplikację ponownie z pliku RibbitFlip.exe albo z ikony przy zegarze.":"Start the app again from RibbitFlip.exe or from the icon next to the clock.",
 "⏻ Brak połączenia z aplikacją":"⏻ No connection to the app",
 // Pasek górny: przewodnik z napisem, dymki bez pauz.
 "Przewodnik":"Tour",
 "Przewodnik po panelu: pokażę krok po kroku, gdzie co jest":"Tour of the panel: I’ll show you step by step where everything is",
 "Tryb pracy: LIVE albo symulacja":"Working mode: LIVE or simulation",
 "Tryb pracy: LIVE albo symulacja. Przełączenie uruchamia aplikację ponownie":"Working mode: LIVE or simulation. Switching restarts the app",
 "Strona projektu RibbitFlip. Otworzy się w przeglądarce":"The RibbitFlip project page. Opens in your browser",
 "Serwer Discord RibbitFlip: #pomoc, #zestawy, #pochwal-się, #pomysły":"RibbitFlip Discord server: #pomoc, #zestawy, #pochwal-się, #pomysły",
 "Język / Language: PL ↔ EN":"Language: PL ↔ EN",
 // Przegląd wszystkich kapsli: dymek przycisku (rf-34b) i podpis karty (rf-34).
 "Co jest włączone na którym kapslu, w jednej tabeli zamiast obchodzenia zakładek":"What is switched on and on which capsule, in one table instead of walking the tabs",
 "Co jest włączone na którym kapslu. Kliknij przełącznik, żeby zmienić.":"What is switched on and on which capsule. Click a switch to change it.",
 // (koniec sekcji A2)
 // ===== UX 261120 B1: Mapowanie i Koło =====
 "Twoje wyzwalacze":"Your triggers",
 "Ruch albo przycisk kapsla naciska klawisz lub klika myszą.":"A capsule motion or button presses a key or clicks the mouse.",
 "Włącz albo wyłącz moduł Mapowanie. Działa niezależnie od Myszy, Kontrolera, MIDI i OSC.":"Turn the Mapping module on or off. It works independently of Mouse, Controller, MIDI and OSC.",
 "Ostatnie zadziałania":"Recent activations",
 "klawiatura = wysłano, oko = tylko podgląd":"keyboard = sent, eye = preview only",
 "Tu pojawi się każde zadziałanie. Porusz kapslem, żeby sprawdzić.":"Every activation shows up here. Move the capsule to try.",
 "Co ma zrobić kapsel?":"What should the capsule do?",
 "Wybierz ruch. Resztę ustawisz za chwilę.":"Pick a motion. You set the rest in a moment.",
 "Trzyma klawisz, dopóki kapsel jest pochylony w lewo.":"Holds the key while the capsule leans left.",
 "Trzyma klawisz, dopóki kapsel jest pochylony w prawo.":"Holds the key while the capsule leans right.",
 "Trzyma klawisz, dopóki kapsel jest pochylony do przodu.":"Holds the key while the capsule leans forward.",
 "Trzyma klawisz, dopóki kapsel jest pochylony do tyłu.":"Holds the key while the capsule leans back.",
 "Naciska klawisz przy szybkim obrocie.":"Presses the key on a quick turn.",
 "Jedno kliknięcie przycisku kapsla naciska klawisz raz.":"One click of the capsule button presses the key once.",
 "Nagraj własny gest":"Record your own gesture",
 "Siłę, czas i klawisz zmienisz potem.":"You can change strength, timing and key later.",
 "Zaawansowane":"Advanced",
 "Pasek pokazuje, jak mocno pochylasz. Przy kresce wciśnie się klawisz.":"The bar shows how far you lean. At the line the key goes down.",
 "Pasek rusza się w drugą stronę?":"Does the bar move the other way?",
 "U mnie to druga strona":"It is the other way for me",
 "Wpisz ręcznie (dla zaawansowanych)":"Type it in (advanced)",
 "Klawisz albo akcja wpisana ręcznie":"A key or action typed in by hand",
 "Inna reguła":"Another rule",
 "Powiąż z inną regułą":"Link with another rule",
 "Każde spełnienie warunku przełącza stan reguły: raz włączony, raz wyłączony. Inne reguły mogą się na nim opierać (warunek „Inna reguła”)":"Every time the condition is met the rule flips: on, then off. Other rules can build on that (an “Another rule” condition)",
 "Czym przesuwasz wybór":"What moves the choice",
 "Włącz albo wyłącz moduł Koło wyboru. Działa niezależnie od Mapowania, Myszy, MIDI i OSC.":"Turn the Selection wheel module on or off. It works independently of Mapping, Mouse, MIDI and OSC.",
 "Zapisz mapowanie":"Save mapping",
 // (koniec sekcji B1)
 // ===== UX 261120 B2: Mysz i Skaner =====
  "Wyśrodkuj kapsel":"Centre the capsule",
 "Ustaw kapsel tak, jak będzie noszony, i kliknij. To położenie stanie się środkiem ruchu.":"Hold the capsule the way it will be worn and click. That position becomes the centre of the movement.",
 "Jak kapsel prowadzi kursor":"How the capsule moves the cursor",
 "Ile trzeba wychylić do pełnej prędkości":"Tilt needed for full speed",
 "mały ruch":"small move",
 "duży ruch":"big move",
 "Odwróć lewo i prawo":"Flip left and right",
 "Odwróć górę i dół":"Flip up and down",
 "drżenie przy środku nie rusza kursora":"a tremor near the centre does not move the cursor",
 "Zatrzymaj kursor, a aplikacja kliknie.":"Hold the cursor still and the app clicks.",
 "drżenie w tym promieniu też liczy się jako bezruch":"a tremor within this radius still counts as standing still",
 "Przycisk kapsla klika":"The capsule button clicks",
 "Puknij: lewy. Dwa razy: dwuklik. Trzy razy: środkowy. Przytrzymaj: prawy.":"Tap: left. Twice: double-click. Three times: middle. Hold: right.",
 "tyle aplikacja czeka na kolejne puknięcie":"how long the app waits for another tap",
 "Dostrajanie ruchu":"Fine-tuning the movement",
 "W lewo: żywszy przy małym ruchu. W prawo: spokojniejszy przy małym ruchu.":"Left: livelier on small moves. Right: calmer on small moves.",
 "Auto-środkowanie przy bezruchu":"Auto-centre when still",
 "Włącz Mysz":"Turn the mouse on",
 "Gdzie działa":"Runs",
 "W podglądzie":"In the preview",
 "Jedno albo drugie: skaner pracuje w podglądzie tej karty (pulpit testowy albo wgrana plansza) albo w oknie nad prawdziwym pulpitem. „W podglądzie” zamyka okno nad pulpitem, także pracujący skaner.":"One or the other: the scanner works in this card's preview (the test desktop or an uploaded view) or in the window over the real desktop. “In the preview” closes the window over the desktop, even a running scanner.",
 "Wgraj planszę…":"Upload a view…",
 "Zmierz czas reakcji":"Measure reaction time",
 "Widok":"View",
 "Jeden sygnał zamiast myszy: pasek jedzie, Ty go zatrzymujesz.":"One signal instead of a mouse: the bar moves, you stop it.",
 // (koniec sekcji B2)
 // ===== UX 261120 B3: Kontroler, MIDI, OSC, Usługi =====
 // Kontroler: linia drążka bez pauz (rf-15 mUpdateAvail)
 "🎮 Wirtualny kontroler aktywny. Przyciski wychodzą, ale ruch kapsla nie prowadzi drążka (zaparkowany).":
   "🎮 Virtual controller active. The buttons go out, but the capsule's motion is not driving the stick (parked).",
 "🎮 Wirtualny kontroler aktywny, drążek steruje padem.":"🎮 Virtual controller active, the stick drives the pad.",
 // MIDI i OSC
 "dla nut":"for notes",
 "Jak połączyć z DAW albo wizualami? Wymagania zewnętrzne":"How to connect to a DAW or visuals? External requirements",
 "Gdy włączone, ruch kapsla wysyła komunikaty OSC po UDP do TouchOSC, Resolume, TouchDesigner, VRChat czy ESP32. Bez sterowników: wystarczy host i port.":
   "When on, the capsule's motion sends OSC messages over UDP to TouchOSC, Resolume, TouchDesigner, VRChat or ESP32. No drivers: a host and a port are enough.",
 "Jak działa OSC w RibbitFlipie: profile, zachowania, parkowanie":"How OSC works in RibbitFlip: profiles, behaviours, parking",
 "Brak mapowań OSC. Kliknij „Nowe mapowanie OSC”, a ruch kapsla poleci przez UDP do TouchOSC, Resolume, TouchDesigner albo ESP32.":
   "No OSC mappings. Click “New OSC mapping” and the capsule's motion will go over UDP to TouchOSC, Resolume, TouchDesigner or ESP32.",
 // Usługi
 "biblioteka akcji i wyzwalaczy, osobno dla każdej aplikacji":"action and trigger library, separately for each application",
 "tokeny, hasła i klucze API, szyfrowane na tym komputerze":"tokens, passwords and API keys, encrypted on this computer",
 "połączenie przez obs-websocket, jedno na całą aplikację":"an obs-websocket connection, one for the whole app",
 "i włącz serwer, potem połącz się tutaj. Hasło trzymaj w sejfie: do OBS-a jedzie wyłącznie podpis, nigdy samo hasło.":
   "and switch the server on, then connect here. Keep the password in the vault: only a signature goes to OBS, never the password itself.",
 "Włącznik całego modułu. Na Off nic stąd nie wychodzi: ani wyzwalacze, ani ręczne ▶ Wyślij. Wspólny dla wszystkich kapsli.":
   "The switch of the whole module. On Off nothing leaves from here: neither the triggers nor a manual ▶ Send. Shared by all capsules.",
 // poradnik Usług (rf-39b): nowa kolejność kart i nazwy przycisków
 "(tokeny i hasła) oraz":"(tokens and passwords) and",
 "Wybierz szablon":"Pick a template",
 "Dodaj własne API":"Add your own API",
 // (koniec sekcji B3)
 // ===== UX 261120 B4: Synth =====
 "Nowe brzmienie":"New sound","Zapisz brzmienie":"Save sound","Włącz i zagraj":"Switch on and play",
 "⤢ Pokaż ekran":"⤢ Show scope","⤡ Schowaj ekran":"⤡ Hide scope",
 "Najpierw nazwij brzmienie.":"Name the sound first.","Wylosowano brzmienie. Dostrój je i zapisz.":"Random sound. Fine-tune it and save it.",
 "🚦 Kiedy pad gra":"🚦 When the pad plays","Kapsel sterujący (jeden naraz)":"Controlling capsule (one at a time)",
 "Brak połączonych kapsli. Steruj palcem na padzie.":"No capsules connected. Control it with a finger on the pad.",
 "tylko palec":"finger only","Steruj efektem palcem na padzie.":"Control the effect with a finger on the pad.",
 "Przeciągnij palcem albo rusz kapslem. Lewo i prawo zmienia nutę, góra i dół barwę.":"Drag a finger or move the capsule. Left and right change the note, up and down the tone.",
 // (koniec sekcji B4)
 // ===== UX 261120 B5a: Zestawy i Ustawienia =====
 // Zestawy: Wymiana z innymi i Biblioteka (słownik syntezy: „Przeglądaj forum”, „Wczytaj plik lub odnośnik”)
 "Wymiana z innymi":"Share with others",
 "Przeglądaj forum ↗":"Browse the forum ↗",
 "Wczytaj plik lub odnośnik":"Load a file or link",
 "tylko zapisuje plik. Pliki leżą w folderze":"only writes the file. The files live in the",
 "obok programu.":"folder next to the program.",
 "Nie masz jeszcze zapisanego zestawu. Ustaw moduły pod jedną grę, a potem zapisz je pod własną nazwą w pasku pod listą.":"You have not saved a setup yet. Set up your modules for one game, then save them under a name of your own in the bar under the list.",
 "Nie masz zapisanych profili myszy. Zapiszesz je na ekranie Mysz, na pasku „Konfiguracja” pod nagłówkiem, przyciskiem „Zapisz jako…”.":"You have no saved mouse presets. You save them on the Mouse screen, on the “Configuration” bar under the header, with the “Save as…” button.",
 "Nie masz zapisanych zestawów mapowań. Zapiszesz je na ekranie MIDI albo OSC (to ten sam zestaw), na pasku „Konfiguracja” pod nagłówkiem, przyciskiem „Zapisz jako…”.":"You have no saved mapping presets. You save them on the MIDI or the OSC screen (it is the same set), on the “Configuration” bar under the header, with the “Save as…” button.",
 // Poradnik Zestawów (rf-39b): zawartość zestawu z RF_SETUP_SECTIONS, Skaner w zestawie
 "Ustawienia pod jedną grę albo program, w jednym pliku. Niesie sekcje:":"Settings for one game or program, in one file. It carries the sections:",
 "obok aplikacji. Osobno zapisujesz":"folder next to the app. Saved separately are the",
 "(ma własne presety) i":"(it has presets of its own) and the",
 "(własny plik, czyli":"(a file of their own, an",
 "). Tokeny i hasła nie wchodzą do żadnego z nich: leżą w osobnym, zaszyfrowanym sejfie i zostają u Ciebie.":"). Tokens and passwords go into none of them: they sit in a separate, encrypted vault and stay with you.",
 "Zanim cokolwiek zostanie podmienione, aplikacja pyta i wypisuje, czego nie masz zapisanego. Masz trzy wyjścia: „Zapisz i wczytaj” (odkłada w Bibliotece to, co masz teraz, pod nazwą, którą podasz), „Wczytaj bez zapisywania” albo „Anuluj”.":"Before anything is replaced the app asks, listing what you have not saved. Three ways out: “Save, then load” (it puts what you have now into the Library under a name you type), “Load without saving”, or “Cancel”.",
 "Ustaw moduły na ich ekranach (Mapowanie, Mysz, MIDI, Skaner, Synth) i sprawdź, że działają.":"Set the modules up on their own screens (Mapping, Mouse, MIDI, Scanner, Synth) and check that they work.",
 "Pasek pod listą w karcie":"The bar under the list in the",
 ": przy zapisie zestawu, przy presetach wyzwalaczy (Mapowanie), przy presetach osi (Czujnik) i w karcie aplikacji REST. Otwiera okno „Wymiana z innymi” z czterema wierszami: podziel się tym, przeglądaj forum, wczytaj plik lub odnośnik i jak to w ogóle działa.":"button stands next to every place that saves something: the setup save bar, the trigger presets (Mapping), the axis presets (Sensor) and the REST application card. It opens the “Share with others” window with four rows: share this one, browse the forum, load a file or link, and how any of this works.",
 "Wiem, co robię: ufam źródłu tego pliku":"I know what I am doing: I trust the source of this file",
 "⚠️ Rozumiem ryzyko, wczytaj wszystko":"⚠️ I accept the risk, load everything",
 // Ustawienia: karta Stop awaryjny (rf-39j), zdania bez pauz, dwie notki w jednej
 "Jeden skrót wyłącza wszystkie moduły naraz, także wtedy, gdy na wierzchu jest gra, a kursor ucieka. Trzymane klawisze zostają puszczone, pad wraca do środka, nuty gasną. Włączasz z powrotem sam, tymi samymi przełącznikami.":"One shortcut switches every module off at once, even with a game in front and the cursor running away. Held keys are released, the pad returns to centre, notes stop. You switch things back on yourself, with the same switches.",
 "Klawisz kończący kombinację jest przechwytywany, więc nie uruchomi polecenia w aktywnym oknie. Sprawdzenie mówi, czy naciśnięcie w ogóle dociera do aplikacji; inny program może je przechwytywać wcześniej.":"The key that completes the combination is swallowed, so it will not run a command in the focused window. The check says whether the keypress reaches the app at all; another program can be intercepting it first.",
 "Aplikację uruchomiono z --no-mcp, więc przełącznik jest zablokowany do końca sesji.":"The app was started with --no-mcp, so the switch is locked for this session.",
 "Włączony, nasłuchuje lokalnie":"On, listening locally",
 // (koniec sekcji B5a)
 // ===== UX 261120 B5b: Czujnik, Nakładka, Połączenie =====
 "Zakres czasu":"Time range",
 "Zeruj wykresy":"Zero the charts",
 "Zero: wł.":"Zero: on",
 "Wyczyść wykresy":"Clear the charts",
 "Standardowy (zalecany)":"Standard (recommended)",
 "Czujniki: 6 kanałów na żywo":"Sensors: 6 live channels",
 "Żyroskop: jak szybko kapsel się obraca":"Gyroscope: how fast the capsule rotates",
 "Akcelerometr: grawitacja i przyspieszenie":"Accelerometer: gravity and acceleration",
 "Filtr 3D: osie":"3D filter: axes",
 "Wynik filtra: ile procent wychylenia":"Filter output: percent of tilt",
 "Kula kręci się odwrotnie?":"Is the ball moving the wrong way?",
 "zrób trzy ruchy i patrz na kulę; gdzie idzie na odwrót, włącz przełącznik":"make three moves and watch the ball; where it goes the opposite way, switch it on",
 "Pochyl kapsel do przodu. Kula pochyla się do tyłu? Włącz.":"Tilt the capsule forward. Does the ball tilt back? Switch on.",
 "Pochyl kapsel w lewo. Kula pochyla się w prawo? Włącz.":"Tilt the capsule left. Does the ball tilt right? Switch on.",
 "Obróć kapsel w prawo. Kula obraca się w lewo? Włącz.":"Turn the capsule right. Does the ball turn left? Switch on.",
 "Cały obraz jest odbity jak w lustrze":"The whole picture is mirrored",
 "Kula jest dobra, ale mysz i klawisze idą w złą stronę":"The ball is right but the mouse and keys go the wrong way",
 "przód i tył":"front and back",
 "lewo i prawo":"left and right",
 "Odwraca ZNAK osi przechyłu na wyjściu: gałka, krzyżak, mysz (filtr 3D), wyzwalacze, MIDI/OSC, bramki padów i oscyloskop. Podgląd orientacji zostaje bez zmian, kula zawsze pokazuje realne położenie kapsla.":"Flips the SIGN of the lean axis on every output: stick, d-pad, mouse (3D filter), triggers, MIDI/OSC, pad gates and the oscilloscope. The orientation preview is left alone, the ball always shows where the capsule really is.",
 "Mapa kanałów":"Channel map",
 "Który kanał niesie którą oś czujnika.":"Which channel carries which sensor axis.",
 "stroi podgląd 3D (kulę): ruszaj kapslem, dobierz kanał i „odwróć” dla każdej osi, aż kula odda realne położenie. Twist to obrót wokół osi kapsla.":"tunes the 3D preview (the ball): move the capsule, choose a channel and “invert” for each axis until the ball matches the real pose. Twist is the rotation around the capsule axis.",
 "Szybkość reakcji filtra 3D. Steruje też WYJŚCIAMI: gałka, mysz (filtr 3D), krzyżak, MIDI/OSC i wyzwalacze":"3D filter responsiveness. It also drives the OUTPUTS: stick, mouse (3D filter), d-pad, MIDI/OSC and triggers",
 "Przyspieszenie wychylenia (czułość osi 3D)":"Deflection boost (3D axis sensitivity)",
 ") skaluje wartości osi filtra (Pochylenie / Obrót / Pitch / Roll) używane przez wyzwalacze, gałkę i oscyloskop „Filtr 3D: osie”:":") scales the filter-axis values (Tilt / Twist / Pitch / Roll) used by triggers, the stick and the “3D filter: axes” oscilloscope:",
 "= wolniej. Efekt widać na oscyloskopie „Filtr 3D: osie” w pasku u góry.":"= slower. The effect shows on the “3D filter: axes” oscilloscope in the bar at the top.",
 "Przywróć fabryczne osie":"Restore factory axes",
 "Kopiuj konfigurację":"Copy the setup",
 "⚠ Kanały osi powtarzają się, więc podgląd będzie szaleć. Kliknij „Przywróć fabryczne osie”.":"⚠ The axis channels repeat, so the preview will go wild. Click “Restore factory axes”.",
 "📡 Czujnik → 🧭 Osie 3D":"📡 Sensor → 🧭 3D axes",
 "kapsel zużywa prąd, gdy strumieniuje (ok. 50 Hz), więc usypiaj go, gdy z niego nie korzystasz":"the capsule draws power while streaming (about 50 Hz), so put it to sleep when you are not using it",
 "● Aktywny, przesyła dane":"● Active, sending data",
 "Uśpiony, nie wysyła danych":"Asleep, not sending data",
 ", które wyłącza strumień): wpisz hex i wyślij.":", which stops the stream): type hex and send.",
 "Podgląd w prawdziwym oknie":"Preview in a real window",
 "Dopóki jesteś na tym ekranie, ustawiane okno stoi otwarte. Zamknie się, gdy stąd wyjdziesz.":"While you are on this screen the window you are setting up stays open. It closes when you leave.",
 "Zostaw nad grą":"Keep over the game",
 "teraz tylko podgląd":"preview only",
 "Dołóż okno":"Add a window",
 "To okno jest otwarte tylko na czas ustawiania. Kliknij, żeby zostało nad grą także po wyjściu z tego ekranu.":"This window is open only while you set it up. Click to keep it over the game after you leave this screen too.",
 "To okno jest otwarte tylko na czas ustawiania. Kliknij „Zostaw nad grą”, żeby zostało.":"This window is open only while you set it up. Click “Keep over the game” to keep it.",
 "Okno stoi otwarte na ekranie, więc przezroczystość robi Windows i widać ją naprawdę. Miniatura obok tylko ją udaje.":"The window stands open on screen, so Windows does the transparency and you see the real thing. The thumbnail alongside only imitates it.",
 "Gra na pełnym ekranie zasłoni nakładkę. W ustawieniach gry wybierz „Okno bez ramki”.":"A fullscreen game hides the overlay. In the game’s settings choose “Borderless window”.",
 "pasek okna":"window bar",
 "uchwyt do przesuwania, pinezka i zamykanie":"drag handle, pin and close",
 "to samo, co „Dołóż okno” wyżej":"the same as “Add a window” above",
 // (koniec sekcji B5b)
 // ===== UX 261120 L1: mechanizm pięter =====
 "Wygląd panelu":"Panel appearance",
 "Rozwijaj wszystkie ustawienia":"Expand all settings",
 "Zwinięte bloki ustawień startują otwarte. Niczego nie dodaje ani nie wyłącza.":"Folded settings blocks start open. It adds nothing and turns nothing off.",
 // (koniec sekcji L1)
 // ===== UX 261120 L23: rama lżej =====
 // Dymek kropki w nawigacji przy problemie (rf-34 updateTabDots, `.warn`) i pierwsze pytanie (rf-48b).
 "Włączony, ale kapsel nie jest połączony":"On, but the capsule is not connected",
 "Do czego chcesz używać RibbitFlipa?":"What do you want to use RibbitFlip for?",
 // (koniec sekcji L23)
 // ===== UX 261120 L4a: Synth i Czujnik lżej =====
 "Wykresy kanałów i filtra 3D":"Channel and 3D filter charts",
 "Presety osi":"Axis presets",
 "Skala i nuty":"Scale and notes",
 "Oś Y i efekty":"Y axis and effects",
 "Kiedy gra i dotyk":"When it plays, and touch",
 "Wygląd pada":"Pad look",
 "Na padzie":"On the pad",
 "Kształt brzmienia":"Sound shape",
 // (koniec sekcji L4a)
 // ===== UX 261120 L4b: Nakładka, Kontroler, Połączenie lżej =====
 "Nazwa i dioda":"Name and LED","Zmień nazwę i kolor":"Change the name and colour","Dioda kapsla:":"Capsule LED:",
 "Szczegóły połączenia":"Connection details","Częstotliwość strumienia":"Stream rate","eksperymentalne":"experimental",
 "Czułość i martwa strefa":"Sensitivity and dead zone","Źródło i krzywa":"Source and curve","Źródło krzyżaka":"D-pad source",
 // (koniec sekcji L4b)
 // ===== UX 261120 L4c: Usługi, MIDI, OSC, Zestawy, Ustawienia lżej =====
 "Adres dopisuje się do prefiksu z bloku „Cel domyślny i odbiorniki”. Profil odbiornika ustawia typ argumentu i zakres. Samo OSC nie zna pojęcia PWM czy serwa, więc profil to nazwa dla pary (typ, zakres), a nie osobny rodzaj sygnału.":"The address is appended to the prefix from “Default target and receivers”. The receiver profile sets the argument type and the range. OSC itself knows nothing about PWM or servos, so a profile is a name for the pair (type, range), not a separate kind of signal.",
 "Pola w bloku „Cel domyślny i odbiorniki” opisują cel domyślny: adres, pod który mówi każde mapowanie, któremu nie wskazano nic innego. Jeżeli jeden zestaw steruje kilkoma maszynami, na przykład lampą na ESP32 i tabletem z TouchOSC albo dwoma sterownikami w różnych rogach warsztatu, dodaj je jako odbiorniki OSC na liście pod tymi polami. Każdy ma własną nazwę, host i port, a w edytorze mapowania pole „Odbiornik” mówi, do którego z nich to mapowanie leci. Nazwa pojawia się potem w wierszu mapowania i w dzienniku wysyłek, bo przy kilku odbiornikach sam adres przestaje cokolwiek identyfikować: „/fader1” na lampie i „/fader1” na tablecie to dwie różne rzeczy.":"The fields in “Default target and receivers” describe the default target: the address every mapping talks to when it has been pointed at nothing else. If one set drives several machines, for example a lamp on an ESP32 and a tablet running TouchOSC, or two controllers in opposite corners of the workshop, add them as OSC receivers in the list below those fields. Each has its own name, host and port, and the “Receiver” field in the mapping editor says which of them that mapping goes to. The name then shows up in the mapping's row and in the send journal, because with several receivers the address alone stops identifying anything: “/fader1” on the lamp and “/fader1” on the tablet are two different things.",
 "OSC to zwykłe UDP. W jednym pakiecie jedzie adres, tag typu argumentu i wartość, i tyle. Nic nie instalujesz: wystarczy host i port programu, który nasłuchuje, oraz prefiks adresu (wszystkie trzy pola są w bloku „Cel domyślny i odbiorniki” pod listą mapowań).":"OSC is plain UDP. One packet carries an address, an argument type tag and a value, and that is all. Nothing to install: you only need the host and port of the listening program, plus the address prefix (all three fields are in “Default target and receivers” below the mapping list).",
 "Najprostszy podgląd jest na miejscu: „Dziennik wysyłek OSC” w „Zaawansowane” na dole tego ekranu pokazuje wszystko na żywo. Każde przekroczenie progu, parkowanie i test dostaje własny wiersz, a sterowanie ciągłe streszcza się co dwie sekundy: ile komunikatów poszło, w jakim zakresie i jaka była ostatnia wartość. Widać tam też, gdy coś się NIE wysłało i dlaczego. Zaznacz „każdy pakiet”, jeśli chcesz zobaczyć każdą wiadomość z osobna.":"The easiest view is right here: the “OSC send journal” under “Advanced” at the bottom of this screen shows everything live. Every threshold crossing, park and test gets its own row, and a continuous stream is summarised every two seconds: how many messages went out, the span they covered and the last value. It also shows when something did NOT go out, and why. Tick “every packet” to see each message on its own.",
 "Komunikat trafia na port MIDI OUT wybrany w bloku „Port MIDI i skala”: do DAW, wizuali albo sprzętu.":"The message goes to the MIDI OUT port picked in “MIDI port and scale”: to a DAW, visuals or hardware.",
 "Port MIDI i skala":"MIDI port and scale",
 "Cel domyślny i odbiorniki":"Default target and receivers",
 "Dostrajanie":"Fine-tuning",
 "Udostępnianie":"Sharing",
 "Gra i opis":"Game and description",
 // (koniec sekcji L4c)
 // ===== UX 261120 L4d: Skaner i Mysz lżej =====
 "Plansza":"View",
 "Ustaw kapsel tak, jak będzie noszony, i kliknij. Kąty progów liczą się od tego położenia.":"Hold the capsule the way it will be worn and click. Threshold angles are measured from this position.",
 "Czułość i kierunek":"Sensitivity and direction",
 "Czas i rodzaj kliknięcia":"Click timing and type",
 "Klikaj przyciskiem kapsla":"Click with the capsule button",
 // (koniec sekcji L4d)
 // ===== UX 261120 L4e: Mapowanie i Koło lżej =====
 "Warunek i zachowanie":"Condition and behaviour",
 "Więcej warunków":"More conditions",
 "Więcej zachowań":"More behaviours",
 "Strojenie sterowania":"Control fine-tuning",
 // (koniec sekcji L4e)
 // ===== Notatka gracza w nakładce (2026-11-21) =====
 "notatka gracza":"player's note",
 "Twoja klawiszologia":"Your key guide",
 "Jedna linijka to jedna rzecz. To, co stoi przed dwukropkiem, okno pokaże w ramce klawisza.":"One line is one thing. Whatever comes before the colon, the window shows in a key frame.",
 // (koniec sekcji notatki gracza)
 // ===== UX 261120 SCALENIE: poradnik Mapowania po piętrach edytora, tytuły poradników =====
 "Nad polem „Nazwa” stoi lista":"Above the “Name” field there is a",
 ": warunkiem jest reguła z tej listy, spełniony wtedy, gdy tamta jest aktywna. Tak buduje się tryby: reguła z zachowaniem":": the condition is a rule from this list, met while that one is active. That is how you build modes: a rule with the",
 "— zatrzask: każde spełnienie warunku przerzuca regułę z „wyłączonej” na „włączoną” i z powrotem, a stan zostaje do następnego razu. Sam nic nie wysyła w kółko, tylko trzyma tryb, który inne reguły czytają warunkiem":"— a latch: every time the condition is met the rule flips from “off” to “on” and back, and the state stays that way until the next time. It sends nothing by itself, it only holds a mode that other rules read with the",
 "Główny warunek stoi w zwijaku „Warunek i zachowanie”, a kolejne warunki i przycisk „Dodaj warunek” w „Zaawansowane” › „Więcej warunków” na dole edytora.":"The main condition sits in the “Condition and behaviour” fold, and further conditions with the “Add condition” button in “Advanced” › “More conditions” at the bottom of the editor.",
 "Trzy podstawowe zachowania stoją w zwijaku „Warunek i zachowanie”. Rzadsze, czyli X razy w czasie, Dokładnie N puknięć, Po odczekaniu i Przełącznik, są w „Zaawansowane” › „Więcej zachowań”.":"The three basic behaviours sit in the “Condition and behaviour” fold. The rarer ones, X times within a time, Exactly N taps, After a wait and Toggle, are in “Advanced” › “More behaviours”.",
 "w edytorze reguły, w „Zaawansowane” › „Sygnały”, zaznaczasz „wysyłaj powiadomienie”, a pod spodem wybierasz, kiedy ma przyjść: „przy zadziałaniu” (jeden dymek na każde) albo „gdy staje się aktywny (i gdy przestaje)” (dymek na początku i na końcu epizodu).":"in the rule editor, in “Advanced” › “Signals”, you tick “send a notification”, and below it you pick when it should arrive: “when it goes off” (one balloon per fire) or “when it becomes active (and when it stops)” (one at the start of the episode and one at its end).",
 "Włącz albo wyłącz moduł MIDI. Działa niezależnie od OSC, Mapowania, Myszy i Kontrolera.":"Turn the MIDI module on or off. It works independently of OSC, Mapping, the Mouse and the Controller.",
 "Włącz albo wyłącz moduł OSC. Działa niezależnie od MIDI.":"Turn the OSC module on or off. It works independently of MIDI.",
 "Włącz albo wyłącz moduł Skaner. To ten włącznik decyduje, czy sygnał „scan:” z Mapowania w ogóle dochodzi.":"Turn the Scanner module on or off. This switch decides whether a “scan:” signal from Mapping gets through at all.",
 "Start programu":"Program start",
 "które moduły ładują się razem z programem":"which modules load together with the program",
 "potrzebuje:":"needs:",
 // (koniec sekcji SCALENIE)
};
// Język na starcie: wybór użytkownika > język, w którym pracuje komputer > angielski.
// Aplikacja mówi dwoma językami, więc pytanie brzmi wyłącznie „czy to ktoś po polsku?", a nie
// „jaki to język". Głosy są dwa, bo żaden z osobna nie wystarcza:
//   • RIBBITFLIP_SYS_LANG — język Windows, wstrzykiwany przez serwer (detect_system_lang).
//     Przeglądarka go nie zna: Chrome zainstalowany po angielsku na polskim Windowsie podaje en-US;
//   • navigator.languages — języki, na które ustawiła się sama przeglądarka. Łapie odwrotny
//     przypadek: polski użytkownik na angielskim Windowsie (służbowy laptop), który i tak czyta
//     strony po polsku.
// Wystarczy JEDEN głos na polski. Pomyłka w tę stronę kosztuje jedno kliknięcie przełącznika
// (zapamiętane na zawsze), pomyłka w drugą — pokazanie Polakowi angielskiego interfejsu.
function _rfDetectLang(){
  try{if(window.RIBBITFLIP_SYS_LANG==='pl')return 'pl';}catch(e){}
  try{
    const list=(navigator.languages&&navigator.languages.length)?navigator.languages:[navigator.language||''];
    // /^pl\b/ — trafia „pl" i „pl-PL", nie trafia żadnego innego kodu zaczynającego się od „pl".
    if(Array.prototype.some.call(list,function(l){return /^pl\b/i.test(String(l||'').replace('_','-'));}))return 'pl';
  }catch(e){}
  return 'en';
}
// Zapisany jest WYŁĄCZNIE język wybrany kliknięciem — wykryty nie trafia do localStorage, więc
// późniejsza zmiana języka Windows nadal przekłada się na aplikację (patrz setLang).
//
// KOLEJNOŚĆ GŁOSÓW: wybór w TEJ przeglądarce → język, w którym aplikacja pracowała ostatnio
// (RIBBITFLIP_LANG, wstrzykiwany przez serwer z Settings/ribbitflip_ui.json) → wykrycie.
// Środkowy głos doszedł 2026-09-03, bo localStorage należy do jednego profilu przeglądarki:
// drugie okno na drugim monitorze, telefon i świeża przeglądarka po restarcie wstawały po polsku
// komuś, kto dawno wybrał angielski — a odpowiedź leżała na dysku. Cena jest jedna i znana:
// serwer notuje TAKŻE język wykryty (panel melduje go przy każdym starcie, patrz `_reportLang`),
// więc późniejsza zmiana języka Windows nie przestawia panelu sama — kosztuje jedno kliknięcie
// przełącznika, po którym zostaje na zawsze.
let _lang=(()=>{try{const s=localStorage.getItem('ribbitflip.lang');
  if(s==='en'||s==='pl')return s;}catch(e){}
  try{const w=window.RIBBITFLIP_LANG; if(w==='en'||w==='pl')return w;}catch(e){}
  return _rfDetectLang();})();
const _i18nOrig=new WeakMap();   // node -> original PL text

// ——— Pattern fallbacks for COMPOSED strings ———
// Toasts and server messages built with interpolated values ("Zapisano zestaw „X””,
// the import-security analysis from ribbitflip_monitor.py) can never exact-match the
// dictionary. When the exact lookup misses, these ANCHORED patterns translate the known
// compositions. Keep the list short — it runs once per unmatched Polish text node.
const _i18nT=(s)=>I18N_EN[s]!=null?I18N_EN[s]:s;         // dict-or-identity for captured parts
function _i18nRuleWhat(w){                                // trigger-source names from _describe_rule()
  const mm=/^oś (\d+)$/.exec(w); if(mm)return "axis "+mm[1];
  return ({"pochylenie":"tilt","skręt":"twist","pitch (przód/tył)":"pitch (fwd/back)",
           "roll (na boki)":"roll (sideways)","przycisk kapsla":"capsule button",
           "inny wyzwalacz":"another trigger","ruch":"motion"})[w]||_i18nT(w);
}
function _i18nRuleStep(s){                                // macro steps from _step_pl()
  let mm;
  if((mm=/^pauza (\d+)ms$/.exec(s)))return "wait "+mm[1]+"ms";
  if((mm=/^trzymaj (.+)$/.exec(s)))return "hold "+mm[1];
  if((mm=/^puść (.+)$/.exec(s)))return "release "+mm[1];
  return s;                                               // "LED x" and bare keys pass through
}
const I18N_EN_PATTERNS=[
 [/^Błąd: (.+)$/,m=>"Error: "+_i18nTry(m[1])],
 // Próbki brzmień (/synth-probka): serwer wkleja w zdanie limit z `SAMPLE_MAX_BYTES` / `SAMPLE_MAX_COUNT`.
 [/^Próbka jest za duża \(mieści się (\d+) bajtów\)\.$/,m=>"The sample is too big ("+m[1]+" bytes fit)."],
 [/^Więcej próbek się nie zmieści \(limit (\d+)\)\.$/,m=>"No more samples fit (limit "+m[1]+")."],
 [/^Zapisano zestaw „(.+)”$/,m=>"Saved setup “"+m[1]+"”"],
 [/^Wczytano „(.+)” — odświeżam…$/,m=>"Loaded “"+m[1]+"” — refreshing…"],
 [/^Usunięto preset osi: (.+)$/,m=>"Deleted axis preset: "+m[1]],
 [/^Zapisano preset osi: (.+)$/,m=>"Saved axis preset: "+m[1]],
 [/^Wczytano osie 3D z: (.+)$/,m=>"Loaded 3D axes from: "+m[1]],
 [/^Slot „(.+)” zniknie, a jego kapsel będzie można sparować od nowa\.$/,m=>"Slot “"+m[1]+"” will disappear and its capsule can be paired again."],
 [/^Przywrócono domyślne brzmienie „(.+)”$/,m=>"Restored the default sound “"+m[1]+"”"],
 [/^Usunięto brzmienie „(.+)”$/,m=>"Deleted the sound “"+m[1]+"”"],
 [/^(\d+) (?:bezpieczna reguła|bezpieczne reguły|bezpiecznych reguł) · (\d+) (?:ryzykowna|ryzykowne|ryzykownych)$/,
   m=>m[1]+" safe rule"+(m[1]==="1"?"":"s")+" · "+m[2]+" risky"],
 [/^0\/(\d+) przekroczeń$/,m=>"0/"+m[1]+" crossings"],
 [/^spełnione · ([\d.,]+)s$/,m=>"met · "+m[1]+"s"],
 [/^czeka \(([\d.,]+)s nieprzerwanie\)$/,m=>"waiting ("+m[1]+"s uninterrupted)"],
 [/^↻ co (\d+) ms$/,m=>"↻ every "+m[1]+" ms"],
 [/^Wysłano do aktywnego okna: (.+)$/,m=>"Sent to the active window: "+_i18nTry(m[1])],
 // Point-on-screen panel (rf-12b): the strings with coordinates in them. Written in Polish and
 // matched here, NOT composed with _gl(), because the live readout is rewritten five times a
 // second and would otherwise keep the language it was in when picking started.
 [/^pulpit (\d+)×(\d+)$/,m=>"desktop "+m[1]+"×"+m[2]],
 [/^kursor: (-?\d+), (-?\d+) · biorę za (\d+) s$/,m=>"cursor: "+m[1]+", "+m[2]+" · taking it in "+m[3]+" s"],
 [/^Punkt: (.+)$/,m=>"Point: "+m[1]],
 [/^Akcja: (.+)$/,m=>"Action: "+_i18nTry(m[1])],
 [/^Dodano do makra: (.+)$/,m=>"Added to the macro: "+m[1]],
 [/^Podgląd \(nie wysłano\): (.+)$/,m=>"Preview (not sent): "+_i18nTry(m[1])],
 [/^([●–]) teraz: (.+)$/,m=>m[1]+" now: "+m[2]],
 [/^spełnione — aktywacja za ([\d.,]+) s$/,m=>"met — firing in "+m[1]+" s"],
 [/^czekam na nieprzerwane spełnienie \(([\d.,]+) s\)$/,m=>"waiting for an uninterrupted hold ("+m[1]+" s)"],
 [/^⚡ aktywowano \((\d+)×\)$/,m=>"⚡ fired ("+m[1]+"×)"],
 [/^(\d+)\/(\d+) w oknie · zostało ([\d.,]+) s$/,m=>m[1]+"/"+m[2]+" in window · "+m[3]+" s left"],
 [/^(\d+)\/(\d+) warunków$/,m=>m[1]+"/"+m[2]+" conditions"],
 [/^⚠ NA ŻYWO — OSC → (.+) wysyłane z ruchu urządzenia\.$/,m=>"⚠ LIVE — OSC → "+m[1]+" sent from device motion."],
 [/^Wczytano \(tryb (bezpieczny|zaawansowany)(?:, pominięto (\d+) ryzykownych)?\) — odświeżam…$/,
   m=>"Loaded ("+(m[1]==="bezpieczny"?"safe":"advanced")+" mode"+(m[2]?", skipped "+m[2]+" risky":"")+") — refreshing…"],
 [/^Wczytano zestaw na kilka kapsli \((bezpieczny|zaawansowany)(?:, pominięto (\d+))?\) — odświeżam…$/,
   m=>"Loaded the multi-capsule set ("+(m[1]==="bezpieczny"?"safe":"advanced")+(m[2]?", skipped "+m[2]:"")+") — refreshing…"],
 [/^Nie wczytano \((.+)\)$/,m=>"Not loaded ("+_i18nTry(m[1])+")"],
 [/^Import zestawu: (.+)$/,m=>"Import setup: "+m[1]],
 [/^Zestaw na kilka kapsli(: .+?)? \(kapsli: (\d+)\)$/,m=>"Multi-capsule set"+(m[1]||"")+" (capsules: "+m[2]+")"],
 [/^(\S+) naciśnij…$/,m=>m[1]+" press…"],
 // knob aria "label — wartość": composed from the on-screen label at knob init
 [/^(.+) — wartość$/,m=>_i18nTry(m[1])+" — value"],
 // sound-tile aria: verb from _gl + raw sound name appended (custom names pass through unchanged)
 [/^Edit (.+)$/,m=>"Edit "+_i18nT(m[1])],
 [/^Duplicate (.+)$/,m=>"Duplicate "+_i18nT(m[1])],
 [/^Edytuj (.+)$/,m=>"Edit "+_i18nT(m[1])],
 [/^Duplikuj (.+)$/,m=>"Duplicate "+_i18nT(m[1])],
 // #cmdResult (onCmd in rf-32): "<verdict>: <hex> — <server sentence>" — the hex stays, the sentence
 // after the first " — " is looked up (the simulation verdict and _led_event errors are Polish).
 [/^○ symulacja \(brak urządzenia\): (.*)$/,m=>"○ simulation (no device): "+_i18nCmdTail(m[1])],
 [/^✔ wysłano: (.*)$/,m=>"✔ sent: "+m[1]],
 [/^✕ błąd: (.*)$/,m=>"✕ error: "+_i18nCmdTail(m[1])],
 [/^✕ (.+)$/,m=>"✕ "+_i18nTry(m[1])],
 // server refusals with a number or an address interpolated (ribbitflip_monitor.py: PAD_MAX,
 // OscEmitter.TARGET_MAX, the REST header check and the obs-websocket handshake / frame reader)
 [/^Windows pokazuje grze najwyżej (\d+) kontrolery$/,m=>"Windows shows a game at most "+m[1]+" controllers"],
 [/^Więcej niż (\d+) urządzeń OSC nie da się dodać\. Usuń któreś, żeby zrobić miejsce\.$/,
   m=>"More than "+m[1]+" OSC devices cannot be added. Remove one to make room."],
 [/^Niedozwolony nagłówek: (.+)$/,m=>"Header not allowed: "+m[1]],
 [/^Serwer pod tym adresem nie mówi WebSocketem \((.+)\)$/,m=>"The server at this address does not speak WebSocket ("+m[1]+")"],
 [/^Ramka z OBS jest zbyt duża \((\d+) B\)$/,m=>"The frame from OBS is too large ("+m[1]+" B)"],
 [/^Nie udało się wysłać Identify: (.+)$/,m=>"Could not send Identify: "+m[1]],
 [/^nie udało się sprawdzić okna: (.+)$/,m=>"could not check the window: "+m[1]],
 [/^nie udało się otworzyć okna: (.+)$/,m=>"could not open the window: "+m[1]],
 [/^kapsel (\S+) nie ma nakładki$/,m=>"capsule "+m[1]+" has no overlay"],
 [/^kontroler (.+?) nie ma przycisku (.+?) \(ma go DualShock 4 i kontroler Wii\)$/,
   m=>"the "+m[1]+" controller has no "+m[2]+" button (the DualShock 4 and the Wii controller have it)"],
 [/^✔ zebrano (\d+)$/,m=>"✔ collected "+m[1]],
 // import-security analysis (analyze_config / _classify_spec in ribbitflip_monitor.py):
 // server refusal with the ceiling interpolated (_overlay_add in ribbitflip_monitor.py)
 [/^ten kapsel ma już maksymalną liczbę nakładek \((\d+)\)$/,
   m=>"this capsule already has the maximum number of overlays ("+m[1]+")"],
 [/^nieznana akcja myszy „(.+)”$/,m=>"unknown mouse action “"+m[1]+"”"],
 [/^kombinacja systemowa „(.+)”$/,m=>"system key combo “"+m[1]+"”"],
 [/^nietypowe modyfikatory: (.+)$/,m=>"unusual modifiers: "+m[1]],
 [/^nietypowy\/nieznany klawisz „(.+)”$/,m=>"unusual/unknown key “"+m[1]+"”"],
 // rule descriptions "source → action" from _describe_rule():
 [/^(.+?) → klawisz (.+)$/,m=>_i18nRuleWhat(m[1])+" → key "+m[2]],
 [/^(.+?) → makro: (.+)$/,m=>_i18nRuleWhat(m[1])+" → macro: "+m[2].split(" → ").map(_i18nRuleStep).join(" → ")],
 [/^(.+?) → \(brak akcji\)$/,m=>_i18nRuleWhat(m[1])+" → (no action)"],
];
// dict → pattern → identity, for captured tails and list parts (single level, no self-recursion)
function _i18nTry(p){
  const t=_i18nT(p);if(t!==p)return t;
  for(const [re,fn] of I18N_EN_PATTERNS){const mm=re.exec(p);if(mm){try{const v=fn(mm);if(v&&v!==p)return v;}catch(e){}}}
  return p;
}
// "<hex> — <sentence>" tail of a #cmdResult line: keep the hex, translate the sentence. A tail
// with no " — " (a sent command with nothing to say) passes through untouched.
function _i18nCmdTail(t){return t.replace(/^(.*?) — (.+)$/,(_,hex,err)=>hex+" — "+_i18nTry(err));}
function _i18nPattern(k){
  for(const [re,fn] of I18N_EN_PATTERNS){const mm=re.exec(k);if(mm){try{const v=fn(mm);if(v&&v!==k)return v;}catch(e){}}}
  // "· label" prefix (condition toast) and joined lists ("reason · reason"): translate parts, keep glue
  if(k.startsWith("· ")){const t=_i18nTry(k.slice(2));if(t!==k.slice(2))return "· "+t;}
  if(k.includes(" · ")){
    const parts=k.split(" · ").map(_i18nTry);
    const joined=parts.join(" · ");if(joined!==k)return joined;
  }
  return null;
}
// Canvas labels bypass the DOM walker — call this at every user-visible fillText/strokeText.
// Exact-match only; returns the input untouched in PL mode or when the dictionary misses.
function _cvT(s){return (_lang==='en'&&typeof s==='string')?(I18N_EN[s]!=null?I18N_EN[s]:s):s;}
function _i18nText(node){
  const p=node.parentNode;if(!p||p.nodeName==='SCRIPT'||p.nodeName==='STYLE'||p.nodeName==='TEXTAREA')return;
  if(p.closest&&p.closest('[data-noi18n],[translate="no"]'))return;   // user-authored text (e.g. custom sound names) — never translate
  const raw=_i18nOrig.has(node)?_i18nOrig.get(node):node.nodeValue;
  const k=raw.replace(/\s+/g,' ').trim();
  // data-i18n-en="…" on the PARENT wins over the dictionary: one Polish word with two meanings in
  // STATIC templates („Wielkość" = „Metric" of a MIDI metric, but „Size" of an overlay window),
  // where _gl() would freeze the language of a node built once and never repainted — the walker
  // still restores the Polish original on the way back, unlike a composed string.
  const ovr=(_lang==='en'&&p.getAttribute)?p.getAttribute('data-i18n-en'):null;
  const en=(_lang==='en')?(ovr!=null?ovr:(I18N_EN[k]!=null?I18N_EN[k]:_i18nPattern(k))):null;
  if(en!=null){if(!_i18nOrig.has(node))_i18nOrig.set(node,node.nodeValue);
    const lead=(raw.match(/^\s*/)||[''])[0],trail=(raw.match(/\s*$/)||[''])[0],nv=lead+en+trail;  // preserve whitespace, no literal-replace (also works with double spaces)
    if(node.nodeValue!==nv)node.nodeValue=nv;}
  else if(_lang==='pl'&&_i18nOrig.has(node)){node.nodeValue=_i18nOrig.get(node);}
}
function _i18nAttrs(el){
  if(!el.getAttribute)return;
  // 'data-rftip' must stay in this list: the tooltip module (rf-05-tooltip-state.js) moves
  // `title` -> `data-rftip` right after render, so by the time the walker runs there is no
  // `title` left to translate and every tooltip would stay Polish in EN mode.
  // 'label' is here for <optgroup label="…"> — a group heading is user-visible text like any other,
  // and it is the ONE piece of visible text that lives in an attribute no walker was looking at.
  // (No other element in this app carries a `label` attribute, so nothing else is touched.)
  for(const a of ['title','placeholder','aria-label','data-rftip','label']){
    if(!el.hasAttribute(a))continue;
    let store=el._i18nA||(el._i18nA={});
    const raw=(a in store)?store[a]:el.getAttribute(a);
    const k=raw.replace(/\s+/g,' ').trim();
    const en=(_lang==='en')?(I18N_EN[k]!=null?I18N_EN[k]:_i18nPattern(k)):null;
    if(en!=null){if(!(a in store))store[a]=el.getAttribute(a);
      const nv=(raw.match(/^\s*/)||[''])[0]+en+(raw.match(/\s*$/)||[''])[0];
      if(el.getAttribute(a)!==nv)el.setAttribute(a,nv);}   // value-changed guard: keeps the attribute observer loop-free
    else if(_lang==='pl'&&(a in store)){if(el.getAttribute(a)!==store[a])el.setAttribute(a,store[a]);}
  }
}
function applyLang(root){
  root=root||document.body;if(!root)return;
  if(root.nodeType===3){_i18nText(root);return;}
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),tn=[];let n;
  while((n=w.nextNode()))tn.push(n);
  for(const t of tn)_i18nText(t);
  if(root.nodeType===1)_i18nAttrs(root);
  if(root.querySelectorAll)for(const el of root.querySelectorAll('*'))_i18nAttrs(el);
}
// Tell the server which language we are in. It renders exactly one kind of user-facing text — the
// system notifications for Mapping rules — and those fire with the dashboard closed, so it cannot
// ask us later. Fire-and-forget: a failure here must never disturb the language switch itself.
function _reportLang(){try{fetch('/ui-lang',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({lang:_lang})}).catch(function(){});}catch(e){}}
// remember===false: język tylko ZASTOSUJ, nie zapisuj. Tak wchodzi wykryty angielski na starcie —
// gdyby lądował w localStorage, pierwsze uruchomienie zamieniłoby wykrycie w trwały wybór i późniejsza
// zmiana języka Windows nie miałaby już żadnego wpływu. Kliknięcie przełącznika zapisuje (domyślnie).
function setLang(l,remember){_lang=(l==='en')?'en':'pl';
  if(remember!==false){try{localStorage.setItem('ribbitflip.lang',_lang);}catch(e){}}
  _reportLang();
  document.documentElement.lang=_lang;applyLang(document.body);
  try{if(typeof renderGpHelp==="function")renderGpHelp();}catch(e){}
  try{if(typeof miRelang==="function")miRelang();}catch(e){}   // MIDI/OSC list + editor: _gl() at render time
  try{if(typeof poseRelang==="function")poseRelang();}catch(e){}   // axis panel: summaries and plot labels are composed with numbers
  try{if(typeof padRelang==="function")padRelang();}catch(e){}     // Synth pads: „Przester"/„Drive" is _gl() at paint time (rf-19 getter), no key for the walker
  try{if(typeof hkRelang==="function")hkRelang();}catch(e){}       // emergency-stop card: pill + verdict come from server codes
  try{if(typeof rfLibRelang==="function")rfLibRelang();}catch(e){} // library: rows, kind hint and the save bar are _gl() at render time
  try{if(typeof rfKasetyRelang==="function")rfKasetyRelang();}catch(e){} // kasety zestawów: nazwy kaset w dymkach i etykietach siatek są składane _gl() z numerem
  try{if(typeof rfpcRelang==="function")rfpcRelang();}catch(e){}   // kolumna presetów: okruszki, znaczniki, zdanie o zapisie i „Co ustawia" składane są _gl() w chwili rysowania
  try{if(typeof rfRestTabsRelang==="function")rfRestTabsRelang();}catch(e){} // pasek „Reszty": napis pierwszej zakładki jest KOPIĄ etykiety z nawigacji, więc nie ma własnego węzła do przetłumaczenia — trzeba go przepisać po walkerze
  try{if(typeof restObsRelang==="function")restObsRelang();}catch(e){} // OBS card: pill, note, buttons and the credential picker are _gl() at paint time
  try{if(typeof restRelang==="function")restRelang();}catch(e){}       // vault card: the state pill („🔒 zablokowany"), its buttons and the empty states are _gl() at paint time
  try{if(typeof rfGsRelang==="function")rfGsRelang();}catch(e){}   // auto sets by game: the pill and the remembered list are _gl() at render time
  try{if(typeof dgRelang==="function")dgRelang();}catch(e){}       // „Zgłoś problem": pill, file list, forum button and the untouched post template are _gl() at paint time
  try{if(typeof padCtlRender==="function")padCtlRender();}catch(e){} // capsule→controller hub: names, badges and options are _gl() at build time
  try{if(typeof scanSekcjeRelang==="function")scanSekcjeRelang();}catch(e){} // pasek skanerów: napisy biorą EN przy budowie paska, więc wraca się do polskiego przez przebudowę
  try{if(typeof dmRelang==="function")dmRelang();}catch(e){}       // „Moduły" matrix: headers, tooltips and cell labels are _gl() at paint time
  try{if(typeof oscTargetsRender==="function")oscTargetsRender();}catch(e){} // OSC devices: rows, the ceiling sentence and the add button are _gl() at paint time
  // „Widoczność": the row is _gl() at paint time AND its tab names are read off the buttons that
  // applyLang() has just rewritten — so it has to run AFTER the walker, not instead of it.
  try{if(typeof tvRelang==="function")tvRelang();}catch(e){}
  try{if(typeof whRelang==="function")whRelang();}catch(e){}       // koło wyboru: the mode note, the state badge and the note under „Gdzie pokazywać koło" are _gl() at paint time
  try{if(typeof ovmRelang==="function")ovmRelang();}catch(e){}     // „Nakładki nad grą": the gallery tiles, the state words and the editor's notes are _cvT()/_gl() at paint time
  // Mysz + Kontroler: the status lines, the speed/pointing note, the unit under "Maks. krok" and
  // the sentence under the monitor map are all composed with _gl() when the card is filled, so
  // without a refill they keep the language they were written in. mFill() also calls mAreaSync(),
  // which rebuilds the monitor <select> — its labels say "primary" in one language only.
  try{if(typeof mFill==="function")mFill();}catch(e){}
  try{if(typeof whatIsRelang==="function")whatIsRelang();}catch(e){} // setup-vs-preset graph: labels are _gl() at build time
  try{if(typeof rfTourRelang==="function")rfTourRelang();}catch(e){} // przewodnik po panelu (rf-39p): krok, licznik i przyciski są _gl() w chwili rysowania
  // Skaner, sekcja „Czym sterujesz skanerem": CAŁA jej treść powstaje przez `_scanT` w chwili
  // rysowania — świadomie, żeby nie mieć ani jednego klucza w słowniku (a więc i żadnego klucza
  // martwego po zmianie polskiego napisu). Ceną jest ta linijka: bez niej sekcja zostaje
  // w języku, w którym ją narysowano, aż do następnego wejścia w zakładkę.
  try{if(typeof scanSignalsSync==="function")scanSignalsSync();}catch(e){}
  // The trigger list, for the same reason: its rows are composed when painted (the action name and
  // the behaviour word), so without a repaint they keep the language they were painted in until
  // something else happens to a rule. Most visible on a click-at-a-point rule, whose whole name is
  // composed — "🖱 Click left at (854,534)" sitting in an otherwise Polish panel.
  try{if(typeof renderRules==="function")renderRules();}catch(e){}
  try{window._equalizeLeftTabs&&window._equalizeLeftTabs();}catch(e){}
  const b=document.getElementById('langToggle');if(b)b.textContent=_lang==='en'?'PL':'EN';}
function initI18n(){
  const b=document.getElementById('langToggle');
  if(b)b.addEventListener('click',()=>setLang(_lang==='en'?'pl':'en'));
  // MutationObserver: translate dynamically rendered content (innerHTML / new nodes / text
  // changes) AND translated attributes written after render (e.g. a title set by a flash
  // helper) — without the attribute branch such tooltips stayed Polish until the next toggle.
  try{const mo=new MutationObserver(muts=>{if(_lang!=='en')return;
    for(const m of muts){
      if(m.type==='attributes'){
        const el=m.target,a=m.attributeName;
        // An app write (flash helper etc.) replaces the value AFTER we cached the original —
        // drop the stale cache so the NEW text becomes the original; keep it when the change
        // is our own translation write or a restore.
        if(el&&el._i18nA&&a&&(a in el._i18nA)&&el.getAttribute){
          const cur=el.getAttribute(a),raw=el._i18nA[a]||'';
          const k=raw.replace(/\s+/g,' ').trim();
          const en=I18N_EN[k]!=null?I18N_EN[k]:_i18nPattern(k);
          const expect=en!=null?(raw.match(/^\s*/)||[''])[0]+en+(raw.match(/\s*$/)||[''])[0]:raw;
          if(cur!==expect&&cur!==raw)delete el._i18nA[a];
        }
        _i18nAttrs(m.target);continue;}
      for(const node of m.addedNodes){
        if(node.nodeType===3)_i18nText(node);else if(node.nodeType===1)applyLang(node);}}});
    mo.observe(document.body,{childList:true,subtree:true,
      attributes:true,attributeFilter:['title','placeholder','aria-label','data-rftip','label']});}catch(e){}
  // `false` = nie zapisuj: na starcie tylko odtwarzamy stan (wybrany albo wykryty), a nie
  // podejmujemy za użytkownika decyzji, której nigdy nie kliknął.
  if(_lang==='en')setLang('en',false);
  else _reportLang();   // Polish never goes through setLang() on boot, so report it explicitly
}
