// „WŁĄCZ OD RAZU PO WCZYTANIU" — KONTRAKT rf-29e BEZ PRZEGLĄDARKI I BEZ SERWERA.
//
// Przy wczytaniu zestawu użytkownik może od razu zaznaczyć aktywację elementów, które
// powinny być włączone. Zestaw nadal niczego nie
// uzbraja sam (test_setup_switches.py pilnuje serwera); ten harness pilnuje drugiej połowy:
// że pole zaznaczone przez człowieka włącza DOKŁADNIE to, co serwer wskazał, tą samą drogą co
// przycisk „Włącz teraz", i że po przeładowaniu dymek wie, co poszło, a co zostało.
//
// Co tu jest sprawdzane WYNIKIEM, nie kształtem kodu:
//   * które POST-y wychodzą (adres + treść) i w jakiej kolejności — z fałszywym `fetch`,
//   * co ląduje w localStorage dla dymka po przeładowaniu,
//   * że w symulacji z zablokowanymi wyjściami NIC nie wychodzi, a zdanie o tym zostaje,
//   * że awaria jednego POST-a zostawia tę grupę w „do kliknięcia", a resztę zgłasza jako włączoną,
//   * że MIDI i OSC na jednym kapslu włączają się osobno, nie nadpisując się nawzajem.
//
// rf-29e jest samowystarczalnym plikiem (globalne funkcje, żadnych importów), więc jedzie w `vm`
// z najmniejszym „DOM-em", jakiego naprawdę dotyka: localStorage, fetch, document.getElementById,
// setTimeout i kilka pomocników panelu (_gl, rfGroupName, rfToast, miEsc, rfSimOutputsAllowed).
//
// Wywoływane z tests/test_arm_on_load.py; na wyjściu JSON {checks:[[nazwa, ok, szczegół], …]}.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);
const J = (x) => JSON.stringify(x);

// ---------------------------------------------------------------------------
//  ŚRODOWISKO: localStorage, fetch, dokument
// ---------------------------------------------------------------------------
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};
const calls = [];                       // każde żądanie: {method, url, body}
let failUrls = new Set();               // adresy, które mają odpowiedzieć ok:false
const midiState = {};                   // per dev: {enabled, oscEnabled} — GET oddaje, POST zapisuje
async function fetch(url, opt) {
  const method = (opt && opt.method) || "GET";
  const body = (opt && opt.body) ? JSON.parse(opt.body) : null;
  calls.push({ method, url, body });
  const dev = (url.split("?dev=")[1] || "");
  if (method === "GET" && url.startsWith("/midi")) {
    const st = midiState[dev] || { enabled: false, oscEnabled: false };
    return { ok: true, json: async () => ({ ports: [], slot: { ...st } }) };
  }
  if (method === "POST" && url.startsWith("/midi")) {
    const st = midiState[dev] || { enabled: false, oscEnabled: false };
    midiState[dev] = { enabled: !!body.enabled, oscEnabled: !!body.oscEnabled };
    void st;
  }
  return { ok: !failUrls.has(url), json: async () => ({ ok: !failUrls.has(url) }) };
}
const elements = {};
const document = { getElementById: (id) => elements[id] || null };
const toasts = [];
const timers = [];
let simAllowed = true;
let reminders = [];

