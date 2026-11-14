// JEDNA PISOWNIA I JEDNO SŁOWO NA KAPSEL PO STRONIE EN — SPRAWDZONE NA SŁOWNIKU.
//
// Angielska strona panelu jest pisana po brytyjsku (behaviour, colour, centre, grey, -ise;
// komentarz nad I18N_EN w web/js/rf-01-i18n.js), a na kapsel mówi „capsule” — nie „puck”, nie
// „cap” (chyba że chodzi o czapkę: „a capsule on a cap”). Oba te ustalenia rozjeżdżały się po
// cichu, bo słownik ma ponad 2300 wartości i nikt nie czyta go w całości; tu czyta go maszyna.
//
// Co sprawdza:
//   1. wartości I18N_EN (rf-01 w `vm`) i tekst wzorców I18N_EN_PATTERNS — 0 amerykańskich form
//      (behavior/center/centered/color/gray/recognized/randomize) poza etykietami Dolphina
//      („Controller Settings”, „Motion Input”), które są nazwami własnymi;
//   2. te same wartości — 0 „puck”/„pucks” i 0 „cap” poza „on a cap” (czapka);
//   3. drugi argument `_gl(pl, en)` w web/js/rf-*.js — 0 amerykańskich form i 0 „puck”;
//   4. słowniki modułowe RF_*_I18N (scalane do I18N_EN przez Object.assign) — to samo co w 1–2;
//   5. warstwa "en" paczek REST (REST_PACKS w rf-38, nazwy/opisy/poradniki widoczne w oknie
//      „Z szablonu…") — to nie jest ani słownik, ani _gl, więc bez tego punktu 37 „puck” siedziało
//      tam niezauważone.
//
// Bez przeglądarki i bez serwera. Wywoływany z tests/test_i18n_dupes.py; ostatnia linia to JSON
// {checks:[[nazwa, ok, szczegół], …]}. Samodzielnie: node tests/i18n_spelling_harness.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const JS = path.join(REPO, "web/js");
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);

// `color:` / `color=` to identyfikatory CSS w literałach HTML (style="color:…"), nie proza
const US = /\b(behavior|center|centered|color(?![:=-])|gray|recognized|randomize)\b/i;
const PUCK = /\bpucks?\b/i;
const CAP = /\bcaps?\b/i;
const CAP_OK = /\bon a cap\b|\bcaps the\b/gi;         // czapka („on a cap”) i czasownik („caps the send rate”), nie kapsel
const DOLPHIN = /Controller Settings|Motion Input/;   // nazwy własne z Dolphina — pisownia oryginału

// --- rf-01 w vm ------------------------------------------------------------------------------
const ctx = {
  console, window: {},
  navigator: { languages: ["en-US"], language: "en-US" },
  localStorage: { getItem: () => "en", setItem() {} },
  fetch: () => Promise.reject(new Error("brak sieci w harnessie")),
};
ctx.window.window = ctx.window; ctx.globalThis = ctx;
vm.createContext(ctx);
const rf01src = fs.readFileSync(path.join(JS, "rf-01-i18n.js"), "utf8");
let RF = null;
try {
  vm.runInContext(rf01src + "\n;globalThis.__RF={I18N_EN,I18N_EN_PATTERNS};", ctx, { filename: "rf-01-i18n.js" });
  RF = ctx.__RF;
} catch (e) { ck("rf-01-i18n.js wykonuje się w vm", false, String(e && e.message)); }

function scan(label, entries) {                       // entries: [[skąd, tekst], …]
  const us = [], puck = [], cap = [];
  for (const [where, v] of entries) {
    if (typeof v !== "string") continue;
    if (US.test(v) && !DOLPHIN.test(v)) us.push(where + ": " + v.slice(0, 70));
    if (PUCK.test(v)) puck.push(where + ": " + v.slice(0, 70));
    if (CAP.test(v.replace(CAP_OK, ""))) cap.push(where + ": " + v.slice(0, 70));
  }
  ck(`${label}: 0 amerykańskich form (behavior/center/color/gray/recognized/randomize)`, us.length === 0, us.length + " → " + us.slice(0, 5).join(" | "));
  ck(`${label}: 0 „puck”`, puck.length === 0, puck.length + " → " + puck.slice(0, 5).join(" | "));
  ck(`${label}: 0 „cap” = kapsel (zostaje tylko „on a cap”)`, cap.length === 0, cap.length + " → " + cap.slice(0, 5).join(" | "));
}

