"use strict";
// ===== PROGRAMMED PADS — a written melody line or drum pattern that plays itself =====
// Sits between the two pads the Synth already had: a PLAY pad is a hand (finger or capsule) making
// notes live, an EFFECTS pad turns knobs on some instrument's bus. A programmed pad is the note grid
// from the sound lab's test loop grown into an instrument of its own — its own sound, tempo, bus and
// frogs — that plays on its own. No capsule drives it; an effects pad may target it like any play pad.
//   Model + persistence: rf-20 (seqPadSer / seqPadDe / seqPadRuntime), stored in padState().seqPads.
//   A note is {note, start, len}: `note` is a MIDI pitch on a melodic pad and a KIT ROW on a drum pad.
//   len 1 = a separate (re-struck) note, len > 1 = one held note — the same rule as the test loop.

// drum kit, TOP to BOTTOM as drawn; a drum note's `note` is the index here (SEQ_DRUM_ROWS in rf-20)
const SEQ_DRUM_KIT=[
  {id:"hato", name:"Hi-hat otwarty", col:"#c9a227"},
  {id:"hatc", name:"Hi-hat",         col:"#d8b43a"},
  {id:"clap", name:"Klask",          col:"#e0703a"},
  {id:"rim",  name:"Rimshot",        col:"#b8864a"},
  {id:"tomH", name:"Tom wysoki",     col:"#4f9fd0"},
  {id:"tomL", name:"Tom niski",      col:"#3a7fb0"},
  {id:"snare",name:"Werbel",         col:"#ec1a83"},
  {id:"kick", name:"Stopa",          col:"#6cb33f"}];
const SEQ_MEL_COL="#ec1a83";
// presets: a whole pattern, kind included. "drums" turns the pad into a drum machine.
const SEQ_PRESETS={
  melody:{label:"🎵 Melodia — przykład",apply(p){
    Object.assign(p,{kind:"mel",sound:padSoundOK("marimba")?"marimba":"lead",base:60,oct:1,scale:"major",scaleRoot:0,steps:16});
    p.notes=[[60,0,2],[64,2,1],[67,3,1],[72,4,2],[71,6,1],[67,7,1],[69,8,2],[65,10,1],[69,11,1],[67,12,3],[64,15,1]]
      .map(a=>({note:a[0],start:a[1],len:a[2]}));}},
  drums:{label:"🥁 Perkusja — rytm",apply(p){
    Object.assign(p,{kind:"drum",steps:16});
    const row=id=>SEQ_DRUM_KIT.findIndex(k=>k.id===id),n=[];
    const put=(id,steps)=>{for(const st of steps)n.push({note:row(id),start:st,len:1});};
    put("kick",[0,3,8,10]);put("snare",[4,12]);put("clap",[12]);put("hatc",[0,2,4,6,8,10,12]);
    put("hato",[14]);put("rim",[7]);put("tomH",[13]);put("tomL",[15]);
    p.notes=n;}}};

function seqRowsOf(p){
  if(p.kind==="drum")return SEQ_DRUM_KIT.map((k,i)=>i);
  return padNotes({base:p.base,oct:p.oct,scale:p.scale,scaleRoot:p.scaleRoot}).slice().reverse();   // high on top
}
function _seqEndOf(p,n){return Math.min(n.start+n.len-1,p.steps-1);}
function _seqNoteAtP(p,note,step){return p.notes.find(n=>n.note===note&&step>=n.start&&step<=_seqEndOf(p,n))||null;}

