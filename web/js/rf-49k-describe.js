"use strict";
// ==================================================================================================
//  „CO USTAWIA" — jeden opis zawartości presetu dla dwóch miejsc, które o to pytają
//
//  SKĄD TO SIĘ WZIĘŁO. Podgląd cudzego presetu w module (rf-49j) i panel opisu w Bibliotece
//  (rf-39i2) zadają DOKŁADNIE to samo pytanie: „co siedzi w tym pliku". Dwa opisy jednej rzeczy
//  rozjeżdżają się przy pierwszej poprawce — i rozjeżdżają się CICHO, bo oba wyglądają wiarygodnie.
//
//  TRZY ZASADY:
//
//  1. POKAZUJEMY TO, CO NAPRAWDĘ SIEDZI W PRESECIE. Ani jednej wartości „domyślnej" dorysowanej
//     dlatego, że pole zwykle bywa ustawione. Brak pola = brak wiersza. Zmyślona liczba w opisie
//     konfiguracji jest gorsza niż jej brak, bo na jej podstawie ktoś podejmie decyzję.
//  2. ETYKIETY SĄ TE, KTÓRE STOJĄ W MODULE. Człowiek ma poznać wiersz opisu po tym, że widział to
//     samo słowo przy suwaku. Reguły wyzwalaczy opisują funkcje z rf-10 (`ruleCondLabel`,
//     `ruleKeyLabel`, `ruleBehLabel`) — te same, którymi rysuje się listę w module, więc opis
//     nie ma jak powiedzieć czegoś innego niż sam moduł.
//  3. MODUŁ BEZ WŁASNEGO OPISU DOSTAJE UCZCIWY ZAPAS: płaskie pary klucz-wartość z presetu, bez
//     kluczy technicznych (id, odcisk, koperta pliku). Lepsza surowa prawda niż pusty panel.
//
//  Kształty presetów (potwierdzone w kodzie adapterów i w plikach z Library/):
//    trig  { name, desc, rules: [...] }                    — płasko, bez `config`
//    mouse { name, desc, config: {...} }
//    midi  { name, desc, config: { mappings: [...], scale, scaleRoot } }
//    pose  { name, config: {...} }                         — bez opisu
//    synth { name, state: {...} }                          — bez opisu, treść w `state`
//
//  Ładowany PO rf-49-cfgid.js, a PRZED rf-49j / rf-39i. Nic nie rysuje — zwraca dane.
// ==================================================================================================

const RF_CFGDESC_I18N = {
  "Tryb ruchu": "Motion mode",
  "kursor": "cursor",
  "drążek": "stick",
  "krzyżak": "d-pad",
  "Źródło ruchu": "Motion source",
  "Filtr 3D": "3D filter",
  "Oś (surowy kanał)": "Axis (raw channel)",
  "Oś X": "X axis",
  "Oś Y": "Y axis",
  "Czułość X": "Sensitivity X",
  "Czułość Y": "Sensitivity Y",
  "Wygładzanie": "Smoothing",
  "Krzywa odpowiedzi": "Response curve",
  "Stabilizacja kursora": "Cursor steadying",
  "Maks. krok": "Max step",
  "Martwa strefa": "Dead zone",
  "Akceleracja": "Acceleration",
  "Klik zatrzymaniem": "Click by dwelling",
  "Czas zatrzymania": "Dwell time",
  "Rodzaj kliknięcia": "Click type",
  "lewym": "left",
  "środkowym": "middle",
  "dwuklikiem": "double",
  "Drążek": "Stick",
  "Lewy": "Left",
  "Prawy": "Right",
  "Wyjście": "Output",
  "Klawiatura": "Keyboard",
  "Kontroler": "Controller",
  "Martwa strefa wewnętrzna": "Inner dead zone",
  "Krzywa (expo)": "Curve (expo)",
  "Czułość osi X": "Axis X sensitivity",
  "Czułość osi Y": "Axis Y sensitivity",
  "Próg WSAD": "WASD threshold",
  "Klawisze": "Keys",
  "Ukosy": "Diagonals",
  "Scroll": "Scrolling",
  "Automatyczna zmiana trybu": "Automatic mode change",
  "tak": "yes",
  "Mapowania": "Mappings",
  "Skala": "Scale",
  "Czułość filtra": "Filter responsiveness",
  "Odbicie lustrzane": "Mirrored",
  "Odwrócony przechył przód-tył": "Front-back tilt inverted",
  "Odwrócony przechył w bok": "Side tilt inverted",
  "Kanały akcelerometru": "Accelerometer channels",
  "Kanały żyroskopu": "Gyroscope channels",
  "Dostrojone osie": "Tuned axes",
  "Własne brzmienia": "Custom sounds",
  "Przerobione brzmienia wbudowane": "Reworked built-in sounds",
  "Pady efektów": "Effect pads",
  "Ten preset nie niesie żadnych ustawień.": "This preset carries no settings.",
  "Opisu tego rodzaju konfiguracji aplikacja jeszcze nie zna, więc pokazuje surowe pola z pliku.":
    "The app does not know how to describe this kind of configuration yet, so it shows the raw fields from the file.",
};
// Do globalnego słownika — para tutaj przykrywa rf-01 w CAŁYM panelu. Etykiety, które rf-01 już zna
// („Tonika", „Promień spokoju", „Pady grające"…), idą tylko przez _cdT(pl,en) niżej i nie mają tu pary;
// słowa wspólne z ekranem (wychylenie, promień, pady) brzmią jak tam: deflection, calm radius, play pads.
try { Object.assign(I18N_EN, RF_CFGDESC_I18N); } catch (e) { /* i18n jeszcze nie ma */ }

