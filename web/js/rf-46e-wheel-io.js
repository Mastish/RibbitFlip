"use strict";
// ===================== KOŁO WYBORU — PRESETY I ZAPIS =====================
// Wszystko, co wnosi albo wynosi CAŁĄ zawartość koła: rozmowa z magazynem presetów, wczytanie,
// import i cofnięcie ustawień do domyślnych. Osobny plik, bo każda z tych rzeczy zmienia wszystko
// naraz i potrzebuje okna z pytaniem — a rf-46b ma być kartą, nie magazynem dialogów. Same okna
// i wymiana przez Discorda siedzą jeszcze dalej, w rf-46f.
//
// ⚠️ SIATKI KAFLI PRESETÓW W KARCIE JUŻ NIE MA (2026-09-02, audyt UX #25/#26). Presety pokazuje
// wyłącznie zakładka „Biblioteka" modułu — ta sama, którą ma pozostałych siedem modułów; ten plik
// jest jej ZAPLECZEM (magazyn, sanityzacja, wczytanie, import), a nie drugim widokiem. Co dokładnie
// zniknęło i dokąd się przeniosło, mówi komentarz przy `whInitIo` na dole.
//
// PRESET = CAŁE KOŁO POD NAZWĄ (dawne zestawy startowe; preset
// da się zapisać, wyeksportować i udostępnić, np. na Discordzie). Preset niesie DOKŁADNIE to, co
// eksport JSON (bez przełącznika On), bo to jest ta sama rzecz: jedna kopia zostaje u siebie,
// druga idzie na forum.
//
// JEDNA LISTA, NIE DWIE (2026-08-27). Do tej pory gotowe koła stały w osobnej sekcji
// „Przykładowe" — wpisane na sztywno w TEN plik — a własne przychodziły z serwera. Dwie listy
// tego samego rodzaju rzeczy każą pamiętać, w której czego szukać, a przy szesnastu presetach
// odpowiedź „w tej drugiej" nie jest odpowiedzią. Teraz fabryczne są ZWYKŁYMI presetami: serwer
// zasiewa je do magazynu przy pierwszym uruchomieniu (WHEEL_FACTORY w ribbitflip_monitor.py),
// stoją w swoich kategoriach obok cudzych i różnią się jedną plakietką.
//
// CO Z NIMI WOLNO: wczytać, zapisać jako swoje, wyeksportować, wysłać na forum i USUNĄĆ. Tego
// ostatniego celowo — preset, którego nie da się skasować, jest śmieciem w cudzej liście. Wracają
// przyciskiem „Przywróć fabryczne", nie same przy aktualizacji.
//
// ⚠️ PRESET NADPISUJE WYCINKI, więc pyta. Nie rusza przełącznika On: uzbrojenie wyjścia jest
// decyzją o TYM kapslu w TEJ chwili, a nie czymś, co wolno zrobić plikowi.
// Podpowiedzi kategorii w oknie zapisu. Startowe, nie zamknięte: kto sortuje presety po grach,
// po pokojach albo po rękach, nie znajdzie swojego słowa na naszej liście.
const WH_CAT_HINTS = ["Multimedia", "Gry", "Praca", "Dostępność", "Własne"];
const WH_CAT_NONE = "Bez kategorii";

// Ustawienia, które „Przywróć domyślne" cofa. WYCINKÓW TU NIE MA i to jest cała treść tej decyzji:
// przycisk obok napisu „Zapis" nie ma prawa skasować godziny układania listy. Wycinki wymienia się
// świadomie, presetem, który pyta.
const WH_DEFAULTS = {
  holdMs: 300, confirm: "release", confirmMs: 600, deadzone: WHEEL_DEAD_DEF,
  submenuMode: "replace", subOpenMs: 300, iconChips: false, alwaysOn: true,
  trigger: "button", triggerAxis: "any", triggerMag: 0.55,
  look: { size: WHEEL_SIZE_DEF, gapDeg: WHEEL_GAP_DEF, corner: WHEEL_CORNER_DEF,
          fontScale: WHEEL_FONT_DEF },
};

// MOJE PRESETY żyją na serwerze (Settings/ribbitflip_wheel_presets.json), wspólne dla wszystkich
// kapsli. Tu leży tylko kopia do rysowania — źródłem prawdy jest odpowiedź serwera, tak samo jak
// przy konfiguracji koła.
state.wheelPresets = [];

