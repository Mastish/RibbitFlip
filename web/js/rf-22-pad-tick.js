"use strict";
// ===== XY pad per-frame logic and drawing =====
// Turns each capsule's pose (and the pointer) into a pad position, decides through the gate
// whether the pad may sound, drives PadAudio, and paints the pad canvas. padTick() runs from
// the pad rAF loop and, while the tab is hidden, straight off incoming SSE samples.

// --- note math (JS mirror of the backend scale_note_list)
function padNotes(inst){
  inst=inst||XPAD.pads[0]||{base:48,oct:2};
  const sc=(inst&&inst.scale)||(state.midi&&state.midi.scale)||"chromatic";   // per-pad scale (falls back to the MIDI/OSC group scale)
  const pcs=PAD_PCS[sc]||PAD_PCS.chromatic,root=(((inst&&inst.scaleRoot!=null)?inst.scaleRoot:(state.midi&&state.midi.scaleRoot))|0)%12;
  const allowed=new Set(pcs.map(p=>(root+p)%12));
  const lo=inst.base,hi=Math.min(127,inst.base+12*inst.oct);
  const lst=[];for(let n=lo;n<=hi;n++)if(allowed.has(((n%12)+12)%12))lst.push(n);
  return lst.length?lst:[lo];
}
function padFreq(n){return 440*Math.pow(2,(n-69)/12);}
// SUPERPŁYNNE (glideMode "free"): no scale, no notes — the pad's width IS the pitch, read straight
// off the same span the note list covers. `padFreq` takes fractional notes as they are, so the whole
// chain below (glide, retrigger, sequencer) keeps working on a number that simply is not an integer.
function padRange(inst){const lo=inst.base|0;return {lo,hi:Math.min(127,lo+12*(inst.oct|0))};}
function padIsFree(inst){return !!inst&&inst.glideMode==="free";}

// --- pose -> pad 2D position (signed deg -> 0..1; tilt 0..range; twist ±(range*12)°/s)
// pose + raw-channel → this pad's 2D position (0..1). axX/axY may be a filter metric
// (roll/pitch/tilt/twist) OR a raw controller channel ch0..ch5 (read from the device sample).
// map ONE axis (filter metric or raw channel ch0..5) → 0..1 using `range` as sensitivity
function padAxisVal(range,ax,pose,raw){
  if(ax&&ax.slice&&ax.slice(0,2)==="ch"){   // raw channel: LSB → 0..1 (bigger range → less twitchy)
    const idx=+ax.slice(2);const key=["ax","ay","az","gx","gy","gz"][idx];
    let v=raw?raw[key]:null;if(v==null||!isFinite(v))return .5;
    const span=Math.max(300,range*360);   // ±(range·360) LSB maps to the full pad
    return Math.max(0,Math.min(1,.5+v/(2*span)));
  }
  let v=pose?pose[ax]:null;if(v==null||!isFinite(v))return .5;
  if(ax==="tilt")return Math.max(0,Math.min(1,v/Math.min(90,range)));   // tilt tops out at 90° — a wider gyro range must not shrink it
  if(ax==="twist")return Math.max(0,Math.min(1,.5+v/(range*12)));       // wider range (up to 180) → maps faster spins (±range·12 °/s)
  return Math.max(0,Math.min(1,.5+(v/range)*.5));
}
// map a pose (+raw) through a mapping {axX,axY,range} → {x,y}. Used per-capsule on play pads AND fx pads.
// Per-axis musical response curve applied to the 0..1 fraction. Bipolar axes (roll/pitch/twist/chN,
// centered on 0.5) curve on the deflection from center; tilt (0..1 from zero) curves directly.
// k: lin=1 (identity, t), exp=2 (precise near center, t²), log=0.5 (sensitive near center, √t).
// The exponents are MIDI's exp2/log2 to the digit (rf-16 MI_CURVES), because the options now carry
// MIDI's names and its formulas in their tooltips — they were 1.8 and 0.55, close enough to look
// right and far enough to make „(kwadrat)" and „(pierwiastek)" untrue. The feel change is under a
// percent of travel at mid-deflection; the name now matches what the engine actually computes.
function padCurveK(cur){return cur==="exp"?2:cur==="log"?0.5:1;}
function padCurveApply(v,cur,ax){
  const k=padCurveK(cur);
  if(k===1)return v;
  if(ax==="tilt")return Math.max(0,Math.min(1,Math.pow(Math.max(0,v),k)));   // unipolar
  let d=(v-0.5)*2;                                                            // -1..1 deflection from center
  d=Math.sign(d)*Math.pow(Math.abs(d),k);
  return Math.max(0,Math.min(1,0.5+d/2));
}
function padPoseXY(map,pose,raw){
  let vx=padCurveApply(padAxisVal(map.range,map.axX,pose,raw),map.curX,map.axX);
  let vy=padCurveApply(padAxisVal(map.range,map.axY,pose,raw),map.curY,map.axY);
  if(map.invX)vx=1-vx;                 // per-capsule X invert
  // The pad's y is MATH-side (0 = bottom), because the canvas draws it as (1-y)*H. This flip is what
  // makes the two conventions meet: padAxisVal hands back "bigger angle = bigger number", and after
  // it a positive pitch ends up LOW on the pad — which is the same direction a positive pitch sends
  // the cursor, the stick and the d-pad (server-side: "sy>0 = down (screen)"). Removing it looks
  // right in this function and is wrong on screen: it double-flips against the draw call.
  vy=1-vy;
  if(map.invY)vy=1-vy;                 // per-capsule Y invert XORs the screen inversion
  return {x:vx,y:vy};
}
function padAnyFresh(inst){inst=inst||XPAD.pads[0];if(!inst)return false;const now=performance.now();
  for(const id in inst.devCur)if(now-inst.devCur[id].at<900)return true;
  return false;}
