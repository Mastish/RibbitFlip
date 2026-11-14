// OSCYLOSKOP W BIBLIOTECE DŹWIĘKÓW (rf-25c, etap E1) — FALA WŁASNA OD PATCHA DO SILNIKA, BEZ PRZEGLĄDARKI.
//
// Nowa fala „Własna” to jedyna rzecz z tego etapu, która trafia do zapisu: patch dostaje `wave:"custom"`
// i 64 próbki `wt`. Najkruchsze miejsce to więc NIE ekran, tylko granica zapisu — sanitizePatch (rf-20):
//   • stare brzmienia mają przechodzić przez niego bajt w bajt tak samo jak przed tą zmianą (D6: brak klucza =
//     nie ruszaj patcha), inaczej zmienia się odcisk sceny i każda zapisana scena świeci „zmieniona”,
//   • `custom` bez poprawnych 64 próbek ma spaść na piłę i NIE nieść `wt` (OscillatorNode.type="custom" rzuca),
//   • śmieci w próbkach (NaN, tekst, 5) mają zostać przycięte, nie przepuszczone do PeriodicWave.
// Dalej: matematyka ekranu (DFT, harmoniczne, geometria tarczy) i silnik (rf-21) na
// udawanym AudioContext — fala własna nie dokłada ŻADNEGO węzła względem tej samej łatki z piłą, a brzmienie
// bez `wt` nie dotyka setPeriodicWave ani razu.
//
// Model i silnik są PRAWDZIWE (rf-17/rf-19/rf-20/rf-21/rf-25c w `vm`), podstawione są tylko globale, których
// dotykają przy wczytaniu. Wywoływane z tests/test_synth_store.py; samodzielnie: node tests/sound_screens_harness.mjs
// Ostatnia linia wyjścia = JSON {checks:[[nazwa, ok, szczegół], …]}; kod wyjścia 1, gdy coś nie przeszło.
// (Nazwy sprawdzeń tylko ze znakami z cp1250 — test_synth_store.py drukuje je print()-em.)
//
// ETAP E2 (sekcja (m)): kanał Barwa — korektor do 4 pasm `eq:[{f,g,q}]`. Ta sama granica zapisu (sanitizer: przycięcie,
// maks. 4, śmieci odrzucone, pusta lista = brak klucza, stare brzmienia bajt w bajt), odpowiedź korektora liczona
// wzorem „peaking” z Web Audio (eqMag), oś log 40 Hz–16 kHz i silnik: głos BEZ `eq` buduje dokładnie te same węzły
// co przed E2 (sekwencje zapisane starym rf-21), a z `eq` dostaje +N filtrów „peaking” w kolejności pasm we
// wszystkich trzech gałęziach (główna, rechot, szum), wpiętych przed przesterem z osi Y.
//
// ETAP E3 (sekcja (n)): kanał Obwiednia — krzywizny odcinków `envC:[a,d,r]` (−1..1). Granica zapisu jak wyżej
// (trzy skończone liczby, przycięcie, 2 miejsca, same zera = brak klucza, stare brzmienia bajt w bajt), czyste
// funkcje ekranu (envShape i jej kopia w rf-21, envCurve, odwrotność pierścienia zgięcia, oś czasu, łamana, obwiednia
// filtra, uchwyty), suwaki jako jedyne źródło prawdy (uchwyty piszą value + zdarzenie input) i silnik na udawanym
// AudioContext, który PILNUJE reguł automatyki Web Audio (krzywa nachodząca na inne zdarzenie rzuca, jak w
// przeglądarce): głos bez `envC` wywołuje dokładnie to samo co przed E3 (dzienniki zapisane starym rf-21), a z `envC`
// dostaje jeden węzeł `env` przed `g`, krzywe tyłem do siebie i zwolnienie — także w trakcie ataku — bez wyjątku.
//
// ETAP E5 (sekcja (o)): okrągła lampa z kopułą szkła i pulpit. Ekran nie zmienia nic w zapisie, więc pilnujemy
// geometrii: kopuła i pole edycji w obie strony (JS ↔ te same stałe w shaderze i w CSS), żaby na obwódce w Widmie,
// trwałość luminoforu (dwa shadery, HT czytany po razie), wskaźnik poziomu, „Powiększ” i nowy układ HTML. Sprawdzenia
// kanałów z E1–E3 (rect-local) zostają, bo kanały edycji liczą dalej w lokalnych 0..1 pola edycji.
//
// ETAP E6: lampa jest wyłącznie wizualizacją (dwa style obrazu: Pierścień i Linia), a stan edycji, narzędzia, wskaźnik
// i patch I/O (readInto / load) przeszły na płaskie edytory w kartach modułów (rf-25e). Ich sprawdzenia — dawne (i)
// i interakcje z (l)–(o) — są w tests/curve_editors_harness.mjs; tu zostały czyste funkcje, sanitizer, silnik,
// geometria lampy, jej style i shader (bez martwych gałęzi edycji).
//
// RUNDA NAPRAWCZA PO PRZEGLĄDZIE (sekcja (p), 2026-10-02): lampa w czasie. Symulacja zegara 60/120/144 Hz z rozrzutem
// ±1 ms (pętla padów i własna klatka lampy w tej samej klatce ekranu): po ciszy ślad i diody dochodzą do spoczynku,
// jeden render na klatkę, a kopia sprzed poprawki przy 144 Hz zamiera (symulacja widzi błąd). Do tego spoczynek lampy,
// gdy grają pady, a lab milczy; sleep() bez utraty kontekstu WebGL; tryb bez WebGL2 (diody z poziomu paneli, bez
// legendy, ponowna próba); zmiana języka przerysowuje podpisy. Kopuła w JS i envAt odeszły (g), (n), (o).
//
// ETAP E7 (2026-10-03): lampa ma jeden obraz (pierścień przebiegu i słońce widma), a styl „Linia” odszedł razem z
// przełącznikiem, kLine / kWave / kSpec, polem (RX, RY), torem BK[7] i kluczem rf.skopStyle. Kopuła K .30, smużenie
// TAU .5 s, scanlines i maska luminoforu zgięte z kopułą w szybie (fin, po trwałości), mocniejsze szkło. Sprawdzenia
// stylu w (l) i (o) zastąpiło sprawdzenie, że go nie ma; (j) i (o) pilnują nowych stałych i kolejności w fin.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checks = [];
const ck = (name, ok, detail) => checks.push([name, !!ok, detail === undefined ? "" : String(detail)]);
const near = (a, b, e) => Math.abs(a - b) <= e;

const ctx = {
  I18N_EN: {}, console,
  state: { midi: { scale: "chromatic", scaleRoot: 0 }, devices: {} },
  _gl: (pl) => pl,
  rfToast: () => {}, rfConfirm: () => Promise.resolve(false), rfModal: () => Promise.resolve(""),
  rfCfgIdCreate: () => ({ barHtml: () => "", wire: () => {}, sync: () => {} }),
  esc: (s) => String(s),
  fetch: () => Promise.resolve({ json: () => ({}) }),
  document: { getElementById: () => null, querySelector: () => null },
  location: { search: "" },
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout: () => 0, clearTimeout: () => {},
  // rf-25c rejestruje shader „skop” w PadPlate._fs, jeśli PadPlate istnieje — atrapa łapie samo źródło
  PadPlate: { _fs: {} },
};
vm.createContext(ctx);
for (const f of ["web/js/rf-17-pad-model.js", "web/js/rf-19-pad-model2.js", "web/js/rf-20-gate-model.js",
                 "web/js/rf-21-pad-audio.js", "web/js/rf-25c-sound-screens.js"]) {
  try { vm.runInContext(fs.readFileSync(path.join(REPO, f), "utf8"), ctx, { filename: f }); }
  catch (e) { ck(f + " wczytany w vm (bez DOM)", false, e.message); }
}
const G = (n) => vm.runInContext(n, ctx);
const sp = G("sanitizePatch"), PP = G("PAD_PATCH"), SS = G("SoundScreens"), PA = G("PadAudio");
const J = (o) => JSON.stringify(o);
const R25C_OWN = fs.readFileSync(path.join(REPO, "web/js/rf-25c-sound-screens.js"), "utf8");
// sam kod, bez linii komentarza (komentarze opisują, co odeszło w E7, i wolno im to nazwać)
const R25C_CODE = R25C_OWN.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
const SINE = Array.from({ length: 64 }, (_, n) => Math.sin(2 * Math.PI * n / 64));

// (a) STARE BRZMIENIA BAJT W BAJT. Wzorce policzone STARYM sanitizePatch (sprzed 2026-10-02) — trzy bazowe
//     i jedno z warstwą osc2 + obwiednią filtra + przesterem. Do tego idempotencja: drugi przebieg nic nie zmienia.
const GOLD = {
  lead: '{"wave":"sawtooth","legato":true,"oct":0,"det":0,"att":0.012,"rel":0.18,"glide":0.045,"fMin":260,"fMax":7800,"q":6,"lvl":0.42}',
  pluck: '{"wave":"triangle","legato":false,"oct":0,"det":0,"att":0.003,"dec":0.34,"fMin":600,"fMax":8200,"q":2.5,"lvl":0.6}',
  ribbit: '{"wave":"sawtooth","legato":true,"croak":true,"oct":-1,"det":0,"att":0.02,"rel":0.13,"am":29,"fMin":430,"fMax":1750,"q":6,"lvl":0.52}',
};
for (const k of Object.keys(GOLD)) {
  ck("(a) sanitizePatch(" + k + ") bez zmian wzgledem starej wersji", J(sp(PP[k])) === GOLD[k], J(sp(PP[k])));
  ck("(a) sanitizePatch(" + k + ") idempotentny", J(sp(sp(PP[k]))) === J(sp(PP[k])));
}
{
  const x = { legato: true, wave: "square", att: .03, rel: .4, fMin: 200, fMax: 4800, q: 7, lvl: .3, osc2: true, osc2wave: "square",
              osc2semi: -12, osc2det: 30, osc2mix: .5, fEnv: -.6, fEnvT: .5, drive: .4 };
  const gx = '{"wave":"square","legato":true,"oct":0,"det":0,"att":0.03,"rel":0.4,"fMin":200,"fMax":4800,"q":7,"lvl":0.3,"osc2":true,"osc2wave":"square","osc2semi":-12,"osc2det":30,"osc2mix":0.5,"fEnv":-0.6,"fEnvT":0.5,"drive":0.4}';
  ck("(a) patch z osc2 + fEnv + drive bez zmian wzgledem starej wersji", J(sp(x)) === gx, J(sp(x)));
  ck("(a) ...i bez klucza `wt`", !("wt" in sp(x)));
}

// (b) FALA WŁASNA PRZECHODZI: custom + 64 próbki → custom, 64 liczby w −1..1, zaokrąglone do 3 miejsc
{
  const raw = SINE.map((v) => v * 1.0000004);
  const p = sp({ wave: "custom", wt: raw, legato: true });
  ck("(b) custom + 64 probki: wave == custom", p && p.wave === "custom", p && p.wave);
  ck("(b) wt ma 64 liczby", Array.isArray(p.wt) && p.wt.length === 64 && p.wt.every((v) => typeof v === "number"), p.wt && p.wt.length);
  ck("(b) wt w zakresie -1..1", p.wt.every((v) => v >= -1 && v <= 1));
  ck("(b) wt zaokraglone do 3 miejsc", p.wt.every((v) => Math.round(v * 1000) / 1000 === v), p.wt.slice(0, 4).join(","));
  ck("(b) sanitizePatch idempotentny dla fali wlasnej", J(sp(p)) === J(p));
  ck("(b) `wt` emitowany jako ostatni klucz (stare klucze w starej kolejnosci)", Object.keys(p).slice(-1)[0] === "wt", Object.keys(p).join(","));
}

// (c) BEZ POPRAWNYCH PRÓBEK = PIŁA, BEZ `wt`
for (const [nm, raw] of [["bez wt", { wave: "custom" }], ["63 probki", { wave: "custom", wt: SINE.slice(0, 63) }],
                         ["65 probek", { wave: "custom", wt: SINE.concat([0]) }], ["wt jako tekst", { wave: "custom", wt: "0,1,0" }]]) {
  const p = sp(raw);
  ck("(c) custom " + nm + ": sawtooth i brak `wt`", p.wave === "sawtooth" && !("wt" in p), J(p));
}
{
  const p = sp({ wave: "sine", wt: SINE });
  ck("(c) zwykla fala z doklejonym `wt`: `wt` nie jest emitowany", p.wave === "sine" && !("wt" in p), J(p));
}

// (d) ŚMIECI W PRÓBKACH: NaN / "x" / 5 → 0 / 0 / 1
{
  const raw = SINE.slice(); raw[0] = NaN; raw[1] = "x"; raw[2] = 5; raw[3] = -7; raw[4] = null;
  const p = sp({ wave: "custom", wt: raw });
  ck("(d) NaN -> 0", p.wt[0] === 0, p.wt[0]);
  ck("(d) \"x\" -> 0", p.wt[1] === 0, p.wt[1]);
  ck("(d) 5 -> 1", p.wt[2] === 1, p.wt[2]);
  ck("(d) -7 -> -1", p.wt[3] === -1, p.wt[3]);
  ck("(d) null -> 0", p.wt[4] === 0, p.wt[4]);
}

// (e) DFT SINUSA: imag[1] = +1 (konwencja createPeriodicWave: x = Σ real·cos + imag·sin), reszta ~0
{
  const d = SS.dft(SINE);
  let rest = 0; for (let k = 0; k < d.real.length; k++) { rest = Math.max(rest, Math.abs(d.real[k])); if (k !== 1) rest = Math.max(rest, Math.abs(d.imag[k])); }
  ck("(e) dft(sinus): imag[1] = +1", near(d.imag[1], 1, 1e-4), d.imag[1]);
  ck("(e) dft(sinus): pozostale wspolczynniki < 1e-3", rest < 1e-3, rest);
  ck("(e) dft zwraca 33 wspolczynniki (DC + 32 harmoniczne)", d.real.length === 33 && d.imag.length === 33);
}

