"use strict";
// ============================================================================
//  KOŁO WYBORU — adapter wspólnego komponentu tożsamości (rf-49-cfgid.js)
//
//  SKĄD TO SIĘ WZIĘŁO. Koło jest jedynym modułem, który zbudował sobie WŁASNĄ obsługę nazwanych
//  konfiguracji, zanim powstał wspólny komponent: pas kafli kapsli (rf-46h), własny pasek akcji
//  (rf-46j `wheelCfgBarHtml`), własne okna z pytaniem (rf-46f `_whAsk` / `_whNameDlg`) i własną
//  bibliotekę presetów (rf-46e). Wszystko to działa i zostaje — ten plik NICZEGO z tego nie
//  zastępuje. Tłumaczy tylko tamten świat na kontrakt, którego oczekuje ramka trzech zakładek
//  (rf-49j/rf-49m), żeby moduł „Koło wyboru" miał Bibliotekę zbudowaną z tych samych klocków,
//  co pozostałe siedem.
//
//  DLACZEGO TŁUMACZENIE, A NIE PRZEPISANIE. Karta koła trzyma ŻYWĄ SCENĘ PODGLĄDU rysowaną
//  z wymiaru pojemnika i pięć trybów sterowania z własnymi walidacjami. Przeniesienie tego na
//  wspólny komponent to osobna zmiana z własnym sprawdzeniem na sprzęcie — a moduł ma dostać trzy
//  zakładki dzisiaj. Adapter kosztuje jeden plik i zero ryzyka dla sceny.
//
//  ⚠️ DWA MIEJSCA, KTÓRE ROBIĄ TO SAMO — I TO JEST ŚWIADOME. Pasek rf-46j i lista rf-49j pokazują
//  tę samą nazwę i te same działania. Nie kłócą się, bo OBA czytają jedno źródło (`whCfgOf` +
//  `whCfgState`) i oba odświeżają się z `whSync`. Pasek jest przy scenie, w zakładce Konfiguracja;
//  lista w Bibliotece. Pasek zlikwidowano po klik-through.
//
//  Po rf-46e (biblioteka presetów, `_whExportObj`, `_whPresetApply`), rf-46j (odcisk i stan) i rf-49.
// ============================================================================

// Średnica rysunku w panelu opisu Biblioteki. Mniejsza niż kafel kapsla (WH_CAPS_MINI_PX = 128),
// bo stoi OBOK zdania, a nie nad nim — ma być wizytówką, nie sceną.
const WH_LIB_ART_PX = 116;

