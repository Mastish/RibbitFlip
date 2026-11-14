"use strict";
/* SKANER EKRANU — ZRZUT GRY POD PODGLĄDEM i to, GDZIE OGLĄDA SIĘ OBSZAR.

   SKĄD TO SIĘ WZIĘŁO: użytkownik ma móc wgrać zrzut ekranu (np. główny ekran gry Sol Cesto)
   i na nim ustawić parametry obszaru skanowania, a obok podglądu na zrzucie przełączyć się
   na podgląd na prawdziwym pulpicie: albo podgląd w aplikacji, albo nakładka na cały pulpit.

   CO TO ZMIENIA. Do tej pory ramka podglądu pokazywała UDAWANY pulpit z ikonami, a obszar
   skanowania wpisywało się czterema liczbami na ślepo — sprawdzić je dało się dopiero nad żywą
   grą. Teraz pod ramkę wchodzi prawdziwy zrzut z gry, a prostokąt obszaru wyciąga się po nim
   myszą. Drugi przełącznik przenosi ten sam prostokąt na PRAWDZIWY pulpit (okno nakładki
   w trybie `?podglad=1`), więc da się go przyłożyć do okna gry, a nie tylko do obrazka.

   ⚠️ TEN DRUGI PRZEŁĄCZNIK ZNACZY DZIŚ WIĘCEJ (15.09). Nie wybiera już „gdzie oglądać obrys",
   ale GDZIE JEST SKANER: w symulacji tej karty albo nad pulpitem — jedno albo drugie, nigdy oba
   naraz. Przy „na pulpicie" ramka podglądu schodzi, karta przestawia układ, a przyciski SYGNAŁ /
   Cofnij / Stop jadą do okna nad pulpitem. Powody i pułapki: nota przy `_sktloGdzie`.

   TRZY DECYZJE, KTÓRE WARTO ZNAĆ, ZANIM SIĘ TU COKOLWIEK ZMIENI:

     1. W KONFIGURACJI LEŻY SAMA NAZWA PLIKU (`tlo`), a obraz w `Settings/ScanTla`. Konfiguracja
        jedzie w KAŻDYM zapisie pokrętła (suwak = zapis co 400 ms) i w każdym presecie — zrzut
        w postaci data URL-a znaczyłby setki kilobajtów na każdym z nich.
     2. SKALOWANIE I KOMPRESJA SĄ TUTAJ, nie na serwerze. Obraz i tak jest już w przeglądarce,
        a `canvas` potrafi go zmniejszyć i zapisać jako JPEG; serwer nie musi przez to znać ani
        jednego formatu obrazu (i nie musi mieć do tego biblioteki).
     3. `tlo` JEST POLEM PŁASKIM, czyli należy do SEKCJI. Plansza gry i jej menu opcji to dwa
        różne ekrany; nowa sekcja powstaje jako kopia aktywnej, więc zrzut jedzie z nią za darmo.

   Ten plik jest osobny, bo `rf-50d-scan-card.js` ma już ponad 700 linii — patrz reguła
   organizacji plików JS. Wpina się w kartę przez trzy wywołania po nazwie (`scanTloInit`,
   `scanTloSync`) i korzysta z jej globali (`_SCAN`, `_scanRamka`, `scanSave`). */

/* Stan TEGO modułu — świadomie osobno od `_SCAN`, bo nic z tego nie jedzie do serwera:
   `gdzie` to wybór człowieka na czas sesji, reszta to uchwyty do DOM-u i do przeciągania. */
const _SKTLO = {
  gotowe: false,
  gdzie: "karta",        // karta | pulpit — GDZIE JEST SKANER (patrz nota przy `_sktloGdzie`)
  tryb: "",              // "" | podglad | skan — co stoi nad pulpitem, wg serwera
  wgrywa: false,
  brakPliku: false,      // nazwa zrzutu jest, ale pliku na tym komputerze nie ma
  proporcje: 0,          // szerokość/wysokość wgranego obrazu — ramka podglądu bierze je na siebie
  hBaza: 0,              // sufit wysokości ramki (`_sktloSufit`); wyżej niż to nie rośniemy nigdy
  ciagnie: null,         // {x0,y0,x1,y1} w pikselach okna, gdy człowiek wyciąga prostokąt
  zaznaczenie: null,     // <div> gumki
  obserwator: null
};

const _SKTLO_BOK = 1920;     // dłuższy bok zrzutu po przeskalowaniu — tyle ma pełne HD
const _SKTLO_JAKOSC = 0.86;  // JPEG: przy tej jakości zrzut interfejsu gry waży 150–400 kB

// ------------------------------------------------------------------------------------------
//  WEJŚCIE Z KARTY
// ------------------------------------------------------------------------------------------
function scanTloInit() {
  if (_SKTLO.gotowe || !document.getElementById("scanStage")) return;
  _SKTLO.gotowe = true;

  const wgraj = document.getElementById("scanTloWgraj");
  if (wgraj) wgraj.addEventListener("click", _sktloWybierzPlik);
  /* „ZDEJMIJ ZRZUT" = ZDEJMIJ SAM OBRAZ, zostaw planszę (20.09). Do 20.09 ten przycisk znaczył
     „wróć do piaskownicy", czyli dokładnie to, co dziś robi pigułka „Pulpit testowy" — a dwa
     przyciski na to samo to jeden za dużo. Teraz zdejmuje obrazek z wybranej planszy: zostaje
     nazwa i przypisane skanery, czyli grupa, i wgranie innego zrzutu nie każe niczego odtwarzać.
     ⚠️ Od 21.09 znika przy tym także PLIK z `Settings/ScanTla` — o ile nikt inny na niego nie
     wskazuje (`scan_tlo_sprzataj` po stronie serwera). Dotyczy to drogi przez spis plansz; gałąź
     niżej, dla konfiguracji sprzed spisu, zostawia plik tak jak dotąd. */
  const usun = document.getElementById("scanTloUsun");
  if (usun) usun.addEventListener("click", function () {
    const c = _SCAN.u || {};
    const lista = Array.isArray(c.zrzuty) ? c.zrzuty : [];
    const n = parseInt(c.zrzutAktywny, 10) || 0;
    if (n >= 1 && n <= lista.length && lista[n - 1].plik && typeof scanZrzutZdejmij === "function")
      return void scanZrzutZdejmij(n);
    _sktloUstaw("");                 // konfiguracja sprzed spisu plansz: zostaje samo pole `tlo`
  });

  const seg = document.getElementById("scanGdzie");
  if (seg) seg.addEventListener("click", function (ev) {
    const b = ev.target.closest("[data-gdzie]");
    if (b) _sktloGdzie(b.getAttribute("data-gdzie"));
  });

  // WYŁĄCZNIK OKNA NAD PULPITEM — ten, którego do 15.09 nie było w ogóle (komunikat obiecywał
  // „Esc zamyka", a okno nie bierze skupienia, więc żaden klawisz do niego nie dociera).
  const zam = document.getElementById("scanPilotZamknij");
  if (zam) zam.addEventListener("click", function () { _sktloGdzie("karta"); });

  // PRZYCISKU „✥ Ustaw obszar myszą" TU NIE MA OD 16.09 — ustawianie obszaru jest teraz WŁĄCZONE
  // przez cały czas, gdy skaner stoi na pulpicie (patrz `_sktloOtworzNaPulpicie`).

  _sktloPodepnijPodglad();
  _sktloStanOkna();
  // Okno nakładki potrafi zniknąć bez naszego udziału (zamknięte z paska zadań, ubity proces
  // przeglądarki), a przełącznik ma mówić, jak JEST. Pytanie jest tanie i idzie tylko wtedy,
  // gdy karta stoi na wierzchu.
  setInterval(function () { if (_scanWidoczna()) _sktloStanOkna(); }, 5000);
  scanTloSync();
  _sktloUklad();
  /* Uchwyt dla harnessu (`tests/scan_tlo_harness.mjs`) i dla konsoli. `ustawGdzie` przestawia
     SAM UKŁAD, bez dotykania serwera — bo prawdziwe przełączenie otwiera OKNO NA CAŁY PULPIT
     użytkownika, a test ma sprawdzić, czy karta się przestawia, nie czy Windows umie pokazać
     okno (tryb okna testuje się adresem `?podglad=1`, patrz nota w rf-50h). */
  window.RFScanTlo = {
    stan: _SKTLO,
    ustawGdzie: function (gdzie, tryb) {
      _SKTLO.gdzie = (gdzie === "pulpit") ? "pulpit" : "karta";
      _SKTLO.tryb = _SKTLO.gdzie === "pulpit" ? (tryb || "podglad") : "";
      _sktloRysujSegment();
      _sktloUklad();
    }
  };
}

