"use strict";
// ============================================================================
//  EMERGENCY STOP — the settings card for the global hotkey.
//  Lives in the "Konfiguracja" tab (`tab-ustawienia`), under the MCP card: both
//  are app-wide switches rather than anything belonging to one capsule. Until
//  2026-08-31 that tab was called "Zestawy i wymiana" and held the setup library
//  as well — the two were split apart precisely because a runaway output is not
//  something you should have to scroll past a preset list to stop.
//
//  The hotkey itself is NOT implemented here and cannot be: a page only sees keys while
//  it has focus, and the whole point is to stop a runaway output while a game is in front.
//  The hook lives in the server (PanicHotkey in ribbitflip_monitor.py). This card only
//  reads and writes the setting — and captures a new combination, which the browser is
//  genuinely the right place for.
//  Polish is authored here; English comes from the pairs below, merged into the global
//  I18N_EN BEFORE initI18n() runs (same contract as rf-39b-guides.js / rf-39c-mcp-ui.js).
// ============================================================================
const RF_HOTKEY_I18N={
 "Stop awaryjny (skrót klawiszowy)":"Emergency stop (hotkey)",
 "wyłącza wszystkie moduły naraz, także spod gry":"switches every module off at once, even from under a game",
 "Skrót awaryjny":"Emergency hotkey",
 "Kombinacja":"Combination",
 "Zmień skrót":"Change",
 "Domyślny":"Default",
 "Zapisz":"Save",
 "Anuluj":"Cancel",
 "Wyłącz wszystko teraz":"Switch everything off",
 "Sprawdź skrót":"Check the hotkey",
 "Włącz/wyłącz globalny skrót awaryjny":"Turn the global emergency hotkey on/off",
 "Naciśnij kombinację…":"Press the combination…",
 "Działa":"Working",
 "Wyłączony":"Off",
 "Niedostępny":"Unavailable",
 "Zapisano":"Saved",
 "Nie udało się zapisać skrótu":"Could not save the hotkey",
 "Wyłączono wszystkie moduły":"Every module switched off",
 "Prawy Alt (AltGr) pisze polskie znaki, więc nie może być częścią skrótu. Użyj lewego Alt.":"The right Alt (AltGr) writes Polish characters, so it cannot be part of a hotkey. Use the left Alt.",
 "Skrót musi mieć modyfikator (Ctrl / Alt / Shift / Win), bo bez niego zadziałałby podczas pisania.":"A hotkey needs a modifier (Ctrl / Alt / Shift / Win), because without one it would fire while you type.",
 "Do modyfikatorów dodaj jeszcze zwykły klawisz.":"Add an ordinary key to the modifiers.",
 "Tę kombinację obsługuje sam Windows, więc nigdy nie dotarłaby do aplikacji.":"Windows itself handles this combination, so it would never reach the app.",
 "Za dużo klawiszy (najwyżej 4).":"Too many keys (4 at most).",
 "Nieznany klawisz.":"Unknown key.",
 "Nic nie przechwycono.":"Nothing was captured.",
 "Inny program zarejestrował ten skrót w systemie i zareaguje na niego razem z RibbitFlipem.":"Another program has registered this hotkey system-wide and will react to it alongside RibbitFlip.",
 "To jest zarazem AltGr + litera, czyli sposób pisania polskiego znaku. RibbitFlip się nie pomyli (prawy Alt nigdy nie uruchamia skrótu), ale inne programy widzą wtedy Ctrl+Alt+literę.":"This is also AltGr + letter, which is how a Polish character is written. RibbitFlip will not confuse the two (the right Alt never fires a hotkey), but other programs do see Ctrl+Alt+letter then.",
 "Alt i jeden klawisz otwiera menu w wielu programach, więc aktywne okno też zareaguje.":"Alt plus one key opens menus in many programs, so the focused window will react as well.",
 "To codzienny skrót (kopiuj / wklej / zapisz). Lepiej go sobie nie zajmować.":"This is an everyday shortcut (copy / paste / save). Better not to take it away from yourself.",
 "Dwa klawisze łatwo trafić przypadkiem, trzy są bezpieczniejsze.":"Two keys are easy to hit by accident, three are safer.",
 "Skrót reaguje na LEWY Alt. Prawy (AltGr) jest zarezerwowany na polskie znaki i nigdy go nie uruchomi.":"The hotkey answers to the LEFT Alt. The right one (AltGr) is reserved for Polish characters and will never fire it.",
};
try{Object.assign(I18N_EN,RF_HOTKEY_I18N);}catch(e){}

let _hkState={enabled:false,combo:"alt+r+f",available:false,reason:"",blocked:"",check:null};
let _hkCapturing=false;
let _hkCandidate=null;

