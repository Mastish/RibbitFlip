"use strict";
// ============================================================================
//  MIDI/OSC: kapsel nosi NAZWANY ZESTAW MAPOWAŃ
//
//  Adapter HUBA KONFIGURACJI (rf-49i-cfghub.js) dla listy mapowań na wyjście muzyczne. Mapowania
//  były trzecim modułem bez presetów: jedna lista na kapsel, do 64 pozycji, i żadnego sposobu, żeby
//  trzymać „TouchOSC scena A" obok „Serwa ramienia" — ani żeby odpowiedzieć na pytanie „czy to
//  jeszcze jest ten zestaw, który wczoraj grał". Przy liście, której nikt nie przejrzy wzrokiem,
//  boli to tak samo jak przy czterdziestu wyzwalaczach.
//
//  DWA HUBY, JEDEN STAN — i to jest tu decyzja, nie niedopatrzenie. MIDI i OSC mają OSOBNE
//  przełączniki i osobne zakładki, ale JEDEN config na kapsel i JEDNĄ listę mapowań, rozróżnianą
//  polem `dest`. Zestaw mieszany (kilka CC plus kilka adresów OSC) to najzwyklejszy przypadek,
//  więc preset musi być jeden. Postawienie sekcji tylko w karcie MIDI ukrywałoby ją przed połową
//  ludzi, którzy tego modułu używają — ci od TouchOSC czy Resolume nie zaglądają do zakładki MIDI
//  w ogóle. Stąd DWIE instancje huba (różne `idPrefix`) nad tym samym stanem: co zrobisz w jednej,
//  natychmiast widać w drugiej, bo obie czytają `state.midi` i obie odświeża `midiCfgSync()`.
//
//  ⚠️ CIENKIE PASKI (rf-49) ZNIKNĘŁY Z OBU ZAKŁADEK 2026-08-28 — mechanika została w całości,
//  zmienił się kształt. Pasek był prosty, nieczytelny i ukryty, nie był wyborem
//  z biblioteki, a użytkownik nie wiedział, czy konfiguruje aktywny preset z autozapisem,
//  czy wymagający zapisu. Ten plik został warstwą logiki (odcisk, zapisy, wczytania);
//  metody z sufiksem `On`/`Of` pytają o WSKAZANY kapsel, bo hub rysuje chipy wszystkich.
//
//  GRANICA PRESETU stoi na wierzchu jako MIDI_CFG_SKIP — po stronie serwera to samo mieszka
//  w MIDI_PRESET_SKIP i obie strony muszą mówić to samo, bo inaczej odcisk liczyłby pole, którego
//  preset nie niesie, i kapsel byłby „zmieniony" od chwili wczytania (patrz dwie zasady w nagłówku
//  rf-49; pilnuje tego test identyczności w tests/test_midi_config.py).
//
//  Po rf-16 (state.midi, onMidiCfg, miFetchState) i po rf-34 (karta OSC powstaje dopiero w initTabs),
//  bo z nich czyta i w nie się wpina; po rf-49 (rfCfgIdState) i rf-49i (fabryka huba).
// ============================================================================

// Tytuł sekcji jedzie do DOM-u jako zwykły tekst, więc tłumaczy go chodzik i18n — para MUSI być
// w I18N_EN. TEN SAM tytuł w obu zakładkach, i to celowo: preset jest jeden na oba wyjścia, więc
// „Konfiguracje MIDI" w jednej karcie i „Konfiguracje OSC" w drugiej obiecywałyby dwie biblioteki
// tam, gdzie jest jedna.
try {
  Object.assign(I18N_EN, {
    "Konfiguracje MIDI i OSC": "MIDI and OSC configurations",
  });
} catch (e) { /* i18n jeszcze nie ma */ }

// ------------------------------------------------------------------------------------------
//  CZEGO PRESET NIE NIESIE
// ------------------------------------------------------------------------------------------
// Lustro MIDI_PRESET_SKIP z serwera. Każda pozycja z powodem, bo za pół roku „czemu kanał MIDI
// nie wchodzi do presetu" będzie pytaniem bez odpowiedzi:
const MIDI_CFG_SKIP = [
  // Uzbrojenie obu wyjść. Konfiguracja nie niesie przełączników — o tym, czy wolno wysyłać,
  // decyduje człowiek przy przełączniku, nie plik (patrz apply_setup i test_setup_switches.py).
  "enabled", "oscEnabled",
  // STANOWISKO kapsla w zestawie wielokapslowym. Domyślne wartości są nadawane PER SLOT właśnie
  // po to, żeby jeden odbiornik na jednym porcie odróżnił dwa kapsle (kanał dla MIDI,
  // /ribbitflip/devN dla OSC). Dwa kapsle z tym samym presetem MUSZĄ dalej różnić się kanałem
  // i prefiksem — inaczej grałyby po sobie w to samo miejsce.
  "midiChannel", "oscPrefix",
  // Nazwa stoi na WIERZCHU (pasek + nazwa pliku), nie w treści, którą opisuje.
  "configName"
];

