"use strict";
/* SKANER EKRANU — karta modułu: to, co widać w zakładce „Skaner".

   CZYM JEST TEN MODUŁ. Sposób obsługi komputera JEDNYM sygnałem. Pasek jedzie sam przez ekran,
   człowiek go zatrzymuje, potem drugi pasek w drugą stronę — przecięcie jest punktem, w który
   pada kliknięcie. Czas zastępuje przestrzeń, więc wystarcza przycisk kapsla albo jego przechył.
   Tak działa Switch Control w Apple i Switch Access w Androidzie; to technika ze sprzętu
   wspomagającego, nie nasz wynalazek.

   DLACZEGO OSOBNY MODUŁ, A NIE TRYB MYSZY. Mysz odpowiada na pytanie „jak przesuwać kursor"
   (filtr 3D, położenie, drążek, touchpad). Skaner odpowiada na „jak WYBRAĆ, skoro nie mogę
   celować". To nie jest piąty tryb ruchu: ma własny plan przebiegów, własne menu akcji, własny
   trening i własne okno nad pulpitem. Z Myszą dzieli WYJŚCIE — klik idzie tą samą drogą, co
   „Klik w punkcie ekranu" w Mapowaniu (`mouse:left@x%,y%`).

   DWA ŚWIATY TEJ KARTY:
     • PIASKOWNICA (domyślnie) — udawany pulpit w ramce podglądu. Nic nie opuszcza przeglądarki,
       więc parametry dobiera się bez ryzyka. To tu mieszka trening i kalibracja.
     • NAD PULPITEM — osobne okno bez ramki, na wierzchu, przepuszczające kliknięcia. Dopiero
       tam skaner klika naprawdę.
   Piaskownica zostaje na stałe, także gdy skaner już działa naprawdę: strojenie na żywym
   systemie, gdy pasek sam klika, jest złym pomysłem dla wszystkich. */

// Klucze, które opisują WYGLĄD I DŹWIĘK, a nie samo skanowanie. Serwer trzyma jedną płaską
// konfigurację (ScanModule.DEFAULTS), a panel pól — dwie, bo inaczej rysuje te sekcje. Podział
// i scalenie siedzą w jednym miejscu, żeby nie rozjechały się przy dokładaniu pokrętła.
const SCAN_WYGLAD_KLUCZE = ["kolorY", "kolorX", "kolorDokladny", "kryciePasma",
  "pokrycieY", "pokrycieX",
  "przyciemnienie", "podgladObszaru", "grubosc", "poswiata", "etykietaPrzyPasku",
  "dzwiek", "glosnosc", "tonPozycji"];

const _SCAN = {
  dev: null, u: null, w: null, enabled: false,
  silnik: null, scena: null, pola: null, hud: null, piaskownica: null, trening: null,
  dziennik: null, raport: null, widok: "piaskownica", zapisTimer: null,
  petla: 0, gotowe: false, wcisniety: {}
};

function _scanRozdziel(cfg) {
  const u = {}, w = {};
  Object.keys(cfg || {}).forEach(function (k) {
    if (SCAN_WYGLAD_KLUCZE.indexOf(k) >= 0) w[k] = cfg[k]; else u[k] = cfg[k];
  });
  return { u: Object.assign({}, RFScan.DOMYSLNE, u), w: Object.assign({}, RFScan.WYGLAD_DOM, w) };
}
function _scanScal() {
  const out = Object.assign({}, _SCAN.u);
  SCAN_WYGLAD_KLUCZE.forEach(function (k) { out[k] = _SCAN.w[k]; });
  out.enabled = !!_SCAN.enabled;
  return out;
}

