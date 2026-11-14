// ============================================================================
//  KLIK W PUNKCIE EKRANU — akcja mapowania, która idzie w MIEJSCE, nie w klawisz.
//
//  Cała reszta akcji („a", „ctrl+c", „mouse:left", „pad:a") trafia tam, gdzie
//  akurat patrzy system: do aktywnego okna, pod kursor. Ta jedna ma adres —
//  `mouse:left@960,540` klika w punkt ekranu, `mouse:right@50%,50%` w środek
//  pulpitu, `mouse:left@960,540:800` przyciska tam na 0,8 s, `mouse:move@0,0`
//  tylko przestawia kursor.
//
//  Dlaczego to osobny plik, a nie kolejne pole w edytorze: sam wybór punktu to
//  własny tryb pracy (odpytywanie kursora, odliczanie, jednostki), a edytor
//  reguł ma już swoje 1000 linii. Tu jest komplet — składanie i rozbieranie
//  specyfikacji, panel, wskazywanie punktu — i nic z tego nie jest potrzebne
//  nikomu poza edytorem.
//
//  Współrzędne to te same, którymi Windows opisuje kursor: CAŁY pulpit, więc
//  monitor po lewej od głównego ma wartości ujemne. Procenty liczą się od tego
//  samego całego pulpitu i są jedyną formą, która przeżyje wysłanie zestawu
//  komuś z innym ekranem — 960,540 to środek u mnie i przypadkowe miejsce u
//  kogoś innego, 50%,50% to środek u obojga.
// ============================================================================
// EVERYTHING this file writes into the page is written in Polish and translated by applyLang /
// the MutationObserver — the static parts from the pairs in rf-01, the ones with numbers in them
// ("kursor: 940, 512 — biorę za 3 s") from I18N_EN_PATTERNS. Composing them with _gl() at write
// time would look identical and be wrong in one specific way: a string written while the panel
// was in Polish would stay Polish after the switch, and the live readout is rewritten five times
// a second, so it would be the one thing on screen still speaking the old language.
// The single exception is ptSpecLabel below — that is a VALUE (a rule's action name), painted
// into rows that re-render constantly, and keyLabel next to it works exactly the same way.
const PT_MODES=[["click","jeden klik"],["double","dwuklik"],
                ["holdms","przytrzymanie przez…"],["holdcond","trzymaj, dopóki trwa warunek"]];
const PT_BTNS=[["left","lewym"],["right","prawym"],["middle","środkowym"],
               ["move","bez klikania, sam kursor"]];
const PT_BTN_PL={left:"lewym",right:"prawym",middle:"środkowym"};
const PT_BTN_EN={left:"left",right:"right",middle:"middle"};

