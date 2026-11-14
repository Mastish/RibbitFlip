// Silnik wyzwalaczy Usług sieciowych, przepuszczony przez prawdziwe wartości.
// Uruchamiany przez tests/test_rest_triggers.py; wypisuje JSON z wynikami na stdout.
//
// DLACZEGO HARNESS, A NIE ASERCJE NA TEKŚCIE ŹRÓDŁA. Sprawdzanie, czy w pliku stoi napis „taps",
// nie mówi nic o tym, czy „Dokładnie N puknięć" naprawdę liczy puknięcia. Ta funkcjonalność ma
// całą wartość w zachowaniu na granicy: kiedy warunek puszcza, kiedy okno się zamyka, kiedy
// histereza zjada drganie. Więc ładujemy oba pliki jak przeglądarka (płaski skrypt w jednym
// środowisku leksykalnym) i podajemy im liczby.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// Minimalne otoczenie: tyle przeglądarki, ile te dwa pliki dotykają przy ładowaniu.
const sandbox = {
  addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }),
  window: {}, document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
                          createElement: () => ({ style: {}, classList: { add(){}, remove(){}, toggle(){} },
                                                  setAttribute(){}, appendChild(){}, addEventListener(){} }),
                          getElementById: () => null, contains: () => false },
  console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON,
  navigator: { clipboard: null },
  state: { activeDeviceId: "d0", devices: {}, pose: null, last: null, nowTs: 0 },
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);

/* `FILTER_METRICS` PRAWDZIWE, WYCIĘTE Z rf-10 — nie atrapa.
   Od 12.09 `RA4_SRC` nie jest już trzecią ręczną kopią słownika: polskie nazwy, jednostki
   i zakresy suwaków wyprowadza z `FILTER_METRICS` (rf-10). Ta piaskownica nie ładuje rf-10
   w całości (tamten plik ciągnie za sobą pół panelu), więc podajemy jej dokładnie tę jedną
   tablicę — wyciętą ze ŹRÓDŁA, a nie przepisaną. Dzięki temu asercja „lista UI == lista
   sanityzatora" nadal sprawdza to, co robi aplikacja, a nie to, co wpisał autor testu. */
{
  const rf10 = read("web/js/rf-10-triggers-model.js");
  const od = rf10.indexOf("const FILTER_METRICS=[");
  if (od < 0) { console.error("rest_triggers_harness: nie znaleziono FILTER_METRICS w rf-10"); process.exit(1); }
  const koniec = rf10.indexOf("];", od);
  vm.runInContext(rf10.slice(od, koniec + 2), ctx, { filename: "rf-10:FILTER_METRICS" });
}

// rf-35 pierwszy: rf-37 woła z niego `_raSanMotion` i `_raMode` (jedyny spis pól warunku).
vm.runInContext(read("web/js/rf-35-rest-e2.js"), ctx, { filename: "rf-35" });
vm.runInContext(read("web/js/rf-37-rest-e4.js"), ctx, { filename: "rf-37" });

const R = (code) => vm.runInContext(code, ctx);

// ── narzędzia scenariusza ──────────────────────────────────────────────────────────────────
// Podajemy silnikowi ciąg (czas, wartość) i zbieramy chwile, w których kazał wysłać.
function run(src, trig, samples) {
  ctx.__src = R("(function(){return _raSanMotion(" + JSON.stringify(src) + ");})()");
  ctx.__src.kind = "motion"; ctx.__src.dev = "any";
  ctx.__trig = Object.assign({ minIntervalMs: 0 }, trig || {});
  ctx.__st = R("_ra4NewSt(0)");
  ctx.__fired = [];
  ctx.__samples = samples;
  R(`(function(){
      for (const [t, v] of __samples) { if (_ra4Step(__st, v, __src, __trig, t)) __fired.push(t); }
    })()`);
  return ctx.__fired.slice();
}
const met = (src, v) => R("_ra4Met(" + JSON.stringify(v) + "," +
  "(function(){var s=_raSanMotion(" + JSON.stringify(src) + ");return s;})(),0)");