/* Zrzut zmienił się razem z konfiguracją: inny kapsel, wczytany preset, przełączona sekcja.
   Woła to `scanCfgArrived` — jedyne miejsce, przez które przechodzi każda z tych dróg. */
/* KTÓRY ZRZUT LEŻY POD PODGLĄDEM (16.09).

   Od wprowadzenia EKRANÓW (rf-50n) zrzut należy do ekranu, a nie do skanera: jeden ekran niesie
   kilka skanerów, a ten sam skaner bywa na kilku ekranach. Pod ramką leży więc zrzut ekranu
   WYBRANEGO, a nie pole `tlo` edytowanej sekcji.
   ⚠️ `tlo` zostaje jako odpowiedź zapasowa — czytają je starsze wersje aplikacji i z niego bierze
   się migracja spisu ekranów po stronie serwera (`_zrzuty_out`). Dopóki spisu nie ma (konfiguracja
   sprzed zmiany, pierwsze sekundy po starcie), podgląd zachowuje się dokładnie jak wcześniej. */
function _sktloNazwa() {
  const z = (typeof scanZrzutAktualny === "function") ? scanZrzutAktualny() : null;
  if (z && z.plik) return z.plik;
  const c = _SCAN.u || {};
  return (Array.isArray(c.zrzuty) && c.zrzuty.length) ? "" : (c.tlo || "");
}

function scanTloSync() {
  const warstwa = document.getElementById("scanTlo");
  const stage = document.getElementById("scanStage");
  if (!warstwa || !stage) return;
  const nazwa = _sktloNazwa();
  if (warstwa.getAttribute("data-plik") !== nazwa) {
    warstwa.setAttribute("data-plik", nazwa);
    warstwa.style.backgroundImage = "";
    stage.classList.remove("sk-ma-tlo");
    _SKTLO.brakPliku = false;
    if (nazwa) {
      /* ⚠️ ZRZUTU MOŻE NIE BYĆ. Preset niesie NAZWĘ pliku, a plik leży w `Settings/ScanTla` tej
         maszyny — zestaw od kogoś innego (albo skasowany katalog) da nazwę bez obrazu. Gdyby
         piaskownica chowała się „w ciemno", człowiek zobaczyłby PUSTĄ ramkę i nie miałby jak
         zgadnąć, dlaczego. Dlatego najpierw próbujemy wczytać, a dopiero potem chowamy pulpit. */
      const url = "/scan/tlo?plik=" + encodeURIComponent(nazwa);
      const probny = new Image();
      probny.onload = function () {
        if (_sktloNazwa() !== nazwa) return;   // w międzyczasie zmienił się ekran albo sekcja
        warstwa.style.backgroundImage = 'url("' + url + '")';
        stage.classList.add("sk-ma-tlo");
        // Proporcje BIERZEMY Z OBRAZU, nie z układu monitorów: zrzut całego ekranu ma proporcje
        // tego ekranu, a gdy ktoś wgra kadr o innych — i tak chcemy pokazać go bez zniekształcenia.
        _SKTLO.proporcje = (probny.naturalWidth && probny.naturalHeight)
          ? (probny.naturalWidth / probny.naturalHeight) : 0;
        _sktloUstawRamke();
        _scanOdswiezCele();      // zrzut zakrywa ikony piaskownicy — przestają być celami
        _sktloOpis();
      };
      probny.onerror = function () {
        if (_sktloNazwa() !== nazwa) return;
        _SKTLO.brakPliku = true;
        _sktloOpis();
      };
      probny.src = url;
    }
  }
  _sktloUstawRamke();
  _sktloOpis();
  _sktloRysujSegment();
}

// ------------------------------------------------------------------------------------------
//  GDZIE LEŻY ZRZUT
// ------------------------------------------------------------------------------------------
/* BAZA OBSZARU w pikselach okna — czyli ten kawałek ramki podglądu, który udaje ekran, z którego
   liczą się procenty. Od 16.09 to ZAWSZE CAŁA RAMKA, bo ramka reprezentuje bazę obszaru: wybrany
   monitor albo cały pulpit (patrz `scanBazaPulpitu` i `scanEkranyPodgladu` w rf-50d). Wcześniej
   ramka udawała cały pulpit także wtedy, gdy skaner pracował na jednym monitorze — zrzut gry
   siadał wtedy na wycinku ramki i na dwóch ekranach zajmował jej połowę.
   Zrzut kładziemy dokładnie na bazie, więc „50% szerokości" na obrazku znaczy to samo, co „50%"
   w polach obszaru. */
function _sktloBaza() {
  return _scanRamka();
}

/* RAMKA PODGLĄDU DOSTAJE PROPORCJE EKRANU, KTÓRY UDAJE (16.09).

   Ekrany współdzielą podgląd i rozdzielczość (albo proporcje), bo inaczej nie ma to sensu.
   Wcześniej wysokość brała się z arkusza (520 px), a po wgraniu
   zrzutu z proporcji OBRAZU. Jedno i drugie kłamało: prostokąt obszaru liczy się w ułamkach bazy,
   więc kwadrat na ekranie robił się w ramce prostokątem — i odwrotnie.

   Teraz proporcje idą z BAZY (wybrany monitor albo cały pulpit), a zrzut leży na niej „na styk".
   Proporcje obrazu zostają jako zapasowa odpowiedź na czas, zanim serwer powie, jak stoją monitory.
   ⚠️ Gdy zrzut ma inne proporcje niż baza, jest rozciągany — i wtedy podpis pod ramką mówi wprost,
   że wybór monitora w „Gdzie skaner ma działać" to naprawi (patrz `_sktloOpis`).
   ⚠️ Ramka może tylko ZMALEĆ względem sufitu (`_SKTLO.hBaza`, liczony w `_sktloSufit`). Wyższa nie zmieściłaby
   się w przyklejonej kolumnie razem z paskami przycisków — a wtedy SYGNAŁ zjeżdża pod krawędź
   okna (patrz nota przy `.sk-stage` w 26-scan.css). */
function _sktloProporcjeBazy() {
  if (typeof scanBazaPulpitu !== "function") return 0;
  const b = scanBazaPulpitu();
  return (b && b.w > 0 && b.h > 0) ? (b.w / b.h) : 0;
}

/* SUFIT WYSOKOŚCI: RAMKA NA CAŁĄ SZEROKOŚĆ KOLUMNY (2026-11-21). Wcześniej sufit liczył się od
   miejsca, w którym ramka stoi w dokumencie na starcie, żeby SYGNAŁ mieścił się w pierwszym widoku.
   Nad ramką stoją jednak linia gotowości i pasek presetu, więc przy 1440×900 podgląd miał 475×297,
   a przy 1280×720 tylko 256×160, czyli był za mały, żeby na nim cokolwiek trafić. Teraz ramka
   bierze szerokość kolumny, a sufit pilnuje tylko tego, żeby PRZYKLEJONA kolumna (po przewinięciu
   stoi pod `--rf-sticky-top`) mieściła ramkę razem z paskiem stanu i paskami przycisków. Na starcie
   SYGNAŁ może więc stać pod krawędzią okna; jedno przewinięcie i kolumna staje cała.
   720 px to sufit (wyższa ramka nic nie daje). 160 px to podłoga: tempo paska liczy się w skali
   ramki (`scanUstawieniaPodgladu`), więc niższa ramka nie przyspiesza przejazdu, a udawany pulpit
   maleje razem z nią (rf-50e, `--pu-k`). */
const _SKTLO_MAX = 720, _SKTLO_MIN = 160;
function _sktloSufit(stage) {
  const lewa = stage.parentNode;
  if (!lewa || !lewa.getBoundingClientRect) return _SKTLO_MAX;
  const r = stage.getBoundingClientRect();
  // Gdzie kolumna staje po przewinięciu: `top` lepkiej kolumny, plus to, co w niej stoi nad ramką.
  const lepka = parseFloat(getComputedStyle(lewa).top);
  const gora = (isNaN(lepka) ? 166 : lepka) + Math.max(0, r.top - lewa.getBoundingClientRect().top);
  // Pod ramką oba paski: SYGNAŁ z Cofnij i Stop oraz wybór planszy.
  const bary = lewa.querySelectorAll(".sk-bar");
  const bar = bary.length ? bary[bary.length - 1] : null;
  const pod = bar ? Math.max(0, bar.getBoundingClientRect().bottom - r.bottom) : 100;
  const wolne = window.innerHeight - gora - pod - 10;
  return Math.max(_SKTLO_MIN, Math.min(_SKTLO_MAX, Math.round(wolne)));
}

