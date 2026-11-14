"use strict";
// ==================================================================================================
//  CO STRACISZ, JEŚLI TO WCZYTASZ — pytanie zadawane PRZED wczytaniem zestawu
//
//  SKĄD TO SIĘ WZIĘŁO (2026-09-13): „przed wczytaniem dobrze byłoby poinformować
//  użytkownika, że wczytanie nadpisze obecne niezapisane zmiany na modułach i czy chce wczytać,
//  albo może zapisać".
//
//  CZEGO BRAKOWAŁO. Presety JEDNEGO modułu mają to pytanie od dawna (`rfCfgIdAskLoad` w rf-49:
//  „to, co masz teraz, zostanie zastąpione… zmiany nie są nigdzie zapisane i przepadną"). ZESTAW,
//  czyli rzecz, która wymienia WSZYSTKIE moduły naraz — i na kilku kapslach — nie miał go wcale.
//  Zamiast pytania robiła się cicha kopia „Przed importem 13-09 15:01", zapowiedziana jedną linijką
//  w środku podglądu importu. Kopia jest dobra, ale odpowiada na pytanie, którego nikt nie zadał,
//  i zostawia po każdym wczytaniu pozycję-śmiecia na liście zestawów (13.09 w jednej instalacji było ich
//  dwie z jednego popołudnia).
//
//  ⚠️ Kopia miała jeszcze jedną wadę, nie do zobaczenia z zewnątrz: szła przez `/setup/save`, więc
//  zapamiętywała JEDEN kapsel — a wczytanie paczki zmienia wszystkie. Droga powrotna działająca
//  w połowie jest gorsza od żadnej, bo wygląda jak cała. Dlatego przy celu wielokapslowym bramka
//  zapisuje przez `/bundle/save` (dopisane 13.09 obok `/bundle/apply`).
//
//  TRZY WYJŚCIA, bo tyle jest sensownych odpowiedzi:
//    • „Zapisz i wczytaj"        — pyta o nazwę, zapisuje TO, CO MASZ, do Biblioteki, potem wczytuje,
//    • „Wczytaj bez zapisywania" — świadome „wiem, co tracę" (dalej zostaje „↶ Cofnij" na 25 s),
//    • „Anuluj"                  — nic się nie dzieje.
//
//  KIEDY BRAMKA MILCZY: nigdy. Zestaw wymienia całą konfigurację i do 13.09 dawało się to zrobić
//  z Biblioteki jednym kliknięciem, bez ANI JEDNEGO pytania. Ale treść okna zależy od stanu:
//  gdy nie ma czego stracić (każdy dotknięty moduł nosi zapisaną, niezmienioną nazwę), okno mówi
//  to wprost i nie proponuje zapisu — przycisk, który zapisałby kopię czegoś, co już leży
//  w Bibliotece pod nazwą, uczyłby tylko, że przyciski są na wszelki wypadek.
//
//  Ładowany PO rf-28 (rfBackupStamp / setupFlash), rf-49 (rfCfgIdState) i rf-49j (rfPresetCols),
//  a PRZED rf-29 i rf-39i, które go wołają.
// ==================================================================================================

