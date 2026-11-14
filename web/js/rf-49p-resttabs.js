"use strict";
// ==================================================================================================
//  POZYCJA „RESZTY" = DWIE ZAKŁADKI: <nazwa ekranu> · ℹ
//
//  SKĄD TO SIĘ WZIĘŁO (2026-08-31): tak jak moduły mają informacje o swoich działaniach
//  w osobnej zakładce, tak samo «Reszta», np. «Czujnik» i «i» na górze.
//
//  CO ZASTĘPUJE. Poradnik każdej z tych zakładek był `<details class="mapwiki">` przyklejonym na
//  samą górę panelu (rf-39b `initGuides`). Zwinięty wyglądał jak kolejna sekcja do przewinięcia
//  i nikt go nie otwierał; rozwinięty spychał całą zakładkę o dwa ekrany w dół. Moduły rozwiązały
//  to 08-31 paskiem trzech zakładek (rf-49m) — tu jest ten sam ruch, tylko że zakładki są dwie,
//  bo pozycje „Reszty" nie mają nazwanych konfiguracji, czyli nie mają czego trzymać w Bibliotece.
//
//  DLACZEGO PIERWSZA ZAKŁADKA NOSI NAZWĘ EKRANU, A NIE SŁOWO „KONFIGURACJA". W module para brzmi
//  „Konfiguracja · Biblioteka", więc słowo niesie treść. Tutaj druga zakładka to samo ℹ, więc para
//  „Konfiguracja · ℹ" mówiłaby dokładnie tyle, co „to · tamto". Napis z nawigacji („Czujnik",
//  „Połączenie") mówi, dokąd się wraca.
//
//  ZASADY (te same, co w rf-49m — i to nie przypadek, tylko jedno rozwiązanie w dwóch miejscach):
//
//  1. ZAWARTOŚĆ JEST PRZENOSZONA, NIGDY ODTWARZANA. `appendChild` zabiera karty razem z ich
//     nasłuchami i id-kami. Odtworzenie przez innerHTML daje objaw, który ten projekt już raz
//     zaliczył: zero błędów w konsoli, wszystko się rysuje, przyciski martwe
//     (.github/CONTRIBUTING.md, pułapka „montowanie to nie działanie”).
//
//  2. ZAKŁADKA UKRYTA TO `display:none`, więc nic w niej nie ma wymiaru. Płótna Czujnika przeżywają
//     to bez pomocy: `fit()` (rf-09) czyta `clientWidth` przy KAŻDYM rysowaniu, a pętla klatek leci
//     dalej — po powrocie na pierwszą zakładkę wykres wraca sam z następną klatką.
//
//  3. WYBRANA ZAKŁADKA ŻYJE W PAMIĘCI SESJI, NIE W localStorage. Nowe uruchomienie zawsze zaczyna
//     na treści ekranu: panel, który po starcie otwiera się na poradniku, wygląda, jakby o czymś
//     przypominał.
//
//  4. PORADNIK ROZBIERA `$.guideBox` Z rf-49m — jedna implementacja „poradnik → treść zakładki ℹ"
//     dla modułów i dla „Reszty". Wyjątek: bloki `.mapwiki`, których NIE zbudował `initGuides`
//     (dziś jeden — „Zestaw, preset, konfiguracja: co jest czym", rf-39k), jadą do ℹ jako całe
//     `<details>`. Mają własne przerysowanie przy zmianie języka, które trzyma się `<summary>`,
//     więc zdjęcie im skorupy zostawiłoby po angielsku polski nagłówek.
//
//  Ładowany PO rf-49m (korzysta z jego `_rfpc`), a wołany na SAMYM KOŃCU bootstrapu — po
//  `initLibrary` i `initExchangeHero`, które dokładają karty do „Zestawów" już po `initPresetCols`.
// ==================================================================================================

