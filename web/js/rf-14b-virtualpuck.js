"use strict";
// ============= MANUAL CONTROL of the simulated capsule (the widget as an input device) =========
// In simulation the capsule moves along a canned waveform: pretty, and deaf to everything. This
// module lets you take the wheel — GRAB the 3D widget and the capsule goes where the hand goes.
// It is a SUB-MODE OF THE SIMULATION, switched on per capsule: the slot stays simulated, other
// slots keep their own movement, and with a real puck on BLE the button is not offered at all.
//
// The important part is what happens off-screen. The drag does NOT paint the sphere directly:
// it sends a target pose (degrees) to the server, which builds a 50 Hz packet stream in the real
// capsule's channel layout and pushes it through the ordinary pipeline. So the widget shows the
// same thing it shows for a real puck — data coming back off the wire — and everything the app
// does with a puck (triggers, keys, gamepad, MIDI/OSC, air-mouse) happens for real. That is the
// whole point: testing a mapping should exercise the mapping, not a preview of one.
//
// Left button tilts, right button (or the wheel, or Shift+left) rotates around the puck's axis,
// arrows/Q/E do the same from the keyboard, Space is the capsule's button. A flick of the wheel
// leaves the puck spinning, because a puck you flick keeps spinning.
const VPUCK={
  on:false,
  q:[1,0,0,0],                  // orientation, body->world (level = identity). See vpRot.
  btn:false,                    // virtual capsule button (Space / the toolbar button)
  latch:false,                  // przycisk zablokowany przełącznikiem „Trzymaj przycisk” (vpLatchToggle)
  spin:0,                       // deg/s left over from a flick about the vertical — decays on its own
  drag:null,                    // {kind:'tilt'|'twist', id, x, y, v, tPrev}
  owner:false,                  // THIS tab is the hand on the capsule (see vpClaim)
  dev:null,                     // capsule this session is driving (manual control is per slot)
  keys:new Set(),
  _raf:null, _beat:null, _tPrev:0, _sentAt:0, _dirty:true, _busy:false, _fails:0, _pending:false,
  _tapT:null                    // odliczanie stuknięcia (vpTap) — jedno naraz
};
// JAK DŁUGO TRWA STUKNIĘCIE. Trzy z pięciu trybów koła wyboru czekają na naciśnięcie KRÓTSZE niż
// holdMs, a odmierzanie tego myszą na oko kończy się przypadkowym przytrzymaniem. Ta liczba jest
// z zapasem poniżej najniższego holdMs, jaki wolno ustawić (RadialMenu.HOLD_MIN = 150 ms), więc
// stuknięcie NIGDY nie zostanie odczytane jako trzymanie — pilnuje tego tests/test_wheel_sim_button.py.
// Jednocześnie to cztery ramki strumienia 50 Hz, czyli tyle, ile silnik potrzebuje, żeby je zobaczyć.
const VP_TAP_MS=80;
const VP_TILT_PER_PX=0.42, VP_TWIST_PER_PX=0.75;   // degrees per pixel of drag
const VP_KEY_TILT=48, VP_KEY_TWIST=120;            // deg/s while an arrow / Q / E is held
const VP_SPIN_TAU=1.15;                            // s — how long a flick keeps spinning
// Which way a turn goes. The pose filter's twist counts POSITIVE the way the sphere draws
// COUNTER-clockwise, so every turning input is negated here: turn the hand clockwise, watch the
// capsule go clockwise. One constant, so the mouse, the wheel and Q/E can never disagree.
const VP_TURN=-1;
const VP_SEND_MS=40, VP_KEEPALIVE_MS=8000;         // ~25 Hz while moving; an idle word every 8 s
                                                   // so the server knows the page is still here
const vpCanvas=()=>document.getElementById("pose3d");
// ---------- orientation as a QUATERNION ----------
// Not pitch/roll/twist. Euler angles gimbal-lock: stand the capsule on its edge and the roll axis
// lies on top of the pitch axis, so rolling it does nothing — and standing it on its edge is
// exactly what a hand does before trying to roll it. A quaternion has no such spot, takes the
// capsule over the top as many times as you like, and keeps the turn rates honest at any angle.
// Drags are applied in the WORLD frame (pre-multiplied), which is what makes the sphere behave
// like a ball under the hand instead of like three sliders.
function _vqMul(a,b){return [
  a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
  a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],
  a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],
  a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];}
function _vqNorm(q){const n=Math.hypot(q[0],q[1],q[2],q[3])||1;return [q[0]/n,q[1]/n,q[2]/n,q[3]/n];}
function _vqAxis(ax,deg){const h=deg*Math.PI/360,s=Math.sin(h),v=[0,0,0];v[ax]=s;
  return [Math.cos(h),v[0],v[1],v[2]];}
