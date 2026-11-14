"use strict";
// Motion-control tab: canvas previews for the three modes (mouse scope, analog stick, d-pad)
// and the wiring of every control in that tab, including direction-key capture.
// The preview grew from a 250x230 thumbnail to a panel you actually watch, and everything inside
// it was written in fixed pixels — arrows, the knob, the fonts — so it all turned into confetti at
// the new size. _mS is the one factor everything drawn here multiplies by: 1 at the size this was
// designed for, ~1.6 in the widened panel, clamped so it neither disappears nor swallows the box.
function _mS(w,h){return Math.max(0.85,Math.min(2.4,Math.min(w,h)/230));}
const _mNow=()=>(typeof performance!=="undefined"?performance.now():Date.now());
// What an active direction does, in two stages:
//   ACTIVATION — it snaps up and throws off one expanding ring, so a tap that lasts two frames is
//                still visible;
//   HELD       — it keeps breathing, so "this one is on right now" reads at a glance without
//                comparing shades of grey against its neighbours.
// Purely visual state, keyed per direction. Reduced motion gets the lit state and nothing moving.
const _mPopT={}, _mTrails={};
// WHOSE preview is being drawn. The same three pictures are now painted for several capsules at
// once — the cheat sheet puts one under every slot and each overlay window carries its own — and
// everything transient in here is per capsule: which arrow popped when, where the cursor has just
// been. Without a namespace d0's up-arrow and d1's up-arrow share one animation, and one capsule's
// mouse trail is drawn through the other's.
let _mFxNS="";
const _mTrail=()=>(_mTrails[_mFxNS]||(_mTrails[_mFxNS]=[]));
const _mStill=()=>(typeof _prefersReducedMotion==="function"&&_prefersReducedMotion());
function _mFx(key,on){
  key=_mFxNS+key;
  const t=_mNow();
  if(on){ if(!_mPopT[key+"_on"]){_mPopT[key+"_on"]=1;_mPopT[key]=t;} }
  else _mPopT[key+"_on"]=0;
  if(!on||_mStill())return {s:1,ring:0};
  const dt=t-(_mPopT[key]||0);
  const snap=dt<240?0.30*Math.pow(1-dt/240,2):0;      // ease-out overshoot on the way in
  // the breathing rides ABOVE the resting size (0 .. +0.10) — an active arrow is never SMALLER
  // than an idle one, or the pulse reads as flicker instead of energy
  const beat=0.10*(0.5+0.5*Math.sin(t/1000*2*Math.PI*2.1));
  return {s:1+snap+beat, ring:dt<420?dt/420:0};
}
// the ring the activation throws off — drawn behind the arrow, gone in under half a second
function _mRing(ctx,x,y,size,prog,live){
  if(!prog)return;
  ctx.save();
  ctx.globalAlpha=0.42*(1-prog);
  ctx.strokeStyle=live?cv('--ok'):cv('--az');
  ctx.lineWidth=Math.max(1.2,size*0.09*(1-prog));
  ctx.beginPath();ctx.arc(x,y,size*(0.48+0.55*prog),0,7);ctx.stroke();
  ctx.restore();
}
// Switched off, the sketch walks itself through the control: the knob circles, the directions light
// as it passes them. It reads as a demonstration, not as data — and it stops dead for anyone who
// asked the system for less motion.
// ⚠️ `_mStill` JEST ZAJĘTE i znaczy co innego (linia 24: „czy użytkownik prosił o mniej ruchu",
// zwraca `true`/`false`). Zamrożona SYLWETKA to `_mFrozen` — jedno miejsce na to wychylenie, bo
// dwie sylwetki „w spoczynku" o różnym kącie czytałyby się jak dwa różne stany.
function _mFrozen(){return {sx:0.52,sy:-0.30,dirs:{up:true,right:true},still:true};}
function _mDemo(){
  if(typeof _prefersReducedMotion==="function"&&_prefersReducedMotion())return _mFrozen();
  const t=_mNow()/1000, a=(t%7)/7*Math.PI*2, r=0.55+0.07*Math.sin(t*1.6);
  const sx=Math.cos(a)*r, sy=Math.sin(a)*r, th=0.34;
  return {sx,sy,dirs:{up:sy<-th,down:sy>th,left:sx<-th,right:sx>th},a,r};
}
// WHERE THE SWITCHED-OFF SKETCH GETS ITS MOVEMENT. It used to be _mDemo() unconditionally — a
// canned loop, running right under a 3D capsule the user is dragging by hand, showing something
// else entirely. The server now runs the whole motion-control chain even while the group is off
// (it emits nothing — every output is gated by `live`), so as long as a capsule streams, real or
// simulated, the sketch follows THAT. The canned loop is left for "nothing is arriving at all".
// The capsule being drawn, when it is not the one the panel is looking at (the cheat sheet and the
// overlays draw slots nobody has selected). null = "ask VB()", i.e. the active capsule.
let _mScopeConn=null;
function _mIdleSrc(mode){
  const D=(typeof VB==="function")?VB():null;
  const conn=(_mScopeConn!=null)?_mScopeConn:(D?D.conn:"");
  const p=state.mousePrev;
  if(!p||(conn!=="sim"&&conn!=="connected"))return _mDemo();
  // BROADCAST OPISUJE INNY TRYB — jego pola tu nie pasują (krzyżak nadaje `dirs`, mysz chce
  // `dx/dy`), ale to NIE JEST powód, żeby puścić zapętlony pokaz. Objaw: w trybie
  // symulacji mysz w podglądzie (koło z myszką) chodziła sama, a ręczne sterowanie
  // na nią nie wpływało. Przyczyna: kapsel stał w trybie
  // krzyżaka, więc szkic myszy spadał tutaj i chodził w kółko z zegara, nie z kapsla. Ruch jest
  // wtedy podwójnie mylący: wygląda jak dane, nie odpowiada na rękę, a podpis pod spodem mówił
  // „pokaz (brak sygnału)", choć sygnał płynął. Zamrożona sylwetka mówi prawdę: o TYM sterowaniu
  // nic się teraz nie dzieje. `other` niesie tryb, w którym kapsel naprawdę jest — podpis go używa.
  if(p.mode&&p.mode!==mode)return Object.assign(_mFrozen(),{other:p.mode});
  if(mode==="mouse"){                                 // mouse reports px/sample, the sketch wants a fraction
    const ms=state.mouse.maxStep||35,cl=v=>Math.max(-1,Math.min(1,(v||0)/ms));
    return {sx:cl(p.dx),sy:cl(p.dy),dirs:{},live:false,real:true};
  }
  return Object.assign({},p,{live:false,real:true});  // stick: sx/sy · d-pad: dirs — straight from the engine
}
function _drawFeltArrow(ctx,x,y,size,dx,dy,lit,live,alpha){
  if(!_arrowImg||!_arrowImg.complete||!_arrowImg.naturalWidth)return false;
  ctx.save();ctx.globalAlpha=(alpha!=null)?alpha:(lit?1:0.4);
  if(lit&&live){ctx.shadowColor=cv('--ok');ctx.shadowBlur=10;}
  ctx.translate(x,y);ctx.rotate(Math.atan2(dy,dx));
  ctx.drawImage(_arrowImg,-size/2,-size/2,size,size);
  ctx.restore();ctx.shadowBlur=0;return true;
}
function _drawCursorImg(ctx,img,x,y,size,live){
  if(!img||!img.complete||!img.naturalWidth)return false;
  ctx.save();if(live){ctx.shadowColor=cv('--ok');ctx.shadowBlur=9;}
  ctx.drawImage(img,x-size/2,y-size/2,size,size);ctx.restore();ctx.shadowBlur=0;return true;
}
// THE MOUSE WALKS (2026-10-15, owner: "jak myszka się porusza, pokazuj jakby chodziła; kierunek chodzenia
// i prędkość animacji klatek dopasuj do prędkości", then "położenie zawsze poziome", then after a long-legged
// realistic walk: "wolę mniejsze, bardziej kreskówkowe chodzenie z krótszymi nóżkami"). A cartoon scurry:
//  - 4 drawings (rf-30 _mouseWalkImgs) with the sticker's short legs: step, feet together, other step, feet
//    together; registered on the torso, so only the little feet, arms and tail move;
//  - every step is a little HOP: the body rises on the feet-together pose and lands on the step, with
//    squash on landing and stretch at the top (volume kept: wider when squashed) — the bounce carries the
//    cartoon, the feet only patter;
//  - small quick steps: one step (2 drawings) per ~0,22 sprite heights of travel, so the feet keep pace
//    with the movement instead of skating, capped at 18 drawings a second; the velocity scope (where the
//    sprite does not travel) maps its 0..1 speed to the same scale;
//  - SETTLE: when it stops it finishes the step into a feet-together pose and stands there;
//  - always level, only facing the way it goes (mirrored to the left), from a smoothed velocity so a
//    jittery capsule does not make it spin round. State per canvas, so previews do not share a gait.
const _mWalk=new WeakMap();
const _MW={STRIDE:.22,FPS_MAX:18,HOP:.06,STOI:[1,3]};   // STOI = drawings 2 and 4 (feet together, 0-based 1, 3)
function _drawMouseWalker(ctx,x,y,size,live,vel){
  const fr=_mouseWalkImgs,N=fr.length,ok=fr.every(im=>im.complete&&im.naturalWidth);
  const t=performance.now(),cvs=ctx.canvas;
  let st=_mWalk.get(cvs);if(!st){st={x,y,t,ph:_MW.STOI[0],sp:0,vx:0,vy:0,lewo:false};_mWalk.set(cvs,st);}
  const dt=Math.min(.1,Math.max(0,(t-st.t)/1000));
  let vx,vy,v;                                          // v = travel speed in sprite heights per second
  if(vel){vx=vel.x;vy=vel.y;v=Math.min(1,Math.hypot(vx,vy))*2.2;}
  else{vx=x-st.x;vy=y-st.y;v=dt>0?Math.hypot(vx,vy)/dt/size:0;}
  st.x=x;st.y=y;st.t=t;
  st.sp+=(v-st.sp)*Math.min(1,dt*10);                  // smoothed, so one jittery sample does not stamp its feet
  const n=Math.hypot(vx,vy),k=Math.min(1,dt*5);
  if(n>1e-6){st.vx+=(vx/n*Math.min(1,v)-st.vx)*k;st.vy+=(vy/n*Math.min(1,v)-st.vy)*k;}
  if(Math.abs(st.vx)>.03&&Math.abs(st.vx)>Math.abs(st.vy)*.25)st.lewo=st.vx<0;   // turn round only on a clear sideways move
  if(!ok)return _drawCursorImg(ctx,_mouseCurImg,x,y,size,live);
  let fps=Math.min(_MW.FPS_MAX,2*st.sp/_MW.STRIDE);
  if(st.sp<=.08){                                       // settle: finish the step into the feet-together pose
    const f=Math.floor(st.ph),cel=_MW.STOI.find(p=>p>=f)??_MW.STOI[0];
    if(f!==cel)fps=Math.max(fps,8);else{fps=0;st.ph=cel+.5;}}
  else fps=Math.max(fps,4);
  st.ph=(st.ph+dt*fps)%N;
  const im=fr[Math.floor(st.ph)%N];
  // hop: up on the feet-together drawings, down (and squashed) on the steps; standing = no hop
  const h=fps?Math.abs(Math.sin((st.ph-.5)*Math.PI/2)):1,lot=fps?h:0;   // -.5: the peak sits in the middle of a drawing
  const dy=-lot*_MW.HOP*size,sy=fps?.94+.1*h:1,sx=fps?1.05-.08*h:1;
  ctx.save();if(live){ctx.shadowColor=cv('--ok');ctx.shadowBlur=9;}
  ctx.translate(x,y+dy+size/2);if(st.lewo)ctx.scale(-1,1);ctx.scale(sx,sy);   // squash from the feet, not the middle
  ctx.drawImage(im,-size/2,-size,size,size);ctx.restore();ctx.shadowBlur=0;return true;
}
// The mouse's dead zone, in the SHAPE the engine actually uses, because the two sources differ:
//   raw axis  -> each axis is cut on its own (|rx|<dz -> 0), which is a SQUARE hole, and the cursor
//                jumps from standing still to dz*sens — so the square is also the smallest step the
//                mouse can make (drawn for a neutral curve; expo/acceleration bend that number, not
//                the fact that nothing at all happens inside);
//   3D filter -> a radial zone WITH renormalisation, so it is a circle and the speed rises from
//                zero as you leave it.
// Registered as a draggable ring either way, even at zero radius, so an unset dead zone can still
// be pulled out of the centre instead of having to be typed first.
function _mouseDeadZone(ctx,S,cx,cy,sc,ms){
  const m=state.mouse, isF=(m.mouseSource==="filter");
  const rpx=isF?((Math.max(0,+m.mouseFilterDead||0)/Math.max(2,+m.mouseFilterScale||30))*ms*sc)
               :((Math.max(0,+m.mouseDeadzone||0)*(+m.sensX||0.035))*sc);
  const norm=isF?"r":"max", hot=_padIsHot("mouseDead");
  if(rpx>2)_padDrawRing(ctx,S,cx,cy,rpx,{fill:true,hot,norm,
    label:isF?(Math.round(+m.mouseFilterDead||0)+" "+_cvT("°")):String(Math.round(+m.mouseDeadzone||0))});
  _padRing({key:"mouseDead",cx,cy,r:Math.max(rpx,7*S),tol:Math.max(9,9*S),norm,
    set:px=>{if(isF)m.mouseFilterDead=Math.max(0,Math.min(30,Math.round(px/sc/ms*Math.max(2,+m.mouseFilterScale||30))));
             else m.mouseDeadzone=Math.max(0,Math.min(20000,Math.round(px/sc/Math.max(1e-4,+m.sensX||0.035)/10)*10));}});
  if(rpx>26*S){ctx.save();ctx.globalAlpha=0.55*ctx.globalAlpha;ctx.fillStyle=cv('--muted');
    ctx.font=(9.5*S).toFixed(1)+"px "+cv('--mono');ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(_cvT("martwa strefa"),cx,cy+Math.min(rpx*0.55,rpx-11*S));ctx.restore();ctx.textBaseline="alphabetic";}
}
// ── ONE PREVIEW, ANY CANVAS, ANY CAPSULE ────────────────────────────────────────────────────
// This picture used to exist twice. The tab had the one below; the cheat sheet and the overlays had
// a hand-drawn miniature of their own — a circle, four arrow characters and a line. Two drawings of
// one thing drift apart, and the miniature was much the poorer of them: no dead zone, no rosette,
// no knob, no scale, and nothing at all to watch while motion control was off. So everything now
// runs THIS code, and there is a single stick, d-pad and mouse in the whole application.
//
// The drawing functions read the settings and the live snapshot straight off `state.mouse` /
// `state.mousePrev`, and the panel only ever holds the ACTIVE capsule's. Rather than thread a
// config through a dozen functions and four levels of call, the two globals are swapped for the
// length of ONE draw and put back in a `finally`. The call is synchronous — nothing else can look
// at them in between.
//   cfg      — that capsule's motion settings (GET /airmouse?dev=…), not the active one's
//   prev     — its live snapshot from the pv stream (D.mouseLive)
//   conn     — its connection state, so the switched-off sketch knows whether anything is arriving
//   ns       — namespace for the per-arrow animation and the mouse trail
//   editable — register the draggable radii. ONLY the panel's own canvas: the cheat sheet and the
//              overlays are read-only, and a hit test that lands on a ring belonging to another
//              capsule's canvas would edit the wrong capsule.
//   forceMode — this canvas ONLY ever shows that mode. The panel now has two of them (Mysz and
//              Kontroler) over one engine, so each has to draw its own half whatever the engine is
//              currently running; without it the Mysz canvas would draw a d-pad.
let _mForceMode="";
function drawMotionScope(c,o){
  o=o||{};
  const M=state.mouse,P=state.mousePrev,NS=_mFxNS,CN=_mScopeConn,ED=_padEdit,FM=_mForceMode;
  if(o.cfg)state.mouse=o.cfg;
  if(o.prev!==undefined)state.mousePrev=o.prev||{};
  _mFxNS=o.ns||"";
  _mScopeConn=(o.conn!=null)?o.conn:null;
  _padEdit=!!o.editable;
  _mForceMode=o.forceMode||"";
  try{_drawMotionScope(c);}
  finally{state.mouse=M;state.mousePrev=P;_mFxNS=NS;_mScopeConn=CN;_padEdit=ED;_mForceMode=FM;}
}
function drawMouseScope(){drawMotionScope(document.getElementById("mScope"),{editable:true,ns:"tab:",forceMode:"mouse"});}
// The Kontroler tab's canvas — same drawing code, pinned to whichever pad half that tab is showing.
function drawPadScope(){
  const md=(typeof padMode==="function")?padMode():"stick";
  drawMotionScope(document.getElementById("kScope"),{editable:true,ns:"ktab:",forceMode:md});
}
function _drawMotionScope(c){
  if(!c)return;
  const {ctx,w,h}=fit(c);if(w<=0||h<=0)return;   // hidden (different tab) — don't render
  ctx.clearRect(0,0,w,h);ctx.textBaseline="alphabetic";
  _padRingsReset();                              // rebuilt by whichever mode draws below
  const m=state.mouse;
  // during auto-switching the preview shows the EFFECTIVE mode (from the broadcast), not the base one
  const effMode=(m.autoSwitch&&state.mousePrev&&state.mousePrev.mode)?state.mousePrev.mode:m.mode;
  // A pinned canvas whose mode is NOT the one running draws the sketch of its own mode. The engine
  // being busy elsewhere is not the same as being off, and drawScopeIdle says which it is.
  if(_mForceMode&&(!m.enabled||effMode!==_mForceMode)){drawScopeIdle(ctx,w,h);return;}
  if(!m.enabled){drawScopeIdle(ctx,w,h);return;}
  if(effMode==="stick"){drawStickPad(ctx,w,h);return;}
  if(effMode==="dpad"){drawDpadPad(ctx,w,h);return;}
  // ---- MOUSE MODE ----
  const cx=w/2,cy=h/2,S=_mS(w,h);
  // POINTING answers a different question than pushing — not "how fast and which way" but "where
  // in the area" — so it gets its own picture: the area as a rectangle with the aimed-at point in
  // it. rf-31b owns it, together with the rest of the area UI; guarded by name so that a page
  // which somehow lacks that file falls back to the velocity picture instead of throwing inside
  // the frame loop (this function runs ~60x a second, for every canvas on screen).
  if(state.mousePrev&&state.mousePrev.abs&&typeof drawAimScope==="function"){
    drawAimScope(ctx,w,h,S);return;}
  ctx.strokeStyle=cv('--line');ctx.globalAlpha=0.55;ctx.lineWidth=1*S;
  ctx.beginPath();ctx.moveTo(0,cy);ctx.lineTo(w,cy);ctx.moveTo(cx,0);ctx.lineTo(cx,h);ctx.stroke();ctx.globalAlpha=1;
  const p=state.mousePrev,ms=m.maxStep||35,sc=(Math.min(w,h)/2-20*S)/ms;   // keep the pointer sprite inside
  _mouseDeadZone(ctx,S,cx,cy,sc,ms);   // the same ring the sketch draws when the group is off
  if(p.scroll){ctx.fillStyle=cv('--gz');ctx.textAlign="center";ctx.font="700 "+(14*S).toFixed(1)+"px "+cv('--mono');
    ctx.fillText((p.scrollY>0?"▲ scroll ▲":"▼ scroll ▼")+"  "+Math.abs(p.scrollY).toFixed(1),cx,cy);}
  else{const ex=cx+(p.dx||0)*sc,ey=cy+(p.dy||0)*sc;
    // a short trail: at a glance you see WHERE it has been going, not just where it is now
    const TR=_mTrail();
    TR.push([ex,ey,_mNow()]); if(TR.length>14)TR.shift();
    ctx.save();ctx.lineCap="round";
    for(let i=1;i<TR.length;i++){const a=i/TR.length;
      ctx.globalAlpha=0.30*a;ctx.strokeStyle=p.live?cv('--ok'):cv('--az');ctx.lineWidth=3.2*S*a;
      ctx.beginPath();ctx.moveTo(TR[i-1][0],TR[i-1][1]);ctx.lineTo(TR[i][0],TR[i][1]);ctx.stroke();}
    ctx.restore();
    ctx.strokeStyle=cv('--az');ctx.lineWidth=2.2*S;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ex,ey);ctx.stroke();
    if(!_drawMouseWalker(ctx,ex,ey,30*S,p.live,{x:(p.dx||0)/ms,y:(p.dy||0)/ms})){ctx.fillStyle=p.live?cv('--ok'):cv('--az');ctx.beginPath();ctx.arc(ex,ey,4.8*S,0,7);ctx.fill();}
    // KLIK BEZ KLIKANIA: the countdown drawn where it is happening — round the pointer itself,
    // not as a number in a corner. Data straight off the live packet (dwOn/dw), so the overlays
    // get it for free; rf-31c owns it, guarded by name like every other late-file hook.
    if(typeof drawDwellRing==="function")drawDwellRing(ctx,ex,ey,S,p);}
  ctx.fillStyle=cv('--dim');ctx.font=(10.5*S).toFixed(1)+"px "+cv('--mono');ctx.textAlign="left";
  ctx.fillText(`dx ${p.dx||0} · dy ${p.dy||0}`,8*S,h-8*S);
  ctx.textAlign="right";ctx.fillStyle=p.live?cv('--warn'):cv('--dim');ctx.fillText(_cvT(p.live?"NA ŻYWO":"podgląd"),w-8*S,h-8*S);
}
// Switched off, the preview used to be an empty box with a sentence in it — the bigger the box,
// the emptier it read. It now draws the SHAPE of the mode it is waiting for (the stick's circle and
// dead zone, the d-pad's cross, the mouse's crosshair), greyed right down, so the panel shows what
// it is going to be instead of a blank.
function drawScopeIdle(ctx,w,h){
  const m0=state.mouse;
  // the EFFECTIVE mode, exactly as the live preview picks it — otherwise auto-switching would draw
  // one control while the engine reports another, and _mIdleSrc would fall back to the canned loop.
  // A pinned canvas (Mysz / Kontroler) overrides it: that canvas is ABOUT one mode and nothing else.
  const eff=(m0.autoSwitch&&state.mousePrev&&state.mousePrev.mode)?state.mousePrev.mode:m0.mode;
  const mode=_mForceMode||eff;
  // "off" vs "busy somewhere else" — the engine may be running full tilt in the other tab, and
  // saying "tryb myszy wyłączony" while the puck drives a stick would send somebody hunting a fault.
  const elsewhere=!!(_mForceMode&&m0.enabled&&eff!==_mForceMode);
  const cx=w/2,cy=h/2, S=_mS(w,h), demo=_mIdleSrc(mode);
  ctx.save();
  ctx.globalAlpha=0.42;
  try{
    if(mode==="stick")drawStickPad(ctx,w,h,true,demo);
    else if(mode==="dpad")drawDpadPad(ctx,w,h,true,demo);
    // POINTING waiting to be switched on: sketch the AREA it will point into, not the crosshair of
    // a speed it does not have. Same reason the stick's circle is drawn while it is off — the panel
    // shows what the mode is going to be. Only when the mouse is the mode in play; with the motion
    // busy driving a stick, this canvas has a different thing to say (see `elsewhere` below).
    else if(!elsewhere&&m0.mouseAbsolute&&m0.mouseSource==="filter"&&typeof drawAimScope==="function")
      drawAimScope(ctx,w,h,S,true);   // szkic: podpisy dolne zostawia drawScopeIdle
    else{const R=Math.max(8,Math.min(w,h)/2-12);
      ctx.strokeStyle=cv('--line');ctx.lineWidth=1*S;
      ctx.beginPath();ctx.moveTo(0,cy);ctx.lineTo(w,cy);ctx.moveTo(cx,0);ctx.lineTo(cx,h);ctx.stroke();
      // the dead zone is config, not data — it belongs on the sketch too, and stays draggable there
      _mouseDeadZone(ctx,S,cx,cy,(Math.min(w,h)/2-20*S)/(m0.maxStep||35),m0.maxStep||35);
      ctx.strokeStyle=cv('--az');ctx.setLineDash([4*S,4*S]);ctx.lineWidth=1.2*S;
      ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.stroke();ctx.setLineDash([]);
      const ex=cx+demo.sx*R,ey=cy+demo.sy*R;                       // the pointer walks its range
      ctx.strokeStyle=cv('--az');ctx.lineWidth=2.2*S;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ex,ey);ctx.stroke();
      if(!_drawMouseWalker(ctx,ex,ey,30*S,false)){
        ctx.fillStyle=cv('--az');ctx.beginPath();ctx.arc(ex,ey,4.8*S,0,7);ctx.fill();}}
  }catch(e){/* a preview must never take the panel down with it */}
  ctx.restore();
  // caption along the bottom, not across the middle: the sketch has its knob and axes there
  ctx.fillStyle=cv('--dim');ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.font="12px "+cv('--sans');
  const noun={mouse:"myszy",stick:"gałki",dpad:"krzyżaka"}[mode]||"sterowania";
  // say WHICH of the two it is — a sketch that follows the capsule and one that plays a loop look
  // the same for the first second, and the difference is the whole point of the panel
  const _en={mouse:["mysz","mouse"],stick:["gałka","stick"],dpad:["krzyżak","d-pad"]}[eff];
  const head=elsewhere
    ? _gl("ruch steruje teraz: ","the motion is driving: ")+(_en?_gl(_en[0],_en[1]):eff)
    : _cvT("tryb "+noun+" wyłączony");
  // "pokaz (brak sygnału)" is about THIS control's preview. With the engine busy in the other tab a
  // signal IS arriving — it just does not describe this control — so the caption stops at the head.
  //
  // TRZECI PRZYPADEK (2026-08-31): kapsel NADAJE, tylko w innym trybie, a grupa jest wyłączona.
  // Wtedy ani „podgląd idzie za kapslem" (nie idzie), ani „pokaz (brak sygnału)" (sygnał jest) nie
  // są prawdą — a szkic stoi nieruchomo (`_mIdleSrc`), więc podpis musi powiedzieć, DLACZEGO.
  const _oth=demo.other&&{mouse:["mysz","mouse"],stick:["gałka","stick"],dpad:["krzyżak","d-pad"]}[demo.other];
  const tail=demo.other
    ? _gl("kapsel jest teraz w trybie: ","this capsule's motion mode is: ")+(_oth?_gl(_oth[0],_oth[1]):demo.other)
    : _cvT(demo.real?"podgląd idzie za kapslem":"pokaz (brak sygnału)");
  ctx.fillText(elsewhere?head:(head+" — "+tail),cx,h-10);
  // AND SAY IT AS A SIGN, not only as a sentence. The sketch MOVES while the group is off — it
  // follows the capsule, or plays its loop — and a moving picture reads as a working one however
  // faint it is drawn; the line of text underneath is the last thing looked at, if at all. Over a
  // game that is a trap: the capsule is being tilted, the drawing answers, and nothing happens.
  // Not on the editing canvases in Mysz / Kontroler: there the switch is a finger's width away and
  // says the same thing, so this would be a label on a label.
  if(!_padEdit)_offBadge(ctx,cx,S,_gl("WYŁĄCZONE","OFF"));
}
// The mark itself: a crossed-out circle and one word, on a plate solid enough to be read over
// anything — in the overlay it is lying on the game, where a see-through badge would be a smudge.
function _offBadge(ctx,cx,S,txt){
  ctx.save();
  ctx.globalAlpha=1;
  ctx.font="700 "+(10.5*S).toFixed(1)+"px "+cv('--sans');
  const r=6*S, gap=5*S, pad=8*S, tw=ctx.measureText(txt).width;
  const bw=Math.round(r*2+gap+tw+pad*2), bh=Math.round(r*2+9*S);
  const bx=Math.round(cx-bw/2), by=Math.round(5*S);
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(bx,by,bw,bh,bh/2); else ctx.rect(bx,by,bw,bh);
  ctx.fillStyle="#15181d";ctx.fill();
  ctx.strokeStyle=cv('--warn');ctx.lineWidth=Math.max(1,1*S);ctx.stroke();
  const ccx=bx+pad+r, ccy=by+bh/2, d=r*0.72;
  ctx.beginPath();ctx.arc(ccx,ccy,r,0,7);
  ctx.moveTo(ccx-d,ccy+d);ctx.lineTo(ccx+d,ccy-d);          // the bar of the "no" sign
  ctx.strokeStyle=cv('--warn');ctx.lineWidth=Math.max(1.4,1.6*S);ctx.stroke();
  ctx.fillStyle=cv('--warn');ctx.textAlign="left";ctx.textBaseline="middle";
  ctx.fillText(txt,ccx+r+gap,ccy+0.5*S);
  ctx.textBaseline="alphabetic";
  ctx.restore();
}
// Analog stick preview: round pad + dead zone + stick deflection vector.
function drawStickPad(ctx,w,h,idle,demo){
  const S=_mS(w,h), cx=w/2, cy=h/2, m=state.mouse;
  const R=Math.max(8,Math.min(w,h)/2-22*S);        // 22 = half the knob sprite + margin
  const p=demo||state.mousePrev||{};
  ctx.strokeStyle=cv('--line');ctx.lineWidth=1.4*S;ctx.globalAlpha=0.85;
  ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.stroke();
  ctx.globalAlpha=0.4;ctx.lineWidth=1*S;ctx.beginPath();
  ctx.moveTo(cx-R,cy);ctx.lineTo(cx+R,cy);ctx.moveTo(cx,cy-R);ctx.lineTo(cx,cy+R);ctx.stroke();
  ctx.globalAlpha=1;
  // DEAD ZONE — the same ring, the same chip and the same drag as the d-pad's: inside it the stick
  // reports nothing. The stick's plot is already normalised (-1..1 = the rim), so its scale is fixed
  // by definition and nothing here can drift.
  const inr=R*Math.max(0,Math.min(0.5,+m.stickInner||0));
  _padDrawRing(ctx,S,cx,cy,inr,{fill:true,hot:_padIsHot("stickInner"),
    label:Math.round((+m.stickInner||0)*100)+"%"});
  _padRing({key:"stickInner",cx,cy,r:inr,tol:Math.max(9,9*S),norm:"r",
    set:px=>{m.stickInner=Math.max(0,Math.min(0.5,Math.round((px/R)/0.01)*0.01));}});
  if(inr>26*S){ctx.save();ctx.globalAlpha=0.55;ctx.fillStyle=cv('--muted');
    ctx.font=(9.5*S).toFixed(1)+"px "+cv('--mono');ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(_cvT("martwa strefa"),cx,cy+Math.min(inr*0.55,inr-11*S));ctx.restore();ctx.textBaseline="alphabetic";}
  ctx.globalAlpha=1;
  const wsad=m.stickBackend==="wsad", d=p.dirs||{};
  if(wsad){
    // WSAD threshold ring — where a direction key actually goes down; draggable like every other radius
    const tr=R*Math.max(0.1,Math.min(0.95,+m.stickWsadThr||0.5));
    _padDrawRing(ctx,S,cx,cy,tr,{hot:_padIsHot("stickWsad"),
      label:Math.round((+m.stickWsadThr||0.5)*100)+"%"});
    _padRing({key:"stickWsad",cx,cy,r:tr,tol:Math.max(9,9*S),norm:"r",
      set:px=>{m.stickWsadThr=Math.max(0.1,Math.min(0.95,Math.round((px/R)/0.05)*0.05));}});
    ctx.globalAlpha=1;
    for(const [k,dx,dy,gl] of [["up",0,-1,"↑"],["down",0,1,"↓"],["left",-1,0,"←"],["right",1,0,"→"]]){
      const on=!!d[k],x=cx+dx*R*0.86,y=cy+dy*R*0.86,fx=_mFx("s"+k,on);
      _mRing(ctx,x,y,23*S,fx.ring,p.live);
      if(!_drawFeltArrow(ctx,x,y,23*S*fx.s,dx,dy,on,p.live,on?1:0.45)){
        ctx.fillStyle=on?(p.live?cv('--ok'):cv('--az')):cv('--dim');ctx.globalAlpha=on?1:0.45;
        ctx.font="700 "+(13*S*fx.s).toFixed(1)+"px "+cv('--sans');ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(gl,x,y);}}
    ctx.globalAlpha=1;ctx.textBaseline="alphabetic";
  }
  const sx=p.sx||0,sy=p.sy||0,ex=cx+sx*R,ey=cy+sy*R,mag=Math.min(1,Math.hypot(sx,sy));
  // pushed to the rim, the knob wears a halo that breathes — "you are at full deflection" without
  // a number to read
  if(mag>0.9&&!idle){const t=_mNow()/1000;
    ctx.save();ctx.globalAlpha=0.16+0.10*Math.sin(t*7);ctx.fillStyle=p.live?cv('--ok'):cv('--az');
    ctx.beginPath();ctx.arc(ex,ey,(13+3*Math.sin(t*7))*S,0,7);ctx.fill();ctx.restore();}
  ctx.strokeStyle=cv('--az');ctx.lineWidth=2.2*S;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ex,ey);ctx.stroke();
  if(!_drawCursorImg(ctx,_stickCurImg,ex,ey,32*S,p.live)){ctx.fillStyle=p.live?cv('--ok'):cv('--az');if(p.live){ctx.shadowColor=cv('--ok');ctx.shadowBlur=8*S;}
  ctx.beginPath();ctx.arc(ex,ey,5.2*S,0,7);ctx.fill();ctx.shadowBlur=0;}
  if(idle)return;                                   // sketch only — the idle caption sits in the middle
  ctx.fillStyle=cv('--dim');ctx.font=(10.5*S).toFixed(1)+"px "+cv('--mono');ctx.textAlign="left";
  const lbl=wsad?"WSAD":(m.stickWhich==="right"?"RS":"LS");
  ctx.fillText(lbl+`  x ${sx.toFixed(2)} · y ${(-sy).toFixed(2)}`,8*S,h-8*S);
  ctx.textAlign="right";ctx.fillStyle=p.live?cv('--warn'):cv('--dim');ctx.fillText(_cvT(p.live?"NA ŻYWO":"podgląd"),w-8*S,h-8*S);
}
// ── D-PAD: ONE RADIUS, READ LIKE THE STICK ───────────────────────────────────────────
// The pad is tuned the way the stick is: a FULL DEFLECTION (how far the picture reaches) and a
// DEAD ZONE measured against it — leave the zone and the direction fires. It used to be an
// absolute firing radius plus a "hysteresis" slider, i.e. two numbers in two languages for one
// ring, and the pad's scale was a 1-2-5 ladder derived from the threshold, so the world grew and
// shrank as you typed. Full deflection is a setting now, so nothing moves unless you move it.
// The release radius (anti-flicker) is a constant here as well as in the engine (_DPAD_REL).
const DPAD_REL=0.6;
function _dpadUnits(){
  const m=state.mouse, isF=(m.dpadSource==="filter");
  // filter: everything in degrees of "pełne" · axis: everything in LSB of "pełne wychylenie"
  const full=isF?Math.max(2,+m.dpadFilterScale||45):Math.max(200,+m.dpadRange||10000);
  const thr=isF?Math.max(0.02*full,Math.min(0.9*full,+m.dpadFilterDead||0))
               :full*Math.max(0.02,Math.min(0.9,+m.dpadInner||0.3));
  return {isF,k:isF?full:1,full,thr,rel:thr*DPAD_REL,unit:isF?"°":"LSB"};
}

