"use strict";
// ============================================================================
//  CZUJNIK: kapsel nosi NAZWANĄ konfigurację osi 3D
//
//  Adapter wspólnego komponentu tożsamości (rf-49-cfgid.js) dla panelu „Osie 3D".
//  Presety osi istniały tu od dawna (Library/AxisPresets, rząd „🎨 Presety osi" w rf-13), ale
//  wczytanie robiło KOPIĘ i na tym związek się kończył: kapsel po wczytaniu był bezimienny,
//  dokładnie jak Mapowanie przed rf-49b. Trzy pytania nie miały więc odpowiedzi nigdzie
//  w aplikacji: co ten kapsel ma na osiach, czy to jeszcze jest to, co zapisałem, które kapsle
//  mają to samo. Przy dziesięciu łańcuchach strojenia (4 osie filtra + 6 kanałów, po osiem pól
//  każdy) nikt nie sprawdzi tego wzrokiem.
//
//  Rząd „🎨 Presety osi" i rząd „🧲 Kopiuj osie 3D z" ZOSTAJĄ i stoją niżej. To nie jest
//  dublowanie: tam wymienia się PLIKI i ściąga cudze osie, tu nadaje się kapslowi tożsamość.
//  Dokładnie tak samo współistnieją pasek i stary rząd w Mapowaniu.
//
//  Po rf-33 (POSE, poseCfgObj, applyPoseConfig — z nich czyta i przez nie zapisuje), po rf-33b
//  (łańcuchy strojenia) i po rf-49, którego komponent tworzy.
// ============================================================================

// ------------------------------------------------------------------------------------------
//  ODCISK KONFIGURACJI OSI
// ------------------------------------------------------------------------------------------
// Co składa się na „te same osie". Pola wypisane JAWNIE, a nie zebrane z pierwszego lepszego
// obiektu, bo obie strony porównania muszą liczyć dokładnie to samo: kapsel (poseCfgObj z rf-33)
// i preset (`_pose_full_cfg` po stronie serwera). Gdyby odcisk liczył pole, którego preset nie
// niesie — albo pomijał takie, które niesie — każdy kapsel byłby „zmieniony" od chwili wczytania,
// czyli ostrzeżenie świeciłoby zawsze i po tygodniu nikt by go nie czytał.
//
// ⚠️ `cal` (mapa kanałów + znaki) WCHODZI do odcisku. To jest DECYZJA, nie przeoczenie: preset
// osi niesie kalibrację i nakłada ją przy wczytaniu — tak ta funkcja działa od początku i ta
// zmiana tego nie rusza. Reguła serii mówi „odcisk liczy dokładnie to, co preset niesie", więc
// pole niesione przez preset, a pominięte w odcisku, znikałoby po cichu przy „Zapisz zmiany"
// (ta sama pułapka, którą opisuje komentarz przy `oscGroup` w rf-49d). Skutek uboczny jest
// uczciwy: rekalibracja kapsla zapali „zmienione", bo osie naprawdę odbiegły od nazwanej
// konfiguracji.
//   PUNKT DECYZYJNY DLA WŁAŚCICIELA: alternatywą jest wycięcie `cal` z presetu I z odcisku naraz —
//   kalibracja jako cecha EGZEMPLARZA, jak `padShare` przy myszy (cudzy preset z forum niesie
//   wtedy cudzą mapę kanałów, co jest wątpliwe). To zmiana ZACHOWANIA istniejącej funkcji, więc
//   osobna decyzja i osobna zmiana — patrz apply_pose_preset po stronie serwera.
//
// ⚠️ `configName` NIE wchodzi: nazwa stoi na WIERZCHU konfiguracji, a nie w treści, którą opisuje.
const POSE_CFG_TOP_FIELDS = ["resp", "smoothLvl", "mirror", "mode", "gain"];
const POSE_CFG_INV_FIELDS = ["pitch", "roll"];
const POSE_CFG_AXIS_KEYS = ["tilt", "twist", "pitch", "roll"];        // cztery osie filtra 3D
const POSE_CFG_CHAN_KEYS = ["ch0", "ch1", "ch2", "ch3", "ch4", "ch5"];   // sześć surowych kanałów
const POSE_CFG_CHAIN_FIELDS = ["on", "smooth", "smoothMs", "zero", "dead", "inHi", "outHi", "expo"];