function _sktloWysokosc(stage, szerokosc) {
  _SKTLO.hBaza = _sktloSufit(stage);
  const prop = _sktloProporcjeBazy() || _SKTLO.proporcje;
  if (!szerokosc) return 0;
  if (!prop) return _SKTLO.hBaza;
  // 160 px to podłoga na wypadek bardzo szerokiego pulpitu (trzy monitory w rzędzie): niżej ramka
  // przestaje być podglądem. Powyżej niej proporcje są dokładne.
  return Math.max(160, Math.min(_SKTLO.hBaza, Math.round(szerokosc / prop)));
}

/* …i moduł, w którym karta stoi: linia gotowości i pasek presetu nad kartą zmieniają wysokość
   (przybywa albo ubywa warunków), a z nimi miejsce, w którym ramka zaczyna się w oknie. Podpinamy
   go leniwie, bo kartę buduje się, zanim rama modułu (rf-49m) włoży ją na miejsce. */
function _sktloObserwujModul(stage) {
  if (_SKTLO.modul || !_SKTLO.obserwator) return;
  const mod = stage.closest(".rfpc");
  if (!mod) return;
  _SKTLO.modul = mod;
  try { _SKTLO.obserwator.observe(mod); } catch (e) { }
}

function _sktloUstawRamke() {
  const warstwa = document.getElementById("scanTlo");
  if (!warstwa) return;
  const stage = document.getElementById("scanStage");
  if (stage) _sktloObserwujModul(stage);
  if (stage) {
    /* Wysokość ustawiamy ZAWSZE, nie tylko pod zrzutem: piaskownica też udaje ten ekran, a pasek
       po niej jedzie z tą samą skalą, co nad pulpitem.

       ⚠️ GDY WYSOKOŚĆ JEST OBCIĘTA, ZWĘŻAMY RAMKĘ — inaczej proporcje znów zaczynają kłamać.
       Sufit wysokości (`_SKTLO.hBaza`, przy niskim oknie nawet 330 px) jest po to, żeby przyklejona
       kolumna zmieściła się razem z paskami przycisków; przy szerokiej kolumnie oznaczał jednak,
       że ramka robi się szersza niż ekran, który udaje. Teraz w takim wypadku ramka traci szerokość
       i staje na środku kolumny (`margin-inline:auto` w arkuszu).
       ⚠️ Dostępną szerokość mierzymy z RODZICA, nie z samej ramki: ramka ma już nadaną szerokość
       z poprzedniego przebiegu, a `ResizeObserver` woła nas po każdej zmianie jej rozmiaru — pomiar
       „po sobie" zwężałby ją krok po kroku przy każdym odświeżeniu. */
    const rodzic = stage.parentNode;
    const dost = rodzic && rodzic.clientWidth ? rodzic.clientWidth : stage.getBoundingClientRect().width;
    const prop = _sktloProporcjeBazy() || _SKTLO.proporcje;
    const h = _sktloWysokosc(stage, dost);
    let w = 0;
    if (h && prop) {
      const pelna = Math.round(h * prop);
      if (pelna < dost - 1) w = pelna;      // wysokość obcięta sufitem → ramka węższa niż kolumna
    }
    const chceH = h ? (h + "px") : "";
    const chceW = w ? (w + "px") : "";
    if (stage.style.height !== chceH) stage.style.height = chceH;
    if (stage.style.width !== chceW) stage.style.width = chceW;
  }
  const r = _scanRamka(), b = _sktloBaza();
  // Warstwa siedzi WEWNĄTRZ ramki (`position:absolute`), więc liczymy względem jej lewego górnego
  // rogu. Bez tego przy jednym monitorze nic by nie było widać różnicy, a przy dwóch zrzut
  // wylądowałby o szerokość pulpitu za daleko.
  warstwa.style.left = Math.round(b.x - r.x) + "px";
  warstwa.style.top = Math.round(b.y - r.y) + "px";
  warstwa.style.width = Math.max(0, Math.round(b.w)) + "px";
  warstwa.style.height = Math.max(0, Math.round(b.h)) + "px";
}

// ------------------------------------------------------------------------------------------
//  WGRYWANIE ZRZUTU
// ------------------------------------------------------------------------------------------
function _sktloWybierzPlik() {
  const i = document.createElement("input");
  i.type = "file";
  i.accept = "image/png,image/jpeg,image/webp";
  i.addEventListener("change", function () {
    if (i.files && i.files[0]) _sktloZPliku(i.files[0]);
  });
  i.click();
}

/* Plik → obraz → zmniejszony JPEG → serwer. Trzy drogi prowadzą tutaj: przycisk, upuszczenie
   pliku na podgląd i wklejenie ze schowka (Win+Shift+S, potem Ctrl+V — tak robi się zrzut gry). */
function _sktloZPliku(plik) {
  if (!plik || !/^image\//.test(plik.type || "")) {
    _scanToast(_scanT("To nie jest obraz.", "That is not an image."));
    return;
  }
  if (_SKTLO.wgrywa) return;
  _SKTLO.wgrywa = true;
  _sktloOpis();
  const czytacz = new FileReader();
  czytacz.onerror = function () { _SKTLO.wgrywa = false; _sktloBlad(_scanT("Nie udało się odczytać pliku.", "Could not read the file.")); };
  czytacz.onload = function () {
    _sktloPrzeskaluj(String(czytacz.result || ""), function (dataUrl, blad, wym) {
      if (blad) { _SKTLO.wgrywa = false; _sktloBlad(blad); return; }
      _sktloWyslij(dataUrl, plik.name || "zrzut", wym);
    });
  };
  czytacz.readAsDataURL(plik);
}

/* Zmniejszenie do 1920 px dłuższego boku i zapis jako JPEG. Zrzut jest PODKŁADKĄ DO CELOWANIA,
   a nie materiałem do oglądania w powiększeniu — 1920 px wystarcza z zapasem, bo ramka podglądu
   ma kilkaset pikseli. Proporcje zostają nietknięte: obraz kładzie się na bazie „na styk", więc
   rozciągnięcie o kilka procent przesunęłoby wszystko, co się na nim wyznacza. */
function _sktloPrzeskaluj(dataUrl, done) {
  const img = new Image();
  img.onerror = function () { done(null, _scanT("Nie udało się otworzyć tego obrazu.", "Could not open that image.")); };
  img.onload = function () {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return done(null, _scanT("Obraz jest pusty.", "The image is empty."));
    /* ROZDZIELCZOŚĆ MIERZYMY TUTAJ, PRZED ZMNIEJSZENIEM (20.09). Plik jedzie na dysk skrócony do
       1920 px dłuższego boku, więc po zapisie prawdziwego rozmiaru nie da się już odczytać —
       a to on mówi, z jakiego ekranu pochodzi widok gry. Zgłoszenie: „każdy ekran powinien mieć
       też info o rozdzielczości ekranu (czy też screena)". */
    const wymiar = { w: w, h: h };
    const skala = Math.min(1, _SKTLO_BOK / Math.max(w, h));
    const pl = document.createElement("canvas");
    pl.width = Math.max(1, Math.round(w * skala));
    pl.height = Math.max(1, Math.round(h * skala));
    const ctx = pl.getContext("2d");
    ctx.drawImage(img, 0, 0, pl.width, pl.height);
    let out = "";
    try { out = pl.toDataURL("image/jpeg", _SKTLO_JAKOSC); } catch (e) { out = ""; }
    if (!out || out.indexOf("data:image/jpeg") !== 0)
      return done(null, _scanT("Nie udało się przygotować zrzutu.", "Could not prepare the screenshot."));
    done(out, null, wymiar);
  };
  img.src = dataUrl;
}