// --- browser key event -> the same token the server speaks -------------------
//  Deliberately e.code (physical key) and not e.key: with Alt held, e.key is often a dead
//  character or "Process", while e.code stays "KeyR". AltRight becomes its own token, which
//  the server then refuses — that refusal IS the feature, not an oversight.
function _hkToken(e){
  const c=e.code||"";
  if(c==="AltLeft")return "alt";
  if(c==="AltRight")return "altgr";
  if(c==="ControlLeft"||c==="ControlRight")return "ctrl";
  if(c==="ShiftLeft"||c==="ShiftRight")return "shift";
  if(c==="MetaLeft"||c==="MetaRight"||c==="OSLeft"||c==="OSRight")return "win";
  if(/^Key[A-Z]$/.test(c))return c.slice(3).toLowerCase();
  if(/^Digit[0-9]$/.test(c))return c.slice(5);
  if(/^F([1-9]|1[0-9]|2[0-4])$/.test(c))return c.toLowerCase();
  const named={Escape:"esc",Space:"space",Enter:"enter",Tab:"tab",Backspace:"backspace",
    Delete:"delete",Insert:"insert",Home:"home",End:"end",PageUp:"page_up",PageDown:"page_down",
    ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",Pause:"pause",
    ScrollLock:"scroll_lock"};
  return named[c]||null;
}
function _hkIsMod(t){return t==="ctrl"||t==="alt"||t==="shift"||t==="win"||t==="altgr";}
function _hkLabel(t){
  if(t==="win")return "Win";
  if(t==="altgr")return "AltGr";
  if(t==="page_up")return "PgUp";
  if(t==="page_down")return "PgDn";
  if(t==="scroll_lock")return "ScrLk";
  if(t.length===1)return t.toUpperCase();
  return t.charAt(0).toUpperCase()+t.slice(1);
}
function _hkChips(combo){
  return String(combo||"").split("+").filter(Boolean)
    .map(function(t){return '<kbd class="hk-key">'+miEsc(_hkLabel(t))+'</kbd>';}).join('<span class="hk-plus">+</span>');
}

// --- wording for the server's verdict codes ---------------------------------
//  The server answers with codes, never sentences (the app is bilingual and composes its own
//  wording — the same contract setup_requirements uses).
function _hkErrText(code){
  const m={altgr:_gl("Prawy Alt (AltGr) pisze polskie znaki, więc nie może być częścią skrótu. Użyj lewego Alt.","The right Alt (AltGr) writes Polish characters, so it cannot be part of a hotkey. Use the left Alt."),
    nomod:_gl("Skrót musi mieć modyfikator (Ctrl / Alt / Shift / Win), bo bez niego zadziałałby podczas pisania.","A hotkey needs a modifier (Ctrl / Alt / Shift / Win), because without one it would fire while you type."),
    nokey:_gl("Do modyfikatorów dodaj jeszcze zwykły klawisz.","Add an ordinary key to the modifiers."),
    reserved:_gl("Tę kombinację obsługuje sam Windows, więc nigdy nie dotarłaby do aplikacji.","Windows itself handles this combination, so it would never reach the app."),
    toomany:_gl("Za dużo klawiszy (najwyżej 4).","Too many keys (4 at most)."),
    unknown:_gl("Nieznany klawisz.","Unknown key."),
    empty:_gl("Nic nie przechwycono.","Nothing was captured.")};
  return m[code]||code||"";
}
function _hkWarnText(w){
  const c=(w&&w.code)||"";
  if(c==="taken")return _gl("Inny program zarejestrował ten skrót w systemie i zareaguje na niego razem z RibbitFlipem.","Another program has registered this hotkey system-wide and will react to it alongside RibbitFlip.");
  if(c==="altgrletter")return _gl("To jest zarazem AltGr + litera, czyli sposób pisania polskiego znaku. RibbitFlip się nie pomyli (prawy Alt nigdy nie uruchamia skrótu), ale inne programy widzą wtedy Ctrl+Alt+literę.","This is also AltGr + letter, which is how a Polish character is written. RibbitFlip will not confuse the two (the right Alt never fires a hotkey), but other programs do see Ctrl+Alt+letter then.");
  if(c==="menu")return _gl("Alt i jeden klawisz otwiera menu w wielu programach, więc aktywne okno też zareaguje.","Alt plus one key opens menus in many programs, so the focused window will react as well.");
  if(c==="common")return _gl("To codzienny skrót (kopiuj / wklej / zapisz). Lepiej go sobie nie zajmować.","This is an everyday shortcut (copy / paste / save). Better not to take it away from yourself.");
  if(c==="short")return _gl("Dwa klawisze łatwo trafić przypadkiem, trzy są bezpieczniejsze.","Two keys are easy to hit by accident, three are safer.");
  return c;
}

// Group name for the reminder shown when an output is switched on. Bilingual here rather than at
// the call sites, which pass a key: the switch in rf-12 / rf-16 / rf-31 knows which group it is,
// not how that group is worded in two languages.
// Two vocabularies meet here: the switches call themselves "mapping"/"motion", the server calls
// the same groups "rules"/"mouse" (that is what a setup file names them). One place to say what
// each is called in two languages, rather than four.
function rfGroupName(key){
  if(key==="mapping"||key==="rules")return _gl("Mapowanie","Mapping");
  if(key==="wheel")return _gl("Koło wyboru","Selection wheel");
  if(key==="motion"||key==="mouse")return _gl("Mysz i kontroler","Mouse & controller");
  if(key==="midi")return "MIDI";
  if(key==="osc")return "OSC";
  if(key==="pad"||key==="synth")return "Synth";
  if(key==="rest")return _gl("Usługi sieciowe","Network services");
  // Skaner doszedł do zestawów 2026-09-13. Bez tej linijki podgląd importu i biblioteka pisały
  // surowe „scan" tam, gdzie mówią, co zestaw wymieni i co jego autor miał włączone.
  if(key==="scan")return _gl("Skaner","Scanner");
  return "";
}

