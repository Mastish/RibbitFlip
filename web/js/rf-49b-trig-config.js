"use strict";
// ============================================================================
//  MAPOWANIE: kapsel nosi NAZWANĄ konfigurację wyzwalaczy
//
//  Adapter wspólnych komponentów tożsamości dla listy wyzwalaczy. Do tej pory presety wyzwalaczy
//  leżały w bibliotece obok kapsla: wczytanie robiło kopię i na tym związek się kończył, więc
//  „co ten kapsel ma na sobie", „czy to jeszcze jest to, co zapisałem" i „które kapsle mają to
//  samo" nie miały odpowiedzi nigdzie w aplikacji. Przy czterdziestu wyzwalaczach boli to bardziej
//  niż przy kole — nikt nie przejrzy listy wzrokiem, żeby to sprawdzić.
//
//  ⚠️ MAPOWANIE MA JEDNĄ POWIERZCHNIĘ KONFIGURACJI: HUB (rf-49i). Do 2026-08-28 stały tu trzy —
//  rząd „Presety wyzwalaczy" (rf-13 + własny markup), cienki pasek tożsamości (rf-49) i biblioteka
//  w zakładce Wymiana — i każda z nich zapisywała to samo innym słowem. Pasek był
//  prosty, nieczytelny i ukryty, nie był wyborem z biblioteki, a użytkownik nie wiedział, czy
//  konfiguruje aktywny preset z autozapisem, czy taki, który wymaga zapisu. Rząd i pasek
//  zniknęły z Mapowania; ten plik ZOSTAJE jako warstwa logiki (odcisk, zapisy, wczytania), z której
//  hub korzysta. Metody z sufiksem `On`/`Of` pytają o WSKAZANY kapsel — hub rysuje chipy wszystkich,
//  nie tylko bieżącego, więc potrzebuje odpowiedzi także o cudze.
//
//  Po rf-13, bo współdzieli z nim pobór presetów (loadProfileList wypełnia state.trigPresets),
//  i po rf-49, którego rfCfgIdState/rfCfgIdCarriers wołają zarówno hub, jak i ten adapter.
// ============================================================================

// ------------------------------------------------------------------------------------------
//  ODCISK LISTY WYZWALACZY
// ------------------------------------------------------------------------------------------
// Co składa się na „ten sam zestaw wyzwalaczy". Lista pól jest DOKŁADNIE tą, którą preset niesie
// ze sobą — czyli tą, którą zapisuje sanitize_rules po stronie serwera. Jedno źródło dla obu stron
// porównania: gdyby odcisk liczył pole, którego preset nie zapisuje, każdy kapsel byłby
// „zmieniony" od chwili wczytania.
//
// ⚠️ `id` NIE WCHODZI DO ODCISKU. To tożsamość wewnętrzna reguły, nie jej treść — a przede
// wszystkim: serwer NADAJE id regule, która go nie ma (sanitize_rules, `r{i}_{ms}` z zegara).
// Preset z cudzego pliku bez id-ków dostawałby więc inne id przy każdym odczycie i taki kapsel
// twierdziłby „zmienione" na wieki, choć nikt niczego nie ruszył. (Edytor przy zwykłej edycji id
// nie zmienia — openEditor kopiuje regułę razem z nim — więc wykluczenie niczego nie ukrywa.)
//
// ⚠️ Per-reguła `enabled` WCHODZI: wyłączony wyzwalacz to konfiguracja („ten ma teraz nie działać"),
// w odróżnieniu od przełącznika całej grupy Mapowanie, który jest decyzją o tym kapslu w tej chwili.
const TRIG_CFG_FIELDS = ["label", "enabled", "abs", "cmp", "threshold", "thresholdHi", "neg",
                         "match", "behavior", "intervalMs", "dwellMs", "crossings", "windowMs",
                         "layer", "keySpec", "noAction", "sequence", "glow"];
