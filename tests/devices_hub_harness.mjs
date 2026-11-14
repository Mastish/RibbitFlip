// HUB KAPSLI PO STRONIE PANELU — dwie czyste funkcje, bez przeglądarki i bez serwera.
//
//  1. devKnownId (rf-05): każdy zapasowy wybór kapsla („pokaż d0, gdy nic nie wybrano") musi
//     przejść przez tę funkcję, bo devEntry() TWORZY wpis jako skutek uboczny — po zapomnieniu
//     slotu gołe devEntry("d0") odbudowywało go jako widmową pigułkę, której serwer nie znał.
//  2. _devAddFirst (rf-11): kiedy przycisk dodawania ma mówić „Dodaj pierwszy kapsel" i świecić —
//     gdy nie ma ŻADNEGO kapsla (sparowanego, połączonego, w symulacji ani w trakcie parowania).
//
// Funkcje są wycinane z plików po nazwie (jak inspect.getsource po stronie Pythona), więc test
// pilnuje prawdziwego kodu, a nie jego kopii. Wywoływane z tests/test_devices_slots.py; na wyjściu
// JSON {checks:[[nazwa, ok, szczegół], …]}.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);

function cut(file, name) {
  const src = fs.readFileSync(path.join(REPO, file), "utf8");
  const i = src.indexOf("function " + name + "(");
  if (i < 0) throw new Error(name + " nie ma w " + file);
  let depth = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === "{") depth++;
    else if (src[k] === "}") { depth--; if (depth === 0) return src.slice(i, k + 1); }
  }
  throw new Error(name + ": nie domknięta");
}

const ctx = { state: { devices: {}, activeDeviceId: "d0", viewDev: "d0" }, console };
vm.createContext(ctx);
try {
  vm.runInContext(cut("web/js/rf-05-tooltip-state.js", "devKnownId"), ctx, { filename: "rf-05" });
  vm.runInContext(cut("web/js/rf-11-devices-ui.js", "_devAddFirst"), ctx, { filename: "rf-11" });
  ck("devKnownId i _devAddFirst wycinają się z plików i wykonują", true);
} catch (e) {
  ck("devKnownId i _devAddFirst wycinają się z plików i wykonują", false, e && e.message);
}

const S = ctx.state;
const run = (fn, ...a) => vm.runInContext(fn, ctx)(...a);

// --- devKnownId ---
S.devices = { d4: { meta: { dev: "d4" } } }; S.activeDeviceId = "d4";
ck("devKnownId: znany id wraca bez zmian", run("devKnownId", "d4") === "d4");
ck("devKnownId: zapomniany d0 → aktywny d4, nie widmo", run("devKnownId", "d0") === "d4");
S.activeDeviceId = "d9";
ck("devKnownId: aktywny też nieznany → pierwszy istniejący", run("devKnownId", "d0") === "d4");
S.devices = {};
ck("devKnownId: brak slotów → null (dopiero wtedy wolno coś utworzyć)", run("devKnownId", "d0") === null);

// --- _devAddFirst ---
const D = (bound, conn) => ({ meta: { dev: "dx", bound }, conn });
ck("_devAddFirst: pusta lista → „Dodaj pierwszy kapsel”", run("_devAddFirst", []) === true);
ck("_devAddFirst: sam niesparowany, bezczynny slot → pierwszy", run("_devAddFirst", [D(false, "idle")]) === true);
ck("_devAddFirst: slot szukający bez związania → pierwszy", run("_devAddFirst", [D(false, "")]) === true);
ck("_devAddFirst: sparowany (choć chwilowo szuka) → zwykłe „Dodaj kapsel”", run("_devAddFirst", [D(true, "scanning")]) === false);
ck("_devAddFirst: połączony → zwykłe", run("_devAddFirst", [D(false, "connected")]) === false);
ck("_devAddFirst: symulacja → zwykłe", run("_devAddFirst", [D(false, "sim")]) === false);
ck("_devAddFirst: w trakcie parowania → zwykłe (ktoś już dodaje)", run("_devAddFirst", [D(false, "pairing")]) === false);
ck("_devAddFirst: bezczynny obok sparowanego → zwykłe", run("_devAddFirst", [D(false, "idle"), D(true, "scanning")]) === false);
ck("_devAddFirst: śmieci na liście nie wywracają", run("_devAddFirst", [null, {}]) === true);

