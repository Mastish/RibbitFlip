"use strict";
// ===== PadPlate: audio-reactive WebGL2 backgrounds under the Synth pads (play pads + effect pads) =====
// Built in a standalone prototype outside the repo and moved here whole. The 2D pad canvas stays
// on top (grid, note names, frogs); this module owns a second canvas under it. Pads carry `plate`
// (id from PAD_PLATES, default "staw") and `scaleView` (show the grid + note names or not).
// Every preset is its own small fragment shader built on a shared prelude, compiled lazily per pad.
// Direction (owner, 2026-09-30): punk / DIY print & craft — paper, ink, tape, thread — NOT glitch art:
// no tearing, no shaking, grain does not reshuffle every frame. All smoothing is in TIME, not per frame.
// Audio inputs per frame: LV level · BA bass · MI mids · HI treble · KI hit (decays) · SP[16] log spectrum
// · WF[64] oscilloscope trace (zero-crossing triggered) · P[4] touches (x,y,strength,seed) that FADE
// after release, so marks linger like ink instead of vanishing.
const PAD_PLATES=[
  ["off","Zwykłe","Klasyczne niebieskie tło pada, bez reakcji na dźwięk."],
  ["haft","Haft","Kanwa i krzyżyki: korektor wyszywany nitką, a każda żaba wyszywa pole w swoim kolorze."],
  ["staw","Staw","Woda z góry, liczona jak prawdziwa: wodą porusza tylko żaba. Płynąc zostawia smugę fal, jej śpiew i bas drżą na tafli, uderzenie to plusk pod nią.",1],
];
function padPlateOK(v){return PAD_PLATES.some(p=>p[0]===v);}
// Plates removed after the owner's review (2026-10-01) → their nearest living relative. Applied when a pad is
// read from a save or a scene (padDe / padApplyState in rf-20) and, as a safety net, in draw().
const PAD_PLATE_LEGACY={"staw-filc":"staw","staw-roz":"staw","staw-bursztyn":"staw","kanwa-osc":"haft","poziomice-haft":"poziomice",
  "koral":"koral-mitoza","futro":"staw","dzins":"staw","kreski":"staw","offset-cmyk":"staw","plakat":"staw","magnes":"staw","piasek":"staw","opilki":"staw",
  "staw-limonka":"staw","sweter":"staw","laka":"staw","riso-osc":"neon",   // removed 2026-10-01 (owner, round 2)
  "zeszyt":"staw",   // removed 2026-10-02 (owner)
  "lawa":"lawa-3","lawa-2":"lawa-3","lawa-szklo":"lawa-3"};   // the first two lamps retired behind v3 (owner, 10-02); their code stays for the body v3 inherits; lawa-szklo = the lamp behind glass, tried and dropped on 11-19 (owner: the plain one is far better)
function padPlateFix(v){if(typeof v==="string"&&Object.prototype.hasOwnProperty.call(PAD_PLATE_LEGACY,v))v=PAD_PLATE_LEGACY[v];
  return padPlateOK(v)?v:"staw";}
function padPlateOn(inst){return !!inst&&padPlateOK(inst.plate)&&inst.plate!=="off";}
// dark plates (4th field = 1) want the grid and note names drawn light
function padPlateDark(id){const d=PAD_PLATES.find(p=>p[0]===id);return !!(d&&d[3]);}
// <option>s for a background <select> (names go through the i18n dictionary like every other option text)
function padPlateOptionsHTML(sel){return PAD_PLATES.map(([v,l,d])=>`<option value="${v}"${v===sel?" selected":""} title="${d.replace(/"/g,"&quot;")}">${l}</option>`).join("");}

const _POND=`float vq(vec2 p){vec2 fi=floor(p);ivec2 i=ivec2(fi);vec2 f=p-fi;f=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(hI(i),hI(i+ivec2(1,0)),f.x),mix(hI(i+ivec2(0,1)),hI(i+ivec2(1,1)),f.x),f.y);}
float fq(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vq(p);p=rot(.6)*p*2.03+17.1;a*=.5;}return s;}
// palette: deep / shallow bottom, reflected sky low→high, caustic light, glint colour
vec3 pondShade(vec2 px,vec2 uv,vec2 r,vec3 n,float ca,vec3 deep,vec3 shal,vec3 skyA,vec3 skyB,vec3 cau,vec3 hi){
  vec2 bp=px+n.xy*14.;
  vec3 bottom=mix(deep,shal,smoothstep(.2,.8,fq(bp*.006+3.)));
  if(ca<0.)ca=pow(1.-abs(sin(fq(bp*.03+T*.15)*12.)),6.);
  bottom+=cau*ca*(.4+LV*.6);
  float fres=pow(1.-n.z,2.)*3.+.12;
  vec3 col=mix(bottom,mix(skyA,skyB,uv.y),clamp(fres,0.,.85));
  vec3 L=normalize(vec3(-.4,.5,.75));
  col+=hi*pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),60.)*.55;
  // shimmer: slow drifting sheen + sparse glints that twinkle where the surface faces the light
  col+=cau*.3*smoothstep(.45,.75,fq(px*.004+vec2(T*.03,-T*.02)))*(.5+LV*.5);
  // sparkles: a round point per 14 px cell at a random spot, twinkling on its own phase, only where the
  // wave faces the light
  vec2 gc=floor(px/14.),gp=(gc+.2+.6*vec2(h1(gc),h1(gc+3.1)))*14.;
  float tw=max(0.,sin(T*(1.5+h1(gc+7.)*2.)+h1(gc+5.)*6.28));
  float gl=smoothstep(1.8,0.,length(px-gp))*pow(tw,6.)*step(.75,h1(gc+9.))*smoothstep(.97,1.,dot(n,normalize(vec3(-.3,.4,1.))));
  return col+hi*gl*.5;}
// the simulated pond: height field from the wave-equation texture, caustics from its curvature
vec3 pondSim(vec2 px,vec2 uv,vec2 r,vec3 deep,vec3 shal,vec3 skyA,vec3 skyB,vec3 cau,vec3 hi){
  vec2 t=HS;float hc=texture(HT,uv).r;
  float he=texture(HT,uv+vec2(t.x,0.)).r,hw=texture(HT,uv-vec2(t.x,0.)).r;
  float hn=texture(HT,uv+vec2(0.,t.y)).r,hs=texture(HT,uv-vec2(0.,t.y)).r;
  vec3 n=normalize(vec3(-(he-hw)*2.6,-(hn-hs)*2.6,1.));
  float lap=he+hw+hn+hs-4.*hc;
  float ca=clamp(-lap*9.,0.,1.)*.9+.22*pow(1.-abs(sin(fq((px+n.xy*14.)*.03+T*.1)*12.)),6.);
  return pondShade(px,uv,r,n,ca,deep,shal,skyA,skyB,cau,hi);}
`;
// "#rrggbb" or "rgb(r,g,b)" → [0..1]×3 (capsule colours come in both forms); unknown → the app pink
function _plateRGB(c){c=String(c||"");let m=/^#([0-9a-f]{6})$/i.exec(c);
  if(m){const v=parseInt(m[1],16);return [(v>>16&255)/255,(v>>8&255)/255,(v&255)/255];}
  m=/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c);
  if(m)return [+m[1]/255,+m[2]/255,+m[3]/255];
  return [.925,.102,.514];}
const PadPlate={
  _vs:`#version 300 es
in vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`,
  _pre:`#version 300 es
precision highp float;
uniform vec2 R;uniform float T,LV,BA,MI,HI,KI,DPR;uniform int NP;
uniform float SP[16];uniform float WF[64];uniform vec4 P[4];
uniform sampler2D HT;uniform vec2 HS;uniform float HC;uniform vec3 PC[4];uniform vec3 SC[3];
// SPL = the spectrum eased slowly (~.16 s up, ~.6 s down)
uniform float SPL[16];
out vec4 o;
const vec3 PAPER=vec3(.949,.929,.882),INK=vec3(.129,.122,.114),PINK=vec3(.925,.102,.514),GREEN=vec3(.424,.702,.247),
  LIME=vec3(.651,.847,.380),AMBER=vec3(.918,.639,.169),PEN=vec3(.16,.29,.66),RED=vec3(.72,.15,.29),KRAFT=vec3(.78,.64,.45);
float h1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float hI(ivec2 q){uvec2 u=uvec2(q)*uvec2(1597334673u,3812015801u);uint n=(u.x^u.y)*1597334673u;return float(n>>8)*(1./16777216.);}
float vn(vec2 p){vec2 fi=floor(p);ivec2 i=ivec2(fi);vec2 f=p-fi;f=f*f*(3.-2.*f);
  return mix(mix(hI(i),hI(i+ivec2(1,0)),f.x),mix(hI(i+ivec2(0,1)),hI(i+ivec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s;}
float spec(float x){float f=clamp(x,0.,1.)*15.;int i=int(floor(f));int j=min(i+1,15);return mix(SP[i],SP[j],fract(f));}
float wf(float x){float f=clamp(x,0.,1.)*63.;int i=int(floor(f));int j=min(i+1,63);return mix(WF[i],WF[j],fract(f));}
float specS(float x){float f=clamp(x,0.,1.)*15.;int i=int(floor(f));int j=min(i+1,15);return mix(SPL[i],SPL[j],fract(f));}
float touch(vec2 uv,float asp){float s=0.;for(int i=0;i<4;i++){if(i>=NP)break;
  vec2 d=(uv-P[i].xy)*vec2(asp,1.);s+=P[i].z*exp(-dot(d,d)*14.);}return s;}
// the same field, but also WHOSE it is: rgb = the frogs' own colours weighted by closeness, a = strength
vec4 touchC(vec2 uv,float asp){float s=0.;vec3 c=vec3(0.);for(int i=0;i<4;i++){if(i>=NP)break;
  vec2 d=(uv-P[i].xy)*vec2(asp,1.);float w=P[i].z*exp(-dot(d,d)*14.);s+=w;c+=PC[i]*w;}return vec4(c/max(s,1e-4),s);}
float ht(vec2 px,float v,float c,float a){mat2 r=mat2(cos(a),-sin(a),sin(a),cos(a));
  vec2 g=fract(r*px/c)-.5;float rad=sqrt(clamp(v,0.,1.))*.74;float w=1.2/c;
  return 1.-smoothstep(rad-w,rad+w,length(g));}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float lineAA(float d,float w){return 1.-smoothstep(w-.7,w+.7,d);}
float foot(vec2 px){return mix(.3,1.,smoothstep(12.,46.,px.y));}   // keep the note-name strip light
vec3 paper(vec2 px){return PAPER*(.97+.03*vn(px*.6))*(.99+.01*vn(vec2(px.x*.05,px.y*2.)));}
float hangTape(vec2 uv,float s){return smoothstep(-.01,.01,uv.y-(1.-(s*.30+.012))+(vn(vec2(uv.x*22.,3.7))-.5)*.02);}
vec3 plate(vec2 px,vec2 uv,vec2 r);
void main(){vec2 r=R/DPR;vec2 px=gl_FragCoord.xy/DPR;o=vec4(plate(px,px/r,r),1.);}
`,
  _fs:{
haft:`vec3 plate(vec2 px,vec2 uv,vec2 r){float cs=12.;vec2 c=floor(px/cs);vec2 f=fract(px/cs);
  float hd=min(min(length(f),length(f-vec2(1.,0.))),min(length(f-vec2(0.,1.)),length(f-1.)));
  vec3 col=vec3(.95,.93,.87)*(1.-.18*smoothstep(.16,.08,hd))*(.97+.03*step(.5,fract(px.x/2.)));
  float cols=max(1.,floor(r.x/cs)),rows=max(4.,floor(r.y/cs));
  float need=(c.y-3.+.5)/(rows-3.);
  float val=spec((c.x+.5)/cols)*1.15;
  float on=step(0.,c.y-3.)*step(need,val);
  vec4 tcc=touchC((c+.5)*cs/r,r.x/r.y);float tc=tcc.a;
  // owner, 10-02: a stitch is there or it is not (full thread, never a ghost); only its COLOUR grades: the frog's own
  // colour in the middle of its circle, blending into the bar's colour towards the edge and beyond it, the way two
  // frogs' colours blend between them
  // ...and in steps, not a smooth ramp (owner, 10-02: "harder transitions"): five rings of colour, one colour per stitch
  float pk=step(.45,tc),mixq=floor(smoothstep(.12,.8,tc)*4.+.5)/4.;
  vec3 eq=need<.35?GREEN:(need<.65?AMBER:PINK);vec3 th=mix(eq,tcc.rgb,mixq);
  float d1=abs(f.x-f.y)*.7071*cs,d2=abs(f.x+f.y-1.)*.7071*cs;
  float s1=lineAA(d1,1.7),s2=lineAA(d2,1.7);
  float st=max(s1,s2)*step(.08,hd);
  float shade=s2>.5?1.:.82;
  return mix(col,th*shade*(.9+.1*vn(px*2.))*(1.+.15*KI),st*max(on,pk)*.95);}`,   // a hit lights the thread a touch
staw:_POND+`vec3 plate(vec2 px,vec2 uv,vec2 r){return pondSim(px,uv,r,vec3(.09,.19,.16),vec3(.16,.24,.17),vec3(.62,.78,.80),vec3(.88,.93,.9),vec3(.18,.22,.12),vec3(.9,.95,.85));}`
  },
  // ---- persistent GPU state ("sims"): ping-pong RGBA16F at a fixed 120 Hz step; every sim preset brings
  //      its own update shader `vec4 st(vec2 uv,vec2 A)` (A = aspect fix). Presets register in _sims.
  //      Injection is shared: SEG = frog path this step, SEGP = (wake, held, colour 0 pink/1 green/2 ink, song),
  //      DROP = (x, y, amount, radius) for hits (≥.55), drizzle from the treble (<.45) and bass swells (r ≥ 20 cells).
  _simPre:`#version 300 es
precision highp float;
uniform sampler2D S;uniform vec2 TX;uniform float T,LV,BA,MI,HI,KI,FRESH;
uniform float SP[16];uniform float WF[64];uniform vec4 SEG[4];uniform vec4 SEGP[4];uniform int NS;uniform vec4 DROP[4];uniform int ND;
out vec4 o;
float h1(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float hI(ivec2 q){uvec2 u=uvec2(q)*uvec2(1597334673u,3812015801u);uint n=(u.x^u.y)*1597334673u;return float(n>>8)*(1./16777216.);}
float vn(vec2 p){vec2 fi=floor(p);ivec2 i=ivec2(fi);vec2 f=p-fi;f=f*f*(3.-2.*f);
  return mix(mix(hI(i),hI(i+ivec2(1,0)),f.x),mix(hI(i+ivec2(0,1)),hI(i+ivec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s;}
float spec(float x){float f=clamp(x,0.,1.)*15.;int i=int(floor(f));int j=min(i+1,15);return mix(SP[i],SP[j],fract(f));}
float sdSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-8),0.,1.);return length(pa-ba*h);}
float wf(float x){float f=clamp(x,0.,1.)*63.;int i=int(floor(f));int j=min(i+1,63);return mix(WF[i],WF[j],fract(f));}
vec4 s(vec2 uv){return texture(S,uv);}
// THE CURRENT A SWIMMING FROG DRAGS ALONG (owner, 2026-10-01: "więcej się powinno dziać przy ruszaniu"), in cells per
// step: the water around the path follows the frog (k = how much), and a pair of eddies turns on its two sides.
// Sims fetch their state from uv - frogFlow·TX (semi-Lagrangian), so whatever lies in the water gets swept and curled.
vec2 frogFlow(vec2 uv,vec2 A,float R,float k){vec2 f=vec2(0.);for(int i=0;i<4;i++){if(i>=NS)break;
  vec2 sd=(SEG[i].zw-SEG[i].xy)*A/TX.y;float L=length(sd);if(L<1e-4)continue;
  vec2 q=(uv-SEG[i].zw)*A/TX.y;float d=sdSeg(uv*A,SEG[i].xy*A,SEG[i].zw*A)/TX.y,w=SEGP[i].y*exp(-d*d/(R*R));
  float side=sign(sd.x*q.y-sd.y*q.x);
  f+=(sd*k+vec2(-q.y,q.x)/max(length(q),1.)*side*L*.6)*w;}return f;}
vec4 st(vec2 uv,vec2 A);
void main(){vec2 uv=gl_FragCoord.xy*TX;o=st(uv,vec2(TX.y/TX.x,1.));}
`,
  _sims:{
    staw:{it:1,onlyFrogs:true,fs:`vec4 st(vec2 uv,vec2 A){vec4 c=s(uv);
  float nb=s(uv+vec2(0.,TX.y)).r+s(uv-vec2(0.,TX.y)).r+s(uv+vec2(TX.x,0.)).r+s(uv-vec2(TX.x,0.)).r;
  float h=(nb*.5-c.g)*.9925;
  for(int i=0;i<4;i++){if(i>=NS)break;float d=sdSeg(uv*A,SEG[i].xy*A,SEG[i].zw*A);h+=(SEGP[i].x+SEGP[i].w)*smoothstep(6.*TX.y,0.,d);}
  for(int i=0;i<4;i++){if(i>=ND)break;float d=length((uv-DROP[i].xy)*A);h-=DROP[i].z*smoothstep(DROP[i].w,0.,d);}
  return vec4(clamp(h,-4.,4.),c.r,0.,1.);}`}
  },
  _SIM_STEP:1000/120,
  _simProg(st,id){
    st.simProgs=st.simProgs||{};if(st.simProgs[id])return st.simProgs[id];
    const gl=st.gl;
    const sh=(t,src)=>{const x=gl.createShader(t);gl.shaderSource(x,src);gl.compileShader(x);
      if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error("sim "+id+": "+gl.getShaderInfoLog(x));return x;};
    const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,this._vs));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,this._simPre+this._sims[id].fs));
    gl.bindAttribLocation(pr,0,"a");gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error("sim "+id+": "+gl.getProgramInfoLog(pr));
    const u={};for(const n of ["S","TX","T","LV","BA","MI","HI","KI","SP","WF","SEG","SEGP","NS","DROP","ND","FRESH"])u[n]=gl.getUniformLocation(pr,n);
    return st.simProgs[id]={pr,u};
  },
  _simInit(st,w,h,id){
    const gl=st.gl;if(!gl.getExtension("EXT_color_buffer_float"))return null;
    this._simProg(st,id);
    const mk=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null);
      for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
      const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);return {t,fb};};
    const sim={id,w,h,a:mk(),b:mk(),acc:0,hitSeen:0};
    const warm=this._sims[id].warm|0;
    if(warm){const pg=this._simProg(st,id),u=pg.u;
      gl.useProgram(pg.pr);gl.viewport(0,0,w,h);gl.uniform2f(u.TX,1/w,1/h);gl.uniform1i(u.S,0);gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(u.NS,0);gl.uniform1i(u.ND,0);
      for(let k=0;k<warm;k++){gl.uniform1f(u.FRESH,k?0:1);
        gl.bindFramebuffer(gl.FRAMEBUFFER,sim.b.fb);gl.bindTexture(gl.TEXTURE_2D,sim.a.t);gl.drawArrays(gl.TRIANGLES,0,3);
        const x=sim.a;sim.a=sim.b;sim.b=x;}
      gl.uniform1f(u.FRESH,0);}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    return sim;
  },
  _simFree(st){const s=st.sim;if(!s)return;const gl=st.gl;
    for(const x of [s.a,s.b]){gl.deleteTexture(x.t);gl.deleteFramebuffer(x.fb);}st.sim=null;},
  // what the sound and the frogs do to the state during ONE fixed step
  _simInject(sim,st,f,W,H,frac0,frac1){
    const SEG=new Float32Array(16),SEGP=new Float32Array(16),DROP=new Float32Array(16);let ns=0,nd=0;
    const cell=1/sim.h,t=performance.now()/1000,only=!!this._sims[sim.id].onlyFrogs;   // pond: nothing touches the water but the frogs
    const drop=(x,y,amp,rc)=>{if(nd>=4)return;DROP.set([x,y,amp,rc*cell],nd*4);nd++;};
    for(const id in st.pts){const p=st.pts[id];if(!p.on||ns>=4)continue;
      const x0=p.px+(p.x-p.px)*frac0,y0=p.py+(p.y-p.py)*frac0,x1=p.px+(p.x-p.px)*frac1,y1=p.py+(p.y-p.py)*frac1;
      const v=Math.hypot((x1-x0)*W,(y1-y0)*H);                        // CSS px moved in this step
      // the bow wave of a moving frog. A capsule frog glides at well under a pixel per step, where the
      // linear rule gave ~1/10 of a finger's wave (the owner saw simulated frogs sing and move with the
      // water standing still) — the square-root branch lifts slow swimming, fast drags are unchanged.
      const wake=Math.min(.2,Math.max(v*.035,Math.sqrt(v)*.04))*Math.min(1,p.s*1.4);
      // a frog in the water always paddles a little (small rings even when it stands still); singing and
      // the bass make it tremble harder
      const song=(f.lv*.07+(only?f.ba*.06+.012:0))*Math.sin(t*Math.PI*2*2.2+p.seed);
      SEG.set([x0,y0,x1,y1],ns*4);SEGP.set([wake,Math.min(1,p.s*1.4),p.col||0,song],ns*4);ns++;
      if(p.plop){p.plop=0;drop(x1,y1,.5,3.5);}}                        // a new note under this frog = a small plop
    if(f.lastHit!==sim.hitSeen){sim.hitSeen=f.lastHit;                  // a hit: plop under the frogs + one drop nearby
      for(const id in st.pts){const p=st.pts[id];if(p.on)drop(p.x,p.y,1.1,5.5);}
      if(!only)drop(Math.random(),Math.random(),.55,4);}
    if(only)return {SEG,SEGP,DROP,ns,nd};
    if(Math.random()<f.hi*.22)drop(Math.random(),Math.random(),.22+f.hi*.2,2.5);   // treble = drizzle
    if(Math.random()<f.ba*.035)drop(Math.random(),.15+Math.random()*.8,.1,24);     // bass = a slow broad swell
    return {SEG,SEGP,DROP,ns,nd};
  },
  _simRun(st,f,W,H,dt){
    const sim=st.sim,gl=st.gl,pg=this._simProg(st,sim.id),it=this._sims[sim.id].it||1,u=pg.u;
    sim.acc+=dt;let n=Math.floor(sim.acc/this._SIM_STEP);
    if(n>6){n=6;sim.acc=0;}else sim.acc-=n*this._SIM_STEP;
    if(!n)return;
    gl.useProgram(pg.pr);gl.viewport(0,0,sim.w,sim.h);
    gl.uniform2f(u.TX,1/sim.w,1/sim.h);gl.uniform1i(u.S,0);gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(u.T,performance.now()/1000);gl.uniform1f(u.LV,f.lv);gl.uniform1f(u.BA,f.ba);
    gl.uniform1f(u.MI,f.mi);gl.uniform1f(u.HI,f.hi);gl.uniform1f(u.KI,f.ki);gl.uniform1fv(u.SP,f.sp);if(u.WF)gl.uniform1fv(u.WF,f.wf);
    for(let i=0;i<n;i++){
      const j=this._simInject(sim,st,f,W,H,i/n,(i+1)/n);
      for(let k=0;k<it;k++){
        gl.uniform4fv(u.SEG,j.SEG);gl.uniform4fv(u.SEGP,j.SEGP);gl.uniform1i(u.NS,k?0:j.ns);
        gl.uniform4fv(u.DROP,j.DROP);gl.uniform1i(u.ND,k?0:j.nd);
        gl.bindFramebuffer(gl.FRAMEBUFFER,sim.b.fb);gl.bindTexture(gl.TEXTURE_2D,sim.a.t);
        gl.drawArrays(gl.TRIANGLES,0,3);
        const x=sim.a;sim.a=sim.b;sim.b=x;}}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  },
  _prog(st,id){
    if(st.progs[id])return st.progs[id];
    const gl=st.gl;
    const sh=(t,src)=>{const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(id+": "+gl.getShaderInfoLog(s));return s;};
    const pr=gl.createProgram();
    gl.attachShader(pr,sh(gl.VERTEX_SHADER,this._vs));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,this._pre+this._fs[id]));
    gl.bindAttribLocation(pr,0,"a");gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(id+": "+gl.getProgramInfoLog(pr));
    const u={};for(const n of ["R","T","LV","BA","MI","HI","KI","DPR","NP","SP","WF","P","HT","HS","HC","PC","SC","SPL","BL","BD","BC","NB","BV","LP","LW","NW","LB","LT","BK"])u[n]=gl.getUniformLocation(pr,n);
    return st.progs[id]={pr,u};
  },
  _mk(wrap){
    const cv=document.createElement("canvas");cv.className="playpad-plate";cv.setAttribute("aria-hidden","true");cv.style.width=cv.style.height="100%";
    const gl=cv.getContext("webgl2",{alpha:false,antialias:false,preserveDrawingBuffer:false});
    if(!gl)return null;
    const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    wrap.insertBefore(cv,wrap.firstChild);
    return {cv,gl,wrap,progs:{},pts:{}};
  },
  _drop(inst){const s=inst._plate;if(!s)return;inst._plate=null;
    try{const x=s.gl&&s.gl.getExtension("WEBGL_lose_context");if(x)x.loseContext();}catch(e){}
    if(s.cv&&s.cv.parentNode)s.cv.parentNode.removeChild(s.cv);},
  // audio features of the pad's own bus, smoothed in time
  _feat(inst,st,dtMs){
    const f=st.f||(st.f={lv:0,ba:0,mi:0,hi:0,ki:0,slow:0,lastHit:0,sp:new Float32Array(16),wf:new Float32Array(64),keys:""});
    const b=(typeof PadAudio!=="undefined"&&PadAudio.buses)?PadAudio.buses[inst.id]:null;   // never CREATE a bus here
    let lv=0,ba=0,mi=0,hi=0;const sp=new Float32Array(16),wv=new Float32Array(64);
    if(b&&PadAudio.ctx&&PadAudio.ctx.state==="running"){
      if(!b._plateAn){try{const an=PadAudio.ctx.createAnalyser();an.fftSize=2048;an.smoothingTimeConstant=.55;
        b.master.connect(an);b._plateAn=an;b._plateFq=new Uint8Array(an.frequencyBinCount);b._plateTd=new Float32Array(an.fftSize);}catch(e){}}
      const an=b._plateAn;
      if(an){an.getByteFrequencyData(b._plateFq);an.getFloatTimeDomainData(b._plateTd);
        const fq=b._plateFq,td=b._plateTd,hz=PadAudio.ctx.sampleRate/an.fftSize;
        const avg=(lo,hi)=>{const a=Math.max(1,Math.round(lo/hz)),z=Math.min(fq.length-1,Math.round(hi/hz));let s=0;for(let i=a;i<=z;i++)s+=fq[i];return s/Math.max(1,z-a+1)/255;};
        for(let i=0;i<16;i++)sp[i]=Math.pow(avg(60*Math.pow(200,i/16),60*Math.pow(200,(i+1)/16)),1.4);
        ba=avg(40,250);mi=avg(250,2000);hi=avg(2000,10000);
        let q=0;for(let i=0;i<td.length;i++)q+=td[i]*td[i];lv=Math.min(1,Math.sqrt(q/td.length)*3.2);
        // oscilloscope: trigger on a rising zero crossing so a held note draws a STANDING wave
        let z=0;for(let i=1;i<td.length-1100;i++){if(td[i-1]<0&&td[i]>=0){z=i;break;}}
        let pk=.05;for(let i=0;i<64;i++){let s=0;for(let j=0;j<16;j++)s+=td[z+i*16+j];wv[i]=s/16;pk=Math.max(pk,Math.abs(wv[i]));}
        for(let i=0;i<64;i++)wv[i]/=pk;}
    }
    const k=tau=>1-Math.exp(-dtMs/tau);
    f.lv+=(lv-f.lv)*k(lv>f.lv?40:220);f.ba+=(ba-f.ba)*k(ba>f.ba?50:260);
    f.mi+=(mi-f.mi)*k(120);f.hi+=(hi-f.hi)*k(90);f.slow+=(lv-f.slow)*k(420);
    for(let i=0;i<16;i++)f.sp[i]+=(sp[i]-f.sp[i])*k(sp[i]>f.sp[i]?45:260);
    for(let i=0;i<64;i++)f.wf[i]+=(wv[i]-f.wf[i])*k(35);
    const keys=Object.keys(inst.act||{}).sort().join("|");
    const fresh=keys&&keys!==f.keys&&keys.length>=f.keys.length;f.keys=keys;
    const now=performance.now();
    if((lv-f.slow>.09||fresh)&&now-f.lastHit>110){f.ki=1;f.lastHit=now;f.hits=(f.hits||0)+1;}
    f.ki*=Math.exp(-dtMs/260);
    // touches that linger: strength eases in while held, fades ~1 s after release
    const pts=st.pts;
    for(const id in pts){const p=pts[id];p.was=p.on;p.on=false;p.px=p.x;p.py=p.y;}
    for(const id in (inst.act||{})){const a=inst.act[id];if(a.x==null)continue;
      // A NEW PRESS IS A NEW FROG, NOT A FLICK (owner, 2026-10-01: press and release on the left, press on
      // the right, and the background drew a fast swipe across the pad). A released touch lingers here
      // ~1 s under the same key ("ptr"), so the next press picked it up with its previous position still
      // on the left. A key that comes back after a release, or jumps over 40 % of the pad in one frame
      // (press, release and press again between two frames), starts a fresh point; the old one is kept
      // under a ghost key and fades out where it was.
      let p=pts[id];
      if(p&&(!p.was||Math.hypot(a.x-p.x,a.y-p.y)>.4)){st.ghostN=(st.ghostN||0)+1;pts[id+"~"+st.ghostN]=p;p=null;}
      if(!p)p=pts[id]={x:a.x,y:a.y,px:a.x,py:a.y,s:0,seed:(Math.random()*7)|0,t0:now};
      // the finger's frog is drawn pink, so its paint is pink too (its key colour in rf-22 is a UI yellow)
      const hex=id==="ptr"?"#ec1a83":a.color;
      if(p.hex!==hex){p.hex=hex;p.rgb=_plateRGB(hex);p.col=this._slotFor(st,p);}
      // a capsule frog keeps its key while it slides from note to note, so the "fresh key" hit above
      // never fires for it: a changed (rounded) note is a plop of its own, at most one per 90 ms
      const nt=a.note==null?null:Math.round(a.note);
      if(nt!=null&&p.nt!=null&&nt!==p.nt&&now-(p.plopT||0)>90){p.plop=1;p.plopT=now;}
      p.nt=nt;
      p.x=a.x;p.y=a.y;p.s+=(.55+f.lv*.6-p.s)*k(60);p.on=true;}
    for(const id in pts){const p=pts[id];if(!(inst.act&&inst.act[id])){p.s*=Math.exp(-dtMs/900);if(p.s<.02)delete pts[id];}}
    return f;
  },
  // PAINT SLOTS. Paint sims keep three pigment channels; each channel is a SLOT holding the real colour
  // of the frog painting with it (owner, 2026-09-30: "kolor farby jako kolor kapsla, nawet custom") —
  // it used to be a fixed pink / green / ink, and a capsule's colour went to the nearest of the three.
  // A frog whose colour changes repaints its own slot (the paint already on the wall follows); a fourth
  // colour takes a slot no frog on the pad is using, and only when all three are busy the nearest one.
  _slotFor(st,p){
    const S=st.slots||(st.slots=[null,null,null]);
    const busy=k=>Object.keys(st.pts).some(id=>{const q=st.pts[id];return q!==p&&q.col===k&&q.hex!=null;});
    let k=S.findIndex(x=>x&&x.hex===p.hex);
    if(k<0&&p.col!=null&&S[p.col]&&!busy(p.col))k=p.col;               // my own slot: recolour it in place
    if(k<0)k=S.findIndex(x=>!x);
    if(k<0)k=[0,1,2].find(i=>!busy(i));
    if(k==null||k<0){   // all three busy: borrow the nearest colour, never repaint another frog's slot
      let bd=1e9;S.forEach((x,i)=>{const d=(x.rgb[0]-p.rgb[0])**2+(x.rgb[1]-p.rgb[1])**2+(x.rgb[2]-p.rgb[2])**2;if(d<bd){bd=d;k=i;}});return k;}
    S[k]={hex:p.hex,rgb:p.rgb};return k;},
  _slotRGB(st){const D=[[.925,.102,.514],[.424,.702,.247],[.2,.24,.45]],S=st.slots||[],o=new Float32Array(9);
    for(let i=0;i<3;i++)o.set(S[i]?S[i].rgb:D[i],i*3);return o;},
  draw(inst,W,H,dpr){
    const wrap=inst._cv&&inst._cv.parentElement;
    if(inst&&typeof inst.plate==="string"&&Object.prototype.hasOwnProperty.call(PAD_PLATE_LEGACY,inst.plate))inst.plate=PAD_PLATE_LEGACY[inst.plate];
    if(!padPlateOn(inst)||!wrap){this._drop(inst);return false;}
    let st=inst._plate;
    if(st&&(st.wrap!==wrap||!st.cv.isConnected||st.gl.isContextLost())){this._drop(inst);st=null;}
    if(!st){if(inst._plateFail)return false;
      try{st=inst._plate=this._mk(wrap);}catch(e){st=null;console.warn("[pad-plate]",e);}
      if(!st){inst._plateFail=true;return false;}}   // no WebGL2 → the pad keeps its classic fill
    let pg;try{pg=this._prog(st,inst.plate);}catch(e){console.warn("[pad-plate]",e);return false;}
    const now=performance.now(),dt=st.last?Math.min(100,now-st.last):16.67;st.last=now;
    const still=typeof _prefersReducedMotion==="function"&&_prefersReducedMotion();
    const f=this._feat(inst,st,dt);
    // a plate with a body (rf-24b _bodies): its state steps here, once per frame, and is reset on a plate change
    const bod=this._bodies[inst.plate];
    if(bod){if(!st.bod||st.bod.id!==inst.plate)st.bod={id:inst.plate,s:bod.init(W/H)};
      if(!still)bod.step(st.bod.s,st,f,dt,W/H);}
    else st.bod=null;
    // a plate may render below the pad's resolution (PadPlate._res, e.g. the ray-marched lamp at .6): the canvas is
    // stretched by CSS and the shader still works in CSS pixels, because DPR is scaled with it
    const rs=this._res[inst.plate]||1;dpr*=rs;
    const pw=Math.round(W*dpr),ph=Math.round(H*dpr);
    if(st.cv.width!==pw||st.cv.height!==ph){st.cv.width=pw;st.cv.height=ph;}
    const gl=st.gl,u=pg.u;
    const sd=this._sims[inst.plate];
    if(sd){
      const sc=sd.scale||.5,sw=Math.max(8,Math.round(W*sc)),sh=Math.max(8,Math.round(H*sc));
      if(!st.sim||st.sim.w!==sw||st.sim.h!==sh||st.sim.id!==inst.plate){this._simFree(st);
        try{st.sim=this._simInit(st,sw,sh,inst.plate);}catch(e){console.warn("[pad-plate]",e);st.sim=null;}}
      if(st.sim){if(!still)this._simRun(st,f,W,H,dt);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,st.sim.a.t);}
    }else if(st.sim)this._simFree(st);
    gl.viewport(0,0,pw,ph);gl.useProgram(pg.pr);
    if(st.sim){gl.uniform1i(u.HT,0);gl.uniform2f(u.HS,1/st.sim.w,1/st.sim.h);}
    gl.uniform2f(u.R,pw,ph);gl.uniform1f(u.DPR,dpr);gl.uniform1f(u.T,still?0:now/1000);
    gl.uniform1f(u.LV,f.lv);gl.uniform1f(u.BA,f.ba);gl.uniform1f(u.MI,still?0:f.mi);gl.uniform1f(u.HI,still?0:f.hi);
    gl.uniform1f(u.KI,still?0:f.ki);gl.uniform1f(u.HC,f.hits||0);
    gl.uniform1fv(u.SP,f.sp);gl.uniform1fv(u.WF,f.wf);
    const list=Object.values(st.pts).sort((a,b)=>b.s-a.s).slice(0,4),P=new Float32Array(16);
    list.forEach((p,i)=>{P[i*4]=p.x;P[i*4+1]=p.y;P[i*4+2]=p.s;P[i*4+3]=p.seed;});
    gl.uniform4fv(u.P,P);gl.uniform1i(u.NP,list.length);
    const PC=new Float32Array(12);list.forEach((p,i)=>PC.set(p.rgb||[.925,.102,.514],i*3));gl.uniform3fv(u.PC,PC);
    gl.uniform3fv(u.SC,this._slotRGB(st));
    const spl=st.spl||(st.spl=new Float32Array(16));
    for(let i=0;i<16;i++){const v=f.sp[i];spl[i]+=(v-spl[i])*(1-Math.exp(-dt/(v>spl[i]?160:600)));}
    gl.uniform1fv(u.SPL,spl);
    if(bod&&st.bod)bod.upload(gl,u,st.bod.s);
    gl.drawArrays(gl.TRIANGLES,0,3);
    return true;
  },
  // a plate with a body may draw on the pad's 2D canvas too (rf-22 / rf-27 call this after the frogs, before the
  // corner badges): e.g. the skate bowl's trick names and score. Nothing to draw → nothing happens.
  hud(inst,x,W,H){const st=inst&&inst._plate;if(!st||!st.bod)return;const b=this._bodies[st.bod.id];
    if(b&&b.hud&&!(typeof _prefersReducedMotion==="function"&&_prefersReducedMotion())){
      try{x.save();b.hud(st.bod.s,x,W,H);}catch(e){console.warn("[pad-plate]",e);}finally{x.restore();}}}
};
// EFFECT PADS: the plate listens to the pad it steers (p.target's bus); the lily-pad puck is the only
// thing that touches the water, and only while it is being dragged. A small shadow object carries what
// draw() needs, so the fx pad's own state stays untouched.
PadPlate.drawFx=function(p,W,H,dpr){
  const s=p._plateInst||(p._plateInst={act:{}});
  s.id=p.target;s.plate=p.plate;s._cv=p._cv;
  s.act=p._active?{puck:{x:p.cur.x,y:p.cur.y,color:"#ec1a83"}}:{};
  return this.draw(s,W,H,dpr);};
