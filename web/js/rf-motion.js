/* Entrance and state-change animations for the whole dashboard: rfStagger/rfPopNew (exposed on
   window) plus a delegated "pop" on interactive controls. Every effect is a no-op under
   prefers-reduced-motion, and this is the ONLY place that adds the rf-enter/rf-pop classes. */
(function(){
  "use strict";
  if(window.__rfMotion) return; window.__rfMotion=1;   // guard: loading this file twice must not double-bind
  var RM=(window.matchMedia?window.matchMedia("(prefers-reduced-motion: reduce)"):null);
  function reduced(){ return !!(RM&&RM.matches); }

  /* ONE entrance language for the whole app: rfStagger() (tab switch + initial load)
     and rfPopNew() (a single freshly added list item) share the rf-enter keyframes via
     the .rf-in-now class. rfStagger picks only TOP-LEVEL visible cards so a .pad-sec and
     the .playpad inside it never animate the SAME element twice. Exposed on window so
     setTab() and the render "add" call-sites can drive it. */
  var SEL_STAGGER=".card,.pad-sec,.devices-panel,.cardfold,.playpad,.fxpad,.sound-editor";
  function _visible(el){ return !!(el.offsetParent!==null || (el.getClientRects&&el.getClientRects().length)); }
  function _topLevel(el,root){ var p=el.parentElement; while(p&&p!==root){ if(p.matches&&p.matches(SEL_STAGGER)) return false; p=p.parentElement; } return true; }
  function rfInNow(el,idx){
    if(!el) return;
    el.classList.remove("rf-in-now"); void el.offsetWidth;   /* restart cleanly on re-entry */
    el.style.setProperty("--rf-i",(idx||0));
    el.classList.add("rf-anim"); el.classList.add("rf-in-now");
    var clear=function(e){
      // Only react to THIS element's own entrance ending — not a bubbled animationend from a child
      // (e.g. a freshly-checked cap-on checkbox popping) which would abort the card's rf-enter early.
      if(e&&(e.target!==el||e.animationName!=="rf-enter")) return;
      el.classList.remove("rf-in-now"); el.classList.remove("rf-anim");
      el.style.removeProperty("--rf-i"); el.removeEventListener("animationend",clear);
    };
    el.addEventListener("animationend",clear);
  }
  function rfStagger(container){
    if(!container||reduced()) return;
    try{
      var all=container.querySelectorAll(SEL_STAGGER), list=[], i;
      for(i=0;i<all.length;i++){ var el=all[i]; if(!_visible(el)) continue; if(!_topLevel(el,container)) continue; list.push(el); }
      for(i=0;i<list.length;i++) rfInNow(list[i], i%10);
    }catch(err){}
  }
  function rfPopNew(el){ if(el&&!reduced()) rfInNow(el,0); }
  window.rfStagger=rfStagger;
  window.rfPopNew=rfPopNew;

  /* -- Tip-jar nudge: the mug in the corner rocks once whenever ANY mapping fires. Called from
     routeEvent's "tf" branch (rf-08), so it covers every device slot and every rule, including the
     ones firing while you are on another tab of the dashboard.
     Rate limited on purpose: a "repeatedly while met" rule fires many times a second and would
     otherwise turn a wink into a permanent shake. One rock per KOFI_MIN_MS, never restarted
     mid-swing. The class is cleared by a timer rather than by animationend, so a swing that never
     starts — the mug is display:none in the mappings overview, and a background tab may not run
     the animation at all — cannot leave the button stuck in the nudged state. Deliberately NOT
     gated on document.hidden: an embedded/detached panel can report itself hidden while somebody
     is looking straight at it, and the cost of a skipped-over class toggle is nil. */
  var KOFI_MIN_MS=1100, KOFI_ANIM_MS=760, _kofiAt=0, _kofiTmr=0;
  /* Returns TRUE only when the mug really rocked. The event-driven caller (rf-08) ignores it; the
     idle scheduler below counts on it, because a call that bailed — no mug on the page yet, or one
     still mid-swing — must not eat one of the two winks that session is allowed. */
  function rfKofiNudge(){
    if(reduced()) return false;
    var now=Date.now();
    if(now-_kofiAt<KOFI_MIN_MS) return false;
    try{
      var btn=document.querySelector("#rfKofi .rf-kofi-btn");
      if(!btn||btn.classList.contains("is-nudge")) return false;
      _kofiAt=now;
      btn.classList.add("is-nudge");
      clearTimeout(_kofiTmr);
      _kofiTmr=setTimeout(function(){ btn.classList.remove("is-nudge"); },KOFI_ANIM_MS);
      return true;
    }catch(err){}
    return false;
  }
  window.rfKofiNudge=rfKofiNudge;

  /* -- Tip-jar wink: the same one-off rock, fired every now and then ON ITS OWN, so the corner can
     catch the eye of someone who never moves the pointer there. Deliberately at a RANDOM interval
     rather than a fixed one: a metronome in the corner of the screen reads as a broken loop, while
     an irregular one reads as something alive. Skipped while the pointer or keyboard focus is on
     the jar (the hover wave owns the mug then) and while the tab is hidden — unlike the
     mapping-driven nudge above, which fires on a real event and is worth queuing, an unprompted
     attention-getter in a tab nobody is looking at is pure waste. The next slot is scheduled after
     each attempt, skipped or not, so the rhythm never drifts into a burst. */
  /* TWO winks per page session, then silence — and that ceiling is the whole point. „Every 26–72 s,
     forever" is not a hint, it is a tap dripping: over an hour in front of this panel the mug asked
     for money somewhere near sixty times, which is the exact behaviour the app promises NOT to have
     anywhere else. Two is enough to say „this corner is a thing you can click"; a third says
     „please". The nudge fired by a real event (rf-08, a trigger actually firing) is untouched —
     that one is an ANSWER, not an interruption, and it is not counted here.
     A skipped slot does not burn a wink: the counter goes up when the mug really rocks, so a page
     left on a hidden tab still gets its two once somebody comes back to it. */
  var KOFI_IDLE_MIN_MS=26000, KOFI_IDLE_MAX_MS=72000, KOFI_IDLE_MAX_WINKS=2;
  var _kofiIdleTmr=0, _kofiIdleWinks=0;
  function _kofiScheduleIdle(){
    clearTimeout(_kofiIdleTmr);
    if(_kofiIdleWinks>=KOFI_IDLE_MAX_WINKS) return;   /* nothing left to schedule — no timer, no loop */
    _kofiIdleTmr=setTimeout(function(){
      try{
        var jar=document.querySelector("#rfKofi");
        var busy=!jar||document.hidden||(jar.matches&&jar.matches(":hover,:focus-within"));
        if(!busy&&!reduced()&&rfKofiNudge()) _kofiIdleWinks++;
      }catch(err){}
      _kofiScheduleIdle();
    }, KOFI_IDLE_MIN_MS+Math.random()*(KOFI_IDLE_MAX_MS-KOFI_IDLE_MIN_MS));
  }

  function boot(){
    try{
      /* Initial entrance: stagger the currently visible top-level cards ONCE
         (active tab panel + always-visible rail/devices). Tab switches drive every
         subsequent entrance via setTab()->rfStagger — ONE system, zero IntersectionObserver,
         so the same card can never be animated by two mechanisms at once. */
      if(!reduced()) rfStagger(document.querySelector(".wrap")||document.body);
    }catch(err){ /* defensive: never throw into console */ }

    if(!reduced()) _kofiScheduleIdle();       /* kubek w rogu mruga sam, w losowych odstępach — dwa razy na sesję */

    /* -- State-change pop: chips + toggles (delegated, leak-free) -- */
    if(reduced()) return;
    try{
      /* Pop ONLY on genuine interactive controls. Status dots (.pm-dot/.dp-dot/.ov-dot) run their
         own meaningful status animations (pmpulse/devOnline/pulse) and the `animation` shorthand in
         .rf-pop would clobber those mid-flight, so dots are excluded on purpose. */
      var popSel=".seqchip, #recToggle, #armBtn, #mEnable, .grp-enable, .rf-toggle";
      var handler=function(ev){
        var t=ev.target;
        if(!t||!t.closest) return;
        var el=t.closest(popSel);
        if(!el) return;
        popOnce(el);
      };
      document.addEventListener("click",handler,true);
      document.addEventListener("change",handler,true);
    }catch(err){}
  }

  function popOnce(el){
    try{
      if(el.classList.contains("rf-pop")){
        /* restart cleanly if mid-animation */
        el.classList.remove("rf-pop");
        void el.offsetWidth; /* reflow */
      }
      el.classList.add("rf-pop");
      var done=function(){
        el.classList.remove("rf-pop");
        el.removeEventListener("animationend",done);
      };
      el.addEventListener("animationend",done);
    }catch(err){}
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot,{once:true});
  }else{
    boot();
  }
})();
