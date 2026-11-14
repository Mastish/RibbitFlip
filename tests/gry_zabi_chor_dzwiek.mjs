// ŻABI CHÓR (web/gry/) — dźwięk zmierzony liczbami, zanim usłyszy go człowiek.
//
// Uruchomienie (git-bash, z katalogu repo):
//   node tests/gry_zabi_chor_dzwiek.mjs [--wav KATALOG]
// Wołane też z tests/test_gry_zabi_chor.py (bez --wav). Wymaga globalnego @playwright/test, jak
// tests/scan_card_harness.mjs; bez niego kończy się linią {"pominiete": "..."} i test py to pomija.
//
// Co robi: sam stawia serwer plików web/ na wolnym porcie, otwiera /gry/ w Chromium bez okna i W STRONIE
// buduje graf z glos.js na OfflineAudioContext (Glos.kontekst(gotowy)), czyli dokładnie ten sam, którym
// gra gra na żywo. Renderuje 10 s „Ody do radości” w trzech składach:
//   A: 1 żaba (trąbka) + podkład (pianino, lewa ręka),
//   B: 8 żab (chór), każda trochę obok w czasie i wysokości, + podkład,
//   C: 1 żaba (ribbit) + podkład + efekty: rechot, rribbit, „kum”,
//   D: najgorszy przypadek spoza recenzji, 8 trąbek idealnie w czasie + fanfara i akord (tylko szczyt).
// Każdy skład renderuje się 4 razy: całe wyjście (po głośności i kompresorze) i każda szyna osobno
// (solo, prosto z szyny). Kryteria (recenzja 1, M4):
//   szczyt wyjścia < −1 dBFS, RMS żab 4–10 dB nad RMS podkładu, szczyt efektów ≥ RMS żab (rechot słychać).
// --wav KATALOG zapisuje miks każdego składu jako odsluch-<skład>.wav (16 bit, mono, 44,1 kHz).
// Ostatnia linia wyjścia: JSON {checks:[[nazwa, ok, szczegół], …], pomiary:{…}}.
import { createRequire } from "module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WEB = path.join(REPO, "web");
const wymagaj = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = wymagaj(path.join(process.env.APPDATA || "", "npm", "node_modules", "@playwright", "test")));
} catch (e) {
  console.log(JSON.stringify({ pominiete: "brak globalnego @playwright/test (" + (e.code || e.message) + ")" }));
  process.exit(0);
}
const arg = process.argv.slice(2);
const katalogWav = arg.includes("--wav") ? arg[arg.indexOf("--wav") + 1] : null;

// ---- serwer plików web/ (tylko odczyt, tylko 127.0.0.1) ----
const TYPY = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json" };
const serwer = http.createServer((req, res) => {
  const sciezka = decodeURIComponent((req.url || "/").split("?")[0]);
  const plik = path.normalize(path.join(WEB, sciezka.endsWith("/") ? sciezka + "index.html" : sciezka));
  if (!plik.startsWith(WEB) || !fs.existsSync(plik) || fs.statSync(plik).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPY[path.extname(plik)] || "application/octet-stream" });
  fs.createReadStream(plik).pipe(res);
});
await new Promise(ok => serwer.listen(0, "127.0.0.1", ok));
const port = serwer.address().port;

