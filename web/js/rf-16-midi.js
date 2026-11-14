"use strict";
// ======================= MIDI / OSC CONTROLLER (front) =======================
//  Per-slot mappings from motion (raw axis or 3D-filter metric) to MIDI messages or OSC
//  addresses, plus the mapping editor and its response-curve preview. The server is
//  authoritative — configuration lives in Settings/ribbitflip_midi.json and is read via /midi,
//  so nothing here is cached in localStorage.
const MI_SRC_AXIS=[["0","CH0 (żyro X)"],["1","CH1 (żyro Y)"],["2","CH2 (żyro Z)"],
  ["3","CH3 (akcel X)"],["4","CH4 (akcel Y)"],["5","CH5 (akcel Z)"]];
// [id, PL, EN] — row names are COMPOSED at render time (miSrcLabel/miDestLabel via _gl), so the i18n walker cannot do them by key; miRelang() repaints after a switch.
const MI_METRICS=[["tilt","Pochylenie","Tilt"],["twist","Obrót","Rotation"],["pitch","Pitch","Pitch"],["roll","Roll","Roll"]];
const MI_ROOTS=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const MI_SCALES=[["chromatic","chromatyczna"],["major","dur (majorowa)"],["minor","moll (minorowa)"],
  ["harmonic_minor","moll harmoniczna"],["pentatonic_major","pentatonika dur"],["pentatonic_minor","pentatonika moll"],
  ["blues","bluesowa"],["dorian","dorycka"],["phrygian","frygijska"],["lydian","lidyjska"],
  ["mixolydian","miksolidyjska"],["whole_tone","całotonowa"]];
function miNoteName(n){n=+n; if(!isFinite(n)||n<0)return "—"; return MI_ROOTS[((n%12)+12)%12]+(Math.floor(n/12)-1);}
function miEsc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function miDefaultMap(){return {id:"m"+Date.now().toString(36)+Math.floor(Math.random()*1000),
  name:"",srcKind:"filter",ch:0,metric:"tilt",dest:"cc",mode:"continuous",
  inLo:0,inHi:90,invert:false,curve:"lin",rateMs:15,
  midiCh:0,slew:0,centered:false,deadzone:0,
  cmp:">",threshold:30,absVal:false,noteLatch:false,
  cc:1,outLo:0,outHi:127,prog:0,
  loNote:48,hiNote:72,note:60,velocity:100,velSource:"fixed",
  addr:"",oscTarget:"",oscType:"float",outLoF:0,outHiF:1,   // oscTarget "" = cel domyślny (rf-49e)
  oscProfile:"unit",oscRangeCustom:false,oscEdge:"bang",pulseMs:200,safeOnDisarm:null,
  maxRate:0,keepaliveMs:0};}
// RODZAJE KOMUNIKATU MIDI — i tylko one. „OSC" stało tu jako siódma pozycja, więc jeden rozwijak
// odpowiadał na dwa różne pytania naraz: „jaki komunikat MIDI" i „jakim w ogóle protokołem".
// Wybranie go w zakładce MIDI zabierało edytowane mapowanie na SĄSIEDNI ekran — kod musiał to
// potem tłumaczyć osobnym komunikatem po zapisie, a osobny komunikat na wytłumaczenie skutku
// własnej kontrolki to zwykle znak, że kontrolka stoi w złym miejscu.
// Protokół wybiera się ZAKŁADKĄ (MIDI / OSC), a ten sam ruch puszcza się drugą drogą przyciskiem
// „Skopiuj jako mapowanie…" (miCloneToOther) — KOPIUJE, więc obie drogi grają obok siebie.
// MODEL ZOSTAJE BEZ ZMIAN: dalej jedna lista `state.midi.mappings` rozróżniana polem `dest`, bo
// zestaw mieszany (kilka CC plus kilka adresów OSC) to najzwyklejszy przypadek i preset musi być
// jeden — patrz nagłówek rf-49d („DWA HUBY, JEDEN STAN").
const MI_DESTS_MIDI=[["cc","CC 7-bit"],["cc14","CC 14-bit"],["pitchbend","Pitch Bend"],
  ["aftertouch","Aftertouch"],["program","Program"],["note","🎵 Nuta"]];

// ── OSC receiver profiles — a MIRROR of MidiMapper.OSC_PROFILES in ribbitflip_monitor.py.
// The SERVER is the one that derives (oscType, outLoF, outHiF) from the profile; this table
// exists so the form can show the derived numbers the moment they are picked and so the
// "what will be sent" line can be computed without a round trip. A drift between the two
// therefore shows up as a wrong HINT, never as a wrong packet.
//   [key, label, oscType, spanLo, spanHi, group] — "free" derives nothing (type and range are
//   typed by hand). The two numbers are the DEVICE'S FULL SPAN, not the range every mapping has
//   to use: with `oscRangeCustom` a mapping works inside a narrower window and the span is what
//   that window is clamped to.
const MI_OSC_PROFILES=[
  ["unit","Analog 0–1 (TouchOSC, Resolume)","float",0,1,"av"],
  ["digital","Cyfrowy ON/OFF","bool",0,1,"hw"],
  ["pwm","PWM 0–100%","int",0,100,"hw"],
  ["servo","Serwo 0–180°","int",0,180,"hw"],
  ["servo270","Serwo 0–270°","int",0,270,"hw"],
  ["servo360","Serwo 0–360°","int",0,360,"hw"],
  ["servoUs","Serwo — szerokość impulsu 1000–2000 µs","int",1000,2000,"hw"],
  ["int10","Analog 10-bit 0–1023","int",0,1023,"hw"],
  ["dac8","DAC 8-bit 0–255","int",0,255,"hw"],
  ["dac12","DAC 12-bit 0–4095","int",0,4095,"hw"],
  ["free","Własny — typ i zakres ręcznie",null,null,null,"free"]];
// optgroup `label` is NOT one of the attributes the i18n walker rewrites (title / placeholder /
// aria-label / data-rftip), so these go through _gl() at render time — the editor is re-rendered
// on a language switch by miRelang().
const MI_OSC_PROF_GROUPS=[["av",()=>_gl("Programy AV","AV software")],
  ["hw",()=>_gl("Sprzęt (ESP32, Arduino, sterowniki)","Hardware (ESP32, Arduino, drivers)")],
  ["free",null]];
// A boolean has two states; "a narrower window" means nothing for it, so the whole custom-range
// control is hidden there (and the server forces the flag off) instead of sitting inert.
function miOscRanged(prof){return prof[0]!=="free"&&prof[0]!=="digital";}
// Edge behaviour in threshold mode. This is the OTHER axis: the profile says WHAT value the
// receiver gets, this says WHEN and FOR HOW LONG. Keeping them apart is what makes
// "impuls 300 ms, ale PWM 100%" expressible at all.
const MI_OSC_EDGES=[
  ["bang","Impuls — jeden komunikat na zboczu"],
  ["gate","Bramka — trzyma, dopóki próg jest przekroczony"],
  ["toggle","Przełącznik — każde zbocze zmienia stan"],
  ["pulse","Impuls X ms — sam wraca do spoczynku"]];
function miOscProf(m){const k=(m&&m.oscProfile)||"free";
  return MI_OSC_PROFILES.find(p=>p[0]===k)||MI_OSC_PROFILES[MI_OSC_PROFILES.length-1];}
// Mirrors the profile half of _sanitize_map, applied to the DRAFT so the form shows the truth
// straight away instead of waiting for the server echo. The server stays the authority — this
// only has to agree with it.
function miApplyProfile(m){
  const p=miOscProf(m);
  if(p[0]==="free")return;
  m.oscType=p[2];
  if(!miOscRanged(p)){m.oscRangeCustom=false;m.outLoF=p[3];m.outHiF=p[4];return;}
  if(!m.oscRangeCustom){m.outLoF=p[3];m.outHiF=p[4];return;}
  const lo=Math.min(p[3],p[4]),hi=Math.max(p[3],p[4]);
  const cl=v=>{const x=parseFloat(v);return isFinite(x)?Math.min(Math.max(x,lo),hi):lo;};
  m.outLoF=cl(m.outLoF);m.outHiF=cl(m.outHiF);   // ends clamped separately — inverted stays legal
  // `float` is pinned to 0..1 in the engine, so a narrowed unit mapping must become `floatrange`
  // or the window would be set and then silently ignored. Identical type tag on the wire.
  if(m.oscType==="float")m.oscType="floatrange";
}
// The HIGH/LOW pair exactly as _compile() types it: the far end of the output range, formatted
// the way the argument will be. `float 0..1` and `bool` are pinned to 0..1 in the engine, so
// only `int`/`floatrange` read the range fields.
function miOscVals(m){
  const t=m.oscType,ranged=(t==="int"||t==="floatrange");
  const num=(v,d)=>{const x=parseFloat(v);return isFinite(x)?x:d;};   // 0 is a legal end, `||` would eat it
  const lo=ranged?num(m.outLoF,0):0,hi=ranged?num(m.outHiF,1):1;
  const fmt=v=>(t==="bool")?(v>=0.5?"true":"false"):(t==="int"?String(Math.round(v)):String(v));
  // `bang` with no profile keeps sending a bare int 1 — see _compile() for why that legacy
  // stays. The hint has to say so, or the form would promise a value the engine will not send.
  const bang=(t==="bool"||(m.oscProfile&&m.oscProfile!=="free"))?fmt(hi):"1";
  return {lo:fmt(lo),hi:fmt(hi),bang:bang,nLo:lo,nHi:hi};
}
// Built with _gl() rather than left to the i18n walker on purpose: the sentence is broken up by
// <b> values, so the walker would see a handful of half-sentence text nodes and every dictionary
// key would depend on where a number happens to fall.
function miOscHint(m){
  const v=miOscVals(m),lead=_gl("Na wyjściu: ","Sent out: ");
  if(m.mode!=="threshold"){
    // The pace knobs belong in the summary too: a speed limit is a PROMISE about the wire ("full
    // travel no faster than 2 s"), and it is far easier to check as a time than as units/second.
    let s=`${lead}<b>${v.lo}</b> … <b>${v.hi}</b>${_gl(" — płynnie, wraz z ruchem."," — continuously, following the movement.")}`;
    const mr=+m.maxRate||0,span=Math.abs(v.nHi-v.nLo);
    if(mr>0&&span>0){const sec=Math.round(span/mr*10)/10;
      s+=`${_gl(" Pełny przejazd nie szybciej niż w "," Full travel no faster than ")}<b>${sec} s</b>.`;}
    const ka=m.keepaliveMs|0;
    if(ka>=100)s+=`${_gl(" Wartość powtarzana co "," Value repeated every ")}<b>${ka} ms</b>${_gl(", nawet gdy kapsel stoi.",", even with the capsule at rest.")}`;
    return s;
  }
  if(m.oscEdge==="gate")
    return `${lead}<b>${v.hi}</b>${_gl(" powyżej progu, "," above the threshold, ")}<b>${v.lo}</b>${_gl(" poniżej."," below.")}`;
  if(m.oscEdge==="toggle")
    return `${lead}<b>${v.hi}</b> ⇄ <b>${v.lo}</b>${_gl(" — zmiana przy każdym przekroczeniu progu."," — flips at every crossing of the threshold.")}`;
  if(m.oscEdge==="pulse")
    return `${lead}<b>${v.hi}</b>${_gl(" przez "," for ")}<b>${m.pulseMs|0} ms</b>${_gl(", potem ",", then ")}<b>${v.lo}</b>${_gl(" — bez czekania na powrót poniżej progu."," — without waiting for a drop back below the threshold.")}`;
  return `${lead}<b>${v.bang}</b>${_gl(" — jeden komunikat w chwili przekroczenia progu."," — a single message at the moment the threshold is crossed.")}`;
}

// ── Response curves (easing) — a MIRROR of the EASE_CURVES table in ribbitflip_monitor.py.
// The formulas must stay identical to the engine's, including the order of arithmetic: a curve
// preview that disagrees with the engine is worse than no preview at all.
// Legacy names kept for old configs: exp=t², exp3=t³, log=t^0.55.
// Two curves are PARAMETRIC and read their parameters from the mapping via miEase's 4th argument:
// `step` → {n:curveN} (2..32, default 8) · `custom` → {bez:curveBez} (four numbers 0..1).
const MI_BEZ_DEF=[0.42,0,0.58,1];
const _miBezCache=new Map();
function miBezLut(bez){                       // cubic-bezier → 33-point lookup table (mirrors the engine's _compile)
  const b=(Array.isArray(bez)&&bez.length===4)?bez:MI_BEZ_DEF;
  const c=(v,d)=>{v=+v;return isFinite(v)?(v<0?0:v>1?1:v):d;};
  const x1=c(b[0],MI_BEZ_DEF[0]),y1=c(b[1],MI_BEZ_DEF[1]),
        x2=c(b[2],MI_BEZ_DEF[2]),y2=c(b[3],MI_BEZ_DEF[3]);
  const key=x1+","+y1+","+x2+","+y2;
  let lut=_miBezCache.get(key); if(lut)return lut;
  const N=32; lut=new Array(N+1);
  for(let i=0;i<=N;i++){
    const t=i/N; let u=t;
    for(let it=0;it<8;it++){                  // Newton solve x→u, 8 iterations — same count as the server
      const v=1-u;
      const d=3*v*v*x1+6*v*u*(x2-x1)+3*u*u*(1-x2);
      if(d>1e-6||d<-1e-6){
        const x=3*v*v*u*x1+3*v*u*u*x2+u*u*u;
        u=u-(x-t)/d; u=u<0?0:(u>1?1:u);
      }
    }
    const v=1-u;
    lut[i]=3*v*v*u*y1+3*v*u*u*y2+u*u*u;
  }
  if(_miBezCache.size>32)_miBezCache.clear();
  _miBezCache.set(key,lut);
  return lut;
}
const MI_EASE={lin:t=>t,exp:t=>t*t,exp2:t=>t*t,exp3:t=>t*t*t,exp4:t=>t*t*t*t,
  log:t=>Math.pow(t,0.55),log2:t=>t>0?Math.sqrt(t):0,log3:t=>t>0?Math.pow(t,1/3):0,
  smooth:t=>t*t*(3-2*t),smoother:t=>t*t*t*(t*(6*t-15)+10),
  sine_in:t=>1-Math.cos(t*Math.PI/2),sine_out:t=>Math.sin(t*Math.PI/2),
  sine_io:t=>(1-Math.cos(Math.PI*t))/2,
  circ_in:t=>1-Math.sqrt(Math.max(0,1-t*t)),
  circ_out:t=>Math.sqrt(Math.max(0,1-(t-1)*(t-1))),
  circ_io:t=>t<.5?(1-Math.sqrt(Math.max(0,1-4*t*t)))/2:(Math.sqrt(Math.max(0,1-(2*t-2)*(2*t-2)))+1)/2,
  expo_in:t=>t<=0?0:Math.pow(2,10*(t-1)),expo_out:t=>t>=1?1:1-Math.pow(2,-10*t),
  step:(t,p)=>{let n=(p&&p.n)?(p.n|0):8; n=n<2?2:(n>32?32:n); const top=n-1;
    let i=Math.floor(t*n); i=i<0?0:(i>top?top:i); return i/top;},
  custom:(t,p)=>{const l=miBezLut(p&&p.bez);
    if(t<=0)return l[0]; if(t>=1)return l[32];
    const q=t*32,i=Math.floor(q),a=l[i]; return a+(l[i+1]-a)*(q-i);}};