// (f) HARMONICZNE → FALA
{
  const one = SS.fromHarmonics([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  let e = 0; for (let n = 0; n < 64; n++) e = Math.max(e, Math.abs(one[n] - SINE[n]));
  ck("(f) fromHarmonics([1,0,...]) to sinus", e < 1e-3, e);
  const sq = [1, 0, 1 / 3, 0, 1 / 5, 0, 1 / 7, 0, 1 / 9, 0, 1 / 11, 0, 1 / 13, 0, 1 / 15, 0];
  const w = SS.fromHarmonics(sq);
  let pk = 0, m = 0; for (let n = 0; n < 64; n++) { pk = Math.max(pk, Math.abs(w[n])); m += w[n]; }
  ck("(f) fromHarmonics(prostokat): szczyt = 1", near(pk, 1, 1e-6), pk);
  ck("(f) fromHarmonics(prostokat): srednia = 0", Math.abs(m / 64) < 1e-6, m / 64);
  const z = SS.fromHarmonics(new Array(16).fill(0));
  ck("(f) wszystkie slupki na zero = cisza (bez NaN)", z.every((v) => v === 0));
  // tam i z powrotem: słupki z kwadratu (próbkowanego) wracają jako 1, 0, ~1/3, 0, ~1/5
  const h = SS.harmonicsOf(SS.shape("square"));
  ck("(f) harmonicsOf(kwadrat): 1, 0, ok. 1/3, 0, ok. 1/5", near(h[0], 1, 1e-6) && h[1] < .01 && near(h[2], 1 / 3, .03) && h[3] < .01 && near(h[4], .2, .03),
     Array.from(h.slice(0, 5)).map((v) => v.toFixed(3)).join(","));
  const s = SS.smooth(SS.shape("square"));
  ck("(f) Wygladz: kwadrat traci ostre zbocza, srednia zostaje", Math.max(...s) <= 1 && Math.abs(s.reduce((a, b) => a + b, 0)) < 1e-6 && s[0] < 1 && s[31] < 1,
     s[0] + " " + s[31]);
}

// (g) WYPUKŁA SZYBA: przeliczenia wskaźnik ↔ obraz przez kopułę (glassToPic / picToGlass, dome / undome,
//     glassToDisc) odeszły w rundzie naprawczej 2026-10-02 razem z funkcjami — od etapu E6 lampa nie przyjmuje
//     wskaźnika, a kopułę liczy sam shader (jego stałe pilnują (j) i (o)). Zostaje to, czego używa nakładka.
ck("(g) rf-25c bez martwych funkcji kopuly (glassToPic, picToGlass, glassToDisc, dome, undome) i envAt",
   ["glassToPic", "picToGlass", "glassToDisc", "dome", "undome", "envAt"].every((k) => !(k in SS)) && typeof SS.discToGlass === "function");
{
  const g0 = SS.discToGlass(0, 0, 440, 440), g1 = SS.discToGlass(0, 1, 440, 440), g2 = SS.discToGlass(.3, -.4, 500, 380);
  ck("(g) discToGlass: srodek dysku = srodek pudelka, gora szyby na y = F, Y w gore (takze w pudelku, ktore nie jest kwadratem)",
     g0.x === 220 && g0.y === 220 && g1.x === 220 && g1.y === SS.F && near(g2.x, 250 + .3 * (190 - SS.F), 1e-12) && near(g2.y, 190 + .4 * (190 - SS.F), 1e-12), J([g0, g1, g2]));
}

// (h) ZAPIS: własne brzmienie z falą własną niesie `wt` przez customSoundsSer i przez pełny obieg stanu
{
  const XPAD = G("XPAD");
  const patch = sp({ wave: "custom", wt: SINE, legato: true, att: .02 });
  XPAD.customSounds = { moja: { name: "Moja", emoji: "🎛", patch } };
  const ser = G("customSoundsSer")();
  ck("(h) customSoundsSer niesie `wt` (64)", ser.moja && Array.isArray(ser.moja.patch.wt) && ser.moja.patch.wt.length === 64);
  let back = null;
  try { G("padApplyState")(JSON.parse(JSON.stringify(G("padState")()))); back = G("padState")().customSounds.moja; }
  catch (e) { ck("(h) obieg padState -> padApplyState", false, e.message); }
  ck("(h) obieg zapisu (padState -> JSON -> padApplyState) zachowuje fale wlasna",
     back && back.patch.wave === "custom" && J(back.patch.wt) === J(patch.wt), back && J(back.patch).slice(0, 80));
}

// (j) SHADER „skop” zarejestrowany z zewnątrz (D7): tylko PadPlate._fs, z własnymi uniformami i plate()
{
  const src = ctx.PadPlate._fs.skop || "";
  ck("(j) PadPlate._fs.skop zarejestrowany", typeof src === "string" && src.length > 500, src.length);
  // E5: BK[6] = trwałość luminoforu (tor 7 niósł styl obrazu do E7); BC[2] = tło panelu i filc obudowy.
  // E6: lampa nie edytuje, więc uniformy krzywej i uchwytów (LB, LT, BL, NB, BD) odeszły razem z ich funkcjami
  ck("(j) skop deklaruje BK[8], BC[2] i sciezke wiazki BL[12] + NB (2026-10-03), bez uniformow edycji LB, LT, BD",
     /^uniform float BK\[8\];uniform vec3 BC\[2\];uniform vec2 BL\[12\];uniform int NB;\n/.test(src) && !/uniform [^;]*\b(LB|LT|BD)\b/.test(src));
  ck("(j) skop bez martwych funkcji edycji (kEdit, kCurve, kPoly, kBars, cuAt, bdAt, cvAt, polyAt)",
     !/\b(kEdit|kCurve|kPoly|kBars|cuAt|bdAt|cvAt|polyAt)\b/.test(src));
  ck("(j) skop definiuje vec3 plate(vec2 px,vec2 uv,vec2 r)", /vec3 plate\(vec2 px,vec2 uv,vec2 r\)\{/.test(src));
  const own = fs.readFileSync(path.join(REPO, "web/js/rf-25c-sound-screens.js"), "utf8");
  ck("(j) skop nie trafia na liste tel padow (rf-25c nie dotyka PAD_PLATES ani add())", !own.includes("PAD_PLATES") && !/\badd\(/.test(own));
  ck("(j) zrodlo shadera bez odwrotnych apostrofow (rozbilyby literal)", !src.includes("`"));
  // E5: okrągła lampa — stałe w jednej linii shadera; E7: kopuła .30 (pole stylu Linia, RX i RY, odeszło)
  const nums = (re) => { const m = re.exec(src); return m ? m.slice(1).map(Number) : null; };
  const geo = nums(/const float F=([\d.]+),K=([\d.]+),HW=([\d.]+);/);
  ck("(j) geometria lampy w JS = w shaderze (F, K, HW), E7: K = .30",
     geo && geo[0] === SS.F && geo[1] === SS.K && geo[2] === SS.HW && SS.K === .3, J(geo));
  ck("(j) shader liczy kopule jak JS: pc = sc*(1+K*|sc|^2); luminofor (kPhos) na obrazie po kopule",
     (src.match(/vec2 pc=sc\*\(1\.\+K\*q2\);/g) || []).length === 2 && src.includes("vec3 col=kPolar(kPhos(pc,Rg,px),sc,rho,th,Rg);") &&
     src.includes("float Rg=max(min(r.x,r.y)*.5-F,1.);vec2 sc=q/Rg;"));
  // E7: jeden obraz — bez stylu Linia (kLine i jego rurki kWave / kSpec, pole RX / RY) i bez toru stylu BK[7]
  ck("(j) E7: skop bez stylu Linia (kLine, kWave, kSpec, RX, RY) i bez BK[7]; JS bez RX, RY, FROG_LY",
     !/\b(kLine|kWave|kSpec|RX|RY)\b/.test(src) && !src.includes("BK[7]") && !("RX" in SS) && !("RY" in SS) && !("FROG_LY" in SS));
  // E7: scanlines i maska luminoforu w szybie (fin): na obrazie po kopule (pc), po trwałości (skop-blit = fin(texture(HT…)))
  // i przed szkłem (winieta, Fresnel, odblaski), wygaszane przy gęstym rastrze (aa)
  const blit = ctx.PadPlate._fs["skop-blit"] || "", fin = blit.slice(blit.indexOf("vec3 fin("), blit.indexOf("return mix(kHous(q,sd,Rg,px),col,"));
  const iSc = fin.indexOf("col*=1.-.10*aa*(.5+.5*cos(pc.y*Rg*2.0944));"), iMk = fin.indexOf("col*=1.-.04*aa*abs(fract(pc.x*Rg*.33333-vec3(0.,.33333,.66667))*2.-1.);");
  const iPc = fin.indexOf("vec2 pc=sc*(1.+K*q2);float aa=smoothstep(1.6,2.6,3.*DPR/(1.+3.*K*q2));"), iVg = fin.indexOf("col*=1.-.4*smoothstep(.55,1.,rho);");
  const iGl = fin.indexOf("if(h2<7.)col+=vec3(.85,.92,1.)*.13*exp(-h2);"), iRim = fin.indexOf("if(rho>.45){");
  const iFr = fin.indexOf("float fa=1.-sqrt(max(0.,1.-q2)),fr=fa*fa*sqrt(fa);");
  ck("(j) E7: scanlines w skop-blit (fin) na pc po kopule, po trwalosci, przed szklem: pc -> raster -> maska -> winieta -> odblask .13 -> obrzeze (Fresnel 2,5)",
     blit.includes("vec3 plate(vec2 px,vec2 uv,vec2 r){return fin(texture(HT,uv).rgb,px,r);}") &&
     iPc > 0 && iSc > iPc && iMk > iSc && iVg > iMk && iGl > iVg && iRim > iGl && iFr > iRim, J([iPc, iSc, iMk, iVg, iGl, iRim, iFr]));
  ck("(j) E7: szklo: obwodka Fresnela .35, barwna obwodka przy krawedzi, waski luk odbicia u gory z lewej (100-150 st.)",
     fin.includes("col+=vec3(.5,.62,.7)*fr*.35+") && fin.includes("col+=vec3(.16,.04,.2)*exp(-e1*e1*.5)+vec3(.03,.13,.16)*exp(-e2*e2*.5);") &&
     fin.includes("exp(-aw*aw*.8)*smoothstep(1.66,1.85,an)*(1.-smoothstep(2.45,2.62,an))"));
  // E7, KOSZT (recenzja 2026-10-03: lampa 6,9 ms przy 373 px). Drogie wywołania liczone w źródle shaderów (miejsca
  // wywołań, bez komentarzy) przed optymalizacją (kopia _backups/261003-skop-e7-perf) i po niej.
  const code = (t) => t.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  const FN = ["pow", "exp", "sin", "cos", "atan", "sqrt", "fbm", "vn"];
  const cnt = (t) => Object.fromEntries(FN.map((f) => [f, (code(t).match(new RegExp("\\b" + f + "\\(", "g")) || []).length]));
  const PRE = path.join(REPO, "_backups/261003-skop-e7-perf/rf-25c-sound-screens.js");
  const nowS = cnt(src), nowB = cnt(blit);
  if (fs.existsSync(PRE)) {
    const c0 = { PadPlate: { _fs: {} } }; vm.createContext(c0); vm.runInContext(fs.readFileSync(PRE, "utf8"), c0);
    const preS = cnt(c0.PadPlate._fs.skop), preB = cnt(c0.PadPlate._fs["skop-blit"]);
    // fbm = 4 próbki szumu (vn), pow = log + exp, sqrt tańszy od pow: porównujemy trygonometrię, exp (+2 na pow) i próbki
    // szumu; sqrt może przybyć najwyżej tyle, ile ubyło pow (a^2,5 = a*a*sqrt(a))
    const W = (c) => ({ trig: c.sin + c.cos + c.atan, exp: c.exp + 2 * c.pow, szum: c.vn + 4 * c.fbm, sqrt: c.sqrt, pow: c.pow });
    // E8 dokłada świadomie dwa exp w skop (poświata punktu spoczynku wiązki: exp(-d/4), exp(-d/14)) — liczone osobno
    const le = (a, b, ex) => a.trig <= b.trig && a.exp <= b.exp + (ex || 0) && a.szum <= b.szum && a.sqrt <= b.sqrt + b.pow;
    ck("(j) E7 koszt: drogie wywolania w zrodle nie przybyly (skop, skop-blit: trygonometria, exp, probki szumu), pow 0, fbm 0",
       le(W(nowS), W(preS), 2) && le(W(nowB), W(preB)) && nowS.pow === 0 && nowB.pow === 0 && nowS.fbm === 0 && nowB.fbm === 0,
       J({ skop: { przed: W(preS), po: W(nowS) }, blit: { przed: W(preB), po: W(nowB) } }));
    process.stderr.write("[koszt E7] skop przed " + J(preS) + " po " + J(nowS) + "\n[koszt E7] skop-blit przed " + J(preB) + " po " + J(nowB) + "\n");
  }
  // obrzeże szkła liczone tylko tam, gdzie może dać choć ułamek 1/255: progi sprawdzone na liczbach
  const fres = (rho) => { const a = 1 - Math.sqrt(Math.max(0, 1 - rho * rho)); return a * a * Math.sqrt(a) * .35 * .7; };
  ck("(j) E7 koszt: obrzeze za progami (rho > .45, pas obwodki, pasy lukow, platek odblasku) - pominiete czlony ponizej 1/4 z 1/255",
     fin.includes("if(sd>-9.){") && fin.includes("if(abs(ae)<3.5||abs(aw)<4.){float an=atan(sc.y,sc.x);") &&
     fres(.45) < .25 / 255 && .13 * Math.exp(-7) < .25 / 255 && .2 * Math.exp(-(4.5 * 4.5) * .5) < .25 / 255 &&
     .07 * Math.exp(-3.5 * 3.5) < .25 / 255 && .16 * Math.exp(-16 * .8) < .25 / 255 && Math.abs(fres(.45001) - fres(.44999)) < 1e-6,
     J({ fres45: +(fres(.45) * 255).toFixed(3) }));
  // słońce: 4 najbliższe promienie (j−1 … j+2) zamiast 16 — ta sama odległość; geometria jak w kSun, losowe widma i piksele
  ck("(j) E7 koszt: kSun liczy 4 odcinki na piksel (j-1..j+2) z tablicy SUN, bez petli po 16 i bez sin/cos promieni",
     src.includes("for(int k=-1;k<=2;k++){int i=(j+k+16)&15;vec2 u=SUN[i];") && !/for\(int i=0;i<16;i\+\+\)/.test(src));
  const sunM = /const vec2 SUN\[16\]=vec2\[16\]\(([^;]+)\);/.exec(src), sun = sunM ? [...sunM[1].matchAll(/vec2\(([-\d.]+),([-\d.]+)\)/g)].map((m) => [+m[1], +m[2]]) : [];
  ck("(j) E7: tablica SUN = kierunki promieni (sin, cos) z i/16 obrotu, 16 pozycji",
     sun.length === 16 && sun.every(([x, y], i) => near(x, Math.sin(i / 16 * 2 * Math.PI), 2e-6) && near(y, Math.cos(i / 16 * 2 * Math.PI), 2e-6)), sun.length);
  let rs = 12345; const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  let worst = 0;
  for (let t = 0; t < 200000; t++) {
    const S = Array.from({ length: 16 }, () => (rnd() < .3 ? 0 : rnd())), r = rnd() * 1.004, th = rnd(), a0 = th * 2 * Math.PI, p = [Math.sin(a0) * r, Math.cos(a0) * r];
    const seg = (i) => { const u = [Math.sin(i / 16 * 2 * Math.PI), Math.cos(i / 16 * 2 * Math.PI)], A = [u[0] * SS.SUN0, u[1] * SS.SUN0], L = SS.SUN0 + S[i] * SS.SUN_L, B = [u[0] * L, u[1] * L];
      const pa = [p[0] - A[0], p[1] - A[1]], ba = [B[0] - A[0], B[1] - A[1]], h = Math.max(0, Math.min(1, (pa[0] * ba[0] + pa[1] * ba[1]) / Math.max(ba[0] * ba[0] + ba[1] * ba[1], 1e-8)));
      return Math.hypot(pa[0] - ba[0] * h, pa[1] - ba[1] * h); };
    let d16 = 1e5; for (let i = 0; i < 16; i++) d16 = Math.min(d16, seg(i));
    const j = Math.floor(th * 16); let d4 = 1e5; for (let k = -1; k <= 2; k++) d4 = Math.min(d4, seg((j + k + 16) & 15));
    worst = Math.max(worst, d4 - d16);
  }
  ck("(j) E7/E8: 4 najblizsze promienie daja te sama odleglosc do slonca co 16 (promienie .86-.98, 200 000 losowych pikseli i widm)", worst < 1e-12, worst);
  // kPhos liczy chmurę tylko na szybie: plate() wychodzi wcześniej poza obrzeżem
  const pl = src.slice(src.lastIndexOf("vec3 plate(vec2 px,vec2 uv,vec2 r){"));
  ck("(j) E7: kPhos (chmura luminoforu) tylko dla pikseli szyby - wczesne wyjscie plate() przed kPhos",
     pl.indexOf("if((rho-1.)*Rg>=.8)return") > 0 && pl.indexOf("if((rho-1.)*Rg>=.8)return") < pl.indexOf("kPhos(pc,Rg,px)"));
}

// (k) SILNIK NA UDAWANYM AudioContext: fala własna = PeriodicWave, zero nowych węzłów, stare łatki bez zmian
{
  const mk = () => {
    const log = { nodes: 0, pw: 0, types: [] };
    const param = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {}, cancelScheduledValues() {} });
    const node = (extra) => { log.nodes++; return Object.assign({ connect() {}, disconnect() {}, start() {}, stop() {},
      gain: param(), frequency: param(), detune: param(), Q: param(), offset: param() }, extra || {}); };
    const c = {
      currentTime: 0, sampleRate: 48000, state: "running",
      createGain: () => node(), createBiquadFilter: () => node({ type: "lowpass" }), createConstantSource: () => node(),
      createWaveShaper: () => node(), createBufferSource: () => node(),
      createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
      createPeriodicWave: (re, im, opt) => ({ re, im, opt }),
      createOscillator: () => { const o = node(); let t = "sine";
        Object.defineProperty(o, "type", { get: () => t, set: (v) => { if (v === "custom") throw new Error("InvalidStateError"); log.types.push(v); t = v; } });
        o.setPeriodicWave = (w) => { log.pw++; o._pw = w; t = "custom"; }; return o; },
    };
    return { c, log };
  };
  const voice = (patch, y) => { const { c, log } = mk(); PA.ctx = c; PA._pw = null;
    const bus = { master: { connect() {} }, send: { connect() {} } };
    PA._mkVoice(bus, patch, 440, y == null ? .5 : y, 1); return log; };
  const wt = SINE.map((v) => Math.round(v * 1000) / 1000);
  for (const k of ["lead", "pad", "ribbit", "pluck", "bell", "acid"]) {
    const L = voice(PP[k]);
    ck("(k) brzmienie bazowe " + k + ": zero setPeriodicWave", L.pw === 0, L.pw);
  }
  const base = { legato: true, wave: "sawtooth", det: 9, sub: true, osc2: true, osc2wave: "square", osc2semi: 7, att: .01, fMin: 200, fMax: 4000, q: 2, lvl: .4 };
  const cust = Object.assign({}, base, { wave: "custom", wt });
  const Ls = voice(base), Lc = voice(cust);
  ck("(k) fala wlasna: tyle samo wezlow co ta sama latka z pila", Ls.nodes === Lc.nodes, Ls.nodes + " vs " + Lc.nodes);
  ck("(k) fala wlasna: PeriodicWave na oscylatorze glownym i parze detune (3)", Lc.pw === 3, Lc.pw);
  ck("(k) fala wlasna: sub zostaje sinusem, osc2 swoja fala (D3)", Lc.types.includes("sine") && Lc.types.includes("square") && !Lc.types.includes("sawtooth"), Lc.types.join(","));
  const Ld = voice(cust, { cut: .5, lvl: .5, vib: 0, mode: "det", det: .5 });
  ck("(k) unison z osi Y (para detune) tez gra fala wlasna", Ld.pw === 5, Ld.pw);
  const Lr = voice(Object.assign({}, PP.ribbit, { wave: "custom", wt }));
  ck("(k) rechot z fala wlasna: PeriodicWave na oscylatorze rechotu", Lr.pw === 1, Lr.pw);
  const Lx = voice(Object.assign({}, base, { wave: "custom" }));   // custom bez próbek (nie przez sanitizer)
  ck("(k) custom bez `wt` nie rzuca i gra pila", Lx.pw === 0 && Lx.types.includes("sawtooth"), Lx.types.join(","));
  // PeriodicWave: współczynniki jak w SoundScreens.dft, pamięć podręczna po próbkach, płaska linia bez normalizacji
  const { c } = mk(); PA.ctx = c; PA._pw = null;
  const w1 = PA._pwave({ wt }), w2 = PA._pwave({ wt: wt.slice() });
  ck("(k) _pwave: imag[1] = +1 dla sinusa", near(w1.im[1], 1, 2e-3) && Math.abs(w1.re[1]) < 2e-3, w1.im[1]);
  ck("(k) _pwave: ta sama fala = ten sam obiekt z pamieci", w1 === w2);
  ck("(k) _pwave: normalizacja wlaczona dla zwyklej fali", w1.opt && w1.opt.disableNormalization === false);
  const flat = PA._pwave({ wt: new Array(64).fill(0) });
  ck("(k) _pwave: plaska linia = cisza bez normalizacji (bez NaN)", flat.opt.disableNormalization === true);
  const d = SS.dft(wt); let e = 0; for (let k = 1; k <= 32; k++) e = Math.max(e, Math.abs(d.real[k] - w1.re[k]), Math.abs(d.imag[k] - w1.im[k]));
  ck("(k) _pwave (rf-21) liczy to samo co SoundScreens.dft (rf-25c)", e < 1e-6, e);
  for (let i = 0; i < 40; i++) PA._pwave({ wt: wt.map((v, n) => (n === 0 ? i / 100 : v)) });
  ck("(k) _pwave: pamiec podreczna nie rosnie ponad 32", PA._pw.size <= 32, PA._pw.size);
}

// (l) RUNDA RECENZJI E1 (Fable, 2026-10-02): okno segmentów w shaderze i żaby. Okno ±90 px liczyły rurki stylu Linia
//     (kWave, kSpec), które odeszły z nim w E7; pierścień liczy odległość promieniowo, bez pętli po segmentach.
{
  const src = ctx.PadPlate._fs.skop || "";
  ck("(l) shader: obudowa i glebia szyby bez zbednych obliczen (wczesne wyjscia)", /if\(sd>=\.8\)return kHous/.test(src) && /if\(sd<=-\.8\)return col;/.test(src));
  ck("(l) shader: zaba na obwodce = pierscien (24 px + bas) * .6, pierscien przebiegu bez petli po segmentach",
     src.includes("float fr=(24.+BA*10.)*.6;") && src.includes("d1=max(abs(rho-rw)*Rg/sqrt(1.+sg*sg),") && !/float fr=16\./.test(src));
  const oldBuses = PA.buses;
  PA.buses = { "__lab__": { voices: { hold: { stopped: false, oscs: [{ o: { frequency: { value: 440 } } }] },
                                     gone: { stopped: true, oscs: [{ o: { frequency: { value: 220 } } }] } } } };
  const fr = SS._frogs();
  PA.buses = oldBuses;
  ck("(l) zaba na obwodce (y = FROG_R .9), x = kat klasy nuty (A = 9/12)", fr.hold && fr.hold.y === SS.FROG_R && SS.FROG_R === .9 && near(fr.hold.x, 9 / 12, 1e-9), J(fr));
  ck("(l) wybrzmialy glos nie jest zaba", !("gone" in fr));
}

// (m) ETAP E2 — BARWA (korektor do 4 pasm): sanitizer `eq`, odpowiedź eqMag, oś log i silnik na udawanym AudioContext
//     z zapisem połączeń (panel korektora: pierścienie, narzędzia, ekran ↔ patch — tests/curve_editors_harness.mjs)
{
  // --- sanitizer: stare brzmienia bez zmian, pasma przycięte, maks. 4, śmieci odrzucone, pusta lista = brak klucza
  for (const k of Object.keys(GOLD)) ck("(m) sanitizePatch(" + k + ") nadal bajt w bajt, bez `eq`", J(sp(PP[k])) === GOLD[k] && !("eq" in sp(PP[k])));
  ck("(m) `eq: []` dopisane do starego brzmienia: ten sam JSON co bez klucza", J(sp(Object.assign({}, PP.lead, { eq: [] }))) === GOLD.lead);
  const E = (eq, extra) => sp(Object.assign({ legato: true, wave: "sine" }, extra || {}, { eq }));
  const p1 = E([{ f: 1000.4, g: 4.56, q: 1.234 }]);
  ck("(m) pasmo przechodzi: f calkowite, g 1 miejsce, q 2 miejsca", J(p1.eq) === '[{"f":1000,"g":4.6,"q":1.23}]', J(p1.eq));
  ck("(m) `eq` emitowany jako ostatni klucz", Object.keys(p1).slice(-1)[0] === "eq", Object.keys(p1).join(","));
  const pw = E([{ f: 1000, g: 3, q: 1 }], { wave: "custom", wt: SINE });
  ck("(m) z fala wlasna: `eq` po `wt`", Object.keys(pw).slice(-2).join(",") === "wt,eq", Object.keys(pw).slice(-2).join(","));
  ck("(m) sanitizePatch idempotentny z `eq`", J(sp(p1)) === J(p1) && J(sp(pw)) === J(pw));
  const pc = E([{ f: 5, g: 30, q: 0 }, { f: 99999, g: -30, q: 50 }]);
  ck("(m) przyciecie: f 20..20000, g -24..24, q 0.1..24", J(pc.eq) === '[{"f":20,"g":24,"q":0.1},{"f":20000,"g":-24,"q":24}]', J(pc.eq));
  const six = Array.from({ length: 6 }, (_, i) => ({ f: 100 * (i + 1), g: i, q: 1 }));
  const p6 = E(six);
  ck("(m) najwyzej 4 pasma (pierwsze cztery)", p6.eq.length === 4 && p6.eq[3].f === 400, J(p6.eq));
  const junk = [null, "x", 5, [1, 2, 3], { f: "1000", g: 0, q: 1 }, { f: NaN, g: 0, q: 1 }, { f: 1000, g: null, q: 1 },
                { f: 1000, g: 0 }, { f: Infinity, g: 0, q: 1 }, { f: 2000, g: -3, q: 2 }];
  ck("(m) smieci odrzucone (null, tekst, liczba, tablica, f tekstem, NaN, null, brak q, Infinity), dobre zostaje",
     J(E(junk).eq) === '[{"f":2000,"g":-3,"q":2}]', J(E(junk).eq));
  ck("(m) smieci nie zajmuja miejsc w limicie 4", J(E(junk.slice(0, 9).concat(six)).eq.map((b) => b.f)) === "[100,200,300,400]");
  for (const [nm, v] of [["pusta lista", []], ["same smieci", [null, { f: "a" }]], ["obiekt zamiast listy", { f: 1000, g: 3, q: 1 }],
                         ["tekst", "1000,3,1"], ["null", null]]) {
    const p = E(v); ck("(m) " + nm + ": brak klucza `eq`", !("eq" in p), J(p));
  }
  {
    const XPAD = G("XPAD"), patch = E([{ f: 820, g: 4.5, q: 1.2 }, { f: 6000, g: -3, q: 2 }]);
    XPAD.customSounds = { barwa: { name: "Barwa", emoji: "🎛", patch } };
    let back = null;
    try { G("padApplyState")(JSON.parse(JSON.stringify(G("padState")()))); back = G("padState")().customSounds.barwa; }
    catch (e) { ck("(m) obieg padState -> padApplyState z `eq`", false, e.message); }
    ck("(m) obieg zapisu (padState -> JSON -> padApplyState) zachowuje pasma korektora", back && J(back.patch.eq) === J(patch.eq), back && J(back.patch.eq));
  }

  // --- odpowiedź korektora (wzór „peaking” z Web Audio) i osie
  const B6 = [{ f: 1000, g: 6, q: 1.41 }];
  ck("(m) eqMag: +6 dB w f0 (+-0.1)", near(SS.eqMag(B6, 1000, 48000), 6, .1), SS.eqMag(B6, 1000, 48000));
  ck("(m) eqMag: dwie oktawy dalej |dB| < 0.3 (Q 1.41 = ok. oktawa szerokosci)", Math.abs(SS.eqMag(B6, 250)) < .3 && Math.abs(SS.eqMag(B6, 4000)) < .3,
     SS.eqMag(B6, 250).toFixed(3) + " / " + SS.eqMag(B6, 4000).toFixed(3));
  const B2 = [{ f: 200, g: 4, q: 2 }, { f: 3000, g: -5, q: .8 }];
  let sum = 0; for (const f of [50, 200, 700, 3000, 9000]) sum = Math.max(sum, Math.abs(SS.eqMag(B2, f) - SS.eqMag([B2[0]], f) - SS.eqMag([B2[1]], f)));
  ck("(m) eqMag: dwa pasma sumuja sie w dB", sum < 1e-9, sum);
  ck("(m) eqMag: brak pasm (i pasmo 0 dB) = 0 dB", SS.eqMag([], 1000) === 0 && SS.eqMag(null, 1000) === 0 && SS.eqMag([{ f: 1000, g: 0, q: 1 }], 1000) === 0);
  let inv = 0; for (const f of [40, 333, 1000, 5000, 15000]) inv = Math.max(inv, Math.abs(SS.eqMag([{ f: 1500, g: 9, q: 3 }, { f: 1500, g: -9, q: 3 }], f)));
  ck("(m) eqMag: +g i -g na tym samym f i Q znosza sie (A <-> 1/A zamienia licznik z mianownikiem)", inv < 1e-9, inv);
  ck("(m) eqMag: pasmo za Nyquistem przepuszcza (0 dB, jak w specyfikacji)", SS.eqMag([{ f: 24000, g: 9, q: 1 }], 1000, 48000) === 0);
  ck("(m) os: fx(0) = 40 Hz, fx(1) = 16 kHz", near(SS.fx(0), 40, 1e-9) && near(SS.fx(1), 16000, 1e-6), SS.fx(0) + " " + SS.fx(1));
  let ax = 0; for (const x of [0, .1, .37, .5, .9, 1]) ax = Math.max(ax, Math.abs(SS.xf(SS.fx(x)) - x));
  ck("(m) os: xf(fx(x)) = x", ax < 1e-12, ax);
  ck("(m) os dB: 0 dB = .5, +-18 dB = .5 +- .38, przyciecie do 0..1",
     SS.gy(0) === .5 && near(SS.gy(18), .88, 1e-12) && near(SS.gy(-18), .12, 1e-12) && SS.gy(99) === 1 && SS.gy(-99) === 0);
  ck("(m) os dB: yg(gy(g)) = g, przyciecie do +-18", near(SS.yg(SS.gy(-7.3)), -7.3, 1e-9) && SS.yg(1) === 18 && SS.yg(0) === -18);
  ck("(m) promien pierscienia z Q: 7 + 14/q w 7..24", SS.eqR(1) === 21 && SS.eqR(.3) === 24 && near(SS.eqR(12), 7 + 14 / 12, 1e-12) && near(SS.eqR(1e6), 7, 1e-4));

  // --- silnik: sekwencje węzłów zapisane STARYM rf-21 (sprzed E2) na tym samym udawanym kontekście:
  //     G gain, B biquad, P biquad „peaking”, C ConstantSource, W WaveShaper, O oscylator, S BufferSource
  const mk2 = () => {
    const nodes = [], edges = [];
    const param = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {}, cancelScheduledValues() {} });
    const node = (k, extra) => { const n = Object.assign({ k, id: nodes.length, connect(d) { edges.push([n.id, d && d.id != null ? d.id : -1]); },
      disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(), detune: param(), Q: param(), offset: param() }, extra || {});
      nodes.push(n); return n; };
    const c = { currentTime: 0, sampleRate: 48000, state: "running",
      createGain: () => node("G"), createBiquadFilter: () => node("B", { type: "lowpass" }), createConstantSource: () => node("C"),
      createWaveShaper: () => node("W"), createBufferSource: () => node("S"),
      createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
      createPeriodicWave: (re, im, opt) => ({ re, im, opt }),
      createOscillator: () => { const o = node("O"); o.setPeriodicWave = () => {}; return o; } };
    return { c, nodes, edges };
  };
  const build = (patch, y) => { const m = mk2(); PA.ctx = m.c; PA._pw = null;
    m.v = PA._mkVoice({ master: { connect() {} }, send: { connect() {} } }, patch, 440, y == null ? .5 : y, 1);
    m.seq = m.nodes.map((n) => (n.k === "B" && n.type === "peaking" ? "P" : n.k)).join(""); return m; };
  const BASE = { legato: true, wave: "sawtooth", det: 9, sub: true, osc2: true, osc2wave: "square", osc2semi: 7, att: .01, fMin: 200, fMax: 4000, q: 2, lvl: .4,
                 drive: .3, fEnv: .4, fEnvT: .3 };
  const NOISE = { noise: true, lvl: .4, wave: "sine" }, YD = { cut: .5, lvl: .5, vib: 0, mode: "drive", drive: .5 };
  const OLD = { lead: "GBOOG", pluck: "GBOOG", ribbit: "GBOGOGOG", base: "GBCGWGOOOOOGOG", baseYdrive: "GBCGWGGGWGGOOOOOGOG",
                noise: "GBS", ribbitYdrive: "GBGGWGGOGOGOG" };
  const NEW = { base: "GBCGWGPPPOOOOOGOG", baseYdrive: "GBCGWGPPPGGWGGOOOOOGOG", noise: "GBPPPS", ribbit: "GBPPPOGOGOG", ribbitYdrive: "GBPPPGGWGGOGOGOG" };
  const CASES = [["lead", PP.lead], ["pluck", PP.pluck], ["ribbit", PP.ribbit], ["base", BASE], ["baseYdrive", BASE, YD], ["noise", NOISE], ["ribbitYdrive", PP.ribbit, YD]];
  for (const [k, patch, y] of CASES) {
    const m = build(patch, y), m0 = build(Object.assign({}, patch, { eq: [] }), y);
    ck("(m) bez `eq`: " + k + " buduje dokladnie te wezly co przed E2", m.seq === OLD[k] && m.v.eqN === undefined, m.seq + " vs " + OLD[k]);
    ck("(m) `eq: []` (z pominieciem sanitizera): " + k + " tez bez nowych wezlow", m0.seq === OLD[k], m0.seq);
  }
  const EQ3 = [{ f: 120, g: 5, q: .7 }, { f: 900, g: -4, q: 3 }, { f: 6000, g: 2.5, q: 1.5 }];
  const out = (m, id) => m.edges.filter((e) => e[0] === id).map((e) => e[1]);
  for (const [k, patch, y] of CASES.filter((c) => NEW[c[0]])) {
    const m = build(Object.assign({}, patch, { eq: EQ3 }), y);
    ck("(m) z `eq` (3 pasma): " + k + " = te same wezly + 3 x peaking we wlasciwym miejscu", m.seq === NEW[k], m.seq + " vs " + NEW[k]);
    const P = m.nodes.filter((n) => n.type === "peaking");
    let why = "";
    if (P.length !== 3) why = "peaking: " + P.length;
    else if (J(out(m, P[0].id - 1)) !== J([P[0].id])) why = "wejscie: " + J(out(m, P[0].id - 1));
    else if (J(out(m, P[0].id)) !== J([P[1].id]) || J(out(m, P[1].id)) !== J([P[2].id])) why = "lancuch";
    else if (J(out(m, P[2].id)) !== J(y ? [P[2].id + 1, P[2].id + 2] : [0])) why = "wyjscie: " + J(out(m, P[2].id));
    ck("(m) z `eq`: " + k + " polaczony szeregowo: poprzedni wezel -> pasma -> " + (y ? "przester z osi Y" : "gain glosu"), !why, why);
    ck("(m) z `eq`: " + k + " pasma w kolejnosci, frequency/gain/Q z patcha, v.eqN = te wezly",
       m.v.eqN && m.v.eqN.length === 3 && m.v.eqN.every((n, i) => n === P[i] && n.frequency.value === EQ3[i].f && n.gain.value === EQ3[i].g && n.Q.value === EQ3[i].q));
  }
  const ms = build(sp(Object.assign({}, BASE, { eq: EQ3 })));
  ck("(m) patch po sanitizerze z `eq` buduje ten sam lancuch", ms.seq === NEW.base, ms.seq);
}

