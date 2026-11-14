"use strict";
// ============ GATE — when a pad is allowed to sound (manual conditions, like key mappings) ============
//  A pad gate decides, per frame, whether the pad may sound. Instead of a fixed preset it holds a LIST of
//  manual conditions (source + comparison + threshold, combined left→right by AND/OR, each optionally
//  negated) PLUS an optional rhythmic gate (tempo-clock mask). Sensor sources read the pad's freshest
//  assigned capsule: orientation from its pose (tilt/twist/pitch/roll), motion energy, and — for the ACTIVE
//  slot only — raw CH0-5 + buttons (0x21). When the gate is CLOSED the pad's targets drop → every voice
//  gates off. With NO fresh capsule, sensor conditions are treated as satisfied so touch-only play never blocks.
const GATE_METRICS=[["tilt","Pochylenie","°",0,180],["twist","Obrót (twist)","°/s",-720,720],
  // pitch/roll ±90 (full lean of one axis) — same vocabulary as FILTER_METRICS in rf-10.
  ["pitch","Przechył przód/tył","°",-90,90],["roll","Przechył w bok","°",-90,90],["motion","Energia ruchu","",0,100]];
const GATE_METRIC_META=Object.fromEntries(GATE_METRICS.map(m=>[m[0],{label:m[1],unit:m[2],min:m[3],max:m[4]}]));
const GATE_METRIC_OK={tilt:1,twist:1,pitch:1,roll:1,motion:1};
const GATE_CMPS=[[">","> próg"],["<","< próg"],[">=","≥ próg"],["<=","≤ próg"],["in","w zakresie x..y"],["out","poza zakresem x..y"]];
const GATE_CMP_OK={">":1,"<":1,">=":1,"<=":1,"in":1,"out":1};
// rhythmic gate patterns (16th-note masks) — kept from the old preset gates, now an independent toggle
const PAD_RHYTHMS=[
  {id:"rhythm-4",  emoji:"🎵", label:"Ćwierćnuty",      pat:[1,0,0,0]},
  {id:"rhythm-8",  emoji:"🎶", label:"Ósemki",           pat:[1,0]},
  {id:"rhythm-16", emoji:"⚡", label:"Szesnastki",       pat:[1,1,1,0]},
  {id:"offbeat",   emoji:"🩴", label:"Na „i” (offbeat)", pat:[0,0,1,0]},
  {id:"gallop",    emoji:"🐎", label:"Galop",            pat:[1,0,1,1,0,1,1,0]},
  {id:"trance",    emoji:"🌫️", label:"Trans 3-3-2",      pat:[1,0,0,1,0,0,1,0]}
];
const PAD_RHYTHM_BY_ID={};for(const r of PAD_RHYTHMS)PAD_RHYTHM_BY_ID[r.id]=r;
// one instrument → its persisted (config-only) shape
function _serDevMap(dev){const o={};for(const id in (dev||{})){const c=dev[id];if(c&&typeof c==="object")
  o[id]={on:c.on!==false,axX:c.axX,axY:c.axY,range:c.range,drag:c.drag,
    invX:!!c.invX,invY:!!c.invY,curX:padCurOK(c.curX)?c.curX:"lin",curY:padCurOK(c.curY)?c.curY:"lin"};}return o;}
function padSer(p){return {id:p.id,name:p.name,sound:p.sound,motion:p.motion,glideMode:p.glideMode,plate:p.plate,scaleView:p.scaleView!==false,frogView:p.frogView!==false,
  echo:p.echo,vib:p.vib,latch:p.latch,momentum:p.momentum,velMotion:p.velMotion,vol:p.vol,base:p.base,oct:p.oct,scale:p.scale,scaleRoot:p.scaleRoot,
  yParam:p.yParam,yLo:p.yLo,yHi:p.yHi,
  gate:_serGate(p.gate),
  drag:p.drag,dev:_serDevMap(p.dev),fx:{bright:p.fx.bright,hp:p.fx.hp,tremolo:p.fx.tremolo},
  fxOn:{bright:padFxOn(p,"bright"),hp:padFxOn(p,"hp"),tremolo:padFxOn(p,"tremolo")}};}   // levels are kept even while a switch is OFF
