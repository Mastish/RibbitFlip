// HUB KONFIGURACJI, SPRAWDZONY PO STRONIE PANELU.
//
// Serwer pilnuje swojej połowy (test_profile_desc.py), ale RYSUNEK składa przeglądarka — i to on
// jest odpowiedzią na zarzut, przez który ten etap w ogóle powstał: „prosty, nieczytelny i ukryty
// pasek […] a nie wybór z biblioteki i nie jest świadomy user, że konfiguruje dany aktywny preset
// z autozapisem czy wymagając zapisu". Trzy rzeczy muszą więc być prawdziwe na kaflach, a nie tylko
// w danych: opis MUSI dojechać na kafel, chip MUSI stanąć przy swojej konfiguracji, a zdanie pod
// kaflami MUSI mówić co innego w każdym z czterech stanów. Żadnej z nich nie widać w teście
// serwera, i żadnej nie widać w teście, który liczy same odciski.
//
// Bez przeglądarki i bez serwera: moduły panelu (rf-49, rf-49b, rf-49i) to samowystarczalne pliki,
// więc wystarczy je uruchomić w `vm` z podstawionymi globalami i najmniejszym możliwym DOM-em.
// Mini-DOM jest tu CELOWY, a nie skrótem: sprawdzamy, co kod naprawdę zbudował z węzłów, a nie co
// zwróciła funkcja, którą sami wywołaliśmy.
//
// Wywoływane z tests/test_profile_desc.py: argv[2] = {items} (biblioteka prosto z serwera, po jego
// sanityzacji), na wyjściu JSON {checks:[[nazwa, ok, szczegół], …]} — liczy je python, żeby
// podsumowanie było jedno.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const D = JSON.parse(process.argv[2] || "{}");
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);
const clone = (o) => JSON.parse(JSON.stringify(o));

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
  querySelectorAll() { return []; }
  closest() { return null; }
}
function walk(node, out) { out = out || []; (node.children || []).forEach(c => { out.push(c); walk(c, out); }); return out; }
function byClass(root, cls) { return walk(root).filter(n => (" " + n.className + " ").indexOf(" " + cls + " ") >= 0); }
function textOf(node) {
  // Tekst kafla to jego własny tekst plus tekst dzieci — wystarczy do „czy opis w ogóle dojechał”.
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
  renderRules: () => {},
  loadProfileList: () => {},
  padCapColor: (dev) => "#" + (dev === "d0" ? "e3506f" : dev === "d1" ? "3f9bd8" : "61b136"),
  capImgSpan: () => "",
  devEntry: (dev) => (ctx.state.devices[dev] = ctx.state.devices[dev] || { meta: { dev: dev } }),
  fetch: (url, opt) => {
    posted.push({ url: String(url), body: JSON.parse((opt && opt.body) || "{}") });
    return Promise.resolve({ json: () => Promise.resolve({ ok: true, rules: [], configName: "" }) });
  },
  state: { devices: {}, activeDeviceId: "d0", rules: [], trigPresets: [], trigDescMax: 200 }
};
ctx.window = ctx;
vm.createContext(ctx);
// rf-49a dołożony 2026-08-29 (etap 3): sześć działań huba (wczytaj na kapsel, zdejmij nazwę,
// nazwa i opis, usuń, zapisz zmiany, przywróć) mieszka od tej pory tam, bo klika je też lista
// presetów modułu i panel opisu Biblioteki. Hub je wywołuje, więc bez tego pliku pada na starcie.
for (const f of ["web/js/rf-49-cfgid.js", "web/js/rf-49a-cfgacts.js", "web/js/rf-49b-trig-config.js", "web/js/rf-49i-cfghub.js"]) {
  vm.runInContext(fs.readFileSync(path.join(REPO, f), "utf8"), ctx);
}
const G = (n) => vm.runInContext(n, ctx);      // `const` modułu nie ląduje na obiekcie kontekstu
const A = G("TRIG_CFG_ADAPTER");
const state = ctx.state;

