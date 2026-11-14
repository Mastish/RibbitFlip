"use strict";
/* SKANER EKRANU — silnik: czysta logika, zero DOM.

   DLACZEGO SILNIK JEST TUTAJ, A NIE W PYTHONIE. Koło wyboru ma silnik po stronie serwera
   i lustro w JS, przez co musi istnieć `test_wheel_mirror.py` pilnujący, żeby dwie kopie tej
   samej matematyki się nie rozjechały. Skaner mierzy PIKSELE EKRANU i po nich rysuje: strona
   i tak musi znać całą geometrię, więc druga kopia w Pythonie dawałaby wyłącznie okazję do
   rozjazdu. Serwer trzyma konfigurację, rozgłasza sygnał i otwiera okno — nic ponadto
   (patrz `ScanModule` w ribbitflip_monitor.py).

   ⚠️ KLUCZE USTAWIEŃ MUSZĄ SIĘ ZGADZAĆ z `ScanModule.DEFAULTS` po stronie serwera. Pilnuje
   tego `tests/test_scan_model.py` — nazwa, której nie ma po drugiej stronie, zapisze się
   i zniknie przy pierwszym odczycie, i to bez jednego błędu w konsoli.

   Pomysł w jednym zdaniu: człowiek ma JEDEN sygnał (przycisk, przechył kapsla, mrugnięcie),
   a ekran ma dwa wymiary — więc czas zastępuje przestrzeń. Pasek jedzie sam, człowiek go
   zatrzymuje, i tak raz po raz, aż zostanie jeden punkt.

   Kontrakt:
     const s = new RFS.Silnik({ ustawienia, ekran:{x,y,w,h}, cele:[…] });
     s.sygnal('start', t)      // naciśnięcie sygnału głównego
     s.puszczenie(t)           // puszczenie (potrzebne do czasu przytrzymania)
     s.cofnij(t)               // sygnał drugi
     s.krok(t) -> stan         // wołane co klatkę; zwraca to, co ma narysować scena
   Czas `t` zawsze w milisekundach (performance.now albo dowolny licznik w teście). */

// ------------------------------------------------------------------------------------------
//  POMOCNIKI JĘZYKOWE — tutaj, a nie w karcie, bo potrzebują ich OBA światy skanera: karta
//  w panelu i osobna strona okna nad pulpitem (`skaner-nakladka.html`), która karty nie ładuje.
//  Napisy STAŁE tłumaczy walker i18n po treści (rf-01-i18n.js); te trzy są dla tekstów liczonych
//  w locie — tak samo jak `_wheelT` w kole.
// ------------------------------------------------------------------------------------------
function _scanT(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }
function _scanTf(pl, en) {
  let s = _scanT(pl, en);
  for (let i = 2; i < arguments.length; i++) s = s.split("{" + (i - 2) + "}").join(arguments[i]);
  return s;
}
function _scanFaza(f) {
  const M = {
    spoczynek: ["Czekam na sygnał", "Waiting for a signal"],
    odliczanie: ["Za chwilę…", "About to start…"],
    biegnie: ["Skanuję", "Scanning"],
    odpoczywa: ["Odpoczywam", "Resting"],
    menu: ["Wybierz akcję", "Pick an action"],
    gotowe: ["Gotowe", "Done"]
  };
  const p = M[f] || [f, f];
  return _scanT(p[0], p[1]);
}

