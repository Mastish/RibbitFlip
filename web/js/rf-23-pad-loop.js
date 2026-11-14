"use strict";
// ===== pad loop, play-pad cards and pointer input =====
// Owns the pad rAF loop (with its idle throttling), builds the Synth tab, wires pointer play
// including the release-anywhere safety net, and renders the per-capsule mapping panels.

// ===================== ECONOMY MODE — pad loop idle throttling =====================
// When the Synth tab is inactive AND nothing is sounding, the pad loop coasts on a 250 ms
// setTimeout instead of a 60 fps requestAnimationFrame — it skips ALL tick/draw work and only
// re-checks activity. Any real activity (touch, tab-entry, sequencer/lab note, motion frame,
// still-ringing voice/tail) flips it straight back to rAF. Saves CPU when the tool sits idle
// on another tab. See _padWake for the immediate-wake hooks.
function _padBusy(){
  // Synth tab open → live cursors + spectrum need the full frame rate
  let el=XPAD._padTabEl;
  if(!el){el=document.getElementById("tab-pad");if(el)XPAD._padTabEl=el;}
  if(el&&el.classList.contains("active"))return true;
  if(typeof XPAD!=="undefined"){
    if(XPAD._seq&&XPAD._seq.playing)return true;        // sequencer running
    if(XPAD._lab)return true;                           // sound-lab preview open/sounding
    if(XPAD.pads)for(const p of XPAD.pads){             // pad played / coasting / latched / sounding
      if(p.ptr||p._mom||p._pid!=null)return true;
      if(p.latch&&p.latched)return true;
      if(p.act)for(const _k in p.act)return true;       // any active note key
    }
    if(XPAD.fxPads)for(const p of XPAD.fxPads)if(p.ptr||p._pid!=null)return true;
    if(XPAD.seqPads)for(const p of XPAD.seqPads){if(p.playing||p._pid!=null)return true;   // programmed pad playing / being drawn on
      if(p._aud)for(const k in p._aud)if(p._aud[k]>performance.now()-60)return true;}      // a piano key still down (draws it back up)
  }
  // any bus still holding a live voice or a ringing tail (release/echo/reverb tail)
  if(typeof PadAudio!=="undefined"&&PadAudio.buses){
    for(const id in PadAudio.buses){const b=PadAudio.buses[id];if(!b)continue;
      if(b.voices)for(const _s in b.voices)return true;
      if(b.tails&&b.tails.length)return true;
    }
  }
  return false;
}
// motion-play armed on any pad? — a streaming capsule must be able to wake the loop from idle
function _padMotionArmed(){
  if(typeof XPAD==="undefined"||!XPAD.enabled||!XPAD.pads)return false;
  for(const p of XPAD.pads)if(p.motion)return true;
  return false;
}
// wake the loop NOW (pointerdown / tab-entry / note-on / motion frame) — no-op if already at rAF
function _padWake(){
  if(typeof XPAD==="undefined"||!XPAD._loopIdle)return;   // already running at rAF → nothing to do
  XPAD._loopIdle=false;
  if(XPAD._loopH){clearTimeout(XPAD._loopH);XPAD._loopH=null;}   // drop the pending idle timer
  padLoop();                              // immediate tick; it reschedules itself (rAF while busy)
}
window._padWake=_padWake;
function padLoop(){
  let busy=true;   // if the activity check throws, stay on rAF (full rate) — never stall
  try{
    busy=_padBusy();
    if(busy){
      padTick();padDraw();fxTick();fxDraw();
      if(typeof seqPadsDraw==="function")seqPadsDraw();   // programmed pads (grid + singing frogs)
      if(typeof labDraw==="function")labDraw();   // the sound editor's lamp and curve panels (no-op unless it is open)
      const now=performance.now();
      if(now-XPAD._syncT>500){XPAD._syncT=now;padSyncScaleUI();padReflect();}   // refresh .live indicator too
    }
  }catch(e){/* a transient tick/render/audio error must never halt the whole pad loop */}
  window._padLoopN=(window._padLoopN||0)+1;   // diagnostic tick counter (idle≈4/s, active≈60/s)
  // reschedule OUTSIDE the try (loop always survives) — single in-flight handle, never doubled
  if(busy){XPAD._loopIdle=false;XPAD._loopH=requestAnimationFrame(padLoop);}
  else{XPAD._loopIdle=true;XPAD._loopH=setTimeout(padLoop,250);}
}