// ------------------------------------------------------------------------------------------
//  MARKUP KARTY
// ------------------------------------------------------------------------------------------
function scanCardHtml() {
  return `<div class="card sk-card" id="scanCard">
    <div class="head"><h2><span class="rfic hd-ic hd-ic-celownik" aria-hidden="true"></span>Skaner ekranu</h2>
      <span class="hint">Jeden sygnał zamiast myszy: pasek jedzie, Ty go zatrzymujesz.</span>
      <div class="rf-toggle" id="scanEnable" role="switch" aria-checked="false" tabindex="0"
        title="Włącz albo wyłącz moduł Skaner. To ten włącznik decyduje, czy sygnał „scan:” z Mapowania w ogóle dochodzi."><span class="rf-tg-lbl off">Wył.</span><span class="rf-tg-knob"></span><span class="rf-tg-lbl on">Wł.</span></div></div>

    <!-- Paska „Konfiguracja skanera: Triki 1” nie ma od UX 261120 (M06): chip kapsla w nagłówku
         modułu mówi to samo, a pasek był trzecim pasem nad podglądem. -->

    <div class="sk-body">
      <div class="sk-lewa">
        <div class="sk-stage" id="scanStage">
          <!-- ZRZUT EKRANU GRY pod piaskownicą (rf-50l). Pusty, dopóki człowiek czegoś nie wgra;
               wtedy zakrywa udawany pulpit i to na nim wyznacza się obszar skanowania. -->
          <div class="sk-tlo" id="scanTlo" aria-hidden="true"></div>
          <div class="sk-sandbox" id="scanSandbox"></div>
        </div>
        <!-- PASEK STANU STOI POD RAMKĄ, NIE W NIEJ (16.09). Wcześniej dwie ramki
             zasłaniały podgląd. Pasek wisiał przy górnej
             krawędzi podglądu, a zdanie „Naciśnij SYGNAŁ…" przy dolnej — razem zjadały pas obrazu
             u góry i u dołu dokładnie wtedy, gdy na wgranym zrzucie gry wyznacza się obszar.
             Podgląd jest tu do PATRZENIA, więc nic go nie przykrywa: pasek zszedł pod ramkę jako
             jej podpis, a zdanie o starcie mówi teraz ten sam pasek w spoczynku (jedna wiadomość
             zamiast dwóch). Nad pulpitem zostaje bez zmian — tam pasek musi leżeć na obrazie, bo
             nie ma pod czym stanąć (skaner-nakladka.html ma własne #hud).
             ⚠️ ŻADNYCH ZNAKÓW WSTECZNYCH W TYM KOMENTARZU — cała karta jest jednym literałem
             szablonowym i taki znak kończy go w środku (patrz ostrzeżenie niżej). -->
        <div class="sk-hud" id="scanHud"></div>
        <!-- PANEL PILOTA — stoi W MIEJSCU ramki podglądu, gdy skaner jest nad pulpitem (15.09).
             Ramka jest wtedy schowana, bo pokazywałaby coś innego niż to, co się dzieje na
             ekranie; tu jest jedno zdanie o tym, co nad pulpitem stoi, i przycisk, którym się to
             gasi. Tego przycisku do 15.09 nie było NIGDZIE — komunikat obiecywał „Esc zamyka",
             a okno nakładki nie bierze skupienia, więc żaden klawisz do niego nie dochodzi. -->
        <div class="sk-pilot" id="scanPilot">
          <div class="sk-pilot-glowa">
            <span class="sk-pilot-kropka" aria-hidden="true"></span>
            <span class="sk-pilot-tytul">Skaner jest na pulpicie</span>
          </div>
          <p class="sk-pilot-stan" id="scanPilotStan" data-noi18n></p>
          <p class="sk-pilot-opis">Podgląd w aplikacji jest wyłączony, żeby dwa skanery nie
            pokazywały dwóch różnych rzeczy naraz. Przyciski niżej sterują oknem nad pulpitem.</p>
          <!-- PRZYCISKU „✥ Ustaw obszar myszą" TU NIE MA OD 16.09. Zamiast niego
               ramka na dole jest cały czas włączona (z oczkiem „ukryj”). Ustawianie obszaru jest teraz częścią
               stania na pulpicie, a nie osobną wyprawą: okno nad pulpitem staje od razu jako
               edytor (rf-50l, funkcja _sktloOtworzNaPulpicie), a chowa się je oczkiem w jego
               pasku. ⚠️ Bez znaków wstecznych — patrz ostrzeżenie wyżej. -->
          <button type="button" class="btn sm" id="scanPilotZamknij">■ Zamknij okno nad pulpitem</button>
        </div>
        <!-- PIĘTRO 1 (UX 261120 L4d): pod podglądem tylko to, czym się skaner prowadzi na co dzień.
             SYGNAŁ jest czarnym filcem (to udawany przycisk kapsla), a jedyną akcją w różu jest
             uruchomienie nad pulpitem. Trening i kalibracja mieszkają w Zaawansowanych. -->
        <div class="sk-bar">
          <button type="button" class="btn sk-sig" id="scanSignal">SYGNAŁ</button>
          <button type="button" class="btn sm" id="scanUndo">↶ Cofnij</button>
          <button type="button" class="btn sm" id="scanStop">■ Stop</button>
          <span class="sk-est" id="scanEstimate"></span>
          <span class="sk-rozpychacz"></span>
          <button type="button" class="btn rf-cta" id="scanLive"
            title="Otwiera okno nad pulpitem. Dopiero tam skaner klika naprawdę.">Uruchom nad pulpitem</button>
        </div>
        <!-- WYBÓR PLANSZY stoi pod SYGNAŁEM, bo nowa gra to nowa plansza. Pierwsza pigułka to pulpit
             testowy (zawsze na miejscu), dalej plansze ze zrzutów i grupy; kropki przy nazwie to
             skanery tej planszy. Dodawanie plansz i edycja wybranej są w Zaawansowanych.
             Ten pasek jest ostatni w lewej kolumnie: sufit ramki (rf-50l) liczy się do jego dołu,
             więc przy pierwszym widoku wybór planszy stoi nad krawędzią okna. -->
        <div class="sk-bar sk-pl-pasek">
          <span class="sk-grupka sk-pl-wybor sk-tylko-symulacja">
            <span class="sk-bar-tytul">Plansza</span>
            <div id="scanZrzuty" class="sk-zrz-pigulki" role="group" aria-label="Plansze tej konfiguracji"></div>
          </span>
          <span class="sk-rozpychacz"></span>
          <button type="button" class="btn sm" id="scanCenter"
            title="Ustaw kapsel tak, jak będzie noszony, i kliknij. Kąty progów liczą się od tego położenia."><span class="bic bic-connect" aria-hidden="true"></span>Wyśrodkuj kapsel</button>
        </div>
      </div>

      <!-- CO JEST GDZIE (układ z 11.09).
           ⚠️ W TYM KOMENTARZU NIE MA ZNAKÓW WSTECZNYCH — cała karta jest jednym literałem
           szablonowym, więc znak wsteczny w komentarzu KOŃCZY go w środku i strona wstaje martwa
           („lewa is not defined", zakładki w ogóle się nie budują). Nazwy klas piszemy prosto.
           LEWA KOLUMNA = SAM PODGLĄD i to, czym się go prowadzi. Nic więcej — bo ta kolumna
           PRZYKLEJA SIĘ do okna (klasa sk-lewa, 26-scan.css) i jedzie z pokrętłami w dół, dokładnie
           jak scena koła wyboru („ekran ma podróżować wraz ze stroną w dół… jest cały czas
           widoczne"). Lepka kolumna wyższa od okna nie ma czego się trzymać, więc wszystko,
           co nie jest podglądem, przeniosło się na prawo. Wyjątek: jeden rząd wyboru planszy (L4d).
           ZESTAWÓW NIE MA TU W OGÓLE — poszły do BIBLIOTEKI modułu („generalnie mamy do tego
           bibliotekę, więc wpakuj te konfiguracje tam właśnie"), gdzie stoją jako zwykłe nazwane
           konfiguracje: z opisem, z „zmienione", z wczytaniem na wybrany kapsel i z wymianą. -->
      <div class="sk-prawa">
        <!-- KOLEJNOŚĆ: najpierw sygnał (czym sterujesz, krok pierwszy opiekuna), potem pola.
             Oba na piętrze 2, jako zwinięte zwijaki z bieżącymi wartościami w nagłówku. -->
        ${typeof scanSignalsHtml === "function" ? scanSignalsHtml() : ""}
        <!-- PIĘTRO 2: pola z sekcjami jako filcowe zwijaki (rf-50b, opcja pietra). -->
        <div id="scanFields"></div>
        <div id="scanReport"></div>
        <div id="scanHistory"></div>
        <!-- PIĘTRO 3 (UX 261120 L4d): jedno „Zaawansowane” na dole karty. Trening, strojenie, którego
             nie zmienia żaden fabryczny preset, narzędzia plansz, zrzut skrótem, skanery jednej
             planszy (gdy jest ich więcej niż jeden, pasek wraca nad pola, rf-50k) i dziennik.
             Licznik zmian i „Przywróć domyślne” dotyczą pól strojenia (rfTier w scanInit). -->
        <details class="cardfold adv sk-zaaw" id="scanAdv"><summary>Zaawansowane</summary>
          <div class="cardfold-body">
            <div class="sk-zaaw-blok sk-tylko-symulacja">
              <div class="sk-zaaw-tytul">Trening</div>
              <div class="sk-bar">
                <button type="button" class="btn sm" id="scanTrain">Trening celności</button>
                <select id="scanCount" class="sk-count" title="Ile celów w treningu">
                  <option value="5">5</option><option value="10" selected>10</option><option value="20">20</option>
                </select>
                <button type="button" class="btn sm" id="scanCalib">Zmierz czas reakcji</button>
              </div>
            </div>
            <div class="sk-zaaw-blok" id="scanZaawPola"></div>
            <!-- PLANSZE, CZYLI WIDOKI GRY. Plansza to widok gry (menu, plansza, panel opcji), nie monitor:
                 dwa zrzuty z jednego monitora to dwie plansze. Spis i „Wgraj planszę” są pod podglądem;
                 tu zostaje to, co ustawia się rzadko: gdzie działa skaner, zrzut ekranu, grupa i rząd
                 WYBRANEJ planszy (zawsze ten sam komplet kontrolek, nieczynne są wygaszone, nie chowane).
                 ⚠️ Bez znaków wstecznych w tych komentarzach: cała karta jest jednym literałem
                 szablonowym i taki znak kończy go w środku. -->
            <div class="sk-plansze" id="scanPlansze">
              <div class="sk-pl-glowa">
                <span class="sk-zaaw-tytul">Plansze</span>
                <span class="sk-pl-lead">widoki gry na Twoim ekranie — każdy ma swoje skanery</span>
                <span class="sk-rozpychacz"></span>
                <span class="sk-grupka">
                  <span class="sk-bar-tytul">Gdzie działa</span>
                  <div class="sk-segment sk-segment-sm" id="scanGdzie" role="group"
                    title="Jedno albo drugie: skaner pracuje w podglądzie tej karty (pulpit testowy albo wgrana plansza) albo w oknie nad prawdziwym pulpitem. „W podglądzie” zamyka okno nad pulpitem, także pracujący skaner.">
                    <button type="button" class="sk-seg" data-gdzie="karta">W podglądzie</button>
                    <button type="button" class="sk-seg" data-gdzie="pulpit">Na pulpicie</button>
                  </div>
                </span>
              </div>
              <!-- DODAWANIE PLANSZ: wgranie zrzutu (też upuszczeniem pliku na podgląd albo Ctrl+V),
                   ZRZUT WSKAZANEGO EKRANU (rf-50q) i GRUPA (plansza bez zrzutu). Spis plansz stoi
                   w pasku pod podglądem. -->
              <div class="sk-pl-rzad sk-tylko-symulacja">
                <span class="sk-grupka sk-pl-akcje">
                <button type="button" class="btn sm sk-pl-btn" id="scanTloWgraj"
                  title="Wgraj zrzut widoku gry — stanie się tłem podglądu, więc obszar skanowania wyznaczysz na prawdziwym obrazie. Możesz też upuścić plik na podgląd albo wkleić zrzut ze schowka (Ctrl+V)."><span class="bic bic-import" aria-hidden="true"></span>Wgraj planszę…</button>
                <button type="button" class="btn sm sk-pl-btn" id="scanZrzutEkranu" aria-haspopup="menu" aria-expanded="false"
                  title="Zrób zdjęcie wybranego ekranu i dodaj je jako nową planszę. Ekran, na którym stoi ten panel, fotografuje się po 3 sekundach, żeby był czas na przejście do gry.">📸 Zrzut ekranu ▾</button>
                <button type="button" class="btn sm ghost sk-pl-btn" id="scanZrzutGrupa"
                  title="Nowa grupa skanerow bez zrzutu. Przydaje sie, gdy chcesz pogrupowac skanery, a zdjecia widoku nie masz albo nie potrzebujesz."><span class="bic bic-folder" aria-hidden="true"></span>Grupa</button>
                </span>
              </div>
              <!-- WYBRANA PLANSZA: nazwa, rozdzielczość ekranu, z którego pochodzi, i jej zrzut.
                   Rozdzielczość (20.09, zgłoszenie: „każdy ekran powinien mieć też info
                   o rozdzielczości ekranu, czy też screena") wgrany zrzut podaje sam; pulpit testowy
                   zaczyna od rozmiaru Twojego monitora i pamięta to, co wpiszesz. -->
              <div class="sk-pl-rzad sk-pl-wybrana sk-tylko-symulacja">
                <span class="sk-pl-lbl">Wybrana</span>
                <input id="scanZrzutNazwa" class="sk-zrz-nazwa" maxlength="40"
                  title="Nazwa tej planszy — po niej poznasz ją w spisie i przy skanerze.">
                <span class="sk-pl-wym">
                  <input id="scanZrzutW" class="sk-pl-num" type="number" min="0" max="32000" step="1"
                    inputmode="numeric" aria-label="Szerokość ekranu tej planszy w pikselach"
                    title="Szerokość ekranu, z którego pochodzi ta plansza.">
                  <span class="sk-pl-x" aria-hidden="true">×</span>
                  <input id="scanZrzutH" class="sk-pl-num" type="number" min="0" max="32000" step="1"
                    inputmode="numeric" aria-label="Wysokość ekranu tej planszy w pikselach"
                    title="Wysokość ekranu, z którego pochodzi ta plansza.">
                  <span class="sk-pl-px" aria-hidden="true">px</span>
                </span>
                <button type="button" class="btn sm ghost sk-pl-btn" id="scanZrzutWymEkran"
                  title="Wstaw rozdzielczość monitora, przy którym siedzisz.">↺ jak mój ekran</button>
                <span class="sk-rozpychacz"></span>
                <button type="button" class="btn sm ghost sk-pl-btn" id="scanTloUsun"
                  title="Zdejmuje obraz z tej planszy — zostaje grupa o tej samej nazwie i z tymi samymi skanerami. Sam zrzut znika też z dysku, chyba że trzyma go inna plansza, drugi kapsel albo zapisany plik.">Zdejmij</button>
                <button type="button" class="btn sm ghost sk-pl-btn sk-zrz-usun" id="scanZrzutUsun"
                  aria-label="Usuń tę planszę"
                  title="Usuń tę planszę ze spisu. Skanery zostają, znika tylko ich przypisanie do niej — razem z planszą znika też jej zrzut z dysku.">🗑</button>
              </div>
              <!-- Podpis składa rf-50l i niesie NAZWĘ PLIKU, która kluczem tłumaczenia nie jest. -->
              <p class="sk-pl-opis" id="scanTloNazwa" data-noi18n></p>
              <!-- ZRZUT PLANSZY SKRÓTEM (21.09) — znowu ZWINIĘTY na starcie (UX 261120, D12), ale
                   jego nagłówek mówi drogę wprost: stan, klawisze i „Ustaw”. Od 22.09 stał rozwinięty,
                   bo schowany mówił, że drogi z gry nie ma; podsumowanie zachowuje tamten sens bez
                   300 px treści przed polami. Markup składa rf-50o, żeby cała ta funkcja mieszkała
                   w jednym pliku (reguła organizacji JS). -->
              ${typeof scanZrzutSkrotHtml === "function" ? scanZrzutSkrotHtml() : ""}
            </div>
            <div id="scanZaawSekcje"></div>
            <div class="sk-zaaw-blok">
              <div class="sk-zaaw-tytul">Dziennik kliknięć</div>
              <div id="scanLog"></div>
            </div>
          </div>
        </details>
      </div>
    </div>
  </div>`;
}

// ------------------------------------------------------------------------------------------
//  WCZYTANIE I ZAPIS
// ------------------------------------------------------------------------------------------
// ⚠️ `state.activeDeviceId`, nie `state.dev`. Przy jednym kapslu jedno i drugie „działa";
// przy dwóch to pierwsze jest jedyną prawdą o tym, którego kapsla ustawienia są na ekranie.
function _scanDev() {
  return (typeof state === "object" && state && state.activeDeviceId) ? state.activeDeviceId : "d0";
}

