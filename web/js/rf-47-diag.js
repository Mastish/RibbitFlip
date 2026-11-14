"use strict";
// ============================================================================
//  "ZGŁOŚ PROBLEM" — the door, and the bundle behind it.
//
//  This file owns three small things: the diagnostic bundle (build it, show it
//  in the folder, remember what came back), the card in the Library tab, and
//  the button in the footer. The WINDOW those two open — the bundle button and
//  the two places a problem can be reported — lives in rf-47b.
//
//  There is no third file any more. rf-47a composed a ready-made forum post out
//  of five answers and a tag picker; the window that asked for them is gone
//  (see the header of rf-47b), and with it the only reader that file ever had.
//
//  WHY THE FOOTER. The card used to be the only way in, and it sat at the
//  bottom of one tab out of eleven — so the feature was hardest to find for
//  exactly the person who needs it, somebody whose app is misbehaving in a
//  completely different tab. The footer sits OUTSIDE the tab panels, so one
//  button is on every page at once.
//
//  Nothing here sends anything anywhere. That is DELIBERATE and it is the whole
//  design of this feature:
//
//    * a post has to come from the USER'S account, or the answer lands in a
//      thread they cannot see, cannot correct and cannot mark as solved;
//    * a webhook baked into the .exe cannot be rotated — the day it is abused,
//      every copy of the app in the world is holding a dead (or worse, hijacked)
//      address, and there is no way to take it back.
//
//  So the app does the part it is uniquely good at (collecting facts, hiding
//  secrets, composing the post) and hands the click to the person.
//
//  Polish is authored here; English comes from the pairs below, merged into the
//  global I18N_EN BEFORE initI18n() runs (same contract as rf-39b-guides.js /
//  rf-39c-mcp-ui.js). Everything composed at paint time goes through _gl() and is
//  repainted by dgRelang() on a language switch.
// ============================================================================
const RF_DIAG_I18N={
 "Zgłoś problem":"Report a problem",
 "paczka diagnostyczna i dwa miejsca, w których można to zgłosić":"a diagnostic bundle and two places to report it",
 "Zbuduj paczkę diagnostyczną z wersją, ustawieniami i dziennikiem aplikacji, bez haseł i bez sejfu. Potem opisz problem na forum pomocy albo na GitHubie.":"Build a diagnostic bundle with the version, the settings and the app log, with no passwords and no vault. Then describe the problem on the help forum or on GitHub.",
 "Paczka powstaje u Ciebie na dysku i nic nie wychodzi z komputera samo. Wpis wysyłasz sam, ze swojego konta, żeby odpowiedź trafiła do Ciebie, a wątek został dla następnej osoby z tym samym problemem.":"The bundle is built on your own disk and nothing leaves the computer by itself. You send the post yourself, from your own account, so the answer reaches you and the thread stays for the next person with the same problem.",
 // --- okno (rf-47b) --------------------------------------------------------
 "Aplikacja nic nie wysyła sama. Zbuduj paczkę diagnostyczną, a potem opisz problem tam, gdzie Ci wygodniej, i dołącz do wpisu plik .zip.":"The app sends nothing by itself. Build the diagnostic bundle, then describe the problem wherever suits you, and attach the .zip to your post.",
 "Zbuduj paczkę diagnostyczną.":"Build the diagnostic bundle.",
 "Zbuduj paczkę":"Build the bundle",
 "Pokaż w folderze":"Show in folder",
 "jeszcze nie zbudowana":"not built yet",
 "Buduję…":"Building…",
 "Gotowe":"Done",
 "Nie udało się zbudować paczki":"Could not build the bundle",
 "Nie udało się otworzyć folderu":"Could not open the folder",
 "Co dokładnie jest w paczce":"Exactly what is in the bundle",
 "Napisz, co się dzieje, czego się spodziewasz i kiedy to występuje:":"Say what happens, what you expected instead and when it happens:",
 "Paczka powstaje u Ciebie na dysku. Wpis wysyłasz sam, ze swojego konta.":"The bundle is built on your own disk. You send the post yourself, from your own account.",
 "Zamknij":"Close",
};
try{Object.assign(I18N_EN,RF_DIAG_I18N);}catch(e){}   // i18n module may be absent in the cheat-sheet view

