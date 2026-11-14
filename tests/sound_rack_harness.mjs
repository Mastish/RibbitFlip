// EDYTOR BRZMIEŃ JAKO „RACK” (etap E4a, 2026-10-02) — BEZ PRZEGLĄDARKI.
//
// rf-25d (SoundRack) nie ma własnego stanu brzmienia: OWIJA funkcje rf-25 i czyta formularz. Najkruchsze są tu
// cztery rzeczy, które w przeglądarce widać dopiero po kilku kliknięciach:
//   • KROPKA „NIEZAPISANE ZMIANY” — porównanie po sanitizePatch, z kluczami posortowanymi, z falą własną, pasmami
//     i krzywiznami; zaraz po wczytaniu KAŻDEGO z 35 brzmień bazowych kropka nie może się palić (starsze brzmienia
//     mają wartości między krokami pokręteł, formularz je zaokrągla, dlatego odniesieniem jest formularz po
//     wczytaniu, a nie surowy patch źródła), a gaśnie po zapisie, anulowaniu i „+ Nowe”;
//   • PLAKIETKA RODZAJU — nowe / bazowe / zmienione / własne, prosto z XPAD;
//   • SZUKANIE I CHIPY — „zaba” trafia „Żaba”, „łąka” trafia „ŁĄKA” (ł nie rozkłada się w NFD), chip zawęża;
//   • SZYBKI ODSŁUCH — gra cudzy patch na busie laba i oddaje mu potem patch formularza; przy przytrzymanej nucie,
//     podglądzie ciągłym i pętli testowej nie startuje.
// Do tego układ w ribbitflip_dashboard.html (identyfikatory, karty modułów, kostki, kontenery na edytory krzywych
// etapu E6, głośność poza modułami) i kolejność dołączenia plików.
// Runda naprawcza po przeglądzie (sekcja (f), 2026-10-02): Enter / Delete / Backspace listy tylko na WIDOCZNYM wierszu
// (filtr chowający edytowany wiersz nie pozwala go skasować ani wczytać, także w rf-25), ▶ z aria-pressed od dekoracji,
// nazwy kostek w aria-label, zmiana języka przebudowuje aria-label ▶, Ctrl+S tylko w otwartym edytorze i bez powtórzeń.
// Pliki PRAWDZIWE w jednym kontekście `vm`: rf-17, rf-19, rf-20, rf-25c, rf-25, soundMeta z rf-23, rf-25d i rf-25e
// (płaskie edytory krzywych z etapu E6 niosą falę, pasma i krzywizny przez readEditorPatch), z atrapą
// DOM, której suwaki przycinają i zaokrąglają wartość jak przeglądarka (min / max / step z dashboardu).
//
// Wywoływane z tests/test_synth_store.py; samodzielnie: node tests/sound_rack_harness.mjs
// Ostatnia linia wyjścia = JSON {checks:[[nazwa, ok, szczegół], …]}; kod wyjścia 1, gdy coś nie przeszło.
// (Nazwy sprawdzeń bez polskich znaków i emoji — test_synth_store.py drukuje je print()-em na konsoli cp1250.)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);
const J = (o) => JSON.stringify(o);
const read = (f) => fs.readFileSync(path.join(REPO, f), "utf8");
const dash = read("web/ribbitflip_dashboard.html");

// ---------- atrapa DOM: pola edytora z prawdziwymi zakresami + elementy paska ----------
const els = new Map();
function mkRange(id, min, max, step, val) {
  const dec = (String(step).split(".")[1] || "").length;
  let v = "";
  const el = { id, type: "range", min, max, step,
    get value() { return v; },
    set value(x) { let n = +x; if (!Number.isFinite(n)) n = (min + max) / 2;
      n = Math.min(max, Math.max(min, n)); n = min + Math.round((n - min) / step) * step;
      if (n > max + 1e-9) n -= step; v = String(+n.toFixed(dec)); } };
  el.value = val;
  return el;
}
function mkSelect(id, opts, val) {
  let v = val;
  return { id, type: "select", get value() { return v; }, set value(x) { x = String(x); v = opts.includes(x) ? x : ""; } };
}
for (const m of dash.matchAll(/<input id="(se[A-Za-z0-9]+)" type="range" min="([^"]+)" max="([^"]+)" step="([^"]+)" value="([^"]+)"/g))
  els.set(m[1], mkRange(m[1], +m[2], +m[3], +m[4], m[5]));
for (const m of dash.matchAll(/<select id="(se[A-Za-z0-9]+)">([\s\S]*?)<\/select>/g)) {
  const opts = [...m[2].matchAll(/<option value="([^"]*)"/g)].map((o) => o[1]);
  const sel = /<option value="([^"]*)" selected/.exec(m[2]);
  els.set(m[1], mkSelect(m[1], opts, sel ? sel[1] : opts[0]));
}
for (const m of dash.matchAll(/<input id="(se[A-Za-z0-9]+)" type="checkbox"/g)) els.set(m[1], { id: m[1], type: "checkbox", checked: false });
for (const id of ["seName", "seEmoji"]) els.set(id, { id, type: "text", value: id === "seEmoji" ? "🎛" : "", focus() {} });
for (const m of dash.matchAll(/<b id="(se[A-Za-z0-9]+V)">/g)) els.set(m[1], { id: m[1], textContent: "" });
els.set("seMsg", { id: "seMsg", textContent: "", style: {} });
// przyciski, które rf-25 wiąże przez referencję (initSoundEditor): atrapa pamięta słuchaczy kliknięcia
const mkBtn = (id, extra) => Object.assign({ id, l: [], addEventListener(t, f) { if (t === "click") this.l.push(f); },
  removeEventListener(t, f) { if (t === "click") this.l = this.l.filter((x) => x !== f); } }, extra);