// ---------------------------------------------------------------------------
//  SCENA: dwie konfiguracje w bibliotece, trzy kapsle
// ---------------------------------------------------------------------------
const items = D.items || [];
state.trigPresets = items;
// Jedna konfiguracja Z OPISEM i jedna BEZ — dwa kafle, które muszą wyglądać inaczej, i dwa stany
// zdania statusowego. Wybierane po treści, a nie po pozycji: serwer oddaje bibliotekę alfabetycznie,
// więc „items[0]" znaczyłoby „ta, której nazwa zaczyna się najwcześniej", czyli nic.
const P0 = items.find(p => p && p.desc) || { name: "", rules: [], desc: "" };
const P1 = items.find(p => p && !p.desc && p !== P0) || { name: "", rules: [], desc: "" };

// „Triki 2” ma tę samą konfigurację co preset, ale z ruszonym progiem — czyli dokładnie ten stan,
// o którym zdanie statusowe mówi „na kapslu już działa, w bibliotece jeszcze nie”.
const dirtyRules = clone(P1.rules || []);
if (dirtyRules[0]) dirtyRules[0].threshold = (+dirtyRules[0].threshold || 0) + 1234;

function setScene(active) {
  state.devices = {
    d0: { meta: { dev: "d0", name: "Triki 1" }, cfgName: P0.name, rules: clone(P0.rules || []) },
    d1: { meta: { dev: "d1", name: "Triki 2" }, cfgName: P1.name, rules: dirtyRules },
    d2: { meta: { dev: "d2", name: "Triki 3" }, cfgName: "", rules: [] }
  };
  state.activeDeviceId = active || "d0";
  state.rules = state.devices[state.activeDeviceId].rules;
}
setScene("d0");

// Szkielet z PRAWDZIWEGO hubHtml(): id-ki wyciągamy z tego, co komponent naprawdę wypisuje, więc
// zgubienie któregokolwiek w szablonie wywraca ten harness zamiast przejść niezauważone.
const hub = G("rfCfgHubCreate")(A);
const skeleton = hub.hubHtml();
const ids = (skeleton.match(/id="([^"]+)"/g) || []).map(s => s.slice(4, -1));
ids.forEach(i => { const n = new N("div"); n.id = i; });
ck("szkielet huba niesie wszystkie potrzebne id",
   ["trigCfgHub", "trigCfgHubBody", "trigCfgHubSum", "trigCfgHubFold",
    "trigCfgHubFree", "trigCfgHubTiles", "trigCfgHubStatus"].every(i => ids.indexOf(i) >= 0),
   ids.join(","));
// Przycisk „Wymiana” musi zachować swoje id: celują w nie rf-39l (podpięcie okna) i przewodnik rf-39m.
ck("„Wymiana” zachowała id profDiscord", ids.indexOf("profDiscord") >= 0, ids.join(","));

hub.wire();
const TILES = () => document.getElementById("trigCfgHubTiles");
const FREE = () => document.getElementById("trigCfgHubFree");
const STATUS = () => document.getElementById("trigCfgHubStatus");
const tiles = () => TILES().children.filter(n => (" " + n.className + " ").indexOf(" cfh-tile ") >= 0);
const tileByName = (nm) => tiles().find(t => t.dataset.name === nm);

// ---------------------------------------------------------------------------
//  1. KAFLE SKŁADAJĄ SIĘ Z BIBLIOTEKI — nazwa, OPIS i metryka
// ---------------------------------------------------------------------------
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
ck("…i metrykę („N wyzwalaczy”)",
   !!t0 && /wyzwalacz/.test(byClass(t0, "cfh-t-metric")[0].textContent || ""),
   t0 && byClass(t0, "cfh-t-metric")[0].textContent);
