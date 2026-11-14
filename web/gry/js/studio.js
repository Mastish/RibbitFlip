// RibbitBeat: Studio dźwięków. Po odblokowaniu wszystkiego gracz tworzy własne dźwięki tak jak w RibbitFlipie; studio
// dodaje się automatycznie po wylosowaniu wszystkich dźwięków. Edytor ma własny ekran i wygląda oraz działa jak w RibbitFlipie
// (pełna edycja złożonych dźwięków, ekrany z shaderami), z dopracowaną kompozycją UI i podglądem/odsłuchem.
// Własne instrumenty gracza: ten sam głos co instrumenty gry (glos.js, rozszerzony o klucze z Syntha), układ i zakres edycji
// z „Biblioteki dźwięków” RibbitFlipa (rf-25, rf-25d): PRZYKLEJONY pasek brzmienia (nazwa, rodzaj, niezapisane, komunikat,
// głośność, akcje, Ctrl+S), PRZYKLEJONA lewa kolumna na wysokość ekranu (okrągła lampa oscyloskopu na shaderze ze
// studio-ekrany.js, legenda, wskaźnik poziomu, pulpit: trzy okrągłe klawisze podglądu z diodą (Testuj / Przytrzymaj / Ciągły),
// klawiatura A–K z czarnymi nad szczelinami, lista własnych przewijana w środku; rozmiar tarczy liczy dopasuj()), z prawej rack
// kart modułów w dwóch kolumnach na szerokim ekranie: 01 Oscylatory (fala własna: rysowanie / harmoniczne, chipy sub / szum /
// 2. oscylator), 02 Filtr (4 typy, obwiednia filtra, rozświetlenie, korektor Barwa ≤4 pasm), 03 Obwiednia (ADSR + szarpnięcie
// + glide, punkty i zgięcia na ekranie), 04 Charakter (wibrato, rechot, przester, wah) ze sceną: żaba gry otwiera buzię
// z poziomem dźwięku i pokazuje graną nutę, 05 Pętla testowa (port pętli rf-25: siatka 8 nut × 16 kroków, rysowanie
// i przeciąganie długich nut, wzory, tempo, swing, głowica, klawisze „przytrzymaj = posłuchaj”) i odsłuch W PIOSENCE
// (melodia wybranej piosenki tym instrumentem jak żaba w grze, z podkładem instrumentem podkładu, do 20 s).
// Dostępne, gdy aktywny profil trafił sekretną kartę instrumentów na kole (Postepy.studioOdblokowane; do 10-17: komplet instrumentów; ukryty kod też). Wchodzi się z menu
// głównego przyciskiem „Studio dźwięków” (pokazuje się sam), ekran #studioEkran jest jednym z ekranów lobby (pokazLobby).
// Własne instrumenty (do 12) dopisują się na koniec listy instrumentów gracza i grają w piosence jak każdy inny (recepta → Glos).
// Zapis: localStorage["ribbitbeat.studio"] (wersja 2; wpisy wersji 1 z „alikwotami” przechodzą na własną falę przy wczytaniu).
// Podgląd (klawisze, pętla, piosenka) gra przez Glos.podglad() (własna szyna z analizatorem dla lampy, paneli i żaby), nie przez szynę żab.
// Przycisk świeci holo w menu; UI z większą liczbą ikon, intuicyjne także dla dzieci, ładniejszy scroll i własna grafika
// instrumentu:
// nazwa „Studio instrumentów”, przycisk w menu z klasą `holo` (styl w gry-studio.css, animacja tylko w menu), kroki 1–2–3
// (Na start: presety-startery `STARTERY` → Zagraj: pulpit i klawiatura → Zapisz), kafle z rysunkiem fali / krzywej filtra /
// mini-siatką wzoru (`kafle()`, `falaSvg`, `filtrSvg`, `wzorSvg`) zamiast list, filcowe ikony panelu (`ikona()`) przy modułach,
// transporcie i akcjach, dymki z dziecięcym opisem przy każdym pokrętle (`PODP`), własna grafika instrumentu (`P.obraz`,
// dataURL WebP/PNG 256 × 256 ≤ 120 kB, `wczytajObraz`; plik z dysku albo przeciągnij-upuść na pasek).
// 10-18 (zarządzanie): nagłówek listy „Twoje instrumenty” otwiera okno gry (#okno, pkOkno z pakiety.js) z wszystkimi własnymi
// instrumentami: duży obrazek, nazwa, Posłuchaj, Edytuj, Zmień nazwę, Kopia, Usuń (z pytaniem, jak usuwanie paczki), Zapisz do
// pliku i Wczytaj z pliku (dopisuje, `importuj`). Usuwanie z listy w Studiu też pyta. Gracze z usuniętym instrumentem wracają do
// domyślnego (`zapomnijWyborGraczy`: wpis w S.ust.instrumentyGraczy znika, zapis ustawień od razu).
// Samplowanie audio, nagranie albo dogranie: karta „02 Próbka” —
// instrument może zamiast fal grać WŁASNĄ PRÓBKĘ, nagraną z mikrofonu albo wczytaną z pliku (też upuszczonego na pasek).
// Dźwięk próbki (nagrywanie, dekodowanie, przycięcie ciszy, wykrycie stroju, bajty w IndexedDB) robi js/studio-probki.js;
// tutaj jest sam edytor: przebieg na kanwie z zacieniowaną pętlą, odsłuch, trzy pokrętła (Nuta próbki, Pętla od / do)
// i przełącznik pętli. Gra to ten sam tor, co instrument Krzyk (`probki` w recepturze glos.js), a strój i pętlę niesie
// receptura (`probkaRoot`, `probkaPetla`), więc kopia instrumentu dzieli bajty z pierwowzorem i ma własne ustawienia.
// Ładowany PO zabi-chor.js, PO pakiety.js, PO studio-ekrany.js i PO studio-probki.js. API: Studio.dostepne(), Studio.otworz(), Studio.odswiez(), Studio.lista(),
// Studio.recepta(p), Studio.DOMYSLNE, Studio.instrumenty, Studio.zamknij(), Studio.petla, Studio.piosenka (testy),
// Studio.grafika(id) → dataURL własnej grafiki instrumentu albo null (id = „w-xxxxxx”, ten sam co w T.instrumentyGracza i Glos),
// Studio.zarzadzaj(o?) (okno „Twoje instrumenty”), Studio.oknoOtwarte, Studio.eksport() → tekst pliku, Studio.importuj(tekst) → raport.
const Studio=(function(){
  "use strict";
  const L=(pl,en)=>typeof RBJezyk!=="undefined"&&RBJezyk.wybierz?RBJezyk.wybierz(pl,en):pl;
  const KLUCZ="ribbitbeat.studio",MAKS=12,WERSJA=2;
  const OBRAZ_BOK=256,OBRAZ_MAKS=120000;   // własna grafika instrumentu: bok po zmniejszeniu, najdłuższy dataURL
  const TX={
    tytul:L("Studio instrumentów","Instrument studio"),podtytul:L("Zbuduj własny instrument. Zagra w piosenkach tak jak każdy inny.","Build your own instrument. It plays in songs like any other."),
    menu:L("Studio instrumentów","Instrument studio"),
    menuZakryte:L("Graj więcej, aby odblokować","Play more to unlock"),   // 10-21: przycisk zakryty, zanim Studio się odblokuje
    nazwa:L("Nazwa","Name"),nazwaPh:L("np. Moja Żaba","e.g. My Frog"),
    fala:L("Fala","Wave"),pila:L("Piła","Saw"),kwadrat:L("Kwadrat","Square"),trojkat:L("Trójkąt","Triangle"),sinus:L("Sinus","Sine"),impuls:L("Impuls","Pulse"),wlasna:L("Własna","Custom"),
    puls:L("Szerokość impulsu","Pulse width"),okt:L("Oktawa","Octave"),glosy:L("Głosy","Voices"),rozstroj:L("Rozstrój","Detune"),
    sub:L("Sub-oktawa","Sub-octave"),osc2:L("2. oscylator","2nd oscillator"),fala2:L("Osc 2: fala","Osc 2: wave"),polton2:L("Osc 2: półtony","Osc 2: semitones"),
    rozstroj2:L("Osc 2: rozstrój","Osc 2: detune"),miks2:L("Osc 2: miks","Osc 2: mix"),
    szum:L("Szum (efekt)","Noise (effect)"),szumQ:L("Wąskość szumu","Noise tightness"),
    filtr:L("Typ filtra","Filter type"),dolny:L("Dolnoprzepustowy","Low-pass"),pasmowy:L("Pasmowy","Band-pass"),gorny:L("Górnoprzepustowy","High-pass"),wycin:L("Wycinający","Notch"),
    fMin:L("Ciemny","Dark"),fMax:L("Jasny","Bright"),q:L("Rezonans","Resonance"),obwF:L("Obwiednia filtra","Filter envelope"),obwFCzas:L("Czas obwiedni","Envelope time"),puch:L("Rozświetlenie","Swell"),
    atak:L("Atak","Attack"),zanik:L("Zanik","Decay"),podtrzym:L("Podtrzymanie","Sustain"),puszcz:L("Zwolnienie","Release"),szarp:L("Szarpnięcie","Pluck"),glide:L("Glide","Glide"),
    wib:L("Wibrato","Vibrato"),rechot:L("Rechot","Croak"),przester:L("Przester","Drive"),wah:L("Wah-wah","Wah-wah"),wahTempo:L("Tempo wah","Wah rate"),
    glosnosc:L("Głośność","Volume"),
    mOsc:L("Oscylatory","Oscillators"),mFiltr:L("Filtr","Filter"),mEnv:L("Obwiednia głośności","Volume envelope"),mChar:L("Charakter","Character"),
    losujModul:L("Losuj ten moduł","Randomise this module"),
    losuj:L("Zaskocz mnie","Surprise me"),zapisz:L("Zapisz nowy instrument","Save new instrument"),zapiszZmiany:L("Zapisz zmiany","Save changes"),
    anuluj:L("✕ Anuluj edycję","✕ Cancel edit"),nowy:L("Nowy","New"),
    testuj:L("Testuj","Test"),przytrzymaj:L("Przytrzymaj","Hold"),ciagly:L("Ciągły","Continuous"),
    przebieg:L("przebieg","waveform"),widmo:L("widmo","spectrum"),poziom:L("poziom","level"),
    klawiatura:L("Klawiatura: klikaj albo graj na A W S E D F T G Y H U J K","Keyboard: click or play A W S E D F T G Y H U J K"),
    // 10-21: pole do śpiewania myszą — ten sam ruch, co w grze
    spiew:L("Zaśpiewaj","Sing it"),
    spiewOpis:L("Przytrzymaj i prowadź mysz w górę i w dół — tak samo jak w grze. Szybki ruch w lewo i w prawo to wibrato.",
      "Hold and move the mouse up and down, just like in the game. A quick left-right shake is vibrato."),
    spiewPodp:L("przytrzymaj i prowadź","hold and move"),
    spiewWibrato:L("wibrato","vibrato"),
    spiewStroj:L("strój próbki","sample note"),
    moje:L("Twoje instrumenty","Your instruments"),szukaj:L("szukaj…","search…"),pusto:L("Jeszcze nic tu nie ma. Zrób pierwszy!","Nothing here yet. Make your first!"),
    rodzajNowe:L("nowe","new"),rodzajWlasne:L("własne","own"),rodzajZmienione:L("zmienione","changed"),niezapisane:L("niezapisane zmiany","unsaved changes"),
    zapisano:L("Zapisano „{n}”.","Saved “{n}”."),limit:L("Limit {n} własnych instrumentów. Usuń któryś, żeby dodać nowy.","Limit of {n} own instruments. Delete one to add another."),
    bezNazwy:L("Wpisz nazwę instrumentu.","Enter a name for the instrument."),usunieto:L("Usunięto „{n}”.","Deleted “{n}”."),
    wylosowano:L("Wylosowano brzmienie: dostrój i zapisz.","Rolled a sound: tune it and save."),
    posluchaj:L("Posłuchaj","Listen"),edytuj:L("Edytuj","Edit"),duplikuj:L("Duplikuj","Duplicate"),usun:L("Usuń","Delete"),
    kopia:L("{n} (kopia)","{n} (copy)"),szumInfo:L("Szum zastępuje oscylatory: gra przez filtr na wysokości nuty.","Noise replaces the oscillators: it plays through the filter at the note's pitch."),
    skrot:L("Ctrl+S zapisuje","Ctrl+S saves"),
    testujOpis:L("Krótka fraza","Short phrase"),przytrzymajOpis:L("Trzymaj nutę","Hold a note"),ciaglyOpis:L("Gra ciągle","Plays on"),
    petla:L("petla","loop"),
    mTest:L("Pętla testowa","Test loop"),
    zapetl:L("Zapętl","Loop"),zatrzymaj:L("Zatrzymaj","Stop"),wyczysc:L("Wyczyść","Clear"),wzor:L("Wzór","Pattern"),wzorWlasny:L("własny","custom"),
    tempo:L("Tempo","Tempo"),swing:L("Swing","Swing"),
    seqHint:L("klik = osobna nuta · przeciągnij = jedna długa · klik w nutę = usuń · klawisz z lewej = posłuchaj","click = separate note · drag = one long note · click a note = delete · key on the left = listen"),
    seqNutaAria:L("{n}, krok {k}","{n}, step {k}"),seqKlawiszAria:L("Przytrzymaj, żeby usłyszeć {n}","Hold to hear {n}"),
    wzMelodia:L("Melodia","Melody"),wzArpeggio:L("Arpeggio","Arpeggio"),wzSkoczna:L("Skoczna","Bouncy"),wzDlugie:L("Długie nuty","Long notes"),wzAkordy:L("Akordy","Chords"),
    wPiosence:L("W piosence","In a song"),posluchajPiosenki:L("Posłuchaj","Listen"),zPodkladem:L("z podkładem","with backing"),
    brakPiosenek:L("brak piosenek do odsłuchu","no songs to listen to"),
    scenaEt:L("Tak śpiewa żaba","This is how the frog sings"),
    piosenkaOpis:L("Melodia wybranej piosenki zagrana tym instrumentem, jak w grze (do 20 sekund).","The chosen song's melody played with this instrument, as in the game (up to 20 seconds)."),
    // 10-17 wieczór: kroki, startery, kafle, dymki, własna grafika
    krok1:L("Wybierz brzmienie","Pick a sound"),krok1Opis:L("Kliknij gotowca, a potem zmieniaj go kafelkami i gałkami niżej.","Click a starter, then change it with the tiles and knobs below."),
    krok2:L("Zagraj","Play"),krok3:L("Zapisz","Save"),
    starterOk:L("Gotowiec „{n}”: posłuchaj, pozmieniaj i zapisz jako swój.","Starter “{n}”: listen, change it and save it as yours."),
    stBas:L("Żabi bas","Frog bass"),stBasO:L("gruby i niski","fat and low"),
    stFlet:L("Leśny flet","Forest flute"),stFletO:L("miękki, z drżeniem","soft, with a wobble"),
    stRobot:L("Robot","Robot"),stRobotO:L("metalowy głos","metal voice"),
    stDzwon:L("Dzwoneczek","Little bell"),stDzwonO:L("dzyń i cichnie","ding, then fades"),
    stBrzek:L("Brzęczyk","Buzzer"),stBrzekO:L("jak stara konsola","like an old console"),
    stKosmos:L("Kosmos","Space"),stKosmosO:L("ślizga się jak UFO","slides like a UFO"),
    stSuper:L("Superpiła","Supersaw"),stSuperO:L("szeroka jak na koncercie","wide like at a concert"),
    stWiatr:L("Szept wiatru","Wind whisper"),stWiatrO:L("szum zamiast nut","noise instead of notes"),
    pilaO:L("ostra jak brzęczyk","sharp like a buzzer"),kwadratO:L("jak gra z automatu","like an arcade game"),trojkatO:L("miękki jak flet","soft like a flute"),
    sinusO:L("gładki jak gwizd","smooth like a whistle"),impulsO:L("cienki i nosowy","thin and nasal"),wlasnaO:L("narysuj ją sam","draw it yourself"),
    dolnyK:L("Miękki","Soft"),dolnyO:L("ścisza wysokie piski","quiets the squeaks"),gornyK:L("Cienki","Thin"),gornyO:L("zabiera basy","takes the bass away"),
    pasmowyK:L("Telefon","Phone"),pasmowyO:L("zostaje sam środek","only the middle stays"),wycinK:L("Z dziurką","With a hole"),wycinO:L("wycina wąski kawałek","cuts out a thin slice"),
    subO:L("Dodaje bas o oktawę niżej.","Adds bass an octave lower."),szumO:L("Szum zamiast fali: wiatr, werbel, szept.","Noise instead of a wave: wind, snare, whisper."),
    osc2O:L("Druga fala gra razem z pierwszą.","A second wave plays along with the first."),
    oktO:L("O całą oktawę wyżej albo niżej.","A whole octave higher or lower."),
    grafika:L("Twoja grafika","Your picture"),grafikaUsun:L("Usuń grafikę","Remove picture"),
    grafikaOpis:L("Wybierz obrazek z dysku albo upuść go tutaj. Pokaże się na kafelku instrumentu.","Pick a picture from your disk or drop it here. It shows on the instrument tile."),
    grafikaOk:L("Grafika gotowa. Zapisz instrument, żeby została.","Picture ready. Save the instrument to keep it."),
    grafikaZla:L("To nie jest obrazek. Wybierz plik PNG, JPG, WebP albo GIF.","That is not a picture. Pick a PNG, JPG, WebP or GIF file."),
    grafikaDuza:L("Ten obrazek jest za duży nawet po zmniejszeniu. Spróbuj innego.","This picture is too big even after shrinking. Try another one."),
    grafikaUsunieta:L("Grafika usunięta. Zapisz, żeby zmiana została.","Picture removed. Save to keep the change."),
    brakMiejsca:L("Brak miejsca na zapis. Usuń grafikę albo któryś instrument.","No room to save. Remove a picture or an instrument."),
    wzorWlasnyO:L("Twój wzór: klikaj w siatkę.","Your pattern: click the grid."),
    pustoOpis:L("Wybierz gotowca z kroku 1, pozmieniaj i kliknij Zapisz.","Pick a starter in step 1, change it and click Save."),
    // 10-18: okno „Twoje instrumenty” (wszystkie w jednym miejscu), pytanie przed usunięciem, zmiana nazwy, plik
    zarzadzaj:L("Wszystkie Twoje instrumenty: posłuchaj, edytuj, zmień nazwę, zrób kopię, usuń, zapisz do pliku","All your instruments: listen, edit, rename, copy, delete, save to a file"),
    oknoWstep:L("Masz {n} z {m} instrumentów. Posłuchaj, edytuj w Studiu, zmień nazwę, zrób kopię albo usuń. Plik przeniesie je na inny komputer.",
      "You have {n} of {m} instruments. Listen, edit in the studio, rename, copy or delete. A file takes them to another computer."),
    oknoPusto:L("Nie masz jeszcze własnych instrumentów. Zrób pierwszy w Studiu albo wczytaj je z pliku.","You don't have your own instruments yet. Make the first one in the studio or load them from a file."),
    zmienNazwe:L("Zmień nazwę","Rename"),nowaNazwa:L("Nowa nazwa (najwyżej 24 znaki)","New name (up to 24 characters)"),zmienionoNazwe:L("Nowa nazwa: „{n}”.","New name: “{n}”."),
    kopiaZrobiona:L("Zrobiono kopię „{n}”.","Made a copy: “{n}”."),
    usunTytul:L("Usuń instrument","Delete instrument"),anulujOkno:L("Anuluj","Cancel"),
    usunPytanie:L("Usunąć „{n}”? Tego nie da się cofnąć. Kto na nim gra, wróci do swojego instrumentu domyślnego.",
      "Delete “{n}”? This can't be undone. Anyone playing it goes back to their default instrument."),
    eksport:L("Zapisz do pliku","Save to file"),eksportOpis:L("Zapisuje wszystkie Twoje instrumenty (z grafikami) do pliku JSON.","Saves all your instruments (with pictures) to a JSON file."),
    eksportOk:L("Zapisano plik {plik}.","Saved the file {plik}."),eksportBlad:L("Nie udało się zapisać pliku.","Couldn't save the file."),
    import:L("Wczytaj z pliku","Load from file"),importOpis:L("Dodaje instrumenty z pliku zapisanego w Studiu. Twoje instrumenty zostają.","Adds instruments from a file saved in the studio. Your instruments stay."),
    importOk:L("Wczytano z pliku: {n}.","Loaded from the file: {n}."),importBylo:L("Już tu były: {n}.","Already here: {n}."),
    importLimit:L("Nie zmieściło się (limit {m}): {n}.","Didn't fit (limit {m}): {n}."),
    importNic:L("W pliku nie ma nic nowego: te instrumenty już tu są.","Nothing new in the file: these instruments are already here."),
    importZly:L("To nie jest plik z instrumentami ze Studia.","That's not a file with studio instruments."),importDuzy:L("Ten plik jest za duży.","This file is too big."),
    importBladOdczytu:L("Nie udało się odczytać pliku.","Couldn't read the file."),
    // 10-19 wieczór: karta „Próbka” (nagranie z mikrofonu albo plik z dysku)
    mProbka:L("Próbka","Sample"),
    probkaOpis:L("Nagraj coś mikrofonem albo wczytaj dźwięk z dysku. Instrument zagra tym po całej klawiaturze.",
      "Record something with the microphone or load a sound from your disk. The instrument plays it across the keyboard."),
    nagraj:L("Nagraj","Record"),nagrajOpis:L("Mikrofon włącza się dopiero teraz i gaśnie po nagraniu.","The microphone turns on only now and goes off after recording."),
    nagrywanie:L("Nagrywam…","Recording…"),przerwij:L("Zatrzymaj","Stop"),
    wczytajProbke:L("Wczytaj dźwięk","Load a sound"),wczytajProbkeOpis:L("Wybierz plik z dysku albo upuść go na okno.","Pick a file from your disk or drop it on the window."),
    odsluchaj:L("Odsłuchaj","Listen"),przytnijCisze:L("Przytnij ciszę","Trim silence"),usunProbke:L("Usuń próbkę","Remove sample"),
    probkaNuta:L("Nuta próbki","Sample note"),probkaOd:L("Pętla od","Loop from"),probkaDo:L("Pętla do","Loop to"),
    probkaPetla:L("Zapętl","Loop"),wykryjNute:L("Wykryj","Detect"),
    // 10-20: więcej kontroli — wycinek, poziom, centy, wstecz, zlepek, wejście mikrofonowe
    probkaCent:L("Dostrój","Fine tune"),probkaStart:L("Wycinek od","Piece from"),probkaKoniecE:L("Wycinek do","Piece to"),
    probkaPoziom:L("Poziom","Level"),probkaWstecz:L("Gra wstecz","Plays backwards"),probkaStaly:L("Nie przestrajaj","Don't re-tune"),
    probkaZlep:L("Zlepek","Seam"),
    podsluch:L("Podsłuch","Monitor"),podsluchOpis:L("Otwórz mikrofon i pokaż poziom, jeszcze nic nie nagrywając.","Open the microphone and show the level without recording anything yet."),
    podsluchGra:L("Podsłuch","Monitoring"),
    podsluchStart:L("Podsłuch włączony. Powiedz coś i sprawdź, czy wskaźnik dochodzi do dwóch trzecich.",
      "Monitoring is on. Say something and check the meter reaches about two thirds."),
    mikrofon:L("Mikrofon","Microphone"),mikrofonOpis:L("Z którego mikrofonu nagrywać.","Which microphone to record from."),
    mikrofonDomyslny:L("Mikrofon domyślny","Default microphone"),mikrofonNr:L("Mikrofon ","Microphone "),
    odliczaj:L("Odliczaj 3-2-1","Count 3-2-1 in"),odliczajOpis:L("Trzy sekundy na wzięcie oddechu, zanim ruszy nagranie.","Three seconds to take a breath before the recording starts."),
    odliczanie:L("Nagrywam za… ","Recording in… "),teraz:L("Teraz!","Now!"),
    wyrownaj:L("Wyrównaj poziom","Even out the level"),
    wyrownajOpis:L("Nowe nagranie dostaje poziom 100 %. Bez tego zostaje tak ciche albo tak głośne, jak wyszło.",
      "A new recording gets level 100%. Without this it stays as quiet or as loud as it came out."),
    przytnijStale:L("Przytnij na stałe","Trim for good"),
    przytnijStaleOpis:L("Zostaw w pliku sam wycinek. Tego się nie cofnie, ale plik jest mniejszy.","Leave only the chosen piece in the file. There is no undo for this, but the file gets smaller."),
    zapiszWav:L("Zapisz WAV","Save WAV"),zapiszWavOpis:L("Zapisz to, co słychać, jako plik WAV.","Save what you hear as a WAV file."),
    probkaPusto:L("Nie ma jeszcze próbki. Nagraj albo wczytaj dźwięk.","No sample yet. Record or load a sound."),
    probkaStan:L("{zrodlo} · {dl} · {nuta}","{zrodlo} · {dl} · {nuta}"),
    probkaZcalosci:L("{wyc} z {cal}","{wyc} of {cal}"),
    probkaNuteSlychac:L("nuta {nuta}","note {nuta}"),probkaBezStroju:L("bez przestrajania","no re-tuning"),
    probkaWsteczKrotko:L("wstecz","reversed"),
    zrodloMik:L("nagranie","recording"),zrodloPlik:L("plik","file"),
    probkaGotowa:L("Próbka gotowa. Przeciągnij znaczniki na przebiegu, żeby wybrać kawałek.","Sample ready. Drag the markers on the waveform to pick the piece you want."),
    probkaPrzycieta:L("Znaczniki stoją na granicach ciszy. Bajty zostały całe.","The markers sit at the edges of the silence. The bytes stay whole."),
    probkaPrzycietaStale:L("Przycięte na stałe: {sek}.","Trimmed for good: {sek}."),
    probkaCalosc:L("Wycinek to całe nagranie — nie ma czego przycinać.","The piece is the whole recording — there is nothing to trim."),
    probkaZapisana:L("Próbka zapisana jako plik WAV.","The sample has been saved as a WAV file."),
    probkaUsunieta:L("Próbka usunięta. Instrument wraca do fal.","Sample removed. The instrument goes back to waves."),
    probkaFiltrOtwarty:L("Próbka gotowa. Filtr otwarty na pełno, żeby brzmiała jak nagranie.","Sample ready. The filter is wide open so it sounds like the recording."),
    nutaWykryta:L("Wykryta nuta: {n}.","Detected note: {n}."),nutaNieznana:L("Nie słyszę tu wysokości. Ustaw nutę pokrętłem.","I can't hear a pitch here. Set the note with the knob."),
    probkaInfo:L("Próbka zastępuje oscylatory: nuta rozciąga ją w górę i w dół, a filtr i obwiednia działają jak zwykle. Znaczniki na przebiegu przeciąga się myszą.",
      "The sample replaces the oscillators: the note stretches it up and down, and the filter and envelope work as usual. The markers on the waveform are dragged with the mouse."),
    probkaCzeka:L("Wczytuję próbkę…","Loading the sample…"),
    bProbkaZgoda:L("Nie ma zgody na mikrofon. Pozwól na niego w przeglądarce i kliknij „Nagraj” jeszcze raz.",
      "No microphone permission. Allow it in the browser and click “Record” again."),
    bProbkaBrak:L("Nie widzę tego mikrofonu. Wybierz inny z listy albo podłącz go i spróbuj znowu.",
      "I can't see that microphone. Pick another one from the list, or plug it in and try again."),
    bProbkaZajetymik:L("Mikrofon jest zajęty przez inny program. Zamknij go i spróbuj znowu.","Another program is using the microphone. Close it and try again."),
    bProbkaZajete:L("Chwila — mikrofon jest już otwarty.","One moment — the microphone is already open."),
    bProbkaNieobslugiwane:L("Ta przeglądarka nie umie nagrywać. Wczytaj dźwięk z pliku.","This browser can't record. Load a sound from a file instead."),
    bProbkaKrotkie:L("Za krótkie nagranie. Potrzymaj przycisk chwilę dłużej.","The recording is too short. Hold the button a moment longer."),
    bProbkaCisza:L("W tym nagraniu jest sama cisza.","There is nothing but silence in this recording."),
    bProbkaFormat:L("Nie umiem odczytać tego dźwięku. Spróbuj plikiem WAV, MP3, OGG albo M4A.","I can't read this sound. Try a WAV, MP3, OGG or M4A file."),
    bProbkaDuzy:L("Ten plik jest za duży.","This file is too big."),
    bProbkaBlad:L("Nie udało się przygotować próbki.","Couldn't prepare the sample.")};
  // dymki: dziecięcy opis każdego pokrętła (title na polu)
  const PODP={puls:L("Cieńszy impuls brzmi bardziej nosowo.","A thinner pulse sounds more nasal."),glosy:L("Ile żab gra naraz tę samą nutę.","How many frogs play the same note at once."),
    rozstroj:L("Lekko rozstrojone głosy brzmią szerzej.","Slightly detuned voices sound wider."),szumQ:L("Wąski szum gwiżdże, szeroki szumi jak wiatr.","Narrow noise whistles, wide noise hisses like wind."),
    polton2:L("O ile wyżej albo niżej gra druga fala.","How much higher or lower the second wave plays."),rozstroj2:L("Lekkie rozstrojenie drugiej fali buja dźwiękiem.","A little detune on the second wave makes it sway."),
    miks2:L("Jak głośno słychać drugą falę.","How loud the second wave is."),
    fMin:L("Jak ciemno brzmi koniec nuty.","How dark the end of the note sounds."),fMax:L("Jak jasno brzmi początek nuty.","How bright the start of the note sounds."),
    q:L("Podbija dźwięk na granicy filtra, robi się piskliwie.","Boosts the edge of the filter, it gets squeaky."),obwF:L("Filtr otwiera się albo zamyka na starcie nuty.","The filter opens or closes as the note starts."),
    obwFCzas:L("Jak długo filtr się otwiera.","How long the filter takes to open."),puch:L("Dźwięk jaśnieje, gdy trzymasz nutę.","The sound gets brighter while you hold the note."),
    atak:L("Jak szybko nuta się zaczyna.","How fast the note starts."),zanik:L("Jak szybko cichnie zaraz po starcie.","How fast it fades right after the start."),
    podtrzym:L("Jak głośno gra, gdy trzymasz klawisz.","How loud it plays while you hold the key."),puszcz:L("Jak długo wybrzmiewa po puszczeniu.","How long it rings after you let go."),
    glide:L("Ślizg z nuty na nutę, jak na puzonie.","Slide from note to note, like a trombone."),szarp:L("Mocne uderzenie na starcie, jak struna.","A strong hit at the start, like a string."),
    wib:L("Drżenie nuty, jak u śpiewaka.","The note wobbles like a singer's."),rechot:L("Szybkie pulsowanie, jak żabie kum-kum.","Fast pulsing, like a frog's ribbit."),
    przester:L("Brudne, chrupiące brzmienie jak w rocku.","Dirty, crunchy sound like in rock."),wah:L("Kaczy efekt łaa-łaa.","The duck-like wah-wah effect."),
    wahTempo:L("Jak szybko kwacze wah-wah.","How fast the wah-wah quacks."),glosnosc:L("Głośność instrumentu w piosence.","How loud the instrument is in a song."),
    probkaRoot:L("Którą nutę słychać w próbce. Od niej liczy się cała klawiatura.","Which note the sample sings. The whole keyboard is counted from it."),
    probkaCent:L("Dostrojenie o ćwierć kroku pokrętła nuty, żeby pasowała do innych instrumentów.","Fine tuning in quarter-steps of the note knob, so it fits the other instruments."),
    probkaStart:L("Od tego miejsca nagrania próbka zaczyna grać.","The sample starts playing from this point of the recording."),
    probkaKoniec:L("Tu próbka się kończy. Resztę nagrania słychać nie będzie.","This is where the sample ends. The rest of the recording will not be heard."),
    probkaPoziom:L("Jak głośno gra nagranie. 100 % to tyle, ile w nim zapisano.","How loud the recording plays. 100% is as much as was saved in it."),
    probkaZlep:L("Zlewa koniec pętli z jej początkiem, żeby szew nie trzaskał.","Blends the end of the loop into its start so the seam doesn't click."),
    probkaOd:L("Od tego miejsca próbka zaczyna się powtarzać.","The sample starts repeating from here."),
    probkaDo:L("Tu kółko wraca na początek pętli.","Here the loop jumps back to its start."),
    probkaStaly:L("Klaśnięcie, bęben albo słowo gra tak samo na całej klawiaturze.","A clap, a drum or a word plays the same across the whole keyboard."),
    probkaWstecz:L("Próbka gra od końca do początku.","The sample plays from its end to its start.")};
  const tt2=(s,o)=>String(s).replace(/\{(\w+)\}/g,(m,k)=>o&&k in o?o[k]:m);
  const DOMYSLNE={nazwa:"",fala:"sawtooth",wt:null,puls:25,okt:0,glosy:1,rozstroj:8,sub:false,osc2:false,fala2:"sawtooth",polton2:0,rozstroj2:0,miks2:50,
    szum:false,szumQ:6,filtr:"lowpass",fMin:400,fMax:4000,q:1.5,obwF:0,obwFCzas:200,puch:0,eq:[],
    atak:30,zanik:300,podtrzym:100,puszcz:150,glide:15,szarp:0,envC:[0,0,0],
    wib:0,rechot:0,przester:0,wah:0,wahTempo:4,glosnosc:100,obraz:null,
    // 10-19 wieczór: własna próbka. `probka` to TOŻSAMOŚĆ bajtów ({id, sr, dl, zrodlo}) — same bajty leżą w IndexedDB
    // (studio-probki.js), bo zapis Studia idzie do localStorage. Nastawy to osobne pola, bo mają pokrętła
    // i są per instrument: kopia instrumentu dzieli `probka.id`, a te liczby ma własne.
    // Większa kontrola użytkownika nad próbką: doszły wycinek (`probkaStart`, `probkaKoniec`
    // w procentach nagrania), dostrojenie w centach, poziom, gra wstecz, zlepek szwu pętli i „nie przestrajaj”.
    // Wszystkie DOMYŚLNE wartości to „nic nie rób”, więc instrument zapisany wczoraj brzmi dziś identycznie.
    probka:null,probkaRoot:60,probkaCent:0,probkaStaly:false,probkaStart:0,probkaKoniec:100,
    probkaPoziom:100,probkaWstecz:false,probkaPetla:false,probkaOd:10,probkaDo:60,probkaZlep:20};
  // [min, max, krok, jednostka, skórka pokrętła]
  const ZAKRESY={puls:[5,50,1,"%","osc"],glosy:[1,7,1,"","osc"],rozstroj:[0,40,1,"ct","osc"],szumQ:[.5,25,.5,"","osc"],
    polton2:[-24,24,1,"","osc"],rozstroj2:[-60,60,1,"ct","osc"],miks2:[0,100,1,"%","osc"],
    fMin:[100,3000,50,"Hz","filter"],fMax:[500,10000,100,"Hz","filter"],q:[.3,12,.1,"","filter"],obwF:[-100,100,1,"%","filter"],obwFCzas:[5,2000,5,"ms","filter"],puch:[0,200,5,"","filter"],
    atak:[2,500,1,"ms","env"],zanik:[10,2000,10,"ms","env"],podtrzym:[0,100,1,"%","env"],puszcz:[30,1500,10,"ms","env"],szarp:[0,100,5,"%","env"],glide:[0,200,5,"ms","env"],
    wib:[0,30,1,"ct","char"],rechot:[0,60,1,"Hz","char"],przester:[0,20,1,"","char"],wah:[0,100,5,"%","char"],wahTempo:[1,12,.5,"Hz","char"],
    // Znaczniki chodzą po 0,1 % nagrania (na 12 sekundach to 12 ms), bo pętlę trzeba czasem dosunąć — a kto
    // chce dokładniej, przeciąga je wprost po przebiegu.
    probkaRoot:[24,96,.5,"","osc"],probkaCent:[-50,50,1,"ct","osc"],probkaStart:[0,100,.1,"%","osc"],
    probkaKoniec:[0,100,.1,"%","osc"],probkaPoziom:[10,200,1,"%","osc"],
    probkaOd:[0,100,.1,"%","osc"],probkaDo:[0,100,.1,"%","osc"],probkaZlep:[0,200,1,"ms","osc"],
    glosnosc:[30,300,5,"%","master"]};
  const KNOB={master:"knob-6",osc:"knob-8",filter:"knob-11",env:"knob-2",char:"knob-4"};
  const MODULY={osc:["puls","glosy","rozstroj","szumQ","polton2","rozstroj2","miks2"],filter:["fMin","fMax","q","obwF","obwFCzas","puch"],
    env:["atak","zanik","podtrzym","puszcz","glide","szarp"],char:["wib","rechot","przester","wah","wahTempo"]};
  const FALE=["sawtooth","square","triangle","sine"];
  let dane={wersja:WERSJA,instrumenty:[]},P=swiezy(),edytowany=null,zapisanyJson="",zbudowany=false,ciagly=false,glosCiagly=null,debounce=0,szukane="";
  let pod=null,probkaGlos=null,probkaDo=0,raf=0,podgladNieaktualny=true;
  const E=typeof StudioEkrany!=="undefined"?StudioEkrany:null;
  const NAZWY_NUT=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const nazwaNuty=m=>NAZWY_NUT[((m%12)+12)%12]+(Math.floor(m/12)-1);
  function swiezy(p){const q=Object.assign({},DOMYSLNE,p||{});q.eq=Array.isArray(q.eq)?q.eq.map(b=>Object.assign({},b)):[];
    q.envC=Array.isArray(q.envC)&&q.envC.length===3?q.envC.slice():[0,0,0];q.wt=Array.isArray(q.wt)&&q.wt.length===64?q.wt.slice():null;
    q.obraz=obrazOk(q.obraz)?q.obraz:null;
    q.probka=probkaOk(q.probka)?{id:q.probka.id,sr:+q.probka.sr,dl:+q.probka.dl,zrodlo:q.probka.zrodlo==="mikrofon"?"mikrofon":"plik"}:null;
    return q;}
  // własna grafika: dataURL obrazu (WebP/PNG/JPEG), najwyżej OBRAZ_MAKS znaków
  function obrazOk(v){return typeof v==="string"&&v.length<=OBRAZ_MAKS&&/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v);}
  // własna próbka: tożsamość bajtów. Kopiowana polem po polu, bo `probka` z zapisu, z pliku i z kopii instrumentu
  // to zawsze cudzy obiekt — wspólna referencja znaczyłaby, że zmiana w jednym instrumencie rusza drugi.
  function probkaOk(v){return !!v&&typeof v==="object"&&!Array.isArray(v)&&typeof v.id==="string"&&/^s-[a-z0-9]{1,16}$/.test(v.id)
    &&Number.isFinite(+v.sr)&&+v.sr>0&&Number.isFinite(+v.dl)&&+v.dl>0;}
  const maProbke=q=>!!(q&&q.probka&&q.probka.id);
  const probkaSek=q=>maProbke(q)?q.probka.dl/q.probka.sr:0;
  // Nastawy próbki → sekundy dla ProbkiAudio.wytnij. JEDNO miejsce, w którym procenty pokręteł zamieniają się
  // w czas, więc receptura, przebieg, odsłuch i zapis do pliku liczą wycinek dokładnie tak samo.
  // `koniec:0` znaczy „do końca nagrania” (nie „zero sekund”): po to, żeby domyślne nastawy były dosłownie
  // zerami i zestaw w silniku nazywał się tak samo, jak przed dodaniem wycinka.
  function edycjaProbki(q){
    const sek=probkaSek(q);
    const a=Math.max(0,Math.min(99.5,+q.probkaStart||0)),b=Math.max(a+.5,Math.min(100,q.probkaKoniec==null?100:+q.probkaKoniec));
    const e={od:a>0?+(a/100*sek).toFixed(4):0,koniec:b<100?+(b/100*sek).toFixed(4):0,
      poziom:Math.max(.1,Math.min(2,Math.round((q.probkaPoziom==null?100:+q.probkaPoziom))/100)),
      wstecz:q.probkaWstecz===true,zlep:0,petla:null};
    if(q.probkaPetla&&sek>0){
      const od=Math.max(0,Math.min(99.5,+q.probkaOd||0)),do_=Math.max(od+.5,Math.min(100,+q.probkaDo||0));
      e.petla=[+(od/100*sek).toFixed(4),+(do_/100*sek).toFixed(4)];
      e.zlep=+Math.max(0,Math.min(.2,(+q.probkaZlep||0)/1000)).toFixed(4);
    }
    return e;
  }
  // wycinek w sekundach (do przebiegu, odsłuchu i wykrywania stroju): „do końca” rozwinięte na konkretną liczbę
  function wycinekProbki(q){
    const sek=probkaSek(q),e=edycjaProbki(q);
    return {a:e.od,b:e.koniec>e.od?e.koniec:sek,sek};
  }
  const el2=(t,k,x)=>{const e=document.createElement(t);if(k)e.className=k;if(x!=null)e.textContent=x;return e;};
  const aktywny=()=>{try{const n=typeof ZC!=="undefined"&&ZC.konto&&ZC.konto.aktywny?ZC.konto.aktywny():null;return n||Postepy.GOSC;}catch(e){return null;}};
  function dostepne(){try{return !!(typeof Postepy!=="undefined"&&(Postepy.studioOdblokowane?Postepy.studioOdblokowane(aktywny()):Postepy.instrumentyWszystkie(aktywny())));}catch(e){return false;}}   // 10-17: sekretna karta koła

  // ---- parametry formularza -> receptura głosu (glos.js). Każdy klucz poza podstawą tylko wtedy, gdy coś wnosi. ----
  function recepta(p){
    const q=swiezy(p),fin=v=>typeof v==="number"&&Number.isFinite(v);
    const r={fala:(q.fala==="pulse"||q.fala==="custom")?"sine":(FALE.includes(q.fala)?q.fala:"sawtooth"),okt:Math.max(-3,Math.min(3,+q.okt|0)),filtr:q.filtr,
      fMin:Math.min(+q.fMin,+q.fMax-100),fMax:+q.fMax,q:+q.q,atak:q.atak/1000,puszcz:q.puszcz/1000,poziom:.4,glide:Math.max(.005,q.glide/1000)};
    if(q.fala==="pulse")r.pulse=Math.max(.05,Math.min(.5,q.puls/100));
    else if(q.fala==="custom"&&q.wt)r.wt=q.wt.map(v=>Math.round(Math.max(-1,Math.min(1,+v||0))*1000)/1000);
    // Własna próbka (10-19 wieczór): `probki` wskazuje zestaw bajtów w silniku (studio-probki.js go tam wkłada), a strój
    // i pętla idą obok, bo ten sam zestaw obsługuje kilka instrumentów. Bez pętli próbka gra RAZ i cichnie (jedno słowo,
    // klaśnięcie); z pętlą trwa, dopóki trzymasz nutę. Oscylatory są wtedy nieużywane (glos.js: źródłem są próbki),
    // ale pola fali zostają w zapisie — po usunięciu próbki instrument wraca do swojego brzmienia bez zmian.
    // 10-20: PĘTLI TU NIE MA, i to jest celowe. Zlepek szwu zmienia same próbki wokół miejsca, w którym pętla
    // zawraca, więc musi być policzony razem z wycinkiem — a wtedy miejsce pętli jest już własnością bajtów,
    // które poszły do silnika (`zarejestrujEdycje` wkłada je tam razem z `petla`). Receptura niesie tylko to,
    // co nie dotyka bajtów: strój (z dostrojeniem wtopionym w półtony) albo „nie przestrajaj”.
    if(maProbke(q)){
      r.probki=StudioProbki.zarejestrujEdycje(q.probka.id,edycjaProbki(q));
      if(q.probkaStaly===true)r.probkaStaly=true;
      else r.probkaRoot=Math.max(12,Math.min(108,(+q.probkaRoot||60)+(+q.probkaCent||0)/100));
    }
    if(q.szum)r.szum={q:+q.szumQ,mnoz:2};
    else{
      if(q.glosy>1){const n=q.glosy|0,d=+q.rozstroj;r.unison=Array.from({length:n},(_,i)=>Math.round(-d+2*d*i/(n-1)));}
      if(q.sub)r.sub=true;
      if(q.osc2)r.osc2={fala:FALE.includes(q.fala2)?q.fala2:"sawtooth",polton:Math.round(+q.polton2||0),rozstroj:Math.round(+q.rozstroj2||0),miks:Math.max(0,Math.min(1,q.miks2/100))};
    }
    if(q.obwF){r.fEnv=Math.max(-1,Math.min(1,q.obwF/100));r.fEnvT=Math.max(.005,q.obwFCzas/1000);}
    if(q.puch>0)r.puch=q.puch/100;
    const eq=q.eq.filter(b=>b&&fin(b.f)&&fin(b.g)&&fin(b.q)&&b.g!==0).slice(0,4).map(b=>({f:Math.round(Math.max(20,Math.min(20000,b.f))),g:Math.round(Math.max(-24,Math.min(24,b.g))*10)/10,q:Math.round(Math.max(.1,Math.min(24,b.q))*100)/100}));
    if(eq.length)r.eq=eq;
    if(q.podtrzym<100){r.podtrzym=q.podtrzym/100;r.zanik=q.zanik/1000;}
    if(q.szarp>0)r.szarp=[1+q.szarp/40,.3];
    const c=q.envC.map(v=>Math.round(Math.max(-1,Math.min(1,+v||0))*100)/100||0);if(c.some(v=>v!==0))r.envC=c;
    if(q.wib>0)r.wib=+q.wib;
    if(q.rechot>0)r.am=+q.rechot;
    if(q.przester>0)r.znieksz=+q.przester;
    if(q.wah>0)r.wah={rate:+q.wahTempo,gl:Math.min(q.fMin*.9+q.wah*8,q.wah*14)};
    // wyrównanie głośności: szum i wąskie pasmo są dużo cichsze niż fala z filtrem dolnoprzepustowym
    let g=q.szum?(q.szumQ>8?14:5):q.filtr==="bandpass"?4:q.filtr==="highpass"?3:q.filtr==="notch"?1.3:1;
    // próbka ma wyrównany szczyt (0,9), więc nie potrzebuje podbicia fali — tylko tyle, ile zabiera filtr. Liczba 1,25
    // przy poziomie .4 daje ten sam poziom, co Krzyk (poziom .5 × 1,03) zmierzony na Odzie.
    if(maProbke(q))g=1.25*(q.filtr==="bandpass"?2.4:q.filtr==="highpass"?1.8:q.filtr==="notch"?1.15:1);
    if(q.przester>0)g*=.9/Math.max(1,q.przester/9);
    if(q.glosy>1&&!q.szum&&!maProbke(q))g*=.9;
    if(q.sub&&!q.szum&&!maProbke(q))g*=.85;
    r.glosnosc=g*(q.glosnosc/100);
    return r;
  }
  const losBez=(a,b)=>a+Math.random()*(b-a);
  const losZ=a=>a[Math.floor(Math.random()*a.length)];
  const losKnob=k=>{const z=ZAKRESY[k];return Math.round(losBez(z[0],z[1])/z[2])*z[2];};
  // losowa własna fala (jak _rndWave w rf-25): połowa = szereg harmoniczny a_k = r_k / k^p, połowa = kilka niskich harmonicznych z fazami
  function losFala(){
    if(!E)return null;
    if(Math.random()<.5){const n=Math.round(losBez(6,16)),pw=losBez(.6,1.6),odd=Math.random()<.3,a=[];
      for(let k=1;k<=n;k++)a.push(odd&&k%2===0?0:(k===1?1:losBez(.25,1))/Math.pow(k,pw));
      return Array.from(E.M.fromHarmonics(a),v=>Math.round(v*1000)/1000||0);}
    const ks=[1],m=Math.round(losBez(3,5));while(ks.length<m){const k=2+Math.floor(Math.random()*7);if(!ks.includes(k))ks.push(k);}
    const amp=ks.map((k,i)=>i?losBez(.15,.7)/Math.sqrt(k):losBez(.7,1)),ph=ks.map(()=>losBez(0,2*Math.PI)),o=[];
    for(let n=0;n<64;n++){let s=0;for(let i=0;i<ks.length;i++)s+=amp[i]*Math.sin(2*Math.PI*ks[i]*n/64+ph[i]);o.push(s);}
    const mean=o.reduce((s,v)=>s+v,0)/64;let pk=0;for(let n=0;n<64;n++){o[n]-=mean;pk=Math.max(pk,Math.abs(o[n]));}
    return o.map(v=>Math.round((pk>1e-9?v/pk:0)*1000)/1000||0);}
  function losujModul(m){
    if(m==="osc"){P.szum=Math.random()<.1;P.fala=Math.random()<.35?"custom":losZ(["sawtooth","square","triangle","sine","pulse"]);
      if(P.fala==="custom"){const w=losFala();if(w)P.wt=w;else P.fala="sawtooth";}
      P.okt=losZ([-1,0,0,1]);P.glosy=losZ([1,1,1,2,3,5]);P.rozstroj=losKnob("rozstroj");P.szumQ=losKnob("szumQ");P.puls=losKnob("puls");
      P.sub=Math.random()<.3;P.osc2=Math.random()<.5;P.fala2=losZ(FALE);P.polton2=losZ([-12,-5,0,7,12]);P.rozstroj2=Math.round(losBez(-15,15));P.miks2=Math.round(losBez(25,70));}
    else if(m==="filter"){P.filtr=losZ(["lowpass","lowpass","bandpass","highpass","notch"]);P.fMin=losKnob("fMin");P.fMax=Math.max(P.fMin+600,losKnob("fMax"));P.q=Math.round(losBez(.5,8)*10)/10;
      P.obwF=Math.random()<.45?Math.round(losBez(-80,90)):0;P.obwFCzas=Math.round(losBez(10,160))*5;P.puch=Math.random()<.2?Math.round(losBez(2,12))*5:0;
      P.eq=[];if(Math.random()<.5){const n=1+Math.floor(Math.random()*3);for(let i=0;i<n;i++)P.eq.push({f:Math.round(80*Math.pow(100,Math.random())),g:Math.round((Math.random()<.5?-1:1)*losBez(2,10)*10)/10,q:Math.round(losBez(.5,4)*100)/100});P.eq.sort((a,b)=>a.f-b.f);}}
    else if(m==="env"){P.atak=Math.round(losBez(5,250));P.zanik=Math.round(losBez(10,90))*10;P.podtrzym=Math.round(losBez(40,100));P.puszcz=Math.round(losBez(8,70))*10;
      P.szarp=Math.random()<.3?losKnob("szarp"):0;P.glide=losKnob("glide");
      const z=()=>Math.random()<.6?Math.round(losBez(-.8,.8)*100)/100||0:0;P.envC=[z(),z(),z()];}
    else if(m==="char"){P.wib=Math.random()<.4?losKnob("wib"):0;P.rechot=Math.random()<.12?losKnob("rechot"):0;P.przester=Math.random()<.3?losKnob("przester"):0;
      P.wah=Math.random()<.2?losKnob("wah"):0;P.wahTempo=losKnob("wahTempo");}
  }

  // ---- zapis i rejestracja w silniku ----
  // wpis z wersji 1 („alikwoty” jednym suwakiem) staje się własną falą z tych samych harmonicznych; reszta pól zostaje
  function migruj(p){const q=Object.assign({},p||{});
    if(q.alik>0&&!q.szum&&E){const a=q.alik/100;q.fala="custom";q.wt=Array.from(E.M.fromHarmonics([1,.7*a,.5*a,.35*a,.25*a]),v=>Math.round(v*1000)/1000||0);}
    delete q.alik;return swiezy(q);}
  function wczytaj(){
    try{const z=JSON.parse(localStorage.getItem(KLUCZ)||"null");
      if(z&&Array.isArray(z.instrumenty))dane={wersja:WERSJA,instrumenty:z.instrumenty.filter(i=>i&&/^w-[a-z0-9]+$/.test(i.id)&&typeof i.nazwa==="string").slice(0,MAKS)
        .map(i=>({id:i.id,nazwa:i.nazwa,p:migruj(i.p)}))};}
    catch(e){}
    for(const i of dane.instrumenty)zarejestruj(i);
    // Bajty próbek leżą w IndexedDB, więc dochodzą chwilę później niż receptury — do tego czasu instrument z próbką
    // gra zastępczym głosem z oscylatorów (ta sama zasada, co Krzyk przed wczytaniem swoich WAV-ów). Zaraz potem
    // z bazy znikają sieroty: nagrania, których nikt nie zapisał, i próbki usuniętych instrumentów.
    const ids=uzywaneProbki();
    StudioProbki.wczytajWiele(ids).then(()=>{
      // Receptury poszły do silnika BEZ bajtów (wyżej), więc żaden zestaw się wtedy nie policzył. Teraz bajty
      // są w pamięci i to samo wywołanie buduje je po raz drugi — tym razem z próbkami w środku.
      for(const i of dane.instrumenty)zarejestruj(i);
      if(zbudowany&&naEkranie())odswiezProbke();
      StudioProbki.sprzatajZestawy(uzywaneZestawy());
      return StudioProbki.sprzataj(ids);
    }).catch(()=>{});
  }
  // id próbek, do których jest jeszcze instrument (plus ta, którą trzyma otwarty formularz — nagranie bez zapisu)
  function uzywaneProbki(){
    const s=new Set();
    for(const i of dane.instrumenty)if(i.p&&i.p.probka&&i.p.probka.id)s.add(i.p.probka.id);
    if(P&&P.probka&&P.probka.id)s.add(P.probka.id);
    return [...s];
  }
  // nazwy zestawów w silniku, do których jest jeszcze instrument albo formularz — po tej liście sprzątane są
  // bufory zostawione przez kręcenie pokrętłami wycinka (każda wartość to osobny zestaw)
  function uzywaneZestawy(){
    const s=new Set();
    const dodaj=q=>{if(maProbke(q))s.add(StudioProbki.nazwaEdycji(q.probka.id,edycjaProbki(q)));};
    for(const i of dane.instrumenty)dodaj(i.p);
    dodaj(P);
    return [...s];
  }
  const probkaUzywana=(id,pomin)=>dane.instrumenty.some(i=>i.id!==pomin&&i.p&&i.p.probka&&i.p.probka.id===id)||!!(P&&P.probka&&P.probka.id===id);
  const zapisz=()=>{try{localStorage.setItem(KLUCZ,JSON.stringify(dane));return true;}catch(e){return false;}};   // false = brak miejsca (np. za dużo grafik)
  function zarejestruj(i){try{Glos.dodajWlasny(i.id,recepta(i.p));if(typeof T!=="undefined"&&T.instrumentyGracza)T.instrumentyGracza[i.id]=i.nazwa;}catch(e){}}
  function wyrejestruj(id){try{Glos.usunWlasny(id);if(T&&T.instrumentyGracza)delete T.instrumentyGracza[id];}catch(e){}}
  const nowyId=()=>"w-"+Math.random().toString(36).slice(2,8);
  const lista=()=>dane.instrumenty.map(i=>i.id);
  const odswiezGraczy=()=>{try{if(typeof rysujGraczy==="function"&&S.ekran==="lobby")rysujGraczy();}catch(e){}};

  // ---- pokrętło (jak rf-knob.js w RibbitFlipie: pionowe przeciąganie, Shift = dokładnie, kółko, klawiatura, dwuklik = domyślna) ----
  const refy={gale:{}};
  function fmt(k,v){const st=ZAKRESY[k][2],dec=(String(st).split(".")[1]||"").length;return String(+(+v).toFixed(dec));}
  // wartość pokrętła `k` ustawiana z zewnątrz (ekran obwiedni, klawiatura paneli): przycięta do zakresu i kroku, odświeża
  // pokrętło i podgląd. Zwraca true, gdy coś się zmieniło.
  function ustawWartosc(k,v){const z=ZAKRESY[k];if(!z||!Number.isFinite(v))return false;
    v=+Math.max(z[0],Math.min(z[1],z[0]+Math.round((v-z[0])/z[2])*z[2])).toFixed(3);if(v===P[k])return false;P[k]=v;
    const o=refy.gale[k];if(o)o.odswiez();zmiana();return true;}
  function gala(k,etykieta){
    const z=ZAKRESY[k],a=z[0],b=z[1],st=z[2],pole=el2("div","st-gala");pole.dataset.k=k;
    pole.append(el2("span","st-gala-et",etykieta));if(PODP[k])pole.title=PODP[k];
    const knob=el2("div","knob");knob.tabIndex=0;knob.setAttribute("role","slider");knob.setAttribute("aria-label",etykieta);
    knob.setAttribute("aria-valuemin",fmt(k,a));knob.setAttribute("aria-valuemax",fmt(k,b));
    const val=el2("span","knob-mark knob-val"),mn=el2("span","knob-mark knob-min",fmt(k,a)),mx=el2("span","knob-mark knob-max",fmt(k,b));
    const dial=el2("span","knob-dial"),cap=el2("span","knob-cap");cap.style.backgroundImage="url(../assets/knobs/"+KNOB[z[4]]+".png)";dial.append(cap);
    knob.append(val,mn,mx,dial);
    const wejscie=el2("div","knob-entry"),num=el2("input","knob-num");num.type="number";num.min=a;num.max=b;num.step=st;num.inputMode="decimal";num.setAttribute("aria-label",etykieta);
    wejscie.append(num);if(z[3])wejscie.append(el2("span","knob-unit",z[3]));
    pole.append(knob,wejscie);
    const ustawWidok=()=>{const v=+P[k],t=b>a?Math.max(0,Math.min(1,(v-a)/(b-a))):0;
      cap.style.transform="rotate("+(-135+t*270)+"deg)";val.textContent=fmt(k,v);knob.setAttribute("aria-valuenow",fmt(k,v));
      if(document.activeElement!==num)num.value=fmt(k,v);};
    const ustaw=v=>{if(!isFinite(v))return;v=Math.max(a,Math.min(b,Math.round(v/st)*st));P[k]=+v.toFixed(3);ustawWidok();zmiana();};
    let drag=null;
    knob.addEventListener("pointerdown",e=>{if(e.button!=null&&e.button!==0)return;try{knob.setPointerCapture(e.pointerId);}catch(x){}
      knob.classList.add("dragging");drag={y:e.clientY,v:+P[k]};e.preventDefault();knob.focus({preventScroll:true});});
    knob.addEventListener("pointermove",e=>{if(!drag)return;ustaw(drag.v+((drag.y-e.clientY)/(e.shiftKey?560:175))*(b-a));});
    const koniec=()=>{drag=null;knob.classList.remove("dragging");};
    knob.addEventListener("pointerup",koniec);knob.addEventListener("pointercancel",koniec);knob.addEventListener("lostpointercapture",koniec);
    knob.addEventListener("wheel",e=>{e.preventDefault();ustaw(+P[k]+(e.deltaY<0?1:-1)*st*(e.ctrlKey?10:1));},{passive:false});
    knob.addEventListener("keydown",e=>{const key=e.key;let v=+P[k];
      if(key==="ArrowUp"||key==="ArrowRight")v+=st;else if(key==="ArrowDown"||key==="ArrowLeft")v-=st;else if(key==="PageUp")v+=st*10;
      else if(key==="PageDown")v-=st*10;else if(key==="Home")v=a;else if(key==="End")v=b;else return;
      e.preventDefault();e.stopPropagation();ustaw(v);});
    knob.addEventListener("dblclick",e=>{e.preventDefault();ustaw(DOMYSLNE[k]);});
    num.addEventListener("input",()=>{const v=parseFloat(num.value);if(isFinite(v)){P[k]=Math.max(a,Math.min(b,v));cap.style.transform="rotate("+(-135+(b>a?(P[k]-a)/(b-a):0)*270)+"deg)";val.textContent=fmt(k,P[k]);zmiana();}});
    num.addEventListener("change",ustawWidok);
    num.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();num.blur();}e.stopPropagation();});
    refy.gale[k]={pole,odswiez:ustawWidok};ustawWidok();
    return pole;
  }
  function lista2(k,etykieta,opcje,szeroka){
    const w=el2("label","st-lista-pole"+(szeroka?" szeroka":""));w.dataset.k=k;w.append(el2("span","st-gala-et",etykieta));
    const s=el2("select","lista");for(const [v,n] of opcje){const o=el2("option","",n);o.value=String(v);s.append(o);}
    s.value=String(P[k]);s.onchange=()=>{P[k]=typeof DOMYSLNE[k]==="number"?+s.value:s.value;if(k==="fala"&&s.value==="custom"&&!P.wt)P.wt=Array.from(E?E.M.sine():new Float32Array(64));
      if(k==="fala"&&E)E.Panele.load(P);zmiana();};
    refy.gale[k]={pole:w,odswiez:()=>{s.value=String(P[k]);}};w.append(s);return w;
  }
  function przelacznik(k,etykieta,poZmianie){
    const w=el2("label","st-lista-pole st-check");w.dataset.k=k;if(PODP[k])w.title=PODP[k];
    const c=el2("input");c.type="checkbox";c.checked=!!P[k];
    c.onchange=()=>{P[k]=c.checked;if(poZmianie)poZmianie(c.checked);zmiana();};w.append(c,el2("span","",etykieta));
    refy.gale[k]={pole:w,odswiez:()=>{c.checked=!!P[k];}};return w;
  }

  // ---- podgląd: własna szyna z analizatorem (lampa i panele czytają z niej), żywe głosy, klawiatura ----
  function szyna(){if(pod&&pod.zywy)return pod;try{Glos.odblokuj();pod=Glos.podglad();}catch(e){pod=null;}return pod;}
  function zarejestrujPodglad(){try{Glos.dodajWlasny("w-podglad",recepta(P));}catch(e){}podgladNieaktualny=false;}
  const trzymane=new Map();   // klucz → {g, polton}
  // nuty dla żabek na obręczy lampy: trzymane (róż), próbka (limonka), pętla i piosenka (bursztyn)
  function nuty(){const o=[];for(const [k,v] of trzymane)o.push({id:k,polton:v.polton,kolor:"#ec1a83"});
    if(probkaGlos&&probkaGlos.polton!=null&&performance.now()<probkaDo)o.push({id:"probka",polton:probkaGlos.polton,kolor:"#a6d861"});
    const c=pod&&pod.zywy?pod.teraz():null;
    if(c!=null){for(const n of seq.brzmi)if(n.t0<=c&&c<n.t1)o.push({id:"s"+n.m,polton:n.m,kolor:"#eaa32b"});
      for(const n of pios.brzmi)if(n.t0<=c&&c<n.t1)o.push({id:"m"+n.m,polton:n.m,kolor:"#eaa32b"});}
    return o;}
  const zywe=()=>trzymane.size>0||ciagly||seq.gra||pios.gra||performance.now()<probkaDo;
  function probka(id,polton){   // krótka fraza (kwinta w górę i z powrotem) przez szynę podglądu, jak ▶ w liście Syntha
    const p=szyna();if(!p)return;const c=p.kontekst();if(c.state!=="running"){c.resume().then(()=>probka(id,polton)).catch(()=>{});return;}
    if(probkaGlos){try{probkaGlos.g.zniszcz();}catch(e){}probkaGlos=null;}
    const g=p.glos(id),t=c.currentTime+.02,m=[60,67,64];probkaGlos={g,polton:m[0]};probkaDo=performance.now()+900;
    g.ustaw(m[0],.7,0,t);g.spiewaj(true,t);g.ustaw(m[1],.7,0,t+.22);g.ustaw(m[2],.7,0,t+.44);g.spiewaj(false,t+.75);
    setTimeout(()=>{if(probkaGlos&&probkaGlos.g===g)probkaGlos=null;try{g.zniszcz();}catch(e){}},1400);
  }
  function testuj(){zarejestrujPodglad();probka("w-podglad");}
  // Klik myszą trwa kilkadziesiąt ms (atak + zwolnienie to więcej), więc samo kliknięcie klawisza nic nie grało
  // i klikanie klawiszy w studio nie miało sensu. Nuta z klawisza trwa co najmniej MIN_NUTA ms: krótkie puszczenie
  // odkłada zwolnienie, ponowne naciśnięcie w tym czasie przedłuża tę samą nutę; element (el, klasa) gaśnie dopiero ze zwolnieniem.
  const MIN_NUTA=300;
  function nacisnij(klucz,polton,el,klasa){
    klasa=klasa||"gra";const w=trzymane.get(klucz);
    if(w){if(w.timer){clearTimeout(w.timer);w.timer=0;}if(el)el.classList.add(klasa);return;}
    const p=szyna();if(!p)return;
    try{zarejestrujPodglad();const g=p.glos("w-podglad");g.ustaw(polton,.7,0);g.spiewaj(true);
      trzymane.set(klucz,{g,polton,t0:performance.now(),timer:0,el,klasa});if(el)el.classList.add(klasa);}catch(e){}
  }
  function puść(klucz,odRazu){const v=trzymane.get(klucz);if(!v)return;
    const zostalo=odRazu||v.t0==null?0:MIN_NUTA-(performance.now()-v.t0);
    if(zostalo>0){if(!v.timer)v.timer=setTimeout(()=>{v.timer=0;puść(klucz,true);},zostalo);return;}
    trzymane.delete(klucz);if(v.timer){clearTimeout(v.timer);v.timer=0;}
    if(v.el)v.el.classList.remove(v.klasa);
    try{v.g.spiewaj(false);setTimeout(()=>{try{v.g.zniszcz();}catch(e){}},1600);}catch(e){}}
  function odswiezCiagly(){
    if(glosCiagly){try{glosCiagly.spiewaj(false);const g=glosCiagly;setTimeout(()=>{try{g.zniszcz();}catch(e){}},600);}catch(e){}glosCiagly=null;trzymane.delete("ciagly");}
    if(!ciagly)return;
    const p=szyna();if(!p)return;
    try{zarejestrujPodglad();glosCiagly=p.glos("w-podglad");glosCiagly.ustaw(60,.7,0);glosCiagly.spiewaj(true);trzymane.set("ciagly",{g:glosCiagly,polton:60});}catch(e){}
  }
  const KLAWISZE=[["a",60],["w",61],["s",62],["e",63],["d",64],["f",65],["t",66],["g",67],["y",68],["h",69],["u",70],["j",71],["k",72]];

  // ---- „Zaśpiewaj”: pole, po którym prowadzi się myszą jak w grze (10-21) --------------------------
  // Klawiatura daje trzynaście nut i nic nie mówi o tym, co instrument robi POMIĘDZY nimi — a właśnie tam
  // widać glissando, wibrato i to, jak daleko da się rozciągnąć próbkę, zanim zacznie skrzeczeć.
  //
  // MAPOWANIE NIE JEST TU PRZEPISANE, tylko WOŁANE Z GRY: `stopnieNaPolton` i `wygladzEMA` to te same
  // funkcje, z których korzysta `krokGracza` w zabi-chor.js, zakres myszy to USTAWIENIE GRACZA
  // (`S.ust.zakres`, z jego „odwróć”), a próg wibrata to `ZC_PUNKTY.WIB_PROG`. Dzięki temu pole nie może
  // zacząć się zachowywać inaczej niż tor w grze — a gdyby gra zmieniła wzór, zmieni się i tutaj.
  // Jedyne przepisane stałe to te z `wejscie.js`, których ten plik nie wystawia: WIB_MYSZ i wygładzanie
  // prędkości poziomej (patrz `spiewRuch`).
  const SPIEW_LO=55,SPIEW_HI=76;          // zakres pola; w grze bierze się go z partii piosenki, tu jest stały
  const SPIEW_WIB_MYSZ=.5;                // wejscie.js: twist = prędkość pozioma (px/s) × WIB_MYSZ
  const SPIEW_TAU_P=.06,SPIEW_TAU_W=.12;  // zabi-chor.js `krokGracza`: te same stałe czasowe
  const spiew={gra:false,celY:.5,deg:0,wib:0,vx:0,x:null,t:0,klatka:0,raf:0,odswiez:true};
  const spiewZakres=()=>{try{return Math.max(1,+S.ust.zakres||40);}catch(e){return 40;}};
  const spiewOdwroc=()=>{try{return !!S.ust.odwroc;}catch(e){return false;}};
  const spiewProg=()=>{try{return ZC_PUNKTY.WIB_PROG;}catch(e){return 150;}};
  const spiewPolton=()=>stopnieNaPolton(spiew.deg,spiewZakres(),SPIEW_LO,SPIEW_HI);
  // strój własnej próbki na skali: pokazuje, gdzie instrument NIE rozciąga nagrania („nie przestrajaj” go nie ma)
  function spiewStrojProbki(){
    if(!maProbke(P)||P.probkaStaly)return null;
    return Math.max(12,Math.min(108,(+P.probkaRoot||60)+(+P.probkaCent||0)/100));
  }
  function spiewRuch(e){
    const w=refy.spiew;if(!w)return;
    const r=w.pole.getBoundingClientRect();
    spiew.celY=Math.max(0,Math.min(1,(e.clientY-r.top)/Math.max(1,r.height)));
    const t=performance.now();
    if(spiew.x!==null){const dt=(t-spiew.t)/1000;
      if(dt>0&&dt<.15)spiew.vx=.6*spiew.vx+.4*Math.abs(e.clientX-spiew.x)/dt;}   // wejscie.js: ta sama miara
    spiew.x=e.clientX;spiew.t=t;
  }
  function spiewStart(e){
    const w=refy.spiew;if(!w||e.button!=null&&e.button!==0)return;
    e.preventDefault();
    try{w.pole.setPointerCapture(e.pointerId);}catch(x){}
    if(ciagly){ciagly=false;if(refy.ciaglyB)refy.ciaglyB.setAttribute("aria-pressed","false");odswiezCiagly();}
    spiew.x=null;spiewRuch(e);
    spiew.deg=(spiew.celY-.5)*2*spiewZakres()*(spiewOdwroc()?-1:1);spiew.wib=0;
    spiew.gra=true;w.pole.classList.add("gra");
    nacisnij("spiew",spiewPolton(),null,null);
    if(!spiew.raf)spiew.raf=requestAnimationFrame(spiewKlatka);
  }
  function spiewStop(){
    const w=refy.spiew;if(!spiew.gra)return;
    spiew.gra=false;spiew.odswiez=true;
    if(w)w.pole.classList.remove("gra");
    puść("spiew",true);
  }
  // Pętla klatek chodzi TYLKO w trakcie śpiewania: poza nim nie ma czego liczyć ani przerysowywać.
  function spiewKlatka(t){
    const w=refy.spiew;
    if(!w||!naEkranie()){spiew.raf=0;spiewStop();return;}
    const dt=Math.min(.1,(t-spiew.klatka)/1000||.016);spiew.klatka=t;
    if(performance.now()-spiew.t>120)spiew.vx=0;                      // mysz stoi: koniec wibrata
    if(spiew.gra||spiew.odswiez){
      spiew.deg=wygladzEMA(spiew.deg,(spiew.celY-.5)*2*spiewZakres()*(spiewOdwroc()?-1:1),dt,SPIEW_TAU_P);
      spiew.wib=wygladzEMA(spiew.wib,Math.min(50,spiew.vx*SPIEW_WIB_MYSZ/6),dt,SPIEW_TAU_W);
      const semi=spiewPolton(),poz=Math.max(0,Math.min(1,(semi-(SPIEW_LO-2))/(SPIEW_HI-SPIEW_LO+4)));
      const v=trzymane.get("spiew");
      if(spiew.gra&&v){v.polton=semi;try{v.g.ustaw(semi,.35+.5*poz,spiew.wib);}catch(e){}}   // jak krokGracza
      rysujSpiew(semi);
      w.odczyt.textContent=spiew.gra
        ?nazwaNuty(Math.round(semi))+"  "+(Math.round(semi*10)/10).toFixed(1)   // nazwa chce całego półtonu
          +(spiew.vx*SPIEW_WIB_MYSZ>=spiewProg()?" · "+TX.spiewWibrato:"")
        :"";
      spiew.odswiez=false;
    }
    spiew.raf=spiew.gra?requestAnimationFrame(spiewKlatka):0;
  }
  // Przerysowanie poza pętlą klatek: ta chodzi tylko w trakcie śpiewania, a skala i kreska stroju próbki
  // muszą być widoczne także wtedy, gdy nikt nie trzyma myszy.
  function odswiezSpiew(){spiew.odswiez=true;if(!spiew.gra&&refy.spiew)rysujSpiew(spiewPolton());}
  function rysujSpiew(semi){
    const w=refy.spiew;if(!w||!w.plotno)return;
    const k=w.plotno,sz=Math.max(1,Math.min(3,window.devicePixelRatio||1));
    const szer=Math.max(40,Math.round(k.clientWidth||240)),wys=Math.max(30,Math.round(k.clientHeight||80));
    if(k.width!==Math.round(szer*sz)||k.height!==Math.round(wys*sz)){k.width=Math.round(szer*sz);k.height=Math.round(wys*sz);}
    const c=k.getContext("2d");if(!c)return;
    c.setTransform(sz,0,0,sz,0,0);c.clearRect(0,0,szer,wys);
    const dol=SPIEW_LO-2,gora=SPIEW_HI+2,y=m=>wys*(1-(m-dol)/(gora-dol));
    c.font="10px "+(getComputedStyle(k).fontFamily||"monospace");c.textBaseline="alphabetic";
    for(let m=Math.ceil(dol/12)*12;m<=gora;m+=12){                   // co oktawa: linia i podpis
      const yy=y(m);
      c.strokeStyle="rgba(255,255,255,.09)";c.lineWidth=1;c.beginPath();c.moveTo(0,yy);c.lineTo(szer,yy);c.stroke();
      c.fillStyle="rgba(243,236,221,.3)";c.fillText(nazwaNuty(m),6,yy-3);
    }
    const st=spiewStrojProbki();
    if(st!=null){const yy=y(st);c.fillStyle="#eaa32b";c.fillRect(szer-26,yy-1,20,2);}
    if(spiew.gra){
      const yy=y(semi);
      c.strokeStyle="#ec1a83";c.lineWidth=2;c.beginPath();c.moveTo(0,yy);c.lineTo(szer,yy);c.stroke();
      c.fillStyle="#ec1a83";c.beginPath();c.ellipse(szer/2,yy,14+spiew.wib*1.5,6,0,0,Math.PI*2);c.fill();
    }
    c.setTransform(1,0,0,1,0,0);
  }

  // ---- pętla klatek ekranów (lampa, panele): biegnie, póki ekran studia jest otwarty ----
  function petla(){raf=0;if(!naEkranie()||!E)return;
    const now=E.klatka();try{E.Lampa.rysuj(now);E.Panele.rysuj(now);zabaKlatka();}catch(e){}
    raf=requestAnimationFrame(petla);}
  function startPetli(){if(!raf&&E&&typeof requestAnimationFrame==="function")raf=requestAnimationFrame(petla);}
  // interfejs Studia dla paneli (studio-ekrany.js Panele.init)
  const SP={fala:()=>P.fala,ustawFala:v=>{P.fala=v;const o=refy.gale.fala;if(o)o.odswiez();},
    obw:()=>({att:P.atak/1000,dec:P.zanik/1000,sus:P.podtrzym/100,rel:P.puszcz/1000,fEnv:P.obwF/100,fEnvT:P.obwFCzas/1000}),
    ustawObw:(k,v)=>ustawWartosc(k,v),
    przesunObw:(k,dir,duzy)=>ustawWartosc(k,+P[k]+dir*ZAKRESY[k][2]*(duzy?5:1)),
    analizator:()=>pod&&pod.zywy?pod.analizator():null,
    sampleRate:()=>{try{return pod&&pod.zywy?pod.kontekst().sampleRate:48000;}catch(e){return 48000;}},
    zmiana:()=>{E.Panele.readInto(P);if(P.fala!=="custom")P.wt=null;zmiana();}};

  // ---- stan formularza ----
  const json=()=>JSON.stringify(P);
  function rodzaj(){if(!edytowany)return "new";return json()===zapisanyJson?"custom":"over";}
  function odswiezPasek(){
    const k=rodzaj(),z=refy.rodzaj;
    if(z){z.dataset.kind=k;z.textContent=k==="new"?TX.rodzajNowe:k==="custom"?TX.rodzajWlasne:TX.rodzajZmienione;}
    if(refy.brudny)refy.brudny.hidden=!(edytowany&&k==="over");
    if(refy.pasek)refy.pasek.classList.toggle("dirty",!!(edytowany&&k==="over"));
    if(refy.zapisz)refy.zapisz.querySelector(".st-ik-t").textContent=edytowany?TX.zapiszZmiany:TX.zapisz;
    if(refy.anuluj)refy.anuluj.hidden=!edytowany;
  }
  function widocznosc(){const q=P,pokaz=(k,t)=>{const o=refy.gale[k];if(o)o.pole.hidden=!t;};
    pokaz("puls",q.fala==="pulse"&&!q.szum);pokaz("glosy",!q.szum);pokaz("rozstroj",!q.szum&&q.glosy>1);pokaz("szumQ",!!q.szum);
    pokaz("sub",!q.szum);pokaz("osc2",!q.szum);for(const k of ["fala2","polton2","rozstroj2","miks2"])pokaz(k,!q.szum&&!!q.osc2);
    pokaz("wahTempo",q.wah>0);pokaz("zanik",q.podtrzym<100||true);
    for(const k of ["probkaOd","probkaDo","probkaZlep"])pokaz(k,!!q.probkaPetla);   // bez pętli te trzy liczby nic nie robią
    for(const k of ["probkaRoot","probkaCent"])pokaz(k,!q.probkaStaly);   // nic nie przestraja = nie ma czego stroić
    if(refy.szumInfo)refy.szumInfo.hidden=!q.szum;
    if(refy.rack)refy.rack.classList.toggle("st-szum",!!q.szum);
    if(refy.rack)refy.rack.classList.toggle("st-probka-gra",maProbke(q));}
  function odswiezWidok(){
    for(const o of Object.values(refy.gale))o.odswiez();
    widocznosc();if(refy.nazwa&&document.activeElement!==refy.nazwa)refy.nazwa.value=P.nazwa||"";
    if(E)E.Panele.load(P);odswiezPasek();odswiezOkladke();odswiezProbke();odswiezSpiew();
  }
  function zmiana(){
    odswiezPasek();widocznosc();odswiezOkladke();odswiezProbke();odswiezSpiew();if(E)E.Panele._req();podgladNieaktualny=true;   // pętla i piosenka wezmą nową recepturę od następnej nuty
    // Każda wartość wycinka to osobny zestaw próbek w silniku, a jeden to do 1,5 MB w AudioBufferach: po każdej
    // zmianie formularza znikają te, do których nie ma już instrumentu ani otwartej karty.
    try{if(maProbke(P)||dane.instrumenty.some(i=>maProbke(i.p)))StudioProbki.sprzatajZestawy(uzywaneZestawy());}catch(e){}
    if(ciagly){clearTimeout(debounce);debounce=setTimeout(odswiezCiagly,110);}
  }
  function komunikat(t,blad){if(refy.komunikat){refy.komunikat.textContent=t||"";refy.komunikat.classList.toggle("blad",!!blad);}}
  function zapiszInstrument(){
    const nazwa=(P.nazwa||"").trim().slice(0,24);
    if(!nazwa){komunikat(TX.bezNazwy,true);if(refy.nazwa)refy.nazwa.focus();return;}
    P.nazwa=nazwa;const p=swiezy(P);
    if(edytowany){const i=dane.instrumenty.find(x=>x.id===edytowany);if(i){i.nazwa=nazwa;i.p=p;zarejestruj(i);}}
    else{
      if(dane.instrumenty.length>=MAKS){komunikat(tt2(TX.limit,{n:MAKS}),true);return;}
      const i={id:nowyId(),nazwa,p};dane.instrumenty.push(i);zarejestruj(i);edytowany=i.id;
    }
    zapisanyJson=json();const ok=zapisz();odswiezListe();odswiezPasek();komunikat(ok?tt2(TX.zapisano,{n:nazwa}):TX.brakMiejsca,!ok);odswiezGraczy();
  }
  function wczytajDoFormularza(i){
    edytowany=i?i.id:null;P=swiezy(i?Object.assign({},i.p,{nazwa:i.nazwa}):null);zapisanyJson=i?json():"";
    podgladNieaktualny=true;odswiezWidok();odswiezListe();komunikat("");if(ciagly)odswiezCiagly();
    if(refy.startery)for(const b of refy.startery.children)b.setAttribute("aria-pressed","false");
  }
  function odswiezListe(){
    const ul=refy.lista;if(!ul)return;ul.replaceChildren();
    const f=szukane.trim().toLocaleLowerCase("pl"),widoczne=dane.instrumenty.filter(i=>!f||i.nazwa.toLocaleLowerCase("pl").includes(f));
    if(refy.licznik)refy.licznik.textContent=dane.instrumenty.length+"/"+MAKS;
    if(!widoczne.length){
      if(dane.instrumenty.length){ul.append(el2("li","st-pusto","…"));return;}
      const li=el2("li","st-pusto st-pusto-duzy");li.append(ikona("gry/spiewa-tak","st-pusto-ik"),el2("b","",TX.pusto),el2("span","",TX.pustoOpis));ul.append(li);return;}
    for(const i of widoczne){
      const li=el2("li","st-wiersz"+(edytowany===i.id?" akt":""));li.dataset.id=i.id;
      const n=el2("button","st-nazwa");n.type="button";n.title=TX.edytuj;n.onclick=()=>wczytajDoFormularza(i);n.append(miniatura(i),el2("span","st-nazwa-t",i.nazwa));
      const przyc=(plik,tytul,fn,k)=>{const b=el2("button","przycisk maly st-ikp "+(k||""));b.type="button";b.append(ikona(plik));b.title=tytul;b.setAttribute("aria-label",tytul+": "+i.nazwa);b.onclick=fn;return b;};
      li.append(n,przyc("gry/graj",TX.posluchaj,()=>{probka(i.id);for(const x of ul.children)x.classList.remove("gra");li.classList.add("gra");setTimeout(()=>li.classList.remove("gra"),1300);},"st-graj"),
        przyc("pokretlo",TX.edytuj,()=>wczytajDoFormularza(i)),   // 10-18: pokrętło = edycja brzmienia; ołówek = zmiana nazwy (jak w Profilach)
        przyc("kopiuj",TX.duplikuj,()=>kopiaInstrumentu(i,true)),
        przyc("bin",TX.usun,()=>pytajOUsuniecie(i,false),"st-usun"));   // 10-18: najpierw pytanie w oknie gry
      ul.append(li);
    }
  }

  // ---- zarządzanie własnymi instrumentami: w jednym miejscu wszystkie z obrazkiem i nazwą, otwarcie do edycji,
  //      zmiana nazwy, kopia, usunięcie z potwierdzeniem, do tego plik ----
  // Gracz z usuniętym instrumentem wraca do swojego domyślnego: znika jego wpis w S.ust.instrumentyGraczy (instrumentGracza()
  // w zabi-chor.js bierze wtedy „Instrument nowego gracza” albo ostatni odblokowany) i zapis ustawień idzie od razu, więc
  // w zapisanym składzie nie zostaje id, którego już nie ma.
  function zapomnijWyborGraczy(id){
    try{const m=S.ust.instrumentyGraczy;
      if(m&&typeof m==="object"&&Object.values(m).includes(id)){
        S.ust.instrumentyGraczy=Object.fromEntries(Object.entries(m).filter(([,v])=>v!==id));
        if(typeof zapiszUstawienia==="function")zapiszUstawienia();}
      if(typeof ZC_DEV!=="undefined"&&ZC_DEV.instrument===id)ZC_DEV.instrument=null;}catch(e){}
  }
  function usunInstrument(id){
    const i=dane.instrumenty.find(x=>x.id===id);if(!i)return false;
    dane.instrumenty=dane.instrumenty.filter(x=>x.id!==id);wyrejestruj(id);zapisz();zapomnijWyborGraczy(id);
    // bajty próbki idą dopiero wtedy, gdy nikt inny ich nie używa (kopia instrumentu dzieli jedną próbkę)
    const pid=i.p&&i.p.probka&&i.p.probka.id;
    if(pid&&!probkaUzywana(pid))StudioProbki.usun(pid).catch(()=>{});
    if(edytowany===id)wczytajDoFormularza(null);else odswiezListe();
    komunikat(tt2(TX.usunieto,{n:i.nazwa}));odswiezGraczy();return true;
  }
  // kopia na końcu listy; z listy w Studiu od razu w formularzu (jak dotąd), z okna zostaje na liście okna
  function kopiaInstrumentu(i,doFormularza){
    if(dane.instrumenty.length>=MAKS){komunikat(tt2(TX.limit,{n:MAKS}),true);return null;}
    const k={id:nowyId(),nazwa:tt2(TX.kopia,{n:i.nazwa}).slice(0,24),p:swiezy(i.p)};k.p.nazwa=k.nazwa;dane.instrumenty.push(k);
    if(!zapisz()){dane.instrumenty.pop();komunikat(TX.brakMiejsca,true);return null;}   // pełny localStorage: kopii nie ma ani w pamięci
    zarejestruj(k);if(doFormularza)wczytajDoFormularza(k);else{odswiezListe();komunikat(tt2(TX.kopiaZrobiona,{n:k.nazwa}));}
    odswiezGraczy();return k;
  }
  // nowa nazwa zapisanego instrumentu; gdy jest w formularzu, formularz bierze ją bez zmiany stanu „niezapisane zmiany”
  function zmienNazwe(id,nazwa){
    const i=dane.instrumenty.find(x=>x.id===id);nazwa=String(nazwa||"").trim().slice(0,24);if(!i||!nazwa)return false;
    const stara=i.nazwa;i.nazwa=nazwa;i.p.nazwa=nazwa;
    if(!zapisz()){i.nazwa=stara;i.p.nazwa=stara;komunikat(TX.brakMiejsca,true);return false;}
    zarejestruj(i);
    if(edytowany===id){P.nazwa=nazwa;if(refy.nazwa)refy.nazwa.value=nazwa;
      try{const z=JSON.parse(zapisanyJson);z.nazwa=nazwa;zapisanyJson=JSON.stringify(z);}catch(e){}odswiezPasek();}
    odswiezListe();komunikat(tt2(TX.zmienionoNazwe,{n:nazwa}));odswiezGraczy();return true;
  }
  // Plik: ten sam kształt co zapis Studia ({wersja, instrumenty:[{id, nazwa, p}]}) plus znacznik `rodzaj`; zapis postępów nie
  // zmienia się wcale (Studio ma własny klucz). Import tylko DOPISUJE: ten sam id i to samo brzmienie = „już tu był”, zajęty
  // albo zły id = nowy id, ponad limit = pominięte. Parametry z pliku przechodzą przez oczysc(): znane klucze, typy jak
  // w DOMYSLNE, liczby przycięte do ZAKRESY, fale i filtry tylko z dozwolonych, grafika tylko dataURL obrazu (swiezy → obrazOk).
  // 10-19 wieczór: plik niesie też BAJTY próbek — mapa `probki` {id: WAV w base64} obok listy instrumentów, bo jedną
  // próbkę może wskazywać kilka instrumentów (kopia), a base64 w parametrach dublowałoby ją tyle razy, ile kopii.
  // Limit rozmiaru podniesiony z 4 MB: 12 instrumentów z sześciosekundowymi próbkami to ok. 6 MB samego base64.
  const PLIK_RODZAJ="ribbitbeat-instrumenty",PLIK_MAKS=32e6;
  const WYBORY={fala:["sawtooth","square","triangle","sine","pulse","custom"],fala2:FALE,filtr:["lowpass","highpass","bandpass","notch"]};
  function oczysc(z){
    const q={},jest=k=>Object.prototype.hasOwnProperty.call(z,k),liczba=v=>typeof v==="number"&&Number.isFinite(v);
    for(const k of Object.keys(DOMYSLNE)){if(!jest(k))continue;const v=z[k],d=DOMYSLNE[k];
      if(ZAKRESY[k]){if(liczba(v))q[k]=Math.max(ZAKRESY[k][0],Math.min(ZAKRESY[k][1],v));}
      else if(WYBORY[k]){if(WYBORY[k].includes(v))q[k]=v;}
      else if(k==="okt"){if(liczba(v))q.okt=Math.max(-3,Math.min(3,Math.round(v)));}
      else if(typeof d==="boolean"){if(typeof v==="boolean")q[k]=v;}
      else if(k==="wt"||k==="envC"){if(Array.isArray(v)&&v.every(liczba))q[k]=v.map(x=>Math.max(-1,Math.min(1,x)));}
      else if(k==="eq"){if(Array.isArray(v))q.eq=v.filter(b=>b&&liczba(b.f)&&liczba(b.g)&&liczba(b.q)).slice(0,4).map(b=>({f:b.f,g:b.g,q:b.q}));}
      else if(k==="probka"){if(probkaOk(v))q.probka={id:v.id,sr:+v.sr,dl:+v.dl,zrodlo:v.zrodlo==="mikrofon"?"mikrofon":"plik"};}   // bajty dochodzą osobno (mapa `probki` w pliku)
      else if(typeof v==="string")q[k]=v;}   // nazwa, obraz
    if(jest("alik")&&liczba(z.alik))q.alik=Math.max(0,Math.min(100,z.alik));   // plik z wersji 1
    return migruj(q);
  }
  const eksportTekst=()=>{
    const inst=dane.instrumenty.map(i=>({id:i.id,nazwa:i.nazwa,p:swiezy(i.p)})),probki={};
    for(const i of inst){const id=i.p.probka&&i.p.probka.id;if(!id||probki[id])continue;
      const b=StudioProbki.wavB64(id);if(b)probki[id]=b;}
    for(const i of inst)if(i.p.probka&&!probki[i.p.probka.id])i.p.probka=null;   // bez bajtów nie ma na co wskazywać
    return JSON.stringify({rodzaj:PLIK_RODZAJ,wersja:WERSJA,instrumenty:inst,probki},null,1);
  };
  function eksportuj(){   // jak eksport profili (profile.js): plik JSON z Bloba, lokalnie. Czeka na bajty próbek z IndexedDB
    return StudioProbki.gotowe().catch(()=>null).then(()=>{
      let dzien="";try{dzien=Postepy.dzienLokalny(new Date());}catch(e){dzien=new Date().toISOString().slice(0,10);}
      const plik="ribbitbeat-instrumenty-"+dzien+".json";
      try{const url=URL.createObjectURL(new Blob([eksportTekst()],{type:"application/json"})),a=document.createElement("a");
        a.href=url;a.download=plik;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
        return {ok:true,plik};}catch(e){return {ok:false};}
    });
  }
  // Bajty próbki z pliku: WAV w base64 → Float32 tym samym parserem, co próbki z web/assets/. Ten sam id, który już
  // mamy w pamięci, zostaje bez podmiany (to ta sama próbka — id są losowe); nieodczytany WAV znaczy instrument bez próbki.
  function probkaZPliku(id,bajty){
    if(StudioProbki.wPamieci(id))return StudioProbki.wPamieci(id);
    const ab=typeof bajty==="string"?StudioProbki.zB64(bajty):null,w=ab?StudioProbki.zWav(ab):null;
    if(!w||!w.dane||!w.dane.length)return null;
    StudioProbki.zapisz(id,{dane:w.dane,sr:w.sr}).catch(()=>{});
    return {dane:w.dane,sr:w.sr};
  }
  function importuj(tekst){
    let z=null;try{z=JSON.parse(String(tekst==null?"":tekst).trim());}catch(e){}
    const lst=z&&typeof z==="object"&&Array.isArray(z.instrumenty)?z.instrumenty:null;
    if(!lst)return {ok:false,blad:"format"};
    const bajty=z.probki&&typeof z.probki==="object"&&!Array.isArray(z.probki)?z.probki:{};
    const nowe=[];let bylo=0,limit=0,zle=0;
    for(const x of lst){
      if(!x||typeof x!=="object"||typeof x.nazwa!=="string"||!x.nazwa.trim()||!x.p||typeof x.p!=="object"||Array.isArray(x.p)){zle++;continue;}
      const nazwa=x.nazwa.trim().slice(0,24),p=oczysc(x.p);p.nazwa=nazwa;
      if(p.probka){const w=probkaZPliku(p.probka.id,bajty[p.probka.id]);
        if(w){p.probka.sr=w.sr;p.probka.dl=w.dane.length;}else p.probka=null;}   // długość z bajtów, nie z opisu w pliku
      const id=typeof x.id==="string"&&/^w-[a-z0-9]+$/.test(x.id)&&x.id!=="w-podglad"?x.id:null,ten=id&&dane.instrumenty.find(i=>i.id===id);
      if(ten&&ten.nazwa===nazwa&&JSON.stringify(swiezy(ten.p))===JSON.stringify(p)){bylo++;continue;}
      if(dane.instrumenty.length+nowe.length>=MAKS){limit++;continue;}
      let nid=id&&!ten&&!nowe.some(n=>n.id===id)?id:nowyId();
      while(dane.instrumenty.some(i=>i.id===nid)||nowe.some(n=>n.id===nid))nid=nowyId();
      nowe.push({id:nid,nazwa,p});
    }
    if(!nowe.length)return {ok:!!(bylo||limit),blad:bylo||limit?null:"format",dodane:0,bylo,limit,zle,id:[]};
    const przed=dane.instrumenty;dane.instrumenty=przed.concat(nowe);
    if(!zapisz()){dane.instrumenty=przed;return {ok:false,blad:"miejsce"};}
    for(const i of nowe)zarejestruj(i);
    odswiezListe();odswiezGraczy();
    return {ok:true,blad:null,dodane:nowe.length,bylo,limit,zle,id:nowe.map(i=>i.id)};
  }
  function opisImportu(r){
    if(!r.ok)return r.blad==="miejsce"?TX.brakMiejsca:TX.importZly;
    if(!r.dodane)return r.limit?tt2(TX.limit,{n:MAKS}):TX.importNic;
    return [tt2(TX.importOk,{n:r.dodane}),r.bylo?tt2(TX.importBylo,{n:r.bylo}):"",r.limit?tt2(TX.importLimit,{n:r.limit,m:MAKS}):""].filter(Boolean).join(" ");
  }

  // ---- okno „Twoje instrumenty” i pytania (10-18): okno gry #okno z pakiety.js (pkOkno: × i Esc zamykają, Tab krąży w oknie,
  //      pad chodzi po nim jak po innych oknach lobby, bo #okno jest w nakladkaLobby()). Pytanie o usunięcie i zmiana nazwy
  //      podmieniają treść tego samego okna; „Anuluj” wraca do listy okna, Esc, × i pad B zamykają całe okno bez zmian. ----
  const maOkno=()=>typeof pkOkno==="function"&&typeof pkZamknijOkno==="function";
  const oknoOtwarte=()=>{const o=document.getElementById("okno");return !!o&&!o.hidden&&!!o.querySelector(".st-mi");};
  function obrazDuzy(i){const m=el2("span","st-mi-obraz");m.setAttribute("aria-hidden","true");
    if(i.p&&i.p.obraz){const im=el2("img");im.alt="";im.src=i.p.obraz;m.append(im);}else m.append(falaSvg(i.p&&i.p.szum?"custom":i.p&&i.p.fala));return m;}
  // o = {fokus: "<id>:<akcja>" | "eksport" | "import", status, blad, nowe: [id]}
  function oknoInstrumenty(o){
    if(!maOkno())return false;o=o||{};
    const fok={};
    const st=el2("p","st-mi-status"+(o.blad?" blad":""),o.status||"");st.setAttribute("role","status");st.setAttribute("aria-live","polite");
    const siatka=el2("ul","st-mi-siatka");siatka.setAttribute("aria-label",TX.moje);
    for(const i of dane.instrumenty){
      const li=el2("li","st-mi-karta"+(o.nowe&&o.nowe.includes(i.id)?" nowa":""));li.dataset.id=i.id;
      const akcje=el2("div","st-mi-akcje");
      const przyc=(plik,tytul,k,fn)=>{const b=el2("button","przycisk maly st-ikp st-mi-"+k);b.type="button";b.append(ikona(plik));b.title=tytul;
        b.setAttribute("aria-label",tytul+": "+i.nazwa);b.onclick=fn;fok[i.id+":"+k]=b;return b;};
      akcje.append(przyc("gry/graj",TX.posluchaj,"graj",()=>{probka(i.id);for(const x of siatka.children)x.classList.remove("gra");li.classList.add("gra");setTimeout(()=>li.classList.remove("gra"),1300);}),
        przyc("pokretlo",TX.edytuj,"edytuj",()=>{pkZamknijOkno();wczytajDoFormularza(i);fokusWiersza(i.id,".st-nazwa");}),
        przyc("gry/olowek",TX.zmienNazwe,"zmien",()=>oknoNazwa(i)),
        przyc("kopiuj",TX.duplikuj,"kopia",()=>{const k=kopiaInstrumentu(i,false);
          oknoInstrumenty(k?{fokus:k.id+":zmien",status:tt2(TX.kopiaZrobiona,{n:k.nazwa}),nowe:[k.id]}:{fokus:i.id+":kopia",status:refy.komunikat?refy.komunikat.textContent:"",blad:true});}),
        przyc("bin",TX.usun,"usun",()=>pytajOUsuniecie(i,true)));
      li.append(obrazDuzy(i),el2("span","st-mi-nazwa",i.nazwa),akcje);siatka.append(li);
    }
    if(!dane.instrumenty.length){const li=el2("li","st-pusto st-pusto-duzy st-mi-pusto");li.append(ikona("gry/spiewa-tak","st-pusto-ik"),el2("span","",TX.oknoPusto));siatka.append(li);}
    const plik=el2("input");plik.type="file";plik.accept=".json,application/json";plik.hidden=true;plik.tabIndex=-1;
    plik.onchange=()=>{const f=plik.files&&plik.files[0];plik.value="";if(f)wczytajPlik(f);};
    const eks=przyciskIk("przycisk maly st-ikp-t st-mi-eksport","export",TX.eksport);eks.title=TX.eksportOpis;eks.disabled=!dane.instrumenty.length;
    eks.onclick=()=>{eks.disabled=true;eksportuj().then(r=>oknoInstrumenty({fokus:"eksport",status:r.ok?tt2(TX.eksportOk,{plik:r.plik}):TX.eksportBlad,blad:!r.ok}));};
    const imp=przyciskIk("przycisk maly st-ikp-t st-mi-import","import",TX.import);imp.title=TX.importOpis;imp.onclick=()=>plik.click();
    fok.eksport=eks;fok.import=imp;
    const stopka=el2("div","st-mi-stopka");stopka.append(st,eks,imp,plik);   // komunikat z lewej, przy przyciskach pliku: siatka nie skacze
    const box=el2("div","st-mi");box.append(el2("p","okno-wstep",tt2(TX.oknoWstep,{n:dane.instrumenty.length,m:MAKS})),siatka,stopka);
    pkOkno(TX.moje,[box]);
    const cel=fok[o.fokus]||siatka.querySelector("button")||imp;
    cel.focus({preventScroll:true});if(cel.scrollIntoView)cel.scrollIntoView({block:"nearest"});
    return true;
  }
  function wczytajPlik(f){
    const pokaz=(status,blad,nowe)=>oknoInstrumenty({fokus:nowe&&nowe.length?nowe[0]+":edytuj":"import",status,blad,nowe});
    if(f.size>PLIK_MAKS){pokaz(TX.importDuzy,true);return;}
    f.text().then(t=>{const r=importuj(t);pokaz(opisImportu(r),!r.ok||(!r.dodane&&!!r.limit),r.id);},()=>pokaz(TX.importBladOdczytu,true));
  }
  // fokus na przycisku wiersza listy w Studiu (po edycji z okna, po usunięciu z listy); bez wiersza: „Nowy”
  function fokusWiersza(id,sel){
    const li=id&&refy.lista?[...refy.lista.children].find(x=>x.dataset.id===id):null,b=li&&li.querySelector(sel)||refy.nowy;
    if(b){b.focus({preventScroll:true});if(b.scrollIntoView)b.scrollIntoView({block:"nearest"});}
  }
  // pytanie przed usunięciem (wzorzec pkUsun z pakiety.js): „Anuluj” i „Usuń”, fokus na „Anuluj”, Esc, × i pad B = nie usuwaj.
  // zOkna: z okna „Twoje instrumenty” (wraca do niego), inaczej z listy w Studiu (okno się zamyka, fokus na następny wiersz).
  function pytajOUsuniecie(i,zOkna){
    if(!maOkno()){usunInstrument(i.id);return;}
    const nr=dane.instrumenty.indexOf(i),nastepny=()=>dane.instrumenty[Math.min(nr,dane.instrumenty.length-1)]||null;
    const nie=el2("button","przycisk maly st-usun-nie",TX.anulujOkno);nie.type="button";
    const tak=el2("button","przycisk maly glowny st-usun-tak",TX.usun);tak.type="button";
    nie.onclick=()=>{if(zOkna)oknoInstrumenty({fokus:i.id+":usun"});else pkZamknijOkno();};
    tak.onclick=()=>{tak.disabled=nie.disabled=true;if(!zOkna)pkZamknijOkno();
      usunInstrument(i.id);const n=nastepny();
      if(zOkna)oknoInstrumenty({fokus:n?n.id+":usun":"import",status:tt2(TX.usunieto,{n:i.nazwa})});else fokusWiersza(n&&n.id,".st-usun");};
    const rzad=el2("div","st-mi-tak-nie");rzad.append(nie,tak);
    pkOkno(TX.usunTytul,[el2("p","okno-wstep",tt2(TX.usunPytanie,{n:i.nazwa})),rzad]);
    nie.focus({preventScroll:true});
  }
  // zmiana nazwy w oknie: formularz (Enter w polu = „Zmień nazwę”; klawisze pod oknem zatrzymuje nasłuch #okno z pakiety.js,
  // więc Enter działa przez submit formularza), pusta nazwa zostaje w oknie z komunikatem
  function oknoNazwa(i){
    const f=el2("form","st-mi-form");f.noValidate=true;
    const et=el2("label","st-gala-et",TX.nowaNazwa);et.htmlFor="studioNowaNazwa";
    const pole=el2("input","st-nazwa-wejscie");pole.id="studioNowaNazwa";pole.type="text";pole.maxLength=24;pole.value=i.nazwa;pole.autocomplete="off";pole.spellcheck=false;
    const st=el2("p","st-mi-status blad","");st.setAttribute("role","status");st.setAttribute("aria-live","polite");
    const nie=el2("button","przycisk maly",TX.anulujOkno);nie.type="button";nie.onclick=()=>oknoInstrumenty({fokus:i.id+":zmien"});
    const tak=el2("button","przycisk maly glowny st-nazwa-tak",TX.zmienNazwe);tak.type="submit";
    f.onsubmit=e=>{e.preventDefault();const n=pole.value.trim();
      if(!n){st.textContent=TX.bezNazwy;pole.focus();return;}
      const ok=zmienNazwe(i.id,n);
      oknoInstrumenty({fokus:i.id+":zmien",status:ok?tt2(TX.zmienionoNazwe,{n:n.slice(0,24)}):TX.brakMiejsca,blad:!ok});};
    const rzad=el2("div","st-mi-tak-nie");rzad.append(nie,tak);
    f.append(et,pole,st,rzad);
    pkOkno(TX.zmienNazwe,[f]);
    pole.focus({preventScroll:true});pole.select();
  }

  // ---- pętla testowa (port pętli z rf-25: nuty na siatce 8 × 16 przez szynę podglądu; nuta na kilka kroków = JEDNA trzymana) ----
  // Czas liczony na zegarze AudioContext (nie setTimeout per krok): `seqCzas(i)` = chwila globalnego kroku i, 16-tki ze swingiem
  // (parzysty→nieparzysty krok rozciągnięty, nieparzysty→parzysty ściśnięty, para zawsze = 2 kroki). Planowanie z wyprzedzeniem
  // .35 s co 40 ms jak w grajPodglad (biblioteka.js); zmiana tempa w trakcie przelicza `start`, żeby głowica nie skoczyła.
  const SEQ_KROKI=16,SEQ_NUTY=[72,71,69,67,65,64,62,60];   // C-dur: C5 u góry … C4 u dołu
  const WZORY=[
    ["melodia",[[60,0,2],[64,2,1],[67,3,1],[72,4,2],[71,6,1],[67,7,1],[69,8,2],[65,10,1],[69,11,1],[67,12,3],[64,15,1]]],
    ["arpeggio",[[60,0,1],[64,1,1],[67,2,1],[72,3,1],[67,4,1],[64,5,1],[60,6,1],[64,7,1],[65,8,1],[69,9,1],[72,10,1],[69,11,1],[67,12,1],[64,13,1],[62,14,1],[60,15,1]]],
    ["skoczna",[[60,0,1],[67,1,1],[60,2,1],[67,3,1],[69,4,1],[72,5,1],[69,6,1],[67,7,1],[65,8,1],[64,9,1],[65,10,1],[67,11,1],[64,12,1],[62,13,1],[60,14,2]]],
    ["dlugie",[[60,0,4],[64,4,4],[67,8,4],[72,12,4]]],
    ["akordy",[[60,0,4],[64,0,4],[67,0,4],[62,4,4],[65,4,4],[69,4,4],[64,8,4],[67,8,4],[71,8,4],[60,12,4],[64,12,4],[67,12,4]]]];
  const WZ_TX={melodia:"wzMelodia",arpeggio:"wzArpeggio",skoczna:"wzSkoczna",dlugie:"wzDlugie",akordy:"wzAkordy"};
  const seq={nuty:[],tempo:120,swing:0,gra:false,start:0,nast:0,krok:-1,timer:0,raf:0,brzmi:[],glosy:new Set(),drag:null,pid:null,kom:{},klaw:{},wzor:""};
  const seqKoniec=n=>Math.min(n.start+n.len-1,SEQ_KROKI-1);
  const seqNutaW=(m,k)=>seq.nuty.find(n=>n.m===m&&k>=n.start&&k<=seqKoniec(n))||null;
  const seqWyczyscZakres=(m,od,do_,zostaw)=>{seq.nuty=seq.nuty.filter(n=>n===zostaw||n.m!==m||seqKoniec(n)<od||n.start>do_);};
  const seqBaza=()=>60/seq.tempo/4,seqCykl=()=>SEQ_KROKI*seqBaza();
  function seqCzas(i){const b=seqBaza(),n=Math.floor(i/SEQ_KROKI),k=i-n*SEQ_KROKI;return seq.start+n*SEQ_KROKI*b+b*(k+(k%2?seq.swing/100:0));}
  function seqPrzelicz(fn){   // zmiana tempa/swingu w trakcie: ta sama pozycja w cyklu pod nowym zegarem
    if(!seq.gra||!pod||!pod.zywy){fn();return;}
    const teraz=pod.teraz(),u=(teraz-seq.start)/seqCykl();fn();seq.start=teraz-u*seqCykl();}
  function seqOdswiez(){
    const mapa={};
    for(const n of seq.nuty){const e=seqKoniec(n),jedna=n.start===e,w=mapa[n.m]||(mapa[n.m]={});
      for(let k=n.start;k<=e;k++)w[k]=jedna?"single":k===n.start?"start":k===e?"end":"mid";}
    for(const key in seq.kom){const c=seq.kom[key],rola=mapa[c.dataset.m]&&mapa[c.dataset.m][c.dataset.k];
      c.classList.toggle("on",!!rola);for(const r of ["single","start","mid","end"])c.classList.toggle("seg-"+r,rola===r);}
    if(refy.wzory)for(const b of refy.wzory.children)b.setAttribute("aria-pressed",String(b.dataset.v===seq.wzor));
  }
  function seqUstawWzor(id){const w=WZORY.find(x=>x[0]===id);seq.wzor=w?id:"";seq.nuty=w?w[1].map(a=>({m:a[0],start:a[1],len:a[2]})):[];seqOdswiez();}
  function seqGlowica(k){
    if(k!==seq.krok){seq.krok=k;for(const key in seq.kom){const c=seq.kom[key];c.classList.toggle("glowica",+c.dataset.k===k);}}
    const gra={};if(k>=0)for(const n of seq.nuty)if(n.start<=k&&k<=seqKoniec(n))gra[n.m]=true;
    for(const m in seq.klaw)seq.klaw[m].classList.toggle("gra",!!gra[m]||trzymane.has("s"+m));}
  function seqPlanuj(){
    const p=pod;if(!p||!p.zywy||!seq.gra)return;
    const teraz=p.teraz(),hor=teraz+.35;
    while(seqCzas(seq.nast)<hor){
      const i=seq.nast++,k=i%SEQ_KROKI,t0=seqCzas(i);
      if(t0<teraz-.05)continue;   // karta w tle zgubiła takt: krok przepada, nie gra z opóźnieniem
      for(const n of seq.nuty){if(n.start!==k)continue;
        if(podgladNieaktualny)zarejestrujPodglad();
        const t1=seqCzas(i+n.len)-.03;let g;try{g=p.glos("w-podglad");}catch(e){continue;}
        g.ustaw(n.m,.7,0,t0);g.spiewaj(true,t0);g.spiewaj(false,t1);seq.glosy.add(g);seq.brzmi.push({m:n.m,t0,t1});
        setTimeout(()=>{seq.glosy.delete(g);try{g.zniszcz();}catch(e){}},Math.max(0,(t1-teraz+1.6)*1000));}
    }
    if(seq.brzmi.length>64)seq.brzmi=seq.brzmi.filter(n=>n.t1>teraz);
  }
  function seqKlatka(){seq.raf=0;if(!seq.gra||!pod||!pod.zywy)return;
    const t=pod.teraz()-seq.start,b=seqBaza(),cykl=seqCykl(),r=t-Math.floor(t/cykl)*cykl;let k=0;
    for(let j=SEQ_KROKI-1;j>=0;j--){if(r>=b*(j+(j%2?seq.swing/100:0))){k=j;break;}}
    seqGlowica(t<0?-1:k);seq.raf=requestAnimationFrame(seqKlatka);}
  function seqStart(){
    piosenkaStop();const p=szyna();if(!p)return;const c=p.kontekst();
    if(c.state!=="running"){c.resume().then(()=>{if(!seq.gra)seqStart();}).catch(()=>{});return;}
    seq.gra=true;seq.start=p.teraz()+.08;seq.nast=0;seq.brzmi=[];
    if(refy.zapetl){ustawPrzyciskIk(refy.zapetl,"stop",TX.zatrzymaj);refy.zapetl.classList.add("gra");refy.zapetl.setAttribute("aria-pressed","true");}
    seqPlanuj();seq.timer=setInterval(seqPlanuj,40);seq.raf=requestAnimationFrame(seqKlatka);
  }
  function seqStop(){
    if(seq.timer){clearInterval(seq.timer);seq.timer=0;}if(seq.raf){cancelAnimationFrame(seq.raf);seq.raf=0;}
    if(!seq.gra&&!seq.glosy.size)return;seq.gra=false;seq.brzmi=[];
    for(const g of seq.glosy){try{g.spiewaj(false);}catch(e){}setTimeout(()=>{try{g.zniszcz();}catch(e){}},700);}seq.glosy.clear();
    if(refy.zapetl){ustawPrzyciskIk(refy.zapetl,"gry/graj",TX.zapetl);refy.zapetl.classList.remove("gra");refy.zapetl.setAttribute("aria-pressed","false");}
    seqGlowica(-1);
  }
  // rysowanie: pusta komórka = nowa nuta na 1 krok, przeciągnięcie w bok = jedna długa; nuta = usuń (przeciągnięcie usuwa dalej)
  function seqRysowanie(siatka){
    const kom=(x,y)=>{const e=document.elementFromPoint(x,y);return e&&e.closest?e.closest(".st-seq-c"):null;};
    siatka.addEventListener("pointerdown",e=>{const c=e.target&&e.target.closest&&e.target.closest(".st-seq-c");if(!c)return;
      if(e.pointerType==="mouse"&&e.button!==0)return;e.preventDefault();
      const m=+c.dataset.m,k=+c.dataset.k,traf=seqNutaW(m,k);
      if(traf){seq.nuty=seq.nuty.filter(n=>n!==traf);seq.drag={tryb:"erase"};}
      else{const n={m,start:k,len:1};seq.nuty.push(n);seq.drag={tryb:"draw",n,m,kotwica:k};}
      seq.wzor="";seqOdswiez();seq.pid=e.pointerId;try{siatka.setPointerCapture(e.pointerId);}catch(x){}});
    siatka.addEventListener("pointermove",e=>{if(seq.pid!==e.pointerId||!seq.drag)return;
      const c=kom(e.clientX,e.clientY);if(!c)return;const m=+c.dataset.m,k=+c.dataset.k;
      if(seq.drag.tryb==="erase"){const t=seqNutaW(m,k);if(t){seq.nuty=seq.nuty.filter(n=>n!==t);seqOdswiez();}return;}
      if(m!==seq.drag.m)return;const od=Math.min(seq.drag.kotwica,k),do_=Math.max(seq.drag.kotwica,k);
      seq.drag.n.start=od;seq.drag.n.len=do_-od+1;seqWyczyscZakres(m,od,do_,seq.drag.n);seqOdswiez();});
    const koniec=e=>{if(seq.pid!==e.pointerId)return;seq.pid=null;seq.drag=null;};
    for(const ev of ["pointerup","pointercancel","lostpointercapture"])siatka.addEventListener(ev,koniec);
    siatka.addEventListener("contextmenu",e=>e.preventDefault());
  }

  // ---- odsłuch w piosence: melodia wybranej piosenki (partia 0) tym instrumentem jednym głosem, jak żaba w grze (poziom z wysokości
  //      nuty jak w grajPodglad), podkład = reszta partii i tło instrumentem podkładu z ustawień przez szynę podglądu; od pierwszej
  //      nuty melodii, do 20 s. Receptura jest brana przy starcie (jeden głos na całą frazę): pokrętło w trakcie = zatrzymaj i puść znów. ----
  const pios={gra:false,id:null,timer:0,raf:0,glos:null,brzmi:[],koniec:1,start:0,spb:1};
  function piosenki(){try{return (S.piosenki||[]).filter(p=>p&&p.partie&&p.partie[0]&&Array.isArray(p.partie[0].nuty)&&p.partie[0].nuty.length);}catch(e){return [];}}
  function odswiezPiosenki(){const s=refy.piosenki;if(!s)return;const L2=piosenki();let akt=s.value;
    try{if(!akt&&typeof piosenka==="function"&&piosenka())akt=piosenka().id;}catch(e){}
    s.replaceChildren();for(const p of L2){const o=el2("option","",p.tytul||p.id);o.value=p.id;s.append(o);}
    if(L2.some(p=>p.id===akt))s.value=akt;s.disabled=!L2.length;if(refy.posluchaj)refy.posluchaj.disabled=!L2.length;
    if(refy.piosenkaInfo)refy.piosenkaInfo.textContent=L2.length?TX.piosenkaOpis:TX.brakPiosenek;}
  function piosenkaStart(){
    piosenkaStop();seqStop();const p=piosenki().find(x=>x.id===(refy.piosenki&&refy.piosenki.value));if(!p)return;
    const hd=szyna();if(!hd)return;const c=hd.kontekst();
    if(c.state!=="running"){c.resume().then(()=>{if(!pios.gra)piosenkaStart();}).catch(()=>{});return;}
    try{if(typeof Glos.stopProbka==="function")Glos.stopProbka();}catch(e){}
    const tempo=(+p.tempo||120)*((typeof S!=="undefined"&&S.ust&&+S.ust.tempo)||100)/100,spb=60/Math.max(10,tempo);
    const melAll=p.partie[0].nuty,od=Math.max(0,Math.floor(melAll[0].t)),koniecBeat=Math.min(+p.koniec||Infinity,od+20/spb);
    const mel=melAll.filter(n=>n.t>=od-1e-6&&n.t<koniecBeat).map(n=>({m:n.m,t:n.t-od,d:n.d}));if(!mel.length)return;
    const pod2=[];if(refy.zPodkladem&&refy.zPodkladem.checked){
      for(let i=1;i<p.partie.length;i++)for(const n of (p.partie[i]&&p.partie[i].nuty)||[])if(n.t>=od-1e-6&&n.t<koniecBeat)pod2.push({m:n.m,t:n.t-od,d:n.d,poziom:.5});
      for(const n of p.tlo||[])if(n.t>=od-1e-6&&n.t<koniecBeat)pod2.push({m:n.m,t:n.t-od,d:n.d,poziom:.35});pod2.sort((a,b)=>a.t-b.t);}
    let lo=Infinity,hi=-Infinity;for(const n of mel){lo=Math.min(lo,n.m);hi=Math.max(hi,n.m);}
    const poz=m=>hi>lo?(m-lo)/(hi-lo):.5,instrPod=(typeof S!=="undefined"&&S.ust&&S.ust.instrument)||"trabka";
    zarejestrujPodglad();let g;try{g=hd.glos("w-podglad");}catch(e){return;}const start=hd.teraz()+.12;
    Object.assign(pios,{gra:true,id:p.id,glos:g,brzmi:[],start,spb,koniec:koniecBeat-od,im:0,ip:0});
    const planuj=()=>{const teraz=hd.teraz(),hor=teraz+.4;
      while(pios.im<mel.length&&start+mel[pios.im].t*spb<hor){const n=mel[pios.im++],t0=start+n.t*spb,t1=start+(n.t+n.d)*spb;if(t0<teraz-.05)continue;
        g.ustaw(n.m,.35+.5*poz(n.m),0,t0);g.spiewaj(true,t0);g.spiewaj(false,Math.max(t0+.06,t1-.04));pios.brzmi.push({m:n.m,t0,t1});}
      while(pios.ip<pod2.length&&start+pod2[pios.ip].t*spb<hor){const n=pod2[pios.ip++],t0=start+n.t*spb;if(t0<teraz-.05)continue;
        try{hd.nuta(typeof barwaPodkladu==="function"?barwaPodkladu(instrPod,n.m):instrPod,n.m,t0-teraz,Math.max(.1,n.d*spb*.95),n.poziom);}catch(e){}}
      if(pios.brzmi.length>64)pios.brzmi=pios.brzmi.filter(n=>n.t1>teraz);};
    planuj();pios.timer=setInterval(planuj,40);
    const klatka=()=>{pios.raf=0;if(!pios.gra)return;const beat=(hd.teraz()-start)/spb;
      if(refy.postep)refy.postep.firstChild.style.width=Math.max(0,Math.min(100,beat/pios.koniec*100))+"%";
      if(beat>pios.koniec+.6){piosenkaStop();return;}pios.raf=requestAnimationFrame(klatka);};
    pios.raf=requestAnimationFrame(klatka);
    if(refy.posluchaj){ustawPrzyciskIk(refy.posluchaj,"stop",TX.zatrzymaj);refy.posluchaj.classList.add("gra");refy.posluchaj.setAttribute("aria-pressed","true");}
    if(refy.postep)refy.postep.hidden=false;
  }
  function piosenkaStop(){
    if(pios.timer){clearInterval(pios.timer);pios.timer=0;}if(pios.raf){cancelAnimationFrame(pios.raf);pios.raf=0;}
    if(!pios.gra)return;pios.gra=false;pios.brzmi=[];
    const g=pios.glos;pios.glos=null;if(g){try{g.spiewaj(false);}catch(e){}setTimeout(()=>{try{g.zniszcz();}catch(e){}},900);}
    if(refy.posluchaj){ustawPrzyciskIk(refy.posluchaj,"gry/graj",TX.posluchajPiosenki);refy.posluchaj.classList.remove("gra");refy.posluchaj.setAttribute("aria-pressed","false");}
    if(refy.postep){refy.postep.hidden=true;refy.postep.firstChild.style.width="0%";}
  }

  // ---- dopasowanie kolumny lampy (jak `_fit` w rf-25c): `--st-h` i `--st-pasek-h` dla przyklejenia paska i kolumny, `--st-lampa` =
  //      największa tarcza, przy której legenda, pulpit, klawiatura i lista (min. 190 px, 10-17: miejsce na pustą listę z żabą) mieszczą się w kolumnie bez przewijania ----
  function dopasuj(){
    const t=refy.tresc,b=refy.bok;if(!t||!b||!naEkranie())return;
    const H=t.clientHeight,ph=refy.pasek?refy.pasek.offsetHeight:0;
    t.style.setProperty("--st-h",H+"px");t.style.setProperty("--st-pasek-h",ph+"px");
    if(getComputedStyle(b).position!=="sticky"){b.style.removeProperty("--st-lampa");return;}
    const lampaStale=refy.lampa&&refy.szklo?Math.max(0,refy.lampa.offsetHeight-refy.szklo.offsetHeight):150;
    const stale=lampaStale+(refy.klaw?refy.klaw.offsetHeight:92)+(refy.spiew?refy.spiew.pole.offsetHeight+8:0)+20+190;
    const s=Math.max(140,Math.min(b.clientWidth-24,H-ph-20-stale));
    b.style.setProperty("--st-lampa",Math.round(s)+"px");
    if(refy.probka&&!refy.probka.kanwa.hidden)rysujPrzebieg(maProbke(P)?StudioProbki.wPamieci(P.probka.id):null);   // kanwa ma piksele, nie procenty
    odswiezSpiew();
  }

  // ---- ikony i kafle (10-17 wieczór): filcowe ikony panelu/gry jak ikonaFilc() w zabi-chor.js, rysunki fal, krzywych filtra
  //      i wzorów pętli jako małe SVG w stylu filcu (grafitowy kontur, kolorowy pasek, biały ścieg) ----
  const IKONY_APP="../assets/icons/",IKONY_GRY="../assets/icons/gry/";
  const srcIkony=plik=>plik.startsWith("gry/")?IKONY_GRY+plik.slice(4)+".webp":IKONY_APP+plik+".png";
  function ikona(plik,klasa){const i=el2("img",klasa||"st-ik");i.alt="";i.setAttribute("aria-hidden","true");i.draggable=false;i.decoding="async";i.src=srcIkony(plik);return i;}
  // przycisk z ikoną i podpisem (podpis w <span>, żeby zmiana tekstu nie zjadała ikony)
  function przyciskIk(klasa,plik,tekst){const b=el2("button",klasa);b.type="button";b.append(ikona(plik),el2("span","st-ik-t",tekst));return b;}
  function ustawPrzyciskIk(b,plik,tekst){const i=b.querySelector("img"),t=b.querySelector(".st-ik-t");if(i)i.src=srcIkony(plik);if(t)t.textContent=tekst;}
  const SVGNS="http://www.w3.org/2000/svg";
  function filcSvg(d,kolor,vb){   // jeden pasek filcu: kontur, kolor, ścieg
    const s=document.createElementNS(SVGNS,"svg");s.setAttribute("viewBox",vb||"0 0 48 28");s.setAttribute("aria-hidden","true");s.setAttribute("focusable","false");s.classList.add("st-rys");
    for(const [st,w,da] of [["#211f1d",7.4,""],[kolor,4.4,""],["rgba(255,255,255,.9)",1,"2 2.2"]]){const p=document.createElementNS(SVGNS,"path");p.setAttribute("d",d);
      p.setAttribute("fill","none");p.setAttribute("stroke",st);p.setAttribute("stroke-width",w);p.setAttribute("stroke-linecap","round");p.setAttribute("stroke-linejoin","round");
      if(da)p.setAttribute("stroke-dasharray",da);s.append(p);}
    return s;}
  const FALA_RYS={sawtooth:["M4 22 L17 6 V22 L30 6 V22 L44 7","#ec1a83"],square:["M4 22 V6 H14 V22 H24 V6 H34 V22 H44","#eaa32b"],
    triangle:["M4 21 L11 7 L18 21 L25 7 L32 21 L39 7 L44 15","#6cb33f"],sine:["M4 14 C9 1 15 1 19 14 S29 27 34 14 S41 4 44 9","#3ab0c8"],
    pulse:["M4 22 V6 H8 V22 H19 V6 H23 V22 H34 V6 H38 V22 H44","#3d8fd6"],custom:["M4 17 C7 5 11 4 13 12 S18 25 22 17 S27 3 31 10 S39 24 44 11","#8c5bd6"]};
  const falaSvg=f=>{const r=FALA_RYS[f]||FALA_RYS.sawtooth;return filcSvg(r[0],r[1]);};
  const FILTR_RYS={lowpass:"M4 9 H24 C29 9 31 6 33 9 S37 22 44 23",highpass:"M4 23 C11 22 13 9 15 9 C17 6 19 9 24 9 H44",
    bandpass:"M4 23 C14 22 18 6 24 6 S34 22 44 23",notch:"M4 9 H16 C20 9 22 23 24 23 S28 9 32 9 H44"};
  const filtrSvg=f=>filcSvg(FILTR_RYS[f]||FILTR_RYS.lowpass,"#a6d861");
  // mini-siatka wzoru pętli: każda nuta to różowy pasek w rzędzie swojej wysokości
  function wzorSvg(nuty){const s=document.createElementNS(SVGNS,"svg");s.setAttribute("viewBox","0 0 66 34");s.setAttribute("aria-hidden","true");s.setAttribute("focusable","false");s.classList.add("st-rys");
    const t=document.createElementNS(SVGNS,"rect");t.setAttribute("width","66");t.setAttribute("height","34");t.setAttribute("rx","6");t.setAttribute("fill","#2a2521");s.append(t);
    for(const [m,st,len] of nuty){const y=SEQ_NUTY.indexOf(m);if(y<0)continue;const r=document.createElementNS(SVGNS,"rect");
      r.setAttribute("x",String(1+st*4));r.setAttribute("y",String(1+y*4));r.setAttribute("width",String(len*4-.8));r.setAttribute("height","3.2");r.setAttribute("rx","1.2");r.setAttribute("fill","#ec1a83");s.append(r);}
    return s;}
  // kafle wyboru (grupa radiowa) dla pola `k`: [wartość, nazwa, opis, rysunek()]; mały = rysunek z nazwą bez opisu (2. oscylator)
  function kafle(k,etykieta,opcje,maly){
    const w=el2("div","st-kafle-pole"+(maly?" maly":""));w.dataset.k=k;w.append(el2("span","st-gala-et",etykieta));
    const g=el2("div","st-kafle");g.setAttribute("role","radiogroup");g.setAttribute("aria-label",etykieta);
    const btn={};
    for(const [v,n,opis,rys,tech] of opcje){const b=el2("button","st-kafel");b.type="button";b.setAttribute("role","radio");b.dataset.v=String(v);
      b.title=(opis?n+": "+opis:n)+(tech?" ("+tech+")":"");b.append(rys(),el2("b","",n));if(opis&&!maly)b.append(el2("small","",opis));
      b.onclick=()=>{if(P[k]===v)return;P[k]=v;if(k==="fala"&&v==="custom"&&!P.wt)P.wt=Array.from(E?E.M.sine():new Float32Array(64));
        if(k==="fala"&&E)E.Panele.load(P);odswiez();zmiana();if(!ciagly&&!seq.gra&&!pios.gra)testuj();};
      b.addEventListener("keydown",e=>{const i=opcje.findIndex(o=>o[0]===P[k]),d=e.key==="ArrowRight"||e.key==="ArrowDown"?1:e.key==="ArrowLeft"||e.key==="ArrowUp"?-1:0;
        if(!d)return;e.preventDefault();e.stopPropagation();const o=opcje[(i+d+opcje.length)%opcje.length];btn[String(o[0])].click();btn[String(o[0])].focus();});
      btn[String(v)]=b;g.append(b);}
    const odswiez=()=>{for(const v in btn){const on=v===String(P[k]);btn[v].setAttribute("aria-checked",String(on));btn[v].tabIndex=on?0:-1;}};
    w.append(g);refy.gale[k]={pole:w,odswiez};odswiez();return w;
  }
  // gotowce na start (krok 1): pełne brzmienia, które dziecko od razu słyszy i zmienia dalej
  const STARTERY=[
    ["bas","gry/instr-sub","stBas",{fala:"sawtooth",okt:-1,sub:true,filtr:"lowpass",fMin:200,fMax:1400,q:3,obwF:60,obwFCzas:250,atak:5,zanik:400,podtrzym:60,puszcz:120}],
    ["flet","gry/instr-flet","stFlet",{fala:"triangle",okt:1,filtr:"lowpass",fMin:800,fMax:5000,q:1,atak:60,zanik:300,podtrzym:90,puszcz:220,wib:8}],
    ["robot","gry/instr-robot","stRobot",{fala:"square",filtr:"bandpass",fMin:600,fMax:3000,q:6,rechot:30,przester:4,atak:5,puszcz:80}],
    ["dzwon","gry/instr-dzwon","stDzwon",{fala:"sine",okt:1,osc2:true,fala2:"sine",polton2:19,miks2:40,atak:2,zanik:700,podtrzym:55,puszcz:600,szarp:30,fMax:8000}],
    ["brzek","gry/instr-chiptune","stBrzek",{fala:"pulse",puls:12,filtr:"lowpass",fMin:2000,fMax:8000,atak:2,podtrzym:100,puszcz:40,glide:0}],
    ["kosmos","gry/instr-theremin","stKosmos",{fala:"sine",glide:120,wib:20,atak:150,puszcz:600,fMax:3000,puch:40}],
    ["super","gry/instr-trance","stSuper",{fala:"sawtooth",glosy:5,rozstroj:20,filtr:"lowpass",fMin:600,fMax:6000,q:2,obwF:40,atak:10,puszcz:300}],
    ["wiatr","gry/instr-wiatr","stWiatr",{szum:true,szumQ:12,filtr:"bandpass",fMin:500,fMax:3000,atak:200,puszcz:500}]];
  function wczytajStarter(s){
    edytowany=null;P=swiezy(Object.assign({},s[3],{nazwa:TX[s[2]]}));zapisanyJson="";podgladNieaktualny=true;
    odswiezWidok();odswiezListe();komunikat(tt2(TX.starterOk,{n:TX[s[2]]}));
    if(refy.startery)for(const b of refy.startery.children)b.setAttribute("aria-pressed",String(b.dataset.id===s[0]));
    if(ciagly)odswiezCiagly();else if(!seq.gra&&!pios.gra)testuj();
  }
  // ---- własna grafika: plik z dysku albo upuszczony → kwadrat OBRAZ_BOK px (kadr ze środka) → WebP (PNG, gdy przeglądarka nie umie) ≤ OBRAZ_MAKS ----
  function obrazZPliku(plik){
    return new Promise((ok,zle)=>{
      if(!plik||!/^image\//.test(plik.type||"")){zle("typ");return;}
      const url=URL.createObjectURL(plik),img=new Image();
      img.onload=()=>{try{
        const w=img.naturalWidth,h=img.naturalHeight;if(!w||!h)throw 0;const bok=Math.min(w,h);
        for(const [px,jak] of [[OBRAZ_BOK,.86],[OBRAZ_BOK,.7],[192,.7],[160,.6]]){
          const c=document.createElement("canvas");c.width=c.height=px;const g=c.getContext("2d");g.imageSmoothingQuality="high";
          g.drawImage(img,(w-bok)/2,(h-bok)/2,bok,bok,0,0,px,px);
          let d=c.toDataURL("image/webp",jak);if(!/^data:image\/webp/.test(d))d=c.toDataURL("image/png");
          if(obrazOk(d)){ok(d);return;}}
        zle("duzy");}catch(e){zle("typ");}finally{URL.revokeObjectURL(url);}};
      img.onerror=()=>{URL.revokeObjectURL(url);zle("typ");};img.src=url;});
  }
  function wczytajObraz(plik){
    obrazZPliku(plik).then(d=>{P.obraz=d;odswiezOkladke();zmiana();komunikat(TX.grafikaOk);})
      .catch(pow=>komunikat(pow==="duzy"?TX.grafikaDuza:TX.grafikaZla,true));
  }
  // ---- własna próbka (10-19 wieczór): nagranie z mikrofonu albo plik z dysku ----------------------------------------
  // Bajtami, zapisem i mikrofonem zajmuje się StudioProbki; tutaj jest stan formularza, przebieg na kanwie i komunikaty.
  // Nowa próbka ZAWSZE dostaje nowy id: stare bajty mogą jeszcze należeć do zapisanej wersji tego instrumentu (anulowana
  // edycja ma do czego wrócić) albo do jego kopii, dlatego kasuje je dopiero `probkaUzywana` ze wynikiem „nikt”.
  const BLAD_PROBKI={zgoda:"bProbkaZgoda",brak:"bProbkaBrak",zajetymik:"bProbkaZajetymik",zajete:"bProbkaZajete",
    nieobslugiwane:"bProbkaNieobslugiwane",krotkie:"bProbkaKrotkie",
    cisza:"bProbkaCisza",format:"bProbkaFormat",duzy:"bProbkaDuzy"};
  const bladProbki=k=>komunikat(TX[BLAD_PROBKI[k]]||TX.bProbkaBlad,true);
  // BAJTY IDĄ NA PEŁNĄ SKALĘ (`normalizuj`), ale to nie jest decyzja o głośności: o niej mówi pokrętło Poziom,
  // które dostaje 100 % przy „Wyrównaj poziom” i szczyt oryginału, kiedy ten przełącznik jest wyłączony. Cicho
  // nagrana próbka zostaje więc cicha, jeśli ktoś tak chce, a mimo to nie traci rozdzielczości w PCM16.
  function ustawProbke(w,zrodlo){
    const t=w&&w.dane?StudioProbki.normalizuj(w.dane,w.sr):null;
    if(!t){bladProbki("cisza");return;}
    const stary=P.probka&&P.probka.id,id=StudioProbki.nowyId(),dl=t.dane.length/t.sr;
    P.probka={id,sr:t.sr,dl:t.dane.length,zrodlo:zrodlo==="mikrofon"?"mikrofon":"plik"};
    P.probkaPetla=false;P.probkaOd=DOMYSLNE.probkaOd;P.probkaDo=DOMYSLNE.probkaDo;P.probkaZlep=DOMYSLNE.probkaZlep;
    P.probkaWstecz=false;P.probkaStaly=false;P.probkaCent=0;
    // Wycinek: nagranie z mikrofonu dostaje granice ciszy (między kliknięciem a wzięciem oddechu zawsze coś jest),
    // plik z dysku całość — tam cisza na początku może być częścią dźwięku. W obu wypadkach to ZNACZNIKI, więc
    // da się je przeciągnąć z powrotem na brzegi; bajty zostają całe.
    let a=0,b=dl;
    if(zrodlo==="mikrofon"){const gr=StudioProbki.granice(t.dane,t.sr);if(gr){a=gr.od/t.sr;b=gr.koniec/t.sr;}}
    P.probkaStart=Math.round(a/dl*1000)/10;P.probkaKoniec=Math.round(b/dl*1000)/10;
    const wyrownaj=!refy.probka||!refy.probka.wyrownajC||refy.probka.wyrownajC.checked;
    P.probkaPoziom=wyrownaj?100:Math.max(10,Math.min(200,Math.round(t.szczyt/StudioProbki.SZCZYT*100)));
    // Strój trafia na pół tonu, a resztę odchyłki bierze dostrojenie: inaczej próbka nagrana „pomiędzy” grałaby
    // fałszywie z resztą, a pokrętło nuty skacze po 50 centów i nie ma jak tego dosunąć.
    const r=StudioProbki.wykryjRoot(t.dane.subarray(Math.round(a*t.sr),Math.round(b*t.sr)),t.sr);
    P.probkaRoot=r==null?60:Math.max(24,Math.min(96,Math.round(r*2)/2));
    if(r!=null)P.probkaCent=Math.max(-50,Math.min(50,Math.round((r-P.probkaRoot)*100)));
    // Filtr prosto z fabryki (400–4000 Hz) przykrywa nagranie kołdrą, a dziecko nie wie, czemu „to nie brzmi jak ja”.
    // Otwieramy go TYLKO wtedy, gdy nikt go jeszcze nie ruszał, i mówimy o tym w komunikacie.
    let otwarty=false;
    if(P.fMin===DOMYSLNE.fMin&&P.fMax===DOMYSLNE.fMax&&P.q===DOMYSLNE.q){P.fMin=3000;P.fMax=10000;P.q=.5;otwarty=true;}
    P.szum=false;   // próbka zastępuje oscylatory, więc szum nie ma już czego zastępować
    StudioProbki.zapisz(id,t).catch(()=>{});
    if(stary&&!probkaUzywana(stary))StudioProbki.usun(stary).catch(()=>{});
    odswiezWidok();zmiana();komunikat(otwarty?TX.probkaFiltrOtwarty:TX.probkaGotowa);
    if(!ciagly&&!seq.gra&&!pios.gra)odsluchajProbke();
  }
  function usunProbkeInstr(){
    const stary=P.probka&&P.probka.id;if(!stary)return;
    puść("probka",true);P.probka=null;
    if(!probkaUzywana(stary))StudioProbki.usun(stary).catch(()=>{});
    odswiezWidok();zmiana();komunikat(TX.probkaUsunieta);
  }
  // „Przytnij ciszę” NIE RUSZA BAJTÓW (do 10-20 ruszało): przestawia znaczniki wycinka na granice ciszy, więc
  // da się to cofnąć ręką, a instrument zapisany z poprzednim wycinkiem dalej gra swoje.
  function przytnijProbke(){
    const p=maProbke(P)?StudioProbki.wPamieci(P.probka.id):null;if(!p)return;
    const gr=StudioProbki.granice(p.dane,p.sr),dl=p.dane.length/p.sr;
    if(!gr){bladProbki("cisza");return;}
    ustawWartosc("probkaStart",Math.round(gr.od/p.sr/dl*1000)/10);
    ustawWartosc("probkaKoniec",Math.round(gr.koniec/p.sr/dl*1000)/10);
    odswiezWidok();komunikat(TX.probkaPrzycieta);
  }
  // „Przytnij na stałe”: z bajtów zostaje SAM WYCINEK, więc 12-sekundowe nagranie, z którego grają dwie sekundy,
  // przestaje ważyć 768 kB (a w pliku instrumentów jeszcze o trzecią część więcej w base64). Poziom, kierunek
  // i zlepek zostają nastawami; pętla jest przeliczana na nowe zero.
  function przytnijNaStaleProbke(){
    const p=maProbke(P)?StudioProbki.wPamieci(P.probka.id):null;if(!p)return;
    const w=wycinekProbki(P),t=StudioProbki.wycinek(p,{od:w.a,koniec:w.b});
    if(!t){komunikat(TX.probkaCalosc,true);return;}
    const stary=P.probka.id,id=StudioProbki.nowyId(),dl=t.dane.length/t.sr;
    const petlaOd=P.probkaPetla?Math.max(0,Math.min(99.5,+P.probkaOd||0))/100*w.sek-w.a:0;
    const petlaDo=P.probkaPetla?Math.max(0,Math.min(100,+P.probkaDo||0))/100*w.sek-w.a:0;
    P.probka={id,sr:t.sr,dl:t.dane.length,zrodlo:P.probka.zrodlo};
    P.probkaStart=0;P.probkaKoniec=100;
    if(P.probkaPetla){
      P.probkaOd=Math.max(0,Math.min(99.5,Math.round(petlaOd/dl*1000)/10));
      P.probkaDo=Math.max(.5,Math.min(100,Math.round(petlaDo/dl*1000)/10));
    }
    StudioProbki.zapisz(id,t).catch(()=>{});
    if(!probkaUzywana(stary))StudioProbki.usun(stary).catch(()=>{});
    odswiezWidok();zmiana();komunikat(tt2(TX.probkaPrzycietaStale,{sek:czasProbki(dl)}));
  }
  // Zapis do pliku: TO, CO SŁYCHAĆ — wycinek z poziomem, kierunkiem i zlepkiem, a nie całe bajty. Człowiek
  // zapisuje próbkę, żeby ją komuś dać albo wziąć do innego programu, i spodziewa się tego, co gra instrument.
  function zapiszProbkeWav(){
    if(!maProbke(P))return;
    const ab=StudioProbki.wavEdycji(P.probka.id,edycjaProbki(P));
    if(!ab){bladProbki("blad");return;}
    try{
      const url=URL.createObjectURL(new Blob([ab],{type:"audio/wav"})),a=document.createElement("a");
      a.href=url;a.download="probka-"+P.probka.id+".wav";a.hidden=true;document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),5000);
      komunikat(TX.probkaZapisana);
    }catch(e){bladProbki("blad");}
  }
  function wykryjNuteProbki(){
    const p=maProbke(P)?StudioProbki.wPamieci(P.probka.id):null;if(!p)return;
    const w=wycinekProbki(P);   // z WYCINKA, nie z całości: wykrywa się strój tego, co gra
    const r=StudioProbki.wykryjRoot(p.dane.subarray(Math.round(w.a*p.sr),Math.round(w.b*p.sr)),p.sr);
    if(r==null){komunikat(TX.nutaNieznana,true);return;}
    const pol=Math.max(24,Math.min(96,Math.round(r*2)/2));
    ustawWartosc("probkaRoot",pol);ustawWartosc("probkaCent",Math.max(-50,Math.min(50,Math.round((r-pol)*100))));
    odswiezProbke();komunikat(tt2(TX.nutaWykryta,{n:nazwaNuty(Math.round(P.probkaRoot))}));
  }
  // Odsłuch = ta sama nuta co strój próbki, zagrana instrumentem (z filtrem i obwiednią), nie suche bajty: człowiek
  // ma usłyszeć to, co usłyszy żaba w piosence. Przy „nie przestrajaj” wysokość nic nie znaczy, więc idzie C4.
  function odsluchajProbke(){
    if(!maProbke(P))return;
    puść("probka",true);
    const m=P.probkaStaly?60:Math.round(+P.probkaRoot||60);
    nacisnij("probka",m,refy.probka&&refy.probka.odsluchaj,"gra");
    const w=wycinekProbki(P);
    const ms=Math.min(3200,Math.max(700,Math.round((w.b-w.a)*1000)+300));
    setTimeout(()=>puść("probka",true),ms);
  }
  // Lista mikrofonów. Nazwy są PUSTE, dopóki przeglądarka nie dostała zgody (reguła prywatności, nie błąd), więc
  // do tego czasu podpisujemy je „Mikrofon 1, 2…”. Po pierwszym nagraniu pytamy znowu i podpisy robią się prawdziwe.
  function listaMikrofonow(){
    const w=refy.probka;if(!w||!w.mikC)return;
    StudioProbki.urzadzenia().then(l=>{
      const byl=w.mikC.value;
      w.mikC.replaceChildren();
      const dom=el2("option","",TX.mikrofonDomyslny);dom.value="";w.mikC.append(dom);
      l.forEach((d,i)=>{const o=el2("option","",d.nazwa||(TX.mikrofonNr+(i+1)));o.value=d.id;w.mikC.append(o);});
      w.mikC.value=l.some(d=>d.id===byl)?byl:"";
      w.mikC.hidden=l.length<2&&!byl;   // jeden mikrofon w komputerze: lista nie ma czego wybierać
    }).catch(()=>{});
  }
  const wybranyMikrofon=()=>{const w=refy.probka;return w&&w.mikC?String(w.mikC.value||""):"";};
  // PODSŁUCH: mikrofon otwarty tylko po to, żeby było widać poziom PRZED nagraniem. Nic nie nagrywa.
  function podsluchProbki(){
    const w=refy.probka;if(!w)return;
    if(StudioProbki.podsluchuje()){StudioProbki.stopPodsluch();podsluchWidok(false);return;}
    podsluchWidok(true);
    StudioProbki.podsluch({
      poziom:lv=>{if(w.vu.firstChild)w.vu.firstChild.style.width=Math.round(Math.min(1,lv)*100)+"%";},
      start:()=>{komunikat(TX.podsluchStart);listaMikrofonow();},
      blad:k=>{podsluchWidok(false);bladProbki(k);}},wybranyMikrofon());
  }
  function podsluchWidok(on){
    const w=refy.probka;if(!w)return;
    w.nagrywanie.hidden=!on;
    if(w.podsluchB)w.podsluchB.classList.toggle("gra",!!on);
    if(on)w.czas.textContent=TX.podsluchGra;
    if(!on&&w.vu.firstChild)w.vu.firstChild.style.width="0%";
  }
  function nagrajProbke(){
    const w=refy.probka;if(!w)return;
    if(StudioProbki.nagrywa()){StudioProbki.stop();return;}
    if(!StudioProbki.obslugiwane()){bladProbki("nieobslugiwane");return;}
    for(const k of [...trzymane.keys()])puść(k,true);seqStop();piosenkaStop();
    StudioProbki.stopPodsluch();podsluchWidok(false);
    komunikat("");nagrywanieWidok(true,0,0);
    StudioProbki.nagraj({
      odliczanie:n=>{if(w.czas)w.czas.textContent=n>0?TX.odliczanie+n:TX.teraz;},
      poziom:(lv,sek)=>nagrywanieWidok(true,lv,sek),
      koniec:prob=>{nagrywanieWidok(false,0,0);listaMikrofonow();ustawProbke(prob,"mikrofon");},
      blad:k=>{nagrywanieWidok(false,0,0);bladProbki(k);}},
      {urzadzenie:wybranyMikrofon(),odliczanie:w.odliczajC&&w.odliczajC.checked?3:0});
  }
  function nagrywanieWidok(on,lv,sek){
    const w=refy.probka;if(!w)return;
    w.nagrywanie.hidden=!on;w.akcje.hidden=on;
    if(w.nagrajB)ustawPrzyciskIk(w.nagrajB,on?"stop":"sensor",on?TX.przerwij:TX.nagraj);
    if(on){w.czas.textContent=TX.nagrywanie+" "+(Math.round(sek*10)/10).toFixed(1)+" s";
      w.vu.firstChild.style.width=Math.round(Math.min(1,lv)*100)+"%";}
  }
  function wczytajProbkePliku(plik){
    komunikat(TX.probkaCzeka);
    StudioProbki.zPliku(plik).then(w=>ustawProbke(w,"plik"),k=>bladProbki(typeof k==="string"?k:"blad"));
  }
  const PLIK_DZWIEK=/^(audio\/|video\/ogg$)/;
  const toDzwiek=f=>!!f&&(PLIK_DZWIEK.test(f.type||"")||/\.(wav|mp3|ogg|oga|m4a|aac|flac|opus|weba|webm)$/i.test(f.name||""));
  // przebieg próbki: obwiednia min–max na kolumnę piksela, zacieniowany wycinek, pętla i cztery znaczniki
  const ZNAK_KOLOR={probkaStart:"#f6efe0",probkaKoniec:"#f6efe0",probkaOd:"#eaa32b",probkaDo:"#eaa32b"};
  function rysujPrzebieg(p){
    const w=refy.probka;if(!w||!w.kanwa)return;
    const k=w.kanwa,sz=Math.max(1,Math.min(3,window.devicePixelRatio||1));
    const szer=Math.max(80,Math.round(k.clientWidth||320)),wys=Math.max(40,Math.round(k.clientHeight||84));
    if(k.width!==Math.round(szer*sz)||k.height!==Math.round(wys*sz)){k.width=Math.round(szer*sz);k.height=Math.round(wys*sz);}
    const c=k.getContext("2d");if(!c)return;
    c.setTransform(sz,0,0,sz,0,0);c.clearRect(0,0,szer,wys);
    c.fillStyle="#2a2521";c.fillRect(0,0,szer,wys);
    if(!p||!p.dane.length){c.setTransform(1,0,0,1,0,0);return;}
    const d=p.dane,n=d.length,sr2=wys/2,poz=Math.max(.1,(+P.probkaPoziom||100)/100);
    c.strokeStyle="rgba(255,255,255,.18)";c.lineWidth=1;c.beginPath();c.moveTo(0,sr2);c.lineTo(szer,sr2);c.stroke();
    c.fillStyle="#ec1a83";
    for(let x=0;x<szer;x++){
      const a=Math.floor(x*n/szer),b=Math.max(a+1,Math.floor((x+1)*n/szer));
      let lo=1,hi=-1;for(let i=a;i<b&&i<n;i++){const v=d[i];if(v<lo)lo=v;if(v>hi)hi=v;}
      if(hi<lo)continue;
      const y1=sr2-Math.max(-1,Math.min(1,hi*poz))*sr2*.92,y2=sr2-Math.max(-1,Math.min(1,lo*poz))*sr2*.92;
      c.fillRect(x,y1,1,Math.max(1,y2-y1));
    }
    // Wycinek i pętla NA przebiegu, nie pod nim: głośna próbka zamalowuje całą kanwę, więc zacieniowane jest to,
    // co NIE zagra — widać wtedy, który kawałek dźwięku zostanie, kiedy trzymasz nutę.
    const wyc=wycinekProbki(P),sek=wyc.sek;
    if(sek>0){
      const px=t=>Math.max(0,Math.min(szer,t/sek*szer));
      c.fillStyle="rgba(30,26,23,.74)";
      c.fillRect(0,0,px(wyc.a),wys);c.fillRect(px(wyc.b),0,szer-px(wyc.b),wys);
      const znaki=[["probkaStart",wyc.a],["probkaKoniec",wyc.b]];
      if(P.probkaPetla){
        const pe=petlaProbki();
        c.fillStyle="rgba(234,163,43,.16)";c.fillRect(px(pe.a),0,px(pe.b)-px(pe.a),wys);
        c.fillStyle="#eaa32b";c.fillRect(px(pe.a),0,px(pe.b)-px(pe.a),3);c.fillRect(px(pe.a),wys-3,px(pe.b)-px(pe.a),3);
        znaki.push(["probkaOd",pe.a],["probkaDo",pe.b]);
      }
      for(const [kt,t] of znaki){
        const x=Math.max(1,Math.min(szer-1,px(t)));
        c.strokeStyle=ZNAK_KOLOR[kt];c.lineWidth=2;c.beginPath();c.moveTo(x,0);c.lineTo(x,wys);c.stroke();
        c.fillStyle=ZNAK_KOLOR[kt];                  // uchwyt: trójkąt u góry, żeby było co złapać myszą
        c.beginPath();c.moveTo(x-5,0);c.lineTo(x+5,0);c.lineTo(x,8);c.closePath();c.fill();
      }
      if(P.probkaWstecz){                            // strzałka „gra wstecz”, bo przebieg zostaje normalny
        c.fillStyle="rgba(255,255,255,.6)";c.font="700 10px "+(getComputedStyle(k).fontFamily||"sans-serif");
        c.textAlign="right";c.fillText("◀ "+TX.probkaWsteczKrotko,szer-6,wys-7);c.textAlign="left";
      }
    }
    c.setTransform(1,0,0,1,0,0);
  }
  // Świeżo włączona pętla staje W ŚRODKU WYCINKA, a nie na 10–60 % całego nagrania: znacznik pętli poza
  // wycinkiem i tak nic nie znaczy (jest przycinany), więc pokrętła pokazywałyby liczby, których nie słychać.
  function petlaWlaczona(on){
    if(!on||!maProbke(P))return;
    const wyc=wycinekProbki(P),sek=wyc.sek;if(!(sek>0))return;
    const a=+P.probkaOd||0,b=+P.probkaDo||0,lewo=wyc.a/sek*100,prawo=wyc.b/sek*100;
    if(b-a>.5&&a>=lewo-1e-6&&b<=prawo+1e-6)return;   // człowiek już ją gdzieś ustawił w wycinku — zostaje
    P.probkaOd=Math.round((lewo+(prawo-lewo)*.25)*10)/10;
    P.probkaDo=Math.round((lewo+(prawo-lewo)*.75)*10)/10;
    for(const k of ["probkaOd","probkaDo"]){const o=refy.gale[k];if(o)o.odswiez();}
  }
  // pętla w sekundach, przycięta do wycinka: znacznik pętli poza wycinkiem nic nie znaczy
  function petlaProbki(){
    const wyc=wycinekProbki(P),sek=wyc.sek;
    let a=Math.max(0,Math.min(100,+P.probkaOd||0))/100*sek,b=Math.max(0,Math.min(100,+P.probkaDo||0))/100*sek;
    a=Math.max(wyc.a,Math.min(wyc.b,a));b=Math.max(a,Math.min(wyc.b,b));
    return {a,b};
  }
  // Przeciąganie znaczników: łapiemy najbliższy w promieniu 13 px. Pętla jest sprawdzana PRZED wycinkiem, bo jej
  // znaczniki leżą w środku i inaczej nie dałoby się ich złapać tam, gdzie stykają się z jego brzegiem.
  function znacznikProbki(x,szer){
    const wyc=wycinekProbki(P),sek=wyc.sek;if(!(sek>0))return null;
    const lista=[];
    if(P.probkaPetla){const pe=petlaProbki();lista.push(["probkaOd",pe.a],["probkaDo",pe.b]);}
    lista.push(["probkaStart",wyc.a],["probkaKoniec",wyc.b]);
    let naj=null,najD=14;
    for(const [kl,t] of lista){const dd=Math.abs(t/sek*szer-x);if(dd<najD){najD=dd;naj=kl;}}
    return naj;
  }
  // Najmniejszy odstęp między znacznikami, liczony W CZASIE, nie w procentach: 0,5 % trzysekundowego nagrania
  // to 15 ms, czyli mniej niż MIN_PROBEK — wycinek dałby trzask, a wiersz stanu „0.0 s”.
  function minLuka(){
    const sek=probkaSek(P);
    return sek>0?Math.max(.5,Math.ceil(StudioProbki.MIN_PROBEK/StudioProbki.SR/sek*1000)/10):.5;
  }
  function ciagnijZnacznik(kl,x,szer){
    const sek=probkaSek(P);if(!(sek>0))return;
    let pct=Math.max(0,Math.min(100,Math.round(x/szer*1000)/10));
    const g=k2=>Math.max(0,Math.min(100,+P[k2]||0)),m=minLuka();
    if(kl==="probkaStart")pct=Math.min(pct,g("probkaKoniec")-m);
    else if(kl==="probkaKoniec")pct=Math.max(pct,g("probkaStart")+m);
    else if(kl==="probkaOd")pct=Math.max(g("probkaStart"),Math.min(pct,Math.min(g("probkaDo")-m,g("probkaKoniec")-m)));
    else if(kl==="probkaDo")pct=Math.min(g("probkaKoniec"),Math.max(pct,Math.max(g("probkaOd")+m,g("probkaStart")+m)));
    ustawWartosc(kl,Math.max(0,Math.min(100,pct)));
  }
  function odswiezProbke(){
    const w=refy.probka;if(!w)return;
    const ma=maProbke(P),p=ma?StudioProbki.wPamieci(P.probka.id):null;
    w.pusto.hidden=ma;w.kanwa.hidden=!ma;w.narzedzia.hidden=!ma;w.siatka.hidden=!ma;
    if(w.info)w.info.hidden=!ma;
    w.stan.textContent=!ma?"":(p?opisProbki():TX.probkaCzeka);
    for(const b of [w.odsluchaj,w.przytnijB,w.stalyB,w.zapiszB,w.usunB,w.wykryjB])if(b)b.disabled=!p;
    if(w.nagrajB)w.nagrajB.disabled=false;
    rysujPrzebieg(p);
  }
  // Wiersz stanu mówi to, czego nie widać na pokrętłach: skąd próbka, ile trwa WYCINEK (bo to on gra) na tle
  // całości, i którą nutę słychać — albo że nic nie przestraja.
  // sekundy po ludzku: krótki wycinek w milisekundach, bo „0.0 s” wygląda jak awaria, a nie jak 15 ms
  const czasProbki=s=>s<1?Math.round(s*1000)+" ms":(Math.round(s*10)/10).toFixed(1)+" s";
  function opisProbki(){
    const wyc=wycinekProbki(P),cal=wyc.sek,d1=czasProbki(cal);
    const dl=Math.abs(wyc.b-wyc.a-cal)<.05?d1:tt2(TX.probkaZcalosci,{wyc:czasProbki(wyc.b-wyc.a),cal:d1});
    const cent=Math.round(+P.probkaCent||0);
    const nuta=P.probkaStaly?TX.probkaBezStroju
      :tt2(TX.probkaNuteSlychac,{nuta:nazwaNuty(Math.round(+P.probkaRoot||60))})+(cent?(cent>0?" +":" ")+cent+" ct":"");
    return tt2(TX.probkaStan,{zrodlo:P.probka.zrodlo==="mikrofon"?TX.zrodloMik:TX.zrodloPlik,dl,nuta})
      +(P.probkaWstecz?" · "+TX.probkaWsteczKrotko:"");
  }

  // okładka w pasku: grafika gracza albo rysunek obecnej fali; pokazuje / chowa „Usuń grafikę”
  function odswiezOkladke(){const o=refy.okladka;if(!o)return;
    const klucz=P.obraz?"o:"+P.obraz.length+P.obraz.slice(-24):"f:"+(P.szum?"szum":P.fala);
    if(o.dataset.klucz!==klucz){o.dataset.klucz=klucz;const w=o.querySelector(".st-okladka-w");w.replaceChildren();
      if(P.obraz){const i=el2("img","st-okladka-img");i.alt="";i.src=P.obraz;w.append(i);}else w.append(P.szum?filcSvg(FALA_RYS.custom[0],"#c9bfa9"):falaSvg(P.fala));
      o.classList.toggle("ma",!!P.obraz);}
    if(refy.usunObraz)refy.usunObraz.hidden=!P.obraz;}
  // miniatura w liście: grafika albo fala instrumentu na grafitowym kafelku
  function miniatura(i){const m=el2("span","st-mini");m.setAttribute("aria-hidden","true");
    if(i.p&&i.p.obraz){const im=el2("img");im.alt="";im.src=i.p.obraz;m.append(im);}else m.append(falaSvg(i.p&&i.p.szum?"custom":i.p&&i.p.fala));return m;}

  // ---- budowa ekranu ----
  // karta modułu: filcowa ikona, numer, tytuł, kostka (losuje tylko ten moduł), siatka pokręteł, gniazdo płaskiego ekranu CRT
  const MOD_IKONA={osc:"sinus",probka:"gry/glosnik-2",filter:"suwak",env:"stoper",char:"gry/spiewa-tak",test:"odswiez"};
  function modul(klucz,tytul,nr,zawartosc,edytor,bezKostki){
    const d=el2("details","st-modul");d.open=true;d.dataset.modul=klucz;
    const s=el2("summary","");s.append(ikona(MOD_IKONA[klucz]||"sinus","st-modul-ik"),el2("span","st-modul-nr",nr),el2("span","st-modul-t",tytul));
    if(!bezKostki){const r=el2("button","st-los");r.append(ikona("kostka"));r.type="button";r.title=TX.losujModul;r.setAttribute("aria-label",TX.losujModul+": "+tytul);
      r.onclick=e=>{e.preventDefault();e.stopPropagation();losujModul(klucz);odswiezWidok();if(ciagly)odswiezCiagly();else if(!seq.gra&&!pios.gra)testuj();};s.append(r);}
    d.append(s);
    if(zawartosc&&zawartosc.length){const siatka=el2("div","st-siatka");siatka.append(...zawartosc);d.append(siatka);}
    if(edytor){const slot=el2("div","st-edytor");slot.dataset.editor=edytor;slot.hidden=true;d.append(slot);refy.sloty[edytor]=slot;}
    return d;
  }
  // karta „02 Próbka”: wejście (mikrofon z listy i podsłuchem, plik), przebieg z czterema przeciąganymi
  // znacznikami, narzędzia i pokrętła. Pokrętła idą przez `gala()`, więc mają klawiaturę, kółko, wpisywanie
  // liczby i czyszczenie przy imporcie za darmo, jak każda inna gałka Studia.
  function kartaProbki(){
    const w=el2("div","st-probka");
    w.append(el2("p","st-hint st-probka-opis",TX.probkaOpis));
    const akcje=el2("div","st-probka-akcje");
    const plik=el2("input");plik.type="file";plik.accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac,.opus";plik.hidden=true;plik.tabIndex=-1;
    plik.onchange=()=>{const f=plik.files&&plik.files[0];plik.value="";if(f)wczytajProbkePliku(f);};
    // Wybór mikrofonu stoi w tym samym wierszu, co „Nagraj”: to jedna decyzja („czym i jak nagrać”).
    const mikC=el2("select","lista st-probka-mik");mikC.setAttribute("aria-label",TX.mikrofon);mikC.title=TX.mikrofonOpis;mikC.hidden=true;
    mikC.onchange=()=>{if(StudioProbki.podsluchuje()){StudioProbki.stopPodsluch();podsluchWidok(false);}};
    const podsluchB=przyciskIk("przycisk st-ikp-t st-probka-podsluch","gry/glosnik-2",TX.podsluch);
    podsluchB.title=TX.podsluchOpis;podsluchB.onclick=podsluchProbki;
    const nagrajB=przyciskIk("przycisk st-ikp-t st-probka-nagraj","sensor",TX.nagraj);nagrajB.title=TX.nagrajOpis;nagrajB.onclick=nagrajProbke;
    const wczB=przyciskIk("przycisk st-ikp-t","import",TX.wczytajProbke);wczB.title=TX.wczytajProbkeOpis;wczB.onclick=()=>plik.click();
    // Dwa przełączniki dotyczą tego, jak wchodzi NOWE nagranie, więc nie są parametrami instrumentu i nie
    // idą do zapisu — stąd zwykłe checkboxy, a nie `przelacznik()` po `P`.
    const opcja=(etykieta,opis,wlaczony)=>{
      const l=el2("label","st-probka-opcja");const c=el2("input");c.type="checkbox";c.checked=!!wlaczony;
      const s=el2("span","",etykieta);l.title=opis;l.append(c,s);return {pole:l,c};};
    const odliczaj=opcja(TX.odliczaj,TX.odliczajOpis,false),wyrownaj=opcja(TX.wyrownaj,TX.wyrownajOpis,true);
    akcje.append(plik,mikC,podsluchB,nagrajB,wczB,odliczaj.pole,wyrownaj.pole);
    // pasek nagrywania zastępuje przyciski, żeby w trakcie nagrania nie dało się zacząć drugiego
    const nagrywanie=el2("div","st-probka-nagrywanie");nagrywanie.hidden=true;
    const czas=el2("span","st-probka-czas",TX.nagrywanie);czas.setAttribute("role","status");czas.setAttribute("aria-live","polite");
    const vu=el2("div","st-probka-vu");vu.append(el2("i"));vu.setAttribute("aria-hidden","true");
    const stopB=el2("button","przycisk maly glowny st-probka-stop",TX.przerwij);stopB.type="button";
    stopB.onclick=()=>{if(StudioProbki.nagrywa())StudioProbki.stop();else{StudioProbki.stopPodsluch();podsluchWidok(false);}};
    nagrywanie.append(el2("i","st-probka-kropka"),czas,vu,stopB);
    const pusto=el2("p","st-probka-pusto",TX.probkaPusto);
    const kanwa=el2("canvas","st-probka-przebieg");kanwa.setAttribute("role","img");kanwa.setAttribute("aria-label",TX.mProbka);kanwa.hidden=true;
    // przeciąganie znaczników po przebiegu: start, koniec i dwa końce pętli
    let ciag=null;
    const xz=e=>{const r=kanwa.getBoundingClientRect();return {x:e.clientX-r.left,szer:Math.max(1,r.width)};};
    kanwa.addEventListener("pointerdown",e=>{
      if(e.button!=null&&e.button!==0)return;
      const {x,szer}=xz(e),kl=znacznikProbki(x,szer);if(!kl)return;
      ciag=kl;try{kanwa.setPointerCapture(e.pointerId);}catch(x2){}
      kanwa.classList.add("ciagnie");e.preventDefault();ciagnijZnacznik(kl,x,szer);
    });
    kanwa.addEventListener("pointermove",e=>{
      const {x,szer}=xz(e);
      if(!ciag){kanwa.style.cursor=znacznikProbki(x,szer)?"ew-resize":"default";return;}
      ciagnijZnacznik(ciag,x,szer);
    });
    const koniecCiag=()=>{if(ciag){ciag=null;kanwa.classList.remove("ciagnie");}};
    for(const ev of ["pointerup","pointercancel","lostpointercapture"])kanwa.addEventListener(ev,koniecCiag);
    const stan=el2("p","st-probka-stan","");stan.setAttribute("role","status");stan.setAttribute("aria-live","polite");
    const narz=el2("div","st-probka-narzedzia");narz.hidden=true;
    const odsluchaj=przyciskIk("przycisk maly st-ikp-t","gry/graj",TX.odsluchaj);odsluchaj.onclick=odsluchajProbke;
    const wykryjB=przyciskIk("przycisk maly st-ikp-t","celownik",TX.wykryjNute);wykryjB.title=PODP.probkaRoot;wykryjB.onclick=wykryjNuteProbki;
    const przytnijB=przyciskIk("przycisk maly st-ikp-t","gry/zakres",TX.przytnijCisze);przytnijB.title=PODP.probkaStart;przytnijB.onclick=przytnijProbke;
    const stalyB=przyciskIk("przycisk maly st-ikp-t","gry/zakres",TX.przytnijStale);stalyB.title=TX.przytnijStaleOpis;stalyB.onclick=przytnijNaStaleProbke;
    const zapiszB=przyciskIk("przycisk maly st-ikp-t","export",TX.zapiszWav);zapiszB.title=TX.zapiszWavOpis;zapiszB.onclick=zapiszProbkeWav;
    const usunB=przyciskIk("przycisk maly st-ikp-t st-probka-usun","bin",TX.usunProbke);usunB.onclick=usunProbkeInstr;
    narz.append(odsluchaj,wykryjB,przytnijB,stalyB,zapiszB,usunB);
    const siatka=el2("div","st-siatka");
    siatka.append(gala("probkaRoot",TX.probkaNuta),gala("probkaCent",TX.probkaCent),
      chipy(przelacznik("probkaStaly",TX.probkaStaly),przelacznik("probkaWstecz",TX.probkaWstecz)),
      gala("probkaStart",TX.probkaStart),gala("probkaKoniec",TX.probkaKoniecE),gala("probkaPoziom",TX.probkaPoziom),
      chipy(przelacznik("probkaPetla",TX.probkaPetla,petlaWlaczona)),
      gala("probkaOd",TX.probkaOd),gala("probkaDo",TX.probkaDo),gala("probkaZlep",TX.probkaZlep));
    const info=el2("p","st-szum-info st-probka-info",TX.probkaInfo);info.hidden=true;
    // upuszczenie dźwięku wprost na kartę (obok upuszczenia na pasek, które rozpoznaje obrazek od dźwięku)
    let wejscia=0;
    w.addEventListener("dragenter",e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes("Files")){e.preventDefault();wejscia++;w.classList.add("upusc");}});
    w.addEventListener("dragover",e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes("Files")){e.preventDefault();e.dataTransfer.dropEffect="copy";}});
    w.addEventListener("dragleave",()=>{if(--wejscia<=0){wejscia=0;w.classList.remove("upusc");}});
    w.addEventListener("drop",e=>{e.preventDefault();e.stopPropagation();wejscia=0;w.classList.remove("upusc");
      const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f)wczytajProbkePliku(f);});
    w.append(akcje,nagrywanie,pusto,kanwa,stan,narz,siatka,info);
    refy.probka={akcje,nagrywanie,czas,vu,mikC,podsluchB,nagrajB,odliczajC:odliczaj.c,wyrownajC:wyrownaj.c,
      pusto,kanwa,stan,narzedzia:narz,odsluchaj,wykryjB,przytnijB,stalyB,zapiszB,usunB,siatka,info};
    listaMikrofonow();
    StudioProbki.naZmianeUrzadzen(listaMikrofonow);
    return w;
  }
  // okrągły klawisz podglądu z diodą (port .sk-prev z panelu): filcowa ikona na klawiszu, podpis pod nim należy do klawisza
  function klucz(plik,podpis,opis){const b=el2("button","st-klucz");b.type="button";b.title=opis;b.setAttribute("aria-label",podpis+": "+opis);
    b.append(ikona(plik,"st-klucz-ikona"),el2("span","st-klucz-p",podpis));return b;}
  const krok=n=>el2("span","st-krok",String(n));
  const chipy=(...e)=>{const w=el2("div","st-chipy");w.append(...e);return w;};
  // scena w karcie Charakter: żaba gry (te same klatki co ZC_ZASOBY) otwiera buzię z poziomem dźwięku lampy, pod nią grana nuta
  const ZABA=typeof ZC_ZASOBY!=="undefined"&&ZC_ZASOBY.zaby?ZC_ZASOBY:{zaby:[0,1,2,3,4].map(i=>"../assets/frog/sing-"+i+"-96.png"),cicha:"../assets/frog/sing-silent-96.png"};
  function zabaKlatka(){const s=refy.scena;if(!s)return;let lv=0;try{lv=E&&E.Lampa.F_?+E.Lampa.F_.lv||0:0;}catch(e){}
    const n=nuty(),kl=lv<.02&&!n.length?-1:Math.min(4,Math.floor(lv*7));
    if(kl!==s.kl){s.kl=kl;s.img.src=kl<0?ZABA.cicha:ZABA.zaby[kl];s.el.classList.toggle("spiewa",kl>=0);}
    const nz=n.length?nazwaNuty(n[n.length-1].polton):"";if(nz!==s.nz){s.nz=nz;s.nuta.textContent=nz;}}
  function zbuduj(){
    const tresc=document.getElementById("studioTresc");if(!tresc)return;
    tresc.replaceChildren();refy.gale={};refy.sloty={};refy.tresc=tresc;
    // pasek brzmienia: okładka (grafika gracza) · nazwa z wierszem stanu i przyciskami grafiki · głośność · akcje (krok 3: Zapisz)
    const pasek=el2("div","st-pasek");refy.pasek=pasek;
    const plik=el2("input");plik.type="file";plik.accept="image/png,image/jpeg,image/webp,image/gif";plik.hidden=true;
    plik.onchange=()=>{if(plik.files&&plik.files[0])wczytajObraz(plik.files[0]);plik.value="";};
    const okl=el2("button","st-okladka");okl.type="button";okl.title=TX.grafikaOpis;okl.setAttribute("aria-label",TX.grafika+": "+TX.grafikaOpis);
    okl.append(el2("span","st-okladka-w"),ikona("paleta","st-okladka-plus"));okl.onclick=()=>plik.click();refy.okladka=okl;
    const id=el2("div","st-id"),wiersz=el2("div","st-nazwa-wiersz");
    const et=el2("label","st-gala-et",TX.nazwa);et.htmlFor="studioNazwa";
    const rodz=el2("span","st-rodzaj","");refy.rodzaj=rodz;
    const brudny=el2("span","st-brudny");brudny.append(el2("i","st-brudny-kropka"),document.createTextNode(TX.niezapisane));brudny.hidden=true;refy.brudny=brudny;
    const kom=el2("span","st-komunikat");kom.setAttribute("role","status");kom.setAttribute("aria-live","polite");refy.komunikat=kom;
    wiersz.append(et,rodz,brudny,kom);
    const nazwa=el2("input","st-nazwa-wejscie");nazwa.id="studioNazwa";nazwa.type="text";nazwa.maxLength=24;nazwa.placeholder=TX.nazwaPh;nazwa.autocomplete="off";nazwa.spellcheck=false;
    nazwa.oninput=()=>{P.nazwa=nazwa.value;odswiezPasek();};refy.nazwa=nazwa;
    const grafW=el2("div","st-grafika-w");
    const bGraf=przyciskIk("st-mini-p","paleta",TX.grafika);bGraf.title=TX.grafikaOpis;bGraf.onclick=()=>plik.click();
    const bUsun=przyciskIk("st-mini-p","bin",TX.grafikaUsun);bUsun.hidden=true;bUsun.onclick=()=>{P.obraz=null;odswiezOkladke();zmiana();komunikat(TX.grafikaUsunieta);};refy.usunObraz=bUsun;
    grafW.append(bGraf,bUsun);
    id.append(wiersz,nazwa,grafW);
    // przeciągnij-upuść na cały pasek: obrazek zostaje grafiką instrumentu, dźwięk jego próbką (10-19 wieczór)
    let wejscia=0;
    pasek.addEventListener("dragenter",e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes("Files")){e.preventDefault();wejscia++;pasek.classList.add("upusc");}});
    pasek.addEventListener("dragover",e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes("Files")){e.preventDefault();e.dataTransfer.dropEffect="copy";}});
    pasek.addEventListener("dragleave",()=>{if(--wejscia<=0){wejscia=0;pasek.classList.remove("upusc");}});
    pasek.addEventListener("drop",e=>{e.preventDefault();wejscia=0;pasek.classList.remove("upusc");
      const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(!f)return;
      if(toDzwiek(f))wczytajProbkePliku(f);else wczytajObraz(f);});
    const akcje=el2("div","st-akcje");
    const losuj=przyciskIk("przycisk st-ikp-t","kostka",TX.losuj);
    losuj.onclick=()=>{for(const m of Object.keys(MODULY))losujModul(m);odswiezWidok();komunikat(TX.wylosowano);if(ciagly)odswiezCiagly();else if(!seq.gra&&!pios.gra)testuj();};
    const zapW=el2("div","st-zapisz-w");
    const zap=przyciskIk("przycisk glowny st-ikp-t","save",TX.zapisz);zap.id="studioZapisz";zap.title=TX.skrot;zap.onclick=zapiszInstrument;refy.zapisz=zap;
    const skrot=el2("span","st-skrot","Ctrl+S");skrot.title=TX.skrot;skrot.setAttribute("aria-hidden","true");
    zapW.append(krok(3),zap);
    const anuluj=el2("button","przycisk",TX.anuluj);anuluj.type="button";anuluj.hidden=true;anuluj.onclick=()=>wczytajDoFormularza(null);refy.anuluj=anuluj;
    akcje.append(losuj,zapW,anuluj,skrot);
    pasek.append(plik,okl,id,gala("glosnosc",TX.glosnosc),akcje);
    // kolumna lewa (przyklejona): karta lampy (krok 2: Zagraj) = szyba na shaderze, legenda, VU, pulpit podglądu; klawiatura; lista własnych
    const bok=el2("div","st-bok");refy.bok=bok;
    const lampa=el2("div","st-lampa"),szklo=el2("div","st-lampa-szklo"),nak=el2("canvas","st-lampa-nakladka");
    const lampaNag=el2("div","st-krok-nag");lampaNag.append(krok(2),el2("span","",TX.krok2));
    szklo.setAttribute("role","img");szklo.setAttribute("aria-label",TX.przebieg+" / "+TX.widmo);szklo.append(nak);
    const leg=el2("div","st-legenda");leg.append(el2("span","st-leg-p",TX.przebieg),el2("span","st-leg-w",TX.widmo),el2("span","st-leg-l",TX.petla));
    const vuW=el2("div","st-vu-wiersz"),vu=el2("div","st-vu");vu.setAttribute("aria-hidden","true");for(let i=0;i<12;i++)vu.append(el2("i","st-led"));
    vuW.append(el2("span","st-vu-et",TX.poziom),vu);
    const pulpit=el2("div","st-pulpit");
    const bT=klucz("gry/graj",TX.testuj,TX.testujOpis);bT.onclick=testuj;
    const bH=klucz("gry/klaw-do-nuty",TX.przytrzymaj,TX.przytrzymajOpis);
    bH.addEventListener("pointerdown",e=>{e.preventDefault();nacisnij("trzymaj",62,bH,"wl");try{bH.setPointerCapture(e.pointerId);}catch(x){}});
    for(const ev of ["pointerup","pointercancel","lostpointercapture"])bH.addEventListener(ev,()=>puść("trzymaj"));
    const bC=klucz("gry/klaw-plynnie",TX.ciagly,TX.ciaglyOpis);bC.setAttribute("aria-pressed","false");refy.ciaglyB=bC;
    bC.onclick=()=>{ciagly=!ciagly;bC.setAttribute("aria-pressed",String(ciagly));odswiezCiagly();};
    pulpit.append(bT,bH,bC);
    lampa.append(lampaNag,szklo,leg,vuW,pulpit);refy.lampa=lampa;refy.szklo=szklo;refy.vu=vu;
    // klawiatura: białe w rzędzie, czarne nad szczelinami (--i = numer szczeliny od lewej)
    const klaw=el2("div","st-klawiatura");klaw.setAttribute("role","group");klaw.setAttribute("aria-label",TX.klawiatura);klaw.title=TX.klawiatura;refy.klaw=klaw;
    const biale=el2("div","st-klaw-biale");klaw.append(biale);const CZARNE={61:1,63:2,66:4,68:5,70:6};
    for(const [lit,m] of KLAWISZE){
      const cz=m in CZARNE,k=el2("button","st-klawisz"+(cz?" czarny":""));k.type="button";k.dataset.klawisz=lit;k.tabIndex=-1;k.setAttribute("aria-label",nazwaNuty(m)+" ("+lit.toUpperCase()+")");
      if(!cz)k.append(el2("span","st-klawisz-nuta",nazwaNuty(m)));k.append(el2("span","st-klawisz-lit",lit.toUpperCase()));
      k.addEventListener("pointerdown",e=>{e.preventDefault();nacisnij("p"+m,m,k,"gra");try{k.setPointerCapture(e.pointerId);}catch(x){}});
      for(const ev of ["pointerup","pointercancel","lostpointercapture"])k.addEventListener(ev,()=>puść("p"+m));
      if(cz){k.style.setProperty("--i",CZARNE[m]);klaw.append(k);}else biale.append(k);
    }
    // „Zaśpiewaj”: pole nad klawiaturą, po którym prowadzi się myszą jak w grze (10-21)
    const spiewPole=el2("div","st-spiew");spiewPole.title=TX.spiewOpis;
    spiewPole.setAttribute("role","slider");spiewPole.setAttribute("aria-label",TX.spiew+": "+TX.spiewOpis);
    const spiewPlotno=el2("canvas","st-spiew-plotno");spiewPlotno.setAttribute("aria-hidden","true");
    const spiewPodp=el2("span","st-spiew-podp",TX.spiewPodp);
    const spiewOdczyt=el2("span","st-spiew-odczyt","");spiewOdczyt.setAttribute("role","status");spiewOdczyt.setAttribute("aria-live","off");
    spiewPole.append(spiewPlotno,spiewPodp,spiewOdczyt);
    refy.spiew={pole:spiewPole,plotno:spiewPlotno,podp:spiewPodp,odczyt:spiewOdczyt};
    spiewPole.addEventListener("pointerdown",spiewStart);
    spiewPole.addEventListener("pointermove",e=>{if(spiew.gra)spiewRuch(e);});
    for(const ev of ["pointerup","pointercancel","pointerleave","lostpointercapture"])spiewPole.addEventListener(ev,spiewStop);
    const moje=el2("section","st-moje");
    // 10-18: nagłówek listy (nazwa i licznik) otwiera okno „Twoje instrumenty”: wszystkie z obrazkiem, zmiana nazwy, kopia, usuwanie, plik
    const nag=el2("h3","st-moje-naglowek");refy.licznik=el2("span","st-licznik","");
    const otw=el2("button","st-moje-otworz");otw.type="button";otw.title=TX.zarzadzaj;otw.onclick=()=>oknoInstrumenty();refy.otworz=otw;
    otw.append(el2("span","st-moje-t",TX.moje),refy.licznik,ikona("rozwin","st-ik st-moje-ik"));
    const nowy=przyciskIk("przycisk maly st-ikp-t","plusclean",TX.nowy);nowy.onclick=()=>wczytajDoFormularza(null);refy.nowy=nowy;nag.append(otw,nowy);
    const szuk=el2("input","st-szukaj");szuk.type="search";szuk.placeholder=TX.szukaj;szuk.autocomplete="off";szuk.setAttribute("aria-label",TX.szukaj);
    szuk.oninput=()=>{szukane=szuk.value;odswiezListe();};szuk.addEventListener("keydown",e=>e.stopPropagation());
    const ul=el2("ul","st-lista");refy.lista=ul;
    moje.append(nag,szuk,ul);
    bok.append(lampa,spiewPole,klaw,moje);
    // rack: krok 1 (gotowce) na całą szerokość, 01–04 moduły (na szerokim ekranie 2 × 2), 05 pętla testowa na całą szerokość
    const rack=el2("div","st-rack");refy.rack=rack;
    const start=el2("section","st-start"),sNag=el2("div","st-krok-nag");
    sNag.append(krok(1),el2("span","",TX.krok1),el2("small","st-start-opis",TX.krok1Opis));
    const st=el2("div","st-startery");st.setAttribute("role","group");st.setAttribute("aria-label",TX.krok1);refy.startery=st;
    for(const s of STARTERY){const b=el2("button","st-starter");b.type="button";b.dataset.id=s[0];b.setAttribute("aria-pressed","false");b.title=TX[s[2]]+": "+TX[s[2]+"O"];
      b.append(ikona(s[1],"st-starter-ik"),el2("b","",TX[s[2]]),el2("small","",TX[s[2]+"O"]));b.onclick=()=>wczytajStarter(s);st.append(b);}
    start.append(sNag,st);
    const info=el2("p","st-szum-info",TX.szumInfo);info.hidden=true;refy.szumInfo=info;
    const FALE_K=[["sawtooth",TX.pila,TX.pilaO],["square",TX.kwadrat,TX.kwadratO],["triangle",TX.trojkat,TX.trojkatO],["sine",TX.sinus,TX.sinusO],["pulse",TX.impuls,TX.impulsO],["custom",TX.wlasna,TX.wlasnaO]]
      .map(([v,n,o])=>[v,n,o,()=>falaSvg(v)]);
    const mOsc=modul("osc",TX.mOsc,"01",[kafle("fala",TX.fala,FALE_K),
      lista2("okt",TX.okt,[[-3,"−3"],[-2,"−2"],[-1,"−1"],[0,"0"],[1,"+1"],[2,"+2"],[3,"+3"]]),
      gala("puls",TX.puls),gala("glosy",TX.glosy),gala("rozstroj",TX.rozstroj),gala("szumQ",TX.szumQ),
      chipy(przelacznik("sub",TX.sub),przelacznik("szum",TX.szum),przelacznik("osc2",TX.osc2)),kafle("fala2",TX.fala2,FALE_K.slice(0,4),true),
      gala("polton2",TX.polton2),gala("rozstroj2",TX.rozstroj2),gala("miks2",TX.miks2)],"wave");
    refy.gale.okt.pole.title=TX.oktO;refy.gale.sub.pole.title=TX.subO;refy.gale.szum.pole.title=TX.szumO;refy.gale.osc2.pole.title=TX.osc2O;
    const mProb=modul("probka",TX.mProbka,"02",[],null,true);mProb.append(kartaProbki());
    const FILTRY_K=[["lowpass",TX.dolnyK,TX.dolnyO,TX.dolny],["highpass",TX.gornyK,TX.gornyO,TX.gorny],["bandpass",TX.pasmowyK,TX.pasmowyO,TX.pasmowy],["notch",TX.wycinK,TX.wycinO,TX.wycin]]
      .map(([v,n,o,tech])=>[v,n,o,()=>filtrSvg(v),tech.toLocaleLowerCase()]);
    const mFil=modul("filter",TX.mFiltr,"03",[kafle("filtr",TX.filtr,FILTRY_K),...MODULY.filter.map(k=>gala(k,TX[k]))],"eq");
    const mEnv=modul("env",TX.mEnv,"04",MODULY.env.map(k=>gala(k,TX[k])),"env");
    const mChar=modul("char",TX.mChar,"05",MODULY.char.map(k=>gala(k,TX[k])));
    const scena=el2("div","st-scena"),zaba=el2("img","st-zaba");zaba.src=ZABA.cicha;zaba.alt="";zaba.width=112;zaba.height=112;zaba.decoding="async";
    const scNuta=el2("span","st-scena-nuta","");scena.append(zaba,scNuta,el2("span","st-scena-et",TX.scenaEt));mChar.append(scena);refy.scena={el:scena,img:zaba,nuta:scNuta,kl:-1,nz:""};
    // 05 pętla testowa: transport, wzory (kafle z mini-siatką), siatka, odsłuch w piosence
    const proba=el2("div","st-proba"),tr=el2("div","st-transport");
    const zapetl=przyciskIk("przycisk st-ikp-t st-zapetl","gry/graj",TX.zapetl);zapetl.id="studioZapetl";zapetl.setAttribute("aria-pressed","false");zapetl.onclick=()=>seq.gra?seqStop():seqStart();refy.zapetl=zapetl;
    const suwak=(ik,et2,min,max,krok2,v,jedn,fn)=>{const w=el2("label","st-pole-w"),b=el2("b","",String(v)),i=el2("input");i.type="range";i.min=min;i.max=max;i.step=krok2;i.value=v;
      i.oninput=()=>{b.textContent=i.value;fn(+i.value);};i.addEventListener("keydown",e=>e.stopPropagation());w.append(ikona(ik),el2("span","",et2),i,b);if(jedn)w.append(el2("span","",jedn));return w;};
    const tempoW=suwak("gry/tempo-normalnie",TX.tempo,60,200,5,seq.tempo,"",v=>seqPrzelicz(()=>{seq.tempo=v;}));
    const swingW=suwak("motion",TX.swing,0,60,1,seq.swing,"%",v=>seqPrzelicz(()=>{seq.swing=v;}));
    const wycz=przyciskIk("przycisk maly st-ikp-t","bin",TX.wyczysc);wycz.onclick=()=>{seq.nuty=[];seq.wzor="";seqOdswiez();};
    tr.append(zapetl,tempoW,swingW,wycz);
    const wzW=el2("div","st-wzory-w");wzW.append(el2("span","st-gala-et",TX.wzor));
    const wz=el2("div","st-wzory");wz.setAttribute("role","group");wz.setAttribute("aria-label",TX.wzor);refy.wzory=wz;
    for(const [wid,nuty0] of WZORY){const b=el2("button","st-kafel st-wzor");b.type="button";b.dataset.v=wid;b.setAttribute("aria-pressed","false");b.title=TX[WZ_TX[wid]];
      b.append(wzorSvg(nuty0),el2("b","",TX[WZ_TX[wid]]));b.onclick=()=>{seqUstawWzor(wid);if(!seq.gra)seqStart();};wz.append(b);}
    wzW.append(wz);
    const siatka=el2("div","st-seq");siatka.setAttribute("role","group");siatka.setAttribute("aria-label",TX.mTest);seq.kom={};seq.klaw={};
    for(const m of SEQ_NUTY){const w=el2("div","st-seq-w"),et2=el2("div","st-seq-et");
      const k=el2("button","st-seq-k"+(NAZWY_NUT[m%12].includes("#")?" czarny":""));k.type="button";k.title=tt2(TX.seqKlawiszAria,{n:nazwaNuty(m)});k.setAttribute("aria-label",k.title);
      k.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&e.button!==0)return;e.preventDefault();nacisnij("s"+m,m,k,"gra");try{k.setPointerCapture(e.pointerId);}catch(x){}});
      for(const ev of ["pointerup","pointercancel","lostpointercapture"])k.addEventListener(ev,()=>puść("s"+m));
      k.addEventListener("contextmenu",e=>e.preventDefault());
      seq.klaw[m]=k;et2.append(k,el2("span","st-seq-n",nazwaNuty(m)));w.append(et2);
      for(let s=0;s<SEQ_KROKI;s++){const c=el2("button","st-seq-c"+(s%4===0?" takt":""));c.type="button";c.dataset.m=m;c.dataset.k=s;c.tabIndex=-1;
        c.setAttribute("aria-label",tt2(TX.seqNutaAria,{n:nazwaNuty(m),k:s+1}));seq.kom[m+":"+s]=c;w.append(c);}
      siatka.append(w);}
    seqRysowanie(siatka);
    const hint=el2("p","st-hint st-seq-hint",TX.seqHint);
    const pw=el2("div","st-piosenka");const pEt=el2("span","st-piosenka-et");pEt.append(ikona("gry/spiewa-tak"),el2("span","",TX.wPiosence));pw.append(pEt);
    const sel=el2("select","lista");sel.setAttribute("aria-label",TX.wPiosence);refy.piosenki=sel;sel.onchange=()=>{if(pios.gra)piosenkaStart();};
    const posl=przyciskIk("przycisk maly st-ikp-t","gry/graj",TX.posluchajPiosenki);posl.id="studioPosluchaj";posl.setAttribute("aria-pressed","false");posl.onclick=()=>pios.gra?piosenkaStop():piosenkaStart();refy.posluchaj=posl;
    const zp=el2("label","st-pole-w"),zpc=el2("input");zpc.type="checkbox";zpc.checked=true;zp.append(zpc,el2("span","",TX.zPodkladem));refy.zPodkladem=zpc;
    const postep=el2("div","st-postep");postep.append(el2("i"));postep.hidden=true;postep.setAttribute("aria-hidden","true");refy.postep=postep;
    const pinfo=el2("span","st-hint",TX.piosenkaOpis);refy.piosenkaInfo=pinfo;
    pw.append(sel,posl,zp,postep,pinfo);
    proba.append(tr,wzW,siatka,hint,pw);
    const mTest=modul("test",TX.mTest,"06",[],null,true);mTest.append(proba);
    rack.append(start,info,mOsc,mProb,mFil,mEnv,mChar,mTest);
    const glowna=el2("div","st-glowna");glowna.append(bok,rack);
    tresc.append(pasek,glowna);
    if(!seq.nuty.length)seqUstawWzor("melodia");else seqOdswiez();
    if(E){E.Lampa.init(szklo,{analizator:SP.analizator,nuty,zywe,vu});E.Panele.init(SP,refy.sloty);}
    if(typeof ResizeObserver==="function"){try{const ro=new ResizeObserver(()=>dopasuj());ro.observe(tresc);ro.observe(bok);ro.observe(pasek);}catch(e){}}
    zbudowany=true;
  }
  // klawisze komputera: tylko na ekranie studia i poza polami tekstu; nie dochodzą do gry (dołączanie graczy, nawigacja).
  // Ctrl+S zapisuje (jak w Synthcie), raz na naciśnięcie.
  const wPolu=t=>!!t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT"||t.isContentEditable);
  const naEkranie=()=>{const e=document.getElementById("studioEkran");return !!e&&!e.hidden;};
  addEventListener("keydown",e=>{
    if(!naEkranie())return;
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==="s"){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)zapiszInstrument();return;}
    if(e.ctrlKey||e.altKey||e.metaKey||wPolu(e.target)||(e.target&&e.target.classList&&e.target.classList.contains("ce-cv")))return;
    const k=KLAWISZE.find(x=>x[0]===e.key.toLowerCase());if(!k)return;
    e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
    const btn=document.querySelector('.st-klawisz[data-klawisz="'+k[0]+'"]');nacisnij("k"+k[1],k[1],btn,"gra");
  },true);
  addEventListener("keyup",e=>{
    if(!naEkranie())return;const k=KLAWISZE.find(x=>x[0]===e.key.toLowerCase());if(!k)return;
    puść("k"+k[1]);
  },true);

  // ---- wejście na ekran i przycisk w menu ----
  function otworz(){
    if(!dostepne()){return false;}
    const tyt=document.getElementById("studioTytul"),pod3=document.getElementById("studioPodtytul");
    if(tyt)tyt.textContent=TX.tytul;if(pod3)pod3.textContent=TX.podtytul;
    if(!zbudowany)zbuduj();
    odswiezWidok();odswiezListe();odswiezPiosenki();startPetli();dopasuj();
    return true;
  }
  function zamknijEkran(){
    // 10-19 wieczór: mikrofon gaśnie razem z ekranem. Trwające nagranie przepada, i to jest właściwe zachowanie —
    // dioda mikrofonu paląca się po wyjściu ze Studia byłaby gorsza niż utracone trzy sekundy dźwięku.
    try{StudioProbki.zamknij();}catch(e){}
    if(refy.probka)nagrywanieWidok(false,0,0);
    spiewStop();if(spiew.raf){cancelAnimationFrame(spiew.raf);spiew.raf=0;}
    ciagly=false;odswiezCiagly();for(const k of [...trzymane.keys()])puść(k,true);seqStop();piosenkaStop();
    if(probkaGlos){try{probkaGlos.g.zniszcz();}catch(e){}probkaGlos=null;}
    if(pod){try{pod.zatrzymaj();}catch(e){}pod=null;}
    if(raf){cancelAnimationFrame(raf);raf=0;}
    if(E){try{E.Lampa.spij();E.Lampa.zgub();E.Panele.spij();E.Panele.zgub();}catch(e){}}
  }
  function odswiez(){
    const b=document.getElementById("btnStudio");if(!b)return;
    const d=dostepne();
    // 10-17: odblokowane = holograficzny połysk jak sekretna karta (.holo, gry-studio.css). Przycisk widać od
    // początku, ale ZAKRYTY — czarne holo z kłódką i „Graj więcej, aby odblokować”; klik nic nie robi (aria-disabled), a ikona
    // czeka z przygaszonym „?” (StudioIkona czekaj), aż Studio się odblokuje. Nie chowamy go już przez `hidden`.
    b.hidden=false;b.classList.toggle("holo",d);b.classList.toggle("zakryte",!d);b.setAttribute("aria-disabled",d?"false":"true");
    // Zakryty przycisk celowo nie zdradza nazwy —
    // pokazuje „???" jak zakryte kafle instrumentów i skinów; nazwa wraca dopiero z odblokowaniem
    const nz=b.querySelector(".st-menu-nazwa");if(nz)nz.textContent=d?TX.menu:"???";
    const kl=b.querySelector(".st-menu-klodka");if(kl&&!d&&!kl.innerHTML&&typeof ZC_KLODKA!=="undefined")kl.innerHTML=ZC_KLODKA;
    if(!naEkranie()&&zbudowany)zamknijEkran();
  }
  function start(){
    wczytaj();
    const b=document.getElementById("btnStudio");
    if(b){
      // 10-18: animowana ikona sekretu (js/studio-ikona.js) jako naklejka przy prawej krawędzi; napis w osobnym spanie
      const t=document.createElement("span");t.className="st-menu-nazwa";t.textContent=TX.menu;
      // 10-21: podpis widać tylko w stanie .zakryte (CSS); kłódkę (filc z zabi-chor.js) wstawia odswiez(), bo tamten plik może
      // ładować się później niż ten
      const p=document.createElement("span");p.className="st-menu-podpis";
      const kl=document.createElement("span");kl.className="st-menu-klodka";kl.setAttribute("aria-hidden","true");
      p.append(kl,document.createTextNode(TX.menuZakryte));
      if(typeof StudioIkona!=="undefined"){b.replaceChildren(t,p,StudioIkona.zbuduj({rozmiar:"mala",czekaj:()=>!dostepne()}));b.classList.add("ma-ikone");}
      else b.replaceChildren(t,p);
      b.onclick=()=>{if(dostepne()&&typeof pokazLobby==="function")pokazLobby("studioEkran");};}
    odswiez();
    if(typeof ZC_KLODKA==="undefined")document.addEventListener("DOMContentLoaded",odswiez,{once:true});
  }
  start();
  // własna grafika instrumentu dla wyboru instrumentu gracza: id = „w-xxxxxx” (jak w T.instrumentyGracza), wynik = dataURL albo null
  function grafika(id){const i=dane.instrumenty.find(x=>x.id===id);return i&&i.p&&obrazOk(i.p.obraz)?i.p.obraz:null;}
  const api={dostepne,otworz,odswiez,zamknij:zamknijEkran,lista,recepta,grafika,DOMYSLNE,ZAKRESY,get instrumenty(){return dane.instrumenty.slice();},get parametry(){return swiezy(P);},
    zarzadzaj:o=>oknoInstrumenty(o),get oknoOtwarte(){return oknoOtwarte();},eksport:eksportTekst,importuj,   // 10-18: okno „Twoje instrumenty”, plik
    get petla(){return {gra:seq.gra,nuty:seq.nuty.map(n=>Object.assign({},n)),tempo:seq.tempo,swing:seq.swing,krok:seq.krok};},get piosenka(){return {gra:pios.gra,id:pios.id};}};
  if(typeof window!=="undefined"){window.Studio=api;if(window.ZC)window.ZC.studio=api;}
  return api;
})();
