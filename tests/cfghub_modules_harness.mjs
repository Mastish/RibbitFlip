// HUB KONFIGURACJI W MYSZY I W MIDI/OSC, SPRAWDZONY PO STRONIE PANELU.
//
// Serwer pilnuje swojej połowy (test_mouse_config.py / test_midi_config.py), ale RYSUNEK składa
// przeglądarka — i to on jest odpowiedzią na zarzut, przez który ten etap powstał: „prosty,
// nieczytelny i ukryty pasek […] a nie wybór z biblioteki i nie jest świadomy user, że konfiguruje
// dany aktywny preset z autozapisem czy wymagając zapisu". Trzy rzeczy muszą być prawdziwe
// na kaflach, a nie tylko w danych: OPIS musi dojechać na kafel, CHIP musi stanąć przy swojej
// konfiguracji, a ZDANIE pod kaflami musi mówić co innego w każdym z czterech stanów.
//
// JEDEN PLIK NA DWA MODUŁY, bo adapter jest jedyną różnicą: `argv[2].module` = "mouse" | "midi".
// Dwie kopie tego samego harnessu rozjechałyby się przy pierwszej poprawce i nikt by nie zauważył,
// że jedna z nich przestała czegoś pilnować.
//
// ZASTĘPUJE tests/midi_bar_harness.mjs — jego asercje (dwie instancje nad jednym stanem, rozłączne
// id, podpięte handlery, kapsel z nazwą skasowanego presetu) są tu przepisane na hub, nie usunięte.
//
// Bez przeglądarki i bez serwera: moduły panelu (rf-49, rf-49i, rf-49c/rf-49d) to samowystarczalne
// pliki, więc wystarczy je uruchomić w `vm` z podstawionymi globalami i najmniejszym możliwym
// DOM-em. Mini-DOM jest tu CELOWY, a nie skrótem: sprawdzamy, co kod naprawdę zbudował z węzłów —
// i montujemy hub przez PRAWDZIWE `initMouseCfgHub` / `initMidiCfgHub`, bo montowanie to nie
// działanie (pułapka „montowanie to nie działanie” z .github/CONTRIBUTING.md: namespace potrafi wstać w 100% przy
// martwych przyciskach).
//
// Na wyjściu JSON {checks:[[nazwa, ok, szczegół], …]} — liczy je python, żeby podsumowanie było jedno.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const D = JSON.parse(process.argv[2] || "{}");
const MOD = (D.module === "midi") ? "midi" : "mouse";
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);
const clone = (o) => JSON.parse(JSON.stringify(o === undefined ? null : o));

// Co się w danym module nazywa jak — jedyne miejsce, w którym te dwa światy się różnią.
const M = MOD === "midi"
  ? { file: "web/js/rf-49d-midi-config.js", init: "initMidiCfgHub", sync: "midiCfgSync",
      adapter: "MIDI_CFG_ADAPTER", cards: [["midiCard", "midi"], ["oscCard", "osc"]],
      presetsUrl: "/midi-presets", saveUrl: "/midi-preset/save", nameUrl: "/midi",
      listVar: "midiPresets", descVar: "midiDescMax", hubs: "_midiCfgHubs",
      keeps: /kanał MIDI/, metric: /mapowa/ }
  : { file: "web/js/rf-49c-mouse-config.js", init: "initMouseCfgHub", sync: "mouseCfgSync",
      adapter: "MOUSE_CFG_ADAPTER", cards: [["mouseCard", "mouse"]],
      presetsUrl: "/mouse-presets", saveUrl: "/mouse-preset/save", nameUrl: "/airmouse",
      listVar: "mousePresets", descVar: "mouseDescMax", hubs: "_mouseCfgHub",
      keeps: /obszar kursora/, metric: /kursor|drążek|krzyżak/ };

