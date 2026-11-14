"use strict";
// ==================================================================================================
//  KOLUMNA PRESETÓW — jedna ramka dla każdego modułu: okruszki · lista presetów · konfiguracja
//
//  SKĄD TO SIĘ WZIĘŁO. Każdy moduł odpowiadał na pytanie „jaką nazwaną konfigurację nosi ten
//  kapsel" po swojemu: pasek w karcie (rf-49), kafle huba (rf-49i), pas kafli koła (rf-46j),
//  wiersz z listą przy osiach (rf-49h). Cztery rysunki jednej rzeczy znaczą, że przy każdym
//  wejściu w inny moduł trzeba się uczyć od nowa, gdzie stoi ta sama odpowiedź. Makieta z 29.08
//  („moduł → preset → konfiguracja") daje jedną: lista po lewej, konfiguracja po prawej.
//
//  CZTERY ZASADY, KTÓRE TRZYMAJĄ TO W CAŁOŚCI:
//
//  1. KARTA MODUŁU JEST PRZENOSZONA, NIGDY ODTWARZANA. `appendChild` zabiera ją razem z jej
//     nasłuchami, jej nagłówkiem (`.head` z przełącznikiem grupy) i jej id-kami. Odtworzenie przez
//     innerHTML daje objaw, który ten projekt już raz zaliczył: zero błędów w konsoli, wszystko się
//     rysuje, przyciski martwe (.github/CONTRIBUTING.md, pułapka „montowanie to nie działanie”).
//
//  2. NAGŁÓWEK MODUŁU JEST JEDEN — ten z karty. Drugi, zbudowany tutaj, rozjechałby się z nim
//     przy pierwszej zmianie i pokazywałby dwa różne stany przełącznika.
//
//  3. KLIK W PRESET, KTÓREGO TEN KAPSEL NIE NOSI, TO PODGLĄD, NIE EDYCJA. Silnik stroi ustawienia
//     ŻYWEGO kapsla, więc pola karty pokazywałyby wtedy cudze liczby, których nikt nie zmienia.
//     Zamiast tego prawa strona opisuje preset i daje jedno wyjście: wczytaj go tutaj.
//
//  4. LISTA PRZEJĘŁA HUB (rf-49i) — ETAP 3, 2026-08-29. Do tej pory hub zostawał pod nagłówkiem
//     karty, bo umiał trzy rzeczy, których lista nie miała: zmienić nazwę i opis, skasować preset
//     i zdjąć nazwę z cudzego kapsla. Teraz umie je lista (razem z „Zapisz zmiany", „Przywróć",
//     „Zapisz z powrotem…" i wczytaniem na wskazany kapsel), więc hub w tych modułach się CHOWA:
//     dwa rysunki jednej rzeczy w jednym panelu uczą, że któryś z nich kłamie. Pliki i funkcje
//     huba ZOSTAJĄ (mają harnessy), a same działania mieszkają w rf-49a-cfgacts.js — jedna
//     implementacja dla huba, tej listy i Biblioteki.
//
//  PODZIAŁ PLIKU (limit 500/800 linii, .github/CONTRIBUTING.md): tutaj stan, odczyty
//  i montaż; `rf-49j2-rows.js` rysuje listę; `rf-49j3-detail.js` prawą stronę i działania. Wszystkie
//  trzy piszą na wspólną prywatną przestrzeń `window._rfpc`.
//
//  Ładowany PO rf-49i (używa jego `_cfhDevImg` / `_cfhDevColor`), a montowany z bootstrapu PO
//  wszystkich `init*CfgHub` / `init*CfgBar` — inaczej przeniósłby kartę, zanim tamte zdążą wstawić
//  do niej swój pasek.
// ==================================================================================================