window.PadPlate=PadPlate;

// ===== PadPlate — second batch, trimmed to the owner's picks (prototype, 2026-09-30) =====
// Sims keep state on the GPU (PadPlate._sims). Paint sims store ONE CHANNEL PER FROG COLOUR
// (g pink = pointer, b green = melody, a ink = everything else), so every frog marks in its own
// colour and colours mix like paint instead of averaging into mud. Dark presets set the 4th field = 1.
(function(){
// plates with a JS body (state that lives between frames, e.g. the lava lamp's balls): init/step/upload
PadPlate._bodies={};
PadPlate._res={};   // plates drawn below the pad's resolution (see draw()); none right now (owner, 10-02: the lamp at .5 lost too much)
const add=(id,name,desc,dark,fs,sim)=>{PAD_PLATES.push([id,name,desc,dark?1:0]);PadPlate._fs[id]=fs;if(sim)PadPlate._sims[id]=sim;};
// frog colour index (SEGP.z: 0 pink, 1 green, 2 ink) → one-hot pigment vector
const CVEC=`vec3 cvec(float z){return z<.5?vec3(1.,0.,0.):(z<1.5?vec3(0.,1.,0.):vec3(0.,0.,1.));}
`;

// ---------- STAW: CIEKŁY METAL — the same wave sim, rendered as a mirror (mercury / chrome) ----------
// No bottom to see through: the surface only reflects a small procedural studio (dark floor, bright
// ceiling, one softbox strip, a pink and a green panel). Waves bend the reflection hard — that's the look.
add("staw-metal","Staw: ciekły metal","Tafla ciekłego srebra w ciemności. Światło stoi tylko z boków, więc spokojna tafla jest czarna, a odblask wyłania się dopiero na zboczach fal od żaby: z lewej zielony, z prawej różowy. Metal jest cięższy od wody, więc fala szybko gaśnie. Każda żaba świeci swoim kolorem na falach wokół siebie.",1,
`// RIM LIGHT ONLY. Straight up (a flat surface) the mirror sees black; the lights sit low around the pool,
// so only a slope tilted by a wave catches them — the silver shows up on the flanks of the waves.
vec3 envM(vec2 d){float rr=length(d),a=atan(d.y,d.x);
  float rim=smoothstep(.28,.75,rr);
  float lamps=(.55+.45*pow(abs(cos(a)),3.))*(1.+.5*specS(fract(a/6.2832+.5)))+KI*.2;   // strongest from the sides; the ring of lamps plays the spectrum gently, a hit lifts them a little (owner, 10-02: it was far too bright)
  vec3 lc=mix(GREEN*1.35,PINK*1.35,smoothstep(-.35,.35,d.x));
  lc=mix(vec3(.9,.92,.95),lc,pow(abs(cos(a)),1.5));
  return lc*rim*lamps+vec3(.02,.02,.025);}
vec3 plate(vec2 px,vec2 uv,vec2 r){
  vec2 t=HS;
  float he=texture(HT,uv+vec2(t.x,0.)).r,hw=texture(HT,uv-vec2(t.x,0.)).r;
  float hn=texture(HT,uv+vec2(0.,t.y)).r,hs=texture(HT,uv-vec2(0.,t.y)).r;
  vec3 n=normalize(vec3(-vec2(he-hw,hn-hs)*2.,1.));
  vec3 R=reflect(vec3(0.,0.,-1.),n);
  vec3 col=envM(R.xy*2.2);
  float edge=pow(1.-n.z,1.5);                                                        // grazing slopes: a thin extra rim glint
  col+=vec3(1.)*smoothstep(.02,.12,edge)*smoothstep(.35,.15,edge)*.25;
  for(int i=0;i<4;i++){if(i>=NP)break;float l=length(px-P[i].xy*r);        // each frog glows in its colour on the waves round it
    col+=PC[i]*P[i].z*exp(-l*l/3000.)*smoothstep(.01,.15,edge)*1.3;}
  return col*(.97+.03*vn(px*.9));}`,Object.assign({},PadPlate._sims.staw,{fs:PadPlate._sims.staw.fs.replace("*.9925","*.982")}));   // heavier than water: waves die fast

// ---------- SPREJ Z ZACIEKAMI (sim) — r wet (mobile paint), g/b/a pigment per frog colour ----------
add("zacieki","Sprej z zaciekami","Każda żaba maluje sprejem po betonie swoim kolorem, a głośność to ciśnienie w puszce. Gdzie farby jest dużo, spływają zacieki, od cienkich strużek po grube, z kroplą na końcu. Po odjeździe żaby farba jeszcze chwilę sama cieknie, każdy zaciek inaczej długo, a potem zastyga. Stara farba powoli blednie.",0,
`vec3 plate(vec2 px,vec2 uv,vec2 r){
  vec3 wall=vec3(.74,.72,.68)*(.9+.15*fbm(px*.02))*(.96+.06*vn(px*.9))*(1.-.06*step(.93,h1(floor(px*.7))));
  wall*=1.-.12*lineAA(abs(mod(px.y,120.)-60.),.6);
  vec4 c=texture(HT,uv),cl=texture(HT,uv-vec2(HS.x,0.)),cr=texture(HT,uv+vec2(HS.x,0.));
  float tot=c.g+c.b+c.a,tl=cl.g+cl.b+cl.a,tr=cr.g+cr.b+cr.a;
  if(tl*.92>tot){c.gba=cl.gba;tot=tl*.92;}if(tr*.92>tot){c.gba=cr.gba;tot=tr*.92;}   // a drained run column must not show as a pale stripe in the patch
  vec3 pc=(c.g*SC[0]+c.b*SC[1]+c.a*SC[2])/max(c.g+c.b+c.a,.001);          // the capsules' own colours
  float spk=step(.8,hI(ivec2(floor(px/1.6))))*smoothstep(.01,.2,tot)*(1.-smoothstep(.35,.9,tot));   // overspray speckle
  vec3 col=mix(wall,pc*(.92+.08*vn(px*.5))*(1.-.15*smoothstep(.9,1.8,c.r)),max((1.-exp(-tot*3.))*.96,spk*.7));
  // RUNS (owner, 2026-10-01: the drips looked odd). A drip is drawn as the real thing: a thin, round-sectioned
  // run of the colour it came from, almost straight (a hair of wander), a wet highlight down one side, and a
  // bead where it stopped. It is drawn only BELOW the stroke — inside a painted patch the neighbours are wet too.
  float cw=r.x*HS.x,bin=floor(px.x/cw/5.);
  for(int k=-1;k<=1;k++){float b=bin+float(k);
    if(h1(vec2(b,4.))<.45)continue;                                        // (same rule as the sim: only some bins run)
    float xc=(b*5.+floor(h1(vec2(b,1.))*5.)+.5)*cw;                        // the run's channel (same rule as the sim)
    vec2 su=vec2(xc/r.x,uv.y);vec4 d=texture(HT,su);float a=d.g+d.b+d.a;if(a<.04)continue;
    vec4 e1=texture(HT,su+vec2(HS.x*3.,0.)),e2=texture(HT,su-vec2(HS.x*3.,0.));
    float run=clamp(1.-(e1.g+e1.b+e1.a+e2.g+e2.b+e2.a)*.5/max(a,.05),0.,1.);
    vec4 dn=texture(HT,su-vec2(0.,5./r.y));float tip=smoothstep(.15,.02,dn.g+dn.b+dn.a);
    float hw=h1(vec2(b,5.)),w=mix(.9,2.2,smoothstep(.1,1.,a))*mix(.45,2.,hw*hw)*(1.+.7*tip);   // thin trickles to fat runs (the same hash sets the sim's flow), a bead at the end
    float dx=px.x-xc-(vn(vec2(b*3.7,px.y*.012))-.5)*2.2;
    float m=(1.-smoothstep(w-.7,w+.5,abs(dx)))*run;if(m<=0.)continue;
    vec3 dc=(d.g*SC[0]+d.b*SC[1]+d.a*SC[2])/max(a,.001)*(.8+.2*(1.-dx*dx/(w*w)));
    col=mix(col,dc+vec3(1.)*lineAA(abs(dx+w*.35),.45)*smoothstep(.1,.6,d.r)*.45,m);}
  return col;}`,
{onlyFrogs:true,it:2,fs:CVEC+`vec4 st(vec2 uv,vec2 A){vec4 c=s(uv);
  // DRIPS run only down a few channels (one column in five, own threshold), so a heavy patch sheds one or
  // two long runs instead of a fringe. A run carries its EXCESS down, the pigment rides with it, it leaves
  // a trail behind and stops once drained.
  float cx=floor(uv.x/TX.x),bin=floor(cx/5.);
  float chan=step(abs(cx-(bin*5.+floor(h1(vec2(bin,1.))*5.))),.5)*step(.45,h1(vec2(bin,4.)));   // only some bins have a run at all
  float thr=mix(99.,.3+.45*h1(vec2(bin,3.)),chan);                     // wide spread: only the wettest channels run
  vec4 up=s(uv+vec2(0.,TX.y));
  // A RUN CRAWLS (owner, 2026-10-01): only a slice of the excess moves down per pass, so the front creeps down
  // on its own and keeps going after the frog has left, until its channel dries below the threshold and it sets.
  float flow=mix(.022,.05,h1(vec2(bin,5.)));                            // fat runs (same hash as their width) carry more
  float outF=max(0.,c.r-thr)*flow,inF=max(0.,up.r-thr)*flow;
  float tc=c.g+c.b+c.a,tu=up.g+up.b+up.a;
  vec3 pig=c.gba-c.gba*(outF/max(tc,.001))+up.gba*(inF/max(tu,.001));
  float wet=(c.r-outF+inF)*(1.-.0006*mix(1.,mix(.25,.9,h1(vec2(bin,6.))),chan));   // it:2; a run channel dries 1.1-4× slower, each at its own pace → each run stops at its own time
  pig*=.999875;                                                         // old paint weathers away (~30 s)
  for(int i=0;i<4;i++){if(i>=NS)break;float d=sdSeg(uv*A,SEG[i].xy*A,SEG[i].zw*A)/TX.y;
    float g=exp(-d*d/50.)+.12*exp(-d*d/300.);                          // soft core + faint halo, no scattered dots
    float grain=.75+.5*vn(uv/TX*.5+vec2(T*7.,0.));
    float ad=SEGP[i].y*(.014+LV*.082)*(1.+KI*2.5)*g*grain;              // loudness = can pressure, a hit = a harder push (+17 %: +35 % ran too fast, owner 2026-10-01)
    wet+=ad;pig+=cvec(SEGP[i].z)*ad;}
  wet=min(wet,pig.r+pig.g+pig.b);
  return vec4(min(wet,3.),min(pig,vec3(3.)));}`});

// ---------- AKWARELA (sim) — r water, g/b/a pigment per frog colour ----------
add("akwarela","Akwarela","Każda żaba maluje swoim kolorem po mokrym papierze. Barwniki rozlewają się, mieszają jak farby i schną z ciemniejszym brzegiem. Uderzenie to kropla czystej wody pod żabą, która wypycha kolor w kalafiorowy wykwit. Żaba ciągnie za sobą mokrą farbę w wiry.",0,
`vec3 plate(vec2 px,vec2 uv,vec2 r){
  vec3 col=vec3(.97,.95,.9)*(.93+.1*fbm(px*.25));
  vec4 c=texture(HT,uv);float gr=.8+.4*vn(px*.7);
  col*=mix(vec3(1.),SC[0]*.92,1.-exp(-c.g*2.6*gr));                       // each pigment = a capsule's colour
  col*=mix(vec3(1.),SC[1]*.92,1.-exp(-c.b*2.6*gr));
  col*=mix(vec3(1.),SC[2]*.92,1.-exp(-c.a*2.6*gr));
  vec4 e1=texture(HT,uv+vec2(HS.x,0.)),e2=texture(HT,uv-vec2(HS.x,0.)),e3=texture(HT,uv+vec2(0.,HS.y)),e4=texture(HT,uv-vec2(0.,HS.y));
  float tx=(e1.g+e1.b+e1.a)-(e2.g+e2.b+e2.a),ty=(e3.g+e3.b+e3.a)-(e4.g+e4.b+e4.a);
  col*=1.-clamp(length(vec2(tx,ty))*5.,0.,1.)*.25*(1.-smoothstep(.1,.4,c.r));   // dried edges go darker
  return col+vec3(.03)*smoothstep(.2,.8,c.r);}`,
{onlyFrogs:true,it:2,fs:CVEC+`vec4 st(vec2 uv0,vec2 A){
  vec2 uv=uv0-frogFlow(uv0,A,9.,.7)*clamp(s(uv0).r,0.,1.)*TX;              // wet paint is dragged along by the frog, dry paint stays
  vec4 c=s(uv);vec2 dx=vec2(TX.x,0.),dy=vec2(0.,TX.y);
  vec4 n0=s(uv-dx),n1=s(uv+dx),n2=s(uv-dy),n3=s(uv+dy);
  // pigment only travels through wet paper: the flux between two cells is gated by the drier one
  vec3 fl=min(n0.r,c.r)*(n0.gba-c.gba)+min(n1.r,c.r)*(n1.gba-c.gba)+min(n2.r,c.r)*(n2.gba-c.gba)+min(n3.r,c.r)*(n3.gba-c.gba);
  vec3 pig=(c.gba+.2*fl)*.99995;
  float w=(c.r+.1*(n0.r+n1.r+n2.r+n3.r-4.*c.r))*.9975;
  for(int i=0;i<4;i++){if(i>=NS)break;float d=sdSeg(uv*A,SEG[i].xy*A,SEG[i].zw*A)/TX.y;
    float g=exp(-d*d/90.)*SEGP[i].y;w+=g*.06;pig+=cvec(SEGP[i].z)*g*(.03+LV*.07);}
  for(int i=0;i<4;i++){if(i>=ND)break;if(DROP[i].z<.5)continue;
    float d=length((uv-DROP[i].xy)*A)/TX.y;w+=smoothstep(DROP[i].w/TX.y*3.,0.,d)*.7;}
  return vec4(clamp(w,0.,2.),clamp(pig,0.,3.));}`});

// ---------- RAFY (sims, Gray–Scott) — four presets that share ONLY the chemistry ----------
// Owner, 2026-09-30: the four corals were one reef in four palettes. Now every reef is its own regime
// (Sims / Munafo F,K map), its own grid size, its own way of meeting the frog and its own print:
//   koral-gumka    SITODRUK   solitons F .03 K .062 on a coarse grid · the frog is a BOW WAVE that shoves the dots
//                             aside (semi-Lagrangian push); new dots bud on the empty paper · two-drum risograph print
//   koral-mitoza   MITOZA     mitosis F .0367 · the colony STARVES alone and divides fast around the frog and the
//                             music; every hit and every new note sows a clump of cells · dark-field microscope
//   koral-labirynt LINORYT    maze F .029 K .057 with ANISOTROPIC diffusion · the frog COMBS the grain: grooves line
//                             up along its path and slowly curl back to the block's own grain · linocut on kraft
//   koral-metal    METAL      fingerprint F .037 K .06 as relief · the frog MELTS it flat, it re-crystallises when the
//                             frog leaves · rendered as the liquid-metal pond: black at rest, side lights on the slopes
// State: r = 1-U, g = V (as before); b, a = per-preset extra (nutrients / heat / grain direction).
const GS=`vec2 gsLap(vec2 uv,vec2 c){vec2 dx=vec2(TX.x,0.),dy=vec2(0.,TX.y);
  return -c+.2*(s(uv+dx).rg+s(uv-dx).rg+s(uv+dy).rg+s(uv-dy).rg)+.05*(s(uv+dx+dy).rg+s(uv-dx+dy).rg+s(uv+dx-dy).rg+s(uv-dx-dy).rg);}
// the frogs' field in grid cells: 1 within r1 of the path, 0 beyond r0, scaled by how firmly the frog sits
float frogFld(vec2 uv,vec2 A,float r0,float r1){float f=0.;for(int i=0;i<4;i++){if(i>=NS)break;
  float d=sdSeg(uv*A,SEG[i].xy*A,SEG[i].zw*A)/TX.y;f=max(f,SEGP[i].y*smoothstep(r0,r1,d));}return f;}
// one Gray–Scott update on (1-U, V); Du = 1, Dv = .5 (lp is the Laplacian of (1-U, V), so lap U = -lp.x)
vec2 gs(vec2 c,vec2 lp,float F,float K,float rt){float U=1.-c.x,V=c.y,uvv=U*V*V;
  U+=-lp.x+(-uvv+F*(1.-U))*rt;V+=.5*lp.y+(uvv-(F+K)*V)*rt;
  return vec2(clamp(1.-U,0.,1.),clamp(V,0.,1.));}
// a slowly wandering field in -1..1 (owner, 2026-09-30: "lekko swobodnie animowane wartości"): the
// parameters of the reef, the colony and the maze drift on their own, region by region, so the plate
// keeps living when nobody plays. sc = size of a region in 1/cells, sp = how fast the regions travel
float drift(vec2 cell,float sc,float sp,float ph){return vn(cell*sc+vec2(T*sp,-T*sp*.7)+ph)*2.-1.;}
vec4 seed(vec2 cell,float blk,float p){float sd=step(p,h1(floor(cell/blk)));return vec4(.5*sd,.25*sd,0.,0.);}
`;
// shaded relief of V (for the reef and the metal): normal from the V gradient
const RELIEF=`vec3 reliefN(vec2 uv,float k,float o){vec2 e=HS*o;
  float gx=texture(HT,uv+vec2(e.x,0.)).g-texture(HT,uv-vec2(e.x,0.)).g;
  float gy=texture(HT,uv+vec2(0.,e.y)).g-texture(HT,uv-vec2(0.,e.y)).g;
  return normalize(vec3(-gx*k,-gy*k,1.));}
`;

// 2 · SITODRUK — the bow wave
add("koral-gumka","Rafa: sitodruk","Grube kropki odbite z dwóch bębnów na kremowym papierze: fluorescencyjny róż i morska zieleń, lekko rozjechane jak w risografie. Żaba jest dziobem łodzi: rozpycha kropki na boki, a na pustym papierze powoli pączkują nowe. Bas je nadmuchuje. Szybka żaba ciągnie kropki za sobą, a w jej kilwaterze pączkują nowe.",0,
`vec3 plate(vec2 px,vec2 uv,vec2 r){
  vec3 pap=vec3(.95,.93,.88)*(.96+.04*vn(px*.7))*(.985+.015*vn(vec2(px.x*.04,px.y*1.6)));
  float a=texture(HT,uv).g,b=texture(HT,uv+vec2(7.,-5.)/r).g,bs=BA*.07;  // second drum off register by a few px
  float inkA=smoothstep(.2-bs,.24-bs,a)*(.8+.2*vn(px*1.3)),inkB=smoothstep(.3-bs,.34-bs,b)*(.76+.24*vn(px*1.1+9.));
  vec4 tc=touchC(uv,r.x/r.y);float near=smoothstep(.1,.6,tc.a);
  vec3 cA=mix(vec3(1.,.38,.64),tc.rgb,near*.8),cB=vec3(.16,.56,.62);
  vec3 col=pap*mix(vec3(1.),cB,inkB*.8);
  float halo=smoothstep(.06,.14,b)*(1.-smoothstep(.3,.34,b));            // a halftone ring round every teal dot
  col*=mix(vec3(1.),cB,ht(px,halo*.5,4.,.4)*.45);
  return col*mix(vec3(1.),cA,inkA*.9);}`,
{onlyFrogs:true,it:8,warm:2600,scale:.3,fs:GS+`vec4 st(vec2 uv,vec2 A){vec2 cell=uv/TX;
  if(FRESH>.5)return seed(cell,4.,.94)+vec4(0.,0.,0.,1.);
  // the frog pushes the dots out of its way: fetch the state from upstream of a radial push
  vec2 push=vec2(0.);
  for(int i=0;i<4;i++){if(i>=NS)break;vec2 p=uv*A,a=SEG[i].xy*A,ba=SEG[i].zw*A-a;
    float h=clamp(dot(p-a,ba)/max(dot(ba,ba),1e-8),0.,1.);vec2 d=(p-a-ba*h)/TX.y;float l=length(d);
    push+=d/max(l,1e-3)*SEGP[i].y*smoothstep(24.,3.,l)*.45;}
  vec2 fl=frogFlow(uv,A,14.,.8);vec2 q=uv-(push+fl)*TX;vec4 c=s(q);        // shoved aside AND dragged along
  vec2 g=gs(c.rg,gsLap(q,c.rg),.03,.062,1.);
  if(length(fl)>.5&&h1(floor(cell/3.)+floor(T*24.)*vec2(3.1,7.7))>.975)g=vec2(.5,.25);   // new dots bud in a fast frog's wake
  if(h1(floor(cell/3.)+floor(T*3.)*vec2(7.13,3.37))>.99955)g=vec2(.5,.25); // a new dot buds on empty paper
  return vec4(g,0.,1.);}`});

// 3 · MITOZA — the colony
add("koral-mitoza","Skrzek","Żabi skrzek w ciemnej wodzie: galaretowate kulki z jasną otoczką i bursztynowym jądrem. Sam leży spokojnie, kulki tylko lekko oddychają. Ruch żaby wyciera skrzek, a w wytartym śladzie tuż za nią pojawiają się drobne jajeczka w jej kolorze, które dzielą się i rosną, aż po kilku sekundach zarosną ślad. Uderzenie albo nowa nuta składa pod żabą grudkę skrzeku.",1,
`vec3 plate(vec2 px,vec2 uv,vec2 r){vec4 hv=texture(HT,uv);float v=hv.g;
  vec2 o=vec2(3.)/r;float blur=(texture(HT,uv+o).g+texture(HT,uv-o).g+texture(HT,uv+vec2(o.x,-o.y)).g+texture(HT,uv-vec2(o.x,-o.y)).g)*.25;
  vec3 bg=vec3(.015,.04,.025)+vec3(.02,.05,.03)*fbm(px*.008+T*.02);
  vec2 vc=(uv-.5)*vec2(r.x/r.y,1.);float vig=clamp(1.-dot(vc,vc)*1.1,.35,1.);
  float mem=smoothstep(.1,.17,v)*(1.-smoothstep(.2,.3,v));                // the cell wall: a bright ring on the edge
  float body=smoothstep(.17,.3,v),nuc=smoothstep(.33,.4,v);
  vec4 tc=touchC(uv,r.x/r.y);float near=smoothstep(.1,.6,tc.a);
  // fresh ground (b) and the new cells growing on it take the colour of the frog that wiped it (a = its paint slot)
  float fresh=smoothstep(.04,.5,hv.b);vec3 tint=SC[int(clamp(hv.a+.5,0.,2.))];
  vec3 wall=mix(mix(vec3(.62,.92,.42),tint*1.15+.05,fresh*.85),tc.rgb*1.15,near*.6);
  vec3 nk=mix(vec3(.98,.7,.22),mix(tint,vec3(1.),.35),fresh*.9);
  vec3 col=bg+tint*.05*fresh+wall*mem*(1.05+fresh*.5)+mix(vec3(.08,.2,.07),tint*.22,fresh)*body+nk*nuc*(.75+HI*.6+fresh*(.35+.15*sin(T*3.)));
  col+=wall*.25*smoothstep(.06,.25,blur)*(1.-body);                       // soft glow round the colony
  return col*vig;}`,
{onlyFrogs:true,it:10,warm:1800,scale:.45,fs:GS+`vec4 st(vec2 uv,vec2 A){vec2 cell=uv/TX;
  if(FRESH>.5)return seed(cell,4.,.9)+vec4(0.,0.,0.,1.);
  vec2 fl=frogFlow(uv,A,14.,.5);vec2 uq=uv-fl*TX;vec4 c=s(uq);              // the frog drags the water along
  // owner, 2026-10-01 (2nd round): "ruch niech kasuje, a w to miejsce niech powstaje mitoza". At rest the cells are
  // stable solitons (F .03 K .062): they sit and breathe but never divide. The frog's path WIPES the colony (a still
  // frog a small hole, a moving one a full swath ~18 cells wide) and marks the swath's core fresh (b = 1, a = its
  // paint slot; the rim stays at rest so the cut cells there do not grow into a tube). Fresh ground runs the mitosis
  // chemistry (F .0367 K .0649, the same tested pair) once the frog has passed, and is sown with nuclei on a 12-cell
  // lattice ~.1 s after it (denser seeds merged into worms), so the swath fills with dividing cells
  // in a few seconds; as b fades (~3 s; .9994 per substep is the slowest decay RGBA16F still resolves near 1) the
  // chemistry settles back to resting solitons. The state is set, the constants stay in the tested range.
  float wp=0.,sl=c.a,core=0.;
  for(int i=0;i<4;i++){if(i>=NS)break;float L=length((SEG[i].zw-SEG[i].xy)*A/TX.y);
    float d=sdSeg(uv*A,SEG[i].xy*A,SEG[i].zw*A)/TX.y,w=SEGP[i].y*smoothstep(9.,7.5,d)*clamp(.35+L*2.,0.,1.);
    if(w>.3)sl=SEGP[i].z;wp=max(wp,w);core=max(core,SEGP[i].y*step(d,5.5));}
  float mem=max(step(.3,core),c.b*.9994),mt=smoothstep(0.,.3,mem)*smoothstep(.985,.9,mem);
  float F=mix(.03+.0012*drift(cell,.02,.01,5.),.0367,mt),K=mix(.062,.0649,mt);
  vec2 g=gs(c.rg,gsLap(uq,c.rg),F,K,1.)*(1.-smoothstep(.15,.35,wp));      // wiped clean
  if(mem>.88&&mem<.96&&length(fract(cell/12.)-.5)<.33&&h1(floor(cell/12.)+c.a)>.3)g=max(g,vec2(.5,.25));   // sow a nucleus
  for(int i=0;i<4;i++){if(i>=ND)break;if(DROP[i].z<.3)continue;          // a hit / a new note sows a clump
    float d=length((uv-DROP[i].xy)*A)/TX.y;
    if(d<DROP[i].w/TX.y*1.6&&h1(floor(cell/2.)+floor(T*9.))>.55)g=max(g,vec2(.5,.25));}
  return vec4(g,mem,sl);}`});

// 4 · RISO — combing the grain
add("koral-labirynt","Rafa: riso","Labirynt odbity na risografie na kremowym papierze: niebieskie linie leżą na różowym rastrze cienia, a oba bębny są lekko rozjechane i przekrzywione. Półprzezroczysta farba jest ziarnista i miejscami niedobita, a tam, gdzie kolory się nakładają, wychodzi fiolet. Żaba czesze labirynt: linie układają się wzdłuż jej drogi i zostają jak ślad grzebienia, a potem powoli wracają do własnych wirów. Bas pogrubia linie. Żaba ciągnie labirynt za sobą i wycina w nim świeży rowek, w który linie potem wrastają.",0,
`// RISO (owner, 2026-10-01: "niech wygląda bardziej jak riso"): two drums of translucent soy ink multiplied on cream
// paper. Blue drum = the maze, slightly smeared; pink drum = a halftone shadow of the maze, off register by ~2 px and
// turned a hair. Grainy ink and uneven coverage from slow paper-fixed noise (light, under-inked patches); where the
// drums overlap the inks mix to violet. Unlike staw-riso (raster from the light) and koral-gumka (fat dots).
vec3 plate(vec2 px,vec2 uv,vec2 r){
  vec3 pap=vec3(.955,.935,.885)*(.965+.035*vn(px*.7))*(.985+.015*vn(vec2(px.x*.05,px.y*1.4)));
  float v=(texture(HT,uv).g*2.+texture(HT,uv+vec2(1.,.5)/r).g+texture(HT,uv-vec2(.5,1.)/r).g)*.25;   // the ink spreads a little
  float cov=.68+.32*smoothstep(.25,.75,fbm(px*.012+3.7));               // uneven coverage: under-inked patches
  vec4 tcq=touchC(uv,r.x/r.y);float nearq=smoothstep(.02,.5,tcq.a);   // owner, 10-02: the pulse lives round the frog, not over the whole sheet
  float ro=-(BA*.035+KI*.03)*(.15+.85*nearq);
  float inkB=smoothstep(.19+ro,.26+ro,v)*cov*(.8+.2*vn(px*1.3+3.))*(.93+.07*h1(floor(px)));
  vec2 pr=rot(.012)*(px-r*.5)+r*.5+vec2(2.,-1.5);                       // the pink drum: off register, turned a hair
  vec2 ur=pr/r+vec2(3.,-3.)/r;vec2 e=2.5/r;                             // its shadow sits down-right, fattened
  float vs=(texture(HT,ur).g+texture(HT,ur+vec2(e.x,0.)).g+texture(HT,ur-vec2(e.x,0.)).g+texture(HT,ur+vec2(0.,e.y)).g+texture(HT,ur-vec2(0.,e.y)).g)*.2;
  float sh=smoothstep(.13,.22,vs)*(.72+.28*vn(pr*1.1+9.))*(.7+.3*cov);
  float inkP=max(ht(pr,sh*.38,4.5,.26)*.8,sh*.1);                        // halftone + a light smear of the same ink
  vec4 tc=touchC(uv,r.x/r.y);float near=smoothstep(.1,.6,tc.a);
  vec3 cB=mix(vec3(.13,.33,.72),tc.rgb*.8,near*.8),cP=vec3(1.,.36,.64);
  vec3 col=pap*mix(vec3(1.),cP,inkP);
  return col*mix(vec3(1.),cB,inkB*.94);}`,
{onlyFrogs:true,it:8,warm:2200,scale:.5,fs:GS+`vec4 st(vec2 uv,vec2 A){vec2 cell=uv/TX;vec4 c=s(uv-frogFlow(uv,A,12.,.6)*TX);
  // b,a = the grain as a DOUBLED angle (cos 2θ, sin 2θ): a groove has no arrow, so θ and θ+π must agree
  float t0=vn(cell*.022+1.3+vec2(T*.006,-T*.004))*6.283+T*.015;vec2 base=vec2(cos(2.*t0),sin(2.*t0));   // the grain turns slowly
  if(FRESH>.5)return seed(cell,5.,.9)+vec4(0.,0.,base);
  vec2 dx=vec2(TX.x,0.),dy=vec2(0.,TX.y);
  vec2 g=mix(c.ba,(s(uv+dx).ba+s(uv-dx).ba+s(uv+dy).ba+s(uv-dy).ba)*.25,.5);
  g=mix(g,base,.00025);                                                   // slowly back to the block's own grain
  for(int i=0;i<4;i++){if(i>=NS)break;vec2 sd=(SEG[i].zw-SEG[i].xy)*A;float L=length(sd)/TX.y;if(L<.02)continue;
    float d=sdSeg(uv*A,SEG[i].xy*A,SEG[i].zw*A)/TX.y;vec2 t=sd/length(sd);
    g=mix(g,vec2(t.x*t.x-t.y*t.y,2.*t.x*t.y),SEGP[i].y*smoothstep(20.,5.,d)*min(1.,L*3.)*.3);}
  float gl=length(g);vec2 G=gl>1e-4?g/gl:base;float th=.5*atan(G.y,G.x);vec2 dir=vec2(cos(th),sin(th))*TX;
  // extra diffusion ALONG the grain. The sum must stay inside the explicit step's stability limit (the
  // checkerboard mode of the 9-point stencil is already -1.6), so the isotropic part gives some room
  vec2 lp=gsLap(uv,c.rg)*.8+(s(uv+dir).rg+s(uv-dir).rg-2.*c.rg)*.15;
  vec2 r=gs(c.rg,lp,.029+BA*.002+.0025*drift(cell,.014,.01,3.),.057,1.);  // lines swell and thin by region
  r*=1.-frogFld(uv,A,3.,1.)*.5;                                            // the gouge: a clean groove where the frog cuts
  return vec4(r,g);}`});

// 5 · METAL — round 2 (owner, 2026-10-02: "very unsatisfying, improve it decisively, or it goes"). Was: black at rest,
// faint side lights on the slopes, so it read as a dark smudge. Now: POLISHED CHROME in a lit studio. The fingerprint
// ridges are raised, rounded tubes of chrome (height from V, the cast's valleys duller), the camera sees a small room
// in them (a softbox overhead, a cold strip light, the brand's pink and lime panels at the sides, and a row of light
// bars along the top that play the spectrum), and the view has a little perspective, so even the flat metal is a
// mirror with a gradient instead of one colour. The frog MELTS the reef into a mirror puddle: domed a little, rippling
// round the frog, white-hot under it and cooling through orange to the frog's own colour; when it leaves, the
// fingerprint crystallises back out of the mirror. A hit rings the metal.
add("koral-metal","Rafa: metaliczny staw","Rafa odlana z wypolerowanego chromu w oświetlonym studiu: cienkie, miękko zaokrąglone linie papilarne odbijają softbox, zimną listwę świetlną, różowy i limonkowy panel oraz rząd lamp u góry, które grają w rytm widma. Żaba wytapia pod sobą lustrzane wgłębienie, które drobno faluje, żarzy się do białości pod żabą i stygnie przez pomarańcz do jej koloru. Gdy żaba odpłynie, metal krystalizuje się z powrotem w linie papilarne. Głośność rozjaśnia softbox, a uderzenie dzwoni metalem. Bas wprawia cały odlew w drżenie, głośne granie wije liniami, a uderzenie puszcza od każdej żaby pierścień po metalu.",1,
RELIEF+`// round 3 (owner, 10-02: "the frog makes a hollow, not a bump; thinner, softer, as if through a gaussian filter; less
// impact"): the height is read through a 3×3 gaussian (1-2-1), the ridges are a narrower band of V on a finer grid
// (scale .5, was .33), the slopes are gentler, and molten metal sinks into a shallow mirror HOLLOW under the frog.
// how near the nearest frog is (0 far … 1 under it), with a long, soft reach
float mNear(vec2 uv){float n=0.;float asp=R.x/R.y;for(int i=0;i<4;i++){if(i>=NP)break;vec2 d=(uv-P[i].xy)*vec2(asp,1.);n=max(n,exp(-dot(d,d)*4.)*P[i].z);}return n;}
// in a quiet lamp the relief crawls very slowly (a wandering offset of the sample, fading out under the frog so the
// molten pool stays where the frog is)
vec2 mDrift(vec2 uv){return (vec2(vn(uv*2.+vec2(T*.05,0.)),vn(uv*2.+vec2(9.,T*.04)))-.5)*.012*(1.-mNear(uv));}
float mH(vec2 uv){uv+=mDrift(uv);vec2 e=HS*1.9;vec4 c=texture(HT,uv);
  float v=c.g*.25+(texture(HT,uv+vec2(e.x,0.)).g+texture(HT,uv-vec2(e.x,0.)).g+texture(HT,uv+vec2(0.,e.y)).g+texture(HT,uv-vec2(0.,e.y)).g)*.125
    +(texture(HT,uv+e).g+texture(HT,uv-e).g+texture(HT,uv+vec2(e.x,-e.y)).g+texture(HT,uv-vec2(e.x,-e.y)).g)*.0625;
  float far=1.-mNear(uv);                                                   // ridges thin out gradually away from the frog (owner, 10-02)
  return smoothstep(.08+.1*far-.015*BA,.34+.04*far-.02*BA,v)*(1.-.85*c.b)-.28*c.b*c.b;}   // molten = a hollow
// the studio seen in the chrome: d = reflected direction (z towards the camera)
vec3 envS(vec3 d){vec2 h=d.xy/max(d.z,.2);
  vec3 c=mix(vec3(.05,.05,.065),vec3(.3,.31,.35),smoothstep(-.9,.8,h.y));                   // a dim room, a lighter ceiling
  vec2 sb=h-vec2(-.2,.24);c+=vec3(1.,.97,.92)*smoothstep(.14,0.,max(abs(sb.x)-.24,abs(sb.y)-.1))*(.6+.3*LV);   // the softbox, soft-edged
  vec2 l2=h-vec2(.38,-.22);c+=vec3(.6,.66,.78)*exp(-dot(l2,l2)/.035)*.55;                   // a second, fainter lamp low right
  c+=vec3(.75,.85,1.)*smoothstep(.02,0.,abs(h.y+.42+.05*h.x))*smoothstep(.75,.45,abs(h.x))*.9;               // a cold strip light
  c+=PINK*1.7*smoothstep(.5,.85,h.x)*smoothstep(.6,.25,abs(h.y));                            // the brand's panels
  c+=LIME*1.5*smoothstep(-.5,-.85,h.x)*smoothstep(.6,.25,abs(h.y));
  float bx=clamp(h.x*.42+.5,0.,1.);                                                          // the music: 16 light bars along the top
  c+=mix(AMBER,PINK,bx)*step(.18,fract(bx*16.))*smoothstep(.55,.62,h.y)*smoothstep(1.05,.9,h.y)*(.2+1.2*specS(bx));
  return c;}
vec3 plate(vec2 px,vec2 uv,vec2 r){float asp=r.x/r.y;vec2 e=HS*1.5;
  vec4 c=texture(HT,uv+mDrift(uv));float heat=c.b,h0=mH(uv);
  float hx=mH(uv+vec2(e.x,0.))-mH(uv-vec2(e.x,0.)),hy=mH(uv+vec2(0.,e.y))-mH(uv-vec2(0.,e.y));
  vec3 n=vec3(-hx,-hy,1.);
  for(int i=0;i<4;i++){if(i>=NP)break;vec2 d=(uv-P[i].xy)*vec2(asp,1.);float l=length(d);   // ripples in the molten pool
    n.xy+=d/max(l,1e-3)*sin(l*110.-T*8.)*exp(-l*9.)*heat*P[i].z*.12;
    n.xy+=d/max(l,1e-3)*sin(l*50.-T*22.)*exp(-l*4.)*KI*P[i].z*.14;}                       // a hit: a ring runs out from the frog
  n.xy+=vec2(sin(uv.y*70.+T*7.),cos(uv.x*60.-T*6.))*.03*BA;                              // the bass shivers the whole cast
  n=normalize(n);
  vec3 V=normalize(vec3((uv-.5)*vec2(asp,1.)*.55,-1.)),R=reflect(V,n);
  float cav=smoothstep(.02,.45,h0),fres=.78+.22*pow(1.-max(dot(n,-V),0.),3.);
  vec3 col=envS(R)*vec3(.96,.94,.9)*fres*mix(.55,1.,max(cav,heat));                         // the cast's valleys duller, molten a clean mirror
  col*=1.-.35*smoothstep(.12,.0,h0)*(1.-heat)*smoothstep(.2,.6,length(vec2(hx,hy))*8.);       // dark seams at the foot of the ridges
  vec4 tc=touchC(uv,asp);
  vec3 hot=mix(tc.a>.02?tc.rgb*1.2:vec3(1.,.45,.15),vec3(1.,.82,.6),smoothstep(.55,1.,heat));  // white-hot → orange → the frog's colour
  col+=hot*(heat*heat*.6+smoothstep(.3,.9,heat)*.25*KI);
  col+=vec3(.9,.95,1.)*KI*.1*cav;                                                           // a hit rings the metal
  return col*(.95+.05*vn(px*.7));}`,
{onlyFrogs:true,it:10,warm:2000,scale:.7,fs:GS+`vec4 st(vec2 uv,vec2 A){vec2 cell=uv/TX;vec4 c=s(uv-frogFlow(uv,A,20.,.9)*TX);   // molten metal swirls round the frog (grid .7: finer lines, owner 10-02)
  if(FRESH>.5)return seed(cell,5.,.88)+vec4(0.,0.,0.,1.);
  float heat=max(c.b*.9985,frogFld(uv,A,22.,5.));                         // stays molten ~.6 s after the frog (owner, 10-02: shorter); 22 cells on the .7 grid = the old reach
  vec2 lp=gsLap(uv,c.rg);
  vec2 g=gs(c.rg,lp,.037+.01*LV,.06,1.-heat*.95);                        // molten: no crystal growth… (loud playing shifts the feed: the lines wriggle)
  g+=lp*heat*.6;                                                          // …and the relief flows flat
  return vec4(clamp(g,0.,1.),heat,1.);}`});

// ---------- PŁONĄCY PAPIER (sim) — r burnt, g heat ----------
add("pozar","Płonący papier","Żaba jest zapałką: gdzie przejdzie, papier się zwęgla, a brzeg żarzy. Głośne granie podsyca ogień. Po kilku sekundach spalone miejsca odrastają: najpierw zwęglony brzeg, potem przypalenie, na końcu czysty papier. Nad żarem unosi się dym: żaba ciągnie go za sobą, a po skręcie smuga wygina się i zostaje w tyle.",0,
`vec3 plate(vec2 px,vec2 uv,vec2 r){vec4 c=texture(HT,uv);float h=c.g;
  // owner, 2026-10-01 (round 2): "krawędzie przy paleniu lekko postrzępione". The burn (r) is read from a spot jittered
  // by fine noise (±1.5 px) plus rare small teeth (up to ~4 px), so the scorch, char, hole and the glowing rim all
  // follow one ragged edge; smoke (b) and heat (g) are read unjittered, the sim is untouched
  vec2 jo=(vec2(vn(px*.45),vn(px*.45+17.3))-.5)*3.+(vec2(vn(px*.21+31.),vn(px*.21+53.))-.5)*pow(vn(px*.12+71.),5.)*16.;
  float b=texture(HT,uv+jo/r).r;
  vec3 pap=vec3(.95,.91,.82)*(.94+.08*fbm(px*.08));
  pap=mix(pap,vec3(.6,.7,.85),lineAA(abs(mod(px.y,22.)-11.),.5)*.35);
  vec3 col=mix(pap,pap*vec3(.5,.34,.2),smoothstep(.05,.4,b));
  float hole=smoothstep(.75,.85,b);
  col=mix(col,vec3(.12,.08,.06),smoothstep(.3,.7,b)*(1.-hole));
  col=mix(col,vec3(.06,.05,.05),hole);
  float emb=h*smoothstep(.25,.7,b)*(1.-smoothstep(.85,.97,b))*(.7+.6*vn(px*.3+T*3.));
  // smoke = the sim's own advected field (b), so the plume bends and trails behind after the frog turns
  float sm=(c.b*2.+texture(HT,uv+vec2(HS.x*2.,0.)).b+texture(HT,uv-vec2(HS.x*2.,0.)).b)*.25;
  col=mix(col,vec3(.36,.34,.34),clamp(sm*1.1,0.,.72)*(.6+.4*fbm(px*.03-vec2(0.,T*.4))));
  return col+mix(vec3(1.,.3,.04),vec3(1.,.85,.45),clamp(h*1.5,0.,1.))*emb*2.2;}`,
{onlyFrogs:true,it:1,fs:`vec4 st(vec2 uv,vec2 A){vec4 c=s(uv);vec2 dx=vec2(TX.x,0.),dy=vec2(0.,TX.y);
  vec4 a0=s(uv+dx),a1=s(uv-dx),a2=s(uv+dy),a3=s(uv-dy);
  float nbB=max(max(a0.r,a1.r),max(a2.r,a3.r)),nbH=(a0.g+a1.g+a2.g+a3.g)*.25;
  float fuel=.5+.8*fbm(uv/TX*.05);
  // heat only comes from the frogs and fades fast — the fire follows the match, it does not keep itself alive
  float heat=mix(c.g,nbH,.5)*.975;
  for(int i=0;i<4;i++){if(i>=NS)break;float d=sdSeg(uv*A,SEG[i].xy*A,SEG[i].zw*A)/TX.y;heat+=SEGP[i].y*.12*(.4+LV)*exp(-d*d/60.);}
  for(int i=0;i<4;i++){if(i>=ND)break;if(DROP[i].z<.5)continue;float d=length((uv-DROP[i].xy)*A)/TX.y;heat+=smoothstep(DROP[i].w/TX.y*1.2,0.,d)*.3;}
  float burn=min(1.,c.r+step(.5,nbB)*heat*.06*fuel+step(.3,heat)*.02);
  if(heat<.08)burn=max(0.,burn-.0012);                                  // cold → the paper grows back (~7 s)
  // SMOKE in b (owner, 2026-10-01: "dym sztywno śledzi żabę"): born over the glowing edge and the flame, it rises,
  // curls in a slow curl-noise, is dragged by the frog's current and thins out (~3 s). Fetched semi-Lagrangian
  // from upstream, so a turn of the frog bends the plume and leaves it behind instead of swinging it round.
  vec2 cl=uv/TX,nq=cl*.035+vec2(T*.04,-T*.18);
  vec2 curl=vec2(vn(nq+vec2(0.,.5))-vn(nq-vec2(0.,.5)),vn(nq-vec2(.5,0.))-vn(nq+vec2(.5,0.)))*.16;
  vec2 vel=vec2(0.,.11)+curl+frogFlow(uv,A,12.,.8);                     // cells per step: buoyancy + curl + the frog's wake
  float smk=s(uv-vel*TX).b*.997;
  smk+=heat*(smoothstep(.2,.6,burn)*(1.-smoothstep(.85,.97,burn))*.03+.005);
  return vec4(burn,min(heat,1.),min(smk,1.5),1.);}`});

// ---------- NEON ----------
add("neon","Neon","Dwie rurki neonu za wypukłą szybą oscyloskopu: różowa rysuje przebieg dźwięku, zielona widmo. Ekran w matowej, ciemnej obudowie ma zaokrąglone rogi, lekko wygina obraz ku brzegom i ciemnieje w rogach. Pod rurkami tli się zielonkawy luminofor, po ekranie biegną ledwo widoczne linie, a na szkle stoi stały odblask. Przy uderzeniu neon się zacina. Każda żaba nosi neonowy pierścień w swoim kolorze.",1,
`// NEON BEHIND A SCOPE'S GLASS (owner, 2026-10-01: "kropki na łączeniach — wywal je" + a CRT screen). The dots were
// the grey mounting clips every 110 px on both tubes (and the tubes measured VERTICAL distance, so their thickness
// and glow changed at every kink). Now every tube is ONE distance, the min over its polyline's segments, and its glow
// is computed once from it. The picture sits behind a bulged glass in a rounded-rect window of a matt housing.
float nSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-8),0.,1.);return length(pa-ba*h);}
float nWave(vec2 p,vec2 r,float amp){float d=1e5;vec2 a=vec2(0.,(.62+WF[0]*amp)*r.y);
  for(int i=1;i<64;i++){vec2 b=vec2(float(i)/63.*r.x,(.62+WF[i]*amp)*r.y);d=min(d,nSeg(p,a,b));a=b;}return d;}
float nSpec(vec2 p,vec2 r){float d=1e5;vec2 a=vec2(0.,(.12+SP[0]*.35)*r.y);
  for(int i=1;i<16;i++){vec2 b=vec2(float(i)/15.*r.x,(.12+SP[i]*.35)*r.y);d=min(d,nSeg(p,a,b));a=b;}return d;}
vec3 plate(vec2 px,vec2 uv,vec2 r){
  float F=14.,RR=18.;vec2 sr=r-2.*F,s=(px-F)/sr,q=s-.5;float asp=sr.x/sr.y;vec2 qa=q*vec2(asp,1.);
  vec2 bx=abs(px-r*.5)-(sr*.5-RR);float sd=length(max(bx,0.))+min(max(bx.x,bx.y),0.)-RR;   // <0 = on the glass
  vec2 sw=s+q*.24*dot(qa,qa);                                           // bulged glass: the picture curves to the middle
  vec2 cp=sw*r;                                                          // the picture's own px, behind the glass
  // the phosphor: a dark, slightly green glow under the tubes + a faint graticule
  vec3 col=vec3(.012,.032,.024)+vec3(.018,.05,.034)*fbm(cp*.02);
  vec2 gq=(.5-abs(fract(sw*vec2(8.,10.))-.5))/vec2(8.,10.)*r;
  col+=vec3(.05,.14,.09)*lineAA(min(gq.x,gq.y),.45)*.35;
  float amp=.05+LV*.25,d1=nWave(cp,r,amp),d2=nSpec(cp,r),sp=spec(sw.x);
  float fl=1.-.6*step(.5,vn(vec2(T*14.,1.)))*step(.5,KI);
  vec3 c1=PINK*1.3*fl*(.5+LV*.8),c2=vec3(.4,1.,.3)*(.4+sp*.8);
  // owner, 10-02: the glass softens the tubes a little, and towards the edges of the bulged glass the colours split
  // (chromatic aberration): red reads the tube a hair wider, blue a hair tighter
  float ca=r.y*.006*pow(length(qa),2.);vec3 d1c=vec3(d1-ca,d1,d1+ca),d2c=vec3(d2-ca,d2,d2+ca);
  col+=c1*(exp(-d1c/9.)*.8+exp(-d1c/28.)*.35+exp(-d1c/90.)*.12);         // glow ONCE per tube, from one distance
  col+=c2*(exp(-d2c/9.)*.7+exp(-d2c/28.)*.3+exp(-d2c/90.)*.1);
  vec3 core1=vec3(1.-smoothstep(1.3,3.2,d1c.r),1.-smoothstep(1.3,3.2,d1c.g),1.-smoothstep(1.3,3.2,d1c.b));
  vec3 core2=vec3(1.-smoothstep(1.2,3.,d2c.r),1.-smoothstep(1.2,3.,d2c.g),1.-smoothstep(1.2,3.,d2c.b));
  col=mix(col,vec3(1.,.9,.95),core1*(.6+LV*.4)*fl);
  col=mix(col,vec3(.9,1.,.9),core2*.8);
  for(int i=0;i<4;i++){if(i>=NP)break;float dd=abs(length(cp-P[i].xy*r)-(24.+BA*10.));   // each frog wears a neon ring in its colour
    vec3 fc=PC[i]*1.3*P[i].z;col+=fc*(exp(-dd/6.)*.7+exp(-dd/24.)*.3);col=mix(col,mix(fc,vec3(1.),.6),lineAA(dd,1.2)*P[i].z);}
  col*=1.-.07*(.5+.5*cos(cp.y*2.0944));                                  // scanlines: faint, fixed, no flicker
  col*=mix(.42,1.,smoothstep(0.,.5,clamp(-sd/(min(sr.x,sr.y)*.5),0.,1.)))*(1.-.35*smoothstep(.2,.65,length(qa)));   // vignette, darker in the corners
  // the glass: a soft spot and an arc of light in the top-left corner + a faint diagonal band, fixed in place
  vec2 hq=(s-vec2(.2,.86))*vec2(asp,1.4);col+=vec3(.85,.92,1.)*.09*exp(-dot(hq,hq)*30.);
  float arc=abs(length(qa)-.5)*sr.y,aw=smoothstep(.0,.25,-q.x)*smoothstep(.0,.3,q.y);
  col+=vec3(.9,.95,1.)*.07*(1.-smoothstep(1.,6.,arc))*aw;
  col+=vec3(.8,.9,1.)*.03*(1.-smoothstep(.02,.07,abs(s.x+s.y-1.3)));
  // the housing: matt dark plastic, shadowed where it dips into the screen recess, a lit top lip
  vec3 hous=vec3(.085,.084,.09)*(.9+.14*fbm(px*.35))*(.97+.03*vn(px*1.7));
  hous*=1.-.55*(1.-smoothstep(0.,7.,sd));
  hous+=vec3(.05)*(1.-smoothstep(0.,2.,abs(sd-1.5)))*smoothstep(.2,.45,s.y);
  return mix(hous,col,1.-smoothstep(-.8,.8,sd));}`);

// ---------- POZIOMICE — green valleys → pink peaks with black lines (0), or felt patches in hard colours (2) ----------
const POZ=mode=>`float vq(vec2 p){vec2 fi=floor(p);ivec2 i=ivec2(fi);vec2 f=p-fi;f=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(hI(i),hI(i+ivec2(1,0)),f.x),mix(hI(i+ivec2(0,1)),hI(i+ivec2(1,1)),f.x),f.y);}
// smooth terrain on purpose (fractal fbm contours read as torn), audio moves it slowly
// a hit is a quake: a ring runs out from every frog and the contours jump with it
float quake(vec2 uv,float asp){float s=0.;for(int i=0;i<4;i++){if(i>=NP)break;vec2 d=(uv-P[i].xy)*vec2(asp,1.);float l=length(d);
  s+=KI*.018*sin(l*28.-T*9.)*exp(-l*3.)*P[i].z;}return s;}   // owner, 10-02: a gentle ripple, no more
${mode===2?`// FELT: finer (zoomed out ×2) and domain-warped → winding islands, bays and tongues, still smooth-edged
float hgt(vec2 px,vec2 r){vec2 uv=px/r;float asp=r.x/r.y;vec2 q=vec2(uv.x*asp,uv.y)*2.2+vec2(T*.006,0.);
  q+=(vec2(vq(q*.5+3.1+vec2(T*.018,T*.01)),vq(q*.5+8.7-vec2(T*.012,T*.015)))-.5)*1.3;    // the warp itself drifts → shapes morph
  return vq(q)*.68+vq(q*1.9+17.1+vec2(0.,T*.01))*.17+.014*sin(T*.3)+LV*.05+BA*.05+touch(uv,asp)*.36+quake(uv,asp);}`:`float hgt(vec2 px,vec2 r){vec2 uv=px/r;float asp=r.x/r.y;vec2 q=vec2(uv.x*asp,uv.y)*1.3+vec2(T*.004,0.);
  q+=(vec2(vq(q*.6+2.3+vec2(T*.015,0.)),vq(q*.6+6.1+vec2(0.,T*.012)))-.5)*.5;             // slow morph
  return vq(q)*.62+vq(q*2.03+17.1)*.3+.012*sin(T*.3)+LV*.05+BA*.05+touch(uv,asp)*.4+quake(uv,asp);}`}
vec3 plate(vec2 px,vec2 uv,vec2 r){
  float h=hgt(px,r),hx=hgt(px+vec2(1.,0.),r)-h,hy=hgt(px+vec2(0.,1.),r)-h;
  float lv=h*18.,fl=fract(lv),g=max(length(vec2(hx,hy))*18.,1e-4);
  float isI=step(mod(floor(lv+.5),5.),.5);
  float dpx=min(fl,1.-fl)/g;                                            // distance to the contour in px, from the exact slope
  vec3 col=mix(vec3(.80,.90,.72),vec3(.97,.80,.88),smoothstep(.25,.85,h));   // green valleys → pink peaks
  col*=(.97+.03*vn(px*.6))*(1.+clamp((hx-hy)*40.,-.06,.06));
  ${mode===2?`
  // FELT: every band between two contours is a piece of felt in ONE hard colour (stepped green → cream → pink),
  // and every contour is a solid satin stitch in black thread — heavy on index lines, lighter elsewhere.
  float k=floor(lv+.5),sd=(lv-k)/g,ad=abs(sd),lvl=mod(k,5.),band=floor(lv);
  float q=clamp(band-3.,0.,7.);                                                     // one step of the palette per band
  vec3 fc=q<1.?vec3(.22,.4,.2):(q<2.?vec3(.33,.56,.24):(q<3.?vec3(.47,.72,.29):(q<4.?vec3(.68,.85,.42):
          (q<5.?vec3(.93,.9,.78):(q<6.?vec3(.97,.78,.87):(q<7.?vec3(.93,.52,.72):vec3(.84,.2,.52)))))));
  fc*=.97+.06*h1(vec2(band,3.));                                                    // each piece its own dye lot
  float fib=.9+.14*fbm(px*.45+band*7.)+.05*(vn(px*vec2(2.2,.4)+band)-.5);          // felt fibres
  col=fc*fib*(1.-.08*smoothstep(3.,0.,ad));                                    // pressed down along the seam
  vec2 tg=normalize(vec2(-hy,hx)+1e-6);vec2 ac=floor(px/40.);float al=dot(px-(ac+.5)*40.,tg)+h1(ac)*18.;
  float w=lvl<.5?1.05:(lvl<1.5||lvl>3.5?.4:.65);
  float m=1.-smoothstep(w-.6,w+.9,ad);
  float sat=.72+.28*sin((al*1.7+sd*2.6)*1.9);                                       // slanted satin strands
  return mix(col,vec3(.24,.22,.22)*sat+vec3(.16)*pow(max(0.,sat-.9)*10.,2.)*.2,m*(lvl<.5?.7:.5));}`:`
  float w=isI>.5?.9:.5,line=1.-smoothstep(w-.6,w+.6,dpx);
  return mix(col,vec3(.1,.09,.09),line*(isI>.5?.7:.4));}`}`;
