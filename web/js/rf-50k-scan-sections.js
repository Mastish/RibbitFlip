"use strict";
/* SKANER EKRANU — SEKCJE: kilka różnych skanerów w jednej konfiguracji.

   SKĄD TO SIĘ WZIĘŁO (2026-09-13): „preset może mieć zdefiniowane np 3 różne skanery.
   przy edycji pozwól wybrać który edytujesz" — a wcześniej: „chcę, żeby takie preseciki można było
   przełączać (…) jak w kole wyboru wybiorę «Sekcja 1 skanera» pokaże się skaner liniowy
   z zapisanymi parametrami i zdefiniowanym miejscem, a już jak kliknę «sekcja 2 skanera» — będzie
   to przykładowo radar umieszczony w prawej części ekranu". Doprecyzowanie tego samego dnia:
   „koło wyboru to tylko przykład. jeśli coś innego wyzwoli skaner 1 — wtedy powinna pokazać się
   wybrana wersja skanera zapisana w danym presecie".

   DLATEGO WYZWALACZEM JEST ZWYKŁA AKCJA, a nie osobny mechanizm koła: `scan:sekcja=2` wpisuje się
   w regułę Mapowania, na wycinek koła, w makro — wszędzie tam, gdzie wpisuje się klawisz. Koło
   dostaje to za darmo, bo wysyła `spec` tą samą drogą co reguła.

   PIGUŁKI ZAMIAST LISTY ROZWIJANEJ (16.09). Wymaganie: „zamiast listy rozwijalnej —
   utworzone skanery niech mają swoje pille i kolory. pozwoli to łatwiej się między nimi
   przeklikiwać i identyfikować je wizualnie". Lista rozwijana pokazywała JEDNĄ nazwę i wymagała
   dwóch kliknięć na każde przełączenie; pigułki pokazują cały spis naraz, a kolor wiąże pozycję
   w spisie z prostokątem widocznym w podglądzie (niżej).

   KOLOR IDZIE Z POZYCJI, nie z ustawienia — i to jest decyzja, nie skrót. Tożsamością sekcji JEST
   jej numer: tak nazywa ją wyzwalacz (`scan:sekcja=2`), tak nazywa ją okno nad pulpitem i tak
   przesuwa się ona po usunięciu sąsiadki. Kolor zapisany w pliku musiałby przy takim usunięciu
   albo zostać (dwie sekcje w tym samym kolorze), albo się przesunąć (czyli i tak wynikać
   z pozycji). Przy okazji: zero nowych pól w konfiguracji, zero migracji cudzych presetów i ani
   jednego pokrętła do ustawiania czegoś, o co nikt nie prosił.

   PODZIAŁ PRACY ZE SERWEREM. Panel edytuje pola PŁASKIE konfiguracji, czyli sekcję AKTYWNĄ —
   i tylko ją. Spis sekcji (dodaj / usuń / nazwij / wybierz) idzie osobnym wejściem `/scan/sekcja`,
   bo gdyby jeden zapis robił oba naraz, musiałby zgadywać, która wersja dwudziestu pokręteł jest
   świeższa: ta w polach czy ta w spisie. Stąd ten plik nie liczy niczego sam — pyta serwer
   i przerysowuje się z odpowiedzi.

   Osobny plik, a nie koniec rf-50d (900 linii): reguła organizacji JS każe dzielić przy 500,
   a to jest własny temat z własnym stanem. */
