// BIBLIOTEKA BRZMIEŃ BAZOWYCH I LOSOWANIE (etap E4b, 2026-10-02) — BEZ PRZEGLĄDARKI.
//
// 12 nowych brzmień bazowych (rf-17) to czyste dane: pad i scena pamiętają je po identyfikatorze, więc
// najkruchsze są tu trzy rzeczy:
//   • STARE BRZMIENIA BAJT W BAJT — 23 dotychczasowe patche, ich etykiety i metadane mają być identyczne jak
//     w kopii sprzed zmiany (`_backups/261002-skop-e4b/rf-17-pad-model.js`, obie wersje ładowane w `vm`),
//     a kolejność listy zachowana (nowe wchodzą przed „Szum”, który zostaje ostatni);
//   • NOWE PATCHE JUŻ W POSTACI ZAPISU — każde pole przechodzi przez sanitizePatch bez zmiany (wartości w zakresach,
//     zaokrąglenia jak w zapisie), fala `wt` ma 64 próbki bez składowej stałej ze szczytem 1, a każde pole siedzi
//     na kroku i w zakresie suwaka edytora (wczytanie do formularza i odczyt oddają te same liczby);
//   • KAŻDE NOWE BRZMIENIE MA NAZWĘ W OBU JĘZYKACH — para z emoji (lista, menu) i bez (formularz).
// Losowanie (rf-25 randomizePatch) na PRAWDZIWYCH plikach: rf-20 (sanitizePatch), rf-25c (SoundScreens: czysta matematyka
// fali), rf-25e (SoundEditors od etapu E6: fala, pasma i krzywizny w readInto / load) i rf-25 (formularz), z atrapą
// DOM, której suwaki przycinają i zaokrąglają wartość jak przeglądarka
// (min / max / step wzięte z ribbitflip_dashboard.html). Sprawdzane: wynik każdego losowania przechodzi sanitizePatch
// bez zmiany, głośność stoi, formularz pokazuje dokładnie wylosowany patch, „wszystko” sięga po nowe mechanizmy,
// a kostka modułu nie rusza pól spoza swojego modułu. Runda naprawcza 2026-10-02: pole losuje kostka tej karty, w której
// stoi jego kontrolka (mapa pól → karta z dashboardu; „Rozświetlenie” jest w Filtrze), a RND_KEYS jest źródłem dla kodu
// losowania (czyszczenie pól modułu) i każdy moduł ustawia dokładnie pola ze swojej listy.
//
// Wywoływane z tests/test_synth_store.py; samodzielnie: node tests/sound_library_harness.mjs
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

const NEW = ["pulsar", "hammond", "vocoder", "radio", "cello", "tide", "kalimba", "glass", "drop", "bassgtr", "bubble", "toad"];
const BACKUP = "_backups/261002-skop-e4b/rf-17-pad-model.js";

// ---------- atrapa DOM: pola edytora brzmień z ich prawdziwymi zakresami ----------
const dash = read("web/ribbitflip_dashboard.html");
const els = new Map();
function mkRange(id, min, max, step, val) {
  const dec = (String(step).split(".")[1] || "").length;
  let v = "";
  const el = { id, type: "range", min, max, step,
    get value() { return v; },
    // jak <input type=range>: niepoprawna liczba → środek zakresu, przycięcie do min/max, przyciąganie do kroku od min
    set value(x) { let n = +x; if (!Number.isFinite(n)) n = (min + max) / 2;
      n = Math.min(max, Math.max(min, n)); n = min + Math.round((n - min) / step) * step;
      if (n > max + 1e-9) n -= step; v = String(+n.toFixed(dec)); } };
  el.value = val;
  return el;
}
function mkSelect(id, opts, val) {
  let v = val;
  return { id, type: "select", options: opts,
    get value() { return v; },
    set value(x) { x = String(x); v = opts.includes(x) ? x : ""; } };   // jak <select>: wartość spoza opcji = brak wyboru
}
for (const m of dash.matchAll(/<input id="(se[A-Za-z0-9]+)" type="range" min="([^"]+)" max="([^"]+)" step="([^"]+)" value="([^"]+)"/g))
  els.set(m[1], mkRange(m[1], +m[2], +m[3], +m[4], m[5]));
