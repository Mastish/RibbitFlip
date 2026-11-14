"use strict";
/* SKANER EKRANU — pola ustawień, budowane z OPISU, nie z HTML-a.

   Dwie zasady przeniesione z prototypu skanera (poza repozytorium):
     • pokazujemy WYŁĄCZNIE pokrętła, które w danym trybie naprawdę coś robią (`gdy`).
       Suwak, który nic nie zmienia, uczy człowieka, że aplikacja kłamie;
     • zestaw zaczyna od DOMYŚLNYCH i dopiero na nie kładzie swoje. Wcześniej „Szybki"
       i „Ostrożny" w ogóle nie działały, bo zestawy nakładały się na
       siebie i po „Ostrożnym" zostawał czas przytrzymania 120 ms, przez który krótkie
       puknięcie leciało do kosza jako drgnięcie. Osobiste (zmierzone wyprzedzenie) zostaje.

   Napisy są po polsku wprost — angielski robi walker i18n (rf-01-i18n.js), tak jak w reszcie
   aplikacji. */
(function (global) {
  'use strict';
  const NS = global.RFScan = global.RFScan || {};

  // „Pasek jest w grze" — nie to samo, co „tryb = pasy". Od 11.09 ćwiartki mogą kończyć się
  // przejazdem pasków WEWNĄTRZ ostatniego pola (`poCwiartkach = 'paski'`), a wtedy prędkość,
  // grubość pasma i zawracanie dotyczą tamtego przejazdu. Pokrętła, których nie widać, są
  // gorsze od pokręteł zbędnych: ustawienie istnieje i działa, a nie da się go dosięgnąć.
  const pasy = function (u) {
    return u.tryb === 'pasy' || (u.tryb === 'cwiartki' && u.poCwiartkach === 'paski');
  };
  const plynny = function (u) { return pasy(u) && u.ruch === 'plynny'; };
  const skokowy = function (u) { return pasy(u) && u.ruch === 'skokowy'; };

  // „4 pola" / „7 pól" — liczebnik po polsku, bo odczyt siatki stoi tuż obok liczby i „7 pola"
  // rzuca się w oczy. Angielski robi walker i18n, tam odmiany nie ma.
  function _polaSlowo(n) {
    if (n === 1) return 'pole';
    const d = n % 10, h = n % 100;
    return (d >= 2 && d <= 4 && !(h >= 12 && h <= 14)) ? 'pola' : 'pól';
  }

  // Pola, których jeszcze nie ma czym obsłużyć (dźwięk): schowane, ale klucze żyją dalej.
  const BEZ_DZWIEKU = function () { return false; };
  // `zaaw: true` = piętro 3 (UX 261120 L4d). Tych pól nie zmienia żaden z fabrycznych presetów
  // ani zestaw „Sol Cesto” (porównanie z ScanModule.DEFAULTS), więc w karcie stoją w jednym
  // „Zaawansowane” na dole, pogrupowane nazwą sekcji. Panel bez opcji `pietra` (okno nad pulpitem)
  // rysuje je jak dawniej, w ich sekcjach. Wyjątek od danych: obrót i prędkość promienia zostają
  // w sekcji, bo to tempo trybu Radar, a fabrycznego presetu z radarem jeszcze nie ma.
  const POLA = [
    { sek: 'Jak skanujemy', id: 'jak', ikona: '🎯' },
    { k: 'tryb', typ: 'segment', nazwa: 'Sposób wskazywania', opis: 'Pasy — dwa paski wyznaczają punkt. Ćwiartki — ekran dzieli się na pola i zawęża, aż zostanie jedno małe. Radar — najpierw kierunek, potem odległość.',
      opcje: [['pasy', 'Pasy'], ['cwiartki', 'Ćwiartki'], ['radar', 'Radar']] },
    { k: 'ruch', typ: 'segment', nazwa: 'Ruch paska', opis: 'Skokowy przeskakuje o zadany skok — trafia się w POLE, a nie w moment. Przy nierównym czasie reakcji bywa różnicą między „nie da się” a „da się”.', gdy: pasy,
      opcje: [['plynny', 'Płynny'], ['skokowy', 'Skokowy']] },
    { k: 'kolejnosc', typ: 'wybor', nazwa: 'Kolejność osi', gdy: pasy,
      opis: 'Dwie osie to dwa sygnały. Tam, gdzie liczy się tylko wysokość, na przykład w liście albo w menu, jedna oś wystarczy i kosztuje o sygnał mniej.',
      opcje: [['Y-X', 'Najpierw w dół, potem w bok'], ['X-Y', 'Najpierw w bok, potem w dół'], ['Y', 'Tylko w dół (jedna oś)'], ['X', 'Tylko w bok (jedna oś)']] },
    { k: 'przebiegi', typ: 'segment', nazwa: 'Przebiegi na oś', opis: 'Drugi przebieg wraca w to samo pasmo wolniej i cienką linią. Tak robi to Apple w Switch Control: najpierw z grubsza, potem dokładnie.', gdy: pasy, liczba: true,
      opcje: [[1, 'Jeden'], [2, 'Dwa (zgrubny + dokładny)']] },
    { k: 'predkosc', typ: 'suwak', nazwa: 'Prędkość paska', opis: 'Im wolniej, tym łatwiej trafić i tym dłużej trwa przejazd. Zacznij nisko, przyspieszaj dopiero wtedy, gdy trafianie zaczyna wychodzić za każdym razem.', min: 100, max: 2500, krok: 20, jed: 'px/s', gdy: plynny },
    { k: 'czasKroku', typ: 'suwak', nazwa: 'Czas jednego pola', opis: 'Tyle pasek stoi w jednym polu, zanim przeskoczy dalej. To cały czas, jaki masz na sygnał, więc daj sobie zapas ponad własną reakcję.', min: 150, max: 2500, krok: 50, jed: 'ms', gdy: skokowy },
    { k: 'skok', zaaw: true, typ: 'suwak', nazwa: 'Skok', opis: 'O ile pasek przeskakuje. 0 = o własną grubość. Mniejszy skok niż grubość znaczy, że pola na siebie zachodzą — nic nie umknie między nimi.', min: 0, max: 300, krok: 10, jed: 'px', gdy: skokowy },
    { k: 'pasmoY', typ: 'suwak', nazwa: 'Wysokość paska poziomego', min: 20, max: 400, krok: 10, jed: 'px', gdy: pasy,
      opis: 'Grubość paska jadącego w dół, czyli dokładność pierwszego trafienia. Przy jednym przebiegu to ona decyduje, jak blisko celu wylądujesz.' },
    { k: 'pokrycieY', zaaw: true, typ: 'suwak', nazwa: 'Szerokość paska poziomego', min: 10, max: 100, krok: 5, jed: '%', gdy: pasy, wyglad: true,
      opis: 'Ile obszaru pasek zajmuje wszerz. To wygląd, nie zasięg wyboru — krótszy pasek mniej zasłania, a gdzie skaner szuka, mówi obrys.' },
    { k: 'pasmoX', typ: 'suwak', nazwa: 'Szerokość paska pionowego', min: 20, max: 400, krok: 10, jed: 'px', gdy: pasy,
      opis: 'To samo dla paska jadącego w bok. Ustawia się osobno, bo ekran jest szerszy niż wyższy i w poziomie zwykle można pozwolić sobie na więcej.' },
    { k: 'pokrycieX', zaaw: true, typ: 'suwak', nazwa: 'Wysokość paska pionowego', min: 10, max: 100, krok: 5, jed: '%', gdy: pasy, wyglad: true,
      opis: 'To samo w pionie i też tylko wygląd. Krótsze paski mniej zasłaniają to, w co celujesz.' },
    { k: 'pasmoDokladnyY', zaaw: true, typ: 'suwak', nazwa: 'Grubość dokładnej linii poziomej', min: 2, max: 60, krok: 1, jed: 'px',
      opis: 'Drugi przejazd wraca cienką linią i to ona wyznacza ostateczny punkt. Im cieńsza, tym celniej, ale tym trudniej trafić w moment.',
      gdy: function (u) { return pasy(u) && u.przebiegi >= 2; } },
    { k: 'pasmoDokladnyX', zaaw: true, typ: 'suwak', nazwa: 'Grubość dokładnej linii pionowej', min: 2, max: 60, krok: 1, jed: 'px',
      opis: 'To samo dla linii pionowej, ustawiane osobno.',
      gdy: function (u) { return pasy(u) && u.przebiegi >= 2; } },
    { k: 'mnoznikDokladny', typ: 'suwak', nazwa: 'Dokładny przebieg wolniejszy', min: 0.1, max: 1, krok: 0.02, jed: '×',
      opis: 'Ile prędkości zostaje na drugi przejazd. Im mniej, tym wolniej wraca cienka linia i tym łatwiej zatrzymać ją dokładnie tam, gdzie trzeba.',
      gdy: function (u) { return plynny(u) && u.przebiegi >= 2; } },
    { k: 'kierunek', zaaw: true, typ: 'segment', nazwa: 'Po dojechaniu do końca', opis: 'Zawracanie jest łagodniejsze dla oka: pasek nigdy nie znika, więc nie trzeba go szukać od nowa.', gdy: pasy,
      opcje: [['jeden', 'Wraca na początek'], ['wahadlo', 'Zawraca']] },
    { k: 'pauzaNaKrancach', typ: 'suwak', nazwa: 'Postój na krańcu', opis: 'Pasek staje na końcu na tyle czasu, zanim ruszy z powrotem. Chwila oddechu i ostatnia szansa na sygnał.', min: 0, max: 2500, krok: 100, jed: 'ms', gdy: pasy },

    // ILE PÓL, WZDŁUŻ I WSZERZ — dwie liczby, a nie cztery gotowe pary. Do 13.09 był tu wybór
    // z listy (2×2, 3×3, 3×2, 4×3), choć silnik od zawsze przyjmuje 1..6 na każdą oś. Liczbę
    // ćwiartek (części siatki) da się ustawić osobno w poziomie i w pionie, bo układ pól dobiera się pod TO, co jest na ekranie:
    // pasjans to siedem kolumn, a nie kwadrat.
    { k: 'siatka', typ: 'siatka', nazwa: 'Podział na pola',
      opis: 'Ile pól wszerz i ile wzdłuż. Dobierz je do tego, co jest na ekranie: rząd ikon na dole obsługuje się siatką 6 × 1 szybciej niż kwadratem, bo każde zbędne pole to czekanie przy każdym wyborze. Pola zapalają się od lewej górnej, wierszami, jak przy czytaniu.',
      gdy: function (u) { return u.tryb === 'cwiartki'; } },
    // JAK PRZECHODZIĆ KRATKĘ. Przy 4×4 „każde pole osobno" to do 16 zapaleń i długie czekanie na
    // pole w prawym dolnym rogu; wiersz plus pole w wierszu to 4+4. Zysk rośnie z rozmiarem siatki,
    // dlatego domyślna zostaje „każde pole osobno" — przy 2×2 nowa droga nic nie daje (4 vs 2+2).
    { k: 'cwiartkiKolejnosc', typ: 'segment', nazwa: 'Kolejność w kratce',
      opis: 'Przy „wierszami” skaner zapala najpierw całe wiersze, a dopiero w wybranym wierszu jego pola: dwa krótkie przejazdy zamiast jednego długiego. Przy siatce 4 × 4 to do 8 zapaleń zamiast 16.',
      gdy: function (u) { return u.tryb === 'cwiartki'; },
      opcje: [['kratka', 'Każde pole osobno'], ['wiersze', 'Wierszami'], ['kolumny', 'Kolumnami']] },
    // GŁĘBOKOŚĆ. Pole istniało w modelu od początku, ale nie było go w konfiguracji — czyli
    // decydował o nim wyłącznie ten, kto pisał plik presetu. Teraz użytkownik wybiera
    // w konfiguracji, jak głęboko skaner ma schodzić.
    //
    // DRUGIE ZGŁOSZENIE, tego samego dnia po południu: „po przejechaniu wiersza i kolumny cały
    // czas chce dzielić pole wybrane na mniejsze segmenty. powinienem móc dodać «dodaj kolejny
    // poziom szczegółu / kliknij na środek wybranego»". Liczba 1..8 na suwaku ODPOWIADA na to
    // pytanie, ale go nie ZADAJE: człowiek widzi „Ile razy zawężać: 2 ×" i nie łączy tego z tym,
    // co go uwiera, czyli z drugim podziałem po wybraniu pola. Dlatego pierwsze pytanie jest
    // teraz wyborem z dwóch zdań, a liczba schodzi na drugi plan i pokazuje się dopiero wtedy,
    // gdy ktoś zechce więcej niż jeden dodatkowy poziom. Klucz pod spodem jest ten sam
    // (`poziomyMax`) — patrz `czytaj`/`pisz` w NS.Panel.
    { k: 'poziomyMax', typ: 'segment', nazwa: 'Po wybraniu pola',
      opis: 'Kończ na nim — wybrane pole jest ostatnie, a co skaner w nim zrobi, mówi „W ostatnim polu” niżej. Dodaj kolejny poziom szczegółu — wybrane pole staje się nowym obszarem i dzieli się tak samo jeszcze raz, co kosztuje kolejny sygnał.',
      gdy: function (u) { return u.tryb === 'cwiartki'; },
      czytaj: function (u) { return (u.poziomyMax | 0) > 1 ? 'glebiej' : 'koniec'; },
      pisz: function (v, u) { return { poziomyMax: v === 'glebiej' ? Math.max(2, u.poziomyMax | 0) : 1 }; },
      opcje: [['koniec', 'Kończ na nim'], ['glebiej', 'Dodaj kolejny poziom szczegółu']] },
    { k: 'poziomyMax', typ: 'suwak', nazwa: 'Ile poziomów szczegółu', min: 2, max: 8, krok: 1, jed: '×',
      opis: 'Ile razy z rzędu wybrane pole ma się stać nowym obszarem. Każdy poziom to jeden sygnał więcej. Skaner kończy wcześniej, gdy pole zejdzie poniżej progu niżej.',
      gdy: function (u) { return u.tryb === 'cwiartki' && (u.poziomyMax | 0) > 1; } },
    { k: 'czasBloku', typ: 'suwak', nazwa: 'Czas jednego pola', min: 200, max: 3000, krok: 50, jed: 'ms',
      opis: 'Tyle świeci jedno pole, zanim zapali się następne. Przy menu akcji dotyczy też pozycji tego menu.',
      gdy: function (u) { return u.tryb === 'cwiartki' || u.menuAkcji; } },
    // Próg dotyczy WYŁĄCZNIE zawężania, więc przy „Kończ na nim" nie ma czego przycinać — pole
    // i tak jest ostatnie. Pokrętło, które w danym ustawieniu nic nie robi, uczy człowieka, że
    // aplikacja kłamie (zasada z nagłówka pliku).
    { k: 'progKoncaBloku', typ: 'suwak', nazwa: 'Kończ, gdy pole zejdzie poniżej', min: 20, max: 200, krok: 5, jed: 'px',
      opis: 'Podział przestaje się zawężać, gdy pole zrobi się mniejsze niż tyle, a skaner kończy na nim. Mniej znaczy celniej, ale o rundę dłużej.',
      gdy: function (u) { return u.tryb === 'cwiartki' && (u.poziomyMax | 0) > 1; } },
    // Ćwiartki same w sobie trafiają w ŚRODEK ostatniego pola, a nie w rzecz. Przy gęstym menu
    // to za mało, więc ostatnie pole można jeszcze przejechać paskami — dokładnie tymi z trybu
    // „pasy", tylko w jego wnętrzu. Kosztuje dwa sygnały, daje punkt zamiast środka kwadratu.
    { k: 'poCwiartkach', typ: 'segment', nazwa: 'W ostatnim polu',
      opis: 'Paski jadą już tylko wewnątrz wybranego pola i biorą swoje ustawienia z sekcji „Jak jedzie pasek”. Grubość przycina się do pola: pasek ustawiony na cały ekran zajmowałby je w całości i nie miałby po czym jechać.',
      gdy: function (u) { return u.tryb === 'cwiartki'; },
      opcje: [['klik', 'Kliknij środek'], ['paski', 'Dojedź paskami']] },


    { k: 'stopnieNaSek', typ: 'suwak', nazwa: 'Obrót promienia', min: 20, max: 360, krok: 10, jed: '°/s',
      opis: 'Jak szybko promień obraca się wokół środka. Pierwszy sygnał zatrzymuje go i ustala kierunek.',
      gdy: function (u) { return u.tryb === 'radar'; } },
    { k: 'predkoscPromienia', typ: 'suwak', nazwa: 'Prędkość punktu', min: 100, max: 1500, krok: 20, jed: 'px/s',
      opis: 'Jak szybko punkt biegnie wzdłuż promienia po wybraniu kierunku. Drugi sygnał ustala odległość od środka.',
      gdy: function (u) { return u.tryb === 'radar'; } },

    // GDZIE — druga sekcja, zaraz po „jak", bo to pytanie tego samego rzędu. Skaner, który
    // przeczesuje cały ekran, gdy klikalna jest jedna listwa u dołu, kosztuje kilka sygnałów na
    // każdy klik — a sygnał jest tu jedyną walutą.
    { sek: 'Gdzie skaner ma działać', id: 'gdzie', ikona: '🖥️' },
    { k: 'obszar', typ: 'segment', nazwa: 'Obszar',
      opis: 'Cały pulpit to cały ekran. Przy kilku monitorach skaner pracuje na jednym z nich: na tym, z którego jest plansza, a bez planszy na głównym. Jeden ekran wskazuje monitor wprost. Własny prostokąt wyznaczasz sam i to on pozwala obsługiwać konkretną część gry albo aplikacji.',
      opcje: [['caly', 'Cały pulpit'], ['monitor', 'Jeden ekran'], ['wlasny', 'Własny prostokąt']] },
    { k: 'obszarMonitor', typ: 'wybor', nazwa: 'Ekran', opcjeZ: 'EKRANY',
      opis: 'Przy własnym prostokącie ten ekran jest BAZĄ: procenty liczą się z jego boków, a piksele od jego lewego górnego rogu.',
      gdy: function (u) { return u.obszar === 'monitor' || u.obszar === 'wlasny'; } },
    { k: 'obszarKsztalt', typ: 'ksztalty', nazwa: 'Gotowe kształty',
      opis: 'Jedno kliknięcie zamiast czterech liczb. Kształt jest proporcją, więc wpisuje się w procentach i przenosi między ekranami.',
      gdy: function (u) { return u.obszar === 'wlasny'; } },
    { k: 'obszarJednostka', typ: 'segment', nazwa: 'Jednostka',
      opis: 'Procenty przeżywają zmianę rozdzielczości i działają tak samo na każdym ekranie. Piksele są dokładne co do jednego — przydają się tam, gdzie znasz dokładne wymiary okna albo interfejsu gry.',
      opcje: [['procent', 'Procenty'], ['piksele', 'Piksele']],
      gdy: function (u) { return u.obszar === 'wlasny'; } },
    { k: 'obszarX1', typ: 'liczba', nazwa: 'Od lewej', para: 'obszarX2', os: 'x',
      opis: 'Lewa i prawa krawędź prostokąta, liczone w poprzek bazy.',
      gdy: function (u) { return u.obszar === 'wlasny'; } },
    { k: 'obszarY1', typ: 'liczba', nazwa: 'Od góry', para: 'obszarY2', os: 'y',
      opis: 'Górna i dolna krawędź. „Dolna 1/3” to od 66,7% do 100%.',
      gdy: function (u) { return u.obszar === 'wlasny'; } },

    { sek: 'Czasy — to tu mieszka dostępność', id: 'czasy', ikona: '⏱️' },
    { k: 'opoznienieStartu', typ: 'suwak', nazwa: 'Postój przed ruszeniem', opis: 'Czas na rozejrzenie się, zanim cokolwiek ruszy. W Androidzie „opóźnienie pierwszego elementu”.', min: 0, max: 3000, krok: 100, jed: 'ms' },
    { k: 'czasPrzytrzymania', zaaw: true, typ: 'suwak', nazwa: 'Ile trzymać, żeby się liczyło', opis: 'Odsiewa muśnięcia i drgnięcia przycisku SYGNAŁ na tej karcie. ⚠️ Na kapsel NIE działa: reguła wysyła impuls w chwili ruchu i nie mówi, jak długo trzymałeś — po stronie kapsla odpowiednikiem jest zachowanie „Po odczekaniu” w samym wyzwalaczu (gotowce „Przytrzymane…” w sekcji „Czym sterujesz skanerem”). Pozycję i tak bierzemy z chwili NACIŚNIĘCIA, bo wtedy człowiek celował.', min: 0, max: 1000, krok: 25, jed: 'ms' },
    { k: 'blokadaPoWyborze', typ: 'suwak', nazwa: 'Przerwa po wyborze', opis: 'Chwila, w której nie przyjmujemy nic — na przypadkowe drugie naciśnięcie.', min: 0, max: 2000, krok: 50, jed: 'ms' },
    { k: 'odbicie', typ: 'suwak', nazwa: 'Ignoruj powtórkę w ciągu', opis: 'Drżenie i odbicie styku. Zwykle wystarcza 10–100 ms.', min: 0, max: 300, krok: 10, jed: 'ms' },
    { k: 'wyprzedzenie', zaaw: true, typ: 'suwak', nazwa: 'Wyprzedzenie (poprawka na reakcję)', opis: 'Skaner czyta pozycję sprzed tylu milisekund. Zmierz to w „Treningu” — zwykle 150–350 ms.', min: -300, max: 600, krok: 10, jed: 'ms' },
    { k: 'nawroty', typ: 'suwak', nazwa: 'Przejazdy, zanim odpocznie', opis: '0 = nigdy nie odpoczywa. Bez tego ekran potrafi migać w kółko.', min: 0, max: 10, krok: 1, jed: '' },

    // 👆 nie ma filcowego glifu (UX 261120, P-G2-10), więc karta rysuje dłoń z assets; `ikona`
    // zostaje dla miejsc, które czytają ją jako tekst.
    { sek: 'Co się dzieje po wskazaniu', id: 'po', ikona: '👆', ikonaObraz: 'cursor/hand-press-36.png' },
    { k: 'dociaganie', typ: 'suwak', nazwa: 'Dociąganie do celu', opis: 'Punkt przeskakuje na najbliższy przycisk, jeśli jest bliżej niż tyle. Najtańszy skok celności. Nad prawdziwym pulpitem jest wyłączone, bo tam nie znamy przycisków Windowsa, więc skaner klika dokładnie tam, gdzie wskażesz.', min: 0, max: 200, krok: 5, jed: 'px' },
    { k: 'menuAkcji', typ: 'przel', nazwa: 'Pytaj, co zrobić w tym punkcie', opis: 'Zamiast klikać od razu, skaner przejedzie po liście akcji poniżej.' },
    { k: 'akcjaDomyslna', zaaw: true, typ: 'wybor', nazwa: 'Akcja domyślna', opcjeZ: 'AKCJE', gdy: function (u) { return !u.menuAkcji; },
      opis: 'Co skaner robi we wskazanym punkcie, kiedy nie pyta o akcję.' },
    { k: 'menuPozycje', typ: 'akcje', nazwa: 'Menu akcji', opis: 'Zaznacz, co ma się pojawiać w menu akcji. Każda pozycja to sekunda czekania przy każdym kliknięciu, więc mniej znaczy szybciej.', gdy: function (u) { return !!u.menuAkcji; } },
    { k: 'powrotPoAkcji', zaaw: true, typ: 'segment', nazwa: 'Po akcji',
      opis: 'Czekanie na sygnał daje chwilę spokoju. Nowy przejazd od razu przydaje się wtedy, gdy klikasz kilka rzeczy po kolei.',
      opcje: [['spoczynek', 'Czekaj na sygnał'], ['odRazu', 'Zacznij od nowa']] },

    { sek: 'Widok', id: 'widok', ikona: '🎨' },
    { k: 'kolorY', zaaw: true, typ: 'kolor', nazwa: 'Kolor paska poziomego', wyglad: true, gdy: pasy,
      opis: 'Kolor paska jadącego w dół. Dobierz taki, który odcina się od tego, po czym zwykle klikasz.' },
    { k: 'kolorX', zaaw: true, typ: 'kolor', nazwa: 'Kolor paska pionowego', wyglad: true, gdy: pasy,
      opis: 'Kolor paska jadącego w bok. Dwa różne kolory od razu mówią, która oś jest w ruchu.' },
    { k: 'kolorDokladny', zaaw: true, typ: 'kolor', nazwa: 'Kolor dokładnego przebiegu', wyglad: true,
      opis: 'Kolor drugiego, cienkiego przejazdu. Trzeci kolor mówi wprost, że to już dopracowywanie, a nie szukanie.',
      gdy: function (u) { return pasy(u) && u.przebiegi >= 2; } },
    { k: 'kryciePasma', zaaw: true, typ: 'suwak', nazwa: 'Krycie wypełnienia paska', min: 0, max: 1, krok: 0.02, jed: '', wyglad: true,
      opis: 'Ile widać przez pasek. Obrys i kreska w środku zostają wyraźne przy każdym ustawieniu — gaśnie samo wypełnienie.' },
    { k: 'przyciemnienie', typ: 'suwak', nazwa: 'Przyciemnienie poza obszarem', min: 0, max: 0.85, krok: 0.05, jed: '', wyglad: true,
      opis: 'Wszystko poza obszarem, w którym skaner akurat szuka, gaśnie. Działa w podglądzie i w piaskownicy. Nad prawdziwym pulpitem zostaje sam obrys, bo Windows umie przygasić okno tylko w całości.' },
    // ZOBACZ, GDZIE BĘDZIE SKANOWAŁ, ZANIM RUSZY. Sekcja „Gdzie skaner ma działać" ustawia
    // prostokąt czterema liczbami — bez podglądu odpowiedź na „czy dobrze wpisałem" wymagała
    // uruchomienia skanera. Teraz obszar świeci półprzezroczyście na postoju, a suwak decyduje,
    // jak mocno (0 = sam obrys).
    { k: 'podgladObszaru', zaaw: true, typ: 'suwak', nazwa: 'Podgląd obszaru na postoju', min: 0, max: 0.6, krok: 0.02, jed: '', wyglad: true,
      opis: 'Gdy skaner czeka na sygnał, obszar z sekcji „Gdzie skaner ma działać” świeci półprzezroczyście — po zmianie kształtu albo liczb od razu widać, co się wpisało. 0 wyłącza wypełnienie i zostaje sam obrys. W oknie nad pulpitem obszar podświetla się na chwilę po każdej zmianie i zawsze samym obrysem, bo Windows wycina z tego okna jeden kolor.' },
    { k: 'grubosc', zaaw: true, typ: 'suwak', nazwa: 'Grubość linii', min: 1, max: 6, krok: 1, jed: 'px', wyglad: true,
      opis: 'Grubość obrysu i linii pomocniczych. Podnieś ją, gdy patrzysz na ekran z daleka.' },
    { k: 'poswiata', zaaw: true, typ: 'przel', nazwa: 'Poświata', wyglad: true,
      opis: 'Miękka łuna wokół paska. Pomaga go znaleźć na pstrym tle, na jednolitym bywa zbędna.' },
    { k: 'etykietaPrzyPasku', zaaw: true, typ: 'przel', nazwa: 'Podpis przy pasku', wyglad: true,
      opis: 'Przy pasku jedzie mały podpis z nazwą osi i z tym, czy to już dokładny przejazd. Pomaga na początku, potem zwykle się go wyłącza.' },
    // ⚠️ TRZY POKRĘTŁA DŹWIĘKU NIC JESZCZE NIE ROBIĄ: w całym module nie ma ani jednego
    // AudioContext (ani scena, ani HUD, ani okno nad pulpitem nic nie odtwarzają). Dla opiekuna
    // osoby niewidomej to obietnica bez pokrycia, więc do czasu powstania dźwięku pola są SCHOWANE
    // (`BEZ_DZWIEKU`), a zestaw „Bez patrzenia" wyszedł z zasiewu (UX 261120, D11). Klucze zostają
    // w konfiguracji i w `WYGLAD_DOM`, żeby stare presety wczytywały się bez strat.
    { k: 'dzwiek', typ: 'przel', nazwa: 'Dźwięk', wyglad: true, gdy: BEZ_DZWIEKU,
      opis: 'Miejsce na dźwięk kroków i wyboru. Przełącznik zapisuje się z konfiguracją, ale skaner jeszcze nie gra.' },
    { k: 'glosnosc', typ: 'suwak', nazwa: 'Głośność', min: 0, max: 1, krok: 0.05, jed: '', wyglad: true,
      opis: 'Głośność przyszłych dźwięków skanera. Na razie nie ma czego ściszać.',
      gdy: BEZ_DZWIEKU },
    { k: 'tonPozycji', typ: 'przel', nazwa: 'Ton pozycji (skanowanie uchem)', opis: 'Wysokość dźwięku ma mówić, gdzie stoi pasek, żeby dało się skanować z zamkniętymi oczami. Tak jak wyżej: ustawienie się zapisuje, dźwięku jeszcze nie ma.', wyglad: true,
      gdy: BEZ_DZWIEKU }
  ];

  // Na zewnątrz tylko do CZYTANIA: opis presetu w Bibliotece (rf-50b2 `NS.opisz`) buduje się
  // z tej tablicy, żeby mówił tymi samymi słowami, co karta modułu — i żeby nowe pokrętło
  // pojawiło się tam samo, bez dopisywania czegokolwiek (2026-10-02).
  NS.POLA = POLA;

  NS.WYGLAD_DOM = {
    kolorY: '#ec1a83', kolorX: '#6cb33f', kolorDokladny: '#eaa32b', kryciePasma: 0.26,
    pokrycieY: 100, pokrycieX: 100,
    przyciemnienie: 0.42, podgladObszaru: 0.18, grubosc: 2, poswiata: true, etykietaPrzyPasku: true,
    dzwiek: false, glosnosc: 0.25, tonPozycji: false     // dźwięk to opcja, nie domyślność
  };

  /* ZESTAWY. Każdy podaje PEŁNY komplet parametrów skanowania, a nie różnicę — bo zestaw
     nałożony na poprzedni potrafi odziedziczyć jedno pokrętło, które wszystko psuje.
     Tak było 10.09: po „Ostrożnym" zostawał czas przytrzymania 120 ms i „Szybki" nie reagował
     na krótkie puknięcia. Zestaw zaczyna więc od ustawień domyślnych i dopiero na nie kładzie
     swoje. To, co osobiste — wyprzedzenie, wygląd, dźwięk, język — zostaje nietknięte.

     `rev` — WERSJA ZESTAWU (02.10). Podbij ją przy każdej zmianie liczb zestawu: Biblioteka po
     cichu podmienia zasianą kopię, której nikt nie ruszał, a przeróbce proponuje „Zaktualizuj
     z aplikacji" (`seed_scan_presets` w serwerze). Bez podbicia poprawka zostaje tylko tutaj. */
  const OSOBISTE = ['wyprzedzenie'];
  NS.ZESTAWY = {
    'zrownowazony': {
      rev: 1,
      nazwa: 'Zrównoważony',
      opis: 'Domyślny kompromis: dwa przebiegi, płynny pasek, zawracanie.',
      u: { tryb: 'pasy', ruch: 'plynny', kolejnosc: 'Y-X', predkosc: 700, pasmoY: 140, pasmoX: 140,
           przebiegi: 2, kierunek: 'wahadlo', pauzaNaKrancach: 500, opoznienieStartu: 600,
           czasPrzytrzymania: 0, blokadaPoWyborze: 300, dociaganie: 60, nawroty: 3, menuAkcji: false }
    },
    'ostrozny': {
      rev: 1,
      nazwa: 'Ostrożny',
      opis: 'Wolno, szeroko, skokowo. Na start i przy nierównym ruchu.',
      u: { tryb: 'pasy', ruch: 'skokowy', kolejnosc: 'Y-X', czasKroku: 900, skok: 0, pasmoY: 170, pasmoX: 200,
           przebiegi: 2, kierunek: 'wahadlo', pauzaNaKrancach: 900, opoznienieStartu: 1000,
           czasPrzytrzymania: 0, blokadaPoWyborze: 600, odbicie: 80, dociaganie: 100, nawroty: 3, menuAkcji: false }
    },
    'szybki': {
      rev: 1,
      nazwa: 'Szybki',
      opis: 'Dla wprawionych: jeden przebieg, wąskie pasmo, mocne dociąganie.',
      u: { tryb: 'pasy', ruch: 'plynny', kolejnosc: 'Y-X', predkosc: 1500, pasmoY: 90, pasmoX: 90,
           przebiegi: 1, kierunek: 'wahadlo', pauzaNaKrancach: 200, opoznienieStartu: 200,
           czasPrzytrzymania: 0, blokadaPoWyborze: 150, odbicie: 30, dociaganie: 110, nawroty: 4, menuAkcji: false }
    },
    'cwiartki': {
      rev: 1,
      nazwa: 'Ćwiartki',
      opis: 'Ekran dzieli się na pola. Zwykle najszybsze do dużych przycisków.',
      u: { tryb: 'cwiartki', siatka: [2, 2], czasBloku: 900, progKoncaBloku: 90,
           opoznienieStartu: 500, czasPrzytrzymania: 0, blokadaPoWyborze: 300, dociaganie: 80, nawroty: 3, menuAkcji: false }
    },
    // „Bez patrzenia" (kod 'uchem') wyszedł z zasiewu razem z polami dźwięku (UX 261120, D11):
    // obiecywał skanowanie uchem, a skaner nie gra. Wraca tu z nowym `rev`, gdy powstanie dźwięk.
    'menu': {
      rev: 1,
      nazwa: 'Z menu akcji',
      opis: 'Po wskazaniu punktu skaner pyta: kliknij, prawy, kopiuj, usuń…',
      u: { tryb: 'pasy', ruch: 'plynny', kolejnosc: 'Y-X', predkosc: 700, pasmoY: 140, pasmoX: 140,
           przebiegi: 2, kierunek: 'wahadlo', pauzaNaKrancach: 500, opoznienieStartu: 600,
           dociaganie: 60, nawroty: 3, menuAkcji: true, czasBloku: 1000,
           menuPozycje: ['lewy', 'dwuklik', 'prawy', 'kopiuj', 'wklej', 'usun', 'anuluj'] }
    }
  };

  /* POLE, KTÓRE MÓWI O KLUCZU WŁASNYMI SŁOWAMI. Zwykłe pole czyta i pisze jedną liczbę pod
     swoją nazwą; te dwa haczyki pozwalają POKAZAĆ ten sam klucz jako wybór, a schować liczbę
     na dalszy plan. Używa tego „Po wybraniu pola": człowiek widzi „Kliknij środek wybranego"
     albo „Dodaj kolejny poziom szczegółu", a pod spodem stoi `poziomyMax` = 1 albo więcej.
     Osobnego klucza NIE zakładamy — nazwa, której nie zna serwer, zapisałaby się i zniknęła
     przy pierwszym odczycie (patrz `tests/test_scan_model.py`).
     Poza kartą od 02.10: opis presetu w Bibliotece (rf-50b2) czyta wartość i odczyt TĄ SAMĄ
     drogą, więc nie ma jak pokazać innej liczby niż suwak. */
  function wartosc(p, u, w) { return p.czytaj ? p.czytaj(u, w) : (p.wyglad ? w[p.k] : u[p.k]); }
  function formatuj(p, v) {
    if (p.k === 'przyciemnienie' || p.k === 'glosnosc' || p.k === 'kryciePasma'
      || p.k === 'podgladObszaru') return Math.round(v * 100) + '%';
    if (p.k === 'mnoznikDokladny') return v.toFixed(2) + '×';
    if (p.k === 'nawroty') return v === 0 ? '∞' : v + '×';
    if (p.k === 'skok' && v === 0) return '=';
    return v + (p.jed ? ' ' + p.jed : '');
  }
  NS.wartosc = wartosc;
  NS.formatuj = formatuj;

  NS.Panel = function (korzen, opcje) {
    const self = this;
    const naZmiane = opcje.naZmiane || function () { };
    let u = opcje.ustawienia, w = opcje.wyglad;
    let kontrolki = [];

    function el(rodzic, klasa, tekst, tag) {
      const d = document.createElement(tag || 'div');
      d.className = klasa || '';
      if (tekst !== undefined && tekst !== null) d.textContent = tekst;
      rodzic.appendChild(d);
      return d;
    }
    const wart = function (p) { return wartosc(p, u, w); };
    function ustaw(p, v) {
      // JEDNOSTKA MÓWI, JAK TE LICZBY SĄ ZAPISANE, a nie gdzie leży obszar — więc przy jej zmianie
      // przeliczamy je tak, żeby prostokąt został tam, gdzie był. Bez tego kliknięcie w „Piksele"
      // przenosiło „dolną 1/3" (25…75%) w róg ekranu jako 25…75 px, co wygląda jak awaria.
      if (p.k === 'obszarJednostka' && typeof NS.przeliczJednostke === 'function') {
        const nowe = NS.przeliczJednostke(u, v, NS.ekrany);
        if (nowe) for (const k in nowe) u[k] = nowe[k];
      }
      if (p.pisz) { const zmiany = p.pisz(v, u, w) || {}; for (const k in zmiany) u[k] = zmiany[k]; }
      else if (p.wyglad) w[p.k] = v;
      else u[p.k] = v;
      naZmiane(u, w, p.k);
      odswiez();
    }
    /* Zapis POD KONKRETNY KLUCZ, nie pod pole. Potrzebny tam, gdzie jedno pole prowadzi więcej
       niż jedną liczbę: „od–do" to dwa klucze w jednym wierszu, a gotowy kształt ustawia cztery
       naraz. Bez tego każdy taki wiersz musiałby udawać kilka pól i sam pilnować, które z nich
       jest którym. */
    function ustawKlucze(zmiany, powod) {
      for (const k in zmiany) u[k] = zmiany[k];
      naZmiane(u, w, powod || Object.keys(zmiany)[0]);
      odswiez();
    }
    /* SEKCJE SIĘ ZWIJAJĄ — jak w karcie koła wyboru.
       Dwadzieścia pięć pokręteł jedno pod drugim dawało kartę na 2582 px: żeby dojść do dźwięku,
       trzeba było przewinąć całą dostępność. Wybór człowieka NIE jest zapamiętywany między
       uruchomieniami — panel, który otwiera się na cudzym układzie sekcji, wygląda, jakby o czymś
       przypominał.

       OD 14.09 ZWINIĘTE SĄ WSZYSTKIE, RÓWNIEŻ PIERWSZA (zakładki po prawej
       są domyślnie zwinięte). Otwarta „Jak skanujemy" rozpychała prawą kolumnę na
       tyle, że nad wyborem sekcji stał już pełny ekran pokręteł — a najczęstszą rzeczą, po którą
       się tu wraca, jest przełączenie sekcji skanera na górze karty, nie poprawianie prędkości.
       Każda sekcja jest o jedno kliknięcie dalej; z zamkniętymi widać cały spis naraz.

       PIĘTRA (UX 261120 L4d, opcja `pietra: { zaaw: host }`, tylko karta modułu). Sekcja to filcowy
       zwijak piętra 2 (`cardfold inset` + rfTier, rf-28d): w nagłówku bieżące wartości, licznik
       „zmienione: N” i „Przywróć domyślne”, otwarcie pamięta `ribbitflip.fold.skaner.<sekcja>`.
       Pola `zaaw` idą do `host` (zwijak „Zaawansowane” karty), pod nazwą swojej sekcji. */
    const pietra = (opcje.pietra && typeof document !== 'undefined') ? opcje.pietra : null;
    let sekcje = [];
    this.zbuduj = function () {
      korzen.innerHTML = '';
      if (pietra && pietra.zaaw) pietra.zaaw.innerHTML = '';
      kontrolki = [];
      sekcje = [];
      let gniazdo = korzen, biez = null;
      POLA.forEach(function (p) {
        if (p.sek && pietra) {
          const fold = el(korzen, 'sk-fold cardfold inset', null, 'details');
          fold.id = 'scanFold-' + p.id;
          const s = el(fold, '', null, 'summary');
          const n = el(s, 'sk-sek-tytul', null, 'span');
          gniazdo = el(fold, 'cardfold-body sk-fold-body');
          biez = { p: p, fold: fold, pola: [], zaaw: [], grupa: null, sync: null };
          sekcje.push(biez);
          kontrolki.push({ p: p, sek: n });
          return;
        }
        if (p.sek) {
          const fold = el(korzen, 'sk-fold', null, 'details');
          fold.open = false;
          const s = el(fold, 'sk-sekcja', null, 'summary');
          const ik = el(s, 'sk-sek-ikona', p.ikonaObraz ? '' : p.ikona);
          if (p.ikonaObraz) {
            ik.classList.add('sk-sek-ikona-obraz');
            ik.style.backgroundImage = 'url("/web/assets/' + p.ikonaObraz + '")';
            ik.setAttribute('aria-hidden', 'true');
          }
          const n = el(s, 'sk-sek-nazwa');
          gniazdo = el(fold, 'sk-fold-body');
          kontrolki.push({ p: p, sek: n });
          return;
        }
        let rodzic = gniazdo;
        if (biez && p.zaaw && pietra.zaaw) {
          if (!biez.grupa) {
            biez.grupa = el(pietra.zaaw, 'sk-zaaw-grupa');
            kontrolki.push({ p: biez.p, sek: el(biez.grupa, 'sk-zaaw-tytul') });
          }
          rodzic = biez.grupa;
          biez.zaaw.push(p);
        } else if (biez) biez.pola.push(p);
        const wiersz = el(rodzic, 'sk-wiersz');
        const gora = el(wiersz, 'sk-gora');
        const nazwa = el(gora, 'sk-nazwa');
        const odczyt = el(gora, 'sk-odczyt');
        let ster = null, opis = null, pole = null;   // `pole` = liczba do wpisania obok suwaka

        if (p.typ === 'suwak') {
          /* SUWAK MA WIDEŁKI WYGODNE, POLE OBOK — WIDEŁKI SERWERA (16.09).

             Suwaki (m.in. prędkości) kończą się na 100 px/s, a nie każdemu to wystarcza, więc
             wartość da się dostroić albo wpisać ręcznie poza zakresem suwaka. Skaner jest narzędziem dostępności, więc dolna granica
             wygodna dla większości nie może być granicą twardą — a suwak z zakresem 20…6000 px/s
             byłby bezużyteczny dla wszystkich (jeden piksel ruchu = skok o kilkadziesiąt).
             Stąd dwa wejścia do tej samej liczby: suwak do szukania po omacku i pole do wpisania
             wprost. Pole przyjmuje `RFScan.ZAKRESY`, czyli dokładnie to, co przyjmuje serwer. */
          const zakres = (NS.ZAKRESY && NS.ZAKRESY[p.k]) || [p.min, p.max];
          /* CZTERY POKRĘTŁA ZOSTAJĄ PRZY SAMYM ODCZYCIE: krycie, przyciemnienie, podgląd obszaru
             i głośność mówią PROCENTAMI (0,35 → „35%"), a ich suwak obejmuje już cały zakres,
             jaki przyjmuje serwer. Pole liczbowe pokazywałoby tam surowe 0,35 i nie dawałoby
             dostępu do niczego, czego nie ma na suwaku — czyli sam koszt, zero zysku. */
          const procentowe = (p.k === 'przyciemnienie' || p.k === 'glosnosc'
            || p.k === 'kryciePasma' || p.k === 'podgladObszaru');
          ster = document.createElement('input');
          ster.type = 'range'; ster.min = p.min; ster.max = p.max; ster.step = p.krok;
          ster.className = 'sk-suwak';
          ster.addEventListener('input', function () { ustaw(p, parseFloat(ster.value)); });
          pole = procentowe ? null : document.createElement('input');
          if (pole) pole.type = 'number';
          if (pole) {
          pole.className = 'sk-odczyt-pole';
          pole.min = zakres[0]; pole.max = zakres[1];
          // Krok pola jest DROBNIEJSZY niż suwaka: to jest właśnie „dostrojenie". Przy ułamkowych
          // pokrętłach (mnożnik, krycie) zostaje krok suwaka, bo tam 1 nie ma sensu.
          pole.step = (p.krok < 1) ? p.krok : 1;
          pole.title = 'Możesz wpisać wartość spoza suwaka: od ' + zakres[0] + ' do ' + zakres[1]
            + (p.jed ? ' ' + p.jed : '');
          // `change`, nie `input`: wpisywanie „450" przechodzi przez „4" i „45", a każdy z tych
          // stanów zapisałby się na dysk i szarpnął podglądem.
          pole.addEventListener('change', function () {
            const v = parseFloat(pole.value);
            if (isNaN(v)) { odswiez(); return; }
            ustaw(p, Math.max(zakres[0], Math.min(zakres[1], v)));
            odswiez();                       // wartość spoza widełek wraca przycięta — widać to od razu
          });
          odczyt.appendChild(pole);
          if (p.jed) el(odczyt, 'sk-odczyt-jed', p.jed);
          }
          wiersz.appendChild(ster);
        } else if (p.typ === 'segment') {
          ster = el(wiersz, 'sk-segment');
          p.opcje.forEach(function (o) {
            const b = el(ster, 'sk-seg', null, 'button');
            b._v = o[0]; b._kl = o[1];
            b.addEventListener('click', function () { ustaw(p, o[0]); });
          });
        } else if (p.typ === 'wybor') {
          ster = document.createElement('select');
          ster.className = 'sk-wybor';
          ster.addEventListener('change', function () {
            ustaw(p, p.para ? ster.value.split(',').map(Number) : ster.value);
          });
          wiersz.appendChild(ster);
        } else if (p.typ === 'kolor') {
          // Zwykły `input[type=color]` — systemowy próbnik jest tym, czego człowiek się spodziewa,
          // a własna paleta byłaby drugim miejscem, w którym trzeba by pilnować kontrastu.
          ster = document.createElement('input');
          ster.type = 'color';
          ster.className = 'sk-kolor';
          ster.addEventListener('input', function () { ustaw(p, ster.value); });
          wiersz.appendChild(ster);
        } else if (p.typ === 'przel') {
          ster = el(wiersz, 'sk-przel', null, 'button');
          el(ster, 'sk-przel-galka');
          ster.addEventListener('click', function () { ustaw(p, !wart(p)); });
        } else if (p.typ === 'liczba') {
          // JEDEN WIERSZ, DWIE LICZBY: „od" i „do" opisują tę samą krawędź i rozdzielone na dwa
          // wiersze czytały się jak cztery niezależne pokrętła. Jednostkę mówi odczyt po prawej,
          // bo jest wspólna dla obu i zmienia się przełącznikiem wyżej.
          ster = el(wiersz, 'sk-liczby');
          const pole = function (klucz) {
            const i = document.createElement('input');
            i.type = 'number'; i.className = 'sk-liczba'; i._k = klucz;
            // `change`, nie `input`: przy wpisywaniu „100" stan przechodzi przez „1" i „10",
            // a każdy z nich zapisałby się jako prawdziwy obszar i przesunął podgląd.
            i.addEventListener('change', function () {
              const v = parseFloat(i.value);
              if (!isNaN(v)) ustawKlucze({ [klucz]: v }, klucz);
            });
            ster.appendChild(i);
            return i;
          };
          ster._a = pole(p.k);
          el(ster, 'sk-liczby-do', '→');
          ster._b = pole(p.para);
        } else if (p.typ === 'siatka') {
          // Dwie liczby zamiast pary z listy: silnik i tak przyjmuje 1..6 na każdą oś, a układ
          // pól dobiera się pod zawartość ekranu, nie pod ładny kwadrat.
          ster = el(wiersz, 'sk-liczby');
          const bok = function (i) {
            const inp = document.createElement('input');
            inp.type = 'number'; inp.className = 'sk-liczba'; inp.min = 1; inp.max = 6; inp.step = 1;
            inp.addEventListener('change', function () {
              const v = Math.max(1, Math.min(6, Math.round(parseFloat(inp.value) || 1)));
              const s = (u.siatka || [2, 2]).slice();
              s[i] = v;
              ustawKlucze({ siatka: s }, 'siatka');
            });
            ster.appendChild(inp);
            return inp;
          };
          ster._a = bok(0);
          el(ster, 'sk-liczby-do', '×');
          ster._b = bok(1);
        } else if (p.typ === 'ksztalty') {
          ster = el(wiersz, 'sk-ksztalty');
          NS.KSZTALTY.forEach(function (kk) {
            const b = el(ster, 'sk-ksztalt', null, 'button');
            b._ks = kk;
            b.addEventListener('click', function () {
              // Kształt jest PROPORCJĄ, więc przestawia też jednostkę — inaczej „dolna 1/3"
              // wpisana w pola pikselowe znaczyłaby prostokąt 25×100 px w lewym górnym rogu.
              ustawKlucze({ obszarJednostka: 'procent', obszarX1: kk.v[0], obszarY1: kk.v[1],
                            obszarX2: kk.v[2], obszarY2: kk.v[3] }, 'obszarKsztalt');
            });
          });
        } else if (p.typ === 'akcje') {
          ster = el(wiersz, 'sk-akcje');
          NS.AKCJE.forEach(function (a) {
            const b = el(ster, 'sk-akcja', null, 'button');
            b._kod = a.kod;
            el(b, 'sk-akcja-ikona', a.ikona);
            el(b, 'sk-akcja-nazwa');
            if (a.klawisze) el(b, 'sk-akcja-skrot', a.klawisze.toUpperCase());
            b.addEventListener('click', function () {
              const lista = (u.menuPozycje || []).slice();
              const i = lista.indexOf(a.kod);
              if (i >= 0) lista.splice(i, 1); else lista.push(a.kod);
              ustaw(p, lista);
            });
          });
        }
        if (p.opis) opis = el(wiersz, 'sk-opis');
        kontrolki.push({ p: p, wiersz: wiersz, ster: ster, odczyt: odczyt, nazwa: nazwa, opis: opis, pole: pole });
      });
      if (pietra && typeof global.rfTier === 'function') sekcje.forEach(function (s) {
        s.sync = global.rfTier(s.fold, 'skaner.' + s.p.id, {
          sum: function () { return self.podsumowanie(s.pola); },
          changed: function () { return self.zmienione(s.pola); },
          reset: function () { self.domyslne(s.pola); },
          take: function () { return self.migawka(s.pola); },
          restore: function (m) { self.przywroc(m); }
        });
      });
      odswiez();
    };

    /* ---- piętra: podsumowanie, „zmienione”, domyślne i migawka dla listy pól ----
       Liczymy z `u`/`w` i z `DOMYSLNE`/`WYGLAD_DOM`, nie z kontrolek: segmenty i przełączniki
       tego panelu to własne przyciski, których rfTier nie umie odczytać sam. */
    const _tl = function (s) { return (typeof global._cvT === 'function') ? global._cvT(s) : s; };
    // `_lang` to `let` z rf-01 (nie właściwość `window`), więc czytamy go wprost, nie przez `global`.
    const _en = function () { return typeof _lang !== 'undefined' && _lang === 'en'; };
    const _bezNawiasu = function (s) { return String(s || '').replace(/\s*\([^)]*\)/g, '').trim(); };
    function _klucze(p) { return (p.typ === 'ksztalty') ? [] : (p.para ? [p.k, p.para] : [p.k]); }
    function _dom(p, k) { return p.wyglad ? NS.WYGLAD_DOM[k] : (NS.DOMYSLNE || {})[k]; }
    function _teraz(p, k) { return p.wyglad ? w[k] : u[k]; }
    function _rowne(a, b) {
      if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
      return JSON.stringify(a) === JSON.stringify(b);
    }
    function _kopia(v) { return (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v; }
    function _widoczne(lista) { return lista.filter(function (p) { return !p.gdy || p.gdy(u, w); }); }
    this.zmienione = function (lista) {
      const byly = {};
      let n = 0;
      _widoczne(lista).forEach(function (p) {
        let inne = false;
        _klucze(p).forEach(function (k) {
          if (byly[k]) return;
          byly[k] = true;
          const d = _dom(p, k);
          if (d !== undefined && !_rowne(_teraz(p, k), d)) inne = true;
        });
        if (inne) n++;
      });
      return n;
    };
    this.podsumowanie = function (lista) {
      const czesci = [];
      _widoczne(lista).forEach(function (p) {
        const v = wart(p);
        let s = '';
        if (p.typ === 'segment') {
          const o = p.opcje.filter(function (o) { return p.liczba ? +o[0] === +v : o[0] === v; })[0];
          if (!o) return;
          s = p.liczba ? _bezNawiasu(_tl(p.nazwa)) + ': ' + v : _bezNawiasu(_tl(o[1]));
        } else if (p.typ === 'wybor') {
          if (p.opcjeZ === 'AKCJE') s = _tl(p.nazwa) + ': ' + (NS.nazwaAkcji ? NS.nazwaAkcji(v) : v);
          else {
            const opcje = p.opcjeZ === 'EKRANY' ? (NS.ekranyOpcje ? NS.ekranyOpcje() : []) : p.opcje;
            const o = opcje.filter(function (o) { return String(o[0]) === String(v); })[0];
            s = o ? _bezNawiasu(_tl(o[1])) : '';
          }
        } else if (p.typ === 'suwak') s = _bezNawiasu(_tl(p.nazwa)) + ' ' + formatuj(p, v);
        else if (p.typ === 'przel') s = _bezNawiasu(_tl(p.nazwa)) + ': ' + (v ? (_en() ? 'yes' : 'tak') : (_en() ? 'no' : 'nie'));
        else if (p.typ === 'siatka') s = (u.siatka || [2, 2]).join('×');
        if (!s) return;
        czesci.push(czesci.length ? s.charAt(0).toLowerCase() + s.slice(1) : s);
      });
      const out = czesci.join(' · ');
      return _en() ? out : out.replace(/(\d)\.(\d)/g, '$1,$2');
    };
    this.domyslne = function (lista) {
      lista.forEach(function (p) {
        _klucze(p).forEach(function (k) {
          const d = _dom(p, k);
          if (d !== undefined) (p.wyglad ? w : u)[k] = _kopia(d);
        });
      });
      naZmiane(u, w, 'zestaw');
      odswiez();
    };
    this.migawka = function (lista) {
      const m = { u: {}, w: {} };
      lista.forEach(function (p) {
        _klucze(p).forEach(function (k) { (p.wyglad ? m.w : m.u)[k] = _kopia(_teraz(p, k)); });
      });
      return m;
    };
    this.przywroc = function (m) {
      if (!m) return;
      for (const k in (m.u || {})) u[k] = _kopia(m.u[k]);
      for (const k in (m.w || {})) w[k] = _kopia(m.w[k]);
      naZmiane(u, w, 'zestaw');
      odswiez();
    };
    // Pola piętra 3 (dla zwijaka „Zaawansowane” karty, który liczy i przywraca je jednym blokiem).
    this.polaZaaw = function () {
      return sekcje.reduce(function (a, s) { return a.concat(s.zaaw); }, []);
    };

    function odswiez() {
      kontrolki.forEach(function (k) {
        const p = k.p;
        if (p.sek) { k.sek.textContent = p.sek; return; }
        const widoczne = !p.gdy || p.gdy(u, w);
        k.wiersz.classList.toggle('sk-ukryte', !widoczne);
        if (!widoczne) return;
        k.nazwa.textContent = p.nazwa;
        if (k.opis) k.opis.textContent = p.opis;
        const v = wart(p);
        if (p.typ === 'suwak') {
          /* ⚠️ SUWAK ROZCIĄGA SIĘ DO WARTOŚCI WPISANEJ RĘCZNIE. Bez tego przy 40 px/s (poniżej
             widełek suwaka) gałka stałaby na 100 i pierwsze dotknięcie suwaka wyrzucałoby
             ustawienie z powrotem w górę — czyli wpisana liczba wyglądałaby na przyjętą,
             a znikała przy pierwszym ruchu. */
          const lo = Math.min(p.min, v), hi = Math.max(p.max, v);
          if (+k.ster.min !== lo) k.ster.min = lo;
          if (+k.ster.max !== hi) k.ster.max = hi;
          if (document.activeElement !== k.ster) k.ster.value = v;
          if (k.pole) { if (document.activeElement !== k.pole) k.pole.value = v; }
          else k.odczyt.textContent = formatuj(p, v);
        } else if (p.typ === 'segment') {
          for (let i = 0; i < k.ster.children.length; i++) {
            const b = k.ster.children[i];
            b.textContent = b._kl;
            // ⚠️ TRZECI ARGUMENT `classList.toggle` MUSI BYĆ PRAWDZIWYM `true`/`false`.
            // Stało tu `b._v === v || (p.liczba && +b._v === +v)`, a w polu BEZ `liczba` daje to
            // `false || undefined`, czyli `undefined` — i wtedy `toggle` nie gasi klasy, tylko JĄ
            // PRZEŁĄCZA. Niewybrane przyciski zapalały się więc i gasły co odświeżenie panelu,
            // a że odświeżeń jest tyle, ile zmian pokręteł, wyglądało to na zapalanie się
            // „w losowej kolejności" (objaw: kilka czarnych przycisków
            // naraz w jednym rzędzie — „Pasy", „Ćwiartki" i „Radar" jednocześnie).
            const wybrany = p.liczba ? (+b._v === +v) : (b._v === v);
            b.classList.toggle('sk-seg-wybrany', wybrany);
          }
          k.odczyt.textContent = '';
        } else if (p.typ === 'wybor') {
          const opcje = p.opcjeZ === 'AKCJE'
            ? NS.AKCJE.filter(function (a) { return a.kod !== 'anuluj' && a.kod !== 'klawiatura'; })
              .map(function (a) { return [a.kod, NS.nazwaAkcji(a.kod)]; })
            : p.opcjeZ === 'EKRANY' ? NS.ekranyOpcje()
            : p.opcje.map(function (o) { return [o[0], o[1]]; });
          // Lista monitorów przychodzi z serwera i potrafi się zmienić PRZY TEJ SAMEJ DŁUGOŚCI
          // (przepięty kabel, inna nazwa), a wtedy sama pętla podmieniająca napisy zostawiłaby
          // stare `value`. Odcisk jest tańszy niż przebudowa co odświeżenie.
          const odcisk = JSON.stringify(opcje);
          if (k.ster._odcisk !== odcisk) { k.ster._odcisk = odcisk; k.ster._jezyk = null; }
          if (k.ster.children.length !== opcje.length || k.ster._jezyk !== 'pl') {
            k.ster.innerHTML = '';
            opcje.forEach(function (o) {
              const op = document.createElement('option');
              op.value = o[0]; op.textContent = o[1];
              k.ster.appendChild(op);
            });
            k.ster._jezyk = 'pl';
          } else {
            for (let i = 0; i < opcje.length; i++) k.ster.children[i].textContent = opcje[i][1];
          }
          k.ster.value = p.para ? (v || []).join(',') : v;
          k.odczyt.textContent = '';
        } else if (p.typ === 'kolor') {
          if (document.activeElement !== k.ster) k.ster.value = v || '#ec1a83';
          k.odczyt.textContent = (v || '').toUpperCase();
        } else if (p.typ === 'przel') {
          k.ster.classList.toggle('sk-wl', !!v);
          k.odczyt.textContent = '';
        } else if (p.typ === 'liczba') {
          const proc = (u.obszarJednostka !== 'piksele');
          [[k.ster._a, p.k], [k.ster._b, p.para]].forEach(function (para) {
            const inp = para[0];
            inp.min = 0; inp.max = proc ? 100 : 32000; inp.step = proc ? 0.1 : 1;
            if (document.activeElement !== inp) {
              const v = +u[para[1]] || 0;
              inp.value = proc ? Math.round(v * 10) / 10 : Math.round(v);
            }
          });
          k.odczyt.textContent = proc ? '%' : 'px';
        } else if (p.typ === 'siatka') {
          const s = u.siatka || [2, 2];
          if (document.activeElement !== k.ster._a) k.ster._a.value = s[0];
          if (document.activeElement !== k.ster._b) k.ster._b.value = s[1];
          k.odczyt.textContent = (s[0] * s[1]) + ' ' + _polaSlowo(s[0] * s[1]);
        } else if (p.typ === 'ksztalty') {
          for (let i = 0; i < k.ster.children.length; i++) {
            const b = k.ster.children[i], ks = b._ks;
            b.textContent = ks.nazwa;
            // Podświetlony jest ten kształt, który obszar AKTUALNIE ma — żeby po powrocie do
            // karty dało się przeczytać „to jest dolna 1/3", a nie cztery liczby do złożenia.
            const teraz = (u.obszarJednostka === 'procent'
              && Math.abs((+u.obszarX1 || 0) - ks.v[0]) < 0.6 && Math.abs((+u.obszarY1 || 0) - ks.v[1]) < 0.6
              && Math.abs((+u.obszarX2 || 0) - ks.v[2]) < 0.6 && Math.abs((+u.obszarY2 || 0) - ks.v[3]) < 0.6);
            b.classList.toggle('sk-ksztalt-wl', teraz);
          }
          k.odczyt.textContent = '';
        } else if (p.typ === 'akcje') {
          const lista = u.menuPozycje || [];
          for (let i = 0; i < k.ster.children.length; i++) {
            const b = k.ster.children[i];
            b.querySelector('.sk-akcja-nazwa').textContent = NS.nazwaAkcji(b._kod);
            b.classList.toggle('sk-akcja-wl', lista.indexOf(b._kod) >= 0);
          }
          k.odczyt.textContent = lista.length + ' ' + 'w menu';
        }
      });
      // Grupa w „Zaawansowanych”, której wszystkie pola są w tym trybie bez znaczenia, znika razem
      // z nagłówkiem; nagłówki zwijaków liczą się od razu (rfTier sam przelicza tylko co 1,5 s).
      sekcje.forEach(function (s) {
        if (s.grupa) s.grupa.hidden = !s.grupa.querySelector('.sk-wiersz:not(.sk-ukryte)');
        if (s.sync) s.sync();
      });
    }
    this.odswiez = odswiez;
    this.podepnij = function (noweU, noweW) { u = noweU; w = noweW; odswiez(); };

    this.zastosujZestaw = function (kod) {
      const z = NS.ZESTAWY[kod];
      if (!z) return;
      const zachowane = {};
      OSOBISTE.forEach(function (k) { zachowane[k] = u[k]; });
      for (const k in NS.DOMYSLNE) u[k] = NS.DOMYSLNE[k];   // najpierw czysta kartka…
      for (const k in z.u) u[k] = z.u[k];                   // …potem zestaw…
      for (const k in zachowane) u[k] = zachowane[k];       // …i to, co osobiste, z powrotem
      for (const k in (z.w || {})) w[k] = z.w[k];
      naZmiane(u, w, 'zestaw');
      odswiez();
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(typeof window !== 'undefined' ? window : globalThis);
