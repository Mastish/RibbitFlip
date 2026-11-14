// LABORATORIUM ZAKRESU (rf-16c) SPRAWDZONE BEZ PRZEGLĄDARKI.
//
// Ten komponent obiecuje jedną rzecz: że liczby na ekranie znaczą to samo, co liczby w silniku.
// Obietnica jest krucha w czterech miejscach i wszystkie cztery psują się CICHO:
//
//  1. ID PÓL. Zakres, próg i „odwróć kierunek” przeniosły się ze starej siatki do laboratorium.
//     `wireMidiEditor` czyta je PO ID (`mieInLo`, `mieThr`, `mieAbs`…), więc literówka w nowym
//     szablonie nie wywala niczego — po prostu przestaje się zapisywać połowa mapowania.
//  2. TABELA OSI. Jednostka i domyślne okno muszą być lustrem `_sanitize_map`. Rozjazd znaczy, że
//     panel podpisuje wykres stopniami, a serwer liczy w surowych LSB.
//  3. PRZELICZENIE PRZY ZMIANIE ŹRÓDŁA. Wolno je zrobić TYLKO wtedy, gdy user zakresu nie tknął.
//     Za dużo — kasujemy komuś wpisane liczby; za mało — zostaje okno, w którym mapowanie jest
//     zawsze nasycone.
//  4. NAUKA. Cała liczy się na serwerze, więc klient ma dokładnie trzy zadania: wysłać poprawne
//     ciało `start`/`apply`/`cancel`, przyjąć podgląd z klucza `learn` zdarzenia `mo` i nie
//     uruchamiać nauki dla mapowania, którego serwer jeszcze nie zna.
//
// Bez przeglądarki i bez serwera: oba pliki panelu są płaskimi skryptami, więc wystarczy je
// uruchomić w `vm` z atrapami globali, których dotykają (DOM, canvas, fetch, i18n).
//
// Wywoływane z tests/test_midi_lab.py: argv[2] = {defaults} (domyślne okna prosto z silnika),
// na wyjściu JSON {checks:[[nazwa, ok, szczegół], …]} — liczy je python.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const D = JSON.parse(process.argv[2] || "{}");
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);

// ── atrapa DOM ────────────────────────────────────────────────────────────────────────────────
// Jeden element na id, zapamiętany — laboratorium woła `getElementById` w pętli rysowania i musi
// dostawać wciąż ten sam obiekt (inaczej `onclick` przypięty w jednym przebiegu ginie w kolejnym).
const els = new Map();
function mkEl(id) {
  return {
    id, value: "", checked: false, innerHTML: "", textContent: "", disabled: false,
    style: {}, dataset: {}, onclick: null, _ev: {},
    classList: {toggle() {}, add() {}, remove() {}, contains() { return false; }},
    addEventListener(t, fn) { (this._ev[t] = this._ev[t] || []).push(fn); },
    setAttribute() {}, getAttribute() { return null; }, hasAttribute() { return false; },
    querySelectorAll() { return []; }, focus() {},
    getContext() { return CTX2D; },
  };
}
const CTX2D = new Proxy({}, {get: (t, k) => (k === "canvas" ? {} : () => {})});
const document = {
  getElementById(id) { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); },
  querySelector() { return null; }, querySelectorAll() { return []; },
  createTreeWalker() { return {nextNode() { return null; }}; },
};

// ── kontekst ─────────────────────────────────────────────────────────────────────────────────
const fetchCalls = [];
let fetchReply = {ok: true};
const state = {
  midi: {mappings: [], midiChannel: 0, oscPrefix: "/rf", enabled: true, oscEnabled: true},
  midiOut: {}, midiEnv: {}, devices: {d0: {}}, activeDeviceId: "d0", midiDev: "d0",
  midiEditing: null, _midiDraft: null, _midiEditIsNew: false,
  pose: {tilt: 34.2, twist: 12, pitch: -5, roll: 7, spin: 900},
  poseBuf: {tilt: [[0, 10], [1, 40]], twist: [], pitch: [], roll: [], spin: []},
  last: {ax: 1200, ay: 0, az: 0, gx: 0, gy: 0, gz: 0},
  buf: {ax: [[0, 100], [1, 900]], ay: [], az: [], gx: [], gy: [], gz: []},
  windowSec: 10, nowTs: 1,
};
const ctx = {
  console, document, state,
  _gl: (pl) => pl, _cvT: (s) => s, _lang: "pl",
  AKEYS: ["ax", "ay", "az", "gx", "gy", "gz"],
  RE_NAME: ["ax", "ay", "az", "gx", "gy", "gz"],
  chanSrcBuf: () => null,
  cv: (n) => "#000",
  fit: () => ({ctx: CTX2D, w: 320, h: 96}),
  niceTicks: (lo, hi) => [lo, (lo + hi) / 2, hi],
  fmtTick: (v) => String(Math.round(v)),
  performance: {now: () => 1000},
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  matchMedia: () => ({matches: true}),          // reduced motion: żadnej pętli rAF w harnessie
  rfToast: () => {}, miFlash: () => {},
  enableDragReorder: () => {}, commitMidiOrder: () => {},
  renderOverview: () => {}, iologRefresh: () => {}, iologLocal: () => {}, updateTabDots: () => {},
  midiCfgSync: () => {}, oscTargetTag: () => "", oscTargetFieldHtml: () => "",
  oscTargetFieldRead: () => {}, oscTargetsTake: () => {},
  setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: (url, opt) => {
    fetchCalls.push({url, body: opt && opt.body ? JSON.parse(opt.body) : null});
    return Promise.resolve({json: () => Promise.resolve(fetchReply)});
  },
};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ["web/js/rf-16-midi.js", "web/js/rf-16c-midi-lab.js"])
  vm.runInContext(fs.readFileSync(path.join(REPO, f), "utf8"), ctx);