// --- specyfikacja: składanie i rozbieranie ---------------------------------
function ptCoordText(v,unit){
  // Two decimals, because one is not enough to survive a round trip: 0,1% of a 1707 px desktop is
  // almost 2 px, so switching the unit there and back moved the point off the button it was on.
  if(unit==="pct"){const n=Math.round(Math.max(-100,Math.min(200,+v||0))*100)/100;return n+"%";}
  return String(Math.round(+v||0));
}
function ptCoordParse(tok){
  const t=String(tok||"").trim();
  if(!t)return null;
  if(t.endsWith("%")){const v=parseFloat(t.slice(0,-1));return isFinite(v)?{v:v,pct:true}:null;}
  const v=parseFloat(t);return isFinite(v)?{v:Math.round(v),pct:false}:null;
}
// "mouse:left@960,540:800" -> {btn,mode,x,y,unit,ms}. null = to nie jest punkt ALBO nie da się
// go pokazać w panelu (np. ręcznie wpisane "50%,540" — mieszane jednostki). Silnik i tak taką
// specyfikację wykona; panel po prostu nie udaje, że umie ją edytować.
function ptParse(spec){
  const l=String(spec||"").trim().toLowerCase();
  if(!l.startsWith("mouse:"))return null;
  let rest=l.slice(6);const at=rest.indexOf("@");if(at<0)return null;
  let name=rest.slice(0,at).trim();rest=rest.slice(at+1);
  let ms=null;const c=rest.indexOf(":");
  if(c>=0){const n=parseInt(rest.slice(c+1),10);if(!isFinite(n))return null;ms=n;rest=rest.slice(0,c);}
  const xy=rest.split(",");if(xy.length!==2)return null;
  const cx=ptCoordParse(xy[0]),cy=ptCoordParse(xy[1]);
  if(!cx||!cy||cx.pct!==cy.pct)return null;
  let btn="left",mode="click";
  if(name==="move"||name==="moveto"||name==="goto"){btn="move";}
  else if(name==="double"||name==="doubleclick"||name==="dbl"){mode="double";}
  else if(name==="left"||name==="click"||name==="leftclick"){btn="left";}
  else if(name==="right"||name==="rightclick"){btn="right";}
  else if(name==="middle"||name==="middleclick"){btn="middle";}
  else return null;
  if(ms)mode="holdms";
  return {btn:btn,mode:mode,x:cx.v,y:cy.v,unit:cx.pct?"pct":"px",ms:ms||500};
}
function ptBuild(p){
  const x=ptCoordText(p.x,p.unit),y=ptCoordText(p.y,p.unit);
  if(p.btn==="move")return "mouse:move@"+x+","+y;
  if(p.mode==="double")return "mouse:double@"+x+","+y;
  if(p.mode==="holdms")return "mouse:"+p.btn+"@"+x+","+y+":"+Math.max(1,Math.min(10000,Math.round(+p.ms||500)));
  return "mouse:"+p.btn+"@"+x+","+y;   // jeden klik oraz „trzymaj póki warunek" (to drugie robi zachowanie reguły)
}
// Nazwa dla list, dziennika i podglądu makra. Składana od razu w bieżącym języku (tak jak
// keyLabel), bo tekst z liczbami w środku nie da się dopasować słownikiem par.
function ptSpecLabel(spec){
  const p=ptParse(spec);if(!p)return null;
  const en=(typeof _lang!=="undefined"&&_lang==="en");
  const xy="("+ptCoordText(p.x,p.unit)+","+ptCoordText(p.y,p.unit)+")";
  if(p.btn==="move")return "🖱 "+(en?"Cursor to ":"Kursor do ")+xy;
  if(p.mode==="double")return "🖱 "+(en?"Double-click at ":"Dwuklik w ")+xy;
  const b=en?PT_BTN_EN[p.btn]:PT_BTN_PL[p.btn];
  const base="🖱 "+(en?("Click "+b+" at "):("Klik "+b+" w "))+xy;
  return p.mode==="holdms"?(base+" · "+p.ms+" ms"):base;
}