function _cdT(pl, en) { return (typeof _gl === "function") ? _gl(pl, en) : pl; }
// NAZWY, KTÓRE MA NA EKRANIE POLE WYBORU — nie surowe identyfikatory z pliku. Panel opisu pisał
// „Skala pentatonic_minor" i „tilt 0..90 → CC 1", a ekran konfiguracji nazywa te same rzeczy
// „pentatonika moll" i „Pochylenie": ten sam preset, dwa różne słowniki, i tylko jeden z nich
// da się przeczytać. Słowniki są tam, gdzie ich listy (FMETA w rf-10, MI_SCALES w rf-16) — żeby
// nie było tu trzeciej kopii, która rozjedzie się przy pierwszej nowej skali.
// Wynik jest polski, a węzeł niesie `data-noi18n` (patrz `$.human` w rf-49j), więc angielski
// bierzemy tą samą drogą co `keyLabel` w rf-10: przez wspólny słownik, w chwili składania.
function _cdEn(pl) {
  if (typeof _lang !== "undefined" && _lang === "en" && typeof I18N_EN !== "undefined" && I18N_EN[pl] != null) return I18N_EN[pl];
  return pl;
}
function _cdMetric(id) {
  const k = String(id || "");
  const m = (typeof FMETA !== "undefined" && FMETA) ? FMETA[k] : null;
  return _cdEn((m && m.label) || k);
}
function _cdScale(id) {
  const k = String(id || "");
  const L = (typeof MI_SCALES !== "undefined" && Array.isArray(MI_SCALES)) ? MI_SCALES : [];
  const hit = L.find(x => x && x[0] === k);
  return _cdEn(hit ? hit[1] : k);
}
function _cdNum(v) {
  if (typeof v !== "number" || !isFinite(v)) return String(v);
  return (Math.round(v) === v) ? String(v) : String(Math.round(v * 100) / 100);
}
function _cdSw(v) { return v ? _cdT("tak", "yes") : _cdT("nie", "no"); }
// Wiersz powstaje TYLKO wtedy, gdy pole naprawdę jest w presecie. `undefined` znaczy „plik tego nie
// niesie" i nie ma o czym pisać; `null` tak samo. Zero i `false` są prawdziwymi wartościami i zostają.
function _cdRow(out, cfg, key, label, fmt) {
  if (!cfg || !(key in cfg)) return;
  const v = cfg[key];
  if (v === null || v === undefined || v === "") return;
  out.push({ k: label, v: fmt ? fmt(v) : (typeof v === "boolean" ? _cdSw(v) : _cdNum(v)) });
}
function _cdPick(map, v, dflt) {
  const t = map[String(v)];
  return t ? _cdT(t[0], t[1]) : (dflt !== undefined ? dflt : String(v));
}

const _CD_SRC = { filter: ["Filtr 3D", "3D filter"], axis: ["Oś (surowy kanał)", "Axis (raw channel)"] };
const _CD_MODE = { mouse: ["kursor", "cursor"], stick: ["drążek", "stick"], dpad: ["krzyżak", "d-pad"] };
const _CD_CLICK = { left: ["lewym", "left"], middle: ["środkowym", "middle"], double: ["dwuklikiem", "double"] };
const _CD_BACKEND = { keyboard: ["Klawiatura", "Keyboard"], gamepad: ["Kontroler", "Controller"] };
const _CD_WHICH = { left: ["Lewy", "Left"], right: ["Prawy", "Right"] };