(function (global) {
  'use strict';

  const T = function (pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; };

  /* KOLOR SKANERA MIESZKA W MODELU (`RFScan.kolorSekcji`, rf-50-scan-model.js) — tam, bo tej samej
     barwy używa też okno nad pulpitem, które tego pliku nie ładuje. Tu zostaje sama nazwa pod ręką
     dla karty i dla konsoli. */
  global.scanKolorSekcji = function (n) { return RFScan.kolorSekcji(n); };

  /* CZY POKAZYWAĆ POZOSTAŁE SKANERY W PODGLĄDZIE. Wybór człowieka na tym komputerze, więc
     localStorage, a nie konfiguracja: to jest ustawienie OGLĄDANIA, nie skanera — w presecie
     wysłanym komuś innemu nie miałoby czego opisywać. Domyślnie włączone, bo o to była prośba;
     wyłącznik jest dla chwil, gdy prostokąty zasłaniają zrzut. */
  const KLUCZ_OKO = "rf.scan.pozostale";
  let pokazujInne = true;
  try { pokazujInne = localStorage.getItem(KLUCZ_OKO) !== "0"; } catch (e) { /* tryb prywatny */ }

  function _dev() {
    return (typeof _scanDev === "function") ? _scanDev()
      : ((typeof state !== "undefined" && state.activeDeviceId) || "d0");
  }

  function _cfg() {
    return (typeof _SCAN !== "undefined" && _SCAN.u) ? _SCAN.u : null;
  }

  function _lista(c) { return (c && Array.isArray(c.sekcje)) ? c.sekcje : []; }

  function _akt(c) {
    const lista = _lista(c);
    return Math.max(1, Math.min(parseInt(c && c.sekcjaAktywna, 10) || 1, Math.max(1, lista.length)));
  }

  function _nazwa(s, i) { return (s && s.nazwa) || ("Sekcja " + i); }

  /* Jedyne wejście do spisu. Odpowiedź to CAŁA konfiguracja po zmianie, więc karta przerysowuje
     się z niej tak samo, jak po wczytaniu presetu — bez drugiej ścieżki „a teraz zaktualizuj
     pola ręcznie", która rozjeżdżała się z pierwszą przy każdej zmianie. */
  function _poslij(body) {
    return fetch("/scan/sekcja?dev=" + encodeURIComponent(_dev()), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) {
        if (typeof rfToast === "function" && j && j.error) rfToast(j.error, "err");
        return null;
      }
      // Ta sama droga, którą wchodzi konfiguracja z serwera po wczytaniu presetu albo po zmianie
      // kapsla — a nie własna „a teraz zaktualizuj jeszcze pola". Druga ścieżka rozjechałaby się
      // z pierwszą przy pierwszym polu dołożonym do skanera.
      if (typeof scanCfgArrived === "function") scanCfgArrived(j);
      return j;
    }).catch(function () { return null; });
  }

  global.scanSekcjaWybierz = function (n) { return _poslij({ act: "wybierz", n: n }); };
  global.scanSekcjaDodaj = function (nazwa) { return _poslij({ act: "dodaj", nazwa: nazwa || "" }); };
  global.scanSekcjaUsun = function (n) { return _poslij({ act: "usun", n: n }); };
  global.scanSekcjaNazwij = function (n, nazwa) { return _poslij({ act: "nazwij", n: n, nazwa: nazwa }); };

  /* Nieczynny przycisk z powodem w podpowiedzi. Pierwotną podpowiedź (co przycisk robi) pamiętamy,
     żeby wróciła, gdy przycisk znów działa. Pamięć tłumacza (`_i18nA`) czyścimy, bo inaczej po
     zmianie języka przywróciłby stary napis (ten sam powód co w rfArmTipSync, rf-12). */
  function _nieczynny(b, off, powod) {
    if (!b) return;
    if (b._tytul === undefined) b._tytul = b.getAttribute("title") || "";
    b.disabled = !!off;
    const t = off ? powod : b._tytul;
    if ((b.getAttribute("title") || "") !== t) {
      if (b._i18nA) { delete b._i18nA.title; delete b._i18nA["data-rftip"]; }
      if (t) b.setAttribute("title", t); else b.removeAttribute("title");
    }
  }

  /* PASEK NAD POKRĘTŁAMI. Budowany z JS, nie z HTML-a, bo mówi o liczbie sekcji, która zmienia
     się w biegu — a każdy stan („jedna sekcja", „usuwanie zablokowane", „komplet ośmiu") ma tu
     inne przyciski aktywne. */
  function _zbuduj() {
    const host = document.getElementById("scanFields");
    if (!host || !host.parentNode || document.getElementById("scanSekcje")) return null;
    const bar = document.createElement("div");
    bar.id = "scanSekcje";
    bar.className = "sk-sekcje";
    bar.innerHTML =
      '<span class="sk-sekcje-lbl">' + T("Edytujesz skaner", "You are editing scanner") + '</span>' +
      '<div id="scanSekcjaPigulki" class="sk-sek-pigulki" role="group" aria-label="' +
      T("Skanery w tej konfiguracji", "Scanners in this configuration") + '"></div>' +
      '<input id="scanSekcjaNazwa" class="sk-sekcje-nazwa" maxlength="40" ' +
      'title="' + T("Nazwa tego skanera — widać ją tutaj i w podpowiedzi wyzwalacza.",
                    "This scanner's name — shown here and in the trigger hint.") + '">' +
      '<button id="scanSekcjaPlus" class="btn sm sk-sekcje-btn">+ ' + T("Dodaj", "Add") + '</button>' +
      '<button id="scanSekcjaMinus" class="btn sm ghost sk-sekcje-btn">🗑 ' + T("Usuń", "Delete") + '</button>' +
      '<button id="scanSekcjeOko" class="btn sm ghost sk-sek-oko" aria-pressed="true" ' +
      'title="' + T("Pokazuj w podglądzie obszary pozostałych skanerów, każdy w swoim kolorze. " +
                    "Wyłączone — widać tylko ten, który edytujesz.",
                    "Show the other scanners' areas in the preview, each in its own colour. " +
                    "Off — only the one you are editing is drawn.") + '">👁 ' +
      T("Pozostałe w podglądzie", "Others in the preview") + '</button>' +
      '<div class="sk-zrz-chipy" id="scanSekcjaEkrany"></div>' +
      '<div class="sk-sekcje-spec" id="scanSekcjaSpec"></div>';
    host.parentNode.insertBefore(bar, host);

    // Jeden nasłuch na całym rzędzie, nie po jednym na pigułkę: rząd przerysowuje się przy każdej
    // zmianie spisu, więc nasłuchy trzeba by wtedy podpinać od nowa (i pamiętać o zdjęciu starych).
    bar.querySelector("#scanSekcjaPigulki").addEventListener("click", function (ev) {
      const p = ev.target.closest("[data-sekcja]");
      if (!p) return;
      const n = parseInt(p.getAttribute("data-sekcja"), 10) || 1;
      if (n !== _akt(_cfg())) global.scanSekcjaWybierz(n);
    });
    // Nazwa zapisuje się na `change` (wyjście z pola / Enter), nie na każdą literę: każdy znak
    // byłby osobnym zapisem na dysk i osobnym pakietem do okna nad pulpitem.
    bar.querySelector("#scanSekcjaNazwa").addEventListener("change", function () {
      global.scanSekcjaNazwij(_akt(_cfg()), this.value);
    });
    bar.querySelector("#scanSekcjaPlus").addEventListener("click", function () {
      global.scanSekcjaDodaj("");
    });
    bar.querySelector("#scanSekcjaMinus").addEventListener("click", function () {
      const c = _cfg() || {};
      const lista = _lista(c);
      const n = _akt(c);
      const nm = _nazwa(lista[n - 1], n);
      // Pytamy, bo to jedyna nieodwracalna rzecz na tym pasku — dwadzieścia pokręteł znika
      // razem z pozycją listy.
      const pyt = T("Usunąć skaner „", "Delete the scanner “") + nm + T("”? Jego ustawienia przepadną.",
                                                                       "”? Its settings are gone.");
      if (typeof rfConfirm === "function") {
        rfConfirm(pyt).then(function (tak) { if (tak) global.scanSekcjaUsun(n); });
      } else if (global.confirm(pyt)) global.scanSekcjaUsun(n);
    });
    bar.querySelector("#scanSekcjeOko").addEventListener("click", function () {
      pokazujInne = !pokazujInne;
      try { localStorage.setItem(KLUCZ_OKO, pokazujInne ? "1" : "0"); } catch (e) { /* tryb prywatny */ }
      this.setAttribute("aria-pressed", pokazujInne ? "true" : "false");
      this.classList.toggle("on", pokazujInne);
      global.scanSekcjeCienie();      // bez czekania na następną klatkę — klik ma odpowiedzieć od razu
    });
    return bar;
  }

  /* GDZIE STOI PASEK (UX 261120 L4d). Przy jednym skanerze to narzędzie dla dociekliwych: pasek
     mieszka w „Zaawansowanych” (#scanZaawSekcje). Od dwóch skanerów pola niżej dotyczą jednego
     z nich, więc pasek wraca nad pola: inaczej nie widać, który skaner się edytuje. */
  function _miejsce(bar, wiele) {
    const pola = document.getElementById("scanFields");
    const zaaw = document.getElementById("scanZaawSekcje");
    if (wiele || !zaaw) {
      if (pola && pola.parentNode && bar.nextSibling !== pola) pola.parentNode.insertBefore(bar, pola);
    } else if (bar.parentNode !== zaaw) zaaw.appendChild(bar);
  }

  /* RZĄD PIGUŁEK. Przerysowywany tylko wtedy, gdy zmieniły się nazwy albo aktywna sekcja —
     inaczej każdy zapis pokrętła (co 400 ms przy suwaku) budowałby osiem elementów od nowa
     i zabierał skupienie polu nazwy. */
  function _rysujPigulki(bar, lista, akt) {
    const host = bar.querySelector("#scanSekcjaPigulki");
    if (!host) return;
    const odcisk = JSON.stringify([lista.map(function (s, i) { return _nazwa(s, i + 1); }), akt]);
    if (host._odcisk === odcisk) return;
    host._odcisk = odcisk;
    host.innerHTML = "";
    lista.forEach(function (s, i) {
      const n = i + 1;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sk-sek-pill" + (n === akt ? " on" : "");
      b.setAttribute("data-sekcja", String(n));
      b.setAttribute("aria-pressed", n === akt ? "true" : "false");
      // ⚠️ `data-noi18n`: w środku jest NAZWA nadana przez człowieka. Bez tego chodzik tłumaczeń
      // brałby ją za klucz słownika — tak samo, jak przy nazwach kapsli i presetów.
      b.setAttribute("data-noi18n", "");
      b.style.setProperty("--sek", global.scanKolorSekcji(n));
      b.title = T("Przełącz na ten skaner (wyzwalacz: scan:sekcja=",
                  "Switch to this scanner (trigger: scan:sekcja=") + n + ")";
      const kropka = document.createElement("span");
      kropka.className = "sk-sek-kropka";
      kropka.setAttribute("aria-hidden", "true");
      const nr = document.createElement("span");
      nr.className = "sk-sek-nr";
      nr.textContent = n;
      const nazwa = document.createElement("span");
      nazwa.className = "sk-sek-nazwa";
      nazwa.textContent = _nazwa(s, n);
      b.appendChild(kropka); b.appendChild(nr); b.appendChild(nazwa);
      host.appendChild(b);
    });
  }

  /* Przerysowanie paska z konfiguracji. Wołane po każdej zmianie — także po wczytaniu presetu,
     bo preset niesie CAŁY spis sekcji i po nim lista bywa zupełnie inna. */
  global.scanSekcjeSync = function () {
    const c = _cfg();
    if (!c) return;
    const bar = document.getElementById("scanSekcje") || _zbuduj();
    if (!bar) return;
    const lista = _lista(c);
    const akt = _akt(c);
    _miejsce(bar, lista.length > 1);
    _rysujPigulki(bar, lista, akt);
    const nz = bar.querySelector("#scanSekcjaNazwa");
    const nazwa = (lista[akt - 1] && lista[akt - 1].nazwa) || "";
    if (document.activeElement !== nz && nz.value !== nazwa) nz.value = nazwa;
    // Ósma sekcja to sufit `ScanModule.SEKCJI_MAX`, a ostatniej nie ma jak usunąć: skaner bez
    // sekcji nie miałby czego pokazać. Przyciski gasną, zamiast odpowiadać błędem po kliknięciu.
    // Wygaszony przycisk mówi w podpowiedzi, czemu (UX 261120, P-G2-10): sam wygląd nieczynnego
    // przycisku nie tłumaczy, czego brakuje.
    _nieczynny(bar.querySelector("#scanSekcjaPlus"), lista.length >= 8,
      T("To już osiem skanerów, więcej się nie zmieści.", "That is eight scanners already, no more fit."));
    _nieczynny(bar.querySelector("#scanSekcjaMinus"), lista.length <= 1,
      T("Ostatniego skanera nie da się usunąć.", "The last scanner cannot be deleted."));
    // Oko ma sens dopiero od dwóch skanerów — przy jednym nie ma czego pokazywać ani chować.
    const oko = bar.querySelector("#scanSekcjeOko");
    _nieczynny(oko, lista.length <= 1,
      T("Jest tylko jeden skaner. Dodaj drugi, żeby było co pokazać.", "There is only one scanner. Add another to have something to show."));
    oko.setAttribute("aria-pressed", pokazujInne ? "true" : "false");
    oko.classList.toggle("on", pokazujInne);
    /* OBSZAR AKTYWNEJ SEKCJI DOSTAJE KOLOR JEJ PIGUŁKI — i tylko wtedy, gdy skanerów jest więcej
       niż jeden. Przy jednym zostaje kolor osi Y z ustawień wyglądu: ktoś, kto przemalował go pod
       swoją grę, nie ma powodu tracić tego wyboru za sprawą funkcji, której nie używa. */
    if (typeof _SCAN !== "undefined" && _SCAN.scena && _SCAN.scena.kolorPodgladu)
      _SCAN.scena.kolorPodgladu(lista.length > 1 ? global.scanKolorSekcji(akt) : "");
    // NA KTÓRYCH EKRANACH PRACUJE TEN SKANER — chipy rysuje rf-50n, bo to jego wiedza; tutaj jest
    // tylko miejsce w pasku, bo pytanie dotyczy skanera, którego się właśnie edytuje.
    if (typeof scanZrzutyChipy === "function")
      try { scanZrzutyChipy(bar.querySelector("#scanSekcjaEkrany"), akt); } catch (e) { }
    // CO WPISAĆ, ŻEBY TO WYZWOLIĆ. Bez tej linijki sekcje są ustawieniem, do którego nie ma jak
    // sięgnąć: nazwa jest w panelu, a wyzwalacz chce zapisu. Numer, nie nazwa — nazwę zmienia
    // się w biegu, a wpisana w regułę zerwałaby się po cichu przy pierwszej zmianie.
    const spec = bar.querySelector("#scanSekcjaSpec");
    const zapis = "scan:sekcja=" + akt;
    spec.innerHTML = T("Żeby pokazać ten skaner z przycisku, przechyłu albo koła wyboru, użyj akcji ",
                       "To show this scanner from a button, a lean or the wheel, use the action ")
      + '<code>' + zapis + '</code>'
      + T(" — moduł Skaner musi być wtedy włączony.", " — the Scanner module has to be on.");
    global.scanSekcjeCienie();
  };

  // ------------------------------------------------------------------------------------------
  //  POZOSTAŁE SKANERY W PODGLĄDZIE
  // ------------------------------------------------------------------------------------------
  /* WYMAGANIE (16.09): „w preview chcę mieć możliwość podejrzenia tego skanera który
     edytuję, ale i widzieć pozostałe na podglądzie (albo mieć możliwość widzenia tylko aktualnie
     edytowanego)".

     Obszar AKTYWNEJ sekcji rysuje scena (rf-50c) — pełnym obrysem, z wypełnieniem spod suwaka
     „Podgląd obszaru" i z błyskiem po każdej zmianie. Tutaj dochodzą POZOSTAŁE: cieńszą kreską,
     przygaszone, każdy w kolorze swojej pigułki i z podpisem „2 · Panel opcji". Dzięki temu widać,
     czy skanery się nie nachodzą i który kawałek ekranu jest jeszcze wolny.

     DLACZEGO WARSTWA SIEDZI W RAMCE, a nie na scenie: scena jest wspólna z oknem nad pulpitem,
     a tam prostokąty cudzych sekcji wisiałyby nad czyjąś pracą (i tak jest z tamtej strony:
     obrys tylko błyska po zmianie). To jest rysunek POMOCNICZY do ustawiania, więc żyje
     w podglądzie karty — i przy okazji przycina go `overflow:hidden` samej ramki. */
  function _warstwa() {
    const stage = document.getElementById("scanStage");
    if (!stage) return null;
    let w = document.getElementById("scanSekcjeCienie");
    if (!w || w.parentNode !== stage) {
      w = document.createElement("div");
      w.id = "scanSekcjeCienie";
      w.className = "sk-cienie";
      w.setAttribute("aria-hidden", "true");     // to jest rysunek; pigułki mówią to samo słowami
      stage.appendChild(w);
    }
    return w;
  }

  /* Wołane z pętli klatek karty (rf-50d) — tam, gdzie i tak liczy się ramka i obszar aktywnej
     sekcji. Rysunek zmienia się rzadko (przy zmianie ustawień albo rozmiaru ramki), więc pilnuje
     go odcisk: bez niego przepisywalibyśmy osiem elementów sześćdziesiąt razy na sekundę. */
  global.scanSekcjeCienie = function () {
    const w = _warstwa();
    if (!w) return;
    const c = _cfg();
    const lista = _lista(c);
    const akt = _akt(c);
    const stage = w.parentNode;
    const r = stage.getBoundingClientRect();
    // Skaner w ruchu ma pokazywać, GDZIE JEST TERAZ, a nie gdzie mogłyby pracować inne skanery —
    // po pasku jadącym przez cudze prostokąty nie da się celować.
    const biegnie = (typeof _SCAN !== "undefined" && _SCAN.silnik &&
      _SCAN.silnik.faza !== "spoczynek" && _SCAN.silnik.faza !== "gotowe");
    const rysy = [];
    if (pokazujInne && !biegnie && lista.length > 1 && r.width > 1 && r.height > 1) {
      const ramka = { x: 0, y: 0, w: r.width, h: r.height };   // wprost we współrzędnych ramki
      // ⚠️ `scanEkranyPodgladu()`, nie `RFScan.ekrany`: ramka udaje BAZĘ obszaru (wybrany monitor
      // albo cały pulpit), więc prostokąty pozostałych sekcji muszą być liczone w tej samej skali,
      // co obszar edytowany. Sekcja wskazująca inny monitor wypada wtedy poza ramkę — i tak ma być.
      const ekr = (typeof scanEkranyPodgladu === "function") ? scanEkranyPodgladu() : RFScan.ekrany;
      lista.forEach(function (s, i) {
        if (!s || i + 1 === akt) return;
        // EKRAN FILTRUJE OBRYSY (16.09, rf-50n). Gdy człowiek ogląda konkretny zrzut interfejsu,
        // obrysy skanerów z INNEGO ekranu byłyby rysunkiem nie na temat — prostokąty ustawione na
        // czymś, czego teraz nie widać. Bez wybranego ekranu pokazujemy wszystkie, jak dotąd.
        if (typeof scanZrzutMaSekcje === "function" && !scanZrzutMaSekcje(i + 1)) return;
        let p = null;
        try { p = RFScan.obszarEkranu(s, ramka, ekr); } catch (e) { return; }
        if (!p || !(p.w > 0 && p.h > 0)) return;
        rysy.push({ n: i + 1, nazwa: _nazwa(s, i + 1), x: Math.round(p.x), y: Math.round(p.y),
                    w: Math.round(p.w), h: Math.round(p.h) });
      });
    }
    const odcisk = JSON.stringify(rysy);
    if (w._odcisk === odcisk) return;
    w._odcisk = odcisk;
    w.innerHTML = "";
    rysy.forEach(function (o) {
      const d = document.createElement("div");
      d.className = "sk-cien";
      d.style.setProperty("--sek", global.scanKolorSekcji(o.n));
      d.style.left = o.x + "px";
      d.style.top = o.y + "px";
      d.style.width = o.w + "px";
      d.style.height = o.h + "px";
      const l = document.createElement("span");
      l.className = "sk-cien-lbl";
      l.setAttribute("data-noi18n", "");         // nazwa człowieka, nie klucz słownika
      l.textContent = o.n + " · " + o.nazwa;
      d.appendChild(l);
      w.appendChild(d);
    });
  };

  /* PRZEŁĄCZENIE JĘZYKA. Pasek składa się w JS, a napisy biorą EN przez `T()` W CHWILI BUDOWY —
     więc chodzik tłumaczeń rf-01 umie go przetłumaczyć z polskiego, ale nie umie wrócić: węzły
     zbudowane po angielsku nie mają skąd odzyskać polskiego oryginału. Stąd ten sam wzorzec, co
     przy `miRelang` / `rfpcRelang` i reszcie pasków budowanych w kodzie: burzymy i stawiamy od
     nowa, już w nowym języku. `scanSekcjeSync` odtwarza przy okazji pigułki i cienie. */
  global.scanSekcjeRelang = function () {
    const bar = document.getElementById("scanSekcje");
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    if (typeof _SCAN !== "undefined" && _SCAN.u) global.scanSekcjeSync();
  };

  /* Uchwyt dla harnessu (`tests/scan_card_harness.mjs`) i dla konsoli: stan wyłącznika da się
     przestawić bez klikania, a `kolor` jest tą samą funkcją, z której korzystają pigułki. */
  global.RFScanSekcje = {
    kolor: global.scanKolorSekcji,
    pokazujInne: function (tak) {
      if (tak === undefined) return pokazujInne;
      pokazujInne = !!tak;
      try { localStorage.setItem(KLUCZ_OKO, pokazujInne ? "1" : "0"); } catch (e) { }
      const oko = document.getElementById("scanSekcjeOko");
      if (oko) { oko.setAttribute("aria-pressed", pokazujInne ? "true" : "false"); oko.classList.toggle("on", pokazujInne); }
      global.scanSekcjeCienie();
      return pokazujInne;
    }
  };
})(window);