/* Przełączono kapsel w prawej kolumnie. Nazwa jak u rodzeństwa (`mouseFetchState`,
   `wheelFetchState`, `miFetchState`), bo powód jest ten sam i opisuje go komentarz w `switchDevice`
   (rf-11): konfiguracja skanera to JEDEN wspólny obiekt, więc bez przeładowania karta pokazuje
   ustawienia i wyzwalacze POPRZEDNIEGO kapsla. Sekcja wyzwalaczy odświeża się od razu, bo
   `state.rules` jest już podmienione, a `scanLoad` dopiero leci po sieć. */
function scanFetchState(dev) {
  if (!_SCAN.gotowe) return;          // karty jeszcze nie ma — wczyta się przy pierwszym wejściu
  if (typeof scanSignalsOnDevice === "function") try { scanSignalsOnDevice(); } catch (e) { }
  scanLoad(dev || _scanDev());
}

function scanLoad(dev) {
  _SCAN.dev = dev || _scanDev();
  return fetch("/scan?dev=" + encodeURIComponent(_SCAN.dev))
    .then(function (r) { return r.json(); })
    .then(function (cfg) { scanCfgArrived(cfg); return cfg; })
    .catch(function () { scanCfgArrived({}); });
}

function scanCfgArrived(cfg) {
  const rozbite = _scanRozdziel(cfg || {});
  _SCAN.u = rozbite.u;
  _SCAN.w = rozbite.w;
  _SCAN.enabled = !!(cfg && cfg.enabled);
  if (_SCAN.silnik) _SCAN.silnik.ustawienia(scanUstawieniaPodgladu());
  if (_SCAN.pola) _SCAN.pola.podepnij(_SCAN.u, _SCAN.w);
  _scanPodgladObszaru();
  // Zrzut ekranu jest polem SEKCJI, więc zmienia się razem z całą konfiguracją: przy przełączeniu
  // kapsla, wczytaniu presetu i przy „Sekcja 2". Tu jest jedyne miejsce, przez które przechodzi
  // każda z tych dróg (patrz nota przy `scanSekcjeSync` niżej).
  // Ekrany PRZED zrzutem: tło ramki bierze się z wybranego ekranu, więc spis musi być świeży
  // wcześniej, niż rf-50l o niego zapyta.
  if (typeof scanZrzutySync === "function") try { scanZrzutySync(); } catch (e) { }
  if (typeof scanTloSync === "function") try { scanTloSync(); } catch (e) { }
  _scanRysujWlacznik();
  _scanSzacunek();
  // Pasek sekcji (rf-50k) — TU, bo to jedyne miejsce, przez które przechodzi każda konfiguracja:
  // start karty, zmiana kapsla, wczytanie presetu (a preset niesie CAŁY spis sekcji) i odpowiedź
  // na przełączenie sekcji. Podpięty po nazwie, bo okno nad pulpitem tego pliku nie ładuje.
  if (typeof scanSekcjeSync === "function") try { scanSekcjeSync(); } catch (e) { }
  // Sekcja skrótu (rf-50o) pokazuje, DO KTÓREGO kapsla lecą zrzuty — a to zdanie zmienia się
  // razem z przełączeniem kapsla w prawej kolumnie, czyli tędy.
  if (typeof scanSkrotSync === "function") try { scanSkrotSync(); } catch (e) { }
}

// Zapis JEST OPÓŹNIONY, bo suwak wysyła zdarzenie przy każdym pikselu ruchu, a każde z nich
// dotyka dysku. 400 ms to ta sama zwłoka, co przy innych modułach.
function scanSave() {
  // ⚠️ ZNACZNIK ZMIANY, bez którego odpowiedź serwera COFA to, co człowiek właśnie ustawił.
  // Przebieg, na którym to wyszło (13.09, klik-through obszaru): zmiana → 400 ms → wyszedł POST
  // → człowiek klika gotowy kształt (cztery liczby naraz) → wraca odpowiedź na POPRZEDNI zapis
  // i `Object.assign` przepisuje nią świeże wartości. Wyglądało to jak martwy przycisk, a było
  // wyścigiem. Odpowiedź stosujemy więc tylko wtedy, gdy od jej wysłania nic się nie zmieniło;
  // inaczej i tak zaraz poleci następny zapis, z wersją prawdziwszą.
  _SCAN.zapisNr = (_SCAN.zapisNr || 0) + 1;
  clearTimeout(_SCAN.zapisTimer);
  _SCAN.zapisTimer = setTimeout(function () {
    const nr = _SCAN.zapisNr;
    fetch("/scan?dev=" + encodeURIComponent(_SCAN.dev || _scanDev()), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(_scanScal())
    }).then(function (r) { return r.json(); }).then(function (m) {
      // Serwer przycina — przyjmujemy JEGO wersję, żeby panel nie pokazywał wartości,
      // której nie ma na dysku. Ale tylko wtedy, gdy nadal opisuje to, co widać (patrz wyżej).
      if (m && !m.error && nr === _SCAN.zapisNr) {
        const rozbite = _scanRozdziel(m);
        Object.assign(_SCAN.u, rozbite.u);
        Object.assign(_SCAN.w, rozbite.w);
        if (_SCAN.pola) _SCAN.pola.odswiez();
        if (typeof scanSekcjeSync === "function") try { scanSekcjeSync(); } catch (e) { }
      }
    }).catch(function () { });
  }, 400);
}

function _scanRysujWlacznik() {
  const t = document.getElementById("scanEnable");
  if (!t) return;
  t.classList.toggle("on", !!_SCAN.enabled);
  t.setAttribute("aria-checked", _SCAN.enabled ? "true" : "false");
  if (typeof updateTabDots === "function") try { updateTabDots(); } catch (e) { }
  // Sekcja wyzwalaczy mówi, gdy moduł jest wyłączony, że sygnał i cofanie nie dojdą — a to zdanie
  // ma pojawiać się i znikać RAZEM z tym przełącznikiem, nie dopiero po wyjściu i powrocie na
  // zakładkę. Stąd wywołanie tutaj, a nie u niej: to jest jedyne miejsce, przez które przechodzi
  // KAŻDA zmiana tego stanu (wczytanie z serwera, kliknięcie, przełączenie kapsla).
  if (typeof scanSignalsOnRules === "function") try { scanSignalsOnRules(); } catch (e) { }
}

// Czy skaner tego kapsla jest włączony — pyta o to kropka stanu przy zakładce (rf-34).
function scanIsEnabled() { return !!_SCAN.enabled; }

function scanSetEnabled(on) {
  _SCAN.enabled = !!on;
  _scanRysujWlacznik();
  scanSave();
}

// ------------------------------------------------------------------------------------------
//  SYGNAŁY
// ------------------------------------------------------------------------------------------
// Z reguły Mapowania (`scan:sygnal`) przez serwer i strumień — patrz rf-08-sse-ui.
// Sygnał kapsla działa TAK SAMO w karcie i w oknie nad pulpitem; różni je tylko to, co klika.
// ⚠️ DWIE RZECZY, KTÓRYCH TU BRAKOWAŁO DO 12.09, obie widoczne dopiero z prawdziwym kapslem:
//
// 1. CUDZY KAPSEL STEROWAŁ TYM PODGLĄDEM. Serwer nadaje `dev` przy każdym sygnale, okno nad
//    pulpitem je sprawdza (rf-50h), a karta czytała samo `co`. Przy jednym kapslu nie widać
//    różnicy; przy dwóch podgląd kapsla A reagował na ruch kapsla B.
//
// 2. SYGNAŁ Z KAPSLA DZIAŁAŁ RAZ. `_scanDol()` ustawia `silnik.wcisniete` i bez `_scanGora()`
//    nikt tego nie zdejmował, więc każdy kolejny sygnał odbijał się o `if (self.wcisniete)
//    return 'juz-wcisniete'` (rf-50-scan-model.js). Odblokowywał dopiero Stop. Okno nad pulpitem
//    robiło to poprawnie od początku — karta nie, i dlatego pierwsze klik-through nowego
//    wyzwalacza wyglądało jak zepsuty kapsel.
//
// PUSZCZENIE IDZIE MILISEKUNDĘ PO NACIŚNIĘCIU, tak samo jak w oknie nad pulpitem — i to nie jest
// przybliżenie, tylko prawda o tym sygnale: reguła `scan:` wysyła impuls W CHWILI naciśnięcia,
// a `SlotOutput.up` dla `scan:` jest świadomie ciche („skaner mierzy chwilę, w której człowiek
// CELOWAŁ, a nie długość trzymania"). Z ruchu kapsla nie da się więc odczytać, jak długo ktoś
// trzymał — dlatego pokrętło „Ile trzymać, żeby się liczyło" odsiewa tylko naciśnięcia przycisku
// SYGNAŁ na ekranie, a odpowiednikiem dla kapsla jest zachowanie „Po odczekaniu" w samym
// wyzwalaczu (patrz gotowce „Przytrzymane…" w sekcji „Czym sterujesz skanerem").
function scanSignalArrived(m) {
  // SKANER JEST ALBO TU, ALBO NAD PULPITEM (15.09). Gdy stoi nad pulpitem, sygnał należy do
  // TAMTEGO okna — silnik w karcie przerobiłby go po cichu na schowanej ramce, a dziennik
  // kliknięć zapełniłby się zdarzeniami, których nikt nie widział. Tamto okno czyta ten sam
  // strumień (rf-50h), więc nic nie przepada.
  if (_scanNaPulpicie()) return;
  // Porównujemy z kapslem, którego ustawienia karta NAPRAWDĘ pokazuje (`_SCAN.dev`), a nie
  // z aktywnym kapslem panelu: te dwie rzeczy rozjeżdżają się na chwilę przy przełączeniu
  // (`scanLoad` leci po sieć), a karta ma przez ten czas słuchać tego, co rysuje.
  const mojKapsel = _SCAN.dev || _scanDev();
  if (m && m.dev && mojKapsel && m.dev !== mojKapsel) return;
  const co = m && m.co;
  if (co === "sygnal" || co === "start") { const t = performance.now(); _scanImpuls(t); }
  else if (co === "cofnij") _scanCofnij();
  else if (co === "stop") _scanStop();
}

