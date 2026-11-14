"use strict";
// ============================================================================
//  THE CONTROLLER TAB, RIGHT COLUMN — the part you clicked, and its editing.
//
//  The tab is pad-centric (rf-44 owns the strip of pads and the one merged
//  drawing on the left). This file owns everything to the RIGHT of the map:
//
//    * THE PART PANEL — click a part of the drawing and the column becomes
//      that part: a stick or the d-pad opens the motion settings, any other
//      button opens the mappings that press it. `state._padPart` is the whole
//      of the selection, and this file is the ONLY owner of what is visible
//      inside the column — mFill (rf-15) fills values and calls padPartSync
//      last. Two owners of one `display` is a fight the later writer wins at
//      random.
//
//      A click FINISHES the thought instead of only selecting (padPartClick):
//      an unmapped button starts a rule aimed at it, a button with exactly one
//      mapping opens that mapping, a part already open closes again. The
//      drawing says which is which before the click — a part nobody mapped
//      grows a green plus under the pointer, a mapped one brightens.
//
//    * THE FOREIGN PART — with two capsules on one pad, the clicked part may
//      be driven by the capsule that is NOT being edited. Its numbers belong
//      to THAT capsule, and showing the active capsule's fields under its name
//      would show the right controls holding the wrong values. The column then
//      says whose part it is and offers the one honest action: switch.
//
//    * THE SPIS — with nothing selected, the column answers "what have I
//      mapped at all": the active capsule's pad rules as a filtered VIEW of
//      `state.rules` (same rule objects, same row builder _ruleRow, same
//      editor — openEditor is wrapped here so a pad rule opens its editor
//      inside this tab), and underneath the OTHER member capsules' pad rules
//      as quieter rows, because _ruleRow stamps `rule-<id>` element ids and a
//      document cannot carry one id twice.
//
//  The group switch is a MIRROR of #trigEnable, not a second flag — pad
//  buttons leave the app through the Mapping group like every other rule.
// ============================================================================

const RF_PADCTL_I18N={
 // — the card and its sections (static text in the HTML)
 "Mysz":"Mouse",
 "ruch kapsla steruje kursorem Windows":"capsule motion drives the Windows cursor",
 "Ruch kapsla steruje kursorem Windows. Kapsel ma jeden tryb ruchu naraz, więc włączenie myszy wyłącza ruch na ekranie Kontroler.":"Capsule motion drives the Windows cursor. A capsule has one motion mode at a time, so switching the mouse on switches the motion on the Controller screen off.",
 "🔀 Tryb przełącza się automatycznie wg pozycji (reguła na ekranie Kontroler)":
   "🔀 The mode switches itself by position (the rule is on the Controller screen)",
 "Źródło — oś kapsla":"Source — capsule axis",
 "Ruch kapsla steruje wirtualnym padem: drążkiem albo krzyżakiem. Kapsel ma jeden tryb ruchu naraz, więc włączenie tego wyłącza ruch na ekranie Mysz.":"Capsule motion drives the virtual pad: the stick or the d-pad. A capsule has one motion mode at a time, so switching this on switches the motion in the Mouse screen off.",
 "Kontrolery":"Controllers",
 "utwórz wirtualny kontroler i przypnij do niego kapsel":
   "create a virtual controller and plug a capsule into it",
 // the second section's head; rf-44 _padCfgHeadSync rewrites it on render, this key covers the
 // static HTML before the first render
 "Kliknij gałkę, krzyżak albo przycisk na rysunku, żeby go ustawić.":
   "Click a stick, the d-pad or a button on the drawing to set it up.",
 // — the part panel (static text in the HTML)
 "Lewy drążek":"Left stick",
 "Napędzaj ruchem kapsla":"Drive this with the capsule's motion",
 "Ruch kapsla zacznie napędzać tę część pada. Przejmie go myszy albo drugiej połówce ruchu, bo kapsel ma jeden tryb ruchu naraz.":"The capsule's motion will start driving this part of the pad. It takes the motion away from the mouse or from the other half, because a capsule has one motion mode at a time.",
 "⏹ Zatrzymaj":"⏹ Stop",
 "Ruch przestaje napędzać tę część pada (wyłącza grupę ruchu). Ustawienia zostają.":
   "The motion stops driving this part of the pad (it switches the motion group off). The settings stay.",
 "Mapowanie to jeden warunek z kapsla, na przykład pochylenie albo jego przycisk, który wciska ten przycisk pada.":
   "A mapping is one condition on the capsule, a tilt or one of its buttons, that presses this pad button.",
 "Nowe mapowanie przycisku":"New button mapping",
 "Przyciski pada wychodzą razem z ruchem, a włącznik modułu stoi na górze ekranu.":
   "Pad buttons go out together with motion, and the module switch is at the top of the screen.",
 "włącznik grupy Mapowanie (ten sam, co na ekranie Mapowanie)":
   "the Mapping group's switch (the same one as on the Mapping screen)",
 "To lustro włącznika grupy „Mapowanie” — ten sam, co na ekranie Mapowanie. Przyciski pada wychodzą tą samą drogą co klawisze, więc mają jeden wspólny wyłącznik.":
   "A mirror of the “Mapping” group's switch — the same one as on the Mapping screen. Pad buttons leave the app the same way keys do, so they share one switch.",
 "Ustawienia tej części należą do tamtego kapsla. Przełącz się na niego, aby je dostroić.":
   "The settings of this part belong to that capsule. Switch to it to tune them.",
 "Przełącz":"Switch",
 // — written from JS
 "○ nieaktywny":"○ idle",
 "Ten kontroler nie ma jeszcze mapowań przycisków.":"This controller has no button mappings yet.",
 "Mapowania przycisków kontrolera są na ekranie Kontroler.":
   "Controller-button mappings live on the Controller screen.",
 // — the part panel, written from JS. Sentences that carry a capsule NAME are composed with _gl()
 // and are deliberately not keys: no dictionary can hold a name somebody typed. They come out right
 // because setLang() re-runs padCtlRender(), which repaints the column in the new language.
 "wszystkie mapowania tego pada":
   "every mapping on this pad",
 "Mapowania pada":"Pad mappings",
 "Prawy drążek":"Right stick",
 "Krzyżak":"D-pad",
 "ruch kapsla jako drążek analogowy":"capsule motion as an analog stick",
 "ruch kapsla jako kierunki krzyżaka":"capsule motion as d-pad directions",
 "co go wciska":"what presses it",
 "Ruch kapsla steruje tą częścią pada.":"The capsule's motion is driving this part of the pad.",
 "Ta część jest ustawiona na ruch kapsla, ale włącznik w nagłówku karty jest wyłączony.":"This part is set to the capsule's motion, but the switch in the card header is off.",
 // RUCH ZAPARKOWANY — moduł na On, przyciski jadą, drążek stoi. Dwa zdania, bo „ta część" i
 // „żadna część" to dla patrzącego dwie różne odpowiedzi na pytanie „to gdzie poszedł ten ruch?".
 "Moduł jest włączony i przyciski pada działają, ale ruch kapsla jest zaparkowany.":
   "The module is on and the pad buttons work, but the capsule's motion is parked.",
 "Ruch kapsla jest zaparkowany — nie prowadzi teraz żadnej części pada.":
   "The capsule's motion is parked — it is driving no part of the pad right now.",
 "Ruch kapsla steruje teraz czym innym.":"The capsule's motion is driving something else right now.",
 "Co wciska ten przycisk":"What presses this button",
 "Mapowania na klik drążkiem":"Mappings on a stick click",
 "Mapowania na kierunki krzyżaka":"Mappings on the d-pad directions",
 "Nowe mapowanie na ten przycisk":"New mapping on this button",
 "Mapowanie na klik drążkiem":"Mapping on a stick click",
 "Mapowanie na kierunek krzyżaka":"Mapping on a d-pad direction",
 "Nic jeszcze nie wciska tej części pada. Dodaj mapowanie przyciskiem obok.":
   "Nothing presses this part of the pad yet. Add a mapping with the button next to it.",
 "Edytuj":"Edit",
 // NOTE: „Przycisk A" (the heading of a button part) is _gl("Przycisk ","Button ")+gpvLabel(b) and
 // has no key on purpose — the second half is the pad's own lettering, which is the same in both
 // languages, and a dictionary of seventeen half-sentences would rot the first time one changed.
};
try{Object.assign(I18N_EN,RF_PADCTL_I18N);}catch(e){}

