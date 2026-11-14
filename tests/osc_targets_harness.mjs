// URZĄDZENIA OSC PO STRONIE PANELU — lista i wybór urządzenia w edytorze mapowania.
//
// Serwer pilnuje swojej połowy (test_osc_targets.py), ale to PANEL decyduje, co człowiek widzi:
// czy cel domyślny stoi w liście jako pierwszy wiersz (bez ✕, bo nie da się go usunąć), czy
// przycisk „Dodaj" gaśnie na suficie i mówi dlaczego, i — najważniejsze — czy wybór urządzenia
// w edytorze pokazuje urządzenie z presetu, którego ta maszyna NIE ZNA. To ostatnie jest tu
// jedyną rzeczą, która potrafi po cichu skasować cudzą pracę: gdyby pole „poprawiło" nieznany
// identyfikator na pusty, pierwsze otwarcie edytora zamieniłoby zestaw autora na inny.
//
// Bez przeglądarki. rf-49e sięga po DOM tylko przez getElementById, a całą treść składa w JEDEN
// napis i przypisuje do innerHTML — więc atrapa dokumentu, która ten napis zapamiętuje, wystarcza
// do sprawdzenia, CO powstaje. Atrapa NIE udaje układu strony ani zdarzeń: podpięcie przycisków
// i wygląd zostają do klik-through na żywym panelu.
//
// Wywoływane z tests/test_osc_targets.py bez argumentów; na wyjściu JSON {checks:[[nazwa, ok,
// szczegół], …]} — liczy je python, żeby podsumowanie było jedno.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);

// Atrapa elementu: zapamiętuje przypisany innerHTML, a wyszukiwanie w poddrzewie zwraca pustkę —
// harness nie udaje, że sprawdza podpięcie handlerów.
function mk(id) {
  return {id, className: "", innerHTML: "", style: {}, dataset: {},
          appendChild() {}, setAttribute() {}, focus() {}, select() {},
          querySelector() { return null; }, querySelectorAll() { return []; }};
}
const box = mk("oscDevices");
const byId = {oscDevices: box, oscTarget: mk("oscTarget")};
const ctx = {
  document: {getElementById: (i) => byId[i] || null,
             createElement: (t) => mk("_" + t),
             activeElement: null},
  state: {midi: {mappings: []}, midiEnv: {oscHost: "127.0.0.1", oscPort: 9000},
          _midiDraft: null, devices: {}, activeDeviceId: "d0"},
  console, _gl: (pl) => pl, _lang: "pl",
  miEsc: (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c])),
  applyLang() {}, rfToast() {}, rfConfirm() { return Promise.resolve(false); },
  renderMidiList() {}, setTimeout: (fn) => fn(),
  fetch: () => Promise.resolve({json: () => ({})})
};
vm.createContext(ctx);
// rf-49d idzie pierwsze, tak jak w przeglądarce: rf-49e liczy z niego odmianę „mapowań" (jedno
// zdanie w oknie z pytaniem o zgodę nie ma prawa mówić „5 mapowanie").
for (const f of ["web/js/rf-49d-midi-config.js", "web/js/rf-49e-osc-targets.js"]) {
  vm.runInContext(fs.readFileSync(path.join(REPO, f), "utf8"), ctx);
}
const G = (n) => vm.runInContext(n, ctx);

// Pusty rejestr: sam cel domyślny i zaproszenie do dodania urządzenia.
ctx.oscTargetsRender();
ck("cel domyślny stoi w liście jako pierwszy wiersz",
   box.innerHTML.includes("Cel domyślny") && box.innerHTML.includes("127.0.0.1:9000"));
ck("…i nie ma przy nim przycisku usuwania",
   !box.innerHTML.split("osc-dev is-default")[1].split("</div>")[0].includes('data-act="del"'));
ck("przycisk dodawania jest czynny", box.innerHTML.includes('id="oscDevAdd"')
   && !box.innerHTML.includes('id="oscDevAdd" disabled'));

// Dwa urządzenia z serwera.
ctx.oscTargetsTake({oscTargets: [{id: "t1", name: "Lampa ESP32", host: "10.1.1.1", port: 7001, uses: 3},
                                 {id: "t2", name: "", host: "10.1.1.2", port: 7002, uses: 0}],
                    oscTargetMax: 16, oscHost: "127.0.0.1", oscPort: 9000});