// Pola JEDNEGO MAPOWANIA, które składają się na „ten sam zestaw". Lista jest DOKŁADNIE tą, którą
// zapisuje `_sanitize_map` po stronie serwera — czyli tą, którą preset niesie. Wypisana z ręki
// (nie wyliczona z pierwszego mapowania), bo mapowanie bez ustawionego pola i mapowanie z polem
// równym domyślnej wartości MUSZĄ dać ten sam odcisk, a `Object.keys` pierwszego z nich dałby
// listę krótszą. Zgodność z serwerem pilnuje test — patrz tests/midi_config_harness.mjs.
//
// ⚠️ `id` NIE WCHODZI DO ODCISKU. To tożsamość wewnętrzna mapowania, nie jego treść — a przede
// wszystkim: serwer NADAJE id mapowaniu, które go nie ma (`_sanitize_map`, „m<zegar>"). Preset
// z cudzego pliku bez id-ków dostawałby więc inne id przy każdym odczycie (a `midi_preset_items`
// sanityzuje przy KAŻDYM pobraniu listy) i taki kapsel twierdziłby „zmienione" na wieki, choć
// nikt niczego nie ruszył. Dokładnie ta sama pułapka, co przy wyzwalaczach — patrz rf-49b.
//
// ⚠️ Per-mapowanie `enabled` WCHODZI: wyłączone mapowanie to konfiguracja („to ma teraz nie
// grać"), w odróżnieniu od przełączników CAŁYCH grup MIDI/OSC, które są decyzją o tym kapslu
// w tej chwili i leżą wyżej, w MIDI_CFG_SKIP.
//
// ⚠️ `oscGroup` i `oscGroupIdx` też WCHODZĄ, choć ta wersja ich nie czyta. Silnik je round-tripuje,
// więc preset je niesie — a pole, które preset niesie, a odcisk pomija, to dokładnie ten rodzaj
// różnicy, która po cichu znika przy „Zapisz zmiany".
//
// ⚠️ `oscTarget` (do KTÓREGO urządzenia OSC mapowanie mówi) też WCHODZI, choć identyfikator „t3"
// jest lokalny dla maszyny. Rozdzielenie lampy od tabletu to treść zestawu, a nie stanowisko kapsla
// — inaczej niż prefiks adresu, który zostaje przy kapslu (MIDI_CFG_SKIP). Preset z urządzeniem,
// którego tu nie ma, gra na cel domyślny (silnik podmienia to przy kompilacji) i NIE jest przez to
// „zmieniony": odcisk porównuje zapisane pole z zapisanym polem, a nie z tym, co poszło na drut.
const MIDI_CFG_MAP_FIELDS = [
  "name", "srcKind", "ch", "metric", "dest", "mode", "inLo", "inHi",
  "curve", "curveFlip", "invert", "rateMs", "midiCh", "slew", "centered", "deadzone",
  "cmp", "threshold", "absVal", "noteLatch",
  "cc", "outLo", "outHi", "prog",
  "loNote", "hiNote", "note", "velocity", "velSource",
  "addr", "oscTarget", "oscProfile", "oscRangeCustom", "oscType", "outLoF", "outHiF", "oscEdge",
  "pulseMs",
  "enabled",
  "medN", "smoothMode", "slewMs", "smoothPos", "oeMinCutoff", "oeBeta",
  "dzMode", "dzRef", "dzWidth", "absCont", "hystIn", "outOfRange",
  "curveN", "curveBez",
  "outLo14", "outHi14", "antiDz", "hardLo", "hardHi",
  "quantStep", "quantHyst", "maxRate",
  "sendDelta", "keepaliveMs", "safeOnDisarm", "oscGroup", "oscGroupIdx"
];

// Jedna wartość jako tekst. Liczby przez toFixed, bo suwak progu potrafi oddać 5000
// i 5000.000000000001, a to jest ten sam próg — bez tego kapsel bywałby „zmieniony" po samym
// dotknięciu suwaka i powrocie na miejsce. Pole liczbowe z formularza bywa przy tym TEKSTEM
// („30"), a to samo pole z serwera przychodzi liczbą (30.0), więc obie strony muszą przejść tą
// samą drogą. `null` (hardLo, hardHi, safeOnDisarm = „bez bariery") daje pusto, czyli coś innego
// niż 0 — i o to chodzi, bo to są dwie różne konfiguracje.
function _midiCfgV(v) {
  if (v === true) return "1";
  if (v === false) return "0";
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return v.toFixed(3);
  const s = String(v);
  return (s !== "" && s.trim() !== "" && !isNaN(+s)) ? (+s).toFixed(3) : s;
}
// `curveBez` jest LISTĄ czterech liczb (punkty kontrolne krzywej) — jedyne pole mapowania, które
// nie jest wartością prostą. Bez tej gałęzi obie strony dałyby „[object Object]" i zmiana kształtu
// krzywej byłaby niewidoczna dla paska.
function _midiCfgOne(v) {
  return Array.isArray(v) ? v.map(_midiCfgV).join(",") : _midiCfgV(v);
}
function _midiCfgMap(m) {
  const o = m || {};
  return MIDI_CFG_MAP_FIELDS.map(function (k) { return _midiCfgOne(o[k]); }).join("|");
}
// Odcisk CAŁEGO zestawu: mapowania (w kolejności — przestawienie listy to zmiana, bo kolejność
// widać w panelu) plus skala, która jest wspólnym ustawieniem wszystkich mapowań nutowych.
// I NIC WIĘCEJ: kanał, prefiks i przełączniki zostają przy kapslu, więc nie mają prawa tu wejść.
function midiCfgFingerprint(cfg) {
  const o = cfg || {};
  return JSON.stringify([
    (Array.isArray(o.mappings) ? o.mappings : []).map(_midiCfgMap),
    _midiCfgV(o.scale), _midiCfgV(o.scaleRoot)
  ]);
}

