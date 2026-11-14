"use strict";
// ==================================================================================================
//  MODUŁ = TRZY ZAKŁADKI: Konfiguracja · Biblioteka · ℹ
//
//  SKĄD TO SIĘ WZIĘŁO: każdy moduł po lewej ma 3 zakładki w tej kolejności: Konfiguracja,
//  Biblioteka i Informacje (jako ikonka i). Każda otwiera w centralnym panelu inną zawartość.
//
//  CO ZASTĘPUJE. Do 2026-08-30 środkowa kolumna modułu z presetami wyglądała tak: okruszki, a pod
//  nimi NA STAŁE lista presetów po lewej (288 px) i konfiguracja po prawej. Trzy rzeczy naraz na
//  jednym ekranie, z czego dwie potrzebne raz na tydzień: lista presetów zabierała jedną trzecią
//  szerokości przy KAŻDYM kręceniu pokrętła, a poradnik siedział zwinięty na górze konfiguracji
//  i nikt go nie otwierał, bo wyglądał jak kolejna sekcja do przewinięcia.
//
//  TRZY ZAKŁADKI ROZDZIELAJĄ TRZY CZYNNOŚCI, KTÓRE NIGDY NIE DZIEJĄ SIĘ NARAZ:
//    · Konfiguracja — kręcisz pokrętłami tego kapsla. Na górze JEDNO zdanie o tym, co on nosi
//      i czy to jest zapisane (`rfpc-state`), bo to jedyne pytanie, które przy kręceniu wraca.
//    · Biblioteka   — przeglądasz, porządkujesz i wczytujesz nazwane konfiguracje. Lista dostaje
//      tu CAŁĄ szerokość panelu, więc obok niej mieści się opis pozycji, na którą patrzysz.
//    · ℹ            — poradnik modułu, rozwinięty. Ten sam tekst, który stał zwinięty na górze
//      konfiguracji; przeniesiony, nie napisany od nowa (jedno źródło, jeden komplet kluczy i18n).
//
//  ZASADY, KTÓRE TRZYMAJĄ TO W CAŁOŚCI:
//
//  1. ZAWARTOŚĆ JEST PRZENOSZONA, NIGDY ODTWARZANA. `appendChild` zabiera karty razem z ich
//     nasłuchami i id-kami. Odtworzenie przez innerHTML daje objaw, który ten projekt już raz
//     zaliczył: zero błędów w konsoli, wszystko się rysuje, przyciski martwe
//     (.github/CONTRIBUTING.md, pułapka „montowanie to nie działanie”).
//
//  2. ZAKŁADKA UKRYTA TO `display:none`, więc nic w niej nie ma wymiaru i nie posuwa rAF-a.
//     Wejście w zakładkę musi obudzić to, co rysuje się z rozmiaru pojemnika — dokładnie tak samo,
//     jak robi to `setTab` w rf-34 dla koła i macierzy modułów. Stąd `spec.onShow`.
//
//  3. WYBRANA ZAKŁADKA ŻYJE W PAMIĘCI SESJI, NIE W localStorage. Wracasz do modułu tam, gdzie go
//     zostawiłeś, ale nowe uruchomienie aplikacji zawsze zaczyna na Konfiguracji: panel, który po
//     starcie otwiera się na poradniku, wygląda, jakby o czymś przypominał.
//
//  4. WCZYTANIE PRESETU Z BIBLIOTEKI PRZERZUCA NA KONFIGURACJĘ. „Wczytaj" znaczy „chcę teraz tego
//     używać", a nie „chcę dalej przeglądać listę". Zapis, zmiana nazwy i usunięcie zostają
//     w Bibliotece, bo to są czynności porządkowe i robi się je seriami.
//
//  Ładowany PO rf-49j (dopisuje do jego przestrzeni `window._rfpc`), a wołany z jego `build()`.
// ==================================================================================================