const G = (n) => vm.runInContext(n, ctx);      // const/let z modułu nie ląduje na obiekcie kontekstu
const tick = () => new Promise((r) => setImmediate(r));

const base = (patch) => Object.assign(ctx.miDefaultMap(), patch || {});

// 1. ID PÓL — dla każdego celu i obu trybów. To jest cała granica między laboratorium a zapisem.
const NEED_CONT = ["mieInLo", "mieInHi", "mieInvert", "miLabCv", "miRngLearn", "miRngFill"];
const NEED_THR = ["mieCmp", "mieThr", "mieAbs", "mieInvert", "miLabCv", "miRngThrR"];
for (const dest of ["cc", "cc14", "pitchbend", "aftertouch", "program", "note", "osc"]) {
  for (const mode of ["continuous", "threshold"]) {
    const m = base({dest, mode});
    const html = ctx.miLabSectionHtml(m, mode === "threshold");
    const need = mode === "threshold" ? NEED_THR : NEED_CONT;
    const miss = need.filter((id) => html.indexOf('id="' + id + '"') < 0);
    ck(`laboratorium ma komplet pól: ${dest} / ${mode}`, !miss.length, miss.join(","));
  }
}
{
  const html = ctx.miLabSectionHtml(base({srcKind: "axis", ch: 3}), false);
  ck("źródło „oś” pokazuje wybór kanału, chowa wielkość",
     /id="mieCh"/.test(html) && /id="mieMetricW" style="display:none"/.test(html));
  const h2 = ctx.miLabSectionHtml(base({srcKind: "filter"}), false);
  ck("źródło „filtr” odwrotnie",
     /id="mieMetric"/.test(h2) && /id="mieChW" style="display:none"/.test(h2));
}

// 2. TABELA OSI == domyślne silnika. `defaults` przychodzą prosto z `_sanitize_map`.
for (const [key, want] of Object.entries(D.defaults || {})) {
  const m = key === "axis" ? base({srcKind: "axis", ch: 0}) : base({srcKind: "filter", metric: key});
  const got = ctx.miLabDefaults(m);
  ck(`domyślne okno „${key}” jak w silniku`,
     Math.abs(got.inLo - want[0]) < 1e-9 && Math.abs(got.inHi - want[1]) < 1e-9,
     JSON.stringify(got) + " vs " + JSON.stringify(want));
}
{
  const u = (k) => ctx.miLabAxis(k === "axis" ? base({srcKind: "axis"}) : base({metric: k})).unit;
  ck("jednostki: stopnie dla kątów, °/s dla obrotu, LSB dla osi i energii",
     u("tilt") === "°" && u("pitch") === "°" && u("roll") === "°" && u("twist") === "°/s"
     && u("spin") === "LSB" && u("axis") === "LSB",
     [u("tilt"), u("twist"), u("spin"), u("axis")].join("|"));
  ck("przelicznik 131 LSB = 1 °/s tylko przy kanałach żyroskopu (CH0–2)",
     ctx.miLabAxisNote(base({srcKind: "axis", ch: 1})).indexOf("131") >= 0
     && ctx.miLabAxisNote(base({srcKind: "axis", ch: 4})) === "",
     ctx.miLabAxisNote(base({srcKind: "axis", ch: 4})));
}

// 3. PRZELICZENIE PRZY ZMIANIE ŹRÓDŁA — dotknięte vs nietknięte.
{
  const m = base({srcKind: "filter", metric: "tilt"});           // 0 / 90 = domyślne
  m.srcKind = "axis";
  ck("nietknięty zakres przeliczony po cichu na domyślne nowego źródła",
     ctx.miLabRetune(m) === true && m.inLo === -16000 && m.inHi === 16000, m.inLo + ".." + m.inHi);
  ck("…i próg poszedł na środek nowego okna", m.threshold === 0, m.threshold);
  const n = base({srcKind: "axis", ch: 0, inLo: -16000, inHi: 16001, threshold: 0});
  n.srcKind = "filter"; n.metric = "tilt";       // ±16000 LSB przełożone na stopnie
  ck("wpisane ręcznie liczby NIE są kasowane",
     ctx.miLabRetune(n) === false && n.inLo === -16000 && n.inHi === 16001,
     n.inLo + ".." + n.inHi);
  ck("…ale panel mówi wprost, że nie pasują", !!ctx.miLabMismatch(n), ctx.miLabMismatch(n));
  const k = base({srcKind: "filter", metric: "pitch", inLo: -90, inHi: 90});   // domyślne obu
  k.metric = "roll";
  ck("to samo domyślne okno w obu wielkościach = nic do przeliczenia",
     ctx.miLabRetune(k) === false && k.inLo === -90, k.inLo + ".." + k.inHi);
  ck("okno w swoich jednostkach nie budzi ostrzeżenia", ctx.miLabMismatch(base({})) === null);
}

