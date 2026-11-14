// RibbitBeat: instrumenty z NAGRAŃ (web/assets/<instrument>/, receptury z `probkiRec` w js/glos.js) — dźwięk zmierzony
// liczbami w prawdziwym silniku gry (2026-10-21).
//
// Uruchomienie (git-bash, z katalogu repo):
//   node tests/gry_probki_instrumentow.mjs [--wav KATALOG] [--tylko flet,trabka]
// Wołane z tests/test_gry_probki_instrumentow.py. Wymaga globalnego @playwright/test (jak gry_zabi_chor_dzwiek.mjs); bez
// niego kończy się linią {"pominiete": "..."} i test py to pomija.
//
// Co robi: stawia serwer plików web/ na wolnym porcie, otwiera /gry/ w Chromium bez okna i W STRONIE renderuje na
// OfflineAudioContext (Glos.kontekst(gotowy)) — czyli tym samym grafem, którym gra gra na żywo:
//   • WZORZEC: trąbka z oscylatorów (zanim jakikolwiek zestaw próbek się wczyta) — do niej równa się głośność,
//   • GŁOS ZASTĘPCZY: każdy instrument z `probkiRec` gra PRZED wczytaniem próbek (synteza, nie cisza),
//   • po `await Glos.zaladujProbki(nazwa)` (prawdziwe fetch-e ../assets/<nazwa>/): nuta 60 gra próbkami, głośność w ±3 dB od
//     wzorca; nuty 55/67/79 mają zmierzoną wysokość w ±0,6 półtonu od zadanej (+ oktawa `probkaOkt`), czyli przestrajanie i wybór
//     strefy działają na całej klawiaturze; nuta trzymana 4 s nie gaśnie (pętla), a po puszczeniu cichnie.
// --wav KATALOG zapisuje każdą zmierzoną nutę jako WAV do odsłuchu. Ostatnia linia: JSON {checks, pomiary}.
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
const tylko = arg.includes("--tylko") ? arg[arg.indexOf("--tylko") + 1].split(",") : null;
if (katalogWav) fs.mkdirSync(katalogWav, { recursive: true });

const TYPY = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json", ".wav": "audio/wav" };
const serwer = http.createServer((req, res) => {
  const sciezka = decodeURIComponent((req.url || "/").split("?")[0]);
  const plik = path.normalize(path.join(WEB, sciezka.endsWith("/") ? sciezka + "index.html" : sciezka));
  if (!plik.startsWith(WEB) || !fs.existsSync(plik) || fs.statSync(plik).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPY[path.extname(plik)] || "application/octet-stream" });
  fs.createReadStream(plik).pipe(res);
});
await new Promise(ok => serwer.listen(0, "127.0.0.1", ok));
const port = serwer.address().port;