function padSetEnabled(on){
  XPAD.enabled=!!on;
  if(XPAD.enabled)PadAudio.resume();   // click = user gesture, unlocks audio
  else{if(typeof seqStopAll==="function")seqStopAll();PadAudio.gateOffAll();for(const p of XPAD.pads)p.act={};}
  padReflect();padSave();if(window.updateTabDots)updateTabDots();
  // Macierz „Przegląd wszystkich kapsli" (rf-45) czyta ten sam przełącznik w kolumnie „Dźwięk
  // (Synth)". Bez tego wywołania siatka zostawałaby na poprzedniej odpowiedzi aż do następnego
  // przerysowania — czyli mówiłaby co innego niż kropka i niż ten przycisk.
  try{if(typeof dmPaint==="function")dmPaint();}catch(e){}
  // The Synth is an output module like the others, so switching it on earns the same reminder of
  // the emergency stop (rf-39j). Only on the way ON — the stop itself calls this with false.
  if(XPAD.enabled&&typeof rfHotkeyReminder==="function")rfHotkeyReminder("pad");
}
// "Włącz i zagraj": one click from the empty state to the first sound. The click is the user gesture
// that unlocks WebAudio; the first pad gets "play from motion" so moving the capsule makes noise
// without hunting for that switch in the card.
function padPlayNow(){
  const first=XPAD.pads[0];
  if(first&&!first.motion)first.motion=true;
  padSetEnabled(true);
  const card=first&&document.querySelector('#playPads .playpad[data-id="'+first.id+'"]');
  if(card){try{card.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(e){}
    if(window.rfPopNew)window.rfPopNew(card);}
  if(typeof window.rfToast==="function")window.rfToast(_gl("Pady włączone. Rusz kapslem albo przeciągnij palcem po padzie.","Pads on. Move the capsule or drag a finger across the pad."));
}
function padReflect(){
  const by=id=>document.getElementById(id);
  const sec=by("padSec");if(sec)sec.classList.toggle("off",!XPAD.enabled);
  const en=by("padEnable");
  if(en){en.classList.toggle("on",XPAD.enabled);en.setAttribute("aria-checked",XPAD.enabled?"true":"false");}
  // "Nowe brzmienie" is the screen's main action (`rf-cta`, L4a) only while the pads play: with the module off
  // "Włącz i zagraj" is the one thing to press, and the button stays reachable as a plain one (the editor works
  // with the pads off)
  const ns=by("padNewSound");if(ns&&ns.classList.contains("rf-cta")!==!!XPAD.enabled)ns.classList.toggle("rf-cta",!!XPAD.enabled);
  if(typeof reflectPlayPads==="function")reflectPlayPads();   // each card's toggle/live state
}

// display {emoji,name,kind,overridden} for any sound id (base w/ optional override, or custom)
function soundMeta(id){
  const ov=XPAD.baseOverrides;
  if(HAS(PAD_BASE_META,id)){const b=PAD_BASE_META[id];const o=(ov&&HAS(ov,id))?ov[id]:null;
    return {kind:"base",emoji:(o&&o.emoji)||b.emoji,name:(o&&o.name)||b.name,overridden:!!(o&&(o.patch||o.name||o.emoji))};}
  const c=XPAD.customSounds&&XPAD.customSounds[id];
  if(c)return {kind:"custom",emoji:c.emoji||"🎛",name:c.name||id,overridden:false};
  return {kind:"custom",emoji:"🎛",name:id,overridden:false};
}
function soundLabel(id){const m=soundMeta(id);return m.emoji+" "+m.name;}
function padSoundList(){return PAD_SOUND_LIST.map(s=>[s[0],soundLabel(s[0])])   // base (override-aware labels)
  .concat(Object.keys(XPAD.customSounds||{}).filter(k=>k.slice(0,2)!=="__").map(k=>[k,soundLabel(k)]));}   // skip transient "__lab__"/"__preview__"
function padSoundOptionsHTML(sel){return padSoundList().map(s=>
  `<option value="${s[0]}"${s[0]===sel?" selected":""}>${esc(s[1])}</option>`).join("");}
function killAllAudio(){
  try{
    if(typeof PadAudio!=="undefined"&&PadAudio.buses&&PadAudio.ctx){
      const now=PadAudio.ctx.currentTime;
      const gains=[];
      for(const id in PadAudio.buses){const b=PadAudio.buses[id];if(!b)continue;
        for(const src in b.voices){const v=b.voices[src];if(v&&v.g&&v.g.gain)gains.push(v.g.gain);}
        if(Array.isArray(b.tails))for(const t of b.tails){if(t&&t.g&&t.g.gain)gains.push(t.g.gain);}}
      PadAudio.gateOffAll();
      for(const g of gains){try{g.cancelScheduledValues(now);g.setValueAtTime(0,now);}catch(e){}}
    }
    if(typeof XPAD!=="undefined"&&XPAD.pads)for(const p of XPAD.pads){p.act={};try{if(p._cv&&p._pid!=null&&p._cv.releasePointerCapture)p._cv.releasePointerCapture(p._pid);}catch(e){}p.ptr=null;p._ptrS=null;p._pid=null;p.latched=null;p._mom=null;p._ptrV=null;}
    if(typeof XPAD!=="undefined"&&XPAD.fxPads)for(const p of XPAD.fxPads){try{if(p._cv&&p._pid!=null&&p._cv.releasePointerCapture)p._cv.releasePointerCapture(p._pid);}catch(e){}p.ptr=null;p._pid=null;}
    if(typeof labStopAll==="function")labStopAll();
    if(typeof seqStopAll==="function")seqStopAll();
  }catch(e){}
}
// STAN SYNTEZATORA PRZYJEŻDŻA TERAZ Z SERWERA (rf-20b), więc wczytanie ma dwa takty: podręczna
// kopia z przeglądarki natychmiast, a potem — o kilka milisekund później — odpowiedź serwera, która
// wygrywa. Karty padów rysujemy DOPIERO po tym drugim takcie: narysowane wcześniej pokazywałyby
// przez chwilę cudzy (stary) syntezator, a każde kliknięcie w nie zapisywałoby ten stary stan
// z powrotem. Reszta bootu leci swoim tempem — czeka wyłącznie ta jedna zakładka.
function initPad(){
  if(!document.getElementById("playPads"))return;
  if(typeof padLoadAsync==="function")padLoadAsync(_initPadUi);
  else{padLoad();_initPadUi();}            // rf-20b nieobecny (harness) — jak przed tą zmianą
}
function _initPadUi(){
  const by=id=>document.getElementById(id);
  // GLOBAL scale selects in the section header (shared state with the 🎼 MIDI/OSC group)
  const pr=by("padRoot"),ps=by("padScale");
  if(pr){pr.innerHTML=MI_ROOTS.map((r,i)=>`<option value="${i}">${r}</option>`).join("");
    pr.value=String((state.midi.scaleRoot|0)%12);
    pr.addEventListener("change",()=>{state.midi.scaleRoot=+pr.value||0;
      const g=by("miScaleRoot");if(g)g.value=pr.value;renderMidiList();commitMidi();});}
  if(ps){ps.innerHTML=MI_SCALES.map(s=>`<option value="${s[0]}">${s[1]}</option>`).join("");
    ps.value=state.midi.scale||"chromatic";
    ps.addEventListener("change",()=>{state.midi.scale=ps.value||"chromatic";
      const g=by("miScale");if(g)g.value=ps.value;renderMidiList();commitMidi();});}
  // explicit enable toggle — the pads are OPT-IN; gates ALL pads' audio
  const killBtn=by("padKill");if(killBtn)killBtn.addEventListener("click",killAllAudio);
  const enBtn=by("padEnable");
  if(enBtn)enBtn.addEventListener("click",()=>padSetEnabled(!XPAD.enabled));
  // the same switch, offered where the pads would be — an empty box that only says "off" leaves
  // the user hunting for the toggle in the header
  const offOn=by("padsOffOn");
  if(offOn)offOn.addEventListener("click",padPlayNow);
  // UX 261120 L4a: „Dodaj pad” stoi w „Zaawansowanych” (piętro 3) na dole sekcji padów
  if(typeof rfTier==="function")rfTier(by("padAdvFold"),"synth.zaawansowane",{adv:true});
  // sound library → top of the tab, above the pads.
  // Od 2026-08-31 biblioteka dźwięków ma WŁASNĄ zakładkę modułu („Brzmienia" — rf-49m, pole `take`),
  // a ta funkcja chodzi PO zbudowaniu ramki. Bez warunku `sec.contains(se)` przenosiłaby ją z
  // powrotem do sekcji padów zaraz po tym, jak zakładka ją do siebie zabrała — z klasą i otwartym
  // `<details>`, więc po samych stylach wyglądałoby to na działające.
  const sec=by("padSec"),se=by("soundEditor"),pp=by("playPads");
  if(sec&&se&&pp&&sec.contains(se)&&se.nextSibling!==pp)sec.insertBefore(se,pp);
  // play pads (all, incl. the first default), sound library, effects pads
  renderPlayPads();
  const ppAdd=by("playPadAddBtn");if(ppAdd)ppAdd.addEventListener("click",()=>{PadAudio.resume();addPlayPad();});
  if(typeof initSoundEditor==="function")initSoundEditor();
  if(typeof initSeqPads==="function")initSeqPads();   // programmed pads (rf-25b) — before the fx pads, which may target them
  renderFxPads();
  const fxAdd=by("fxAddBtn");if(fxAdd)fxAdd.addEventListener("click",()=>{PadAudio.resume();addFxPad();});
  padReflect();
  // rAF pauses in hidden tabs — keep the AUDIO ticking from an interval there, otherwise
  // a motion-driven note would freeze/hang the moment the user switches tabs.
  setInterval(()=>{if(document.hidden){padTick();fxTick();}},50);
  // ECONOMY MODE: returning to a visible page must resume the loop instantly if it was idle-throttled
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)_padWake();});
  XPAD._loopIdle=false;XPAD._loopH=requestAnimationFrame(padLoop);   // kick the loop (it self-schedules)
}