// ⚠️ `noAction` WCHODZI, ale jako ZNORMALIZOWANY boolean (patrz niżej). „Bez klawisza" i „jeszcze
// nie wybrano" mają ten sam pusty `keySpec`, więc bez tego pola odcisk uznawałby dwie różne reguły
// za tę samą. Normalizacja jest konieczna, bo pole weszło później niż presety na dysku: brak pola
// (`undefined` → "") i zapisane `false` (→ "0") to ta sama reguła, a nie zmiana konfiguracji.
const TRIG_CFG_SRC_FIELDS = ["kind", "any", "byte", "bit", "holdMs", "metric", "ref", "channel"];
const TRIG_CFG_COND_FIELDS = ["abs", "cmp", "threshold", "thresholdHi", "op", "neg"];

// Liczby przez toFixed: suwak progu potrafi oddać 5000 i 5000.000000000001, a to jest ten sam próg.
// Bez tego kapsel bywałby „zmieniony" po samym dotknięciu suwaka i powrocie na miejsce.
function _trigCfgV(v) {
  if (typeof v === "number") return v.toFixed(3);
  if (v === true || v === false) return v ? "1" : "0";
  return String(v === undefined || v === null ? "" : v);
}
function _trigCfgSrc(s) {
  const o = s || {};
  let out = TRIG_CFG_SRC_FIELDS.map(k => _trigCfgV(o[k])).join("~");
  // A RECORDED gesture (rf-12d) keeps its recordings, its accuracy slider and its description in the
  // source. A re-recorded gesture or a moved slider is as much a change of the configuration as a
  // moved threshold — without these the bar would keep calling the capsule „unchanged".
  if (o.kind === "gesture") {
    const takes = Array.isArray(o.takes) ? o.takes.map(t => String((t && t.d) || "")).join(",") : "";
    out += "~" + ["accuracy", "threshold", "intensityTol", "durationTol", "channels", "endHoldMs", "desc"]
      .map(k => _trigCfgV(o[k])).join("~") + "~" + takes.length + ":" + takes;
  }
  return out;
}
function trigCfgFingerprint(rules) {
  return JSON.stringify((Array.isArray(rules) ? rules : []).map(r => {
    const o = r || {};
    const led = o.led || {}, toast = o.toast || {};
    return [
      TRIG_CFG_FIELDS.map(k => _trigCfgV(k === "noAction" ? !!o[k] : o[k])).join("|"),
      _trigCfgSrc(o.source),
      (Array.isArray(o.extraConditions) ? o.extraConditions : []).map(c => {
        const cc = c || {};
        return TRIG_CFG_COND_FIELDS.map(k => _trigCfgV(cc[k])).join("|") + "~" + _trigCfgSrc(cc.source);
      }).join(";"),
      _trigCfgV(led.on) + "," + _trigCfgV(led.ms),
      [toast.on, toast.mode, toast.silent, toast.text].map(_trigCfgV).join(",")
    ].join("//");
  }));
}