// (n) ETAP E3 — OBWIEDNIA: sanitizer `envC`, kształt odcinka (dwie kopie), oś czasu, łamana, uchwyty i silnik na
//     udawanym AudioContext, który pilnuje reguł automatyki (panel obwiedni: uchwyty na suwakach, narzędzia, ekran ↔
//     patch — tests/curve_editors_harness.mjs)
{
  const isF32 = (a) => Object.prototype.toString.call(a) === "[object Float32Array]";
  // --- sanitizer
  const S = (envC, extra) => sp(Object.assign({ legato: true, wave: "sine" }, extra || {}, { envC }));
  for (const k of Object.keys(GOLD)) {
    ck("(n) sanitizePatch(" + k + ") nadal bajt w bajt, bez `envC`", J(sp(PP[k])) === GOLD[k] && !("envC" in sp(PP[k])));
    ck("(n) `envC: [0,0,0]` dopisane do " + k + ": ten sam JSON co bez klucza", J(sp(Object.assign({}, PP[k], { envC: [0, 0, 0] }))) === GOLD[k]);
  }
  const n1 = S([.333, -1.7, 0]);
  ck("(n) envC przechodzi: przyciecie do -1..1, 2 miejsca", J(n1.envC) === "[0.33,-1,0]", J(n1.envC));
  ck("(n) `envC` emitowany jako ostatni klucz", Object.keys(n1).slice(-1)[0] === "envC", Object.keys(n1).join(","));
  const n2 = S([.5, 0, 0], { wave: "custom", wt: SINE, eq: [{ f: 1000, g: 3, q: 1 }] });
  ck("(n) z fala i korektorem: kolejnosc ...wt, eq, envC", Object.keys(n2).slice(-3).join(",") === "wt,eq,envC", Object.keys(n2).slice(-3).join(","));
  ck("(n) sanitizePatch idempotentny z `envC`", J(sp(n1)) === J(n1) && J(sp(n2)) === J(n2));
  for (const [nm, v] of [["same zera", [0, 0, 0]], ["zera po zaokragleniu (0.004, -0.004)", [.004, -.004, 0]], ["dwie liczby", [1, 2]],
                         ["cztery liczby", [.1, .2, .3, .4]], ["tekst", "0.1,0.2,0.3"], ["liczba tekstem", [.5, "0.2", 0]],
                         ["NaN", [NaN, .2, 0]], ["Infinity", [Infinity, 0, 0]], ["null", [null, .5, 0]], ["obiekt", { 0: .5, 1: 0, 2: 0, length: 3 }]]) {
    const p = S(v); ck("(n) envC " + nm + ": brak klucza", !("envC" in p), J(p));
  }
  ck("(n) -0 nie przecieka do zapisu", J(S([-.004, .5, 0]).envC) === "[0,0.5,0]" && !Object.is(S([-.004, .5, 0]).envC[0], -0));
  {
    const XPAD = G("XPAD"), patch = S([-.4, .25, .9]);
    XPAD.customSounds = { obw: { name: "Obw", emoji: "🎛", patch } };
    let back = null;
    try { G("padApplyState")(JSON.parse(JSON.stringify(G("padState")()))); back = G("padState")().customSounds.obw; }
    catch (e) { ck("(n) obieg padState -> padApplyState z `envC`", false, e.message); }
    ck("(n) obieg zapisu (padState -> JSON -> padApplyState) zachowuje krzywizny", back && J(back.patch.envC) === "[-0.4,0.25,0.9]", back && J(back.patch.envC));
  }

  // --- kształt odcinka i jego kopia w silniku. Runda 2 (decyzja Fable, 2026-10-02): c 0 = DZISIEJSZY kształt
  //     wykładniczy (setTargetAtTime, tau = czas / 3), ujemne ostrzej, dodatnie łagodniej aż do prostej (.5) i wypukłej (1)
  const PAx = G("PadAudio");
  const grid = [0, .05, .1, .25, .5, .75, .9, 1], cs = [-1, -.6, -.2, 0, .3, .5, .7, 1];
  const e3 = (s) => (1 - Math.exp(-3 * s)) / (1 - Math.exp(-3));
  ck("(n) envShape(s, 0) = dzisiejszy ksztalt (1 - e^-3s) / (1 - e^-3), czyli setTargetAtTime z tau = czas / 3 doprowadzony do konca",
     grid.every((s) => near(SS.envShape(s, 0), e3(s), 1e-12)));
  ck("(n) envShape(s, .5) = s (odcinek prosty)", grid.every((s) => near(SS.envShape(s, .5), s, 1e-12)));
  ck("(n) envK: c -1 -> 12, 0 -> 3, .5 -> 0, 1 -> -6, ciagle na stykach",
     near(SS.envK(-1), 12, 1e-12) && SS.envK(0) === 3 && SS.envK(.5) === 0 && near(SS.envK(1), -6, 1e-12) &&
     near(SS.envK(-1e-9), 3, 1e-6) && near(SS.envK(1e-9), 3, 1e-6) && near(SS.envK(.5 + 1e-9), 0, 1e-6));
  ck("(n) envShape: konce 0 i 1 dla kazdego c, poza zakresem przyciete", cs.every((c) => SS.envShape(0, c) === 0 && near(SS.envShape(1, c), 1, 1e-15) && SS.envShape(-.5, c) === 0 && near(SS.envShape(1.5, c), 1, 1e-15)));
  let mono = true; for (const c of cs) for (let i = 1; i <= 100; i++) if (SS.envShape(i / 100, c) < SS.envShape((i - 1) / 100, c)) mono = false;
  ck("(n) envShape rosnie monotonicznie w s", mono);
  let monoC = true; for (let i = 1; i <= 200; i++) if (!(SS.envShape(.5, -1 + i / 100) < SS.envShape(.5, -1 + (i - 1) / 100))) monoC = false;
  ck("(n) envShape(.5, c) maleje z c (ostrzej -> dzis -> prosto -> wypukle)", monoC);
  ck("(n) c < .5: szybki start (envShape(.5) > .5), c > .5: wolny start (< .5)",
     SS.envShape(.5, -1) > SS.envShape(.5, 0) && SS.envShape(.5, 0) > .5 && SS.envShape(.5, .25) > .5 && SS.envShape(.5, .75) < .5 && SS.envShape(.5, 1) < SS.envShape(.5, .75));
  let ivE = 0; for (const c of cs) for (const s of grid) ivE = Math.max(ivE, Math.abs(SS.envInv(SS.envShape(s, c), c) - s));
  ck("(n) envInv odwraca envShape (rozklad punktow lamanej)", ivE < 1e-9, ivE);
  let cp21 = 0; for (const c of cs.concat([-.37, .12, .61, .5 + 1e-9])) for (const s of grid.concat([-.2, 1.3, .333])) cp21 = Math.max(cp21, Math.abs(SS.envShape(s, c) - PAx._envShape(s, c)));
  ck("(n) rf-21 _envShape = SoundScreens.envShape (kopia identyczna)", cp21 === 0, cp21);
  const k1 = SS.envCurve(.3, 0, -.4, 37), k2 = PAx._envCurve(.3, 0, -.4, 37);
  ck("(n) envCurve: Float32Array dlugosci n, konce dokladnie from/to", isF32(k1) && k1.length === 37 && k1[0] === Math.fround(.3) && k1[36] === 0, k1.length);
  ck("(n) envCurve: wartosci = from + (to - from) * envShape", Array.from(k1).every((v, i) => near(v, .3 - .3 * SS.envShape(i / 36, -.4), 1e-7)));
  ck("(n) rf-21 _envCurve = SoundScreens.envCurve", J(Array.from(k1)) === J(Array.from(k2)));
  ck("(n) envCurve: n < 2 daje 2 punkty", SS.envCurve(0, 1, 0, 1).length === 2);
  let inv = 0; for (let c = -1; c <= 1.0001; c += .0625) inv = Math.max(inv, Math.abs(SS.envCOf(SS.envMid(c)) - c));
  ck("(n) pierscien zgiecia: envCOf(envMid(c)) = c przez bisekcje (< 1e-4, laduje pod palcem)", inv < 1e-4, inv);
  ck("(n) envCOf: prosto (.5) = .5, przyciecie do -1..1, smieci nie wybuchaja",
     near(SS.envCOf(.5), .5, 1e-6) && SS.envCOf(.9999) === -1 && SS.envCOf(.001) === 1 && SS.envCOf(NaN) === 1);
  // --- oś czasu, łamana, obwiednia filtra, uchwyty
  const L1 = SS.envLayout(.012, .34, .6, .18, true);
  ck("(n) envLayout legato: x rosnie start < atak < zanik < podtrzymanie < zwolnienie",
     L1.start.x < L1.a.x && L1.a.x < L1.d.x && L1.d.x < L1.s.x && L1.s.x < L1.r.x, J([L1.a.x, L1.d.x, L1.s.x, L1.r.x]));
  ck("(n) envLayout legato: podtrzymanie ma szerokosc .22, koniec przy .96", near(L1.s.x - L1.d.x, .22, 1e-12) && near(L1.r.x, .96, 1e-12) && near(L1.start.x, .04, 1e-12));
  ck("(n) envLayout: cisza .06, szczyt .94, podtrzymanie .06 + sus * .88", L1.start.y === .06 && L1.a.y === .94 && near(L1.d.y, .06 + .6 * .88, 1e-12) && L1.r.y === .06);
  ck("(n) envLayout legato: skala = (A + D + R) / (.92 - .22)", near(L1.spu, .532 / .7, 1e-12) && near(L1.a.x, .04 + .012 / L1.spu, 1e-12), L1.spu);
  const L2 = SS.envLayout(.003, .34, .6, .18, false);
  ck("(n) envLayout pluck: bez podtrzymania i zwolnienia, zanik do ciszy przy .96",
     !L2.s && !L2.r && L2.segs.length === 2 && near(L2.d.x, .96, 1e-12) && L2.d.y === .06 && near(L2.spu, .343 / .92, 1e-12));
  const L3 = SS.envLayout(.1, .34, .6, .18, true, 1);
  ck("(n) envLayout z zamrozona skala (przeciaganie): x = .04 + t / spu", L3.spu === 1 && near(L3.a.x, .14, 1e-12) && near(L3.d.x, .48, 1e-12));
  const L0 = SS.envLayout(0, 0, 1, 0, true);
  ck("(n) envLayout bez czasow: bez NaN", Number.isFinite(L0.spu) && Number.isFinite(L0.r.x));
  const C3 = [-.7, .5, .3];
  // poziom krzywej w punkcie x obrazu, dokładnym kształtem — wzorzec po stronie testu (rf-25c miało go jako envAt, ale
  // poza testem nikt go nie wołał, więc odszedł w rundzie naprawczej 2026-10-02)
  const envAt = (lay, c, x) => {
    if (x <= lay.start.x || x >= lay.end) return SS.ENV_Y0;
    for (const [p, q, i] of lay.segs) if (x >= p.x && x <= q.x) { const w = q.x - p.x; return w > 1e-9 ? p.y + (q.y - p.y) * SS.envShape((x - p.x) / w, c[i] || 0) : q.y; }
    return lay.ys; };   // plateau
  for (const [nm, L] of [["legato", L1], ["pluck", L2]]) {
    const P = SS.envPoly(L, C3), X = Array.from(P.x), Y = Array.from(P.y);
    let up = true; for (let i = 1; i < 32; i++) if (X[i] < X[i - 1]) up = false;
    ck("(n) envPoly " + nm + ": 32 punkty, x nie maleje", X.length === 32 && Y.length === 32 && up);
    const keys = nm === "legato" ? [L.start, L.a, L.d, L.s, L.r] : [L.start, L.a, L.d];
    ck("(n) envPoly " + nm + ": przechodzi DOKLADNIE przez punkty (szczyt krotkiego ataku zostaje)",
       keys.every((q) => X.some((x, i) => near(x, q.x, 2e-7) && near(Y[i], q.y, 2e-7))));
    let on = 0; for (let i = 0; i < 32; i++) on = Math.max(on, Math.abs(envAt(L, C3, X[i]) - Y[i]));
    ck("(n) envPoly " + nm + ": kazdy punkt lezy na krzywej (envAt)", on < 2e-6, on);
    ck("(n) envPoly " + nm + ": wejscie i ogon w ciszy poza szyba", X[0] < 0 && Y[0] === Math.fround(.06) && X[31] > 1 && Y[31] === Math.fround(.06));
  }
  const fe = SS.envFilter(.5, .2, L1.spu);
  let feE = 0; for (let i = 0; i < 64; i++) { const t = Math.max(0, (i / 63 - .04) * L1.spu); feE = Math.max(feE, Math.abs(fe[i] - (.5 + .5 * .4 * Math.exp(-3 * t / .2)))); }
  ck("(n) envFilter: .5 + fEnv * .4 * exp(-3t / fEnvT) na tej samej osi, 64 probki", isF32(fe) && fe.length === 64 && feE < 1e-6, feE);
  ck("(n) envFilter: przed nuta stoi na szczycie, bez obwiedni = linia .5", near(fe[0], .7, 1e-6) && Array.from(SS.envFilter(0, .2, 1)).every((v) => v === .5));
  const ids = (hs) => hs.map((h) => h.id).join(",");
  const H1 = SS.envHandles(SS.envLayout(.012, .34, 1, .18, true), [0, 0, 0], 0, .2);
  ck("(n) uchwyty legato, podtrzymanie 100 %: bez zgiecia plaskiego zaniku", ids(H1) === "a,d,r,c0,c2,f", ids(H1));
  const H2 = SS.envHandles(L1, C3, .5, .2);
  ck("(n) uchwyty legato: 3 punkty, 3 zgiecia, filtr (7 <= 8 w BL)", ids(H2) === "a,d,r,c0,c1,c2,f" && H2.map((h) => h.kind).join("") === "1112223", ids(H2));
  ck("(n) uchwyty pluck: bez zwolnienia i jego zgiecia", ids(SS.envHandles(L2, C3, 0, .2)) === "a,d,c0,c1,f", ids(SS.envHandles(L2, C3, 0, .2)));
  const c1 = H2.find((h) => h.id === "c1");
  ck("(n) pierscien zgiecia w polowie odcinka, NA krzywej", near(c1.x, (L1.a.x + L1.d.x) / 2, 1e-12) && near(c1.y, envAt(L1, C3, c1.x), 1e-9), J(c1));
  const f1 = H2.find((h) => h.id === "f");
  ck("(n) pierscien filtra: x = czas obwiedni filtra, y = .5 + fEnv * .4", near(f1.x, .04 + .2 / L1.spu, 1e-12) && near(f1.y, .7, 1e-12));
  ck("(n) pierscien filtra za osia czasu zostaje na szybie (x <= .98)", SS.envHandles(L1, C3, -1, 2).find((h) => h.id === "f").x === .98);

  // --- silnik na udawanym AudioContext, który pilnuje reguł automatyki Web Audio
  //     ZEGAR jak w przeglądarce (runda 2): każdy odczyt currentTime przesuwa go o opts.adv (domyślnie 0,003 s), a czas
  //     startu w przeszłości jest przycinany do bieżącego zegara z ZACHOWANĄ długością krzywej (specyfikacja) — to ta
  //     klasa błędów rzuciła w smoke'u Fable („overlaps”). opts.hold = jest cancelAndHoldAtTime (Chromium);
  //     opts.oldCancel = cancelScheduledValues nie zdejmuje krzywej, która już trwa (starsze silniki);
  //     opts.curveThrows = krzywa po cancelAndHold odrzucona (gdyby przeglądarka tak zrobiła)
  const r6 = (x) => (typeof x === "number" ? +x.toFixed(6) : (x && x.length != null ? "arr" + x.length : String(x)));
  const mkA = (opts) => {
    const o = opts || {}, log = [], nodes = [], edges = [], adv = o.adv == null ? .003 : o.adv; let nid = 0, now = 1;
    const param = (owner, nm) => {
      const P = { value: 0, ev: [] };
      const L = (m, a) => log.push(owner.k + owner.id + "." + nm + "." + m + "(" + a.map(r6).join(",") + ")");
      const inCurve = (T) => P.ev.some((e) => e.d > 0 && T >= e.t && T < e.t + e.d);
      const plain = (m) => (...a) => { L(m, a); const T = Math.max(a[1], now);
        if (inCurve(T)) throw new Error("NotSupportedError: " + m + " inside a value curve"); P.ev.push({ t: T, d: 0 }); };
      P.setTargetAtTime = plain("setTargetAtTime"); P.setValueAtTime = plain("setValueAtTime");
      P.linearRampToValueAtTime = plain("linearRampToValueAtTime"); P.exponentialRampToValueAtTime = plain("exponentialRampToValueAtTime");
      P.setValueCurveAtTime = (...a) => { L("setValueCurveAtTime", a); const [k, T0, D] = a, T = Math.max(T0, now);
        if (!isF32(k) || k.length < 2) throw new Error("TypeError: curve"); if (!(D > 0)) throw new Error("RangeError: duration");
        if (o.curveThrows && P.held) throw new Error("NotSupportedError: refused");
        if (inCurve(T) || P.ev.some((e) => e.t > T && e.t < T + D)) throw new Error("NotSupportedError: value curve overlaps");
        P.ev.push({ t: T, d: D, k }); };
      P.cancelScheduledValues = (...a) => { L("cancelScheduledValues", a); const T = Math.max(a[0], now);
        P.ev = P.ev.filter((e) => e.t < T && (o.oldCancel || !(e.d > 0 && T < e.t + e.d))); };
      if (o.hold) P.cancelAndHoldAtTime = (...a) => { L("cancelAndHoldAtTime", a); const T = Math.max(a[0], now); P.held = true;
        P.ev = P.ev.filter((e) => e.t <= T).map((e) => (e.d > 0 && T < e.t + e.d ? Object.assign({}, e, { d: T - e.t }) : e)); P.ev.push({ t: T, d: 0 }); };
      return P; };
    const node = (k, extra) => { const n = { k, id: nid++, dis: 0, connect(d) { edges.push([n.id, d && d.id != null ? d.id : -1]); }, disconnect() { n.dis++; }, start() {}, stop() {} };
      for (const pn of ["gain", "frequency", "detune", "Q", "offset"]) n[pn] = param(n, pn);
      Object.assign(n, extra || {}); log.push("+" + k + n.id); nodes.push(n); return n; };
    const c = { sampleRate: 48000, state: "running",
      get currentTime() { const r = now; now = Math.round((now + adv) * 1e9) / 1e9; return r; }, set currentTime(x) { now = x; },
      createGain: () => node("G"), createBiquadFilter: () => node("B", { type: "lowpass" }), createConstantSource: () => node("C"),
      createWaveShaper: () => node("W"), createBufferSource: () => node("S"),
      createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
      createPeriodicWave: (re, im, op) => ({ re, im, op }), createOscillator: () => { const n = node("O"); n.setPeriodicWave = () => {}; return n; } };
    return { c, log, nodes, edges };
  };
  const timers = [], st0 = ctx.setTimeout;
  ctx.setTimeout = (f, ms) => { timers.push(Math.round(ms * 1000) / 1000); return 0; };
  // rel = chwila zwolnienia (s) albo nic; zwraca dziennik w formacie zapisanym starym rf-21
  const run = (patch, y, rel, opts) => {
    const m = mkA(opts); timers.length = 0; PA.ctx = m.c; PA._pw = null; let err = null;
    try { m.v = PA._mkVoice({ master: { connect() {} }, send: { connect() {} } }, patch, 440, y == null ? .5 : y, 1); } catch (e) { err = e; m.v = {}; }
    if (rel != null && !err) { m.c.currentTime = rel; m.log.push("|rel"); try { PA._release(m.v); } catch (e) { err = e; } }
    m.err = err; m.str = m.log.join(" ") + " T" + timers.join(","); m.T = timers.slice();
    m.seq = m.nodes.map((n) => n.k).join(""); return m; };
  // wartość krzywej w chwili t tak, jak ją gra specyfikacja (liniowo między próbkami) — niezależnie od rf-21
  const specVal = (k, t0, d, t) => { if (t <= t0) return k[0]; if (t >= t0 + d) return k[k.length - 1];
    const x = (t - t0) / d * (k.length - 1), j = Math.floor(x); return k[j] + (k[j + 1] - k[j]) * (x - j); };
  // dzienniki STAREGO rf-21 (sprzed E3) na tym samym udawanym kontekście: węzły (+), wywołania na parametrach, timery
  const GOLDC = {
    lead: "+G0 +B1 +O2 +O3 +G4 G0.gain.setTargetAtTime(0.42,1,0.005) T",
    leadRel: "+G0 +B1 +O2 +O3 +G4 G0.gain.setTargetAtTime(0.42,1,0.005) |rel G0.gain.cancelScheduledValues(1.05) G0.gain.setTargetAtTime(0,1.05,0.06) T870",
    sus: "+G0 +B1 +O2 +O3 +G4 G0.gain.setTargetAtTime(0.42,1,0.005) G0.gain.setTargetAtTime(0.252,1.017,0.083333) T",
    susRel: "+G0 +B1 +O2 +O3 +G4 G0.gain.setTargetAtTime(0.42,1,0.005) G0.gain.setTargetAtTime(0.252,1.017,0.083333) |rel G0.gain.cancelScheduledValues(1.05) G0.gain.setTargetAtTime(0,1.05,0.06) T870",
    pluck: "+G0 +B1 +O2 +O3 +G4 G0.gain.setTargetAtTime(0.375,1,0.003) G0.gain.setTargetAtTime(0,1.023,0.113333) T1663",
    pluckRel: "+G0 +B1 +O2 +O3 +G4 G0.gain.setTargetAtTime(0.375,1,0.003) G0.gain.setTargetAtTime(0,1.023,0.113333) |rel G0.gain.cancelScheduledValues(1.05) G0.gain.setTargetAtTime(0,1.05,0.066667) T1663,950",
    ribbit: "+G0 +B1 +O2 +G3 +O4 +G5 +O6 +G7 G0.gain.setTargetAtTime(0.52,1,0.008) T",
    ribbitRel: "+G0 +B1 +O2 +G3 +O4 +G5 +O6 +G7 G0.gain.setTargetAtTime(0.52,1,0.008) |rel G0.gain.cancelScheduledValues(1.05) G0.gain.setTargetAtTime(0,1.05,0.043333) T670",
    noise: "+G0 +B1 +S2 G0.gain.setTargetAtTime(0.26,1,0.03) |rel G0.gain.cancelScheduledValues(1.05) G0.gain.setTargetAtTime(0,1.05,0.1) T1350",
  };
  const SUS = Object.assign({}, PP.lead, { sus: .6, dec: .25 }), NZ = { noise: true, lvl: .4, wave: "sine", rel: .3 };
  const GC = [["lead", PP.lead], ["leadRel", PP.lead, 1.05], ["sus", SUS], ["susRel", SUS, 1.05], ["pluck", PP.pluck], ["pluckRel", PP.pluck, 1.05],
              ["ribbit", PP.ribbit], ["ribbitRel", PP.ribbit, 1.05], ["noise", NZ, 1.05]];
  for (const [k, patch, rel] of GC) {
    const m = run(patch, null, rel, { hold: true }), m0 = run(Object.assign({}, patch, { envC: [0, 0, 0] }), null, rel, { hold: true });
    ck("(n) bez `envC`: " + k + " = dokladnie te wezly i wywolania co przed E3 (zegar idzie przy kazdym odczycie)", m.str === GOLDC[k] && m.v.env === undefined && !m.err, m.str);
    ck("(n) `envC: [0,0,0]` (z pominieciem sanitizera): " + k + " tez bez zmian", m0.str === GOLDC[k], m0.str);
  }
  // atrapa łapie klasę błędu ze smoke'a: dwie krzywe tyłem do siebie od t odczytanego, zanim zegar skoczył
  {
    const m = mkA({ hold: true }), P = m.c.createGain().gain, t = m.c.currentTime; let thrown = null;
    try { P.setValueCurveAtTime(new Float32Array([0, 1]), t, .4); P.setValueCurveAtTime(new Float32Array([1, .5]), t + .4, .5); } catch (e) { thrown = e; }
    ck("(n) atrapa odtwarza blad ze smoke'a: atak (t, A) przyciety do zegara wchodzi na zanik (t + A) -> overlaps", thrown && /overlaps/.test(thrown.message), thrown && thrown.message);
  }
  // silnik z błędem planowania rzuca już w _mkVoice (run łapie to w m.err); dalsze sprawdzenia nie mogą wtedy wywrócić
  // całego harnessu, więc sekcja ma własną siatkę: wyjątek = jedno czerwone sprawdzenie z komunikatem
  try {
  const gl = (m, id, nm) => m.log.filter((s) => s.startsWith((m.nodes[id] ? m.nodes[id].k + id : "?") + "." + (nm || "gain") + "."));
  const ENV = [-.5, .4, .3];
  // podział krzywej atak + zanik liczony niezależnie od rf-21 (_envPair): krok ≤ 5 ms, ≥ 8 próbek na część, do ~4096
  const pairN = (a, d) => { let h = Math.min(.005, a / 8, d / 8), nA = Math.max(1, Math.round(a / h)); h = a / nA; let nD = Math.max(1, Math.round(d / h));
    if (nA + nD > 4096) { h = (a + d) / 4096; nA = Math.max(1, Math.round(a / h)); nD = Math.max(1, 4096 - nA); } return { nA, nD, dur: (nA + nD) * h }; };
  // legato, sus .6: atak + zanik JEDNĄ krzywą
  const mL = run(Object.assign({}, SUS, { envC: ENV }), null, null, { hold: true });
  ck("(n) z `envC` (legato): dokladnie jeden Gain wiecej, przed oscylatorami, bez wyjatku", mL.seq === "GBGOOG" && !mL.err, mL.seq + (mL.err ? " " + mL.err.message : ""));
  const envN = mL.v.env, eid = envN && envN.id;
  ck("(n) z `envC`: v.env = ten Gain, gain 0, wpiety tylko w g", envN && envN.k === "G" && envN.gain.value === 0 && J(mL.edges.filter((e) => e[0] === eid).map((e) => e[1])) === "[0]");
  ck("(n) z `envC`: filtr -> env (a nie prosto w g)", J(mL.edges.filter((e) => e[0] === 1).map((e) => e[1])) === J([eid]), J(mL.edges.filter((e) => e[0] === 1)));
  ck("(n) z `envC`: g dostaje poziom od razu (setValueAtTime(gTarget, t)), nic wiecej", J(gl(mL, 0)) === '["G0.gain.setValueAtTime(0.42,1)"]', J(gl(mL, 0)));
  const PL = pairN(.012, .25);
  ck("(n) z `envC`: env = setValueAtTime(0, t) i JEDNA krzywa (t, A + D) - atak i zanik bez szwu, ktory mogl sie zderzyc",
     J(gl(mL, eid)) === J(["G" + eid + ".gain.setValueAtTime(0,1)", "G" + eid + ".gain.setValueCurveAtTime(arr" + (PL.nA + PL.nD + 1) + ",1," + r6(PL.dur) + ")"]), J(gl(mL, eid)));
  const ev2 = envN.gain.ev.filter((e) => e.d > 0), KL = ev2[0] && ev2[0].k;
  ck("(n) krzywa: atak 0 -> 1 ze zgieciem ataku, zanik 1 -> sus ze zgieciem zaniku (te same wartosci co envCurve ekranu)",
     ev2.length === 1 && J(Array.from(KL.slice(0, PL.nA + 1))) === J(Array.from(SS.envCurve(0, 1, -.5, PL.nA + 1))) &&
     J(Array.from(KL.slice(PL.nA))) === J(Array.from(SS.envCurve(1, .6, .4, PL.nD + 1))));
  ck("(n) atak i zanik stykaja sie dokladnie: szczyt (1) w probce nA, czyli w t + A, bez luzu",
     KL && KL[PL.nA] === 1 && near(PL.nA * PL.dur / (PL.nA + PL.nD), .012, 1e-12) && near(PL.dur - .012, .25, .0015 / 2 + 1e-12), KL && KL[PL.nA] + " @ " + PL.nA * PL.dur / (PL.nA + PL.nD));
  // przypadek ze smoke'a: atak 400 ms, zegar skacze o 3 kwanty (8 ms) przy KAŻDYM odczycie
  const mS = run(Object.assign({}, SUS, { att: .4, envC: ENV }), null, null, { hold: true, adv: 384 / 48000 });
  ck("(n) smoke Fable: atak 400 ms, zegar skacze o 8 ms przy odczycie -> bez wyjatku (krzywa przesunieta w calosci)",
     !mS.err && mS.v.env.gain.ev.filter((e) => e.d > 0).length === 1, mS.err && mS.err.message);
  let sweep = 0, sweepWhy = "";
  for (const att of [.001, .012, .4, 3]) for (const dec of [.02, .25, 6]) for (const sus of [0, .6, 1]) for (const legato of [true, false])
    for (const rf of [null, .5, 1, 1.5]) {
      const rel = rf == null ? null : 1 + att * rf, m = run({ legato, wave: "sawtooth", att, dec, sus, rel: .18, fMin: 200, fMax: 4000, q: 1, lvl: .4, envC: [-.8, .9, .2] }, null, rel, { hold: true, adv: .008 });
      const cv = m.v.env ? m.v.env.gain.ev.filter((e) => e.d > 0) : [];
      if (m.err) { sweep++; sweepWhy = att + "/" + dec + "/" + sus + "/" + legato + "/" + rf + ": " + m.err.message; }
      else if (cv.some((e) => e.k.length > 4098)) { sweep++; sweepWhy = "krzywa " + Math.max(...cv.map((e) => e.k.length)); }
    }
  ck("(n) 288 kombinacji (atak 1 ms..3 s, zanik 20 ms..6 s, sus, legato/pluck, zwolnienie w trakcie ataku, na szczycie i w zaniku), zegar skacze o 8 ms: zero wyjatkow, krzywe <= 4097 probek",
     sweep === 0, sweepWhy);
  const PC = pairN(.001, 6);
  ck("(n) krzywa atak + zanik przy skrajnych czasach (1 ms + 6 s): najwyzej ~4097 probek, szczyt = 1 na swojej probce",
     PC.nA + PC.nD <= 4096 && (() => { const m = run({ legato: false, wave: "sine", att: .001, dec: 6, fMin: 200, fMax: 4000, q: 1, lvl: .4, envC: [0, .2, 0] }, null, null, { hold: true });
       const k = m.v.env.gain.ev.filter((e) => e.d > 0)[0].k; return k.length === PC.nA + PC.nD + 1 && k[PC.nA] === 1 && k[k.length - 1] === 0 && near(m.v.env.gain.ev.filter((e) => e.d > 0)[0].d, 6.001, 1e-9); })(), J(PC));
  const nL = Math.max(8, Math.min(256, Math.round(.012 * 200)));
  ck("(n) pojedyncza krzywa (atak bez zaniku, zwolnienie): n = round(czas * 200) w 8..256", Math.max(8, Math.min(256, Math.round(30 * 200))) === 256 && nL === 8 && Math.round(.18 * 200) === 36);
  const mL1 = run(Object.assign({}, PP.lead, { envC: ENV }), null, null, { hold: true });
  ck("(n) legato z podtrzymaniem 100 %: tylko krzywa ataku", gl(mL1, mL1.v.env.id).filter((s) => s.includes("Curve")).length === 1 &&
     J(Array.from(mL1.v.env.gain.ev.filter((e) => e.d > 0)[0].k)) === J(Array.from(SS.envCurve(0, 1, -.5, nL))), J(gl(mL1, mL1.v.env.id)));
  // zwolnienie z cancelAndHoldAtTime: krzywa od wartości z tej chwili do 0, g nietknięte
  const mR = run(Object.assign({}, SUS, { envC: ENV }), null, 1.05, { hold: true }), eR = mR.v.env.id;
  const after = mR.log.slice(mR.log.indexOf("|rel") + 1);
  const relN = Math.round(.18 * 200), cvR = mR.v.env.gain.ev.filter((e) => e.d > 0), relK = cvR.slice(-1)[0];
  const want = specVal(cvR[0].k, 1, PL.dur, 1.05);
  ck("(n) zwolnienie: cancelAndHoldAtTime(t) i krzywa(t, rel) na env, jedno t, bez wyjatku",
     !mR.err && J(after) === J(["G" + eR + ".gain.cancelAndHoldAtTime(1.05)", "G" + eR + ".gain.setValueCurveAtTime(arr" + relN + ",1.05,0.18)"]), J(after) + (mR.err ? " " + mR.err.message : ""));
  ck("(n) zwolnienie: krzywa startuje z wartosci krzywej zaniku w tej chwili (bez skoku), konczy na 0",
     relK && want > .6 && want < 1 && near(relK.k[0], want, 1e-6) && relK.k[relK.k.length - 1] === 0 && J(Array.from(relK.k)) === J(Array.from(SS.envCurve(want, 0, .3, relN))),
     relK && relK.k[0] + " vs " + want);
  ck("(n) zwolnienie: krzywa zwolnienia zaczyna sie po przytrzymaniu, nie wewnatrz zadnej krzywej", cvR.length === 2 && cvR[1].t >= cvR[0].t + cvR[0].d);
  ck("(n) zwolnienie: g bez zmian (bez podwojnego wybrzmienia), koniec glosu po rel + .12 s", !after.some((s) => s.startsWith("G0.")) && mR.T.slice(-1)[0] === 300, J(mR.T));
  // zwolnienie W TRAKCIE ATAKU (bramka odbioru E3): cztery rodzaje silnika, zero wyjątków
  const mH = run(Object.assign({}, SUS, { envC: ENV }), null, 1.005, { hold: true });
  const cvH = mH.v.env.gain.ev.filter((e) => e.d > 0), wa = specVal(cvH[0].k, 1, PL.dur, 1.005), relH = cvH.slice(-1)[0];
  ck("(n) zwolnienie w trakcie ataku (cancelAndHold): bez wyjatku, atak uciety, krzywa od biezacej wartosci",
     !mH.err && cvH.length === 2 && cvH[0].d < .012 && near(relH.k[0], wa, 1e-6) && wa > 0 && wa < 1, mH.err ? mH.err.message : relH && relH.k[0] + " vs " + wa);
  const mF = run(Object.assign({}, SUS, { envC: ENV }), null, 1.005, {});
  const aF = mF.log.slice(mF.log.indexOf("|rel") + 1), eF = mF.v.env.id;
  ck("(n) bez cancelAndHoldAtTime: sciezka zapasowa na env (cancel, setValueAtTime(biezaca), setTargetAtTime), bez wyjatku",
     !mF.err && aF.length === 3 && aF[0] === "G" + eF + ".gain.cancelScheduledValues(1.005)" && aF[1].startsWith("G" + eF + ".gain.setValueAtTime(" + r6(wa)) &&
     aF[2] === "G" + eF + ".gain.setTargetAtTime(0,1.005,0.06)" && mF.T.slice(-1)[0] === 870, J(aF) + (mF.err ? " " + mF.err.message : ""));
  const mO = run(Object.assign({}, SUS, { envC: ENV }), null, 1.005, { oldCancel: true });
  const aO = mO.log.slice(mO.log.indexOf("|rel") + 1);
  ck("(n) starszy silnik (trwajaca krzywa blokuje zdarzenia): bez wyjatku, wybrzmiewa gain glosu",
     !mO.err && aO.slice(-2).join(" ") === "G0.gain.cancelScheduledValues(1.005) G0.gain.setTargetAtTime(0,1.005,0.06)", J(aO) + (mO.err ? " " + mO.err.message : ""));
  const mX = run(Object.assign({}, SUS, { envC: ENV }), null, 1.005, { hold: true, curveThrows: true });
  ck("(n) cancelAndHold jest, ale krzywa odrzucona: bez wyjatku, wykladniczy ogon na env",
     !mX.err && mX.log.slice(-1)[0] === "G" + mX.v.env.id + ".gain.setTargetAtTime(0,1.005,0.06)", J(mX.log.slice(-4)) + (mX.err ? " " + mX.err.message : ""));
  const mRR = run(Object.assign({}, SUS, { envC: ENV }), null, 1.05, { hold: true }); mRR.c.currentTime = 1.1; let e2 = null;
  try { PA._release(mRR.v); } catch (e) { e2 = e; }
  ck("(n) drugie zwolnienie w trakcie krzywej zwolnienia: bez wyjatku", !e2, e2 && e2.message);
  // pluck, rechot, szum
  const mP = run(Object.assign({}, PP.pluck, { envC: [0, -.6, 0] }), null, null, { hold: true }), eP = mP.v.env.id;
  const evP = mP.v.env.gain.ev.filter((e) => e.d > 0), PP2 = pairN(.003, .34), kP = evP[0] && evP[0].k;
  ck("(n) pluck z `envC`: GBGOOG, g od razu na poziom, atak + zanik do 0 jedna krzywa (szczyt 1 w t + A)",
     mP.seq === "GBGOOG" && J(gl(mP, 0)) === '["G0.gain.setValueAtTime(0.375,1)"]' && evP.length === 1 && near(evP[0].d, PP2.dur, 1e-12) &&
     kP[0] === 0 && kP[PP2.nA] === 1 && kP[kP.length - 1] === 0 && near(PP2.nA * PP2.dur / (PP2.nA + PP2.nD), .003, 1e-12), mP.seq + " " + J(gl(mP, eP)));
  ck("(n) pluck z `envC`: koniec glosu po dlugosci krzywej + .25 s (a nie A + D*4 + .3)", J(mP.T) === J([Math.round((PP2.dur + .25) * 1e6) / 1e3]), J(mP.T));
  const mC = run(Object.assign({}, PP.ribbit, { envC: [.4, 0, -.3] }), null, 1.05, { hold: true }), eC = mC.v.env.id;
  ck("(n) rechot z `envC`: jeden Gain wiecej (GBGOGOGOG), env -> g, tylko krzywa ataku, zwolnienie krzywa",
     mC.seq === "GBGOGOGOG" && J(mC.edges.filter((e) => e[0] === eC).map((e) => e[1])) === "[0]" &&
     J(gl(mC, eC).map((s) => s.replace(/\(.*$/, ""))) === J(["G" + eC + ".gain.setValueAtTime", "G" + eC + ".gain.setValueCurveAtTime", "G" + eC + ".gain.cancelAndHoldAtTime", "G" + eC + ".gain.setValueCurveAtTime"]) && !mC.err,
     mC.seq + " " + J(gl(mC, eC)));
  const mN = run(Object.assign({}, NZ, { envC: [.5, .5, .5] }), null, 1.05, { hold: true });
  ck("(n) szum z `envC`: bez env, dokladnie jak przed E3", mN.str === GOLDC.noise && mN.v.env === undefined, mN.str);
  const mY = run(Object.assign({}, SUS, { drive: .3, eq: [{ f: 900, g: 3, q: 1 }], envC: ENV }), { cut: .5, lvl: .5, vib: 0, mode: "drive", drive: .5 }, null, { hold: true });
  const eY = mY.v.env.id, inY = mY.edges.filter((e) => e[1] === eY).map((e) => e[0]);
  ck("(n) z przesterem, korektorem i przesterem z osi Y: env za nimi wszystkimi, tuz przed g",
     inY.length === 1 && inY[0] === eY - 1 && J(mY.edges.filter((e) => e[0] === eY).map((e) => e[1])) === "[0]", J(inY) + " " + mY.seq);
  PA._kill(mL.v);
  ck("(n) _kill rozlacza tez env", mL.v.env.dis === 1 && mL.nodes[0].dis === 1);
  } catch (e) { ck("(n) silnik: sprawdzenia przerwane wyjatkiem", false, e && e.message); }
  // mierniki padów zaprogramowanych (rf-25b) liczą poziom głosu razem z env
  const r25b = fs.readFileSync(path.join(REPO, "web/js/rf-25b-seq-pads.js"), "utf8");
  ck("(n) rf-25b: oba odczyty poziomu glosu mnoza g przez env (gdy jest)", (r25b.match(/v\.g\.gain\.value\*\(v\.env\?v\.env\.gain\.value:1\)/g) || []).length === 2);
  ctx.setTimeout = st0;
}

// (o) ETAP E5 — OKRĄGŁA LAMPA Z KOPUŁĄ SZKŁA I PULPIT: geometria tarczy w obie strony (JS ↔ shader), pole edycji
//     w tarczy, trwałość luminoforu, wskaźnik poziomu, żaby na obwódce w Widmie, dwa shadery i nowy układ w HTML/CSS
{
  // --- tarcza: promień szyby D/2 − F, trzy średnice (kopułę w JS usunęła runda naprawcza 2026-10-02; liczy ją shader)
  for (const D of [300, 440, 760]) {
    const d = SS._disc(D, D), top = SS.discToGlass(0, 1, D, D), c = SS.discToGlass(0, 0, D, D);
    ck("(o) promien szyby = D/2 - F, srodek dysku w srodku tarczy, gora szyby (sc.y = 1) na y = F, tarcza " + D + " px",
       d.R === D / 2 - SS.F && c.x === D / 2 && c.y === D / 2 && top.x === D / 2 && near(top.y, SS.F, 1e-12), J([d, top]));
  }
  // stałe JS ↔ źródło shadera i ↔ CSS (przycięcie canvasów i cień tarczy na promieniu D/2 − (F − HW))
  const src = ctx.PadPlate._fs.skop || "", blit = ctx.PadPlate._fs["skop-blit"] || "";
  const m = /const float F=([\d.]+),K=([\d.]+),HW=([\d.]+);/.exec(blit);
  ck("(o) skop-blit ma te same stale lampy co JS (F, K, HW)", m && +m[1] === SS.F && +m[2] === SS.K && +m[3] === SS.HW, m && m.slice(1).join(","));
  const css = fs.readFileSync(path.join(REPO, "web/css/29-sound-screens.css"), "utf8"), gap = SS.F - SS.HW;
  ck("(o) CSS przycina canvasy do kola D/2 - (F - HW) = " + gap + " px i stawia tam cien tarczy",
     css.includes("clip-path:circle(calc(50% - " + gap + "px))") && new RegExp("\\.sk-glass::before\\{[^}]*inset:" + gap + "px").test(css));
  // dwa shadery: zarejestrowane, bez odwrotnych apostrofów, wspólna szyba, HT czytany po razie
  ck("(o) zarejestrowane oba shadery: skop i skop-blit", src.length > 500 && blit.length > 200 && /vec3 plate\(vec2 px,vec2 uv,vec2 r\)\{/.test(blit));
  ck("(o) zrodla obu shaderow bez odwrotnych apostrofow", !src.includes("`") && !blit.includes("`"));
  ck("(o) skop-blit deklaruje BC[2] (tlo panelu, filc obudowy)", /uniform vec3 BC\[2\]/.test(blit));
  const glassOf = (s) => { const a = s.indexOf("const float F="), b = s.indexOf("return mix(kHous(q,sd,Rg,px),col,1.-smoothstep(-.8,.8,sd));}"); return a >= 0 && b > a ? s.slice(a, b) : null; };
  ck("(o) szyba i obudowa (kHous, fin) identyczne w obu shaderach", glassOf(src) && glassOf(src) === glassOf(blit));
  const ht = (s) => (s.match(/texture\(HT,/g) || []).length;
  ck("(o) HT czytany raz w kazdym shaderze: skop tylko w trwalosci, skop-blit tylko w plate()",
     ht(src) === 1 && ht(blit) === 1 && src.includes("vec3 pv=texture(HT,uv).rgb;col=max(col,max(pv*BK[6]-1.5/255.,0.));") &&
     blit.includes("return fin(texture(HT,uv).rgb,px,r);"));
  ck("(o) trwalosc tylko z BK[6] > 0; BK[6] < 0 = jedno przejscie prosto na canvas z szyba i obudowa (fin)",
     src.includes("bool dir=BK[6]<0.;") && src.includes("return dir?fin(col,px,r):col;}"));
  ck("(o) skop: jeden obraz (pierscien i slonce bez warunku na styl), kSun bez sily stylu", src.includes("vec3 col=kPolar(kPhos(pc,Rg,px),sc,rho,th,Rg);") &&
     src.includes("col=kSun(col,sc,rho,th,Rg);") && !/if\(BK\[7\]/.test(src));
  ck("(o) shader: bez pow() (E7: Fresnel a^2,5 jako a*a*sqrt(a)), kwadraty liczone mnozeniem", !/\bpow\(/.test(src) && src.includes("fr=fa*fa*sqrt(fa);"));
  // trwałość luminoforu
  ck("(o) phosDecay: ograniczony ruch = 0, dt 0 = 1, dt = TAU -> 1/e, maleje z dt; E7: TAU = .5 s",
     SS.phosDecay(16, true) === 0 && SS.phosDecay(0, false) === 1 && near(SS.phosDecay(500, false), Math.exp(-1), 1e-12) &&
     SS.phosDecay(33, false) < SS.phosDecay(16, false) && SS.TAU === .5);
  // E7: rozbieg po żądaniu z zewnątrz (KICK·TAU) trwa, póki pełny ślad (1,0) nie zgaśnie do progu żywego obrazu przy 60 Hz
  let tr = 1, tt = 0; while (tr > .004 && tt < 1e4) { tr = Math.max(0, tr * SS.phosDecay(1000 / 60, false) - 1.5 / 255); tt += 1000 / 60; }
  ck("(o) E7: rozbieg KICK*TAU (" + Math.round(SS.KICK * SS.TAU * 1000) + " ms) dluzszy niz gasniecie pelnego sladu przy 60 Hz (" + Math.round(tt) + " ms)",
     SS.KICK * SS.TAU * 1000 >= tt && SS.KICK * SS.TAU * 1000 <= 3000);
  // wskaźnik poziomu
  let mono = true; for (let i = 1; i <= 400; i++) if (SS.vuLeds(i / 400) < SS.vuLeds((i - 1) / 400)) mono = false;
  ck("(o) vuLeds: 0 -> 0, .02 -> 1, .9 -> 12, 1 -> 12, ponizej .02 i NaN -> 0, rosnie monotonicznie",
     SS.vuLeds(0) === 0 && SS.vuLeds(.02) === 1 && SS.vuLeds(.9) === 12 && SS.vuLeds(1) === 12 && SS.vuLeds(.0199) === 0 && SS.vuLeds(NaN) === 0 && SS.vuLeds(.89) === 11 && mono);
  const leds = Array.from({ length: 12 }, () => ({ on: false, n: 0, classList: null }));
  leds.forEach((l) => { l.classList = { toggle: (c, v) => { l.n++; l.on = !!v; } }; });
  const vu0 = SS._vuEl, vn0 = SS._vuN; SS._vuEl = { children: leds }; SS._vuN = -1;
  SS._vu(.5); const lit = leds.filter((l) => l.on).length, n1 = leds[0].n; SS._vu(.5); SS._vu(.5001);
  ck("(o) _vu zapala vuLeds(lv) diod i dotyka DOM tylko przy zmianie liczby", lit === SS.vuLeds(.5) && leds[0].n === n1, lit + " / " + leds[0].n);
  SS._vu(0); ck("(o) _vu(0) gasi wszystkie diody (sleep)", leds.every((l) => !l.on));
  SS._vuEl = vu0; SS._vuN = vn0;
  // żaby na obwódce: kąt klasy nuty jako ułamek obrotu (C na górze), promień FROG_R
  const oldB = PA.buses;
  PA.buses = { "__lab__": { voices: { c: { stopped: false, note: 60 }, g: { stopped: false, note: 67 }, b: { stopped: false, note: 59 } } } };
  const fw = SS._frogs(); PA.buses = oldB;
  ck("(o) zaba na obwodce: n = 60 -> kat 0, n = 67 -> 7/12, n = 59 -> 11/12, promien .9",
     fw.c && fw.c.x === 0 && near(fw.g.x, 7 / 12, 1e-12) && near(fw.b.x, 11 / 12, 1e-12) && fw.c.y === .9 && fw.g.y === .9, J(fw));
  // E6: lampa jest tylko wizualizacją — bez stanu edycji, wskaźnika i patch I/O (to wszystko ma rf-25e)
  const gone = ["readInto", "load", "setChannel", "_down", "_move", "_apply", "_eqDown", "_envDown", "_buildTools", "_syncTools", "_pt", "_cross"].filter((k) => k in SS);
  ck("(o) E6: SoundScreens bez edycji (readInto, load, kanaly, wskaznik, narzedzia przeszly do rf-25e)", !gone.length && !("_wt" in SS) && !("_eq" in SS) && !("_envC" in SS), gone.join(","));
  // E7: jeden obraz — przełącznik stylu (pokrętło, dwa klawisze, strzałki), jego stan i zapis rf.skopStyle odeszły
  const styl = ["STYLES", "ANG", "style", "setStyle", "_nextStyle", "_tabKeys", "_rot"].filter((k) => k in SS);
  ck("(o) E7: SoundScreens bez stylu obrazu (STYLES, ANG, style, setStyle, _nextStyle, _tabKeys, _rot), BK[8] same zera",
     !styl.length && J(Array.from(SS._uni().BK)) === "[0,0,0,0,0,0,0,0]", styl.join(","));
  ck("(o) E7: rf-25c nie czyta ani nie pisze rf.skopStyle i nie szuka klawiszy stylu", !R25C_CODE.includes("rf.skopStyle") && !/sk-chb|sk-ch\b|skRot|data-style/.test(R25C_CODE));
  // „Powiększ”: klasa na oscyloskopie, aria-pressed, zapis w localStorage pod rf.skopBig
  const store = {}, ls0 = ctx.localStorage, sc0 = SS._scope, el0 = SS._el;
  ctx.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const cls = new Set(), bigB = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  SS._scope = { classList: { toggle: (c, v) => { if (v) cls.add(c); else cls.delete(c); }, contains: (c) => cls.has(c) } };
  SS._el = (id) => (id === "skBig" ? bigB : null);
  SS._setBig(true, true);
  ck("(o) Powieksz: klasa big, aria-pressed true, rf.skopBig = 1", cls.has("big") && bigB.attrs["aria-pressed"] === "true" && store["rf.skopBig"] === "1");
  SS._setBig(false, true);
  ck("(o) Zmniejsz: bez klasy big, aria-pressed false, rf.skopBig = 0", !cls.has("big") && bigB.attrs["aria-pressed"] === "false" && store["rf.skopBig"] === "0");
  ctx.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  let thrown = null; try { SS._setBig(true, true); } catch (e) { thrown = e; }
  ck("(o) Powieksz przy zablokowanym localStorage nie rzuca", !thrown && cls.has("big"), thrown && thrown.message);
  ctx.localStorage = ls0; SS._scope = sc0; SS._el = el0;
  // HTML: pulpit obok tarczy — zakładki stylu w pulpicie, pokrętło, przyciski podglądu (te same id i klasy), VU, Powiększ.
  // Blok lampy kończy się tam, gdzie zaczyna się rack modułów (etap E4a; do niego granicą była listwa .se-actions).
  const html = fs.readFileSync(path.join(REPO, "web/ribbitflip_dashboard.html"), "utf8");
  const a = html.indexOf('id="skScope"'), z = html.indexOf('class="se-rack"', a), blk = a > 0 && z > a ? html.slice(a, z) : "";
  const panel = blk.slice(blk.indexOf('class="sk-panel"'));
  const caps = (panel.match(/<span class="sk-cap">([^<]+)<\/span>/g) || []).map((c) => c.replace(/<[^>]+>/g, ""));
  ck("(o) HTML: szyba przed pulpitem; E7: pulpit bez stylu (zadnego sk-ch, sk-chb, #skRot, data-style), podglad na gorze, pod nim Poziom z Powieksz",
     blk.indexOf('id="skGlass"') > 0 && blk.indexOf('id="skGlass"') < blk.indexOf('class="sk-panel"') &&
     !/sk-ch|sk-rot|skRot|data-style/.test(blk) && J(caps) === J(["Podgląd", "Poziom"]) &&
     panel.indexOf('id="seTest"') < panel.indexOf('id="skVu"') && panel.indexOf('id="skVu"') < panel.indexOf('id="skBig"') &&
     !/role="tab(list)?"/.test(blk) && !/data-ch=|id="skTools"/.test(blk), J(caps));
  ck("(o) css/29: bez regul przelacznika stylu (.sk-ch, .sk-chb, .sk-rot)", !/\.sk-(ch|chb|rot)\b/.test(css.replace(/\/\*[^]*?\*\//g, "")));
  ck("(o) HTML: #seTest, #seHold, #seCont z klasami btn sm, bez starej listwy .sk-bar",
     ["seTest", "seHold", "seCont"].every((id) => new RegExp('<button class="btn sm" id="' + id + '" type="button"').test(panel)) && !blk.includes("sk-bar"));
  ck("(o) HTML: wskaznik poziomu #skVu (role=img, aria-label) z 12 diodami", /id="skVu" role="img" aria-label="[^"]+"/.test(panel) && (panel.match(/<span class="sk-led"><\/span>/g) || []).length === 12);
  ck("(o) HTML: #skBig z aria-pressed i dwoma napisami (Powieksz / Zmniejsz)", /id="skBig" aria-pressed="false"/.test(panel) && panel.includes("⤢ Powiększ") && panel.includes("⤡ Zmniejsz"));
}

// (p) RUNDA NAPRAWCZA PO PRZEGLĄDZIE (2026-10-02): lampa w czasie. Każdy przebieg w ŚWIEŻYM kontekście vm z prawdziwym
//     rf-25c (i rf-25e, z którego tryb zastępczy bierze poziom), z kolejką rAF i zegarem klatek (document.timeline)
//     w rękach testu; render GL zastąpiony atrapą, która wygasza poziom jak _feat i ślad jak luminofor.
const R25C = fs.readFileSync(path.join(REPO, "web/js/rf-25c-sound-screens.js"), "utf8");
const R25E = fs.readFileSync(path.join(REPO, "web/js/rf-25e-curve-editors.js"), "utf8");
const OLD25C = path.join(REPO, "_backups/261002-skop-fix/rf-25c-sound-screens.js");
function lampSim(src) {
  const q = [], tl = { currentTime: 0 }, mo = [], winL = {}, fills = [];
  let pnow = 0;
  const leds = Array.from({ length: 12 }, () => ({ on: false }));
  leds.forEach((l) => { l.classList = { toggle: (c, v) => { l.on = !!v; } }; });
  const mk2d = () => new Proxy({}, {
    get(t, k) { if (k === "measureText") return (s) => ({ width: String(s).length * 6 }); if (k === "fillText") return (s) => fills.push(String(s));
      if (typeof k === "symbol") return undefined; return k in t ? t[k] : () => {}; },
    set(t, k, v) { t[k] = v; return true; } });
  const ov = { width: 0, height: 0, _c: null, getContext() { return this._c || (this._c = mk2d()); } };
  const box = { open: true, L: [], addEventListener(t, f) { if (t === "toggle") this.L.push(f); } };
  const glass = { offsetParent: {}, clientWidth: 440, clientHeight: 440 };
  const scope = { dataset: {}, querySelectorAll: () => [], querySelector: () => null, classList: { toggle() {}, contains: () => false } };
  const els = { soundEditor: box, skScope: scope, skGlass: glass, skOverlay: ov, skVu: { children: leds } };
  const c = {
    console, __lang: "pl", performance: { now: () => pnow }, requestAnimationFrame: (cb) => { q.push(cb); return q.length; },
    document: { timeline: tl, getElementById: (id) => els[id] || null, documentElement: { lang: "pl" }, body: {} },
    getComputedStyle: () => ({ fontFamily: "Test" }), localStorage: { getItem: () => null, setItem() {} },
    MutationObserver: class { constructor(f) { this.f = f; mo.push(this); } observe(t, o) { this.t = t; this.o = o; } },
    addEventListener: (t, f) => { (winL[t] || (winL[t] = [])).push(f); },
    devicePixelRatio: 1, PadPlate: { _fs: {} },
  };
  c._gl = (pl, en) => (c.__lang === "en" ? en : pl);
  c.window = c; vm.createContext(c);
  vm.runInContext(src + "\n" + R25E + "\nthis.SS=SoundScreens;this.SE=SoundEditors;", c);
  return { c, q, tl, mo, winL, leds, fills, box, glass, ov, SS: c.SS, SE: c.SE, setNow: (t) => { pnow = t; },
           run(t) { tl.currentTime = t; pnow = t + .2; for (const cb of q.splice(0)) cb(); } };
}
// Jeden przebieg: lab gra przez 600 ms (pętla padów woła labDraw → draw() co klatkę), potem cisza. pads = pętla padów
// woła draw() dalej co klatkę (grają inne pady), a lab milczy. Kolejność w klatce na zmianę: pętla padów, potem własna
// klatka lampy, albo odwrotnie; performance.now() biegnie w klatce (+0,3 ms na wywołanie), znacznik klatki stoi.
function lampRun(src, hz, jitter, pads, seed) {
  const S = lampSim(src), SS = S.SS, c = S.c;
  let rnd = seed || 7; const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
  SS._glass = S.glass; SS._vuEl = { children: S.leds }; SS._vuN = -1; SS._ov = null;
  const bus = { voices: { arp: { stopped: false } }, tails: [] };
  c.PadAudio = { buses: { __lab__: bus } };
  let lv = 0, trail = 0, last = 0, sounding = true, renders = 0, maxPer = 0;
  const perFrame = new Map();
  SS._render = (wrap, W, H, dpr, now) => {
    renders++; const n = (perFrame.get(S.tl.currentTime) || 0) + 1; perFrame.set(S.tl.currentTime, n); maxPer = Math.max(maxPer, n);
    const dt = last ? Math.min(100, now - last) : 16.67; last = now;
    const tg = sounding ? .8 : 0; lv += (tg - lv) * (1 - Math.exp(-dt / (tg > lv ? 40 : 220)));
    trail = Math.max(lv, trail * SS.phosDecay(dt, false) - 1.5 / 255, 0);
    SS._vu(lv);
    return lv > .004 || trail > .004;
  };
  const per = 1000 / hz, soundF = Math.round(600 / per), total = Math.round(6000 / per);
  let t = 1000, lastR = -1, ended = -1;
  SS._req();
  for (let f = 0; f < total; f++) {
    t += per + (rand() * 2 - 1) * jitter; S.tl.currentTime = t;
    if (f === soundF) { sounding = false; bus.voices.arp.stopped = true; }
    const own = S.q.splice(0), loop = f < soundF || pads, r0 = renders;
    let k = 0; const call = (fn) => { S.setNow(t + .2 + .3 * k++); fn(); };
    if (f % 2) { if (loop) call(() => SS.draw()); for (const cb of own) call(cb); }
    else { for (const cb of own) call(cb); if (loop) call(() => SS.draw()); }
    if (renders > r0) lastR = f;
    if (ended < 0 && f > soundF && !S.q.length && !pads) ended = f;
  }
  return { lv, trail, renders, maxPer, leds: S.leds.filter((l) => l.on).length, vuN: SS._vuN, queued: S.q.length,
           restMs: (lastR - soundF) * per, idleTailMs: (total - 1 - lastR) * per, ended };
}
for (const [hz, j] of [[60, 1], [120, 1], [144, 1], [144, 0], [165, 1]]) {
  const r = lampRun(R25C, hz, j, false, hz * 13 + j);
  ck("(p) " + hz + " Hz +-" + j + " ms, po ciszy sama lampa: slad i poziom dochodza do spoczynku, diody gasna, lancuch klatek sie konczy",
     r.lv <= .004 && r.trail <= .004 && r.leds === 0 && r.vuN === 0 && r.queued === 0 && r.ended > 0,
     J({ lv: +r.lv.toFixed(4), trail: +r.trail.toFixed(4), leds: r.leds, q: r.queued, restMs: Math.round(r.restMs) }));
  ck("(p) " + hz + " Hz +-" + j + " ms: najwyzej jeden render na klatke (petla padow + wlasna klatka = raz)", r.maxPer === 1, r.maxPer);
  const p = lampRun(R25C, hz, j, true, hz * 7 + j);
  ck("(p) " + hz + " Hz +-" + j + " ms, pady graja, lab cichnie: lampa dochodzi do spoczynku i potem nie renderuje (ostatnie 2 s bez renderu)",
     p.lv <= .004 && p.trail <= .004 && p.leds === 0 && p.idleTailMs >= 2000 && p.maxPer === 1,
     J({ lv: +p.lv.toFixed(4), restMs: Math.round(p.restMs), idleTailMs: Math.round(p.idleTailMs), renders: p.renders }));
}
if (fs.existsSync(OLD25C)) {
  const o = lampRun(fs.readFileSync(OLD25C, "utf8"), 144, 0, false, 5);
  ck("(p) symulacja widzi blad: kopia sprzed poprawki przy 144 Hz zamiera z zywym poziomem na szkle", o.lv > .05 && o.queued === 0, J({ lv: +o.lv.toFixed(3), renders: o.renders }));
}
// sleep(): diody i ślad czyszczone, kontekst WebGL ZOSTAJE; zwinięcie edytora i pagehide go oddają; _drop zeruje _fail
{
  const S = lampSim(R25C), SS = S.SS;
  let lost = 0, cleared = 0, removed = 0;
  const mkSt = () => ({ gl: { getExtension: () => ({ loseContext: () => { lost++; } }), bindFramebuffer() {}, clearColor() {}, clear: () => { cleared++; },
      FRAMEBUFFER: 1, COLOR_BUFFER_BIT: 2 }, cv: { parentNode: { removeChild: () => { removed++; } } },
    pp: { fb: [{}, {}], tex: [{}, {}], w: 1, h: 1, i: 0 }, f: { lv: .7 }, spl: new Float32Array(16).fill(.5), pts: { a: {} }, last: 123 });
  SS.init();
  const st = mkSt(); SS._st = st; SS._vuN = 5; S.leds.forEach((l, i) => { l.on = i < 5; }); SS._fail = true;
  const q0 = S.q.length; SS.sleep();
  ck("(p) sleep (labStopAll): kontekst WebGL zostaje (bez loseContext), slad wyczyszczony w obu teksturach, diody zgaszone, cechy dzwieku i zaby od zera",
     lost === 0 && removed === 0 && SS._st === st && cleared === 2 && S.leds.every((l) => !l.on) && SS._vuN === 0 && st.f === null && st.spl === null &&
     J(st.pts) === "{}" && st.last === 0, J({ lost, cleared, st: SS._st === st }));
  ck("(p) sleep: tryb zastepczy probuje od nowa (_fail = false) i jedna klatka bez 0,9 s rozbiegu", SS._fail === false && SS._dirty === true && S.q.length >= Math.min(1, q0 + 1));
  S.box.open = false; S.box.L.forEach((f) => f({ target: S.box }));
  ck("(p) zwiniecie edytora oddaje kontekst (loseContext, canvas zdjety)", lost === 1 && removed === 1 && SS._st === null);
  SS._st = mkSt(); (S.winL.pagehide || []).forEach((f) => f({}));
  ck("(p) pagehide oddaje kontekst", lost === 2 && SS._st === null && (S.winL.pagehide || []).length === 1);
  SS._fail = true; SS._drop();
  ck("(p) _drop zeruje _fail (nastepny draw probuje zbudowac kontekst)", SS._fail === false);
}
// tryb bez WebGL2: diody z poziomu paneli (SoundEditors._F.lv, tylko świeży), bez legendy „przebieg / widmo”
{
  const S = lampSim(R25C), SS = S.SS, SE = S.SE;
  SS._glass = S.glass; SS._ov = S.ov; SS._vuEl = { children: S.leds }; SS._vuN = -1; SS._fail = true;
  SE._F = { sp: new Float32Array(16), wf: new Float32Array(64), lv: .5 }; SE._last = 2000;
  SS._dirty = true; S.tl.currentTime = 2016; SS.draw();
  const lit = S.leds.filter((l) => l.on).length;
  ck("(p) bez WebGL2: diody zasilane poziomem paneli (SoundEditors._F.lv), klatki trwaja, poki poziom zyje", lit === SS.vuLeds(.5) && lit > 0 && S.q.length === 1, lit);
  ck("(p) bez WebGL2: legenda przebieg / widmo ukryta (szyby nie ma)", !S.fills.includes("przebieg") && !S.fills.includes("widmo"), J(S.fills));
  S.q.length = 0; SE._last = 1000; S.tl.currentTime = 2400; SS.draw();
  ck("(p) bez WebGL2: nieswiezy pomiar paneli (zwinieta karta) = diody zgaszone i koniec klatek", S.leds.every((l) => !l.on) && S.q.length === 0);
  SS._fail = false; SS._render = () => false; SS._dirty = true; S.fills.length = 0; S.tl.currentTime = 2500; SS.draw();
  ck("(p) z WebGL2 na szkle tez zadnych napisow (2026-10-03: legenda przeszla pod tarcze, do HTML)", S.fills.length === 0, J(S.fills));
}
// 2026-10-03: szkło bez napisów, więc lampa nie obserwuje już <html lang>; legenda „przebieg / widmo” to HTML pod
// tarczą (tłumaczy ją rf-01), a podpowiedź „zagraj, aby zobaczyć widmo” odeszła
{
  const S = lampSim(R25C), SS = S.SS;
  SS.init(); SS._render = () => false; S.run(100);
  ck("(p) jezyk: lampa nie obserwuje <html lang> (nie ma czego przerysowac), nakladka bez fillText", !S.mo.length && S.fills.length === 0, J(S.fills));
  ck("(p) rf-25c bez podpisow na szkle (przebieg, widmo, zagraj, _capTxt)", !/_capTxt\(|_gl\("(przebieg|widmo|zagraj)|fillText/.test(R25C));
  const dash = fs.readFileSync(path.join(REPO, "web/ribbitflip_dashboard.html"), "utf8"), i18 = fs.readFileSync(path.join(REPO, "web/js/rf-01-i18n.js"), "utf8");
  const iG = dash.indexOf('id="skGlass"'), iL = dash.indexOf('class="sk-legend"'), iT = dash.indexOf('id="seTest"');
  ck("(p) legenda pod tarcza w pulpicie, przed podgladem: przebieg (roz) i widmo (zielen), pary EN w rf-01",
     iG > 0 && iG < iL && iL < iT && dash.includes('<span class="sk-lg sk-lg-w">przebieg</span><span class="sk-lg sk-lg-s">widmo</span>') &&
     i18.includes('"przebieg":"waveform"') && i18.includes('"widmo":"spectrum"'));
}

// (q) ETAP E8 (2026-10-03): PIERŚCIEŃ W PASIE, SŁOŃCE NA ZEWNĄTRZ, PUNKT SPOCZYNKU WIĄZKI. Głośny dźwięk ciągnął ujemne
//     połówki przebiegu do środka tarczy (promień .62 − .32), a trwałość zbierała tam różowe linie. Teraz pierścień
//     nie wychodzi z pasa .56–.84, promienie widma zaczynają się za nim (.86–.98), a środek trzyma kropkę wiązki.
{
  const src = ctx.PadPlate._fs.skop || "";
  const m = /const float RW0=([\d.]+),RLO=([\d.]+),RHI=([\d.]+),SU0=([\d.]+),SUL=([\d.]+);/.exec(src), b = m ? m.slice(1).map(Number) : null;
  ck("(q) pasy w JS = w shaderze (RW0 .70, RLO .56, RHI .84, SU0 .86, SUL .12), slonce za pasem pierscienia i przed obwodka",
     b && b[0] === SS.RING0 && b[1] === SS.RING_LO && b[2] === SS.RING_HI && b[3] === SS.SUN0 && b[4] === SS.SUN_L &&
     J([SS.RING0, SS.RING_LO, SS.RING_HI, SS.SUN0, SS.SUN_L]) === J([.7, .56, .84, .86, .12]) && SS.SUN0 > SS.RING_HI && SS.SUN0 + SS.SUN_L < 1, J(b));
  ck("(q) shader: pierscien = clamp(RW0 + wf*min(.14, .04 + LV*.14), RLO, RHI), nachylenie z tej samej funkcji, skok fali przyciety do swojego zakresu (bez szprych do srodka)",
     src.includes("float rr(float t,float amp){return clamp(RW0+wr(t)*amp,RLO,RHI);}") &&
     src.includes("float amp=min(.14,.04+LV*.14),rw=rr(th,amp),ra=rr(max(th-.004,0.),amp),rb=rr(min(th+.004,1.),amp),sl=(rb-ra)/.008;") &&
     src.includes("d1=max(abs(rho-rw)*Rg/sqrt(1.+sg*sg),max(max(min(ra,rb)-rho,rho-max(ra,rb)),0.)*Rg);") &&
     !src.includes(".62+wr(th)*amp"));
  // ten sam wzór w JS: skrajne próbki (±1, także ponad normę) i poziomy 0..1,5 — pierścień zawsze w pasie; stary wzór
  // przy LV 1 schodził do .30 promienia
  const rho = (w, lv) => Math.max(SS.RING_LO, Math.min(SS.RING_HI, SS.RING0 + w * Math.min(.14, .04 + lv * .14)));
  let lo = 9, hi = -9; for (let w = -1.2; w <= 1.2001; w += .05) for (let lv = 0; lv <= 1.5001; lv += .05) { lo = Math.min(lo, rho(w, lv)); hi = Math.max(hi, rho(w, lv)); }
  const raw = (w, lv) => SS.RING0 + w * Math.min(.14, .04 + lv * .14);
  ck("(q) pierscien w pasie .56-.84 dla probek -1,2..1,2 i poziomu 0..1,5 (przed E8 przy LV 1: .62 - .32 = .30)",
     lo >= .56 && hi <= .84 && near(raw(-1, 1), .56, 1e-12) && near(raw(1, 1), .84, 1e-12) && near(raw(1, 0), .74, 1e-12), J({ lo, hi }));
  ck("(q) slonce: promienie od SU0 do SU0 + SP*SUL, halo widma tez za pasem (od RHI do obwodki)",
     src.includes("kSeg(p,u*SU0*Rg,u*(SU0+SP[i]*SUL)*Rg)") && src.includes("smoothstep(RHI,SU0+.02,rho)*(1.-smoothstep(.97,1.01,rho))") && !src.includes("u*.72*Rg"));
  ck("(q) wiazka: rdzen pol-szerokosci 1,4 + LV*1,6 px wzdluz sciezki, glowa o .8 px szersza (bez koralikow w luminoforze), roz exp(-d/4)*.6 + exp(-d/14)*.25, jasnosc .6 + LV*.6, bez migotania",
     src.includes("float dh=length(pp-hd),cw=1.4+LV*1.6,dr=cw+.8,dk=.6+LV*.6,de=max(min(dt-cw,dh-dr),0.);") && src.includes("col+=PINK*1.3*(exp(-de/4.)*.6+exp(-de/14.)*.25)*dk;") &&
     src.includes("vec2 pp=sc*Rg,hd=BL[NB-1]*Rg,b0=BL[0]*Rg;") && src.includes("for(int i=0;i<11;i++){if(i>=NB-1)break;") &&
     !/dk[^;]*\bfl\b/.test(src.slice(src.indexOf("vec2 pp=sc*Rg"), src.indexOf("// the frogs on the rim"))));
  ck("(q) wiazka w fazie luminoforu (kPolar w skop), wiec trwalosc robi z niej smuge; tylko piksele do 70 px od cieciwy licza segmenty; zaby bez zmian",
     src.indexOf("vec2 pp=sc*Rg") > src.indexOf("vec3 kPolar(") && src.indexOf("vec2 pp=sc*Rg") < src.lastIndexOf("vec3 plate(") &&
     src.includes("if(length(pp-(b0+hd)*.5)<length(hd-b0)*.5+70.){") && SS.FROG_R === .9 && SS.BEAM_N === 12);
}

// (r) WIĄZKA W RUCHU (2026-10-03): kropka na środku chodzi po krzywej Lissajous i zostawia smugę. Czysta matematyka
//     (beamStep / beamAt / beamPath) i podtrzymanie klatek: w ciszy lampa renderuje tylko dla wiązki, najwyżej co
//     BEAM_IDLE_MS, tylko z GL, widoczną szybą i bez ograniczenia ruchu.
{
  const b0 = { a: .1, b: .7, c: .3 };
  let mx = 0; const wfN = Float32Array.from({ length: 64 }, (_, i) => (i % 2 ? 1 : -1) * 1.5);
  let ph = { ...b0 };
  for (let f = 0; f < 4000; f++) { const lv = (f % 300) / 200; ph = SS.beamStep(ph, 16.67, lv); for (const wf of [null, wfN]) { const q = SS.beamAt(ph, lv, wf); mx = Math.max(mx, Math.hypot(q[0], q[1])); } }
  ck("(r) wiazka nigdy nie wychodzi poza BEAM_R .42 (pierscien zaczyna sie od .56), takze glosno i z poszarpana fala", mx <= SS.BEAM_R + 1e-12 && SS.BEAM_R < SS.RING_LO - .1, mx.toFixed(4));
  const s0 = SS.beamStep(b0, 1000, 0), s1 = SS.beamStep(b0, 1000, 1);
  ck("(r) beamStep: w ciszy .41 / .29 / .025 obrotu na sekunde, przy poziomie 1 dwie pierwsze fazy 3,2 raza szybciej, obrot figury bez zmian",
     near(s0.a - b0.a, .41, 1e-12) && near(s0.b - b0.b, .29, 1e-12) && near(s0.c - b0.c, .025, 1e-12) && near(s1.a - b0.a, .41 * 3.2, 1e-12) && near(s1.c - b0.c, .025, 1e-12));
  ck("(r) beamStep: dt 0 (i ujemne) stoi w miejscu", J(SS.beamStep(b0, 0, .5)) === J(b0) && J(SS.beamStep(b0, -5, .5)) === J(b0));
  const out = new Float32Array(24), n = SS.beamPath(b0, s0, 0, null, out), a = SS.beamAt(b0, 0, null), z = SS.beamAt(s0, 0, null);
  ck("(r) beamPath: 12 punktow od pozycji poprzedniej klatki do biezacej (glowa = ostatni)", n === 12 && near(out[0], a[0], 1e-6) && near(out[1], a[1], 1e-6) && near(out[22], z[0], 1e-6) && near(out[23], z[1], 1e-6));
  let gap = 0; ph = { ...b0 };
  for (let f = 0; f < 600; f++) { const nx = SS.beamStep(ph, 33, 1); SS.beamPath(ph, nx, 1, null, out); for (let i = 0; i < 11; i++) gap = Math.max(gap, Math.hypot(out[2 * i + 2] - out[2 * i], out[2 * i + 3] - out[2 * i + 1])); ph = nx; }
  ck("(r) beamPath: przy 30 kl./s i pelnym poziomie kolejne punkty najwyzej ~2,5 px od siebie na tarczy 400 px (smuga bez przerw)", gap * 200 < 2.5, (gap * 200).toFixed(2) + " px");
  ck("(r) beamAt: cisza = czysta krzywa (fala nie dziala bez poziomu)", J(SS.beamAt(b0, 0, wfN)) === J(SS.beamAt(b0, 0, null)));
  // podtrzymanie klatek: atrapa _st, render liczy wywołania
  const S = lampSim(R25C), L = S.SS; let rn = 0;
  L._glass = S.glass; L._vuEl = { children: S.leds }; L._vuN = -1; L._ov = null; L._st = {};
  L._render = () => { rn++; return false; };
  L._req(); let t = 1000;
  for (let f = 0; f < 120; f++) { t += 1000 / 144; S.run(t); }
  ck("(r) cisza z wiazka przy 144 Hz: lancuch klatek trwa, render ok. 30 razy na sekunde (najwyzej co BEAM_IDLE_MS)", S.q.length === 1 && rn >= 22 && rn <= 30, rn + " / 0,83 s");
  L._vis = false; for (let f = 0; f < 20; f++) { t += 1000 / 144; S.run(t); }
  const q0 = S.q.length; rn = 0; for (let f = 0; f < 20; f++) { t += 1000 / 144; S.run(t); }
  ck("(r) szyba poza ekranem (IntersectionObserver): wiazka nie trzyma klatek", q0 === 0 && rn === 0, J({ q0, rn }));
  L._vis = true; S.c._prefersReducedMotion = () => true; L._req(); rn = 0; for (let f = 0; f < 20; f++) { t += 1000 / 144; S.run(t); }
  ck("(r) ograniczony ruch: wiazka stoi, po jednej klatce lampa odpoczywa", rn === 1 && S.q.length === 0, J({ rn, q: S.q.length }));
  delete S.c._prefersReducedMotion; L._st = null; L._req(); rn = 0; for (let f = 0; f < 20; f++) { t += 1000 / 144; S.run(t); }
  ck("(r) bez kontekstu GL (tryb zastepczy) wiazki nie ma i lampa odpoczywa jak dawniej", rn === 1 && S.q.length === 0, J({ rn, q: S.q.length }));
  ck("(r) _render: sciezka BL z beamPath, glowa w srodku przy ograniczonym ruchu, NB do shadera",
     R25C.includes("gl.uniform2fv(u.BL,bl);gl.uniform1i(u.NB,nb);") && R25C.includes("if(still){bl[0]=bl[1]=0;}") && R25C.includes("nb=this.beamPath(b0,b1,f.lv,f.wf,bl);st.bm=b1;"));
}

const failed = checks.filter((c) => !c[1]);
for (const [n, ok, d] of checks) process.stdout.write((ok ? "PASS  " : "FAIL  ") + n + (ok || !d ? "" : "  -> " + d) + "\n");
process.stdout.write(JSON.stringify({ checks }) + "\n");
process.exit(failed.length ? 1 : 0);