// ---------------------------------------------------------------------------
//  THE PAD-BUTTON RULE LIST (the active capsule's half of the spis)
// ---------------------------------------------------------------------------
// Called by renderRules (rf-10) with the pad half of state.rules already filtered out, so the two
// lists can never disagree about which rule belongs where.
function padRulesRender(padRules){
  const list=document.getElementById("padRulesList"); if(!list)return;
  const rules=padRules||[];
  if(!rules.length){
    // Just the fact: "+ Nowe mapowanie przycisku" stands right above, so a second button or an
    // instruction to click it would only repeat it.
    list.innerHTML='<div class="rules-empty">'+
      esc(_gl("Ten kontroler nie ma jeszcze mapowań przycisków.","This controller has no button mappings yet."))+
      '</div>';
  }else{
    list.innerHTML="";
    // NOTE: no detailToggleHtml() here on purpose — that control is a single global preference
    // (state.detailView) and two copies of it in one document would be two switches for one setting.
    for(const r of rules)list.appendChild(_ruleRow(r));
  }
  padForeignRulesRender();
}

// The OTHER member capsules' pad rules, under the active capsule's spis. Quieter rows on purpose:
// _ruleRow stamps `rule-<id>` ids and wires its buttons to the ACTIVE capsule's commit path, so a
// foreign rule in that dress would be a row whose delete button deletes nothing — or worse.
function padForeignRulesRender(){
  const box=document.getElementById("padForeignRules"); if(!box)return;
  box.innerHTML="";
  const act=state.activeDeviceId;
  const mem=(typeof padViewMembers==="function")?padViewMembers():[];
  for(const dev of mem){
    if(dev===act)continue;
    const D=state.devices[dev]; if(!D)continue;
    const rules=(D.rules||[]).filter(r=>(typeof gpvRuleButtons==="function")&&gpvRuleButtons(r).length>0);
    if(!rules.length)continue;
    const h=document.createElement("div");h.className="pfr-head";
    h.style.setProperty("--dcol",(typeof padCapColor==="function")?padCapColor(dev):"");
    h.innerHTML=(typeof capImgSpan==="function"?capImgSpan(dev,16):"")+
      '<b>'+esc((typeof padCapName==="function")?padCapName(dev):dev)+'</b>'+
      '<span>'+esc(_gl("mapowania tego kapsla na tym padzie","this capsule's mappings on this pad"))+'</span>';
    box.appendChild(h);
    for(const r of rules)box.appendChild(_padForeignRuleRow(dev,r));
  }
}

// ---------------------------------------------------------------------------
//  THE EDITOR, ON LOAN
// ---------------------------------------------------------------------------
// There is ONE #ruleEditor element and it normally lives in #trigCard. A pad rule opened from this
// tab has to edit it HERE — an editor that silently appeared in another tab reads as a dead click.
// So the element is moved, not duplicated: duplicating it would mean two sets of listeners writing
// to one draft.
let _padNewRule=false;
function _mountRuleEditor(rule){
  const ed=document.getElementById("ruleEditor"); if(!ed)return;
  const slot=document.getElementById("padRuleEditorSlot");
  const mine=(_padNewRule)||!!(rule&&typeof specIsPad==="function"&&specIsPad(rule.keySpec));
  _padNewRule=false;
  if(mine){ if(slot&&ed.parentNode!==slot)slot.appendChild(ed); return; }
  // back home: immediately above the Mapowanie list, exactly where the HTML puts it
  const card=document.getElementById("trigCard"), list=document.getElementById("rulesList");
  if(card&&list&&ed.parentNode!==card)card.insertBefore(ed,list);
}