// ------------------------------------------------------------------------------------------
//  POMOCNIKI ADAPTERA
// ------------------------------------------------------------------------------------------
function _trigCfgDev() { return state.activeDeviceId || "d0"; }
function _trigCfgD(dev) { return state.devices[dev || _trigCfgDev()] || {}; }
function _trigCfgDevName(dev) {
  const m = _trigCfgD(dev).meta || {};
  return m.label || m.name || dev;
}
// Ile wyzwalaczy — po polsku, czyli z odmianą. „5 wyzwalacze" w oknie, które pyta o zgodę na
// zastąpienie czyjejś pracy, czyta się jak usterka i odbiera oknu powagę.
function _trigCfgCount(n) {
  n = +n || 0;
  if (typeof _lang !== "undefined" && _lang === "en") return n + (n === 1 ? " trigger" : " triggers");
  if (n === 1) return "1 wyzwalacz";
  const d = n % 10, h = n % 100;
  return n + ((d >= 2 && d <= 4 && !(h >= 12 && h <= 14)) ? " wyzwalacze" : " wyzwalaczy");
}
// REGUŁY WSKAZANEGO KAPSLA. Bieżący ma je w `state.rules` (świeższe niż cokolwiek), pozostałe
// przychodzą strumieniem: serwer wysyła zdarzenie `rules` DLA KAŻDEGO gniazda przy podłączeniu
// i po każdej zmianie (rf-08 wkłada je do D.rules), więc w praktyce są tu od pierwszej sekundy.
// Zapytanie niżej jest wyłącznie siatką pod tym: kapsel, który pojawił się bez zdarzenia, dostaje
// jedno pytanie na 10 s — wzór ovMotionCfg z rf-12. Do czasu odpowiedzi zwracamy `null`, czyli
// „nie wiadomo", bo kropka „zmienione" postawiona na cudzych regułach z pamięci bieżącego kapsla
// byłaby kłamstwem, którego nikt by nie wykrył.
const _trigCfgAsk = {};
function _trigCfgRules(dev) {
  if (dev === _trigCfgDev()) return state.rules || [];
  const D = _trigCfgD(dev);
  if (Array.isArray(D.rules)) return D.rules;
  const t = (typeof performance !== "undefined" ? performance.now() : Date.now());
  if (!(_trigCfgAsk[dev] > t - 10000)) {
    _trigCfgAsk[dev] = t;
    fetch("/rules?dev=" + encodeURIComponent(dev)).then(r => r.json())
      .then(j => {
        if (!j || !Array.isArray(j.rules)) return;
        const E = devEntry(dev);
        E.rules = j.rules;
        if (j.configName != null) E.cfgName = String(j.configName || "");
        if (typeof trigCfgSync === "function") trigCfgSync();
      }).catch(() => {});
  }
  return null;
}
function _trigCfgPost(url, body, done) {
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
               body: JSON.stringify(body) })
    .then(r => r.json())
    .then(j => {
      if (!j || j.ok === false || j.error) {
        return done((j && j.error) || _gl("Serwer odmówił zapisu.", "The server refused the save."), null);
      }
      done(null, j);
    })
    .catch(() => done(_gl("Nie udało się porozmawiać z aplikacją.", "Could not reach the application."), null));
}