// SEKCJA „ZAPIS". Dwa przyciski i dwie różne rzeczy — nazwane tak, żeby dało się je odróżnić bez
// klikania (audyt UX #27/#38, 2026-09-02):
//   · „Przywróć domyślne" nazywało się tak samo jak „Przywróć" z bloku stanu (odrzuć zmiany)
//     i jak „Przywróć fabryczne" z listy presetów. Trzy różne „Przywróć" na jednym ekranie.
//     Teraz mówi wprost, CO cofa i czego NIE rusza, a zdanie pod spodem to powtarza.
//   · „Eksportuj JSON" zniknął: ten sam plik pobiera się z Biblioteki („Pobierz"), a wklejenie
//     cudzego zostaje tutaj, bo Biblioteka nie ma pola na wklejanie.
function whSaveSecHtml() {
  return `<div class="wh-bar wh-bar-wrap">
      <button class="btn sm" id="whImport" title="Wklej JSON koła albo preset z forum. Preset wyląduje w zakładce „Biblioteka”, koło wczytasz od razu.">Importuj JSON</button>
      <button class="btn sm" id="whReset" title="Cofnij ustawienia koła do domyślnych: sposób sterowania, czasy, martwą strefę, kształt podmenu i wygląd. Lista wycinków zostaje nietknięta.">Ustawienia domyślne (wycinki zostają)</button>
    </div>
    <!-- BEZ AKAPITU POD PRZYCISKAMI (2026-09-04): oba przyciski niosą pełne dymki, a akapit
         powtarzał je w dziesięciu linijkach. Formaty importu tłumaczy zakładka ℹ. -->`;
}

// ------------------------------------------------------------------------------------------
//  MOJE PRESETY — rozmowa z serwerem
// ------------------------------------------------------------------------------------------
function whPresetsFetch() {
  return fetch("/wheelpresets").then(r => r.json()).then(m => {
    if (m && Array.isArray(m.presets)) {
      state.wheelPresets = m.presets;
      _whPresetsPainted();
    }
    return m;
  }).catch(() => null);
}

// KTO RYSUJE LISTĘ PRESETÓW. Od 2026-09-02 jedno miejsce: zakładka „Biblioteka" modułu (rf-49j
// przez adapter rf-46k). `wheelCfgColSync` jest funkcją, którą rf-49j opakowuje przy montażu ramki,
// więc jej wywołanie przerysowuje listę, panel opisu i blok stanu naraz — a przed montażem jest
// pustą funkcją i nic nie kosztuje.
function _whPresetsPainted() {
  if (typeof wheelCfgColSync === "function") wheelCfgColSync();
}

// Jedno wejście do zapisu, zmiany nazwy i usunięcia: wszystkie trzy odpowiadają CAŁĄ listą, więc
// karta rysuje się z odpowiedzi serwera, a nie z tego, co miała nadzieję zapisać.
function _whPresetPost(path, body, onDone) {
  return fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => r.json()).then(m => {
    if (m && Array.isArray(m.presets)) { state.wheelPresets = m.presets; _whPresetsPainted(); }
    if (onDone) onDone(m || {});
    return m;
  }).catch(() => {
    if (onDone) onDone({ ok: false, error: _wheelT("Nie udało się porozmawiać z aplikacją.",
      "Could not reach the application.") });
    return null;
  });
}

// Kategorie, które JUŻ są u tego człowieka, plus nasze propozycje. Kolejność: swoje pierwsze —
// kto raz nazwał grupę po swojemu, drugi raz szuka tej samej nazwy, a nie naszej.
function whPresetCats() {
  const seen = [];
  (state.wheelPresets || []).forEach(p => {
    const c = String(p.category || "").trim();
    if (c && seen.indexOf(c) < 0) seen.push(c);
  });
  WH_CAT_HINTS.forEach(c => { if (seen.indexOf(c) < 0) seen.push(c); });
  return seen;
}

// ------------------------------------------------------------------------------------------
//  KAFLE
// ------------------------------------------------------------------------------------------
// Ile wycinków naprawdę niesie preset — razem z tymi w podmenu, bo to o nich pyta się „ile tego
// jest". Przyjmuje listę wycinków albo cały preset.
function _whPresetCount(p) {
  let n = 0;
  const walk = (list) => (list || []).forEach(s => { n++; if (s.children) walk(s.children); });
  walk(Array.isArray(p) ? p : (p.slices || (p.config && p.config.slices)));
  return n;
}

// ------------------------------------------------------------------------------------------
//  WCZYTANIE
// ------------------------------------------------------------------------------------------
// JEDNA DROGA WCZYTANIA dla wszystkich presetów — fabryczne przychodzą z tego samego magazynu, co
// własne, więc druga funkcja byłaby drugą odpowiedzią na to samo pytanie. (Nazwa `whApplyPreset`
// została jako alias: woła ją poradnik i test zakładki.)
function whApplyPreset(name) { return whApplyUserPreset(name); }