// Ciąg próbek co `dt` sekund z funkcji wartości — tak jak sypie je strumień „pv" (~12 Hz).
function ramp(from, to, steps, dt = 0.08, t0 = 0) {
  const out = [];
  for (let i = 0; i <= steps; i++)
    out.push([t0 + i * dt, from + (to - from) * (i / steps)]);
  return out;
}
function hold(v, steps, dt = 0.08, t0 = 0) {
  const out = [];
  for (let i = 0; i <= steps; i++) out.push([t0 + i * dt, v]);
  return out;
}
// Puknięcie: wyskok ponad próg i powrót głęboko pod niego (poniżej histerezy).
function tap(t0, high = 50, low = 0, dt = 0.08) {
  return [[t0, low], [t0 + dt, high], [t0 + 2 * dt, high], [t0 + 3 * dt, low], [t0 + 4 * dt, low]];
}

const wyniki = {};

// ── 1. operatory ───────────────────────────────────────────────────────────────────────────
wyniki.operatory = {
  gt:  [met({ cmp: ">",  threshold: 30 }, 31), met({ cmp: ">",  threshold: 30 }, 30)],
  lt:  [met({ cmp: "<",  threshold: 30 }, 29), met({ cmp: "<",  threshold: 30 }, 30)],
  ge:  [met({ cmp: ">=", threshold: 30 }, 30), met({ cmp: ">=", threshold: 30 }, 29)],
  le:  [met({ cmp: "<=", threshold: 30 }, 30), met({ cmp: "<=", threshold: 30 }, 31)],
  in:  [met({ cmp: "in", threshold: 20, thresholdHi: 40 }, 30),
        met({ cmp: "in", threshold: 20, thresholdHi: 40 }, 45)],
  out: [met({ cmp: "out", threshold: 20, thresholdHi: 40 }, 45),
        met({ cmp: "out", threshold: 20, thresholdHi: 40 }, 30)],
  // zakres podany „na odwrót" (od 40 do 20) musi znaczyć to samo, co 20..40
  inOdwrocony: met({ cmp: "in", threshold: 40, thresholdHi: 20 }, 30),
};
wyniki.abs = [met({ cmp: ">", threshold: 30, abs: true }, -45),
              met({ cmp: ">", threshold: 30, abs: false }, -45)];
wyniki.neg = [met({ cmp: ">", threshold: 30, neg: true }, 10),
              met({ cmp: ">", threshold: 30, neg: true }, 45)];

// ── 2. zachowania ──────────────────────────────────────────────────────────────────────────
// Jednorazowo: raz na epizod, choćby warunek trwał długo.
wyniki.once = run({ cmp: ">", threshold: 30, mode: "once" }, {}, hold(50, 40)).length;
// Ciągłe: powtarza, ale nie częściej niż min. odstęp (250 ms przy próbkach co 80 ms).
wyniki.continuous = run({ cmp: ">", threshold: 30, mode: "continuous" },
                        { minIntervalMs: 250 }, hold(50, 40)).length;