// Bring the (single, borrowed) editor into view. Both add buttons, every edit button in the part
// panel and every click on a mapped part end up here: the slot sits directly under the part panel
// so the editor is always the same short distance from the drawing, but "short" is still below the
// fold on a small window, and a panel that opened off-screen reads exactly like a click that did
// nothing.
function _padEditorIntoView(){
  const ed=document.getElementById("ruleEditor");
  if(ed&&ed.scrollIntoView)try{ed.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(e){}
}
// Start a blank rule already aimed at a pad button. A rule started anywhere in this tab is a pad
// rule by definition, so it opens on the right action instead of the "right arrow" default —
// otherwise the first thing to do would be to undo the default.
function padNewRule(spec,mode){
  _padNewRule=true;                         // tells _mountRuleEditor this blank rule belongs here
  // „✋ Nagraj gest" on this screen: the same blank pad rule, opened straight in the editor's
  // simple mode (rf-12d) — the gesture is recorded, the pad button is already the action.
  if(mode&&typeof gestNewRule==="function"){gestNewRule(mode,spec||"pad:a");_padEditorIntoView();return;}
  // Pre-aiming goes through `after` (rf-12): the editor may now ASK before it drops an unsaved
  // draft, and that question is answered later — setting `keySpec` straight after the call would
  // land on the OLD draft. The callback also refreshes the clean-draft snapshot, because a pad
  // button the app itself filled in is not an edit anybody would miss.
  openEditor(null,d=>{
    d.keySpec=spec||"pad:a";
    state._draftBase=JSON.stringify(d);
    if(typeof renderEditor==="function")renderEditor();
    if(typeof updPadNote==="function")updPadNote();
    // FOKUS PONOWNIE — `renderEditor()` powyżej przebudowuje `innerHTML` edytora, więc pole,
    // na które fokus poszło przy otwarciu, już nie istnieje. Bez tego użytkownik klawiatury
    // otwierał edytor z tego ekranu i lądował z powrotem na początku dokumentu.
    // WHY: renderEditor() rebuilds the editor's innerHTML, which drops the focus set on opening.
    if(typeof _edFocusFirst==="function")_edFocusFirst();
    _padEditorIntoView();
  });
}

// ---------------------------------------------------------------------------
//  THE SELECTED PART — one drawing, one panel
// ---------------------------------------------------------------------------
// `state._padPart` is the whole of it: 'ls' | 'rs' | 'dpad' | a plain pad button | null. The four
// d-pad arrows collapse to ONE selection because they are one control — nobody sets up "the left
// arrow" of a d-pad on its own, and four near-identical panels would only ask which one you meant.
const PADPART_LS="ribbitflip.padPart";
// The d-pad is EITHER one motion module OR four separate buttons, and the map's own toggle says
// which (rf-44 draws it next to the cross). Module: the four arrows collapse to ONE selection,
// because nobody tunes "the left arrow" of a motion-driven cross on its own. Buttons: each arrow
// is a pad button like any other — the green plus, the click-to-map, its own little rule list.
// A view preference, not engine config: rules and the motion mode are untouched by flipping it.
function _dpadModuleOn(){
  if(state._dpadModule==null){
    let v=true; try{v=localStorage.getItem("ribbitflip.dpadModule")!=="0";}catch(e){}
    state._dpadModule=v;
  }
  return !!state._dpadModule;
}
function _padPartNorm(v){
  let p=String(v==null?"":v).trim().toLowerCase();
  if(!p)return null;
  if(p==="up"||p==="down"||p==="left"||p==="right")return _dpadModuleOn()?"dpad":p;
  if(p==="dpad")return _dpadModuleOn()?"dpad":null;   // a module selection cannot survive buttons mode
  if(p==="ls"||p==="rs")return p;
  if(!(typeof GPV_BTNS!=="undefined"&&GPV_BTNS.indexOf(p)>=0))return null;
  // …and not a part the VIEWED controller does not have. Selecting the touchpad and then switching
  // that controller to an Xbox pad would otherwise leave the column tuning a surface that is not on
  // the drawing any more — the same class of mismatch as the „Lewy drążek" heading over a picker
  // reading „Prawy". (Guarded: at load time rf-44 is not in yet, and the next render re-checks.)
  if(typeof gpvHas==="function"&&typeof padKindOf==="function"
     &&typeof state!=="undefined"&&state&&state._padView
     &&!gpvHas(p,padKindOf(state._padView)))return null;
  return p;
}
// Survives a reload: the panel is where somebody left off tuning, and re-finding it on the drawing
// every time the app restarts is a toll on the same work.
try{const _pp=_padPartNorm(localStorage.getItem(PADPART_LS));if(_pp)state._padPart=_pp;}catch(e){}
// The touchpad is a part of BOTH sorts at once, the way a stick is: it has a click (`pad:touchpad`,
// an ordinary mappable button, exactly as L3 is the stick's) AND a surface the motion can aim a
// finger at. So it gets a kind of its own rather than being filed as a plain button — the panel
// under it has to offer the drive line, and a button's panel does not have one.
function padPartKind(p){
  p=_padPartNorm(p);
  if(p==="ls"||p==="rs")return "stick";
  if(p==="dpad")return "dpad";
  if(p==="touchpad")return "touchpad";
  return p?"btn":"none";
}
// The parts the MOTION can be aimed at. Three shapes of one question, in one place, because the
// list is read from five spots and a fourth part added to four of them is a bug with no symptom.
function padPartIsMotion(kind){
  return kind==="stick"||kind==="dpad"||kind==="touchpad";
}
// Which half of the tuning wall a motion part uses. The touchpad rides on the STICK's numbers —
// same 3D filter, same scale in degrees, same dead zone — because a touchpad is a two-axis
// absolute surface and that is exactly what those knobs describe.
function padPartTunes(kind){
  return (kind==="stick"||kind==="touchpad")?"stick":"dpad";
}
// Which pad buttons a part COVERS, for the little list of mappings that aim at it.
function _padPartBtns(p){
  return (p==="dpad")?["up","down","left","right"]:(p?[p]:[]);
}
// Is the selected motion part driven by a capsule OTHER than the one being edited? Then its numbers
// are that capsule's, and the panel must not pretend otherwise.
function _padPartForeignDrv(p){
  const kind=padPartKind(p);
  if(!padPartIsMotion(kind))return null;
  const drv=(typeof padPartDriver==="function")?padPartDriver(p):null;
  return (drv&&drv.dev!==state.activeDeviceId)?drv:null;
}
// Pick a part. Clicking a stick or an arrow also says WHICH half of the motion settings the column
// shows — but looking never touches a live output, and it never touches a FOREIGN one at all: the
// half-switch below only runs when the part is the active capsule's to give.
function padPartSelect(v){
  const p=_padPartNorm(v);
  state._padPart=p;
  try{localStorage.setItem(PADPART_LS,p||"");}catch(e){}
  if(typeof padCtlMarkSel==="function")padCtlMarkSel();
  const md=(p==="ls"||p==="rs")?"stick":(p==="dpad")?"dpad":null;
  if(md&&typeof setPadMode==="function"&&!_padPartForeignDrv(p)){
    const m=state.mouse, was=m.mode+"|"+padMode()+"|"+m.stickWhich;
    setPadMode(md);
    // WHICH stick, straight from the click. The panel used to carry a „Drążek: Lewy / Prawy" picker
    // under a heading that already said „Lewy drążek", and the two could disagree — the owner read
    // it as the heading lying. The picker is gone (padPartSync hides it), so the click on the
    // drawing IS the choice, and it has to write the field or the heading would be the liar.
    // EXCEPT while the stick is LIVE on the other side: then the engine is reading this very field,
    // and a click made to LOOK at the right stick would move the player's input mid-game. Same rule
    // as the mode below — looking never touches a live output; the [Napędzaj ruchem] button does
    // (it writes both the mode and the side).
    if(md==="stick"&&!(m.enabled&&m.mode==="stick"))m.stickWhich=(p==="rs")?"right":"left";
    // Claim the engine's mode ONLY while the group is off. A click on a picture is how you LOOK at
    // a part; with the stick live in a game, looking at the d-pad must not flip the live output.
    // The explicit hand-over is the [Napędzaj ruchem kapsla] button (and the header switch, which
    // arms whatever half is on screen).
    if(!m.enabled)m.mode=md;
    // Only when something actually moved: hopping between a stick and itself changes the selection
    // but nothing else, and posting an identical config on every click would be one request per
    // glance at the drawing.
    if(was!==m.mode+"|"+padMode()+"|"+m.stickWhich){buildMouseControls();mFill();commitMouse();return;}
  }
  padPartSync();                             // (the branch above reaches it through mFill)
}

// ---------------------------------------------------------------------------
//  A CLICK ON THE DRAWING — select, and then do the obvious thing
// ---------------------------------------------------------------------------
//    unmapped button     -> select + start a new rule already aimed at it (the green plus on hover
//                           is the promise; this is it being kept)
//    one mapping, MINE   -> select + open THAT rule in the editor. There is nothing to choose between.
//    one mapping, THEIRS -> select only. The row in the panel carries the switch-and-edit action.
//    two or more         -> select only. Which of them was meant is a question only the user can
//                           answer, and guessing would open the wrong one half the time.
//    stick / d-pad       -> select. The panel IS the editing, and for a stick the click also says
//                           which of the two it is (padPartSelect writes stickWhich).
//    the same part again -> deselect, and the column goes back to the spis of every pad mapping.
//
// Deselecting also closes the editor, but ONLY when the editor is showing a rule of the part being
// unselected: an editor left open over an unrelated draft would lose whatever was typed into it.
function _padEditorOpen(){
  const ed=document.getElementById("ruleEditor");
  return !!(ed&&ed.style.display!=="none"&&state._draft);
}
function _padEditorAimsAt(p){
  if(!_padEditorOpen())return false;
  const bs=(typeof gpvRuleButtons==="function")?gpvRuleButtons(state._draft):[];
  const btns=_padPartBtns(p);
  return bs.some(b=>btns.indexOf(b)>=0);
}
function padPartClick(v){
  const p=_padPartNorm(v); if(!p)return;
  // Second click on the part already open = close it. The pad is a map, and on a map you can put
  // your finger down and take it off again.
  if(p===_padPartNorm(state._padPart)){
    const closeIt=_padEditorAimsAt(p);
    padPartSelect(null);
    if(closeIt&&typeof closeEditor==="function")try{closeEditor();}catch(e){}
    return;
  }
  padPartSelect(p);
  if(padPartKind(p)!=="btn")return;          // a stick or the d-pad edits itself, in the panel
  const btns=_padPartBtns(p);
  const all=(typeof padPartRulesAll==="function")?padPartRulesAll(btns)
    :(state.rules||[]).filter(r=>{
      const bs=(typeof gpvRuleButtons==="function")?gpvRuleButtons(r):[];
      return bs.some(b=>btns.indexOf(b)>=0);
     }).map(r=>({dev:state.activeDeviceId,rule:r}));
  if(!all.length)padNewRule("pad:"+p);
  else if(all.length===1&&all[0].dev===state.activeDeviceId){openEditor(all[0].rule);_padEditorIntoView();}
}

// One row of the part panel's own mapping list. NOT _ruleRow: that builder stamps `rule-<id>` on
// its elements, and the same rule appears in the spis at the bottom of this column at the same time
// — two nodes with one id is a document where getElementById picks a winner by accident. So this is
// a plain, quiet row: what the rule is, what it does, and the one button that opens the real editor.
function _padPartRuleRow(r){
  const row=document.createElement("div");
  row.className="pp-rule"+(r.enabled===false?" off":"");
  row.innerHTML='<div class="pp-rule-main"><b>'+esc(r.label||ruleSrcLabel(r))+'</b>'+
    '<span class="pp-rule-sub">'+esc(ruleCondLabel(r)+" · "+ruleBehLabel(r))+'</span></div>'+
    '<span class="pp-rule-key">'+esc(ruleKeyLabel(r))+'</span>'+
    '<span class="pp-rule-act">'+
    '<button class="btn sm" type="button" data-a="edit" title="Edytuj" aria-label="Edytuj">'+
      '<span class="rfic spray-ic sm" aria-hidden="true"></span></button>'+
    // A BIN NEXT TO THE PENCIL (2026-09-08, owner: "nie ma możliwości usunięcia warunku (...) powinno
    // dać się kasować wyzwalacze tak samo jak się je dodaje"). Until now a mapping made HERE could
    // only be removed by finding the same rule on the Mapping screen — and pad rules are not even
    // listed there. Same path as that screen's bin: ruleDeleteWithUndo, with the „↶ Cofnij" toast.
    '<button class="btn sm" type="button" data-a="del" title="Usuń" aria-label="Usuń">'+
      '<span class="bic bic-bin" aria-hidden="true"></span></button></span>';
  row.querySelector('[data-a=edit]').onclick=()=>{openEditor(r);_padEditorIntoView();};
  row.querySelector('[data-a=del]').onclick=()=>{if(typeof ruleDeleteWithUndo==="function")ruleDeleteWithUndo(r);};
  return row;
}
// The same quiet row for a rule that belongs to ANOTHER capsule on this pad. Its edit button first
// makes that capsule the one being edited — the editor writes into `state.rules`, and lying about
// which array that is would save the change onto the wrong capsule.
function _padForeignRuleRow(dev,r){
  const nm=(typeof padCapName==="function")?padCapName(dev):dev;
  const row=document.createElement("div");
  row.className="pp-rule foreign"+(r.enabled===false?" off":"");
  row.style.setProperty("--dcol",(typeof padCapColor==="function")?padCapColor(dev):"");
  row.innerHTML='<span class="pp-rule-cap">'+esc(nm)+'</span>'+
    '<div class="pp-rule-main"><b>'+esc(r.label||ruleSrcLabel(r))+'</b>'+
    '<span class="pp-rule-sub">'+esc(ruleCondLabel(r)+" · "+ruleBehLabel(r))+'</span></div>'+
    '<span class="pp-rule-key">'+esc(ruleKeyLabel(r))+'</span>'+
    '<span class="pp-rule-act">'+
    '<button class="btn sm" type="button" data-a="edit" title="'+esc(_gl("Edytuj (przełączy na kapsel ","Edit (switches to capsule ")+nm+")")+'"'+
      ' aria-label="Edytuj"><span class="rfic spray-ic sm" aria-hidden="true"></span></button>'+
    '<button class="btn sm" type="button" data-a="del" title="'+esc(_gl("Usuń (przełączy na kapsel ","Delete (switches to capsule ")+nm+")")+'"'+
      ' aria-label="Usuń"><span class="bic bic-bin" aria-hidden="true"></span></button></span>';
  row.querySelector('[data-a=edit]').onclick=()=>{
    if(typeof switchDevice==="function")switchDevice(dev);
    if(typeof padCtlRender==="function")padCtlRender();
    openEditor(r);_padEditorIntoView();
  };
  row.querySelector('[data-a=del]').onclick=()=>_padForeignRuleDelete(dev,r);
  return row;
}
// Deleting ANOTHER capsule's rule goes through that capsule's own commit path — the same as editing
// it does (switch first, then act). `state.rules` is replaced when the switched capsule's rules
// arrive, so the deletion waits for the rule to be there rather than deleting from a list that still
// belongs to the previous capsule. Bounded wait: a rule that never shows up (capsule gone in the
// meantime) is left alone, with a word about it.
function _padForeignRuleDelete(dev,r){
  if(typeof switchDevice==="function")switchDevice(dev);
  if(typeof padCtlRender==="function")padCtlRender();
  const t0=Date.now();
  (function tick(){
    if(state.activeDeviceId===dev&&(state.rules||[]).some(x=>x.id===r.id)){
      if(typeof ruleDeleteWithUndo==="function")ruleDeleteWithUndo((state.rules||[]).find(x=>x.id===r.id));
      return;
    }
    if(Date.now()-t0>4000){if(typeof rfToast==="function")rfToast(_gl("Nie udało się usunąć — kapsel nie odpowiedział","Could not delete — the capsule did not answer"));return;}
    setTimeout(tick,120);
  })();
}

// THE one owner of what is visible in the right column. Called at the end of mFill (values first,
// layout after), from renderRules (the little list is a filter over the same array) and from
// padCtlRender (a language switch rebuilds the column, and these sentences with them).
// WHY NOTHING ARRIVES — said above the drawing (2026-09-08). Reported case: the sticks worked, but
// R2 and R3 showed nothing on a gamepad tester. The sticks go out through Motion
// control; the buttons go out through the MAPPING group, and that group was off for the capsule —
// every press lit the drawing red and went nowhere. Since 2026-09-08 the pad answers to the Controller
// module alone (server: TriggerEngine.pad_on), so the strip names THAT switch — the card's head. Before, the
// small mirror at the bottom of the column, which nobody scrolled to. So: one sentence per muted
// capsule that HAS pad mappings, right under the head of the configuration, with the switch in it.
// Foreign capsules are named too — a pad shared by two capsules can have one of them muted.
function padOffNoteSync(){
  const el=document.getElementById("padOffNote"); if(!el)return;
  const mem=(typeof padViewMembers==="function")?padViewMembers():[];
  const hasPad=dev=>{const D=state.devices&&state.devices[dev];
    return !!D&&(D.rules||[]).some(r=>typeof specIsPad==="function"&&specIsPad(r.keySpec));};
  // THE MODULE SWITCH — the head of this card (motion on AND aimed at the pad). Since 2026-09-08
  // this is the only switch a pad button answers to; the Mapping group no longer has a say.
  const modOn=dev=>{const c=(typeof padCfgOf==="function")?(padCfgOf(dev)||{}):{};
    return !!(c.enabled&&c.mode!=="mouse");};
  const offs=mem.filter(dev=>hasPad(dev)&&!modOn(dev));
  const armedOff=!state.armed&&mem.some(hasPad);
  if(!offs.length&&!armedOff){if(!el.hidden){el.hidden=true;el.innerHTML="";el._sig="";}return;}
  const sig=JSON.stringify([offs,armedOff,(typeof _lang!=="undefined")?_lang:"",
    offs.map(d=>(typeof padCapName==="function")?padCapName(d):d)]);
  if(el._sig===sig){el.hidden=false;return;}
  el._sig=sig; el.hidden=false; el.innerHTML="";
  for(const dev of offs){
    const nm=(typeof padCapName==="function")?padCapName(dev):dev;
    const row=document.createElement("div"); row.className="pad-offnote-row";
    row.style.setProperty("--dcol",(typeof padCapColor==="function")?padCapColor(dev):"");
    const txt=document.createElement("span");
    txt.textContent=_gl("Przyciski z kapsla "+nm+" nie wychodzą do gry: moduł Kontroler tego kapsla jest wyłączony. To włącznik w nagłówku tej karty — ten sam, który puszcza ruch do pada.",
                        "Buttons from capsule "+nm+" never reach the game: this capsule's Controller module is off. That is the switch in this card's head — the same one that lets motion reach the pad.");
    row.appendChild(txt);
    const b=document.createElement("button"); b.type="button"; b.className="btn sm primary";
    b.textContent=_gl("Włącz Kontroler: "+nm,"Switch Controller on: "+nm);
    b.onclick=()=>{
      // The active capsule goes through the card's own switch (simulation confirm and all);
      // another capsule gets the same setting written straight to its config.
      if(dev===state.activeDeviceId){const k=document.getElementById("kEnable"); if(k)k.click(); return;}
      const c=(typeof padCfgOf==="function")?(padCfgOf(dev)||{}):{};
      const body={enabled:true}; if(c.mode==="mouse")body.mode="stick";
      fetch("/airmouse?dev="+encodeURIComponent(dev),{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)}).then(r=>r.json()).then(j=>{
          const D=state.devices&&state.devices[dev]; if(D&&j)D.mouseCfg=Object.assign({},D.mouseCfg||{},j);
          padOffNoteSync();}).catch(()=>{});
    };
    row.appendChild(b);
    el.appendChild(row);
  }
  if(armedOff){
    const row=document.createElement("div"); row.className="pad-offnote-row";
    const txt=document.createElement("span");
    txt.textContent=_gl("Wyjścia nie są uzbrojone — żadne mapowanie pada nie wychodzi do gry. Uzbrój przełącznikiem u góry.",
                        "The outputs are not armed — no pad mapping reaches the game. Arm them with the switch at the top.");
    row.appendChild(txt); el.appendChild(row);
  }
}
function padPartSync(){
  try{padOffNoteSync();}catch(e){}
  // the sentence "click a part of the drawing" lives only until a part is picked
  if(typeof _padCfgHeadSync==="function")try{_padCfgHeadSync(padViewOwner());}catch(e){}
  const panel=document.getElementById("padPartPanel"); if(!panel)return;
  const $=id=>document.getElementById(id);
  const show=(id,on)=>{const e=$(id);if(e)e.style.display=on?"":"none";};
  let p=_padPartNorm(state._padPart);
  let foreignDrv=_padPartForeignDrv(p);
  // A capsule can ARRIVE already running the other half (onMouseCfg calls setPadMode), and every
  // field in this panel is filled for padMode() — so a stick selection left over from the previous
  // capsule would show the stick's controls holding the d-pad's numbers. A MOTION selection
  // therefore follows the capsule; a BUTTON selection does not, because it is not about the motion
  // at all — and a FOREIGN selection does not either, because the fields it would protect are not
  // on screen for it (the column shows the switch bar instead).
  if(typeof padMode==="function"&&!foreignDrv){
    const md=padMode();
    // ...and never INTO a module selection while the toggle says the cross is four buttons.
    if((p==="ls"||p==="rs")&&md==="dpad"&&_dpadModuleOn())p="dpad";
    else if(p==="dpad"&&md==="stick")p=(state.mouse&&state.mouse.stickWhich==="right")?"rs":"ls";
  }
  if(p!==state._padPart){                    // only on a real change: this runs on every mFill
    state._padPart=p;
    try{localStorage.setItem(PADPART_LS,p||"");}catch(e){}
    if(typeof padCtlMarkSel==="function")padCtlMarkSel();
    foreignDrv=_padPartForeignDrv(p);
  }
  const kind=padPartKind(p), motion=padPartIsMotion(kind), tunes=padPartTunes(kind);
  const foreign=!!foreignDrv;
  const m=state.mouse||{};

  // --- layout: which variant of the column this is.
  // NOTHING SELECTED is a state with contents rather than an empty panel: the column shows the SPIS
  // of every pad mapping, under the heading above. A FOREIGN motion part shows the switch bar and
  // nothing else — the settings on this screen belong to the active capsule, and the clicked part
  // does not. Everything else is the part's own panel.
  panel.style.display=(kind==="none"||foreign)?"none":"";
  show("padPartForeign",foreign);
  show("padAllRulesSec",kind==="none");
  show("padPartMotion",motion&&!foreign);
  show("padPartBtn",kind==="btn");
  show("padPartRules",kind!=="none"&&!foreign);
  // The stick/d-pad preview canvas lives in the LEFT column, under the pad drawing. It draws the
  // ACTIVE capsule's engine (state.mouse), so a foreign part must not show it — the picture would
  // be the wrong capsule's.
  show("kScopeBox",motion&&!foreign);
  // Auto-switching decides which MODE the capsule runs, so it belongs to the two motion parts. Under
  // a plain button it would be an answer to a question that part cannot ask.
  show("mAutoFold",motion&&!foreign);
  // The four containers mFill deliberately no longer touches (see the note there).
  show("mGrpStick",tunes==="stick"&&motion&&!foreign);
  show("mGrpDpad",kind==="dpad"&&!foreign);
  // UX 261120 L4b: te same dwie grupy rozłożone na piętra (P2 w #kTune, P3 w #kAdv) idą razem
  // z nimi; „Zaawansowane” ma treść tylko przy gałce i krzyżaku.
  show("mGrpStickTune",tunes==="stick"&&motion&&!foreign);
  show("mGrpStickAdv",tunes==="stick"&&motion&&!foreign);
  show("mGrpDpadTune",kind==="dpad"&&!foreign);
  show("mGrpDpadAdv",kind==="dpad"&&!foreign);
  show("kAdv",motion&&!foreign);
  show("kGrpInvert",motion&&!foreign);
  // "source — axes" only when THIS half reads a raw channel (the 3D filter path has no channels)
  show("kGrpSource",motion&&!foreign&&((tunes==="stick")?(m.stickSource==="axis"):(m.dpadSource==="axis")));
  // THE ONE FIELD THAT CROSSED OVER FROM mFill. Everything INSIDE #mGrpStick is mFill's, by the
  // contract in the note there — this line is the single exception and it is here because the answer
  // it hides is no longer a value question at all. „Drążek: Lewy / Prawy" duplicated the choice the
  // click on the drawing already made, under a heading that names the same thing, so the panel could
  // show „Lewy drążek" over a picker reading „Prawy (RS)". The field and its value stay (mFill still
  // writes #mStickWhich, other code may read it); only the row is gone, unconditionally, which makes
  // this file the sole owner of that decision instead of two files taking turns.
  show("mStickWhichFld",false);

  // --- the heading names the part, because the column below it is only ever about that part
  const _kindNow=(typeof padKindOf==="function")?padKindOf(state._padView):"x360";
  const _stickBtn=(p==="rs")?"R3":"L3";
  let title,hint;
  if(kind==="stick"){
    // ON A WII CONTROLLER the two sticks are not a pair. The LEFT one is the Nunchuk's, which is
    // real hardware you can hold; the right one exists only on the DSU wire, and calling it
    // „prawy drążek" as if it were on the desk in front of you is the kind of small lie the whole
    // three-drawings change was made to stop. Its CLICK is the same story: a Nunchuk has none,
    // the protocol carries L3 anyway, and an emulator can bind it.
    const _wii=(_kindNow==="wii");
    title=_wii
      ? ((p==="rs")?_gl("Prawy drążek · DSU","Right stick · DSU"):_gl("Drążek Nunchuka","Nunchuk stick"))
      : ((p==="rs")?_gl("Prawy drążek","Right stick"):_gl("Lewy drążek","Left stick"));
    // The click of the stick is a BUTTON of its own (L3/R3), and its mappings live in this very
    // panel — said here, in the part's first line, because "how do I map the stick CLICK?" was a
    // question the panel answered only at its bottom, below the whole tuning wall.
    // …and with the stick's OUTPUT set to the touchpad, "ruch kapsla jako drążek" is simply not
    // what is happening: the motion is walking a finger across the glass. The click keeps its own
    // half of the sentence, because L3 is still what a click on this part maps to.
    const _tp=(m.stickBackend==="touchpad");
    hint=foreign?_gl("napędza go kapsel: ","driven by capsule: ")+((typeof padCapName==="function")?padCapName(foreignDrv.dev):foreignDrv.dev)
        :_wii?((p==="rs")
            ?_gl("nie ma go ani na pilocie, ani na Nunchuku — niesie go protokół DSU",
                 "it is on neither the remote nor the nunchuk — the DSU protocol carries it")
            :_gl("ruch kapsla jako drążek · Nunchuk nie ma kliknięcia, ale protokół niesie L3",
                 "capsule motion as the stick · a Nunchuk has no click, but the protocol carries L3"))
        :_tp?_gl("ruch kapsla prowadzi palec po touchpadzie · kliknięcie drążka to nadal przycisk ",
                 "capsule motion walks a finger across the touchpad · the stick click is still button ")+_stickBtn
        :_gl("ruch kapsla jako drążek · kliknięcie drążka = przycisk ","capsule motion as the stick · pressing the stick = button ")+_stickBtn;
  }else if(kind==="dpad"){
    title=_gl("Krzyżak","D-pad");
    hint=foreign?_gl("napędza go kapsel: ","driven by capsule: ")+((typeof padCapName==="function")?padCapName(foreignDrv.dev):foreignDrv.dev)
        :_gl("ruch kapsla jako kierunki krzyżaka","capsule motion as d-pad directions");
  }else if(kind==="touchpad"&&_kindNow==="wii"){
    // No touch surface on a remote either — same honest wording as the right stick above.
    title=_gl("Powierzchnia dotyku · DSU","Touch surface · DSU");
    hint=foreign?_gl("napędza go kapsel: ","driven by capsule: ")+((typeof padCapName==="function")?padCapName(foreignDrv.dev):foreignDrv.dev)
        :_gl("pilot jej nie ma — to pole protokołu DSU. Dolphin wystawia je jako osie Touch X/Y, "
             + "które podpina się pod wskaźnik pilota (Point) — czyli pozycję na ekranie. Trzeba to zrobić ręcznie.",
             "the remote has none — it is a DSU protocol field. Dolphin exposes it as Touch X/Y axes, which "
             + "you bind to the remote's pointer (Point), i.e. a position on the screen. You bind it yourself.");
  }else if(kind==="touchpad"){
    title=_gl("Touchpad","Touchpad");
    hint=foreign?_gl("napędza go kapsel: ","driven by capsule: ")+((typeof padCapName==="function")?padCapName(foreignDrv.dev):foreignDrv.dev)
        :_gl("ruch kapsla jako palec na panelu · kliknięcie panelu = przycisk Touchpad",
             "capsule motion as a finger on the pad · clicking the pad = the Touchpad button");
  }else if(kind==="btn"){
    // A d-pad arrow in buttons mode is its own part — "Krzyżak ↑", not "Przycisk krzyżak ↑".
    const arrow=(p==="up"||p==="down"||p==="left"||p==="right");
    // …under the names of the pad this controller IS: on a DualShock the same button reads ✕.
    const _k=(typeof padKindOf==="function")?padKindOf(state._padView):"x360";
    const lbl=(typeof gpvLabel==="function")?gpvLabel(p,_k):p;
    title=arrow?(lbl.charAt(0).toUpperCase()+lbl.slice(1)):_gl("Przycisk ","Button ")+lbl;
    hint=_gl("co go wciska","what presses it");
  }else{
    // No part picked: this heading belongs to the spis below it, which is the whole of the column
    // in that state.
    title=_gl("Mapowania pada","Pad mappings");
    hint=_gl("wszystkie mapowania tego pada",
             "every mapping on this pad");
  }
  {const e=$("padPartTitle");if(e&&e.textContent!==title)e.textContent=title;}
  {const e=$("padPartHint");if(e&&e.textContent!==hint)e.textContent=hint;}

  // --- FOREIGN: name the capsule, offer the switch. The whole panel in two sentences.
  // (Cleared when hidden: these are composed with a capsule NAME, so the language walker cannot
  // re-translate them — stale hidden Polish would sit in an English DOM waiting to be screenshotted.)
  if(!foreign){
    const st=$("padPartForeignState"); if(st&&st.textContent)st.textContent="—";
  }
  if(foreign){
    const nm=(typeof padCapName==="function")?padCapName(foreignDrv.dev):foreignDrv.dev;
    const st=$("padPartForeignState");
    if(st)st.textContent=foreignDrv.live
      ? _gl("Tą częścią steruje teraz kapsel ","This part is being driven by capsule ")+nm+"."
      : _gl("Ta część jest ustawiona na kapsel ","This part is set up on capsule ")+nm+".";
    const bt=$("padPartForeignBtn");
    if(bt){
      bt.textContent=_gl("Przełącz na: ","Switch to: ")+nm;
      bt.onclick=()=>{
        if(typeof switchDevice==="function")switchDevice(foreignDrv.dev);
        if(typeof padCtlRender==="function")padCtlRender();
      };
    }
  }

  // --- is the motion going into THIS part? ONE switch, in the app's own shape (`div.rf-toggle`,
  // the same control as #kEnable and #dsuEnable), because that is what the question deserves: it
  // has two states and the person looking at it wants to change which one it is in.
  //
  // It used to be a PAIR of buttons — „Napędzaj ruchem kapsla" shown only while the part was NOT
  // aimed, „⏹ Zatrzymaj" only while it was live — which meant the control vanished at exactly the
  // moment it was working. Reported as "there is no clear switch for the stick", and rightly: a
  // button that disappears when the thing is on is not a switch, it is two half-answers taking
  // turns. The sentence beside it still carries the THIRD state (aimed but silent), which a
  // two-position switch genuinely cannot say.
  if(motion&&!foreign){
    const aimed=(kind==="stick")   ? (m.mode==="stick"&&m.stickBackend!=="touchpad"
                                      &&((m.stickWhich==="right")?"rs":"ls")===p)
              : (kind==="touchpad")? (m.mode==="stick"&&m.stickBackend==="touchpad")
              :                      (m.mode==="dpad");
    // CZTERY STANY, CZTERY ZDANIA. Do 13.09 były trzy, bo „ruch zaparkowany" nie istniał — wyłącznik
    // tej części gasił CAŁY moduł (pisał w `m.enabled`), więc razem z drążkiem milkły mapowania
    // `pad:`: wyłączenie sterowania prawym analogiem odpinało cały kontroler, jakby te kontrolki
    // były ze sobą powiązane, a nie są. Teraz OFF parkuje ruch
    // (`m.padPark`), moduł zostaje włączony, a trzeci i czwarty stan trzeba od siebie odróżnić:
    // „stoi, bo cały moduł jest wyłączony" wysyła do włącznika w nagłówku, „stoi, bo zaparkowany"
    // wysyła do TEGO przełącznika obok.
    const parked=!!(m.padPark&&m.mode!=="mouse");
    const live=!!(aimed&&m.enabled&&!parked);
    const st=$("padPartDriveState"), tg=$("padPartDrive");
    if(st){
      st.textContent=live?_gl("Ruch kapsla steruje tą częścią pada.","The capsule's motion is driving this part of the pad.")
        :(m.enabled&&parked)?(aimed
            ?_gl("Moduł jest włączony i przyciski pada działają, ale ruch kapsla jest zaparkowany.",
                 "The module is on and the pad buttons work, but the capsule's motion is parked.")
            :_gl("Ruch kapsla jest zaparkowany — nie prowadzi teraz żadnej części pada.",
                 "The capsule's motion is parked — it is driving no part of the pad right now."))
        :aimed?_gl("Ta część jest ustawiona na ruch kapsla, ale włącznik w nagłówku karty jest wyłączony.",
                   "This part is set to the capsule's motion, but the switch in the card header is off.")
        :_gl("Ruch kapsla steruje teraz czym innym.","The capsule's motion is driving something else right now.");
      st.classList.toggle("on",live);
    }
    if(tg){
      tg.classList.toggle("on",live);
      tg.setAttribute("aria-checked",live?"true":"false");
      tg.setAttribute("aria-label",_gl("Napędzaj tę część ruchem kapsla","Drive this part with the capsule's motion"));
    }
  }

  // --- the mappings that aim at this part — every member capsule's, the active one's first
  if(kind==="none"){padForeignRulesRender();return;}
  if(foreign)return;
  const btns=_padPartBtns(p);
  const all=(typeof padPartRulesAll==="function")?padPartRulesAll(btns)
    :(state.rules||[]).filter(r=>{
      const bs=(typeof gpvRuleButtons==="function")?gpvRuleButtons(r):[];
      return bs.some(b=>btns.indexOf(b)>=0);
     }).map(r=>({dev:state.activeDeviceId,rule:r}));
  // For a STICK the mapping list is about one concrete button — the stick's own click — so it is
  // titled with that button's NAME (L3/R3) and mounted directly under the drive line, where a
  // person looking for "how do I map the stick click" actually looks. At the bottom of the tuning
  // wall, where it used to sit, it answered a question nobody had scrolled far enough to ask.
  _padRulesMount(kind);
  {const e=$("padPartRulesTitle"), t=(kind==="btn")?_gl("Co wciska ten przycisk","What presses this button")
     :(kind==="stick")?_gl("Kliknięcie drążka = przycisk ","Pressing the stick = button ")+_stickBtn
     :(kind==="touchpad")?_gl("Kliknięcie panelu = przycisk Touchpad","Clicking the pad = the Touchpad button")
     :_gl("Mapowania na kierunki krzyżaka","Mappings on the d-pad directions");
   if(e&&e.textContent!==t)e.textContent=t;}
  {const e=$("padPartAdd"), t=(kind==="btn")?_gl("Nowe mapowanie na ten przycisk","New mapping on this button")
     :(kind==="stick")?_gl("Mapowanie na ","Mapping on ")+_stickBtn
     :(kind==="touchpad")?_gl("Mapowanie na kliknięcie panelu","Mapping on the pad click")
     :_gl("Mapowanie na kierunek krzyżaka","Mapping on a d-pad direction");
   // The handler lives on the BUTTON, so rewriting its innards leaves it wired.
   if(e&&e._lbl!==t){e._lbl=t;e.innerHTML='<span class="bic bic-plus" aria-hidden="true"></span>'+esc(t);}}
  const list=$("padPartRulesList");
  if(list){
    // This function runs on every mFill, and mFill runs every time a config packet comes back from
    // the server — several times a second while a slider is being dragged. Rebuilding the list there
    // would throw away whatever the pointer was over, so it is rebuilt only when what it SAYS
    // changed. The language is in the signature because two of the three columns are composed in it.
    const act=state.activeDeviceId;
    const sig=JSON.stringify([kind,p,(typeof _lang!=="undefined")?_lang:"",
      all.map(x=>[x.dev,x.rule.id,x.rule.label||"",x.rule.keySpec||"",x.rule.sequence||"",x.rule.enabled!==false,x.rule.behavior||"",
        x.rule.cmp,x.rule.threshold,x.rule.thresholdHi,!!x.rule.abs,!!x.rule.neg,x.rule.crossings,x.rule.windowMs,x.rule.intervalMs,x.rule.dwellMs,
        (x.rule.source&&x.rule.source.kind)||"",(x.rule.source&&x.rule.source.channel),(x.rule.source&&x.rule.source.metric)||"",
        (x.rule.extraConditions||[]).length])]);
    if(list._sig!==sig){
      list._sig=sig;
      list.innerHTML="";
      if(!all.length){
        const e=document.createElement("div");e.className="rules-empty";
        e.textContent=_gl("Nic jeszcze nie wciska tej części pada. Dodaj mapowanie przyciskiem obok.",
                          "Nothing presses this part of the pad yet. Add a mapping with the button next to it.");
        list.appendChild(e);
      }else for(const x of all)list.appendChild(x.dev===act?_padPartRuleRow(x.rule):_padForeignRuleRow(x.dev,x.rule));
    }
  }
}
// Which pad button a "+ new mapping" from the part panel should open on. A d-pad selection has four
// of them and no way to guess which one is meant, so it opens on ↑ — the one every d-pad set starts
// with, and one click in the editor away from the other three.
function _padPartNewSpec(){
  const p=state._padPart, kind=padPartKind(p);
  return (kind==="dpad")?"pad:up":(p?("pad:"+p):"pad:a");
}
// Where #padPartRules lives depends on the part. For a STICK it sits directly under the drive line
// (the L3/R3 click is the panel's second question, not its last); everything else keeps it in the
// HTML's own slot, just above #mAutoFold. One element, moved — a second copy would be two lists of
// one array, and the id would pick a winner by accident. Same pattern as the borrowed rule editor.
function _padRulesMount(kind){
  const pr=document.getElementById("padPartRules"); if(!pr)return;
  // The touchpad sits with the stick here for the same reason: its CLICK is the panel's second
  // question, not its last, and burying it under the tuning wall is where nobody scrolled to.
  if(kind==="stick"||kind==="touchpad"){
    const motion=document.getElementById("padPartMotion");
    const drive=motion&&motion.querySelector(".pp-drive");
    if(drive&&drive.nextElementSibling!==pr)motion.insertBefore(pr,drive.nextElementSibling);
    pr.classList.add("pp-rules-top");
  }else{
    // Przed „Zaawansowane” (#kAdv, UX 261120 L4b), które stoi na dole kolumny części.
    const panel=document.getElementById("padPartPanel"), fold=document.getElementById("kAdv");
    if(panel&&fold&&(pr.parentNode!==panel||pr.nextElementSibling!==fold))panel.insertBefore(pr,fold);
    pr.classList.remove("pp-rules-top");
  }
}