// ---- render w stronie: ten sam graf, co w grze ----
const SKLADY = {
  A: { opis: "1 żaba (trąbka) + podkład", glos: "trabka", zaby: 1, efekty: [] },
  B: { opis: "8 żab (chór) + podkład", glos: "chor", zaby: 8, efekty: [] },
  C: { opis: "ribbit + podkład + rechot, rribbit, kum", glos: "ribbit", zaby: 1,
    efekty: [{ co: "rechot", t: 2.2 }, { co: "rribbit", t: 4.1 }, { co: "kum", t: 5.6, przes: 0 }, { co: "rechot", t: 7.3 },
      { co: "rribbit", t: 8.6 }] },
  // najgorszy przypadek (nie z recenzji): osiem trąbek idealnie razem, bez rozrzutu w czasie i wysokości
  D: { opis: "8 trąbek idealnie razem + podkład + fanfara", glos: "trabka", zaby: 8, rowno: true,
    efekty: [{ co: "fanfara", t: 0 }, { co: "akord", t: 6 },
      // karta wyników (runda 2, 10-03): gwiazdki co 180 ms od 0,26 s, razem z fanfarą; tik menu
      ...[1, 2, 3, 4, 5].map(n => ({ co: "gwiazdka", t: .26 + (n - 1) * .18, arg: [n, .26 + (n - 1) * .18] })), { co: "tik", t: 3 }] },
  // instrumenty gracza (2026-10-03): każdy sam z podkładem, te same progi co żaba
  I_smyczki: { opis: "1 gracz (smyczki) + podkład", glos: "smyczki", zaby: 1, efekty: [] },
  I_flet: { opis: "1 gracz (flet) + podkład", glos: "flet", zaby: 1, efekty: [] },
  I_organy: { opis: "1 gracz (organy) + podkład", glos: "organy", zaby: 1, efekty: [] },
  I_syntezator: { opis: "1 gracz (syntezator) + podkład", glos: "syntezator", zaby: 1, efekty: [] },
  I_theremin: { opis: "1 gracz (theremin) + podkład", glos: "theremin", zaby: 1, efekty: [] },
  I_piano: { opis: "1 gracz (piano) + podkład", glos: "piano", zaby: 1, efekty: [] },
  I_epiano: { opis: "1 gracz (epiano) + podkład", glos: "epiano", zaby: 1, efekty: [] },
  I_guitar: { opis: "1 gracz (guitar) + podkład", glos: "guitar", zaby: 1, efekty: [] },
  I_bas: { opis: "1 gracz (bas) + podkład", glos: "bas", zaby: 1, efekty: [] },
  I_hawajska: { opis: "1 gracz (hawajska) + podkład", glos: "hawajska", zaby: 1, efekty: [] },
};
async function renderuj(page, sklad, solo, sek, zProbkami) {
  return page.evaluate(async ({ sklad, solo, sek, zProbkami }) => {
    const SR = 44100, c = new OfflineAudioContext(1, SR * sek, SR);
    Glos.kontekst(c, { solo });
    const oda = wbudowanePiosenki().find(p => p.id === "oda"), spb = 60 / oda.tempo;
    for (const n of oda.partie[1].nuty) { const t = n.t * spb; if (t < sek) Glos.nuta("piano", n.m, t, n.d * spb * .95, false); }
    const mel = oda.partie[0], sk = Glos.skala(sklad.zaby);
    for (let k = 0; k < sklad.zaby; k++) {
      const v = (Glos.glos || Glos.glosZaby)(sklad.glos, sk, k + 1);
      let a = k * 7919 + 13; const los = () => { a = (a * 16807) % 2147483647; return (a - 1) / 2147483646; };
      const tlum = sklad.zaby > 1 && !sklad.rowno;   // chór: każda żaba ±25 ms w czasie i ±0,15 półtonu, jak ludzie
      for (const n of mel.nuty) {
        const t0 = Math.max(0, n.t * spb + (tlum ? (los() - .5) * .05 : 0)), t1 = (n.t + n.d) * spb - .04;
        if (t0 >= sek) break;
        v.ustaw(n.m + (tlum ? (los() - .5) * .3 : 0), .35 + .5 * (n.m - (mel.lo - 2)) / (mel.hi - mel.lo + 4), 0, t0);
        v.spiewaj(true, t0); v.spiewaj(false, t1);
      }
    }
    for (const e of sklad.efekty) Glos[e.co](...(e.arg || [e.t, e.przes]));
    const buf = await c.startRendering(), d = buf.getChannelData(0);
    let szczyt = 0, suma = 0;
    for (let i = 0; i < d.length; i++) { const x = d[i], ax = Math.abs(x); if (ax > szczyt) szczyt = ax; suma += x * x; }
    let pcm = null;
    if (zProbkami) {   // 16-bitowe PCM w base64: mniej danych przez most strony niż tablica liczb
      const b = new Uint8Array(d.length * 2), dv = new DataView(b.buffer);
      for (let i = 0; i < d.length; i++) dv.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767))), true);
      let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      pcm = btoa(s);
    }
    return { szczyt, rms: Math.sqrt(suma / d.length), pcm };
  }, { sklad, solo, sek, zProbkami });
}
function wav(pcm16, sr) {
  const dane = Buffer.from(pcm16, "base64"), h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + dane.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(dane.length, 40);
  return Buffer.concat([h, dane]);
}
const dB = x => x > 0 ? 20 * Math.log10(x) : -200;

const checks = [], pomiary = {};
const ck = (n, ok, d) => checks.push([n, !!ok, d === undefined ? "" : String(d)]);
let przegladarka;
try {
  przegladarka = await chromium.launch();
  const page = await przegladarka.newPage();
  const bledy = [];
  page.on("pageerror", e => bledy.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/gry/`);
  await page.waitForFunction(() => typeof Glos !== "undefined" && typeof wbudowanePiosenki === "function" && !!window.ZC && (typeof Wczytywanie === "undefined" || Wczytywanie.gotowe));   // zasłona wczytywania zeszła (pod nią gra jest wyciszona)
  for (const [klucz, sklad] of Object.entries(SKLADY)) {
    const m = {};
    for (const solo of [null, "zaby", "podklad", "efekty"]) {
      const r = await renderuj(page, sklad, solo, 10, !solo && !!katalogWav);
      m[solo || "wyjscie"] = { szczytDb: +dB(r.szczyt).toFixed(1), rmsDb: +dB(r.rms).toFixed(1) };
      if (r.pcm) fs.writeFileSync(path.join(katalogWav, "odsluch-" + klucz + "-" + sklad.glos + ".wav"), wav(r.pcm, 44100));
    }
    pomiary[klucz] = m;
    const roznica = m.zaby.rmsDb - m.podklad.rmsDb;
    console.log(`${klucz} ${sklad.opis.padEnd(40)} wyjście szczyt ${m.wyjscie.szczytDb} dBFS, RMS ${m.wyjscie.rmsDb} | ` +
      `żaby RMS ${m.zaby.rmsDb} (szczyt ${m.zaby.szczytDb}) | podkład RMS ${m.podklad.rmsDb} | efekty szczyt ${m.efekty.szczytDb} | ` +
      `żaby − podkład ${roznica.toFixed(1)} dB`);
    ck(`${klucz} (${sklad.opis}): szczyt wyjścia < −1 dBFS`, m.wyjscie.szczytDb < -1, m.wyjscie.szczytDb + " dBFS");
    ck(`${klucz}: żaby 4–10 dB nad podkładem (RMS)`, roznica >= 4 && roznica <= 10, roznica.toFixed(1) + " dB");
    if (sklad.efekty.some(e => e.co === "rechot")) ck(`${klucz}: rechot słychać nad żabami (szczyt efektów ≥ RMS żab)`,
      m.efekty.szczytDb >= m.zaby.rmsDb, m.efekty.szczytDb + " vs " + m.zaby.rmsDb);
  }
  ck("render offline bez błędów strony", !bledy.length, bledy.join("; "));
} catch (e) {
  ck("render offline w Chromium uruchamia się", false, e && e.message);
} finally {
  if (przegladarka) await przegladarka.close();
  serwer.close();
}
console.log(JSON.stringify({ checks, pomiary }));