function whApplyUserPreset(name) {
  const p = _whUserPreset(name); if (!p) return;
  _whPresetAsk(p.name, p.config || {});
}

function _whUserPreset(name) {
  const k = String(name || "").toLowerCase();
  return (state.wheelPresets || []).find(p => String(p.name).toLowerCase() === k) || null;
}

// Pytanie przed nadpisaniem mówi, CO zniknie i CO zostaje — „na pewno?" bez treści zmusza do
// zgadywania, a zgadywanie przy nadpisywaniu listy kończy się jednym sposobem.
// ⚠️ LICZBY WYCINKÓW IDĄ PRZEZ `whCountLabel` (rf-46b) — jedno zdanie w całym module. Okno mówiło
// „7 wycinków", a pas kafli o tym samym kole „4 wycinki"; obie liczby były prawdziwe, ale różne
// (audyt UX #31). Teraz obie strony pytania mówią „4 wycinki (+3 w podmenu)".
function _whPresetAsk(name, cfg) {
  const had = state.wheel.slices || [];
  const go = () => _whPresetApply(cfg, name);
  if (!had.length) return go();   // nie ma czego nadpisać — pytanie byłoby pytaniem o nic
  const full = !!(cfg && (cfg.confirm || cfg.look));
  _whAsk(_wheelT("Wczytać preset „" + name + "”?", "Load the preset “" + name + "”?"),
    _wheelT("Wszystkie wycinki tego kapsla (" + whCountLabel(had) + ") zostaną zastąpione presetem "
      + name + " (" + whCountLabel((cfg && cfg.slices) || []) + ")."
      + (full ? " Preset niesie też sposób sterowania, czasy, martwą strefę i wygląd — one też się zmienią." : "")
      + " Przełącznik On zostaje bez zmian.",
      "Every slice on this capsule (" + whCountLabel(had) + ") will be replaced by the "
      + name + " preset (" + whCountLabel((cfg && cfg.slices) || []) + ")."
      + (full ? " The preset also carries the way the wheel is worked, the timings, the dead zone and the look — those change too." : "")
      + " The On switch stays as it is."),
    _wheelT("Wczytaj preset", "Load the preset"), go);
}

// Wczytanie presetu: kopia GŁĘBOKA i tylko te pola, które preset naprawdę niesie. Wbudowane niosą
// same wycinki, więc po nich sposób sterowania i wygląd zostają takie, jakie były — dokładnie tak,
// jak działały zestawy startowe.
// ⚠️ `showWhere` NIE JEST NA TEJ LIŚCIE (celowo: zostaje przy kapslu).
// Miejsce wyświetlania to ustawienie STANOWISKA PRACY, a nie koła: przy jednym komputerze koło ma
// wyskakiwać przy kursorze, przy drugim leżeć w nakładce nad grą. Preset, który to ze sobą wiózł,
// po cichu przenosił komuś koło w inne miejsce ekranu — zmiana, o którą nikt nie prosił, wczytując
// „Multimedia". Serwer wycina to pole z presetów po swojej stronie (sanitize_wheel_preset).
const WH_PRESET_KEYS = ["holdMs", "confirm", "confirmMs", "deadzone",
                        "submenuMode", "subOpenMs", "iconChips", "alwaysOn",
                        "trigger", "triggerAxis", "triggerMag"];
function _whPresetApply(cfg, label) {
  const W = state.wheel, src = cfg || {};
  if (Array.isArray(src.slices)) W.slices = JSON.parse(JSON.stringify(src.slices));
  WH_PRESET_KEYS.forEach(k => { if (src[k] !== undefined && src[k] !== null) W[k] = src[k]; });
  // KAPSEL ZACZYNA NOSIĆ TĘ KONFIGURACJĘ (rf-46j). Bez tego wczytanie robiło anonimową kopię
  // i po chwili nikt nie umiał powiedzieć, skąd to koło się wzięło ani czy jest jeszcze takie samo.
  if (label) W.configName = String(label);
  if (src.look) W.look = wheelLook(src.look);
  state.wheelPath = [];
  state.wheelFocus = -1;
  whRenderSlices(); whSync();
  if (src.look && typeof whPushWinSize === "function") whPushWinSize();
  if (typeof whStageReset === "function") whStageReset();
  postWheel();
  whToast(_wheelT("Wczytano preset: " + label, "Loaded the preset: " + label));
}

