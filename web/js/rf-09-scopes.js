"use strict";
// ===== oscilloscopes, readouts and the main rAF loop =====
// Canvas drawing for the raw-axis scopes, the 3D-filter scope, the button lane and the
// "searching" placeholder animation, plus the Sensor-tab controls (window, pause, tare,
// CSV recording, simulate/LIVE switch). frame() is the single requestAnimationFrame loop.

// ---------- axis reads (rAF) ----------
function meanStd(buf,sinceTs){
  let n=0,s=0,s2=0;
  for(let i=buf.length-1;i>=0;i--){if(buf[i][0]<sinceTs)break;const v=buf[i][1];n++;s+=v;s2+=v*v;}
  if(!n)return{mean:0,std:0,n:0};
  const m=s/n;return{mean:m,std:Math.sqrt(Math.max(0,s2/n-m*m)),n};
}
// PISZEMY TYLKO TO, CO SIĘ ZMIENIŁO.
// Ta funkcja szła 60 razy na sekundę i za każdym przebiegiem robiła 37 zapisów do DOM-u (6 kanałów
// × liczba, etykieta, kolor, średnia/σ, dwie własności paska + „ostatni surowy"). Każdy taki zapis
// unieważnia styl elementu, nawet jeśli wpisuje DOKŁADNIE TO SAMO — a etykieta („spoczynek"),
// kolor i średnia potrafią nie zmienić się przez sekundy. Do 2026-08-29 nie było tego widać, bo
// karta stała w prawej kolumnie zmniejszona; po przeprowadzce do Czujnika ma pełną szerokość i
// liczy się każdy przeliczony styl. Porównanie ze stringiem jest o rzędy tańsze niż zapis.
function _rdSet(el,prop,val){ if(!el)return; const k="_rf_"+prop; if(el[k]===val)return; el[k]=val;
  if(prop==="text")el.textContent=val; else el.style[prop]=val; }
function updateReadouts(){
  const B=VB(), L=B.last, end=B.nowTs, since=end-1.2;   // channel readouts follow the VIEWED capsule
  for(const a of AXES){
    const v=L[a.k]||0;
    _rdSet(document.getElementById("raw-"+a.k),"text",String(v));
    const {mean,std}=meanStd(B.buf[a.k],since);
    // auto-detection: gravity/offset (large constant) vs motion (high variability)
    let tag="– spoczynek",col=cv('--dim');
    if(std>300){tag="↻ RUCH";col=cv('--warn');}
    else if(Math.abs(mean)>800){tag="● grawitacja/offset";col=cv('--c-seek');}
    const tg=document.getElementById("tag-"+a.k);
    // Etykieta jest napisem po polsku, który tłumaczy walker i18n. Gdyby porównywać ją z
    // `textContent`, po przełączeniu na angielski różniłaby się w każdej klatce i wpisywalibyśmy
    // polski w kółko, kasując tłumaczenie. Pamiętamy więc ŹRÓDŁO, nie to, co widać.
    _rdSet(tg,"text",tag); _rdSet(tg,"color",col);
    const off=state.offset[a.k]||0;
    // A tuned channel says so here as well: the big number is what the sensor sent, the arrow is
    // what every output gets after the chain. Two different numbers with no explanation would be
    // the worst of both worlds.
    const shv=(B.chan&&B.lastSh)?B.lastSh[a.k]:null;
    _rdSet(document.getElementById("ms-"+a.k),"text",
      `${_gl("śr","avg")} ${mean.toFixed(0)} · σ ${std.toFixed(0)}`
      +(state.tareOn?` · zero ${off.toFixed(0)}`:"")
      +((shv!=null&&Math.abs(shv-v)>0.5)?` · ⚙ ${Math.round(shv)}`:""));
    const pct=Math.max(-1,Math.min(1,v/32768)),bar=document.getElementById("bar-"+a.k);
    // Pasek zaokrąglony do jednej dziesiątej procenta: różnica poniżej tego progu to ułamek
    // piksela, którego nikt nie zobaczy, a zapis kosztuje tyle samo, co każdy inny.
    if(pct>=0){_rdSet(bar,"left","50%");_rdSet(bar,"width",(pct*50).toFixed(1)+"%");}
    else{_rdSet(bar,"left",(50+pct*50).toFixed(1)+"%");_rdSet(bar,"width",(-pct*50).toFixed(1)+"%");}
  }
  _rdSet(document.getElementById("rawLast"),"text",String(state.lastRaw));
}

// ---------- oscilloscopes ----------
const scopes={
  accel:{canvas:document.getElementById("scopeAccel"),wrap:document.getElementById("wrapAccel"),symmetric:false,unit:"LSB"},
  gyro:{canvas:document.getElementById("scopeGyro"),wrap:document.getElementById("wrapGyro"),symmetric:false,unit:"LSB"},
};
// DRAWING INTO A HOLE — the overlay's "content only" look, with its background cut away.
// Windows removes the pixels that are EXACTLY the hole colour and leaves every other one alone, so
// transparency does not survive the cut: ink at 30 % does not come out 30 % over the game, it comes
// out three-tenths of the way from BLACK to the ink and stays there. Every fade in these widgets
// was tuned against a dark card, where that is exactly right and reads as "quieter". With the card
// gone it reads as black scribble on the game — which is what "everything went weirdly black" was.
// So in that one case the alpha is lifted off the floor: the ORDER is kept (a fade is still fainter
// than the thing it fades from) but nothing is allowed to dissolve into the hole. Everywhere else —
// the panel, the two card looks, and bare with its background switched back on — this is inert.
const HOLE_ALPHA_FLOOR=0.35;
function _holeBg(){const r=document.documentElement;
  return r.classList.contains("rf-ovl")&&r.getAttribute("data-theme")==="bare"&&!r.classList.contains("ovl-bg");}
// Patched once per canvas (getContext returns the same object every time), and the setter asks the
// question live — so switching the look, or the background, takes effect on the next frame without
// anything having to be torn down.
let _alphaDesc=null;
function _holeAlpha(ctx){
  if(ctx._holeA)return ctx;
  const d=_alphaDesc||(_alphaDesc=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,"globalAlpha"));
  if(!d||!d.set||!d.get)return ctx;                        // no such property: leave the context alone
  Object.defineProperty(ctx,"globalAlpha",{configurable:true,
    get(){return d.get.call(this);},
    set(v){const a=Math.max(0,Math.min(1,+v||0));
      d.set.call(this,_holeBg()?(HOLE_ALPHA_FLOOR+(1-HOLE_ALPHA_FLOOR)*a):a);}});
  ctx._holeA=1;return ctx;}
