// PŁASKIE EDYTORY KRZYWYCH (rf-25e, etap E6, 2026-10-02) — FALA, KOREKTOR I OBWIEDNIA POZA LAMPĄ, BEZ PRZEGLĄDARKI.
//
// Etap E6 wyjął edycję z okrągłej lampy oscyloskopu (rf-25c) i przeniósł ją 1:1 na trzy płaskie panele w kartach
// modułów (SoundEditors). Najkruchsze jest tu to, co przeszło razem z kodem, bo przy przeprowadzce łatwo zgubić jedną
// gałąź, której nie widać bez długiego klikania:
//   • PATCH I/O — readInto / load (fala, pasma, krzywizny) zachowują się jak przed przeprowadzką (bez przełączania
//     kanałów, bo kanałów już nie ma), a rf-25 woła je na SoundEditors;
//   • RYSOWANIE FALI I SŁUPKI — interpolacja szybkiego pociągnięcia, pierwsza edycja wbudowanej fali zaczyna od niej;
//   • KOREKTOR — nowe pasmo pod palcem, chwyt bez skoku, kółko ×1,12, dwuklik, Q −/+ z przycięciem, limit 4 pasm;
//   • OBWIEDNIA — suwaki jako jedyne źródło prawdy (value + zdarzenie input, przycięcie i krok suwaka), skala czasu
//     zamrożona na czas ciągnięcia, zgięcie ląduje pod palcem;
//   • NOWE: mapowanie liniowe obraz ↔ canvas (w obie strony), analiza dźwięku laba `feat` (pasma jak rf-24b _feat,
//     przebieg wyzwalany na zerze), rama z obszyciem (ścieg bez szwu), montaż w DOM-ie i jeden analizator na busie.
// Pliki PRAWDZIWE w `vm`: rf-25c (czysta matematyka) i rf-25e, z atrapą DOM i atrapą kontekstu 2D, która liczy wywołania.
// RUNDA NAPRAWCZA PO PRZEGLĄDZIE (2026-10-02): rama na osobnym canvasie pod ekranem (dotyk: filc przewija stronę,
// ekran przechwytuje palec), mapowanie bez filcu, chwyt pierścienia z zasięgiem rosnącym z promieniem, analizator
// wspólny z lampą (b._plateAn), symulacja zegara 60/120/144 Hz (j), klawiatura (k) i zmiana języka (l).
//
// Wywoływane z tests/test_synth_store.py; samodzielnie: node tests/curve_editors_harness.mjs
// Ostatnia linia wyjścia = JSON {checks:[[nazwa, ok, szczegół], …]}; kod wyjścia 1, gdy coś nie przeszło.
// (Nazwy sprawdzeń bez polskich znaków i emoji — test_synth_store.py drukuje je print()-em na konsoli cp1250.)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);
const near = (a, b, e) => Math.abs(a - b) <= e;
const J = (o) => JSON.stringify(o);
const read = (f) => fs.readFileSync(path.join(REPO, f), "utf8");
const SINE = Array.from({ length: 64 }, (_, n) => Math.sin(2 * Math.PI * n / 64));

// ---------- atrapa kontekstu 2D: każde wywołanie liczone, stan (save/restore) jak w canvasie ----------
function mkCtx() {
  const calls = {}, log = [], sets = [];
  const DEF = { globalAlpha: 1, lineWidth: 1, lineDashOffset: 0, font: "10px x", textAlign: "start", textBaseline: "alphabetic",
                fillStyle: "#000", strokeStyle: "#000", shadowBlur: 0, shadowColor: "", lineCap: "butt", lineJoin: "miter" };
  let st = Object.assign({}, DEF); const stack = [];
  const fn = (n) => (...a) => {
    calls[n] = (calls[n] || 0) + 1; log.push([n, a]);
    if (n === "save") stack.push(Object.assign({}, st));
    if (n === "restore" && stack.length) st = stack.pop();
    if (n === "measureText") return { width: String(a[0]).length * 6 };
    if (n === "createLinearGradient" || n === "createRadialGradient") return { addColorStop() {} };
    if (n === "createPattern") return { pattern: true };
    return undefined;
  };
  return new Proxy({}, {
    get(t, k) { if (k === "calls") return calls; if (k === "log") return log; if (k === "sets") return sets;
      if (typeof k === "symbol") return undefined; if (k in st) return st[k]; return fn(k); },
    set(t, k, v) { st[k] = v; sets.push([k, v]); return true; },
  });
}
// ---------- atrapa DOM ----------
let createdCanvases = 0;
function mkStrip() {   // pasek narzędzi: przyciski z innerHTML, querySelectorAll po trzech selektorach z rf-25e
  let html = "", btns = [];
  const L = {};
  return {
    className: "", dataset: {}, attrs: {},
    set innerHTML(h) { html = h;
      btns = [...h.matchAll(/<button ([^>]*)>([^<]*)<\/button>/g)].map((m) => {
        const at = Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
        const b = { text: m[2], attrs: at, dataset: {}, disabled: false, setAttribute(k, v) { this.attrs[k] = String(v); } };
        if (at["data-mode"]) b.dataset.mode = at["data-mode"]; if (at["data-act"]) b.dataset.act = at["data-act"];
        b.closest = () => b; return b; }); },
    get innerHTML() { return html; }, get btns() { return btns; },
    querySelectorAll(s) {
      if (s === "[data-mode]") return btns.filter((b) => b.dataset.mode);
      const m = /^\[data-act\^="([^"]+)"\]$/.exec(s); if (m) return btns.filter((b) => (b.dataset.act || "").startsWith(m[1]));
      return []; },
    contains: () => true, setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(t, f) { (L[t] || (L[t] = [])).push(f); }, fire(t, e) { (L[t] || []).forEach((f) => f(e)); },
  };
}
function mkEl(tag) {
  if (tag === "div") {
    // .ce-tools dostaje innerHTML, więc pasek; zwykły div ma tylko dzieci
    const s = mkStrip(); s.children = []; s.appendChild = function (c) { this.children.push(c); c.parentNode = this; return c; }; return s;
  }
  if (tag === "canvas") createdCanvases++;
  const L = {};
  // panel (stage) 640 x 220, obwiednia 640 x 240 jak w css/31; rama .ce-frame zajmuje cały stage, ekran .ce-cv jest
  // wsunięty o filc (FR = 6 px z każdej strony; 22 i 11 do 2026-10-03); canvas poza stage'em (kopie, kafel) ma rozmiar stage'a
  const st = (el) => { const p = el.parentNode, env = !!(p && /ce-env/.test(p.className)); return { W: el.W, H: env ? 240 : 220 }; };
  return {
    tagName: tag, className: "", dataset: {}, attrs: {}, children: [], width: 300, height: 150, offsetParent: {},
    W: 640, fv: false,
    get clientWidth() { const s = st(this); return /\bce-cv\b/.test(this.className) ? s.W - 44 : s.W; },
    get clientHeight() { const s = st(this); return /\bce-cv\b/.test(this.className) ? s.H - 44 : s.H; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(t, f, o) { (L[t] || (L[t] = [])).push({ f, o }); }, L,
    fire(t, e) { (L[t] || []).forEach((x) => x.f(e)); },
    getContext(k) { return k === "2d" ? (this._ctx || (this._ctx = mkCtx())) : null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; },
    setPointerCapture() {}, matches(s) { return s === ":focus-visible" && this.fv; },
  };
}
// suwaki i pola formularza z prawdziwymi min / max / step z dashboardu
const dash = read("web/ribbitflip_dashboard.html");
const els = new Map();
const mkRange = (id, mn, mx, st, v) => {
  const L = [];
  return { id, value: String(v), min: String(mn), max: String(mx), step: String(st), ev: 0, last: null,
    dispatchEvent(e) { this.ev++; this.last = e && e.type; L.forEach((f) => f(e)); return true; }, addEventListener(t, f) { if (t === "input") L.push(f); } };
};
for (const m of dash.matchAll(/<input id="(se(?:Att|Dec|Sus|Rel|FEnv|FEnvT))" type="range" min="([^"]+)" max="([^"]+)" step="([^"]+)" value="([^"]+)"/g))
  els.set(m[1], mkRange(m[1], +m[2], +m[3], +m[4], m[5]));
const mkSel = (id, v) => { const L = []; return { id, value: v, addEventListener(t, f) { if (t === "change") L.push(f); }, fire() { L.forEach((f) => f()); } }; };
els.set("seWave", mkSel("seWave", "sawtooth"));
els.set("seType", mkSel("seType", "legato"));
const slots = ["wave", "eq", "env"].map((k) => { const s = mkEl("div"); s.className = "se-sec-editor"; s.dataset.editor = k; s.hidden = true; return s; });
const box = { id: "soundEditor", open: true, L: {}, querySelectorAll: (s) => (s === ".se-sec-editor[data-editor]" ? slots : []),
  addEventListener(t, f) { (this.L[t] || (this.L[t] = [])).push(f); } };
els.set("soundEditor", box);
ck("(dom) dashboard: suwaki obwiedni znalezione (atak, zanik, podtrzymanie, zwolnienie, filtr)", ["seAtt", "seDec", "seSus", "seRel", "seFEnv", "seFEnvT"].every((id) => els.has(id)));

let clock = 1000, lpc = 0;
const mos = [];
const ctx = {
  console, _gl: (pl) => pl,
  document: { getElementById: (id) => els.get(id) || null, createElement: (t) => mkEl(t), body: {}, documentElement: {} },
  getComputedStyle: () => ({ fontFamily: "Test", getPropertyValue: () => "" }),
  performance: { now: () => clock },
  Event: class { constructor(t, o) { this.type = t; this.bubbles = !!(o && o.bubbles); } },
  labParamChanged: () => { lpc++; },
  PadPlate: { _fs: {} },
  devicePixelRatio: 1.5,
  MutationObserver: class { constructor(f) { this.f = f; mos.push(this); } observe(t, o) { this.t = t; this.o = o; } },
};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["web/js/rf-25c-sound-screens.js", "web/js/rf-25e-curve-editors.js"]) {
  try { vm.runInContext(read(f), ctx, { filename: f }); }
  catch (e) { ck(f + " wczytany w vm (bez DOM)", false, e.message); }
}
const G = (n) => vm.runInContext(n, ctx);
const SS = G("SoundScreens"), SE = G("SoundEditors");
ck("(a) SoundEditors na window, SoundScreens obok (czysta matematyka)", ctx.window.SoundEditors === SE && !!SS && typeof SS.eqMag === "function");

// (a) OBRAZ ↔ CANVAS: liniowo, w obie strony, pole wewnątrz ramy (FR) i marginesu ekranu (PAD)
for (const [W, H] of [[640, 220], [600, 240], [320, 180]]) {
  let w1 = 0, w2 = 0;
  for (const [x, y] of [[0, 0], [1, 1], [.37, .62], [-.05, 1.08], [.5, .5]]) { const c = SE.picToCv(x, y, W, H), p = SE.cvToPic(c.x, c.y, W, H); w1 = Math.max(w1, Math.hypot(p.x - x, p.y - y)); }
  for (const [px, py] of [[0, 0], [W, H], [W / 3, H / 4], [33, 190]]) { const p = SE.cvToPic(px, py, W, H), c = SE.picToCv(p.x, p.y, W, H); w2 = Math.max(w2, Math.hypot(c.x - px, c.y - py)); }
  ck("(a) cvToPic(picToCv(q)) = q i picToCv(cvToPic(p)) = p, canvas " + W + "x" + H, w1 < 1e-12 && w2 < 1e-9, w1 + " / " + w2);
  const m = SE.PAD, o = SE.picToCv(0, 0, W, H), t = SE.picToCv(1, 1, W, H);
  ck("(a) obraz (0,0) = lewy dolny rog pola, (1,1) = prawy gorny, " + m + " px (sam margines PAD, bez filcu) od krawedzi ekranu (" + W + "x" + H + ")",
     o.x === m && o.y === H - m && t.x === W - m && t.y === m, J([o, t]));
}
ck("(a) rama 6 px (cienka, 2026-10-03), margines ekranu 10 px, promienie 18 / 8, scieg co 14 px, kreska 8 px",
   SE.FR === 6 && SE.PAD === 10 && SE.RAD === 18 && SE.RS === 8 && SE.STITCH === 14 && SE.DASH === 8);
ck("(a) uchwyty: punkt 14 px, zgiecie 9 px, filtr 12 px, chwyt obwiedni 20 px (wiekszy niz pierscien), korektor 18 px",
   SE.R_PT === 14 && SE.R_BEND === 9 && SE.R_FILT === 12 && SE.ENV_HIT === 20 && SE.ENV_HIT > SE.R_PT && SE.EQ_HIT === 18);