els.set("seSave", mkBtn("seSave", { textContent: "" }));
els.set("seCancelEdit", mkBtn("seCancelEdit", { hidden: true }));
els.set("seResetBase", { id: "seResetBase", hidden: true });
els.set("seDirty", { id: "seDirty", hidden: true });
els.set("seDup", { id: "seDup", disabled: true });
const kindEl = { id: "seKind", dataset: { kind: "new" }, textContent: "nowe", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
els.set("seKind", kindEl);
const barCls = new Set();
const bar = { classList: { toggle: (c, on) => { if (on) barCls.add(c); else barCls.delete(c); } } };
els.set("soundEditor", { id: "soundEditor", open: true, querySelector: (s) => (s === ".se-bar" ? bar : null),
                         querySelectorAll: () => [], classList: { toggle() {} } });

// ---------- zegar: setTimeout zbiera zadania, run() wykonuje je po kolei (również te dodane w trakcie) ----------
let timers = [], tid = 0;
const clock = {
  set: (fn, ms) => { const id = ++tid; timers.push({ id, fn, ms }); return id; },
  clear: (id) => { timers = timers.filter((t) => t.id !== id); },
  run() { let n = 0; while (timers.length && n++ < 200) { const t = timers.shift(); t.fn(); } return n; },
};

const ctx = {
  I18N_EN: {}, console,
  state: { midi: { scale: "chromatic", scaleRoot: 0 }, devices: {} },
  _gl: (pl) => pl,
  rfToast: () => {}, rfConfirm: () => Promise.resolve(false), rfModal: () => Promise.resolve(""),
  rfCfgIdCreate: () => ({ barHtml: () => "", wire: () => {}, sync: () => {} }),
  esc: (s) => String(s),
  fetch: () => Promise.resolve({ json: () => ({}) }),
  document: { getElementById: (id) => els.get(id) || null, querySelector: () => null, querySelectorAll: () => [] },
  location: { search: "" },
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout: clock.set, clearTimeout: clock.clear,
  PadPlate: { _fs: {} },
};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["web/js/rf-17-pad-model.js", "web/js/rf-19-pad-model2.js", "web/js/rf-20-gate-model.js",
                 "web/js/rf-25c-sound-screens.js", "web/js/rf-25-soundlab.js", "web/js/rf-25d-sound-rack.js", "web/js/rf-25e-curve-editors.js"]) {
  try { vm.runInContext(read(f), ctx, { filename: f }); }
  catch (e) { ck(f + " wczytany w vm", false, e.message); }
}
// soundMeta z rf-23 (sam ten jeden fragment: reszta pliku to pętla padów z DOM-em)
{
  const src = read("web/js/rf-23-pad-loop.js"), a = src.indexOf("function soundMeta(id){"), z = src.indexOf("function soundLabel(", a);
  ck("(w) rf-23: soundMeta znaleziona", a > 0 && z > a);
  if (a > 0 && z > a) vm.runInContext(src.slice(a, z), ctx, { filename: "rf-23 soundMeta" });
}
ctx.renderPlayPads = () => {};   // refreshSoundDropdowns (rf-25) przebudowuje karty padów — tu ich nie ma
const G = (n) => vm.runInContext(n, ctx);
const SR = G("SoundRack"), XPAD = G("XPAD"), sp = G("sanitizePatch"), LIST = G("PAD_SOUND_LIST");

// (a) czyste pomocniki
const P0 = sp({ wave: "sawtooth", legato: true, att: .012, dec: .34, rel: .18, glide: .04, fMin: 260, fMax: 7800, q: 6, lvl: .42, sus: 1 });
ck("(a) isDirty: ten sam patch = czysto", SR.isDirty(P0, JSON.parse(J(P0))) === false);
ck("(a) isDirty: jedno pole inne = brudno", SR.isDirty(P0, Object.assign({}, P0, { q: 6.1 })) === true);
const rev = {}; for (const k of Object.keys(P0).reverse()) rev[k] = P0[k];
ck("(a) isDirty: kolejnosc kluczy bez znaczenia", Object.keys(rev)[0] !== Object.keys(P0)[0] && SR.isDirty(P0, rev) === false);
const wt = Array.from({ length: 64 }, (_, i) => Math.round(Math.sin(2 * Math.PI * i / 64) * 1000) / 1000);
const W = Object.assign({}, P0, { wave: "custom", wt }), W2 = Object.assign({}, W, { wt: wt.map((v, i) => (i === 5 ? 0 : v)) });
ck("(a) isDirty: fala wlasna (wt) brana pod uwage", SR.isDirty(W, W2) === true && SR.isDirty(W, JSON.parse(J(W))) === false);
const E = Object.assign({}, P0, { eq: [{ f: 1000, g: 3, q: 1 }] });
ck("(a) isDirty: pasma korektora (eq) brane pod uwage", SR.isDirty(P0, E) === true
   && SR.isDirty(E, Object.assign({}, P0, { eq: [{ q: 1, g: 3, f: 1000 }] })) === false);
ck("(a) isDirty: krzywizny obwiedni (envC) brane pod uwage", SR.isDirty(P0, Object.assign({}, P0, { envC: [0, .3, 0] })) === true);
ck("(a) isDirty: pusta lista pasm i krzywizny 0,0,0 = brak klucza (jak w zapisie)",
   SR.isDirty(P0, Object.assign({}, P0, { eq: [], envC: [0, 0, 0] })) === false);