// ------------------------------------------------------------------------------------------
//  MAPOWANIE (wyzwalacze) — chipy „warunek → akcja"
// ------------------------------------------------------------------------------------------
// Etykiety liczą funkcje z rf-10, czyli DOKŁADNIE te, którymi moduł rysuje swoją listę reguł.
// Własne składanie tekstu dałoby drugi opis tej samej reguły; ten sposób nie ma jak się rozjechać.
// Bez rf-10 (okno nakładki, harness) zostaje etykieta reguły i sam zapis klawisza.
function _cdTrig(p) {
  const rules = Array.isArray(p && p.rules) ? p.rules : [];
  const out = [];
  for (const r of rules) {
    let cond = "", act = "";
    try { cond = (typeof ruleCondLabel === "function") ? ruleCondLabel(r) : ""; } catch (e) { }
    try { act = (typeof ruleKeyLabel === "function") ? ruleKeyLabel(r) : ""; } catch (e) { }
    if (!cond) cond = String(r.label || "");
    if (!act) act = String(r.keySpec || r.sequence || "");
    let beh = "";
    try { beh = (typeof ruleBehLabel === "function") ? ruleBehLabel(r) : ""; } catch (e) { }
    out.push({ c: cond, a: act, b: beh, off: r.enabled === false });
  }
  return { rows: [], rules: out };
}

