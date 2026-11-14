"use strict";
/* SKANER — OBSZAR USTAWIANY MYSZĄ NA PRAWDZIWYM EKRANIE (tryb `?edycja=1`).

   W nakładce „na pulpicie” da się ręcznie ustawić pozycję i wielkość obszaru i zapisać to
   w aplikacji, dodać kolejny obszar („dodaj kolejną”) i od razu nadać nazwę każdej sekcji.

   PO CO OSOBNY TRYB, SKORO OBSZAR USTAWIA SIĘ W KARCIE. Bo w karcie ustawia się go LICZBAMI albo
   po zrzucie ekranu, a celuje się w prawdziwą grę. Tutaj ramkę przykłada się do tego, co naprawdę
   widać — i to jest cała różnica.

   ⚠️ TO JEDYNE OKNO NAKŁADKI, KTÓRE BIERZE MYSZ. Pozostałe mają `WS_EX_TRANSPARENT` i przepuszczają
   kliknięcia do pulpitu; tutaj serwer tego stylu nie zakłada (patrz `ScanOverlay.open`), więc przez
   czas edycji okno zbiera wszystkie kliknięcia z ekranu. Dlatego wyjścia są trzy i wszystkie
   widoczne: przycisk „Gotowe", `Esc` i skrót zamykający nakładkę.

   ⚠️ ZAPISUJEMY ŚWIEŻĄ KONFIGURACJĘ Z SERWERA, NIGDY KOPII rf-50h. Tamta jest celowo podmieniona
   pod nakładkę (`dociaganie: 0`, tryb „elementy" zamieniony na „pasy" — nad pulpitem nie znamy
   przycisków Windowsa), a `/scan` NADPISUJE całą konfigurację sekcji tym, co dostanie. Odesłanie
   tamtej kopii skasowałoby człowiekowi tryb i dociąganie przy pierwszym przeciągnięciu ramki. */
