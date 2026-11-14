"use strict";
// ============================================================================
//  MYSZ: kapsel nosi NAZWANY profil sterowania ruchem
//
//  Adapter HUBA KONFIGURACJI (rf-49i-cfghub.js) dla karty „Mysz". Sterowanie ruchem było JEDYNYM
//  modułem bez presetów: ponad sto pokręteł, jeden zestaw na kapsel i żadnego sposobu, żeby mieć
//  „Precyzję przy głowie" obok „FPS szybkiego" — ani żeby odpowiedzieć na pytanie „czy to jeszcze
//  jest to, co wczoraj ustawiłem". Strojenie myszy jest przy tym najbardziej osobiste w całej
//  aplikacji: to samo biurko, ta sama ręka, inna gra.
//
//  ⚠️ CIENKI PASEK (rf-49) ZNIKNĄŁ Z MYSZY 2026-08-28. Mechanika została w całości — zmienił się
//  kształt. Zarzut wobec paska: „prosty, nieczytelny i ukryty pasek […] a nie wybór
//  z biblioteki i nie jest świadomy user, że konfiguruje dany aktywny preset z autozapisem czy
//  wymagając zapisu". Hub odpowiada na te trzy zarzuty kaflem z OPISEM, chipami kapsli (z kropką
//  „zmienione" przy każdym z osobna) i zdaniem, które wykłada model zapisu wprost. Ten plik został
//  warstwą logiki: odcisk, zapisy, wczytania — a metody z sufiksem `On`/`Of` pytają o WSKAZANY
//  kapsel, bo hub rysuje chipy wszystkich, nie tylko bieżącego.
//
//  GRANICA PROFILU — jedna decyzja, którą najłatwiej tu zgubić, więc stoi na wierzchu jako
//  MOUSE_CFG_SKIP. Profil niesie ZACHOWANIE; przy kapslu zostaje wszystko, co jest decyzją
//  o TYM kapslu przy TYM biurku. Lista i uzasadnienia niżej, przy samej stałej — po stronie
//  serwera to samo mieszka w MOUSE_PRESET_SKIP i obie strony muszą mówić to samo, bo inaczej
//  odcisk liczyłby pole, którego preset nie niesie, i kapsel byłby „zmieniony" od chwili
//  wczytania (patrz dwie zasady w nagłówku rf-49).
//
//  Po rf-15 (MOUSE_KEYS, state.mouse, onMouseCfg) i po rf-31* (karta Mysz), bo z nich czyta;
//  po rf-49 (rfCfgIdState/rfCfgIdCarriers) i rf-49i (fabryka huba). Sam nic nie renderuje.
// ============================================================================

// Tytuł sekcji jedzie do DOM-u jako zwykły tekst, więc tłumaczy go chodzik i18n — para MUSI być
// w I18N_EN, inaczej po przełączeniu na angielski zostanie polska nazwa sekcji.
// „Sterowania ruchem", a nie „Myszy": to JEDEN silnik na kapsel i jeden profil, tylko pokazany
// w dwóch zakładkach (Mysz i Kontroler). Ktoś, kto stroi drążek, ma zobaczyć, że to jego też dotyczy.
try {
  Object.assign(I18N_EN, {
    "Konfiguracje sterowania ruchem": "Motion-control configurations",
  });
} catch (e) { /* i18n jeszcze nie ma */ }

// ------------------------------------------------------------------------------------------
//  CZEGO PROFIL NIE NIESIE
// ------------------------------------------------------------------------------------------
// Lustro MOUSE_PRESET_SKIP z serwera. Każda pozycja z powodem, bo za pół roku „czemu obszar
// kursora nie wchodzi do presetu" będzie pytaniem bez odpowiedzi:
const MOUSE_CFG_SKIP = [
  // Uzbrojenie wyjścia. Konfiguracja nie niesie przełączników — o tym, czy ruch WOLNO wysyłać,
  // decyduje człowiek przy przełączniku, nie plik (patrz apply_setup i test_setup_switches.py).
  "enabled",
  // Na którym wirtualnym kontrolerze ten kapsel gra. Topologia sprzętu, nie strojenie: profil
  // wczytany na drugim kapslu przepiąłby go cudzemu padowi. Odpowiednik `showWhere` w kole.
  "padShare",
  // OBSZAR KURSORA to STANOWISKO PRACY, nie ustawienie myszy: profil zapisany przy trzech
  // ekranach wyprowadziłby kursor poza laptopa, a nazwa monitora (\\.\DISPLAY2) na innej
  // maszynie znaczy inny ekran albo nic.
  "mouseArea", "mouseMonitor", "mouseAreaWork", "mouseAreaPad",
  "mouseRectX", "mouseRectY", "mouseRectW", "mouseRectH",
  // Nazwa stoi na WIERZCHU (pasek + nazwa pliku), nie w treści, którą opisuje.
  "configName"
];