function miEase(name,t,flip,p){const f=MI_EASE[name]||MI_EASE.lin;t=Math.max(0,Math.min(1,t));
  return Math.max(0,Math.min(1,flip?1-f(1-t,p):f(t,p)));}
function miEaseParams(m){return m?{n:m.curveN,bez:m.curveBez}:null;}   // per-mapping curve parameters
// The visible label says WHAT THE CURVE DOES; the formula goes in the title attribute.
const MI_CURVES=[
 ["Podstawowe",[["lin","Liniowa","t"],["exp2","Precyzyjna (kwadrat)","t²"],
  ["exp3","Precyzyjna mocna","t³"],["exp4","Precyzyjna skrajna","t⁴"],
  ["log2","Czuła (pierwiastek)","√t"],["log3","Czuła mocna","t^⅓"],
  ["log","Czuła (klasyczna)","t^0.55 — zachowana dla zgodności"]]],
 ["Esowate",[["smooth","Esowata łagodna","smoothstep — najlepsza domyślna dla serwa"],
  ["smoother","Esowata mocna","smootherstep"],["sine_in","Sinus — wejście","1−cos(tπ/2)"],
  ["sine_out","Sinus — wyjście","sin(tπ/2)"],["sine_io","Sinus — oba końce","−(cos(πt)−1)/2"]]],
 ["Mocne kontrasty",[["circ_in","Kołowa — wejście","1−√(1−t²)"],
  ["circ_out","Kołowa — wyjście","√(1−(t−1)²)"],["circ_io","Kołowa — oba końce","złożenie"],
  ["expo_in","Wykładnicza — wejście","2^(10(t−1))"],["expo_out","Wykładnicza — wyjście","1−2^(−10t)"]]],
 ["Specjalne",[["step","Schodkowa","floor(t·n)/(n−1) — wartości dyskretne, n = curveN (domyślnie 8)"]]]];
function miCurveOptions(cur){
  let s=MI_CURVES.map(([grp,items])=>`<optgroup label="${grp}">`+
    items.map(([k,lbl,tt])=>`<option value="${k}" title="${miEsc(tt)}"${cur===k?" selected":""}>${lbl}</option>`).join("")+
    `</optgroup>`).join("");
  if(cur==="exp")s+=`<option value="exp" selected title="t² — starszy klucz, to samo co „Precyzyjna (kwadrat)”">Precyzyjna (kwadrat) — starszy zapis</option>`;   // ” not " — a straight quote closes the attribute and cuts the tooltip in half
  // The custom bezier option is offered ONLY when the mapping already uses it: there is no
  // editor for the four control numbers yet, so picking it from a fresh list would select a
  // curve the user cannot configure, and saving would silently fall back to "lin".
  if(cur==="custom")s+=`<option value="custom" selected title="cubic-bezier(x1,y1,x2,y2) z pola curveBez">Własna (bezier)</option>`;
  return s;
}
// ── Visual curve preview: the plot of f(t) plus TWO travelling markers underneath — the grey
// one moves at a constant rate (reference), the pink one follows the curve, so the gap between
// them IS the easing. The green dot on the right edge is the engine's live output (mo.v).
// Honours prefers-reduced-motion by drawing a static plot with no rAF loop.
let _miPrevRaf=0;
function miStopCurvePrev(){if(_miPrevRaf){cancelAnimationFrame(_miPrevRaf);_miPrevRaf=0;}}
function miDrawCurvePrev(){
  const host=document.getElementById("mieCurvePrev");const m=state._midiDraft;
  if(!host||!m){miStopCurvePrev();return;}
  // Parametric curve settings are PART of the cache key — otherwise changing curveN/curveBez
  // would not redraw the plot and the preview would start disagreeing with the engine.
  const ep=miEaseParams(m);
  // KOŃCE OSI W JEDNOSTKACH, nie w 0..1: „t" na dole i „wartość" z boku nie mówią, czy krzywa
  // biegnie od 0° do 90°, czy od 1000 µs do 2000 µs. Podpisy są częścią klucza cache, bo zmiana
  // zakresu wejścia/wyjścia zmienia obrazek, choć sam kształt krzywej zostaje ten sam.
  const _sc=(typeof miLabOutScale==="function")?miLabOutScale(m):null;
  const _au=(typeof miLabAxis==="function")?miLabAxis(m).unit:"";
  const _xa=m.invert?m.inHi:m.inLo,_xb=m.invert?m.inLo:m.inHi;
  const xLo=`${_xa} ${_au}`,xHi=`${_xb} ${_au}`;
  const yLo=_sc?(_sc.fmt(_sc.lo)+(_sc.unit?(" "+_sc.unit):"")):"0",
        yHi=_sc?(_sc.fmt(_sc.hi)+(_sc.unit?(" "+_sc.unit):"")):"1";
  const key=(m.curve||"lin")+"|"+(m.curveFlip?1:0)+"|"+(ep.n||"")+"|"+(ep.bez||[]).join(",")
    +"|"+xLo+"|"+xHi+"|"+yLo+"|"+yHi;
  if(host.dataset.k===key&&_miPrevRaf)return;      // same curve: keep the animation running, don't restart it
  host.dataset.k=key;
  const W=216,H=92,PL=10,PT=6,PW=W-20,PH=H-12,TY=H+14;
  const f=t=>miEase(m.curve,t,m.curveFlip,ep);
  let d="";for(let i=0;i<=48;i++){const t=i/48,x=PL+t*PW,y=PT+(1-f(t))*PH;
    d+=(i?"L":"M")+x.toFixed(1)+","+y.toFixed(1);}
  host.innerHTML=`<svg viewBox="0 0 ${W} ${H+24}" class="mie-cp-svg" role="img" aria-label="Podgląd krzywej odpowiedzi">
    <rect x="${PL}" y="${PT}" width="${PW}" height="${PH}" rx="6" class="mie-cp-bg"/>
    <path d="M${PL},${PT+PH} L${PL+PW},${PT}" class="mie-cp-lin"/>
    <path d="${d}" class="mie-cp-curve"/>
    <circle class="mie-cp-dot" id="mieCpDot" r="4" cx="${PL}" cy="${PT+PH}"/>
    <circle class="mie-cp-live" id="mieCpLive" r="3.2" cx="${PL+PW}" cy="${PT+PH}" style="display:none"/>
    <line x1="${PL}" y1="${TY}" x2="${PL+PW}" y2="${TY}" class="mie-cp-track"/>
    <circle class="mie-cp-ghost" id="mieCpGhost" r="3.5" cx="${PL}" cy="${TY}"/>
    <circle class="mie-cp-mark" id="mieCpMark" r="4.5" cx="${PL}" cy="${TY}"/>
    <text class="mie-cp-ax" x="${PL}" y="${PT-1}" text-anchor="start">${miEsc(yHi)}</text>
    <text class="mie-cp-ax" x="${PL}" y="${PT+PH+8}" text-anchor="start">${miEsc(xLo)}</text>
    <text class="mie-cp-ax" x="${PL+PW}" y="${PT+PH+8}" text-anchor="end">${miEsc(xHi)}</text>
    <text class="mie-cp-ax" x="${PL+PW}" y="${PT+PH-1}" text-anchor="end">${miEsc(yLo)}</text>
  </svg>
  <span class="mie-cp-cap">na pasku: szary = czas (jednostajnie) · różowy = ruch po tej krzywej · zielony = wyjście na żywo</span>`;
  miStopCurvePrev();
  const rm=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(rm)return;
  const dot=document.getElementById("mieCpDot"),ghost=document.getElementById("mieCpGhost"),
        mark=document.getElementById("mieCpMark"),live=document.getElementById("mieCpLive");
  const t0=performance.now();
  const loop=(now)=>{
    if(!document.getElementById("mieCpDot")){_miPrevRaf=0;return;}   // editor closed or rebuilt — stop the loop
    const u=((now-t0)%1800)/1800, v=f(u);
    dot.setAttribute("cx",(PL+u*PW).toFixed(1));dot.setAttribute("cy",(PT+(1-v)*PH).toFixed(1));
    ghost.setAttribute("cx",(PL+u*PW).toFixed(1));
    mark.setAttribute("cx",(PL+v*PW).toFixed(1));
    const lv=state.midiOut&&state.midiOut[m.id];
    if(lv&&lv.v!=null){live.style.display="";
      live.setAttribute("cy",(PT+(1-Math.max(0,Math.min(1,lv.v)))*PH).toFixed(1));}
    _miPrevRaf=requestAnimationFrame(loop);
  };
  _miPrevRaf=requestAnimationFrame(loop);
}

// Same rule as the motion tab, and it matters more here: this body carries the whole MAPPING LIST,
// so a write aimed at the wrong capsule replaces every mapping that capsule had.
function postMidi(){
  const dev=state.midiDev;
  if(!dev||dev!==(state.activeDeviceId||"d0"))return;   // another capsule's config is loaded — do not write it here
  fetch("/midi?dev="+encodeURIComponent(dev),{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify(state.midi)}).then(r=>r.json()).catch(()=>{});
  // Pasek tożsamości (rf-49d) liczy „zmienione" z tego, co jest w panelu — a to właśnie się
  // zmieniło. Odświeżamy OD RAZU, nie czekając na echo `midi_cfg`: echo przychodzi z opóźnieniem
  // debounce'a, więc plakietka zapalałaby się pół sekundy po ruchu suwaka.
  if(typeof midiCfgSync==="function")midiCfgSync();}
let _midiT=null;
function commitMidi(){clearTimeout(_midiT);_midiT=setTimeout(postMidi,180);}

