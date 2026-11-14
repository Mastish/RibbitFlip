"use strict";
// ===================== RECORDED GESTURES — the recorder, its API and the stream events =====================
// The other way to write a trigger: instead of an axis, a threshold and a behaviour, the person
// RECORDS a movement with the capsule and the rule fires whenever a similar movement is made
// again. The judging lives on the server (ribbitflip_gesture.py); this file is the panel's half
// of the recorder — starting and stopping a session, catching the takes it sends on the stream,
// asking the server what it thinks of them, and keeping the draft's live "trial" verdict up to
// date. The editor screens that use it (the simple mode and the „Gest" condition card) are in
// rf-12e; the rule-list/cheat-sheet labels are in rf-10.
//
// A recording is a raw window of samples packed by the server (base64 in `takes[i].d`). The panel
// never looks inside: it counts them, deletes them and sends them back for analysis. That keeps
// one implementation of the signal path, on the side that has the real clock.
//
// TWO WAYS TO RECORD, because the automatic cut has one weakness: a gesture with a stop in the
// middle (a double flick with a longer pause) gets closed at the stop and the recording ends
// early. „Automatycznie" cuts by itself (every clear movement followed by rest is one take) and
// lets the person LENGTHEN the pause that ends a gesture; „Ręcznie: Start / Stop" takes exactly
// what happened between the two clicks and measures the longest stop inside it, so the panel can
// widen that pause for recognition too — otherwise the live stream would be cut at the very same
// stop and the gesture could never match its own recording.
const GEST_LS_REC="ribbitflip.gest.recmode";    // last recording mode (auto | manual)
try{localStorage.removeItem("ribbitflip.gest.mode");}catch(e){}   // dawna pamięć trybu nowej reguły (P-G1-05)
const GEST_TAKES_MAX=5;
const GEST={
  rec:null,          // the session THIS editor started: {cc, mode, target, got, msg}
  recCc:null,        // which condition of the draft is being recorded (-1 = main)
  recErr:"",recErrCc:null,   // last recorder error and which condition's box shows it
  recTakes:3,        // how many repetitions an automatic session collects
  trial:null,        // last verdict on the draft: {sim, accepted, why, intensity, durRatio, at}
  trialCc:-1,        // which condition the trial follows
  last:{},           // ckey -> {sim, accepted, at} — verdicts on SAVED rules of the active capsule
  analysis:{},       // cc -> last /gesture/analyze answer for the draft
  meta:{},           // cc -> [{duration, peak, pauseMs}] per take, as the recorder reported them
  anSeq:0,analyzeT:null,
  // THE LIVE PICTURE (see gestScopeDraw). `ene` is the ring of points the server sends while an
  // editor is open — [ts, energy °/s, state 0..2, start line, end line]. Kept here and not on the
  // capsule entry because it exists only for as long as somebody is looking at a recorder.
  ene:[],eneAt:0,watchOn:false,watchHold:0,watchT:null,scopeRaf:0,
  trialOn:false,     // a trial is set on the server (so closing the editor has something to clear)
  flashAt:0,         // when the last take landed (the live box blinks once)
  hotUntil:0,hotT:null,   // „Gotowe! Teraz wykonaj gest jeszcze raz" stays lit this long after a recording
  // The editor the NEXT new rule opens in, set by the door that opens it (gestNewRule, a start
  // tile) and put back to „advanced” once it has opened. Not remembered (UX 261120, P-G1-05):
  // a remembered mode made „Nowy wyzwalacz” and „Nagraj gest” the same button after one use.
  mode:"advanced",
  recMode:(()=>{try{return localStorage.getItem(GEST_LS_REC)==="manual"?"manual":"auto";}catch(e){return "auto";}})(),
};
// Module dictionary, merged into the panel's (same pattern as rf-39b / rf-39c). Keys are the
// exact Polish texts of the templates below; composed sentences go through _gl() instead.
const RF_GEST_I18N={
  "Tryb edycji":"Editing mode","Prosty — nagraj gest":"Simple — record a gesture","Zaawansowany":"Advanced",
  "Nagrywasz gest kapslem, wskazujesz akcję i gotowe":"You record a gesture with the capsule, pick the action and you are done",
  "Pełna kontrola: warunki na osiach, filtrze 3D i przycisku, łączenie warunków, zachowania i czasy":"Full control: conditions on axes, the 3D filter and the button, combined conditions, behaviours and timings",
  "Kapsel uczy się gestu z nagrania; w trybie zaawansowanym ustawisz każdy próg i warunek sam.":"The capsule learns the gesture from a recording; in the advanced mode you set every threshold and condition yourself.",
  "Wszystkie źródła, warunki i zachowania. Tryb prosty nagrywa gest i sam dobiera próg.":"Every source, condition and behaviour. The simple mode records a gesture and picks the threshold by itself.",
  "Gest — nagraj i powtórz":"Gesture — record and repeat",
  "Sposób nagrywania":"How to record","Automatycznie":"Automatically","Ręcznie: Start / Stop":"By hand: Start / Stop",
  "Naciśnij Nagraj i wykonaj gest kilka razy — każdy wyraźny ruch zakończony chwilą spokoju to jedno powtórzenie":"Press Record and make the gesture a few times — every clear movement followed by a moment of rest is one repetition",
  "Jeden przycisk: Start, wykonaj gest, Stop — jedno powtórzenie. Dla gestów, które mają w środku zatrzymanie":"One button: Start, make the gesture, Stop — one repetition. For gestures with a stop in the middle",
  "Powtórzeń":"Repetitions","Przerwa kończąca gest":"Pause that ends the gesture",
  "Ile spokoju kończy gest. Jeśli nagranie urywa się w środku gestu (bo gest ma w sobie zatrzymanie), wydłuż tę przerwę — wtedy i przy rozpoznawaniu kapsel poczeka dłużej, zanim uzna gest za skończony":"How much rest ends a gesture. If the recording stops in the middle of the gesture (because the gesture has a stop in it), lengthen this pause — the capsule will then also wait longer before it calls a gesture finished when recognising it",
  "● Nagraj":"● Record","● Nagraj więcej":"● Record more","● Start":"● Start","■ Stop":"■ Stop","■ Zakończ":"■ Finish","Anuluj":"Cancel",
  "Maksymalnie 5 nagrań — usuń któreś, żeby dograć":"At most 5 recordings — delete one to record more",
  "Usuń to nagranie":"Delete this recording",
  "Sprawdź: wykonaj gest jeszcze raz":"Check: make the gesture once more",
  "Gotowe! Teraz wykonaj gest jeszcze raz, żeby sprawdzić rozpoznawanie":"Done! Now make the gesture once more to check the recognition",
  "Naciśnij Nagraj i wykonaj gest kilka razy z krótkimi przerwami — każdy wyraźny ruch to jedno powtórzenie.":"Press Record and make the gesture a few times with short pauses — every clear movement is one repetition.",
  "Naciśnij Start, wykonaj gest (może mieć w środku zatrzymanie) i naciśnij ten sam przycisk — stoi na nim już „Stop”. Powtórz dwa–trzy razy.":"Press Start, make the gesture (it may have a stop in the middle) and press the same button — it says “Stop” by then. Repeat two or three times.",
  // the live picture above the recordings (rf-12d gestScopeDraw)
  "Ruch kapsla na żywo":"The capsule's movement, live",
  // the two doors under the start tiles (rf-10) and on the Controller bar (rf-43)
  "Nagraj gest":"Record a gesture","Ustaw ręcznie":"Set up manually",
  "Nagraj gest kapslem, który wciśnie ten przycisk pada":"Record a capsule gesture that presses this pad button",
  // the simple mode's steps and its „what is still missing" line
  "Do zapisu brakuje:":"Still missing before saving:","nagrania gestu":"a recording of the gesture","akcji":"an action",
  "Wszystko gotowe — zapisz":"All set — save",
  "⚠ Położenie startowe ma znaczenie. Kapsel rozpozna gest tylko wtedy, gdy zaczniesz go z podobnego ułożenia co przy nagraniu. Zapamiętaj, jak trzymasz kapsel na starcie, i zaczynaj każdy gest tak samo.":"⚠ The starting position matters. The capsule recognises the gesture only when you start it from a position like the one in the recording. Remember how you hold the capsule at the start and begin every gesture the same way.",
  "Jak dokładnie trzeba powtórzyć gest?":"How exactly does the gesture have to be repeated?",
  "luźno":"loosely","normalnie":"normally","dokładnie":"exactly",
  "Gest łapie się za rzadko → przesuń w lewo. Odpala na byle ruch → w prawo. Po lewej siła i tempo gestu nie mają znaczenia, po prawej muszą być jak w nagraniu.":"The gesture is caught too rarely → move left. It fires on any movement → move right. On the left the strength and tempo of the gesture do not matter, on the right they have to be like in the recording.",
  "Jak wygląda ten gest?":"What does this gesture look like?",
  "np. kapsel płasko, szybkie machnięcie w prawo":"e.g. capsule flat, a quick flick to the right",
  "Opis stoi przy regule na liście i na ściądze nad grą — dla Ciebie i dla każdego, komu wyślesz ten zestaw.":"The description stands by the rule in the list and on the cheat sheet above the game — for you and for anyone you send this setup to.",
  "Więcej: warstwa, podświetlenie, dioda, powiadomienie":"More: layer, glow, LED, notification",
  "strojenie (zaawansowane)":"tuning (advanced)","Podobieństwo ≥":"Similarity ≥","Siła":"Strength","Tempo":"Tempo","Osie":"Axes",
  "żyroskop (obrót)":"gyroscope (rotation)","żyroskop + akcelerometr":"gyroscope + accelerometer","akcelerometr":"accelerometer","sama energia (bez kierunku)":"energy alone (no direction)",
  "↺ z suwaka":"↺ from the slider","Wróć do wartości z suwaka dokładności":"Back to the values from the accuracy slider",
  "Siła i tempo: dopuszczalny stosunek do nagrania (2 = od połowy do dwukrotności; 0 = bez znaczenia). Osie „żyroskop” nie zależą od tego, jak kapsel leży na starcie.":"Strength and tempo: the allowed ratio to the recording (2 = from half to double; 0 = does not matter). The “gyroscope” axes do not depend on how the capsule lies at the start.",
  "Gest":"Gesture","Nagrany gest kapsla":"A recorded capsule gesture",
  "Albo nagraj gest kapslem: w edytorze wybierz tryb":"Or record a gesture with the capsule: in the editor pick the mode",
  // the Mapping guide (rf-34), one node per paragraph
  "Nagrany gest — dwa tryby edytora":"A recorded gesture — two editor modes",
  "Obok „Nowy wyzwalacz” stoi przycisk „Nagraj gest”, a u góry edytora przełącznik „Tryb edycji”: „Prosty — nagraj gest” albo „Zaawansowany”. W trybie prostym naciskasz „Nagraj”, wykonujesz gest dwa–trzy razy, jednym suwakiem mówisz, jak dokładnie trzeba go powtórzyć, opisujesz, jak wygląda, i wskazujesz akcję; linia przy „Zapisz” mówi, czego jeszcze brakuje. Nad nagraniami stoi wykres „Ruch kapsla na żywo”: energia ruchu z ostatnich ośmiu sekund, próg „start”, który trzeba przekroczyć, poziom „koniec”, pod który trzeba zejść, i pasek u góry mówiący, kiedy kapsel jest w środku gestu. Gest, który ma w środku zatrzymanie, nagraj ręcznie jednym przyciskiem „Start / Stop” albo wydłuż „Przerwę kończącą gest” — nagrywarka sama podpowie, o ile.":"Next to “New trigger” sits a “Record a gesture” button, and at the top of the editor the “Editing mode” switch: “Simple — record a gesture” or “Advanced”. In the simple mode you press “Record”, make the gesture two or three times, say with one slider how exactly it has to be repeated, describe what it looks like and pick the action; the line by “Save” says what is still missing. Above the recordings stands the “The capsule's movement, live” chart: the motion energy of the last eight seconds, the “start” threshold a movement has to cross, the “end” level it has to fall under, and a strip along the top saying when the capsule is inside a gesture. A gesture with a stop in the middle is recorded by hand on the single “Start / Stop” button, or you lengthen the “Pause that ends the gesture” — the recorder suggests by how much.",
  "Tryb zaawansowany to pełna kontrola nad wyzwoleniami: wszystkie źródła, łączenie warunków, zachowania i czasy. Nagrany gest jest w nim piątym rodzajem warunku („Gest”), więc można go łączyć z przyciskiem, liczyć („X razy w czasie”) albo zrobić z niego przełącznik. Reguły proste i zaawansowane leżą na jednej liście, a reguła otwiera się w tym trybie, który pokaże ją w całości.":"The advanced mode is full control over what fires and when: every source, combined conditions, behaviours and timings. A recorded gesture is its fifth kind of condition (“Gesture”), so it can be combined with the button, counted (“X times in a time”) or turned into a latch. Simple and advanced rules lie in one list, and a rule opens in the mode that shows all of it.",
  "ostatni ruch":"last movement","podgląd · ostatni ruch kapsla wobec nagrania":"preview · the capsule's last movement against the recording",
  "Zachowanie dla gestu: Jednorazowo, X razy w czasie albo Przełącznik — gest jest zdarzeniem, nie stanem":"Behaviour for a gesture: Once, X times in a time or Latch — a gesture is an event, not a state",
  // the recorder's own errors (from ribbitflip_gesture.py, so the server-error harness does not see them)
  "nagrywanie już trwa":"a recording is already running",
  "brak strumienia z kapsla — połącz kapsel albo włącz sterowanie ręczne":"no stream from the capsule — connect a capsule or switch manual control on",
  "nic nie nagrywam":"nothing is being recorded",
  "Nie zauważyłem ruchu. Spróbuj jeszcze raz i machnij wyraźniej.":"I did not notice any movement. Try again and move more clearly.",
  "Nie zauważyłem ruchu między Start a Stop. Spróbuj jeszcze raz i machnij wyraźniej.":"I did not notice any movement between Start and Stop. Try again and move more clearly.",
  "Za mało próbek — czy kapsel wysyła dane?":"Too few samples — is the capsule sending data?",
};
try{Object.assign(I18N_EN,RF_GEST_I18N);}catch(e){}   // i18n module may be absent in the cheat-sheet view

