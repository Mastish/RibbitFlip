"use strict";
// ===== SoundScreens: the oscilloscope of the sound editor (Synth › Brzmienia) — a visualisation of the lab bus =====
// A round lamp under a glass dome with a control desk beside it (stage E5), rendered with the recipe of the pads'
// "Neon" background (rf-24b): bulged glass, phosphor, graticule, glass glare, a felt housing with a stitch ring. It
// shows the live sound of the lab bus in one picture, polar: the waveform is a pink RING held in a band of the dial
// (RING_LO..RING_HI round RING0, triggered on a rising zero, so a held note stands still), the spectrum a green SUN of
// 16 short rays outside that band, the frogs (the notes that sound) sit on the rim at the angle of their pitch class,
// and the middle keeps the beam: a bright dot that wanders a slow Lissajous figure (2026-10-03; until then it rested
// in the centre), faster and wider with the level, and leaves a phosphor trail.
// The phosphor persists: two textures ping-pong, so movement leaves trails ("skop" draws the phosphor, "skop-blit"
// lays scanlines, glass and housing on top). The desk: the legend (what the pink and the green trace are — no text
// on the glass since 2026-10-03), the preview keys, a 12-LED level meter (vuLeds) and "Powiększ" (a wider column).
// STAGE E6 (2026-10-02) took all editing out of the lamp: the wave, the equaliser and the envelope are edited on flat
// panels in the module cards (rf-25e SoundEditors), which own the edit state and the patch I/O (readInto / load).
// STAGE E7 (2026-10-03) made it a CRT through and through: one picture style only (the line style, its rotary switch
// and rf.skopStyle went), a stronger dome (K .30), longer trails (TAU .5 s), scanlines and a faint phosphor mask that
// bend with the dome, and a heavier glass (Fresnel rim, brighter glare, a sharp reflected arc at the top, a thin
// tinted fringe at the rim). The panels of rf-25e get the same recipe in a mild dose (their own shader "crt").
// This file keeps the pure maths both use — the wave (shape, dft, fromHarmonics, harmonicsOf, smooth), the
// equaliser's response and axes (fx, xf, gy, yg, eqR, eqMag, eqCurve) and the envelope's geometry (envK … envHandles);
// rf-21 plays the same PeriodicWave as dft and keeps copies of envShape / envCurve (harness (k), (n)).
// Decisions D1–D8 and the stages live in the project note "Oscyloskop — ekrany CRT w Bibliotece dźwięków"; still in
// force: D7 the shader is registered from OUTSIDE as PadPlate._fs.skop (rf-24b untouched, and it is not on the pad
// background list) · D8 reduced motion = T 0, no hit flicker, no persistence.
// Must load in node `vm` with no DOM (tests/sound_screens_harness.mjs): document / window are touched only inside
// functions, and the pure helpers (dft, fromHarmonics, discToGlass, shape, smooth, eqMag, envShape, envCurve,
// envLayout, envPoly, envFilter, envHandles, vuLeds, phosDecay) live on the object.
// The JS half of the dome (glassToPic / picToGlass, dome / undome, glassToDisc) and envAt went out in the review round
// of 2026-10-02: nothing calls them since stage E6 (the lamp takes no pointer, the panels map linearly), and the
// shader does the dome on its own.