// Naciśnięcie i puszczenie jednym ruchem — jedyna postać, w jakiej sygnał z kapsla tu dociera.
// Drugi argument `true` mówi silnikowi, że to IMPULS: nie ma czego mierzyć, więc pokrętło „Ile
// trzymać, żeby się liczyło" go nie dotyczy (inaczej ustawione powyżej zera skasowałoby wszystkie
// sygnały z kapsla — patrz komentarz przy `sygnal` w rf-50-scan-model.js).
function _scanImpuls(t) {
  if (!_SCAN.silnik) return;
  _SCAN.silnik.sygnal(t, true);
  _SCAN.silnik.puszczenie(t + 1);
  if (_SCAN.hud) _SCAN.hud.blysk("sygnal");
}

/* CZY SKANER JEST NAD PULPITEM — i dlaczego pytamy o to PO NAZWIE.
   Odpowiedź trzyma rf-50l (przełącznik miejsca), a tego pliku okno nakładki nie ładuje. Ta sama
   konwencja, co przy `scanTloSync` i `scanSekcjeSync`: brak funkcji znaczy „nie ma przełącznika",
   czyli skaner pracuje tam, gdzie ten kod stoi. */
function _scanNaPulpicie() {
  return (typeof scanNaPulpicie === "function") ? !!scanNaPulpicie() : false;
}

/* PRZYCISKI JADĄ TAM, GDZIE STOI SKANER (15.09).

   Do 15.09 SYGNAŁ / Cofnij / Stop rozmawiały WYŁĄCZNIE z silnikiem w karcie. Nad pulpitem
   pracuje osobne okno, które słucha strumienia (`t:"scan"`), więc przy skanerze na pulpicie te
   trzy przyciski sterowały niewidoczną ramką, a prawdziwy pasek stał — i jedyną drogą do niego
   był kapsel z regułą `scan:sygnal`. Kto tej reguły nie miał, dostawał okno, którego nie da się
   ani poprowadzić, ani zamknąć.

   Trasa `/scan/sygnal` istniała w serwerze od początku („Sygnał podany z panelu (przycisk na
   ekranie…)"), tylko NIKT jej nie wołał. Teraz woła ją panel — tą samą drogą, którą idzie reguła
   Mapowania, więc okno nie musi wiedzieć, skąd sygnał przyszedł.

   ⚠️ NA PULPICIE SYGNAŁ TO IMPULS, nie przytrzymanie. Sygnał z kapsla nie niesie długości
   trzymania (patrz nota nad `scanSignalArrived`), więc tamto okno i tak mierzy tylko chwilę
   naciśnięcia — a pokrętło „Ile trzymać, żeby się liczyło" dotyczy przycisku w karcie. */
function _scanWyslijSygnal(co) {
  fetch("/scan/sygnal?dev=" + encodeURIComponent(_SCAN.dev || _scanDev()), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ co: co })
  }).catch(function () {
    _scanToast(_scanT("Nie udało się porozmawiać z aplikacją.", "Could not reach the application."));
  });
}

function _scanDol() {
  if (_scanNaPulpicie()) { _scanWyslijSygnal("sygnal"); return; }
  if (!_SCAN.silnik) return;
  _SCAN.silnik.sygnal(performance.now());
  if (_SCAN.hud) _SCAN.hud.blysk("sygnal");
}
// Puszczenie nie ma odpowiednika nad pulpitem: tam sygnał poszedł już jako impuls.
function _scanGora() {
  if (_scanNaPulpicie()) return;
  if (_SCAN.silnik) _SCAN.silnik.puszczenie(performance.now());
}
function _scanCofnij() {
  if (_scanNaPulpicie()) { _scanWyslijSygnal("cofnij"); return; }
  if (_SCAN.silnik) _SCAN.silnik.cofnij(performance.now());
}
function _scanStop() {
  if (_scanNaPulpicie()) { _scanWyslijSygnal("stop"); return; }
  if (!_SCAN.silnik) return;
  _SCAN.silnik.przerwij();
  if (_SCAN.widok === "trening") { _SCAN.trening.przerwij(); _scanPoTreningu(); }
}

// ------------------------------------------------------------------------------------------
//  URUCHOMIENIE KARTY
// ------------------------------------------------------------------------------------------
function scanInit() {
  if (_SCAN.gotowe || !document.getElementById("scanCard")) return;
  _SCAN.gotowe = true;
  _SCAN.u = Object.assign({}, RFScan.DOMYSLNE);
  _SCAN.w = Object.assign({}, RFScan.WYGLAD_DOM);

  _SCAN.piaskownica = new RFScan.Pulpit(document.getElementById("scanSandbox"));
  _SCAN.piaskownica.zbuduj();
  // Scena i cele treningowe leżą NAD wszystkim w układzie całego okna — tak samo jak w
  // laboratorium. Rysują wyłącznie wewnątrz prostokąta podglądu, bo cała geometria bierze się
  // z `ekran`, a ten jest prostokątem ramki (patrz `_scanEkran`).
  const warstwa = document.createElement("div");
  warstwa.id = "scanSceneLayer";
  warstwa.className = "sk-scene-layer";
  document.body.appendChild(warstwa);
  const celeHost = document.createElement("div");
  celeHost.id = "scanTargetsLayer";
  celeHost.className = "sk-scene-layer";
  document.body.appendChild(celeHost);
  _SCAN.scena = new RFScan.Scena(warstwa);
  _SCAN.trening = new RFScan.Trening(celeHost);

  // PASEK STANU JEST ZWYKŁYM ELEMENTEM KARTY, POD RAMKĄ (16.09). Wcześniej leżał na własnej
  // warstwie `fixed` dosuwanej co klatkę do górnej krawędzi podglądu — czyli NA obrazie. Warstwa
  // była potrzebna tylko po to, żeby pasek skanera (też `fixed`) nie malował po nim; odkąd pasek
  // stanu stoi POD ramką, scena nie ma jak go dosięgnąć, bo `_scanPrzytnij` tnie ją do ramki.
  // Skutek uboczny na plus: nie trzeba go ani pozycjonować, ani chować przy przewijaniu strony —
  // jedzie z lepką kolumną jak reszta.
  _SCAN.hud = new RFScan.ui.Hud(document.getElementById("scanHud"));
  _SCAN.dziennik = new RFScan.ui.Dziennik(document.getElementById("scanLog"));

  _SCAN.silnik = new RFScan.Silnik({
    ustawienia: scanUstawieniaPodgladu(), ekran: _scanEkran(), cele: [],
    naZdarzenie: _scanZdarzenie
  });

  _SCAN.pola = new RFScan.Panel(document.getElementById("scanFields"), {
    ustawienia: _SCAN.u, wyglad: _SCAN.w,
    // Piętra (UX 261120 L4d): sekcje jako zwijaki piętra 2, pola bez presetów w „Zaawansowanych”.
    pietra: { zaaw: document.getElementById("scanZaawPola") },
    naZmiane: function (u, w, ktore) {
      if (ktore === "tryb" || ktore === "kolejnosc" || ktore === "przebiegi" || ktore === "zestaw")
        scanSilnikOdswiez(true);
      else scanSilnikOdswiez(false);
      // Zmiana obszaru = podświetl go. Podgląd zwykle stoi cały czas, ale przy „Od lewej: 25 → 30"
      // prostokąt drgnie o kilka pikseli i można tego nie zauważyć — błysk mówi, że liczba doszła.
      // Jeden warunek na wszystkie pola sekcji: gotowe kształty i jednostka też przez niego
      // przechodzą, bo każde z nich kończy się kluczem `obszar*`.
      if (typeof ktore === "string" && ktore.indexOf("obszar") === 0) {
        _scanPodgladObszaru();
        if (_SCAN.scena) _SCAN.scena.blysnijObszarem(1200);
      }
      _scanSzacunek();
      scanSave();
    }
  });
  _SCAN.pola.zbuduj();
  // Piętro 3: licznik i „Przywróć domyślne” liczą pola strojenia z `scanZaawPola`.
  if (typeof rfTier === "function") rfTier(document.getElementById("scanAdv"), "skaner.zaawansowane", {
    changed: function () { return _SCAN.pola.zmienione(_SCAN.pola.polaZaaw()); },
    reset: function () { _SCAN.pola.domyslne(_SCAN.pola.polaZaaw()); },
    take: function () { return _SCAN.pola.migawka(_SCAN.pola.polaZaaw()); },
    restore: function (m) { _SCAN.pola.przywroc(m); }
  });
  // Paska zestawów tu NIE MA od 11.09 — zestawy są pozycjami BIBLIOTEKI (rf-50j `scanZestawySiew`).
  // `RFScan.ui.zestawy` zostaje w rf-50g dla piaskownicy w katalogu prac, gdzie biblioteki nie ma.

  _scanPodepnijPrzyciski();
  if (typeof scanSignalsInit === "function") scanSignalsInit();
  // Zrzut gry pod podglądem + przełącznik „gdzie oglądać obszar" (rf-50l). Podpięty po nazwie,
  // bo okno nad pulpitem tego pliku nie ładuje — tak samo jak sekcje i sygnały.
  if (typeof scanZrzutyInit === "function") scanZrzutyInit();
  if (typeof scanTloInit === "function") scanTloInit();
  // Sekcja „Zrzut planszy skrótem klawiszowym" (rf-50o). Stan bierze z `/hotkey`, nie z `/scan`:
  // skrót jest ustawieniem APLIKACJI, a nie kapsla — do kapsla należy tylko to, dokąd trafiają
  // zrzuty. Podpięta po nazwie, bo okno nad pulpitem tego pliku nie ładuje.
  if (typeof scanSkrotInit === "function") scanSkrotInit();
  // Lista nazwanych konfiguracji — raz przy starcie; potem odswieza ja sam komponent biblioteki
  // (`reloadPresets` w adapterze) po kazdym zapisie, usunieciu i zmianie nazwy.
  if (typeof loadScanPresets === "function") loadScanPresets();
  // UKŁAD MONITORÓW — potrzebny obszarowi skanera: bez niego „prawa połowa DISPLAY2" nie ma z
  // czego się policzyć, a lista ekranów w polu „Ekran" byłaby pusta. Strona nie ma jak go
  // wyliczyć sama (patrz rf-31b) — pyta serwer. Raz przy starcie i co 10 s, bo monitory nie
  // przesuwają się często, a przepięty kabel ma się kiedyś ujawnić bez przeładowania panelu.
  _scanEkranyOdswiez();
  setInterval(_scanEkranyOdswiez, 10000);
  _scanPetla();
  scanLoad(_scanDev());
  // Uchwyt dla konsoli i dla harnessu (`tests/scan_card_harness.mjs`): ten mierzy NARYSOWANY
  // pasek po zmianie ustawienia, a do tego musi umieć je zmienić tą samą drogą, co panel.
  window.RFScanKarta = _SCAN;
}