// Preset bez opisu nie może udawać, że go ma — ani pokazywać pustego miejsca bez wyjaśnienia.
const noDesc = tiles().find(t => byClass(t, "cfh-t-desc")[0].className.indexOf("none") >= 0);
ck("konfiguracja bez opisu mówi „bez opisu”, a nie nic",
   !P1.desc ? (!!noDesc && /bez opisu/.test(textOf(noDesc))) : true,
   noDesc ? textOf(noDesc) : "(każda ma opis)");
// Kafel MUSI dać się odróżnić po opisie, nie tylko po nazwie — o to poszło w feedbacku.
ck("dwa kafle mają różne opisy", (P0.desc || "") !== (P1.desc || ""),
   (P0.desc || "") + " / " + (P1.desc || ""));

// ---------------------------------------------------------------------------
//  2. CHIP LĄDUJE NA WŁAŚCIWYM KAFLU (wg configName) I TYLKO NA NIM
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
//  3. KROPKA „ZMIENIONE” — liczona z odcisków, per kapsel, także cudzy
// ---------------------------------------------------------------------------
ck("kapsel zgodny z zapisaną wersją nie ma kropki",
   byClass(tileByName(P0.name), "cfh-dot").length === 0);
ck("kapsel z ruszonym progiem MA kropkę — i to cudzy, nie bieżący",
   byClass(tileByName(P1.name), "cfh-dot").length === 1);
// ⚠️ NAJWAŻNIEJSZY POJEDYNCZY TEST TEJ FUNKCJI: kapsel zaraz po wczytaniu NIE MOŻE być „zmieniony”.
// Jedno pole odcisku za dużo i kropka świeci zawsze, czyli po tygodniu nikt jej nie czyta.
ck("odcisk kapsla == odcisk jego własnej konfiguracji",
   A.fingerprintOf("d0") === A.fingerprintPreset(P0),
   A.fingerprintOf("d0") + " vs " + A.fingerprintPreset(P0));
// Reguły cudzego kapsla, które jeszcze nie dojechały, znaczą „nie wiadomo” — a nie „zmienione”.
const hadRules = state.devices.d1.rules;
delete state.devices.d1.rules;
ck("bez reguł cudzego kapsla odcisk milczy (null), zamiast zgadywać",
   A.fingerprintOf("d1") === null, A.fingerprintOf("d1"));
hub.sync();
ck("…więc kafel nie stawia wtedy kropki",
   byClass(tileByName(P1.name), "cfh-dot").length === 0);
state.devices.d1.rules = hadRules;
hub.sync();

// ---------------------------------------------------------------------------
//  4. TACKA — kapsel bez nazwy stoi TAM, nie na kaflu
// ---------------------------------------------------------------------------
ck("kapsel bez nazwanej konfiguracji jest w tacce",
   byClass(FREE(), "cfh-chip").map(c => c.dataset.dev).join(",") === "d2",
   byClass(FREE(), "cfh-chip").map(c => c.dataset.dev).join(","));
ck("tacka nazywa siebie po ludzku", /Kapsle bez nazwanej konfiguracji/.test(textOf(FREE())), textOf(FREE()));
ck("chip z tacki ma listę „wczytaj konfigurację…” (ścieżka bez przeciągania)",
   byClass(FREE(), "cfh-pick").length === 1);
// Pusta tacka NIE ZNIKA: pusty cel upuszczenia, który widać, to jedyna rzecz, dzięki której ten
// gest da się odkryć.
const keptTray = state.devices.d2;
delete state.devices.d2; hub.sync();
ck("pusta tacka zostaje na ekranie i mówi, po co jest",
   byClass(FREE(), "cfh-free-hint").length === 1 && /przeciągnij/.test(textOf(FREE())), textOf(FREE()));
state.devices.d2 = keptTray; hub.sync();

// ---------------------------------------------------------------------------
//  5. ZDANIE STATUSOWE — cztery stany, cztery różne zdania
// ---------------------------------------------------------------------------
function statusFor(active, mutate) {
  setScene(active);
  if (mutate) mutate();
  hub.sync();
  return { text: textOf(STATUS()), cls: STATUS().className,
           btns: walk(STATUS()).filter(n => n.tagName === "BUTTON").map(b => b.textContent) };
}
const sClean = statusFor("d0");
ck("czysto: zdanie mówi, że zmiany zapisują się na kapslu same",
   /nosi „/.test(sClean.text) && /od razu/.test(sClean.text) && /^\s*Triki 1 /.test(sClean.text),
   sClean.text);
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