// One sentence about the way out, in the language of the panel and with the combination the user
// ACTUALLY has (it is configurable, so hard-coding Alt+R+F here would eventually be a lie). When
// the hotkey is off or the hook never went up, it says that instead of promising an escape that
// does not exist.
function rfHotkeyText(){
  const combo=rfHotkeyKeys();
  if(combo)
    return _gl("Wszystkie moduły wyłączysz w każdej chwili skrótem "+combo.join(" + ")+", nawet gdy na wierzchu jest gra.",
               "You can switch every module off at any time with "+combo.join(" + ")+", even with a game in front.");
  return _gl("Uwaga: stop awaryjny jest wyłączony, więc moduły wyłączysz tylko w panelu. Włączysz go na ekranie Konfiguracja.",
             "Note: the emergency stop is off, so the panel is the only way to switch the modules off. Switch it on in the Configuration screen.");
}

// The same thing as KEYS rather than as a sentence: ["Alt","R","F"], or null when there is no way
// out to name (hotkey off, or the hook never went up). A note that can show keycaps takes this and
// rfHotkeyLine(); anything that can only carry a string still uses rfHotkeyText() above.
function rfHotkeyKeys(){
  if(!(_hkState.enabled&&_hkState.available))return null;
  const keys=String(_hkState.combo||"").split("+").filter(Boolean).map(_hkLabel);
  return keys.length?keys:null;
}

/* DRUGI SKRÓT: ZAMKNIĘCIE OKNA SKANERA NAD PULPITEM — ["Shift","R","F"] albo null (2026-09-15).

   Wyłączenie nakładki na pulpicie i przejście na symulację jest pod Shift+R+F, a nie Alt+R+F,
   żeby nie wyzwalało wyłączania wszystkich modułów.
   To jest CZYNNOŚĆ CODZIENNA, nie awaria — dlatego osobny hak po stronie serwera
   (`SCANKEY`/`scan_overlay_stop` w monitorze) i osobna kombinacja, a stop awaryjny zostaje tym,
   czym był: jednym klawiszem, po którym nic już nie wychodzi z aplikacji.

   Stan przyjeżdża w podkluczu `scan` tej samej odpowiedzi `/hotkey`, więc karta skanera nie musi
   pytać drugi raz — i tak jak przy stopie: NIE OBIECUJEMY klawiszy, gdy skrót jest wyłączony albo
   hak nie wstał. Karta mówi wtedy o przycisku, który widać. */
function rfScanHotkeyKeys(){
  const s=_hkState&&_hkState.scan;
  if(!(s&&s.enabled&&s.available))return null;
  const keys=String(s.combo||"").split("+").filter(Boolean).map(_hkLabel);
  return keys.length?keys:null;
}

// Anywhere the app names the combination in running text carries an empty [data-hkcombo] slot
// instead of the keys themselves (today: the setups guide's "Stop awaryjny" heading). Filled from
// here so there is ONE place that knows the current combination — a hard-coded "Alt + R + F" in a
// guide becomes a lie the first time somebody changes it, and nothing would ever catch that.
// Re-run on every _hkRender(), i.e. after a fetch, after a change made anywhere, and after a
// language switch.
function rfHotkeyFillSpots(){
  const keys=rfHotkeyKeys();
  const txt=keys?(" ("+keys.join(" + ")+")"):(" ("+_gl("wyłączony","off")+")");
  document.querySelectorAll("[data-hkcombo]").forEach(function(e){e.textContent=txt;});
}

// The sentence WITHOUT the combination in it, for the callers that put the keycaps underneath.
// Two sentences rather than one with a hole in it: "…at any time, even with a game in front:" has
// to end by pointing down at the keys, and a slot in the middle of a sentence cannot do that.
function rfHotkeyLine(){
  if(!rfHotkeyKeys())return rfHotkeyText();
  return _gl("Wszystkie moduły wyłączysz w każdej chwili, nawet gdy na wierzchu jest gra:",
             "You can switch every module off at any time, even with a game in front:");
}

let _hkRemindAt=0,_hkRemindKey="";
// Called whenever an output module goes ON: the group-switch wrapper (rf-39f) for Mapping, Motion
// control, MIDI and OSC, and the switches themselves for the Synth (rf-23) and Uslugi sieciowe (rf-35),
// neither of which goes through that wrapper. The moment an output starts reaching the system is
// the moment the way out is worth knowing, and it is also the only moment somebody is looking at
// the switch.
//
// EVERY module gets its own reminder. It used to be one per 8 seconds, on the grounds that the
// skull is a singleton — but the skull queues notes (rf-06), and switching three modules on while
// hearing about the way out once left the other two feeling like they had none. The only thing
// still filtered is the SAME switch firing twice in a moment: a re-render or a double click is
// not a second module.
function rfHotkeyReminder(groupKey){
  try{
    const now=Date.now();
    if(String(groupKey||"")===_hkRemindKey&&now-_hkRemindAt<1500)return;
    _hkRemindKey=String(groupKey||"");_hkRemindAt=now;
    const g=rfGroupName(groupKey);
    const head=g?(_gl("Włączono: ","Switched on: ")+g+". "):"";
    // The way out is shown as keycaps under the sentence rather than spelled into it: this note
    // arrives at the moment an output starts reaching the system, and what the reader needs from
    // it is which keys to find, fast, possibly with a game already on top.
    if(typeof rfToast==="function")
      rfToast(head+rfHotkeyLine(),{tone:"danger",ms:7000,keys:rfHotkeyKeys()});
  }catch(e){}
}