// The right column's own wiring. Called by initPadCtl (rf-44), which owns the drawing's delegation.
function initPadParts(){
  const $=id=>document.getElementById(id);

  // Wrap openEditor rather than editing rf-12: every call site (the rule rows, the cheat sheet, the
  // "+ Nowy wyzwalacz" button) reaches it by NAME, so a reassignment here catches all of them and
  // none of them has to know this tab exists. rf-43 loads after rf-12, so the original is in hand.
  if(typeof openEditor==="function"){
    const _openEd=openEditor;
    // `after` MUSI iść dalej: to nim edytor oddaje świeży szkic (rf-12, `_openEditorNow`), a ten
    // ekran celuje przez niego nową regułę w przycisk pada. Opakowanie z jednym parametrem gubiło
    // callback po cichu i reguła rodziła się bez akcji.
    // PRZENOSINY DOPIERO PRZY OTWARCIU. rf-12 może najpierw ZAPYTAĆ o niezapisany szkic; gdyby
    // edytor przeprowadzał się przed pytaniem, „Wróć do edycji" oddawałoby szkic w panelu innego
    // ekranu. Stąd mount w `after`, a flaga `_padNewRule` czeka na odpowiedź razem z nim.
    openEditor=function(rule,after){
      const want=_padNewRule; _padNewRule=false;
      return _openEd(rule,d=>{ _padNewRule=want; _mountRuleEditor(rule);
                               if(typeof after==="function")after(d); });
    };
    try{window.openEditor=openEditor;}catch(e){}
  }

  // ONE "CENTRE THE CAPSULE" for every screen (P-G2-06): the confirmation stands next to the
  // button and in the skull bubble. It used to land in the Mapping card's message line, on a
  // screen nobody was looking at. Assigned here, after initMouse, so this handler is the one.
  const kc=$("kCalib");
  if(kc&&typeof rfCenterCapsule==="function")kc.onclick=e=>rfCenterCapsule(e.currentTarget);

  const add=$("padRuleAdd");
  if(add)add.onclick=()=>padNewRule("pad:a");
  const addG=$("padRuleGest");                // the second door: record a gesture for a pad button
  if(addG)addG.onclick=()=>padNewRule("pad:a","simple");

  // THE PART'S OWN SWITCH. On = aim the motion here AND open the output; off = PARK the motion
  // (`m.padPark`), leaving the aim where it was.
  //
  // ⚠ OFF USED TO WRITE `m.enabled=false`, WHICH WAS THE WHOLE MODULE. Reported by the owner
  // (2026-09-13): „jak wyłączę sterowanie prawym analogiem, to odpina się cały kontroler. jakby te
  // kontrolki były ze sobą powiązane, a nie są". They were: `pad_output_on()` is `enabled AND mode
  // != "mouse"`, so closing the stick's output also closed every `pad:` mapping and flipped the
  // card header's own switch to Off. Parking splits the two — the module stays on, the buttons keep
  // going out, only the motion stands still. The same gap was being worked around from the other
  // side in the game setups (a buttons-only capsule parked its stick arithmetically: sens 0.10×
  // under a 0.90 dead zone), and that hack is what this flag retires.
  //
  // It arms, which the pair of buttons it replaces deliberately did not — the note there said
  // arming from a settings BUTTON is a surprise, and that was right about a button. This is not a
  // button: it is the same `rf-toggle` as the card header's own switch, in the same state, and it
  // goes through the same confirmation gate (rf-39f guards ARMING, never disarming). A switch that
  // aimed the motion and then left it silent would be the third half-answer.
  //
  // ⚠ Kept from the old note and still true: merely LOOKING at a part never moves a live output.
  // Selecting a part on the drawing changes nothing; only this control does.
  const drive=$("padPartDrive");
  const _driveToggle=()=>{
    const p=state._padPart, kind=padPartKind(p);
    if(!padPartIsMotion(kind))return;
    const m=state.mouse; if(!m)return;
    const aimed=(kind==="stick")   ? (m.mode==="stick"&&m.stickBackend!=="touchpad"
                                      &&((m.stickWhich==="right")?"rs":"ls")===p)
              : (kind==="touchpad")? (m.mode==="stick"&&m.stickBackend==="touchpad")
              :                      (m.mode==="dpad");
    const parked=!!(m.padPark&&m.mode!=="mouse");
    const want=!(aimed&&m.enabled&&!parked);
    const apply=()=>{
      if(want){
        // The touchpad is the stick MODE with another way out — see stickBackend in the engine.
        m.mode=(kind==="dpad")?"dpad":"stick";
        if(kind==="stick"){m.stickWhich=(p==="rs")?"right":"left";
                           if(m.stickBackend==="touchpad")m.stickBackend="gamepad";}
        if(kind==="touchpad")m.stickBackend="touchpad";
        m.enabled=true;
        m.padPark=false;            // celowanie tutaj znaczy „ma jechać", więc park się zdejmuje
        if(typeof setPadMode==="function")setPadMode(m.mode);
      }else{
        // PARK, NIE WYŁĄCZENIE MODUŁU. `m.enabled` i `m.mode` zostają nietknięte, więc
        // pad_output_on() dalej mówi „tak" i mapowania `pad:` wychodzą; celowanie też zostaje,
        // więc ponowne On wraca dokładnie tam, gdzie było.
        m.padPark=true;
      }
      buildMouseControls();mFill();
      // Posted at once rather than on the debounce: a request to start or stop an output should
      // not sit in a timer.
      if(typeof postMouse==="function")postMouse();
    };
    if(want&&typeof rfSimConfirmOn==="function")rfSimConfirmOn(want,apply,"motion"); else apply();
  };
  // Enter/Space comes for free: rf-27 turns them into a click on any .rf-toggle, so wiring it
  // again here would fire the switch twice per key press.
  if(drive)drive.onclick=_driveToggle;

  const padd=$("padPartAdd");
  if(padd)padd.onclick=()=>padNewRule(_padPartNewSpec());
  const padg=$("padPartGest");                // …and the gesture door for the part that is open
  if(padg)padg.onclick=()=>padNewRule(_padPartNewSpec(),"simple");

  // One group, one source of truth: click the real switch and let trigReflectEnable mirror it back.
  const te=$("padTrigEnable");
  if(te)te.onclick=()=>{const t=$("trigEnable"); if(t)t.click();};
  initPadTiers();
}