if (RF) {
  ck("rf-01: I18N_EN ma > 2000 wartości", Object.keys(RF.I18N_EN).length > 2000, Object.keys(RF.I18N_EN).length);
  scan("rf-01 I18N_EN (wartości EN)", Object.entries(RF.I18N_EN).map(([k, v]) => ["„" + k.slice(0, 30) + "”", v]));
  // tekst wzorców (funkcje — czytamy źródło bloku I18N_EN_PATTERNS)
  const pm = /const I18N_EN_PATTERNS=\[([\s\S]*?)\n\];/.exec(rf01src);
  ck("rf-01: blok I18N_EN_PATTERNS znaleziony", !!pm);
  if (pm) {
    // tylko prawa strona strzałek (wynik EN), bez komentarzy i bez regexów PL
    const rhs = pm[1].split("\n").filter(l => !/^\s*\/\//.test(l)).map(l => l.replace(/^\s*\[\/.*?\/[a-z]*,\s*m=>/, "")).join("\n");
    scan("rf-01 I18N_EN_PATTERNS (wynik EN)", [["patterns", rhs]]);
  }
}

// --- _gl(pl, en) i słowniki modułowe w web/js -------------------------------------------------
const GL = /_gl\(\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*,\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
const GL_LOOSE = /_gl\([^)]*\b(recognized|behavior|center|centered|color(?![:=-])|gray|randomize|pucks?)\b/g;
const DICT = /^\s*const (RF_[A-Z0-9_]*I18N[A-Z0-9_]*)\s*=\s*\{([\s\S]*?)^\s*\}\s*[;)]?\s*$/gm;
const PAIR = /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
const glEntries = [], dictEntries = [], loose = [];
for (const fn of fs.readdirSync(JS).filter(f => /^rf-.*\.js$/.test(f) && f !== "rf-01-i18n.js").sort()) {
  const src = fs.readFileSync(path.join(JS, fn), "utf8");
  let m;
  while ((m = GL.exec(src))) {
    let v = m[1]; try { v = v[0] === '"' ? JSON.parse(v) : v.slice(1, -1); } catch (e) { v = v.slice(1, -1); }
    glEntries.push([fn + ":" + src.slice(0, m.index).split("\n").length, v]);
  }
  while ((m = GL_LOOSE.exec(src))) loose.push(fn + ":" + src.slice(0, m.index).split("\n").length + " " + m[1]);
  while ((m = DICT.exec(src))) {
    let p; const body = m[2].split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
    while ((p = PAIR.exec(body))) dictEntries.push([fn + " " + m[1], p[2]]);
  }
}
ck("web/js: znaleziono ≥ 500 wywołań _gl(pl, en) z literałami", glEntries.length >= 500, glEntries.length);
scan("web/js _gl(pl, en) — strona EN", glEntries);
ck("web/js: grep `_gl([^)]*\\b(recognized|behavior|center|…|puck)\\b` → 0", loose.length === 0, loose.slice(0, 5).join(" | "));
ck("web/js: znaleziono ≥ 10 słowników modułowych RF_*_I18N", dictEntries.length >= 10, dictEntries.length);
scan("web/js słowniki RF_*_I18N (wartości EN)", dictEntries);

// --- paczki REST (rf-38): warstwa "en" -------------------------------------------------------
// Plik to sam literał `const REST_PACKS=[…]` — uruchamiamy go w vm i zbieramy wszystkie napisy z `en`.
const packEntries = [];
try {
  const pctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(JS, "rf-38-rest-packs.js"), "utf8") + "\n;globalThis.__RP=REST_PACKS;", pctx, { filename: "rf-38-rest-packs.js" });
  const walk = (v, where) => {
    if (typeof v === "string") packEntries.push([where, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + "[" + i + "]"));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], where + "." + k);
  };
  for (const p of pctx.__RP || []) if (p && p.en) walk(p.en, "rf-38 " + p.key + ".en");
} catch (e) { ck("rf-38-rest-packs.js wykonuje się w vm", false, String(e && e.message)); }
ck("rf-38: warstwa \"en\" paczek REST ma ≥ 100 napisów", packEntries.length >= 100, packEntries.length);
scan("rf-38 REST_PACKS \"en\" (nazwy, opisy, poradniki paczek)", packEntries);

// --- pojedyncze zdania z planu ----------------------------------------------------------------
const rf29 = fs.readFileSync(path.join(JS, "rf-29-undo-import.js"), "utf8");
ck("rf-29: „File not recognised” (2×)", (rf29.match(/File not recognised/g) || []).length === 2 && !/recognized/.test(rf29));
ck("rf-01: komentarz o pisowni brytyjskiej nad I18N_EN", /British spelling/.test(rf01src.split("const I18N_EN={")[0]));
if (RF) {
  for (const [k, want] of [["Zachowanie", "Behaviour"], ["Auto-środkowanie żyro przy bezruchu", "Auto-centre gyro when still"],
                           ["wycentrowane", "centred"], ["Akcel · Oś kapsla (pion)", "Accel · Capsule axis (vertical)"],
                           ["Nie rozpoznano pliku — nieprawidłowy JSON.", "File not recognised — invalid JSON."]]) {
    ck(`rf-01: „${k}” → „${want}”`, RF.I18N_EN[k] === want, RF.I18N_EN[k]);
  }
}

let nf = 0;
for (const [n, ok, d] of checks) { if (!ok) nf++; console.log((ok ? "PASS  " : "FAIL  ") + n + (ok || !d ? "" : "  -- " + d)); }
console.log(JSON.stringify({ checks }));
process.exitCode = nf ? 1 : 0;
