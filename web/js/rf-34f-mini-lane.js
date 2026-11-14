"use strict";
// ==================================================================================================
// MINIATURA PODGLĄDU — PAS NACIŚNIĘĆ PRZYCISKU KAPSLA (rysowanie + czas trzymania)
//
// Wydzielony z `rf-34c-rcol.js` 2026-08-30 (etap 9b), gdy tamten plik przekroczył 542 linie przy
// limicie miękkim 500 z `.github/CONTRIBUTING.md`. Granica nie jest z rozpaczy: pas jest
// jedynym kaflem miniatury, który rysuje ZDARZENIA, a nie przebieg — ma własny kształt (kreska +
// pasek trzymania + aureola świeżości), własny odczyt w nagłówku i własne formatowanie czasu.
// Reszta rf-34c to sparkline'y i kula.
//
// CO PRZYSZŁO Z ETAPEM 9b: wyższy pas naciśnięć i widoczny czas
// naciśnięcia. Pas urósł z 16 na 30 px, a czas trzymania pokazujemy DWOMA drogami naraz, bo jedna
// nie wystarcza przy tej szerokości:
//   • WEWNĄTRZ paska — dla naciśnięć na tyle długich, że napis się w nich mieści. Przy oknie 10 s
//     i szerokości ~242 px jedna sekunda to ~24 px, więc podpis „340 ms" (~28 px) mieści się dopiero
//     od ~1,4 s trzymania. Krótsze zostają samą kreską, żeby seria kliknięć nie zamieniła się
//     w kaszę zachodzących liczb (`_labR` pilnuje dodatkowo odstępu między kolejnymi napisami).
//   • W NAGŁÓWKU pasa („ostatnie 340 ms") — to jest odpowiedź dla KRÓTKIEGO kliknięcia, którego
//     pasek ma szerokość jednego piksela. Nagłówek, a nie róg płótna: „teraz" jest przy prawej
//     krawędzi pasa, więc świeże naciśnięcie wjeżdżałoby pod napis dokładnie wtedy, gdy jest
//     najbardziej potrzebne. Zarezerwowanie szerokości na napis też odpada — zwęziłoby oś czasu
//     i pas przestałby leżeć na tym samym ułamku szerokości, co przebiegi nad nim.
//
// SKĄD DANE. `VB().btnPresses` (rf-08 składa je z bitu przycisku w pakiecie statusu 0x21: zbocze
// w dół otwiera wpis `{a}`, zbocze w górę domyka go `{b}`) — ten sam bufor, z którego rysuje
// `drawBtnLane()` i `drawOvPress()`. Okno czasu bierzemy z `rfRcolMini._span` (rf-34c), czyli
// WSPÓLNE z przebiegami; własnej kopii tej arytmetyki tu nie ma i mieć nie może.
// ==================================================================================================
(function (global) {
  const NS = global.rfRcolMini = global.rfRcolMini || {};
  const el = (t, c, x) => NS._el(t, c, x);
  const SVGNS = "http://www.w3.org/2000/svg";

  // Ikona pasa naciśnięć: pierścień z kropką w środku — „coś zostało wciśnięte". SVG, nie emoji
  // (kanon dla interaktywnego UI): jeden stroke `currentColor`, więc
  // ikona bierze kolor podpisu i sama chodzi za motywem jasny/ciemny.
  function pressIcon() {
    const s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("class", "rf-mini-ic"); s.setAttribute("viewBox", "0 0 16 16");
    s.setAttribute("aria-hidden", "true"); s.setAttribute("focusable", "false");
    const ring = document.createElementNS(SVGNS, "circle");
    ring.setAttribute("cx", "8"); ring.setAttribute("cy", "8"); ring.setAttribute("r", "5.6");
    ring.setAttribute("fill", "none"); ring.setAttribute("stroke", "currentColor"); ring.setAttribute("stroke-width", "1.4");
    const dot = document.createElementNS(SVGNS, "circle");
    dot.setAttribute("cx", "8"); dot.setAttribute("cy", "8"); dot.setAttribute("r", "2.3");
    dot.setAttribute("fill", "currentColor");
    s.appendChild(ring); s.appendChild(dot);
    return s;
  }

  // PAS NACIŚNIĘĆ — OSOBNY WIERSZ NA CAŁĄ SZEROKOŚĆ SIATKI (2026-08-30, etap 8; wcześniej siedział
  // w kaflu kanałów 0-2). Uzasadnienie zamiany i co przy niej zostało nietknięte — w nagłówku pliku.
  // ŚWIADOMIE BEZ `.rf-mini`, czyli bez ramki i tła kafla. Pas nie jest piątym kaflem rodziny 2×2 —
  // jest PASEM pod nimi, tak jak `btnLane` na dużej karcie nie ma własnej ramki, tylko leży pod
  // oscyloskopem. Powód jest też arytmetyczny: obudowa kafla (2×1 px obwódki + 13 px wcięć) kosztuje
  // 15 px wysokości, a prawa kolumna przy 1440×900 nie ma czego oddać (patrz 20-cols.css). Samo
  // płótno ma własne tło i obwódkę, więc pas i bez kafla czyta się jak pas.
  function laneRow() {
    const box = el("div", "rf-mini-lane");
    const t = el("div", "rf-mini-t rf-mini-lt");
    t.appendChild(pressIcon());
    t.appendChild(document.createTextNode("Naciśnięcia"));
    t.appendChild(laneLast());
    box.appendChild(t);
    const c = document.createElement("canvas");
    c.className = "rf-btnlane"; c.id = "rfMiniBtn";
    c.setAttribute("aria-hidden", "true");     // obraz bez treści do odczytania — opis niesie podpis
    box.appendChild(c);
    // Podpowiedź na CAŁYM kaflu, nie na samym podpisie: pas jest teraz szeroki, więc kursor częściej
    // ląduje na płótnie niż na dwóch słowach nad nim. Zdanie zostaje słowo w słowo — „ta sama oś
    // czasu" dalej jest prawdą (wspólne `_span`), a zmiana brzmienia zerwałaby klucz w rf-01-i18n.
    box.title = "Naciśnięcia przycisku kapsla — kreska to moment wciśnięcia, pasek to czas trzymania; ta sama oś czasu co przebieg wyżej";
    return box;
  }

  // CZAS OSTATNIEGO NACIŚNIĘCIA W NAGŁÓWKU PASA (etap 9b): wyższy pas
  // i widoczny czas naciśnięcia.
  //
  // DLACZEGO W NAGŁÓWKU, A NIE W ROGU PŁÓTNA. Pas rysuje okno 10 s, a „teraz" jest przy jego PRAWEJ
  // krawędzi — czyli dokładnie tam, gdzie chciałby usiąść róg z odczytem. Świeże naciśnięcie
  // wjeżdżałoby pod napis w chwili, w której jest najbardziej potrzebne. Zarezerwowanie pasa
  // szerokości na napis też odpada: zwęziłoby oś czasu i pas przestałby leżeć na tym samym ułamku
  // szerokości, co przebiegi nad nim (wspólne `_span`). Nagłówek ma wolne miejsce po prawej i nie
  // koliduje z niczym.
  // Napis „ostatnie" jest OSOBNYM węzłem tekstowym, a nie sklejony z liczbą: walker i18n tłumaczy
  // całe napisy, więc „ostatnie 340 ms" byłoby nowym kluczem przy każdej innej liczbie.
  function laneLast() {
    const w = el("span", "rf-lane-last");
    w.id = "rfMiniBtnLast"; w.hidden = true;
    w.appendChild(el("span", "rf-lane-lastk", "ostatnie"));
    w.appendChild(document.createTextNode(" "));
    const v = document.createElement("b"); v.id = "rfMiniBtnLastV";
    w.appendChild(v);
    return w;
  }

  // Czas trzymania po ludzku: milisekundy do sekundy, potem sekundy z jednym miejscem. Separator
  // dziesiętny idzie za językiem — „1,4 s" po polsku, „1.4 s" po angielsku.
  function _dur(ms) {
    if (!(ms >= 0)) return "";
    if (ms < 1000) return Math.round(ms) + " ms";
    const dec = (typeof _gl === "function") ? _gl(",", ".") : ",";
    return (ms / 1000).toFixed(1).replace(".", dec) + " s";
  }

  // ---- pas naciśnięć przycisku ---------------------------------------------------------------------
  // KSZTAŁT NACIŚNIĘCIA jest przepisany z dużej karty (`drawBtnLane`) i ze ściągi (`drawOvPress`):
  // pełna kreska w momencie wciśnięcia, pasek tak długi, jak długo przycisk był trzymany, koniec
  // kreską przerywaną, dopóki palec leży. Krótkie tapnięcie i dwusekundowe trzymanie MUSZĄ wyglądać
  // inaczej, bo dokładnie tym różni się reguła „Jednorazowo" od „Po czasie".
  // CZEGO TU NIE MA: 52-pikselowego marginesu dużej karty (miniatura nie ma opisanej osi, więc pas
  // zaczyna się od zera szerokości) i podpisu z czasem trzymania. Ta druga rzecz od etapu 8 BY SIĘ
  // ZMIEŚCIŁA — pas ma ~242 px zamiast ~99 px — i celowo jej nie dokładamy: zlecenie brzmiało
  // „forma zdarzeń bez zmian", a liczba w pasku to już odczyt, czyli robota dużej karty.
  // CO DOSZŁO: OBWÓDKA ŚWIEŻOŚCI. Pas pokazuje okno 10 s, więc naciśnięcie sprzed dziewięciu sekund
  // wygląda tak samo jak sprzed pół sekundy — a pytanie brzmi „czy TERAZ nacisnąłem". Przez pierwsze
  // 1,2 s kropka na kresce dostaje gasnącą aureolę, którą łapie kątem oka.
  const FRESH_S = 1.2;
  function _lane(c) {
    if (!c || !c.offsetParent) return;
    const ff = (typeof fit === "function") ? fit(c) : null;
    if (!ff || !ff.w || !ff.h) return;
    const { ctx, w, h } = ff;
    ctx.clearRect(0, 0, w, h);
    if (typeof VB !== "function") return;
    const B = VB(); if (!B) return;
    const sp = NS._span(B); if (!sp) return;
    const { start, win, end } = sp;
    const CV = (typeof cv === "function") ? cv : () => "#888";
    const bad = CV("--bad");

    ctx.strokeStyle = CV("--line"); ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h - 1.5); ctx.lineTo(w, h - 1.5); ctx.stroke();
    ctx.globalAlpha = 1;

    const pr = B.btnPresses || [];
    const X = t => (t - start) / win * w;
    const yTop = 2.5, yBot = h - 2.5;
    let any = false, freshAge = null, freshX = 0;
    // CZAS TRZYMANIA WPISANY W PASEK (etap 9b). Rysowany dopiero wtedy, gdy pasek jest szerszy niż
    // sam napis — inaczej seria szybkich klików zamieniłaby się w kaszę zachodzących na siebie
    // liczb, a to gorzej niż brak liczby. Krótkie kliknięcie ma swój odczyt w nagłówku pasa
    // (`laneLast`), więc nic się nie gubi: pasek pokazuje „ile trwały te dłuższe", nagłówek
    // „ile trwało ostatnie". `_labR` pilnuje odstępu między kolejnymi napisami.
    let _labR = -1e9, lastMs = null, lastHeld = false;
    ctx.font = "9px " + CV("--mono");
    ctx.textBaseline = "middle";
    for (let i = 0; i < pr.length; i++) {
      const p = pr[i]; if (!p || p.a == null) continue;
      const held = (p.b == null), t1 = held ? end : p.b;
      if (t1 < start || p.a > end) continue;                       // całe poza oknem
      any = true;
      const x0 = Math.max(0, X(p.a)), x1 = Math.min(w, X(t1));
      if (x1 - x0 > 0.7) {                                          // ciało paska = czas trzymania
        ctx.globalAlpha = held ? 0.28 : 0.18; ctx.fillStyle = bad;
        ctx.fillRect(x0, yTop, Math.max(1, x1 - x0), yBot - yTop);
        ctx.globalAlpha = held ? 0.8 : 0.55; ctx.strokeStyle = bad; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, yTop + 0.5); ctx.lineTo(x1, yTop + 0.5); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = bad; ctx.lineWidth = 1.8;                   // moment wciśnięcia
      ctx.beginPath(); ctx.moveTo(x0, yBot); ctx.lineTo(x0, yTop); ctx.stroke();
      ctx.fillStyle = bad; ctx.beginPath(); ctx.arc(x0, yTop + 0.5, 2.2, 0, 7); ctx.fill();
      if (x1 - x0 > 1.5) {                                          // koniec: pełny / przerywany
        ctx.lineWidth = 1; ctx.globalAlpha = held ? 0.6 : 0.85;
        if (held) ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(x1, yBot); ctx.lineTo(x1, yTop + 1); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      // Napis WEWNĄTRZ paska trzymania, wyśrodkowany. Kolor tekstu strony, nie czerwień paska:
      // czerwone na czerwonym półprzezroczystym jest nieczytelne, a pasek i tak mówi już „to jest
      // naciśnięcie" swoim kształtem.
      const ms = (t1 - p.a) * 1000;
      const txt = _dur(ms);
      const tw = ctx.measureText(txt).width;
      if (x1 - x0 >= tw + 8 && x0 > _labR + 5) {
        ctx.globalAlpha = 0.92; ctx.fillStyle = CV("--ink");
        ctx.textAlign = "center";
        ctx.fillText(txt, (x0 + x1) / 2, (yTop + yBot) / 2);
        ctx.globalAlpha = 1;
        _labR = x1;
      }
      // „Ostatnie" bierzemy z ostatniego przebiegu pętli — `btnPresses` jest chronologiczne
      // (rf-08 dokłada wpis na zboczu w dół), więc ostatni w oknie jest po prostu najnowszy.
      lastMs = ms; lastHeld = held;
      const age = end - p.a;
      if (age >= 0 && age < FRESH_S && (freshAge == null || age < freshAge)) { freshAge = age; freshX = x0; }
    }
    ctx.textBaseline = "alphabetic";
    _laneLast(lastMs, lastHeld);
    if (freshAge != null) {
      const k = 1 - freshAge / FRESH_S;
      ctx.globalAlpha = 0.55 * k; ctx.strokeStyle = bad; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(freshX, yTop + 0.5, 2.2 + 5.5 * (1 - k), 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (!any) {
      // Ta sama fraza, co na ściądze (`drawOvPress`) — pusty pas ma znaczyć „nikt nie nacisnął",
      // a nie „coś się zepsuło".
      ctx.fillStyle = CV("--dim"); ctx.globalAlpha = 0.75;
      ctx.font = "12px " + CV("--sans");   // podłoga ramy 12 px (UX 261120)
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText((typeof _gl === "function") ? _gl("bez naciśnięć", "no presses") : "bez naciśnięć", 2, h / 2);
      ctx.textBaseline = "alphabetic"; ctx.globalAlpha = 1;
    }
  }

  // Odczyt w nagłówku pasa. DOM ruszany wyłącznie przy zmianie napisu — ten sam powód, co przy
  // `_poseSet` w rf-14: przy trzymanym przycisku liczba rośnie co klatkę, ale zaokrąglona do
  // milisekund powtarza się przez większość z nich, a każdy zapis budzi MutationObserver walkera.
  let _llLast = null;
  function _laneLast(ms, held) {
    const box = document.getElementById("rfMiniBtnLast");
    if (!box) return;
    const v = document.getElementById("rfMiniBtnLastV");
    const txt = (ms == null) ? "" : (_dur(ms) + (held ? "…" : ""));
    if (txt === _llLast) return;
    _llLast = txt;
    box.hidden = !txt;
    if (v && txt) v.textContent = txt;
  }

  NS.laneRow = laneRow;
  NS.drawLane = _lane;
})(window);