(function (global) {
  'use strict';
  const NS = global.RFScan = global.RFScan || {};

  /* ---------- USTAWIENIA DOMYŚLNE ---------------------------------------
     Zakresy wzięte z przewodnika Colvena i Judge'a („Switch access to technology”)
     oraz z tego, co realnie wystawiają Apple (Switch Control) i Android (Switch Access).
     Wszystkie czasy w ms, odległości w px. */
  NS.DOMYSLNE = {
    tryb: 'pasy',                 // pasy | cwiartki | elementy | radar
    ruch: 'skokowy',               // plynny | skokowy  (skokowy = pasek przeskakuje o własną szerokość)

    // --- pasy (skanowanie punktu) ---
    kolejnosc: 'Y-X',             // Y-X = najpierw poziomy pasek jedzie w dół, potem pionowy w bok
    przebiegi: 2,                 // 1 = jeden przejazd na oś, 2 = drugi, dokładny, wewnątrz pasma
    pasmoY: 170,                  // WYSOKOŚĆ paska poziomego (px)
    pasmoX: 200,                  // SZEROKOŚĆ paska pionowego (px) — osobno, bo ekran jest szerszy niż wyższy
    skok: 0,                      // o ile przeskakuje w ruchu skokowym; 0 = o własną grubość
    pasmoDokladnyY: 6,            // grubość linii w dokładnym przebiegu POZIOMYM (px)
    pasmoDokladnyX: 6,            // …i w PIONOWYM — osobno, bo ekran jest szerszy niż wyższy
    // ⚠️ POKRYCIE (ile pasek zajmuje W POPRZEK ruchu) siedzi w WYGLĄDZIE, nie tutaj — bo czyta
    // je scena, a scena dostaje wygląd. Trzymane po tej stronie było martwym suwakiem: liczba
    // się zapisywała, pasek się nie zmieniał. Patrz `NS.WYGLAD_DOM` w rf-50b.
    predkosc: 700,                // px/s w przebiegu zgrubnym
    mnoznikDokladny: 0.28,        // przebieg dokładny jest wolniejszy o tyle
    kierunek: 'wahadlo',          // jeden | wahadlo — zawracanie jest łagodniejsze dla oka
    czasKroku: 900,               // ms na jeden przeskok, gdy ruch = skokowy

    // --- cwiartki (podział ekranu) ---
    siatka: [2, 2],               // kolumny × wiersze
    czasBloku: 900,               // ms na jeden blok
    progKoncaBloku: 90,           // gdy blok schodzi poniżej tylu px — koniec podziału
    poziomyMax: 4,
    // JAK PRZECHODZIĆ KRATKĘ. Przy ćwiartkach potrzebne jest skanowanie najpierw wierszy,
    // a później kolumn (wyszło przy testach w Sol Cesto).
    //   'kratka'  — każde pole osobno, po kolei (tak było do 14.09). Kratka 4×4 = do 16 zapaleń.
    //   'wiersze' — najpierw całe WIERSZE, po wybraniu wiersza jego POLA. 4×4 = do 4+4 zapaleń.
    //   'kolumny' — to samo w drugą stronę (najpierw kolumny, potem pola kolumny).
    // Przy kratce 2×2 różnicy nie ma (4 pola vs 2+2), zysk rośnie z rozmiarem siatki — dlatego
    // domyślna zostaje 'kratka': zmiana domyślnej przestawiłaby skaner pod ludźmi, którzy go
    // już mają nastrojonego.
    cwiartkiKolejnosc: 'kratka',  // kratka | wiersze | kolumny
    // Co po OSTATNIEJ ćwiartce: 'klik' = kliknij jej środek (tak było do 11.09),
    // 'paski' = przejedź po niej paskami, jak w trybie „pasy", tylko WEWNĄTRZ tego pola.
    // Po co: same ćwiartki trafiają w środek pola, a nie w rzecz — przy gęstym menu ostatnie
    // pole ma jeszcze kilka klikalnych rzeczy. Dwa paski w środku kosztują dwa sygnały i dają
    // punkt zamiast środka kwadratu.
    poCwiartkach: 'klik',         // klik | paski

    // --- GDZIE skaner ma działać ---
    // Okno stoi na całym pulpicie, ale skanować ma tam, gdzie w danej grze albo aplikacji jest
    // co klikać, np. tylko dolna 1/3 ekranu na środku; wtedy użytkownik może obsługiwać
    // konkretne sekcje gier.
    //   obszar          caly (cały pulpit) | monitor (cały wybrany ekran) | wlasny (od–do)
    //   obszarMonitor   nazwa ekranu z /screens; "" = cały pulpit jako baza
    //   obszarJednostka procent | piksele — obie, bo „w niektórych aplikacjach i parametrach
    //                   ekranów" liczy się dokładny piksel, a w innych proporcja
    //   obszar{X1,Y1,X2,Y2}  od–do WEWNĄTRZ bazy (patrz `NS.obszarEkranu`)
    obszar: 'caly',
    obszarMonitor: '',
    obszarJednostka: 'procent',
    obszarX1: 0, obszarY1: 0, obszarX2: 100, obszarY2: 100,
    // ZRZUT EKRANU GRY POD PODGLĄDEM — sama nazwa pliku z `Settings/ScanTla` (obraz wgrywa się
    // trasą `/scan/tlo`, patrz rf-50l). Silnika to nie dotyczy w ogóle: zrzut jest TŁEM ramki
    // podglądu, po którym człowiek wyznacza obszar, a nie żadnym parametrem przejazdu. Stoi tu
    // dlatego, że komplet nazw musi się zgadzać z `ScanModule.DEFAULTS` (test_scan_model.py).
    tlo: '',
    /* PLANSZE, czyli widoki gry (16.09; nazwa z 20.09). Zrzut należy do PLANSZY, a nie do
       skanera — bo ten sam skaner (choćby „cały ekran") bywa potrzebny na kilku widokach,
       a pole przy sekcji pozwalało tylko na jeden. Kształt: [{plik, nazwa, sekcje:[numery], w, h}];
       `w`/`h` to rozdzielczość EKRANU, z którego pochodzi zrzut (0 = nieznana). `zrzutAktywny`
       to 1..N albo 0 = PULPIT TESTOWY (rysowany, z ikonami — na nim ćwiczy się bez zrzutu
       i widać wszystkie skanery naraz).
       Pola CAŁEJ konfiguracji, nie sekcji — patrz `ScanModule._POZA_SEKCJA` po stronie serwera. */
    zrzuty: [], zrzutAktywny: 0,
    /* Rozdzielczość PULPITU TESTOWEGO. 0 = „tyle, co mój ekran" — panel podstawia wtedy rozmiar
       monitora z `/screens`. Wpisana ręcznie zostaje w konfiguracji (i jedzie w presecie), bo
       ustawia się skaner pod ekran, na którym ma potem pracować — nie zawsze ten, przy którym
       się siedzi. */
    szablonW: 0, szablonH: 0,

    // --- radar ---
    stopnieNaSek: 90,
    predkoscPromienia: 500,

    // --- elementy ---
    wzorElementow: 'wiersz-kolumna', // liniowy | wiersz-kolumna
    czasElementu: 900,

    // --- czasy wspólne (dostępność) ---
    opoznienieStartu: 1000,        // „delay on first item” — ile stać, zanim ruszy
    czasPrzytrzymania: 0,         // „acceptance time” — ile trzymać, żeby sygnał się liczył
    blokadaPoWyborze: 600,        // „post-activation delay” — ile nie przyjmować kolejnego
    odbicie: 80,                  // „debounce” — ignoruj drugie naciśnięcie tuż po puszczeniu
    wyprzedzenie: 0,              // poprawka na czas reakcji: cofa odczyt pozycji o tyle ms
    nawroty: 3,                   // ile przejazdów bez sygnału, zanim silnik odpocznie
    pauzaNaKrancach: 900,         // ms PRAWDZIWEGO postoju na krańcu — pasek staje, dopiero potem wraca

    // --- co się dzieje po wskazaniu punktu ---
    dociaganie: 100,               // px: przyciągnij punkt do najbliższego celu (0 = nie dociągaj)
    menuAkcji: false,             // true = po punkcie skanowane menu akcji
    akcjaDomyslna: 'lewy',        // co robimy bez pytania
    menuPozycje: ['lewy', 'dwuklik', 'prawy', 'przeciagnij', 'kopiuj', 'wklej', 'anuluj'],
    powrotPoAkcji: 'spoczynek',   // spoczynek | odRazu (od razu nowy cykl)
    // JAK NAZYWA SIĘ TO, CO KAPSEL NOSI. Pole konfiguracji, a nie osobny stan — dzięki temu
    // jedzie razem z nią wszędzie: do pliku, do presetu, na pasek biblioteki. ⚠️ Musi istnieć
    // po OBU stronach (ScanModule.DEFAULTS), inaczej zapisze się i zniknie przy odczycie.
    configName: '',
    // SEKCJE — kilka różnych skanerów w jednej konfiguracji; pola PŁASKIE powyżej to ta aktywna.
    // Cała obsługa spisu siedzi po stronie serwera (`ScanModule._sekcje_out`), bo to jedno
    // miejsce, przez które i tak przechodzi każdy zapis. Tutaj są tylko po to, żeby lista kluczy
    // zgadzała się po obu stronach — pilnuje tego `tests/test_scan_model.py`.
    sekcje: [],
    sekcjaAktywna: 1
  };

  /* ---------- GDZIE SKANER MA DZIAŁAĆ -----------------------------------
     Rozwinięcie ustawień obszaru do prostokąta, w którym pracuje silnik.

     TRZY PRZESTRZENIE WSPÓŁRZĘDNYCH i to jest cała trudność tej funkcji:
       1. ustawienia — od–do w procentach albo pikselach, liczone WEWNĄTRZ bazy,
       2. pulpit — piksele Windowsa; monitor po lewej ma współrzędne UJEMNE,
       3. cel — to, w czym rysuje wołający: okno nad pulpitem (CSS px, zaczyna się w 0,0)
          albo ramka podglądu w karcie (kilkaset px).
     Przejście 2→3 idzie przez UŁAMKI pulpitu, nigdy przez piksele: okno ma inną skalę niż
     pulpit przy dowolnym powiększeniu Windows, a ułamek jest na to odporny — dokładnie z tego
     samego powodu, dla którego kliknięcie wychodzi stąd w procentach (`mouse:left@x%,y%`).

     `ekrany` to odpowiedź `/screens` ({screens, desktop}) albo nic. Bez niej baza jest po prostu
     całym `pelny` — tak liczy się podgląd w karcie, który żadnego pulpitu nie udaje. */
  NS.obszarEkranu = function (u, pelny, ekrany) {
    u = u || {};
    const cel = { x: (pelny && pelny.x) || 0, y: (pelny && pelny.y) || 0,
                  w: Math.max(1, (pelny && pelny.w) || 1), h: Math.max(1, (pelny && pelny.h) || 1) };
    const rodzaj = u.obszar || 'caly';
    if (rodzaj === 'caly' && !u.obszarMonitor) return cel;

    const pulpit = (ekrany && ekrany.desktop) ? ekrany.desktop : null;
    const lista = (ekrany && Array.isArray(ekrany.screens)) ? ekrany.screens : [];
    // BAZA: wskazany ekran, a bez wskazania — cały pulpit.
    // ⚠️ EKRAN, KTÓREGO JUŻ NIE MA (wypięty kabel, inny układ u kogoś, kto dostał zestaw), spada
    // na PIERWSZY istniejący, a nie na cały pulpit. Cały pulpit znaczyłby „skanuj też na drugim
    // monitorze", czyli dokładnie odwrotnie niż prosił ktoś, kto wybrał jeden ekran.
    let baza = pulpit || { x: cel.x, y: cel.y, w: cel.w, h: cel.h };
    if (u.obszarMonitor) {
      const e = lista.filter(function (s) { return s && s.name === u.obszarMonitor; })[0] || lista[0];
      if (e) baza = { x: e.x, y: e.y, w: e.w, h: e.h };
    }
    let r = { x: baza.x, y: baza.y, w: baza.w, h: baza.h };
    if (rodzaj === 'wlasny') {
      const proc = (u.obszarJednostka !== 'piksele');
      const we = function (v, rozmiar) { return proc ? (rozmiar * (+v || 0) / 100) : (+v || 0); };
      let x1 = we(u.obszarX1, baza.w), x2 = we(u.obszarX2, baza.w);
      let y1 = we(u.obszarY1, baza.h), y2 = we(u.obszarY2, baza.h);
      if (x1 > x2) { const t = x1; x1 = x2; x2 = t; }
      if (y1 > y2) { const t = y1; y1 = y2; y2 = t; }
      x1 = Math.max(0, Math.min(baza.w, x1)); x2 = Math.max(0, Math.min(baza.w, x2));
      y1 = Math.max(0, Math.min(baza.h, y1)); y2 = Math.max(0, Math.min(baza.h, y2));
      // Prostokąt bez powierzchni to pasek, który nie ma się gdzie ruszyć — a wygląda jak zwis.
      // Minimum 24 px, bo poniżej i tak nie zmieści się żadne pasmo.
      if (x2 - x1 < 24) { x2 = Math.min(baza.w, x1 + 24); x1 = Math.max(0, x2 - 24); }
      if (y2 - y1 < 24) { y2 = Math.min(baza.h, y1 + 24); y1 = Math.max(0, y2 - 24); }
      r = { x: baza.x + x1, y: baza.y + y1, w: x2 - x1, h: y2 - y1 };
    }
    if (!pulpit) return r;   // brak wiedzy o pulpicie: `pelny` BYŁ bazą, więc już jesteśmy na miejscu
    const dw = Math.max(1, pulpit.w), dh = Math.max(1, pulpit.h);
    return { x: cel.x + ((r.x - pulpit.x) / dw) * cel.w,
             y: cel.y + ((r.y - pulpit.y) / dh) * cel.h,
             w: (r.w / dw) * cel.w,
             h: (r.h / dh) * cel.h };
  };

  /* WIDEŁKI, KTÓRE PRZYJMUJE SERWER — lustro `ScanModule._ZAKRESY` z `ribbitflip_monitor.py`
     (pilnuje tego `tests/test_scan_model.py`, tak samo jak zgodności nazw pokręteł).

     PO CO TO TUTAJ (16.09). Suwaki w panelu mają widełki WYGODNE — takie, w których mieści się
     zdecydowana większość ludzi, bo suwak z zakresem 20…6000 px/s byłby nieużywalny: jeden piksel
     ruchu myszą to skok o kilkadziesiąt. Ale suwaki m.in. prędkości kończyły się
     na 100 px/s, a nie każdy ma takie zdolności. Skaner jest
     narzędziem DOSTĘPNOŚCI, więc „dolna granica wygodna dla większości" nie może być granicą
     twardą. Pole liczbowe obok suwaka przyjmuje więc CAŁY zakres serwera, a suwak rozciąga się do
     wpisanej wartości, żeby dalej pokazywał prawdę. */
  NS.ZAKRESY = {
    przebiegi: [1, 2], pasmoY: [8, 800], pasmoX: [8, 800], skok: [0, 800],
    pasmoDokladnyY: [2, 60], pasmoDokladnyX: [2, 60],
    pokrycieY: [5, 100], pokrycieX: [5, 100], kryciePasma: [0.0, 1.0],
    predkosc: [20, 6000], mnoznikDokladny: [0.05, 1.0],
    czasKroku: [60, 6000], czasBloku: [120, 6000], progKoncaBloku: [10, 500],
    poziomyMax: [1, 8], stopnieNaSek: [5, 720], predkoscPromienia: [40, 4000],
    czasElementu: [120, 6000], opoznienieStartu: [0, 6000],
    czasPrzytrzymania: [0, 3000], blokadaPoWyborze: [0, 6000],
    odbicie: [0, 1000], wyprzedzenie: [-1000, 2000], nawroty: [0, 20],
    pauzaNaKrancach: [0, 6000], dociaganie: [0, 400],
    przyciemnienie: [0.0, 0.95], podgladObszaru: [0.0, 0.6],
    grubosc: [1, 10], glosnosc: [0.0, 1.0],
    obszarX1: [0.0, 32000.0], obszarY1: [0.0, 32000.0],
    obszarX2: [0.0, 32000.0], obszarY2: [0.0, 32000.0],
    // Rozdzielczość pulpitu testowego: 0 znaczy „jak mój ekran", więc dół widełek to zero.
    szablonW: [0, 32000], szablonH: [0, 32000]
  };

  /* KOLOR SKANERA (sekcji) — PO POZYCJI W SPISIE, nie z zapisanego pola.

     Tożsamością sekcji jest jej numer: tak nazywa ją wyzwalacz (`scan:sekcja=2`), tak mówi o niej
     okno nad pulpitem i tak przesuwa się ona po usunięciu sąsiadki. Kolor zapisany w pliku
     musiałby przy takim usunięciu albo zostać (dwie sekcje w tej samej barwie), albo się przesunąć
     — czyli i tak wynikać z pozycji. Przy okazji: zero nowych pól w konfiguracji i zero migracji
     cudzych presetów.

     Osiem barw na osiem sekcji (`ScanModule.SEKCJI_MAX`). Pierwsza to różowy osi Y, czyli ten,
     którym podgląd rysował obszar, zanim sekcje dostały kolory — przy jednym skanerze nic więc
     nie zmienia wyglądu. Reszta dobrana tak, żeby dało się je rozróżnić na ciemnym zrzucie gry,
     na pulpicie i obok siebie w pasku.

     Tutaj, a nie w pasku sekcji (rf-50k): tej samej barwy używa karta, podgląd w ramce i okno nad
     pulpitem, a ten plik jest jedynym, który ładują wszystkie trzy. */
  NS.KOLORY_SEKCJI = ['#ec1a83', '#6cb33f', '#eaa32b', '#1f93c9',
                      '#8a52d9', '#0fa3a3', '#e2552f', '#6a7bf0'];
  NS.kolorSekcji = function (n) {
    const i = Math.max(1, parseInt(n, 10) || 1) - 1;
    return NS.KOLORY_SEKCJI[i % NS.KOLORY_SEKCJI.length];
  };

  /* BAZA, w której liczy się od–do: wskazany ekran albo cały pulpit. W pikselach pulpitu.
     `null`, dopóki serwer nie powie, jak wyglądają monitory — wtedy nie ma czego przeliczać. */
  NS.bazaObszaru = function (u, ekrany) {
    const b = NS.bazaProstokat(u, ekrany);
    return b ? { w: b.w, h: b.h } : null;
  };

  /* EKRAN SKANERA — przy kilku monitorach skaner pracuje na JEDNYM (2026-09-26).

     Objaw: przy dwóch monitorach podgląd rozdzielczości działał źle, a zrzuty były ucięte,
     jakby nie skalowały się do dwóch ekranów. Okno nad pulpitem
     rozpinało się na wszystkie ekrany, a Windows daje oknu jedno powiększenie — przy laptopie 150%
     obok monitora 100% rysunek był w złej skali na jednym z nich. Ramka podglądu udawała przy tym
     oba ekrany naraz, a plansza (zrzut JEDNEGO monitora) była na nią rozciągana.

     Od teraz „cały pulpit" przy kilku monitorach znaczy „cały ekran skanera", a ekranem skanera jest:
       1. wskazany wprost (`obszarMonitor`; nieistniejący spada na pierwszy, jak w `obszarEkranu`),
       2. monitor aktywnej planszy — zrzut skrótem zapamiętuje, skąd jest,
       3. monitor, do którego rozmiar planszy pasuje w PRAWDZIWYCH pikselach (dokładnie jeden),
       4. główny.
     ⚠️ LUSTRO `scan_ekran_docelowy` w ribbitflip_monitor.py — serwer stawia okno tam, gdzie ta
     funkcja każe panelowi rysować podgląd. Rozjazd = podgląd pokazuje inny ekran niż ten, nad
     którym jedzie pasek (pilnuje tego tests/test_scan_ekrany.py). */
  NS.ekranSkanera = function (u, ekrany) {
    const e = ekrany || NS.ekrany;
    const lista = (e && Array.isArray(e.screens)) ? e.screens.filter(function (s) { return s && typeof s === 'object'; }) : [];
    if (!lista.length) return null;
    u = u || {};
    const poNazwie = function (n) {
      return n ? (lista.filter(function (s) { return s.name === n; })[0] || null) : null;
    };
    if (u.obszarMonitor) return poNazwie(String(u.obszarMonitor)) || lista[0];
    const zr = Array.isArray(u.zrzuty) ? u.zrzuty : [];
    const k = parseInt(u.zrzutAktywny, 10) || 0;
    const pl = (k >= 1 && k <= zr.length && zr[k - 1] && typeof zr[k - 1] === 'object') ? zr[k - 1] : null;
    if (pl) {
      const m = poNazwie(pl.monitor ? String(pl.monitor) : '');
      if (m) return m;
      const pw = parseInt(pl.w, 10) || 0, ph = parseInt(pl.h, 10) || 0;
      if (pw > 0 && ph > 0) {
        const pasuje = lista.filter(function (s) {
          return (parseInt(s.pw || s.w, 10) || 0) === pw && (parseInt(s.ph || s.h, 10) || 0) === ph;
        });
        if (pasuje.length === 1) return pasuje[0];
      }
    }
    return lista.filter(function (s) { return s.primary; })[0] || lista[0];
  };

  /* BAZA OBSZARU z narożnikiem, w pikselach pulpitu: wskazany ekran, przy kilku monitorach ekran
     skanera (patrz wyżej), a przy jednym — cały pulpit, jak zawsze. `null` bez wiedzy o monitorach. */
  NS.bazaProstokat = function (u, ekrany) {
    const e = ekrany || NS.ekrany;
    if (!e || !e.desktop) return null;
    const lista = Array.isArray(e.screens) ? e.screens : [];
    if ((u && u.obszarMonitor) || lista.length > 1) {
      const s = NS.ekranSkanera(u, e);
      if (s) return { x: s.x || 0, y: s.y || 0, w: s.w, h: s.h };
    }
    return { x: e.desktop.x || 0, y: e.desktop.y || 0, w: e.desktop.w, h: e.desktop.h };
  };

  /* UKŁAD MONITORÓW Z PUNKTU WIDZENIA OKNA, KTÓRE STOI NA JEDNYM Z NICH (2026-09-26).

     Okno nad pulpitem przy kilku monitorach zajmuje jeden ekran (serwer podaje go w adresie,
     `&ekran=`). Dla wszystkiego, co w tym oknie rysuje i ustawia obszar, „pulpitem" jest więc TEN
     ekran — dokładnie tak, jak ramka podglądu w karcie udaje bazę obszaru (`scanEkranyPodgladu`).
     Prawdziwy pulpit zostaje w `pulpit`, bo w nim liczy się procent kliknięcia (`procentPulpitu`),
     a nazwa ekranu w `okno` — po niej pasek edytora wie, gdzie stać.
     Bez nazwy (jeden monitor, starszy serwer) albo z nazwą, której już nie ma, oddajemy układ bez
     zmian: okno stoi wtedy na całym pulpicie i tak ma liczyć. */
  NS.ekranyNaOkno = function (j, nazwa) {
    if (!j || !j.desktop || !nazwa) return j || null;
    const lista = Array.isArray(j.screens) ? j.screens : [];
    const m = lista.filter(function (s) { return s && s.name === nazwa; })[0];
    if (!m) return j;
    return Object.assign({}, j, {
      desktop: { x: m.x || 0, y: m.y || 0, w: m.w, h: m.h },
      okno: m.name, pulpit: j.desktop
    });
  };

  /* Odwrotność `ekranyNaOkno`: prawdziwy układ monitorów (pulpit z wszystkich ekranów). Bez okna
     na jednym z ekranów to ten sam obiekt. */
  NS.ekranyPelne = function (e) {
    if (!e || !e.pulpit) return e || null;
    return Object.assign({}, e, { desktop: e.pulpit, pulpit: undefined, okno: undefined });
  };

  /* SKANER Z WPISANYM EKRANEM (2026-09-26) — do liczenia obszaru w oknie, które stoi na JEDNYM
     z kilku monitorów. Skaner bez wskazanego ekranu (`obszarMonitor: ''`) nie mieszka „na pulpicie
     tego okna", tylko na ekranie skanera (`ekranSkanera`: plansza, a bez niej główny). Bez wpisania
     go wprost okno na drugim monitorze rysowałoby u siebie obszar, który naprawdę leży na pierwszym.
     `kontekst` = pełna konfiguracja: pozostałe skanery nie niosą spisu plansz, a to on decyduje. */
  NS.zMonitorem = function (u, ekrany, kontekst) {
    const lista = (ekrany && Array.isArray(ekrany.screens)) ? ekrany.screens : [];
    if (!u || u.obszarMonitor || lista.length < 2) return u;
    const z = kontekst ? Object.assign({}, u, { zrzuty: kontekst.zrzuty, zrzutAktywny: kontekst.zrzutAktywny }) : u;
    const s = NS.ekranSkanera(z, ekrany);
    return (s && s.name) ? Object.assign({}, u, { obszarMonitor: s.name }) : u;
  };

  /* Ekran dla człowieka: „2. DISPLAY2 · 1920×1080 (główny)". Rozdzielczość w PRAWDZIWYCH pikselach
     (`pw`/`ph`), bo tyle ma zrzut; przestrzeń kursora przy powiększeniu podaje mniej. */
  NS.opisEkranu = function (s, i) {
    if (!s) return '';
    const nm = String(s.name || '').replace(/^\\\\\.\\/, '') || ('#' + ((i || 0) + 1));
    const w = s.pw > 0 ? s.pw : s.w, h = s.ph > 0 ? s.ph : s.h;
    return ((s.i >= 0 ? s.i : (i || 0)) + 1) + '. ' + nm + (w && h ? ' · ' + w + '×' + h : '')
      + (s.primary ? _scanT(' (główny)', ' (main)') : '');
  };

  /* Punkt z okna nad pulpitem → procenty CAŁEGO pulpitu (tak mówi `mouse:left@x%,y%`). `pelny` to
     widok okna w pikselach pulpitu (0,0 w jego lewym górnym rogu). Gdy okno stoi na jednym z kilku
     monitorów, dokłada się przesunięcie tego monitora względem pulpitu. */
  NS.procentPulpitu = function (punkt, ekrany, pelny) {
    const p = punkt || { x: 0, y: 0 };
    const pul = ekrany && ekrany.pulpit, ok = ekrany && ekrany.desktop;
    if (pul && ok && pul.w > 0 && pul.h > 0) {
      return { x: (((ok.x || 0) - (pul.x || 0)) + p.x) / pul.w * 100,
               y: (((ok.y || 0) - (pul.y || 0)) + p.y) / pul.h * 100 };
    }
    const e = pelny || { w: 1, h: 1 };
    return { x: p.x / Math.max(1, e.w) * 100, y: p.y / Math.max(1, e.h) * 100 };
  };

  /* Zamiana jednostki BEZ ruszania prostokąta. Przełącznik „procenty / piksele" mówi, jak te same
     cztery liczby są ZAPISANE, a nie gdzie leży obszar — bez przeliczenia „dolna 1/3" (25…75%)
     stawała się po kliknięciu paskiem 25…75 px w rogu ekranu, czyli obszar skakał od zmiany
     samego sposobu mówienia o nim. Bez wiedzy o monitorach nie przeliczamy nic: zgadywanie
     rozmiaru ekranu przesunęłoby obszar dokładnie tak samo, tylko mniej widocznie. */
  NS.przeliczJednostke = function (u, nowa, ekrany) {
    const stara = (u.obszarJednostka === 'piksele') ? 'piksele' : 'procent';
    if (nowa === stara) return null;
    const baza = NS.bazaObszaru(u, ekrany);
    if (!baza) return null;
    const na = function (v, rozmiar) {
      return (nowa === 'piksele') ? (rozmiar * (+v || 0) / 100) : ((+v || 0) / rozmiar * 100);
    };
    const zaokr = function (v) { return (nowa === 'piksele') ? Math.round(v) : Math.round(v * 10) / 10; };
    return {
      obszarX1: zaokr(na(u.obszarX1, baza.w)), obszarX2: zaokr(na(u.obszarX2, baza.w)),
      obszarY1: zaokr(na(u.obszarY1, baza.h)), obszarY2: zaokr(na(u.obszarY2, baza.h))
    };
  };

  /* Gotowe kształty — „dolna 1/3 na środku" ma być jednym kliknięciem, a nie czterema liczbami
     do policzenia w głowie. Zawsze w PROCENTACH: kształt jest proporcją, a proporcja przenosi się
     między ekranami. Piksele zostają dla tych miejsc, gdzie liczy się konkretny piksel. */
  NS.KSZTALTY = [
    { kod: 'dol3',    nazwa: 'Dolna 1/3 na środku', v: [25, 66.7, 75, 100] },
    { kod: 'dolpas',  nazwa: 'Dolny pas',           v: [0, 75, 100, 100] },
    { kod: 'gorapas', nazwa: 'Górny pas',           v: [0, 0, 100, 25] },
    { kod: 'lewa',    nazwa: 'Lewa połowa',         v: [0, 0, 50, 100] },
    { kod: 'prawa',   nazwa: 'Prawa połowa',        v: [50, 0, 100, 100] },
    { kod: 'srodek',  nazwa: 'Środek ekranu',       v: [25, 25, 75, 75] }
  ];

  /* UKŁAD MONITORÓW — ostatnia odpowiedź `/screens`, wspólna dla karty i dla rozwijania obszaru.
     Strona nie ma jak go policzyć sama (`window.screen` opisuje wyłącznie ekran, na którym stoi
     okno przeglądarki), więc wie o nim tylko tyle, ile powie serwer — i dlatego to CACHE, a nie
     źródło prawdy: dopóki pierwsza odpowiedź nie wróci, obszar rozwija się względem tego, co
     wołający podał jako `pelny`. */
  NS.ekrany = null;
  NS.ustawEkrany = function (j) { NS.ekrany = (j && j.desktop) ? j : null; return NS.ekrany; };
  NS.ekranyOpcje = function () {
    const lista = (NS.ekrany && Array.isArray(NS.ekrany.screens)) ? NS.ekrany.screens : [];
    // Przy kilku monitorach puste pole NIE znaczy już „wszystkie naraz" (patrz `ekranSkanera`),
    // więc i napis nie może tego obiecywać.
    const out = [['', lista.length > 1
      ? _scanT('Sam wybierz (ekran planszy, bez niej główny)', 'Pick for me (the view’s screen, else the main one)')
      : _scanT('Cały pulpit', 'The whole desktop')]];
    lista.forEach(function (s, i) {
      // „\\.\DISPLAY2" to nazwa Windowsa, a nie nazwa dla człowieka — zostaje sam ogon, a przed
      // nim numer i rozdzielczość, czyli to, po czym ekran się rozpoznaje.
      const nm = String(s.name || '').replace(/^\\\\\.\\/, '') || ('#' + (i + 1));
      out.push([s.name, (i + 1) + '. ' + nm + ' · ' + s.w + '×' + s.h]);
    });
    return out;
  };

  /* KATALOG AKCJI. `rodzaj` mówi, czym to jest naprawdę:
       mysz     — ruch i przyciski wskaźnika,
       klawisze — kliknięcie w punkt (żeby ustawić miejsce) i zaraz potem skrót klawiszowy;
                  tak działa „Wklej" i „Usuń" — bez kliknięcia system nie wie, CZEGO dotyczą,
       klawisze + bezKliku — SAM skrót, bez kliku. „Kopiuj" i „Wytnij" działają na tym, co JUŻ
                  jest zaznaczone, a klik w tekst to zaznaczenie kasuje. Sprawdzone na żywo
                  29.09 w Notatniku: klik + Ctrl+C zostawiał schowek bez zmian, sam Ctrl+C kopiował.
       inne     — rzeczy samego skanera. */
  NS.AKCJE = [
    { kod: 'lewy', pl: 'Kliknij', en: 'Click', rodzaj: 'mysz', ikona: '👆' },
    { kod: 'dwuklik', pl: 'Kliknij dwa razy', en: 'Double click', rodzaj: 'mysz', ikona: '✌️' },
    { kod: 'prawy', pl: 'Prawy przycisk', en: 'Right click', rodzaj: 'mysz', ikona: '📋' },
    { kod: 'srodkowy', pl: 'Środkowy przycisk', en: 'Middle click', rodzaj: 'mysz', ikona: '🖱️' },
    { kod: 'przeciagnij', pl: 'Przeciągnij', en: 'Drag', rodzaj: 'mysz', ikona: '↔️' },
    { kod: 'przewinDol', pl: 'Przewiń w dół', en: 'Scroll down', rodzaj: 'mysz', ikona: '⬇️' },
    { kod: 'przewinGore', pl: 'Przewiń w górę', en: 'Scroll up', rodzaj: 'mysz', ikona: '⬆️' },
    { kod: 'kursor', pl: 'Tylko przesuń kursor', en: 'Move pointer only', rodzaj: 'mysz', ikona: '➤' },
    { kod: 'kopiuj', pl: 'Kopiuj', en: 'Copy', rodzaj: 'klawisze', klawisze: 'ctrl+c', bezKliku: true, ikona: '⧉' },
    { kod: 'wklej', pl: 'Wklej', en: 'Paste', rodzaj: 'klawisze', klawisze: 'ctrl+v', ikona: '📥' },
    { kod: 'wytnij', pl: 'Wytnij', en: 'Cut', rodzaj: 'klawisze', klawisze: 'ctrl+x', bezKliku: true, ikona: '✂️' },
    { kod: 'usun', pl: 'Usuń', en: 'Delete', rodzaj: 'klawisze', klawisze: 'delete', ikona: '🗑️' },
    { kod: 'cofnijZmiane', pl: 'Cofnij zmianę', en: 'Undo', rodzaj: 'klawisze', klawisze: 'ctrl+z', ikona: '↩️' },
    { kod: 'zaznaczWszystko', pl: 'Zaznacz wszystko', en: 'Select all', rodzaj: 'klawisze', klawisze: 'ctrl+a', ikona: '▦' },
    { kod: 'klawiatura', pl: 'Klawiatura ekranowa', en: 'On-screen keyboard', rodzaj: 'inne', ikona: '⌨️' },
    { kod: 'anuluj', pl: 'Nic, wróć', en: 'Cancel', rodzaj: 'inne', ikona: '✕' }
  ];
  NS.akcja = function (kod) {
    for (let i = 0; i < NS.AKCJE.length; i++) if (NS.AKCJE[i].kod === kod) return NS.AKCJE[i];
    return null;
  };
  NS.nazwaAkcji = function (kod, jezyk) {
    const a = NS.akcja(kod);
    return a ? (jezyk === 'en' ? a.en : a.pl) : kod;
  };

  function kopiaUstawien(u) {
    const w = {};
    for (const k in NS.DOMYSLNE) w[k] = NS.DOMYSLNE[k];
    for (const k in (u || {})) if (u[k] !== undefined && u[k] !== null) w[k] = u[k];
    // Zgodność ze starszym zapisem, gdzie obie osie miały jedną grubość.
    if (u && u.pasmo !== undefined && u.pasmoY === undefined) { w.pasmoY = u.pasmo; w.pasmoX = u.pasmo; }
    return w;
  }
  function ogranicz(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* PRZELOT — jedna funkcja opisująca całą jazdę paska, dla ruchu płynnego i skokowego.

     Przeskakiwanie po dojściu do końca męczy wzrok.
     Bo było: pasek dobijał do dołu i w tej samej klatce pojawiał się na górze. Oko traci
     wtedy wątek i trzeba go szukać od nowa — a przy skanowaniu to jest cały nawrót straty.
     Dwa lekarstwa, oba tutaj i oba wybieralne:
       • POSTÓJ NA KRAŃCU (`pauza`) — pasek staje na końcu i dopiero po chwili wraca.
         Wcześniej `pauzaNaKrancach` było dodawane do czasu przejazdu, więc pasek nie stawał,
         tylko jechał wolniej. To był błąd i tak się to nazywa.
       • ZAWRACANIE (`wahadlo`) — pasek nie znika, tylko idzie z powrotem. Oko go nie gubi
         ani razu, a przy okazji drugi przejazd jest darmową drugą szansą.
     Zwraca: u (0…1 wzdłuż obszaru), nawrót (ile pełnych cykli minęło) i czy właśnie stoi. */
  function przelot(el, czasJazdy, pauza, wahadlo) {
    czasJazdy = Math.max(1, czasJazdy);
    pauza = Math.max(0, pauza);
    const cykl = wahadlo ? (2 * czasJazdy + 2 * pauza) : (czasJazdy + pauza);
    const nawrot = Math.floor(el / cykl);
    const f = el - nawrot * cykl;
    let u, stoi = false;
    if (!wahadlo) {
      if (f < czasJazdy) u = f / czasJazdy;
      else { u = 1; stoi = true; }
    } else if (f < czasJazdy) u = f / czasJazdy;
    else if (f < czasJazdy + pauza) { u = 1; stoi = true; }
    else if (f < 2 * czasJazdy + pauza) u = 1 - (f - czasJazdy - pauza) / czasJazdy;
    else { u = 0; stoi = true; }
    return { u: u, nawrot: nawrot, stoi: stoi };
  }
  NS._przelot = przelot;

  /* ---------- PLAN PRZEBIEGÓW -------------------------------------------
     Plan to lista kroków „czego szukamy teraz”. Dla trybu `pasy` wygląda tak:
       [ {os:'y', dokladny:false}, {os:'y', dokladny:true}, {os:'x', …}, … ]
     Rozbicie na plan zamiast czterech nazwanych stanów daje za darmo: 1 albo 2 przebiegi,
     dowolną kolejność osi i pojedynczą oś (gdyby ktoś chciał skanować tylko wysokość). */
  function zbudujPlan(u) {
    // Jedna oś też jest planem — używa tego kalibracja czasu reakcji i skanowanie samych wierszy.
    const osie = u.kolejnosc === 'X-Y' ? ['x', 'y']
      : (u.kolejnosc === 'Y' ? ['y'] : (u.kolejnosc === 'X' ? ['x'] : ['y', 'x']));
    const plan = [];
    osie.forEach(function (os) {
      plan.push({ os: os, dokladny: false });
      if (u.przebiegi >= 2) plan.push({ os: os, dokladny: true });
    });
    return plan;
  }

  /* ---------- SILNIK ----------------------------------------------------- */
  NS.Silnik = function (opcje) {
    opcje = opcje || {};
    const self = this;

    this.u = kopiaUstawien(opcje.ustawienia);
    this.ekran = opcje.ekran || { x: 0, y: 0, w: 1920, h: 1080 };
    this.cele = opcje.cele || [];          // [{x,y,w,h,id}] — do dociągania i trybu `elementy`
    this.naZdarzenie = opcje.naZdarzenie || function () { };

    this.faza = 'spoczynek';   // spoczynek | odliczanie | biegnie | odpoczywa | menu | gotowe
    this.plan = zbudujPlan(this.u);
    this.etap = 0;
    this.obszar = null;
    this.t0 = 0;               // kiedy ruszył bieżący przebieg
    this.punkt = null;
    this.punktA = null;        // pierwszy punkt przeciągania
    this.ostatniWybor = -1e9;
    this.ostatniePuszczenie = -1e9;
    this.wcisniete = null;     // { t } — trwające naciśnięcie (czas przytrzymania)
    this.menuIdx = 0;
    this.historia = [];        // do cofania
    this.licznikSygnalow = 0;
    this.licznikCofniec = 0;
    this.licznikOdrzuconych = 0;
    this.tStartu = 0;          // kiedy zaczął się cały cykl (do pomiaru czasu na cel)
    this.ostatniIndeksKroku = -1;
    // Druga połowa trybu „ćwiartki”: po wybraniu ostatniego pola skaner przechodzi na PASKI
    // i jedzie nimi już tylko wewnątrz niego (ustawienie `poCwiartkach`). Flaga jest stanem
    // PRZEBIEGU, nie ustawieniem — dlatego siedzi tu, a nie w `u`.
    this.fazaPasow = false;
    // Druga faza poziomu w kratce „wiersze/kolumny”: wiersz jest już wybrany i zapalają się
    // jego pola. Tak samo jak `fazaPasow` to stan PRZEBIEGU, nie ustawienie.
    this.fazaKolumn = false;

    /* --- pomocnicze --- */
    this.ustawienia = function (nowe) {
      self.u = kopiaUstawien(nowe);
      self.plan = zbudujPlan(self.u);
      if (self.faza !== 'spoczynek') self.przerwij();
      return self.u;
    };
    /* RAMKA POTRAFI SIĘ RUSZYĆ W ŚRODKU PRZEJAZDU — i wtedy musi się za nią przenieść to, co
       już zostało wybrane. `obszar`, `punkt` i historia cofania żyją w TYM SAMYM układzie, co
       `ekran` (w karcie: piksele okna przeglądarki), a kartę da się przewinąć w połowie
       skanowania — podgląd jest lepki, więc jedzie ze stroną. Bez przeliczenia zawężony obszar
       zostawał tam, gdzie ramka BYŁA, i skaner malował obok podglądu, po stronie.
       Objaw: przy przewijaniu najeżdżał poza swoje okno. Zmierzone
       przed poprawką: przewinięcie o 174 px zostawiało zapalone pole 51 px NAD ramką.

       Jedno przekształcenie liniowe załatwia oba przypadki naraz — przesunięcie (przewijanie,
       zwinięcie kolumny) i zmianę rozmiaru (inne okno, inny ekran) — bo każdy punkt trzyma swój
       UŁAMEK ramki, a nie odległość w pikselach. Nad pulpitem ramką jest całe okno, więc ta
       gałąź milczy, dopóki ktoś nie przełączy monitora. */
    this.ustawEkran = function (e) {
      const stary = self.ekran;
      self.ekran = e;
      if (!stary || !e || !stary.w || !stary.h) return;
      const dx = e.x - stary.x, dy = e.y - stary.y, sx = e.w / stary.w, sy = e.h / stary.h;
      if (!dx && !dy && sx === 1 && sy === 1) return;
      const px = function (x) { return e.x + (x - stary.x) * sx; };
      const py = function (y) { return e.y + (y - stary.y) * sy; };
      const prost = function (r) {
        return r ? { x: px(r.x), y: py(r.y), w: r.w * sx, h: r.h * sy } : r;
      };
      // Punkt niesie jeszcze `surowy` (pozycja PRZED dociągnięciem) i `cel` — przepisujemy
      // obiekt, żeby nie zgubić niczego, co dołoży tam przyszła wersja.
      const pkt = function (p) {
        if (!p) return p;
        const n = Object.assign({}, p, { x: px(p.x), y: py(p.y) });
        if (p.surowy) n.surowy = { x: px(p.surowy.x), y: py(p.surowy.y) };
        return n;
      };
      self.obszar = prost(self.obszar);
      self.punkt = pkt(self.punkt);
      self.punktA = pkt(self.punktA);
      self.historia = self.historia.map(function (h) {
        return (h && h.obszar) ? Object.assign({}, h, { obszar: prost(h.obszar) }) : h;
      });
    };
    this.ustawCele = function (c) { self.cele = c || []; };

    function pelnyObszar() {
      return { x: self.ekran.x, y: self.ekran.y, w: self.ekran.w, h: self.ekran.h };
    }
    function zdarzenie(rodzaj, dane) { try { self.naZdarzenie(rodzaj, dane || {}); } catch (e) { } }

    /* --- START / STOP ---------------------------------------------------- */
    this.start = function (t) {
      self.faza = 'odliczanie';
      self.etap = 0;
      self.obszar = pelnyObszar();
      self.punkt = null;
      self.punktA = null;
      self.historia = [];
      self.t0 = t;
      self.tStartu = t;
      self.ostatniIndeksKroku = -1;
      self.fazaPasow = false;
      self.fazaKolumn = false;
      zdarzenie('start', {});
    };
    this.przerwij = function () {
      self.faza = 'spoczynek';
      self.fazaPasow = false;
      self.fazaKolumn = false;
      self.punkt = null;
      self.punktA = null;
      self.obszar = null;
      self.wcisniete = null;
      zdarzenie('przerwane', {});
    };

    /* --- GEOMETRIA BIEŻĄCEGO PRZEBIEGU ------------------------------------
       Zwraca wszystko, czego scena potrzebuje do narysowania paska: oś, początek i koniec
       obszaru, grubość pasma i długość przejazdu. */
    function opisPrzebiegu() {
      const krok = self.plan[self.etap];
      if (!krok) return null;
      const os = krok.os;
      const poczatek = os === 'y' ? self.obszar.y : self.obszar.x;
      const dlugoscObszaru = os === 'y' ? self.obszar.h : self.obszar.w;
      // Osobna grubość dla każdej osi: ekran jest szerszy niż wyższy, więc pionowy pasek
      // zwykle może być węższy niż poziomy jest wysoki, bez straty na celności.
      // Cztery stany, cztery grubości: zgrubny i dokładny, osobno dla każdej osi.
      const zadana = krok.dokladny
        ? (os === 'y' ? self.u.pasmoDokladnyY : self.u.pasmoDokladnyX)
        : (os === 'y' ? self.u.pasmoY : self.u.pasmoX);
      // SUFIT GRUBOŚCI: PASEK MUSI MIEĆ PO CZYM JECHAĆ.
      // Grubość jest w pikselach CAŁEGO EKRANU (170 px poziomy, 200 px pionowy), a obszar bywa
      // dużo mniejszy od ekranu: ostatnie pole ćwiartek przy „W ostatnim polu → Dojedź paskami"
      // ma ~120 × 68 px, a własny prostokąt („dolny pas") bywa jeszcze niższy. Bez sufitu pasek
      // zajmował wtedy CAŁY obszar: `zasieg` schodził do 1 px, `krokow` do 1 — i pasek stał
      // w miejscu, pulsując jak na postoju (tryb „dojedź paskami” nie
      // animował pasków). Zmierzone przed poprawką (pole 400 × 200): pasmo od 0 do 170
      // w każdej chwili przejazdu, `krokow: 1`.
      // Trzecia część obszaru daje ZAWSZE co najmniej trzy pozycje — czyli ruch, który widać —
      // a przebieg dokładny i tak dopracowuje wynik w środku zatrzymanego pasma. Dlaczego akurat
      // trzecia, a nie połowa czy czwarta: ma ratować obszary MAŁE i nie ruszać tych normalnych.
      // Ramka podglądu w karcie ma ~520 px wysokości, a 520 / 3 = 173 — czyli domyślne 170 px
      // przechodzi nietknięte i skanowanie w podglądzie zachowuje się dokładnie tak, jak było.
      const sufit = dlugoscObszaru / 3;
      const grubosc = Math.min(dlugoscObszaru, krok.dokladny
        ? Math.max(2, Math.min(zadana, sufit))
        : Math.max(8, Math.min(zadana, sufit)));
      const zasieg = Math.max(1, dlugoscObszaru - grubosc);  // ile ma do przejechania
      const predkosc = Math.max(20, self.u.predkosc * (krok.dokladny ? self.u.mnoznikDokladny : 1));
      const skok = Math.max(4, self.u.skok > 0 ? self.u.skok : grubosc);
      // OSTATNI PRZESKOK MA DOJECHAĆ DO KOŃCA. `floor` zostawiał resztę z dzielenia poza zasięgiem
      // paska: przy obszarze 200 px i pasku 66,7 px wychodziły DWIE pozycje (0 i 66,7), więc dolna
      // trzecia część pola była nieosiągalna — a `w.poz` i tak przycina ostatni krok do `zasieg`,
      // czyli nadmiarowa pozycja siada dokładnie na końcu obszaru, nie za nim.
      return { os: os, dokladny: krok.dokladny, poczatek: poczatek, dlugosc: dlugoscObszaru,
               grubosc: grubosc, zasieg: zasieg, predkosc: predkosc, skok: skok,
               krokow: Math.max(1, Math.ceil(zasieg / skok - 1e-9) + 1) };
    }

    /* Pozycja pasma (jego początek) w chwili `t`. Liczona ZAWSZE z czasu, nigdy przez
       dodawanie przyrostów co klatkę — inaczej zgubiona klatka zmienia prędkość, a przy
       poprawce na czas reakcji trzeba umieć zapytać o pozycję sprzed 200 ms. */
    function przelotW(t) {
      const p = opisPrzebiegu();
      if (!p) return null;
      const el = Math.max(0, t - self.t0 - self.u.opoznienieStartu);
      const wahadlo = self.u.kierunek === 'wahadlo';
      const czasJazdy = self.u.ruch === 'skokowy'
        ? p.krokow * Math.max(60, self.u.czasKroku)
        : (p.zasieg / p.predkosc) * 1000;
      const w = przelot(el, czasJazdy, self.u.pauzaNaKrancach, wahadlo);
      w.p = p;
      if (self.u.ruch === 'skokowy') {
        // Kwantyzacja do pól: przy zawracaniu `u` samo maleje, więc indeks wraca bez
        // osobnej gałęzi — i to jest cała różnica między „wraca” a „zawraca”.
        w.indeks = Math.min(p.krokow - 1, Math.max(0, Math.floor(w.u * p.krokow - 1e-9)));
        w.poz = p.poczatek + Math.min(p.zasieg, w.indeks * p.skok);
      } else {
        w.indeks = -1;
        w.poz = p.poczatek + w.u * p.zasieg;
      }
      return w;
    }
    function pozycjaW(t) { const w = przelotW(t); return w ? w.poz : 0; }

    /* Który to nawrót. Po `nawroty` silnik odpoczywa — bez tego skaner jeździ w nieskończoność,
       a migający ekran, na który nikt nie patrzy, jest jednym z częstszych zarzutów wobec
       skanowania. Przy zawracaniu jeden nawrót to tam I z powrotem. */
    function nawrotW(t) { const w = przelotW(t); return w ? w.nawrot : 0; }

    /* Numer pola w ruchu skokowym — po to, żeby dźwięk tyknął raz na przeskok, a nie co klatkę. */
    function indeksKroku(t) {
      if (self.u.ruch !== 'skokowy') return -1;
      const w = przelotW(t);
      return w ? (w.nawrot * 1000 + w.indeks) : -1;
    }

    /* --- SYGNAŁ ------------------------------------------------------------
       Trzy bezpieczniki, wszystkie z praktyki sprzętu wspomagającego:
         • odbicie      — dwa naciśnięcia w mgnieniu oka to jedno (drżenie, styk)
         • blokada      — chwila po wyborze, gdy nic nie przyjmujemy (przypadkowy drugi klik)
         • przytrzymanie— sygnał liczy się dopiero, gdy potrwa; pozycję bierzemy jednak
                          z CHWILI NACIŚNIĘCIA, nie z chwili potwierdzenia, bo człowiek
                          celował wtedy, kiedy nacisnął. */
    /* `impuls` = sygnał, który NIE MA DŁUGOŚCI i mieć jej nie może.
       Tak przychodzi sygnał z kapsla: reguła `scan:` wysyła go w chwili ruchu, a `SlotOutput.up`
       dla `scan:` jest po stronie serwera świadomie ciche („skaner mierzy chwilę, w której człowiek
       CELOWAŁ, a nie długość trzymania"). Nie da się więc odczytać, jak długo ktoś trzymał — i bez
       tej flagi każde ustawienie „Ile trzymać, żeby się liczyło" powyżej zera KASOWAŁO wszystkie
       sygnały z kapsla: naciśnięcie i puszczenie przychodzą w tej samej milisekundzie, więc warunek
       „trzymane >= czasPrzytrzymania" nie miał szans. Objaw był okrutny, bo pokrętło zaprasza do
       podniesienia dokładnie tę osobę, której to psuje jedyną drogę sterowania („odsiewa drgnięcia").
       Odbicie i przerwa po wyborze zostają — te dotyczą impulsu tak samo jak przytrzymania. */
    this.sygnal = function (t, impuls) {
      if (self.wcisniete) return 'juz-wcisniete';
      if (t - self.ostatniePuszczenie < self.u.odbicie) { self.licznikOdrzuconych++; zdarzenie('odrzucony', { powod: 'odbicie' }); return 'odbicie'; }
      if (t - self.ostatniWybor < self.u.blokadaPoWyborze) { self.licznikOdrzuconych++; zdarzenie('odrzucony', { powod: 'blokada' }); return 'blokada'; }
      self.wcisniete = { t: t, potwierdzony: false, impuls: !!impuls };
      if (impuls || self.u.czasPrzytrzymania <= 0) return self.potwierdz(t);
      return 'czeka';
    };

    this.puszczenie = function (t) {
      if (!self.wcisniete) return;
      const trzymane = t - self.wcisniete.t;
      const bylPotwierdzony = self.wcisniete.potwierdzony;
      const bylImpuls = self.wcisniete.impuls;
      self.wcisniete = null;
      self.ostatniePuszczenie = t;
      if (!bylImpuls && !bylPotwierdzony && self.u.czasPrzytrzymania > 0 && trzymane < self.u.czasPrzytrzymania) {
        self.licznikOdrzuconych++;
        zdarzenie('odrzucony', { powod: 'za-krotko', trzymane: trzymane });
      }
    };

    /* Właściwa reakcja na sygnał. `tNacisniecia` to chwila, w której palec ruszył. */
    this.potwierdz = function (tNacisniecia) {
      self.licznikSygnalow++;
      if (self.wcisniete) self.wcisniete.potwierdzony = true;

      if (self.faza === 'spoczynek' || self.faza === 'gotowe') { self.start(tNacisniecia); return 'start'; }
      if (self.faza === 'odpoczywa') { self.t0 = tNacisniecia; self.faza = 'biegnie'; return 'wznowione'; }
      if (self.faza === 'odliczanie') return 'odliczanie';   // sygnał w trakcie odliczania nic nie robi
      if (self.faza === 'menu') return wybierzZMenu(tNacisniecia);
      if (self.faza !== 'biegnie') return 'nic';

      // Poprawka na czas reakcji: pytamy o pozycję sprzed `wyprzedzenie` ms.
      const tOdczytu = tNacisniecia - self.u.wyprzedzenie;
      self.ostatniWybor = tNacisniecia;

      // Faza pasków wewnątrz ostatniej ćwiartki: od tej chwili sygnał znaczy „zatrzymaj pasek",
      // choć trybem nadal są ćwiartki.
      if (self.fazaPasow) return wybierzPasmo(tOdczytu, tNacisniecia);
      if (self.u.tryb === 'cwiartki') return wybierzBlok(tOdczytu, tNacisniecia);
      if (self.u.tryb === 'elementy') return wybierzElement(tOdczytu, tNacisniecia);
      if (self.u.tryb === 'radar') return wybierzRadar(tOdczytu, tNacisniecia);
      return wybierzPasmo(tOdczytu, tNacisniecia);
    };

    /* --- TRYB: PASY -------------------------------------------------------- */
    function wybierzPasmo(tOdczytu, tTeraz) {
      const p = opisPrzebiegu();
      if (!p) return 'nic';
      const poz = ogranicz(pozycjaW(tOdczytu), p.poczatek, p.poczatek + p.zasieg);
      self.historia.push({ etap: self.etap, pasy: self.fazaPasow,
                           obszar: { x: self.obszar.x, y: self.obszar.y, w: self.obszar.w, h: self.obszar.h } });

      // Obszar zawęża się do zatrzymanego pasma — kolejny przebieg szuka już tylko w nim.
      const nowy = { x: self.obszar.x, y: self.obszar.y, w: self.obszar.w, h: self.obszar.h };
      if (p.os === 'y') { nowy.y = poz; nowy.h = p.grubosc; }
      else { nowy.x = poz; nowy.w = p.grubosc; }
      self.obszar = nowy;
      zdarzenie('etap', { etap: self.etap, os: p.os, dokladny: p.dokladny, pozycja: poz });

      self.etap++;
      self.t0 = tTeraz;
      if (self.etap >= self.plan.length) return zakoncz(tTeraz, {
        x: self.obszar.x + self.obszar.w / 2,
        y: self.obszar.y + self.obszar.h / 2
      });
      return 'etap';
    }

    /* --- TRYB: ĆWIARTKI ----------------------------------------------------
       Ekran dzieli się na kratkę, kratki zapalają się po kolei, wybrana staje się nowym
       ekranem. Szybsze od pasków (log zamiast dwóch przejazdów) i mniej męczące dla oka. */
    function blokiObszaru() {
      const kol = Math.max(1, self.u.siatka[0] | 0), wier = Math.max(1, self.u.siatka[1] | 0);
      const A = self.obszar, tryb = self.u.cwiartkiKolejnosc || 'kratka';
      const lista = [];
      // WIERSZE / KOLUMNY — dwie fazy na jeden poziom. Cała zmiana siedzi TUTAJ i to jest
      // celowe: rysowanie bierze prostokąty z tej jednej funkcji (`st.bloki`), więc nakładka,
      // scena i piaskownica nie wiedzą nawet, że coś doszło. Wybieranie (`indeksBloku`) też
      // liczy po tej liście, więc trafienie w wiersz działa tym samym kodem, co trafienie w pole.
      if (tryb === 'wiersze' || tryb === 'kolumny') {
        const najpierwWiersze = (tryb === 'wiersze');
        // Faza pierwsza: pasy na całą szerokość (albo wysokość) OBECNEGO obszaru.
        if (!self.fazaKolumn) {
          if (najpierwWiersze) {
            const bh = A.h / wier;
            for (let r = 0; r < wier; r++) lista.push({ x: A.x, y: A.y + r * bh, w: A.w, h: bh });
          } else {
            const bw = A.w / kol;
            for (let c = 0; c < kol; c++) lista.push({ x: A.x + c * bw, y: A.y, w: bw, h: A.h });
          }
          return lista;
        }
        // Faza druga: `self.obszar` JEST już wybranym wierszem (albo kolumną), więc dzielimy go
        // tylko w poprzek — inaczej pocięlibyśmy go drugi raz na pełną kratkę.
        if (najpierwWiersze) {
          const bw = A.w / kol;
          for (let c = 0; c < kol; c++) lista.push({ x: A.x + c * bw, y: A.y, w: bw, h: A.h });
        } else {
          const bh = A.h / wier;
          for (let r = 0; r < wier; r++) lista.push({ x: A.x, y: A.y + r * bh, w: A.w, h: bh });
        }
        return lista;
      }
      const bw = A.w / kol, bh = A.h / wier;
      for (let r = 0; r < wier; r++) for (let c = 0; c < kol; c++)
        lista.push({ x: A.x + c * bw, y: A.y + r * bh, w: bw, h: bh });
      return lista;
    }
    function indeksBloku(t) {
      const lista = blokiObszaru();
      const el = Math.max(0, t - self.t0 - self.u.opoznienieStartu);
      return { lista: lista, i: Math.floor(el / Math.max(120, self.u.czasBloku)) % lista.length };
    }
    function wybierzBlok(tOdczytu, tTeraz) {
      const b = indeksBloku(tOdczytu);
      const blok = b.lista[b.i];
      self.historia.push({ etap: self.etap, pasy: self.fazaPasow, kolumny: self.fazaKolumn,
                           obszar: { x: self.obszar.x, y: self.obszar.y, w: self.obszar.w, h: self.obszar.h } });
      self.obszar = blok;
      self.t0 = tTeraz;
      // PÓŁ POZIOMU: wybrany został cały wiersz (albo kolumna), więc `etap` NIE rośnie. Poziom
      // kończy się dopiero na polu. Gdyby rosło tutaj, „jak głęboko" liczyłoby połówki i ustawienie
      // „wiersz → pole → koniec" kończyłoby się na samym wierszu, czyli kliknięciem w jego środek.
      if ((self.u.cwiartkiKolejnosc || 'kratka') !== 'kratka' && !self.fazaKolumn) {
        self.fazaKolumn = true;
        zdarzenie('etap', { etap: self.etap, blok: blok, polowa: true });
        return 'etap';
      }
      self.fazaKolumn = false;
      self.etap++;
      zdarzenie('etap', { etap: self.etap, blok: blok });
      const dosc = Math.min(blok.w, blok.h) <= self.u.progKoncaBloku || self.etap >= self.u.poziomyMax;
      if (!dosc) return 'etap';
      // OSTATNIA ĆWIARTKA. Domyślnie klikamy jej środek. Przy `poCwiartkach = 'paski'` zamiast
      // tego przechodzimy na paski — biegną już tylko wewnątrz tego pola, bo cała geometria
      // przebiegu bierze się z `self.obszar`, a ten jest teraz tym polem. Plan pasków (oś,
      // przebieg dokładny) jest ten sam, co w trybie „pasy": zbudowany przy `ustawienia`.
      if (self.u.poCwiartkach === 'paski' && self.plan.length) {
        self.fazaPasow = true;
        self.etap = 0;
        self.t0 = tTeraz;
        zdarzenie('etap', { etap: 0, pasy: true, wCwiartce: blok });
        return 'etap';
      }
      return zakoncz(tTeraz, { x: blok.x + blok.w / 2, y: blok.y + blok.h / 2 });
    }

    /* --- TRYB: ELEMENTY -----------------------------------------------------
       To jest to, co robi prawdziwy Switch Access: skanuje KLIKALNE RZECZY, nie piksele.
       W piaskownicy elementy podaje strona; nad prawdziwym pulpitem musiałby je podać
       Windows (UI Automation) — patrz NOTATKI.md. */
    function grupyElementow() {
      // liniowy = jedna grupa ze wszystkim; wiersz-kolumna = po jednej grupie na wiersz
      if (self.u.wzorElementow === 'liniowy') return [self.cele.map(function (c, i) { return i; })];
      const posort = self.cele.map(function (c, i) { return { i: i, y: c.y, x: c.x }; })
        .sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); });
      const wiersze = [];
      posort.forEach(function (e) {
        const w = wiersze[wiersze.length - 1];
        if (w && Math.abs(self.cele[w[0]].y - e.y) < 28) w.push(e.i); else wiersze.push([e.i]);
      });
      return wiersze;
    }
    function stanElementow(t) {
      const grupy = grupyElementow();
      const el = Math.max(0, t - self.t0 - self.u.opoznienieStartu);
      const i = Math.floor(el / Math.max(150, self.u.czasElementu));
      if (self.u.wzorElementow === 'liniowy' || grupy.length <= 1) {
        const g = grupy[0] || [];
        return { grupy: grupy, grupa: 0, wIdx: g.length ? (i % g.length) : -1, wybieraGrupe: false };
      }
      if (self.etap === 0) return { grupy: grupy, grupa: i % grupy.length, wIdx: -1, wybieraGrupe: true };
      const g = grupy[self.wybranaGrupa] || [];
      return { grupy: grupy, grupa: self.wybranaGrupa, wIdx: g.length ? (i % g.length) : -1, wybieraGrupe: false };
    }
    function wybierzElement(tOdczytu, tTeraz) {
      const s = stanElementow(tOdczytu);
      if (s.wybieraGrupe) {
        self.wybranaGrupa = s.grupa;
        self.historia.push({ etap: 0, obszar: null });
        self.etap = 1; self.t0 = tTeraz;
        zdarzenie('etap', { etap: 1, grupa: s.grupa });
        return 'etap';
      }
      const grupa = s.grupy[s.grupa] || [];
      const c = self.cele[grupa[Math.max(0, s.wIdx)]];
      if (!c) return 'nic';
      return zakoncz(tTeraz, { x: c.x + c.w / 2, y: c.y + c.h / 2, cel: c });
    }

    /* --- TRYB: RADAR --------------------------------------------------------
       Promień obraca się wokół środka, sygnał ustala kąt; potem punkt biegnie wzdłuż
       promienia, sygnał ustala odległość. Dwa sygnały zamiast czterech. */
    function stanRadaru(t) {
      const sx = self.obszar.x + self.obszar.w / 2, sy = self.obszar.y + self.obszar.h / 2;
      const el = Math.max(0, t - self.t0 - self.u.opoznienieStartu);
      const maxR = Math.sqrt(self.obszar.w * self.obszar.w + self.obszar.h * self.obszar.h) / 2;
      if (self.etap === 0) {
        const kat = (el / 1000) * (Math.PI / 180) * self.u.stopnieNaSek;
        return { sx: sx, sy: sy, kat: kat % (Math.PI * 2), r: null, maxR: maxR };
      }
      /* ⚠️⚠️ TU BYŁO WYWOŁANIE FUNKCJI, KTÓREJ NIGDY NIE BYŁO (naprawione 2026-09-22).
         Stało tu `trojkat(u)` — nazwa nieistniejąca w całym projekcie, więc DRUGI etap radaru
         rzucał `ReferenceError` przy każdej klatce: scena przestawała się rysować, kropka nigdy
         się nie pokazywała, a sygnał wyboru odległości wywracał się, zanim doszedł do kliknięcia.
         Objaw: radar nie pokazywał kropki. Wyglądało to na usterkę rysowania,
         a był wyjątkiem w silniku — dlatego nie złapał tego żaden test wyglądu.

         Zamiast dopisywać brakującą falę trójkątną bierzemy `przelot` — ten sam, którym jeździ
         pasek. Zysk poza samą naprawą: radar dostaje POSTÓJ NA KRAŃCU (`pauzaNaKrancach`), którego
         nigdy nie miał, i zawraca dokładnie tak samo, jak pasek. Jedna matematyka na oba tryby. */
      const czas = (maxR / Math.max(40, self.u.predkoscPromienia)) * 1000;
      const w = przelot(el, czas, self.u.pauzaNaKrancach, self.u.kierunek === 'wahadlo');
      return { sx: sx, sy: sy, kat: self.katRadaru, r: w.u * maxR, maxR: maxR,
               stoi: w.stoi, nawrot: w.nawrot };
    }
    function wybierzRadar(tOdczytu, tTeraz) {
      const s = stanRadaru(tOdczytu);
      if (self.etap === 0) {
        self.katRadaru = s.kat;
        self.historia.push({ etap: 0, obszar: null });
        self.etap = 1; self.t0 = tTeraz;
        zdarzenie('etap', { etap: 1, kat: s.kat });
        return 'etap';
      }
      return zakoncz(tTeraz, { x: s.sx + Math.cos(s.kat) * s.r, y: s.sy + Math.sin(s.kat) * s.r });
    }

    /* --- DOCIĄGANIE I ZAKOŃCZENIE ------------------------------------------
       Dociąganie to najtańszy sposób na skok celności: skanowanie daje punkt „gdzieś obok”,
       a klikalne rzeczy i tak są w znanych miejscach. 60 px potrafi zamienić chybienie
       w trafienie, a nie odbiera człowiekowi kontroli, bo działa tylko blisko. */
    /* DOCIĄGANIE — punkt przeskakuje na najbliższy cel, jeśli jest bliżej niż `dociaganie` px.
       Najtańszy skok celności, jaki ten moduł ma.

       ⚠️ MAŁY CEL I DUŻY CEL TO DWIE RÓŻNE SPRAWY. Do 11.09 punkt zawsze lądował w ŚRODKU celu,
       co przy ikonie jest dokładnie tym, o co chodzi, ale przy szerokim wierszu (pozycja menu,
       wiersz listy — u nas 350 px i więcej) wyrzucało go o pół ekranu w bok od miejsca, w które
       człowiek celował. Widać to było jak na dłoni po dodaniu pasków w ostatniej ćwiartce:
       wycelowany punkt [283,338] kończył jako [442,316], czyli POZA wybraną ćwiartką.
       Dlatego: mały cel — środek (bo środek JEST celem), duży — najbliższy punkt w jego wnętrzu
       z zapasem od krawędzi (bo krawędź bywa obramowaniem, a nie treścią). */
    const DUZY_CEL = 160;      // px w którąkolwiek stronę
    const ZAPAS_OD_KRAWEDZI = 8;
    function dociagnij(p) {
      const r = self.u.dociaganie;
      if (!r || !self.cele.length) return p;
      let naj = null, najD = r * r;
      self.cele.forEach(function (c) {
        const wx = Math.max(c.x, Math.min(p.x, c.x + c.w));
        const wy = Math.max(c.y, Math.min(p.y, c.y + c.h));
        const d = (p.x - wx) * (p.x - wx) + (p.y - wy) * (p.y - wy);
        if (d > najD) return;
        najD = d;
        const duzy = c.w > DUZY_CEL || c.h > DUZY_CEL;
        if (!duzy) { naj = { x: c.x + c.w / 2, y: c.y + c.h / 2, cel: c }; return; }
        const zx = Math.min(ZAPAS_OD_KRAWEDZI, c.w / 3), zy = Math.min(ZAPAS_OD_KRAWEDZI, c.h / 3);
        naj = { x: Math.max(c.x + zx, Math.min(p.x, c.x + c.w - zx)),
                y: Math.max(c.y + zy, Math.min(p.y, c.y + c.h - zy)), cel: c };
      });
      return naj || p;
    }

    function zakoncz(t, punkt) {
      const surowy = { x: punkt.x, y: punkt.y };
      const dociagniety = dociagnij(surowy);
      self.punkt = { x: dociagniety.x, y: dociagniety.y, surowy: surowy, cel: dociagniety.cel || punkt.cel || null };
      if (self.u.menuAkcji) {
        self.faza = 'menu';
        self.menuIdx = 0;
        self.t0 = t;
        zdarzenie('menu', { punkt: self.punkt });
        return 'menu';
      }
      return wykonaj(t, self.u.akcjaDomyslna);
    }

    /* Menu pokazuje TYLKO to, co człowiek sam wybrał (`menuPozycje`). Pełny katalog akcji
       w menu byłby okrutny: każda niepotrzebna pozycja to sekunda czekania przy KAŻDYM
       kliknięciu, a lista czternastu rzeczy zamienia „kliknij" w wyprawę. */
    function pozycjeMenu() {
      const wybrane = (self.u.menuPozycje && self.u.menuPozycje.length) ? self.u.menuPozycje : ['lewy', 'anuluj'];
      const lista = [];
      wybrane.forEach(function (kod) { const a = NS.akcja(kod); if (a) lista.push(a); });
      return lista.length ? lista : [NS.akcja('lewy')];
    }
    function wybierzZMenu(t) {
      const lista = pozycjeMenu();
      const el = Math.max(0, t - self.t0);
      const i = Math.floor(el / Math.max(150, self.u.czasBloku)) % lista.length;
      return wykonaj(t, lista[i].kod);
    }
    this.pozycjeMenu = pozycjeMenu;

    function wykonaj(t, akcja) {
      if (akcja === 'anuluj') { self.przerwij(); return 'anulowane'; }
      if (akcja === 'przeciagnij' && !self.punktA) {
        self.punktA = self.punkt;
        self.faza = 'biegnie';
        self.etap = 0;
        self.obszar = pelnyObszar();
        self.t0 = t;
        self.punkt = null;
        zdarzenie('drugi-punkt', { od: self.punktA });
        return 'drugi-punkt';
      }
      const wynik = {
        akcja: akcja,
        punkt: self.punkt,
        od: self.punktA || null,
        czas: t - self.tStartu,
        sygnaly: self.licznikSygnalow,
        cofniecia: self.licznikCofniec,
        odrzucone: self.licznikOdrzuconych
      };
      self.faza = 'gotowe';
      self.punktA = null;
      self.licznikSygnalow = 0; self.licznikCofniec = 0; self.licznikOdrzuconych = 0;
      zdarzenie('akcja', wynik);
      if (self.u.powrotPoAkcji === 'odRazu') self.start(t);
      return 'akcja';
    }

    /* --- COFNIJ -------------------------------------------------------------
       Czego brakuje i Apple'owi, i Androidowi: zwykłego „nie ten, wróć”. Bez tego jedno
       spóźnione naciśnięcie każe przechodzić cały cykl od nowa — i to jest ten moment,
       w którym ludzie odkładają sprzęt. */
    this.cofnij = function (t) {
      self.licznikCofniec++;
      if (self.faza === 'menu') { self.faza = 'biegnie'; self.etap = Math.max(0, self.etap - 1); self.punkt = null; }
      const h = self.historia.pop();
      if (!h) { self.przerwij(); zdarzenie('cofniete', { doSpoczynku: true }); return 'spoczynek'; }
      self.etap = h.etap;
      self.fazaPasow = !!h.pasy;
      self.fazaKolumn = !!h.kolumny;
      if (h.obszar) self.obszar = h.obszar;
      self.faza = 'biegnie';
      self.punkt = null;
      self.t0 = t;
      zdarzenie('cofniete', { etap: self.etap });
      return 'cofniete';
    };

    /* --- KLATKA -------------------------------------------------------------
       Jedyna funkcja wołana z pętli rysowania. Nie zmienia niczego poza fazą „odpoczywa”
       i tykaniem — cała reszta to odczyt. */
    this.krok = function (t) {
      const st = {
        faza: self.faza, tryb: self.u.tryb, etap: self.etap, obszar: self.obszar,
        pasmo: null, blok: null, radar: null, elementy: null, punkt: self.punkt,
        punktA: self.punktA, nawrot: 0, nawroty: self.u.nawroty, opis: '', menu: null,
        odliczanie: 0, plan: self.plan.length, czekaNaStart: 0
      };
      // Ile jeszcze pasek stoi w miejscu na początku przebiegu (orientacja przed ruchem).
      if (self.faza === 'biegnie') st.czekaNaStart = Math.max(0, self.u.opoznienieStartu - (t - self.t0));
      if (self.faza === 'spoczynek') { st.opis = 'Naciśnij sygnał, żeby zacząć.'; return st; }
      if (self.faza === 'gotowe') { st.opis = 'Gotowe. Sygnał zaczyna od nowa.'; return st; }
      if (self.faza === 'odpoczywa') { st.opis = 'Skaner odpoczywa. Naciśnij sygnał, żeby wznowić.'; return st; }

      if (self.faza === 'odliczanie') {
        const zostalo = self.u.opoznienieStartu - (t - self.t0);
        if (zostalo <= 0) { self.faza = st.faza = 'biegnie'; }   // st.faza też, bo opis niżej już jest z jazdy
        else { st.odliczanie = zostalo; st.opis = 'Za chwilę ruszy…'; return st; }
      }

      if (self.faza === 'menu') {
        const lista = pozycjeMenu();
        const el = Math.max(0, t - self.t0);
        const i = Math.floor(el / Math.max(150, self.u.czasBloku)) % lista.length;
        st.menu = { idx: i, pozycje: lista };
        st.opis = 'Wybierz, co zrobić w tym punkcie.';
        return st;
      }

      const nawrot = nawrotW(t);
      st.nawrot = nawrot;
      if (self.u.nawroty > 0 && nawrot >= self.u.nawroty) {
        self.faza = 'odpoczywa';
        zdarzenie('odpoczynek', {});
        st.faza = 'odpoczywa';
        st.opis = 'Skaner odpoczywa. Naciśnij sygnał, żeby wznowić.';
        return st;
      }

      if (self.u.tryb === 'cwiartki' && !self.fazaPasow) {
        const b = indeksBloku(t);
        st.blok = b.lista[b.i];
        st.bloki = b.lista;
        st.opis = ((self.u.cwiartkiKolejnosc || 'kratka') === 'kratka' || self.fazaKolumn)
          ? 'Zatrzymaj na polu, w którym jest cel.'
          : (self.u.cwiartkiKolejnosc === 'wiersze'
              ? 'Zatrzymaj na wierszu, w którym jest cel.'
              : 'Zatrzymaj na kolumnie, w której jest cel.');
      } else if (self.u.tryb === 'elementy' && !self.fazaPasow) {
        st.elementy = stanElementow(t);
        st.opis = self.etap === 0 ? 'Zatrzymaj na wierszu z celem.' : 'Zatrzymaj na elemencie.';
      } else if (self.u.tryb === 'radar') {
        st.radar = stanRadaru(t);
        st.opis = self.etap === 0 ? 'Zatrzymaj promień na kierunku celu.' : 'Zatrzymaj punkt na celu.';
      } else {
        const w = przelotW(t);
        const p = w && w.p;
        if (p) {
          const poz = w.poz;
          st.pasmo = { os: p.os, od: poz, do: poz + p.grubosc, dokladny: p.dokladny,
                       grubosc: p.grubosc, stoi: w.stoi, krokow: p.krokow, indeks: w.indeks };
          st.opis = (p.os === 'y' ? 'Zatrzymaj poziomy pasek na wysokości celu.' : 'Zatrzymaj pionowy pasek na celu.') + (p.dokladny ? ' (przebieg dokładny)' : '');
        }
      }

      // tykanie przy ruchu skokowym — raz na przeskok
      const ik = indeksKroku(t);
      if (ik >= 0 && ik !== self.ostatniIndeksKroku) {
        self.ostatniIndeksKroku = ik;
        zdarzenie('tyk', { indeks: ik });
      }

      // potwierdzenie sygnału trzymanego dłużej niż czas przytrzymania
      if (self.wcisniete && !self.wcisniete.potwierdzony && self.u.czasPrzytrzymania > 0
        && (t - self.wcisniete.t) >= self.u.czasPrzytrzymania) {
        self.potwierdz(self.wcisniete.t);
      }
      return st;
    };
  };

  /* ILE POZIOMÓW ZAWĘŻANIA przejdą ćwiartki na tym ekranie. Jedna pętla dla czasu i dla liczby
     sygnałów (`kosztWyboru`) — dwie kopie rozjechałyby się przy pierwszej zmianie progu i opis
     w Bibliotece mówiłby o innej liczbie poziomów niż podpowiedź w karcie. `u` już skopiowane. */
  function poziomyCwiartek(u, ekran) {
    let w = Math.min(ekran.w, ekran.h), poziomy = 0;
    while (w > u.progKoncaBloku && poziomy < u.poziomyMax) { w /= Math.max(u.siatka[0], u.siatka[1]); poziomy++; }
    return poziomy;
  }

  /* Ile trwa jeden pełny cykl przy tych ustawieniach — do podpowiedzi w panelu
     („przy tych ustawieniach jedno kliknięcie zajmuje do ok. N s”). */
  NS.szacujCzas = function (u, ekran) {
    u = kopiaUstawien(u); ekran = ekran || { w: 1920, h: 1080 };
    if (u.tryb === 'cwiartki') {
      // Ile zapaleń na jeden poziom. 'kratka' = każde pole osobno. 'wiersze'/'kolumny' =
      // pas, potem pole w pasie, czyli dwa krótkie przejazdy zamiast jednego długiego —
      // i to jest cały zysk tej opcji (4×4: 16 → 4+4).
      const _tr = u.cwiartkiKolejnosc || 'kratka';
      const na = (_tr === 'kratka')
        ? Math.max(1, u.siatka[0] * u.siatka[1])
        : Math.max(1, u.siatka[0] | 0) + Math.max(1, u.siatka[1] | 0);
      const poziomy = poziomyCwiartek(u, ekran);
      return (u.opoznienieStartu + na * u.czasBloku * 0.5) * poziomy / 1000;
    }
    if (u.tryb === 'radar') return (u.opoznienieStartu * 2 + (180 / Math.max(1, u.stopnieNaSek)) * 1000 + 900) / 1000;
    if (u.tryb === 'elementy') return (u.opoznienieStartu + u.czasElementu * 4) / 1000;
    const osie = [];
    if (u.kolejnosc !== 'X') osie.push([ekran.h, u.pasmoY]);
    if (u.kolejnosc !== 'Y') osie.push([ekran.w, u.pasmoX]);
    let suma = 0;
    osie.forEach(function (para) {
      const d = para[0], grubosc = para[1];
      const zasieg = Math.max(1, d - grubosc);
      const czasJazdy = u.ruch === 'skokowy'
        ? (Math.floor(zasieg / Math.max(4, u.skok > 0 ? u.skok : grubosc)) + 1) * u.czasKroku / 1000
        : zasieg / Math.max(20, u.predkosc);
      suma += u.opoznienieStartu / 1000 + czasJazdy * 0.5;   // średnio w połowie przejazdu
      if (u.przebiegi >= 2) {
        const cienka = (d === ekran.h) ? u.pasmoDokladnyY : u.pasmoDokladnyX;
        const dokl = Math.max(1, grubosc - cienka) / Math.max(20, u.predkosc * u.mnoznikDokladny);
        suma += u.opoznienieStartu / 1000 + dokl * 0.5;
      }
    });
    return suma;
  };

  /* KOSZT JEDNEGO WYBORU — ile sygnałów i ile sekund kosztuje jedno kliknięcie (02.10).
     Dla kogoś, kto steruje jednym przyciskiem, sygnał jest jedyną walutą: dwa presety o tym samym
     czasie potrafią różnić się o połowę naciśnięć, a to naciśnięcia męczą. Liczone z tych samych
     pokręteł, co przejazd silnika, żeby Biblioteka nie miała własnej arytmetyki:
       pasy     — osie (jedna przy „Tylko w dół/bok”) × przebiegi,
       ćwiartki — na poziom 1 („każde pole osobno”) albo 2 (wiersz, potem pole), + 2 za paski
                  w ostatnim polu,
       radar    — kierunek i odległość,
     i +1 za menu akcji. Sygnał, który RUSZA skaner, nie wchodzi — tak samo nie wchodzi do czasu. */
  NS.kosztWyboru = function (u, ekran) {
    const uu = kopiaUstawien(u);
    const e = ekran || { w: 1920, h: 1080 };
    let sygnaly;
    if (uu.tryb === 'cwiartki') {
      const naPoziom = (uu.cwiartkiKolejnosc || 'kratka') === 'kratka' ? 1 : 2;
      sygnaly = naPoziom * poziomyCwiartek(uu, e) + (uu.poCwiartkach === 'paski' ? 2 : 0);
    } else if (uu.tryb === 'radar' || uu.tryb === 'elementy') {
      sygnaly = 2;
    } else {
      const osie = (uu.kolejnosc === 'X' || uu.kolejnosc === 'Y') ? 1 : 2;
      sygnaly = osie * (uu.przebiegi >= 2 ? 2 : 1);
    }
    if (uu.menuAkcji) sygnaly += 1;
    return { sygnaly: sygnaly, sekundy: NS.szacujCzas(u, e) };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(typeof window !== 'undefined' ? window : globalThis);