function _sktloWyslij(dataUrl, nazwa, wymiar) {
  fetch("/scan/tlo?dev=" + encodeURIComponent(_scanDev()), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: dataUrl, nazwa: nazwa })
  }).then(function (r) { return r.json(); }).then(function (j) {
    _SKTLO.wgrywa = false;
    if (!j || !j.ok || !j.plik) return _sktloBlad((j && j.error) || _scanT("Serwer odmówił.", "The server refused."));
    _sktloUstaw(j.plik, wymiar);
    _scanToast(_scanT("Plansza wgrana — przeciągnij po niej, żeby wyznaczyć obszar.",
      "View loaded — drag across it to set the area."));
  }).catch(function () {
    _SKTLO.wgrywa = false;
    _sktloBlad(_scanT("Nie udało się porozmawiać z aplikacją.", "Could not reach the application."));
  });
}

function _sktloBlad(tekst) { _sktloOpis(); _scanToast(tekst); }

/* Zapis nazwy zrzutu pod klucz `tlo` — tą samą drogą, co każde pokrętło panelu: do `_SCAN.u`,
   potem `scanSave()`. Nie ma tu osobnego wejścia w serwerze, bo to jest ustawienie sekcji. */
function _sktloUstaw(nazwa, wymiar) {
  if (!_SCAN.u) return;
  /* WGRANY ZRZUT ZAKŁADA PLANSZĘ (16.09). Ten sam plik wgrany drugi raz nie mnoży plansz — serwer
     rozpoznaje go po nazwie (skrót treści) i po prostu wybiera tę, która już jest. Nowa plansza
     zaczyna z edytowanym skanerem, bo po to się zrzut wgrywa. Rozmiar jedzie razem z nią: zmierzył
     go `_sktloPrzeskaluj` na ORYGINALE, zanim plik został skrócony do 1920 px. */
  if (nazwa && typeof scanZrzutDodaj === "function") {
    scanZrzutDodaj(String(nazwa), "", (wymiar && wymiar.w) || 0, (wymiar && wymiar.h) || 0);
    return;
  }
  _SCAN.u.tlo = String(nazwa || "");
  /* ⚠️ ZNACZNIK TRZEBA ZGASIĆ. `scanTloSync` wczytuje obraz tylko wtedy, gdy nazwa RÓŻNI SIĘ od
     tej, którą warstwa już ma — inaczej przerysowywałaby się przy każdym zapisie pokrętła. Ale
     nazwa niesie skrót TREŚCI, więc wgranie tego samego zrzutu drugi raz daje tę samą nazwę; bez
     tej linijki „wgraj go jeszcze raz" (nasza własna rada, gdy pliku brakuje) nie robiło NIC. */
  const w = document.getElementById("scanTlo");
  if (w) w.setAttribute("data-plik", " ");
  if (typeof scanSilnikOdswiez === "function") scanSilnikOdswiez(false);
  scanTloSync();
  scanSave();
}

// ------------------------------------------------------------------------------------------
//  UPUSZCZENIE, WKLEJENIE, WYCIĄGANIE PROSTOKĄTA
// ------------------------------------------------------------------------------------------
function _sktloPodepnijPodglad() {
  const stage = document.getElementById("scanStage");
  if (!stage) return;

  ["dragenter", "dragover"].forEach(function (n) {
    stage.addEventListener(n, function (ev) {
      if (!_sktloNiesieObraz(ev.dataTransfer)) return;
      ev.preventDefault();
      // `copy`, nie `move`: z Eksploratora ma zostać kopia, a nie zniknąć plik.
      try { ev.dataTransfer.dropEffect = "copy"; } catch (e) { }
      stage.classList.add("sk-tlo-celuje");
    });
  });
  ["dragleave", "dragend"].forEach(function (n) {
    stage.addEventListener(n, function () { stage.classList.remove("sk-tlo-celuje"); });
  });
  stage.addEventListener("drop", function (ev) {
    if (!_sktloNiesieObraz(ev.dataTransfer)) return;
    ev.preventDefault();
    stage.classList.remove("sk-tlo-celuje");
    const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (f) _sktloZPliku(f);
  });

  /* WKLEJENIE ZE SCHOWKA. Windows robi zrzut wycinkiem (Win+Shift+S) prosto do schowka, więc bez
     tego trzeba by go najpierw zapisać jako plik. Nasłuch jest na dokumencie, ale reaguje TYLKO
     przy widocznej karcie skanera i poza polami tekstowymi — inaczej wklejenie nazwy presetu
     w Bibliotece podmieniałoby tło. */
  document.addEventListener("paste", function (ev) {
    if (!_scanWidoczna()) return;
    const a = document.activeElement;
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return;
    const el = (ev.clipboardData && ev.clipboardData.items) || [];
    for (let i = 0; i < el.length; i++) {
      if (el[i].kind === "file" && /^image\//.test(el[i].type || "")) {
        const f = el[i].getAsFile();
        if (f) { ev.preventDefault(); _sktloZPliku(f); return; }
      }
    }
  });

  // WYCIĄGANIE PROSTOKĄTA OBSZARU. Pointer, nie mouse: ten sam kod obsługuje rysik i palec.
  stage.addEventListener("pointerdown", _sktloCiagnijStart);

  /* Ramka podglądu zmienia rozmiar przy zwężeniu okna i przy przyklejaniu kolumny, a zrzut ma
     zostać na swoim miejscu. ResizeObserver zamiast `resize`, bo zmienia ją też sam układ strony.

     ⚠️ OBSERWUJEMY TAKŻE RODZICA (`.sk-lewa`), I TO JEST NAPRAWA BŁĘDU Z 21.09. Obserwator na
     samej ramce jest GŁUCHY na zwężenie kolumny dokładnie wtedy, gdy najbardziej trzeba go
     usłyszeć: przy obciętej sufitem wysokości ramka ma JAWNĄ szerokość w pikselach (patrz
     `_sktloUstawRamke`), więc rozwinięcie paneli bocznych zwęża kolumnę, a rozmiar ramki się nie
     zmienia — obserwator milczy, przeliczenie nie biegnie i ramka zostaje szersza niż kolumna,
     malując po pokrętłach po prawej. `_sktloUstawRamke` i tak mierzy dostępną szerokość
     z rodzica, więc to jego zmiana jest właściwym sygnałem.
     (Drugą połową naprawy jest `max-width: 100%` na `.sk-stage` w 26-scan.css.) */
  if (typeof ResizeObserver === "function") {
    _SKTLO.obserwator = new ResizeObserver(function () {
      // Zabezpieczenie przed nawrotem: przeliczenie zmienia WYSOKOŚĆ ramki, a ta zmienia wysokość
      // rodzica, którego właśnie obserwujemy. Przypisania w `_sktloUstawRamke` są warunkowe, więc
      // druga tura i tak nic by nie zmieniła — ale bez tej flagi przeglądarka potrafi zgłosić
      // „ResizeObserver loop", czyli błąd w konsoli za poprawne zachowanie.
      if (_SKTLO.ramkaBiegnie) return;
      _SKTLO.ramkaBiegnie = true;
      try { _sktloUstawRamke(); } finally { _SKTLO.ramkaBiegnie = false; }
    });
    try { _SKTLO.obserwator.observe(stage); } catch (e) { }
    try { if (stage.parentNode) _SKTLO.obserwator.observe(stage.parentNode); } catch (e) { }
  }
  window.addEventListener("resize", _sktloUstawRamke);
  // Zapas na zmiany, których żaden obserwator nie słyszy: doczytana czcionka, linia gotowości
  // przerysowana bez zmiany wysokości modułu w chwili pomiaru. Tani odczyt dwa razy na sekundę
  // i tylko przy widocznej ramce; przeliczenie dopiero przy różnicy sufitu.
  if (!_SKTLO.straz) _SKTLO.straz = setInterval(function () {
    const st = document.getElementById("scanStage");
    if (!st || !st.offsetParent || _SKTLO.ramkaBiegnie) return;
    if (Math.abs(_sktloSufit(st) - (_SKTLO.hBaza || 0)) > 2) _sktloUstawRamke();
  }, 500);
}

function _sktloNiesieObraz(dt) {
  if (!dt) return false;
  const t = dt.types || [];
  for (let i = 0; i < t.length; i++) if (t[i] === "Files") return true;
  return false;
}