// gate context = the pad's freshest assigned+ON capsule's motion (tilt °, twist °/s, smoothed motion energy 0..100)
function _padGateCtx(inst,nowP){
  let best=null,bestAt=-1,bestId=null;
  for(const id in inst.devCur){const dc=inst.devCur[id],cfg=inst.dev[id];
    if(cfg&&cfg.on===false)continue;if(dc.muted)continue;if(nowP-dc.at>=900)continue;
    if(dc.at>bestAt){bestAt=dc.at;best=dc;bestId=id;}}
  const hasDevice=!!best;let tilt=0,twist=0,pitch=0,roll=0,raw=null,shaped=null,sp=null;
  if(best){
    const pose=(bestId===state.activeDeviceId&&state.pose)?state.pose:(state.devices[bestId]&&state.devices[bestId].poseLive);
    if(pose){tilt=Math.max(0,+pose.tilt||0);twist=+pose.twist||0;pitch=+pose.pitch||0;roll=+pose.roll||0;}
    raw=(bestId===state.activeDeviceId)?state.last:null;   // raw CH0-5 + buttons only for the active slot
    // A channel used as a GATE SOURCE reads the same tuned value the server hands to triggers and
    // MIDI; motion energy below stays on the raw numbers, because that is a physical quantity and
    // not a source anybody dialled a dead zone into.
    shaped=(bestId===state.activeDeviceId)?(state.lastSh||null):null;
    sp =(bestId===state.activeDeviceId)?state.statusPkt:null;
    let target=inst._gEnergy||0;
    if(raw){const e=Math.hypot(+raw.gx||0,+raw.gy||0,+raw.gz||0);target=Math.min(100,e/30);}
    inst._gEnergy=(inst._gEnergy||0)+(target-(inst._gEnergy||0))*(raw?0.35:0.12);
  }else inst._gEnergy=(inst._gEnergy||0)*0.85;   // no fresh device → motion energy decays
  return {tilt,twist,pitch,roll,motion:inst._gEnergy||0,hasDevice,raw,shaped,sp};
}
// raw value of ONE gate source from the pad's capsule context (null = source unavailable this frame)
function _gateSourceVal(src,ctx){
  const k=src.kind;
  if(k==="mapping"){const rt=state.rt&&state.rt[src.ref];return rt?(rt.active?1:0):0;}
  if(k==="axis"){const src0=ctx.shaped||ctx.raw;if(!src0)return null;let v=src0[RE_NAME[src.channel|0]];if(v==null)return null;return src.abs?Math.abs(v):v;}
  if(k==="button"){const sp=ctx.sp;if(!sp||!sp.bytes)return null;
    if(src.any!==false)return [1,2,3,4].some(i=>sp.bytes[i])?1:0;   // any 0x21 activity
    return ((sp.bytes[src.byte]||0)>>src.bit)&1;}
  let v;                                    // filter metric
  switch(src.metric){case "twist":v=ctx.twist;break;case "pitch":v=ctx.pitch;break;
    case "roll":v=ctx.roll;break;case "motion":v=ctx.motion;break;default:v=ctx.tilt;}
  if(v==null)return null;return src.abs?Math.abs(v):v;
}
// is ONE condition met NOW? (mirrors trigger condMet; no fresh capsule → satisfied so touch still plays)
function _gateCondMet(cond,ctx){
  const s=cond.source||{};
  if(s.kind==="mapping"){const rt=state.rt&&state.rt[s.ref];const m0=!!(rt&&rt.active);return cond.neg?!m0:m0;}   // mapping = a mapping/trigger is ACTIVE now (global, capsule-independent)
  if(!ctx.hasDevice)return true;                       // touch-only → never block on sensors
  const v=_gateSourceVal(s,ctx);
  if(s.kind==="button"){const m0=(v===1);return cond.neg?!m0:m0;}   // null → not pressed
  if(v==null)return true;                              // background capsule has no raw axis → don't block
  let m;const thr=+cond.threshold||0,c=cond.cmp;
  if(c==="in"||c==="out"){const hi=(cond.thresholdHi!=null?+cond.thresholdHi:thr),a=Math.min(thr,hi),b=Math.max(thr,hi);
    m=(c==="in")?(v>=a&&v<=b):(v<a||v>b);}
  else m=(c==="<")?v<thr:(c==="<=")?v<=thr:(c===">=")?v>=thr:v>thr;
  return cond.neg?!m:m;
}
// combine conditions left→right by AND/OR (mirror of trigger evalDraftOver); empty list = open
function _gateCondsOpen(conds,ctx){
  if(!conds||!conds.length)return true;
  let acc=false;
  for(let i=0;i<conds.length;i++){const v=_gateCondMet(conds[i],ctx);acc=(i===0)?v:(conds[i].op==="or"?(acc||v):(acc&&v));}
  return acc;
}
// is the pad's gate OPEN this frame? = manual conditions AND (optional rhythm mask)
function padGateOpen(inst,ctx,now){
  const g=inst.gate;if(!g)return true;
  if(!_gateCondsOpen(g.conds,ctx))return false;
  const rh=g.rhythm;
  // THE RHYTHM HAS NO CLOCK OF ITS OWN (owner, 2026-10-01: "share the time and tempo with the programmed
  // pads, so it sounds even every time"). It used to count 16ths from the browser's zero with a tempo
  // per pad, so it never landed on the sequencer's steps and two chopped pads only met by luck. Now
  // the step is the ONE transport's counter (rf-25b): the section's tempo, its swing, its bar.
  if(rh&&rh.on){const def=PAD_RHYTHM_BY_ID[rh.type];
    if(def&&def.pat){const t=typeof rfBeatTick==="function"?rfBeatTick():0;
      if(def.pat[t%def.pat.length]!==1)return false;}}
  return true;
}
// The transport calls this on EVERY step, in the same breath as the sequencer's notes: a chopped pad
// opens and closes on the step itself instead of on the next drawn frame (up to ~17 ms late, and late
// by a different amount every time, which is what made the chop sound uneven). It replays the
// targets the last frame found (finger, capsules); the frame loop keeps them fresh.
function padRhythmStep(now){
  for(const inst of (XPAD.pads||[])){const g=inst.gate;
    if(!g||!g.rhythm||!g.rhythm.on||!inst._tgts)continue;
    const open=padGateOpen(inst,_padGateCtx(inst,now),now);
    if(open===inst._gateOpen)continue;
    inst._gateOpen=open;_padSound(inst,open?inst._tgts:[]);}
}