for (const m of dash.matchAll(/<select id="(se[A-Za-z0-9]+)">([\s\S]*?)<\/select>/g)) {
  const opts = [...m[2].matchAll(/<option value="([^"]*)"/g)].map((o) => o[1]);
  const sel = /<option value="([^"]*)" selected/.exec(m[2]);
  els.set(m[1], mkSelect(m[1], opts, sel ? sel[1] : opts[0]));
}
for (const m of dash.matchAll(/<input id="(se[A-Za-z0-9]+)" type="checkbox"/g)) els.set(m[1], { id: m[1], type: "checkbox", checked: false });
for (const id of ["seName", "seEmoji"]) els.set(id, { id, type: "text", value: id === "seEmoji" ? "🎛" : "" });
for (const m of dash.matchAll(/<b id="(se[A-Za-z0-9]+V)">/g)) els.set(m[1], { id: m[1], textContent: "" });
els.set("seMsg", { id: "seMsg", textContent: "", style: {} });
els.set("soundEditor", { id: "soundEditor", open: true, querySelector: () => null, querySelectorAll: () => [],
                         classList: { toggle() {} } });
const FORM = ["seType", "seWave", "seOct", "seDet", "seSub", "seOsc2", "seOsc2Wave", "seOsc2Semi", "seOsc2Det", "seOsc2Mix",
  "seFilt", "seFMin", "seFMax", "seQ", "seFEnv", "seFEnvT", "seFSwell", "seAtt", "seDec", "seSus", "seRel", "seGlide",
  "seDrive", "seCroak", "seAm", "seNoise", "seLvl"];
const missing = FORM.filter((id) => !els.has(id));
ck("(dom) dashboard: wszystkie pola edytora brzmien znalezione", !missing.length, missing.join(","));

// ---------- model, ekran i edytor PRAWDZIWE, w jednym kontekście ----------
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
  setTimeout: () => 0, clearTimeout: () => {},
  PadPlate: { _fs: {} },
};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["web/js/rf-17-pad-model.js", "web/js/rf-19-pad-model2.js", "web/js/rf-20-gate-model.js",
                 "web/js/rf-25c-sound-screens.js", "web/js/rf-25e-curve-editors.js", "web/js/rf-25-soundlab.js"]) {
  try { vm.runInContext(read(f), ctx, { filename: f }); }
  catch (e) { ck(f + " wczytany w vm", false, e.message); }
}
const G = (n) => vm.runInContext(n, ctx);
const sp = G("sanitizePatch"), PP = G("PAD_PATCH"), LIST = G("PAD_SOUND_LIST"), META = G("PAD_BASE_META");
const SS = G("SoundScreens");

// stara wersja rf-17 z kopii — osobny kontekst, ten sam kod co przed zmianą
const old = {};
try {
  const octx = { console }; vm.createContext(octx);
  vm.runInContext(read(BACKUP), octx, { filename: BACKUP });
  old.PP = vm.runInContext("PAD_PATCH", octx); old.LIST = vm.runInContext("PAD_SOUND_LIST", octx);
  old.META = vm.runInContext("PAD_BASE_META", octx);
} catch (e) { ck("(d) kopia rf-17 sprzed zmiany wczytana", false, e.message); }