ck("urządzenie widać z nazwą i adresem",
   box.innerHTML.includes("Lampa ESP32") && box.innerHTML.includes("10.1.1.1:7001"));
ck("urządzenie bez nazwy nie jest pustym wierszem", box.innerHTML.includes("(bez nazwy)"));
ck("licznik mówi, ile ich jest i ile się zmieści", box.innerHTML.includes("2 / 16"));
// Ile mapowań tam mówi — z serwera, ze WSZYSTKICH kapsli, i po polsku odmienione.
ck("wiersz mówi, ile mapowań tam mówi", box.innerHTML.includes("3 mapowania"), box.innerHTML);
ck("…a urządzenie, do którego nikt nie mówi, mówi to wprost",
   box.innerHTML.includes("nikt tu nie mówi"), box.innerHTML);

// Sufit: przycisk gaśnie i MÓWI, dlaczego.
ctx.oscTargetsTake({oscTargets: Array.from({length: 16}, (_, i) => (
  {id: "t" + (i + 1), name: "u" + i, host: "10.0.0." + i, port: 9000})), oscTargetMax: 16});
ck("na suficie przycisk jest wygaszony", box.innerHTML.includes('id="oscDevAdd" disabled'));
ck("…i podane jest wyjście z sytuacji", box.innerHTML.includes("Usuń któryś odbiornik"));

// Wybór urządzenia w edytorze mapowania.
ctx.oscTargetsTake({oscTargets: [{id: "t1", name: "Lampa", host: "10.1.1.1", port: 7001},
                                 {id: "t2", name: "Tablet", host: "10.1.1.2", port: 7002}],
                    oscTargetMax: 16});
let html = ctx.oscTargetFieldHtml({oscTarget: "t2"});
ck("pierwsza pozycja to cel domyślny z adresem",
   html.indexOf('value=""') < html.indexOf('value="t1"')
   && html.includes("Cel domyślny (127.0.0.1:9000)"), html);
ck("wybrane jest urządzenie mapowania", html.includes('value="t2" selected'), html);
ck("…i tylko ono", (html.match(/selected/g) || []).length === 1, html);
html = ctx.oscTargetFieldHtml({oscTarget: ""});
ck("mapowanie bez urządzenia ma zaznaczony cel domyślny",
   html.includes('value="" selected'), html);
// ⚠️ TO JEST TA JEDNA RZECZ, KTÓRA KASUJE CUDZĄ PRACĘ PO CICHU.
html = ctx.oscTargetFieldHtml({oscTarget: "t9"});
ck("nieznane urządzenie z presetu ZOSTAJE w polu",
   html.includes('value="t9" selected'), html);
ck("…i pole mówi wprost, że zagra na cel domyślny",
   html.includes("gra na cel domyślny"), html);

// Etykieta w wierszu listy mapowań: nazwana maszyna tak, cel domyślny nie.
ck("wiersz mapowania nosi nazwę urządzenia", ctx.oscTargetTag({oscTarget: "t1"}) === "Lampa · ");
ck("…a przy celu domyślnym milczy", ctx.oscTargetTag({oscTarget: ""}) === "");
ck("…i przy nieznanym też (nie ma czego napisać)",
   ctx.oscTargetTag({oscTarget: "t9"}) === "", ctx.oscTargetTag({oscTarget: "t9"}));

// Usunięcie urządzenia przy otwartym edytorze: szkic musi pójść za serwerem, bo zapisany
// przywróciłby identyfikator, którego już nie ma.
ctx.state._midiDraft = {id: "m1", dest: "osc", oscTarget: "t1"};
G("onOscTargets({oscTargets: [{id:'t2',name:'Tablet',host:'10.1.1.2',port:7002}], oscTargetMax: 16})");
ck("szkic w edytorze traci urządzenie, którego już nie ma",
   ctx.state._midiDraft.oscTarget === "", ctx.state._midiDraft.oscTarget);

process.stdout.write(JSON.stringify({checks}) + "\n");