function padRipple(inst,x01,y01,color){
  if(_prefersReducedMotion())return;   // no decorative ripples under reduced motion
  inst.ripples.push({x:x01,y:y01,t:performance.now(),color:color||"#36c5f0"});
  if(inst.ripples.length>24)inst.ripples.shift();}


// --- audio tick (runs every frame, also when the pad is hidden — sound must not depend on the tab)
// drag 0..100 → per-frame lerp factor: 0 = snap instantly, 100 = very laggy/heavy glide toward the target
function dragFactor(d){const x=Math.max(0,Math.min(1,(d==null?30:d)/100));return .03+(1-x)*(1-x)*.97;}
// Frame-rate-INDEPENDENT glide. dragFactor() is tuned for 60 fps (16.67 ms); rescale the lerp
// factor by the real frame time so the feel is identical at 60 fps and consistent at other rates.
let _padFrameLast=0,_fxFrameLast=0;
function _padFrameDt(nowP){let dt=_padFrameLast?nowP-_padFrameLast:16.67;_padFrameLast=nowP;if(!(dt>0&&dt<200))dt=16.67;return dt;}
function _fxFrameDt(nowP){let dt=_fxFrameLast?nowP-_fxFrameLast:16.67;_fxFrameLast=nowP;if(!(dt>0&&dt<200))dt=16.67;return dt;}
function dragFactorDt(d,dtF){const base=dragFactor(d);if(base>=1)return 1;return 1-Math.pow(1-base,dtF/16.67);}
function padTick(){
  if(!XPAD.enabled){
    for(const p of XPAD.pads){
      if(Object.keys(p.act).length){PadAudio.gateOffPad(p);p.act={};}
      p._ptrS=null;p._mom=null;   // pads globally off → drop any coasting glide too
    }
    return;
  }
  const nowP=performance.now();
  const dtF=_padFrameDt(nowP);           // frame time for dt-based glide (shared across pads this frame)
  for(const p of XPAD.pads)padTickOne(p,nowP,dtF);
}
// velocity-from-motion (per-pad opt-in `velMotion`): a NEW note's loudness scales with the gesture's
// energy. Touch/pointer → smoothed cursor speed (pad-fraction/s, the _ptrV / momentum EMA); capsule →
// |twist| (°/s). Gentle entry → quiet note (PAD_VEL_MIN), energetic gesture → full level (1.0).
const PAD_VEL_MIN=0.35;          // quietest new note when velocity-from-motion is ON
const PAD_VEL_TOUCH_FULL=3.2;    // pointer speed (pad-fraction/s) reaching full level
const PAD_VEL_TWIST_FULL=360.0;  // capsule |twist| (°/s) reaching full level
function padGestureEnergy(inst,tg){   // → 0..1
  let e=0;
  if(tg&&tg.id==="ptr"){
    let sp=0;
    if(inst._ptrV)sp=Math.hypot(inst._ptrV.vx||0,inst._ptrV.vy||0);       // active/just-released drag
    else if(inst._mom)sp=Math.hypot(inst._mom.vx||0,inst._mom.vy||0);     // coasting (momentum) glide
    e=sp/PAD_VEL_TOUCH_FULL;
  }else{
    e=Math.abs((tg&&tg.twist)||0)/PAD_VEL_TWIST_FULL;                      // capsule rotational energy
  }
  return e<0?0:e>1?1:e;
}
function padVelScale(inst,tg){   // 1.0 when OFF (bit-identical old behaviour), else PAD_VEL_MIN..1.0
  if(!inst||!inst.velMotion)return 1;
  return PAD_VEL_MIN+(1-PAD_VEL_MIN)*padGestureEnergy(inst,tg);
}
// tick ONE instrument: per-capsule device cursors (each capsule's own axes/range/drag), targets, gating, trail
function padTickOne(inst,nowP,dtF){
  if(dtF==null)dtF=16.67;
  const touchDF=dragFactorDt(inst.drag,dtF);   // TOUCH pointer weight (capsules use their own drag)
  // per-device cursors: the active slot follows state.pose (~50 Hz), other slots D.poseLive (~12 Hz).
  // truthy pose guard: state.pose starts undefined — stamping on undefined would fake freshness.
  for(const id in (state.devices||{})){
    const D=state.devices[id];
    const cfg=padDevCfg(inst.dev,id);   // this capsule's own mapping (lazy default)
    const pose=(id===state.activeDeviceId&&state.pose)?state.pose:D.poseLive;
    const raw=(id===state.activeDeviceId)?state.last:null;   // raw CH0..5 only for the active slot
    const dc=inst.devCur[id]||(inst.devCur[id]={x:.5,y:.5,ref:null,at:0,twist:0});
    if(pose&&pose!==dc.ref){dc.ref=pose;dc.at=nowP;}
    if(pose&&nowP-dc.at<900){const m=padPoseXY(cfg,pose,raw),df=dragFactorDt(cfg.drag,dtF);
      dc.x+=(m.x-dc.x)*df;dc.y+=(m.y-dc.y)*df;dc.twist=Math.abs(pose.twist||0);}   // per-capsule drag (dt-based)
    dc.color=(D.meta&&D.meta.color)||"#36c5f0";
    // TWO ways a capsule can be silent on this pad, and the frog has to show BOTH. `muted` is the
    // capsule-wide switch (its pill up top); `padOff` is the tick next to it right here — "this
    // capsule does not play on THIS pad". Only the first one used to tape the frog's mouth shut, so
    // unticking a capsule beside the pad left a frog singing away with no sound coming out.
    dc.muted=devSoundOff(D);                      // capsule-wide: muted OR on hold
    dc.padOff=(cfg&&cfg.on===false);              // this pad only
    dc.silent=dc.muted||dc.padOff;
  }
  for(const id in inst.devCur)if(!(state.devices||{})[id])delete inst.devCur[id];
  // gate targets: the pointer (or its latch anchor) + with motion play ON, every fresh un-muted ON capsule
  const targets=[];
  if(inst.ptr){   // the played cursor lags toward the finger by the pad's TOUCH drag
    if(!inst._ptrS)inst._ptrS={x:inst.ptr.x,y:inst.ptr.y};
    const _oSx=inst._ptrS.x,_oSy=inst._ptrS.y;
    inst._ptrS.x+=(inst.ptr.x-inst._ptrS.x)*touchDF;inst._ptrS.y+=(inst.ptr.y-inst._ptrS.y)*touchDF;
    // MOMENTUM: track the smoothed cursor's velocity (pad-fraction / second) via a light EMA so a
    //   release can "throw" the frog trackball-style. Zeroed on a new touch (pointerdown).
    const _dts=Math.max(.001,dtF/1000);
    const _vx=(inst._ptrS.x-_oSx)/_dts,_vy=(inst._ptrS.y-_oSy)/_dts;
    if(!inst._ptrV)inst._ptrV={vx:0,vy:0};
    inst._ptrV.vx+=(_vx-inst._ptrV.vx)*.35;inst._ptrV.vy+=(_vy-inst._ptrV.vy)*.35;
    inst._mom=null;   // an active touch overrides any momentum glide
    targets.push({id:"ptr",x:inst._ptrS.x,y:inst._ptrS.y,twist:0,color:"#ffc440"});
  }else if(inst._mom){   // MOMENTUM glide — no finger: coast with exponential drag + damped edge bounce
    const M=inst._mom,_dtm=Math.max(.001,Math.min(.05,dtF/1000));   // clamp dt for a stable integration
    M.x+=M.vx*_dtm;M.y+=M.vy*_dtm;
    const _dec=Math.exp(-2.2*_dtm);M.vx*=_dec;M.vy*=_dec;   // k≈2.2 → ~0.3 s half-life (trackball feel)
    if(M.bounces==null)M.bounces=0;
    if(M.bounces<=3){                                       // reflect off the walls (damped) a few times, then just clamp
      if(M.x<0){M.x=-M.x;M.vx=-M.vx*.55;M.bounces++;}
      else if(M.x>1){M.x=2-M.x;M.vx=-M.vx*.55;M.bounces++;}
      if(M.y<0){M.y=-M.y;M.vy=-M.vy*.55;M.bounces++;}
      else if(M.y>1){M.y=2-M.y;M.vy=-M.vy*.55;M.bounces++;}
    }
    M.x=Math.max(0,Math.min(1,M.x));M.y=Math.max(0,Math.min(1,M.y));   // never leave the pad
    if(Math.hypot(M.vx,M.vy)<.05){inst._mom=null;inst._ptrS=null;}     // settled → vanish like a normal release
    else{inst._ptrS={x:M.x,y:M.y};targets.push({id:"ptr",x:M.x,y:M.y,twist:0,color:"#ffc440"});}
  }else{inst._ptrS=null;
    if(inst.latch&&inst.latched)targets.push({id:"ptr",x:inst.latched.x,y:inst.latched.y,twist:0,color:"#ffc440"});}
  if(inst.motion)for(const id in inst.devCur){const dc=inst.devCur[id],cfg=inst.dev[id];
    if(dc.muted||nowP-dc.at>=900)continue;
    if(cfg&&cfg.on===false)continue;   // capsule turned off for this pad
    targets.push({id:"dev:"+id,x:dc.x,y:dc.y,twist:dc.twist,color:dc.color});}
  // GATE: may the pad sound this frame? closed → drop every target so all voices gate off (cursors still drawn)
  // a chopping pad keeps the shared transport running while it has something to chop (rf-25b)
  if(inst.gate&&inst.gate.rhythm&&inst.gate.rhythm.on&&targets.length&&typeof rfClockNeed==="function")rfClockNeed(nowP);
  const _gOpen=padGateOpen(inst,_padGateCtx(inst,nowP),nowP);
  inst._gateOpen=_gOpen;inst._tgts=targets.slice();   // padRhythmStep replays these on the beat
  if(!_gOpen)targets.length=0;
  _padSound(inst,targets);
  _padTrails(inst,nowP);
}
// targets -> voices: a new target attacks, a held one glides, a vanished one releases
function _padSound(inst,targets){
  const free=padIsFree(inst),rng=free?padRange(inst):null;
  const lst=free?null:padNotes(inst),act={};
  for(const tg of targets){
    // free: the finger's x IS the pitch (fractional note) · otherwise: snap to the scale's column
    const idx=free?-1:Math.max(0,Math.min(lst.length-1,Math.floor(tg.x*lst.length)));
    const note=free?(rng.lo+Math.max(0,Math.min(1,tg.x))*(rng.hi-rng.lo)):lst[idx];
    act[tg.id]={note,idx,color:tg.color,x:tg.x,y:tg.y};   // x,y: the background plate (rf-24b) follows the frog
    const prev=inst.act[tg.id];
    if(!prev){PadAudio.gateOn(inst,tg.id,note,tg.y,padVelScale(inst,tg));padRipple(inst,tg.x,tg.y,tg.color);}
    else{PadAudio.update(inst,tg.id,note,tg.y,inst.vib?tg.twist:0);
      // a ripple per note change is meaningless where every frame is a new pitch
      if(!free&&note!==prev.note)padRipple(inst,(idx+.5)/lst.length,tg.y,tg.color);}
  }
  for(const id in inst.act)if(!act[id])PadAudio.gateOff(inst,id);
  inst.act=act;
}
function _padTrails(inst,nowP){
  // A TRAIL IS A STROKE, NOT A JOIN-THE-DOTS. Points live for 900 ms, so a tap here and another
  // tap over there used to be wired together by one long straight line across the pad — a movement
  // that never happened. Points that begin a new stroke are marked (`br`) and the drawing skips the
  // segment leading into them: a gap in time (finger lifted, data stalled) or a jump too far to be
  // a drag both start a new one.
  const _trailBreak=(last,x,y,t)=>!last||(t-last.t>140)||(Math.hypot(x-last.x,y-last.y)>0.4);
  // trail: only the ACTIVE device cursor (visible also when silent; skip under reduced motion)
  const adc=inst.devCur[state.activeDeviceId];
  if(adc&&nowP-adc.at<900&&!_prefersReducedMotion()){
    const lastT=inst.trail.length?inst.trail[inst.trail.length-1]:null;
    if(!lastT||nowP-lastT.t>28)inst.trail.push({x:adc.x,y:adc.y,t:nowP,br:_trailBreak(lastT,adc.x,adc.y,nowP)});
    while(inst.trail.length&&nowP-inst.trail[0].t>900)inst.trail.shift();
  }
  // pointer (finger/mouse) trail — a blue streak behind the dragged frog
  if(inst._ptrS&&!_prefersReducedMotion()){
    if(!inst._ptrTrail)inst._ptrTrail=[];
    const lpt=inst._ptrTrail.length?inst._ptrTrail[inst._ptrTrail.length-1]:null;
    // `_ptrWas` catches the fast case the clock cannot: press, release and press again inside the
    // same 140 ms is still two strokes, because the finger left the glass in between
    const fresh=!inst._ptrWas||!!inst._ptrBreak||_trailBreak(lpt,inst._ptrS.x,inst._ptrS.y,nowP);
    if(!lpt||nowP-lpt.t>28){inst._ptrTrail.push({x:inst._ptrS.x,y:inst._ptrS.y,t:nowP,br:fresh});inst._ptrBreak=false;}
  }
  inst._ptrWas=!!inst._ptrS;
  if(inst._ptrTrail)while(inst._ptrTrail.length&&nowP-inst._ptrTrail[0].t>900)inst._ptrTrail.shift();
}