ck("(a) kindOf: nic nie edytujesz = nowe", SR.kindOf({}) === "new" && SR.kindOf({ baseOverrides: {} }) === "new");
ck("(a) kindOf: bazowe bez zmian = bazowe", SR.kindOf({ _editingBase: "lead", baseOverrides: {} }) === "base");
ck("(a) kindOf: bazowe z zapisana zmiana = zmienione", SR.kindOf({ _editingBase: "lead", baseOverrides: { lead: { patch: P0 } } }) === "over"
   && SR.kindOf({ _editingBase: "lead", baseOverrides: { lead: { name: "Moje" } } }) === "over");
ck("(a) kindOf: wlasne = wlasne", SR.kindOf({ _editingSlug: "custom-x", baseOverrides: {} }) === "custom");
const ROWS = [{ k: "base", name: "Żaba" }, { k: "over", name: "Syntezator" }, { k: "custom", name: "ŁĄKA nocą" }, { k: "custom", name: "Moja żaba" }];
const names = (rs) => J(rs.map((r) => r.name));
ck("(a) filterRows: zapytanie zaba trafia Zaba z kropka i Moja zaba", names(SR.filterRows(ROWS, "zaba", "all")) === J(["Żaba", "Moja żaba"]), names(SR.filterRows(ROWS, "zaba", "all")));
ck("(a) filterRows: laka z ogonkami i kreska trafia LAKA noca (l z kreska spoza NFD)", names(SR.filterRows(ROWS, "łąka", "all")) === J(["ŁĄKA nocą"]) && names(SR.filterRows(ROWS, "laka", "all")) === J(["ŁĄKA nocą"]));
ck("(a) filterRows: chip rodzaju zaweza", names(SR.filterRows(ROWS, "", "custom")) === J(["ŁĄKA nocą", "Moja żaba"])
   && names(SR.filterRows(ROWS, "zaba", "base")) === J(["Żaba"]) && SR.filterRows(ROWS, "", "over").length === 1);
ck("(a) filterRows: puste zapytanie i chip all = wszystko, nieznany chip = wszystko", SR.filterRows(ROWS, "  ", "all").length === 4 && SR.filterRows(ROWS, "", "xyz").length === 4);
ck("(a) counts: liczniki chipow wg zapytania", J(SR.counts(ROWS, "zaba")) === J({ all: 2, base: 1, custom: 1, over: 0 }), J(SR.counts(ROWS, "zaba")));
ck("(a) previewGuard: przytrzymanie, podglad ciagly, petla, wolne", SR.previewGuard({ _labHold: true }) === "hold" && SR.previewGuard({ _labCont: true }) === "cont"
   && SR.previewGuard({ _seq: { playing: true } }) === "seq" && SR.previewGuard({ _seq: { playing: false } }) === null);

// (b) brudny stan i plakietka na prawdziwym formularzu i prawdziwych funkcjach rf-25 (owiniętych przez _wrap)
const orig = { begin: G("_seBeginEdit"), cancel: G("cancelEdit"), save: G("saveCustomSound"), list: G("renderSoundList"), param: G("labParamChanged") };
els.get("seSave").l.push(orig.save); els.get("seCancelEdit").l.push(orig.cancel);   // jak initSoundEditor
try { SR._wrap(); } catch (e) { ck("(b) _wrap bez wyjatku", false, e.message); }
const sv = els.get("seSave"), cn = els.get("seCancelEdit");
ck("(b) #seSave i #seCancelEdit: oryginal odpiety, klik idzie przez owiniecie", sv.l.length === 1 && sv.l[0] !== orig.save
   && cn.l.length === 1 && cn.l[0] !== orig.cancel);
ck("(b) _wrap owija _seEditReset, _seBeginEdit, cancelEdit, saveCustomSound, renderSoundList, labParamChanged",
   G("_seBeginEdit") !== orig.begin && G("cancelEdit") !== orig.cancel && G("saveCustomSound") !== orig.save
   && G("renderSoundList") !== orig.list && G("labParamChanged") !== orig.param);
const form = () => Object.assign({}, XPAD._editSrcPatch || {}, G("readEditorPatch")());
let clean = 0, rawDirty = 0;
const bad = [];
for (const [id] of LIST) {
  G("loadBaseIntoEditor")(id);
  if (SR._check() === false && els.get("seDirty").hidden === true) clean++; else bad.push(id);
  if (SR.isDirty(form(), G("padPatchFor")(id))) rawDirty++;
}
ck("(b) po wczytaniu kazdego z 35 brzmien bazowych kropka zgaszona", clean === LIST.length && LIST.length === 35,
   clean + "/" + LIST.length + " " + bad.join(",") + " (porownanie z surowym zrodlem zapaliloby ja przy " + rawDirty + ")");
G("loadBaseIntoEditor")("ribbit");
ck("(b) plakietka: bazowe, z nazwa w title; Duplikuj aktywne", kindEl.dataset.kind === "base" && kindEl.textContent === "bazowe"
   && kindEl.attrs.title === "Ribbit" && els.get("seDup").disabled === false, J(kindEl));
const att = els.get("seAtt"), att0 = att.value;
att.value = String(+att0 + 1);
ck("(b) zmiana jednego pokretla = kropka i klasa dirty na pasku", SR._check() === true && els.get("seDirty").hidden === false && barCls.has("dirty"));
att.value = att0;
ck("(b) powrot do wartosci = kropka gasnie", SR._check() === false && els.get("seDirty").hidden === true && !barCls.has("dirty"));
els.get("seName").value = "Ribbit 2";
ck("(b) zmiana nazwy = niezapisane zmiany", SR._check() === true);
els.get("seName").value = "Ribbit";
G("randomizePatch")("filter");
ck("(b) kostka modulu (filtr) = niezapisane zmiany (sprawdzenie przez owiniety labParamChanged)", timers.some((t) => t.ms === 150) && SR._check() === true);
G("cancelEdit")();
ck("(b) anulowanie: plakietka nowe, kropka zgaszona, Duplikuj wyszarzone", kindEl.dataset.kind === "new" && kindEl.textContent === "nowe"
   && SR.dirty === false && els.get("seDup").disabled === true);
