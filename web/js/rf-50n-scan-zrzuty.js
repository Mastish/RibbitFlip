"use strict";
/* SKANER EKRANU — PLANSZE: widok gry plus skanery, które na nim pracują.

   SKĄD TO SIĘ WZIĘŁO (2026-09-16): obsługa różnych ekranów, czyli jeden wgrany zrzut ma przypisane
   np. skanery 1 i 2, a drugi zrzut np. 1, 3 i 4. Chodzi głównie o obsługę interfejsów kapslem.

   SKĄD NAZWA „PLANSZA" (2026-09-20): „ekran” nie musi być innym ekranem; można wgrać np. dwa zrzuty
   z tego samego monitora, ale dla różnych okien gry.
   Słowo „ekran" znaczyło w tej karcie dwie rzeczy naraz — MONITOR (sekcja „Gdzie skaner ma
   działać") i WIDOK GRY (to tutaj) — a dwuznaczne słowo w panelu kosztuje człowieka dokładnie tyle
   samo, co brakująca funkcja. Hierarchia, którą od 20.09 widać w panelu i w poradniku:

       EKRAN (monitor, jeden)  →  PLANSZE (menu, plansza, panel opcji)  →  SKANERY

   W konfiguracji zostaje klucz `zrzuty`: nazwa pola niczego nie opisuje człowiekowi, a jej zmiana
   zerwałaby każdy zapisany preset.

   CO TO ZMIENIA. Do 16.09 zrzut leżał PRZY SKANERZE (pole `tlo` sekcji), więc jeden skaner mógł
   mieć jeden zrzut. Prawdziwy interfejs ma jednak kilka widoków, a ten sam skaner (choćby „cały
   ekran" albo pasek narzędzi) bywa potrzebny na kilku z nich. Dlatego przypisanie trzyma PLANSZA:
   ona ma spis swoich skanerów, a ten sam numer wolno wpisać w dwie plansze. Konfiguracja niesie
   `zrzuty: [{plik, nazwa, sekcje:[…], w, h}]` i `zrzutAktywny`.

   PULPIT TESTOWY TO PLANSZA ZEROWA (20.09, po zgłoszeniu: „lepiej, żeby był jeden ekran na start
   templatkowy ten ładny z ikonami"). `zrzutAktywny: 0` zawsze znaczyło „bez zrzutu" — czyli
   rysowany pulpit z ikonami, na którym widać wszystkie skanery naraz. Od 20.09 ten stan ma
   w spisie swoją pigułkę: spis nigdy nie jest pusty, a „pokaż wszystko" to kliknięcie, a nie
   wiedza tajemna. W `zrzuty` go NIE MA — nie jest niczyim zdjęciem i nie da się go skasować;
   osobno leży tylko jego rozdzielczość (`szablonW`/`szablonH`).

   ROZDZIELCZOŚĆ (20.09): „każdy ekran powinien mieć też info o rozdzielczości ekranu (czy też
   screena)". Plansza niesie rozmiar EKRANU, z którego pochodzi zrzut — mierzony przed
   zmniejszeniem pliku, więc jest to rozmiar prawdziwego okna gry. Pulpit testowy zaczyna od
   rozmiaru monitora, przy którym się siedzi, a wpisany ręcznie zostaje w konfiguracji.

   DO CZEGO TO SŁUŻY, A DO CZEGO NIE. To jest pomoc do USTAWIANIA: wybrana plansza daje podglądowi
   tło i decyduje, które skanery widać na niej jako obrysy. Skaner nie wie, co jest akurat na
   ekranie (nie ma oczu), więc W BIEGU przełącza się je tak jak dotąd — akcją `scan:sekcja=N`
   z kapsla, reguły albo koła. Plansze mówią więc „te skanery należą do tego widoku", a nie
   „przełącz się sam".

   Osobny plik, bo to własny temat z własnym stanem — rf-50k ma sekcje, rf-50l zrzuty i miejsce
   skanera, a reguła organizacji JS każe dzielić przy 500 liniach. */