// ===================== sound =====================
// Melodic notes go through PadAudio like every other instrument (the pad IS an instrument: id, sound,
// vol, echo, fx). Drums have no patch — they are built here from oscillators and noise, straight into
// the pad's own bus, so its volume, echo and every effects-pad parameter apply to them too.
function _seqNoiseBuf(){
  if(PadAudio._seqNoise)return PadAudio._seqNoise;
  const c=PadAudio.ctx,len=c.sampleRate,b=c.createBuffer(1,len,c.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  return PadAudio._seqNoise=b;
}
function seqDrumHit(p,id,vel){
  if(!PadAudio.ensure())return;PadAudio.resume();
  const bus=PadAudio.bus(p);if(!bus)return;
  const c=PadAudio.ctx,t=c.currentTime+.004,nodes=[];let end=t+.1;
  const out=c.createGain();out.gain.value=vel==null?.9:vel;out.connect(bus.master);out.connect(bus.send);nodes.push(out);
  const env=(g,peak,dec)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+.002);
    g.gain.exponentialRampToValueAtTime(.0008,t+.002+dec);};
  const osc=(type,f0,f1,dur,peak)=>{const o=c.createOscillator(),g=c.createGain();o.type=type;
    o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur*.55);
    env(g,peak,dur);o.connect(g);g.connect(out);o.start(t);o.stop(t+dur+.05);nodes.push(o,g);end=Math.max(end,t+dur+.1);};
  const noise=(type,freq,q,dur,peak)=>{const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    s.buffer=_seqNoiseBuf();f.type=type;f.frequency.value=freq;f.Q.value=q;env(g,peak,dur);
    s.connect(f);f.connect(g);g.connect(out);s.start(t);s.stop(t+dur+.05);nodes.push(s,f,g);end=Math.max(end,t+dur+.1);return g;};
  // a closed hat (or another open one) chokes a ringing open hat — how a real hi-hat behaves
  if((id==="hatc"||id==="hato")&&p._openHat){try{const g=p._openHat;g.gain.cancelScheduledValues(t);g.gain.setTargetAtTime(0,t,.008);}catch(e){}p._openHat=null;}
  if(id==="kick"){osc("sine",165,44,.42,1);noise("highpass",3200,.7,.012,.22);}
  else if(id==="snare"){osc("triangle",205,150,.11,.45);noise("highpass",1500,.7,.17,.7);}
  else if(id==="clap"){   // three quick slaps and a short room: the classic machine clap
    const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=_seqNoiseBuf();
    f.type="bandpass";f.frequency.value=1350;f.Q.value=.9;g.gain.setValueAtTime(0,t);
    for(const d of [0,.011,.022]){g.gain.setValueAtTime(.85,t+d);g.gain.exponentialRampToValueAtTime(.12,t+d+.009);}
    g.gain.setValueAtTime(.6,t+.031);g.gain.exponentialRampToValueAtTime(.0008,t+.23);
    s.connect(f);f.connect(g);g.connect(out);s.start(t);s.stop(t+.26);nodes.push(s,f,g);end=Math.max(end,t+.3);}
  else if(id==="hatc")noise("highpass",7500,.7,.045,.42);
  else if(id==="hato")p._openHat=noise("highpass",7000,.7,.34,.36);
  else if(id==="tomL")osc("sine",120,72,.34,.85);
  else if(id==="tomH")osc("sine",190,122,.26,.8);
  else if(id==="rim"){osc("triangle",1750,0,.035,.5);osc("square",820,0,.028,.16);}
  setTimeout(()=>{for(const n of nodes)try{n.disconnect();}catch(e){}},Math.max(60,(end-c.currentTime)*1000+120));
  if(typeof _padWake==="function")_padWake();
}
// a short note for the ear while drawing or clicking a row name (only when the pad is not playing)
function _seqAudition(p,note){
  if(!XPAD.enabled)return;
  if(p.kind==="drum"){const k=SEQ_DRUM_KIT[note];if(k)seqDrumHit(p,k.id,.8);return;}
  const src="aud:"+note;PadAudio.gateOn(p,src,note,(p.tone|0)/100);
  (p._aud||(p._aud={}))[note]=performance.now()+220;   // its sideways piano key shows pressed meanwhile
  setTimeout(()=>PadAudio.gateOff(p,src),220);
  if(typeof _padWake==="function")_padWake();
}

// ===================== clock =====================
// ONE TRANSPORT for every programmed pad (owner, 2026-09-30: "they should share one tempo — now they
// can drift apart"). Each pad used to carry its own tempo and its own "next step at" time, so two pads
// at different tempos walked apart, and even at the same tempo a stall re-seated one pad and not the
// other. Now tempo and swing belong to the section (XPAD.seqBpm / seqSwing), there is one step counter
// and one next-step time, and a pad's position is just that counter modulo its own length: a 16-step
// and a 32-step pattern stay locked bar for bar, and a pad started later drops into the running bar.
// Swing stretches the gap after an even 16th and shortens the one after an odd one (the test loop's
// rule). A stall longer than a quarter second (hidden tab, a busy frame) re-seats the WHOLE transport
// on "now" instead of firing a burst of late steps.
const SEQ_BPM_DEF=110;
function seqBpm(){const v=+XPAD.seqBpm;return (v>=40&&v<=240)?v:SEQ_BPM_DEF;}
function seqSwing(){const v=+XPAD.seqSwing;return (v>=0&&v<=60)?v:0;}
function _seqStepMs(afterTick){const base=60000/seqBpm()/4,sw=seqSwing()/100;
  return base*((afterTick%2===0)?(1+sw):(1-sw));}
function _seqRunning(){return (XPAD.seqPads||[]).some(p=>p.playing);}
// The same transport drives the synth pads' rhythm gate ("Rytm — tnij dźwięk w tempie", rf-22): a
// chopping pad that is sounding keeps it alive (`rfClockNeed`, plus 2 s of grace so lifting a finger
// between notes does not restart the bar), and every step reaches `padRhythmStep` right after the
// programmed pads' notes, so the chop and the drums change on the very same step.
const RF_RH_GRACE=2000;
function _rhAlive(now){return !!XPAD.enabled&&XPAD._rhLast>0&&now-XPAD._rhLast<RF_RH_GRACE;}
function rfBeatTick(){return XPAD._seqTick>=0?XPAD._seqTick:0;}
function rfClockNeed(now){
  XPAD._rhLast=now;
  if(XPAD._seqClockT)return;
  if(!_seqRunning()){XPAD._seqTick=0;XPAD._seqNext=now+_seqStepMs(0);}   // nothing playing -> the bar starts here
  XPAD._seqClockT=setTimeout(_seqClock,6);
}
function _seqClock(){
  XPAD._seqClockT=null;
  const list=(XPAD.seqPads||[]).filter(p=>p.playing);
  const now=performance.now();
  if(!list.length&&!_rhAlive(now)){XPAD._seqTick=-1;return;}
  if(now>=XPAD._seqNext){
    if(now-XPAD._seqNext>250)XPAD._seqNext=now;
    XPAD._seqTick=(XPAD._seqTick>=0?XPAD._seqTick:-1)+1;
    for(const p of list)_seqStep(p,now);
    if(typeof padRhythmStep==="function")padRhythmStep(now);
    XPAD._seqNext+=_seqStepMs(XPAD._seqTick);
  }
  XPAD._seqClockT=setTimeout(_seqClock,6);
}
// start the transport from the top (step 0 fires on the next clock pass)
function _seqTransportReset(){XPAD._seqTick=-1;XPAD._seqNext=performance.now();}
function _seqClockKick(){if(!XPAD._seqClockT)_seqClock();}
function _seqStep(p,now){
  p.pos=XPAD._seqTick%p.steps;
  const stepMs=60000/seqBpm()/4;
  if(p.kind==="drum"){
    for(const n of p.notes)if(n.start===p.pos){const k=SEQ_DRUM_KIT[n.note];if(!k)continue;
      seqDrumHit(p,k.id,.9);_seqHit(p,n,stepMs,now);}
    return;
  }
  // melodic: which note (if any) covers each visible pitch now. A note whose row is gone (scale or
  // range changed) stays in the pattern but does not play — what you see is what you hear.
  const rows=new Set(seqRowsOf(p)),cover={};
  for(const n of p.notes)if(rows.has(n.note)&&n.start<=p.pos&&p.pos<=_seqEndOf(p,n))cover[n.note]=n;
  const pitches=new Set();for(const k in cover)pitches.add(+k);for(const k in p.sounding)pitches.add(+k);
  for(const pitch of pitches){const cur=cover[pitch],snd=p.sounding[pitch];
    if(cur){   // a new segment re-strikes; the same segment continuing is a held note
      if(!snd||snd.ref!==cur){if(snd)PadAudio.gateOff(p,"seq:"+pitch);
        PadAudio.gateOn(p,"seq:"+pitch,pitch,(p.tone|0)/100);p.sounding[pitch]={ref:cur};_seqHit(p,cur,stepMs,now);}}
    else if(snd){PadAudio.gateOff(p,"seq:"+pitch);delete p.sounding[pitch];}
  }
}
// a note just started → a frog pops up on it (drawn by seqPadsDraw)
function _seqHit(p,n,stepMs,now){p.hits.push({n,t:now,step:stepMs});if(p.hits.length>64)p.hits.splice(0,p.hits.length-64);}