// ZOOM IS NOT FREE FOR A CANVAS. The overlay scales the whole cheat sheet, and now each part of it
// separately, with `zoom` — and zoom does not change clientWidth, it changes how many screen pixels
// that width covers. A canvas whose backing store is sized off clientWidth alone is therefore drawn
// at 1/zoom of the resolution it is shown at: at 200 % the orientation ball comes out visibly soft.
// So the zoom is MEASURED (what the box really occupies ÷ what it says it is) and folded into the
// device ratio. 1 when nothing is zoomed, which is every canvas in the panel.
function _zoomOf(c){
  const w=c.clientWidth;
  if(!w)return 1;
  const r=c.getBoundingClientRect().width/w;
  return (r>0.05&&r<8)?r:1;                   // hidden or mid-transition: do not resize on nonsense
}
// ROZMIAR PŁÓTNA Z CACHE’U, NIE Z DOM-u (2026-09-05). `fit()` idzie kilkanaście razy na klatkę
// (cztery oscyloskopy, kula, pas naciśnięć, pięć kafli miniatury, wykresy osi), a każde
// `clientWidth` i `getBoundingClientRect` PO zapisie do DOM-u zmusza przeglądarkę do przeliczenia
// układu całej strony. Na Czujniku wychodziło z tego ~200 przeliczeń na sekundę.
// Rozmiary są więc ODCZYTYWANE W JEDNEJ PACZCE, a `fit()` sięga wyłącznie do zapamiętanych liczb:
//   • `fitSync()` na SAMEJ GÓRZE `frame()` — w tym miejscu układ jest świeżo policzony (zapisy
//     poprzedniej klatki poszły przed jej narysowaniem), więc cała paczka mieści się w JEDNYM
//     przeliczeniu zamiast w kilkunastu przeplecionych z zapisami,
//   • ResizeObserver — dla zmian MIĘDZY klatkami (rozwinięte `<details>`, przełączona zakładka),
//     żeby kod rysujący spoza pętli (np. `paxDrawOne`) nie trafił na stary rozmiar,
//   • `resize` okna i jawne wywołanie z `ovlApply` (rf-41), gdzie suwak „Rozmiar” przestawia zoom.
// ⚠️ ZOOM MUSI IŚĆ PRZEZ `fitSync`, a nie tylko przez obserwatora: `zoom` (ściąga w osobnym oknie)
// nie zmienia `clientWidth`, więc obserwator o nim nie wie, a przejście zakładki na chwilę skaluje
// `getBoundingClientRect` — pojedynczy pomiar złapany w takim momencie zostawał na stałe
// (zmierzone: canvas 745 px przy `clientWidth` 784 po powrocie na zakładkę).
// WHY: all canvas geometry is read in one batch instead of a dozen forced layouts per frame.
const _FITSEEN=[],_FITQ=[];let _FITRAF=0;
function _fitZoomLater(c){
  if(_FITQ.indexOf(c)<0)_FITQ.push(c);
  if(_FITRAF)return;
  _FITRAF=requestAnimationFrame(function(){_FITRAF=0;_FITQ.length=0;fitSync();});
}
// `clientWidth` zamiast `contentRect`: to jest DOKŁADNIE ta liczba, którą porównuje reszta kodu
// (i testy regresji), a wewnątrz wywołania obserwatora układ jest już policzony, więc nic nie kosztuje.
// Pełne przemierzenie (z zoomem) idzie klatkę później — `getBoundingClientRect` w trakcie
// przejścia CSS oddaje przeskalowany prostokąt.
const _FITRO=window.ResizeObserver?new ResizeObserver(function(es){
  for(const e of es){const c=e.target;c._rfW=c.clientWidth;c._rfH=c.clientHeight;_fitZoomLater(c);}
}):null;
function _fitMeasure(c){c._rfW=c.clientWidth;c._rfH=c.clientHeight;c._rfZ=_zoomOf(c);}
function fitSync(){for(const c of _FITSEEN){const w=c.clientWidth;c._rfW=w;c._rfH=c.clientHeight;
  if(w){const r=c.getBoundingClientRect().width/w;c._rfZ=(r>0.05&&r<8)?r:1;}}}
const fitZoomSync=fitSync;                 // nazwa dla rf-41 (tam chodzi wyłącznie o zoom)
window.addEventListener("resize",function(){requestAnimationFrame(fitSync);});
function fit(c){
  if(c._rfW===undefined){_FITSEEN.push(c);if(_FITRO){try{_FITRO.observe(c);}catch(e){}}_fitMeasure(c);}
  else if(!_FITRO)_fitMeasure(c);        // przeglądarka bez ResizeObserver: jak dawniej, na żywo
  const w=c._rfW||0,h=c._rfH||0;
  // Schowane płótno oddaje 0×0 — wołający i tak wychodzą po `!ff.w`, a my nie tykamy układu.
  if(!w||!h){const ctx0=c.getContext("2d");if(_holeBg())_holeAlpha(ctx0);return{ctx:ctx0,w:0,h:0};}
  const dpr=(window.devicePixelRatio||1)*(c._rfZ||1);
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
  const ctx=c.getContext("2d");if(_holeBg())_holeAlpha(ctx);ctx.setTransform(dpr,0,0,dpr,0,0);return{ctx,w,h};}
const PAD={l:52,r:12,t:14,b:20};

// ---------- LOADING animation (while looking for puck) ----------
const _now=()=>(typeof performance!=='undefined'?performance.now():Date.now())/1000;
// "Searching" animation driving the 3D puck placeholder: tension → snap → elastic settle, looped.
// Integrates the spin into the POSE.loadQ quaternion (side effect) and returns {scaleF} for the
// caller to scale the model. Scale is clamped ≤0.98 so the puck never leaves its outline.
function _hash1(n){const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x);}   // 0..1 deterministic per cycle
function loadingChoreo(now){
  const T=1.7,p=((now%T)+T)%T/T,cyc=Math.floor(now/T);                            // 1.7 s per cycle
  const ax=[_hash1(cyc)*2-1,_hash1(cyc+11.3)*2-1,_hash1(cyc+23.7)*2-1];   // rotation axis — different each cycle
  const an=Math.hypot(ax[0],ax[1],ax[2])||1,axis=[ax[0]/an,ax[1]/an,ax[2]/an];
  if(!POSE.loadQ)POSE.loadQ=[1,0,0,0];
  if(POSE.loadPhase==null)POSE.loadPhase=0;
  if(_prefersReducedMotion())return {scaleF:0.9};
  // SLINGSHOT / STRETCHED RUBBER BAND: TENSIONING (shrinks + winds up BACKWARD + pulses faster and faster: gentle→strong)
  // → SNAP forward (REVERSAL of rotation direction = shot like a released rubber band) → EXIT (spin fades, scale returns to REST).
  // CONTINUOUS loop: edge p=0/1 = REST and velocity ~0 (no jump between cycles). Scale ≤0.98 (stays within outline).
  const ss=a=>a*a*(3-2*a), E=Math.exp(-5.5);
  const REST=0.82, MIN=0.56, POP=0.975, PEAK=22.0, WIND=7.0;
  let base, spd, pAmp=0, pFreq=0;
  if(p<0.52){                                                                     // TENSIONING — tension ACCELERATES (te=a²); spin winds up BACKWARD; chirp pulse FAST gentle→fast
    const a=p/0.52, te=a*a;
    base=REST-(REST-MIN)*te;
    spd=-WIND*te;
    pAmp=0.005+0.04*te; pFreq=18+135*te;                                          // faster, stronger pulsing (up to ~24 Hz, below Nyquist)
  } else if(p<0.60){                                                              // SNAP — shot: scale MIN→POP (sharp pow⁵), spin FLIP -WIND→+PEAK (reversal = shot)
    const a=(p-0.52)/0.08;
    base=MIN+(POP-MIN)*(1-Math.pow(1-a,5));
    spd=PEAK;
  } else {                                                                        // EXIT — ELASTIC BOUNCE: scale bounces with damped sine POP→REST (snappiness), forward spin fades
    const a=(p-0.60)/0.40;
    base=REST+(POP-REST)*Math.exp(-3.0*a)*Math.cos(7.5*a);                        // damped bounce (overshoot/undershoot) — more dynamic; edge a=1 ≈ REST
    spd=PEAK*(Math.exp(-5.5*a)-E);
  }
  const dt=(POSE.loadTs==null)?0:Math.min(0.1,now-POSE.loadTs);POSE.loadTs=now;
  POSE.loadPhase+=pFreq*dt;                                                       // chirp: accumulated phase = TRUE variable pulse frequency (accelerates)
  let scaleF=base+(pAmp>0?pAmp*Math.sin(POSE.loadPhase):0);
  scaleF=Math.min(0.98,Math.max(0.45,scaleF));                                    // guarantee: stays within outline
  // rotation ACCUMULATION as a QUATERNION (sign of spd = direction; flip -WIND→+PEAK = snap; axis change each cycle without orientation jump)
  if(Math.abs(spd)>1e-5&&dt>0){
    const ang=spd*dt,s=Math.sin(ang/2),c=Math.cos(ang/2);
    const dq=[c,axis[0]*s,axis[1]*s,axis[2]*s],q=POSE.loadQ;
    const nq=[dq[0]*q[0]-dq[1]*q[1]-dq[2]*q[2]-dq[3]*q[3],
              dq[0]*q[1]+dq[1]*q[0]+dq[2]*q[3]-dq[3]*q[2],
              dq[0]*q[2]-dq[1]*q[3]+dq[2]*q[0]+dq[3]*q[1],
              dq[0]*q[3]+dq[1]*q[2]-dq[2]*q[1]+dq[3]*q[0]];
    const n=Math.hypot(nq[0],nq[1],nq[2],nq[3])||1;
    POSE.loadQ=[nq[0]/n,nq[1]/n,nq[2]/n,nq[3]/n];
  }
  return {scaleF};
}
// Perlin-style 1D gradient noise + fractal (fBm): organic, smooth, NEVER jittery — richer than plain value noise.
let _loadSeedBase=Math.random()*997;
function _pgrad(seed,i){const s=Math.sin(i*127.1+seed*311.7)*43758.5453;return 2*(s-Math.floor(s))-1;}   // pseudo-random gradient [-1,1] at a lattice point
function _pnoise(seed,x){const i=Math.floor(x),f=x-i;
  const u=f*f*f*(f*(f*6-15)+10);                                    // quintic fade (Perlin "improved noise")
  const n0=_pgrad(seed,i)*f, n1=_pgrad(seed,i+1)*(f-1);
  return 2*(n0*(1-u)+n1*u);}                                        // ~[-1,1]