/* Przeciągnięcie po podglądzie = nowy obszar. Zwykłe kliknięcie zostaje kliknięciem
   w piaskownicy (obsługuje je rf-50d), bo gumka startuje dopiero po kilku pikselach ruchu.

   ZAZNACZENIE NIE WYCHODZI POZA ZRZUT . Objaw: po wgraniu zrzutu dało się
   zaznaczać obszar poza nim. Myszy nikt nie zatrzymuje na
   krawędzi ramki, a nasłuch ruchu siedzi na OKNIE (musi — inaczej szybkie przeciągnięcie gubiłoby
   się przy pierwszym wyjściu poza podgląd), więc prostokąt jechał za kursorem przez pół strony.
   Widać z tego było tyle, ile mieściło się w ramce (`.sk-stage` ma `overflow:hidden`), a zapis
   i tak przycinał liczby do 0…100% — czyli człowiek dostawał obszar INNY niż narysowany i nikt
   mu tego nie mówił. Teraz przycinamy sam prostokąt do BAZY, czyli do tego kawałka ramki, na
   którym leży zrzut: gumka staje na krawędzi obrazu i to, co widać, jest tym, co się zapisze. */
function _sktloCiagnijStart(ev) {
  if (ev.button !== 0 || !_SCAN.u) return;
  if (_SCAN.widok !== "piaskownica") return;            // trening ma własne kliknięcia w cele
  if (_SCAN.silnik && _SCAN.silnik.faza !== "spoczynek" && _SCAN.silnik.faza !== "gotowe") return;
  const r = _scanRamka(), b = _sktloBaza();
  // Naciśnięcie POZA zrzutem nie zaczyna zaznaczania. Przy jednym monitorze baza to cała ramka,
  // więc nic się nie zmienia; przy wybranym ekranie zrzut zajmuje jej wycinek, a pasek obok niego
  // należy do innego monitora — ciągnięcie stamtąd dawało prostokąt przyklejony do krawędzi.
  if (b.w > 1 && b.h > 1 &&
      (ev.clientX < b.x || ev.clientX > b.x + b.w || ev.clientY < b.y || ev.clientY > b.y + b.h)) return;
  _SKTLO.ciagnie = { x0: ev.clientX, y0: ev.clientY, x1: ev.clientX, y1: ev.clientY, ruszyl: false, r: r, b: b };
  window.addEventListener("pointermove", _sktloCiagnijRuch);
  window.addEventListener("pointerup", _sktloCiagnijKoniec);
}

/* Prostokąt gumki PRZYCIĘTY do zrzutu. Surowe `x0…y1` zostają nietknięte, bo to po nich liczy się
   próg „ruszył" — gdyby przycinać je w locie, przeciągnięcie zaczęte przy samej krawędzi i idące
   na zewnątrz nigdy nie przekroczyłoby sześciu pikseli i wyglądałoby na zawieszone. */
function _sktloProstokat(c) {
  const b = (c.b && c.b.w > 1 && c.b.h > 1) ? c.b : _sktloBaza();
  const tnij = function (v, od, dl) { return Math.max(od, Math.min(od + dl, v)); };
  return {
    b: b,
    x1: tnij(Math.min(c.x0, c.x1), b.x, b.w), x2: tnij(Math.max(c.x0, c.x1), b.x, b.w),
    y1: tnij(Math.min(c.y0, c.y1), b.y, b.h), y2: tnij(Math.max(c.y0, c.y1), b.y, b.h)
  };
}

function _sktloCiagnijRuch(ev) {
  const c = _SKTLO.ciagnie;
  if (!c) return;
  c.x1 = ev.clientX; c.y1 = ev.clientY;
  if (!c.ruszyl && Math.abs(c.x1 - c.x0) < 6 && Math.abs(c.y1 - c.y0) < 6) return;
  c.ruszyl = true;
  ev.preventDefault();
  _sktloRysujGumke(c);
}

function _sktloCiagnijKoniec() {
  const c = _SKTLO.ciagnie;
  _SKTLO.ciagnie = null;
  window.removeEventListener("pointermove", _sktloCiagnijRuch);
  window.removeEventListener("pointerup", _sktloCiagnijKoniec);
  _sktloSchowajGumke();
  if (!c || !c.ruszyl) return;
  /* PO PRZECIĄGNIĘCIU POŁKNIJ KLIKNIĘCIE. Przeglądarka po `pointerup` wysyła jeszcze `click`
     do wspólnego przodka obu końców — a w piaskownicy (gdy zrzutu nie ma) kończyłoby się to
     wpisem „kliknięto Kosz" w dzienniku tuż po wyznaczeniu obszaru. Faza przechwytywania, bo
     nasłuch piaskownicy siedzi niżej. */
  const polknij = function (ev) { ev.stopPropagation(); zdejmij(); };
  const zdejmij = function () { window.removeEventListener("click", polknij, true); };
  window.addEventListener("click", polknij, true);
  // ⚠️ Bramka na czas, nie `once`. Gdyby po przeciągnięciu kliknięcie NIE przyszło (a nie przyjdzie,
  // gdy człowiek puści przycisk poza stroną), nasłuch z `once` czekałby na następne — czyli połknął
  // by prawdziwy klik w zupełnie innym miejscu panelu, i to kilka minut później.
  setTimeout(zdejmij, 300);
  _sktloZapiszObszar(c);
}

function _sktloRysujGumke(c) {
  const stage = document.getElementById("scanStage");
  if (!stage) return;
  if (!_SKTLO.zaznaczenie || !_SKTLO.zaznaczenie.parentNode) {
    const d = document.createElement("div");
    d.className = "sk-gumka";
    stage.appendChild(d);
    _SKTLO.zaznaczenie = d;
  }
  const r = c.r, p = _sktloProstokat(c);
  const st = _SKTLO.zaznaczenie.style;
  st.display = "block";
  st.left = Math.round(p.x1 - r.x) + "px";
  st.top = Math.round(p.y1 - r.y) + "px";
  st.width = Math.round(p.x2 - p.x1) + "px";
  st.height = Math.round(p.y2 - p.y1) + "px";
}

function _sktloSchowajGumke() {
  if (_SKTLO.zaznaczenie) _SKTLO.zaznaczenie.style.display = "none";
}

/* Prostokąt z ekranu → cztery liczby konfiguracji. Przez UŁAMKI BAZY, nigdy przez piksele ramki:
   ramka ma kilkaset pikseli, a ekran kilka tysięcy, więc piksel ramki to nie jest żadna jednostka.
   Jednostki NIE PRZESTAWIAMY — kto pracuje w pikselach gry, ma dostać piksele. */
function _sktloZapiszObszar(c) {
  const p = _sktloProstokat(c), b = p.b;
  if (!(b.w > 1 && b.h > 1)) return;
  const u = _SCAN.u;
  // Prostokąt jest już przycięty do zrzutu (patrz `_sktloProstokat`), więc `ul` tylko przelicza
  // go na ułamki bazy. Zostawiamy tu jednak widełki 0…1: `_sktloProstokat` liczy z bazy ŚWIEŻEJ,
  // a `c.b` pochodzi sprzed przeciągnięcia — gdyby ramka w międzyczasie zmieniła rozmiar, ułamek
  // wyszedłby minimalnie poza zakres i pola „od–do" pokazałyby 100,4%.
  const ul = function (v, od, dl) { return Math.max(0, Math.min(1, (v - od) / dl)); };
  let fx1 = ul(p.x1, b.x, b.w), fx2 = ul(p.x2, b.x, b.w);
  let fy1 = ul(p.y1, b.y, b.h), fy2 = ul(p.y2, b.y, b.h);
  // Prostokąt bez powierzchni serwer i tak odrzuci (wraca wtedy cały ekran), więc mówimy o tym
  // od razu — i nie ruszamy tego, co człowiek miał ustawione.
  if (fx2 - fx1 < 0.01 || fy2 - fy1 < 0.01) {
    _scanToast(_scanT("Zbyt mały prostokąt — przeciągnij szerzej.", "That rectangle is too small — drag a wider one."));
    return;
  }
  const piksele = (u.obszarJednostka === "piksele");
  // W pikselach potrzebujemy boków BAZY W PIKSELACH PULPITU (ramka podglądu ich nie zna — ma
  // kilkaset pikseli na kilka tysięcy ekranu). Bez wiedzy o monitorach (pierwsze sekundy po
  // starcie) zostają procenty — lepsza liczba przybliżona w dobrej jednostce niż dokładna w złej.
  const bok = piksele ? RFScan.bazaObszaru(u, RFScan.ekrany) : null;
  const wPikselach = !!bok;
  const licz = function (f, dl) {
    return wPikselach ? Math.round(f * dl) : Math.round(f * 1000) / 10;   // procenty z jednym miejscem
  };
  u.obszar = "wlasny";
  if (piksele && !wPikselach) u.obszarJednostka = "procent";
  u.obszarX1 = licz(fx1, wPikselach ? bok.w : 0);
  u.obszarX2 = licz(fx2, wPikselach ? bok.w : 0);
  u.obszarY1 = licz(fy1, wPikselach ? bok.h : 0);
  u.obszarY2 = licz(fy2, wPikselach ? bok.h : 0);
  if (typeof scanSilnikOdswiez === "function") scanSilnikOdswiez(false);
  if (_SCAN.pola) _SCAN.pola.odswiez();     // pola „Od lewej / Od góry" mają pokazać nowe liczby
  _scanPodgladObszaru();
  if (_SCAN.scena) _SCAN.scena.blysnijObszarem(1200);
  _scanSzacunek();
  scanSave();
}