// ------------------------------------------------------------------------------------------
//  ZAPIS, NAZWA, USUNIĘCIE
// ------------------------------------------------------------------------------------------
// Co idzie do presetu: dokładnie to, co eksport JSON — bez `enabled`. Jedna definicja „całego
// koła" na obie drogi, żeby preset i plik z forum nigdy nie znaczyły dwóch różnych rzeczy.
function _whExportObj() {
  const W = state.wheel;
  // BEZ `showWhere` I BEZ `configName`: pierwsze należy do kapsla (patrz WH_PRESET_KEYS), drugie
  // stoi na presecie na wierzchu jako jego nazwa — schowana w środku druga rozjechałaby się z nią
  // przy pierwszej zmianie nazwy.
  return {
    holdMs: W.holdMs, confirm: W.confirm, confirmMs: W.confirmMs, deadzone: W.deadzone,
    submenuMode: W.submenuMode, subOpenMs: W.subOpenMs,
    iconChips: W.iconChips, alwaysOn: W.alwaysOn !== false,
    trigger: W.trigger || "button", triggerAxis: W.triggerAxis || "any",
    triggerMag: +W.triggerMag || 0.55, look: wheelLook(W.look),
    slices: JSON.parse(JSON.stringify(W.slices || [])),
  };
}

// Preset w postaci, w jakiej jedzie na serwer i na forum: nazwa, kategoria, konfiguracja.
function whPresetObj(name, cat, cfg) {
  return { name: String(name || ""), category: String(cat || ""),
           config: cfg || _whExportObj() };
}

// ------------------------------------------------------------------------------------------
//  IMPORT
// ------------------------------------------------------------------------------------------
// IMPORT IDZIE PRZEZ SERWER, a nie przez przeglądarkę. Ta sama sanityzacja, która pilnuje zwykłego
// zapisu, ma obciąć cudzy plik: dłuższe nazwy, akcje „layer:", czwarty poziom drzewa i siedemnasty
// wycinek. Karta rysuje się z ODPOWIEDZI, więc pokazuje to, co naprawdę zostało zapisane, a nie to,
// co wkleiła ręka.
//
// DWA KSZTAŁTY W JEDNYM POLU. Z forum przychodzi PRESET ({name, category, config}), a z eksportu
// tej karty CAŁE KOŁO ({slices, …}). Rozpoznajemy je po kształcie — tak samo jak import zestawów
// rozpoznaje swoje cztery rodzaje plików — i traktujemy inaczej: koło wczytuje się od razu (o to
// prosi ten, kto je wkleił), a preset ląduje w zakładce „Biblioteka" i CZEKA. Cudzy plik nie ma prawa
// podmienić koła, którego ktoś właśnie używa; wczytanie presetu to osobna, świadoma decyzja.
function _whImport(raw, onErr) {
  let data;
  try { data = JSON.parse(raw); }
  catch (err) {
    onErr(_wheelT("To nie jest poprawny JSON: ", "That is not valid JSON: ") + err.message);
    return;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    onErr(_wheelT("Oczekiwano obiektu z polem „slices” albo presetu z polami „name” i „config”.",
      "Expected an object with a “slices” field, or a preset with “name” and “config”."));
    return;
  }
  // PRESET Z FORUM — do biblioteki modułu, nie na koło.
  if (data.config && typeof data.config === "object" && !Array.isArray(data.config)) {
    if (!Array.isArray(data.config.slices) || !data.config.slices.length) {
      onErr(_wheelT("Preset nie ma wycinków (pole „config.slices”).",
        "The preset has no slices (the “config.slices” field)."));
      return;
    }
    _whPresetPost("/wheelpresets",
      whPresetObj(data.name || _wheelT("Preset z forum", "Preset from the forum"),
        data.category || "", data.config), (m) => {
        if (!m.ok) { onErr(m.error || _wheelT("Serwer odmówił zapisu.", "The server refused the save.")); return; }
        // „Biblioteka", nie „Moje presety": sekcja o tej nazwie zniknęła z karty 2026-09-02, a
        // komunikat ma nazywać miejsce, do którego człowiek zaraz pójdzie (zakładka modułu).
        whToast(_wheelT("Preset trafił do zakładki „Biblioteka”",
          "The preset went to the “Library” tab"));
        onErr(null);
      });
    return;
  }
  if (!Array.isArray(data.slices) || !data.slices.length) {
    onErr(_wheelT("Brakuje listy wycinków (pole „slices”) albo jest pusta.",
      "The list of slices (the “slices” field) is missing or empty."));
    return;
  }
  const dev = state.wheelDev;
  if (!dev || dev !== (state.activeDeviceId || "d0")) {
    onErr(_wheelT("Konfiguracja tego kapsla jeszcze się wczytuje — spróbuj za chwilę.",
      "This capsule's configuration is still loading — try again in a moment."));
    return;
  }
  // PRZEŁĄCZNIK ON ZOSTAJE TAKI, JAKI BYŁ. Wklejony plik nie ma prawa uzbroić wyjścia: w symulacji
  // pierwsze włączenie przechodzi przez osobne pytanie (rfSimConfirmOn), a import ominąłby je.
  const body = Object.assign({}, data, { enabled: !!state.wheel.enabled });
  fetch("/wheel?dev=" + encodeURIComponent(dev), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => r.json()).then(m => {
    if (!m || m.error) {
      onErr(m && m.error ? m.error : _wheelT("Serwer odmówił zapisu.", "The server refused the save."));
      return;
    }
    onWheelCfg(m);
    whToast(_wheelT("Wczytano konfigurację koła", "Wheel configuration loaded"));
    onErr(null);
  }).catch(() => onErr(_wheelT("Nie udało się porozmawiać z aplikacją.",
    "Could not reach the application.")));
}