// Jedna wartość jako tekst. Liczby przez toFixed, bo suwak czułości potrafi oddać 0.34
// i 0.34000000000000004, a to jest ta sama czułość — bez tego kapsel bywałby „zmieniony" po samym
// dotknięciu suwaka i powrocie na miejsce. Wartość wpisana ręcznie w pole bywa przy tym TEKSTEM
// („0.34"), a ta sama wartość z serwera przychodzi liczbą, więc obie muszą przejść tą samą drogą.
// `smooth` („ema"/„adapt") i `mode` są tekstem, którego nie da się zamienić na liczbę — zostają.
function _poseCfgV(v) {
  if (v === true) return "1";
  if (v === false) return "0";
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return v.toFixed(3);
  const s = String(v);
  return (s !== "" && s.trim() !== "" && !isNaN(+s)) ? (+s).toFixed(3) : s;
}
// Jeden łańcuch strojenia (oś filtra albo kanał) — ta sama ósemka pól po obu stronach.
function _poseCfgChain(a) {
  const o = a || {};
  return POSE_CFG_CHAIN_FIELDS.map(function (k) { return _poseCfgV(o[k]); }).join("|");
}
// Trójka par [kanał, znak] jednej rodziny kalibracji (akcelerometr albo żyroskop).
function _poseCfgPairs(lst) {
  return (Array.isArray(lst) ? lst : []).slice(0, 3).map(function (p) {
    return Array.isArray(p) ? (_poseCfgV(p[0]) + "," + _poseCfgV(p[1])) : "";
  }).join(";");
}
function poseCfgFingerprint(cfg) {
  const o = cfg || {}, inv = o.inv || {}, axes = o.axes || {}, chans = o.chans || {}, cal = o.cal || {};
  return [
    POSE_CFG_TOP_FIELDS.map(function (k) { return _poseCfgV(o[k]); }).join("|"),
    POSE_CFG_INV_FIELDS.map(function (k) { return _poseCfgV(inv[k]); }).join("|"),
    POSE_CFG_AXIS_KEYS.map(function (k) { return _poseCfgChain(axes[k]); }).join("/"),
    POSE_CFG_CHAN_KEYS.map(function (k) { return _poseCfgChain(chans[k]); }).join("/"),
    _poseCfgPairs(cal.acc) + "~" + _poseCfgPairs(cal.gyr)
  ].join("//");
}