function initHotkeyUi(){
  // The state is fetched even without the card: the reminder above needs the current combination,
  // and the cheat-sheet view (?view=overview) has no panels to hang a card on.
  _hkFetch();
  // Zakładka „Konfiguracja" (`tab-ustawienia`) — patrz komentarz przy initMcpUi (rf-39c).
  const panel=document.getElementById("tab-ustawienia");
  if(!panel||document.getElementById("hkCard"))return;
  const card=document.createElement("div");card.className="card";card.id="hkCard";
  // KOLEJNOŚĆ KARTY (UX 261120 L4c, piętra): na wierzchu to, czego człowiek szuka w nerwach:
  // czerwony „Wyłącz wszystko teraz” (jedyna akcja główna ekranu) i „Sprawdź skrót”. Kombinacja,
  // przełącznik skrótu i notki to piętro 2: zwijak „Skrót awaryjny”, w którego nagłówku stoi
  // kombinacja i stan („Alt + R + F · działa”), więc zwinięty nie chowa ani skrótu, ani awarii.
  card.innerHTML=
    '<div class="head"><h2><span class="rfic hd-ic hd-ic-stop" aria-hidden="true"></span>Stop awaryjny (skrót klawiszowy)</h2>'+
      '<span class="hint">wyłącza wszystkie moduły naraz, także spod gry</span></div>'+
    '<div class="setupbar mcpbar hk-acts">'+
      '<button class="btn danger rf-cta" id="hkPanicNow"><span class="hk-btnic" aria-hidden="true"></span>Wyłącz wszystko teraz</button>'+
      '<button class="btn" id="hkTest">Sprawdź skrót</button>'+
      '<span class="setupmsg" id="hkPanicMsg" role="status" aria-live="polite"></span></div>'+
    '<div class="hk-verdict" id="hkTestOut" role="status" aria-live="polite"></div>'+
    '<details class="cardfold inset hk-fold" id="hkFold"><summary>Skrót awaryjny</summary><div class="cardfold-body">'+
    '<div class="setupbar mcpbar hk-top">'+
      '<span class="setuplbl">Kombinacja</span>'+
      '<span class="hk-combo" id="hkCombo" aria-live="polite"></span>'+
      '<button class="btn sm" id="hkChange">Zmień skrót</button>'+
      '<button class="btn sm" id="hkDefault">Domyślny</button>'+
      '<button class="btn sm" id="hkSave" style="display:none">Zapisz</button>'+
      '<button class="btn sm" id="hkCancel" style="display:none">Anuluj</button>'+
    '</div>'+
    '<div class="hk-verdict" id="hkVerdict"></div>'+
    '<div class="setup-note">Skrót reaguje na LEWY Alt. Prawy (AltGr) jest zarezerwowany na polskie znaki i nigdy go nie uruchomi.</div>'+
    '<div class="ra-lead">Jeden skrót wyłącza wszystkie moduły naraz, także wtedy, gdy na wierzchu jest gra, a kursor ucieka. Trzymane klawisze zostają puszczone, pad wraca do środka, nuty gasną. Włączasz z powrotem sam, tymi samymi przełącznikami.</div>'+
    '<div class="setupbar mcpbar">'+
      '<span class="setuplbl">Skrót awaryjny</span>'+
      '<div class="rf-toggle" id="hkEnable" role="switch" aria-checked="false" tabindex="0" title="Włącz/wyłącz globalny skrót awaryjny">'+
        '<span class="rf-tg-lbl off">Wył.</span><span class="rf-tg-knob"></span><span class="rf-tg-lbl on">Wł.</span></div>'+
      '<span class="ra-pill" id="hkPill"></span>'+
      '<span class="setupmsg" id="hkMsg" role="status" aria-live="polite"></span>'+
    '</div>'+
    '<div class="setup-note hk-why" id="hkWhy" data-noi18n hidden></div>'+
    '<div class="setup-note">Klawisz kończący kombinację jest przechwytywany, więc nie uruchomi polecenia w aktywnym oknie. '+
      'Sprawdzenie mówi, czy naciśnięcie w ogóle dociera do aplikacji; inny program może je przechwytywać wcześniej.</div>'+
    '</div></details>';
  panel.appendChild(card);
  try{if(typeof rfTier==="function")_hkTierSync=rfTier(card.querySelector("#hkFold"),"ustawienia.skrot",{sum:_hkFoldSum,
    changed:function(){return (_hkState.combo&&_hkState.default&&_hkState.combo!==_hkState.default)?1:0;}});}catch(e){}
  card.querySelector("#hkEnable").addEventListener("click",_hkToggle);
  card.querySelector("#hkChange").addEventListener("click",_hkStartCapture);
  card.querySelector("#hkDefault").addEventListener("click",function(){
    _hkCommit(_hkState.default||"alt+r+f");});
  card.querySelector("#hkSave").addEventListener("click",function(){
    if(_hkCandidate)_hkCommit(_hkCandidate);});
  card.querySelector("#hkCancel").addEventListener("click",_hkStopCapture);
  card.querySelector("#hkPanicNow").addEventListener("click",_hkPanicNow);
  card.querySelector("#hkTest").addEventListener("click",_hkSelfTest);
}