// MIDI and OSC are TWO independent groups with separate switches: 'state.midi.enabled' gates
// MIDI, 'state.midi.oscEnabled' gates OSC. commitMidi POSTs the whole state.midi object, so the
// server always receives both fields (its migration from the older single 'enabled' only
// applies to config files written before the split).
function setMidiEnabled(on,fromServer){
  state.midi.enabled=!!on;
  miReflectEnable();
  if(typeof renderOverview==="function")renderOverview();   // "all mappings" cheat sheet — show/hide MIDI
  if(!fromServer){renderMidiList();commitMidi();}   // commitMidi POSTs state.midi (with enabled)
}
function setOscEnabled(on,fromServer){
  state.midi.oscEnabled=!!on;
  miReflectEnable();
  if(typeof renderOverview==="function")renderOverview();
  if(!fromServer){renderMidiList();commitMidi();}
}
function miReflectEnable(){
  // both group switches change what an empty journal should be saying ("group off" vs "nothing has
  // gone out yet"), and this runs on every flip from either side (rf-16b)
  if(typeof iologRefresh==="function")iologRefresh();
  const b=document.getElementById("miEnable");
  if(b){const on=!!state.midi.enabled;b.classList.toggle("on",on);
    b.setAttribute("aria-checked",on?"true":"false");
    // MIDI/OSC always sent for real in simulation too (the emitters never depended on the mode) —
    // the indicator used to go dark and lie about it.
    b.classList.toggle("live",on&&state.armed&&!!state.midiEnv.midiActive);}
  const ob=document.getElementById("oscEnable");
  if(ob){const on=!!state.midi.oscEnabled;ob.classList.toggle("on",on);
    ob.setAttribute("aria-checked",on?"true":"false");
    ob.classList.toggle("live",on&&state.armed&&!!(state.midiEnv&&state.midiEnv.oscAvail));}
  miUpdateNote();
  if(window.updateTabDots)updateTabDots();
}
// Diagnose whether MIDI can actually reach an external app (loopMIDI / hardware).
// Windows has no built-in virtual MIDI port, so without loopMIDI the only output is
// "Microsoft GS Wavetable Synth" (a synth) which ShowMIDI/DAWs cannot see.
function miDiag(){
  const env=state.midiEnv||{}, ports=env.ports||[];
  const isGs=(nm)=>/wavetable|gs synth|microsoft gs/i.test(nm||"");
  const maps=(state.midi.mappings||[]).filter(m=>m.enabled!==false);
  const midiMaps=maps.filter(m=>["cc","cc14","pitchbend","aftertouch","program","note"].includes(m.dest));
  const oscMaps=maps.filter(m=>m.dest==="osc");
  const routable=ports.filter(p=>!isGs(p.name));
  const activeName=(ports.find(p=>p.i===env.midiPort)||{}).name||"";
  const midiUsable=!!(env.midiAvail&&env.midiActive&&env.midiPort>=0&&!isGs(activeName));
  const onlyOsc=oscMaps.length>0&&midiMaps.length===0;   // pure OSC works without loopMIDI
  if(!state.midi.enabled||midiUsable||onlyOsc) return {ok:true,midiUsable,hasOsc:oscMaps.length>0};
  // KTÓRY TO PRZYPADEK — a nie „coś jest nie tak". Do 2026-09-10 brak portu miał jedno zdanie
  // i jedną radę („zainstaluj loopMIDI"), więc ktoś, kto loopMIDI MIAŁ, tylko wyłączonego,
  // przeinstalowywał program bez potrzeby. Porty loopMIDI istnieją wyłącznie wtedy, gdy program
  // działa, więc sama lista portów nie odróżnia „nie ma" od „nie uruchomiony" — pyta o to serwer
  // (loopmidi_probe: proces + ślad instalacji), a `null` znaczy „nie umiem sprawdzić" i wtedy
  // zdanie mówi uczciwie o obu możliwościach naraz.
  const lm=env.loopMidi||{};
  let kind;
  if(!env.midiAvail) kind="winmm";
  else if(!routable.length){
    if(lm.running===true) kind="bezportu";
    else if(lm.installed===true) kind="niedziala";
    else if(lm.installed===false) kind="brak";
    else kind="nieznane";
  }
  else if(env.midiPort<0||!env.midiActive) kind="niewybrany";
  else if(isGs(activeName)) kind="gs";
  else kind="niegotowy";
  return {ok:false,kind,why:MI_WARN[kind].why,noPort:!routable.length,hasOsc:oscMaps.length>0};
}
// CO JEST NIE TAK i CO Z TYM ZROBIĆ — osobno dla każdego przypadku. `install:true` znaczy „pokaż
// czterokrokową instrukcję z odnośnikiem do pobrania"; reszta dostaje jedno zdanie, bo jedno
// zdanie wystarcza, a instrukcja instalacji przy „program jest, tylko go włącz" jest myląca —
// dokładnie ona prowadziła do niepotrzebnej reinstalacji.
const MI_WARN={
  winmm:{why:"MIDI jest niedostępne w tym systemie (winmm).",
    fix:"Bez winmm ta aplikacja nie ma jak wysłać MIDI. OSC działa niezależnie i nie potrzebuje niczego instalować."},
  brak:{why:"Nie znalazłem loopMIDI na tym komputerze, a Windows nie ma własnego wirtualnego portu MIDI.",
    install:true},
  niedziala:{why:"loopMIDI jest zainstalowany, ale nie jest uruchomiony — jego porty istnieją tylko wtedy, gdy program działa.",
    fix:"Uruchom loopMIDI (zwykle chowa się przy zegarku), upewnij się, że ma na liście port, potem kliknij „🔄 Odśwież” przy „Port OUT” i wybierz ten port. Nie musisz niczego instalować ponownie."},
  bezportu:{why:"loopMIDI działa, ale nie ma w nim ani jednego portu.",
    fix:"W oknie loopMIDI wpisz nazwę na dole (np. RibbitFlip), kliknij „+”, potem „🔄 Odśwież” przy „Port OUT” i wybierz ten port."},
  nieznane:{why:"Nie widzę wirtualnego portu MIDI — loopMIDI albo nie jest zainstalowany, albo nie jest uruchomiony (jego porty istnieją tylko wtedy, gdy program działa).",
    install:true,
    fix:"Jeśli loopMIDI już masz, po prostu go uruchom i kliknij „🔄 Odśwież” przy „Port OUT”. Jeśli nie masz:"},
  niewybrany:{why:"Nie wybrano/nie otwarto portu MIDI OUT.",
    fix:"Wybierz port na liście „Port OUT”. Jeśli go tam nie ma, kliknij obok „🔄 Odśwież”."},
  gs:{why:"Wybrany port to „Microsoft GS Wavetable Synth” (syntezator; ShowMIDI ani DAW go nie zobaczą).",
    fix:"Wybierz na liście „Port OUT” port z loopMIDI zamiast syntezatora."},
  niegotowy:{why:"Port MIDI OUT nie jest gotowy.",
    fix:"Kliknij „🔄 Odśwież” przy „Port OUT” i wybierz port jeszcze raz."},
};
function miRenderWarn(){
  const el=document.getElementById("miWarn"); if(!el) return;
  const d=miDiag();
  if(d.ok){ el.style.display="none"; el.innerHTML=""; miWarnWatch(false); return; }
  el.style.display="";   // klasa .rf-need daje flex — „block" by go zgasił
  const W=MI_WARN[d.kind]||MI_WARN.niegotowy;
  // Instrukcja instalacji zostaje NIETKNIĘTA co do znaku (te fragmenty mają swoje pary EN
  // w rf-01 i tylko one niosą odnośnik do pobrania).
  const instal=`1) zainstaluj `+
    `<a href="https://www.tobias-erichsen.de/software/loopmidi.html" target="_blank" rel="noopener">loopMIDI</a>, `+
    `2) utwórz w nim port (np. <code>RibbitFlip</code>), 3) kliknij <b>🔄 Odśwież</b> przy „Port OUT”, `+
    `4) wybierz ten port na liście.`;
  // Wzór „brakuje czegoś spoza aplikacji" (rf-28b rfNeedHtml, zgłoszenie 2026-10-15): czerwony, bo
  // grupa JEST włączona i przez to nic nie wychodzi. Każde zdanie zostaje w SWOIM węźle, bo walker
  // i18n dopasowuje cały węzeł tekstowy (pary EN w rf-01).
  el.className="mi-warn rf-need block";
  el.setAttribute("role","status");
  el.innerHTML=rfNeedHtml({
    titleHtml:`MIDI włączone, ale nie dotrze do żadnej aplikacji`,
    whyHtml:W.why,
    fixHtml:`<b>Co zrobić:</b> `+
      // Zdanie w SWOIM elemencie, a nie doklejone przed „1) zainstaluj": inaczej przy przypadku
      // „nieznane" oba stopiłyby się w jeden węzeł tekstowy i para EN tamtej instrukcji przestałaby
      // pasować (walker i18n dopasowuje CAŁY węzeł, nie fragment zdania).
      (W.fix?`<span class="mi-warn-step">${W.fix}</span> `:``)+(W.install?instal:``)+
      (d.hasOsc?`<span class="mi-warn-osc">✅ OSC działa już teraz (bez loopMIDI).</span>`:``),
    url:W.install?"https://www.tobias-erichsen.de/software/loopmidi.html":null,
    urlLabel:_gl("Pobierz loopMIDI ↗","Download loopMIDI ↗"),
    recheck:(d.kind==="winmm"?null:"miLoadPorts")});
  // …i samo się poprawi. Człowiek czytający to zdanie idzie włączyć loopMIDI — a wracał do panelu,
  // w którym stało dalej to samo, dopóki czegoś nie kliknął. Póki ostrzeżenie wisi, panel dopytuje
  // serwer o porty; gdy port się pojawi, zdanie znika samo. Zegar chodzi TYLKO z ostrzeżeniem na
  // ekranie (miWarnWatch(false) wyżej), więc zamknięta sprawa nie kosztuje ani jednego zapytania.
  miWarnWatch(d.kind==="brak"||d.kind==="niedziala"||d.kind==="bezportu"||d.kind==="nieznane");
}
let _miWarnT=null;
function miWarnWatch(on){
  if(!on){ if(_miWarnT){clearInterval(_miWarnT);_miWarnT=null;} return; }
  if(_miWarnT) return;
  _miWarnT=setInterval(()=>{
    const el=document.getElementById("miWarn");
    // Karta schowana (inna zakładka) nie ma po co pytać — wróci do tego przy pierwszym renderze.
    if(!el||el.style.display==="none"||!el.offsetParent){ miWarnWatch(false); return; }
    if(typeof miLoadPorts==="function")miLoadPorts();
  },4000);
}
// How many ENABLED mappings of this side (MIDI or OSC) the capsule has. „LIVE" printed under a
// list that says „No OSC mappings" is simply untrue: the group is on, but there is nothing to send.
function miMapCount(isOsc){
  return ((state.midi.mappings||[])
    .filter(m=>m.enabled!==false&&((m.dest==="osc")===!!isOsc))).length;
}
// The status footers under the MIDI and OSC lists are gone (F-G3-08): the readiness line under
// the module head says the same (module on, a mapping, a port, control on) in one place, and the
// red #miWarn stays as the detailed "nothing reaches a music program" box while MIDI is on.
function miUpdateNote(){
  miRenderWarn();
}
// ---------------------------------------------------------------------------------------------
//  READINESS LINES OF MIDI AND OSC (P-G3-08, rf-28c rfReady)
// ---------------------------------------------------------------------------------------------
// Rows in the order things depend on each other: what Windows has to provide, then the port or the
// receiver, a mapping, the module switch, the main control switch and the capsule. Only the first
// unmet row gets the steps, so "Turn MIDI on" never stands first while loopMIDI is missing.
const MI_LOOPMIDI_URL="https://www.tobias-erichsen.de/software/loopmidi.html";
function _miIsGs(nm){return /wavetable|gs synth|microsoft gs/i.test(nm||"");}
function _miReadyRows(){
  const env=state.midiEnv||{}, ports=env.ports||[];
  const routable=ports.filter(p=>!_miIsGs(p.name));
  const rows=[];
  if(!env.midiAvail){
    rows.push({ok:false,pl:"MIDI działa w tym systemie",en:"MIDI works on this system",
      steps:[["Windows nie daje tej aplikacji dostępu do MIDI (winmm). OSC działa niezależnie i niczego nie potrzebuje.",
               "Windows gives this app no access to MIDI (winmm). OSC works on its own and needs nothing installed."]]});
  }else{
    const lm=env.loopMidi||{};
    const r={ok:routable.length>0,pl:"Windows widzi port loopMIDI",en:"Windows sees a loopMIDI port"};
    if(!r.ok){
      const why=ports.length
        ?["Windows widzi tylko „Microsoft GS Wavetable Synth”, którego nie zobaczy ani DAW, ani Resolume. OSC działa bez loopMIDI.",
          "Windows only sees “Microsoft GS Wavetable Synth”, which neither a DAW nor Resolume can see. OSC works without loopMIDI."]
        :["Windows nie ma własnego wirtualnego portu MIDI, a żadnego innego nie widzi. OSC działa bez loopMIDI.",
          "Windows has no virtual MIDI port of its own and sees no other. OSC works without loopMIDI."];
      const again={pl:"Sprawdź ponownie",en:"Check again",click:"#miPortRefresh"};
      if(lm.running===true){r.fix=again;
        r.steps=[why,["W oknie loopMIDI wpisz nazwę na dole (np. RibbitFlip), kliknij „+”, a potem „Sprawdź ponownie”.",
                      "In the loopMIDI window type a name at the bottom (for example RibbitFlip), click “+”, then “Check again”."]];}
      else if(lm.installed===true){r.fix=again;
        r.steps=[why,["Uruchom loopMIDI (zwykle chowa się przy zegarku) i kliknij „Sprawdź ponownie”. Nie trzeba niczego instalować.",
                      "Start loopMIDI (it usually hides near the clock) and click “Check again”. Nothing needs to be installed."]];}
      else{r.fix={pl:"Pobierz loopMIDI",en:"Download loopMIDI",run:()=>window.open(MI_LOOPMIDI_URL,"_blank","noopener")};
        r.steps=[why,["Zainstaluj darmowy loopMIDI, utwórz w nim port (np. RibbitFlip) i kliknij 🔄 obok listy portów.",
                      "Install the free loopMIDI, create a port in it (for example RibbitFlip) and click 🔄 next to the port list."]];}
    }
    rows.push(r);
    const active=(ports.find(p=>p.i===env.midiPort)||{}).name||"";
    const okPort=!!(env.midiActive&&env.midiPort>=0&&!_miIsGs(active));
    // One port to choose from: the button picks it, through the same list a person would use.
    const one=routable.length===1?routable[0]:null;
    rows.push({ok:okPort,pl:"Wybrany port MIDI",en:"A MIDI port is selected",
      fix:one?{pl:"Użyj: "+one.name,en:"Use: "+one.name,run:()=>{const s=document.getElementById("miPort");
                if(s){s.value=String(one.i);s.dispatchEvent(new Event("change"));}}}
             :{pl:"Wybierz",en:"Pick one",run:()=>{rfReady.show("miPort");const s=document.getElementById("miPort");if(s)s.focus();}}});
  }
  rows.push({ok:miMapCount(false)>0,pl:"Jest co najmniej jedno mapowanie MIDI",en:"There is at least one MIDI mapping",
    fix:{pl:"Nowe mapowanie",en:"New mapping",click:"#miAdd"}});
  rows.push({ok:!!state.midi.enabled,pl:"Moduł MIDI włączony",en:"The MIDI module is on",
    fix:{pl:"Włącz MIDI",en:"Turn MIDI on",click:"#miEnable"}});
  rows.push(rfReady.armedRow());
  rows.push(rfReady.capsuleRow());
  return rows;
}
function _oscReadyRows(){
  const env=state.midiEnv||{};
  const rows=[];
  if(env.oscAvail===false)rows.push({ok:false,pl:"Wyjście OSC działa w tym systemie",en:"The OSC output works on this system",
    steps:[["Moduł UDP aplikacji nie wstał, więc żaden pakiet OSC nie wyjdzie.","The app's UDP module did not start, so no OSC packet can go out."]]});
  const host=env.oscHost||"127.0.0.1", port=env.oscPort||9000;
  const bad=(typeof oscAddrProblem==="function")?oscAddrProblem(host,port):null;
  rows.push({ok:!bad,pl:"Odbiornik ma adres i port",en:"The receiver has an address and a port",
    fix:{pl:"Ustaw",en:"Set it",run:()=>{rfReady.show("miOscHost");const h=document.getElementById("miOscHost");if(h)h.focus();}}});
  rows.push({ok:miMapCount(true)>0,pl:"Jest co najmniej jedno mapowanie OSC",en:"There is at least one OSC mapping",
    fix:{pl:"Nowe mapowanie OSC",en:"New OSC mapping",click:"#oscAdd"}});
  rows.push({ok:!!state.midi.oscEnabled,pl:"Moduł OSC włączony",en:"The OSC module is on",
    fix:{pl:"Włącz OSC",en:"Turn OSC on",click:"#oscEnable"}});
  rows.push(rfReady.armedRow());
  rows.push(rfReady.capsuleRow());
  return rows;
}
function miReadyRegister(){
  if(typeof rfReady==="undefined")return;
  rfReady.register({id:"rfReadyMidi",anchor:()=>rfReady.headOf("midi"),rows:_miReadyRows,
    allOk:()=>{const env=state.midiEnv||{};
      const nm=((env.ports||[]).find(p=>p.i===env.midiPort)||{}).name||"";
      return ["Ruch kapsla trafia do portu MIDI „"+nm+"”.","The capsule motion reaches the MIDI port “"+nm+"”."];}});
  rfReady.register({id:"rfReadyOsc",anchor:()=>rfReady.headOf("osc"),rows:_oscReadyRows,
    allOk:()=>{const env=state.midiEnv||{};const a=(env.oscHost||"127.0.0.1")+":"+(env.oscPort||9000);
      return ["Ruch kapsla trafia do odbiornika OSC "+a+".","The capsule motion reaches the OSC receiver "+a+"."];}});
}
function miApplyAvail(){
  // MIDI/OSC now lives in its OWN tab — keep it visible even with --no-midi so it can be enabled
  // (OSC works without MIDI hardware; the in-panel warning explains MIDI routing). No section hiding.
}