const RF_PRESETCOL_I18N = {
  "szukaj presetu…": "search presets…",
  "Lista presetów tego modułu": "This module's preset list",
  // „z aplikacji" — to samo słowo, którym mówią o wbudowanych README, kafle koła i poradniki.
  // „fabryczny" był trzecim słowem na tę samą rzecz.
  "z aplikacji": "from the app",
  "nie nosi go żaden kapsel": "no capsule carries it",
  "zmienione na tym kapslu": "changed on this capsule",
  "bez opisu": "no description",
  "+ Zapisz obecne jako…": "+ Save the current one as…",
  "Wymiana": "Exchange",
  "Podgląd z biblioteki.": "A preview from the library.",
  "Nosi go:": "Carried by:",
  "Nie nosi go żaden kapsel.": "No capsule carries it.",
  "Żeby edytować, wczytaj go na kapsel.": "To edit it, load it onto a capsule.",
  "Co ustawia": "What it sets",
  "aktywna": "in use",
  "na tym kapslu": "on this capsule",
  "Wczytaj na": "Load onto",
  "Wczytaj scenę": "Load the scene",
  "Nic nie pasuje do wpisanej frazy.": "Nothing matches what you typed.",
  "Ten moduł nie ma jeszcze zapisanej żadnej konfiguracji.":
    "This module has no saved configuration yet.",
  "Zapisz to, co masz teraz, jako nową pozycję na tej liście":
    "Save what you have right now as a new entry on this list",
  // — etap 3: działania przejęte z huba
  "Zmień nazwę": "Rename",
  "Zmień nazwę i opis tej konfiguracji": "Change this configuration's name and description",
  "Usuń": "Delete",
  "Usuń tę konfigurację z biblioteki": "Remove this configuration from the library",
  "Przywróć": "Revert",
  "Odrzuć zmiany i wróć do zapisanej wersji": "Discard the changes and go back to the saved version",
  "Zapisz z powrotem…": "Save it back…",
  "Zdejmij nazwę z tego kapsla (ustawienia zostają)":
    "Take the name off this capsule (the settings stay)",
  "Wczytaj na…": "Load onto…",
  "Wczytaj tę konfigurację na wybrany kapsel": "Load this configuration onto a capsule",
  "tej konfiguracji nie ma już na liście": "this configuration is no longer on the list",
  "Ustawienia są na kapslu; zapisz je z powrotem, żeby wróciła do biblioteki.":
    "The settings are on the capsule; save them back to put it in the library again.",
  // — 2026-08-31: panel opisu jest w Bibliotece widoczny ZAWSZE, więc musi umieć powiedzieć także
  //   to, czego dawny „podgląd cudzego presetu" nie mówił nigdy: że patrzysz na swoje.
  "Ta scena jest teraz włączona.": "This scene is in use right now.",
  "Nosi ją kapsel, który edytujesz.": "The capsule you are editing carries it.",
  "Na kapslu masz zmiany, których w bibliotece jeszcze nie ma.":
    "The capsule has changes the library does not have yet.",
  "Nic nie jest wskazane": "Nothing is picked",
  "Kliknij pozycję na liście, żeby zobaczyć, co ustawia i kto ją nosi. Ten kapsel nie nosi teraz żadnej nazwanej konfiguracji.":
    "Click an entry on the list to see what it sets and who carries it. This capsule carries no named configuration right now.",
  "Ta konfiguracja zniknęła z listy": "This configuration is gone from the list",
  "Ustawienia są na kapslu, ale pliku o tej nazwie już nie ma. Zapisz je z powrotem, żeby wróciła do biblioteki.":
    "The settings are on the capsule, but the file with that name is gone. Save them back to put it in the library again.",
  "Utwórz preset": "Create a preset",
  "Nadaj nazwę temu, co masz teraz, i dopisz to do biblioteki modułu":
    "Give what you have now a name and add it to the module's library",
};
try { Object.assign(I18N_EN, RF_PRESETCOL_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

(function (global) {

  const $ = global._rfpc = global._rfpc || {};

  $.t = function (pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; };
  $.el = function (tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  // Podpis człowieka (nazwa kapsla, nazwa presetu) nie jest etykietą interfejsu — walker i18n ma go
  // zostawić w spokoju, inaczej preset nazwany „Mysz" zmieniłby nazwę razem z zakładką.
  $.human = function (n) { n.setAttribute("data-noi18n", ""); return n; };
  const el = $.el, human = $.human, _t = $.t;

  // ------------------------------------------------------------------------------------------
  //  KTÓRE MODUŁY MAJĄ PRESETY
  // ------------------------------------------------------------------------------------------
  //  tab      zakładka, w której moduł stoi (panel `#tab-<tab>`)
  //  adapter  adaptery są prywatnymi `const` w plikach modułów — sięgamy po nie po nazwie, a nie
  //           przez rejestr, bo rejestru nie było; ten plik go właśnie zakłada (rf-49 RF_CFG_REG)
  //  addBtn   przycisk „zapisz obecne jako…", KTÓRY JUŻ ISTNIEJE w module. Stopka Biblioteki i blok
  //           stanu Konfiguracji klikają właśnie jego, zamiast powtarzać jego okno — hub pyta przy
  //           okazji o opis, pasek nie, i te dwie drogi mają zostać dokładnie takie, jakie są
  //  perDev   czy konfiguracja należy do KAPSLA. Scena syntezatora nie: nośnikiem jest sam
  //           syntezator, więc nie ma czego pokazywać na chipach ani dokąd „wczytywać na kapsel"
  //  onShow   co obudzić po wejściu w zakładkę „Konfiguracja". Schowana zakładka jest `display:none`,
  //           więc nic w niej nie ma wymiaru — rysunki liczone z rozmiaru pojemnika trzeba puścić
  //           jeszcze raz, dokładnie tak, jak robi to `setTab` w rf-34 dla koła i macierzy modułów
  //
  //  ⚠️ POLA `card` I `hub` ZNIKŁY 2026-08-31. `card` wskazywało JEDNĄ kartę konfiguracji, którą
  //  ramka chowała na czas podglądu cudzego presetu — podgląd stoi teraz w innej zakładce, więc nic
  //  się nie chowa. `hub` znaczyło „ten moduł nie ma cienkiego paska rf-49, więc blok stanu musi
  //  stanąć tutaj" — blok stanu stoi teraz w KAŻDYM module, a pasek i hub chowa arkusz.
  const MODS = [
    // `macroGuide` — id, pod którym poradnik pisania makr ma stanąć na SPODZIE zakładki ℹ tego
    // modułu (wstawia go `buildFrame` w rf-49m). Dostają go dwa moduły, w których makra się PISZE:
    // Mapowanie (pole sekwencji w edytorze reguły) i Koło wyboru (makro wycinka). Id celowo takie,
    // jakie było, gdy poradnik stał w karcie — pod nim szukają go przyciski „poradnik" przy tych
    // polach, a zmiana napisu w jednym miejscu nie ma prawa zerwać odnośnika w drugim.
    // `enable` — WŁĄCZNIK GRUPY tego modułu. Od 2026-08-31 nie stoi już w nagłówku karty, tylko
    //   w pasku modułu, po lewej od zakładek (rf-49m go tam przenosi, `.rfpc-pow` w 22-modtabs.css).
    // `headKeep` — nagłówek karty mówi coś WIĘCEJ niż nazwa modułu, więc zostaje. Tam, gdzie go nie
    //   ma, nagłówek powtarzał nazwę z paska i rf-49m go zdejmuje; rysunek zdejmuje ZAWSZE, bo ten
    //   sam wisi 56 px wyżej („żeby ikona nie pokazywała się 2 razy").
    { tab: "mapowanie", key: "trig", macroGuide: "edSeqGuide",
      enable: "trigEnable", headKeep: true,
      adapter: () => (typeof TRIG_CFG_ADAPTER !== "undefined") ? TRIG_CFG_ADAPTER : null,
      sync: "trigCfgSync", addBtn: "trigCfgHubAdd", exchange: "profDiscord" },
    // KOŁO WYBORU — własna, starsza implementacja nazwanych konfiguracji (pas kafli rf-46h + pasek
    // rf-46j) przetłumaczona na kontrakt komponentu przez rf-46k. Pasek ZOSTAJE przy scenie
    // w Konfiguracji: to jedyny moduł, w którym zmiana nazwy odbywa się patrząc na rysunek koła.
    { tab: "kolo", key: "wheel", macroGuide: "whMacroGuide", enable: "wheelEnable",
      adapter: () => (typeof WHEEL_CFG_ADAPTER !== "undefined") ? WHEEL_CFG_ADAPTER : null,
      sync: "wheelCfgColSync",
      // Wejście w zakładkę daje karcie wymiar; scena i kafle kapsli rysują się z rozmiaru
      // pojemnika, więc muszą dostać sygnał — dokładnie tak, jak robi to `setTab` w rf-34.
      onShow: function () {
        try { if (typeof wheelCapsDraw === "function") wheelCapsDraw(true); } catch (e) { }
        try { if (typeof whStageWake === "function") whStageWake(); } catch (e) { }
      } },
    { tab: "mysz", key: "mouse", enable: "mEnable",
      adapter: () => (typeof MOUSE_CFG_ADAPTER !== "undefined") ? MOUSE_CFG_ADAPTER : null,
      sync: "mouseCfgSync", addBtn: "mouseCfgHubAdd" },
    // KONTROLER DZIELI BIBLIOTEKĘ Z MYSZĄ — i to nie jest oszczędność, tylko jedyna prawda, jaką
    // da się tu powiedzieć. Obie zakładki stoją nad JEDNYM configem kapsla (`state.mouse`): tryb
    // ruchu, źródła, czułości, drążek i krzyżak to pola tego samego obiektu, a kapsel ma jeden tryb
    // ruchu naraz. Osobna „biblioteka Kontrolera" znaczyłaby dwie nazwy nad jednym stanem — czyli
    // dwie odpowiedzi na pytanie „czy to jeszcze jest to, co zapisałem", z których jedna zawsze
    // kłamie. Ten sam wzorzec, co MIDI i OSC: dwie zakładki, jedna biblioteka, obie się odświeżają.
    // W wierszu listy widać TRYB („kursor" / „drążek" / „krzyżak"), więc preset przestawiający kapsel
    // na mysz mówi to wprost, zanim ktoś go wczyta.
    // ⛔ CZEGO TU NIE MA: reguł `pad:` (przyciski pada). Te są wyzwalaczami i mieszkają w presecie
    //    Mapowania — dopisanie ich tutaj zrobiłoby jedną regułę w dwóch nazwanych zestawach naraz.
    // SKANER EKRANU — nazwane konfiguracje od 2026-09-11 (zgloszenie: „nie da sie konfiguracji
    // zapisac, powinna byc biblioteka"). Wlasny magazyn (`Library/ScanPresets`), bo skaner nie
    // dzieli konfiguracji z zadnym innym modulem: to dwadziescia pokretel opisujacych JEDNA osobe.
    { tab: "skaner", key: "scan", enable: "scanEnable",
      adapter: () => (typeof SCAN_CFG_ADAPTER !== "undefined") ? SCAN_CFG_ADAPTER : null,
      sync: "scanCfgColSync",
      // Zestawy z aplikacji („Ostrozny", „Cwiartki"…) sa pozycjami TEJ listy od 11.09, a zasiew
      // jest jednorazowy — skasowany zestaw potrzebuje wiec drogi powrotnej. Stopka wola te
      // funkcje po nazwie i dokleja to, co odda.
      footBtn: "scanFootRestoreBtn",
      // Wejscie w zakladke daje ramce podgladu wymiar, a z niego bierze sie cala geometria
      // skanowania — bez tego pierwszy pasek jechalby po prostokacie 0x0.
      onShow: function () { try { if (typeof scanOnShow === "function") scanOnShow(); } catch (e) { } } },
    { tab: "kontroler", key: "mouse", enable: "kEnable",
      adapter: () => (typeof MOUSE_CFG_ADAPTER !== "undefined") ? MOUSE_CFG_ADAPTER : null,
      sync: "mouseCfgSync" },
    // MIDI i OSC to DWIE zakładki nad JEDNYM stanem (rf-49d montuje dwa huby z jednego adaptera).
    // Dwie listy nad jedną biblioteką są tu poprawne: obie pokazują to samo i obie się odświeżają.
    { tab: "midi", key: "midi", enable: "miEnable",
      adapter: () => (typeof MIDI_CFG_ADAPTER !== "undefined") ? MIDI_CFG_ADAPTER : null,
      sync: "midiCfgSync", addBtn: "midiCfgHubAdd" },
    { tab: "osc", key: "midi", enable: "oscEnable",
      adapter: () => (typeof MIDI_CFG_ADAPTER !== "undefined") ? MIDI_CFG_ADAPTER : null,
      sync: "midiCfgSync", addBtn: "oscCfgHubAdd" },
    // USŁUGI SIECIOWE — presety dorobione 2026-08-31 (rf-49n + `Library/RestPresets` po stronie
    // serwera). Nośnikiem jest APLIKACJA, nie kapsel: wyzwalacz sam mówi, którego kapsla słucha.
    // Bez `addBtn`, bo ten moduł nie ma ani paska rf-49, ani huba rf-49i — okno „zapisz jako"
    // otwiera wprost `rfCfgIdSaveAsNew` (patrz `$.addBtn` w rf-49j3).
    { tab: "restapi", key: "rest", perDev: false, enable: "raEnable", headKeep: true,
      adapter: () => (typeof REST_CFG_ADAPTER !== "undefined") ? REST_CFG_ADAPTER : null,
      sync: "restCfgSync" },
    { tab: "pad", key: "synth", perDev: false, enable: "padEnable", headKeep: true,
      adapter: () => (typeof SYNTH_SCENE_ADAPTER !== "undefined") ? SYNTH_SCENE_ADAPTER : null,
      sync: "synthScenesSync", addBtn: "synthCfgSaveAs" },
    // OSI 3D NIE MA NA TEJ LIŚCIE. Przez jeden dzień była (etap 2, własna zakładka `osie`), ale
    // wydzielenie cofnięto: osie wróciły do Czujnika jako zwijana sekcja z WŁASNYM
    // wierszem „Presety osi" w środku (`.pose-presets` w rf-34-tabs). Dwie listy tych samych
    // presetów w jednej karcie to dwa miejsca do kliknięcia i jedno do rozjechania się.
    // Przy okazji znikł martwy odnośnik: wpis wskazywał `addBtn:"poseCfgSaveAs"`, a przycisku
    // o takim id nie ma w całym repo — stopka listy nie miała czego klikać.
  ];

  const INST = Object.create(null);            // tab → instancja
  $.MODS = MODS; $.INST = INST;

  // ------------------------------------------------------------------------------------------
  //  ODCZYTY
  // ------------------------------------------------------------------------------------------
  // ⚠️ `state` to `const` w rf-02, czyli globalna deklaracja LEKSYKALNA — na `window` jej NIE MA.
  // `window.state && …` jest tu więc zawsze fałszem i cicho gasi całą funkcję (nazwa kapsla pusta,
  // wstrzymanie niezauważone). Pytamy przez `typeof`, tak jak reszta plików w tym projekcie.
  $.curDev = function () { return (typeof state !== "undefined" && state.activeDeviceId) || ""; };
  $.devName = function (d) {
    const D = (typeof state !== "undefined" && state.devices) ? state.devices[d] : null;
    return (typeof dmName === "function" && D) ? dmName(D) : String(d || "");
  };
  // Etykieta modułu czytana z ŻYWEGO przycisku nawigacji, nie z tablicy: po przełączeniu na
  // angielski walker przepisał już przycisk, a kopia z tablicy zostałaby po polsku.
  $.modLabel = function (tab) {
    const b = document.querySelector('.tab-btn[data-tab="' + tab + '"]');
    const s = b && b.querySelector("span:not(.rfic):not(.tab-dot):not(.tab-emoji)");
    return (s && s.textContent) || tab;
  };
  // Rysunek modułu — TA SAMA klasa, co na jego pozycji w nawigacji (`tab-ic-*`, nadana z pola `png`
  // w rejestrze TABS). Czytana z żywego przycisku, nie z własnej tablicy: druga lista przypisań
  // „moduł → obrazek" rozjechałaby się przy pierwszym dołożonym module.
  $.modIcon = function (tab) {
    const b = document.querySelector('.tab-btn[data-tab="' + tab + '"]');
    const i = b && b.querySelector(".rfic");
    if (!i) return "";
    for (const c of i.classList) if (c.indexOf("tab-ic-") === 0) return c;
    return "";
  };
  // Tytuł ekranu do nagłówka: rysunek + nazwa. Linijka jest nieco wyższa,
  // z nazwą aktywnego modułu i ikoną po lewej stronie. Odkąd pasek jest przyklejony do góry, jest
  // to jedyna linijka widoczna przez cały czas — a do tej pory nazwa modułu była w niej zwykłym
  // słowem w środku okruszków, nie do odróżnienia od nazwy kapsla obok.
  $.modTitle = function (tab) {
    const box = el("span", "rfpc-mod");
    const ic = $.modIcon(tab);
    if (ic) {
      const n = el("span", "rfic rfpc-mod-ic " + ic);
      n.setAttribute("aria-hidden", "true");
      box.appendChild(n);
    }
    // TYTUŁ EKRANU TO NAGŁÓWEK, NIE POGRUBIENIE (5.13). Panel nie miał ani jednego h1: nazwa
    // modułu w okruszkach była <b>, więc czytnik nie umiał powiedzieć, na czym się stoi, ani
    // przeskoczyć do treści po nagłówkach. Tekst i klucze i18n bez zmian; wygląd też — arkusz
    // 22-modtabs.css stylizuje `.rfpc-mod b` i `.rfpc-mod h1` tak samo (h1 dostaje `margin:0`).
    // WHY: the module name in the breadcrumbs is the page title — mark it up as one.
    box.appendChild(el("h1", null, $.modLabel(tab)));
    return box;
  };
  // KAPSEL W OKRUSZKACH JAKO PIGUŁKA, NIE JAKO SŁOWO (aktywny kapsel jako ikonka
  // z nazwą i kolorem kapsla). Do tej pory stało tam samo imię, pisane tą
  // samą czcionką co nazwa modułu obok — a odkąd pasek jest przyklejony do góry ekranu, jest to
  // JEDYNA rzecz na ekranie, która przez cały czas mówi, czyje ustawienia się właśnie kręci.
  // Rysunek i kolor są DOKŁADNIE te, którymi kapsel podpisuje się wszędzie indziej: `capImgSpan`
  // (ta sama grafika kapsla, co na pigułce w prawej kolumnie, z kolorową kropką jako zapasem)
  // i `--dcol` (ten sam wzór `color-mix`, którym świeci wybrana pigułka — 07-felt-core.css).
  // Sięgamy po nie przez `_cfh*` z rf-49i, bo tamte pozwalają adapterowi podmienić jedno i drugie;
  // pusty obiekt zamiast adaptera jest tam bezpieczny (`typeof {}.devColor !== "function"`).
  $.devChip = function (dev, A) {
    const chip = el("span", "rfpc-dev");
    let col = "", img = "";
    try { col = _cfhDevColor(A || {}, dev) || ""; } catch (e) { }
    try { img = _cfhDevImg(A || {}, dev, 20) || ""; } catch (e) { }
    if (col) chip.style.setProperty("--dcol", col);
    if (img) {
      // Treść z NASZEGO szablonu (rf-03): adres z mapy `CAP_IMG`, kolor przepuszczony przez regexp
      // na `#rrggbb`. Bierzemy sam węzeł, bo pojemnik na nim byłby drugim opakowaniem bez zadania.
      const holder = document.createElement("span");
      holder.innerHTML = img;
      if (holder.firstElementChild) chip.appendChild(holder.firstElementChild);
    }
    chip.appendChild(human(el("b", null, $.devName(dev))));
    return chip;
  };

  $.presetsOf = function (I) {
    const A = I.spec.adapter();
    if (!A || typeof A.listPresets !== "function") return [];
    try { return A.listPresets() || []; } catch (e) { return []; }
  };
  $.descOf = function (I, p) {
    const A = I.spec.adapter();
    if (A && typeof A.presetDesc === "function") { try { return String(A.presetDesc(p) || ""); } catch (e) { } }
    return String((p && p.desc) || "");
  };
  $.stateOf = function (I, dev) {
    const A = I.spec.adapter();
    if (!A) return { name: "", known: false, dirty: false };
    try { return rfCfgIdState(A, dev); } catch (e) { return { name: "", known: false, dirty: false }; }
  };
  // Kto nosi konfigurację o tej nazwie, razem z kropką „zmienione" OSOBNO dla każdego kapsla.
  // Adapter bez `fingerprintOf` (osie 3D) nie umie porównać cudzego kapsla — wtedy MILCZYMY
  // zamiast pokazywać kropkę policzoną z bieżącego, bo byłaby to odpowiedź o kimś innym.
  $.carriersOf = function (I, name) {
    const A = I.spec.adapter();
    if (!A || I.spec.perDev === false) return [];
    let list = [];
    try { list = rfCfgIdCarriers(A, name) || []; } catch (e) { return []; }
    const cur = (typeof A.getDev === "function") ? A.getDev() : "";
    const perDev = typeof A.fingerprintOf === "function";
    return list.map(d => ({
      dev: d,
      dirty: (d === cur) ? !!$.stateOf(I).dirty : (perDev ? !!$.stateOf(I, d).dirty : false)
    }));
  };
  // Pozostałe kapsle — cel dla „Wczytaj na…" w wierszu presetu. Bez `applyPresetOn` (osie 3D,
  // syntezator) wczytanie na CUDZY kapsel nie istnieje i lista się nie pokazuje: przycisk, który
  // nie ma jak zadziałać, uczy, że przyciski nic nie robią.
  $.otherDevs = function (I) {
    const A = I.spec.adapter();
    if (!A || I.spec.perDev === false || typeof A.applyPresetOn !== "function") return [];
    try { return (A.listOtherDevs() || []); } catch (e) { return []; }
  };

  // Odświeżenie po działaniu: lista modułu wraca z serwera, a wszystkie kolumny się przerysowują.
  $.after = function (I) {
    return function (selName) {
      const A = I.spec.adapter();
      if (A && typeof A.reloadPresets === "function") { try { A.reloadPresets(selName || ""); } catch (e) { } }
      I.sel = null;
      if (I.spec.sync) $.bump(I.spec.sync);
      $.paintAll();
    };
  };

  // ------------------------------------------------------------------------------------------
  //  BUDOWA RAMKI
  // ------------------------------------------------------------------------------------------
  function build(spec) {
    const panel = document.getElementById("tab-" + spec.tab);
    if (!panel || panel.querySelector(".rfpc")) return null;
    if (!spec.adapter()) return null;                       // moduł nie doszedł — nie budujemy pustej ramki

    // CAŁY SZKIELET (nagłówek, pasek trzech zakładek, panele, lista, opis, blok stanu) buduje
    // rf-49m-modtabs.js i rozdaje jego części na `I`. Tutaj zostaje stan modułu i nasłuchy.
    // ⚠️ `spec.card` NIE JEST JUŻ POTRZEBNY do budowy. Do 2026-08-30 ramka musiała znać JEDNĄ kartę
    // konfiguracji, bo chowała ją na czas podglądu cudzego presetu (podgląd i konfiguracja stały
    // w tym samym miejscu). Od trzech zakładek stoją w dwóch różnych, więc nic się nie chowa —
    // a dzięki temu do ramki wchodzą też moduły, które jednej karty nie mają (Usługi sieciowe
    // budują całą zakładkę z kilku kart naraz).
    const I = { spec: spec, panel: panel, sel: null };
    INST[spec.tab] = I;
    $.buildFrame(I);
    try { rfCfgIdRegister(spec.tab, spec.key, spec.adapter()); } catch (e) { }

    const list = I.list, inp = I.q;
    inp.addEventListener("input", () => $.paintList(I));
    // Strzałki chodzą po liście i OD RAZU pokazują szczegóły: lista i szczegóły stoją obok siebie,
    // więc nie ma czego potwierdzać Enterem.
    list.addEventListener("keydown", e => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const rows = [].slice.call(list.querySelectorAll(".rfpc-row[data-p]"));
      const i = rows.indexOf(document.activeElement);
      if (i < 0) return;
      const n = rows[i + (e.key === "ArrowDown" ? 1 : -1)];
      if (!n) return;
      e.preventDefault();
      $.pick(I, n.dataset.p);
    });
    return I;
  }

  // ------------------------------------------------------------------------------------------
  //  RYSUNEK
  // ------------------------------------------------------------------------------------------
  // KOLEJNOŚĆ ODWRÓCONA 2026-08-31: najpierw MODUŁ, potem kapsel. Do tej pory było „kapsel › moduł
  // › konfiguracja", czyli od ogółu do szczegółu — poprawnie jako ścieżka, ale odkąd pasek stoi na
  // górze ekranu przez cały czas, jest on TYTUŁEM tego, na co się patrzy, a tytuł zaczyna się od
  // nazwy miejsca. Kapsel jest przy nim dopowiedzeniem „czyje to ustawienia" i dlatego stoi obok
  // jako pigułka w jego kolorze, a nie jako kolejne słowo tą samą czcionką.
  function paintCrumb(I) {
    const box = I.crumb; box.textContent = "";
    box.appendChild($.modTitle(I.spec.tab));
    if (I.spec.perDev !== false) box.appendChild($.devChip($.curDev(), I.spec.adapter()));
    // UX 261120 B3 (P-G3-13): a module that is ONE for the whole app says so with a pill where the
    // capsule's pill would stand. The words come from the adapter (`sharedChip: [pl, en]`).
    else {
      const A = I.spec.adapter();
      if (A && Array.isArray(A.sharedChip)) {
        const c = el("span", "rfpc-dev rfpc-shared");
        c.appendChild(el("b", null, _t(A.sharedChip[0], A.sharedChip[1])));
        box.appendChild(c);
      }
    }
    // BEZ NAZWY KONFIGURACJI NA KOŃCU OKRUSZKÓW. Pasek modułu jest przyklejony do góry ekranu
    // i musi zmieścić się w jednej linii razem z przełącznikiem On/Off i trzema zakładkami.
    // Nazwa dopisana tutaj rozciągała okruszki z 287 do 540 px, więc przy 1280 px pasek zakładek
    // schodził do DRUGIEGO wiersza — i to tylko na module, którego kapsel coś nosi. Ta sama nazwa
    // stoi w pierwszym zdaniu zakładki „Konfiguracja" (`rfpc-state`: „Triki 1 nosi …"), a tamto
    // zdanie mówi przy okazji, czy jest zapisana.
  }

  // Trzy rysunki, bo od 2026-08-31 moduł ma trzy zakładki i dwie z nich mają co pokazywać naraz:
  // opis w Bibliotece i blok stanu w Konfiguracji. Rysujemy OBIE niezależnie od tego, która jest na
  // wierzchu — są tanie (kilkanaście węzłów), a rysowanie dopiero przy przełączeniu znaczyłoby, że
  // zakładka schowana w chwili zmiany danych wraca ze starą odpowiedzią.
  // `dirtyMark` (rf-49q) dokłada czwarty rysunek TEGO SAMEGO stanu, tylko poza modułem: kropkę przy
  // pozycji w nawigacji i przy zakładce „Konfiguracja". Jedzie stąd, a nie z własnego nasłuchu, bo
  // tu jest jedyne miejsce, które wie, że stan modułu właśnie się przeliczył.
  $.paint = function (I) {
    paintCrumb(I); $.paintList(I); $.paintDetail(I); $.paintCfgState(I);
    if ($.dirtyMark) $.dirtyMark(I);
  };

  $.pick = function (I, name) {
    const st = $.stateOf(I);
    I.sel = (rfCfgIdKey(name) === rfCfgIdKey(st.name)) ? null : name;
    $.paint(I);
    const sel = I.list.querySelector(".rfpc-row.sel");
    if (sel) { try { sel.focus({ preventScroll: true }); sel.scrollIntoView({ block: "nearest" }); } catch (e) { } }
  };

  $.paintAll = function () { for (const t in INST) { try { $.paint(INST[t]); } catch (e) { } } };
  $.bump = function (name) { try { if (typeof global[name] === "function") global[name](); } catch (e) { } };
  // Każdy `sync` raz, nie raz na zakładkę: MIDI i OSC dzielą jeden (`midiCfgSync`).
  // Wywołanie wraca tu przez opakowanie z `initPresetCols` i samo przerysowuje listy — rekurencji
  // nie ma, bo `paintAll` nie woła już żadnego `sync`.
  function bumpSyncs() {
    const seen = Object.create(null);
    for (const spec of MODS) {
      if (!spec.sync || seen[spec.sync]) continue;
      seen[spec.sync] = true;
      $.bump(spec.sync);
    }
  }

  // ------------------------------------------------------------------------------------------
  //  MONTAŻ
  // ------------------------------------------------------------------------------------------
  function initPresetCols() {
    for (const spec of MODS) { try { build(spec); } catch (e) { console.error("[rfpc] " + spec.tab, e); } }

    // (Stał tu ZASTĘPCZY wpis dla koła: sam `getCfgName`, bez listy, żeby „Co wychodzi z tego
    // kapsla" umiało podać nazwę. Od 2026-08-31 koło jest pełnoprawną pozycją MODS z adapterem
    // rf-46k, więc rejestruje je `build()` — a ten wpis, wykonywany PO nim, nadpisywałby pełnego
    // adaptera zaślepką i gasił całą Bibliotekę modułu.)

    // Odświeżanie: moduły mają już po jednej funkcji, którą wołają PO KAŻDEJ zmianie swoich
    // danych. Dopinamy się do niej zamiast zakładać własny nasłuch — dwa niezależne odświeżenia
    // rozjechałyby się pierwszego dnia (lista mówi jedno, pasek nad nią drugie).
    const seen = Object.create(null);
    for (const spec of MODS) {
      if (!spec.sync || seen[spec.sync]) continue;
      seen[spec.sync] = true;
      const prev = global[spec.sync];
      if (typeof prev !== "function") continue;
      global[spec.sync] = function () {
        const r = prev.apply(this, arguments);
        try { $.paintAll(); } catch (e) { }
        return r;
      };
    }
    // Zmiana kapsla nie ma własnego zdarzenia, ale ma renderDeviceSelector — ten sam haczyk,
    // z którego korzystają macierz „Moduły" (rf-45) i lista wyjść (rf-34b).
    //
    // ⚠️ ZNALEZIONE PRZY OKAZJI (2026-08-29): huby i paski modułów nie miały ŻADNEGO haczyka na
    // zmianę kapsla. Po przełączeniu zostawały z odpowiedzią o poprzednim — hub myszy potrafił
    // stać w nieskończoność z wyszarzonym „Zapisz obecne jako…" i powodem „Ustawienia tego kapsla
    // jeszcze się wczytują. Spróbuj za chwilę.", choć ustawienia dawno dojechały. Jedno wywołanie
    // ich `sync` to naprawia. Robimy to TYLKO przy realnej zmianie kapsla, bo renderDeviceSelector
    // leci też przy każdym drobiazgu ze strumienia, a `sync` sięga wtedy po cudze ustawienia.
    let lastDev = $.curDev();
    if (typeof global.renderDeviceSelector === "function") {
      const prev = global.renderDeviceSelector;
      global.renderDeviceSelector = function () {
        const r = prev.apply(this, arguments);
        try {
          const now = $.curDev();
          if (now !== lastDev) {
            lastDev = now;
            for (const t in INST) INST[t].sel = null;
            bumpSyncs();
            // Ustawienia nowego kapsla dojeżdżają z serwera chwilę po przełączeniu, a bramka
            // gotowości pyta o nie w chwili rysowania — stąd drugie podejście.
            setTimeout(bumpSyncs, 900);
          }
          $.paintAll();
        } catch (e) { }
        return r;
      };
    }
    // `/` wchodzi do wyszukiwarki OTWARTEGO modułu. Pojedyncza litera, więc pole tekstowe ma
    // pierwszeństwo — inaczej nie dałoby się wpisać ukośnika w żadną nazwę.
    // Od trzech zakładek skrót najpierw OTWIERA Bibliotekę: wyszukiwarka stoi w niej, a szukanie
    // presetu jest właśnie tym, po co się tam wchodzi. Bez tego skrót działałby tylko wtedy, gdy
    // się już tam jest, czyli dokładnie wtedy, gdy jest najmniej potrzebny.
    global.addEventListener("keydown", e => {
      if (e.key !== "/" || e.ctrlKey || e.altKey || e.metaKey) return;
      const a = document.activeElement;
      if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
      const panel = document.querySelector(".tab-panel.active");
      const I = panel && INST[String(panel.id || "").replace(/^tab-/, "")];
      if (!I) return;
      e.preventDefault();
      $.setPane(I, "lib");
      try { I.q.focus(); I.q.select(); } catch (err) { }
    });
    $.paintAll();
  }

  // OTWÓRZ W MODULE — jedno wejście dla Biblioteki globalnej. Sam skok do zakładki nie wystarcza:
  // człowiek kliknął KONKRETNY preset i musi go tam zobaczyć zaznaczonego, inaczej ląduje w liście
  // czterdziestu pozycji i szuka tej, na którą przed chwilą patrzył. Od trzech zakładek trzeba mu
  // jeszcze otworzyć tę WŁAŚCIWĄ: przychodzi z przeglądania, więc ląduje w Bibliotece modułu,
  // a nie na jego pokrętłach.
  function openIn(tab, name) {
    const I = INST[String(tab)];
    try { if (typeof global.setTabById === "function") global.setTabById(String(tab)); } catch (e) { }
    if (!I) return false;
    $.setPane(I, "lib");
    if (name) $.pick(I, String(name)); else $.paint(I);
    try {
      const row = I.list.querySelector(".rfpc-row.sel") || I.list.querySelector(".rfpc-row.act");
      if (row) { row.scrollIntoView({ block: "nearest" }); row.focus({ preventScroll: true }); }
    } catch (e) { }
    return true;
  }

  global.initPresetCols = initPresetCols;
  // Napisy tej kolumny składane są przez `_gl()` w chwili rysowania, więc walker i18n nie ma czego
  // podmienić przy przełączeniu języka — jak w miRelang / poseRelang / rfLibRelang, przerysowujemy.
  global.rfpcRelang = function () { try { $.paintAll(); } catch (e) { } };
  global.rfPresetCols = { paintAll: $.paintAll, instances: INST, mods: MODS, open: openIn };
})(window);