// --- self-test ---------------------------------------------------------------
//  "It does not work" needs a first question nobody could answer so far: does the keypress reach
//  RibbitFlip AT ALL? A low-level keyboard hook is not exclusive — Windows asks the most recently
//  installed one first, and the one that fires swallows the key that completes the combination.
//  Anything installed after RibbitFlip (a second copy, an overlay, a macro tool) therefore takes
//  the panic key silently, and the notification the user sees comes from THAT program.
//  Measured on this app: two copies running, the newer took 3 of 3 presses, the older 0.
//
//  The window only WATCHES. The stop still fires if the combination lands — a panic key that
//  goes dead while you are checking it would be a worse bug than the one being diagnosed.
let _hkTestTimer=0;
function _hkTestOut(html,cls){
  const box=document.getElementById("hkTestOut");
  if(box)box.innerHTML=html?('<div class="'+(cls||"hk-warn")+'">'+html+"</div>"):"";
}
function _hkSelfTest(){
  if(!_hkState.enabled||!_hkState.available){
    _hkTestOut("⛔ "+_gl("Najpierw włącz skrót awaryjny. Wyłączonego nie ma czego sprawdzać.",
                        "Switch the emergency hotkey on first. There is nothing to check while it is off."),"hk-bad");
    return;
  }
  clearTimeout(_hkTestTimer);
  const combo=String(_hkState.combo||"").split("+").filter(Boolean).map(_hkLabel).join(" + ");
  fetch("/hotkey/test",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({seconds:12})}).then(function(r){return r.json();}).then(function(j){
    if(!j||!j.ok){_hkTestOut("⛔ "+_gl("Nie udało się rozpocząć sprawdzenia.","Could not start the check."),"hk-bad");return;}
    _hkTestPoll(combo);
  }).catch(function(){_hkTestOut("⛔ "+_gl("Nie udało się rozpocząć sprawdzenia.","Could not start the check."),"hk-bad");});
}
function _hkTestPoll(combo){
  fetch("/hotkey/test").then(function(r){return r.json();}).then(function(j){
    if(j&&j.hit){
      _hkTestOut("✅ "+_gl("Naciśnięcie dotarło do aplikacji, skrót działa. Jeśli któryś moduł był włączony, właśnie został wyłączony.",
                           "The keypress reached the app, so the hotkey works. Any module that was on has just been switched off."),"hk-ok");
      return;
    }
    if(j&&j.armed){
      const left=Math.ceil(j.remaining);
      _hkTestOut(miEsc(_gl("Naciśnij teraz "+combo+", czekam ("+left+" s)",
                           "Press "+combo+" now, waiting ("+left+" s)")),"hk-warn");
      _hkTestTimer=setTimeout(function(){_hkTestPoll(combo);},600);
      return;
    }
    // Window closed without the combination. WHICH of the two failures it was decides the advice,
    // and only the hook knows: it counts every keystroke it is handed, combination or not.
    if(j&&j.seenDuring>0)
      _hkTestOut("⛔ "+_gl("Aplikacja widziała w tym czasie inne klawisze, ale tej kombinacji nie dostała. Przechwytuje ją inny program: najczęściej druga kopia RibbitFlipa (także testowa, na innym porcie), nakładka do gry albo program od makr, uruchomiony PÓŹNIEJ niż RibbitFlip. Zamknij go i sprawdź jeszcze raz.",
                           "The app did see other keys in that window, but not this combination. Another program is intercepting it: usually a second copy of RibbitFlip (a test one on another port counts), a game overlay or a macro tool started AFTER RibbitFlip. Close it and check again."),"hk-bad");
    else
      _hkTestOut("⛔ "+_gl("W tym czasie aplikacja nie zobaczyła ani jednego klawisza. Jeśli nic nie zostało naciśnięte, sprawdź jeszcze raz. Jeśli klawisze były naciskane, to albo hak klawiatury nie wstał (pomaga ponowne uruchomienie RibbitFlipa), albo trafiły do okna uruchomionego jako administrator. Takich klawiszy zwykły program nie widzi.",
                           "The app saw no keystroke at all in that window. If nothing was pressed, just run the check again. If keys were pressed, then either the keyboard hook never went up (restarting RibbitFlip helps) or they went to a window running as administrator, and an ordinary program cannot see those."),"hk-bad");
  }).catch(function(){});
}

function _hkFetch(){
  fetch("/hotkey").then(function(r){return r.json();}).then(function(j){
    if(j&&j.ok){_hkState=j;_hkRender();}
  }).catch(function(){});
}

function _hkFlash(id,txt){
  const e=document.getElementById(id);if(!e)return;
  e.textContent=txt;clearTimeout(e._t);e._t=setTimeout(function(){e.textContent="";},3000);
}

