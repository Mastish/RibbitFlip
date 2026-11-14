"use strict";
// ============================================================================
//  TOŻSAMOŚĆ KONFIGURACJI NA KAPSLU — „co ten kapsel ma na sobie"
//
//  SKĄD TO SIĘ WZIĘŁO (2026-08-28): zapis ma się odbywać na kapslu, żeby
//  użytkownik działał na konfiguracjach.
//
//  Do tej pory koło kapsla było BEZIMIENNE. Presety leżały w osobnej bibliotece,
//  wczytanie robiło kopię i na tym związek się kończył — więc na trzy pytania,
//  które zadaje się codziennie, nie było odpowiedzi nigdzie w aplikacji:
//    · co ten kapsel ma na sobie?
//    · czy to jeszcze jest to, co zapisałem, czy już to przerobiłem?
//    · które kapsle mają to samo?
//  A ponieważ każda zmiana zapisuje się od razu, „spróbuję czegoś" na kapslu
//  z gotowym kołem znaczyło „zniszczę to koło", chyba że ktoś PAMIĘTAŁ, żeby
//  wcześniej zrobić preset.
//
//  CO SIĘ ZMIENIA, A CO NIE. Zapis zostaje natychmiastowy (celowo:
//  autozapis + nazwa konfiguracji) i to jest ważniejsze, niż wygląda: panel
//  tego programu nigdy nie może pokazywać czegoś innego, niż kapsel naprawdę
//  wysyła — z tego samego powodu, dla którego nie wolno mieć dwóch kopii
//  aplikacji naraz. Dochodzi więc wyłącznie TOŻSAMOŚĆ: nazwa i odpowiedź na
//  pytanie „czy to jeszcze to samo".
//
//  „ZMIENIONE" JEST WYLICZANE, NIE ZAPISANE. Flaga w pliku rozjeżdża się
//  z prawdą przy pierwszym zapisie, którego nikt nie przewidział; porównanie
//  odcisku koła z odciskiem presetu o tej nazwie nie ma jak skłamać.
//
//  CZEGO ODCISK NIE OBEJMUJE — i to jest cała definicja tego, czym konfiguracja
//  JEST: przełącznika On (uzbrojenie wyjścia to decyzja o tym kapslu w tej
//  chwili) i miejsca wyświetlania (to ustawienie stanowiska pracy, zostaje przy
//  kapslu, celowo).
//
//  CO Z TEGO PLIKU ZNIKŁO 2026-09-02 (audyt UX #25). Cały PASEK AKCJI — „Konfiguracja:
//  [lista] [zmienione] Zapisz zmiany · Zapisz jako… · Przywróć · Skopiuj na…" — razem
//  z czterema działaniami, które tylko on wołał. Nie dlatego, że były złe: dlatego, że
//  odkąd moduł ma wspólną ramkę trzech zakładek, każde z nich stało na ekranie DRUGI RAZ,
//  a dwa identyczne przyciski „Zapisz zmiany" w odległości dziesięciu centymetrów każą
//  zgadywać, który zapisuje co. Zostaje sama TOŻSAMOŚĆ: odcisk, stan, nadanie nazwy
//  i przepięcie kapsli po zmianie nazwy presetu — czyli to, o co pytają pas kafli,
//  Biblioteka modułu i kropka „zmienione" w nawigacji.
//
//  PO rf-46e (bierze z niego zapis presetu i _whExportObj) i rf-46h.
// ============================================================================