const sGone = statusFor("d0", () => { state.devices.d0.cfgName = "Nie ma takiej"; });
ck("skasowana konfiguracja: zdanie mówi, że ustawienia SĄ na kapslu",
   /nie ma już na liście/.test(sGone.text) && /Ustawienia są na kapslu/.test(sGone.text), sGone.text);
ck("…i daje jedyne wyjście: zapisz z powrotem",
   sGone.btns.join("|").indexOf("Zapisz z powrotem") >= 0, sGone.btns.join("|"));
ck("cztery stany to cztery RÓŻNE zdania",
   new Set([sClean.text, sDirty.text, sNone.text, sGone.text]).size === 4);
// Kapsel z nazwą spoza biblioteki dostaje kafel-ducha, a nie znika z rysunku.
ck("…a nosząca go kapsel ma swój kafel-ducha",
   !!tiles().find(t => t.dataset.name === "Nie ma takiej" && /is-gone/.test(t.className)),
   tiles().map(t => t.dataset.name + "[" + t.className + "]").join(" "));

// ---------------------------------------------------------------------------
//  6. STRESZCZENIE PO ZWINIĘCIU — zwinięta sekcja też odpowiada „kto co nosi”
// ---------------------------------------------------------------------------
setScene("d0"); hub.sync();
document.getElementById("trigCfgHubFold").onclick();
const sum = document.getElementById("trigCfgHubSum").textContent;
ck("zwinięta sekcja wymienia wszystkie kapsle", /Triki 1/.test(sum) && /Triki 2/.test(sum) && /Triki 3/.test(sum), sum);
ck("…z nazwą konfiguracji przy każdym", sum.indexOf(P0.name) >= 0 && sum.indexOf(P1.name) >= 0, sum);
ck("…i ze stanem, a nie samą nazwą", /zmienione/.test(sum) && /bez nazwy/.test(sum), sum);
ck("zwinięcie chowa treść, nie sekcję",
   document.getElementById("trigCfgHubBody").hidden === true &&
   document.getElementById("trigCfgHub").className.indexOf("is-folded") >= 0);
document.getElementById("trigCfgHubFold").onclick();
ck("…i wraca po ponownym kliknięciu",
   document.getElementById("trigCfgHubBody").hidden === false &&
   document.getElementById("trigCfgHubSum").textContent === "");

// ---------------------------------------------------------------------------
//  7. ODŚWIEŻENIE BEZ ZMIAN NIE RUSZA DOM-U (bo ruszenie zabrałoby ognisko)
// ---------------------------------------------------------------------------
hub.sync();
const before = TILES().children[0];
hub.sync(); hub.sync();
ck("sync bez zmian nie przerysowuje kafli", TILES().children[0] === before);
state.devices.d0.cfgName = "";
hub.sync();
ck("…ale realna zmiana przerysowuje", TILES().children[0] !== before ||
   byClass(TILES(), "cfh-chip").length !== 3);
setScene("d0"); hub.sync();

// ---------------------------------------------------------------------------
//  8. ZAPIS: „Zapisz zmiany” NIE MOŻE SKASOWAĆ OPISU
// ---------------------------------------------------------------------------
// Nadpisanie idzie tą samą drogą, co „Zapisz jako…” — a ta wysyła `desc`. Bez oddania opisu, który
// preset już ma, każdy zapis reguł kasowałby go po cichu i bez śladu w interfejsie.
posted.length = 0;
A.overwrite(P0.name, () => {});
const ov = posted.find(p => p.url.indexOf("/profile/save") >= 0);
ck("„Zapisz zmiany” wysyła opis, który konfiguracja już ma",
   !!ov && ov.body.desc === P0.desc, ov && JSON.stringify(ov.body.desc));
