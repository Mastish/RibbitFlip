// RIBBITBEAT (web/gry/): kalibracja klasyfikatora trudności partii i poziomów botów.
//
// Puszcza boty czterech poziomów przez PRAWDZIWĄ punktację gry (funkcje wycięte z zabi-chor.js po nazwie,
// boty z wejscie.js w całości) na korpusie partii: 8 wbudowanych piosenek w trzech tempach i wzorce
// syntetyczne (gamy, arpeggia, skoki, zygzaki, synkopy, triole, szeroki zakres, powtarzane nuty) w czterech
// tempach. Dla każdej partii wypisuje ocenę trudności, czynniki i precyzję botów (odsetek nut na „Dobrze”
// i lepiej), a na końcu korelację oceny z precyzją bota Średniego i tabelę „wzorzec → ocena”.
//
//   node tools/ribbitbeat_kalibracja.mjs            tabela i podsumowanie
//   node tools/ribbitbeat_kalibracja.mjs --json     jedna linia JSON (dla testu)
//   node tools/ribbitbeat_kalibracja.mjs --szybko   jedno ziarno zamiast trzech
//   node tools/ribbitbeat_kalibracja.mjs --czas-na-ruch   partie przez dodajCzasNaRuch (jak w grze z włączonym
//                                                  „Czasem na ruch”); bez flagi stare zachowanie (test kalibracji)
//
// Bot nie czyta nut (zna przyszłość), więc kalibruje tylko trudność FIZYCZNĄ: ruch, gęstość, precyzję zakresu.
// Rytm, zygzaki i długość mają wagi ustawione z ręki (rozpoznanie i pamięć, których bot nie ma).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GRY = path.join(REPO, "web", "gry", "js");
const ARG = new Set(process.argv.slice(2));
const zrodlo = {};
const czytaj = f => (zrodlo[f] = zrodlo[f] || fs.readFileSync(path.join(GRY, f), "utf8"));
function domknij(src, od, naSredniku) {
  let d = 0, q = null;
  for (let k = od; k < src.length; k++) {
    const c = src[k];
    if (q) { if (c === "\\") { k++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === "`") { q = c; continue; }
    if (c === "/" && src[k + 1] === "/") { k = src.indexOf("\n", k); continue; }
    if (c === "/" && src[k + 1] === "*") { k = src.indexOf("*/", k) + 1; continue; }
    if (c === "(" || c === "[" || c === "{") d++;
    else if (c === ")" || c === "]" || c === "}") { d--; if (d === 0 && !naSredniku) return k + 1; }
    else if (c === ";" && d === 0 && naSredniku) return k + 1;
  }
  throw new Error("niedomknięte wyrażenie od " + od);
}
const funkcja = (plik, n) => { const s = czytaj(plik), i = s.indexOf("function " + n + "("); if (i < 0) throw new Error(n); return s.slice(i, domknij(s, s.indexOf("{", s.indexOf(")", i)), false)); };
const stala = (plik, n) => { const s = czytaj(plik), i = s.indexOf("const " + n + "="); if (i < 0) throw new Error(n); return s.slice(i, domknij(s, i, true)).replace(/^const /, "var "); };

const ctx = { console, Math, Number, JSON, Array, Object, Map, Set, String, Error, Infinity };
vm.createContext(ctx);
const run = k => vm.runInContext(k, ctx);
for (const s of ["NN", "nameOf", "isBlack", "BUILTIN", "noteName", "ZC_TEMPO_GRY", "ZC_POWTORZ", "ZC_PODKLAD", "ZC_GM_PERKUSJA"]) run(stala("piosenki.js", s));
for (const f of ["midiOf", "parseBars", "sumyTaktow", "opiszPartie", "domknijPiosenke", "zrodloZNotacji", "parametryDomyslne",
  "domyslnyPodklad", "poprawParametry", "tloPiosenki", "fragmentNut", "perkusjaPiosenki", "fragmentPerkusji", "piosenkaZeZrodla", "piosenkaZNotacji", "wbudowanePiosenki"]) run(funkcja("piosenki.js", f));
for (const s of ["T", "ZC_PUNKTY", "ZC_POMOC", "ZC_TRUDNOSC", "ZC_RUCH"]) run(stala("zabi-chor.js", s));
for (const f of ["tt", "stopnieNaPolton", "poltonNaStopnie", "wygladzEMA", "przyciagnijDoNuty", "celnoscKlatki", "wynikNuty",
  "ocenaNuty", "indeksNutyPod", "indeksNastepnej", "celNuty", "celBotaNaNutach", "klatkaNaNutach", "skalaProgow", "cechyPartii", "trudnoscPartii", "poziomTrudnosci", "dodajCzasNaRuch"])
  run(funkcja("zabi-chor.js", f));
const F = n => run(n);

// ---- symulacja jednego bota na jednej partii (to samo co krokGracza w grze, bez rysowania) ----
function nowyBot(poziom, ziarno) {
  const w = { console, Math, Number, JSON, Array, Object, Map, Set, String, Error, performance: { now: () => 0 }, innerHeight: 800,
    addEventListener() {}, document: { activeElement: null }, localStorage: { getItem: () => null, setItem() {} }, EventSource: function () {} };
  w.window = w; vm.createContext(w);
  vm.runInContext(czytaj("wejscie.js") + ";this.Wejscie=Wejscie;", w);
  const We = w.Wejscie;
  We.init({ zakres: 40, ziarno });
  return { We, bot: We.dodajBota(poziom) };
}
export function symuluj(nuty, bpm, poziom, ziarno, opcje) {
  const o = Object.assign({ zakres: 40, zatrzask: true }, opcje || {});
  const lo = Math.min(...nuty.map(n => n.m)), hi = Math.max(...nuty.map(n => n.m));
  const { We, bot } = nowyBot(poziom, ziarno), sPerBeat = 60 / bpm, dt = 1 / 60;
  let beat = -2;
  We.ustawCelBotow(w => F("celBotaNaNutach")(nuty, beat - w._bot.opoznienie / sPerBeat, sPerBeat,
    s => F("poltonNaStopnie")(s, o.zakres, lo, hi)));
  const koniec = nuty[nuty.length - 1].t + nuty[nuty.length - 1].d + 1;
  // zatrzask poziomu bota: to samo, co gra wkłada w g.przyciaganie robo-żaby (zabi-chor.js, startGry)
  const zat = o.zatrzask ? bot._bot.zatrzask : null;
  let deg = 0, pb = beat, ptr = 0, klatek = 0, naNucie = 0;
  const ak = { sumaAcc: 0, spiewal: false, wib: 0 }, wyniki = [];
  for (let k = 0; beat < koniec && k < 2e6; k++) {
    beat += dt / sPerBeat;
    We.krok(dt, k * 1000 * dt);
    deg = F("wygladzEMA")(deg, bot.pitch, dt, .06);
    const idx = F("indeksNutyPod")(nuty, beat);
    let semi = F("stopnieNaPolton")(deg, o.zakres, lo, hi);
    if (zat && idx >= 0) semi = F("przyciagnijDoNuty")(semi, F("celNuty")(nuty[idx], beat), zat.zasieg, zat.sila, zat.pas);
    // widać to samo, co liczy punkty: klatka „na nucie” (|Δ| ≤ 0,5) maluje taśmę na limonkowo
    if (idx >= 0) { klatek++; if (Math.abs(semi - F("celNuty")(nuty[idx], beat)) <= .5) naNucie++; }
    const r = F("klatkaNaNutach")(nuty, ptr, ak, pb, beat, bot.przycisk, semi, Math.abs(bot.twist) >= 150);
    ptr = r.i; pb = beat;
    for (const z of r.zamkniete) wyniki[z.idx] = { wynik: z.spiewal ? z.wynik : 0, ocena: F("ocenaNuty")(z.wynik, z.spiewal) };
  }
  if (o.log) o.log.push(...wyniki.map((w, i) => i + ":" + nuty[i].m + "→" + (w ? w.ocena + " " + Math.round(w.wynik) : "?")));
  let traf = 0, suma = 0;
  for (let i = 0; i < nuty.length; i++) { const w = wyniki[i]; if (!w) continue; suma += w.wynik; if (w.ocena === "czysto" || w.ocena === "dobrze") traf++; }
  return { precyzja: 100 * traf / nuty.length, celnosc: suma / nuty.length, naNucie: 100 * naNucie / Math.max(1, klatek) };
}

// ---- korpus ----
function wzorzec(nazwa, kroki) {   // kroki: [[półton względem C4, długość w ćwierćnutach]], R = pauza
  const nuty = []; let t = 0;
  for (const [m, d] of kroki) { if (m !== null) nuty.push({ m: 60 + m, t, d }); t += d; }
  return { nazwa, nuty };
}
const powtorz = (a, n) => Array.from({ length: n }, () => a).flat();
const gama = [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2];
let ziarnoLos = 11; const los = () => ((ziarnoLos = (ziarnoLos * 16807) % 2147483647) - 1) / 2147483646;
const losoweSkoki = (ile, zakres, d) => Array.from({ length: ile }, () => [Math.round(los() * zakres), d]);
const WZORCE = [
  wzorzec("półnuty krokami (wąsko)", powtorz([[0, 2], [2, 2], [4, 2], [2, 2]], 8)),
  wzorzec("ćwierćnuty, gama", powtorz(gama.map(m => [m, 1]), 4)),
  wzorzec("ósemki, gama", powtorz(gama.map(m => [m, .5]), 6)),
  wzorzec("szesnastki, gama", powtorz(gama.map(m => [m, .25]), 10)),
  wzorzec("ósemki, ta sama nuta", powtorz([[7, .5]], 64)),
  wzorzec("ósemki, arpeggio", powtorz([[0, .5], [4, .5], [7, .5], [12, .5], [7, .5], [4, .5]], 10)),
  wzorzec("ćwierćnuty, skoki o oktawę", powtorz([[0, 1], [12, 1]], 24)),
  wzorzec("ósemki, skoki o oktawę", powtorz([[0, .5], [12, .5]], 40)),
  wzorzec("ósemki, zygzak o kwintę", powtorz([[0, .5], [7, .5], [2, .5], [9, .5], [4, .5], [11, .5]], 10)),
  wzorzec("ćwierćnuty z pauzami, skoki", powtorz([[0, 1], [null, 1], [10, 1], [null, 1]], 16)),
  wzorzec("synkopy", powtorz([[0, .5], [4, 1], [5, .5], [7, 1], [4, 1]], 12)),
  wzorzec("triole ósemkowe", powtorz([[0, 1 / 3], [2, 1 / 3], [4, 1 / 3], [5, 1 / 3], [4, 1 / 3], [2, 1 / 3]], 16)),
  wzorzec("półnuty, szeroki zakres (2,5 oktawy)", losoweSkoki(32, 30, 2)),
  wzorzec("ósemki losowe, 2 oktawy", losoweSkoki(96, 24, .5)),
  wzorzec("szesnastki losowe, oktawa", losoweSkoki(128, 12, .25)),
  wzorzec("całe nuty, długie", powtorz([[0, 4], [5, 4], [7, 4], [4, 4]], 4)),
];
const TEMPA_W = [60, 90, 120, 150], TEMPA_P = [.7, 1, 1.3];
const korpus = [];
for (const w of WZORCE) for (const bpm of TEMPA_W) korpus.push({ nazwa: w.nazwa + " @" + bpm, wzor: w.nazwa, bpm, nuty: w.nuty });
for (const p of F("wbudowanePiosenki")()) for (const k of TEMPA_P) p.partie.forEach((x, i) =>
  korpus.push({ nazwa: p.tytul + " · " + (i ? "akomp." : "melodia") + " @" + Math.round(p.tempo * k), bpm: p.tempo * k, nuty: x.nuty, piosenka: true }));

// ---- jedna partia nuta po nucie: --dbg "<wzorzec>" <bpm> <poziom> ----
if (ARG.has("--dbg")) {
  const a = process.argv.slice(process.argv.indexOf("--dbg") + 1), w = WZORCE.find(x => x.nazwa === a[0]), log = [];
  const r = symuluj(w.nuty, +a[1], a[2], 5, { log });
  console.log(JSON.stringify(r), "\n" + log.slice(0, 24).join("  "));
  process.exit(0);
}
// ---- przebieg ----
const POZIOMY = ["latwy", "sredni", "trudny", "mistrz"], ZIARNA = ARG.has("--szybko") ? [5] : [5, 17, 29];
const wiersze = korpus.map(e => {
  if (ARG.has("--czas-na-ruch") && !e.ruch) { e.nuty = F("dodajCzasNaRuch")(e.nuty, 60 / e.bpm); e.ruch = true; }
  const tr = F("trudnoscPartii")(e.nuty, e.bpm, 40), bot = {}, slad = {};
  for (const p of POZIOMY) {
    let s = 0, v = 0;
    for (const z of ZIARNA) { const r = symuluj(e.nuty, e.bpm, p, z); s += r.precyzja; v += r.naNucie; }
    bot[p] = s / ZIARNA.length;
    slad[p] = v / ZIARNA.length;
  }
  return { nazwa: e.nazwa, ocena: tr.ocena, poziom: tr.poziom, czynniki: tr.czynniki, cechy: tr.cechy, bot, slad, piosenka: !!e.piosenka };
});
const pearson = (x, y) => {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sx * sy || 1);
};
const rangi = a => { const s = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = []; s.forEach(([, i], k) => { r[i] = k; }); return r; };
const oceny = wiersze.map(w => w.ocena), sredni = wiersze.map(w => 100 - w.bot.sredni), sumaBotow = wiersze.map(w => 300 - w.bot.latwy - w.bot.sredni - w.bot.trudny);
const podsumowanie = {
  partii: wiersze.length,
  pearsonSredni: +pearson(oceny, sredni).toFixed(3),
  spearmanSredni: +pearson(rangi(oceny), rangi(sredni)).toFixed(3),
  spearmanTrzyBoty: +pearson(rangi(oceny), rangi(sumaBotow)).toFixed(3),
  czynnikiSpearman: Object.fromEntries(Object.keys(wiersze[0].czynniki).map(k => [k, +pearson(rangi(wiersze.map(w => w.czynniki[k])), rangi(sumaBotow)).toFixed(3)])),
  botyNaPoziomach: Object.fromEntries(F("ZC_TRUDNOSC").POZIOMY.map(p => {
    const tu = wiersze.filter(w => w.poziom === p.k);
    return [p.k, { partii: tu.length, ...Object.fromEntries(POZIOMY.map(b => [b, tu.length ? Math.round(tu.reduce((s, w) => s + w.bot[b], 0) / tu.length) : null])) }];
  })),
  // ile czasu nuty żaba naprawdę stoi na niej (limonkowa taśma): tyle widać z wyniku na torze
  sladNaPoziomach: Object.fromEntries(F("ZC_TRUDNOSC").POZIOMY.map(p => {
    const tu = wiersze.filter(w => w.poziom === p.k);
    return [p.k, Object.fromEntries(POZIOMY.map(b => [b, tu.length ? Math.round(tu.reduce((s, w) => s + w.slad[b], 0) / tu.length) : null]))];
  })),
};
if (ARG.has("--json")) { console.log(JSON.stringify({ podsumowanie, wiersze })); }
else {
  const kol = (s, n) => String(s).slice(0, n).padEnd(n);
  console.log(kol("partia", 46) + kol("ocena", 6) + kol("poziom", 13) + "ruch gęst prec rytm zygz dług │ strata  zm/s │ Łat Śre Tru Mis │ ślad Łat Śre Tru Mis");
  for (const w of wiersze.sort((a, b) => a.ocena - b.ocena)) {
    const c = w.czynniki;
    console.log(kol(w.nazwa, 46) + kol(w.ocena.toFixed(1), 6) + kol(w.poziom, 13) +
      [c.ruch, c.gestosc, c.precyzja, c.rytm, c.zygzaki, c.dlugosc].map(v => v.toFixed(1).padStart(4)).join(" ") + " │ " +
      w.cechy.ruch.toFixed(3).padStart(6) + " " + (.7 * w.cechy.npsSzczyt + .3 * w.cechy.nps).toFixed(1).padStart(5) + " │ " +
      POZIOMY.map(p => String(Math.round(w.bot[p])).padStart(3)).join(" ") + " │      " +
      POZIOMY.map(p => String(Math.round(w.slad[p])).padStart(3)).join(" "));
  }
  console.log("\n" + JSON.stringify(podsumowanie, null, 1));
}
