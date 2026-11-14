"use strict";
// ===================== RECORDED GESTURES — the two faces of the rule editor =====================
// ONE editor, two modes, one rule format. „Prosty — nagraj gest" shows a recorded gesture, the
// accuracy slider, a description and the ACTION (what gets pressed) — the whole rule for
// somebody who has never set a threshold. „Zaawansowany" is the editor as it always was, with
// „Gest" as a fifth kind of condition next to Oś / Filtr 3D / Przycisk / Wyzwalacz, so a recorded
// gesture can be ANDed with a held button, counted („X razy w czasie") or turned into a latch.
// Both write the same rule object (source.kind === "gesture"), so simple and advanced rules sit
// side by side in one list, one preset and one setup, and either can be reopened in the other
// mode: a rule opens in the mode that can show ALL of it (rf-12d gestEditorModeFor).
//
// The recorder itself (sessions, takes, analysis, the live trial) is rf-12d; this file only
// lays it out and wires the fields around it. rf-12 calls in here through typeof-guarded hooks,
// so the editor keeps working in a build without these two files.

// The bar at the top of the editor, in both modes.
function gestModeBarHtml(){
  const m=state._edMode||"advanced";
  return `<div class="fld col2 gr-modebar"><span class="gr-lbl">Tryb edycji</span>
    <div class="seg seg-sm" role="group">
      <button type="button" data-gmode="simple" class="${m==="simple"?"on":""}" aria-pressed="${m==="simple"}" title="Nagrywasz gest kapslem, wskazujesz akcję i gotowe"><span class="gr-ic" aria-hidden="true">✋</span>Prosty — nagraj gest</button>
      <button type="button" data-gmode="advanced" class="${m==="advanced"?"on":""}" aria-pressed="${m==="advanced"}" title="Pełna kontrola: warunki na osiach, filtrze 3D i przycisku, łączenie warunków, zachowania i czasy"><span class="gr-ic" aria-hidden="true">⚙</span>Zaawansowany</button></div>
    <small class="ed-sig-note">${m==="simple"
      ?"Kapsel uczy się gestu z nagrania; w trybie zaawansowanym ustawisz każdy próg i warunek sam."
      :"Wszystkie źródła, warunki i zachowania. Tryb prosty nagrywa gest i sam dobiera próg."}</small></div>`;
}
// Switching keeps the draft. Into „simple": a manual condition is set aside (and comes back if
// the person returns without having recorded anything), extra conditions and the behaviour are
// left in the draft but announced as ignored — the simple mode saves „Jednorazowo" and no extras,
// because that is the only rule it can show honestly.
function gestSetMode(mode){
  const d=state._draft;if(!d)return;
  mode=(mode==="simple")?"simple":"advanced";
  if((state._edMode||"advanced")===mode)return;
  if(mode==="simple"){
    if(!(d.source&&d.source.kind==="gesture")){
      state._edAdvSource={source:d.source,cmp:d.cmp,threshold:d.threshold,thresholdHi:d.thresholdHi,abs:d.abs,neg:d.neg};
      d.source=gestNewSource();d.neg=false;
    }
    if((d.extraConditions||[]).length||(d.behavior||"once")!=="once")
      flashTrigMsg(_gl("Tryb prosty pomija dodatkowe warunki i zachowanie — zapis ustawi „Jednorazowo”","The simple mode skips extra conditions and the behaviour — saving sets “Once”"));
  }else if(state._edAdvSource&&d.source&&d.source.kind==="gesture"&&!(d.source.takes||[]).length){
    Object.assign(d,state._edAdvSource);state._edAdvSource=null;
  }
  // Tryb nie jest zapamiętywany (UX 261120, P-G1-05): o trybie nowej reguły decyduje kafel albo drzwi.
  state._edMode=mode;
  renderEditor();
}
function gestAccuracyHtml(src){
  const acc=src.accuracy!=null?src.accuracy:50;
  return `<span class="gr-lbl">Jak dokładnie trzeba powtórzyć gest?</span>
    <input type="range" data-gacc min="0" max="100" step="5" value="${acc}" aria-label="Jak dokładnie trzeba powtórzyć gest?"><b class="gr-acclbl" data-gacclbl data-noi18n>${esc(gestAccLabel(acc))}</b>
    <div class="gr-scale"><span>luźno</span><span>normalnie</span><span>dokładnie</span></div>
    <small class="ed-sig-note">Gest łapie się za rzadko → przesuń w lewo. Odpala na byle ruch → w prawo. Po lewej siła i tempo gestu nie mają znaczenia, po prawej muszą być jak w nagraniu.</small>`;
}
function gestDescHtml(src){
  return `<label class="fld col2 gr-desc">Jak wygląda ten gest?
      <input type="text" data-gdesc maxlength="200" value="${esc(src.desc||"")}" placeholder="np. kapsel płasko, szybkie machnięcie w prawo"></label>
    <small class="ed-sig-note col2">Opis stoi przy regule na liście i na ściądze nad grą — dla Ciebie i dla każdego, komu wyślesz ten zestaw.</small>`;
}