// 4. SKALA PASA C — językiem odbiornika, nie w 0..1.
{
  const S = (p) => ctx.miLabOutScale(base(p));
  let s = S({dest: "cc", outLo: 10, outHi: 100});
  ck("CC 7-bit czyta swoje pola", s.lo === 10 && s.hi === 100);
  s = S({dest: "cc14"});
  ck("CC 14-bit: pełne 0–16383, oznaczone jako niezmienialne",
     s.lo === 0 && s.hi === 16383 && s.locked === true);
  s = S({dest: "pitchbend"});
  ck("Pitch Bend dodatkowo zna swój środek 8192", s.mid === 8192);
  s = S({dest: "note", mode: "continuous", loNote: 48, hiNote: 72});
  ck("nuta ciągła podpisana nazwami, nie numerami", s.fmt(60) === "C4", s.fmt(60));
  s = S({dest: "note", mode: "threshold", note: 60});
  ck("nuta progowa to jedna wartość", s.one === true && s.lo === 60);
  s = S({dest: "osc", oscProfile: "servoUs", oscType: "int", outLoF: 1000, outHiF: 2000});
  ck("OSC serwo: 1000–2000 z jednostką µs i bez części ułamkowej",
     s.lo === 1000 && s.hi === 2000 && s.unit === "µs" && s.fmt(1500.4) === "1500",
     [s.lo, s.hi, s.unit, s.fmt(1500.4)].join("|"));
  s = S({dest: "osc", oscProfile: "free", oscType: "float"});
  ck("OSC float: 0–1 z trzema miejscami", s.lo === 0 && s.hi === 1 && s.fmt(0.5) === "0.500");
  s = S({dest: "osc", oscProfile: "digital", oscType: "bool"});
  ck("OSC bool: dwa stany, nie liczby",
     s.bool === true && s.fmt(1) === "true" && s.fmt(0) === "false");
  s = S({dest: "osc", oscProfile: "pwm", oscType: "int", outLoF: 0, outHiF: 100});
  ck("OSC PWM niesie jednostkę procentu", s.unit === "%", s.unit);
}

// 5. `mo` z kluczem `x` — wartość wejścia w jednostkach źródła trafia do stanu i na wykres.
{
  const m = base({id: "m1", dest: "cc"});
  state.midi.mappings = [m];
  state._midiDraft = m;
  ctx.onMidiOut({items: [{id: "m1", v: 0.5, o: 64, s: true, n: 3, x: 45.2}], live: true});
  ck("`x` ze zdarzenia `mo` ląduje w stanie", state.midiOut.m1.x === 45.2, state.midiOut.m1.x);
  const v = ctx.miLabVal(m);
  ck("…i to ONO jest wartością wejścia, nie bufor panelu", v.v === 45.2 && v.raw === false,
     JSON.stringify(v));
  ctx.onMidiOut({items: [{id: "m1", v: 0.5, o: 64, s: false, n: 0}], live: true});
  const v2 = ctx.miLabVal(m);
  ck("bez `x` panel bierze swój bufor i PODPISUJE go jako surowy",
     v2.v === 34.2 && v2.raw === true, JSON.stringify(v2));
  ctx.onMidiOut({items: [], live: true});
  const v3 = ctx.miLabVal(base({id: "mX", srcKind: "axis", ch: 0}));
  ck("źródło „oś” ma awaryjnie surowy kanał", v3 && v3.v === 1200 && v3.raw === true,
     JSON.stringify(v3));
}

// 6. RYSOWANIE nie może rzucać — ani w żadnym trybie, ani przy zupełnym braku danych.
{
  for (const [dest, mode] of [["cc", "continuous"], ["osc", "threshold"], ["note", "continuous"],
                              ["pitchbend", "continuous"], ["program", "threshold"]]) {
    const m = base({id: "m1", dest, mode});
    state._midiDraft = m;
    let err = "";
    try { ctx.miLabDraw(); } catch (e) { err = String(e && e.message || e); }
    ck(`rysowanie nie rzuca: ${dest} / ${mode}`, !err, err);
  }
  const keepPose = state.pose, keepLast = state.last, keepOut = state.midiOut;
  state._midiDraft = base({id: "m1", dest: "cc", mode: "continuous"});
  state.pose = null; state.last = null; state.midiOut = {};
  let err = "";
  try { ctx.miLabDraw(); } catch (e) { err = String(e && e.message || e); }
  ck("rysowanie przy zerze danych też nie rzuca", !err, err);
  ck("…a nagłówek mówi wprost, że danych nie ma",
     /brak danych/.test(document.getElementById("miRngHead").textContent),
     document.getElementById("miRngHead").textContent);
  state.pose = keepPose; state.last = keepLast; state.midiOut = keepOut;
}