ck("…i wysyła reguły z kapsla, nie z pliku", !!ov && Array.isArray(ov.body.rules));
// Poprawka opisu idzie w drugą stronę: reguły z PLIKU, żeby nie zapisać tego, co ktoś majstruje.
posted.length = 0;
A.savePresetMeta(P0, P0.name, "Inny opis", () => {});
const meta = posted.find(p => p.url.indexOf("/profile/save") >= 0);
ck("poprawka opisu nie rusza reguł kapsla",
   !!meta && meta.body.desc === "Inny opis" &&
   JSON.stringify(meta.body.rules) === JSON.stringify(P0.rules),
   meta && JSON.stringify(meta.body).slice(0, 120));
// Zdjęcie samej nazwy z CUDZEGO kapsla musi celować w tamten kapsel i nie nieść ani jednej reguły.
posted.length = 0;
A.setCfgNameOn("d1", "", () => {});
const un = posted[0];
ck("zdjęcie nazwy celuje w wskazany kapsel i nie niesie reguł",
   !!un && /\/rules\?dev=d1$/.test(un.url) && un.body.configName === "" && !("rules" in un.body),
   un && un.url + " " + JSON.stringify(un.body));

// ---------------------------------------------------------------------------
//  8b. GESTY NAPRAWDĘ ODPALAJĄ SWOJE OKNA
// ---------------------------------------------------------------------------
// Sprawdzenie, że kafel wygląda dobrze, nic nie mówi o tym, czy da się go użyć. Handlery żyją na
// węzłach zbudowanych przez `sync`, więc odpalamy je tak, jak zrobi to przeglądarka — to jedyny
// sposób, żeby złapać wyjątek w kodzie, który uruchamia się dopiero po kliknięciu. (Pułapka 6
// z reguły o dzieleniu plików: kod bez zarzutu, który nie wykonuje się ani razu.)
setScene("d0"); hub.sync();
const noop = { preventDefault() {}, stopPropagation() {}, dataTransfer: { getData: () => "", dropEffect: "", setData() {} } };
const fire = (node, type, ev) => (node._on[type] || []).forEach(fn => fn(ev || noop));

// Upuszczenie chipa kapsla BEZ nazwy na kafel = wczytanie tamtej konfiguracji na ten kapsel.
asked.length = 0;
const target = tileByName(P1.name);
// Najpierw złapanie chipa — bez tego kafel nie ma czego przyjąć, i to jest właśnie ta gałąź, którą
// trzeba sprawdzić: strona nie może się podświetlać, kiedy nic nie leci.
fire(target, "dragover", noop);
ck("kafel nie podświetla się, gdy nic nie leci", target.className.indexOf(" drop") < 0, target.className);
fire(byClass(FREE(), "cfh-chip")[0], "dragstart",
     { dataTransfer: { setData() {}, effectAllowed: "" } });
fire(target, "dragover", noop);
ck("kafel przyjmuje upuszczenie (podświetla się)", target.className.indexOf(" drop") >= 0, target.className);
fire(target, "drop", { preventDefault() {}, dataTransfer: { getData: () => "d2" } });
fire(byClass(FREE(), "cfh-chip")[0], "dragend", noop);
ck("upuszczenie chipa na kafel pyta o zgodę, zamiast wczytywać po cichu", asked.length === 1,
   asked.map(a => a.msg).join(" | "));
// Tytuł nazywa OBIE strony („Wczytać „X” na Triki 3?”), treść mówi, co zastąpi co — pytanie
// „na pewno?” bez tych dwóch rzeczy odpowiada się odruchowo.
ck("…a pytanie nazywa KONFIGURACJĘ i KAPSEL, nie „na pewno?”",
   asked.length === 1 && (asked[0].opt.title || "").indexOf(P1.name) >= 0 &&
   /Triki 3/.test(asked[0].opt.title || "") && /Triki 3/.test(asked[0].msg),
   asked.length ? (asked[0].opt.title + " || " + asked[0].msg) : "");
