"use strict";
// ===== SoundEditors: the curve editors of the sound editor on flat panels (Synth › Brzmienia, stage E6, 2026-10-02) =====
// Three editors, one in each of three module cards, mounted by init() into the empty `.se-sec-editor[data-editor]`
// boxes of the dashboard (a box loses `hidden` once its editor is in; without this file it stays hidden):
//   FALA (wave, card Oscylatory) — draw one period (64 samples) or pull 16 harmonic bars; it plays as a PeriodicWave
//        (rf-21 _pwave) under "Własna" of the wave select. The lab's live waveform runs pink and dimmed behind it;
//   BARWA (eq, card Filtr) — up to 4 peaking bands as yellow rings over the live spectrum (green fill), x = frequency
//        (log 40 Hz–16 kHz), y = gain (±18 dB), wheel / Q −+ = width; the lime curve is the summed response computed
//        with the formula of BiquadFilterNode "peaking" (SoundScreens.eqMag), so the panel tells the truth about the
//        engine (rf-21 _eqChain, one chain per voice);
//   OBWIEDNIA (env, card Obwiednia głośności) — the volume envelope as points to drag: the top of the attack, the end
//        of the decay (and the sustain level), the end of the release; a small ring in the middle of each segment
//        bends it (`envC`, rf-21 plays it with value curves), an amber ring sets the filter envelope (amount and time).
//        Times and levels have NO state here: the sliders are the one source of truth, read at every draw and
//        written by the handles (value + an "input" event, as a hand on them would).
// The state, the patch I/O (readInto / load, called from rf-25), the tools and the pointer handling came here 1:1
// from the oscilloscope (rf-25c, stages E1–E3), where they ran inside the round lamp's edit field, and they behave the
// same. What changed is the surface: picture coords 0..1 (Y up) map LINEARLY onto the panel's picture (_lin; the
// screen adds a slight dome since stage E7, see below), the handles are bigger (R_PT / R_BEND / R_FILT, grab
// distance ENV_HIT), the captions are 11–12 px, and all three panels are on screen at once, so `ch` is no longer a channel to switch: it is the panel the last
// pointer event came from. The pure maths stays on SoundScreens (shape, dft, fromHarmonics, eqMag, envLayout,
// envPoly, envHandles…), so rf-25c loads first; rf-25 calls this file only through `window.SoundEditors`.
// Each panel is TWO canvases in a `.ce-stage` box: the frame `.ce-frame` underneath (frame(): the lamp's housing,
// flat — graphite felt with a grain, a stitch ring of pink and lime dashes, four rivets, a bevelled groove at the
// screen; drawn only when its size changes) and the screen `.ce-cv` on top of it, smaller by the felt band FR on
// every side. The split is for touch: the screen takes the finger (touch-action none, css/31), the felt lets the page
// scroll, so a panel as wide as the card is no longer a dead zone for scrolling. The mappings therefore work on the
// screen canvas alone (the PAD margin stays inside it). The screen is redrawn on demand (_req → one rAF) and every
// frame while the lab sounds (labDraw), once per display frame, and only on the panels that are on screen.
// The screen canvas also takes the keyboard (tabindex 0, role application, the keys in HELP / _key): every key edits
// through the same functions as the pointer (_eqCommit, _eqQ, _envSet, _commit), so the lab and the "unsaved" dot
// follow it the same way.
// STAGE E7 (2026-10-03) put the screens under glass, a mild dose of the lamp's CRT: _render draws the picture as
// before, but into the panel's own offscreen 2D buffer (E.buf), and ONE hidden WebGL2 context shared by the three
// panels (_post: PadPlate._mk on a detached div, rf-24b untouched) turns it into the screen with the shader "crt"
// registered at the end of this file: a slight dome (K .05), faint scanlines that bend with it, a vignette, a glare
// top-left and a thin bright band under the top edge, a little phosphor bloom; the result is copied onto the screen
// canvas in the same frame (_postRun). Drawing therefore works in the coords of the PICTURE (_lin, linear as before),
// and the pointer in the coords of the SCREEN, through the same dome (picToCv / cvToPic). Without WebGL2 (or when the
// glass fails) the picture goes straight onto the screen with 2D scanlines and a vignette (_crt2d), and the pointer
// maps linearly again (_dk() = 0).
// STAGE E8 (2026-10-03) added the CRT's afterglow where it does not get in the way of editing: the live layers (the
// pink waveform under the wave, the green spectrum under the equaliser) leave a short trail (_liveLayer, LIVE_TAU),
// while the curves and the handles stay sharp; the scanlines went from .06 to .09.
// Must load in node `vm` with no DOM (tests/curve_editors_harness.mjs): document / window are touched only inside
// functions, and the pure helpers (picToCv, cvToPic, _toPic, _toScr, feat, rrPerim, stitchN, frame) live on the object.
const SoundEditors={
  // the frame (CSS px): FR = the felt band around the screen (css/31 insets the screen canvas by the same 6 px —
  // change both), PAD = the screen's margin around the picture field, RAD = the outer corner radius (= the stage's CSS
  // border-radius), RS = the screen's corner radius; the stitch ring runs half way across the band, a DASH px dash
  // every STITCH px. FR was 22 until 2026-10-03 (the frame looked too heavy, halved); the rivets scale with FR
  FR:6, PAD:10, RAD:18, RS:8, STITCH:14, DASH:8,
  // THE GLASS (stage E7), handed to the shader "crt" as BK (_bk): K = the dome (the lamp has .30; the panels are
  // edited, so theirs stays slight), CRT_S = the depth of the scanlines, CRT_V = the vignette, CRT_G = the glare (1 =
  // as designed). The 2D fallback (_crt2d) draws its lines and vignette with CRT_S and CRT_V too. Stage E8 made the
  // scanlines a little plainer (CRT_S .06 → .09), still under the curves.
  K:.05, CRT_S:.09, CRT_V:.25, CRT_G:1,
  // THE AFTERGLOW of the live layers (stage E8, _liveLayer): the pink waveform and the green spectrum fade as
  // e^(−t/LIVE_TAU), t in s; the whole picture gets no trail (the handles must stay sharp)
  LIVE_TAU:.15,
  // FALA layout in picture coords: draw mode zero line .5, amplitude .35; harmonics mode = bars at the bottom
  // (base .07, full height .46) and the resulting wave above them (zero line .73, amplitude .17)
  DRAW_Y:.5, DRAW_A:.35, BAR0:.07, BARH:.46, HARM_Y:.73, HARM_A:.17,
  // BARWA: at most EQ_MAX bands. Q limits on the panel (sanitizePatch allows more: f 20–20000, g ±24, q 0.1–24; a
  // loaded band keeps its value until dragged). EQ_HIT = the least grab distance of a ring (CSS px); a wide ring
  // reaches further, to its line + 4 px (_eqReach), or a press on the line of a 24 px ring made a new band; Q steps:
  // the wheel ×1.12 a notch, the Q −/+ buttons ×1.25 a tap (touch). A ring's radius comes from its Q (SoundScreens.eqR,
  // 7–24 px).
  EQ_MAX:4, EQ_QMIN:.3, EQ_QMAX:12, EQ_HIT:18, EQ_QWHEEL:1.12, EQ_QBTN:1.25,
  // OBWIEDNIA: ring radii (CSS px) of a point, a bend and the filter ring, and the grab distance — a little more than
  // the point's ring, so a press on the ring's line still takes it (the lamp's 10 px rings had 18)
  R_PT:14, R_BEND:9, R_FILT:12, ENV_HIT:20,
  // KEYBOARD steps: frequency ×1.03 a press (Shift ×1.1), gain .5 dB (Shift 2), Q ×EQ_QWHEEL (as one wheel notch);
  // a harmonic bar .05 and a bend .05 (Shift .25); times by their slider's own step (Shift ×KB_T)
  KB_F:1.03, KB_FS:1.1, KB_G:.5, KB_GS:2, KB_BAR:.05, KB_C:.05, KB_CS:.25, KB_T:5,
  // colours of the screen: lime curve, pink live waveform, yellow handles (graphite outline), amber filter, grid,
  // phosphor text (yellow never carries text: global rule)
  C:{lime:"#a6d861",pink:"#ec1a83",yel:"#FFE236",amb:"#eaa32b",bend:"#e6f6e0",ink:"#353534",
     grid:"rgba(120,200,150,.13)",grid2:"rgba(120,200,150,.3)",ph:"rgba(204,246,210,.92)",phd:"rgba(204,246,210,.62)"},
  ch:"wave",         // the panel the last pointer event came from (the moved handlers below dispatch on it)
  mode:"draw",       // FALA: "draw" a period or pull "harm"onic bars
  _wt:null,          // Float32Array(64) −1..1 — the custom wave; null = none drawn yet (sine stands in)
  _harm:null,        // Float32Array(16) 0..1 — the bars; null = derive from the wave on demand
  _eq:[],            // BARWA: up to EQ_MAX bands {f Hz, g dB, q}; [] = no equaliser (the saved patch has no `eq`)
  _eqSel:-1,         // the picked band (its ring is brighter, the tools act on it); −1 = none
  _envC:[0,0,0],     // OBWIEDNIA: the bends [attack, decay, release], −1..1 — the only envelope state the panel owns
  _bar:0,            // FALA, keyboard: the harmonic bar the arrows act on (0..15)
  _envSel:"a",       // OBWIEDNIA, keyboard: the point the keys act on ("a" attack, "d" decay / sustain, "r" release)
  _pen:null, _hover:null, _ov:null, _ed:null, _dirty:null, _inited:false, _raf:0, _last:-1, _wasLive:false, _F:null, _tl:0,
  _liveT:-1e12, _now:null,   // the frame of the last live sound (the afterglow fades after it) and the current frame
  _post:null,        // the glass: null = not tried yet, false = no WebGL2 / it failed (the 2D fallback), else {st, tex, tw, th}

  // ---------------- pure helpers (no DOM) ----------------
  // the picture field on the W × H SCREEN canvas (CSS px): inside the screen's margin (the felt band is the frame
  // canvas under it, so no FR here)
  _plot(W,H){const m=this.PAD;return {x0:m,x1:Math.max(m+1,W-m),y0:Math.max(m+1,H-m),y1:m};},
  // picture coords (0..1, Y up) → CSS px of the PICTURE the panel draws (W × H, the screen's size), and back. Linear,
  // so they invert exactly; outside the field the coords run past 0..1 (the margin shows the envelope's lead-in and
  // tail). Everything _render draws goes through _lin.
  _lin(x,y,W,H){const p=this._plot(W,H);return {x:p.x0+x*(p.x1-p.x0),y:p.y0-y*(p.y0-p.y1)};},
  _unlin(px,py,W,H){const p=this._plot(W,H);return {x:(px-p.x0)/(p.x1-p.x0),y:(p.y0-py)/(p.y0-p.y1)};},
  // THE DOME of the glass (stage E7), the formula of the shader "crt": the screen point sc shows the picture point
  // pc = sc·(1 + k·|sc|²), both −1..1 per axis from the middle (Y up), as the lamp's dome. _toPic: screen CSS px →
  // picture CSS px, straight. _toScr: back, by Newton on the radius (ρ + kρ³ = |pc| from ρ = |pc|; four steps leave
  // under 1e−12 at k .05, even in the margin past the field); sc keeps the direction of pc. k 0 = no glass, identity.
  _toPic(px,py,W,H,k){if(!k)return {x:px,y:py};
    const sx=2*px/W-1,sy=1-2*py/H,f=1+k*(sx*sx+sy*sy);return {x:(sx*f+1)*W/2,y:(1-sy*f)*H/2};},
  _toScr(px,py,W,H,k){if(!k)return {x:px,y:py};
    const ux=2*px/W-1,uy=1-2*py/H,r=Math.hypot(ux,uy);if(r<1e-12)return {x:px,y:py};
    let q=r;for(let i=0;i<4;i++)q-=(q+k*q*q*q-r)/(1+3*k*q*q);
    const s=q/r;return {x:(ux*s+1)*W/2,y:(1-uy*s)*H/2};},
  // the dome in force: K while the glass runs, 0 in the 2D fallback (and before the first frame decided it)
  _dk(){return this._post?this.K:0;},
  // picture coords (0..1, Y up) ↔ CSS px on the SCREEN canvas, where the pointer is: the picture's px through the dome
  // (k defaults to the one in force). Hit tests and pointer events use these; drawing uses _lin.
  picToCv(x,y,W,H,k){const c=this._lin(x,y,W,H);return this._toScr(c.x,c.y,W,H,k==null?this._dk():k);},
  cvToPic(px,py,W,H,k){const c=this._toPic(px,py,W,H,k==null?this._dk():k);return this._unlin(c.x,c.y,W,H);},
  // The lab's live sound as PadPlate._feat (rf-24b) computes it for the lamp. fq = getByteFrequencyData, td =
  // getFloatTimeDomainData. sp = 16 bands log-spaced 60 Hz–12 kHz (band i = 60·200^(i/16)..60·200^((i+1)/16) Hz, the
  // mean of its bytes, ^1.4); wf = 64 points of the 1024 samples from the first rising zero crossing z (16 samples a
  // point, normalised to the peak, at least .05), so a held note draws a STANDING wave; lv = the RMS level ×3.2, ≤ 1.
  feat(fq,td,sampleRate,fftSize){
    const sp=new Float32Array(16),wf=new Float32Array(64),hz=(sampleRate>0?sampleRate:48000)/(fftSize>0?fftSize:2048);
    const avg=(lo,hi)=>{const a=Math.max(1,Math.round(lo/hz)),z=Math.min(fq.length-1,Math.round(hi/hz));let s=0;for(let i=a;i<=z;i++)s+=fq[i];return s/Math.max(1,z-a+1)/255;};
    for(let i=0;i<16;i++)sp[i]=Math.pow(avg(60*Math.pow(200,i/16),60*Math.pow(200,(i+1)/16)),1.4);
    let q=0;for(let i=0;i<td.length;i++)q+=td[i]*td[i];const lv=td.length?Math.min(1,Math.sqrt(q/td.length)*3.2):0;
    let z=0;for(let i=1;i<td.length-1100;i++){if(td[i-1]<0&&td[i]>=0){z=i;break;}}
    let pk=.05;for(let i=0;i<64;i++){let s=0;for(let j=0;j<16;j++)s+=+td[z+i*16+j]||0;wf[i]=s/16;pk=Math.max(pk,Math.abs(wf[i]));}
    for(let i=0;i<64;i++)wf[i]/=pk;
    return {sp,wf,z,lv};},
  // the perimeter of a rounded rectangle w × h with corner radius r
  rrPerim(w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));return 2*(w+h)-8*r+2*Math.PI*r;},
  // how many stitches go round a perimeter P: about one every STITCH px, rounded to an EVEN number, so the pink and
  // lime dashes alternate all the way round (an odd count would put two of one colour side by side at the start)
  stitchN(P){return Math.max(2,2*Math.round(P/(2*this.STITCH)));},
  // a rounded-rectangle path (arcs at the corners; ctx.roundRect is not everywhere). Starts at the top edge, clockwise.
  _rr(x,X,Y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));x.beginPath();x.moveTo(X+r,Y);
    x.lineTo(X+w-r,Y);x.arc(X+w-r,Y+r,r,-Math.PI/2,0);x.lineTo(X+w,Y+h-r);x.arc(X+w-r,Y+h-r,r,0,Math.PI/2);
    x.lineTo(X+r,Y+h);x.arc(X+r,Y+h-r,r,Math.PI/2,Math.PI);x.lineTo(X,Y+r);x.arc(X+r,Y+r,r,Math.PI,1.5*Math.PI);x.closePath();},
  // THE FRAME of all three panels — the lamp's housing (css/29 + shader kHous), flat. x is in CSS px (the caller set
  // the DPR transform), FR the width of the felt band. Graphite felt with a grain; a bevel where the screen sits (a
  // dark 2 px groove at the screen's edge, a light 1 px line just outside it); the stitch ring half way across the
  // band, pink dashes and lime ones in their gaps (the same path stroked twice, the pattern shifted by one stitch;
  // the step divides the perimeter exactly and the count is even, so the ring closes without a seam); a rivet in each
  // corner on the diagonal between the stitches and the bevel (its shadow down-right, the 5 px head, a glint
  // up-left). The shadow under the panel is CSS (.ce). Returns the number of stitches.
  frame(x,W,H,FR){
    FR=FR>0?FR:this.FR;const R=this.RAD,S=this.RS,r2=Math.SQRT1_2;
    x.save();this._rr(x,0,0,W,H,R);x.fillStyle="#23221f";x.fill();
    const t=this._tile(),pat=t&&typeof x.createPattern==="function"?x.createPattern(t,"repeat"):null;
    if(pat){x.clip();x.fillStyle=pat;x.fillRect(0,0,W,H);}
    x.restore();
    // a thin band (6 px since 2026-10-03; 22 and then 11 were both too heavy): a 1 px groove at the
    // screen's edge and the stitch half way across, nothing else - the light line would sit on the stitch and a
    // rivet head has no room. The wide drawing stays for FR >= 9 (the harness draws both).
    const thin=FR<9;
    if(thin){x.lineWidth=1;x.strokeStyle="rgba(0,0,0,.6)";this._rr(x,FR-.5,FR-.5,W-2*FR+1,H-2*FR+1,S+.5);x.stroke();}
    else{x.lineWidth=2;x.strokeStyle="rgba(0,0,0,.6)";this._rr(x,FR-1,FR-1,W-2*FR+2,H-2*FR+2,S+1);x.stroke();
      x.lineWidth=1;x.strokeStyle="rgba(255,255,255,.13)";this._rr(x,FR-2.5,FR-2.5,W-2*FR+5,H-2*FR+5,S+2.5);x.stroke();}
    const si=FR/2,sr=Math.max(2,R-si),P=this.rrPerim(W-2*si,H-2*si,sr),n=this.stitchN(P),st=P/n,lw=1.6;
    const d=Math.max(1,st*this.DASH/this.STITCH-lw);   // the round caps add lw to the length you see
    x.save();x.lineWidth=lw;x.lineCap="round";x.globalAlpha=.9;x.setLineDash([d,2*st-d]);
    for(const [c,o] of [[this.C.pink,0],[this.C.lime,st]]){x.strokeStyle=c;x.lineDashOffset=o;this._rr(x,si,si,W-2*si,H-2*si,sr);x.stroke();}
    x.setLineDash([]);x.restore();
    if(thin)return n;
    const a=si+sr-sr*r2,b=FR+S-(S+2.5)*r2,c=(a+b)/2,k=Math.min(1,FR/22);   // the rivet as drawn for a 22 px band, scaled down with it
    for(const [rx,ry] of [[c,c],[W-c,c],[c,H-c],[W-c,H-c]]){
      x.fillStyle="rgba(0,0,0,.45)";x.beginPath();x.arc(rx+.9*k,ry+1.2*k,3.2*k,0,2*Math.PI);x.fill();
      x.fillStyle="#66625c";x.beginPath();x.arc(rx,ry,2.5*k,0,2*Math.PI);x.fill();
      x.fillStyle="rgba(255,255,255,.55)";x.beginPath();x.arc(rx-.8*k,ry-.8*k,.9*k,0,2*Math.PI);x.fill();}
    return n;},
  // the felt's grain: a 96 px tile of 3 px cells, each a little lighter or darker (up to 2.5 %) by a hash of its cell,
  // so it is the same at every draw; made once and tiled. No document (node vm) = no grain, the frame stays.
  _tile(){
    if(this._tl!==0)return this._tl;this._tl=null;
    if(typeof document==="undefined"||!document.createElement)return null;
    try{const c=document.createElement("canvas");c.width=c.height=96;const x=c.getContext&&c.getContext("2d");if(!x)return null;
      for(let j=0;j<32;j++)for(let i=0;i<32;i++){let h=Math.sin(i*127.1+j*311.7)*43758.5453;h-=Math.floor(h);
        const al=(Math.abs(h-.5)*.05).toFixed(4);x.fillStyle=h<.5?"rgba(0,0,0,"+al+")":"rgba(255,255,255,"+al+")";x.fillRect(i*3,j*3,3,3);}
      this._tl=c;}catch(e){this._tl=null;}
    return this._tl;},

  // ---------------- patch in / out (called from rf-25) ----------------
  // readEditorPatch → "Własna" carries its 64 samples, rounded to 3 places (sanitizePatch does the same).
  // BARWA: the bands go out ALWAYS, an empty list too. The save merges the form OVER the loaded source patch
  // (rf-25 saveCustomSound, merge-preserve), so an equaliser cleared on the panel must overwrite the source's `eq`;
  // sanitizePatch drops an empty list, so nothing new is ever stored for a sound without bands.
  // OBWIEDNIA the same way and for the same reason: the bends go out ALWAYS (2 places), [0,0,0] too, so "Domyślny kształt"
  // overwrites the source's `envC` on save; sanitizePatch drops three zeros, so a sound without bends stores nothing new.
  readInto(p){
    if(!p)return p;
    p.eq=this._eq.map(b=>({f:Math.round(b.f),g:Math.round(b.g*10)/10,q:Math.round(b.q*100)/100}));
    p.envC=this._envC.map(v=>Math.round(v*100)/100||0);
    if(p.wave!=="custom")return p;
    const w=this._wt||SoundScreens.shape("sine");
    p.wt=Array.from(w,v=>Math.round(Math.max(-1,Math.min(1,+v||0))*1000)/1000);
    return p;},
  // _setFormFromPatch → the panels follow the loaded sound: a sound without `wt` clears the drawing, one without `eq`
  // the bands, one without `envC` the bends (the default shape). The bands are a COPY: editing never touches the loaded
  // patch. (In the lamp a loaded wave also switched the channel; the panels are all on screen, so nothing switches.)
  load(p){
    const ok=!!p&&p.wave==="custom"&&Array.isArray(p.wt)&&p.wt.length===64;
    const fin=v=>typeof v==="number"&&Number.isFinite(v);
    this._wt=ok?Float32Array.from(p.wt,v=>Math.max(-1,Math.min(1,+v||0))):null;
    this._eq=(p&&Array.isArray(p.eq)?p.eq:[]).filter(b=>b&&fin(b.f)&&fin(b.g)&&fin(b.q)).slice(0,this.EQ_MAX).map(b=>({f:b.f,g:b.g,q:b.q}));
    this._envC=(p&&Array.isArray(p.envC)&&p.envC.length===3&&p.envC.every(fin))?p.envC.map(v=>Math.max(-1,Math.min(1,v))):[0,0,0];
    this._harm=null;this._pen=null;this._eqSel=-1;
    this._syncTools();this._req();},

  // ---------------- DOM ----------------
  _labId(){return typeof LAB_ID!=="undefined"?LAB_ID:"__lab__";},
  _el(id){return typeof document!=="undefined"?document.getElementById(id):null;},
  _waveSel(){const s=this._el("seWave");return s?s.value:"sawtooth";},
  _isCustom(){return this._waveSel()==="custom";},
  // what the FALA panel shows: the custom wave, or the selected built-in wave as a dimmed preview
  _curve(){const S=SoundScreens;return this._isCustom()?(this._wt||S.shape("sine")):S.shape(this._waveSel());},
  _bars(){return this._harm||(this._harm=SoundScreens.harmonicsOf(this._curve()));},
  // a draw on demand: k = the panel to redraw ("wave" / "eq" / "env"), none = all three. self = draw() asking for its
  // own next frame while the live layers ease out (marks nothing new).
  _req(k,self){
    const d=this._dirty||(this._dirty={});
    if(!self){if(k)d[k]=1;else d.wave=d.eq=d.env=1;}
    if(this._raf||typeof requestAnimationFrame!=="function")return;
    this._raf=requestAnimationFrame(()=>{this._raf=0;this.draw();});},
  // OBWIEDNIA reads the envelope from the sliders at every draw (one source of truth), with readEditorPatch's
  // defaults and units: seconds, sustain 0..1, filter amount ±1
  _envVals(){
    const n=(id,d)=>{const el=this._el(id),v=el?+el.value:NaN;return Number.isFinite(v)?v:d;},ty=this._el("seType");
    return {legato:!(ty&&ty.value==="pluck"),att:n("seAtt",12)/1000,dec:n("seDec",340)/1000,sus:n("seSus",100)/100,
            rel:n("seRel",180)/1000,fEnv:n("seFEnv",0)/100,fEnvT:n("seFEnvT",200)/1000};},
  // the layout on the panel; while a handle is dragged its time scale stays the one from pointerdown
  _envLay(v){const P=this._pen;return SoundScreens.envLayout(v.att,v.dec,v.sus,v.rel,v.legato,P&&P.env?P.spu:0);},
  // a handle writes a slider the way a hand on it would: snapped to the slider's own min / max / step, then an
  // "input" event, so its label, its knob (rf-knob) and the lab (labParamChanged) follow through rf-25's listeners.
  // An unchanged value sends nothing (a held note is not restarted for a pixel that moved nothing).
  _envSet(id,val){
    const el=this._el(id);if(!el||!Number.isFinite(val))return false;
    const mn=Number.isFinite(parseFloat(el.min))?+el.min:0,mx=Number.isFinite(parseFloat(el.max))?+el.max:Infinity,st=+el.step>0?+el.step:1;
    const s=String(+Math.max(mn,Math.min(mx,mn+Math.round((val-mn)/st)*st)).toFixed(6));
    if(el.value===s)return false;
    el.value=s;if(typeof Event==="function")el.dispatchEvent(new Event("input",{bubbles:true}));
    return true;},
  _sr(){return (typeof PadAudio!=="undefined"&&PadAudio.ctx&&PadAudio.ctx.sampleRate)||48000;},
  // the tool strip of each panel: the same keys and words as the lamp's channel tools had (the i18n walker translates
  // the Polish in the DOM)
  TOOLS:{
    wave:'<span class="sk-seg" role="group" aria-label="Sposób rysowania fali">'+
           '<button type="button" class="sk-tb" data-mode="draw" aria-pressed="true" title="Rysuj palcem albo myszą jeden okres fali">Rysuj</button>'+
           '<button type="button" class="sk-tb" data-mode="harm" aria-pressed="false" title="Ustaw głośność 16 harmonicznych, jak suwaki w organach">Harmoniczne</button>'+
         '</span>'+
         '<button type="button" class="sk-tb" data-act="smooth" title="Wygładź kształt fali: barwa robi się łagodniejsza">Wygładź</button>'+
         '<button type="button" class="sk-tb" data-act="clear" title="Zacznij od czystego sinusa">Wyczyść</button>',
    eq:'<button type="button" class="sk-tb" data-act="eq-add" title="Dodaj pasmo przy 1 kHz (najwyżej cztery)">+ Pasmo</button>'+
       '<button type="button" class="sk-tb" data-act="eq-del" title="Usuń wybrane pasmo">Usuń pasmo</button>'+
       '<button type="button" class="sk-tb" data-act="eq-qm" title="Szersze pasmo: mniejsze Q">Q −</button>'+
       '<button type="button" class="sk-tb" data-act="eq-qp" title="Węższe pasmo: większe Q">Q +</button>'+
       '<button type="button" class="sk-tb" data-act="eq-zero" title="Usuń wszystkie pasma: brzmienie bez korektora">Wyzeruj</button>',
    env:'<button type="button" class="sk-tb" data-act="env-reset" title="Przywróć wszystkim odcinkom domyślny kształt, taki jak w brzmieniu bez zgięć">Domyślny kształt</button>'+
        '<button type="button" class="sk-tb" data-act="env-nofilt" title="Ustaw obwiednię filtra na zero: filtr nie rusza się przy nucie">Bez obwiedni filtra</button>'},
  LABEL:{wave:"Edytor fali",eq:"Korektor",env:"Obwiednia"},
  // what the keys do, in a hidden span the screen canvas points at (aria-describedby); the walker translates it
  HELP:{wave:"Klawiatura w trybie Harmoniczne: [ i ] wybierają słupek, strzałki w górę i w dół zmieniają jego głośność, Shift daje większy krok.",
    eq:"Klawiatura: [ i ] wybierają pasmo, strzałki w lewo i w prawo zmieniają częstotliwość, w górę i w dół wzmocnienie, Page Up i Page Down szerokość pasma, Delete usuwa pasmo, Insert albo plus dodaje nowe, Shift daje większy krok.",
    env:"Klawiatura: 1, 2 i 3 wybierają punkt (atak, zanik z podtrzymaniem, zwolnienie), strzałki w lewo i w prawo zmieniają czas, w górę i w dół podtrzymanie albo zgięcie odcinka, Page Up i Page Down zgięcie, Shift daje większy krok."},
  init(){
    if(this._inited||typeof document==="undefined"||typeof SoundScreens==="undefined")return;
    const box=this._el("soundEditor");if(!box||typeof box.querySelectorAll!=="function")return;
    const slots=[...box.querySelectorAll(".se-sec-editor[data-editor]")].filter(s=>this.TOOLS[s.dataset.editor]);
    if(!slots.length)return;
    this._inited=true;this._ed={};
    slots.forEach(s=>this._mount(s.dataset.editor,s));
    // "Własna" picked with nothing drawn yet → a sine, so it sounds at once; another wave = its preview on the panel
    const sel=this._el("seWave");
    if(sel)sel.addEventListener("change",()=>{
      if(sel.value==="custom"&&!this._wt)this._wt=SoundScreens.sine();
      this._harm=null;this._req("wave");});
    // OBWIEDNIA draws the sliders, so a hand on a knob (or the type select) redraws it, and the tools re-check
    ["seAtt","seDec","seSus","seRel","seFEnv","seFEnvT"].forEach(id=>{const el=this._el(id);
      if(el)el.addEventListener("input",()=>{this._syncTools();this._req("env");});});
    const ty=this._el("seType");if(ty)ty.addEventListener("change",()=>{if(this._pen&&this._pen.env)this._pen=null;this._syncTools();this._req("env");});
    // the pad loop only calls draw() while something sounds — opening the editor, resizing and editing ask here. The
    // glass's GL context is given back when the editor folds and when the page goes away (as the lamp's), and the
    // next opening tries it again
    box.addEventListener("toggle",e=>{if(e.target!==box)return;if(box.open)this._req();else this._postDrop();});
    if(typeof window!=="undefined"&&typeof window.addEventListener==="function")window.addEventListener("pagehide",()=>this._postDrop());
    // a language switch (rf-01 setLang writes <html lang>): the captions on the screens are _gl() at draw time
    this._langWatch(()=>this._req());
    this._syncTools();this._req();},
  // calls fn after every change of <html lang> (one observer per object; none in node vm)
  _langWatch(fn){
    if(this._mo||typeof MutationObserver!=="function"||!document.documentElement)return;
    try{this._mo=new MutationObserver(()=>fn());this._mo.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});}catch(e){this._mo=null;}},
  // one panel, in a .ce box (CSS: margins and the shadow under the frame): the tool strip over the stage, which holds
  // the frame canvas and the screen canvas on top of it, and the hidden description of the keys
  _mount(k,slot){
    const wrap=document.createElement("div");wrap.className="ce";wrap.dataset.editor=k;
    const tl=document.createElement("div");tl.className="ce-tools";tl.innerHTML=this.TOOLS[k];
    const st=document.createElement("div");st.className="ce-stage ce-"+k;
    const fr=document.createElement("canvas");fr.className="ce-frame";fr.setAttribute("aria-hidden","true");
    const cv=document.createElement("canvas");cv.className="ce-cv";cv.tabIndex=0;
    cv.setAttribute("role","application");cv.setAttribute("aria-label",this.LABEL[k]);
    const hp=document.createElement("span");hp.className="ce-sr";hp.id="ceHelp-"+k;hp.textContent=this.HELP[k];
    cv.setAttribute("aria-describedby",hp.id);
    st.appendChild(fr);st.appendChild(cv);
    wrap.appendChild(tl);wrap.appendChild(st);wrap.appendChild(hp);slot.appendChild(wrap);slot.hidden=false;
    const E=this._ed[k]={k,slot,wrap,tools:tl,stage:st,fr,cv,fs:null,kf:false};
    tl.addEventListener("click",e=>{const b=e.target&&e.target.closest&&e.target.closest("button");if(b&&tl.contains(b))this._tool(b);});
    // the keyboard: kf = the panel shows its keyboard pick (focus from the keyboard, or a key pressed); a click gives
    // focus too, but no pick marks until a key is pressed
    cv.addEventListener("keydown",e=>this._key(e,k));
    cv.addEventListener("focus",()=>{let v=false;try{v=cv.matches(":focus-visible");}catch(_){}E.kf=v;this._req(k);});
    cv.addEventListener("blur",()=>{E.kf=false;this._req(k);});
    // the moved handlers work on this.ch (which panel) and this._ov (its canvas). While one panel drags, the others
    // take no part (pointer capture keeps the drag's moves on its own canvas anyway); a release always gets through.
    const on=(type,fn,opt)=>cv.addEventListener(type,e=>{
      const P=this._pen,rel=type==="pointerup"||type==="pointercancel"||type==="lostpointercapture";
      if(P&&P.k&&P.k!==k&&!rel)return;
      if(!rel||!P||P.k===k){this.ch=k;this._ov=cv;}
      fn(e);},opt);
    on("pointerdown",e=>{this._down(e);if(this._pen&&!this._pen.k)this._pen.k=k;});
    on("pointermove",e=>this._move(e));
    const up=e=>this._up(e);on("pointerup",up);on("pointercancel",up);on("lostpointercapture",up);
    cv.addEventListener("pointerleave",()=>{if(this._hover&&this._hover.k===k){this._hover=null;this._req(k);}});
    cv.addEventListener("contextmenu",e=>e.preventDefault());
    // BARWA: double click on a ring removes the band; the wheel over a ring (or with a band picked) sets its width
    // (not passive, or preventDefault cannot stop the page from scrolling under the panel).
    // OBWIEDNIA: double click on a bend ring gives that segment its default shape back (c 0).
    if(k==="eq"){on("dblclick",e=>this._eqDbl(e));on("wheel",e=>this._eqWheel(e),{passive:false});}
    if(k==="env")on("dblclick",e=>this._envDbl(e));
    if(typeof ResizeObserver==="function"){try{new ResizeObserver(()=>{E.fs=null;this._req(k);}).observe(cv);}catch(e){}}},
  _tool(b){
    const a=b.dataset.act;
    if(b.dataset.mode)this.setMode(b.dataset.mode);
    else if(a==="smooth")this._smooth();
    else if(a==="clear")this._clear();
    else if(a==="eq-add")this._eqAdd();
    else if(a==="eq-del")this._eqDel(this._eqSel);
    else if(a==="eq-qm")this._eqQ(this._eqSel,1/this.EQ_QBTN);
    else if(a==="eq-qp")this._eqQ(this._eqSel,this.EQ_QBTN);
    else if(a==="eq-zero")this._eqZero();
    else if(a==="env-reset")this._envReset();
    else if(a==="env-nofilt")this._envNoFilt();},
  _syncTools(){
    const strips=this._ed?Object.values(this._ed).map(E=>E.tools).filter(Boolean):[];if(!strips.length)return;
    const n=this._eq.length,b=this._eq[this._eqSel],bent=this._envC.some(v=>v!==0),fe=this._envVals().fEnv!==0;
    for(const t of strips){
      t.querySelectorAll("[data-mode]").forEach(el=>el.setAttribute("aria-pressed",el.dataset.mode===this.mode?"true":"false"));
      // BARWA: a tool that would do nothing is greyed out (4 bands = no "+ Pasmo"; nothing picked = no remove / Q)
      t.querySelectorAll('[data-act^="eq-"]').forEach(el=>{const a=el.dataset.act;
        el.disabled=a==="eq-add"?n>=this.EQ_MAX:a==="eq-zero"?!n:a==="eq-del"?!b
          :a==="eq-qm"?!b||b.q<=this.EQ_QMIN:!b||b.q>=this.EQ_QMAX;});
      // OBWIEDNIA: nothing bent = no "Domyślny kształt"; no filter envelope = no "Bez obwiedni filtra"
      t.querySelectorAll('[data-act^="env-"]').forEach(el=>{const a=el.dataset.act;
        if(a==="env-reset")el.disabled=!bent;else if(a==="env-nofilt")el.disabled=!fe;});}},
  setMode(m){m=m==="harm"?"harm":"draw";if(m===this.mode)return;
    this.mode=m;this._harm=null;this._pen=null;this._syncTools();this._req("wave");},
  // the first edit of a built-in wave starts FROM that wave (what you see is what you edit) and selects "Własna"
  _ensureCustom(){
    const sel=this._el("seWave");if(!sel)return;
    if(sel.value!=="custom"){this._wt=Float32Array.from(SoundScreens.shape(sel.value));sel.value="custom";this._harm=null;}
    else if(!this._wt)this._wt=SoundScreens.sine();},
  // labParamChanged is looked up by name at call time: rf-25d wraps the global, and the wrapper must see every edit
  _commit(){if(typeof labParamChanged==="function")labParamChanged();this._req();},
  _smooth(){this._ensureCustom();this._wt=SoundScreens.smooth(this._wt);this._harm=null;this._commit();},
  _clear(){const sel=this._el("seWave");if(sel)sel.value="custom";this._wt=SoundScreens.sine();this._harm=null;this._commit();},
  // a pointer event → the panel (k), CSS px on its canvas and picture coords (pic)
  _pt(e){const r=this._ov.getBoundingClientRect(),W=r.width,H=r.height,px=e.clientX-r.left,py=e.clientY-r.top;
    return {k:this.ch,px,py,W,H,pic:this.cvToPic(px,py,W,H)};},
  // is a picture point in the field (m = margin in picture units, so the edges stay easy to reach)?
  _inField(pic,m){m=m||0;return pic.x>=-m&&pic.x<=1+m&&pic.y>=-m&&pic.y<=1+m;},
  _down(e){
    if(this.ch==="eq"){this._eqDown(e);return;}
    if(this.ch==="env"){this._envDown(e);return;}
    if(this.ch!=="wave")return;if(e.pointerType==="mouse"&&e.button!==0)return;
    const p=this._pt(e);if(!this._inField(p.pic,.05))return;   // the screen's edge past the field draws nothing (the felt is the frame canvas)
    e.preventDefault();this._ensureCustom();
    this._pen={id:e.pointerId,last:null};this._hover=p;
    try{this._ov.setPointerCapture(e.pointerId);}catch(_){}
    this._apply(p.pic);this._commit();},
  _move(e){
    if(this.ch!=="wave"&&this.ch!=="eq"&&this.ch!=="env")return;
    const p=this._pt(e);this._hover=p;
    if(this._pen&&this._pen.id===e.pointerId){
      if(this.ch==="env"){this._envDrag(p);return;}   // the sliders' input events tell the lab, no _commit here
      if(this.ch==="eq")this._eqDrag(p);else this._apply(p.pic);this._commit();}else this._req(this.ch);},
  _up(e){if(this._pen&&this._pen.id===e.pointerId){this._pen=null;this._req();}},
  // one pointer sample → the wave. Samples skipped by a fast stroke are filled by a straight line between the
  // previous and this one (bars too), so a quick swipe never leaves teeth behind.
  _apply(pic){
    const L=this._pen.last;
    if(this.mode==="harm"){
      const h=this._bars(),k=Math.max(0,Math.min(15,Math.floor(pic.x*16))),a=Math.max(0,Math.min(1,(pic.y-this.BAR0)/this.BARH));
      if(L&&L.k!==k){const d=k>L.k?1:-1;for(let j=L.k+d;j!==k;j+=d)h[j]=L.a+(a-L.a)*(j-L.k)/(k-L.k);}
      h[k]=a;this._pen.last={k,a};this._wt=SoundScreens.fromHarmonics(h);return;}
    const w=this._wt,i=Math.round(Math.max(0,Math.min(1,pic.x))*63),v=Math.max(-1,Math.min(1,(pic.y-this.DRAW_Y)/this.DRAW_A));
    if(L&&L.i!==i){const d=i>L.i?1:-1;for(let j=L.i+d;j!==i;j+=d)w[j]=L.v+(v-L.v)*(j-L.i)/(i-L.i);}
    w[i]=v;this._pen.last={i,v};this._harm=null;},
  // ---------------- BARWA: the rings of the equaliser ----------------
  // where a band's ring sits (picture coords: x clamped to the axis, y to ±18 dB by gy); _eqAt = on the screen (hit
  // tests, the pointer), _eqLin = in the picture (drawing)
  _eqPic(b){const S=SoundScreens;return {x:Math.max(0,Math.min(1,S.xf(b.f))),y:S.gy(b.g)};},
  _eqAt(b,W,H){const q=this._eqPic(b);return this.picToCv(q.x,q.y,W,H);},
  _eqLin(b,W,H){const q=this._eqPic(b);return this._lin(q.x,q.y,W,H);},
  // how far a band's ring takes a press: EQ_HIT, or its line + 4 px for a wide ring (a low Q draws up to 24 px)
  _eqReach(b){return Math.max(this.EQ_HIT,SoundScreens.eqR(b.q)+4);},
  // the band whose ring centre is nearest the pointer, within that band's reach; −1 = empty screen
  _eqHit(p){let best=-1,bd=Infinity;
    this._eq.forEach((b,i)=>{const g=this._eqAt(b,p.W,p.H),d=Math.hypot(g.x-p.px,g.y-p.py);if(d<=this._eqReach(b)&&d<=bd){bd=d;best=i;}});
    return best;},
  _eqCommit(){this._syncTools();this._commit();},
  // press on a ring = pick it and drag it (the grab keeps its offset, so the ring never jumps under the finger);
  // press on the empty field = a new band right there (Q 1), dragged at once; with four bands, or on the screen's
  // margin around the field, it only drops the pick
  _eqDown(e){
    if(e.pointerType==="mouse"&&e.button!==0)return;
    const S=SoundScreens,p=this._pt(e);this._hover=p;let i=this._eqHit(p),ox=0,oy=0;const isNew=i<0;
    if(isNew){
      if(this._eq.length>=this.EQ_MAX||!this._inField(p.pic)){this._eqSel=-1;this._syncTools();this._req();return;}
      this._eq.push({f:S.fx(Math.max(0,Math.min(1,p.pic.x))),g:S.yg(p.pic.y),q:1});i=this._eq.length-1;}
    else{const b=this._eq[i];ox=Math.max(0,Math.min(1,S.xf(b.f)))-p.pic.x;oy=S.gy(b.g)-p.pic.y;}
    e.preventDefault();this._eqSel=i;this._pen={id:e.pointerId,eq:i,ox,oy};
    try{this._ov.setPointerCapture(e.pointerId);}catch(_){}
    if(isNew)this._eqCommit();else{this._syncTools();this._req();}},   // a mere pick changes no sound
  _eqDrag(p){const S=SoundScreens,b=this._eq[this._pen.eq];if(!b)return;
    b.f=S.fx(Math.max(0,Math.min(1,p.pic.x+this._pen.ox)));b.g=S.yg(p.pic.y+this._pen.oy);},
  _eqDbl(e){if(this.ch!=="eq")return;const i=this._eqHit(this._pt(e));if(i<0)return;e.preventDefault();this._eqDel(i);},
  // the wheel: up = narrower (Q × 1.12), down = wider. Over a ring it acts on that ring, elsewhere on the picked
  // one; with nothing to act on it leaves the event alone, so the page still scrolls
  _eqWheel(e){if(this.ch!=="eq"||!e.deltaY)return;
    let i=this._eqHit(this._pt(e));if(i<0)i=this._eqSel;if(!this._eq[i])return;
    e.preventDefault();this._eqSel=i;this._eqQ(i,e.deltaY<0?this.EQ_QWHEEL:1/this.EQ_QWHEEL);},
  _eqQ(i,k){const b=this._eq[i];if(!b)return;b.q=Math.max(this.EQ_QMIN,Math.min(this.EQ_QMAX,b.q*k));this._eqCommit();},
  _eqAdd(){if(this._eq.length>=this.EQ_MAX)return;this._eq.push({f:1000,g:0,q:1});this._eqSel=this._eq.length-1;this._eqCommit();},
  _eqDel(i){if(!this._eq[i])return;this._eq.splice(i,1);this._eqSel=-1;this._pen=null;this._eqCommit();},
  _eqZero(){if(!this._eq.length)return;this._eq=[];this._eqSel=-1;this._pen=null;this._eqCommit();},
  // ---------------- OBWIEDNIA: points, bends and the filter ring ----------------
  // the handle nearest the pointer, at most ENV_HIT CSS px away; a tie keeps the earlier one, so the points (kind 1)
  // win over the bends; null = empty screen (it adds nothing here)
  _envHit(p){const v=this._envVals(),lay=this._envLay(v);let best=null,bd=this.ENV_HIT;
    for(const h of SoundScreens.envHandles(lay,this._envC,v.fEnv,v.fEnvT)){
      const g=this.picToCv(h.x,h.y,p.W,p.H),d=Math.hypot(g.x-p.px,g.y-p.py);if(d<bd){bd=d;best=h;}}
    return best;},
  // press on a handle = drag it. The time scale freezes for the drag (spu), and both axes move by the pointer's
  // travel from where it pressed, so the handle never jumps or slides away under the finger.
  _envDown(e){
    if(e.pointerType==="mouse"&&e.button!==0)return;
    const p=this._pt(e);this._hover=p;const h=this._envHit(p);if(!h){this._req();return;}
    e.preventDefault();
    const v=this._envVals(),lay=this._envLay(v);
    this._pen={id:e.pointerId,env:h.id,ci:h.ci,spu:lay.spu,px:p.pic.x,oy:h.y-p.pic.y,v0:v};
    try{this._ov.setPointerCapture(e.pointerId);}catch(_){}
    this._req();},
  // a point writes its sliders: top of the attack x → seAtt; end of the decay x → seDec, y → seSus (legato); end of
  // the release x → seRel; the amber ring x → seFEnvT, y → seFEnv. A bend ring: y → c, solved exactly (envCOf) from
  // where the finger is between the segment's two levels, so the ring stays under it; 2 places, as saved.
  _envDrag(p){
    const S=SoundScreens,P=this._pen,v=P.v0,dt=(p.pic.x-P.px)*P.spu,y=p.pic.y+P.oy,Y0=S.ENV_Y0,Y1=S.ENV_Y1;
    if(P.env==="a")this._envSet("seAtt",(v.att+dt)*1000);
    else if(P.env==="d"){this._envSet("seDec",(v.dec+dt)*1000);if(v.legato)this._envSet("seSus",(y-Y0)/(Y1-Y0)*100);}
    else if(P.env==="r")this._envSet("seRel",(v.rel+dt)*1000);
    else if(P.env==="f"){this._envSet("seFEnvT",(v.fEnvT+dt)*1000);this._envSet("seFEnv",(y-S.ENV_FZ)/S.ENV_FA*100);}
    else if(P.ci!=null){
      const seg=this._envLay(this._envVals()).segs.find(s=>s[2]===P.ci),dy=seg?seg[1].y-seg[0].y:0;
      if(Math.abs(dy)>1e-6){const c=Math.round(S.envCOf((y-seg[0].y)/dy)*100)/100||0;
        if(c!==this._envC[P.ci]){this._envC[P.ci]=c;this._syncTools();this._commit();return;}}}
    this._syncTools();this._req();},
  _envDbl(e){if(this.ch!=="env")return;const h=this._envHit(this._pt(e));if(!h||h.kind!==2)return;e.preventDefault();
    if(this._envC[h.ci]!==0){this._envC[h.ci]=0;this._syncTools();this._commit();}},
  _envReset(){if(!this._envC.some(v=>v!==0))return;this._envC=[0,0,0];this._pen=null;this._syncTools();this._commit();},
  _envNoFilt(){this._envSet("seFEnv",0);this._syncTools();this._req();},

  // ---------------- the keyboard (the screen canvas has the focus) ----------------
  // One key = one step, through the same functions as the pointer. Keys with nothing to act on (no band picked, a
  // flat segment, the wave in draw mode) are left alone, so Tab, the page's own keys and the screen reader still work.
  _key(e,k){
    if(e.altKey||e.ctrlKey||e.metaKey)return;
    const K=e.key,sh=!!e.shiftKey;
    const done=k==="eq"?this._eqKey(K,sh):k==="env"?this._envKey(K,sh):k==="wave"?this._waveKey(K,sh):false;
    if(!done)return;
    e.preventDefault();this.ch=k;
    const E=this._ed&&this._ed[k];if(E)E.kf=true;   // a key pressed = show the keyboard pick, focus-visible or not
    this._req(k);},
  // BARWA: [ ] pick a band (round the list), ← → frequency, ↑ ↓ gain, PgUp / PgDn Q (as the wheel), Delete removes,
  // Insert or + adds one at 1 kHz (as "+ Pasmo"). The axis limits are the panel's: 40 Hz–16 kHz, ±18 dB.
  _eqKey(K,sh){
    const S=SoundScreens,n=this._eq.length,i=this._eqSel,b=this._eq[i];
    if(K==="Insert"||K==="+"){this._eqAdd();return true;}
    if(K==="["||K==="]"){if(!n)return false;
      this._eqSel=K==="]"?(i<0?0:(i+1)%n):(i<0?n-1:(i-1+n)%n);this._syncTools();return true;}
    if(!b)return false;
    if(K==="Delete"||K==="Backspace"){this._eqDel(i);return true;}
    if(K==="ArrowLeft"||K==="ArrowRight"){const m=sh?this.KB_FS:this.KB_F;
      b.f=Math.max(S.EQ_F0,Math.min(S.EQ_F1,b.f*(K==="ArrowRight"?m:1/m)));this._eqCommit();return true;}
    if(K==="ArrowUp"||K==="ArrowDown"){const s=(sh?this.KB_GS:this.KB_G)*(K==="ArrowUp"?1:-1);
      b.g=Math.max(-S.EQ_G,Math.min(S.EQ_G,Math.round((b.g+s)*100)/100));this._eqCommit();return true;}
    if(K==="PageUp"||K==="PageDown"){this._eqQ(i,K==="PageUp"?this.EQ_QWHEEL:1/this.EQ_QWHEEL);return true;}
    return false;},
  // OBWIEDNIA: 1 / 2 / 3 pick the top of the attack, the end of the decay (sustain), the end of the release (legato
  // only); ← → move its time by the slider's step (Shift ×KB_T); ↑ ↓ the sustain level at point 2 (legato), elsewhere
  // the bend of the segment that ends at the point; PgUp / PgDn bend that segment at every point (so the decay of a
  // legato sound bends too). The sliders get value + "input" (_envSet), as from a dragged handle.
  _envKey(K,sh){
    const v=this._envVals();
    if(K==="1"||K==="2"||K==="3"){const id=["a","d","r"][+K-1];if(id==="r"&&!v.legato)return false;this._envSel=id;return true;}
    let id=this._envSel;if(id==="r"&&!v.legato)id=this._envSel="d";
    const ci=id==="a"?0:id==="d"?1:2;
    const nudge=(sid,dir)=>{const el=this._el(sid);if(!el)return false;const st=+el.step>0?+el.step:1;
      this._envSet(sid,+el.value+dir*st*(sh?this.KB_T:1));return true;};
    if(K==="ArrowLeft"||K==="ArrowRight")return nudge(id==="a"?"seAtt":id==="d"?"seDec":"seRel",K==="ArrowRight"?1:-1);
    if(K==="ArrowUp"||K==="ArrowDown"){const d=K==="ArrowUp"?1:-1;return id==="d"&&v.legato?nudge("seSus",d):this._envBend(ci,d,sh);}
    if(K==="PageUp"||K==="PageDown")return this._envBend(ci,K==="PageUp"?1:-1,sh);
    return false;},
  // a bend by keyboard: up = the ring moves up (a smaller c on a rising segment, a bigger one on a falling segment),
  // written like a dragged ring (2 places, then the lab); a flat segment has no ring (envHandles), so no bend either
  _envBend(ci,dir,sh){
    const seg=this._envLay(this._envVals()).segs.find(s=>s[2]===ci),dy=seg?seg[1].y-seg[0].y:0;if(Math.abs(dy)<.02)return false;
    const c0=this._envC[ci]||0,c=Math.max(-1,Math.min(1,Math.round((c0-Math.sign(dy)*dir*(sh?this.KB_CS:this.KB_C))*100)/100))||0;
    if(c!==c0){this._envC[ci]=c;this._syncTools();this._commit();}
    return true;},
  // FALA, harmonics mode only: [ ] pick a bar, ↑ ↓ its level (.05, Shift .25) — the wave is built again from the bars,
  // as when a finger pulls one (a built-in wave turns into "Własna" first, starting from its own bars)
  _waveKey(K,sh){
    if(this.mode!=="harm")return false;
    if(K==="["||K==="]"){this._bar=(this._bar+(K==="]"?1:15))%16;return true;}
    if(K!=="ArrowUp"&&K!=="ArrowDown")return false;
    this._ensureCustom();const h=this._bars(),k=this._bar,s=(sh?5:1)*this.KB_BAR*(K==="ArrowUp"?1:-1);
    h[k]=Math.max(0,Math.min(1,Math.round((h[k]+s)*100)/100));this._wt=SoundScreens.fromHarmonics(h);this._commit();
    return true;},
  _kf(k){return !!(this._ed&&this._ed[k]&&this._ed[k].kf);},

  // ---------------- the live layers: the lab bus's analyser ----------------
  // The SAME AnalyserNode the lamp reads (PadPlate._feat, rf-24b: b._plateAn, fftSize 2048, smoothing .55), made
  // here the same way when the lamp has not made it yet (no WebGL2, or the editor drawn before the lamp), and only
  // once the bus exists (labEnsure, rf-25) and the audio runs — it never CREATES the bus. It belongs to the bus:
  // PadAudio.disposeBus disconnects the bus's master, and a new bus (after labStopAll) gets a new one.
  _an(){
    const PA=typeof PadAudio!=="undefined"?PadAudio:null,b=PA&&PA.buses?PA.buses[this._labId()]:null;
    if(!b||!b.master||!PA.ctx||PA.ctx.state!=="running")return null;
    if(!b._plateAn){try{const an=PA.ctx.createAnalyser();an.fftSize=2048;an.smoothingTimeConstant=.55;b.master.connect(an);
      b._plateAn=an;b._plateFq=new Uint8Array(an.frequencyBinCount);b._plateTd=new Float32Array(an.fftSize);}catch(e){return null;}}
    return b._plateFq&&b._plateTd?{an:b._plateAn,fq:b._plateFq,td:b._plateTd}:null;},
  // one frame of the live layers, smoothed in time as in _feat (the spectrum rises in 45 ms and falls in 260, the
  // waveform follows in 35, the level rises in 40 and falls in 220); true = something still shows
  _tick(dtMs){
    const F=this._F||(this._F={sp:new Float32Array(16),wf:new Float32Array(64),lv:0});
    const A=this._an();let f=null;
    if(A){try{A.an.getByteFrequencyData(A.fq);A.an.getFloatTimeDomainData(A.td);f=this.feat(A.fq,A.td,this._sr(),A.an.fftSize);}catch(e){f=null;}}
    const k=tau=>1-Math.exp(-dtMs/tau);let mx=0;
    for(let i=0;i<16;i++){const v=f?f.sp[i]:0;F.sp[i]+=(v-F.sp[i])*k(v>F.sp[i]?45:260);mx=Math.max(mx,F.sp[i]);}
    for(let i=0;i<64;i++)F.wf[i]+=((f?f.wf[i]:0)-F.wf[i])*k(35);
    const lv=f?f.lv:0;F.lv+=(lv-F.lv)*k(lv>F.lv?40:220);
    return mx>.004||F.lv>.004;},
  // labStopAll (rf-25) freed the lab bus, and with it the analyser (it is the bus's): end a drag; the live layers
  // fade out over the next frames
  sleep(){this._pen=null;this._liveWipe();this._req();},

  // ---------------- drawing (2D) ----------------
  // the timestamp of the display frame: document.timeline.currentTime is the same number for every rAF callback of
  // one frame (the pad loop's and ours); node vm and very old engines fall back to the clock
  _frameT(){const tl=typeof document!=="undefined"&&document.timeline,t=tl?tl.currentTime:null;
    return typeof t==="number"&&Number.isFinite(t)?t:performance.now();},
  // called every frame by labDraw (rf-25) while the pad loop runs, and on demand (_req) when it idles. Draws the
  // panels that are on screen and need it (an edit, a resize, the live layers); true = a panel is on screen.
  // ONE render per display frame: the pad loop and our own rAF can land in the same frame, and the second call only
  // books the next frame while something still eases out. (Until 2026-10-02 a call less than 8 ms after the last
  // render was dropped WITHOUT booking one: at 120–144 Hz every frame is under 8 ms, so after the last note the
  // fade-out stopped half way and the panels froze.)
  draw(){
    if(typeof document==="undefined"||!this._ed)return false;
    const box=this._el("soundEditor");if(!box||!box.open)return false;
    const vis=Object.values(this._ed).filter(E=>E.cv.offsetParent!==null&&E.cv.clientWidth>0&&E.cv.clientHeight>0);
    if(!vis.length)return false;
    const d=this._dirty||(this._dirty={}),now=this._frameT();
    if(now===this._last){if(this._wasLive||vis.some(E=>d[E.k]))this._req(null,true);return true;}
    const dt=this._last>=0?Math.min(100,Math.max(0,now-this._last)):16.67;this._last=now;this._now=now;
    // trail = the afterglow on E.live still fading after the last live frame (4.5 τ, and one frame more to wipe it)
    let live=false,trail=false;
    if(vis.some(E=>E.k!=="env")){live=this._tick(dt);if(live)this._liveT=now;
      trail=!live&&now-this._liveT<=this.LIVE_TAU*4500+40;
      if(live||trail||this._wasLive)d.wave=d.eq=1;this._wasLive=live||trail;}
    for(const E of vis){if(!d[E.k])continue;d[E.k]=0;
      try{this._render(E);}catch(e){if(!this._warned){this._warned=true;console.warn("[curve-editors]",e);}}}
    if(live||trail)this._req(null,true);   // keep the live layers easing out after the last note, then rest
    return true;},
  // the frame canvas under the screen: drawn only when its size or the DPR changes (a resize clears E.fs)
  _frameDraw(E,dpr){
    const c=E.fr;if(!c)return;const W=c.clientWidth,H=c.clientHeight;if(!W||!H)return;
    const f=E.fs;if(f&&f.W===W&&f.H===H&&f.dpr===dpr)return;
    c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);
    const x=c.getContext&&c.getContext("2d");if(!x)return;
    x.setTransform(dpr,0,0,dpr,0,0);this.frame(x,W,H,this.FR);E.fs={W,H,dpr};},
  // One panel: the picture (2D, in _lin coords), then the glass. With the post-processor the picture goes into the
  // panel's own buffer and _postRun makes the screen from it; without it the picture goes straight onto the screen,
  // clipped to its rounded corners, with the 2D stand-in for the glass (_crt2d). A glass that fails on the way is
  // dropped for good (until the editor folds) and every panel is drawn again the plain way on the next frame.
  _render(E){
    const cv=E.cv,W=cv.clientWidth,H=cv.clientHeight;if(!W||!H)return;
    const dpr=(typeof window!=="undefined"&&window.devicePixelRatio)||1,pw=Math.round(W*dpr),ph=Math.round(H*dpr);
    this._frameDraw(E,dpr);
    if(cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph;}
    const vx=cv.getContext("2d");if(!vx)return;
    const P=this._postGet(),b=P?this._buf(E,pw,ph):null,x=b?E.bx:vx;
    if(P&&!b){this._postDrop();this._post=false;this._req();}   // no 2D buffer = no glass: the pointer must map linearly too
    x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,pw,ph);x.setTransform(dpr,0,0,dpr,0,0);
    // the screen: dark phosphor, a little lighter towards the middle. The gradient is sized on the whole panel
    // (screen + 2 FR), as when frame and screen were one canvas. Drawn straight, the corners outside the rounded screen
    // stay clear, so the felt of the frame canvas shows there; in the buffer the picture fills the whole rectangle (the
    // glass rounds the screen when it copies it)
    const g=x.createRadialGradient(W/2,H/2,0,W/2,H/2,(Math.max(W,H)+2*this.FR)*.6);
    g.addColorStop(0,"#12201a");g.addColorStop(1,"#0c1511");
    x.save();if(!b){this._rr(x,0,0,W,H,this.RS);x.clip();}x.fillStyle=g;x.fillRect(0,0,W,H);
    if(E.k==="wave")this._drawWave(x,W,H,E);else if(E.k==="eq")this._drawEq(x,W,H,E);else this._drawEnv(x,W,H);
    if(!b)this._crt2d(x,W,H);
    x.restore();
    if(b)this._postRun(P,b,vx,pw,ph,W,H,dpr);},
  // the panel's offscreen picture buffer, the size of its screen in device px (one per panel: the three are drawn in
  // turn every frame, and a shared buffer would be resized two or three times per frame)
  _buf(E,pw,ph){
    let c=E.buf;
    if(!c){c=E.buf=document.createElement("canvas");E.bx=c.getContext?c.getContext("2d",{alpha:false}):null;}
    if(c.width!==pw||c.height!==ph){c.width=pw;c.height=ph;}
    return E.bx?c:null;},
  // THE AFTERGLOW OF THE LIVE LAYERS (stage E8). The pink waveform (FALA) and the green spectrum (BARWA) are drawn by
  // fn onto the panel's own offscreen canvas E.live (made on its first live frame; panels wave and eq only), which is
  // not cleared but darkened once a frame by a = 1 − e^(−dt/LIVE_TAU) (destination-out; dt = the time since its last
  // frame, so a panel that was off screen comes back wiped), so a moving sound leaves a short trail, as the lamp's
  // phosphor does; the curve, the rings and the handles are drawn straight and stay sharp. fn draws OPAQUE colours
  // already scaled by the old alpha, and the layer is added onto the picture ("lighter", under the curve): a standing
  // trace converges to full alpha, so it looks as it did when it was drawn straight at that alpha on the dark screen.
  // When the last trace is older than 4.5 τ the layer is wiped and no longer pasted (an 8-bit alpha darkened by a few
  // per cent rounds back to itself, so it would keep a ghost for ever). on = there is a live trace this frame.
  _liveLayer(x,E,W,H,on,fn){
    const add=c=>{c.save();c.globalCompositeOperation="lighter";fn(c);c.restore();};
    if(!E){if(on)add(x);return;}
    let L=E.live;
    if(!L){if(!on)return;
      if(typeof document==="undefined"||!document.createElement){add(x);return;}
      L=E.live=document.createElement("canvas");E.lx=L.getContext?L.getContext("2d"):null;E.lt=-1;E.ld=-1e9;}
    const lx=E.lx;if(!lx){if(on)add(x);return;}
    const dpr=(typeof window!=="undefined"&&window.devicePixelRatio)||1,pw=Math.round(W*dpr),ph=Math.round(H*dpr);
    if(L.width!==pw||L.height!==ph){L.width=pw;L.height=ph;}
    const now=this._now!=null?this._now:this._frameT(),gap=E.lt>=0?Math.max(0,now-E.lt):Infinity;E.lt=now;
    lx.setTransform(1,0,0,1,0,0);
    if(!on&&now-E.ld>this.LIVE_TAU*4500){if(E.ld>-1e9){lx.clearRect(0,0,pw,ph);E.ld=-1e9;}return;}
    const a=1-Math.exp(-gap/(this.LIVE_TAU*1000));
    lx.globalCompositeOperation="destination-out";lx.fillStyle="rgba(0,0,0,"+a.toFixed(4)+")";lx.fillRect(0,0,pw,ph);
    lx.globalCompositeOperation="source-over";
    if(on){lx.setTransform(dpr,0,0,dpr,0,0);fn(lx);E.ld=now;}
    x.save();x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.globalCompositeOperation="lighter";x.drawImage(L,0,0);x.restore();},
  // sleep(): the afterglow of both layers goes at once (the lab was stopped)
  _liveWipe(){
    for(const E of Object.values(this._ed||{})){if(E.lx&&E.live){E.lx.setTransform(1,0,0,1,0,0);E.lx.clearRect(0,0,E.live.width,E.live.height);}E.ld=-1e9;}
    this._liveT=-1e12;},
  // an "rgb()" of colour c at strength k (0..1): the opaque stand-in for c at alpha k on the dark screen (_liveLayer)
  _rgbK(c,k){return "rgb("+c.map(v=>Math.round(v*k)).join(",")+")";},
  // no WebGL2, or the glass failed: a 2D stand-in on the flat screen, with the shader's strengths: a dark line every
  // 3 CSS px (alpha CRT_S) and an oval vignette from .6 to 1.2 of the half size (CRT_V); no dome (the pointer maps
  // linearly, _dk() 0), no glare
  _crt2d(x,W,H){
    x.save();x.shadowBlur=0;x.globalAlpha=1;x.fillStyle="rgba(0,0,0,"+this.CRT_S+")";
    for(let y=0;y<H;y+=3)x.fillRect(0,y,W,1);
    x.translate(W/2,H/2);x.scale(W/2,H/2);
    const v=x.createRadialGradient(0,0,.6,0,0,1.2);v.addColorStop(0,"rgba(0,0,0,0)");v.addColorStop(1,"rgba(0,0,0,"+this.CRT_V+")");
    x.fillStyle=v;x.fillRect(-1,-1,2,2);x.restore();},
  // BK of the shader "crt": [0] K, [1] CRT_S, [2] CRT_V, [3] CRT_G (one array, refilled each time)
  _bk(){const B=this._BK||(this._BK=new Float32Array(4));B[0]=this.K;B[1]=this.CRT_S;B[2]=this.CRT_V;B[3]=this.CRT_G;return B;},
  // THE POST-PROCESSOR: one hidden WebGL2 context for the three panels, made on the first frame that needs it.
  // PadPlate._mk builds it into a detached div (its canvas is never on the page), the shader "crt" compiles at once,
  // so a missing rf-24b, no WebGL2 or a shader that does not compile all end in the 2D fallback (_post false). One
  // texture, LINEAR and clamped, that only grows.
  _postGet(){
    if(this._post!==null)return this._post||null;
    this._post=false;
    if(typeof document==="undefined"||typeof PadPlate==="undefined"||typeof PadPlate._mk!=="function"||!PadPlate._fs||!PadPlate._fs.crt)return null;
    let st=null;
    try{st=PadPlate._mk(document.createElement("div"));if(!st)return null;
      PadPlate._prog(st,"crt");
      const gl=st.gl,tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
      for(const [a,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])
        gl.texParameteri(gl.TEXTURE_2D,a,v);
      this._post={st,tex,tw:0,th:0};}
    catch(e){console.warn("[curve-editors] crt",e);if(st)this._loseCtx(st);}
    return this._post||null;},
  // give the context back (the editor folded, the page hidden); the next frame that needs the glass tries again
  _postDrop(){const P=this._post;this._post=null;if(P)this._loseCtx(P.st);},
  _loseCtx(st){try{const x=st.gl&&st.gl.getExtension("WEBGL_lose_context");if(x)x.loseContext();}catch(e){}},
  // One panel through the glass: its buffer into the texture (texImage2D only when the texture has to grow, then
  // texSubImage2D into its bottom-left corner, flipped so the picture's top is up in GL), one pass of "crt" into the
  // bottom-left pw × ph of the GL canvas, and that rectangle copied onto the screen AT ONCE, in the same task: without
  // preserveDrawingBuffer the GL buffer is only good until the page composites, and the next panel draws over it
  // anyway. The GL canvas only grows too (the panels have two heights and take turns every frame). The screen keeps its
  // rounded corners: the copy is clipped to them, so the felt shows there. false = the glass failed (fallback).
  _postRun(P,b,vx,pw,ph,W,H,dpr){
    const st=P.st,gl=st.gl,c=st.cv;
    try{
      if(gl.isContextLost())throw new Error("WebGL context lost");
      const pg=PadPlate._prog(st,"crt"),u=pg.u;
      if(c.width<pw)c.width=pw;if(c.height<ph)c.height=ph;
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,P.tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      if(pw>P.tw||ph>P.th){P.tw=Math.max(P.tw,pw);P.th=Math.max(P.th,ph);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,P.tw,P.th,0,gl.RGBA,gl.UNSIGNED_BYTE,null);}
      gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,b);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,pw,ph);gl.useProgram(pg.pr);
      gl.uniform2f(u.R,pw,ph);gl.uniform1f(u.DPR,dpr);gl.uniform1i(u.HT,0);gl.uniform2f(u.HS,pw/P.tw,ph/P.th);
      gl.uniform1fv(u.BK,this._bk());
      gl.drawArrays(gl.TRIANGLES,0,3);
      vx.setTransform(1,0,0,1,0,0);vx.clearRect(0,0,pw,ph);
      vx.save();vx.setTransform(dpr,0,0,dpr,0,0);this._rr(vx,0,0,W,H,this.RS);vx.clip();vx.setTransform(1,0,0,1,0,0);
      vx.drawImage(c,0,c.height-ph,pw,ph,0,0,pw,ph);vx.restore();
      return true;}
    catch(e){console.warn("[curve-editors] crt",e);this._postDrop();this._post=false;this._req();return false;}},
  _font(){if(!this._fam)this._fam=(typeof getComputedStyle==="function"&&document.body&&getComputedStyle(document.body).fontFamily)||"sans-serif";return this._fam;},
  _mono(){if(!this._monoF)this._monoF=(typeof getComputedStyle==="function"&&getComputedStyle(document.documentElement).getPropertyValue("--mono").trim())||"monospace";return this._monoF;},
  // the pointer over panel k, inside its field (the cross and the readouts show only there), or null
  _hov(k){const h=this._hover;return h&&h.k===k&&h.pic.x>=-.02&&h.pic.x<=1.02&&h.pic.y>=0&&h.pic.y<=1?h:null;},
  _poly(x,pts){x.beginPath();pts.forEach((p,i)=>{if(i)x.lineTo(p.x,p.y);else x.moveTo(p.x,p.y);});},
  // a grid line across the screen: horizontal at picture y, or vertical at picture x
  _hl(x,W,H,y,col){const g=this._lin(0,y,W,H);x.strokeStyle=col;x.lineWidth=1;x.beginPath();x.moveTo(0,g.y);x.lineTo(W,g.y);x.stroke();},
  _vl(x,W,H,u,col){const g=this._lin(u,0,W,H);x.strokeStyle=col;x.lineWidth=1;x.beginPath();x.moveTo(g.x,0);x.lineTo(g.x,H);x.stroke();},
  // the lime curve: a 10 % fill down to its zero line yz, then the 2 px line with a soft glow (shadowBlur 6 is cheap
  // at this size); a = the whole curve's opacity (a built-in wave shown as a preview is dimmed)
  _lime(x,pts,yz,a){
    x.save();x.globalAlpha=a;
    x.fillStyle="rgba(166,216,97,.10)";this._poly(x,pts);x.lineTo(pts[pts.length-1].x,yz);x.lineTo(pts[0].x,yz);x.closePath();x.fill();
    x.strokeStyle=this.C.lime;x.lineWidth=2;x.lineJoin="round";x.lineCap="round";x.shadowColor="rgba(166,216,97,.75)";x.shadowBlur=6;
    this._poly(x,pts);x.stroke();x.restore();},
  // a handle ring: a graphite outline (1.5 px each side) under the colour, so a yellow ring reads on any fill; hot =
  // picked / under the pointer / dragged (full colour, a glow and a stronger fill)
  _ring(x,cx,cy,r,col,hot,fill){
    x.save();x.beginPath();x.arc(cx,cy,r,0,2*Math.PI);
    if(fill){x.globalAlpha*=hot?.3:.14;x.fillStyle=col;x.fill();x.globalAlpha/=hot?.3:.14;}
    x.lineWidth=5.5;x.strokeStyle=this.C.ink;x.stroke();
    x.globalAlpha*=hot?1:.8;x.lineWidth=2.5;x.strokeStyle=col;if(hot){x.shadowColor=col;x.shadowBlur=8;}x.stroke();
    x.restore();},
  // fillText kept on the screen: a caption whose box would reach past the screen's edge moves back inside
  _put(x,txt,gx,gy,W,H){
    const m=3,w=x.measureText(txt).width,h=12,al=x.textAlign,bl=x.textBaseline;
    const bx=al==="center"?gx-w/2:(al==="right"||al==="end"?gx-w:gx),by=bl==="middle"?gy-h/2:(bl==="top"||bl==="hanging"?gy:gy-h);
    const dx=Math.max(0,m-bx)-Math.max(0,bx+w-(W-m)),dy=Math.max(0,m-by)-Math.max(0,by+h-(H-m));
    x.fillText(txt,gx+dx,gy+dy);},
  // the panel's hint in a corner of the screen (top-left, or top-right with right): a bold line and a dimmer one that
  // wraps into two lines at most; shown while the pointer is not in the panel (the cross takes over there)
  _hint(x,W,H,a,b,right){
    const X=right?W-this.PAD:this.PAD,mw=W-2*this.PAD,fam=this._font();
    x.textAlign=right?"right":"left";x.textBaseline="top";let y=7;
    if(a){x.font="700 12px "+fam;x.fillStyle=this.C.ph;x.fillText(a,X,y);y+=16;}
    if(b){x.font="600 11px "+fam;x.fillStyle=this.C.phd;const ws=String(b).split(" ");
      for(let n=0;n<2&&ws.length;n++){let ln=ws.shift();while(ws.length&&x.measureText(ln+" "+ws[0]).width<=mw)ln+=" "+ws.shift();
        x.fillText(n===1&&ws.length?ln+" …":ln,X,y);y+=14;}}},
  // the cross under the pointer and its readout, on the side away from the right edge
  // hv = the pointer (it has .pic: its picture coords, so the cross lands under it through the dome) or a point
  // already in picture px ({px, py}: a handle the keyboard picked)
  _cross(x,hv,txt,W,H){
    const g=hv.pic?this._lin(hv.pic.x,hv.pic.y,W,H):{x:hv.px,y:hv.py};
    x.strokeStyle=this.C.ph;x.lineWidth=1;x.beginPath();
    x.moveTo(g.x-8,g.y);x.lineTo(g.x+8,g.y);x.moveTo(g.x,g.y-8);x.lineTo(g.x,g.y+8);x.stroke();
    x.font="700 12px "+this._font();x.fillStyle=this.C.ph;x.textBaseline="bottom";
    const right=g.x>W*.6;x.textAlign=right?"right":"left";
    this._put(x,txt,g.x+(right?-12:12),g.y-8,W,H);},
  _num(v){const s=(v>=0?"+":"−")+Math.abs(v).toFixed(2);return _gl(s.replace(".",","),s);},
  // BARWA cross: "820 Hz · +4,5 dB · Q 1,2" (Polish decimal comma; the English line keeps the point)
  _eqTxt(f,g,q){
    const hz=f<1000?Math.round(f)+" Hz":(+(f/1000).toFixed(f<10000?2:1))+" kHz";
    const gr=Math.round(g*10)/10,db=(gr>0?"+":gr<0?"−":"")+Math.abs(gr).toFixed(1)+" dB";
    const s=hz+" · "+db+(q!=null?" · Q "+(+q.toFixed(2)):"");
    return _gl(s.replace(/(\d)\.(\d)/g,"$1,$2"),s);},
  _txt(x){x.shadowColor="rgba(0,0,0,.8)";x.shadowBlur=3;},
  // FALA: the period between two verticals and its zero line; the lab's live waveform pink and dimmed behind the
  // curve; the curve (dimmed while a built-in wave is only previewed); in harmonics mode the 16 bars under it
  _drawWave(x,W,H,E){
    const C=this.C,harm=this.mode==="harm",w=this._curve(),cust=this._isCustom();
    const y0=harm?this.HARM_Y:this.DRAW_Y,am=harm?this.HARM_A:this.DRAW_A,P=(u,v)=>this._lin(u,v,W,H),pl=this._plot(W,H),hv=this._hov("wave");
    this._vl(x,W,H,0,C.grid2);this._vl(x,W,H,1,C.grid2);this._hl(x,W,H,y0,C.grid2);
    for(const v of [1,-1])this._hl(x,W,H,y0+v*am,C.grid);
    const F=this._F;
    this._liveLayer(x,E,W,H,!!(F&&F.lv>.004),c=>{c.strokeStyle=this._rgbK([236,26,131],Math.min(.55,.16+F.lv*.6));c.lineWidth=1.5;c.lineJoin="round";
      const lp=[];for(let i=0;i<64;i++)lp.push(P(i/63,y0+F.wf[i]*am*.9));this._poly(c,lp);c.stroke();});
    if(harm){const h=this._bars(),bw=Math.max(5,Math.min(16,(pl.x1-pl.x0)/16*.42));
      x.save();x.lineCap="round";x.lineWidth=bw;
      for(let k=0;k<16;k++){const u=(k+.5)/16,a=P(u,this.BAR0),t=P(u,this.BAR0+this.BARH),b=P(u,this.BAR0+h[k]*this.BARH);
        x.strokeStyle="rgba(120,200,150,.12)";x.shadowBlur=0;x.beginPath();x.moveTo(a.x,a.y);x.lineTo(t.x,t.y);x.stroke();
        if(h[k]>.002){x.strokeStyle=C.lime;x.shadowColor="rgba(166,216,97,.6)";x.shadowBlur=6;x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke();}}
      x.restore();}
    const pts=[];for(let i=0;i<64;i++)pts.push(P(i/63,y0+w[i]*am));
    this._lime(x,pts,P(0,y0).y,cust?1:.45);
    const Pn=this._pen;
    if(!harm&&Pn&&Pn.last&&Pn.last.i!=null){const g=P(Pn.last.i/63,this.DRAW_Y+Pn.last.v*this.DRAW_A);this._ring(x,g.x,g.y,this.R_PT,C.yel,true,false);}
    // the keyboard's bar (focused panel, harmonics mode, no pointer over it): a ring at its top and its readout
    const kb=harm&&!hv&&!Pn&&this._kf("wave")?P((this._bar+.5)/16,this.BAR0+this._bars()[this._bar]*this.BARH):null;
    if(kb)this._ring(x,kb.x,kb.y,this.R_BEND,C.yel,true,false);
    x.save();this._txt(x);x.font="600 11px "+this._mono();x.fillStyle=C.phd;
    if(harm){x.textAlign="center";x.textBaseline="bottom";
      for(let k=0;k<16;k++){const g=P((k+.5)/16,0);this._put(x,String(k+1),g.x,g.y+this.PAD-1,W,H);}}
    else{x.textAlign="right";x.textBaseline="bottom";
      [[1,"+1"],[0,"0"],[-1,"−1"]].forEach(([v,t])=>{const g=P(1,this.DRAW_Y+v*this.DRAW_A);this._put(x,t,g.x-4,g.y-2,W,H);});}
    if(hv){let txt;
      if(harm){const k=Math.max(0,Math.min(15,Math.floor(hv.pic.x*16)));
        txt=_gl("harmoniczna","harmonic")+" "+(k+1)+" · "+Math.round(this._bars()[k]*100)+" %";}
      else txt=this._num(Math.max(-1,Math.min(1,(hv.pic.y-this.DRAW_Y)/this.DRAW_A)));
      this._cross(x,hv,txt,W,H);}
    else if(kb)this._cross(x,{px:kb.x,py:kb.y},_gl("harmoniczna","harmonic")+" "+(this._bar+1)+" · "+Math.round(this._bars()[this._bar]*100)+" %",W,H);
    else if(!Pn)this._hint(x,W,H,harm?_gl("Ciągnij słupki: głośność kolejnych harmonicznych","Drag the bars: the level of each harmonic")
                                  :_gl("Narysuj jeden okres fali","Draw one period of the wave"),
                         cust?"":_gl("podgląd fali z listy · dotknij, żeby ją zmienić","the listed wave · touch it to change it"));
    x.restore();},
  // BARWA: the grid (100 Hz / 1 kHz / 10 kHz, ±12 dB, the 0 dB line brighter); the live spectrum as a green fill from
  // the bottom (the 16 bands of feat at their middles on the equaliser's log axis); the summed response; the rings
  _drawEq(x,W,H,E){
    const S=SoundScreens,C=this.C,P=(u,v)=>this._lin(u,v,W,H),hv=this._hov("eq");
    for(const f of [100,1000,10000])this._vl(x,W,H,S.xf(f),C.grid);
    for(const g of [12,-12])this._hl(x,W,H,S.gy(g),C.grid);
    this._hl(x,W,H,S.EQ_Y,C.grid2);
    const F=this._F;
    this._liveLayer(x,E,W,H,!!(F&&Math.max(...F.sp)>.004),c=>{const sp=[];
      for(let i=0;i<16;i++)sp.push(P(Math.max(0,Math.min(1,S.xf(60*Math.pow(200,(i+.5)/16)))),.02+F.sp[i]*.72));
      const yb=H;
      c.fillStyle=this._rgbK([108,200,90],.22);this._poly(c,sp);c.lineTo(sp[15].x,yb);c.lineTo(sp[0].x,yb);c.closePath();c.fill();
      c.strokeStyle=this._rgbK([150,235,120],.55);c.lineWidth=1.5;c.lineJoin="round";this._poly(c,sp);c.stroke();});
    const c=S.eqCurve(this._eq,this._sr()),pts=[];for(let i=0;i<64;i++)pts.push(P(i/63,S.gy(c[i])));
    this._lime(x,pts,P(0,S.EQ_Y).y,1);
    const Pn=this._pen,hot=(Pn&&Pn.eq!=null)?Pn.eq:(hv?this._eqHit(hv):-1);
    this._eq.forEach((b,i)=>{const g=this._eqLin(b,W,H),on=i===this._eqSel||i===hot;
      this._ring(x,g.x,g.y,S.eqR(b.q),C.yel,on,true);
      x.save();x.globalAlpha=on?1:.8;x.fillStyle=C.yel;x.beginPath();x.arc(g.x,g.y,3,0,2*Math.PI);x.fill();x.restore();});
    // axis captions on their grid lines: Hz along the bottom, dB at the right edge
    x.save();this._txt(x);x.font="600 11px "+this._mono();x.fillStyle=C.phd;x.textAlign="left";x.textBaseline="bottom";
    [[100,"100 Hz"],[1000,"1 kHz"],[10000,"10 kHz"]].forEach(([f,t])=>{const g=P(S.xf(f),0);this._put(x,t,g.x+4,g.y+this.PAD-2,W,H);});
    x.textAlign="right";
    [[12,"+12 dB"],[0,"0 dB"],[-12,"−12 dB"]].forEach(([v,t])=>{const g=P(1,S.gy(v));this._put(x,t,g.x-4,g.y-2,W,H);});
    if(hv){   // over a ring (or dragging one): that band; elsewhere: the point under the pointer
      const i=(Pn&&Pn.eq!=null)?Pn.eq:this._eqHit(hv),b=this._eq[i];
      this._cross(x,hv,b?this._eqTxt(b.f,b.g,b.q):this._eqTxt(S.fx(Math.max(0,Math.min(1,hv.pic.x))),S.yg(hv.pic.y)),W,H);}
    else if(!Pn&&this._kf("eq")&&this._eq[this._eqSel]){   // the keyboard: the picked band's readout at its ring
      const b=this._eq[this._eqSel],g=this._eqLin(b,W,H);this._cross(x,{px:g.x,py:g.y},this._eqTxt(b.f,b.g,b.q),W,H);}
    else if(!Pn)this._hint(x,W,H,_gl("Ciągnij pierścienie: częstotliwość i wzmocnienie","Drag the rings: frequency and gain"),
                         _gl("kółko = szerokość pasma (Q) · dwuklik usuwa · dotknij pustego miejsca = nowe pasmo",
                             "wheel = bandwidth (Q) · double-click removes · touch an empty spot = new band"));
    x.restore();},
  // OBWIEDNIA: the silence line and the time grid; the amber filter envelope under the lime volume envelope; the
  // handles; captions at the points; the cross with the values of the handle under it
  _drawEnv(x,W,H){
    const S=SoundScreens,C=this.C,P=(u,w)=>this._lin(u,w,W,H),pl=this._plot(W,H),hv=this._hov("env");
    const v=this._envVals(),lay=this._envLay(v),c=this._envC,hs=S.envHandles(lay,c,v.fEnv,v.fEnvT),Pn=this._pen,drag=!!(Pn&&Pn.env);
    const ms=s=>Math.round(s*1000)+" ms",pc=f=>Math.round(f*100)+" %",H_=id=>hs.find(h=>h.id===id);
    this._hl(x,W,H,S.ENV_Y0,C.grid2);
    if(v.fEnv!==0)this._hl(x,W,H,S.ENV_FZ,"rgba(234,163,43,.16)");
    // the time grid along the silence line: a tick every 100 ms (500 ms, 1 s… once they would crowd under 20 px), a
    // caption on every tick that is a multiple of the first step giving at least 46 px between captions
    const pps=(pl.x1-pl.x0)/lay.spu,step=[.1,.5,1,2,5].find(s=>s*pps>=20)||10;
    const lab=[.1,.2,.5,1,2,5,10].find(s=>s>=step-1e-9&&s*pps>=46&&Math.abs(s/step-Math.round(s/step))<1e-6)||step*10;
    x.save();x.strokeStyle="rgba(204,246,210,.4)";x.lineWidth=1;this._txt(x);x.font="600 11px "+this._mono();x.fillStyle=C.phd;x.textAlign="left";x.textBaseline="bottom";
    for(let i=1;i<=400;i++){const t=i*step,u=S.xOfT(lay,t);if(u>1)break;
      const a=P(u,S.ENV_Y0-.025),b=P(u,S.ENV_Y0+.025);
      x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke();
      const r=t/lab;if(Math.abs(r-Math.round(r))<1e-6){const s=(+t.toFixed(2))+" s";this._put(x,_gl(s.replace(".",","),s),b.x+3,b.y-1,W,H);}}
    x.restore();
    if(v.fEnv!==0){const fe=S.envFilter(v.fEnv,v.fEnvT,lay.spu),fp=[];for(let i=0;i<64;i++)fp.push(P(i/63,fe[i]));
      x.save();x.strokeStyle="rgba(234,163,43,.9)";x.lineWidth=1.5;x.lineJoin="round";x.shadowColor="rgba(234,163,43,.6)";x.shadowBlur=5;
      this._poly(x,fp);x.stroke();x.restore();}
    const poly=S.envPoly(lay,c),pts=[];for(let i=0;i<32;i++)pts.push(P(poly.x[i],poly.y[i]));
    this._lime(x,pts,P(0,S.ENV_Y0).y,1);
    // the keyboard's point (focused panel, no pointer over it): drawn hot, with the readout of a hovered handle
    const kh=!drag&&!hv&&this._kf("env")?(H_(this._envSel)||H_("d")):null;
    const hit=drag?null:(hv?this._envHit(hv):null),hot=drag?Pn.env:(hit?hit.id:(kh?kh.id:null));
    hs.forEach(h=>{const g=P(h.x,h.y),on=h.id===hot;
      if(h.kind===1)this._ring(x,g.x,g.y,this.R_PT,C.yel,on,true);
      else if(h.kind===2)this._ring(x,g.x,g.y,this.R_BEND,C.bend,on,false);
      else{x.save();if(v.fEnv===0&&!on)x.globalAlpha=.5;this._ring(x,g.x,g.y,this.R_FILT,C.amb,on,true);x.restore();}});
    // captions at the points: the attack below-right of its top; the decay and the sustain level beside the end of
    // the decay (that one point sets both), on the side away from the edge; the end of a release (or of a pluck's
    // decay) up-left of its ring, above the time captions
    x.save();this._txt(x);x.font="600 11px "+this._mono();x.fillStyle=C.ph;x.textBaseline="middle";
    const cap=(h,txt,dx,dy,al)=>{if(!h)return;const g=P(h.x,h.y);x.textAlign=al;this._put(x,txt,g.x+dx,g.y+dy,W,H);};
    const tD=_gl("zanik ","decay ")+ms(v.dec),tS=_gl("podtrzymanie ","sustain ")+pc(v.sus);
    cap(H_("a"),_gl("atak ","attack ")+ms(v.att),20,12,"left");
    if(lay.legato){const d=H_("d"),dy=lay.ys>.75?[12,26]:(lay.ys<.25?[-26,-12]:[-7,7]);
      cap(d,tD,20,dy[0],"left");cap(d,tS,20,dy[1],"left");
      cap(H_("r"),_gl("zwolnienie ","release ")+ms(v.rel),-19,-30,"right");}   // −30: clear of the time captions
    else cap(H_("d"),tD,-19,-30,"right");
    if(hv||kh){
      const h=drag?{id:Pn.env,ci:Pn.ci}:(hv?this._envHit(hv):kh),id=h&&h.id;let txt;
      if(id==="a")txt=_gl("atak ","attack ")+ms(v.att);
      else if(id==="d")txt=tD+(lay.legato?" · "+tS:"");
      else if(id==="r")txt=_gl("zwolnienie ","release ")+ms(v.rel);
      else if(id==="f")txt=_gl("filtr ","filter ")+(v.fEnv>0?"+":v.fEnv<0?"−":"")+pc(Math.abs(v.fEnv))+" · "+ms(v.fEnvT);
      else if(h&&h.ci!=null)txt=_gl(["zgięcie ataku ","zgięcie zaniku ","zgięcie zwolnienia "][h.ci],
                                     ["attack bend ","decay bend ","release bend "][h.ci])+this._num(this._envC[h.ci]||0);
      else txt=ms(Math.max(0,(hv.pic.x-lay.x0)*lay.spu))+" · "+pc(Math.max(0,Math.min(1,(hv.pic.y-S.ENV_Y0)/(S.ENV_Y1-S.ENV_Y0))));
      this._cross(x,hv||{px:P(kh.x,kh.y).x,py:P(kh.x,kh.y).y},txt,W,H);}
    else if(!drag)this._hint(x,W,H,_gl("Ciągnij punkty: atak, zanik i podtrzymanie, zwolnienie","Drag the points: attack, decay and sustain, release"),
                             _gl("małe pierścienie zginają odcinek · bursztyn = obwiednia filtra (wielkość i czas)",
                                 "small rings bend a segment · amber = the filter envelope (amount and time)"),true);
    x.restore();},
};
if(typeof window!=="undefined")window.SoundEditors=SoundEditors;