// (d) STARE BRZMIENIA BAJT W BAJT
if (old.PP) {
  const oldIds = Object.keys(old.PP);
  ck("(d) kopia ma 23 brzmienia bazowe", oldIds.length === 23, oldIds.length);
  const diff = oldIds.filter((k) => J(PP[k]) !== J(old.PP[k]));
  ck("(d) 23 stare patche identyczne jak w kopii (JSON)", !diff.length, diff.join(","));
  const mdiff = oldIds.filter((k) => J(META[k]) !== J(old.META[k]));
  ck("(d) 23 stare wpisy PAD_BASE_META identyczne", !mdiff.length, mdiff.join(","));
  const oldNoFx = old.LIST.slice(0, -1);
  ck("(d) stare etykiety PAD_SOUND_LIST identyczne i w tej samej kolejnosci",
     J(LIST.slice(0, oldNoFx.length)) === J(oldNoFx), J(LIST.slice(0, 3)));
  ck("(d) Szum (fx) nadal ostatni na liscie", J(LIST[LIST.length - 1]) === J(old.LIST[old.LIST.length - 1]));
  ck("(d) nowe brzmienia na liscie tuz przed Szumem, w ustalonej kolejnosci",
     J(LIST.slice(oldNoFx.length, -1).map((s) => s[0])) === J(NEW), J(LIST.slice(oldNoFx.length, -1).map((s) => s[0])));
  ck("(d) PAD_SOUND_LIST, PAD_PATCH i PAD_BASE_META maja po 35 brzmien",
     LIST.length === 35 && Object.keys(PP).length === 35 && Object.keys(META).length === 35,
     LIST.length + "/" + Object.keys(PP).length + "/" + Object.keys(META).length);
  // (e) identyfikatory: krótkie ASCII, bez kolizji ze starymi i między sobą
  const badId = NEW.filter((k) => !/^[a-z][a-z0-9]{1,11}$/.test(k) || oldIds.includes(k));
  ck("(e) 12 nowych id: male litery ASCII, bez kolizji ze starymi", !badId.length && new Set(NEW).size === 12, badId.join(","));
}