// Pola odcisku = dokładnie to, co profil niesie I co panel w ogóle widzi. Liczone leniwie
// z MOUSE_KEYS (rf-15), a nie wypisane drugi raz z ręki: state.mouse jest przebudowywane
// WYŁĄCZNIE z tamtej listy, więc pole spoza niej miałoby po odświeżeniu wartość domyślną
// i kapsel twierdziłby „zmienione" na wieki, choć nikt niczego nie ruszył.
//
// Poza odciskiem zostają przez to DWA pola zgodnościowe, których panel nie ma na liście:
// `dpadThreshold` i `dpadHyst`. To wsad migracji krzyżaka sprzed „pełne wychylenie + strefa
// martwa" — silnik czyta je WYŁĄCZNIE wtedy, gdy w konfiguracji nie ma `dpadInner`, a profil
// zawsze ją niesie. Nie da się ich zmienić z panelu, więc różnica w nich nie jest zmianą,
// której ktoś tu szuka; pominięcie idzie w bezpieczną stronę (nigdy fałszywe „zmienione").
let _mouseCfgFieldsCache = null;
function _mouseCfgFields() {
  if (!_mouseCfgFieldsCache) {
    _mouseCfgFieldsCache = (typeof MOUSE_KEYS !== "undefined" ? MOUSE_KEYS : [])
      .filter(function (k) { return MOUSE_CFG_SKIP.indexOf(k) < 0; });
  }
  return _mouseCfgFieldsCache;
}

// Jedna wartość jako tekst. Liczby przez toFixed, bo suwak potrafi oddać 30 i 30.000000000004,
// a to jest ta sama czułość — bez tego kapsel bywałby „zmieniony" po samym dotknięciu suwaka
// i powrocie na miejsce. Pole liczbowe z formularza bywa przy tym TEKSTEM („30"), a to samo pole
// z serwera przychodzi liczbą (30.0), więc obie strony muszą przejść tą samą drogą.
function _mouseCfgV(v) {
  if (v === true) return "1";
  if (v === false) return "0";
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return v.toFixed(3);
  const s = String(v);
  return (s !== "" && s.trim() !== "" && !isNaN(+s)) ? (+s).toFixed(3) : s;
}
function mouseCfgFingerprint(cfg) {
  const o = cfg || {};
  return _mouseCfgFields().map(function (k) { return _mouseCfgV(o[k]); }).join("|");
}