// "Mapping" group (triggers) — independent toggle
function setTrigEnabled(on,fromServer){
  state.trigEnabled=!!on;
  trigReflectEnable();
  if(!fromServer)fetch("/trig-enable",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({enabled:!!on})}).catch(()=>{});
}
function onTrigEnable(m){ if(typeof m.enabled==="boolean")setTrigEnabled(m.enabled,true); }
function trigReflectEnable(){
  // Two switches, one group: #padTrigEnable in the Kontroler tab is a MIRROR of #trigEnable, not a
  // second flag. Pad buttons leave the app through the Mapping group like every other rule, so a
  // separate switch there would be a lie the first time somebody used it.
  for(const id of ["trigEnable","padTrigEnable"]){
    const b=document.getElementById(id);
    if(b){const on=!!state.trigEnabled;b.classList.toggle("on",on);
      b.setAttribute("aria-checked",on?"true":"false");
      b.classList.toggle("live",on&&(typeof keysLive==="function"&&keysLive()));}}
  if(typeof updateKeysNote==="function")updateKeysNote();
  if(window.updateTabDots)updateTabDots();
  if(typeof padOffNoteSync==="function")try{padOffNoteSync();}catch(e){}
}
function onMidiCfg(m){
  if(state.midiEditing)return;   // don't overwrite while editing a mapping
  // NOTE: we do NOT overwrite state.midi.enabled NOR state.midi.oscEnabled from the echo —
  // both group toggles are controlled locally (button) + explicitly loaded in miFetchState;
  // an old mapping POST's echo (debounce 180 ms) must not revert a fresh click on either.
  if(m.midiChannel!=null)state.midi.midiChannel=m.midiChannel;
  if(m.oscPrefix)state.midi.oscPrefix=m.oscPrefix;
  if(m.scaleRoot!=null)state.midi.scaleRoot=m.scaleRoot;
  if(m.scale)state.midi.scale=m.scale;
  if(Array.isArray(m.mappings))state.midi.mappings=m.mappings;
  // JAK SIĘ TEN ZESTAW NAZYWA (pasek tożsamości, rf-49d). Bez tego wiersza nazwa zniknęłaby przy
  // pierwszym echu z serwera i pasek pokazywałby „bez nazwy" na kapslu, który nazwę nosi. Inaczej
  // niż przełączniki wyżej — nazwę WOLNO wziąć z echa, bo nie steruje niczym, tylko opisuje.
  if(m.configName!=null)state.midi.configName=m.configName;
  miFillTarget();renderMidiList();miReflectEnable();
  if(typeof midiCfgSync==="function")midiCfgSync();
  if(typeof renderOverview==="function")renderOverview();   // refresh cheat sheet (MIDI mappings)
  // the journal's "why is it empty" line is derived from THIS config — the first mapping to arrive
  // must stop it claiming there are none (rf-16b)
  if(typeof iologRefresh==="function")iologRefresh();
}
function miOutText(m,it){
  if(!it)return "—";
  if(m&&m.dest==="note")return (it.o==null||it.o<0)?"—":miNoteName(it.o);
  if(m&&m.dest==="osc"&&m.mode!=="threshold")return (it.o!=null?it.o:"—");
  return (it.o!=null?it.o:"—");
}
function onMidiOut(m){
  state.midiOut={};for(const it of (m.items||[]))state.midiOut[it.id]=it;
  state.midiOutLive=!!m.live;
  const byId={};for(const mm of (state.midi.mappings||[]))byId[mm.id]=mm;
  for(const id in state.midiOut){
    const it=state.midiOut[id];
    const bar=document.getElementById("mibar-"+id);
    if(bar){const v=Math.max(0,Math.min(1,it.v||0));bar.style.width=(v*100).toFixed(1)+"%";
      bar.classList.toggle("sent",!!it.s);}
    const vv=document.getElementById("mival-"+id);if(vv)vv.textContent=miOutText(byId[id],it);
    const ov=document.getElementById("ovmiv-"+state.activeDeviceId+"-"+id);   // "all mappings" cheat sheet
    if(ov){ov.textContent=miOutText(byId[id],it);ov.classList.toggle("sent",!!it.s);}
  }
  // Podgląd nauki zakresu jedzie tym samym zdarzeniem (klucz `learn`, dokładany przez serwer tylko
  // w trakcie sesji) — laboratorium nie odpytuje serwera ani razu na sekundę.
  if(m.learn&&typeof miLabLearnTick==="function")miLabLearnTick(m.learn);
}
function miSrcLabel(m){if(m.srcKind!=="filter")return "CH"+m.ch;const x=MI_METRICS.find(x=>x[0]===m.metric)||["","?","?"];return _gl(x[1],x[2]);}
function miDestLabel(m){
  const ch=(m.midiCh&&m.midiCh>=1&&m.midiCh<=16)?m.midiCh:((state.midi.midiChannel|0)+1);
  const kan=_gl(" · kan "," · ch "),nuta=_gl("Nuta ","Note ");   // composed with numbers → _gl, not a dictionary key
  if(m.dest==="cc")return "MIDI CC "+m.cc+kan+ch;
  if(m.dest==="cc14")return "CC14 "+m.cc+"/"+((+m.cc+32)&127)+kan+ch;
  if(m.dest==="pitchbend")return "Pitch Bend"+kan+ch;
  if(m.dest==="aftertouch")return "Aftertouch"+kan+ch;
  if(m.dest==="program")return "Program "+(m.prog|0)+kan+ch;
  if(m.dest==="note")return (m.mode==="continuous")
    ?(nuta+miNoteName(m.loNote)+"–"+miNoteName(m.hiNote)+kan+ch)
    :(nuta+miNoteName(m.note)+kan+ch);
  // The profile and the edge behaviour are what a row of the OSC list is actually about — the
  // address alone does not say whether the receiver gets 180 or a bare 1.
  const p=miOscProf(m),tail=(p[0]==="free")?"":(" · "+p[1].replace(/\s*\(.*\)\s*$/,""));
  const _ed={gate:_gl("bramka","gate"),toggle:_gl("przełącznik","latch"),
             pulse:_gl("impuls ","pulse ")+(m.pulseMs|0)+" ms"}[m.oscEdge];
  // Nazwa urządzenia stoi PRZED adresem, bo przy kilku urządzeniach sam adres przestaje cokolwiek
  // identyfikować: „/fader1" na lampie i „/fader1" na tablecie to dwa różne mapowania.
  return "OSC "+((typeof oscTargetTag==="function")?oscTargetTag(m):"")+
    (state.midi.oscPrefix||"")+(m.addr||"")+tail+
    ((m.mode==="threshold"&&_ed)?(" · "+_ed):"");
}
// Loads the MIDI/OSC configuration OF ONE CAPSULE — called at startup and on every capsule switch,
// because `state.midi` (mappings included) is a single object shared by a per-capsule server config.
function miFetchState(dev){
  dev=dev||state.activeDeviceId||"d0";
  state.midiDev=null;                       // nothing may be written until this capsule's config lands
  return fetch("/midi?dev="+encodeURIComponent(dev)).then(r=>r.json()).then(m=>{
    state.midiEnv=Object.assign(state.midiEnv||{},{midiAvail:m.midiAvail,midiActive:m.midiActive,
      midiPort:m.midiPort,oscAvail:m.oscAvail,oscHost:m.oscHost,oscPort:m.oscPort,
      // „nie ma loopMIDI" i „loopMIDI jest, tylko nie działa" to dwie różne rady — serwer
      // odpowiada na oba pytania osobno (loopmidi_probe), a ostrzeżenie je rozróżnia.
      loopMidi:m.loopMidi||null});
    // Nazwane urządzenia OSC przyjeżdżają tą samą odpowiedzią co mapowania (rf-49e), więc każdy
    // wybór urządzenia da się narysować od razu — bez drugiego zapytania i pustej listy na starcie.
    if(typeof oscTargetsTake==="function")oscTargetsTake(m);
    const s=m.slot||{};
    state.midi.mappings=Array.isArray(s.mappings)?s.mappings:[];   // a capsule with no mappings must not inherit the last one's
    if(s.enabled!=null)state.midi.enabled=!!s.enabled;
    if(s.oscEnabled!=null)state.midi.oscEnabled=!!s.oscEnabled;
    else if(s.enabled!=null)state.midi.oscEnabled=!!s.enabled;   // older server without the field: mirror the single switch
    if(s.midiChannel!=null)state.midi.midiChannel=s.midiChannel;
    if(s.oscPrefix)state.midi.oscPrefix=s.oscPrefix;
    if(s.scaleRoot!=null)state.midi.scaleRoot=s.scaleRoot;
    if(s.scale)state.midi.scale=s.scale;
    // Nazwa zestawu — przepisywana BEZWARUNKOWO (nie `if(s.configName)`), bo kapsel bez nazwy musi
    // wyczyścić tę po poprzednim: state.midi jest JEDNYM obiektem na wszystkie kapsle, więc pominięty
    // klucz zostawiłby na pasku cudzy podpis. Ta sama pułapka, co przy `mappings` linijkę wyżej.
    state.midi.configName=String(s.configName||"");
    miFillTarget();renderMidiList();miReflectEnable();
  }).catch(()=>{}).then(()=>{state.midiDev=dev;
    // Dopiero teraz pasek ma prawo cokolwiek zapisać (patrz _midiCfgReady) — i dopiero teraz zna
    // nazwę tego kapsla, więc odświeżenie musi iść PO ustawieniu state.midiDev.
    if(typeof midiCfgSync==="function")midiCfgSync();});
}
function miLoadPorts(){
  fetch("/midi/ports").then(r=>r.json()).then(m=>{
    state.midiEnv.ports=m.ports||[];state.midiEnv.midiAvail=!!m.midiAvail;
    if(m.loopMidi)state.midiEnv.loopMidi=m.loopMidi;
    if(m.activePort!=null)state.midiEnv.midiPort=m.activePort;
    miFillPorts();
    // Ostrzeżenie czyta ten sam stan, więc po odświeżeniu portów ma się przerysować — bez tego
    // uruchomiony w międzyczasie loopMIDI zmieniał listę, a zdanie nad nią zostawało stare.
    if(typeof miRenderWarn==="function")miRenderWarn();
  }).catch(()=>{});
}
function miFillPorts(){
  const sel=document.getElementById("miPort");if(!sel)return;
  const cur=(state.midiEnv.midiPort!=null?state.midiEnv.midiPort:-1);
  sel.innerHTML='<option value="-1">— brak (wyłączony) —</option>'+
    (state.midiEnv.ports||[]).map(p=>`<option value="${p.i}">${miEsc(p.name)}</option>`).join("");
  sel.value=String(cur);
  miFillTarget();
}
function miFillTarget(){
  const env=state.midiEnv||{};
  const ps=document.getElementById("miPortStatus");
  if(ps){
    if(!env.midiAvail)ps.textContent=_gl("MIDI niedostępne (winmm)","MIDI unavailable (winmm)");
    else if(env.midiActive)ps.textContent=_gl("● połączony (port ","● connected (port ")+env.midiPort+")";
    else ps.textContent=_gl("○ port nieotwarty, wybierz port","○ port not open, pick a port");
    ps.className="mi-portstatus"+(env.midiActive?" ok":"");
  }
  // Brak loopMIDI mówi linia gotowości (wiersz „Windows widzi port loopMIDI” z krokami), a przy
  // włączonym MIDI dokładniej czerwone #miWarn, które od razu mówi, KTÓRY to przypadek.
  miRenderWarn();
  const ch=document.getElementById("miChannel");if(ch)ch.value=String((state.midi.midiChannel|0)+1);
  const px=document.getElementById("miOscPrefix");if(px)px.value=state.midi.oscPrefix||"/ribbitflip";
  const oh=document.getElementById("miOscHost");if(oh&&env.oscHost)oh.value=env.oscHost;
  const op=document.getElementById("miOscPort");if(op&&env.oscPort)op.value=env.oscPort;
  const sr=document.getElementById("miScaleRoot");if(sr)sr.value=String(state.midi.scaleRoot||0);
  const sc=document.getElementById("miScale");if(sc)sc.value=state.midi.scale||"chromatic";
  miUpdateNote();
  try{if(_miOutSync)_miOutSync();if(_oscOutSync)_oscOutSync();}catch(e){}
}
// Komunikat ląduje na TYM ekranie, na którym stoi człowiek. Węzeł statusu był jeden (#miMsg w
// karcie MIDI), a zakładki są dwie — więc „Zapisano mapowanie ✓" po zapisie mapowania OSC trafiało
// w niewidoczny kawałek sąsiedniej zakładki i wyglądało, jakby zapis nie doszedł do skutku.
function miFlash(t){
  const p=document.getElementById("tab-osc");
  const e=document.getElementById((p&&p.classList.contains("active"))?"oscMsg":"miMsg")
        ||document.getElementById("miMsg");
  if(!e)return;e.textContent=t;
  clearTimeout(e._t);e._t=setTimeout(()=>{e.textContent="";},2200);}
