#!/usr/bin/env node
// ==================================================================================================
//  fix_quotes.mjs — jeden styl cudzysłowów w panelu (plan UX, iteracja 2, pozycja 2.13).
//
//  Zasada: po polsku ZAWSZE „…”, po angielsku ZAWSZE “…”. Przed tym skryptem w kodzie stały obok
//  siebie trzy zapisy: PL „…" (ASCII zamykający), PL „…” oraz EN „…” / “…” — na jednym ekranie
//  (OSC, Kontroler, Połączenie, Mapowanie › Informacje) widać było dwa style naraz.
//
//  Uruchomienie (z katalogu repo):
//    node tools/fix_quotes.mjs            — tylko raport (nic nie zapisuje)
//    node tools/fix_quotes.mjs --write    — zapisuje zmiany
//    node tools/fix_quotes.mjs --list     — raport z każdym wystąpieniem (plik:linia, przed → po)
//
//  Co robi:
//   (1) web/js/rf-*.js i web/ribbitflip_dashboard.html — POMIJA komentarze (`//`, `/* */`, `<!-- -->`)
//       i regexy; zmienia tylko w literałach napisowych JS i w tekście HTML: `„X"` → `„X”`; w literale
//       JS w podwójnych cudzysłowach dopasowuje `„X\"` i usuwa backslash.
//   (2) Strona ANGIELSKA dostaje “X”: w rf-01-i18n.js wartości I18N_EN (klucz PL zostaje „X”), w
//       słownikach modułowych `RF_*_I18N = {…}` też wartości, a w wywołaniach `_gl(pl, en)` /
//       `$.t(pl, en)` / `_t(pl, en)` — drugi argument. W tych miejscach `„`→`“`, a zamykający
//       `"`/`”` → `”`.
//   (3) Po zamianie sprawdza, że każdy ZMIENIONY klucz I18N_EN nadal występuje w źródle panelu (całość
//       albo — dla sklejeń aria-label „etykieta + podpowiedź” — każdy fragment po „ — ”).
//
//  Czego NIE robi: nie tyka komentarzy, ribbitflip_monitor.py, README, docs/; nie zmienia „ - ” na „—”
//  w nazwach plików presetów (decyzja rf-01/rf-39i3); nie rusza wzorców dynamicznych w rf-01
//  (tablica regexów za słownikiem) — te przegląda się ręcznie.
//
//  Skaner JS jest celowo prosty (stan: kod / komentarz / literał ' " ` / regex; template z dziurami
//  ${…}, w których kod skanuje się osobno). Regex rozpoznaje po poprzednim znaku niebiałym (nawias,
//  operator, `return`) i pomija — w tym kodzie to wystarcza. Literał z HTML-em w środku czyta skaner
//  HTML (tekst osobno, atrybuty osobno), żeby „X" tuż przed zamykającym cudzysłowem atrybutu nie
//  zjadło tego cudzysłowu. Skrypt jest idempotentny: drugi przebieg zgłasza 0 literałów
//  (tests/test_i18n_quotes.py uruchamia go na sucho i tego wymaga).
//
//  Strona EN rozpoznawana jest po KONTEKŚCIE literału: wartość w słowniku I18N_EN / RF_*_I18N /
//  bloku `"en": {…}` paczki REST, drugi ARGUMENT `_gl(pl, en)` i pomocników `_xxxT` / `_xxxL`
//  (_ra3T, _wheelT, _cfgT, _dmL, _tvL…, _ra5Pick, _rfwMore), drugi element pary `klucz: ["PL", "EN"]`.
//  Wszystko inne to strona PL.
// ==================================================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(REPO, "web");
const argv = process.argv.slice(2);
const WRITE = argv.includes("--write");
const LIST = argv.includes("--list");

