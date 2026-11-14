// WŁASNA PRÓBKA BRZMIENIA (Synth › Biblioteka dźwięków › Próbka, rf-25f, 2026-10-19) — BEZ PRZEGLĄDARKI.
//
// Strona przeglądarkowa tej funkcji ma trzy miejsca, w których cicha pomyłka znaczy brzmienie grające nie tę nutę,
// co pokazuje pokrętło, albo brzmienie bez próbki po zapisie:
//   • sanitizePatch (rf-20) — `smp` wchodzi do zapisu razem ze strojem i pętlą, a brzmienie BEZ próbki ma wyjść
//     z niego bajt w bajt takie, jak przed tą zmianą (żaden stary patch nie może dostać nowego klucza);
//   • PadAudio._smpRate (rf-21) — ile razy szybciej ma biec nagranie, żeby zagrało żądaną nutę;
//   • PadSampler.readInto / setForm (rf-25f) — formularz → patch → formularz, z pętlą liczoną w sekundach
//     w patchu i w procentach na suwakach.
// Wszystko na PRAWDZIWYCH plikach panelu, z najmniejszą możliwą atrapą DOM.
// Wywoływane z tests/test_synth_store.py; samodzielnie: node tests/synth_probki_harness.mjs
// Ostatnia linia wyjścia = JSON {checks:[[nazwa, ok, szczegół], …]}; kod wyjścia 1, gdy coś nie przeszło.
// (Nazwy sprawdzeń bez polskich znaków — test_synth_store.py drukuje je print()-em na konsoli cp1250.)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);
const J = o => JSON.stringify(o);
const read = f => fs.readFileSync(path.join(REPO, f), "utf8");

// ---------- atrapa DOM: tylko pola karty „Probka” ----------
const els = new Map();
const mk = (id, value) => {const e = {id, value: String(value), checked: false, hidden: false, textContent: "",
  disabled: false, classList: {toggle() {}, add() {}, remove() {}, contains: () => false},
  addEventListener() {}, querySelectorAll: () => []};
  els.set(id, e); return e;};
for (const [id, v] of [["seSmpId", ""], ["seSmpSr", 32000], ["seSmpLen", 0], ["seSmpSrc", "file"],
  ["seSmpRoot", 60], ["seSmpCent", 0], ["seSmpStart", 0], ["seSmpEnd", 100], ["seSmpLvl", 1],
  ["seSmpFrom", 10], ["seSmpTo", 60], ["seSmpGlue", 20],
  ["seSmpRootV", ""], ["seSmpCentV", ""], ["seSmpStartV", ""], ["seSmpEndV", ""], ["seSmpLvlV", ""],
  ["seSmpFromV", ""], ["seSmpToV", ""], ["seSmpGlueV", ""],
  ["seSmpNote", ""], ["seSmpInfo", ""], ["seSmpWave", ""], ["soundEditor", ""], ["seFMin", 260], ["seFMax", 7800], ["seQ", 6]])
  mk(id, v);
els.get("seSmpWave").hidden = true;                    // bez rysowania: kanwy w Node nie ma
for (const id of ["seSmpLoop", "seSmpRev", "seSmpFix", "seSmpNorm", "seSmpCount"]) mk(id, "").checked = false;
const document = {getElementById: id => els.get(id) || null, querySelectorAll: () => [], createElement: () => mk("x", "")};

const ctx = {console, Math, Number, JSON, Array, Object, Map, Set, String, Boolean, Float32Array, WeakMap,
  Error, Infinity, isFinite, parseFloat, parseInt, document, setTimeout, clearTimeout,
  window: {}, navigator: {}, fetch: () => Promise.reject(new Error("brak sieci w harnessie")),
  _gl: (pl) => pl, _seMsg: () => {}, XPAD: {customSounds: {}, baseOverrides: {}},
  getComputedStyle: () => ({getPropertyValue: () => ""})};
ctx.window.window = ctx.window;
ctx.globalThis = ctx;
vm.createContext(ctx);
const run = (kod, nazwa) => vm.runInContext(kod, ctx, {filename: nazwa});

