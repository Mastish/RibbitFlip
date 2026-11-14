"use strict";
/* SKANER EKRANU — mózg okna stojącego NAD PULPITEM.

   Różni się od karty dokładnie trzema rzeczami, a wszystko inne jest wspólne (ten sam silnik,
   ta sama scena, ten sam pasek stanu):

     1. OBSZAREM. Tu skanuje się CAŁE okno, czyli cały pulpit — a nie ramkę podglądu.
     2. SYGNAŁEM. Okno przepuszcza kliknięcia i nigdy nie ma skupienia, więc własnego `keydown`
        nie usłyszy. Sygnał przychodzi WYŁĄCZNIE strumieniem `/stream` jako `t:"scan"` — z reguły
        Mapowania (`scan:sygnal`) albo z przycisku w panelu. To jest ta sama droga dla przycisku
        kapsla, przechyłu i myszy; okno nie musi wiedzieć, skąd przyszło.
     3. KLIKNIĘCIEM. Zamiast udawanego pulpitu idzie PRAWDZIWY klik — tą samą drogą, co „Klik
        w punkcie ekranu" w Mapowaniu (`mouse:left@x%,y%` przez `/test-key`). Procenty, nie
        piksele: okno stoi na całym wirtualnym pulpicie, a procenty są tam odporne i na skalowanie
        DPI, i na to, że monitor po lewej ma współrzędne ujemne.

   ⚠️ DOCIĄGANIA I TRYBU „ELEMENTY" TU NIE MA. Jedno i drugie potrzebuje listy klikalnych rzeczy,
   a nad prawdziwym pulpitem nikt jej nam nie poda — dopóki nie przeczytamy jej z Windowsa przez
   UI Automation. Skaner wskazuje więc goły punkt; w karcie, gdzie cele są znane, dociąganie
   działa normalnie. */