const RF_WHADAPT_I18N = {
  "wycinków": "slices",
  "Koło od razu zacznie nosić tę nazwę.": "The wheel starts carrying that name right away.",
  "Koło nosi teraz: ": "The wheel now carries: ",
  "Zapisano koło: ": "Wheel saved: ",
  "Nadpisać koło „": "Overwrite the wheel “",
  "Nadpisz koło „": "Overwrite the wheel “",
  "Wczytać koło „": "Load the wheel “",
  "Zapisz jako nowe koło": "Save as a new wheel",
  // Przycisk bloku stanu w zakładce Konfiguracja (`words.createBtn`) — siatka bezpieczeństwa dla walkera.
  "Utwórz koło": "Create a wheel",
  "Zapisz koło": "Save the wheel",
  "tego koła nie ma już na liście": "this wheel is no longer on the list",
  "puste": "empty",
};
try { Object.assign(I18N_EN, RF_WHADAPT_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

// ILE WYCINKÓW — JEDNO ZDANIE W CAŁYM MODULE (`whCountLabel` w rf-46b, audyt UX #31, 2026-09-02).
// Do tej pory ta funkcja liczyła SUMĘ z podmenu („7 wycinków"), a pas kafli kapsli sam pierwszy
// pierścień („4 wycinki") — dwie prawdziwe liczby o tym samym kole, postawione obok siebie na
// jednym ekranie. Teraz obie strony proszą o ten sam napis: „4 wycinki (+3 w podmenu)".
function _whaDescribe(cfg) {
  const list = (cfg && cfg.slices) || [];
  if (!list.length) return _gl("puste", "empty");
  return (typeof whCountLabel === "function") ? whCountLabel(list) : (list.length + "");
}

// Konfiguracja kapsla po stronie panelu. Edytowany kapsel ma świeższą prawdę w karcie (`state.wheel`)
// niż w ostatnim pakiecie z serwera — o to pyta `whCfgOf` (rf-46j) i tu nie powtarzamy tej reguły.
function _whaCfg(dev) {
  try { return whCfgOf(dev) || null; } catch (e) { return null; }
}
function _whaDev() {
  return (typeof state !== "undefined" && (state.wheelDev || state.activeDeviceId)) || "d0";
}

const WHEEL_CFG_ADAPTER = {
  idPrefix: "wha",
  hubTitle: "Konfiguracje koła wyboru",
  // Zdania okien mówią o KOLE, nie o „konfiguracji": tak nazywa tę rzecz cała zakładka i tak
  // nazywa ją poradnik. Dwa słowa na jedną rzecz w jednym module uczą, że to dwie rzeczy.
  words: {
    onIt: ["na kapslu", "on this capsule"],
    onThis: ["na tym kapslu", "on this capsule"],
    thisOne: ["ten kapsel", "this capsule"],
    takes: ["Koło od razu zacznie nosić tę nazwę.", "The wheel starts carrying that name right away."],
    remembers: ["Koło zapamiętuje ", "The wheel remembers "],
    carries: ["Koło nosi teraz: ", "The wheel now carries: "],
    gone: ["tego koła nie ma już na liście", "this wheel is no longer on the list"],
    askOverwrite: ["Nadpisać koło „", "Overwrite the wheel “"],
    overwriteTip: ["Nadpisz koło „", "Overwrite the wheel “"],
    askLoadTitle: ["Wczytać koło „", "Load the wheel “"],
    saveAsTitle: ["Zapisz jako nowe koło", "Save as a new wheel"],
    saveAsBtn: ["Zapisz koło", "Save the wheel"],
    // Przycisk bloku stanu w Konfiguracji (rf-49j3 `paintCfgState`) — TEN SAM rzeczownik, co zdanie
    // tuż nad nim („zapisz je jako nowe koło") i co „Zapisz jako nowe koło". Domyślne „Utwórz preset"
    // z rf-49-cfgid stawiało pod tym zdaniem przycisk o INNEJ rzeczy — czyli dokładnie to, co ta
    // zmiana miała usunąć; presetów ta zakładka nie zna.
    createBtn: ["Utwórz koło", "Create a wheel"],
    // Ogon zdania bloku stanu („<kapsel> ma koło bez nazwy…") — ten sam rzeczownik, co przycisk
    // pod nim („Zapisz jako nowe koło"). Domyślnie byłby tam „preset", którego ta zakładka nie zna.
    noNameDev: ["To koło działa na {kto}, ale nie ma nazwy. Zapisz je jako nowe koło, żeby móc do niego wrócić.",
                "This wheel works on {kto} but has no name. Save it as a new wheel so you can come back to it."],
    saved: ["Zapisano koło: ", "Wheel saved: "],
  },

  // ⚠️ KOŁO EDYTUJE SIĘ NA WŁASNYM KAPSLU (`state.wheelDev`), a nie na tym, który jest aktywny
  // w prawej kolumnie. To jest zastana i celowa różnica wobec reszty modułów: pas kafli koła
  // (rf-46h) ma własny przełącznik „ustawiasz teraz". Adapter musi ją powtórzyć, inaczej lista
  // presetów mówiłaby o innym kapslu niż karta pod nią.
  getDev: _whaDev,
  devName: function (dev) {
    const D = ((typeof state !== "undefined" && state.devices) || {})[dev] || {};
    const m = D.meta || {};
    return m.label || m.name || dev;
  },
  listAllDevs: function () {
    return Object.keys((typeof state !== "undefined" && state.devices) || {}).sort();
  },
  listOtherDevs: function () {
    const cur = _whaDev();
    return WHEEL_CFG_ADAPTER.listAllDevs().filter(d => d !== cur);
  },

  getCfgName: function (dev) {
    const c = _whaCfg(dev === undefined || dev === null ? _whaDev() : dev);
    return String((c && c.configName) || "");
  },
  setCfgNameOn: function (dev, name, done) {
    const cur = _whaDev();
    if ((dev || cur) === cur) {
      try { whCfgSetName(name); } catch (e) { }
      if (done) done();
      return;
    }
    // Nazwa NA CUDZYM KAPSLU — tą samą drogą, co każde inne jego ustawienie koła. Wysyłamy SAMO
    // pole: POST /wheel scala, więc wycinki tamtego kapsla zostają nietknięte.
    fetch("/wheel?dev=" + encodeURIComponent(dev), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configName: String(name || "") })
    }).then(r => r.json()).then(m => {
      const D = (typeof state !== "undefined" && state.devices) ? state.devices[dev] : null;
      if (D && m && !m.error) D.wheelCfg = m;
      try { if (typeof wheelCapsRender === "function") wheelCapsRender(); } catch (e) { }
      if (done) done();
    }).catch(() => { if (done) done(); });
  },
  setCfgName: function (name, done) {
    return WHEEL_CFG_ADAPTER.setCfgNameOn(_whaDev(), name, done);
  },

  fingerprintCurrent: function () {
    try { return whCfgFingerprint(_whaCfg(_whaDev()) || {}); } catch (e) { return ""; }
  },
  // `null` = ustawienia tamtego kapsla jeszcze nie dojechały. Lista wtedy MILCZY, zamiast stawiać
  // kropkę „zmienione" policzoną z cudzych danych.
  fingerprintOf: function (dev) {
    const c = _whaCfg(dev);
    try { return c ? whCfgFingerprint(c) : null; } catch (e) { return null; }
  },
  fingerprintPreset: function (p) {
    try { return (p && p.config) ? whCfgFingerprint(p.config) : null; } catch (e) { return null; }
  },

  listPresets: function () { return (typeof state !== "undefined" && state.wheelPresets) || []; },
  findPreset: function (name) { try { return whCfgPreset(name); } catch (e) { return null; } },
  // KOŁO NIE MA POLA „OPIS" — ma KATEGORIĘ („Multimedia", „Okna"). To ona odpowiada w tej
  // bibliotece na pytanie „co to jest", więc ją pokazujemy zamiast pustego miejsca. Wymyślanie
  // drugiego pola tylko po to, żeby pasowało do wspólnego panelu, dołożyłoby modułowi rzecz,
  // której jego własny edytor nie zna.
  // …ale MILCZYMY, gdy kategoria powtarza nazwę. „Multimedia" pod nagłówkiem „Multimedia" wygląda
  // jak usterka, a nie jak porządek — ta sama zasada, co przy liście wyboru w pasku koła
  // (rf-46j `wheelCfgBarSync`).
  presetDesc: function (p) {
    const cat = String((p && p.category) || "").trim();
    const nm = String((p && p.name) || "").trim();
    return (cat && cat.toLowerCase() !== nm.toLowerCase()) ? cat : "";
  },
  presetMetric: function (p) { return _whaDescribe(p && p.config); },

  saveAs: function (name, done, desc) {
    try {
      const p = whCfgPreset(name);
      _whPresetPost("/wheelpresets",
        whPresetObj(name, String(desc || (p && p.category) || ""), _whExportObj()),
        (m) => {
          if (!m || !m.ok) return done((m && m.error)
            || _gl("Serwer odmówił zapisu.", "The server refused the save."));
          done(null);
        });
    } catch (e) { done(_gl("Nie udało się zapisać tego koła.", "Could not save this wheel.")); }
  },
  overwrite: function (name, done) { return WHEEL_CFG_ADAPTER.saveAs(name, done); },
  // ZMIANA NAZWY I KATEGORII — treść koła idzie NIETKNIĘTA, bo ma własny adres na serwerze.
  // Kapsle, które nosiły starą nazwę, przepina `whCfgFollowRename` (rf-46j); wołamy je tak samo,
  // jak robi to własny edytor presetów koła.
  savePresetMeta: function (p, name, desc, done) {
    const old = String((p && p.name) || "");
    _whPresetPost("/wheelpresets/rename",
      { name: old, newName: String(name || ""), category: String(desc || "") }, (m) => {
        if (!m || !m.ok) return done((m && m.error)
          || _gl("Serwer odmówił zapisu.", "The server refused the save."));
        try { if (typeof whCfgFollowRename === "function") whCfgFollowRename(old, String(name || "")); }
        catch (e) { }
        done(null);
      });
  },
  deletePreset: function (name, done) {
    _whPresetPost("/wheelpresets/delete", { name: name }, (m) => {
      done((m && m.ok === false) ? (m.error || _gl("Serwer odmówił.", "The server refused.")) : null);
    });
  },
  // Jedno pobranie i jedno źródło rysowania — `whPresetsFetch` w rf-46e odświeża stąd listę
  // Biblioteki. Do 2026-09-02 stała tu druga kopia tego pobrania, bo w karcie była jeszcze siatka
  // kafli z własnym `whPresetSync`; siatki nie ma, więc i drugiej kopii nie ma po co trzymać.
  reloadPresets: function () {
    try { if (typeof whPresetsFetch === "function") whPresetsFetch(); } catch (e) { }
  },

  applyPresetOn: function (dev, p, done) {
    const cur = _whaDev();
    if ((dev || cur) === cur) {
      try {
        _whPresetApply(JSON.parse(JSON.stringify((p && p.config) || {})), p && p.name);
        whCfgSetName((p && p.name) || "");
      } catch (e) {
        return done(_gl("Nie udało się wczytać tego koła.", "Could not load this wheel."));
      }
      return done(null);
    }
    // NA CUDZY KAPSEL — dokładnie to, co robi „Skopiuj na…" (rf-46j `whCfgCopyTo`): treść koła
    // plus nazwa, BEZ `showWhere`. Miejsce wyświetlania i przełącznik On zostają własnością
    // tamtego kapsla, bo to ustawienia jego stanowiska, a nie treść koła.
    const body = JSON.parse(JSON.stringify((p && p.config) || {}));
    delete body.showWhere;
    body.configName = String((p && p.name) || "");
    fetch("/wheel?dev=" + encodeURIComponent(dev), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(r => r.json()).then(m => {
      if (!m || m.error) return done((m && m.error)
        || _gl("Serwer odmówił zapisu.", "The server refused the save."));
      const D = (typeof state !== "undefined" && state.devices) ? state.devices[dev] : null;
      if (D) D.wheelCfg = m;
      try { if (typeof wheelCapsRender === "function") wheelCapsRender(); } catch (e) { }
      done(null);
    }).catch(() => done(_gl("Nie udało się porozmawiać z aplikacją.",
                            "Could not reach the application.")));
  },
  applyPreset: function (p, done) { return WHEEL_CFG_ADAPTER.applyPresetOn(_whaDev(), p, done); },

  // ------------------------------------------------------------------------------------------
  //  RYSUNEK POZYCJI W BIBLIOTECE (panel opisu, rf-49j3 `previewArt`)
  // ------------------------------------------------------------------------------------------
  // PO CO TO JEST. Biblioteka mówiła o kole SAMYMI SŁOWAMI: nazwa, kategoria i „4 wycinki
  // (+3 w podmenu)". To jest opis pliku, a nie odpowiedź na pytanie „które to koło" — a koło jest
  // jedynym modułem, którego konfiguracja MA KSZTAŁT i którego się tym kształtem rozpoznaje.
  // Trzeba było wczytać pozycję na kapsel, żeby zobaczyć, jak wygląda.
  //
  // TEN SAM RENDERER, CO WSZĘDZIE INDZIEJ (pakiet spoczynkowy z rf-46g + wheelSvgInto z rf-46),
  // dokładnie jak pas kafli kapsli — więc nie powstaje tu drugie rysowanie do utrzymania, a preset
  // wygląda w Bibliotece tak, jak wygląda w grze. Bez wskazania i bez odliczania: to jest portret
  // zapisanej rzeczy, a nie scena, na której coś się dzieje.
  //
  // `false` = nie ma czego rysować (mniej niż dwa wycinki, brak treści) — panel nie stawia wtedy
  // pustego kwadratu, tylko wygląda jak przedtem.
  previewInto: function (host, p) {
    if (!host || typeof wheelIdleState !== "function" || typeof wheelSvgInto !== "function") return false;
    const cfg = (p && p.config) || null;
    if (!cfg) return false;
    const st = wheelIdleState({ wheelCfg: cfg });
    if (!st) return false;
    const draw = () => {
      // Pojemnik bez wymiaru (zakładka schowana) nie jest małym pojemnikiem — patrz wheelSvgInto.
      // Obserwator niżej zawoła nas ponownie, gdy Biblioteka wróci na ekran.
      if (!host.clientWidth || !host.clientHeight) return;
      try { wheelSvgInto(host, st, null, { size: WH_LIB_ART_PX }); }
      catch (e) { if (!host._werr) { host._werr = 1; console.error("[biblioteka koła]", e); } }
    };
    // Panel składa się PRZED wstawieniem do dokumentu, więc pierwsza próba musi poczekać na koniec
    // bieżącego zadania. `setTimeout`, a nie `requestAnimationFrame`: klatki nie lecą, kiedy okno
    // jest schowane albo zminimalizowane, a rysunek ma tam wtedy po prostu być — inaczej wraca się
    // do Biblioteki i zastaje pusty kwadrat, który nikt już nie przerysuje.
    setTimeout(draw, 0);
    if (typeof whWatchBox === "function") whWatchBox(host, draw);
    return true;
  },

  describeCurrent: function () { return _whaDescribe(_whaCfg(_whaDev()) || {}); },
  describePreset: function (p) { return _whaDescribe(p && p.config); },
  describeKeeps: function () {
    return _gl("Przełącznik On i miejsce wyświetlania zostają przy kapslu: konfiguracja mówi, JAKIE "
               + "koło ma ten kapsel, a nie czy wolno mu wyskoczyć i w którym rogu ekranu.",
               "The On switch and where the wheel is shown stay with the capsule: a configuration "
               + "says WHAT wheel this capsule has, not whether it may pop up or in which corner.");
  },
  // Koło poniżej dwóch wycinków nie jest kołem — ta sama bramka, co w silniku (RadialMenu
  // MIN_SLICES) i przy przełączniku On. Powód pokazany WRAZ z wyłączonym przyciskiem: przycisk,
  // który po prostu nie działa, czyta się jak usterka. Stopka Biblioteki dopisuje go pod
  // przyciskiem sama (`rfpc-f-why` w rf-49j2). Jedno zdanie bez kropki: to jest też dymek
  // przycisku, a dymki jednozdaniowe kończą się bez niej (audyt UX 1.14).
  canSaveCurrent: function () {
    const n = ((_whaCfg(_whaDev()) || {}).slices || []).length;
    const min = (typeof WHEEL_MIN_SLICES !== "undefined") ? WHEEL_MIN_SLICES : 2;
    return (n >= min) ? { ok: true, why: "" }
      : { ok: false, why: _gl("Koło potrzebuje co najmniej dwóch wycinków",
                              "A wheel needs at least two slices") };
  },
};