function _fbm(seed,x){let sum=0,amp=0.5,frq=1,norm=0;               // 4 octaves of fractal Brownian motion
  for(let o=0;o<4;o++){sum+=amp*_pnoise(seed+o*19.73,x*frq);norm+=amp;amp*=0.5;frq*=2.0;}
  return sum/norm;}
// Organic placeholder waves (sine/square/saw): shape kept, but amplitude, LOCAL frequency, baseline AND a
// fine texture drift smoothly in space AND time (seeded per series, Perlin fBm) -> alive & irregular, never jittery.
function drawLoadingScope(ctx,w,h,type,colors){
  const pl=PAD.l,pt=PAD.t,pw=w-PAD.l-PAD.r,ph=h-PAD.t-PAD.b,now=_prefersReducedMotion()?0:_now();  // reduced-motion: freeze waves
  const midY=pt+ph/2;
  ctx.strokeStyle=cv('--line');ctx.globalAlpha=0.18;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(pl,midY);ctx.lineTo(pl+pw,midY);ctx.stroke();ctx.globalAlpha=1;
  const A=ph*0.30,cols=colors&&colors.length?colors:[cv('--az')];
  ctx.lineWidth=1.8;ctx.lineJoin="round";
  cols.forEach((col,si)=>{
    const seed=_loadSeedBase+si*137.13;
    const tt=now*(0.26+si*0.05);                     // slow organic time (drifts the whole wave)
    const baseFreq=1.4+si*0.45, scroll=now*(0.42+si*0.17)*2*Math.PI+si*1.9;  // gentle horizontal drift
    const ampBreath=1+0.55*_fbm(seed,tt*0.8);        // whole-wave amplitude breathes over time (Perlin)
    const drift=A*0.22*_fbm(seed+91.4,tt*0.6);       // whole-wave vertical wander (baseline meanders)
    ctx.strokeStyle=col;ctx.globalAlpha=0.85;ctx.beginPath();
    let phase=scroll, prevT=0;
    for(let px=0;px<=pw;px+=2){
      const t=px/pw;
      const fLocal=baseFreq*(1+0.7*_fbm(seed+21.7,t*1.9+tt*0.55));     // local cycle WIDTH varies (uneven spacing)
      phase+=fLocal*(t-prevT)*2*Math.PI; prevT=t;
      const aLocal=A*ampBreath*(1+0.45*_fbm(seed+63.3,t*2.4+tt*0.45)); // local cycle HEIGHT varies (uneven amplitude)
      const wob=A*0.10*_fbm(seed+140.9,t*6.0+tt*0.9);                  // fine texture wobble (extra randomizer, still smooth)
      let s;
      if(type==="square")s=Math.sin(phase)>=0?1:-1;
      else if(type==="saw"){const fr=((phase/(2*Math.PI))%1+1)%1;s=2*fr-1;}
      else s=Math.sin(phase);
      const x=pl+px,y=midY+drift-s*aLocal+wob;
      if(px===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
  });
  ctx.globalAlpha=1;ctx.fillStyle=cv('--dim');ctx.font="11px "+cv('--sans');ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText(_cvT(state.parked?"uśpiony — oszczędzanie baterii":"○ szukam urządzenia…"),pl+pw/2,pt+9);
}

function draw(scopeName){
  const sc=scopes[scopeName],{ctx,w,h}=fit(sc.canvas);
  // SCHOWANY = NIE RYSUJEMY. `drawFilterScope` i `drawBtnLane` mają ten warunek od zawsze, te dwa
  // oscyloskopy go NIE miały — i przez to jechały pełny przemiał (skan min/max po ~500 próbkach
  // × 3 serie, siatka, opisy osi) na płótnie o zerowej wielkości, 60 razy na sekundę, przez cały
  // czas spędzony w KAŻDEJ innej zakładce. Do 2026-08-29 nie było tego widać, bo obie karty stały
  // w prawej kolumnie, czyli zawsze na ekranie; po przeniesieniu ich do Czujnika brak tej linijki
  // byłby czystą stratą. (Płótno w schowanej zakładce ma clientWidth 0 — `.tab-panel{display:none}`.)
  if(!w||!h)return;
  ctx.clearRect(0,0,w,h);
  const B=VB();   // the VIEWED capsule's telemetry (Sensor tab is per-capsule)
  if(B.scanning){drawLoadingScope(ctx,w,h,scopeName==="accel"?"sine":"square",
    AXES.filter(a=>a.scope===scopeName).map(a=>SERIES[a.k].color));return;}
  const pl=PAD.l,pt=PAD.t,pw=w-PAD.l-PAD.r,ph=h-PAD.t-PAD.b;
  const end=(state.paused&&state.frozenTs!=null)?state.frozenTs:B.nowTs,win=state.windowSec,start=end-win;
  const x=ts=>pl+(ts-start)/win*pw;
  const keys=AXES.filter(a=>a.scope===scopeName&&SERIES[a.k].visible).map(a=>a.k);

  // A channel with a tuning chain is drawn TWICE: the untouched signal as a ghost and the value the
  // outputs actually get as the solid line. Without it the scope would keep showing the raw wave
  // while triggers and MIDI reacted to something else entirely.
  const shb=k=>chanSrcBuf(B,k);
  let ymin=Infinity,ymax=-Infinity;
  for(const k of keys){const off=state.offset[k]||0;
    for(const a of [B.buf[k],shb(k)]){if(!a)continue;
      for(let i=a.length-1;i>=0;i--){if(a[i][0]<start-0.5)break;const v=a[i][1]-off;if(v<ymin)ymin=v;if(v>ymax)ymax=v;}}}
  if(!isFinite(ymin)||!isFinite(ymax)){ymin=-1;ymax=1;}
  if(sc.symmetric){const m=Math.max(Math.abs(ymin),Math.abs(ymax),500)*1.1;ymin=-m;ymax=m;}
  else{const pad=(ymax-ymin)*0.12||500;ymin-=pad;ymax+=pad;}
  if(ymax-ymin<1e-6)ymax=ymin+1;
  const y=v=>pt+(1-(v-ymin)/(ymax-ymin))*ph;

  // Y grid
  ctx.font="10px "+cv('--mono')+",monospace";ctx.textBaseline="middle";
  for(const tv of niceTicks(ymin,ymax,5)){const yy=Math.round(y(tv))+0.5;
    ctx.strokeStyle=cv('--line');ctx.globalAlpha=tv===0?0.55:0.22;ctx.beginPath();ctx.moveTo(pl,yy);ctx.lineTo(pl+pw,yy);ctx.stroke();
    ctx.globalAlpha=1;ctx.fillStyle=cv('--muted');ctx.textAlign="right";ctx.fillText(fmtTick(tv),pl-6,yy);}
  // time axis
  ctx.textAlign="center";
  for(let s=Math.ceil(start);s<=end;s+=Math.max(1,Math.round(win/8))){const xx=Math.round(x(s))+0.5;
    ctx.strokeStyle=cv('--line');ctx.globalAlpha=0.15;ctx.beginPath();ctx.moveTo(xx,pt);ctx.lineTo(xx,pt+ph);ctx.stroke();
    ctx.globalAlpha=1;ctx.fillStyle=cv('--dim');ctx.fillText("−"+(end-s).toFixed(0)+"s",xx,pt+ph+11);}
  ctx.textAlign="left";ctx.fillStyle=cv('--dim');ctx.fillText(sc.unit,pl+2,pt+6);

  // series
  ctx.lineJoin="round";
  const _line=(a,off,col,alpha,wid)=>{
    if(!a||a.length<2)return;
    ctx.beginPath();ctx.strokeStyle=col;ctx.globalAlpha=alpha;ctx.lineWidth=wid;let started=false;
    for(let i=0;i<a.length;i++){const ts=a[i][0];if(ts<start-win)continue;const px=x(ts),py=y(a[i][1]-off);
      if(!started){ctx.moveTo(px,py);started=true;}else ctx.lineTo(px,py);}
    ctx.stroke();ctx.globalAlpha=1;};
  for(const k of keys){const off=state.offset[k]||0,sh=shb(k);
    if(sh){_line(B.buf[k],off,SERIES[k].color,.30,1.2);   // ghost = what the sensor sent
           _line(sh,off,SERIES[k].color,1,2.1);}          // solid = what the outputs read
    else _line(B.buf[k],off,SERIES[k].color,1,1.6);}
  if(keys.some(k=>shb(k))){ctx.fillStyle=cv('--dim');ctx.font="10px "+cv('--sans');ctx.textAlign="right";
    ctx.textBaseline="top";ctx.fillText(_gl("⚙ tor sygnału — blada linia = surowy","⚙ tuned — the pale line is raw"),pl+pw-2,pt+2);}

  if(state.hover&&state.hover.scope===scopeName)drawHover(scopeName,ctx,pl,pt,pw,ph,start,win,x,y,keys);
}
function drawHover(scopeName,ctx,pl,pt,pw,ph,start,win,x,y,keys){
  const hx=state.hover.x;if(hx<pl||hx>pl+pw){document.getElementById("tt").style.display="none";return;}
  const ts=start+(hx-pl)/pw*win,px=Math.round(x(ts))+0.5;
  ctx.strokeStyle="rgba(90,72,40,.45)";ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(px,pt);ctx.lineTo(px,pt+ph);ctx.stroke();ctx.setLineDash([]);
  const rows=[];
  const B=VB();
  for(const k of keys){const a=chanSrcBuf(B,k)||B.buf[k];if(!a.length)continue;let best=null,bd=1e9;
    for(let i=a.length-1;i>=0;i--){const d=Math.abs(a[i][0]-ts);if(d<bd){bd=d;best=a[i];}if(a[i][0]<ts-0.3)break;}
    if(best){rows.push({k,v:best[1]});ctx.fillStyle=SERIES[k].color;ctx.beginPath();ctx.arc(x(best[0]),y(best[1]-(state.offset[k]||0)),2.6,0,7);ctx.fill();}}
  const tt=document.getElementById("tt");if(!rows.length){tt.style.display="none";return;}
  tt.innerHTML=`<div class="r" style="color:var(--dim);margin-bottom:3px">t=${ts.toFixed(2)}s</div>`+
    rows.map(r=>`<div class="r"><b style="color:${SERIES[r.k].color}">${SERIES[r.k].label}</b><span>${r.v}</span></div>`).join("");
  tt.style.display="block";const rect=scopes[scopeName].canvas.getBoundingClientRect();
  let tx=rect.left+hx+14;if(tx+180>window.innerWidth)tx=rect.left+hx-180;
  tt.style.left=tx+"px";tt.style.top=(rect.top+state.hover.y+10)+"px";
}
function niceTicks(lo,hi,n){const span=hi-lo,s0=span/n,mag=Math.pow(10,Math.floor(Math.log10(s0||1))),nm=s0/mag,
  step=(nm<1.5?1:nm<3?2:nm<7?5:10)*mag,out=[];for(let v=Math.ceil(lo/step)*step;v<=hi+1e-9;v+=step)out.push(v);return out;}
function fmtTick(v){return Math.abs(v)>=1000?(v/1000).toFixed(1)+"k":v.toFixed(0);}

// A press written out as "340 ms" / "1,4 s" — short ones in milliseconds, because that is the unit
// the trigger settings are in (Trzymaj / hold time), so the lane and the field speak the same
// language. The decimal comma is Polish; English gets its point.
function _btnDur(ms){
  if(ms<1000)return Math.round(ms)+" ms";
  const s=(ms/1000).toFixed(1);
  return _gl(s.replace(".",","),s)+" s";
}
// button PRESSES bar under CH0-2 — same time axis/zoom/pause as the oscilloscopes.
// A press is a BAR from down to up, not a hairline at the moment of the down: on this lane a tap
// and a two-second hold used to look identical, while the difference between them is the whole
// point of "Jednorazowo" vs "Po czasie" in the trigger next to it. The hairline stays as the bar's
// left edge (the moment is still the moment) and the length is now the thing you read. Held right
// now = the bar runs to the live edge with a dashed end, so it visibly grows while you hold.
function drawBtnLane(){
  const c=document.getElementById("btnLane");if(!c)return;
  const {ctx,w,h}=fit(c);if(!w||!h)return;ctx.clearRect(0,0,w,h);
  const Pl=52,Pr=12,pw=w-Pl-Pr;                                   // alignment to the oscilloscope (PAD.l/r)
  const B=VB();
  const end=(state.paused&&state.frozenTs!=null)?state.frozenTs:B.nowTs,win=state.windowSec,start=end-win;
  ctx.strokeStyle=cv('--line');ctx.globalAlpha=0.5;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(Pl,h-3.5);ctx.lineTo(Pl+pw,h-3.5);ctx.stroke();ctx.globalAlpha=1;   // baseline
  const pr=B.btnPresses||[],bad=cv('--bad');let any=false;
  const X=t=>Pl+(t-start)/win*pw;
  for(let i=0;i<pr.length;i++){
    const p=pr[i];if(!p||p.a==null)continue;
    const held=(p.b==null), t1=held?end:p.b;
    if(t1<start||p.a>end)continue;                                // wholly outside the window
    any=true;
    const x0=Math.max(Pl,X(p.a)), x1=Math.min(Pl+pw,X(t1));
    const yTop=4, yBot=h-4;
    // the bar: a translucent body so the hairlines and the label stay readable over it
    if(x1-x0>0.7){
      ctx.globalAlpha=held?0.26:0.18;ctx.fillStyle=bad;
      ctx.fillRect(x0,yTop+1,Math.max(1,x1-x0),yBot-yTop-2);
      ctx.globalAlpha=held?0.75:0.55;ctx.strokeStyle=bad;ctx.lineWidth=1;   // top edge — reads as a bar, not a smudge
      ctx.beginPath();ctx.moveTo(x0,yTop+1.5);ctx.lineTo(x1,yTop+1.5);ctx.stroke();
    }
    ctx.globalAlpha=1;
    // the moment of the press — unchanged, still the tallest thing on the lane
    ctx.strokeStyle=bad;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x0,yBot);ctx.lineTo(x0,yTop);ctx.stroke();
    ctx.fillStyle=bad;ctx.beginPath();ctx.arc(x0,yTop+0.5,2.6,0,7);ctx.fill();
    // the end: a solid hairline when released, dashed while the finger is still down
    if(x1-x0>1.5){
      ctx.lineWidth=1;ctx.globalAlpha=held?0.6:0.85;
      if(held)ctx.setLineDash([2,2]);
      ctx.beginPath();ctx.moveTo(x1,yBot);ctx.lineTo(x1,yTop+1);ctx.stroke();ctx.setLineDash([]);
      ctx.globalAlpha=1;
    }
    // how long, written INSIDE the bar and only when the bar can hold the words. No room means the
    // press was short, and a short press is what the hairline already says.
    const txt=_btnDur((t1-p.a)*1000);
    ctx.font="9px "+cv('--mono');
    if(x1-x0>=ctx.measureText(txt).width+10){
      ctx.fillStyle=cv('--dim');ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(txt,(x0+x1)/2,h/2);ctx.textBaseline="alphabetic";ctx.textAlign="left";
    }
  }
  if(!any){ctx.fillStyle=cv('--dim');ctx.font="10px "+cv('--sans');ctx.textAlign="left";ctx.textBaseline="middle";
    ctx.fillText("(brak naciśnięć w oknie)",Pl+4,h/2);}
}
// THE SAME LANE, one capsule, six seconds, no axis furniture — for the cheat-sheet card and, through
// it, for the overlay ("naciśnięcia"). Deliberately not drawBtnLane with arguments: that one is tied
// to the Sensor tab's zoom, its pause and its 52 px left margin (it has to line up with the
// oscilloscope above it), and none of those exist here. What is shared is what matters — the shape
// of a press: a hairline at the down edge, a bar as long as it was held, dashed while it still is.
// Six seconds because that is the window the activation graphs use, and two clocks on one card that
// disagree about how far back "just now" reaches is a card that cannot be read at a glance.
const OV_PRESS_SEC=6;
function drawOvPress(c,D){
  const {ctx,w,h}=fit(c);if(!w||!h)return;ctx.clearRect(0,0,w,h);
  const pr=(D&&D.btnPresses)||[];
  // The live edge: this capsule's own clock, floored by the panel's. A capsule that sends nothing
  // for a moment must not freeze the lane — the time axis keeps scrolling, which is how a press
  // visibly ages out of the window instead of hanging there.
  const end=Math.max((D&&D.nowTs)||0,(D&&D.statusPkt&&D.statusPkt.ts)||0,state.nowTs||0);
  const start=end-OV_PRESS_SEC;
  const bad=cv('--bad'),dim=cv('--dim');
  ctx.strokeStyle=cv('--line');ctx.globalAlpha=.5;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,h-2.5);ctx.lineTo(w,h-2.5);ctx.stroke();ctx.globalAlpha=1;
  const X=t=>(t-start)/OV_PRESS_SEC*w;
  let any=false;
  for(let i=0;i<pr.length;i++){
    const p=pr[i];if(!p||p.a==null)continue;
    const held=(p.b==null),t1=held?end:p.b;
    if(t1<start||p.a>end)continue;
    any=true;
    const x0=Math.max(0,X(p.a)),x1=Math.min(w,X(t1)),yTop=3,yBot=h-3;
    if(x1-x0>0.7){
      ctx.globalAlpha=held?.28:.18;ctx.fillStyle=bad;
      ctx.fillRect(x0,yTop+1,Math.max(1,x1-x0),yBot-yTop-2);
      ctx.globalAlpha=held?.8:.55;ctx.strokeStyle=bad;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x0,yTop+1.5);ctx.lineTo(x1,yTop+1.5);ctx.stroke();
    }
    ctx.globalAlpha=1;
    ctx.strokeStyle=bad;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x0,yBot);ctx.lineTo(x0,yTop);ctx.stroke();
    if(x1-x0>1.5){
      ctx.lineWidth=1;ctx.globalAlpha=held?.6:.85;
      if(held)ctx.setLineDash([2,2]);
      ctx.beginPath();ctx.moveTo(x1,yBot);ctx.lineTo(x1,yTop+1);ctx.stroke();ctx.setLineDash([]);
      ctx.globalAlpha=1;
    }
    // How long, inside the bar and only when the bar can hold the words. No room means it was short,
    // and the figure on the left of the widget is already saying how short.
    const txt=_btnDur((t1-p.a)*1000);
    ctx.font="9px "+cv('--mono');
    if(x1-x0>=ctx.measureText(txt).width+8){
      ctx.fillStyle=dim;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(txt,(x0+x1)/2,h/2);ctx.textBaseline="alphabetic";ctx.textAlign="left";
    }
  }
  if(!any){ctx.fillStyle=dim;ctx.globalAlpha=.7;ctx.font="9px "+cv('--sans');
    ctx.textAlign="left";ctx.textBaseline="middle";
    ctx.fillText(_gl("bez naciśnięć","no presses"),2,h/2);
    ctx.textBaseline="alphabetic";ctx.globalAlpha=1;}
}
// ---------- "3D Filter — axes" oscilloscope: orientation filter output metrics ----------
// Source: state.poseBuf (server-side PoseFilter, tilt/twist/pitch/roll after "tilt acceleration").
// Same time axis / window / pause / hover as the other oscilloscopes.
function drawFilterScope(){
  const c=document.getElementById("scopeFilter");if(!c)return;
  const {ctx,w,h}=fit(c);if(!w||!h)return;                       // hidden in another tab — do not draw
  ctx.clearRect(0,0,w,h);
  const B=VB();
  if(B.scanning){drawLoadingScope(ctx,w,h,"saw",FSCOPE.map(s=>FCOLOR[s.k]));return;}
  const pl=PAD.l,pt=PAD.t,pw=w-PAD.l-PAD.r,ph=h-PAD.t-PAD.b;
  const end=(state.paused&&state.frozenTs!=null)?state.frozenTs:B.nowTs,win=state.windowSec,start=end-win;
  const x=ts=>pl+(ts-start)/win*pw;
  const pb=B.poseBuf||{};
  const keys=FSCOPE.filter(s=>FVIS[s.k]&&pb[s.k]).map(s=>s.k);
  // normalization to % of tilt (v / full-metric-tilt * 100) — shared scale for ° and °/s
  const nrm=(k,v)=>v/FNORM[k]*100;
  let ymin=Infinity,ymax=-Infinity;
  for(const k of keys){const a=pb[k];for(let i=a.length-1;i>=0;i--){if(a[i][0]<start-0.5)break;const v=nrm(k,a[i][1]);if(v<ymin)ymin=v;if(v>ymax)ymax=v;}}
  if(!isFinite(ymin)||!isFinite(ymax)){ymin=-1;ymax=1;}
  ymin=Math.min(ymin,0);ymax=Math.max(ymax,0);                  // always show the zero line
  const pad=(ymax-ymin)*0.12||8;ymin-=pad;ymax+=pad;
  if(ymax-ymin<1e-6)ymax=ymin+1;
  const y=v=>pt+(1-(v-ymin)/(ymax-ymin))*ph;
  // Y grid
  ctx.font="10px "+cv('--mono')+",monospace";ctx.textBaseline="middle";
  for(const tv of niceTicks(ymin,ymax,5)){const yy=Math.round(y(tv))+0.5;
    ctx.strokeStyle=cv('--line');ctx.globalAlpha=tv===0?0.55:0.22;ctx.beginPath();ctx.moveTo(pl,yy);ctx.lineTo(pl+pw,yy);ctx.stroke();
    ctx.globalAlpha=1;ctx.fillStyle=cv('--muted');ctx.textAlign="right";ctx.fillText(fmtTick(tv),pl-6,yy);}
  // time axis
  ctx.textAlign="center";
  for(let s=Math.ceil(start);s<=end;s+=Math.max(1,Math.round(win/8))){const xx=Math.round(x(s))+0.5;
    ctx.strokeStyle=cv('--line');ctx.globalAlpha=0.15;ctx.beginPath();ctx.moveTo(xx,pt);ctx.lineTo(xx,pt+ph);ctx.stroke();
    ctx.globalAlpha=1;ctx.fillStyle=cv('--dim');ctx.fillText("−"+(end-s).toFixed(0)+"s",xx,pt+ph+11);}
  ctx.textAlign="left";ctx.fillStyle=cv('--dim');ctx.fillText("% wychylenia",pl+2,pt+6);
  if(!keys.length){ctx.fillStyle=cv('--dim');ctx.font="11px "+cv('--sans');ctx.textAlign="center";
    ctx.fillText("(brak danych filtra — czekam na pakiety)",pl+pw/2,pt+ph/2);return;}
  // series (each axis normalized to its own full tilt → comparable despite different units)
  ctx.lineWidth=1.6;ctx.lineJoin="round";
  for(const k of keys){const a=pb[k];if(a.length<2)continue;
    ctx.beginPath();ctx.strokeStyle=FCOLOR[k]||cv('--fg');let started=false;
    for(let i=0;i<a.length;i++){const ts=a[i][0];if(ts<start-win)continue;const px=x(ts),py=y(nrm(k,a[i][1]));
      if(!started){ctx.moveTo(px,py);started=true;}else ctx.lineTo(px,py);}
    ctx.stroke();}
  if(state.hover&&state.hover.scope==="filter")drawFilterHover(ctx,pl,pt,pw,ph,start,win,x,y,keys,nrm);
}
function drawFilterHover(ctx,pl,pt,pw,ph,start,win,x,y,keys,nrm){
  const hx=state.hover.x;if(hx<pl||hx>pl+pw){document.getElementById("tt").style.display="none";return;}
  const pb=VB().poseBuf||{};
  const ts=start+(hx-pl)/pw*win,px=Math.round(x(ts))+0.5;
  ctx.strokeStyle="rgba(90,72,40,.45)";ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(px,pt);ctx.lineTo(px,pt+ph);ctx.stroke();ctx.setLineDash([]);
  const rows=[];
  for(const k of keys){const a=pb[k];if(!a||!a.length)continue;let best=null,bd=1e9;
    for(let i=a.length-1;i>=0;i--){const d=Math.abs(a[i][0]-ts);if(d<bd){bd=d;best=a[i];}if(a[i][0]<ts-0.3)break;}
    if(best){rows.push({k,v:best[1]});ctx.fillStyle=FCOLOR[k];ctx.beginPath();ctx.arc(x(best[0]),y(nrm(k,best[1])),2.6,0,7);ctx.fill();}}
  const tt=document.getElementById("tt");if(!rows.length){tt.style.display="none";return;}
  tt.innerHTML=`<div class="r" style="color:var(--dim);margin-bottom:3px">t=${ts.toFixed(2)}s</div>`+
    rows.map(r=>`<div class="r"><b style="color:${FCOLOR[r.k]}">${FLABEL[r.k].label}</b><span>${r.v.toFixed(1)} ${FLABEL[r.k].unit} · ${nrm(r.k,r.v).toFixed(0)}%</span></div>`).join("");
  tt.style.display="block";const rect=document.getElementById("scopeFilter").getBoundingClientRect();
  let tx=rect.left+hx+14;if(tx+180>window.innerWidth)tx=rect.left+hx-180;
  tt.style.left=tx+"px";tt.style.top=(rect.top+state.hover.y+10)+"px";
}
function frame(){
  fitSync();                       // wszystkie odczyty geometrii płócien w jednej paczce
  // In "All" mode (overview-only) the MAIN view is hidden — don't waste a frame on
  //  drawing it (scopes/pose/reads), otherwise it competes with the controller previews = stuttering.
  const _onAll=document.body.classList.contains("overview-only");
  // ⚠️ NAJPIERW WSZYSTKO, CO CZYTA GEOMETRIĘ, POTEM WSZYSTKO, CO PISZE DO DOM-u (2026-09-05).
  // Kolejność nie jest kosmetyką: każdy zapis do DOM-u unieważnia układ, a pierwszy odczyt po nim
  // każe przeglądarce przeliczyć go od nowa. Przeplecione (rysuj – wpisz – rysuj – wpisz) dawały
  // ~200 wymuszonych układów na sekundę na Czujniku; rozdzielone dają najwyżej jeden na klatkę.
  if(!_onAll){
    // --- ODCZYTY: płótna (`fit()`, `offsetParent`) ---
    draw("accel");draw("gyro");drawFilterScope();drawBtnLane();drawMouseScope();
    // The Kontroler tab: its own motion canvas plus the capsule→pad hub (tiles + live pad drawings).
    // Both bail out immediately when that tab is not on screen; guarded by name because rf-43 is a
    // late file and one throw in here would take the whole frame loop down.
    if(typeof drawPadScope==="function")drawPadScope();
    if(typeof padCtlFrame==="function")try{padCtlFrame();}catch(e){}
    // The Mysz tab's monitor map (rf-31b): draws the layout and polls the server a few times a
    // second for the pointer. Bails out immediately when that tab is not on screen.
    if(typeof mAreaFrame==="function")try{mAreaFrame();}catch(e){}
    if(typeof drawAxisPlots==="function")drawAxisPlots();   // per-axis tuning curves (only the unfolded ones)
  }
  // MINIATURA W PRAWEJ KOLUMNIE (rf-34c). Stoi POZA gałęzią `!_onAll`, bo w trybie „?view=overview"
  // prawej kolumny i tak nie ma i miniatura sama się wyłącza po `offsetParent` — jeden warunek
  // mniej do utrzymania w dwóch miejscach. Sama dławi się do ~30 Hz. Stoi jeszcze w grupie
  // ODCZYTÓW, bo sprawdza `offsetParent` siatki kafli.
  if(typeof rfRcolMini!=="undefined"&&rfRcolMini.frame)try{rfRcolMini.frame();}catch(e){}
  if(!_onAll){
    // --- ZAPISY: `innerHTML`, `textContent`, style ---
    // `drawPose3D` przepisuje wiersz odczytu przez `_poseSet` (rf-14), `updateReadouts` robi
    // kilkadziesiąt zapisów w kanałach, `updateTriggerLive` przestawia paski i pigułki. Kula
    // z miniatury (rf-34e, `filter:false`) rysuje się o klatkę wcześniej niż krok filtra dużej
    // karty — 16 ms opóźnienia na obrazku, którego i tak nikt nie porównuje klatka w klatkę.
    drawPose3D();
    if(live())updateReadouts();
    updateTriggerLive();
    if(state.editing)drawEditorScope();
    // Laboratorium zakresu w edytorze MIDI/OSC (rf-16c) — rysuje się tylko z otwartym szkicem
    // i samo wychodzi po pustym płótnie, gdy karta jest schowana.
    if(state._midiDraft&&typeof miLabDraw==="function")try{miLabDraw();}catch(e){}
  }
  updateDetail();
  updateSeqRun();
  const ri=document.getElementById("recInfo");
  if(state.recording)ri.innerHTML='<span style="color:var(--bad)">● REC '+(state.rec.length>=MAXREC?"MAX ":"")+state.rec.length+'</span>';
  else ri.textContent=state.rec.length?("("+state.rec.length+")"):"";
  {const dl=document.getElementById("csv"), off=!state.rec.length;
   if(dl&&dl.disabled!==off)dl.disabled=off;}
  requestAnimationFrame(frame);}