XPAD.baseOverrides.lead = { name: "Mój lead", emoji: "🎹", patch: sp(Object.assign({}, G("PAD_PATCH").lead)) };
G("loadBaseIntoEditor")("lead");
ck("(b) bazowe z zapisana zmiana = plakietka zmienione", kindEl.dataset.kind === "over" && kindEl.textContent === "zmienione");
delete XPAD.baseOverrides.lead;
G("cancelEdit")();
els.get("seQ").value = "9";
ck("(b) nowe brzmienie po zmianie = niezapisane zmiany", SR._check() === true);
els.get("seName").value = "";
G("saveCustomSound")();
ck("(b) zapis bez nazwy (odmowa rf-25) = kropka zostaje", SR.dirty === true && els.get("seMsg").textContent === "Najpierw nazwij brzmienie.");
els.get("seName").value = "Żabka testowa";
const before = Object.keys(XPAD.customSounds).length;
G("saveCustomSound")();
const slug = Object.keys(XPAD.customSounds).find((k) => XPAD.customSounds[k].name === "Żabka testowa");
ck("(b) zapis z nazwa = zapisane i kropka zgaszona", !!slug && Object.keys(XPAD.customSounds).length === before + 1 && SR.dirty === false, slug);
G("loadSoundIntoEditor")(slug);
ck("(b) wlasne brzmienie = plakietka wlasne, czysto", kindEl.dataset.kind === "custom" && kindEl.textContent === "własne" && SR.dirty === false);
// „+ Nowe”: poza edycją, formularz w domyślnych ustawieniach (puste {} w _setFormFromPatch), czysto
els.get("seQ").value = "11";
SR.newSound();
ck("(b) + Nowe: plakietka nowe, formularz domyslny, czysto", kindEl.dataset.kind === "new" && els.get("seQ").value === "6"
   && els.get("seName").value === "" && SR.dirty === false, els.get("seQ").value);

// (c) szybki odsłuch na busie laba (PadAudio i bus to atrapy; labEnsure / labSyncPatch prawdziwe z rf-25)
const LAB = G("LAB_ID"), log = [];
ctx.PadAudio = { buses: { [LAB]: {} }, ensure: () => true, resume() {}, bus() {},
  gateOn(inst, src, note) { log.push({ on: src, note, patch: J(XPAD.customSounds[LAB].patch) }); },
  gateOff(inst, src) { log.push({ off: src }); } };
timers = [];
XPAD._labCont = true;
ck("(c) podglad ciagly blokuje odsluch (komunikat, zero nut)", SR.preview("base", "chip") === false && !log.length
   && /Podgląd ciągły/.test(els.get("seMsg").textContent), els.get("seMsg").textContent);
XPAD._labCont = false; XPAD._labHold = true;
ck("(c) przytrzymana nuta blokuje odsluch", SR.preview("base", "chip") === false && !log.length);
XPAD._labHold = false; XPAD._seq = { playing: true };
ck("(c) grajaca petla testowa blokuje odsluch", SR.preview("base", "chip") === false && !log.length);
XPAD._seq = { playing: false };
const want = J(sp(Object.assign({}, G("padPatchFor")("chip"))));
ck("(c) odsluch startuje", SR.preview("base", "chip") === true && SR._prev && SR._prev.id === "chip");
clock.run();
const ons = log.filter((x) => x.on);
ck("(c) cztery nuty arpeggia na wlasnym zrodle, z patchem ogladanego brzmienia",
   ons.length === 4 && J(ons.map((x) => x.note)) === J([60, 64, 67, 72]) && ons.every((x) => x.on === "prev:arp" && x.patch === want), J(ons.map((x) => x.note)));
ck("(c) po ostatniej nucie: wylaczenie i patch formularza z powrotem na busie laba",
   log.some((x) => x.off === "prev:arp") && J(XPAD.customSounds[LAB].patch) === J(G("labPatch")()) && SR._prev === null);
log.length = 0; timers = [];
SR.preview("base", "chip"); SR.preview("base", "chip");
ck("(c) drugi klik play na grajacym wierszu zatrzymuje odsluch", SR._prev === null && log.filter((x) => x.on).length === 1 && !timers.some((t) => t.ms === 230));
log.length = 0; timers = [];
SR.preview("base", "chip"); G("labParamChanged")();
ck("(c) zmiana parametru w trakcie odsluchu go przerywa (bus laba wraca do formularza)", SR._prev === null && J(XPAD.customSounds[LAB].patch) === J(G("labPatch")()));

// (c2) UX 261120: chip rodzaju bez brzmien chowa sie (poza chipem wybranym)
// L4a: chowa sie tez chip, ktory niczego nie odsiewa ("Bazowe 35" obok "Wszystkie 35"), a "Wszystkie" znika,
// gdy jest wybrane i nie ma sie na co przelaczyc
{
  const n = { all: 35, base: 35, custom: 0, over: 0 }, m = { all: 37, base: 35, custom: 2, over: 1 };
  ck("(c2) chip bez brzmien albo bez odsiewu ukryty, wybrany zostaje", SR.chipHidden("custom", n, "all") === true && SR.chipHidden("over", n, "all") === true
     && SR.chipHidden("base", n, "all") === true && SR.chipHidden("all", n, "all") === true && SR.chipHidden("custom", n, "custom") === false
     && SR.chipHidden("all", n, "base") === false && SR.chipHidden("custom", { custom: 2 }, "all") === false);
  ck("(c2) przy mieszanej bibliotece wszystkie chipy z brzmieniami widoczne", ["all", "base", "custom", "over"].every((k) => SR.chipHidden(k, m, "all") === false));
}