// ------------------------------------------------------------------------------------------
//  POMOCNIKI ADAPTERA
// ------------------------------------------------------------------------------------------
function _midiCfgDev() { return state.activeDeviceId || "d0"; }
function _midiCfgD(dev) { return state.devices[dev || _midiCfgDev()] || {}; }
function _midiCfgDevName(dev) {
  const m = _midiCfgD(dev).meta || {};
  return m.label || m.name || dev;
}
// CZYJĄ konfigurację trzyma teraz state.midi. Ta sama bramka, którą postMidi chroni zapis:
// panel ma JEDEN obiekt na wszystkie kapsle, a ten obiekt niesie CAŁĄ listę mapowań — zapis pod
// nazwą nowego kapsla, zanim jego config dojedzie, wymieniłby mu wszystkie mapowania na cudze.
function _midiCfgReady() {
  return !!state.midiDev && state.midiDev === _midiCfgDev();
}
function _midiCfgNotReady() {
  return _gl("Ustawienia tego kapsla jeszcze się wczytują. Spróbuj za chwilę.",
             "This capsule's settings are still loading. Try again in a moment.");
}
// Konfiguracja BEZ tego, co zostaje przy kapslu. Tyle jedzie w kopii na inny kapsel; serwer i tak
// odcina te klucze przy zapisie presetu, ale kopia idzie zwykłym POST /midi, który niczego nie
// odcina — i dobrze, bo to jest ta sama droga, którą zapisuje panel.
function _midiCfgBehaviour() {
  const src = state.midi || {};
  return {mappings: Array.isArray(src.mappings) ? src.mappings : [],
          scale: src.scale || "chromatic", scaleRoot: src.scaleRoot || 0};
}
// Ile mapowań — po polsku, czyli z odmianą. „5 mapowanie" w oknie, które pyta o zgodę na
// zastąpienie czyjejś pracy, czyta się jak usterka i odbiera oknu powagę.
function _midiCfgCount(n) {
  n = +n || 0;
  if (typeof _lang !== "undefined" && _lang === "en") return n + (n === 1 ? " mapping" : " mappings");
  if (n === 1) return "1 mapowanie";
  const d = n % 10, h = n % 100;
  return n + ((d >= 2 && d <= 4 && !(h >= 12 && h <= 14)) ? " mapowania" : " mapowań");
}
// Co ta konfiguracja ROBI, w jednym kawałku zdania („…zostanie zastąpione (12 mapowań: 4 MIDI,
// 8 OSC)"). Podział na wyjścia jest tu ważniejszy niż sama liczba: zestaw z samym OSC działa bez
// loopMIDI, a zestaw z samym MIDI bez odbiornika UDP — więc to on mówi, czego ten plik będzie
// od maszyny potrzebował.
function _midiCfgWhat(cfg) {
  const ms = (cfg && Array.isArray(cfg.mappings)) ? cfg.mappings : [];
  if (!ms.length) return _gl("brak mapowań", "no mappings");
  const osc = ms.filter(function (m) { return m && m.dest === "osc"; }).length;
  const midi = ms.length - osc;
  const parts = [];
  if (midi) parts.push(midi + " MIDI");
  if (osc) parts.push(osc + " OSC");
  return _midiCfgCount(ms.length) + (parts.length > 1 ? " (" + parts.join(", ") + ")" : "");
}
// WHICH TAB IS ASKING. One configuration serves both outputs, but "1 mapowanie · 1 MIDI" read on
// the OSC screen promises an OSC mapping that is not in it — the leading number is the one the eye
// takes, and on that screen it is about the wrong protocol. Only one module tab is on screen at a
// time (rf-34 puts `active` on its panel), so the metric leads with the output being looked at.
function _midiCfgOnOsc() {
  const p = document.getElementById("tab-osc");
  return !!(p && p.classList.contains("active"));
}
// THE TILE'S METRIC — „3 mapowania MIDI · 2 OSC" on the MIDI tab, „2 mapowania OSC · 3 MIDI" on
// the OSC one. The split is named WHENEVER there is something to split, unlike in the window
// sentence: a tile stands next to other tiles, and it is exactly that split which tells a set for
// a DAW from a set for TouchOSC before anybody reads the description.
function _midiCfgMetric(cfg) {
  const ms = (cfg && Array.isArray(cfg.mappings)) ? cfg.mappings : [];
  if (!ms.length) return _gl("brak mapowań", "no mappings");
  const osc = ms.filter(function (m) { return m && m.dest === "osc"; }).length;
  const midi = ms.length - osc;
  const here = _midiCfgOnOsc() ? ["OSC", osc, "MIDI", midi] : ["MIDI", midi, "OSC", osc];
  const parts = [_midiCfgCount(here[1]) + " " + here[0]];
  if (here[3]) parts.push(here[3] + " " + here[2]);
  return parts.join(" · ");
}
function _midiCfgPost(url, body, done) {
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
               body: JSON.stringify(body) })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || j.ok === false || j.error) {
        return done((j && j.error) || _gl("Serwer odmówił zapisu.", "The server refused the save."), null);
      }
      done(null, j);
    })
    .catch(function () { done(_gl("Nie udało się porozmawiać z aplikacją.", "Could not reach the application."), null); });
}

