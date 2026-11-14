// KOSZT PIERWSZEJ KLATKI W ŁAŃCUCHU BOOTU — pozycja 7.16 planu (wydajnosc-07).
//
// Uruchomienie (git-bash, z katalogu repo):
//   NODE_PATH="$(npm root -g)" node tests/boot_timing_harness.mjs [url] [--runs N] [--save PLIK]
//     url      — instancja panelu, domyślnie http://127.0.0.1:8813/ (symulacja, kapsel „Triki 1”)
//     --runs N — ile par startów (domyślnie 5; każda para = jeden start „przed” i jeden „po”)
//     --save   — zapisz surowe liczby do pliku JSON (do porównań między sesjami)
//
// Wymaga: DZIAŁAJĄCEJ instancji panelu i globalnego @playwright/test (stąd NODE_PATH albo zmienna
// RF_PLAYWRIGHT ze ścieżką). NIE jest wpięty w zestaw tests/test_*.py — potrzebuje żywej
// przeglądarki i żywego serwera. Kod wyjścia: 0 = wszystko PASS, 1 = FAIL, 2 = instancja martwa.
//
// CO SPRAWDZA I DLACZEGO. `frame()` (rf-09-scopes.js) rysuje cztery oscyloskopy, kulę pozy, pas
// naciśnięć i miniaturę prawej kolumny, czytając rozmiary tuż po zapisach do DOM. Do 2026-09-05
// stała w tablicy initów w rf-40-boot.js, więc cała ta praca doklejała się do SYNCHRONICZNEGO
// łańcucha bootu — rysowała ekran, którego jeszcze nikt nie widział. Od 7.16 idzie przez
// `frameDeferred()`, czyli o jedną `requestAnimationFrame` później.
//
// Wariant „przed” odtwarzamy w TEJ SAMEJ sesji: `page.route` podmienia w treści rf-40-boot.js
// `,connect,frameDeferred,` z powrotem na `,connect,frame,`. Dzięki temu oba warianty mierzy ta
// sama maszyna, w tej samej minucie, na przemian — bez tego liczby z dwóch osobnych przebiegów są
// nieporównywalne (rozrzut startów na tej maszynie to ±80 ms przy medianie ~410 ms).
//
// Miara TWARDA (asercje): ile wywołań rysujących na kontekście 2D wykonało się SYNCHRONICZNIE,
// poza jakąkolwiek `requestAnimationFrame`, do `DOMContentLoaded`. To dokładnie to, co pozycja
// zdejmuje z bootu, i nie zależy od zegara (zmierzone 2026-09-05: 55 wywołań „przed” → 0 „po” —
// karty osi i legendy rysują się przez rAF, więc w bootcie synchronicznie rysowała TYLKO ta jedna
// klatka). Druga twarda miara: w profilu CPU startu nie ma węzła `frame` wywołanego z rf-40-boot.js.
//
// Miara INFORMACYJNA (drukowana, bez asercji): mediana `domInteractive − max(responseEnd rf-*.js)`.
// Oszczędność rzędu 30 ms tonie w rozrzucie startów (±80 ms), headless rasteryzuje canvas
// programowo, a wariant „przed” idzie przez przechwycone żądanie, które samo dokłada swój czas —
// twardą asercję na milisekundach ten harness stawiałby na piasku. Dla porządku: pomiar tej samej
// wielkości bez przechwytywania, PRZED i PO zmianie (5 startów), dał 413,0 → 414,3 ms, czyli
// różnicę w granicach szumu. Prawdziwy dowód jest wyżej: klatka wyszła z zadania bootu.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { rfBezPierwszegoStartu } = require("./_rf_pierwszy_start.cjs");   // bez pytania i zaproszenia pierwszego startu