add("poziomice","Poziomice","Mapa o gładkich poziomicach: zielone doliny przechodzą w różowe szczyty, linie są czarne. Głośność powoli podnosi teren, żaba usypuje pagórek, co piąta poziomica jest pogrubiona.",0,POZ(0));
add("poziomice-filc","Poziomice: filc","Drobna, płynna mapa z wyspami i zatokami. Każde pole między poziomicami to kawałek filcu w jednym twardym kolorze, stopniowanym od zieleni w dolinach przez krem do różu na szczytach. Poziomice są wyszyte ciągłym ściegiem czarnej nitki, co piąta grubiej.",0,POZ(2));

// ===== THIRD BATCH (owner, 2026-09-30): "dodaj ~15 efektów … ten efekt offsetu bardzo mi się podobał, użyj go
// w jeszcze innych miejscach … coś z włoskami i materiałem … dobre motion design w neat stylu" =====
// Three families. PRINT OFF REGISTER (the riso look of Sitodruk, grown): offset CMYK, riso oscilloscope, screen-
// printed poster, layered paper cut (the offset is the shadow), the pond printed in riso. HAIR AND CLOTH: fur and
// velvet you write on with the frog (a nap-direction sim), reversible sequins, a knit the frog pulls, a
// thermochromic tee, denim the frog bleaches, a meadow the frogs part. PLAY THINGS: a zen garden the frog rakes, a
// lava lamp, a magnetic drawing board. Same rules as before: only frogs touch the sims, no random drops, motion
// is slow and smooth, grain does not reshuffle per frame.