// EVERY gesture is applied in the CAPSULE'S OWN FRAME. The user names a direction they can see —
// "up on screen", "the vertical", "the letter X" — and it is converted into the capsule's frame
// first, then applied there. That is not a stylistic choice, it is what keeps the sphere honest:
// what is DRAWN and what the capsule holds differ by a turn about the vertical (the app has no
// magnetometer, so it rebuilds that direction by integrating the gyro). Call it Rz(δ). Apply a
// world-frame turn about w and the drawn sphere turns about Rz(δ)·w — drag straight up and it tips
// sideways by δ, growing as you work. Apply the SAME turn in the capsule's frame and δ cancels:
// drawn' = Rz(δ)·R·Rot(v,θ) turns about R·v, the very line on screen.
// _vqBody: a world direction, expressed in the capsule's frame, read off the drawn orientation.
function _vqBody(w){
  const q=(typeof POSE!=="undefined"&&POSE.drawnQ&&POSE.drawnQ.length===4)?POSE.drawnQ:VPUCK.q;
  const [qw,qx,qy,qz]=q, [x,y,z]=w;                      // v = conj(q) ⊗ w ⊗ q
  const tx=2*(qy*z-qz*y), ty=2*(qz*x-qx*z), tz=2*(qx*y-qy*x);
  return [x-qw*tx+(qy*tz-qz*ty), y-qw*ty+(qz*tx-qx*tz), z-qw*tz+(qx*ty-qy*tx)];
}
// A turn about one of the axes the VIEW is built on — 0=X (front/back line), 1=Y (left/right),
// 2=Z (the vertical) — carried out in the capsule's frame.
function vpRot(ax,deg){ if(!deg)return; const w=[0,0,0]; w[ax]=1; vpRotAxis(_vqBody(w),deg); }
// Turn about one of the CAPSULE's OWN axes — what the X/Y/Z letters name. Body frame, so it
// POST-multiplies, and that is the whole point:
//   the drawn pose and the true pose differ by a turn about the vertical (the preview rebuilds
//   that direction by integrating the gyro, because gravity cannot reveal it). Call that offset
//   Rz(δ). Rotating the capsule about its own axis v gives  drawn' = Rz(δ)·R·Rot(v,θ), i.e. the
//   sphere turns about R·v — precisely the line the letter is drawn on. The offset δ cancels
//   instead of leaking into the axis, whatever it has grown to.
// Rotating about the world direction the letter is drawn at does NOT have that property: it turns
// the capsule about a line δ away from its own axis, and the error compounds with every grab.
function vpRotAxis(v,deg){
  if(!deg)return;
  const n=Math.hypot(v[0],v[1],v[2]); if(!n)return;
  const h=deg*Math.PI/360, s=Math.sin(h)/n;
  VPUCK.q=_vqNorm(_vqMul(VPUCK.q,[Math.cos(h),v[0]*s,v[1]*s,v[2]*s]));
  VPUCK._dirty=true;
}
// The six axis endpoints are HANDLES: grab X, −X, Y, −Y, Z or −Z and turn the capsule about that
// axis. Their screen positions come from the widget itself (rf-14 publishes POSE.axisHit while
// drawing), so what you grab is exactly what you see — no second copy of the camera maths here.
// `c` jest PARAMETREM od 2026-08-30 (miniatura w prawej kolumnie też przyjmuje mysz — patrz
// `vpWireSphere`). Domyślnie duża karta, czyli to samo płótno, względem którego rf-14 liczy
// `POSE.axisHit`; wołanie z innym płótnem miałoby sens tylko wtedy, gdyby ono też te litery
// rysowało, a miniatura ich nie rysuje i dlatego dostaje `{axis:false}`.
// WSZYSTKIE KULE PODPIĘTE DO MYSZY (2026-08-30, etap 9). Do etapu 8 wystarczyła jedna zmienna,
// bo płótno było jedno. Od etapu 9 podświetlenie uchwytu wisi na PŁÓTNIE (`_poseHot`), więc gaszenie
// go przy wyjściu z trybu ręcznego musi obejść wszystkie — a jedyne miejsce, które wie, ile ich
// jest, to funkcja, która je podpina. Lista, nie licznik: kul może przybyć.
const VP_SPHERES=[];
// Podświetlenie uchwytu — na PŁÓTNIE, z mirrorem w `POSE.axisHot` (zgodność wstecz: tamtą zmienną
// czyta jeszcze `vpUpdateUi` i mogłaby czytać dowolna karta rysowana bez `_poseHot`).
function vpHot(c,k){ if(c)c._poseHot=k; if(typeof POSE!=="undefined")POSE.axisHot=k; }
function vpAxisAt(clientX,clientY,c){
  c=c||vpCanvas(); if(!c)return null;
  // ŹRÓDŁEM UCHWYTÓW JEST PŁÓTNO, NIE APLIKACJA (patrz `_poseHits` w rf-14). `undefined` znaczy
  // „to płótno nigdy nie rysowało pełnej kuli" i wtedy — i tylko wtedy — sięgamy po mirror z POSE.
  // `null` znaczy „rysowało, ale liter teraz nie ma" (mała kula, widok 2D, animacja szukania)
  // i MUSI zwrócić brak uchwytów; gdyby wpadło w to samo `||` co `undefined`, miniatura celowałaby
  // we współrzędne policzone dla dużej karty.
  const hits=(c._poseHits!==undefined)?c._poseHits:((typeof POSE!=="undefined")&&POSE.axisHit);
  if(!hits||!hits.length)return null;
  const r=c.getBoundingClientRect(), px=clientX-r.left, py=clientY-r.top;
  let best=null,bd=1e9;
  for(const h of hits){
    const d=Math.hypot(px-h.x,py-h.y);
    if(d<h.r&&d<bd){bd=d;best=h;}
  }
  return best;
}
// Angles for the readout and the type-in fields (ZYX, the same convention the server converts).
// Only a VIEW of the orientation: pitch reads ±90 by definition, which is fine for three numbers
// under a sphere and is why they are not what the capsule's pose is actually kept in.
function _vqEuler(q){
  const [w,x,y,z]=q, sp=Math.max(-1,Math.min(1,2*(w*y-z*x)));
  return {twist:Math.atan2(2*(w*z+x*y),1-2*(y*y+z*z))*180/Math.PI,
          pitch:Math.asin(sp)*180/Math.PI,
          roll:Math.atan2(2*(w*x+y*z),1-2*(x*x+y*y))*180/Math.PI};
}
function _vqFromEuler(p,r,t){
  return _vqNorm(_vqMul(_vqMul(_vqAxis(2,t),_vqAxis(1,p)),_vqAxis(0,r)));
}
// Every user-visible string below is written in POLISH on purpose: that is the source language,
// and the i18n walker (rf-01) swaps it for English when the page is in EN. Emitting English here
// would leave the label stranded in whatever language it was written in when the user switches.

// ---------- server conversation ----------
function vpPost(body){
  return fetch("/virtual",{method:"POST",headers:{"Content-Type":"application/json"},
                           body:JSON.stringify(body)}).then(r=>r.json());
}
// One request in flight at a time: a drag fires far more often than localhost round-trips
// complete, and overlapping posts would land out of order — the puck would jitter backwards.
function vpSend(force){
  // Only the tab holding the capsule sends. A second dashboard open on the same machine follows
  // the state (badge, bar, numbers) but must not post its own idea of the pose — its keepalive
  // would yank the puck back to whatever it last knew, mid-drag, in the other window.
  if(!VPUCK.on||!VPUCK.owner)return;
  const now=performance.now();
  if(VPUCK._busy){VPUCK._pending=true;return;}
  if(!force&&!VPUCK._dirty&&now-VPUCK._sentAt<VP_KEEPALIVE_MS)return;
  if(!force&&now-VPUCK._sentAt<VP_SEND_MS){VPUCK._pending=true;return;}
  VPUCK._busy=true; VPUCK._dirty=false; VPUCK._pending=false; VPUCK._sentAt=now;
  vpPost({on:true,q:VPUCK.q,btn:VPUCK.btn})
    .then(r=>{
      VPUCK._fails=0;
      if(r&&r.ok===false)vpStop(r.error||"Nie udało się włączyć sterowania ręcznego.");
    })
    .catch(()=>{ if(++VPUCK._fails>=3)vpStop("Utracono połączenie z serwerem — koniec sterowania ręcznego."); })
    .then(()=>{VPUCK._busy=false; if(VPUCK._pending)vpSend(true);});
}

