"use strict";
// ============ PRZEWODNIK PO PANELU — WYCIECZKA NA ŻYCZENIE ============
// Wycieczka po panelu, którą użytkownik włącza na życzenie.
//
// Poradniki (rf-39b) odpowiadają na „jak działa TEN moduł", ale nikt nie odpowiadał na pytanie,
// które pada wcześniej: „gdzie tu co jest". Przewodnik pokazuje po kolei kilka miejsc panelu,
// podświetla każde i mówi jednym akapitem, do czego służy.
//
// Trzy zasady, na których to stoi:
//  1. NA ŻYCZENIE. Nic nie startuje samo — ani przy pierwszym uruchomieniu, ani po aktualizacji.
//     Wejścia są dwa: przycisk „Przewodnik" w pasku górnym i JEDNORAZOWE zaproszenie przy
//     pierwszym otwarciu panelu (UX 261120, D8). Zaproszenie tylko proponuje: notka czaszki
//     z „Pokaż mi panel” i „Gotowe zestawy”, a przewodnik rusza dopiero po kliknięciu.
//  2. TYLKO POKAZUJE. Przewodnik nie klika, nie włącza modułów i nie zapisuje niczego. Jedyna
//     zmiana, jaką robi, to przełączenie zakładki na Mapowanie — i na koniec wraca do zakładki,
//     na której człowiek był. Kliknięcia w panel są w tym czasie zablokowane warstwą pod dymkiem,
//     żeby przypadkiem nie przestawić czegoś „przy okazji".
//  3. KROK BEZ CELU ZNIKA. Zakładkę można schować („Widoczność"), kolumnę zwinąć, a okno podglądu
//     (?view=overview) nie ma połowy panelu. Krok, którego element nie istnieje albo nie ma
//     wymiaru, wypada z listy PRZED startem, więc licznik „Krok 3 z 9" nigdy nie kłamie.
//
// Teksty składa `_gl()` w chwili rysowania — tak jak rf-39k — więc żadnego klucza w słowniku
// (i żadnego martwego klucza po zmianie zdania). Przełącznik języka woła `rfTourRelang` z setLang.
// WHY: a one-off tour that must not touch settings; steps without a visible target are dropped
// up front so the step counter stays honest.