// import one persisted instrument → a fresh runtime instrument (validated)
function padDe(s){
  if(!s||typeof s!=="object")s={};
  if(s.sound==="bell")s.sound="brass";                         // legacy patch rename
  if(s.sound==null||s.sound==="lead")s.sound="ribbit";         // adopt the frog voice as default
  const p=mkPad({
    id:(typeof s.id==="string"&&/^[A-Za-z0-9_-]+$/.test(s.id))?s.id:undefined,   // reject unsafe ids (used raw in [data-id] selectors)
    name:(typeof s.name==="string"&&s.name)?s.name:undefined,
    sound:padSoundOK(s.sound)?s.sound:"ribbit",
    motion:typeof s.motion==="boolean"?s.motion:false,
    glideMode:(s.glideMode==="hard"||s.glideMode==="smooth"||s.glideMode==="free")?s.glideMode:"smooth",
    // background plate + scale view: a save from before them has neither → the pond with the scale shown
    plate:typeof padPlateFix==="function"?padPlateFix(s.plate):"staw",   // removed plates → nearest one (rf-24b)
    scaleView:typeof s.scaleView==="boolean"?s.scaleView:true,
    frogView:typeof s.frogView==="boolean"?s.frogView:true,
    echo:typeof s.echo==="boolean"?s.echo:true, vib:typeof s.vib==="boolean"?s.vib:true,
    latch:typeof s.latch==="boolean"?s.latch:false,
    momentum:typeof s.momentum==="boolean"?s.momentum:false,   // optional — old saves lack it → false
    velMotion:typeof s.velMotion==="boolean"?s.velMotion:false, // optional — velocity-from-motion-energy (new notes)
    vol:(s.vol>=0&&s.vol<=100)?+s.vol:70,
    // an old save has none of these → the defaults are exactly what it used to do
    yParam:padYOK(s.yParam)?s.yParam:"both",   // unknown/foreign target → the historical "both"
    yLo:(s.yLo>=0&&s.yLo<=100)?+s.yLo:0, yHi:(s.yHi>=0&&s.yHi<=100)?+s.yHi:100,
    base:(s.base>=24&&s.base<=84)?+s.base:48,
    oct:(s.oct>=1&&s.oct<=4)?+s.oct:2,
    // per-pad scale — migrate old states (no scale key) to the former global scale so playback is unchanged
    scale:(PAD_PCS[s.scale]?s.scale:((state.midi&&state.midi.scale)||"chromatic")),
    scaleRoot:(s.scaleRoot>=0&&s.scaleRoot<=11)?+s.scaleRoot:(((state.midi&&state.midi.scaleRoot)|0)%12||0),
    gate:_deGate(s.gate),
    drag:(s.drag>=0&&s.drag<=100)?+s.drag:30,
    // per-capsule map; v3 dev was {id:bool} → migrate each entry to the pad's old shared axes/range/drag
    dev:_deDevMap(s.dev,{axX:padAxOK(s.axX)?s.axX:"roll",axY:padAxOK(s.axY)?s.axY:"pitch",
      range:(s.range>=15&&s.range<=180)?+s.range:45,drag:(s.drag>=0&&s.drag<=100)?+s.drag:30}),
    fx:{bright:(s.fx&&s.fx.bright>=0&&s.fx.bright<=1)?+s.fx.bright:1,
        hp:(s.fx&&s.fx.hp>=0&&s.fx.hp<=1)?+s.fx.hp:0,
        tremolo:(s.fx&&s.fx.tremolo>=0&&s.fx.tremolo<=1)?+s.fx.tremolo:0},
    // switches: absent in configs saved before this feature → mkPad/_deFxOn derives them from the levels
    // above, so an older pad keeps sounding exactly as it did (a dialled-in level stays audible).
    fxOn:(s.fxOn&&typeof s.fxOn==="object")?s.fxOn:null});
  return p;
}
// custom sounds: {slug:{name,emoji,patch:{…_mkVoice params…}}} → registered on padPatchFor
// coerce a (possibly foreign/corrupt) patch to finite, in-range params — a NaN AudioParam throws in
// _mkVoice and (without this) would kill the whole pad loop on a crafted/hand-edited import.
function sanitizePatch(raw){
  if(!raw||typeof raw!=="object")return null;
  const num=(v,d)=>{const n=+v;return Number.isFinite(n)?n:d;};
  const WV=["sine","triangle","sawtooth","square"];
  // "custom" = the user's own wave from the sound editor's wave panel (rf-25e, 2026-10-02): valid ONLY with exactly 64
  // samples `wt`; without them it falls back to the saw like any unknown wave, and `wt` is not emitted
  const wtOK=raw.wave==="custom"&&Array.isArray(raw.wt)&&raw.wt.length===64;
  const p={wave:wtOK?"custom":(WV.includes(raw.wave)?raw.wave:"sawtooth"),legato:!!raw.legato};
  if(raw.noise)p.noise=true;if(raw.croak)p.croak=true;if(raw.sub)p.sub=true;
  p.oct=Math.max(-3,Math.min(3,num(raw.oct,0)));
  p.det=Math.max(0,Math.min(60,num(raw.det,0)));
  p.att=Math.max(.001,Math.min(3,num(raw.att,.02)));
  if(raw.rel!=null)p.rel=Math.max(.01,Math.min(4,num(raw.rel,.2)));
  if(raw.dec!=null)p.dec=Math.max(.02,Math.min(6,num(raw.dec,.3)));
  if(raw.glide!=null)p.glide=Math.max(0,Math.min(1,num(raw.glide,0)));
  if(raw.fSwell!=null)p.fSwell=Math.max(0,Math.min(2,num(raw.fSwell,0)));
  if(raw.am!=null)p.am=Math.max(1,Math.min(120,num(raw.am,29)));
  p.fMin=Math.max(20,Math.min(20000,num(raw.fMin,200)));
  p.fMax=Math.max(p.fMin+20,Math.min(22000,num(raw.fMax,6000)));
  p.q=Math.max(.1,Math.min(24,num(raw.q,1)));
  p.lvl=Math.max(.02,Math.min(.9,num(raw.lvl,.4)));
  // — expanded vocabulary (every default = feature-off + conditional-emit → existing _v4 sounds round-trip byte-identically) —
  if(raw.sus!=null)p.sus=Math.max(0,Math.min(1,num(raw.sus,1)));                                  // legato sustain level (1 = old flat hold)
  if(raw.filt&&["highpass","bandpass","notch"].includes(raw.filt))p.filt=raw.filt;                // lowpass = default → omitted
  if(raw.osc2){p.osc2=true;                                                                        // 2nd oscillator layer
    p.osc2wave=WV.includes(raw.osc2wave)?raw.osc2wave:"sawtooth";
    p.osc2semi=Math.round(Math.max(-24,Math.min(24,num(raw.osc2semi,0))));
    p.osc2det=Math.max(-60,Math.min(60,num(raw.osc2det,0)));
    p.osc2mix=Math.max(0,Math.min(1,num(raw.osc2mix,.5)));}
  if(raw.fEnv!=null&&num(raw.fEnv,0)!==0){p.fEnv=Math.max(-1,Math.min(1,num(raw.fEnv,0)));         // filter envelope amount (±) + its A/D time
    p.fEnvT=Math.max(.005,Math.min(4,num(raw.fEnvT,.2)));}
  if(raw.drive!=null&&num(raw.drive,0)>0)p.drive=Math.max(0,Math.min(1,num(raw.drive,0)));         // per-patch soft-clip drive
  if(wtOK)p.wt=Array.from(raw.wt,v=>Math.round(Math.max(-1,Math.min(1,num(v,0)))*1000)/1000);            // custom wave: 64 samples −1..1, 3 places
  // the sound's own equaliser (rf-25e Korektor, 2026-10-02): up to 4 peaking bands {f, g, q}. Only an array of objects
  // whose f, g, q are finite NUMBERS (a band with anything else is dropped, not guessed: null would read as 0 Hz);
  // f 20–20000 Hz (whole Hz), g ±24 dB (1 place), q 0.1–24 (2 places). Emitted only with ≥1 band left, after `wt`.
  if(Array.isArray(raw.eq)){const eq=[],fin=v=>typeof v==="number"&&Number.isFinite(v);
    for(const b of raw.eq){if(eq.length>=4)break;if(!b||typeof b!=="object"||!fin(b.f)||!fin(b.g)||!fin(b.q))continue;
      eq.push({f:Math.round(Math.max(20,Math.min(20000,b.f))),g:Math.round(Math.max(-24,Math.min(24,b.g))*10)/10,
               q:Math.round(Math.max(.1,Math.min(24,b.q))*100)/100});}
    if(eq.length)p.eq=eq;}
  // the envelope's curvature (rf-25e Obwiednia, 2026-10-02): [attack, decay, release], −1..1 (2 places); 0 = the
  // shape a sound without bends plays (exponential), .5 = a straight segment. Only an array of exactly three finite
  // NUMBERS (anything else is dropped whole, not guessed); emitted only when one of them bends, after `eq` — all three
  // at 0 is no key, so a sound without curves stays byte-identical.
  if(Array.isArray(raw.envC)&&raw.envC.length===3&&raw.envC.every(v=>typeof v==="number"&&Number.isFinite(v))){
    const c=raw.envC.map(v=>Math.round(Math.max(-1,Math.min(1,v))*100)/100||0);   // ||0: −0 → 0
    if(c.some(v=>v!==0))p.envC=c;}
  // WŁASNA PRÓBKA (Biblioteka dźwięków › Próbka, rf-25f, 2026-10-19). Patch niesie sam IDENTYFIKATOR: bajty leżą
  // w Library/Probki/<id>.wav, bo stan syntezatora ma 500 kB limitu, a jedna próbka to kilkaset kB. `smpSr` i `smpLen`
  // są tu po to, żeby formularz umiał narysować pętlę ZANIM bajty dojadą z serwera (a strój i pętlę trzyma patch, więc
  // dwa brzmienia mogą dzielić jedne bajty i mieć swoje ustawienia). `smpLoop` w SEKUNDACH; bez niego próbka gra raz.
  // Emitowane wyłącznie przy poprawnym `smp`, więc brzmienie bez próbki zapisuje się bajt w bajt jak dotąd.
  if(typeof raw.smp==="string"&&/^s-[a-z0-9]{1,16}$/.test(raw.smp)){
    p.smp=raw.smp;
    // Próbka ZASTĘPUJE oscylatory, więc nie da się jej połączyć z szumem ani z rechotem: w `_mkVoice` oba mają
    // własną gałąź przed nią i po cichu by ją przykryły. Formularz odznacza je przy wczytaniu próbki; tu jest
    // to samo dla patcha z ręcznie zrobionego pliku, żeby „mam próbkę, a słyszę szum" nie było w ogóle możliwe.
    delete p.noise;delete p.croak;delete p.am;
    p.smpSr=Math.max(8000,Math.min(96000,Math.round(num(raw.smpSr,32000))));
    p.smpLen=Math.max(0,Math.min(96000*20,Math.round(num(raw.smpLen,0))));
    p.smpRoot=Math.max(12,Math.min(108,Math.round(num(raw.smpRoot,60)*2)/2));
    if(Array.isArray(raw.smpLoop)&&raw.smpLoop.length===2){
      const a=Math.max(0,num(raw.smpLoop[0],0)),b=num(raw.smpLoop[1],0);
      if(b>a)p.smpLoop=[Math.round(a*1e4)/1e4,Math.round(b*1e4)/1e4];}
    // WIĘCEJ KONTROLI NAD PRÓBKĄ (2026-10-20). Sześć nastaw, które do dziś były decyzją programu, a nie człowieka:
    // wycinek (`smpOd`, `smpDo` w sekundach od początku bajtów), dostrojenie w centach, poziom, kierunek, zlepek
    // szwu pętli i „nie przestrajaj”. Wszystkie EMITOWANE TYLKO PRZY WARTOŚCI INNEJ NIŻ DOMYŚLNA, więc brzmienie
    // z próbką zapisane przed tą zmianą wychodzi z `sanitizePatch` bajt w bajt takie samo (warunek: odcisk sceny).
    // `smpDo` znika też wtedy, gdy sięga końca próbki — „do końca” to brak klucza, nie liczba, bo przycięcie
    // bajtów na stałe zmienia długość, a wycinek ma wtedy dalej znaczyć całość.
    const smpDl=(p.smpLen>0&&p.smpSr>0)?p.smpLen/p.smpSr:0;
    const smpOd=Math.max(0,Math.min(smpDl||20,num(raw.smpOd,0)));
    if(smpOd>1e-4)p.smpOd=Math.round(smpOd*1e4)/1e4;
    const smpDo=num(raw.smpDo,0);
    if(smpDo>smpOd+1e-3&&(!smpDl||smpDo<smpDl-1e-4))p.smpDo=Math.round(Math.min(smpDl||20,smpDo)*1e4)/1e4;
    const cent=Math.round(Math.max(-50,Math.min(50,num(raw.smpCent,0))));
    if(cent)p.smpCent=cent;
    const poz=Math.max(.1,Math.min(2,Math.round(num(raw.smpPoziom,1)*100)/100));
    if(poz!==1)p.smpPoziom=poz;
    if(raw.smpWstecz===true)p.smpWstecz=true;
    const zlep=Math.max(0,Math.min(.2,Math.round(num(raw.smpZlep,0)*1e4)/1e4));
    if(zlep>0)p.smpZlep=zlep;
    if(raw.smpStaly===true)p.smpStaly=true;
  }
  return p;
}
function customSoundsSer(){const o={};for(const k in (XPAD.customSounds||{})){if(k.slice(0,2)==="__")continue;   // skip transient preview
  const c=XPAD.customSounds[k];o[k]={name:c.name,emoji:c.emoji,patch:c.patch};}return o;}