// ===== UX 261120 L4b: piętra Kontrolera =====
// Piętro 2 „Czułość i martwa strefa” (#kTune) i piętro 3 „Zaawansowane” (#kAdv) w kolumnie części.
// Liczniki „zmienione” i „Przywróć domyślne” liczą się ze state.mouse, nie z pól: część pól
// (odwracanie, osie) czyta połówkę ruchu wybraną przez padMode(). Domyślne to migawka state.mouse
// z chwili wczytania pliku (lustro AirMouse.DEFAULTS w rf-02; konfiguracja z serwera przychodzi później).
const _K_DEF=Object.assign({},(typeof state!=="undefined"&&state.mouse)||{});
const _K_IDS={kAutoTare:"autoTare",mStickBackend:"stickBackend",mStickInner:"stickInner",mStickOuter:"stickOuter",
  mStickSensX:"stickSensX",mStickSensY:"stickSensY",mStickAccel:"stickAccel",mStickWsadThr:"stickWsadThr",
  mDpadBackend:"dpadBackend",mDpadDiagSeg:"dpadDiagonal",mDpadInner:"dpadInner",mDpadFilterDead:"dpadFilterDead",
  mStickSource:"stickSource",mStickMetricX:"stickMetricX",mStickMetricY:"stickMetricY",mStickFilterScale:"stickFilterScale",
  mStickRange:"stickRange",mStickExpo:"stickExpo",mDpadSource:"dpadSource",mDpadMetricX:"dpadMetricX",
  mDpadMetricY:"dpadMetricY",mDpadFilterScale:"dpadFilterScale",mDpadRange:"dpadRange",
  mAutoSwitch:"autoSwitch",mSwitchKind:"switchKind",mSwitchMetric:"switchMetric",mSwitchChannel:"switchChannel",
  mSwitchCmp:"switchCmp",mSwitchThreshold:"switchThreshold",mSwitchAbs:"switchAbs",mSwitchHyst:"switchHyst",
  mModeTrue:"modeTrue",mModeFalse:"modeFalse"};