// ===================== capsule assignment + EFFECTS PADS (multiple XY surfaces) =====================
//  Each effects pad is a separate XY surface whose X/Y steer a global effect parameter
//  (echo mix / brightness / echo time / feedback). You assign which capsules drive it — a capsule
//  can be on the notes pad AND on several effects pads at once. Touch/mouse always drives directly.
function padDevList(){
  const out=[];
  for(const id in (state.devices||{})){const D=state.devices[id];
    out.push({id,name:(D.meta&&D.meta.name)||id,color:(D.meta&&D.meta.color)||"#8aa0b5",
      muted:devSoundOff(D)});}
  return out;
}
// ============ PLAY PADS — each an independent instrument card (per-capsule axes/drag) =========
function padAxisOptionsHTML(sel){return PAD_AXES.map(a=>`<option value="${a[0]}"${a[0]===sel?" selected":""}>${a[1]}</option>`).join("");}
// MOMENTUM release (Steam-Input-style trackball throw): on release, arm a coasting glide seeded from the
//   smoothed cursor (_ptrS) + its tracked velocity (_ptrV). Latch WINS (never arms). A gentle release
//   (below the throw threshold) just vanishes normally. Returns true when a glide was armed → the caller
//   must NOT null _ptrS (padTickOne keeps driving it from _mom).
function padArmMomentum(p){
  if(!p||!p.momentum||p.latch)return false;
  const v=p._ptrV,s=p._ptrS;if(!v||!s)return false;
  if(Math.hypot(v.vx,v.vy)<.35)return false;   // throw too gentle → normal release
  p._mom={x:s.x,y:s.y,vx:v.vx,vy:v.vy,bounces:0};
  return true;
}
// bind pointer play to an additional play-pad canvas (mouse+touch capture; latch on release)
function _playPadBindPointer(cv,inst){
  if(!cv)return;
  inst._cv=cv;inst._pid=null;inst.ptr=null;   // fresh canvas after rebuild → drop stale capture/frozen touch
  const xy=e=>{const r=cv.getBoundingClientRect();
    return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),
            y:Math.max(0,Math.min(1,1-(e.clientY-r.top)/r.height))};};
  cv.addEventListener("contextmenu",e=>e.preventDefault());
  cv.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&e.button!==0)return;if(inst._pid!=null)return;
    inst._pid=e.pointerId;inst._mom=null;inst._ptrV=null;try{cv.setPointerCapture(e.pointerId);}catch(err){}PadAudio.resume();inst.ptr=xy(e);
    // A NEW TOUCH STARTS WHERE THE FINGER IS. The smoothed cursor used to keep the position of the
    // previous touch and glide over to meet the new one — the frog flew across the pad playing
    // everything on the way, and the trail drew that flight as one straight line between two taps.
    // A gesture nobody made. `_ptrBreak` tells the trail the same thing: this is a new stroke.
    inst._ptrS={x:inst.ptr.x,y:inst.ptr.y};inst._ptrBreak=true;
    _padWake();e.preventDefault();});   // new touch cancels any glide (+ wake loop from idle NOW)
  cv.addEventListener("pointermove",e=>{if(inst._pid!==e.pointerId||!inst.ptr)return;inst.ptr=xy(e);});
  const up=e=>{if(inst._pid!==e.pointerId)return;inst._pid=null;
    if(inst.ptr&&inst.latch)inst.latched={x:inst.ptr.x,y:inst.ptr.y};
    const _armed=padArmMomentum(inst);inst.ptr=null;if(!_armed)inst._ptrS=null;inst._ptrV=null;};   // MOMENTUM: keep _ptrS alive when a glide armed
  cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",up);
  cv.addEventListener("lostpointercapture",up);
  _wirePadPointerSafetyNet();   // release-anywhere fallback (pointerup outside the canvas/window)
}
// A pointerup released OUTSIDE the canvas — fast drag off the pad, past the window edge, or a
// pointer-capture miss — never reaches the per-canvas listener, so the touch cursor (frog) would
// stick and keep sounding. One window-level sweep releases every pad's held pointer. Wired once.
function _wirePadPointerSafetyNet(){
  if(window._padPtrNetWired)return; window._padPtrNetWired=true;
  const releaseOne=(p,isFx)=>{ if(!isFx&&p.ptr&&p.latch)p.latched={x:p.ptr.x,y:p.ptr.y};
    const _armed=(!isFx)&&padArmMomentum(p); p._pid=null; p.ptr=null; if(!_armed)p._ptrS=null; if(!isFx)p._ptrV=null; };   // MOMENTUM through the safety-net path too
  const release=e=>{const pid=(e&&e.pointerId!=null)?e.pointerId:null;
    for(const p of XPAD.pads){
      if(pid!=null&&p._pid!==pid)continue;    // not this pad's held pointer
      if(p._pid==null&&!p.ptr)continue;       // nothing held
      releaseOne(p,false);
    }
    if(XPAD.fxPads)for(const p of XPAD.fxPads){
      if(pid!=null&&p._pid!==pid)continue;
      if(p._pid==null&&!p.ptr)continue;
      releaseOne(p,true);
    }};
  window.addEventListener("pointerup",release);
  window.addEventListener("pointercancel",release);
  window.addEventListener("blur",()=>release(null));   // focus lost mid-drag → release everything held
  // lost pointerup (mixed mouse+touch / capture miss): a held MOUSE pointer with NO button down = already released
  window.addEventListener("pointermove",e=>{if(e.pointerType!=="mouse"||e.buttons!==0)return;
    for(const p of XPAD.pads)if(p._pid===e.pointerId)releaseOne(p,false);
    if(XPAD.fxPads)for(const p of XPAD.fxPads)if(p._pid===e.pointerId)releaseOne(p,true);});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")release(null);});   // tab hidden mid-drag → release all held
}
// per-capsule mapping panels (reused by play pads AND fx pads): each device gets on-toggle + own axX/axY/range/drag
// shared markup + wiring for the per-capsule invert/curve row (play pads AND fx pads)
function padCurveOptionsHTML(sel){return PAD_CURVE_OPTS.map(o=>`<option value="${o[0]}"${sel===o[0]?" selected":""}>${o[1]}</option>`).join("");}
// THE FORMULAS RIDE ON THE SELECT, not on each <option> the way rf-16 puts them. This panel's
// tooltip module (rf-05) strips every `title` into a bubble of its own and, for an element with no
// text of its own, also copies it into `aria-label` — on an <option> that would rename
// „Precyzyjna (kwadrat)" to „t²" for a screen reader, and a native option tooltip never shows here
// anyway. One sentence on the select says the same thing and actually appears on hover.
const PAD_CURVE_TIP="Krzywa odpowiedzi — te same trzy co w MIDI i OSC: Liniowa = t · Precyzyjna (kwadrat) = t² · Czuła (pierwiastek) = √t";
function padInvCurRowHTML(cfg){
  return `<label class="cap-fld cap-invrow"><span>Odwróć</span><span class="cap-invwrap">`+
    `<label class="cap-invbox"><input type="checkbox" class="cap-invx"${cfg.invX?" checked":""}> X</label>`+
    `<label class="cap-invbox"><input type="checkbox" class="cap-invy"${cfg.invY?" checked":""}> Y</label></span></label>`+
    `<label class="cap-fld" title="${PAD_CURVE_TIP}"><span>Krzywa X</span><select class="cap-curx">${padCurveOptionsHTML(cfg.curX)}</select></label>`+
    `<label class="cap-fld" title="${PAD_CURVE_TIP}"><span>Krzywa Y</span><select class="cap-cury">${padCurveOptionsHTML(cfg.curY)}</select></label>`;
}
function wirePadInvCur(cfg,q){
  const ix=q(".cap-invx");if(ix)ix.onchange=e=>{cfg.invX=e.target.checked;padSave();};
  const iy=q(".cap-invy");if(iy)iy.onchange=e=>{cfg.invY=e.target.checked;padSave();};
  const cx=q(".cap-curx");if(cx)cx.onchange=e=>{cfg.curX=padCurOK(e.target.value)?e.target.value:"lin";padSave();};
  const cy=q(".cap-cury");if(cy)cy.onchange=e=>{cfg.curY=padCurOK(e.target.value)?e.target.value:"lin";padSave();};
}
// Short label for one pad axis, for the chip's summary line ("roll · pitch · ±45°").
function _padAxShort(ax){
  const m={roll:"roll",pitch:"pitch",tilt:"pochylenie",twist:"obrót"};
  return m[ax]||String(ax||"").toUpperCase();
}
function _capSummary(cfg){
  const deg=(cfg.axX==="twist"||cfg.axY==="twist")?"":"°";
  return _padAxShort(cfg.axX)+" · "+_padAxShort(cfg.axY)+" · ±"+cfg.range+deg;
}
// ONE panel per pad instead of one stacked block per capsule. Four capsules used to mean four
// eight-control grids under the same pad, which is most of a screen for settings you touch once and
// then read at a glance. Now the capsules are a row of chips (tick = plays on this pad, name = open
// its settings) and AT MOST ONE settings block is open below them, named after whoever it belongs to.
// A muted capsule cannot be opened at all: it makes no sound on this pad, so a grid of live-looking
// controls under it would be a panel about nothing.
function _renderCapMappers(devMap,wrap,devs,defOn,onChange){
  wrap.innerHTML="";
  const panel=document.createElement("div"); panel.className="cap-panel";
  panel.innerHTML='<div class="cap-h">Kapsle<span class="cap-h-hint">kliknij kapsel, żeby ustawić jego osie</span></div>'+
                  '<div class="cap-chips"></div><div class="cap-editor" hidden></div>';
  wrap.appendChild(panel);
  const chips=panel.querySelector(".cap-chips"), ed=panel.querySelector(".cap-editor");
  if(!devs.length){chips.innerHTML='<span class="hint">brak połączonych urządzeń — dotyk zawsze gra</span>';return;}

  let openId=null;
  function closeEd(){
    openId=null; ed.hidden=true; ed.innerHTML="";
    chips.querySelectorAll(".cap").forEach(c=>{c.classList.remove("is-open");
      const b=c.querySelector(".cap-open"); if(b)b.setAttribute("aria-expanded","false");});
  }
  function openEd(d,cfg,chip){
    if(chip.classList.contains("muted"))return;   // nothing of this capsule reaches this pad
    if(openId===d.id){closeEd();return;}          // same chip again = close
    closeEd(); openId=d.id;
    chip.classList.add("is-open");
    const b=chip.querySelector(".cap-open"); if(b)b.setAttribute("aria-expanded","true");
    ed.style.setProperty("--dcol",d.color);
    ed.hidden=false;
    ed.innerHTML=
      `<div class="cap-ed-h">${capImgSpan(d.id,18)}<b>${esc(d.name)}</b><span>osie tego kapsla na tym padzie</span>`+
        `<button type="button" class="cap-ed-x" aria-label="Zwiń ustawienia kapsla">×</button></div>`+
      `<div class="cap-grid">`+
        `<label class="cap-fld"><span>Oś X</span><select class="cap-axx">${padAxisOptionsHTML(cfg.axX)}</select></label>`+
        `<label class="cap-fld"><span>Oś Y</span><select class="cap-axy">${padAxisOptionsHTML(cfg.axY)}</select></label>`+
        `<label class="cap-fld"><span>Zakres ±<b class="cap-rangev">${cfg.range}</b>°</span><input class="cap-range" type="range" min="15" max="180" step="5" value="${cfg.range}"></label>`+
        `<label class="cap-fld"><span>🖱 Drag</span><input class="cap-drag" type="range" min="0" max="100" value="${cfg.drag}"></label>`+
        padInvCurRowHTML(cfg)+
      `</div>`;
    const q=s=>ed.querySelector(s);
    // The chip's summary follows every edit, so a closed panel still answers "what is this set to".
    const sum=chip.querySelector(".cap-sum");
    const reSum=()=>{if(sum)sum.textContent=_capSummary(cfg);};
    q(".cap-ed-x").onclick=closeEd;
    q(".cap-axx").onchange=e=>{cfg.axX=e.target.value;reSum();padSave();};
    q(".cap-axy").onchange=e=>{cfg.axY=e.target.value;reSum();padSave();};
    q(".cap-range").oninput=e=>{cfg.range=+e.target.value||45;const v=q(".cap-rangev");if(v)v.textContent=String(cfg.range);reSum();padSave();};
    q(".cap-drag").oninput=e=>{cfg.drag=+e.target.value||0;padSave();};
    wirePadInvCur(cfg,q);
    try{if(typeof applyLang==="function")applyLang(ed);}catch(e){}
  }

  for(const d of devs){
    const cfg=padDevCfg(devMap,d.id,defOn);
    // A muted capsule reads as OFF here and the tick cannot be clicked: it makes no sound on this
    // pad either way, and a ticked box next to a silenced capsule is a control telling a lie.
    // `cfg.on` is deliberately NOT written — un-muting must give the pad back exactly the choice
    // that was made before, not a box someone else unticked.
    const off=!cfg.on||d.muted;
    const chip=document.createElement("div");
    chip.className="cap"+(off?" off":"")+(d.muted?" muted":"");
    chip.dataset.dev=d.id; chip._cfg=cfg; chip.style.setProperty("--dcol",d.color);
    chip.innerHTML=
      `<label class="cap-on" title="Graj tym kapslem na tym padzie">`+
        `<input type="checkbox" ${(cfg.on&&!d.muted)?"checked":""}${d.muted?" disabled":""}></label>`+
      `<button type="button" class="cap-open" aria-expanded="false">`+
        capImgSpan(d.id,20)+`<span class="cap-nm">${esc(d.name)}</span>`+
        `<span class="cap-sum">${esc(_capSummary(cfg))}</span>`+
        // Always in the markup, filled by padCapsSyncMuted and hidden by CSS while empty — the same
        // reason the pill marks are: a node that appears and disappears fights the in-place refresh.
        `<span class="cap-mutedtag" data-pl=""></span>`+
      `</button>`;
    chip._closeEd=closeEd;   // padCapsSyncMuted folds a capsule away the moment it is silenced
    const box=chip.querySelector(".cap-on input");
    box.onchange=e=>{cfg.on=e.target.checked;chip.classList.toggle("off",!cfg.on||chip.classList.contains("muted"));padSave();if(onChange)onChange();};
    chip.querySelector(".cap-open").onclick=()=>openEd(d,cfg,chip);
    chips.appendChild(chip);
  }
  if(typeof padCapsSyncMuted==="function")padCapsSyncMuted();   // paints the muted tags on first render
}
// Mute is toggled from the capsule pill, on the other side of the page — refresh the capsule rows
// of every pad IN PLACE rather than re-rendering the cards (a rebuild would drop the pad canvases
// and cut whatever is playing). The tick mirrors the pill: silenced capsule = unticked + locked.
// Two switches land here: "mute the sound" and "hold this capsule". They look the same on a pad
// (no sound either way), so the only difference is which one the tooltip names.
function padCapsSyncMuted(){
  document.querySelectorAll(".cap[data-dev]").forEach(cap=>{
    const D=(state.devices||{})[cap.dataset.dev];if(!D)return;
    const held=devOutOff(D), muted=devSoundOff(D);
    const box=cap.querySelector(".cap-on input");if(!box)return;
    const lab=cap.querySelector(".cap-on");
    // The pad's own choice for this capsule, kept on the row at render time — the checkbox is only
    // a derived view of it while muted, so it must never be read back OUT of the checkbox.
    const on=cap._cfg?cap._cfg.on!==false:box.checked;
    cap.classList.toggle("muted",muted);
    cap.classList.toggle("off",!on||muted);
    box.disabled=muted;box.checked=on&&!muted;
    // Silenced capsule = folded away. Leaving its settings open would be a live-looking panel about
    // a capsule that cannot reach this pad at all.
    if(muted&&cap.classList.contains("is-open")&&typeof cap._closeEd==="function")cap._closeEd();
    const tip=held?"Ten kapsel jest wstrzymany, więc nic z niego nie wychodzi: ani dźwięk, ani klawisze. Wznów go w sekcji Moduły nad pigułkami kapsli, w kolumnie Cały kapsel."
                  :"Ten kapsel ma wyciszony dźwięk, więc nie gra na żadnym padzie. Klawisze i MIDI dalej z niego lecą.";
    const btn=cap.querySelector(".cap-open");
    if(btn){
      if(muted)btn.title=tip; else btn.removeAttribute("title");
      btn.disabled=muted;
    }
    if(lab){ if(muted)lab.title=tip; else lab.title="Graj tym kapslem na tym padzie"; }
    // The tag node is permanent; only its text changes (empty = hidden by CSS).
    const tag=cap.querySelector(".cap-mutedtag");
    if(tag){
      const word=muted?(held?"wstrzymany":"wyciszony"):"";
      if(tag.getAttribute("data-pl")!==word){
        tag.setAttribute("data-pl",word); tag.textContent=word;
        if(word&&typeof applyLang==="function"){try{applyLang(tag);}catch(e){}}
      }
    }
  });
}
// configure the pad card's gate param slider (min/max/step/value/label) for the pad's current gate, or hide it