const argv = process.argv.slice(2);
const flagVal = (n, d) => { const i = argv.indexOf(n); return (i >= 0 && argv[i + 1]) ? argv[i + 1] : d; };
const URL = argv.find(a => /^https?:\/\//.test(a)) || "http://127.0.0.1:8813/";
const RUNS = parseInt(flagVal("--runs", "5"), 10);
const SAVE = flagVal("--save", "");

const PW = process.env.RF_PLAYWRIGHT
  || (process.env.APPDATA ? process.env.APPDATA + "/npm/node_modules/@playwright/test" : "@playwright/test");
const { chromium } = require(PW);

let nPass = 0, nFail = 0;
function check(name, cond, detail) {
  if (cond) { nPass++; console.log("PASS " + name); }
  else { nFail++; console.log("FAIL " + name + (detail !== undefined ? " — " + String(detail).slice(0, 300) : "")); }
  return !!cond;
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// Sonda wstrzykiwana PRZED pierwszym skryptem strony: liczy wywołania rysujące i wie, czy padły
// wewnątrz callbacku rAF, czy w kodzie synchronicznym.
const PROBE = () => {
  const RAF = window.requestAnimationFrame.bind(window);
  window.__rfInRaf = 0;
  window.requestAnimationFrame = function (cb) {
    return RAF(function (t) { window.__rfInRaf++; try { return cb(t); } finally { window.__rfInRaf--; } });
  };
  const P = CanvasRenderingContext2D.prototype;
  window.__rfDraw = 0; window.__rfDrawSync = 0;
  for (const m of ["clearRect", "fillRect", "stroke", "fill", "drawImage", "fillText"]) {
    const f = P[m];
    if (typeof f === "function") P[m] = function () {
      window.__rfDraw++; if (!window.__rfInRaf) window.__rfDrawSync++;
      return f.apply(this, arguments);
    };
  }
  window.__rfSyncAtDCL = -1;
  document.addEventListener("DOMContentLoaded", () => { window.__rfSyncAtDCL = window.__rfDrawSync; });
};

// Wariant „przed 7.16”: ta sama treść pliku, tylko `frameDeferred` z powrotem na `frame`.
async function routeOldBoot(ctx) {
  await ctx.route(/rf-40-boot\.js/, async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace(",connect,frameDeferred,", ",connect,frame,");
    await route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body });
  });
}

async function oneRun(browser, { old = false, profile = false } = {}) {
  const ctx = await rfBezPierwszegoStartu(browser.newContext({ viewport: { width: 1440, height: 900 } }));
  await ctx.addInitScript(l => localStorage.setItem("ribbitflip.lang", l), "pl");
  await ctx.addInitScript(PROBE);
  if (old) await routeOldBoot(ctx);
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", e => errs.push(String(e)));
  let cdp = null;
  if (profile) {
    cdp = await ctx.newCDPSession(page);
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 80 });
    await cdp.send("Profiler.start");
  }
  await page.goto(URL, { waitUntil: "load" });           // NIGDY networkidle — SSE /stream nie milknie
  await page.waitForTimeout(1500);
  let bootFrame = null;
  if (cdp) {
    const { profile: prof } = await cdp.send("Profiler.stop");
    const byId = new Map(prof.nodes.map(n => [n.id, n]));
    const parent = new Map();
    for (const n of prof.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
    bootFrame = prof.nodes.some(n =>
      n.callFrame.functionName === "frame" && /rf-09-scopes\.js/.test(n.callFrame.url || "") &&
      /rf-40-boot\.js/.test(((byId.get(parent.get(n.id)) || {}).callFrame || {}).url || ""));
  }
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const js = performance.getEntriesByType("resource").filter(r => /\/rf-[^/]*\.js(\?|$)/.test(r.name));
    const last = js.reduce((a, r) => Math.max(a, r.responseEnd), 0);
    const live = [...document.querySelectorAll("canvas")]
      .filter(c => c.width > 0 && c.getBoundingClientRect().width > 0).length;
    return { delta: (nav.domInteractive || 0) - last, nJs: js.length, syncAtDCL: window.__rfSyncAtDCL, live };
  });
  // Pętla klatek żyje: licznik rysowania rośnie dalej po starcie (symulacja płynie). Liczymy
  // WYWOŁANIA, nie piksele — #scopeAccel siedzi na ekranie „Czujnik” i przy starcie ma 0×0.
  const draws = () => page.evaluate(() => window.__rfDraw || 0);
  const d0 = await draws(); await page.waitForTimeout(700); const d1 = await draws();
  m.loopAlive = d1 > d0; m.drawsPerSec = Math.round((d1 - d0) / 0.7);
  m.errs = errs; m.bootFrame = bootFrame;
  await ctx.close();
  return m;
}