// base overrides → persisted shape (only real base ids with at least one override field)
function baseOverridesSer(){const o={};for(const k in (XPAD.baseOverrides||{})){if(!HAS(PAD_PATCH,k))continue;
  const c=XPAD.baseOverrides[k];if(!c)continue;const rec={};
  if(c.name)rec.name=c.name;if(c.emoji)rec.emoji=c.emoji;if(c.patch)rec.patch=c.patch;
  if(rec.name||rec.emoji||rec.patch)o[k]=rec;}return o;}
function padState(){return {_v:5,enabled:XPAD.enabled,
  configName:XPAD.configName||"",   // nazwa sceny — na wierzchu stanu, poza samą sceną (patrz XPAD w rf-19)
  pads:XPAD.pads.map(padSer),
  customSounds:customSoundsSer(),
  baseOverrides:baseOverridesSer(),
  fxPads:XPAD.fxPads.map(p=>({id:p.id,xp:p.xp,yp:p.yp,target:p.target,capsel:p.capsel||"",dev:_serDevMap(p.dev),drag:p.drag,plate:p.plate,scaleView:p.scaleView!==false})),
  seqPads:(XPAD.seqPads||[]).map(seqPadSer),
  seqBpm:XPAD.seqBpm,seqSwing:XPAD.seqSwing};}   // one tempo for every programmed pad (rf-25b transport)