// (a) trzy miejsca + obie pary i18n (z emoji: lista i menu; bez emoji: formularz)
const i18n = read("web/js/rf-01-i18n.js");
const pairOf = (k) => { const m = new RegExp(J(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ':("(?:[^"\\\\]|\\\\.)*")').exec(i18n);
  return m ? JSON.parse(m[1]) : null; };
for (const id of NEW) {
  const row = LIST.find((s) => s[0] === id), m = META[id];
  ck("(a) " + id + ": jest w PAD_SOUND_LIST, PAD_PATCH i PAD_BASE_META",
     !!row && !!PP[id] && !!m && row[1] === m.emoji + " " + m.name, row && row[1]);
  const en1 = m && pairOf(m.emoji + " " + m.name), en2 = m && pairOf(m.name);
  ck("(a) " + id + ": para i18n z emoji i bez emoji", !!en1 && !!en2 && en1.startsWith(m.emoji + " ") && en1.slice(m.emoji.length + 1) === en2,
     J([en1, en2]));
}

// (b) nowe patche przechodzą przez sanitizePatch bez zmiany (pole po polu; brakujące oct/det = domyślne 0),
// (c) fala `wt`: 64 próbki w −1..1, szczyt ≥ .95, |średnia| < .02 — i każde brzmienie stoi na nowym mechanizmie
const DEF = { oct: 0, det: 0 };
for (const id of NEW) {
  const p = PP[id], s = sp(p);
  if (!p || !s) { ck("(b) " + id + ": patch istnieje", false); continue; }
  const bad = [];
  for (const k of new Set([...Object.keys(p), ...Object.keys(s)])) {
    const a = k in p ? p[k] : DEF[k];
    if (J(a) !== J(s[k])) bad.push(k + ":" + J(a) + "->" + J(s[k]));
  }
  ck("(b) " + id + ": sanitizePatch nic nie zmienia", !bad.length, bad.join(" | "));
  ck("(b) " + id + ": poziom wywazony (.3-.6)", p.lvl >= .3 && p.lvl <= .6, p.lvl);
  ck("(b) " + id + ": uzywa fali wlasnej, korektora albo krzywizn obwiedni", !!(p.wt || p.eq || p.envC));
  if (p.wt) {
    const w = p.wt, mean = w.reduce((x, v) => x + v, 0) / w.length, pk = Math.max(...w.map(Math.abs));
    ck("(c) " + id + ": wt = 64 probki w -1..1, szczyt >= .95, |srednia| < .02",
       p.wave === "custom" && w.length === 64 && w.every((v) => typeof v === "number" && v >= -1 && v <= 1) && pk >= .95 && Math.abs(mean) < .02,
       "n=" + w.length + " pk=" + pk + " mean=" + mean.toFixed(4));
  }
}
ck("(b) patche zamrozone razem z tablicami i pasmami (wt, eq, envC)",
   Object.isFrozen(PP.hammond) && Object.isFrozen(PP.hammond.wt) && Object.isFrozen(PP.hammond.eq) && Object.isFrozen(PP.hammond.eq[0]) &&
   Object.isFrozen(PP.cello.envC));
ck("(c) sa fale wlasne, korektor i krzywizny (min. po 4 brzmienia)",
   NEW.filter((k) => PP[k].wt).length >= 4 && NEW.filter((k) => PP[k].eq).length >= 4 && NEW.filter((k) => PP[k].envC).length >= 4);

// ---------- formularz: wczytaj → odczytaj ----------
const setForm = G("_setFormFromPatch"), readForm = G("readEditorPatch");
const formPatch = () => sp(readForm());
// (b2) każde nowe brzmienie mieści się w suwakach edytora: po wczytaniu do formularza odczyt ma te same liczby
for (const id of NEW) {
  try {
    setForm(META[id].name, META[id].emoji, PP[id]);
    const r = formPatch(), s = sp(PP[id]);
    const bad = Object.keys(s).filter((k) => J(s[k]) !== J(r[k])).map((k) => k + ":" + J(s[k]) + "->" + J(r[k]));
    ck("(b2) " + id + ": formularz edytora oddaje patch bez zmian (krok i zakres suwakow)", !bad.length, bad.join(" | "));
  } catch (e) { ck("(b2) " + id + ": wczytanie do formularza", false, e.message); }
}

// (f) LOSOWANIE
const rp = G("randomizePatch");
let captured = null;
const realSet = setForm;
ctx._setFormFromPatch = (n, e, p) => { captured = p; return realSet(n, e, p); };   // funkcja globalna: wywołanie idzie przez obiekt kontekstu
const SCOPE_KEYS = G("RND_KEYS");
const ALL_KEYS = new Set(Object.values(SCOPE_KEYS).flat());
ck("(f) RND_KEYS dziela patch na 4 moduly bez nakladania", ALL_KEYS.size === Object.values(SCOPE_KEYS).flat().length, [...ALL_KEYS].length);
{
  // pole, które sanitizePatch może wypuścić, a którego żaden moduł nie losuje (poza poziomem), byłoby „martwe” dla kostek
  const probe = sp({ wave: "custom", wt: new Array(64).fill(0), legato: true, noise: 1, croak: 1, sub: 1, rel: .2, dec: .2, glide: .1, fSwell: .2, am: 9,
    sus: .5, filt: "notch", osc2: 1, fEnv: .2, drive: .2, eq: [{ f: 100, g: 1, q: 1 }], envC: [.1, 0, 0] });
  const orphan = Object.keys(probe).filter((k) => k !== "lvl" && !ALL_KEYS.has(k));
  ck("(f) kazde pole patcha nalezy do ktoregos modulu", !orphan.length, orphan.join(","));
}
let cardOfField = () => null;
// runda naprawcza 2026-10-02: pole należy do kostki tej karty, w której stoi jego kontrolka. Mapa pole → kontrolka
// (id z readEditorPatch albo kontener płaskiego edytora); karta = <details data-module> z dashboardu, która ją zawiera
{
  const FIELD_EL = { wave: "seWave", wt: 'data-editor="wave"', oct: "seOct", det: "seDet", sub: "seSub", osc2: "seOsc2", osc2wave: "seOsc2Wave",
    osc2semi: "seOsc2Semi", osc2det: "seOsc2Det", osc2mix: "seOsc2Mix", filt: "seFilt", fMin: "seFMin", fMax: "seFMax", q: "seQ",
    fEnv: "seFEnv", fEnvT: "seFEnvT", fSwell: "seFSwell", eq: 'data-editor="eq"', legato: "seType", att: "seAtt", dec: "seDec",
    sus: "seSus", rel: "seRel", glide: "seGlide", envC: 'data-editor="env"', drive: "seDrive", croak: "seCroak", am: "seAm", noise: "seNoise" };
  const cards = {};
  for (const m of dash.matchAll(/<details class="se-sec" data-module="(\w+)"[^>]*>([\s\S]*?)<\/details>/g)) cards[m[1]] = m[2];
  const cardOf = (k) => { const s = FIELD_EL[k]; if (!s) return null; const needle = s.startsWith("data-") ? s : 'id="' + s + '"';
    return Object.keys(cards).find((c) => cards[c].includes(needle)) || null; };
  const unmapped = [...ALL_KEYS].filter((k) => !FIELD_EL[k]);
  // Losowanie dotyczy kart Z KOSTKĄ. Karta „Probka" (2026-10-19) jest piątą kartą modułu, ale kostki nie ma
  // i mieć nie będzie: nagrania nie da się wylosować, a wylosowany stroj albo pętla bez bajtów nic nie znaczą.
  const zKostka = Object.keys(cards).filter((c) => /data-rnd="/.test(cards[c]));
  ck("(f) mapa pol -> kontrolek obejmuje kazde pole RND_KEYS, a dashboard ma 4 karty modulow z kostka", !unmapped.length && J(zKostka) === J(["osc", "filter", "env", "char"]),
     unmapped.join(",") + " " + J(zKostka));
  ck("(f) karta Probka jest na liscie kart, ale bez kostki (nagrania nie da sie wylosowac)",
     "smp" in cards && !/data-rnd="/.test(cards.smp || ""), J(Object.keys(cards)));
  const wrong = [];
  for (const [scope, keys] of Object.entries(SCOPE_KEYS)) for (const k of keys) if (cardOf(k) !== scope) wrong.push(k + ": " + scope + " != " + cardOf(k));
  ck("(f) RND_KEYS: kazde pole w kostce tej karty, w ktorej stoi jego kontrolka (Rozswietlenie = fSwell w karcie Filtr)",
     !wrong.length && cardOf("fSwell") === "filter" && SCOPE_KEYS.filter.includes("fSwell") && !SCOPE_KEYS.char.includes("fSwell"), wrong.join(" | "));
  cardOfField = cardOf;
  // RND_KEYS jest źródłem prawdy w KODZIE: randomizePatch czyści pola modułu z tej listy przed jego losowaniem, a każdy
  // moduł ustawia dokładnie pola ze swojej listy (nic spoza niej i nic martwego w liście) — 600 losowań na pustym patchu
  const R = { osc: G("_rndOsc"), filter: G("_rndFilter"), env: G("_rndEnv"), char: G("_rndChar") }, bad = [];
  for (const [scope, fn] of Object.entries(R)) {
    const seen = new Set();
    for (let i = 0; i < 600; i++) { const p = {}; fn(p); Object.keys(p).forEach((k) => seen.add(k)); }
    const own = new Set(SCOPE_KEYS[scope]), extra = [...seen].filter((k) => !own.has(k)), never = [...own].filter((k) => !seen.has(k));
    if (extra.length || never.length) bad.push(scope + " +" + extra.join(",") + " -" + never.join(","));
  }
  ck("(f) losowanie: kazdy modul ustawia dokladnie pola swojego RND_KEYS (nic spoza, nic martwego w liscie)", !bad.length, bad.join(" | "));
  ck("(f) randomizePatch czysci pola modulu wg RND_KEYS i losuje przez RND_ROLL (lista jest zrodlem dla kodu, nie tylko dla testu)",
     read("web/js/rf-25-soundlab.js").includes("for(const s in RND_KEYS)if(all||scope===s){for(const k of RND_KEYS[s])delete p[k];RND_ROLL[s](p);}") &&
     J(Object.keys(G("RND_ROLL"))) === J(Object.keys(SCOPE_KEYS)));
}
const lvEl = els.get("seLvl");
lvEl.value = "37";
const LVL = formPatch().lvl;
const seen = { custom: 0, eq: 0, envC: 0, osc2: 0, drive: 0, croak: 0, pluck: 0, legato: 0, fEnv: 0, harm: 0, curve: 0 };
let notStable = [], lvlMoved = [], notShown = [], wtBad = [], msgBad = 0, emojis = new Set();
for (let i = 0; i < 200; i++) {
  captured = null;
  let out;
  try { out = rp(); } catch (e) { notStable.push("wyjatek: " + e.message); break; }
  const p = captured;
  if (!p || J(p) !== J(out)) { notStable.push(i + ": brak wyniku"); continue; }
  if (J(sp(p)) !== J(p)) notStable.push(i + ": " + J(p).slice(0, 80));
  if (p.lvl !== LVL || lvEl.value !== "37") lvlMoved.push(i + ": " + p.lvl + "/" + lvEl.value);
  const r = formPatch();
  if (J(r) !== J(p)) notShown.push(i + ": " + Object.keys(p).filter((k) => J(p[k]) !== J(r[k])).map((k) => k + " " + J(p[k]) + "->" + J(r[k])).join(" "));
  if (els.get("seMsg").textContent !== "Wylosowano brzmienie. Dostrój je i zapisz.") msgBad++;
  emojis.add(els.get("seEmoji").value);
  if (p.wave === "custom") { seen.custom++;
    const w = p.wt, mean = w.reduce((x, v) => x + v, 0) / 64, pk = Math.max(...w.map(Math.abs));
    if (w.length !== 64 || pk < .95 || Math.abs(mean) > .02) wtBad.push(i + ": pk=" + pk + " mean=" + mean.toFixed(3));
    // fala z szeregu harmonicznych ma fazy zerowe (fromHarmonics) — próbka 0 jest wtedy zerem; krzywa z fazami zwykle nie
    if (w[0] === 0 && w[32] === 0) seen.harm++; else seen.curve++; }
  if (p.eq) seen.eq++;
  if (p.envC) seen.envC++;
  if (p.osc2) seen.osc2++;
  if (p.drive) seen.drive++;
  if (p.croak) seen.croak++;
  if (p.fEnv) seen.fEnv++;
  if (p.legato) seen.legato++; else seen.pluck++;
}
ck("(f) 200x 'all': kazdy wynik przechodzi sanitizePatch bez zmiany", !notStable.length, notStable.slice(0, 3).join(" | "));
ck("(f) 200x 'all': glosnosc (lvl i suwak) bez zmian", !lvlMoved.length, lvlMoved.slice(0, 3).join(" | "));
ck("(f) 200x 'all': formularz pokazuje dokladnie wylosowany patch", !notShown.length, notShown.slice(0, 3).join(" | "));
ck("(f) 200x 'all': fale wlasne maja 64 probki, szczyt 1, bez skladowej stalej", !wtBad.length, wtBad.slice(0, 3).join(" | "));
ck("(f) 200x 'all': komunikat 'Wylosowano brzmienie'", msgBad === 0, msgBad);
ck("(f) 200x 'all': pojawiaja sie fala wlasna, korektor, krzywizny, osc2 i przester",
   seen.custom > 0 && seen.eq > 0 && seen.envC > 0 && seen.osc2 > 0 && seen.drive > 0, J(seen));
ck("(f) 200x 'all': fala wlasna z obu przepisow (szereg harmonicznych i gladka krzywa)", seen.harm > 0 && seen.curve > 0, J(seen));
ck("(f) 200x 'all': legato i pluck, rechot, obwiednia filtra", seen.legato > 0 && seen.pluck > 0 && seen.croak > 0 && seen.fEnv > 0, J(seen));
ck("(f) 200x 'all': fala wlasna w ok. 35 % losowan", seen.custom >= 40 && seen.custom <= 110, seen.custom);
ck("(f) 'all' losuje tez emoji", emojis.size > 3, [...emojis].join(""));

// kostka modułu: baza = formularz po losowaniu „all” (różne bazy, także z falą własną, pasmami i krzywiznami)
const MSG = { osc: "Wylosowano: Oscylatory", filter: "Wylosowano: Filtr", env: "Wylosowano: Obwiednia", char: "Wylosowano: Charakter" };
for (const scope of ["osc", "filter", "env", "char"]) {
  const own = new Set(SCOPE_KEYS[scope]);
  let moved = [], notStable2 = [], notShown2 = [], changed = 0, msgBad2 = 0, emojiMoved = 0;
  const offCard = new Set();
  for (let i = 0; i < 50; i++) {
    rp("all");
    els.get("seName").value = "Moja";
    const base = formPatch(), emo = els.get("seEmoji").value;
    captured = null;
    rp(scope);
    const p = captured;
    if (!p) { notStable2.push(i + ": brak wyniku"); continue; }
    if (J(sp(p)) !== J(p)) notStable2.push(i + ": " + J(p).slice(0, 80));
    const keys = new Set([...Object.keys(base), ...Object.keys(p)]);
    const out = [...keys].filter((k) => !own.has(k) && J(base[k]) !== J(p[k]));
    if (out.length) moved.push(i + ": " + out.map((k) => k + " " + J(base[k]) + "->" + J(p[k])).join(" "));
    for (const k of keys) if (J(base[k]) !== J(p[k]) && cardOfField(k) !== scope) offCard.add(k + "@" + cardOfField(k));
    if ([...own].some((k) => J(base[k]) !== J(p[k]))) changed++;
    const r = formPatch();
    if (J(r) !== J(p)) notShown2.push(i + ": " + Object.keys(p).filter((k) => J(p[k]) !== J(r[k])).join(","));
    if (els.get("seMsg").textContent !== MSG[scope]) msgBad2++;
    if (els.get("seEmoji").value !== emo || els.get("seName").value !== "Moja") emojiMoved++;
  }
  ck("(f) 50x '" + scope + "': pola spoza modulu identyczne z baza", !moved.length, moved.slice(0, 2).join(" | "));
  ck("(f) 50x '" + scope + "': kazde zmienione pole ma kontrolke w karcie data-module=" + scope, !offCard.size, [...offCard].join(","));
  ck("(f) 50x '" + scope + "': wynik przechodzi sanitizePatch bez zmiany", !notStable2.length, notStable2.slice(0, 2).join(" | "));
  ck("(f) 50x '" + scope + "': formularz pokazuje wylosowany patch", !notShown2.length, notShown2.slice(0, 2).join(" | "));
  // Charakter to rzadkie przełączniki (przester 35 %, rechot 12 %, szum 3 %; nabrzmiewanie filtra od 2026-10-02 losuje
  // kostka Filtra): los „nic nie zmienił” wypada w ok. 31 % rzutów, więc tam wystarczy, że zmienia się regularnie
  ck("(f) 50x '" + scope + "': modul faktycznie sie zmienia", changed >= (scope === "char" ? 15 : 45), changed);
  ck("(f) 50x '" + scope + "': komunikat modulu, nazwa i emoji bez zmian", msgBad2 === 0 && emojiMoved === 0, msgBad2 + "/" + emojiMoved);
}
{ // zakres spoza listy (np. Event z gołego listenera) = „wszystko”
  captured = null; rp({ type: "click" });
  ck("(f) nieznany zakres = 'all'", !!captured && els.get("seMsg").textContent === "Wylosowano brzmienie. Dostrój je i zapisz.");
}
// przycisk „Zaskocz mnie” woła losowanie bez zdarzenia jako argumentu
ck("(f) #seRandom wola randomizePatch(\"all\")", /g\("seRandom"\)[^\n]*addEventListener\("click",\(\)=>randomizePatch\("all"\)\)/.test(read("web/js/rf-25-soundlab.js")));
ck("(f) pary i18n komunikatow kostek", Object.values(MSG).every((m) => /^Randomised: [A-Z]/.test(pairOf(m) || "")),
   Object.values(MSG).map(pairOf).join(" | "));

const failed = checks.filter((c) => !c[1]);
for (const [n, ok, d] of checks) process.stdout.write((ok ? "PASS  " : "FAIL  ") + n + (ok || !d ? "" : "  -> " + d) + "\n");
process.stdout.write(JSON.stringify({ checks }) + "\n");
process.exit(failed.length ? 1 : 0);
