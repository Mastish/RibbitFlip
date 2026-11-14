"use strict";
// ============================================================================
//  USŁUGI SIECIOWE: nazwane PRESETY — „Stream", „Warsztat", „Zgłoszenia z hali"
//
//  Adapter wspólnego komponentu tożsamości (rf-49-cfgid.js) dla całej zakładki „Usługi sieciowe".
//  Do 2026-08-30 ta zakładka i „Kontroler" były jedynymi modułami BEZ presetów: kilkadziesiąt akcji
//  HTTP i sterowania OBS-em razem z wyzwalaczami, jeden zestaw na aplikację i żaden sposób, żeby
//  mieć obok siebie „Stream" (sceny OBS) i „Warsztat" (webhooki do Make). Przełączenie znaczyło
//  ręczne wyłączanie połowy akcji i włączanie drugiej — za każdym razem trochę inaczej.
//
//  TRZECI ADAPTER, W KTÓRYM NOŚNIKIEM NAZWY NIE JEST KAPSEL (po układach okien rf-49f i scenach
//  syntezatora rf-49g). Usługi są JEDNE na aplikację, a każdy wyzwalacz sam mówi, którego kapsla
//  słucha (pole `dev` w `src`). Przypisanie tej nazwy do któregokolwiek kapsla byłoby kłamstwem,
//  więc — jak przy scenach:
//    • nazwa mieszka na wierzchu configu modułu (`RESTAPI.cfg.configName`), nie w konfiguracji kapsla,
//    • „Skopiuj na…" i „Wczytaj na…" NIE ISTNIEJĄ — nie ma drugiego kapsla, na który dałoby się
//      przenieść zestaw akcji (komponent chowa je sam, gdy adapter nie ma `copyTo`/`applyPresetOn`).
//
//  PRESET NIE NIESIE PRZEŁĄCZNIKA ANI ADRESU OBS-A. Ta sama granica, co po stronie serwera
//  (REST_PRESET_SKIP): plik nie ma prawa uzbroić wysyłki, a „gdzie stoi OBS" to stanowisko pracy,
//  nie treść zestawu. Sekretów tu nie ma z definicji — tokeny i hasła mieszkają w osobnym sejfie,
//  a config trzyma wyłącznie identyfikator wpisu.
//
//  Po rf-35 (RESTAPI.cfg, restSave, _raSanCfg) i rf-49.
// ============================================================================