// ---------- on / off ----------
function vpSimMode(){return !!(typeof state!=="undefined"&&state.cfg&&state.cfg.simulate);}
function vpStart(){
  if(VPUCK.on)return Promise.resolve(true);
  VPUCK.dev=(typeof state!=="undefined"&&(state.viewDev||state.activeDeviceId))||"d0";
  return vpPost({on:true,q:VPUCK.q,btn:VPUCK.btn}).then(r=>{   // `btn`, nie `false`: ręka mogła już nacisnąć (vpEngage)
    if(!r||r.ok===false){
      if(typeof rfToast==="function")rfToast((r&&r.error)||"Nie udało się włączyć sterowania ręcznego.",{tone:"danger"});
      return false;
    }
    VPUCK.on=true; VPUCK.owner=true; VPUCK._fails=0; VPUCK._sentAt=performance.now(); VPUCK._tPrev=0;
    vpModeSwap(true);
    vpUpdateUi();
    vpRun();
    const c=vpCanvas(); if(c)c.focus({preventScroll:true});
    return true;
  }).catch(()=>{
    if(typeof rfToast==="function")rfToast("Serwer nie odpowiada — sterowanie ręczne niedostępne.",{tone:"danger"});
    return false;
  });
}
// Local shutdown + a best-effort word to the server. `msg` (optional) explains an involuntary one.
function vpStop(msg){
  const was=VPUCK.on;
  vpTapCancel();   // stuknięcie w locie nie ma już czego puścić — serwer i tak zeruje przycisk
  VPUCK.on=false; VPUCK.owner=false; VPUCK.btn=false; VPUCK.latch=false; VPUCK.spin=0; VPUCK.drag=null; VPUCK.keys.clear();
  vpModeSwap(false);
  vpHalt();
  vpUpdateUi();
  if(was)vpPost({on:false}).catch(()=>{});
  if(msg&&typeof rfToast==="function")rfToast(msg,{tone:"danger"});
}
function vpToggle(){ if(VPUCK.on)vpStop(); else vpStart(); }
// KAŻDA RĘKA NA STERZE PRZEJMUJE KAPSEL (2026-08-30, etap 9b). Kula w prawej kolumnie
// ma być interaktywna (klikanie itp.) niezależnie od tego, czy ktoś wcześniej
// wcisnął „Steruj ręcznie". Do tej pory KAŻDE wejście zaczynało się od `if(!VPUCK.on)return;`, więc
// kula przy wyłączonym trybie była obrazkiem — chwyt nie robił NIC i nie mówił dlaczego.
// Teraz chwyt sam włącza tryb, dokładnie tak jak `vpClaim` sam odbiera kapsel drugiej karcie:
// dotknięcie steru JEST deklaracją „ja teraz prowadzę".
//   • `vpSimMode()` zostaje twardą bramką — przy prawdziwym kapslu na BLE nie ma czego udawać
//     i wtedy funkcja zwraca `false`, a wywołujący wychodzi tak samo jak przedtem,
//   • `vpStart()` jest ASYNCHRONICZNE (slot przydziela serwer), więc akcje, które BEZ włączonego
//     trybu nic by nie zrobiły (`vpTap`, `vpLevel`), przekazujemy jako `fn` i odpalamy po
//     odpowiedzi. Przeciąganie kuli `fn` nie potrzebuje: obraca lokalne `VPUCK.q`, a `vpSend`
//     i tak milczy do czasu, aż tryb wstanie (`if(!VPUCK.on||!VPUCK.owner)return;`), po czym
//     wysyła CAŁY narobiony obrót jedną paczką.
function vpEngage(fn){
  if(VPUCK.on){ if(fn)fn(); return true; }
  if(!vpSimMode())return false;
  // ⚠️ PODMIANA PODGLĄDU MUSI SIĘ STAĆ TERAZ, NIE PO ODPOWIEDZI SERWERA (naprawa 2026-08-30,
  // etap 10). `vpStart()` jest asynchroniczne, a chwyt kuli rusza NATYCHMIAST — więc gest zaczynał
  // się w trybie „Filtr", a `vpModeSwap(true)` wchodziło w jego ŚRODKU. A ta podmiana nie jest
  // niewinna: przestawia podgląd na „Żyro" i przesiewa go od nowa, przez co obraz przeskakiwał
  // w połowie ruchu i chwycona litera lądowała gdzie indziej. Zmierzone przed poprawką: chwyt „X"
  // odchylał oś X o 35,8°, chwyt „Y" o 107,8° — i to odchylenie ZOSTAWAŁO po puszczeniu.
  // Wołane osobno, a nie zostawione `vpStart()`: tam też jest `vpModeSwap(true)`, ale jego strażnik
  // (`if(VPUCK._modeSwapped…)return`) zobaczy, że robotę już wykonaliśmy — więc drugi raz nic nie robi.
  vpModeSwap(true);
  vpStart().then(ok=>{
    if(!ok){ vpModeSwap(false); return; }   // serwer odmówił slotu — oddaj podgląd, który pożyczyliśmy
    if(fn)fn();
  });
  return true;
}
// Manual control belongs to ONE capsule — the one whose widget is on screen. Looking at another
// capsule hands the previous one back to its own simulated movement (rather than leaving a puck
// nobody is holding to time out on the server's watchdog), then reads the new one's state.
function vpSyncView(){
  const dev=(typeof state!=="undefined"&&(state.viewDev||state.activeDeviceId))||"d0";
  if(dev===VPUCK.dev)return;
  if(VPUCK.on&&VPUCK.dev){
    const prev=VPUCK.dev;
    fetch("/virtual?dev="+encodeURIComponent(prev),{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({on:false})}).catch(()=>{});
  }
  VPUCK.dev=dev;
  vpOnServerState(false);
  fetch("/virtual").then(r=>r.json()).then(s=>{
    if(!s)return;
    if(Array.isArray(s.q)&&s.q.length===4)VPUCK.q=_vqNorm(s.q.map(Number)); VPUCK.btn=false;
    vpOnServerState(!!s.on);
  }).catch(()=>{});
}
// The server tells every open tab when manual control starts or stops (its watchdog, a second
// window, the mode switch) — follow it instead of leaving a stale button on screen.
function vpOnServerState(on){
  if(on===VPUCK.on)return;
  if(on){
    VPUCK.on=true;VPUCK._sentAt=performance.now();vpUpdateUi();vpRun();
    if(!VPUCK.owner)vpAdopt();          // someone else is driving — mirror their pose, don't post ours
  }
  else{vpTapCancel();
       VPUCK.on=false;VPUCK.owner=false;VPUCK.btn=false;VPUCK.latch=false;VPUCK.spin=0;VPUCK.drag=null;VPUCK.keys.clear();
       vpModeSwap(false);vpHalt();vpUpdateUi();}
}
// Read the pose the capsule is actually at. A passive tab needs it to show the right numbers, and
// to be ready: the moment a hand touches the sphere HERE, this tab takes over from exactly where
// the capsule stands rather than snapping it back to its own stale zeros.
function vpAdopt(){
  fetch("/virtual").then(r=>r.json()).then(s=>{
    if(!s||VPUCK.owner||VPUCK.drag)return;
    if(Array.isArray(s.q)&&s.q.length===4)VPUCK.q=_vqNorm(s.q.map(Number));
    vpReadout();
  }).catch(()=>{});
}
// Any hand on the widget claims it. Whoever touches the capsule drives it — no "release" button,
// no negotiation; the previous tab simply stops being the one that posts.
function vpClaim(){
  if(!VPUCK.on||VPUCK.owner)return;
  VPUCK.owner=true; vpModeSwap(true);   // the hand that takes over gets the faithful view, too
  VPUCK._dirty=true; vpSend(true); vpUpdateUi();
}
// TWO clocks, on purpose. rAF gives the smooth part (held keys, flick spin) but it STOPS when the
// window is hidden or minimised — and the whole point of hand-driving a capsule is to leave the
// dashboard and watch the keys land in a game or a DAW. A plain interval keeps talking to the
// server while the tab is in the background (throttled to ~1 Hz, still well inside the watchdog),
// so switching windows no longer drops the puck out of the user's hand.
function vpRun(){
  if(!VPUCK._raf)VPUCK._raf=requestAnimationFrame(vpTick);
  // On a timer, not on rAF: a tab that is merely WATCHING may be in the background with its
  // animation frames frozen, and it still has to keep its numbers close to the capsule's real
  // pose — otherwise the moment a hand touches this sphere it would drag the puck back in time.
  if(!VPUCK._beat)VPUCK._beat=setInterval(()=>{
    if(!VPUCK.on)return;
    if(VPUCK.owner)vpSend(false); else vpAdopt();
  },3000);
}
function vpHalt(){
  if(VPUCK._raf){cancelAnimationFrame(VPUCK._raf);VPUCK._raf=null;}
  if(VPUCK._beat){clearInterval(VPUCK._beat);VPUCK._beat=null;}
  if(VPUCK._levelT){clearInterval(VPUCK._levelT);VPUCK._levelT=null;}   // pending "level the picture too"
}

// ---------- pose edits ----------
// TILT names a direction on SCREEN ("away from me", "to the right"), so it is converted into the
// capsule's frame first and applied there.
function vpTilt(dPitch,dRoll){ vpRot(1,dPitch); vpRot(0,dRoll); }
// TWIST names the capsule's OWN axis — spinning a puck is spinning it about its own face, which is
// also what the app's "obrót" metric measures. No conversion: it is already a local axis, the same
// one the Z handle grabs, so the knob, the wheel, Q/E and the Z letter cannot disagree.
function vpTwist(d){ vpRotAxis([0,0,1],d); }
// "Wypoziomuj" has to level BOTH things: the capsule and the picture of it.
// The capsule is easy — the target goes to identity. The preview is the catch: while driving by
// hand it runs on dead reckoning ("Żyro"), whose zero is wherever it happened to seed, plus drift.
// So a perfectly level capsule (tilt 0.0°, numbers 0/0/0) was still drawn 20° off, turned about the
// vertical and slightly skewed — exactly the "it comes back crooked" this is fixing.
// The preview's own reference is re-derived from the data by poseRecenter(), but only AFTER the
// capsule has actually arrived: recentre too early and it re-seeds from the tilt it is still in,
// leaving the same problem with a different angle. So: send it level, watch the incoming samples
// until they report level, then take the picture's zero from there.
function vpLevel(){
  vpClaim();
  VPUCK.q=[1,0,0,0]; VPUCK.spin=0; VPUCK._dirty=true; vpSend(true);
  if(VPUCK._levelT){clearInterval(VPUCK._levelT);VPUCK._levelT=null;}
  const t0=performance.now();
  VPUCK._levelT=setInterval(()=>{
    const done=(typeof POSE!=="undefined")&&POSE.tiltDeg<1&&Math.abs(POSE.twistDps||0)<3;
    const gone=!VPUCK.on||VPUCK.drag;                       // let go of it / grabbed again -> drop it
    if(!done&&!gone&&performance.now()-t0<1500)return;
    clearInterval(VPUCK._levelT); VPUCK._levelT=null;
    if(!gone&&typeof poseRecenter==="function")poseRecenter();   // the drawing's zero = level, facing front
  },60);
}