// LISTA PRESETÓW — jeden pobór dla obu hubów i dla Biblioteki. Treść i OPIS, nie same nazwy:
// „zmienione" to porównanie dwóch stron (patrz `fingerprintPreset`), a kafel pokazuje obok nazwy
// zdanie autora. Starszy serwer odsyła same nazwy — wtedy hub nie ma czego porównać i milczy.
function loadMidiPresets(done) {
  return fetch("/midi-presets").then(function (r) { return r.json(); })
    .then(function (j) {
      state.midiPresets = (j && Array.isArray(j.items)) ? j.items
        : (((j && j.presets) || []).map(function (n) { return { name: n, config: null, desc: "" }; }));
      // Ile znaków może mieć opis — z serwera, żeby pole tekstowe nie trzymało własnej kopii limitu.
      if (j && j.descMax != null) state.midiDescMax = +j.descMax || 0;
      midiCfgSync();
      if (typeof done === "function") done();
    })
    .catch(function () { if (typeof done === "function") done(); });
}

// KONFIGURACJA KAPSLA, KTÓREGO NIKT NIE EDYTUJE. W panelu mieszka tylko ta AKTYWNA (state.midi),
// a hub rysuje chip KAŻDEGO kapsla — z kropką „zmienione" liczoną z jego własnego zestawu. Wolny,
// throttlowany GET dokładnie w kształcie `ovMotionCfg` (rf-12), którym ściąga czyta cudze ustawienia
// myszy: to jest KONFIGURACJA — zmienia się, gdy ktoś ją zmieni, nie pięćdziesiąt razy na sekundę.
// Do odpowiedzi hub nic o tamtym kapslu nie twierdzi (pusta nazwa = „nie wiem", nie „nie nosi
// nazwy"; `null` z odcisku = „nie da się porównać", a nie „zmienione").
const _midiCfgAsk = {};
function _midiCfgOther(dev) {
  const D = _midiCfgD(dev);
  const t = (typeof performance !== "undefined" ? performance.now() : Date.now());
  if (!(_midiCfgAsk[dev] > t - 3000)) {
    _midiCfgAsk[dev] = t;
    fetch("/midi?dev=" + encodeURIComponent(dev)).then(function (r) { return r.json(); })
      .then(function (m) {
        if (!m || m.error || !m.slot) return;
        D.midiCfg = m.slot;
        // Odpowiedź przyszła PO narysowaniu kafli — bez tego chip tego kapsla stałby w tacce
        // („nie wiem" czyta się jak „bez nazwy") aż do następnej zmiany czegokolwiek innego.
        midiCfgSync();
      })
      .catch(function () {});
  }
  return D.midiCfg || null;
}
// Zestaw WSKAZANEGO kapsla, albo `null`, gdy jeszcze nie wiadomo. Bieżący ma go w state.midi —
// ale TYLKO wtedy, gdy state.midi naprawdę jest jego (ta sama bramka, którą postMidi chroni zapis):
// zaraz po przełączeniu kapsla panel trzyma jeszcze zestaw poprzedniego, a odcisk z niego policzony
// zapaliłby kropkę „zmienione" na kapslu, którego nikt nie tknął.
function _midiCfgOf(dev) {
  if (!dev || dev === _midiCfgDev()) return _midiCfgReady() ? (state.midi || null) : null;
  return _midiCfgOther(dev);
}