const RF_RESTCFG_I18N = {
  "Preset:": "Preset:",
  "Wybierz preset usług sieciowych": "Choose a network-services preset",
  "Zapisano preset: ": "Preset saved: ",
  "Usługi sieciowe grają teraz preset: ": "The network services now run the preset: ",
  "tego presetu nie ma już na liście": "this preset is no longer on the list",
  "Nadpisać preset „": "Overwrite the preset “",
  "Nadpisz preset „": "Overwrite the preset “",
  "Wczytać preset „": "Load the preset “",
  "Zapisz jako nowy preset": "Save as a new preset",
  "Nie udało się porozumieć z aplikacją.": "Could not reach the application.",
  "Serwer odmówił zapisu.": "The server refused the save.",
  "brak akcji": "no actions",
  // Podpowiedź zakładki „Konfiguracja" TEGO modułu — patrz `_restCfgTabHint` na dole pliku.
  "Konfiguracja — Ustawienia wspólne dla wszystkich kapsli: jeden plik, jeden włącznik, jeden dziennik dla całej aplikacji":
    "Configuration — Settings shared by every capsule: one file, one switch, one log for the whole application",
};
try { Object.assign(I18N_EN, RF_RESTCFG_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

state.restPresets = [];      // [{name, desc, config}] — lustro biblioteki z serwera
state.restDescMax = 200;     // sufit opisu z serwera (PROFILE_DESC_MAX); nie zgadujemy go tutaj

// ------------------------------------------------------------------------------------------
//  CO PRESET NIESIE — i co z tego wchodzi w odcisk
// ------------------------------------------------------------------------------------------
// Odcisk musi obejmować DOKŁADNIE to, co plik zapisuje. Gdyby liczył pole, którego preset nie
// niesie, każdy zestaw byłby „zmieniony" od chwili wczytania; gdyby pomijał pole, które preset
// niesie, zmiana tego pola znikałaby po cichu przy „Zapisz zmiany".
const REST_CFG_FIELDS = ["apis", "vars"];

// Ten sam odcisk rekurencyjny, co przy scenach syntezatora (rf-49g `_synthFp`), i z tych samych
// dwóch powodów: klucze słowników sortowane (kolejność w `vars` to przypadek historii, nie treść)
// oraz liczby przez `toFixed(3)` (próg 0.07 i 0.07000000000000001 to ten sam próg). Tekst zostaje
// tekstem — nazwa akcji „1" i nazwa „1.0" to dwie różne akcje.
function _restFp(v) {
  if (v === null || v === undefined) return "~";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(3) : "~";
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(_restFp).join(",") + "]";
  if (typeof v !== "object") return JSON.stringify(String(v));
  return "{" + Object.keys(v).sort().map(function (k) {
    return JSON.stringify(k) + ":" + _restFp(v[k]);
  }).join(",") + "}";
}
function _restPick(cfg) {
  const src = (cfg && typeof cfg === "object") ? cfg : {};
  const out = {};
  for (const k of REST_CFG_FIELDS) out[k] = src[k];
  return out;
}
// ⚠️ OBIE STRONY PORÓWNANIA MUSZĄ BYĆ PO SANITYZACJI — inaczej preset, którego nikt nie tknął,
// zgłasza się jako „zmieniony" w sekundzie po wczytaniu. Powód: `applyPreset` przepuszcza treść
// z pliku przez `_raSanCfg`, a ten dopisuje każdej akcji komplet pól domyślnych (metoda, typ
// ciała, identyfikatory). Żywy config ma je więc ZAWSZE, a plik na dysku tylko wtedy, gdy zapisał
// go ten sam build. Zmierzone: świeżo wczytany „Test stream" pokazywał `dirty:true`.
//   To jest dokładnie ta sama zasada, którą po stronie serwera realizuje `sanitize_mouse_cfg`
//   („kapsel jest ZAWSZE po sanityzacji, więc preset, do którego się go porównuje, też musi być").
//   Tu sanityzator mieszka w przeglądarce, więc wołamy go tutaj.
// Sanityzator NIGDY nie rzuca (zwraca config domyślny), ale pytamy o niego przez `typeof`: odcisk
// liczy też Biblioteka globalna, a ta bywa rysowana, zanim rf-35 się załaduje.
function _restSan(cfg) {
  try { if (typeof _raSanCfg === "function") return _raSanCfg(cfg); } catch (e) { }
  return cfg;
}
function restCfgFingerprint(cfg) { return _restFp(_restPick(_restSan(cfg))); }

// ------------------------------------------------------------------------------------------
//  CO TEN PRESET ROBI — zdanie do okien z pytaniem o zgodę
// ------------------------------------------------------------------------------------------
// Odmiana po polsku, bo to zdanie stoi w oknie czytanym w chwili podejmowania decyzji, a nie
// w wydruku. Ta sama funkcja liczy obie strony porównania, więc „ma teraz" i „zostanie zastąpione"
// są mierzone tą samą miarą.
function _restPl(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (n === 1) return one;
  if (b >= 2 && b <= 4 && (a < 10 || a >= 20)) return few;
  return many;
}
function _restCount(cfg) {
  const apis = (cfg && Array.isArray(cfg.apis)) ? cfg.apis : [];
  let acts = 0, trigs = 0;
  for (const a of apis) {
    if (Array.isArray(a && a.actions)) acts += a.actions.length;
    if (Array.isArray(a && a.triggers)) trigs += a.triggers.length;
  }
  return { apis: apis.length, acts: acts, trigs: trigs };
}
function _restDescribe(cfg) {
  const c = _restCount(cfg);
  if (!c.acts) return _gl("brak akcji", "no actions");
  const parts = [c.acts + " " + _restPl(c.acts,
    _gl("akcja", "action"), _gl("akcje", "actions"), _gl("akcji", "actions"))];
  if (c.trigs) parts.push(c.trigs + " " + _restPl(c.trigs,
    _gl("wyzwalacz", "trigger"), _gl("wyzwalacze", "triggers"), _gl("wyzwalaczy", "triggers")));
  return parts.join(" · ");
}
// METRYKA W WIERSZU LISTY — jeden fakt, który odróżnia dwa presety o podobnych nazwach szybciej
// niż opis. Ta sama treść, co w oknie: druga miara znaczyłaby dwie różne odpowiedzi na jedno pytanie.
function _restMetric(cfg) { return _restDescribe(cfg); }

// ------------------------------------------------------------------------------------------
//  ROZMOWA Z SERWEREM
// ------------------------------------------------------------------------------------------
function _restCfgPost(url, body, done) {
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
               body: JSON.stringify(body || {}) })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || j.ok === false || j.error) {
        return done((j && j.error) || _gl("Serwer odmówił zapisu.", "The server refused the save."), null);
      }
      done(null, j);
    })
    .catch(function () {
      done(_gl("Nie udało się porozumieć z aplikacją.", "Could not reach the application."), null);
    });
}