// (b) ANALIZA DŹWIĘKU LABA: pasma jak rf-24b _feat, przebieg wyzwalany na rosnącym zerze, poziom RMS
{
  const N = 2048, sr = 48000, hz = sr / N;
  const td = (f, ph, a) => Float32Array.from({ length: N }, (_, n) => Math.sin(2 * Math.PI * f * n / sr + ph) * a);
  const fq = new Uint8Array(N / 2), b0 = Math.round(440 / hz); fq[b0] = 255; fq[b0 - 1] = fq[b0 + 1] = 128;
  const r1 = SE.feat(fq, td(440, 0, .1), sr, N), r2 = SE.feat(fq, td(440, 1.3, .1), sr, N);
  let mi = 0; for (let i = 1; i < 16; i++) if (r1.sp[i] > r1.sp[mi]) mi = i;
  const lo = 60 * Math.pow(200, mi / 16), hi = 60 * Math.pow(200, (mi + 1) / 16), ctr = Math.sqrt(lo * hi);
  ck("(b) feat(sinus 440 Hz): najglosniejsze pasmo obejmuje okolice 440 Hz (srodek w pol oktawy)", lo <= 440 * 1.05 && hi >= 440 * .95 && Math.abs(Math.log2(ctr / 440)) < .5,
     mi + ": " + lo.toFixed(0) + "-" + hi.toFixed(0) + " Hz");
  ck("(b) feat: 16 pasm 0..1 i 64 punkty przebiegu", r1.sp.length === 16 && r1.wf.length === 64 && Array.from(r1.sp).every((v) => v >= 0 && v <= 1));
  const T = td(440, 1.3, .1);
  ck("(b) feat: z = pierwsze rosnace przejscie przez zero", r2.z > 0 && T[r2.z - 1] < 0 && T[r2.z] >= 0, r2.z);
  let dw = 0; for (let i = 0; i < 64; i++) dw = Math.max(dw, Math.abs(r1.wf[i] - r2.wf[i]));
  ck("(b) feat: przebieg wyzwalany na zerze stoi w miejscu (inna faza, ten sam obraz)", dw < .1, dw.toFixed(4));
  const pk = Math.max(...Array.from(r1.wf, Math.abs));
  ck("(b) feat: przebieg znormalizowany do szczytu 1", near(pk, 1, 1e-6), pk);
  ck("(b) feat: poziom = RMS * 3.2 (sinus .1 -> .226)", near(r1.lv, .1 / Math.SQRT2 * 3.2, 1e-3), r1.lv);
  const z = SE.feat(new Uint8Array(N / 2), new Float32Array(N), sr, N);
  ck("(b) feat(cisza): zera bez NaN", Array.from(z.sp).every((v) => v === 0) && Array.from(z.wf).every((v) => v === 0) && z.lv === 0 && z.z === 0);
  ck("(b) rf-24b _feat nadal dzieli widmo tak samo (60*200^(i/16)) i wyzwala na zerze", read("web/js/rf-24b-pad-plate.js").includes("avg(60*Math.pow(200,i/16),60*Math.pow(200,(i+1)/16))") &&
     read("web/js/rf-24b-pad-plate.js").includes("if(td[i-1]<0&&td[i]>=0){z=i;break;}"));
}

// (c) RAMA Z OBSZYCIEM: filc, rowek, ścieg (parzysta liczba kresek, wzór mieści się w obwodzie co do ułamka piksela), nity
ck("(c) rrPerim: prostokat bez zaokraglen i z zaokragleniem 10", SE.rrPerim(100, 50, 0) === 300 && near(SE.rrPerim(100, 50, 10), 300 - 80 + 20 * Math.PI, 1e-9));
for (const [W, H] of [[640, 220], [640, 240], [300, 180], [1100, 220]]) {
  const c = mkCtx(), n = SE.frame(c, W, H, SE.FR), si = SE.FR / 2, P = SE.rrPerim(W - 2 * si, H - 2 * si, SE.RAD - si);
  const dash = c.log.filter((l) => l[0] === "setLineDash"), pat = dash[0] && dash[0][1][0];
  const offs = c.sets.filter((s) => s[0] === "lineDashOffset").map((s) => s[1]);
  const cols = c.sets.filter((s) => s[0] === "strokeStyle").map((s) => s[1]);
  ck("(c) scieg " + W + "x" + H + ": parzysta liczba kresek = 2*round(obwod/28), co ok. 14 px", n === 2 * Math.round(P / 28) && n % 2 === 0 && near(P / n, 14, 1),
     n + " na " + P.toFixed(1) + " px");
  ck("(c) scieg " + W + "x" + H + ": wzor [kreska, przerwa] * n/2 = obwod (bez szwu), dwa przebiegi przesuniete o jedna kreske",
     dash.length === 2 && pat && pat.length === 2 && near((pat[0] + pat[1]) * n / 2, P, 1e-6) && J(dash[1][1][0]) === "[]" &&
     offs.length === 2 && offs[0] === 0 && near(offs[1], P / n, 1e-9), J({ pat, offs }));
  ck("(c) scieg " + W + "x" + H + ": roz #ec1a83 i limonka #a6d861, kreska ok. 8 px (z zaokraglonym koncem)",
     cols.includes("#ec1a83") && cols.includes("#a6d861") && near(pat[0] + 1.6, 8 * (P / n) / 14, 1e-6));
  ck("(c) rama " + W + "x" + H + ": 16 lukow (filc 4, rowek 4, scieg 2x4; cienka rama bez jasnej linii i nitow)", (c.calls.arc || 0) === 16, c.calls.arc);
  const cw = mkCtx(), nw = SE.frame(cw, W, H, 22);
  ck("(c) rama szeroka (FR 22, dla porownania) " + W + "x" + H + ": 32 luki (jasna linia i 4 nity po 3), scieg parzysty", (cw.calls.arc || 0) === 32 && nw % 2 === 0, cw.calls.arc);
}
{
  const c = mkCtx(); SE.frame(c, 640, 220, SE.FR);
  const fills = c.sets.filter((s) => s[0] === "fillStyle").map((s) => s[1]);
  const cw = mkCtx(); SE.frame(cw, 640, 220, 22); const fw = cw.sets.filter((s) => s[0] === "fillStyle").map((s) => s[1]);
  ck("(c) filc grafitowy #23221f, ziarno filcu jako wzor (kafel liczony raz); glowka nita #66625c tylko w szerokiej ramie", fills[0] === "#23221f" && !fills.includes("#66625c") && fw.includes("#66625c") &&
     fills.some((f) => f && f.pattern) && (c.calls.createPattern || 0) === 1);
  const t1 = SE._tile(), t2 = SE._tile();
  ck("(c) kafel ziarna liczony raz (ta sama referencja)", t1 && t1 === t2);
}

// (d) PATCH I/O: readInto / load (przeniesione z rf-25c bez przełączania kanałów)
{
  SE._wt = null; SE._eq = []; SE._envC = [0, 0, 0];
  const p1 = SE.readInto({ wave: "custom" });
  ck("(d) readInto bez narysowanej fali = sinus (od razu slychac)", Array.isArray(p1.wt) && p1.wt.length === 64 && near(p1.wt[16], 1, 1e-9) && near(p1.wt[48], -1, 1e-9));
  const p2 = SE.readInto({ wave: "square" });
  ck("(d) readInto zwyklej fali nie dokleja `wt`, ale zawsze niesie pasma i krzywizny", !("wt" in p2) && J(p2.eq) === "[]" && J(p2.envC) === "[0,0,0]", J(p2));
  const tri = Array.from(SS.shape("triangle"));
  SE.load({ wave: "custom", wt: tri });
  ck("(d) load(custom) wczytuje probki", SE._wt && near(SE._wt[16], 1, 1e-9));
  ck("(d) load -> readInto oddaje te same probki", J(SE.readInto({ wave: "custom" }).wt) === J(tri.map((v) => Math.round(v * 1000) / 1000)));
  SE.load({ wave: "sine" });
  ck("(d) load(brzmienie bez `wt`) czysci rysunek", SE._wt === null);
  SE._eq = [{ f: 1234.56, g: 4.567, q: 1.2345 }];
  ck("(d) readInto: pasma zaokraglone (f calkowite, g 1 miejsce, q 2 miejsca)", J(SE.readInto({ wave: "sine" }).eq) === '[{"f":1235,"g":4.6,"q":1.23}]');
  SE._eq = []; SE._envC = [.123, -.456, 0];
  ck("(d) readInto: krzywizny zawsze, zaokraglone do 2 miejsc", J(SE.readInto({ wave: "sine" }).envC) === "[0.12,-0.46,0]");
  SE._envC = [0, 0, 0];
  const EQ1 = [{ f: 800, g: 4.5, q: 1.2 }];
  SE._eqSel = 0; SE.load({ wave: "sine", eq: EQ1, envC: [.5, -.25, 0] });
  ck("(d) load z `eq` i `envC`: kopia pasm, bez wybranego pasma, krzywizny wczytane", SE._eq.length === 1 && SE._eq[0] !== EQ1[0] && SE._eqSel === -1 && J(SE._envC) === "[0.5,-0.25,0]");
  EQ1[0].g = 9;
  ck("(d) load kopiuje pasma (wczytany patch i panel sa niezalezne)", SE._eq[0].g === 4.5);
  SE.load({ wave: "sine", eq: [{ f: "x", g: 1, q: 1 }, { f: 300, g: 2, q: 1 }, 5, null] });
  ck("(d) load pomija pasmo bez liczb (i smieci)", SE._eq.length === 1 && SE._eq[0].f === 300);
  SE.load({ wave: "sine", eq: Array.from({ length: 6 }, (_, i) => ({ f: 100 * (i + 1), g: 1, q: 1 })) });
  ck("(d) load bierze najwyzej 4 pasma", SE._eq.length === 4 && SE._eq[3].f === 400);
  for (const [nm, v] of [["tekst", "1,2,3"], ["dwie liczby", [.5, .5]], ["liczba tekstem", [.5, "x", 0]]]) {
    SE._envC = [.2, .2, .2]; SE.load({ wave: "sine", envC: v });
    ck("(d) load: envC " + nm + " = proste odcinki", SE._envC.every((x) => x === 0), J(SE._envC));
  }
  SE.load({ wave: "sine", envC: [5, -5, .25] });
  ck("(d) load przycina krzywizny do -1..1", J(SE._envC) === "[1,-1,0.25]", J(SE._envC));
  SE.load({ wave: "sine" });
  ck("(d) brzmienie bez `eq` i `envC` czysci pasma i prostuje obwiednie", SE._eq.length === 0 && SE._envC.every((v) => v === 0));
}

// pomocnicze: zdarzenie wskaźnika i płótno o zadanym rozmiarze
const ev = (x, y, extra) => Object.assign({ pointerId: 7, pointerType: "mouse", button: 0, clientX: x, clientY: y, pd: false, preventDefault() { this.pd = true; } }, extra || {});
const pane = (W, H) => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }), setPointerCapture() {} });

// (e) FALA: rysowanie z interpolacją, pierwsza edycja wbudowanej fali, słupki, Wygładź / Wyczyść
{
  const W = 640, H = 220, sel = els.get("seWave"), P = (u, v) => SE.picToCv(u, v, W, H);
  SE._ov = pane(W, H); SE.ch = "wave"; SE.mode = "draw"; SE._wt = null; SE._pen = null; sel.value = "sawtooth";
  const saw = Array.from(SS.shape("sawtooth")), lp0 = lpc;
  const a = P(6 / 63, SE.DRAW_Y + .5 * SE.DRAW_A);
  SE._down(ev(a.x, a.y));
  ck("(e) pierwsza kreska na wbudowanej fali: wybiera Wlasna i zaczyna OD tej fali (pila), probka 6 = .5",
     sel.value === "custom" && SE._wt && near(SE._wt[6], .5, 1e-6) && near(SE._wt[50], saw[50], 1e-6) && SE._wt !== SS.shape("sawtooth") && lpc === lp0 + 1, sel.value);
  const b = P(38 / 63, SE.DRAW_Y - .5 * SE.DRAW_A);
  SE._move(ev(b.x, b.y));
  let ie = 0; for (let j = 6; j <= 38; j++) ie = Math.max(ie, Math.abs(SE._wt[j] - (.5 - (j - 6) / 32)));
  ck("(e) szybkie pociagniecie: probki 7..37 wypelnione prosta (bez zebow)", ie < 1e-6 && near(SE._wt[22], 0, 1e-6), ie);
  ck("(e) probki poza kreska bez zmian, kolejna zmiana zgloszona labowi", near(SE._wt[50], saw[50], 1e-6) && lpc === lp0 + 2);
  SE._up(ev(b.x, b.y));
  ck("(e) puszczenie konczy kreske", SE._pen === null);
  const r = SE.readInto({ wave: "custom" });
  ck("(e) narysowana fala trafia do patcha (3 miejsca)", r.wt.length === 64 && r.wt[22] === 0 && r.wt[6] === .5 && r.wt[38] === -.5);
  // filc ramy to osobny canvas bez nasluchiwaczy (h); tu: punkt dalej niz margines .05 obrazu poza polem nic nie rysuje
  const before = Array.from(SE._wt); const e0 = ev(-40, -40); SE._down(e0);
  ck("(e) punkt poza polem i jego marginesem nic nie rysuje", SE._pen === null && !e0.pd && J(Array.from(SE._wt)) === J(before));
  // słupki harmonicznych
  SE.setMode("harm");
  ck("(e) tryb Harmoniczne: slupki z fali na ekranie (16, najglosniejszy = 1)", SE.mode === "harm" && SE._bars().length === 16 && near(Math.max(...SE._bars()), 1, 1e-6));
  const c = P(2.5 / 16, SE.BAR0 + .8 * SE.BARH), d = P(6.5 / 16, SE.BAR0 + .2 * SE.BARH);
  SE._down(ev(c.x, c.y)); SE._move(ev(d.x, d.y)); SE._up(ev(d.x, d.y));
  const h = SE._harm;
  ck("(e) slupki: 2 -> .8, 6 -> .2, przeskoczone 3..5 wypelnione prosta", near(h[2], .8, 1e-6) && near(h[6], .2, 1e-6) && near(h[3], .65, 1e-6) && near(h[4], .5, 1e-6) && near(h[5], .35, 1e-6),
     Array.from(h.slice(2, 7)).map((v) => v.toFixed(3)).join(","));
  let fe = 0; const fh = SS.fromHarmonics(h); for (let i = 0; i < 64; i++) fe = Math.max(fe, Math.abs(SE._wt[i] - fh[i]));
  ck("(e) slupki generuja fale (fromHarmonics) — D3: zapisuje sie zawsze 64 probki", fe < 1e-9, fe);
  SE.setMode("draw");
  const w0 = Array.from(SE._wt); SE._smooth();
  let se = 0; const sm = SS.smooth(w0); for (let i = 0; i < 64; i++) se = Math.max(se, Math.abs(SE._wt[i] - sm[i]));
  ck("(e) Wygladz = jedno przejscie [1/4 1/2 1/4] z zawinieciem", se < 1e-7, se);
  sel.value = "square"; SE._clear();
  ck("(e) Wyczysc = czysty sinus i fala Wlasna", sel.value === "custom" && near(SE._wt[16], 1, 1e-6) && near(SE._wt[0], 0, 1e-6));
  sel.value = "triangle"; SE._wt = null;
  ck("(e) panel pokazuje wybrana wbudowana fale jako podglad, dopoki nikt jej nie dotknie", J(Array.from(SE._curve())) === J(Array.from(SS.shape("triangle"))) && !SE._isCustom());
  sel.value = "sawtooth"; SE._wt = null; SE._harm = null; SE._ov = null;
}