// ------------------------------------------------------------------------------------------
//  GDZIE JEST SKANER: W SYMULACJI CZY NA PULPICIE
// ------------------------------------------------------------------------------------------
/* PRZEŁĄCZNIK MIEJSCA — ALBO TO, ALBO TO (15.09).

   Widoczne jest albo „na pulpicie", albo „na zrzucie/symulacji", nigdy oba, a układ karty
   przestawia się tak, żeby wynagrodzić nieaktywny lewy panel podglądu.

   CO SIĘ ZMIENIŁO. Do 14.09 ten segment mówił tylko, gdzie oglądać PROSTOKĄT OBSZARU, więc oba
   światy stały obok siebie: w karcie jechał pasek po piaskownicy, a nad pulpitem drugie okno
   rysowało obrys tego samego obszaru. Dwa podglądy tego samego naraz to dwa razy więcej do
   pilnowania i zero pewności, na który się patrzy. Teraz segment mówi, GDZIE JEST SKANER:
     • „W symulacji" — ramka podglądu tej karty (piaskownica albo wgrany zrzut gry), nad pulpitem
       nie stoi nic,
     • „Na pulpicie" — okno nad prawdziwym pulpitem, a ramka w karcie jest WYGASZONA i schodzi
       z drogi (klasa `sk-na-pulpicie`, patrz `_sktloUklad`).

   I DRUGA RZECZ, WAŻNIEJSZA: „W symulacji" ZAMYKA OKNO, JAKIKOLWIEK BY NIE BYŁO. Do 15.09
   odmawiało zamknięcia okna w trybie „skan” („przełącznik miejsca podglądu nie jest przyciskiem
   STOP”) — a żadnego innego przycisku STOP nie było. Komunikat po uruchomieniu mówił „Esc
   zamyka", co nie mogło działać nigdy: okno ma `WS_EX_TRANSPARENT`, nie bierze skupienia i żaden
   klawisz do niego nie dociera. Skutek był dokładnie taki, jak w zgłoszeniu — nakładki nie dało
   się zgasić niczym. Teraz jest odwrotnie: to JEST wyłącznik, a osobny przycisk w panelu pilota
   mówi to samo wprost. */
function _sktloGdzie(co) {
  const chce = (co === "pulpit") ? "pulpit" : "karta";
  if (chce === "pulpit") {
    // Skaner PUSZCZONY NA SERIO zostaje: jest już nad pulpitem, czyli tam, gdzie człowiek go
    // właśnie prosi. Podmiana na sam obrys zgasiłaby pracujące okno, a tego nikt tu nie prosił.
    _sktloOkno(null, function (stan) {
      // Skaner PUSZCZONY NA SERIO i ustawianie obszaru zostają: jedno i drugie JEST już nad
      // pulpitem, czyli tam, gdzie człowiek właśnie prosi. Podmiana na sam obrys zgasiłaby
      // pracujące okno albo przerwała ustawianie ramki w połowie.
      if (stan && stan.open && (stan.tryb === "skan" || stan.tryb === "edycja")) {
        _SKTLO.gdzie = "pulpit";
        _SKTLO.tryb = stan.tryb;          // „skan" albo „edycja" — mówimy, co TAM stoi
        _sktloRysujSegment();
        _sktloUklad();
        return;
      }
      _sktloOtworzNaPulpicie();
    });
    return;
  }
  // Wracamy do symulacji — i to jest wyłącznik okna nad pulpitem, niezależnie od jego trybu.
  _sktloOkno(null, function (stan) {
    const stalo = (stan && stan.open) ? (stan.tryb || "podglad") : "";
    if (stalo) {
      _sktloOkno({ open: false }, function () {
        _scanToast(stalo === "skan"
          ? _scanT("Skaner nad pulpitem zamknięty. Wróciłeś do symulacji w aplikacji.",
            "The scanner over the desktop is closed. You are back to the simulation in the app.")
          : stalo === "edycja"
            ? _scanT("Ustawianie obszaru zakończone.", "Setting the area is done.")
            : _scanT("Podgląd nad pulpitem zamknięty.", "The preview over the desktop is closed."));
      });
    }
    _SKTLO.gdzie = "karta";
    _SKTLO.tryb = "";
    _sktloRysujSegment();
    _sktloUklad();
    _sktloWrocZPulpitu();
  });
}

/* ⚠️ POWRÓT Z PULPITU MUSI PRZECZYTAĆ KONFIGURACJĘ OD NOWA (16.09).

   Objaw: po przejściu z pulpitu na symulację widok nie aktualizował się, dopóki nie zmieniło
   się skanera. Powód: nad pulpitem obszar ustawia się MYSZĄ (rf-50m zapisuje
   go wprost na serwer), a karta trzyma własną kopię konfiguracji z chwili, gdy ostatnio ją czytała.
   Przełącznik miejsca przestawiał tylko układ karty, więc ramka podglądu rysowała obszar SPRZED
   całej wyprawy na pulpit — aż do pierwszej rzeczy, która przechodzi przez `scanCfgArrived`
   (przełączenie sekcji, zmiana kapsla, wczytanie presetu). Stąd „dopóki nie zmienimy skanera".

   `scanLoad` jest jedyną drogą, która odświeża wszystko naraz: pola, ramkę, zrzut, pigułki
   i cienie pozostałych sekcji. Wołamy ją PO zamknięciu okna, żeby odczyt nie wyprzedził zapisu,
   który tamto okno mogło właśnie wysłać. */
function _sktloWrocZPulpitu() {
  if (typeof scanLoad !== "function") return;
  setTimeout(function () {
    try { scanLoad(_scanDev()); } catch (e) { }
  }, 150);
}

/* „NA PULPICIE" = OBSZAR OD RAZU DO USTAWIANIA MYSZĄ (2026-09-16).

   Zamiast przycisku „ustaw obszar myszką" ramka na dole jest cały czas włączona: edytor obszaru
   działa zawsze, ale tylko podczas podglądu pulpitu.

   CO SIĘ ZMIENIŁO. Do 15.09 „Na pulpicie" otwierało okno w trybie `podglad` — sam obrys, bez
   możliwości ruszenia go myszą — a edytor był OSOBNYM przyciskiem w panelu pilota („✥ Ustaw
   obszar myszą"). Dwa tryby robiące prawie to samo, z których pierwszy tylko pokazywał to, czego
   w nim nie dało się poprawić. Teraz jest jeden: okno nad pulpitem staje od razu jako edytor
   (`edycja`, rf-50m), a rolę dawnego podglądu pełni w nim OCZKO „ukryj" — po jego naciśnięciu
   zostaje sam obrys, kliknięcia wracają do pulpitu, a oczko czeka na wierzchu, żeby wrócić do
   ustawiania. Tryb `podglad` zostaje w serwerze i w rf-50h: to nim testuje się okno adresem
   `?podglad=1`, bez otwierania czegokolwiek na ekranie.

   Karta nie robi tu nic poza otwarciem: ramka, sekcje, nazwy i zapis dzieją się w oknie nad
   pulpitem, bo tam widać to, do czego się celuje. Po „Gotowe" okno zamyka się samo, a karta
   dowiaduje się o tym strumieniem (`rfOnScanOkno`). */
function _sktloOtworzNaPulpicie() {
  _sktloOkno({ open: true, tryb: "edycja" }, function (j) {
    if (!j || !j.ok) {
      _scanToast((j && j.error) || _scanT("Nie udało się otworzyć okna nad pulpitem.",
        "Could not open the window over the desktop."));
      return;
    }
    _SKTLO.gdzie = "pulpit";
    _SKTLO.tryb = "edycja";
    _sktloRysujSegment();
    _sktloUklad();
    _scanToast(_scanT("Obszar ustawiasz teraz myszą na ekranie — zapisuje się po puszczeniu. Oczkiem w pasku chowasz uchwyty i oddajesz kliknięcia pulpitowi.",
      "You now set the area with the mouse on the screen — it saves when you let go. The eye in the bar hides the handles and gives clicks back to the desktop."));
  });
}

