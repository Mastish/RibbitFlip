"use strict";
// ===== MANUAL CONTROL AS A MOVABLE WINDOW =====
// Hand-driving the capsule is something you do WHILE watching something else — a trigger firing, the
// motion-control preview, a MIDI meter, a game. Pinned inside its own tab, the sphere was never on
// screen at the same time as the thing it was meant to prove. Taking control therefore lifts the
// whole "Orientacja 3D" card out of the layout into a small window that floats above the app and is
// dragged by its bar, exactly like a system window; letting go of the control puts the card back
// where it came from, in the same slot, with nothing left behind.
//
// The card is MOVED, not cloned: one canvas, one set of ids, one rAF loop. A copy would mean two
// spheres claiming the same puck and the same element ids — the fastest way to a widget that
// answers to neither.
const VPWIN={el:null,body:null,hole:null,parent:null,next:null,docked:false,x:null,y:null,drag:null,_loaded:false,_wired:false};
const VPWIN_LS="ribbitflip.vpwin";
function _vpwLoad(){
  if(VPWIN._loaded)return; VPWIN._loaded=true;
  try{const j=JSON.parse(localStorage.getItem(VPWIN_LS)||"null");
    if(j&&typeof j==="object"){
      if(typeof j.x==="number")VPWIN.x=j.x;
      if(typeof j.y==="number")VPWIN.y=j.y;
      VPWIN.docked=!!j.docked;
    }}catch(e){}
}
function _vpwSave(){
  try{localStorage.setItem(VPWIN_LS,JSON.stringify({x:VPWIN.x,y:VPWIN.y,docked:VPWIN.docked}));}catch(e){}
}
// keep the window inside the viewport — a bar dragged off-screen can never be grabbed again
function _vpwPlace(x,y){
  const win=VPWIN.el; if(!win)return;
  const maxX=Math.max(0,window.innerWidth-win.offsetWidth),
        maxY=Math.max(0,window.innerHeight-win.offsetHeight);
  VPWIN.x=Math.max(0,Math.min(maxX,x));
  VPWIN.y=Math.max(0,Math.min(maxY,y));
  win.style.left=VPWIN.x+"px"; win.style.top=VPWIN.y+"px";
}
function _vpwDragStart(e){
  if(e.button!=null&&e.button!==0)return;
  if(e.target&&e.target.closest&&e.target.closest("button"))return;   // the bar's own buttons are not a handle
  const win=VPWIN.el; if(!win)return;
  const r=win.getBoundingClientRect();
  VPWIN.drag={dx:e.clientX-r.left,dy:e.clientY-r.top,id:e.pointerId};
  win.classList.add("is-dragging");
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_){}
  e.preventDefault();
}
function _vpwDragMove(e){
  const d=VPWIN.drag; if(!d||d.id!==e.pointerId)return;
  _vpwPlace(e.clientX-d.dx,e.clientY-d.dy);
}
function _vpwDragEnd(){
  if(!VPWIN.drag)return;
  VPWIN.drag=null;
  if(VPWIN.el)VPWIN.el.classList.remove("is-dragging");
  _vpwSave();
}
function _vpwClamp(){ if(VPWIN.el&&VPWIN.x!=null)_vpwPlace(VPWIN.x,VPWIN.y); }
// ---------- open / close ----------
function vpWinOpen(){
  _vpwLoad();
  if(VPWIN.el||VPWIN.docked)return;
  const card=document.getElementById("pose3dCard"); if(!card)return;
  const win=document.createElement("div");
  win.className="rf-float vpwin"; win.id="vpWin";
  win.setAttribute("role","dialog");
  win.setAttribute("aria-label","Sterowanie ręczne kapslem — okienko, które można przeciągnąć");
  win.innerHTML=`<div class="rf-float-bar" id="vpWinBar">
      <span class="rf-float-grip" aria-hidden="true">⠿</span>
      <span class="rf-float-title">Sterowanie ręczne kapslem</span>
      <button type="button" class="rf-float-btn" id="vpWinPin" title="Przypnij kartę z powrotem na jej miejsce">⇱</button>
      <button type="button" class="rf-float-btn rf-float-x" id="vpWinClose" title="Koniec sterowania ręcznego — kapsel wraca do własnego ruchu">✕</button>
    </div>
    <div class="rf-float-body" id="vpWinBody"></div>`;
  document.body.appendChild(win);
  // remember the exact slot so the card goes back where it was, not merely "somewhere in the tab"
  VPWIN.parent=card.parentNode; VPWIN.next=card.nextElementSibling; VPWIN.el=win;
  VPWIN.body=win.querySelector("#vpWinBody");
  VPWIN.body.appendChild(card);
  card.classList.add("in-vpwin");
  // a placeholder in the emptied slot — a panel that simply vanishes reads as a bug
  const hole=document.createElement("div");
  hole.className="card vpwin-hole"; hole.id="vpWinHole";
  hole.innerHTML=`<div class="vpwin-hole-t">Orientacja 3D jest teraz w osobnym okienku</div>
    <div class="vpwin-hole-s">Przeciągnij je za pasek tam, gdzie potrzebujesz — albo przypnij z powrotem tutaj.</div>
    <button type="button" class="btn sm" id="vpWinHoleBtn">⇱ Przypnij z powrotem</button>`;
  if(VPWIN.parent)VPWIN.parent.insertBefore(hole,VPWIN.next||null);
  VPWIN.hole=hole;
  const bar=win.querySelector("#vpWinBar");
  bar.addEventListener("pointerdown",_vpwDragStart);
  bar.addEventListener("pointermove",_vpwDragMove);
  bar.addEventListener("pointerup",_vpwDragEnd);
  bar.addEventListener("pointercancel",_vpwDragEnd);
  win.querySelector("#vpWinPin").onclick=()=>vpWinDock(true);
  win.querySelector("#vpWinClose").onclick=()=>{ if(typeof vpStop==="function")vpStop(); };
  hole.querySelector("#vpWinHoleBtn").onclick=()=>vpWinDock(true);
  if(!VPWIN._wired){VPWIN._wired=true;window.addEventListener("resize",_vpwClamp);}
  // first run: top-right, clear of the header — afterwards wherever the user last left it
  if(VPWIN.x==null||VPWIN.y==null)_vpwPlace(Math.max(12,window.innerWidth-win.offsetWidth-24),84);
  else _vpwPlace(VPWIN.x,VPWIN.y);
  vpWinBtn();
}
function vpWinClose(){
  const win=VPWIN.el; if(!win)return;
  const card=document.getElementById("pose3dCard");
  if(card){
    card.classList.remove("in-vpwin");
    if(VPWIN.parent&&VPWIN.parent.isConnected)VPWIN.parent.insertBefore(card,VPWIN.hole||VPWIN.next||null);
    else document.body.appendChild(card);        // its tab is gone (should not happen) — never lose the card
  }
  if(VPWIN.hole&&VPWIN.hole.parentNode)VPWIN.hole.parentNode.removeChild(VPWIN.hole);
  win.remove();
  VPWIN.el=VPWIN.body=VPWIN.hole=null; VPWIN.drag=null;
  vpWinBtn();
}
// dock = keep driving by hand, just put the card back in the page (and remember that choice)
function vpWinDock(dock){
  _vpwLoad();
  VPWIN.docked=!!dock; _vpwSave();
  if(VPWIN.docked)vpWinClose();
  else if(typeof VPUCK!=="undefined"&&VPUCK.on)vpWinOpen();
  vpWinBtn();
}
// the one button that switches between the two, sitting in the manual-control row itself
function vpWinBtn(){
  const b=document.getElementById("poseVWin"); if(!b)return;
  const floating=!!VPWIN.el;
  b.textContent=floating?"⇱ Przypnij":"🗗 Okienko";
  b.title=floating?"Przypnij kartę z powrotem na jej miejsce"
                  :"Otwórz sterowanie w osobnym okienku, które można przeciągnąć po ekranie";
  b.setAttribute("aria-pressed",floating?"true":"false");
}
// called from vpUpdateUi — the single place that knows whether a hand is on the capsule
//
// OKNO PRZESTAŁO SIĘ OTWIERAĆ SAMO (2026-08-30, etap 9b). „Steruj
// ręcznie” w osobnym oknie miało sens, gdy nie było prawej kolumny. Teraz
// jest, więc sterowanie zostaje po prawej, a okno nie otwiera się samo.
//
// Powód jest konkretny, nie estetyczny: prawa kolumna ma teraz PEŁNĄ kulę, którą się chwyta —
// a okno wyskakiwało domyślnie w prawym górnym rogu, czyli DOKŁADNIE NAD nią. Włączenie
// sterowania zasłaniało ster. Do tego okno dublowało to samo, co kolumna, więc na ekranie były
// dwie identyczne kule i żadna nie była „tą właściwą".
//
// CO ZOSTAŁO. Cały mechanizm okna jest nietknięty: `vpWinOpen`/`vpWinClose`/`vpWinDock` działają
// jak działały, pasek do przeciągania, zaślepka i zapamiętane położenie też. Zmienia się JEDNO:
// tryb ręczny już go nie otwiera. Wejściem zostaje przycisk `#poseVWin` („🗗 Okienko") w pasku
// sterowania na karcie „Orientacja 3D" w zakładce Czujnik — czyli okno jest teraz WYBOREM (przydaje
// się, gdy ktoś chce mieć kapsel nad grą na drugim ekranie), a nie trasą, którą trzeba przejść.
// ZAMYKANIE zostaje automatyczne: koniec sterowania musi sprzątnąć okno, bo inaczej zostałaby
// pływająca karta bez paska sterowania w środku.
function vpFloat(on){
  _vpwLoad();
  if(on)vpWinBtn();          // tylko odśwież napis przycisku — NIE otwieraj
  else vpWinClose();
}