// ------------------------------------------------------------------------------------------
//  MYSZ — pola wspólne plus te, które należą do WYBRANEGO trybu
// ------------------------------------------------------------------------------------------
// Preset myszy niesie ponad sto pól, z czego większość dotyczy trybu, którego ten preset nie używa.
// Wypisanie wszystkich zamieniłoby opis w zrzut pliku, a pokazanie ustawień drążka przy presecie
// kursora byłoby po prostu myleniem. Wypisujemy więc tryb i to, co ten tryb naprawdę stroi.
function _cdMouse(p) {
  const c = (p && p.config) || {};
  const rows = [];
  const mode = String(c.mode || "mouse");
  rows.push({ k: _cdT("Tryb ruchu", "Motion mode"), v: _cdPick(_CD_MODE, mode, mode) });
  if (mode === "mouse") {
    _cdRow(rows, c, "mouseSource", _cdT("Źródło ruchu", "Motion source"), v => _cdPick(_CD_SRC, v));
    _cdRow(rows, c, "mouseMetricX", _cdT("Oś X", "X axis"));
    _cdRow(rows, c, "mouseMetricY", _cdT("Oś Y", "Y axis"));
    _cdRow(rows, c, "mouseFilterScale", _cdT("Pełne wychylenie przy", "Full deflection at"), v => _cdNum(v) + "°");
    _cdRow(rows, c, "sensX", _cdT("Czułość X", "Sensitivity X"));
    _cdRow(rows, c, "sensY", _cdT("Czułość Y", "Sensitivity Y"));
    _cdRow(rows, c, "smooth", _cdT("Wygładzanie", "Smoothing"));
    _cdRow(rows, c, "mouseExpo", _cdT("Krzywa odpowiedzi", "Response curve"));
    _cdRow(rows, c, "tighten", _cdT("Stabilizacja kursora", "Cursor steadying"));
    _cdRow(rows, c, "maxStep", _cdT("Maks. krok", "Max step"), v => _cdNum(v) + " px");
    _cdRow(rows, c, "mouseFilterDead", _cdT("Martwa strefa", "Dead zone"), v => _cdNum(v) + "°");
    _cdRow(rows, c, "accelOn", _cdT("Akceleracja", "Acceleration"));
    _cdRow(rows, c, "dwellOn", _cdT("Klik zatrzymaniem", "Click by dwelling"));
    if (c.dwellOn) {
      _cdRow(rows, c, "dwellMs", _cdT("Czas zatrzymania", "Dwell time"), v => _cdNum(v) + " ms");
      _cdRow(rows, c, "dwellRadius", _cdT("Promień spokoju", "Calm radius"), v => _cdNum(v) + " px");
      _cdRow(rows, c, "dwellClick", _cdT("Rodzaj kliknięcia", "Click type"), v => _cdPick(_CD_CLICK, v));
    }
    _cdRow(rows, c, "scroll", _cdT("Scroll", "Scrolling"));
  } else if (mode === "stick") {
    _cdRow(rows, c, "stickWhich", _cdT("Drążek", "Stick"), v => _cdPick(_CD_WHICH, v));
    _cdRow(rows, c, "stickBackend", _cdT("Wyjście", "Output"), v => _cdPick(_CD_BACKEND, v));
    _cdRow(rows, c, "stickSource", _cdT("Źródło ruchu", "Motion source"), v => _cdPick(_CD_SRC, v));
    _cdRow(rows, c, "stickFilterScale", _cdT("Pełne wychylenie przy", "Full deflection at"), v => _cdNum(v) + "°");
    _cdRow(rows, c, "stickInner", _cdT("Martwa strefa wewnętrzna", "Inner dead zone"));
    _cdRow(rows, c, "stickExpo", _cdT("Krzywa (expo)", "Curve (expo)"));
    // Czułość osi tylko dla drążka analogowego — bo tylko tam silnik ją czyta (_shape_stick),
    // a opis, który wymienia ustawienie nieczytane przez ten preset, jest opisem nieprawdziwym.
    // 0,00× nie jest „bardzo małą czułością", tylko osią zdjętą z drążka — opis mówi to słowem,
    // bo samo „0×" w spisie liczb czyta się jak literówka.
    const _cdSens = v => _cdNum(v) + "×" + (+v === 0 ? _cdT(" (oś wyłączona)", " (axis off)") : "");
    if (c.stickBackend !== "wsad" && c.stickBackend !== "touchpad") {
      _cdRow(rows, c, "stickSensX", _cdT("Czułość osi X", "Axis X sensitivity"), _cdSens);
      _cdRow(rows, c, "stickSensY", _cdT("Czułość osi Y", "Axis Y sensitivity"), _cdSens);
    }
    if (c.stickBackend === "keyboard") {
      _cdRow(rows, c, "stickWsadThr", _cdT("Próg WSAD", "WASD threshold"));
      rows.push({ k: _cdT("Klawisze", "Keys"), v: [c.stickUp, c.stickLeft, c.stickDown, c.stickRight].filter(Boolean).join(" · ") });
    }
  } else {
    _cdRow(rows, c, "dpadBackend", _cdT("Wyjście", "Output"), v => _cdPick(_CD_BACKEND, v));
    _cdRow(rows, c, "dpadSource", _cdT("Źródło ruchu", "Motion source"), v => _cdPick(_CD_SRC, v));
    _cdRow(rows, c, "dpadFilterScale", _cdT("Pełne wychylenie przy", "Full deflection at"), v => _cdNum(v) + "°");
    _cdRow(rows, c, "dpadInner", _cdT("Martwa strefa wewnętrzna", "Inner dead zone"));
    _cdRow(rows, c, "dpadFilterDead", _cdT("Martwa strefa", "Dead zone"), v => _cdNum(v) + "°");
    _cdRow(rows, c, "dpadDiagonal", _cdT("Ukosy", "Diagonals"));
    if (c.dpadBackend !== "gamepad") {
      rows.push({ k: _cdT("Klawisze", "Keys"), v: [c.dpadUp, c.dpadLeft, c.dpadDown, c.dpadRight].filter(Boolean).join(" · ") });
    }
  }
  _cdRow(rows, c, "autoSwitch", _cdT("Automatyczna zmiana trybu", "Automatic mode change"));
  return { rows: rows.filter(r => r.v !== ""), rules: [] };
}