// Pary zostały tylko dla tego, co jeszcze jest na ekranie: „zmienione" niesie kropka na kaflu
// kapsla, reszta paska zniknęła 2026-09-02 razem z nim (patrz wheelCapsHtml w rf-46h).
const RF_WHCFG_I18N = {
  "bez nazwy": "unnamed",
  "tej konfiguracji nie ma już na liście": "this configuration is no longer on the list",
};
try { Object.assign(I18N_EN, RF_WHCFG_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

// ------------------------------------------------------------------------------------------
//  ODCISK KOŁA
// ------------------------------------------------------------------------------------------
// Co składa się na „to samo koło". Lista jest DOKŁADNIE tym, co preset niesie ze sobą — jedno
// źródło dla obu stron porównania, bo gdyby odcisk liczył pole, którego preset nie zapisuje,
// każdy kapsel byłby „zmieniony" od chwili wczytania.
const WH_CFG_FIELDS = ["holdMs", "confirm", "confirmMs", "deadzone", "submenuMode", "subOpenMs",
                       "iconChips", "alwaysOn", "trigger", "triggerAxis", "triggerMag"];

function whCfgFingerprint(cfg) {
  const c = cfg || {};
  const look = wheelLook(c.look);
  const walk = (list) => (Array.isArray(list) ? list : []).map(s => ({
    l: String(s.label || ""), s: String(s.spec || ""), q: String(s.sequence || ""),
    i: String(s.icon || ""), c: String(s.color || ""), r: (parseInt(s.rep, 10) || 1),
    k: (s.children && s.children.length) ? walk(s.children) : 0
  }));
  const head = WH_CFG_FIELDS.map(k => {
    const v = c[k];
    // Liczby przez toFixed: suwak potrafi oddać 0.34 i 0.3400000000000001, a to jest ta sama
    // martwa strefa. Bez tego kapsel bywałby „zmieniony" po samym dotknięciu suwaka i powrocie.
    return (typeof v === "number") ? v.toFixed(3) : String(v === undefined ? "" : v);
  }).join("|");
  return head + "|" + [look.size, look.gapDeg, look.corner, look.fontScale || 1]
    .map(n => (+n).toFixed(2)).join(",") + "|" + JSON.stringify(walk(c.slices));
}

// Preset o tej nazwie — albo nic. Szukamy bez względu na wielkość liter, tak samo jak reszta
// biblioteki presetów (_whUserPreset w rf-46e).
function whCfgPreset(name) {
  const k = String(name || "").trim().toLowerCase();
  if (!k) return null;
  return (state.wheelPresets || []).find(p => String(p.name).toLowerCase() === k) || null;
}

// STAN KONFIGURACJI JEDNEGO KAPSLA — jedna odpowiedź dla kafla, paska akcji i listy.
//   name    — jak się nazywa (pusto: koło ułożone ręcznie, nigdy nie zapisane pod nazwą)
//   known   — czy preset o tej nazwie jeszcze istnieje (można go było skasować)
//   dirty   — czy koło różni się od zapisanej wersji
function whCfgState(cfg) {
  const name = String((cfg && cfg.configName) || "").trim();
  if (!name) return { name: "", known: false, dirty: false };
  const p = whCfgPreset(name);
  if (!p) return { name: name, known: false, dirty: false };
  return { name: name, known: true,
           dirty: whCfgFingerprint(cfg) !== whCfgFingerprint(p.config || {}) };
}

// Konfiguracja kapsla, tak jak widzi ją reszta zakładki: edytowany kapsel ma świeższą prawdę
// w karcie niż w ostatnim pakiecie z serwera.
function whCfgOf(dev) {
  if (dev === state.wheelDev && state.wheel) return state.wheel;
  const D = state.devices[dev];
  return (D && D.wheelCfg) || null;
}

function _whCfgT(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }

// ------------------------------------------------------------------------------------------
//  DZIAŁANIA
// ------------------------------------------------------------------------------------------
// Nazwa jedzie do serwera tą samą drogą, co każde inne ustawienie koła (postWheel): jest polem
// konfiguracji kapsla, a nie osobnym magazynem, więc nie ma jak się z nią rozjechać.
function whCfgSetName(name) {
  state.wheel.configName = String(name || "").trim();
  if (typeof postWheel === "function") postWheel();
  // Nazwę pokazują dziś dwa miejsca i oba mają się odświeżyć w tej samej chwili: pas kafli kapsli
  // (rf-46h) i ramka modułu — blok stanu Konfiguracji plus lista Biblioteki (rf-49j przez
  // `wheelCfgColSync`). Do 2026-09-02 stał tu jeszcze `wheelCfgBarSync` od własnego paska koła.
  if (typeof wheelCapsSync === "function") wheelCapsSync();
  if (typeof wheelCfgColSync === "function") wheelCfgColSync();
}

// Które kapsle noszą konfigurację o tej nazwie. Potrzebne w dwóch miejscach: przy nadpisywaniu
// (żeby powiedzieć, kogo jeszcze to dotyczy) i przy zmianie nazwy presetu (patrz whCfgFollowRename).
function _whCfgUsers(name) {
  const k = String(name || "").trim().toLowerCase();
  if (!k) return [];
  return Object.values(state.devices || {}).map(D => (D.meta || {}).dev).filter(d => {
    const c = whCfgOf(d);
    return c && String(c.configName || "").trim().toLowerCase() === k;
  });
}

// ZMIANA NAZWY PRESETU MUSI IŚĆ ZA KAPSLAMI, które go noszą — inaczej po zmianie nazwy każdy z nich
// twierdziłby, że nosi coś, czego nie ma na liście. Wołane z rf-46e po udanej zmianie nazwy.
function whCfgFollowRename(oldName, newName) {
  const users = _whCfgUsers(oldName);
  if (!users.length) return Promise.resolve();
  return Promise.all(users.map(dev => {
    if (dev === state.wheelDev && state.wheel) {
      state.wheel.configName = newName;
      return Promise.resolve(postWheel());
    }
    return fetch("/wheel?dev=" + encodeURIComponent(dev), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configName: newName })
    }).then(r => r.json()).then(m => {
      const D = state.devices[dev];
      if (D && m && !m.error) D.wheelCfg = m;
    }).catch(() => {});
  })).then(() => {
    if (typeof wheelCapsSync === "function") wheelCapsSync();
    if (typeof wheelCfgColSync === "function") wheelCfgColSync();
  });
}