// ---------- STAW: RISO — the pond sim printed in two drums, off register ----------
add("staw-riso","Staw: riso","Staw wydrukowany na risografie: zbocza fal od strony światła odbijają się różowym rastrem, od strony cienia morską zielenią, a oba bębny są lekko rozjechane. Spokojna woda to prawie czysty papier, a każde kółko od żaby wychodzi w dwóch farbach.",0,
`float wsl(vec2 uv){vec2 t=HS;return (texture(HT,uv+vec2(t.x,0.)).r-texture(HT,uv-vec2(t.x,0.)).r)*.7
  +(texture(HT,uv+vec2(0.,t.y)).r-texture(HT,uv-vec2(0.,t.y)).r)*.7;}      // slope towards the light (up-right)
vec3 plate(vec2 px,vec2 uv,vec2 r){vec3 col=vec3(.96,.94,.89)*(.96+.04*vn(px*.7));
  vec2 o=vec2(4.+sin(T*.21)*1.5,-3.+cos(T*.17)*1.5);                       // the teal drum sits off register, drifting
  float lit=smoothstep(.02,.1,wsl(uv)),shade=smoothstep(.02,.1,-wsl((px+o)/r));   // only the steep flanks print; the rest stays paper
  col*=mix(vec3(1.),vec3(.14,.55,.63),ht(px+o,.06+shade*.9,5.,.79)*.88*(.8+.2*vn(px*1.2)));
  col*=mix(vec3(1.),vec3(1.,.36,.62),ht(px,lit*.95,5.,.26)*.9*(.78+.22*vn(px*1.1+9.)));
  return col;}`,
// owner, 2026-10-01 (round 2): "zdecydowanie za długo się odbija". Cause: riso ran on the Staw sim itself, whose
// damping (*.9925 per 120 Hz step, amplitude e-fold ~1.1 s) is tuned for a clear pond, and whose texture edges are
// CLAMP_TO_EDGE = reflecting walls, so every ring bounced off the pad's borders and criss-crossed for seconds; the riso
// render prints any slope above .02, so even those weak echoes kept showing. Own copy: 3× the loss (*.9775, e-fold
// ~.37 s) and a sponge along the borders (9 % of the short side) that soaks a ring up instead of mirroring it.
Object.assign({},PadPlate._sims.staw,{fs:PadPlate._sims.staw.fs.replace("*.9925","*.9775").replace(
  "return vec4(clamp(h,-4.,4.),c.r,0.,1.);",
  "float e=min(min(uv.x,1.-uv.x)*A.x,min(uv.y,1.-uv.y));h*=mix(.93,1.,smoothstep(0.,.09,e));return vec4(clamp(h,-4.,4.),c.r,0.,1.);")}));

// ---------- WYCINANKA — layers of torn paper; the offset here is the shadow, and the bass lifts the layers ----------
add("wycinanka","Wycinanka","Pagórki z darcia kolorowego papieru ułożone warstwami, każda rzuca cień na tę za nią. Każda warstwa słucha innego pasma dźwięku: najdalsza basu, najbliższa wysokich tonów. Bas nadmuchuje tylne wzgórza szeroko i obło, wysokie tony wyostrzają szczyty z przodu, a w każdej warstwie lewa strona to dół jej pasma, prawa jego góra. Bas odrywa też warstwy od siebie, więc cienie się wydłużają. Żaba wciska papier w dół.",0,
`// owner, 2026-10-01: "niech te góry reprezentują też różne częstotliwości". Layer i: 0 front … 4 back. The back one
// listens to the bass, the front one to the treble (j = 4-i takes ~4 of the 16 bands, slow spectrum SPL): the whole
// layer rises with its band's energy, and across the pad it follows the band itself (left = its low end, right = its
// top). The bass swells broad and round, the treble sharpens into peaks, each tooth its own height.
float wyB(float j,float x){return specS((j*2.75+clamp(x,0.,1.)*4.)/15.);}
float wyE(float x,float i){float j=4.-i,E=(wyB(j,.1)+wyB(j,.4)+wyB(j,.7)+wyB(j,1.))*.25;
  float tx=x*(3.+j*1.5)+i*.37,tooth=1.-abs(fract(tx)*2.-1.),th=.5+.5*h1(vec2(floor(tx),i));
  return .16+i*.13+.04*sin(x*(3.+i)+T*(.3+i*.07)+i*2.)+.03*(vn(vec2(x*9.+i*13.,i))-.5)
    +E*mix(.15*(.45+.55*sin(3.14159*clamp(x,0.,1.))),.16*th*pow(tooth,4.),j*.25)+wyB(j,x)*.05;}
vec3 plate(vec2 px,vec2 uv,vec2 r){float asp=r.x/r.y;
  vec3 col=mix(vec3(.99,.93,.8),vec3(.99,.97,.93),uv.y)*(.97+.03*vn(px*.5));
  float lift=3.+BA*9.+KI*4.;                                               // how far the layers stand off each other (a hit lifts them)
  float push=touch(uv,asp)*.09;
  for(int k=4;k>=0;k--){float i=float(k);float e=wyE(uv.x,i)-push;
    float d=(uv.y-e)*r.y;                                                  // px above the torn edge
    col*=1.-.32*exp(-max(0.,d-lift*.4)/(2.5+lift))*step(0.,d);           // its shadow on the paper behind
    vec3 lc=k==4?PINK:(k==3?AMBER:(k==2?LIME:(k==1?GREEN:GREEN*.55)));   // brand palette (owner, 2026-10-01: no pale pink)
    float rim=smoothstep(.5,3.2,-d+(vn(px*.6+i*9.)-.5)*2.2);              // the white fibres of a torn edge
    col=mix(col,mix(vec3(.99,.98,.95),lc*(.95+.07*vn(px*.9+i)),rim),step(d,0.));}
  return col;}`);

// ---------- WELUR — a nap-direction sim: the frog brushes the pile its way (finger-writing on suede) ----------
const NAP={onlyFrogs:true,it:1,warm:2,fs:`vec4 st(vec2 uv,vec2 A){vec4 c=s(uv);vec2 cell=uv/TX;
  vec2 base=normalize(vec2((vn(cell*.025+2.)-.5)*.9,-1.));                 // the pile lies down, with a lazy swirl
  if(FRESH>.5)return vec4(base,0.,1.);
  vec2 n=c.rg;
  for(int i=0;i<4;i++){if(i>=NS)break;vec2 sd=(SEG[i].zw-SEG[i].xy)*A/TX.y;float L=length(sd);if(L<.05)continue;
    float d=sdSeg(uv*A,SEG[i].xy*A,SEG[i].zw*A)/TX.y;n=mix(n,sd/L,SEGP[i].y*smoothstep(10.,2.,d)*min(1.,L*.8)*.6);}
  return vec4(mix(n,base,.0005),0.,1.);}`};                                  // settles back by itself (~15 s)
const NAP_DIR=`vec2 napDir(vec2 uv){vec2 n=texture(HT,uv).rg;float l=length(n);return l>1e-3?n/l:vec2(0.,-1.);}
`;
add("welur","Welur","Ciemnoróżowy welur z połyskiem. Żaba przeczesuje włos swoją drogą i zostawia na tkaninie ślad jaśniejszy albo ciemniejszy, zależnie od kierunku. Głośność rozświetla połysk. Światło powoli się przesuwa, więc welur mieni się sam.",1,
NAP_DIR+`vec3 plate(vec2 px,vec2 uv,vec2 r){vec2 d=napDir(uv);
  float lit=dot(d,normalize(rot(sin(T*.18)*.45+BA*.12)*vec2(-.3,-1.)));   // the bass swings the light
  float crush=fbm(px*.008+vec2(T*.015,0.))*.7+fbm(px*.03+5.)*.3;          // crushed velvet: the pile lies every which way
  float sh=smoothstep(-.6,1.,lit)*.72+(crush-.3)*.45;
  vec3 col=mix(vec3(.22,.02,.11),vec3(.62,.06,.3),smoothstep(.1,.6,sh));
  col=mix(col,vec3(1.,.55,.78),smoothstep(.72,1.,sh)*(.55+LV*.45+KI*.08));   // a hit lifts the sheen a touch
  return col*(.92+.08*hI(ivec2(floor(px))));}`,NAP);

// ---------- CEKINY — reversible sequins: brush down = the frog's colour side, brush up = silver ----------
add("cekiny","Cekiny","Tkanina z dużymi dwustronnymi cekinami, jak na bluzie. Żaba przejeżdżając w dół albo w bok odwraca je na stronę w swoim kolorze, a jadąc w górę z powrotem na srebro. W spoczynku cekiny leżą matowo: błyska tylko ten, który się właśnie obraca, i gaśnie we własnym tempie, a czasem pojedynczy cekin sam złapie światło. Bas przepuszcza po nich falę połysku.",1,
`float hu(ivec2 q,int k){uvec3 v=uvec3(uvec2(q),uint(k))*1664525u+1013904223u;   // pcg3d
  v.x+=v.y*v.z;v.y+=v.z*v.x;v.z+=v.x*v.y;v^=v>>16u;v.x+=v.y*v.z;v.y+=v.z*v.x;v.z+=v.x*v.y;return float(v.x>>8)*(1./16777216.);}
vec3 plate(vec2 px,vec2 uv,vec2 r){vec3 col=vec3(.05,.05,.06)*(.8+.4*vn(px*.5));
  float pitch=15.;ivec2 ts=textureSize(HT,0);vec2 g=px/pitch;               // owner, 2026-10-01: "nieco większe"
  for(int oy=1;oy>=-1;oy--)for(int ox=-1;ox<=1;ox++){                       // lower rows lie on top, like scales
    float row=floor(g.y)+float(oy),sh=.5*mod(row,2.);
    vec2 cc=vec2(floor(g.x-sh)+float(ox)+.5+sh,row+.5)*pitch;
    vec4 S=texelFetch(HT,ivec2(clamp(cc/r,0.,.999)*vec2(ts)),0);
    float ph=S.r,fl=abs(cos(ph*3.14159));
    vec2 q=px-cc-vec2(0.,2.2);vec2 e=q/vec2(1.,max(fl,.24));float R=pitch*.64,dd=length(e);
    if(dd<R){
      vec3 face=ph<.5?mix(vec3(.46,.48,.53),vec3(.8,.81,.85),smoothstep(-R,R,q.y+q.x*.3)):SC[int(clamp(S.b+.5,0.,2.))]*(.66+.3*smoothstep(-R,R,q.y));
      float dome=1.-dd/R;face*=(.66+.34*dome)*(1.+.2*BA*sin(cc.y*.05+cc.x*.02-T*3.));   // the bass sends a sheen across
      // owner, 2026-10-01: "niech bardziej losowo się mienią, może tylko przy obracaniu". At rest a sequin lies matte;
      // it flashes while it turns and fades at its own pace (sim, a), and now and then one catches the light by itself
      // owner, 2026-10-01 (round 2): the lone glints came too often and in a beat, in visible patterns. Now each sequin
      // rolls its own dice once per 1.3 s slot (the slot grid shifted per sequin), at ~1/4 of the old chance and at a
      // random moment inside the slot, so the gaps between glints are geometric (≈ exponential), not a pulse; the dice
      // come from an integer hash (pcg3d) of the sequin and the slot, not fract(sin) of a linear mix, so no lattice shows
      ivec2 ci=ivec2(floor(cc/pitch*2.));float sT=T/1.3+hu(ci,-1),sn=floor(sT);int si=int(sn);
      float age=(fract(sT)-.85*hu(ci,si*3+1))*1.3,
        rare=step(hu(ci,si*3+2),.0051+.0073*HI)*step(0.,age)*exp(-age*5.5);
      float gl=max(S.a,rare*.8);
      face+=vec3(1.,.98,.94)*gl*(.3+.9*smoothstep(.75,0.,abs(dd/R-.3)));
      face*=1.-.8*step(dd,1.8);                                             // the hole the thread goes through
      col=mix(col,mix(vec3(.72,.73,.77)*(.85+.6*gl),face,smoothstep(.1,.6,fl)),smoothstep(R,R-1.,dd));}}   // edge-on: a silver rim
  return col;}`,
{onlyFrogs:true,it:1,fs:`vec4 st(vec2 uv,vec2 A){vec4 c=s(uv);if(FRESH>.5)return vec4(0.);
  float tg=c.g,sl=c.b;
  for(int i=0;i<4;i++){if(i>=NS)break;vec2 sd=(SEG[i].zw-SEG[i].xy)*A/TX.y;float L=length(sd);if(L<.03)continue;
    float d=sdSeg(uv*A,SEG[i].xy*A,SEG[i].zw*A)/TX.y;
    if(d<3.+SEGP[i].y*5.){float up=sd.y/L;if(up>.4)tg=0.;else if(up<.1){tg=1.;sl=SEGP[i].z;}}}   // dead band between: no flicker on a diagonal
  vec2 sq=floor(uv/TX/7.);                                                  // ~ one sequin's worth of cells
  float ph=c.r+clamp(tg-c.r,-.04,.04)*(.6+.8*h1(sq));                       // each sequin turns at its own pace
  // the glint of a turn (a): full while the sequin is turning, then it fades at its own random pace, .1-.6 s
  float gl=max(c.a*exp(-1./(120.*(.1+.5*h1(sq+7.3)))),step(.005,abs(tg-c.r)));
  return vec4(ph,tg,sl,gl);}`});

// ---------- KOSZULKA TERMO — thermochromic cotton: warmth changes its colour ----------
add("termo","Koszulka termo","Bawełna, która zmienia kolor od ciepła, jak koszulki z lat 90. Żaba grzeje materiał, a głośne granie grzeje mocniej: morski przechodzi w róż, a najgorętsze miejsca w żółć. Ciepło rozlewa się i powoli stygnie, a fałdy lekko drgają z basem. Uderzenie to błysk ciepła.",0,
`vec3 plate(vec2 px,vec2 uv,vec2 r){float h=texture(HT,uv).r;
  vec2 f=fract(px/vec2(4.,3.4));float knit=.9+.1*smoothstep(.1,.4,abs(f.x-.5+(f.y-.5)*.5));   // jersey loops
  float fold=fbm(px*.004+vec2(T*.01,0.))+BA*.06*sin(px.y*.02+T*2.);
  vec3 col=mix(vec3(.08,.36,.45),vec3(.93,.22,.52),smoothstep(.12,.42,h));
  col=mix(col,vec3(1.,.84,.3),smoothstep(.62,1.,h));
  col=mix(col,vec3(.45,.2,.5),smoothstep(.06,.12,h)*(1.-smoothstep(.12,.24,h))*.5);   // the changing band at the edge
  return col*knit*(.7+.55*fold);}`,
{onlyFrogs:true,it:1,fs:`vec4 st(vec2 uv,vec2 A){vec4 c=s(uv);if(FRESH>.5)return vec4(0.);
  vec2 dx=vec2(TX.x,0.),dy=vec2(0.,TX.y);
  float h=mix(c.r,(s(uv+dx).r+s(uv-dx).r+s(uv+dy).r+s(uv-dy).r)*.25,.12)*.9993;   // spreads, cools in ~8 s
  for(int i=0;i<4;i++){if(i>=NS)break;float d=sdSeg(uv*A,SEG[i].xy*A,SEG[i].zw*A)/TX.y;h+=SEGP[i].y*(.05+LV*.12+KI*.12)*exp(-d*d/80.);}   // a hit is a flash of warmth
  return vec4(min(h,1.5),0.,0.,1.);}`});

// ---------- LAMPA LAVA — a real lava lamp cycle: wax buds from the bottom puddle, rises, clings under the cap, drips back ----------
add("lawa","Lampa lava","Lampa lava: gęsty wosk powoli krąży w ciepłej cieczy. Z kałuży na dnie pączkują kule, rosną, odrywają się i płyną w górę, wydłużając się w krople. U góry rozlewają się w górnej warstwie wosku, która z czasem kapie z powrotem, a spadające krople roztapiają się w kałuży na dnie. Spotykające się kule zlewają się w większe, a duże z czasem pękają na dwie. Bas grzeje mocniej, więc pączkuje więcej kul. Żaba łagodnie rozpycha wosk i barwi go swoim kolorem, a grana w dolnym lub górnym pasie wyciąga z niego kulę: im dłużej brzmi, tym większą.",1,
`// LAVA LAMP v3 (owner, 2026-10-01, third round: "less angular; the strip at the bottom also at the top; more lava from the
// start; much better and more organic; the frog gentler, not aggressive and chaotic").
// Smoothness: the wax is ONE field evaluated three times (the normal comes from finite differences of the full field,
// displacement included, so the shading has no creases), the outline noise uses quintic interpolation (no grid ridges),
// and the kernel is C2. Organic shape: a moving ball is drawn out into a drop along its motion (the trailing side
// longer, blended smoothly), squashed along its last impact, and its outline breathes with slow noise.
// Two puddles: the hot one on the bulb (its height = the wax it holds, LP.x) and a cooler layer under the cap (LP.y).
// The physics lives in PadPlate._bodies.lawa: BL = (x, y, radius, warmth) · BD = (squash, wobble, seed) ·
// BC = tint · BV = (stretch velocity, melt 0..1, layer -1 bottom / +1 top).
// Melting (owner, 10-01: "absorbing and springy, a spill, not a ball"): a ball touching a layer flattens and widens
// into it while its wax pours into a local swell of that layer (LW = x, layer, width, height), which wobbles once or
// twice like jelly, spreads and evens out into the layer.
uniform vec4 BL[16];uniform vec4 BD[16];uniform vec4 BC[16];uniform vec4 BV[16];uniform int NB;uniform vec4 LP;
uniform vec4 LW[8];uniform int NW;
// Lava lamp v2: ripples running along the bottom puddle (LB) and the top layer (LT), 32 samples across the pad, surface
// displacement in y (up > 0). The plain lamp never uploads them, so they stay zero there.
uniform float LB[32];uniform float LT[32];
float lvW(float x,float asp,float sd){float t=clamp(x/asp,0.,1.)*31.;int i=min(int(t),30);float f=t-float(i);
  return sd<0.?mix(LB[i],LB[i+1],f):mix(LT[i],LT[i+1],f);}
float lvN(vec2 p){vec2 i=floor(p),f=p-i;vec2 u=f*f*f*(f*(f*6.-15.)+10.);ivec2 q=ivec2(i);
  return mix(mix(hI(q),hI(q+ivec2(1,0)),u.x),mix(hI(q+ivec2(0,1)),hI(q+ivec2(1,1)),u.x),u.y);}
float lvK(vec2 d,float R){float x=max(0.,1.-dot(d,d)/(4.*R*R));return x*x*x*2.370;}
// the balls whose kernel can reach this pixel (set once per pixel in plate()): the field is summed three times per pixel
// (value + two differences for the normal), so skipping the far balls there pays three times over
int LVI[16];int LVC;
const vec3 LVHOT=vec3(1.,.47,.1),LVCOOL=vec3(.93,.14,.45);
// the swell of a layer at x (same sum as _off() in the JS below)
float lvOff(float x,float sd){float o=0.;for(int i=0;i<8;i++){if(i>=NW)break;vec4 w=LW[i];if(abs(w.y-sd)>.5)continue;
  float k=(x-w.x)/w.z;o+=w.w*exp(-k*k);}return o;}
float lvField(vec2 p,float asp,out vec3 cw){
  float f=0.,k;cw=vec3(0.);
  // the hot puddle on the bulb and the cooler layer under the cap; both sway a little
  float bulb=.55+.35*BA+.25*LV;
  vec2 q=vec2((p.x-.5*asp)/(.86*asp),(p.y+.02-LP.x*.5-(lvN(vec2(p.x*3.,T*.12))-.5)*.025)/max(LP.x+(lvOff(p.x,-1.)+lvW(p.x,asp,-1.))/1.085,.01));
  k=lvK(q,1.)*1.2;f+=k;cw+=k*LVHOT*(.95+.2*bulb);
  q=vec2((p.x-.5*asp)/(.86*asp),(p.y-1.02+LP.y*.5-(lvN(vec2(p.x*2.6+5.,T*.1))-.5)*.02)/max(LP.y+(lvOff(p.x,1.)-lvW(p.x,asp,1.))/1.085,.01));
  k=lvK(q,1.)*1.2;f+=k;cw+=k*mix(LVCOOL,LVHOT,.25);
  for(int j=0;j<16;j++){if(j>=LVC)break;int i=LVI[j];vec4 b=BL[i],dd=BD[i];vec2 vv=BV[i].xy;
    vec2 d=p-b.xy;
    float ql=length(dd.xy),m=min(ql,.35);vec2 nq=ql>1e-4?dd.xy/ql:vec2(1.,0.);
    float al=dot(d,nq);d=nq*al/(1.-m)+(d-al*nq)*(1.-.4*m);                 // squashed along the last impact
    float sp=length(vv);
    if(sp>1e-4){vec2 vd=vv/sp;float s=clamp(sp/.1,0.,1.)*.36;float a=dot(d,vd);vec2 pe=d-a*vd;
      a/=mix(1.+s*1.4,1.+s*.3,smoothstep(-.6*b.z,.6*b.z,a));             // a drop: drawn out behind, round in front
      d=vd*a+pe*(1.+.2*s);}
    float ml=BV[i].z;if(ml>0.){d.x/=1.+.9*ml;d.y/=1.-.35*ml;}               // melting: sags and widens as it sinks into the layer
    vec2 nn=d/b.z;
    float nz=lvN(nn*1.05+vec2(dd.w*7.3,T*.16))*.62+lvN(nn*2.1+vec2(T*.23,dd.w*3.1))*.38;
    float R=b.z*(1.+(.04+.1*dd.z)*(nz-.5)*2.);
    k=lvK(d,R)*(1.-ml*ml*(3.-2.*ml));                                     // ...and dissolves into it (the swell takes its wax)
    vec3 wc=mix(LVCOOL,LVHOT,smoothstep(.15,.85,b.w)*.85+.15*fract(dd.w*.37));
    wc=mix(wc,BC[i].rgb,BC[i].a*.6);
    f+=k;cw+=k*wc;}
  return f;}
vec3 plate(vec2 px,vec2 uv,vec2 r){float asp=r.x/r.y;vec2 p=vec2(uv.x*asp,uv.y);
  float bulb=.55+.35*BA+.25*LV;
  vec3 cw,c1,c2;float e=1.6/r.y;
  LVC=0;for(int i=0;i<16;i++){if(i>=NB)break;vec4 b=BL[i];if(length(p-b.xy)<b.z*2.3+.06){LVI[LVC]=i;LVC++;}}   // kernel support is 2R, stretched up to ~1.5×
  float f=lvField(p,asp,cw),fx=lvField(p+vec2(e,0.),asp,c1),fy=lvField(p+vec2(0.,e),asp,c2);
  vec3 wc=cw/max(f,1e-4);
  vec3 bg=mix(vec3(.24,.05,.12),vec3(.06,.03,.09),uv.y)+vec3(.4,.14,.05)*exp(-uv.y*4.)*bulb+vec3(.06,.02,.05)*exp(-(1.-uv.y)*6.);
  for(int i=0;i<4;i++){if(i>=NP)break;vec2 d=p-vec2(P[i].x*asp,P[i].y);bg+=PC[i]*.12*P[i].z*exp(-dot(d,d)/.012);}   // a warm halo round the frog
  vec2 g=vec2(fx-f,fy-f)/e;
  vec3 N=normalize(vec3(-g*.03,1.));
  vec3 L=normalize(vec3(-.4,.55,.75));
  float dif=.55+.45*max(dot(N,L),0.);
  float spc=pow(max(dot(reflect(-L,N),vec3(0.,0.,1.)),0.),18.);
  float rim=pow(1.-N.z,1.4);
  float thick=smoothstep(1.,3.2,f);                                     // thick wax glows from within
  vec3 body=wc*dif*(1.+.32*(1.-uv.y)*bulb)+wc*rim*.42+mix(wc,wc*1.3+.06,thick)*.22+vec3(1.,.95,.88)*spc*.35;
  float fw=max(fwidth(f),1e-4),dp=(f-1.)/fw;
  vec3 col=mix(bg+wc*.18*smoothstep(.4,1.,f),body,smoothstep(-.9,.9,dp));
  return col+vec3(1.)*.05*smoothstep(.035,0.,abs(uv.x-.16))+vec3(1.)*.025*smoothstep(.02,0.,abs(uv.x-.2));}`);