const _K_HALF={kInvX:"InvertX",kInvY:"InvertY",kAxisX:"AxisX",kAxisY:"AxisY",kDead:"Deadzone"};
function _kKey(id){
  if(_K_HALF[id])return ((typeof padMode==="function")?padMode():"stick")+_K_HALF[id];
  return _K_IDS[id];
}
// Klucze stanu za widocznymi polami zwijaka (pole schowane przez wybór wyjścia albo źródła się nie liczy).
function _kKeys(det){
  const out=[];
  for(const id of Object.keys(_K_IDS).concat(Object.keys(_K_HALF))){
    const el=document.getElementById(id);
    if(!el||!det||!det.contains(el)||!rfTier.shown(el,det))continue;
    const k=_kKey(id);
    if(k&&_K_DEF[k]!==undefined)out.push(k);
  }
  return out;
}
function _kChanged(det){const m=state.mouse||{};return _kKeys(det).filter(k=>!rfTier.same(m[k],_K_DEF[k])).length;}
function _kPick(det){const m=state.mouse||{},o={};for(const k of _kKeys(det))o[k]=m[k];return o;}
function _kApply(v){Object.assign(state.mouse,v);mFill();commitMouse();}
function _kReset(det){const d={};for(const k of _kKeys(det))d[k]=_K_DEF[k];_kApply(d);}
function _kVal(id){const e=document.getElementById(id);return e?e.textContent.trim():"";}
function _kTuneSum(){
  const m=state.mouse||{},pm=(typeof padMode==="function")?padMode():"stick";
  const inv=[m[pm+"InvertX"]?"X":"",m[pm+"InvertY"]?"Y":""].filter(Boolean).join(", ");
  const parts=[];
  const det=document.getElementById("kTune");
  const vis=id=>{const e=document.getElementById(id);return !!e&&rfTier.shown(e,det);};
  if(vis("mGrpStickTune")){
    if(vis("mStickSensXFld"))parts.push(_gl("Czułość ","Sensitivity ")+_kVal("mStickSensXv")+" / "+_kVal("mStickSensYv"));
    parts.push(_gl("martwa strefa ","dead zone ")+_kVal("mStickInnerv"));
  }else if(vis("mGrpDpadTune")){
    parts.push(_gl("Martwa strefa ","Dead zone ")+(vis("mDpadFilterDeadFld")
      ?String((+m.dpadFilterDead||0)).replace(".",_gl(",","."))+"°":_kVal("mDpadInnerv")));
    parts.push(m.dpadDiagonal?_gl("skosy: tak","diagonals: yes"):_gl("skosy: nie","diagonals: no"));
  }
  parts.push(inv?_gl("odwrócone: ","inverted: ")+inv:_gl("odwrócone: nie","inverted: no"));
  const s=parts.join(" · ");
  return s.charAt(0).toUpperCase()+s.slice(1);
}
function initPadTiers(){
  if(typeof rfTier!=="function")return;
  const tune=document.getElementById("kTune"), adv=document.getElementById("kAdv");
  rfTier(tune,"kontroler.czulosc",{sum:_kTuneSum,changed:()=>_kChanged(tune),
    reset:()=>_kReset(tune),take:()=>_kPick(tune),restore:_kApply});
  rfTier(adv,"kontroler.zaawansowane",{changed:()=>_kChanged(adv),
    reset:()=>_kReset(adv),take:()=>_kPick(adv),restore:_kApply});
}
// (koniec sekcji L4b)