let _hkTierSync=null;
// Nagłówek zwijaka „Skrót awaryjny”: kombinacja i stan z pigułki („Alt + R + F · działa”).
function _hkFoldSum(){
  const c=document.getElementById("hkCombo"),p=document.getElementById("hkPill");
  const combo=c?c.textContent.replace(/\s*\+\s*/g," + ").trim():"";
  return [combo,p?p.textContent.toLowerCase():""].filter(Boolean).join(" · ");
}
function _hkRender(){
  const combo=document.getElementById("hkCombo");
  if(combo)combo.innerHTML=_hkChips(_hkCapturing?(_hkCandidate||""):_hkState.combo);
  /* ⚠️ „NIEDOSTĘPNY" TO NIE TO SAMO, CO „WYŁĄCZONY" — ta jedna linijka o tym rozstrzyga.
     `available` znaczy „hak jest w tej chwili założony", a wyłączony skrót haka nie zakłada
     (`configure(enabled=False)` woła `stop()`), więc branie `!available` za niedostępność wygaszało
     WŁĄCZNIK i już się go nie dało włączyć z powrotem. Naprawdę martwa jest kopia z `blocked`
     (uruchomiona z --allow-multi — taka nigdy nie przejmuje haków, patrz `PanicHotkey._start`)
     oraz skrót WŁĄCZONY, któremu hak mimo to nie wstał. Ten sam warunek nosi karta zrzutu
     planszy skrótem (rf-50o `martwy`) — obie mają pozostać zgodne. */
  const tg=document.getElementById("hkEnable"),
        dead=!!_hkState.blocked||(!!_hkState.enabled&&!_hkState.available);
  if(tg){
    const armed=!!(_hkState.enabled&&_hkState.available);
    tg.classList.toggle("on",armed);
    tg.setAttribute("aria-checked",armed?"true":"false");
    // `.dis` = wygaszony i nieklikalny, ale WIDOCZNY (10-icons/06-connect) — ta sama klasa, którą
    // nosi przełącznik funkcji niedostępnej poza Windows. Klikanie go i tak niczego by nie uzbroiło.
    tg.classList.toggle("dis",dead);
    tg.setAttribute("aria-disabled",dead?"true":"false");
    tg.tabIndex=dead?-1:0;
  }
  const why=document.getElementById("hkWhy");
  if(why){
    why.hidden=!dead;
    why.textContent=dead
      ?(_gl("Skrót nie działa w tej kopii aplikacji: ","The hotkey does not work in this copy of the app: ")+
        (_hkState.reason||_hkState.blocked||
         _gl("hak klawiaturowy nie wstał.","the keyboard hook never went up.")))
      :"";
  }
  const pill=document.getElementById("hkPill");
  if(pill){
    const ok=_hkState.enabled&&_hkState.available;
    pill.textContent=ok?_gl("Działa","Working")
      :(_hkState.enabled?_gl("Niedostępny","Unavailable"):_gl("Wyłączony","Off"));
    pill.className="ra-pill"+(ok?" ok":(_hkState.enabled?" bad":""));
    pill.title=(!_hkState.available&&_hkState.reason)?_hkState.reason:"";
  }
  _hkRenderVerdict(_hkState.check);
  try{if(_hkTierSync)_hkTierSync();}catch(e){}
  rfHotkeyFillSpots();      // the guide heading quotes the combination — keep it honest
  // The master switch in the top bar names the combination in its tooltip (rf-12
  // `rfArmTipSync`). It is repainted from here rather than from setArmed alone, because the
  // combination can change with the switch untouched — after /hotkey, after „Zmień skrót" /
  // „Domyślny", and after a language switch (hkRelang → _hkRender). Guarded: rf-12 may not be
  // loaded in the harnesses that run this file on its own.
  if(typeof rfArmTipSync==="function")try{rfArmTipSync();}catch(e){}
}

function _hkRenderVerdict(chk){
  const box=document.getElementById("hkVerdict");
  if(!box)return;
  box.innerHTML="";
  if(!chk)return;
  if(!chk.ok){
    const d=document.createElement("div");d.className="hk-bad";
    d.textContent="⛔ "+_hkErrText(chk.error)+(chk.badToken?" ("+chk.badToken+")":"");
    box.appendChild(d);return;
  }
  const warns=chk.warnings||[];
  if(!warns.length){
    const d=document.createElement("div");d.className="hk-ok";
    d.textContent="✅ "+_gl("Wolna kombinacja, nic innego jej nie używa.","Free combination, nothing else uses it.");
    box.appendChild(d);return;
  }
  for(const w of warns){
    const d=document.createElement("div");d.className="hk-warn";
    d.textContent="⚠ "+_hkWarnText(w)+((w.keys&&w.keys.length)?" ("+w.keys.join(", ")+")":"");
    box.appendChild(d);
  }
}

// The pill and the verdict are composed with _gl() AT RENDER TIME (they are built from server
// codes, not authored as Polish text), so the DOM walker cannot turn them around on its own -
// it only ever translates Polish originals into English. setLang calls this, exactly as it
// does for the MIDI list and the axis panel, which compose their text the same way.
function hkRelang(){try{_hkRender();}catch(e){}}