const RF_GUARD_I18N = {
  "Wczytać zestaw?": "Load the setup?",
  "Zapisz i wczytaj": "Save, then load",
  "Wczytaj bez zapisywania": "Load without saving",
  "Zapisz obecną konfigurację": "Save the current configuration",
  "Nie masz niezapisanych zmian w tym, co ten zestaw wymienia.":
    "You have no unsaved changes in what this setup replaces.",
};
try { Object.assign(I18N_EN, RF_GUARD_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

// Nazwy sekcji konfiguracji — te same słowa, których używa Biblioteka (`_RFL_GROUP` w rf-39i)
// i okno ról (`_BRM_GROUP` w rf-29c). Trzecia kopia jest tu świadoma i celowo mała: bramka ma
// działać także w oknie, do którego tamte pliki nie doszły, a rozjazd w jednym słowie nic nie psuje.
const _RFG_GROUP = {
  rules: ["wyzwalacze", "triggers"], trigEnabled: null,
  mouse: ["sterowanie ruchem", "motion control"], midi: ["MIDI/OSC", "MIDI/OSC"],
  pose: ["osie 3D", "3D axes"], power: ["bateria", "battery"], pad: ["synth", "synth"],
  scan: ["skaner ekranu", "screen scanner"],
};

// Sekcja zestawu → moduł, który umie powiedzieć „mam tu niezapisane zmiany". Zakładka jest kluczem,
// bo tak samo indeksuje je rf-49j. Mysz i Kontroler stoją nad JEDNYM stanem kapsla (jeden adapter),
// więc pytamy raz — dwa wiersze o tej samej rzeczy czytałyby się jak dwie straty. Tak samo MIDI/OSC.
// `pose` i `power` nie mają nazwanych konfiguracji w ogóle, więc nie ma o co pytać: wchodzą do
// zdania „co ten zestaw wymieni", nie do listy strat.
const _RFG_MODS = [
  { g: "rules", tab: "mapowanie" },
  { g: "mouse", tab: "kontroler" },
  { g: "midi", tab: "midi" },
  { g: "pad", tab: "pad" },
  // Skaner ma własne nazwane konfiguracje (rf-49j), a zestaw wymienia je razem z resztą.
  { g: "scan", tab: "skaner" },
];

function _rfgT(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }
function _rfgGroupName(k) {
  const v = _RFG_GROUP[k];
  return v ? _rfgT(v[0], v[1]) : "";
}
function _rfgDevName(d) {
  try {
    if (typeof rfPresetCols !== "undefined" && window._rfpc && window._rfpc.devName)
      return window._rfpc.devName(d);
  } catch (e) { }
  return String(d || "");
}
function _rfgCurDev() {
  try { if (window._rfpc && window._rfpc.curDev) return window._rfpc.curDev(); } catch (e) { }
  return "";
}

// CO JEST DO STRACENIA — jeden wiersz na (moduł × kapsel), tylko gdy naprawdę jest co stracić.
//
// Trzy powody, każdy znaczy co innego i każdy jest nazwany po imieniu:
//   gone    — kapsel nosi nazwę, której NIE MA już na liście: ustawienia istnieją wyłącznie na nim,
//   dirty   — nosi nazwę i ma w niej zmiany, których biblioteka nie zna,
//   unnamed — nie nosi żadnej nazwy, czyli nie ma dokąd wracać.
//
// Milczymy, gdy `rfCfgIdState` nie ma czego porównać (odcisk `null` — dane cudzego kapsla jeszcze
// nie dojechały). Zmyślona strata jest gorsza od przemilczanej: uczy klikać „wczytaj mimo to".
function rfSetupGuardRisk(groups, devs) {
  const out = [];
  let reg = null;
  try { reg = (typeof rfPresetCols !== "undefined") ? rfPresetCols.instances : null; } catch (e) { }
  if (!reg) return out;                      // bez rejestru modułów nie zgadujemy — patrz wyżej
  const want = new Set(groups || []);
  const targets = (Array.isArray(devs) && devs.filter(Boolean).length)
    ? devs.filter(Boolean) : [_rfgCurDev()];
  _RFG_MODS.forEach(function (m) {
    if (!want.has(m.g)) return;
    const I = reg[m.tab];
    if (!I || !I.spec) return;
    let A = null;
    try { A = I.spec.adapter(); } catch (e) { }
    if (!A) return;
    // Moduł, którego nośnikiem NIE jest kapsel (synth, usługi) — pytamy raz, bez kapsla w zdaniu.
    const list = (I.spec.perDev === false) ? [null] : targets;
    list.forEach(function (dev) {
      let st = null;
      try { st = (dev === null) ? rfCfgIdState(A) : rfCfgIdState(A, dev); } catch (e) { return; }
      if (!st) return;
      let why = "";
      if (st.name && !st.known) why = "gone";
      else if (st.dirty) why = "dirty";
      else if (!st.name) why = "unnamed";
      if (!why) return;
      out.push({ tab: m.tab, group: m.g, dev: dev, why: why, name: st.name || "" });
    });
  });
  return out;
}

// Ten sam wiersz po polsku. Grupowane PO KAPSLU, bo tak człowiek to potem sprawdza: idzie do
// jednego kapsla i patrzy, co tam ma. Bez kapsla (jeden cel, moduł bez nośnika) zostaje sam moduł.
function _rfgRiskLines(risk) {
  const by = [];
  (risk || []).forEach(function (r) {
    const who = (r.dev === null) ? "" : _rfgDevName(r.dev);
    let row = by.find(function (x) { return x.who === who; });
    if (!row) { row = { who: who, items: [] }; by.push(row); }
    const mod = _rfgGroupName(r.group) || r.tab;
    const tail = (r.why === "gone")
      ? _rfgT("nosi „" + r.name + "”, a tej konfiguracji nie ma już na liście",
              "carries “" + r.name + "”, and that configuration is gone from the list")
      : (r.why === "dirty")
        ? _rfgT("zmiany w „" + r.name + "”, których biblioteka nie zna",
                "changes in “" + r.name + "” the library does not know about")
        : _rfgT("nic nie jest zapisane pod nazwą", "nothing is saved under a name");
    row.items.push(mod + " — " + tail);
  });
  return by.map(function (row) {
    return (row.who ? row.who + ": " : "") + row.items.join("; ");
  });
}

// CO TEN ZESTAW WYMIENI — z sekcji pliku, tymi samymi słowami, co Biblioteka w „Co wymieni po
// wczytaniu". Zdanie pada przed listą strat, bo najpierw trzeba wiedzieć, czego to w ogóle dotyczy.
function _rfgGroupsLine(groups) {
  const names = [];
  (groups || []).forEach(function (g) {
    const n = _rfgGroupName(g);
    if (n && names.indexOf(n) < 0) names.push(n);
  });
  return names.join(" · ");
}

// ZAPIS TEGO, CO MASZ. Jeden kapsel idzie przez `/setup/save?dev=`, kilka przez `/bundle/save` —
// zestaw na kilka kapsli musi wrócić jako zestaw na kilka kapsli, inaczej „zapisałem przed
// wczytaniem" znaczyłoby „zapisałem jedną trzecią".
async function _rfgSave(name, devs) {
  const many = Array.isArray(devs) && devs.filter(Boolean).length > 1;
  const body = {
    name: name,
    description: _rfgT("Zapisane przed wczytaniem innego zestawu.",
                       "Saved before loading another setup."),
  };
  // Bez wczytanego Syntha (edycja Essential, moduł wyłączony) zapis nie niesie sekcji `pad` wcale
  // — patrz padStateIfLoaded w rf-20.
  try { if (typeof padStateIfLoaded === "function") { const p = padStateIfLoaded(); if (p) body.pad = p; } } catch (e) { }
  let url = "/bundle/save";
  if (!many) {
    // Jeden kapsel: ten, na który zestaw wejdzie — nie ten, przy którym akurat stoimy. `?dev=`
    // omija podstawianie aktywnego slotu przez rf-05 (pytania z „?" są tam pomijane).
    const dev = (Array.isArray(devs) && devs.filter(Boolean)[0]) || _rfgCurDev();
    url = "/setup/save" + (dev ? "?dev=" + encodeURIComponent(dev) : "");
    const inc = [];
    try { RF_SETUP_SECTIONS.forEach(function (s) { if (s.cfg) s.cfg.forEach(function (k) { inc.push(k); }); }); }
    catch (e) { }
    if (inc.length) body.include = inc;      // kopia bierze WSZYSTKO — jak `rfBackupCurrent`
  }
  try {
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (r) { return r.json(); });
    return (res && res.ok) ? (res.name || name) : null;
  } catch (e) { return null; }
}

// Nazwa, której jeszcze nie ma na liście. Nadpisanie cudzego zestawu przy „zapisz, żeby nie
// stracić" byłoby dokładnie tą stratą, przed którą to okno stoi.
//
// Porównujemy nazwy PO TEJ SAMEJ OBRÓBCE, CO SERWER (`_safe_profile_name`: NFC, zostają litery,
// cyfry, spacja i `_-()+`, białe znaki zwinięte, najwyżej 60 znaków) i bez wielkości liter, bo
// Windows ich w nazwach plików nie rozróżnia. Wcześniej „Przed Half-Life: Alyx” nie pasowało do
// zapisanego „Przed Half-Life Alyx” i drugi zapis nadpisywał pierwszą kopię.
function _rfgSanName(n) {
  let t = String(n || "");
  try { t = t.normalize("NFC"); } catch (e) { }
  try { t = t.replace(/[^\p{L}\p{N} _\-()+]/gu, ""); }
  catch (e) { t = t.replace(/[^0-9A-Za-zÀ-ɏ _\-()+]/g, ""); }
  return t.split(/\s+/).filter(Boolean).join(" ").slice(0, 60);
}
function _rfgNameKey(n) { return _rfgSanName(n).toLowerCase(); }
async function _rfgTakenKeys() {
  let taken = [];
  try { const m = await fetch("/setups").then(function (r) { return r.json(); }); taken = m.setups || []; }
  catch (e) { }
  return new Set(taken.map(_rfgNameKey));
}
async function _rfgFreeName(base) {
  const keys = await _rfgTakenKeys();
  const b = _rfgSanName(base) || base;
  let n = b, i = 2;
  while (keys.has(_rfgNameKey(n))) { n = b + " (" + i + ")"; i++; }
  return n;
}

// ------------------------------------------------------------------------------------------
//  BRAMKA
// ------------------------------------------------------------------------------------------
// opts = { name, groups:[klucze sekcji], devs:[id kapsli lub puste = bieżący], bundle:bool }
// Oddaje `null` przy anulowaniu albo { saved: "<nazwa>"|null, risk: N } przy zgodzie. `risk`
// mówi wywołującemu, czy było co stracić — na tym opiera się decyzja o automatycznej kopii
// „Przed importem…", która od 13.09 powstaje TYLKO wtedy, gdy naprawdę jest co kopiować.
async function rfSetupGuard(opts) {
  opts = opts || {};
  const risk = rfSetupGuardRisk(opts.groups, opts.devs);
  const lines = _rfgRiskLines(risk);
  const what = _rfgGroupsLine(opts.groups);
  const nm = String(opts.name || "").trim();
  const head = nm
    ? _rfgT("Wczytam „" + nm + "”.", "I will load “" + nm + "”.")
    : _rfgT("Wczytam ten zestaw.", "I will load this setup.");
  const whatTxt = what
    ? " " + _rfgT("Wymieni: " + what + ".", "It replaces: " + what + ".")
    : "";
  // NAJWAŻNIEJSZE ZDANIE JEST OSTATNIE — ta sama zasada, co w rf-49a: co się stanie z tym,
  // co człowiek ma teraz. Bez strat mówimy to wprost, zamiast milczeć: cisza w tym miejscu
  // czyta się jak „może coś przepadnie, nie wiem".
  const lossTxt = lines.length
    ? "\n\n⚠️ " + _rfgT("Przepadnie to, czego nie masz zapisanego:",
                        "What you have not saved will be lost:") + "\n• " + lines.join("\n• ")
    : "\n\n" + _rfgT("Nie masz niezapisanych zmian w tym, co ten zestaw wymienia.",
                     "You have no unsaved changes in what this setup replaces.");
  const acts = [{ label: _rfgT("Anuluj", "Cancel"), value: "no", variant: "ghost" }];
  if (lines.length) {
    acts.push({ label: _rfgT("Wczytaj bez zapisywania", "Load without saving"), value: "go" });
    acts.push({ label: _rfgT("Zapisz i wczytaj", "Save, then load"), value: "save", variant: "primary" });
  } else {
    acts.push({ label: _rfgT("Wczytaj", "Load"), value: "go", variant: "primary" });
  }
  const ans = await rfModal({
    title: _rfgT("Wczytać zestaw?", "Load the setup?"),
    icon: '<span class="bic bic-import" aria-hidden="true"></span>',
    // `simnote` — ustalony w tej aplikacji znacznik „treść zachowuje łamanie wierszy"
    // (`white-space:pre-line` w 10-icons-controls.css, ten sam, którego używa rf-39n). Bez niego
    // lista strat sklejała się w jeden akapit, a właśnie ona ma być policzalna wzrokiem.
    tone: "simnote",
    message: head + whatTxt + lossTxt,
    actions: acts,
  });
  if (ans !== "go" && ans !== "save") return null;          // Anuluj, Escape, kliknięcie w tło
  if (ans === "go") return { saved: null, risk: risk.length };

  // ZAPISZ I WCZYTAJ — nazwa od człowieka, z podpowiedzią, która mówi, czym ta pozycja jest.
  // Anulowanie TUTAJ wraca do pytania głównego, a nie wczytuje po cichu: człowiek poprosił
  // o zapis, więc „nie zapisałem i wczytałem mimo to" byłoby odpowiedzią na inne pytanie.
  // PODPOWIEDŹ NAZWY MÓWI, PRZED CZYM. „Przed importem 13-09 15-31" to była nazwa kopii, której
  // nikt nie zamawiał — data, bo aplikacja nie miała nic lepszego do powiedzenia. Tutaj wiadomo
  // więcej: człowiek ratuje swoje ustawienia przed KONKRETNYM zestawem, więc tak się ta pozycja
  // nazywa i tak ją potem znajdzie na liście.
  const base = nm
    ? (_rfgT("Przed ", "Before ") + nm).slice(0, 40)
    : ((typeof rfBackupStamp === "function") ? rfBackupStamp()
                                             : _rfgT("Przed wczytaniem", "Before loading"));
  const suggest = await _rfgFreeName(base);
  const typed = await rfModal({
    title: _rfgT("Zapisz obecną konfigurację", "Save the current configuration"),
    icon: '<span class="bic bic-save" aria-hidden="true"></span>',
    message: _rfgT("Zapiszę w Bibliotece to, co masz teraz, pod tą nazwą. Potem wczytam nowy zestaw — do tej pozycji wrócisz, kiedy zechcesz.",
                   "I will save what you have now to the Library under this name. Then I load the new setup — you can come back to this entry whenever you want."),
    input: {
      label: _rfgT("Nazwa", "Name"), maxLength: 40, value: suggest,
      placeholder: _rfgT("np. Moje ustawienia przed Exo One", "e.g. My settings before Exo One"),
    },
    actions: [{ label: _rfgT("Anuluj", "Cancel"), value: false, variant: "ghost" },
              { label: _rfgT("Zapisz i wczytaj", "Save, then load"), value: true, variant: "primary" }],
  });
  if (!typed) return await rfSetupGuard(opts);              // wróć do pytania głównego
  // NAZWA WPISANA RĘCZNIE też może być zajęta. Pytamy tak samo jak „Zapisz zestaw” (setupSave):
  // nadpisanie ma być decyzją, a „nie” wraca do pytania głównego.
  const typedName = String(typed).trim();
  if ((await _rfgTakenKeys()).has(_rfgNameKey(typedName))) {
    const shown = _rfgSanName(typedName) || typedName;
    const over = await rfConfirm(
      _rfgT("Zestaw o tej nazwie już jest w Bibliotece. Zapis go zastąpi, a starej wersji nie da się odzyskać.",
            "A setup with this name is already in the Library. Saving replaces it, and the old version cannot be recovered."),
      { title: _rfgT("Nadpisać zestaw „" + shown + "”?", "Overwrite the setup “" + shown + "”?"),
        icon: '<span class="bic bic-save" aria-hidden="true"></span>', tone: "danger",
        confirmLabel: _rfgT("Nadpisz", "Overwrite"), cancelLabel: _rfgT("Anuluj", "Cancel") });
    if (!over) return await rfSetupGuard(opts);
  }
  const saved = await _rfgSave(typedName, opts.devs);
  if (!saved) {
    // Zapis się nie udał — i to jest moment, w którym NIE WOLNO wczytać. Człowiek zgodził się
    // na wymianę POD WARUNKIEM, że stare zostanie zapamiętane; warunek nie został spełniony.
    try {
      rfToast(_rfgT("Nie udało się zapisać kopii — nic nie wczytałem.",
                    "Could not save the copy — nothing was loaded."), { tone: "danger" });
    } catch (e) { }
    return null;
  }
  try { if (typeof rfLibReload === "function") rfLibReload(); } catch (e) { }
  try {
    rfToast(_rfgT("Zapisano „" + saved + "” w Bibliotece.", "Saved “" + saved + "” to the Library."),
            { tone: "ok" });
  } catch (e) { }
  return { saved: saved, risk: risk.length };
}

// Sekcje, które NIESIE plik — dla wywołujących, którzy mają w ręku kopertę, a nie wpis z Biblioteki.
// Paczka trzyma je per kapsel, zwykły zestaw na wierzchu w `config`; obie drogi oddają ten sam
// zbiór kluczy, więc okno mówi to samo niezależnie od formatu pliku.
function rfSetupGuardGroups(env) {
  const out = [];
  const add = function (o) {
    if (!o || typeof o !== "object") return;
    ["rules", "mouse", "midi", "pose", "power", "scan"].forEach(function (k) {
      if (o[k] != null && out.indexOf(k) < 0) out.push(k);
    });
  };
  if (!env || typeof env !== "object") return out;
  if (Array.isArray(env.devices)) {
    env.devices.forEach(function (dv) { add(dv && dv.setup); });
  } else {
    add((env.config && typeof env.config === "object") ? env.config : env);
  }
  // Pusta sekcja `pad` (zapis z karty bez Syntha) niczego nie wymieni — padAdoptState ją odrzuca.
  const padOk = (typeof padBlobHasPads === "function") ? padBlobHasPads(env.pad) : !!env.pad;
  if (padOk && out.indexOf("pad") < 0) out.push("pad");
  return out;
}

window.rfSetupGuard = rfSetupGuard;
window.rfSetupGuardRisk = rfSetupGuardRisk;
window.rfSetupGuardGroups = rfSetupGuardGroups;