function seqPadPlay(p){
  if(!p||p.playing)return;
  if(!XPAD.enabled)return;   // the module switch gates every sound in the Synth
  PadAudio.resume();
  // a running transport → join it on its current step (the next clock pass plays the next one);
  // nothing running → this pad starts the transport from the top
  if(_seqRunning())p.pos=XPAD._seqTick>=0?XPAD._seqTick%p.steps:-1;
  else{_seqTransportReset();p.pos=-1;}
  p.playing=true;p.sounding={};p._openHat=null;
  _seqClockKick();seqReflect();
  if(typeof _padWake==="function")_padWake();
}
function seqPadStop(p){
  if(!p)return;p.playing=false;p.pos=-1;p.sounding={};p._openHat=null;p.hits=[];
  PadAudio.gateOffPad(p);seqReflect();
}
function seqStopAll(){for(const p of (XPAD.seqPads||[]))if(p.playing)seqPadStop(p);}
function seqToggleAll(){
  const list=XPAD.seqPads||[];if(!list.length)return;
  if(list.some(p=>p.playing)){seqStopAll();return;}
  if(!XPAD.enabled)return;
  PadAudio.resume();
  _seqTransportReset();   // one transport → they step together from the top
  for(const p of list){p.playing=true;p.sounding={};p.pos=-1;p._openHat=null;}
  _seqClockKick();seqReflect();
  if(typeof _padWake==="function")_padWake();
}
function seqReflect(){
  for(const p of (XPAD.seqPads||[])){
    const card=document.querySelector('.seqpad[data-id="'+p.id+'"]');if(!card)continue;
    const b=card.querySelector(".sq-play");if(!b)continue;
    b.classList.toggle("on",p.playing);b.textContent=p.playing?_gl("⏹ Zatrzymaj","⏹ Stop"):_gl("▶ Graj","▶ Play");
    card.classList.toggle("is-playing",p.playing);
  }
  const all=document.getElementById("seqAllBtn");
  if(all){const any=_seqRunning();
    all.classList.toggle("on",any);all.textContent=any?_gl("⏹ Zatrzymaj wszystkie","⏹ Stop all"):_gl("▶ Graj wszystkie","▶ Play all");}
}