// ------------------------------------------------------------------------------------------
//  MIDI / OSC — skala plus chipy „źródło → cel"
// ------------------------------------------------------------------------------------------
const _CD_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function _cdMidi(p) {
  const c = (p && p.config) || {};
  const maps = Array.isArray(c.mappings) ? c.mappings : [];
  const rows = [];
  _cdRow(rows, c, "scale", _cdT("Skala", "Scale"), _cdScale);
  if (typeof c.scaleRoot === "number") {
    rows.push({ k: _cdT("Tonika", "Root note"), v: _CD_NOTES[c.scaleRoot % 12] || String(c.scaleRoot) });
  }
  // SPLIT BY OUTPUT, not one total. One record serves both protocols (see rf-49d), so „Mapowania
  // 12" answers the wrong question: a set with OSC only needs no loopMIDI, a set with MIDI only
  // needs no UDP listener — and that is what the reader of a library entry is deciding about.
  // Exactly the split `_midiCfgMetric` (rf-49d) counts for the tile: `dest === "osc"` is OSC,
  // everything else goes out of the MIDI port.
  const oscN = maps.filter(m => m && m.dest === "osc").length;
  rows.push({ k: _cdT("Mapowania", "Mappings"),
              v: "MIDI: " + (maps.length - oscN) + " · OSC: " + oscN });
  const rules = maps.map(m => {
    const src = (m.srcKind === "axis") ? ("CH" + m.ch) : _cdMetric(m.metric);
    const cond = (m.mode === "threshold")
      ? (src + " " + (m.cmp || ">") + " " + _cdNum(m.threshold))
      : (src + " " + _cdNum(m.inLo) + ".." + _cdNum(m.inHi));
    let act = "";
    if (m.dest === "osc") act = "📡 " + String(m.addr || "");
    else if (m.dest === "note") act = "♪ " + _cdNum(m.loNote) + "–" + _cdNum(m.hiNote);
    else if (m.dest === "prog") act = "PROG " + _cdNum(m.prog);
    else if (m.dest === "at") act = "AT";
    else act = "CC " + _cdNum(m.cc);
    return { c: (m.name ? (m.name + ": ") : "") + cond, a: act, b: "", off: m.enabled === false };
  });
  return { rows: rows, rules: rules };
}

// ------------------------------------------------------------------------------------------
//  OSIE 3D — strojenie filtra i mapa kanałów
// ------------------------------------------------------------------------------------------
// `cal` (przypisanie kanałów) JEDZIE z tym presetem i to jest jego najważniejsza zawartość: po
// wczytaniu kapsel czyta osie inaczej. Dlatego stoi w opisie, a nie tylko w oknie potwierdzenia.
function _cdCal(pairs) {
  return (Array.isArray(pairs) ? pairs : [])
    .map(x => Array.isArray(x) ? ("CH" + x[0] + (x[1] < 0 ? "⁻" : "")) : "").filter(Boolean).join(" · ");
}
function _cdPose(p) {
  const c = (p && p.config) || {};
  const rows = [];
  _cdRow(rows, c, "resp", _cdT("Czułość filtra", "Filter responsiveness"));
  _cdRow(rows, c, "gain", _cdT("Przyspieszenie wychylenia", "Deflection boost"), v => "×" + _cdNum(v));
  _cdRow(rows, c, "mirror", _cdT("Odbicie lustrzane", "Mirrored"));
  if (c.inv && typeof c.inv === "object") {
    rows.push({ k: _cdT("Odwrócony przechył przód-tył", "Front-back tilt inverted"), v: _cdSw(c.inv.pitch) });
    rows.push({ k: _cdT("Odwrócony przechył w bok", "Side tilt inverted"), v: _cdSw(c.inv.roll) });
  }
  if (c.cal && typeof c.cal === "object") {
    const acc = _cdCal(c.cal.acc), gyr = _cdCal(c.cal.gyr);
    if (acc) rows.push({ k: _cdT("Kanały akcelerometru", "Accelerometer channels"), v: acc });
    if (gyr) rows.push({ k: _cdT("Kanały żyroskopu", "Gyroscope channels"), v: gyr });
  }
  const tuned = [];
  for (const box of [c.axes, c.chans]) {
    if (!box || typeof box !== "object") continue;
    for (const k in box) if (box[k] && box[k].on) tuned.push(k);
  }
  if (tuned.length) rows.push({ k: _cdT("Dostrojone osie", "Tuned axes"), v: tuned.join(" · ") });
  return { rows: rows, rules: [] };
}

// ------------------------------------------------------------------------------------------
//  SYNTEZATOR — co scena stawia na ekranie
// ------------------------------------------------------------------------------------------
function _cdSynth(p) {
  const s = (p && p.state) || {};
  const pads = Array.isArray(s.pads) ? s.pads : [];
  const rows = [];
  rows.push({
    k: _cdT("Pady grające", "Play pads"),
    v: pads.length + (pads.length ? (" · " + pads.map(x => String(x.name || "")).filter(Boolean).join(", ")) : "")
  });
  const cs = s.customSounds && typeof s.customSounds === "object" ? Object.keys(s.customSounds).length : 0;
  const bo = s.baseOverrides && typeof s.baseOverrides === "object" ? Object.keys(s.baseOverrides).length : 0;
  const fx = Array.isArray(s.fxPads) ? s.fxPads.length : 0;
  if (cs) rows.push({ k: _cdT("Własne brzmienia", "Custom sounds"), v: String(cs) });
  if (bo) rows.push({ k: _cdT("Przerobione brzmienia wbudowane", "Reworked built-in sounds"), v: String(bo) });
  if (fx) rows.push({ k: _cdT("Pady efektów", "Effect pads"), v: String(fx) });
  return { rows: rows, rules: [] };
}