(function (global) {
  // DWIE CZĘŚCI (UX 261120). Pierwsza to sześć kroków w kolejności instrukcji „Pierwsze kroki”:
  // kapsle, gotowy zestaw, moduły i kropki, włącznik, stan wyjść, główny przełącznik. Reszta
  // (`more:true`) nie ginie: ostatnia karta pierwszej części ma „Pokaż resztę”.
  // `tab` = zakładka, którą trzeba pokazać przed krokiem.
  const STEPS = [
    {sel: ".rf-devwrap",
     t: ["Twoje kapsle", "Your capsules"],
     b: ["Każdy kapsel Triki ma tu swoją pigułkę. Świecąca pigułka to kapsel, który teraz ustawiasz, i to jego dotyczy wszystko na środku ekranu. Nie wiesz, który jest który? Potrząśnij kapslem, a jego pigułka zamiga. Przewodnik niczego nie zmienia, a Esc go przerywa.",
         "Every Triki capsule has its pill here. The lit pill is the capsule you are setting up, and everything in the middle of the screen is about that one. Not sure which is which? Shake a capsule and its pill blinks. The tour changes nothing, and Esc leaves it."]},
    {sel: "#rfNavTop",
     t: ["Weź gotowy zestaw", "Take a ready setup"],
     b: ["Zestaw to ustawienia wszystkich modułów pod jedną grę. Najszybciej zaczniesz od gotowego: w Zestawach wybierz go i kliknij „Wczytaj”. Swój zapiszesz tam samo, żeby do niego wrócić albo wymienić się z innymi.",
         "A setup holds every module’s settings for one game. The quickest start is a ready one: pick it in Setups and click “Load”. You save your own there too, to come back to it or swap it with others."]},
    // „Więcej modułów (N)” (rf-34b) stoi pod listą tylko wtedy, gdy coś jest schowane: wtedy
    // podświetlenie obejmuje też ten przycisk, a opis dostaje jedno zdanie więcej. Liczba kroków
    // pierwszej części się nie zmienia, więc zdanie zaproszenia („w 6 krokach”) zostaje prawdziwe.
    {sel: "#rfNavMod", also: "#rfNavMoreWrap",
     t: ["Moduły", "Modules"],
     b: () => {
       const more = _vis(document.getElementById("rfNavMoreWrap"));
       return ["Moduł to sposób, w jaki kapsel steruje komputerem: klawisze i mysz w Mapowaniu, koło wyboru, kursor, skaner ekranu, wirtualny kontroler, MIDI, OSC i usługi sieciowe. Kropka przy nazwie mówi, czy moduł jest włączony na wybranym kapslu." +
                 (more ? " Moduły, których teraz nie używasz, czekają pod „Więcej modułów” na dole listy. Schowany moduł działa dalej." : ""),
               "A module is one way the capsule drives your computer: keys and mouse in Mapping, the selection wheel, the cursor, the screen scanner, a virtual controller, MIDI, OSC and network services. The dot next to a name says whether the module is on for the selected capsule." +
                 (more ? " Modules you are not using right now wait under “More modules” at the bottom of the list. A hidden module keeps working." : "")];
     }},
    {sel: "#rfpc-mapowanie .rfpc-pow", tab: "mapowanie",
     t: ["Włącznik modułu", "The module switch"],
     b: ["Każdy moduł ma własny włącznik dla wybranego kapsla. Wczytanie zestawu niczego nie włącza, więc po nim przestaw tu Wył. na Wł. Wyłączony moduł zachowuje ustawienia, tylko nic nie wysyła.",
         "Every module has its own switch for the selected capsule. Loading a setup switches nothing on, so flip Off to On here afterwards. A module that is off keeps its settings, it just sends nothing."]},
    {sel: ".rf-outs-card",
     t: ["Co teraz wychodzi", "What is going out"],
     b: ["Tu widzisz, czy z wybranego kapsla coś naprawdę wychodzi: które moduły są włączone i z jakim presetem. Gdy karta mówi „nic nie wychodzi”, do gry nie trafi żaden klawisz.",
         "This tells you whether anything really leaves the selected capsule: which modules are on and with which preset. When the card says “nothing is going out”, no key reaches the game."]},
    {sel: "#armBtn", pos: "below",
     t: ["Główny przełącznik", "The master switch"],
     b: ["„Uzbrojone” znaczy, że kapsle sterują komputerem. Jedno kliknięcie wstrzymuje wszystkie moduły naraz, co przydaje się, gdy odkładasz kapsel albo coś poszło nie tak. Skrót stopu awaryjnego ustawisz w Ustawieniach.",
         "“Armed” means the capsules drive your computer. One click pauses every module at once, handy when you put the capsule down or something goes wrong. The emergency stop shortcut lives in Settings."]},
    {sel: ".rf-lvwrap", more: true,
     t: ["Podgląd na żywo", "Live preview"],
     b: ["Tu widać, co czuje kapsel: jego obrót w 3D i odczyty czujników. Gdy coś nie reaguje na ruch, zacznij od tego miejsca. Jeśli wykres stoi, ruch nie dociera do aplikacji.",
         "This is what the capsule feels: its 3D orientation and the sensor readings. When something ignores your movement, start here. If the plot does not move, the motion is not reaching the app."]},
    {sel: "#rfpc-mapowanie .rfpc-tabs", tab: "mapowanie", more: true,
     t: ["Konfiguracja, Biblioteka, Informacje", "Configuration, Library, About"],
     b: ["Konfiguracja to ustawienia modułu. Biblioteka trzyma zapisane presety tego modułu. Informacje to poradnik modułu, z rozdziałami i rysunkami.",
         "Configuration holds the module’s settings. Library keeps the module’s saved presets. About is the module’s guide, with chapters and drawings."]},
    // Pusta lista pokazuje kafle „Co ma zrobić kapsel?” (`#trigStart`, rf-10), pełna sam przycisk.
    {sel: "#trigStart, #addRule", tab: "mapowanie", more: true,
     t: ["Pierwszy wyzwalacz", "Your first trigger"],
     b: ["Wyzwalacz łączy ruch kapsla, na przykład przechylenie w lewo, z akcją: klawiszem, kliknięciem albo makrem. Kiedy skończysz przewodnik, wybierz ruch w kaflach „Co ma zrobić kapsel?” albo kliknij „Nowy wyzwalacz”.",
         "A trigger ties a capsule movement, such as a tilt to the left, to an action: a key, a click or a macro. Once the tour is over, pick a movement in the “What should the capsule do?” tiles or click “New trigger”."]},
    {sel: "#rfNavTools", more: true,
     t: ["Narzędzia", "Tools"],
     b: ["Nakładka pokazuje okienka nad grą, a Czujnik i Połączenie to szczegóły kapsla. Na samym dole nawigacji są Ustawienia samego programu, w tym stop awaryjny.",
         "Overlay shows small windows over the game; Sensor and Connection are the capsule’s details. At the very bottom of the navigation is Settings for the program itself, emergency stop included."]},
    {sel: "#modeToggle", pos: "below", more: true,
     t: ["LIVE albo symulacja", "LIVE or simulation"],
     b: ["W symulacji aplikacja sama udaje kapsel, więc wszystko przećwiczysz bez sprzętu. LIVE łączy się z prawdziwymi kapslami. Przełączenie uruchamia aplikację ponownie.",
         "In simulation the app plays the capsule itself, so you can practise everything without hardware. LIVE connects to real capsules. Switching restarts the app."]},
    // POMOC I SPOŁECZNOŚĆ: strona projektu i Discord stoją w okienku jednego przycisku (rf-34h).
    // Nazwy kanałów ze stałych rf-00, bo kopia w tekście zestarzałaby się przy pierwszej zmianie.
    {sel: "#helpBtn", pos: "below", more: true,
     t: ["Pomoc i społeczność", "Help and community"],
     b: ["Pod tym przyciskiem są strona projektu i serwer Discord. Tam wymienisz się zestawami z innymi: na kanale " + RF_FORUM_NAME + " wrzucasz swój zestaw pod grę i pobierasz cudze, a panel wczyta je jednym kliknięciem. Krok po kroku przeprowadzi Cię przycisk „Wymiana” w zakładce Zestawy. Na " + RF_HELP_NAME + " zapytasz, gdy coś nie działa, na " + RF_SHOWCASE_NAME + " pokażesz swoje sterowanie w akcji, a na " + RF_IDEAS_NAME + " zgłosisz pomysł.",
         "This button holds the project page and the Discord server. That is where you swap setups with others: in " + RF_FORUM_NAME + " you post your setup for a game and grab other people’s, and the panel loads them in one click. The “Exchange” button in the Setups tab walks you through it. Ask in " + RF_HELP_NAME + " when something does not work, show your setup in action in " + RF_SHOWCASE_NAME + " and suggest ideas in " + RF_IDEAS_NAME + "."]},
    // WYPRÓBUJ: Synth i RibbitBeat stoją OBOK modułów i pozwalają od razu przetestować aplikację.
    // Krok pokazuje całą sekcję „Wypróbuj” (rf-34b `#rfPlayCard`): nagłówek, Synth i link do gry.
    {sel: "#rfPlayCard", more: true,
     t: ["Wypróbuj od razu: Synth i RibbitBeat", "Try it out: Synth and RibbitBeat"],
     b: ["To najszybszy sposób, żeby zobaczyć i usłyszeć kapsel w akcji, bez żadnej konfiguracji. Synth gra z ruchu kapsla: machasz i słyszysz, a później możesz go spiąć z resztą modułów. RibbitBeat to gra rytmiczna: śpiewasz nuty piosenki z MIDI, przechylając kapsel, razem z przyjaciółmi na kapslach, padzie albo myszy, a tablica wyników pamięta, kto trafiał najczyściej. Gra otwiera się w nowej karcie.",
         "The quickest way to see and hear the capsule in action, with no setup at all. The Synth plays from the capsule’s motion: you wave it and you hear it, and later you can wire it up with the other modules. RibbitBeat is a rhythm game: you sing a song’s notes from a MIDI file by tilting the capsule, together with friends on capsules, a gamepad or a mouse, and the leaderboard remembers who hit the notes cleanest. The game opens in a new tab."]},
    {sel: "#tourBtn", pos: "below", more: true,
     t: ["To wszystko", "That’s it"],
     b: ["Przewodnik wróci, kiedy zechcesz: to przycisk „Przewodnik” w pasku górnym. Szczegóły każdego modułu są w jego zakładce Informacje, a pytania zadasz na Discordzie pod „Pomoc i społeczność”, na kanale #pomoc.",
         "The tour is here whenever you want it: the “Tour” button in the top bar. Each module’s details are in its About tab, and you can ask questions on Discord under “Help and community”, in #pomoc."]},
  ];

  const T = p => { if (typeof p === "function") p = p(); return typeof _gl === "function" ? _gl(p[0], p[1]) : p[0]; };
  const _vis = el => !!(el && el.getClientRects().length > 0);
  // `sel` może wymieniać kilka celów po przecinku w kolejności ważności: bierzemy pierwszy widoczny,
  // a gdy żaden nie jest widoczny (krok z `tab` przed przełączeniem), pierwszy istniejący.
  function _el(sel) {
    if (!sel) return null;
    const L = sel.split(",").map(x => document.querySelector(x.trim())).filter(Boolean);
    return L.find(_vis) || L[0] || null;
  }
  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

  let _list = [], _i = -1, _root = null, _spot = null, _card = null, _prevTab = null, _back = null, _raf = 0;
  let _more = false;    // czy idzie druga część („Pokaż resztę”)

  function _activeTab() {
    const b = document.querySelector(".tab-btn.active[data-tab]");
    return b ? b.dataset.tab : null;
  }
  // Czy krok ma na czym stanąć. Kroki z `tab` sprawdzamy samym istnieniem: ich panel jest teraz
  // schowany (0×0), a pokaże się dopiero po przełączeniu. Mapowanie to kotwica rf-34, której
  // „Widoczność" nie chowa, więc przełączenie na nią zawsze się uda.
  function _usable(s) {
    if (!s.sel) return true;
    const el = _el(s.sel);
    if (!el) return false;
    return s.tab ? true : _vis(el) || !!el.closest("details:not([open])");
  }
  // Cel bywa w zwiniętym zwijaku (piętra 2 i 3, rf-28d). Otwieramy go tak jak `rfReady.show`, ale
  // przewodnik tylko pokazuje: przy końcu zwijamy z powrotem to, co sami otworzyliśmy.
  let _opened = [];
  function _unfold(el) {
    for (let d = el && el.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) {
      if (!d.open) { d.open = true; _opened.push(d); }
    }
  }
  function _rect(s) {
    const L = [_el(s.sel)].concat(s.also ? [document.querySelector(s.also)] : []).filter(_vis);
    if (!L.length) return null;
    const R = L.map(e => e.getBoundingClientRect());
    return {left: Math.min(...R.map(r => r.left)), top: Math.min(...R.map(r => r.top)),
            right: Math.max(...R.map(r => r.right)), bottom: Math.max(...R.map(r => r.bottom))};
  }

  function _build() {
    _root = document.createElement("div");
    _root.className = "rft";
    // Tekst przewodnika jest już w dobrym języku — walker i18n nie ma tu czego szukać.
    _root.setAttribute("data-noi18n", "");
    _spot = document.createElement("div");
    _spot.className = "rft-spot";
    _spot.setAttribute("aria-hidden", "true");
    _card = document.createElement("div");
    _card.className = "rft-card";
    _card.setAttribute("role", "dialog");
    _card.setAttribute("aria-modal", "true");
    _card.setAttribute("aria-labelledby", "rftTitle");
    _card.setAttribute("aria-describedby", "rftBody");
    _card.innerHTML =
      '<div class="rft-top"><span class="rft-count" id="rftCount"></span>' +
      '<button type="button" class="rft-x" id="rftClose"><span aria-hidden="true">×</span></button></div>' +
      '<div aria-live="polite"><h3 class="rft-title" id="rftTitle"></h3><p class="rft-body" id="rftBody"></p></div>' +
      '<div class="rft-dots" aria-hidden="true"></div>' +
      '<div class="rft-acts"><button type="button" class="btn" id="rftPrev"></button>' +
      '<button type="button" class="btn" id="rftMore" hidden></button>' +
      '<button type="button" class="btn primary" id="rftNext"></button></div>';
    _root.appendChild(_spot);
    _root.appendChild(_card);
    document.body.appendChild(_root);
    _card.querySelector("#rftClose").onclick = () => stop();
    _card.querySelector("#rftPrev").onclick = () => go(_i - 1);
    _card.querySelector("#rftNext").onclick = () => (_i >= _list.length - 1 ? stop() : go(_i + 1));
    _card.querySelector("#rftMore").onclick = () => _startPart(true);
  }

  function _text() {
    const s = _list[_i]; if (!s || !_card) return;
    const q = id => _card.querySelector(id);
    q("#rftCount").textContent = (_more ? _gl("Więcej: krok ", "More: step ") : _gl("Krok ", "Step ")) +
      (_i + 1) + _gl(" z ", " of ") + _list.length;
    q("#rftTitle").textContent = T(s.t);
    q("#rftBody").textContent = T(s.b);
    const x = q("#rftClose");
    x.setAttribute("aria-label", _gl("Zamknij przewodnik", "Close the tour"));
    x.title = x.getAttribute("aria-label");
    const prev = q("#rftPrev"), next = q("#rftNext");
    prev.textContent = _gl("Wstecz", "Back");
    prev.disabled = _i === 0;
    next.textContent = _i >= _list.length - 1 ? _gl("Zakończ", "Finish") : _gl("Dalej", "Next");
    // „Pokaż resztę” tylko na ostatniej karcie pierwszej części i tylko wtedy, gdy reszta ma kroki.
    const more = q("#rftMore");
    more.textContent = _gl("Pokaż resztę", "Show the rest");
    more.hidden = _more || _i < _list.length - 1 || !STEPS.some(x => x.more && _usable(x));
    const dots = _card.querySelector(".rft-dots");
    dots.innerHTML = _list.map((_, k) => '<i class="' + (k === _i ? "on" : "") + '"></i>').join("");
  }

  // Dymek staje obok podświetlenia: po prawej, po lewej, pod nim albo nad nim — pierwsze miejsce,
  // w którym się mieści. Kolumny mają własne przewijanie, więc pozycję liczymy od nowa przy każdym
  // przewinięciu i zmianie rozmiaru okna, a nie raz na krok.
  function _place() {
    _raf = 0;
    const s = _list[_i]; if (!s || !_card) return;
    const vw = innerWidth, vh = innerHeight, M = 10, GAP = 14, PAD = 6;
    const cw = _card.offsetWidth, ch = _card.offsetHeight;
    const r = s.sel ? _rect(s) : null;
    let cx, cy;
    if (!r) {
      _spot.classList.add("none");
      Object.assign(_spot.style, {left: vw / 2 + "px", top: vh / 2 + "px", width: "0px", height: "0px"});
      cx = (vw - cw) / 2; cy = (vh - ch) / 2;
    } else {
      _spot.classList.remove("none");
      const x = Math.max(r.left - PAD, 4), y = Math.max(r.top - PAD, 4);
      const w = Math.max(Math.min(r.right + PAD, vw - 4) - x, 8), h = Math.max(Math.min(r.bottom + PAD, vh - 4) - y, 8);
      Object.assign(_spot.style, {left: x + "px", top: y + "px", width: w + "px", height: h + "px"});
      const opts = [
        [x + w + GAP, y, x + w + GAP + cw <= vw - M],
        [x - GAP - cw, y, x - GAP - cw >= M],
        [x, y + h + GAP, y + h + GAP + ch <= vh - M],
        [x, y - GAP - ch, y - GAP - ch >= M],
      ];
      // Pasek górny jest szeroki i niski: dymek obok zasłoniłby sąsiednie przyciski, pod spodem nie.
      if (s.pos === "below") opts.unshift(opts.splice(2, 1)[0]);
      const o = opts.find(p => p[2]) || [(vw - cw) / 2, vh - ch - M];
      cx = o[0]; cy = o[1];
    }
    _card.style.left = Math.round(Math.min(Math.max(cx, M), Math.max(vw - cw - M, M))) + "px";
    _card.style.top = Math.round(Math.min(Math.max(cy, M), Math.max(vh - ch - M, M))) + "px";
  }
  const _schedule = () => { if (!_raf) _raf = requestAnimationFrame(_place); };

  function go(i) {
    if (i < 0 || i >= _list.length) return;
    _i = i;
    const s = _list[_i];
    if (s.tab && _activeTab() !== s.tab && typeof global.setTabById === "function") {
      try { global.setTabById(s.tab); } catch (e) {}
    }
    _text();
    // Najpierw zakładka i tekst (dymek zna już swój wymiar), potem przewinięcie do celu, na końcu
    // pozycja — synchronicznie, bo odczyt wymiarów sam wymusza układ. Na rAF nie czekamy: w oknie
    // w tle klatka nie przychodzi wcale i dymek zostałby na poprzednim miejscu. Przy płynnym
    // przewijaniu resztę dopilnuje nasłuch `scroll`.
    const el = _el(s.sel);
    if (el) _unfold(el);
    if (el) try { el.scrollIntoView({block: "nearest", inline: "nearest", behavior: reduced() ? "auto" : "smooth"}); } catch (e) {}
    _place();
    const n = _card && _card.querySelector("#rftNext");
    if (n) try { n.focus({preventScroll: true}); } catch (e) {}
  }

  function _key(e) {
    if (!_root) return;
    const k = e.key;
    if (k === "Escape") { e.preventDefault(); e.stopPropagation(); stop(); return; }
    // Strzałki zmieniają krok TYLKO wtedy, gdy nie stoi się na przycisku, bo Enter/Spacja na
    // przycisku robią swoje i tak — a panel pod spodem nie może dostać żadnego z tych klawiszy.
    if (k === "ArrowRight") { e.preventDefault(); e.stopPropagation(); if (_i < _list.length - 1) go(_i + 1); return; }
    if (k === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); go(_i - 1); return; }
    if (k === "Tab") {
      // Pułapka fokusu: dialog modalny, Tab krąży po jego trzech przyciskach.
      const f = [..._card.querySelectorAll("button:not([disabled])")];
      if (!f.length) return;
      const at = f.indexOf(document.activeElement);
      e.preventDefault(); e.stopPropagation();
      f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  }

  // Przejście do drugiej części w tym samym dymku: zmienia się lista, licznik zaczyna od nowa.
  function _startPart(more) {
    const L = STEPS.filter(x => !!x.more === !!more && _usable(x));
    if (!L.length) return false;
    _more = !!more; _list = L;
    if (_root) go(0);
    return true;
  }
  function start() {
    if (_root) return;
    if (!_startPart(false)) return;
    _prevTab = _activeTab();
    _back = document.activeElement;
    _build();
    document.addEventListener("keydown", _key, true);
    addEventListener("resize", _schedule);
    addEventListener("scroll", _schedule, true);   // capture: kolumny przewijają się same, nie okno
    document.documentElement.classList.add("rft-on");
    go(0);
  }

  function stop() {
    if (!_root) return;
    document.removeEventListener("keydown", _key, true);
    removeEventListener("resize", _schedule);
    removeEventListener("scroll", _schedule, true);
    if (_raf) cancelAnimationFrame(_raf), _raf = 0;
    _root.remove(); _root = _spot = _card = null; _i = -1;
    _opened.forEach(d => { try { d.open = false; } catch (e) {} }); _opened = [];
    document.documentElement.classList.remove("rft-on");
    if (_prevTab && _activeTab() !== _prevTab && typeof global.setTabById === "function") {
      try { global.setTabById(_prevTab); } catch (e) {}
    }
    const b = document.getElementById("tourBtn");
    try { (b || _back || document.body).focus({preventScroll: true}); } catch (e) {}
  }

  // JEDNORAZOWE ZAPROSZENIE (UX 261120, D8). Notka czaszki w rogu, bez blokowania panelu, przy
  // pierwszym otwarciu w tej przeglądarce. Flaga w `localStorage`, a nie w ustawieniach serwera:
  // to podpowiedź, nie ustawienie. Zapisywana od razu przy pokazaniu, więc zaproszenie nie wraca
  // po odświeżeniu, nawet gdy nikt go nie kliknął. „Gotowe zestawy” prowadzą do pierwszego kroku
  // z instrukcji. Liczba kroków w zdaniu to długość pierwszej części (`more` bez flagi).
  // `force` (rf-48b po pierwszym pytaniu): flagę pytanie ustawiło już samo, zaproszenie i tak idzie.
  const OFFER_LS = "ribbitflip.tourOffered";
  function _offer(force) {
    if (force !== true) {
      try { if (localStorage.getItem(OFFER_LS)) return; localStorage.setItem(OFFER_LS, "1"); } catch (e) { return; }
    }
    if (typeof global.rfSkullNote !== "function") return;
    global.rfSkullNote(_gl("Pierwszy raz tutaj? Pokażę Ci panel w 6 krokach.",
                           "First time here? I’ll show you the panel in 6 steps."), {
      ms: 0,
      actions: [
        {label: _gl("Pokaż mi panel", "Show me the panel"), primary: true, onClick: start},
        {label: _gl("Gotowe zestawy", "Ready setups"),
         onClick: () => { if (typeof global.setTabById === "function") global.setTabById("konfiguracje"); }},
      ],
    });
  }

  // Przycisk w pasku górnym, za przełącznikiem LIVE/Symulacja. Staje przed `#siteLink`, który
  // zaraz potem rf-34h zamienia na „Pomoc i społeczność”, więc oba przyciski pomocy stoją obok
  // siebie. `aria-label`/`title` mają pełne zdanie w słowniku rf-01.
  function initTour() {
    if (typeof IS_OVERVIEW !== "undefined" && IS_OVERVIEW) return;
    if (document.documentElement.classList.contains("rf-ovl")) return;
    const hdr = document.querySelector("header");
    if (!hdr || !document.getElementById("rfApp") || document.getElementById("tourBtn")) return;
    const b = document.createElement("button");
    b.type = "button"; b.id = "tourBtn"; b.className = "btn";
    const tip = "Przewodnik po panelu: pokażę krok po kroku, gdzie co jest";
    b.setAttribute("aria-label", tip); b.title = tip;
    // Ikona `pytanie.png` i napis „Przewodnik” (UX 261120): „i” znaczy w aplikacji wyłącznie
    // Informacje modułu. Napis stoi od 1440 px, niżej sama ikona (budżet paska, 27-tour.css);
    // nazwę zawsze niesie `aria-label`, zaczynający się od widocznego napisu.
    b.innerHTML = '<span class="bic bic-tour" aria-hidden="true"></span><span class="btn-lbl">Przewodnik</span>';
    b.onclick = start;
    const site = document.getElementById("siteLink");
    if (site && site.parentNode === hdr) hdr.insertBefore(b, site); else hdr.appendChild(b);
    setTimeout(() => _offer(false), 1500);
  }

  global.initTour = initTour;
  global.rfTourStart = start;
  global.rfTourStop = stop;
  global.rfTourOffer = _offer;
  global.rfTourRelang = function () { if (_root) { _text(); _schedule(); } };
})(window);