// ---------- the loop: held keys, flick spin, throttled posting ----------
function vpTick(ts){
  VPUCK._raf=VPUCK.on?requestAnimationFrame(vpTick):null;
  if(!VPUCK.on)return;
  const dt=VPUCK._tPrev?Math.min(0.1,(ts-VPUCK._tPrev)/1000):0;
  VPUCK._tPrev=ts;
  if(dt>0){
    const K=VPUCK.keys, fast=(K.has("Shift")?2.5:1)*(K.has("Alt")?0.25:1);   // Shift = far, Alt = fine
    let dp=0,dr=0,dw=0;
    if(K.has("ArrowUp"))dp+=VP_KEY_TILT*dt*fast;      // same sense as the mouse: away = far edge down
    if(K.has("ArrowDown"))dp-=VP_KEY_TILT*dt*fast;
    if(K.has("ArrowLeft"))dr-=VP_KEY_TILT*dt*fast;
    if(K.has("ArrowRight"))dr+=VP_KEY_TILT*dt*fast;
    if(K.has("q"))dw-=VP_KEY_TWIST*dt*fast*VP_TURN;   // Q turns left, E turns right — on screen
    if(K.has("e"))dw+=VP_KEY_TWIST*dt*fast*VP_TURN;
    if(dp||dr)vpTilt(dp,dr);
    if(dw)vpTwist(dw);
    if(Math.abs(VPUCK.spin)>1){                    // flick: keep spinning, wind down
      vpTwist(VPUCK.spin*dt);
      VPUCK.spin*=Math.exp(-dt/VP_SPIN_TAU);
    }else if(VPUCK.spin){VPUCK.spin=0;}
  }
  vpSend(false);
  vpReadout();
  vpModeNote();
  vpTipLine();   // focus can also leave the sphere without a blur we hear about (window switch)
}

// ---------- UI ----------
function vpUpdateUi(){
  if(!VPUCK.on){for(const s of VP_SPHERES)s._poseHot=null;
    if(typeof POSE!=="undefined"&&POSE.axisHot)POSE.axisHot=null;}
  const c=vpCanvas(), b=document.getElementById("poseManual"), bar=document.getElementById("pose3dManual"),
        card=document.getElementById("pose3dCard");
  // DWA POZIOMY, TAK JAK NA MINIATURZE (rf-34d). `vp-on` = ręka trzyma kapsel. `vp-ready` = jesteśmy
  // w symulacji, tryb ręczny jeszcze nie działa, ale kula JEST czynna — chwyt sam go włączy
  // (`vpEngage`). Miniatura miała oba od etapu 9b, duża karta tylko `vp-on`, więc nad nią kursor do
  // 2026-08-31 nie zapowiadał niczego, dopóki tryb nie był już włączony. Klasa steruje wyłącznie
  // kursorem (10-icons-controls.css) — pierścień azymutu zostaje przy `vp-on`.
  if(c){c.classList.toggle("vp-on",VPUCK.on);c.classList.toggle("vp-ready",vpSimMode());}
  if(bar)bar.hidden=!VPUCK.on;
  // The card class is what keeps the floating settings panel from opening over the sphere the
  // moment the pointer lands on it — i.e. exactly when the hand needs the sphere.
  if(card)card.classList.toggle("vp-manual",VPUCK.on);
  // Hand-driving is a sub-mode of the SIMULATION: with a real capsule on BLE there is nothing to
  // fake, so the button is not offered at all rather than offered and refused.
  if(b)b.hidden=!vpSimMode();
  if(b){
    b.classList.toggle("on",VPUCK.on);
    b.setAttribute("aria-pressed",VPUCK.on?"true":"false");
    const lbl=b.querySelector(".vp-lbl");
    if(lbl)lbl.textContent=VPUCK.on?"Wróć do animacji":"Steruj ręcznie";
    b.title=VPUCK.on?"Wyłącz sterowanie ręczne i wróć do animacji"
                    :"Chwyć kapsel myszą — testuj wyzwalacze bez sprzętu";
  }
  vpBtnUi();   // jedno miejsce na „czy przycisk kapsla jest wciśnięty" — także po wyjściu z trybu
  vpSrcPill();
  if(typeof vpFloat==="function")vpFloat(VPUCK.on);   // manual control lives in its own movable window
  // Bliźniaczy przycisk przy miniaturze podglądu w prawej kolumnie (rf-34c). Odświeżany STĄD, a nie
  // z własnej pętli klatek, bo to jest jedyne miejsce, które wie, że stan trybu ręcznego właśnie
  // się zmienił — dokładnie tak samo jak `vpFloat` wyżej i `whStageNote` niżej.
  if(typeof rfRcolMini!=="undefined"&&rfRcolMini.syncManual)try{rfRcolMini.syncManual();}catch(e){}
  if(VPUCK.on)vpWireNumEdit();
  vpTipLine();
  vpReadout();
  // Zakładka koła mówi co innego, kiedy kapslem rusza fala, a co innego, kiedy trzyma go ręka
  // (patrz _whStageOff w rf-46d). Tu jest jedyne miejsce, które wie, że to się właśnie zmieniło.
  if(typeof whStageNote==="function")whStageNote();
}
// The keyboard only reaches the capsule while the sphere has focus, and a widget that quietly
// ignores the arrow keys reads as broken. The line under the buttons therefore says which of the
// two it is right now, instead of listing shortcuts that may not be listening.
function vpTipLine(){
  const el=document.getElementById("pose3dManualTip"); if(!el||!VPUCK.on)return;
  const focused=(document.activeElement===vpCanvas());
  const txt=focused?"strzałki i Q/E — obracaj · spacja — przycisk · 0 — wypoziomuj · Esc — koniec"
                   :"chwyć kulę — pochyl · chwyć literę osi i przesuń w poprzek — obróć wokół niej · Ctrl — co 5°";
  if(el.textContent!==txt)el.textContent=txt;
  el.classList.toggle("is-keys",focused);
}
// WHICH PREVIEW CAN BE TRUSTED WHILE YOU STEER.
// The default "Filtr" view does not draw the capsule's orientation — it REBUILDS it: tilt measured
// from gravity, direction dead-reckoned from the gyro, because a 6-axis IMU cannot see turn about
// the vertical at all. That rebuild is not a rigid copy, so under the hand the axes visibly wander
// (measured: a drag lands ~20° off the axis you aimed at; "Akcel" cannot show turn at all).
// "Żyro" integrates the whole gyroscope, so it IS the capsule's orientation — the same drag lands
// 0.2° off. Manual control therefore borrows it while you drive, says so, and hands the old view
// back when you let go. This changes NOTHING about what is being tested: triggers, mouse, pad and
// MIDI all read the SERVER's pose filter, never this preview.
const VP_TRUE_MODES=["gyro","mahony"];
function vpModeNote(){
  const el=document.getElementById("pose3dManualNote"), tx=document.getElementById("pose3dManualNoteTxt");
  if(!el||typeof POSE==="undefined")return;
  let msg="";
  if(VPUCK.on&&!POSE.view2d){
    if(POSE.mode==="accel")msg="widok „Akcel” nie pokazuje obrotu";
    else if(POSE.mode==="filter")msg="widok „Filtr” odtwarza kierunek — osie mogą odjeżdżać";
    else if(POSE.mode==="gyro"&&VPUCK._modeSwapped)msg="podgląd „Żyro” — wiernie trzyma osie pod ręką";
  }
  const show=!!msg, btn=document.getElementById("poseVFilter");
  if(tx&&msg&&tx.textContent!==msg)tx.textContent=msg;
  if(btn)btn.hidden=(POSE.mode==="gyro");        // already true — nothing to switch to
  if(el.hidden!==!show)el.hidden=!show;
}
// Borrow a faithful preview for the duration of manual control — in memory only, so the user's
// saved choice is untouched and returns the moment they let go.
function vpModeSwap(on){
  if(typeof POSE==="undefined")return;
  if(on){
    if(VPUCK._modeSwapped||POSE.view2d||VP_TRUE_MODES.indexOf(POSE.mode)>=0)return;
    VPUCK._modeSwapped=POSE.mode; POSE.mode="gyro";
    // CIĄGŁOŚĆ OBRAZU PRZY PODMIANIE (2026-08-30, etap 10). Do tej pory szło tu
    // `POSE.qGyroSeeded=false`, czyli „przesiej od zera" — a przesiew liczy orientację WYŁĄCZNIE
    // z grawitacji (`quatFromTo(u,[0,0,1])`), więc wyrzucał obrót wokół pionu. Efekt: w chwili
    // przejęcia kapsla obraz skakał o cały nazbierany yaw. Przy starym przepływie („Steruj ręcznie"
    // → dopiero potem chwyt) było to niewidoczne, bo kapsel stał; odkąd chwyt sam włącza tryb,
    // skok wypadał W ŚRODKU GESTU. Zasiewamy więc tym, co JUŻ JEST NA EKRANIE — obraz się nie
    // rusza, a od następnej próbki prowadzi go żyroskop.
    if(Array.isArray(POSE.drawnQ)&&POSE.drawnQ.length===4){
      POSE.qGyro=POSE.drawnQ.slice(); POSE.qGyroSeeded=true;
    }else POSE.qGyroSeeded=false;
  }else{
    if(!VPUCK._modeSwapped)return;
    if(POSE.mode==="gyro")POSE.mode=VPUCK._modeSwapped;   // still ours to hand back
    VPUCK._modeSwapped=null;
  }
  const sel=document.getElementById("poseMode"); if(sel)sel.value=POSE.view2d?"2d":POSE.mode;
}
// WHERE THE MOVEMENT COMES FROM — one pill in the header, always on screen, four states. The
// widget looks identical whether a capsule on the desk, a canned waveform or a hand is moving it,
// and "which of those is happening right now" was left for the user to infer from a status line in
// another tab. Now it is spelled out next to the sphere, in the language of the thing that moves it.
function vpSrcPill(){
  const el=document.getElementById("poseSrcPill"); if(!el)return;
  const D=(typeof VB==="function")?VB():null, conn=D?D.conn:"";
  let kind="off", txt="brak sygnału", tip="Nic nie płynie — kapsel jest szukany albo uśpiony";
  if(VPUCK.on){kind="hand";txt="ruch: ręcznie";tip="Kapsel prowadzony myszą/klawiaturą — pakiety są prawdziwe";}
  else if(conn==="sim"){kind="anim";txt="ruch: animacja";tip="Symulacja porusza kapslem sama — kliknij „Steruj ręcznie”, żeby przejąć";}
  else if(conn==="connected"){kind="live";txt="ruch: kapsel";tip="Ruch z prawdziwego kapsla przez Bluetooth";}
  else if(conn==="parked"){kind="off";txt="kapsel śpi";tip="Kapsel śpi — oszczędza baterię";}
  if(el.dataset.kind!==kind)el.dataset.kind=kind;
  if(el.textContent!==txt)el.textContent=txt;
  // Write `title` and let the tooltip layer restyle it into data-rftip; dataset.tip keeps that
  // idempotent, because by then the attribute we just wrote is gone.
  if(el.dataset.tip!==tip){el.dataset.tip=tip;el.setAttribute("title",tip);}
}
// Target angles in numbers, next to the buttons: a threshold is set in degrees, so "tilt until it
// fires" is guesswork without them. Deliberately the TARGET, not the measured value — the readout
// under the sphere already reports what the filter made of it.
const VP_AX=[{id:"vpvPitch",k:"pitch",sym:"↕",lim:90},
             {id:"vpvRoll", k:"roll", sym:"↔",lim:180},
             {id:"vpvTwist",k:"twist",sym:"↻",lim:180}];