// Geometry shared by the shader and the JS below — change BOTH (harness (j), (o) compare the numbers with the
// shader's `const float F=…` line). All lengths are CSS px: the glass box is a square, the glass radius is
// Rg = min(W, H)/2 − F, and the HW px housing ring sits inside the F px margin (the 6 px left over carry the felt
// shadow drawn by CSS, which clips the canvases at that radius).
//   sc = (point − centre)/Rg, Y up: the glass is |sc| ≤ 1 (discToGlass places the overlay's captions on it). The dome
//   (shader only): the PICTURE point seen at sc is pc = sc·(1 + K·|sc|²). The polar picture is drawn on the glass
//   (sc); the phosphor's cloud, the scanlines and the phosphor mask lie on the picture (pc), so they bulge with it. K
//   lives here only so the harness can hold the shader to the number it was built with.
const SoundScreens={
  F:12, HW:6, K:.30,    // F, HW were 32, 26 until 2026-10-03, then 19, 13; both read as too heavy: a thin 6 px ring now
  TAU:.5,            // phosphor persistence: a trace fades as exp(−t/TAU), t in s (phosDecay)
  KICK:4.5,          // a request from outside keeps frames going for KICK·TAU s: a full trail is gone by then (e^−4.5 ≈ 1 %)
  FROG_R:.9,         // the frogs sit on the rim at this radius (glass radii), at the angle of their pitch class
  // THE BANDS of the polar picture (stage E8, glass radii; the shader's `const float RW0=…` line has the same numbers,
  // harness (j) compares): the waveform ring runs round RING0 and never leaves RING_LO..RING_HI, so a loud sound no
  // longer draws pink lines into the middle; the sun's rays start at SUN0 (just outside the band) and are at most SUN_L
  // long. The middle (under ~.5) is left to the phosphor, the graticule and the beam's rest point.
  RING0:.70, RING_LO:.56, RING_HI:.84, SUN0:.86, SUN_L:.12,
  // the equaliser's axes in picture coords (rf-25e draws and edits on them): x 0..1 = EQ_F0..EQ_F1 on a log scale,
  // y: 0 dB at EQ_Y, ±EQ_G dB at EQ_Y ± EQ_A
  EQ_F0:40, EQ_F1:16000, EQ_G:18, EQ_Y:.5, EQ_A:.38,
  // the envelope's axes in picture coords: time runs from ENV_X0 to ENV_X1, silence at ENV_Y0, the peak at ENV_Y1; the
  // sustain plateau has a fixed width ENV_H (legato only). The amber filter envelope has its own zero line ENV_FZ and
  // swings ±ENV_FA at full amount.
  ENV_X0:.04, ENV_X1:.96, ENV_H:.22, ENV_Y0:.06, ENV_Y1:.94, ENV_FZ:.5, ENV_FA:.4,
  // THE BEAM (the dot in the middle moves like on a scope and leaves a trail): a Lissajous
  // figure x = sin(2π·a), y = sin(2π·b + π/4), turned by c, amplitude BEAM_A0 + BEAM_A1·level, kept within BEAM_R of
  // the centre (the ring's band starts at .56). The phases run at BEAM_FA / BEAM_FB / BEAM_FC turns a second, the
  // first two (1 + BEAM_S·level) times faster while it sounds; a rich wave ripples the radius (BEAM_W·level). Each
  // frame draws the path since the last one as BEAM_N points (the shader's BL[12], so the trail has no gaps at any
  // frame rate) and the persistence fades it. In silence the lamp keeps rendering only for the beam, at most once
  // every BEAM_IDLE_MS (~30 fps), and only while the glass is on screen; reduced motion = the dot rests in the centre.
  BEAM_R:.42, BEAM_A0:.24, BEAM_A1:.12, BEAM_FA:.41, BEAM_FB:.29, BEAM_FC:.025, BEAM_S:2.2, BEAM_W:.12, BEAM_N:12, BEAM_IDLE_MS:30,
  _st:null, _fail:false, _last:-1, _raf:0, _inited:false, _inst:null, _U:null, _dirty:false, _wasLive:false,

  // ---------------- pure helpers (no DOM) ----------------
  // the four built-in WebAudio waves as 64 samples of one period, phase-aligned with what OscillatorNode plays
  shape(w){
    const c=this._shapes||(this._shapes={});if(c[w])return c[w];
    const o=new Float32Array(64);
    for(let n=0;n<64;n++){const ph=n/64;
      o[n]=w==="square"?(ph<.5?1:-1)
        :w==="sawtooth"?(ph<.5?2*ph:2*ph-2)
        :w==="triangle"?(ph<.25?4*ph:(ph<.75?2-4*ph:4*ph-4))
        :Math.sin(2*Math.PI*ph);}
    return c[w]=o;},
  sine(){return Float32Array.from(this.shape("sine"));},
  // Fourier coefficients of one period, in the shape createPeriodicWave takes: index k = harmonic k (0 = DC, left 0).
  // Convention: x[n] = Σ real[k]·cos(2πkn/N) + imag[k]·sin(2πkn/N), so a sine gives imag[1] = +1. The Nyquist
  // term (k = N/2) takes 1/N instead of 2/N — that is the exact inverse; rf-21 _pwave computes the same.
  dft(wt){
    const N=wt.length,K=N>>1,real=new Float32Array(K+1),imag=new Float32Array(K+1);
    for(let k=1;k<=K;k++){let a=0,b=0;
      for(let n=0;n<N;n++){const ang=2*Math.PI*k*n/N,v=+wt[n]||0;a+=v*Math.cos(ang);b+=v*Math.sin(ang);}
      const sc=(k===K?1:2)/N;real[k]=a*sc;imag[k]=b*sc;}
    return {real,imag};},
  // drawbars → 64 samples: a sum of sines (bar k = harmonic k+1), DC removed, normalised to a peak of 1.
  // All bars at zero = silence (a flat line), which is what the wave panel shows too.
  fromHarmonics(amps){
    const o=new Float32Array(64),M=Math.min(32,amps.length);
    for(let n=0;n<64;n++){let s=0;for(let k=0;k<M;k++)s+=(+amps[k]||0)*Math.sin(2*Math.PI*(k+1)*n/64);o[n]=s;}
    let m=0;for(let n=0;n<64;n++)m+=o[n];m/=64;
    let pk=0;for(let n=0;n<64;n++){o[n]-=m;pk=Math.max(pk,Math.abs(o[n]));}
    if(pk>1e-9)for(let n=0;n<64;n++)o[n]/=pk;
    return o;},
  // a wave → its 16 bars (magnitude of harmonics 1..16, the loudest = 1). Phase is dropped on purpose: bars are
  // drawbars, they set loudness only, so pulling one bar re-synthesises the wave from plain sines.
  harmonicsOf(wt){
    const d=this.dft(wt),o=new Float32Array(16);let mx=0;
    for(let k=0;k<16;k++){o[k]=Math.hypot(d.real[k+1]||0,d.imag[k+1]||0);mx=Math.max(mx,o[k]);}
    if(mx>1e-9)for(let k=0;k<16;k++)o[k]/=mx;
    return o;},
  // "Wygładź": one pass of a 3-point [¼ ½ ¼] filter with wrap-around (the wave is periodic)
  smooth(wt){const N=wt.length,o=new Float32Array(N);
    for(let n=0;n<N;n++)o[n]=.25*wt[(n+N-1)%N]+.5*wt[n]+.25*wt[(n+1)%N];return o;},
  // ---- the round lamp (stage E5): the disc of the glass box ----
  // the disc of the box: its centre and the glass radius (CSS px)
  _disc(W,H){return {cx:W/2,cy:H/2,R:Math.max(1,Math.min(W,H)/2-this.F)};},
  // sc, the unit disc (Y up; |sc| ≤ 1 is the glass) → CSS px from the top-left of the glass box
  // the beam's phases dt ms later at this level
  beamStep(bm,dt,lv){const s=1+this.BEAM_S*Math.min(1,Math.max(0,+lv||0)),t=Math.max(0,+dt||0)/1000;
    return {a:bm.a+t*this.BEAM_FA*s,b:bm.b+t*this.BEAM_FB*s,c:bm.c+t*this.BEAM_FC};},
  // where the beam is at phases ph (glass radii, Y up); wf = the 64 samples of the sound (rf-24b _feat) or nothing
  beamAt(ph,lv,wf){const L=Math.min(1,Math.max(0,+lv||0)),TP=2*Math.PI,A=this.BEAM_A0+this.BEAM_A1*L;
    const x0=Math.sin(TP*ph.a),y0=Math.sin(TP*ph.b+Math.PI/4),cr=Math.cos(TP*ph.c),sr=Math.sin(TP*ph.c);
    let w=1;if(wf&&L>0){const i=Math.floor((((ph.a*16)%1)+1)%1*64)&63;w=1+this.BEAM_W*L*Math.max(-1,Math.min(1,+wf[i]||0));}
    let x=A*w*(x0*cr-y0*sr),y=A*w*(x0*sr+y0*cr);const r=Math.hypot(x,y);
    if(r>this.BEAM_R){x*=this.BEAM_R/r;y*=this.BEAM_R/r;}
    return [x,y];},
  // the path from phases p0 to p1 as BEAM_N points into out (x, y pairs); returns the count
  beamPath(p0,p1,lv,wf,out){const N=this.BEAM_N;
    for(let k=0;k<N;k++){const u=k/(N-1),q=this.beamAt({a:p0.a+(p1.a-p0.a)*u,b:p0.b+(p1.b-p0.b)*u,c:p0.c+(p1.c-p0.c)*u},lv,wf);
      out[2*k]=q[0];out[2*k+1]=q[1];}
    return N;},
  discToGlass(x,y,W,H){const d=this._disc(W,H);return {x:d.cx+x*d.R,y:d.cy-y*d.R};},
  // the level meter of the desk: how many of its 12 LEDs a level lights. Log scale: 1 LED from lv .02, all 12 from
  // .9 (the RMS level of _feat, 0..1); anything below .02, or not a number, is dark.
  vuLeds(lv){lv=+lv;if(!(lv>=.02))return 0;if(lv>=.9)return 12;
    return Math.min(11,1+Math.floor(11*Math.log(lv/.02)/Math.log(.9/.02)));},
  // persistence: how much of the previous frame's phosphor is left after dtMs; reduced motion = none (no trails)
  phosDecay(dtMs,still){return still?0:Math.exp(-Math.max(0,+dtMs||0)/1000/this.TAU);},
  // BARWA axes: picture x ↔ Hz (fx(x) = 40·400^x, so 100 Hz / 1 kHz / 10 kHz sit at .153 / .537 / .922) and
  // picture y ↔ dB (clamped to the field: the curve may sum past ±18 dB, the rings never go there)
  fx(x){return this.EQ_F0*Math.pow(this.EQ_F1/this.EQ_F0,x);},
  xf(f){return Math.log(f/this.EQ_F0)/Math.log(this.EQ_F1/this.EQ_F0);},
  gy(g){return Math.max(0,Math.min(1,this.EQ_Y+g/this.EQ_G*this.EQ_A));},
  yg(y){return Math.max(-this.EQ_G,Math.min(this.EQ_G,(y-this.EQ_Y)/this.EQ_A*this.EQ_G));},
  // Ring radius (CSS px) from the band's Q: a narrow band = a small ring. 7 + 14/q, clamped 7..24.
  eqR(q){return Math.max(7,Math.min(24,7+14/q));},
  // The equaliser's response in dB at fHz: the sum of the bands' |H(e^jw)|, each the RBJ "peaking EQ" biquad of the
  // Audio EQ Cookbook — exactly what the Web Audio spec prescribes for BiquadFilterNode type "peaking":
  //   A = 10^(g/40), w0 = 2π·f0/fs, α = sin(w0)/(2Q); b = (1+αA, −2cos w0, 1−αA), a = (1+α/A, −2cos w0, 1−α/A).
  // A band at or above Nyquist passes the sound through (the spec's special case), so it adds 0 dB.
  eqMag(bands,fHz,sampleRate){
    const fs=sampleRate>0?sampleRate:48000;if(!Array.isArray(bands)||!bands.length)return 0;
    const w=2*Math.PI*fHz/fs,cw=Math.cos(w),sw=Math.sin(w),c2=Math.cos(2*w),s2=Math.sin(2*w);let db=0;
    for(const b of bands){
      const f0=+b.f,g=+b.g,q=+b.q;if(!(f0>0&&f0<fs/2)||!g||!(q>0))continue;
      const A=Math.pow(10,g/40),w0=2*Math.PI*f0/fs,al=Math.sin(w0)/(2*q),k=-2*Math.cos(w0);
      const b0=1+al*A,b2=1-al*A,a0=1+al/A,a2=1-al/A;
      const nr=b0+k*cw+b2*c2,ni=-(k*sw+b2*s2),dr=a0+k*cw+a2*c2,di=-(k*sw+a2*s2);
      db+=10*Math.log10((nr*nr+ni*ni)/(dr*dr+di*di));}
    return db;},
  // the equaliser's curve: 64 points on the same log axis as the rings (x = i/63)
  eqCurve(bands,sampleRate){const o=new Float32Array(64);
    for(let i=0;i<64;i++)o[i]=this.eqMag(bands,this.fx(i/63),sampleRate);return o;},
  // ---- OBWIEDNIA (stage E3). Shape of one segment, s 0..1 → 0..1, from the bend c (−1..1) through a steepness
  //      k = envK(c). c 0 = the shape a sound without bends plays today (setTargetAtTime, tau = time/3: k 3, here
  //      scaled to land exactly on the end value); c < 0 sharper (k = 3·4^(−c), c −1: k 12); 0 < c ≤ .5 gentler down
  //      to a straight line (k = 3·(1 − 2c), c .5: k 0); c > .5 convex, slow start and fast end (k = −12·(c − .5),
  //      c 1: k −6). k > 0: (1 − e^(−ks))/(1 − e^(−k)); k ≈ 0: s; k < 0: (e^(−ks) − 1)/(e^(−k) − 1).
  //      rf-21 _envShape/_envCurve are copies (the engine needs no screen); harness (n) keeps them equal. ----
  envK(c){c=+c||0;return c<=0?3*Math.pow(4,-c):(c<=.5?3*(1-2*c):-12*(c-.5));},
  envShape(s,c){s=s<=0?0:(s>=1?1:s);const k=this.envK(c);
    return k>1e-6?(1-Math.exp(-k*s))/(1-Math.exp(-k)):(k<-1e-6?(Math.exp(-k*s)-1)/(Math.exp(-k)-1):s);},
  // the inverse in s: which s gives the level fraction y (envPoly spaces points with it)
  envInv(y,c){y=y<=0?0:(y>=1?1:y);const k=this.envK(c);
    return k>1e-6?-Math.log(1-y*(1-Math.exp(-k)))/k:(k<-1e-6?Math.log(1+y*(Math.exp(-k)-1))/-k:y);},
  // n values from → to along that shape, the ends exact: what rf-21 hands to setValueCurveAtTime
  envCurve(from,to,c,n){n=Math.max(2,n|0);const o=new Float32Array(n);
    for(let i=0;i<n;i++)o[i]=from+(to-from)*this.envShape(i/(n-1),c);
    o[0]=from;o[n-1]=to;return o;},
  // a bend ring sits ON the curve in the middle of its segment, at the fraction envMid(c) of the way from the start
  // level to the end level. envMid falls as c grows, so envCOf finds c back by bisection (50 halvings, far below
  // 1e-4) and a dragged ring lands under the finger; the fraction is clamped to what c −1..1 can reach.
  envMid(c){return this.envShape(.5,c);},
  envCOf(f){f=+f;if(!Number.isFinite(f))f=0;let lo=-1,hi=1;
    if(f>=this.envMid(-1))return -1;if(f<=this.envMid(1))return 1;
    for(let i=0;i<50;i++){const m=(lo+hi)/2;if(this.envMid(m)>f)lo=m;else hi=m;}
    return (lo+hi)/2;},
  // The time axis (seconds in, picture coords out). Attack [0, A] and decay [A, A+D] on one even scale; legato then
  // holds the sustain level over a plateau of a FIXED width ENV_H (it stands for "as long as you hold") and releases
  // over R. The timed part fills the width minus the plateau: spu (seconds per picture unit) = (A+D+R)/(width − H).
  // The scale runs on through the plateau (the grid and the filter envelope use it), so the plateau reads as a hold
  // of ENV_H·spu seconds. While a handle is dragged the caller passes the scale frozen at pointerdown (`spu`), or
  // the axis would rescale under the finger.
  envLayout(att,dec,sus,rel,legato,spu){
    const X0=this.ENV_X0,Y0=this.ENV_Y0,Y1=this.ENV_Y1,H=legato?this.ENV_H:0;
    const A=Math.max(0,+att||0),D=Math.max(0,+dec||0),R=legato?Math.max(0,+rel||0):0;
    const k=spu>0?spu:((A+D+R)/(this.ENV_X1-X0-H)||1);
    const ys=legato?Y0+Math.max(0,Math.min(1,+sus||0))*(Y1-Y0):Y0;
    const o={legato:!!legato,spu:k,ys,x0:X0,start:{x:X0,y:Y0},a:{x:X0+A/k,y:Y1},d:{x:X0+(A+D)/k,y:ys}};
    if(legato){o.s={x:o.d.x+H,y:ys};o.r={x:o.s.x+R/k,y:Y0};}
    o.end=legato?o.r.x:o.d.x;
    o.segs=[[o.start,o.a,0],[o.a,o.d,1]];if(legato)o.segs.push([o.s,o.r,2]);   // bendable: [from, to, index in envC]
    return o;},
  xOfT(lay,t){return lay.x0+t/lay.spu;},
  // The lime curve of the envelope panel (rf-25e): a polyline of 32 points (x, y), not 64 samples on an even grid as in
  // Fala and Barwa: a 12 ms attack is narrower than one grid step, and the even grid cut its peak off (the ring sat
  // high above the line). Each bendable segment gets its own points, spaced half evenly in x and half evenly in
  // level (s = (u + envInv(u))/2), so the steep start or end of a bend is followed too. Lead-in and tail run flat at
  // silence past both edges (the panel's margin shows picture x < 0 and > 1); x never falls; spare points repeat the last.
  envPoly(lay,c){
    const X=new Float32Array(32),Y=new Float32Array(32),n=lay.legato?[9,9,9]:[14,15];let j=0;
    const put=(x,y)=>{if(j<32){X[j]=x;Y[j]=y;j++;}};
    put(Math.min(-.06,lay.start.x-.1),this.ENV_Y0);put(lay.start.x,lay.start.y);
    lay.segs.forEach(([p,q,i],si)=>{
      if(si===2)put(lay.s.x,lay.s.y);   // the plateau ends where the release starts
      const cc=c[i]||0;
      for(let k=1;k<=n[si];k++){const u=k/n[si],s=(u+this.envInv(u,cc))/2;put(p.x+(q.x-p.x)*s,p.y+(q.y-p.y)*this.envShape(s,cc));}});
    put(Math.max(1.06,lay.end+.1),this.ENV_Y0);
    while(j<32)put(X[j-1],Y[j-1]);
    return {x:X,y:Y};},
  // the amber curve: the filter envelope on the same time axis, 64 samples on the even grid (it has no corner to
  // lose). rf-21 _fEnvNode decays its offset with tau fEnvT/3, so about 5 % is left after fEnvT. Before the note
  // (x < ENV_X0) it holds its start value.
  envFilter(fEnv,fEnvT,spu){
    const o=new Float32Array(64),T=Math.max(.001,+fEnvT||.2),a=Math.max(-1,Math.min(1,+fEnv||0));
    for(let i=0;i<64;i++){const t=Math.max(0,(i/63-this.ENV_X0)*spu);o[i]=this.ENV_FZ+a*this.ENV_FA*Math.exp(-3*t/T);}
    return o;},
  // the handles (picture coords). kind 1 = a point (yellow): a = top of the attack, d = end of the decay (legato:
  // also the sustain level), r = end of the release (legato only); kind 2 = a bend (small white ring) in the middle of
  // a segment that is not flat (ci = its index in envC); kind 3 = the filter envelope (amber): x its time, y its amount.
  envHandles(lay,c,fEnv,fEnvT){
    const h=[{id:"a",kind:1,x:lay.a.x,y:lay.a.y},{id:"d",kind:1,x:lay.d.x,y:lay.d.y}];
    if(lay.legato)h.push({id:"r",kind:1,x:lay.r.x,y:lay.r.y});
    for(const [p,q,i] of lay.segs){if(Math.abs(q.y-p.y)<.02)continue;
      h.push({id:"c"+i,kind:2,ci:i,x:(p.x+q.x)/2,y:p.y+(q.y-p.y)*this.envMid(c[i]||0)});}
    h.push({id:"f",kind:3,x:Math.min(.98,this.xOfT(lay,Math.max(0,+fEnvT||0))),
            y:this.ENV_FZ+Math.max(-1,Math.min(1,+fEnv||0))*this.ENV_FA});
    return h;},

  // ---------------- DOM: the lamp ----------------
  _labId(){return typeof LAB_ID!=="undefined"?LAB_ID:"__lab__";},
  _el(id){return typeof document!=="undefined"?document.getElementById(id):null;},
  // a draw on demand. Every request from outside (a resize, the editor opening, the language) marks the lamp dirty
  // (one render even while the lab is silent) and starts KICK·TAU of frames (_kick, see _render: 4.5 τ, 2.25 s at
  // τ .5), so the persistence trail of the last movement fades out instead of freezing on the glass; draw() asks for
  // its own next frame with self = true, which does neither.
  _req(self){if(!self){this._kick=typeof performance!=="undefined"?performance.now():0;this._dirty=true;}
    if(this._raf||typeof requestAnimationFrame!=="function")return;
    this._raf=requestAnimationFrame(()=>{this._raf=0;this.draw();});},
  init(){
    if(this._inited)return;
    const scope=this._el("skScope"),glass=this._el("skGlass"),ov=this._el("skOverlay");
    if(!scope||!glass||!ov)return;
    this._inited=true;this._scope=scope;this._glass=glass;this._ov=ov;
    // the desk: the level meter and "Powiększ" (localStorage, rf.skopBig); the preview keys belong to rf-25. A
    // style saved before stage E7 (rf.skopStyle) is simply never read: there is one picture now
    this._vuEl=this._el("skVu");this._vuN=-1;
    let big=false;try{big=localStorage.getItem("rf.skopBig")==="1";}catch(e){}
    this._setBig(big,false);
    const bb=this._el("skBig");if(bb)bb.addEventListener("click",()=>this._setBig(!scope.classList.contains("big"),true));
    // the pad loop only calls draw() while something sounds — opening the editor and resizing ask here. The GL
    // context is given back ONLY when the editor folds (and when the page goes away): labStopAll runs on every
    // "stop all" and on leaving the Synth tab, and dropping it there cost a new context and two shader compiles
    const box=this._el("soundEditor");
    if(box)box.addEventListener("toggle",e=>{if(e.target!==box)return;if(box.open)this._req();else{this._drop();this._vu(0);}});
    if(typeof window!=="undefined"&&typeof window.addEventListener==="function")window.addEventListener("pagehide",()=>this._drop());
    if(typeof ResizeObserver==="function"){try{new ResizeObserver(()=>this._req()).observe(glass);}catch(e){}}
    // the dial's size in the side column (_fit): the column's and the desk's heights decide it, so both are watched
    this._fit();
    if(typeof ResizeObserver==="function"){try{const ro=new ResizeObserver(()=>this._fit()),side=scope.closest?scope.closest(".se-side"):null,
      pn=scope.querySelector?scope.querySelector(".sk-panel"):null;if(side)ro.observe(side);if(pn)ro.observe(pn);
      // the page's height moves the column's place at rest (a line under the module's header comes or goes): --se-rest
      if(document.body)ro.observe(document.body);}catch(e){}}
    // the beam keeps frames going only while the glass is on screen (a narrow window scrolls the lamp away); the
    // glass carries no text since 2026-10-03, so a language switch no longer redraws it (the legend is HTML, rf-01)
    if(typeof IntersectionObserver==="function"){
      try{new IntersectionObserver(es=>{const e=es[es.length-1];this._vis=!!(e&&e.isIntersecting);if(this._vis)this._req();}).observe(glass);}catch(e){}}
  },
  // "Powiększ": the dial takes the whole column (up to 760 px) and the desk moves under it (CSS .sk-scope.big);
  // the ResizeObserver redraws it at the new size. In a low window (.low, see _fit) the same key reads "Pokaż ekran"
  // and swaps the dial with the list
  _setBig(on,save){const s=this._scope,b=this._el("skBig");if(!s)return;
    s.classList.toggle("big",!!on);if(b)b.setAttribute("aria-pressed",on?"true":"false");
    if(save){try{localStorage.setItem("rf.skopBig",on?"1":"0");}catch(e){}}
    this._fit();this._req();},
  // THE DIAL'S SIZE in the side column (the lamp stays in view and the column never scrolls; the
  // desk under it got smaller instead): the column's height minus the desk (the scope's height without the glass:
  // desk, padding, gap), the column's gap and the library's fixed rows (its content height without the list: search,
  // chips, padding) with LIST_ROWS rows of the list left; clamped to the scope's inner width and to GLASS_MIN px.
  // Measured, not a CSS constant: the desk wraps differently per width and language. Written as --sk-size on the
  // scope (css/30 reads it; the glass's ResizeObserver redraws). Nothing measured depends on the dial itself, so
  // there is no feedback loop; on the narrow layout (the column is static, not sticky) the property is removed and
  // css/30 rules.
  // THE LIST COMES FIRST: when LIST_ROWS rows and a GLASS_MIN dial do not both fit (a window lower than about
  // 800 px), the scope goes `.low`: the dial hides and "Pokaż ekran" swaps it with the list in this same column
  // (`.low.big` hides the library instead, css/30). The library's fixed rows are kept from the last measurement
  // with the library on screen, so hiding it never changes the answer that hid it.
  LIST_ROWS:4,GLASS_MIN:120,LIST_MIN:72,
  // LIST_ROWS rows of the list in px: a visible row's height, the list's gap, padding and border
  _listMin(side){
    const list=side.querySelector(".se-list");if(!list)return this.LIST_MIN;
    const row=[...list.querySelectorAll(".se-row")].find(r=>!r.hidden&&r.offsetHeight>0);
    if(row)this._rowH=row.offsetHeight;
    if(!this._rowH)return this.LIST_MIN;
    const cs=getComputedStyle(list),n=this.LIST_ROWS,px=k=>parseFloat(cs[k])||0;
    return Math.ceil(n*this._rowH+(n-1)*px("rowGap")+px("paddingTop")+px("paddingBottom")+px("borderTopWidth")+px("borderBottomWidth"));},
  _measureRest(side){
    const sc=typeof document!=="undefined"&&document.scrollingElement;if(!sc||sc.scrollTop!==0)return false;
    const r=Math.max(0,Math.round(side.getBoundingClientRect().top-(parseFloat(getComputedStyle(side).top)||0)));
    if(r===this._rest)return false;this._rest=r;side.style.setProperty("--se-rest",r+"px");return true;},
  _fit(){
    const s=this._scope,g=this._glass;if(!s||!g||!s.closest||typeof getComputedStyle!=="function")return;
    const side=s.closest(".se-side");
    if(!side||!side.clientHeight||getComputedStyle(side).position!=="sticky"){
      s.classList.remove("low");
      if(this._fitV){this._fitV=0;s.style.removeProperty("--sk-size");}return;}
    // the column is sized for its stuck place, but the first view is the page at rest, where it starts a few px
    // lower (the pane's padding): measured at the top of the page and taken off the height (--se-rest, css/30), so
    // the list's last row is not under the window's edge before anything scrolls
    // (a late shift of the page above, e.g. fonts or a line that goes away, moves it without resizing anything, so
    // one more look follows every fit)
    this._measureRest(side);clearTimeout(this._restT);this._restT=setTimeout(()=>{if(this._measureRest(side))this._fit();},400);
    const lib=side.querySelector(".se-lib"),list=side.querySelector(".se-list"),cs=getComputedStyle(s);
    if(lib&&list&&getComputedStyle(lib).display!=="none")this._libFixed=lib.scrollHeight-list.offsetHeight;
    const fixed=this._libFixed||0,gap=parseFloat(getComputedStyle(side).rowGap)||0;
    const maxW=s.clientWidth-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0);
    const desk=s.offsetHeight-g.offsetHeight;
    const withList=side.clientHeight-desk-gap-fixed-this._listMin(side);
    const low=withList<this.GLASS_MIN,big=s.classList.contains("big");
    if(s.classList.contains("low")!==low){s.classList.toggle("low",low);this._req();}
    const avail=low&&big?side.clientHeight-desk:withList;
    const v=Math.max(this.GLASS_MIN,Math.min(Math.floor(maxW),Math.floor(avail)));
    if(v===this._fitV)return;this._fitV=v;s.style.setProperty("--sk-size",v+"px");},
  // the LEDs follow the level every frame, but the DOM is touched only when the count changes
  _vu(lv){const n=this.vuLeds(lv);if(n===this._vuN)return;this._vuN=n;
    const el=this._vuEl;if(!el)return;const L=el.children;for(let i=0;i<L.length;i++)L[i].classList.toggle("on",i<n);},
  // everything silenced (labStopAll: "stop all", the Synth tab left, the editor folding): the LEDs go dark and the
  // glass is wiped (the persistence trail, the smoothed sound features and the frogs), shown in one frame. The GL
  // context STAYS (it goes only with the editor folding or the page, see init). A lamp in the fallback (no WebGL2, or
  // a shader that failed) tries to build its context again on the next draw.
  sleep(){
    this._vu(0);this._fail=false;
    const s=this._st;
    if(s){s.f=null;s.spl=null;s.pts={};s.last=0;
      const P=s.pp,gl=s.gl;
      if(P&&gl){try{for(const f of P.fb){gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);}
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);}catch(e){}}}
    this._dirty=true;this._req(true);},
  // give the GL context back (the editor folded, the page hidden, or the context broke). The persistence textures
  // (st.pp) die with it; the panel colours are measured again and the fallback is tried again on the next draw
  _drop(){const s=this._st;this._st=null;this._BC=null;this._fail=false;if(!s)return;
    try{const x=s.gl&&s.gl.getExtension("WEBGL_lose_context");if(x)x.loseContext();}catch(e){}
    if(s.cv&&s.cv.parentNode)s.cv.parentNode.removeChild(s.cv);},
  // every lab voice that sounds is a frog behind the glass, on the rim: x = the angle of its pitch class as a fraction
  // of a turn, clockwise from 12 o'clock (C at the top), y = FROG_R, the radius in glass radii — the shader reads P.xy
  // as (angle, radius)
  _frogs(){
    const act={},b=(typeof PadAudio!=="undefined"&&PadAudio.buses)?PadAudio.buses[this._labId()]:null;if(!b)return act;
    for(const src in b.voices){const v=b.voices[src];if(!v||v.stopped)continue;
      const o=v.oscs&&v.oscs[0]&&v.oscs[0].o,fq=(o&&o.frequency)?o.frequency.value:0;
      const n=fq>0?69+12*Math.log2(fq/440):(Number.isFinite(v.note)?v.note:NaN);if(!Number.isFinite(n))continue;
      const pcl=((n%12)+12)%12;
      act[src]={x:pcl/12,y:this.FROG_R,color:"#ec1a83",note:n};}
    return act;},
  // the scope's own uniform BK (8 lanes): [6] = persistence (set by _render: the decay of the previous frame, −1 = one
  // pass straight to the canvas); the other lanes are unused (0). Lane 7 carried the picture style until stage E7.
  _uni(){const U=this._U||(this._U={BK:new Float32Array(8)});U.BK.fill(0);return U;},
  // the timestamp of the display frame: document.timeline.currentTime is the same number for every rAF callback of
  // one frame (the pad loop's and ours); node vm and very old engines fall back to the clock (rf-25e has the same)
  _frameT(){const tl=typeof document!=="undefined"&&document.timeline,t=tl?tl.currentTime:null;
    return typeof t==="number"&&Number.isFinite(t)?t:performance.now();},
  // does a lab voice sound, or ring out (released voices stay in `voices` until rf-21 stops them, the oldest go to
  // `tails`)? The pad loop calls draw() every frame while ANY pad sounds, and the lamp only shows the lab
  _labBusy(){const b=(typeof PadAudio!=="undefined"&&PadAudio.buses)?PadAudio.buses[this._labId()]:null;if(!b)return false;
    if(Array.isArray(b.tails)&&b.tails.length)return true;
    for(const s in b.voices){const v=b.voices[s];if(v&&!v.stopped)return true;}
    return false;},
  // no WebGL2: the LEDs follow the level the curve panels measure on the same analyser (SoundEditors._F.lv), as long
  // as they measured it lately (a folded card stops their meter; a stale level must not keep the LEDs, or this
  // lamp's frames, going); true = something still shows
  _vuFallback(now){
    const S=typeof SoundEditors!=="undefined"?SoundEditors:null,F=S&&S._F;
    const lv=F&&S._last>=0&&Math.abs(now-S._last)<=100?(+F.lv||0):0;
    this._vu(lv);return lv>.004;},
  // called every frame by labDraw (rf-25) while the pad loop runs, and on demand (_req) when it idles.
  // ONE render per display frame: a second call in the same frame only books the next frame while the picture still
  // eases out. (Until 2026-10-02 a call less than 8 ms after the last render was dropped WITHOUT booking one, so at
  // 120–144 Hz the fade-out after the last note stopped on the glass.) While pads play and the lab is silent the
  // lamp renders one last frame after the sound and then rests, instead of the whole shader on every frame of the
  // pad loop for a picture that no longer changes.
  // The moving beam (2026-10-03) keeps the lamp going in silence too, but at most every BEAM_IDLE_MS (_beamLive).
  draw(){
    if(typeof document==="undefined")return false;
    const box=this._el("soundEditor");if(!box||!box.open)return false;
    const wrap=this._glass;if(!wrap||wrap.offsetParent===null)return false;
    const W=wrap.clientWidth,H=wrap.clientHeight;if(!W||!H)return false;
    const now=this._frameT(),beam=this._beamLive();
    if(now===this._last){if(this._wasLive||this._dirty||beam)this._req(true);return true;}
    if(!this._dirty&&!this._wasLive&&!this._labBusy()){
      if(!beam)return true;
      if(now-this._last<this.BEAM_IDLE_MS){this._req(true);return true;}}
    this._last=now;this._dirty=false;
    const dpr=window.devicePixelRatio||1;let live=false;
    if(!this._fail&&typeof PadPlate!=="undefined"){
      try{live=this._render(wrap,W,H,dpr,now);}
      catch(e){console.warn("[sound-screens]",e);this._drop();this._fail=true;}}
    else if(typeof PadPlate==="undefined")this._fail=true;
    if(this._fail)live=this._vuFallback(now);
    this._overlay(W,H,dpr);
    this._wasLive=live;
    if(live||this._beamLive())this._req(true);   // keep easing out after the last note (and the last trail); the beam keeps moving
    return true;},
  // does the beam move? Only on the GL lamp (the fallback disc has none), with motion allowed, the glass on screen
  _beamLive(){return !!this._st&&!this._fail&&this._vis!==false&&!(typeof _prefersReducedMotion==="function"&&_prefersReducedMotion());},
  // PHOSPHOR PERSISTENCE (stage E5): two RGBA8 textures the size of the canvas, ping-pong. "skop" reads the previous
  // frame from one (HT, unit 0) and writes the new phosphor into the other; "skop-blit" lays glass and housing over
  // it onto the canvas. The texture holds the phosphor ONLY: fed back with the glare in it, the glare would pile up
  // frame on frame towards glare/(1 − decay). Rebuilt when the canvas changes size; it lives in st, so it dies with
  // the context (sleep). An incomplete framebuffer turns persistence off for this context (st.noPersist): one pass
  // straight to the canvas, as with reduced motion.
  _pp(st,pw,ph){
    const gl=st.gl;let P=st.pp;
    if(P&&P.w===pw&&P.h===ph)return P;
    const free=X=>{if(!X)return;X.tex.forEach(t=>gl.deleteTexture(t));X.fb.forEach(f=>gl.deleteFramebuffer(f));};
    free(P);st.pp=null;P={w:pw,h:ph,i:0,tex:[],fb:[]};let ok=true;
    for(let k=0;k<2&&ok;k++){
      const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,pw,ph,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      for(const [a,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])
        gl.texParameteri(gl.TEXTURE_2D,a,v);
      const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
      P.tex.push(t);P.fb.push(f);
      ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
      if(ok){gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);}}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);
    if(!ok){free(P);st.noPersist=true;return null;}
    return st.pp=P;},
  // BC for both shaders: [0] = the panel behind the lamp (the corners of the square; CSS clips them anyway, this is
  // the colour the housing's outer edge blends into), [1] = the housing felt (--sk-housing in css/29). Measured once
  // per context; defaults #fbf7ee and #2c2b2a.
  _bcol(){
    if(this._BC)return this._BC;
    const o=new Float32Array([.984,.969,.933,.173,.169,.165]);
    try{const cs=getComputedStyle(this._scope),P=typeof _plateRGB==="function"?_plateRGB:null;
      const bg=cs.backgroundColor||"",hs=cs.getPropertyValue("--sk-housing").trim();
      if(P&&/^rgb/.test(bg)&&!/,\s*0\)$/.test(bg))o.set(P(bg),0);
      if(P&&/^#[0-9a-f]{6}$/i.test(hs))o.set(P(hs),3);}catch(e){}
    return this._BC=o;},
  _render(wrap,W,H,dpr,now){
    let st=this._st;
    if(st&&(st.wrap!==wrap||!st.cv.isConnected||st.gl.isContextLost())){this._drop();st=null;}
    if(!st){st=PadPlate._mk(wrap);if(!st){this._fail=true;return false;}   // no WebGL2 → the dark disc in _overlay
      st.cv.className="sk-gl";this._st=st;}
    const pg=PadPlate._prog(st,"skop");   // a compile error throws → draw() switches to the fallback for good
    const dt=st.last?Math.min(100,now-st.last):16.67;st.last=now;
    const still=typeof _prefersReducedMotion==="function"&&_prefersReducedMotion();
    const inst=this._inst||(this._inst={id:this._labId(),act:{}});inst.id=this._labId();inst.act=this._frogs();
    const f=PadPlate._feat(inst,st,dt);
    const pw=Math.round(W*dpr),ph=Math.round(H*dpr);
    if(st.cv.width!==pw||st.cv.height!==ph){st.cv.width=pw;st.cv.height=ph;}
    const gl=st.gl,u=pg.u,bc=this._bcol(),dec=this.phosDecay(dt,still);
    // persistence on: the phosphor goes into the texture that is not the previous frame; a blit that does not
    // compile only turns persistence off (the scope itself works)
    let pp=dec>0&&!st.noPersist?this._pp(st,pw,ph):null,bp=null;
    if(pp){try{bp=PadPlate._prog(st,"skop-blit");}catch(e){console.warn("[sound-screens]",e);st.noPersist=true;pp=null;}}
    if(pp){gl.bindFramebuffer(gl.FRAMEBUFFER,pp.fb[1-pp.i]);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,pp.tex[pp.i]);}
    gl.viewport(0,0,pw,ph);gl.useProgram(pg.pr);
    // the same uniforms in the same order as PadPlate.draw (rf-24b)
    gl.uniform2f(u.R,pw,ph);gl.uniform1f(u.DPR,dpr);gl.uniform1f(u.T,still?0:now/1000);
    gl.uniform1f(u.LV,f.lv);gl.uniform1f(u.BA,f.ba);gl.uniform1f(u.MI,still?0:f.mi);gl.uniform1f(u.HI,still?0:f.hi);
    gl.uniform1f(u.KI,still?0:f.ki);gl.uniform1f(u.HC,f.hits||0);
    gl.uniform1fv(u.SP,f.sp);gl.uniform1fv(u.WF,f.wf);
    const list=Object.values(st.pts).sort((a,b)=>b.s-a.s).slice(0,4),P=new Float32Array(16);
    list.forEach((p,i)=>{P[i*4]=p.x;P[i*4+1]=p.y;P[i*4+2]=p.s;P[i*4+3]=p.seed;});
    gl.uniform4fv(u.P,P);gl.uniform1i(u.NP,list.length);
    const PC=new Float32Array(12);list.forEach((p,i)=>PC.set(p.rgb||[.925,.102,.514],i*3));gl.uniform3fv(u.PC,PC);
    gl.uniform3fv(u.SC,PadPlate._slotRGB(st));
    const spl=st.spl||(st.spl=new Float32Array(16));let lit=0;
    for(let i=0;i<16;i++){const v=f.sp[i];spl[i]+=(v-spl[i])*(1-Math.exp(-dt/(v>spl[i]?160:600)));lit=Math.max(lit,spl[i],f.sp[i]);}
    gl.uniform1fv(u.SPL,spl);
    // the beam: the path since the last frame (BEAM_N points), or the dot resting in the centre (reduced motion)
    const bl=st.bl||(st.bl=new Float32Array(2*this.BEAM_N));let nb=1;
    if(still){bl[0]=bl[1]=0;}
    else{const b0=st.bm||(st.bm={a:Math.random(),b:Math.random(),c:Math.random()}),b1=this.beamStep(b0,dt,f.lv);
      nb=this.beamPath(b0,b1,f.lv,f.wf,bl);st.bm=b1;}
    gl.uniform2fv(u.BL,bl);gl.uniform1i(u.NB,nb);
    const bk=this._uni().BK;bk[6]=pp?dec:-1;
    gl.uniform1fv(u.BK,bk);
    gl.uniform1i(u.HT,0);gl.uniform3fv(u.BC,bc);
    gl.drawArrays(gl.TRIANGLES,0,3);
    if(pp){const v=bp.u;   // the finishing pass: the new phosphor + glass + housing onto the canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,pw,ph);gl.useProgram(bp.pr);
      gl.bindTexture(gl.TEXTURE_2D,pp.tex[1-pp.i]);
      gl.uniform2f(v.R,pw,ph);gl.uniform1f(v.DPR,dpr);gl.uniform1i(v.HT,0);gl.uniform3fv(v.BC,bc);
      gl.drawArrays(gl.TRIANGLES,0,3);
      gl.bindTexture(gl.TEXTURE_2D,null);pp.i=1-pp.i;}
    this._vu(f.lv);
    return f.lv>.004||f.ki>.03||list.length>0||lit>.004||(!!pp&&now-(this._kick||0)<this.KICK*this.TAU*1000);},
  // ---- the 2D layer over the glass: since 2026-10-03 only the fallback disc (no WebGL2). The captions "przebieg /
  //      widmo" and the hint "zagraj, aby zobaczyć widmo" left the glass for the legend under the dial (HTML,
  //      .sk-legend in css/29): no text inside the scope, on purpose. It takes no pointer: the lamp is a picture. ----
  _overlay(W,H,dpr){
    const cv=this._ov;if(!cv)return;
    const pw=Math.round(W*dpr),ph=Math.round(H*dpr);if(cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph;}
    const x=cv.getContext("2d");if(!x)return;
    x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
    if(this._fail)this._fallback(x,W,H);},
  // no WebGL2 (or the shader failed): a dark disc in a graphite ring (the live picture needs the shader; the curves
  // are edited on rf-25e's flat panels either way)
  _fallback(x,W,H){
    const d=this._disc(W,H);
    x.fillStyle="#2c2b2a";x.beginPath();x.arc(d.cx,d.cy,d.R+this.HW,0,2*Math.PI);x.fill();
    x.fillStyle="#121413";x.beginPath();x.arc(d.cx,d.cy,d.R,0,2*Math.PI);x.fill();},
};
if(typeof window!=="undefined")window.SoundScreens=SoundScreens;

