"use strict";
// ===== PadAudio: the WebAudio engine behind the XY pads =====
// One lazily-created AudioContext, one bus per instrument (effects chain + echo send) and one
// voice per playing source ("ptr" for touch, "dev:<id>" per capsule). Everything is local to
// the browser — nothing here reaches MIDI, OSC or the OS.
const PadAudio={
  ctx:null,limiter:null,buses:{},
  ensure(){
    if(this.ctx)return true;
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;
    const c=this.ctx=new C();
    // ONE safety limiter shared by all buses — many overlapping voices sum here — keep output from clipping
    this.limiter=c.createDynamicsCompressor();
    this.limiter.threshold.value=-10;this.limiter.knee.value=6;this.limiter.ratio.value=12;
    this.limiter.attack.value=.003;this.limiter.release.value=.25;
    this.limiter.connect(c.destination);
    return true;
  },
  resume(){if(this.ensure()&&this.ctx.state==="suspended")this.ctx.resume().catch(()=>{});},
  // ---- per-instrument audio bus: master → brightness LP → bass-cut HP → tremolo → sharedLimiter,
  //      + own echo (send → delay → fb → wet → master). Lazily created; owns its own voice/tail pool. ----
  // shared reverb impulse (decaying stereo noise) — generated once, reused by every bus' convolver
  _reverbIR(){if(this._ir)return this._ir;const c=this.ctx,rate=c.sampleRate,len=Math.floor(rate*1.9);
    const buf=c.createBuffer(2,len,rate);
    for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);for(let i=0;i<len;i++){const t=i/len;d[i]=(Math.random()*2-1)*Math.pow(1-t,2.6);}}
    return this._ir=buf;},
  // shared soft-clip curve for the drive/overdrive waveshaper (slope ~1 near 0 → transparent when dry)
  _driveCurve(){if(this._dc)return this._dc;const n=1024,cv=new Float32Array(n);
    for(let i=0;i<n;i++){const t=i/(n-1)*2-1;cv[i]=Math.tanh(t*2.2);}return this._dc=cv;},
  // CUSTOM WAVE (sound editor › Fala, rf-25e, 2026-10-02): a patch with wave "custom" carries one period as
  // 64 samples `wt`; this turns them into a PeriodicWave (DFT, harmonics 1..32, DC dropped, the browser normalises
  // the peak like it does for the built-in types). Cached per sample set — `p.wt.join` is the key, so two sounds
  // with the same drawing share one wave; 32 entries is plenty for an editor session, beyond that the cache resets.
  // Every other wave goes straight to `o.type` exactly as before: a patch without `wt` builds the same voice.
  _pwave(p){
    const key=p.wt.join(","),m=this._pw||(this._pw=new Map());let w=m.get(key);if(w)return w;
    if(m.size>=32)m.clear();
    const N=64,re=new Float32Array(33),im=new Float32Array(33);let mx=0;
    for(let k=1;k<=32;k++){let a=0,b=0;
      for(let n=0;n<N;n++){const ang=2*Math.PI*k*n/N,v=+p.wt[n]||0;a+=v*Math.cos(ang);b+=v*Math.sin(ang);}
      const sc=(k===32?1:2)/N;re[k]=a*sc;im[k]=b*sc;mx=Math.max(mx,Math.abs(re[k]),Math.abs(im[k]));}   // Nyquist: 1/N
    w=this.ctx.createPeriodicWave(re,im,{disableNormalization:mx<1e-6});   // a flat line stays silent, not NaN
    m.set(key,w);return w;},
  // "custom" can never be assigned to OscillatorNode.type (it throws), so a custom patch that somehow lost its
  // samples falls back to the saw that sanitizePatch would have given it
  _setWave(o,wave,p){if(wave==="custom"){if(p&&Array.isArray(p.wt)){o.setPeriodicWave(this._pwave(p));return;}wave="sawtooth";}
    o.type=wave;},
  bus(inst){
    if(!this.ensure()||!inst)return null;
    let b=this.buses[inst.id];if(b)return b;
    const c=this.ctx;
    b={id:inst.id,voices:{},tails:[],_lastSpawn:{}};
    b.master=c.createGain();b.master.gain.value=this._vol(inst);
    // drive (dry/wet soft-clip overdrive)
    b.driveDry=c.createGain();b.driveDry.gain.value=1;
    b.shaper=c.createWaveShaper();b.shaper.curve=this._driveCurve();b.shaper.oversample="2x";
    b.driveWet=c.createGain();b.driveWet.gain.value=0;
    b.driveMix=c.createGain();
    b.bright=c.createBiquadFilter();b.bright.type="lowpass";b.bright.frequency.value=20000;b.bright.Q.value=.3;
    b.hp=c.createBiquadFilter();b.hp.type="highpass";b.hp.frequency.value=20;b.hp.Q.value=.4;   // 20Hz = transparent
    b.wah=c.createBiquadFilter();b.wah.type="peaking";b.wah.frequency.value=350;b.wah.Q.value=5;b.wah.gain.value=0;   // 0dB = flat
    b.trem=c.createGain();b.trem.gain.value=1;
    b.tremLfo=c.createOscillator();b.tremLfo.type="sine";b.tremLfo.frequency.value=5.5;
    b.tremDepth=c.createGain();b.tremDepth.gain.value=0;   // 0 = no tremolo
    b.tremLfo.connect(b.tremDepth);b.tremDepth.connect(b.trem.gain);b.tremLfo.start();
    b.pan=c.createStereoPanner?c.createStereoPanner():c.createGain();if(b.pan.pan)b.pan.pan.value=0;
    // chain: master → (dry + shaper) → driveMix → bright → hp → wah → trem → pan → limiter
    b.master.connect(b.driveDry);b.master.connect(b.shaper);b.shaper.connect(b.driveWet);
    b.driveDry.connect(b.driveMix);b.driveWet.connect(b.driveMix);
    b.driveMix.connect(b.bright);b.bright.connect(b.hp);b.hp.connect(b.wah);b.wah.connect(b.trem);b.trem.connect(b.pan);b.pan.connect(this.limiter);
    // reverb send: pan → convolver → revWet → limiter (shared IR)
    b.revConv=c.createConvolver();b.revConv.buffer=this._reverbIR();
    b.revWet=c.createGain();b.revWet.gain.value=0;
    b.pan.connect(b.revConv);b.revConv.connect(b.revWet);b.revWet.connect(this.limiter);
    // echo send (parallel from voices): send → delay(+fb) → wet → master
    const delay=c.createDelay(1.5);delay.delayTime.value=.27;
    const fb=c.createGain();fb.gain.value=.38;
    delay.connect(fb);fb.connect(delay);
    b.wet=c.createGain();b.wet.gain.value=inst.echo?.5:0;
    delay.connect(b.wet);b.wet.connect(b.master);
    b.send=c.createGain();b.send.gain.value=1;b.send.connect(delay);
    b.delay=delay;b.fb=fb;   // exposed so the effects pads can steer echo time / feedback
    this.buses[inst.id]=b;return b;
  },
  disposeBus(id){const b=this.buses[id];if(!b)return;
    for(const s in b.voices)this._kill(b.voices[s]);
    for(const v of b.tails.slice())this._kill(v);
    try{b.tremLfo.stop();}catch(e){}
    for(const n of [b.bright,b.hp,b.wah,b.trem,b.tremDepth,b.master,b.wet,b.send,b.delay,b.fb,
      b.driveDry,b.driveWet,b.shaper,b.driveMix,b.pan,b.revConv,b.revWet])try{n.disconnect();}catch(e){}
    delete this.buses[id];
  },
  _vol(inst){const v=(inst?inst.vol:70)/100;return v*v*.9;},
  setVol(inst){const b=this.buses[inst&&inst.id];if(b)b.master.gain.setTargetAtTime(this._vol(inst),this.ctx.currentTime,.03);},
  setEcho(inst){const b=this.buses[inst&&inst.id];if(b)b.wet.gain.setTargetAtTime(inst.echo?.5:0,this.ctx.currentTime,.05);},
  // effects parameter setter (v in 0..1) for ONE instrument's bus — echo mix / brightness / delay time / fb / hp / tremolo
  // BYPASS WINS: a manual effect (bright/hp/tremolo) whose per-pad switch is OFF is forced to its
  // transparent value here — the ONE place every effect value passes through — so it cannot be steered
  // back in by an effects pad, the fx base loop or any future caller. "Off" must mean inaudible.
  setFxParam(inst,p,v){const b=this.buses[inst&&inst.id];if(!b||!this.ctx)return;
    if(fxSwitchable(p)&&!padFxOn(inst,p))v=FX_OFF_VAL[p];
    const t=this.ctx.currentTime,x=Math.max(0,Math.min(1,v));
    if(p==="echo")b.wet.gain.setTargetAtTime(x*.7,t,.05);
    else if(p==="bright")b.bright.frequency.setTargetAtTime(300*Math.pow(20000/300,x),t,.04);
    else if(p==="delay")b.delay.delayTime.setTargetAtTime(.04+x*.56,t,.08);
    else if(p==="fb")b.fb.gain.setTargetAtTime(x*.85,t,.05);
    else if(p==="hp")b.hp.frequency.setTargetAtTime(20*Math.pow(2400/20,x),t,.04);
    else if(p==="tremolo")b.tremDepth.gain.setTargetAtTime(x*.8,t,.05);
    else if(p==="reverb")b.revWet.gain.setTargetAtTime(x*.9,t,.06);
    else if(p==="drive"){b.driveWet.gain.setTargetAtTime(x,t,.04);b.driveDry.gain.setTargetAtTime(1-x*.85,t,.04);}   // dry/wet crossfade
    else if(p==="wah"){b.wah.frequency.setTargetAtTime(300*Math.pow(12,x),t,.03);b.wah.gain.setTargetAtTime(x*15,t,.03);}   // swept resonant peak (flat at x=0)
    else if(p==="pan"&&b.pan.pan)b.pan.pan.setTargetAtTime((x-.5)*2,t,.04);},
  // WHAT Y STEERS, AND ACROSS WHAT. `yParam` names the target and `yLo`/`yHi` (percent) map the
  // pad's height onto that parameter's own span — inverted ranges (hi < lo) are allowed on purpose,
  // that is simply "louder at the bottom". Whatever Y does NOT steer sits at a fixed middle instead
  // of following the finger. "both" is the historical behaviour and stays bit-identical.
  // Targets beyond brightness/loudness/vibrato (resonance, attack, tail, detune, filter kick,
  // overdrive — see PAD_Y_TARGETS) travel as EXTRA keys on this map, and a key that is absent means
  // "leave the patch alone". That is what keeps every pad saved before they existed sounding the
  // same: no mode selected → no key emitted → not one line of the voice builder takes a new branch.
  Y_NEUTRAL_CUT:.72, Y_NEUTRAL_LVL:.85,
  // spans of the extra targets. Q and the two times are logarithmic because that is how the ear
  // reads them — halfway up the pad has to sound halfway, not "still nearly nothing".
  Y_Q:[.4,14], Y_ATT:[.0015,1.2], Y_DEC:[.05,2.6], Y_DET_MAX:45,   // Q, seconds, seconds, cents
  _yExp(sp,x){const t=Math.max(0,Math.min(1,+x||0));return sp[0]*Math.pow(sp[1]/sp[0],t);},
  _yMap(inst,y){
    const yy=Math.max(0,Math.min(1,+y||0));
    const lo=(inst&&inst.yLo!=null?+inst.yLo:0)/100, hi=(inst&&inst.yHi!=null?+inst.yHi:100)/100;
    const v=Math.max(0,Math.min(1,lo+yy*(hi-lo)));
    const mode=(inst&&inst.yParam)||"both";
    const C=this.Y_NEUTRAL_CUT,L=this.Y_NEUTRAL_LVL;
    if(mode==="bright")return {cut:v,lvl:L,vib:0,mode};
    if(mode==="vol")   return {cut:C,lvl:v,vib:0,mode};
    if(mode==="vib")   return {cut:C,lvl:L,vib:v,mode};
    if(mode==="none")  return {cut:C,lvl:L,vib:0,mode};
    if(mode==="q")     return {cut:C,lvl:L,vib:0,mode,q:v};
    if(mode==="cutq")  return {cut:v,lvl:L,vib:0,mode,q:v};        // filter sweep: opens AND sharpens
    if(mode==="att")   return {cut:C,lvl:L,vib:0,mode,att:v};
    if(mode==="dec")   return {cut:C,lvl:L,vib:0,mode,dec:v};
    if(mode==="det")   return {cut:C,lvl:L,vib:0,mode,det:v};
    if(mode==="fenv")  return {cut:C,lvl:L,vib:0,mode,fenv:v};
    if(mode==="drive") return {cut:C,lvl:L,vib:0,mode,drive:v};
    return {cut:v,lvl:v,vib:0,mode:"both"};
  },
  _cut(p,y){const lo=(+p.fMin||200),hi=(+p.fMax||6000);const f=lo*Math.pow(hi/lo,Math.max(0,Math.min(1,y)));return Number.isFinite(f)?f:lo;},
  // how fast a sample must run to sing the wanted note: the note against the sample's own tuning, times the octave
  // switch. Clamped low so a silly root cannot stall the source (rate 0 = a sample that never ends).
  _smpRate(freq,root,octMul){const r=440*Math.pow(2,((+root||60)-69)/12);
    const v=(freq/(r||440))*(octMul||1);return Number.isFinite(v)?Math.max(.03,Math.min(32,v)):1;},
  // the sample's pitch while a held note moves (legato and free glide). `hard` jumps, anything else slides on the
  // same tau as the oscillators, so a sampled sound bends exactly like a synthesised one.
  // `root == null` is a sample with "nie przestrajaj" on: it stays at rate 1 whatever the note does.
  _setSmpRate(v,note,t,tau,hard){if(!v||!v.smp||v.smp.root==null)return;
    const r=this._smpRate(padFreq(note),v.smp.root,v.smp.octMul),pr=v.smp.src.playbackRate;
    if(hard){pr.cancelScheduledValues(t);pr.setValueAtTime(r,t);}else pr.setTargetAtTime(r,t,tau);},
  // ---- the three targets that need nodes a plain voice does not have ------------------------------
  // A unison pair on its OWN gain, faded in BY the detune amount: at zero it is silent, so a patch
  // that never asked for detune sounds untouched. Fading it in (rather than always running it) is
  // what keeps the bottom of the pad honest — three oscillators at 0 ct would just be 3× louder.
  _detPair(v,dest,wave,baseFreq,mult,x){
    const c=this.ctx;const dg=c.createGain();dg.gain.value=0;dg.connect(dest);
    const a=c.createOscillator(),b=c.createOscillator();
    for(const o of [a,b]){this._setWave(o,wave||"sawtooth",v.p);o.frequency.value=baseFreq*mult;o.connect(dg);o.start();
      v.oscs.push({o,mult});}   // mult ≠ 0 → they glide with the note and die with the voice
    v.detG=dg;v.detOsc=[a,b];this._setDet(v,x);
  },
  _setDet(v,x){if(!v||!v.detG)return;const t=this.ctx.currentTime,q=Math.max(0,Math.min(1,+x||0));
    const cents=q*this.Y_DET_MAX;
    v.detOsc[0].detune.setTargetAtTime(cents,t,.05);v.detOsc[1].detune.setTargetAtTime(-cents,t,.05);
    v.detG.gain.setTargetAtTime(Math.min(.85,q*1.2),t,.05);},
  // per-voice overdrive: dry/wet around the shared soft-clip curve, wet muted at 0 → transparent
  _driveStage(v,src){const c=this.ctx;
    const dry=c.createGain();dry.gain.value=1;
    const pre=c.createGain();pre.gain.value=1;
    const sh=c.createWaveShaper();sh.curve=this._driveCurve();sh.oversample="2x";
    const wet=c.createGain();wet.gain.value=0;
    const out=c.createGain();
    src.connect(dry);src.connect(pre);pre.connect(sh);sh.connect(wet);
    dry.connect(out);wet.connect(out);
    v.dvDry=dry;v.dvPre=pre;v.dvWet=wet;return out;},
  _setDrive(v,x){if(!v||!v.dvWet)return;const t=this.ctx.currentTime,q=Math.max(0,Math.min(1,+x||0));
    v.dvPre.gain.setTargetAtTime(1+q*7,t,.04);        // push into the curve …
    v.dvWet.gain.setTargetAtTime(q*.7,t,.04);         // … and take back what clipping added
    v.dvDry.gain.setTargetAtTime(1-q*.85,t,.04);},
  // the patch's own equaliser (Korektor in the sound editor, rf-25e, 2026-10-02): up to 4 "peaking" biquads in a row,
  // PER VOICE (decision D4: the patch is a property of the sound, the bus is shared by capsules). Called only for a
  // patch WITH `eq` — a patch without it builds no node here and its voice is wired line for line as before.
  // The nodes stay on v.eqN (bands in order) for later live edits. The screen's curve (SoundScreens.eqMag) uses the
  // very formula of the spec's "peaking" type, so what you see is what this chain does.
  _eqChain(v,src,bands){const c=this.ctx;let t=src;v.eqN=[];
    for(const b of bands){const n=c.createBiquadFilter();n.type="peaking";
      n.frequency.value=+b.f||1000;n.gain.value=+b.g||0;n.Q.value=+b.q||1;
      t.connect(n);t=n;v.eqN.push(n);}
    return t;},
  // ENVELOPE CURVES (sound editor › Obwiednia, rf-25e, 2026-10-02; decision D5). A patch with `envC`
  // ([attack, decay, release], −1..1, at least one ≠ 0) gets ONE more GainNode `env` IN FRONT OF the voice gain `g`:
  // `g` takes the level at once and stays the Y axis' (update() keeps steering it live with setTargetAtTime), while
  // the SHAPE runs on env.gain as value curves: attack and decay as ONE curve (_envPair), the release as another, so
  // no event ever lands inside a running curve (that throws; it is also why `g` could not carry them).
  // A patch without `envC` (and every noise voice) never reaches these: its voice is built line for line as before.
  // _envShape/_envCurve are copies of SoundScreens.envShape/envCurve (rf-25c), so the engine needs no screen; the
  // harness (n) keeps the copies equal, so the screen draws exactly the curve the engine plays.
  // Shape of a segment, s 0..1 → 0..1, from the bend c (−1..1) through a steepness k. c 0 = TODAY'S shape: k 3 is the
  // plain setTargetAtTime of a sound without bends (tau = time/3, 95 % at the end), here scaled to land exactly on 1;
  // c < 0 sharper (k = 3·4^(−c), c −1: k 12); 0 < c ≤ .5 gentler down to straight (k = 3·(1 − 2c), c .5: k 0);
  // c > .5 convex, slow start and fast end (k = −12·(c − .5), c 1: k −6).
  // k > 0: (1 − e^(−ks))/(1 − e^(−k)); k ≈ 0: s; k < 0: (e^(−ks) − 1)/(e^(−k) − 1).
  _envShape(s,c){s=s<=0?0:(s>=1?1:s);c=+c||0;
    const k=c<=0?3*Math.pow(4,-c):(c<=.5?3*(1-2*c):-12*(c-.5));
    return k>1e-6?(1-Math.exp(-k*s))/(1-Math.exp(-k)):(k<-1e-6?(Math.exp(-k*s)-1)/(Math.exp(-k)-1):s);},
  _envCurve(from,to,c,n){n=Math.max(2,n|0);const o=new Float32Array(n);
    for(let i=0;i<n;i++)o[i]=from+(to-from)*this._envShape(i/(n-1),c);
    o[0]=from;o[n-1]=to;return o;},
  _envOn(p){const c=p&&p.envC;return Array.isArray(c)&&c.length===3&&c.every(x=>typeof x==="number"&&Number.isFinite(x))&&c.some(x=>x!==0);},
  _envN(dur){return Math.max(8,Math.min(256,Math.round(dur*200)));},   // 200 points a second, 8..256
  // the env node in front of g, silent until its attack curve
  _envGain(v,g){const e=this.ctx.createGain();e.gain.value=0;e.connect(g);v.env=e;v.envS=[];return e;},
  // one value curve on env.gain, remembered in v.envS so a release can start EXACTLY where the curve stands
  _envSeg(v,from,to,c,t0,dur){const k=this._envCurve(from,to,c,this._envN(dur));
    v.env.gain.setValueCurveAtTime(k,t0,dur);v.envS.push({t0,d:dur,k});},
  // env.gain at time t, read from the scheduled curves and interpolated the way the spec plays a value curve.
  // AudioParam.value would do too, but it lags a render quantum or more behind — on a 12 ms attack that is a click.
  _envVal(v,t){const S=v.envS||[];
    for(let i=S.length-1;i>=0;i--){const q=S[i],n=q.k.length;if(t<q.t0)continue;
      if(t>=q.t0+q.d)return q.k[n-1];
      const x=(t-q.t0)/q.d*(n-1),j=Math.min(n-2,Math.floor(x));return q.k[j]+(q.k[j+1]-q.k[j])*(x-j);}
    return 0;},
  // Attack and decay as ONE value curve: from → mid over a, then mid → to over d. Two curves laid back to back,
  // (t, a) and (t + a, d), threw in Chromium (Fable's smoke 2026-10-02: "setValueCurveAtTime(…, 32.792, 0.5) overlaps
  // setValueCurveAtTime(…, 32.4, 0.4)"). Not two reads of the clock — t is read once in _mkVoice — but the spec's
  // clamp: a start time already in the past is moved to currentTime with its DURATION KEPT, and currentTime jumps
  // in bursts of render quanta while JS runs. The attack read t = 32.392, was laid at 32.4 and ran 8 ms into the
  // decay at t + a = 32.792. One curve has no seam to collide at; a clamp only shifts it whole. The peak is a sample
  // of its own (index nA, exactly mid) and the attack lasts exactly a; a point every ≤ 5 ms and ≥ 8 per part, at
  // most about 4096 (then the attack is rounded to one step). Returns the curve's length (s).
  _envPair(v,from,mid,to,c1,c2,t,a,d){
    let h=Math.min(.005,a/8,d/8),nA=Math.max(1,Math.round(a/h));h=a/nA;let nD=Math.max(1,Math.round(d/h));
    if(nA+nD>4096){h=(a+d)/4096;nA=Math.max(1,Math.round(a/h));nD=Math.max(1,4096-nA);}
    const k=new Float32Array(nA+nD+1);
    for(let i=0;i<nA;i++)k[i]=from+(mid-from)*this._envShape(i/nA,c1);
    for(let i=0;i<=nD;i++)k[nA+i]=mid+(to-mid)*this._envShape(i/nD,c2);
    k[0]=from;k[nA]=mid;k[nA+nD]=to;const dur=(nA+nD)*h;
    v.env.gain.setValueCurveAtTime(k,t,dur);v.envS.push({t0:t,d:dur,k});return dur;},
  // the start: g jumps to the level (instead of its own attack), env waits at 0 for its curve
  _envGo(v,g,t){g.gain.setValueAtTime(v.gTarget,t);v.env.gain.setValueAtTime(0,t);},
  // an attack alone (the frog; legato with sustain 100 %): env 0 → 1 over a with the attack bend
  _envAtk(v,g,t,a){this._envGo(v,g,t);this._envSeg(v,0,1,v.p.envC[0],t,a);},
  // filter envelope = additive ConstantSource on the cutoff, decaying back to the (Y-steered) base
  _fEnvNode(v,f,p,amt,time){const c=this.ctx,t=c.currentTime;
    const cs=c.createConstantSource();const a=amt*((+p.fMax||6000)-(+p.fMin||200));
    cs.offset.setValueAtTime(a,t);cs.offset.setTargetAtTime(0,t,((+time||.2))/3);
    cs.connect(f.frequency);cs.start();v.oscs.push({o:cs,mult:0});},   // mult:0 → killed, never pitch-ramped
  // one voice = filter -> envelope gain -> bus.master(+bus.send); oscillators carry a mult vs base freq
  _mkVoice(bus,p,freq,y,velScale){
    // callers outside the pads (sound lab, sequencer) still pass a plain 0..1 — that is "both"
    const Y=(y&&typeof y==="object")?y:{cut:y,lvl:y,vib:0,mode:"both"};
    const c=this.ctx,t=c.currentTime;
    const g=c.createGain();g.gain.value=0;g.connect(bus.master);g.connect(bus.send);
    const v={p,g,oscs:[],lfoG:null,stopped:false,bornAt:t,_bus:bus};
    // Y-steered patch parameters. null = "this voice is not steering it" → the patch's own value is
    // used through the very same expression as before, so an unsteered voice is built line for line
    // as it always was. A(d)/D(d) read "attack/decay, falling back to the patch and then to d".
    const yAtt=(Y.att!=null)?this._yExp(this.Y_ATT,Y.att):null;
    const yDec=(Y.dec!=null)?this._yExp(this.Y_DEC,Y.dec):null;
    const yQ=(Y.q!=null)?this._yExp(this.Y_Q,Y.q):null;
    const A=d=>(yAtt!=null?yAtt:(p.att||d)), D=d=>(yDec!=null?yDec:(p.dec||d));
    v.decY=yDec;   // also read by _release (the tail) and by the free-mode re-strike test
    // velocity-from-motion: multiply the voice's target gain (1.0 = OFF/default → bit-identical to before).
    const vs=(velScale>0)?velScale:1;v.velScale=vs;v.gTarget=p.lvl*vs;   // gTarget = introspectable peak level
    if(p.noise){   // FX: looped white noise through a resonant bandpass (X = center, Y = level)
      const f=c.createBiquadFilter();f.type="bandpass";f.Q.value=(yQ!=null?yQ:7);f.frequency.value=freq;
      (p.eq&&p.eq.length?this._eqChain(v,f,p.eq):f).connect(g);   // the patch's own equaliser after the band
      const len=Math.round(c.sampleRate*1.2),buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);
      for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
      const src=c.createBufferSource();src.buffer=buf;src.loop=true;src.connect(f);src.start();
      v.oscs.push({o:src,mult:0});v.f=f;
      v.gTarget=p.lvl*(.3+.7*Y.lvl)*vs;
      g.gain.setTargetAtTime(v.gTarget,t,yAtt!=null?Math.max(.008,yAtt/3):.03);   // noise has no patch attack — .03 unless Y steers it
      return v;
    }
    if(p.croak){   // 🐸 frog „ribbit": buzzy saw → AM gain (rolling rrr) → vocal band-pass (Y = mouth)
      const octMul=p.oct?Math.pow(2,p.oct):1;
      const f=c.createBiquadFilter();f.type="bandpass";f.Q.value=(yQ!=null?yQ:(p.q||6));f.frequency.value=this._cut(p,Y.cut);v.f=f;
      if(Y.fenv>0)this._fEnvNode(v,f,p,Y.fenv,p.fEnvT);
      const fo=p.eq&&p.eq.length?this._eqChain(v,f,p.eq):f;   // the patch's own equaliser after the mouth …
      const ec=this._envOn(p);   // envelope curves (rf-25e Obwiednia): env sits between the mouth and g
      (Y.drive!=null?this._driveStage(v,fo):fo).connect(ec?this._envGain(v,g):g);   // … and the frog can be overdriven too
      const o=c.createOscillator();this._setWave(o,p.wave||"sawtooth",p);o.frequency.value=freq*octMul;
      const am=c.createGain();am.gain.value=.55;                 // AM offset (0.55) …
      o.connect(am);am.connect(f);
      const lfo=c.createOscillator();lfo.type="square";lfo.frequency.value=p.am||29;
      const lg=c.createGain();lg.gain.value=.45;                 // … + LFO depth (±0.45) → gain rolls 0.1‥1.0
      lfo.connect(lg);lg.connect(am.gain);lfo.start();o.start();
      v.oscs.push({o,mult:octMul});v.oscs.push({o:lfo,mult:0});v.am=am;
      if(Y.det!=null)this._detPair(v,am,p.wave||"sawtooth",freq,octMul,Y.det);   // the pair rides the same AM roll
      const vlfo=c.createOscillator();vlfo.type="sine";vlfo.frequency.value=5.6;   // vibrato from twist (reused pattern)
      const vg=c.createGain();vg.gain.value=0;vlfo.connect(vg);
      for(const it of v.oscs)if(it.mult&&it.o.detune)vg.connect(it.o.detune);   // was: the main osc only — a detune pair has to sing along
      vlfo.start();v.oscs.push({o:vlfo,mult:0});v.lfoG=vg;
      if(ec)this._envAtk(v,g,t,A(.02));   // the frog has an attack only (no decay to sustain): one curve
      else g.gain.setTargetAtTime(v.gTarget,t,Math.max(.008,A(.02)/3));
      return v;
    }
    const f=c.createBiquadFilter();f.type=(p.filt||"lowpass");f.Q.value=(yQ!=null?yQ:(p.q||1));   // filter type now selectable (croak/noise force bandpass above)
    const cut=this._cut(p,Y.cut);
    if(p.fSwell){   // brass: start the cutoff low and swell open — the "blown" attack
      f.frequency.setValueAtTime(Math.max(90,cut*.28),t);
      f.frequency.setTargetAtTime(cut,t,p.fSwell/3);
    }else f.frequency.value=cut;
    // per-patch filter envelope: additive ConstantSource on f.frequency, decays back to the (Y-steered) base cutoff
    const fe=(Y.fenv!=null)?Y.fenv:(p.fEnv||0);   // Y takes the amount over, the patch keeps the time
    if(fe)this._fEnvNode(v,f,p,fe,p.fEnvT);
    let tail=f;   // node feeding the voice gain (filter, or filter→drive)
    if(p.drive){const pre=c.createGain();pre.gain.value=1+p.drive*6;             // per-patch soft-clip overdrive (reuses shared tanh curve)
      const sh=c.createWaveShaper();sh.curve=this._driveCurve();sh.oversample="2x";
      const post=c.createGain();post.gain.value=1/(1+p.drive*1.5);
      f.connect(pre);pre.connect(sh);sh.connect(post);tail=post;}
    if(p.eq&&p.eq.length)tail=this._eqChain(v,tail,p.eq);   // the patch's own equaliser: after its drive, before Y's
    if(Y.drive!=null)tail=this._driveStage(v,tail);   // …and Y can push it further still
    const ec=this._envOn(p);   // envelope curves (rf-25e Obwiednia): env after everything above, in front of g
    tail.connect(ec?this._envGain(v,g):g);v.f=f;
    const octMul=p.oct?Math.pow(2,p.oct):1;
    const mk=(wave,mult,det)=>{const o=c.createOscillator();this._setWave(o,wave,p);   // "custom" → PeriodicWave from p.wt
      o.frequency.value=freq*mult;if(det)o.detune.value=det;o.connect(f);o.start();
      v.oscs.push({o,mult});return o;};
    // THE SOUND'S OWN SAMPLE (sound library › Próbka, rf-25f, 2026-10-19). A patch with `smp` plays a recording instead
    // of oscillators: ONE buffer source into the very same filter, envelope and effects, so everything below this line
    // works on it unchanged. The note stretches it (playbackRate against `smpRoot`), a loop keeps it going while the
    // note is held, and no loop means it plays once and falls silent. Bytes not here yet (they come from the server
    // after boot, or the file is gone) → `buffer` is null and the voice is built from oscillators exactly as before.
    // 2026-10-20: `graj` hands back the buffer AS THE PATCH WANTS IT HEARD — the cut, the level, the direction
    // and the crossfaded loop seam are already in those bytes (js/probki-audio.js `wytnij`), so this file only
    // has to start a source. Loop points come back with it, measured on that buffer, not on the recording.
    const smpGra=(p.smp&&typeof PadSampler!=="undefined")?PadSampler.graj(c,p):null;
    if(smpGra&&smpGra.buf){
      const src=c.createBufferSource();src.buffer=smpGra.buf;
      if(smpGra.petla){src.loop=true;src.loopStart=smpGra.petla[0];src.loopEnd=Math.min(smpGra.petla[1],smpGra.buf.duration);}
      // "Nie przestrajaj" (`smpStaly`): a clap, a drum or a spoken word should sound the SAME across the scale,
      // so the note must not touch the playback rate. `root:null` is how `_setSmpRate` learns there is nothing
      // to chase while a held note moves.
      const staly=p.smpStaly===true;
      const root=staly?null:(p.smpRoot==null?60:p.smpRoot)+(p.smpCent||0)/100;   // fine tune lives in cents, folded in here
      src.playbackRate.value=staly?1:this._smpRate(freq,root,octMul);
      src.connect(f);src.start();
      v.oscs.push({o:src,mult:0});   // mult:0 → killed with the voice, never pitch-ramped as an oscillator
      v.smp={src,root,octMul};
    }else{
    mk(p.wave,octMul,0);
    if(p.det){mk(p.wave,octMul,p.det);mk(p.wave,octMul,-p.det);}
    if(p.sub)mk("sine",octMul*.5,0);
    if(p.osc2){   // 2nd oscillator layer: own wave + semitone offset + detune, blended in through its mix gain
      const ratio=octMul*Math.pow(2,(p.osc2semi||0)/12);
      const o2=c.createOscillator();o2.type=p.osc2wave||"sawtooth";o2.frequency.value=freq*ratio;
      if(p.osc2det)o2.detune.value=p.osc2det;
      const mg=c.createGain();mg.gain.value=(p.osc2mix==null?.5:p.osc2mix);
      o2.connect(mg);mg.connect(f);o2.start();v.oscs.push({o:o2,mult:ratio});}   // mult:ratio → glides with the note
    if(Y.det!=null)this._detPair(v,f,p.wave,freq,octMul,Y.det);   // Y-steered unison (silent at 0)
    }
    // vibrato LFO -> oscillator detune (depth driven live from device twist) — the signature twist-vibrato
    const lfo=c.createOscillator();lfo.type="sine";lfo.frequency.value=5.6;
    const lg=c.createGain();lg.gain.value=0;lfo.connect(lg);
    for(const it of v.oscs)if(it.o.detune)lg.connect(it.o.detune);
    lfo.start();v.oscs.push({o:lfo,mult:0});v.lfoG=lg;
    if(Y.vib>0)lg.gain.value=Y.vib*60;   // Y steers vibrato depth (cents) — same scale as the twist one
    if(ec&&p.legato){   // curved: attack 0 → 1, then (sus < 1) decay 1 → sus as one curve on env (_envPair)
      const a=A(.01),sus=(p.sus==null?1:p.sus);
      if(sus<1){this._envGo(v,g,t);this._envPair(v,0,1,sus,p.envC[0],p.envC[1],t,a,D(.2));}
      else this._envAtk(v,g,t,a);}
    else if(ec){   // curved pluck: attack and decay to silence as one curve; the voice ends right after it
      const vel=.25+.75*Math.max(0,Math.min(1,Y.lvl)),a=A(.005),d=D(.3);
      v.gTarget=p.lvl*vel*vs;this._envGo(v,g,t);
      this._autoStop(v,this._envPair(v,0,1,0,p.envC[0],p.envC[1],t,a,d)+.25);}
    else if(p.legato){g.gain.setTargetAtTime(v.gTarget,t,Math.max(.005,A(.01)/3));
      const sus=(p.sus==null?1:p.sus);
      if(sus<1)g.gain.setTargetAtTime(p.lvl*sus*vs,t+A(.01)+.005,Math.max(.01,D(.2)/3));}   // decay → sustain (sus=1 = old flat hold)
    else{   // retrig: attack then natural exponential decay, velocity from Y
      const vel=.25+.75*Math.max(0,Math.min(1,Y.lvl));
      v.gTarget=p.lvl*vel*vs;g.gain.setTargetAtTime(v.gTarget,t,Math.max(.003,A(.005)/3));
      g.gain.setTargetAtTime(0,t+A(.005)+.02,D(.3)/3);
      this._autoStop(v,A(.005)+D(.3)*4+.3);
    }
    return v;
  },
  _autoStop(v,after){
    setTimeout(()=>{this._kill(v);},Math.max(50,after*1000));},
  _kill(v){if(!v||v.stopped)return;v.stopped=true;
    const tails=v._bus&&v._bus.tails;if(tails){const i=tails.indexOf(v);if(i>=0)tails.splice(i,1);}
    try{for(const it of v.oscs)try{it.o.stop();}catch(e){}v.g.disconnect();if(v.env)v.env.disconnect();}catch(e){}},
  _release(v){if(!v||v.stopped)return;const p=v.p,t=this.ctx.currentTime;
    const rel=(v.decY!=null)?v.decY:(p.rel||.2);   // Y-steered tail, read at the moment the finger leaves
    if(v.env){this._envRel(v,t,rel);return;}       // curved envelope: the tail runs on env, g keeps the level
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setTargetAtTime(0,t,Math.max(.01,rel/3));
    this._autoStop(v,rel*4+.15);},
  // the release of a curved voice: hold env where it stands (cancelAndHoldAtTime cuts a running attack or decay
  // cleanly) and lay the release curve from that very value down to 0. An engine without cancelAndHoldAtTime
  // (Firefox), or one that still refuses the curve, gets the plain exponential tail on env; and if even that is
  // refused (a curve still running blocks new events in older engines) the voice gain fades as it always did.
  // One t (read once in _release) for the hold and the curve; were the clock to move between them, the browser clamps
  // the curve to a later start, which still begins at or after the hold — never inside anything.
  _envRel(v,t,rel){const e=v.env.gain,from=Math.max(0,this._envVal(v,t));
    if(typeof e.cancelAndHoldAtTime==="function"){
      try{e.cancelAndHoldAtTime(t);this._envSeg(v,from,0,v.p.envC[2],t,rel);this._autoStop(v,rel+.12);return;}catch(err){}}
    try{e.cancelScheduledValues(t);e.setValueAtTime(from,t);e.setTargetAtTime(0,t,Math.max(.01,rel/3));}
    catch(err){v.g.gain.cancelScheduledValues(t);v.g.gain.setTargetAtTime(0,t,Math.max(.01,rel/3));}
    this._autoStop(v,rel*4+.15);},
  // retrig spawn with a polyphony cap: old voices go to the BUS's bounded tail pool (oldest killed),
  // plus a short per-source spawn throttle so scrubbing can't stack hundreds of voices
  _spawnRetrig(bus,src,p,note,y,velScale){
    const t=this.ctx.currentTime,last=bus._lastSpawn[src];
    if(last!=null&&t-last<.03&&bus.voices[src]&&bus.voices[src].p===p)return false;
    bus._lastSpawn[src]=t;
    const old=bus.voices[src];
    if(old&&!old.stopped){this._release(old);bus.tails.push(old);}
    while(bus.tails.length>12)this._kill(bus.tails.shift());
    const v=this._mkVoice(bus,p,padFreq(note),y,velScale);v.note=note;bus.voices[src]=v;
    return true;
  },
  gateOn(inst,src,note,y,velScale){   // velScale (default 1.0) = velocity-from-motion multiplier for NEW notes
    if(!this.ensure())return;this.resume();
    const bus=this.bus(inst);if(!bus)return;
    const p=padPatchFor(inst.sound);
    const Y=this._yMap(inst,y);
    if(p.legato||p.noise){const old=bus.voices[src];if(old)this._release(old);
      const v=this._mkVoice(bus,p,padFreq(note),Y,velScale);v.note=note;bus.voices[src]=v;}
    else this._spawnRetrig(bus,src,p,note,Y,velScale);
    if(typeof _padWake==="function")_padWake();   // ECONOMY MODE: a note-on (seq/lab/motion) wakes the loop
  },
  update(inst,src,note,y,twistAbs){
    const bus=this.buses[inst.id];if(!bus){this.gateOn(inst,src,note,y);return;}
    const v=bus.voices[src],p=padPatchFor(inst.sound);
    if(!v||v.p!==p){this.gateOn(inst,src,note,y);return;}
    // SUPERPŁYNNE: pitch is a continuous number, so there is nothing to "jump" to. A struck sound
    // (marimba, pluck) cannot slide in the physical world — but its oscillators can be bent while
    // the bar still rings, and that is the whole point of this mode. The first attempt re-struck the
    // voice whenever the pitch had moved a semitone, which is precisely the stepping it was meant
    // to remove: it sounded like a scale, not a slide.
    const free=(inst.glideMode==="free");
    const hard=(!free&&inst.glideMode==="hard");
    if(v.stopped){
      // a one-shot that decayed naturally must NOT re-fire while held on the same note — except in
      // free mode, where "the same note" is a moving target: the ring has faded, so the alternative
      // is silence, and the fresh strike lands on the exact pitch the finger is at (never a step)
      if(!free&&!p.legato&&!p.noise&&note===v.note)return;
      this.gateOn(inst,src,note,y);return;
    }
    const c=this.ctx,t=c.currentTime;
    const Y=this._yMap(inst,y);
    // LIVE Y TARGETS — the ones a ringing voice can still be steered by. Attack and the filter kick
    // are deliberately NOT here: both are things that happen AT the strike, so they land on the next
    // note (the hint under the select says so rather than letting the finger move nothing).
    if(Y.dec!=null)v.decY=this._yExp(this.Y_DEC,Y.dec);
    if(Y.q!=null&&v.f)v.f.Q.setTargetAtTime(this._yExp(this.Y_Q,Y.q),t,.05);
    if(Y.det!=null)this._setDet(v,Y.det);
    if(Y.drive!=null)this._setDrive(v,Y.drive);
    // A struck bar fades. With a finger held down in free mode the sweep would run into silence and
    // then wait for _autoStop, so once the ring has decayed to a few percent the voice is struck
    // again AT THE CURRENT PITCH — a roll, which is exactly how a marimba sustains a note in the
    // real world. The pitch never steps; only the attack repeats, paced by the patch's own decay.
    if(free&&!p.legato&&!p.noise&&(t-v.bornAt)>((p.att||.005)+(v.decY!=null?v.decY:(p.dec||.3))*1.2)){
      this.gateOn(inst,src,note,y);return;
    }
    if(p.noise){
      if(v.f)v.f.frequency.setTargetAtTime(padFreq(note),t,hard?.008:(free?.02:.08));
      v.g.gain.setTargetAtTime(p.lvl*(.3+.7*Y.lvl),t,.05);
      v.note=note;return;
    }
    if(note!==v.note){
      if(p.legato||free){   // free: bend whatever is ringing, struck or held — never re-strike it
        // transition mode — kept clearly distinct so the choice is always audible:
        //   Skokowe (hard) = instant quantized jump (no slur, even between adjacent notes)
        //   Płynne (smooth) = real portamento; the glide LENGTHENS with the interval so big leaps
        //                     sweep noticeably while small steps still slide (never a silent no-op)
        const f1=padFreq(v.note), f2=padFreq(note);
        if(hard){
          for(const it of v.oscs)if(it.mult){const fp=it.o.frequency;
            fp.cancelScheduledValues(t);fp.setValueAtTime(f2*it.mult,t);}   // kill any in-flight smooth ramp → clean instant jump
          this._setSmpRate(v,note,t,0,true);
        }else{
          const semis=Math.abs(12*Math.log2((f2||1)/(f1||1)));
          // interval-scaled glide, but the patch's Glide sets a FLOOR so a slow-glide sound slides
          // audibly even on small steps. Built-ins (glide ≤ .09s) never exceed the interval term → unchanged.
          const dur=Math.min(.6,Math.max(.09+semis*.03,p.glide||0));   // ~1 semitone→.12s … octave→.36s … Glide up to .6s
          // TRUE portamento: setTargetAtTime glides from the oscillator's CURRENT (mid-slide) value,
          // so scrubbing across many notes reads as ONE continuous glissando. Do NOT cancel or
          // setValueAtTime first — that teleports the pitch back to the previous note whenever a new
          // note interrupts an in-flight ramp (every ~16 ms while dragging fast), which turns smooth
          // mode into audible stair-stepping. A follow-up setTargetAtTime continues from wherever the
          // glide currently is.
          const tau=free?.02:Math.max(.012,dur/3);   // setTargetAtTime reaches ~95% of target after ~3·tau ≈ dur
          for(const it of v.oscs)if(it.mult){
            it.o.frequency.setTargetAtTime(Math.max(1,f2*it.mult),t,tau);}
          this._setSmpRate(v,note,t,tau,false);
        }
        v.note=note;}
      else{this._spawnRetrig(bus,src,p,note,Y);return;}
    }
    // brass swell must finish before Y starts steering the cutoff
    if((p.legato||free)&&v.f&&!(p.fSwell&&t-v.bornAt<p.fSwell*1.5))
      v.f.frequency.setTargetAtTime(this._cut(p,Y.cut),t,.035);
    // "Tylko głośność": a held note has to get quieter as the finger drops, so the gain follows Y
    // live. Only in that mode — under "both" the level has always been fixed at the strike and
    // changing that would rewrite how every existing pad sounds.
    if(Y.mode==="vol"&&p.legato&&!p.noise){
      const tgt=p.lvl*(.25+.75*Y.lvl)*(v.velScale||1);
      v.gTarget=tgt;v.g.gain.setTargetAtTime(tgt,t,.05);}
    // vibrato depth (cents): the larger of "twist speed" and "whatever Y is steering"
    if(v.lfoG){const cents=Math.max((inst.vib&&twistAbs)?Math.min(60,twistAbs*.16):0,(Y.vib||0)*60);
      v.lfoG.gain.setTargetAtTime(cents,t,.08);}
  },
  gateOff(inst,src){const bus=this.buses[inst.id];if(!bus)return;const v=bus.voices[src];if(v){this._release(v);delete bus.voices[src];}},
  gateOffPad(inst){const bus=this.buses[inst&&inst.id];if(!bus)return;for(const src of Object.keys(bus.voices))this.gateOff(inst,src);},
  gateOffAll(){for(const p of XPAD.pads)this.gateOffPad(p);for(const p of (XPAD.seqPads||[]))this.gateOffPad(p);},
};