// ------------------------------------------------------------------------------------------
//  USŁUGI SIECIOWE (rf-49n) — akcje, ich wyzwalacze i zmienne
// ------------------------------------------------------------------------------------------
// Zamiast zrzutu adresów: ILE akcji, DOKĄD mówią i CO je odpala. Adresy bywają długie i bywają
// wewnętrzne, a decyzję „wczytać czy nie" podejmuje się z liczb i z nazw, nie z URL-i. Chipy reguł
// niosą to samo, co lista w module: nazwa akcji → jej cel.
function _cdRest(p) {
  const c = (p && p.config) || {};
  const apis = Array.isArray(c.apis) ? c.apis : [];
  const rows = [], rules = [];
  let acts = 0, trigs = 0;
  for (const a of apis) {
    const list = Array.isArray(a && a.actions) ? a.actions : [];
    acts += list.length;
    trigs += Array.isArray(a && a.triggers) ? a.triggers.length : 0;
    for (const act of list) {
      if (rules.length >= 24) break;
      const nm = String((act && (act.name || act.id)) || "").trim();
      if (!nm) continue;
      // Cel czytany po kolei z trzech pól, bo akcja HTTP i akcja OBS-a opisują go inaczej.
      // Puste = akcja bez celu, i to też jest odpowiedź.
      const to = String((act && (act.url || act.request || act.op)) || "").trim();
      rules.push({ c: nm, a: to || _cdT("bez celu", "no target") });
    }
  }
  if (apis.length) rows.push({ k: _cdT("Usługi", "Services"), v: String(apis.length) });
  if (acts) rows.push({ k: _cdT("Akcje", "Actions"), v: String(acts) });
  if (trigs) rows.push({ k: _cdT("Wyzwalacze", "Triggers"), v: String(trigs) });
  const vars = (c.vars && typeof c.vars === "object") ? Object.keys(c.vars).length : 0;
  if (vars) rows.push({ k: _cdT("Zmienne", "Variables"), v: String(vars) });
  return { rows: rows, rules: rules,
           note: _cdT("Preset nie niesie przełącznika modułu ani adresu OBS-a — to zostaje przy tym komputerze. Hasła i tokeny są w sejfie, nigdy w pliku presetu.",
                      "The preset carries neither the module switch nor the OBS address — those stay with this computer. Passwords and tokens live in the vault, never in a preset file.") };
}