// ------------------------------------------------------------------------------------------
//  POMOCNIKI ADAPTERA
// ------------------------------------------------------------------------------------------
function _mouseCfgDev() { return state.activeDeviceId || "d0"; }
function _mouseCfgD(dev) { return state.devices[dev || _mouseCfgDev()] || {}; }
function _mouseCfgDevName(dev) {
  const m = _mouseCfgD(dev).meta || {};
  return m.label || m.name || dev;
}
// CZYJĄ konfigurację trzyma teraz state.mouse. Ta sama bramka, którą postMouse chroni zapis:
// panel ma JEDEN obiekt na wszystkie kapsle, więc zanim konfiguracja nowego kapsla dojedzie,
// zapis pod jego nazwą zapisałby ustawienia poprzedniego.
function _mouseCfgReady() {
  return !!state.mouseDev && state.mouseDev === _mouseCfgDev();
}
function _mouseCfgNotReady() {
  return _gl("Ustawienia tego kapsla jeszcze się wczytują. Spróbuj za chwilę.",
             "This capsule's settings are still loading. Try again in a moment.");
}
// Konfiguracja BEZ tego, co zostaje przy kapslu. Tyle jedzie w kopii na inny kapsel; serwer i tak
// odcina te klucze przy zapisie presetu, ale kopia idzie zwykłym POST /airmouse, który niczego nie
// odcina — i dobrze, bo to jest ta sama droga, którą zapisuje panel.
function _mouseCfgBehaviour() {
  const src = state.mouse || {}, out = {};
  _mouseCfgFields().forEach(function (k) { if (src[k] !== undefined) out[k] = src[k]; });
  return out;
}
// Co ta konfiguracja ROBI, w jednym kawałku zdania („…zostanie zastąpione (kursor z filtra 3D)").
// Źródło czytamy z trybu, który jest włączony — mysz, drążek i krzyżak mają własne.
function _mouseCfgWhat(cfg) {
  const o = cfg || {};
  const mode = (o.mode === "stick") ? _gl("drążek", "the stick")
             : (o.mode === "dpad") ? _gl("krzyżak", "the d-pad")
             : _gl("kursor", "the cursor");
  const src = (o.mode === "stick") ? o.stickSource : (o.mode === "dpad") ? o.dpadSource : o.mouseSource;
  const from = (src === "axis") ? _gl("z osi", "from a raw axis") : _gl("z filtra 3D", "from the 3D filter");
  const dwell = (o.mode !== "stick" && o.mode !== "dpad" && o.dwellOn)
    ? _gl(", klik bez klikania", ", clicking without clicking") : "";
  return mode + " " + from + dwell;
}
// METRYKA KAFLA — dwa słowa, które odróżniają dwa profile na jednym ekranie: dokąd idzie ruch
// i czy kursor klika sam. Krócej niż `_mouseCfgWhat`, bo tamto zdanie stoi w oknie, gdzie jest
// miejsce na źródło („z filtra 3D"), a kafel ma się przeczytać wzrokiem obok nazwy i opisu.
function _mouseCfgMetric(cfg) {
  const o = cfg || {};
  const mode = (o.mode === "stick") ? _gl("drążek", "stick")
             : (o.mode === "dpad") ? _gl("krzyżak", "d-pad")
             : _gl("kursor", "cursor");
  const dwell = (o.mode !== "stick" && o.mode !== "dpad" && o.dwellOn)
    ? " · " + _gl("klika sam", "clicks by itself") : "";
  return mode + dwell;
}
function _mouseCfgPost(url, body, done) {
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

// LISTA PROFILÓW — jeden pobór dla huba i dla Biblioteki. Treść i OPIS, nie same nazwy:
// „zmienione" to porównanie dwóch stron (patrz `fingerprintPreset`), a kafel pokazuje obok nazwy
// zdanie autora. Starszy serwer odsyła same nazwy — wtedy hub nie ma czego porównać i milczy,
// co jest lepsze niż drugie zapytanie, które też by nie zadziałało.
function loadMousePresets(done) {
  return fetch("/mouse-presets").then(function (r) { return r.json(); })
    .then(function (j) {
      state.mousePresets = (j && Array.isArray(j.items)) ? j.items
        : (((j && j.presets) || []).map(function (n) { return { name: n, config: null, desc: "" }; }));
      // Ile znaków może mieć opis — z serwera, żeby pole tekstowe nie trzymało własnej kopii limitu.
      if (j && j.descMax != null) state.mouseDescMax = +j.descMax || 0;
      mouseCfgSync();
      if (typeof done === "function") done();
    })
    .catch(function () { if (typeof done === "function") done(); });
}

// KONFIGURACJA KAPSLA, KTÓREGO NIKT NIE EDYTUJE. W panelu mieszka tylko ta AKTYWNA (state.mouse),
// a hub rysuje chip KAŻDEGO kapsla — z kropką „zmienione" liczoną z jego własnych ustawień.
// Wolny, throttlowany GET dokładnie w kształcie `_midiCfgOther` (rf-49d) i `ovMotionCfg` (rf-12):
// to jest KONFIGURACJA, zmienia się, gdy ktoś ją zmieni, nie pięćdziesiąt razy na sekundę.
//
// ⚠️ WŁASNY OBIEG, CHOĆ ŚCIĄGA CZYTA TO SAMO. Kusi, żeby po prostu zawołać `ovMotionCfg(D)` —
// pisze w to samo pole (D.mouseCfg) i też jest throttlowana. Ale jej odpowiedź ląduje po cichu:
// nikomu nie mówi, że przyjechała. Dla ściągi to bez znaczenia (rysuje co klatkę), dla huba
// znaczyłoby, że kafle stoją z wczorajszym rysunkiem do najbliższej zmiany czegokolwiek innego.
// Stąd `mouseCfgSync()` w odpowiedzi. Oba obiegi trafiają w to samo pole, więc ściąga korzysta
// z naszych odpowiedzi tak samo, jak my z jej — nakładają się tylko wtedy, gdy ktoś patrzy na
// ściągę, i wtedy niosą identyczne dane.
//
// Do czasu odpowiedzi `null`, czyli „nie wiadomo" — kropka postawiona na cudzym kapslu z pamięci
// bieżącego byłaby kłamstwem, którego nikt by nie wykrył.
const _mouseCfgAsk = {};
function _mouseCfgOther(dev) {
  const D = _mouseCfgD(dev);
  const t = (typeof performance !== "undefined" ? performance.now() : Date.now());
  if (!(_mouseCfgAsk[dev] > t - 10000)) {
    _mouseCfgAsk[dev] = t;
    fetch("/airmouse?dev=" + encodeURIComponent(dev)).then(function (r) { return r.json(); })
      .then(function (m) {
        if (!m || m.error) return;
        devEntry(dev).mouseCfg = m;
        mouseCfgSync();
      }).catch(function () {});
  }
  return D.mouseCfg || null;
}
// Ustawienia WSKAZANEGO kapsla, albo `null`, gdy jeszcze nie wiadomo. Bieżący ma je w state.mouse —
// ale TYLKO wtedy, gdy state.mouse naprawdę jest jego (ta sama bramka, którą postMouse chroni
// zapis): zaraz po przełączeniu kapsla panel trzyma jeszcze konfigurację poprzedniego, a odcisk
// z niej policzony zapaliłby kropkę „zmienione" na kapslu, którego nikt nie tknął.
function _mouseCfgOf(dev) {
  if (!dev || dev === _mouseCfgDev()) return _mouseCfgReady() ? (state.mouse || null) : null;
  return _mouseCfgOther(dev);
}

// ------------------------------------------------------------------------------------------
//  ADAPTER
// ------------------------------------------------------------------------------------------
const MOUSE_CFG_ADAPTER = {
  idPrefix: "mouse",
  hubTitle: "Konfiguracje sterowania ruchem",
  getDev: _mouseCfgDev,
  devName: _mouseCfgDevName,
  // Kolejność stała (po id gniazda), bo to ona decyduje, gdzie na kaflu stoi chip — a kafel, na
  // którym chipy skaczą przy każdym odświeżeniu, jest kaflem nie do przeciągnięcia.
  listAllDevs: function () { return Object.keys(state.devices || {}).sort(); },
  listOtherDevs: function () {
    const cur = _mouseCfgDev();
    return MOUSE_CFG_ADAPTER.listAllDevs().filter(function (d) { return d !== cur; });
  },
  // Nazwa jest polem configu, więc dla EDYTOWANEGO kapsla przychodzi tą samą drogą co reszta
  // (GET /airmouse przy przełączeniu, potem strumień `mouse_cfg`). Konfiguracja kapsla, którego
  // nikt nie edytuje, nie mieszka w panelu w ogóle — czytamy tę samą wolną kopię, z której ściąga
  // rysuje cudze drążki (D.mouseCfg), i to SAMO CZYTANIE ją zamawia. Bez tego kapsel bez kopii
  // nigdy by jej nie dostał: pusta nazwa kończy `rfCfgIdState` przed pytaniem o odcisk, więc
  // zamówienie schowane w `fingerprintOf` nigdy by nie padło.
  // Przy pustej kopii mówimy „nie wiem" (pusto), a nie „nie nosi nazwy" — hub użyje tego tylko do
  // ustawienia chipa w tacce, a ten wróci na kafel, gdy tylko odpowiedź dojedzie.
  getCfgName: function (dev) {
    const cur = _mouseCfgDev();
    if (!dev || dev === cur) return String((state.mouse || {}).configName || "");
    const o = _mouseCfgOther(dev);
    return String((o && o.configName) || "");
  },
  // NAZWA NA WSKAZANYM KAPSLU. Sama nazwa, nie całe state.mouse: set_config po stronie serwera
  // SCALA (dotyka wyłącznie kluczy, które przyszły), więc zdjęcie podpisu nie ma prawa przepisać
  // stu pokręteł. postMouse() wysyła całość i jest do czego innego — do zapisywania ustawień.
  // `?dev=` celuje w kapsel-cel; SHIM z rf-05 nie dokłada swojego, bo widzi, że zapytanie już je ma.
  //
  // Bramka „konfiguracja jeszcze się wczytuje" dotyczy WYŁĄCZNIE bieżącego kapsla, i to nie
  // dlatego, że wysyłamy z niej cokolwiek (lecie sama nazwa), tylko dlatego, że po sukcesie
  // dopisujemy odpowiedź do `state.mouse` — a ten obiekt bywa przez chwilę cudzy.
  setCfgNameOn: function (dev, name, done) {
    const cur = _mouseCfgDev();
    const target = dev || cur;
    if (target === cur && !_mouseCfgReady()) {
      rfToast(_mouseCfgNotReady(), { tone: "danger" }); if (done) done(); return;
    }
    _mouseCfgPost("/airmouse?dev=" + encodeURIComponent(target),
      { configName: String(name || "") }, function (err, j) {
        // Nawet po odmowie hub MUSI się odświeżyć: kafel pokazywałby wtedy chip kapsla, który tej
        // nazwy nie nosi, i wyglądałoby to na zapisane. Odświeżenie cofa go do prawdy.
        if (err) rfToast(err, { tone: "danger" });
        else if (target === cur) state.mouse.configName = String((j && j.configName) || "");
        else {
          const D = devEntry(target);
          if (D) D.mouseCfg = Object.assign({}, D.mouseCfg || {}, j || {});
        }
        if (typeof done === "function") done();
      });
  },
  setCfgName: function (name, done) {
    return MOUSE_CFG_ADAPTER.setCfgNameOn(_mouseCfgDev(), name, done);
  },
  fingerprintCurrent: function () { return mouseCfgFingerprint(state.mouse); },
  // Odcisk WSKAZANEGO kapsla. `null` = jego ustawienia jeszcze nie dojechały (albo state.mouse
  // należy chwilowo do poprzedniego kapsla); hub wtedy milczy zamiast stawiać kropkę „zmienione"
  // na podstawie cudzych danych.
  fingerprintOf: function (dev) {
    const cfg = _mouseCfgOf(dev);
    return cfg ? mouseCfgFingerprint(cfg) : null;
  },
  // `null` = nie da się porównać, bo nie znamy treści profilu (starszy serwer odsyła same nazwy).
  // Pasek wtedy milczy — patrz komentarz przy `st()` w rf-49.
  fingerprintPreset: function (p) {
    return (p && p.config && typeof p.config === "object") ? mouseCfgFingerprint(p.config) : null;
  },
  listPresets: function () { return state.mousePresets || []; },
  findPreset: function (name) {
    const k = rfCfgIdKey(name);
    if (!k) return null;
    return (state.mousePresets || []).find(function (p) {
      return rfCfgIdKey(p.name) === k;
    }) || null;
  },
  // Zapis i nadpisanie to ta sama prośba z inną nazwą — jeden format pliku i jedna sanityzacja
  // (serwer odcina MOUSE_PRESET_SKIP), więc „Zapisz jako…" i „Zapisz zmiany" nie mogą się rozjechać.
  saveAs: function (name, done, desc) {
    if (!_mouseCfgReady()) return done(_mouseCfgNotReady());
    _mouseCfgPost("/mouse-preset/save",
      { name: name, config: state.mouse, desc: String(desc || "") }, function (err) {
        if (err) return done(err);
        loadMousePresets(function () { done(null); });
      });
  },
  // ⚠️ NADPISANIE MUSI ODDAĆ OPIS, KTÓRY PRESET JUŻ MA. Zapis idzie jedną drogą z „Zapisz jako…",
  // a ta wysyła `desc` — bez tej linijki „Zapisz zmiany" kasowałoby opis po cichu przy każdym
  // zapisie ustawień, i to bez śladu w interfejsie, bo kafel po prostu pokazałby „bez opisu".
  overwrite: function (name, done) {
    const p = MOUSE_CFG_ADAPTER.findPreset(name);
    return MOUSE_CFG_ADAPTER.saveAs(name, done, (p && p.desc) || "");
  },
  // NADPISANIE SAMYCH METADANYCH: ustawienia idą te, które preset JUŻ MA, więc poprawka opisu nie
  // ma jak zapisać tego, co ktoś właśnie majstruje na kapslu. Nowa nazwa zapisuje pod nową nazwą —
  // przeniesienie starej pozycji i przepisanie kapsli robi hub, bo to jego wiedza o tym, kto co nosi.
  savePresetMeta: function (p, name, desc, done) {
    _mouseCfgPost("/mouse-preset/save",
      { name: name, config: (p && p.config) || {}, desc: String(desc || "") }, function (err) {
        done(err || null);
      });
  },
  deletePreset: function (name, done) {
    _mouseCfgPost("/mouse-preset/delete", { name: name }, function (err) { done(err || null); });
  },
  reloadPresets: function () { loadMousePresets(); },
  // WCZYTANIE NA WSKAZANY KAPSEL. Serwer sam nadaje kapslowi nazwę wczytanego profilu
  // (apply_mouse_preset), a odpowiedź jest pierwszym miejscem, gdzie to widać — wyprzedza
  // rozgłoszenie po strumieniu. Przełącznik sterowania ruchem, przypisanie kapsla-CELU do pada
  // i jego obszar kursora zostają jego własne: preset ich nie niesie (MOUSE_PRESET_SKIP), a serwer
  // scala. To jest granica z etapu 2 i hub mówi o niej w oknie przez `describeKeeps()`.
  applyPresetOn: function (dev, p, done) {
    const cur = _mouseCfgDev();
    const target = dev || cur;
    _mouseCfgPost("/mouse-preset/load?dev=" + encodeURIComponent(target),
      { name: p.name }, function (err, j) {
        if (err) return done(err);
        if (target === cur) {
          // `arrived=true`, bo to wymiana CAŁEGO zachowania: kapsel, który wraca w trybie drążka,
          // ma od razu pokazać tę połowę zakładki Kontroler, a nie tę, którą ktoś przeglądał.
          if (j && j.config) onMouseCfg(j.config, true);
        } else if (j && j.config) {
          // Wolna kopia konfiguracji tamtego kapsla — żeby chip przeskoczył na nowy kafel od razu,
          // a nie dopiero po następnym jej odświeżeniu (do trzech sekund później).
          const D = devEntry(target);
          if (D) D.mouseCfg = Object.assign({}, j.config);
        }
        done(null);
      });
  },
  applyPreset: function (p, done) {
    return MOUSE_CFG_ADAPTER.applyPresetOn(_mouseCfgDev(), p, done);
  },
  // MIGAWKA DO COFNIĘCIA przed wczytaniem. Wyłącznie dla BIEŻĄCEGO kapsla, bo `_rfUndoStash("mouse")`
  // pamięta `state.mouse` i przywraca je zwykłym POST /airmouse — czyli zawsze na kapsel, przy
  // którym się stoi. Migawka zrobiona przy wczytaniu na cudzy kapsel przywróciłaby jego ustawienia
  // NA NASZ, i byłby to najgorszy możliwy rodzaj „Cofnij": taki, który psuje coś innego niż naprawia.
  stashUndo: function (dev) {
    if (dev !== _mouseCfgDev() || !_mouseCfgReady() || typeof _rfUndoStash !== "function") {
      return Promise.resolve(false);
    }
    return Promise.resolve(_rfUndoStash("mouse")).then(function (r) { return r !== false; })
      .catch(function () { return false; });
  },
  // KOPIA NA INNY KAPSEL — jedno kliknięcie zamiast trzech kroków przez Bibliotekę (zapisz →
  // przełącz kapsel → wczytaj). Adres z ?dev= celuje w kapsel-cel; SHIM z rf-05 nie dokłada tu
  // swojego ?dev=, bo widzi, że pytanie już je ma. Lecą TYLKO pola zachowania, więc przełącznik,
  // pad i obszar kursora kapsla-celu zostają jego własne (set_config scala).
  //
  // ⚠️ HUB TEGO NIE WOŁA (przeciągnięcie chipa WCZYTUJE nazwaną konfigurację, a to co innego niż
  // przepisanie surowych ustawień). Zostaje razem z odpowiednikiem w rf-49b, bo jest jedyną drogą
  // na przeniesienie konfiguracji BEZ nazwy — usunięcie tego kodu zamknęłoby ją, zanim ktokolwiek
  // zdecydował, że ma być zamknięta.
  copyTo: function (dev, done) {
    if (!_mouseCfgReady()) return done(_mouseCfgNotReady());
    const body = _mouseCfgBehaviour();
    body.configName = MOUSE_CFG_ADAPTER.getCfgName();
    _mouseCfgPost("/airmouse?dev=" + encodeURIComponent(dev), body, function (err, j) {
      if (err) return done(err);
      // Wolna kopia konfiguracji tamtego kapsla — żeby „tej konfiguracji używa też…" mówiło
      // prawdę od razu, a nie dopiero po następnym jej odświeżeniu.
      const D = devEntry(dev);
      if (D && j) D.mouseCfg = Object.assign({}, D.mouseCfg || {}, j);
      done(null);
    });
  },
  describeCurrent: function () { return _mouseCfgWhat(state.mouse); },
  describePreset: function (p) { return _mouseCfgWhat(p && p.config); },
  // …i to samo o WSKAZANYM kapslu. Pusto, gdy jego ustawienia jeszcze nie dojechały — okno pomija
  // wtedy opis, zamiast podawać opis kapsla, przy którym akurat stoimy.
  describeDev: function (dev) {
    const cfg = _mouseCfgOf(dev);
    return cfg ? _mouseCfgWhat(cfg) : "";
  },
  // „Sterowanie ruchem", a nie „Mysz": to JEDEN silnik na kapsel i jeden przełącznik, tylko
  // pokazany w dwóch zakładkach (Mysz i Kontroler). Profil niesie obie połowy, więc zdanie o tym,
  // co zostaje, musi być prawdziwe także dla kogoś, kto stroi drążek. To jest GRANICA PROFILU
  // wyłożona człowiekowi: hub wkleja to zdanie do okna wczytania zaraz po nazwie kapsla-celu.
  describeKeeps: function () {
    return _gl("Przełącznik sterowania ruchem, przypisanie kapsla do pada i obszar kursora zostają bez zmian.",
               "The motion-control switch, the capsule's controller and the cursor area stay as they are.");
  },
  // Co zostaje, gdy z kapsla schodzi sama NAZWA. Zdanie modułu, nie komponentu: hub nie wie, że
  // rzeczy, o których mowa, są ustawieniami ruchu.
  describeUnname: function () {
    return _gl("Ustawienia ruchu zostały bez zmian.", "Its motion settings are untouched.");
  },
  // Opis i metryka kafla — to one odróżniają dwa kafle w bibliotece od siebie.
  presetDesc: function (p) { return String((p && p.desc) || ""); },
  presetMetric: function (p) { return _mouseCfgMetric(p && p.config); },
  // Limit długości opisu przychodzi z serwera (GET /mouse-presets -> descMax) — jedna liczba dla
  // pliku, listy i pola tekstowego. Wartość zapasowa jest tą samą, którą serwer ma wpisaną na stałe.
  descMax: function () { return +state.mouseDescMax || 200; },
  // Czy jest CO zapisać. Ustawienia ruchu nigdy nie są „puste" (silnik zawsze ma komplet pokręteł),
  // więc jedyne, co tu blokuje, to konfiguracja jeszcze w drodze — zapisana pod nazwą byłaby
  // konfiguracją POPRZEDNIEGO kapsla, a to jest błąd, którego nikt by potem nie rozpoznał.
  canSaveCurrent: function () {
    return _mouseCfgReady() ? { ok: true, why: "" } : { ok: false, why: _mouseCfgNotReady() };
  },
  describeSaveAs: function () {
    return _gl("Kapsel od razu zacznie nosić tę nazwę. Konfiguracja zapamiętuje ustawienia ruchu ("
               + _mouseCfgWhat(state.mouse) + "). "
               + "Przełącznik sterowania ruchem, przypisanie kapsla do pada i obszar kursora zostają bez zmian.",
               "The capsule starts carrying that name right away. The configuration remembers the motion settings ("
               + _mouseCfgWhat(state.mouse) + "). "
               + "The motion-control switch, the capsule's controller and the cursor area stay as they are.");
  }
};

let _mouseCfgHub = null;

// ------------------------------------------------------------------------------------------
//  PODPIĘCIE
// ------------------------------------------------------------------------------------------
// Hub stoi POD nagłówkiem karty i NAD paskiem kalibracji, bo odpowiada na pytanie zadane
// w nagłówku: skoro to są ustawienia ruchu tego kapsla, to jak się ten zestaw nazywa, do czego jest
// i kto jeszcze go nosi. Niżej przeczytałby go tylko ktoś, kto zjechał przez trzy zwoje pokręteł.
//
// JEDEN hub na dwie zakładki, i to jest świadome: silnik ruchu jest jeden na kapsel, więc profil
// niesie i mysz, i drążek, i krzyżak. Postawienie drugiego huba w karcie Kontroler obiecywałoby
// dwa niezależne profile tam, gdzie jest jeden — jeśli okaże się, że stroiciele pada go tam szukają,
// właściwym ruchem jest LUSTRO tego samego stanu, nie druga konfiguracja. (MIDI/OSC ma dwa huby
// właśnie dlatego, że tam obie zakładki są równorzędne — patrz rf-49d.)
function initMouseCfgHub() {
  const card = document.getElementById("mouseCard");
  if (!card || document.getElementById("mouseCfgHub")) return;   // brak karty = okno nakładki
  const head = card.querySelector(".head");
  if (!head) return;
  _mouseCfgHub = rfCfgHubCreate(MOUSE_CFG_ADAPTER);
  head.insertAdjacentHTML("afterend", _mouseCfgHub.hubHtml());
  _mouseCfgHub.wire();
  loadMousePresets();
}

// Jedno wejście dla wszystkich, którzy zmieniają ustawienia: mFill (przerysowanie panelu, czyli
// też strumień `mouse_cfg` i przełączenie kapsla) oraz commitMouse (pokrętła, które panelu nie
// przerysowują). Tanie — sync porównuje odcisk całego rysunku przed przerysowaniem i przy braku
// różnicy nie rusza DOM-u (a więc nie zabiera ogniska z listy, w której ktoś właśnie stoi).
function mouseCfgSync() {
  // To samo wejście przerysowuje też układ karty: suwak wychylenia, podsumowanie „Dostrajania
  // ruchu" i warunki pudełek (rf-31e). Przed strażnikiem huba, bo układ nie zależy od biblioteki.
  if (typeof mMouseLayoutSync === "function") try { mMouseLayoutSync(); } catch (e) { }
  if (!_mouseCfgHub) return;
  _mouseCfgHub.sync();
  _mouseCfgPrime();
}

// Kto jeszcze nosi ten profil i czy jego kapsel ma kropkę „zmienione". Konfiguracje pozostałych
// kapsli zamawiamy Z WYPRZEDZENIEM: hub rysuje chip każdego kapsla, a czekanie na sieć w chwili
// rysowania znaczyłoby, że kafle dojeżdżają jeden po drugim na oczach patrzącego. Throttle siedzi
// w `_mouseCfgOther`, więc wołanie tego „na wszelki wypadek" nic nie kosztuje.
function _mouseCfgPrime() {
  const cur = _mouseCfgDev();
  for (const D of Object.values(state.devices || {})) {
    if (!D || !D.meta || !D.meta.dev || D.meta.dev === cur) continue;
    try { _mouseCfgOther(D.meta.dev); } catch (e) { /* kapsel bez metadanych — nic do policzenia */ }
  }
}