// ===================== drawing =====================
function _seqGeom(p,W,H){
  // melodic: a sideways piano key (SEQ_KEY_W) + the note name; drums: a coloured dot + the drum's name
  const rows=seqRowsOf(p),lw=p.kind==="drum"?Math.min(112,Math.max(78,W*.16)):SEQ_KEY_W+36;
  return {rows,lw,cw:(W-lw)/p.steps,rh:H/rows.length};
}
// A PIANO KEYBOARD TURNED SIDEWAYS in the label column (owner, 2026-09-30: "klawisze keyboarda bokiem jak
// to syntezatory mają w zwyczaju"). The rows are the notes of the scale, not all twelve, so every row
// draws its own key: a white key whose front faces the grid, and on a sharp's row a black key lying on
// top at the back (left). A key goes down (pink) while its note sounds or while it is auditioned.
const SEQ_KEY_W=44;
function _seqDrawKeys(x,p,rows,rh,now){
  const kw=SEQ_KEY_W,aud=p._aud||{};
  for(let r=0;r<rows.length;r++){const note=rows[r],y0=r*rh,sharp=[1,3,6,8,10].includes(((note%12)+12)%12);
    const down=!!(p.sounding&&p.sounding[note])||(aud[note]||0)>now;
    // the white key (under a black one too: the black key lies on the white keys around it)
    _seqRRect(x,-6,y0+.5,kw+6,rh-1,Math.min(5,rh/3));
    const g=x.createLinearGradient(0,0,kw,0);
    if(down&&!sharp){g.addColorStop(0,"#f7c9dd");g.addColorStop(.7,"#ffe3ef");g.addColorStop(1,"#f9d3e3");}
    else{g.addColorStop(0,"#efe8d8");g.addColorStop(.7,"#fffdf7");g.addColorStop(1,"#f4eee0");}
    x.fillStyle=g;x.fill();x.strokeStyle="rgba(150,125,80,.55)";x.lineWidth=1;x.stroke();
    if(sharp){const bw=Math.round(kw*.62),m=Math.max(1.5,rh*.14);
      _seqRRect(x,-6,y0+m,bw+6,rh-2*m,Math.min(4,rh/4));
      const b=x.createLinearGradient(0,0,bw,0);
      if(down){b.addColorStop(0,"#a4105c");b.addColorStop(.8,"#ec1a83");b.addColorStop(1,"#b3136a");}
      else{b.addColorStop(0,"#2b2926");b.addColorStop(.8,"#454139");b.addColorStop(1,"#2f2c28");}
      x.fillStyle=b;x.fill();}}
  x.lineWidth=1;
}
function _seqRowLabel(p,note){return p.kind==="drum"?_cvT(SEQ_DRUM_KIT[note].name):miNoteName(note);}
function _seqRowCol(p,note){return p.kind==="drum"?SEQ_DRUM_KIT[note].col:SEQ_MEL_COL;}
function _seqRRect(x,x0,y0,w,h,r){r=Math.min(r,w/2,h/2);x.beginPath();x.moveTo(x0+r,y0);x.arcTo(x0+w,y0,x0+w,y0+h,r);
  x.arcTo(x0+w,y0+h,x0,y0+h,r);x.arcTo(x0,y0+h,x0,y0,r);x.arcTo(x0,y0,x0+w,y0,r);x.closePath();}
// how loud the pad is right now, 0..1 — RMS of the wave on its bus, divided by the volume slider
// (a quiet pad must still sing wide), on a dB scale: -42 dB → closed, -14 dB → wide open
function _seqMeasure(p,dt){
  const bus=PadAudio.buses&&PadAudio.buses[p.id];
  if(!bus||!PadAudio.ctx){p._lvl=0;p._vgMax=0;return;}
  if(!bus._seqAn){try{const an=PadAudio.ctx.createAnalyser();an.fftSize=512;bus.master.connect(an);bus._seqAn=an;}catch(e){p._lvl=0;return;}}
  const an=bus._seqAn,buf=an._fb||(an._fb=new Float32Array(an.fftSize));an.getFloatTimeDomainData(buf);
  let s=0;for(let i=0;i<buf.length;i++)s+=buf[i]*buf[i];
  const rms=Math.sqrt(s/buf.length)/Math.max(.02,bus.master.gain.value);
  const db=20*Math.log10(rms+1e-6),lv=Math.max(0,Math.min(1,(db+42)/28));
  p._lvl=(p._lvl||0)+(lv-(p._lvl||0))*Math.min(1,dt/30);
  // loudest note envelope among the pad's sounding voices — each frog's share of the pad's level
  // a sound with envelope bends (rf-21 `env`, Obwiednia) keeps g at its level and shapes the note on v.env — multiply
  let m=0;for(const k in bus.voices){const v=bus.voices[k];if(v&&v.g&&!v.stopped)m=Math.max(m,v.g.gain.value*(v.env?v.env.gain.value:1));}p._vgMax=m;
}
function _seqVoiceGain(p,note){const bus=PadAudio.buses[p.id],v=bus&&bus.voices["seq:"+note];
  if(v&&v.g&&!v.stopped)return v.g.gain.value*(v.env?v.env.gain.value:1);
  // released voice → it sits in the tail pool / is fading; treat as silent share
  return 0;}