// ---------- LAMPA LAVA, the physics behind the shader above ----------
// A slow, viscous cycle between two layers of wax. The bottom puddle holds a reservoir (res): warm balls BUD from it
// (a small ball anchored at the surface draws wax until it is big enough, then breaks away and rises); balls cool as
// they rise and MELT into the top layer (top); the top layer DRIPS cool balls back, which fall and melt into the
// bottom puddle. Melting (owner, 10-01): the ball rides the layer's surface, flattens and spreads into it while its wax
// pours into a local swell (S.W) that wobbles like jelly, widens and evens out into the layer, so wax is never lost or
// created. The frog played in the bottom or top strip pulls a ball out of that layer: it grows while the frog stays and
// sounds there (capped, FCAP), follows it, and breaks away when the frog leaves (dragged out = thrown along).
// Balls that meet hang together, then the smaller one is swallowed by the bigger; big balls split now and then. The
// frog is a soft obstacle: wax is pushed out of its way by a spring and keeps no bounce.
PadPlate._bodies.lawa={
  MAX:16,NWAVE:8,FCAP:.0085,
  _mk(x,y,A,warm){return {x,y,vx:0,vy:0,A,r:Math.sqrt(A),warm,qx:0,qy:0,qvx:0,qvy:0,wob:0,seed:Math.random()*7,
    tr:1,tg:1,tb:1,ta:0,host:null,nomerge:0,bud:0,side:0,fid:null,melt:0,A0:0,mw:null,sx:0,sy:0};},
  _hb(S){return 2*(.04+S.res*.85/S.asp);},                  // bottom puddle thickness from the wax it holds (×2: owner, 10-01)
  _ht(S){return .035+S.top*.85/S.asp;},
  // where the shader's layer field crosses 1 at x (the layers taper towards the glass), without the swells
  _qy(S,x){const q=(x-.5*S.asp)/(.86*S.asp);return Math.sqrt(Math.max(.05,1.177-q*q));},
  _sb(S,x){const H=this._hb(S);return -.02+H*(.5+this._qy(S,x));},
  _st(S,x){const H=this._ht(S);return 1.02-H*(.5+this._qy(S,x));},
  _off(S,x,side){let o=0;for(const w of S.W)if(w.side===side){const k=(x-w.x)/w.w;o+=w.amp*Math.exp(-k*k);}return o;},
  _surf(S,x,side){return side<0?this._sb(S,x)+this._off(S,x,-1):this._st(S,x)-this._off(S,x,1);},
  init(asp){const B=[];const S={B,W:[],asp,t:0,res:.022,top:.008,spawnT:1.5,dripT:5};
    const rs=[.125,.105,.09,.08,.072,.064,.056,.05,.044,.038,.033];   // more wax from the start, many sizes
    rs.forEach((R,i)=>{const col=i%3,row=Math.floor(i/3);
      const b=this._mk(R+(asp-2*R)*((col+.5+.3*((row%2)-.5))/3),.26+.19*row+.04*Math.sin(i*2.1),R*R,(i*.7548+.21)%1);b.nomerge=4;B.push(b);});
    return S;},
  _kick(b,nx,ny,s){s=Math.min(.5,s);b.qvx+=nx*s*1.6;b.qvy+=ny*s*1.6;b.wob=Math.min(1,b.wob+s*1.5);},
  _split(S,b,nx,ny,frac){if(S.B.length>=this.MAX||b.host||b.bud||b.melt)return;
    const A2=b.A*frac;if(A2<.0006)return;b.A-=A2;b.r=Math.sqrt(b.A);
    const r2=Math.sqrt(A2),c=this._mk(b.x+nx*(b.r*.35+r2*.4),b.y+ny*(b.r*.35+r2*.4),A2,b.warm);
    b.x-=nx*r2*.25;b.y-=ny*r2*.25;
    const v=.07+.04*Math.random();c.vx=b.vx+nx*v;c.vy=b.vy+ny*v;b.vx-=nx*v*frac;b.vy-=ny*v*frac;
    c.tr=b.tr;c.tg=b.tg;c.tb=b.tb;c.ta=b.ta;c.nomerge=b.nomerge=3.5;
    this._kick(b,nx,ny,.2);this._kick(c,-nx,-ny,.2);S.B.push(c);},
  // a ball growing out of a layer (side -1 bottom, +1 top); fid = the frog pulling it out, if any
  _bud(S,x,side,size,fid){const R=side<0?"res":"top",a0=Math.min(.00015,S[R]);S[R]-=a0;
    const b=this._mk(x,this._surf(S,x,side),Math.max(a0,1e-5),side<0?1:.05);
    b.bud=size;b.side=side;b.fid=fid==null?null:fid;b.nomerge=1.5;S.B.push(b);return b;},
  // a swell where a ball melts into a layer; a near one on the same layer is fed again
  _wave(S,x,side,r){let w=S.W.find(w=>w.side===side&&Math.abs(w.x-x)<w.w*.8);
    if(w){w.age=Math.min(w.age,.3);return w;}
    if(S.W.length>=this.NWAVE){let k=0;S.W.forEach((v,i)=>{if(v.A<S.W[k].A)k=i;});this._flush(S,S.W[k]);S.W.splice(k,1);}
    const w0=Math.max(.04,r*.85);w={x,side,A:0,age:0,w0,w:w0,amp:0};S.W.push(w);return w;},
  _flush(S,w){if(w.side<0)S.res+=w.A;else S.top+=w.A;w.A=0;},
  _melt(S,b,side,sp){b.melt=.001;b.side=side;b.A0=b.A;b.r0=b.r;b.host=null;b.bud=0;b.fid=null;b.mw=this._wave(S,b.x,side,b.r);
    b.sx=b.sy=0;this._kick(b,0,1,.25+Math.min(.25,sp*2));},
  step(S,st,f,dtMs,asp){
    if(Math.abs(S.asp-asp)>1e-3){for(const b of S.B)b.x*=asp/S.asp;for(const w of S.W)w.x*=asp/S.asp;S.asp=asp;}
    const B=S.B,bulb=.55+.35*f.ba+.25*f.lv,fs=Math.max(.001,dtMs/1000);
    const F=[];for(const id in st.pts){const p=st.pts[id];if(!p.on)continue;
      F.push({id,x:p.x*asp,y:p.y,vx:(p.x-p.px)*asp/fs,vy:(p.y-p.py)/fs,r:.08,rgb:p.rgb||[.925,.102,.514]});}
    if(f.ki>.5)for(const b of B)b.wob=Math.max(b.wob,f.ki*.3);
    let left=Math.min(.1,fs);
    while(left>1e-4){const h=Math.min(.008,left);left-=h;S.t+=h;
      // BUDDING from the bottom puddle (faster with heat and the bass), DRIPPING from the top layer (the more it holds)
      S.spawnT-=h*(.35+.9*f.ba+.4*f.lv);
      if(S.spawnT<=0&&S.res>.004&&B.length<this.MAX){S.spawnT=1.4+2*Math.random();
        this._bud(S,asp*(.18+.64*Math.random()),-1,Math.min(.012,.0025+Math.random()*.007,S.res*.6));}
      S.dripT-=h*(.15+S.top*30);
      if(S.dripT<=0&&S.top>.008&&B.length<this.MAX){S.dripT=2+2.5*Math.random();
        this._bud(S,asp*(.2+.6*Math.random()),1,Math.min(.009,.002+Math.random()*.006,(S.top-.005)*.8));}
      // the FROG in the bottom or top strip pulls a ball out of that layer
      if(this.PULL!==false)for(const fr of F){if(B.some(b=>b.fid===fr.id)||B.length>=this.MAX)continue;
        const inB=fr.y<this._sb(S,fr.x)+.07,inT=fr.y>this._st(S,fr.x)-.07;
        if(inB&&S.res>.0004)this._bud(S,fr.x,-1,this.FCAP,fr.id);else if(inT&&S.top>.0004)this._bud(S,fr.x,1,this.FCAP,fr.id);}
      for(const b of B){
        if(b.bud){const R=b.side<0?"res":"top";let rate=.0028;
          if(b.fid!=null){const fr=F.find(q=>q.id===b.fid);
            if(fr&&(b.side<0?fr.y<this._sb(S,fr.x)+.12:fr.y>this._st(S,fr.x)-.12)){   // the frog holds it: it grows while it sounds
              b.x+=(Math.max(b.r,Math.min(asp-b.r,fr.x))-b.x)*Math.min(1,h*4);
              b.tr=fr.rgb[0];b.tg=fr.rgb[1];b.tb=fr.rgb[2];b.ta=Math.min(1,b.ta+h*2);
              rate=(this.PULLRATE||.0021)*(.55+.9*Math.min(1,f.lv));}   // ~4 s of sound to the full size (v3: about half that)
            else{b.fid=null;b.bud=0;b.nomerge=1.5;
              if(b.A<.0007){this._melt(S,b,b.side,0);continue;}                // a tap: the little bud melts back
              const up=-b.side;b.warm=up>0?1:.05;
              b.vx=fr?Math.max(-.12,Math.min(.12,fr.vx*.3)):0;
              b.vy=up*Math.max(.03,Math.min(.15,fr?fr.vy*up*.3:0));                // dragged out = thrown along
              this._kick(b,0,1,.15);continue;}}
          const dA=Math.max(0,Math.min(S[R],h*rate,b.bud-b.A));b.A+=dA;S[R]-=dA;b.r=Math.sqrt(b.A);
          const g=Math.min(1,b.A/(b.fid!=null?.005:b.bud));
          b.y+=(this._surf(S,b.x,b.side)-b.side*b.r*(.15+.55*g)-b.y)*Math.min(1,h*3);b.vx=0;b.vy=0;b.warm=b.side<0?1:.05;
          if(b.fid==null&&(b.A>=b.bud-1e-6||S[R]<=1e-5)){b.bud=0;b.vy=-b.side*.02;b.nomerge=1.5;}
          continue;}
        if(b.melt){
          // it rides the layer's surface (swell included), flattens and pours its wax into the swell
          b.melt=Math.min(1,b.melt+h*(.55+.25*b.melt)/(.7+b.A0*40));
          const m=b.melt,A=b.A0*(1-m*m*(3-2*m)),dA=Math.max(0,b.A-A);b.A=A;b.r=Math.sqrt(A);
          if(S.W.indexOf(b.mw)<0)b.mw=this._wave(S,b.x,b.side,b.r);
          b.mw.A+=dA;b.mw.x+=(b.x-b.mw.x)*Math.min(1,h*2);
          const rv=b.r0*(1-.35*b.melt);
          b.y+=(this._surf(S,b.x,b.side)-b.side*rv*(.6-1.3*b.melt)-b.y)*Math.min(1,h*4);
          b.vx*=Math.exp(-4*h);b.x+=b.vx*h;b.vy=0;
          if(b.melt>=1){b.mw.A+=b.A;b.A=0;}
          continue;}
        // heating near the bulb, cooling under the cap
        b.warm+=h*(.3*Math.pow(Math.max(0,1-b.y),5)*(.6+bulb)-.3*Math.pow(b.y,4)-.012*(b.warm-.5));
        b.warm=Math.max(0,Math.min(1,b.warm));
        b.r=Math.sqrt(b.A)*(1+.12*f.ba*b.warm);
        b.vx+=h*.006*Math.sin(S.t*.31+b.seed*3)*(1-Math.min(1,Math.max(0,(b.y-.7)/.2)));
        b.vy+=h*((b.warm-.5)*.16+.004*Math.sin(S.t*.23+b.seed*5));
        const dr=Math.exp(-.9*h);b.vx*=dr;b.vy*=dr;b.nomerge=Math.max(0,b.nomerge-h);}
      // swallowing
      for(const b of B){const H=b.host;if(!H)continue;
        if(B.indexOf(H)<0||H.melt||H.bud){b.host=null;continue;}
        b.vx+=(H.x-b.x)*3*h+(H.vx-b.vx)*Math.min(1,3*h);b.vy+=(H.y-b.y)*3*h+(H.vy-b.vy)*Math.min(1,3*h);
        const dA=Math.min(b.A,h*(.001+b.A*.9));b.A-=dA;H.A+=dA;
        if(b.ta>H.ta*.5){H.tr+=(b.tr-H.tr)*.02;H.tg+=(b.tg-H.tg)*.02;H.tb+=(b.tb-H.tb)*.02;H.ta=Math.max(H.ta,b.ta*.8);}}
      for(let i=B.length-1;i>=0;i--)if(B[i].A<4e-5&&!B[i].bud&&!B[i].keep){const b=B[i],H=b.host;
        if(H)H.A+=b.A;else if(b.melt&&b.mw)b.mw.A+=b.A;B.splice(i,1);}
      for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++){const a=B[i],c=B[j];
        if(a.host===c||c.host===a||a.melt||c.melt)continue;
        let dx=c.x-a.x,dy=c.y-a.y,d=Math.hypot(dx,dy);if(d<1e-5){dx=1e-3;d=1e-3;}
        const rs=a.r+c.r;if(d>rs*1.3)continue;
        const big=a.A>=c.A?a:c,sm=big===a?c:a;
        if(!sm.keep&&!big.keep&&!sm.host&&!big.host&&!sm.nomerge&&!big.nomerge&&!sm.bud&&!big.bud&&d<big.r*.8&&Math.sqrt(big.A+sm.A)<.16&&Math.random()<h*.8){
          sm.host=big;this._kick(big,(sm.x-big.x)/d,(sm.y-big.y)/d,.15);continue;}
        const nx=dx/d,ny=dy/d,ma=a.A,mc=c.A;let wa=mc/(ma+mc),wc=ma/(ma+mc),acc;
        if(d<rs*.55)acc=-(rs*.55-d)*1.4;
        else acc=.03*(1-(d-rs*.55)/(rs*.75));
        if(a.bud)wa=0;if(c.bud)wc=0;   // a bud is anchored to its layer
        a.vx+=nx*acc*wa*h;a.vy+=ny*acc*wa*h;c.vx-=nx*acc*wc*h;c.vy-=ny*acc*wc*h;
        const rv=(c.vx-a.vx)*nx+(c.vy-a.vy)*ny,vd=rv*Math.min(1,h*1.5);
        a.vx+=nx*vd*wa;a.vy+=ny*vd*wa;c.vx-=nx*vd*wc;c.vy-=ny*vd*wc;}
      // big lumps split slowly on their own
      for(const b of B.slice())if(!b.keep&&!b.host&&!b.bud&&!b.melt&&b.r>.115&&Math.random()<h*.04*(b.r/.115)){
        const a=Math.random()*6.2832;this._split(S,b,Math.cos(a)*.4,Math.sin(a)*.3+(b.warm>.5?.85:-.85),.3+.2*Math.random());}
      for(const b of B){if(b.bud||b.melt)continue;
        b.x+=b.vx*h;b.y+=b.vy*h;
        const r=b.r;if(b.host)continue;
        if(b.keep){this._keepMove(S,b,h,asp);continue;}   // v2: a frog's bubble (below)
        if(b.x<r){b.x=r;if(b.vx<0)b.vx=-b.vx*.3;}
        if(b.x>asp-r){b.x=asp-r;if(b.vx>0)b.vx=-b.vx*.3;}
        // touching a layer: rising into the top one or settling onto the bottom one, the ball melts into it
        const yb=this._surf(S,b.x,-1),yt=this._surf(S,b.x,1);
        if(!b.nomerge){
          if(b.y+r>yt-r*.15&&b.vy>-.01){this._melt(S,b,1,Math.max(0,b.vy));continue;}
          if(b.y-r<yb+r*.15&&b.vy<.01){this._melt(S,b,-1,Math.max(0,-b.vy));continue;}}
        if(b.y>yt-r*.2){b.y=yt-r*.2;if(b.vy>0)b.vy=0;}
        if(b.y<yb+r*.2){b.y=yb+r*.2;if(b.vy<0)b.vy*=-.2;}
        // the frog: a soft obstacle. A spring pushes wax out of its way; no bounce, a gentle wake
        if(this.FROG_PUSH!==false)for(const fr of F){let dx=b.x-fr.x,dy=b.y-fr.y,d=Math.hypot(dx,dy);const rr=r+fr.r;
          if(d<rr*1.8&&d>1e-5){const w=h*.25*(1-d/(rr*1.8));b.vx+=(fr.vx-b.vx)*w;b.vy+=(fr.vy-b.vy)*w;}
          if(d>=rr)continue;if(d<1e-5){dx=0;dy=1;d=1;}
          const nx=dx/d,ny=dy/d,pen=rr-d;
          b.vx+=nx*pen*7*h;b.vy+=ny*pen*7*h;
          const vr=(b.vx-fr.vx)*nx+(b.vy-fr.vy)*ny;
          if(vr<0){const c=Math.min(1,h*5);b.vx-=vr*nx*c;b.vy-=vr*ny*c;this._kick(b,nx,ny,-vr*.25*c*8);}
          b.tr=fr.rgb[0];b.tg=fr.rgb[1];b.tb=fr.rgb[2];b.ta=Math.min(1,b.ta+h*1.5);}
        const sp=Math.hypot(b.vx,b.vy);if(sp>.5){b.vx*=.5/sp;b.vy*=.5/sp;}}
      // the swells: fed by melting balls, they wobble like jelly (one or two swings), widen and even out into the layer
      for(let i=S.W.length-1;i>=0;i--){const w=S.W[i];w.age+=h;
        const fed=B.some(b=>b.mw===w&&b.melt);
        const dA=w.A*h*(fed?.15:.5);w.A-=dA;if(w.side<0)S.res+=dA;else S.top+=dA;
        w.w=Math.min(.34,w.w0+.06*w.age);
        w.amp=1.77*w.A/w.w*(1+.4*Math.sin(w.age*6)*Math.exp(-w.age*1.4));
        if(!fed&&w.A<2e-5){this._flush(S,w);S.W.splice(i,1);}}
      for(const b of B){
        // a ball wants to be round, but slowly (owner): an overdamped spring, seconds, no ringing
        b.qvx+=h*(-1.6*b.qx-3.2*b.qvx);b.qvy+=h*(-1.6*b.qy-3.2*b.qvy);
        // its stretch into a drop follows its motion slowly and lingers after it stops
        const kS=Math.min(1,h*.35);b.sx+=(b.vx-b.sx)*kS;b.sy+=(b.vy-b.sy)*kS;
        b.qx+=b.qvx*h;b.qy+=b.qvy*h;
        const ql=Math.hypot(b.qx,b.qy);if(ql>.3){b.qx*=.3/ql;b.qy*=.3/ql;}
        b.wob*=Math.exp(-1.2*h);b.ta*=Math.exp(-h/7);}
    }
  },
  upload(gl,u,S){if(!u.BL)return;const n=Math.min(this.MAX,S.B.length),L=new Float32Array(64),D=new Float32Array(64),C=new Float32Array(64),V=new Float32Array(64);
    S.B.slice(0,n).forEach((b,i)=>{L.set([b.x,b.y,b.melt?b.r0:b.r,b.warm],i*4);D.set([b.qx,b.qy,b.wob,b.seed],i*4);C.set([b.tr,b.tg,b.tb,b.ta],i*4);
      V.set(b.bud?[0,0,0,0]:[b.sx,b.sy,b.melt,b.side],i*4);});
    gl.uniform4fv(u.BL,L);gl.uniform4fv(u.BD,D);gl.uniform4fv(u.BC,C);if(u.BV)gl.uniform4fv(u.BV,V);gl.uniform1i(u.NB,n);
    if(u.LP)gl.uniform4f(u.LP,this._hb(S),this._ht(S),0,0);
    if(u.LW){const W=S.W.slice(0,this.NWAVE),A=new Float32Array(32);W.forEach((w,i)=>A.set([w.x,w.side,w.w,w.amp],i*4));
      gl.uniform4fv(u.LW,A);gl.uniform1i(u.NW,W.length);}}
};

// ---------- LAMPA LAVA v2 — every frog wears a bubble of wax that never melts; the layers ripple at every touch ----------
// Owner, 2026-10-02: "a variant of the lava lamp where a bubble of wax sits round the frog, behaves like a wax bubble
// but never disappears; the bottom and the top react more and ripple on contact with the wax bubbles". Same shader as
// the plain lamp (its LB/LT ripples are zero there); the body inherits the plain lamp's whole cycle and adds two things.
add("lawa-2","Lampa lava v2","Lampa lava v2: jak zwykła lampa, ale każda żaba nosi wokół siebie bąbel wosku. Bąbel płynie za żabą z opóźnieniem, rozciąga się w ruchu, zlewa się z mijanym woskiem i łączy się z dolną kałużą i górną warstwą jak wosk z woskiem: warstwa podciąga się do niego, a odciągnięty ciągnie za sobą woskową szyjkę, aż ta puści. Nie znika: gdy żaba odejdzie, bąbel zostaje i dryfuje z woskiem, a kolejna żaba go przejmuje. Dolna kałuża i górna warstwa falują przy każdym dotyku wosku: kula albo bąbel wciska się w nie, a fala rozchodzi się na boki i powoli gaśnie. Bas grzeje mocniej, więc pączkuje więcej kul.",1,
  PadPlate._fs.lawa);
// THE BUBBLE: one per frog (keep = true), grown from nothing in about a second to KA, then held at that size. A soft,
// slightly underdamped spring pulls it after its frog, so it lags, overshoots a little and is drawn out into a drop by
// the plain lamp's stretch. It JOINS the layers like wax joins wax (owner, 10-02: "it should merge with the top and the
// bottom, not push them away"): close to a layer it draws the layer up to itself, so a neck of wax grows between them;
// it can sink into a layer down to its middle and moves through it as through thick wax; pulled away, the neck
// stretches, lets go and the layer rings. It never melts, splits, swallows or is swallowed. When its frog leaves it stays: it heats and cools like any wax and
// drifts up and down the lamp, and the next frog without a bubble adopts the nearest one. The frog itself no longer
// pushes wax or pulls balls out of the layers: the bubble does the pushing.
// THE RIPPLES: the bottom puddle and the top layer each carry a 1D wave (32 samples across the pad: height, velocity;
// c² = .16, restoring K = 5, damping .8, so a touch rings for a few seconds and runs off to the sides). Every ball near a
// layer presses it in proportion to how deep it sinks in and how fast it comes, a ball melting into a layer slaps it,
// a ball budding from it pulls it up. The surface the balls ride (_surf) includes the ripples, so wax bobs on them.
PadPlate._bodies["lawa-2"]=Object.assign(Object.create(PadPlate._bodies.lawa),{
  PULL:false,FROG_PUSH:false,NWV:32,KEEP:4,KA:.0078,
  _base(){return PadPlate._bodies.lawa;},
  init(asp){const S=this._base().init.call(this,asp);const n=this.NWV;
    S.wv={"-1":{h:new Float32Array(n),v:new Float32Array(n)},"1":{h:new Float32Array(n),v:new Float32Array(n)}};S.fr={};return S;},
  _wvAt(S,x,side){const a=S.wv[side].h,n=this.NWV,t=Math.max(0,Math.min(1,x/S.asp))*(n-1),i=Math.min(n-2,Math.floor(t)),f=t-i;return a[i]*(1-f)+a[i+1]*f;},
  _surf(S,x,side){return this._base()._surf.call(this,S,x,side)+this._wvAt(S,x,side);},
  // a slap on a layer's ripple: amp > 0 pushes it away from the wax (down at the bottom, up at the top)
  _slap(S,x,side,r,amp){const W=S.wv[side],n=this.NWV,w=Math.max(.035,r*1.4);
    for(let i=0;i<n;i++){const k=(i/(n-1)*S.asp-x)/w;W.v[i]+=side*amp*Math.exp(-k*k);}},
  _melt(S,b,side,sp){this._slap(S,b.x,side,b.r,.18+1.2*Math.min(.3,sp));this._base()._melt.call(this,S,b,side,sp);},
  _bud(S,x,side,size,fid){this._slap(S,x,side,.05,-.09);return this._base()._bud.call(this,S,x,side,size,fid);},
  _keepMove(S,b,h,asp){
    if(b.A<this.KA){b.A=Math.min(this.KA,b.A+h*.009);b.r=Math.sqrt(b.A);}
    const fr=b.frog!=null?S.fr[b.frog]:null;
    if(fr){const K=11,C=2*Math.sqrt(K)*.45;b.vx+=((fr.x-b.x)*K-b.vx*C)*h;b.vy+=((fr.y-b.y)*K-b.vy*C)*h;
      b.tr=fr.rgb[0];b.tg=fr.rgb[1];b.tb=fr.rgb[2];b.ta=Math.min(1,b.ta+h*2);}
    const r=b.r;
    if(b.x<r){b.x=r;if(b.vx<0)b.vx*=-.3;}
    if(b.x>asp-r){b.x=asp-r;if(b.vx>0)b.vx*=-.3;}
    // the layers: wax into wax. Its middle may go down to 30 % of its radius past a layer's surface (deeper only a soft
    // spring holds it); within reach the layer is thick wax (its motion across the surface is damped, viscous, not
    // bounced); a free bubble close above a layer is drawn into it, gently, so its own warmth still lifts it off again.
    // (Measured from the layer without its ripples: the neck the bubble pulls up must not carry it away.)
    for(const side of [-1,1]){const ys=this._base()._surf.call(this,S,b.x,side),gc=side<0?b.y-ys:ys-b.y;   // the middle's height over the layer
      if(gc<-.3*r){const pen=-.3*r-gc;b.vy-=side*pen*30*h;}
      if(gc<r){const w=1-Math.max(0,gc)/r;b.vy*=1-Math.min(1,h*2.2*w);b.vx*=1-Math.min(1,h*.8*w);}
      if(!fr&&gc>0&&gc<r*2.2)b.vy+=side*.03*h*(1-gc/(r*2.2));}
    b.y=Math.max(r*.2,Math.min(1-r*.2,b.y));
    const sp=Math.hypot(b.vx,b.vy);if(sp>.9){b.vx*=.9/sp;b.vy*=.9/sp;}},
  _waves(S,fs){const n=this.NWV,asp=S.asp,dx=asp/(n-1),c2=.16,K=5,Dp=.8,base=this._base();
    for(const side of [-1,1]){const W=S.wv[side],Fo=new Float32Array(n);
      for(const b of S.B){if(b.bud||b.host||b.melt)continue;const r=b.r,ys=base._surf.call(this,S,b.x,side);   // a melting ball is already slapped (_melt)
        const gap=side<0?(b.y-r)-ys:ys-(b.y+r);if(gap>(b.keep?r*2:.05))continue;
        let press;
        if(b.keep){   // a frog's bubble PULLS the layer up to itself (a neck of wax), harder the closer, ringing as it moves
          const nr=Math.exp(-Math.max(0,gap)/(r*.6));press=-(.2*nr+nr*(Math.abs(b.vy)*.4+Math.abs(b.vx)*.15));}
        else{const near=Math.exp(-Math.max(0,gap)/.015);press=Math.max(0,-gap)*2.5+near*Math.abs(b.vy)*.8+near*Math.abs(b.vx)*.3;}
        const w=Math.max(.035,r*(b.keep?1.1:1.3));for(let i=0;i<n;i++){const k=(i/(n-1)*asp-b.x)/w;Fo[i]+=side*press*Math.exp(-k*k);}}
      let left=Math.min(.1,fs);
      while(left>1e-4){const h=Math.min(.008,left);left-=h;
        for(let i=0;i<n;i++){const l=W.h[Math.max(0,i-1)]+W.h[Math.min(n-1,i+1)]-2*W.h[i];
          W.v[i]+=(c2*l/(dx*dx)-K*W.h[i]-Dp*W.v[i]+Fo[i]*K*.35)*h;}
        for(let i=0;i<n;i++)W.h[i]=Math.max(-.09,Math.min(.09,W.h[i]+W.v[i]*h));}}},
  step(S,st,f,dtMs,asp){const fs=Math.max(.001,dtMs/1000);
    // frogs → bubbles: a frog without one adopts the nearest free bubble, or grows a new one (at most KEEP)
    const on={},A=S.asp!==asp?asp/S.asp:1;
    for(const id in st.pts){const p=st.pts[id];if(!p.on)continue;on[id]=1;S.fr[id]={x:p.x*asp,y:p.y,rgb:p.rgb||[.925,.102,.514]};}
    for(const id in S.fr)if(!on[id])delete S.fr[id];
    for(const b of S.B)if(b.keep&&b.frog!=null&&!on[b.frog])b.frog=null;   // the frog left: its bubble stays, drifting like any wax
    for(const id in on){if(S.B.some(b=>b.keep&&b.frog===id))continue;
      const fr=S.fr[id];let best=null,bd=1e9;
      for(const b of S.B)if(b.keep&&b.frog==null){const d=Math.hypot(b.x*A-fr.x,b.y-fr.y);if(d<bd){bd=d;best=b;}}
      if(best)best.frog=id;
      else if(S.B.filter(b=>b.keep).length<this.KEEP){const b=this._mk(fr.x,fr.y,1e-5,.6);b.keep=true;b.frog=id;S.B.push(b);}}
    this._base().step.call(this,S,st,f,dtMs,asp);
    this._waves(S,fs);},
  // the bubbles first, so the shader's 16 slots never drop one
  upload(gl,u,S){S.B.sort((a,b)=>(b.keep?1:0)-(a.keep?1:0));this._base().upload.call(this,gl,u,S);
    if(u.LB){gl.uniform1fv(u.LB,S.wv["-1"].h);gl.uniform1fv(u.LT,S.wv["1"].h);}}
});