function _scanEkranyOdswiez() {
  if (!_scanWidoczna || !_scanWidoczna()) return;   // schowana karta nie ma po co pytać
  fetch("/screens?dev=" + encodeURIComponent(_scanDev()))
    .then(function (r) { return r.json(); })
    .then(function (j) {
      const opis = function () {
        const e = RFScan.ekrany, d = e && e.desktop;
        return (e && e.screens ? e.screens.length : -1) + "|" + (d ? d.w + "x" + d.h : "?");
      };
      const bylo = opis();
      RFScan.ustawEkrany(j);
      const jest = opis();
      if (bylo !== jest) {
        // Lista w polu „Ekran" powstaje z tego cache'u, więc po pierwszej odpowiedzi (i po każdej
        // zmianie liczby monitorów) trzeba ją przerysować — sama się o tym nie dowie.
        if (_SCAN.pola) _SCAN.pola.odswiez();
        // …a od 16.09 z tego samego cache'u biorą się PROPORCJE ramki i SKALA pokręteł. Bez tych
        // dwóch linijek podgląd zostawał w geometrii sprzed podłączenia (albo odłączenia) monitora
        // aż do najbliższej zmiany ustawienia — czyli wyglądał na zepsuty, a był tylko nieodświeżony.
        if (typeof scanTloSync === "function") try { scanTloSync(); } catch (err) { }
        // …a od 20.09 także ROZDZIELCZOŚĆ PULPITU TESTOWEGO: dopóki nikt jej nie wpisał, jest nią
        // rozmiar monitora z tej właśnie odpowiedzi. Bez tego pigułka „Pulpit testowy" zostawała
        // bez liczby do pierwszego kliknięcia w spis — `/screens` przychodzi PÓŹNIEJ niż
        // konfiguracja, a pigułki rysują się z konfiguracji.
        if (typeof scanZrzutySync === "function") try { scanZrzutySync(); } catch (err) { }
        scanSilnikOdswiez(false);
        _scanSzacunek();
      }
    }).catch(function () { });
}

// RAMKA PODGLĄDU — cały udawany „pulpit" karty.
function _scanRamka() {
  const s = document.getElementById("scanStage");
  if (!s) return { x: 0, y: 0, w: 800, h: 450 };
  const r = s.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}
/* PODGLĄD JEST POMNIEJSZONĄ KOPIĄ EKRANU, NIE JEGO KARYKATURĄ (16.09).

   Ekrany współdzielą podgląd, skalę i proporcje, bo inaczej podgląd nie ma sensu.

   Do 16.09 ramka podglądu kłamała na dwa sposoby naraz:
     • KSZTAŁTEM: wysokość brała się z arkusza (520 px) albo z proporcji wgranego zrzutu, a obszar
       liczył się jako ułamek CAŁEGO pulpitu. Prostokąt „dolna 1/3 na środku" wychodził więc
       w ramce inaczej niż na ekranie, a przy dwóch monitorach — zupełnie inaczej.
     • TEMPEM I GRUBOŚCIĄ: wszystkie pokrętła „w pikselach" (pasmo, prędkość, dociąganie, próg
       końca podziału) silnik czyta w pikselach TEGO prostokąta, w którym rysuje. Na pulpicie
       1707 px to cały ekran, w ramce — 490 px. Pasek 170 px zajmował więc w podglądzie 35 %
       wysokości zamiast 16 %, a 700 px/s przebiegało ramkę trzy i pół raza szybciej niż ekran.
       Trening celności i kalibracja opóźnienia mierzyły przez to coś, czego potem nie ma.

   OD TERAZ ramka JEST tym ekranem, tylko mniejszym:
     1. reprezentuje BAZĘ obszaru (wybrany monitor albo cały pulpit) i bierze JEJ proporcje
        (`_sktloWysokosc` w rf-50l),
     2. wszystkie pokrętła „w pikselach" jadą do silnika pomnożone przez skalę ramki
        (`scanUstawieniaPodgladu`) — z tą samą skalą liczy się szacowany czas kliknięcia,
     3. zrzut gry leży dokładnie na bazie, więc obraz i liczby mówią to samo.

   Czego to NIE zmienia: zapisu. Konfiguracja nadal trzyma piksele EKRANU (i procenty bazy),
   a okno nad pulpitem rysuje 1:1 — przeliczenie żyje wyłącznie po stronie podglądu w karcie. */
function scanBazaPulpitu() {
  const e = RFScan.ekrany;
  const d = (e && e.desktop && e.desktop.w > 0 && e.desktop.h > 0) ? e.desktop : null;
  if (!d) return null;                       // bez wiedzy o monitorach zostaje stara arytmetyka
  // ⭐ PRZY KILKU MONITORACH RAMKA UDAJE JEDEN EKRAN — TEN, NA KTÓRYM STANIE OKNO (2026-09-26).
  // Błąd: podgląd rozdzielczości był zły, a zrzuty ucięte, jakby nie skalowały się
  // do 2 monitorów. Przy „Cały pulpit" ramka brała proporcje OBU ekranów obok
  // siebie, a plansza (zrzut jednego monitora) była na nią rozciągana. Wybór ekranu żyje w modelu
  // (`RFScan.bazaProstokat` → `ekranSkanera`), bo tę samą decyzję podejmuje serwer, stawiając okno.
  return RFScan.bazaProstokat(_SCAN.u || {}, e);
}

/* Układ monitorów w wersji DLA PODGLĄDU: pulpitem jest baza obszaru. Dzięki temu ta sama funkcja
   modelu (`obszarEkranu`) liczy w karcie to samo, co nad pulpitem — tylko odniesione do ramki.
   Sekcja wskazująca INNY monitor wypada wtedy poza ramkę i przycina ją `overflow:hidden`; tak ma
   być, bo ona naprawdę pracuje gdzie indziej. */
function scanEkranyPodgladu() {
  const b = scanBazaPulpitu();
  if (!b) return RFScan.ekrany;
  return { desktop: b, screens: (RFScan.ekrany && RFScan.ekrany.screens) || [] };
}

// Ile razy ramka jest mniejsza od ekranu, który udaje. 1, dopóki nie wiadomo, jak wyglądają monitory.
function scanSkalaPodgladu() {
  const b = scanBazaPulpitu(), r = _scanRamka();
  if (!b || !(r.w > 1) || !(b.w > 1)) return 1;
  return r.w / b.w;
}

/* Pokrętła „w pikselach" przeliczone na skalę ramki. Czasy (ms), liczby pól i procenty zostają —
   one nie zależą od tego, jak duży jest ekran. ⚠️ Zero zostaje zerem: `skok: 0` znaczy „o własną
   grubość", a `dociaganie: 0` — „nie dociągaj"; przemnożone przez cokolwiek zmieniłyby znaczenie. */
const _SCAN_W_PIKSELACH = ["pasmoY", "pasmoX", "skok", "pasmoDokladnyY", "pasmoDokladnyX",
  "predkosc", "progKoncaBloku", "dociaganie", "predkoscPromienia"];
function scanUstawieniaPodgladu(zrodlo) {
  const u = zrodlo || _SCAN.u || {};
  const k = scanSkalaPodgladu();
  if (!(k > 0) || Math.abs(k - 1) < 0.005) return u;
  const out = Object.assign({}, u);
  _SCAN_W_PIKSELACH.forEach(function (n) {
    const v = +out[n];
    if (isFinite(v) && v > 0) out[n] = Math.max(1, v * k);
  });
  return out;
}

/* Jedyne wejście do silnika karty. `przebuduj` = zmiana, która przestawia PLAN przejazdu (tryb,
   kolejność, liczba przebiegów) — `ustawienia()` przerywa wtedy jazdę, więc przy zwykłym pokrętle
   idzie tańsza droga. */
function scanSilnikOdswiez(przebuduj) {
  if (!_SCAN.silnik) return;
  const u = scanUstawieniaPodgladu();
  if (przebuduj) _SCAN.silnik.ustawienia(u);
  else Object.assign(_SCAN.silnik.u, u);
}

// …i wycinek, w którym skaner ma pracować. Podgląd pokazuje obszar PROPORCJONALNIE: ramka udaje
// bazę obszaru, więc „dolna 1/3 na środku" wygląda w niej dokładnie tak, jak będzie wyglądać nad
// grą — także wtedy, gdy wpisano piksele, bo `obszarEkranu` przelicza je przez ułamki bazy.
function _scanEkran() {
  const r = _scanRamka();
  try { return RFScan.obszarEkranu(_SCAN.u || {}, r, scanEkranyPodgladu()); } catch (e) { return r; }
}

/* PODGLĄD OBSZARU W PODGLĄDZIE — „gdzie skaner będzie pracować", zanim ruszy.
   Karta jest ekranem konfiguracji, więc prostokąt świeci tu CAŁY CZAS, dopóki skaner czeka;
   nad pulpitem jest odwrotnie (krótki błysk po zmianie — patrz rf-50h), bo tam wisiałby nad
   cudzą pracą. Wyjątek: „cały pulpit" niczego nie zawęża, a półprzezroczysta płachta na całą
   ramkę mówiłaby tylko tyle, że podgląd jest podglądem — zostaje wtedy sam błysk po zmianie.
   Po wybraniu albo wpisaniu wartości podgląd się aktualizuje, a na pulpicie ramka od razu
   się podświetla. */
function _scanPodgladObszaru() {
  if (_SCAN.scena) _SCAN.scena.stalyPodgladObszaru((_SCAN.u || {}).obszar !== "caly");
}