function vpReadout(){
  if(!VPUCK.on)return;
  const ang=_vqEuler(VPUCK.q);
  for(const a of VP_AX){
    const el=document.getElementById(a.id); if(!el||el.querySelector("input"))continue;   // being typed into
    // Symbols, not words: this line changes 60 times a second while dragging, and a text node the
    // i18n walker would have to re-translate that often is a waste — the title carries the wording.
    const txt=a.sym+" "+Math.round(ang[a.k])+"°";
    if(el.textContent!==txt)el.textContent=txt;
  }
}
// Each angle is also a FIELD: click it and type. Dragging is how you explore, typing is how you
// land on "exactly 30°" — which is the number a threshold is actually written in. Reuses the same
// click-to-type helper as the calibration sliders, attached lazily because that file loads later.
function vpWireNumEdit(){
  if(VPUCK._numWired||typeof attachNumEdit!=="function")return;
  VPUCK._numWired=true;
  for(const a of VP_AX){
    const el=document.getElementById(a.id); if(!el)continue;
    attachNumEdit(el,{min:-a.lim,max:a.lim,step:1,
      value:()=>Math.round(_vqEuler(VPUCK.q)[a.k]),
      format:v=>a.sym+" "+Math.round(v)+"°",
      // Typing rebuilds the orientation from all three numbers — one field at a time, the other
      // two read back exactly as they were.
      apply:v=>{const g=_vqEuler(VPUCK.q); g[a.k]=Math.max(-a.lim,Math.min(a.lim,v));
        VPUCK.q=_vqFromEuler(g.pitch,g.roll,g.twist);VPUCK.spin=0;VPUCK._dirty=true;vpSend(true);}});
  }
}
// ---------- przycisk kapsla ----------
// JEDNA DROGA, TA SAMA CO NA SPRZĘCIE. Poziom przycisku jedzie do serwera w tym samym pakiecie co
// orientacja (vpSend -> POST /virtual), a serwer wpisuje go w strumień 50 Hz dokładnie tak, jak
// robi to prawdziwy kapsel: bajt 1 na KAŻDEJ ramce plus pakiet 0x21 na zboczu. Żadnego bocznego
// kanału „to tylko symulacja" — dzięki temu koło wyboru, wyzwalacze przyciskowe i podgląd warunku
// nie mają jak odróżnić ręki od kapsla, a to jest cały sens tego trybu.
function vpSetBtn(down){
  down=!!down;
  if(!down)VPUCK.latch=false;   // każde puszczenie zdejmuje też blokadę „Trzymaj przycisk”
  if(VPUCK.btn!==down){
    if(down)vpClaim();
    VPUCK.btn=down; VPUCK._dirty=true; vpSend(true);
  }
  vpBtnUi();
}
// Widać, że jest wciśnięty. `aria-pressed` niesie to samo dla czytnika ekranu: „trzymany" to STAN
// przycisku, a nie chwilowe podświetlenie, i człowiek liczący sekundy przytrzymania musi mieć na
// ekranie potwierdzenie, że kapsel naprawdę trzyma.
function vpBtnUi(){
  const bb=document.getElementById("poseVBtn");
  if(bb){bb.classList.toggle("on",VPUCK.btn);bb.setAttribute("aria-pressed",VPUCK.btn?"true":"false");}
  const lb=document.getElementById("poseVLatch");
  if(lb){const on=!!(VPUCK.btn&&VPUCK.latch);lb.classList.toggle("on",on);lb.setAttribute("aria-pressed",on?"true":"false");}
}
// PRZEŁĄCZNIK „TRZYMAJ / PUŚĆ PRZYCISK” (2026-11-20). Przytrzymanie myszą wymaga trzymania ręki na
// „Przycisku kapsla”, więc nie da się w tym czasie pochylać kulą ani klikać w innym oknie (np. grze).
// Pierwsze kliknięcie wciska przycisk i go blokuje, drugie puszcza. Blokady nie zdejmuje ani
// puszczenie myszy gdzie indziej, ani utrata fokusu okna; zdejmuje ją każde zwykłe puszczenie
// (vpSetBtn(false): „Przycisk kapsla”, Spacja, „Kliknij”, koniec symulacji).
function vpLatchToggle(){
  if(!VPUCK.on)return;
  vpTapCancel();
  if(VPUCK.btn&&VPUCK.latch){vpSetBtn(false);return;}
  vpSetBtn(true); VPUCK.latch=true; vpBtnUi();
}
// Puszczenie, które nie wynika z decyzji człowieka (fokus uciekł, mysz puszczona poza przyciskiem):
// przy włączonej blokadzie nic nie robi.
function vpSoftRelease(){ if(!VPUCK.latch)vpSetBtn(false); }
// STUKNIĘCIE. Wciśnij i puść po VP_TAP_MS — tą samą drogą co przytrzymanie, więc silnik widzi
// zwykłe krótkie naciśnięcie, a nie zdarzenie „udawany klik". Jedno naraz: druga prośba w trakcie
// odliczania nic nie robi, bo dwa nakładające się stuknięcia dałyby jedno długie przytrzymanie.
function vpTap(){
  if(!VPUCK.on||VPUCK._tapT)return;
  vpSetBtn(true);
  VPUCK._tapT=setTimeout(function(){ VPUCK._tapT=null; vpSetBtn(false); },VP_TAP_MS);
}
function vpTapCancel(){ if(VPUCK._tapT){clearTimeout(VPUCK._tapT);VPUCK._tapT=null;} }