// ---------- interaction ----------
// „Zakres czasu" (UX 261120 B5b, P-G6-03): segment 5/10/20/30 s zamiast suwaka 2–30 podpisanego „Okno"
// (to słowo znaczy w aplikacji okno nakładki).
document.getElementById("win").addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("button[data-sec]");if(!b)return;
  state.windowSec=+b.dataset.sec;
  for(const x of e.currentTarget.querySelectorAll("button[data-sec]")){const on=x===b;x.classList.toggle("on",on);x.setAttribute("aria-pressed",on?"true":"false");}});
document.getElementById("pause").addEventListener("click",e=>{
  state.paused=!state.paused;state.frozenTs=state.paused?VB().nowTs:null;
  e.target.classList.toggle("on",state.paused);e.target.textContent=state.paused?"▶ Wznów":"⏸ Pauza";
  scopes.accel.wrap.classList.toggle("paused",state.paused);scopes.gyro.wrap.classList.toggle("paused",state.paused);
  const _wf=document.getElementById("wrapFilter");if(_wf)_wf.classList.toggle("paused",state.paused);});
document.getElementById("clear").addEventListener("click",()=>{
  // NAGRANIE CSV ZOSTAJE (przegląd modułów 2026-11-17). „Wyczyść” stoi przy wykresach i znaczy
  // „wyczyść to, co widzę”; kasował też po cichu nagranie, którego przyciski są na ekranie
  // Połączenie, więc kilka minut zebranych próbek znikało bez śladu. Nagranie czyści już tylko
  // nowy start nagrywania (`recToggle`), a tu dostaje się jedno zdanie, że przetrwało.
  const B=VB();for(const k of AKEYS)B.buf[k]=[];B.events=[];B.btnPresses=[];
  const tl=document.getElementById("trigLog");if(tl)tl.innerHTML="";
  document.getElementById("feed").innerHTML="";
  if(state.rec.length&&typeof rfToast==="function")
    rfToast(_gl("Wyczyszczono wykresy. Nagranie CSV zostało ("+state.rec.length+" próbek).",
                "Charts cleared. The CSV recording stays ("+state.rec.length+" samples)."),{ms:4000});});