// --- panel -----------------------------------------------------------------
function ptState(){
  const s=state._pt||(state._pt={open:false,target:"key",btn:"left",mode:"click",
                                 x:0,y:0,unit:"px",ms:500,screen:null,pick:0});
  return s;
}
// Panel otwiera się sam, gdy edytowana reguła JEST klikiem w punkcie — inaczej jedyną informacją
// o współrzędnych byłby napis „mouse:left@960,540" w polu tekstowym, którego nikt nie ma jak
// poprawić inaczej niż literowo.
function ptSyncFromDraft(){
  const d=state._draft;if(!d)return;
  const s=ptState();
  if(d.actionMode==="seq")return;                 // w makrze punkt wstawia się z biblioteki
  const p=ptParse(d.keySpec);
  if(!p){if(s.autoOpen){s.open=false;s.autoOpen=false;}return;}
  // Only when the rule says something DIFFERENT from what the panel is already showing. The editor
  // re-renders on every field change, and a blind re-sync would undo the choice that caused the
  // re-render — most visibly "trzymaj, dopóki trwa warunek", which builds the very same spec as a
  // plain click (it is the rule's behaviour that differs) and so was reset to "jeden klik" before
  // the person could press Ustaw.
  if(s.open&&ptBuild(s)===String(d.keySpec||"").trim().toLowerCase())return;
  s.btn=p.btn;s.unit=p.unit;s.x=p.x;s.y=p.y;s.ms=p.ms;s.touched=true;
  s.mode=(p.mode==="click"&&d.behavior==="hold")?"holdcond":p.mode;
  s.open=true;s.autoOpen=true;s.target="key";
}
function ptBoxHtml(d){
  const s=ptState();
  if(!s.open)return "";
  const seq=(d&&d.actionMode==="seq");
  const modes=PT_MODES.filter(m=>!(seq&&m[0]==="holdcond")).map(m=>
    `<option value="${m[0]}" ${s.mode===m[0]?"selected":""}>${m[1]}</option>`).join("");
  const btns=PT_BTNS.map(b=>`<option value="${b[0]}" ${s.btn===b[0]?"selected":""}>${b[1]}</option>`).join("");
  const isMove=s.btn==="move",isHold=(!isMove&&s.mode==="holdms");
  const sc=s.screen;
  const scTxt=sc?("pulpit "+sc.sw+"×"+sc.sh):"pulpit: nie znam rozmiaru";
  const spec=ptBuild(s);
  return `<div class="fld col2 edpoint" id="edPointBox">
    <div class="edpoint-h"><span>🖱 Punkt na ekranie</span>
      <button class="btn sm" type="button" id="edPtClose" title="Zwiń">✕</button></div>
    <div class="edpoint-row">
      <label class="edpoint-f">X <input id="edPtX" type="number" step="1" value="${s.x}"></label>
      <label class="edpoint-f">Y <input id="edPtY" type="number" step="1" value="${s.y}"></label>
      <select id="edPtUnit">
        <option value="px" ${s.unit==="px"?"selected":""}>piksele</option>
        <option value="pct" ${s.unit==="pct"?"selected":""}>% pulpitu</option></select>
      <button class="btn sm${s.pick?" on":""}" type="button" id="edPtPick">${s.pick?"⏹ Weź teraz":"🎯 Wskaż kursorem…"}</button>
      <span class="edpoint-live" id="edPtLive">${scTxt}</span>
    </div>
    <div class="edpoint-row">
      <label class="edpoint-f">Klikaj <select id="edPtBtn">${btns}</select></label>
      <label class="edpoint-f" style="${isMove?"display:none":""}">Sposób <select id="edPtMode">${modes}</select></label>
      <label class="edpoint-f" style="${isHold?"":"display:none"}">przez
        <input id="edPtMs" type="number" min="1" max="10000" step="50" value="${s.ms}"> ms</label>
    </div>
    <div class="edpoint-row edpoint-out">
      <span class="edspec">→ <b>${esc(spec)}</b></span>
      <button class="btn sm" type="button" id="edPtTest">Testuj</button>
      <button class="btn sm primary" type="button" id="edPtApply">${seq?"Dodaj do makra":"Ustaw jako akcję"}</button>
    </div>
    <div class="edpoint-note">Kursor skacze w to miejsce i klika w to, co się tam akurat znajduje. Działa w oknach, menu i grach z widocznym kursorem; gry czytające mysz „surowo” (FPS) potrafią taki skok zignorować. Piksele są przypisane do TWOJEGO ekranu, więc zestaw dla innej osoby zapisz w procentach. Przy wysyłce zestawu taka reguła liczy się jako ryzykowna i tryb bezpieczny ją pominie.</div>
    <div class="edpoint-note">Gdy okno musi zdążyć zauważyć najechanie, użyj makra: <code>mouse:move@x,y; wait 60; mouse:left</code></div>
  </div>`;
}

