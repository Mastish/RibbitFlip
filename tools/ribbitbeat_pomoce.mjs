// RIBBITBEAT (web/gry/): kalibracja mnożników punktów za pomoce (ZC_MN_POMOCY w zabi-chor.js).
//
// Puszcza boty czterech poziomów przez PRAWDZIWĄ punktację gry (funkcje wycięte z zabi-chor.js po nazwie, boty z wejscie.js
// w całości, jak tools/ribbitbeat_kalibracja.mjs) na partiach wbudowanych piosenek przygotowanych jak w grze z domyślnymi
// ustawieniami (tryb płynny, czas na ruch 100 %). Dla każdej pomocy liczy zysk punktów względem ustawień domyślnych
// (przyciąganie „Delikatne”, śpiew przyciskiem) i proponuje mnożnik = 1 / średnia geometryczna zysku botów Łatwy i Średni
// (słabsi gracze, którzy po pomoce sięgają), zaokrąglony do 0,01. Na końcu porównuje propozycję z ZC_MN_POMOCY w kodzie.
//
//   node tools/ribbitbeat_pomoce.mjs            tabela, propozycje i porównanie (ok. 7 min)
//   node tools/ribbitbeat_pomoce.mjs --szybko   jedno ziarno zamiast trzech (ok. 2 min)
//   node tools/ribbitbeat_pomoce.mjs --json     jedna linia JSON
//
// Klawiatura „do nuty” to przybliżenie: bot bez rozstroju, drżenia i fałszu, z szybką ręką (skok w ok. 0,1 s), ale z własnym
// refleksem i przyciskiem. Podpowiedzi melodii bot nie słyszy, więc jej mnożnik (0,95) zostaje oceną, nie pomiarem.
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
for (const s of ["T", "ZC_PUNKTY", "ZC_POMOC", "ZC_TRUDNOSC", "ZC_RUCH", "ZC_PRZEJSCIA", "ZC_MN_POMOCY"]) run(stala("zabi-chor.js", s));
for (const f of ["tt", "stopnieNaPolton", "poltonNaStopnie", "wygladzEMA", "przyciagnijDoNuty", "celnoscKlatki", "wynikNuty", "ocenaNuty",
  "nastepneKombo", "mnoznikKombo", "punktyZaNute", "rozliczNute", "maksimumPunktow", "premiaKoncowa", "procentSpiewu", "indeksNutyPod",
  "indeksNastepnej", "celNuty", "celBotaNaNutach", "klatkaNaNutach", "dodajPrzejscia", "zakresNut", "procentRuchu", "dodajCzasNaRuch",
  "przygotujPartie"]) run(funkcja("zabi-chor.js", f));
const F = n => run(n);

function nowyBot(poziom, ziarno) {
  const w = { console, Math, Number, JSON, Array, Object, Map, Set, String, Error, performance: { now: () => 0 }, innerHeight: 800,
    addEventListener() {}, document: { activeElement: null }, localStorage: { getItem: () => null, setItem() {} }, EventSource: function () {} };
  w.window = w; vm.createContext(w);
  vm.runInContext(czytaj("wejscie.js") + ";this.Wejscie=Wejscie;", w);
  const We = w.Wejscie;
  We.init({ zakres: 40, ziarno });
  return { We, bot: We.dodajBota(poziom) };
}
// To samo co krokGracza w grze, bez rysowania. o: {przyciaganie: 0–4, sama, klawiatura}
function symuluj(nuty, bpm, poziom, ziarno, o) {
  const zakres = 40, zn = F("zakresNut")(nuty), lo = zn.lo, hi = zn.hi;
  const { We, bot } = nowyBot(poziom, ziarno), sPerBeat = 60 / bpm, dt = 1 / 60;
  // bot udaje tu CZŁOWIEKA z pomocami, więc bez zatrzasku swojego poziomu (10-20): inaczej mierzyłby zysk
  // z przyciągania na ręce, która już sama siada na nutach, i każda pomoc wyszłaby słabsza, niż jest
  bot._bot.zatrzask = null;
  if (o.klawiatura) Object.assign(bot._bot, { rozstrojenie: 0, drzenie: 0, falszywy: 0, tau: .035 });
  let beat = -2;
  We.ustawCelBotow(w => F("celBotaNaNutach")(nuty, beat - w._bot.opoznienie / sPerBeat, sPerBeat, s => F("poltonNaStopnie")(s, zakres, lo, hi)));
  const ost = nuty[nuty.length - 1], koniec = ost.t + ost.d + 1, pp = ctx.ZC_POMOC.POZIOMY[o.przyciaganie | 0];
  let deg = 0, pb = beat, ptr = 0, kombo = 0, punkty = 0;
  const ak = { sumaAcc: 0, spiewal: false, wib: 0 }, oceny = { czysto: 0, dobrze: 0, prawie: 0, falsz: 0, pudlo: 0 };
  for (let k = 0; beat < koniec && k < 2e6; k++) {
    beat += dt / sPerBeat;
    We.krok(dt, k * 1000 * dt);
    deg = F("wygladzEMA")(deg, bot.pitch, dt, .06);
    const idx = F("indeksNutyPod")(nuty, beat);
    let semi = F("stopnieNaPolton")(deg, zakres, lo, hi);
    if (pp && idx >= 0) semi = F("przyciagnijDoNuty")(semi, F("celNuty")(nuty[idx], beat), pp.zasieg, pp.sila, pp.pas);
    const spiewa = o.sama ? idx >= 0 : !!bot.przycisk;
    const r = F("klatkaNaNutach")(nuty, ptr, ak, pb, beat, spiewa, semi, Math.abs(bot.twist) >= 150);
    ptr = r.i; pb = beat;
    for (const z of r.zamkniete) {
      const rr = F("rozliczNute")(kombo, z.wynik, z.spiewal, nuty[z.idx].d, z.wibrato, 1);
      kombo = rr.kombo; punkty += rr.punkty; oceny[rr.ocena]++;
    }
  }
  const maks = F("maksimumPunktow")(nuty, 1), razem = punkty + F("premiaKoncowa")(oceny, maks);
  return { punkty: razem, procent: F("procentSpiewu")(razem, 0, 0, maks.razem) };
}