function seqPadsDraw(){for(const p of (XPAD.seqPads||[]))_seqDrawOne(p);}
function _seqDrawOne(p){
  const cv=p._cv;if(!cv||!cv.clientWidth||cv.offsetParent===null)return;
  const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  const x=cv.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);
  const g=_seqGeom(p,W,H),{rows,lw,cw,rh}=g,now=performance.now();
  x.fillStyle="#f6f1e5";x.fillRect(0,0,W,H);
  // rows: sharps a shade darker on a melodic pad (reads like a keyboard), plain stripes on drums
  for(let r=0;r<rows.length;r++){const note=rows[r],sharp=p.kind!=="drum"&&[1,3,6,8,10].includes(((note%12)+12)%12);
    if(sharp||r%2===1){x.fillStyle=sharp?"rgba(120,100,60,.10)":"rgba(120,100,60,.045)";x.fillRect(lw,r*rh,W-lw,rh);}}
  // playhead column
  if(p.playing&&p.pos>=0){x.fillStyle="rgba(255,226,54,.38)";x.fillRect(lw+p.pos*cw,0,cw,H);}
  // grid: every step thin, every beat (4 steps) stronger
  x.lineWidth=1;
  for(let s=0;s<=p.steps;s++){x.strokeStyle=s%4===0?"rgba(120,100,60,.30)":"rgba(120,100,60,.12)";
    const gx=Math.round(lw+s*cw)+.5;x.beginPath();x.moveTo(gx,0);x.lineTo(gx,H);x.stroke();}
  x.strokeStyle="rgba(120,100,60,.12)";
  for(let r=1;r<rows.length;r++){const gy=Math.round(r*rh)+.5;x.beginPath();x.moveTo(lw,gy);x.lineTo(W,gy);x.stroke();}
  // label column
  x.fillStyle="#efe6d3";x.fillRect(0,0,lw,H);
  if(!XPAD._font)XPAD._font="10px "+(getComputedStyle(document.body).fontFamily||"sans-serif");
  const fs=Math.max(9,Math.min(13,rh*.5));
  x.font=XPAD._font.replace(/^\d+px/,Math.round(fs)+"px");x.textAlign="left";x.textBaseline="middle";
  if(p.kind!=="drum")_seqDrawKeys(x,p,rows,rh,now);
  for(let r=0;r<rows.length;r++){const note=rows[r];
    if(p.kind==="drum"){x.fillStyle=_seqRowCol(p,note);x.beginPath();x.arc(9,(r+.5)*rh,3.5,0,Math.PI*2);x.fill();}
    x.fillStyle="rgba(70,58,35,.85)";x.fillText(_seqRowLabel(p,note),p.kind==="drum"?17:SEQ_KEY_W+5,(r+.5)*rh);}
  // notes
  const rowOf={};rows.forEach((n,i)=>{rowOf[n]=i;});
  const pad=Math.max(1.5,Math.min(4,rh*.14));
  for(const n of p.notes){const r=rowOf[n.note];if(r==null)continue;
    const end=_seqEndOf(p,n),x0=lw+n.start*cw+pad,w=(end-n.start+1)*cw-pad*2,y0=r*rh+pad,h=rh-pad*2;
    const live=p.playing&&p.pos>=n.start&&p.pos<=end;
    _seqRRect(x,x0,y0,w,h,Math.min(7,h/2.4));
    x.globalAlpha=live?1:.78;x.fillStyle=_seqRowCol(p,n.note);x.fill();x.globalAlpha=1;
    if(live){x.strokeStyle="rgba(53,53,52,.85)";x.lineWidth=1.6;x.stroke();x.lineWidth=1;}}
  // singing frogs on the notes being played. A struck note: the frog pops up with its mouth wide
  // open and closes as the note fades. A held note: the frog walks along it with the playhead,
  // mouth open, and only closes when the note ends.
  const dt=Math.max(1,Math.min(100,now-(p._drawT||now)));p._drawT=now;
  _seqMeasure(p,dt);
  if(p.hits.length){
    const rm=_prefersReducedMotion(),keep=[];
    for(const h of p.hits){
      const r=rowOf[h.n.note];if(r==null)continue;
      const age=now-h.t,dur=h.n.len*h.step,life=Math.max(dur,230)+240;
      if(age>life||age<0)continue;keep.push(h);
      const held=h.n.len>1;
      // a held note: the frog glides along the note with time (continuous, not a hop per step),
      // from the centre of its first cell to the centre of its last
      const col=h.n.start+(held?Math.min(h.n.len-1,Math.max(0,age/h.step)):0);
      const cx=lw+(col+.5)*cw,cy=(r+.5)*rh;
      const size=Math.max(22,Math.min(64,rh*1.6,cw*1.7));
      let sc=1;if(!rm)sc=age<110?.55+.65*(1-Math.pow(1-age/110,2)):1.2-.2*Math.min(1,(age-110)/160);
      // the mouth SINGS the sound: its opening follows the loudness actually coming out of the pad
      // (small wave → "o", big wave → "O", the frames between on the way), shared between the notes
      // sounding together by their own envelope. Smoothed and with hysteresis on the frame index,
      // so a single note glides through the frames instead of flickering between them.
      let tgt=p._lvl||0;
      if(p.kind!=="drum"){const vg=_seqVoiceGain(p,h.n.note);tgt*=p._vgMax>0?Math.min(1,vg/p._vgMax):0;}
      else if(age>Math.max(dur,90))tgt*=Math.max(0,1-(age-Math.max(dur,90))/200);   // a drum frog closes once its hit is over
      if(age>=dur&&p.kind!=="drum")tgt=Math.min(tgt,Math.max(0,1-(age-dur)/260));
      if(h.o==null){h.o=0;h.f=0;}
      h.o+=(tgt-h.o)*(tgt>h.o?Math.min(1,dt/45):Math.min(1,dt/130));   // opens fast, closes softly
      // frame = which fifth of the range the mouth is in, but it only moves on once the value is
      // clearly past the border (±0.15 of a frame) — no flicker when the sound hovers on one
      const v=Math.max(0,Math.min(1,h.o))*5;
      if(v>h.f+1.15)h.f=Math.min(4,Math.floor(v-.15));else if(v<h.f-.15)h.f=Math.max(0,Math.floor(v+.15));
      x.globalAlpha=Math.max(0,Math.min(1,(life-age)/200));
      padFrog(x,cx,cy,(h.f+.5)/5,size*sc,h.n.note*1.7+h.n.start,true,_seqRowCol(p,h.n.note),false);
      x.globalAlpha=1;
    }
    p.hits=keep;
  }
}