// ------------------------------------------------------------------------------------------
//  ADAPTER
// ------------------------------------------------------------------------------------------
const TRIG_CFG_ADAPTER = {
  idPrefix: "trig",
  hubTitle: "Konfiguracje wyzwalaczy",
  // WYMIANA. Ten sam przycisk, który stał w usuniętym rzędzie presetów — z tym samym id, bo dwa
  // inne miejsca celują w niego po nim: rf-39l podpina okno wymiany (`wire("profDiscord","trig")`),
  // a przewodnik w rf-39m prowadzi do niego wskaźnikiem (`sel: "#profDiscord"`). Przeniesienie
  // guzika bez zachowania id zerwałoby oba po cichu.
  exchangeBtnId: "profDiscord",
  exchangeLabel: "Wymiana",
  exchangeTitle: "Podziel się na forum, zobacz cudze albo wczytaj od kogoś",
  getDev: _trigCfgDev,
  devName: _trigCfgDevName,
  // Kolejność stała (po id gniazda), bo to ona decyduje, gdzie na kaflu stoi chip — a kafel, na
  // którym chipy skaczą przy każdym odświeżeniu, jest kaflem nie do przeciągnięcia.
  listAllDevs: function () { return Object.keys(state.devices || {}).sort(); },
  listOtherDevs: function () {
    const cur = _trigCfgDev();
    return TRIG_CFG_ADAPTER.listAllDevs().filter(d => d !== cur);
  },
  // Nazwa mieszka przy regułach kapsla (D.cfgName obok D.rules) i przychodzi tą samą drogą, co one:
  // ze zdarzenia `rules`. Jedno źródło prawdy — kopia w state rozjechałaby się przy pierwszym
  // przełączeniu kapsla.
  getCfgName: function (dev) { return String(_trigCfgD(dev).cfgName || ""); },
  // NAZWA NA WSKAZANYM KAPSLU. Sama nazwa, bez reguł — serwer traktuje `{configName}` bez `rules`
  // jako „zmień wyłącznie podpis" (rules_post_payload), więc zdjęcie nazwy nie ma jak ruszyć ani
  // jednego wyzwalacza. `?dev=` celuje w kapsel-cel; SHIM z rf-05 nie dokłada swojego, bo widzi,
  // że zapytanie już je ma.
  setCfgNameOn: function (dev, name, done) {
    const q = (dev && dev !== _trigCfgDev()) ? ("?dev=" + encodeURIComponent(dev)) : "";
    _trigCfgPost("/rules" + q, { configName: String(name || "") }, (err, j) => {
      // Nawet gdy serwer odmówił, hub MUSI się odświeżyć: kafel pokazywałby wtedy chip kapsla,
      // który tej nazwy nie nosi, i wyglądałoby to na zapisane. Odświeżenie cofa go do prawdy.
      if (!err) devEntry(dev || _trigCfgDev()).cfgName = String((j && j.configName) || "");
      else rfToast(err, { tone: "danger" });
      if (typeof done === "function") done();
    });
  },
  setCfgName: function (name, done) {
    return TRIG_CFG_ADAPTER.setCfgNameOn(_trigCfgDev(), name, done);
  },
  fingerprintCurrent: function () { return trigCfgFingerprint(state.rules); },
  // Odcisk WSKAZANEGO kapsla. `null` = jego reguły jeszcze nie dojechały; hub wtedy milczy zamiast
  // stawiać kropkę „zmienione" na podstawie cudzych danych.
  fingerprintOf: function (dev) {
    const rules = _trigCfgRules(dev);
    return (rules === null) ? null : trigCfgFingerprint(rules);
  },
  // `null` = nie da się porównać, bo nie znamy treści presetu (starszy serwer odsyła same nazwy).
  // Pasek wtedy milczy — patrz komentarz przy `st()` w rf-49.
  fingerprintPreset: function (p) {
    return (p && Array.isArray(p.rules)) ? trigCfgFingerprint(p.rules) : null;
  },
  listPresets: function () { return state.trigPresets || []; },
  findPreset: function (name) {
    const k = rfCfgIdKey(name);
    if (!k) return null;
    return (state.trigPresets || []).find(p => rfCfgIdKey(p.name) === k) || null;
  },
  // Zapis idzie tą samą drogą, co „Zapisz" z paska presetów — jeden format pliku i jedna
  // sanityzacja. Nazwa, która już jest, podmienia tamten preset, więc „Zapisz jako…" i „Zapisz
  // zmiany" to ta sama prośba do serwera z inną nazwą.
  saveAs: function (name, done, desc) {
    _trigCfgPost("/profile/save", { name: name, rules: state.rules, desc: String(desc || "") }, (err) => {
      if (err) return done(err);
      loadProfileList(name);   // odświeża state.trigPresets — jeden pobór dla huba i dla Biblioteki
      done(null);
    });
  },
  // ⚠️ NADPISANIE MUSI ODDAĆ OPIS, KTÓRY PRESET JUŻ MA. Zapis idzie jedną drogą z „Zapisz jako…",
  // a ta wysyła `desc` — bez tej linijki „Zapisz zmiany" kasowałoby opis po cichu przy każdym
  // zapisie reguł, i to bez śladu w interfejsie, bo kafel po prostu pokazałby „bez opisu".
  overwrite: function (name, done) {
    const p = TRIG_CFG_ADAPTER.findPreset(name);
    return TRIG_CFG_ADAPTER.saveAs(name, done, (p && p.desc) || "");
  },
  // NADPISANIE SAMYCH METADANYCH: reguły idą te, które preset JUŻ MA, więc poprawka opisu nie ma
  // jak zapisać tego, co ktoś właśnie majstruje na kapslu. Nowa nazwa zapisuje pod nową nazwą —
  // przeniesienie starej pozycji i przepisanie kapsli robi hub, bo to jego wiedza o tym, kto co nosi.
  savePresetMeta: function (p, name, desc, done) {
    _trigCfgPost("/profile/save",
      { name: name, rules: (p && p.rules) || [], desc: String(desc || "") }, (err) => {
        if (err) return done(err);
        done(null);
      });
  },
  deletePreset: function (name, done) {
    _trigCfgPost("/profile/delete", { name: name }, (err) => done(err || null));
  },
  reloadPresets: function (selName) { loadProfileList(selName || ""); },
  // WCZYTANIE NA WSKAZANY KAPSEL. Serwer sam nadaje kapslowi nazwę wczytanego presetu
  // (apply_profile) — odpowiedź jest pierwszym miejscem, gdzie to widać, i wyprzedza rozgłoszenie
  // po strumieniu. `renderRules` tylko dla bieżącego: lista na ekranie jest jego listą.
  applyPresetOn: function (dev, p, done) {
    const q = (dev && dev !== _trigCfgDev()) ? ("?dev=" + encodeURIComponent(dev)) : "";
    _trigCfgPost("/profile/load" + q, { name: p.name }, (err, j) => {
      if (err) return done(err);
      const D = devEntry(dev || _trigCfgDev());
      D.rules = j.rules || [];
      D.cfgName = String(j.configName || p.name || "");
      if ((dev || _trigCfgDev()) === state.activeDeviceId) { state.rules = D.rules; renderRules(); }
      done(null);
    });
  },
  applyPreset: function (p, done) {
    return TRIG_CFG_ADAPTER.applyPresetOn(_trigCfgDev(), p, done);
  },
  // MIGAWKA DO COFNIĘCIA przed wczytaniem. Wyłącznie dla BIEŻĄCEGO kapsla, bo `_rfUndoStash("rules")`
  // pamięta `state.rules` i przywraca je zwykłym POST /rules — czyli zawsze na kapsel, przy którym
  // się stoi. Migawka zrobiona przy wczytaniu na cudzy kapsel przywróciłaby jego reguły NA NASZ,
  // i byłby to najgorszy możliwy rodzaj „Cofnij": taki, który psuje coś innego niż naprawia.
  stashUndo: function (dev) {
    if (dev !== _trigCfgDev() || typeof _rfUndoStash !== "function") return Promise.resolve(false);
    return Promise.resolve(_rfUndoStash("rules")).then(r => r !== false).catch(() => false);
  },
  // KOPIA NA INNY KAPSEL — jedno kliknięcie zamiast trzech kroków przez bibliotekę (zapisz preset →
  // przełącz kapsel → wczytaj). Adres z ?dev= celuje w kapsel-cel; SHIM z rf-05 nie dokłada tu
  // swojego ?dev=, bo widzi, że pytanie już je ma.
  copyTo: function (dev, done) {
    const name = TRIG_CFG_ADAPTER.getCfgName();
    _trigCfgPost("/rules?dev=" + encodeURIComponent(dev),
      { rules: state.rules, configName: name }, (err, j) => {
        if (err) return done(err);
        const D = devEntry(dev);
        D.cfgName = String((j && j.configName) || name || "");
        done(null);
      });
  },
  describeCurrent: function () { return _trigCfgCount((state.rules || []).length); },
  describePreset: function (p) { return _trigCfgCount(((p && p.rules) || []).length); },
  // …i to samo o WSKAZANYM kapslu. Pusto, gdy jego reguły jeszcze nie dojechały — okno pomija
  // wtedy liczbę, zamiast podawać liczbę z kapsla, przy którym akurat stoimy.
  describeDev: function (dev) {
    const rules = _trigCfgRules(dev);
    return (rules === null) ? "" : _trigCfgCount(rules.length);
  },
  describeKeeps: function () {
    return _gl("Przełącznik modułu Mapowanie i aktywna warstwa zostają bez zmian.",
               "The Mapping module switch and the active layer stay as they are.");
  },
  // Co zostaje, gdy z kapsla schodzi sama NAZWA. Zdanie modułu, nie komponentu: hub nie wie, że
  // rzeczy, o których mowa, nazywają się wyzwalaczami.
  describeUnname: function () {
    return _gl("Wyzwalacze zostały bez zmian.", "Its triggers are untouched.");
  },
  // Opis i metryka kafla — to one odróżniają dwa kafle w bibliotece od siebie.
  presetDesc: function (p) { return String((p && p.desc) || ""); },
  presetMetric: function (p) { return _trigCfgCount(((p && p.rules) || []).length); },
  // Limit długości opisu przychodzi z serwera (GET /profiles -> descMax) — jedna liczba dla pliku,
  // listy i pola tekstowego. Wartość zapasowa jest tą samą, którą serwer ma wpisaną na stałe.
  descMax: function () { return +state.trigDescMax || 200; },
  // Czy jest CO zapisać. Zapisanie pustej listy pod nazwą tworzy w bibliotece pozycję, która po
  // wczytaniu kasuje komuś wszystkie wyzwalacze — a wyłączony przycisk z powodem mówi to wcześniej.
  canSaveCurrent: function () {
    const n = (state.rules || []).length;
    return n ? { ok: true, why: "" }
             : { ok: false, why: _gl("Najpierw dodaj wyzwalacz.", "Add a trigger first.") };
  },
  // PUSTA BIBLIOTEKA (UX 261120, P-G1-12). Zamiast pustej wyszukiwarki nad pustą listą i dwóch zdań
  // o tym samym: jedno zdanie i droga z powrotem do kafli startu w Konfiguracji. Czyta to wspólna
  // Biblioteka (rf-49j2 chowa wyszukiwarkę, rf-49j3 rysuje prawy panel), tylko gdy nic nie ma.
  libEmpty: function () {
    return {
      title: _gl("Nie masz jeszcze zapisanych presetów", "You have no saved presets yet"),
      text: _gl("Preset powstaje z wyzwalaczy. Dodaj pierwszy, a potem zapisz go tutaj.",
                "A preset is made of triggers. Add the first one, then save it here."),
      btn: _gl("Wróć i dodaj wyzwalacz", "Go back and add a trigger"),
      run: function () {
        if (typeof rfRevealPane === "function") rfRevealPane(document.getElementById("rulesList"));
        setTimeout(function () {
          const s = document.getElementById("trigStart") || document.getElementById("addRule");
          if (s) try { s.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { }
          const f = document.querySelector("#trigStart [data-tile]");
          if (f) try { f.focus({ preventScroll: true }); } catch (e) { }
        }, 60);
      }
    };
  },
  describeSaveAs: function () {
    return _gl("Kapsel od razu zacznie nosić tę nazwę. Konfiguracja zapamiętuje "
               + _trigCfgCount((state.rules || []).length) + ". "
               + "Przełącznik modułu Mapowanie i aktywna warstwa zostają bez zmian.",
               "The capsule starts carrying that name right away. The configuration remembers "
               + _trigCfgCount((state.rules || []).length) + ". "
               + "The Mapping module switch and the active layer stay as they are.");
  }
};

let _trigCfgHub = null;

// ------------------------------------------------------------------------------------------
//  PODPIĘCIE
// ------------------------------------------------------------------------------------------
// Hub stoi POD nagłówkiem karty i NAD listą wyzwalaczy, bo odpowiada na pytanie zadane
// w nagłówku: skoro to są wyzwalacze tego kapsla, to jak się ten zestaw nazywa, do czego jest
// i kto jeszcze go nosi. Pod listą przeczytałby go tylko ktoś, kto już przewinął czterdzieści reguł.
//
// Woła też PIERWSZY pobór listy presetów. Robił to dawny `initProfiles` (rf-13) razem z podpięciem
// usuniętego rzędu; po jego zniknięciu bez tej linijki hub startowałby pusty i zapełniał się
// dopiero po pierwszym zapisie.
function initTrigCfgHub() {
  const card = document.getElementById("trigCard");
  if (!card || document.getElementById("trigCfgHub")) return;   // brak karty = okno nakładki
  const head = card.querySelector(".head");
  if (!head) return;
  _trigCfgHub = rfCfgHubCreate(TRIG_CFG_ADAPTER);
  head.insertAdjacentHTML("afterend", _trigCfgHub.hubHtml());
  _trigCfgHub.wire();
  if (typeof loadProfileList === "function") loadProfileList();
}

// Jedno wejście dla wszystkich, którzy zmieniają listę: renderRules (każda edycja, przełączenie
// kapsla, wczytanie presetu) i strumień `rules`. Tanie — sync porównuje odcisk całego rysunku
// przed przerysowaniem i przy braku różnicy nie rusza DOM-u (a więc nie zabiera ogniska).
function trigCfgSync() {
  if (_trigCfgHub) _trigCfgHub.sync();
}
