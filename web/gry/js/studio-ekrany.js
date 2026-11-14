// RibbitBeat: ekrany Studia dźwięków, które wyglądają i działają jak w RibbitFlipie (ekrany z shaderami).
// Port ekranów CRT z Biblioteki dźwięków RibbitFlipa (web/js/rf-24b-pad-plate.js: preludium i obudowa
// WebGL2; rf-25c-sound-screens.js: okrągła lampa „skop” z luminoforem, wiązką i słońcem widma oraz czysta matematyka fali,
// korektora i obwiedni; rf-25e-curve-editors.js: trzy płaskie panele edycji pod szkłem „crt”). Pliki panelu są sprzęgnięte
// z jego stanem (XPAD, PadAudio, elementy #soundEditor), więc gra ich nie ładuje: shadery i wzory są tu skopiowane 1:1
// (zmiana kształtu obrazu = zmiana w obu miejscach), a obudowa jest własna i mała.
//
// Co tu jest:
//   GL        — jeden sposób budowania kontekstu WebGL2 i programów (jak PadPlate._mk/_prog), lista uniformów rf-24b,
//   cechy()   — cechy dźwięku z AnalyserNode szyny podglądu (poziom, bas/środek/góra, uderzenie, widmo 16 pasm, przebieg 64
//               punktów od zbocza zera) wygładzone w czasie jak PadPlate._feat; żabki = trzymane nuty na obręczy lampy,
//   M         — matematyka SoundScreens (fala ↔ harmoniczne, odpowiedź korektora, geometria obwiedni, wiązka),
//   Lampa     — okrągła lampa: „skop” rysuje luminofor do tekstury ping-pong (persystencja τ .5 s), „skop-blit” kładzie na
//               to scanlines, szkło i obudowę; bez WebGL2 ciemna tarcza; VU 12 diod,
//   Panele    — Fala (rysowanie okresu / 16 słupków harmonicznych), Barwa (≤4 pasma peaking jako pierścienie nad żywym
//               widmem), Obwiednia (punkty ADSR, pierścienie zgięć, bursztynowy pierścień obwiedni filtra); obraz 2D idzie
//               przez ukryty kontekst GL z shaderem „crt” (kopuła K .05, scanlines, winieta, połysk), bez GL: 2D z liniami.
// Stan edycji (fala `wt`, pasma `eq`, zgięcia `envC`) trzymają Panele (load / readInto jak w rf-25e); czasy i poziomy
// obwiedni czyta i pisze Studio (interfejs S: obw(), ustawObw(), analizator(), zmiana()). Ładowany PRZED studio.js.
// Pętlę klatek prowadzi Studio (rAF, gdy ekran otwarty): Lampa.rysuj(now) i Panele.rysuj(now) same ograniczają koszt.
const StudioEkrany=(function(){
  "use strict";
  const L=(pl,en)=>typeof RBJezyk!=="undefined"&&RBJezyk.wybierz?RBJezyk.wybierz(pl,en):pl;
  const zegar=()=>typeof performance!=="undefined"&&performance.now?performance.now():Date.now();
  const spokoj=()=>{try{return typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(e){return false;}};
  const rgb=c=>{c=String(c||"");let m=/^#([0-9a-f]{6})$/i.exec(c);
    if(m){const v=parseInt(m[1],16);return [(v>>16&255)/255,(v>>8&255)/255,(v&255)/255];}
    m=/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c);if(m)return [+m[1]/255,+m[2]/255,+m[3]/255];return [.925,.102,.514];};

  // ============================================================ GL: preludium i programy (kopia rf-24b PadPlate) ====
  const VS=`#version 300 es
in vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
  const PRE=`#version 300 es
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
vec4 touchC(vec2 uv,float asp){float s=0.;vec3 c=vec3(0.);for(int i=0;i<4;i++){if(i>=NP)break;
  vec2 d=(uv-P[i].xy)*vec2(asp,1.);float w=P[i].z*exp(-dot(d,d)*14.);s+=w;c+=PC[i]*w;}return vec4(c/max(s,1e-4),s);}
float ht(vec2 px,float v,float c,float a){mat2 r=mat2(cos(a),-sin(a),sin(a),cos(a));
  vec2 g=fract(r*px/c)-.5;float rad=sqrt(clamp(v,0.,1.))*.74;float w=1.2/c;
  return 1.-smoothstep(rad-w,rad+w,length(g));}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float lineAA(float d,float w){return 1.-smoothstep(w-.7,w+.7,d);}
float foot(vec2 px){return mix(.3,1.,smoothstep(12.,46.,px.y));}
vec3 paper(vec2 px){return PAPER*(.97+.03*vn(px*.6))*(.99+.01*vn(vec2(px.x*.05,px.y*2.)));}
float hangTape(vec2 uv,float s){return smoothstep(-.01,.01,uv.y-(1.-(s*.30+.012))+(vn(vec2(uv.x*22.,3.7))-.5)*.02);}
vec3 plate(vec2 px,vec2 uv,vec2 r);
void main(){vec2 r=R/DPR;vec2 px=gl_FragCoord.xy/DPR;o=vec4(plate(px,px/r,r),1.);}
`;
  // ---- szyba i obudowa okrągłej lampy (kopia SKOP_GLASS z rf-25c; F/K/HW = Lampa.F/K/HW) ----
  const SKOP_GLASS=`
const float F=12.,K=.30,HW=6.;
vec3 kHous(vec2 q,float sd,float Rg,vec2 px){
  if(sd>HW+1.)return BC[0];
  float l=max(length(q),1e-3);vec2 u=q/l;vec2 fp=px*.35;
  vec3 h=BC[1]*(.9+.14*(.5*vn(fp)+.25*vn(fp*2.03+17.1)+.094))*(.97+.03*vn(px*1.7));
  h*=1.-.6*(1.-smoothstep(0.,1.5,sd));
  h+=vec3(.07)*(1.-smoothstep(0.,.8,abs(sd-1.6)))*(.35+.65*smoothstep(-.6,.8,u.y));
  float n=floor(6.2832*(Rg+HW*.5)/14.+.5),s=(atan(u.x,u.y)/6.2832+.5)*n,t=fract(s);
  float st=smoothstep(.1,.2,t)*(1.-smoothstep(.6,.7,t))*(1.-smoothstep(.5,1.3,abs(sd-HW*.5)));
  h=mix(h,(mod(floor(s),2.)<.5?PINK:LIME)*.8,st*.7);
  h+=vec3(.045)*(1.-smoothstep(0.,1.2,abs(sd-HW+1.5)))*u.y;
  return mix(h,BC[0],smoothstep(-.6,.6,sd-HW));}
vec3 fin(vec3 col,vec2 px,vec2 r){
  vec2 q=px-r*.5;float Rg=max(min(r.x,r.y)*.5-F,1.);vec2 sc=q/Rg;float q2=dot(sc,sc),rho=sqrt(q2),sd=(rho-1.)*Rg;
  if(sd>=.8)return kHous(q,sd,Rg,px);
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
    float ae=(rho-.86)*Rg*.5,aw=(rho-.93)*Rg;
    if(abs(ae)<3.5||abs(aw)<4.){float an=atan(sc.y,sc.x);
      col+=vec3(.9,.95,1.)*.07*exp(-ae*ae)*smoothstep(-.7,-.44,an)*(1.-smoothstep(.09,.35,an));
      col+=vec3(.95,.97,1.)*.16*exp(-aw*aw*.8)*smoothstep(1.66,1.85,an)*(1.-smoothstep(2.45,2.62,an));}}
  if(sd<=-.8)return col;
  return mix(kHous(q,sd,Rg,px),col,1.-smoothstep(-.8,.8,sd));}
`;
  const FS={};
  FS.skop=`uniform float BK[8];uniform vec3 BC[2];uniform vec2 BL[12];uniform int NB;
`+SKOP_GLASS+`
float kSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-8),0.,1.);return length(pa-ba*h);}
vec3 kPhos(vec2 pc,float Rg,vec2 px){vec2 p=pc*Rg*.02,p2=p*2.03+17.1;
  float c=.5*vn(p)+.25*vn(p2)+.125*vn(p2*2.03+17.1)+.031;
  return (vec3(.012,.032,.024)+vec3(.018,.05,.034)*c)*(.92+.16*vn(px*.9));}
const float RW0=.70,RLO=.56,RHI=.84,SU0=.86,SUL=.12;
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
float wr(float t){return wf(t)+(WF[0]-WF[63])*smoothstep(.92,1.,t);}
float rr(float t,float amp){return clamp(RW0+wr(t)*amp,RLO,RHI);}
vec3 kPolar(vec3 col,vec2 sc,float rho,float th,float Rg){
  float gc=min(min(abs(rho-.3),abs(rho-.6)),abs(rho-.9))*Rg,gs=rho*Rg*abs(sin(th*25.13274))*.25;
  col+=vec3(.05,.14,.09)*(lineAA(gc,.5)*.4+lineAA(gs,.5)*.25*smoothstep(.2,.3,rho));
  col=kSun(col,sc,rho,th,Rg);
  float amp=min(.14,.04+LV*.14),rw=rr(th,amp),ra=rr(max(th-.004,0.),amp),rb=rr(min(th+.004,1.),amp),sl=(rb-ra)/.008;
  float sg=sl/(6.2832*max(rho,.05)),d1=max(abs(rho-rw)*Rg/sqrt(1.+sg*sg),max(max(min(ra,rb)-rho,rho-max(ra,rb)),0.)*Rg);
  float fl=1.-.6*step(.5,vn(vec2(T*14.,1.)))*step(.5,KI);
  vec3 c1=PINK*1.3*fl*(.5+LV*.8);
  col+=c1*(exp(-d1/7.)*.8+exp(-d1/28.)*.35+exp(-d1/90.)*.12);
  col=mix(col,vec3(1.,.9,.95),lineAA(d1,1.3)*(.6+LV*.4)*fl);
  vec2 pp=sc*Rg,hd=BL[NB-1]*Rg,b0=BL[0]*Rg;
  if(length(pp-(b0+hd)*.5)<length(hd-b0)*.5+70.){
    float dt=1e5;for(int i=0;i<11;i++){if(i>=NB-1)break;dt=min(dt,kSeg(pp,BL[i]*Rg,BL[i+1]*Rg));}
    float dh=length(pp-hd),cw=1.4+LV*1.6,dr=cw+.8,dk=.6+LV*.6,de=max(min(dt-cw,dh-dr),0.);
    col+=PINK*1.3*(exp(-de/4.)*.6+exp(-de/14.)*.25)*dk;
    col=mix(col,vec3(1.,.95,.97),(1.-smoothstep(cw-.6,cw+.4,dt))*min(1.,dk)*.85);
    col=mix(col,vec3(1.,.95,.97),(1.-smoothstep(dr-1.,dr+.5,dh))*min(1.,dk));}
  float fr=(24.+BA*10.)*.6;
  for(int i=0;i<4;i++){if(i>=NP)break;float a=P[i].x*6.2832,dd=abs(length(sc-vec2(sin(a),cos(a))*P[i].y)*Rg-fr);
    vec3 fc=PC[i]*1.3*P[i].z;col+=fc*(exp(-dd/6.)*.7+exp(-dd/24.)*.3);col=mix(col,mix(fc,vec3(1.),.6),lineAA(dd,1.2)*P[i].z);}
  return col;}
vec3 plate(vec2 px,vec2 uv,vec2 r){
  bool dir=BK[6]<0.;
  vec2 q=px-r*.5;float Rg=max(min(r.x,r.y)*.5-F,1.);vec2 sc=q/Rg;float q2=dot(sc,sc),rho=sqrt(q2);
  if((rho-1.)*Rg>=.8)return dir?fin(vec3(0.),px,r):vec3(0.);
  vec2 pc=sc*(1.+K*q2);
  float th=fract(atan(sc.x,sc.y)/6.2832+1.);
  vec3 col=kPolar(kPhos(pc,Rg,px),sc,rho,th,Rg);
  if(!dir){vec3 pv=texture(HT,uv).rgb;col=max(col,max(pv*BK[6]-1.5/255.,0.));}
  return dir?fin(col,px,r):col;}`;
  FS["skop-blit"]=`uniform vec3 BC[2];