// ---- the "crt" shader: the glass of the three panels (stage E7) ----
// Registered from outside like the lamp's (D7): only PadPlate._fs gets the source, so it never shows up on the pad
// background list. rf-24b's prelude declares R, DPR, HT and HS and calls plate(); this source adds its own BK (4 lanes,
// SoundEditors._bk). A load without rf-24b (node vm) only fills the stand-in PadPlate._fs the harness gives it.
if(typeof PadPlate!=="undefined"&&PadPlate._fs){
PadPlate._fs.crt=`uniform float BK[4];
// THE PANELS' GLASS (rf-25e _postRun), the lamp's CRT in a mild dose over a picture drawn in 2D. HT holds the picture
// in its bottom-left corner (HS = the share of the texture it covers: the texture only grows, the three panels take
// turns on it), R = the panel's size in device px, r in CSS px. BK: [0] K = the dome, [1] the depth of the scanlines,
// [2] the vignette, [3] the glare (1 = as designed); SoundEditors keeps the numbers (K, CRT_S, CRT_V, CRT_G) and maps
// the pointer through the same dome (picToCv / cvToPic). sc = this pixel, -1..1 per axis from the middle (y up); the
// picture point seen here is pc = sc*(1 + K*|sc|^2), t its uv in the picture.
vec3 crtTap(vec2 t){vec2 h=.5/R;return texture(HT,clamp(t,h,1.-h)*HS).rgb;}
vec3 plate(vec2 px,vec2 uv,vec2 r){
  vec2 sc=(uv-.5)*2.;float q2=dot(sc,sc);
  vec2 pc=sc*(1.+BK[0]*q2),t=pc*.5+.5;
  // the picture and a cheap phosphor bloom: a quarter of the mean of four taps 1.5 CSS px away
  vec2 d=1.5/r;
  vec3 col=crtTap(t);
  col+=.0625*(crtTap(t+vec2(d.x,0.))+crtTap(t-vec2(d.x,0.))+crtTap(t+vec2(0.,d.y))+crtTap(t-vec2(0.,d.y)));
  // the scanlines lie on the picture (t), so they bend with the dome: a line every 3 device px
  col*=1.-BK[1]*(.5+.5*cos(t.y*R.y*2.0944));
  // past the picture's edge (the dome pulled it in): dark glass, the edge softened over about a CSS px
  vec2 o2=max(-t,t-1.)*r;float fo=max(o2.x,o2.y);
  col=mix(col,vec3(.024,.036,.031),smoothstep(-.5,.8,fo));
  col*=1.-BK[2]*smoothstep(.6,1.2,length(sc));
  // the glare: a soft lobe top-left and a thin bright band 4 px under the top edge, fading towards its ends
  vec2 hd=(sc-vec2(-.55,.6))/vec2(.55,.45);col+=vec3(.85,.92,1.)*.06*BK[3]*exp(-dot(hd,hd));
  float tb=(1.-sc.y)*r.y*.5-4.;
  col+=vec3(.9,.95,1.)*.05*BK[3]*exp(-tb*tb*.35)*(1.-smoothstep(.55,.95,abs(sc.x+.1)));
  return col;}`;
}