// 7. NAUKA — ciała żądań i podgląd z `mo`.
{
  const m = base({id: "m1", srcKind: "filter", metric: "tilt", dest: "cc"});
  state.midi.mappings = [m];
  state._midiDraft = m;
  ctx.miLabReset();
  // …tylko dla mapowania, które serwer już zna: świeży szkic nie ma wiersza w konfiguracji, więc
  // łańcuch nigdy nie policzy dla niego wartości i nauka zebrałaby zero próbek.
  ctx.miLabRenderLearn();
  ck("zapisane mapowanie: przycisk nauki aktywny",
     document.getElementById("miRngLearn").innerHTML.indexOf("disabled") < 0);
  state.midi.mappings = [];
  ctx.miLabRenderLearn();
  ck("nowe, niezapisane mapowanie: przycisk wyłączony z podpowiedzią",
     /disabled/.test(document.getElementById("miRngLearn").innerHTML)
     && /Najpierw dodaj mapowanie/.test(document.getElementById("miRngLearn").innerHTML));
  state.midi.mappings = [m];

  fetchCalls.length = 0;
  fetchReply = {ok: true, seconds: 5};
  ctx.miLabLearnStart("sym");
  await tick(); await tick();
  const st = fetchCalls[0];
  ck("start idzie na /midi/learn z kompletnym ciałem",
     st && st.url === "/midi/learn" && st.body.action === "start" && st.body.id === "m1"
     && st.body.mode === "p2p98" && st.body.symmetric === true && st.body.marginPct === 5
     && st.body.seconds === 5, JSON.stringify(st));
  ctx.miLabLearnCancel();
  fetchCalls.length = 0;
  ctx.miLabLearnStart("full");
  await tick(); await tick();
  ck("wariant „pełny zakres” wyłącza symetryzację", fetchCalls[0].body.symmetric === false);
  ctx.miLabLearnCancel();
  fetchCalls.length = 0;
  ctx.miLabLearnStart("auto");
  await tick(); await tick();
  ck("domyślnie: pochylenie jednostronne", fetchCalls[0].body.symmetric === false);
  ctx.miLabLearnCancel();
  fetchCalls.length = 0;
  state._midiDraft = base({id: "m1", srcKind: "filter", metric: "roll", dest: "cc"});
  state.midi.mappings = [state._midiDraft];
  ctx.miLabLearnStart("auto");
  await tick(); await tick();
  ck("…a roll dwustronnie", fetchCalls[0].body.symmetric === true);

  // Podgląd na żywo: klucz `learn` w `mo`, zero dodatkowych zapytań.
  fetchCalls.length = 0;
  ctx.onMidiOut({items: [], learn: {id: "m1", lo: -4.1, hi: 71.3, n: 120, left: 2400}});
  ck("podgląd nauki nie kosztuje ani jednego zapytania", fetchCalls.length === 0, fetchCalls.length);
  ck("…i pokazuje narastające min/max oraz odliczanie",
     /2\.4/.test(document.getElementById("miRngLearn").innerHTML)
     && /-4\.1/.test(document.getElementById("miRngLearn").innerHTML),
     document.getElementById("miRngLearn").innerHTML.slice(0, 160));

  // Koniec sesji: panel dopytuje o WYNIK i pokazuje go jako propozycję, nie zapis.
  fetchReply = {ok: true, learn: {result: {ok: true, inLo: -4.3, inHi: 71.5, span: 75.4}}};
  ctx.onMidiOut({items: [], learn: {id: "m1", lo: -4.1, hi: 71.3, n: 140, left: 0}});
  await tick(); await tick(); await tick();
  ck("po odliczeniu panel pyta o wynik", fetchCalls.some((c) => c.url === "/midi/learn" && !c.body));
  ck("wynik jest PROPOZYCJĄ z przyciskiem „Użyj”",
     /miRngUse/.test(document.getElementById("miRngLearn").innerHTML),
     document.getElementById("miRngLearn").innerHTML.slice(0, 200));

  fetchCalls.length = 0;
  fetchReply = {ok: true, id: "m1", inLo: -4.3, inHi: 71.5};
  ctx.miLabLearnApply();
  await tick(); await tick();
  const ap = fetchCalls[0];
  ck("„Użyj” wysyła apply z id mapowania",
     ap && ap.body.action === "apply" && ap.body.id === "m1", JSON.stringify(ap));
  ck("…i wpisuje zakres także do SZKICU w edytorze",
     state._midiDraft.inLo === -4.3 && state._midiDraft.inHi === 71.5,
     state._midiDraft.inLo + ".." + state._midiDraft.inHi);

  fetchCalls.length = 0;
  ctx.miLabLearnStart("auto");
  await tick(); await tick();
  fetchCalls.length = 0;
  ctx.miLabLearnCancel();
  ck("„Zatrzymaj” wysyła cancel", fetchCalls[0] && fetchCalls[0].body.action === "cancel",
     JSON.stringify(fetchCalls[0]));
}