`+SKOP_GLASS+`
vec3 plate(vec2 px,vec2 uv,vec2 r){return fin(texture(HT,uv).rgb,px,r);}`;
  // ---- szkło paneli (kopia „crt” z rf-25e): BK = [kopuła, scanlines, winieta, połysk] ----
  FS.crt=`uniform float BK[4];
vec3 crtTap(vec2 t){vec2 h=.5/R;return texture(HT,clamp(t,h,1.-h)*HS).rgb;}
vec3 plate(vec2 px,vec2 uv,vec2 r){
  vec2 sc=(uv-.5)*2.;float q2=dot(sc,sc);
  vec2 pc=sc*(1.+BK[0]*q2),t=pc*.5+.5;
  vec2 d=1.5/r;
  vec3 col=crtTap(t);
  col+=.0625*(crtTap(t+vec2(d.x,0.))+crtTap(t-vec2(d.x,0.))+crtTap(t+vec2(0.,d.y))+crtTap(t-vec2(0.,d.y)));
  col*=1.-BK[1]*(.5+.5*cos(t.y*R.y*2.0944));
  vec2 o2=max(-t,t-1.)*r;float fo=max(o2.x,o2.y);
  col=mix(col,vec3(.024,.036,.031),smoothstep(-.5,.8,fo));
  col*=1.-BK[2]*smoothstep(.6,1.2,length(sc));
  vec2 hd=(sc-vec2(-.55,.6))/vec2(.55,.45);col+=vec3(.85,.92,1.)*.06*BK[3]*exp(-dot(hd,hd));
  float tb=(1.-sc.y)*r.y*.5-4.;
  col+=vec3(.9,.95,1.)*.05*BK[3]*exp(-tb*tb*.35)*(1.-smoothstep(.55,.95,abs(sc.x+.1)));
  return col;}`;
  const UNI=["R","T","LV","BA","MI","HI","KI","DPR","NP","SP","WF","P","HT","HS","HC","PC","SC","SPL","BL","BC","NB","BK"];
  const GL={
    FS,PRE,
    // kontekst na nowym canvasie wstawionym jako pierwsze dziecko `wrap` (null = brak WebGL2)
    mk(wrap,klasa){
      if(typeof document==="undefined")return null;
      const cv=document.createElement("canvas");cv.className=klasa||"st-gl";cv.setAttribute("aria-hidden","true");cv.style.width=cv.style.height="100%";
      let gl=null;try{gl=cv.getContext("webgl2",{alpha:false,antialias:false,preserveDrawingBuffer:false});}catch(e){gl=null;}
      if(!gl)return null;
      const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
      if(wrap)wrap.insertBefore(cv,wrap.firstChild);
      return {cv,gl,wrap,progs:{},pts:{}};},
    prog(st,id){
      if(st.progs[id])return st.progs[id];
      const gl=st.gl,sh=(t,src)=>{const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(id+": "+gl.getShaderInfoLog(s));return s;};
      const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,PRE+FS[id]));
      gl.bindAttribLocation(pr,0,"a");gl.linkProgram(pr);
      if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(id+": "+gl.getProgramInfoLog(pr));
      const u={};for(const n of UNI)u[n]=gl.getUniformLocation(pr,n);
      return st.progs[id]={pr,u};},
    zgub(st){if(!st)return;try{const x=st.gl&&st.gl.getExtension("WEBGL_lose_context");if(x)x.loseContext();}catch(e){}
      if(st.cv&&st.cv.parentNode)st.cv.parentNode.removeChild(st.cv);}};

  // ============================================================ cechy dźwięku (kopia PadPlate._feat bez padów) ====
  // A = {an, fq, td, sampleRate} z Glos.podglad().analizator() albo null; nuty = [{id, polton, kolor}] trzymane teraz
  // (żabki na obręczy: x = klasa wysokości jako ułamek obrotu od 12, y = promień .9); dt w ms.
  function surowe(A){
    const sp=new Float32Array(16),wf=new Float32Array(64);let lv=0,ba=0,mi=0,hi=0;
    if(!A)return {sp,wf,lv,ba,mi,hi};
    const an=A.an,fq=A.fq,td=A.td;an.getByteFrequencyData(fq);an.getFloatTimeDomainData(td);
    const hz=(A.sampleRate>0?A.sampleRate:48000)/an.fftSize;
    const avg=(lo,hi2)=>{const a=Math.max(1,Math.round(lo/hz)),z=Math.min(fq.length-1,Math.round(hi2/hz));let s=0;for(let i=a;i<=z;i++)s+=fq[i];return s/Math.max(1,z-a+1)/255;};
    for(let i=0;i<16;i++)sp[i]=Math.pow(avg(60*Math.pow(200,i/16),60*Math.pow(200,(i+1)/16)),1.4);
    ba=avg(40,250);mi=avg(250,2000);hi=avg(2000,10000);
    let q=0;for(let i=0;i<td.length;i++)q+=td[i]*td[i];lv=Math.min(1,Math.sqrt(q/td.length)*3.2);
    let z=0;for(let i=1;i<td.length-1100;i++){if(td[i-1]<0&&td[i]>=0){z=i;break;}}
    let pk=.05;for(let i=0;i<64;i++){let s=0;for(let j=0;j<16;j++)s+=td[z+i*16+j]||0;wf[i]=s/16;pk=Math.max(pk,Math.abs(wf[i]));}
    for(let i=0;i<64;i++)wf[i]/=pk;
    return {sp,wf,lv,ba,mi,hi};}
  function cechy(st,A,dtMs,nuty){
    const f=st.f||(st.f={lv:0,ba:0,mi:0,hi:0,ki:0,slow:0,lastHit:0,hits:0,sp:new Float32Array(16),wf:new Float32Array(64),keys:""});
    let s;try{s=surowe(A);}catch(e){s=surowe(null);}
    const k=tau=>1-Math.exp(-dtMs/tau);
    f.lv+=(s.lv-f.lv)*k(s.lv>f.lv?40:220);f.ba+=(s.ba-f.ba)*k(s.ba>f.ba?50:260);
    f.mi+=(s.mi-f.mi)*k(120);f.hi+=(s.hi-f.hi)*k(90);f.slow+=(s.lv-f.slow)*k(420);
    for(let i=0;i<16;i++)f.sp[i]+=(s.sp[i]-f.sp[i])*k(s.sp[i]>f.sp[i]?45:260);
    for(let i=0;i<64;i++)f.wf[i]+=(s.wf[i]-f.wf[i])*k(35);
    const keys=(nuty||[]).map(n=>n.id).sort().join("|"),fresh=keys&&keys!==f.keys&&keys.length>=f.keys.length;f.keys=keys;
    const now=zegar();
    if((s.lv-f.slow>.09||fresh)&&now-f.lastHit>110){f.ki=1;f.lastHit=now;f.hits++;}
    f.ki*=Math.exp(-dtMs/260);
    const pts=st.pts;for(const id in pts)pts[id].on=false;
    for(const n of nuty||[]){let p=pts[n.id];if(!p)p=pts[n.id]={s:0,seed:(Math.random()*7)|0,rgb:rgb(n.kolor||"#ec1a83")};
      const pcl=((n.polton%12)+12)%12;p.x=pcl/12;p.y=Lampa.FROG_R;p.s+=(.55+f.lv*.6-p.s)*k(60);p.on=true;}
    for(const id in pts){const p=pts[id];if(!p.on){p.s*=Math.exp(-dtMs/900);if(p.s<.02)delete pts[id];}}
    return f;}

  // ============================================================ M: matematyka (kopia czystych funkcji SoundScreens) ====
  const M={
    RING0:.70,RING_LO:.56,RING_HI:.84,SUN0:.86,SUN_L:.12,
    EQ_F0:40,EQ_F1:16000,EQ_G:18,EQ_Y:.5,EQ_A:.38,
    ENV_X0:.04,ENV_X1:.96,ENV_H:.22,ENV_Y0:.06,ENV_Y1:.94,ENV_FZ:.5,ENV_FA:.4,
    shape(w){const c=this._shapes||(this._shapes={});if(c[w])return c[w];const o=new Float32Array(64);
      for(let n=0;n<64;n++){const ph=n/64;o[n]=w==="square"?(ph<.5?1:-1):w==="sawtooth"?(ph<.5?2*ph:2*ph-2):w==="triangle"?(ph<.25?4*ph:(ph<.75?2-4*ph:4*ph-4)):Math.sin(2*Math.PI*ph);}
      return c[w]=o;},
    sine(){return Float32Array.from(this.shape("sine"));},
    dft(wt){const N=wt.length,K=N>>1,real=new Float32Array(K+1),imag=new Float32Array(K+1);
      for(let k=1;k<=K;k++){let a=0,b=0;for(let n=0;n<N;n++){const ang=2*Math.PI*k*n/N,v=+wt[n]||0;a+=v*Math.cos(ang);b+=v*Math.sin(ang);}
        const sc=(k===K?1:2)/N;real[k]=a*sc;imag[k]=b*sc;}
      return {real,imag};},
    fromHarmonics(amps){const o=new Float32Array(64),Mx=Math.min(32,amps.length);
      for(let n=0;n<64;n++){let s=0;for(let k=0;k<Mx;k++)s+=(+amps[k]||0)*Math.sin(2*Math.PI*(k+1)*n/64);o[n]=s;}
      let m=0;for(let n=0;n<64;n++)m+=o[n];m/=64;let pk=0;for(let n=0;n<64;n++){o[n]-=m;pk=Math.max(pk,Math.abs(o[n]));}
      if(pk>1e-9)for(let n=0;n<64;n++)o[n]/=pk;return o;},
    harmonicsOf(wt){const d=this.dft(wt),o=new Float32Array(16);let mx=0;
      for(let k=0;k<16;k++){o[k]=Math.hypot(d.real[k+1]||0,d.imag[k+1]||0);mx=Math.max(mx,o[k]);}
      if(mx>1e-9)for(let k=0;k<16;k++)o[k]/=mx;return o;},
    smooth(wt){const N=wt.length,o=new Float32Array(N);for(let n=0;n<N;n++)o[n]=.25*wt[(n+N-1)%N]+.5*wt[n]+.25*wt[(n+1)%N];return o;},
    vuLeds(lv){lv=+lv;if(!(lv>=.02))return 0;if(lv>=.9)return 12;return Math.min(11,1+Math.floor(11*Math.log(lv/.02)/Math.log(.9/.02)));},
    fx(x){return this.EQ_F0*Math.pow(this.EQ_F1/this.EQ_F0,x);},
    xf(f){return Math.log(f/this.EQ_F0)/Math.log(this.EQ_F1/this.EQ_F0);},
    gy(g){return Math.max(0,Math.min(1,this.EQ_Y+g/this.EQ_G*this.EQ_A));},
    yg(y){return Math.max(-this.EQ_G,Math.min(this.EQ_G,(y-this.EQ_Y)/this.EQ_A*this.EQ_G));},
    eqR(q){return Math.max(7,Math.min(24,7+14/q));},
    eqMag(bands,fHz,sampleRate){const fs=sampleRate>0?sampleRate:48000;if(!Array.isArray(bands)||!bands.length)return 0;
      const w=2*Math.PI*fHz/fs,cw=Math.cos(w),sw=Math.sin(w),c2=Math.cos(2*w),s2=Math.sin(2*w);let db=0;
      for(const b of bands){const f0=+b.f,g=+b.g,q=+b.q;if(!(f0>0&&f0<fs/2)||!g||!(q>0))continue;
        const A=Math.pow(10,g/40),w0=2*Math.PI*f0/fs,al=Math.sin(w0)/(2*q),k=-2*Math.cos(w0);
        const b0=1+al*A,b2=1-al*A,a0=1+al/A,a2=1-al/A;
        const nr=b0+k*cw+b2*c2,ni=-(k*sw+b2*s2),dr=a0+k*cw+a2*c2,di=-(k*sw+a2*s2);
        db+=10*Math.log10((nr*nr+ni*ni)/(dr*dr+di*di));}
      return db;},
    eqCurve(bands,sampleRate){const o=new Float32Array(64);for(let i=0;i<64;i++)o[i]=this.eqMag(bands,this.fx(i/63),sampleRate);return o;},
    envK(c){c=+c||0;return c<=0?3*Math.pow(4,-c):(c<=.5?3*(1-2*c):-12*(c-.5));},
    envShape(s,c){s=s<=0?0:(s>=1?1:s);const k=this.envK(c);
      return k>1e-6?(1-Math.exp(-k*s))/(1-Math.exp(-k)):(k<-1e-6?(Math.exp(-k*s)-1)/(Math.exp(-k)-1):s);},
    envInv(y,c){y=y<=0?0:(y>=1?1:y);const k=this.envK(c);
      return k>1e-6?-Math.log(1-y*(1-Math.exp(-k)))/k:(k<-1e-6?Math.log(1+y*(Math.exp(-k)-1))/-k:y);},
    envMid(c){return this.envShape(.5,c);},
    envCOf(f){f=+f;if(!Number.isFinite(f))f=0;let lo=-1,hi=1;if(f>=this.envMid(-1))return -1;if(f<=this.envMid(1))return 1;
      for(let i=0;i<50;i++){const m=(lo+hi)/2;if(this.envMid(m)>f)lo=m;else hi=m;}return (lo+hi)/2;},
    envLayout(att,dec,sus,rel,legato,spu){
      const X0=this.ENV_X0,Y0=this.ENV_Y0,Y1=this.ENV_Y1,H=legato?this.ENV_H:0;
      const A=Math.max(0,+att||0),D=Math.max(0,+dec||0),R=legato?Math.max(0,+rel||0):0;
      const k=spu>0?spu:((A+D+R)/(this.ENV_X1-X0-H)||1);
      const ys=legato?Y0+Math.max(0,Math.min(1,+sus||0))*(Y1-Y0):Y0;
      const o={legato:!!legato,spu:k,ys,x0:X0,start:{x:X0,y:Y0},a:{x:X0+A/k,y:Y1},d:{x:X0+(A+D)/k,y:ys}};
      if(legato){o.s={x:o.d.x+H,y:ys};o.r={x:o.s.x+R/k,y:Y0};}
      o.end=legato?o.r.x:o.d.x;
      o.segs=[[o.start,o.a,0],[o.a,o.d,1]];if(legato)o.segs.push([o.s,o.r,2]);
      return o;},
    xOfT(lay,t){return lay.x0+t/lay.spu;},
    envPoly(lay,c){const X=new Float32Array(32),Y=new Float32Array(32),n=lay.legato?[9,9,9]:[14,15];let j=0;
      const put=(x,y)=>{if(j<32){X[j]=x;Y[j]=y;j++;}};
      put(Math.min(-.06,lay.start.x-.1),this.ENV_Y0);put(lay.start.x,lay.start.y);
      lay.segs.forEach(([p,q,i],si)=>{if(si===2)put(lay.s.x,lay.s.y);const cc=c[i]||0;
        for(let k=1;k<=n[si];k++){const u=k/n[si],s=(u+this.envInv(u,cc))/2;put(p.x+(q.x-p.x)*s,p.y+(q.y-p.y)*this.envShape(s,cc));}});
      put(Math.max(1.06,lay.end+.1),this.ENV_Y0);while(j<32)put(X[j-1],Y[j-1]);return {x:X,y:Y};},
    envFilter(fEnv,fEnvT,spu){const o=new Float32Array(64),T=Math.max(.001,+fEnvT||.2),a=Math.max(-1,Math.min(1,+fEnv||0));
      for(let i=0;i<64;i++){const t=Math.max(0,(i/63-this.ENV_X0)*spu);o[i]=this.ENV_FZ+a*this.ENV_FA*Math.exp(-3*t/T);}return o;},
    envHandles(lay,c,fEnv,fEnvT){const h=[{id:"a",kind:1,x:lay.a.x,y:lay.a.y},{id:"d",kind:1,x:lay.d.x,y:lay.d.y}];
      if(lay.legato)h.push({id:"r",kind:1,x:lay.r.x,y:lay.r.y});
      for(const [p,q,i] of lay.segs){if(Math.abs(q.y-p.y)<.02)continue;h.push({id:"c"+i,kind:2,ci:i,x:(p.x+q.x)/2,y:p.y+(q.y-p.y)*this.envMid(c[i]||0)});}
      h.push({id:"f",kind:3,x:Math.min(.98,this.xOfT(lay,Math.max(0,+fEnvT||0))),y:this.ENV_FZ+Math.max(-1,Math.min(1,+fEnv||0))*this.ENV_FA});
      return h;}};

  // ============================================================ Lampa (kopia rf-25c SoundScreens bez edycji) ====
  const Lampa={
    F:12,HW:6,K:.30,TAU:.5,KICK:4.5,FROG_R:.9,
    BEAM_R:.42,BEAM_A0:.24,BEAM_A1:.12,BEAM_FA:.41,BEAM_FB:.29,BEAM_FC:.025,BEAM_S:2.2,BEAM_W:.12,BEAM_N:12,BEAM_IDLE_MS:30,
    _st:null,_fail:false,_last:-1,_kick:0,_dirty:true,_wasLive:false,_vuN:-1,_BC:null,
    phosDecay(dtMs,still){return still?0:Math.exp(-Math.max(0,+dtMs||0)/1000/this.TAU);},
    beamStep(bm,dt,lv){const s=1+this.BEAM_S*Math.min(1,Math.max(0,+lv||0)),t=Math.max(0,+dt||0)/1000;
      return {a:bm.a+t*this.BEAM_FA*s,b:bm.b+t*this.BEAM_FB*s,c:bm.c+t*this.BEAM_FC};},
    beamAt(ph,lv,wf){const Lv=Math.min(1,Math.max(0,+lv||0)),TP=2*Math.PI,A=this.BEAM_A0+this.BEAM_A1*Lv;
      const x0=Math.sin(TP*ph.a),y0=Math.sin(TP*ph.b+Math.PI/4),cr=Math.cos(TP*ph.c),sr=Math.sin(TP*ph.c);
      let w=1;if(wf&&Lv>0){const i=Math.floor((((ph.a*16)%1)+1)%1*64)&63;w=1+this.BEAM_W*Lv*Math.max(-1,Math.min(1,+wf[i]||0));}
      let x=A*w*(x0*cr-y0*sr),y=A*w*(x0*sr+y0*cr);const r=Math.hypot(x,y);
      if(r>this.BEAM_R){x*=this.BEAM_R/r;y*=this.BEAM_R/r;}return [x,y];},
    beamPath(p0,p1,lv,wf,out){const N=this.BEAM_N;
      for(let k=0;k<N;k++){const u=k/(N-1),q=this.beamAt({a:p0.a+(p1.a-p0.a)*u,b:p0.b+(p1.b-p0.b)*u,c:p0.c+(p1.c-p0.c)*u},lv,wf);out[2*k]=q[0];out[2*k+1]=q[1];}
      return N;},
    // glass = kwadratowe pudło tarczy (canvas GL + nakładka 2D wewnątrz), opts: analizator() → A|null, nuty() → [...], vu = element diod
    init(glass,opts){this._g=glass;this._o=opts||{};this._ov=glass.querySelector(".st-lampa-nakladka");this._req();
      if(typeof ResizeObserver==="function"){try{new ResizeObserver(()=>this._req()).observe(glass);}catch(e){}}},
    _req(){this._kick=zegar();this._dirty=true;},
    _vu(lv){const n=M.vuLeds(lv);if(n===this._vuN)return;this._vuN=n;const el=this._o.vu;if(!el)return;
      const Ls=el.children;for(let i=0;i<Ls.length;i++)Ls[i].classList.toggle("on",i<n);},
    spij(){this._vu(0);this._fail=false;const s=this._st;
      if(s){s.f=null;s.spl=null;s.pts={};s.last=0;const P=s.pp,gl=s.gl;
        if(P&&gl){try{for(const f of P.fb){gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);}gl.bindFramebuffer(gl.FRAMEBUFFER,null);}catch(e){}}}
      this._dirty=true;},
    zgub(){const s=this._st;this._st=null;this._BC=null;this._fail=false;if(s)GL.zgub(s);},
    _bcol(){if(this._BC)return this._BC;const o=new Float32Array([.984,.969,.933,.173,.169,.165]);
      try{const el=this._g.parentElement,cs=el&&getComputedStyle(el),bg=cs?cs.backgroundColor||"":"";
        if(/^rgb/.test(bg)&&!/,\s*0\)$/.test(bg))o.set(rgb(bg),0);}catch(e){}
      return this._BC=o;},
    _pp(st,pw,ph){const gl=st.gl;let P=st.pp;if(P&&P.w===pw&&P.h===ph)return P;
      const free=X=>{if(!X)return;X.tex.forEach(t=>gl.deleteTexture(t));X.fb.forEach(f=>gl.deleteFramebuffer(f));};
      free(P);st.pp=null;P={w:pw,h:ph,i:0,tex:[],fb:[]};let ok=true;
      for(let k=0;k<2&&ok;k++){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,pw,ph,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        for(const [a,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,a,v);
        const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
        P.tex.push(t);P.fb.push(f);ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
        if(ok){gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);}}
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);
      if(!ok){free(P);st.noPersist=true;return null;}return st.pp=P;},
    // jedna klatka: `now` = znacznik klatki (document.timeline.currentTime). Zwraca true, gdy obraz jeszcze żyje (dźwięk,
    // ślad, wiązka), czyli następna klatka jest potrzebna.
    rysuj(now){
      const g=this._g;if(!g||g.offsetParent===null)return false;
      const W=g.clientWidth,H=g.clientHeight;if(!W||!H)return false;
      const still=spokoj(),beam=!!this._st&&!this._fail&&!still;
      if(now===this._last)return this._wasLive||this._dirty||beam;
      if(!this._dirty&&!this._wasLive&&!this._o.zywe()){if(!beam)return false;if(now-this._last<this.BEAM_IDLE_MS)return true;}
      this._last=now;this._dirty=false;
      const dpr=window.devicePixelRatio||1;let live=false;
      if(!this._fail){try{live=this._render(g,W,H,dpr,now,still);}catch(e){console.warn("[studio-ekrany] lampa",e);this.zgub();this._fail=true;}}
      if(this._fail){const A=this._o.analizator();let lv=0;if(A){try{lv=surowe(A).lv;}catch(e){}}this._vu(lv);live=lv>.004;}
      this._nakladka(W,H,dpr);this._wasLive=live;
      return live||(!!this._st&&!this._fail&&!still);},
    _render(wrap,W,H,dpr,now,still){
      let st=this._st;
      if(st&&(st.wrap!==wrap||!st.cv.isConnected||st.gl.isContextLost())){this.zgub();st=null;}
      if(!st){st=GL.mk(wrap,"st-gl");if(!st){this._fail=true;return false;}this._st=st;}
      const pg=GL.prog(st,"skop"),dt=st.last?Math.min(100,now-st.last):16.67;st.last=now;
      const f=cechy(st,this._o.analizator(),dt,this._o.nuty());
      const pw=Math.round(W*dpr),ph=Math.round(H*dpr);
      if(st.cv.width!==pw||st.cv.height!==ph){st.cv.width=pw;st.cv.height=ph;}
      const gl=st.gl,u=pg.u,bc=this._bcol(),dec=this.phosDecay(dt,still);
      let pp=dec>0&&!st.noPersist?this._pp(st,pw,ph):null,bp=null;
      if(pp){try{bp=GL.prog(st,"skop-blit");}catch(e){console.warn("[studio-ekrany]",e);st.noPersist=true;pp=null;}}
      if(pp){gl.bindFramebuffer(gl.FRAMEBUFFER,pp.fb[1-pp.i]);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,pp.tex[pp.i]);}
      gl.viewport(0,0,pw,ph);gl.useProgram(pg.pr);
      gl.uniform2f(u.R,pw,ph);gl.uniform1f(u.DPR,dpr);gl.uniform1f(u.T,still?0:now/1000);
      gl.uniform1f(u.LV,f.lv);gl.uniform1f(u.BA,f.ba);gl.uniform1f(u.MI,still?0:f.mi);gl.uniform1f(u.HI,still?0:f.hi);
      gl.uniform1f(u.KI,still?0:f.ki);gl.uniform1f(u.HC,f.hits||0);
      gl.uniform1fv(u.SP,f.sp);gl.uniform1fv(u.WF,f.wf);
      const list=Object.values(st.pts).sort((a,b)=>b.s-a.s).slice(0,4),P=new Float32Array(16);
      list.forEach((p,i)=>{P[i*4]=p.x;P[i*4+1]=p.y;P[i*4+2]=p.s;P[i*4+3]=p.seed;});
      gl.uniform4fv(u.P,P);gl.uniform1i(u.NP,list.length);
      const PC=new Float32Array(12);list.forEach((p,i)=>PC.set(p.rgb||[.925,.102,.514],i*3));gl.uniform3fv(u.PC,PC);
      gl.uniform3fv(u.SC,new Float32Array([.925,.102,.514,.424,.702,.247,.2,.24,.45]));
      const spl=st.spl||(st.spl=new Float32Array(16));let lit=0;
      for(let i=0;i<16;i++){const v=f.sp[i];spl[i]+=(v-spl[i])*(1-Math.exp(-dt/(v>spl[i]?160:600)));lit=Math.max(lit,spl[i],f.sp[i]);}
      gl.uniform1fv(u.SPL,spl);
      const bl=st.bl||(st.bl=new Float32Array(2*this.BEAM_N));let nb=1;
      if(still){bl[0]=bl[1]=0;}
      else{const b0=st.bm||(st.bm={a:Math.random(),b:Math.random(),c:Math.random()}),b1=this.beamStep(b0,dt,f.lv);nb=this.beamPath(b0,b1,f.lv,f.wf,bl);st.bm=b1;}
      gl.uniform2fv(u.BL,bl);gl.uniform1i(u.NB,nb);
      const bk=st.bk||(st.bk=new Float32Array(8));bk.fill(0);bk[6]=pp?dec:-1;gl.uniform1fv(u.BK,bk);
      gl.uniform1i(u.HT,0);gl.uniform3fv(u.BC,bc);
      gl.drawArrays(gl.TRIANGLES,0,3);
      if(pp){const v=bp.u;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,pw,ph);gl.useProgram(bp.pr);
        gl.bindTexture(gl.TEXTURE_2D,pp.tex[1-pp.i]);
        gl.uniform2f(v.R,pw,ph);gl.uniform1f(v.DPR,dpr);gl.uniform1i(v.HT,0);gl.uniform3fv(v.BC,bc);
        gl.drawArrays(gl.TRIANGLES,0,3);gl.bindTexture(gl.TEXTURE_2D,null);pp.i=1-pp.i;}
      this._vu(f.lv);this.F_=f;
      return f.lv>.004||f.ki>.03||list.length>0||lit>.004||(!!pp&&now-(this._kick||0)<this.KICK*this.TAU*1000);},
    _nakladka(W,H,dpr){const cv=this._ov;if(!cv)return;
      const pw=Math.round(W*dpr),ph=Math.round(H*dpr);if(cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph;}
      const x=cv.getContext("2d");if(!x)return;x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
      if(!this._fail)return;
      const cx=W/2,cy=H/2,R=Math.max(1,Math.min(W,H)/2-this.F);
      x.fillStyle="#2c2b2a";x.beginPath();x.arc(cx,cy,R+this.HW,0,2*Math.PI);x.fill();
      x.fillStyle="#121413";x.beginPath();x.arc(cx,cy,R,0,2*Math.PI);x.fill();}};

  // ============================================================ Panele (port rf-25e SoundEditors) ====
  const Panele={
    FR:6,PAD:10,RAD:18,RS:8,STITCH:14,DASH:8,
    K:.05,CRT_S:.09,CRT_V:.25,CRT_G:1,LIVE_TAU:.15,
    DRAW_Y:.5,DRAW_A:.35,BAR0:.07,BARH:.46,HARM_Y:.73,HARM_A:.17,
    EQ_MAX:4,EQ_QMIN:.3,EQ_QMAX:12,EQ_HIT:18,EQ_QWHEEL:1.12,EQ_QBTN:1.25,
    R_PT:14,R_BEND:9,R_FILT:12,ENV_HIT:20,
    KB_F:1.03,KB_FS:1.1,KB_G:.5,KB_GS:2,KB_BAR:.05,KB_C:.05,KB_CS:.25,
    C:{lime:"#a6d861",pink:"#ec1a83",yel:"#FFE236",amb:"#eaa32b",bend:"#e6f6e0",ink:"#353534",
       grid:"rgba(120,200,150,.13)",grid2:"rgba(120,200,150,.3)",ph:"rgba(204,246,210,.92)",phd:"rgba(204,246,210,.62)"},
    ch:"wave",mode:"draw",_wt:null,_harm:null,_eq:[],_eqSel:-1,_envC:[0,0,0],_bar:0,_envSel:"a",
    _pen:null,_hover:null,_ov:null,_ed:null,_dirty:null,_last:-1,_wasLive:false,_F:null,_tl:0,_liveT:-1e12,_now:null,_post:null,S:null,
    // ---- geometria ----
    _plot(W,H){const m=this.PAD;return {x0:m,x1:Math.max(m+1,W-m),y0:Math.max(m+1,H-m),y1:m};},
    _lin(x,y,W,H){const p=this._plot(W,H);return {x:p.x0+x*(p.x1-p.x0),y:p.y0-y*(p.y0-p.y1)};},
    _unlin(px,py,W,H){const p=this._plot(W,H);return {x:(px-p.x0)/(p.x1-p.x0),y:(p.y0-py)/(p.y0-p.y1)};},
    _toPic(px,py,W,H,k){if(!k)return {x:px,y:py};const sx=2*px/W-1,sy=1-2*py/H,f=1+k*(sx*sx+sy*sy);return {x:(sx*f+1)*W/2,y:(1-sy*f)*H/2};},
    _toScr(px,py,W,H,k){if(!k)return {x:px,y:py};const ux=2*px/W-1,uy=1-2*py/H,r=Math.hypot(ux,uy);if(r<1e-12)return {x:px,y:py};
      let q=r;for(let i=0;i<4;i++)q-=(q+k*q*q*q-r)/(1+3*k*q*q);const s=q/r;return {x:(ux*s+1)*W/2,y:(1-uy*s)*H/2};},
    _dk(){return this._post?this.K:0;},
    picToCv(x,y,W,H,k){const c=this._lin(x,y,W,H);return this._toScr(c.x,c.y,W,H,k==null?this._dk():k);},
    cvToPic(px,py,W,H,k){const c=this._toPic(px,py,W,H,k==null?this._dk():k);return this._unlin(c.x,c.y,W,H);},
    rrPerim(w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));return 2*(w+h)-8*r+2*Math.PI*r;},
    stitchN(P){return Math.max(2,2*Math.round(P/(2*this.STITCH)));},
    _rr(x,X,Y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));x.beginPath();x.moveTo(X+r,Y);x.lineTo(X+w-r,Y);x.arc(X+w-r,Y+r,r,-Math.PI/2,0);x.lineTo(X+w,Y+h-r);
      x.arc(X+w-r,Y+h-r,r,0,Math.PI/2);x.lineTo(X+r,Y+h);x.arc(X+r,Y+h-r,r,Math.PI/2,Math.PI);x.lineTo(X,Y+r);x.arc(X+r,Y+r,r,Math.PI,1.5*Math.PI);x.closePath();},
    // rama: grafitowy filc z ziarnem, rowek przy ekranie, ścieg róż/limonka (cienki tryb 6 px jak w panelu po 10-03)
    frame(x,W,H,FR){FR=FR>0?FR:this.FR;const R=this.RAD,S=this.RS;
      x.save();this._rr(x,0,0,W,H,R);x.fillStyle="#23221f";x.fill();
      const t=this._tile(),pat=t&&typeof x.createPattern==="function"?x.createPattern(t,"repeat"):null;
      if(pat){x.clip();x.fillStyle=pat;x.fillRect(0,0,W,H);}x.restore();
      x.lineWidth=1;x.strokeStyle="rgba(0,0,0,.6)";this._rr(x,FR-.5,FR-.5,W-2*FR+1,H-2*FR+1,S+.5);x.stroke();
      const si=FR/2,sr=Math.max(2,R-si),P=this.rrPerim(W-2*si,H-2*si,sr),n=this.stitchN(P),st=P/n,lw=1.6,d=Math.max(1,st*this.DASH/this.STITCH-lw);
      x.save();x.lineWidth=lw;x.lineCap="round";x.globalAlpha=.9;x.setLineDash([d,2*st-d]);
      for(const [c,o] of [[this.C.pink,0],[this.C.lime,st]]){x.strokeStyle=c;x.lineDashOffset=o;this._rr(x,si,si,W-2*si,H-2*si,sr);x.stroke();}
      x.setLineDash([]);x.restore();return n;},
    _tile(){if(this._tl!==0)return this._tl;this._tl=null;
      try{const c=document.createElement("canvas");c.width=c.height=96;const x=c.getContext("2d");if(!x)return null;
        for(let j=0;j<32;j++)for(let i=0;i<32;i++){let h=Math.sin(i*127.1+j*311.7)*43758.5453;h-=Math.floor(h);
          const al=(Math.abs(h-.5)*.05).toFixed(4);x.fillStyle=h<.5?"rgba(0,0,0,"+al+")":"rgba(255,255,255,"+al+")";x.fillRect(i*3,j*3,3,3);}
        this._tl=c;}catch(e){this._tl=null;}return this._tl;},
    // ---- stan edycji: wczytanie z parametrów Studia i zapis z powrotem (jak rf-25e load/readInto) ----
    readInto(p){if(!p)return p;
      p.eq=this._eq.map(b=>({f:Math.round(b.f),g:Math.round(b.g*10)/10,q:Math.round(b.q*100)/100}));
      p.envC=this._envC.map(v=>Math.round(v*100)/100||0);
      if(p.fala!=="custom"){p.wt=null;return p;}
      const w=this._wt||M.shape("sine");p.wt=Array.from(w,v=>Math.round(Math.max(-1,Math.min(1,+v||0))*1000)/1000);return p;},
    load(p){const ok=!!p&&p.fala==="custom"&&Array.isArray(p.wt)&&p.wt.length===64,fin=v=>typeof v==="number"&&Number.isFinite(v);
      this._wt=ok?Float32Array.from(p.wt,v=>Math.max(-1,Math.min(1,+v||0))):null;
      this._eq=(p&&Array.isArray(p.eq)?p.eq:[]).filter(b=>b&&fin(b.f)&&fin(b.g)&&fin(b.q)).slice(0,this.EQ_MAX).map(b=>({f:b.f,g:b.g,q:b.q}));
      this._envC=(p&&Array.isArray(p.envC)&&p.envC.length===3&&p.envC.every(fin))?p.envC.map(v=>Math.max(-1,Math.min(1,v))):[0,0,0];
      this._harm=null;this._pen=null;this._eqSel=-1;this._syncTools();this._req();},
    _isCustom(){return this.S.fala()==="custom";},
    _curve(){return this._isCustom()?(this._wt||M.shape("sine")):M.shape(this.S.fala());},
    _bars(){return this._harm||(this._harm=M.harmonicsOf(this._curve()));},
    _req(k){const d=this._dirty||(this._dirty={});if(k)d[k]=1;else d.wave=d.eq=d.env=1;},
    _envVals(){const v=this.S.obw();return {legato:true,att:v.att,dec:v.dec,sus:v.sus,rel:v.rel,fEnv:v.fEnv,fEnvT:v.fEnvT};},
    _envLay(v){const P=this._pen;return M.envLayout(v.att,v.dec,v.sus,v.rel,true,P&&P.env?P.spu:0);},
    _sr(){return this.S.sampleRate()||48000;},
    TOOLS:{wave:[["mode","draw",L("Rysuj","Draw"),L("Rysuj palcem albo myszą jeden okres fali","Draw one period of the wave with a finger or the mouse")],
                  ["mode","harm",L("Harmoniczne","Harmonics"),L("Ustaw głośność 16 harmonicznych, jak suwaki w organach","Set the level of 16 harmonics, like organ drawbars")],
                  ["act","smooth",L("Wygładź","Smooth"),L("Wygładź kształt fali: barwa robi się łagodniejsza","Smooth the wave: the tone gets softer")],
                  ["act","clear",L("Wyczyść","Clear"),L("Zacznij od czystego sinusa","Start from a clean sine")]],
           eq:[["act","eq-add",L("+ Pasmo","+ Band"),L("Dodaj pasmo przy 1 kHz (najwyżej cztery)","Add a band at 1 kHz (four at most)")],
               ["act","eq-del",L("Usuń pasmo","Remove band"),L("Usuń wybrane pasmo","Remove the picked band")],
               ["act","eq-qm","Q −",L("Szersze pasmo: mniejsze Q","Wider band: smaller Q")],
               ["act","eq-qp","Q +",L("Węższe pasmo: większe Q","Narrower band: bigger Q")],
               ["act","eq-zero",L("Wyzeruj","Reset"),L("Usuń wszystkie pasma: brzmienie bez korektora","Remove every band: no equaliser")]],
           env:[["act","env-reset",L("Domyślny kształt","Default shape"),L("Przywróć wszystkim odcinkom domyślny kształt","Give every segment its default shape back")],
                ["act","env-nofilt",L("Bez obwiedni filtra","No filter envelope"),L("Ustaw obwiednię filtra na zero","Set the filter envelope to zero")]]},
    LABEL:{wave:L("Edytor fali","Wave editor"),eq:L("Korektor","Equaliser"),env:L("Obwiednia","Envelope")},
    HELP:{wave:L("Klawiatura w trybie Harmoniczne: [ i ] wybierają słupek, strzałki w górę i w dół zmieniają jego głośność, Shift daje większy krok.","Keyboard in Harmonics mode: [ and ] pick a bar, up and down arrows change its level, Shift takes a bigger step."),
      eq:L("Klawiatura: [ i ] wybierają pasmo, strzałki w lewo i w prawo zmieniają częstotliwość, w górę i w dół wzmocnienie, Page Up i Page Down szerokość pasma, Delete usuwa pasmo, Insert albo plus dodaje nowe, Shift daje większy krok.","Keyboard: [ and ] pick a band, left and right arrows change the frequency, up and down the gain, Page Up and Page Down the width, Delete removes a band, Insert or plus adds one, Shift takes a bigger step."),
      env:L("Klawiatura: 1, 2 i 3 wybierają punkt (atak, zanik z podtrzymaniem, zwolnienie), strzałki w lewo i w prawo zmieniają czas, w górę i w dół podtrzymanie albo zgięcie odcinka, Page Up i Page Down zgięcie, Shift daje większy krok.","Keyboard: 1, 2 and 3 pick a point (attack, decay with sustain, release), left and right arrows change the time, up and down the sustain or the bend, Page Up and Page Down the bend, Shift takes a bigger step.")},
    // S = interfejs Studia: fala(), ustawFala(v), obw() {att,dec,sus,rel,fEnv,fEnvT}, ustawObw(k,v) (k: atak/zanik/podtrzym/puszcz/obwF/obwFCzas, jednostki jak pokrętła), przesunObw(k,dir,duzy), analizator(), sampleRate(), zmiana()
    init(S,sloty){
      this.S=S;this._ed={};
      for(const k of ["wave","eq","env"])if(sloty[k])this._mount(k,sloty[k]);
      this._syncTools();this._req();},
    _mount(k,slot){
      const wrap=document.createElement("div");wrap.className="ce";wrap.dataset.editor=k;
      const tl=document.createElement("div");tl.className="ce-tools";
      for(const [typ,val,txt,tit] of this.TOOLS[k]){const b=document.createElement("button");b.type="button";b.className="sk-tb";b.textContent=txt;b.title=tit;
        if(typ==="mode"){b.dataset.mode=val;b.setAttribute("aria-pressed","false");}else b.dataset.act=val;tl.appendChild(b);}
      const st=document.createElement("div");st.className="ce-stage ce-"+k;
      const fr=document.createElement("canvas");fr.className="ce-frame";fr.setAttribute("aria-hidden","true");
      const cv=document.createElement("canvas");cv.className="ce-cv";cv.tabIndex=0;cv.setAttribute("role","application");cv.setAttribute("aria-label",this.LABEL[k]);
      const hp=document.createElement("span");hp.className="ce-sr";hp.id="stCeHelp-"+k;hp.textContent=this.HELP[k];cv.setAttribute("aria-describedby",hp.id);
      st.appendChild(fr);st.appendChild(cv);wrap.appendChild(tl);wrap.appendChild(st);wrap.appendChild(hp);slot.appendChild(wrap);slot.hidden=false;
      const E=this._ed[k]={k,slot,wrap,tools:tl,stage:st,fr,cv,fs:null,kf:false};
      tl.addEventListener("click",e=>{const b=e.target&&e.target.closest&&e.target.closest("button");if(b&&tl.contains(b))this._tool(b);});
      cv.addEventListener("keydown",e=>this._key(e,k));
      cv.addEventListener("focus",()=>{let v=false;try{v=cv.matches(":focus-visible");}catch(_){}E.kf=v;this._req(k);});
      cv.addEventListener("blur",()=>{E.kf=false;this._req(k);});
      const on=(type,fn,opt)=>cv.addEventListener(type,e=>{const P=this._pen,rel=type==="pointerup"||type==="pointercancel"||type==="lostpointercapture";
        if(P&&P.k&&P.k!==k&&!rel)return;if(!rel||!P||P.k===k){this.ch=k;this._ov=cv;}fn(e);},opt);
      on("pointerdown",e=>{this._down(e);if(this._pen&&!this._pen.k)this._pen.k=k;});
      on("pointermove",e=>this._move(e));
      const up=e=>this._up(e);on("pointerup",up);on("pointercancel",up);on("lostpointercapture",up);
      cv.addEventListener("pointerleave",()=>{if(this._hover&&this._hover.k===k){this._hover=null;this._req(k);}});
      cv.addEventListener("contextmenu",e=>e.preventDefault());
      if(k==="eq"){on("dblclick",e=>this._eqDbl(e));on("wheel",e=>this._eqWheel(e),{passive:false});}
      if(k==="env")on("dblclick",e=>this._envDbl(e));
      if(typeof ResizeObserver==="function"){try{new ResizeObserver(()=>{E.fs=null;this._req(k);}).observe(cv);}catch(e){}}},
    _tool(b){const a=b.dataset.act;
      if(b.dataset.mode)this.setMode(b.dataset.mode);else if(a==="smooth")this._smooth();else if(a==="clear")this._clear();
      else if(a==="eq-add")this._eqAdd();else if(a==="eq-del")this._eqDel(this._eqSel);else if(a==="eq-qm")this._eqQ(this._eqSel,1/this.EQ_QBTN);
      else if(a==="eq-qp")this._eqQ(this._eqSel,this.EQ_QBTN);else if(a==="eq-zero")this._eqZero();
      else if(a==="env-reset")this._envReset();else if(a==="env-nofilt")this._envNoFilt();},
    _syncTools(){const strips=this._ed?Object.values(this._ed).map(E=>E.tools).filter(Boolean):[];if(!strips.length)return;
      const n=this._eq.length,b=this._eq[this._eqSel],bent=this._envC.some(v=>v!==0),fe=this._envVals().fEnv!==0;
      for(const t of strips){
        t.querySelectorAll("[data-mode]").forEach(el=>el.setAttribute("aria-pressed",el.dataset.mode===this.mode?"true":"false"));
        t.querySelectorAll('[data-act^="eq-"]').forEach(el=>{const a=el.dataset.act;
          el.disabled=a==="eq-add"?n>=this.EQ_MAX:a==="eq-zero"?!n:a==="eq-del"?!b:a==="eq-qm"?!b||b.q<=this.EQ_QMIN:!b||b.q>=this.EQ_QMAX;});
        t.querySelectorAll('[data-act^="env-"]').forEach(el=>{const a=el.dataset.act;if(a==="env-reset")el.disabled=!bent;else if(a==="env-nofilt")el.disabled=!fe;});}},
    setMode(m){m=m==="harm"?"harm":"draw";if(m===this.mode)return;this.mode=m;this._harm=null;this._pen=null;this._syncTools();this._req("wave");},
    _ensureCustom(){const f=this.S.fala();
      if(f!=="custom"){this._wt=Float32Array.from(M.shape(f==="pulse"?"square":f));this.S.ustawFala("custom");this._harm=null;}
      else if(!this._wt)this._wt=M.sine();},
    _commit(){this.S.zmiana();this._req();},
    _smooth(){this._ensureCustom();this._wt=M.smooth(this._wt);this._harm=null;this._commit();},
    _clear(){this.S.ustawFala("custom");this._wt=M.sine();this._harm=null;this._commit();},
    _pt(e){const r=this._ov.getBoundingClientRect(),W=r.width,H=r.height,px=e.clientX-r.left,py=e.clientY-r.top;return {k:this.ch,px,py,W,H,pic:this.cvToPic(px,py,W,H)};},
    _inField(pic,m){m=m||0;return pic.x>=-m&&pic.x<=1+m&&pic.y>=-m&&pic.y<=1+m;},
    _down(e){
      if(this.ch==="eq"){this._eqDown(e);return;}if(this.ch==="env"){this._envDown(e);return;}
      if(this.ch!=="wave")return;if(e.pointerType==="mouse"&&e.button!==0)return;
      const p=this._pt(e);if(!this._inField(p.pic,.05))return;
      e.preventDefault();this._ensureCustom();this._pen={id:e.pointerId,last:null};this._hover=p;
      try{this._ov.setPointerCapture(e.pointerId);}catch(_){}this._apply(p.pic);this._commit();},
    _move(e){const p=this._pt(e);this._hover=p;
      if(this._pen&&this._pen.id===e.pointerId){if(this.ch==="env"){this._envDrag(p);return;}if(this.ch==="eq")this._eqDrag(p);else this._apply(p.pic);this._commit();}
      else this._req(this.ch);},
    _up(e){if(this._pen&&this._pen.id===e.pointerId){this._pen=null;this._req();}},
    _apply(pic){const Lt=this._pen.last;
      if(this.mode==="harm"){const h=this._bars(),k=Math.max(0,Math.min(15,Math.floor(pic.x*16))),a=Math.max(0,Math.min(1,(pic.y-this.BAR0)/this.BARH));
        if(Lt&&Lt.k!==k){const d=k>Lt.k?1:-1;for(let j=Lt.k+d;j!==k;j+=d)h[j]=Lt.a+(a-Lt.a)*(j-Lt.k)/(k-Lt.k);}
        h[k]=a;this._pen.last={k,a};this._wt=M.fromHarmonics(h);return;}
      const w=this._wt,i=Math.round(Math.max(0,Math.min(1,pic.x))*63),v=Math.max(-1,Math.min(1,(pic.y-this.DRAW_Y)/this.DRAW_A));
      if(Lt&&Lt.i!==i){const d=i>Lt.i?1:-1;for(let j=Lt.i+d;j!==i;j+=d)w[j]=Lt.v+(v-Lt.v)*(j-Lt.i)/(i-Lt.i);}
      w[i]=v;this._pen.last={i,v};this._harm=null;},
    // ---- Barwa ----
    _eqPic(b){return {x:Math.max(0,Math.min(1,M.xf(b.f))),y:M.gy(b.g)};},
    _eqAt(b,W,H){const q=this._eqPic(b);return this.picToCv(q.x,q.y,W,H);},
    _eqLin(b,W,H){const q=this._eqPic(b);return this._lin(q.x,q.y,W,H);},
    _eqReach(b){return Math.max(this.EQ_HIT,M.eqR(b.q)+4);},
    _eqHit(p){let best=-1,bd=Infinity;this._eq.forEach((b,i)=>{const g=this._eqAt(b,p.W,p.H),d=Math.hypot(g.x-p.px,g.y-p.py);if(d<=this._eqReach(b)&&d<=bd){bd=d;best=i;}});return best;},
    _eqCommit(){this._syncTools();this._commit();},
    _eqDown(e){if(e.pointerType==="mouse"&&e.button!==0)return;
      const p=this._pt(e);this._hover=p;let i=this._eqHit(p),ox=0,oy=0;const isNew=i<0;
      if(isNew){if(this._eq.length>=this.EQ_MAX||!this._inField(p.pic)){this._eqSel=-1;this._syncTools();this._req();return;}
        this._eq.push({f:M.fx(Math.max(0,Math.min(1,p.pic.x))),g:M.yg(p.pic.y),q:1});i=this._eq.length-1;}
      else{const b=this._eq[i];ox=Math.max(0,Math.min(1,M.xf(b.f)))-p.pic.x;oy=M.gy(b.g)-p.pic.y;}
      e.preventDefault();this._eqSel=i;this._pen={id:e.pointerId,eq:i,ox,oy};try{this._ov.setPointerCapture(e.pointerId);}catch(_){}
      if(isNew)this._eqCommit();else{this._syncTools();this._req();}},
    _eqDrag(p){const b=this._eq[this._pen.eq];if(!b)return;b.f=M.fx(Math.max(0,Math.min(1,p.pic.x+this._pen.ox)));b.g=M.yg(p.pic.y+this._pen.oy);},
    _eqDbl(e){if(this.ch!=="eq")return;const i=this._eqHit(this._pt(e));if(i<0)return;e.preventDefault();this._eqDel(i);},
    _eqWheel(e){if(this.ch!=="eq"||!e.deltaY)return;let i=this._eqHit(this._pt(e));if(i<0)i=this._eqSel;if(!this._eq[i])return;
      e.preventDefault();this._eqSel=i;this._eqQ(i,e.deltaY<0?this.EQ_QWHEEL:1/this.EQ_QWHEEL);},
    _eqQ(i,k){const b=this._eq[i];if(!b)return;b.q=Math.max(this.EQ_QMIN,Math.min(this.EQ_QMAX,b.q*k));this._eqCommit();},
    _eqAdd(){if(this._eq.length>=this.EQ_MAX)return;this._eq.push({f:1000,g:0,q:1});this._eqSel=this._eq.length-1;this._eqCommit();},
    _eqDel(i){if(!this._eq[i])return;this._eq.splice(i,1);this._eqSel=-1;this._pen=null;this._eqCommit();},
    _eqZero(){if(!this._eq.length)return;this._eq=[];this._eqSel=-1;this._pen=null;this._eqCommit();},
    // ---- Obwiednia ----
    _envHit(p){const v=this._envVals(),lay=this._envLay(v);let best=null,bd=this.ENV_HIT;
      for(const h of M.envHandles(lay,this._envC,v.fEnv,v.fEnvT)){const g=this.picToCv(h.x,h.y,p.W,p.H),d=Math.hypot(g.x-p.px,g.y-p.py);if(d<bd){bd=d;best=h;}}return best;},
    _envDown(e){if(e.pointerType==="mouse"&&e.button!==0)return;
      const p=this._pt(e);this._hover=p;const h=this._envHit(p);if(!h){this._req();return;}
      e.preventDefault();const v=this._envVals(),lay=this._envLay(v);
      this._pen={id:e.pointerId,env:h.id,ci:h.ci,spu:lay.spu,px:p.pic.x,oy:h.y-p.pic.y,v0:v};
      try{this._ov.setPointerCapture(e.pointerId);}catch(_){}this._req();},
    _envDrag(p){const P=this._pen,v=P.v0,dt=(p.pic.x-P.px)*P.spu,y=p.pic.y+P.oy,Y0=M.ENV_Y0,Y1=M.ENV_Y1,S=this.S;
      if(P.env==="a")S.ustawObw("atak",(v.att+dt)*1000);
      else if(P.env==="d"){S.ustawObw("zanik",(v.dec+dt)*1000);S.ustawObw("podtrzym",(y-Y0)/(Y1-Y0)*100);}
      else if(P.env==="r")S.ustawObw("puszcz",(v.rel+dt)*1000);
      else if(P.env==="f"){S.ustawObw("obwFCzas",(v.fEnvT+dt)*1000);S.ustawObw("obwF",(y-M.ENV_FZ)/M.ENV_FA*100);}
      else if(P.ci!=null){const seg=this._envLay(this._envVals()).segs.find(s=>s[2]===P.ci),dy=seg?seg[1].y-seg[0].y:0;
        if(Math.abs(dy)>1e-6){const c=Math.round(M.envCOf((y-seg[0].y)/dy)*100)/100||0;if(c!==this._envC[P.ci]){this._envC[P.ci]=c;this._syncTools();this._commit();return;}}}
      this._syncTools();this._req();},
    _envDbl(e){if(this.ch!=="env")return;const h=this._envHit(this._pt(e));if(!h||h.kind!==2)return;e.preventDefault();
      if(this._envC[h.ci]!==0){this._envC[h.ci]=0;this._syncTools();this._commit();}},
    _envReset(){if(!this._envC.some(v=>v!==0))return;this._envC=[0,0,0];this._pen=null;this._syncTools();this._commit();},
    _envNoFilt(){this.S.ustawObw("obwF",0);this._syncTools();this._req();},
    // ---- klawiatura ----
    _key(e,k){if(e.altKey||e.ctrlKey||e.metaKey)return;const K=e.key,sh=!!e.shiftKey;
      const done=k==="eq"?this._eqKey(K,sh):k==="env"?this._envKey(K,sh):k==="wave"?this._waveKey(K,sh):false;if(!done)return;
      e.preventDefault();e.stopPropagation();this.ch=k;const E=this._ed&&this._ed[k];if(E)E.kf=true;this._req(k);},
    _eqKey(K,sh){const n=this._eq.length,i=this._eqSel,b=this._eq[i];
      if(K==="Insert"||K==="+"){this._eqAdd();return true;}
      if(K==="["||K==="]"){if(!n)return false;this._eqSel=K==="]"?(i<0?0:(i+1)%n):(i<0?n-1:(i-1+n)%n);this._syncTools();return true;}
      if(!b)return false;
      if(K==="Delete"||K==="Backspace"){this._eqDel(i);return true;}
      if(K==="ArrowLeft"||K==="ArrowRight"){const m=sh?this.KB_FS:this.KB_F;b.f=Math.max(M.EQ_F0,Math.min(M.EQ_F1,b.f*(K==="ArrowRight"?m:1/m)));this._eqCommit();return true;}
      if(K==="ArrowUp"||K==="ArrowDown"){const s=(sh?this.KB_GS:this.KB_G)*(K==="ArrowUp"?1:-1);b.g=Math.max(-M.EQ_G,Math.min(M.EQ_G,Math.round((b.g+s)*100)/100));this._eqCommit();return true;}
      if(K==="PageUp"||K==="PageDown"){this._eqQ(i,K==="PageUp"?this.EQ_QWHEEL:1/this.EQ_QWHEEL);return true;}
      return false;},
    _envKey(K,sh){
      if(K==="1"||K==="2"||K==="3"){this._envSel=["a","d","r"][+K-1];return true;}
      const id=this._envSel,ci=id==="a"?0:id==="d"?1:2;
      if(K==="ArrowLeft"||K==="ArrowRight"){this.S.przesunObw(id==="a"?"atak":id==="d"?"zanik":"puszcz",K==="ArrowRight"?1:-1,sh);return true;}
      if(K==="ArrowUp"||K==="ArrowDown"){const d=K==="ArrowUp"?1:-1;if(id==="d"){this.S.przesunObw("podtrzym",d,sh);return true;}return this._envBend(ci,d,sh);}
      if(K==="PageUp"||K==="PageDown")return this._envBend(ci,K==="PageUp"?1:-1,sh);
      return false;},
    _envBend(ci,dir,sh){const seg=this._envLay(this._envVals()).segs.find(s=>s[2]===ci),dy=seg?seg[1].y-seg[0].y:0;if(Math.abs(dy)<.02)return false;
      const c0=this._envC[ci]||0,c=Math.max(-1,Math.min(1,Math.round((c0-Math.sign(dy)*dir*(sh?this.KB_CS:this.KB_C))*100)/100))||0;
      if(c!==c0){this._envC[ci]=c;this._syncTools();this._commit();}return true;},
    _waveKey(K,sh){if(this.mode!=="harm")return false;
      if(K==="["||K==="]"){this._bar=(this._bar+(K==="]"?1:15))%16;return true;}
      if(K!=="ArrowUp"&&K!=="ArrowDown")return false;
      this._ensureCustom();const h=this._bars(),k=this._bar,s=(sh?5:1)*this.KB_BAR*(K==="ArrowUp"?1:-1);
      h[k]=Math.max(0,Math.min(1,Math.round((h[k]+s)*100)/100));this._wt=M.fromHarmonics(h);this._commit();return true;},
    _kf(k){return !!(this._ed&&this._ed[k]&&this._ed[k].kf);},
    // ---- żywe warstwy ----
    _tick(dtMs){const F=this._F||(this._F={sp:new Float32Array(16),wf:new Float32Array(64),lv:0});
      let f=null;const A=this.S.analizator();if(A){try{f=surowe(A);}catch(e){f=null;}}
      const k=tau=>1-Math.exp(-dtMs/tau);let mx=0;
      for(let i=0;i<16;i++){const v=f?f.sp[i]:0;F.sp[i]+=(v-F.sp[i])*k(v>F.sp[i]?45:260);mx=Math.max(mx,F.sp[i]);}
      for(let i=0;i<64;i++)F.wf[i]+=((f?f.wf[i]:0)-F.wf[i])*k(35);
      const lv=f?f.lv:0;F.lv+=(lv-F.lv)*k(lv>F.lv?40:220);return mx>.004||F.lv>.004;},
    spij(){this._pen=null;this._liveWipe();this._req();},
    zgub(){this._postDrop();},
    // ---- rysowanie ----
    rysuj(now){
      if(!this._ed)return false;
      const vis=Object.values(this._ed).filter(E=>E.cv.offsetParent!==null&&E.cv.clientWidth>0&&E.cv.clientHeight>0);
      if(!vis.length)return false;
      const d=this._dirty||(this._dirty={});
      if(now===this._last)return this._wasLive||vis.some(E=>d[E.k]);
      const dt=this._last>=0?Math.min(100,Math.max(0,now-this._last)):16.67;this._last=now;this._now=now;
      let live=false,trail=false;
      if(vis.some(E=>E.k!=="env")){live=this._tick(dt);if(live)this._liveT=now;trail=!live&&now-this._liveT<=this.LIVE_TAU*4500+40;
        if(live||trail||this._wasLive)d.wave=d.eq=1;this._wasLive=live||trail;}
      for(const E of vis){if(!d[E.k])continue;d[E.k]=0;try{this._render(E);}catch(e){if(!this._warned){this._warned=true;console.warn("[studio-ekrany] panel",e);}}}
      return live||trail;},
    _frameDraw(E,dpr){const c=E.fr;if(!c)return;const W=c.clientWidth,H=c.clientHeight;if(!W||!H)return;
      const f=E.fs;if(f&&f.W===W&&f.H===H&&f.dpr===dpr)return;c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);
      const x=c.getContext("2d");if(!x)return;x.setTransform(dpr,0,0,dpr,0,0);this.frame(x,W,H,this.FR);E.fs={W,H,dpr};},
    _render(E){const cv=E.cv,W=cv.clientWidth,H=cv.clientHeight;if(!W||!H)return;
      const dpr=window.devicePixelRatio||1,pw=Math.round(W*dpr),ph=Math.round(H*dpr);
      this._frameDraw(E,dpr);if(cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph;}
      const vx=cv.getContext("2d");if(!vx)return;
      const P=this._postGet(),b=P?this._buf(E,pw,ph):null,x=b?E.bx:vx;
      if(P&&!b){this._postDrop();this._post=false;this._req();}
      x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,pw,ph);x.setTransform(dpr,0,0,dpr,0,0);
      const g=x.createRadialGradient(W/2,H/2,0,W/2,H/2,(Math.max(W,H)+2*this.FR)*.6);g.addColorStop(0,"#12201a");g.addColorStop(1,"#0c1511");
      x.save();if(!b){this._rr(x,0,0,W,H,this.RS);x.clip();}x.fillStyle=g;x.fillRect(0,0,W,H);
      if(E.k==="wave")this._drawWave(x,W,H,E);else if(E.k==="eq")this._drawEq(x,W,H,E);else this._drawEnv(x,W,H);
      if(!b)this._crt2d(x,W,H);x.restore();
      if(b)this._postRun(P,b,vx,pw,ph,W,H,dpr);},
    _buf(E,pw,ph){let c=E.buf;if(!c){c=E.buf=document.createElement("canvas");E.bx=c.getContext("2d",{alpha:false});}
      if(c.width!==pw||c.height!==ph){c.width=pw;c.height=ph;}return E.bx?c:null;},
    _liveLayer(x,E,W,H,on,fn){const add=c=>{c.save();c.globalCompositeOperation="lighter";fn(c);c.restore();};
      let Lv=E.live;
      if(!Lv){if(!on)return;Lv=E.live=document.createElement("canvas");E.lx=Lv.getContext("2d");E.lt=-1;E.ld=-1e9;}
      const lx=E.lx;if(!lx){if(on)add(x);return;}
      const dpr=window.devicePixelRatio||1,pw=Math.round(W*dpr),ph=Math.round(H*dpr);
      if(Lv.width!==pw||Lv.height!==ph){Lv.width=pw;Lv.height=ph;}
      const now=this._now!=null?this._now:zegar(),gap=E.lt>=0?Math.max(0,now-E.lt):Infinity;E.lt=now;
      lx.setTransform(1,0,0,1,0,0);
      if(!on&&now-E.ld>this.LIVE_TAU*4500){if(E.ld>-1e9){lx.clearRect(0,0,pw,ph);E.ld=-1e9;}return;}
      const a=1-Math.exp(-gap/(this.LIVE_TAU*1000));
      lx.globalCompositeOperation="destination-out";lx.fillStyle="rgba(0,0,0,"+a.toFixed(4)+")";lx.fillRect(0,0,pw,ph);lx.globalCompositeOperation="source-over";
      if(on){lx.setTransform(dpr,0,0,dpr,0,0);fn(lx);E.ld=now;}
      x.save();x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.globalCompositeOperation="lighter";x.drawImage(Lv,0,0);x.restore();},
    _liveWipe(){for(const E of Object.values(this._ed||{})){if(E.lx&&E.live){E.lx.setTransform(1,0,0,1,0,0);E.lx.clearRect(0,0,E.live.width,E.live.height);}E.ld=-1e9;}this._liveT=-1e12;},
    _rgbK(c,k){return "rgb("+c.map(v=>Math.round(v*k)).join(",")+")";},
    _crt2d(x,W,H){x.save();x.shadowBlur=0;x.globalAlpha=1;x.fillStyle="rgba(0,0,0,"+this.CRT_S+")";for(let y=0;y<H;y+=3)x.fillRect(0,y,W,1);
      x.translate(W/2,H/2);x.scale(W/2,H/2);const v=x.createRadialGradient(0,0,.6,0,0,1.2);v.addColorStop(0,"rgba(0,0,0,0)");v.addColorStop(1,"rgba(0,0,0,"+this.CRT_V+")");
      x.fillStyle=v;x.fillRect(-1,-1,2,2);x.restore();},
    _bk(){const B=this._BK||(this._BK=new Float32Array(4));B[0]=this.K;B[1]=this.CRT_S;B[2]=this.CRT_V;B[3]=this.CRT_G;return B;},
    // jeden ukryty kontekst GL dla trzech paneli, shader „crt”; bez WebGL2 zostaje 2D
    _postGet(){if(this._post!==null)return this._post||null;this._post=false;let st=null;
      try{st=GL.mk(null,"st-crt");if(!st)return null;GL.prog(st,"crt");
        const gl=st.gl,tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
        for(const [a,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,a,v);
        this._post={st,tex,tw:0,th:0};}
      catch(e){console.warn("[studio-ekrany] crt",e);if(st)GL.zgub(st);}
      return this._post||null;},
    _postDrop(){const P=this._post;this._post=null;if(P)GL.zgub(P.st);},
    _postRun(P,b,vx,pw,ph,W,H,dpr){const st=P.st,gl=st.gl,c=st.cv;
      try{if(gl.isContextLost())throw new Error("WebGL context lost");
        const pg=GL.prog(st,"crt"),u=pg.u;
        if(c.width<pw)c.width=pw;if(c.height<ph)c.height=ph;
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,P.tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        if(pw>P.tw||ph>P.th){P.tw=Math.max(P.tw,pw);P.th=Math.max(P.th,ph);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,P.tw,P.th,0,gl.RGBA,gl.UNSIGNED_BYTE,null);}
        gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,b);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,pw,ph);gl.useProgram(pg.pr);
        gl.uniform2f(u.R,pw,ph);gl.uniform1f(u.DPR,dpr);gl.uniform1i(u.HT,0);gl.uniform2f(u.HS,pw/P.tw,ph/P.th);gl.uniform1fv(u.BK,this._bk());
        gl.drawArrays(gl.TRIANGLES,0,3);
        vx.setTransform(1,0,0,1,0,0);vx.clearRect(0,0,pw,ph);
        vx.save();vx.setTransform(dpr,0,0,dpr,0,0);this._rr(vx,0,0,W,H,this.RS);vx.clip();vx.setTransform(1,0,0,1,0,0);
        vx.drawImage(c,0,c.height-ph,pw,ph,0,0,pw,ph);vx.restore();return true;}
      catch(e){console.warn("[studio-ekrany] crt",e);this._postDrop();this._post=false;this._req();return false;}},
    _font(){if(!this._fam)this._fam=(typeof getComputedStyle==="function"&&document.body&&getComputedStyle(document.body).fontFamily)||"sans-serif";return this._fam;},
    _mono(){if(!this._monoF)this._monoF=(typeof getComputedStyle==="function"&&getComputedStyle(document.documentElement).getPropertyValue("--mono").trim())||"monospace";return this._monoF;},
    _hov(k){const h=this._hover;return h&&h.k===k&&h.pic.x>=-.02&&h.pic.x<=1.02&&h.pic.y>=0&&h.pic.y<=1?h:null;},
    _poly(x,pts){x.beginPath();pts.forEach((p,i)=>{if(i)x.lineTo(p.x,p.y);else x.moveTo(p.x,p.y);});},
    _hl(x,W,H,y,col){const g=this._lin(0,y,W,H);x.strokeStyle=col;x.lineWidth=1;x.beginPath();x.moveTo(0,g.y);x.lineTo(W,g.y);x.stroke();},
    _vl(x,W,H,u,col){const g=this._lin(u,0,W,H);x.strokeStyle=col;x.lineWidth=1;x.beginPath();x.moveTo(g.x,0);x.lineTo(g.x,H);x.stroke();},
    _lime(x,pts,yz,a){x.save();x.globalAlpha=a;x.fillStyle="rgba(166,216,97,.10)";this._poly(x,pts);x.lineTo(pts[pts.length-1].x,yz);x.lineTo(pts[0].x,yz);x.closePath();x.fill();
      x.strokeStyle=this.C.lime;x.lineWidth=2;x.lineJoin="round";x.lineCap="round";x.shadowColor="rgba(166,216,97,.75)";x.shadowBlur=6;this._poly(x,pts);x.stroke();x.restore();},
    _ring(x,cx,cy,r,col,hot,fill){x.save();x.beginPath();x.arc(cx,cy,r,0,2*Math.PI);
      if(fill){x.globalAlpha*=hot?.3:.14;x.fillStyle=col;x.fill();x.globalAlpha/=hot?.3:.14;}
      x.lineWidth=5.5;x.strokeStyle=this.C.ink;x.stroke();x.globalAlpha*=hot?1:.8;x.lineWidth=2.5;x.strokeStyle=col;if(hot){x.shadowColor=col;x.shadowBlur=8;}x.stroke();x.restore();},
    _put(x,txt,gx,gy,W,H){const m=3,w=x.measureText(txt).width,h=12,al=x.textAlign,bl=x.textBaseline;
      const bx=al==="center"?gx-w/2:(al==="right"||al==="end"?gx-w:gx),by=bl==="middle"?gy-h/2:(bl==="top"||bl==="hanging"?gy:gy-h);
      const dx=Math.max(0,m-bx)-Math.max(0,bx+w-(W-m)),dy=Math.max(0,m-by)-Math.max(0,by+h-(H-m));x.fillText(txt,gx+dx,gy+dy);},
    _hint(x,W,H,a,b,right){const X=right?W-this.PAD:this.PAD,mw=W-2*this.PAD,fam=this._font();x.textAlign=right?"right":"left";x.textBaseline="top";let y=7;
      if(a){x.font="700 12px "+fam;x.fillStyle=this.C.ph;x.fillText(a,X,y);y+=16;}
      if(b){x.font="600 11px "+fam;x.fillStyle=this.C.phd;const ws=String(b).split(" ");
        for(let n=0;n<2&&ws.length;n++){let ln=ws.shift();while(ws.length&&x.measureText(ln+" "+ws[0]).width<=mw)ln+=" "+ws.shift();x.fillText(n===1&&ws.length?ln+" …":ln,X,y);y+=14;}}},
    _cross(x,hv,txt,W,H){const g=hv.pic?this._lin(hv.pic.x,hv.pic.y,W,H):{x:hv.px,y:hv.py};
      x.strokeStyle=this.C.ph;x.lineWidth=1;x.beginPath();x.moveTo(g.x-8,g.y);x.lineTo(g.x+8,g.y);x.moveTo(g.x,g.y-8);x.lineTo(g.x,g.y+8);x.stroke();
      x.font="700 12px "+this._font();x.fillStyle=this.C.ph;x.textBaseline="bottom";const right=g.x>W*.6;x.textAlign=right?"right":"left";
      this._put(x,txt,g.x+(right?-12:12),g.y-8,W,H);},
    _num(v){const s=(v>=0?"+":"−")+Math.abs(v).toFixed(2);return L(s.replace(".",","),s);},
    _eqTxt(f,g,q){const hz=f<1000?Math.round(f)+" Hz":(+(f/1000).toFixed(f<10000?2:1))+" kHz";
      const gr=Math.round(g*10)/10,db=(gr>0?"+":gr<0?"−":"")+Math.abs(gr).toFixed(1)+" dB";const s=hz+" · "+db+(q!=null?" · Q "+(+q.toFixed(2)):"");
      return L(s.replace(/(\d)\.(\d)/g,"$1,$2"),s);},
    _txt(x){x.shadowColor="rgba(0,0,0,.8)";x.shadowBlur=3;},
    _drawWave(x,W,H,E){
      const C=this.C,harm=this.mode==="harm",w=this._curve(),cust=this._isCustom();
      const y0=harm?this.HARM_Y:this.DRAW_Y,am=harm?this.HARM_A:this.DRAW_A,P=(u,v)=>this._lin(u,v,W,H),pl=this._plot(W,H),hv=this._hov("wave");
      this._vl(x,W,H,0,C.grid2);this._vl(x,W,H,1,C.grid2);this._hl(x,W,H,y0,C.grid2);for(const v of [1,-1])this._hl(x,W,H,y0+v*am,C.grid);
      const F=this._F;
      this._liveLayer(x,E,W,H,!!(F&&F.lv>.004),c=>{c.strokeStyle=this._rgbK([236,26,131],Math.min(.55,.16+F.lv*.6));c.lineWidth=1.5;c.lineJoin="round";
        const lp=[];for(let i=0;i<64;i++)lp.push(P(i/63,y0+F.wf[i]*am*.9));this._poly(c,lp);c.stroke();});
      if(harm){const h=this._bars(),bw=Math.max(5,Math.min(16,(pl.x1-pl.x0)/16*.42));x.save();x.lineCap="round";x.lineWidth=bw;
        for(let k=0;k<16;k++){const u=(k+.5)/16,a=P(u,this.BAR0),t=P(u,this.BAR0+this.BARH),b=P(u,this.BAR0+h[k]*this.BARH);
          x.strokeStyle="rgba(120,200,150,.12)";x.shadowBlur=0;x.beginPath();x.moveTo(a.x,a.y);x.lineTo(t.x,t.y);x.stroke();
          if(h[k]>.002){x.strokeStyle=C.lime;x.shadowColor="rgba(166,216,97,.6)";x.shadowBlur=6;x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke();}}
        x.restore();}
      const pts=[];for(let i=0;i<64;i++)pts.push(P(i/63,y0+w[i]*am));this._lime(x,pts,P(0,y0).y,cust?1:.45);
      const Pn=this._pen;
      if(!harm&&Pn&&Pn.last&&Pn.last.i!=null){const g=P(Pn.last.i/63,this.DRAW_Y+Pn.last.v*this.DRAW_A);this._ring(x,g.x,g.y,this.R_PT,C.yel,true,false);}
      const kb=harm&&!hv&&!Pn&&this._kf("wave")?P((this._bar+.5)/16,this.BAR0+this._bars()[this._bar]*this.BARH):null;
      if(kb)this._ring(x,kb.x,kb.y,this.R_BEND,C.yel,true,false);
      x.save();this._txt(x);x.font="600 11px "+this._mono();x.fillStyle=C.phd;
      if(harm){x.textAlign="center";x.textBaseline="bottom";for(let k=0;k<16;k++){const g=P((k+.5)/16,0);this._put(x,String(k+1),g.x,g.y+this.PAD-1,W,H);}}
      else{x.textAlign="right";x.textBaseline="bottom";[[1,"+1"],[0,"0"],[-1,"−1"]].forEach(([v,t])=>{const g=P(1,this.DRAW_Y+v*this.DRAW_A);this._put(x,t,g.x-4,g.y-2,W,H);});}
      if(hv){let txt;if(harm){const k=Math.max(0,Math.min(15,Math.floor(hv.pic.x*16)));txt=L("harmoniczna","harmonic")+" "+(k+1)+" · "+Math.round(this._bars()[k]*100)+" %";}
        else txt=this._num(Math.max(-1,Math.min(1,(hv.pic.y-this.DRAW_Y)/this.DRAW_A)));this._cross(x,hv,txt,W,H);}
      else if(kb)this._cross(x,{px:kb.x,py:kb.y},L("harmoniczna","harmonic")+" "+(this._bar+1)+" · "+Math.round(this._bars()[this._bar]*100)+" %",W,H);
      else if(!Pn)this._hint(x,W,H,harm?L("Ciągnij słupki: głośność kolejnych harmonicznych","Drag the bars: the level of each harmonic"):L("Narysuj jeden okres fali","Draw one period of the wave"),
        cust?"":L("podgląd fali z listy · dotknij, żeby ją zmienić","the listed wave · touch it to change it"));
      x.restore();},
    _drawEq(x,W,H,E){const C=this.C,P=(u,v)=>this._lin(u,v,W,H),hv=this._hov("eq");
      for(const f of [100,1000,10000])this._vl(x,W,H,M.xf(f),C.grid);for(const g of [12,-12])this._hl(x,W,H,M.gy(g),C.grid);this._hl(x,W,H,M.EQ_Y,C.grid2);
      const F=this._F;
      this._liveLayer(x,E,W,H,!!(F&&Math.max(...F.sp)>.004),c=>{const sp=[];
        for(let i=0;i<16;i++)sp.push(P(Math.max(0,Math.min(1,M.xf(60*Math.pow(200,(i+.5)/16)))),.02+F.sp[i]*.72));
        c.fillStyle=this._rgbK([108,200,90],.22);this._poly(c,sp);c.lineTo(sp[15].x,H);c.lineTo(sp[0].x,H);c.closePath();c.fill();
        c.strokeStyle=this._rgbK([150,235,120],.55);c.lineWidth=1.5;c.lineJoin="round";this._poly(c,sp);c.stroke();});
      const cu=M.eqCurve(this._eq,this._sr()),pts=[];for(let i=0;i<64;i++)pts.push(P(i/63,M.gy(cu[i])));this._lime(x,pts,P(0,M.EQ_Y).y,1);
      const Pn=this._pen,hot=(Pn&&Pn.eq!=null)?Pn.eq:(hv?this._eqHit(hv):-1);
      this._eq.forEach((b,i)=>{const g=this._eqLin(b,W,H),on=i===this._eqSel||i===hot;this._ring(x,g.x,g.y,M.eqR(b.q),C.yel,on,true);
        x.save();x.globalAlpha=on?1:.8;x.fillStyle=C.yel;x.beginPath();x.arc(g.x,g.y,3,0,2*Math.PI);x.fill();x.restore();});
      x.save();this._txt(x);x.font="600 11px "+this._mono();x.fillStyle=C.phd;x.textAlign="left";x.textBaseline="bottom";
      [[100,"100 Hz"],[1000,"1 kHz"],[10000,"10 kHz"]].forEach(([f,t])=>{const g=P(M.xf(f),0);this._put(x,t,g.x+4,g.y+this.PAD-2,W,H);});
      x.textAlign="right";[[12,"+12 dB"],[0,"0 dB"],[-12,"−12 dB"]].forEach(([v,t])=>{const g=P(1,M.gy(v));this._put(x,t,g.x-4,g.y-2,W,H);});
      if(hv){const i=(Pn&&Pn.eq!=null)?Pn.eq:this._eqHit(hv),b=this._eq[i];this._cross(x,hv,b?this._eqTxt(b.f,b.g,b.q):this._eqTxt(M.fx(Math.max(0,Math.min(1,hv.pic.x))),M.yg(hv.pic.y)),W,H);}
      else if(!Pn&&this._kf("eq")&&this._eq[this._eqSel]){const b=this._eq[this._eqSel],g=this._eqLin(b,W,H);this._cross(x,{px:g.x,py:g.y},this._eqTxt(b.f,b.g,b.q),W,H);}
      else if(!Pn)this._hint(x,W,H,L("Ciągnij pierścienie: częstotliwość i wzmocnienie","Drag the rings: frequency and gain"),
        L("kółko = szerokość pasma (Q) · dwuklik usuwa · dotknij pustego miejsca = nowe pasmo","wheel = bandwidth (Q) · double-click removes · touch an empty spot = new band"));
      x.restore();},
    _drawEnv(x,W,H){const C=this.C,P=(u,w)=>this._lin(u,w,W,H),pl=this._plot(W,H),hv=this._hov("env");
      const v=this._envVals(),lay=this._envLay(v),c=this._envC,hs=M.envHandles(lay,c,v.fEnv,v.fEnvT),Pn=this._pen,drag=!!(Pn&&Pn.env);
      const ms=s=>Math.round(s*1000)+" ms",pc=f=>Math.round(f*100)+" %",H_=id=>hs.find(h=>h.id===id);
      this._hl(x,W,H,M.ENV_Y0,C.grid2);if(v.fEnv!==0)this._hl(x,W,H,M.ENV_FZ,"rgba(234,163,43,.16)");
      const pps=(pl.x1-pl.x0)/lay.spu,step=[.1,.5,1,2,5].find(s=>s*pps>=20)||10;
      const lab=[.1,.2,.5,1,2,5,10].find(s=>s>=step-1e-9&&s*pps>=46&&Math.abs(s/step-Math.round(s/step))<1e-6)||step*10;
      x.save();x.strokeStyle="rgba(204,246,210,.4)";x.lineWidth=1;this._txt(x);x.font="600 11px "+this._mono();x.fillStyle=C.phd;x.textAlign="left";x.textBaseline="bottom";
      for(let i=1;i<=400;i++){const t=i*step,u=M.xOfT(lay,t);if(u>1)break;const a=P(u,M.ENV_Y0-.025),b=P(u,M.ENV_Y0+.025);
        x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke();
        const r=t/lab;if(Math.abs(r-Math.round(r))<1e-6){const s=(+t.toFixed(2))+" s";this._put(x,L(s.replace(".",","),s),b.x+3,b.y-1,W,H);}}
      x.restore();
      if(v.fEnv!==0){const fe=M.envFilter(v.fEnv,v.fEnvT,lay.spu),fp=[];for(let i=0;i<64;i++)fp.push(P(i/63,fe[i]));
        x.save();x.strokeStyle="rgba(234,163,43,.9)";x.lineWidth=1.5;x.lineJoin="round";x.shadowColor="rgba(234,163,43,.6)";x.shadowBlur=5;this._poly(x,fp);x.stroke();x.restore();}
      const poly=M.envPoly(lay,c),pts=[];for(let i=0;i<32;i++)pts.push(P(poly.x[i],poly.y[i]));this._lime(x,pts,P(0,M.ENV_Y0).y,1);
      const kh=!drag&&!hv&&this._kf("env")?(H_(this._envSel)||H_("d")):null;
      const hit=drag?null:(hv?this._envHit(hv):null),hot=drag?Pn.env:(hit?hit.id:(kh?kh.id:null));
      hs.forEach(h=>{const g=P(h.x,h.y),on=h.id===hot;
        if(h.kind===1)this._ring(x,g.x,g.y,this.R_PT,C.yel,on,true);else if(h.kind===2)this._ring(x,g.x,g.y,this.R_BEND,C.bend,on,false);
        else{x.save();if(v.fEnv===0&&!on)x.globalAlpha=.5;this._ring(x,g.x,g.y,this.R_FILT,C.amb,on,true);x.restore();}});
      x.save();this._txt(x);x.font="600 11px "+this._mono();x.fillStyle=C.ph;x.textBaseline="middle";
      const cap=(h,txt,dx,dy,al)=>{if(!h)return;const g=P(h.x,h.y);x.textAlign=al;this._put(x,txt,g.x+dx,g.y+dy,W,H);};
      const tD=L("zanik ","decay ")+ms(v.dec),tS=L("podtrzymanie ","sustain ")+pc(v.sus);
      cap(H_("a"),L("atak ","attack ")+ms(v.att),20,12,"left");
      {const d=H_("d"),dy=lay.ys>.75?[12,26]:(lay.ys<.25?[-26,-12]:[-7,7]);cap(d,tD,20,dy[0],"left");cap(d,tS,20,dy[1],"left");cap(H_("r"),L("zwolnienie ","release ")+ms(v.rel),-19,-30,"right");}
      if(hv||kh){const h=drag?{id:Pn.env,ci:Pn.ci}:(hv?this._envHit(hv):kh),id=h&&h.id;let txt;
        if(id==="a")txt=L("atak ","attack ")+ms(v.att);else if(id==="d")txt=tD+" · "+tS;else if(id==="r")txt=L("zwolnienie ","release ")+ms(v.rel);
        else if(id==="f")txt=L("filtr ","filter ")+(v.fEnv>0?"+":v.fEnv<0?"−":"")+pc(Math.abs(v.fEnv))+" · "+ms(v.fEnvT);
        else if(h&&h.ci!=null)txt=L(["zgięcie ataku ","zgięcie zaniku ","zgięcie zwolnienia "][h.ci],["attack bend ","decay bend ","release bend "][h.ci])+this._num(this._envC[h.ci]||0);
        else txt=ms(Math.max(0,(hv.pic.x-lay.x0)*lay.spu))+" · "+pc(Math.max(0,Math.min(1,(hv.pic.y-M.ENV_Y0)/(M.ENV_Y1-M.ENV_Y0))));
        this._cross(x,hv||{px:P(kh.x,kh.y).x,py:P(kh.x,kh.y).y},txt,W,H);}
      else if(!drag)this._hint(x,W,H,L("Ciągnij punkty: atak, zanik i podtrzymanie, zwolnienie","Drag the points: attack, decay and sustain, release"),
        L("małe pierścienie zginają odcinek · bursztyn = obwiednia filtra (wielkość i czas)","small rings bend a segment · amber = the filter envelope (amount and time)"),true);
      x.restore();}};

  const api={GL,M,Lampa,Panele,cechy,surowe,klatka:()=>{const tl=typeof document!=="undefined"&&document.timeline,t=tl?tl.currentTime:null;return typeof t==="number"&&Number.isFinite(t)?t:zegar();}};
  if(typeof window!=="undefined")window.StudioEkrany=api;
  return api;
})();