// Po odczekaniu: nie wcześniej niż po `dwellMs` nieprzerwanego spełnienia.
{
  const f = run({ cmp: ">", threshold: 30, mode: "dwell", dwellMs: 1000 }, {}, hold(50, 40));
  wyniki.dwell = { ile: f.length, pierwszy: f[0] };
}
// „Po odczekaniu", gdy warunek pęknie w połowie — nie wolno odpalić.
{
  const s = hold(50, 6).concat(hold(0, 6, 0.08, 0.56)).concat(hold(50, 6, 0.08, 1.12));
  wyniki.dwellPrzerwany = run({ cmp: ">", threshold: 30, mode: "dwell", dwellMs: 1000 }, {}, s).length;
}
// X razy w czasie: trzy puknięcia w oknie 2 s → jedno wysłanie.
{
  const s = tap(0).concat(tap(0.5)).concat(tap(1.0)).concat(hold(0, 10, 0.08, 1.5));
  wyniki.multi3 = run({ cmp: ">", threshold: 30, mode: "multi", crossings: 3, windowMs: 2000 }, {}, s).length;
}
// ...ale dwa puknięcia w tym samym oknie to za mało.
{
  const s = tap(0).concat(tap(0.5)).concat(hold(0, 20, 0.08, 1.0));
  wyniki.multi2z3 = run({ cmp: ">", threshold: 30, mode: "multi", crossings: 3, windowMs: 2000 }, {}, s).length;
}
// Dokładnie N puknięć: dwa puknięcia w oknie 600 ms → jedno wysłanie, po zamknięciu okna.
{
  const s = tap(0).concat(tap(0.3)).concat(hold(0, 20, 0.08, 0.7));
  const f = run({ cmp: ">", threshold: 30, mode: "taps", crossings: 2, windowMs: 600 }, {}, s);
  wyniki.taps2 = { ile: f.length, poOknie: f.length ? f[0] >= 0.6 : null };
}
// ...a trzy puknięcia w tym samym oknie NIE są dwoma — to jest cały sens tego zachowania.
{
  const s = tap(0).concat(tap(0.2)).concat(tap(0.4)).concat(hold(0, 20, 0.08, 0.7));
  wyniki.taps3gdy2 = run({ cmp: ">", threshold: 30, mode: "taps", crossings: 2, windowMs: 600 }, {}, s).length;
}

// ── 3. histereza ───────────────────────────────────────────────────────────────────────────
// Drganie tuż przy progu nie może produkować wysyłki za wysyłką.
{
  const s = [];
  for (let i = 0; i < 40; i++) s.push([i * 0.08, i % 2 ? 30.4 : 29.6]);
  wyniki.drganie = run({ cmp: ">", threshold: 30, mode: "once" }, {}, s).length;
}
// Ale prawdziwy powrót i ponowne przekroczenie to DWA epizody.
{
  const s = hold(50, 5).concat(hold(0, 5, 0.08, 0.48)).concat(hold(50, 5, 0.08, 0.96));
  wyniki.dwaEpizody = run({ cmp: ">", threshold: 30, mode: "once" }, {}, s).length;
}
// Histereza przy NIE musi trzymać stan tak samo — znak luzu jest odwracany.
{
  const s = [];
  for (let i = 0; i < 40; i++) s.push([i * 0.08, i % 2 ? 30.4 : 29.6]);
  wyniki.drganieNeg = run({ cmp: ">", threshold: 30, neg: true, mode: "once" }, {}, s).length;
}

// ── 4. migracja starych nazw ───────────────────────────────────────────────────────────────
wyniki.migracja = {
  cross: R('_raSanMotion({mode:"cross"}).mode'),
  while: R('_raSanMotion({mode:"while"}).mode'),
  nieznane: R('_raSanMotion({mode:"bzdura"}).mode'),
};

// ── 5. spis pól — jedno źródło prawdy ──────────────────────────────────────────────────────
wyniki.pola = R("Object.keys(_raSanMotion({})).sort()");
wyniki.zrodla = R("RA_SOURCES.slice()");
wyniki.zrodlaUI = R("RA4_SRC.map(function(r){return r[0];})");
wyniki.zakresKasowany = R('_raSanMotion({cmp:">",thresholdHi:99}).thresholdHi');
wyniki.zakresTrzymany = R('_raSanMotion({cmp:"in",threshold:10,thresholdHi:99}).thresholdHi');
wyniki.progBezZakresu = R('_raSanMotion({cmp:"out",threshold:10}).thresholdHi');

console.log(JSON.stringify(wyniki));