// ------------------------------------------------------------------------------------------
//  SIMPLE MODE — the whole editor
// ------------------------------------------------------------------------------------------
function gestSimpleRender(){
  const d=state._draft;if(!d)return;
  if(!(d.source&&d.source.kind==="gesture"))d.source=gestNewSource();
  const src=d.source;
  document.getElementById("ruleEditor").innerHTML=`<div class="ed-grid gr-simple">
    ${typeof edHeadHtml==="function"?edHeadHtml():""}
    ${gestModeBarHtml()}
    <label class="fld col2">Nazwa <input id="edLabel" type="text" value="${esc(d.label||"")}" placeholder="np. Czar ognia"></label>
    <section class="ed-sec col2" data-sec="gesture">
      <h3 class="ed-sec-h"><span class="gr-step" aria-hidden="true">1</span>Gest — nagraj i powtórz<span class="gr-done" data-gdone="gesture" data-noi18n></span><span id="condToast" class="cond-toast" data-noi18n></span></h3>
      <div class="ed-sec-body gr-body">
        <div class="col2">${gestRecorderHtml(src,-1,false)}</div>
        <div class="fld col2 gr-acc">${gestAccuracyHtml(src)}</div>
        ${gestDescHtml(src)}
      </div>
    </section>
    ${typeof edActionSecHtml==="function"?edActionSecHtml(d):""}
    <details class="ed-more col2"><summary>Więcej: warstwa, podświetlenie, dioda, powiadomienie</summary>
      <div class="ed-sec-body gr-more">${layerFieldHtml(d)}</div>
      ${typeof edSignalsSecHtml==="function"?edSignalsSecHtml(d):""}
    </details>
    <div class="ed-actions col2">
      <span class="gr-ready" data-gready data-noi18n></span>
      <span class="trigmsg ed-msg" id="edMsg" role="status" aria-live="polite"></span>
      <button class="btn" id="edCancel">Anuluj</button>
      <button class="btn rf-cta" id="edSave">Zapisz wyzwalacz</button></div>
  </div>`;
  // The action block is the shared one (rf-12); in this mode it is step 2 of two, so the number
  // and the „done" mark are put on its header here rather than taught to the shared markup.
  const ah=document.querySelector('#ruleEditor .ed-sec[data-sec="action"] .ed-sec-h');
  if(ah){ah.insertAdjacentHTML("afterbegin",'<span class="gr-step" aria-hidden="true">2</span>');
    ah.insertAdjacentHTML("beforeend",'<span class="gr-done" data-gdone="action" data-noi18n></span>');}
  wireEditor();        // label, action, layer, signals, save/cancel — everything it finds by id
  gestWireCommon();
  gestAfterRender();
}
// The two steps' „done" marks and the line next to Save that says what is still missing. Called
// from the editor's frame loop (drawEditorScope) — cheap: it repaints only when the sentence
// changes, so the DOM is untouched sixty times a second.
function gestStepsPaint(){
  const d=state._draft;if(!d||state._edMode!=="simple")return;
  const src=(d.source&&d.source.kind==="gesture")?d.source:null, n=src?(src.takes||[]).length:0;
  const act=(d.actionMode==="seq")?String(d.sequence||"").trim():String(d.keySpec||"").trim();
  // „Bez klawisza" to WYBÓR, a nie brak wyboru — krok 2 jest wtedy odhaczony, a linijka przy
  // przycisku nie może się domagać akcji, której ta reguła z założenia nie ma (rf-10 ruleNoAction).
  const noa=(typeof ruleNoAction==="function")&&d.actionMode!=="seq"&&ruleNoAction(d);
  const g=n?("✓ "+_gl(n+" "+(n===1?"nagranie":n<5?"nagrania":"nagrań"),n+" recording"+(n===1?"":"s"))):"";
  const a=noa?("✓ "+_gl("bez klawisza — wyzwalacz","no key — trigger only"))
    :act?("✓ "+((d.actionMode==="seq")?"⛓ "+(typeof seqPreview==="function"?seqPreview(act):act):(typeof keyLabel==="function"?keyLabel(act):act))):"";
  const miss=[];if(!n)miss.push(_gl("nagrania gestu","a recording of the gesture"));if(!act&&!noa)miss.push(_gl("akcji","an action"));
  const ready=miss.length?(_gl("Do zapisu brakuje:","Still missing before saving:")+" "+miss.join(" · ")):_gl("Wszystko gotowe, zapisz.","All set, save it.");
  const key=g+"|"+a+"|"+ready;
  if(gestStepsPaint._k===key)return;
  gestStepsPaint._k=key;
  const gd=document.querySelector('#ruleEditor [data-gdone="gesture"]');if(gd)gd.textContent=g;
  const ad=document.querySelector('#ruleEditor [data-gdone="action"]');if(ad)ad.textContent=a;
  const rl=document.querySelector("#ruleEditor [data-gready]");
  if(rl){rl.textContent=ready;rl.classList.toggle("ok",!miss.length);}
}
// After either mode has rendered: the draft's gesture is put on trial straight away, so the
// „Sprawdź" meter answers the first movement without a click.
function gestAfterRender(){
  const d=state._draft;if(!d)return;
  gestStepsPaint._k=null;gestStepsPaint();
  const conds=[d].concat(d.extraConditions||[]);
  let first=null;
  conds.forEach((c,i)=>{const s=c.source||{};if(s.kind==="gesture"&&first===null)first=i-1;});
  if(first===null){if(GEST.trialCc!==null){GEST.trial=null;}return;}
  if(!GEST.analysis[first]&&(gestSrc(first).takes||[]).length)gestAnalyze(first);
  else gestTrialSync(first);
}