// --- drawing
const _padHexA={};
function padHexA(hex,a){
  const k=hex+"|"+a;if(_padHexA[k])return _padHexA[k];
  let r=54,g=197,b=240;
  const m=/^#([0-9a-f]{6})$/i.exec(hex||"");
  if(m){const n=parseInt(m[1],16);r=(n>>16)&255;g=(n>>8)&255;b=n&255;}
  return _padHexA[k]=`rgba(${r},${g},${b},${a})`;
}
// Sticker outline: the frog's own silhouette filled with the capsule's colour, cached per
// (image, colour). Canvas cannot stroke a bitmap's alpha edge, so we build the silhouette once
// with `source-in` and stamp it around the sprite — the felt-badge look, in the capsule's colour.
const _frogSil={};
function _frogSilhouette(img,color){
  const k=(img.src||"")+"|"+color;
  const hit=_frogSil[k];
  if(hit)return hit;
  const w=img.naturalWidth,h=img.naturalHeight;
  const cv=document.createElement("canvas");cv.width=w;cv.height=h;
  const c=cv.getContext("2d");
  c.drawImage(img,0,0);
  c.globalCompositeOperation="source-in";   // keep the alpha shape, replace every colour with ours
  c.fillStyle=color;c.fillRect(0,0,w,h);
  return _frogSil[k]=cv;
}
// 🐸 draw a "singing" frog cursor: Y picks the mouth-openness image (0..4); Y also drives the
//   rotation — a gentle ±few° sway low on the pad, growing more dynamic/chaotic toward the top.
//   `muted` swaps every mouth frame for the taped-shut one (the capsule is silenced).
//   `edgeColor` is the capsule's colour: a hard sticker outline, not a glow — the punk-felt UI
//   everywhere else in the app is flat ink and stitches, and a soft halo read as a foreign material.
function padFrog(x,cx,cy,y,size,seed,playing,edgeColor,muted){
  let imgs=XPAD._frogImgs;
  if(!imgs)imgs=XPAD._frogImgs=PAD_FROG_SRC.map(s=>{const im=new Image();im.src=s;return im;});
  let silent=XPAD._frogSilentImg;
  if(!silent){silent=XPAD._frogSilentImg=new Image();silent.src=PAD_FROG_SILENT_SRC;}
  const yc=Math.max(0,Math.min(1,y));
  // A silenced capsule keeps moving and swaying — it just cannot sing, so the mouth frame is fixed.
  const img=muted?silent:imgs[Math.min(4,Math.floor(yc*5))];   // 0..0.2→0.png(closed/quiet) … 0.8..1→4.png (widest mouth, highest)
  if(!img||!img.complete||!img.naturalWidth){            // not decoded yet → fallback dot
    x.fillStyle=edgeColor||"rgba(108,179,63,.9)";x.beginPath();x.arc(cx,cy,size*0.26,0,Math.PI*2);x.fill();return;}
  let ang=0,bob=1;
  if(!_prefersReducedMotion()){
    // Height drives how worked-up the frog gets — but ONLY when it can actually sing. A muted
    // capsule holds the calm bottom-of-the-pad sway wherever it goes: thrashing about while
    // producing no sound looked like the mute had not taken.
    const ya=muted?0:yc;
    // FIXED frequencies (Y scales only amplitude + harmonic weight) — so moving the cursor (which
    // changes Y) never jumps the sin() phase. That phase jump was the "vibration while dragging".
    // Amplitude grows QUADRATICALLY toward the top so the frog gets much more animated up high.
    const t=performance.now()/1000, amp=(3+ya*18+ya*ya*26)*Math.PI/180;
    ang = Math.sin(t*2.2+seed)*amp                                        // base sway
        + Math.sin(t*5.6+seed*1.7)*amp*0.6*Math.max(0,(ya-0.30)/0.70)     // 2nd harmonic fades in past mid
        + Math.sin(t*9.4+seed*2.9)*amp*0.5*Math.max(0,(ya-0.60)/0.40)     // 3rd harmonic in the upper third
        + Math.sin(t*13.7+seed*3.7)*amp*0.4*Math.max(0,(ya-0.80)/0.20);   // 4th only near the very top → frantic singing
    if(ya>0.5)bob=1+Math.sin(t*8+seed*1.3)*0.06*((ya-0.5)/0.5);           // subtle size "belt" high up
  }
  // Size treats "muted" exactly like "playing": a silenced capsule is a full member of the pad,
  // it just makes no sound. Only the sway and the mouth frames tell the two apart.
  const s=size*((playing||muted)?1.14:1)*bob;
  x.save();x.translate(cx,cy);x.rotate(ang);
  if(edgeColor){
    // Stamp the silhouette around the sprite: 8 directions so the ring is even on diagonals too.
    // It grows while the frog sings, which is the same "this one is live" signal the glow carried.
    const sil=_frogSilhouette(img,edgeColor),r=Math.max(1.5,s*(playing?0.055:0.04));
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      x.drawImage(sil,-s/2+Math.cos(a)*r,-s/2+Math.sin(a)*r,s,s);
    }
  }
  x.drawImage(img,-s/2,-s/2,s,s);
  x.restore();
}
function padDraw(){for(const p of XPAD.pads)padDrawOne(p);_updateGateGraphs();}
// draw ONE instrument into its own canvas (inst._cv) — note grid, cursors, in-canvas note badge.
function _drawLatchLock(x,cx,cy,W,H){   // small padlock badge next to a latched frog
  const lx=Math.min(W-11,Math.max(11,Math.round(cx)+15)),ly=Math.max(11,Math.round(cy)-20);
  x.save();
  x.beginPath();x.arc(lx,ly,8.5,0,Math.PI*2);
  x.fillStyle="rgba(250,246,238,.95)";x.fill();
  x.lineWidth=1.5;x.strokeStyle="rgba(33,31,29,.9)";x.stroke();
  x.strokeStyle="#211f1d";x.lineWidth=1.6;
  x.beginPath();x.arc(lx,ly-1.5,3,Math.PI,2*Math.PI);x.stroke();
  x.fillStyle="#211f1d";x.fillRect(lx-4,ly,8,7);
  x.fillStyle="rgba(250,246,238,.95)";x.beginPath();x.arc(lx,ly+3,1.1,0,Math.PI*2);x.fill();
  x.restore();
}
function padDrawOne(inst){
  const cnv=inst._cv;if(!cnv)return;
  if(!cnv.clientWidth||cnv.offsetParent===null)return;   // hidden (fold/tab/disabled) — skip rendering only
  const dpr=window.devicePixelRatio||1,W=cnv.clientWidth,H=cnv.clientHeight;
  if(cnv.width!==Math.round(W*dpr)||cnv.height!==Math.round(H*dpr)){
    cnv.width=Math.round(W*dpr);cnv.height=Math.round(H*dpr);}
  const x=cnv.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);
  x.clearRect(0,0,W,H);
  // BACKGROUND PLATE (rf-24b): an audio-reactive WebGL canvas under this one. When it draws, the blue fill
  // is skipped; `scaleView` off hides the scale view (columns, guides, note names) and leaves only the frogs.
  const _pl=(typeof PadPlate!=="undefined")&&PadPlate.draw(inst,W,H,dpr),_dk=_pl&&padPlateDark(inst.plate),_sv=inst.scaleView!==false;
  const _free=padIsFree(inst);
  const lst=_free?[]:padNotes(inst),n=lst.length,cw=n?W/n:W,root=(((inst&&inst.scaleRoot!=null)?inst.scaleRoot:(state.midi&&state.midi.scaleRoot))|0)%12;
  // vertical Y gradient (brightness up)
  if(!_pl){const bg=x.createLinearGradient(0,H,0,0);
    bg.addColorStop(0,"#d7e9f7");bg.addColorStop(1,"#e9f4fd");
    x.fillStyle=bg;x.fillRect(0,0,W,H);}
  // SUPERPŁYNNE: nothing is divided, so nothing is drawn as a division — no columns, no note names,
  // no root tint. Just a left-to-right warmth so the pad still reads as "low here, high there".
  if(_free&&!_pl){
    const gx=x.createLinearGradient(0,0,W,0);
    gx.addColorStop(0,"rgba(120,100,60,.10)");gx.addColorStop(1,"rgba(200,151,26,.10)");
    x.fillStyle=gx;x.fillRect(0,0,W,H);
  }
  // playing columns: one highlight per active source, tinted with the source color
  const actIdx={};for(const id in inst.act){const a=inst.act[id];if(a.idx>=0)actIdx[a.idx]=a.color;}
  // note columns: root tinted, alternating shade elsewhere
  const _ln=_dk?"rgba(255,255,255,.14)":"rgba(120,100,60,.16)";
  if(_sv)for(let i=0;i<n;i++){
    const isRoot=(lst[i]%12)===root;
    const colStyle=isRoot?"rgba(200,151,26,.14)":(i%2?"rgba(120,100,60,.05)":null);
    if(colStyle){x.fillStyle=colStyle;x.fillRect(i*cw,0,cw,H);}
    if(actIdx[i]!=null){x.fillStyle=padHexA(actIdx[i],.16);x.fillRect(i*cw,0,cw,H);}
    x.strokeStyle=_ln;x.beginPath();x.moveTo(i*cw,0);x.lineTo(i*cw,H);x.stroke();
  }
  // horizontal guides
  x.strokeStyle=_ln;
  if(_sv)for(const fy of [.25,.5,.75]){x.beginPath();x.moveTo(0,H*fy);x.lineTo(W,H*fy);x.stroke();}
  // note labels: all when they fit, otherwise only C-notes and roots
  x.textAlign="center";x.textBaseline="bottom";
  const labelAll=cw>=26;
  if(!XPAD._font)XPAD._font="10px "+(getComputedStyle(document.body).fontFamily||"sans-serif");
  x.font=XPAD._font;
  if(_sv)for(let i=0;i<n;i++){const nt=lst[i],isRoot=(nt%12)===root,isC=nt%12===0;
    if(!labelAll&&!isRoot&&!isC)continue;
    x.fillStyle=_dk?(isRoot?"rgba(255,214,120,.95)":"rgba(255,255,255,.78)"):(isRoot?"rgba(160,116,18,.92)":"rgba(90,75,45,.5)");
    x.fillText(miNoteName(nt),i*cw+cw/2,H-3);}
  // ripples (colored by source)
  const now=performance.now();
  inst.ripples=inst.ripples.filter(r=>now-r.t<600);
  if(_pl)inst.ripples.length=0;   // a background draws its own marks — no extra rings on top
  for(const r of inst.ripples){const a=1-(now-r.t)/600;
    x.strokeStyle="rgba(84,158,208,"+(a*.42).toFixed(3)+")";x.lineWidth=1.5;
    x.beginPath();x.arc(r.x*W,(1-r.y)*H,7+(1-a)*42,0,Math.PI*2);x.stroke();}
  x.lineWidth=1;
  // motion trail (comet of the active device)
  const adc=inst.devCur[state.activeDeviceId];
  // the streak behind a frog's head belongs to the plain pad only — a background draws the frog's path itself
  if(!_pl&&inst.trail.length>1){
    const tc="#549ed0";
    for(let i=1;i<inst.trail.length;i++){const p0=inst.trail[i-1],p1=inst.trail[i];
      if(p1.br)continue;                      // new stroke — nothing to join it to
      const a=(1-(now-p1.t)/900)*.5;if(a<=0)continue;
      x.strokeStyle=padHexA(tc,a);x.lineWidth=2;
      x.beginPath();x.moveTo(p0.x*W,(1-p0.y)*H);x.lineTo(p1.x*W,(1-p1.y)*H);x.stroke();}
    x.lineWidth=1;}
  // pointer (finger/mouse) motion trail — blue streak of the dragged frog
  if(!_pl&&inst._ptrTrail&&inst._ptrTrail.length>1){
    for(let i=1;i<inst._ptrTrail.length;i++){const q0=inst._ptrTrail[i-1],q1=inst._ptrTrail[i];
      if(q1.br)continue;                      // new stroke — nothing to join it to
      const a=(1-(now-q1.t)/900)*.5;if(a<=0)continue;
      x.strokeStyle="rgba(84,158,208,"+a.toFixed(3)+")";x.lineWidth=2;
      x.beginPath();x.moveTo(q0.x*W,(1-q0.y)*H);x.lineTo(q1.x*W,(1-q1.y)*H);x.stroke();}
    x.lineWidth=1;}
  // device cursors — every fresh device is a singing frog in its own colour glow
  const _fv=inst.frogView!==false;   // the frogs can be hidden per pad (rf-24 pp-fv); they still play and steer
  if(_fv)for(const id in inst.devCur){
    const dc=inst.devCur[id];if(now-dc.at>=900)continue;
    const cx=dc.x*W,cy=(1-dc.y)*H;
    const playing=!!inst.act["dev:"+id];
    const seed=((id.charCodeAt(id.length-1)||3)%10)*0.9;   // desync each device's sway
    // A silenced capsule can never be "playing", so the playing-size rule would keep its frog
    // permanently the smallest one on the pad — silenced must not mean shrunken. It gets the same
    // base size a singing frog has; only the per-note 1.14 beat stays exclusive to actual sound.
    // `dc.silent` (not dc.muted): the tape goes on for a capsule switched off at THIS pad too.
    padFrog(x,cx,cy,dc.y,(playing||dc.silent)?48:40,seed,playing,padHexA(dc.color,1),dc.silent);
  }
  // pointer cursor (finger/mouse) — also a singing frog (pink glow)
  const _momOn=!!(inst._mom&&inst._ptrS);   // MOMENTUM: coasting frog is drawn (and counts as "playing") at its glide position
  const pp=(inst.ptr?(inst._ptrS||inst.ptr):null)||(_momOn?inst._ptrS:null)||((inst.latch&&inst.latched)?inst.latched:null);
  if(pp&&_fv){const cx=pp.x*W,cy=(1-pp.y)*H;
    padFrog(x,cx,cy,pp.y,(inst.ptr||_momOn)?48:42,11.3,!!(inst.ptr||_momOn),"rgb(236,26,131)");
    if(!inst.ptr&&!_momOn&&inst.latch&&inst.latched)_drawLatchLock(x,cx,cy,W,H);}   // padlock badge = frog is intentionally latched
  if(_pl&&PadPlate.hud)PadPlate.hud(inst,x,W,H);   // the plate's own layer on top of the frogs (e.g. trick names in the skate bowl)
  // COMPACT IN-CANVAS NOTE BADGE (top-left) — every pad is equal now.
  // Names are separated by a middle dot and sit on their own plate. A single space between them
  // ("C3 G#3") reads as one smeared word at 10 px over the striped note columns — two capsules
  // playing looked like two labels drawn on top of each other. Four names is the cap: beyond that
  // the row would run across a third of the pad, so the rest is counted (+2).
  const played=Object.values(inst.act).map(a=>a.note).sort((a,b)=>a-b);
  const _shown=played.slice(0,4).map(miNoteName);
  if(played.length>_shown.length)_shown.push("+"+(played.length-_shown.length));
  const nTxt=played.length?_shown.join(" · "):(padAnyFresh(inst)?"…":"—");
  x.save();
  x.font=XPAD._font;x.textAlign="left";x.textBaseline="top";
  const _nw=x.measureText(nTxt).width;
  x.fillStyle="rgba(250,246,238,.72)";
  x.beginPath();
  if(x.roundRect)x.roundRect(4,4,_nw+8,16,6);else x.rect(4,4,_nw+8,16);   // roundRect is recent; the plate still has to appear without it
  x.fill();
  x.fillStyle="rgba(90,75,45,.92)";x.fillText(nTxt,8,6);
  x.restore();
  // A CAPSULE IS MOVING BUT THIS PAD IGNORES IT → say so, in the same corner and the same voice as
  // the gate badge. Silence with a frog gliding across the pad is the one thing a player cannot
  // debug by looking, and "which of my pads has the switch off" was exactly that.
  if(XPAD.enabled&&!inst.motion&&padAnyFresh(inst)&&!inst.ptr&&!inst._mom){
    x.save();
    const tag2=(typeof _lang!=="undefined"&&_lang==="en")?"▶ motion play off":"▶ granie z ruchu wyłączone";
    x.font=XPAD._font||"12px sans-serif";x.textAlign="right";x.textBaseline="top";
    const tw2=x.measureText(tag2).width;
    x.fillStyle="rgba(53,53,52,.72)";x.fillRect(W-tw2-20,6,tw2+14,22);
    x.fillStyle="#ffe236";x.fillText(tag2,W-13,11);
    x.restore();
  }
  // gate CLOSED → dim the pad + a top-right badge so it's obvious why it's silent (only when a gate is active)
  if(XPAD.enabled&&_gateActive(inst.gate)&&inst._gateOpen===false){
    x.save();
    x.fillStyle="rgba(53,53,52,.26)";x.fillRect(0,0,W,H);
    const tag="🚦"+(typeof _lang!=="undefined"&&_lang==="en"?" gate closed":" bramka zamknięta");
    x.font=XPAD._font||"12px sans-serif";x.textAlign="right";x.textBaseline="top";
    const tw=x.measureText(tag).width;
    x.fillStyle="rgba(53,53,52,.85)";x.fillRect(W-tw-20,6,tw+14,22);
    x.fillStyle="#ffe236";x.fillText(tag,W-13,11);
    x.restore();
  }
}

// keep the pad scale selects mirrored with the group 🎼 selects (both write to state.midi)
function padSyncScaleUI(){
  const pr=document.getElementById("padRoot"),ps=document.getElementById("padScale");
  if(pr&&pr.value!==String((state.midi.scaleRoot|0)%12)&&document.activeElement!==pr)
    pr.value=String((state.midi.scaleRoot|0)%12);
  if(ps&&ps.value!==(state.midi.scale||"chromatic")&&document.activeElement!==ps)
    ps.value=state.midi.scale||"chromatic";
}