function _scanPodepnijPrzyciski() {
  const byId = function (i) { return document.getElementById(i); };
  const tg = byId("scanEnable");
  if (tg) {
    tg.addEventListener("click", function () { scanSetEnabled(!_SCAN.enabled); });
    tg.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); scanSetEnabled(!_SCAN.enabled); }
    });
  }
  const sig = byId("scanSignal");
  if (sig) {
    sig.addEventListener("pointerdown", function (e) { e.preventDefault(); _SCAN.wcisniety.mysz = true; _scanDol(); });
    sig.addEventListener("pointerup", function () { if (_SCAN.wcisniety.mysz) { _SCAN.wcisniety.mysz = false; _scanGora(); } });
    sig.addEventListener("pointerleave", function () { if (_SCAN.wcisniety.mysz) { _SCAN.wcisniety.mysz = false; _scanGora(); } });
  }
  if (byId("scanUndo")) byId("scanUndo").addEventListener("click", _scanCofnij);
  if (byId("scanStop")) byId("scanStop").addEventListener("click", _scanStop);
  if (byId("scanTrain")) byId("scanTrain").addEventListener("click", function () { _scanZacznijTrening("celnosc"); });
  if (byId("scanCalib")) byId("scanCalib").addEventListener("click", function () { _scanZacznijTrening("kalibracja"); });
  if (byId("scanLive")) byId("scanLive").addEventListener("click", scanOtworzNadPulpitem);
  // Jedno „Wyśrodkuj kapsel” dla Myszy, Kontrolera, Koła i Skanera (wspólne rfCenterCapsule, rf-06).
  if (byId("scanCenter")) byId("scanCenter").addEventListener("click", function (ev) {
    if (typeof rfCenterCapsule === "function") rfCenterCapsule(ev.currentTarget);
  });

  // KLAWIATURY TU NIE MA — i to jest decyzja, nie brak (bez klawisza P,
  // zostaje sterowanie przyciskiem i kapslem). Trzy powody, wszystkie praktyczne:
  //   • skaner jest dla kogoś, kto klawiatury może nie mieć w zasięgu — panel sterowany
  //     klawiszem uczyłby drogi, której ta osoba i tak nie użyje,
  //   • nad pulpitem okno przepuszcza kliknięcia i nigdy nie ma skupienia, więc żaden klawisz
  //     i tak by tam nie zadziałał; panel i nakładka mają mieć JEDNO wejście, nie dwa,
  //   • „p" wpisane w nazwę presetu zatrzymywało pasek, a tego nie da się załatać inaczej niż
  //     listą wyjątków, która zawsze jest o jeden przypadek za krótka.
  // Zostają dwie drogi i obie są prawdziwe: przyciski na tej karcie oraz kapsel, czyli reguła
  // `scan:sygnal` w Mapowaniu (patrz sekcja „Czym sterujesz skanerem", rf-50i).

  // Prawdziwe kliknięcie myszą w piaskownicy — żeby dało się porównać „ile to trwa zdrową ręką".
  const sb = byId("scanSandbox");
  if (sb) sb.addEventListener("click", function (ev) {
    if (_SCAN.widok !== "piaskownica") return;
    // Pod zrzutem gry piaskownicy nie widać, więc „kliknąłem w Kosz" byłoby zdaniem o czymś,
    // czego na ekranie nie ma. Dziennik zostaje pusty — tak samo, jak nad prawdziwym pulpitem.
    if (_scanMaZrzut()) return;
    const n = _SCAN.piaskownica.klik(ev.clientX, ev.clientY, "lewy", "mysz");
    _SCAN.dziennik.dodaj({ nazwa: n, skad: "mysz" }, 0);
  });
}

// ------------------------------------------------------------------------------------------
//  PĘTLA KLATEK
// ------------------------------------------------------------------------------------------
// ⚠️ Ukryta zakładka to `display:none`: nic w niej nie ma wymiaru, a rAF i tak nie posuwa
// przejść. Pętla chodzi więc tylko wtedy, gdy karta jest NA EKRANIE — i zatrzymuje skaner,
// gdy ktoś z niej wyjdzie w trakcie skanowania.
function _scanWidoczna() {
  const c = document.getElementById("scanCard");
  return !!(c && c.offsetParent !== null);
}

// Scena i cele treningu leżą w <body>, nie w karcie — więc chowa się je osobno. Pasek stanu jest
// od 16.09 w karcie i chowa się z nią sam; zostaje na tej liście, bo jedno miejsce gaszące
// „wszystko, co rysuje skaner" jest odporniejsze niż trzy różne drogi (i tego pilnuje
// `scan_library_harness`).
function _scanWarstwy(widac) {
  ["scanSceneLayer", "scanTargetsLayer", "scanHud"].forEach(function (id) {
    const n = document.getElementById(id);
    if (n) n.style.display = widac ? "" : "none";
  });
}

/* NIC NIE MALUJE POZA PODGLĄDEM.
   Scena i cele treningu są dziećmi <body> z `position:fixed` — muszą, bo ta sama klasa rysuje
   nad prawdziwym pulpitem. Skutek uboczny w KARCIE: `#scanCard{overflow:clip}` przycina ramkę
   podglądu, ale warstw już nie, bo leżą poza kartą. Dopóki cała ramka mieściła się na ekranie,
   nie było tego widać; wystarczy jednak przewinąć stronę tak, żeby dolna krawędź karty weszła
   w ramkę (a po zwinięciu wszystkich sekcji prawa kolumna jest krótka, więc karta też), i pasek
   maluje dalej — po stronie pod kartą.
   Liczymy więc część wspólną: ramka ∩ karta ∩ okno pod paskiem aplikacji, i tym przycinamy
   obie warstwy. `inset()` mierzy od krawędzi PUDŁA WARSTWY, więc odległości liczymy z jej
   własnego prostokąta, a nie z `innerWidth`/`innerHeight` — te dwie liczby zawierają pasek
   przewijania, którego pudło warstwy (`fixed; inset:0`) już nie ma. Zwracamy prostokąt, bo
   korzysta z niego jeszcze pasek stanu. */
/* GÓRNA LINIA, POD KTÓRĄ WOLNO MALOWAĆ. Nad podglądem stoją DWA przyklejone paski, nie jeden:
   pasek aplikacji (`<header>`) oraz pasek modułu (`.rfpc-head` — nazwa modułu, pigułka kapsla,
   włącznik, zakładki). Do 14.09 liczył się tylko ten pierwszy, więc scena i pasek stanu potrafiły
   wejść na drugi (pasek „Czekam na
   sygnał" nachodził na pasek „Skaner · Triki 2 · Off"). */
/* Pasek modułu jest JEDEN WIDOCZNY z kilkunastu: każdy moduł ma swój `.rfpc-head` w drzewie,
   a schowane strony zostają w DOM-ie (`querySelector` trafiłby w „Mapowanie"). */
function _scanGlowaModulu() {
  const lista = document.querySelectorAll(".rfpc-head");
  for (let i = 0; i < lista.length; i++) {
    const n = lista[i];
    if (n.offsetParent !== null && n.getBoundingClientRect().height > 0) return n;
  }
  return null;
}

function _scanGoraZaslon() {
  let gora = 0;
  [document.querySelector("header"), _scanGlowaModulu()].forEach(function (n) {
    if (!n || n.offsetParent === null) return;
    // Bez warunku „czy już przyklejony": oba paski leżą w drzewie NAD podglądem, więc ich dolna
    // krawędź nigdy nie wejdzie w ramkę inaczej niż przez przyklejenie.
    const r = n.getBoundingClientRect();
    if (r.height > 0) gora = Math.max(gora, r.bottom);
  });
  return gora;
}

/* PODGLĄD PARKUJE POD PASKIEM MODUŁU, A NIE POD LICZBĄ Z ARKUSZA — i nie robi tego już ten plik.
   `.sk-lewa` miała w CSS `top: var(--topbar-h) + 46px`, czyli zgadywaną wysokość paska modułu;
   pasek ma 75 px, więc przyklejony podgląd wjeżdżał POD niego, a pasek stanu skanera malował po
   nazwie modułu. Pierwsza naprawa (14.09 rano) mierzyła żywy pasek TUTAJ, w pętli klatek skanera —
   ale tę samą liczbę zgadywały jeszcze scena koła, podgląd myszy i mapa kontrolera, a kopiowanie
   tej funkcji do każdego z nich dałoby cztery pomiary tego samego paska. Wysokość jest więc
   mierzona RAZ dla całej aplikacji (`rfWatchModHead` w rf-40) i stoi w `--rf-sticky-top`
   (22-modtabs.css), z której `.sk-lewa` czyta swój `top` wprost w arkuszu. */

function _scanPrzytnij(ramka) {
  const karta = document.getElementById("scanCard");
  const kr = karta ? karta.getBoundingClientRect() : null;
  const gora = _scanGoraZaslon();
  const okW = document.documentElement.clientWidth, okH = document.documentElement.clientHeight;
  const x1 = Math.max(ramka.x, kr ? kr.left : 0, 0);
  const y1 = Math.max(ramka.y, kr ? kr.top : 0, gora);
  const x2 = Math.min(ramka.x + ramka.w, kr ? kr.right : okW, okW);
  const y2 = Math.min(ramka.y + ramka.h, kr ? kr.bottom : okH, okH);
  const w = Math.max(0, x2 - x1), h = Math.max(0, y2 - y1);
  ["scanSceneLayer", "scanTargetsLayer"].forEach(function (id) {
    const n = document.getElementById(id);
    if (!n) return;
    const p = n.getBoundingClientRect();
    const ciecie = "inset(" + Math.round(y1 - p.top) + "px " + Math.round(p.right - x1 - w) + "px "
      + Math.round(p.bottom - y1 - h) + "px " + Math.round(x1 - p.left) + "px)";
    if (n.style.clipPath !== ciecie) n.style.clipPath = ciecie;
  });
  return { x: x1, y: y1, w: w, h: h };
}