try {
  // ---------- sanitizePatch (rf-20) ----------
  // Wycinamy samą funkcję: cały plik rusza model padów, którego tu nie ma.
  const gm = read("web/js/rf-20-gate-model.js");
  const i = gm.indexOf("function sanitizePatch(");
  const koniec = gm.indexOf("\nfunction customSoundsSer(");
  run(gm.slice(i, koniec), "sanitizePatch");

  const BEZ = {wave: "square", legato: true, oct: 0, det: 0, att: .02, fMin: 200, fMax: 6000, q: 1, lvl: .4};
  const czysty = run(`sanitizePatch(${J(BEZ)})`);
  ck("sanitizePatch: brzmienie bez probki nie dostaje ani jednego nowego klucza",
    !["smp", "smpSr", "smpLen", "smpRoot", "smpLoop"].some(k => k in czysty), J(czysty));
  const zProbka = run(`sanitizePatch(${J(Object.assign({}, BEZ, {smp: "s-abc123", smpSr: 32000, smpLen: 48000, smpRoot: 64.5, smpLoop: [0.25, 1.1]}))})`);
  ck("sanitizePatch: probka przechodzi z id, czestotliwoscia, dlugoscia, strojem i petla",
    zProbka.smp === "s-abc123" && zProbka.smpSr === 32000 && zProbka.smpLen === 48000
    && zProbka.smpRoot === 64.5 && J(zProbka.smpLoop) === "[0.25,1.1]", J(zProbka));
  ck("sanitizePatch: dwa obiegi zapisu nie zmieniaja patcha z probka",
    J(run(`sanitizePatch(${J(zProbka)})`)) === J(zProbka));
  const zly = run(`sanitizePatch(${J(Object.assign({}, BEZ, {smp: "s-a/../b", smpRoot: 64}))})`);
  ck("sanitizePatch: id ze sciezka odpada razem ze strojem i petla", !("smp" in zly) && !("smpRoot" in zly), J(zly));
  const obciety = run(`sanitizePatch(${J(Object.assign({}, BEZ, {smp: "s-ab", smpRoot: 999, smpSr: 1, smpLoop: [2, 1]}))})`);
  ck("sanitizePatch: stroj i czestotliwosc przyciete do zakresow",
    obciety.smpRoot === 108 && obciety.smpSr === 8000, J(obciety));
  ck("sanitizePatch: petla konczaca sie przed poczatkiem jest odrzucana, nie prostowana",
    !("smpLoop" in obciety), J(obciety.smpLoop));
  const zSzumem = run(`sanitizePatch(${J(Object.assign({}, BEZ, {smp: "s-abc123", noise: true, croak: true, am: 29}))})`);
  ck("sanitizePatch: probka wyklucza szum i rechot (obie maja wlasna galaz przed nia w _mkVoice)",
    zSzumem.smp === "s-abc123" && !("noise" in zSzumem) && !("croak" in zSzumem) && !("am" in zSzumem), J(zSzumem));

  // ---------- wiecej kontroli nad probka (2026-10-20) ----------
  // Szesc nastaw emitowanych TYLKO przy wartosci innej niz domyslna: brzmienie z probka zapisane przed ta
  // zmiana musi wyjsc z sanitizePatch bajt w bajt takie samo, bo inaczej zmienia sie odcisk sceny.
  const DWA_S = {smp: "s-abc123", smpSr: 32000, smpLen: 64000};   // 2 s probki
  const dom = run(`sanitizePatch(${J(Object.assign({}, BEZ, DWA_S, {smpOd: 0, smpDo: 2, smpCent: 0, smpPoziom: 1,
    smpWstecz: false, smpZlep: 0, smpStaly: false}))})`);
  ck("sanitizePatch: nastawy domyslne nie dopisuja ani jednego klucza (odcisk sceny bez ruchu)",
    !["smpOd", "smpDo", "smpCent", "smpPoziom", "smpWstecz", "smpZlep", "smpStaly"].some(k => k in dom), J(dom));
  const nast = run(`sanitizePatch(${J(Object.assign({}, BEZ, DWA_S, {smpOd: .5, smpDo: 1.5, smpCent: -17,
    smpPoziom: 1.4, smpWstecz: true, smpZlep: .02, smpStaly: true}))})`);
  ck("sanitizePatch: wycinek, centy, poziom, kierunek, zlepek i 'nie przestrajaj' przechodza",
    nast.smpOd === .5 && nast.smpDo === 1.5 && nast.smpCent === -17 && nast.smpPoziom === 1.4
    && nast.smpWstecz === true && nast.smpZlep === .02 && nast.smpStaly === true, J(nast));
  ck("sanitizePatch: dwa obiegi zapisu nie zmieniaja patcha z pelnymi nastawami",
    J(run(`sanitizePatch(${J(nast)})`)) === J(nast));
  const doKonca = run(`sanitizePatch(${J(Object.assign({}, BEZ, DWA_S, {smpOd: .5, smpDo: 2}))})`);
  ck("sanitizePatch: koniec siegajacy konca probki to BRAK klucza (do konca, nie liczba)",
    doKonca.smpOd === .5 && !("smpDo" in doKonca), J(doKonca));
  const zleNast = run(`sanitizePatch(${J(Object.assign({}, BEZ, DWA_S, {smpOd: -5, smpDo: .2, smpCent: 999,
    smpPoziom: 99, smpZlep: 9}))})`);
  ck("sanitizePatch: nastawy poza zakresem sa przyciete (start pod zero znaczy od zera)",
    !("smpOd" in zleNast) && zleNast.smpDo === .2 && zleNast.smpCent === 50 && zleNast.smpPoziom === 2
    && zleNast.smpZlep === .2, J(zleNast));
  const wspak = run(`sanitizePatch(${J(Object.assign({}, BEZ, DWA_S, {smpOd: 1.5, smpDo: 1}))})`);
  ck("sanitizePatch: koniec przed poczatkiem jest odrzucony, nie prostowany (zostaje „do konca”)",
    wspak.smpOd === 1.5 && !("smpDo" in wspak), J(wspak));
  ck("sanitizePatch: nastawy bez `smp` nie wchodza do patcha (same nie znacza nic)",
    !("smpOd" in run(`sanitizePatch(${J(Object.assign({}, BEZ, {smpOd: .5, smpPoziom: 1.4, smpStaly: true}))})`)));

  // ---------- PadAudio._smpRate (rf-21) ----------
  // `padFreq` (nuta → herc) stoi w innym pliku panelu; tu wystarcza wzorzec, bo sprawdzamy sam tor probki.
  run("var padFreq=function(n){return 440*Math.pow(2,(n-69)/12);};");
  run(read("web/js/rf-21-pad-audio.js") + "\n;globalThis.PadAudio=PadAudio;", "rf-21-pad-audio.js");
  const r = (f, root, okt) => run(`PadAudio._smpRate(${f},${root},${okt})`);
  ck("tempo probki: nuta rowna strojowi gra 1:1", Math.abs(r(440, 69, 1) - 1) < 1e-9, r(440, 69, 1));
  ck("tempo probki: oktawa wyzej = dwa razy szybciej", Math.abs(r(880, 69, 1) - 2) < 1e-9, r(880, 69, 1));
  ck("tempo probki: oktawa nizej = dwa razy wolniej", Math.abs(r(220, 69, 1) - .5) < 1e-9, r(220, 69, 1));
  ck("tempo probki: przelacznik oktawy mnozy sie z nuta", Math.abs(r(440, 69, 2) - 2) < 1e-9, r(440, 69, 2));
  ck("tempo probki: bezsensowny stroj nie zatrzymuje zrodla", r(440, 1e9, 1) >= .03 && r(1e9, 1, 1) <= 32,
    [r(440, 1e9, 1), r(1e9, 1, 1)].join(" "));
  // „Nie przestrajaj” = stroj null. Ruch trzymanej nuty nie moze wtedy ruszyc playbackRate ani o krok,
  // inaczej klasniecie zmienialoby wysokosc w trakcie glissanda.
  ck("tempo probki: nie przestrajaj (stroj null) nie rusza tempa przy zmianie nuty",
    run(`(function(){var ruchy=0,v={smp:{root:null,octMul:1,src:{playbackRate:{
        setTargetAtTime:function(){ruchy++;},cancelScheduledValues:function(){ruchy++;},setValueAtTime:function(){ruchy++;}}}}};
      PadAudio._setSmpRate(v,72,0,.01,false);PadAudio._setSmpRate(v,48,0,.01,true);
      var w={smp:{root:60,octMul:1,src:{playbackRate:{setTargetAtTime:function(){ruchy+=100;},
        cancelScheduledValues:function(){},setValueAtTime:function(){}}}}};
      PadAudio._setSmpRate(w,72,0,.01,false);
      return ruchy===100;})()`));

  // ---------- PadSampler.readInto / setForm (rf-25f) ----------
  run(read("web/gry/js/probki-audio.js"), "probki-audio.js");
  run(read("web/js/rf-25f-sampler.js") + "\n;globalThis.PadSampler=PadSampler;", "rf-25f-sampler.js");
  ck("PadSampler: pusty formularz nie dopisuje probki do patcha",
    !("smp" in run("PadSampler.readInto({})")), J(run("PadSampler.readInto({})")));
  // 2 s probki, petla 25–75 % → 0,5–1,5 s w patchu
  els.get("seSmpId").value = "s-abc123"; els.get("seSmpSr").value = "32000"; els.get("seSmpLen").value = "64000";
  els.get("seSmpRoot").value = "64.5"; els.get("seSmpLoop").checked = true;
  els.get("seSmpFrom").value = "25"; els.get("seSmpTo").value = "75";
  const p1 = run("PadSampler.readInto({})");
  ck("PadSampler: formularz oddaje id, stroj i petle w sekundach",
    p1.smp === "s-abc123" && p1.smpRoot === 64.5 && Math.abs(p1.smpLoop[0] - .5) < 1e-6 && Math.abs(p1.smpLoop[1] - 1.5) < 1e-6, J(p1));
  els.get("seSmpLoop").checked = false;
  ck("PadSampler: bez zapetlenia patch nie niesie petli", !("smpLoop" in run("PadSampler.readInto({})")));
  // patch → formularz → patch: ta sama tresc
  els.get("seSmpId").value = ""; els.get("seSmpLen").value = "0"; els.get("seSmpRoot").value = "60";
  run(`PadSampler.setForm(${J(p1)})`);
  const p2 = run("PadSampler.readInto({})");
  ck("PadSampler: patch -> formularz -> patch wraca ten sam", J(p2) === J(p1), J(p2) + " vs " + J(p1));
  ck("PadSampler: procenty petli odtworzone z sekund",
    els.get("seSmpFrom").value === "25" && els.get("seSmpTo").value === "75",
    els.get("seSmpFrom").value + "/" + els.get("seSmpTo").value);
  run("PadSampler.setForm({})");
  ck("PadSampler: brzmienie bez probki czysci formularz", els.get("seSmpId").value === "" && !els.get("seSmpLoop").checked);

  // ---------- formularz z pelnymi nastawami: patch -> formularz -> patch (2026-10-20) ----------
  // Tu cicha pomylka znaczy brzmienie grajace inny kawalek niz ten, ktory pokazuje przebieg: procenty na
  // pokretlach i sekundy w patchu musza sie zgadzac w obie strony.
  const PELNY = {smp: "s-abc123", smpSr: 32000, smpLen: 64000, smpRoot: 64.5, smpCent: -17, smpOd: .5, smpDo: 1.5,
    smpPoziom: 1.4, smpWstecz: true, smpStaly: true, smpLoop: [.75, 1.25], smpZlep: .02};
  run(`PadSampler.setForm(${J(PELNY)})`);
  ck("PadSampler: sekundy z patcha wracaja procentami na pokretlach",
    els.get("seSmpStart").value === "25" && els.get("seSmpEnd").value === "75"
    && els.get("seSmpFrom").value === "37.5" && els.get("seSmpTo").value === "62.5"
    && els.get("seSmpGlue").value === "20",
    [els.get("seSmpStart").value, els.get("seSmpEnd").value, els.get("seSmpFrom").value,
     els.get("seSmpTo").value, els.get("seSmpGlue").value].join("/"));
  ck("PadSampler: przelaczniki wracaja z patcha",
    els.get("seSmpRev").checked && els.get("seSmpFix").checked && els.get("seSmpLoop").checked);
  const pelnyWroc = run("PadSampler.readInto({})");
  ck("PadSampler: patch z pelnymi nastawami -> formularz -> patch wraca ten sam",
    J(pelnyWroc) === J(PELNY), J(pelnyWroc) + " vs " + J(PELNY));
  ck("PadSampler: patch -> nastawy dla ProbkiAudio.wytnij (sekundy, nie procenty)",
    run(`(function(){var e=PadSampler.edycja(${J(PELNY)});
      return e.od===.5&&e.koniec===1.5&&e.poziom===1.4&&e.wstecz===true&&e.zlep===.02
        &&e.petla[0]===.75&&e.petla[1]===1.25;})()`),
    run(`JSON.stringify(PadSampler.edycja(${J(PELNY)}))`));

  // ---------- bufor do grania: nastawy sa W BAJTACH, wiec klucz pamieci podrecznej je niesie ----------
  run(`var _kt=function(){return {createBuffer:function(ch,len,sr){var d=new Float32Array(len);
      return {length:len,duration:len/sr,sampleRate:sr,copyToChannel:function(src){d.set(src);},dane:d};}};};
    var _c1=_kt(),_c2=_kt();
    var _d=new Float32Array(32000);for(var i=0;i<32000;i++)_d[i]=Math.sin(2*Math.PI*100*i/32000)*0.8;
    PadSampler._mem.set("s-buf11",{dane:_d,sr:32000,v:1});`);
  const BUF = {smp: "s-buf11", smpSr: 32000, smpLen: 32000};
  ck("PadSampler.graj: bufor niesie WYCINEK, nie cale bajty",
    run(`(function(){var a=PadSampler.graj(_c1,${J(BUF)}),b=PadSampler.graj(_c1,${J(Object.assign({}, BUF, {smpOd: .25, smpDo: .75}))});
      return a.buf.length===32000&&Math.abs(b.buf.length-16000)<=2;})()`),
    run(`JSON.stringify([PadSampler.graj(_c1,${J(BUF)}).buf.length,
      PadSampler.graj(_c1,${J(Object.assign({}, BUF, {smpOd: .25, smpDo: .75}))}).buf.length])`));
  ck("PadSampler.graj: ten sam patch i ten sam kontekst nie licza bufora od nowa",
    run(`PadSampler.graj(_c1,${J(BUF)})===PadSampler.graj(_c1,${J(BUF)})`));
  ck("PadSampler.graj: inne nastawy = inny bufor (dwa brzmienia na tych samych bajtach nie dziela wycinka)",
    run(`PadSampler.graj(_c1,${J(BUF)})!==PadSampler.graj(_c1,${J(Object.assign({}, BUF, {smpPoziom: .5}))})`));
  ck("PadSampler.graj: kazdy kontekst ma swoje bufory",
    run(`PadSampler.graj(_c1,${J(BUF)})!==PadSampler.graj(_c2,${J(BUF)})`));
  ck("PadSampler.graj: petla wraca przeliczona na bufor, nie na nagranie",
    run(`(function(){var g=PadSampler.graj(_c1,${J(Object.assign({}, BUF, {smpOd: .2, smpDo: .8, smpLoop: [.3, .5]}))});
      return g.petla&&Math.abs(g.petla[0]-.1)<.01&&Math.abs(g.petla[1]-.3)<.01;})()`),
    run(`JSON.stringify(PadSampler.graj(_c1,${J(Object.assign({}, BUF, {smpOd: .2, smpDo: .8, smpLoop: [.3, .5]}))}).petla)`));
  ck("PadSampler.graj: pamiec podreczna ma sufit (krecenie pokretlem nie zjada megabajtow)",
    run(`(function(){for(var i=0;i<20;i++)PadSampler.graj(_c1,Object.assign({},${J(BUF)},{smpPoziom:1+i/100}));
      var m=PadSampler._bufs.get(_c1);return m.q.length<=PadSampler.MAX_BUF&&Object.keys(m.k).length<=PadSampler.MAX_BUF;})()`),
    run(`(function(){var m=PadSampler._bufs.get(_c1);return m.q.length+"/"+Object.keys(m.k).length;})()`));
  ck("PadSampler.graj: brak bajtow (jeszcze nie dojechaly z serwera) = null, nie wyjatek",
    run(`PadSampler.graj(_c1,{smp:"s-niema",smpSr:32000,smpLen:32000})===null&&PadSampler.graj(_c1,{})===null`));
  ck("PadSampler: nazwa nuty liczona od C-1", run("PadSampler.nazwaNuty(60)") === "C4" && run("PadSampler.nazwaNuty(69)") === "A4",
    run("PadSampler.nazwaNuty(60)"));
  // sprzatanie: dopoki nie wiemy, co lezy na serwerze, lista „zywych” bylaby zgadywana
  ck("PadSampler: sprzatanie odmawia, dopoki nie zna zawartosci serwera", run("PadSampler._listed") === false);
} catch (e) {
  ck("harness nie wywalil sie", false, (e && e.stack ? e.stack : String(e)).slice(0, 600));
}
const zle = checks.filter(c => !c[1]).length;
for (const [n, ok, d] of checks) console.log((ok ? "PASS  " : "FAIL  ") + n + (d && !ok ? "   " + d : ""));
console.log(JSON.stringify({checks}));
process.exit(zle ? 1 : 0);