// ---------------------------------------------------------------------------
//  NAJMNIEJSZY DOM, KTÓRY TEN KOD NAPRAWDĘ DOTYKA
// ---------------------------------------------------------------------------
const REG = Object.create(null);
class N {
  constructor(tag) {
    this.tagName = String(tag || "").toUpperCase();
    this.children = []; this.dataset = {}; this.attrs = {}; this._on = {};
    this.className = ""; this._id = ""; this.textContent = ""; this._html = "";
    this.title = ""; this.hidden = false; this.disabled = false; this.value = "";
    this._inserted = ""; this._head = null;
    this.style = { setProperty: (k, v) => { this.attrs["--style-" + k] = v; } };
    const has = (c) => (" " + this.className + " ").indexOf(" " + c + " ") >= 0;
    this.classList = {
      add: (c) => { if (!has(c)) this.className = (this.className + " " + c).trim(); },
      remove: (c) => { this.className = this.className.split(/\s+/).filter(x => x && x !== c).join(" "); },
      toggle: (c, on) => { const want = (on === undefined) ? !has(c) : !!on; if (want) this.classList.add(c); else this.classList.remove(c); },
      contains: has
    };
  }
  get id() { return this._id; }
  set id(v) { this._id = v; REG[v] = this; }
  get childNodes() { return this.children; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v == null ? "" : v); if (!this._html) this.children = []; }
  appendChild(n) { this.children.push(n); n.parentNode = this; return n; }
  addEventListener(t, fn) { (this._on[t] = this._on[t] || []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  removeAttribute(k) { delete this.attrs[k]; }
  contains() { return false; }             // activeElement jest null — ognisko nigdy tu nie stoi
  querySelector(sel) { return (sel === ".head") ? this._head : null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  // Tędy montuje się hub: `head.insertAdjacentHTML("afterend", hub.hubHtml())`. Rejestrujemy id-ki
  // z WYPISANEGO szablonu, a nie z listy wpisanej tutaj z ręki — zgubienie któregokolwiek w kodzie
  // wywraca wtedy ten harness, zamiast przejść niezauważone.
  insertAdjacentHTML(pos, html) {
    for (const m of String(html).matchAll(/id="([^"]+)"/g)) { const n = new N("div"); n.id = m[1]; }
    this._inserted += String(html);
    if (this.parentNode) this.parentNode._inserted = (this.parentNode._inserted || "") + String(html);
  }
}
function walk(node, out) { out = out || []; (node.children || []).forEach(c => { out.push(c); walk(c, out); }); return out; }
function byClass(root, cls) { return walk(root).filter(n => (" " + n.className + " ").indexOf(" " + cls + " ") >= 0); }
function textOf(node) {
  return [node.textContent || ""].concat(walk(node).map(n => n.textContent || "")).join(" ");
}

const document = {
  createElement: (t) => new N(t),
  getElementById: (i) => REG[i] || null,
  querySelectorAll: () => [],
  activeElement: null,
  addEventListener: () => {}
};
const store = {};
const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };

// ---------------------------------------------------------------------------
//  GLOBALE MODUŁÓW
// ---------------------------------------------------------------------------
const posted = [];                       // każde POST-owane zapytanie, do sprawdzenia treści zapisu
const said = [];                         // toasty
const asked = [];                        // okna z pytaniem o zgodę (rfConfirm)
const opened = [];                       // okna z polami (rfModal)
const items = D.items || [];
const ctx = {
  console, document, localStorage, Promise, JSON, Math, Object, Array, String, Number, Date, RegExp,
  performance: { now: () => Date.now() },
  I18N_EN: {},
  _lang: "pl",
  _gl: (pl) => pl,
  esc: (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
  rfToast: (m) => said.push(String(m)),
  // Okna zapisujemy zamiast pokazywać: sprawdzamy, CZY gest w ogóle je otworzył i co w nich stanęło.
  // Odpowiadamy „nie", żeby żaden test nie zapisał niczego przypadkiem.
  rfConfirm: (msg, opt) => { asked.push({ msg: String(msg), opt: opt || {} }); return Promise.resolve(false); },
  rfModal: (o) => { opened.push(o || {}); return Promise.resolve(null); },
  switchDevice: () => {},
  onMouseCfg: () => {}, onMidiCfg: () => {}, closeMidiEditor: () => {},
  padCapColor: (dev) => "#" + (dev === "d0" ? "e3506f" : dev === "d1" ? "3f9bd8" : "61b136"),
  capImgSpan: () => "",
  devEntry: (dev) => (ctx.state.devices[dev] = ctx.state.devices[dev] || { meta: { dev: dev } }),
  // GET-y odpowiadają wyłącznie za listę presetów. Konfiguracje POZOSTAŁYCH kapsli harness
  // podstawia wprost w `state.devices[…].mouseCfg/midiCfg` — czyli tam, gdzie w żywym panelu
  // wkłada je wolny obieg — więc wolny GET nie ma tu nic do dodania i mówi to wprost (`error`).
  // Gdyby odpowiadał pustym obiektem, WYMAZAŁBY podstawioną konfigurację i kropki „zmienione"
  // zgasłyby bez powodu.
  fetch: (url, opt) => {
    const u = String(url);
    if (opt && opt.method === "POST") {
      posted.push({ url: u, body: JSON.parse((opt && opt.body) || "{}") });
      return Promise.resolve({ json: () => Promise.resolve({ ok: true, configName: "" }) });
    }
    if (u.indexOf(M.presetsUrl) === 0) {
      return Promise.resolve({ json: () => Promise.resolve({ items: clone(items), descMax: 200 }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({ error: "harness" }) });
  },
  state: { devices: {}, activeDeviceId: "d0" }
};
ctx.window = ctx;
if (MOD === "mouse") {
  // MOUSE_KEYS czytamy z rf-15 — to JEST lista, z której panel odbudowuje state.mouse, więc odcisk
  // ma sens tylko wtedy, gdy obie strony biorą ją z tego samego miejsca.
  const rf15 = fs.readFileSync(path.join(REPO, "web/js/rf-15-motionmode.js"), "utf8");
  const m = /const MOUSE_KEYS=\[([\s\S]*?)\];/.exec(rf15);
  if (!m) {
    console.log(JSON.stringify({ checks: [["MOUSE_KEYS znalezione w rf-15", false, "brak listy"]] }));
    process.exit(0);
  }
  ctx.MOUSE_KEYS = new Function("return [" + m[1] + "]")();
}
vm.createContext(ctx);
// rf-49a dołożony 2026-08-29 (etap 3) — patrz komentarz w cfghub_harness.mjs: działania huba
// przeniosły się do wspólnego pliku, bo klika je też lista presetów modułu i Biblioteka.
for (const f of ["web/js/rf-49-cfgid.js", "web/js/rf-49a-cfgacts.js", "web/js/rf-49i-cfghub.js", M.file]) {
  vm.runInContext(fs.readFileSync(path.join(REPO, f), "utf8"), ctx);
}
const G = (n) => vm.runInContext(n, ctx);      // `const` modułu nie ląduje na obiekcie kontekstu
const A = G(M.adapter);
const state = ctx.state;

// ---------------------------------------------------------------------------
//  SCENA: dwie konfiguracje w bibliotece, trzy kapsle
// ---------------------------------------------------------------------------
// Jedna konfiguracja Z OPISEM i jedna BEZ — dwa kafle, które muszą wyglądać inaczej, i dwa stany
// zdania statusowego. Wybierane po treści, a nie po pozycji: serwer oddaje bibliotekę alfabetycznie,
// więc „items[0]" znaczyłoby „ta, której nazwa zaczyna się najwcześniej", czyli nic.
const P0 = items.find(p => p && p.desc) || { name: "", config: {}, desc: "" };
const P1 = items.find(p => p && !p.desc && p !== P0) || { name: "", config: {}, desc: "" };

// Kapsel „Triki 2" nosi P1, ale z ruszonym jednym polem — czyli dokładnie ten stan, o którym zdanie
// statusowe mówi „na kapslu już działa, w bibliotece jeszcze nie".
function dirtyCfg() {
  const c = clone(P1.config || {});
  if (MOD === "midi") {
    if (Array.isArray(c.mappings) && c.mappings[0]) c.mappings[0].cc = (+c.mappings[0].cc || 0) + 7;
    else c.scale = "blues";
  } else {
    c.sensX = (+c.sensX || 0) + 0.37;
  }
  c.configName = P1.name;
  return c;
}
const CFG_KEY = MOD === "midi" ? "midiCfg" : "mouseCfg";
function setScene(active) {
  const own = clone(P0.config || {}); own.configName = P0.name;
  state.devices = {
    d0: { meta: { dev: "d0", name: "Triki 1" } },
    d1: { meta: { dev: "d1", name: "Triki 2" } },
    d2: { meta: { dev: "d2", name: "Triki 3" } }
  };
  state.devices.d1[CFG_KEY] = dirtyCfg();
  const bez = clone(P1.config || {}); bez.configName = "";
  state.devices.d2[CFG_KEY] = bez;
  state.activeDeviceId = active || "d0";
  // Konfiguracja BIEŻĄCEGO kapsla mieszka w panelu (state.mouse / state.midi), a `*Dev` mówi,
  // CZYJA ona jest — bez tego drugiego pola panel zapisałby ustawienia poprzedniego kapsla pod
  // nazwą nowego. Hub czyta obie rzeczy, więc harness musi ustawić obie.
  if (MOD === "midi") { state.midi = clone(state.devices[state.activeDeviceId][CFG_KEY] || own); state.midiDev = state.activeDeviceId; }
  else { state.mouse = clone(state.devices[state.activeDeviceId][CFG_KEY] || own); state.mouseDev = state.activeDeviceId; }
  if (state.activeDeviceId === "d0") {
    if (MOD === "midi") state.midi = own; else state.mouse = own;
  }
}
setScene("d0");
state[M.listVar] = clone(items);

// ---------------------------------------------------------------------------
//  1. MONTOWANIE — przez PRAWDZIWE init, w prawdziwej karcie
// ---------------------------------------------------------------------------
const cards = {};
M.cards.forEach(pair => {
  const card = new N("div"); card.id = pair[0];
  const head = new N("div"); head.className = "head"; head.parentNode = card;
  card._head = head;
  cards[pair[1]] = card;
});
G(M.init + "()");
await new Promise(r => setTimeout(r, 0));      // lista presetów dojeżdża przez fetch().then()

const P = M.cards[0][1];                        // prefiks pierwszego (jedynego dla myszy) huba
const HUB = (pref, part) => document.getElementById(pref + "CfgHub" + (part || ""));

M.cards.forEach(pair => {
  ck("hub stoi w karcie " + pair[0], !!HUB(pair[1]), pair[1] + "CfgHub");
  // …i STARY CIENKI PASEK naprawdę zniknął z tej karty. Zostawiony obok huba byłby drugą
  // powierzchnią zapisującą ten sam plik — czyli dokładnie tym, co ten etap usuwa.
  ck("…a cienki pasek już nie", !document.getElementById(pair[1] + "CfgBar") &&
     (cards[pair[1]]._inserted || "").indexOf("rf-cfgbar") < 0,
     (cards[pair[1]]._inserted || "").slice(0, 80));
});
ck("moduł nie woła już fabryki paska (rfCfgIdCreate)",
   fs.readFileSync(path.join(REPO, M.file), "utf8").indexOf("rfCfgIdCreate") < 0);
// Stan {name, known, dirty} liczy JEDNA funkcja — dwie rozjechałyby się cicho.
ck("stan liczy wspólny rfCfgIdState, nie kopia w module",
   /function rfCfgIdState/.test(fs.readFileSync(path.join(REPO, "web/js/rf-49-cfgid.js"), "utf8")) &&
   /rfCfgIdState/.test(fs.readFileSync(path.join(REPO, "web/js/rf-49i-cfghub.js"), "utf8")));
ck("limit opisu przyjechał z serwera, nie z kopii w panelu",
   state[M.descVar] === 200 && A.descMax() === 200, state[M.descVar]);

G(M.init + "()");
const hubCount = MOD === "midi" ? G(M.hubs + ".length") : (G(M.hubs) ? 1 : 0);
ck("ponowny init nie dubluje hubów", hubCount === M.cards.length, hubCount);

// ---------------------------------------------------------------------------
//  2. KAFLE SKŁADAJĄ SIĘ Z BIBLIOTEKI — nazwa, OPIS i metryka
// ---------------------------------------------------------------------------
const TILES = (pref) => HUB(pref || P, "Tiles");
const FREE = (pref) => HUB(pref || P, "Free");
const STATUS = (pref) => HUB(pref || P, "Status");
const tiles = (pref) => TILES(pref).children.filter(n => (" " + n.className + " ").indexOf(" cfh-tile ") >= 0);
const tileByName = (nm, pref) => tiles(pref).find(t => t.dataset.name === nm);

ck("kafel na każdą konfigurację z biblioteki", tiles().length === items.length,
   tiles().length + " vs " + items.length);
ck("…plus kafel „+” na końcu",
   TILES().children.length === items.length + 1 &&
   byClass(TILES().children[TILES().children.length - 1], "cfh-add-tile").length === 1);
const t0 = tileByName(P0.name);
ck("kafel niesie nazwę konfiguracji", !!t0 && byClass(t0, "cfh-t-name")[0].textContent === P0.name,
   t0 && byClass(t0, "cfh-t-name")[0].textContent);
// TO JEST TA RZECZ, KTÓREJ PASEK NIE MIAŁ. Bez opisu na kaflu biblioteka jest listą skrótów.
ck("…i OPIS z serwera", !!t0 && byClass(t0, "cfh-t-desc")[0].textContent === P0.desc,
   t0 && byClass(t0, "cfh-t-desc")[0].textContent);
ck("…i metrykę, która mówi, co ta konfiguracja robi",
   !!t0 && M.metric.test(byClass(t0, "cfh-t-metric")[0].textContent || ""),
   t0 && byClass(t0, "cfh-t-metric")[0].textContent);
const noDesc = tiles().find(t => byClass(t, "cfh-t-desc")[0].className.indexOf("none") >= 0);
ck("konfiguracja bez opisu mówi „bez opisu”, a nie nic",
   !P1.desc ? (!!noDesc && /bez opisu/.test(textOf(noDesc))) : true,
   noDesc ? textOf(noDesc) : "(każda ma opis)");
ck("dwa kafle mają różne opisy", (P0.desc || "") !== (P1.desc || ""),
   (P0.desc || "") + " / " + (P1.desc || ""));

// ---------------------------------------------------------------------------
//  3. CHIP LĄDUJE NA WŁAŚCIWYM KAFLU (wg configName) I TYLKO NA NIM
// ---------------------------------------------------------------------------
const chipsOf = (t) => byClass(t, "cfh-chip").map(c => c.dataset.dev);
ck("chip kapsla stoi na kaflu jego konfiguracji", chipsOf(tileByName(P0.name)).join(",") === "d0",
   chipsOf(tileByName(P0.name)).join(","));
ck("…a drugi kapsel na swoim", chipsOf(tileByName(P1.name)).join(",") === "d1",
   chipsOf(tileByName(P1.name)).join(","));
ck("żaden kapsel nie stoi na dwóch kaflach naraz",
   tiles().reduce((n, t) => n + chipsOf(t).length, 0) === 2,
   tiles().map(t => t.dataset.name + ":" + chipsOf(t).join("|")).join("  "));
ck("chip niesie kolor kapsla (ten sam, co pas padów)",
   byClass(tileByName(P0.name), "cfh-chip")[0].attrs["--style---dcol"] === "#e3506f",
   byClass(tileByName(P0.name), "cfh-chip")[0].attrs["--style---dcol"]);
ck("chip bieżącego kapsla jest wyróżniony",
   byClass(tileByName(P0.name), "cfh-chip")[0].className.indexOf("active") >= 0,
   byClass(tileByName(P0.name), "cfh-chip")[0].className);
ck("…a chip cudzego nie",
   byClass(tileByName(P1.name), "cfh-chip")[0].className.indexOf("active") < 0);

// ---------------------------------------------------------------------------
//  4. KROPKA „ZMIENIONE” — liczona z odcisków, per kapsel, także cudzy
// ---------------------------------------------------------------------------
ck("kapsel zgodny z zapisaną wersją nie ma kropki",
   byClass(tileByName(P0.name), "cfh-dot").length === 0);
ck("kapsel z ruszonym ustawieniem MA kropkę — i to cudzy, nie bieżący",
   byClass(tileByName(P1.name), "cfh-dot").length === 1);
// ⚠️ NAJWAŻNIEJSZY POJEDYNCZY TEST TEJ FUNKCJI: kapsel zaraz po wczytaniu NIE MOŻE być „zmieniony”.
// Jedno pole odcisku za dużo i kropka świeci zawsze, czyli po tygodniu nikt jej nie czyta.
ck("odcisk kapsla == odcisk jego własnej konfiguracji",
   A.fingerprintOf("d0") === A.fingerprintPreset(P0),
   A.fingerprintOf("d0") + " vs " + A.fingerprintPreset(P0));
// Konfiguracja cudzego kapsla, która jeszcze nie dojechała, znaczy „nie wiadomo” — a nie „zmienione”.
const kept1 = state.devices.d1[CFG_KEY];
delete state.devices.d1[CFG_KEY];
ck("bez konfiguracji cudzego kapsla odcisk milczy (null), zamiast zgadywać",
   A.fingerprintOf("d1") === null, A.fingerprintOf("d1"));
G(M.sync + "()");
ck("…więc kafel nie stawia wtedy kropki",
   byClass(tileByName(P1.name) || TILES(), "cfh-dot").length === 0);
state.devices.d1[CFG_KEY] = kept1;
G(M.sync + "()");
// …i ta sama ostrożność dla BIEŻĄCEGO kapsla: zaraz po przełączeniu panel trzyma jeszcze
// konfigurację poprzedniego, więc odcisk z niej byłby kropką postawioną na cudzych danych.
const devKey = MOD === "midi" ? "midiDev" : "mouseDev";
const keptDev = state[devKey];
state[devKey] = null;
ck("konfiguracja bieżącego kapsla jeszcze w drodze = odcisk milczy",
   A.fingerprintOf("d0") === null, A.fingerprintOf("d0"));
// …i wtedy nie ma czego zapisywać pod nazwą — przycisk „+” mówi to zamiast zapisać cudze ustawienia.
G(M.sync + "()");
const addBusy = document.getElementById(P + "CfgHubAdd");
ck("„+” wyłączony, dopóki konfiguracja tego kapsla się wczytuje",
   addBusy.disabled === true && /wczytuj/.test(addBusy.title || ""), addBusy.title);
state[devKey] = keptDev;
G(M.sync + "()");

// ---------------------------------------------------------------------------
//  5. TACKA — kapsel bez nazwy stoi TAM, nie na kaflu
// ---------------------------------------------------------------------------
ck("kapsel bez nazwanej konfiguracji jest w tacce",
   byClass(FREE(), "cfh-chip").map(c => c.dataset.dev).join(",") === "d2",
   byClass(FREE(), "cfh-chip").map(c => c.dataset.dev).join(","));
ck("tacka nazywa siebie po ludzku", /Kapsle bez nazwanej konfiguracji/.test(textOf(FREE())), textOf(FREE()));
ck("chip z tacki ma listę „wczytaj konfigurację…” (ścieżka bez przeciągania)",
   byClass(FREE(), "cfh-pick").length === 1);

// ---------------------------------------------------------------------------
//  6. ZDANIE STATUSOWE — cztery stany, cztery różne zdania
// ---------------------------------------------------------------------------
function statusFor(active, mutate) {
  setScene(active);
  if (mutate) mutate();
  G(M.sync + "()");
  return { text: textOf(STATUS()), cls: STATUS().className,
           btns: walk(STATUS()).filter(n => n.tagName === "BUTTON").map(b => b.textContent) };
}
const sClean = statusFor("d0");
// „nosi" + an OPTIONAL phrase naming the kind of record + the name in quotes. MIDI/OSC puts one
// there (`kindOf` in its adapter words, rf-49d), because ONE record serves two tabs and this first
// line is the only place that says so; the mouse leaves it out and reads exactly as it did before.
ck("czysto: zdanie mówi, że zmiany zapisują się na kapslu same",
   /\snosi\s[^„]*„/.test(sClean.text) && /od razu/.test(sClean.text) && /^\s*Triki 1 /.test(sClean.text),
   sClean.text);
if (MOD === "midi")
  ck("…i nazywa rekord wspólny dla MIDI i OSC",
     /nosi wspólną konfigurację MIDI i OSC „/.test(sClean.text), sClean.text);
ck("…i nie ma wtedy czego zapisywać ani odrzucać", sClean.btns.length === 0, sClean.btns.join("|"));

const sDirty = statusFor("d1");
// TO JEST ODPOWIEDŹ NA TRZECI ZARZUT: model zapisu wyłożony zdaniem, a nie jednym słowem „zmienione”.
ck("zmienione: zdanie rozdziela kapsel od biblioteki",
   /Na kapslu wszystko już działa/.test(sDirty.text) && /w bibliotece zmieni się dopiero/.test(sDirty.text),
   sDirty.text);
ck("…i przyciski stoją PRZY tym zdaniu",
   sDirty.btns.length === 2 && /Zapisz zmiany/.test(sDirty.btns[0]) && /Przywróć/.test(sDirty.btns[1]),
   sDirty.btns.join("|"));
ck("…a stan jest zaznaczony klasą", /is-dirty/.test(sDirty.cls), sDirty.cls);

const sNone = statusFor("d2");
// Rzeczownik w tym zdaniu MUSI być ten sam, co na przycisku pod nim („Utwórz preset",
// w kole „Utwórz koło") — dlatego zdanie idzie przez słownik adaptera (`noNameDev`, wzór
// z `{kto}` składany przez `_cfgNoNameDev`), a słowo „konfigurację" z niego znikło.
// Brzmienie z syntezy UX 2026-11-20 (3.12): imię kapsla w środku, bez pauzy.
ck("bez nazwy: zdanie zachęca do zapisania, zamiast straszyć",
   /działa(ją)? na \S.*, ale nie ma(ją)? nazwy\./.test(sNone.text) && /jako preset|jako nowe koło/.test(sNone.text)
   && !/konfigurację|\{kto\}|—/.test(sNone.text), sNone.text);
ck("…i nie oferuje „Zapisz zmiany”, bo nie ma czego nadpisać",
   sNone.btns.join("|").indexOf("Zapisz zmiany") < 0, sNone.btns.join("|"));

const sGone = statusFor("d0", () => {
  // Kapsel nosi nazwę, której w bibliotece nie ma — bo ktoś skasował preset albo przyszedł zestaw
  // z cudzą nazwą. Ustawienia SĄ na kapslu, więc to nie jest „kapsel zgubił konfigurację".
  if (MOD === "midi") state.midi.configName = "Nie ma takiej";
  else state.mouse.configName = "Nie ma takiej";
});
ck("skasowana konfiguracja: zdanie mówi, że ustawienia SĄ na kapslu",
   /nie ma już na liście/.test(sGone.text) && /Ustawienia są na kapslu/.test(sGone.text), sGone.text);
ck("…i daje jedyne wyjście: zapisz z powrotem",
   sGone.btns.join("|").indexOf("Zapisz z powrotem") >= 0, sGone.btns.join("|"));
ck("cztery stany to cztery RÓŻNE zdania",
   new Set([sClean.text, sDirty.text, sNone.text, sGone.text]).size === 4);
// Kapsel z nazwą spoza biblioteki dostaje kafel-ducha, a nie znika z rysunku.
ck("…a noszący ją kapsel ma swój kafel-ducha",
   !!tiles().find(t => t.dataset.name === "Nie ma takiej" && /is-gone/.test(t.className)),
   tiles().map(t => t.dataset.name + "[" + t.className + "]").join(" "));
setScene("d0"); G(M.sync + "()");

// ---------------------------------------------------------------------------
//  7. ZAPIS: opis i treść nie kasują się nawzajem
// ---------------------------------------------------------------------------
posted.length = 0;
A.overwrite(P0.name, () => {});
const ov = posted.find(p => p.url.indexOf(M.saveUrl) >= 0);
ck("„Zapisz zmiany” wysyła opis, który konfiguracja już ma",
   !!ov && ov.body.desc === P0.desc, ov && JSON.stringify(ov.body.desc));
ck("…i wysyła ustawienia z kapsla, nie z pliku", !!ov && !!ov.body.config);
// Poprawka opisu idzie w drugą stronę: treść z PLIKU, żeby nie zapisać tego, co ktoś majstruje.
posted.length = 0;
A.savePresetMeta(P0, P0.name, "Inny opis", () => {});
const meta = posted.find(p => p.url.indexOf(M.saveUrl) >= 0);
ck("poprawka opisu nie rusza ustawień kapsla",
   !!meta && meta.body.desc === "Inny opis" &&
   JSON.stringify(meta.body.config) === JSON.stringify(P0.config),
   meta && JSON.stringify(meta.body).slice(0, 120));
// Zdjęcie samej nazwy z CUDZEGO kapsla musi celować w tamten kapsel i nie nieść ani jednego ustawienia.
posted.length = 0;
A.setCfgNameOn("d1", "", () => {});
const un = posted[0];
ck("zdjęcie nazwy celuje we wskazany kapsel i nie niesie ustawień",
   !!un && un.url.indexOf(M.nameUrl + "?dev=d1") === 0 && un.body.configName === "" &&
   !("config" in un.body) && !("mappings" in un.body) && !("sensX" in un.body),
   un && un.url + " " + JSON.stringify(un.body));

// ---------------------------------------------------------------------------
//  8. GESTY NAPRAWDĘ ODPALAJĄ SWOJE OKNA (pułapka „montowanie to nie działanie”: kod bez zarzutu, nigdy nie wykonany)
// ---------------------------------------------------------------------------
setScene("d0"); G(M.sync + "()");
const noop = { preventDefault() {}, stopPropagation() {}, dataTransfer: { getData: () => "", dropEffect: "", setData() {} } };
const fire = (node, type, ev) => (node._on[type] || []).forEach(fn => fn(ev || noop));

asked.length = 0;
const target = tileByName(P1.name);
fire(target, "dragover", noop);
ck("kafel nie podświetla się, gdy nic nie leci", target.className.indexOf(" drop") < 0, target.className);
fire(byClass(FREE(), "cfh-chip")[0], "dragstart", { dataTransfer: { setData() {}, effectAllowed: "" } });
fire(target, "dragover", noop);
ck("kafel przyjmuje upuszczenie (podświetla się)", target.className.indexOf(" drop") >= 0, target.className);
fire(target, "drop", { preventDefault() {}, dataTransfer: { getData: () => "d2" } });
fire(byClass(FREE(), "cfh-chip")[0], "dragend", noop);
ck("upuszczenie chipa na kafel pyta o zgodę, zamiast wczytywać po cichu", asked.length === 1,
   asked.map(a => a.msg).join(" | "));
ck("…a pytanie nazywa KONFIGURACJĘ i KAPSEL, nie „na pewno?”",
   asked.length === 1 && (asked[0].opt.title || "").indexOf(P1.name) >= 0 &&
   /Triki 3/.test(asked[0].opt.title || "") && /Triki 3/.test(asked[0].msg),
   asked.length ? (asked[0].opt.title + " || " + asked[0].msg) : "");
// GRANICA PRESETU wyłożona w oknie: co zostaje przy kapslu-CELU mimo wczytania.
ck("…i mówi, co przy kapslu-celu ZOSTAJE (przełącznik i stanowisko)",
   asked.length === 1 && M.keeps.test(asked[0].msg), asked.length ? asked[0].msg : "");
ck("…oraz że niezapisane ustawienia kapsla przepadną",
   asked.length === 1 && /przepadn/.test(asked[0].msg), asked.length ? asked[0].msg : "");

asked.length = 0;
fire(tileByName(P0.name), "drop", { preventDefault() {}, dataTransfer: { getData: () => "d0" } });
ck("upuszczenie na kafel, który kapsel już nosi, nic nie pyta", asked.length === 0);

// Ta sama czynność bez przeciągania: lista „Wczytaj na…” na kaflu.
const slug = (s) => String(s || "").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40);
asked.length = 0;
const load = document.getElementById(P + "CfgHubLoad_" + slug(P1.name));
ck("kafel ma listę „Wczytaj na…” z kapslami", !!load && /d2/.test(load.innerHTML), load && load.innerHTML);
if (load) { load.value = "d2"; load.onchange(); }
ck("…i wybór z niej pyta dokładnie tak samo, jak przeciągnięcie", asked.length === 1,
   asked.map(a => a.msg).join(" | "));

// Tacka: upuszczenie kapsla Z nazwą zdejmuje sam podpis, bez okna, i mówi to w toaście.
asked.length = 0; posted.length = 0; said.length = 0;
fire(FREE(), "drop", { preventDefault() {}, dataTransfer: { getData: () => "d0" } });
ck("upuszczenie na tackę nie otwiera okna (nic się nie niszczy)", asked.length === 0);
ck("…tylko zdejmuje SAMĄ nazwę", posted.length === 1 && posted[0].body.configName === "" &&
   !("config" in posted[0].body), JSON.stringify(posted[0] || {}));
await new Promise(r => setTimeout(r, 0));
ck("…i mówi, co zostało nietknięte",
   said.length === 1 && (MOD === "midi" ? /Mapowania zostały bez zmian/ : /Ustawienia ruchu zostały bez zmian/).test(said[0]),
   said.join(" | "));

// ✎ i ✕ na kaflu.
setScene("d0"); G(M.sync + "()");
opened.length = 0;
document.getElementById(P + "CfgHubRen_" + slug(P0.name)).onclick(noop);
ck("✎ otwiera okno z polem nazwy I polem opisu",
   opened.length === 1 && !!opened[0].input && !!opened[0].textarea,
   JSON.stringify(Object.keys(opened[0] || {})));
ck("…z opisem, który konfiguracja już ma", opened.length === 1 && opened[0].textarea.value === P0.desc,
   opened.length ? opened[0].textarea.value : "");
ck("…i z limitem długości wziętym z serwera",
   opened.length === 1 && opened[0].textarea.maxLength === state[M.descVar],
   opened.length ? opened[0].textarea.maxLength : "");
asked.length = 0;
document.getElementById(P + "CfgHubDel_" + slug(P0.name)).onclick(noop);
ck("✕ pyta przed usunięciem i mówi, co stanie się z noszącymi kapslami",
   asked.length === 1 && asked[0].opt.tone === "danger" && /nie ma już na liście/.test(asked[0].msg),
   asked.length ? asked[0].msg : "");

opened.length = 0;
document.getElementById(P + "CfgHubAdd").onclick(noop);
ck("kafel „+” otwiera okno z nazwą i opisem",
   opened.length === 1 && !!opened[0].input && !!opened[0].textarea);
ck("…puste, bo to NOWA konfiguracja",
   opened.length === 1 && !opened[0].input.value && !opened[0].textarea.value);
ck("zwijanie ma podpięty handler", typeof HUB(P, "Fold").onclick === "function");

// ---------------------------------------------------------------------------
//  9. DWA HUBY, JEDEN STAN (tylko MIDI/OSC — to jest cała różnica tego modułu)
// ---------------------------------------------------------------------------
if (MOD === "midi") {
  ck("id obu hubów są rozłączne",
     !!HUB("midi", "Tiles") && !!HUB("osc", "Tiles") && HUB("midi", "Tiles") !== HUB("osc", "Tiles"));
  ck("…i oba mają swój kafel „+”",
     !!document.getElementById("midiCfgHubAdd") && !!document.getElementById("oscCfgHubAdd"));
  // ZWIJANIE JEST OSOBNE, i to celowo: wspólny klucz znaczyłby, że ktoś od TouchOSC zwija sekcję
  // jednocześnie komuś, kto stroi CC do DAW-a. Stan jest wspólny, WIDOK nie.
  HUB("midi", "Fold").onclick();
  ck("zwinięcie jednej zakładki nie zwija drugiej",
     HUB("midi", "Body").hidden === true && HUB("osc", "Body").hidden === false,
     HUB("midi", "Body").hidden + " / " + HUB("osc", "Body").hidden);
  ck("…bo klucz zwijania jest per zakładka",
     Object.keys(store).some(k => /cfghub\.midi$/.test(k)) &&
     !Object.keys(store).some(k => /cfghub\.osc$/.test(k)), Object.keys(store).join(","));
  HUB("midi", "Fold").onclick();

  // …ale STAN jest jeden: zmiana zestawu widać w obu kaflach naraz.
  setScene("d0"); G(M.sync + "()");
  ck("nietknięty zestaw nie ma kropki w ŻADNEJ z zakładek",
     byClass(tileByName(P0.name, "midi"), "cfh-dot").length === 0 &&
     byClass(tileByName(P0.name, "osc"), "cfh-dot").length === 0);
  if (Array.isArray(state.midi.mappings) && state.midi.mappings[0]) {
    state.midi.mappings[0].cc = (+state.midi.mappings[0].cc || 0) + 13;
  } else state.midi.scale = "blues";
  G(M.sync + "()");
  ck("po zmianie CC OBA huby stawiają kropkę przy tym samym kapslu",
     byClass(tileByName(P0.name, "midi"), "cfh-dot").length === 1 &&
     byClass(tileByName(P0.name, "osc"), "cfh-dot").length === 1,
     byClass(tileByName(P0.name, "midi"), "cfh-dot").length + " / " +
     byClass(tileByName(P0.name, "osc"), "cfh-dot").length);
  ck("…i OBA mówią to samo zdanie o zapisie",
     /w bibliotece zmieni się dopiero/.test(textOf(STATUS("midi"))) &&
     /w bibliotece zmieni się dopiero/.test(textOf(STATUS("osc"))),
     textOf(STATUS("osc")));
  ck("…a „Zapisz zmiany” stoi w obu",
     walk(STATUS("midi")).some(n => /Zapisz zmiany/.test(n.textContent || "")) &&
     walk(STATUS("osc")).some(n => /Zapisz zmiany/.test(n.textContent || "")));
  setScene("d0"); G(M.sync + "()");
}

// ---------------------------------------------------------------------------
//  10. PODPIĘCIE W PANELU — kolejność skryptów i bootstrap
// ---------------------------------------------------------------------------
const html = fs.readFileSync(path.join(REPO, "web/ribbitflip_dashboard.html"), "utf8");
const boot = fs.readFileSync(path.join(REPO, "web/js/rf-40-boot.js"), "utf8");
const modFile = path.basename(M.file);
ck("hub ładowany PRZED modułem, który go woła",
   html.indexOf("rf-49i-cfghub.js") > 0 && html.indexOf("rf-49i-cfghub.js") < html.indexOf(modFile),
   html.indexOf("rf-49i-cfghub.js") + " / " + html.indexOf(modFile));
ck("…a rf-49 (rfCfgIdState) przed hubem",
   html.indexOf("rf-49-cfgid.js") < html.indexOf("rf-49i-cfghub.js"));
ck("bootstrap woła " + M.init, new RegExp("\\b" + M.init + "\\b").test(boot));
ck("…i nie woła już nieistniejącego init paska",
   !new RegExp("\\b" + M.init.replace("Hub", "Bar") + "\\b").test(boot));

console.log(JSON.stringify({ checks }));