ck("…i mówi, że niezapisane ustawienia kapsla przepadną", asked.length === 1 && /przepadn/.test(asked[0].msg),
   asked.length ? asked[0].msg : "");

// Upuszczenie chipa NA TEN SAM kafel nie robi nic — pytanie o zgodę na nic uczy klikać „tak”.
asked.length = 0;
fire(tileByName(P0.name), "drop", { preventDefault() {}, dataTransfer: { getData: () => "d0" } });
ck("upuszczenie na kafel, który kapsel już nosi, nic nie pyta", asked.length === 0);

// Ta sama czynność bez przeciągania: lista „Wczytaj na…” na kaflu.
asked.length = 0;
const load = document.getElementById("trigCfgHubLoad_" + P1.name.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40));
ck("kafel ma listę „Wczytaj na…” z kapslami", !!load && /d2/.test(load.innerHTML), load && load.innerHTML);
if (load) { load.value = "d2"; load.onchange(); }
ck("…i wybór z niej pyta dokładnie tak samo, jak przeciągnięcie", asked.length === 1,
   asked.map(a => a.msg).join(" | "));

// Tacka: upuszczenie kapsla Z nazwą zdejmuje sam podpis, bez okna, i mówi to w toaście.
asked.length = 0; posted.length = 0; said.length = 0;
fire(FREE(), "drop", { preventDefault() {}, dataTransfer: { getData: () => "d0" } });
ck("upuszczenie na tackę nie otwiera okna (nic się nie niszczy)", asked.length === 0);
ck("…tylko zdejmuje SAMĄ nazwę", posted.length === 1 && posted[0].body.configName === "" &&
   !("rules" in posted[0].body), JSON.stringify(posted[0] || {}));
// Toast przychodzi o mikrozadanie później niż samo zapytanie — zapis idzie przez fetch().then().
await new Promise(r => setTimeout(r, 0));
ck("…i mówi, co zostało nietknięte", said.length === 1 && /Wyzwalacze zostały bez zmian/.test(said[0]),
   said.join(" | "));

// ✎ i ✕ na kaflu. Scena wraca do stanu wyjściowego, bo poprzedni test zdjął nazwę z Triki 1 —
// a okno usuwania ma powiedzieć, co stanie się z kapslami, które tę konfigurację NOSZĄ.
setScene("d0"); hub.sync();
opened.length = 0;
document.getElementById("trigCfgHubRen_" + P0.name.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40)).onclick(noop);
ck("✎ otwiera okno z polem nazwy I polem opisu", opened.length === 1 && !!opened[0].input && !!opened[0].textarea,
   JSON.stringify(Object.keys(opened[0] || {})));
ck("…z opisem, który konfiguracja już ma", opened.length === 1 && opened[0].textarea.value === P0.desc,
   opened.length ? opened[0].textarea.value : "");
ck("…i z limitem długości wziętym z serwera",
   opened.length === 1 && opened[0].textarea.maxLength === state.trigDescMax,
   opened.length ? opened[0].textarea.maxLength : "");
asked.length = 0;
document.getElementById("trigCfgHubDel_" + P0.name.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40)).onclick(noop);
ck("✕ pyta przed usunięciem i mówi, co stanie się z noszącymi kapslami",
   asked.length === 1 && asked[0].opt.tone === "danger" && /nie ma już na liście/.test(asked[0].msg),
   asked.length ? asked[0].msg : "");