// ------------------------------------------------------------------------------------------
//  KOŁO WYBORU (rf-46k) — wycinki i sposób obsługi
// ------------------------------------------------------------------------------------------
// Wycinki jako chipy „nazwa → akcja", dokładnie jak reguły wyzwalaczy: to jest treść koła i to po
// nich poznaje się dwa koła o podobnych nazwach. Wycinek z podmenu nie wysyła nic — mówimy to
// wprost, zamiast zostawiać puste miejsce po akcji.
function _cdWheel(p) {
  const c = (p && p.config) || {};
  const rows = [], rules = [];
  let n = 0;
  const walk = (list, depth) => (list || []).forEach(s => {
    n++;
    if (rules.length < 24) {
      const sub = (s.children && s.children.length) ? s.children.length : 0;
      rules.push({ c: String(s.label || "").trim() || "—",
                   a: sub ? _cdT("podmenu", "submenu") : (String(s.spec || s.sequence || "").trim()
                        || _cdT("nic nie wysyła", "sends nothing")),
                   b: depth ? "→" + depth : "" });
    }
    if (s.children) walk(s.children, (depth || 0) + 1);
  });
  walk(c.slices, 0);
  // JEDNA LICZBA NA JEDNO KOŁO. `n` liczy WSZYSTKIE wycinki razem z podmenu, a metryka wiersza,
  // kafel kapsla i okna potwierdzeń mówią „4 wycinki (+3 w podmenu)" — czyli ten sam panel
  // pokazywał obok siebie „Wycinki 7" i „4 wycinki (+3 w podmenu)". Liczy to jeden wspólny
  // `whCountLabel` (rf-46b); `typeof` bo w okienku nakładki modułu koła nie ma wcale.
  if (n) rows.push({ k: _cdT("Wycinki", "Slices"),
                     v: (typeof whCountLabel === "function") ? whCountLabel(c.slices) : String(n) });
  // ETYKIETY, NIE SUROWE WARTOŚCI Z PLIKU. Opis czyta się po to, żeby porównać go z tym, co widać
  // w module — a tam nad tymi listami stoi „Trzymaj przycisk i puść", nie „release". Bierzemy je
  // z TYCH SAMYCH tablic, z których moduł buduje swoje listy (rf-46 `WHEEL_MODES`/`WHEEL_SUB`),
  // więc opis nie ma jak powiedzieć czegoś innego niż sam moduł. Wartość spoza tablicy (plik
  // z nowszego builda) pokazujemy taką, jaka jest — surowa prawda zamiast pustego wiersza.
  const _lab = (tbl, v) => {
    try {
      const r = (tbl || []).find(x => x[0] === String(v));
      return r ? _cdT(r[1], r[2]) : String(v);
    } catch (e) { return String(v); }
  };
  if (c.confirm) rows.push({ k: _cdT("Sterowanie", "How it is worked"),
    v: _lab(typeof WHEEL_MODES !== "undefined" ? WHEEL_MODES : null, c.confirm) });
  if (c.submenuMode) rows.push({ k: _cdT("Podmenu", "Submenus"),
    v: _lab(typeof WHEEL_SUB !== "undefined" ? WHEEL_SUB : null, c.submenuMode) });
  if (c.deadzone != null) rows.push({ k: _cdT("Martwa strefa", "Dead zone"), v: _cdNum(c.deadzone) });
  if (c.holdMs != null) rows.push({ k: _cdT("Trzymaj (ms)", "Hold (ms)"), v: _cdNum(c.holdMs) });
  if (c.look && c.look.size) rows.push({ k: _cdT("Wielkość koła", "Wheel size"), v: _cdNum(c.look.size) });
  return { rows: rows, rules: rules,
           note: _cdT("Przełącznik On i miejsce wyświetlania zostają przy kapslu — konfiguracja mówi, JAKIE koło ma ten kapsel.",
                      "The On switch and where the wheel is shown stay with the capsule — a configuration says WHAT wheel it has.") };
}

// ------------------------------------------------------------------------------------------
//  SKANER EKRANU (2026-10-02)
// ------------------------------------------------------------------------------------------
// Do 02.10 rano skaner szedł do zapasu niżej (`pasmoY 70`, `mnoznikDokladny 0.28`), potem przez
// kilka godzin miał tu ręcznie wybraną listę pól. Od tego samego dnia opis ma
// być POCHODNĄ tablicy pól karty (rf-50b2), żeby nowe pokrętło trafiało do Biblioteki samo. Dlatego
// `rows` jest puste, a całość rysuje `art` w kolejności, w jakiej padają pytania:
//   skrót („jak i ile to kosztuje") → plansze („gdzie") → różnice („co zmieni wczytanie") →
//   wszystkie ustawienia (zwinięte). Rysuje rf-39i4, bazę do różnic podaje rf-50j.
function _cdScanWszystko(c) {
  const sk = RFScan.skanery(c);
  if (sk.length <= 1) return [rfScanWszystko(RFScan.opisz(c))];
  return sk.map(function (s, i) {
    const nm = String(s.nazwa || "").trim();
    return rfScanWszystko(RFScan.opisz(s), _cdT("Skaner ", "Scanner ") + (i + 1) + (nm ? " „" + nm + "”" : "")
      + _cdT(" — wszystkie ustawienia", " — all settings"));
  });
}
function _cdScanArt(p) {
  const c = (p && p.config) || {};
  const box = document.createElement("div");
  box.className = "scp-opis";
  const has = function (fn) { return typeof window[fn] === "function"; };
  if (has("scanZestawNowszy")) { const n = scanZestawNowszy(p); if (n) box.appendChild(n); }
  box.appendChild(rfScanSkrot(c));
  box.appendChild(rfScanPreview(c));
  const roz = document.createElement("div");
  box.appendChild(roz);
  // BAZA RÓŻNIC = kapsel, na który trafi „Wczytaj"; bez kapsla — ustawienia domyślne. Konfiguracja
  // cudzego kapsla jedzie z serwera, więc miejsce czeka na nią i dorysowuje się po dojechaniu.
  const rysuj = function (b) {
    roz.textContent = "";
    roz.appendChild(rfScanRoznice(RFScan.rozniceKonfiguracji(b.cfg, c), b.tytul, b.pusto));
  };
  const dom = { cfg: {}, tytul: _cdT("Czym różni się od ustawień domyślnych", "How it differs from the defaults"),
                pusto: _cdT("Same ustawienia domyślne.", "Nothing but the defaults.") };
  const baza = has("scanBazaWczytania") ? scanBazaWczytania(rysuj) : null;
  if (!baza) rysuj(dom);
  else if (baza.cfg) rysuj(baza);
  else roz.appendChild(rfScanRoznice([], baza.tytul, _cdT("Sprawdzam ustawienia kapsla…", "Checking the capsule's settings…")));
  _cdScanWszystko(c).forEach(function (d) { box.appendChild(d); });
  return box;
}
function _cdScan(p) {
  const gotowe = typeof rfScanSkrot === "function" && window.RFScan && typeof RFScan.opisz === "function";
  return { rows: [], rules: [],
           art: gotowe ? function () { return _cdScanArt(p); } : null,
           note: _cdT("Włącznik modułu i reguły, które dają sygnał, zostają przy kapslu. Preset mówi, JAK skaner wskazuje i GDZIE pracuje.",
                      "The module switch and the rules that give the signal stay with the capsule. A preset says HOW the scanner points and WHERE it works.") };
}