// ===================== editing on the canvas =====================
// press an empty cell → a new note (on a melodic pad, drag sideways = one longer held note; on a
// drum pad, drag paints hits along the row) · press a note → erase it (drag erases more) ·
// press a row name → hear that row.
function _seqBindPointer(cv,p){
  p._cv=cv;p._pid=null;p._drag=null;
  const at=e=>{const rc=cv.getBoundingClientRect(),g=_seqGeom(p,rc.width,rc.height);
    const px=e.clientX-rc.left,py=e.clientY-rc.top;
    const r=Math.max(0,Math.min(g.rows.length-1,Math.floor(py/g.rh)));
    return {label:px<g.lw,note:g.rows[r],step:Math.max(0,Math.min(p.steps-1,Math.floor((px-g.lw)/g.cw)))};};
  cv.addEventListener("contextmenu",e=>e.preventDefault());
  cv.addEventListener("pointerdown",e=>{
    if(e.pointerType==="mouse"&&e.button!==0)return;if(p._pid!=null)return;e.preventDefault();
    PadAudio.resume();
    const h=at(e);
    if(h.label){_seqAudition(p,h.note);return;}
    const hit=_seqNoteAtP(p,h.note,h.step);
    if(hit){p.notes=p.notes.filter(n=>n!==hit);p._drag={mode:"erase"};}
    else{const nt={note:h.note,start:h.step,len:1};p.notes.push(nt);
      p._drag=p.kind==="drum"?{mode:"paint",row:h.note}:{mode:"draw",note:nt,row:h.note,anchor:h.step};
      if(!p.playing)_seqAudition(p,h.note);}
    p._pid=e.pointerId;try{cv.setPointerCapture(e.pointerId);}catch(err){}
    if(typeof _padWake==="function")_padWake();});
  cv.addEventListener("pointermove",e=>{
    if(p._pid!==e.pointerId||!p._drag)return;const h=at(e),d=p._drag;
    if(h.label)return;
    if(d.mode==="erase"){const hit=_seqNoteAtP(p,h.note,h.step);if(hit)p.notes=p.notes.filter(n=>n!==hit);return;}
    if(h.note!==d.row)return;   // a note keeps its row; sideways movement is all that counts
    if(d.mode==="paint"){if(!_seqNoteAtP(p,h.note,h.step))p.notes.push({note:h.note,start:h.step,len:1});return;}
    const from=Math.min(d.anchor,h.step),to=Math.max(d.anchor,h.step);
    d.note.start=from;d.note.len=to-from+1;
    // the long note replaces whatever it now covers on its row
    p.notes=p.notes.filter(n=>n===d.note||n.note!==d.row||_seqEndOf(p,n)<from||n.start>to);});
  const up=e=>{if(p._pid!==e.pointerId)return;p._pid=null;p._drag=null;padSave();};
  cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",up);cv.addEventListener("lostpointercapture",up);
}