// Kafel „+”: otwiera to samo okno co ✎, tylko puste.
opened.length = 0;
document.getElementById("trigCfgHubAdd").onclick(noop);
ck("kafel „+” otwiera okno z nazwą i opisem", opened.length === 1 && !!opened[0].input && !!opened[0].textarea);
ck("…puste, bo to NOWA konfiguracja", opened.length === 1 && !opened[0].input.value && !opened[0].textarea.value);
// …i jest wyłączony, gdy nie ma czego zapisać, WRAZ Z POWODEM.
state.rules = [];
hub.sync();
const add = document.getElementById("trigCfgHubAdd");
ck("„+” wyłączony przy pustej liście wyzwalaczy", add.disabled === true);
ck("…i mówi dlaczego", /Najpierw dodaj/.test(add.title || ""), add.title);
setScene("d0"); hub.sync();

// ---------------------------------------------------------------------------
//  9. PODPIĘCIE — pułapka „montowanie to nie działanie” z .github/CONTRIBUTING.md: kod może być bez zarzutu
//     i nie wykonać się ani razu, bo nikt go nie zarejestrował ani nie zawołał.
// ---------------------------------------------------------------------------
const html = fs.readFileSync(path.join(REPO, "web/ribbitflip_dashboard.html"), "utf8");
const boot = fs.readFileSync(path.join(REPO, "web/js/rf-40-boot.js"), "utf8");
ck("skrypt huba wpięty w panel", html.indexOf('src="/web/js/rf-49i-cfghub.js"') >= 0);
ck("arkusz huba wpięty w panel", html.indexOf('href="/web/css/19-cfghub.css"') >= 0);
ck("hub ładowany PO swoim adapterze",
   html.indexOf("rf-49i-cfghub.js") > html.indexOf("rf-49b-trig-config.js") &&
   html.indexOf("rf-49b-trig-config.js") > html.indexOf("rf-49-cfgid.js"));
ck("bootstrap woła initTrigCfgHub", /\binitTrigCfgHub\b/.test(boot));
ck("…i nie woła już nieistniejących initProfiles / initTrigCfgBar",
   !/\binitProfiles\b/.test(boot) && !/\binitTrigCfgBar\b/.test(boot));
// STARY RZĄD MA NAPRAWDĘ ZNIKNĄĆ Z MARKUPU. Zostawiony obok huba byłby trzecią powierzchnią
// zapisującą ten sam plik — czyli dokładnie tym, co ten etap usuwa.
ck("rząd „Presety wyzwalaczy” usunięty z markupu",
   html.indexOf('id="profSelect"') < 0 && html.indexOf('id="profName"') < 0 &&
   html.indexOf('id="profLoad"') < 0 && html.indexOf('id="profSave"') < 0 &&
   html.indexOf('id="profDel"') < 0 && html.indexOf('class="trigbar profbar"') < 0);
ck("…i cienki pasek tożsamości nie montuje się już w Mapowaniu",
   fs.readFileSync(path.join(REPO, "web/js/rf-49b-trig-config.js"), "utf8").indexOf("rfCfgIdCreate") < 0);
// „Wymiana” przeniosła się do huba — okno wymiany i przewodnik nadal muszą ją znajdować.
const shub = fs.readFileSync(path.join(REPO, "web/js/rf-39l-share-hub.js"), "utf8");
ck("okno wymiany nie czyta już usuniętej listy", shub.indexOf('sel: "profSelect"') < 0);
ck("…i bierze presety z pamięci, z której hub rysuje kafle", /state\.trigPresets/.test(shub));
ck("przewodnik nadal celuje w istniejący przycisk",
   fs.readFileSync(path.join(REPO, "web/js/rf-39m-share-howto.js"), "utf8").indexOf('"#profDiscord"') >= 0 &&
   skeleton.indexOf('id="profDiscord"') >= 0);
// Stan {name, known, dirty} liczy JEDNA funkcja — dwie rozjechałyby się cicho.
ck("hub nie liczy stanu po swojemu, tylko wspólnym rfCfgIdState",
   /rfCfgIdState/.test(fs.readFileSync(path.join(REPO, "web/js/rf-49i-cfghub.js"), "utf8")) &&
   /function rfCfgIdState/.test(fs.readFileSync(path.join(REPO, "web/js/rf-49-cfgid.js"), "utf8")));

console.log(JSON.stringify({ checks }));