// ------------------------------------------------------------------------------------------
//  ADAPTER — jeden opis zachowania, dwie instancje huba (patrz initMidiCfgHub)
// ------------------------------------------------------------------------------------------
const MIDI_CFG_ADAPTER = {
  idPrefix: "midi",
  hubTitle: "Konfiguracje MIDI i OSC",
  // ONE RECORD, TWO SCREENS — and every window that asks about it has to say so. MIDI and OSC
  // share a single named configuration (see the file header), so a change made on the MIDI tab
  // lights the "changed" dot on OSC as well. That is correct behaviour and confusing wording:
  // "Overwrite “Stream”?" on the OSC screen reads like a promise about OSC alone. Naming the kind
  // in the titles is the cheapest way to make the sharing visible exactly where it matters.
  words: {
    gone: ["tej konfiguracji MIDI i OSC nie ma już na liście",
           "this MIDI and OSC configuration is no longer on the list"],
    askOverwrite: ["Nadpisać wspólną konfigurację MIDI i OSC „",
                   "Overwrite the shared MIDI and OSC configuration “"],
    overwriteTip: ["Nadpisz wspólną konfigurację MIDI i OSC „",
                   "Overwrite the shared MIDI and OSC configuration “"],
    askLoadTitle: ["Wczytać wspólną konfigurację MIDI i OSC „",
                   "Load the shared MIDI and OSC configuration “"],
    saveAsTitle: ["Zapisz jako nową konfigurację MIDI i OSC (wspólną)",
                  "Save as a new MIDI and OSC configuration (shared)"],
    saveAsBtn: ["Zapisz konfigurację MIDI i OSC", "Save the MIDI and OSC configuration"],
    saved: ["Zapisano konfigurację MIDI i OSC: ", "MIDI and OSC configuration saved: "],
    // WHAT KIND OF RECORD the first line of the „Konfiguracja" tab names: „Triki 1 nosi
    // WSPÓLNĄ KONFIGURACJĘ MIDI I OSC „Stream” ze zmianami…". Every other module leaves this
    // phrase out (an absent `kindOf` means „do not name the kind” and the sentence reads exactly
    // as it did before). MIDI/OSC names it because that line is the only place above the mapping
    // list which says WHY the „changed” dot lights on both tabs at once: there is one record.
    kindOf: ["wspólną konfigurację MIDI i OSC", "the shared MIDI and OSC configuration"],
  },
  getDev: _midiCfgDev,
  devName: _midiCfgDevName,
  // Kolejność stała (po id gniazda), bo to ona decyduje, gdzie na kaflu stoi chip — a kafel, na
  // którym chipy skaczą przy każdym odświeżeniu, jest kaflem nie do przeciągnięcia.
  listAllDevs: function () { return Object.keys(state.devices || {}).sort(); },
  listOtherDevs: function () {
    const cur = _midiCfgDev();
    return MIDI_CFG_ADAPTER.listAllDevs().filter(function (d) { return d !== cur; });
  },
  // Nazwa jest polem configu, więc dla EDYTOWANEGO kapsla przychodzi tą samą drogą co reszta
  // (GET /midi przy przełączeniu, potem strumień `midi_cfg`). Konfiguracja kapsla, którego nikt
  // nie edytuje, nie mieszka w panelu w ogóle — czytamy ją wolną kopią (_midiCfgOther).
  getCfgName: function (dev) {
    const cur = _midiCfgDev();
    if (!dev || dev === cur) return String((state.midi || {}).configName || "");
    const o = _midiCfgOther(dev);
    return String((o && o.configName) || "");
  },
  // NAZWA NA WSKAZANYM KAPSLU. SAMA nazwa, nie całe state.midi — z dwóch niezależnych powodów:
  //  1. set_config po stronie serwera SCALA (dotyka wyłącznie kluczy, które przyszły), więc
  //     zdjęcie podpisu nie ma prawa przepisać całej listy mapowań;
  //  2. body BEZ `enabled` nie budzi MIGRACJI starych plików (`enabled` bez `oscEnabled` znaczy
  //     „stary jednoprzełącznikowy config" i ustawia oscEnabled na to samo) — a wysłanie całego
  //     state.midi wysłałoby oba klucze i o migrację by się otarło.
  // postMidi() wysyła całość i jest do czego innego — do zapisywania zmian w mapowaniach.
  //
  // Bramka „konfiguracja jeszcze się wczytuje" dotyczy WYŁĄCZNIE bieżącego kapsla, i to nie
  // dlatego, że wysyłamy z niej cokolwiek (leci sama nazwa), tylko dlatego, że po sukcesie
  // dopisujemy odpowiedź do `state.midi` — a ten obiekt bywa przez chwilę cudzy.
  setCfgNameOn: function (dev, name, done) {
    const cur = _midiCfgDev();
    const target = dev || cur;
    if (target === cur && !_midiCfgReady()) {
      rfToast(_midiCfgNotReady(), { tone: "danger" }); if (done) done(); return;
    }
    _midiCfgPost("/midi?dev=" + encodeURIComponent(target),
      { configName: String(name || "") }, function (err, j) {
        // Nawet po odmowie hub MUSI się odświeżyć: kafel pokazywałby wtedy chip kapsla, który tej
        // nazwy nie nosi, i wyglądałoby to na zapisane. Odświeżenie cofa go do prawdy.
        if (err) rfToast(err, { tone: "danger" });
        else if (target === cur) state.midi.configName = String((j && j.configName) || "");
        else {
          const D = devEntry(target);
          if (D) D.midiCfg = Object.assign({}, D.midiCfg || {}, j || {});
        }
        if (typeof done === "function") done();
      });
  },
  setCfgName: function (name, done) {
    return MIDI_CFG_ADAPTER.setCfgNameOn(_midiCfgDev(), name, done);
  },
  fingerprintCurrent: function () { return midiCfgFingerprint(state.midi); },
  // Odcisk WSKAZANEGO kapsla. `null` = jego zestaw jeszcze nie dojechał (albo state.midi należy
  // chwilowo do poprzedniego kapsla); hub wtedy milczy zamiast stawiać kropkę „zmienione" na
  // podstawie cudzych danych.
  fingerprintOf: function (dev) {
    const cfg = _midiCfgOf(dev);
    return cfg ? midiCfgFingerprint(cfg) : null;
  },
  // `null` = nie da się porównać, bo nie znamy treści presetu (starszy serwer odsyła same nazwy).
  // Pasek wtedy milczy — patrz komentarz przy `st()` w rf-49.
  fingerprintPreset: function (p) {
    return (p && p.config && typeof p.config === "object") ? midiCfgFingerprint(p.config) : null;
  },
  listPresets: function () { return state.midiPresets || []; },
  findPreset: function (name) {
    const k = rfCfgIdKey(name);
    if (!k) return null;
    return (state.midiPresets || []).find(function (p) {
      return rfCfgIdKey(p.name) === k;
    }) || null;
  },
  // Zapis i nadpisanie to ta sama prośba z inną nazwą — jeden format pliku i jedna sanityzacja
  // (serwer odcina MIDI_PRESET_SKIP), więc „Zapisz jako…" i „Zapisz zmiany" nie mogą się rozjechać.
  saveAs: function (name, done, desc) {
    if (!_midiCfgReady()) return done(_midiCfgNotReady());
    _midiCfgPost("/midi-preset/save",
      { name: name, config: state.midi, desc: String(desc || "") }, function (err) {
        if (err) return done(err);
        loadMidiPresets(function () { done(null); });
      });
  },
  // ⚠️ NADPISANIE MUSI ODDAĆ OPIS, KTÓRY PRESET JUŻ MA. Zapis idzie jedną drogą z „Zapisz jako…",
  // a ta wysyła `desc` — bez tej linijki „Zapisz zmiany" kasowałoby opis po cichu przy każdym
  // zapisie mapowań, i to bez śladu w interfejsie, bo kafel po prostu pokazałby „bez opisu".
  overwrite: function (name, done) {
    const p = MIDI_CFG_ADAPTER.findPreset(name);
    return MIDI_CFG_ADAPTER.saveAs(name, done, (p && p.desc) || "");
  },
  // NADPISANIE SAMYCH METADANYCH: mapowania idą te, które preset JUŻ MA, więc poprawka opisu nie
  // ma jak zapisać tego, co ktoś właśnie majstruje na kapslu. Nowa nazwa zapisuje pod nową nazwą —
  // przeniesienie starej pozycji i przepisanie kapsli robi hub, bo to jego wiedza o tym, kto co nosi.
  savePresetMeta: function (p, name, desc, done) {
    _midiCfgPost("/midi-preset/save",
      { name: name, config: (p && p.config) || {}, desc: String(desc || "") }, function (err) {
        done(err || null);
      });
  },
  deletePreset: function (name, done) {
    _midiCfgPost("/midi-preset/delete", { name: name }, function (err) { done(err || null); });
  },
  reloadPresets: function () { loadMidiPresets(); },
  // WCZYTANIE NA WSKAZANY KAPSEL. Przełączniki grup MIDI i OSC, kanał MIDI i prefiks adresów
  // kapsla-CELU zostają jego własne: preset ich nie niesie (MIDI_PRESET_SKIP), a serwer scala —
  // i to jest cała różnica między „ten sam zestaw na dwóch kapslach" a „dwa kapsle grające po
  // sobie w to samo miejsce". Hub mówi o tym w oknie przez `describeKeeps()`.
  applyPresetOn: function (dev, p, done) {
    const cur = _midiCfgDev();
    const target = dev || cur;
    _midiCfgPost("/midi-preset/load?dev=" + encodeURIComponent(target),
      { name: p.name }, function (err, j) {
        if (err) return done(err);
        if (target === cur) {
          // EDYTOR MAPOWANIA TRZYMA KOPIĘ WIERSZA ZE STAREJ LISTY (openMidiEditor kopiuje mapowanie
          // do `state._midiDraft`). Zapisany po podmianie dokleiłby do nowego zestawu pozycję ze
          // starego — a dodatkowo `onMidiCfg` przy otwartym edytorze w ogóle nic by nie przyjął
          // (bramka `state.midiEditing`) i panel pokazywałby zestaw, którego kapsel już nie ma.
          // Zamknięcie edytora przed podmianą to ten sam ruch, co przy cofaniu importu wyzwalaczy.
          //
          // ⚠️ TYLKO DLA KAPSLA-CELU RÓWNEGO EDYTOWANEMU. Wczytanie na CUDZY kapsel nie ma prawa
          // zamknąć komuś okna, w którym właśnie stoi: edytor jest zawsze o kapslu bieżącym, więc
          // podmiana zestawu gdzie indziej nie unieważnia ani jednego pola, które ma otwarte.
          if (state.midiEditing && typeof closeMidiEditor === "function") closeMidiEditor();
          // Serwer sam nadaje kapslowi nazwę wczytanego presetu (apply_midi_preset), a odpowiedź
          // jest pierwszym miejscem, gdzie to widać — wyprzedza rozgłoszenie po strumieniu.
          if (j && j.config && typeof onMidiCfg === "function") onMidiCfg(j.config);
        } else if (j && j.config) {
          // Wolna kopia zestawu tamtego kapsla — żeby chip przeskoczył na nowy kafel od razu,
          // a nie dopiero po następnym jej odświeżeniu (do trzech sekund później).
          const D = devEntry(target);
          if (D) D.midiCfg = Object.assign({}, j.config);
        }
        done(null);
      });
  },
  applyPreset: function (p, done) {
    return MIDI_CFG_ADAPTER.applyPresetOn(_midiCfgDev(), p, done);
  },
  // MIGAWKA DO COFNIĘCIA przed wczytaniem. Wyłącznie dla BIEŻĄCEGO kapsla, bo `_rfUndoStash("midi")`
  // pamięta `state.midi` i przywraca je zwykłym POST /midi — czyli zawsze na kapsel, przy którym
  // się stoi. Migawka zrobiona przy wczytaniu na cudzy kapsel przywróciłaby jego mapowania NA NASZ,
  // i byłby to najgorszy możliwy rodzaj „Cofnij": taki, który psuje coś innego niż naprawia.
  stashUndo: function (dev) {
    if (dev !== _midiCfgDev() || !_midiCfgReady() || typeof _rfUndoStash !== "function") {
      return Promise.resolve(false);
    }
    return Promise.resolve(_rfUndoStash("midi")).then(function (r) { return r !== false; })
      .catch(function () { return false; });
  },
  // KOPIA NA INNY KAPSEL — jedno kliknięcie zamiast trzech kroków przez Bibliotekę (zapisz →
  // przełącz kapsel → wczytaj). Adres z ?dev= celuje w kapsel-cel; SHIM z rf-05 nie dokłada tu
  // swojego ?dev=, bo widzi, że pytanie już je ma. Lecą TYLKO mapowania i skala, więc przełączniki,
  // kanał MIDI i prefiks OSC kapsla-celu zostają jego własne (set_config scala) — a to jest cała
  // różnica między „ten sam zestaw na dwóch kapslach" a „dwa kapsle grające po sobie".
  //
  // ⚠️ HUB TEGO NIE WOŁA (przeciągnięcie chipa WCZYTUJE nazwany preset, a to co innego niż
  // przepisanie surowej listy). Zostaje razem z odpowiednikiem w rf-49b i rf-49c, bo jest jedyną
  // drogą na przeniesienie zestawu BEZ nazwy — usunięcie tego kodu zamknęłoby ją, zanim ktokolwiek
  // zdecydował, że ma być zamknięta.
  copyTo: function (dev, done) {
    if (!_midiCfgReady()) return done(_midiCfgNotReady());
    const body = _midiCfgBehaviour();
    body.configName = MIDI_CFG_ADAPTER.getCfgName();
    _midiCfgPost("/midi?dev=" + encodeURIComponent(dev), body, function (err, j) {
      if (err) return done(err);
      // Wolna kopia konfiguracji tamtego kapsla — żeby „tej konfiguracji używa też…" mówiło
      // prawdę od razu, a nie dopiero po następnym jej odświeżeniu.
      const D = devEntry(dev);
      if (D && j) D.midiCfg = Object.assign({}, D.midiCfg || {}, j);
      done(null);
    });
  },
  describeCurrent: function () { return _midiCfgWhat(state.midi); },
  describePreset: function (p) { return _midiCfgWhat(p && p.config); },
  // …i to samo o WSKAZANYM kapslu. Pusto, gdy jego zestaw jeszcze nie dojechał — okno pomija wtedy
  // liczbę, zamiast podawać liczbę z kapsla, przy którym akurat stoimy.
  describeDev: function (dev) {
    const cfg = _midiCfgOf(dev);
    return cfg ? _midiCfgWhat(cfg) : "";
  },
  // „Grup MIDI i OSC" w liczbie mnogiej, bo preset jest jeden na oba wyjścia i to zdanie czyta
  // zarówno ktoś, kto stroi CC do DAW-a, jak i ktoś, kto celuje w TouchOSC. To jest GRANICA PRESETU
  // wyłożona człowiekowi: hub wkleja to zdanie do okna wczytania zaraz po nazwie kapsla-celu.
  describeKeeps: function () {
    return _gl("Przełączniki grup MIDI i OSC, kanał MIDI i prefiks adresów OSC zostają bez zmian. "
               + "Adres domyślny OSC i lista odbiorników OSC są wspólne dla całej aplikacji i nie wchodzą do konfiguracji.",
               "The MIDI and OSC group switches, the MIDI channel and the OSC address prefix stay as they are. "
               + "The default OSC address and the list of OSC receivers are shared by the whole application and are not part of the configuration.");
  },
  // Co zostaje, gdy z kapsla schodzi sama NAZWA. Zdanie modułu, nie komponentu: hub nie wie, że
  // rzeczy, o których mowa, nazywają się mapowaniami.
  describeUnname: function () {
    return _gl("Mapowania zostały bez zmian.", "Its mappings are untouched.");
  },
  // Opis i metryka kafla — to one odróżniają dwa kafle w bibliotece od siebie.
  presetDesc: function (p) { return String((p && p.desc) || ""); },
  presetMetric: function (p) { return _midiCfgMetric(p && p.config); },
  // Limit długości opisu przychodzi z serwera (GET /midi-presets -> descMax) — jedna liczba dla
  // pliku, listy i pola tekstowego. Wartość zapasowa jest tą samą, którą serwer ma wpisaną na stałe.
  descMax: function () { return +state.midiDescMax || 200; },
  // Czy jest CO zapisać. Dwa różne powody odmowy, oba wypowiedziane:
  //  * zestaw jeszcze w drodze — zapisany pod nazwą byłby zestawem POPRZEDNIEGO kapsla,
  //  * pusta lista — pozycja, która po wczytaniu kasuje komuś wszystkie mapowania, a wyłączony
  //    przycisk z powodem mówi to wcześniej niż okno „na pewno?".
  canSaveCurrent: function () {
    if (!_midiCfgReady()) return { ok: false, why: _midiCfgNotReady() };
    const n = ((state.midi || {}).mappings || []).length;
    return n ? { ok: true, why: "" }
             : { ok: false, why: _gl("Najpierw dodaj choć jedno mapowanie — pusty zestaw nie ma czego nieść.",
                                     "Add at least one mapping first — an empty set has nothing to carry.") };
  },
  describeSaveAs: function () {
    return _gl("Kapsel od razu zacznie nosić tę nazwę. To JEDNA konfiguracja na oba wyjścia — "
               + "MIDI i OSC razem: zapamiętuje " + _midiCfgWhat(state.midi) + " wraz ze skalą. "
               + "Przełączniki grup MIDI i OSC, kanał MIDI i prefiks adresów OSC zostają bez zmian. "
               + "Adres domyślny OSC i lista odbiorników OSC są wspólne dla całej aplikacji i nie wchodzą do konfiguracji.",
               "The capsule starts carrying that name right away. This is ONE configuration for both "
               + "outputs — MIDI and OSC together: it remembers " + _midiCfgWhat(state.midi) + " along with the scale. "
               + "The MIDI and OSC group switches, the MIDI channel and the OSC address prefix stay as they are. "
               + "The default OSC address and the list of OSC receivers are shared by the whole application and are not part of the configuration.");
  }
};

