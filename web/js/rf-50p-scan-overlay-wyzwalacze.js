"use strict";
/* SKANER — „CZYM STERUJESZ" I PRÓBA SYGNAŁU W OKNIE NAD PULPITEM (tryb `?edycja=1`).

   ZGŁOSZENIE WŁAŚCICIELA (2026-09-22): „do skanera nad pulpitem — trzeba dodać możliwość już
   z tamtego miejsca edytowania tego, co na tym screenie [sekcja »Czym sterujesz skanerem«
   z karty]. zrób to jakoś nieinwazyjnie i z możliwością przetestowania od razu. może niech te
   opcje będą w rozwijanym oknie które można zwinąć i przemieścić i niech będzie gdzieś tam
   w ui […] przycisk testu wysłania sygnału, żeby od razu zasymulować i podejrzeć jak ta akcja
   działa".

   PO CO TU, SKORO TO SAMO JEST W KARCIE. Bo wyzwalacz dobiera się POD CZŁOWIEKA, a sprawdza go
   na PRAWDZIWYM EKRANIE. Okno nad pulpitem stoi dokładnie w tej chwili — przy grze, przy
   ustawianiu obszarów — i wtedy właśnie wychodzi, że „przechylenie w prawo" strzela samo albo
   że sygnału nie ma wcale. Droga do karty prowadziła przez zamknięcie okna, czyli przez utratę
   tego, co się właśnie ustawiało.

   ⚠️ NIE MA TU DRUGIEJ KOPII KATALOGU ANI BUDOWANIA REGUŁ. Gotowce (`SKAN_ZRODLA_WLASNE`
   + `GESTURE_PRESETS`), role (`SKAN_SYGNALY`) i kształt nowej reguły (`_skanNowaRegula`)
   przychodzą Z KARTY — rf-50i i rf-12c to pliki danych i czystych funkcji, więc dają się wczytać
   w tym oknie bez całego panelu. Nowa jest wyłącznie warstwa rysowania i rozmowa z serwerem, bo
   karta chodzi po `state.rules` i `commitRules()`, których to okno nie ma. Gdyby któryś z tych
   plików nie dojechał, panel MÓWI o tym i odmawia dopisania reguły — półreguła zapisana „z grubsza"
   byłaby gorsza od jej braku (sanityzator serwera zbuduje z niej coś, czego nikt nie zamawiał).

   ⚠️ PRÓBA NICZEGO NIE KLIKA. Okno w trybie edycji jest podglądem (rf-50h: „podgląd niczego nie
   przejmuje") i takie zostaje: próba tylko WPUSZCZA sygnały do silnika, żeby pasek pojechał po
   prawdziwym ekranie i pokazał ślad tam, gdzie padłby klik. Prawdziwe klikanie ma w tej aplikacji
   jedno wejście i jedną zgodę — „Uruchom nad pulpitem" przy włączonym module.

   ⚠️ SYGNAŁ PRÓBNY IDZIE PRZEZ SERWER (`/scan/sygnal`), a nie prosto do silnika w tym oknie.
   To jest ta sama trasa, którą jedzie przechylenie kapsla, więc próba sprawdza CAŁY łańcuch
   (strumień, kapsel, drugie okno), a nie tylko rysowanie paska u siebie. */