const RF_MODTABS_I18N = {
  "Konfiguracja": "Configuration",
  "Informacje": "About",
  "Ustawienia tego modułu na wybranym kapslu": "This module's settings on the selected capsule",
  "Zapisane presety tego modułu": "This module's saved presets",
  // Podpowiedź zakładki ℹ NIE zaczyna się od „Informacje” — nazwa dostępna to „<nazwa> — <podpowiedź>”
  // (niżej, przy `b.title`), więc dawne „Informacje — Informacje o module…” / „About — About this
  // module…” czytnik ekranu mówił dwa razy to samo słowo.
  "Co robi ten moduł i jak z niego korzystać": "What this module does and how to use it",
  "Ten moduł nie ma jeszcze poradnika.": "This module has no guide yet.",
  // Podpowiedzi dwóch pozycji nawigacji na poziomie programu. Pary stoją TUTAJ, bo to ta
  // przebudowa je wprowadziła: dawna „Biblioteka" nie mogła zostać, skoro każdy moduł ma
  // zakładkę o tej nazwie. Napisy przycisków („Zestawy", „Ustawienia") mają pary w rf-01-i18n.
  "Zestawy (cała konfiguracja pod jedną grę), wymiana z forum i wszystko, co masz zapisane na dysku":
    "Setups (a whole configuration for one game), the forum exchange, and everything you have saved on this disk",
  "Ustawienia samego programu: stop awaryjny, serwer MCP dla asystentów AI, zgłoszenie problemu":
    "The program's own settings: the emergency stop, the MCP server for AI assistants, reporting a problem",
};
try { Object.assign(I18N_EN, RF_MODTABS_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

(function (global) {

  const $ = global._rfpc = global._rfpc || {};
  const el = $.el, _t = $.t;

  // Kolejność jest celowa i jest kolejnością CZYNNOŚCI: najpierw to, co się robi
  // codziennie, potem to, co raz na jakiś czas, na końcu to, co się czyta raz.
  //   „Informacje” mają napis (UX 261120, D2): sama ikona „i” znaczyła też przewodnik po panelu,
  //   a nazwa była tylko w dymku. Kolor niebieski zostaje (`is-ic` w 22-modtabs.css), bo odróżnia
  //   zakładkę do czytania od dwóch zakładek pracy.
  //  Ikony mają WŁASNE klasy (`.rfpc-tab-ic.is-*` w 22-modtabs.css), a nie `tab-ic-*` z paska
  //  nawigacji: tamten zestaw jest indeksowany polem `png` z TABS i dopisanie do niego pozycji,
  //  której żadna zakładka nie używa, zakładałoby drugą umowę o tej samej nazwie.
  //  `only` — zakładka WYŁĄCZNIE dla jednego modułu; `take` — selektor tego, co ma do niej
  //  pojechać z panelu (zamiast do Konfiguracji). Jedno i drugie po to, żeby „Biblioteka dźwięków"
  //  Synth-a przestała być zwijakiem NA ŚRODKU konfiguracji: edytor brzmienia to osobna praca,
  //  a nie sekcja ustawień padów, i rozwinięty spychał je o ekran w dół.
  const PANES = [
    { k: "cfg",  pl: "Konfiguracja", en: "Configuration",
      hint: ["Ustawienia tego modułu na wybranym kapslu", "This module's settings on the selected capsule"] },
    { k: "snd",  pl: "Brzmienia",    en: "Sounds", only: "pad", take: "#soundEditor",
      hint: ["Twoje brzmienia: twórz i edytuj własne", "Your sounds: create and edit your own"] },
    { k: "lib",  pl: "Biblioteka",   en: "Library",
      hint: ["Zapisane presety tego modułu", "This module's saved presets"] },
    { k: "info", pl: "Informacje",   en: "About", blue: true,
      hint: ["Co robi ten moduł i jak z niego korzystać", "What this module does and how to use it"] },
  ];
  //  Zakładki TEGO modułu. Reszta pliku chodzi po niej, nie po `PANES` — inaczej `setPane`
  //  próbowałby zgasić panel, którego ten moduł w ogóle nie zbudował.
  const panesOf = (spec) => PANES.filter(p => !p.only || p.only === spec.tab);
  $.PANES = PANES;

  // ------------------------------------------------------------------------------------------
  //  PORADNIK → ZAWARTOŚĆ ZAKŁADKI ℹ
  // ------------------------------------------------------------------------------------------
  // Poradniki są `<details class="mapwiki">` wstawiane na górę panelu przez `initGuides` (rf-39b),
  // a poradnik Mapowania jest pisany wprost w rf-34. W zakładce, która NIE MA nic poza poradnikiem,
  // zwijanie jest bez sensu: zwinięty poradnik zostawia pustą zakładkę. Zdejmujemy więc skorupę
  // `<details>`, a jej `<summary>` staje się nagłówkiem.
  //
  // ⚠️ WĘZŁY TEKSTOWE SĄ PRZENOSZONE, NIE PRZEPISYWANE. Walker i18n dopasowuje CAŁE węzły tekstowe
  // do słownika, więc przeniesiony węzeł tłumaczy się dalej, a `textContent = sum.textContent`
  // skleiłoby ikonę z napisem w jeden łańcuch, którego w słowniku nie ma — i poradniki zostałyby
  // po polsku w angielskiej wersji.
  function guideBox(node) {
    const box = el("div", "rfpc-info");
    if (node.id) box.id = node.id;
    const sum = node.querySelector("summary");
    const body = node.querySelector(".mapwiki-body");
    const h = el("h3", "rfpc-info-h");
    if (sum) while (sum.firstChild) h.appendChild(sum.firstChild);
    box.appendChild(h);
    if (body) box.appendChild(body);
    else {                                  // poradnik bez `.mapwiki-body` — bierzemy, co zostało
      while (node.firstChild) {
        if (node.firstChild.tagName === "SUMMARY") { node.removeChild(node.firstChild); continue; }
        box.appendChild(node.firstChild);
      }
    }
    return box;
  }
  // Czy ten węzeł jest poradnikiem tego modułu. Po klasie, nie po id: poradnik Mapowania powstaje
  // w rf-34 i nigdy id nie miał, a dokładanie mu go tylko dla tego testu byłoby drugą umową
  // o tym samym.
  function isGuide(n) {
    return n.nodeType === 1 && n.classList && n.classList.contains("mapwiki");
  }
  // Obie funkcje są też JEDYNĄ implementacją tego samego dla pozycji „Reszty" (rf-49p): tam pytanie
  // brzmi identycznie („co z tego panelu jest do czytania, a co do klikania"), a druga odpowiedź
  // na nie rozjechałaby się przy pierwszej poprawce nagłówka.
  $.guideBox = guideBox;
  $.isGuide = isGuide;

  // ------------------------------------------------------------------------------------------
  //  PRZEŁĄCZANIE
  // ------------------------------------------------------------------------------------------
  $.setPane = function (I, k, opt) {
    if (!I || !I.panes || !I.panes[k]) return;
    const first = I.pane !== k;
    I.pane = k;
    for (const p of (I.PANES || PANES)) {
      const on = p.k === k;
      I.panes[p.k].classList.toggle("active", on);
      I.panes[p.k].hidden = !on;
      const b = I.tabBtn[p.k];
      // `on` to klasa WYBRANEGO PRZYCISKU aplikacji (`button.btn.on` w 07-felt-core: różowe wypełnienie,
      // biały napis, cień) — a przy okazji ta sama, po której 14d-buttons.css daje białą nitkę ściegu
      // na nasyconym tle. Zakładka modułu jest przyciskiem tego programu, a nie trzecim wynalazkiem
      // na to samo. `active` zostaje osobno — po niej szuka inwentarz.
      b.classList.toggle("on", on);
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;             // roving tabindex — tabulator wchodzi w pasek raz
    }
    if (opt && opt.focus) { try { I.tabBtn[k].focus(); } catch (e) { } }
    if (!first) return;
    // Panel dopiero co dostał wymiar: budzimy to, co rysuje się z rozmiaru pojemnika, i puszczamy
    // to samo wejście, które ma każda zakładka główna (rfStagger). Kolejność ma znaczenie — wejście
    // animuje karty, które muszą już być narysowane.
    if (k === "cfg" && I.spec.onShow) { try { I.spec.onShow(); } catch (e) { } }
    try { if (global.rfStagger) global.rfStagger(I.panes[k]); } catch (e) { }
  };

  // Wołane po wczytaniu presetu z Biblioteki — patrz zasada 4 w nagłówku.
  $.toConfig = function (I) { $.setPane(I, "cfg"); };

  // ------------------------------------------------------------------------------------------
  //  ODSŁOŃ ZAKŁADKĘ, W KTÓREJ COŚ LEŻY
  // ------------------------------------------------------------------------------------------
  //  Odkąd panel modułu jest podzielony na zakładki, każdy odnośnik prowadzący do KONKRETNEGO
  //  elementu (poradnik makr spod pola sekwencji, „Rysunek: co jest czym" z okna wymiany) musi
  //  najpierw otworzyć tę z nich, w której ten element siedzi. Przewijanie do czegoś bez wymiaru
  //  kończy się niczym i niczym nie miga — a człowiek zostaje z wrażeniem, że przycisk nic nie robi.
  //  Jedna droga dla obu rodzajów ramek: moduł obsługiwany tutaj, „Reszta" oddana do rf-49p, który
  //  ma swój własny rejestr instancji. Pytamy o niego leniwie, bo ładuje się PO tym pliku.
  $.revealPane = function (node) {
    if (!node || !node.closest) return false;
    const pane = node.closest(".rfpc-pane");
    if (!pane) return false;
    const wrap = pane.closest(".rfpc");
    if (!wrap) return false;
    if (wrap.classList.contains("rfpc-rest")) {
      try { return !!(global.rfRestTabs && global.rfRestTabs.reveal(node)); } catch (e) { return false; }
    }
    const I = $.INST && $.INST[String(wrap.id || "").replace(/^rfpc-/, "")];
    const k = (String(pane.className).match(/rfpc-pane-(\w+)/) || [])[1];
    if (!I || !k) return false;
    $.setPane(I, k);
    return true;
  };
  global.rfRevealPane = function (n) { try { return $.revealPane(n); } catch (e) { return false; } };

  // ------------------------------------------------------------------------------------------
  //  RYSUNEK MODUŁU: DUŻY NA GÓRZE, MALEJE PRZY PRZEWIJANIU
  // ------------------------------------------------------------------------------------------
  //  Ikona modułu w konfiguracji jest dwu-, trzykrotnie większa: duża na początku, a im niżej
  //  przewijasz, tym mniejsza, ale nadal nieco większa niż dawniej.
  //
  //  Dlaczego to działa: pasek modułu jest PRZYKLEJONY do góry i jedzie z człowiekiem przez cały
  //  ekran. Na samej górze jest jeszcze nagłówkiem — ma miejsce i ma co powiedzieć, więc rysunek
  //  gra rolę okładki. Po zjechaniu w dół zostaje mu rola drogowskazu („na czym jestem"), a wtedy
  //  56 px zabierałoby wysokość treści, którą się właśnie czyta. Nazwa i pigułka kapsla zostają
  //  bez zmian — zmienia się WYŁĄCZNIE rysunek, więc pasek nie skacze wysokością bardziej, niż
  //  wynika ze zmiany jego najwyższego elementu.
  //
  //  Jeden nasłuch na całą aplikację i jedna zmienna na `<html>`: paneli modułów jest osiem, a każdy
  //  ma swój pasek — osiem nasłuchów liczyłoby osiem razy to samo `scrollY`. Środkowa kolumna
  //  przewija się RAZEM ZE STRONĄ (patrz komentarz przy `.rfpc-head` w 22-modtabs.css), więc
  //  właściwym sygnałem jest `scrollY` okna, a nie przewijanie któregoś pojemnika.
  if (!global._rfModIc) {
    global._rfModIc = true;
    const HERO = 56, REST = 30, SPAN = 140;   // px rysunku na górze, px po zjechaniu, droga zmiany
    const root = document.documentElement;
    // Ruch wyłączony w systemie: rysunek stoi od razu w rozmiarze docelowym. Zmiana wielkości
    // sterowana przewijaniem to dokładnie ten rodzaj ruchu, który ta preferencja wyłącza.
    const still = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const paint = function () {
      raf = 0;
      if (still && still.matches) { root.style.setProperty("--rfpc-modic", REST + "px"); return; }
      const y = global.scrollY || root.scrollTop || 0;
      const t = Math.max(0, Math.min(1, y / SPAN));
      root.style.setProperty("--rfpc-modic", (HERO + (REST - HERO) * t).toFixed(1) + "px");
    };
    const soon = function () { if (!raf) raf = global.requestAnimationFrame(paint); };
    global.addEventListener("scroll", soon, { passive: true });
    global.addEventListener("resize", soon, { passive: true });
    if (still && still.addEventListener) still.addEventListener("change", soon);
    paint();
  }

  // Przyciski „Otwórz poradnik" przy polach makra. Nasłuch jest DELEGOWANY i zakładany RAZ, bo
  // edytor wyzwalacza przebudowuje swój DOM przy każdym otwarciu reguły — przycisk podpinany na
  // sztywno żyłby do pierwszego przerysowania i umierał po cichu.
  if (!global._rfMgGoto) {
    global._rfMgGoto = true;
    document.addEventListener("click", function (e) {
      const b = e.target && e.target.closest && e.target.closest("[data-mg-goto]");
      if (!b) return;
      const d = document.getElementById(b.getAttribute("data-mg-goto"));
      if (!d) return;
      e.preventDefault();
      $.revealPane(d);
      d.open = true;
      try { d.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (err) { d.scrollIntoView(); }
    });
  }

  // ------------------------------------------------------------------------------------------
  //  SZKIELET
  // ------------------------------------------------------------------------------------------
  //  Buduje całą ramkę modułu i rozdaje jej części na `I`. Wywoływane z `build()` w rf-49j, które
  //  potem tylko podpina nasłuchy — dzięki temu tamten plik nie rośnie o cały ten układ
  //  (limit 500/800 linii, .github/CONTRIBUTING.md).
  $.buildFrame = function (I) {
    const spec = I.spec, panel = I.panel;

    const wrap = el("div", "rfpc"); wrap.id = "rfpc-" + spec.tab;
    // Hub (rf-49i) i cienki pasek tożsamości (rf-49) odpowiadają na to samo pytanie, co blok stanu
    // na górze Konfiguracji. Trzy rysunki jednej rzeczy w jednym panelu uczą, że któryś kłamie —
    // więc dwa starsze się chowają. Pliki i funkcje ZOSTAJĄ (mają harnessy, a stopka Biblioteki
    // klika ich przyciski), chowa je sam arkusz.
    wrap.classList.add("rfpc-took");

    // Nagłówek: okruszki po lewej, pasek zakładek po prawej. W jednym wierszu, bo trzy kolumny
    // powstały po to, żeby moduł mieścił się bez przewijania — drugi pasek pod okruszkami
    // kosztowałby 38 px na każdym ekranie aplikacji.
    const head = el("div", "rfpc-head");
    const crumb = el("div", "rfpc-crumb");
    const tabs = el("div", "rfpc-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", panesOf(spec).map(p => _t(p.pl, p.en)).join(" · "));
    head.appendChild(crumb); head.appendChild(tabs);
    // Ten pasek zasłania górę modułu, a przyklejone kolumny w środku (scena koła, podgląd myszy,
    // mapa kontrolera, podgląd skanera) mają się zatrzymać POD nim. Jego wysokość jest MIERZONA
    // i idzie w `--rf-modhead-h` — patrz `rfWatchModHead` w rf-40 i `--rf-sticky-top`
    // w 22-modtabs.css. Zgłoszenie z 14.09: zgadywane liczby w arkuszach parkowały kolumny pod
    // paskiem, bo pasek ma 75 px, a nie 46.
    if (typeof global.rfWatchModHead === "function") global.rfWatchModHead(head);

    const panes = el("div", "rfpc-panes");
    I.panes = Object.create(null); I.tabBtn = Object.create(null);
    I.PANES = panesOf(spec);
    for (const p of I.PANES) {
      // `btn sm` — bo to JEST przycisk tego programu i ma nosić jego ścieg (górne
      // przyciski są w stylu obszytych). Cała reszta jedzie z tego za
      // darmo: kremowe wypełnienie i cień (07-felt-core), ścieg 1,5 px kreskowany w środku wraz
      // z geometrią wariantu `sm` (14d-buttons), ruch pod kursorem (14-motion) i biała nitka na
      // wybranej zakładce. Dawniej stał tu `.seg`, czyli przełącznik segmentowy — a jego dzieci są
      // ze ściegu WYŁĄCZONE z założenia („kontener wokół nich jest już obszyty").
      const b = el("button", "btn sm rfpc-tab" + (p.blue ? " is-ic" : ""));
      b.type = "button"; b.dataset.pane = p.k;
      b.setAttribute("role", "tab");
      b.id = "rfpcTab-" + spec.tab + "-" + p.k;
      b.setAttribute("aria-controls", "rfpcPane-" + spec.tab + "-" + p.k);
      const ic = el("span", "rfic rfpc-tab-ic is-" + p.k);
      ic.setAttribute("aria-hidden", "true");
      b.appendChild(ic);
      // Napis w osobnym węźle — walker i18n dopasowuje całe węzły tekstowe.
      b.appendChild(el("span", null, _t(p.pl, p.en)));
      // Przy ≤1100 px napis schodzi z zakładki (22-modtabs.css), więc nazwa dostępna stoi w
      // `aria-label`. Świadomie TA SAMA treść co w dymku: drugi napis znaczyłby drugie miejsce,
      // w którym można powiedzieć co innego.
      b.title = _t(p.pl, p.en) + ": " + _t(p.hint[0], p.hint[1]);
      b.setAttribute("aria-label", b.title);
      b.addEventListener("click", () => $.setPane(I, p.k));
      tabs.appendChild(b);
      I.tabBtn[p.k] = b;

      const pane = el("div", "rfpc-pane rfpc-pane-" + p.k);
      pane.id = "rfpcPane-" + spec.tab + "-" + p.k;
      pane.setAttribute("role", "tabpanel");
      pane.setAttribute("aria-labelledby", b.id);
      pane.hidden = true;
      panes.appendChild(pane);
      I.panes[p.k] = pane;
    }
    // Strzałki chodzą po pasku zakładek, Home/End skaczą na skraje — umowa ARIA dla `tablist`.
    tabs.addEventListener("keydown", e => {
      const ks = { ArrowRight: 1, ArrowLeft: -1, Home: "s", End: "e" };
      if (!(e.key in ks)) return;
      e.preventDefault();
      const PN = I.PANES || PANES;
      const i = PN.findIndex(p => p.k === I.pane);
      const n = ks[e.key] === "s" ? 0
              : ks[e.key] === "e" ? PN.length - 1
              : (i + ks[e.key] + PN.length) % PN.length;
      $.setPane(I, PN[n].k, { focus: true });
    });

    // ===== KONFIGURACJA =====
    // Blok stanu STOI PIERWSZY i to jest odpowiedź na życzenie „na górze który preset edytujesz
    // albo że aktywny preset nie jest zapisany i utwórz preset". Rysuje go rf-49j3.
    const stat = el("div", "rfpc-state");
    I.panes.cfg.appendChild(stat);

    // ===== BIBLIOTEKA =====
    const libSplit = el("div", "rfpc-libsplit");
    const col = el("div", "rfpc-col");
    const chead = el("div", "rfpc-h");
    const search = el("span", "rfpc-search");
    const sic = el("span", "rfic"); sic.setAttribute("aria-hidden", "true");
    const inp = document.createElement("input");
    inp.type = "text"; inp.id = "rfpcQ-" + spec.tab; inp.className = "rfpc-q";
    inp.placeholder = _t("szukaj presetu…", "search presets…");
    inp.setAttribute("aria-label", "Lista presetów tego modułu");
    search.appendChild(sic); search.appendChild(inp);
    chead.appendChild(search);
    const list = el("div", "rfpc-list"); list.id = "rfpcList-" + spec.tab;
    list.setAttribute("role", "listbox");
    // Stopka ma id z tego samego powodu, co lista: moduł bywa jedynym, który wie o przycisku
    // sensownym wyłącznie u niego (Skaner: „Przywróć zestawy z aplikacji"). Dokłada go wtedy
    // ze SWOJEJ funkcji `sync`, zamiast dopisywać sobie wyjątek we wspólnej stopce.
    const foot = el("div", "rfpc-f"); foot.id = "rfpcF-" + spec.tab;
    col.appendChild(chead); col.appendChild(list); col.appendChild(foot);
    // Panel opisu jest w Bibliotece ZAWSZE WIDOCZNY, a nie tylko przy podglądzie cudzego presetu.
    // Przed 08-31 opis wypychał kartę modułu i dlatego mógł istnieć tylko wtedy, gdy patrzyło się
    // na NIE swoją konfigurację; teraz karta stoi w innej zakładce, więc opis może odpowiadać na
    // pytanie „co to jest" o każdą pozycję, w tym o tę, którą kapsel właśnie nosi.
    const prev = el("div", "rfpc-prev");
    libSplit.appendChild(col); libSplit.appendChild(prev);
    I.panes.lib.appendChild(libSplit);

    // ===== ROZDANIE ZAWARTOŚCI PANELU =====
    // Wszystko, co panel miał, jedzie do Konfiguracji — POZA poradnikiem, który jedzie do ℹ.
    // Kolejność zostaje ta, w jakiej to zbudowano.
    let guide = null;
    while (panel.firstChild) {
      const n = panel.firstChild;
      if (isGuide(n)) { panel.removeChild(n); guide = guideBox(n); continue; }
      I.panes.cfg.appendChild(n);
    }
    // Zakładki z `take` zabierają swój kawałek z Konfiguracji DOPIERO TERAZ, szukając go w drzewie:
    // `#soundEditor` nie jest dzieckiem panelu, tylko siedzi w środku sekcji padów, więc pętla wyżej
    // nigdy by go nie zobaczyła. Węzeł jest PRZENOSZONY (`appendChild`), nigdy odtwarzany — ma na
    // sobie wszystkie nasłuchy rf-30/rf-31 i stan edytowanego brzmienia.
    for (const p of I.PANES) {
      if (!p.take || !I.panes[p.k]) continue;
      const node = I.panes.cfg.querySelector(p.take);
      if (!node) continue;
      I.panes[p.k].appendChild(node);
      // Zwijak, który stał się zakładką, nie ma już czego zwijać — zakładka JEST jego skorupą.
      if (node.tagName === "DETAILS") { node.open = true; }
      node.classList.add("rfpc-taken-fold");
    }
    I.panes.info.appendChild(guide || el("div", "rfpc-info rfpc-info-none",
      _t("Ten moduł nie ma jeszcze poradnika.", "This module has no guide yet.")));

    // ===== PORADNIK PISANIA MAKR — NA SAMYM SPODZIE ℹ =====
    // Poradnik pisania makr stoi na spodzie Informacji, a nie na zakładce konfiguracji. Stał w dwóch miejscach naraz i oba były miejscami PRACY:
    // w edytorze wyzwalacza (pod polem sekwencji) i na spodzie karty koła. Zwinięty wyglądał tam
    // jak kolejna sekcja formularza, a rozwinięty spychał przyciski zapisu o ekran w dół.
    // Tekst jest JEDEN (`macroGuideFoldHtml` w rf-12) — to nie jest kopia, tylko to samo źródło
    // wstawione tam, gdzie się CZYTA. Które moduły go dostają i pod jakim `id`, mówi pole
    // `macroGuide` w spisie modułów (rf-49j); `id` zostaje ten, co był, bo pod nim szukają go
    // przyciski „poradnik" przy polach makra.
    if (spec.macroGuide && typeof global.macroGuideFoldHtml === "function") {
      const box = document.createElement("div");
      box.innerHTML = global.macroGuideFoldHtml(spec.macroGuide);
      if (box.firstElementChild) I.panes.info.appendChild(box.firstElementChild);
    }

    // ===== WŁĄCZNIK GRUPY JEDZIE DO PASKA, NAGŁÓWEK KARTY TRACI DUBLET =====
    // Ikona modułu pokazuje się raz, nazwa modułu tylko na górze, a przycisk włącz/wyłącz stoi
    // na górze na lewo od Konfiguracji, jako wyraźnie wydzielony segment.
    //
    // Trzy rzeczy naraz, bo to jedno pytanie: CZYJE to jest. Rysunek modułu, jego nazwa i jego
    // włącznik należą do MODUŁU, a nie do pierwszej karty w środku — a przed zmianą stały w obu
    // miejscach, jedno pod drugim. Włącznik szczególnie: to on decyduje, czy cokolwiek pod spodem
    // w ogóle działa, więc jego miejsce jest w pasku, który jedzie z człowiekiem przez cały ekran,
    // a nie w nagłówku, który po zjechaniu w dół znika z oczu.
    //
    // Węzeł jest PRZENOSZONY (`appendChild`), nigdy odtwarzany: nasłuchy tych włączników są
    // podpinane po `id` przy starcie modułu i przepisanie ich na nowy element zerwałoby je po cichu.
    if (spec.enable) {
      const sw = I.panes.cfg.querySelector("#" + spec.enable);
      if (sw) {
        const hd = sw.parentElement;
        const pow = el("div", "rfpc-pow");
        pow.appendChild(sw);
        head.insertBefore(pow, tabs);
        // Rysunek ZAWSZE, nazwa tylko wtedy, gdy powtarzała tę z paska (patrz `headKeep` w rf-49j).
        const ic = hd.querySelector(".hd-ic");
        if (ic) ic.remove();
        if (!spec.headKeep) {
          const t = hd.querySelector("h2") || hd.querySelector("b");
          if (t) t.remove();
          // Podpis (`.hint`) spychał się na prawo `margin-left:auto`, bo po lewej stał tytuł.
          // Bez tytułu zostawał sam przy prawej krawędzi karty i wyglądał na zgubiony — teraz
          // zaczyna tam, gdzie zaczynał tytuł, czyli tam, gdzie oko go szuka.
          hd.classList.add("hd-noname");
        }
        // Nagłówek, w którym po tym nic nie zostało (MIDI i OSC nie mają nawet podpisu), znika
        // razem ze swoją kreską — pusty pas z samym ściegiem czyta się jak usterka rysowania.
        if (!hd.textContent.trim() && !hd.querySelector("button,input,select,canvas,.rf-toggle")) {
          hd.remove();
        }
      }
    }

    wrap.appendChild(head); wrap.appendChild(panes);
    panel.appendChild(wrap);

    I.crumb = crumb; I.list = list; I.foot = foot; I.prev = prev; I.stat = stat; I.q = inp;
    I.wrap = wrap; I.pane = null;
    $.setPane(I, "cfg");
    return I;
  };
})(window);
