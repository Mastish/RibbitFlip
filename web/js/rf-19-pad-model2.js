"use strict";
// ---- multi-pad model: XPAD.pads = [instrument, …] (pads[0] = the main pad, uses #padCanvas).
//   Each instrument is a fully independent voice: own sound, axes, range/octaves, drag, glide,
//   effects (own audio bus), device (capsule) assignment, pointer + cursors + voices. -------------
let _padSeq=0;
function padAxOK(a){return PAD_AXES.some(x=>x[0]===a);}
function padCurOK(c){return c==="lin"||c==="exp"||c==="log";}   // per-axis musical response curve
// SAME NAMES AS MIDI/OSC, because it is the same question with the same maths behind it. The label
// „Krzywa X" over three options called „Liniowa / Precyzyjna / Czuła" sat two tabs away from the
// same label over eighteen options called „Liniowa / Precyzyjna (kwadrat) / Czuła (pierwiastek)…"
// (rf-16 MI_CURVES) — one word meaning two different exponents. The pad keeps its three (a pad is
// not a mapping editor), but they are now MIDI's three, formula included: t, t², √t.
// Third field = the formula, shown as the option's tooltip, exactly as the MIDI list does it.
const PAD_CURVE_OPTS=[["lin","Liniowa","t"],["exp","Precyzyjna (kwadrat)","t²"],["log","Czuła (pierwiastek)","√t"]];
// per-capsule mapping: each device assigned to a pad steers X/Y through ITS OWN axes + range + drag.
function devCfgDefault(on){return {on:on!==false,axX:"roll",axY:"pitch",range:45,drag:30,invX:false,invY:false,curX:"lin",curY:"lin"};}
// -------- pad gate model: {conds:[{source,cmp,threshold,thresholdHi?,neg,op}], rhythm:{on,type,bpm}} --------
function padGateDefault(){return {conds:[],rhythm:{on:false,type:"rhythm-8",bpm:120}};}
function gateCondDefault(){return {source:{kind:"filter",metric:"tilt",abs:false},cmp:">=",threshold:30,neg:false,op:"and"};}
function gateMapCondDefault(){return {source:{kind:"mapping",ref:""},cmp:">=",threshold:0,neg:false,op:"and"};}
// validate ONE condition (reject foreign shapes → null so a corrupt import can't crash the pad loop)
function _deGateCond(c){
  if(!c||typeof c!=="object")return null;
  const s=(c.source&&typeof c.source==="object")?c.source:{};
  let src;
  if(s.kind==="axis")src={kind:"axis",channel:Math.max(0,Math.min(5,s.channel|0)),abs:!!s.abs};
  else if(s.kind==="button")src={kind:"button",any:s.any!==false,byte:Math.max(1,Math.min(4,(s.byte|0)||1)),bit:Math.max(0,Math.min(7,s.bit|0))};
  else if(s.kind==="mapping")src={kind:"mapping",ref:(typeof s.ref==="string"?s.ref:"")};
  else src={kind:"filter",metric:GATE_METRIC_OK[s.metric]?s.metric:"tilt",abs:!!s.abs};
  const cmp=GATE_CMP_OK[c.cmp]?c.cmp:">=";
  const thr=Number.isFinite(+c.threshold)?+c.threshold:0;
  const out={source:src,cmp,threshold:thr,neg:!!c.neg,op:(c.op==="or"?"or":"and")};
  if(cmp==="in"||cmp==="out")out.thresholdHi=Number.isFinite(+c.thresholdHi)?+c.thresholdHi:thr;
  return out;
}
// migrate a legacy preset gate {type,thr,bpm} → the new manual model
function _migrateLegacyGate(g){
  const thr=+g.thr, bpm=(+g.bpm>=40&&+g.bpm<=220)?+g.bpm:120;
  const mk=(source,cmp,threshold)=>({source,cmp,threshold,neg:false,op:"and"});
  const out={conds:[],rhythm:{on:false,type:"rhythm-8",bpm}};
  switch(g.type){
    case "tilt-up":   out.conds.push(mk({kind:"filter",metric:"tilt",abs:false},">=",Number.isFinite(thr)?thr:30)); break;
    case "tilt-down": out.conds.push(mk({kind:"filter",metric:"tilt",abs:false},"<=",Number.isFinite(thr)?thr:30)); break;
    case "spin":      out.conds.push(mk({kind:"filter",metric:"twist",abs:true},">=",Number.isFinite(thr)?thr:180)); break;
    case "still":     out.conds.push(mk({kind:"filter",metric:"twist",abs:true},"<=",Number.isFinite(thr)?thr:180)); break;
    case "shake":     out.conds.push(mk({kind:"filter",metric:"motion",abs:false},">=",Number.isFinite(thr)?thr:35)); break;
    case "rhythm-4": case "rhythm-8": case "rhythm-16": case "offbeat": case "gallop": case "trance":
      out.rhythm.on=true; out.rhythm.type=g.type; break;
    default: break;   // "always" / unknown → no conditions, no rhythm
  }
  return out;
}
// validate/migrate a persisted pad gate
function _deGate(g){
  if(g&&typeof g==="object"&&!("conds"in g)&&("type"in g))return _migrateLegacyGate(g);   // legacy preset
  const conds=(g&&Array.isArray(g.conds))?g.conds.map(_deGateCond).filter(Boolean).slice(0,6):[];
  const rh=(g&&g.rhythm&&typeof g.rhythm==="object")?g.rhythm:{};
  const rhythm={on:!!rh.on,type:PAD_RHYTHM_BY_ID[rh.type]?rh.type:"rhythm-8",
    bpm:(+rh.bpm>=40&&+rh.bpm<=220)?+rh.bpm:120};
  return {conds,rhythm};
}
// serialize a pad gate → config-only shape
function _serGate(g){
  g=g||{};
  const conds=(Array.isArray(g.conds)?g.conds:[]).map(c=>{
    const s=c.source||{};
    const src=(s.kind==="axis")?{kind:"axis",channel:s.channel,abs:!!s.abs}
      :(s.kind==="button")?{kind:"button",any:s.any!==false,byte:s.byte,bit:s.bit}
      :(s.kind==="mapping")?{kind:"mapping",ref:s.ref||""}
      :{kind:"filter",metric:s.metric,abs:!!s.abs};
    const o={source:src,cmp:c.cmp,threshold:c.threshold,neg:!!c.neg,op:c.op==="or"?"or":"and"};
    if(c.cmp==="in"||c.cmp==="out")o.thresholdHi=c.thresholdHi;
    return o;
  });
  const rh=g.rhythm||{};
  return {conds,rhythm:{on:!!rh.on,type:rh.type||"rhythm-8",bpm:rh.bpm||120}};
}
function _deDevMap(raw,legacy){   // validate/migrate a dev map: id -> {on,axX,axY,range,drag}
  const out={};if(!raw||typeof raw!=="object")return out;
  const L=legacy||devCfgDefault();
  for(const id in raw){const v=raw[id];
    if(typeof v==="boolean")out[id]={on:v,axX:L.axX,axY:L.axY,range:L.range,drag:L.drag,
      invX:!!L.invX,invY:!!L.invY,curX:padCurOK(L.curX)?L.curX:"lin",curY:padCurOK(L.curY)?L.curY:"lin"};   // legacy config: a bare bool meant "on", with the pad-wide axes
    else if(v&&typeof v==="object")out[id]={on:v.on!==false,
      axX:padAxOK(v.axX)?v.axX:"roll",axY:padAxOK(v.axY)?v.axY:"pitch",
      range:(v.range>=15&&v.range<=180)?+v.range:45,drag:(v.drag>=0&&v.drag<=100)?+v.drag:30,
      invX:!!v.invX,invY:!!v.invY,curX:padCurOK(v.curX)?v.curX:"lin",curY:padCurOK(v.curY)?v.curY:"lin"};   // invert + curve per axis (missing → defaults)
  }
  return out;
}
// get-or-create a device's mapping config on a dev map (lazy default for freshly-connected capsules)
function padDevCfg(devMap,id,defOn){let c=devMap[id];if(!c||typeof c!=="object"){c=devCfgDefault(defOn);devMap[id]=c;}return c;}
// motion ON by default: a pad you have just added is an instrument the capsule should already be
// playing. It used to arrive silent, so with two pads on screen only the one whose switch you had
// found made any sound — and nothing said why. Silencing one pad is what the capsule's mute (and
// this same switch) are for; saved pads keep whatever they were saved with.
function padDefaults(){return {sound:"ribbit",motion:true,glideMode:"smooth",echo:true,vib:true,latch:false,momentum:false,velMotion:false,vol:70,
  // BACKGROUND: an audio-reactive WebGL plate under the pad (rf-24b, PAD_PLATES) and whether the scale
  // view (note columns, guides, note names) is drawn on top of it. "off" = the classic blue pad.
  plate:"staw",scaleView:true,frogView:true,
  // WHAT THE VERTICAL AXIS DOES. It always did two things at once — brightness and loudness — with
  // no way to say otherwise, and always across the parameter's full sweep. `yParam` picks the
  // target (see PAD_Y_TARGETS at the bottom of this file), `yLo`/`yHi` (percent) map the pad's
  // height onto that parameter's own span, so half a pad can cover a narrow useful band.
  // Defaults reproduce the old behaviour exactly.
  yParam:"both",yLo:0,yHi:100,
  base:48,oct:2,
  scale:(typeof state!=="undefined"&&state.midi&&state.midi.scale)||"chromatic",   // per-pad scale (each pad independent — no imposed global)
  scaleRoot:(typeof state!=="undefined"&&state.midi?((state.midi.scaleRoot|0)%12):0),
  gate:padGateDefault(),   // per-pad play gate — manual conditions (+ optional rhythm); see GATE_METRICS/PAD_RHYTHMS
  drag:30,        // drag = TOUCH pointer weight (each capsule has its own drag in dev[id])
  dev:{},                       // per-capsule mapping: id -> {on,axX,axY,range,drag}
  fx:{bright:1,hp:0,tremolo:0}, // per-pad MANUAL effect LEVEL (transparent defaults; effects pads steer live on top)
  fxOn:{bright:false,hp:false,tremolo:false}};}  // …and its ON/OFF switch — all OFF, because the default levels above are transparent anyway