(function (global) {
  const par = new URLSearchParams(location.search);
  if (par.get("edycja") !== "1") return;      // ten plik ożywa TYLKO w oknie edycji obszaru
  const DEV = par.get("dev") || "d0";

  /* Co okienko pamięta między otwarciami: gdzie stoi i czy jest zwinięte. Tyle i nic więcej —
     wybór gotowca czy trwająca próba mają żyć tyle, co okno.
     ⚠️ KLUCZ WŁASNY, NIEDZIELONY Z KARTĄ. Rf-50m stracił kiedyś swój wybór podglądu przez to, że
     sięgał po klucz, którego używa też oczko w pasku plansz (rf-50k) — jedno kliknięcie w panelu
     przestawiało zachowanie okna nad pulpitem i nic tego nie tłumaczyło. Ten klucz nie występuje
     nigdzie poza tym plikiem. */
  const KLUCZ = "rf.scan.okienkoWyzwalaczy";

  // Ile trwa „to był mój sygnał" — patrz `zanotujSygnal`.
  const MOJ_SYGNAL_MS = 400;

  /* Klucze OBSZARU. Zestaw („Ostrożny", „Szybki"…) przestawia w karcie wszystkie pokrętła od
     domyślnych — razem z obszarem. Tutaj obszar jest tym, co człowiek przed chwilą narysował
     myszą na grze, więc wraca po zestawie na swoje miejsce; pasek zestawów mówi o tym wprost.
     To jedyne miejsce, w którym to okno zachowuje się inaczej niż karta, i dlatego jest opisane. */
  const OBSZAR_KLUCZE = ["obszar", "obszarMonitor", "obszarJednostka",
    "obszarX1", "obszarY1", "obszarX2", "obszarY2"];

  // --- stan --------------------------------------------------------------------------------
  let reguly = [];           // reguły TEGO kapsla, świeże z `/rules`
  let wlaczony = null;       // czy moduł Skaner jest włączony (null = jeszcze nie wiemy)
  /* WŁASNA, NIEPODMIENIONA KOPIA USTAWIEŃ. ⚠️ NIE bierzemy `u` z rf-50h: tamta jest celowo
     przerobiona pod nakładkę (`dociaganie: 0`, tryb „elementy" zamieniony na „pasy",
     przyciemnienie i podgląd obszaru wyzerowane), a `POST /scan` nadpisuje konfigurację tym,
     co dostanie — odesłanie tamtej kopii skasowałoby człowiekowi tryb i dociąganie przy
     pierwszym ruchu suwaka. Ta sama pułapka, co przy zapisie obszaru w rf-50m. */
  let ust = null;            // parametry skanowania (klucze `RFScan.DOMYSLNE`)
  let wygl = null;           // wygląd i dźwięk (klucze `RFScan.WYGLAD_DOM`)
  let pola = null;           // `RFScan.Panel` — te same pokrętła, co w karcie
  // Okno otwiera się na USTAWIENIACH — patrz nota przy budowaniu zakładek.
  let zakladka = "ustawienia";
  let zapisNr = 0;
  let zapisTimer = 0;
  let otwarte = true;        // czy okienko w ogóle stoi na ekranie
  let zwiniete = true;       // zwinięte = sam pasek tytułu (z przyciskiem próby!) — patrz `wczytajStan`
  let dodajDo = "";          // która rola ma rozwinięty wybór gotowca
  let pytanie = "";          // id reguły, przy której stoi pytanie „usunąć?"
  const wybor = {};          // spec → klucz wybranego gotowca; przeżywa przerysowanie
  let proba = false;         // czy trwa próba
  let mojSygnal = 0;         // znacznik czasu POST-u z tego okna — token JEDNORAZOWY
  let ostatniSygnal = null;  // {co, moje, ts} — do paska stanu próby
  let ostatniaAkcja = null;  // wynik silnika z próby: gdzie i czym by kliknął
  let stanTimer = 0;
  let ciag = null;           // przeciąganie okienka za pasek tytułu
  let poz = null;            // {x, y} lewego górnego rogu okienka w pikselach widoku

  // --- pomocnicze --------------------------------------------------------------------------
  function T(pl, en) { return (typeof _scanT === "function") ? _scanT(pl, en) : pl; }
  function N() { return global.RFScanNakladka || {}; }
  function E() { return global.RFScanEdycja || {}; }
  function $(id) { return document.getElementById(id); }

  function el(rodzic, tag, klasa, tekst) {
    const e = document.createElement(tag);
    if (klasa) e.className = klasa;
    if (tekst != null) e.textContent = tekst;
    if (rodzic) rodzic.appendChild(e);
    return e;
  }

  function przycisk(rodzic, klasa, napis, tytul, onClick, fk) {
    const b = el(rodzic, "button", klasa, napis);
    b.type = "button";
    if (tytul) { b.title = tytul; b.setAttribute("aria-label", tytul); }
    if (fk) b.dataset.fk = fk;
    b.addEventListener("click", onClick);
    return b;
  }

  function stan(tekst, klasa) {
    const e = $("wyStan");
    if (!e) return;
    e.textContent = tekst || "";
    e.className = "wy-stan" + (klasa ? " " + klasa : "");
    clearTimeout(stanTimer);
    if (tekst) stanTimer = setTimeout(function () { e.textContent = ""; e.className = "wy-stan"; }, 2800);
  }

  /* NAZWY WIELKOŚCI — LUSTRO `FILTER_METRICS` Z MAPOWANIA (rf-10).

     Dlaczego lustro, a nie wczytanie tamtego pliku: rf-10 liczy przy starcie kolory kanałów
     (`cv('--ax')`), więc w oknie bez arkuszy panelu wstaje martwy. Dlaczego w ogóle nazwy, skoro
     reguły z gotowców niosą etykietę: bo w tych pudełkach stają też wyzwalacze zrobione ręcznie
     w Mapowaniu, a takie bywają bez etykiety — i wtedy jedyne, co o nich wiadomo, to wielkość,
     próg i kierunek.

     ⚠️ ROZJAZDU PILNUJE TEST (`test_scan.py`, sekcja o okienku wyzwalaczy): nazwy i jednostki
     muszą być co do znaku te same, co w `FILTER_METRICS`. Własny słownik już raz w tym module
     skłamał — „Pochylenie" znaczyło w nim `pitch`, podczas gdy w Mapowaniu znaczy `tilt`. */
  const WIELKOSCI = {
    tilt: { nazwa: "Pochylenie", jedn: "°" },
    twist: { nazwa: "Obrót (twist)", jedn: "°/s" },
    pitch: { nazwa: "Przechył przód/tył", jedn: "°" },
    roll: { nazwa: "Przechył w bok", jedn: "°" },
    spin: { nazwa: "Wirowanie (|żyro|)", jedn: "LSB" }
  };

  // Role (pudełka) i katalog gotowców — z karty, nie z kopii. Gdy plik karty nie dojechał,
  // zostaje pusto i panel powie o tym wprost zamiast udawać, że coś umie.
  function role() {
    return (typeof SKAN_SYGNALY !== "undefined" && Array.isArray(SKAN_SYGNALY)) ? SKAN_SYGNALY : [];
  }
  function gotowce() {
    if (typeof _skanZrodla === "function") { try { return _skanZrodla(); } catch (e) { } }
    return (typeof SKAN_ZRODLA_WLASNE !== "undefined") ? SKAN_ZRODLA_WLASNE : [];
  }
  function nazwaGotowca(z) {
    return (typeof _skanNazwa === "function") ? _skanNazwa(z) : (z.label || z.key || "");
  }
  function opisGotowca(z) {
    return (typeof _skanOpis === "function") ? _skanOpis(z) : (z.desc || "");
  }

  // --- opis reguły -------------------------------------------------------------------------
  function liczba(n) {
    const x = Math.round(Number(n) * 10) / 10;
    return (Math.abs(x % 1) < 0.05 ? String(Math.round(x)) : String(x)).replace(".", ",");
  }

  /* Jak nazwać wyzwalacz w wierszu. Etykieta człowieka wygrywa ze wszystkim — to ona stoi też
     w Mapowaniu i po niej człowiek pozna, że to ta sama rzecz. */
  function nazwaReguly(r) {
    const etykieta = String((r && r.label) || "").trim();
    if (etykieta) return etykieta;
    const s = (r && r.source) || {};
    if (s.kind === "button") return T("Przycisk kapsla", "The capsule's button");
    if (s.kind === "gesture") return T("Nagrany gest", "A recorded gesture");
    if (s.kind === "trigger") {
      const inna = reguly.filter(function (x) { return x && x.id === s.ref; })[0];
      return "⟶ " + (inna ? nazwaReguly(inna) : T("inny wyzwalacz", "another trigger"));
    }
    const w = WIELKOSCI[s.metric];
    return w ? w.nazwa : T("Wyzwalacz", "Trigger");
  }

  /* Druga linijka: warunek i zachowanie — krótko. Pełne zdanie o regule mówi Mapowanie
     (`ruleCondLabel` / `ruleBehLabel`); tutaj chodzi o rozpoznanie wiersza, nie o edycję. */
  function opisReguly(r) {
    const cz = [];
    const s = (r && r.source) || {};
    if (s.kind === "filter" && WIELKOSCI[s.metric]) {
      const w = WIELKOSCI[s.metric];
      cz.push((r.abs ? "|" + w.nazwa + "|" : w.nazwa) + " " + (String(r.cmp || ">").indexOf("<") >= 0 ? "<" : ">")
        + " " + liczba(r.threshold) + " " + w.jedn);
    } else if (s.kind === "button") {
      cz.push(s.any ? T("dowolny przycisk", "any button") : T("przycisk", "button"));
    }
    const b = String(r.behavior || "once");
    if (b === "dwell") cz.push(T("po " + liczba((r.dwellMs || 0) / 1000) + " s trzymania",
      "after " + liczba((r.dwellMs || 0) / 1000) + " s of holding"));
    else if (b === "multi" || b === "taps") cz.push((r.crossings || 2) + "×");
    else if (b === "hold") cz.push(T("przytrzymane", "held"));
    else if (b === "continuous") cz.push(T("ciągle", "continuously"));
    else if (b === "latch") cz.push(T("przełącznik", "a latch"));
    // Powód martwoty na końcu: to informacja o STANIE, nie o ruchu — ale w tej samej linijce,
    // żeby dało się ją przeczytać bez szukania.
    if (r.enabled === false) cz.push("⚠ " + T("wyciszony", "muted"));
    else if (+(r.layer || 0) > 0) cz.push("⚠ " + T("warstwa ", "layer ") + (+r.layer));
    return cz.filter(Boolean).join(" · ");
  }

  function regulyRoli(spec) {
    const s = String(spec || "").toLowerCase();
    return reguly.filter(function (x) {
      return x && String(x.keySpec || "").trim().toLowerCase() === s;
    });
  }

  // --- rozmowa z serwerem ------------------------------------------------------------------
  function pobierzReguly() {
    return fetch("/rules?dev=" + encodeURIComponent(DEV)).then(function (r) { return r.json(); })
      .then(function (j) {
        reguly = (j && Array.isArray(j.rules)) ? j.rules : [];
        rysuj();
        return reguly;
      }).catch(function () { return null; });
  }

  /* KONFIGURACJA SKANERA — jedna płaska po stronie serwera, dwie po stronie pól (parametry
     i wygląd). Podział robimy kluczami `RFScan.WYGLAD_DOM`, czyli tym samym słownikiem, z którego
     korzysta karta — nie własną listą, bo taka rozjeżdża się przy dokładaniu pokrętła. */
  function rozdziel(cfg) {
    const u = {}, w = {};
    const wygladKlucze = Object.keys(RFScan.WYGLAD_DOM || {});
    Object.keys(cfg || {}).forEach(function (k) {
      if (wygladKlucze.indexOf(k) >= 0) w[k] = cfg[k]; else u[k] = cfg[k];
    });
    return { u: Object.assign({}, RFScan.DOMYSLNE, u), w: Object.assign({}, RFScan.WYGLAD_DOM, w) };
  }

  function scal() {
    const out = Object.assign({}, ust);
    Object.keys(RFScan.WYGLAD_DOM || {}).forEach(function (k) { out[k] = wygl[k]; });
    out.enabled = !!wlaczony;
    return out;
  }

  function pobierzCfg() {
    return fetch("/scan?dev=" + encodeURIComponent(DEV)).then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j) return null;
        wlaczony = !!j.enabled;
        // ⚠️ NIE W ŚRODKU WŁASNEGO ZAPISU. Odpowiedź na cudzą zmianę (mysz w edytorze obszaru,
        // panel na drugim ekranie) przychodzi strumieniem także wtedy, gdy człowiek właśnie
        // trzyma suwak — przepisanie `ust` cofnęłoby mu rękę. Zaległy zapis i tak zaraz wyśle
        // wersję prawdziwszą, więc po prostu czekamy na jego koniec.
        if (!zapisTimer) {
          const r = rozdziel(j);
          ust = r.u; wygl = r.w;
          if (pola) pola.podepnij(ust, wygl);
        }
        rysujBrame();
        zbudujUstawienia();
        return j;
      }).catch(function () { return null; });
  }

  /* ZAPIS POKRĘTEŁ — z opóźnieniem i ze znacznikiem, dokładnie jak w karcie (`scanSave`).
     Opóźnienie, bo suwak wysyła zdarzenie przy każdym pikselu ruchu. Znacznik, bo odpowiedź na
     POPRZEDNI zapis potrafi wrócić po kolejnej zmianie i cofnąć to, co człowiek właśnie ustawił. */
  function zapiszUstawienia() {
    if (!ust) return;
    zapisNr += 1;
    clearTimeout(zapisTimer);
    zapisTimer = setTimeout(function () {
      const nr = zapisNr;
      zapisTimer = 0;
      stan(T("zapisuję…", "saving…"));
      fetch("/scan?dev=" + encodeURIComponent(DEV), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scal())
      }).then(function (r) { return r.json(); }).then(function (m) {
        if (!m || m.error) { stan(T("nie udało się zapisać", "could not save"), "zle"); return; }
        stan(T("zapisano ✓", "saved ✓"), "ok");
        // Serwer PRZYCINA (zakresy, słowa spoza listy), więc przyjmujemy jego wersję — ale tylko
        // wtedy, gdy nadal opisuje to, co widać na ekranie.
        if (nr !== zapisNr) return;
        const r = rozdziel(m);
        Object.assign(ust, r.u);
        Object.assign(wygl, r.w);
        if (pola) pola.odswiez();
      }).catch(function () { stan(T("nie udało się zapisać", "could not save"), "zle"); });
    }, 400);
  }

  /* ZAPIS REGUŁ — ZAWSZE ZE ŚWIEŻEJ LISTY.

     `POST /rules` nadpisuje listę CAŁĄ, a do tej samej listy pisze panel (Mapowanie, Kontroler,
     karta skanera) i drugie otwarte okno. Odesłanie migawki sprzed kilkunastu sekund cofnęłoby
     wszystko, co w międzyczasie ktoś zrobił — po cichu i bez jednego błędu w konsoli. Dlatego
     zmiana jest FUNKCJĄ nad świeżo pobraną listą, a nie gotową tablicą. */
  function zapiszReguly(zmien) {
    stan(T("zapisuję…", "saving…"));
    return fetch("/rules?dev=" + encodeURIComponent(DEV)).then(function (r) { return r.json(); })
      .then(function (j) {
        const lista = (j && Array.isArray(j.rules)) ? j.rules : [];
        const nowa = zmien(lista);
        if (!nowa) { stan(""); return null; }
        return fetch("/rules?dev=" + encodeURIComponent(DEV), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rules: nowa })
        }).then(function (r) { return r.json(); }).then(function (o) {
          if (!o || !o.ok) { stan(T("nie udało się zapisać", "could not save"), "zle"); return null; }
          stan(T("zapisano ✓", "saved ✓"), "ok");
          return pobierzReguly();
        });
      }).catch(function () {
        stan(T("nie udało się zapisać", "could not save"), "zle");
        return null;
      });
  }

  function przelaczRegule(id) {
    zapiszReguly(function (lista) {
      const x = lista.filter(function (r) { return r && r.id === id; })[0];
      if (!x) return null;
      x.enabled = (x.enabled === false);
      return lista;
    });
  }

  function usunRegule(id) {
    pytanie = "";
    zapiszReguly(function (lista) {
      const i = lista.map(function (r) { return r && r.id; }).indexOf(id);
      if (i < 0) return null;
      lista.splice(i, 1);
      return lista;
    });
  }

  function dodajGotowiec(spec) {
    const z = gotowce().filter(function (x) { return x.key === wybor[spec]; })[0];
    if (!z) {
      stan(T("najpierw wybierz ruch z listy", "pick a movement from the list first"), "zle");
      return;
    }
    if (typeof _skanNowaRegula !== "function") {
      // Świadoma odmowa — patrz nagłówek pliku. Lepiej powiedzieć „nie tutaj" niż zapisać regułę
      // o kształcie zgadniętym na miejscu.
      stan(T("katalog ruchów nie dojechał — dodaj w karcie Skaner",
        "the movement catalogue did not load — add it in the Scanner card"), "zle");
      return;
    }
    const regula = _skanNowaRegula(spec, z.rule, nazwaGotowca(z));
    zapiszReguly(function (lista) { lista.push(regula); return lista; }).then(function (ok) {
      if (!ok) return;
      dodajDo = "";
      wybor[spec] = "";
      rysuj();
      // KOLIZJA RUCHÓW: „Przechylenie w prawo" (roll > 35) i „Przytrzymane przechylenie w prawo"
      // (roll > 25) to dla kapsla JEDEN ruch. Kto doda pierwsze do sygnału, a drugie do cofania,
      // tym samym przechyleniem zrobi obie rzeczy naraz. Nie blokujemy — bywa to świadome —
      // ale mówimy w chwili, w której się dzieje. Ta sama zasada, co `_skanKolizja` w karcie.
      const src = regula.source || {};
      if (src.kind !== "filter") return;
      const kier = String(regula.cmp || ">").indexOf("<") >= 0 ? "-" : "+";
      const zderzenie = reguly.filter(function (x) {
        const s = (x && x.source) || {};
        if (!x || x.id === regula.id || s.kind !== "filter" || s.metric !== src.metric) return false;
        if (String(x.keySpec || "").toLowerCase() === String(regula.keySpec || "").toLowerCase()) return false;
        return (String(x.cmp || ">").indexOf("<") >= 0 ? "-" : "+") === kier;
      })[0];
      if (zderzenie) {
        stan(T("uwaga: „" + nazwaReguly(zderzenie) + "” odpala się tym samym ruchem",
          "careful: “" + nazwaReguly(zderzenie) + "” goes off on the same movement"), "zle");
      }
    });
  }

  /* WŁĄCZNIK MODUŁU — ta sama droga, co przełącznik w nagłówku karty (`POST /scan`).
     Konfigurację bierzemy ŚWIEŻĄ z serwera i podmieniamy w niej jedno pole: kopia rf-50h jest
     celowo przerobiona pod nakładkę (dociąganie, tryb), a spis sekcji i plansz serwer i tak
     zachowuje po swojej stronie. */
  function wlaczModul() {
    stan(T("włączam…", "switching on…"));
    fetch("/scan?dev=" + encodeURIComponent(DEV)).then(function (r) { return r.json(); })
      .then(function (swieza) {
        const doWyslania = Object.assign({}, swieza || {});
        doWyslania.enabled = true;
        return fetch("/scan?dev=" + encodeURIComponent(DEV), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(doWyslania)
        }).then(function (r) { return r.json(); });
      }).then(function (j) {
        if (!j || !j.ok) { stan(T("nie udało się włączyć", "could not switch on"), "zle"); return; }
        wlaczony = !!j.enabled;
        rysujBrame();
        stan(wlaczony ? T("moduł włączony ✓", "module on ✓") : "", wlaczony ? "ok" : "zle");
      }).catch(function () { stan(T("nie udało się włączyć", "could not switch on"), "zle"); });
  }

  // --- próba -------------------------------------------------------------------------------
  /* Próba to JEDNA rzecz: okno przestaje ignorować sygnały. Wszystko inne zostaje jak w podglądzie
     — nie klika, nie dotyka konfiguracji, nie wymaga włącznika modułu. Pasek stanu skanera (`#hud`)
     wraca na czas próby, bo to on mówi, w którym etapie jest przejazd; stawiamy go u GÓRY ekranu
     głównego, żeby nie nakładał się na pasek edytora obszaru na dole. */
  function probaUstaw(on) {
    proba = !!on;
    if (typeof N().proba === "function") N().proba(proba, probaWynik);
    if (!proba) ostatniaAkcja = null;
    ustawHud();
    odswiezProbe();
  }

  function ustawHud() {
    // Klasa PRZED wyjściem z funkcji: to ona pokazuje pasek stanu skanera i znacznik próby,
    // a wyjście „bez paska" nie może po cichu zostawić okna w stanie, którego nic nie widać.
    document.body.classList.toggle("rf-proba", proba);
    const h = $("hud");
    if (!h) return;
    if (!proba) { h.style.left = ""; h.style.top = ""; h.style.bottom = ""; return; }
    // Ekran GŁÓWNY, nie „ekran": okno rozciąga się na cały pulpit, więc 50% od lewej wypada przy
    // dwóch monitorach na ich styku. Liczy to już rf-50m dla swojego paska — bierzemy stamtąd.
    const g = (typeof E().ekranGlowny === "function") ? E().ekranGlowny() : null;
    h.style.bottom = "auto";
    h.style.top = Math.round(g ? g.y + 16 : 16) + "px";
    h.style.left = Math.round(g ? g.x + g.w / 2 : global.innerWidth / 2) + "px";
  }

  function sygnal(co) {
    // Pierwszy sygnał SAM zaczyna próbę: pytanie „czy na pewno chcesz przetestować" po naciśnięciu
    // przycisku „Sygnał" byłoby pytaniem o to, co człowiek właśnie zrobił.
    if (!proba) probaUstaw(true);
    mojSygnal = performance.now();
    fetch("/scan/sygnal?dev=" + encodeURIComponent(DEV), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ co: co })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) stan(T("aplikacja nie przyjęła sygnału", "the app did not take the signal"), "zle");
    }).catch(function () { stan(T("sygnał nie doszedł do aplikacji", "the signal did not reach the app"), "zle"); });
  }

  /* Sygnał przyszedł STRUMIENIEM — czyli tą samą drogą, co z kapsla. Komunikat nie niesie źródła,
     więc „z przycisku" poznajemy po tym, że sami wysłaliśmy go przed chwilą; token jest
     JEDNORAZOWY, żeby drugi sygnał w tym samym oknie czasu nie podszył się pod nasz. */
  function zanotujSygnal(co) {
    const moje = mojSygnal > 0 && (performance.now() - mojSygnal) < MOJ_SYGNAL_MS;
    if (moje) mojSygnal = 0;
    ostatniSygnal = { co: co, moje: moje, ts: Date.now() };
    if (co === "sygnal" || co === "start") ostatniaAkcja = null;   // nowy przejazd, stary wynik nieaktualny
    odswiezProbe();
  }

  function probaWynik(w) {
    ostatniaAkcja = w || null;
    odswiezProbe();
  }

  // --- rysowanie ---------------------------------------------------------------------------
  function zapamietajFokus() {
    const a = document.activeElement;
    const host = $("wyRole");
    if (!a || !host || !host.contains(a)) return null;
    return a.dataset ? (a.dataset.fk || null) : null;
  }

  function przywrocFokus(fk) {
    if (!fk) return;
    const host = $("wyRole");
    if (!host) return;
    const e = host.querySelector('[data-fk="' + String(fk).replace(/"/g, '\\"') + '"]');
    if (e && e.focus) { try { e.focus({ preventScroll: true }); } catch (x) { try { e.focus(); } catch (x2) { } } }
  }

  function buduj() {
    if ($("wyOkno")) return;
    const w = el(document.body, "div", "wy-okno");
    w.id = "wyOkno";
    w.setAttribute("role", "dialog");
    // Etykieta dla czytnika opisuje CAŁE okienko, nie bieżącą zakładkę — ta zmienia się w tytule.
    w.setAttribute("aria-label", T("Skaner nad pulpitem — ustawienia, wyzwalacze i próba",
      "The scanner over the desktop — settings, triggers and a trial"));

    // --- pasek tytułu: uchwyt do przeciągania, próba i zwijanie -----------------------------
    const glowa = el(w, "div", "wy-glowa");
    glowa.id = "wyGlowa";
    el(glowa, "span", "wy-chwyt", "∷").setAttribute("aria-hidden", "true");
    /* TYTUŁ MÓWI, CO SIĘ WIDZI — więc chodzi za zakładką (`ustawTytul`). Stało tu na sztywno
       „Czym sterujesz skanerem", czyli nazwa JEDNEJ z dwóch zakładek, i to od 23.09 tej drugiej.
       Zwinięte okienko pokazuje sam pasek tytułu, więc to jedyne zdanie, po którym poznaje się,
       co czeka w środku. */
    el(glowa, "b", "wy-tytul").id = "wyTytul";
    // ZNACZNIK PRÓBY W PASKU TYTUŁU. Zwinięte okienko chowa całą treść — łącznie ze zdaniem
    // „pasek jedzie i nic nie klika". To jedno słowo zostaje na wierzchu, bo próba zmienia
    // zachowanie okna i człowiek musi widzieć, że trwa, nawet gdy patrzy na ekran, nie na panel.
    el(glowa, "span", "wy-znacznik", T("PRÓBA", "TRIAL"));
    // PRZYCISK PRÓBY STOI W PASKU TYTUŁU, a nie tylko w treści — i to jest cała różnica między
    // „zwinięte" a „zamknięte": zwinięte okienko zajmuje pasek, a sygnał próbny wysyła się z niego
    // dalej, patrząc na ekran, a nie na panel.
    przycisk(glowa, "wy-btn wy-btn-proba", "🎯",
      T("Wyślij sygnał próbny — pasek pojedzie po prawdziwym ekranie, ale nic nie kliknie",
        "Send a trial signal — the bar runs across the real screen, but nothing gets clicked"),
      function () { sygnal("sygnal"); });
    przycisk(glowa, "wy-btn", "▾", T("Zwiń albo rozwiń okienko", "Collapse or expand the window"),
      function () { ustawZwiniete(!zwiniete); }).id = "wyZwin";
    przycisk(glowa, "wy-btn", "✕",
      T("Zamknij okienko — wrócisz do niego przyciskiem w pasku na dole",
        "Close the window — the button in the bar at the bottom brings it back"),
      function () { pokaz(false); });

    const cialo = el(w, "div", "wy-cialo");
    cialo.id = "wyCialo";

    // --- próba ------------------------------------------------------------------------------
    const pr = el(cialo, "div", "wy-proba");
    const rzad = el(pr, "div", "wy-rzad");
    przycisk(rzad, "wy-btn wy-btn-proba wy-szeroki", "🎯 " + T("Sygnał", "Signal"),
      T("To samo, co puknięcie w kapsel albo przechylenie głowy — tylko z przycisku",
        "The same as a tap on the capsule or a lean of the head — only from a button"),
      function () { sygnal("sygnal"); });
    przycisk(rzad, "wy-btn", "↶ " + T("Cofnij", "Step back"),
      T("Cofa pasek o krok", "Takes the bar back a step"), function () { sygnal("cofnij"); });
    przycisk(rzad, "wy-btn", "⏹ " + T("Stop", "Stop"),
      T("Przerywa przejazd", "Breaks off the sweep"), function () { sygnal("stop"); });
    przycisk(rzad, "wy-btn wy-btn-koniec", "■ " + T("Koniec próby", "End the trial"),
      T("Okno wraca do ignorowania sygnałów — pasek stoi, kapsel nic tu nie rusza",
        "The window goes back to ignoring signals — the bar stands still"),
      function () { probaUstaw(false); }).id = "wyKoniec";
    el(pr, "div", "wy-proba-stan").id = "wyProbaStan";
    el(pr, "div", "wy-proba-wynik").id = "wyProbaWynik";

    el(cialo, "div", "wy-brama").id = "wyBrama";

    /* DWIE ZAKŁADKI, BO TO DWA RÓŻNE PYTANIA: „jak ma jechać" i „czym to prowadzę". Razem
       w jednej płachcie okienko urosłoby ponad ekran, a nad pulpitem ma nie zasłaniać gry.

       ⚙ USTAWIENIA STOJĄ PIERWSZE I OTWIERAJĄ SIĘ DOMYŚLNIE (23.09: ustawienia i wyzwalacze
       zamienione miejscami, po włączeniu domyślnie aktywne są ustawienia).
       Nad pulpitem wraca się po pokrętła — prędkość, pasmo, czasy poprawia się przy każdej grze,
       a wyzwalacz dobiera się RAZ i potem tylko sprawdza. Kolejność zakładek ma odpowiadać temu,
       po co się tu przychodzi, a nie temu, co powstało pierwsze. */
    const zak = el(cialo, "div", "wy-zak");
    zak.setAttribute("role", "tablist");
    przycisk(zak, "wy-zakl", "⚙ " + T("Ustawienia", "Settings"),
      T("Wszystkie pokrętła skanera — te same, co w karcie", "Every scanner knob — the same ones as in the card"),
      function () { ustawZakladke("ustawienia"); }).id = "wyZakUst";
    przycisk(zak, "wy-zakl", "🎚️ " + T("Wyzwalacze", "Triggers"),
      T("Czym prowadzisz skaner", "What drives the scanner"),
      function () { ustawZakladke("wyzwalacze"); }).id = "wyZakWyz";

    el(cialo, "div", "wy-role").id = "wyRole";

    const ustr = el(cialo, "div", "wy-ust");
    ustr.id = "wyUst";
    el(ustr, "div", "wy-podpis", T(
      "Zmiana działa od razu — naciśnij „Sygnał”, żeby zobaczyć ją na tym ekranie.",
      "A change takes effect at once — press “Signal” to see it on this screen."));
    el(ustr, "div", "wy-zestawy").id = "wyZestawy";
    el(ustr, "div", "wy-zestawy-opis", T(
      "Zestaw przestawia wszystkie pokrętła od domyślnych. Obszar narysowany myszą zostaje.",
      "A set puts every knob back to the defaults and then its own. The area you drew with the mouse stays."));
    el(ustr, "div", "wy-pola").id = "wyPola";

    const stopka = el(cialo, "div", "wy-stopka");
    el(stopka, "span", null, T(
      "Próg i czas wyzwalacza ustawisz w Mapowaniu, a trening celności i kalibrację opóźnienia przejdziesz w karcie — potrzebują celów, których nad pulpitem nie ma.",
      "A trigger's threshold and timing are set in Mapping; the aim training and the delay calibration stay in the card — they need targets this window does not have."));
    el(stopka, "span", "wy-stan").id = "wyStan";

    glowa.addEventListener("mousedown", zacznijCiag);
    // ⚠️ MYSZ NIE MOŻE PRZEJŚĆ DALEJ. Warstwa edytora obszaru (`#edytor`) zaczyna rysować nową
    // ramkę od każdego wciśnięcia myszy, którego sama nie rozpozna — a okienko leży nad nią.
    w.addEventListener("mousedown", function (ev) { ev.stopPropagation(); });
    global.addEventListener("mousemove", ruszCiag);
    global.addEventListener("mouseup", skonczCiag);
  }

  function rysujBrame() {
    const b = $("wyBrama");
    if (!b) return;
    b.innerHTML = "";
    // Mówimy o bramce TYLKO wtedy, gdy realnie przeszkadza — i mówimy o właściwej. Sygnał próbny
    // z przycisku przechodzi zawsze (`/scan/sygnal` nie pyta o włącznik), więc zdanie musi być
    // o kapslu, inaczej człowiek uzna, że wszystko działa, bo przycisk działa.
    if (wlaczony !== false) { b.style.display = "none"; return; }
    b.style.display = "";
    el(b, "span", null, T(
      "Moduł Skaner jest wyłączony — sygnał z kapsla tu nie dojdzie (przycisk próby tak). Zatrzymanie przechodzi zawsze.",
      "The Scanner module is off — a signal from the capsule will not get through (the trial button will). Stopping always does."));
    przycisk(b, "wy-btn wy-btn-glowny", T("Włącz moduł", "Switch the module on"), "", wlaczModul);
  }

  function odswiezProbe() {
    const okno = $("wyOkno");
    if (okno) okno.classList.toggle("wy-proba-wl", proba);
    const s = $("wyProbaStan");
    if (s) {
      let tekst = proba
        ? T("PRÓBA — pasek jedzie po prawdziwym ekranie i NIC NIE KLIKA. Sygnał z kapsla też tu dojdzie.",
          "TRIAL — the bar runs across the real screen and CLICKS NOTHING. A signal from the capsule gets here too.")
        // ⚠️ POLSKI CUDZYSŁÓW ZAMYKAJĄCY TO `”`, NIE `"` — ten drugi kończy literał JS i zabija
        // całą stronę nakładki. Ta sama pułapka złapała już rf-50d dwa razy.
        : T("Naciśnij „Sygnał”, a pasek ruszy po ekranie. Nic nie kliknie — to próba.",
          "Press “Signal” and the bar starts across the screen. Nothing gets clicked — this is a trial.");
      if (ostatniSygnal) {
        const co = ostatniSygnal.co === "cofnij" ? T("cofnięcie", "step back")
          : ostatniSygnal.co === "stop" ? T("zatrzymanie", "stop") : T("sygnał", "signal");
        tekst += "  ✓ " + co + " · " + (ostatniSygnal.moje
          ? T("z przycisku", "from the button")
          : T("spoza tego okienka (kapsel albo panel)", "from outside this window (capsule or panel)"));
      }
      s.textContent = tekst;
    }
    const wy = $("wyProbaWynik");
    if (wy) {
      if (!ostatniaAkcja) { wy.textContent = ""; wy.style.display = "none"; }
      else {
        wy.style.display = "";
        const nazwa = (typeof RFScan === "object" && RFScan && RFScan.nazwaAkcji)
          ? RFScan.nazwaAkcji(ostatniaAkcja.akcja) : String(ostatniaAkcja.akcja || "");
        const p = ostatniaAkcja.punkt || { x: 0, y: 0 };
        const op = (typeof RFScan === "object" && RFScan && RFScan.akcja) ? RFScan.akcja(ostatniaAkcja.akcja) : null;
        // „Kopiuj"/„Wytnij" nie klikają (rf-50h `klikNaprawde`), więc próba nie może obiecywać punktu.
        wy.textContent = (op && op.bezKliku
          ? T("nacisnąłby bez kliku: ", "it would have pressed, without a click: ") + nazwa
            + " (" + String(op.klawisze || "").toUpperCase() + ")"
          : T("tutaj by kliknął: ", "it would have clicked here: ") + nazwa
            + " · " + Math.round(p.x) + " × " + Math.round(p.y) + " px")
          + " · " + T("po ", "after ") + (ostatniaAkcja.sygnaly || 0) + T(" sygnałach", " signals");
      }
    }
    const k = $("wyKoniec");
    if (k) k.style.display = proba ? "" : "none";
  }

  function rysuj() {
    const host = $("wyRole");
    if (!host) return;
    const fk = zapamietajFokus();
    host.innerHTML = "";

    const lista = role();
    if (!lista.length) {
      el(host, "div", "wy-pusto", T(
        "Katalog ról nie dojechał do tego okna — wyzwalacze ustawisz w karcie Skaner.",
        "The catalogue did not load in this window — set the triggers in the Scanner card."));
      return;
    }

    lista.forEach(function (s) {
      const box = el(host, "div", "wy-rola");
      const glowa = el(box, "div", "wy-rola-glowa");
      el(glowa, "span", "wy-rola-ikona", s.ikona).setAttribute("aria-hidden", "true");
      el(glowa, "b", "wy-rola-nazwa", T(s.pl, s.en));
      el(glowa, "span", "wy-rola-cel", T(s.celPl, s.celEn));

      const moje = regulyRoli(s.spec);
      if (!moje.length) {
        el(box, "div", "wy-rola-pusto", T(s.pustoPl, s.pustoEn));
      } else {
        moje.forEach(function (r) { box.appendChild(wiersz(r, s)); });
      }

      const otwartyWybor = (dodajDo === s.spec);
      const dodaj = przycisk(box, "wy-btn wy-rola-dodaj",
        otwartyWybor ? T("Zwiń", "Collapse")
          : (moje.length ? T("＋ dodaj drugi sposób", "＋ add another way")
            : T("＋ wybierz sposób", "＋ choose a way")),
        "", function () { dodajDo = otwartyWybor ? "" : s.spec; rysuj(); }, "dodaj:" + s.spec);
      dodaj.setAttribute("aria-expanded", otwartyWybor ? "true" : "false");
      if (otwartyWybor) box.appendChild(panelDodaj(s.spec));
    });

    przywrocFokus(fk);
  }

  function wiersz(r, s) {
    const id = r.id;
    const w = el(null, "div", "wy-wiersz" + (r.enabled === false ? " wy-wiersz-off" : ""));

    const przel = przycisk(w, "wy-przel" + (r.enabled === false ? "" : " wy-przel-wl"), "",
      T("Włącz albo wycisz ten wyzwalacz", "Switch this trigger on or mute it"),
      function () { przelaczRegule(id); }, "przel:" + id);
    el(przel, "span", "wy-przel-galka");
    przel.setAttribute("role", "switch");
    przel.setAttribute("aria-checked", r.enabled === false ? "false" : "true");

    const tekst = el(w, "div", "wy-wiersz-tekst");
    const nazwa = nazwaReguly(r);
    const n = el(tekst, "span", "wy-wiersz-nazwa", nazwa);
    n.title = nazwa;
    const jak = el(tekst, "span", "wy-wiersz-jak", opisReguly(r));
    jak.title = jak.textContent;

    if (pytanie === id) {
      /* PYTANIE ZAMIAST KOSZA — i to jest jedyna różnica wobec karty.
         W karcie kasowanie idzie z bąbelkiem „↶ Cofnij". Tego bąbelka w tym oknie nie ma i nie
         będzie (nad pulpitem nie stawiamy warstw, które trzeba zdążyć kliknąć), więc kasowanie
         musi pytać PRZED, a nie oferować odwrót PO. Pytanie stoi w samym wierszu, bo okno nad
         pulpitem nie ma gdzie postawić okna dialogowego, które nie zasłoniłoby ustawianego obszaru. */
      const ostatni = String(r.keySpec || "").toLowerCase() === "scan:sygnal" && r.enabled !== false
        && regulyRoli("scan:sygnal").filter(function (x) { return x.enabled !== false; }).length <= 1;
      const pyt = el(w, "span", "wy-pytanie", ostatni
        ? T("to jedyny sygnał — usunąć?", "this is your only signal — delete it?")
        : T("usunąć z całej aplikacji?", "delete from the whole app?"));
      pyt.title = T("Ten wyzwalacz żyje też w Mapowaniu — zniknie i tam.",
        "This trigger lives in Mapping too — it goes from there as well.");
      przycisk(w, "wy-btn wy-btn-usun", T("Usuń", "Delete"), "", function () { usunRegule(id); }, "tak:" + id);
      przycisk(w, "wy-btn", T("Zostaw", "Keep"), "", function () { pytanie = ""; rysuj(); }, "nie:" + id);
    } else {
      przycisk(w, "wy-btn wy-btn-ikona", "✕",
        T("Usuń ten wyzwalacz — zniknie też z Mapowania", "Delete this trigger — it goes from Mapping too"),
        function () { pytanie = id; rysuj(); }, "usun:" + id);
    }
    return w;
  }

  /* Wybór gotowego ruchu. W karcie są tu TRZY drzwi (gotowiec · połączenie z istniejącym
     wyzwalaczem · własny w Mapowaniu); tutaj zostaje pierwsze i tylko ono. Dwa pozostałe
     kończą się w edytorze Mapowania, czyli w panelu — obiecywanie ich w oknie, które panelu
     nie ma, byłoby drogą donikąd. Stopka mówi wprost, gdzie jest reszta. */
  function panelDodaj(spec) {
    const p = el(null, "div", "wy-dodaj");
    const rzad = el(p, "div", "wy-rzad");
    const sel = document.createElement("select");
    sel.className = "wy-wybor";
    sel.dataset.fk = "sel:" + spec;
    sel.setAttribute("aria-label", T("Wybierz gotowy ruch", "Choose a ready-made movement"));
    const pusty = document.createElement("option");
    pusty.value = "";
    pusty.textContent = T("— wybierz ruch —", "— choose a movement —");
    sel.appendChild(pusty);
    // Grupy jak w karcie: osoba, która przycisku nacisnąć NIE MOŻE, ma zobaczyć swoje drogi jako
    // pierwsze, zamiast trafiać na „Puknięcie w kapsel".
    const grupy = [
      { wymaga: "ruch", label: T("Sam ruch kapsla — bez naciskania", "Capsule movement only — nothing to press") },
      { wymaga: "przycisk", label: T("Wymaga przycisku na kapslu", "Needs the button on the capsule") },
      { wymaga: "nagranie", label: T("Twój własny, nagrany gest", "Your own recorded gesture") }
    ];
    const zrodla = gotowce();
    grupy.forEach(function (g) {
      const czesc = zrodla.filter(function (z) { return z.wymaga === g.wymaga; });
      if (!czesc.length) return;
      const og = document.createElement("optgroup");
      og.label = g.label;
      czesc.forEach(function (z) {
        const o = document.createElement("option");
        o.value = z.key;
        o.textContent = nazwaGotowca(z);
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    sel.value = wybor[spec] || "";
    rzad.appendChild(sel);
    const opis = el(p, "div", "wy-dodaj-opis");
    const odswiezOpis = function () {
      const z = zrodla.filter(function (x) { return x.key === sel.value; })[0];
      opis.textContent = z ? opisGotowca(z)
        : T("Reguła powstanie gotowa — z progiem i czasem.", "The rule is created complete, threshold and timing included.");
    };
    odswiezOpis();
    sel.addEventListener("change", function () { wybor[spec] = sel.value; odswiezOpis(); });
    przycisk(rzad, "wy-btn wy-btn-glowny", T("Dodaj", "Add"), "", function () { dodajGotowiec(spec); }, "plus:" + spec);
    return p;
  }

  // --- ustawienia skanera --------------------------------------------------------------------
  /* POKRĘTŁA SĄ TE SAME, CO W KARCIE — i to nie jest oszczędność, tylko warunek, żeby okno
     mówiło prawdę. `RFScan.Panel` (rf-50b) buduje wszystkie pola z jednego opisu, łącznie
     z regułą, KTÓRE z nich mają sens w bieżącym trybie („suwak, który nic nie zmienia, uczy
     człowieka, że aplikacja kłamie"). Tutaj nie ma ani jednego własnego pola: nowe pokrętło
     pojawi się w obu miejscach samo. */
  function zbudujUstawienia() {
    const host = $("wyPola");
    if (!host || pola || !ust) return;
    if (typeof RFScan.Panel !== "function") {
      el(host, "div", "wy-pusto", T("Pokrętła nie dojechały do tego okna — ustawisz je w karcie Skaner.",
        "The knobs did not load in this window — set them in the Scanner card."));
      return;
    }
    pola = new RFScan.Panel(host, {
      ustawienia: ust, wyglad: wygl,
      naZmiane: function () { zapiszUstawienia(); }
    });
    pola.zbuduj();
    const zesp = $("wyZestawy");
    if (zesp && RFScan.ui && typeof RFScan.ui.zestawy === "function") {
      // Podstawiamy WŁASNY „panel" z jedną metodą — pasek zestawów woła tylko ją, a nam pozwala
      // to zachować obszar (patrz `OBSZAR_KLUCZE`).
      RFScan.ui.zestawy(zesp, { zastosujZestaw: zestaw }, null);
    }
  }

  function zestaw(kod) {
    if (!pola || !ust) return;
    const zachowane = {};
    OBSZAR_KLUCZE.forEach(function (k) { zachowane[k] = ust[k]; });
    pola.zastosujZestaw(kod);                       // sam woła `naZmiane`, czyli planuje zapis
    OBSZAR_KLUCZE.forEach(function (k) { ust[k] = zachowane[k]; });
    pola.odswiez();
    zapiszUstawienia();                             // zapis pójdzie już z obszarem na miejscu
    stan(T("zestaw wczytany", "set applied"), "ok");
  }

  function ustawTytul() {
    const t = $("wyTytul");
    if (!t) return;
    t.textContent = (zakladka === "ustawienia")
      ? "⚙ " + T("Ustawienia skanera", "Scanner settings")
      : "🎚️ " + T("Czym sterujesz skanerem", "What drives the scanner");
  }

  function ustawZakladke(nazwa) {
    zakladka = (nazwa === "ustawienia") ? "ustawienia" : "wyzwalacze";
    ustawTytul();
    const role = $("wyRole"), ustr = $("wyUst");
    if (role) role.style.display = (zakladka === "wyzwalacze") ? "" : "none";
    if (ustr) ustr.style.display = (zakladka === "ustawienia") ? "" : "none";
    [["wyZakWyz", "wyzwalacze"], ["wyZakUst", "ustawienia"]].forEach(function (p) {
      const b = $(p[0]);
      if (!b) return;
      b.classList.toggle("wy-zakl-wl", zakladka === p[1]);
      b.setAttribute("aria-selected", zakladka === p[1] ? "true" : "false");
    });
    if (zakladka === "ustawienia") zbudujUstawienia();
  }

  // --- okienko: pozycja, zwijanie, pokazywanie ----------------------------------------------
  function ustawPozycje(x, y) {
    const okno = $("wyOkno");
    if (!okno) return;
    const r = okno.getBoundingClientRect();
    const maxX = Math.max(0, global.innerWidth - Math.max(120, r.width));
    const maxY = Math.max(0, global.innerHeight - Math.max(34, r.height));
    poz = { x: Math.max(0, Math.min(maxX, x)), y: Math.max(0, Math.min(maxY, y)) };
    okno.style.left = Math.round(poz.x) + "px";
    okno.style.top = Math.round(poz.y) + "px";
  }

  function pozycjaStartowa() {
    // Prawy górny róg EKRANU GŁÓWNEGO: obszary skanera rysuje się zwykle na środku gry, a pasek
    // edytora stoi na dole. Bez wiedzy o monitorach (przychodzi później) zostaje róg widoku.
    const g = (typeof E().ekranGlowny === "function") ? E().ekranGlowny() : null;
    const szer = 344;
    if (g) return { x: g.x + g.w - szer - 24, y: g.y + 24 };
    return { x: Math.max(0, global.innerWidth - szer - 24), y: 24 };
  }

  function ustawZwiniete(on) {
    zwiniete = !!on;
    const okno = $("wyOkno");
    if (okno) okno.classList.toggle("wy-zwiniete", zwiniete);
    const b = $("wyZwin");
    if (b) {
      b.textContent = zwiniete ? "▸" : "▾";
      b.setAttribute("aria-expanded", zwiniete ? "false" : "true");
    }
    zapiszStan();
  }

  function pokaz(on) {
    otwarte = !!on;
    const okno = $("wyOkno");
    /* ⚠️ KLASA, NIE `style.display`. Schowany edytor obszaru (oczko 🙈 w pasku) chowa też to
       okienko — arkuszem, bo w tamtym stanie serwer przepuszcza mysz do pulpitu wszędzie poza
       oczkiem, więc widoczny, a nieklikalny panel byłby kłamstwem. Reguła z arkusza przegrałaby
       ze stylem wpisanym w element, a `!important` w tym oknie nie używamy. */
    if (okno) okno.classList.toggle("wy-schowane", !otwarte);
    // Zamknięcie okienka kończy próbę: zostawiona działałaby dalej, a jedyne, co o niej mówi,
    // właśnie zeszło z ekranu.
    if (!otwarte && proba) probaUstaw(false);
    if (otwarte) { pobierzReguly(); pobierzCfg(); }
    zapiszStan();
    return otwarte;
  }

  function zacznijCiag(ev) {
    if (ev.button !== 0) return;
    if (ev.target && ev.target.closest && ev.target.closest("button")) return;   // guziki paska nie ciągną
    const okno = $("wyOkno");
    if (!okno) return;
    const r = okno.getBoundingClientRect();
    ciag = { dx: ev.clientX - r.left, dy: ev.clientY - r.top };
    document.body.classList.add("wy-ciagnie");
    ev.preventDefault();
    ev.stopPropagation();
  }

  function ruszCiag(ev) {
    if (!ciag) return;
    ustawPozycje(ev.clientX - ciag.dx, ev.clientY - ciag.dy);
  }

  function skonczCiag() {
    if (!ciag) return;
    ciag = null;
    document.body.classList.remove("wy-ciagnie");
    zapiszStan();
  }

  function zapiszStan() {
    try {
      localStorage.setItem(KLUCZ, JSON.stringify({
        x: poz ? Math.round(poz.x) : null, y: poz ? Math.round(poz.y) : null,
        zwiniete: zwiniete, otwarte: otwarte
      }));
    } catch (e) { }
  }

  function wczytajStan() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KLUCZ) || "null"); } catch (e) { s = null; }
    // PIERWSZE OTWARCIE: okienko stoi, ale ZWINIĘTE. Widać, że jest, i widać przycisk próby —
    // a nie zasłania gry, nad którą człowiek właśnie ustawia obszary. Kto je rozwinie, ten
    // zastanie je rozwinięte następnym razem.
    if (!s || typeof s !== "object") return { x: null, y: null, zwiniete: true, otwarte: true };
    return {
      x: (typeof s.x === "number") ? s.x : null,
      y: (typeof s.y === "number") ? s.y : null,
      zwiniete: s.zwiniete !== false,
      otwarte: s.otwarte !== false
    };
  }

  // --- start ---------------------------------------------------------------------------------
  buduj();
  const zapisany = wczytajStan();
  ustawZwiniete(zapisany.zwiniete);
  otwarte = zapisany.otwarte;
  const okno = $("wyOkno");
  if (okno) okno.classList.toggle("wy-schowane", !otwarte);
  if (zapisany.x != null && zapisany.y != null) ustawPozycje(zapisany.x, zapisany.y);
  else { const p0 = pozycjaStartowa(); ustawPozycje(p0.x, p0.y); }
  odswiezProbe();
  rysujBrame();
  ustawZakladke(zakladka);
  pobierzReguly();
  pobierzCfg();
  /* UKŁAD MONITORÓW DLA PÓL OBSZARU. Rf-50h trzyma go u siebie i celowo nie wypełnia wspólnego
     cache'u modelu (nie ładuje panelu) — a pola „Ekran" i przełącznik „procent / piksele" czytają
     właśnie ten cache (`RFScan.ekrany`, `NS.ekranyOpcje`, `NS.przeliczJednostke`). Bez niego lista
     ekranów byłaby pusta, a zmiana jednostki przeniosłaby obszar w róg. Jedno pytanie na okno.  */
  fetch("/screens?dev=" + encodeURIComponent(DEV)).then(function (r) { return r.json(); })
    .then(function (j) {
      if (j && j.desktop && typeof RFScan.ustawEkrany === "function") RFScan.ustawEkrany(j);
      if (pola) pola.odswiez();
    }).catch(function () { });

  /* Układ monitorów przychodzi PÓŹNIEJ niż ta strona (ładuje go rf-50h), a bez niego nie wiadomo,
     gdzie kończy się ekran główny — okienko stanęłoby w rogu całego pulpitu, czyli na drugim
     monitorze. Jedno spóźnione ustawienie załatwia sprawę i tylko wtedy, gdy człowiek sam go
     jeszcze nie przesunął. */
  if (zapisany.x == null) setTimeout(function () {
    if (!ciag && poz) { const p1 = pozycjaStartowa(); ustawPozycje(p1.x, p1.y); }
  }, 1400);

  // Strumień: reguły zmienione gdzie indziej (panel, druga sesja), przełącznik modułu i sygnały.
  if (typeof N().naStrumien === "function") {
    N().naStrumien(function (m) {
      if (!m || (m.dev && m.dev !== DEV)) return;
      if (m.t === "rules") { reguly = Array.isArray(m.rules) ? m.rules : reguly; rysuj(); }
      else if (m.t === "scan_cfg") pobierzCfg();
      else if (m.t === "scan") zanotujSygnal(m.co);
    });
  }

  /* Dla paska edytora (rf-50m) i dla harnessu. `proba` bez argumentu odpowiada, czy trwa —
     tak samo jak `podglad()` w rf-50m. */
  global.RFScanWyzwalacze = {
    pokaz: pokaz,
    przelacz: function () { return pokaz(!otwarte); },
    otwarte: function () { return otwarte; },
    zwin: ustawZwiniete,
    zwiniete: function () { return zwiniete; },
    proba: function (on) { if (on === undefined) return proba; probaUstaw(on); return proba; },
    sygnal: sygnal,
    reguly: function () { return reguly.slice(); },
    zakladka: function (nazwa) { if (nazwa === undefined) return zakladka; ustawZakladke(nazwa); return zakladka; },
    ustawienia: function () { return ust ? Object.assign({}, ust) : null; },
    odswiez: function () { pobierzReguly(); pobierzCfg(); }
  };
})(window);