function testMidiMap(m){
  if(!m)return;
  // A GROUP THAT IS OFF SENDS NOTHING — including a test. /test-midi deliberately ignores the
  // armed state, so without this guard „▷ Test" would put a packet on the wire from a tab whose
  // switch says Off, and the journal above it would still be insisting nothing goes out. Refusing
  // it silently is the other half of the same lie, so the refusal gets a journal line of exactly
  // the kind a blocked stream gets („nie wysłano — …") plus the usual inline message.
  const _isOsc=(m.dest==="osc");
  if(!(_isOsc?state.midi.oscEnabled:state.midi.enabled)){
    if(typeof iologLocal==="function")iologLocal(_isOsc?"osc":"midi",
      {kind:"test",name:m.name||miSrcLabel(m),
       addr:_isOsc?((state.midi.oscPrefix||"")+(m.addr||"")):null,
       why:_isOsc?"oscoff":"midioff"});
    miFlash(_isOsc?_gl("Nie wysłano: moduł OSC jest wyłączony","Not sent: the OSC module is off")
                  :_gl("Nie wysłano: moduł MIDI jest wyłączony","Not sent: the MIDI module is off"));
    return;
  }
  let body;
  // `target` leci JAWNIE, bo test bywa wołany na mapowaniu, które jest właśnie pisane — zapisana
  // wersja może wskazywać wczorajsze urządzenie, a test, który po cichu poszedłby gdzie indziej,
  // dowodziłby czegoś przeciwnego niż to, co sprawdzamy.
  if(m.dest==="osc")body={proto:"osc",addr:m.addr||"/test",value:1.0,target:m.oscTarget||""};
  else if(m.dest==="note"){const n=(m.mode==="threshold")?m.note:Math.round((m.loNote+m.hiNote)/2);
    body={proto:"midi",kind:"note",note:n,velocity:m.velocity||100};}
  else if(m.dest==="pitchbend")body={proto:"midi",kind:"pitchbend",value14:12000};
  else if(m.dest==="aftertouch")body={proto:"midi",kind:"aftertouch",value:100};
  else if(m.dest==="program")body={proto:"midi",kind:"program",prog:m.prog|0};
  else if(m.dest==="cc14")body={proto:"midi",kind:"cc14",cc:m.cc,value14:12000};
  else body={proto:"midi",kind:"cc",cc:m.cc,value:100};
  if(body.proto==="midi"&&m.midiCh&&m.midiCh>=1&&m.midiCh<=16)body.ch=m.midiCh-1;
  fetch("/test-midi",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
    .then(r=>r.json()).then(r=>miFlash(r.sent?_gl("Wysłano test ✓","Test sent ✓")
      :_gl("Nie wysłano — sprawdź port MIDI / cel OSC","Not sent — check the MIDI port / the OSC target")))
    .catch(()=>miFlash(_gl("Serwer nieosiągalny","Server unreachable")));
}
// ONE list in the model (state.midi.mappings, discriminated by `dest`) rendered in TWO views:
// #miList (MIDI destinations) in the MIDI tab and #oscList (dest==="osc") in the OSC tab.
// Splitting the model into two arrays would break Settings/, saved setups and bundles.
function miRowHtml(m){
  const src=miSrcLabel(m), dest=miDestLabel(m);
  const tag=(m.mode==="threshold")?' <span class="mi-arrow">⟂ próg</span>':'';
  // TWO CLUSTERS, NOT SEVEN LOOSE ITEMS. The list is a two-column grid from 1120 px up, so a row
  // is about 460 px wide — and a flex-wrap over the whole head put the bin alone on a second line
  // there. Only the LABEL half is allowed to wrap now; ⠿ + the three buttons stay together, and
  // the name shrinks (min-width:0 + ellipsis in the stylesheet) instead of pushing them apart.
  return `<div class="mi-row${m.enabled?"":" off"}${state.midiEditing===m.id?" is-editing":""}" data-id="${miEsc(m.id)}">
    <div class="mi-rowhead">
      <span class="drag-grip" title="Przeciągnij, aby zmienić kolejność">⠿</span>
      <span class="mi-rowlbl">
        <span class="mi-name">${miEsc(m.name||(src+" → "+dest))}</span>
        ${m.name?`<span class="mi-arrow">${miEsc(src)} <b>→</b> ${miEsc(dest)}</span>`:""}${tag}
      </span>
      <span class="mi-rowacts">
        <span class="mi-liveval" id="mival-${miEsc(m.id)}">—</span>
        <!-- Same icons as the Mapping list (rf-10): spray = edit, ▷ = test, bin = delete; the verb lives in title/aria-label. -->
        <button class="btn xs" data-act="edit" data-id="${miEsc(m.id)}" title="Edytuj" aria-label="Edytuj"><span class="rfic spray-ic sm" aria-hidden="true"></span></button>
        <button class="btn xs" data-act="test" data-id="${miEsc(m.id)}" title="Testuj mapowanie" aria-label="Testuj mapowanie">▷</button>
        <button class="btn xs" data-act="del" data-id="${miEsc(m.id)}" title="Usuń mapowanie" aria-label="Usuń mapowanie"><span class="bic bic-bin" aria-hidden="true"></span></button>
      </span>
    </div>
    <div class="mi-barwrap"><i class="mi-bar" id="mibar-${miEsc(m.id)}"></i></div>
  </div>`;
}
function _miWireList(wrap){
  wrap.querySelectorAll("button[data-act]").forEach(b=>{
    const id=b.dataset.id,act=b.dataset.act;
    b.onclick=()=>{
      if(act==="edit")openMidiEditor(id);
      else if(act==="del"){state.midi.mappings=state.midi.mappings.filter(x=>x.id!==id);renderMidiList();commitMidi();}
      else if(act==="test")testMidiMap(state.midi.mappings.find(x=>x.id===id));
    };
  });
  enableDragReorder(wrap,".mi-row",commitMidiOrder);
}
function renderMidiList(){
  const ms=state.midi.mappings||[];
  const views=[
    ["miList", m=>m.dest!=="osc",
     'Brak mapowań MIDI. Kliknij „Nowe mapowanie”, wybierz źródło (np. Pochylenie) i cel (CC, Nuta, Pitch Bend…).'],
    ["oscList", m=>m.dest==="osc",
     'Brak mapowań OSC. Kliknij „Nowe mapowanie OSC”, a ruch kapsla poleci przez UDP do TouchOSC, Resolume, TouchDesigner albo ESP32.'],
  ];
  for(const [wid,filt,empty] of views){
    const wrap=document.getElementById(wid);if(!wrap)continue;
    const sub=ms.filter(filt);
    if(!sub.length){wrap.innerHTML='<div class="mi-empty">'+empty+'</div>';continue;}
    wrap.innerHTML=sub.map(miRowHtml).join("");
    _miWireList(wrap);
  }
  miRenderWarn();
}
function openMidiEditor(id,defaults){
  const ed=document.getElementById("miEditor");if(!ed)return;
  let m;
  if(id){const orig=state.midi.mappings.find(x=>x.id===id);if(!orig)return;m=Object.assign({},orig);}
  else{m=Object.assign(miDefaultMap(),defaults||{});}
  state._midiEditIsNew=!id;
  state.midiEditing=m.id;state._midiDraft=m;
  // The mode the „Program" target took away from the user — see the #mieDest handler. It lives
  // for exactly one opening of the editor and is NOT a field of the mapping: it may never travel
  // to the server nor enter the configuration fingerprint (MIDI_CFG_MAP_FIELDS in rf-49d).
  state._midiModeBefore=null;
  // Pas „obserwowane" i ewentualna sesja nauki należą do JEDNEGO mapowania — otwarcie edytora
  // zaczyna liczyć od zera, żeby nie pokazywać cudzych minimów w innych jednostkach.
  if(typeof miLabReset==="function")miLabReset();
  // One shared editor serves both tabs: move #miEditor in front of the list the edited mapping
  // belongs to (OSC or MIDI), so it opens where the user clicked.
  const host=document.getElementById(m.dest==="osc"?"oscList":"miList");
  if(host&&host.parentNode&&ed.nextElementSibling!==host)host.parentNode.insertBefore(ed,host);
  renderMidiEditor();renderMidiList();ed.style.display="block";
  try{ed.scrollIntoView({behavior:"smooth",block:"nearest"});}catch(e){}
}
function closeMidiEditor(){
  state.midiEditing=null;state._midiDraft=null;
  miStopCurvePrev();   // stop the curve-preview rAF loop
  // Zamknięcie edytora kończy też naukę — inaczej sesja tykałaby na serwerze bez okna, w którym
  // dałoby się ją przyjąć albo odrzucić.
  if(typeof miLabLearnAbort==="function")miLabLearnAbort();
  const ed=document.getElementById("miEditor");if(ed){ed.style.display="none";ed.innerHTML="";}
  renderMidiList();
}
function miNoteOptions(sel){let s="";for(let n=24;n<=96;n++)s+=`<option value="${n}"${n===+sel?" selected":""}>${miNoteName(n)} (${n})</option>`;return s;}
// ── OSC output section ───────────────────────────────────────────────────────────────────────
// Rendered INSTEAD of the MIDI one — a mapping is one or the other, so an OSC form no longer
// carries a dozen hidden MIDI fields. The cards are the three questions an OSC mapping answers,
// and they are separate cards because they are separate decisions: "Zakres" and "Czas impulsu"
// side by side in one auto-fill grid read like two settings of the same kind, and they are not.
// The "when" card only exists in threshold mode — in continuous mode the value simply follows
// the movement and there is no edge to have a behaviour at.
// `part`: "main" = adres, odbiornik i podgląd pakietu (tryb prosty edytora), "tune" = karty profilu,
// zbocza, tempa i parkowania (zwijak „Dostrajanie”, UX 261120 L4c). Bez `part` całość, jak dawniej.
function miOscOutHtml(m,isThr,part){
  // Zakres wyjścia (i przełącznik własnego wycinka) mieszka w PASIE C laboratorium — stoi pod
  // paskiem, który pokazuje jego skutek. Tutaj zostaje tylko to, co zakresem nie jest: adres,
  // profil, typ, zbocze, tempo, wartość parkowania. Gdy rf-16c się nie wczytał, pola wracają na
  // stare miejsce — lepszy formularz bez wykresu niż mapowanie, którego zakresu nie da się wpisać.
  const _lab=(typeof miLabOutRowHtml==="function");
  const prof=miOscProf(m),derived=(prof[0]!=="free"),
        ranged=(m.oscType==="floatrange"||m.oscType==="int"),
        lock=derived?" disabled":"",
        // A profile owns the argument type (the receiver's dialect) always. The two ends of the
        // range are only locked while the mapping uses the device's FULL span — tick "własny
        // zakres roboczy" and they become the window, still clamped to the span server-side.
        canNarrow=miOscRanged(prof),
        showRange=canNarrow,
        rangeLock=(derived&&!(canNarrow&&m.oscRangeCustom))?" disabled":"",
        spanAttr=canNarrow?` min="${Math.min(prof[3],prof[4])}" max="${Math.max(prof[3],prof[4])}"`:"",
        _span=canNarrow?`${prof[3]}–${prof[4]}`:"";
  const edgeCard=isThr?`
        <div class="mie-card" id="mieEdgeCard">
          <div class="mie-card-h">Kiedy i jak długo</div>
          <label class="fld" id="mieOscEdgeW">Zachowanie na progu
            <select id="mieOscEdge">${MI_OSC_EDGES.map(e=>`<option value="${e[0]}"${(m.oscEdge||"bang")===e[0]?" selected":""}>${e[1]}</option>`).join("")}</select></label>
          <label class="fld" id="miePulseW" style="${m.oscEdge==="pulse"?"":"display:none"}">Czas impulsu (ms)
            <input type="number" id="miePulse" min="20" max="10000" value="${m.pulseMs|0}"></label>
          <small class="mie-card-note">To decyduje, KIEDY komunikat leci — jaka wartość, ustala profil obok. Impuls X ms wraca do spoczynku sam, bez czekania, aż zejdziesz poniżej progu (minimum 20 ms).</small>
        </div>`:``;
  // Pace and keepalive live in the CONTINUOUS branch of the engine only — in threshold mode the
  // packet goes out on the edge and none of the three does anything. They used to be shown always,
  // which quietly promised a rate limit that was never applied.
  const paceCard=isThr?``:`
        <div class="mie-card">
          <div class="mie-card-h">Tempo i niezawodność</div>
          <div class="mie-card-row">
            <label class="fld">Min odstęp (ms)
              <input type="number" id="mieRate" min="5" max="1000" value="${m.rateMs}"></label>
            <label class="fld">Limit prędkości (jedn./s)
              <input type="number" id="mieMaxRate" min="0" step="any" value="${+m.maxRate||0}"></label>
            <label class="fld">Powtarzaj co (ms)
              <input type="number" id="mieKeep" min="0" max="10000" step="50" value="${m.keepaliveMs|0}"></label>
          </div>
          <small class="mie-card-note">Odstęp to górna granica tempa — ile komunikatów na sekundę najwyżej. Limit prędkości działa w jednostkach wyjścia: dla serwa 0–180 wpisanie 90 znaczy „pełny przejazd nie szybciej niż w 2 sekundy” i chroni mechanikę przed skokiem. Powtarzanie to dolna granica: UDP nie potwierdza dostarczenia, więc bez niego nieruchomy kapsel oznacza zupełną ciszę, a zgubiony ostatni pakiet gestu zostawia odbiornik na złej wartości na zawsze. 0 = wyłączone (poniżej 100 ms silnik też traktuje jak 0).</small>
        </div>`;
  const main=`
      <div class="mie-sec-body">
        <label class="fld" id="mieAddrW">Adres OSC (po prefiksie)
          <input type="text" id="mieAddr" value="${miEsc(m.addr||"")}" placeholder="/fader1"></label>
        ${(typeof oscTargetFieldHtml==="function")?oscTargetFieldHtml(m):""}
      </div>
      <div class="mie-oschint" id="mieOscHint">${miOscHint(m)}</div>`;
  if(part==="main")return main;
  const tune=`
      <div class="mie-cards">
        <div class="mie-card">
          <div class="mie-card-h">Co leci do odbiornika</div>
          <label class="fld" id="mieOscProfW">Profil odbiornika
            <select id="mieOscProf">${MI_OSC_PROF_GROUPS.map(gr=>{
              const opts=MI_OSC_PROFILES.filter(p=>p[5]===gr[0])
                .map(p=>`<option value="${p[0]}"${prof[0]===p[0]?" selected":""}>${p[1]}</option>`).join("");
              return gr[1]?`<optgroup label="${miEsc(gr[1]())}">${opts}</optgroup>`:opts;}).join("")}</select></label>
          <div class="mie-card-row">
            <label class="fld" id="mieOscTypeW">Typ OSC
              <select id="mieOscType"${lock}><option value="float"${m.oscType==="float"?" selected":""}>float 0..1</option>
                <option value="floatrange"${m.oscType==="floatrange"?" selected":""}>float (zakres)</option>
                <option value="int"${m.oscType==="int"?" selected":""}>int</option>
                <option value="bool"${m.oscType==="bool"?" selected":""}>bool</option></select></label>
            ${_lab?"":`<label class="fld" id="mieOscRangeW" style="${(showRange||ranged)?"":"display:none"}">${derived?"Zakres roboczy (min–max)":"Zakres (min–max)"}
              <span class="mie-range"><input type="number" id="mieOutLoF" step="any" value="${m.outLoF}"${rangeLock}${spanAttr}><input type="number" id="mieOutHiF" step="any" value="${m.outHiF}"${rangeLock}${spanAttr}></span></label>`}
          </div>
          ${_lab?"":`<label class="fld row" id="mieRangeCustW" style="${canNarrow?"":"display:none"}"><input type="checkbox" id="mieRangeCust"${m.oscRangeCustom?" checked":""}> własny zakres roboczy</label>`}
          <small class="mie-card-note">${
            !derived ? _gl("Ustawiasz typ i zakres sam. Profil to gotowa para dla typowych odbiorników.",
                           "You set the type and the range yourself. A profile is a ready-made pair for the usual receivers.")
            : (prof[0]==="digital") ? _gl("Wartość logiczna ma dwa stany, więc zakres jej nie dotyczy.",
                                          "A boolean has two states, so a range does not apply to it.")
            : m.oscRangeCustom
              ? _gl(`Urządzenie umie ${_span}, a mapowanie użyje tylko wpisanego wycinka — większe wartości zostaną przycięte do możliwości profilu. Odwrócenie (min większy od max) odwraca kierunek ruchu.`,
                    `The device can do ${_span}; this mapping will only use the window you type — anything beyond it is clamped to what the profile allows. Reversing it (min above max) reverses the direction of travel.`)
              : _gl(`Pełne możliwości urządzenia: ${_span}. Zaznacz „własny zakres roboczy”, żeby użyć tylko wycinka — na przykład gdy mechanika pozwala na 10–25, wentylator dławi się poniżej 30% albo dioda mruga przy najniższym wypełnieniu.`,
                    `The device's full span: ${_span}. Tick “custom working range” to use only part of it — for instance when the mechanism only has 10–25 free, a fan stalls below 30%, or an LED flickers at the lowest duty.`)}</small>
        </div>${edgeCard}${paceCard}
        <div class="mie-card">
          <div class="mie-card-h">Gdy wyjście gaśnie</div>
          <label class="fld" id="mieSafeW">Wartość przy rozbrojeniu
            <input type="number" id="mieSafe" step="any" value="${m.safeOnDisarm==null?"":m.safeOnDisarm}" placeholder="— nie parkuj"></label>
          <small class="mie-card-note">Jeden komunikat przy rozbrojeniu, wyłączeniu grupy OSC i rozłączeniu kapsla. Puste = nie parkuj — odbiornik zostaje tam, gdzie zastał go ostatni pakiet. Przełącznik i impuls parkują się same.</small>
        </div>
      </div>`;
  return part==="tune"?tune:(main+tune);
}
function renderMidiEditor(){
  const ed=document.getElementById("miEditor");const m=state._midiDraft;if(!ed||!m)return;
  const isFilter=(m.srcKind==="filter"), isThr=(m.mode==="threshold"),
    isCc=(m.dest==="cc"), isCc14=(m.dest==="cc14"), isPb=(m.dest==="pitchbend"),
    isAt=(m.dest==="aftertouch"), isProg=(m.dest==="program"), isNote=(m.dest==="note"), isOsc=(m.dest==="osc");
  const isMidi=!isOsc;                       // every non-OSC destination talks MIDI (has a channel)
  // Zakres wejścia I zakres wyjścia mieszkają w laboratorium (rf-16c) — każdy pod swoim pasem.
  // Bez tego pliku sekcja „Wyjście" musi je oddać z powrotem, inaczej nie dałoby się ich wpisać.
  const hasLab=(typeof miLabSectionHtml==="function");
  const usesCcNum=(isCc||isCc14);            // needs a CC number field
  const usesOutCc=(isCc||isAt);              // 0..127 output range (cc / aftertouch)
  const showBipolar=(!isThr&&(isPb||isCc||isCc14||isAt));   // centered/deadzone for bipolar continuous
  const slotCh=(state.midi.midiChannel|0)+1;
  const seg=(id,val,lbl,items)=>`<div class="mie-seg"><span class="mie-seg-lbl">${lbl}</span><div class="seg" id="${id}">`+
    items.map(it=>`<button type="button" data-v="${it[0]}" class="${val===it[0]?"on":""}">${it[1]}</button>`).join("")+`</div></div>`;
  // The form is read in the order a mapping actually works: WHAT drives it (input) → HOW the
  // movement is shaped (response) → WHAT leaves the app (output). Same section language as the
  // trigger editor (.ed-sec there, .mie-sec here) so both editors teach the same reading habit,
  // and the easing select now sits NEXT TO its animated preview instead of across the form.
  ed.innerHTML=`
   <div class="mie-head">${state._midiEditIsNew?'<span class="bic bic-plus" aria-hidden="true"></span><b>Nowe mapowanie</b>':'\u270e Edytujesz: <b>'+miEsc(m.name||miSrcLabel(m)+" \u2192 "+miDestLabel(m))+'</b>'}<button type="button" class="mie-x" id="mieHeadClose" title="Zamknij">\u2715</button></div>
   <div class="mie-primary">
    ${seg("mieKindSeg",m.srcKind,"Źródło",[["filter","Filtr 3D"],["axis","Oś (kanał)"]])}
    ${isOsc?`<div class="mie-seg"><span class="mie-seg-lbl">Cel</span>
      <span class="mie-modenote" id="mieDestOsc">📡 OSC</span>
      <span class="mie-desthint">adres i odbiornik ustawiasz w sekcji Wyjście</span></div>`
    :`<div class="mie-seg"><span class="mie-seg-lbl">Komunikat MIDI</span>
      <select class="mie-destsel" id="mieDest">${MI_DESTS_MIDI.map(x=>`<option value="${x[0]}"${m.dest===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select></div>`}
    ${isProg?'<div class="mie-seg"><span class="mie-seg-lbl">Tryb</span><span class="mie-modenote">próg (zbocze)</span></div>':seg("mieModeSeg",m.mode,"Tryb",[["continuous","Ciągły"],["threshold","Próg"]])}
   </div>
   <div class="mie-grid">
    <!-- LABORATORIUM ZAKRESU (rf-16c). Pola wejścia mieszkają TAM, z tymi samymi id — wireMidiEditor
         czyta je po id, więc przeniesienie sekcji nie zmienia niczego w odczycie formularza.
         Awaryjnie (plik nie wczytany) zostają gołe pola: lepiej formularz bez wykresu niż edytor,
         w którym nie da się wpisać zakresu. -->
    ${(typeof miLabSectionHtml==="function")?miLabSectionHtml(m,isThr):`
    <section class="mie-sec">
      <h4 class="mie-sec-h">Wejście — co steruje wartością</h4>
      <div class="mie-sec-body">
        <label class="fld" id="mieMetricW" style="${isFilter?"":"display:none"}">Wielkość
          <select id="mieMetric">${MI_METRICS.map(x=>`<option value="${x[0]}"${m.metric===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select></label>
        <label class="fld" id="mieChW" style="${isFilter?"display:none":""}">Kanał (oś)
          <select id="mieCh">${MI_SRC_AXIS.map(x=>`<option value="${x[0]}"${String(m.ch)===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select></label>
        <label class="fld" id="mieInLoW" style="${isThr?"display:none":""}">Wejście — min <input type="number" id="mieInLo" value="${m.inLo}"></label>
        <label class="fld" id="mieInHiW" style="${isThr?"display:none":""}">Wejście — max <input type="number" id="mieInHi" value="${m.inHi}"></label>
        <label class="fld" id="mieCmpW" style="${isThr?"":"display:none"}">Warunek
          <select id="mieCmp"><option value=">"${m.cmp===">"?" selected":""}>powyżej &gt;</option>
            <option value="<"${m.cmp==="<"?" selected":""}>poniżej &lt;</option></select></label>
        <label class="fld" id="mieThrW" style="${isThr?"":"display:none"}">Próg <input type="number" id="mieThr" value="${m.threshold}"></label>
        <label class="fld row" id="mieAbsW" style="${isThr?"":"display:none"}"><input type="checkbox" id="mieAbs"${m.absVal?" checked":""}> |wartość| bezwzgl.</label>
        <label class="fld row" title="Zamienia końce zakresu miejscami — największe wychylenie daje najmniejszą wartość"><input type="checkbox" id="mieInvert"${m.invert?" checked":""}> odwróć kierunek</label>
      </div>
    </section>`}
    <!-- Chip niedopasowania zakresu MIESZKA W LABORATORIUM (rf-16c, #miRngMismatch) i jest liczony
         przy każdym renderze sekcji. Tutaj zostaje tylko wariant awaryjny: bez tamtego pliku nie ma
         host-a, a ostrzeżenie musi istnieć: to jedyne miejsce, w którym panel mówi wprost o oknie
         bez pokrycia w jednostkach źródła. -->
    ${(!hasLab&&typeof miLabMismatch==="function"&&miLabMismatch(m))?`<div class="mi-rng-warn">⚠️ ${miEsc(miLabMismatch(m))}<button type="button" class="btn xs" id="mieRngFix">${_gl("Dopasuj","Fit it")}</button></div>`:""}
    <section class="mie-sec">
      <h4 class="mie-sec-h">${isOsc?"Wyjście — co leci przez OSC":"Wyjście — co leci do MIDI"}</h4>
      <p class="mie-sec-hint">${isOsc?"Adres dopisuje się do prefiksu z bloku „Cel domyślny i odbiorniki”. Profil odbiornika ustawia typ argumentu i zakres. Samo OSC nie zna pojęcia PWM czy serwa, więc profil to nazwa dla pary (typ, zakres), a nie osobny rodzaj sygnału.":"Komunikat trafia na port MIDI OUT wybrany w bloku „Port MIDI i skala”: do DAW, wizuali albo sprzętu."}</p>
      ${isOsc?miOscOutHtml(m,isThr,"main"):`
      <div class="mie-sec-body">
        <label class="fld" id="mieCcW" style="${usesCcNum?"":"display:none"}">${isCc14?"CC # (para: CC i CC+32)":"CC #"} <input type="number" id="mieCc" min="0" max="${isCc14?95:127}" value="${m.cc}"></label>
        <label class="fld" id="mieProgW" style="${isProg?"":"display:none"}">Program # (0–127) <input type="number" id="mieProg" min="0" max="127" value="${m.prog|0}"></label>
        ${hasLab?"":`<label class="fld" id="mieOutW" style="${usesOutCc?"":"display:none"}">${isAt?"Wyjście aftertouch (min–max)":"Wyjście CC (min–max)"}
          <span class="mie-range"><input type="number" id="mieOutLo" min="0" max="127" value="${m.outLo}">
          <input type="number" id="mieOutHi" min="0" max="127" value="${m.outHi}"></span></label>`}
        ${hasLab?"":`<label class="fld" id="mieNoteRangeW" style="${(isNote&&!isThr)?"":"display:none"}">Zakres nut (niska–wysoka)
          <span class="mie-range"><select id="mieLoNote">${miNoteOptions(m.loNote)}</select><select id="mieHiNote">${miNoteOptions(m.hiNote)}</select></span></label>`}
        <label class="fld" id="mieNoteW" style="${(isNote&&isThr)?"":"display:none"}">Nuta <select id="mieNote">${miNoteOptions(m.note)}</select></label>
      </div>`}
    </section>
    <!-- PIĘTRO 2 EDYTORA (UX 261120 L4c): tryb prosty to źródło, cel, zakres i „Test wyjścia”.
         Nazwa, reakcja i reszta wyjścia stoją tu; id pól bez zmian, więc wireMidiEditor czyta je jak dawniej. -->
    <details class="cardfold inset mie-tune" id="mieTune"><summary>Dostrajanie</summary>
    <div class="cardfold-body">
    <label class="fld mie-namefld">Nazwa (opcjonalnie) <input type="text" id="mieName" value="${miEsc(m.name||"")}" placeholder="np. Głośność / Bas"></label>
    <section class="mie-sec" id="mieShapeSec" style="${isThr?"display:none":""}">
      <h4 class="mie-sec-h">Reakcja — jak ruch zamienia się w wartość</h4>
      <p class="mie-sec-hint">Krzywa decyduje, czy początek ruchu działa delikatnie, czy od razu mocno. Podgląd obok liczy dokładnie tę samą krzywą co silnik.</p>
      <div class="mie-curve">
        <div class="mie-curve-ctl">
          <label class="fld" id="mieCurveW">Krzywa (easing)
            <select id="mieCurve">${miCurveOptions(m.curve||"lin")}</select></label>
          <label class="fld row" id="mieFlipW" title="Odbija krzywą — to, co działo się na początku ruchu, dzieje się na końcu"><input type="checkbox" id="mieFlip"${m.curveFlip?" checked":""}> ↕ odbij krzywą</label>
          <label class="fld" id="mieSlewW">Wygładzanie (ms) <input type="number" id="mieSlew" min="0" max="500" value="${m.slew|0}"></label>
          <label class="fld row" id="mieCenterW" style="${showBipolar?"":"display:none"}"><input type="checkbox" id="mieCentered"${m.centered?" checked":""}> wycentrowane (środek)</label>
          <label class="fld" id="mieDzW" style="${(showBipolar&&m.centered)?"":"display:none"}">Martwa strefa środka (±%) <input type="number" id="mieDeadzone" min="0" max="30" value="${m.deadzone|0}"></label>
        </div>
        <div class="mie-cp-w" id="mieCurvePrevW">
          <span class="mie-cp-h">Podgląd — tak będzie wyglądał ruch</span>
          <div id="mieCurvePrev" class="mie-curveprev"></div>
        </div>
      </div>
    </section>
    ${isOsc?miOscOutHtml(m,isThr,"tune"):`
    <section class="mie-sec">
      <div class="mie-sec-body">
        <label class="fld" id="mieMidiChW" style="${isMidi?"":"display:none"}">Kanał mapowania (puste = kanał grupy)
          <input type="number" class="mie-ch" id="mieMidiCh" min="1" max="16" value="${(m.midiCh&&m.midiCh>=1)?m.midiCh:""}" placeholder="${_gl("z grupy","from the group")} (${slotCh})"></label>
        <label class="fld row" id="mieLatchW" style="${(isNote&&isThr)?"":"display:none"}"><input type="checkbox" id="mieNoteLatch"${m.noteLatch?" checked":""}> zatrzask nuty (przełącznik)</label>
        <label class="fld" id="mieVelSrcW" style="${isNote?"":"display:none"}">Velocity
          <select id="mieVelSrc"><option value="fixed"${m.velSource==="motion"?"":" selected"}>🎚 stała</option><option value="motion"${m.velSource==="motion"?" selected":""}>💥 z ruchu</option></select></label>
        <label class="fld" id="mieVelW" style="${(isNote&&m.velSource!=="motion")?"":"display:none"}">Wartość velocity <input type="number" id="mieVel" min="1" max="127" value="${m.velocity}"></label>
        <label class="fld" title="Dolna granica odstępu między komunikatami — chroni odbiornik przed zalaniem">Min odstęp (ms) <input type="number" id="mieRate" min="5" max="1000" value="${m.rateMs}"></label>
      </div>
    </section>`}
    </div></details>
   </div>
   <div class="mie-actions">
     <!-- Anuluj przed akcją główną — ta sama kolejność co rfModal/rfConfirm (Anuluj po lewej, potwierdzenie po prawej). -->
     <button class="btn" id="mieCancel">Anuluj</button>
     <button class="btn primary" id="mieSave">${state._midiEditIsNew?"✓ Dodaj mapowanie":"✓ Zapisz mapowanie"}</button>
     <!-- Kopia na drugi protokół stoi PRZY zapisie, bo to akcja formularza (tworzy mapowanie),
          a nie próba na sucho. „▷ Test wyjścia" zostaje ostatni — patrz reguła kolejności wyżej. -->
     ${state._midiEditIsNew?"":`<button class="btn" id="mieClone" title="${isOsc?"Tworzy drugie mapowanie z tego samego ruchu, tyle że na MIDI — oryginał OSC zostaje na miejscu":"Tworzy drugie mapowanie z tego samego ruchu, tyle że na OSC — oryginał MIDI zostaje na miejscu"}">${isOsc?"Skopiuj jako mapowanie MIDI":"Skopiuj jako mapowanie OSC"}</button>`}
     <button class="btn" id="mieTest" title="Wyślij testowy komunikat teraz — bez ruszania kapslem">▷ Test wyjścia</button>
     <span class="mie-preview" id="miePreview"></span>
   </div>`;
  wireMidiEditor();
  try{if(typeof rfTier==="function")rfTier(document.getElementById("mieTune"),"midi.dostrajanie",{changed:miTuneChanged,sum:miTuneSum});}catch(e){}
}
// Nagłówek „Dostrajania”: nazwa, krzywa i wygładzanie, kanał (MIDI) albo profil odbiornika (OSC).
// Etykiety bierze z wybranych opcji, które przekłada walker i18n, więc działa w obu językach.
function miTuneSum(){
  const m=state._midiDraft;if(!m)return "";
  const opt=id=>{const e=document.getElementById(id);const o=e&&e.selectedOptions&&e.selectedOptions[0];return o?o.textContent.trim():"";};
  const out=[];
  if(m.name)out.push("„"+m.name+"”");
  if(m.mode!=="threshold"){out.push(_gl("krzywa ","curve ")+opt("mieCurve").toLowerCase());
    if(m.slew>0)out.push(_gl("wygładzanie ","smoothing ")+m.slew+" ms");}
  if(m.dest==="osc")out.push(opt("mieOscProf"));
  else out.push(m.midiCh>=1?_gl("kanał ","channel ")+m.midiCh:_gl("kanał z grupy","group channel"));
  return out.filter(Boolean).join(" · ");
}
// Ile pól „Dostrajania” odbiega od nowego mapowania (miDefaultMap). Liczy tylko pola, które dla
// tego celu w ogóle istnieją, więc licznik nie straszy zmianą, której nie widać.
function miTuneChanged(){
  const m=state._midiDraft;if(!m)return 0;
  const d=miDefaultMap(),isOsc=(m.dest==="osc"),isThr=(m.mode==="threshold"),isNote=(m.dest==="note");
  const k=["name"];
  if(!isThr)k.push("curve","curveFlip","slew","centered","deadzone");
  if(isOsc){k.push("oscProfile","oscRangeCustom","safeOnDisarm");if(isThr)k.push("oscEdge","pulseMs");else k.push("rateMs","maxRate","keepaliveMs");}
  else{k.push("midiCh","rateMs");if(isNote)k.push("velSource","velocity");if(isNote&&isThr)k.push("noteLatch");}
  const norm=v=>(v==null||v===false||v===0||v==="")?"":String(v);
  return k.filter(x=>norm(m[x])!==norm(d[x])).length;
}
function wireMidiEditor(){
  const m=state._midiDraft;if(!m)return;
  const g=id=>document.getElementById(id);
  const upd=()=>{
    m.name=(g("mieName").value||"").slice(0,40);
    if(g("mieMetric"))m.metric=g("mieMetric").value;
    if(g("mieCh"))m.ch=+g("mieCh").value;
    if(g("mieInLo"))m.inLo=+g("mieInLo").value;
    if(g("mieInHi"))m.inHi=+g("mieInHi").value;
    if(g("mieCmp"))m.cmp=(g("mieCmp").value==="<")?"<":">";
    if(g("mieThr"))m.threshold=+g("mieThr").value;
    if(g("mieAbs"))m.absVal=g("mieAbs").checked;
    if(g("mieCc"))m.cc=Math.max(0,Math.min(m.dest==="cc14"?95:127,+g("mieCc").value||0));
    if(g("mieProg"))m.prog=Math.max(0,Math.min(127,+g("mieProg").value||0));
    if(g("mieOutLo"))m.outLo=Math.max(0,Math.min(127,+g("mieOutLo").value||0));
    if(g("mieOutHi"))m.outHi=Math.max(0,Math.min(127,+g("mieOutHi").value||0));
    if(g("mieLoNote"))m.loNote=+g("mieLoNote").value;
    if(g("mieHiNote"))m.hiNote=+g("mieHiNote").value;
    if(g("mieNote"))m.note=+g("mieNote").value;
    if(g("mieNoteLatch"))m.noteLatch=g("mieNoteLatch").checked;
    if(g("mieVel"))m.velocity=Math.max(1,Math.min(127,+g("mieVel").value||100));
    if(g("mieVelSrc"))m.velSource=(g("mieVelSrc").value==="motion")?"motion":"fixed";
    if(g("mieAddr"))m.addr=(g("mieAddr").value||"").slice(0,80);
    if(typeof oscTargetFieldRead==="function")oscTargetFieldRead(m);   // do którego urządzenia OSC (rf-49e)
    if(g("mieOscProf")){const _pv=g("mieOscProf").value;m.oscProfile=MI_OSC_PROFILES.some(p=>p[0]===_pv)?_pv:"free";}
    if(g("mieRangeCust"))m.oscRangeCustom=g("mieRangeCust").checked;
    if(g("mieOscType")){const _ot=g("mieOscType").value;m.oscType=["float","floatrange","int","bool"].includes(_ot)?_ot:"float";}
    if(g("mieOutLoF")){const _lf=parseFloat(g("mieOutLoF").value);m.outLoF=isFinite(_lf)?_lf:0;}
    if(g("mieOutHiF")){const _hf=parseFloat(g("mieOutHiF").value);m.outHiF=isFinite(_hf)?_hf:1;}
    if(g("mieOscEdge")){const _ev=g("mieOscEdge").value;m.oscEdge=MI_OSC_EDGES.some(e=>e[0]===_ev)?_ev:"bang";}
    if(g("miePulse"))m.pulseMs=Math.max(20,Math.min(10000,+g("miePulse").value||200));
    // empty = "do not park" (null), which is exactly what safeOnDisarm means server-side
    if(g("mieSafe")){const _sv=g("mieSafe").value;const _sn=parseFloat(_sv);
      m.safeOnDisarm=(_sv===""||_sv==null||!isFinite(_sn))?null:_sn;}
    if(g("mieMidiCh")){const _mc=g("mieMidiCh").value;m.midiCh=(_mc===""||_mc==null)?0:Math.max(0,Math.min(16,+_mc||0));}
    if(g("mieSlew"))m.slew=Math.max(0,Math.min(500,+g("mieSlew").value||0));
    if(g("mieCentered"))m.centered=g("mieCentered").checked;
    if(g("mieDeadzone"))m.deadzone=Math.max(0,Math.min(30,+g("mieDeadzone").value||0));
    if(g("mieCurve")){const _cv=g("mieCurve").value;m.curve=MI_EASE[_cv]?_cv:"lin";}
    if(g("mieFlip"))m.curveFlip=g("mieFlip").checked;
    m.invert=g("mieInvert").checked;
    // guarded since the pace card only exists in continuous mode — in threshold mode the engine
    // sends on the edge and none of these three is read at all
    if(g("mieRate"))m.rateMs=Math.max(5,Math.min(1000,+g("mieRate").value||15));
    if(g("mieMaxRate")){const _mr=parseFloat(g("mieMaxRate").value);m.maxRate=(isFinite(_mr)&&_mr>0)?_mr:0;}
    if(g("mieKeep"))m.keepaliveMs=Math.max(0,Math.min(10000,+g("mieKeep").value||0));
    const pv=g("miePreview");if(pv){const o=state.midiOut[m.id];pv.textContent=o?("na żywo: "+miOutText(m,o)):"";}
    // the "what goes out" line follows every keystroke — it is the only place the user can
    // check the profile against the sketch on the other side without sending a packet
    const oh=g("mieOscHint");if(oh)oh.innerHTML=miOscHint(m);
    miDrawCurvePrev();   // no-op unless the curve or its flip actually changed
  };
  // Source/Target/Mode segments — changing rebuilds the form (dependent fields show/hide)
  const wireSeg=(segId,apply)=>{const s=g(segId);if(!s)return;
    s.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{apply(b.dataset.v);upd();renderMidiEditor();}));};
  // Filtr ↔ oś to zmiana JEDNOSTEK (stopnie ↔ surowe LSB), więc nie idzie przez wireSeg: tam
  // `upd()` biegnie PO `apply` i odczytałby z pól stary zakres z powrotem na szkic, kasując
  // przeliczenie. Kolejność musi być: przeczytaj pola → zmień źródło → przelicz → przebuduj.
  {const s=g("mieKindSeg");
   if(s)s.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
     upd();
     m.srcKind=(b.dataset.v==="axis"?"axis":"filter");
     if(typeof miLabRetune==="function")miLabRetune(m);
     renderMidiEditor();}));}
  // Picking a mode BY HAND is final — it clears the memory of the mode from before „Program". This
  // segment does not exist at all while the target is Program, so a click here always means intent.
  wireSeg("mieModeSeg",v=>{m.mode=(v==="threshold"?"threshold":"continuous");state._midiModeBefore=null;});
  // Rodzaj komunikatu MIDI — sześć pozycji; zmiana przebudowuje formularz (pola zależne). Selekta
  // NIE MA w edytorze OSC (tam protokół jest przesądzony zakładką), więc `g` zwraca tam null.
  {const ds=g("mieDest");if(ds)ds.addEventListener("change",()=>{
    const v=ds.value;m.dest=["cc","cc14","pitchbend","aftertouch","program","note"].indexOf(v)>=0?v:"cc";
    upd();                                             // read current fields BEFORE applying dest defaults
    // PROGRAM TAKES THE MODE AWAY, SO IT HAS TO GIVE IT BACK. Program Change is edge-triggered, so
    // picking it forces „Próg" and hides the mode switch. Without remembering the previous choice,
    // going back to a continuous target (CC 14-bit, say) handed the switch back with „Próg" still
    // selected and no curve — quietly turning a continuous mapping into a threshold one.
    if(m.dest==="program"){
      if(m.mode!=="threshold")state._midiModeBefore=m.mode;
      m.mode="threshold";
    }else if(state._midiModeBefore){
      m.mode=state._midiModeBefore;state._midiModeBefore=null;
    }
    if(m.dest==="pitchbend")m.centered=true;           // pitch bend defaults to centered (bipolar)
    if(m.dest==="note"){m.centered=false;m.deadzone=0;} // no bipolar UI here → clear orphaned centered/deadzone
    renderMidiEditor();});}
  // ŹRÓDŁO ZMIENIA JEDNOSTKI, WIĘC I ZAKRES. „Pochylenie 0–90" przełączone na „Oś ±16000" zostawiało
  // okno, w którym mapowanie jest zawsze nasycone. Jeżeli user zakresu nie tknął — przeliczamy po
  // cichu na domyślne nowego źródła; jeżeli tknął, jego liczby zostają, a chip nad polami mówi,
  // że nie pasują (i daje „Dopasuj"). Formularz przebudowujemy, bo zmieniają się podpisy jednostek.
  const _srcChanged=()=>{upd();
    if(typeof miLabRetune==="function")miLabRetune(m);
    renderMidiEditor();};
  ["mieMetric","mieCh"].forEach(id=>{const e=g(id);if(e)e.addEventListener("change",_srcChanged);});
  {const fx=g("mieRngFix");if(fx)fx.onclick=()=>{
    const d=(typeof miLabDefaults==="function")?miLabDefaults(m):null;
    if(d){m.inLo=d.inLo;m.inHi=d.inHi;m.threshold=(d.inLo+d.inHi)/2;renderMidiEditor();}};}
  ["mieName","mieMidiCh","mieInLo","mieInHi","mieThr","mieCc","mieProg","mieOutLo","mieOutHi","mieOutLoF","mieOutHiF","mieLoNote","mieHiNote","mieNote","mieVel","mieAddr","mieSlew","mieDeadzone","mieRate","miePulse","mieSafe"]
    .concat(["mieMaxRate","mieKeep"])
    .forEach(id=>{const e=g(id);if(e)e.addEventListener("input",upd);});
  ["mieCmp","mieCurve","mieLoNote","mieHiNote","mieNote"].forEach(id=>{const e=g(id);if(e)e.addEventListener("change",upd);});
  ["mieAbs","mieInvert","mieNoteLatch","mieFlip"].forEach(id=>{const e=g(id);if(e)e.addEventListener("change",upd);});
  // toggles / selects that reveal or hide dependent fields → rebuild
  {const c=g("mieCentered");if(c)c.addEventListener("change",()=>{upd();renderMidiEditor();});}
  {const ot=g("mieOscType");if(ot)ot.addEventListener("change",()=>{upd();renderMidiEditor();});}
  // Picking a profile WRITES the derived fields locally as well, so the (disabled) type and
  // range show the real numbers immediately instead of waiting for the server echo. The server
  // derives the same pair from the same table — see MI_OSC_PROFILES.
  {const pf=g("mieOscProf");if(pf)pf.addEventListener("change",()=>{
    upd();                                   // read the form BEFORE overwriting derived fields
    miApplyProfile(m);
    renderMidiEditor();});}
  // The custom-window switch re-derives the same way: ticking it keeps the device's span as the
  // starting window (so nothing jumps under the user), unticking it puts the full span back.
  {const rc=g("mieRangeCust");if(rc)rc.addEventListener("change",()=>{
    upd(); miApplyProfile(m); renderMidiEditor();});}
  {const oe=g("mieOscEdge");if(oe)oe.addEventListener("change",()=>{upd();renderMidiEditor();});}   // pulse reveals its duration field
  {const vs=g("mieVelSrc");if(vs)vs.addEventListener("change",()=>{upd();renderMidiEditor();});}   // fixed/motion → show/hide the numeric velocity
  g("mieSave").onclick=()=>{upd();saveMidiDraft();};
  {const cl=g("mieClone");if(cl)cl.onclick=()=>{upd();miCloneToOther();};}
  g("mieCancel").onclick=closeMidiEditor;
  {const hc=g("mieHeadClose");if(hc)hc.onclick=closeMidiEditor;}
  g("mieTest").onclick=()=>{upd();testMidiMap(m);};
  if(typeof miLabWire==="function")miLabWire(m,upd);   // laboratorium zakresu (rf-16c)
  miDrawCurvePrev();   // first draw of the curve preview once the form exists
}
// ── KOPIA NA DRUGĄ DROGĘ ─────────────────────────────────────────────────────────────────────
// Rozwijak „Cel" nie umie już PRZENIEŚĆ mapowania między MIDI a OSC — i o to chodziło: przenoszenie
// zabierało je z ekranu, na którym stał człowiek. Potrzeba brzmi zresztą inaczej niż „zmień drogę":
// ten sam ruch ma jechać DWIEMA drogami naraz (CC do DAW i adres na serwo). Przeniesienie nadal
// jest możliwe — to kopia plus kasowanie oryginału, czyli dwa świadome ruchy zamiast jednego
// niewidocznego skutku ubocznego.
//
// Wędruje wyłącznie połowa WEJŚCIOWA: źródło, okno, próg, krzywa, wygładzanie — ta dostrajana
// ręcznie i ta sama dla obu protokołów. Połowa wyjściowa jest z definicji inna (numer CC nie
// znaczy nic dla OSC, adres nie znaczy nic dla MIDI), więc wstaje z domyślnych.
const MI_CLONE_KEEP=["srcKind","ch","metric","mode","inLo","inHi","invert","absVal","cmp","threshold",
  "curve","curveFlip","curveN","curveBez","slew","rateMs"];
function miCloneToOther(){
  const src=state._midiDraft;if(!src)return;
  const toOsc=(src.dest!=="osc");
  const d={};MI_CLONE_KEEP.forEach(k=>{if(src[k]!==undefined)d[k]=src[k];});
  // W drugą stronę kopia ląduje na CC: to jedyny cel MIDI, który przyjmuje i ruch ciągły, i próg,
  // więc nigdy nie wymusza zmiany trybu przeniesionego z oryginału (Program umie tylko zbocze).
  d.dest=toOsc?"osc":"cc";
  // Adres startowy TAKI SAM jak przy „Nowe mapowanie OSC", a NIE `src.addr`. Mapowanie MIDI nosi
  // pole `addr` (sanitizer przepuszcza je każdemu), tyle że edytor MIDI go nie pokazuje — więc
  // przepisanie go do kopii wskrzeszałoby adres, którego nikt nie wpisał i nikt nie widział.
  // Zmierzone na żywym Settings: kopia mapowania CC dostawała w ten sposób „/cc1" z zamierzchłej
  // konfiguracji. Jeden przewidywalny punkt startu jest uczciwszy niż cudzy ślad.
  if(toOsc)d.addr="/fader1";
  const base=String(src.name||"").trim();
  if(base)d.name=base+(toOsc?" → OSC":" → MIDI");
  // Najpierw ZAPISZ to, co widać. Bez tego poprawka zrobiona w formularzu tuż przed klikiem
  // przechodziłaby do kopii, a z oryginału znikała bez słowa — edytor zamyka się na szkicu.
  saveMidiDraft();
  // Kopia NIE zapisuje się sama: otwiera się jako NOWE mapowanie w drugiej zakładce i czeka na
  // „✓ Dodaj mapowanie". Inaczej OSC zaczynałby wysyłać pod adres-atrapę „/fader1" w chwili kliku,
  // a MIDI pod CC 1 — czyli tam, gdzie nikt tego nie chciał.
  try{if(window.setTabById)window.setTabById(toOsc?"osc":"midi");}catch(e){}
  openMidiEditor(null,d);
  miFlash(toOsc?"Kopia jako mapowanie OSC — uzupełnij adres i zapisz"
               :"Kopia jako mapowanie MIDI — sprawdź numer CC i zapisz");
}
function saveMidiDraft(){
  const m=state._midiDraft;if(!m)return;
  const arr=state.midi.mappings||(state.midi.mappings=[]);
  const i=arr.findIndex(x=>x.id===m.id);
  const _isNew=(i<0);
  if(i>=0)arr[i]=m; else arr.push(m);
  state.midiEditing=null;   // unlock onMidiCfg (server echo)
  closeMidiEditor();renderMidiList();postMidi();
  // Mapowanie nie zmienia już protokołu pod ręką (rozwijak „Cel" niesie same komunikaty MIDI, a na
  // ekranie OSC go nie ma), więc zapis nie ma czym zaskoczyć i komunikat jest jeden.
  miFlash("Zapisano mapowanie ✓");
  // Animacja wejścia szuka wiersza w TEJ liście, w której mapowanie naprawdę wylądowało: OSC stoi
  // w #oscList, więc przy sztywnym #miList nowe mapowania OSC nie dostawały jej wcale.
  if(_isNew&&window.rfPopNew){const _ml=document.getElementById(m.dest==="osc"?"oscList":"miList");const _el=_ml&&_ml.querySelector('.mi-row[data-id="'+m.id+'"]');if(_el)window.rfPopNew(_el);}
}
// The OSC list labels and the editor's "what goes out" line are built with _gl() AT RENDER TIME,
// so a language switch has to re-render them. The i18n walker cannot do it on its own: those
// sentences are interleaved with <b> values, so it sees a handful of half-sentence text nodes
// and would translate whichever fragment happens to match a key — leaving the rest in Polish.
// Called from setLang() (rf-01), next to the other re-render hooks.
function miRelang(){
  try{renderMidiList();}catch(e){}
  try{if(typeof iologRelang==="function")iologRelang();}catch(e){}   // journal rows: _gl() at render time
  // The port status, the loopMIDI hint and the „LIVE" footer are all composed with _gl() at paint
  // time (the first two carry a port number, the third a host:port), so setLang's walk over the
  // tree cannot touch them — they have to be repainted, not translated.
  try{miFillTarget();}catch(e){}   // miFillTarget ends in miUpdateNote()
  const ed=document.getElementById("miEditor");
  if(ed&&ed.style.display!=="none"&&state._midiDraft){try{renderMidiEditor();}catch(e){}}
  try{if(typeof renderOverview==="function")renderOverview();}catch(e){}   // Overview cheat sheet prints the same labels (rf-11 overviewMidiHtml); setLang does not repaint it itself
}
function initMidi(){
  const g=id=>document.getElementById(id);
  // Both group switches go through the simulation gate (rf-39f): in that mode the first switch-on
  // is confirmed first, because MIDI/OSC leave the machine there exactly as they do on hardware.
  const _gate=(want,apply,grp)=>{if(typeof rfSimConfirmOn==="function")rfSimConfirmOn(want,apply,grp);else apply();};
  const en=g("miEnable");if(en)en.onclick=()=>{const w=!state.midi.enabled;_gate(w,()=>setMidiEnabled(w),"midi");};
  miReadyRegister();
  const oen=g("oscEnable");if(oen)oen.onclick=()=>{const w=!state.midi.oscEnabled;_gate(w,()=>setOscEnabled(w),"osc");};
  const oadd=g("oscAdd");if(oadd)oadd.onclick=()=>openMidiEditor(null,{dest:"osc",addr:"/fader1"});
  const pr=g("miPortRefresh");if(pr)pr.onclick=miLoadPorts;
  const sel=g("miPort");if(sel)sel.onchange=()=>{
    const idx=+sel.value;
    fetch("/midi/port",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({port:idx})})
      .then(r=>r.json()).then(m=>{if(m.port!=null)state.midiEnv.midiPort=m.port;state.midiEnv.midiActive=!!m.active;miFillTarget();})
      .catch(()=>{});
  };
  const oscApply=()=>{
    const host=(g("miOscHost").value||"127.0.0.1"),port=+g("miOscPort").value||9000;
    // THE SAME GATE THE RECEIVERS GET (rf-49e). The server takes any non-empty text as a host, so
    // a typo saved silently and only went quiet on the wire — and silence on the other end looks
    // exactly like a switched-off group.
    if(typeof oscAddrProblem==="function"){
      const bad=oscAddrProblem(host,g("miOscPort").value);
      if(bad){
        if(typeof rfToast==="function")rfToast(bad.msg,{tone:"danger"});
        const f=g(bad.field==="port"?"miOscPort":"miOscHost");
        if(f)try{f.focus();}catch(e){}
        return;
      }
    }
    fetch("/midi/osc",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({host,port})})
      .then(r=>r.json()).then(m=>{if(m.host)state.midiEnv.oscHost=m.host;if(m.port)state.midiEnv.oscPort=m.port;
        miFillTarget();if(typeof oscTargetsRender==="function")oscTargetsRender();}).catch(()=>{});
  };
  const oh=g("miOscHost"),op=g("miOscPort");
  if(oh)oh.addEventListener("change",oscApply);
  if(op)op.addEventListener("change",oscApply);
  const ch=g("miChannel");if(ch)ch.addEventListener("change",()=>{
    state.midi.midiChannel=Math.max(0,Math.min(15,(+ch.value||1)-1));renderMidiList();commitMidi();});
  const px=g("miOscPrefix");if(px)px.addEventListener("change",()=>{
    state.midi.oscPrefix=px.value||"/ribbitflip";renderMidiList();commitMidi();});
  // scale: root note + type
  const sr=g("miScaleRoot");
  if(sr){sr.innerHTML=MI_ROOTS.map((r,i)=>`<option value="${i}">${r}</option>`).join("");
    sr.value=String(state.midi.scaleRoot||0);
    sr.addEventListener("change",()=>{state.midi.scaleRoot=+sr.value||0;renderMidiList();commitMidi();});}
  const sc=g("miScale");
  if(sc){sc.innerHTML=MI_SCALES.map(x=>`<option value="${x[0]}">${x[1]}</option>`).join("");
    sc.value=state.midi.scale||"chromatic";
    sc.addEventListener("change",()=>{state.midi.scale=sc.value||"chromatic";renderMidiList();commitMidi();});}
  const add=g("miAdd");if(add)add.onclick=()=>openMidiEditor(null);
  const panic=g("miPanic");if(panic)panic.onclick=()=>{
    // PANIC ON A GROUP THAT IS OFF IS AN EMPTY GESTURE — and it should stay one. The server sends
    // All Notes Off regardless of the switch and writes „PANIKA · 0 kanałów · nie wysłano" into the
    // journal — a row in the very panel that promises, two lines below, that nothing lands there
    // while the group is Off. One of the two sentences had to stop being true; it is this one.
    if(!state.midi.enabled){
      const _t=_gl("Grupa MIDI wyłączona — nie ma czego uciszać","The MIDI group is off — there is nothing to silence");
      if(typeof rfToast==="function")rfToast(_t);else miFlash(_t);
      return;
    }
    fetch("/midi/panic",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})
      .then(r=>r.json()).then(()=>miFlash(_gl("MIDI panic — zatrzymano nuty","MIDI panic — notes stopped")))
      .catch(()=>miFlash(_gl("Serwer nieosiągalny","Server unreachable")));
  };
  miApplyAvail();miLoadPorts();miFetchState();
  miTierInit();
}
// PIĘTRA (UX 261120 L4c). Piętro 2: „Port MIDI i skala” (MIDI) i „Cel domyślny i odbiorniki” (OSC)
// pod listą mapowań, z bieżącymi wartościami w nagłówku. Piętro 3: „Zaawansowane” na dole ekranu.
let _miOutSync=null,_oscOutSync=null;
function miTierInit(){
  if(typeof rfTier!=="function")return;
  const g=id=>document.getElementById(id);
  _miOutSync=rfTier(g("miOutFold"),"midi.port",{sum:()=>{
    const env=state.midiEnv||{},p=((env.ports||[]).find(x=>x.i===env.midiPort)||{}).name;
    const sc=(MI_SCALES.find(x=>x[0]===(state.midi.scale||"chromatic"))||["",""])[1];
    return _gl("Port: ","Port: ")+(env.midiActive&&p?p:_gl("brak","none"))+" · "+_gl("kanał ","channel ")+((state.midi.midiChannel|0)+1)+
      " · "+_gl("skala ","scale ")+MI_ROOTS[state.midi.scaleRoot|0]+" "+(typeof _cvT==="function"?_cvT(sc):sc);},
    def:()=>({miChannel:"1",miScaleRoot:"0",miScale:"chromatic"})});
  _oscOutSync=rfTier(g("oscOutFold"),"osc.cel",{sum:()=>{
    const env=state.midiEnv||{},n=(typeof oscTargetsList==="function")?oscTargetsList().length:0;
    return (env.oscHost||"127.0.0.1")+":"+(env.oscPort||9000)+" · "+(state.midi.oscPrefix||"/ribbitflip")+
      (n?" · "+_gl("odbiorniki: ","receivers: ")+n:"");},
    def:()=>({miOscHost:"127.0.0.1",miOscPort:"9000",miOscPrefix:"/ribbitflip"})});
  rfTier(g("miAdv"),"midi.zaawansowane");
  rfTier(g("oscAdv"),"osc.zaawansowane");
}