(function (global) {
  'use strict';

  const T = function (pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; };

  function _dev() {
    return (typeof _scanDev === "function") ? _scanDev()
      : ((typeof state !== "undefined" && state.activeDeviceId) || "d0");
  }
  function _cfg() { return (typeof _SCAN !== "undefined" && _SCAN.u) ? _SCAN.u : null; }
  function _lista(c) { return (c && Array.isArray(c.zrzuty)) ? c.zrzuty : []; }
  function _akt(c) {
    const l = _lista(c);
    const n = parseInt(c && c.zrzutAktywny, 10) || 0;
    return (n >= 1 && n <= l.length) ? n : 0;
  }
  function _ileSekcji(c) { return (c && Array.isArray(c.sekcje)) ? c.sekcje.length : 1; }

  /* ROZMIAR MONITORA, PRZY KTÓRYM SIEDZI CZŁOWIEK — odpowiedź `/screens`, ekran główny. Stąd
     bierze się domyślna rozdzielczość pulpitu testowego i to jego podstawia przycisk „jak mój
     ekran". ⚠️ `/screens` przychodzi PÓŹNIEJ niż konfiguracja, więc dopóki nie ma odpowiedzi,
     zwracamy null i panel pisze „?" zamiast zmyślonej liczby.

     ⚠️⚠️ BIERZEMY `pw`/`ph`, NIE `w`/`h` (2026-09-21). To są dwie różne liczby o tym samym ekranie:
     `w`/`h` żyje w przestrzeni kursora, którą Windows SKALUJE przy powiększeniu ekranu — przy 150%
     monitor 2560×1600 mówi o sobie „1707×1067" i tak samo odpowiada każdemu, kto pyta stamtąd.
     Dla ogrodzenia myszy i dla akcji `@x,y` to jest odpowiedź prawidłowa, ale tutaj pytanie brzmi
     „jaką rozdzielczość ma mój monitor", a odpowiedź porównuje się ze ZRZUTEM EKRANU, czyli
     z plikiem o prawdziwych 2560 pikselach. Serwer dokłada `pw`/`ph` z `EnumDisplaySettings`
     (patrz `display_pixels` w ribbitflip_monitor.py); bez powiększenia obie pary są równe.
     Rozdzielczość ma pochodzić z systemu (faktyczne wymiary ekranu), a nie z wielkości okna. */
  function _ekranGlowny() {
    const e = (typeof RFScan !== "undefined") ? RFScan.ekrany : null;
    const lista = (e && Array.isArray(e.screens)) ? e.screens : [];
    const s = lista.filter(function (x) { return x && x.primary; })[0] || lista[0];
    if (s) {
      // Starszy serwer (albo ekran, którego trybu nie dało się odczytać) nie przysyła `pw`/`ph`
      // — wtedy liczby kursora są jedynym, co mamy, i lepsze od braku odpowiedzi.
      const w = Math.round(s.pw > 0 ? s.pw : s.w), h = Math.round(s.ph > 0 ? s.ph : s.h);
      // `kw`/`kh` to ten sam ekran w przestrzeni kursora. Wołający ich nie potrzebuje do liczenia
      // — potrzebuje ich do POWIEDZENIA, skąd bierze się druga liczba, którą człowiek widzi obok
      // w wyborze ekranu („Gdzie skaner ma działać"). Tam zostaje przestrzeń kursora, bo tam
      // wpisuje się piksele własnego prostokąta i muszą się zgadzać z tym, co klika skaner.
      if (w > 0 && h > 0) return { w: w, h: h, kw: Math.round(s.w), kh: Math.round(s.h) };
    }
    const d = e && e.desktop;
    return (d && d.w > 0 && d.h > 0)
      ? { w: Math.round(d.w), h: Math.round(d.h), kw: Math.round(d.w), kh: Math.round(d.h) }
      : null;
  }

  /* Rozdzielczość planszy `n` (0 = pulpit testowy). `auto` mówi, że liczba nie jest wpisana przez
     człowieka ani zmierzona na zrzucie, tylko wzięta z monitora — panel pokazuje ją wtedy bledziej
     i nie udaje, że ktoś ją zadeklarował. */
  global.scanPlanszaRozmiar = function (n) {
    const c = _cfg();
    if (!n) {
      const w = parseInt(c && c.szablonW, 10) || 0, h = parseInt(c && c.szablonH, 10) || 0;
      if (w > 0 && h > 0) return { w: w, h: h, auto: false };
      const e = _ekranGlowny();
      return e ? { w: e.w, h: e.h, auto: true } : { w: 0, h: 0, auto: true };
    }
    const z = _lista(c)[n - 1] || {};
    return { w: parseInt(z.w, 10) || 0, h: parseInt(z.h, 10) || 0, auto: false };
  };

  /* PLANSZA, NA KTÓRĄ CZŁOWIEK PATRZY — jedyna odpowiedź na pytanie „co jest teraz pod podglądem".
     Pytają o to rf-50l (tło ramki) i rf-50k (które obrysy rysować). Nazwa historyczna
     (`scanZrzutAktualny`) zostaje: wołają ją trzy inne pliki, a zmiana nazwy funkcji nie mówi
     człowiekowi niczego, czego nie mówi napis w panelu. */
  global.scanZrzutAktualny = function () {
    const c = _cfg(), n = _akt(c);
    return n ? _lista(c)[n - 1] : null;
  };

  /* Czy TEN skaner ma się pokazać w podglądzie. Na pulpicie testowym pokazujemy wszystkie — tak
     wyglądał podgląd, zanim plansze powstały, i tak ma wyglądać u kogoś, kto zrzutów nie używa. */
  global.scanZrzutMaSekcje = function (n) {
    const z = global.scanZrzutAktualny();
    if (!z) return true;
    const s = Array.isArray(z.sekcje) ? z.sekcje : [];
    return s.indexOf(n) >= 0;
  };

  function _poslij(body) {
    return fetch("/scan/zrzut?dev=" + encodeURIComponent(_dev()), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) {
        if (typeof rfToast === "function" && j && j.error) rfToast(j.error, { tone: "danger" });
        return null;
      }
      // Ta sama droga, co przy sekcjach: odpowiedź to CAŁA konfiguracja, więc karta przerysowuje
      // się z niej jednym wywołaniem — bez drugiej ścieżki „a teraz zaktualizuj jeszcze tło".
      if (typeof scanCfgArrived === "function") scanCfgArrived(j);
      return j;
    }).catch(function () {
      // Serwer nie odpowiada (zamknięty EXE, osierocona karta w przeglądarce): do 29.09 klik
      // w planszę ginął tu bez słowa i wyglądał jak zepsute przełączanie. Pigułka zostaje
      // na starym miejscu ŚWIADOMIE — stan panelu ma odzwierciedlać serwer, nie życzenie.
      if (typeof rfToast === "function") rfToast(T("brak połączenia z serwerem", "no connection to the server"), { tone: "danger" });
      return null;
    });
  }

  global.scanZrzutDodaj = function (plik, nazwa, w, h) {
    return _poslij({ act: "dodaj", plik: plik, nazwa: nazwa || "", w: w || 0, h: h || 0 });
  };
  global.scanZrzutWybierz = function (n) { return _poslij({ act: "wybierz", n: n }); };
  global.scanZrzutUsun = function (n) { return _poslij({ act: "usun", n: n }); };
  global.scanZrzutNazwij = function (n, nazwa) { return _poslij({ act: "nazwij", n: n, nazwa: nazwa }); };
  global.scanZrzutPrzypisz = function (n, sekcja, wlacz) {
    return _poslij({ act: "przypisz", n: n, sekcja: sekcja, wlacz: wlacz });
  };
  /* Rozmiar ekranu, z którego pochodzi plansza. `n === 0` to pulpit testowy — jego rozdzielczość
     leży w polach całej konfiguracji, nie w spisie, ale wejście jest jedno, żeby panel nie musiał
     wiedzieć, gdzie serwer to trzyma. */
  global.scanZrzutWymiar = function (n, w, h) {
    return _poslij({ act: "wymiar", n: n, w: w || 0, h: h || 0 });
  };
  // Zdjęcie samego OBRAZU z planszy: zostaje nazwa i spis skanerów, czyli grupa. Odwrotność
  // „Wgraj planszę…", żeby pomyłka przy wgrywaniu nie wymagała kasowania całej pozycji.
  global.scanZrzutZdejmij = function (n) { return _poslij({ act: "zdejmij", n: n }); };

  // ------------------------------------------------------------------------------------------
  //  SPIS PLANSZ POD PODGLĄDEM
  // ------------------------------------------------------------------------------------------
  function _nazwaPlanszy(z, n) {
    return (z && z.nazwa) || ((z && z.plik) ? ("Plansza " + n) : ("Grupa " + n));
  }

  /* Podpis rozmiaru na pigułce. Krótki, bo pigułka stoi w rzędzie, w którym każdy znak kosztuje
     szerokość: „1920×1080" albo nic, gdy rozmiar nieznany (stary preset, cudzy zestaw). */
  function _chipWymiaru(host, n) {
    const r = global.scanPlanszaRozmiar(n);
    if (!(r.w > 0 && r.h > 0)) return;
    const w = document.createElement("span");
    w.className = "sk-zrz-wym" + (r.auto ? " auto" : "");
    w.textContent = r.w + "×" + r.h;
    w.setAttribute("aria-hidden", "true");   // to samo mówi `aria-label` całej pigułki
    host.appendChild(w);
  }

  function _pigulka(n, z, akt, ileSekcji) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sk-zrz-pill" + (n === akt ? " on" : "") + (n === 0 ? " sk-zrz-szablon" : "");
    b.setAttribute("data-zrzut", String(n));
    b.setAttribute("aria-pressed", n === akt ? "true" : "false");
    b.setAttribute("data-noi18n", "");        // nazwa planszy to podpis człowieka
    // ▣ = pulpit testowy (rysowany), 🖼 = plansza ze zrzutem, ▦ = grupa bez obrazka. Jeden znak
    // zamiast zdania: pigułka stoi w rzędzie, w którym każdy znak kosztuje szerokość.
    const znak = document.createElement("span");
    znak.className = "sk-zrz-znak";
    znak.setAttribute("aria-hidden", "true");
    znak.textContent = n === 0 ? "▣" : (z.plik ? "🖼" : "▦");
    b.appendChild(znak);
    const nazwa = document.createElement("span");
    nazwa.className = "sk-zrz-nazwa-txt";
    nazwa.textContent = n === 0 ? T("Pulpit testowy", "Test desktop") : _nazwaPlanszy(z, n);
    b.appendChild(nazwa);
    _chipWymiaru(b, n);
    // KROPKI SKANERÓW — po nich widać, ile i których skanerów plansza niesie, bez wchodzenia
    // w cokolwiek. Ten sam kolor, co pigułka skanera i co jego obrys w podglądzie. Pulpit testowy
    // pokazuje wszystkie, bo na nim rysują się wszystkie.
    const kropki = document.createElement("span");
    kropki.className = "sk-zrz-kropki";
    const spis = n === 0
      ? Array.apply(null, { length: ileSekcji }).map(function (_, i) { return i + 1; })
      : (Array.isArray(z.sekcje) ? z.sekcje : []);
    spis.slice(0, 8).forEach(function (s) {
      const k = document.createElement("i");
      k.style.background = RFScan.kolorSekcji(s);
      k.title = "skaner " + s;
      kropki.appendChild(k);
    });
    if (!spis.length) {
      const pusty = document.createElement("i");
      pusty.className = "sk-zrz-pusty";
      kropki.appendChild(pusty);
    }
    b.appendChild(kropki);
    const ile = spis.length;
    b.title = (n === 0
      ? T("Rysowany pulpit z ikonami — do ćwiczeń bez zrzutu. Widać na nim wszystkie skanery naraz.",
          "The drawn desktop with icons — for practice without a screenshot. Every scanner is visible on it.")
      : T("Pokaż tę planszę w podglądzie. Skanery: ", "Show this view in the preview. Scanners: ") + ile);
    return b;
  }

  function _rysujPigulki(host, lista, akt, ileSekcji) {
    const odcisk = JSON.stringify([lista.map(function (z) { return [z.nazwa, z.plik, z.sekcje, z.w, z.h]; }),
      akt, ileSekcji, global.scanPlanszaRozmiar(0)]);
    if (host._odcisk === odcisk) return;
    host._odcisk = odcisk;
    host.innerHTML = "";
    host.appendChild(_pigulka(0, {}, akt, ileSekcji));      // pulpit testowy zawsze pierwszy
    lista.forEach(function (z, i) { host.appendChild(_pigulka(i + 1, z, akt, ileSekcji)); });
  }

  /* RZĄD WYBRANEJ PLANSZY MA ZAWSZE TEN SAM KOMPLET KONTROLEK (20.09).

     Błąd: przyciski wyglądały inaczej w zależności od aktywnego ekranu. Do
     20.09 nazwa i kosz miały `display:none`, gdy nie było wybranej planszy, więc rząd zmieniał
     szerokość i kolejność przy każdym kliknięciu w spis — a przyciski obok wędrowały pod kursorem.
     Nieczynne kontrolki są teraz WYGASZONE, nie chowane: miejsce zostaje, a `disabled` mówi
     wprost, że tu i teraz nie ma czego zrobić. */
  function _rysujWybrana(c, akt) {
    const nz = document.getElementById("scanZrzutNazwa");
    const pw = document.getElementById("scanZrzutW");
    const ph = document.getElementById("scanZrzutH");
    const usun = document.getElementById("scanZrzutUsun");
    const zdejmij = document.getElementById("scanTloUsun");
    const jak = document.getElementById("scanZrzutWymEkran");
    const z = akt ? (_lista(c)[akt - 1] || {}) : null;
    if (nz) {
      nz.disabled = !akt;
      nz.placeholder = akt ? T("nazwa planszy", "view name")
        : T("pulpit testowy — bez nazwy", "test desktop — no name");
      const nazwa = akt ? (z.nazwa || "") : "";
      if (document.activeElement !== nz && nz.value !== nazwa) nz.value = nazwa;
    }
    const r = global.scanPlanszaRozmiar(akt);
    [[pw, r.w], [ph, r.h]].forEach(function (para) {
      const pole = para[0];
      if (!pole) return;
      pole.classList.toggle("sk-pl-auto", !!r.auto);
      // Zero znaczy „nie wiadomo" i pokazujemy je jako PUSTE POLE z podpowiedzią, a nie jako 0:
      // wpisane zero wyglądałoby jak zadeklarowany rozmiar zerowego ekranu.
      const txt = para[1] > 0 ? String(para[1]) : "";
      if (document.activeElement !== pole && pole.value !== txt) pole.value = txt;
      pole.placeholder = "?";
    });
    const e = _ekranGlowny();
    if (jak) {
      jak.disabled = !e;
      // Gdy Windows powiększa ekran, w panelu stoją obok siebie DWIE prawdziwe liczby o tym samym
      // monitorze: prawdziwe piksele tutaj i piksele kursora w wyborze ekranu niżej. Milczenie
      // o tym wygląda jak błąd jednej z nich, więc dymek mówi wprost, skąd się biorą obie.
      const skala = e && e.kw > 0 && (e.kw !== e.w || e.kh !== e.h)
        ? T(" (Windows powiększa ten ekran, więc kursor liczy go jako ",
            " (Windows scales this screen, so the cursor counts it as ") + e.kw + "×" + e.kh + ")"
        : "";
      jak.title = e
        ? T("Wstaw rozdzielczość monitora, przy którym siedzisz: ", "Use the resolution of the monitor you are sitting at: ") + e.w + "×" + e.h + skala
        : T("Aplikacja nie zna jeszcze układu monitorów.", "The application does not know the monitor layout yet.");
    }
    if (usun) usun.disabled = !akt;
    if (zdejmij) zdejmij.disabled = !(akt && z && z.plik);
  }

  global.scanZrzutySync = function () {
    const c = _cfg();
    if (!c) return;
    const host = document.getElementById("scanZrzuty");
    if (!host) return;
    _rysujPigulki(host, _lista(c), _akt(c), _ileSekcji(c));
    _rysujWybrana(c, _akt(c));
  };

  /* Liczba wpisana w pole rozmiaru. Puste pole = 0 = „nie wiadomo" — i to jest prawidłowa
     odpowiedź, nie błąd (patrz `_wymiar` po stronie serwera). */
  function _liczba(pole) {
    const v = parseInt((pole && pole.value) || "", 10);
    return (isFinite(v) && v > 0) ? Math.min(32000, v) : 0;
  }

  function _zapiszWymiar() {
    const c = _cfg();
    if (!c) return;
    global.scanZrzutWymiar(_akt(c), _liczba(document.getElementById("scanZrzutW")),
      _liczba(document.getElementById("scanZrzutH")));
  }

  global.scanZrzutyInit = function () {
    const host = document.getElementById("scanZrzuty");
    if (!host || host._gotowe) return;
    host._gotowe = true;
    host.addEventListener("click", function (ev) {
      const p = ev.target.closest("[data-zrzut]");
      if (!p) return;
      const n = parseInt(p.getAttribute("data-zrzut"), 10) || 0;
      if (n !== _akt(_cfg())) global.scanZrzutWybierz(n);
    });
    const nz = document.getElementById("scanZrzutNazwa");
    if (nz) nz.addEventListener("change", function () {
      const n = _akt(_cfg());
      if (n) global.scanZrzutNazwij(n, this.value);
    });
    /* ENTER ZATWIERDZA, ESC COFA (21.09). Do tej pory pole miało samo `change`, czyli zapisywało
       się przy wyjściu z pola — a nazwę planszy wpisuje się teraz zaraz po zrobieniu zrzutu
       skrótem (rf-50o ustawia tu fokus), więc „wpisz i naciśnij Enter" musi być całym ruchem.
       Planszę można nazwać zaraz po zrobieniu zrzutu (np. «Menu główne»).

       Enter NIE zapisuje sam z siebie — robi `blur()`, a zapis leci przez `change` wyżej. Dwie
       drogi do tego samego zapisu znaczyłyby dwa żądania na jedno naciśnięcie klawisza.
       Esc przywraca nazwę Z KONFIGURACJI (czyli ostatnią zapisaną) przed zdjęciem fokusu — dzięki
       temu `change` nie ma czego zgłaszać i cofnięcie naprawdę niczego nie zapisuje. */
    if (nz) nz.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); this.blur(); return; }
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();      // Esc w polu tekstowym nie ma zamykać niczego nad kartą
        const n = _akt(_cfg());
        const z = n ? (_lista(_cfg())[n - 1] || {}) : {};
        this.value = z.nazwa || "";
        this.blur();
      }
    });
    // Rozmiar zapisuje się na `change` (wyjście z pola / Enter), nie na każdą cyfrę: „1920"
    // wpisywane po znaku to cztery zapisy na dysk, z których trzy opisują ekran, którego nie ma.
    ["scanZrzutW", "scanZrzutH"].forEach(function (id) {
      const pole = document.getElementById(id);
      if (pole) pole.addEventListener("change", _zapiszWymiar);
    });
    const jak = document.getElementById("scanZrzutWymEkran");
    if (jak) jak.addEventListener("click", function () {
      const e = _ekranGlowny();
      if (!e) return;
      global.scanZrzutWymiar(_akt(_cfg()), e.w, e.h);
    });
    const gr = document.getElementById("scanZrzutGrupa");
    if (gr) gr.addEventListener("click", function () {
      const c = _cfg();
      const ile = _lista(c).length;
      if (ile >= 8) {
        if (typeof rfToast === "function") rfToast(T("Więcej niż osiem plansz i grup nie ma jak dodać.",
          "More than eight views and groups cannot be added."), "err");
        return;
      }
      // Nazwa z automatu i od razu kursor w polu: grupa bez nazwy nie mówi o niczym, a pytanie
      // w osobnym okienku byłoby jednym kliknięciem więcej za to samo.
      global.scanZrzutDodaj("", "Grupa " + (ile + 1)).then(function () {
        const nz = document.getElementById("scanZrzutNazwa");
        if (nz) { nz.focus(); nz.select(); }
      });
    });
    const us = document.getElementById("scanZrzutUsun");
    if (us) us.addEventListener("click", function () {
      const c = _cfg(), n = _akt(c);
      if (!n) return;
      const z = _lista(c)[n - 1] || {};
      // Pytamy, bo razem z planszą znika przypisanie skanerów do niej — a od 21.09 także sam
      // ZRZUT (usunięcie planszy usuwa też wgraną grafikę). Do tej pory stało tu zapewnienie, że plik zostaje
      // w `Settings/ScanTla` i wgranie go ponownie nic nie kosztuje. Teraz byłoby to zapewnienie
      // fałszywe w najgorszą stronę: zrzut wklejony przez Ctrl+V nie ma na dysku drugiej kopii,
      // więc „wgraj ponownie" znaczyłoby „zrób nowy zrzut ekranu tej samej gry".
      const pyt = T(z.plik ? "Usunąć planszę „" : "Usunąć grupę „", z.plik ? "Delete the view “" : "Delete the group “")
        + _nazwaPlanszy(z, n)
        + T("”? Skanery zostają, znika tylko przypisanie ich do niej.",
            "”? The scanners stay, only their assignment to it goes.")
        + (z.plik
          ? T(" Zrzut zniknie razem z nią także z dysku — chyba że trzyma go inna plansza, drugi kapsel albo zapisany plik.",
              " The screenshot goes from the disk along with it — unless another view, another capsule or a saved file still holds it.")
          : "");
      if (typeof rfConfirm === "function") {
        rfConfirm(pyt).then(function (tak) { if (tak) global.scanZrzutUsun(n); });
      } else if (global.confirm(pyt)) global.scanZrzutUsun(n);
    });
    global.scanZrzutySync();
  };

  /* CHIPY „TEN SKANER PRACUJE NA PLANSZACH" — rysowane w pasku sekcji (rf-50k), bo dotyczą
     skanera, którego się właśnie edytuje. Stąd, a nie stamtąd, bo to wiedza o planszach: rf-50k
     prosi o narysowanie i nie musi wiedzieć, jak wygląda przypisanie. */
  global.scanZrzutyChipy = function (host, sekcja) {
    if (!host) return;
    const c = _cfg();
    const lista = _lista(c);
    host.classList.toggle("sk-ukryte", lista.length === 0);
    const odcisk = JSON.stringify([lista.map(function (z) { return [z.nazwa, z.sekcje]; }), sekcja]);
    if (host._odcisk === odcisk) return;
    host._odcisk = odcisk;
    host.innerHTML = "";
    if (!lista.length) return;
    const lbl = document.createElement("span");
    lbl.className = "sk-zrz-chip-lbl";
    lbl.textContent = T("Pracuje na planszach", "Works on views");
    host.appendChild(lbl);
    lista.forEach(function (z, i) {
      const n = i + 1;
      const ma = (Array.isArray(z.sekcje) ? z.sekcje : []).indexOf(sekcja) >= 0;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sk-zrz-chip" + (ma ? " on" : "");
      b.setAttribute("aria-pressed", ma ? "true" : "false");
      b.setAttribute("data-noi18n", "");
      b.textContent = (ma ? "✓ " : "＋ ") + _nazwaPlanszy(z, n);
      b.title = ma
        ? T("Zdejmij ten skaner z tej planszy", "Take this scanner off that view")
        : T("Dopisz ten skaner do tej planszy — ten sam skaner może pracować na kilku",
            "Add this scanner to that view — the same scanner can work on several");
      b.addEventListener("click", function () { global.scanZrzutPrzypisz(n, sekcja, !ma); });
      host.appendChild(b);
    });
  };
})(window);