// --- capture ----------------------------------------------------------------
//  Held keys are collected while they go DOWN, and the set is taken when the first one comes
//  back UP: that way "Alt+R+F" is read as three keys rather than as whatever happened to be
//  pressed last. preventDefault keeps the browser out of it — though a few combinations
//  (Ctrl+W, F5 in some browsers) the page never gets to see at all.
let _hkHeld=[];
// `_hkFresh` = wszystkie klawisze puszczone, więc następne naciśnięcie zaczyna NOWĄ kombinację.
// `_hkChecked` pilnuje, żeby jedna kombinacja poszła do serwera raz, a nie przy każdym z trzech
// puszczonych klawiszy.
let _hkFresh=true,_hkChecked="";
function _hkStartCapture(){
  if(_hkCapturing)return;
  _hkCapturing=true;_hkHeld=[];_hkCandidate=null;_hkFresh=true;_hkChecked="";
  document.getElementById("hkChange").style.display="none";
  document.getElementById("hkDefault").style.display="none";
  document.getElementById("hkSave").style.display="";
  document.getElementById("hkCancel").style.display="";
  document.getElementById("hkSave").disabled=true;
  const combo=document.getElementById("hkCombo");
  if(combo)combo.innerHTML='<span class="hk-capturing">'+miEsc(_gl("Naciśnij kombinację…","Press the combination…"))+'</span>';
  _hkFlash("hkMsg",_gl("Naciśnij kombinację i puść klawisze. Możesz próbować dalej: „Zapisz” zapisuje, Esc anuluje.",
                       "Press the combination and let the keys go. You can keep trying: “Zapisz” saves it, Esc cancels."));
  window.addEventListener("keydown",_hkKeyDown,true);
  window.addEventListener("keyup",_hkKeyUp,true);
}
function _hkStopCapture(){
  _hkCapturing=false;_hkHeld=[];_hkCandidate=null;_hkFresh=true;_hkChecked="";
  window.removeEventListener("keydown",_hkKeyDown,true);
  window.removeEventListener("keyup",_hkKeyUp,true);
  const ch=document.getElementById("hkChange");if(ch)ch.style.display="";
  const df=document.getElementById("hkDefault");if(df)df.style.display="";
  const sv=document.getElementById("hkSave");if(sv)sv.style.display="none";
  const cn=document.getElementById("hkCancel");if(cn)cn.style.display="none";
  _hkRender();
}
function _hkKeyDown(e){
  if(!_hkCapturing)return;
  e.preventDefault();e.stopPropagation();
  if(e.code==="Escape"){_hkStopCapture();return;}
  const t=_hkToken(e);
  if(!t)return;
  if(_hkFresh){_hkHeld=[];_hkCandidate=null;_hkFresh=false;}
  if(_hkHeld.indexOf(t)<0&&_hkHeld.length<4)_hkHeld.push(t);
  const mods=_hkHeld.filter(_hkIsMod),keys=_hkHeld.filter(function(x){return !_hkIsMod(x);});
  _hkCandidate=mods.concat(keys).join("+");
  const combo=document.getElementById("hkCombo");
  if(combo)combo.innerHTML=_hkChips(_hkCandidate);
}
function _hkKeyUp(e){
  if(!_hkCapturing)return;
  e.preventDefault();e.stopPropagation();
  _hkFresh=true;                       // od tej chwili następne naciśnięcie zaczyna od zera
  if(!_hkCandidate||_hkChecked===_hkCandidate)return;
  _hkChecked=_hkCandidate;
  // Sam klawisz, bez modyfikatora, przechodził przez to okno bez słowa. Serwer i tak by go odrzucił,
  // ale dopiero przy zapisie — a odpowiedź na „nacisnąłem A i nic się nie stało" należy do chwili,
  // w której to A zostało naciśnięte.
  if(!String(_hkCandidate).split("+").some(_hkIsMod)){
    _hkRenderVerdict({ok:false,error:"nomod"});
    const sv0=document.getElementById("hkSave");
    if(sv0)sv0.disabled=true;
    return;
  }
  // Ask the server what it thinks BEFORE anything is saved: it is the side that knows what
  // Windows already owns, so the verdict has to come from there.
  fetch("/hotkey/check",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({combo:_hkCandidate})}).then(function(r){return r.json();})
    .then(function(j){
      const chk=(j&&j.check)||null;
      _hkRenderVerdict(chk);
      const sv=document.getElementById("hkSave");
      if(sv)sv.disabled=!(chk&&chk.ok);
    }).catch(function(){});
}

// --- writes -----------------------------------------------------------------
function _hkCommit(combo){
  _hkPost({enabled:true,combo:combo});
}
function _hkToggle(){
  // Odmawiamy TYLKO w kopii testowej (--allow-multi), bo tylko ona nigdy nie założy haka.
  // Wyłączony skrót też raportuje `available:false` — to normalny stan, a nie powód, żeby
  // nie dać go włączyć (patrz komentarz przy `dead` w _hkRender).
  if(_hkState.blocked){
    _hkFlash("hkMsg",_gl("Nie ma czego włączyć: skrót jest w tej kopii niedostępny.",
                         "Nothing to switch on: the hotkey is unavailable in this copy."));
    return;
  }
  _hkPost({enabled:!_hkState.enabled});
}
function _hkPost(body){
  fetch("/hotkey",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)}).then(function(r){return r.json();}).then(function(j){
    if(!j||!j.ok){
      _hkRenderVerdict({ok:false,error:(j&&j.error)||"empty",badToken:j&&j.badToken});
      _hkFlash("hkMsg",_gl("Nie udało się zapisać skrótu","Could not save the hotkey"));
      return;
    }
    _hkState=j;_hkCapturing=false;_hkCandidate=null;
    _hkStopCapture();
    _hkFlash("hkMsg",_gl("Zapisano","Saved"));
  }).catch(function(){_hkFlash("hkMsg",_gl("Nie udało się zapisać skrótu","Could not save the hotkey"));});
}
function _hkPanicNow(){
  fetch("/panic",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({source:"panel"})}).then(function(r){return r.json();}).then(function(){
    _hkFlash("hkPanicMsg",_gl("Wyłączono wszystkie moduły","Every module switched off"));
  }).catch(function(){});
}