add("lawa-3","Lampa lava","Lampa lava: lampa jak prawdziwa, widziana przez szkło. Wosk jest bryłą w trzech wymiarach: żarówka pod dnem prześwietla go od spodu, więc cienkie brzegi i krople tuż nad kałużą świecą gorącym bursztynem, a grube jądra ciemnieją do głębokiej czerwieni. Kule noszą odbicie okna ze szkła, miękki rąbek i poświatę w cieczy, a ciecz nad żarówką drga jak ciepłe powietrze nad grzejnikiem. Cykl jest spokojny: z kałuży pączkują kule, odrywają się z szyjką, płyną w górę jak grzybki z ogonkiem, stygną, zawisają w pół drogi i opadają długimi łzami do kałuży, która faluje przy każdym dotyku. Żaba to ciepły palec na szkle: wosk w pobliżu grzeje się, unosi i płynie ku niej, barwiąc się jej kolorem. Każda żaba nosi też swój bąbel wosku: płynie za nią, zlewa się z mijanym woskiem i warstwami, a po odejściu żaby zostaje w lampie. Żaba w dolnym lub górnym pasie szybko wyciąga kulę z warstwy. Bas rozgrzewa żarówkę, uderzenie to puknięcie w szkło: wosk drży, a warstwy się marszczą.",1,
`// LAVA LAMP v3 (owner, 2026-10-02: "really mesmerising, like a real lava lamp; look at how the web does it").
// What the web's best lamps do and this one copies: the wax is a 3D SOLID, ray-marched through a signed distance field
// with a smooth minimum (so touching wax melts together with a neck, as in "molten" and the Poiyomi lamp), lit by the
// BULB UNDER THE BASE with wrap lighting, and its THICKNESS is measured along the ray, so thin edges and small drops
// let the bulb's glow through (hot amber) while thick cores stay deep red; Fresnel brightens the rim with the liquid
// behind, the window's reflection sits on the wax as a tall highlight, the liquid carries the bulb's glow (inverse
// square) and warm columns rising from it, a heat shimmer bends the view just above the bulb, the glass darkens towards
// its sides and holds two window stripes, and everything goes through a soft filmic roll-off. The physics is the plain
// lamp's whole cycle plus v2's ripples (PadPlate._bodies["lawa-3"] below), so the uniforms are the same: BL = (x, y,
// radius, warmth) · BD = (squash, wobble, seed) · BC = tint · BV = (stretch velocity, melt, layer) · LP = layer
// thicknesses · LW = swells · LB/LT = ripples. Cost: a cheap 2D distance culls pixels far from any wax; the march uses a
// noise-free SDF and switches to the full one (outline noise) only within .03 of a surface.
uniform vec4 BL[16];uniform vec4 BD[16];uniform vec4 BC[16];uniform vec4 BV[16];uniform int NB;uniform vec4 LP;
uniform vec4 LW[8];uniform int NW;uniform float LB[32];uniform float LT[32];
const float DZ=.3,SK=.05;
// the balls within this pixel's reach (set once per pixel in plate()): the march, the normal, the thickness and the
// colour only ever look at these two or three, not at all sixteen
int L3I[16];int L3C;
// the two layers' surface heights at this pixel's x, computed ONCE per pixel (they depend on x alone, and the ray's x
// drifts by at most .02 through the slab): the march, the normal, the thickness and the colour read these
float HB0,HT0;
const vec3 L3HOT=vec3(1.,.62,.12),L3WAX=vec3(1.,.22,.05),L3COOL=vec3(.92,.1,.36);
float l3W(float x,float asp,float sd){float t=clamp(x/asp,0.,1.)*31.;int i=min(int(t),30);float f=t-float(i);
  return sd<0.?mix(LB[i],LB[i+1],f):mix(LT[i],LT[i+1],f);}
float l3N(vec2 p){vec2 i=floor(p),f=p-i;vec2 u=f*f*f*(f*(f*6.-15.)+10.);ivec2 q=ivec2(i);
  return mix(mix(hI(q),hI(q+ivec2(1,0)),u.x),mix(hI(q+ivec2(0,1)),hI(q+ivec2(1,1)),u.x),u.y);}
float l3Off(float x,float sd){float o=0.;for(int i=0;i<8;i++){if(i>=NW)break;vec4 w=LW[i];if(abs(w.y-sd)>.5)continue;
  float k=(x-w.x)/w.z;o+=w.w*exp(-k*k);}return o;}
float l3Qy(float x,float asp){float q=(x-.5*asp)/(.86*asp);return sqrt(max(.05,1.177-q*q));}
// the two layers' surfaces: the same formulas as _surf in the JS body (_sb/_st + swells + ripples), swaying a little
float l3Hb(float x,float asp){return -.02+LP.x*(.5+l3Qy(x,asp))+l3Off(x,-1.)+l3W(x,asp,-1.)+(l3N(vec2(x*3.,T*.1))-.5)*.02;}
float l3Ht(float x,float asp){return 1.02-LP.y*(.5+l3Qy(x,asp))-l3Off(x,1.)+l3W(x,asp,1.)-(l3N(vec2(x*2.6+5.,T*.08))-.5)*.016;}
float l3Smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
// one ball as a signed distance: squashed along its last impact, drawn out into a drop along its motion (the trailing
// side longer), sagging and widening while it melts, its outline breathing with slow noise when fine is set
float l3Ball(vec3 p,int i,bool fine){vec4 b=BL[i],dd=BD[i];vec2 vv=BV[i].xy;
  float zi=(fract(dd.w*.618+.31)-.5)*.14;                                  // each ball a little nearer or farther
  vec3 d=p-vec3(b.xy,zi);
  float ql=length(dd.xy),m=min(ql,.35);vec2 nq=ql>1e-4?dd.xy/ql:vec2(1.,0.);
  float al=dot(d.xy,nq);d.xy=nq*al/(1.-m)+(d.xy-al*nq)*(1.-.4*m);
  float sp=length(vv);
  if(sp>1e-4){vec2 vd=vv/sp;float s=clamp(sp/.1,0.,1.)*.26;float a=dot(d.xy,vd);vec2 pe=d.xy-a*vd;
    a/=mix(1.+s*1.4,1.+s*.3,smoothstep(-1.4*b.z,1.4*b.z,a));d.xy=vd*a+pe*(1.+.2*s);}   // a wide blend: no crease where the drop's tail begins (owner, 10-02)
  float ml=BV[i].z;if(ml>0.){d.x/=1.+.9*ml;d.y/=1.-.35*ml;}
  float R=b.z*(1.-.92*ml*ml*(3.-2.*ml));                                   // melting: its wax pours into the swell
  if(fine){vec2 nn=d.xy/b.z;
    float nz=l3N(nn*1.05+vec2(dd.w*7.3,T*.13))*.62+l3N(nn*2.1+vec2(T*.19,dd.w*3.1))*.38;
    R*=1.+(.04+.1*dd.z)*(nz-.5)*2.;}
  return (length(d)-R)*.62;}
float l3Map(vec3 p,float asp,bool fine){
  float zz=p.z/DZ,cl=abs(p.z)-DZ;
  float d=min(max((p.y-HB0+.06*zz*zz)*.5,cl),max((HT0-p.y+.06*zz*zz)*.5,cl));
  for(int j=0;j<16;j++){if(j>=L3C)break;d=l3Smin(d,l3Ball(p,L3I[j],fine),SK);}
  return d;}
vec3 l3Nor(vec3 p,float d0,float asp){const float e=.0015;
  return normalize(vec3(l3Map(p+vec3(e,0.,0.),asp,true)-d0,l3Map(p+vec3(0.,e,0.),asp,true)-d0,l3Map(p+vec3(0.,0.,e),asp,true)-d0));}
// the wax colour at a point: every piece of wax weighs in by closeness (the puddle hot, the top layer cool, a ball by
// its warmth and the frog's tint)
vec3 l3Col(vec3 p,float asp){float ws=0.,w;vec3 c=vec3(0.);
  w=exp(-max(p.y-HB0,0.)/SK);ws+=w;c+=w*mix(L3WAX,L3HOT,.5);
  w=exp(-max(HT0-p.y,0.)/SK);ws+=w;c+=w*mix(L3COOL,L3WAX,.45);
  for(int j=0;j<16;j++){if(j>=L3C)break;int i=L3I[j];vec4 b=BL[i];w=exp(-max(l3Ball(p,i,false),0.)/SK*1.5);
    vec3 wc=mix(L3COOL,L3WAX,smoothstep(.1,.6,b.w));wc=mix(wc,L3HOT,smoothstep(.6,1.,b.w)*.45);wc=mix(wc,BC[i].rgb,BC[i].a*.6);
    ws+=w;c+=w*wc;}
  return c/max(ws,1e-4);}
// how far the ray travels inside the wax from the hit (thin → the bulb shines through)
float l3Thick(vec3 p,vec3 rd,float asp){float t=.004;for(int i=0;i<4;i++){float d=l3Map(p+rd*t,asp,false);if(d>0.)break;t+=max(.02,-d);}return t;}
// the halo in the liquid round the wax (bloom without a second pass): a soft sum of gaussians from every surface,
// so it has no edge anywhere; hot wax glows amber, cool wax rose
vec3 l3Halo(vec2 p,float asp){vec3 g=vec3(0.);float d;
  d=max(p.y-HB0,0.);g+=L3HOT*exp(-d*d/.02);
  d=max(HT0-p.y,0.);g+=L3COOL*.6*exp(-d*d/.012);
  for(int i=0;i<16;i++){if(i>=NB)break;vec4 b=BL[i];d=max(length(p-b.xy)-b.z,0.);float w=.08+.6*b.z;
    g+=mix(L3COOL,L3HOT,smoothstep(.2,.9,b.w))*exp(-d*d/(w*w))*(.5+.5*b.z/.08)*(1.-BV[i].z);}
  return g;}
// a cheap 2D distance to any wax (with room for the stretch and the squash): far from it, no march at all
float l3Near(vec2 p,float asp){float m=min(p.y-HB0,HT0-p.y);
  for(int i=0;i<16;i++){if(i>=NB)break;vec4 b=BL[i];m=min(m,length(p-b.xy)-b.z*1.9);}return m;}
vec3 plate(vec2 px,vec2 uv,vec2 r){float asp=r.x/r.y;vec2 p=vec2(uv.x*asp,uv.y);float bulb=.5+.1*BA+.06*LV+.3*LP.z;   // owner, 10-02: the glow follows how much the frogs MOVE, the sound only a little
  // heat shimmer: the view wobbles a little where the warm liquid rises off the bulb
  float sh=(vn(vec2(p.x*3.5,p.y*2.-T*.3))*.65+vn(vec2(p.x*7.+3.,p.y*4.-T*.5))*.35-.5)*.014*bulb*exp(-uv.y*2.2);
  vec3 ro=vec3(p.x+sh,p.y+sh*.5,1.),rd=normalize(vec3((p.x-.5*asp)*.07,(uv.y-.5)*.07,-1.));
  HB0=l3Hb(ro.x,asp);HT0=l3Ht(ro.x,asp);
  // the liquid: dark violet at the top, plum near the base, the bulb's glow and warm columns rising from it
  vec3 liq=mix(vec3(.17,.03,.15),vec3(.025,.015,.12),smoothstep(0.,1.,uv.y));
  vec2 bq=p-vec2(.5*asp,-.3);float bd2=dot(bq,bq);
  liq+=vec3(1.,.5,.12)*bulb*.6/(1.+9.*bd2);
  liq+=vec3(.5,.2,.08)*.22*bulb*(vn(vec2(p.x*2.2+1.,uv.y*1.6-T*.07))*.65+vn(vec2(p.x*4.5+7.,uv.y*3.2-T*.14))*.35)*exp(-uv.y*2.);
  liq+=vec3(1.,.8,.6)*pow(vn(vec2(p.x*70.,(uv.y-T*.015)*70.)),28.)*.4*bulb/(1.+6.*bd2);   // fine specks drifting up
  // the glass: darker towards the sides of the bottle, two window stripes on the left and a faint one on the right
  float ux=(uv.x-.5)*2.;liq*=1.-.5*pow(abs(ux),5.);
  liq+=vec3(1.,.95,.9)*(.045*smoothstep(.06,0.,abs(uv.x-.16))+.025*smoothstep(.04,0.,abs(uv.x-.21))+.018*smoothstep(.05,0.,abs(uv.x-.85)))*(.7+.3*bulb);
  for(int i=0;i<4;i++){if(i>=NP)break;vec2 d=p-vec2(P[i].x*asp,P[i].y);liq+=PC[i]*.14*P[i].z*exp(-dot(d,d)/.014);}   // a warm finger on the glass
  float near=l3Near(p,asp);
  vec3 col=liq;float cov=0.;vec3 wax=vec3(0.);
  if(near<.04){
    L3C=0;for(int i=0;i<16;i++){if(i>=NB)break;vec4 b=BL[i];if(length(p-b.xy)-b.z*2.2<.05){L3I[L3C]=i;L3C++;}}
    float t=(1.-DZ)/(-rd.z),md=1e3,mt=t,dh=0.;bool hit=false;
    for(int i=0;i<32;i++){vec3 q=ro+rd*t;if(q.z<-DZ)break;
      float d=l3Map(q,asp,false);if(d<.03)d=l3Map(q,asp,true);
      if(d<md){md=d;mt=t;}
      if(d<.0012){hit=true;dh=d;break;}
      t+=max(d,.002);}
    float e=1.6/r.y;
    cov=hit?1.:1.-smoothstep(0.,e,md);
    if(cov>0.){vec3 q=ro+rd*(hit?t:mt);vec3 n=l3Nor(q,hit?dh:md,asp),wc=l3Col(q,asp);
      vec3 Lb=vec3(.5*asp,-.3,0.)-q;float bl2=dot(Lb,Lb);Lb/=sqrt(bl2);
      float gl=bulb*1.3/(1.+2.5*bl2);                                        // the bulb's light reaching this spot
      float wrap=clamp(dot(n,Lb)*.5+.5,0.,1.);
      float th=hit?l3Thick(q,rd,asp):.01;
      float sss=min(gl,.9)*(.3+.7*exp(-th*6.));                                     // thin wax lets the glow through
      vec3 Lk=normalize(vec3(-.45,.6,.75));
      float dif=max(dot(n,Lk),0.),spc=pow(max(dot(reflect(rd,n),Lk),0.),4.);
      vec3 Ls=normalize(vec3(.16*asp,q.y+.1,.9)-q);float sps=pow(max(dot(reflect(rd,n),Ls),0.),6.);   // the window, mirrored in the wax
      float fr=pow(1.-max(dot(n,-rd),0.),2.);
      wax=wc*.5+wc*(.7*wrap*gl+.1*dif)+mix(wc,L3HOT,.6)*sss*1.6+fr*(liq*1.6+wc*.3)*.45+mix(wc,vec3(1.),.4)*(spc*.07+sps*.06);
      col=mix(liq,wax,cov);}}
  // the halo in the liquid round the wax (bloom without a second pass): hot below, cool above
  col+=l3Halo(p,asp)*.2*(.5+.5*bulb)*(1.-cov);
  col=1.-exp(-col*1.5);                                                   // soft roll-off...
  float lum=dot(col,vec3(.3,.59,.11));return max(mix(vec3(lum),col,1.35),0.);}   // ...that would wash the colour out: put it back`);
// ---------- LAMPA LAVA v3, the body: the plain lamp's cycle, v2's ripples, a calmer tempo and two new touches ----------
// Inherits lawa-2 WITH its frog bubbles (KEEP 4; owner, 10-02); the frog also pulls a ball out of a layer (PULL, twice as fast) but does not
// shove the wax about (FROG_PUSH off). Instead the frog is a WARM FINGER on the glass: wax within reach warms up (and
// so lifts), is drawn gently towards it and takes its colour; a hit is a TAP on the glass: both layers wrinkle under the
// frogs (or in the middle) and, from the base, every ball quivers. Everything runs at TEMPO of the plain lamp's clock:
// a real lamp is slow, and the slowness is most of the spell.
PadPlate._bodies["lawa-3"]=Object.assign(Object.create(PadPlate._bodies["lawa-2"]),{
  KEEP:4,PULL:true,FROG_PUSH:false,TEMPO:.8,HEATR:.24,PULLRATE:.0048,   // v2's frog bubbles stay (owner, 10-02), the frog pulls balls out twice as fast
  _b2(){return PadPlate._bodies["lawa-2"];},
  step(S,st,f,dtMs,asp){const dt=dtMs*this.TEMPO,fs=Math.max(.001,dt/1000);
    this._b2().step.call(this,S,st,f,dt,asp);
    // how much the frogs move (0..1, fast up, ~1 s down): the shader's bulb glows with it (LP.z), not with the loudness
    {let v=0;const pv=S.frPrev||(S.frPrev={});for(const id in S.fr){const q=S.fr[id],o=pv[id];if(o)v=Math.max(v,Math.hypot(q.x-o.x,q.y-o.y)/Math.max(.001,dtMs/1000));pv[id]={x:q.x,y:q.y};}
      for(const id in pv)if(!S.fr[id])delete pv[id];const tg=Math.min(1,v/1.2);S.mot=(S.mot||0)+(tg-(S.mot||0))*(tg>(S.mot||0)?Math.min(1,fs*8):Math.min(1,fs*1.2));}
    S.kickT=Math.max(0,(S.kickT||0)-fs);
    if(f.ki>.5&&!S.kickT){S.kickT=.3;const F=Object.values(S.fr),xs=F.length?F.map(q=>q.x):[asp*.5];
      for(const x of xs)for(const side of [-1,1])this._slap(S,x,side,.06,.12*Math.min(1,f.ki));}
    for(const id in S.fr){const fr=S.fr[id],g=.4+.8*Math.min(1,f.lv);
      for(const b of S.B){if(b.bud||b.melt||b.host||b.keep)continue;   // the frog's own bubble rides the spring, not the heat
        const dx=fr.x-b.x,dy=fr.y-b.y,d=Math.hypot(dx,dy),R=this.HEATR+b.r;if(d>R)continue;
        const w=1-d/R,n=Math.max(d,1e-3);
        b.warm=Math.min(1,b.warm+fs*.5*w*g);
        b.vx+=dx/n*fs*.02*w*g;b.vy+=dy/n*fs*.012*w*g;
        const c=Math.min(1,fs*.8*w);b.tr+=(fr.rgb[0]-b.tr)*c;b.tg+=(fr.rgb[1]-b.tg)*c;b.tb+=(fr.rgb[2]-b.tb)*c;b.ta=Math.min(1,b.ta+fs*w*.9);}}},
  upload(gl,u,S){this._b2().upload.call(this,gl,u,S);if(u.LP)gl.uniform4f(u.LP,this._hb(S),this._ht(S),S.mot||0,0);}
});

// ---------- RAMPA (shown as "Deskorolka") — an old kidney-shaped skate pool seen from above, raymarched in 3D ----------
// Owner, 2026-10-01 (rounds 1–4): a board in a pool seen from above, 3D; it follows the frog, never rides by itself;
// tricks by the power of the pop; grinding along the coping; the whole pool in view; stickers under the deck.
// Round 5 (owner, 2026-10-01: "the levels and ramps inside only get in the way, the ramp's shape is fine; add engaging
// mechanics and animations to the tricks and the steering"): one depth, a clean floor (no hump, no kicker), and a game:
// a new note or a quick flick of the frog POPS the board, the trick read from how the frog moves at that moment; circling
// the frog in the air adds spin; landing straight scores, crooked is a bail; tricks in a row build a combo (points,
// a record, a streak in the combo's colour); trick names pop up on the pad's 2D canvas (hud(), called from rf-22/rf-27).
// The pool is built in its own units (the coping's outline spans about ±0.98 × ±0.62) and scaled by SC to fit the pad
// whatever its shape (SC = min(.94, 1.45·Y), Y = half the view's height at the coping): every length, depth and the
// board scale together, so the whole pool and a strip of deck are always in the frame.
// Geometry (shared with the JS physics below, keep them in step): coping and deck at z = 0. The floor's outline in plan
// is a kidney (rkE): a round lobe on the left, a smaller one on the right, joined by a body and pinched by a notch from
// the top; the floor is flat at depth RD. The wall is a quarter ELLIPSE from the floor edge (u = 0, z = -RD) to the
// coping (u = RT, z = 0) with a vertical tangent there. The camera hangs SKH above the coping.
// BL[0] = board centre + flip · BL[1] = nose + spin · BL[2] = deck normal + grind (0/1) · BL[3] = (Y, speed for the
// sparks, grind direction, pitch) · BD[0..7] = the streak behind the board (xyz, strength), head first · BC[0] = landing
// (xyz, age; age < 0 = none) · BC[1] = (landing strength, bail, clean, -) · BC[2] = take-off (xyz, age) · BC[3] = (heat,
// flash, combo tier 0 pink / 1 amber / 2 lime, -). All in world units.
add("rampa","Deskorolka","Stary, pusty basen do jazdy na deskorolce w kształcie nerki, widziany z góry w 3D, cały w kadrze, z gładkim dnem, graffiti, pęknięciami i śladami kół. Deska jedzie za żabą, czuje grawitację i pochyla się w zakrętach. Każda nowa nuta albo szybkie machnięcie żabą to wyskok, a trik zależy od kierunku ruchu żaby w tej chwili: w miejscu ollie, do przodu kickflip, do tyłu heelflip, w bok shove-it w jedną albo drugą stronę, a po skosie varial, hardflip albo inward heelflip; szybciej wychodzą podwójne, 360 flip i laser flip. Druga nuta w powietrzu dokłada trik spóźniony (late flip, late shove-it, impossible), a przy nieruchomej żabie łapie deskę: nosegrab, tailgrab, indy, melon, a w wysokim locie method i stalefish. Kickflip, a w locie druga nuta z żabą dalej pędzącą do przodu, to RibbitFlip: deska robi jeszcze jeden flip i salto jak skacząca żaba. To najwyżej punktowany trik, ogłaszany wielkim komiksowym wybuchem. Krążenie żabą wokół deski dokręca obrót. Wylądujesz prosto, trik się liczy; krzywo, to gleba i koniec kombinacji. Na krawędzi deska grinduje albo ślizga się, zależnie od kąta wjazdu i miejsca żaby: 50-50, 5-0, nosegrind, smith, feeble, crooked, boardslide i lipslide; przesuwając żabę zmieniasz grind w trakcie. Triki składają się w kombo z punktami i rekordem, wynik jest w lewym górnym rogu. Pod spodem deski są naklejki z żabą, liściem lilii i gwiazdką. Bez żaby deska stacza się na dno.",0,
`// Up to FOUR boards (owner, 10-02: "with several capsules every frog should have its own board and its own score"):
// board k lives in BL[4k..4k+3], BD[8k..8k+7], BC[4k..4k+3], BK[k] = its frog's colour (deck art, streak) + whether a frog rides it.
uniform vec4 BL[16];uniform vec4 BD[32];uniform vec4 BC[16];uniform vec4 BK[4];uniform int NB;
const float RT=.26,RD=.46,SKH=3.1,SKF=3.1,SKB0=.5;
vec3 SKP[4],SKFW[4],SKN[4],SKSI[4];mat2 SKR[4],SKRR[4],SKRP[4];float SKQZ,SKY,SKC,SKB;int SKK;
float rkSmin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float rkRR(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
// pool units from here to skRamp()
float rkE(vec2 p){float a=length(p-vec2(-.36,0.))-.36,b=length(p-vec2(.42,-.02))-.3,r=rkRR(p-vec2(0.,-.04),vec2(.4,.2),.2);
  float s=rkSmin(rkSmin(a,b,.12),r,.12);float c=length(p-vec2(.06,.5))-.26;return -rkSmin(-s,c,.12);}
float skRampL(vec3 p){float u=rkE(p.xy),z=p.z;
  if(z>0.)return (u>=RT?z:length(vec2(u-RT,z)))*.9;
  if(u>=RT)return max(RT-u,z);
  if(u>0.)return (1.-length(vec2(u/RT,z/RD)))*min(RT,RD)*.85;
  return min((z+RD)*.9,max(-u,(1.-length(vec2(u/RT,z/RD)))*min(RT,RD)));}
float skRamp(vec3 p){return skRampL(p/SKC)*SKC;}
vec3 skLocal(vec3 p,int k){vec3 d=p-SKP[k];vec3 q=vec3(dot(d,SKFW[k]),dot(d,SKSI[k]),dot(d,SKN[k]));q.xz=SKRP[k]*q.xz;q.yz=SKRR[k]*q.yz;q.xy=SKR[k]*q.xy;return q/SKB;}
float skBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
float skBoard(vec3 q,out float id){
  vec3 d=q;float tl=max(abs(d.x)-.125,0.);d.z-=tl*tl*2.4;
  vec2 s=vec2(max(abs(d.x)-.155,0.),d.y);float dd=max(length(s)-.056,abs(d.z)-.0075)-.002;
  float dt=skBox(q-vec3(sign(q.x)*.12,0.,-.024),vec3(.013,.044,.011))-.003;
  vec3 w=q;w.x=abs(w.x)-.12;w.y=abs(w.y)-.052;w.z+=.04;
  float dw=max(length(w.xz)-.021,abs(w.y)-.012)-.002;
  id=0.;float r=dd;if(dt<r){r=dt;id=1.;}if(dw<r){r=dw;id=2.;}
  SKQZ=d.z;return r;}
// the nearest of the boards; SKK = which one (its colour), SKQZ = the deck side at the hit
float skBoardW(vec3 p,out float id){id=0.;float best=1e9,qz=0.;
  for(int k=0;k<4;k++){if(k>=NB)break;float bs=length(p-SKP[k])-.27*SKB,d,ik=0.;
    if(bs>.04)d=bs;else d=skBoard(skLocal(p,k),ik)*SKB*.8;
    if(d<best){best=d;id=ik;SKK=k;qz=SKQZ;}}
  SKQZ=qz;return best;}
float skMap(vec3 p,out float id){float b=skBoardW(p,id),r=skRamp(p);if(r<b){id=-1.;return r;}return b;}
// the board for the soft shadow: its true shape within .15 of its bounding sphere. The march's own skBoardW returns the
// sphere's distance until .04 from it, which cut the penumbra off along the sphere: in the air the shadow had a hard
// round edge (owner, 10-02: "a weird shadow with circles round it"). Beyond .15 the penumbra 10·d/t is ≥ 1 anyway.
float skBoardS(vec3 p){float best=1e9;for(int k=0;k<4;k++){if(k>=NB)break;float bs=length(p-SKP[k])-.27*SKB,d;
    if(bs>.15)d=bs;else{float bi,w=1.-smoothstep(.08,.15,bs);d=mix(bs,skBoard(skLocal(p,k),bi)*SKB*.8,w);}   // blended into the sphere: no step
    best=min(best,d);}return best;}
vec3 skNorm(vec3 p){float i;const vec2 e=vec2(.0008,-.0008);
  return normalize(e.xyy*skMap(p+e.xyy,i)+e.yyx*skMap(p+e.yyx,i)+e.yxy*skMap(p+e.yxy,i)+e.xxx*skMap(p+e.xxx,i));}
float rkCell(vec2 p){vec2 i=floor(p),f=p-i;float d1=9.,d2=9.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y);vec2 o=vec2(hI(ivec2(i+g)),hI(ivec2(i+g)+ivec2(17,31)));
    float d=length(g+o-f);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
  return d2-d1;}
float sdStar5(vec2 p,float r,float rf){const vec2 k1=vec2(.809017,-.587785),k2=vec2(-.809017,-.587785);
  p.x=abs(p.x);p-=2.*max(dot(k1,p),0.)*k1;p-=2.*max(dot(k2,p),0.)*k2;p.x=abs(p.x);p.y-=r;
  vec2 ba=rf*vec2(-k1.y,k1.x)-vec2(0.,1.);float h=clamp(dot(p,ba)/dot(ba,ba),0.,r);return length(p-ba*h)*sign(p.y*ba.x-p.x*ba.y);}
// three stickers under the deck between the trucks, each with a white vinyl border: the frog, a lily pad, a star
// (board units; each drawn at its own scale ×.8, so aa grows to match)
vec3 skStickers(vec2 q,vec3 c){float aa=.002;
  vec2 a=rot(.25)*(q-vec2(-.072,.003))/.8;
  float hd=length(a*vec2(1.,1.12))-.029,e1=length(a-vec2(.02,.017))-.012,e2=length(a-vec2(.02,-.017))-.012,fg=min(hd,min(e1,e2));
  c=mix(c,vec3(.97),smoothstep(aa,-aa,fg-.0055));c=mix(c,GREEN,smoothstep(aa,-aa,fg));
  c=mix(c,vec3(.97),smoothstep(aa,-aa,min(e1,e2)+.0035));
  c=mix(c,INK,smoothstep(aa,-aa,min(length(a-vec2(.022,.017)),length(a-vec2(.022,-.017)))-.0048));
  float mo=max(abs(length(a-vec2(.01,0.))-.019)-.0017,a.x+.002);c=mix(c,INK,smoothstep(aa,-aa,mo));
  c=mix(c,PINK*1.1,smoothstep(aa,-aa,min(length(a-vec2(-.004,.02)),length(a-vec2(-.004,-.02)))-.0045)*.8);
  vec2 b=rot(-.5)*(q-vec2(.0,-.004))/.8;float lp=length(b)-.031;
  bool notch=abs(b.y)<b.x*.42&&b.x>0.;
  c=mix(c,vec3(.97),smoothstep(aa,-aa,lp-.0055));
  if(!notch){c=mix(c,mix(GREEN*.75,LIME,.5+.5*b.y/.031),smoothstep(aa,-aa,lp));
    float an=atan(b.y,b.x),vein=abs(fract(an/6.2832*7.+.5)-.5)*length(b)*6.2832/7.;
    c=mix(c,GREEN*.55,smoothstep(.0012,.0,vein)*step(lp,0.)*step(.004,length(b)));}
  vec2 sq=rot(.3)*(q-vec2(.072,.002))/.8;float st=sdStar5(sq,.03,.45);
  c=mix(c,vec3(.97),smoothstep(aa,-aa,st-.0055));c=mix(c,AMBER,smoothstep(aa,-aa,st));
  c=mix(c,vec3(1.,.95,.75),smoothstep(aa,-aa,length(sq-vec2(-.006,.008))-.004)*step(st,0.));
  return c;}
// world point → the view's isotropic screen coordinates (the same frame as sc in plate())
vec2 skScr(vec3 w){return w.xy*SKF/(SKH-w.z);}
vec3 skTier(float t){return t<.5?PINK:(t<1.5?AMBER:LIME);}
vec3 plate(vec2 px,vec2 uv,vec2 r){float asp=r.x/r.y;
  SKY=1./asp;SKC=min(.94,1.45*SKY);SKB=SKB0*SKC;
  SKK=0;for(int k=0;k<4;k++){if(k>=NB)break;SKP[k]=BL[4*k].xyz;SKFW[k]=normalize(BL[4*k+1].xyz);SKN[k]=normalize(BL[4*k+2].xyz);
    SKSI[k]=cross(SKN[k],SKFW[k]);SKRR[k]=rot(-BL[4*k].w);SKR[k]=rot(-BL[4*k+1].w);SKRP[k]=rot(BL[4*k+3].w);}
  vec2 sc=vec2((uv.x-.5)*2.,(uv.y-.5)*2./asp);
  vec3 ro=vec3(0.,0.,SKH),rd=normalize(vec3(sc,-SKF));
  float t=0.,id=-1.;
  for(int i=0;i<170;i++){vec3 p=ro+rd*t;float d=skMap(p,id);if(d<.0006*t)break;t+=d;if(t>5.)break;}
  vec3 p=ro+rd*t,n=skNorm(p);skMap(p,id);float qz=SKQZ;
  vec3 L=normalize(vec3(-.6,.34,.72));
  float dif=max(dot(n,L),0.);
  // the bowl glows with the hottest combo of all the boards
  float heat=0.,flash=0.;int hk=0;for(int k=0;k<4;k++){if(k>=NB)break;if(BC[4*k+3].x>heat){heat=BC[4*k+3].x;hk=k;}flash=max(flash,BC[4*k+3].y);}
  vec3 tc=skTier(NB>0?BC[4*hk+3].z:0.);
  // THE BOARD'S SHADOW (owner, 10-02: "in the air it casts a weird shadow with wheels round it"): cast from a light
  // nearly overhead (the scene's own light is low, so seen from above the shadow slid far off the board and read as a
  // second, black object with the wheels sticking out), with a soft-shadow estimate on a board distance that blends smoothly into its bounding sphere (a step
  // there drew a dark half-disc beside the board), sharp at the contact, spreading and fading as the board rises), and it takes at most about half the light, never a hole.
  float sh=1.;if(id<0.){vec3 Ls=normalize(vec3(-.28,.18,.94));float tt=.01,tm=0.;
    for(int i=0;i<40;i++){float d=skBoardS(p+Ls*tt),s=14.*d/tt;if(s<sh){sh=s;tm=tt;}tt+=clamp(d,.004,.06);if(tt>1.4)break;}
    sh=clamp(sh,0.,1.);sh=sh*sh*(3.-2.*sh);sh=mix(sh,1.,.45+.4*smoothstep(.05,.6,tm));}
  vec3 col;
  if(id<0.){vec3 pl=p/SKC;float u=rkE(pl.xy);
    vec2 ge=vec2(rkE(pl.xy+vec2(.002,0.))-u,rkE(pl.xy+vec2(0.,.002))-u);vec2 tg=normalize(vec2(-ge.y,ge.x)+1e-6);
    float along=dot(pl.xy,tg);
    // old poured concrete: blotchy, stained by water that ran to the low corner
    float bl=vn(pl.xy*3.1)*.5+vn(pl.xy*9.)*.3+vn(pl.xy*31.)*.2;
    vec3 conc=vec3(.78,.76,.72)*(.76+.32*bl);
    conc*=1.-.22*smoothstep(.55,.9,vn(pl.xy*1.7+3.))*step(u,0.)*smoothstep(.1,-.3,pl.x);
    // graffiti: spray tags in brand colours, worn through in patches; a hot combo makes them glow
    float zone=smoothstep(.42,.6,vn(pl.xy*1.3+11.));
    float tagN=vn(pl.xy*7.)*.7+vn(pl.xy*19.)*.3;
    float stroke=(1.-smoothstep(.0,.06,abs(tagN-.5)))*zone;
    float fill=smoothstep(.56,.6,vn(pl.xy*4.+7.))*smoothstep(.4,.6,vn(pl.xy*1.1+2.));
    float wear=smoothstep(.35,.7,vn(pl.xy*22.+5.));
    vec3 tagC=hI(ivec2(floor(pl.xy*1.3+11.)))>.5?PINK:(hI(ivec2(floor(pl.xy*1.3+4.)))>.5?LIME:AMBER);
    conc=mix(conc,tagC*(.8+.2*bl)*(1.+.5*heat),fill*(.75+.2*heat)*wear);
    conc=mix(conc,INK*1.3,stroke*.8*wear);
    float ck=rkCell(pl.xy*5.5);conc*=1.-.3*(1.-smoothstep(.0,.02,ck))*smoothstep(.72,.9,vn(pl.xy*2.+9.));
    // wheel and rubber marks along the wall, thickest where everybody carves
    if(u>0.&&u<RT){float s=vn(vec2(along*36.,u*5.))*vn(vec2(along*9.,u*2.+3.));
      conc*=1.-.45*smoothstep(.25,.55,s)*smoothstep(.1*RT,.6*RT,u);}
    if(u<0.){
      // the painted brand line across the floor, mostly worn away, listening to the spectrum (and the combo)
      float sp=specS(clamp(.5+pl.y,0.,1.));float stripe=smoothstep(.045,.03,abs(pl.x-.62+.05*sin(pl.y*5.)));
      conc=mix(conc,mix(LIME,PINK,sp),stripe*(.25+.5*sp+.3*heat)*wear);}
    // a band of pool tiles under the coping, some knocked out
    float tz=-pl.z;
    if(u>0.&&u<RT+.01&&tz<.05){vec2 tc2=vec2(along*9.,tz*22.);
      vec2 fw2=max(fwidth(tc2),1e-4),de=(.5-abs(fract(tc2)-.5))/fw2;
      float gr=(1.-smoothstep(.5,1.5,min(de.x,de.y)))*(1.-smoothstep(.25,.6,max(fw2.x,fw2.y)));
      float hh=hI(ivec2(floor(tc2)));
      vec3 tile=mix(PEN,vec3(.33,.58,.82),.35+.4*hh)*(.75+.25*bl);
      tile=mix(tile,conc*.8,step(.86,hh));
      conc=mix(tile,vec3(.55,.53,.5),gr*.6);}
    // the deck: cracked dark asphalt, a faded amber line
    if(u>RT+.012){conc=vec3(.36,.35,.34)*(.8+.3*bl);conc*=1.-.35*(1.-smoothstep(.0,.02,rkCell(pl.xy*4.)))*smoothstep(.55,.8,vn(pl.xy*1.6+4.));
      conc=mix(conc,AMBER*(.7+.3*wear),smoothstep(.016,.008,abs(u-RT-.07))*wear);}
    float ao=mix(.42,1.,smoothstep(-RD,-.05,pl.z));
    col=conc*(.24+.92*dif*sh)*ao;
    // the coping: concrete blocks, chipped and blackened by grinds; they ring on a hit and glow with the combo
    float cp=smoothstep(.026,.0,length(vec2(u-RT,pl.z)));
    float blk=step(.05,fract(along*6.));
    float gm=smoothstep(.4,.75,vn(vec2(along*18.,1.)));
    vec3 cc=vec3(.86,.84,.8)*(.55+.6*dif)*(.82+.18*blk);cc=mix(cc,INK*1.4,gm*.7);
    cc+=tc*heat*(.25+.5*BA)*(.6+.4*sin(along*40.-T*6.));
    col=mix(col,cc+vec3(.3)*KI,cp);
  }else{
    vec3 V=-rd,H=normalize(L+V);float spc=pow(max(dot(n,H),0.),40.);
    if(id<.5){vec3 q=skLocal(p,SKK);
      float edge=smoothstep(.0045,.0065,abs(qz));
      vec3 grip=INK*(1.1+.5*hI(ivec2(floor(px*.8))));
      // the underside: a pink deck with a lime stripe at the tail, three stickers
      vec3 bc=BK[SKK].rgb;vec3 art=mix(bc*.92,bc*1.08,smoothstep(-.2,.2,q.x));   // the deck in its frog's colourart=mix(art,LIME,smoothstep(.006,.003,abs(q.x+.165))*.9);
      art=skStickers(q.xy,art);
      vec3 deck=qz>0.?grip:art;
      col=mix(KRAFT*1.1,deck,edge)*(.35+.75*dif)+vec3(1.)*spc*(qz>0.?.08:.35);
    }else if(id<1.5){col=vec3(.62,.64,.68)*(.35+.8*dif)+vec3(1.)*spc*.9;}
    else{col=LIME*(.4+.75*dif)+vec3(1.)*spc*.5;}
  }
  if(NB>0&&id<0.)for(int k=0;k<4;k++){if(k>=NB)break;   // all of it lies on the concrete, under each board
    vec3 kc=mix(BK[k].rgb,vec3(1.),.35),kt=skTier(BC[4*k+3].z);
    // landing dust: a ring of concrete dust kicked out under the board, a coloured shock ring on a clean landing
    float ag=BC[4*k].w;
    if(ag>=0.&&ag<.9){vec2 c0=skScr(BC[4*k].xyz);float s0=SKF/(SKH-BC[4*k].z)*SKC,st=BC[4*k+1].x;
      vec2 dv=sc-c0;float d=length(dv),an=atan(dv.y,dv.x);
      float rr=s0*(.02+(.035+.05*st)*(1.-exp(-ag*6.))),w=s0*(.01+.025*ag);
      float puff=.55+.9*vn(vec2(an*2.6+BC[4*k].x*40.,ag*3.));
      float ring=exp(-(d-rr)*(d-rr)/(w*w))*puff+exp(-d*d/(rr*rr*.5))*.5*exp(-ag*8.);
      float a=ring*(.3+.45*st+.35*BC[4*k+1].y)*pow(1.-ag/.9,2.);
      col=mix(col,vec3(.9,.87,.82),clamp(a,0.,.85));
      if(BC[4*k+1].z>.5){float r2=rr*1.3+s0*.015;col+=kt*exp(-(d-r2)*(d-r2)/(s0*s0*.00012))*(1.-ag/.9)*.9;}}
    // take-off: a quick puff where the tail snapped
    float ap=BC[4*k+2].w;
    if(ap>=0.&&ap<.4){vec2 c1=skScr(BC[4*k+2].xyz);float s1=SKF/(SKH-BC[4*k+2].z)*SKC;float d=length(sc-c1),rr=s1*(.02+.05*(1.-exp(-ap*10.)));
      col=mix(col,vec3(.92,.9,.86),clamp(exp(-(d-rr)*(d-rr)/(s1*s1*.00015))*(1.-ap/.4)*.7,0.,.8));}
    // the streak: a soft light trail in the combo's colour, from the board's head to its tail
    float tr=0.;vec2 a=skScr(BD[8*k].xyz);
    for(int i=1;i<8;i++){vec2 b=skScr(BD[8*k+i].xyz);vec2 pa=sc-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-9),0.,1.);
      float kq=(float(i-1)+h)/7.,wt=mix(BD[8*k+i-1].w,BD[8*k+i].w,h)*smoothstep(0.,.16,kq)*(1.-kq);
      vec2 dd=pa-ba*h;float w=.014*SKC*(1.-.55*kq);tr=max(tr,wt*exp(-dot(dd,dd)/(w*w)));a=b;}
    col=col*(1.-.25*tr)+kc*tr*.9;}   // the streak in the frog's own colour
  // grind sparks: hot specks thrown off behind the trucks, projected to the screen
  for(int kb=0;kb<4;kb++){if(kb>=NB)break;if(BL[4*kb+2].w<.5)continue;float sp=clamp(BL[4*kb+3].y,0.,2.);
    for(int k=0;k<10;k++){float fk=float(k),cyc=floor(T*24.+fk*.37);
      float h1v=hI(ivec2(int(cyc),k)),h2v=hI(ivec2(k,int(cyc)+7)),age=fract(T*24.+fk*.37);
      vec3 w=SKP[kb]-SKN[kb]*.05*SKB+SKFW[kb]*((h1v-.5)*.2*SKB)+(-SKFW[kb]*sign(BL[4*kb+3].z+1e-3)*age*.12*(.4+sp)+vec3((h2v-.5)*.08,(h1v-.5)*.06,.04*age))*SKC;
      vec2 s2=w.xy*SKF/(SKH-w.z);vec2 dd=(sc-s2)*vec2(1.,asp);
      bool wd=BL[4*kb+2].w>1.5;   // a slide throws wood chips, a truck grind hot sparks
      col+=mix(wd?KRAFT*1.3:vec3(1.,.95,.7),wd?KRAFT*.6:AMBER,age)*exp(-dot(dd,dd)*2500.)*(1.-age)*(wd?.8:1.8);}}
  col*=.86+.14*smoothstep(1.5,.3,length(sc*vec2(1.,asp)));
  col*=1.+.16*flash;
  return col;}`);