// (f) KOREKTOR: pierścienie pod palcem, kółko, dwuklik, Q, limit pasm, narzędzia
{
  const W = 640, H = 220;
  SE._ov = pane(W, H); SE.ch = "eq"; SE._eq = []; SE._eqSel = -1; SE._pen = null;
  const lp0 = lpc, at = SE.picToCv(SS.xf(1000), SS.gy(6), W, H);
  SE._down(ev(at.x, at.y));
  ck("(f) dotkniecie pustego pola = nowe pasmo w tym miejscu (Q 1), wybrane, lab wie",
     SE._eq.length === 1 && near(SE._eq[0].f, 1000, .5) && near(SE._eq[0].g, 6, .01) && SE._eq[0].q === 1 && SE._eqSel === 0 && lpc > lp0, J(SE._eq));
  const to = SE.picToCv(SS.xf(250), SS.gy(-3), W, H);
  SE._move(ev(to.x, to.y)); SE._up(ev(to.x, to.y));
  ck("(f) przeciagniecie: x -> f (log), y -> g", near(SE._eq[0].f, 250, .5) && near(SE._eq[0].g, -3, .01) && SE._pen === null, J(SE._eq));
  SE._down(ev(to.x + 10, to.y)); SE._move(ev(to.x + 10, to.y)); SE._up(ev(to.x + 10, to.y));
  ck("(f) chwyt 10 px obok srodka: to samo pasmo, pierscien nie skacze pod palec",
     SE._eq.length === 1 && SE._eqSel === 0 && near(SE._eq[0].f, 250, 1e-6) && near(SE._eq[0].g, -3, 1e-6), J(SE._eq));
  SE._down(ev(to.x + 30, to.y)); SE._up(ev(to.x + 30, to.y));
  ck("(f) 30 px od pierscienia Q 1 (dalej niz jego zasieg 25 px) = nowe pasmo", SE._eq.length === 2 && SE._eqSel === 1, J(SE._eq));
  const q0 = SE._eq[0].q, e1 = ev(to.x, to.y, { deltaY: -100 }); SE._eqWheel(e1);
  ck("(f) kolko w gore nad pierscieniem: Q x 1.12, wybiera to pasmo, blokuje przewijanie", near(SE._eq[0].q, q0 * 1.12, 1e-9) && SE._eqSel === 0 && e1.pd);
  const e2 = ev(5, 5, { deltaY: 100 }); SE._eqWheel(e2);
  ck("(f) kolko poza pierscieniem dziala na wybrane pasmo", near(SE._eq[0].q, q0, 1e-9) && e2.pd);
  SE._eqSel = -1; const e3 = ev(5, 5, { deltaY: 100 }); SE._eqWheel(e3);
  ck("(f) kolko bez pierscienia i bez wyboru: strona sie przewija (bez preventDefault)", !e3.pd && near(SE._eq[0].q, q0, 1e-9));
  SE.ch = "wave"; const e4 = ev(to.x, to.y, { deltaY: 100 }); SE._eqWheel(e4); SE.ch = "eq";
  ck("(f) kolko nad innym panelem nic nie robi", !e4.pd && near(SE._eq[0].q, q0, 1e-9));
  for (let i = 0; i < 60; i++) SE._eqQ(0, SE.EQ_QBTN);
  ck("(f) Q przyciete do 12", SE._eq[0].q === 12, SE._eq[0].q);
  for (let i = 0; i < 60; i++) SE._eqQ(0, 1 / SE.EQ_QBTN);
  ck("(f) Q przyciete do 0.3", SE._eq[0].q === .3, SE._eq[0].q);
  SE._eqDbl(ev(to.x, to.y));
  ck("(f) dwuklik na pierscieniu usuwa pasmo", SE._eq.length === 1 && SE._eqSel === -1, J(SE._eq));
  SE._eq = []; for (let i = 0; i < 5; i++) SE._eqAdd();
  ck("(f) + Pasmo: przy 1 kHz / 0 dB / Q 1, najwyzej 4", SE._eq.length === 4 && SE._eq.every((b) => b.f === 1000 && b.g === 0 && b.q === 1) && SE._eqSel === 3);
  const mid = SE.picToCv(.2, .3, W, H); SE._down(ev(mid.x, mid.y)); SE._up(ev(mid.x, mid.y));
  ck("(f) przy 4 pasmach dotkniecie pustego pola nie dodaje piatego, tylko gasi wybor", SE._eq.length === 4 && SE._eqSel === -1);
  SE._eqZero();
  ck("(f) Wyzeruj usuwa wszystkie pasma", SE._eq.length === 0 && SE._eqSel === -1);
  const e5 = ev(3, 3); SE._down(e5);
  ck("(f) dotkniecie marginesu ekranu poza polem nie dodaje pasma (filc ramy to osobny canvas)", SE._eq.length === 0 && !e5.pd);
  // runda naprawcza 2026-10-02: zasięg chwytu rośnie z pierścieniem (max(EQ_HIT, promień + 4)), więc klik w LINIĘ
  // pierścienia chwyta pasmo przy każdym Q (szeroki pierścień ma do 24 px, a chwyt był stały 18 px)
  for (const q of [.3, .7, 1, 2, 4]) {
    SE._eq = [{ f: 1000, g: 0, q }]; SE._eqSel = -1; SE._pen = null;
    const c = SE._eqAt(SE._eq[0], W, H), r = SS.eqR(q), reach = Math.max(SE.EQ_HIT, r + 4);
    const onLine = SE._eqHit({ px: c.x + r, py: c.y, W, H }), past = SE._eqHit({ px: c.x + reach + 2, py: c.y, W, H });
    SE._down(ev(c.x, c.y - r)); SE._up(ev(c.x, c.y - r));
    ck("(f) Q " + q + ": klik w linie pierscienia (promien " + r.toFixed(1) + " px) chwyta pasmo, nie dodaje nowego; za zasiegiem " + reach.toFixed(1) + " px juz nie",
       onLine === 0 && past === -1 && SE._eq.length === 1 && SE._eqSel === 0 && SE._eq[0].f === 1000, J({ onLine, past, n: SE._eq.length }));
  }
  SE._eq = [{ f: 1000, g: 0, q: .3 }, { f: 1250, g: 0, q: 4 }];
  const cn = SE._eqAt(SE._eq[1], W, H);
  ck("(f) dwa pierscienie: klik przy srodku waskiego pasma wybiera je, nie szeroki pierscien obok", SE._eqHit({ px: cn.x + 2, py: cn.y, W, H }) === 1);
  SE._eq = []; SE._eqSel = -1; SE._pen = null;
  // narzędzia panelu: wyszarzone, gdy nie mają sensu
  const strip = mkStrip(); strip.innerHTML = SE.TOOLS.eq; const ed0 = SE._ed;
  SE._ed = { eq: { tools: strip } };
  const st = () => ["eq-add", "eq-del", "eq-qm", "eq-qp", "eq-zero"].map((a) => (strip.btns.find((b) => b.dataset.act === a).disabled ? 0 : 1)).join("");
  SE._syncTools(); ck("(f) narzedzia bez pasm: aktywne tylko + Pasmo", st() === "10000", st());
  SE._eq = [{ f: 1000, g: 0, q: 1 }]; SE._eqSel = 0; SE._syncTools(); ck("(f) narzedzia z wybranym pasmem: wszystkie aktywne", st() === "11111", st());
  SE._eq[0].q = 12; SE._syncTools(); ck("(f) narzedzia: Q = 12 wylacza Q +", st() === "11101", st());
  SE._eq = [1, 2, 3, 4].map(() => ({ f: 1000, g: 0, q: 1 })); SE._eqSel = -1; SE._syncTools();
  ck("(f) narzedzia: 4 pasma bez wyboru = tylko Wyzeruj", st() === "00001", st());
  SE._ed = ed0; SE._ov = null; SE._eq = []; SE._eqSel = -1; SE._pen = null; SE._hover = null;
}

// (g) OBWIEDNIA: suwaki jako jedyne źródło prawdy, uchwyty piszą value + input, skala zamrożona na czas ciągnięcia
{
  const E = (id) => els.get(id), W = 640, H = 240;
  SE._ov = pane(W, H); SE.ch = "env"; SE._envC = [0, 0, 0]; SE._pen = null; SE._hover = null;
  const vals = SE._envVals();
  ck("(g) panel czyta suwaki (s, 0..1, +-1) i typ", vals.legato && vals.att === .012 && vals.dec === .34 && vals.sus === 1 && vals.rel === .18 && vals.fEnv === 0 && vals.fEnvT === .2, J(vals));
  ck("(g) zapis suwaka: przyciecie do max i min, krok 10 ms, ta sama wartosc bez zdarzenia",
     (SE._envSet("seAtt", 1234.6), E("seAtt").value === "500") && (SE._envSet("seDec", 7), E("seDec").value === "60") &&
     (SE._envSet("seDec", 347), E("seDec").value === "350") && (() => { const n = E("seDec").ev; SE._envSet("seDec", 351); return E("seDec").ev === n; })());
  ck("(g) zapis suwaka wysyla zdarzenie input (etykieta, pokretlo i lab ida za nim)", E("seAtt").last === "input" && E("seAtt").ev >= 1);
  E("seAtt").value = "12"; E("seDec").value = "340";
  const LA = SE._envLay(SE._envVals()), gA = SE.picToCv(LA.a.x, LA.a.y, W, H);
  SE._down(ev(gA.x + 4, gA.y + 3));
  ck("(g) dotkniecie szczytu ataku chwyta punkt a, skala zamrozona", SE._pen && SE._pen.env === "a" && SE._pen.spu === LA.spu, J(SE._pen && { env: SE._pen.env, spu: SE._pen.spu }));
  const p0 = SE.cvToPic(gA.x + 4, gA.y + 3, W, H), p1 = SE.cvToPic(gA.x + 54, gA.y + 3, W, H);
  SE._move(ev(gA.x + 54, gA.y + 3));
  const attWant = Math.round((.012 + (p1.x - p0.x) * LA.spu) * 1000);
  ck("(g) atak: x -> seAtt (ms) o przesuniecie wskaznika na zamrozonej skali", E("seAtt").value === String(attWant), E("seAtt").value + " vs " + attWant);
  const LAd = SE._envLay(SE._envVals()), gA2 = SE.picToCv(LAd.a.x, LAd.a.y, W, H);
  ck("(g) atak: w trakcie ciagniecia punkt zostaje pod palcem (+-1.5 px)", Math.abs(gA2.x - (gA.x + 50)) < 1.5, (gA2.x - gA.x).toFixed(2));
  SE._up(ev(gA.x + 54, gA.y + 3));
  ck("(g) puszczenie zwalnia skale (os sie dopasowuje)", SE._pen === null && SE._envLay(SE._envVals()).spu !== LA.spu);
  E("seAtt").value = "12";
  const LD = SE._envLay(SE._envVals()), gD = SE.picToCv(LD.d.x, LD.d.y, W, H);
  SE._down(ev(gD.x, gD.y)); SE._move(ev(gD.x + 30, gD.y + 60));
  const q0 = SE.cvToPic(gD.x, gD.y, W, H), q1 = SE.cvToPic(gD.x + 30, gD.y + 60, W, H);
  const decWant = Math.round((.34 + (q1.x - q0.x) * LD.spu) * 100) * 10, susWant = Math.round((LD.d.y + q1.y - q0.y - .06) / .88 * 100);
  ck("(g) koniec zaniku: x -> seDec (krok 10 ms), y -> seSus", E("seDec").value === String(decWant) && E("seSus").value === String(susWant),
     E("seDec").value + "/" + E("seSus").value + " vs " + decWant + "/" + susWant);
  SE._up(ev(0, 0));
  const LR = SE._envLay(SE._envVals()), gR = SE.picToCv(LR.r.x, LR.r.y, W, H);
  SE._down(ev(gR.x - 3, gR.y)); SE._move(ev(gR.x - 43, gR.y));
  ck("(g) koniec zwolnienia: x -> seRel (krotsze w lewo)", SE._pen && SE._pen.env === "r" && +E("seRel").value < 180, E("seRel").value);
  SE._up(ev(0, 0));
  const LF = SE._envLay(SE._envVals()), hF = SS.envHandles(LF, SE._envC, 0, .2).find((h) => h.id === "f"), gF = SE.picToCv(hF.x, hF.y, W, H);
  SE._down(ev(gF.x, gF.y)); SE._move(ev(gF.x + 20, gF.y - 40));
  ck("(g) pierscien filtra: w gore = dodatnia obwiednia filtra, w prawo = dluzszy czas", SE._pen && SE._pen.env === "f" && +E("seFEnv").value > 0 && +E("seFEnvT").value > 200,
     E("seFEnv").value + " / " + E("seFEnvT").value);
  SE._up(ev(0, 0));
  E("seSus").value = "50"; const lp1 = lpc;
  const LC = SE._envLay(SE._envVals()), hC = SS.envHandles(LC, SE._envC, +E("seFEnv").value / 100, +E("seFEnvT").value / 1000).find((h) => h.id === "c1");
  const gC = SE.picToCv(hC.x, hC.y, W, H);
  SE._down(ev(gC.x, gC.y)); SE._move(ev(gC.x, gC.y - 25));
  const LC2 = SE._envLay(SE._envVals()), hC2 = SS.envHandles(LC2, SE._envC, 0, .2).find((h) => h.id === "c1"), gC2 = SE.picToCv(hC2.x, hC2.y, W, H);
  ck("(g) zgiecie zaniku: ciagniecie w strone poczatku daje c > 0 (lagodniej niz dzis)", SE._envC[1] > 0 && SE._envC[0] === 0 && SE._envC[2] === 0, J(SE._envC));
  ck("(g) zgiecie: pierscien laduje pod palcem (+-1.5 px)", Math.abs(gC2.y - (gC.y - 25)) < 1.5, (gC2.y - gC.y).toFixed(2));
  ck("(g) zgiecie: zaokraglone do 2 miejsc i zglasza zmiane labowi", Math.round(SE._envC[1] * 100) / 100 === SE._envC[1] && lpc > lp1);
  SE._up(ev(0, 0));
  SE._envDbl(ev(gC2.x, gC2.y));
  ck("(g) dwuklik na pierscieniu zgiecia przywraca odcinkowi domyslny ksztalt (c 0)", SE._envC[1] === 0);
  const top = SE.picToCv(.6, 1.04, W, H); SE._down(ev(top.x, top.y));
  ck("(g) dotkniecie pustego miejsca nic nie chwyta i nic nie dodaje", SE._pen === null && SE._envC.every((v) => v === 0));
  // narzędzia panelu
  const strip = mkStrip(); strip.innerHTML = SE.TOOLS.env; const ed0 = SE._ed; SE._ed = { env: { tools: strip } };
  const bt = (a) => strip.btns.find((b) => b.dataset.act === a);
  E("seFEnv").value = "0"; SE._envC = [0, 0, 0]; SE._syncTools();
  ck("(g) narzedzia: bez zgiec i bez obwiedni filtra oba wyszarzone", bt("env-reset").disabled && bt("env-nofilt").disabled);
  SE._envC = [.3, 0, 0]; E("seFEnv").value = "40"; SE._syncTools();
  ck("(g) narzedzia: zgiecie i obwiednia filtra wlaczaja Domyslny ksztalt i Bez obwiedni filtra", !bt("env-reset").disabled && !bt("env-nofilt").disabled);
  const lp2 = lpc; SE._envReset(); SE._envNoFilt();
  ck("(g) Domyslny ksztalt zeruje krzywizny (lab o tym wie), Bez obwiedni filtra ustawia suwak na 0", SE._envC.every((v) => v === 0) && lpc > lp2 && E("seFEnv").value === "0");
  SE._ed = ed0;
  const sv = { legato: true, wave: "sine", envC: [.5, 0, 0] }; Object.assign(sv, SE.readInto({ legato: true, wave: "sine" }));
  ck("(g) zapis po Domyslny ksztalt nadpisuje `envC` brzmienia zrodlowego zerami (merge-preserve)", J(sv.envC) === "[0,0,0]");
  for (const [id, v] of [["seAtt", "12"], ["seDec", "340"], ["seSus", "100"], ["seRel", "180"], ["seFEnv", "0"], ["seFEnvT", "200"]]) E(id).value = v;
  SE._ov = null; SE._pen = null; SE._hover = null; SE._envC = [0, 0, 0];
}