// SEKCJA `pad` DO ZESTAWU TYLKO WTEDY, GDY SYNTH JEST W TEJ KARCIE NAPRAWDĘ WCZYTANY. Bez modułu
// Synth (edycja Essential, `--disable synth`, karta „Moduły wyłączone przy starcie") `initPad` nie
// rusza i XPAD zostaje pustym szkieletem, więc `padState()` zwraca syntezator bez ani jednego pada.
// Zestaw zapisany z takim `pad` kasował pady, pady efektów i własne brzmienia każdemu, kto go
// wczytał z włączonym Synthem. Każdy zapis, eksport i migawka zestawu bierze więc sekcję przez tę
// funkcję: niewczytany = `undefined` (JSON.stringify pomija klucz), a brak `pad` przy wczytaniu
// znaczy „nie ruszaj Syntha" (wszystkie drogi wczytania mają `if(x.pad)`). `_loaded` stawia
// `padLoad` — pierwszy krok wczytania w `initPad`, także w harnessach bez rf-20b.
function padStateIfLoaded(){
  return (XPAD._loaded&&Array.isArray(XPAD.pads)&&XPAD.pads.length)?padState():undefined;}
// Czy sekcja `pad` z pliku niesie syntezator: co najmniej jeden pad albo stary płaski stan (v2),
// czyli to samo, co `padApplyState` uznaje za pady. Pusta tablica to ślad zapisu bez Syntha.
function padBlobHasPads(b){
  if(!b||typeof b!=="object")return false;
  if(Array.isArray(b.pads))return b.pads.length>0;
  return b.sound!=null||b.axX!=null||b.base!=null||b.padDev!=null;}