// 8. Krzywa (pas B) podpisuje końce osi w JEDNOSTKACH — bez tego „t” i „wartość” nic nie mówią.
{
  const m = base({id: "m1", dest: "osc", oscProfile: "servoUs", oscType: "int",
                  outLoF: 1000, outHiF: 2000, inLo: 0, inHi: 90});
  state._midiDraft = m;
  const host = document.getElementById("mieCurvePrev");
  host.dataset = {};
  ctx.miDrawCurvePrev();
  ck("krzywa podpisana zakresem wejścia w stopniach",
     /0 °/.test(host.innerHTML) && /90 °/.test(host.innerHTML), host.innerHTML.slice(-320));
  ck("…i zakresem wyjścia w jednostkach odbiornika",
     /1000 µs/.test(host.innerHTML) && /2000 µs/.test(host.innerHTML), host.innerHTML.slice(-320));
  m.invert = true; host.dataset = {};
  ctx.miDrawCurvePrev();
  ck("„odwróć kierunek” zamienia końce osi X miejscami",
     host.innerHTML.indexOf("90 °") < host.innerHTML.indexOf("0 °"));
}

// 9. NAUKA A TRYB PROGU. Nauka wpisuje `inLo`/`inHi`, a próg porównuje wartość z `threshold` —
//    tej pary w ogóle nie czyta. Przycisk w progu byłby obietnicą bez pokrycia: pomiar się udaje,
//    liczby wskakują w pola, mapowanie odzywa się dokładnie tak samo jak przed nauką.
{
  const m = base({id: "m8", srcKind: "filter", metric: "tilt", dest: "cc", mode: "threshold"});
  state.midi.mappings = [m];
  state._midiDraft = m;
  ctx.miLabReset();
  const host = document.getElementById("miRngLearn");
  host.innerHTML = "resztka z poprzedniego renderu";
  ctx.miLabRenderLearn();
  ck("tryb progu: ani przycisku nauki, ani listy wariantów", host.innerHTML === "",
     host.innerHTML.slice(0, 140));
  m.mode = "continuous";
  ctx.miLabRenderLearn();
  ck("…a w trybie ciągłym przycisk wraca", /miRngLearnBtn/.test(host.innerHTML)
     && /miRngLearnVar/.test(host.innerHTML), host.innerHTML.slice(0, 140));
}

// 10. PAS C — liczba „teraz” MUSI być w skali szkicu. `it.o` przychodzi z mapowania ZAPISANEGO,
//     więc po zmianie celu w edytorze jest liczbą ze starej skali pod nową jednostką. Realny błąd
//     z klik-through: „teraz 104 µs”, gdzie 104 pochodziło z CC 0–127, a podpis mówił o serwie.
{
  const head = document.getElementById("miRngOutHead");
  state.midi.mappings = [base({id: "m9", dest: "cc", outLo: 0, outHi: 127})];
  state._midiDraft = base({id: "m9", dest: "osc", oscProfile: "servoUs", oscType: "int",
                           outLoF: 1000, outHiF: 2000});
  ctx.onMidiOut({items: [{id: "m9", v: 0.5, o: 64, s: false, n: 1}], live: true});
  ctx.miLabDraw();
  ck("inny cel niż zapisany: pas C przelicza z `v` przez skalę szkicu (1500 µs, nie 64)",
     /1500 µs/.test(head.textContent) && !/\b64\b/.test(head.textContent), head.textContent);
  state.midi.mappings = [base({id: "m9", dest: "cc", outLo: 0, outHi: 127})];
  state._midiDraft = base({id: "m9", dest: "cc", outLo: 0, outHi: 127});
  ctx.miLabDraw();
  ck("cel i zakres zgodne z zapisanym: pokazujemy `o` z serwera (dokładniejsze)",
     / 64\b/.test(head.textContent), head.textContent);
  state._midiDraft = base({id: "m9", dest: "cc", outLo: 0, outHi: 63});
  ctx.miLabDraw();
  ck("zwężony zakres wyjścia w szkicu to inna skala: 32, nie 64",
     / 32\b/.test(head.textContent), head.textContent);
  state._midiDraft = base({id: "mNEW", dest: "osc", oscProfile: "servoUs", oscType: "int",
                           outLoF: 1000, outHiF: 2000});
  ctx.miLabDraw();
  ck("mapowanie bez wpisu w `mo`: kreska i podpis „po zapisie”",
     /—/.test(head.textContent) && /po zapisie/.test(head.textContent), head.textContent);
  state._midiDraft = base({id: "m9", dest: "note", mode: "continuous", loNote: 48, hiNote: 72});
  ctx.miLabDraw();
  ck("cel zdarzeniowy po zmianie celu: nuta liczona z `v`, nie z `o` po CC",
     / C4\b/.test(head.textContent), head.textContent);
}