// JEDNO ŹRÓDŁO OBSŁUGI MYSZY, DWIE KULE (2026-08-30). Do tej pory cały nasłuch wisiał w IIFE
// domkniętym na jednym płótnie (`#pose3d`), więc miniatura w prawej kolumnie mogła być wyłącznie
// obrazkiem. Przy aktywnym sterowaniu ręcznym orientacja po prawej też ma pozwalać
// sterować. Blok został więc wyjęty do funkcji z płótnem
// w PARAMETRZE. Ani jednej linii przeliczeń nie skopiowano: obie kule wołają te same `vpClaim`,
// `vpTilt`, `vpTwist`, `vpRotAxis`, `vpSend` i `vpLevel`, z tymi samymi stałymi czułości — więc nie
// mają JAK się rozjechać, a tryb ręczny dalej ma jeden slot na serwerze i jeden stan w VPUCK.
// OBIE kule dostają dziś `{axis:true,keys:true}` — duża stąd (niżej), miniatura z rf-34d. Krótko
// (2026-08-30) miniatura szła z `{axis:false,keys:false}` „bo jest aria-hidden"; nie jest —
// ma `tabindex="0"` i własny `aria-label` obiecujący sterowanie ręczne, więc element stał
// w kolejce Tab i na każdy klawisz milczał. Fokusowalny element, który nic nie robi, to ślepy
// zaułek, i to on był tu błędem, a nie zbyt hojne nasłuchy. Zostaje jedna różnica, ta z powodem:
//   • UCHWYTY OSI biorą się z `POSE.axisHit`, które rf-14 publikuje przy rysowaniu DUŻEJ karty,
//     więc na miniaturze `vpAxisAt` po prostu nic nie trafia (liter osi tam nie ma) i chwyt
//     spada do zwykłego pochylania. Nie trzeba tego wyłączać — samo się nie odzywa.
// Idempotentna: drugie wywołanie na tym samym płótnie nie dokłada drugiego kompletu nasłuchów
// (miniatura wpina się leniwie, przy pierwszym `syncManual`, więc to nie jest teoria).
function vpWireSphere(c,o){
  if(!c||c._vpWired)return;
  c._vpWired=true;
  // Od tej chwili płótno MA własne podświetlenie uchwytu — także wtedy, gdy jeszcze nikt na nie
  // nie najechał. Bez tego `undefined` odesłałoby rysowanie do mirrora `POSE.axisHot`, czyli do
  // stanu ustawionego przez sąsiednią kulę, i litera zapalałaby się na obu naraz.
  c._poseHot=null;
  VP_SPHERES.push(c);
  o=o||{};
  const useAxis=o.axis!==false, useKeys=o.keys!==false;
  // ---- mouse: left = tilt, right / middle / Shift+left = twist ----
  c.addEventListener("pointerdown",e=>{
    if(!vpEngage())return;                          // chwyt sam włącza tryb ręczny (patrz `vpEngage`)
    if(e.button!==0&&e.button!==1&&e.button!==2)return;
    e.preventDefault();
    vpClaim();                                      // the hand that grabs it, drives it
    const twist=(e.button===2||e.button===1||e.shiftKey);
    const r=c.getBoundingClientRect(), ox=r.left+r.width/2, oy=r.top+r.height/2;
    const rad=Math.hypot(e.clientX-ox,e.clientY-oy);
    // CO PODŚWIETLONE, TO CHWYTANE (2026-08-30, etap 11). `vpAxisAt` szuka litery w promieniu
    // `max(15, scale*0.19)`, czyli na kafelku prawej kolumny 15 px. Chybienie o dwa piksele nie
    // dawało ŻADNEGO sygnału: `hit` wychodził `null`, a gest po cichu stawał się SWOBODNYM
    // POCHYLANIEM — obrotem wokół osi ekranu, więc kula kręciła się też po innych
    // osiach. Skoro litera pod kursorem jest PODŚWIETLONA (`_poseHot`
    // ustawia to samo `vpAxisAt` przy najeżdżaniu), to obietnica z ekranu jest wiążąca i bierzemy ją.
    let hit=(twist||!useAxis)?null:vpAxisAt(e.clientX,e.clientY,c);
    if(!hit&&!twist&&useAxis&&c._poseHot)
      hit=(c._poseHits||[]).find(h=>h.k===c._poseHot)||null;
    VPUCK.spin=0;                                   // grabbing stops a spinning puck, like a hand would
    if(hit){
      vpHot(c,hit.k);
      // GEST: PRZESUŃ W POPRZEK OSI (2026-08-30, etap 11).
      //
      // CO BYŁO. Liczony był kąt ZAMIATANY WOKÓŁ LITERY. Fizycznie to poprawne — litera jest
      // BIEGUNEM obrotu, więc sama się nie rusza i „pchnięcie bieguna" nie ma prawa nim zakręcić;
      // żeby obrócić kulę wokół osi, trzeba zatoczyć wokół niej koło. Tyle że nikt tak nie robi.
      // Zmierzone prawdziwą myszą (nie sztucznymi zdarzeniami): przeciągnięcie w LINII PROSTEJ
      // o 50 px dawało obrót DOKŁADNIE ZERO na WSZYSTKICH SZEŚCIU uchwytach, z przodu i z tyłu kuli.
      // Kąt biegunowy wokół litery nie zmienia się, gdy oddalamy się od niej po promieniu — a to
      // jest właśnie ruch, który wykonuje ręka. Uchwyt podświetlał się i łapał, po czym nie robił nic.
      //
      // CO JEST. Liczy się składowa ruchu PROSTOPADŁA do osi narysowanej na ekranie: „przesuń
      // w poprzek osi, a kapsel obróci się wokół niej". To konwencja STEROWANIA, nie symulacja
      // fizyki — taka sama, jaką mają uchwyty obrotu w programach 3D. Dobrana tak, żeby
      // POWIERZCHNIA KULI SZŁA ZA RĘKĄ: pchasz w dół, przód kuli jedzie w dół.
      // Skutek uboczny wart odnotowania: oba końce tej samej osi („X" i „−X") reagują TAK SAMO,
      // bo przy chwycie za drugi koniec odwraca się i prostopadła, i sama oś. Wcześniej reagowały
      // przeciwnie. „Powierzchnia idzie za ręką" jest przewidywalniejsze niż „zależy, który koniec".
      //
      // OŚ PATRZĄCA W STRONĘ OKA nie ma prostopadłej (litera leży blisko środka), więc tam zostaje
      // kąt zamiatany — ale wokół ŚRODKA KULI, nie wokół litery. Prosty ruch przechodzący obok
      // środka też go zamiata, więc i ten wariant odpowiada na zwykłe przeciągnięcie.
      const R=Math.min(r.width,r.height)*0.40;             // ten sam promień, z którego rysuje rf-14
      const sx=hit.x-r.width/2, sy=hit.y-r.height/2;        // kierunek osi NA EKRANIE
      const sl=Math.hypot(sx,sy);
      const wEkranie=sl/((R*1.17)||1);                      // 0 = oś patrzy na nas, 1 = leży w ekranie
      VPUCK.drag={kind:"axis",id:e.pointerId,x:e.clientX,y:e.clientY,v:0,tPrev:e.timeStamp,
        axis:hit.v, k:hit.k,
        push:wEkranie>=0.25, R:Math.max(24,R),
        nx:sl?-sy/sl:0, ny:sl?sx/sl:0,                       // prostopadła do osi (ekran, y w dół)
        sense:(POSE.mirror?-1:1),                            // lustro z panelu ⚙ odwraca stronę ekranu
        cx0:r.left+r.width/2, cy0:r.top+r.height/2,
        ang:null};
      try{c.setPointerCapture(e.pointerId);}catch(_){}
      c.classList.add("vp-grab"); if(useKeys)c.focus({preventScroll:true});
      return;
    }
    VPUCK.drag={kind:twist?"twist":"tilt",id:e.pointerId,x:e.clientX,y:e.clientY,v:0,tPrev:e.timeStamp,
      ox,oy,ang:Math.atan2(e.clientY-oy,e.clientX-ox),
      // TWIST FOLLOWS THE GRIP, like a knob: what turns the capsule is the movement AROUND the
      // centre, so grabbing near the top or bottom means sideways, grabbing at either side means
      // up and down — the hand does not have to remember an axis, it just pushes the rim along.
      // Too close to the middle there is no rim to push (a pixel would be a huge angle), so that
      // one spot keeps the plain sideways mapping.
      knob:rad>Math.min(r.width,r.height)*0.12};
    try{c.setPointerCapture(e.pointerId);}catch(_){}
    c.classList.add("vp-grab");
    if(useKeys)c.focus({preventScroll:true});
  });
  c.addEventListener("pointermove",e=>{
    const d=VPUCK.drag;
    if(!d){                                          // not dragging: light up the handle under the cursor
      // Podświetlamy uchwyt także przy wyłączonym trybie — bo chwyt go teraz włączy. Ale tylko
      // w symulacji: przy prawdziwym kapslu litera zapalona na sucho obiecywałaby ster, którego nie ma.
      if(!useAxis||(!VPUCK.on&&!vpSimMode()))return;
      const h=vpAxisAt(e.clientX,e.clientY,c), k=h?h.k:null;
      if(c._poseHot!==k){vpHot(c,k);c.classList.toggle("vp-axis",!!k);}
      return;
    }
    if(d.id!==e.pointerId)return;
    const dx=e.clientX-d.x, dy=e.clientY-d.y;
    d.x=e.clientX; d.y=e.clientY;
    // Alt = a quarter of the travel per pixel, for the last couple of degrees before a threshold.
    const fine=e.altKey?0.25:1;
    if(d.kind==="axis"){
      let deg;
      if(d.push){
        // Łuk po powierzchni kuli: tyle stopni, ile ręka przejechała w poprzek, podzielone przez
        // promień. Dzięki temu ten sam ruch daje ten sam obrót niezależnie od tego, czy kula ma
        // 66 px (kafel), czy 120 px (duża karta) — większa kula obraca się wolniej, jak w realu.
        deg=((dx*d.nx+dy*d.ny)/d.R)*(180/Math.PI)*fine*d.sense;
      }else{
        const ux=e.clientX-d.cx0, uy=e.clientY-d.cy0;
        if(Math.hypot(ux,uy)<12)return;               // za blisko środka — nie ma kąta do odczytania
        const a=Math.atan2(uy,ux);
        if(d.ang==null){d.ang=a;return;}              // pierwszy ruch tylko ustawia punkt odniesienia
        let da=a-d.ang; if(da>Math.PI)da-=2*Math.PI; else if(da<-Math.PI)da+=2*Math.PI;
        d.ang=a;
        deg=-da*180/Math.PI*fine*d.sense;             // minus: ekran ma oś Y w dół
      }
      if(e.ctrlKey){const q=15;d._rem=(d._rem||0)+deg;const st=Math.trunc(d._rem/q)*q;d._rem-=st;deg=st;}
      vpRotAxis(d.axis,deg);
      const dt=e.timeStamp-d.tPrev;
      if(dt>=4){d.tPrev=e.timeStamp; d.v=d.v*0.7+(deg/dt*1000)*0.3;}
    }else if(d.kind==="twist"){
      let deg;
      if(d.knob){
        const a=Math.atan2(e.clientY-d.oy,e.clientX-d.ox);
        let da=a-d.ang; if(da>Math.PI)da-=2*Math.PI; else if(da<-Math.PI)da+=2*Math.PI;
        d.ang=a;
        deg=da*180/Math.PI*fine*VP_TURN;
      }else{
        deg=dx*VP_TWIST_PER_PX*fine*VP_TURN;
      }
      // Ctrl steps in whole 15°. Quantising the INCREMENT rather than the resulting angle keeps
      // it working at any orientation — there is no single "the" angle to round once the capsule
      // is off-level, and rounding a decomposition would quietly rotate the other two axes.
      if(e.ctrlKey){const q=15;d._rem=(d._rem||0)+deg;const st=Math.trunc(d._rem/q)*q;d._rem-=st;deg=st;}
      vpTwist(deg);
      const dt=e.timeStamp-d.tPrev;
      // Only real motion feeds the flick. Events that arrive in the same millisecond are the
      // browser delivering a coalesced burst, and dividing by that would read as a violent spin.
      if(dt>=4){d.tPrev=e.timeStamp; d.v=d.v*0.7+(deg/dt*1000)*0.3;}
    }else{
      // Y inverted: pushing the mouse AWAY tips the far edge down, the way a hand on a real
      // capsule would — dragging towards yourself lifts it.
      let dp=-dy*VP_TILT_PER_PX*fine, dr=dx*VP_TILT_PER_PX*fine;
      if(e.ctrlKey){                                   // Ctrl = whole 5° steps (see the twist note)
        d._remP=(d._remP||0)+dp; const sp=Math.trunc(d._remP/5)*5; d._remP-=sp; dp=sp;
        d._remR=(d._remR||0)+dr; const sr=Math.trunc(d._remR/5)*5; d._remR-=sr; dr=sr;
      }
      vpTilt(dp,dr);
    }
    vpSend(false);
  });
  const endDrag=e=>{
    const d=VPUCK.drag; if(!d||(e&&e.pointerId!=null&&d.id!==e.pointerId))return;
    if(d.kind==="axis"){
      // No spin-on afterwards. Grabbing a named axis is AIMING — you let go where you meant to be,
      // and a capsule that carries on turning by itself reads as the control having a mind of its
      // own. The free knob (right button) keeps its flick, which is where a flick makes sense.
      VPUCK.spin=0;
    }
    else if(d.kind==="twist"&&Math.abs(d.v)>90){VPUCK.spin=Math.max(-1400,Math.min(1400,d.v));}   // flick
    VPUCK.drag=null;
    vpHot(c,null);
    c.classList.remove("vp-grab","vp-axis");
    try{if(e&&e.pointerId!=null)c.releasePointerCapture(e.pointerId);}catch(_){}
    vpSend(true);
  };
  c.addEventListener("pointerup",endDrag);
  c.addEventListener("pointercancel",endDrag);
  c.addEventListener("pointerleave",()=>{if(useAxis&&!VPUCK.drag&&c._poseHot){vpHot(c,null);c.classList.remove("vp-axis");}});
  c.addEventListener("contextmenu",e=>{if(VPUCK.on||VPUCK.drag||vpSimMode())e.preventDefault();});   // right button is a control here
  // KÓŁKO NIE PRZEJMUJE STERU — RUSZA KAPSLEM DOPIERO, GDY TRYB RĘCZNY JUŻ TRWA.
  // Przy nieaktywnym sterowaniu ręcznym scroll na orientacji 3D po prawej nie włącza trybu
  // ręcznego: użytkownicy scrollują tamten pasek, bo nie widzą całego. I to jest cała różnica między kółkiem a resztą gestów tej kuli: chwyt,
  // dwuklik i klawisz to czynności WYMIERZONE w widżet, a kółko nad nim bywa po prostu przewijaniem
  // strony, które akurat przechodzi tędy. Przy `vpEngage()` taki przejazd włączał tryb ręczny,
  // zabierał kapsel animacji i przy okazji zjadał przewinięcie (`preventDefault` leciał zaraz
  // potem) — czyli robił dwie niechciane rzeczy naraz w prawej kolumnie, którą przewija się
  // najczęściej. Kółko zostaje pełnoprawnym sterowaniem, tylko dla kogoś, kto już trzyma kapsel.
  c.addEventListener("wheel",e=>{
    if(!VPUCK.on)return;                            // ⚠️ BEZ `preventDefault` — strona ma się przewinąć
    e.preventDefault();
    vpClaim();
    vpTwist((e.deltaY>0?1:-1)*(e.shiftKey?18:6)*VP_TURN);
    vpSend(false);
  },{passive:false});
  c.addEventListener("dblclick",e=>{if(vpEngage(vpLevel))e.preventDefault();});

  // ---- keyboard (only while the widget has focus — no global shortcuts to collide with) ----
  // Podpinane do KAŻDEGO płótna, które przyjmuje fokus — a przyjmują oba (patrz nagłówek funkcji).
  // `keys:false` zostaje jako furtka dla ewentualnej kuli czysto dekoracyjnej: taka musi wtedy
  // stracić `tabindex` i dostać `aria-hidden`, bo inaczej wraca ślepy zaułek w kolejce Tab.
  if(!useKeys)return;
  c.addEventListener("keydown",e=>{
    if(!VPUCK.on){
      // PIERWSZY KLAWISZ PRZEJMUJE STER, DRUGI JUŻ NIM RUSZA. Uogólnienie dotychczasowego
      // „Enter/spacja włącza": skoro chwyt myszą włącza tryb, to samo musi robić klawiatura,
      // inaczej ta sama kula odpowiadałaby ręce, a milczała na strzałki.
      if(e.key==="Escape"||e.key==="Tab")return;
      if(vpEngage())e.preventDefault();
      return;
    }
    const k=e.key;
    if(k==="Escape"){e.preventDefault();vpStop();return;}
    vpClaim();
    if(k==="0"){e.preventDefault();vpLevel();return;}
    if(k===" "){e.preventDefault();vpSetBtn(true);return;}
    if(k==="Shift"||k==="Alt"){VPUCK.keys.add(k);return;}
    if(k==="ArrowUp"||k==="ArrowDown"||k==="ArrowLeft"||k==="ArrowRight"){e.preventDefault();VPUCK.keys.add(k);return;}
    const lk=k.toLowerCase();
    if(lk==="q"||lk==="e"){e.preventDefault();VPUCK.keys.add(lk);}
  });
  c.addEventListener("keyup",e=>{
    const k=e.key;
    if(k===" "){vpSetBtn(false);return;}
    if(k==="Shift"||k==="Alt"){VPUCK.keys.delete(k);return;}
    VPUCK.keys.delete(k); VPUCK.keys.delete(k.toLowerCase());
  });
  c.addEventListener("blur",()=>{VPUCK.keys.clear();vpSoftRelease();vpTipLine();});
  c.addEventListener("focus",vpTipLine);
}