// ------------------------------------------------------------------------------------------
//  START
// ------------------------------------------------------------------------------------------
// ⚠️ CO STĄD ZNIKŁO 2026-09-02 (audyt UX #25/#26/#38): uchwyty SIATKI KAFLI PRESETÓW
// (`#whPresetTiles`, `#whPresetSave`, `#whPresetFactory`) razem z samą siatką i jej oknami.
// Tamta sekcja stała w zakładce Konfiguracja i pokazywała TE SAME presety, co Biblioteka modułu —
// z inną plakietką i innym kompletem akcji. Wczytanie, zapis pod nazwą, zmiana nazwy, usunięcie,
// pobranie JSON-a i wysłanie na forum robi dziś Biblioteka (rf-49j2/rf-49j3 przez adapter rf-46k),
// a „↺ Przywróć fabryczne" — jedyna akcja, której wspólny komponent nie zna — stoi w nagłówku jej
// listy (`whMountLibFactory` w rf-46k) i woła stąd `whRestoreFactory`.
// Znikł też „Eksportuj JSON": ten sam plik pobiera się z Biblioteki przyciskiem „Pobierz", a trzy
// drogi do jednego pliku to trzy miejsca, w których trzeba sprawdzić, czy dają to samo.
function whInitIo() {
  const $ = id => document.getElementById(id);
  // IMPORT ZOSTAJE TUTAJ i jest jedyną drogą WKLEJENIA treści: Biblioteka umie pobrać plik, ale nie
  // ma pola na wklejenie cudzego JSON-a, a zakładka „Zestawy" przyjmuje pliki przeciągnięciem.
  const im = $("whImport");
  if (im) im.onclick = () => _whJsonDlg(
    _wheelT("Wklej koło albo preset (JSON)", "Paste a wheel or a preset (JSON)"), "", true);
  const rs = $("whReset");
  if (rs) rs.onclick = () => _whAsk(
    _wheelT("Przywrócić ustawienia domyślne?", "Restore the default settings?"),
    _wheelT("Sposób sterowania, wszystkie czasy, martwa strefa, kształt podmenu i wygląd wrócą do wartości domyślnych. WYCINKI ZOSTAJĄ — ta lista nie jest ustawieniem.",
      "The way the wheel is worked, all the timings, the dead zone, the submenu shape and the look go back to their defaults. THE SLICES STAY — that list is not a setting."),
    _wheelT("Przywróć ustawienia", "Restore the settings"), () => {
      Object.assign(state.wheel, JSON.parse(JSON.stringify(WH_DEFAULTS)));
      state.wheel.look = wheelLook(state.wheel.look);
      whSync();
      if (typeof whPushWinSize === "function") whPushWinSize();
      postWheel();
      whToast(_wheelT("Przywrócono ustawienia domyślne", "Default settings restored"));
    });
  whPresetsFetch();
}

// „PRZYWRÓĆ FABRYCZNE". Bez pytania, bo nie ma o co pytać: DOKŁADA brakujące i nie dotyka ani
// jednego cudzego presetu. Odpowiedź mówi, ile ich wróciło — „zrobione" bez liczby przy pełnej
// liście wyglądałoby jak awaria. Wołane z przycisku w nagłówku listy Biblioteki (rf-46k).
function whRestoreFactory() {
  return _whPresetPost("/wheelpresets/factory", {}, (m) => {
    const n = +(m && m.added) || 0;
    whToast(n
      ? _wheelT("Przywrócono presety fabryczne: " + n, "Factory presets restored: " + n)
      : _wheelT("Wszystkie presety fabryczne już są na liście",
        "Every factory preset is already on the list"));
  });
}