// ------------------------------------------------------------------------------------------
//  ADVANCED MODE — the „Gest" condition card (rf-12 condCardHtml calls these)
// ------------------------------------------------------------------------------------------
function gestCondParamsHtml(c,cc){
  const src=c.source, p=gestParamsOf(src), num=v=>(typeof v==="number"&&isFinite(v));
  const ovr=num(src.threshold)||num(src.intensityTol)||num(src.durationTol);
  const o=(v,sel,lab)=>`<option value="${v}" ${String(sel)===String(v)?"selected":""}>${lab}</option>`;
  return `<div class="col2">${gestRecorderHtml(src,cc,true)}</div>
    <div class="fld col2 gr-acc">${gestAccuracyHtml(src)}</div>
    <details class="ed-btn-adv gr-adv" ${ovr?"open":""}><summary>strojenie (zaawansowane)</summary>
      <div class="gr-knobs">
        <label class="fld">Podobieństwo ≥ <input type="number" data-gk="threshold" min="0" max="100" step="1" value="${Math.round(p.threshold)}"> %</label>
        <label class="fld">Siła <input type="number" data-gk="intensityTol" min="0" max="10" step="0.1" value="${p.intensityTol}"> ×</label>
        <label class="fld">Tempo <input type="number" data-gk="durationTol" min="0" max="10" step="0.1" value="${p.durationTol}"> ×</label>
        <label class="fld">Osie <select data-gch>${o("gyro",src.channels,"żyroskop (obrót)")}${o("both",src.channels,"żyroskop + akcelerometr")}${o("accel",src.channels,"akcelerometr")}${o("magnitude",src.channels,"sama energia (bez kierunku)")}</select></label>
        <button type="button" class="btn sm" data-greset title="Wróć do wartości z suwaka dokładności" ${ovr?"":"disabled"}>↺ z suwaka</button>
      </div>
      <small class="ed-sig-note">Siła i tempo: dopuszczalny stosunek do nagrania (2 = od połowy do dwukrotności; 0 = bez znaczenia). Osie „żyroskop” nie zależą od tego, jak kapsel leży na starcie.</small>
    </details>
    ${gestDescHtml(src)}`;
}
// Shared wiring: the mode bar, every recorder box, the slider / description / knobs. Called by
// rf-12 wireEditor at its end (advanced) and by gestSimpleRender (simple).
function gestWireCommon(){
  const root=document.getElementById("ruleEditor");if(!root)return;
  root.querySelectorAll("[data-gmode]").forEach(b=>b.onclick=()=>gestSetMode(b.dataset.gmode));
  root.querySelectorAll(".gr-box").forEach(gestRecorderWire);
  root.querySelectorAll("[data-gacc]").forEach(el=>el.oninput=e=>{
    const cc=gestCcOf(el),src=gestSrc(cc);if(!src)return;
    src.accuracy=Math.max(0,Math.min(100,+e.target.value||0));
    const l=el.parentElement&&el.parentElement.querySelector("[data-gacclbl]");if(l)l.textContent=gestAccLabel(src.accuracy);
    gestKnobsPaint(cc);gestAnalyzeSoon(cc);});
  root.querySelectorAll("[data-gdesc]").forEach(el=>el.oninput=e=>{const src=gestSrc(gestCcOf(el));if(src)src.desc=e.target.value.slice(0,200);});
  root.querySelectorAll("[data-gk]").forEach(el=>el.onchange=e=>{
    const cc=gestCcOf(el),src=gestSrc(cc);if(!src)return;
    const k=el.dataset.gk,v=parseFloat(e.target.value);
    src[k]=isFinite(v)?Math.max(0,Math.min(k==="threshold"?100:10,v)):null;
    gestKnobsPaint(cc);gestAnalyzeSoon(cc);});
  root.querySelectorAll("[data-gch]").forEach(el=>el.onchange=e=>{const cc=gestCcOf(el),src=gestSrc(cc);if(!src)return;src.channels=e.target.value;gestAnalyzeSoon(cc);});
  root.querySelectorAll("[data-greset]").forEach(el=>el.onclick=()=>{
    const cc=gestCcOf(el),src=gestSrc(cc);if(!src)return;
    src.threshold=null;src.intensityTol=null;src.durationTol=null;gestKnobsPaint(cc);gestAnalyzeSoon(cc);});
}
// The knob numbers follow the slider until one of them is typed over.
function gestKnobsPaint(cc){
  const src=gestSrc(cc);if(!src)return;
  const card=cc<0?document.querySelector('#ruleEditor .ed-cond-card[data-cc="-1"]'):document.querySelector(`#ruleEditor .ed-cond-card[data-cc="${cc}"]`);
  if(!card)return;
  const p=gestParamsOf(src), num=v=>(typeof v==="number"&&isFinite(v));
  card.querySelectorAll("[data-gk]").forEach(el=>{if(document.activeElement===el)return;
    const k=el.dataset.gk;el.value=k==="threshold"?Math.round(p[k]):p[k];});
  const r=card.querySelector("[data-greset]");if(r)r.disabled=!(num(src.threshold)||num(src.intensityTol)||num(src.durationTol));
  const thr=card.querySelector(".gr-meter-thr");if(thr)thr.style.left=Math.max(0,Math.min(100,p.threshold))+"%";
}
// The condition card's preview canvas: a meter of the last movement against the threshold —
// the equivalent of the trace-and-threshold-line the other sources draw.
function gestDrawScope(c,cond,head){
  const ff=fit(c);if(!ff||!ff.w||!ff.h)return;const {ctx,w,h}=ff;ctx.clearRect(0,0,w,h);
  const src=cond.source||{},p=gestParamsOf(src),thr=Math.max(0,Math.min(100,p.threshold));
  const mine=(cond===gestCondOf(GEST.trialCc)),t=mine?GEST.trial:null;
  const Pl=10,Pr=10,y=h*0.5,bh=Math.min(18,h*0.34),X=v=>Pl+(w-Pl-Pr)*v/100;
  ctx.fillStyle=cv('--bg2');ctx.fillRect(Pl,y-bh/2,w-Pl-Pr,bh);
  ctx.fillStyle=cv('--warn');ctx.globalAlpha=0.10;ctx.fillRect(X(thr),y-bh/2,w-Pr-X(thr),bh);ctx.globalAlpha=1;
  if(t){ctx.fillStyle=t.accepted?cv('--ok'):(t.why==="sim"?cv('--dim'):cv('--warn'));
    ctx.fillRect(Pl,y-bh/2,X(Math.max(0,Math.min(100,t.sim)))-Pl,bh);}
  ctx.strokeStyle=cv('--warn');ctx.lineWidth=1.5;ctx.setLineDash([4,3]);
  ctx.beginPath();ctx.moveTo(X(thr),y-bh/2-6);ctx.lineTo(X(thr),y+bh/2+6);ctx.stroke();ctx.setLineDash([]);
  ctx.font="9px "+cv('--mono');ctx.fillStyle=cv('--warn');ctx.textAlign=thr>85?"right":"left";ctx.textBaseline="bottom";
  ctx.fillText(_cvT("próg")+" "+Math.round(thr)+" %",X(thr)+(thr>85?-3:3),y-bh/2-7);
  ctx.fillStyle=cv('--dim');ctx.font="10px "+cv('--sans');ctx.textAlign="left";ctx.textBaseline="top";
  const nT=(src.takes||[]).length;
  ctx.fillText(!nT?_gl("nagraj gest, a tutaj zobaczysz podobieństwo każdego ruchu","record the gesture and every movement's similarity shows here")
    :(t?(Math.round(t.sim)+" % · "+_gl("siła","strength")+" "+gestFmtX(t.intensity)+" · "+_gl("tempo","tempo")+" "+gestFmtX(t.durRatio)+" · "+gestFmtS(t.dur||0))
       :_gl("wykonaj gest, żeby zobaczyć podobieństwo","make the gesture to see the similarity")),Pl,y+bh/2+8);
  const met=gestCondMet(cond);
  if(head){head.textContent=(t?(t.accepted?_gl("● rozpoznany","● recognised"):_gl("– nie rozpoznany","– not recognised"))+" ("+Math.round(t.sim)+" %)":"—")+(cond.neg?" ("+_gl("NEGUJ","NEGATE")+")":"");
    head.style.color=met?cv('--ok'):cv('--dim');}
  c.style.boxShadow=met?("inset 0 0 0 2px "+cv('--ok')):"none";
}
// Is this gesture condition „met" right now — for the toast and the activation preview. Met =
// the draft's trial accepted a movement a moment ago; the same short pulse the server uses.
function gestCondMet(cond){
  const t=GEST.trial;if(!t||!t.accepted)return false;
  if(cond!==gestCondOf(GEST.trialCc))return false;
  const now=(typeof performance!=="undefined"?performance.now():Date.now());
  return (now-t.at)<400;
}
// Before a save: a gesture condition needs at least one recording, and the simple mode writes
// the only rule it can show — one gesture, fired once. Returns false to stop the save.
function gestValidateDraft(d){
  if(!d)return true;
  if(state._edMode==="simple"){d.behavior="once";d.extraConditions=[];d.neg=false;}
  const conds=[d].concat(d.extraConditions||[]);
  for(let i=0;i<conds.length;i++){
    const s=conds[i].source||{};
    if(s.kind!=="gesture")continue;
    if(!(s.takes||[]).length){
      flashTrigMsg(_gl("Najpierw nagraj gest","Record the gesture first"));
      const sec=document.querySelector('#ruleEditor .ed-sec[data-sec="gesture"]')||document.querySelector(`#ruleEditor .ed-cond-card[data-cc="${i-1}"]`);
      // L4e: warunek może stać w zwiniętym „Warunek i zachowanie” albo „Zaawansowane”; błąd nie zostaje schowany.
      for(let f=sec&&sec.closest("details:not([open])");f;f=f.parentElement&&f.parentElement.closest("details:not([open])"))f.open=true;
      if(sec){sec.classList.remove("ed-sec-err");void sec.offsetWidth;sec.classList.add("ed-sec-err");setTimeout(()=>sec.classList.remove("ed-sec-err"),2600);
        try{sec.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(e){}}
      return false;
    }
    if(GEST.rec)gestRecordCancel();   // a session still running would keep adding takes to a rule that is gone
  }
  return true;
}