// DWA MIEJSCA, w których stan syntezatora ląduje, i to jest celowe:
//   • localStorage — natychmiastowe, działa bez serwera i jest tym, co czytamy, zanim odpowie
//     serwer (żeby pętla dźwięku nigdy nie zastała pustego modelu),
//   • Settings/ribbitflip_synth.json — ŹRÓDŁO PRAWDY, wspólne dla każdej przeglądarki na tej
//     maszynie i objęte kopią katalogu ustawień. Wysyłką zajmuje się rf-20b (debounce ~0,8 s,
//     bo `padSave` woła się przy KAŻDYM ruchu suwaka).
// Wywołanie przez `typeof`, bo rf-20b ładuje się PO tym pliku, a w harnessach nie ma go wcale.
function padSave(){try{localStorage.setItem("ribbitflip.pad",JSON.stringify(padState()));}catch(e){}
  try{if(typeof padStoreQueue==="function")padStoreQueue();}catch(e){}}
function padApplyState(s){
  if(!s||typeof s!=="object")s={};
  // PRZEŁĄCZNIK RUSZAMY TYLKO WTEDY, GDY STAN COŚ O NIM MÓWI. Scena go NIE niesie (rf-49g wycina
  // `enabled` przed zapisem — dźwięk uzbraja człowiek przy przełączniku, nie plik), więc wczytanie
  // sceny musi zostawić bieżące ustawienie w spokoju. Ten `typeof` był tu od początku i to on
  // trzyma tę zasadę — nie upraszczać go do `XPAD.enabled=!!s.enabled`.
  if(typeof s.enabled==="boolean")XPAD.enabled=s.enabled;
  // Nazwa sceny. Nieobecna (scena, stary zapis) = syntezator przestaje twierdzić, że coś nosi;
  // rf-49g nadaje ją z powrotem zaraz po wczytaniu sceny. Przycięcie jak każda inna nazwa
  // konfiguracji w tej aplikacji (jedna linia, 40 znaków — `_synth_scene_name` po stronie serwera).
  XPAD.configName=(typeof s.configName==="string")?s.configName.replace(/\s+/g," ").trim().slice(0,40):"";
  // custom sounds first (so pad.sound validation can find them)
  XPAD.customSounds={};
  if(s.customSounds&&typeof s.customSounds==="object")for(const k in s.customSounds){
    if(k.slice(0,2)==="__")continue;
    const c=s.customSounds[k];const patch=c&&sanitizePatch(c.patch);
    if(patch)XPAD.customSounds[k]={name:(c.name||k),emoji:(c.emoji||"🎛"),patch};}
  // base-sound overrides (edits to the 23 built-ins) — only real base ids, sanitized; absent key ⇒ {} ⇒ byte-identical playback
  XPAD.baseOverrides={};
  if(s.baseOverrides&&typeof s.baseOverrides==="object")for(const k in s.baseOverrides){
    if(!HAS(PAD_PATCH,k))continue;                                  // drop junk / __proto__ / unknown ids
    const c=s.baseOverrides[k];if(!c||typeof c!=="object")continue;const rec={};
    if(c.patch){const sp=sanitizePatch(c.patch);if(sp)rec.patch=sp;}
    if(typeof c.name==="string"&&c.name.trim())rec.name=c.name.trim().slice(0,24);
    if(typeof c.emoji==="string"&&c.emoji.trim())rec.emoji=c.emoji.trim().slice(0,8);
    if(rec.patch||rec.name||rec.emoji)XPAD.baseOverrides[k]=rec;}
  // pads (v3+ array). v2 (single flat pad) migrates → pads[0].
  // Seed the id counter to the highest existing numeric id BEFORE mapping so a regenerated id
  // (for a missing/unsafe id) can't collide with a sibling's literal id.
  _padSeq=(Array.isArray(s.pads)?s.pads:[]).reduce((m,x)=>{const n=(x&&typeof x.id==="string")?parseInt(x.id.replace(/\D/g,"")):0;return Math.max(m,isFinite(n)?n:0);},_padSeq);
  let pads=[];
  if(Array.isArray(s.pads)&&s.pads.length)pads=s.pads.map(padDe);
  else if(s.sound!=null||s.axX!=null||s.base!=null||s.padDev!=null){   // legacy v2 flat pad
    const leg=padDe(Object.assign({},s,{dev:(s.padDev&&typeof s.padDev==="object")?s.padDev:{}}));
    pads=[leg];
  }
  // a fresh synth: the first pad plays the major pentatonic, so a first try has no "wrong" notes (saved pads keep theirs)
  if(!pads.length)pads=[mkPad({scale:"pentatonic_major"})];
  // dedupe ids (crafted/foreign state could carry literal duplicates) → distinct audio bus per pad
  {const seen=new Set();for(const p of pads){if(seen.has(p.id))p.id="p"+(++_padSeq);seen.add(p.id);}}
  XPAD.pads=pads;
  _padSeq=XPAD.pads.reduce((m,p)=>Math.max(m,parseInt(String(p.id).replace(/\D/g,""))||0),_padSeq);
  // programmed pads — BEFORE the fx pads, because an fx pad may target one of them.
  // The old list stops first: its clock reads XPAD.seqPads, so a replaced pad must not keep ticking.
  for(const q of (XPAD.seqPads||[]))q.playing=false;
  XPAD.seqPads=seqPadsDe(s.seqPads);
  // the section's tempo. Before 2026-09-30 every pad had its own; a scene saved then adopts the FIRST
  // pad's tempo and swing for all, so what plays first sounds the way it was written
  {const n=(v,lo,hi)=>{v=+v;return (Number.isFinite(v)&&v>=lo&&v<=hi)?v:null;};
    const q0=(Array.isArray(s.seqPads)&&s.seqPads[0]&&typeof s.seqPads[0]==="object")?s.seqPads[0]:{};
    const b=n(s.seqBpm,40,240),w=n(s.seqSwing,0,60),b0=n(q0.bpm,40,240),w0=n(q0.swing,0,60);
    // ...and a scene with only a chopping pad (its rhythm had its own tempo until 2026-10-01) keeps that one
    const rp=(XPAD.pads||[]).find(p=>p.gate&&p.gate.rhythm&&p.gate.rhythm.on),b1=rp?n(rp.gate.rhythm.bpm,40,240):null;
    XPAD.seqBpm=b!=null?b:(b0!=null?b0:(b1!=null?b1:110));
    XPAD.seqSwing=w!=null?w:(w0!=null?w0:0);}
  // effects pads
  if(Array.isArray(s.fxPads)){XPAD.fxPads=s.fxPads.filter(p=>p&&p.id).map((p,i)=>({
    id:(/^[A-Za-z0-9_-]+$/.test(String(p.id)))?String(p.id):("fximp"+i),
    xp:FX_PARAMS[p.xp]?p.xp:"echo",yp:FX_PARAMS[p.yp]?p.yp:"bright",
    target:(typeof p.target==="string"?p.target:null),
    // single driving capsule (or "" = touch). Migrate an older multi-capsule fx → first assigned capsule.
    capsel:(typeof p.capsel==="string")?p.capsel:(function(){if(p.dev&&typeof p.dev==="object")for(const id in p.dev){const v=p.dev[id];if(v===true||(v&&v.on!==false))return id;}return "";})(),
    // capsule mapping map; v3 fx dev was {id:bool} → migrate with the fx pad's old shared tilt/twist axes
    dev:_deDevMap(p.dev,{axX:padAxOK(p.axX)?p.axX:"tilt",axY:padAxOK(p.axY)?p.axY:"twist",
      range:(p.range>=15&&p.range<=180)?+p.range:45,drag:(p.drag>=0&&p.drag<=100)?+p.drag:40}),
    drag:(p.drag>=0&&p.drag<=100)?+p.drag:40,
    plate:typeof padPlateFix==="function"?padPlateFix(p.plate):"staw",   // removed plates → nearest one (rf-24b)
    scaleView:typeof p.scaleView==="boolean"?p.scaleView:true,
    ptr:null,cur:{x:.5,y:.5},_pid:null,_dstamp:{}}));
    XPAD._fxSeq=XPAD.fxPads.reduce((m,p)=>Math.max(m,parseInt(String(p.id).replace(/\D/g,""))||0),0);
    {const seen=new Set();for(const fp of XPAD.fxPads){if(seen.has(fp.id))fp.id="fx"+(++XPAD._fxSeq);seen.add(fp.id);}}}   // dedupe crafted ids
  else XPAD.fxPads=[];
  // resolve fx-pad targets to a real pad (default = main)
  const ids=new Set(XPAD.pads.map(p=>p.id).concat(XPAD.seqPads.map(p=>p.id)));
  for(const fp of XPAD.fxPads)if(!fp.target||!ids.has(fp.target))fp.target=XPAD.pads[0].id;
}
// PODRĘCZNA KOPIA Z PRZEGLĄDARKI. Od rf-20b to jest tylko PIERWSZY krok wczytywania: źródłem
// prawdy jest plik po stronie aplikacji, a to jest podłoga, żeby pętla dźwięku nie zastała pustego
// modelu przez te kilka milisekund, które trwa pytanie do serwera (patrz `padLoadAsync`).
function padLoad(){try{padApplyState(JSON.parse(localStorage.getItem("ribbitflip.pad")||"{}"));}catch(e){padApplyState({});}
  XPAD._loaded=true;}   // stan Syntha jest w tej karcie (patrz padStateIfLoaded)