function ptWire(){
  const $=id=>document.getElementById(id),s=ptState(),d=state._draft;
  if(!$("edPointBox"))return;
  const redraw=()=>{if(typeof renderEditor==="function")renderEditor();};
  if($("edPtClose"))$("edPtClose").onclick=()=>{ptPickStop();s.open=false;s.autoOpen=false;redraw();};
  if($("edPtX"))$("edPtX").oninput=e=>{s.x=+e.target.value||0;s.touched=true;ptUpdOut();};
  if($("edPtY"))$("edPtY").oninput=e=>{s.y=+e.target.value||0;s.touched=true;ptUpdOut();};
  if($("edPtMs"))$("edPtMs").oninput=e=>{s.ms=Math.max(1,Math.min(10000,+e.target.value||500));ptUpdOut();};
  // Zmiana jednostki PRZELICZA to, co już jest w polach — inaczej „960" po przełączeniu na
  // procenty znaczyłoby 960% pulpitu, czyli punkt daleko poza ekranem.
  if($("edPtUnit"))$("edPtUnit").onchange=e=>{
    const to=e.target.value==="pct"?"pct":"px";
    if(to!==s.unit){const c=ptConvert(s.x,s.y,s.unit,to);
      if(c){s.x=c[0];s.y=c[1];s.unit=to;s.touched=true;}
      else{e.target.value=s.unit;flashTrigMsg("Nie znam rozmiaru pulpitu, zostaję przy pikselach");}}
    redraw();};
  if($("edPtBtn"))$("edPtBtn").onchange=e=>{s.btn=e.target.value;redraw();};
  if($("edPtMode"))$("edPtMode").onchange=e=>{s.mode=e.target.value;redraw();};
  if($("edPtPick"))$("edPtPick").onclick=()=>{s.pick?ptPickTake():ptPickStart();};
  if($("edPtTest"))$("edPtTest").onclick=()=>{if(typeof testKey==="function")testKey(ptBuild(s));};
  if($("edPtApply"))$("edPtApply").onclick=()=>{
    const spec=ptBuild(s);
    if(d&&d.actionMode==="seq"){
      if(typeof insertSeqToken==="function")insertSeqToken(spec);
      flashTrigMsg("Dodano do makra: "+spec);
      return;
    }
    if(!d)return;
    d.keySpec=spec;
    // „Trzymaj, dopóki trwa warunek" to nie jest inna akcja, tylko inne ZACHOWANIE reguły —
    // ta sama specyfikacja, wciśnięcie na zboczu i puszczenie po zejściu poniżej progu.
    if(s.mode==="holdcond")d.behavior="hold";
    else if(d.behavior==="hold"&&s.mode!=="holdcond")d.behavior="once";
    redraw();
    flashTrigMsg("Akcja: "+(ptSpecLabel(spec)||spec));
  };
}
function ptUpdOut(){
  const box=document.getElementById("edPointBox");if(!box)return;
  const b=box.querySelector(".edspec b");if(b)b.textContent=ptBuild(ptState());
}
// A brand-new point starts in the MIDDLE of the desktop, not at 0,0. The corner is a real
// coordinate but never the one anybody wants, and it reads as "the field is empty" — the middle
// is at least somewhere on screen to test against.
function ptCenterIfFresh(){
  const s=ptState();
  if(s.touched||!s.screen)return false;
  if(s.unit==="pct"){s.x=50;s.y=50;}
  else{s.x=Math.round(s.screen.sx+s.screen.sw/2);s.y=Math.round(s.screen.sy+s.screen.sh/2);}
  return true;
}
function ptConvert(x,y,from,to){
  const sc=ptState().screen;if(!sc||!sc.sw||!sc.sh)return null;
  if(from===to)return [x,y];
  if(to==="pct")return [Math.round((x-sc.sx)/sc.sw*10000)/100,Math.round((y-sc.sy)/sc.sh*10000)/100];
  return [Math.round(sc.sx+x/100*sc.sw),Math.round(sc.sy+y/100*sc.sh)];
}