let _midiCfgHubs = [];

// ------------------------------------------------------------------------------------------
//  PODPIĘCIE
// ------------------------------------------------------------------------------------------
// Hub stoi POD nagłówkiem karty i NAD listą mapowań, bo odpowiada na pytanie zadane w nagłówku:
// skoro to są mapowania tego kapsla, to jak się ten zestaw nazywa, do czego jest i kto jeszcze go
// nosi. Pod listą przeczytałby go tylko ktoś, kto przewinął sześćdziesiąt cztery pozycje.
//
// DWIE INSTANCJE nad JEDNYM stanem — patrz nagłówek pliku. Różnią się wyłącznie `idPrefix`
// (elementy DOM muszą mieć własne id), więc opis zachowania jest jeden i nie ma się jak rozjechać.
//
// ⚠️ ZWIJANIE MA OSOBNY KLUCZ NA KAŻDĄ ZAKŁADKĘ, i to wynika wprost z `idPrefix`: hub zapisuje
// stan pod „ribbitflip.cfghub.<prefiks>", więc „midi" i „osc" nie mogą trafić w to samo miejsce.
// Tak ma być. Wspólny klucz znaczyłby, że ktoś od TouchOSC zwija sekcję u siebie i zwija ją
// jednocześnie komuś, kto stroi CC do DAW-a — a to są dwa różne biurka i dwa różne nawyki.
// STAN jest wspólny (jedna lista mapowań), WIDOK jest osobny; te dwie rzeczy nie są tym samym.
//
// Wołane PO initTabs, bo karta OSC (#oscCard) powstaje dopiero tam (rf-34) — przed nią nie ma
// czego szukać. Kolejność w rf-40-boot pilnuje tego jawnie.
function initMidiCfgHub() {
  [["midiCard", "midi"], ["oscCard", "osc"]].forEach(function (pair) {
    const card = document.getElementById(pair[0]);
    if (!card || document.getElementById(pair[1] + "CfgHub")) return;   // brak karty = okno nakładki
    const head = card.querySelector(".head");
    if (!head) return;
    const hub = rfCfgHubCreate(Object.assign({}, MIDI_CFG_ADAPTER, { idPrefix: pair[1] }));
    head.insertAdjacentHTML("afterend", hub.hubHtml());
    hub.wire();
    _midiCfgHubs.push(hub);
  });
  if (_midiCfgHubs.length) loadMidiPresets();
  _midiCfgWatchTabs();
}