// ---------- wiring ----------
(function(){
  const c=vpCanvas(); if(!c)return;
  const btn=document.getElementById("poseManual");
  if(btn)btn.addEventListener("click",e=>{e.stopPropagation();vpToggle();});

  const lv=document.getElementById("poseVLevel");
  if(lv)lv.addEventListener("click",e=>{e.stopPropagation();vpLevel();});
  const ex=document.getElementById("poseVExit");
  if(ex)ex.addEventListener("click",e=>{e.stopPropagation();vpStop();});
  // float the card out into a draggable window / pin it back (rf-14c) — the choice is remembered
  const wn=document.getElementById("poseVWin");
  if(wn)wn.addEventListener("click",e=>{e.stopPropagation();
    if(typeof vpWinDock==="function")vpWinDock(!!VPWIN.el);});
  const mf=document.getElementById("poseVFilter");
  if(mf)mf.addEventListener("click",e=>{
    e.stopPropagation();
    if(typeof POSE==="undefined")return;
    if(!VPUCK._modeSwapped)VPUCK._modeSwapped=POSE.mode;   // remember to hand the view back on exit
    POSE.view2d=false; POSE.mode="gyro"; POSE.qGyroSeeded=false;
    const sel=document.getElementById("poseMode"); if(sel)sel.value="gyro";
    vpModeNote();
  });

  // press-and-hold "capsule button" — the same 0x21 packet a real press sends.
  // PRZECHWYCENIE WSKAŹNIKA, a nie pointerleave. Przycisk ma być wciśnięty tak długo, jak długo
  // trzymana jest mysz, a nie tak długo, jak kursor stoi dokładnie na nim: przy poprzedniej wersji
  // wystarczyło drgnąć ręką o trzy piksele, żeby kapsel „puścił" w połowie gestu — a to jest gest
  // trwający pół sekundy, więc koło wyboru zamykało się samo w trakcie celowania.
  const bb=document.getElementById("poseVBtn");
  if(bb){
    let held=false;   // mysz wciśnięta NA tym przycisku; inne puszczenia myszy nie puszczają blokady „Trzymaj”
    bb.addEventListener("pointerdown",e=>{
      e.preventDefault();e.stopPropagation();
      try{bb.setPointerCapture(e.pointerId);}catch(_){}
      held=true; VPUCK.latch=false;
      vpSetBtn(true);
    });
    const up=e=>{
      if(!held)return; held=false;
      try{if(e&&e.pointerId!=null)bb.releasePointerCapture(e.pointerId);}catch(_){}
      vpSetBtn(false);
    };
    bb.addEventListener("pointerup",up);
    bb.addEventListener("pointercancel",up);
    // Siatka bezpieczeństwa: mysz puszczona poza oknem nie przyśle nam pointerup na przycisku, a
    // kapsel z wiecznie wciśniętym przyciskiem trzymałby koło otwarte i blokował następny gest.
    window.addEventListener("pointerup",up);
    window.addEventListener("blur",()=>{if(VPUCK.btn)vpSoftRelease();});
  }
  const lb=document.getElementById("poseVLatch");
  if(lb)lb.addEventListener("click",e=>{e.stopPropagation();vpLatchToggle();});
  // …i stuknięcie dla trybów, które wybierają kliknięciem (koło: „kliknij", „pochyl i kliknij",
  // „krokowy"). Zwykły klik myszą, bo długość naciśnięcia odmierza vpTap, nie ręka.
  const tb=document.getElementById("poseVTap");
  if(tb)tb.addEventListener("click",e=>{
    e.stopPropagation();
    vpTap();
    // 80 ms podświetlenia nie da się zauważyć, więc potwierdzenie jest dłuższe niż samo stuknięcie.
    tb.classList.remove("tapped"); void tb.offsetWidth; tb.classList.add("tapped");
  });

  vpWireSphere(c,{axis:true,keys:true});

  // "Recenter" levels the VIRTUAL puck too — otherwise it would only zero the preview filter
  // and the widget would snap straight back to wherever the hand left the capsule.
  const rb=document.getElementById("poseRecenter");
  if(rb)rb.addEventListener("click",()=>{if(VPUCK.on)vpLevel();});

  // Leaving the page hands the slot back at once; the server's watchdog is only the backstop.
  window.addEventListener("pagehide",()=>{
    if(!VPUCK.on)return;
    try{fetch("/virtual",{method:"POST",headers:{"Content-Type":"application/json"},
                          body:JSON.stringify({on:false}),keepalive:true});}catch(_){}
  });
  VPUCK.dev=(typeof state!=="undefined"&&(state.viewDev||state.activeDeviceId))||"d0";
  vpUpdateUi();
})();