// ---- manual pad effects: LEVEL (p.fx) + SWITCH (p.fxOn) -----------------------------------------
// FX_OFF_VAL = the TRANSPARENT value of each switchable effect — what the bus gets while the switch is
// OFF (bright: filter wide open, hp: no cut, tremolo: no modulation). These are exactly the values the
// sliders shipped with, so "every switch off" is bit-identical in sound to the build without switches.
const FX_OFF_VAL={bright:1,hp:0,tremolo:0};
function fxSwitchable(k){return Object.prototype.hasOwnProperty.call(FX_OFF_VAL,k);}
// validate/migrate the switch map. MISSING FIELD (config saved before switches existed, foreign import)
// → DERIVED from the stored level: a non-transparent level used to be audible, so it must stay audible → ON.
function _deFxOn(raw,fx){
  const o={},r=(raw&&typeof raw==="object")?raw:{};
  for(const k in FX_OFF_VAL){
    if(typeof r[k]==="boolean")o[k]=r[k];
    else{const v=+(fx&&fx[k]);o[k]=Number.isFinite(v)&&v!==FX_OFF_VAL[k];}
  }
  return o;
}
// is this manual effect ON? (defensive — a runtime pad from an older session may have no fxOn at all)
function padFxOn(inst,k){
  if(!inst||!fxSwitchable(k))return false;
  const on=inst.fxOn&&inst.fxOn[k];
  if(typeof on==="boolean")return on;
  const v=+(inst.fx&&inst.fx[k]);return Number.isFinite(v)&&v!==FX_OFF_VAL[k];
}
// value the bus must get: OFF → transparent, ON → the remembered slider level (kept across switching)
function padFxVal(inst,k){
  if(!fxSwitchable(k))return 0;
  if(!padFxOn(inst,k))return FX_OFF_VAL[k];
  const v=+(inst.fx&&inst.fx[k]);return Number.isFinite(v)?Math.max(0,Math.min(1,v)):FX_OFF_VAL[k];
}
function mkPad(cfg){
  cfg=cfg||{};
  const p=Object.assign(padDefaults(),cfg);   // cfg may carry undefined id/name — guard AFTER (undefined must not clobber)
  if(!p.id||typeof p.id!=="string")p.id="p"+(++_padSeq);
  if(!p.name||typeof p.name!=="string")p.name="Pad "+(String(p.id).replace(/\D/g,"")||"?");
  p.fx=Object.assign({bright:1,hp:0,tremolo:0},cfg.fx||{});
  p.fxOn=_deFxOn(cfg.fxOn,p.fx);   // switches (missing → derived from the levels, see _deFxOn)
  p.dev=(cfg.dev&&typeof cfg.dev==="object")?cfg.dev:{};   // already validated by padDe/_deDevMap
  // runtime (never persisted)
  p.ptr=null;p._ptrS=null;p._pid=null;p.latched=null;p.act={};p.devCur={};p.trail=[];p.ripples=[];p._cv=null;
  p._mom=null;p._ptrV=null;   // MOMENTUM runtime (never persisted): _mom={x,y,vx,vy,bounces} glide, _ptrV={vx,vy} tracked throw velocity
  return p;
}
function padSoundOK(s){return !!(PAD_PATCH[s]||(XPAD.customSounds&&XPAD.customSounds[s]));}
const XPAD={enabled:false,pads:[],customSounds:{},baseOverrides:{},   // baseOverrides: {baseId:{name?,emoji?,patch?}} — edits to the 23 built-ins (resolved first in padPatchFor)
  // NAZWA SCENY, którą syntezator nosi teraz ("" = ułożone ręcznie, nigdy nie zapisane pod nazwą —
  // zupełnie normalny stan). Stoi NA WIERZCHU stanu, a nie w treści, którą opisuje: dokładnie tak,
  // jak `configName` przy wyzwalaczach i myszy oraz `layoutName` przy nakładkach. Sama scena tego
  // pola NIE niesie (rf-49g wycina je z odcisku i z zapisu) — inaczej wczytanie sceny „Ambient pad"
  // pod inną nazwą robiłoby z niej natychmiast „zmienioną".
  configName:"",
  fxPads:[],_fxSeq:0,   // effects pads: [{id,xp,yp,target,dev:{},ptr,cur,_pid}] — a capsule can be on many; target = a play-pad id (or a programmed pad's)
  seqPads:[],_seqPadSeq:0,   // programmed pads (rf-25b): a written melody line or drum pattern that plays itself; no capsule steers it
  _hintOff:false,_fsOn:false,_syncT:0,_frogImgs:null,_font:null,_editingBase:null,_editSrcPatch:null};
