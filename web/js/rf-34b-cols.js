"use strict";
// ==================================================================================================
// UKŁAD TRZECH KOLUMN — siatka, chowanie paneli i sekcja „Co wychodzi z tego kapsla".
//
// Wydzielone z rf-34-tabs.js, bo tamten plik trzyma jeszcze cały poradnik Mapowania w treści i
// dołożenie tu wszystkiego przebiłoby twardy limit 800 linii (.github/CONTRIBUTING.md).
// Ładowane PO rf-34-tabs.js i PRZED rf-40-boot.js: initTabs() woła rfCols.build() dopiero z
// bootstrapu, więc sama kolejność deklaracji wystarczy.
//
// LEWA (206 px)  — portret aktywnego kapsla ze strzałkami, a pod nim nawigacja: „Moduł" (to, co coś
//                  WYSYŁA z kapsla; ma przełącznik i kropkę stanu) oraz „Reszta" (ekrany, które nic
//                  nie wysyłają). Przyciski są TE SAME, które zbudował rf-34 — przenoszone przez
//                  appendChild, nigdy nie odtwarzane: mają już podpięty klik, kropkę i osobny
//                  <span> etykiety, po którym tłumaczy je walker.
// ŚRODEK         — panele zakładek; jedyna część, która się przewija.
// PRAWA (274 px) — hub kapsli z rf-11 W CAŁOŚCI (przenoszony jednym appendChild, więc delegowany
//                  nasłuch na #deviceSel jedzie razem z nim), przycisk „Przegląd wszystkich
//                  kapsli", podgląd na żywo (#railFold) i lista wyjść.
//
// ZWIJANIE. Lewy panel zwija się do paska ikon (54 px), a NIE do zera: nawigacja jest jedyną drogą
// między modułami. Prawy zwija się do pionowej zakładki (38 px), ale kapsle ZOSTAJĄ jako klikalne
// kolorowe kropki — bez nich zwinięcie odcinałoby najczęstszy ruch w całej aplikacji. Etykiety
// chowa CSS przez max-width i opacity, nigdy przez display:none (tego nie da się animować).
//
// „PRZEGLĄD WSZYSTKICH KAPSLI" to nie jest osobny przycisk obok zakładki, tylko SAM przycisk
// zakładki `przeglad` przeniesiony tutaj i podpisany pełnym zdaniem. Dzięki temu podświetla się
// sam (setTab nadaje mu `active`), nie trzeba go z niczym synchronizować i nie ma dwóch dróg
// wejścia, które mogłyby się rozjechać.
// ==================================================================================================
(function (global) {
  const LS = { lp: "ribbitflip.panel.lp", rp: "ribbitflip.panel.rp" };
  let _tabs = null, _btns = null;

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function sect(txt) { return el("div", "rf-sect", txt); }

  // ---- chowanie paneli --------------------------------------------------------------------------
  // GROT ZWIJANIA JAKO IKONA SVG, NIE ZNAK Z FONTU (2026-08-30, etap 8). Do tej pory stało tu
  // `b.textContent = "«" / "»"`, czyli znak typograficzny — obok 15-pikselowego, kreślonego oka
  // „Widoczności" w tym samym pasku. Dwa różne języki ikon w jednym miejscu; kanon aplikacji dla
  // interaktywnego UI to ikony SVG (zasada z `.github/CONTRIBUTING.md`).
  // Drugi powód jest RUCHOWY: podmiana treści przeskakiwała natychmiast, a panel jechał jeszcze
  // 320 ms — przycisk mówił „już zwinięte", kiedy panel był w połowie drogi. Jedna ścieżka obracana
  // klasą jedzie tą samą krzywą i w tym samym czasie co panel (`--rf-d-panel` w 20-cols.css).
  const SVGNS = "http://www.w3.org/2000/svg";
  function chevIcon() {
    const s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("class", "rf-ptog-ic"); s.setAttribute("viewBox", "0 0 16 16");
    s.setAttribute("aria-hidden", "true"); s.setAttribute("focusable", "false");
    const p = document.createElementNS(SVGNS, "path");
    // Grot w LEWO; kierunek w prawo robi obrót o 180° (klasa `is-right`), więc kształt jest jeden.
    p.setAttribute("d", "M10.1 3.3 5.4 8l4.7 4.7");
    p.setAttribute("fill", "none"); p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "1.9");
    p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
    s.appendChild(p);
    return s;
  }
  function togFace(side, collapsed) {
    const b = document.getElementById(side + "Tog");
    if (!b) return;
    // Strzałka pokazuje, DOKĄD pojedzie panel, a nie gdzie stoi teraz. Lewy zwinięty wysunie się
    // w prawo, prawy zwinięty — w lewo; stąd warunek, a nie samo `collapsed`.
    b.classList.toggle("is-right", side === "lp" ? !!collapsed : !collapsed);
    b.setAttribute("aria-expanded", collapsed ? "false" : "true");
    const txt = collapsed
      ? (side === "lp" ? "Rozwiń lewy panel (Ctrl+B)" : "Rozwiń prawy panel (Ctrl+\\)")
      : (side === "lp" ? "Zwiń lewy panel (Ctrl+B)" : "Zwiń prawy panel (Ctrl+\\)");
    b.title = txt;
    // Ta sama treść jako nazwa dostępna. Przycisk nie ma już żadnego tekstu, a `title` jest dla
    // nazwy ostatnią deską ratunku — jawny `aria-label` nie zostawia tego uznaniu czytnika.
    // Świadomie TO SAMO zdanie: drugi napis znaczyłby drugi klucz w i18n i drugie miejsce, w którym
    // można powiedzieć co innego niż podpowiedź.
    b.setAttribute("aria-label", txt);
  }
  function setPanel(side, collapsed) {
    document.body.classList.toggle(side + "-collapsed", !!collapsed);
    togFace(side, !!collapsed);
    try { localStorage.setItem(LS[side], collapsed ? "1" : "0"); } catch (e) { }
    // Po przejściu zmienia się wysokość obszarów przewijanych, więc maski krawędzi liczy się
    // dopiero na końcu ruchu — w połowie drogi odpowiedź byłaby o poprzednim układzie. Ten sam
    // powód dotyczy własnego paska przewijania (rf-34g): jego kciuk ma wysokość z proporcji
    // „widać / wszystkiego", a obie zmieniają się dopiero, gdy panel dojedzie.
    setTimeout(fadeEdges, 360);
    setTimeout(() => { try { if (global.rfRailScrollSync) global.rfRailScrollSync(); } catch (e) { } }, 380);
  }
  function togglePanel(side) {
    setPanel(side, !document.body.classList.contains(side + "-collapsed"));
  }
  function mkTog(side, controls) {
    const b = el("button", "icon-btn rf-ptog");
    b.type = "button"; b.id = side + "Tog";
    b.setAttribute("aria-controls", controls);
    // Przycisk jest teraz WYŁĄCZNIE ikoną (dawniej niósł znak «/», który i tak nic nie mówił
    // czytnikowi ekranu), więc nazwę dostępną nadaje `togFace()` razem z podpowiedzią — tym samym
    // zdaniem, żeby nie zakładać drugiego napisu do tłumaczenia i do rozjechania się.
    b.appendChild(chevIcon());
    b.addEventListener("click", () => togglePanel(side));
    return b;
  }

  // ---- miękkie krawędzie obszarów przewijanych --------------------------------------------------
  // Maska leci TYLKO wtedy, gdy naprawdę jest co przewijać, i tylko z tej strony, z której coś
  // jeszcze zostało. Lista, która mieści się w całości, bez tego wyglądałaby na uciętą.
  function fadeEdges() {
    ["rfRail", "rfRcol"].forEach(id => {
      const e = document.getElementById(id); if (!e) return;
      const can = e.scrollHeight - e.clientHeight > 4;
      e.classList.toggle("fade-top", can && e.scrollTop > 4);
      e.classList.toggle("fade-bot", can && e.scrollTop + e.clientHeight < e.scrollHeight - 4);
      if (!e._rfFadeBound) { e._rfFadeBound = true; e.addEventListener("scroll", fadeEdges, { passive: true }); }
    });
  }

  // ---- „Co wychodzi z tego kapsla" --------------------------------------------------------------
  // ŹRÓDŁO STANU: kropki przy modułach w nawigacji. Nie „to samo co one", tylko DOKŁADNIE ONE —
  // updateTabDots ustawia kropki i zaraz potem woła tę funkcję. Drugie, własne czytanie state.*
  // rozjechałoby się pierwszego dnia (kropka „włączone", lista obok „nic nie wychodzi").
  // SYGNATURA STANU. `paintOuts` woła się z KAŻDEGO `renderDeviceSelector` (przełączenie kapsla,
  // `devmeta`, zmiana połączenia) i z `updateTabDots` (każde klepnięcie przełącznika modułu). Za
  // każdym razem czyściła `#rfOuts` i budowała listę od zera — a lista zmienia się rzadziej niż
  // powody, dla których się ją przerysowuje. Wyrzucenie i odtworzenie tych samych węzłów kosztuje
  // przeliczenie stylów i układu całej kolumny, więc najpierw sprawdzamy, czy jest o co kruszyć
  // kopie. Sygnatura niesie DOKŁADNIE to, co widać w wierszu: kapsel, wstrzymanie, zbiór zapalonych
  // modułów i nazwy konfiguracji, które niosą.
  function _outsSig() {
    const D = (typeof state !== "undefined" && state.devices) ? state.devices[state.activeDeviceId] : null;
    const paused = !!(D && D.meta && (D.meta.paused || D.meta.autoPaused));
    const held = _outsHeld();
    let s = (D && D.meta && (D.meta.dev || "")) + "|" + (paused ? "1" : "0") + "|" + (held ? "1" : "0") + "|" +
      ((typeof dmName === "function" && D) ? dmName(D) : "") + "|";
    if (paused || held) return s;                  // przy wstrzymaniu lista i tak ma jeden wiersz
    for (const t of _tabs) {
      if ((t.grp !== "mod" && t.grp !== "play") || !t.dot) continue;   // Synth stoi w „Wypróbuj”, ale dalej jest modułem z kropką
      const b = _btns[t.id]; if (!b) continue;
      const d = b.querySelector(".tab-dot");
      if (!d || !d.classList.contains("on")) continue;
      const lbl = b.querySelector("span:not(.rfic):not(.tab-dot):not(.tab-emoji)");
      let cfg = "";
      try {
        if (typeof rfCfgIdNameForTab === "function")
          cfg = rfCfgIdNameForTab(t.id, (typeof state !== "undefined" && state.activeDeviceId) || undefined) || "";
      } catch (e) { }
      s += t.id + "~" + ((lbl && lbl.textContent) || "") + "~" + cfg + ";";
    }
    return s;
  }
  // GŁÓWNY PRZEŁĄCZNIK (UX 261120, F-G0-03). Przy `state.armed=false` serwer nie wypuszcza niczego
  // z żadnego modułu (`DeviceManager.master_armed`), więc lista włączonych modułów mówiłaby
  // nieprawdę. Zostaje jeden wiersz z przyciskiem, który klika TEN SAM `#armBtn` co człowiek.
  function _outsHeld() { return typeof state !== "undefined" && state.armed === false; }
  // Wiersz z akcją: przycisk pod zdaniem, na całą szerokość karty (274 px nie mieści obu w rzędzie).
  function _outsRow(cls, ic, txt, btnTxt, onClick) {
    const r = el("div", "rf-out rf-out-act " + cls);
    if (ic) { const i = el("span", "rfic rf-out-ic " + ic); i.setAttribute("aria-hidden", "true"); r.appendChild(i); }
    r.appendChild(el("span", "rf-out-w", txt));
    if (btnTxt) {
      const b = el("button", "btn sm rf-out-btn", btnTxt); b.type = "button";
      b.addEventListener("click", onClick);
      r.appendChild(b);
    }
    return r;
  }
  // Nagłówek karty niesie nazwę kapsla: „Co teraz wychodzi z Triki 1”. Nazwa w osobnym węźle
  // z `data-noi18n` (podpis człowieka), reszta zdania jest kluczem słownika.
  function _outsHead() {
    const h = document.getElementById("rfOutsHead"); if (!h) return;
    const D = (typeof state !== "undefined" && state.devices) ? state.devices[state.activeDeviceId] : null;
    const nm = (typeof dmName === "function" && D) ? dmName(D) : "";
    const b = h.querySelector("b");
    if (b && b.textContent !== nm) b.textContent = nm;
  }
  function paintOuts() {
    const box = document.getElementById("rfOuts");
    if (!box || !_tabs || !_btns) return;
    _outsHead();
    // Ta sama treść co ostatnio → ani jednego dotknięcia DOM-u.
    const sig = _outsSig();
    if (box._rfSig === sig) return;
    box._rfSig = sig;
    // ⚠️ `state` jest `const`-em w rf-02, więc NIE stoi na `window`: `global.state` jest tu zawsze
    // undefined i do 2026-08-29 gasiło to całą gałąź o wstrzymanym kapslu — lista mówiła „żaden moduł
    // nie jest włączony" zamiast „Triki 1 jest wstrzymany". Pytamy przez `typeof`.
    const D = (typeof state !== "undefined" && state.devices) ? state.devices[state.activeDeviceId] : null;
    const paused = !!(D && D.meta && (D.meta.paused || D.meta.autoPaused));
    box.textContent = "";
    if (_outsHeld()) {
      box.appendChild(_outsRow("rf-out-held", "rf-out-ic-pause", "Sterowanie wstrzymane, nic nie wychodzi.",
        "Włącz sterowanie", () => { const a = document.getElementById("armBtn"); if (a && !a.disabled) a.click(); }));
      return;
    }
    if (paused) {
      const r = el("div", "rf-out rf-out-off");
      r.appendChild(el("span", "rf-out-dot"));
      const w = el("span", "rf-out-w");
      const nm = el("b", null, (typeof dmName === "function") ? dmName(D) : ((D && D.meta && (D.meta.label || D.meta.name)) || ""));
      nm.setAttribute("data-noi18n", "");        // nazwa kapsla to podpis człowieka, nie etykieta
      w.appendChild(nm);
      w.appendChild(document.createTextNode(" jest wstrzymany, nic nie wychodzi"));
      r.appendChild(w);
      box.appendChild(r);
      return;
    }
    let n = 0;
    for (const t of _tabs) {
      if ((t.grp !== "mod" && t.grp !== "play") || !t.dot) continue;   // Synth stoi w „Wypróbuj”, ale dalej jest modułem z kropką
      const b = _btns[t.id]; if (!b) continue;
      const d = b.querySelector(".tab-dot");
      if (!d || !d.classList.contains("on")) continue;
      n++;
      const r = el("div", "rf-out");
      r.appendChild(el("span", "rf-out-dot on"));
      if (t.png) {
        const ic = el("span", "rfic rf-out-ic tab-ic-" + t.png);
        ic.setAttribute("aria-hidden", "true");
        r.appendChild(ic);
      }
      // Etykieta czytana z ŻYWEGO przycisku, nie z t.label: po przełączeniu na angielski walker
      // przepisał już przycisk, a kopia z tablicy zostałaby po polsku.
      const lbl = b.querySelector("span:not(.rfic):not(.tab-dot):not(.tab-emoji)");
      r.appendChild(el("span", "rf-out-w", (lbl && lbl.textContent) || t.label || t.id));
      // …i CZYM to wychodzi: nazwa konfiguracji, którą ten kapsel niesie w tym module. Bez niej
      // lista mówi „Mapowanie jest włączone", a nie mówi, KTÓRE czterdzieści reguł jest włączone —
      // a to jest pytanie, które zadaje się przed grą. Nazwa idzie z rejestru adapterów (rf-49),
      // bo pyta się tu o CUDZY moduł, a adaptery są prywatne w swoich plikach.
      let cfg = "";
      try {
        if (typeof rfCfgIdNameForTab === "function")
          cfg = rfCfgIdNameForTab(t.id, (typeof state !== "undefined" && state.activeDeviceId) || undefined) || "";
      } catch (e) { }
      if (cfg) {
        const c = el("span", "rf-out-cfg", cfg);
        c.setAttribute("data-noi18n", "");   // podpis człowieka, nie etykieta
        c.title = cfg;
        r.appendChild(c);
      }
      box.appendChild(r);
    }
    // Pusty stan mówi, co zrobić, a nie tylko czego nie ma: „Zestawy” to pierwszy krok z instrukcji.
    if (!n) {
      box.appendChild(_outsRow("rf-out-off", "", "Nic nie wychodzi. Włącz moduł albo wczytaj zestaw.",
        "Zestawy", () => { if (typeof global.setTabById === "function") global.setTabById("konfiguracje"); }));
    }
  }

  // ---- portret aktywnego kapsla, nad „Moduł" ----------------------------------------------------
  // PO CO. Kropki przy modułach odpowiadają o JEDNYM kapslu — o tym wybranym („Włączony na wybranym
  // kapslu", updateTabDots w rf-34). Wybiera się go jednak w PRAWEJ kolumnie, więc pytanie „czyje
  // to kropki" i odpowiedź stały po dwóch stronach ekranu. Ten blok zszywa jedno z drugim: duży
  // rysunek kapsla stoi dokładnie NAD kropkami, o których mówi, a strzałki pozwalają przejść po
  // kapslach bez wodzenia wzrokiem w drugi koniec okna.
  //
  // TO NIE JEST DRUGI HUB KAPSLI. Hub (pigułki, akcje, dodawanie, usuwanie) zostaje jeden, w prawej
  // kolumnie. Tutaj jest sam PORTRET: kto jest wybrany i jak przejść do sąsiada. Dlatego zero
  // przycisków akcji i zero listy — lista w dwóch miejscach to dwa miejsca do rozjechania się.
  //
  // STRZAŁKI ZAWIJAJĄ SIĘ W KÓŁKO przy dwóch i więcej kapslach (ostatni → pierwszy), a gasną
  // DOPIERO przy jednym. Wygaszone, a nie schowane: kontrolka, która znika, zabiera odpowiedź na
  // pytanie „a gdzie to było" — przy drugim kapslu ma się pojawić tam, gdzie przed chwilą było
  // pusto, a nie tam, gdzie wcześniej nie było niczego.
  //
  // KOLEJNOŚĆ JEST TA SAMA, CO PIGUŁEK (rf-11 renderDeviceSelector sortuje po `meta.slot`) — inaczej
  // „następny" w tej kolumnie znaczyłby co innego niż „następny w dół" w tamtej.
  function _capOrder() {
    if (typeof state === "undefined" || !state.devices) return [];
    return Object.values(state.devices)
      .sort((a, b) => ((a.meta && a.meta.slot) || 0) - ((b.meta && b.meta.slot) || 0))
      .map(D => (D.meta && D.meta.dev) || "")
      .filter(Boolean);
  }
  // Przejście o jeden kapsel. WYŁĄCZNIE przez switchDevice (rf-11): to ono przepina reguły, warstwę,
  // bufory, panele Czujnika/Połączenia i woła setViewDev. Ustawienie samego `state.activeDeviceId`
  // zostawiłoby połowę panelu na poprzednim kapslu.
  function _capStep(delta) {
    const ids = _capOrder();
    if (ids.length < 2) return;
    const cur = ids.indexOf((typeof state !== "undefined" && state.activeDeviceId) || "");
    const id = ids[((cur < 0 ? 0 : cur) + delta + ids.length) % ids.length];
    if (!id || (typeof state !== "undefined" && id === state.activeDeviceId)) return;
    if (typeof global.switchDevice === "function") global.switchDevice(id);
  }
  function mkCapArrow(next) {
    const b = el("button", "icon-btn rf-navcap-arrow" + (next ? " is-next" : ""));
    b.type = "button";
    b.id = next ? "rfNavCapNext" : "rfNavCapPrev";
    // Napis po polsku wprost w atrybucie — walker i18n tłumaczy `title` i `aria-label` tak samo jak
    // widoczny tekst, a `_gl` zamroziłby język, w którym blok powstał. To samo zdanie w obu, bo
    // drugi napis znaczyłby drugi klucz w słowniku i drugie miejsce do rozjechania się.
    const txt = next ? "Następny kapsel" : "Poprzedni kapsel";
    b.setAttribute("aria-label", txt);
    b.title = txt;
    b.setAttribute("aria-controls", "rfNavCapName");
    b.appendChild(chevIcon());   // ta sama ścieżka, co grot zwijania; „w prawo" to obrót klasą
    b.addEventListener("click", () => _capStep(next ? 1 : -1));
    return b;
  }
  function buildNavCap() {
    const box = el("div", "rf-navcap"); box.id = "rfNavCap";
    const row = el("div", "rf-navcap-row");
    row.appendChild(mkCapArrow(false));
    // Rysunek NIE jest nazwą kapsla — nazwa stoi obok, tekstem. Stąd `alt=""` i `aria-hidden` na
    // obrazku: czytnik miałby ją inaczej dwa razy, raz jako obrazek, raz jako napis.
    // 2026-11-20: rysunek jest PRZYCISKIEM, który otwiera menu wyglądu i edycji kapsla (rf-11
    // openCapMenu: rząd grafik zapisywanych od razu + „Edytuj kapsel…”). Etykieta mówi, co robi,
    // a nie jak się kapsel nazywa — nazwa dalej stoi niżej, tekstem.
    const art = el("button", "rf-navcap-art");
    art.type = "button"; art.id = "rfNavCapArt";
    art.setAttribute("aria-label", "Wygląd i edycja kapsla");
    art.title = "Wygląd i edycja kapsla";
    art.setAttribute("aria-haspopup", "dialog");
    art.addEventListener("click", () => {
      const id = (typeof state !== "undefined" && state.activeDeviceId) || "";
      if (id && typeof global.openCapMenu === "function") global.openCapMenu(id, art.getBoundingClientRect(), art);
    });
    const img = document.createElement("img");
    img.className = "rf-navcap-img"; img.id = "rfNavCapImg";
    img.alt = ""; img.setAttribute("aria-hidden", "true");
    img.setAttribute("draggable", "false");
    img.hidden = true;
    art.appendChild(img);
    // Ta sama reguła zapasowa, co w `capImgSpan` (rf-03): slot bez przypisanego rysunku dostaje
    // kolorową kropkę, a nie pustą dziurę wielkości obrazka.
    const dot = el("span", "rf-navcap-dot"); dot.id = "rfNavCapDot"; dot.hidden = true;
    art.appendChild(dot);
    row.appendChild(art);
    row.appendChild(mkCapArrow(true));
    box.appendChild(row);
    // `aria-live` na NAZWIE, bo to ona jest odpowiedzią na „gdzie jestem po naciśnięciu strzałki".
    // `data-noi18n`, bo nazwa kapsla to podpis człowieka, nie etykieta do tłumaczenia.
    const nm = el("div", "rf-navcap-name"); nm.id = "rfNavCapName";
    nm.setAttribute("data-noi18n", "");
    nm.setAttribute("aria-live", "polite");
    box.appendChild(nm);
    const st = el("div", "rf-navcap-state"); st.id = "rfNavCapState";
    box.appendChild(st);
    // Bez zdania „Kropki niżej…” (UX 261120, D7): nazwa sekcji „Moduły” tuż pod portretem i dymek
    // każdej kropki mówią to samo, a zdanie zabierało dwie linijki w kolumnie, która się przewija.
    return box;
  }
  // ODŚWIEŻENIE RÓŻNICOWE, nie odbudowa. Ta funkcja jedzie z każdego `renderDeviceSelector` (czyli
  // i z każdego ticku SSE, który zmienia cokolwiek w kapslu), z `setViewDev` i z `updateTabDots`.
  // Wyrzucenie i złożenie bloku od nowa zabrałoby fokus ze strzałki pod kursorem i urwało przejścia,
  // więc — dokładnie jak różnicowy renderer pigułek w rf-11 — piszemy do ISTNIEJĄCYCH węzłów, a
  // sygnatura odcina przebiegi, w których i tak nic się nie zmieniło.
  function capSync() {
    const box = document.getElementById("rfNavCap");
    if (!box) return;
    const ids = _capOrder();
    const id = (typeof state !== "undefined" && state.activeDeviceId) || "";
    const D = (typeof state !== "undefined" && state.devices) ? state.devices[id] : null;
    const meta = (D && D.meta) || {};
    const name = (typeof dmName === "function" && D) ? dmName(D) : (meta.name || id || "");
    // 256-pikselowe źródło, jak w edytorze kapsla: rysunek ma tu ponad 100 px, a 96-pikselowa
    // grafika pigułki rozciągnięta na ekranie 2× robi się miękka.
    const url = (typeof capImgBig === "function") ? capImgBig(meta.cap) : "";
    const col = /^#[0-9a-fA-F]{6}$/.test(meta.color || "") ? meta.color : "#8aa0b5";
    const word = (typeof connWord === "function") ? connWord(D ? D.conn : "") : "";
    const many = ids.length > 1;
    const sig = id + "|" + name + "|" + url + "|" + col + "|" + word + "|" + (many ? "1" : "0");
    if (box._rfSig === sig) return;
    box._rfSig = sig;
    if (box.style.getPropertyValue("--dcol") !== col) box.style.setProperty("--dcol", col);
    const img = document.getElementById("rfNavCapImg");
    const dot = document.getElementById("rfNavCapDot");
    if (img && dot) {
      if (url) {
        if (img.getAttribute("src") !== url) img.setAttribute("src", url);
        img.hidden = false; dot.hidden = true;
      } else {
        // `src` ZDEJMOWANY, nie ustawiany na pusty: pusty adres każe przeglądarce pobrać samą
        // stronę jeszcze raz, jako obrazek.
        img.hidden = true; img.removeAttribute("src");
        dot.hidden = false;
        if (dot.style.background !== col) dot.style.background = col;
      }
    }
    const nm = document.getElementById("rfNavCapName");
    if (nm && nm.textContent !== name) nm.textContent = name;
    const st = document.getElementById("rfNavCapState");
    // Porównanie do `data-pl`, a nie do widocznego napisu — po angielsku walker zdążył już podmienić
    // treść, więc porównanie z nią różniłoby się przy każdym przebiegu i przepisywało węzeł w kółko.
    // (Ta sama pułapka, co w `.dp-state` w rf-11.)
    if (st && st.getAttribute("data-pl") !== word) {
      st.setAttribute("data-pl", word);
      st.textContent = word;
      if (typeof applyLang === "function") { try { applyLang(st); } catch (e) { } }
    }
    for (const b of [document.getElementById("rfNavCapPrev"), document.getElementById("rfNavCapNext")]) {
      if (!b) continue;
      if (b.disabled !== !many) b.disabled = !many;
      const ad = many ? "false" : "true";
      if (b.getAttribute("aria-disabled") !== ad) b.setAttribute("aria-disabled", ad);
    }
  }

  // ---- „Więcej modułów (N)” (UX 261120 L23, „mniej naraz”) -----------------------------------------
  // Pozycje schowane okiem (rf-48) albo pierwszym pytaniem (rf-48b) NIE znikają: stoją tu, na dole
  // sekcji „Moduły”, jedno kliknięcie dalej. Klik rozwija listę w miejscu; stan pamięta localStorage,
  // a lista rozwija się sama, gdy wybrana pozycja jest w środku. Nic schowanego = nie ma przycisku.
  // Napis składa `_gl` (przycisk ma `data-noi18n`), więc zmiana języka przerysowuje go obserwatorem.
  const LS_MORE = "ribbitflip.nav.more";
  const GRP_BOX = [["top", "rfNavTop"], ["mod", "rfNavMod"], ["play", "rfNavPlay"], ["tools", "rfNavTools"], ["app", "rfNavApp"]];
  let _moreN = 0;
  function buildMore(mkList) {
    const wrap = el("div", "rf-navmore"); wrap.id = "rfNavMoreWrap"; wrap.hidden = true;
    const b = el("button", "rnav-btn rf-navmore-btn"); b.type = "button"; b.id = "rfNavMoreBtn";
    b.setAttribute("aria-controls", "rfNavMore"); b.setAttribute("aria-expanded", "false");
    b.setAttribute("data-noi18n", "");
    const ic = el("span", "rfic rf-navmore-ic"); ic.setAttribute("aria-hidden", "true");
    b.appendChild(ic); b.appendChild(el("span", "rf-navmore-t"));
    b.addEventListener("click", function () {
      const open = b.getAttribute("aria-expanded") !== "true";
      try { localStorage.setItem(LS_MORE, open ? "1" : "0"); } catch (e) { }
      moreSync(open);
      setTimeout(fadeEdges, 60);
    });
    const list = mkList("rfNavMore"); list.classList.add("rf-navmore-list"); list.hidden = true;
    list.setAttribute("aria-label", _gl("Więcej modułów", "More modules"));
    wrap.appendChild(b); wrap.appendChild(list);
    try {
      new MutationObserver(function () { moreSync(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    } catch (e) { }
    return wrap;
  }
  // Rozdaje przyciski: schowane do listy „Więcej”, reszta do swoich sekcji, w kolejności nawigacji.
  function placeHidden(hidden) {
    if (!_tabs || !_btns) return;
    const H = hidden instanceof Set ? hidden : new Set(hidden || []);
    const list = document.getElementById("rfNavMore");
    let n = 0;
    for (const [g, id] of GRP_BOX) {
      const box = document.getElementById(id);
      _tabs.filter(t => t.grp === g && _btns[t.id]).sort((a, b) => (a.ord || 99) - (b.ord || 99)).forEach(t => {
        const b = _btns[t.id];
        b.style.display = "";
        if (H.has(t.id) && list) { list.appendChild(b); n++; }
        else if (box) box.appendChild(b);
      });
    }
    _moreN = n;
    const wrap = document.getElementById("rfNavMoreWrap");
    if (wrap) wrap.hidden = !n;
    moreSync();
    setTimeout(fadeEdges, 60);
  }
  // `open` z kliknięcia; bez niego stan z localStorage, a wybrana pozycja w środku wymusza rozwinięcie.
  function moreSync(open) {
    const b = document.getElementById("rfNavMoreBtn"), list = document.getElementById("rfNavMore");
    if (!b || !list) return;
    if (open === undefined) {
      try { open = localStorage.getItem(LS_MORE) === "1"; } catch (e) { open = false; }
      if (list.querySelector(".tab-btn.active")) open = true;
    }
    list.hidden = !open;
    b.setAttribute("aria-expanded", open ? "true" : "false");
    const t = _gl("Więcej modułów", "More modules") + " (" + _moreN + ")";
    const lbl = b.querySelector(".rf-navmore-t");
    if (lbl && lbl.textContent !== t) lbl.textContent = t;
    const tip = open ? _gl("Zwiń schowane moduły. Widoczność ustawisz okiem nad nawigacją.",
                           "Fold the hidden modules away. Set what shows with the eye above the navigation.")
                     : _gl("Pokaż schowane moduły. Działają dalej, schowane są tylko z nawigacji.",
                           "Show the hidden modules. They keep working; they are only out of the navigation.");
    if (b.getAttribute("aria-label") !== t) b.setAttribute("aria-label", t);
    if (b.dataset.tip !== tip) { b.dataset.tip = tip; b.title = tip; }
  }

  // ---- budowa układu ----------------------------------------------------------------------------
  function build(o) {
    const wrap = o.wrap;
    _tabs = o.tabs; _btns = o.btns;

    const app = el("div", "rf-app"); app.id = "rfApp";

    // ===== LEWA: nawigacja =====
    const rail = el("div", "rf-rail"); rail.id = "rfRail";
    // LANDMARKI (5.13). Trzy kolumny to trzy obszary strony, ale są zwykłymi <div>-ami — czytnik
    // nie miał czym przeskoczyć z nawigacji do treści. Role nakładamy na istniejące węzły, a NIE
    // zamieniamy ich na <nav>/<main>/<aside>: selektory #rfRail/#rfMain/#rfRcol (arkusze, rf-48,
    // testy) mają zostać dokładnie takie, jakie są. Nazwy obszarów składamy przez `_gl`, bo
    // walker i18n tłumaczy widoczny tekst i atrybuty węzłów, które go mają — sam aria-label na
    // pustym pojemniku by mu umknął.
    // WHY: landmark roles on the existing divs — the ids and the stylesheet stay untouched.
    rail.setAttribute("role", "navigation");
    rail.setAttribute("aria-label", _gl("Nawigacja", "Navigation"));
    // UX 261120 (P-G0-04): JEDNA KARTA zamiast trzech. Kolejność to pierwsza ścieżka z instrukcji:
    // portret kapsla, „Zestawy” (pierwszy krok, dawniej pod krawędzią ekranu), „Moduły”,
    // „Wypróbuj”, „Narzędzia”, a na samym dole „Ustawienia” programu. Sekcje dzieli ścieg
    // (`.rf-nav-sect` w 20-cols.css), nie osobne karty: trzy karty dokładały trzy paddingi i trzy
    // cienie na kolumnę, która i tak się przewija. Pasek panelu nie ma napisu „Nawigacja” (nazwę
    // niesie `aria-label` kolumny), zostają w nim oko i zwijanie.
    const navCard = el("div", "card rf-pcard"); navCard.id = "rfNavCard";
    const navBar = el("div", "rf-pbar"); navBar.id = "rfNavBar";
    navBar.appendChild(el("span", "rf-pbar-fill"));
    navBar.appendChild(mkTog("lp", "rfRail"));
    navCard.appendChild(navBar);
    navCard.appendChild(buildNavCap());
    // Każda lista jest tablistem w PIONIE (rf-34 `_navKey`: strzałki przechodzą przez wszystkie
    // bez szwu). Bez `aria-orientation` czytnik zapowiada listę jako poziomą.
    // WHY: the tablists are vertical — screen readers must announce up/down, not left/right.
    const mkList = (id) => {
      const n = el("div", "rnav"); n.id = id; n.setAttribute("role", "tablist");
      n.setAttribute("aria-orientation", "vertical");
      return n;
    };
    const navSect = (txt) => { const n = sect(txt); n.classList.add("rf-nav-sect"); return n; };
    const navTop = mkList("rfNavTop"); navTop.classList.add("rf-nav-top");
    navCard.appendChild(navTop);
    navCard.appendChild(navSect("Moduły"));
    const navMod = mkList("rfNavMod");
    navCard.appendChild(navMod);
    navCard.appendChild(buildMore(mkList));
    // „WYPRÓBUJ” (2026-10-03): Synth i link do gry RibbitBeat, obok przepływu „kapsel → moduł →
    // wyjście”. `#rfPlayCard` obejmuje nagłówek, Synth i link do gry: tę całość podświetla
    // przewodnik (rf-39p), a Lite chowa ją w całości (rf-34). Link dokleja rf-34 ZA `#rfNavPlay`,
    // poza tablistem.
    const playCard = el("div", "rf-navgrp"); playCard.id = "rfPlayCard";
    playCard.appendChild(navSect("Wypróbuj"));
    const navPlay = mkList("rfNavPlay");
    playCard.appendChild(navPlay);
    navCard.appendChild(playCard);
    navCard.appendChild(navSect("Narzędzia"));
    const navTools = mkList("rfNavTools");
    navCard.appendChild(navTools);
    const navApp = mkList("rfNavApp"); navApp.classList.add("rf-nav-app");
    navCard.appendChild(navApp);
    rail.appendChild(navCard);

    // Przyciski PRZENOSZONE, nie odtwarzane. Moduły idą w kolejności z TABS (ta sama, w której
    // stały na pasku), „Narzędzia” po własnym `ord`: Nakładka · Czujnik · Połączenie.
    const put = (grp, box) => _tabs.filter(t => t.grp === grp && _btns[t.id])
      .sort((a, b) => (a.ord || 99) - (b.ord || 99))
      .forEach(t => box.appendChild(_btns[t.id]));
    put("top", navTop); put("mod", navMod); put("play", navPlay); put("tools", navTools); put("app", navApp);
    // Schowane pozycje przenosi pod „Więcej modułów” `placeHidden`, wołane przez rf-34 zaraz po nas.

    // ===== ŚRODEK: panele =====
    const main = el("div", "rf-main"); main.id = "rfMain";
    main.setAttribute("role", "main");                      // patrz komentarz przy #rfRail
    for (const p of o.panels) main.appendChild(p);

    // ===== PRAWA: kapsle, podgląd, wyjścia =====
    const rcol = el("div", "rf-rcol"); rcol.id = "rfRcol";
    rcol.setAttribute("role", "complementary");             // patrz komentarz przy #rfRail
    rcol.setAttribute("aria-label", _gl("Kapsle i podgląd", "Capsules and preview"));
    const rBar = el("div", "rf-pbar rf-rbar"); rBar.id = "rfRcolBar";
    rBar.appendChild(el("b", null, "Kapsle i podgląd"));
    rBar.appendChild(mkTog("rp", "rfRcol"));
    rcol.appendChild(rBar);

    // Hub kapsli w całości — jeden appendChild, więc JEDEN delegowany nasłuch na #deviceSel
    // (rf-11 _wireDeviceSel) jedzie razem z nim i nic nie trzeba podpinać na nowo.
    //
    // `rf-devcompact` to JEDYNA rzecz, która robi z pigułek zwarte wiersze. Świadomie klasa na
    // pojemniku, a nie drugi szablon pigułki w rf-11: tamten jest różnicowym rendererem, który
    // przy każdym ticku SSE dosypuje zmiany do ISTNIEJĄCYCH węzłów, żeby nie wyrwać paska akcji
    // spod kursora ani nie zabrać fokusu. Drugi kształt DOM-u znaczyłby drugą ścieżkę w
    // `_devpillUpdate`, drugie miejsce na i18n i drugie na stany WSTRZYMANY/EDYTOWANY — czyli
    // dwa razy więcej do rozjechania się. Wiersz z makiety (kropka · nazwa · flagi · stan, akcje
    // wysuwane w dół) składa się z tych samych węzłów, więc wystarczy im to powiedzieć arkuszem.
    const devWrap = el("div", "rf-devwrap rf-devcompact");
    devWrap.appendChild(o.devPanel);
    const foot = el("div", "rf-navfoot");
    const ovb = _btns["przeglad"];
    if (ovb) {
      // Wygląda jak każdy inny przycisk aplikacji, ze ściegiem z 14d-buttons.css — bo nim JEST.
      // `rnav-btn` (przezroczysta pozycja listy) zdejmowane, `tab-btn` zostaje: po tej klasie
      // szukają zakładek inwentarz i „Widoczność".
      ovb.classList.remove("rnav-btn");
      ovb.classList.add("btn", "rf-ovbtn");
      const lbl = ovb.querySelector("span:not(.rfic):not(.tab-dot):not(.tab-emoji)");
      if (lbl) lbl.textContent = "Przegląd wszystkich kapsli";
      ovb.title = "Co jest włączone na którym kapslu, w jednej tabeli zamiast obchodzenia zakładek";
      foot.appendChild(ovb);
    }
    devWrap.appendChild(foot);
    rcol.appendChild(devWrap);

    // Podgląd + wyjścia zwijają się razem siatką 1fr → 0fr, czyli dokładnie do własnej wysokości,
    // bez zgadywania max-height. Kapsle stoją POZA tym opakowaniem i dlatego zostają.
    const lvWrap = el("div", "rf-lvwrap");
    const lvIn = el("div", "rf-lvinner");
    // MINIATURA, nie pełne karty. Cztery karty `#railFold` stały tu do 2026-08-29 i były nieczytelne
    // (patrz nagłówek rf-34c-rcol.js) — wróciły na górę zakładki Czujnik, gdzie mają szerokość.
    // Tutaj rysuje się ich skrót z tych samych buforów: kula i dwa sparkline'y bez opisanych osi.
    // Nagłówek niesie odnośnik do tych pełnych kart („Zobacz szczegóły", budowany w rf-34c). Tu, a
    // nie w wierszu akcji pod kaflami: prawa kolumna ma 274 px, a dwa przyciski obok siebie by się
    // w niej nie zmieściły. Obok napisu nagłówka miejsce jest, a „idź po więcej tego samego" i tak
    // dotyczy CAŁEJ sekcji, nie pojedynczego kafla.
    const lvSect = sect("Podgląd na żywo");
    if (global.rfRcolMini && global.rfRcolMini.moreBtn) {
      lvSect.classList.add("rf-sect-act");
      lvSect.appendChild(global.rfRcolMini.moreBtn());
    }
    // KARTA STANU NA GÓRZE (UX 261120, P-G0-06): „co teraz wychodzi” to pytanie zadawane przed
    // grą, a stało pod trzema wykresami. Teraz jest pierwsza pod kapslami i Przeglądem.
    const outsCard = el("div", "card rf-outs-card");
    const outsHead = sect("Co teraz wychodzi z"); outsHead.id = "rfOutsHead";
    outsHead.classList.add("rf-outs-head");
    outsHead.appendChild(document.createTextNode(" "));
    const outsNm = el("b"); outsNm.setAttribute("data-noi18n", "");
    outsHead.appendChild(outsNm);
    outsCard.appendChild(outsHead);
    const outs = el("div", "rf-outs"); outs.id = "rfOuts";
    outs.setAttribute("aria-live", "polite");
    outsCard.appendChild(outs);
    lvIn.appendChild(outsCard);
    lvIn.appendChild(lvSect);
    if (global.rfRcolMini && global.rfRcolMini.build) lvIn.appendChild(global.rfRcolMini.build());
    lvWrap.appendChild(lvIn);
    rcol.appendChild(lvWrap);

    app.appendChild(rail); app.appendChild(main); app.appendChild(rcol);
    wrap.appendChild(app);

    // Stan paneli sprzed odświeżenia — nadawany OD RAZU, bez klatki pośredniej: strona, która sama
    // rozsuwa swoje meble przy wczytaniu, wygląda, jakby jeszcze się ładowała.
    let lp = false, rp = false;
    try { lp = localStorage.getItem(LS.lp) === "1"; rp = localStorage.getItem(LS.rp) === "1"; } catch (e) { }
    document.body.classList.toggle("lp-collapsed", lp);
    document.body.classList.toggle("rp-collapsed", rp);
    togFace("lp", lp); togFace("rp", rp);

    // Ctrl+B / Ctrl+\ — te same skróty, co w katalogu komponentów. Pole tekstowe ma pierwszeństwo
    // tylko tam, gdzie skrót jest pojedynczą literą; te są z Ctrl, więc nie kolidują z pisaniem.
    global.addEventListener("keydown", e => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "b" || e.key === "B") { e.preventDefault(); togglePanel("lp"); return; }
      if (e.key === "\\") { e.preventDefault(); togglePanel("rp"); }
    });
    global.addEventListener("resize", fadeEdges);

    // Lista wyjść zmienia się z DWÓCH powodów: przełączono moduł (updateTabDots) albo zmieniono
    // kapsel. To drugie nie ma własnego zdarzenia, ale ma renderDeviceSelector — ten sam haczyk,
    // z którego korzysta macierz „Moduły" (rf-45).
    // KOALESCENCJA. Jedno zdarzenie potrafi wywołać `renderDeviceSelector` kilka razy pod rząd
    // (przełączenie kapsla robi to wprost, a zaraz potem robi to `st`/`devmeta` z serwera). Lista
    // wyjść ma jeden stan na klatkę, nie jeden na wywołanie, więc zbieramy je do najbliższej
    // klatki. `paintOuts` zostaje NATYCHMIASTOWY w API (rfCols.paintOuts) — koalescencja dotyczy
    // tylko tej haczykowanej drogi, żeby wywołanie z zewnątrz nadal dawało odpowiedź od razu.
    let _outsPend = 0;
    function _outsSoon() {
      if (_outsPend) return;
      _outsPend = requestAnimationFrame(() => { _outsPend = 0; try { paintOuts(); } catch (e) { } });
    }
    if (typeof global.renderDeviceSelector === "function") {
      const prev = global.renderDeviceSelector;
      global.renderDeviceSelector = function () {
        const r = prev.apply(this, arguments);
        _outsSoon();
        return r;
      };
    }
    setTimeout(fadeEdges, 60);
    capSync();   // pierwszy stan portretu — zanim cokolwiek zdąży się odświeżyć
  }

  // Jedna nazwa dla wszystkich miejsc, które już dziś odświeżają się przy zmianie kapsla:
  // `renderDeviceSelector` i `setViewDev` (rf-11) oraz `updateTabDots` (rf-34). Wystawiona ZARAZ,
  // nie dopiero po `build` — wołający robią `typeof`, a sama funkcja wychodzi po cichu, dopóki
  // bloku nie ma w DOM-ie.
  global.rfNavCapSync = capSync;
  global.rfCols = { build, paintOuts, fadeEdges, setPanel, togglePanel, capSync, placeHidden, moreSync };
})(window);