// Last bundle built in this session: {name, sizeKB, files}. Null until the button is used —
// nothing about the bundle is guessed client-side, exactly as with the MCP card.
//
// The version, the mode and the number of connected capsules used to be fetched here too (/health
// and /mode), because the composed post quoted them in its opening lines. Nobody quotes them any
// more: the same facts travel in `raport.json` inside the zip, where they came from in the first
// place, and asking the server for a second copy of them was one more thing to go wrong on a
// machine that is already misbehaving.
let _dgLast=null;

// --- what the window reads ----------------------------------------------------------------------
function rfDiagBundle(){return _dgLast;}

// --- the bundle ---------------------------------------------------------------------------------
// Returns a promise of {ok, error}. The caller owns the message and the button state, because the
// same build is offered from a wizard step and (potentially) from anywhere else.
function rfDiagBuild(){
  return fetch("/diag/report",{method:"POST",headers:{"Content-Type":"application/json"},
                               body:JSON.stringify({})})
    .then(r=>r.json()).then(function(j){
      if(!j||!j.ok)return {ok:false,error:(j&&j.error)||""};
      _dgLast={name:j.name||"",sizeKB:j.sizeKB||0,files:Array.isArray(j.files)?j.files:[]};
      return {ok:true};
    }).catch(function(){return {ok:false,error:""};});
}

function rfDiagShowFolder(){
  return fetch("/diag/open",{method:"POST",headers:{"Content-Type":"application/json"},
                             body:JSON.stringify({})})
    .then(r=>r.json()).then(function(j){return !!(j&&j.ok);})
    .catch(function(){return false;});
}

// --- the card in the „Konfiguracja" tab (`tab-ustawienia`) ---------------------------------------
// A short introduction and ONE button, exactly like „Wymiana" two cards up. Everything this card
// used to do itself — three bars, two fields, a file list — lives in the window behind the button.
function initDiagUi(){
  const panel=document.getElementById("tab-ustawienia");
  if(panel&&!document.getElementById("diagCard")){   // no panels in the ?view=overview cheat sheet
    const card=document.createElement("div");card.className="card";card.id="diagCard";
    card.innerHTML=
      '<div class="head"><h2><span class="rfic hd-ic hd-ic-dangerfrog" aria-hidden="true"></span>Zgłoś problem</h2>'+
        '<span class="hint">paczka diagnostyczna i dwa miejsca, w których można to zgłosić</span></div>'+
      '<div class="ra-lead">Zbuduj paczkę diagnostyczną z wersją, ustawieniami i dziennikiem aplikacji, bez haseł i bez sejfu. Potem opisz problem na forum pomocy albo na GitHubie.</div>'+
      '<div class="setupbar mcpbar">'+
        '<button class="btn sm" id="dgStart">Zgłoś problem</button>'+
      '</div>'+
      '<div class="setup-note">Paczka powstaje u Ciebie na dysku i nic nie wychodzi z komputera samo. Wpis wysyłasz sam, ze swojego konta, żeby odpowiedź trafiła do Ciebie, a wątek został dla następnej osoby z tym samym problemem.</div>';
    panel.appendChild(card);
    const s=card.querySelector("#dgStart");
    if(s)s.addEventListener("click",function(){if(typeof rfDiagOpen==="function")rfDiagOpen();});
  }
  // The footer button. Static markup (so it is there before this script runs and gets translated by
  // the ordinary walker); all this does is give it its errand.
  const f=document.getElementById("dgFootBtn");
  if(f&&!f._wired){
    f._wired=true;
    f.addEventListener("click",function(){if(typeof rfDiagOpen==="function")rfDiagOpen();});
  }
}

// Language switch: the card and the footer are plain markup and the walker handles them; the window
// repaints the few lines it composes at paint time (channel names, file counts).
function dgRelang(){
  if(typeof rfDiagWizRelang==="function")rfDiagWizRelang();
}