// TARE — subtract the current offset/bias (recenter the charts). Affects display only, does not change data or engine logic.
document.getElementById("tare").addEventListener("click",e=>{
  if(!state.tareOn){
    const since=state.nowTs-1.0;
    for(const k of AKEYS)state.offset[k]=meanStd(state.buf[k],since).mean;
    state.tareOn=true;e.target.classList.add("on");e.target.textContent="Zero: wł.";
  }else{
    for(const k of AKEYS)state.offset[k]=0;
    state.tareOn=false;e.target.classList.remove("on");e.target.textContent="Zeruj wykresy";
  }
});
// CSV recording of raw samples at full resolution — manual start/stop, OFF by default
// (nothing is collected until the user presses record).
function setRecording(on){
  state.recording=on;
  const b=document.getElementById("recToggle");
  if(b){b.classList.toggle("on",on);b.textContent=on?"⏹ Zatrzymaj nagrywanie":"Nagrywaj CSV";
    b.title=on?_gl("Zatrzymaj nagrywanie (dane zostają do pobrania)","Stop recording (data stays available to download)"):_gl("Rozpocznij nagrywanie surowych próbek do CSV","Start recording raw samples to CSV");}
}
document.getElementById("recToggle").addEventListener("click",()=>{
  // "All capsules" widens whose data is taken, it is not data in itself — starting with only that
  // ticked would record an empty file and the emptiness would look like "the device sent nothing".
  if(!state.recording&&!["imu","stat","pose","trig"].some(recWants)){
    rfToast("Zaznacz najpierw, co nagrywać, bo plik wyszedłby pusty.",{tone:"danger",ms:5000});return;}
  // Uśpiony kapsel ma zerwane połączenie i nie wysyła ani jednej próbki. Nagrywanie startowało
  // wtedy radośnie i stało na „● REC 0" — wygląda to jak zepsute nagrywanie, a jest wyłączone
  // źródło. Stan czytamy z pigułki oglądanego kapsla (`conn`), a nie z karty baterii: ta pokazuje
  // TEN kapsel tylko wtedy, gdy jest on zarazem oglądany.
  if(!state.recording){
    const D=state.devices&&state.devices[state.viewDev||state.activeDeviceId||"d0"];
    if(D&&D.conn==="parked"){
      rfToast("Kapsel jest uśpiony — obudź go, żeby nagrywać.",{tone:"danger",ms:5000});return;
    }
  }
  const gl=(typeof _gl==="function")?_gl:function(pl){return pl;};
  const start=()=>{state.rec=[];state._recSaved=false;setRecording(true);flashRecMsg(gl("Nagrywam surowe próbki…","Recording raw samples…"));};  // start = fresh recording
  if(!state.recording){
    // UX 261120 B5b (P-G6-05, część P0): nowe nagranie kasuje poprzednie. Gdy tamtego nikt nie
    // pobrał, pytamy (trzy wyjścia, więc rfModal, nie rfConfirm), zamiast gubić minuty próbek.
    if(state.rec.length&&!state._recSaved&&typeof rfModal==="function"){
      const n=state.rec.length;
      rfModal({title:gl("Nagranie nie jest pobrane","The recording is not downloaded"),icon:'<span class="rfic info-ic" aria-hidden="true"></span>',
        message:gl("Masz nagranie z "+n+" próbkami, którego jeszcze nie pobrano. Nowe nagrywanie je usunie. Plik powstaje w przeglądarce, więc zamknięcie karty przed pobraniem też go usuwa.",
                   "You have a recording of "+n+" samples that has not been downloaded. A new recording deletes it. The file is built in the browser, so closing the tab before downloading deletes it too."),
        actions:[{label:gl("Anuluj","Cancel"),value:false,variant:"ghost"},
                 {label:gl("Pobierz najpierw","Download first"),value:"dl",variant:"primary"},   // pierwszy = Enter i fokus
                 {label:gl("Usuń i nagrywaj","Delete and record"),value:"del",variant:"danger"}]})
        .then(v=>{if(v==="dl"){const c=document.getElementById("csv");if(c)c.click();}
                  else if(v==="del")start();});
      return;
    }
    start();
  }
  else{setRecording(false);flashRecMsg(gl("Zatrzymano. Próbki czekają na pobranie: "+state.rec.length+".",
                                          "Stopped. Samples ready to download: "+state.rec.length+"."));}
});
// UX 261120 A1: nagrywanie mówiło tylko do `title` przycisku „Pobierz", czyli nikomu. Teraz czaszka
// (`rfSay`) i napis tuż przy przycisku nagrywania; `title` zostaje dla dymka.
function flashRecMsg(t){const el=document.getElementById("recInfo");if(el)el.title=t;
  if(typeof rfSay==="function")rfSay(t,{tone:"ok",at:document.getElementById("recToggle"),atText:String(t).split(/[.…]/)[0]});}