// ------------------------------------------------------------------------------------------
//  ZAPAS — surowe pola pliku
// ------------------------------------------------------------------------------------------
// Rodzaj konfiguracji, którego ten plik jeszcze nie zna z nazwy, dostaje uczciwy zrzut pól: bez
// koperty pliku i bez kluczy technicznych, których nikt nie ustawiał (id, odcisk, wersja formatu).
// Nie zgadujemy etykiet — klucz zostaje kluczem, bo wymyślona etykieta kłamie ciszej niż surowa nazwa.
const _CD_SKIP = { id: 1, name: 1, desc: 1, app: 1, kind: 1, version: 1, appVersion: 1, rev: 1,
                   mtime: 1, size: 1, configName: 1, _v: 1, fingerprint: 1, enabled: 1 };
function _cdFallback(p) {
  const box = (p && (p.config || p.state)) || p || {};
  const rows = [];
  for (const k in box) {
    if (_CD_SKIP[k]) continue;
    const v = box[k];
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v)) { rows.push({ k: k, v: String(v.length) }); continue; }
    if (typeof v === "object") continue;                 // zagnieżdżeń nie rozwijamy — to już zrzut pliku
    rows.push({ k: k, v: (typeof v === "boolean") ? _cdSw(v) : _cdNum(v) });
    if (rows.length >= 24) break;
  }
  return { rows: rows, rules: [],
           note: _cdT("Opisu tego rodzaju konfiguracji aplikacja jeszcze nie zna, więc pokazuje surowe pola z pliku.",
                      "The app does not know how to describe this kind of configuration yet, so it shows the raw fields from the file.") };
}

const RF_CFG_DESCRIBERS = { trig: _cdTrig, mouse: _cdMouse, midi: _cdMidi, pose: _cdPose,
                            synth: _cdSynth, rest: _cdRest, wheel: _cdWheel, scan: _cdScan };

// rfCfgDescribe(key, preset) -> { rows: [{k,v}], rules: [{c,a,b,off}], note?, art? }
// `art` (od 02.10, na razie tylko skaner) to funkcja zwracająca element z rysunkiem — oba panele
// wstawiają go nad wierszami, gdy jest, i wtedy pusta lista wierszy nie znaczy „preset pusty".
// `key` to klucz modułu z rejestru adapterów (rf-49 `rfCfgIdRegister`):
// trig · mouse · midi · pose · synth · rest · wheel.
function rfCfgDescribe(key, preset) {
  if (!preset) return { rows: [], rules: [] };
  const fn = RF_CFG_DESCRIBERS[String(key || "")];
  try { return fn ? fn(preset) : _cdFallback(preset); }
  catch (e) { try { return _cdFallback(preset); } catch (e2) { return { rows: [], rules: [] }; } }
}
// Czy w ogóle jest co pokazać — panel bez ani jednego wiersza ma powiedzieć to wprost, a nie
// zostawić pustą ramkę, którą czyta się jak usterkę.
function rfCfgDescribeEmptyText() {
  return _cdT("Ten preset nie niesie żadnych ustawień.", "This preset carries no settings.");
}