// BIBLIOTECZKA PRESETÓW — treść, nie same nazwy: „zmienione" to porównanie dwóch stron.
function loadRestPresets(done) {
  return fetch("/rest-presets").then(function (r) { return r.json(); })
    .then(function (j) {
      state.restPresets = (j && Array.isArray(j.items)) ? j.items : [];
      if (j && j.descMax) state.restDescMax = +j.descMax || state.restDescMax;
      restCfgSync();
      if (typeof done === "function") done();
    })
    .catch(function () { if (typeof done === "function") done(); });
}

// PO WYMIANIE AKCJI trzeba narysować zakładkę od nowa: karty akcji trzymają wartości w polach
// formularza, a te po wczytaniu opisują akcje, których już nie ma.
function _restRerenderAll() {
  try { if (typeof restRenderApis === "function") restRenderApis(); } catch (e) { }
  try { if (typeof _raRenderHeader === "function") _raRenderHeader(); } catch (e) { }
  try { if (typeof restObsRefresh === "function") restObsRefresh(); } catch (e) { }
  try { if (window.updateTabDots) updateTabDots(); } catch (e) { }
}

// ------------------------------------------------------------------------------------------
//  ADAPTER
// ------------------------------------------------------------------------------------------
const REST_CFG_ADAPTER = {
  idPrefix: "rest",
  // Pill in the module bar where a capsule pill stands elsewhere (rf-49j paintCrumb): this module
  // is one for the whole app, and which capsule fires which action is set on the trigger.
  sharedChip: ["Wspólne dla wszystkich kapsli", "Shared by all capsules"],
  hubTitle: "Presety usług sieciowych",
  // Zdania okien mówią o USŁUGACH, nie o kapslu, i o PRESECIE, nie o konfiguracji kapsla.
  barLabel: "Preset:",
  pickTitle: "Wybierz preset usług sieciowych",
  words: {
    onIt: ["w usługach sieciowych", "in the network services"],
    onThis: ["w usługach sieciowych", "in the network services"],
    thisOne: ["ten zestaw", "this set"],
    takes: ["Usługi sieciowe od razu zaczną nosić tę nazwę.",
            "The network services start carrying that name right away."],
    remembers: ["Preset zapamiętuje ", "The preset remembers "],
    carries: ["Usługi sieciowe grają teraz preset: ", "The network services now run the preset: "],
    gone: ["tego presetu nie ma już na liście", "this preset is no longer on the list"],
    askOverwrite: ["Nadpisać preset „", "Overwrite the preset “"],
    overwriteTip: ["Nadpisz preset „", "Overwrite the preset “"],
    askLoadTitle: ["Wczytać preset „", "Load the preset “"],
    saveAsTitle: ["Zapisz jako nowy preset", "Save as a new preset"],
    saveAsBtn: ["Zapisz preset", "Save the preset"],
    saved: ["Zapisano preset: ", "Preset saved: "],
    inUse: ["Ten preset jest teraz włączony.", "This preset is in use right now."],
    toEdit: ["Żeby go przerobić, najpierw go wczytaj.", "To rework it, load it first."],
    loadHere: ["Wczytaj preset", "Load the preset"],
    // Nie „ten kapsel ma konfigurację bez nazwy" jak w modułach kapslowych: ten moduł JEST jeden na
    // aplikację, a zdanie o kapslu obiecywałoby, że gdzieś obok stoi drugi zestaw usług dla drugiego
    // kapsla. Nawias mówi to wprost, bo w pasku modułu nie ma pigułki kapsla, która by to pokazała.
    noName: ["Usługi nie mają jeszcze nazwy (te ustawienia są wspólne dla wszystkich kapsli). Zapisz je jako preset, żeby móc do nich wrócić.",
             "The services have no name yet (these settings are shared by every capsule). Save them as a preset so you can come back to them."],
  },
  // Pusto i pusta lista: nazwa nie wisi na żadnym kapslu, więc nie ma czego pokazywać na chipach
  // ani dokąd kopiować. Komponent i lista presetów same chowają wtedy te elementy.
  getDev: function () { return ""; },
  devName: function (dev) {
    const D = ((typeof state !== "undefined" && state.devices) || {})[dev];
    const m = (D && D.meta) || {};
    return m.name || m.label || dev;
  },
  listAllDevs: function () { return []; },
  listOtherDevs: function () { return []; },

  getCfgName: function () {
    return String((window.RESTAPI && RESTAPI.cfg && RESTAPI.cfg.configName) || "");
  },
  setCfgName: function (name, done) {
    // Nazwa jedzie tą samą drogą, co każda inna zmiana w tym module — przez `restSave()`, czyli
    // POST /rest/config. Osobny endpoint byłby drugim miejscem, w którym zapisuje się to samo pole.
    // Zdjęcie nazwy nie rusza ani jednej akcji: znaczy „to już nie jest ten preset".
    try {
      RESTAPI.cfg.configName = String(name || "");
      restSave();
    } catch (e) { }
    if (typeof done === "function") done();
  },

  fingerprintCurrent: function () {
    return restCfgFingerprint((window.RESTAPI && RESTAPI.cfg) || {});
  },
  // `null` = nie da się porównać (rekord bez treści, starszy serwer). Pasek i lista wtedy MILCZĄ,
  // zamiast stawiać kropkę „zmienione" na podstawie niczego — patrz komentarz przy `st()` w rf-49.
  fingerprintPreset: function (p) {
    return (p && p.config && typeof p.config === "object") ? restCfgFingerprint(p.config) : null;
  },

  listPresets: function () { return state.restPresets || []; },
  findPreset: function (name) {
    const k = rfCfgIdKey(name);
    if (!k) return null;
    return (state.restPresets || []).find(function (p) { return rfCfgIdKey(p.name) === k; }) || null;
  },
  presetDesc: function (p) { return String((p && p.desc) || ""); },
  presetMetric: function (p) { return _restMetric(p && p.config); },
  descMax: function () { return +state.restDescMax || 200; },

  // TREŚĆ WYSYŁA KLIENT, a nie serwer zdejmuje ją ze swojej kopii: zapis configu jest odroczony
  // (`restSave` ma debounce), więc preset zdjęty z pliku serwera byłby presetem sprzed ostatniej
  // zmiany. Zapisane ma być to, co moduł ma W CHWILI kliknięcia. Serwer i tak przytnie to do
  // granicy presetu (rest_preset_config) — obrona po obu stronach, nie zamiast.
  saveAs: function (name, done, desc) {
    _restCfgPost("/rest-preset/save",
      { name: name, config: (window.RESTAPI && RESTAPI.cfg) || {}, desc: String(desc || "") },
      function (err) {
        if (err) return done(err);
        loadRestPresets(function () { done(null); });
      });
  },
  overwrite: function (name, done) { return REST_CFG_ADAPTER.saveAs(name, done, _restDescOf(name)); },
  // Zmiana samej nazwy i opisu: treść idzie NIETKNIĘTA — ta, którą preset już ma. Bez tego
  // poprawienie literówki w opisie zapisywałoby przy okazji to, co ktoś właśnie majstruje w module.
  savePresetMeta: function (p, name, desc, done) {
    _restCfgPost("/rest-preset/save",
      { name: name, config: (p && p.config) || {}, desc: String(desc || "") },
      function (err) { done(err || null); });
  },
  deletePreset: function (name, done) {
    _restCfgPost("/rest-preset/delete", { name: name }, function (err) { done(err || null); });
  },
  reloadPresets: function () { loadRestPresets(); },

  // WCZYTANIE IDZIE PRZEZ SERWER, w odróżnieniu od scen syntezatora. Powód jest w tym, gdzie
  // mieszka prawda: stan syntezatora żyje w przeglądarce (tam jest silnik dźwięku), a config Usług
  // żyje w pliku, z którego czyta go także silnik wyzwalaczy. Scalanie robi serwer
  // (`apply_rest_preset`), więc przełącznik i adres OBS-a zostają na miejscu nawet wtedy, gdy
  // panel jest w tej chwili zamknięty.
  applyPreset: function (p, done) {
    _restCfgPost("/rest-preset/load", { name: p && p.name }, function (err, j) {
      if (err) return done(err);
      try {
        RESTAPI.cfg = _raSanCfg(j && j.config);
        _restRerenderAll();
      } catch (e) {
        return done(_gl("Nie udało się wczytać tego presetu.", "Could not load this preset."));
      }
      done(null);
    });
  },

  describeCurrent: function () { return _restDescribe((window.RESTAPI && RESTAPI.cfg) || {}); },
  describePreset: function (p) { return _restDescribe(p && p.config); },
  describeKeeps: function () {
    return _gl("Przełącznik modułu zostaje bez zmian: preset mówi, CO aplikacja wyśle, a nie czy "
               + "wolno jej wysyłać. Zostaje też adres OBS-a i sejf z hasłami — to jest Twoje "
               + "stanowisko pracy, a nie treść zestawu.",
               "The module switch stays as it is: a preset says WHAT the app will send, not whether "
               + "it may send. The OBS address and the password vault stay too — that is your "
               + "workstation, not the content of the set.");
  },
};