function gestNewSource(){
  return {kind:"gesture",takes:[],accuracy:50,threshold:null,intensityTol:null,durationTol:null,
          channels:"gyro",endHoldMs:200,desc:""};
}
// A rule the SIMPLE mode can show without losing anything: one recorded gesture, fired once.
function gestIsSimpleRule(r){
  const s=(r&&r.source)||{};
  return s.kind==="gesture"&&!((r.extraConditions||[]).length)&&(r.behavior||"once")==="once";
}
// Which mode the editor opens in. A saved rule opens in the mode that can show ALL of it; a new
// one in the mode its door asked for (GEST.mode, one-shot).
function gestEditorModeFor(rule){
  if(!rule)return GEST.mode;
  return gestIsSimpleRule(rule)?"simple":"advanced";
}
function gestCondOf(cc){const d=state._draft;if(!d)return null;return cc<0?d:(d.extraConditions||[])[cc]||null;}
function gestSrc(cc){const c=gestCondOf(cc);const s=c&&c.source;return (s&&s.kind==="gesture")?s:null;}
function gestCcOf(el){const card=el&&el.closest&&el.closest(".ed-cond-card");return card?+card.dataset.cc:-1;}
// The three gates the accuracy slider stands for — the same mapping as accuracy_params on the
// server, so the advanced card can show the numbers the slider is choosing.
function gestAccParams(v){
  v=Math.max(0,Math.min(100,+v||0));
  const thr=50+0.4*v, seg=(a,lo,b,hi)=>lo+(hi-lo)*(v-a)/(b-a);
  let it,dt;
  if(v<20){it=0;dt=0;}else if(v<50){it=seg(20,4,50,2);dt=seg(20,3,50,1.8);}else{it=seg(50,2,100,1.4);dt=seg(50,1.8,100,1.3);}
  return {threshold:Math.round(thr*10)/10,intensityTol:Math.round(it*100)/100,durationTol:Math.round(dt*100)/100};
}
function gestParamsOf(src){
  const ap=gestAccParams(src.accuracy!=null?src.accuracy:50);
  const num=v=>(typeof v==="number"&&isFinite(v))?v:null;
  return {threshold:num(src.threshold)!=null?src.threshold:ap.threshold,
          intensityTol:num(src.intensityTol)!=null?src.intensityTol:ap.intensityTol,
          durationTol:num(src.durationTol)!=null?src.durationTol:ap.durationTol};
}
function gestAccLabel(v){v=+v||0;
  return v<20?_gl("byle jak","anyhow"):v<40?_gl("luźno","loosely"):v<60?_gl("normalnie","normally"):v<80?_gl("dokładnie","exactly"):_gl("bardzo dokładnie","very exactly");}