// Jedna nuta jednym głosem na OfflineAudioContext (szyna żab solo, bez kompresora): {rms, szczyt, pitch, ogon, pcm}.
// `okres` = [od, do] s okna pomiaru RMS i wysokości; `ogon` = RMS ostatnich 0,8 s (nuta trzymana do końca albo puszczona).
async function nuta(page, instr, polton, sek, trzymaj, zProbkami) {
  return page.evaluate(async ({ instr, polton, sek, trzymaj, zProbkami }) => {
    const SR = 44100, c = new OfflineAudioContext(1, Math.round(SR * sek), SR);
    Glos.kontekst(c, { solo: "zaby" });
    const g = Glos.glosZaby(instr, Glos.skala(1), 0);
    g.ustaw(polton, .7, 0, .05); g.spiewaj(true, .05);
    if (!trzymaj) g.spiewaj(false, sek - 1);
    const buf = await c.startRendering(), d = buf.getChannelData(0);
    const rmsOd = (a, b) => { let s = 0, n = 0; for (let i = Math.round(a * SR); i < Math.min(d.length, Math.round(b * SR)); i++) { s += d[i] * d[i]; n++; } return n ? Math.sqrt(s / n) : 0; };
    let szczyt = 0; for (let i = 0; i < d.length; i++) szczyt = Math.max(szczyt, Math.abs(d[i]));
    // Wysokość: autokorelacja okna 0,6–1,4 s (ustabilizowana część nuty), pierwszy wyraźny szczyt (jak ProbkiAudio.wykryjRoot).
    const w = d.subarray(Math.round(.6 * SR), Math.round(1.4 * SR)), tMin = Math.floor(SR / 2000), tMax = Math.floor(SR / 40);
    let e0 = 0; for (let i = 0; i < w.length; i++) e0 += w[i] * w[i];
    let pitch = null;
    if (e0 > 1e-7) {
      const kor = new Float32Array(tMax + 2); let best = 0;
      for (let t = tMin; t <= tMax; t++) { let s = 0, e = 0; const m = w.length - t; for (let i = 0; i < m; i++) { s += w[i] * w[i + t]; e += w[i + t] * w[i + t]; } kor[t] = s / Math.sqrt(Math.max(1e-12, e0 * e)); if (kor[t] > best) best = kor[t]; }
      if (best >= .3) { const prog = best * .88; let bt = 0;
        for (let t = tMin + 1; t < tMax; t++) if (kor[t] >= prog && kor[t] >= kor[t - 1] && kor[t] >= kor[t + 1]) { bt = t; break; }
        if (bt) { const a = kor[bt - 1], b = kor[bt], cc = kor[bt + 1], m2 = a - 2 * b + cc, t2 = bt + (Math.abs(m2) > 1e-9 ? Math.max(-.5, Math.min(.5, .5 * (a - cc) / m2)) : 0);
          pitch = 69 + 12 * Math.log2(SR / t2 / 440); } }
    }
    let pcm = null;
    if (zProbkami) { const b = new Uint8Array(d.length * 2), dv = new DataView(b.buffer);
      for (let i = 0; i < d.length; i++) dv.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767))), true);
      let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); pcm = btoa(s); }
    // RMS całej nuty (od startu do puszczenia): pianino ma głośność w uderzeniu, smyczki w ogonie, więc żadne krótsze okno
    // nie jest sprawiedliwe dla obu. To zgrubna straż (±5 dB); dokładne wyważenie wobec podkładu na całej Odzie robi
    // tests/gry_zabi_chor_dzwiek.mjs (żaby 4–10 dB nad podkładem) i z niego pochodzą `glosnosc` w probkiRec.
    return { rms: rmsOd(.05, sek - 1), srodek: rmsOd(2, 2.9), ogon: rmsOd(sek - .8, sek), szczyt, pitch, pcm };
  }, { instr, polton, sek, trzymaj, zProbkami });
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
let przegladarka, przegladarkaGry;
try {
  przegladarka = await chromium.launch();
  const page = await przegladarka.newPage();
  const bledy = [], zginelo = [];
  page.on("pageerror", e => bledy.push(e.message));
  page.on("response", r => { if (r.status() >= 400 && r.url().includes("/assets/")) zginelo.push(r.status() + " " + r.url()); });
  await page.goto(`http://127.0.0.1:${port}/gry/`);
  await page.waitForFunction(() => typeof Glos !== "undefined" && !!window.ZC && (typeof Wczytywanie === "undefined" || Wczytywanie.gotowe));   // zasłona wczytywania zeszła (pod nią gra jest wyciszona)
  // instrumenty z nagrań: z prawdziwej tablicy receptur (nie z kopii listy w teście)
  let instrumenty = await page.evaluate(() => Object.keys(Glos.RECEPTURY).filter(k => Glos.RECEPTURY[k].probki && Glos.RECEPTURY[k].probkiRec)
    .map(k => { const pr = Glos.RECEPTURY[k].probkiRec; return { id: k, zestaw: Glos.RECEPTURY[k].probki, okt: pr.probkaOkt || 0,
      legato: !!pr.legato, swoboda: pr.legato ? +pr.legato.swoboda || 0 : 1, artyk: !!pr.artyk }; }));
  if (tylko) instrumenty = instrumenty.filter(i => tylko.includes(i.id));
  ck("są instrumenty z nagrań (receptury z `probki` i `probkiRec`)", instrumenty.length > 0, instrumenty.map(i => i.id).join(","));
  // Gra tworzy kontekst (i rusza ładowanie zestawów) już przy starcie strony, więc „przed wczytaniem” trzeba wymusić:
  // zdjęcie zestawu z tablicy (`usunProbki`) daje DOKŁADNIE stan sprzed dojazdu plików (P = null → głos zastępczy).
  await page.evaluate(async () => { await Promise.all(Object.values(Glos.probkiStan()).length ? Object.keys(Glos.RECEPTURY).map(k => Glos.RECEPTURY[k].probki).filter(Boolean).map(z => Glos.zaladujProbki(z)) : []); });
  await page.evaluate(zestawy => { for (const z of zestawy) Glos.usunProbki(z); }, instrumenty.map(i => i.zestaw));
  // WZORZEC: trąbka z oscylatorów (gdy trąbka sama jest z nagrań, to jej dawny głos — ten, do którego strojono resztę receptur)
  const wz = await nuta(page, "trabka", 60, 2.6, false, false);
  pomiary.wzorzec = { rmsDb: +dB(wz.rms).toFixed(1) };
  console.log(`wzorzec: trąbka z oscylatorów, nuta 60: RMS ${pomiary.wzorzec.rmsDb} dBFS`);
  // GŁOS ZASTĘPCZY: bez zestawu w tablicy każdy gra (syntezą), nie milczy
  for (const i of instrumenty) {
    const stan = await page.evaluate(z => Glos.probkiStan()[z], i.zestaw);
    const z = await nuta(page, i.id, 60, 2.6, false, false);
    pomiary["zastepczy_" + i.id] = +dB(z.rms).toFixed(1);
    ck(`${i.id}: bez próbek gra głosem zastępczym (zestaw „${i.zestaw}” nie w tablicy, dźwięk nie jest ciszą)`,
      !stan && dB(z.rms) > -40, `stan ${JSON.stringify(stan)}, RMS ${dB(z.rms).toFixed(1)} dBFS`);
  }
  for (const i of instrumenty) {
    const ile = await page.evaluate(async z => { const l = await Glos.zaladujProbki(z); return l ? l.length : 0; }, i.zestaw);
    ck(`${i.id}: zestaw „${i.zestaw}” wczytany z ../assets/ (≥ 3 strefy)`, ile >= 3, ile + " próbek");
    if (ile < 3) continue;
    const m = pomiary[i.id] = { ile };
    const n60 = await nuta(page, i.id, 60, 2.6, false, !!katalogWav);
    m.rmsDb = +dB(n60.rms).toFixed(1); m.szczytDb = +dB(n60.szczyt).toFixed(1); m.ogonDb = +dB(n60.ogon).toFixed(1);
    if (n60.pcm) fs.writeFileSync(path.join(katalogWav, `probki-${i.id}-60.wav`), wav(n60.pcm, 44100));
    const roz = m.rmsDb - pomiary.wzorzec.rmsDb;
    // ±6 dB: `glosnosc` jest strojona na KRÓTKICH nutach Ody, a tu nuta trwa 1,5 s — instrument o wolnym ataku (sekcje smyczków)
    // na krótkiej nucie jest cichszy, więc na długiej siedzi kilka dB nad trąbką; to straż przed pomyłką o rząd, nie wyważenie
    ck(`${i.id}: nuta 60 z nagrań gra mniej więcej tak głośno jak trąbka z oscylatorów (±6 dB)`, Math.abs(roz) <= 6, `${roz.toFixed(1)} dB (RMS ${m.rmsDb} dBFS)`);
    ck(`${i.id}: po puszczeniu cichnie (ogon 0,8 s ≥ 20 dB pod nutą)`, m.rmsDb - m.ogonDb >= 20, `ogon ${m.ogonDb} dBFS`);
    m.wysokosci = {};
    for (const p of [55, 67, 79]) {
      const n = await nuta(page, i.id, p, 2.6, false, !!katalogWav);
      if (n.pcm) fs.writeFileSync(path.join(katalogWav, `probki-${i.id}-${p}.wav`), wav(n.pcm, 44100));
      const cel = p + 12 * i.okt, zm = n.pitch;
      m.wysokosci[p] = zm == null ? null : +zm.toFixed(2);
      // oktawa w dół/górę to typowy błąd autokorelacji przy bogatym widmie — liczy się odległość do najbliższej oktawy celu
      const odl = zm == null ? 99 : Math.abs(((zm - cel) % 12 + 18) % 12 - 6);
      ck(`${i.id}: nuta ${p} gra wysokość ${cel} (strefa + przestrojenie, ±0,6 półtonu)`, odl <= .6,
        `zmierzono ${zm == null ? "brak" : zm.toFixed(2)}`);
    }
    const dl = await nuta(page, i.id, 64, 4, true, false);
    m.trzymanaSrodekDb = +dB(dl.srodek).toFixed(1); m.trzymanaOgonDb = +dB(dl.ogon).toFixed(1);
    ck(`${i.id}: nuta trzymana 4 s nie gaśnie (pętla: ostatnie 0,8 s w 3 dB od 2–2,9 s)`,
      Math.abs(m.trzymanaSrodekDb - m.trzymanaOgonDb) <= 3 && m.trzymanaOgonDb > -40, `${m.trzymanaSrodekDb} → ${m.trzymanaOgonDb} dBFS`);
    console.log(`${i.id.padEnd(12)} ${ile} stref | nuta 60 RMS ${m.rmsDb} dBFS (${roz >= 0 ? "+" : ""}${roz.toFixed(1)} dB do wzorca; zastępczy ${pomiary["zastepczy_" + i.id]}), szczyt ${m.szczytDb} | ` +
      `wysokości ${JSON.stringify(m.wysokosci)} (okt ${i.okt}) | trzymana ${m.trzymanaSrodekDb} → ${m.trzymanaOgonDb}`);
  }
  // PRZEJŚCIA (10-21 wieczór): z `legato` śpiew 63,6 gra półton 64 plus `swoboda` odchyłki (dęte .25 → 63,9; klawisz 0 → 64,0),
  // bez legato (puzon) dokładnie 63,6; skok 60→64 W TRAKCIE nuty siada w nowym półtonie po 250 ms, także z artykulacją (nowe źródło).
  for (const i of instrumenty) {
    if (!pomiary[i.id]) continue;
    const n = await nuta(page, i.id, 63.6, 2.6, false, false);
    const cel = (i.legato ? 64 + i.swoboda * (63.6 - 64) : 63.6) + 12 * i.okt, zm = n.pitch;
    const odl = zm == null ? 99 : Math.abs(((zm - cel) % 12 + 18) % 12 - 6);
    ck(`${i.id}: śpiew 63,6 gra ${cel.toFixed(2)} (${i.legato ? "legato: półton + " + i.swoboda + " odchyłki" : "bez legato: ciągły pitch"}, ±0,25)`,
      odl <= .25, `zmierzono ${zm == null ? "brak" : zm.toFixed(2)}`);
    const sk = await page.evaluate(async ({ instr, okt }) => {
      const SR = 44100, c = new OfflineAudioContext(1, Math.round(SR * 2.2), SR); Glos.kontekst(c, { solo: "zaby" });
      const g = Glos.glosZaby(instr, Glos.skala(1), 0);
      g.ustaw(60, .7, 0, .05); g.spiewaj(true, .05); g.ustaw(64, .7, 0, 1); g.spiewaj(false, 2);
      const d = (await c.startRendering()).getChannelData(0);
      const w = d.subarray(Math.round(1.25 * SR), Math.round(1.6 * SR)), tMin = Math.floor(SR / 2000), tMax = Math.floor(SR / 40);
      let e0 = 0; for (let k = 0; k < w.length; k++) e0 += w[k] * w[k]; if (e0 < 1e-7) return null;
      const kor = new Float32Array(tMax + 2); let best = 0;
      for (let t = tMin; t <= tMax; t++) { let s = 0, e = 0; const m = w.length - t; for (let k = 0; k < m; k++) { s += w[k] * w[k + t]; e += w[k + t] * w[k + t]; } kor[t] = s / Math.sqrt(Math.max(1e-12, e0 * e)); if (kor[t] > best) best = kor[t]; }
      if (best < .3) return null; const prog = best * .88; let bt = 0;
      for (let t = tMin + 1; t < tMax; t++) if (kor[t] >= prog && kor[t] >= kor[t - 1] && kor[t] >= kor[t + 1]) { bt = t; break; }
      if (!bt) return null; const a = kor[bt - 1], b = kor[bt], cc = kor[bt + 1], m2 = a - 2 * b + cc, t2 = bt + (Math.abs(m2) > 1e-9 ? Math.max(-.5, Math.min(.5, .5 * (a - cc) / m2)) : 0);
      return 69 + 12 * Math.log2(SR / t2 / 440);
    }, { instr: i.id, okt: i.okt });
    const celS = 64 + 12 * i.okt, odlS = sk == null ? 99 : Math.abs(((sk - celS) % 12 + 18) % 12 - 6);
    ck(`${i.id}: skok 60→64 w trakcie nuty siada w ${celS} po 250 ms (${i.artyk ? "z artykulacją: nowe źródło" : "miękkie wejście"}, ±0,3)`,
      odlS <= .3, `zmierzono ${sk == null ? "brak" : sk.toFixed(2)}`);
  }
  // PRZEŁĄCZNIK (10-21 wieczór): `opcje.przejscia` nadpisuje domyślne receptury — trąbka (domyślnie płynnie) skokowo gra 63,6 jako
  // 64 − 0,25·0,4 = 63,9; flet (domyślnie skokowo) płynnie gra dokładnie 63,6 (+12); synteza (theremin, płynna) skokowo też 63,9
  for (const [instr, tryb, cel] of [["trabka", "skok", 63.9], ["flet", "plynne", 75.6], ["theremin", "skok", 63.9 + 12], ["krzyk", "plynne", 63.6]]) {
    const zm = await page.evaluate(async ({ instr, tryb }) => {
      const SR = 44100, c = new OfflineAudioContext(1, Math.round(SR * 2.6), SR); Glos.kontekst(c, { solo: "zaby" });
      const g = Glos.glosZaby(instr, Glos.skala(1), 0, null, { przejscia: tryb });
      g.ustaw(63.6, .7, 0, .05); g.spiewaj(true, .05); g.spiewaj(false, 1.6);
      const d = (await c.startRendering()).getChannelData(0);
      const w = d.subarray(Math.round(.6 * SR), Math.round(1.4 * SR)), tMin = Math.floor(SR / 2000), tMax = Math.floor(SR / 40);
      let e0 = 0; for (let k = 0; k < w.length; k++) e0 += w[k] * w[k]; if (e0 < 1e-7) return null;
      const kor = new Float32Array(tMax + 2); let best = 0;
      for (let t = tMin; t <= tMax; t++) { let s = 0, e = 0; const m = w.length - t; for (let k = 0; k < m; k++) { s += w[k] * w[k + t]; e += w[k + t] * w[k + t]; } kor[t] = s / Math.sqrt(Math.max(1e-12, e0 * e)); if (kor[t] > best) best = kor[t]; }
      if (best < .3) return null; const prog = best * .88; let bt = 0;
      for (let t = tMin + 1; t < tMax; t++) if (kor[t] >= prog && kor[t] >= kor[t - 1] && kor[t] >= kor[t + 1]) { bt = t; break; }
      if (!bt) return null; const a = kor[bt - 1], b = kor[bt], cc = kor[bt + 1], m2 = a - 2 * b + cc, t2 = bt + (Math.abs(m2) > 1e-9 ? Math.max(-.5, Math.min(.5, .5 * (a - cc) / m2)) : 0);
      return 69 + 12 * Math.log2(SR / t2 / 440);
    }, { instr, tryb });
    const odl = zm == null ? 99 : Math.abs(((zm - cel) % 12 + 18) % 12 - 6);
    ck(`przełącznik: ${instr} z opcją „${tryb}” gra 63,6 jako ${cel.toFixed(2)} (±0,25)`, odl <= .25, `zmierzono ${zm == null ? "brak" : zm.toFixed(2)}`);
  }
  const dom = await page.evaluate(() => ["trabka", "puzon", "flet", "piano", "krzyk", "theremin", "chiptune", "guitar", "hawajska"].map(k => k + ":" + Glos.domyslnePrzejscia(k)).join(" "));
  ck("domyślne tryby: trąbka, puzon, theremin i gitara hawajska płynnie; flet, pianino, Krzyk, chiptune i gitara skokowo",
    dom === "trabka:plynne puzon:plynne flet:skok piano:skok krzyk:skok theremin:plynne chiptune:skok guitar:skok hawajska:plynne", dom);

  // KROK „SKOKOWO” NA NUTACH PIOSENKI (przejścia muszą obsługiwać nuty grane w grze): logika na prawdziwym głosie.
  // stan() czyta stan głosu w JS, więc wystarczy wołać ustaw/spiewaj z czasami jak gra (240 razy na sekundę), bez renderu.
  const krok = await page.evaluate(() => {
    const c = new OfflineAudioContext(1, 44100, 44100); Glos.kontekst(c, { solo: "zaby" });
    const sekw = (instr, przebieg, cele) => {
      const g = Glos.glosZaby(instr, Glos.skala(1), 0, null, { przejscia: "skok" }), nuty = []; let ost = null;
      przebieg.forEach(([t, p], i) => {
        g.ustaw(p, .7, 0, t, cele ? cele(t) : undefined); if (i === 0) g.spiewaj(true, t);
        const n = g.stan().nuta; if (n !== ost) { nuty.push([+t.toFixed(3), n]); ost = n; }
      });
      const s = g.stan(); g.zniszcz(); return { nuty, kroki: s.kroki, artyk: s.artyk, probki: s.probki };
    };
    // zjazd jak w trybie płynnym gry: krzywa S od a do b, start t0, długość dl
    const zjazd = (a, b, t0, dl) => { const o = []; for (let i = 0; i <= (t0 + dl + .3) * 240; i++) { const t = i / 240, u = Math.max(0, Math.min(1, (t - t0) / dl)); o.push([t, a + (b - a) * u * u * (3 - 2 * u)]); } return o; };
    // fałsz: 0,1 s na 64, w 40 ms na 66 i tam zostaje (nuta piosenki to 64)
    const falsz = []; for (let i = 0; i < 240; i++) { const t = i / 240; falsz.push([t, t < .1 ? 64 : t < .14 ? 64 + 2 * (t - .1) / .04 : 66]); }
    // granica półtonu: śpiew drży między 64,45 a 64,55
    const granica = []; for (let i = 0; i < 240; i++) granica.push([i / 240, 64.5 + .05 * Math.sin(i / 3)]);
    return {
      zjazdNuty: sekw("trabka", zjazd(64, 67, .2, .5), t => t < .2 ? [64] : [64, 67]),
      zjazdBez: sekw("trabka", zjazd(64, 67, .2, .5)),
      wolnyNuty: sekw("trabka", zjazd(64, 67, .2, 2), () => [64, 67]),
      falsz: sekw("trabka", falsz, () => [64]),
      granica: sekw("trabka", granica),
      krzyk: sekw("krzyk", zjazd(60, 67, .2, .4), t => t < .2 ? [60] : [60, 67]),
    };
  });
  pomiary.krok = krok;
  const wart = r => r.nuty.map(x => x[1]).join("→");
  ck("krok: zjazd 64→67 z nutami piosenki = jeden krok 64→67 w połowie drogi, jedna artykulacja",
    wart(krok.zjazdNuty) === "64→67" && krok.zjazdNuty.kroki === 1 && krok.zjazdNuty.artyk === 1
      && krok.zjazdNuty.nuty[1][0] >= .43 && krok.zjazdNuty.nuty[1][0] <= .5, JSON.stringify(krok.zjazdNuty));
  ck("krok: ten sam zjazd bez nut piosenki (podgląd, Studio) = każdy półton 64→65→66→67",
    wart(krok.zjazdBez) === "64→65→66→67" && krok.zjazdBez.kroki === 3, JSON.stringify(krok.zjazdBez));
  ck("krok: wolny zjazd (2 s) z nutami piosenki też jednym krokiem", wart(krok.wolnyNuty) === "64→67" && krok.wolnyNuty.kroki === 1,
    JSON.stringify(krok.wolnyNuty));
  ck("krok: trzymany fałsz (66 przy nucie 64) słychać, ale dopiero po 70 ms, a przejazd przez 65 nie wybija ataku",
    wart(krok.falsz) === "64→66" && krok.falsz.nuty[1][0] >= .195 && krok.falsz.nuty[1][0] <= .23, JSON.stringify(krok.falsz));
  ck("krok: śpiew drżący na granicy półtonu nie przeskakuje (histereza)", krok.granica.nuty.length === 1 && krok.granica.kroki === 0,
    JSON.stringify(krok.granica));
  ck("krok: Krzyk na zjeździe 60→67 = jeden nowy krzyk", wart(krok.krzyk) === "60→67" && krok.krzyk.artyk === 1, JSON.stringify(krok.krzyk));

  // GŁOŚNOŚĆ W MIKSIE GRY: ten sam pomiar co tests/gry_zabi_chor_dzwiek.mjs (Oda, 10 s, szyny solo), ale dla KAŻDEGO instrumentu
  // z nagrań i Krzyku — tamten test mierzy tylko część z nich, a `glosnosc` pięciu (klarnet, obój, puzon, tuba, wiolonczela)
  // ustawiona przez analogię dała wiolonczelę 12,2 dB nad podkładem (10-22). Próg gry: żaby 4–10 dB nad podkładem; Krzyk
  // historycznie siedzi nisko (4,2 dB przed 10-21), więc dla niego dolna granica 3,5.
  const oda = await page.evaluate(async ids => {
    const render = async (glos, solo) => {
      const SR = 44100, sek = 10, c = new OfflineAudioContext(1, SR * sek, SR);
      Glos.kontekst(c, { solo });
      const p = wbudowanePiosenki().find(x => x.id === "oda"), spb = 60 / p.tempo;
      for (const n of p.partie[1].nuty) { const t = n.t * spb; if (t < sek) Glos.nuta("piano", n.m, t, n.d * spb * .95, false); }
      const mel = p.partie[0], v = Glos.glos(glos, Glos.skala(1), 1);
      for (const n of mel.nuty) { const t0 = n.t * spb, t1 = (n.t + n.d) * spb - .04; if (t0 >= sek) break;
        v.ustaw(n.m, .35 + .5 * (n.m - (mel.lo - 2)) / (mel.hi - mel.lo + 4), 0, t0); v.spiewaj(true, t0); v.spiewaj(false, t1); }
      const d = (await c.startRendering()).getChannelData(0); let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      return 20 * Math.log10(Math.max(1e-9, Math.sqrt(s / d.length)));
    };
    const out = { podklad: await render("trabka", "podklad") };
    for (const id of ids) out[id] = await render(id, "zaby");
    return out;
  }, instrumenty.map(i => i.id).concat("krzyk"));
  pomiary.oda = {};
  for (const id of instrumenty.map(i => i.id).concat("krzyk")) {
    const r = +(oda[id] - oda.podklad).toFixed(1), lo = id === "krzyk" ? 3.5 : 4;
    pomiary.oda[id] = r;
    ck(`Oda: ${id} ${lo.toLocaleString("pl")}–10 dB nad podkładem (jak każdy instrument gry)`, r >= lo && r <= 10, r + " dB");
  }
  console.log("Oda, żaby − podkład [dB]: " + JSON.stringify(pomiary.oda));

  // W PRAWDZIWEJ GRZE: bot „mistrz” śpiewa piosenkę z największą liczbą zjazdów o ≥ 3 półtony (tryb płynny gry), instrument przez
  // ZC.dev.instrument, tryb przez S.ust.przejsciaGraczy — to samo, co ustawia przełącznik na karcie gracza. Co klatkę: wysokość
  // śpiewu, nuta głosu (stan()), kroki i artykulacje. Skokowo głos ma stać na nutach piosenki i robić tyle kroków, ile jest zmian
  // nut, a nie tyle, ile półtonów mija śpiew w zjazdach. Osobna przeglądarka, bo tu dźwięk musi naprawdę grać (zegar audio).
  przegladarkaGry = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const pg = await przegladarkaGry.newPage({ viewport: { width: 1280, height: 720 } });
  const bledyGry = [];
  pg.on("pageerror", e => bledyGry.push(e.message));
  await pg.goto(`http://127.0.0.1:${port}/gry/?zywe=0&dev=1`, { waitUntil: "domcontentloaded" });
  await pg.waitForFunction(() => typeof ZC !== "undefined" && ZC.dev && ZC.dev.S && typeof Postepy !== "undefined" && typeof wbudowanePiosenki === "function" && (typeof Wczytywanie === "undefined" || Wczytywanie.gotowe),   // zasłona wczytywania zeszła
    null, { timeout: 30000 });
  await pg.waitForTimeout(600);
  await pg.evaluate(() => {
    const b = [...document.querySelectorAll("#kontoOkno button")].find(x => /Graj jako|Play as/.test(x.textContent)); if (b) b.click();
    localStorage.setItem("ribbitbeat.jakGrac", "1"); ZC.postepy.odblokujWszystko(true);
  });
  await pg.waitForTimeout(400);
  await pg.evaluate(async () => { Glos.odblokuj(); await Promise.all(Object.keys(Glos.RECEPTURY).map(k => Glos.RECEPTURY[k].probki).filter(Boolean).map(z => Glos.zaladujProbki(z))); });
  const piosenka = await pg.evaluate(() => {
    let best = null, bn = -1;
    for (const p of wbudowanePiosenki()) {
      const n = ((p.partie || [])[0] || {}).nuty || []; let k = 0;
      for (let i = 0; i + 1 < n.length; i++) { const gap = n[i + 1].t - (n[i].t + n[i].d); if (gap <= .1 && gap >= -1e-6 && Math.abs(n[i + 1].m - n[i].m) >= 3) k++; }
      if (k > bn) { bn = k; best = p.id; }
    }
    return { id: best, zjazdow3: bn };
  });
  pomiary.gra = { piosenka };
  for (const [instr, tryb] of [["trabka", "skok"], ["krzyk", "skok"], ["piano", "skok"], ["smyczki", "skok"], ["flet", "plynne"]]) {
    const w = await pg.evaluate(async ({ instr, tryb, id }) => {
      if (ZC.dev.autoplay(id, { botow: 1, poziom: "mistrz" }) == null) return { blad: "autoplay nie ruszył (ekran " + ZC.dev.S.ekran + ")" };
      const S = ZC.dev.S, g = S.gracze[0];
      S.ust.przejsciaGraczy = Object.assign({}, S.ust.przejsciaGraczy, { [g.id]: { [instr]: tryb } });   // jak z okna gracza („Pomoce” / „Poziom”), dla tego instrumentu
      ZC.dev.instrument(instr);
      const ramki = [], t0 = performance.now();
      await new Promise(ok => {
        const f = () => {
          const G = S.gra, gg = S.gracze[0];
          if (G && gg && gg.glos && gg.glos.stan) { const s = gg.glos.stan(); ramki.push([G.beat, gg.polton, gg.spiewa ? 1 : 0, s.nuta, s.kroki, s.artyk, s.skok ? 1 : 0, s.probki ? 1 : 0]); }
          if (performance.now() - t0 > 12000 || (G && G.beat > 30)) ok(); else requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
      });
      const nuty = S.gra ? S.gra.tory[0].def.nuty.map(n => [n.t, n.d, n.m, n.p ? n.p.do : null]) : [];
      const instrument = S.gracze[0] && S.gracze[0].instrument;
      ZC.dev.instrument(null);
      return { ramki, nuty, audio: Glos.stan(), instrument };
    }, { instr, tryb, id: piosenka.id });
    if (w.blad) { ck(`gra: ${instr} ${tryb} — piosenka rusza`, false, w.blad); continue; }
    const M = new Set(); for (const [, , m, pdo] of w.nuty) { M.add(m); if (pdo != null) M.add(pdo); }
    const R = w.ramki, spiew = R.filter(r => r[2]);
    const dKroki = R.length ? R[R.length - 1][4] - R[0][4] : 0, dArtyk = R.length ? R[R.length - 1][5] - R[0][5] : 0;
    // zmiany nut piosenki w zaśpiewanym kawałku (granica nut w oknie, inna wysokość)
    const bOd = spiew.length ? spiew[0][0] : 0, bDo = spiew.length ? spiew[spiew.length - 1][0] : 0;
    let zmianPiosenki = 0;
    for (let i = 0; i + 1 < w.nuty.length; i++) { const a = w.nuty[i], b = w.nuty[i + 1]; if (b[0] > bOd && b[0] <= bDo && b[2] !== a[2]) zmianPiosenki++; }
    // tyle kroków zrobiłby głos po samych półtonach (bez nut piosenki) na tej samej ścieżce śpiewu
    let poltonami = 0, n = NaN;
    for (const r of R) {
      if (!r[2]) { n = NaN; continue; }
      const p = r[1], k = Math.round(p);
      if (!Number.isFinite(n)) { n = k; continue; }
      if (k !== n && Math.abs(p - k) + .15 < Math.abs(p - n)) { n = k; poltonami++; }
    }
    const obce = spiew.filter(r => !M.has(r[3])).length;
    pomiary.gra[instr + "_" + tryb] = { instrument: w.instrument, klatek: R.length, spiewa: spiew.length, krokow: dKroki, artykulacji: dArtyk,
      zmianNutPiosenki: zmianPiosenki, krokowPoltonami: poltonami, klatekPozaNutami: obce, audio: w.audio };
    console.log(`gra ${instr.padEnd(8)} ${tryb.padEnd(6)} | klatek ${R.length}, śpiewa ${spiew.length} | kroków ${dKroki} (zmian nut piosenki ${zmianPiosenki}, ` +
      `po samych półtonach byłoby ${poltonami}), artykulacji ${dArtyk} | poza nutami piosenki ${obce} klatek | audio ${w.audio}`);
    ck(`gra: ${instr} ${tryb} — głos ma wybrany instrument i tryb`, w.instrument === instr && R.length > 0 && R.every(r => !!r[6] === (tryb === "skok")),
      `${w.instrument}, klatek ${R.length}`);
    if (tryb === "skok") {
      ck(`gra: ${instr} skokowo — głos stoi na nutach piosenki (≤ 3 % zaśpiewanych klatek poza nimi)`, spiew.length > 60 && obce <= .03 * spiew.length,
        `${obce}/${spiew.length}`);
      ck(`gra: ${instr} skokowo — kroków nie więcej niż zmian nut piosenki (+2)`, dKroki >= 1 && dKroki <= zmianPiosenki + 2,
        `kroków ${dKroki}, zmian nut ${zmianPiosenki}, po samych półtonach byłoby ${poltonami}`);
      if (R.some(r => r[7])) ck(`gra: ${instr} skokowo — każdy krok to nowa artykulacja nagrania`, dArtyk === dKroki, `${dArtyk} artykulacji / ${dKroki} kroków`);
      if (instr === "trabka") ck("gra: śpiew przechodzi przez zjazdy (po samych półtonach kroków byłoby więcej — test sprawdza to, co trzeba)",
        poltonami > dKroki, `półtonami ${poltonami}, nutami piosenki ${dKroki}`);
    } else {
      ck(`gra: ${instr} płynnie — żadnych kroków ani artykulacji w trakcie śpiewu`, dKroki === 0 && dArtyk === 0, `kroków ${dKroki}, artykulacji ${dArtyk}`);
    }
  }
  ck("gra: bez błędów strony", !bledyGry.length, bledyGry.slice(0, 3).join("; "));
  ck("render offline bez błędów strony", !bledy.length, bledy.join("; "));
  ck("żaden plik próbek nie zginął w sieci (odpowiedzi ../assets/ bez 4xx)", !zginelo.length, zginelo.slice(0, 3).join("; "));
} catch (e) {
  ck("render offline w Chromium uruchamia się", false, e && (e.stack || e.message));
} finally {
  if (przegladarka) await przegladarka.close();
  if (przegladarkaGry) await przegladarkaGry.close();
  serwer.close();
}
console.log(JSON.stringify({ checks, pomiary }));