// „X" gdzie X nie zawiera cudzysłowów ani końca linii; w JS "…" zamykający to \"
const RE_PL_PLAIN = /„([^„”"“\n\\]*)"/g;          // w tekście HTML, w literałach '…' i `…`
const RE_PL_DQ = /„([^„”"“\n\\]*)\\"/g;           // w literale "…"
const RE_EN_OPEN = /„/g;                           // strona EN: każde „ → “

// ------------------------------------------------------------------ pomocnicze -------------
function lineOf(src, i) { let n = 1; for (let k = 0; k < i; k++) if (src.charCodeAt(k) === 10) n++; return n; }

// Zamiana wewnątrz JEDNEGO literału (bez ograniczników). `dq` = literał "…" (zamykający to \");
// `en` = strona angielska (otwierający „ → “, zamykający → ”).
function fixLiteral(body, dq, en) {
  let out = body;
  // Literał z HTML-em w środku (szablony kart, poradniki): `„X"` bywa TUŻ PRZED zamykającym cudzysłowem
  // atrybutu (title="… „X") — regex by go zjadł. Dlatego taki literał czyta skaner HTML (tekst między
  // znacznikami osobno, atrybuty osobno); w literale "…" atrybuty są zapisane jako \" — odkodowujemy
  // i po zamianie kodujemy z powrotem.
  if (!en && body.includes("<")) {
    const raw = dq ? body.replace(/\\"/g, '"') : body;
    const fixed = apply(raw, scanHTML(raw));
    return dq ? fixed.replace(/"/g, '\\"') : fixed;
  }
  if (en) {
    // „X” / „X\" / „X" → “X”
    out = out.replace(dq ? /„([^„”"“\n\\]*)(\\"|”)/g : /„([^„”"“\n\\]*)("|”)/g, "“$1”");
    // „ bez rozpoznanego zamknięcia (np. zamknięcie w innym węźle) → “ tylko gdy nie ma już “ w parze
    out = out.replace(RE_EN_OPEN, "“");
  } else {
    out = out.replace(dq ? RE_PL_DQ : RE_PL_PLAIN, "„$1”");
  }
  return out;
}

// Koniec template'u zaczynającego się na `i` (backtick) i lista jego dziur `${…}` [od, do) — z
// zagnieżdżonymi template'ami i literałami w środku dziur (np. `${a?"":" off"}`, `${x?`…`:``}`).
function scanTemplate(src, i) {
  const n = src.length; const holes = []; let j = i + 1;
  while (j < n) {
    const c = src[j];
    if (c === "\\") { j += 2; continue; }
    if (c === "`") return { end: j + 1, holes };
    if (c === "$" && src[j + 1] === "{") {
      let d = 1, k = j + 2;
      while (k < n && d) {
        const ch = src[k];
        if (ch === '"' || ch === "'") { k++; while (k < n && src[k] !== ch && src[k] !== "\n") { if (src[k] === "\\") k++; k++; } k++; continue; }
        if (ch === "`") { k = scanTemplate(src, k).end; continue; }
        if (ch === "{") d++; else if (ch === "}") d--;
        k++;
      }
      holes.push([j, k]); j = k; continue;
    }
    j++;
  }
  return { end: n, holes };
}

// ------------------------------------------------------------------ skaner JS ---------------
// Zwraca listę zmian {start,end,before,after,kind} dla fragmentu JS. `ctx` mówi, co jest stroną EN:
//  - w obiekcie `I18N_EN = {` / `RF_*_I18N = {` wartość (literał, po którym NIE stoi `:`) jest EN,
//  - w wywołaniu `_gl(` / `_t(` / `$.t(` / `.t(` drugi literał na głębokości 1 jest EN,
//  - w tablicy `hint: [pl, en]` (rf-49m) drugi literał też.
function scanJS(src, fileName) {
  const changes = [];
  const n = src.length;
  let i = 0;
  let lastSig = "";                 // ostatni znaczący (nie-biały, nie-komentarz) znak — do regex/division
  let lastWord = "";                // ostatnie słowo (identyfikator) — do `return /re/` i nazw wywołań
  // Stos kontekstów: {type:"dict"|"call"|"hint", depth, arg}
  const stack = [];
  let depth = 0;                    // głębokość nawiasów ( [ {
  const isDictName = (w) => w === "I18N_EN" || /^RF_[A-Z0-9_]*I18N$/.test(w);
  // _gl(pl,en), $.t(pl,en) i lokalne pomocniki modułów o tej samej sygnaturze: _ra3T, _wheelT, _cfgT,
  // _rfpiT, _cvT… (wszystkie `function _xxxT(pl, en)`).
  // Do tego `_dmL` / `_tvL` (rf-45, rf-48), `_ra5Pick` (rf-39) i `_rfwMore` (rf-39k) — ta sama sygnatura.
  const isGlName = (w) => w === "_gl" || w === "_t" || w === "t" || w === "gl" || w === "_ra5Pick" || w === "_rfwMore"
    || /^_[A-Za-z0-9]+[TL]$/.test(w);
  // `klucz: ["PL", "EN"]` — para w obiekcie (rf-39l-share-hub, rf-39i3, `hint:` w rf-49m): tablica o DOKŁADNIE
  // dwóch elementach, oba zaczynają się literałem napisowym. Dłuższe listy napisów (np. nazwy wycinków) to nie pary.
  const isPairArray = (m) => {
    let k = m + 1, d = 0, commas = 0; const starts = [];
    let expect = true;
    while (k < n) {
      const ch = src[k];
      if (ch === '"' || ch === "'" || ch === "`") {
        if (expect && d === 0) starts.push(true);
        expect = false;
        k++; while (k < n && src[k] !== ch) { if (src[k] === "\\") k++; k++; } k++; continue;
      }
      if (expect && !/[ \t\r\n]/.test(ch)) { if (d === 0) starts.push(false); expect = false; }
      if ("([{".includes(ch)) d++;
      else if (ch === "]" && d === 0) break;
      else if (")]}".includes(ch)) d--;
      else if (ch === "," && d === 0) { commas++; expect = true; }
      k++;
    }
    return commas === 1 && starts.length === 2 && starts[0] && starts[1];
  };

  // `holes` = zakresy `${…}` w template (kod w środku skanuje osobne wywołanie scanJS) — literał
  // dzielimy na odcinki między nimi, żeby ta sama zmiana nie została policzona dwa razy.
  const pushStr = (start, end, quote, holes = []) => {
    if (!src.slice(start + 1, end - 1).includes("„")) return;
    // czy to strona EN?
    let en = false;
    const top = stack[stack.length - 1];
    // co stoi za literałem?
    let j = end; while (j < n && /[ \t\r\n]/.test(src[j])) j++;
    const after = src[j] || "";
    // słownik: także literały w zagnieżdżonych tablicach/obiektach (paczka REST ma `actions:[{desc:…}]`)
    if (top && top.type === "dict" && depth >= top.depth) en = after !== ":";
    // w wywołaniu liczy się ARGUMENT (przecinki na tej głębokości), nie kolejny literał — pierwszy
    // argument bywa sklejany z kilku literałów ("…„" + nazwa + "”…")
    if (top && (top.type === "call" || top.type === "hint") && top.depth === depth) en = top.arg === 1;
    const dq = quote === '"';
    let a = start + 1;
    for (const [h0, h1] of [...holes, [end - 1, end - 1]]) {
      const body = src.slice(a, h0);
      const fixed = fixLiteral(body, dq, en);
      if (fixed !== body) changes.push({ start: a, end: h0, before: body, after: fixed, kind: en ? "en" : "pl", line: lineOf(src, a) });
      a = h1;
    }
  };

  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    // komentarze
    if (c === "/" && c2 === "/") { const e = src.indexOf("\n", i); i = e < 0 ? n : e; continue; }
    if (c === "/" && c2 === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
    // literały
    if (c === "`") {                                                         // template — kod w ${…} skanujemy osobno
      const { end, holes } = scanTemplate(src, i);
      for (const [h0, h1] of holes) {
        const inner = src.slice(h0 + 2, h1 - 1);
        for (const ch of scanJS(inner)) changes.push({ ...ch, start: ch.start + h0 + 2, end: ch.end + h0 + 2, line: lineOf(src, ch.start + h0 + 2) });
      }
      pushStr(i, end, "`", holes);
      lastSig = "`"; lastWord = ""; i = end; continue;
    }
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === q) break;
        if (src[j] === "\n") break;                                         // urwany literał — nie ryzykujemy
        j++;
      }
      pushStr(i, j + 1, q);
      // `"en": {…}` — angielska połówka paczki REST (rf-38-rest-packs): wszystkie wartości w środku są EN
      if (src.slice(i, j + 1) === '"en"') {
        let k = j + 1; while (k < n && /[ \t]/.test(src[k])) k++;
        if (src[k] === ":") { let m = k + 1; while (m < n && /[ \t\r\n]/.test(src[m])) m++;
          if (src[m] === "{") stack.push({ type: "dict", depth: depth + 1, arg: 0, openAt: m }); }
      }
      lastSig = q; lastWord = ""; i = j + 1; continue;
    }
    // regex
    if (c === "/") {
      const reStart = lastSig === "" || "(,=:[!&|?{};+-*%<>~^".includes(lastSig) || lastWord === "return" || lastWord === "typeof";
      if (reStart) {
        let j = i + 1, cls = false;
        while (j < n) {
          if (src[j] === "\\") { j += 2; continue; }
          if (cls) { if (src[j] === "]") cls = false; }
          else if (src[j] === "[") cls = true;
          else if (src[j] === "/") break;
          else if (src[j] === "\n") break;
          j++;
        }
        i = j + 1; lastSig = "/"; lastWord = ""; continue;
      }
    }
    // identyfikatory
    if (/[A-Za-z_$]/.test(c)) {
      let j = i; while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const w = src.slice(i, j);
      // `I18N_EN={` / `RF_X_I18N = {` → słownik
      let k = j; while (k < n && /[ \t]/.test(src[k])) k++;
      if (isDictName(w) && src[k] === "=") {
        let m = k + 1; while (m < n && /[ \t\r\n]/.test(src[m])) m++;
        if (src[m] === "{") { stack.push({ type: "dict", depth: depth + 1, arg: 0, openAt: m }); }
      }
      if (isGlName(w) && src[k] === "(") stack.push({ type: "call", depth: depth + 1, arg: 0, openAt: k });
      if (src[k] === ":") {                                     // `klucz: ["PL", "EN"]`
        let m = k + 1; while (m < n && /[ \t\r\n]/.test(src[m])) m++;
        if (src[m] === "[" && isPairArray(m)) stack.push({ type: "hint", depth: depth + 1, arg: 0, openAt: m });
      }
      lastWord = w; lastSig = w[w.length - 1]; i = j; continue;
    }
    if ("([{".includes(c)) { depth++; lastSig = c; lastWord = ""; i++; continue; }
    if (")]}".includes(c)) {
      const top = stack[stack.length - 1];
      if (top && top.depth === depth) stack.pop();
      depth--; lastSig = c; lastWord = ""; i++; continue;
    }
    if (c === ",") { const top = stack[stack.length - 1]; if (top && top.depth === depth) top.arg++; }
    if (!/[ \t\r\n]/.test(c)) { lastSig = c; lastWord = ""; }
    i++;
  }
  return changes;
}

// ------------------------------------------------------------------ skaner HTML -------------
function scanHTML(src) {
  const changes = [];
  const n = src.length; let i = 0;
  while (i < n) {
    if (src.startsWith("<!--", i)) { const e = src.indexOf("-->", i + 4); i = e < 0 ? n : e + 3; continue; }
    if (/^<script\b/i.test(src.slice(i, i + 8))) {
      const open = src.indexOf(">", i); const close = src.indexOf("</script", open);
      if (open < 0 || close < 0) break;
      const body = src.slice(open + 1, close);
      for (const ch of scanJS(body)) changes.push({ ...ch, start: ch.start + open + 1, end: ch.end + open + 1, line: lineOf(src, ch.start + open + 1) });
      i = close; continue;
    }
    if (/^<style\b/i.test(src.slice(i, i + 7))) { const e = src.indexOf("</style", i); i = e < 0 ? n : e; continue; }
    if (src[i] === "<") {                                   // znacznik: atrybuty w cudzysłowach
      let j = i + 1, q = null;
      while (j < n) { const ch = src[j]; if (q) { if (ch === q) q = null; } else if (ch === '"' || ch === "'") q = ch; else if (ch === ">") break; j++; }
      // w atrybutach '…' (pojedynczych) „X" może stać — traktujemy jak tekst
      const tag = src.slice(i, j + 1);
      const re = /'([^']*)'/g; let m;
      while ((m = re.exec(tag))) {
        if (!m[1].includes("„")) continue;
        const fixed = fixLiteral(m[1], false, false);
        if (fixed !== m[1]) changes.push({ start: i + m.index + 1, end: i + m.index + 1 + m[1].length, before: m[1], after: fixed, kind: "attr", line: lineOf(src, i + m.index) });
      }
      i = j + 1; continue;
    }
    // tekst do następnego <
    let e = src.indexOf("<", i); if (e < 0) e = n;
    const body = src.slice(i, e);
    if (body.includes("„")) {
      const fixed = fixLiteral(body, false, false);
      if (fixed !== body) changes.push({ start: i, end: e, before: body, after: fixed, kind: "text", line: lineOf(src, i) });
    }
    i = e;
  }
  return changes;
}

function apply(src, changes) {
  let out = src, shift = 0;
  for (const ch of changes.sort((a, b) => a.start - b.start)) {
    out = out.slice(0, ch.start + shift) + ch.after + out.slice(ch.end + shift);
    shift += ch.after.length - (ch.end - ch.start);
  }
  return out;
}

// ------------------------------------------------------------------ main --------------------
const files = fs.readdirSync(path.join(WEB, "js")).filter(f => /^rf-.*\.js$/.test(f)).sort()
  .map(f => path.join(WEB, "js", f));
files.push(path.join(WEB, "ribbitflip_dashboard.html"));

let total = 0; const perFile = [];
const i18nPath = path.join(WEB, "js", "rf-01-i18n.js");
let changedKeys = [];
for (const fp of files) {
  const src = fs.readFileSync(fp, "utf8");
  const changes = fp.endsWith(".html") ? scanHTML(src) : scanJS(src, fp);
  if (!changes.length) continue;
  total += changes.length;
  perFile.push([path.relative(REPO, fp), changes.length, changes.filter(c => c.kind === "en").length]);
  if (LIST) for (const c of changes) console.log(`${path.relative(REPO, fp)}:${c.line} [${c.kind}] ${JSON.stringify(c.before.slice(0, 90))} → ${JSON.stringify(c.after.slice(0, 90))}`);
  if (fp === i18nPath) changedKeys = changes.filter(c => c.kind === "pl").map(c => c.after);
  if (WRITE) fs.writeFileSync(fp, apply(src, changes), "utf8");    // bez zmiany końców linii — literały ich nie mają
}
for (const [f, k, e] of perFile) console.log(`${f}: ${k} literałów (${e} EN)`);
console.log(`RAZEM: ${total} literałów w ${perFile.length} plikach` + (WRITE ? " — ZAPISANO" : " — raport (użyj --write)"));

// (3) zmienione klucze PL z rf-01 nadal występują w źródle (po zapisie: w zmienionych plikach)
if (changedKeys.length) {
  const corpus = files.filter(f => f !== i18nPath).map(f => {
    const s = fs.readFileSync(f, "utf8");
    return WRITE ? s : apply(s, f.endsWith(".html") ? scanHTML(s) : scanJS(s));
  }).join("\n");
  // Sklejenia literałów ("…" + "…", `…`+`…`) — po obu stronach zdejmujemy ograniczniki i plusy.
  const norm = (s) => s.replace(/\\"/g, '"').replace(/["'`+]/g, "").replace(/\s+/g, " ");
  const corpusN = norm(corpus);
  const missing = [];
  for (const k of changedKeys) {
    const plain = norm(k);
    if (corpusN.includes(plain)) continue;
    // sklejenie aria-label „etykieta — podpowiedź”: każdy fragment osobno
    const parts = plain.split(" — ").filter(p => p.length > 3);
    if (parts.length > 1 && parts.every(p => corpusN.includes(p))) continue;
    missing.push(plain);
  }
  console.log(`Klucze I18N_EN zmienione: ${changedKeys.length}; bez wystąpienia w źródle panelu: ${missing.length}`);
  for (const m of missing) console.log("  BRAK: " + JSON.stringify(m.slice(0, 120)));
}