// ------------------------------------------------------------------------------------------
//  POMOCNIKI ADAPTERA
// ------------------------------------------------------------------------------------------
// KTÓRY KAPSEL. Zakładka Czujnik pokazuje kapsel OGLĄDANY (state.viewDev), nie ten aktywny do
// edycji wyzwalaczy — i tak samo celują endpointy osi (patrz _VIEW_FETCH w rf-05). POSE.dev jest
// odpowiedzią autorytatywną: mówi, CZYJĄ konfigurację trzyma teraz ten jeden obiekt POSE.
function _poseCfgDev() {
  return (typeof POSE === "object" && POSE.dev)
    || (typeof poseViewDev === "function" ? poseViewDev() : "d0");
}
function _poseCfgD(dev) { return (state.devices || {})[dev || _poseCfgDev()] || {}; }
function _poseCfgDevName(dev) {
  const m = _poseCfgD(dev).meta || {};
  return m.label || m.name || dev;
}
// CZYJĄ konfigurację trzyma teraz POSE. Ta sama bramka, którą pushPoseConfig chroni zapis: panel
// ma JEDEN obiekt na wszystkie kapsle, więc zanim konfiguracja nowego kapsla dojedzie, zapis pod
// jego nazwą zapisałby osie poprzedniego — a tu chodzi o CAŁĄ kalibrację, nie o jedno pokrętło.
function _poseCfgReady() {
  const view = (typeof poseViewDev === "function") ? poseViewDev() : null;
  return !!(typeof POSE === "object" && POSE.dev && (!view || POSE.dev === view));
}
function _poseCfgNotReady() {
  return _gl("Osie tego kapsla jeszcze się wczytują. Spróbuj za chwilę.",
             "This capsule's axes are still loading. Try again in a moment.");
}
function _poseCfgPost(url, body, done) {
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

// Ile osi jest DOSTROJONYCH — po polsku, czyli z odmianą. „5 oś" w oknie, które pyta o zgodę na
// zastąpienie czyjejś pracy, czyta się jak usterka i odbiera oknu powagę.
function _poseCfgAxCount(n) {
  n = +n || 0;
  if (typeof _lang !== "undefined" && _lang === "en") return n + (n === 1 ? " tuned axis" : " tuned axes");
  if (n === 1) return "1 dostrojona oś";
  const d = n % 10, h = n % 100;
  return n + ((d >= 2 && d <= 4 && !(h >= 12 && h <= 14)) ? " dostrojone osie" : " dostrojonych osi");
}
// Dwa miejsca po przecinku i przecinek, jak plakietki nad panelem — „0,9" obok pola „0.90" czyta
// się jak dwie różne wartości.
function _poseCfgNum(v) { return (+v || 0).toFixed(2).replace(".", ","); }
// Co ta konfiguracja ROBI, w jednym kawałku zdania („…zostanie zastąpione (czułość 0,34 · …)").
// Mapa kanałów jest tu, bo to ona decyduje, czy kula w ogóle odda położenie kapsla — a przy kopii
// na inny kapsel jest jedyną rzeczą, którą warto zobaczyć PRZED kliknięciem.
function _poseCfgWhat(cfg) {
  const o = cfg || {}, cal = o.cal || {};
  const chs = function (lst) {
    return (Array.isArray(lst) ? lst : []).slice(0, 3)
      .map(function (p) { return Array.isArray(p) ? ("CH" + p[0]) : "?"; }).join("·");
  };
  const tuned = POSE_CFG_AXIS_KEYS.filter(function (k) { return ((o.axes || {})[k] || {}).on; }).length
              + POSE_CFG_CHAN_KEYS.filter(function (k) { return ((o.chans || {})[k] || {}).on; }).length;
  return _gl("czułość ", "responsiveness ") + _poseCfgNum(o.resp)
    + _gl(" · wychylenie ×", " · deflection ×") + _poseCfgNum(o.gain)
    + _gl(" · akcel ", " · accel ") + chs(cal.acc) + _gl(" · żyro ", " · gyro ") + chs(cal.gyr)
    + (tuned ? (" · " + _poseCfgAxCount(tuned)) : "");
}

// ------------------------------------------------------------------------------------------
//  GDZIE MIESZKA NAZWA
// ------------------------------------------------------------------------------------------
// Nazwa jest polem KONFIGURACJI POZY, a ta mieszka na dysku (Settings/…/ribbitflip_pose.json) —
// silnik trzyma z niej tylko to, co realnie liczy (wzmocnienie, czułość, łańcuchy), więc GET /pose
// składa odpowiedź z pliku. W panelu odkładamy ją przy kapslu (`D.poseCfgName`), a nie w POSE:
// POSE jest JEDEN na wszystkie kapsle i przy przełączeniu jest najpierw zasypywany podręczną kopią
// z localStorage, która nazwy nie zna — nazwa mrugałaby wtedy na pusto przy każdym przełączeniu.
// Przy okazji to samo pole odpowiada na pytanie „kto jeszcze nosi tę konfigurację" dla kapsli,
// których nikt teraz nie edytuje.
function poseCfgAdopt(cfg, dev) {
  const D = (typeof devEntry === "function") ? devEntry(dev || _poseCfgDev()) : null;
  if (D) D.poseCfgName = String((cfg && cfg.configName) || "");
  poseCfgSync();
}
// Nadanie kapslowi nazwy BEZ ruszania osi. Wysyłamy SAMĄ nazwę, nie całe poseCfgObj():
// _sanitize_pose_cfg po stronie serwera SCALA (dotyka wyłącznie kluczy, które przyszły), więc
// zdjęcie podpisu nie ma prawa przepisać dziesięciu łańcuchów strojenia. pushPoseConfig() wysyła
// całość i jest do czego innego — do zapisywania zmian w osiach.
function poseCfgTakeName(name, done) {
  if (!_poseCfgReady()) {
    rfToast(_poseCfgNotReady(), { tone: "danger" });
    if (typeof done === "function") done();
    return;
  }
  const dev = _poseCfgDev();
  _poseCfgPost("/pose?dev=" + encodeURIComponent(dev), { configName: String(name || "") },
    function (err, j) {
      // Nawet po odmowie pasek MUSI się odświeżyć (poseCfgAdopt robi to sam): lista pokazywałaby
      // wtedy nazwę, której kapsel nie nosi, i wyglądałoby to na zapisane.
      if (err) { rfToast(err, { tone: "danger" }); poseCfgSync(); }
      else poseCfgAdopt(j, dev);
      if (typeof done === "function") done();
    });
}

// ------------------------------------------------------------------------------------------
//  ADAPTER
// ------------------------------------------------------------------------------------------
const POSE_CFG_ADAPTER = {
  idPrefix: "pose",
  // „Konfiguracja:” zderzało się z pod-zakładką modułu o tej nazwie (słownik UX 261120): ustawienia
  // jednego modułu to preset, jak w Usługach (rf-49n).
  barLabel: "Preset:",
  getDev: _poseCfgDev,
  devName: _poseCfgDevName,
  listOtherDevs: function () {
    const cur = _poseCfgDev();
    return Object.values(state.devices || {})
      .map(function (D) { return (D.meta || {}).dev; })
      .filter(function (d) { return d && d !== cur; });
  },
  getCfgName: function (dev) { return String(_poseCfgD(dev).poseCfgName || ""); },
  setCfgName: function (name, done) { poseCfgTakeName(name, done); },
  fingerprintCurrent: function () {
    return poseCfgFingerprint(typeof poseCfgObj === "function" ? poseCfgObj() : null);
  },
  // `null` = nie da się porównać, bo nie znamy treści presetu (starszy serwer odsyła same nazwy).
  // Pasek wtedy milczy — patrz komentarz przy `st()` w rf-49.
  fingerprintPreset: function (p) {
    return (p && p.config && typeof p.config === "object") ? poseCfgFingerprint(p.config) : null;
  },
  // Lista presetów osi: JEDEN pobór dla paska i dla starego rzędu „🎨 Presety osi" — rf-13
  // wypełnia state.posePresets treścią i woła poseCfgSync. Treść, nie same nazwy, bo „zmienione"
  // to porównanie dwóch stron (patrz `fingerprintPreset`).
  listPresets: function () { return state.posePresets || []; },
  findPreset: function (name) {
    const k = rfCfgIdKey(name);
    if (!k) return null;
    return (state.posePresets || []).find(function (p) {
      return rfCfgIdKey(p.name) === k;
    }) || null;
  },
  // Zapis idzie tą samą drogą, co „Zapisz" ze starego rzędu presetów — jeden format pliku i jedna
  // sanityzacja (serwer wycina nazwę z treści, patrz `_pose_full_cfg`), więc „Zapisz jako…"
  // i „Zapisz zmiany" to ta sama prośba do serwera z inną nazwą.
  saveAs: function (name, done) {
    if (!_poseCfgReady()) return done(_poseCfgNotReady());
    _poseCfgPost("/pose-preset/save?dev=" + encodeURIComponent(_poseCfgDev()),
      { name: name, config: poseCfgObj() }, function (err) {
        if (err) return done(err);
        loadPosePresetList(name);   // odświeża listę dla OBU pasków (rf-13 wypełnia state.posePresets)
        done(null);
      });
  },
  overwrite: function (name, done) { return POSE_CFG_ADAPTER.saveAs(name, done); },
  applyPreset: function (p, done) {
    _poseCfgPost("/pose-preset/load?dev=" + encodeURIComponent(_poseCfgDev()),
      { name: p.name }, function (err, j) {
        if (err) return done(err);
        // Serwer sam nadaje kapslowi nazwę wczytanego presetu (apply_pose_preset), a odpowiedź jest
        // pierwszym miejscem, gdzie to widać. applyPoseConfig NIE odsyła niczego z powrotem —
        // serwer zapisał już aktywną konfigurację, więc zostaje podręczna kopia i przerysowanie.
        if (j && j.config) {
          applyPoseConfig(j.config);
          poseCfgAdopt(j.config);
        }
        done(null);
      });
  },
  // KOPIA NA INNY KAPSEL — jedno kliknięcie zamiast trzech kroków (zapisz preset → przełącz kapsel
  // → wczytaj). Idzie TĄ SAMĄ drogą, którą panel zapisuje osie, tylko z adresem wycelowanym w cel:
  // POST /pose?dev=<cel> z pełnym poseCfgObj(). Odwrócenie istniejącego „🧲 Kopiuj osie 3D z"
  // (GET /pose?dev=źródło → applyPoseConfig → zapis u siebie) byłoby tu nieprzenośne, bo tamta
  // ścieżka przechodzi przez POSE — czyli przez obiekt należący do kapsla OGLĄDANEGO. Musiałaby
  // więc na chwilę załadować cudzą konfigurację do panelu i odłożyć ją z powrotem, a każdy błąd
  // w połowie zostawiałby na ekranie osie kapsla, którego nikt nie ogląda. Jeden POST nie ma
  // takiego stanu pośredniego. SHIM z rf-05 nie dokłada tu swojego ?dev=, bo widzi, że pytanie
  // już je ma.
  copyTo: function (dev, done) {
    if (!_poseCfgReady()) return done(_poseCfgNotReady());
    const body = poseCfgObj();
    body.configName = POSE_CFG_ADAPTER.getCfgName();
    _poseCfgPost("/pose?dev=" + encodeURIComponent(dev), body, function (err, j) {
      if (err) return done(err);
      // Kopia nazwy przy kapslu-celu — żeby „tej konfiguracji używa też…" mówiło prawdę od razu,
      // a nie dopiero po następnym wejściu na tamten kapsel.
      poseCfgAdopt(j, dev);
      done(null);
    });
  },
  describeCurrent: function () {
    return _poseCfgWhat(typeof poseCfgObj === "function" ? poseCfgObj() : null);
  },
  describePreset: function (p) { return _poseCfgWhat(p && p.config); },
  // Konfiguracja osi nie niesie ŻADNEGO przełącznika — nie ma tu czego uzbroić, więc zdanie o tym,
  // co zostaje, mówi o czymś innym: o kalibracji, która JEDZIE razem z konfiguracją. To jedyna
  // rzecz, która potrafi zaskoczyć („wczytałem czyjeś osie i kula oszalała"), więc stoi wprost.
  describeKeeps: function () {
    return _gl("Kalibracja (mapa kanałów) jedzie razem z konfiguracją; wybór podglądu i wyśrodkowanie zostają bez zmian.",
               "The calibration (channel map) travels with the configuration; the preview choice and the recentre stay as they are.");
  }
};

let _poseCfgBar = null;

// ------------------------------------------------------------------------------------------
//  PODPIĘCIE
// ------------------------------------------------------------------------------------------
// Pasek stoi POD nagłówkiem „Osie 3D" i NAD samym panelem (a więc i nad rzędami
// „🎨 Presety osi" oraz „🧲 Kopiuj osie 3D z", które zostają na dole). Odpowiada na pytanie zadane
// w nagłówku: skoro to jest konfiguracja osi tego kapsla, to jak się nazywa i czy jest jeszcze
// taka, jak zapisana. Pod panelem przeczytałby go tylko ktoś, kto zjechał przez trzy sekcje
// i dziesięć łańcuchów strojenia.
//
// Wstawiony jako RODZEŃSTWO panelu, nie do jego środka: renderPoseCal() podmienia całe wnętrze
// `.posecal` przy każdym przerysowaniu (zmiana języka, przełączenie kapsla), więc pasek w środku
// znikałby razem z uchwytami zdarzeń. Dokładnie z tego powodu siedzą tam rzędy presetów.
function initPoseCfgBar() {
  const fold = document.getElementById("poseCalFold");
  if (!fold || document.getElementById("poseCfgBar")) return;   // brak zakładki = okno nakładki
  const box = fold.querySelector(".posecal");
  if (!box) return;
  _poseCfgBar = rfCfgIdCreate(POSE_CFG_ADAPTER);
  box.insertAdjacentHTML("beforebegin", _poseCfgBar.barHtml());
  _poseCfgBar.wire();
  // Własny pobór listy, choć initPosePresets robi to samo chwilę wcześniej. Świadomie: pasek nie
  // ma prawa zależeć od KOLEJNOŚCI w rf-40-boot — bez listy nie ma czym porównać i milczałby
  // o „zmienione" do pierwszej operacji presetowej. Jedno dodatkowe GET na starcie jest tańsze
  // niż ta cicha awaria.
  loadPosePresetList();
}

// Jedno wejście dla wszystkich, którzy zmieniają osie: savePoseCal (każde pokrętło, suwak
// i pole panelu), loadPoseForDevice (przełączenie kapsla i pierwszy odczyt z serwera) oraz
// operacje presetowe w rf-13. Tanie — sync porównuje HTML przed podmianą.
function poseCfgSync() {
  if (!_poseCfgBar) return;
  _poseCfgBar.sync();
  _poseCfgPrime();
}

// Kto jeszcze nosi tę konfigurację. Nazwy pozostałych kapsli nie przychodzą żadnym strumieniem
// (konfiguracja osi nie jest rozgłaszana), więc dociągamy je zwykłym GET /pose — RAZ na kapsel co
// _POSE_CFG_PRIME_MS. Odstęp jest tu obowiązkowy, a nie ozdobny: sync() leci przy KAŻDYM ruchu
// suwaka, więc bez niego jedno przeciągnięcie myszą wysłałoby setki pytań.
const _POSE_CFG_PRIME_MS = 10000;
const _poseCfgPrimed = {};
function _poseCfgPrime() {
  const cur = _poseCfgDev(), now = Date.now();
  for (const D of Object.values(state.devices || {})) {
    const dev = D && D.meta && D.meta.dev;
    if (!dev || dev === cur) continue;
    if (_poseCfgPrimed[dev] && now - _poseCfgPrimed[dev] < _POSE_CFG_PRIME_MS) continue;
    _poseCfgPrimed[dev] = now;
    (function (id) {
      fetch("/pose?dev=" + encodeURIComponent(id)).then(function (r) { return r.json(); })
        .then(function (cfg) {
          const E = devEntry(id);
          const was = E.poseCfgName;
          E.poseCfgName = String((cfg && cfg.configName) || "");
          if (was !== E.poseCfgName && _poseCfgBar) _poseCfgBar.sync();
        })
        .catch(function () { /* kapsel bez zapisanych osi — nie ma tu czego policzyć */ });
    })(dev);
  }
}