function gestEn(){return (typeof _lang!=="undefined"&&_lang==="en");}
function gestFmtS(x){const s=(+x||0).toFixed(1);return (gestEn()?s:s.replace(".",","))+" s";}
function gestFmtX(x){const s=(+x||0).toFixed(1);return (gestEn()?s:s.replace(".",","))+"×";}
// Every gesture request names the ACTIVE capsule itself. The fetch shim (rf-05) appends ?dev= only
// for the endpoints on its list, and a recording that landed on d0 while the person was editing
// the second capsule would be a recording of the wrong puck's rest position.
function gestPost(path,body){
  const url=path+(path.indexOf("?")<0?"?":"&")+"dev="+encodeURIComponent(state.activeDeviceId||"d0");
  return fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{})}).then(r=>r.json());
}
// „Nagraj własny gest” / „Ustaw ręcznie” — the two doors under the start tiles (rf-10) and the
// Controller bar. Each opens the editor straight in its mode; the mode is NOT remembered. `spec`
// pre-aims the action (a pad button from the Controller screen).
function gestNewRule(mode,spec){
  mode=(mode==="simple")?"simple":"advanced";
  if(typeof openEditor!=="function")return;
  // The mode is a one-shot: set BEFORE the editor renders (`gestEditorModeFor` reads it while
  // opening a NEW rule), put back to „advanced” afterwards whatever the answer to „discard the
  // unsaved draft?”, so the next plain new rule (Controller, a tile) opens the manual editor.
  GEST.mode=mode;
  const settle=()=>{GEST.mode="advanced";};
  // Through `after` for the same reason as `padNewRule` (rf-43): openEditor may first ASK about an
  // unsaved draft, so anything aimed at the NEW draft has to run in the callback — and the pad
  // button the app pre-fills refreshes the clean-draft snapshot instead of counting as an edit.
  const opened=openEditor(null,d=>{
    if(spec){d.keySpec=spec;state._draftBase=JSON.stringify(d);renderEditor();if(typeof updPadNote==="function")updPadNote();}
    try{const ed=document.getElementById("ruleEditor");if(ed)ed.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(e){}
  });
  // openEditor (rf-12) answers with a promise: true = opened, false = the person went back to the
  // draft. An older build without that answer counts as opened, which is what it always did.
  if(opened&&typeof opened.then==="function")opened.then(settle,settle); else settle();
}
// Can this capsule be recorded from right now? Said BEFORE the button is pressed: a disabled
// „Nagraj" with the reason next to it beats a click that answers with an error.
function gestCapsuleNote(){
  const dev=state.activeDeviceId||"d0", D=state.devices&&state.devices[dev];
  const name=(D&&D.meta&&D.meta.name)||dev;
  if(!D)return {ok:false,txt:_gl("Brak kapsla — dodaj go w prawej kolumnie, żeby nagrać gest.","No capsule — add one in the right column to record a gesture.")};
  if(!(D.conn==="connected"||D.conn==="sim"))
    return {ok:false,txt:_gl("Kapsel „"+name+"” nie wysyła danych — połącz go, żeby nagrać gest.","Capsule “"+name+"” is not sending data — connect it to record a gesture.")};
  if(D.conn==="sim"&&!D.virt)
    return {ok:true,txt:_gl("Symulacja: kapsel sam z siebie tylko faluje. Włącz „Steruj ręcznie” w podglądzie po prawej i poruszaj kulą, gdy nagrywasz.","Simulation: on its own the capsule only waves. Switch on “Take control” in the preview on the right and move the ball while you record.")};
  return {ok:true,txt:""};
}
// A take decoded in the panel ONLY for its thumbnail: rows of [dt_ms, ch0..ch5] (uint16 + 6×int16,
// little-endian — the pack format of ribbitflip_gesture.encode_take). Nothing else here reads
// inside a take.
function gestTakeRows(take){
  try{
    const bin=atob(String(take&&take.d||"")), n=Math.floor(bin.length/14), out=[];
    for(let i=0;i<n;i++){const o=i*14;
      const u16=a=>bin.charCodeAt(o+a)|(bin.charCodeAt(o+a+1)<<8), i16=a=>{const v=u16(a);return v>=32768?v-65536:v;};
      out.push([u16(0),i16(2),i16(4),i16(6),i16(8),i16(10),i16(12)]);}
    return out;
  }catch(e){return null;}
}
// The gyro energy of one take as a 64×16 sparkline — three chips that look alike say „the
// recordings agree" faster than a percentage does.
function gestSparkSvg(take){
  const rows=gestTakeRows(take);if(!rows||rows.length<3)return "";
  const mags=rows.map(r=>Math.hypot(r[1],r[2],r[3])), max=Math.max(1,...mags), W=64, H=16;
  const pts=mags.map((m,i)=>((i/(mags.length-1))*W).toFixed(1)+","+(H-1-(m/max)*(H-2)).toFixed(1)).join(" ");
  return `<svg class="gr-spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}

// ------------------------------------------------------------------------------------------
//  THE LIVE PICTURE — what the segmenter sees, while it sees it
// ------------------------------------------------------------------------------------------
// The chips below say what a movement BECAME. This says what is happening NOW: the motion energy
// the cut is actually made from, the line a gesture has to cross to start, the line it has to
// fall under to end — and the movement itself as a band behind the trace. Without it a gesture
// that came out too weak, or was cut in half at a pause, looked exactly like one that never
// arrived: the recorder answered „nie zauważyłem ruchu" and there was nothing to look at.
//
// The points come from the SERVER (`gene`, ~25/s while an editor is open). The thresholds and the
// three states belong to the segmenter that does the cutting; a second implementation of them
// here could only ever drift from it, and a picture that drifts is worse than no picture.
//
// Drawn in the same language as the axis plots in rf-33c — panel frame, quarter grid, mono ticks
// — because it is the same kind of picture; only the colour is the module's own.
const GEST_SCOPE_S=8;                              // seconds of history the picture holds
const GEST_SCOPE_HZ=25;                            // points a second (mirrors WATCH_HZ on the server)
const GEST_SCOPE_MIN=60, GEST_SCOPE_MAX=400;       // energy axis: never tighter, never wider (°/s)
const GEST_SCOPE_TICKS=[10,20,50,100,200,300];
const GEST_SCOPE_STALE=1.5;                        // no point for this long = the capsule went quiet
function gestScopeState(s){
  return s===1?_gl("RUCH","MOVING"):(s===2?_gl("czekam na spokój","waiting for rest"):_gl("spoczynek","at rest"));
}
// The energy axis is SQUARE-ROOTED. A flick is twenty times a wobble, and on a straight axis the
// wobble — which is what decides whether a gesture ends — is a flat line on the floor.
function gestScopeDraw(cv2){
  if(typeof fit!=="function")return;
  const {ctx,w,h}=fit(cv2); if(!w||!h)return;
  ctx.clearRect(0,0,w,h);
  const P={l:30,r:8,t:8,b:15}, pw=w-P.l-P.r, ph=h-P.t-P.b;
  if(pw<40||ph<24)return;
  const buf=GEST.ene, last=buf.length?buf[buf.length-1]:null;
  const stale=!last||((typeof performance!=="undefined"?performance.now():Date.now())-GEST.eneAt)>GEST_SCOPE_STALE*1000;
  const col=cv("--pink"), colS=cv("--warn"), colE=cv("--gx");
  ctx.fillStyle=cv("--panel");ctx.globalAlpha=.55;ctx.fillRect(P.l,P.t,pw,ph);ctx.globalAlpha=1;
  ctx.strokeStyle=cv("--line");ctx.globalAlpha=.75;ctx.lineWidth=1;
  ctx.strokeRect(P.l+.5,P.t+.5,pw-1,ph-1);ctx.globalAlpha=1;
  ctx.font="10px "+cv("--mono");
  const read=cv2.parentNode&&cv2.parentNode.querySelector("[data-gscoperead]");
  if(!last){
    if(read)read.textContent=_gl("czekam na dane z kapsla","waiting for data from the capsule");
    ctx.fillStyle=cv("--dim");ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(_gl("brak danych","no data"),P.l+pw/2,P.t+ph/2);
    return;
  }
  const t1=last[0], t0=t1-GEST_SCOPE_S;
  let emax=GEST_SCOPE_MIN;
  for(const q of buf)if(q[0]>=t0&&q[1]>emax)emax=q[1];
  emax=Math.min(GEST_SCOPE_MAX,emax*1.15);
  const X=t=>P.l+(t-t0)/GEST_SCOPE_S*pw;
  const Y=e=>P.t+ph-Math.sqrt(Math.max(0,Math.min(emax,e))/emax)*ph;
  // A RIBBON ALONG THE TOP, not a wash over everything: green while a gesture is open, amber
  // while the segmenter is waiting for the rest that closes it. Full-height tinting was the
  // prototype's answer on a dark screen; here it fought the trace's own fill and turned both to
  // mud. As a strip it still says „the capsule was inside a movement from here to here", and the
  // picture underneath stays readable.
  const bw=Math.max(1,pw/(GEST_SCOPE_S*GEST_SCOPE_HZ)*1.6), rib=5;
  for(const q of buf){
    if(q[0]<t0||!q[2])continue;
    ctx.fillStyle=(q[2]===1)?cv("--ok"):cv("--warn");ctx.globalAlpha=.55;
    ctx.fillRect(X(q[0]),P.t+1,bw,rib);
  }
  ctx.globalAlpha=1;
  // quarter grid + the levels that mean something in °/s (skipped when the square-root axis has
  // squeezed two of them into the same few pixels)
  ctx.strokeStyle=cv("--line");ctx.globalAlpha=.30;ctx.lineWidth=1;ctx.beginPath();
  for(let i=1;i<4;i++){const gx=Math.round(P.l+pw*i/4)+.5;ctx.moveTo(gx,P.t);ctx.lineTo(gx,P.t+ph);}
  ctx.stroke();ctx.globalAlpha=1;
  ctx.textAlign="right";ctx.textBaseline="middle";
  let lastY=1e9;
  for(const lvl of GEST_SCOPE_TICKS){
    if(lvl>emax)break;
    const gy=Math.round(Y(lvl))+.5;
    if(lastY-gy<11)continue;
    lastY=gy;
    ctx.strokeStyle=cv("--line");ctx.globalAlpha=.30;ctx.beginPath();ctx.moveTo(P.l,gy);ctx.lineTo(P.l+pw,gy);ctx.stroke();
    ctx.globalAlpha=1;ctx.fillStyle=cv("--dim");ctx.fillText(String(lvl),P.l-3,gy);
  }
  // The two decisions, drawn rather than described: cross the amber one and a gesture starts,
  // stay under the blue one long enough and it ends. The blue one CLIMBS with the peak — „a hand
  // that does not get back to rest still ends the gesture" is invisible without it.
  // Labels at the LEFT edge: the right edge is where the newest movement is, and a word sitting
  // on top of it is a word in the way.
  const rule=(y,color,label,below)=>{
    ctx.strokeStyle=color;ctx.globalAlpha=.85;ctx.lineWidth=1.4;ctx.setLineDash([4,3]);
    ctx.beginPath();ctx.moveTo(P.l,y);ctx.lineTo(P.l+pw,y);ctx.stroke();
    ctx.setLineDash([]);ctx.globalAlpha=1;
    ctx.fillStyle=color;ctx.textAlign="left";ctx.textBaseline=below?"top":"bottom";
    ctx.fillText(label,P.l+3,y+(below?2:-1));
  };
  // „start" above its line, „koniec" below its own: the two sit 10 and 20 °/s apart, which on a
  // square-root axis is a dozen pixels — stacked on the same side the words touch.
  rule(Math.round(Y(last[3]))+.5,colS,_gl("start","start"),false);
  if(Math.abs(Y(last[4])-Y(last[3]))>5)rule(Math.round(Y(last[4]))+.5,colE,_gl("koniec","end"),true);
  // the movement itself — filled underneath, so „ile ruchu" is a quantity and not a line to read
  const y0=P.t+ph;
  ctx.beginPath();let open=false;
  for(const q of buf){
    if(q[0]<t0)continue;
    const px=X(q[0]),py=Y(q[1]);
    if(!open){ctx.moveTo(px,y0);ctx.lineTo(px,py);open=true;}else ctx.lineTo(px,py);
  }
  if(open){ctx.lineTo(X(t1),y0);ctx.closePath();ctx.fillStyle=col;ctx.globalAlpha=.13;ctx.fill();ctx.globalAlpha=1;}
  ctx.strokeStyle=col;ctx.lineWidth=2;ctx.lineJoin="round";ctx.lineCap="round";
  ctx.globalAlpha=stale?.35:1;ctx.beginPath();open=false;
  for(const q of buf){
    if(q[0]<t0)continue;
    const px=X(q[0]),py=Y(q[1]);
    if(!open){ctx.moveTo(px,py);open=true;}else ctx.lineTo(px,py);
  }
  ctx.stroke();
  if(!stale){   // the head, so the eye finds „now" without hunting
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(X(t1),Y(last[1]),3,0,7);ctx.fill();
    ctx.strokeStyle=cv("--panel");ctx.lineWidth=1.4;ctx.stroke();
  }
  ctx.globalAlpha=1;
  ctx.fillStyle=cv("--dim");ctx.textBaseline="top";
  ctx.textAlign="left";ctx.fillText("−"+GEST_SCOPE_S+" s",P.l+2,P.t+ph+3);
  ctx.textAlign="right";ctx.fillText(_gl("teraz","now"),P.l+pw-2,P.t+ph+3);
  if(read)read.textContent=stale?_gl("brak danych z kapsla","no data from the capsule")
    :(gestScopeState(last[2])+" · "+Math.round(last[1])+" °/s");
}
// One loop for every recorder on screen; it stops by itself when the last canvas goes away, so a
// closed editor leaves nothing running.
function gestScopeTick(){
  GEST.scopeRaf=0;
  const list=document.querySelectorAll("canvas.gr-scope");
  if(!list.length)return;
  list.forEach(c=>{try{gestScopeDraw(c);}catch(e){}});
  gestScopeKick();
}
function gestScopeKick(){if(!GEST.scopeRaf)GEST.scopeRaf=requestAnimationFrame(gestScopeTick);}
// Ask this capsule for the picture — and keep asking. The server drops a watcher that goes quiet
// (WATCH_IDLE_S), so a dashboard closed with the editor open cannot leave the bus carrying points
// for nobody; the price is one tiny POST every few seconds while somebody really is looking.
function gestWatchOn(endHoldMs){
  const hold=Math.max(40,Math.min(2000,+endHoldMs||200));
  if(GEST.watchOn&&GEST.watchHold===hold)return;     // already asking for exactly this picture
  GEST.watchOn=true;GEST.watchHold=hold;
  gestPost("/gesture/watch",{on:true,endHoldMs:hold}).catch(()=>{});
  if(!GEST.watchT)GEST.watchT=setInterval(()=>{
    if(!GEST.watchOn)return;
    gestPost("/gesture/watch",{on:true,endHoldMs:GEST.watchHold}).catch(()=>{});
  },8000);
}
function gestWatchOff(){
  clearInterval(GEST.watchT);GEST.watchT=null;
  if(GEST.scopeRaf){cancelAnimationFrame(GEST.scopeRaf);GEST.scopeRaf=0;}
  GEST.ene=[];GEST.eneAt=0;
  if(!GEST.watchOn)return;
  GEST.watchOn=false;GEST.watchHold=0;
  gestPost("/gesture/watch",{on:false}).catch(()=>{});
}

// ------------------------------------------------------------------------------------------
//  THE RECORDER BOX — one per gesture condition, re-rendered in place from GEST + the draft
// ------------------------------------------------------------------------------------------
function gestDotsHtml(rec){
  let h="";for(let i=0;i<(rec.target||1);i++)h+=`<span class="gr-dot${i<(rec.got||0)?" on":""}"></span>`;return h;}
function gestTakesHtml(src,cc){
  const takes=src.takes||[], an=GEST.analysis[cc], meta=GEST.meta[cc]||[];
  if(!takes.length)return "";
  return takes.map((t,i)=>{
    const a=(an&&an.takes&&an.takes[i])||meta[i]||{};
    const bad=(a.ok===false);
    const txt=bad?_gl("bez ruchu","no movement"):(a.duration!=null?gestFmtS(a.duration)+" · "+Math.round(a.peak||0)+" °/s":"");
    return `<span class="gr-take${bad?" bad":""}" title="${esc(bad?_gl("To nagranie nie zawiera ruchu — usuń je","This recording holds no movement — delete it"):_gl("nagranie "+(i+1)+": przebieg ruchu, czas gestu i szczytowa prędkość obrotu","recording "+(i+1)+": the movement's trace, gesture time and peak rotation speed"))}">`+
      `<b>${i+1}</b>${bad?"":gestSparkSvg(t)}${txt?" "+esc(txt):""}<button type="button" class="gr-x" data-gdel="${i}" title="Usuń to nagranie" aria-label="Usuń to nagranie">×</button></span>`;
  }).join("");
}
function gestVerdictHtml(src,cc){
  const takes=src.takes||[], an=GEST.analysis[cc], p=gestParamsOf(src);
  const out=[];
  if(GEST.recErr&&GEST.recErrCc===cc)out.push(`<span class="warn">${esc(GEST.recErr)}</span>`);
  if(!takes.length){
    if(!out.length)out.push(`<span class="dim">${_gl("Brak nagrania — naciśnij Nagraj i wykonaj gest.","No recording yet — press Record and make the gesture.")}</span>`);
    return out.join("<br>");
  }
  const n=takes.length;
  let line=_gl(n+" "+(n===1?"nagranie":n<5?"nagrania":"nagrań"), n+" recording"+(n===1?"":"s"));
  if(an&&an.minConsistency!=null)line+=" · "+_gl("zgodność powtórzeń","repeat agreement")+" "+Math.round(an.minConsistency)+" %";
  line+=" · "+_gl("wymagane podobieństwo","required similarity")+" "+Math.round(p.threshold)+" %";
  out.push(`<span class="ok">${esc(line)}</span>`);
  if(an){
    if(an.usable<n)out.push(`<span class="warn">⚠ ${esc(_gl("Któreś nagranie nie zawiera ruchu — usuń je (czerwony znacznik).","One of the recordings holds no movement — delete it (the red chip)."))}</span>`);
    if(an.minConsistency!=null&&an.minConsistency<60)
      out.push(`<span class="warn">⚠ ${esc(_gl("Powtórzenia bardzo się różnią — nagraj jeszcze raz, spokojniej i tak samo.","The repetitions differ a lot — record again, calmer and the same way."))}</span>`);
    else if(an.minConsistency!=null&&an.minConsistency<p.threshold)
      out.push(`<span class="warn">⚠ ${esc(_gl("Zgodność powtórzeń ("+Math.round(an.minConsistency)+" %) jest niższa niż wymagana dokładność ("+Math.round(p.threshold)+" %) — gest może się nie łapać; przesuń suwak w lewo albo nagraj równiej.",
        "The repetitions agree less ("+Math.round(an.minConsistency)+" %) than the required accuracy ("+Math.round(p.threshold)+" %) — the gesture may not be caught; move the slider left or record more evenly."))}</span>`);
    for(const c of (an.collisions||[]))if(c.warn)
      out.push(`<span class="warn">⚠ ${esc(_gl("Bardzo podobny do „"+(c.label||c.ckey)+"” ("+Math.round(c.sim)+" %) — te dwa gesty będą się mylić.","Very similar to “"+(c.label||c.ckey)+"” ("+Math.round(c.sim)+" %) — these two gestures will be confused."))}</span>`);
    if(an.pauseMs>0&&an.suggestedEndHoldMs&&an.suggestedEndHoldMs>(src.endHoldMs||200))
      out.push(`<span class="warn">⚠ ${esc(_gl("Gest ma w środku przerwę ("+gestFmtS(an.pauseMs/1000)+") — kapsel uzna go za skończony w połowie. Wydłuż przerwę kończącą.","The gesture has a stop inside ("+gestFmtS(an.pauseMs/1000)+") — the capsule will call it finished halfway. Lengthen the pause that ends it."))} `+
        `<button type="button" class="btn xs" data-gsetend="${an.suggestedEndHoldMs}">${esc(_gl("Ustaw "+an.suggestedEndHoldMs+" ms","Set "+an.suggestedEndHoldMs+" ms"))}</button></span>`);
  }
  return out.join("<br>");
}
function gestTrialText(){
  const t=GEST.trial;
  if(!t)return "—";
  const sim=Math.round(t.sim);
  if(t.accepted)return "✓ "+_gl("rozpoznany","recognised")+" · "+sim+" %";
  if(t.why==="intensity")return "✗ "+sim+" % — "+_gl("za inna siła","the strength is off")+" ("+gestFmtX(t.intensity)+")";
  if(t.why==="duration")return "✗ "+sim+" % — "+_gl("za inne tempo","the tempo is off")+" ("+gestFmtX(t.durRatio)+")";
  return "✗ "+sim+" % — "+_gl("za mało podobny","not similar enough");
}
function gestRecorderHtml(src,cc,compact){
  const takes=src.takes||[], n=takes.length, rec=(GEST.rec&&GEST.recCc===cc)?GEST.rec:null;
  const mode=GEST.recMode, eh=src.endHoldMs||200, full=n>=GEST_TAKES_MAX, thr=gestParamsOf(src).threshold;
  const cap=gestCapsuleNote(), off=(rec||full||!cap.ok);
  const now=(typeof performance!=="undefined"?performance.now():Date.now());
  const flash=(now-GEST.flashAt)<700, hot=(GEST.hotUntil>now);
  // JEDEN PRZYCISK NA RĘCZNE NAGRYWANIE (jeden
  // przycisk zamiast dwóch, bo łatwiej to ogarnąć jedną ręką). Start i Stop nigdy nie
  // były czynne naraz: dopóki nic się nie nagrywa, Stop jest wyszarzony, a w trakcie nagrania
  // wyszarzony jest Start. Dwa pola do trafienia w miejsce jednego stanu — a druga ręka trzyma
  // przecież kapsel. Teraz to jeden przełącznik: „● Start" → „■ Stop" → znowu „● Start".
  // WHY: the same button under the same finger, because the other hand is holding the capsule.
  const recBtn=mode==="auto"
    ?`<button type="button" class="btn primary" data-grec ${off?"disabled":""} ${full?'title="Maksymalnie 5 nagrań — usuń któreś, żeby dograć"':""}>${n?"● Nagraj więcej":"● Nagraj"}</button>`
    :`<button type="button" class="btn${rec?" gr-stop":" primary"}" data-gtoggle ${(!rec&&(full||!cap.ok))?"disabled":""} `+
     `title="${esc(rec?_gl("Naciśnij ponownie, żeby zakończyć to powtórzenie","Press again to finish this repetition")
                      :_gl("Naciśnij, wykonaj gest, naciśnij ten sam przycisk jeszcze raz","Press it, make the gesture, press the same button again"))}">${rec?"■ Stop":"● Start"}</button>`;
  return `<div class="gr-box${compact?" compact":""}" data-gcc="${cc}" data-gcompact="${compact?1:0}">
    <div class="gr-row gr-modes"><span class="gr-lbl">Sposób nagrywania</span>
      <div class="seg seg-sm">
        <button type="button" data-grm="auto" aria-pressed="${mode==="auto"?"true":"false"}" class="${mode==="auto"?"on":""}" title="Naciśnij Nagraj i wykonaj gest kilka razy — każdy wyraźny ruch zakończony chwilą spokoju to jedno powtórzenie">Automatycznie</button>
        <button type="button" data-grm="manual" aria-pressed="${mode==="manual"?"true":"false"}" class="${mode==="manual"?"on":""}" title="Jeden przycisk: Start, wykonaj gest, Stop — jedno powtórzenie. Dla gestów, które mają w środku zatrzymanie">Ręcznie: Start / Stop</button></div>
      <span class="gr-modehint">${mode==="auto"
        ?"Naciśnij Nagraj i wykonaj gest kilka razy z krótkimi przerwami — każdy wyraźny ruch to jedno powtórzenie."
        :"Naciśnij Start, wykonaj gest (może mieć w środku zatrzymanie) i naciśnij ten sam przycisk — stoi na nim już „Stop”. Powtórz dwa–trzy razy."}</span></div>
    ${cap.txt?`<div class="gr-note${cap.ok?"":" off"}" data-noi18n>${esc(cap.txt)}</div>`:""}
    <div class="gr-row gr-ctl">
      ${mode==="auto"?`<label class="fld">Powtórzeń <select data-gtakes>${[1,2,3,5].map(k=>`<option value="${k}" ${k===GEST.recTakes?"selected":""}>${k}</option>`).join("")}</select></label>`:""}
      <label class="fld gr-end" title="Ile spokoju kończy gest. Jeśli nagranie urywa się w środku gestu (bo gest ma w sobie zatrzymanie), wydłuż tę przerwę — wtedy i przy rozpoznawaniu kapsel poczeka dłużej, zanim uzna gest za skończony">Przerwa kończąca gest
        <input type="range" data-gend min="100" max="1500" step="50" value="${eh}"><span class="num" data-gendval data-noi18n>${eh} ms</span></label>
      <span class="gr-btns">${recBtn}</span></div>
    <div class="gr-live${flash?" flash":""}" ${rec?"":"hidden"}><span class="gr-pulse" aria-hidden="true"></span><span data-gmsg data-noi18n>${rec?esc(rec.msg||""):""}</span><span class="gr-dots" data-gdots>${rec?gestDotsHtml(rec):""}</span>
      ${mode==="auto"?`<button type="button" class="btn sm" data-gfinish>■ Zakończ</button>`:""}<button type="button" class="btn sm" data-gcancel>Anuluj</button></div>
    <div class="gr-scope-wrap">
      <div class="gr-scope-head"><span class="gr-lbl">Ruch kapsla na żywo</span>
        <span class="gr-scope-read" data-gscoperead data-noi18n>—</span></div>
      <canvas class="gr-scope" data-gscope title="${esc(_gl("Energia ruchu kapsla w ostatnich 8 sekundach. Zielone tło = kapsel jest w środku gestu, pomarańczowe = czeka na spokój, który go zakończy. Kreska „start” to próg, który trzeba przekroczyć, żeby gest się zaczął; „koniec” to poziom, pod który trzeba zejść, żeby się skończył.",
        "The capsule's motion energy over the last 8 seconds. A green background = the capsule is inside a gesture, amber = it is waiting for the rest that ends it. The “start” line is the threshold a movement has to cross for a gesture to begin; “end” is the level it has to fall under for it to finish."))}"></canvas>
    </div>
    <div class="gr-takes" data-gtakeslist>${gestTakesHtml(src,cc)}</div>
    <div class="gr-verdict" data-gverdict data-noi18n>${gestVerdictHtml(src,cc)}</div>
    <div class="gr-test${hot?" hot":""}" ${n?"":"hidden"}><span class="gr-lbl">${hot?"Gotowe! Teraz wykonaj gest jeszcze raz, żeby sprawdzić rozpoznawanie":"Sprawdź: wykonaj gest jeszcze raz"}</span>
      <div class="gr-meter" data-gmeter title="${esc(_gl("podobieństwo ostatniego ruchu; kreska = wymagany próg","similarity of the last movement; the mark = the required threshold"))}"><div class="gr-meter-thr" style="left:${thr}%"></div><div class="gr-meter-bar" style="width:0%"></div></div>
      <span class="gr-trial" data-gtrial data-noi18n>${esc(gestTrialText())}</span></div>
    ${compact?"":`<div class="gr-notice">⚠ Położenie startowe ma znaczenie. Kapsel rozpozna gest tylko wtedy, gdy zaczniesz go z podobnego ułożenia co przy nagraniu. Zapamiętaj, jak trzymasz kapsel na starcie, i zaczynaj każdy gest tak samo.</div>`}
  </div>`;
}
function gestRecorderRefresh(cc){
  const box=document.querySelector(`#ruleEditor .gr-box[data-gcc="${cc}"]`), src=gestSrc(cc);
  if(!box||!src)return;
  const compact=box.dataset.gcompact==="1";
  const nu=document.createElement("div");nu.innerHTML=gestRecorderHtml(src,cc,compact);
  const el=nu.firstElementChild;box.replaceWith(el);
  gestRecorderWire(el);
  try{if(typeof applyLang==="function")applyLang(el);}catch(e){}
  gestTrialPaint();
}
function gestRecorderWire(box){
  const cc=+box.dataset.gcc, src=gestSrc(cc);if(!src)return;
  box.querySelectorAll("[data-grm]").forEach(b=>b.onclick=()=>{
    if(GEST.rec)return;                     // not mid-session: the buttons below belong to the running mode
    GEST.recMode=b.dataset.grm==="manual"?"manual":"auto";
    try{localStorage.setItem(GEST_LS_REC,GEST.recMode);}catch(e){}
    GEST.recErr="";gestRecorderRefresh(cc);});
  const tk=box.querySelector("[data-gtakes]");if(tk)tk.onchange=e=>{GEST.recTakes=Math.max(1,Math.min(GEST_TAKES_MAX,+e.target.value||3));};
  const en=box.querySelector("[data-gend]");if(en)en.oninput=e=>{src.endHoldMs=Math.max(40,Math.min(2000,+e.target.value||200));
    const v=box.querySelector("[data-gendval]");if(v)v.textContent=src.endHoldMs+" ms";
    gestWatchOn(src.endHoldMs);   // the „waiting for rest" band is measured with this pause
    gestAnalyzeSoon(cc);};
  const rb=box.querySelector("[data-grec]");if(rb)rb.onclick=()=>gestRecordStart(cc);
  // One button, two jobs — read at click time, not at render time, so it cannot answer for a
  // session that started or ended between the two.
  const tg=box.querySelector("[data-gtoggle]");
  if(tg)tg.onclick=()=>{if(GEST.rec)gestRecordStop();else gestRecordStart(cc);};
  const fn=box.querySelector("[data-gfinish]");if(fn)fn.onclick=()=>gestRecordStop();
  const cn=box.querySelector("[data-gcancel]");if(cn)cn.onclick=()=>gestRecordCancel();
  box.querySelectorAll("[data-gdel]").forEach(b=>b.onclick=()=>{
    const i=+b.dataset.gdel;if(!(src.takes||[])[i])return;
    src.takes.splice(i,1);if(GEST.meta[cc])GEST.meta[cc].splice(i,1);
    GEST.recErr="";gestRecorderRefresh(cc);gestAnalyzeSoon(cc);});
  box.querySelectorAll("[data-gsetend]").forEach(b=>b.onclick=()=>{
    src.endHoldMs=Math.max(40,Math.min(2000,+b.dataset.gsetend||200));gestRecorderRefresh(cc);
    gestWatchOn(src.endHoldMs);gestAnalyzeSoon(cc);});
  // The live picture is armed HERE — every recorder box goes through this function, wherever it
  // is mounted (the simple editor, the „Gest" condition card, and anything that mounts one later).
  gestWatchOn(src.endHoldMs||200);
  gestScopeKick();
}
// The live meter under „Sprawdź": the last movement against the threshold, coloured by verdict.
function gestTrialPaint(){
  const box=document.querySelector(`#ruleEditor .gr-box[data-gcc="${GEST.trialCc}"]`);if(!box)return;
  const t=GEST.trial, bar=box.querySelector(".gr-meter-bar"), tx=box.querySelector("[data-gtrial]"), m=box.querySelector("[data-gmeter]");
  if(bar)bar.style.width=(t?Math.max(0,Math.min(100,t.sim)):0)+"%";
  if(m)m.className="gr-meter"+(t?(t.accepted?" ok":" no"):"");
  if(tx)tx.textContent=gestTrialText();
}