// ---- the "skop" shaders: the round lamp (stage E5, a stronger CRT since stage E7) ----
// Registered from outside (D7): only PadPlate._fs gets the sources, so they never show up on the pad background list.
// The prelude, the uniform list in PadPlate._prog and the plate() contract are rf-24b's; this file adds its own
// uniforms at the top of each source. A load without rf-24b (node vm) simply skips the registration.
// Two programs share the glass (SKOP_GLASS below): "skop" draws the phosphor - the live picture and, with persistence,
// what is left of the previous frame (BK[6]) - and "skop-blit" lays the scanlines, the glass and the housing over that
// texture onto the canvas (rf-25c _render, _pp). Without persistence (reduced motion, no framebuffer) "skop" alone
// does both.
if(typeof PadPlate!=="undefined"&&PadPlate._fs){
const SKOP_GLASS=`
// THE ROUND LAMP (decision 2026-10-02: round CRT). plate() gets CSS px: the prelude's main() divides gl_FragCoord
// and R by DPR, so every length here is in CSS px, the unit of SoundScreens.F / HW in rf-25c. The glass radius is
// Rg = min(r)/2 - F around the centre; sc = (px - r/2)/Rg is the unit disc (y up), the glass is |sc| <= 1. The dome:
// the picture point seen at sc is pc = sc*(1 + K*|sc|^2) (the middle looks magnified, like a bulging tube face; K .30
// since stage E7, a little overdone on purpose). SoundScreens (rf-25c) keeps the same numbers, and harness (j), (o)
// compare them with the next line.
const float F=12.,K=.30,HW=6.;
// the housing ring around the glass; sd = CSS px outside the glass rim (0 at the rim, HW at its outer edge), q = the
// pixel from the centre. Graphite felt (BC[1]), a dark groove where the glass sits with a bevel lit from above, a
// stitch ring of pink and lime dashes half way across (the rivets went with the 6 px ring, 2026-10-03); past HW the
// panel colour BC[0] (CSS clips the
// canvas there, so this is only the colour the outer edge blends into). The felt's cloud is two octaves of value
// noise (fbm of rf-24b has four): the two finer ones come to about a device px at this scale, so they only added
// shimmer, and their mean (.094) is added back, so the felt keeps its brightness.
vec3 kHous(vec2 q,float sd,float Rg,vec2 px){
  if(sd>HW+1.)return BC[0];
  float l=max(length(q),1e-3);vec2 u=q/l;vec2 fp=px*.35;
  vec3 h=BC[1]*(.9+.14*(.5*vn(fp)+.25*vn(fp*2.03+17.1)+.094))*(.97+.03*vn(px*1.7));
  h*=1.-.6*(1.-smoothstep(0.,1.5,sd));
  h+=vec3(.07)*(1.-smoothstep(0.,.8,abs(sd-1.6)))*(.35+.65*smoothstep(-.6,.8,u.y));
  // the stitches: a whole number of 14 px dashes around the circle, so the ring has no seam; half way across the band
  float n=floor(6.2832*(Rg+HW*.5)/14.+.5),s=(atan(u.x,u.y)/6.2832+.5)*n,t=fract(s);
  float st=smoothstep(.1,.2,t)*(1.-smoothstep(.6,.7,t))*(1.-smoothstep(.5,1.3,abs(sd-HW*.5)));
  h=mix(h,(mod(floor(s),2.)<.5?PINK:LIME)*.8,st*.7);
  h+=vec3(.045)*(1.-smoothstep(0.,1.2,abs(sd-HW+1.5)))*u.y;   // the outer bevel: light on top, shade below
  return mix(h,BC[0],smoothstep(-.6,.6,sd-HW));}
// the glass over the phosphor. First what lies ON the phosphor, so it bulges with the dome (pc, CSS px of the picture
// = pc*Rg): the scanlines, a raster line every 3 px, 10 % deep, and a faint aperture grille, r, g and b a third of the
// same 3 px period apart, 4 % (a triangle wave from fract, no trigonometry). Both fade out where the dome squeezes
// the period under ~2 device px (aa: the radial stretch of the dome is 1 + 3K|sc|^2, so the rim at DPR 1), or they
// would beat into moire. Then the glass: a vignette to the rim, a Fresnel sheen at the edge ((1 - sqrt(1 - rho^2))^2.5
// * .35, the power as a*a*sqrt(a)) with a faint violet tint, a thin tinted fringe just inside the rim (violet 2 px in,
// cyan 4.5 px in: a cheap stand-in for chromatic aberration, which would need the phosphor sampled three times), a big
// soft highlight top-left, a narrow sharp arc along the top-left rim (a window caught in the glass, 100 to 150
// degrees) and a thin reflected arc bottom-right (-40 to 20 degrees); then the housing. Laid on AFTER the persistence
// (in the blit pass), so neither the raster nor the glare smears or piles up.
// COST (measured 2026-10-03: the lamp took 6.9 ms at 373 px): every glare term is computed only where it can still
// reach 1/255 - the highlight inside exp(-7), the Fresnel sheen past rho .45 (under a quarter of 1/255 there), the
// fringe in the last 9 px, the two arcs (and their atan) only in their bands - so the middle of the glass pays for
// one cos and the vignette.
vec3 fin(vec3 col,vec2 px,vec2 r){
  vec2 q=px-r*.5;float Rg=max(min(r.x,r.y)*.5-F,1.);vec2 sc=q/Rg;float q2=dot(sc,sc),rho=sqrt(q2),sd=(rho-1.)*Rg;
  if(sd>=.8)return kHous(q,sd,Rg,px);   // pure housing: the final mix would weigh the glass below at 0
  vec2 pc=sc*(1.+K*q2);float aa=smoothstep(1.6,2.6,3.*DPR/(1.+3.*K*q2));
  col*=1.-.10*aa*(.5+.5*cos(pc.y*Rg*2.0944));
  col*=1.-.04*aa*abs(fract(pc.x*Rg*.33333-vec3(0.,.33333,.66667))*2.-1.);
  col*=1.-.4*smoothstep(.55,1.,rho);
  vec2 hd=(sc-vec2(-.45,.55))/.35;float h2=dot(hd,hd);
  if(h2<7.)col+=vec3(.85,.92,1.)*.13*exp(-h2);
  if(rho>.45){
    float fa=1.-sqrt(max(0.,1.-q2)),fr=fa*fa*sqrt(fa);
    col+=vec3(.5,.62,.7)*fr*.35+vec3(.02,0.,.03)*fr;
    if(sd>-9.){float e1=sd+2.,e2=sd+4.5;col+=vec3(.16,.04,.2)*exp(-e1*e1*.5)+vec3(.03,.13,.16)*exp(-e2*e2*.5);}
    float ae=(rho-.86)*Rg*.5,aw=(rho-.93)*Rg;   // squared by hand below: pow of a negative base is undefined in GLSL
    if(abs(ae)<3.5||abs(aw)<4.){float an=atan(sc.y,sc.x);
      col+=vec3(.9,.95,1.)*.07*exp(-ae*ae)*smoothstep(-.7,-.44,an)*(1.-smoothstep(.09,.35,an));
      col+=vec3(.95,.97,1.)*.16*exp(-aw*aw*.8)*smoothstep(1.66,1.85,an)*(1.-smoothstep(2.45,2.62,an));}}
  if(sd<=-.8)return col;               // deep in the glass the housing would be weighed at 0 - skip its noise
  return mix(kHous(q,sd,Rg,px),col,1.-smoothstep(-.8,.8,sd));}
`;
PadPlate._fs.skop=`uniform float BK[8];uniform vec3 BC[2];uniform vec2 BL[12];uniform int NB;
`+SKOP_GLASS+`
// SOUND-EDITOR SCOPE (rf-25c), the live sound of the lab bus only (stage E6 moved the editing to the flat panels of
// rf-25e, stage E7 left one picture): the waveform is a pink RING in its band, the spectrum a green SUN of 16 rays
// outside it, the beam wandering in the middle (BL, NB: 2026-10-03; until then a dot at rest, stage E8), the frogs sit on the rim at the angle of their pitch
// class (angles run clockwise from 12 o'clock, as a fraction of a turn:
// atan(x, y)). The picture is drawn on the glass (sc); the phosphor's cloud lies on the picture (pc) and bulges.
// BK[6] = persistence: > 0 = the decay of the previous frame, read from HT (this is then drawn into a texture that
// "skop-blit" finishes); -1 = one pass straight to the canvas (reduced motion, no framebuffer).
float kSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-8),0.,1.);return length(pa-ba*h);}
// the phosphor of the whole glass: dark green with a cloud that rides the dome, and a static grain on the screen.
// Only glass pixels get here (plate() returns before it outside the rim). The cloud is fbm of rf-24b without its
// fourth octave (weight 1/16 of a .05 swing: under 1/255) and with that octave's mean (.031) added back.
vec3 kPhos(vec2 pc,float Rg,vec2 px){vec2 p=pc*Rg*.02,p2=p*2.03+17.1;
  float c=.5*vn(p)+.25*vn(p2)+.125*vn(p2*2.03+17.1)+.031;
  return (vec3(.012,.032,.024)+vec3(.018,.05,.034)*c)*(.92+.16*vn(px*.9));}
// THE BANDS (stage E8; SoundScreens RING0, RING_LO, RING_HI, SUN0, SUN_L hold the same numbers, harness (j) compares)
const float RW0=.70,RLO=.56,RHI=.84,SU0=.86,SUL=.12;
// the spectrum as a sun: 16 rays from rho SU0 out to SU0 + SP*SUL (outside the ring's band), ray i at i/16 of a turn
// (SUN = its direction), a green tube with a glow, and a soft halo behind them, outside the band too. The glow needs the distance to the NEAREST ray, and that is
// always one of the four around the pixel's angle (j - 1 .. j + 2, the pixel lies between rays j and j + 1): a ray two
// steps (45 degrees) away is farther than the nearer neighbour even when the neighbours are empty and it is full
// (harness (j) checks 200 000 random pixels and spectra). So 4 segments a pixel instead of 16, the same picture.
const vec2 SUN[16]=vec2[16](vec2(0.,1.),vec2(.382683,.92388),vec2(.707107,.707107),vec2(.92388,.382683),vec2(1.,0.),
  vec2(.92388,-.382683),vec2(.707107,-.707107),vec2(.382683,-.92388),vec2(0.,-1.),vec2(-.382683,-.92388),
  vec2(-.707107,-.707107),vec2(-.92388,-.382683),vec2(-1.,0.),vec2(-.92388,.382683),vec2(-.707107,.707107),vec2(-.382683,.92388));
vec3 kSun(vec3 col,vec2 sc,float rho,float th,float Rg){
  float sp=spec(th*16./15.);
  col+=vec3(.4,1.,.3)*sp*.2*smoothstep(RHI,SU0+.02,rho)*(1.-smoothstep(.97,1.01,rho));
  float d=1e5;vec2 p=sc*Rg;int j=int(floor(th*16.));
  for(int k=-1;k<=2;k++){int i=(j+k+16)&15;vec2 u=SUN[i];d=min(d,kSeg(p,u*SU0*Rg,u*(SU0+SP[i]*SUL)*Rg));}
  vec3 c2=vec3(.4,1.,.3)*(.4+sp*.8);
  col+=c2*(exp(-d/7.)*.7+exp(-d/28.)*.3+exp(-d/90.)*.1);
  return mix(col,vec3(.9,1.,.9),lineAA(d,1.2)*.8);}
// THE RING. The waveform ring: radius RW0 + sample*min(.14, .04 + LV*.14) at the angle th, clamped to RLO..RHI
// (the samples are normalised to a peak of 1, so the clamp only catches what rounding lets through): until stage E8
// it was .62 + sample*(.06 + LV*.26), and a loud sound pulled its negative halves into the middle, where the
// persistence piled them up. The trace is 1024 samples of sound from a rising zero crossing (rf-24b _feat), not one
// period, so the last 8 % of the turn blends into the first sample and the ring closes without a step; the trigger
// keeps the figure standing. The distance is radial, divided by the ring's local slope, so a steep wave keeps an even
// line (no 64-segment loop per pixel).
float wr(float t){return wf(t)+(WF[0]-WF[63])*smoothstep(.92,1.,t);}
float rr(float t,float amp){return clamp(RW0+wr(t)*amp,RLO,RHI);}
vec3 kPolar(vec3 col,vec2 sc,float rho,float th,float Rg){
  // the spokes: sin(4 * angle) from th (that angle / 2pi wrapped to 0..1, so sin(8pi * th) is the same number)
  float gc=min(min(abs(rho-.3),abs(rho-.6)),abs(rho-.9))*Rg,gs=rho*Rg*abs(sin(th*25.13274))*.25;
  col+=vec3(.05,.14,.09)*(lineAA(gc,.5)*.4+lineAA(gs,.5)*.25*smoothstep(.2,.3,rho));   // 3 circles, 8 spokes
  col=kSun(col,sc,rho,th,Rg);
  // A jump in the wave (a saw, a square) makes the slope huge, and the slope-divided distance alone is then tiny all
  // along that angle: a pink spoke from the centre to the rim (2026-10-03). So the distance is at least the radial
  // gap to the jump's own span ra..rb, which keeps the stroke of a jump inside the ring's band.
  float amp=min(.14,.04+LV*.14),rw=rr(th,amp),ra=rr(max(th-.004,0.),amp),rb=rr(min(th+.004,1.),amp),sl=(rb-ra)/.008;
  float sg=sl/(6.2832*max(rho,.05)),d1=max(abs(rho-rw)*Rg/sqrt(1.+sg*sg),max(max(min(ra,rb)-rho,rho-max(ra,rb)),0.)*Rg);
  float fl=1.-.6*step(.5,vn(vec2(T*14.,1.)))*step(.5,KI);
  vec3 c1=PINK*1.3*fl*(.5+LV*.8);
  col+=c1*(exp(-d1/7.)*.8+exp(-d1/28.)*.35+exp(-d1/90.)*.12);
  col=mix(col,vec3(1.,.9,.95),lineAA(d1,1.3)*(.6+LV*.4)*fl);
  // THE BEAM (2026-10-03): BL[0..NB-1] = its path since the last frame in glass radii (SoundScreens.beamPath, the
  // head is the last point; NB 1 = at rest in the centre, reduced motion). A white core of half-width cw = 1.4 + LV*1.6
  // CSS px along the path and a head just .8 px wider (a bigger head would leave a string of beads in the phosphor,
  // one per frame), a pink glow from both (exp(-d/4)*.6 + exp(-d/14)*.25), brighter with the level
  // (.6 + LV*.6), steady (no hit flicker). The persistence turns the per-frame paths into a fading trail. Only pixels
  // within 70 px of the path's chord pay for the 11 segments (the glow is under 1/255 past that).
  vec2 pp=sc*Rg,hd=BL[NB-1]*Rg,b0=BL[0]*Rg;
  if(length(pp-(b0+hd)*.5)<length(hd-b0)*.5+70.){
    float dt=1e5;for(int i=0;i<11;i++){if(i>=NB-1)break;dt=min(dt,kSeg(pp,BL[i]*Rg,BL[i+1]*Rg));}
    float dh=length(pp-hd),cw=1.4+LV*1.6,dr=cw+.8,dk=.6+LV*.6,de=max(min(dt-cw,dh-dr),0.);
    col+=PINK*1.3*(exp(-de/4.)*.6+exp(-de/14.)*.25)*dk;
    col=mix(col,vec3(1.,.95,.97),(1.-smoothstep(cw-.6,cw+.4,dt))*min(1.,dk)*.85);
    col=mix(col,vec3(1.,.95,.97),(1.-smoothstep(dr-1.,dr+.5,dh))*min(1.,dk));}
  // the frogs on the rim: P.xy = (angle as a fraction of a turn, radius in glass radii) from rf-25c _frogs. Their
  // rings (14-20 px) span about +-.08 round FROG_R .9, so the rays (.86-.98) run through them, as they did before
  // stage E8: the annulus outside the band is too narrow to keep a ring that size clear of both
  float fr=(24.+BA*10.)*.6;
  for(int i=0;i<4;i++){if(i>=NP)break;float a=P[i].x*6.2832,dd=abs(length(sc-vec2(sin(a),cos(a))*P[i].y)*Rg-fr);
    vec3 fc=PC[i]*1.3*P[i].z;col+=fc*(exp(-dd/6.)*.7+exp(-dd/24.)*.3);col=mix(col,mix(fc,vec3(1.),.6),lineAA(dd,1.2)*P[i].z);}
  return col;}
vec3 plate(vec2 px,vec2 uv,vec2 r){
  bool dir=BK[6]<0.;
  vec2 q=px-r*.5;float Rg=max(min(r.x,r.y)*.5-F,1.);vec2 sc=q/Rg;float q2=dot(sc,sc),rho=sqrt(q2);
  if((rho-1.)*Rg>=.8)return dir?fin(vec3(0.),px,r):vec3(0.);   // outside the glass only the finishing pass draws
  vec2 pc=sc*(1.+K*q2);
  float th=fract(atan(sc.x,sc.y)/6.2832+1.);
  vec3 col=kPolar(kPhos(pc,Rg,px),sc,rho,th,Rg);
  // persistence: the phosphor of the previous frame, less a little each frame. The 1.5/255 floor takes at least one
  // step of the 8-bit texture away every frame, or rounding would hold a faint trail on the glass for ever.
  if(!dir){vec3 pv=texture(HT,uv).rgb;col=max(col,max(pv*BK[6]-1.5/255.,0.));}
  return dir?fin(col,px,r):col;}`;
PadPlate._fs["skop-blit"]=`uniform vec3 BC[2];
`+SKOP_GLASS+`
// the finishing pass: the phosphor that "skop" left in the texture, under the scanlines, the glass and in the housing
vec3 plate(vec2 px,vec2 uv,vec2 r){return fin(texture(HT,uv).rgb,px,r);}`;
}