// (h) MONTAŻ W DOM-ie, wskaźnik przez prawdziwe nasłuchiwacze, rysowanie, analizator na busie laba
//     (runda naprawcza 2026-10-02: panel = rama .ce-frame pod ekranem .ce-cv w .ce-stage, ekran z klawiaturą,
//     analizator wspólny z lampą: b._plateAn)
{
  const lp0 = lpc, c0 = createdCanvases;
  SE.init();
  const ce = (k) => slots.find((s) => s.dataset.editor === k).children[0];
  ck("(h) init montuje trzy panele w kontenerach i zdejmuje im hidden", SE._inited && slots.every((s) => s.hidden === false && s.children.length === 1 && s.children[0].className === "ce"),
     J(slots.map((s) => [s.hidden, s.children.length])));
  const stages = ["wave", "eq", "env"].map((k) => ce(k).children[1]);
  const frs = stages.map((s) => s.children[0]), cvs = stages.map((s) => s.children[1]), hps = ["wave", "eq", "env"].map((k) => ce(k).children[2]);
  ck("(h) kazdy panel: pasek .ce-tools, pod nim .ce-stage.ce-<k> z rama .ce-frame (aria-hidden) i ekranem .ce-cv na wierzchu",
     ["wave", "eq", "env"].every((k, i) => ce(k).children[0].className === "ce-tools" && stages[i].className === "ce-stage ce-" + k &&
       frs[i].tagName === "canvas" && frs[i].className === "ce-frame" && frs[i].attrs["aria-hidden"] === "true" && cvs[i].tagName === "canvas" && cvs[i].className === "ce-cv"),
     J(stages.map((s) => s.className)));
  ck("(h) ekran przyjmuje klawiature: tabindex 0, role application, aria-label Edytor fali / Korektor / Obwiednia",
     cvs.every((c) => c.tabIndex === 0 && c.attrs.role === "application") && J(cvs.map((c) => c.attrs["aria-label"])) === J(["Edytor fali", "Korektor", "Obwiednia"]));
  ck("(h) aria-describedby ekranu wskazuje ukryty span .ce-sr z opisem skrotow (HELP)",
     ["wave", "eq", "env"].every((k, i) => hps[i].className === "ce-sr" && hps[i].id === "ceHelp-" + k && cvs[i].attrs["aria-describedby"] === hps[i].id && hps[i].textContent === SE.HELP[k]),
     J(cvs.map((c) => c.attrs["aria-describedby"])));
  ck("(h) rama nie ma zadnych nasluchiwaczy (dotyk na filcu przewija strone), ekran ma wskaznik i klawiature",
     frs.every((f) => !Object.keys(f.L).length) && cvs.every((c) => (c.L.pointerdown || []).length === 1 && (c.L.keydown || []).length === 1 && (c.L.focus || []).length === 1 && (c.L.blur || []).length === 1));
  const strips = ["wave", "eq", "env"].map((k) => ce(k).children[0]);
  ck("(h) narzedzia: Fala = Rysuj/Harmoniczne, Wygladz, Wyczysc; Korektor = 5 klawiszy pasm; Obwiednia = 2 klawisze",
     J(strips.map((s) => s.btns.map((b) => b.text))) === J([["Rysuj", "Harmoniczne", "Wygładź", "Wyczyść"], ["+ Pasmo", "Usuń pasmo", "Q −", "Q +", "Wyzeruj"], ["Domyślny kształt", "Bez obwiedni filtra"]]),
     J(strips.map((s) => s.btns.map((b) => b.text))));
  ck("(h) kolko korektora nie jest pasywne (preventDefault blokuje przewijanie)", (cvs[1].L.wheel || []).length === 1 && cvs[1].L.wheel[0].o && cvs[1].L.wheel[0].o.passive === false && !cvs[0].L.wheel);
  // wskaźnik przez nasłuchiwacze: pasmo w korektorze, w tym czasie inne panele nie przejmują wskaźnika
  SE._eq = []; SE._wt = null;
  const EW = cvs[1].clientWidth, EH = cvs[1].clientHeight, at = SE.picToCv(SS.xf(1000), SS.gy(6), EW, EH);
  cvs[1].fire("pointerdown", ev(at.x, at.y));
  ck("(h) pointerdown na korektorze: nowe pasmo, panel = eq, pioro przypisane do panelu", SE._eq.length === 1 && near(SE._eq[0].f, 1000, .5) && SE.ch === "eq" && SE._pen && SE._pen.k === "eq" && lpc > lp0, J(SE._eq));
  const w0 = SE._wt; cvs[0].fire("pointermove", ev(100, 100)); cvs[0].fire("pointerdown", ev(100, 100));
  ck("(h) w trakcie ciagniecia w korektorze panel fali nic nie robi", SE._wt === w0 && SE.ch === "eq" && SE._pen.k === "eq");
  cvs[0].fire("pointerup", ev(100, 100));
  ck("(h) puszczenie (nawet nad innym panelem) konczy ciagniecie", SE._pen === null);
  strips[1].fire("click", { target: strips[1].btns[0] });
  ck("(h) klik + Pasmo w pasku korektora dodaje pasmo", SE._eq.length === 2 && SE._eqSel === 1);
  strips[0].fire("click", { target: strips[0].btns[1] });
  ck("(h) klik Harmoniczne przelacza tryb i aria-pressed", SE.mode === "harm" && strips[0].btns[1].attrs["aria-pressed"] === "true" && strips[0].btns[0].attrs["aria-pressed"] === "false");
  strips[0].fire("click", { target: strips[0].btns[0] });
  cvs[2].fire("pointerleave", {}); cvs[1].fire("pointerleave", {});
  ck("(h) zjechanie z panelu gasi jego krzyzyk", SE._hover === null);
  // rysowanie: trzy widoczne panele; rama rysowana na własnym canvasie raz na rozmiar (16 łuków: frame()), ekran co raz.
  // Render ekranu liczony po clearRect (jeden na render); od E7 tryb bez WebGL2 dokłada drugi gradient (winieta _crt2d),
  // więc createRadialGradient przestał być licznikiem renderów
  const scr = (c) => (c._ctx ? (c._ctx.calls.clearRect || 0) : 0), arcs = (c) => (c._ctx ? (c._ctx.calls.arc || 0) : 0);
  clock += 50; const r1 = SE.draw();
  const made = createdCanvases - c0;
  ck("(h) draw: trzy ekrany narysowane, ekran = stage minus 2 x " + SE.FR + " px filcu, w pikselach urzadzenia (DPR 1.5)",
     r1 === true && cvs.every((c) => scr(c) === 1) && cvs[0].width === 894 && cvs[0].height === 264 && cvs[2].height === 294, J({ w: cvs[0].width, h: cvs[0].height, he: cvs[2].height }));
  ck("(h) rama na swoim canvasie: rozmiar stage'a w pikselach urzadzenia, narysowana raz (16 lukow frame())",
     frs.every((f) => arcs(f) === 16) && frs[0].width === 960 && frs[0].height === 330 && frs[2].height === 360, J(frs.map(arcs)));
  // 3 ramy + 3 ekrany (montaż); rysowanie nie tworzy już żadnej kopii poza ekranem; kafel ziarna powstał w (c)
  ck("(h) canvasy: 3 ramy + 3 ekrany z montazu, rysowanie nie tworzy nowych (kafel ziarna wspolny)", made === 6 && !!SE._tl, made);
  ck("(h) ekran nie rysuje ramy (zadnych lukow ani kopii), tylko ekran i krzywe", cvs.every((c) => !c._ctx.calls.drawImage), J(cvs.map((c) => c._ctx.calls.drawImage || 0)));
  ck("(h) rysowanie bez wyjatku (zadnego ostrzezenia)", !SE._warned);
  SE._req(); clock += 50; SE.draw();
  ck("(h) drugi raz: ramy bez zmian (ten sam rozmiar), wszystkie trzy ekrany narysowane ponownie", frs.every((f) => arcs(f) === 16) && cvs.every((c) => scr(c) === 2));
  ck("(h) ten sam znacznik klatki = nic (petla padow + wlasna klatka w jednej klatce ekranu)", SE.draw() === true && cvs.every((c) => scr(c) === 2));
  const hint = cvs[0]._ctx.log.filter((l) => l[0] === "fillText").map((l) => l[1][0]);
  ck("(h) panel fali bez wskaznika pokazuje podpowiedz", hint.includes("Narysuj jeden okres fali") || hint.includes("Ciągnij słupki: głośność kolejnych harmonicznych"), J(hint.slice(0, 4)));
  // krzyżyk i odczyty na każdym panelu, tryb słupków, zgięcia, filtr: bez wyjątku
  SE.setMode("harm"); els.get("seFEnv").value = "-40"; SE._envC = [-.5, .3, .2];
  for (const [k, cv] of [["wave", cvs[0]], ["eq", cvs[1]], ["env", cvs[2]]]) {
    const W = cv.clientWidth, H = cv.clientHeight, p = SE.cvToPic(200, H / 2, W, H); SE._hover = { k, px: 200, py: H / 2, W, H, pic: p };
    SE._req(k); clock += 20; SE.draw(); }
  const cross = cvs[2]._ctx.log.filter((l) => l[0] === "fillText").map((l) => String(l[1][0]));
  ck("(h) krzyzyk z odczytem na kazdym panelu, slupki, zgiecia i filtr rysuja sie bez wyjatku", !SE._warned && cross.some((t) => / ms · /.test(t)), J(cross.slice(-3)));
  SE.setMode("draw"); els.get("seFEnv").value = "0"; SE._envC = [0, 0, 0]; SE._hover = null;
  // tylko widoczne panele: zwinięta karta korektora nie jest rysowana
  cvs[1].offsetParent = null; const e0 = scr(cvs[1]), w0d = scr(cvs[0]); SE._req(); clock += 20; SE.draw();
  ck("(h) zwinieta karta (offsetParent null) = panel nierysowany, pozostale tak", scr(cvs[1]) === e0 && scr(cvs[0]) === w0d + 1);
  cvs[1].offsetParent = {};
  // zmiana rozmiaru: ResizeObserver nie istnieje w vm, więc jak jego wywołanie — E.fs = null; rama rysuje się od nowa
  SE._ed.wave.fs = null; cvs[0].W = 700; frs[0].W = 700; SE._req("wave"); clock += 20; SE.draw();
  ck("(h) nowy rozmiar: rama rysowana od nowa na nowy rozmiar, ekran tez", arcs(frs[0]) === 32 && frs[0].width === 1050 && cvs[0].width === Math.round(656 * 1.5));
  cvs[0].W = 640; frs[0].W = 640; SE._ed.wave.fs = null; SE._req(); clock += 20; SE.draw();
  box.open = false; ck("(h) zwiniety edytor = draw nic nie robi (false)", SE.draw() === false); box.open = true;
  // analizator: ten sam co lampy (b._plateAn), tylko gdy bus laba istnieje; lampa zrobiła go pierwsza = żadnego drugiego
  let made2 = 0; const conns = [], disc = [];
  const mkAn = () => { made2++; return { fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 1024,
    getByteFrequencyData(a) { a.fill(0); for (let i = 15; i <= 24; i++) a[i] = 255; }, getFloatTimeDomainData(a) { for (let i = 0; i < a.length; i++) a[i] = Math.sin(2 * Math.PI * 440 * i / 48000) * .2; } }; };
  ctx.PadAudio = { ctx: { state: "running", sampleRate: 48000, createAnalyser: mkAn }, buses: {} };
  SE._F = null; SE._req(); clock += 20; SE.draw();
  ck("(h) bez busa laba analizator nie powstaje (i busa nie tworzy)", made2 === 0 && !("__lab__" in ctx.PadAudio.buses));
  const bus = { master: { connect: (n) => conns.push(n), disconnect: (n) => disc.push(n) }, voices: {} };
  ctx.PadAudio.buses.__lab__ = bus;
  for (let i = 0; i < 4; i++) { clock += 20; SE.draw(); }
  ck("(h) bus laba bez analizatora lampy: panele robia JEDEN jak PadPlate._feat (b._plateAn, fftSize 2048, wygladzanie .55, bufory _plateFq/_plateTd)",
     made2 === 1 && conns.length === 1 && bus._plateAn === conns[0] && bus._plateAn.fftSize === 2048 && bus._plateAn.smoothingTimeConstant === .55 &&
     bus._plateFq && bus._plateFq.length === 1024 && bus._plateTd && bus._plateTd.length === 2048 && !("_A" in SE));
  ck("(h) zywe warstwy: widmo i poziom rosna z dzwiekiem (wygladzane w czasie)", SE._F && Math.max(...SE._F.sp) > .05 && SE._F.lv > .05, SE._F && SE._F.lv.toFixed(3));
  SE.sleep();
  ck("(h) sleep (labStopAll): panele niczego nie odpinaja (analizator nalezy do busa; disposeBus odpina master)", disc.length === 0 && bus._plateAn === conns[0]);
  // lampa (rf-24b _feat) zrobiła analizator pierwsza: panele go czytają, drugiego nie ma
  let reads = 0; const lampAn = Object.assign(mkAn(), { fftSize: 2048 }); made2--;
  const rd = lampAn.getByteFrequencyData; lampAn.getByteFrequencyData = function (a) { reads++; return rd.call(this, a); };
  const bus2 = { master: { connect: (n) => conns.push(n), disconnect: (n) => disc.push(n) }, voices: {},
    _plateAn: lampAn, _plateFq: new Uint8Array(1024), _plateTd: new Float32Array(2048) };
  ctx.PadAudio.buses.__lab__ = bus2; const cn0 = conns.length; clock += 20; SE.draw();
  ck("(h) nowy bus z analizatorem lampy (b._plateAn): panele czytaja ten sam, zaden drugi AnalyserNode", made2 === 1 && conns.length === cn0 && reads === 1);
  ctx.PadAudio.ctx.state = "suspended"; const r0 = reads; clock += 20; SE.draw();
  ck("(h) zatrzymany AudioContext = analizator nieczytany", reads === r0 && made2 === 1); ctx.PadAudio.ctx.state = "running";
  delete ctx.PadAudio; SE._F = null; SE._wasLive = false;
}