const RF_RESTTABS_I18N = {
  "Informacje": "About",
  "Wróć do treści tego ekranu": "Back to what this screen does",
  "Informacje o tym ekranie i jak z niego korzystać": "About this screen and how to use it",
  "Ten ekran nie ma jeszcze poradnika.": "This screen has no guide yet.",
  // Napisy zakładek dokładanych przez ekran (EXTRA_PANES niżej). Sam `label` w rejestrze nie
  // wystarczy: przycisk niesie POLSKI napis w węźle tekstowym, a przekłada go walker i18n —
  // tak samo, jak napisy przeniesione z nawigacji.
  "Ściąga": "Cheat sheet",
};
try { Object.assign(I18N_EN, RF_RESTTABS_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

(function (global) {

  // Pozycje nawigacji z grupy „Reszta". Kolejność bez znaczenia — po nazwie panelu, nie po miejscu
  // na liście. „Przegląd wszystkich kapsli" NIE jest tu wymieniony: nie stoi w nawigacji, nie ma
  // poradnika i wchodzi się w niego przyciskiem spod kapsli, więc pasek dwóch zakładek dokładałby
  // mu jedną martwą i jedną, która nie ma co pokazać.
  const REST_TABS = ["konfiguracje", "ustawienia", "wszystkie", "czujnik", "polaczenie"];

  // ZAKŁADKI PONAD PARĄ „ekran · ℹ" — dokładane przez ekran, który ma o czym powiedzieć więcej
  // niż jedną rzecz. Stoją MIĘDZY nimi, bo ℹ jest zawsze ostatnie: to nie jest treść ekranu,
  // tylko instrukcja do niej.
  //
  // „Nakładka" (2026-09-01): ekran przestał być spisem wszystkiego naraz
  // i stał się miejscem, w którym konfiguruje się JEDNO okno. Stąd dwie pozycje zamiast jednej:
  //   • „Nakładka" — całe ustawianie wybranego okna: czym jest, co w nim stoi, gdzie, jak duże
  //     i jak wygląda (dwie karty pod sobą, rf-41b),
  //   • „Ściąga"   — dawna zawartość ekranu: wszystkie kapsle obok siebie. Nie znika, bo jest
  //     tym, co rysuje samo okno nad grą, i bo otwiera się ją na drugim monitorze — schodzi
  //     tylko o jedno kliknięcie w bok, żeby przestała być tłem dla pracy.
  //
  // ⚠️ „Wygląd" BYŁ TU DO 2026-09-09 i został ZDJĘTY (było w nim tylko
  // jedno okienko, więc przeniesione pod «Ustawienia tego okna», będzie mniej
  // klikania). Nie ma czego wskrzeszać przy pierwszej nowej karcie wyglądu: zakładka zarabia na
  // siebie wtedy, gdy ma co ukryć, a jedna karta niczego nie ukrywa — kosztuje za to kliknięcie
  // przy każdym wejściu na ekran.
  const EXTRA_PANES = {
    wszystkie: [
      { k: "sheet", ic: "--ic-book", label: ["Ściąga", "Cheat sheet"],
        hint: ["Wszystkie kapsle obok siebie — to samo, co widać w oknie nad grą",
               "Every capsule side by side — the same thing the window over the game shows"] },
    ],
  };
  // NA KTÓRYCH ZAKŁADKACH WIDAĆ BLOK STAŁY (`data-rfpc-shared`), czyli galerię nakładek razem
  // z żywą miniaturą. Na „Ściądze" i w ℹ nie ma o czym: tam nie ustawia się żadnego okna.
  //
  // ⚠️ CHOWANY KLASĄ, NIGDY PRZEPINANY W DOM. Blok niesie `<iframe>`, a przeglądarka ładuje ramkę
  // OD NOWA przy każdej zmianie rodzica — przenoszony między zakładkami podgląd gasłby i wstawał
  // po każdym kliknięciu. Dlatego stoi w jednym miejscu drzewa, nad panelami zakładek.
  const SHARED_ON = { wszystkie: ["main"] };
  // EKRAN NA DWIE KOLUMNY: po lewej to, na co się PATRZY, po prawej to, co się USTAWIA.
  // Po lewej podgląd,
  // a po prawej parametry i kolejność. Blok stały deklaruje stronę znacznikiem
  // `data-rfpc-shared="left"|"right"`; lewa kolumna jest PRZYKLEJONA, bo prawa bywa dłuższa niż
  // ekran i podgląd nie ma prawa uciekać w górę razem z nią.
  const SPLIT = { wszystkie: true };

  // KTÓRY Z TYCH EKRANÓW NALEŻY DO WYBRANEGO KAPSLA — bo tylko taki dostaje jego pigułkę
  // w nagłówku. „Czujnik" stroi osie JEDNEGO kapsla, „Połączenie" pokazuje JEDNO łącze; „Zestawy",
  // „Konfiguracja" i „Nakładka" są poziomu aplikacji albo mówią o wszystkich kapslach naraz,
  // a pigułka nad nimi obiecywałaby, że to, co pod spodem, dotyczy tego jednego. Nie dotyczy.
  const PER_DEV = { czujnik: true, polaczenie: true };

  const $ = global._rfpc || {};
  const INST = Object.create(null);            // tab → { wrap, panes, tabBtn, pane }

  function el(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function _t(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }

  // Napis i rysunek biorą się z ŻYWEGO przycisku nawigacji, nie z własnej tablicy: po przełączeniu
  // na angielski walker przepisał już przycisk, a kopia w tablicy zostałaby po polsku. To ta sama
  // sztuczka, co `$.modLabel` w rf-49j i `paintOuts` w rf-34b.
  function navBtn(tab) { return document.querySelector('.tab-btn[data-tab="' + tab + '"]'); }
  function navLabel(tab) {
    const b = navBtn(tab);
    const s = b && b.querySelector("span:not(.rfic):not(.tab-dot):not(.tab-emoji)");
    return (s && s.textContent) || tab;
  }
  // Klasa rysunku (`tab-ic-sensor`, `tab-ic-vault`…) — pasek zakładek ma wyglądać na to samo
  // miejsce, co pozycja w nawigacji, z której się w niego weszło.
  function navIcon(tab) {
    const b = navBtn(tab);
    const i = b && b.querySelector(".rfic");
    if (!i) return "";
    for (const c of i.classList) if (c.indexOf("tab-ic-") === 0) return c;
    return "";
  }

  // ------------------------------------------------------------------------------------------
  //  PRZEŁĄCZANIE
  // ------------------------------------------------------------------------------------------
  function setPane(I, k, opt) {
    if (!I || !I.panes[k]) return;
    const first = I.pane !== k;
    I.pane = k;
    for (const p of I.order) {
      const on = p === k;
      I.panes[p].classList.toggle("active", on);
      I.panes[p].hidden = !on;
      const b = I.tabBtn[p];
      // `on` to klasa WYBRANEGO przycisku aplikacji (różowe wypełnienie, biały napis, biała nitka
      // ściegu z 14d-buttons). `active` zostaje osobno — po niej szuka inwentarz.
      b.classList.toggle("on", on);
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;                // roving tabindex — tabulator wchodzi w pasek raz
    }
    // Bloki stałe — widoczne tylko tam, gdzie mają o czym mówić (patrz SHARED_ON). Gdy znikają,
    // panel dostaje CAŁĄ szerokość: „Ściąga" i poradnik nie mają po co ściskać się do jednej
    // kolumny obok pustego miejsca.
    {
      const on = (SHARED_ON[I.tab] || []).indexOf(k) >= 0;
      for (const box of [I.sharedL, I.sharedR]) if (box) box.classList.toggle("rfpc-shared-off", !on);
      if (I.body) I.body.classList.toggle("rfpc-body-solo", !on);
    }
    if (opt && opt.focus) { try { I.tabBtn[k].focus(); } catch (e) { } }
    if (!first) return;
    try { if (global.rfStagger) global.rfStagger(I.panes[k]); } catch (e) { }
  }

  // ------------------------------------------------------------------------------------------
  //  BUDOWA
  // ------------------------------------------------------------------------------------------
  function build(tab) {
    const panel = document.getElementById("tab-" + tab);
    if (!panel || panel.querySelector(".rfpc")) return null;

    const I = { tab: tab, panel: panel, panes: Object.create(null), tabBtn: Object.create(null), pane: null };

    const wrap = el("div", "rfpc rfpc-rest"); wrap.id = "rfpc-" + tab;
    // Nagłówek bez okruszków — pierwsza zakładka nosi już nazwę ekranu, a druga linijka z tą samą
    // nazwą byłaby powtórzeniem — WYJĄTEK: ekrany jednego kapsla dostają po lewej jego pigułkę
    // (patrz `PER_DEV` wyżej). Bez okruszków pasek staje przy lewej krawędzi, tam gdzie zaczyna
    // się czytanie; z pigułką układ jest ten sam, co w module: kapsel z lewej, zakładki z prawej.
    // NAZWA EKRANU JEST TU RAZ — i niesie ją PIERWSZA ZAKŁADKA, dlatego pasek „Reszty" ma zakładki
    // przy lewej krawędzi, a nie przy prawej jak moduł. W module lewą stronę zajmuje tytuł
    // („🎹 MIDI"), bo jego zakładki nazywają się Konfiguracja/Biblioteka/ℹ i o samym module nie
    // mówią nic. Tutaj mówią wprost („Czujnik"), więc dopisanie takiego samego tytułu obok byłoby
    // tym samym słowem dwa razy w jednym pasku. Pigułka kapsla staje ZA zakładkami — na obu
    // paskach jest tuż po nazwie ekranu, czyli w tym samym miejscu czytania.
    const perDev = !!PER_DEV[tab];
    const head = el("div", "rfpc-head rfpc-head-rest");
    const tabs = el("div", "rfpc-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", navLabel(tab) + " · " + _t("Informacje", "About"));
    head.appendChild(tabs);
    if (perDev) { I.crumb = el("div", "rfpc-crumb"); head.appendChild(I.crumb); }

    const panes = el("div", "rfpc-panes");
    const SPEC = [
      { k: "main", iconly: false,
        hint: ["Wróć do treści tego ekranu", "Back to what this screen does"] },
    ].concat((EXTRA_PANES[tab] || []).map(x => ({
      k: x.k, iconly: false, ic: x.ic, label: x.label, hint: x.hint,
    })), [
      { k: "info", iconly: true,
        hint: ["Informacje o tym ekranie i jak z niego korzystać", "About this screen and how to use it"] },
    ]);
    I.order = SPEC.map(p => p.k);
    for (const p of SPEC) {
      const b = el("button", "btn sm rfpc-tab" + (p.iconly ? " is-ic" : ""));
      b.type = "button"; b.dataset.pane = p.k;
      b.setAttribute("role", "tab");
      b.id = "rfpcTab-" + tab + "-" + p.k;
      b.setAttribute("aria-controls", "rfpcPane-" + tab + "-" + p.k);
      const ic = el("span", "rfic rfpc-tab-ic is-" + p.k + (p.k === "main" ? (" " + navIcon(tab)) : ""));
      ic.setAttribute("aria-hidden", "true");
      // Zakładka dołożona przez ekran niesie WŁASNY rysunek — nie ma go w nawigacji, bo nie ma
      // tam swojej pozycji. Wpisywany wprost, bo klasy `is-look`/`is-sheet` w 22-modtabs.css
      // byłyby czwartym miejscem, w którym ta sama nazwa ikony musiałaby się zgadzać.
      if (p.ic) ic.style.backgroundImage = "var(" + p.ic + ")";
      b.appendChild(ic);
      // Napis w osobnym węźle — walker i18n dopasowuje CAŁE węzły tekstowe.
      // „Informacje” z napisem jak w modułach (UX 261120, D2); `iconly` zostaje klasą koloru.
      b.appendChild(el("span", null, p.iconly ? "Informacje" : (p.label ? p.label[0] : navLabel(tab))));
      // Zakładka bez napisu MUSI mieć nazwę dostępną, a `title` jest dla niej ostatnią deską
      // ratunku. Świadomie ta sama treść w obu — drugi napis to drugie miejsce do rozjechania się.
      b.title = (p.iconly ? _t("Informacje", "About")
                          : (p.label ? _t(p.label[0], p.label[1]) : navLabel(tab)))
                + " — " + _t(p.hint[0], p.hint[1]);
      b.setAttribute("aria-label", b.title);
      b.addEventListener("click", () => setPane(I, p.k));
      tabs.appendChild(b);
      I.tabBtn[p.k] = b;

      const pane = el("div", "rfpc-pane rfpc-pane-" + p.k);
      pane.id = "rfpcPane-" + tab + "-" + p.k;
      pane.setAttribute("role", "tabpanel");
      pane.setAttribute("aria-labelledby", b.id);
      pane.hidden = true;
      panes.appendChild(pane);
      I.panes[p.k] = pane;
    }
    // Strzałki chodzą po pasku, Home/End skaczą na skraje — umowa ARIA dla `tablist`.
    const ORDER = I.order;
    tabs.addEventListener("keydown", e => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        setPane(I, e.key === "Home" ? ORDER[0] : ORDER[ORDER.length - 1], { focus: true });
        return;
      }
      if (!step) return;
      e.preventDefault();
      const i = ORDER.indexOf(I.pane);
      setPane(I, ORDER[(i + step + ORDER.length) % ORDER.length], { focus: true });
    });

    // ===== ROZDANIE ZAWARTOŚCI =====
    // Wszystko jedzie na pierwszą zakładkę POZA trzema wyjątkami: blokami do czytania (do ℹ,
    // w kolejności, w jakiej stały w panelu), kartami, które SAME mówią, gdzie należą
    // (`data-rfpc-pane`), i blokiem stałym (`data-rfpc-shared`), który nie należy do żadnej
    // zakładki, bo widać go nad wszystkimi.
    const reading = [], sharedL = [], sharedR = [];
    while (panel.firstChild) {
      const n = panel.firstChild;
      if ($.isGuide && $.isGuide(n)) {
        panel.removeChild(n);
        // Poradnik z `initGuides` (id `guide-*`) rozbieramy ze skorupy `<details>`; każdy inny blok
        // `.mapwiki` jedzie w całości — patrz zasada 4 w nagłówku pliku.
        reading.push(String(n.id || "").indexOf("guide-") === 0 ? $.guideBox(n) : n);
        continue;
      }
      if (n.nodeType === 1 && n.dataset && n.dataset.rfpcShared) {
        panel.removeChild(n);
        (n.dataset.rfpcShared === "left" ? sharedL : sharedR).push(n);
        continue;
      }
      const want = (n.nodeType === 1 && n.dataset) ? n.dataset.rfpcPane : "";
      I.panes[(want && I.panes[want]) ? want : "main"].appendChild(n);
    }
    if (!reading.length) reading.push(el("div", "rfpc-info rfpc-info-none",
      _t("Ten ekran nie ma jeszcze poradnika.", "This screen has no guide yet.")));
    for (const r of reading) I.panes.info.appendChild(r);

    wrap.appendChild(head);
    // UKŁAD: pasek zakładek na całą szerokość, a pod nim albo jedna kolumna (jak dotąd), albo dwie —
    // lewa z blokiem „do patrzenia", prawa z blokiem „do ustawiania" i panelami zakładek.
    const split = !!SPLIT[tab] && (sharedL.length || sharedR.length);
    if (split) wrap.classList.add("rfpc-split");
    I.body = el("div", "rfpc-body");
    if (sharedL.length) {
      I.sharedL = el("div", "rfpc-shared rfpc-shared-l");
      for (const n of sharedL) I.sharedL.appendChild(n);
      I.body.appendChild(I.sharedL);
    }
    const right = split ? el("div", "rfpc-col-r") : I.body;
    if (sharedR.length) {
      I.sharedR = el("div", "rfpc-shared rfpc-shared-r");
      for (const n of sharedR) I.sharedR.appendChild(n);
      right.appendChild(I.sharedR);
    }
    right.appendChild(panes);
    if (split) I.body.appendChild(right);
    wrap.appendChild(I.body);
    // ⚠️ PRZYKLEJONA KOLUMNA MUSI WIEDZIEĆ, POD CZYM SIĘ ZATRZYMAĆ. Nad nią stoją DWA albo TRZY
    // przyklejone paski: górny pasek aplikacji (`--topbar-h`), przy oknie 901–1279 px jeszcze pas
    // kapsli (`--rf-strip-h`) i pasek zakładek tego ekranu — a ten ostatni zmienia wysokość, gdy
    // zawija się na wąskim oknie. Bez pomiaru podgląd wjeżdżał pod pasek zakładek i było go widać
    // w połowie (zmierzone: `top:8`, czyli pod nagłówek).
    // Od 14.09 mierzy to `rfWatchModHead` (rf-40) dla WSZYSTKICH pasków modułów naraz, a nie ten
    // ekran osobno: pas kapsli był tu wcześniej pominięty i przy oknie 1100 px blok stały parkował
    // 360 px za wysoko, czyli w całości pod pasem.
    if (split) global.rfWatchModHead && global.rfWatchModHead(head);
    panel.appendChild(wrap);
    INST[tab] = I;
    paintCrumb(I);
    setPane(I, "main");
    return I;
  }

  // Pigułka kapsla w nagłówku. Rysuje ją `$.devChip` z rf-49j — ta sama funkcja, co w okruszkach
  // modułu, więc kapsel wygląda tak samo niezależnie od tego, na którym ekranie się stoi.
  function paintCrumb(I) {
    if (!I.crumb) return;
    const dev = (typeof state !== "undefined" && state.activeDeviceId) || "";
    if (!$.devChip) return;
    // Przerysowanie tylko przy realnej zmianie: `renderDeviceSelector` leci przy każdym tiku ze
    // strumienia, a wymiana węzła pod kursorem gubi dymek i ognisko.
    let col = "";
    try { col = (typeof _cfhDevColor === "function") ? (_cfhDevColor({}, dev) || "") : ""; } catch (e) { }
    const sig = dev + "|" + (($.devName && $.devName(dev)) || "") + "|" + col;
    if (I.crumb._rfSig === sig) return;
    I.crumb._rfSig = sig;
    I.crumb.textContent = "";
    I.crumb.appendChild($.devChip(dev));
  }

  // ------------------------------------------------------------------------------------------
  //  MONTAŻ I WEJŚCIA Z ZEWNĄTRZ
  // ------------------------------------------------------------------------------------------
  function initRestTabs() {
    if (!$.isGuide || !$.guideBox) return;      // rf-49m nie doszedł — lepiej stary panel niż żaden
    // Ściąga `?view=overview` pokazuje JEDEN panel bez nawigacji (13-dialogs-overview.css). Pasek
    // zakładek nie ma tam z czego wziąć nazwy ani dokąd wracać, a druga zakładka byłaby ślepa.
    try { if (document.body.classList.contains("overview-only")) return; } catch (e) { }
    for (const t of REST_TABS) {
      try { build(t); } catch (e) { console.error("[rfrest] " + t, e); }
    }
    // Zmiana kapsla nie ma własnego zdarzenia, ale ma `renderDeviceSelector` — ten sam haczyk,
    // z którego korzystają lista wyjść (rf-34b), macierz modułów (rf-45) i kolumna presetów
    // (rf-49j). Własny nasłuch byłby drugim źródłem tej samej odpowiedzi.
    if (typeof global.renderDeviceSelector === "function") {
      const prev = global.renderDeviceSelector;
      global.renderDeviceSelector = function () {
        const r = prev.apply(this, arguments);
        for (const t in INST) { try { paintCrumb(INST[t]); } catch (e) { } }
        return r;
      };
    }
  }

  // POKAŻ TO, NA CO KTOŚ WŁAŚNIE WYSŁAŁ. Odnośniki w aplikacji („Rysunek: co jest czym", pigułki
  // z okna „Jak się dzielić") skaczą do KONKRETNEGO elementu w zakładce. Odkąd część tych
  // elementów mieszka w ℹ, samo `setTabById` przestało wystarczać: cel bywa w schowanej zakładce,
  // a przewijanie do czegoś bez wymiaru kończy się niczym i niczym nie miga. To jest jedna droga
  // dla wszystkich takich odnośników — wołana ZANIM ktoś sięgnie po `scrollIntoView`.
  function reveal(target) {
    const node = (typeof target === "string") ? document.getElementById(target) : target;
    if (!node || !node.closest) return false;
    const pane = node.closest(".rfpc-rest .rfpc-pane");
    if (!pane) return false;
    const wrap = pane.closest(".rfpc-rest");
    const I = wrap && INST[String(wrap.id || "").replace(/^rfpc-/, "")];
    if (!I) return false;
    setPane(I, String(pane.className).indexOf("rfpc-pane-info") >= 0 ? "info" : "main");
    return true;
  }

  // Napisy paska składane są z żywej nawigacji w chwili budowy, więc przy zmianie języka trzeba je
  // przepisać — jak miRelang / poseRelang / rfpcRelang. Sama treść zakładek tłumaczy się zwykłym
  // spacerem, bo to przeniesione węzły, nie nowe.
  function relang() {
    for (const t in INST) {
      const I = INST[t], lbl = navLabel(t);
      const bm = I.tabBtn.main, bi = I.tabBtn.info;
      const s = bm.querySelector("span:not(.rfic)");
      if (s) s.textContent = lbl;
      bm.title = lbl + " — " + _t("Wróć do treści tego ekranu", "Back to what this screen does");
      bm.setAttribute("aria-label", bm.title);
      bi.title = _t("Informacje", "About") + " — " +
        _t("Informacje o tym ekranie i jak z niego korzystać", "About this screen and how to use it");
      bi.setAttribute("aria-label", bi.title);
      const tl = I.tabBtn.main.parentNode;
      if (tl) tl.setAttribute("aria-label", lbl + " · " + _t("Informacje", "About"));
    }
  }

  global.initRestTabs = initRestTabs;
  global.rfRestTabsRelang = relang;
  global.rfRestTabs = { reveal: reveal, instances: INST, tabs: REST_TABS };
})(window);