// THE METRIC DEPENDS ON WHICH TAB IS ON SCREEN (see _midiCfgMetric), but the lists that print it
// are painted once and then only when something calls midiCfgSync(). Switching tabs changes
// nothing in the configuration, so nothing calls it — and the OSC tab kept the MIDI-first wording
// it happened to be built with. One observer on the two panels' `class` attribute answers exactly
// that, and only that: `active` moves on a tab switch and at no other time. Attributes only, no
// subtree, so a redraw inside the panel cannot feed the observer its own output.
function _midiCfgWatchTabs() {
  if (typeof MutationObserver !== "function" || !_midiCfgHubs.length) return;
  const obs = new MutationObserver(function () { midiCfgSync(); });
  for (const id of ["tab-midi", "tab-osc"]) {
    const p = document.getElementById(id);
    if (p) obs.observe(p, { attributes: true, attributeFilter: ["class"] });
  }
}

// Jedno wejście dla wszystkich, którzy zmieniają zestaw: onMidiCfg (strumień `midi_cfg`, wczytanie
// presetu), miFetchState (start i przełączenie kapsla) oraz postMidi (każda edycja listy). Tanie —
// sync porównuje odcisk całego rysunku przed przerysowaniem i przy braku różnicy nie rusza DOM-u
// (a więc nie zabiera ogniska) — więc wołanie go „na wszelki wypadek" nic nie kosztuje.
function midiCfgSync() {
  if (!_midiCfgHubs.length) return;
  for (const h of _midiCfgHubs) h.sync();
  _midiCfgPrime();
}

// Kto jeszcze nosi ten zestaw i czy jego kapsel ma kropkę „zmienione". Konfiguracje pozostałych
// kapsli zamawiamy Z WYPRZEDZENIEM: hub rysuje chip każdego kapsla, a czekanie na sieć w chwili
// rysowania znaczyłoby, że kafle dojeżdżają jeden po drugim na oczach patrzącego.
// Throttle siedzi w _midiCfgOther (3 s na kapsel), więc „na wszelki wypadek" nic nie kosztuje.
function _midiCfgPrime() {
  const cur = _midiCfgDev();
  for (const D of Object.values(state.devices || {})) {
    if (!D || !D.meta || !D.meta.dev || D.meta.dev === cur) continue;
    try { _midiCfgOther(D.meta.dev); } catch (e) { /* kapsel bez metadanych — nic tu nie ma do policzenia */ }
  }
}