// The settings changed somewhere (this window or another one). Re-read the whole state rather
// than patching the cached copy: the event carries the setting, not the machine's verdict on it,
// and the card shows both.
function rfOnHotkeyCfg(m){try{_hkFetch();}catch(e){}}

// The stop can also come from the hotkey, i.e. from outside this page entirely — the server
// says so on the stream so the panel explains the sudden silence instead of leaving the user
// wondering why every capsule went quiet.
function rfOnPanic(m){
  // Two modules the server cannot switch off on its own, for opposite reasons — both halves are
  // carried out here. The Synth's audio is built and played HERE, in the browser; the REST
  // module's sending half is here too (the server only owns the file its switch lives in).
  try{ if(typeof padSetEnabled==="function")padSetEnabled(false); }catch(e){}
  try{ if(typeof killAllAudio==="function")killAllAudio(); }catch(e){}   // also kills anything hanging
  try{
    if(window.RESTAPI&&RESTAPI.cfg&&RESTAPI.cfg.enabled){
      RESTAPI.cfg.enabled=false;                    // the server already wrote the file: no re-save
      if(typeof _raRenderHeader==="function")_raRenderHeader();
    }
  }catch(e){}
  // MIDI and OSC the server DID switch off — but onMidiCfg deliberately ignores enabled/oscEnabled
  // coming back on the stream, so that a mapping POST's echo cannot revert a fresh click on the
  // toggle. A stop is not an echo, so it is applied here instead. Without this the panel keeps
  // both switches lit after the hotkey, and the next mapping edit posts enabled:true straight
  // back — re-arming the two modules the user just cut.
  try{
    if(typeof state!=="undefined"&&state&&state.midi){
      state.midi.enabled=false;state.midi.oscEnabled=false;
      if(typeof miReflectEnable==="function")miReflectEnable();
    }
  }catch(e){}
  // SKANER — od 15.09 stop gasi też jego (serwer) i zamyka okno nad pulpitem. Karta trzyma
  // włącznik u siebie, więc bez tego świeciłby dalej na „On" nad wyłączonym modułem — i przy
  // następnym zapisie pokrętła odesłałby `enabled:true`, czyli uzbroił z powrotem to, co
  // człowiek właśnie ściął (ta sama pułapka, co z MIDI/OSC wyżej).
  try{ if(typeof scanReflectEnabled==="function")scanReflectEnabled(false); }catch(e){}
  // KOŁO WYBORU — od 16.10 stop gasi i jego. Karta też trzyma włącznik u siebie (state.wheel),
  // a postWheel odsyła cały stan, więc bez tego pierwsza edycja wycinka po stopie wysłałaby
  // `enabled:true` i uzbroiła koło z powrotem.
  try{
    if(typeof state!=="undefined"&&state&&state.wheel&&state.wheel.enabled){
      state.wheel.enabled=false;
      if(typeof whSync==="function")whSync();
    }
  }catch(e){}
  try{ if(typeof updateTabDots==="function")updateTabDots(); }catch(e){}
  try{
    // The combination is named only when the event carries one. A stop that came from the hook
    // without one (an API caller, an older server) used to render as "skrótem )".
    // When it IS named, it goes under the sentence as keycaps rather than into it: the same shape
    // the reminder teaches, so "these are the keys that just did it" and "these are the keys that
    // will do it" are visibly the same thing.
    const keys=(m&&m.source==="hotkey")
      ? String((m&&m.combo)||"").split("+").filter(Boolean).map(_hkLabel) : [];
    // DROGA POWROTNA W TYM SAMYM ZDANIU, bo pierwsze pytanie po stopie brzmi „jak to włączyć
    // z powrotem". Serwer (`panic_stop`) wyłącza przełączniki modułów i NIE rusza głównego
    // włącznika ⏻, więc droga powrotna to te same przełączniki modułów. Odesłanie do ⏻ było
    // błędne: ⏻ dalej stoi na „Uzbrojone", a klik w niego wstrzymuje całą aplikację.
    const body=_gl(": wszystkie moduły wyłączone. Włączysz je z powrotem tymi samymi przełącznikami modułów.",
                   ": every module switched off. Switch them back on with the same module switches.");
    // With the keycaps underneath, "(skrótem)" on its own is a parenthesis with nothing in it —
    // the sentence hands over to the keys instead.
    const msg=keys.length
      ? _gl("Stop awaryjny","Emergency stop")+body+" "+_gl("Zadziałał skrót:","It came from:")
      : _gl("Stop awaryjny (","Emergency stop (")
        +((m&&m.source==="hotkey")?_gl("skrótem","with the hotkey"):_gl("z panelu","from the panel"))
        +")"+body;
    if(typeof rfToast==="function")
      rfToast(msg,{tone:"danger",ms:6000,keys:keys.length?keys:null});
    _hkFlash("hkPanicMsg",_gl("Wyłączono wszystkie moduły","Every module switched off"));
  }catch(e){}
}