const sandbox = {
  console, localStorage, fetch, document,
  setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
  _gl: (pl, en) => pl,
  rfGroupName: (k) => ({ rules: "Mapowanie", mouse: "Mysz i kontroler", midi: "MIDI", osc: "OSC" })[k] || "",
  rfToast: (msg, opt) => { toasts.push({ msg, opt: opt || {} }); },
  miEsc: (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
  rfSimOutputsAllowed: () => simAllowed,
  rfHotkeyReminder: (g) => { reminders.push(g); },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const SRC = fs.readFileSync(path.join(REPO, "web", "js", "rf-29e-arm-on-load.js"), "utf-8");
vm.runInContext(SRC, sandbox, { filename: "rf-29e-arm-on-load.js" });
const F = (name) => vm.runInContext(name, sandbox);
const reset = () => { calls.length = 0; toasts.length = 0; timers.length = 0; reminders = []; failUrls = new Set(); store.clear(); for (const k of Object.keys(midiState)) delete midiState[k]; };

// ---------------------------------------------------------------------------
//  A. pole pamiętane, listy, ramka do okna importu
// ---------------------------------------------------------------------------
reset();
ck("a1. domyślnie pole jest ODZNACZONE (plik nic nie włącza, dopóki człowiek nie zaznaczy)", F("rfArmPref")() === false);
F("rfArmPrefSet")(true);
ck("a2. zaznaczenie jest pamiętane", F("rfArmPref")() === true && store.get("ribbitflip.load.armNow") === "1");
F("rfArmPrefSet")(false);
ck("a3. ...i odznaczenie też", F("rfArmPref")() === false);

const list1 = F("rfArmList")([{ name: "Toczenie", groups: ["rules", "mouse"] }, { name: "Skok", groups: ["rules"] }]);
ck("a4. lista pogrupowana po kapslu, nazwami z panelu", list1 === "Toczenie (Mapowanie, Mysz i kontroler), Skok (Mapowanie)", list1);
const list2 = F("rfArmList")(["rules", "osc"]);
ck("a5. płaska lista kluczy też ma nazwy", list2 === "Mapowanie, OSC", list2);
const list3 = F("rfArmList")([{ name: "", groups: ["mouse"] }, { name: "X", groups: [] }]);
ck("a6. kapsel bez nazwy = same grupy; kapsel bez grup znika z listy", list3 === "Mysz i kontroler", list3);

const wb1 = F("rfArmWantsBy")({ wantsOn: ["rules", "mouse"] });
ck("a7. odpowiedź /setup/analyze (jeden kapsel) → jedna pozycja bez nazwy", J(wb1) === J([{ name: "", groups: ["rules", "mouse"] }]), J(wb1));
const wb2 = F("rfArmWantsBy")({ devices: [
  { devName: "d0", role: { name: "Toczenie" }, wantsOn: ["rules", "mouse"] },
  { devName: "d1", role: { name: "Skok" }, wantsOn: ["rules"] },
  { devName: "d2", role: { name: "Nic" }, wantsOn: [] },
] });
ck("a8. odpowiedź /bundle/analyze → po ROLI, rola bez włączników pominięta",
   J(wb2) === J([{ name: "Toczenie", groups: ["rules", "mouse"] }, { name: "Skok", groups: ["rules"] }]), J(wb2));
ck("a9. plik bez niczego włączonego → pusta lista", F("rfArmWantsBy")({ wantsOn: [] }).length === 0 && F("rfArmWantsBy")(null).length === 0);

ck("b1. ramka jest pusta, gdy plik nic nie włącza", F("rfArmBoxHtml")({ wantsOn: [] }) === "");
const box = F("rfArmBoxHtml")({ wantsOn: ["rules", "mouse"] });
ck("b2. ramka ma pole #tsArm i listę", box.includes('id="tsArm"') && box.includes("Mapowanie, Mysz i kontroler"), box.slice(0, 120));
ck("b3. ...odznaczone, gdy nic nie zapamiętano", !box.includes("checked"));
F("rfArmPrefSet")(true);
ck("b4. ...zaznaczone, gdy człowiek ostatnio zaznaczył", F("rfArmBoxHtml")({ wantsOn: ["rules"] }).includes(" checked"));
ck("b5. ramka mówi, co się stanie bez zaznaczenia (dymek z „Włącz teraz”)", box.includes("Włącz teraz"));
const evil = F("rfArmBoxHtml")({ devices: [{ role: { name: "<b>x</b>" }, wantsOn: ["rules"] }] });
ck("b6. nazwa roli z cudzego pliku jest escapowana", evil.includes("&lt;b&gt;x&lt;/b&gt;") && !evil.includes("<b>x</b>"));

elements.tsArm = { checked: true };
F("rfArmPrefSet")(false);
ck("c1. rfArmTakeChoice czyta pole i zapamiętuje odpowiedź", F("rfArmTakeChoice")() === true && F("rfArmPref")() === true);
elements.tsArm = { checked: false };
ck("c2. ...w obie strony", F("rfArmTakeChoice")() === false && F("rfArmPref")() === false);
delete elements.tsArm;
ck("c3. bez pola (plik nic nie włączał) odpowiedź to „nie”, a pamięć nietknięta", F("rfArmTakeChoice")() === false && F("rfArmPref")() === false);

// ---------------------------------------------------------------------------
//  D. po wczytaniu: odznaczone = nic nie wychodzi, dymek „Włącz teraz” po przeładowaniu
// ---------------------------------------------------------------------------
const RES = { ok: true, switchesKept: ["rules", "mouse", "midi"],
              switchesKeptBy: [{ dev: "d0", name: "Toczenie", groups: ["rules", "mouse"] },
                               { dev: "d1", name: "Skok", groups: ["rules"] }] };
reset();
let out = await F("rfArmAfterLoad")(RES, false);
ck("d1. odznaczone: ŻADEN POST nie wychodzi", calls.length === 0, J(calls));
ck("d2. ...wszystko zostaje „do kliknięcia” dla dymka", store.get("ribbitflip.undo.switchesBy") === J(RES.switchesKeptBy), store.get("ribbitflip.undo.switchesBy"));
ck("d3. ...lista zbiorcza jest PUSTA, bo serwer przysłał listę per kapsel (mogłaby wymienić grupę, którą autor miał wyłączoną)",
   store.get("ribbitflip.undo.switches") === "[]", store.get("ribbitflip.undo.switches"));
ck("d4. ...nic nie zgłoszono jako włączone", !store.has("ribbitflip.undo.armed") && out.done.length === 0 && out.left.length === 2);

// stary serwer bez switchesKeptBy → zbiorcza lista zostaje, żeby dymek miał choć nazwy
reset();
await F("rfArmAfterLoad")({ ok: true, switchesKept: ["rules"] }, true);
ck("d5. serwer bez listy per kapsel: nic do włączenia, zbiorcza lista zostaje", calls.length === 0 && store.get("ribbitflip.undo.switches") === '["rules"]' && store.get("ribbitflip.undo.switchesBy") === "[]");

// ---------------------------------------------------------------------------
//  E. zaznaczone: te same POST-y, co „Włącz teraz”, po kolei, dokładnie te kapsle
// ---------------------------------------------------------------------------
reset();
out = await F("rfArmAfterLoad")(RES, true);
const seq = calls.map((c) => c.method + " " + c.url);
ck("e1. wychodzą dokładnie trzy POST-y, w kolejności kapsli i grup",
   J(seq) === J(["POST /trig-enable?dev=d0", "POST /airmouse?dev=d0", "POST /trig-enable?dev=d1"]), J(seq));
ck("e2. każdy z treścią {enabled:true}", calls.every((c) => J(c.body) === J({ enabled: true })));
ck("e3. wszystko zgłoszone jako włączone, nic nie zostało", J(out.done) === J(RES.switchesKeptBy) && out.left.length === 0, J(out));
ck("e4. localStorage: armed = co włączono, switchesBy = [] (dymek „Włącz teraz” się NIE pokaże)",
   store.get("ribbitflip.undo.armed") === J(RES.switchesKeptBy) && store.get("ribbitflip.undo.switchesBy") === "[]");
ck("e5. ...i bez zdania o symulacji", !store.has("ribbitflip.undo.armSim") && out.skippedSim === false);

// ---------------------------------------------------------------------------
//  F. awaria jednego POST-a: reszta włączona, ta grupa „do kliknięcia”
// ---------------------------------------------------------------------------
reset();
failUrls = new Set(["/airmouse?dev=d0"]);
out = await F("rfArmAfterLoad")(RES, true);
ck("f1. po awarii dalsze POST-y NADAL wychodzą (kapsel d1 dostał swoje)", calls.length === 3, J(calls.map((c) => c.url)));
ck("f2. włączone: Mapowanie na d0 i d1; zostało: Mysz na d0",
   J(out.done) === J([{ dev: "d0", name: "Toczenie", groups: ["rules"] }, { dev: "d1", name: "Skok", groups: ["rules"] }])
   && J(out.left) === J([{ dev: "d0", name: "Toczenie", groups: ["mouse"] }]), J(out));
ck("f3. localStorage rozdzielony tak samo", store.get("ribbitflip.undo.switchesBy") === J(out.left) && store.get("ribbitflip.undo.armed") === J(out.done));

// ---------------------------------------------------------------------------
//  G. symulacja z zablokowanymi wyjściami: NIC nie wychodzi, zostaje pytanie w dymku
// ---------------------------------------------------------------------------
reset();
simAllowed = false;
out = await F("rfArmAfterLoad")(RES, true);
ck("g1. w symulacji pod kluczem żaden POST nie wychodzi mimo zaznaczenia", calls.length === 0, J(calls));
ck("g2. wszystko zostaje „do kliknięcia” (przycisk w dymku zada pytanie)", store.get("ribbitflip.undo.switchesBy") === J(RES.switchesKeptBy));
ck("g3. ...i jest ślad, dlaczego „od razu” nie zadziałało", store.get("ribbitflip.undo.armSim") === "1" && out.skippedSim === true);
simAllowed = true;

// ---------------------------------------------------------------------------
//  H. MIDI i OSC na jednym kapslu: osobno, bez gaszenia drugiej połowy
// ---------------------------------------------------------------------------
reset();
midiState.d0 = { enabled: false, oscEnabled: false };
out = await F("rfArmAfterLoad")({ ok: true, switchesKeptBy: [{ dev: "d0", name: "d0", groups: ["midi", "osc"] }] }, true);
const posts = calls.filter((c) => c.method === "POST").map((c) => c.body);
ck("h1. najpierw MIDI (OSC zostaje jak było), potem OSC (MIDI zostaje włączone)",
   J(posts) === J([{ enabled: true, oscEnabled: false }, { enabled: true, oscEnabled: true }]), J(posts));
ck("h2. stan końcowy: oba włączone", midiState.d0.enabled === true && midiState.d0.oscEnabled === true);
ck("h3. przed każdym POST-em był odczyt stanu", calls.filter((c) => c.method === "GET" && c.url === "/midi?dev=d0").length === 2);

// ---------------------------------------------------------------------------
//  I. po przeładowaniu: odczyt jednorazowy, zielony dymek, przypomnienie o stopie
// ---------------------------------------------------------------------------
reset();
store.set("ribbitflip.undo.armed", J([{ dev: "d0", name: "Toczenie", groups: ["rules", "mouse"] }]));
let info = F("_rfArmedTake")();
ck("i1. _rfArmedTake oddaje listę i ją kasuje", info.done.length === 1 && info.sim === false && !store.has("ribbitflip.undo.armed"));
F("rfArmedAnnounce")(info);
ck("i2. zielony dymek nazywa, co włączono", toasts.length === 1 && toasts[0].opt.tone === "ok" && toasts[0].msg.includes("Toczenie (Mapowanie, Mysz i kontroler)"), J(toasts));
for (const t of timers) t.fn();
ck("i3. ...a zaraz po nim przypomnienie o stopie awaryjnym dla pierwszej włączonej grupy", J(reminders) === J(["rules"]), J(reminders));

reset();
store.set("ribbitflip.undo.armSim", "1");
info = F("_rfArmedTake")();
F("rfArmedAnnounce")(info);
ck("i4. po symulacji: zdanie, dlaczego nic nie włączono, bez zielonego dymka i bez przypomnienia",
   toasts.length === 1 && toasts[0].opt.tone === undefined && toasts[0].msg.includes("symulacji") && timers.length === 0, J(toasts));
ck("i5. ...i ślad skasowany", !store.has("ribbitflip.undo.armSim"));

reset();
F("rfArmedAnnounce")(F("_rfArmedTake")());
ck("i6. bez niczego: cisza", toasts.length === 0);

process.stdout.write(JSON.stringify({ checks }));