const browser = await chromium.launch();
const A = [], B = [];      // A = „przed” (route), B = „po” (prawdziwy plik)
let profOld = null, profNew = null;
try {
  for (let i = 0; i < RUNS; i++) {                 // na przemian, żeby drift maszyny trafiał w oba
    A.push(await oneRun(browser, { old: true }));
    B.push(await oneRun(browser, { old: false }));
  }
  profOld = await oneRun(browser, { old: true, profile: true });
  profNew = await oneRun(browser, { old: false, profile: true });
} catch (e) {
  console.log("FAIL instancja niedostępna — " + String(e).slice(0, 200));
  await browser.close();
  process.exit(2);
}
await browser.close();

const medA = median(A.map(r => r.delta)), medB = median(B.map(r => r.delta));
const syncA = median(A.map(r => r.syncAtDCL)), syncB = median(B.map(r => r.syncAtDCL));
console.log("rysowanie SYNCHRONICZNE do DOMContentLoaded: przed " + syncA + " → po " + syncB +
            "   (przed: " + A.map(r => r.syncAtDCL).join(",") + " · po: " + B.map(r => r.syncAtDCL).join(",") + ")");
console.log("[informacyjnie, szum > efekt] mediana domInteractive − max(responseEnd rf-*.js): po " +
            medB.toFixed(1) + " ms; wariant „przed” (przez przechwycone żądanie, czasy zniekształcone) " +
            medA.toFixed(1) + " ms");

console.log("profil CPU startu: węzeł frame() pod rf-40-boot.js — przed: " + profOld.bootFrame + ", po: " + profNew.bootFrame);

const errs = B.concat([profNew]).flatMap(r => r.errs);
check("0 pageerror / console.error na starcie", errs.length === 0, errs.slice(0, 3).join(" | "));
check("pętla klatek żyje po starcie", B.every(r => r.loopAlive && r.live > 0),
      JSON.stringify(B.map(r => [r.live, r.drawsPerSec])));
check("skrypty panelu wczytane (rf-*.js)", B.every(r => r.nJs > 100), B.map(r => r.nJs).join(","));
check("pierwsza klatka poza łańcuchem bootu (mniej rysowania synchronicznego niż przed zmianą)",
      syncB >= 0 && syncB < syncA, syncA + " → " + syncB);
// Kontrola sondy: gdyby przechwycenie przestało działać (np. po zmianie nazwy `frameDeferred`),
// obie liczby byłyby zerami i asercja wyżej przechodziłaby „na pusto”.
check("wariant „przed” faktycznie rysował klatkę w bootcie (kontrola sondy)", syncA >= 20, "przed = " + syncA);
check("profil startu: żaden węzeł frame() nie wisi pod rf-40-boot.js", profNew.bootFrame === false,
      "po: " + profNew.bootFrame + ", kontrola „przed”: " + profOld.bootFrame);

if (SAVE) {
  fs.writeFileSync(SAVE, JSON.stringify({ url: URL, before: A, after: B, medA, medB, syncA, syncB }, null, 2));
  console.log("zapisano " + SAVE);
}
console.log("\nRAZEM " + nPass + " PASS / " + nFail + " FAIL");
process.exit(nFail ? 1 : 0);