// --- 6: NA KTÓRYM SLOCIE PANEL SIĘ OTWIERA (2026-09-06) --------------
// Druga odsłona tej samej wady, innym wejściem: serwer otwiera SAME zapamiętane sloty, więc komu
// kapsel mieszka w d4, ten nie ma d0 wcale — a panel startował na stałym „d0" i wysyłał w tę
// dziurę kilkanaście zapytań o konfigurację, zanim pierwsze `devmeta` zdążyło przyjechać. Wpisy
// tworzone z odpowiedzi na te zapytania dawały pigułkę „d0", której serwer nigdy nie miał.
// Dwie zapory: id wstrzykiwane do strony (rf-02) i przejęcie prawdziwego slotu, gdy panel jednak
// siedzi na zgadywanym (rf-08 `onDevMeta` + znacznik `known`).
const _st = fs.readFileSync(path.join(REPO, "web/js/rf-02-state.js"), "utf8");
ck("rf-02: startowy slot bierze się z window.RIBBITFLIP_DEV, a „d0” jest tylko awaryjne",
   /RF_BOOT_DEV\s*=.*RIBBITFLIP_DEV/.test(_st) && _st.includes('state.activeDeviceId=RF_BOOT_DEV')
   && _st.includes('state.viewDev=RF_BOOT_DEV'));