(function (global) {
  const par = new URLSearchParams(location.search);
  if (par.get("edycja") !== "1") return;        // ten plik ożywa TYLKO w trybie edycji
  const DEV = par.get("dev") || "d0";
  // Ekran, nad którym stoi TO okno — przy kilku monitorach każdy ma swoje (patrz rf-50h).
  const EKRAN = par.get("ekran") || "";
  const MIN = 24;            // najmniejszy bok obszaru — tyle samo, co w modelu (`obszarEkranu`)

  let cfg = null;            // ostatnia ŚWIEŻA konfiguracja z serwera
  let prost = null;          // ramka w pikselach TEGO widoku: {x, y, w, h}
  let ciag = null;           // trwające przeciąganie
  let stanTimer = 0;
  let ukryty = false;        // schowany edytor: sam obrys i oczko — patrz `ukryj`
  let cienie = [];           // prostokąty CUDZYCH skanerów w tym widoku — po nich trafia mysz

  /* CZY POKAZYWAĆ OBSZARY POZOSTAŁYCH SKANERÓW (16.09). W trybie „na
     pulpicie” można zobaczyć wszystkie albo wybrać konkretny, oznaczone kolorami i opisane.
     Wybór OGLĄDANIA, nie skanera — więc nie idzie do konfiguracji:
     w presecie wysłanym komuś innemu nie miałby czego opisywać.

     ⚠️ EDYTOR ZAWSZE ZACZYNA OD „Wszystkie skanery" (22.09; domyślnie
     „pokaż wszystkie dla tej planszy”). Do 22.09 wybór szedł do `localStorage` pod klucz
     `rf.scan.pozostale` — TEN SAM, którego używa oczko w pasku plansz w karcie (rf-50k). Skutek
     był taki, że jedno kliknięcie oczka kiedyś tam otwierało edytor bez cudzych obrysów i nic
     w oknie nie tłumaczyło, dlaczego ich nie ma. Okno edytora żyje kilkanaście sekund i służy do
     ustawienia obszaru WŚRÓD innych — zawężenie sprzed tygodnia jest tu gorsze niż żadne. Wybór
     „Tylko ustawiany" zostaje więc na czas tego okna i nie przenosi się na następne. */
  let pokazujInne = true;

  document.body.classList.add("rf-edycja");

  // --- pomocnicze -----------------------------------------------------------------------
  function N() { return global.RFScanNakladka || {}; }
  /* ⚠️ RAMKĘ RYSUJEMY W PIKSELACH WIDOKU, NIE PULPITU (2026-09-23).

     Do 23.09 stało tu `pelne()`, czyli prostokąt PULPITU — i było to poprawne tylko dlatego, że
     widok okna zwykle pokrywa pulpit jeden do jednego (kiosk przy jednym monitorze). Gdy nie
     pokrywa — dwa monitory, powiększenie strony w profilu nakładki, okno jeszcze nie na miejscu —
     ramka rysowała się w złej skali, a co gorsza ZAPISYWAŁA obszar przeliczony tak, jakby widok
     był pulpitem: przeciągnięcie do połowy okna zapisywało się jako 75 % ekranu, a grafika
     bywała źle doskalowana do okna (albo okno do grafiki).

     Teraz: rysujemy i ciągniemy w WIDOKU, a zapisujemy w ułamkach PULPITU (`baza`, `zapisz`) —
     przejście między jednym a drugim jest jawne i robi je jedna arytmetyka. */
  function cel() {
    if (N().widok) return N().widok();
    if (N().pelne) return N().pelne();
    return { x: 0, y: 0, w: innerWidth, h: innerHeight };
  }
  function ekrany() { return (N().ekrany ? N().ekrany() : null); }

  /* BAZA, w której konfiguracja liczy swoje od–do: wskazany monitor albo cały pulpit — i zawsze
     w tych samych współrzędnych, w których myśli `RFScan.obszarEkranu`. Własna, bo `bazaObszaru`
     z modelu podaje sam ROZMIAR, a do zapisu potrzebny jest jeszcze narożnik. */
  function baza() {
    const e = ekrany();
    const p = (e && e.desktop) ? e.desktop : null;
    if (!p) return null;
    // ⭐ OKNO NA JEDNYM Z KILKU MONITORÓW (2026-09-26): ramkę narysowano NA TYM EKRANIE, więc to on
    // jest bazą — także wtedy, gdy skaner mieszkał dotąd na innym. `zapisz` wpisuje wtedy ten ekran
    // do konfiguracji, czyli przenosi skaner tutaj.
    if (e.okno) return { x: p.x || 0, y: p.y || 0, w: p.w, h: p.h, pulpit: p, ekran: e.okno };
    const lista = (e && Array.isArray(e.screens)) ? e.screens : [];
    if (cfg && cfg.obszarMonitor) {
      const s = lista.filter(function (x) { return x && x.name === cfg.obszarMonitor; })[0] || lista[0];
      if (s) return { x: s.x, y: s.y, w: s.w, h: s.h, pulpit: p };
    }
    return { x: p.x || 0, y: p.y || 0, w: p.w, h: p.h, pulpit: p };
  }

  function stan(tekst, klasa) {
    const e = document.getElementById("edStan");
    if (!e) return;
    e.textContent = tekst || "";
    e.className = "sk-ed-stan" + (klasa ? " " + klasa : "");
    clearTimeout(stanTimer);
    if (tekst) stanTimer = setTimeout(function () { e.textContent = ""; e.className = "sk-ed-stan"; }, 2600);
  }

  // --- szkielet -------------------------------------------------------------------------
  function buduj() {
    if (document.getElementById("edytor")) return;
    const w = document.createElement("div");
    w.id = "edytor";
    w.className = "sk-ed";
    let uchwyty = "";
    ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach(function (k) {
      uchwyty += '<span class="sk-ed-uchwyt sk-ed-u-' + k + '" data-u="' + k + '"></span>';
    });
    w.innerHTML =
      // Cienie PRZED ramką: ustawiany obszar ma leżeć na wierzchu, bo to jego się dotyka.
      '<div class="sk-ed-cienie" id="edCienie" aria-hidden="true"></div>' +
      '<div class="sk-ed-ramka" id="edRamka">' + uchwyty +
        '<span class="sk-ed-wymiar" id="edWymiar"></span>' +
      '</div>' +
      '<div class="sk-ed-pasek" id="edPasek">' +
        // OCZKO PIERWSZE W PASKU I JAKO JEDYNE ZOSTAJE PO SCHOWANIU — patrz `ukryj`.
        '<button type="button" class="sk-ed-oko" id="edOko" ' +
          'title="Schowaj uchwyty i pasek — obrys obszaru zostaje, a kliknięcia znów trafiają ' +
          'do pulpitu. Oczko zostaje na wierzchu i tym samym oczkiem wracasz do ustawiania.">' +
          '🙈</button>' +
        '<b class="sk-ed-tytul">Ustawiasz obszar skanera</b>' +
        // Kropka w kolorze ustawianego skanera — ten sam kolor ma jego ramka i jego pigułka
        // w karcie, więc „ten drugi na liście" i „ta ramka na ekranie" są jedną rzeczą.
        '<span class="sk-ed-kropka" id="edKropka" aria-hidden="true"></span>' +
        '<select id="edSekcja" class="sk-ed-pole" title="Który skaner ustawiasz"></select>' +
        // KTORA PLANSZA (grupa) jest teraz ustawiana. Lista rozwijana wybiera plansze; nad pulpitem zadna
        // grafika sie nie wyswietla (jest prawdziwy ekran), wiec wybor planszy znaczy tu: KTORE
        // skanery naleza do tego widoku, czyli ktore obrysy widac i po czym chodzi `scan:sekcja=nast`.
        '<select id="edZrzut" class="sk-ed-pole" title="Plansza albo grupa skanerow — decyduje, ' +
          'ktore obrysy widac i po ktorych chodzi akcja „nastepny skaner w grupie”."></select>' +
        '<select id="edPodglad" class="sk-ed-pole" ' +
          'title="Co widać na ekranie: obszary wszystkich skanerów tej konfiguracji (każdy w swoim ' +
          'kolorze, z nazwą) czy tylko ten, który właśnie ustawiasz.">' +
          '<option value="wszystkie">👁 Wszystkie skanery</option>' +
          '<option value="ten">👁 Tylko ustawiany</option>' +
        '</select>' +
        '<input id="edNazwa" class="sk-ed-pole sk-ed-nazwa" maxlength="40" placeholder="nazwa sekcji" ' +
          'title="Nazwa tego skanera — widać ją tutaj i w karcie Skaner">' +
        '<button type="button" class="sk-ed-btn" id="edDodaj" ' +
          'title="Nowa sekcja powstaje jako kopia tej i od razu staje się tą, którą ustawiasz">' +
          '＋ Dodaj kolejną</button>' +
        /* SYGNAŁ PRÓBNY STOI W TYM PASKU, A NIE TYLKO W OKIENKU (22.09).
           „Wyślij sygnał” stoi też na głównym pasku na dole, bo samo okienko jest mało czytelne:
           pasek na dole to miejsce, na które się tu patrzy —
           okienko stoi z boku, bywa zwinięte i bywa przesunięte. Kolor bursztynowy, nie różowy:
           różowy w tym pasku znaczy „Gotowe", czyli koniec pracy, a to jest próba.
           „Koniec próby" pokazuje się sam, gdy próba trwa (klasa `rf-proba` na `<body>`, zakłada
           ją rf-50p) — bez tego trzeba by trzymać drugi stan w dwóch miejscach naraz. */
        '<button type="button" class="sk-ed-btn sk-ed-btn-proba" id="edSygnal" ' +
          'title="Wyślij sygnał próbny — pasek pojedzie po prawdziwym ekranie, pokaże, gdzie by ' +
          'kliknął, i NIE kliknie. Sygnał z kapsla też wtedy działa.">' +
          '🎯 Sygnał</button>' +
        '<button type="button" class="sk-ed-btn sk-ed-btn-koniec" id="edKoniecProby" ' +
          'title="Zakończ próbę — okno wraca do ignorowania sygnałów, pasek staje.">' +
          '■ Koniec próby</button>' +
        /* WEJŚCIE DO OKIENKA SKANERA (22.09, rf-50p). Samo okienko otwiera się razem z edytorem
           — zwinięte do paska tytułu — więc ten przycisk jest drogą POWROTU po jego zamknięciu,
           a nie jedyną drogą do niego. Stoi przy „Gotowe", bo to druga rzecz, którą się tu robi:
           najpierw obszar, potem strojenie skanera.

           ⚙ NAZWA „USTAWIENIA", NIE „WYZWALACZE" (23.09, celowo). Przycisk otwiera
           CAŁE okienko, a ono od 23.09 staje na zakładce Ustawienia — nazwa opisująca jedną
           z dwóch zakładek, i to nie tę, którą się zobaczy, myliła dwa razy: przy wejściu
           i po otwarciu. */
        '<button type="button" class="sk-ed-btn" id="edUst" ' +
          'title="Ustawienia skanera: pokrętła, zestawy, wyzwalacze i próba sygnału — wszystko ' +
          'w jednym okienku, bez wracania do panelu">' +
          '⚙ Ustawienia</button>' +
        /* ZRZUT TEGO EKRANU (2026-09-26). Przechwytywanie ekranu dla
           skanera da się zrobić z wyborem ekranu — tutaj wyborem jest samo okno: fotografuje
           monitor, nad którym stoi (okna skanera chowają się na czas zdjęcia). Powstaje NOWA
           plansza, która od razu staje się wybraną. */
        '<button type="button" class="sk-ed-btn" id="edZrzutEkranu" ' +
          'title="Zrób zdjęcie tego ekranu i dodaj je jako nową planszę. Okna skanera chowają się ' +
          'na czas zdjęcia, więc na planszy ich nie ma.">📸 Zrzut tego ekranu</button>' +
        '<button type="button" class="sk-ed-btn sk-ed-btn-ok" id="edGotowe">✓ Gotowe</button>' +
        // OKNO BIERNE (inny monitor niż ten, na którym skaner pracuje) mówi, co tu da się zrobić.
        '<span class="sk-ed-bierne" id="edBierne">Skaner pracuje na innym ekranie. Narysuj tu ' +
          'ramkę, żeby go przenieść na ten.</span>' +
        // SKALA OKNA — widoczna TYLKO wtedy, gdy jest inna niż 1:1 (patrz `pokazSkale`). Cichy
        // rozjazd widoku i pulpitu był dokładnie tym, czego nie dało się zobaczyć bez linijki.
        '<span class="sk-ed-skala" id="edSkala" hidden></span>' +
        '<span class="sk-ed-stan" id="edStan"></span>' +
        '<span class="sk-ed-hint">Przeciągnij ramkę albo jej narożnik — po puszczeniu myszy obszar ' +
          'zapisuje się sam. Chwycenie CUDZEJ ramki przełącza na tamten skaner i od razu go ciągnie. ' +
          'Ciągnięcie po pustym miejscu rysuje ramkę od nowa. Esc zamyka.</span>' +
      '</div>';
    document.body.appendChild(w);

    document.getElementById("edGotowe").addEventListener("click", zamknij);
    document.getElementById("edZrzutEkranu").addEventListener("click", zrzutEkranu);
    document.getElementById("edOko").addEventListener("click", function () { ukryj(!ukryty); });
    document.getElementById("edDodaj").addEventListener("click", dodajSekcje);
    // Okienko wyzwalaczy żyje w osobnym pliku (rf-50p) i ładuje się PO nas — pytamy o nie
    // w chwili kliknięcia, nie przy budowaniu paska. Gdyby go nie było, przycisk mówi o tym
    // zamiast milczeć: nic tu nie znika po cichu.
    document.getElementById("edSygnal").addEventListener("click", function () {
      const W = global.RFScanWyzwalacze;
      if (!W) { stan("Próba nie jest gotowa.", "zle"); return; }
      W.sygnal("sygnal");                       // pierwszy sygnał sam zaczyna próbę
      stan("sygnał próbny — nic nie kliknie", "ok");
    });
    document.getElementById("edKoniecProby").addEventListener("click", function () {
      const W = global.RFScanWyzwalacze;
      if (W) W.proba(false);
      stan("próba zakończona", "ok");
    });
    document.getElementById("edUst").addEventListener("click", function () {
      const W = global.RFScanWyzwalacze;
      if (!W) { stan("Okienko skanera się nie wczytało.", "zle"); return; }
      const teraz = W.przelacz();
      if (teraz && W.zwiniete && W.zwiniete()) W.zwin(false);   // wracasz do niego po to, żeby je widzieć
    });
    document.getElementById("edSekcja").addEventListener("change", function () {
      sekcja({ act: "wybierz", n: parseInt(this.value, 10) || 1 });
    });
    document.getElementById("edZrzut").addEventListener("change", function () {
      zrzut({ act: "wybierz", n: parseInt(this.value, 10) || 0 });
    });
    document.getElementById("edPodglad").addEventListener("change", function () {
      pokazujInne = (this.value !== "ten");
      rysujCienie();
    });
    // Nazwa na `change` (Enter albo wyjście z pola), nie na każdą literę: każdy znak byłby
    // osobnym zapisem na dysk — ta sama zasada, co w pasku sekcji w karcie (rf-50k).
    document.getElementById("edNazwa").addEventListener("change", function () {
      sekcja({ act: "nazwij", n: (cfg && cfg.sekcjaAktywna) || 1, nazwa: this.value });
    });
    // Pasek NIE MOŻE zaczynać przeciągania: to jest jedyne miejsce w oknie, po którym da się
    // kliknąć bez rysowania nowej ramki.
    document.getElementById("edPasek").addEventListener("mousedown", function (ev) { ev.stopPropagation(); });
    w.addEventListener("mousedown", zacznij);
    global.addEventListener("mousemove", rusz);
    global.addEventListener("mouseup", skoncz);
    global.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { ev.preventDefault(); zamknij(); }
    });
  }

  // --- rysowanie ------------------------------------------------------------------------
  /* PASEK STOI NA DOLE EKRANU GŁÓWNEGO, nie na dole „ekranu" (16.09).

     Przy ustawianiu na wielu ekranach menu stoi na dole ekranu głównego. Okno nakładki rozciąga się na CAŁY pulpit, więc arkuszowe `left:50%; bottom:18px`
     celowało w środek dolnej krawędzi PULPITU — przy dwóch monitorach wypada to na styku ekranów
     (a gdy stoją na różnych wysokościach, bywa że w miejscu, którego nie widać żaden z nich).
     Liczymy więc prostokąt ekranu głównego i stawiamy pasek nad jego dolną krawędzią. */
  function ekranGlowny() {
    const e = ekrany();
    const p = (e && e.desktop) ? e.desktop : null;
    const lista = (e && Array.isArray(e.screens)) ? e.screens : [];
    if (!p || !lista.length) return null;
    // ⚠️ OKNO NA JEDNYM Z KILKU MONITORÓW (2026-09-26) stoi na SWOIM ekranie (`e.okno`), a nie
    // na głównym — ekran główny leży wtedy poza oknem i pasek wylądowałby poza ekranem.
    const s = (e.okno && lista.filter(function (x) { return x && x.name === e.okno; })[0])
      || lista.filter(function (x) { return x && x.primary; })[0] || lista[0];
    const c = cel();
    // Przejście pulpit → widok przez UŁAMKI, nigdy przez piksele: okno ma inną skalę niż pulpit
    // przy dowolnym powiększeniu Windows (ta sama zasada, co w `RFScan.obszarEkranu`).
    return { x: c.x + ((s.x - p.x) / Math.max(1, p.w)) * c.w,
             y: c.y + ((s.y - p.y) / Math.max(1, p.h)) * c.h,
             w: (s.w / Math.max(1, p.w)) * c.w, h: (s.h / Math.max(1, p.h)) * c.h };
  }

  function ustawPasek() {
    const pasek = document.getElementById("edPasek");
    const g = ekranGlowny();
    if (!pasek || !g) return;      // bez wiedzy o monitorach zostaje pozycja z arkusza
    const c = cel();
    pasek.style.left = Math.round(g.x + g.w / 2) + "px";
    pasek.style.bottom = Math.round(Math.max(0, (c.y + c.h) - (g.y + g.h)) + 18) + "px";
    pasek.style.maxWidth = Math.round(g.w - 40) + "px";
  }

  function zRysuj() {
    const r = document.getElementById("edRamka");
    if (!r || !prost) return;
    r.style.left = Math.round(prost.x) + "px";
    r.style.top = Math.round(prost.y) + "px";
    r.style.width = Math.round(prost.w) + "px";
    r.style.height = Math.round(prost.h) + "px";
    const wym = document.getElementById("edWymiar");
    // Wymiar mówimy w PIKSELACH EKRANU, nie widoku: tak samo liczy je karta i tak samo widzi
    // je człowiek, który zna rozdzielczość swojej gry.
    const b = baza(), c = cel();
    const sx = b ? (b.pulpit.w / Math.max(1, c.w)) : 1;
    const sy = b ? (b.pulpit.h / Math.max(1, c.h)) : 1;
    // Przy kilku skanerach chip mówi TAKŻE, który to jest: na ekranie stoi wtedy kilka
    // prostokątów i sam wymiar nie odpowiada na pytanie „który teraz ciągnę".
    const lista = (cfg && Array.isArray(cfg.sekcje)) ? cfg.sekcje : [];
    const akt = Math.max(1, Math.min((cfg && +cfg.sekcjaAktywna) || 1, Math.max(1, lista.length)));
    const podpis = (lista.length > 1)
      ? (akt + " · " + ((lista[akt - 1] && lista[akt - 1].nazwa) || ("Sekcja " + akt)) + " — ") : "";
    if (wym) wym.textContent = podpis + Math.round(prost.w * sx) + " × " + Math.round(prost.h * sy) + " px";
  }

  /* CZY OKNO POKRYWA EKRAN 1:1 — i powiedzenie tego wprost, gdy nie pokrywa.
     Skaner rysuje w pikselach pulpitu, a okno ma swoje piksele CSS; zwykle to jedno i to samo
     (kiosk przy jednym monitorze). Przy dwóch monitorach, przy powiększeniu strony w profilu
     nakładki albo zanim okno dojdzie na miejsce — nie jest, i wtedy scena jest skalowana
     (rf-50h `doskalujScene`). Chip mówi o tym jednym napisem, bo inaczej jedyną drogą do tej
     wiedzy jest linijka przyłożona do ekranu. */
  function pokazSkale() {
    const e = document.getElementById("edSkala");
    if (!e) return;
    const s = (typeof N().skala === "function") ? N().skala() : { sx: 1, sy: 1 };
    const rowne = Math.abs(s.sx - 1) < 0.01 && Math.abs(s.sy - 1) < 0.01;
    e.hidden = rowne;
    if (rowne) { e.textContent = ""; return; }
    const proc = function (v) { return Math.round(v * 100) + "%"; };
    e.textContent = "⤢ widok " + proc(s.sx) + (Math.abs(s.sx - s.sy) < 0.01 ? "" : " × " + proc(s.sy));
    e.title = "Okno nie pokrywa ekranu jeden do jednego, więc skaner rysuje w tej skali. "
      + "Kliknięcia i tak padają tam, gdzie trzeba — liczą się procentami ekranu, nie pikselami okna.";
  }

  function zKonfiguracji() {
    const c = cel();
    let r = null;
    try {
      r = RFScan.obszarEkranu(RFScan.zMonitorem(cfg || {}, RFScan.ekranyPelne(ekrany()), cfg), c, ekrany());
    } catch (e) { r = null; }
    prost = r ? { x: r.x - c.x, y: r.y - c.y, w: r.w, h: r.h }
      : { x: c.w * 0.2, y: c.h * 0.2, w: c.w * 0.6, h: c.h * 0.6 };
    zRysuj();
    rysujCienie();
    ustawPasek();
    pokazSkale();
  }

  /* OBSZARY POZOSTAŁYCH SKANERÓW NA PULPICIE — każdy w swoim kolorze i z nazwą.
     Ta sama zasada, co w podglądzie karty (rf-50k): ustawiany obszar ma pełną ramkę z uchwytami,
     reszta idzie cieńszą kreską, żeby było widać, czy skanery się nie nachodzą i który kawałek
     ekranu jest jeszcze wolny. Podpis ma ciemne tło i pełny kolor w kresce z lewej — nad pulpitem
     nie wolno użyć rozmytej poświaty, bo Windows wycina z tego okna JEDEN kolor i rozmycie
     zostaje na ekranie brudną plamą (patrz nota przy `#hud` w skaner-nakladka.html). */
  function rysujCienie() {
    const w = document.getElementById("edCienie");
    if (!w) return;
    const lista = (cfg && Array.isArray(cfg.sekcje)) ? cfg.sekcje : [];
    const akt = Math.max(1, Math.min((cfg && +cfg.sekcjaAktywna) || 1, Math.max(1, lista.length)));
    const c = cel();
    const rysy = [];
    // GRUPA ZAWEZA, CO WIDAC (16.09): gdy wybrany jest ekran albo grupa, obrysy skanerow spoza
    // niej sa rysunkiem nie na temat — naleza do innego widoku tej samej aplikacji.
    const zrzuty = (cfg && Array.isArray(cfg.zrzuty)) ? cfg.zrzuty : [];
    const az = (cfg && parseInt(cfg.zrzutAktywny, 10)) || 0;
    const grupa = (az >= 1 && az <= zrzuty.length) ? (zrzuty[az - 1].sekcje || null) : null;
    if (pokazujInne && lista.length > 1) {
      lista.forEach(function (s, i) {
        if (!s || i + 1 === akt) return;
        if (grupa && grupa.indexOf(i + 1) < 0) return;
        let r = null;
        try {
          r = RFScan.obszarEkranu(RFScan.zMonitorem(s, RFScan.ekranyPelne(ekrany()), cfg), c, ekrany());
        } catch (e) { return; }
        if (!r || !(r.w > 0 && r.h > 0)) return;
        rysy.push({ n: i + 1, nazwa: (s.nazwa || ("Sekcja " + (i + 1))),
                    x: Math.round(r.x - c.x), y: Math.round(r.y - c.y),
                    w: Math.round(r.w), h: Math.round(r.h) });
      });
    }
    // Prostokąty zapamiętujemy ZAWSZE, nawet gdy rysunek się nie zmienił: to po nich trafia mysz
    // (patrz `zacznij`), a warstwa ma `pointer-events:none`, więc DOM tego nie załatwi.
    cienie = rysy;
    const odcisk = JSON.stringify(rysy);
    if (w._odcisk === odcisk) return;
    w._odcisk = odcisk;
    w.innerHTML = "";
    rysy.forEach(function (o) {
      const d = document.createElement("div");
      d.className = "sk-ed-cien";
      d.style.setProperty("--sek", RFScan.kolorSekcji(o.n));
      d.style.left = o.x + "px"; d.style.top = o.y + "px";
      d.style.width = o.w + "px"; d.style.height = o.h + "px";
      const l = document.createElement("span");
      l.className = "sk-ed-cien-lbl";
      l.textContent = o.n + " · " + o.nazwa;
      /* PODPIS CUDZEJ RAMKI PRZEŁĄCZA NA NIĄ. Wprost z tego samego zgłoszenia: „nie przeciąga
         tego, które chcę przeciągnąć" — ustawiać można tylko JEDEN skaner naraz, więc żeby ruszyć
         inny, trzeba się na niego przełączyć. Klikalny jest sam podpis, a nie cały prostokąt:
         ciągnięcie po pustym miejscu ma dalej rysować nową ramkę (to najkrótsza droga do „chcę
         tamten kawałek ekranu"), a podpis to cel mały i wybierany świadomie.
         ⚠️ `mousedown` musi się zatrzymać na podpisie, inaczej `zacznij` z warstwy edytora zdąży
         zacząć rysowanie, zanim dojdzie `click`. */
      l.title = "Przełącz na ten skaner, żeby ustawić jego obszar";
      l.addEventListener("mousedown", function (ev) { ev.stopPropagation(); });
      l.addEventListener("click", function (ev) {
        ev.stopPropagation();
        sekcja({ act: "wybierz", n: o.n });
      });
      d.appendChild(l);
      w.appendChild(d);
    });
  }

  function odswiezPasek() {
    const lista = (cfg && Array.isArray(cfg.sekcje)) ? cfg.sekcje : [];
    const akt = Math.max(1, Math.min((cfg && +cfg.sekcjaAktywna) || 1, Math.max(1, lista.length)));
    const sel = document.getElementById("edSekcja");
    if (sel) {
      const odcisk = JSON.stringify([lista.map(function (s) { return s && s.nazwa; }), akt]);
      if (sel._odcisk !== odcisk) {
        sel._odcisk = odcisk;
        sel.innerHTML = "";
        /* KROPKA W KOLORZE PRZY KAŻDEJ POZYCJI (16.09): kolor skanera widać już w liście
           rozwijanej jako kropkę po lewej stronie pozycji. W liście rozwijanej nie da się wstawić elementu, więc kropką jest znak
           „●", a kolor idzie przez `style.color` samej pozycji (Chromium na Windowsie to honoruje;
           gdyby kiedyś przestał, zostaje czarna kropka i kolejność, czyli stan sprzed zmiany). */
        lista.forEach(function (s, i) {
          const o = document.createElement("option");
          o.value = String(i + 1);
          o.textContent = "● " + (i + 1) + ". " + ((s && s.nazwa) || ("Sekcja " + (i + 1)));
          o.style.color = RFScan.kolorSekcji(i + 1);
          sel.appendChild(o);
        });
        sel.value = String(akt);
      }
    }
    const nz = document.getElementById("edNazwa");
    const nazwa = (lista[akt - 1] && lista[akt - 1].nazwa) || "";
    if (nz && document.activeElement !== nz && nz.value !== nazwa) nz.value = nazwa;
    // Ósma sekcja to sufit serwera (`ScanModule.SEKCJI_MAX`) — przycisk gaśnie, zamiast
    // odpowiadać błędem po kliknięciu.
    const plus = document.getElementById("edDodaj");
    if (plus) plus.disabled = lista.length >= 8;
    // KOLOR USTAWIANEGO SKANERA — ramka, kropka przy liście i uchwyty. Przy jednym skanerze to
    // pierwszy kolor palety, czyli ten sam róż, co zawsze: nic się wtedy nie zmienia.
    const kol = RFScan.kolorSekcji(akt);
    const ed = document.getElementById("edytor");
    if (ed) ed.style.setProperty("--sek", kol);
    const kropka = document.getElementById("edKropka");
    if (kropka) kropka.style.display = lista.length > 1 ? "" : "none";
    // Wybór „wszystkie / tylko ustawiany" ma sens dopiero od dwóch skanerów.
    // EKRANY I GRUPY. „— bez grupy —" jest pierwsze i znaczy „wszystkie skanery naraz": tak
    // wygląda konfiguracja, w której nikt grup nie założył, i tak ma wyglądać po ich zdjęciu.
    const zl = document.getElementById("edZrzut");
    if (zl) {
      const zrzuty = (cfg && Array.isArray(cfg.zrzuty)) ? cfg.zrzuty : [];
      const az = (cfg && parseInt(cfg.zrzutAktywny, 10)) || 0;
      const odc = JSON.stringify([zrzuty.map(function (z) { return [z.nazwa, z.plik, z.sekcje]; }), az]);
      if (zl._odcisk !== odc) {
        zl._odcisk = odc;
        zl.innerHTML = "";
        const pusty = document.createElement("option");
        pusty.value = "0";
        pusty.textContent = "— bez grupy —";
        zl.appendChild(pusty);
        zrzuty.forEach(function (z, i) {
          const o = document.createElement("option");
          o.value = String(i + 1);
          // Plansza ma zrzut, grupa go nie ma — jeden znak mówi, z czym się ma do czynienia.
          o.textContent = (z.plik ? "🖼 " : "▦ ") + (z.nazwa || ((z.plik ? "Plansza " : "Grupa ") + (i + 1)))
            + " (" + ((z.sekcje || []).length) + ")";
          zl.appendChild(o);
        });
        zl.value = String(az);
      }
      zl.style.display = zrzuty.length ? "" : "none";
    }
    const pod = document.getElementById("edPodglad");
    if (pod) {
      pod.value = pokazujInne ? "wszystkie" : "ten";
      pod.disabled = lista.length <= 1;
      pod.style.display = lista.length > 1 ? "" : "none";
    }
    rysujCienie();
    ustawPasek();
    pokazSkale();
  }

  // --- rozmowa z serwerem ---------------------------------------------------------------
  function pobierz() {
    return fetch("/scan?dev=" + encodeURIComponent(DEV)).then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j) return null;
        cfg = j;
        odswiezPasek();
        zKonfiguracji();
        return j;
      }).catch(function () { return null; });
  }

  /* ZAPIS OBSZARU. Bierzemy konfigurację ŚWIEŻĄ z serwera (patrz nagłówek pliku), podmieniamy
     w niej cztery liczby i odsyłamy całość — `/scan` nadpisuje sekcję tym, co dostanie. */
  function zapisz() {
    const b = baza(), c = cel();
    if (!b || !prost) return;
    const uX = function (px) { return b.pulpit.x + ((px) / Math.max(1, c.w)) * b.pulpit.w; };
    const uY = function (px) { return b.pulpit.y + ((px) / Math.max(1, c.h)) * b.pulpit.h; };
    const fx1 = Math.max(0, Math.min(1, (uX(prost.x) - b.x) / Math.max(1, b.w)));
    const fx2 = Math.max(0, Math.min(1, (uX(prost.x + prost.w) - b.x) / Math.max(1, b.w)));
    const fy1 = Math.max(0, Math.min(1, (uY(prost.y) - b.y) / Math.max(1, b.h)));
    const fy2 = Math.max(0, Math.min(1, (uY(prost.y + prost.h) - b.y) / Math.max(1, b.h)));
    if (fx2 - fx1 < 0.01 || fy2 - fy1 < 0.01) {
      stan("Za mała ramka — przeciągnij szerzej.", "zle");
      return;
    }
    stan("zapisuję…");
    fetch("/scan?dev=" + encodeURIComponent(DEV)).then(function (r) { return r.json(); })
      .then(function (swieza) {
        const doWyslania = Object.assign({}, swieza || cfg || {});
        // Jednostki NIE PRZESTAWIAMY: kto pracuje w pikselach gry, ma dostać piksele (ta sama
        // zasada, co przy gumce po zrzucie ekranu w rf-50l).
        const piksele = (doWyslania.obszarJednostka === "piksele");
        const licz = function (f, dl) { return piksele ? Math.round(f * dl) : Math.round(f * 1000) / 10; };
        doWyslania.obszar = "wlasny";
        // RAMKA NARYSOWANA NA INNYM EKRANIE NIŻ TEN, NA KTÓRYM SKANER DOTĄD PRACOWAŁ, przenosi go
        // tutaj (2026-09-26): wpisujemy ekran wprost. Gdy skaner i tak jest na tym ekranie, wybór
        // „sam wybierz" zostaje nietknięty — nie przypinamy niczego bez potrzeby.
        if (b.ekran) {
          const tam = RFScan.ekranSkanera(doWyslania, RFScan.ekranyPelne(ekrany()));
          if (!tam || tam.name !== b.ekran) doWyslania.obszarMonitor = b.ekran;
        }
        doWyslania.obszarX1 = licz(fx1, b.w);
        doWyslania.obszarX2 = licz(fx2, b.w);
        doWyslania.obszarY1 = licz(fy1, b.h);
        doWyslania.obszarY2 = licz(fy2, b.h);
        return fetch("/scan?dev=" + encodeURIComponent(DEV), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(doWyslania)
        }).then(function (r) { return r.json(); });
      }).then(function (j) {
        if (!j) { stan("Nie udało się zapisać.", "zle"); return; }
        cfg = j;
        odswiezPasek();
        stan("zapisano ✓", "ok");
      }).catch(function () { stan("Nie udało się zapisać.", "zle"); });
  }

  function sekcja(body) {
    return fetch("/scan/sekcja?dev=" + encodeURIComponent(DEV), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) { stan((j && j.error) || "Nie udało się.", "zle"); return null; }
      cfg = j;
      odswiezPasek();
      // ⚠️ W ŚRODKU PRZECIĄGANIA RAMKI NIE RUSZAMY. Od 16.09 chwycenie CUDZEGO obrysu przełącza
      // na tamten skaner i od razu go ciągnie — odpowiedź serwera przychodzi w trakcie gestu,
      // a `zKonfiguracji` cofnęłaby ramkę do zapisanych liczb w połowie ruchu myszą.
      if (!ciag) zKonfiguracji();
      return j;
    }).catch(function () { stan("Nie udało się.", "zle"); return null; });
  }

  /* EKRANY I GRUPY — to samo wejście, co w karcie (`/scan/zrzut`). Nad pulpitem żadna grafika się
     nie wyświetla (jest prawdziwy ekran), więc wybór ekranu znaczy tutaj: KTÓRE skanery należą do
     tego widoku — czyli które obrysy widać i po których chodzi „następny skaner w grupie". */
  function zrzut(body) {
    return fetch("/scan/zrzut?dev=" + encodeURIComponent(DEV), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) { stan((j && j.error) || "Nie udało się.", "zle"); return null; }
      cfg = j;
      odswiezPasek();
      if (!ciag) zKonfiguracji();
      return j;
    }).catch(function () { stan("Nie udało się.", "zle"); return null; });
  }

  /* Zdjęcie ekranu, nad którym stoi to okno → nowa plansza (trasa `/scan/zrzut-ekranu`). Przy
     jednym monitorze nazwy ekranu nie ma, więc fotografujemy ten z kursorem — czyli ten jedyny. */
  let robiZrzut = false;
  function zrzutEkranu() {
    if (robiZrzut) return;
    robiZrzut = true;
    stan("robię zdjęcie ekranu…");
    fetch("/scan/zrzut-ekranu?dev=" + encodeURIComponent(DEV), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monitor: EKRAN || "kursor", zrodlo: "nakladka" })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) { stan("Nie udało się: " + ((j && j.error) || "zrzut się nie udał"), "zle"); return; }
      stan("plansza " + j.n + " ze zrzutu" + (j.w && j.h ? " (" + j.w + "×" + j.h + ")" : "") + " ✓", "ok");
      pobierz();
    }).catch(function () { stan("Nie udało się zrobić zrzutu.", "zle"); })
      .then(function () { robiZrzut = false; });
  }

  function dodajSekcje() {
    sekcja({ act: "dodaj", nazwa: "" }).then(function (j) {
      if (!j) return;
      stan("nowa sekcja — ustaw jej ramkę", "ok");
      const nz = document.getElementById("edNazwa");
      if (nz) { nz.focus(); nz.select(); }      // nazwa od razu do wpisania
    });
  }

  function zamknij() {
    fetch("/scan/okno", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ open: false, dev: DEV })
    }).catch(function () { });
  }

  /* SCHOWANIE EDYTORA — ale nie okna (16.09).

     Ramka na dole jest cały czas włączona; oczko „ukryj” chowa ją, ale samo zostaje widoczne,
     żeby dało się ją znów pokazać. Edytor jest
     teraz WŁĄCZONY PRZEZ CAŁY CZAS, gdy skaner stoi na pulpicie — a to znaczy, że okno przez cały
     ten czas zbierałoby wszystkie kliknięcia z ekranu. Oczko jest wyjściem z tego: obrys obszaru
     zostaje (po to się tu przyszło), znikają uchwyty i pasek, a serwer dostaje PROSTOKĄT OCZKA
     i przez resztę ekranu przepuszcza mysz do pulpitu.

     ⚠️ Prostokąt liczymy z TEGO SAMEGO elementu, który zostaje na ekranie (`#edPasek` zwinięty do
     oczka) i tą samą arytmetyką, co zapis obszaru — inaczej klikalne byłoby gdzie indziej, niż
     widać, a takiej pomyłki nie widać na oczy: po prostu „oczko nie działa". */
  function okoProstokat() {
    const p = document.getElementById("edPasek");
    const b = baza();
    if (!p || !b) return null;
    const r = p.getBoundingClientRect();
    const c = cel();
    const sx = b.pulpit.w / Math.max(1, c.w), sy = b.pulpit.h / Math.max(1, c.h);
    const LUZ = 8;      // zapas na zaokrąglenia widoku (patrz `_ustaw_okno` w monitorze)
    return {
      x: Math.round(b.pulpit.x + r.left * sx) - LUZ, y: Math.round(b.pulpit.y + r.top * sy) - LUZ,
      w: Math.round(r.width * sx) + 2 * LUZ, h: Math.round(r.height * sy) + 2 * LUZ
    };
  }

  function ukryj(on) {
    ukryty = !!on;
    document.body.classList.toggle("sk-ed-ukryty", ukryty);
    const o = document.getElementById("edOko");
    if (o) {
      o.textContent = ukryty ? "👁" : "🙈";
      o.title = ukryty
        ? "Wróć do ustawiania obszaru — uchwyty i pasek wracają, a okno znów zbiera kliknięcia."
        : "Schowaj uchwyty i pasek — obrys obszaru zostaje, a kliknięcia znów trafiają do pulpitu."
          + " Oczko zostaje na wierzchu i tym samym oczkiem wracasz do ustawiania.";
    }
    // Zgłoszenie do serwera PO przerysowaniu: zwinięty pasek ma inny prostokąt niż rozwinięty,
    // a mierzymy ten, który człowiek widzi.
    requestAnimationFrame(function () {
      fetch("/scan/okno", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dev: DEV, ekran: EKRAN, klik: ukryty ? okoProstokat() : null })
      }).catch(function () { });
    });
  }

  // --- mysz -----------------------------------------------------------------------------
  function zacznij(ev) {
    if (ev.button !== 0) return;
    // Schowany edytor niczego nie ciągnie. Do okna i tak dochodzi wtedy tylko oczko (serwer
    // przepuszcza resztę ekranu), ale ta bramka musi być też tutaj: gdy człowiek chybi oczka
    // o piksel, ma trafić w pulpit, a nie narysować sobie nową ramkę.
    if (ukryty) return;
    const c = cel();
    const uchwyt = ev.target && ev.target.getAttribute ? ev.target.getAttribute("data-u") : null;
    /* ⚠️ CAŁA RAMKA CIĄGNIE, RAZEM Z PODPISEM WYMIARU (16.09).

       Błąd: próba przeciągnięcia ramki zaczynała rysować nową, zamiast przesuwać tę chwyconą.
       Stało tu `ev.target.id ===
       "edRamka"`, więc przeciąganie łapało WYŁĄCZNIE sam prostokąt — a chip z wymiarem
       (`#edWymiar`) jest jego dzieckiem i leży dokładnie nad górną krawędzią, czyli tam, gdzie
       człowiek naturalnie łapie okno. Do 16.09 chip mówił samo „800 × 600 px" i był wąski; odkąd
       niesie też numer i nazwę skanera („3 · Panel opcji — …"), stał się najszerszym elementem
       ramki i trafiało się w niego raz po raz. Kursor pokazywał przy tym ✥ (bo `cursor:move`
       dziedziczy się z ramki), więc wyglądało to na zepsute przeciąganie, a było kliknięciem
       w pustkę — czyli rysowaniem nowego prostokąta. `closest` zamiast `id ===` załatwia to
       raz na zawsze: uchwyty sprawdzamy wcześniej, więc skalowanie dalej ma pierwszeństwo. */
    const wRamce = !!(ev.target && ev.target.closest && ev.target.closest("#edRamka"));
    ev.preventDefault();
    if (uchwyt) ciag = { co: "skala", u: uchwyt, start: Object.assign({}, prost), mx: ev.clientX, my: ev.clientY };
    else if (wRamce) ciag = { co: "przesun", start: Object.assign({}, prost), mx: ev.clientX, my: ev.clientY };
    else if (trafionyCien(ev.clientX - c.x, ev.clientY - c.y)) {
      /* CUDZĄ RAMKĘ TEŻ DA SIĘ PRZECIĄGNĄĆ (16.09). Cudzy obrys też
         przesuwa się przeciąganiem. Ustawiać można JEDEN skaner naraz, więc chwycenie cudzego
         obrysu robi dwie rzeczy w jednym geście: przełącza na tamten skaner i od razu go ciągnie.

         ⚠️ Przełączenie jest ROZMOWĄ Z SERWEREM, a gest dzieje się teraz — więc ramka przeskakuje
         na chwycony prostokąt od razu, a odpowiedź dochodzi w tle (`sekcja()` nie rusza ramki,
         gdy trwa przeciąganie). Zapis czeka na tę odpowiedź: bez tego trafiłby w PRZEDNI skaner,
         czyli przesunąłby nie ten prostokąt, który człowiek trzyma w ręku. */
      const cien = trafionyCien(ev.clientX - c.x, ev.clientY - c.y);
      prost = { x: cien.x, y: cien.y, w: cien.w, h: cien.h };
      zRysuj();
      ciag = { co: "przesun", start: Object.assign({}, prost), mx: ev.clientX, my: ev.clientY,
               czeka: sekcja({ act: "wybierz", n: cien.n }) };
      stan("przełączono na skaner " + cien.n, "ok");
    } else {
      // Puste miejsce = rysujemy od nowa. Najszybsza droga do „chcę tamten kawałek ekranu".
      ciag = { co: "rysuj", x0: ev.clientX - c.x, y0: ev.clientY - c.y };
      prost = { x: ciag.x0, y: ciag.y0, w: MIN, h: MIN };
      zRysuj();
    }
    document.body.classList.add("sk-ed-ciagnie");
  }

  /* Który cudzy obrys leży pod tym punktem (współrzędne WIDOKU). Od końca listy, bo ostatni
     narysowany leży na wierzchu — tak samo działa hit-test przeglądarki. */
  function trafionyCien(x, y) {
    for (let i = cienie.length - 1; i >= 0; i--) {
      const o = cienie[i];
      if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return o;
    }
    return null;
  }

  function rusz(ev) {
    if (!ciag) return;
    const c = cel();
    const maxW = c.w, maxH = c.h;
    if (ciag.co === "rysuj") {
      const x1 = Math.max(0, Math.min(maxW, ev.clientX - c.x));
      const y1 = Math.max(0, Math.min(maxH, ev.clientY - c.y));
      prost = { x: Math.min(ciag.x0, x1), y: Math.min(ciag.y0, y1),
                w: Math.max(MIN, Math.abs(x1 - ciag.x0)), h: Math.max(MIN, Math.abs(y1 - ciag.y0)) };
    } else if (ciag.co === "przesun") {
      const dx = ev.clientX - ciag.mx, dy = ev.clientY - ciag.my;
      prost = { x: Math.max(0, Math.min(maxW - ciag.start.w, ciag.start.x + dx)),
                y: Math.max(0, Math.min(maxH - ciag.start.h, ciag.start.y + dy)),
                w: ciag.start.w, h: ciag.start.h };
    } else {
      const dx = ev.clientX - ciag.mx, dy = ev.clientY - ciag.my;
      const s = ciag.start, u = ciag.u;
      let x = s.x, y = s.y, w = s.w, h = s.h;
      if (u.indexOf("w") >= 0) { x = s.x + dx; w = s.w - dx; }
      if (u.indexOf("e") >= 0) { w = s.w + dx; }
      if (u.indexOf("n") >= 0) { y = s.y + dy; h = s.h - dy; }
      if (u.indexOf("s") >= 0) { h = s.h + dy; }
      // Ramka nie schodzi poniżej minimum i nie wychodzi za ekran — inaczej serwer i tak by ją
      // przyciął, a człowiek zobaczyłby co innego niż ustawił.
      if (w < MIN) { if (u.indexOf("w") >= 0) x = s.x + s.w - MIN; w = MIN; }
      if (h < MIN) { if (u.indexOf("n") >= 0) y = s.y + s.h - MIN; h = MIN; }
      if (x < 0) { w += x; x = 0; }
      if (y < 0) { h += y; y = 0; }
      if (x + w > maxW) w = maxW - x;
      if (y + h > maxH) h = maxH - y;
      prost = { x: x, y: y, w: Math.max(MIN, w), h: Math.max(MIN, h) };
    }
    zRysuj();
  }

  function skoncz() {
    if (!ciag) return;
    const czeka = ciag.czeka;
    ciag = null;
    document.body.classList.remove("sk-ed-ciagnie");
    // ⚠️ ZAPIS CZEKA NA PRZEŁĄCZENIE. Przy chwyceniu cudzej ramki przełączenie leci w tle; zapis
    // wysłany przed jego końcem wpisałby nowy prostokąt w POPRZEDNI skaner — czyli przesunąłby
    // nie ten obszar, który człowiek trzymał w ręku, i to po cichu.
    if (czeka && typeof czeka.then === "function") czeka.then(function () { zapisz(); });
    else zapisz();                  // zapis po puszczeniu myszy — tak samo, jak karta zapisuje pokrętła
  }

  /* Konfiguracja zmieniła się gdzie indziej (karta, przełączenie sekcji wyzwalaczem). rf-50h
     dostaje to strumieniem i woła nas — ramka ma pokazywać prawdę, a nie ostatnie przeciągnięcie. */
  global.RFScanEdycja = {
    poZmianie: function () { if (!ciag) pobierz(); },
    /* Skala okna się zmieniła (rf-50h zauważył to w klatce) — ramka musi przeskoczyć na nowe
       miejsce OD RAZU, a nie przy najbliższym ruchu myszą. W trakcie ciągnięcia nie ruszamy:
       człowiek trzyma prostokąt w ręku i to jego pozycja jest prawdą. */
    poSkali: function () { pokazSkale(); if (!ciag) zKonfiguracji(); },
    prostokat: function () { return prost ? Object.assign({}, prost) : null; },
    zapisz: zapisz,
    ukryj: ukryj,
    ukryte: function () { return ukryty; },
    okoProstokat: okoProstokat,
    ekranGlowny: ekranGlowny,
    // Dla harnessu i konsoli: przestawienie podglądu bez klikania w listę.
    podglad: function (wszystkie) {
      if (wszystkie === undefined) return pokazujInne;
      pokazujInne = !!wszystkie;
      const pod = document.getElementById("edPodglad");
      if (pod) pod.value = pokazujInne ? "wszystkie" : "ten";
      rysujCienie();
      return pokazujInne;
    }
  };

  buduj();
  pobierz();
  /* ⚠️ UKŁAD MONITORÓW PRZYCHODZI PÓŹNIEJ. `pobierz()` wraca zwykle szybciej niż `/screens`
     (ładuje je rf-50h), a bez nich nie wiadomo, gdzie kończy się ekran główny — pasek zostaje
     wtedy na pozycji z arkusza, czyli na styku monitorów. Jedno spóźnione ustawienie załatwia
     sprawę; kolejne przychodzą same z każdym odświeżeniem konfiguracji. */
  setTimeout(ustawPasek, 1200);
})(window);