// own-property guard — base ids/custom slugs are looked up as object keys, so never trust "__proto__"/"constructor"
const HAS=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
// effects-pad X/Y targets (label shown in the UI + used by PadAudio.setFxParam)
// „Przester" is a getter, not a string: the dictionary pair „Przester"→„Overdrive" belongs to the SOUND
// of that name (rf-01), while this parameter is „Drive" in English — one Polish word, two meanings.
// The i18n walker translates by key, so the label has to be composed with _gl() when it is READ
// (paint time; _gl lives in rf-24, which loads after this file), never stored as a fixed string.
// padLbl() unwraps the same trick in PAD_Y_TARGETS below.
const padLbl=l=>(typeof l==="function")?l():l;
const FX_PARAMS={echo:"Echo (mix)",bright:"Jasność",hp:"Cięcie basu",delay:"Echo — czas",fb:"Echo — sprzężenie",tremolo:"Tremolo",
  reverb:"Pogłos",get drive(){return _gl("Przester","Drive");},wah:"Wah (filtr)",pan:"Panorama"};
// ---- WHAT THE VERTICAL AXIS STEERS -------------------------------------------------------------
// The pad's height reached four things: brightness, loudness, vibrato, nothing. Everything else that
// gives a sound its character — resonance, attack, tail, detune, the filter's kick, overdrive — could
// be dialled in ONCE in the sound editor and then sat still while you played. These are those same
// parameters, now under the finger. Each target names ONE per-voice parameter (never a bus effect:
// two capsules on one pad are two voices with two different Y positions, and a bus is shared).
// Grouped, because past four entries a flat list stops reading as a list — the filter targets, the
// envelope ones and the thickening ones are three different questions.
//   [id, label, hint] — the hint is shown live under the select and names the sounds that ignore it.
const PAD_Y_TARGETS=[
  ["Barwa i filtr",[
    ["both","Jasność + głośność","Wyżej = jaśniej i głośniej naraz."],
    ["bright","Tylko jasność (barwa)","Wyżej = filtr otwiera się szerzej."],
    ["cutq","Jasność + rezonans","Wyżej = jaśniej i ostrzej — klasyczne przeciągnięcie filtra."],
    ["q","Rezonans filtra","Wyżej = mocniejsze podbicie przy odcięciu, aż do gwizdu."],
    ["fenv","Obwiednia filtra (kop na starcie)","Wyżej = mocniejszy kop filtra w chwili uderzenia. Słychać dopiero od NASTĘPNEJ nuty. Nie dotyczy 🌪 Szumu."]]],
  ["Głośność i czas",[
    ["vol","Tylko głośność","Wyżej = głośniej."],
    ["att","Atak (jak szybko wchodzi)","Wyżej = leniwiej narasta: z uderzenia robi się nabrzmiewanie. Słychać dopiero od NASTĘPNEJ nuty."],
    ["dec","Wybrzmienie (jak długo gaśnie)","Wyżej = dłuższy ogon. Przy szarpanych liczy się miejsce uderzenia, przy ciągłych — miejsce puszczenia."]]],
  ["Zagęszczenie",[
    ["det","Rozstrojenie (unison)","Wyżej = grubiej: dochodzi para rozstrojonych oscylatorów, na zerze zupełnie cicha. Nie dotyczy 🌪 Szumu."],
    ["vib","Wibrato","Wyżej = głębsze wibrato."],
    ["drive",()=>_gl("Przester","Drive"),"Wyżej = więcej brudu. Nie dotyczy 🌪 Szumu."]]]];   // label via padLbl() — see FX_PARAMS
// id → {label,hint}. "none" stands outside the groups (it is the absence of a target, not one of them).
const PAD_Y_META={none:{label:"Nic — Y nie zmienia dźwięku",hint:"Y nie rusza dźwięku — pad gra samą wysokością."}};
for(const g of PAD_Y_TARGETS)for(const it of g[1])PAD_Y_META[it[0]]={get label(){return padLbl(it[1]);},hint:it[2]};
function padYOK(v){return HAS(PAD_Y_META,v);}