function _scanPetla() {
  cancelAnimationFrame(_SCAN.petla);
  const klatka = function (t) {
    _SCAN.petla = requestAnimationFrame(klatka);
    if (!_SCAN.silnik) return;
    if (!_scanWidoczna()) {
      if (_SCAN.silnik.faza !== "spoczynek") _SCAN.silnik.przerwij();
      // ⚠️ ZGASIĆ TRZY WARSTWY. Scena, cele treningu i pasek stanu są dziećmi <body> z
      // `position:fixed` (muszą, bo rysują NAD stroną i nad pulpitem), więc samo schowanie karty
      // ich nie dotyczy — zostawały na ekranie z ostatnią klatką. Widać to było jak na dłoni po
      // dodaniu zakładek modułu: wchodziło się w „Bibliotekę”, a nad listą presetów wisiał pasek
      // „Czekam na sygnał”. Pętla i tak wychodzi tą gałęzią, więc nikt ich później nie chował.
      _scanWarstwy(false);
      return;
    }
    // SKANER NAD PULPITEM — ramka podglądu jest schowana (klasa `sk-na-pulpicie`), więc nie ma
    // czego rysować i nie ma po czym liczyć: `_scanRamka()` zwróciłaby prostokąt zerowy, a pasek
    // stanu i scena leżą na warstwach `fixed` w <body>, czyli przetrwałyby schowanie karty
    // i malowały po pokrętłach. Silnik parkujemy — jego kopia pracuje w tamtym oknie.
    if (_scanNaPulpicie()) {
      if (_SCAN.silnik.faza !== "spoczynek") _SCAN.silnik.przerwij();
      _scanWarstwy(false);
      return;
    }
    _scanWarstwy(true);
    const ramka = _scanRamka();       // cały podgląd — po nim tnie się scena
    const e = _scanEkran();           // wycinek, w którym pracuje skaner
    /* SKALA RAMKI ZMIENIA SIĘ W BIEGU — przy zwężeniu okna, przyklejeniu kolumny i po wgraniu
       zrzutu (ramka bierze wtedy proporcje ekranu). Pokrętła „w pikselach" muszą za nią pójść,
       inaczej pasek zostaje w starej grubości i w starym tempie. Próg 0,5 %, żeby zaokrąglenia
       układu nie przepisywały ustawień co klatkę. */
    const k = scanSkalaPodgladu();
    if (!_SCAN.skala || Math.abs(k - _SCAN.skala) / Math.max(0.0001, _SCAN.skala) > 0.005) {
      _SCAN.skala = k;
      scanSilnikOdswiez(false);
      _scanSzacunek();
    }
    _SCAN.silnik.ustawEkran(e);
    _scanOdswiezCele();
    _scanPrzytnij(ramka);
    const stan = _SCAN.silnik.krok(t);
    // Ostatni stan na oknie — dla konsoli i dla harnessu (`tests/scan_card_harness.mjs`),
    // który musi wiedzieć, GDZIE stoi pasek, żeby nacisnąć we właściwej chwili.
    window._scanStanTestowy = stan;
    _SCAN.scena.rysuj(stan, _SCAN.w, e, _SCAN.silnik.cele);
    _SCAN.hud.rysuj(_scanStanKarty(stan));
    // Obszary POZOSTAŁYCH skanerów tej konfiguracji (rf-50k). Tutaj, bo prostokąty liczą się
    // z ramki, a ramka zmienia rozmiar razem ze stroną — i bo tylko stąd widać, czy skaner
    // właśnie jedzie (wtedy cudze prostokąty schodzą z drogi). Rysunek ma własny odcisk, więc
    // klatka bez zmian nie dotyka DOM-u.
    // ⚠️ `err`, nie `e`: kilka linii wyżej `const e` to obszar aktywnej sekcji — nazwa w `catch`
    // przysłoniłaby go w tym bloku i następna zmiana w tym miejscu czytałaby wyjątek jako ramkę.
    if (typeof scanSekcjeCienie === "function") try { scanSekcjeCienie(); } catch (err) { }
  };
  _SCAN.petla = requestAnimationFrame(klatka);
}

/* ZDANIE „JAK ZACZĄĆ" MÓWI PASEK STANU, A NIE OSOBNE PUDEŁKO NA OBRAZIE (16.09).
   W spoczynku silnik podpowiada „Naciśnij sygnał, żeby zacząć." — ogólnie, bo tę samą linię czyta
   okno nad pulpitem. W karcie wolno powiedzieć więcej: jak nazywa się przycisk i że to jeszcze
   piaskownica. Kopia stanu, nie podmiana pola: `window._scanStanTestowy` ma zostać tym, co naprawdę
   zwrócił silnik. */
function _scanStanKarty(stan) {
  if (stan.faza !== "spoczynek") return stan;
  return Object.assign({}, stan, {
    opis: _scanT("Naciśnij SYGNAŁ albo daj sygnał kapslem, a skaner ruszy w podglądzie.",
      "Press SIGNAL or send a signal with the capsule and the scanner starts in the preview.")
  });
}

/* CZY POD PODGLĄDEM LEŻY ZRZUT. Od 16.09 zrzut należy do EKRANU (rf-50n), a nie do sekcji, więc
   pytanie „czy widać obraz gry" ma jedną odpowiedź dla całej karty: patrzymy na wybrany ekran,
   a na `tlo` sekcji tylko wtedy, gdy spisu ekranów jeszcze nie ma (konfiguracja sprzed zmiany).
   Odpowiadają na to dwie rzeczy naraz: dziennik kliknięć piaskownicy (pod obrazem gry nie ma
   „Kosza", więc nie ma czego zapisać) i cele dociągania (ikony, których nie widać, przestają być
   celami — inaczej skaner ściągałby punkt do niewidocznego pulpitu). */
function _scanMaZrzut() {
  const z = (typeof scanZrzutAktualny === "function") ? scanZrzutAktualny() : null;
  if (z && z.plik) return true;
  const c = _SCAN.u || {};
  return !(Array.isArray(c.zrzuty) && c.zrzuty.length) && !!c.tlo;
}

function _scanOdswiezCele() {
  if (_SCAN.widok === "trening") {
    const c = _SCAN.trening.cel();
    _SCAN.silnik.ustawCele(c ? [{ x: c.x, y: c.y, w: c.w, h: c.h, id: "cel" }] : []);
  } else if (_scanMaZrzut()) {
    // ZRZUT GRY ZAKRYWA PIASKOWNICĘ, więc jej ikony przestają być celami. Inaczej dociąganie
    // ściągałoby punkt do niewidocznego „Kosza" leżącego gdzieś pod obrazem gry — a to wygląda
    // dokładnie jak skaner, który chybia. Nad prawdziwym pulpitem jest tak samo (rf-50h zeruje
    // dociąganie), bo tam też nie wiemy, co jest klikalne.
    _SCAN.silnik.ustawCele([]);
  } else {
    _SCAN.silnik.ustawCele(_SCAN.piaskownica.cele());
  }
}

function _scanSzacunek() {
  const n = document.getElementById("scanEstimate");
  // Przecinek dziesiętny po polsku (UX 261120, P-G2-04): „11,2 s", nie „11.2 s".
  const s = RFScan.szacujCzas(scanUstawieniaPodgladu(), _scanEkran()).toFixed(1);
  if (n) {
    n.textContent = _scanTf("Jedno kliknięcie trwa ok. {0} s", "One click takes about {0} s",
      (typeof _lang !== "undefined" && _lang === "en") ? s : s.replace(".", ","));
    // W wąskim oknie zdanie skraca się wielokropkiem (26-scan.css), więc całe jest w podpowiedzi.
    n.setAttribute("data-rftip", n.textContent);
  }
}

// ------------------------------------------------------------------------------------------
//  ZDARZENIA SILNIKA
// ------------------------------------------------------------------------------------------
function _scanZdarzenie(rodzaj, dane) {
  if (rodzaj === "etap") { if (_SCAN.hud) _SCAN.hud.blysk("ok"); }
  else if (rodzaj === "cofniete") { if (_SCAN.hud) _SCAN.hud.blysk("cofniecie"); }
  else if (rodzaj === "odrzucony") {
    if (_SCAN.hud) _SCAN.hud.blysk("zle");
    _scanToast(dane.powod === "odbicie" ? _scanT("Za szybko po poprzednim — odrzucone", "Too soon after the last one — ignored")
      : dane.powod === "blokada" ? _scanT("Przerwa po wyborze — odrzucone", "Pause after a choice — ignored")
        : _scanT("Za krótkie naciśnięcie — odrzucone", "Too short a press — ignored"));
  }
  else if (rodzaj === "drugi-punkt") _scanToast(_scanT("Teraz wskaż drugi punkt", "Now point at the second spot"));
  else if (rodzaj === "akcja") _scanAkcja(dane);
}

function _scanToast(tekst) {
  if (typeof toast === "function") { try { toast(tekst); return; } catch (e) { } }
  const h = document.getElementById("scanHud");
  if (h) h.setAttribute("data-toast", tekst);
}

// Jedyne miejsce, w którym „kliknięcie" staje się czymkolwiek. W karcie NIGDY nie wychodzi poza
// przeglądarkę: trafia w udawany pulpit i w dziennik. Prawdziwy klik robi okno nad pulpitem.
function _scanAkcja(wynik) {
  const nazwa = RFScan.nazwaAkcji(wynik.akcja);
  _SCAN.scena.slad(wynik.punkt, nazwa, _scanEkran());
  if (_SCAN.widok === "trening") {
    const r = _SCAN.trening.zapisz(wynik);
    if (r && r.koniec) _scanKoniecTreningu(r.raport);
    else if (r) _scanToast(r.ostatni.trafiony ? _scanT("Trafione", "Hit")
      : _scanTf("Obok — {0} px", "Missed by {0} px", Math.abs(Math.round(r.ostatni.bladPx))));
    _scanOdswiezCele();
    return;
  }
  if (wynik.akcja === "klawiatura") { _SCAN.piaskownica.pokazKlawiature(); return; }
  const cel = _SCAN.piaskownica.klik(wynik.punkt.x, wynik.punkt.y, wynik.akcja, "skaner");
  const akcja = RFScan.akcja(wynik.akcja);
  const podpis = (akcja && akcja.rodzaj === "klawisze")
    ? nazwa + " (" + akcja.klawisze.toUpperCase() + ") → " + (cel || "—")
    : cel;
  _SCAN.dziennik.dodaj({ nazwa: podpis, skad: "skaner" }, wynik.czas);
}

// ------------------------------------------------------------------------------------------
//  TRENING
// ------------------------------------------------------------------------------------------
let _scanPrzedTreningiem = null;