ck("rf-02: wstrzyknięte id jest sprawdzane wzorcem (nie wchodzi cokolwiek ze strony)",
   /\/\^d\\d\+\$\//.test(_st));

const ctx2 = {
  state: { devices: {}, activeDeviceId: "d0", viewDev: "d0" },
  console,
  _ensureCap() {}, renderDeviceSelector() {}, renderOverview() {}, padCapsSyncMuted() {},
  switched: [],
};
ctx2.switchDevice = function (id) {
  ctx2.switched.push(id);
  ctx2.state.activeDeviceId = id;
  ctx2.state.viewDev = id;
};
vm.createContext(ctx2);
vm.runInContext(cut("web/js/rf-08-sse-ui.js", "onDevMeta"), ctx2, { filename: "rf-08" });
const meta = (dev, name) => ({ dev, slot: +dev.slice(1), name });
// The panel opened on a guess (d0) and the server's only capsule is d4: the entry the guess left
// behind must go, and the panel must move onto the real slot.
const ghost = { meta: { dev: "d0", slot: 999, name: "d0" }, conn: "" };
const real = { meta: { dev: "d4", slot: 4, name: "d4" }, conn: "" };
ctx2.state.devices = { d0: ghost, d4: real };
vm.runInContext("onDevMeta", ctx2)(meta("d4", "Triki 5"), real);
ck("rf-08: devmeta oznacza slot jako potwierdzony przez serwer", real.known === true);
ck("rf-08: wpis, którego serwer nie potwierdził, znika z listy",
   Object.keys(ctx2.state.devices).join(",") === "d4", Object.keys(ctx2.state.devices));
ck("rf-08: panel przechodzi na prawdziwy slot", ctx2.switched.join(",") === "d4", ctx2.switched);
// …and once it sits on a confirmed slot, a devmeta about ANOTHER one must not drag it there.
ctx2.switched.length = 0;
const second = { meta: { dev: "d5", slot: 5, name: "d5" }, conn: "" };
ctx2.state.devices.d5 = second;
vm.runInContext("onDevMeta", ctx2)(meta("d5", "Triki 6"), second);
ck("rf-08: drugi kapsel nie przełącza edytowanego slotu",
   ctx2.switched.length === 0 && ctx2.state.activeDeviceId === "d4", ctx2.state.activeDeviceId);
ck("rf-08: oba sloty zostają na liście", Object.keys(ctx2.state.devices).sort().join(",") === "d4,d5");

// --- 4.4: podpowiedź hubu w symulacji (rf-39f `_simCards`) ---------------------------------
// Zdanie „potrząśnij kapslem" jest pierwszym, jakie widzi ktoś, kto uruchomił aplikację bez
// sprzętu — a w symulacji nie ma czym potrząsnąć. Sprawdzamy ŹRÓDŁO (bez przeglądarki): podmiana
// idzie tym samym `put(` co pozostałe karty symulacji, para EN jest w bloku `Object.assign(I18N_EN`
// tego pliku, a LIVE zostaje przy dawnym zdaniu w rf-34.
const _sim = fs.readFileSync(path.join(REPO, "web/js/rf-39f-simnotice.js"), "utf8");
const _simFn = _sim.slice(_sim.indexOf("function _simCards()"), _sim.indexOf("window.rfSimStartup"));
// Zdanie jest KRÓTKIE celowo (rf-39f, komentarz przy `put`): prawa kolumna ma 245 px i każdy
// dodatkowy wiersz podpowiedzi spycha przebiegi z legendami poniżej krawędzi okna.
const _PLHINT = "Symulacja: ruch tego kapsla generuje aplikacja — nie ma czym potrząsnąć.";
ck("rf-39f: `_simCards` podmienia `.devices-hint` przez put()",
   _simFn.includes('put(document.querySelector(".rf-rcol .devices-hint")') && _simFn.includes(_PLHINT));
const _dict = _sim.slice(_sim.indexOf("Object.assign(I18N_EN"), _sim.indexOf("(function(){"));
ck("rf-39f: nowe zdanie ma parę EN w bloku Object.assign(I18N_EN…)",
   _dict.includes(_PLHINT) && _dict.includes("there is nothing to shake"));
ck("rf-39f: EN cytuje „Take control” (klucz rf-01), a nie polską etykietę",
   _dict.includes("“Take control”"));
const _tabs = fs.readFileSync(path.join(REPO, "web/js/rf-34-tabs.js"), "utf8");
const _hintAt = _tabs.indexOf('_hint.className="devices-hint"');
ck("rf-34: LIVE zostaje przy „Nie wiesz, który kapsel to który? Potrząśnij nim…”",
   _tabs.includes('Nie wiesz, który kapsel to który? Potrząśnij nim, a jego pigułka zamiga.'));
ck("rf-34: przy podpowiedzi stoi notka, że w symulacji podmienia ją rf-39f",
   _hintAt > 0 && _tabs.slice(Math.max(0, _hintAt - 700), _hintAt).includes("rf-39f"));

// --- 5.2: okno „Edytuj kapsel” (rf-11 openDeviceEditor) jest dialogiem i przenosi fokus ------
// Statyczny odczyt źródła (bez przeglądarki) — pełny przebieg klawiaturowy sprawdza
// tests/devedit_focus_harness.cjs na żywej instancji.
const _de = fs.readFileSync(path.join(REPO, "web/js/rf-11-devices-ui.js"), "utf8");
const _deFn = _de.slice(_de.indexOf("function openDeviceEditor("), _de.indexOf("function onDevGone("));
ck("rf-11: .de-box ma role=dialog, aria-modal i aria-labelledby=deTitle",
   /class="de-box" role="dialog" aria-modal="true" aria-labelledby="deTitle"/.test(_deFn) && _deFn.includes('<h3 id="deTitle">'));
ck("rf-11: po otwarciu fokus idzie do #deName",
   _deFn.includes('const _deName=document.getElementById("deName")') && /_deName\.focus\(\)/.test(_deFn));
ck("rf-11: _deKey ma pułapkę Tab (pierwszy/ostatni w .de-box)",
   _deFn.includes('if(e.key!=="Tab")return;') && _deFn.includes('box.contains(a)'));
ck("rf-11: close() oddaje fokus pigułce (.dp-edit) albo „Dodaj kapsel” po usunięciu",
   _deFn.includes('.devpill[data-dev="') && _deFn.includes('deviceAddBtn') && _deFn.includes('close("add")'));

console.log(JSON.stringify({ checks }));