// ------------------------------------------------------------------------------------------
//  SESSIONS, ANALYSIS, THE TRIAL
// ------------------------------------------------------------------------------------------
function gestRecordStart(cc){
  const src=gestSrc(cc);if(!src||GEST.rec)return;
  const have=(src.takes||[]).length;
  if(have>=GEST_TAKES_MAX)return;
  GEST.recCc=cc;GEST.recErr="";GEST.recErrCc=cc;
  const mode=GEST.recMode;
  gestPost("/gesture/record",{action:"start",mode:mode,takes:Math.min(GEST_TAKES_MAX-have,GEST.recTakes||3),
    endHoldMs:src.endHoldMs||200,channels:src.channels||"gyro"})
    .then(j=>{if(!j||!j.ok){GEST.recCc=null;GEST.rec=null;
      GEST.recErr=(j&&j.error)?_cvT(String(j.error)):_gl("Nie udało się zacząć nagrywania","Could not start recording");
      gestRecorderRefresh(cc);}})
    .catch(()=>{GEST.recCc=null;GEST.rec=null;GEST.recErr=_gl("Serwer nieosiągalny","Server unreachable");gestRecorderRefresh(cc);});
}
function gestRecordStop(){gestPost("/gesture/record",{action:"stop"}).catch(()=>{});}
function gestRecordCancel(){gestPost("/gesture/record",{action:"cancel"}).catch(()=>{});}
function gestAnalyzeSoon(cc){clearTimeout(GEST.analyzeT);GEST.analyzeT=setTimeout(()=>gestAnalyze(cc),250);}
function gestAnalyze(cc){
  const d=state._draft,src=gestSrc(cc);if(!d||!src)return;
  if(!(src.takes||[]).length){GEST.analysis[cc]=null;gestRecorderRefresh(cc);gestTrialSync(cc);return;}
  const seq=++GEST.anSeq;
  gestPost("/gesture/analyze",{source:src,ruleId:d.id,cc:cc}).then(j=>{
    if(seq!==GEST.anSeq||!state._draft||gestSrc(cc)!==src)return;
    GEST.analysis[cc]=(j&&j.ok)?j:null;
    if(j&&j.ok===false&&j.error){GEST.recErr=_cvT(String(j.error));GEST.recErrCc=cc;}
    gestRecorderRefresh(cc);
  }).catch(()=>{});
  gestTrialSync(cc);
}
// The draft judged live on the server, firing nothing. Re-sent after every change that alters
// the verdict (a take, the slider, a knob), cleared when the editor closes.
function gestTrialSync(cc){
  const d=state._draft,src=gestSrc(cc);if(!d)return;
  GEST.trialCc=cc;GEST.trial=null;gestTrialPaint();
  const on=!!(src&&(src.takes||[]).length);
  // Nothing to put on trial and nothing to take off: no request. A rule without a gesture must
  // not cost a POST — the editor is opened and closed far more often than a gesture is recorded.
  if(!on&&!GEST.trialOn)return;
  GEST.trialOn=on;
  gestPost("/gesture/trial",{source:on?src:null,label:d.label||""}).catch(()=>{});
}
function gestEditorClosed(){
  if(GEST.rec||GEST.recCc!=null)gestRecordCancel();
  GEST.rec=null;GEST.recCc=null;GEST.recErr="";GEST.analysis={};GEST.meta={};GEST.trial=null;
  gestWatchOff();     // stop the live picture at its source — nobody is looking at it any more
  clearTimeout(GEST.analyzeT);
  if(GEST.trialOn){GEST.trialOn=false;gestPost("/gesture/trial",{}).catch(()=>{});}
}
// Something to say while the box waits for the capsule.
function gestRecMsg(rec){
  if(rec.mode==="manual")return _gl("Wykonaj gest i naciśnij Stop","Make the gesture and press Stop");
  const left=(rec.target||1)-(rec.got||0);
  if(!rec.got)return (rec.target||1)>1?_gl("Wykonaj gest "+rec.target+" razy, z krótką przerwą między powtórzeniami","Make the gesture "+rec.target+" times, with a short pause between repetitions")
                                       :_gl("Wykonaj gest raz i zatrzymaj kapsel","Make the gesture once and hold the capsule still");
  return "✓ "+rec.got+"/"+rec.target+(left>0?" — "+_gl("jeszcze "+left+(left===1?" raz":" razy"),left+" more"):" — "+_gl("mam wszystko","got them all"));
}
// Stream events of the active capsule: `grec` = recording progress (and the takes themselves),
// `gest` = a verdict on a movement — for the draft (trial) and for the saved rules (cands).
function gestOnEvent(dev,m){
  if(!m||dev!==state.activeDeviceId)return;
  // One point of the live picture. Kept as a flat array (not an object) because ~25 of them a
  // second for as long as an editor is open is the one place in this module where that matters.
  if(m.t==="gene"){
    const b=GEST.ene;
    b.push([m.ts,+m.e||0,+m.s||0,+m.start||0,+m.end||0]);
    const lo=m.ts-(GEST_SCOPE_S+1);
    let i=0;while(i<b.length&&b[i][0]<lo)i++;if(i)b.splice(0,i);
    GEST.eneAt=(typeof performance!=="undefined"?performance.now():Date.now());
    return;
  }
  if(m.t==="grec"){
    const cc=GEST.recCc;if(cc==null)return;     // a session another window started — not ours to draw
    const src=gestSrc(cc);
    if(m.phase==="go"){GEST.rec={cc:cc,mode:m.mode,target:m.target||1,got:0};GEST.rec.msg=gestRecMsg(GEST.rec);GEST.recErr="";gestRecorderRefresh(cc);return;}
    if(m.phase==="take"){
      if(src&&m.data&&(src.takes||[]).length<GEST_TAKES_MAX){
        src.takes=src.takes||[];src.takes.push(m.data);
        (GEST.meta[cc]=GEST.meta[cc]||[])[src.takes.length-1]={duration:m.duration,peak:m.peak,pauseMs:m.pauseMs};
        if(m.suggestedEndHoldMs&&m.suggestedEndHoldMs>(src.endHoldMs||200))src.endHoldMs=m.suggestedEndHoldMs;   // a stop inside a hand-timed take: widen the pause for recognition too
      }
      if(GEST.rec){GEST.rec.got=m.take||((GEST.rec.got||0)+1);GEST.rec.msg=gestRecMsg(GEST.rec);}
      GEST.flashAt=(typeof performance!=="undefined"?performance.now():Date.now());
      gestRecorderRefresh(cc);return;}
    if(m.phase==="done"||m.phase==="error"||m.phase==="cancel"){
      GEST.rec=null;GEST.recCc=null;
      if(m.phase==="error"){GEST.recErr=_cvT(String(m.msg||""));GEST.recErrCc=cc;}
      if(m.phase==="done"&&src&&(src.takes||[]).length){
        // the invitation to test lights up for a while, then the row goes back to its plain label
        GEST.hotUntil=(typeof performance!=="undefined"?performance.now():Date.now())+8000;
        clearTimeout(GEST.hotT);GEST.hotT=setTimeout(()=>{GEST.hotUntil=0;gestRecorderRefresh(cc);},8100);
      }
      gestRecorderRefresh(cc);
      if(m.phase!=="cancel"&&src&&(src.takes||[]).length)gestAnalyze(cc);
      return;}
    return;
  }
  if(m.t==="gest"){
    const at=(typeof performance!=="undefined"?performance.now():Date.now());
    if(m.trial!==undefined&&state._draft){GEST.trial=m.trial?{...m.trial,dur:m.dur,peak:m.peak,at:at}:null;gestTrialPaint();}
    for(const c of (m.cands||[])){
      if(!c||!c.ckey)continue;
      GEST.last[c.ckey]={sim:c.sim,accepted:!!c.accepted,at:at};
      const el=document.getElementById("rcur-"+c.ckey);   // the main condition of a rule shares the rule's id
      if(el)el.textContent=Math.round(c.sim)+" %";
    }
  }
}
// What the rule list prints in the live-value cell for a gesture rule (rf-10 curVal).
function gestLastSim(r){
  const l=r&&r.id&&GEST.last[r.id];
  return l?(Math.round(l.sim)+" %"):null;
}