// ===================== cards =====================
function _seqCanvasH(p){const n=seqRowsOf(p).length;return Math.max(200,Math.min(430,n*(p.kind==="drum"?34:28)));}
function renderSeqPads(){
  const wrap=document.getElementById("seqPads");if(!wrap)return;
  const fsCard=document.querySelector(".seqpad.fs"),fsId=fsCard&&fsCard.dataset.id;
  if(fsCard){if(_seqFsEl()===fsCard&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});_seqFsLeave(fsCard);}
  // a card being rebuilt must not keep a stale pointer capture
  for(const p of (XPAD.seqPads||[])){p._pid=null;p._drag=null;p._cv=null;}
  wrap.innerHTML="";
  const baseOpts=sel=>[36,48,60,72].map(n=>`<option value="${n}"${n===sel?" selected":""}>od ${miNoteName(n)}</option>`).join("");
  const octOpts=sel=>[1,2,3].map(n=>`<option value="${n}"${n===sel?" selected":""}>${n} okt.</option>`).join("");
  const presetOpts=`<option value="">Wczytaj wzór…</option>`+Object.keys(SEQ_PRESETS).map(k=>`<option value="${k}">${esc(SEQ_PRESETS[k].label)}</option>`).join("");
  for(const p of (XPAD.seqPads||[])){
    const drum=p.kind==="drum";
    const card=document.createElement("div");card.className="seqpad"+(drum?" is-drum":"");card.dataset.id=p.id;
    card.innerHTML=
      `<div class="seqpad-h"><span class="sq-ic" aria-hidden="true">${drum?"🥁":"🎼"}</span>`+
        `<input class="sq-name" value="${esc(p.name)}" title="Nazwa pada" maxlength="24">`+
        (drum?`<span class="sq-kit" title="Pad perkusyjny: każdy wiersz to inny bęben">Zestaw perkusyjny</span>`
             :`<select class="sq-sound" title="Brzmienie tego pada">${padSoundOptionsHTML(p.sound)}</select>`)+
        `<select class="sq-preset" title="Wczytaj gotowy wzór — zastępuje nuty tego pada">${presetOpts}</select>`+
        `<button class="playpad-fs sq-fs" type="button" title="Pełny ekran pada (Esc — wyjście)" aria-label="Pełny ekran">⛶</button>`+
        `<button class="playpad-rm sq-rm" type="button" title="Usuń ten pad zaprogramowany" aria-label="Usuń">✕</button></div>`+
      `<div class="seqpad-transport">`+
        `<button class="btn sm sq-play" type="button" title="Odtwórz / zatrzymaj ten pad (w pełnym ekranie także spacja)">▶ Graj</button>`+
        `<label class="sq-fld" title="Długość pętli w szesnastkach">Kroki <select class="sq-steps"><option value="16"${p.steps===16?" selected":""}>16</option><option value="32"${p.steps===32?" selected":""}>32</option></select></label>`+
        `<button class="btn sm sq-clear" type="button" title="Usuń wszystkie nuty tego pada"><span class="bic bic-bin" aria-hidden="true"></span>Wyczyść</button>`+
      `</div>`+
      `<div class="seqpad-cvwrap"><canvas class="seqpad-cv" style="height:${_seqCanvasH(p)}px"></canvas></div>`+
      `<div class="seqpad-set">`+
        (drum?"":
        `<label class="sq-fld"><span>Od nuty</span><select class="sq-base">${baseOpts(p.base)}</select></label>`+
        `<label class="sq-fld"><span>Oktawy</span><select class="sq-oct">${octOpts(p.oct)}</select></label>`+
        `<label class="sq-fld"><span>Tonika</span><select class="sq-root">${MI_ROOTS.map((r,i)=>`<option value="${i}"${i===p.scaleRoot?" selected":""}>${r}</option>`).join("")}</select></label>`+
        `<label class="sq-fld"><span>Skala</span><select class="sq-scale">${MI_SCALES.map(s=>`<option value="${s[0]}"${s[0]===p.scale?" selected":""}>${esc(s[1])}</option>`).join("")}</select></label>`+
        `<label class="sq-fld sq-range" title="Jasność i siła nut — to samo, co wysokość palca na padzie grającym"><span>Barwa</span><input class="sq-tone" type="range" min="0" max="100" value="${p.tone}"></label>`)+
        `<label class="sq-fld sq-range"><span>🔊 Głośność</span><input class="sq-vol" type="range" min="0" max="100" value="${p.vol}"></label>`+
        `<button class="btn sm sq-echo${p.echo?" on":""}" type="button" aria-pressed="${p.echo?"true":"false"}" title="Echo tego pada">Echo</button>`+
      `</div>`+
      `<div class="seqpad-hint hint">${drum
        ?"klik = uderzenie · przeciągnij w bok = kilka uderzeń · klik w uderzenie = usuń · klik w nazwę bębna = odsłuch"
        :"klik = nuta · przeciągnij w bok = jedna dłuższa nuta · klik w nutę = usuń · klik w nazwę nuty = odsłuch"}</div>`;
    const q=s=>card.querySelector(s);
    q(".sq-name").onchange=e=>{p.name=(e.target.value||"").trim().slice(0,24)||p.name;e.target.value=p.name;padSave();renderFxPads();};
    const snd=q(".sq-sound");if(snd)snd.onchange=e=>{p.sound=e.target.value;PadAudio.gateOffPad(p);p.sounding={};padSave();};
    q(".sq-preset").onchange=e=>{const pr=SEQ_PRESETS[e.target.value];if(!pr)return;
      const was=p.playing;if(was)seqPadStop(p);pr.apply(p);padSave();renderSeqPads();if(was)seqPadPlay(p);};
    q(".sq-fs").onclick=()=>_seqCardFS(card);
    q(".sq-rm").onclick=()=>seqRemove(p);
    q(".sq-play").onclick=()=>{if(p.playing)seqPadStop(p);else seqPadPlay(p);};
    q(".sq-steps").onchange=e=>{p.steps=(+e.target.value===32)?32:16;
      p.notes=p.notes.filter(n=>n.start<p.steps);for(const n of p.notes)n.len=Math.min(n.len,p.steps-n.start);
      if(p.pos>=p.steps)p.pos=-1;padSave();};
    q(".sq-clear").onclick=()=>{p.notes=[];PadAudio.gateOffPad(p);p.sounding={};p.hits=[];padSave();};
    const rowsChanged=()=>{PadAudio.gateOffPad(p);p.sounding={};padSave();const cv=q(".seqpad-cv");if(cv)cv.style.height=_seqCanvasH(p)+"px";};
    const sel=(c,f)=>{const el=q(c);if(el)el.onchange=e=>{f(e.target.value);rowsChanged();};};
    sel(".sq-base",v=>{p.base=+v||60;});sel(".sq-oct",v=>{p.oct=+v||1;});
    sel(".sq-root",v=>{p.scaleRoot=(+v||0)%12;});sel(".sq-scale",v=>{p.scale=PAD_PCS[v]?v:"major";});
    const tone=q(".sq-tone");if(tone)tone.oninput=e=>{p.tone=+e.target.value||0;padSave();};
    q(".sq-vol").oninput=e=>{p.vol=+e.target.value||0;PadAudio.setVol(p);padSave();};
    q(".sq-echo").onclick=e=>{p.echo=!p.echo;e.currentTarget.classList.toggle("on",p.echo);
      e.currentTarget.setAttribute("aria-pressed",p.echo?"true":"false");PadAudio.setEcho(p);padSave();};
    _seqBindPointer(q(".seqpad-cv"),p);
    wrap.appendChild(card);
  }
  const sec=document.getElementById("seqPadsSec");if(sec)sec.hidden=!(XPAD.seqPads||[]).length;   // empty section = not shown
  seqTempoReflect();seqReflect();
  if(fsId){const c=wrap.querySelector('.seqpad[data-id="'+fsId+'"]');if(c)_seqCardFS(c);}
}
function seqAdd(){
  const p=seqPadRuntime({id:"q"+(++XPAD._seqPadSeq),name:_gl("Pad zaprogramowany ","Programmed pad ")+((XPAD.seqPads||[]).length+1),
    kind:"mel",sound:"marimba",vol:70,echo:false,tone:65,steps:16,base:60,oct:1,scale:"major",scaleRoot:0,notes:[]});
  SEQ_PRESETS.melody.apply(p);   // a new pad plays something the moment you press ▶ — "Wyczyść" empties it
  (XPAD.seqPads||(XPAD.seqPads=[])).push(p);
  renderSeqPads();renderFxPads();padSave();
  const card=document.querySelector('.seqpad[data-id="'+p.id+'"]');
  if(card&&card.scrollIntoView)try{card.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(e){}
  if(card&&window.rfPopNew)window.rfPopNew(card);
}
function seqRemove(p){
  const at=(XPAD.seqPads||[]).indexOf(p),fx=XPAD.fxPads.filter(fp=>fp.target===p.id).map(fp=>fp.id);
  const run=()=>{
    seqPadStop(p);
    const card=document.querySelector('.seqpad[data-id="'+p.id+'"]');
    if(card&&(document.fullscreenElement===card)&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});
    if(PadAudio.buses[p.id])PadAudio.disposeBus(p.id);
    XPAD.seqPads=XPAD.seqPads.filter(x=>x!==p);
    for(const fp of XPAD.fxPads)if(fp.target===p.id)fp.target=XPAD.pads[0].id;   // its effects pads fall back to the first play pad
    renderSeqPads();renderFxPads();padSave();};
  // "Cofnij" (rfUndo, rf-06): the same pad goes back to its place, stopped, with the effects pads that pointed at it
  if(typeof window.rfUndo!=="function"){run();return;}
  window.rfUndo({msg:_gl("Usunięto pad „"+p.name+"”","Deleted the pad “"+p.name+"”"),clone:false,take:()=>p,run,
    restore:q=>{if(!XPAD.seqPads)XPAD.seqPads=[];if(XPAD.seqPads.includes(q))return;
      XPAD.seqPads.splice(Math.min(at<0?XPAD.seqPads.length:at,XPAD.seqPads.length),0,q);
      for(const fp of XPAD.fxPads)if(fx.includes(fp.id))fp.target=q.id;
      renderSeqPads();renderFxPads();padSave();}});
}