function _scanZacznijTrening(rodzaj) {
  _SCAN.silnik.przerwij();
  _scanPrzedTreningiem = JSON.parse(JSON.stringify(_SCAN.u));
  if (rodzaj === "kalibracja") {
    // Kalibracja mierzy CZŁOWIEKA, więc znika wszystko, co mogłoby mu pomóc.
    Object.assign(_SCAN.u, {
      kolejnosc: "Y", przebiegi: 1, wyprzedzenie: 0, dociaganie: 0, menuAkcji: false,
      kierunek: "jeden", ruch: "plynny", nawroty: 0, pauzaNaKrancach: 0
    });
  }
  _SCAN.u.powrotPoAkcji = "spoczynek";
  scanSilnikOdswiez(true);
  _SCAN.pola.podepnij(_SCAN.u, _SCAN.w);
  const ile = rodzaj === "kalibracja" ? 7 : (parseInt(document.getElementById("scanCount").value, 10) || 10);
  const b = _SCAN.trening.zacznij(rodzaj, ile, _scanEkran(), {
    opis: rodzaj === "kalibracja" ? "kalibracja"
      : (_SCAN.u.tryb + ", " + (_SCAN.u.ruch === "skokowy" ? _SCAN.u.czasKroku + " ms" : _SCAN.u.predkosc + " px/s"))
  });
  b.predkosc = _SCAN.u.predkosc;
  _SCAN.widok = "trening";
  document.getElementById("scanCard").classList.add("sk-trening");
  RFScan.ui.raport(document.getElementById("scanReport"), null, null, null);
  _scanToast(rodzaj === "kalibracja"
    ? _scanT("Zatrzymaj pasek dokładnie na kresce. 7 prób.", "Stop the bar exactly on the line. 7 tries.")
    : _scanTf("Traf w kółko. {0} celów.", "Hit the circle. {0} targets.", ile));
}

function _scanPoTreningu() {
  if (_scanPrzedTreningiem) {
    Object.assign(_SCAN.u, _scanPrzedTreningiem);
    scanSilnikOdswiez(true);
    _SCAN.pola.podepnij(_SCAN.u, _SCAN.w);
    _scanPrzedTreningiem = null;
  }
  _SCAN.widok = "piaskownica";
  const c = document.getElementById("scanCard");
  if (c) c.classList.remove("sk-trening");
  _scanOdswiezCele();
}

function _scanKoniecTreningu(raport) {
  _scanPoTreningu();
  RFScan.ui.raport(document.getElementById("scanReport"), raport,
    _SCAN.trening.sugestie(raport, _SCAN.u), function (pole, wartosc) {
      _SCAN.u[pole] = wartosc;
      scanSilnikOdswiez(true);
      _SCAN.pola.podepnij(_SCAN.u, _SCAN.w);
      _scanSzacunek();
      scanSave();
    });
  RFScan.ui.historia(document.getElementById("scanHistory"), _SCAN.trening.historia);
}

// ------------------------------------------------------------------------------------------
//  OKNO NAD PULPITEM
// ------------------------------------------------------------------------------------------
function scanOtworzNadPulpitem() {
  if (!_SCAN.enabled) {
    _scanToast(_scanT("Najpierw włącz moduł Skaner (przełącznik w nagłówku).",
      "Switch the Scanner module on first (the toggle in the header)."));
    return;
  }
  fetch("/scan/okno?dev=" + encodeURIComponent(_SCAN.dev || _scanDev()), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ open: true })
  }).then(function (r) { return r.json(); }).then(function (m) {
    if (m && m.ok) {
      /* ⚠️ „Esc zamyka" STAŁO TU DO 15.09 I BYŁO NIEPRAWDĄ. Okno nakładki ma
         `WS_EX_TRANSPARENT`, nigdy nie bierze skupienia i przepuszcza kliknięcia — żaden klawisz
         do niego nie dociera, a nasłuchu Esc nie było nigdzie w aplikacji. Kto uruchomił skaner
         nad pulpitem, nie miał GO CZYM ZGASIĆ (wyłączanie
         nie działało). Teraz karta przestawia się na „Na pulpicie", a wyłącznik stoi w widocznym
         miejscu: przycisk „Zamknij okno nad pulpitem" i sam przełącznik miejsca. */
      if (typeof window.RFScanTlo === "object" && window.RFScanTlo && window.RFScanTlo.ustawGdzie)
        window.RFScanTlo.ustawGdzie("pulpit", "skan");
      // DROGA WYJŚCIA MÓWIONA SKRÓTEM, GDY SKRÓT DZIAŁA (2026-09-15). Przycisk jest w panelu,
      // a skaner uruchamia się PO TO, żeby patrzeć na coś innego — więc nazwa klawiszy jest tu
      // warta więcej niż nazwa przycisku. Gdy skrót jest wyłączony, zostaje zdanie o przycisku;
      // obiecywanie martwych klawiszy byłoby gorsze od milczenia (ta sama zasada, co w rf-39j).
      const wyjscie = (typeof rfScanHotkeyKeys === "function") ? rfScanHotkeyKeys() : null;
      _scanToast(wyjscie
        ? _scanT("Skaner pracuje nad pulpitem. Zamkniesz go skrótem " + wyjscie.join(" + ") + " — także spod gry.",
          "The scanner is working over the desktop. Close it with " + wyjscie.join(" + ") + " — even from under a game.")
        : _scanT("Skaner pracuje nad pulpitem. Zamkniesz go przyciskiem „Zamknij okno nad pulpitem”.",
          "The scanner is working over the desktop. Close it with the “Close the window over the desktop” button."));
      // (nazwy przycisków w obu zdaniach są TAKIE, JAK NA EKRANIE w danym języku — patrz pary
      // „■ Zamknij okno nad pulpitem" i „Uruchom nad pulpitem" w rf-01)
    } else _scanToast((m && m.error) || _scanT("Nie udało się otworzyć okna.", "Could not open the window."));
  }).catch(function () {
    _scanToast(_scanT("Nie udało się porozmawiać z aplikacją.", "Could not reach the application."));
  });
}

/* STOP AWARYJNY WYŁĄCZYŁ SKANER — pokaż to, nie zapisuj (2026-09-15).

   Od 15.09 `Alt+R+F` gasi też ten moduł i zamyka okno nad pulpitem (`panic_stop` w monitorze),
   bo skaner jest jedynym modułem, który KLIKA SAM. Serwer zapisał już plik, więc karta ma tylko
   pokazać stan — POST byłby drugim zapisem tej samej decyzji, a przy okazji odesłałby na serwer
   konfigurację z karty, która o stopie jeszcze nie wie. Lustro `miReflectEnable` z MIDI/OSC. */
function scanReflectEnabled(on) {
  _SCAN.enabled = !!on;
  _scanRysujWlacznik();
  // Okno nad pulpitem zostało zamknięte razem z modułem, więc karta wraca do symulacji od razu,
  // nie po najbliższym odpytaniu stanu (co 5 s).
  if (!on && typeof window.RFScanTlo === "object" && window.RFScanTlo && window.RFScanTlo.ustawGdzie)
    window.RFScanTlo.ustawGdzie("karta");
}

// Wołane przez setTab (rf-34), gdy zakładka staje się widoczna: ramka podglądu dostaje wymiar
// dopiero wtedy, a z niego bierze się cała geometria skanowania.
function scanOnShow() {
  if (!_SCAN.gotowe) { scanInit(); return; }
  // ⚠️ UKŁAD MONITORÓW NAJPIERW. Od 16.09 ramka bierze z niego PROPORCJE, a pokrętła „w pikselach"
  // SKALĘ — dopóki go nie ma, podgląd liczy po staremu i po pierwszej odpowiedzi przeskakuje.
  // Karta pytała dotąd tylko przy budowie i co 10 s, więc wejście na zakładkę po zmianie monitorów
  // pokazywało przez chwilę ramkę w proporcjach poprzedniego ekranu.
  _scanEkranyOdswiez();
  _SCAN.silnik.ustawEkran(_scanEkran());
  _scanOdswiezCele();
  _scanSzacunek();
  // Reguly mogly sie zmienic w Mapowaniu, gdy karta byla schowana.
  if (typeof scanSignalsSync === "function") scanSignalsSync();
  // Przełączenie kapsla w prawej kolumnie ma przenieść kartę na JEGO ustawienia.
  if (_SCAN.dev !== _scanDev()) scanLoad(_scanDev());
}

// ------------------------------------------------------------------------------------------
//  LINIA GOTOWOŚCI (wspólny `rfReady`, rf-28c)
// ------------------------------------------------------------------------------------------
/* Wiersze krótko i bez nawiasów (UX 261120, P-G2-02 c): „Sygnał ustawiony (reguła, która mówi
   skanerowi…)" i „…(sygnał to reguła Mapowania)" łamały linię na trzy, cztery rzędy i spychały
   SYGNAŁ pod krawędź okna. Co to jest sygnał, mówi blok „Czym sterujesz skanerem", do którego
   prowadzi „Ustaw sygnał". Przyciski naprawy mają różne napisy („Włącz Skaner", „Włącz
   Mapowanie"), bo dwa jednakowe „Włącz" obok siebie robiły różne rzeczy. */
if (window.rfReady) rfReady.register({
  id: "rfReadyScan",
  anchor: function () { return rfReady.headOf("skaner"); },
  allOk: ["Skaner jest gotowy: sygnał kapsla przesuwa i zatwierdza wskazanie.",
          "The scanner is ready: the capsule signal moves and confirms the selection."],
  rows: function () {
    const on = typeof _skanModulWlaczony === "function" ? _skanModulWlaczony() : true;
    const sig = typeof _skanReguly === "function"
      ? _skanReguly("scan:sygnal").some(function (r) { return r.enabled !== false; }) : true;
    return [
      {ok: on, pl: "Skaner włączony", en: "The scanner is on",
        fix: {pl: "Włącz Skaner", en: "Turn the scanner on", click: "#scanEnable",
              run: function () { scanSetEnabled(true); }}},
      {ok: sig, pl: "Sygnał ustawiony", en: "A signal is set",
        fix: {pl: "Ustaw sygnał", en: "Set the signal", run: function () {
          // Blok sygnału jest zwijakiem piętra 2: naprawa go otwiera, zanim do niego przewinie.
          const f = document.getElementById("scanSygnalFold");
          if (f) f.open = true;
          rfReady.show("scanSignals");
        }}},
      rfReady.mappingRow(),
      rfReady.armedRow(),
      rfReady.capsuleRow()
    ];
  }
});