/* OKNO ZAMKNIĘTE SKRÓTEM, SPOZA PANELU (2026-09-15) — zdarzenie `scan_okno` ze strumienia
   (rf-08), wysyłane przez `scan_overlay_stop` w monitorze.

   Karta tylko POKAZUJE, co się stało: serwer zamknął okno, więc POST byłby drugim zapisem tej
   samej decyzji (to samo lustro, co `scanReflectEnabled` po stopie awaryjnym w rf-50d). Różnica
   wobec stopu jest cała: tam gaśnie moduł, tu gaśnie SAMO OKNO — włącznik Skanera celowo
   zostaje włączony. */
function rfOnScanOkno(m) {
  if (m && m.open) return;                  // tą drogą przychodzi dziś wyłącznie zamknięcie
  if (_SKTLO.gdzie !== "pulpit") return;    // karta już stoi na „W symulacji"
  const bylo = _SKTLO.tryb;
  _SKTLO.gdzie = "karta";
  _SKTLO.tryb = "";
  _sktloRysujSegment();
  _sktloUklad();
  // Okno mogło zamknąć się samo („Gotowe", skrót) — a obszar ustawiany myszą leży już na serwerze.
  // Ta sama droga, co przy przełączniku: patrz nota przy `_sktloWrocZPulpitu`.
  _sktloWrocZPulpitu();
  const klawisze = String((m && m.combo) || "").split("+").filter(Boolean)
    .map(function (k) { return k.charAt(0).toUpperCase() + k.slice(1); }).join(" + ");
  if (!klawisze) return;                    // zamknięcie z panelu mówi już własnym komunikatem
  _scanToast(bylo === "skan"
    ? _scanT("Skaner nad pulpitem zamknięty skrótem " + klawisze + ". Moduł zostaje włączony, jesteś z powrotem w symulacji.",
      "The scanner over the desktop was closed with " + klawisze + ". The module stays on and you are back in the simulation.")
    : bylo === "edycja"
      ? _scanT("Ustawianie obszaru zamknięte skrótem " + klawisze + ".",
        "Setting the area was closed with " + klawisze + ".")
      : _scanT("Podgląd nad pulpitem zamknięty skrótem " + klawisze + ".",
        "The preview over the desktop was closed with " + klawisze + "."));
}

/* Czy skaner jest teraz nad pulpitem. Pyta o to karta (rf-50d): przyciski SYGNAŁ / Cofnij / Stop
   muszą wtedy jechać do okna nad pulpitem, a nie do silnika w ramce, której nie widać. Globalna
   funkcja, a nie `_SKTLO` na wierzchu, bo okno nakładki tego pliku nie ładuje — po nazwie da się
   zapytać bezpiecznie (`typeof scanNaPulpicie === "function"`). */
function scanNaPulpicie() { return _SKTLO.gdzie === "pulpit"; }

/* UKŁAD KARTY PRZESTAWIONY POD MIEJSCE, W KTÓRYM STOI SKANER.

   Nieaktywna ramka podglądu nie jest tylko brzydka — jest KŁAMLIWA: piaskownica z ikonami wygląda
   dokładnie tak samo, gdy pasek po niej jedzie, i gdy skanuje coś zupełnie innego nad pulpitem.
   Dlatego w trybie „na pulpicie" ramka nie zostaje wygaszona „na szaro", tylko SCHODZI, a to, co
   po niej zostaje, dostaje jej miejsce: pokrętła rozsypują się na tyle kolumn, ile się zmieści
   (arkusz 26-scan.css, `.sk-na-pulpicie`). W jej miejscu staje jedno zdanie o tym, co stoi nad
   pulpitem, i przycisk, którym się to gasi. */
function _sktloUklad() {
  const karta = document.getElementById("scanCard");
  if (karta) karta.classList.toggle("sk-na-pulpicie", _SKTLO.gdzie === "pulpit");
  const opis = document.getElementById("scanPilotStan");
  if (opis) {
    // Napis składany w JS (stąd `data-noi18n` na elemencie): mówi, CO stoi nad pulpitem, a to
    // zależy od odpowiedzi serwera, nie od klucza tłumaczenia.
    const stan = (_SKTLO.tryb === "skan")
      ? _scanT("Skaner pracuje nad pulpitem — pasek jedzie po prawdziwym ekranie i klika naprawdę.",
        "The scanner is working over the desktop — the bar runs across the real screen and really clicks.")
      : (_SKTLO.tryb === "edycja")
        // Jedyny tryb, w którym okno BIERZE MYSZ — i człowiek musi to wiedzieć, zanim zdziwi się,
        // że kliknięcie nie dochodzi do pulpitu. Od 16.09 zdanie mówi też, czym to odkręcić:
        // edytor stoi teraz przez cały czas, więc oczko w pasku jest jedyną drogą do pulpitu
        // bez zamykania okna.
        ? _scanT("Obszar ustawiasz myszą na ekranie — dopóki uchwyty są widoczne, okno zbiera kliknięcia. Oczkiem w pasku na dole chowasz uchwyty i oddajesz kliknięcia pulpitowi; obrys zostaje.",
          "You set the area with the mouse on the screen — while the handles are visible, that window takes the clicks. The eye in the bar at the bottom hides the handles and gives clicks back to the desktop; the outline stays.")
        : _scanT("Podgląd obszaru stoi nad pulpitem — rysuje sam obrys i nigdy nie klika.",
          "The area preview is over the desktop — it draws the outline only and never clicks.");
    /* DROGA WYJŚCIA W TYM SAMYM ZDANIU (2026-09-15). Ten panel czyta się wtedy, gdy nad pulpitem
       COŚ STOI — a pierwsze pytanie brzmi wtedy „jak to zgasić, kiedy patrzę na grę, a nie na
       panel". Przycisk obok działa tylko w panelu; skrót działa spod gry. Kombinację bierzemy
       z serwera (rf-39j), bo jest ustawieniem — i milczymy o niej, gdy skrót jest wyłączony
       albo hak nie wstał, zamiast obiecywać martwe klawisze. */
    const skrot = (typeof rfScanHotkeyKeys === "function") ? rfScanHotkeyKeys() : null;
    opis.textContent = stan + (skrot
      ? _scanT(" Zamkniesz je skrótem " + skrot.join(" + ") + " — włączniki modułów zostają.",
        " Close it with " + skrot.join(" + ") + " — the module switches stay as they are.")
      : "");
  }
  // Scena i cele treningu leżą w <body> (patrz `_scanWarstwy` w rf-50d), więc samo schowanie
  // ramki ich nie dotyczy — zostałyby na ekranie z ostatnią klatką. Pasek stanu jest od 16.09
  // w karcie i schodzi razem z ramką (arkusz: `.sk-na-pulpicie .sk-hud`).
  if (typeof _scanWarstwy === "function") try { _scanWarstwy(_SKTLO.gdzie !== "pulpit"); } catch (e) { }

  /* SYGNAŁ NAD SAMYM PODGLĄDEM NIE MA CO ROBIĆ — i przycisk musi to powiedzieć SOBĄ, a nie
     komunikatem po naciśnięciu. Okno w trybie „podglad" świadomie ignoruje sygnały (rf-50h:
     „podgląd niczego nie przejmuje"), więc odkąd te trzy przyciski jadą do okna nad pulpitem,
     w tym jednym stanie byłyby martwe. Gaszenie ich jest jedyną uczciwą odpowiedzią: wyjściem
     jest „Uruchom nad pulpitem", i to mówi podpowiedź. */
  const martwe = (_SKTLO.gdzie === "pulpit" && _SKTLO.tryb !== "skan");
  const powod = _scanT("Nad pulpitem stoi sam podgląd obszaru — nie skanuje. Naciśnij „Uruchom nad pulpitem”, żeby ruszył skaner.",
    "Only the area preview is over the desktop — it does not scan. Press “Run over the desktop” to start the scanner.");
  ["scanSignal", "scanUndo", "scanStop"].forEach(function (id) {
    const b = document.getElementById(id);
    if (!b) return;
    b.disabled = martwe;
    /* ⚠️ `title` NIE ZOSTAJE NA ELEMENCIE, i dlatego zdejmujemy DWA atrybuty. Aplikacja ma własne
       dymki (rf-05): obserwator zabiera każdy `title`, przepisuje go do `data-rftip` i dorzuca
       opis dla czytnika ekranu. Skutek przy sprzątaniu: samo `removeAttribute("title")` nie robi
       NIC widocznego — podpowiedź żyje dalej w `data-rftip` i wisi nad przyciskiem, który już
       działa. Ta sama para co w rf-49. */
    if (martwe) {
      b.setAttribute("title", powod);
    } else {
      b.removeAttribute("title");
      b.removeAttribute("data-rftip");
      // …i opis dla czytnika, jeśli rf-05 go zdążył utworzyć: zostawiony mówiłby o podglądzie
      // nad pulpitem przy przycisku, który znowu jest żywy.
      const opisId = b.getAttribute("data-rftip-d");
      if (opisId) {
        const n = document.getElementById(opisId);
        if (n) n.textContent = "";
        const db = (b.getAttribute("aria-describedby") || "").split(/\s+/)
          .filter(function (x) { return x && x !== opisId; }).join(" ");
        if (db) b.setAttribute("aria-describedby", db); else b.removeAttribute("aria-describedby");
      }
    }
  });
}