// (i) OKABLOWANIE: dashboard, CSS, haki w rf-25, lampa bez edycji, pary i18n
{
  const iE = dash.indexOf('<script src="/web/js/rf-25e-curve-editors.js">'), iD = dash.indexOf('<script src="/web/js/rf-25d-sound-rack.js">'), iC = dash.indexOf('<script src="/web/js/rf-25c-sound-screens.js">');
  const c30 = dash.indexOf('href="/web/css/30-sound-rack.css"'), c31 = dash.indexOf('href="/web/css/31-curve-editors.css"');
  ck("(i) dashboard: rf-25e dolaczony po rf-25d (i po rf-25c), css/31 po css/30", iC > 0 && iD > iC && iE > iD && c30 > 0 && c31 > c30);
  const eds = [...dash.matchAll(/<div class="se-sec-editor" data-editor="(\w+)"( hidden)?><\/div>/g)].map((m) => m[1]);
  ck("(i) dashboard: trzy kontenery na panele (wave, eq, env) — montuje je rf-25e", J(eds) === J(["wave", "eq", "env"]), J(eds));
  // 10-20: asercja mowila "CRLF bez golych LF" i byla czerwona, bo .gitattributes od pierwszego commita mapuje
  // *.html na eol=lf - git ZAWSZE wypisuje ten plik z LF, wiec zadna zmiana po stronie pliku tego nie odwroci.
  // Pilnujemy wiec tego, co naprawde warto: jednolitych koncow linii, czyli czystego LF bez CR.
  ck("(i) dashboard: czysty LF bez CRLF (.gitattributes: *.html text eol=lf)", !/\r/.test(dash));
  const css = read("web/css/31-curve-editors.css");
  ck("(i) css/31: rama z marginesem i cieniem 0 4px, panel (stage) 220 px (obwiednia 240), na waskim ekranie 180 / 200 px",
     css.includes(".ce{margin:10px 11px 12px;") && css.includes("box-shadow:0 4px 0 rgba(120,90,40,.12)") && /\.ce-stage\{position:relative;height:220px;/.test(css) &&
     css.includes(".ce-stage.ce-env{height:240px}") && css.includes("@media (max-width:820px){.ce-stage{height:180px}.ce-stage.ce-env{height:200px}}"));
  // dotyk: ekran przechwytuje palec, filc ramy przewija stronę; wsunięcie ekranu = SE.FR (zmieniane razem)
  const cvRule = (/\.ce-cv\{([^}]*)\}/.exec(css) || [, ""])[1], frRule = (/\.ce-frame\{([^}]*)\}/.exec(css) || [, ""])[1];
  ck("(i) css/31: ekran .ce-cv wsuniety o filc (" + SE.FR + " px = SE.FR z kazdej strony) z touch-action:none, rama .ce-frame na calym stage z touch-action:auto",
     cvRule.includes("position:absolute;left:" + SE.FR + "px;top:" + SE.FR + "px;width:calc(100% - " + 2 * SE.FR + "px);height:calc(100% - " + 2 * SE.FR + "px)") &&
     cvRule.includes("touch-action:none") && frRule.includes("position:absolute;left:0;top:0;width:100%;height:100%") && frRule.includes("touch-action:auto") &&
     !/touch-action:none/.test(frRule), cvRule + " | " + frRule);
  ck("(i) css/31: rozowy obrys ekranu tylko przy fokusie z klawiatury, opis skrotow .ce-sr niewidoczny",
     css.includes(".ce-cv:focus-visible{outline:2px solid var(--pink);outline-offset:2px}") && /\.ce-sr\{position:absolute;width:1px;height:1px;[^}]*clip:rect\(0 0 0 0\)/.test(css));
  const s25 = read("web/js/rf-25-soundlab.js");
  ck("(i) rf-25: readEditorPatch -> SoundEditors.readInto, _setFormFromPatch -> SoundEditors.load",
     s25.includes("if(window.SoundEditors)SoundEditors.readInto(p);") && s25.includes("if(window.SoundEditors)SoundEditors.load(p);") && !/SoundScreens\.(readInto|load)\(/.test(s25));
  ck("(i) rf-25: labStopAll usypia lampe i panele, labDraw rysuje oba",
     /SoundScreens\.sleep\(\);[^\n]*\n\s*if\(window\.SoundEditors\)SoundEditors\.sleep\(\);/.test(s25) &&
     s25.includes("function labDraw(){\n  if(window.SoundScreens)SoundScreens.draw();\n  if(window.SoundEditors)SoundEditors.draw();\n}") && !s25.includes("if(a||b)return;"));
  ck("(i) rf-25: initSoundEditor startuje SoundEditors przed SoundRack", /SoundEditors\.init\(\);[^\n]*\n\s*if\(window\.SoundRack\)SoundRack\.init\(\);/.test(s25));
  ck("(i) rf-25: fala wlasna w losowaniu tylko z panelami (readInto niesie wt)", s25.includes("if(window.SoundEditors&&window.SoundScreens&&_rndIf(.35))"));
  const s25c = read("web/js/rf-25c-sound-screens.js");
  const left = ["_eqDown", "_envDown", "_apply(", "readInto(", "load(p)", "_buildTools", "setChannel", "_fbCurves", "_eqTxt"].filter((k) => s25c.includes(k));
  ck("(i) rf-25c bez edycji (_eqDown, _envDown, _apply, readInto, load, narzedzia kanalow)", !left.length, left.join(","));
  const s25e = read("web/js/rf-25e-curve-editors.js");
  ck("(i) rf-25e LF, wola labParamChanged po nazwie w chwili zmiany (owiniecie racka je widzi)", !s25e.includes("\r") && s25e.includes('if(typeof labParamChanged==="function")labParamChanged();'));
  // pary i18n: nowe napisy E6 i każdy napis / dymek z pasków narzędzi paneli
  const i18n = read("web/js/rf-01-i18n.js");
  const pairOf = (k) => { const m = new RegExp(J(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ':("(?:[^"\\\\]|\\\\.)*")').exec(i18n); return m ? JSON.parse(m[1]) : null; };
  const tools = Object.values(SE.TOOLS).join("");
  const keys = ["Edytor fali", "Korektor", "Obwiednia"]
    .concat([...tools.matchAll(/>([^<]+)<\/button>/g)].map((m) => m[1]), [...tools.matchAll(/(?:title|aria-label)="([^"]+)"/g)].map((m) => m[1]),
            Object.values(SE.HELP));
  const miss = keys.filter((k) => !pairOf(k));
  ck("(i) i18n: pary EN dla etykiet paneli, opisow skrotow (HELP) i wszystkich klawiszy / dymkow narzedzi (" + keys.length + ")", !miss.length, miss.join(" | "));
  const dead = ["Kanał oscyloskopu", "Przełącznik kanału oscyloskopu", "Korektor: do czterech pasm na żywym widmie"].filter((k) => pairOf(k));
  ck("(i) i18n: pary dawnych klawiszy kanalow usuniete", !dead.length, dead.join(" | "));
  // E7: lampa ma jeden obraz, więc pary przełącznika stylu (pokrętło, dwa klawisze i ich dymki, podpis sekcji) odeszły
  const deadE7 = ["Styl", "Styl wizualizacji", "Pierścień", "Linia", "Pierścień: przebieg dookoła tarczy, widmo jako promienie",
    "Linia: przebieg i widmo jako poziome rurki", "Przełącznik stylu wizualizacji"].filter((k) => pairOf(k));
  ck("(i) i18n: E7 pary przelacznika stylu lampy usuniete (Styl, Pierscien, Linia, dymki, pokretlo)", !deadE7.length, deadE7.join(" | "));
}

// (j) KLATKI PRZY 60/120/144 Hz (runda naprawcza 2026-10-02): po ostatniej nucie żywe warstwy (przebieg i widmo)
//     wygasają do zera w każdym tempie ekranu. Świeży kontekst vm z prawdziwym rf-25e: kolejka rAF i znacznik klatki
//     (document.timeline) w rękach testu, analizator atrapą (dźwięk 600 ms, potem cisza na tym samym busie), render
//     liczony. Pętla padów woła draw() co klatkę, póki lab gra; potem zostaje tylko własny łańcuch klatek panelu.
const R25C_SRC = read("web/js/rf-25c-sound-screens.js");
const OLD25E = path.join(REPO, "_backups/261002-skop-fix/rf-25e-curve-editors.js");
function panelRun(src, hz, jitter, seed) {
  const q = [], tl = { currentTime: 0 }; let pnow = 0;
  const c = { console, _gl: (pl) => pl, performance: { now: () => pnow }, requestAnimationFrame: (cb) => { q.push(cb); return q.length; },
    document: { timeline: tl, getElementById: (id) => (id === "soundEditor" ? { open: true } : null), createElement: () => ({}) }, devicePixelRatio: 1 };
  c.window = c; vm.createContext(c);
  vm.runInContext(R25C_SRC + "\n" + src + "\nthis.SE=SoundEditors;", c);
  const S = c.SE; let sounding = true, renders = 0, maxPer = 0; const per = new Map();
  const N = 2048, fq = new Uint8Array(N / 2), td = new Float32Array(N);
  S._an = () => ({ an: { fftSize: N, getByteFrequencyData(a) { a.fill(0); if (sounding) for (let i = 15; i <= 40; i++) a[i] = 220; },
    getFloatTimeDomainData(a) { for (let i = 0; i < a.length; i++) a[i] = sounding ? Math.sin(2 * Math.PI * 440 * i / 48000) * .3 : 0; } }, fq, td });
  S._ed = { wave: { k: "wave", cv: { offsetParent: {}, clientWidth: 596, clientHeight: 176 } } };
  S._render = () => { renders++; const n = (per.get(tl.currentTime) || 0) + 1; per.set(tl.currentTime, n); maxPer = Math.max(maxPer, n); };
  let rnd = seed; const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
  const step = 1000 / hz, soundF = Math.round(600 / step), total = Math.round(5000 / step);
  let t = 1000, peak = 0;
  S._req();
  for (let f = 0; f < total; f++) {
    t += step + (rand() * 2 - 1) * jitter; tl.currentTime = t;
    if (f === soundF) sounding = false;
    const own = q.splice(0), loop = f < soundF; let k = 0;
    const call = (fn) => { pnow = t + .2 + .3 * k++; fn(); };
    if (f % 2) { if (loop) call(() => S.draw()); for (const cb of own) call(cb); }
    else { for (const cb of own) call(cb); if (loop) call(() => S.draw()); }
    if (S._F) peak = Math.max(peak, S._F.lv);
  }
  const F = S._F || { lv: 1, sp: [1] };
  return { lv: F.lv, sp: Math.max(...F.sp), peak, renders, maxPer, queued: q.length };
}
for (const [hz, j] of [[60, 1], [120, 1], [144, 1], [144, 0], [165, 1]]) {
  const r = panelRun(read("web/js/rf-25e-curve-editors.js"), hz, j, hz * 31 + j);
  ck("(j) " + hz + " Hz +-" + j + " ms: po ciszy przebieg i widmo paneli wygasaja do zera, lancuch klatek sie konczy",
     r.peak > .1 && r.lv <= .004 && r.sp <= .004 && r.queued === 0, J({ peak: +r.peak.toFixed(3), lv: +r.lv.toFixed(4), sp: +r.sp.toFixed(4), q: r.queued, renders: r.renders }));
  ck("(j) " + hz + " Hz +-" + j + " ms: jeden render panelu na klatke (petla padow + wlasna klatka = raz)", r.maxPer === 1, r.maxPer);
}
if (fs.existsSync(OLD25E)) {
  const o = panelRun(fs.readFileSync(OLD25E, "utf8"), 144, 0, 3);
  ck("(j) symulacja widzi blad: kopia sprzed poprawki przy 144 Hz zostawia zywe warstwy na ekranie", o.lv > .05 && o.queued === 0, J({ lv: +o.lv.toFixed(3), renders: o.renders }));
}

// (k) KLAWIATURA (runda naprawcza 2026-10-02): keydown na ekranie zmienia stan tymi samymi drogami co wskaźnik
//     (_eqCommit, _eqQ, _envSet, _commit) — wynik jak po odpowiadającym geście, lab dostaje zmianę (labParamChanged)
{
  const cvOf = (k) => slots.find((s) => s.dataset.editor === k).children[0].children[1].children[1];
  const kev = (key, o) => Object.assign({ key, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, pd: false, preventDefault() { this.pd = true; } }, o || {});
  const press = (k, key, o) => { const e = kev(key, o); cvOf(k).fire("keydown", e); return e; };
  // --- korektor
  SE._eq = []; SE._eqSel = -1; SE._pen = null; SE._hover = null;
  let lp = lpc, e = press("eq", "Insert");
  ck("(k) korektor: Insert = + Pasmo (1 kHz, 0 dB, Q 1, wybrane), lab wie, preventDefault",
     e.pd && SE._eq.length === 1 && J(SE._eq[0]) === J({ f: 1000, g: 0, q: 1 }) && SE._eqSel === 0 && lpc > lp, J(SE._eq));
  press("eq", "+");
  ck("(k) korektor: + tez dodaje pasmo", SE._eq.length === 2 && SE._eqSel === 1);
  press("eq", "]"); const s1 = SE._eqSel; press("eq", "]"); const s2 = SE._eqSel; press("eq", "["); const s3 = SE._eqSel;
  ck("(k) korektor: ] i [ wybieraja pasmo dookola listy", s1 === 0 && s2 === 1 && s3 === 0, J([s1, s2, s3]));
  lp = lpc;
  for (let i = 0; i < 3; i++) press("eq", "ArrowRight");
  for (let i = 0; i < 4; i++) press("eq", "ArrowUp");
  const kb = { f: SE._eq[0].f, g: SE._eq[0].g };
  ck("(k) korektor: strzalka w prawo = f x 1,03, w gore = +0,5 dB (3 i 4 nacisniecia), kazde przez _eqCommit", near(kb.f, 1000 * 1.03 ** 3, 1e-9) && kb.g === 2 && lpc - lp === 7, J(kb));
  press("eq", "ArrowLeft", { shiftKey: true }); press("eq", "ArrowDown", { shiftKey: true });
  ck("(k) korektor: Shift = x 1,1 i 2 dB", near(SE._eq[0].f, kb.f / 1.1, 1e-9) && SE._eq[0].g === 0, J(SE._eq[0]));
  press("eq", "ArrowLeft", { shiftKey: true }); press("eq", "ArrowUp", { shiftKey: true });
  // ten sam wynik co gest: drugie pasmo przeciągnięte wskaźnikiem w to samo miejsce daje w zapisie te same liczby
  {
    const W = 640, H = 220, b1 = SE._eq[1], g0 = SE._eqAt(b1, W, H), to = SE.picToCv(SS.xf(SE._eq[0].f), SS.gy(SE._eq[0].g), W, H);
    SE._ov = pane(W, H); SE.ch = "eq"; SE._down(ev(g0.x, g0.y)); SE._move(ev(to.x, to.y)); SE._up(ev(to.x, to.y)); SE._ov = null;
    const out = SE.readInto({ wave: "sine" }).eq;
    ck("(k) korektor: pasmo ustawione klawiatura = pasmo przeciagniete wskaznikiem w to samo miejsce (zapis: f, g, q)",
       out.length === 2 && J(out[0]) === J(out[1]), J(out));
  }
  SE._eqSel = 0; const q0 = SE._eq[0].q; e = press("eq", "PageUp");
  ck("(k) korektor: PageUp = Q x 1,12 jak kolko w gore, PageDown wraca", e.pd && near(SE._eq[0].q, q0 * SE.EQ_QWHEEL, 1e-12) && (press("eq", "PageDown"), near(SE._eq[0].q, q0, 1e-12)));
  SE._eq[0].f = 16000; SE._eq[0].g = 18; press("eq", "ArrowRight"); press("eq", "ArrowUp");
  ck("(k) korektor: granice osi panelu (16 kHz, +18 dB) trzymaja", SE._eq[0].f === 16000 && SE._eq[0].g === 18, J(SE._eq[0]));
  e = press("eq", "ArrowUp", { ctrlKey: true });
  ck("(k) korektor: z Ctrl / Alt / Meta klawisze przechodza dalej (bez zmian, bez preventDefault)", !e.pd && SE._eq[0].g === 18);
  e = press("eq", "Delete");
  ck("(k) korektor: Delete usuwa wybrane pasmo (jak Usun pasmo / dwuklik)", e.pd && SE._eq.length === 1 && SE._eqSel === -1);
  e = press("eq", "ArrowUp");
  ck("(k) korektor: strzalki bez wybranego pasma przechodza dalej (strona moze przewinac)", !e.pd && SE._eq.length === 1);
  for (let i = 0; i < 4; i++) press("eq", "Insert");
  ck("(k) korektor: Insert przy 4 pasmach nic nie dodaje", SE._eq.length === 4);
  SE._eq = []; SE._eqSel = -1; SE._syncTools();
  // --- obwiednia (suwaki: jedyne źródło prawdy; klawisz pisze value + input jak uchwyt)
  const att = els.get("seAtt"), sus = els.get("seSus"), dec = els.get("seDec"), ty = els.get("seType");
  att.value = "12"; dec.value = "340"; sus.value = "60"; els.get("seRel").value = "180"; ty.value = "legato"; SE._envC = [0, 0, 0];
  const a0 = att.ev; press("env", "1"); e = press("env", "ArrowRight");
  ck("(k) obwiednia: 1 + strzalka w prawo = atak o krok suwaka (1 ms) z wydarzeniem input", e.pd && att.value === "13" && att.ev === a0 + 1 && SE._envSel === "a", att.value);
  press("env", "ArrowRight", { shiftKey: true });
  ck("(k) obwiednia: Shift = 5 krokow", att.value === "18", att.value);
  press("env", "2"); press("env", "ArrowLeft");
  ck("(k) obwiednia: 2 + strzalka w lewo = zanik o krok suwaka (10 ms)", dec.value === "330", dec.value);
  const sv0 = sus.ev; press("env", "ArrowUp");
  ck("(k) obwiednia: 2 + strzalka w gore = podtrzymanie +1 % (legato) z wydarzeniem input", sus.value === "61" && sus.ev === sv0 + 1, sus.value);
  const ring = (ci) => SS.envHandles(SE._envLay(SE._envVals()), SE._envC, 0, .2).find((h) => h.ci === ci);
  lp = lpc; const r1y = ring(1).y; e = press("env", "PageUp");
  ck("(k) obwiednia: PageUp na punkcie 2 zgina zanik, pierscien idzie w gore, lab wie (zgiecie 0,05)", e.pd && SE._envC[1] === .05 && ring(1).y > r1y && lpc === lp + 1, J(SE._envC));
  press("env", "1"); const r0y = ring(0).y; press("env", "ArrowUp");
  ck("(k) obwiednia: 1 + strzalka w gore = zgiecie ataku, pierscien w gore (narastajacy odcinek: mniejsze c)", SE._envC[0] === -.05 && ring(0).y > r0y, J(SE._envC));
  press("env", "3"); const r2y = ring(2).y; press("env", "ArrowDown", { shiftKey: true });
  ck("(k) obwiednia: 3 + Shift + strzalka w dol = zgiecie zwolnienia o 0,25, pierscien w dol", SE._envC[2] === -.25 && ring(2).y < r2y && SE._envSel === "r", J(SE._envC));
  // ten sam wynik co gest: pierścień zgięcia przeciągnięty wskaźnikiem na wysokość z klawiatury daje to samo c
  {
    const W = 640, H = 240, c1 = SE._envC[1], h = ring(1), g = SE.picToCv(h.x, h.y, W, H);
    SE._envC[1] = 0; const h0 = ring(1), s0 = SE.picToCv(h0.x, h0.y, W, H);
    SE._ov = pane(W, H); SE.ch = "env"; SE._down(ev(s0.x, s0.y)); SE._move(ev(g.x, g.y)); SE._up(ev(g.x, g.y)); SE._ov = null;
    ck("(k) obwiednia: zgiecie z klawiatury = zgiecie przeciagniete wskaznikiem na te sama wysokosc", SE._envC[1] === c1, J([c1, SE._envC[1]]));
  }
  ty.value = "pluck"; e = press("env", "3");
  ck("(k) obwiednia pluck: 3 (zwolnienie) nie istnieje, przechodzi dalej; wybrany punkt wraca na 2", !e.pd && (press("env", "ArrowLeft"), SE._envSel === "d"));
  ty.value = "legato"; SE._envC = [0, 0, 0]; att.value = "12"; dec.value = "340"; sus.value = "100"; SE._syncTools();
  // --- fala: tylko w trybie Harmoniczne; ] i strzałki = ten sam słupek i ta sama fala co pociągnięcie palcem
  const sel = els.get("seWave"); sel.value = "sawtooth"; SE._wt = null; SE._harm = null; SE.setMode("draw");
  e = press("wave", "ArrowUp");
  ck("(k) fala w trybie Rysuj: strzalki przechodza dalej (rysuje sie wskaznikiem)", !e.pd && SE._wt === null);
  SE.setMode("harm"); SE._bar = 0; lp = lpc; press("wave", "]"); e = press("wave", "ArrowUp");
  const exp = SS.harmonicsOf(SS.shape("sawtooth")); exp[1] = Math.round((exp[1] + .05) * 100) / 100;
  const kbWt = Array.from(SE._wt);
  ck("(k) fala: ] wybiera slupek 2, strzalka w gore = jego glosnosc +0,05, wbudowana fala staje sie Wlasna, lab wie",
     e.pd && SE._bar === 1 && sel.value === "custom" && lpc === lp + 1 && J(kbWt) === J(Array.from(SS.fromHarmonics(exp))));
  sel.value = "sawtooth"; SE._wt = null; SE._harm = null; SE._ensureCustom(); SE._pen = { last: null };
  SE._apply({ x: 1.5 / 16, y: SE.BAR0 + exp[1] * SE.BARH }); SE._pen = null;
  ck("(k) fala: slupek z klawiatury = ten sam slupek pociagniety palcem na te sama wysokosc (ta sama fala)", J(Array.from(SE._wt)) === J(kbWt));
  press("wave", "["); press("wave", "[");
  ck("(k) fala: [ dookola (slupek 2 -> 1 -> 16)", SE._bar === 15, SE._bar);
  SE.setMode("draw"); sel.value = "sawtooth"; SE._wt = null; SE._harm = null; SE._bar = 0;
  // --- fokus: znacznik klawiatury tylko z klawiatury (focus-visible) albo po naciśnięciu klawisza
  const cvE = cvOf("env"), E = SE._ed.env;
  cvE.fv = false; cvE.fire("focus", {}); const kf0 = E.kf;
  press("env", "1"); const kf1 = E.kf; cvE.fire("blur", {}); const kf2 = E.kf; cvE.fv = true; cvE.fire("focus", {}); const kf3 = E.kf;
  ck("(k) fokus: klik (bez focus-visible) nie pokazuje wyboru, klawisz tak, blur gasi, fokus z klawiatury pokazuje", !kf0 && kf1 && !kf2 && kf3, J([kf0, kf1, kf2, kf3]));
  SE._hover = null; SE._envSel = "a"; const lg0 = cvE._ctx.log.length; SE._req("env"); clock += 20; SE.draw();
  const txt = cvE._ctx.log.slice(lg0).filter((l) => l[0] === "fillText").map((l) => String(l[1][0]));
  ck("(k) fokus: obwiednia pokazuje odczyt wybranego punktu (atak) zamiast podpowiedzi", txt.filter((t) => t === "atak 12 ms").length === 2 && !txt.some((t) => /^Ciągnij punkty/.test(t)), J(txt));
  cvE.fire("blur", {});
}

// (l) ZMIANA JĘZYKA (runda naprawcza 2026-10-02): obserwator <html lang> przerysowuje panele, podpisy z _gl() po angielsku
{
  const m = mos.find((o) => o.t === ctx.document.documentElement);
  ck("(l) panele obserwuja atrybut lang na <html> (jeden obserwator)", !!m && J(m.o.attributeFilter) === J(["lang"]) && m.o.attributes === true &&
     mos.filter((o) => o.t === ctx.document.documentElement).length === 1);
  const cvW = slots[0].children[0].children[1].children[1], gl0 = ctx._gl;
  ctx.__lang = "en"; ctx._gl = (pl, en) => (ctx.__lang === "en" ? en : pl);
  SE._hover = null; SE._pen = null; SE._dirty = {}; const n0 = cvW._ctx.log.length;
  if (m) m.f([]); clock += 20; SE.draw();
  const t = cvW._ctx.log.slice(n0).filter((l) => l[0] === "fillText").map((l) => String(l[1][0]));
  ck("(l) po zmianie lang panel fali dostaje nowe fillText po angielsku (podpowiedz)", t.includes("Draw one period of the wave"), J(t.slice(0, 3)));
  ctx._gl = gl0; delete ctx.__lang;
}

// (m) ETAP E7 (2026-10-03): SZKŁO CRT PANELI. Treść rysowana jak dotąd, ale do bufora poza ekranem (E.buf), a wspólny
//     ukryty kontekst WebGL2 (PadPlate._mk na odłączonym divie) robi z niej ekran shaderem „crt”: lekka kopuła (K .05),
//     scanlines, winieta, połysk. Wskaźnik idzie przez tę samą kopułę (picToCv / cvToPic), rysowanie liniowo (_lin);
//     bez WebGL2 zastępstwo 2D (linie co 3 px, winieta) i mapowanie liniowe. Atrapa GL w świeżym vm liczy wgrania
//     tekstury i kopie z canvasu GL na ekran (jak atrapa GL w harnessie lampy, sekcja (p)).
{
  const src = ctx.PadPlate._fs.crt || "";
  ck("(m) shader crt zarejestrowany z rf-25e: wlasne BK[4], probkuje tresc (texture(HT), bez odwrotnych apostrofow, plate()",
     /^uniform float BK\[4\];\n/.test(src) && src.includes("texture(HT,") && !src.includes("`") && /vec3 plate\(vec2 px,vec2 uv,vec2 r\)\{/.test(src));
  ck("(m) shader crt: kopula z BK[0] jak w JS (pc = sc*(1+K*|sc|^2)), scanlines na tresci co 3 px z BK[1], winieta .6-1.2 z BK[2], polysk z BK[3]",
     src.includes("vec2 sc=(uv-.5)*2.;float q2=dot(sc,sc);") && src.includes("vec2 pc=sc*(1.+BK[0]*q2),t=pc*.5+.5;") &&
     src.includes("col*=1.-BK[1]*(.5+.5*cos(t.y*R.y*2.0944));") && src.includes("col*=1.-BK[2]*smoothstep(.6,1.2,length(sc));") &&
     (src.match(/BK\[3\]/g) || []).length === 2 && !/const float K=/.test(src));
  ck("(m) stale szkla w JS: K .05 (lampa .30), scanlines .09 (E8, bylo .06), winieta .25, polysk 1; _bk() niesie je do BK w tej kolejnosci",
     SE.K === .05 && SE.CRT_S === .09 && SE.CRT_V === .25 && SE.CRT_G === 1 && SS.K === .3 &&
     J(Array.from(SE._bk())) === J([.05, .09, .25, 1].map(Math.fround)), J(Array.from(SE._bk())));
  // kopuła w JS: 12 punktów obrazu w obie strony, przy K .05 (szkło) i 0 (bez WebGL2), na ekranach fali i obwiedni
  const pts = [[0, 0], [1, 1], [0, 1], [1, 0], [.5, .5], [.37, .62], [-.05, 1.08], [1.04, -.03], [.02, .5], [.98, .5], [.5, .02], [.81, .93]];
  for (const k of [.05, 0]) for (const [W, H] of [[596, 176], [596, 196]]) {
    let w = 0; for (const [x, y] of pts) { const c = SE.picToCv(x, y, W, H, k), p = SE.cvToPic(c.x, c.y, W, H, k); w = Math.max(w, Math.hypot(p.x - x, p.y - y)); }
    ck("(m) cvToPic(picToCv(p)) = p dla 12 punktow przy K = " + k + ", ekran " + W + "x" + H, w < 1e-9, w);
  }
  const W = 596, H = 176, lin = SE._lin(.1, .9, W, H), dom = SE.picToCv(.1, .9, W, H, .05), mid = SE.picToCv(.5, .5, W, H, .05), mL = SE._lin(.5, .5, W, H);
  ck("(m) kopula wciaga obraz ku srodkowi (punkt przy rogu blizej srodka niz liniowo), srodek stoi, K = 0 = liniowo",
     Math.abs(dom.x - W / 2) < Math.abs(lin.x - W / 2) && Math.abs(dom.y - H / 2) < Math.abs(lin.y - H / 2) && Math.hypot(lin.x - dom.x, lin.y - dom.y) > 1 &&
     near(mid.x, mL.x, 1e-9) && near(mid.y, mL.y, 1e-9) && J(SE.picToCv(.1, .9, W, H, 0)) === J(lin), J({ lin, dom }));
  ck("(m) bez WebGL2 (atrapa PadPlate bez _mk): szklo nieaktywne (_post false), kopula 0, wskaznik liniowo",
     SE._post === false && SE._dk() === 0 && J(SE.picToCv(.1, .9, W, H)) === J(lin));
  // tryb bez WebGL2 na prawdziwym ekranie panelu fali z (h)
  const cvW = slots[0].children[0].children[1].children[1], Wc = cvW.clientWidth, Hc = cvW.clientHeight, n0 = cvW._ctx.log.length;
  SE._req("wave"); clock += 20; SE.draw();
  const lg = cvW._ctx.log.slice(n0), lines = lg.filter((l) => l[0] === "fillRect" && l[1][0] === 0 && l[1][2] === Wc && l[1][3] === 1);
  ck("(m) bez WebGL2: tresc wprost na ekran + linie 2D co 3 px (fillRect, alpha .09) i owalna winieta (gradient .6 -> 1.2), bez kopii z GL",
     lines.length === Math.ceil(Hc / 3) && lines.every((l, i) => l[1][1] === 3 * i) && lg.some((l) => l[0] === "createRadialGradient" && J(l[1]) === J([0, 0, .6, 0, 0, 1.2])) &&
     !lg.some((l) => l[0] === "drawImage" && l[1][0] !== SE._ed.wave.live) && cvW._ctx.sets.some(([k, v]) => k === "fillStyle" && v === "rgba(0,0,0,0.09)"), lines.length + " / " + Math.ceil(Hc / 3));

  // --- atrapa GL: PadPlate._mk / _prog w kształcie rf-24b (canvas GL, programy z _fs), gl zapisuje każde wywołanie
  const glLog = [], made = [], lost = [], warns = [], winL = {};
  const mkGL = () => {
    const g = { lostNow: false, TEXTURE_2D: 1, TEXTURE0: 2, RGBA8: 3, RGBA: 4, UNSIGNED_BYTE: 5, FRAMEBUFFER: 6, TRIANGLES: 7, UNPACK_FLIP_Y_WEBGL: 8,
      TEXTURE_MIN_FILTER: 9, TEXTURE_MAG_FILTER: 10, TEXTURE_WRAP_S: 11, TEXTURE_WRAP_T: 12, LINEAR: 13, CLAMP_TO_EDGE: 14,
      isContextLost() { return this.lostNow; }, getExtension: (n) => (n === "WEBGL_lose_context" ? { loseContext: () => lost.push(1) } : null) };
    return new Proxy(g, { get(t, k) { if (k in t) return t[k]; if (typeof k === "symbol") return undefined;
      return (...a) => { glLog.push([k, a]); return k === "createTexture" ? { tex: 1 } : undefined; }; } });
  };
  const PP = { _fs: {}, noGL: false,
    _mk(wrap) { if (PP.noGL) return null; const st = { cv: { width: 300, height: 150, glCanvas: true }, gl: mkGL(), wrap, progs: {}, pts: {} }; made.push({ wrap, st }); return st; },
    _prog(st, id) { if (!PP._fs[id]) throw new Error("no shader " + id);
      return st.progs[id] || (st.progs[id] = { pr: { id }, u: { R: "R", DPR: "DPR", HT: "HT", HS: "HS", BK: "BK" } }); } };
  const slots2 = ["wave", "eq", "env"].map((k) => { const s = mkEl("div"); s.className = "se-sec-editor"; s.dataset.editor = k; s.hidden = true; return s; });
  const box2 = { open: true, L: {}, querySelectorAll: (q) => (q === ".se-sec-editor[data-editor]" ? slots2 : []), addEventListener(t, f) { (this.L[t] || (this.L[t] = [])).push(f); } };
  const toggle = (open) => { box2.open = open; (box2.L.toggle || []).forEach((f) => f({ target: box2 })); };
  let clk = 5000;
  const c2 = { console: { warn: (...a) => warns.push(a.map(String).join(" ")), log() {} }, _gl: (pl) => pl,
    document: { getElementById: (id) => (id === "soundEditor" ? box2 : null), createElement: (t) => mkEl(t), body: {}, documentElement: {} },
    getComputedStyle: () => ({ fontFamily: "Test", getPropertyValue: () => "" }), performance: { now: () => clk },
    Event: ctx.Event, PadPlate: PP, devicePixelRatio: 1.5, addEventListener: (t, f) => { (winL[t] || (winL[t] = [])).push(f); } };
  c2.window = c2; vm.createContext(c2);
  vm.runInContext(read("web/js/rf-25c-sound-screens.js") + "\n" + read("web/js/rf-25e-curve-editors.js") + "\nthis.SE=SoundEditors;this.SS=SoundScreens;", c2);
  const S2 = c2.SE, SS2 = c2.SS, K = ["wave", "eq", "env"];
  S2.init(); clk += 20; S2.draw();
  const E2 = K.map((k) => S2._ed[k]), st = made[0] && made[0].st, glcv = st && st.cv;
  const ups1 = glLog.filter((l) => l[0] === "texImage2D" || l[0] === "texSubImage2D");
  ck("(m) GL: jeden ukryty kontekst na trzy panele, z PadPlate._mk na odlaczonym divie, program crt z PadPlate._fs",
     made.length === 1 && !made[0].wrap.parentNode && !!st.progs.crt && S2._post && S2._post.st === st && !!PP._fs.crt, made.length);
  ck("(m) GL, 1. klatka: tekstura alokowana (texImage2D z null) tylko gdy rosnie (fala 894x264, obwiednia wyzsza: 894x294), tresc kazdego panelu wgrana raz (texSubImage2D z jego bufora)",
     J(ups1.map((l) => (l[0] === "texImage2D" ? ["alloc", l[1][3], l[1][4], l[1][8]] : ["sub", E2.findIndex((E) => E.buf === l[1][6])]))) ===
     J([["alloc", 894, 264, null], ["sub", 0], ["sub", 1], ["alloc", 894, 294, null], ["sub", 2]]) &&
     glcv.width === 894 && glcv.height === 294, J(ups1.map((l) => l[0])));
  // 2. klatka: same wgrania w miejsce, jeden przebieg i jedna kopia na panel
  const g0 = glLog.length, d0 = E2.map((E) => E.cv._ctx.log.length), b0 = E2.map((E) => E.bx.log.length);
  S2._req(); clk += 20; S2.draw();
  const f2 = glLog.slice(g0), up2 = f2.filter((l) => l[0] === "texImage2D" || l[0] === "texSubImage2D");
  ck("(m) GL, kazda nastepna klatka: na panel jedno wgranie tresci (texSubImage2D z E.buf, odwrocone FLIP_Y), zadnego texImage2D, jeden drawArrays",
     up2.length === 3 && up2.every((l, i) => l[0] === "texSubImage2D" && l[1][6] === E2[i].buf) && f2.filter((l) => l[0] === "drawArrays").length === 3 &&
     f2.filter((l) => l[0] === "pixelStorei" && l[1][0] === 8 && l[1][1] === true).length === 3, J(f2.map((l) => l[0]).filter((n) => /tex|draw/.test(n))));
  const vps = f2.filter((l) => l[0] === "viewport").map((l) => l[1]), hs = f2.filter((l) => l[0] === "uniform2f" && l[1][0] === "HS").map((l) => l[1].slice(1));
  const bks = f2.filter((l) => l[0] === "uniform1fv" && l[1][0] === "BK").map((l) => J(Array.from(l[1][1])));
  ck("(m) GL: przebieg w lewym dolnym rogu w rozmiarze panelu (viewport), HS = udzial tekstury, BK = [K, S, V, G] z JS",
     J(vps) === J([[0, 0, 894, 264], [0, 0, 894, 264], [0, 0, 894, 294]]) && J(hs) === J([[1, 264 / 294], [1, 264 / 294], [1, 1]]) &&
     bks.length === 3 && bks.every((b) => b === J([.05, .09, .25, 1].map(Math.fround))), J({ vps, hs }));
  const di = E2.map((E, i) => E.cv._ctx.log.slice(d0[i]).filter((l) => l[0] === "drawImage"));
  ck("(m) GL: na klatke jedna kopia z canvasu GL na widoczny ekran panelu (jego prostokat z dolu canvasu GL, w tej samej klatce)",
     di.every((d, i) => d.length === 1 && d[0][1][0] === glcv && J(d[0][1].slice(1)) === J([0, glcv.height - E2[i].cv.height, E2[i].cv.width, E2[i].cv.height, 0, 0, E2[i].cv.width, E2[i].cv.height])),
     J(di.map((d) => d.length)));
  ck("(m) GL: tresc (ekran, krzywe) rysowana do bufora, widoczny ekran dostaje tylko czyszczenie, obrys zaokraglenia i kopie (bez linii 2D)",
     E2.every((E, i) => E.bx.log.slice(b0[i]).filter((l) => l[0] === "createRadialGradient").length === 1 &&
       !E.cv._ctx.log.slice(d0[i]).some((l) => l[0] === "createRadialGradient" || l[0] === "fillRect" || l[0] === "fillText")) && S2._dk() === S2.K);
  // wskaźnik przez kopułę: pasmo korektora pod palcem, krzyżyk w buforze tam, gdzie po kopule wypada palec
  const Eq = S2._ed.eq, Wq = Eq.cv.clientWidth, Hq = Eq.cv.clientHeight, at = S2.picToCv(SS2.xf(8000), SS2.gy(15), Wq, Hq), atL = S2._lin(SS2.xf(8000), SS2.gy(15), Wq, Hq);
  S2._eq = []; Eq.cv.fire("pointerdown", ev(at.x, at.y));
  ck("(m) GL: pointerdown na ekranie korektora przez kopule = nowe pasmo 8 kHz / +15 dB pod palcem (bez kopuly palec trafilby kilka px obok)",
     S2._eq.length === 1 && near(S2._eq[0].f, 8000, .5) && near(S2._eq[0].g, 15, .01) && Math.hypot(at.x - atL.x, at.y - atL.y) > 3, J({ at, atL, eq: S2._eq }));
  Eq.cv.fire("pointerup", ev(at.x, at.y));
  const hx = 40, hy = 20, nb = Eq.bx.log.length;
  S2._hover = { k: "eq", px: hx, py: hy, W: Wq, H: Hq, pic: S2.cvToPic(hx, hy, Wq, Hq) }; S2._req("eq"); clk += 20; S2.draw();
  const tp = S2._toPic(hx, hy, Wq, Hq, S2.K), mv = Eq.bx.log.slice(nb).filter((l) => l[0] === "moveTo");
  ck("(m) GL: krzyzyk w buforze tam, gdzie po kopule wypada wskaznik (_toPic), nie w jego wspolrzednych ekranu",
     mv.some((l) => near(l[1][0], tp.x - 8, 1e-6) && near(l[1][1], tp.y, 1e-6)) && Math.hypot(tp.x - hx, tp.y - hy) > 3, J({ tp, hx, hy }));
  S2._hover = null;
  // kontekst utracony w trakcie: szkło odpada do zwinięcia edytora, panele rysują się zastępstwem 2D, wskaźnik liniowo
  st.gl.lostNow = true; S2._req(); clk += 20; S2.draw();
  const mk1 = made.length; S2._req(); clk += 20; const dl = E2.map((E) => E.cv._ctx.log.length); S2.draw();
  ck("(m) GL utracony: ostrzezenie, kontekst oddany, _post false, kopula 0, nastepna klatka = linie 2D na kazdym ekranie, bez nowego kontekstu",
     warns.length >= 1 && lost.length === 1 && S2._post === false && S2._dk() === 0 && made.length === mk1 &&
     E2.every((E, i) => E.cv._ctx.log.slice(dl[i]).filter((l) => l[0] === "fillRect" && l[1][3] === 1).length === Math.ceil(E.cv.clientHeight / 3)), J({ warns: warns.length, lost: lost.length }));
  // zwinięcie edytora zeruje stan szkła, ponowne otwarcie buduje kontekst od nowa; pagehide oddaje kontekst
  toggle(false);
  ck("(m) zwiniecie edytora: szklo do ponownej proby (_post null)", S2._post === null && lost.length === 1);
  toggle(true); clk += 20; S2.draw();
  ck("(m) ponowne otwarcie: nowy kontekst, kopula znow K", made.length === mk1 + 1 && !!S2._post && S2._dk() === S2.K);
  (winL.pagehide || []).forEach((f) => f({}));
  ck("(m) pagehide oddaje kontekst szkla (loseContext)", (winL.pagehide || []).length === 1 && lost.length === 2 && S2._post === null);
  // przeglądarka bez WebGL2: _mk zwraca null → zastępstwo 2D od pierwszej klatki, bez ostrzeżeń
  PP.noGL = true; const w0 = warns.length; toggle(false); toggle(true); clk += 20; S2.draw();
  ck("(m) bez WebGL2 (_mk = null): _post false, kopula 0, bez ostrzezenia", S2._post === false && S2._dk() === 0 && warns.length === w0);
}

// (n) ETAP E8 (2026-10-03): POŚWIATA ŻYWYCH WARSTW. Różowy przebieg pod falą i zielone widmo pod korektorem idą na
//     osobny canvas E.live panelu, który co klatkę jest przyciemniany (destination-out, a = 1 − e^(−dt/τ), τ .15 s)
//     zamiast czyszczony, i wklejany pod krzywą („lighter”). Świeży vm z prawdziwym rf-25e, kolejką rAF i zegarem
//     klatek w rękach testu, analizator atrapą (dźwięk, potem cisza).
{
  const q = [], tl = { currentTime: 0 };
  const slots3 = ["wave", "eq", "env"].map((k) => { const s = mkEl("div"); s.className = "se-sec-editor"; s.dataset.editor = k; s.hidden = true; return s; });
  const box3 = { open: true, L: {}, querySelectorAll: (s) => (s === ".se-sec-editor[data-editor]" ? slots3 : []), addEventListener(t, f) { (this.L[t] || (this.L[t] = [])).push(f); } };
  const c3 = { console, _gl: (pl) => pl, performance: { now: () => tl.currentTime }, requestAnimationFrame: (cb) => { q.push(cb); return q.length; },
    document: { timeline: tl, getElementById: (id) => (id === "soundEditor" ? box3 : null), createElement: (t) => mkEl(t), body: {}, documentElement: {} },
    getComputedStyle: () => ({ fontFamily: "Test", getPropertyValue: () => "" }), Event: ctx.Event, PadPlate: { _fs: {} }, devicePixelRatio: 1.5 };
  c3.window = c3; vm.createContext(c3);
  vm.runInContext(read("web/js/rf-25c-sound-screens.js") + "\n" + read("web/js/rf-25e-curve-editors.js") + "\nthis.SE=SoundEditors;", c3);
  const S3 = c3.SE; let sounding = true;
  const an = { fftSize: 2048, frequencyBinCount: 1024,
    getByteFrequencyData(a) { a.fill(0); if (sounding) for (let i = 15; i <= 40; i++) a[i] = 220; },
    getFloatTimeDomainData(a) { for (let i = 0; i < a.length; i++) a[i] = sounding ? Math.sin(2 * Math.PI * 440 * i / 48000) * .3 : 0; } };
  c3.PadAudio = { ctx: { state: "running", sampleRate: 48000 }, buses: { __lab__: { master: { connect() {} }, voices: {}, _plateAn: an, _plateFq: new Uint8Array(1024), _plateTd: new Float32Array(2048) } } };
  let t = 1000; const frame = (dt) => { t += dt; tl.currentTime = t; for (const cb of q.splice(0)) cb(); };
  S3.init(); for (let i = 0; i < 10; i++) frame(20);
  const Ew = S3._ed.wave, Ee = S3._ed.eq, En = S3._ed.env;
  ck("(n) E.live tylko dla fali i korektora (obwiednia nie ma warstwy zywej), w rozmiarze ekranu w pikselach urzadzenia",
     !!Ew.live && !!Ee.live && !En.live && Ew.live.width === Ew.cv.width && Ew.live.height === Ew.cv.height && Ee.live.height === Ee.cv.height,
     J({ w: Ew.live && [Ew.live.width, Ew.live.height], cv: [Ew.cv.width, Ew.cv.height] }));
  const aOf = (dt) => "rgba(0,0,0," + (1 - Math.exp(-dt / (S3.LIVE_TAU * 1000))).toFixed(4) + ")";
  const step = (dt) => { const n0 = [Ew, Ee].map((E) => E.lx.sets.length), v0 = [Ew, Ee].map((E) => E.cv._ctx.log.length), v1 = [Ew, Ee].map((E) => E.cv._ctx.sets.length);
    frame(dt);
    return [Ew, Ee].map((E, i) => { const st = E.lx.sets.slice(n0[i]), lg = E.cv._ctx.log.slice(v0[i]);
      return { out: st.filter(([k, v]) => k === "globalCompositeOperation" && v === "destination-out").length,
        fs: st.filter(([k, v]) => k === "fillStyle" && /^rgba\(0,0,0,/.test(v)).map(([, v]) => v),
        paste: lg.filter((l) => l[0] === "drawImage" && l[1][0] === E.live).length,
        lighter: E.cv._ctx.sets.slice(v1[i]).some(([k, v]) => k === "globalCompositeOperation" && v === "lighter") }; }); };
  const s20 = step(20), s40 = step(40);
  ck("(n) na klatke jedno przyciemnienie destination-out kazdej warstwy, a = 1 - e^(-dt/.15 s) z dt klatki (20 ms i 40 ms)",
     [s20, s40].every((s) => s.every((r) => r.out === 1 && r.fs.length === 1)) && s20.every((r) => r.fs[0] === aOf(20)) && s40.every((r) => r.fs[0] === aOf(40)) &&
     aOf(20) !== aOf(40) && S3.LIVE_TAU === .15, J({ s20: s20.map((r) => r.fs), s40: s40.map((r) => r.fs) }));
  ck("(n) warstwa wklejana raz na klatke pod krzywa, dodawczo (lighter)", [s20, s40].every((s) => s.every((r) => r.paste === 1 && r.lighter)), J(s20));
  // kolejność w panelu fali: siatka, poświata, krzywa (limonka); w korektorze tak samo
  const lw = Ew.cv._ctx.log, iP = lw.map((l) => l[0] === "drawImage" && l[1][0] === Ew.live).lastIndexOf(true);
  const after = lw.slice(iP), before = lw.slice(Math.max(0, iP - 40), iP);
  ck("(n) poswiata po siatce, przed krzywa limonkowa", iP > 0 && before.some((l) => l[0] === "stroke") && after.some((l) => l[0] === "fill") && after.some((l) => l[0] === "stroke"));
  // cisza: smuga dogasa (przyciemnianie trwa, nic nowego nie dochodzi), potem warstwa wyczyszczona i koniec klatek
  sounding = false; let n = 0, outs = 0; const cl0 = Ew.lx.calls.clearRect || 0;
  while (q.length && n < 400) { const o0 = Ew.lx.sets.length; frame(16); outs += Ew.lx.sets.slice(o0).filter(([k, v]) => k === "globalCompositeOperation" && v === "destination-out").length; n++; }
  ck("(n) po ciszy smuga dogasa klatka po klatce, potem warstwa wyczyszczona (clearRect) i lancuch klatek sie konczy",
     q.length === 0 && n < 400 && outs > 20 && (Ew.lx.calls.clearRect || 0) > cl0 && Ew.ld === -1e9 && Ee.ld === -1e9, J({ n, outs, q: q.length }));
  const p0 = Ew.cv._ctx.log.length; S3._req("wave"); frame(16);
  ck("(n) wygaszona warstwa nie jest juz wklejana", !Ew.cv._ctx.log.slice(p0).some((l) => l[0] === "drawImage"));
  // sleep(): obie warstwy czyszczone od razu
  sounding = true; S3._req(); for (let i = 0; i < 5; i++) frame(20);
  const cw = Ew.lx.calls.clearRect || 0, ce = Ee.lx.calls.clearRect || 0; S3.sleep();
  ck("(n) sleep() czysci obie warstwy zywe (clearRect) i zeruje ich czas", (Ew.lx.calls.clearRect || 0) === cw + 1 && (Ee.lx.calls.clearRect || 0) === ce + 1 && Ew.ld === -1e9 && Ee.ld === -1e9);
  ck("(n) rysowanie warstw bez wyjatku", !S3._warned);
}

const failed = checks.filter((c) => !c[1]);
for (const [n, ok, d] of checks) process.stdout.write((ok ? "PASS  " : "FAIL  ") + n + (ok || !d ? "" : "  -> " + d) + "\n");
process.stdout.write(JSON.stringify({ checks }) + "\n");
process.exit(failed.length ? 1 : 0);