// The board's physics, in POOL units (world = pool × SC), on the surface z(x, y) = the same kidney, depth and elliptic
// wall as the shader. On the ground it is a bead on a height field: the exact plan acceleration
// a = -(G + vᵀHv)·∇z / (1 + |∇z|²), where vᵀHv is the height's curvature along the motion (a second difference), so it
// keeps its energy through the bowl. When G + vᵀHv < 0 the ground falls away faster than gravity can follow (the coping
// taken from the deck) and it FLIES: a real ballistic arc in 3D, landing where the arc meets the surface, its velocity
// projected on the landing slope, the normal part absorbed by the trucks (a damped spring that bends the board down and
// back). At the coping: straight at it with speed → it pops up the vert into a trick picked by the pop; along it at an
// angle → a grind; slow → it stalls and falls back. The frog is a loose leash (a soft spring, ground only) that the
// board carves after, leaning into the turn.
// THE GAME (round 5): a pop = a new note on the pad (f.lastHit) or a flick of the frog (its speed crossing FLICK). On the
// ground it is an ollie whose trick is read from the frog's motion in the board's frame (_popTrick); on the coping it
// pops the board out of the grind. In the air the frog circling the board spins it (angular speed of the frog around
// the board). At touchdown the pose decides: spin within ±35° of a half turn and flip within ±50° of a full turn = a
// clean landing (the rest eases out), anything else = a bail (the board skids crooked and wobbles, the combo is lost).
// Clean tricks stack into a combo; 1.5 s rolling without a trick banks it: points × tricks.
PadPlate._bodies.rampa={
  RT:.26,RD:.46,H:3.1,F:3.1,B:.5,G:3.2,FLICK:3.6,BIG:4.5,_best:0,
  _smin(a,b,k){const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;},
  _rr(x,y,bx,by,r){const qx=Math.abs(x)-bx+r,qy=Math.abs(y)-by+r;return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r;},
  sc(S){return Math.min(.94,1.45*S.Y);},
  e(x,y){const a=Math.hypot(x+.36,y)-.36,b=Math.hypot(x-.42,y+.02)-.3,r=this._rr(x,y+.04,.4,.2,.2);
    const s=this._smin(this._smin(a,b,.12),r,.12),c=Math.hypot(x-.06,y-.5)-.26;return -this._smin(-s,c,.12);},
  z(x,y){const u=this.e(x,y),RT=this.RT;if(u>=RT)return Math.min(.15,u-RT)*.03;      // the deck leans gently to the pool
    if(u<=0)return -this.RD;
    const k=u/RT;return -this.RD*Math.sqrt(Math.max(0,1-k*k));},
  gz(x,y){const k=1e-3;return [(this.z(x+k,y)-this.z(x-k,y))/(2*k),(this.z(x,y+k)-this.z(x,y-k))/(2*k)];},
  nrm(x,y){const k=1e-3,gx=this.e(x+k,y)-this.e(x-k,y),gy=this.e(x,y+k)-this.e(x,y-k),l=Math.hypot(gx,gy)||1;return [gx/l,gy/l];},
  sn(x,y){const g=this.gz(x,y),l=Math.hypot(g[0],g[1],1);return [-g[0]/l,-g[1]/l,1/l];},
  // out of the coping: the trick by the pop's power
  _trick(p){const P=Math.PI;
    if(p<.6)return {flip:0,spin:0,name:"air",pts:75};
    if(p<.85)return {flip:0,spin:P,name:"180",pts:120};
    if(p<1.1)return {flip:2*P,spin:0,name:"kickflip",pts:150};
    if(p<1.35)return {flip:2*P,spin:P,name:"varial kickflip",pts:250};
    if(p<1.65)return {flip:2*P,spin:2*P,name:"360 flip",pts:400};
    return {flip:4*P,spin:3*P,name:"double kickflip 540",pts:600};},
  // on the ground: the trick by the direction the frog moves at the pop, in the board's frame, in eight sectors
  // (forward, forward-left, left, back-left, back, back-right, right, forward-right; left = side > 0); a frog faster
  // than BIG gets the bigger version. Flip and spin in half turns (flip ×π, spin ×π; spin < 0 = turning left).
  _POP:[["kickflip",2,0,150,"double kickflip",4,0,350],["varial kickflip",2,-1,250,"360 flip",2,-2,400],
    ["pop shove-it",0,-1,100,"360 shove-it",0,-2,200],["inward heelflip",-2,-1,270,"laser flip",-2,-2,480],
    ["heelflip",-2,0,150,"double heelflip",-4,0,350],["varial heelflip",-2,1,260,"360 heelflip",-2,2,420],
    ["frontside shove-it",0,1,110,"360 frontside shove-it",0,2,220],["hardflip",2,1,280,"360 hardflip",2,2,450]],
  _sector(fwd,side){const i=Math.round(Math.atan2(side,fwd)/(Math.PI/4));return ((i%8)+8)%8;},
  _popTrick(fwd,side,v){const P=Math.PI;if(v<.35)return {flip:0,spin:0,name:"ollie",pts:50};
    const r=this._POP[this._sector(fwd,side)],b=v>this.BIG;
    return {name:b?r[4]:r[0],flip:(b?r[5]:r[1])*P,spin:(b?r[6]:r[2])*P,pts:b?r[7]:r[3]};},
  // a second pop IN THE AIR: a moving frog adds a late trick on top (by its direction), a still frog grabs the board
  // (by where the frog is around the board; a big air turns indy into method and melon into stalefish)
  // THE RIBBITFLIP (owner, 2026-10-02: "one of the tricks is called RibbitFlip, the highest-scoring one, and it
  // stands out like POW in a comic"): a kickflip, and while it is still in the air the frog hops forward again, so a
  // late kickflip on a kickflip — the board does one more flip AND a full somersault, like a frog's jump. It replaces
  // the whole trick's name and points (1500 base; the next best, a coping 540 with a late impossible, is 900).
  _ribbit(){const P=Math.PI;return {name:"RibbitFlip",flip:2*P,spin:0,pr:2*P,pts:1500,ribbit:true};},
  _late(fwd,side){const P=Math.PI,i=this._sector(fwd,side);
    if(i===0)return {name:"late kickflip",flip:2*P,spin:0,pr:0,pts:180};
    if(i===4)return {name:"late heelflip",flip:-2*P,spin:0,pr:0,pts:180};
    if(i===2)return {name:"late shove-it",flip:0,spin:-P,pr:0,pts:150};
    if(i===6)return {name:"late frontside shove-it",flip:0,spin:P,pr:0,pts:160};
    if(i===1||i===7)return {name:"impossible",flip:0,spin:0,pr:2*P,pts:300};
    return {name:"late varial heelflip",flip:-2*P,spin:i===3?-P:P,pr:0,pts:260};},
  _grab(f,s,big){if(Math.abs(f)>Math.abs(s))return f>0?{k:"nosegrab",p:.45,r:0}:{k:"tailgrab",p:-.45,r:0};
    return s>0?(big?{k:"method",p:.15,r:.85}:{k:"indy",p:0,r:.55}):(big?{k:"stalefish",p:-.15,r:-.85}:{k:"melon",p:0,r:-.55});},
  // GRINDS AND SLIDES on the coping. Pose: p = pitch (nose up > 0), r = roll (the pool side down > 0), y = yaw (the
  // nose towards the pool > 0), s = 1 for a slide (the deck, not the trucks, on the coping). Truck grinds come in at a
  // shallow angle, slides at a steep one; WHICH grind is where the frog is around the board (ahead / behind / in the
  // pool / over the deck), and moving the frog mid-grind switches it, each switch a trick of its own.
  _GR:{"50-50":{p:0,r:0,y:0,s:0,pts:50},"5-0":{p:.2,r:0,y:0,s:0,pts:80},"nosegrind":{p:-.2,r:0,y:0,s:0,pts:90},
    "smith grind":{p:0,r:.45,y:-.15,s:0,pts:120},"feeble grind":{p:0,r:-.3,y:-.25,s:0,pts:120},
    "crooked grind":{p:-.18,r:.15,y:.35,s:0,pts:150},"boardslide":{p:-.42,r:0,y:Math.PI/2,s:1,pts:100},
    "lipslide":{p:.42,r:0,y:-Math.PI/2,s:1,pts:120}},
  _grindKind(S,g,fr,tx,ty){const n=this.nrm(S.x,S.y),t=[-n[1]*g.dir,n[0]*g.dir],rx=fr?tx-S.x:0,ry=fr?ty-S.y:0;
    const a=rx*t[0]+ry*t[1],b=-(rx*n[0]+ry*n[1]);
    if(g.slide)return b>=0?"boardslide":"lipslide";
    if(Math.hypot(a,b)<.15)return "50-50";
    if(g.v>1.5&&a>0&&b>0)return "crooked grind";
    return Math.abs(a)>=Math.abs(b)?(a>0?"nosegrind":"5-0"):(b>0?"smith grind":"feeble grind");},
  // ONE BOARD's state (the physics below runs on it); the body's state W holds up to four of them (bs), one per frog
  _mkBoard(asp){const S={x:-.36,y:0,z:0,vx:0,vy:0,vz:0,hx:1,hy:0,n:[0,0,1],air:null,grind:null,bo:0,bv:0,asp,Y:1/asp,last:"",
      t:0,ftx:null,fty:0,fvx:0,fvy:0,flick:false,hitSeen:null,landT:-9,lean:0,wob:0,spinOff:0,flipOff:0,prOff:0,
      gp:{p:0,r:0,y:0,s:0},gs:1,om:0,yw:0,bias:0,tr:[],trT:0,land:null,pop:null,combo:null,score:0,shown:0,heat:0,flash:0,ev:[],lbl:[],bump:0};
    S.z=this.z(S.x,S.y);S.frog=null;S.col=[.925,.102,.514];S.idle=0;S.plopSeen=null;return S;},
  init(asp){return {asp,Y:1/asp,t:0,bs:[this._mkBoard(asp)],scores:{},hitSeen:null};},
  // a frog's spot on the pad → the floor under it, in pool units (the same projection the leash uses)
  _under(fr,asp){const SC=this.sc({Y:1/asp}),sx=(fr.x-.5)*2,sy=(fr.y-.5)*2/asp;let tx=0,ty=0,z=0;
    for(let k=0;k<3;k++){tx=sx*(this.H-z*SC)/this.F/SC;ty=sy*(this.H-z*SC)/this.F/SC;z=this.z(tx,ty);}
    const XM=1/SC-.06,YM=1/asp/SC-.06;return [Math.max(-XM,Math.min(XM,tx)),Math.max(-YM,Math.min(YM,ty))];},
  // BOARDS ↔ FROGS (owner, 10-02: "with several capsules every frog should have its own board and its own score"):
  // a frog without a board adopts the nearest free one (a board whose frog left keeps rolling, and its score), or a new
  // board drops in under it (at most four); a board nobody rides for 8 s leaves the bowl (never the last one), its
  // frog's score kept for when that frog comes back. A POP is per frog: a fresh press under that frog, a new note of
  // that frog (plopT) or, with one frog on the pad, any hit on the pad as before.
  step(W,st,f,dtMs,asp){const now=performance.now(),fs=dtMs/1000;W.t+=fs;if(Math.abs(W.asp-asp)>1e-3){W.asp=asp;W.Y=1/asp;}
    const on={};for(const id in st.pts){const p=st.pts[id];if(p.on)on[id]=p;}
    const nf=Object.keys(on).length;
    for(const b of W.bs)if(b.frog!=null&&!on[b.frog]){b.frog=null;b.idle=0;}
    for(const id in on){if(W.bs.some(b=>b.frog===id))continue;
      const p=on[id];let best=null,bd=1e9;
      for(const b of W.bs)if(b.frog==null){const k=this.sc(b)*this.F/(this.H-b.z*this.sc(b)),bx=b.x*k/2+.5,by=b.y*k*asp/2+.5,d=Math.hypot(bx-p.x,by-p.y);if(d<bd){bd=d;best=b;}}
      if(!best&&W.bs.length<4){best=this._mkBoard(asp);const u=this._under(p,asp);best.x=u[0];best.y=u[1];best.z=this.z(u[0],u[1]);
        best.n=this._seat(best.x,best.y,1,0).n;W.bs.push(best);}
      if(!best)continue;
      best.frog=id;best.col=p.rgb||[.925,.102,.514];best.plopSeen=p.plopT||null;
      const sc=W.scores[id];if(sc&&best.score===0){best.score=sc.score;best.shown=sc.score;}}
    for(let i=W.bs.length-1;i>=0;i--){const b=W.bs[i];if(b.frog!=null){b.lastFrog=b.frog;continue;}b.idle+=fs;
      if(b.idle>8&&W.bs.length>1){if(b.combo)this._bank(b);if(b.lastFrog!=null)W.scores[b.lastFrog]={score:b.score};W.bs.splice(i,1);}}
    let hitNew=false;if(W.hitSeen==null)W.hitSeen=f.lastHit;if(f.lastHit!==W.hitSeen){W.hitSeen=f.lastHit;hitNew=true;}
    for(const b of W.bs){const fr=b.frog!=null?on[b.frog]:null;let pop=false;
      if(fr){if(hitNew&&(nf===1||now-(fr.t0||0)<160))pop=true;
        if(fr.plopT&&fr.plopT!==b.plopSeen){if(b.plopSeen!=null)pop=true;b.plopSeen=fr.plopT;}}
      this._stepOne(b,st,f,dtMs,asp,fr,pop);}},
  _ease(A){const p=Math.min(1,A.t/(.72*A.T));return 1-Math.pow(1-p,2.2);},   // a fast flick, then the catch
  _lateE(A){const L=A.late;if(!L)return 0;const p=Math.min(1,(A.t-L.t0)/L.dur);return 1-Math.pow(1-p,2.2);},
  // the board's pose in the air right now: flip, spin, pitch rotation (the late ones and the manual spin included)
  _airPose(A,land){let e=this._ease(A),le=this._lateE(A);const L=A.late;
    if(land){if(le>=.7)le=1;if(e>=.85)e=1;}   // at touchdown a nearly finished rotation counts as caught
    return {flip:A.flip*e+(L?L.flip*le:0),spin:A.spin*e+(L?L.spin*le:0)+A.man,pr:L?L.pr*le:0};},
  _fly(S,vz,t){vz=Math.min(vz,2.3);
    S.air=Object.assign({t:0,T:Math.max(.25,2*Math.max(vz,0)/this.G),flip:0,spin:0,man:0,z0:S.z,top:S.z,ollie:false,pts:0,name:"",
      late:null,grab:null,gw:0,extra:false},t);
    S.vz=vz;S.last=S.air.name;S.pop={x:S.x,y:S.y,z:S.z,t:S.t};},
  // a trick into the combo; the same trick again within the last four is worth half each time (no ollie farming)
  _add(S,name,pts,label,kind){const C=S.combo||(S.combo={n:0,pts:0,idle:0,rec:[]});const rep=C.rec.filter(v=>v===name).length;
    pts=Math.round(pts*Math.pow(.5,rep));C.rec.push(name);if(C.rec.length>4)C.rec.shift();C.n++;C.pts+=pts;C.idle=0;
    S.heat=Math.min(1,S.heat+.22);if(label!==false)this._ev(S,{k:kind||"trick",name,pts,n:C.n});},
  _ev(S,e){S.ev.push(e);if(S.ev.length>24)S.ev.shift();},
  _bank(S){const C=S.combo;S.combo=null;if(!C||!C.n)return;const tot=C.pts*Math.min(10,C.n);S.score+=tot;S.bump=1;
    const rec=tot>this._best&&C.n>=2;if(tot>this._best)this._best=tot;
    if(C.n>=2)this._ev(S,{k:"bank",tot,n:C.n,rec});if(rec)S.flash=1;},
  _grindEnd(S){const g=S.grind;S.grind=null;if(S.combo&&g)S.combo.pts+=Math.round(.5*this._GR[g.k].pts+120*g.t);},
  // touchdown: the pose decides between a clean landing and a bail
  _land(S,A,vn){const P=Math.PI,ps=this._airPose(A,true),tot=ps.spin,fv=ps.flip;
    const k=Math.round(tot/P),rs=tot-k*P,rf=fv-Math.round(fv/(2*P))*2*P,rp=ps.pr-Math.round(ps.pr/(2*P))*2*P;
    if(k&1){S.hx=-S.hx;S.hy=-S.hy;}   // an odd number of half turns: the board rides on the other way round
    S.spinOff=rs;S.flipOff=rf;S.prOff=rp;S.landT=S.t;
    if(A.grab&&A.gw>.01){S.flipOff+=A.gw*A.grab.r;S.prOff+=A.gw*A.grab.p;}   // a grab held to the ground eases out, no jump
    // touched down long before the planned arc ended (the ground rose under it): the pop fizzled, no trick, no bail
    if(A.ollie&&A.t<.5*A.T&&!A.late){S.land={x:S.x,y:S.y,z:S.z,t:S.t,str:.2,bail:0,clean:0};return;}
    const hgt=Math.max(0,A.top-A.z0),clean=Math.abs(rs)<.7&&Math.abs(rf)<.9&&Math.abs(rp)<.9;   // a grab still held at touchdown is let go, never a bail
    S.land={x:S.x,y:S.y,z:S.z,t:S.t,str:Math.min(1,Math.max(0,-vn)*.45+hgt*1.6),bail:clean?0:1,clean:0};
    if(!clean){S.wob=1;S.vx*=.35;S.vy*=.35;S.bv-=.6;S.combo=null;S.heat*=.3;this._ev(S,{k:"bail"});return;}
    let name=A.name,pts=A.pts;
    if(A.grab&&A.grab.t>.1){const gn=A.grab.k;name=(!name||name==="ollie"||name==="air")?gn:name+" "+gn;pts+=120+Math.round(200*A.grab.t);}
    const rb=!!(A.late&&A.late.ribbit);   // the RibbitFlip is a trick of its own, not "kickflip + late …"
    if(rb){name=A.late.name;pts=A.late.pts;}
    else if(A.late){name=(name&&name!=="ollie"?name+" + ":"")+A.late.name;pts+=A.late.pts;}
    if(!name)return;
    const extra=Math.max(0,Math.abs(k)-Math.round(Math.abs(A.spin+(A.late?A.late.spin:0))/P));
    this._add(S,name+(extra?" +"+extra*180:""),pts+extra*100+Math.round(hgt*300),true,rb?"ribbit":null);S.land.clean=1;
    if(rb){S.flash=1;S.bump=1;S.heat=1;}},   // the whole bowl lights up with it
  _stepOne(S,st,f,dtMs,asp,fr,pop0){
    if(Math.abs(S.asp-asp)>1e-3){S.asp=asp;S.Y=1/asp;}
    const RT=this.RT,G=this.G,SC=this.sc(S),fs=Math.max(.001,dtMs/1000),XM=1/SC-.06,YM=S.Y/SC-.06;
    S.t+=fs;
    let tx=0,ty=0;
    if(fr){const sx=(fr.x-.5)*2,sy=(fr.y-.5)*2/asp;let z=0;
      for(let k=0;k<3;k++){tx=sx*(this.H-z*SC)/this.F/SC;ty=sy*(this.H-z*SC)/this.F/SC;z=this.z(tx,ty);}}
    // the frog's own velocity (pool units/s), eased; a jump (a new press elsewhere) is not a flick
    if(fr){if(S.ftx!=null){let rx=(tx-S.ftx)/fs,ry=(ty-S.fty)/fs;if(Math.hypot(rx,ry)>12){rx=0;ry=0;S.fvx=S.fvy=0;}
        const k=Math.min(1,fs/.05);S.fvx+=(rx-S.fvx)*k;S.fvy+=(ry-S.fvy)*k;}S.ftx=tx;S.fty=ty;}
    else{S.ftx=null;S.fvx*=.5;S.fvy*=.5;}
    const fsp=Math.hypot(S.fvx,S.fvy);
    // POP: a new note on the pad, or the frog flicked (its speed crossing FLICK, re-armed below half of it)
    let pop=!!(pop0&&fr);
    if(fr&&fsp>this.FLICK&&!S.flick){S.flick=true;pop=true;}else if(fsp<this.FLICK*.5)S.flick=false;
    const fwd=S.fvx*S.hx+S.fvy*S.hy,side=-S.fvx*S.hy+S.fvy*S.hx;
    if(pop&&S.air){const A=S.air,rest=A.T-A.t;   // a second pop in the air: a late trick or a grab, once per air
      if(!A.extra&&rest>.34&&A.t>.06){A.extra=true;
        if(fsp<.6){const rx=tx-S.x,ry=ty-S.y;A.grab=Object.assign(this._grab(rx*S.hx+ry*S.hy,-rx*S.hy+ry*S.hx,A.top-A.z0>.22||!A.ollie),{t:0,rel:false});}
        else{const L=this._late(fwd,side),rb=L.name==="late kickflip"&&/^(double )?kickflip$/.test(A.name);
          A.late=Object.assign(rb?this._ribbit():L,{t0:A.t,dur:rb?Math.min(.38,rest*.62):Math.min(.32,rest*.55)});}}}
    else if(pop&&S.t-S.landT>.15){
      const pw=Math.min(1.5,.78+.5*f.ba+.12*Math.min(4,fsp)+.25*f.ki);
      if(S.grind){   // pop out of the grind, back into the pool, with the trick of the moment
        const g=S.grind,n=this.nrm(S.x,S.y),t=[-n[1]*g.dir,n[0]*g.dir];this._grindEnd(S);
        S.vx=t[0]*g.v*.85-n[0]*.3;S.vy=t[1]*g.v*.85-n[1]*.3;S.x-=n[0]*.01;S.y-=n[1]*.01;
        this._fly(S,pw*.85,Object.assign(this._popTrick(fwd,side,fsp),{ollie:true}));}
      else{const g=this.gz(S.x,S.y);   // on a slope the pop is relative to the ground rising under the wheels
        if(this.sn(S.x,S.y)[2]>.85){S.bv-=.5;this._fly(S,pw+Math.max(0,g[0]*S.vx+g[1]*S.vy),Object.assign(this._popTrick(fwd,side,fsp),{ollie:true}));}
        else{const sp=Math.hypot(S.vx,S.vy);   // on a steep wall a pop is a pump: a shove along the way it rides
          if(sp>.05){S.vx+=S.vx/sp*.5;S.vy+=S.vy/sp*.5;}S.bv-=.3;S.pop={x:S.x,y:S.y,z:S.z,t:S.t};}}}
    const pw=1+.35*f.ba,kick=.3*f.ki;
    let left=Math.min(.1,fs);
    while(left>1e-4){const h=Math.min(.004,left);left-=h;
      let nt=null,rate=25;
      if(S.air){const A=S.air;A.t+=h;
        S.vz-=G*h;S.x+=S.vx*h;S.y+=S.vy*h;S.z+=S.vz*h;A.top=Math.max(A.top,S.z);const ad=Math.exp(-.04*h);S.vx*=ad;S.vy*=ad;
        // the frog circling the board spins it (its angular speed around the board), and steers the drift a little
        if(fr){const rx=tx-S.x,ry=ty-S.y,r2=rx*rx+ry*ry;
          const r=Math.sqrt(r2);if(r>.05&&!(A.grab&&!A.grab.rel)){const w=Math.max(-12,Math.min(12,(rx*S.fvy-ry*S.fvx)/r/Math.max(r,.3)));A.man-=Math.sign(w)*Math.max(0,Math.abs(w)-2.5)*h*.9;}   // a dead zone: steering is not spinning
          if(A.t>.6*A.T){const tot=this._airPose(A).spin,rs=tot-Math.round(tot/Math.PI)*Math.PI;if(Math.abs(rs)<.9)A.man-=rs*Math.min(1,h*5);}   // the catch: near a half turn the board settles onto it
          S.vx+=rx*.9*h;S.vy+=ry*.9*h;}
        // a grab is held while the frog stays put; it lets go when the frog moves or the ground comes close
        if(A.grab){if(!A.grab.rel){A.grab.t+=h;if(fsp>1.2||A.T-A.t<.16||(S.vz<0&&S.z-this.z(S.x,S.y)<.06))A.grab.rel=true;}   // lets go near the ground too (a wall may come up early)
          A.gw+=((A.grab.rel?0:1)-A.gw)*Math.min(1,h*12);}
        if(S.x<-XM||S.x>XM){S.x=Math.max(-XM,Math.min(XM,S.x));S.vx*=-.3;}
        if(S.y<-YM||S.y>YM){S.y=Math.max(-YM,Math.min(YM,S.y));S.vy*=-.3;}
        const u=this.e(S.x,S.y);
        if(u>RT-.004&&S.z<-.002){const n=this.nrm(S.x,S.y);S.x-=n[0]*(u-RT+.006);S.y-=n[1]*(u-RT+.006);}   // never through the coping
        const zg=this.z(S.x,S.y);
        let touch=S.z<=zg;   // or a truck already on the concrete: on a curve the wall meets the nose or the tail first
        if(!touch&&S.vz<0&&A.t>.05)for(const a of [.06,-.06])if(this.z(S.x+S.hx*a,S.y+S.hy*a)>=S.z){touch=true;break;}
        if(touch&&(S.vz<0||(A.ollie&&A.t>.08))){   // landing: the arc meets the surface; keep the slope's share of the speed, the trucks take the rest
          const n=this.sn(S.x,S.y),vn=S.vx*n[0]+S.vy*n[1]+S.vz*n[2];
          S.vx=(S.vx-n[0]*vn)*.93;S.vy=(S.vy-n[1]*vn)*.93;S.vz=0;S.z=zg;
          S.bv+=Math.max(-2,vn)*.55;S.air=null;S.n=this._seat(S.x,S.y,S.hx,S.hy).n;this._land(S,A,vn);}
        else{const hg=S.z-zg;   // close above the ground the board turns to the surface it is about to hit
          if(hg<.12&&S.vz<0){nt=this._seat(S.x,S.y,S.hx,S.hy).n;rate=2.6+40*(1-Math.max(0,hg)/.12);}else{nt=this.sn(S.x,S.y);rate=2.6;}}}
      else if(S.grind){const g=S.grind,n=this.nrm(S.x,S.y),t=[-n[1]*g.dir,n[0]*g.dir];
        g.v=Math.max(0,g.v-h*(g.slide?.4+.3*g.v:.26+.2*g.v));S.x+=t[0]*g.v*h;S.y+=t[1]*g.v*h;
        const u=this.e(S.x,S.y),n2=this.nrm(S.x,S.y);S.x-=n2[0]*(u-RT);S.y-=n2[1]*(u-RT);   // stay on the coping round the curves
        S.z=0;S.hx=t[0];S.hy=t[1];g.t+=h;g.kt+=h;
        const l=Math.hypot(n2[0]*.12,n2[1]*.12,1);nt=[n2[0]*.12/l,n2[1]*.12/l,1/l];
        // a grind switch: the frog moved round the board, the board follows (truck grinds only)
        if(!g.slide&&g.kt>.35){const k=this._grindKind(S,g,fr,tx,ty);if(k!==g.k){g.k=k;g.kt=0;this._add(S,k,60);}}
        let pull=0;if(fr)pull=(tx-S.x)*-n2[0]+(ty-S.y)*-n2[1];
        if(g.v<.12||(g.t>.3&&pull>.25)){this._grindEnd(S);   // it tips back in and drops onto the wall
          S.vx=t[0]*g.v*.8-n2[0]*.14;S.vy=t[1]*g.v*.8-n2[1]*.14;S.x-=n2[0]*.008;S.y-=n2[1]*.008;this._fly(S,.12,{name:""});S.last="drop in";}}
      else{
        const g=this.gz(S.x,S.y),vx=S.vx,vy=S.vy,sp=Math.hypot(vx,vy),z0=this.z(S.x,S.y);
        let c2=0;if(sp>1e-4){const e=.006,ux=vx/sp,uy=vy/sp;c2=sp*sp*(this.z(S.x+ux*e,S.y+uy*e)-2*z0+this.z(S.x-ux*e,S.y-uy*e))/(e*e);}
        const g2=1+g[0]*g[0]+g[1]*g[1],Nf=G+c2,vzs=g[0]*vx+g[1]*vy;
        if(Nf<0&&sp>.06){S.z=z0;const p=Math.min(1.05,(vzs*1.3+sp*.25)*pw+kick);this._fly(S,vzs,vzs>.35?this._trick(p):{name:""});continue;}   // the ground falls away: it flies
        let ax=-Nf*g[0]/g2,ay=-Nf*g[1]/g2;
        if(fr){const K=5,C=2*Math.sqrt(K)*.42,sg=Math.sqrt(g2);ax+=((tx-S.x)*K-vx*C)/sg;ay+=((ty-S.y)*K-vy*C)/sg;
          // the frog pumps: riding towards it, the board gains speed like a skater pumping the transitions
          if(sp>.1){const to=((tx-S.x)*vx+(ty-S.y)*vy)/sp;if(to>0){const pm=2.4*Math.min(1,to*3)/sg;ax+=vx/sp*pm;ay+=vy/sp*pm;}}}
        S.vx+=ax*h;S.vy+=ay*h;const dr=Math.exp(-(fr?.08:.2)*h);S.vx*=dr;S.vy*=dr;
        // THE CARVE (owner, 10-02: "turns across the slope look wooden"). The lean used to come from the sideways pull,
        // gravity included, so riding across a wall rolled the deck to its limit (.42) and held it there, stiff. Now it
        // comes from how fast the path itself turns (ω·speed = the centripetal pull), eased: straight across a slope
        // the deck lies flat on its wheels, through an arc it banks into it, never more than .24.
        if(sp>.08){const sp1=Math.hypot(S.vx,S.vy);if(sp1>.08){let da=Math.atan2(S.vy,S.vx)-Math.atan2(vy,vx);da-=Math.round(da/(2*Math.PI))*2*Math.PI;
          S.om+=(da/h-S.om)*Math.min(1,h*10);}}else S.om*=Math.exp(-h*8);
        {const lt=Math.max(-.24,Math.min(.24,S.om*sp*.06))*Math.min(1,sp/.3);S.lean+=(lt-S.lean)*Math.min(1,h*7);}
        // the trucks feel the transition: pressed in at the bottom of a curve (more than gravity), unweighted over a crest
        S.bias=-Math.max(-.004,Math.min(.007,(Nf/G-1)*.004));
        {const gv=g[0]*S.vx+g[1]*S.vy,V=Math.sqrt(S.vx*S.vx+S.vy*S.vy+gv*gv);if(V>2.3){S.vx*=2.3/V;S.vy*=2.3/V;}}   // a top speed along the surface
        S.x+=S.vx*h;S.y+=S.vy*h;
        if(S.x<-XM||S.x>XM){S.x=Math.max(-XM,Math.min(XM,S.x));S.vx*=-.3;}
        if(S.y<-YM||S.y>YM){S.y=Math.max(-YM,Math.min(YM,S.y));S.vy*=-.3;}
        const u=this.e(S.x,S.y);
        if(u>RT*.93&&u<RT){const n=this.nrm(S.x,S.y),vo=S.vx*n[0]+S.vy*n[1],vt=S.vx*-n[1]+S.vy*n[0];
          if(vo>0){
            // up the vert: all the speed it carries along the surface, less the part along the coping, turns vertical;
            // it clears the lip only if that lifts it above the coping (energy). Along the coping it grinds (shallow
            // angle: on the trucks) or slides (steeper: on the deck); straight at it, it flies.
            const g3=this.gz(S.x,S.y),zc=this.z(S.x,S.y),V3=S.vx*S.vx+S.vy*S.vy+(g3[0]*S.vx+g3[1]*S.vy)**2,
              vz=Math.sqrt(Math.max(0,V3-vt*vt)),rise=vz*vz/(2*G)+zc;
            if(Math.abs(vt)>.35&&rise>-.02&&Math.abs(vt)>vz*.55){const slide=Math.abs(vt)<vz*.95;
              const gr=S.grind={dir:Math.sign(vt),v:Math.abs(vt)*(slide?.85:.95),t:0,kt:0,slide,k:""};S.last="grind";
              S.x+=n[0]*(RT-u);S.y+=n[1]*(RT-u);S.vx=0;S.vy=0;S.z=0;S.gs=gr.dir;gr.k=this._grindKind(S,gr,fr,tx,ty);this._add(S,gr.k,0);}
            else if(rise>.04){S.z=zc;S.vx=-n[1]*vt-n[0]*.07;S.vy=n[0]*vt-n[1]*.07;
              this._fly(S,vz,this._trick(Math.min(2.1,rise*3.2*pw+kick)));}
            else if(u>RT*.97){S.vx-=n[0]*vo*1.25;S.vy-=n[1]*vo*1.25;S.x-=n[0]*(u-RT*.97);S.y-=n[1]*(u-RT*.97);}}}
        S.z=this.z(S.x,S.y);
        // the deck rests on two trucks: its tilt is the surface's, averaged under the nose and the tail
        nt=this._seat(S.x,S.y,S.hx,S.hy).n;rate=22;
        const sp2=Math.hypot(S.vx,S.vy);
        // the heading follows the path on a critically damped yaw spring, leading a hair into the turn (the trucks steer
        // before the board has turned): a flowing arc, not a lagging lerp that let the board slide sideways
        if(sp2>.04){let tg=Math.atan2(S.vy,S.vx)+S.om*.05;const cur=Math.atan2(S.hy,S.hx);
          let da=tg-cur;da-=Math.round(da/(2*Math.PI))*2*Math.PI;if(Math.abs(da)>Math.PI/2){da-=Math.sign(da)*Math.PI;}   // fakie: either end may lead
          const w=Math.min(1,sp2/.2),K=160*w,C=2*Math.sqrt(K)*.95;S.yw+=(da*K-S.yw*C)*h;const a=cur+S.yw*h;S.hx=Math.cos(a);S.hy=Math.sin(a);}
        else S.yw*=Math.exp(-h*10);
        // a clean landing's leftover twist eases out at once; a bail's slowly, while the board wobbles
        S.spinOff*=Math.exp(-h*(S.wob>.15?2.5:14));S.flipOff*=Math.exp(-h*14);S.prOff*=Math.exp(-h*14);
        if(S.combo){S.combo.idle+=h;if(S.combo.idle>1.5)this._bank(S);}}
      if(S.air||S.grind){S.lean*=Math.exp(-h*6);S.bias=0;S.om*=Math.exp(-h*6);}
      if(nt){const k=Math.min(1,h*rate);for(let i=0;i<3;i++)S.n[i]+=(nt[i]-S.n[i])*k;const l=Math.hypot(...S.n)||1;S.n=S.n.map(v=>v/l);}
      // the trucks: a damped spring that bends down on a landing and comes back with a small rebound (never so far
      // that the wheels sink into the concrete)
      S.bv+=h*(-90*(S.bo-(S.bias||0))-11*S.bv);S.bo+=S.bv*h;S.bo=Math.max(-.012,Math.min(.03,S.bo));
    }
    // the grind pose eases in and out (a slide swings the board across the coping in about 0.1 s)
    {const T=S.grind?this._GR[S.grind.k]:{p:0,r:0,y:0,s:0},k=Math.min(1,fs*12);for(const c of ["p","r","y","s"])S.gp[c]+=(T[c]-S.gp[c])*k;}
    S.wob*=Math.exp(-fs*2.2);S.flash*=Math.exp(-fs*2.5);S.bump*=Math.exp(-fs*5);
    if(!S.combo)S.heat=Math.max(0,S.heat-fs*.45);
    // the streak: a sample every 1/30 s, its strength from the speed (and more in the air)
    S.trT+=fs;if(S.trT>=1/30){S.trT=0;const g=this.gz(S.x,S.y),V=Math.hypot(S.vx,S.vy,S.air?S.vz:g[0]*S.vx+g[1]*S.vy);
      S.tr.unshift([S.x,S.y,S.z,Math.min(1,Math.max(0,(V-.7)/1.1))*.85+(S.air?.25:0)]);if(S.tr.length>8)S.tr.length=8;}
  },
  // THE FOUR WHEELS ON THE CONCRETE (owner, 10-02: "landing on the curve it went partly under the ground; correct it at
  // the contact"): where the wheels of a board at (x, y), heading (hx, hy) touch the surface (trucks ±.06, axles ±.026,
  // pool units). Their plane is the deck's normal, their mean the board's seat: on a curve the trucks sit ON the
  // concrete and the middle of the deck hangs over it, like a real board, instead of the middle sitting on the
  // concrete and the straight ends cutting into the wall.
  _seat(x,y,hx,hy){const d=.06,w=.026,P=[];
    for(const a of [d,-d])for(const b of [w,-w]){const px=x+hx*a-hy*b,py=y+hy*a+hx*b;P.push([px,py,this.z(px,py)]);}
    const F=[0,1,2].map(i=>(P[0][i]+P[1][i]-P[2][i]-P[3][i])/2),L=[0,1,2].map(i=>(P[0][i]+P[2][i]-P[1][i]-P[3][i])/2);
    let n=[F[1]*L[2]-F[2]*L[1],F[2]*L[0]-F[0]*L[2],F[0]*L[1]-F[1]*L[0]];const l=Math.hypot(...n)||1;n=n.map(v=>v/l);if(n[2]<0)n=n.map(v=>-v);
    return {n,c:[0,1,2].map(i=>(P[0][i]+P[1][i]+P[2][i]+P[3][i])/4)};},
  // NO CLIPPING. The board's solid (the deck's outline top and bottom with its kicked-up ends, the wheels' rims; board units) is turned
  // exactly like the shader turns the board (inverse spin, flip, pitch), and the deepest one under the concrete (the
  // floor, the curved wall, the deck, the inside face of the coping) pushes the drawn board out along the surface's
  // normal there, in up to ten passes for the curves. Physics is untouched: this only keeps the picture honest (the ends
  // of a straight deck in a concave wall, the tail of an ollie, a flip near the ground, a lean, a grind pose).
  _PTS:(()=>{const P=[];
    for(const x of [-.21,-.18,-.155,-.125,-.06,0,.06,.125,.155,.18,.21]){const ax=Math.abs(x),tl=Math.max(ax-.125,0),kz=tl*tl*2.4,
        hw=ax<=.155?.056:Math.sqrt(Math.max(0,.0031-(ax-.155)**2));
      for(const y of hw>.012?[-hw,hw]:[0])for(const z of [-.0095,.0095])P.push([x,y,z+kz]);}
    for(const sx of [-1,1])for(const sy of [-1,1])for(let k=0;k<8;k++){const a=k/8*6.2832;
      for(const y of [.04,.066])P.push([sx*.12+Math.cos(a)*.023,sy*y,-.04+Math.sin(a)*.023]);}
    return P;})(),
  _rot(a,u,v){const c=Math.cos(a),s=Math.sin(a);return [c*u+s*v,-s*u+c*v];},   // GLSL rot(a)*vec2(u,v)
  _unclip(C,F,N,flip,spin,pitch,SB,SC){const SI=[N[1]*F[2]-N[2]*F[1],N[2]*F[0]-N[0]*F[2],N[0]*F[1]-N[1]*F[0]],RT=this.RT;
    const W=this._PTS.map(([x,y,z])=>{let r=this._rot(spin,x,y);x=r[0];y=r[1];r=this._rot(flip,y,z);y=r[0];z=r[1];r=this._rot(-pitch,x,z);x=r[0];z=r[1];
      return [(F[0]*x+SI[0]*y+N[0]*z)*SB,(F[1]*x+SI[1]*y+N[1]*z)*SB,(F[2]*x+SI[2]*y+N[2]*z)*SB];});
    let moved=0;
    for(let pass=0;pass<10;pass++){let worst=0,dir=null;
      for(const w of W){const px=(C[0]+w[0])/SC,py=(C[1]+w[1])/SC,pz=(C[2]+w[2])/SC,u=this.e(px,py);
        if(u>=RT&&pz<0){   // inside the coping's block: out sideways into the pool or up onto the deck, whichever is shorter
          const n=this.nrm(px,py),side=u-RT,up=this.z(px,py)-pz;
          if(side<up){if(side>worst){worst=side;dir=[-n[0],-n[1],0];}}else if(up>worst){worst=up;dir=[0,0,1];}continue;}
        const d=this.z(px,py)-pz;if(d<=0)continue;const n=this.sn(px,py),pen=d*n[2];if(pen>worst){worst=pen;dir=n;}}
      if(!dir||worst<1e-5)break;const m=Math.min(worst+.003,.12-moved);if(m<=0)break;moved+=m;
      for(let i=0;i<3;i++)C[i]+=dir[i]*m*SC;}
    return C;},
  upload(gl,u,W){if(!u.BL)return;const n=Math.min(4,W.bs.length),Lb=new Float32Array(64),Db=new Float32Array(128),Cb=new Float32Array(64),Kb=new Float32Array(16);
    W.bs.slice(0,n).forEach((S,k)=>{const SC=this.sc(S),SB=this.B*SC,G=S.gp;
    let flip=S.lean+S.flipOff+S.gs*G.r,spin=S.spinOff,pitch=S.prOff+G.p,grind=0,gsp=0,gdir=0;
    const N=S.n.slice();
    flip+=S.wob*.32*Math.sin(S.t*34);spin+=S.wob*.12*Math.sin(S.t*21+1);
    if(S.air){const A=S.air,ps=this._airPose(A),q=A.t/A.T;flip+=ps.flip;spin+=ps.spin;pitch+=ps.pr;
      // the ollie: the tail snaps, the nose rises, the board levels out at the top and dips its nose to land
      if(A.ollie)pitch+=.42*Math.exp(-(((q-.12)/.12)**2))-.08*Math.exp(-(((q-.82)/.12)**2));
      if(A.grab){pitch+=A.gw*A.grab.p;flip+=A.gw*A.grab.r;}}
    else if(S.grind){grind=S.grind.slide?2:1;gsp=S.grind.v;gdir=1;}
    // the grind's yaw turns the heading itself (towards the pool for > 0), so pitch and roll stay the board's own
    const ya=S.gs*G.y,cy=Math.cos(ya),sy=Math.sin(ya),hx=S.hx*cy-S.hy*sy,hy=S.hx*sy+S.hy*cy;
    const d=hx*N[0]+hy*N[1];let F=[hx-N[0]*d,hy-N[1]*d,-N[2]*d];
    const lf=Math.hypot(F[0],F[1],F[2]);F=lf>1e-3?F.map(v=>v/lf):[0,0,1];
    if(lf<=1e-3){const l=Math.hypot(N[0],N[1])||1;F=[-N[1]/l,N[0]/l,0];}
    const o=(.062-.046*G.s)*SB+S.bo*SC;
    const P0=(!S.air&&!S.grind)?this._seat(S.x,S.y,S.hx,S.hy).c:[S.x,S.y,S.z];   // on the ground: on its four wheels
    const C=this._unclip([P0[0]*SC+N[0]*o,P0[1]*SC+N[1]*o,P0[2]*SC+N[2]*o],F,N,flip,spin,pitch,SB,SC);
    Lb.set([C[0],C[1],C[2],flip, F[0],F[1],F[2],spin, N[0],N[1],N[2],grind, S.Y,gsp,gdir,pitch],k*16);
    Db.set([S.x*SC,S.y*SC,S.z*SC,S.tr.length?S.tr[0][3]:0],k*32);
    for(let i=1;i<8;i++){const q=S.tr[Math.min(i-1,S.tr.length-1)];if(q)Db.set([q[0]*SC,q[1]*SC,q[2]*SC,q[3]],k*32+i*4);else Db.set([S.x*SC,S.y*SC,S.z*SC,0],k*32+i*4);}
    const cn=S.combo?S.combo.n:0;
    if(S.land)Cb.set([S.land.x*SC,S.land.y*SC,S.land.z*SC,S.t-S.land.t, S.land.str,S.land.bail,S.land.clean,0],k*16);else Cb[k*16+3]=-1;
    if(S.pop)Cb.set([S.pop.x*SC,S.pop.y*SC,S.pop.z*SC,S.t-S.pop.t],k*16+8);else Cb[k*16+11]=-1;
    Cb.set([S.heat,S.flash,cn>=6?2:(cn>=3?1:0),0],k*16+12);
    Kb.set([S.col[0],S.col[1],S.col[2],S.frog!=null?1:0],k*4);});
    gl.uniform4fv(u.BL,Lb);gl.uniform1i(u.NB,n);
    if(u.BD)gl.uniform4fv(u.BD,Db);if(u.BC)gl.uniform4fv(u.BC,Cb);if(u.BK)gl.uniform4fv(u.BK,Kb);},
  // THE HUD on the pad's 2D canvas (above the frogs, under the corner badges), in the chunky game face "Titan One"
  // (shipped with the app): trick names pop up above the board like stickers (ink offset, paper outline, the combo's
  // colour) and ride along with it; a banked combo and a record pop in the middle; the SCORE sits in the top-left corner
  // under the note badge, an arcade counter that rolls up after a bank, with the running combo beside it.
  // THE RIBBITFLIP BURST, drawn like "POW!" in a comic: a jagged pink star with a yellow core under a halftone of pink
  // dots, a hard ink shadow, action lines round it, the name in the game face across it and the points underneath.
  // It slams in (overshoot, a short shake) where the board landed and stays put while the board rolls on; it scales
  // itself down to fit a small pad. The shake is skipped under reduced motion.
  _pow(x,l,al,sc2,ag,W,H,GF){const P2=Math.PI*2,z=l.size;
    x.font=GF(z);const tw=x.measureText(l.txt).width,rx=tw*.5+z*1.05,ry=z*1.85;
    const fit=Math.min(1,W*.92/(rx*2.9),H*.9/(ry*2.9)),ox=rx*1.45*fit,oy=ry*1.45*fit;
    const cx=Math.max(ox,Math.min(W-ox,l.x)),cy=Math.max(Math.max(oy,H*.22),Math.min(H-oy,l.y));
    const calm=typeof _prefersReducedMotion==="function"&&_prefersReducedMotion(),shk=(!calm&&ag<.4)?(1-ag/.4)*z*.22:0;
    const kick=1+.18*Math.max(0,1-ag/.3);
    x.save();x.globalAlpha=Math.max(0,al);
    x.translate(cx+Math.sin(ag*97)*shk,cy+Math.cos(ag*83)*shk);x.rotate(l.rot*1.6);x.scale(sc2*kick*fit,sc2*kick*fit);
    const star=(sx,sy,k)=>{x.beginPath();for(let i=0;i<26;i++){const a=i/26*P2,r=(i&1?.66+.07*(i%3):1)*k;
      const px=Math.cos(a)*rx*r+sx,py=Math.sin(a)*ry*r+sy;i?x.lineTo(px,py):x.moveTo(px,py);}x.closePath();};
    x.lineCap="round";x.strokeStyle="#211f1d";x.lineWidth=z*.13;   // action lines
    for(let i=0;i<14;i++){const a=i/14*P2+.11,r0=1.12+.07*(i%3),r1=r0+.22+.1*((i*5)%3);
      x.beginPath();x.moveTo(Math.cos(a)*rx*r0,Math.sin(a)*ry*r0);x.lineTo(Math.cos(a)*rx*r1,Math.sin(a)*ry*r1);x.stroke();}
    star(z*.2,z*.26,1);x.fillStyle="#211f1d";x.fill();   // the hard ink shadow
    star(0,0,1);x.fillStyle="#ec1a83";x.fill();x.lineWidth=z*.15;x.stroke();
    star(0,0,.8);x.fillStyle="#ffd25a";x.fill();
    x.save();star(0,0,.8);x.clip();x.fillStyle="rgba(236,26,131,.3)";const st=z*.44;   // halftone, denser towards the rim
    for(let yy=-ry,r=0;yy<ry;yy+=st,r++)for(let xx=-rx+(r&1?st/2:0);xx<rx;xx+=st){const d=Math.hypot(xx/rx,yy/ry);
      if(d<.3)continue;x.beginPath();x.arc(xx,yy,st*.34*Math.min(1,d),0,P2);x.fill();}
    x.restore();
    x.lineWidth=z*.34;x.strokeStyle="#211f1d";x.strokeText(l.txt,z*.08,z*.1);   // the name: ink, paper, pink
    x.strokeStyle="#f2ede1";x.strokeText(l.txt,0,0);x.fillStyle=l.col;x.fillText(l.txt,0,0);
    if(l.sub){x.font=GF(z*.55);x.lineWidth=z*.2;x.strokeStyle="#f2ede1";x.strokeText(l.sub,0,z*.92);
      x.fillStyle="#211f1d";x.fillText(l.sub,0,z*.92);}
    x.restore();},
  hud(W,x,Wd,H){
    if(!this._fontReq&&typeof document!=="undefined"&&document.fonts){this._fontReq=1;try{document.fonts.load("20px 'Titan One'");}catch(e){}}
    const bs=W.bs;if(!bs.length)return;
    const SC=this.sc(bs[0]),asp=Wd/H,sz=Math.max(12,Math.min(24,Math.min(Wd,H)*.075));
    const gl=(pl,en)=>typeof _gl==="function"?_gl(pl,en):pl,fam=(typeof XPAD!=="undefined"&&XPAD._font||"10px sans-serif").replace(/^\S+\s+/,"");
    const GF=s=>s.toFixed(1)+"px 'Titan One', "+fam;
    const tier=n=>n>=6?"#a6d861":(n>=3?"#eaa32b":"#ec1a83");
    const rgb=c=>"rgb("+Math.round(c[0]*255)+","+Math.round(c[1]*255)+","+Math.round(c[2]*255)+")";
    x.save();x.lineJoin="round";
    // trick names ride above each board like a name tag (newest lowest, older ones stacked up); a banked combo and a
    // record pop in the middle of the pad
    for(const S of bs){const L=S.lbl;
      const k=SC*this.F/(this.H-S.z*SC),bx=(S.x*k/2+.5)*Wd,by=(1-(S.y*k*asp/2+.5))*H;
      const push=(txt,sub,col,size,life,mid)=>{L.push({txt,sub,col,size,life,mid,t0:S.t,rot:(Math.random()-.5)*.14});if(L.length>6)L.shift();};
      for(const e of S.ev.splice(0)){
        if(e.k==="trick")push(e.name,e.pts?"+"+e.pts+(e.n>1?" · ×"+e.n:""):(e.n>1?"×"+e.n:""),tier(e.n),sz,1.3);
        else if(e.k==="bail")push(gl("gleba!","bail!"),"","#b8264a",sz*1.1,1.2);
        else if(e.k==="bank"){push(gl("kombo","combo")+" ×"+e.n,"+"+e.tot.toLocaleString(),tier(e.n),sz*1.35,1.8,1);
          if(e.rec)push(gl("rekord!","record!"),"","#a6d861",sz*1.1,1.8,2);}
        else if(e.k==="ribbit"){push(e.name+"!","+"+e.pts.toLocaleString()+(e.n>1?" · ×"+e.n:""),"#ec1a83",sz*1.6,2.4);L[L.length-1].pow=1;}}
      let stack=0;
      for(let i=L.length-1;i>=0;i--){const l=L[i];
        if(l.mid){l.x=Wd/2;l.y=H*.4+(l.mid===2?l.size*2.5:0);continue;}
        if(l.pow){if(l.x==null){l.x=bx;l.y=by-sz*2.4;}continue;}   // a comic sound effect stays where it happened
        const ty=by-sz*1.5-stack;stack+=l.size*1.55;
        if(l.x==null){l.x=bx;l.y=ty;}else{l.x+=(bx-l.x)*.25;l.y+=(ty-l.y)*.25;}l.y=Math.max(l.size*.8,l.y);}
      x.textAlign="center";x.textBaseline="middle";
      for(let i=L.length-1;i>=0;i--){const l=L[i],a=(S.t-l.t0)/l.life;if(a>=1){L.splice(i,1);continue;}
        const pin=Math.min(1,(S.t-l.t0)/.2),c1=1.70158,sc2=1+(c1+1)*Math.pow(pin-1,3)+c1*Math.pow(pin-1,2);   // ease-out-back
        const al=a<.65?1:1-(a-.65)/.35,rise=-l.size*(l.mid?.6:.5)*(1-(1-a)*(1-a));
        if(l.pow){this._pow(x,l,al,sc2,S.t-l.t0,Wd,H,GF);continue;}
        x.font=GF(l.size);const hw=x.measureText(l.txt).width/2+l.size*.4;
        const cx=Math.max(hw,Math.min(Wd-hw,l.x));
        x.save();x.globalAlpha=Math.max(0,al);x.translate(cx,l.y+rise);x.rotate(l.rot);x.scale(sc2,sc2);
        x.lineWidth=l.size*.34;x.strokeStyle="rgba(33,31,29,.92)";x.strokeText(l.txt,l.size*.07,l.size*.1);   // the ink, misregistered
        x.strokeStyle="#f2ede1";x.strokeText(l.txt,0,0);x.fillStyle=l.col;x.fillText(l.txt,0,0);
        if(l.sub){x.font=GF(l.size*.6);x.lineWidth=l.size*.22;x.strokeStyle="#f2ede1";
          x.strokeText(l.sub,0,l.size*.82);x.fillStyle="#211f1d";x.fillText(l.sub,0,l.size*.82);}
        x.restore();}}
    // THE SCORES, top-left, one row per board: a tiny "SCORE" tag (with the frog's colour as a dot when there is more
    // than one board), the number big in the game face with a thick ink outline and a hard offset shadow, filled
    // amber → pink; it rolls up after a bank and kicks (scale) on the bump. The live combo (×n and its points) sits
    // right of it in the combo's colour; the best combo of the bowl is a small line under the last row.
    const big=Math.max(16,Math.min(32,sz*1.25)),many=bs.length>1;let y0=24;
    bs.forEach((S,bi)=>{
      S.shown+=(S.score-S.shown)*Math.min(1,.12+(S.score-S.shown>2000?.1:0));if(Math.abs(S.score-S.shown)<1)S.shown=S.score;
      const C=S.combo,last=bi===bs.length-1;
      if(!(S.score>0||(last&&this._best>0)||C||many))return;
      const x0=8,s=1+.22*S.bump;
      x.textAlign="left";x.textBaseline="alphabetic";
      x.save();x.translate(x0,y0);x.rotate(-.04);
      let tx0=1;
      if(many){x.beginPath();x.arc(big*.22,big*.22,big*.2,0,6.2832);x.fillStyle=rgb(S.col);x.fill();x.lineWidth=big*.08;x.strokeStyle="#211f1d";x.stroke();
        if(S.frog==null){x.globalAlpha=.5;}tx0=big*.55;}
      x.font=GF(big*.42);x.lineWidth=big*.16;x.strokeStyle="#211f1d";x.strokeText(gl("WYNIK","SCORE"),tx0,big*.42);
      x.fillStyle="#f2ede1";x.fillText(gl("WYNIK","SCORE"),tx0,big*.42);x.globalAlpha=1;
      x.translate(0,big*.42+big*.95);x.scale(s,s);
      const num=Math.round(S.shown).toLocaleString();x.font=GF(big);
      x.lineWidth=big*.22;x.strokeStyle="#211f1d";x.strokeText(num,big*.08,big*.1);x.strokeText(num,0,0);   // hard shadow + outline
      const gr=x.createLinearGradient(0,-big*.8,0,0);gr.addColorStop(0,"#ffd25a");gr.addColorStop(1,"#ec1a83");
      x.fillStyle=gr;x.fillText(num,0,0);
      const nw=x.measureText(num).width;
      if(C&&C.n){const pul=1+.08*Math.sin(S.t*9)*Math.min(1,S.heat*2),tx2=nw+big*.4;
        x.save();x.translate(tx2,0);x.scale(pul,pul);x.font=GF(big*.7);
        const ct="×"+C.n+"  "+C.pts.toLocaleString();x.lineWidth=big*.17;x.strokeStyle="#211f1d";x.strokeText(ct,0,0);
        x.fillStyle=tier(C.n);x.fillText(ct,0,0);x.restore();}
      if(last&&this._best){const bt=gl("najlepsze kombo","best combo")+" "+this._best.toLocaleString();
        x.font=GF(big*.4);x.lineWidth=big*.14;x.strokeStyle="#211f1d";x.strokeText(bt,1,big*.55);
        x.fillStyle="#a6d861";x.fillText(bt,1,big*.55);}
      x.restore();y0+=big*2.05;});
    x.restore();}
};


// ---------- final order (Staw first = default) ----------
const ORDER=["off","staw","staw-metal","staw-riso","haft","welur","cekiny","termo","wycinanka","zacieki","akwarela","lawa-3","rampa","koral-gumka","koral-mitoza","koral-labirynt","koral-metal","pozar","neon","poziomice","poziomice-filc"];
// retired plates keep their code (lawa-3's body inherits lawa-2's) but leave the list; saved pads go through PAD_PLATE_LEGACY
for(const id of ["lawa","lawa-2"]){const i=PAD_PLATES.findIndex(p=>p[0]===id);if(i>=0)PAD_PLATES.splice(i,1);}
PAD_PLATES.sort((a,b)=>ORDER.indexOf(a[0])-ORDER.indexOf(b[0]));
})();