/* Jedno wejście do `/scan/okno`: bez `body` pyta o stan (GET), z `body` przestawia (POST). */
function _sktloOkno(body, done) {
  const adres = "/scan/okno" + (body ? "" : "?dev=" + encodeURIComponent(_scanDev()));
  const opcje = body ? {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  } : undefined;
  fetch(adres, opcje).then(function (r) { return r.json(); })
    .then(function (j) { done(j); }).catch(function () { done(null); });
}

/* STAN Z SERWERA — jedyna prawda o tym, czy nad pulpitem coś stoi.

   ⚠️ LICZY SIĘ SAMO `open`, NIE TRYB. Do 15.09 stało tu `j.tryb === "podglad"`, więc pracujący
   skaner (tryb „skan") pokazywał się w karcie jako „W aplikacji" — a ramka podglądu udawała, że
   to ona jest tym skanerem. Segment ma mówić, GDZIE JEST SKANER, a nie po co go tam otwarto.

   Pytanie idzie co 5 s i po każdym przeładowaniu karty, dlatego układ sam się naprawia: okno
   zamknięte z paska zadań albo ubity proces przeglądarki wracają tu jako `open:false`. */
function _sktloStanOkna() {
  _sktloOkno(null, function (j) {
    const gdzie = (j && j.open) ? "pulpit" : "karta";
    const tryb = (j && j.open) ? (j.tryb || "podglad") : "";
    if (gdzie === _SKTLO.gdzie && tryb === _SKTLO.tryb) return;
    _SKTLO.gdzie = gdzie;
    _SKTLO.tryb = tryb;
    _sktloRysujSegment();
    _sktloUklad();
  });
}

function _sktloRysujSegment() {
  const seg = document.getElementById("scanGdzie");
  if (!seg) return;
  const b = seg.querySelectorAll("[data-gdzie]");
  for (let i = 0; i < b.length; i++) {
    // ⚠️ Trzeci argument `classList.toggle` MUSI być prawdziwym `true`/`false` — `undefined`
    // PRZEŁĄCZA klasę zamiast ją zgasić (ta sama pułapka, co w segmentach panelu, rf-50b).
    b[i].classList.toggle("sk-seg-wybrany", b[i].getAttribute("data-gdzie") === _SKTLO.gdzie);
  }
}

/* Podpis obok przycisków: co jest wgrane i co z tym zrobić. Składany w JS (stąd `data-noi18n`
   na elemencie w karcie), bo niesie nazwę pliku — a nazwa pliku nie jest kluczem tłumaczenia. */
function _sktloOpis() {
  const n = document.getElementById("scanTloNazwa");
  if (!n) return;
  const nazwa = _sktloNazwa();
  if (_SKTLO.wgrywa) { n.textContent = _scanT("wgrywam…", "uploading…"); return; }
  if (nazwa && _SKTLO.brakPliku) {
    // Nazwa jest, pliku nie ma — najczęściej zestaw z innego komputera. Mówimy to wprost i od razu
    // podpowiadamy wyjście, zamiast zostawiać pustą ramkę bez wyjaśnienia.
    n.textContent = nazwa + " · " + _scanT("tego zrzutu nie ma na tym komputerze — wgraj go jeszcze raz",
      "this screenshot is not on this computer — load it again");
    return;
  }
  /* BEZ ZRZUTU SĄ DWA RÓŻNE STANY i mówimy o nich osobno (20.09) — bo od nich zależy, czego
     człowiek ma się po podglądzie spodziewać. Pulpit testowy to plansza zerowa: rysowany ekran,
     na którym widać WSZYSTKIE skanery i na którym da się ćwiczyć, zanim padnie pierwszy zrzut.
     Grupa to plansza bez obrazka: pokazuje tylko swoje skanery. Dawny jeden komunikat („brak —
     upuść plik…") nie rozróżniał ich wcale. */
  const _wym = function (w, h) { return (w > 0 && h > 0) ? (w + "×" + h + " px") : ""; };
  if (!nazwa) {
    const c = _SCAN.u || {};
    const akt = parseInt(c.zrzutAktywny, 10) || 0;
    const r = (typeof scanPlanszaRozmiar === "function") ? scanPlanszaRozmiar(akt) : { w: 0, h: 0 };
    const rozmiar = _wym(r.w, r.h);
    n.textContent = akt
      ? _scanT("Grupa bez zrzutu — w podglądzie widać tylko przypisane do niej skanery. „Wgraj planszę…” dołoży tu obraz tego widoku.",
        "A group without a screenshot — the preview shows only the scanners assigned to it. “Load a view…” will add a picture of that view here.")
      : (rozmiar ? rozmiar + " · " : "") + _scanT(
        "Pulpit testowy: rysowany ekran do ćwiczeń, na którym widać wszystkie skanery naraz. Żeby celować po prawdziwym obrazie gry, wgraj planszę — przyciskiem, upuszczeniem pliku na podgląd albo Ctrl+V.",
        "Test desktop: a drawn screen for practice, showing every scanner at once. To aim on a real picture of the game, load a view — with the button, by dropping a file on the preview, or with Ctrl+V.");
    return;
  }
  /* ⚠️ ZRZUT O INNYCH PROPORCJACH NIŻ EKRAN JEST ROZCIĄGANY — i człowiek musi o tym wiedzieć,
     bo celuje po obrazku. Od 16.09 ramka bierze proporcje BAZY obszaru (wybrany monitor albo cały
     pulpit), więc zrzut jednego ekranu wgrany przy dwóch monitorach siada na podwójnie szerokiej
     ramce. Lekarstwo jest jednym kliknięciem dalej: wskazanie monitora w „Gdzie skaner ma działać"
     zawęża bazę do tego ekranu i obraz siada na niej bez zniekształcenia.
     Od 20.09 mówimy to LICZBAMI: plansza niesie rozdzielczość ekranu, z którego pochodzi, więc
     „2560×1440 przy ekranie 1920×1080" tłumaczy rozjazd lepiej niż samo słowo „rozciągnięty". */
  const bazy = _sktloProporcjeBazy();
  const rozjazd = (bazy && _SKTLO.proporcje) ? Math.abs(bazy - _SKTLO.proporcje) / bazy : 0;
  const c2 = _SCAN.u || {};
  const akt2 = parseInt(c2.zrzutAktywny, 10) || 0;
  const rp = (typeof scanPlanszaRozmiar === "function") ? scanPlanszaRozmiar(akt2) : { w: 0, h: 0 };
  const glowa = nazwa + (_wym(rp.w, rp.h) ? " · " + _wym(rp.w, rp.h) : "");
  n.textContent = glowa + " · " + (rozjazd > 0.04
    ? _scanT("ta plansza ma inne proporcje niż ekran, na którym pracuje skaner, więc obraz jest rozciągnięty — wskaż monitor w „Gdzie skaner ma działać”",
      "this view has different proportions than the screen the scanner works on, so the picture is stretched — pick the monitor under “Where the scanner works”")
    : _scanT("przeciągnij po planszy, żeby wyznaczyć obszar skanowania",
      "drag across the view to set the scanning area"));
}