// ── EDITABLE RINGS — ONE MECHANISM FOR THE WHOLE "STEROWANIE RUCHEM" TAB ─────────────────────
// Every mode has a radius you have to get right: the mouse's dead zone, the stick's inner dead zone
// and its WASD threshold, the d-pad's firing radius and where it lets go. They were numbers in
// boxes, tuned by tilting a capsule until something happened. Each is now ALSO a ring you can grab
// on the preview — same tolerance, same cursor, same chip carrying the value, in all three modes.
// The registry is rebuilt every frame, so a hit test can never land on a ring that left the screen;
// a drag in progress looks its ring up by key, so it survives those rebuilds.
// _padEdit says whether the canvas being drawn is the one you can DRAG those radii on. The same
// drawing now paints read-only copies (cheat sheet, overlays), and those must not leave their rings
// in the registry: the hit test is in screen coordinates of one canvas, so a ring left behind by
// another one would be grabbed at the wrong place and would edit the wrong capsule.
let _padRings=[],_padHot=null,_padDrag=null,_padEdit=true;
function _padRingsReset(){if(_padEdit)_padRings=[];}
function _padRing(o){if(_padEdit)_padRings.push(o);}   // {key,cx,cy,r,tol,norm:'r'|'max',set(px)}
function _padDist(g,x,y){return (g.norm==="max")?Math.max(Math.abs(x-g.cx),Math.abs(y-g.cy)):Math.hypot(x-g.cx,y-g.cy);}
function _padHit(x,y){
  let best=null,bd=1e9;
  for(const g of _padRings){const gap=Math.abs(_padDist(g,x,y)-g.r);
    if(gap<=g.tol&&gap<bd){bd=gap;best=g;}}
  return best;
}
function _padIsHot(key){return (_padDrag&&_padDrag.key===key)||(!_padDrag&&_padHot===key);}
function _padDown(e){
  const g=_padHit(e.offsetX,e.offsetY);if(!g)return;
  _padDrag={key:g.key,cx:g.cx,cy:g.cy,norm:g.norm};_padHot=g.key;
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_){}
  e.preventDefault();_padApply(e);
}
function _padApply(e){
  const d=_padDrag;if(!d)return;
  const g=_padRings.find(r=>r.key===d.key);if(!g){_padDrag=null;return;}
  g.set(Math.max(0,_padDist(d,e.offsetX,e.offsetY)));
  mFill();commitMouse();          // the boxes and the rings say the same thing at every moment
}
function _padMove(e){
  if(_padDrag){_padApply(e);return;}
  const g=_padHit(e.offsetX,e.offsetY),k=g?g.key:null;
  if(k!==_padHot){_padHot=k;e.currentTarget.style.cursor=k?"grab":"";}
}
function _padUp(e){
  if(!_padDrag)return;
  _padDrag=null;
  try{e.currentTarget.releasePointerCapture(e.pointerId);}catch(_){}
  e.currentTarget.style.cursor=_padHot?"grab":"";
}
// one look for every editable radius, so a ring means the same thing in all three modes
function _padDrawRing(ctx,S,cx,cy,r,o){
  const A=ctx.globalAlpha,hot=!!o.hot;
  ctx.save();
  if(o.fill){ctx.globalAlpha=0.10*A;ctx.fillStyle=cv('--dim');
    ctx.beginPath();if(o.norm==="max")ctx.rect(cx-r,cy-r,2*r,2*r);else ctx.arc(cx,cy,r,0,7);ctx.fill();}
  ctx.globalAlpha=(hot?1:(o.soft?0.34:0.72))*A;
  ctx.strokeStyle=(hot||!o.soft)?cv('--az'):cv('--dim');
  ctx.lineWidth=(hot?2.6:(o.soft?1:1.4))*S;
  ctx.setLineDash(o.soft?[2*S,4*S]:[5*S,4*S]);
  ctx.beginPath();if(o.norm==="max")ctx.rect(cx-r,cy-r,2*r,2*r);else ctx.arc(cx,cy,r,0,7);ctx.stroke();
  ctx.setLineDash([]);ctx.globalAlpha=A;
  ctx.restore();
  if(o.label&&r>10*S)_mKeyChip(ctx,cx,cy+(o.below?r:-r),o.label,S,hot,false);
}
// The picture mirrors the engine exactly (_calc_dpad): a dead zone in the middle where nothing is
// pressed, and beyond it wedges — the angle of the movement picks the key. Four wedges of 90° with
// one key at a time, eight of 45° with diagonals. ONE ring, because there is one radius that means
// anything: the edge of the dead zone. Where it lets go (a shade inside, anti-flicker) is the
// engine's business — it was a slider once, and a slider is a promise that it is worth your time.
function _dpadZones(ctx,S,cx,cy,R,U,Rt,diag,pu){
  const n=diag?8:4, step=Math.PI*2/n, m=state.mouse;
  const hotT=_padIsHot("dpadThr");
  const A=ctx.globalAlpha;   // canvas alpha REPLACES, it does not multiply — fold in the caller's
  // FIRES HERE — everything inside is the dead zone
  _padDrawRing(ctx,S,cx,cy,Rt,{fill:true,hot:hotT,label:_dpadNum(U.thr)+" "+_cvT(U.unit)});
  _padRing({key:"dpadThr",cx,cy,r:Rt,tol:Math.max(9,9*S),norm:"r",
    set:px=>{const v=px/pu;                                    // px -> the unit the box is typed in
      if(U.isF)m.dpadFilterDead=Math.max(0,Math.min(0.9*U.full,Math.round(v*2)/2));
      else m.dpadInner=Math.max(0.05,Math.min(0.9,Math.round((v/U.full)*100)/100));}});
  ctx.save();
  // sector borders — from the dead zone out to the rim, halfway between two arrows
  ctx.globalAlpha=0.5*A;ctx.strokeStyle=cv('--az');ctx.lineWidth=1.2*S;ctx.setLineDash([5*S,4*S]);
  ctx.beginPath();
  for(let i=0;i<n;i++){const a=(i+0.5)*step,c=Math.cos(a),s=Math.sin(a);
    ctx.moveTo(cx+c*Rt,cy+s*Rt);ctx.lineTo(cx+c*R,cy+s*R);}
  ctx.stroke();ctx.setLineDash([]);
  ctx.font=(9.5*S).toFixed(1)+"px "+cv('--mono');ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.globalAlpha=0.55*A;ctx.fillStyle=cv('--muted');
  if(Rt>26*S)ctx.fillText(_cvT("martwa strefa"),cx,cy+Math.min(Rt*0.55,Rt-11*S));
  if(hotT){
    ctx.globalAlpha=0.9*A;ctx.fillStyle=cv('--az');ctx.font="700 "+(9.5*S).toFixed(1)+"px "+cv('--sans');
    ctx.fillText(_cvT("przeciągnij — martwa strefa"),cx,cy-R+9*S);
  }
  ctx.textBaseline="alphabetic";ctx.globalAlpha=A;
  ctx.restore();
}
function _dpadNum(v){return (v>=100)?String(Math.round(v)):(v>=10?v.toFixed(0):v.toFixed(1));}
// ── WHERE THE PUCK IS RIGHT NOW ───────────────────────────────────────────
// The mouse preview has its cursor and the stick has its knob; the d-pad rosette had nothing —
// you could see WHICH key was on, never how close the next one was. Deliberately NOT part of the
// zone overlay: the borders are an explanation you may switch off, the position is the reading.
// Drawn LAST, over the arrows, because at full deflection it sits exactly where one is.
function _dpadPoint(ctx,p,S,cx,cy,R,d,px,py){
  if(px==null||py==null)return;                  // no numbers -> no dot (never a made-up position)
  let x=px,y=py;
  const mag=Math.hypot(x,y), lim=R-4*S;
  if(mag>lim&&mag>0){x*=lim/mag; y*=lim/mag;}    // clamp along the vector: the ANGLE must stay true
  const ex=cx+x, ey=cy+y, live=!!p.live;
  const on=!!(d&&(d.up||d.down||d.left||d.right));
  const col=live?cv('--ok'):cv('--az');
  ctx.save();
  const A=ctx.globalAlpha;                                        // fold in the caller's alpha (see _dpadZones)
  ctx.strokeStyle=col;ctx.lineWidth=1.8*S;ctx.globalAlpha=0.5*A;  // leash to the centre = how far out it is
  ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ex,ey);ctx.stroke();
  if(on&&!_mStill()){                                             // past a threshold: it breathes
    const t=_mNow()/1000;
    ctx.globalAlpha=(0.16+0.10*Math.sin(t*7))*A;ctx.fillStyle=col;
    ctx.beginPath();ctx.arc(ex,ey,(11+3*Math.sin(t*7))*S,0,7);ctx.fill();
  }
  ctx.globalAlpha=A;ctx.fillStyle=col;
  ctx.beginPath();ctx.arc(ex,ey,5*S,0,7);ctx.fill();
  ctx.strokeStyle=cv('--panel');ctx.lineWidth=1.6*S;ctx.stroke();  // outline: stays visible over an arrow
  ctx.restore();
}
// key name on a small chip, so it stays readable over the dashed grid underneath it
function _mKeyChip(ctx,x,y,txt,S,on,live){
  ctx.save();
  ctx.font="700 "+(9.5*S).toFixed(1)+"px "+cv('--mono');ctx.textAlign="center";ctx.textBaseline="middle";
  const pw=ctx.measureText(txt).width+9*S,ph=14*S;
  ctx.globalAlpha=0.93;ctx.fillStyle=cv('--panel');
  if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x-pw/2,y-ph/2,pw,ph,4.5*S);ctx.fill();}
  else ctx.fillRect(x-pw/2,y-ph/2,pw,ph);
  ctx.globalAlpha=1;ctx.fillStyle=on?(live?cv('--ok'):cv('--az')):cv('--muted');
  ctx.fillText(txt,x,y+0.5);
  ctx.restore();ctx.textBaseline="alphabetic";
}
// D-pad preview: 4/8-direction rosette — active direction lights up.
function drawDpadPad(ctx,w,h,idle,demo){
  const cx=w/2,cy=h/2,R=Math.max(8,Math.min(w,h)/2-14),m=state.mouse,S=_mS(w,h);
  const p=demo||state.mousePrev||{},d=p.dirs||{};
  // one scale for the whole pad: the rim IS "pełne wychylenie", in the unit it is typed in
  const U=_dpadUnits();
  const has=(p.vx!=null&&p.vy!=null);
  const vx=has?p.vx*U.k:null, vy=has?p.vy*U.k:null;                 // source units -> plot units
  const pu=R/U.full;                                                 // plot unit -> px
  const Rt=Math.min(R*0.94,U.thr*pu);
  const zones=(state.dpadZones!==false);
  if(zones)_dpadZones(ctx,S,cx,cy,R,U,Rt,!!m.dpadDiagonal,pu);      // behind the arrows — the rosette stays the hero
  // 8-way: diagonal arrows (up right/up left/down right/down left) — lit when BOTH cardinals active.
  // With "Klawisze naraz → Jeden kierunek" the engine can never fire one, so they are NOT drawn at
  // all: a permanently dead arrow only makes the eye ask "why is that one greyed out?". The option
  // itself sits right under the preview, so nothing about the capability gets hidden.
  if(m.dpadDiagonal){const _dr=R*0.74*0.707;
   for(const [a,b,gl,dx,dy] of [["up","right","↗",1,-1],["up","left","↖",-1,-1],["down","right","↘",1,1],["down","left","↙",-1,1]]){
     const act=!!d[a]&&!!d[b],x=cx+dx*_dr,y=cy+dy*_dr,al=act?1:0.38;
     const fx=_mFx("d"+a+b,act);
     _mRing(ctx,x,y,27*S,fx.ring,p.live);
     if(!_drawFeltArrow(ctx,x,y,27*S*fx.s,dx,dy,act,p.live,al)){
       ctx.globalAlpha=al;ctx.fillStyle=act?(p.live?cv('--ok'):cv('--az')):cv('--dim');
       ctx.beginPath();ctx.arc(x,y,(act?11:8)*S*fx.s,0,7);ctx.fill();
       ctx.globalAlpha=1;ctx.fillStyle=act?'#0a0c12':cv('--bg2');ctx.font="700 "+(11*S).toFixed(1)+"px "+cv('--sans');
       ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(gl,x,y+1);}}
   ctx.globalAlpha=1;}
  for(const [k,dx,dy,gl] of [["up",0,-1,"↑"],["down",0,1,"↓"],["left",-1,0,"←"],["right",1,0,"→"]]){
    const on=!!d[k],x=cx+dx*R*0.74,y=cy+dy*R*0.74,fx=_mFx("c"+k,on);
    _mRing(ctx,x,y,34*S,fx.ring,p.live);
    if(!_drawFeltArrow(ctx,x,y,34*S*fx.s,dx,dy,on,p.live,on?1:0.4)){
      ctx.globalAlpha=on?1:0.4;ctx.fillStyle=on?(p.live?cv('--ok'):cv('--az')):cv('--dim');
      ctx.beginPath();ctx.arc(x,y,(on?13:10)*S*fx.s,0,7);ctx.fill();
      ctx.globalAlpha=1;ctx.fillStyle=on?'#0a0c12':cv('--bg2');ctx.font="700 "+(14*S).toFixed(1)+"px "+cv('--sans');
      ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(gl,x,y+1);}
  }
  // NO key names next to the arrows: with the usual bindings they only spell out what the arrow
  // already draws ("up" under an up arrow), and the chips crowded the wedges they sat in. The key
  // for each direction is set — and read — in the row of buttons under the preview.
  ctx.textBaseline="alphabetic";ctx.fillStyle=cv('--line');ctx.globalAlpha=1;
  ctx.beginPath();ctx.arc(cx,cy,6*S,0,7);ctx.fill();
  // the canned idle sketch has no engine numbers — plot it against its own 0.34 threshold
  const dotX=has?vx*pu:(p.sx!=null?p.sx*(R*0.56/0.34):null),
        dotY=has?vy*pu:(p.sy!=null?p.sy*(R*0.56/0.34):null);
  _dpadPoint(ctx,p,S,cx,cy,R,d,dotX,dotY);   // LAST: the position reads over everything, arrows included
  if(idle)return;                                   // sketch only — the idle caption sits in the middle
  if(has){                                          // where the puck sits, in the same unit as the rings
    ctx.fillStyle=cv('--dim');ctx.font=(10*S).toFixed(1)+"px "+cv('--mono');ctx.textAlign="left";
    ctx.fillText("⌖ "+_dpadNum(vx)+" · "+_dpadNum(vy)+" "+_cvT(U.unit)+"   "+_cvT("skala")+" "+_dpadNum(U.full),8*S,13*S);}
  ctx.fillStyle=cv('--dim');ctx.font=(10.5*S).toFixed(1)+"px "+cv('--mono');ctx.textAlign="left";
  ctx.fillText(_cvT(m.dpadDiagonal?"skosy · 2 klawisze":"1 klawisz naraz")+" · "+(m.dpadBackend==="gamepad"?"pad":"klawiatura"),8*S,h-8*S);
  ctx.textAlign="right";ctx.fillStyle=p.live?cv('--warn'):cv('--dim');ctx.fillText(_cvT(p.live?"NA ŻYWO":"podgląd"),w-8*S,h-8*S);
}
// Attribution under the mouse card. The text carries markup, so it is written as a whole block per
// language instead of going through the i18n walker; re-run on every language switch.
function renderGpHelp(){
  const en=(typeof _lang!=="undefined"&&_lang==="en");
  // Stopka Myszy mówi tylko, skąd się wziął algorytm (P-G2-12). O ViGEmBus mówi Kontroler (wiersz
  // linii gotowości i komunikat #padCtlAvail pod nią): na ekranie, który sterownika nie potrzebuje, to był szum.
  const a=document.getElementById("mAttr");
  if(a) a.innerHTML = en
    ? `Mouse-mode algorithm and default constants inspired by <a href="https://github.com/kub0vvik/TrikiAirMouse" target="_blank" rel="noopener">TrikiAirMouse</a> (own pynput implementation — not a code copy). Axis mapping is configurable because it's unconfirmed for this particular capsule.`
    : `Algorytm i domyślne stałe trybu myszy inspirowane projektem <a href="https://github.com/kub0vvik/TrikiAirMouse" target="_blank" rel="noopener">TrikiAirMouse</a> (własna implementacja na pynput — nie kopia kodu). Mapowanie osi jest konfigurowalne, bo dla tego egzemplarza kapsla jest niepotwierdzone.`;
}
function initMouse(){
  try{const z=localStorage.getItem("ribbitflip.dpadZones");if(z!=null)state.dpadZones=(z==="1");}catch(e){}
  buildMouseControls();mFill();renderGpHelp();
  // Read THIS capsule's motion settings the same way a capsule switch does, so state.mouseDev names
  // a capsule from the first moment — until it does, postMouse() deliberately refuses to write.
  if(typeof mouseFetchState==="function")mouseFetchState();
  const $=id=>document.getElementById(id);
  // TWO switches, one engine flag. "On" here means "send the motion into MY output", so switching a
  // card on also claims the mode — the capsule cannot drive a cursor and a stick at once. Switching
  // off is plain `enabled=false` and needs no confirmation (rf-39f only guards ARMING).
  const _motionSwitch=(id,modeOf)=>{
    const b=$(id); if(!b)return;
    b.onclick=()=>{
      const m=state.mouse, mine=(id==="mEnable")?(m.mode==="mouse"):(m.mode!=="mouse");
      const want=!(m.enabled&&mine);
      const apply=()=>{
        // Włączenie karty ODPARKOWUJE ruch. Ten przełącznik mówi „ruch kapsla steruje moim
        // wyjściem" — zostawienie `padPark` dałoby On, przy którym nic się nie rusza, czyli
        // dokładnie ten rodzaj cichego kłamstwa, którego to pole miało się pozbyć. Wyłączenie
        // go nie dotyka: park jest ustawieniem części pada, a nie stanem tego przełącznika.
        const took=want&&id==="mEnable"&&m.enabled&&m.mode!=="mouse";
        if(want){m.mode=modeOf();m.enabled=true;m.padPark=false;} else m.enabled=false;
        buildMouseControls();mFill();postMouse();
        if(want&&id==="mEnable")_mSayCursorOn(took);
      };
      if(want&&typeof rfSimConfirmOn==="function")rfSimConfirmOn(want,apply,"motion"); else apply();
    };
  };
  _motionSwitch("mEnable",()=>"mouse");
  _motionSwitch("kEnable",()=>padMode());
  // one action, two buttons — the capsule's zero is the capsule's, not the output's.
  // Potwierdzenie przy przycisku i w bąblu (rfCenterCapsule, rf-06): `flashTrigMsg` pisał do karty
  // Mapowania, której z tego ekranu nie widać, więc „Wyśrodkuj" wyglądało, jakby nic nie zrobiło.
  for(const id of ["mCalib","kCalib"]){const e=$(id);if(e)e.onclick=ev=>rfCenterCapsule(ev.currentTarget);}
  const num=(id,key)=>{const e=$(id);if(e)e.oninput=()=>{state.mouse[key]=+e.value;
    if(id==="mSensX")$("mSensXv").textContent=(+e.value).toFixed(3);
    if(id==="mSensY")$("mSensYv").textContent=(+e.value).toFixed(3);
    if(id==="mSmooth")$("mSmoothv").textContent=(+e.value).toFixed(2);
    if(id==="mScrollSens")$("mScrollSensv").textContent=(+e.value).toFixed(2);
    commitMouse();};};
  num("mSensX","sensX");num("mSensY","sensY");num("mSmooth","smooth");
  num("mMax","maxStep");num("mScrollThr","scrollThreshold");num("mScrollSens","scrollSens");
  num("mMouseFilterScale","mouseFilterScale");
  const sel=(id,key)=>{const e=$(id);if(e)e.onchange=()=>{state.mouse[key]=+e.value;commitMouse();};};
  sel("mScrollAxis","scrollAxis");
  const chk=(id,key)=>{const e=$(id);if(e)e.onchange=()=>{state.mouse[key]=e.checked;mFill();commitMouse();};};
  chk("mScroll","scroll");chk("mMouseEdge","mouseEdgeFollow");
  // one key at a time (default) vs diagonals — the same `dpadDiagonal` field, said out loud
  {const sg=$("mDpadDiagSeg");
   if(sg)for(const b of sg.querySelectorAll("button"))
     b.onclick=()=>{state.mouse.dpadDiagonal=(b.dataset.v==="1");mFill();commitMouse();};}
  // key zones on the preview — a PANEL preference, not engine config: never posted to the server
  {const z=$("mDpadZones");
   if(z)z.onchange=()=>{state.dpadZones=z.checked;
     try{localStorage.setItem("ribbitflip.dpadZones",z.checked?"1":"0");}catch(e){}};}
  // grab any radius straight on the preview — mouse, stick and d-pad alike (see _padRing).
  // Both canvases get the same handlers; only one is ever visible, and _padRings is rebuilt by
  // whichever one actually painted this frame.
  for(const id of ["mScope","kScope"]){const sc=$(id);
   if(sc){sc.addEventListener("pointerdown",_padDown);
     sc.addEventListener("pointermove",_padMove);
     sc.addEventListener("pointerup",_padUp);
     sc.addEventListener("pointercancel",_padUp);
     sc.addEventListener("pointerleave",()=>{if(!_padDrag){_padHot=null;sc.style.cursor="";}});}}
  // PER-MODE axes/inversion/dead zone. The Mysz card writes the "mouse*" fields, always; the
  // Kontroler card writes whichever pad half it is showing, READ AT THE MOMENT OF THE EVENT —
  // caching the prefix would send a stick tweak into the d-pad after a mode switch.
  const _axes=(pfx,fn)=>{
    const g=suf=>fn()+suf;
    {const e=$(pfx+"AxisX");if(e)e.onchange=()=>{state.mouse[g("AxisX")]=+e.value;commitMouse();};}
    {const e=$(pfx+"AxisY");if(e)e.onchange=()=>{state.mouse[g("AxisY")]=+e.value;commitMouse();};}
    {const e=$(pfx+"InvX");if(e)e.onchange=()=>{state.mouse[g("InvertX")]=e.checked;mFill();commitMouse();};}
    {const e=$(pfx+"InvY");if(e)e.onchange=()=>{state.mouse[g("InvertY")]=e.checked;mFill();commitMouse();};}
    {const e=$(pfx+"Dead");if(e)e.oninput=()=>{state.mouse[g("Deadzone")]=+e.value;commitMouse();};}
  };
  _axes("m",()=>"mouse");
  _axes("k",()=>padMode());
  // stick/d-pad sliders with value label (#id + "v")
  const rng=(id,key,fmt)=>{const e=$(id);if(e)e.oninput=()=>{state.mouse[key]=+e.value;
    const v=$(id+"v");if(v)v.textContent=fmt(+e.value);commitMouse();};};
  rng("mStickRange","stickRange",v=>Math.round(v));
  rng("mStickInner","stickInner",v=>Math.round(v*100)+"%");
  rng("mStickOuter","stickOuter",v=>Math.round(v*100)+"%");
  rng("mStickExpo","stickExpo",v=>v.toFixed(1));
  // …+ nota pod parą suwaków, bo 0,00× wyłącza oś i to musi być widać w chwili puszczenia suwaka,
  // nie po echu konfiguracji z serwera (mFill woła to samo).
  const rngSens=(id,key)=>{rng(id,key,v=>v.toFixed(2)+"×");
    const e=$(id),prev=e&&e.oninput;
    if(e&&prev)e.oninput=ev=>{prev.call(e,ev);if(typeof mStickSensNoteSync==="function")mStickSensNoteSync();};};
  rngSens("mStickSensX","stickSensX");
  rngSens("mStickSensY","stickSensY");
  rng("mStickWsadThr","stickWsadThr",v=>Math.round(v*100)+"%");
  rng("mStickAccel","stickAccel",v=>Math.round(v*100)+"%");
  rng("mDpadRange","dpadRange",v=>Math.round(v));
  rng("mDpadInner","dpadInner",v=>Math.round(v*100)+"%");
  // response shaping (curve / tightening / fast-motion sensitivity)
  rng("mMouseExpo","mouseExpo",v=>v.toFixed(2));
  rng("mTighten","tighten",v=>Math.round(v));
  rng("mSensFast","sensFast",v=>v.toFixed(3));
  // One-Euro adaptive smoothing sliders
  rng("mOeMin","oeMinCutoff",v=>v.toFixed(2));
  rng("mOeBeta","oeBeta",v=>v.toFixed(3));
  num("mAccelLo","accelThrLo");num("mAccelHi","accelThrHi");
  num("mMouseFilterDead","mouseFilterDead");num("mDpadFilterDead","dpadFilterDead");
  chk("mAccelOn","accelOn");chk("mAutoTare","autoTare");chk("kAutoTare","autoTare");   // one field, a box in each tab
  num("mStickFilterScale","stickFilterScale");num("mSwitchThreshold","switchThreshold");num("mSwitchHyst","switchHyst");
  sel("mSwitchChannel","switchChannel");
  chk("mAutoSwitch","autoSwitch");chk("mSwitchAbs","switchAbs");
  // text selectors (stick / stick backend / d-pad backend / sources / auto modes)
  const selStr=(id,key,refresh)=>{const e=$(id);if(e)e.onchange=()=>{state.mouse[key]=e.value;if(refresh)mFill();commitMouse();};};
  selStr("mStickWhich","stickWhich");
  selStr("mStickBackend","stickBackend",true);    // gamepad/input -> mFill (show/hide threshold+keys)
  selStr("mStickSource","stickSource",true);      // axis/filter -> mFill (show/hide metrics/range)
  selStr("mStickMetricX","stickMetricX");selStr("mStickMetricY","stickMetricY");
  selStr("mMouseSource","mouseSource",true);      // mouse axis/filter -> mFill (metrics + source group)
  selStr("mMouseMetricX","mouseMetricX");selStr("mMouseMetricY","mouseMetricY");
  selStr("mSmoothMode","smoothMode",true);        // classic/oneeuro -> mFill (show/hide EMA vs 1€ sliders)
  selStr("mSwitchKind","switchKind",true);        // filter/axis -> mFill (metric vs channel + unit)
  selStr("mSwitchMetric","switchMetric");selStr("mSwitchCmp","switchCmp");
  selStr("mModeTrue","modeTrue");selStr("mModeFalse","modeFalse");
  selStr("mDpadBackend","dpadBackend",true);      // backend -> mFill (show/hide keys)
  selStr("mDpadSource","dpadSource",true);        // axis/filter -> mFill (show/hide metrics/threshold)
  selStr("mDpadMetricX","dpadMetricX");selStr("mDpadMetricY","dpadMetricY");
  num("mDpadFilterScale","dpadFilterScale");
  // NOTE: the Kontroler tab has no "Gałka / Krzyżak" segment any more. Which half of the motion you
  // are editing now follows the PART clicked on the pad drawing (a stick -> stick, an arrow ->
  // d-pad), and padPartSelect in rf-43 does what this handler used to: setPadMode + claim the
  // engine's mode when it is not busy driving the cursor.
  // capture direction keys: d-pad (dpad*) + stick-WASD (stick*)
  const dk={mDpadUp:["dpadUp","↑"],mDpadDown:["dpadDown","↓"],mDpadLeft:["dpadLeft","←"],mDpadRight:["dpadRight","→"],
            mStickUp:["stickUp","↑"],mStickDown:["stickDown","↓"],mStickLeft:["stickLeft","←"],mStickRight:["stickRight","→"]};
  for(const id of Object.keys(dk)){const e=$(id);if(e){e.dataset.arrow=dk[id][1];
    e.onclick=()=>captureDirKey(e,dk[id][0]);}}
  // The cursor AREA (monitors, the fence, pointing) lives in rf-31b — its own file, because this
  // one is already past the soft size limit. Guarded by name, like every other late-file hook.
  if(typeof initMouseArea==="function")initMouseArea();
  // KLIK BEZ KLIKANIA lives in rf-31c, for the same reason and behind the same name guard.
  if(typeof initMouseDwell==="function")initMouseDwell();
  if(typeof initMouseBtnClicks==="function")initMouseBtnClicks();
  // Linia gotowości, warunki pudełek, suwak wychylenia i „Dostrajanie ruchu" (rf-31e).
  if(typeof initMouseReady==="function")initMouseReady();
}
// DROGA UCIECZKI (F-G2-06). Kursor prowadzony kapslem potrafi uciec, a jedyny włącznik trzeba by
// wtedy trafić tym samym kursorem. Dlatego przy włączeniu Myszy czaszka mówi, czym ją zatrzymać,
// i rysuje skrót awaryjny klawiszami (to samo zdanie stoi na stałe w linii gotowości). Gdy ruch
// przyszedł z Kontrolera, mówi też, że pad tam stanął.
function _mSayCursorOn(tookFromPad){
  if(typeof rfSay!=="function")return;
  const k=(typeof rfHotkeyKeys==="function")?rfHotkeyKeys():null;
  let t=tookFromPad?_gl("Ruch kapsla prowadzi teraz kursor. Pad na ekranie Kontroler stoi.","The capsule motion now moves the cursor. The pad on the Controller screen stands still.")
                   :_gl("Kapsel prowadzi kursor.","The capsule moves the cursor.");
  t+=" "+(k?_gl("Zatrzymasz go skrótem:","Stop it with:")
           :_gl("Zatrzymasz go przełącznikiem modułu albo przyciskiem sterowania u góry.","Stop it with the module switch or the control button at the top."));
  rfSay(t,{tone:"ok",ms:9000,keys:k||undefined});
}
// capture one key for a direction (d-pad / stick-WASD). Reuses specFromEvent.
// anti-leak: remove previous listener before starting a new capture.
let _dirCapH=null,_dirCapBtn=null,_dirCapArrow="";
function cancelDirCapture(){   // anti-leak: remove listener + restore button label
  if(_dirCapH){window.removeEventListener("keydown",_dirCapH,true);_dirCapH=null;}
  if(_dirCapBtn){_dirCapBtn.classList.remove("cap");
    const k=_dirCapBtn._k;_dirCapBtn.textContent=_dirCapArrow+" "+(k?(state.mouse[k]||"—"):"—");}
  _dirCapBtn=null;_dirCapArrow="";
}
function captureDirKey(btn,key){
  if(!btn.offsetParent)return;     // button hidden (mode/backend change) -> don't start
  cancelDirCapture();              // cancel any previous capture
  const arrow=btn.dataset.arrow||"";btn._k=key;
  btn.textContent=arrow+" naciśnij…";btn.classList.add("cap");
  _dirCapBtn=btn;_dirCapArrow=arrow;
  const h=e=>{e.preventDefault();e.stopPropagation();
    if(["Control","Shift","Alt","Meta"].includes(e.key))return;   // wait for the actual key
    window.removeEventListener("keydown",h,true);_dirCapH=null;_dirCapBtn=null;
    btn.classList.remove("cap");
    const spec=specFromEvent(e);if(spec){state.mouse[key]=spec;commitMouse();}
    btn.textContent=arrow+" "+(state.mouse[key]||"—");};
  _dirCapH=h;
  window.addEventListener("keydown",h,true);
}