// find an instrument by id — a play pad or a programmed pad (fallback = main pad).
// It was called `padById`, and rf-44 (the game-controller hub, loaded later) declares a global of the
// SAME name for its own pads. The later one won, so every effects pad asked the controller list for
// "p1", got null and steered nothing. The synth side now has a name nobody else uses.
function synthInstById(id){return XPAD.pads.find(p=>p.id===id)||(XPAD.seqPads||[]).find(p=>p.id===id)||XPAD.pads[0];}
// ---- programmed pads: persisted shape + validation (runtime lives in rf-25b) ----
const SEQ_KINDS={mel:1,drum:1};
const SEQ_DRUM_ROWS=8;
function seqPadSer(p){return {id:p.id,name:p.name,kind:p.kind,sound:p.sound,vol:p.vol,echo:p.echo,tone:p.tone,
  steps:p.steps,base:p.base,oct:p.oct,scale:p.scale,scaleRoot:p.scaleRoot,
  notes:p.notes.map(n=>({note:n.note,start:n.start,len:n.len}))};}
function seqPadDe(s,i){
  if(!s||typeof s!=="object")s={};
  const num=(v,lo,hi,d)=>{v=+v;return (Number.isFinite(v)&&v>=lo&&v<=hi)?v:d;};
  const kind=SEQ_KINDS[s.kind]?s.kind:"mel";
  const steps=(+s.steps===32)?32:16;
  const p={id:(typeof s.id==="string"&&/^[A-Za-z0-9_-]+$/.test(s.id))?s.id:("q"+(++XPAD._seqPadSeq)),
    name:(typeof s.name==="string"&&s.name.trim())?s.name.trim().slice(0,24):((typeof _gl==="function"?_gl("Pad zaprogramowany ","Programmed pad "):"Pad zaprogramowany ")+((i|0)+1)),
    kind,sound:padSoundOK(s.sound)?s.sound:"marimba",
    vol:num(s.vol,0,100,70),echo:s.echo===true,tone:num(s.tone,0,100,65),
    steps,   // tempo + swing are the section's now (XPAD.seqBpm / seqSwing, read in padApplyState)
    base:num(s.base,24,84,60),oct:num(s.oct,1,3,1),
    scale:PAD_PCS[s.scale]?s.scale:"major",scaleRoot:num(s.scaleRoot,0,11,0)|0,
    notes:[]};
  const maxNote=kind==="drum"?SEQ_DRUM_ROWS-1:127;
  if(Array.isArray(s.notes))for(const n of s.notes.slice(0,512)){
    if(!n||typeof n!=="object")continue;
    const note=Math.round(+n.note),start=Math.round(+n.start),len=Math.round(+n.len)||1;
    if(!(note>=0&&note<=maxNote&&start>=0&&start<steps))continue;
    p.notes.push({note,start,len:kind==="drum"?1:Math.max(1,Math.min(steps-start,len))});}
  return seqPadRuntime(p);
}
// runtime fields shared by a loaded and a freshly added pad. The manual bus effects are switched ON at
// their transparent levels: the card has no sliders for them, and "off" would make the bypass rule in
// PadAudio.setFxParam swallow whatever an effects pad asks of brightness, bass cut or tremolo.
function seqPadRuntime(p){
  p.fx={bright:1,hp:0,tremolo:0};p.fxOn={bright:true,hp:true,tremolo:true};
  p.glideMode="smooth";p.vib=false;p.yParam="both";
  p.playing=false;p.pos=-1;p.sounding={};p.hits=[];p._cv=null;p._pid=null;p._drag=null;
  return p;
}
function seqPadsDe(list){
  if(!Array.isArray(list))return [];
  XPAD._seqPadSeq=list.reduce((m,x)=>{const n=(x&&typeof x.id==="string")?parseInt(x.id.replace(/\D/g,"")):0;return Math.max(m,isFinite(n)?n:0);},XPAD._seqPadSeq|0);
  const out=list.slice(0,16).map(seqPadDe);
  const seen=new Set();for(const p of out){if(seen.has(p.id))p.id="q"+(++XPAD._seqPadSeq);seen.add(p.id);}
  return out;
}

// --- audio engine (lazy AudioContext; one voice PER SOURCE: "ptr", "dev:d0", "dev:d1", …)
// resolve a pad's sound → a patch object (built-in or user custom)
function padPatchFor(sound){
  const ov=XPAD.baseOverrides;
  if(ov&&HAS(ov,sound)&&ov[sound]&&ov[sound].patch)return ov[sound].patch;   // 1. edited base wins
  if(HAS(PAD_PATCH,sound))return PAD_PATCH[sound];                            // 2. frozen built-in default
  const cs=XPAD.customSounds;
  if(cs&&HAS(cs,sound)&&cs[sound]&&cs[sound].patch)return cs[sound].patch;    // 3. user custom sound
  return PAD_PATCH.lead;                                                       // 4. never-undefined tail
}
