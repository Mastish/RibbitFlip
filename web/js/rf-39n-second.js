"use strict";
// ============================================================================
//  "YOU ALREADY HAVE ONE" — the answer to launching RibbitFlip a second time.
//
//  The refusal happens in the server (SingleInstance in ribbitflip_monitor.py); it cannot happen
//  here, because the second copy has no panel to speak from — it exits before it has a port. What
//  it does instead is open THIS panel, the running one's, with ?second=1, and this file is what
//  turns that into a sentence: the second launch did something visible and said why, rather than
//  looking like a double-click that landed on nothing.
//
//  A dialog rather than the skull's toast: the reader just tried to start a program and it did not
//  start. That deserves being asked to click "OK", not a note that fades on its own.
// ============================================================================
const RF_SECOND_I18N={
 "RibbitFlip już działa":"RibbitFlip is already running",
 "To jest panel tej kopii, która działała wcześniej. Druga nie wystartowała, bo dwie naraz walczyłyby o ten sam kapsel i klawiaturę.\n\nObie zakładają hak na klawiaturę i chcą tego samego kapsla i portu. Panel pokazywałby wtedy jedną kopię, a wysyłałaby druga: stop awaryjny gasiłby moduły tylko w tej, do której trafi.":"This is the panel of the copy that was already running. The second one did not start, because two at once would fight over the same capsule and keyboard.\n\nBoth hook the keyboard and want the same capsule and port. The panel would then show one copy while the other did the sending: the emergency stop would switch the modules off only in the one it reaches.",
 "Jasne":"Got it",
};
try{Object.assign(I18N_EN,RF_SECOND_I18N);}catch(e){}

(function(){
  function _strip(){
    // Take ?second=1 out of the address without touching anything else in it (?view=overview and
    // friends have to survive), so a refresh does not repeat the news.
    try{
      const u=new URL(location.href);
      if(!u.searchParams.has("second"))return false;
      u.searchParams.delete("second");
      history.replaceState({},"",u.pathname+(u.searchParams.toString()?("?"+u.searchParams):"")+u.hash);
      return true;
    }catch(e){ return /[?&]second=1/.test(location.search); }
  }
  if(!/[?&]second=1/.test(location.search))return;
  _strip();
  // After the panel has painted: this is news about the launch, not about the capsule, and it
  // should not be the first thing on screen before the app itself is there to be seen.
  window.addEventListener("load",function(){
    setTimeout(function(){
      if(typeof rfModal!=="function")return;
      rfModal({
        title:"RibbitFlip już działa",
        message:"To jest panel tej kopii, która działała wcześniej. Druga nie wystartowała, bo dwie naraz walczyłyby o ten sam kapsel i klawiaturę.\n\nObie zakładają hak na klawiaturę i chcą tego samego kapsla i portu. Panel pokazywałby wtedy jedną kopię, a wysyłałaby druga: stop awaryjny gasiłby moduły tylko w tej, do której trafi.",
        icon:'<span class="rfm-dfrog"></span>',
        tone:"danger rfm-bigicon simnote",           // simnote = the body keeps its line breaks
        actions:[{label:"Jasne",value:true,variant:"primary"}]
      });
    },700);
  });
})();