// (d) układ w ribbitflip_dashboard.html
const once = ["seName", "seEmoji", "seLvl", "seSearch", "seFilter", "seNew", "seDup", "seList", "seKind", "seDirty", "skScope", "seqGrid",
  "seRandom", "seSave", "seCancelEdit", "seResetBase", "seMsg", "seLibToggle"];
const cnt = once.filter((id) => (dash.match(new RegExp('id="' + id + '"', "g")) || []).length !== 1);
ck("(d) identyfikatory edytora wystepuja dokladnie raz", !cnt.length, cnt.join(","));
const iSE = dash.indexOf('id="soundEditor"'), iBar = dash.indexOf('<div class="se-bar"', iSE), iMain = dash.indexOf('<div class="se-main">', iBar);
const iSide = dash.indexOf('<div class="se-side">', iMain), iScope = dash.indexOf('id="skScope"', iSide);
const iLib = dash.indexOf('<div class="se-lib">', iMain), iInst = dash.indexOf('<div class="se-inst">', iLib);
const iRack = dash.indexOf('<div class="se-rack">', iInst), iSeq = dash.indexOf('<details class="se-sec se-seq-sec">', iRack);
const iEnd = dash.indexOf("</details>", dash.indexOf('id="seqGrid"', iSeq));
ck("(d) kolejnosc: pasek, lewa kolumna (lampa nad lista, 2026-10-03), rack, petla testowa", iSE > 0 && iSE < iBar && iBar < iMain && iMain < iSide
   && iSide < iScope && iScope < iLib && iLib < iInst && iInst < iRack && iRack < iSeq && iSeq < iEnd);
const barBlk = dash.slice(iBar, iMain), libBlk = dash.slice(iLib, iInst), rack = dash.slice(iRack, iSeq), seqBlk = dash.slice(iSeq, iEnd);
const inBar = ["seEmoji", "seName", "seKind", "seDirty", "seMsg", "seLvl", "seRandom", "seNew", "seDup", "seSave", "seCancelEdit", "seResetBase"].filter((id) => !barBlk.includes('id="' + id + '"'));
ck("(d) pasek brzmienia: emoji, nazwa, plakietka, kropka, komunikat, glosnosc i akcje", !inBar.length, inBar.join(","));
ck("(d) glosnosc poza modulami (skorka master): #seLvl w pasku, przed pierwsza karta", barBlk.includes('<label class="se-fld se-lvl-fld"><span>Głośność <b id="seLvlV">')
   && !barBlk.includes("<details") && dash.indexOf('id="seLvl"') < iRack);
ck("(d) stare listwy .se-head i .se-actions zniknely", !/class="[^"]*\bse-(head|actions|cols|params|manage)\b/.test(dash.slice(iSE, iEnd)));
// UX 261120 (P-G4-01): "Nowe brzmienie" i "Duplikuj" stoja w pasku obok "Zaskocz mnie", lista ma wiecej miejsca
const inLib = ["seLibToggle", "seSearch", "seFilter", "seList", "seLibEmpty"].filter((id) => !libBlk.includes('id="' + id + '"'));
ck("(d) kolumna listy: szukanie, chipy, lista, przelacznik waskiego ekranu (akcje w pasku)", !inLib.length && !/id="se(New|Dup)"/.test(libBlk), inLib.join(","));
const chips = [...libBlk.matchAll(/<button type="button" class="se-chip( on)?" data-kind="(\w+)" aria-pressed="(true|false)">/g)];
ck("(d) chipy Wszystkie / Bazowe / Wlasne / Zmienione z aria-pressed (na starcie Wszystkie)", J(chips.map((m) => m[2])) === J(["all", "base", "custom", "over"])
   && chips[0][1] === " on" && chips[0][3] === "true" && chips.slice(1).every((m) => !m[1] && m[3] === "false"));
ck("(d) #seDup wyszarzony na starcie, #seLibToggle z aria-expanded i aria-controls", /id="seDup" type="button" title="[^"]+" disabled>/.test(barBlk)
   && /id="seLibToggle" aria-expanded="false" aria-controls="seLibBody"/.test(libBlk) && libBlk.includes('id="seLibBody"'));
const cards = rack.split('<details class="se-sec"').slice(1);
const sums = cards.map((c) => (/<summary>([\s\S]*?)<\/summary>/.exec(c) || [, ""])[1]);
// 10-20: kart jest PIEC, bo doszla "Probka" (rf-25f, wlasne probki w bibliotece brzmien).
// UX 261120 L4a (pietra): oscylatory, filtr i obwiednia stoja w zwijaku "Ksztalt brzmienia" (pietro 2), a Probka,
// Charakter i petla testowa w jednym "Zaawansowane" na dole edytora (pietro 3).
const WORDS = ["Oscylatory", "Filtr", "Obwiednia", "Próbka", "Charakter"];
ck("(d) rack: piec kart details.se-sec (otwarte), naglowki ze slowami skorek rf-knob", cards.length === 5
   && WORDS.every((w, i) => sums[i].includes(w)) && cards.every((c) => /^[^>]* open>/.test(c)), J(sums.map((s) => s.replace(/<[^>]+>/g, "").slice(0, 30))));