function _restDescOf(name) {
  const p = REST_CFG_ADAPTER.findPreset(name);
  return String((p && p.desc) || "");
}

// ------------------------------------------------------------------------------------------
//  PODPIĘCIE
// ------------------------------------------------------------------------------------------
// ŻADNEGO PASKA ANI HUBA. Moduł dołączył do ramki trzech zakładek (rf-49j/rf-49m) już PO tym, jak
// blok stanu w „Konfiguracji" i lista w „Bibliotece" przejęły wszystko, co pasek i hub umiały —
// więc montowanie ich tutaj znaczyłoby dokładanie elementów po to, żeby zaraz schować je arkuszem.
// Adapter rejestruje się sam w `initPresetCols` (rf-49j `MODS`); tutaj zostaje tylko pobranie
// biblioteki i jedno wejście na odświeżenie.
function initRestCfg() {
  if (!document.getElementById("tab-restapi")) return;   // tryb ściągi (?view=overview) nie ma zakładek
  loadRestPresets();
}

// PODPOWIEDŹ ZAKŁADKI „KONFIGURACJA" — POPRAWKA DLA TEGO JEDNEGO MODUŁU.
// Wspólny pasek (rf-49m `PANES`) daje wszystkim modułom „Ustawienia tego modułu na wybranym kapslu".
// W Usługach to nieprawda: nie ma tu ani pigułki kapsla w pasku, ani kolumny w „Przeglądzie" — jest
// JEDEN `ribbitflip_rest.json` i JEDEN włącznik dla całej aplikacji. Napis podmieniamy tutaj, a nie
// w rf-49m, bo to wyjątek jednego modułu, nie nowa reguła dla wszystkich.
// Po polsku, zawsze: `title` tłumaczy spacer i18n po dokładnym dopasowaniu (para wyżej), a on sam
// pilnuje też przełączenia języka — własne `_gl` zostawiłoby angielski napis po powrocie na polski.
// Bez kropki na końcu, jak podpowiedzi pozostałych pigułek (rf-49m `hint`) — jedno zdanie = bez kropki.
const REST_CFG_TAB_HINT =
  "Konfiguracja — Ustawienia wspólne dla wszystkich kapsli: jeden plik, jeden włącznik, jeden dziennik dla całej aplikacji";
function _restCfgTabHint() {
  const b = document.getElementById("rfpcTab-restapi-cfg");
  if (!b || b._rfRestHint) return;                   // ramki jeszcze nie ma (rf-49j leci po nas) albo już podmienione
  b._rfRestHint = true;                              // RAZ na przycisk: `restCfgSync` leci przy każdej zmianie configu,
  b.title = REST_CFG_TAB_HINT;                       // a moduł dymków (rf-05) przenosi `title` do `data-rftip` —
  b.setAttribute("aria-label", REST_CFG_TAB_HINT);   // dopisywanie go z powrotem co sync byłoby walką z tym modułem
}

// Jedno wejście dla wszystkich, którzy zmieniają config Usług: woła to `initRest` po wczytaniu
// configu z serwera i każda operacja na presetach. Opakowuje je rf-49j (`spec.sync`), więc samo
// przerysowuje listę, blok stanu i okruszki.
function restCfgSync() {
  try { _restCfgTabHint(); } catch (e) { }
  /* reszta opakowywana przez initPresetCols — patrz rf-49j */
}