const UST = { tryb: "plynny", czasNaRuch: 100 }, korpus = [];
for (const p of F("wbudowanePiosenki")()) p.partie.forEach((x, i) => {
  korpus.push({ nazwa: p.tytul + " · " + (i ? "akomp." : "melodia"), bpm: p.tempo, nuty: F("przygotujPartie")(x, UST, p.tempo).nuty });
});
const POZIOMY = ["latwy", "sredni", "trudny", "mistrz"], ZIARNA = ARG.has("--szybko") ? [5] : [5, 17, 29];
const KONF = {
  "przyciąganie 0 (wył.)": { przyciaganie: 0 }, "przyciąganie 1 (domyślne)": { przyciaganie: 1 },
  "przyciąganie 2": { przyciaganie: 2 }, "przyciąganie 3": { przyciaganie: 3 }, "przyciąganie 4 (z daleka)": { przyciaganie: 4 },
  "śpiewa sama": { przyciaganie: 1, sama: true }, "klawiatura do nuty": { przyciaganie: 1, klawiatura: true },
  "3 + sama (zestaw)": { przyciaganie: 3, sama: true }, "4 + sama (zestaw)": { przyciaganie: 4, sama: true },
};
const BAZA = "przyciąganie 1 (domyślne)", t0 = Date.now(), suma = {};
for (const [nazwa, o] of Object.entries(KONF)) {
  suma[nazwa] = {};
  for (const p of POZIOMY) {
    let pkt = 0, proc = 0, n = 0;
    for (const e of korpus) for (const z of ZIARNA) { const r = symuluj(e.nuty, e.bpm, p, z, o); pkt += r.punkty; proc += r.procent; n++; }
    suma[nazwa][p] = { punkty: pkt, procent: proc / n };
  }
}
const zysk = (nazwa, p) => suma[nazwa][p].punkty / suma[BAZA][p].punkty;
const propozycja = nazwa => Math.round(100 / Math.sqrt(zysk(nazwa, "latwy") * zysk(nazwa, "sredni"))) / 100;
const M = ctx.ZC_MN_POMOCY;
const porownanie = [
  ["przyciaganie 0", propozycja("przyciąganie 0 (wył.)"), M.przyciaganie[0]], ["przyciaganie 2", propozycja("przyciąganie 2"), M.przyciaganie[2]],
  ["przyciaganie 3", propozycja("przyciąganie 3"), M.przyciaganie[3]], ["przyciaganie 4", propozycja("przyciąganie 4 (z daleka)"), M.przyciaganie[4]],
  ["spiewaSama", propozycja("śpiewa sama"), M.spiewaSama], ["klawDoNuty", propozycja("klawiatura do nuty"), M.klawDoNuty]];
if (ARG.has("--json")) {
  console.log(JSON.stringify({ partii: korpus.length, ziarna: ZIARNA, baza: BAZA,
    zysk: Object.fromEntries(Object.keys(KONF).map(k => [k, Object.fromEntries(POZIOMY.map(p => [p, +zysk(k, p).toFixed(3)]))])),
    porownanie: porownanie.map(([k, prop, kod]) => ({ k, propozycja: prop, kod })) }));
} else {
  const kol = (s, n) => String(s).slice(0, n).padEnd(n);
  console.log("partii " + korpus.length + " × ziarna " + ZIARNA.length + " · baza: " + BAZA + " · " + ((Date.now() - t0) / 1000).toFixed(0) + " s");
  console.log(kol("konfiguracja", 28) + POZIOMY.map(p => kol(p + ": zysk  %", 20)).join(""));
  for (const nazwa of Object.keys(KONF))
    console.log(kol(nazwa, 28) + POZIOMY.map(p => kol("×" + zysk(nazwa, p).toFixed(3) + "  " + suma[nazwa][p].procent.toFixed(0) + "%", 20)).join(""));
  console.log("\nmnożnik: propozycja (1 / śr. geom. zysku Łatwy i Średni) · w kodzie (ZC_MN_POMOCY)");
  for (const [k, prop, kod] of porownanie) console.log("  " + kol(k, 16) + prop.toFixed(2) + "  ·  " + (+kod).toFixed(2) + (Math.abs(prop - kod) > .02 ? "   ← różnica" : ""));
}