// ===================== fullscreen =====================
// Native fullscreen on the card (like a play pad), with the .fs class as the layout — and the fallback
// when the browser refuses. For the length of it the card lives directly in <body>: deep in the tab
// it sits under stacking contexts, and a fallback card at z-index 2000 still drew BELOW the page
// header. A placeholder keeps its seat. Esc leaves; Space plays/stops while it fills the screen.
function _seqFsEl(){return document.fullscreenElement||document.webkitFullscreenElement||null;}
function _seqFsLeave(card){
  card.classList.remove("fs");
  if(card._fsSeat){if(card._fsSeat.parentNode)card._fsSeat.replaceWith(card);else card.remove();card._fsSeat=null;}
}
function _seqCardFS(card){
  if(!card)return;const fsEl=_seqFsEl();
  if(card.classList.contains("fs")||fsEl===card){
    if(fsEl===card){if(document.exitFullscreen)document.exitFullscreen().catch(()=>{});else if(document.webkitExitFullscreen)document.webkitExitFullscreen();}
    _seqFsLeave(card);
  }else{
    const seat=document.createComment("seqpad-fs");card.replaceWith(seat);card._fsSeat=seat;document.body.appendChild(card);
    card.classList.add("fs");
    const req=card.requestFullscreen||card.webkitRequestFullscreen;
    card._fsFallback=!req;
    if(req){try{const r=req.call(card);if(r&&r.catch)r.catch(()=>{card._fsFallback=true;});}catch(e){card._fsFallback=true;}}
  }
  if(typeof _padWake==="function")_padWake();
}
function _seqOnFsChange(){const fsEl=_seqFsEl();document.querySelectorAll(".seqpad.fs").forEach(c=>{if(c!==fsEl&&!c._fsFallback)_seqFsLeave(c);});}
document.addEventListener("fullscreenchange",_seqOnFsChange);
document.addEventListener("webkitfullscreenchange",_seqOnFsChange);
document.addEventListener("keydown",e=>{
  const card=document.querySelector(".seqpad.fs");if(!card)return;
  if(e.key==="Escape"&&!_seqFsEl()){_seqFsLeave(card);return;}
  const t=e.target,typing=t&&(t.tagName==="INPUT"||t.tagName==="SELECT"||t.tagName==="TEXTAREA"||t.isContentEditable);
  if((e.key===" "||e.code==="Space")&&!typing&&!(t&&t.tagName==="BUTTON")){
    e.preventDefault();const p=(XPAD.seqPads||[]).find(x=>x.id===card.dataset.id);if(p){if(p.playing)seqPadStop(p);else seqPadPlay(p);}}
});

function initSeqPads(){
  renderSeqPads();
  const add=document.getElementById("seqAddBtn");if(add)add.addEventListener("click",()=>{PadAudio.resume();seqAdd();});
  const all=document.getElementById("seqAllBtn");if(all)all.addEventListener("click",seqToggleAll);
  // the section's transport: read live by the clock, so a change lands on the very next step
  const bpm=document.getElementById("seqTempo"),sw=document.getElementById("seqSwingAll");
  if(bpm)bpm.addEventListener("input",()=>{XPAD.seqBpm=Math.max(40,Math.min(240,+bpm.value||SEQ_BPM_DEF));seqTempoReflect();padSave();});
  if(sw)sw.addEventListener("input",()=>{XPAD.seqSwing=Math.max(0,Math.min(60,+sw.value||0));seqTempoReflect();padSave();});
}
function seqTempoReflect(){
  const set=(id,v)=>{const el=document.getElementById(id);if(el&&document.activeElement!==el)el.value=String(v);};
  const txt=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=String(v);};
  set("seqTempo",seqBpm());txt("seqTempoV",seqBpm());set("seqSwingAll",seqSwing());txt("seqSwingAllV",seqSwing());
  // the rhythm gate's tempo slider is the same number (rf-24 gate editor)
  document.querySelectorAll(".ppg-rh-bpmr").forEach(el=>{if(document.activeElement!==el)el.value=String(seqBpm());});
  document.querySelectorAll(".ppg-rh-bpmv").forEach(el=>{el.textContent=String(seqBpm());});
}