(function (global) {
  // TOKEN SESJI przy każdym zapisie. Panel dostaje ten sam nawyk z rf-05; tutaj jest w czterech
  // linijkach, bo cała reszta tamtego pliku (dymki, stan, podgląd) w tym oknie do niczego nie
  // służy. Bez tego nagłówka serwer odpowiada 403 i skaner wskazuje punkt, w który nie klika.
  const _fetch = global.fetch.bind(global);
  global.fetch = function (url, opts) {
    const o = opts || {};
    const m = (o.method || "GET").toUpperCase();
    if (typeof url === "string" && url[0] === "/" && m !== "GET" && m !== "HEAD" && global.RIBBITFLIP_TOKEN) {
      o.headers = Object.assign({}, o.headers, { "X-RibbitFlip-Token": global.RIBBITFLIP_TOKEN });
    }
    return _fetch(url, o);
  };

  const par = new URLSearchParams(location.search);
  const DEV = par.get("dev") || "d0";
  /* EKRAN TEGO OKNA (2026-09-26). Przy kilku monitorach nad KAŻDYM stoi osobne okno skanera
     (`ScanOverlays` w serwerze), a to niesie w adresie nazwę swojego (`&ekran=\\.\DISPLAY2`).
     ⚠️ Stała stoi TU, na górze: `zglosWidok` niżej woła się od razu przy wczytaniu pliku, a stała
     zadeklarowana dalej byłaby wtedy jeszcze w martwej strefie (ta sama pułapka, co `let ekrany`). */
  const EKRAN = par.get("ekran") || "";
  if (par.get("mark")) document.title = par.get("mark");   // po tym uruchamiarka znajduje TO okno

  /* GDZIE NA EKRANIE LEŻY TEN WIDOK (2026-09-15).

     Objaw: „nakładka na pulpicie odpalała się kilkadziesiąt pikseli poniżej
     górnej krawędzi ekranu z racji na umieszczenie paska okna na górze".

     Przeglądarka w trybie `--app` RYSUJE SWÓJ WŁASNY pasek tytułu wewnątrz okna, a Windows o nim
     nie wie — zdjęcie `WS_CAPTION` go nie usuwa i nie ma go jak zmierzyć z tamtej strony.
     Zmierzone na Edge: okno stoi równo z pulpitem (0,0 1707×1067), a widok tej strony zaczyna się
     35 px niżej i tyle samo traci na dole. Jedyny, kto zna prawdę, to my — więc ją mówimy,
     a serwer dokłada odstępy do prostokąta okna (`ScanOverlay._ustaw_okno`).

     ⚠️ TO NIE JEST TYLKO WYGLĄD. Kliknięcie liczy się jako PROCENT tego widoku (patrz `pelne()`
     niżej), a serwer przelicza procent na cały pulpit. Widok przesunięty w dół i krótszy znaczy
     więc, że klik pada wyżej niż narysowany pasek — najbardziej u góry ekranu, wcale przy dolnej
     krawędzi. Wygląda to jak niecelny skaner, a jest złe okno.

     ⚠️ MÓWIMY ROZMIAR WIDOKU, A NIE „WYSOKOŚĆ PASKA" — i to jest poprawka do pierwszej wersji
     z tego samego dnia. Podnoszenie okna o zgłoszoną wysokość paska NIE ZBIEGAŁO SIĘ: położenie
     skakało między T=-35 i T=-36, a wysokość wychodziła 1084 zamiast 1102. Serwer składa prawdę
     z TRZECH prostokątów: okna i obszaru klienta (te zna z Win32) oraz naszego widoku (`innerWidth
     /innerHeight` — tego nie zna nikt poza nami). `screenX/screenY` idą razem z nimi do wglądu:
     w tej przeglądarce mówią o narożniku OKNA, nie widoku, więc do liczenia się nie nadają.

     ⚠️ PIKSELE CSS, BEZ `devicePixelRatio` — inaczej niż w nakładkach kapsli (rf-41). Tam
     poprawkę stosuje wątek przestawiony na piksele fizyczne; tutaj wątek pilnujący okna został
     w przestrzeni wirtualizowanej, w której 1 px CSS = 1 px okna przy każdym powiększeniu ekranu.
     Przemnożone przez 1,5 dałoby poprawkę o połowę za dużą.

     Wysyłamy TYLKO PRZY ZMIANIE. Każde przesunięcie okna zmienia te liczby, więc zgłoszenie jest
     zarazem potwierdzeniem, że poprawka weszła; serwer ma własny sufit poprawek (`KOREKT_MAX`),
     żeby nawet niezbieżny przypadek nie przerodził się w okno drgające co pół sekundy. */
  let widokOstatni = "";
  function zglosWidok() {
    const v = {
      x: Math.round(window.screenX), y: Math.round(window.screenY),
      w: Math.round(window.innerWidth), h: Math.round(window.innerHeight)
    };
    if (!(v.w > 200 && v.h > 200)) return;      // pomiar w trakcie zmiany rozmiaru — poczekajmy
    const podpis = v.x + "|" + v.y + "|" + v.w + "|" + v.h;
    if (podpis === widokOstatni) return;
    widokOstatni = podpis;
    fetch("/scan/okno?dev=" + encodeURIComponent(DEV), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widok: v, ekran: EKRAN })
    }).catch(function () { widokOstatni = ""; });   // nie doszło — powiemy jeszcze raz
  }
  zglosWidok();
  setInterval(zglosWidok, 500);
  window.addEventListener("resize", zglosWidok);

  // Układ monitorów — potrzebny wyłącznie po to, żeby „prawa połowa DISPLAY2" znaczyła to samo
  // w oknie, co w ustawieniach. Strona nie ma jak go policzyć (patrz rf-31b), więc pyta serwer.
  // Raz przy starcie i przy każdej zmianie konfiguracji: monitory nie przesuwają się co klatkę,
  // a przepięty kabel i tak przychodzi razem z nowymi ustawieniami.
  let ekrany = null;
  /* Dla wszystkiego, co w tym oknie rysuje i ustawia obszar, „pulpitem" jest ekran tego okna
     (`RFScan.ekranyNaOkno`), a prawdziwy pulpit zostaje w `ekrany.pulpit` — w nim liczy się
     procent kliknięcia. Bez nazwy (jeden monitor) układ zostaje taki, jaki przysłał serwer. */
  function wczytajEkrany() {
    return fetch("/screens?dev=" + encodeURIComponent(DEV)).then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.desktop) { ekrany = RFScan.ekranyNaOkno(j, EKRAN); ustawRole(); } })
      .catch(function () { });
  }

  /* ROLA TEGO OKNA: CZYNNE albo BIERNE (2026-09-26). Skaner PRACUJE na jednym ekranie — tym, który
     wskazuje `RFScan.ekranSkanera` (lustro `scan_ekran_docelowy` w serwerze). Okno na nim rysuje
     pasek i klika, okna na pozostałych monitorach tylko pokazują obrysy, które tam mieszkają,
     a w edycji dają na nich rysować. Rola wynika z konfiguracji, więc liczymy ją po każdym jej
     wczytaniu; sygnały i tak rozstrzyga serwer (patrz `ekran` w zdarzeniu `scan`), więc chwila
     rozbieżności przy przełączaniu nie da dwóch kliknięć. */
  let czynne = true;
  function ustawRole() {
    let jest = true;
    if (EKRAN && ekrany && ekrany.pulpit) {
      const s = RFScan.ekranSkanera(u, RFScan.ekranyPelne(ekrany));
      jest = !s || s.name === EKRAN;
    }
    if (jest !== czynne) {
      czynne = jest;
      // Okno, które przestało być czynne, nie może zostawić rozpoczętego przejazdu: następny
      // sygnał pójdzie już gdzie indziej, a stojący tu pasek wyglądałby na pracujący skaner.
      if (!czynne) { try { silnik.przerwij(); } catch (e) { } }
    }
    document.body.classList.toggle("rf-bierne", !czynne);
  }

  /* ⚠️ `let ekrany` STOI TU, A NIE PRZY `pelne()` — i to nie jest kwestia gustu. Budowa silnika
     (niżej) woła `ekran()`, a ten czyta `ekrany`; w martwej strefie `let` odpowiedzią jest
     ReferenceError, którego nie łapie nawet `try` w `ekran()`, bo jego `catch` woła `pelne()`,
     czyli to samo jeszcze raz. Skutek: całe okno wstaje martwe („Cannot access 'ekrany' before
     initialization"), pasek nie rusza i nic tego nie tłumaczy. Zmierzone 15.09 przy przenoszeniu
     tego bloku o dwadzieścia linii niżej. */

  /* TRYB PODGLĄDU (2026-09-14) — to samo okno, ale bez skanowania.
     Wymaganie: „poza podglądem na tym screenie dobrze byłoby mieć możliwość
     przełączenia się na podgląd na realnym pulpicie — albo w preview w aplikacji, albo jako
     nakładka na cały pulpit". Zrzut w karcie mówi, gdzie obszar leży NA OBRAZKU; to okno mówi to
     samo na PRAWDZIWYM ekranie, więc prostokąt da się przyłożyć do okna gry.
     Trzy różnice i wszystkie idą z jednej zasady „podgląd niczego nie przejmuje":
       • obrys stoi CAŁY CZAS (`stalyPodgladObszaru`), a nie błyska po zmianie,
       • sygnały ze strumienia są ignorowane — pasek nigdzie nie rusza,
       • kliknięcie nie ma jak paść, bo silnik nigdy nie wychodzi ze spoczynku.
     Dlatego ten tryb nie wymaga włączonego modułu Skaner (patrz `/scan/okno` w monitorze). */
  /* ⚠️ TRYB EDYCJI (`?edycja=1`, rf-50m) JEST PODGLĄDEM Z DOŁOŻONĄ MYSZĄ — stąd to „albo".
     Wszystkie trzy zasady podglądu obowiązują tam tak samo (obrys stoi, sygnały ignorowane, nic
     nie klika); różnica jest jedna i leży poza tym plikiem: serwer nie zakłada takiemu oknu
     `WS_EX_TRANSPARENT`, więc ramkę obszaru da się przeciągnąć myszą. Gdyby edycja NIE była
     podglądem, wystarczyłby jeden sygnał z kapsla, żeby skaner ruszył i zaczął klikać po ekranie
     w trakcie ustawiania ramki. */
  const PODGLAD = par.get("podglad") === "1" || par.get("edycja") === "1";
  if (PODGLAD) document.body.classList.add("rf-podglad");

  /* PRÓBA (2026-09-22) — JEDYNY WYJĄTEK OD „PODGLĄD NIE PRZYJMUJE SYGNAŁÓW", i celowo wąski.

     Wymaganie: „przycisk testu wysłania sygnału, żeby od razu zasymulować i podejrzeć
     jak ta akcja działa". Okienko wyzwalaczy (rf-50p) stoi w tym samym oknie, w którym ustawia się
     obszary — i tam właśnie okazuje się, czy dobrany przed chwilą ruch w ogóle dojeżdża.

     Próba zmienia DOKŁADNIE dwie rzeczy: sygnały ze strumienia przestają być ignorowane, a akcja
     na końcu przejazdu zostawia ŚLAD zamiast klikać. Nic poza tym — okno dalej nie wymaga włącznika
     modułu, nie dotyka konfiguracji i nie wysyła ani jednego `/test-key`. Prawdziwe klikanie ma
     w tej aplikacji jedno wejście i jedną zgodę: „Uruchom nad pulpitem" (tryb `skan`) przy
     włączonym module. Gdyby próba klikała, przełącznik „na pulpicie" po cichu uzbrajałby ekran —
     czyli dokładnie to, przed czym broni się cały ten plik. */
  let proba = false;
  let probaCb = null;
  // Nasłuchy strumienia spoza tego pliku (rf-50p: reguły, włącznik modułu, sygnały). Okno ma JEDEN
  // `EventSource` i tak ma zostać — drugi byłby drugim połączeniem do tego samego serwera po to
  // samo, tylko z innej strony.
  const sluchacze = [];

  /* CZYM TO ZGASIĆ — jedyna informacja, która na tym pasku naprawdę musi być (2026-09-15).

     Wymaganie: „dodaj informację, że ALT+R+F zabija nakładkę na pulpicie (…) teraz
     dajesz jakiś tekst w ramce na dole, ale wolałbym tam tą informację o skrócie".

     DWA SKRÓTY, DWIE RÓŻNE RZECZY — i kolejność nie jest przypadkowa (poprawka z tego samego dnia
     żeby skrót skanera nie wyłączał wszystkich modułów):
       • skrót SKANERA (fabrycznie Shift+R+F) zamyka to okno i wraca do symulacji, nie ruszając
         ani jednego włącznika — to jest zwykłe „już nie skanuję" i dlatego stoi pierwszy,
       • STOP AWARYJNY (fabrycznie Alt+R+F) też zamyka to okno, ale przy okazji rozbraja CAŁĄ
         aplikację; wymienia się go jako drugi, bo to ostateczność, a nie codzienne wyjście.

     Obie kombinacje są USTAWIENIEM, nie stałą, więc pytamy o nie serwer — i pytamy też, czy skrót
     jest włączony i dostępny na tej maszynie. Przy wyłączonym obiecywanie klawiszy, które nic nie
     zrobią, byłoby gorsze od milczenia: zostaje wtedy zdanie o przełączniku w karcie. */
  function opiszSkrot() {
    return fetch("/hotkey").then(function (r) { return r.json(); }).then(function (j) {
      const klaw = function (co) {
        return (co && co.enabled && co.available)
          ? String(co.combo || "").split("+").filter(Boolean)
            .map(function (k) { return k.charAt(0).toUpperCase() + k.slice(1); }).join(" + ")
          : "";
      };
      const skan = klaw(j && j.scan);
      const stop = klaw(j);
      const czesci = [];
      if (skan) czesci.push("<b>" + skan + "</b> zamyka to okno i wracasz do podglądu");
      if (stop) czesci.push("<b>" + stop + "</b> — stop awaryjny: zamyka i rozbraja wyjścia");
      const tekst = czesci.length ? czesci.join(" · ")
        : "zgaś je przełącznikiem „Gdzie działa” w karcie Skaner";
      const pas = document.getElementById("podgladSkrot");
      if (pas) pas.innerHTML = tekst;
      // Ten sam napis w trybie skanowania — tam jest jeszcze ważniejszy, bo pasek jedzie i klika.
      if (hud && hud.skrotyTekst) hud.skrotyTekst(tekst);
    }).catch(function () { });
  }

  const korzenScena = document.getElementById("scena");
  const scena = new RFScan.Scena(korzenScena);
  const hud = new RFScan.ui.Hud(document.getElementById("hud"));
  // W podglądzie obrys ma stać, a nie błyskać: to jest okno DO CELOWANIA, więc prostokąt musi być
  // widoczny tak długo, jak długo człowiek poprawia liczby w karcie.
  if (PODGLAD) scena.stalyPodgladObszaru(true);
  /* SCENA WIE, ŻE LEŻY NA CUDZEJ PRACY (22.09). Pola bez wypełnień, jasne znaki z ciemną obwódką,
     zero gradientów do przezroczystości — patrz nota przy `Scena.nadPulpitem`. To okno ZAWSZE tak
     rysuje, w każdym ze swoich trzech trybów: nad pulpitem nie ma stanu, w którym wypełnienie
     ćwiartki byłoby w porządku. */
  scena.nadPulpitem(true);
  let u = Object.assign({}, RFScan.DOMYSLNE);
  let wyglad = Object.assign({}, RFScan.WYGLAD_DOM);

  // PRZYCIEMNIENIE ZNIKA I TO NIE JEST NIEDOPATRZENIE. Windows przygasza okno warstwowe JEDNĄ
  // alfą na całe okno, a prostokąt przyciemnienia nie jest kolorem klucza — przy alfie 255
  // wyszłaby z niego PEŁNA CZERŃ zasłaniająca pulpit zamiast delikatnego przygaszenia.
  // Obszar, w którym skaner akurat szuka, pokazuje więc sam obrys (`.sc-obszar`).
  wyglad.przyciemnienie = 0;
  // Z TEGO SAMEGO POWODU podgląd obszaru nie ma tu wypełnienia: półprzezroczysta plama nad
  // pulpitem wyszłaby pełnym kolorem i zasłoniła to, po czym skaner ma klikać. Zostaje sam obrys
  // — i tylko na chwilę po zmianie ustawień (patrz `wczytajUstawienia`).
  wyglad.podgladObszaru = 0;

  const silnik = new RFScan.Silnik({
    ustawienia: u, ekran: ekran(), cele: [],
    naZdarzenie: function (rodzaj, dane) {
      if (rodzaj === "etap") hud.blysk("ok");
      else if (rodzaj === "cofniete") hud.blysk("cofniecie");
      else if (rodzaj === "odrzucony") hud.blysk("zle");
      // Drugi bezpiecznik podglądu: silnik bez sygnału i tak nie dojdzie do akcji, ale „to okno
      // nie klika" ma być prawdą wynikającą z kodu, a nie z tego, że nic go nie obudzi.
      // W próbie silnik DO AKCJI dochodzi (sygnały wpuszczamy), więc bramka zostaje tu ta sama,
      // a rozgałęzia się dopiero decyzja: prawdziwy klik czy sam ślad na ekranie.
      else if (rodzaj === "akcja") {
        if (!PODGLAD) klikNaprawde(dane);
        else if (proba) pokazProbe(dane);
      }
    }
  });

  // DWA PROSTOKĄTY, NIE JEDEN — i mylenie ich to najłatwiejszy błąd w tym pliku.
  //   `pelne()`  — całe okno, czyli cały wirtualny pulpit. W nim liczy się KLIKNIĘCIE (procenty).
  //   `ekran()`  — obszar, w którym skaner ma pracować. W nim liczy się PASEK.
  // Do 13.09 obie odpowiedzi były tym samym prostokątem, więc pytanie nie istniało. Odkąd obszar
  // da się zawęzić, klik liczony z `ekran()` trafiałby w zupełnie inne miejsce: punkt przychodzi
  // z silnika we współrzędnych OKNA, a procent liczony z wycinka rozciągnąłby ten wycinek na cały
  // ekran. Objawem byłby skaner, który rysuje w dolnym pasku, a klika w środek pulpitu.
  /* ⚠️ PROSTOKĄT PULPITU, A NIE WŁASNEGO WIDOKU (2026-09-15) — i to jest sedno celności.

     Przy JEDNYM monitorze okno stoi w trybie kiosku i widok pokrywa pulpit co do piksela
     (`ScanOverlay.open`), więc jedno i drugie znaczy to samo. Przy kilku monitorach kiosku nie
     używamy i zostaje droga wcześniejsza: przeglądarka rysuje sobie pasek tytułu wewnątrz
     obszaru klienta, a okna nie wolno powiększyć o tyle, ile ten pasek zabiera (Chromium
     przycina wysokość — zmierzone 1084 px przy pulpicie 1067). Serwer dosuwa wtedy LEWY GÓRNY
     NAROŻNIK widoku do narożnika pulpitu (`_ustaw_okno`) i tyle wystarcza, bo przy skali 1:1
     dalej wszystko się zgadza — POD WARUNKIEM, że procenty liczymy od PULPITU. Liczone od widoku
     byłyby rozciągnięciem krótszego prostokąta na dłuższy, czyli błędem rosnącym ku dołowi
     ekranu (do 18 px na dole; wygląda jak niecelny skaner).

     Ceną na tamtej drodze jest dolny pas kilkunastu pikseli, którego w oknie nie widać — pasek
     skanera przejeżdża przez niego niewidoczny, ale klik i tam pada tam, gdzie powinien.

     Bez odpowiedzi z `/screens` (pierwsze klatki) zostaje własny widok: lepiej pokazać skaner
     odrobinę przesunięty niż nie pokazać go wcale. */
  function pelne() {
    // `ekrany` (nie `RFScan.ekrany`): to okno trzyma układ monitorów u siebie — patrz
    // `wczytajEkrany` wyżej. Wspólnego cache'u modelu nie wypełnia, bo nie ładuje panelu.
    const d = (ekrany && ekrany.desktop) ? ekrany.desktop : null;
    if (d && d.w > 0 && d.h > 0) return { x: 0, y: 0, w: d.w, h: d.h };
    return { x: 0, y: 0, w: global.innerWidth, h: global.innerHeight };
  }
  function ekran() {
    try {
      return RFScan.obszarEkranu(RFScan.zMonitorem(u, RFScan.ekranyPelne(ekrany)), pelne(), ekrany);
    } catch (e) { return pelne(); }
  }

  /* ---------------------------------------------------------------------------------------
     WIDOK OKNA A PULPIT — DWIE LICZBY, KTÓRE ZWYKLE SĄ RÓWNE I CZASEM NIE SĄ (2026-09-23).

     Objaw: „po odpaleniu skanera czasem ta grafika nie jest dobrze doskalowana
     do okna (albo okno do grafiki)".

     Scena rysuje w PIKSELACH PULPITU (`pelne()`), bo w nich liczy się klik i w nich zapisane są
     liczby obszaru. Element DOM dostaje te liczby jako piksele CSS własnego widoku — więc dopóki
     widok pokrywa pulpit jeden do jednego (kiosk przy jednym monitorze), wszystko się zgadza
     i nikt o tej różnicy nie musi wiedzieć. Gdy się nie zgadza — a potrafi: dwa monitory (kiosku
     wtedy nie używamy, Chromium przycina wysokość), powiększenie strony w tym profilu, okno,
     które nie zdążyło stanąć na miejscu — rysunek jest w złej skali, a NIC tego nie mówi:
     klik i tak pada dobrze, bo idzie procentami pulpitu.

     Stąd te dwie funkcje i skalowanie warstwy sceny niżej. Zasada, którą utrwalają:
       • RYSUJEMY w widoku (`widok()`),
       • ZAPISUJEMY i KLIKAMY w pulpicie (`pelne()`),
       • przejście między nimi jest JAWNE (`skala()`), a nie założone.
     ⚠️ Okno bez wymiaru (jeszcze nie rozłożone, zminimalizowane) podaje `innerWidth` bliskie zeru
     — wtedy udajemy, że skala wynosi 1, zamiast kurczyć scenę do zera. */
  function widok() {
    const w0 = global.innerWidth, h0 = global.innerHeight;
    if (!(w0 > 200 && h0 > 200)) return pelne();
    return { x: 0, y: 0, w: w0, h: h0 };
  }

  function skala() {
    const p = pelne(), v = widok();
    return { sx: v.w / Math.max(1, p.w), sy: v.h / Math.max(1, p.h) };
  }

  /* Skalę zakładamy SCENIE, nie każdemu rysunkowi z osobna: w środku jest kilkanaście warstw
     (pasek, pola, radar, ślady, podpisy), a każda z nich liczy swoje w pikselach pulpitu.
     ⚠️ Przy skali 1 nie zostawiamy `transform: scale(1,1)` — pusty napis zamiast niego, bo
     transformacja zakłada element warstwę kompozycji i przy okazji przycina `position: fixed`
     dzieciom. Próg 0,5 % przepuszcza zaokrąglenia, a łapie wszystko, co widać. */
  /* ⚠️ PRÓG 5 %, A NIE „JAKAKOLWIEK RÓŻNICA" — i to jest ważniejsze niż samo skalowanie.

     Przy dwóch monitorach kiosku nie używamy i Chromium przycina wysokość okna: widok bywa
     o kilkanaście pikseli (≈1,7 %) krótszy od pulpitu. To jest stan ZNANY i świadomie przyjęty
     od 15.09 — pasek przejeżdża przez ten niewidoczny pas, a klik i tam pada, gdzie trzeba, bo
     liczy się procentami PULPITU. Doskalowanie sceny do widoku naprawiłoby wygląd tych kilkunastu
     pikseli i jednocześnie ROZJECHAŁO rysunek z klikiem o tyle samo — czyli zamieniło usterkę
     niewidoczną na widoczną. Poniżej progu zostaje więc 1:1.

     Powyżej progu jest odwrotnie: rysunek w skali 60 % okna to pasek jadący w większości POZA
     oknem i obrys obszaru, którego nie widać — a o tym właśnie było zgłoszenie. Wtedy lepiej
     widzieć całość ze świadomością skali (chip „⤢ widok 60 %" w pasku edytora) niż nie widzieć nic. */
  const SKALA_PROG = 0.05;
  let skalaOstatnia = "";
  function doskalujScene() {
    const s = skala();
    const rowne = Math.abs(s.sx - 1) < SKALA_PROG && Math.abs(s.sy - 1) < SKALA_PROG;
    const zapis = rowne ? "" : "scale(" + s.sx.toFixed(5) + "," + s.sy.toFixed(5) + ")";
    if (zapis === skalaOstatnia) return;
    skalaOstatnia = zapis;
    korzenScena.style.transformOrigin = "0 0";
    korzenScena.style.transform = zapis;
    // Edytor obszaru (rf-50m) rysuje własną ramkę w pikselach WIDOKU i sam pyta o skalę —
    // mówimy mu, że się zmieniła, żeby przeliczył ramkę bez czekania na ruch myszą.
    try { if (global.RFScanEdycja && global.RFScanEdycja.poSkali) global.RFScanEdycja.poSkali(s); } catch (e) { }
  }

  // Klucze, po których poznajemy, że zmienił się PROSTOKĄT PRACY — a nie cokolwiek innego.
  // Błysk po każdej zmianie ustawień (choćby koloru paska) migałby nad pulpitem bez powodu.
  const KLUCZE_OBSZARU = ["obszar", "obszarMonitor", "obszarJednostka",
    "obszarX1", "obszarY1", "obszarX2", "obszarY2"];
  function podpisObszaru() { return KLUCZE_OBSZARU.map(function (k) { return u[k]; }).join("|"); }

  function wczytajUstawienia() {
    const bylo = podpisObszaru();
    fetch("/scan?dev=" + encodeURIComponent(DEV)).then(function (r) { return r.json(); })
      .then(function (cfg) {
        Object.keys(cfg || {}).forEach(function (k) {
          if (k in wyglad) wyglad[k] = cfg[k]; else u[k] = cfg[k];
        });
        wyglad.przyciemnienie = 0;
        wyglad.podgladObszaru = 0;
        // ZMIANA OBSZARU MA BYĆ WIDOCZNA OD RAZU. Bez tego jedyną odpowiedzią na przesunięcie
        // prostokąta w panelu był pierwszy przejazd paska — czyli dopiero po sygnale. Obrys
        // podświetla się na dwie sekundy i gaśnie; stały prostokąt wisiałby nad cudzą pracą.
        if (podpisObszaru() !== bylo) scena.blysnijObszarem(2000);
        // Nad pulpitem nie znamy przycisków Windowsa, więc dociąganie nie miałoby do czego
        // dociągać — a wyglądałoby, jakby działało i chybiało.
        u.dociaganie = 0;
        if (u.tryb === "elementy") u.tryb = "pasy";
        silnik.ustawienia(u);
        ustawRole();
        // Edytor obszaru (tryb `?edycja=1`) rysuje WŁASNĄ ramkę i musi pójść za zmianą, która
        // przyszła skądinąd: z karty albo z przełączenia sekcji wyzwalaczem. ⚠️ Czyta konfigurację
        // OD NOWA, a nie to `u` — tu wyżej jest ona celowo podmieniona pod nakładkę (rf-50m).
        try { if (global.RFScanEdycja) global.RFScanEdycja.poZmianie(); } catch (e) { }
      }).catch(function () { });
  }

  /* Prawdziwe kliknięcie. Procenty CAŁEGO wirtualnego pulpitu — patrz nagłówek. */
  function klikNaprawde(wynik) {
    // CAŁE OKNO, nie obszar skanowania — patrz nota przy `pelne()` wyżej. Punkt jest już we
    // współrzędnych okna, więc procent liczy się z jego pełnych wymiarów niezależnie od tego,
    // jak wąski wycinek skaner akurat przeczesywał.
    // Przy oknie na jednym z kilku monitorów punkt leży w pikselach TEGO ekranu, a procent ma
    // być procentem całego pulpitu — `procentPulpitu` dokłada przesunięcie ekranu (2026-09-26).
    const pr = RFScan.procentPulpitu(wynik.punkt, ekrany, pelne());
    const px = pr.x, py = pr.y;
    const opis = RFScan.akcja(wynik.akcja);
    // „Kopiuj" i „Wytnij" (`bezKliku` w katalogu): SAM skrót. Klik w tekst skasowałby zaznaczenie,
    // którego te komendy dotyczą — sprawdzone na żywo 29.09. Bez śladu w punkcie, bo tam nic się
    // nie dzieje; znacznik obiecywałby klik, którego nie było.
    if (opis && opis.bezKliku && opis.klawisze) { wyslij(opis.klawisze); return; }
    // KLAWIATURA EKRANOWA = systemowy skrót Win+Ctrl+O (włącza i wyłącza klawiaturę Windows).
    // Do 29.09 ta akcja, jak przewijanie i przeciąganie niżej, spadała do „|| left" i nad pulpitem
    // robiła zwykły lewy klik — złapane testem na żywo wszystkich akcji katalogu.
    if (wynik.akcja === "klawiatura") { wyslij("ctrl+win+o"); return; }
    // ⚠️ KLIK LICZY SIĘ OD PULPITU (patrz wyżej), a ŚLAD OD OBSZARU — bo scena przestawia ślady
    // w każdej klatce prostokątem obszaru. Do 22.09 stało tu `e` i znacznik lądował obok miejsca,
    // w które skaner naprawdę kliknął. Klik był przez cały czas celny; mylił rysunek.
    scena.slad(wynik.punkt, RFScan.nazwaAkcji(wynik.akcja), ekran());

    // Pulpit z kilku monitorów bywa szeroki na kilka tysięcy pikseli — setna procenta to tam już
    // pół piksela, więc przy nim bierzemy tysięczne (serwer czyta procent jako liczbę zmiennoprzecinkową).
    const miejsca = (ekrany && ekrany.pulpit) ? 3 : 2;
    const wPunkt = function (p) {
      const r = RFScan.procentPulpitu(p, ekrany, pelne());
      return r.x.toFixed(miejsca) + "%," + r.y.toFixed(miejsca) + "%";
    };
    // PRZEWIJANIE: kursor nad wskazane miejsce, potem kółko. Okno pod kursorem dostaje przewinięcie,
    // więc punkt wybiera, CO się przewija (lista, strona, panel boczny). Dwa ruchy kółka po
    // SCROLL_STEP ząbków = mniej więcej pół ekranu tekstu.
    if (wynik.akcja === "przewinDol" || wynik.akcja === "przewinGore") {
      const k = wynik.akcja === "przewinDol" ? "mouse:scrolldown" : "mouse:scrollup";
      wyslijMakro("mouse:move@" + wPunkt(wynik.punkt) + "; wait 40; " + k + "; " + k);
      return;
    }
    // PRZECIĄGANIE: silnik zbiera DWA punkty (`od` i `punkt`). Wciśnij w pierwszym, przejedź
    // kilkoma krokami do drugiego i puść — skok jednym ruchem część programów bierze za klik.
    if (wynik.akcja === "przeciagnij" && wynik.od) {
      const a = wynik.od, b = wynik.punkt, kroki = [];
      kroki.push("mouse:move@" + wPunkt(a), "wait 40", "down mouse:left", "wait 80");
      for (let i = 1; i <= 4; i++) {
        kroki.push("mouse:move@" + wPunkt({ x: a.x + (b.x - a.x) * i / 4, y: a.y + (b.y - a.y) * i / 4 }), "wait 30");
      }
      kroki.push("wait 60", "up mouse:left");
      wyslijMakro(kroki.join("; "));
      return;
    }

    const nazwa = (opis && opis.rodzaj === "klawisze") ? "left"
      : ({ lewy: "left", dwuklik: "double", prawy: "right", srodkowy: "middle", kursor: "move" }[wynik.akcja] || "left");
    const spec = "mouse:" + nazwa + "@" + px.toFixed(miejsca) + "%," + py.toFixed(miejsca) + "%";
    wyslij(spec).then(function () {
      // Akcja klawiszowa („Kopiuj", „Usuń") to klik ORAZ skrót — bez kliknięcia system nie wie,
      // czego skrót ma dotyczyć.
      if (opis && opis.rodzaj === "klawisze" && opis.klawisze) {
        setTimeout(function () { wyslij(opis.klawisze); }, 70);
      }
    });
  }

  /* PRÓBA: to samo, co klik, minus klik. Ślad pokazuje, GDZIE i CZYM skaner by kliknął, a wynik
     idzie do okienka wyzwalaczy, żeby dało się go przeczytać słowami („Klik lewym · 1204 × 668 px").
     ⚠️ Ani jednego `wyslij()` w tej gałęzi — patrz nota przy `proba` wyżej. */
  function pokazProbe(wynik) {
    /* ⚠️⚠️ ŚLAD DOSTAJE PROSTOKĄT OBSZARU, NIE CAŁEGO PULPITU — i to jest cała różnica między
       „pokazał, gdzie kliknie" a „pokazał gdzie indziej".

       `Scena.slad` zapamiętuje punkt jako UŁAMEK podanego prostokąta, a potem KAŻDA KLATKA
       przestawia go na nowo tym prostokątem, który dostaje `rysuj()` — czyli obszarem skanowania
       (`klatka` niżej). Ułamek policzony od pulpitu, a przyłożony do obszaru, przesuwa kropkę
       tym mocniej, im węższy obszar: przy obszarze 1434 px na pulpicie 1707 px punkt 553 px
       rysował się na 720 px. Na zrzucie z tego błędu: zaznaczone kółkiem
       miejsce sygnału i drugie, w którym stanął znacznik. Liczba w okienku wyzwalaczy była
       przy tym poprawna — kłamał tylko rysunek. */
    const op = RFScan.akcja(wynik.akcja);
    if (!(op && op.bezKliku)) {   // „Kopiuj"/„Wytnij" nie klikają — patrz `klikNaprawde`
      try { scena.slad(wynik.punkt, RFScan.nazwaAkcji(wynik.akcja), ekran()); } catch (err) { }
    }
    if (probaCb) { try { probaCb(wynik); } catch (err) { } }
  }

  function wyslij(spec) {
    return fetch("/test-key?dev=" + encodeURIComponent(DEV), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keySpec: spec })
    }).then(function (r) { return r.json(); }).catch(function () { return null; });
  }
  // Kilka kroków z odstępami (przeciąganie, przewinięcie w punkcie) — ta sama droga co przycisk
  // „Test" makra: serwer wykonuje je po kolei na własnym wątku i pilnuje tej samej bramki uzbrojenia.
  function wyslijMakro(sekwencja) {
    return fetch("/test-key?dev=" + encodeURIComponent(DEV), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequence: sekwencja })
    }).then(function (r) { return r.json(); }).catch(function () { return null; });
  }

  /* SYGNAŁY — jedyne wejście tego okna. */
  function podepnijStrumien() {
    let zrodlo = null;
    const polacz = function () {
      try { zrodlo = new EventSource("/stream"); } catch (e) { return; }
      zrodlo.onmessage = function (ev) {
        let m = null;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (!m) return;
        // Nasłuchy PRZED obsługą własną: gałęzie niżej kończą się `return`, więc dopisanie się na
        // końcu znaczyłoby „dostajesz wszystko oprócz tego, co nas interesuje".
        for (let i = 0; i < sluchacze.length; i++) { try { sluchacze[i](m); } catch (e) { } }
        if (m.t === "scan") {
          if (m.dev && m.dev !== DEV) return;
          // SYGNAŁ DLA INNEGO EKRANU (2026-09-26): serwer wpisuje w zdarzenie, na którym monitorze
          // skaner pracuje, i tylko okno na nim reaguje. Tu jeszcze zatrzymujemy własny przejazd,
          // gdyby został po chwili, w której to okno było czynne.
          if (m.ekran && EKRAN && m.ekran !== EKRAN) {
            if (m.co === "stop") { try { silnik.przerwij(); } catch (e) { } }
            return;
          }
          // Podgląd nie reaguje na sygnały — ani na te z kapsla, ani na przycisk w panelu. Gdyby
          // reagował, przełącznik „obszar na pulpicie" po cichu uzbrajałby klikanie, a to jest
          // dokładnie ta decyzja, którą podejmuje się włącznikiem modułu.
          // WYJĄTEK: trwająca próba (rf-50p) — wpuszcza sygnały, ale akcja i tak nie klika.
          if (PODGLAD && !proba) return;
          const t = performance.now();
          // `true` = IMPULS. Bez tego pokrętło „Ile trzymać, żeby się liczyło" powyżej zera
          // odrzucało tu KAŻDY sygnał jako „za krótki" — naciśnięcie i puszczenie idą w tej samej
          // milisekundzie, bo z ruchu kapsla nie da się odczytać długości trzymania.
          if (m.co === "sygnal" || m.co === "start") { silnik.sygnal(t, true); silnik.puszczenie(t + 1); hud.blysk("sygnal"); }
          else if (m.co === "cofnij") silnik.cofnij(t);
          else if (m.co === "stop") silnik.przerwij();
          return;
        }
        // Konfiguracja mogła się zmienić w panelu albo przełączyć sekcję (`scan:sekcja=N`), gdy
        // okno już stoi. Układ monitorów odświeżamy razem z nią: nowa sekcja bywa przypięta do
        // innego ekranu, a pytanie jest tanie i idzie raz na zmianę, nie co klatkę.
        if (m.t === "scan_cfg" && (!m.dev || m.dev === DEV)) wczytajEkrany().then(wczytajUstawienia);
      };
      // Zerwany strumień = okno bez wejścia. Wracamy po sekundzie, bez hałasu.
      zrodlo.onerror = function () {
        try { zrodlo.close(); } catch (e) { }
        setTimeout(polacz, 1000);
      };
    };
    polacz();
  }

  function klatka(t) {
    requestAnimationFrame(klatka);
    // Skala sprawdzana co klatkę, ustawiana TYLKO przy zmianie (patrz `doskalujScene`): okno
    // potrafi dojść na miejsce sekundę po starcie, a przeglądarka zmienić powiększenie w trakcie.
    doskalujScene();
    const e = ekran();
    silnik.ustawEkran(e);
    const stan = silnik.krok(t);
    // Scena dostaje TEN SAM prostokąt co silnik: przyciemnienie, kreski pomocnicze i obrys mają
    // opisywać obszar skanowania, a nie cały pulpit. Nad pulpitem przyciemnienie i tak jest
    // zerowe (patrz wyżej), więc widać sam obrys — i to on mówi człowiekowi, gdzie skaner pracuje.
    scena.rysuj(stan, wyglad, e, []);
    przytnijObrys();
    hud.rysuj(stan);
  }

  /* OBRYS OBSZARU MA SIĘ DOMYKAĆ W TYM OKNIE (2026-09-15).

     Objaw: „ramka nie dochodzi do samego dołu pulpitu". I nie dochodziła:
     rysujemy w skali 1:1 z pulpitem (patrz `pelne()`), a widok bywa o kilkanaście pikseli
     krótszy, bo Chromium nie pozwala powiększyć zwykłego okna o swój pasek tytułu. Dolna krecha
     prostokąta lądowała więc pod krawędzią widoku i po prostu nie było jej widać — ramka
     wyglądała na rozerwaną. Od kiosku (jeden monitor) widok jest równy pulpitowi i zostaje tu
     do przycięcia tyle, ile trzeba na samą grubość krechy — ale kod zostaje: przy kilku
     monitorach brakuje dalej tych kilkunastu pikseli.

     Dociągamy TYLKO OBRYS, i tylko w tę stronę (skracamy, nigdy nie wydłużamy). Reszta sceny
     zostaje 1:1, bo pasek i punkt kliknięcia MUSZĄ być tam, gdzie naprawdę padnie klik — pasek
     przejeżdża przez niewidoczny dolny pas i klika poprawnie. Obrys mówi „tu skaner pracuje",
     więc kilkanaście pikseli krótsza krecha jest uczciwszą odpowiedzią niż brak krechy. */
  function przytnijObrys() {
    const o = korzenScena.querySelector(".sc-obszar");
    if (!o || o.style.display === "none") return;
    // ⚠️ OKNO BEZ WYMIARU NIE JEST OKNEM MAŁYM. Zminimalizowana albo jeszcze nierozłożona strona
    // podaje `innerHeight` bliskie zeru (zmierzone: dokładnie 0 w schowanej karcie), a przycięcie
    // do takiej „widocznej wysokości" skurczyłoby obrys do kilku pikseli i tak by został, bo
    // dopiero następna klatka go odbuduje. Nakładka zawsze stoi na pulpicie, więc mniej niż
    // 200 px znaczy „jeszcze nie wiem", a nie „tyle widać".
    if (!(global.innerWidth > 200 && global.innerHeight > 200)) return;
    const r = o.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return;
    const zapas = 3;                            // grubość obrysu i oddech, żeby krecha była cała
    const zaDuzoW = (r.right + zapas) - global.innerWidth;
    const zaDuzoH = (r.bottom + zapas) - global.innerHeight;
    // ⚠️ ODEJMUJEMY OD LICZBY ZE STYLU, NIE OD ZMIERZONEJ. `getBoundingClientRect` podaje pudło
    // Z OBWÓDKĄ, a `style.width` opisuje jego wnętrze (obrys ma `border: 2px` i nie ma
    // `box-sizing: border-box`), więc odjęcie nadmiaru od zmierzonej szerokości zostawiało
    // prostokąt dokładnie o tę obwódkę za duży — zmierzone: prawa krawędź na 1281 px w oknie
    // szerokim na 1280. Scena i tak przepisuje te wymiary w każdej klatce, więc nic się nie kumuluje.
    const wStylu = parseFloat(o.style.width) || r.width;
    const hStylu = parseFloat(o.style.height) || r.height;
    if (zaDuzoW > 0) o.style.width = Math.max(8, Math.round(wStylu - zaDuzoW)) + "px";
    if (zaDuzoH > 0) o.style.height = Math.max(8, Math.round(hStylu - zaDuzoH)) + "px";
  }

  wczytajEkrany().then(wczytajUstawienia);
  podepnijStrumien();
  opiszSkrot();
  requestAnimationFrame(klatka);
  // `ekrany` wystawiamy dla edytora obszaru (rf-50m): układ monitorów jest potrzebny, żeby ramkę
  // przeliczyć na liczby konfiguracji, a strona pyta o niego tylko raz i trzyma u siebie.
  global.RFScanNakladka = { silnik: silnik, ekran: ekran, pelne: pelne, skrot: opiszSkrot,
                            nazwaEkranu: EKRAN, czynne: function () { return czynne; },
                            ekrany: function () { return ekrany; },
    /* Scena i wygląd na wierzchu — dla testu wizualnego. W schowanej karcie przeglądarki `rAF`
       stoi, więc `klatka()` się nie kręci i nic się nie rysuje; harness musi móc narysować klatkę
       sam, dokładnie tymi samymi argumentami, co ona. */
    scena: scena, wyglad: function () { return wyglad; },
    // Widok okna i skala rysowania — patrz nota przy `widok()`. Rf-50m liczy nimi ramkę obszaru,
    // rf-50p pozycję okienka, a test sprawdza, że scena idzie za oknem.
    widok: widok, skala: skala,
    klatka: function (t) {
      doskalujScene();
      const e = ekran();
      silnik.ustawEkran(e);
      const st = silnik.krok(t);
      scena.rysuj(st, wyglad, e, []);
      przytnijObrys();
      hud.rysuj(st);
      return st;
    },
    // Podpięcie się pod strumień tego okna — patrz `sluchacze`.
    naStrumien: function (f) { if (typeof f === "function") sluchacze.push(f); },
    /* Włącz albo wyłącz próbę; bez argumentu odpowiada, czy trwa. Wyłączenie PRZERYWA przejazd
       i sprząta ślady: zostawiony pasek nad cudzą pracą wyglądałby jak pracujący skaner, a nim
       już nie jest. */
    proba: function (on, cb) {
      if (on === undefined) return proba;
      proba = !!on;
      if (cb !== undefined) probaCb = (typeof cb === "function") ? cb : null;
      if (!proba) {
        try { silnik.przerwij(); } catch (e) { }
        try { scena.wyczyscSlady(); } catch (e) { }
      }
      return proba;
    } };
})(window);