const rnd = cards.map((c) => (/data-rnd="(\w+)"/.exec(c) || [, ""])[1]);
// Probka NIE MA kostki i to decyzja, nie przeoczenie: losowanie podmienia parametry syntezy, a w nagraniu
// uzytkownika nie ma czego losowac. Stad pusty wpis w srodku i kostka sprawdzana tam, gdzie ma byc.
ck("(d) kostka w kazdej karcie poza Probka: osc / filter / env / char", J(rnd) === J(["osc", "filter", "env", "", "char"])
   && sums.every((s, i) => (rnd[i] === "") === !/class="se-st se-st-rnd"/.test(s)), J(rnd));
const eds = cards.map((c) => [...c.matchAll(/<div class="se-sec-editor" data-editor="(\w+)" hidden><\/div>/g)].map((m) => m[1]));
// Probka tez bez plaskiego edytora krzywej: jej podglad przebiegu rysuje rf-25f, nie wspolny mechanizm E6
ck("(d) kontenery na plaskie edytory (E6): wave, eq, env pod pokretlami, Probka i Charakter bez", J(eds) === J([["wave"], ["eq"], ["env"], [], []])
   && (dash.match(/class="se-sec-editor"/g) || []).length === 3, J(eds));
ck("(d) rack bez przyciskow kanalu (lampa jest tylko wizualizacja)", !/data-ch=|📺/.test(rack));
{ // L4a: pietra edytora
  const iShape = dash.indexOf('<details class="cardfold inset se-shape" id="seShapeFold">', iInst), iAdv = dash.indexOf('<details class="cardfold adv se-adv" id="seAdvFold">', iShape);
  const shapeBlk = iShape > 0 && iAdv > iShape ? dash.slice(iShape, iAdv) : "", advBlk = iAdv > 0 ? dash.slice(iAdv, iEnd) : "";
  ck("(d) L4a: Ksztalt brzmienia (pietro 2) niesie oscylatory, filtr i obwiednie", iShape > iInst && iShape < iRack
     && ["osc", "filter", "env"].every((m) => shapeBlk.includes('data-module="' + m + '"')) && !/data-module="(smp|char)"/.test(shapeBlk));
  ck("(d) L4a: jedno Zaawansowane (pietro 3) po kolumnach, z Probka, Charakterem i petla testowa", iAdv > 0
     && ["smp", "char"].every((m) => advBlk.includes('data-module="' + m + '"')) && advBlk.includes('class="se-sec se-seq-sec"')
     && (dash.slice(iSE, iEnd).match(/class="cardfold adv/g) || []).length === 1);
}
ck("(d) petla testowa: zwinieta karta pod rackiem z siatka i klawiszem Zapetl", dash.includes('<details class="se-sec se-seq-sec">')
   && seqBlk.includes("<summary>🎹 <b>Pętla testowa</b></summary>") && seqBlk.includes('id="seqGrid"') && seqBlk.includes('id="seqPlay"'));
const i25c = dash.indexOf('<script src="/web/js/rf-25c-sound-screens.js">'), i25d = dash.indexOf('<script src="/web/js/rf-25d-sound-rack.js">');
const c29 = dash.indexOf('href="/web/css/29-sound-screens.css"'), c30 = dash.indexOf('href="/web/css/30-sound-rack.css"');
ck("(d) rf-25d dolaczony po rf-25c, css/30 po css/29", i25c > 0 && i25d > i25c && c29 > 0 && c30 > c29);
// 10-20: asercja mowila "CRLF bez golych LF" i byla czerwona, bo .gitattributes od pierwszego commita mapuje
// *.html na eol=lf - git ZAWSZE wypisuje ten plik z LF, wiec zadna zmiana po stronie pliku tego nie odwroci.
// Pilnujemy wiec tego, co naprawde warto: jednolitych koncow linii, czyli czystego LF bez CR.
ck("(d) dashboard: czysty LF bez CRLF (.gitattributes: *.html text eol=lf)", !/\r/.test(dash));

// (e) okablowanie
const s25 = read("web/js/rf-25-soundlab.js");
// E6: między lampą a rackiem startują płaskie edytory krzywych (rack owija globalne labParamChanged, a edytory wołają
// je po nazwie w chwili zmiany, więc owinięcie widzi ich zmiany niezależnie od tej kolejności)
// 10-20: po racku startuje jeszcze PadSampler (rf-25f), wiec "}" nie jest juz zaraz za rackiem. Asercja pilnuje
// tego, co wazne - KOLEJNOSCI trzech pierwszych - i dopuszcza sampler na koncu listy.
ck("(e) rf-25: initSoundEditor startuje SoundScreens, SoundEditors, SoundRack, na koncu PadSampler",
   /SoundScreens\.init\(\);[^\n]*\n\s*if\(window\.SoundEditors\)SoundEditors\.init\(\);[^\n]*\n\s*if\(window\.SoundRack\)SoundRack\.init\(\);[^\n]*\n(\s*if\(window\.PadSampler\)PadSampler\.init\(\);[^\n]*\n)?\}/.test(s25));
const s25d = read("web/js/rf-25d-sound-rack.js");
ck("(e) rf-25d: #seSave i #seCancelEdit przepiete z oryginalow na owiniecia",
   /sb\.removeEventListener\("click",oSave\);sb\.addEventListener\("click",\(\)=>saveCustomSound\(\)\)/.test(s25d)
   && /ce\.removeEventListener\("click",oCancel\);ce\.addEventListener\("click",\(\)=>cancelEdit\(\)\)/.test(s25d));
ck("(e) rf-25d: klawisze w naglowku karty nie zwijaja jej (preventDefault + stopPropagation)", /const act=e=>\{e\.preventDefault\(\);e\.stopPropagation\(\);randomizePatch/.test(s25d));

// (i) każdy nowy napis racka ma parę EN w rf-01
const i18n = read("web/js/rf-01-i18n.js");
const KEYS = ["nowe", "Nowe brzmienie, jeszcze nie zapisane", "niezapisane zmiany", "Lista brzmień", "Pokaż albo schowaj listę brzmień", "szukaj brzmienia…",
  "Szukaj brzmienia po nazwie", "Rodzaj brzmienia", "Wszystkie", "Bazowe", "Własne", "Zmienione", "Nowe brzmienie", "Zapisz brzmienie", "⤢ Pokaż ekran", "⤡ Schowaj ekran",
  "Wyczyść formularz i zacznij nowe brzmienie od ustawień domyślnych", "⧉ Duplikuj", "Skopiuj edytowane brzmienie (wersję zapisaną) do nowego własnego",
  "Nic tu nie pasuje do wyszukiwania", "Posłuchaj bez wczytywania", "Losuj ten moduł", "bazowe", "własne", "zmienione",
  "Losuj: Oscylatory", "Losuj: Filtr", "Losuj: Obwiednia głośności", "Losuj: Charakter"];
const miss = KEYS.filter((k) => !i18n.includes(J(k) + ":"));
ck("(i) nowe napisy racka maja pary w slowniku", !miss.length, miss.join(" | "));

// (f) RUNDA NAPRAWCZA PO PRZEGLĄDZIE (2026-10-02): klawisze listy tylko na widocznych wierszach, ▶ jako przełącznik
//     od początku, nazwy kostek, zmiana języka i Ctrl+S tylko w otwartym edytorze, raz na naciśnięcie
{
  const mkRow = (id, kind, cls0) => {
    const cls = new Set(cls0 || []), kids = [];
    const acts = { insertBefore(b) { kids.unshift(b); }, get firstChild() { return kids[0] || null; } };
    return { dataset: { id, kind }, hidden: false, clicks: 0, kids,
      classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c),
        toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); } },
      del: { clicks: 0, click() { this.clicks++; } }, rst: { clicks: 0, click() { this.clicks++; } },
      querySelector(s) { if (s === ".se-play") return kids.find((b) => b.className === "se-play") || null; if (s === ".se-row-acts") return acts;
        if (s === ".se-del") return kind === "custom" ? this.del : null; if (s === ".se-reset") return kind === "base" ? this.rst : null; return null; },
      click() { this.clicks++; }, scrollIntoView() {} };
  };
  ctx.document.createElement = (t) => ({ tagName: t, className: "", textContent: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, addEventListener() {} });
  const rows = [mkRow("lead", "base"), mkRow("ribbit", "base", ["editing"]), mkRow(slug, "custom")];
  const list = { id: "seList", L: [], querySelectorAll: (s) => (s === ".se-row" ? rows : s === ".se-row.kb-focus" ? rows.filter((r) => r.classList.contains("kb-focus")) : []),
    addEventListener(t, f, cap) { this.L.push({ t, f, cap }); } };
  els.set("seList", list);
  SR._prev = null; SR._q = ""; SR._kind = "all";
  SR.decorate();
  const plays = rows.map((r) => r.querySelector(".se-play"));
  ck("(f) dekoracja: klawisz play w kazdym wierszu ma aria-pressed=false od razu i aria-label z nazwa brzmienia",
     plays.every((b) => b && b.attrs["aria-pressed"] === "false" && b.attrs["aria-label"] === "Posłuchaj " + G("soundMeta")(b === plays[2] ? slug : b === plays[1] ? "ribbit" : "lead").name),
     J(plays.map((b) => b && b.attrs)));
  const kd = (key, target) => ({ key, target: target || list, pd: false, st: false, preventDefault() { this.pd = true; }, stopImmediatePropagation() { this.st = true; } });
  // filtr chowa edytowany wiersz (ribbit): Delete / Backspace / Enter nic nie robią
  SR._q = "syntez"; SR.applyFilter();
  ck("(f) filtr (syntez): widoczny tylko Syntezator, edytowany Ribbit ukryty", !rows[0].hidden && rows[1].hidden && rows[2].hidden);
  const hid = rows[1];
  const eDel = kd("Delete"), eBs = kd("Backspace"), eEnt = kd("Enter");
  SR._listKeys(eDel); SR._listKeys(eBs); SR._listKeys(eEnt);
  ck("(f) filtr ukrywa edytowany wiersz: Delete, Backspace i Enter nic nie robia (bez kasowania, przywracania i wczytania)",
     hid.rst.clicks === 0 && hid.clicks === 0 && !eDel.pd && !eEnt.pd && eDel.st && eBs.st && eEnt.st, J({ rst: hid.rst.clicks, load: hid.clicks }));
  // strzałki chodzą po widocznych; Delete / Enter działają na podświetlonym widocznym
  SR._q = ""; SR.applyFilter();
  const eDn = kd("ArrowDown"); SR._listKeys(eDn);
  ck("(f) strzalka w dol od edytowanego wiersza = nastepny widoczny (wlasne brzmienie)", eDn.pd && rows[2].classList.contains("kb-focus") && !rows[1].classList.contains("kb-focus"));
  const e2 = kd("Delete"); SR._listKeys(e2); const e3 = kd("Enter"); SR._listKeys(e3);
  ck("(f) Delete na podswietlonym widocznym wierszu klika jego usun, Enter go wczytuje", e2.pd && rows[2].del.clicks === 1 && e3.pd && rows[2].clicks === 1);
  const e4 = kd("Enter", plays[0]); SR._listKeys(e4);
  ck("(f) Enter na klawiszu w wierszu (np. play) nalezy do klawisza: lista go nie przechwytuje", !e4.pd && !e4.st && rows[2].clicks === 1 && rows[0].clicks === 0);
  SR._kind = "custom"; SR.applyFilter();
  const e5 = kd("ArrowUp"); SR._listKeys(e5); const e6 = kd("Home"); SR._listKeys(e6);
  ck("(f) chip Wlasne: strzalki i Home chodza tylko po widocznym wierszu", rows[2].classList.contains("kb-focus") && !rows[0].classList.contains("kb-focus"));
  SR._kind = "all"; SR.applyFilter(); rows.forEach((r) => r.classList.remove("kb-focus"));
  // rf-25 _seListBindKeys (lista bez rf-25d): też tylko widoczne wiersze
  {
    const L2 = []; const list2 = { querySelectorAll: list.querySelectorAll, addEventListener: (t, f) => L2.push(f) };
    G("_seListBindKeys")(list2);
    rows[1].hidden = true; const r0 = rows[1].rst.clicks, c0 = rows[1].clicks;
    const a = kd("Delete", list2), b = kd("Enter", list2); L2.forEach((f) => { f(a); f(b); });
    const d = kd("ArrowDown", list2); L2.forEach((f) => f(d));
    ck("(f) rf-25 _seListBindKeys: ukryty edytowany wiersz nie jest kasowany ani wczytany, strzalka omija ukryte",
       rows[1].rst.clicks === r0 && rows[1].clicks === c0 && !a.pd && rows[0].classList.contains("kb-focus") && !rows[1].classList.contains("kb-focus"));
    rows[1].hidden = false; rows.forEach((r) => r.classList.remove("kb-focus"));
  }
  // ▶ przełącznik: grający wiersz ma aria-pressed=true
  SR._markPlaying("lead");
  ck("(f) grajacy wiersz: aria-pressed=true tylko na jego klawiszu play", plays[0].attrs["aria-pressed"] === "true" && plays[1].attrs["aria-pressed"] === "false");
  SR._markPlaying(null);
  // zmiana języka: aria-label ▶ składany z nazwą brzmienia, więc przebudowany przez _gl()
  const gl0 = ctx._gl; ctx.__lang = "en"; ctx._gl = (pl, en) => (ctx.__lang === "en" ? en : pl);
  SR._relang();
  ck("(f) jezyk: _relang przebudowuje aria-label klawisza play (Listen to ...)", plays.every((b) => /^Listen to /.test(b.attrs["aria-label"])), J(plays.map((b) => b.attrs["aria-label"])));
  ctx._gl = gl0; delete ctx.__lang; SR._relang();
  // init w tym kontekście (na końcu: owija funkcje drugi raz, a dalej już nic ich nie sprawdza) — obserwator języka i Ctrl+S
  const mos = []; ctx.MutationObserver = class { constructor(f) { this.f = f; mos.push(this); } observe(t, o) { this.t = t; this.o = o; } };
  ctx.document.documentElement = { lang: "pl" };
  const box = els.get("soundEditor"), BL = {}; box.addEventListener = (t, f) => { (BL[t] || (BL[t] = [])).push(f); };
  const sv = els.get("seSave"); sv.clicks = 0; sv.click = function () { this.clicks++; };
  els.get("seDup").addEventListener = () => {};
  SR._inited = false; SR.init();
  const m = mos.find((o) => o.t === ctx.document.documentElement);
  ck("(f) jezyk: rack obserwuje atrybut lang na <html>", !!m && J(m.o.attributeFilter) === J(["lang"]));
  ctx.__lang = "en"; ctx._gl = (pl, en) => (ctx.__lang === "en" ? en : pl); if (m) m.f([]);
  ck("(f) jezyk: zmiana lang przez obserwator = klawisz play po angielsku", plays.every((b) => /^Listen to /.test(b.attrs["aria-label"])));
  ctx._gl = gl0; delete ctx.__lang;
  const ks = (o) => Object.assign({ key: "s", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, repeat: false, target: {}, pd: false, preventDefault() { this.pd = true; } }, o);
  els.get("seName").value = "Moje";
  const fire = (e) => { (BL.keydown || []).forEach((f) => f(e)); return e; };
  box.open = false; const z1 = fire(ks({}));
  ck("(f) Ctrl+S przy zwinietym edytorze: nic (bez zapisu i bez preventDefault)", !z1.pd && sv.clicks === 0);
  box.open = true; const z2 = fire(ks({}));
  ck("(f) Ctrl+S w otwartym edytorze zapisuje raz", z2.pd && sv.clicks === 1);
  const z3 = fire(ks({ repeat: true }));
  ck("(f) Ctrl+S trzymany (repeat): bez kolejnych zapisow, ale bez okna Zapisz strone przegladarki", z3.pd && sv.clicks === 1);
  // nazwy kostek w nagłówkach kart (aria-label) i ich pary EN
  const rnd = [...dash.matchAll(/data-rnd="(\w+)" title="Losuj ten moduł" aria-label="([^"]+)"/g)].map((x) => [x[1], x[2]]);
  ck("(f) HTML: kazda kostka ma aria-label z nazwa modulu (Losuj: Oscylatory, Filtr, Obwiednia glosnosci, Charakter)",
     J(rnd) === J([["osc", "Losuj: Oscylatory"], ["filter", "Losuj: Filtr"], ["env", "Losuj: Obwiednia głośności"], ["char", "Losuj: Charakter"]]), J(rnd));
}

const failed = checks.filter((c) => !c[1]);
for (const [n, ok, d] of checks) process.stdout.write((ok ? "PASS  " : "FAIL  ") + n + (ok || !d ? "" : "  -> " + d) + "\n");
process.stdout.write(JSON.stringify({ checks }) + "\n");
process.exit(failed.length ? 1 : 0);