// --- simulation <-> LIVE switch in the header; flipping it re-execs the whole app ---
(function wireModeToggle(){
  const mt=document.getElementById("modeToggle");
  if(!mt)return;
  function waitAndReload(){   // after re-exec the server is gone for ~1 s, then returns on the same port
    let tries=0;
    (function poll(){
      tries++;
      fetch("/health",{cache:"no-store"})
        .then(r=>{if(r.ok)location.reload();else throw 0;})
        .catch(()=>{ if(tries<80) setTimeout(poll,500); else location.reload(); });
    })();
  }
  mt.addEventListener("click",async ()=>{
    if(mt.classList.contains("busy"))return;
    const target=!state.cfg.simulate;   // true = switch to simulation
    const ok=await rfConfirm(
      target
        // Simulation sends for real (keyboard/mouse/pad/MIDI/OSC) — the old wording promised the
        // opposite. Its safety net is that every output group starts switched off.
        ? "Aplikacja zrestartuje się z danymi syntetycznymi — bez sprzętu i bez BLE. Wyzwalacze działają NAPRAWDĘ: klawisze, mysz, pad, MIDI i OSC lecą do systemu. Wszystkie grupy wyjść wystartują wyłączone."
        : "Aplikacja zrestartuje się i połączy z fizycznym Triki przez BLE. Wysyłka klawiszy / MIDI będzie aktywna.",
      { title: target?"Przełączyć na symulację?":"Przełączyć na tryb LIVE?",
        icon: target?'<span class="rfm-frogtile rfm-frogsim"></span>':'<span class="rfm-frogtile rfm-frogreal"></span>', tone: target?"sim":"",
        confirmLabel:"Przełącz i zrestartuj", cancelLabel:"Anuluj" });
    if(!ok)return;
    mt.classList.add("busy");
    rfRestartOverlay(true, target?"Przełączam na symulację…":"Przełączam na tryb LIVE…", "Czekam na ponowne połączenie…");
    fetch("/mode",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({simulate:target})})
      .then(r=>r.json()).then(j=>{
        if(!j||!j.ok){mt.classList.remove("busy");rfRestartOverlay(false);rfToast("Nie udało się przełączyć trybu.",{tone:"danger"});return;}
        if(j.restart===false){mt.classList.remove("busy");rfRestartOverlay(false);return;}  // already in that mode
        setTimeout(waitAndReload,1200);
      })
      .catch(()=>{ setTimeout(waitAndReload,1200); });  // the request dies with the old process — expected
  });
})();
// Columns follow the ticks, so a file never carries a column that could not have been filled.
// `dev` is always there: without it a recording of two capsules is a pile of anonymous rows.
function recColumns(){
  const cols=["ts","type","dev"];
  for(const s of REC_STREAMS)if(recWants(s.k))cols.push(...s.cols);
  return cols;
}
document.getElementById("csv").addEventListener("click",()=>{
  if(!state.rec.length){rfToast("Brak nagranych próbek. Kliknij „Nagrywaj CSV”, wykonaj ruch, potem „Pobierz”.",{tone:"danger",ms:5000});return;}
  const cols=recColumns();
  const cell=v=>{if(v==null)return "";const s=String(v);
    return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};   // a label with a comma must not shift every column right
  const lines=[cols.join(",")];
  for(const r of state.rec)lines.push(cols.map(c=>cell(r[c])).join(","));
  const blob=new Blob([lines.join("\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="ribbitflip_"+Math.round(state.nowTs)+"s_"+state.rec.length+"rows.csv";
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  if(!state.recording)state._recSaved=true;   // pobrane po zatrzymaniu: nowy start nie musi pytać
});
for(const name of ["accel","gyro"]){const c=scopes[name].canvas;
  c.addEventListener("mousemove",ev=>{const r=c.getBoundingClientRect();state.hover={scope:name,x:ev.clientX-r.left,y:ev.clientY-r.top};});
  c.addEventListener("mouseleave",()=>{state.hover=null;document.getElementById("tt").style.display="none";});}
{const cf=document.getElementById("scopeFilter");if(cf){
  cf.addEventListener("mousemove",ev=>{const r=cf.getBoundingClientRect();state.hover={scope:"filter",x:ev.clientX-r.left,y:ev.clientY-r.top};});
  cf.addEventListener("mouseleave",()=>{state.hover=null;document.getElementById("tt").style.display="none";});}}
window.addEventListener("keydown",e=>{if(e.code==="Space"&&e.target===document.body){e.preventDefault();document.getElementById("pause").click();}});