// Jedno wejście na odświeżenie ramki modułu. Opakowuje je `initPresetCols` (rf-49j `spec.sync`),
// a woła `whSync` — czyli ta sama funkcja, która odświeża pas kafli kapsli. Dzięki temu dwa widoki
// tej samej nazwy nie mają jak pokazać dwóch różnych odpowiedzi.
//
// Przy okazji dowiesza (RAZ) przycisk „↺ Przywróć fabryczne" do nagłówka listy w Bibliotece —
// patrz whMountLibFactory niżej. Tutaj, bo to jedyna funkcja tego modułu, o której wiadomo, że
// leci PO zbudowaniu ramki: `initWheel` biegnie w bootstrapie przed `initPresetCols`, a ta
// dojeżdża z pierwszą odpowiedzią serwera na /wheel (wheelFetchState → whSync).
function wheelCfgColSync() {
  whMountLibFactory();      // opakowywane przez initPresetCols — patrz rf-49j
}

// ------------------------------------------------------------------------------------------
//  „↺ PRZYWRÓĆ FABRYCZNE" W NAGŁÓWKU LISTY BIBLIOTEKI
// ------------------------------------------------------------------------------------------
// Presety fabryczne wolno SKASOWAĆ (preset, którego nie da się usunąć, jest śmieciem w cudzej
// liście), więc musi istnieć droga powrotna — i tylko koło ją ma, bo tylko ono ma po stronie
// serwera `/wheelpresets/factory`. Do 2026-09-02 przycisk stał w sekcji „Presety" w Konfiguracji;
// razem z całą tą sekcją znikła (audyt UX #25/#26), a on jeden nie miał się dokąd przenieść:
// wspólny komponent listy nie zna pojęcia „dołóż brakujące fabryczne".
//
// STOI W NAGŁÓWKU LISTY, obok wyszukiwarki, a nie w stopce — z powodu czysto technicznego, ale
// twardego: stopkę (`.rfpc-f`) `paintFoot` czyści przy każdym przerysowaniu, a nagłówek (`.rfpc-h`)
// jest budowany raz, przy montażu ramki. Dowieszony do stopki znikałby przy pierwszej zmianie na
// liście. Napis mówi wprost, że tylko DOKŁADA — „Przywróć" bez dopowiedzenia było trzecim
// „Przywróć" na tym ekranie i jedynym, które niczego nie cofa.
function whMountLibFactory() {
  const head = document.querySelector("#rfpc-kolo .rfpc-libsplit .rfpc-h");
  if (!head || head.querySelector("#whLibFactory")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn sm wh-lib-factory";
  b.id = "whLibFactory";
  whLibFactoryRelang(b);
  b.onclick = () => { try { whRestoreFactory(); } catch (e) { } };
  head.appendChild(b);
}

// Napis składany przez _gl w chwili rysowania, więc tłumacz chodzący po DOM-ie go nie ruszy —
// przepisuje go whRelang (rf-46b). Ta sama zasada, co przy opcji „Pochylenie" wyzwalacza.
function whLibFactoryRelang(el) {
  const b = el || document.getElementById("whLibFactory");
  if (!b) return;
  b.textContent = _gl("↺ Przywróć fabryczne", "↺ Restore the factory ones");
  b.title = _gl("Dołóż z powrotem presety, które przyszły z aplikacją. Twoich nie rusza, niczego "
    + "nie nadpisuje i nie zmienia koła na kapslu — tylko uzupełnia brakujące pozycje na liście.",
    "Put back the presets that came with the app. It leaves yours alone, overwrites nothing and "
    + "does not touch the wheel on the capsule — it only fills the missing entries back in.");
}