// --- wskazywanie punktu kursorem -------------------------------------------
// Panel nie widzi kursora poza własnym oknem, więc pozycję podaje serwer (GET /cursor). Stąd
// odliczanie zamiast „kliknij, gdy będziesz na miejscu": kliknięcie na ekranie jest dla tej
// strony niewidoczne, a przepisywanie współrzędnych z oka kończy się regułą obok przycisku.
//
// ODLICZANIE MÓWI CZASZKA (2026-09-10). Wskazując punkt patrzy się na CEL
// — ikonę na drugim końcu pulpitu, przycisk w cudzym oknie — a nie na napis wielkości 11 px
// wciśnięty między pola X i Y w edytorze reguł. Sekundy szły więc dokładnie tam, gdzie w tej
// jednej chwili nikt nie patrzy. Teraz niesie je bąbel czaszki w rogu (rf-06): jeden na całe
// odliczanie, widoczny kątem oka i kończący się wynikiem. Pasek w panelu zostaje bez zmian dla
// kogoś, kto akurat patrzy na panel — to ta sama treść, nie druga wersja.
function ptNoteEnd(note,msg,tone){
  // Bąbel dopowiada, czym się skończyło, i gaśnie sam. Zdjęty w pół słowa zostawiałby człowieka
  // patrzącego na cel bez odpowiedzi, czy punkt w ogóle został wzięty.
  if(note&&typeof rfNoteSet==="function"&&rfNoteSet(note,msg,{ms:2600,tone:tone||"",say:true}))return;
  if(typeof rfSkullNote==="function")rfSkullNote(msg,tone?{tone:tone}:undefined);
}
function ptPickStart(){
  const s=ptState();
  ptPickStop();
  s.pick=5;
  const live=document.getElementById("edPtLive"),btn=document.getElementById("edPtPick");
  if(btn){btn.textContent="⏹ Weź teraz";btn.classList.add("on");}
  s._note=(typeof rfSkullNote==="function")
    ? rfSkullNote("ustaw kursor na celu…",{ms:0,polite:true}) : null;
  const say=()=>{const t=s.last?("kursor: "+s.last[0]+", "+s.last[1]+" · biorę za "+s.pick+" s")
                              :"nie widzę kursora";
    const el=document.getElementById("edPtLive");if(el)el.textContent=t;
    if(s._note&&typeof rfNoteSet==="function")rfNoteSet(s._note,t);};
  s._poll=setInterval(()=>{
    fetch("/cursor").then(r=>r.json()).then(j=>{
      if(!j)return;
      if(j.sw&&j.sh)s.screen={sx:j.sx,sy:j.sy,sw:j.sw,sh:j.sh};
      s.last=(j.ok&&j.x!=null)?[j.x,j.y]:null;
      say();
    }).catch(()=>{});
  },140);
  s._tick=setInterval(()=>{
    s.pick--;
    if(s.pick<=0)ptPickTake();else say();
  },1000);
  s._esc=e=>{if(e.key==="Escape"){
    const note=s._note;s._note=null;                  // bąbel ma powiedzieć „anulowane", nie zniknąć
    ptPickStop();
    ptNoteEnd(note,"Wskazywanie punktu anulowane");
    flashTrigMsg("Wskazywanie punktu anulowane");
    if(typeof renderEditor==="function")renderEditor();}};
  window.addEventListener("keydown",s._esc,true);
  if(live)live.textContent="ustaw kursor na celu…";
}
function ptPickTake(){
  const s=ptState(),got=s.last,note=s._note;
  s._note=null;                        // zabieramy bąbel spod ptPickStop — dokończy zdanie sam
  ptPickStop();
  if(!got){ptNoteEnd(note,"Nie udało się odczytać pozycji kursora","danger");
    flashTrigMsg("Nie udało się odczytać pozycji kursora");return;}
  s.touched=true;
  if(s.unit==="pct"){const c=ptConvert(got[0],got[1],"px","pct");
    if(c){s.x=c[0];s.y=c[1];}else{s.unit="px";s.x=got[0];s.y=got[1];}}
  else{s.x=got[0];s.y=got[1];}
  if(typeof renderEditor==="function")renderEditor();
  const pt="Punkt: "+ptCoordText(s.x,s.unit)+", "+ptCoordText(s.y,s.unit);
  ptNoteEnd(note,pt);
  flashTrigMsg(pt);
}
function ptPickStop(){
  const s=ptState();
  if(s._poll){clearInterval(s._poll);s._poll=null;}
  if(s._tick){clearInterval(s._tick);s._tick=null;}
  if(s._esc){window.removeEventListener("keydown",s._esc,true);s._esc=null;}
  // Bąbel bez zdania na koniec (zwinięty panel, ponowny start odliczania) schodzi po cichu.
  // Ten z puentą jest wcześniej zabierany z `s._note` przez ptPickTake / Escape.
  if(s._note){try{if(typeof rfNoteClose==="function")rfNoteClose(s._note);}catch(e){}s._note=null;}
  s.pick=0;
}
// Otwarcie panelu z przycisku edytora albo z biblioteki elementów makra.
function ptOpen(target){
  const s=ptState();
  s.target=(target==="seq")?"seq":"key";
  s.open=true;s.autoOpen=false;
  if(!s.screen)fetch("/cursor").then(r=>r.json()).then(j=>{
    if(!j||!j.sw||!j.sh)return;
    s.screen={sx:j.sx,sy:j.sy,sw:j.sw,sh:j.sh};
    // The desktop size arrives one round trip after the panel is drawn, so the default point can
    // only be centred once it is here — hence the redraw rather than a value set before render.
    if(ptCenterIfFresh()&&typeof renderEditor==="function"){renderEditor();return;}
    const el=document.getElementById("edPtLive");
    if(el)el.textContent="pulpit "+j.sw+"×"+j.sh;
  }).catch(()=>{});
  ptCenterIfFresh();
  if(typeof renderEditor==="function")renderEditor();
}