// 11. SUWAKI PRZY POLACH — i JEDEN element na id w CAŁYM edytorze.
//     Zakres wejścia i wyjścia dostały suwaki, a wiersz sterowania jest teraz JEDEN na pas, budowany
//     zależnie od trybu. Poprzedni układ trzymał oba komplety pól naraz i chował nieużywany przez
//     `display:none` — przy takim schemacie wystarczy jedno przeoczenie, żeby „odwróć kierunek"
//     albo „min" istniało dwa razy. `wireMidiEditor` czyta formularz po `getElementById`, czyli
//     bierze PIERWSZY z brzegu: mapowanie zapisywałoby się z pola, którego user nie widzi, przy
//     zerze błędów w konsoli. Dlatego unikalność id jest tu najważniejszą asercją.
{
  const dupes = [], variants = [];
  for (const dest of ["cc", "cc14", "pitchbend", "aftertouch", "program", "note", "osc"]) {
    for (const mode of ["continuous", "threshold"]) {
      // „free" nie wywodzi typu, więc obie jego odmiany trzeba sprawdzić osobno: `float` jest
      // w silniku przypięty do 0..1 (nie ma czego regulować), `int` już nie.
      for (const prof of (dest === "osc"
            ? ["unit", "servoUs", "digital", "free", "free+int"] : [null])) {
        const m = base({id: "mR", dest, mode});
        if (prof) {
          m.oscProfile = prof.split("+")[0]; ctx.miApplyProfile(m);
          if (prof === "free+int") m.oscType = "int";
        }
        state._midiDraft = m; state._midiEditIsNew = false;
        ctx.renderMidiEditor();
        const html = document.getElementById("miEditor").innerHTML;
        const name = dest + "/" + mode + (prof ? "/" + prof : "");
        variants.push([name, m, html]);
        const seen = new Set(), bad = [];
        for (const raw of (html.match(/\sid="[^"]+"/g) || [])) {
          const id = raw.slice(5, -1);
          if (seen.has(id)) bad.push(id);
          seen.add(id);
        }
        if (bad.length) dupes.push(name + ": " + bad.join(","));
      }
    }
  }
  ck("żaden wariant edytora nie ma dwóch elementów o tym samym id", !dupes.length, dupes.join(" | "));

  const V = (n) => variants.find((v) => v[0] === n);
  const has = (n, id) => V(n)[2].indexOf('id="' + id + '"') >= 0;
  ck("tryb ciągły: dwa uchwyty okna wejścia, bez suwaka progu",
     has("cc/continuous", "mieInLoR") && has("cc/continuous", "mieInHiR")
     && !has("cc/continuous", "miRngThrR"));
  ck("tryb progu: suwak progu, bez uchwytów okna",
     has("cc/threshold", "miRngThrR") && !has("cc/threshold", "mieInLoR"));
  for (const n of ["cc/continuous", "aftertouch/continuous", "note/continuous",
                   "osc/continuous/servoUs", "osc/continuous/unit", "osc/continuous/free+int"])
    ck(`pas C ma suwak zakresu: ${n}`, has(n, "mieOutLoR") && has(n, "mieOutHiR"));
  for (const n of ["cc14/continuous", "pitchbend/continuous", "program/threshold",
                   "note/threshold", "osc/continuous/digital", "osc/continuous/free"])
    ck(`pas C bez suwaka tam, gdzie skala jest stała: ${n}`,
       !has(n, "mieOutLoR") && !has(n, "mieOutHiR"));

  // Uchwyty mają stać dokładnie pod krawędziami jasnego prostokąta, więc chodzą po TEJ SAMEJ osi,
  // którą płótno mapuje na piksele — jedna funkcja dla obu (`miLabAxisView`).
  {
    let bad = "";
    for (const [key, ch] of [["tilt", null], ["twist", null], ["spin", null], [null, 0]]) {
      const m = key ? base({srcKind: "filter", metric: key}) : base({srcKind: "axis", ch});
      const html = ctx.miLabSectionHtml(m, false);
      const w = ctx.miLabAxisView(m);
      const want = `min="${w.lo}" max="${w.hi}"`;
      if (html.indexOf('id="mieInLoR" ' + want) < 0) bad += (key || "axis") + ":" + want + " ";
    }
    ck("zakres suwaka wejścia = widoczny zakres osi pasa A", !bad, bad);
  }
  ck("krok suwaka: 1 dla stopni, 0.5 dla °/s, 10 dla surowych LSB",
     ctx.miLabStep(ctx.miLabAxis(base({metric: "tilt"}))) === 1
     && ctx.miLabStep(ctx.miLabAxis(base({metric: "twist"}))) === 0.5
     && ctx.miLabStep(ctx.miLabAxis(base({srcKind: "axis"}))) === 10);

  {
    const b = ctx.miLabOutBounds(base({dest: "osc", oscProfile: "servoUs", oscType: "int",
                                       outLoF: 1200, outHiF: 1800}), false);
    ck("suwak wyjścia OSC serwo chodzi po pełnych możliwościach urządzenia: 1000–2000",
       b && b.lo === 1000 && b.hi === 2000 && b.step === 1, JSON.stringify(b));
    ck("…i jest zablokowany, dopóki nie włączono własnego zakresu roboczego", b.locked === true);
    const b2 = ctx.miLabOutBounds(base({dest: "osc", oscProfile: "servoUs", oscType: "int",
                                        oscRangeCustom: true, outLoF: 1200, outHiF: 1800}), false);
    ck("…a po włączeniu odblokowany", b2.locked === false);
    const b3 = ctx.miLabOutBounds(base({dest: "osc", oscProfile: "free", oscType: "int",
                                        outLoF: -5, outHiF: 40}), false);
    ck("profil „własny” nie zna granic urządzenia, więc suwak obejmuje wpisane liczby",
       b3.lo === -5 && b3.hi === 40, JSON.stringify(b3));
    const b4 = ctx.miLabOutBounds(base({dest: "note", mode: "continuous"}), false);
    ck("nuta ciągła: suwak trzyma się listy nut z `miNoteOptions` (24–96)",
       b4.lo === 24 && b4.hi === 96, JSON.stringify(b4));
  }
}

// 12. CHIP „ZAKRES NIE PASUJE" — musi POWSTAWAĆ RAZEM Z SEKCJĄ, nie obok niej.
//     Realny przypadek z klik-through: mapowanie „Pochylenie 0–90", user wpisuje w min „−5”
//     i przełącza źródło na „Oś (kanał)". Liczby zostają (bo są tknięte) — ale okno −5…73 na osi
//     ±32768 to jedna tysięczna skali, czyli mapowanie martwe. Panel MUSI o tym powiedzieć
//     i dać jeden klik wyjścia. Wcześniej chip dokładał `renderMidiEditor` osobno, na warunku
//     tak wąskim, że ten przypadek go nie spełniał — w DOM nie było ani słowa „nie pasuje".
{
  const m = base({id: "mFIT", srcKind: "filter", metric: "tilt", inLo: -5, inHi: 73.11});
  m.srcKind = "axis"; m.ch = 0;                       // dokładnie ta ścieżka co segment „Oś (kanał)"
  ck("tknięty zakres po zmianie źródła NIE jest przeliczany po cichu",
     ctx.miLabRetune(m) === false && m.inLo === -5, m.inLo + ".." + m.inHi);
  const sec = ctx.miLabSectionHtml(m, false);
  ck("…a chip niedopasowania jest w markupie SAMEGO laboratorium",
     sec.indexOf('id="miRngMismatch"') >= 0 && /nie pasuje/.test(sec)
     && sec.indexOf('id="mieRngFix"') >= 0, sec.indexOf('id="miRngMismatch"'));
  state._midiDraft = m; state._midiEditIsNew = false;
  ctx.renderMidiEditor();
  const ed = () => document.getElementById("miEditor").innerHTML;
  ck("chip dociera do zbudowanego formularza (jeden raz)",
     /nie pasuje/.test(ed()) && (ed().match(/id="mieRngFix"/g) || []).length === 1,
     (ed().match(/id="mieRngFix"/g) || []).length);
  const fix = document.getElementById("mieRngFix");
  ck("przycisk „Dopasuj” jest podpięty", typeof fix.onclick === "function");
  if (typeof fix.onclick === "function") fix.onclick();
  ck("…i wpisuje domyślne NOWEGO źródła", m.inLo === -16000 && m.inHi === 16000,
     m.inLo + ".." + m.inHi);
  ck("…po czym chip znika", !/nie pasuje/.test(ed()) && ed().indexOf('id="mieRngFix"') < 0);
  // Nietknięte okno idzie ścieżką cichego przeliczenia — tam chip byłby hałasem bez treści.
  const q = base({srcKind: "filter", metric: "tilt"});
  q.srcKind = "axis";
  ck("nietknięte okno: ciche przeliczenie, bez chipu",
     ctx.miLabRetune(q) === true && ctx.miLabMismatch(q) === null
     && !/nie pasuje/.test(ctx.miLabSectionHtml(q, false)), q.inLo + ".." + q.inHi);
  ck("okno pokrywające ułamek osi to też niedopasowanie",
     !!ctx.miLabMismatch(base({srcKind: "axis", ch: 0, inLo: 0, inHi: 100})),
     ctx.miLabMismatch(base({srcKind: "axis", ch: 0, inLo: 0, inHi: 100})));
  ck("wielkość nieujemna z ujemnym minimum to niedopasowanie",
     !!ctx.miLabMismatch(base({srcKind: "filter", metric: "spin", inLo: -500, inHi: 12000})));
  ck("w trybie progu chip milczy (inLo/inHi nie są tam czytane)",
     !/nie pasuje/.test(ctx.miLabSectionHtml(base({srcKind: "axis", ch: 0, inLo: 0, inHi: 100}),
                                             true)));
}

// 13. SUWAK LEŻY POD WYKRESEM. Zmierzone w przeglądarce przed poprawką: płótno pasa A x 291–1031,
//     tor suwaka x 389–770 — pola liczbowe stały po bokach i zabierały mu szerokość, więc uchwyty
//     przy 50,89 / 73,11 stały ~45 px obok krawędzi jasnego prostokąta. Szerokość toru nie jest
//     kosmetyką: to jedyny powód, dla którego wolno pokazywać uchwyt jako „krawędź okna".
//     Dlatego dwie asercje: STRUKTURA (płótno i suwak są rodzeństwem w jednym kontenerze pełnej
//     szerokości, a liczby stoją nad torem) i CSS (żadnej stałej szerokości na torach).
{
  // Wnętrze elementu o danym id — z liczeniem zagnieżdżeń, żeby „rodzeństwo" znaczyło rodzeństwo.
  const innerOf = (html, id) => {
    const at = html.indexOf('id="' + id + '"');
    if (at < 0) return null;
    let i = html.indexOf(">", at) + 1;
    const from = i;
    let depth = 1;
    while (i < html.length && depth > 0) {
      const open = html.indexOf("<div", i), close = html.indexOf("</div", i);
      if (close < 0) return null;
      if (open >= 0 && open < close) { depth++; i = open + 4; } else { depth--; i = close + 5; }
    }
    return html.slice(from, i - 5);
  };
  const secA = ctx.miLabSectionHtml(base({srcKind: "filter", metric: "tilt"}), false);
  const plotA = innerOf(secA, "miRngPlotA");
  ck("pas A: płótno i suwak w JEDNYM kontenerze",
     !!plotA && plotA.indexOf('id="miLabCv"') >= 0 && plotA.indexOf('id="mieInLoR"') >= 0
     && plotA.indexOf('id="mieInHiR"') >= 0, plotA && plotA.length);
  ck("…a liczby stoją NAD torem, nie po jego bokach",
     !!plotA && plotA.indexOf('id="mieInLo"') < plotA.indexOf('id="mieInLoR"')
     && plotA.indexOf('id="mieInHi"') < plotA.indexOf('id="mieInLoR"'));
  const secT = ctx.miLabSectionHtml(base({srcKind: "filter", metric: "tilt"}), true);
  const plotT = innerOf(secT, "miRngPlotA");
  ck("przebieg progu: to samo, plus znacznik szerszego marginesu osi Y",
     !!plotT && plotT.indexOf('id="miLabCv"') >= 0 && plotT.indexOf('id="miRngThrR"') >= 0
     && /class="mi-rng-plot is-thr"/.test(secT));
  const secC = ctx.miLabSectionHtml(base({dest: "cc"}), false);
  const plotC = innerOf(secC, "miRngPlotC");
  ck("pas C: pasek wyjścia i jego suwak w jednym kontenerze, liczby nad torem",
     !!plotC && /mi-rng-outbar/.test(plotC) && plotC.indexOf('id="mieOutLoR"') >= 0
     && plotC.indexOf('id="mieOutLo"') < plotC.indexOf('id="mieOutLoR"'));

  const css = fs.readFileSync(path.join(REPO, "web/css/06-connect-midi-pads.css"), "utf8");
  const blocks = (sel) => (css.match(new RegExp("[^}]*\\" + sel + "[^{}]*\\{[^}]*\\}", "g")) || []);
  let fixed = "";
  for (const sel of [".mi-rng-dual", ".mi-rng-one"])
    for (const b of blocks(sel))
      if (/[^-]width:\s*\d+px/.test(b)) fixed += b.trim().slice(0, 80) + " ";
  ck("CSS nie przypina torom stałej szerokości", !fixed, fixed);
  ck("tor dostaje marginesy równe marginesom kreślenia płótna (Pl/Pr, minus pół kciuka)",
     /--rf-pl:8px/.test(css) && /--rf-pr:8px/.test(css) && /\.mi-rng-plot\.is-thr\{--rf-pl:44px\}/.test(css)
     && /margin:2px calc\(var\(--rf-pr\) - var\(--rf-thumb\)\/2\) 0 calc\(var\(--rf-pl\) - var\(--rf-thumb\)\/2\)/.test(css));
  ck("pas C: to pasek dostaje boczne 8 px, a nie tor (ujemny margines = szczelina w karcie)",
     /\.mi-rng-plot-out \.mi-rng-outbar,\.mi-rng-plot-out \.mi-rng-ends\{margin-left:8px;margin-right:8px\}/.test(css));
  ck("pusty host chipu nie zostawia dziury w układzie", /\.mi-rng-warn:empty\{display:none\}/.test(css));
  // Pl/Pr w CSS muszą być tymi samymi liczbami, co w kodzie rysującym — inaczej wyrównanie
  // rozjedzie się po pierwszej zmianie po tamtej stronie i nikt tego nie zauważy.
  const lab = fs.readFileSync(path.join(REPO, "web/js/rf-16c-midi-lab.js"), "utf8");
  ck("…i te liczby zgadzają się z kodem rysującym",
     /const Pl=8,Pr=8,/.test(lab) && /const Pl=44,Pr=8,/.test(lab));
}

console.log(JSON.stringify({checks}));
