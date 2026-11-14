"use strict";
// ===== pad gate editor + play-pad cards =====
// The gate condition editor with its live sparklines, per-pad fullscreen, the manual effect
// rows (switch + level) and the rendering of the play-pad cards themselves.

// ===================== GATE UI — manual condition editor (mapping-style) + rhythm =====================
// _gl picks the Polish or English variant of a runtime-composed string. It lives here but is
// used across every rf-* file — the exact-match i18n dictionary cannot translate strings that
// are assembled at runtime, so those must be written through _gl instead.
function _gl(pl,en){return (typeof _lang!=="undefined"&&_lang==="en")?en:pl;}
// does this gate constrain anything? (≥1 condition OR rhythm on) — drives the "closed" badge + summary
function _gateActive(g){return !!(g&&((g.conds&&g.conds.length)||(g.rhythm&&g.rhythm.on)));}
function _gateSrcLabel(s){
  if(!s)return "?";
  if(s.kind==="axis")return "CH"+(s.channel|0)+" ("+RE_LABEL[s.channel|0]+")"+(s.abs?" |x|":"");
  if(s.kind==="button")return _gl("Przycisk","Button");
  if(s.kind==="mapping")return _gl("Mapowanie","Mapping")+(s.ref?": "+ruleRefLabel(s.ref):"");
  const m=GATE_METRIC_META[s.metric]||GATE_METRIC_META.tilt;
  return m.label+(s.abs?" |x|":"");
}
// one-line human summary shown in the pad-card header
function _gateSummary(g){
  if(!_gateActive(g))return _gl("gra zawsze","always plays");
  const sym=c=>c===">="?"≥":c==="<="?"≤":c==="in"?_gl("w","in"):c==="out"?_gl("poza","out"):c;
  const parts=(g.conds||[]).map((c,i)=>{
    const s=c.source||{};let txt;
    if(s.kind==="button")txt=_gl("przycisk wciśnięty","button pressed");
    else if(s.kind==="mapping")txt=_gl("mapowanie aktywne","mapping active")+(s.ref?": "+ruleRefLabel(s.ref):"");
    else{const unit=(s.kind==="filter"?(GATE_METRIC_META[s.metric]||{}).unit:"")||"";
      const rng=(c.cmp==="in"||c.cmp==="out");
      const val=rng?(Math.min(c.threshold,c.thresholdHi!=null?c.thresholdHi:c.threshold)+"…"+Math.max(c.threshold,c.thresholdHi!=null?c.thresholdHi:c.threshold)):c.threshold;
      txt=_gateSrcLabel(s)+" "+sym(c.cmp)+" "+val+unit;}
    if(c.neg)txt=_gl("NIE(","NOT(")+txt+")";
    const join=i>0?(c.op==="or"?" "+_gl("LUB","OR")+" ":" "+_gl("ORAZ","AND")+" "):"";
    return join+txt;
  });
  let out=parts.join("");
  if(g.rhythm&&g.rhythm.on){const rd=PAD_RHYTHM_BY_ID[g.rhythm.type];out+=" · "+_gl("Rytm","Rhythm")+": "+(rd?rd.label:"")+" "+_gl("(tempo wspólne)","(shared tempo)");}
  return out;
}
// HTML for ONE condition card
function _gateCondHtml(c,i){
  const s=c.source||{};
  const kind=s.kind==="axis"?"axis":s.kind==="button"?"button":s.kind==="mapping"?"mapping":"filter";
  const opt=(v,sel,lab)=>`<option value="${v}"${String(sel)===String(v)?" selected":""}>${esc(lab)}</option>`;
  const opSel=i>0?`<select class="ppg-op" data-i="${i}" title="${esc(_gl("Jak łączyć z powyższymi","How to combine with the above"))}"><option value="and"${c.op!=="or"?" selected":""}>${_gl("ORAZ","AND")}</option><option value="or"${c.op==="or"?" selected":""}>${_gl("LUB","OR")}</option></select>`:"";
  const kindSel=`<select class="ppg-kind" data-i="${i}">`+
    opt("filter",kind,_gl("Orientacja / ruch","Orientation / motion"))+
    opt("axis",kind,_gl("Oś (CH0-5)","Axis (CH0-5)"))+
    opt("button",kind,_gl("Przycisk kapsla","Capsule button"))+
    opt("mapping",kind,_gl("Mapowanie","Mapping"))+`</select>`;
  let mid="";
  if(kind==="filter")mid=`<select class="ppg-metric" data-i="${i}">`+GATE_METRICS.map(m=>opt(m[0],s.metric,m[1])).join("")+`</select>`;
  else if(kind==="axis")mid=`<select class="ppg-ch" data-i="${i}">`+[0,1,2,3,4,5].map(ch=>opt(ch,s.channel,"CH"+ch+" ("+RE_LABEL[ch]+")")).join("")+`</select>`;
  else if(kind==="mapping"){const refOpts=(state.rules||[]).map(r=>opt(r.id,s.ref,r.label||ruleSrcLabel(r)||r.id)).join("");
    mid=`<select class="ppg-ref" data-i="${i}"><option value="">`+esc(_gl("wybierz mapowanie","choose a mapping"))+`</option>`+refOpts+`</select>`;}
  let body="";
  if(kind==="filter"||kind==="axis"){
    const meta=(kind==="filter")?(GATE_METRIC_META[s.metric]||GATE_METRIC_META.tilt):{min:-32768,max:32768,unit:""};
    const step=(kind==="axis")?100:1;
    const rng=(c.cmp==="in"||c.cmp==="out");
    const cmpSel=`<select class="ppg-cmp" data-i="${i}">`+GATE_CMPS.map(cm=>opt(cm[0],c.cmp,cm[1])).join("")+`</select>`;
    const num=`<input class="ppg-thr" data-i="${i}" type="number" step="${step}" value="${c.threshold}">`;
    const hi=rng?`<span class="ppg-dash">…</span><input class="ppg-thrhi" data-i="${i}" type="number" step="${step}" value="${c.thresholdHi!=null?c.thresholdHi:c.threshold}">`:"";
    const unit=meta.unit?`<span class="ppg-unit">${esc(meta.unit)}</span>`:"";
    const slider=`<input class="ppg-slider" data-i="${i}" type="range" min="${meta.min}" max="${meta.max}" step="${step}" value="${c.threshold}">`;
    body=`<div class="ppg-row2">${cmpSel}${num}${hi}${unit}</div>${slider}<canvas class="ppg-graph" data-i="${i}" aria-hidden="true"></canvas>`;
  }else if(kind==="mapping"){const noRules=!(state.rules&&state.rules.length);
    body=`<div class="ppg-btnnote">`+_gl("gra tylko, gdy wybrane mapowanie jest aktywne (jego warunek spełniony teraz)","plays only while the chosen mapping is active (its condition met now)")+(noRules?`<br><b>`+_gl("Nie ma jeszcze mapowań. Utwórz je w module Mapowanie.","No mappings yet. Create one in the Mapping module.")+`</b>`:"")+`</div>`;}
  else body=`<div class="ppg-btnnote">${_gl("gra, gdy przycisk kapsla jest wciśnięty","plays while a capsule button is held")}</div>`;
  const absChk=(kind==="filter"||kind==="axis")?`<label class="ppg-chk" title="${esc(_gl("Wartość bezwzględna |x|","Absolute value |x|"))}"><input type="checkbox" class="ppg-abs" data-i="${i}"${s.abs?" checked":""}>|x|</label>`:"";
  const negChk=`<label class="ppg-chk" title="${esc(_gl("Neguj — spełniony, gdy warunek NIE zachodzi","Negate — met when the condition is NOT true"))}"><input type="checkbox" class="ppg-neg" data-i="${i}"${c.neg?" checked":""}>${_gl("NIE","NOT")}</label>`;
  return `<div class="ppg-cond${c.neg?" is-neg":""}" data-i="${i}">`+
    `<div class="ppg-row1">${opSel}${kindSel}${mid}<button class="ppg-del" data-i="${i}" type="button" title="${esc(_gl("Usuń warunek","Remove condition"))}" aria-label="Usuń">✕</button></div>`+
    body+
    `<div class="ppg-row3">${absChk}${negChk}</div>`+
  `</div>`;
}
// build + wire the whole gate editor inside a pad card
function renderGateEditor(card,p){
  const host=card.querySelector(".pp-gate-editor");if(!host)return;
  if(!p.gate||typeof p.gate!=="object")p.gate=padGateDefault();
  const g=p.gate;if(!Array.isArray(g.conds))g.conds=[];if(!g.rhythm)g.rhythm={on:false,type:"rhythm-8",bpm:120};
  const conds=g.conds, rhOn=!!g.rhythm.on;
  host.innerHTML=
    (conds.length?`<div class="ppg-conds">${conds.map((c,i)=>_gateCondHtml(c,i)).join("")}</div>`
      :`<div class="ppg-empty">${_gl("Pad gra zawsze. Dodaj warunek, jeśli ma grać tylko w wybranej pozycji.","The pad always plays. Add a condition if it should play only in a chosen position.")}</div>`)+
    `<button class="ppg-add" type="button"><span class="bic bic-plus" aria-hidden="true"></span>${_gl("Dodaj warunek","Add condition")}</button>`+
    `<button class="ppg-add-map" type="button"><span class="bic bic-plus" aria-hidden="true"></span>${_gl("Połącz z mapowaniem","Link a mapping")}</button>`+
    `<div class="ppg-rhythm${rhOn?" on":""}">`+
      `<label class="ppg-rh-toggle"><input type="checkbox" class="ppg-rh-on"${rhOn?" checked":""}> ${_gl("Tnij dźwięk w rytmie","Chop the sound to the beat")}</label>`+
      `<div class="ppg-rh-body"${rhOn?"":" hidden"}>`+
        `<select class="ppg-rh-type">${PAD_RHYTHMS.map(r=>`<option value="${r.id}"${r.id===g.rhythm.type?" selected":""}>${esc(r.emoji+" "+r.label)}</option>`).join("")}</select>`+
        `<label class="ppg-rh-bpm" title="${esc(_gl("Tempo wspólne z padami zaprogramowanymi i innymi padami z rytmem. Wszystkie tną i grają w tym samym takcie.","Tempo shared with the programmed pads and every other pad with a rhythm. They all chop and play on the same beat."))}"><input type="range" class="ppg-rh-bpmr" min="40" max="240" step="1" value="${seqBpm()}"><b class="ppg-rh-bpmv">${seqBpm()}</b> BPM · ${_gl("wspólne","shared")}</label>`+
      `</div></div>`;
  const sum=card.querySelector(".pp-gate-summary");if(sum)sum.textContent=_gateSummary(g);
  _wireGateEditor(card,p);
}
function _wireGateEditor(card,p){
  const host=card.querySelector(".pp-gate-editor");if(!host)return;
  const g=p.gate, re=()=>renderGateEditor(card,p), qa=s=>host.querySelectorAll(s), CI=el=>+el.dataset.i;
  const syncSummary=()=>{const sm=card.querySelector(".pp-gate-summary");if(sm)sm.textContent=_gateSummary(g);};
  const addBtn=host.querySelector(".ppg-add");if(addBtn)addBtn.onclick=()=>{if(g.conds.length>=6)return;g.conds.push(gateCondDefault());padSave();re();};
  const addMap=host.querySelector(".ppg-add-map");if(addMap)addMap.onclick=()=>{if(g.conds.length>=6)return;g.conds.push(gateMapCondDefault());padSave();re();};
  qa(".ppg-del").forEach(b=>b.onclick=e=>{g.conds.splice(CI(e.currentTarget),1);padSave();re();});
  qa(".ppg-op").forEach(sel=>sel.onchange=e=>{g.conds[CI(e.currentTarget)].op=e.currentTarget.value==="or"?"or":"and";padSave();re();});
  qa(".ppg-kind").forEach(sel=>sel.onchange=e=>{const c=g.conds[CI(e.currentTarget)],k=e.currentTarget.value;
    if(k==="axis")c.source={kind:"axis",channel:3,abs:false};
    else if(k==="button")c.source={kind:"button",any:true,byte:1,bit:0};
    else if(k==="mapping")c.source={kind:"mapping",ref:""};
    else c.source={kind:"filter",metric:"tilt",abs:false};
    if(k!=="button"&&!GATE_CMP_OK[c.cmp])c.cmp=">=";padSave();re();});
  qa(".ppg-metric").forEach(sel=>sel.onchange=e=>{g.conds[CI(e.currentTarget)].source.metric=GATE_METRIC_OK[e.currentTarget.value]?e.currentTarget.value:"tilt";padSave();re();});
  qa(".ppg-ch").forEach(sel=>sel.onchange=e=>{g.conds[CI(e.currentTarget)].source.channel=Math.max(0,Math.min(5,+e.currentTarget.value|0));padSave();re();});
  qa(".ppg-ref").forEach(sel=>sel.onchange=e=>{g.conds[CI(e.currentTarget)].source.ref=e.currentTarget.value||"";padSave();re();});
  qa(".ppg-cmp").forEach(sel=>sel.onchange=e=>{const c=g.conds[CI(e.currentTarget)];c.cmp=GATE_CMP_OK[e.currentTarget.value]?e.currentTarget.value:">=";
    if((c.cmp==="in"||c.cmp==="out")&&c.thresholdHi==null)c.thresholdHi=c.threshold;padSave();re();});
  qa(".ppg-abs").forEach(cb=>cb.onchange=e=>{g.conds[CI(e.currentTarget)].source.abs=e.currentTarget.checked;padSave();re();});
  qa(".ppg-neg").forEach(cb=>cb.onchange=e=>{g.conds[CI(e.currentTarget)].neg=e.currentTarget.checked;padSave();re();});
  qa(".ppg-thr").forEach(inp=>inp.oninput=e=>{const i=CI(e.currentTarget),c=g.conds[i];c.threshold=+e.currentTarget.value||0;
    const sl=host.querySelector('.ppg-slider[data-i="'+i+'"]');if(sl)sl.value=c.threshold;syncSummary();padSave();});
  qa(".ppg-thrhi").forEach(inp=>inp.oninput=e=>{g.conds[CI(e.currentTarget)].thresholdHi=+e.currentTarget.value||0;syncSummary();padSave();});
  qa(".ppg-slider").forEach(sl=>sl.oninput=e=>{const i=CI(e.currentTarget),c=g.conds[i];c.threshold=+e.currentTarget.value||0;
    const nb=host.querySelector('.ppg-thr[data-i="'+i+'"]');if(nb)nb.value=c.threshold;syncSummary();padSave();});
  const rhOn=host.querySelector(".ppg-rh-on");if(rhOn)rhOn.onchange=e=>{g.rhythm.on=e.currentTarget.checked;padSave();re();};
  const rhType=host.querySelector(".ppg-rh-type");if(rhType)rhType.onchange=e=>{g.rhythm.type=PAD_RHYTHM_BY_ID[e.currentTarget.value]?e.currentTarget.value:"rhythm-8";syncSummary();padSave();};
  // one tempo for the whole Synth (rf-25b transport): this slider and the programmed pads' slider move together
  const rhBpm=host.querySelector(".ppg-rh-bpmr");if(rhBpm)rhBpm.oninput=e=>{
    XPAD.seqBpm=Math.max(40,Math.min(240,+e.currentTarget.value||SEQ_BPM_DEF));seqTempoReflect();padSave();};
}
// ---- live axis preview inside each gate condition (rolling sparkline vs threshold) ----
function _gateGraphSig(s){
  if(!s)return "?";
  if(s.kind==="axis")return "a"+(s.channel|0)+(s.abs?"|":"");
  if(s.kind==="button")return "b";
  if(s.kind==="mapping")return "m"+(s.ref||"");
  return "f"+s.metric+(s.abs?"|":"");
}
function _gateGraphScale(c){
  const s=c.source||{};
  if(s.kind==="axis")return {min:s.abs?0:-32768,max:32768};
  if(s.kind==="filter"){const m=GATE_METRIC_META[s.metric]||GATE_METRIC_META.tilt;return {min:s.abs?0:m.min,max:m.max};}
  return {min:0,max:1};
}
// live context for the preview: the ACTIVE device the user is holding (works even when pads are OFF)
function _gatePreviewCtx(){
  const dev=state.devices&&state.devices[state.activeDeviceId];
  const pose=state.pose||(dev&&dev.poseLive)||null;
  const raw=state.last||null, sp=state.statusPkt||null;
  const tilt=pose?Math.max(0,+pose.tilt||0):0, twist=pose?+pose.twist||0:0,
        pitch=pose?+pose.pitch||0:0, roll=pose?+pose.roll||0:0;
  let motion=0; if(raw)motion=Math.min(100,Math.hypot(+raw.gx||0,+raw.gy||0,+raw.gz||0)/30);
  return {tilt,twist,pitch,roll,motion,hasDevice:!!(pose||raw),raw,sp};
}
function _updateGateGraphs(){
  if(typeof XPAD==="undefined"||!XPAD.pads||!XPAD.pads.length)return;
  const cards=document.querySelectorAll(".playpad[data-id]");if(!cards.length)return;
  let ctx=null;   // lazy: only build once a visible graph is found
  cards.forEach(card=>{
    const graphs=card.querySelectorAll(".ppg-graph[data-i]");if(!graphs.length)return;
    const p=XPAD.pads.find(x=>String(x.id)===card.dataset.id);if(!p||!p.gate||!p.gate.conds)return;
    p._gg=p._gg||{};
    graphs.forEach(cvEl=>{
      const w=cvEl.clientWidth|0;if(w<8||cvEl.offsetParent===null)return;   // hidden tab → skip
      const i=+cvEl.dataset.i,c=p.gate.conds[i];if(!c||!c.source||c.source.kind==="button")return;
      if(!ctx)ctx=_gatePreviewCtx();
      const dpr=Math.min(2,window.devicePixelRatio||1),pw=Math.round(w*dpr),ph=Math.round(36*dpr);
      if(cvEl.width!==pw||cvEl.height!==ph){cvEl.width=pw;cvEl.height=ph;}
      const sig=_gateGraphSig(c.source);let st=p._gg[i];
      if(!st||st.sig!==sig){st={sig:sig,buf:[]};p._gg[i]=st;}
      const v=_gateSourceVal(c.source,ctx);st.buf.push(v==null?null:+v);if(st.buf.length>96)st.buf.shift();
      _drawGateGraph(cvEl,c,st,_gateCondMet(c,ctx));
    });
  });
}
function _drawGateGraph(cvEl,c,st,met){
  const buf=st.buf;
  const g=cvEl.getContext("2d");if(!g)return;
  const W=cvEl.width,H=cvEl.height,dpr=W/(cvEl.clientWidth||W),pd=3*dpr;
  g.clearRect(0,0,W,H);
  const rng=(c.cmp==="in"||c.cmp==="out"),thr=+c.threshold||0,thrHi=(c.thresholdHi!=null?+c.thresholdHi:thr);
  let mn=Infinity,mx=-Infinity;for(let k=0;k<buf.length;k++){const v=buf[k];if(v==null)continue;if(v<mn)mn=v;if(v>mx)mx=v;}
  mn=Math.min(mn,thr);mx=Math.max(mx,thr);if(rng){mn=Math.min(mn,thrHi);mx=Math.max(mx,thrHi);}
  if(!isFinite(mn)||!isFinite(mx)){mn=0;mx=1;}if(mx-mn<1e-6){mn-=1;mx+=1;}
  const _pd=(mx-mn)*0.14;mn-=_pd;mx+=_pd;
  st.viewLo=(st.viewLo==null||!isFinite(st.viewLo))?mn:st.viewLo+(mn-st.viewLo)*0.18;
  st.viewHi=(st.viewHi==null||!isFinite(st.viewHi))?mx:st.viewHi+(mx-st.viewHi)*0.18;
  const lo=st.viewLo,hi=st.viewHi,span=(hi-lo)||1;
  const yOf=v=>H-pd-Math.max(0,Math.min(1,(v-lo)/span))*(H-2*pd);
  const okc=cv("--green")||"#4caf50",badc=cv("--bad")||"#d84a4a",line=cv("--line")||"#ccc",pink=cv("--pink-d")||"#a4105c";
  const acc=met?okc:badc, N=96, n=buf.length;
  if(lo<0&&hi>0){g.strokeStyle=line;g.lineWidth=1;g.beginPath();g.moveTo(0,yOf(0));g.lineTo(W,yOf(0));g.stroke();}
  // thr / rng / thrHi computed above (adaptive range)
  if(rng){const ya=yOf(thr),yb=yOf(thrHi);g.save();g.globalAlpha=.14;g.fillStyle=acc;g.fillRect(0,Math.min(ya,yb),W,Math.abs(ya-yb)||1);g.restore();}
  g.save();g.setLineDash([4*dpr,3*dpr]);g.strokeStyle=pink;g.lineWidth=1.4*dpr;
  g.beginPath();g.moveTo(0,yOf(thr));g.lineTo(W,yOf(thr));g.stroke();
  if(rng){g.beginPath();g.moveTo(0,yOf(thrHi));g.lineTo(W,yOf(thrHi));g.stroke();}
  g.restore();
  if(n>1){
    g.strokeStyle=acc;g.lineWidth=1.8*dpr;g.lineJoin="round";g.beginPath();let started=false;
    for(let k=0;k<n;k++){const v=buf[k];if(v==null){started=false;continue;}
      const x=(k/(N-1))*W,y=yOf(v);if(!started){g.moveTo(x,y);started=true;}else g.lineTo(x,y);}
    g.stroke();
    const last=buf[n-1];if(last!=null){g.fillStyle=acc;g.beginPath();g.arc(((n-1)/(N-1))*W,yOf(last),2.4*dpr,0,6.2832);g.fill();}
  }
}
// ---- per-pad fullscreen: native FS on the card element, .fs class for the felt layout, Esc exits ----
// THE CARD LIVES IN <body> WHILE FULLSCREEN. Without native fullscreen, .fs is position:fixed — and inside
// #tab-pad (it has an entrance animation) fixed is relative to the tab, not the window. A comment node
// keeps the card's place so it goes back exactly where it was.
function _padFsOff(c){
  c.classList.remove("fs","side-open");
  const ph=c._fsHome;c._fsHome=null;
  if(ph&&ph.parentNode){ph.parentNode.insertBefore(c,ph);ph.remove();}
}
function _padFsSide(card,open){
  card.classList.toggle("side-open",!!open);
  const b=card.querySelector(".playpad-side-btn");if(b)b.setAttribute("aria-expanded",String(!!open));
  try{localStorage.setItem("rf.padFsSide",open?"1":"0");}catch(e){}
}
function _onPadFsChange(){
  const fsEl=document.fullscreenElement||document.webkitFullscreenElement||null;
  document.querySelectorAll(".playpad.fs").forEach(c=>{if(c!==fsEl)_padFsOff(c);});
}
document.addEventListener("fullscreenchange",_onPadFsChange);
document.addEventListener("webkitfullscreenchange",_onPadFsChange);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!(document.fullscreenElement||document.webkitFullscreenElement))
  document.querySelectorAll(".playpad.fs").forEach(_padFsOff);});
function _padCardFS(card){
  if(!card)return;
  const fsEl=document.fullscreenElement||document.webkitFullscreenElement||null;
  const isFs=card.classList.contains("fs")||fsEl===card;
  if(isFs){
    _padFsOff(card);
    if(fsEl===card){if(document.exitFullscreen)document.exitFullscreen().catch(()=>{});else if(document.webkitExitFullscreen)document.webkitExitFullscreen();}
  }else{
    if(card.parentNode&&card.parentNode!==document.body){const ph=document.createComment("playpad-fs");
      card.parentNode.insertBefore(ph,card);document.body.appendChild(card);card._fsHome=ph;}
    card.classList.add("fs");   // felt layout (kept active during native FS too)
    let open=false;try{open=localStorage.getItem("rf.padFsSide")==="1";}catch(e){}
    _padFsSide(card,open);      // the settings drawer remembers whether it was left open
    const req=card.requestFullscreen||card.webkitRequestFullscreen;
    if(req){try{const r=req.call(card);if(r&&r.catch)r.catch(()=>{});}catch(e){}}
  }
}
// ---- manual pad effects: one row = name + ON/OFF switch + level slider ----
// The switch bypasses the effect (transparent value on the bus) but KEEPS the slider level, so flipping
// it back restores the exact same sound. Same visual language as the Echo toggle (.btn.sm, green when on).
function _ppFxRowHtml(p,key,cls,label,aria){
  const on=padFxOn(p,key),id="ppfx-"+key+"-"+p.id;   // p.id is validated /^[A-Za-z0-9_-]+$/ in padDe
  return `<div class="pp-fld pp-wide pp-fx-fld${on?"":" is-off"}" data-fx="${key}">`+
    `<span class="pp-fx-head"><label class="pp-fx-name" for="${id}">${esc(label)}</label>`+
      `<button class="btn sm pp-fxsw${on?" on":""}" type="button" data-fx="${key}" role="switch" aria-checked="${on?"true":"false"}"`+
      ` aria-label="${esc(aria)}" title="Włącz lub wyłącz ten efekt — poziom suwaka zostaje zapamiętany">${on?"Wł.":"Wył."}</button></span>`+
    `<input id="${id}" class="${cls}" type="range" min="0" max="100" value="${Math.round((p.fx[key]||0)*100)}"></div>`;
}
// push ONE manual effect to the bus right now (the fx loop would do it next frame, but only while it runs)
function _ppFxApply(p,key){if(typeof PadAudio!=="undefined")PadAudio.setFxParam(p,key,padFxVal(p,key));}
// mirror the model onto the three switches + their (greyed-out when off) sliders
function _ppFxReflect(card,p){
  card.querySelectorAll(".pp-fx-fld[data-fx]").forEach(row=>{
    const k=row.dataset.fx,on=padFxOn(p,k),sw=row.querySelector(".pp-fxsw");
    row.classList.toggle("is-off",!on);
    if(!sw)return;
    sw.classList.toggle("on",on);sw.setAttribute("aria-checked",on?"true":"false");
    const t=on?"Wł.":"Wył.";if(sw._t!==t){sw._t=t;sw.textContent=t;}   // cached — a blind rewrite would fight the i18n observer
  });
}
// „↕ Oś Y steruje" — grouped options straight from the catalogue in rf-19 (PAD_Y_TARGETS), with
// „Nic" left outside the groups: it is the absence of a target, not one more of them. The optgroup
// `label` attribute IS translated by the i18n walker (see the attribute list in rf-01-i18n.js).
function _ppYOptsHTML(sel){
  const opt=(id,label)=>`<option value="${id}"${id===sel?" selected":""}>${esc(label)}</option>`;
  return PAD_Y_TARGETS.map(g=>`<optgroup label="${esc(g[0])}">`+g[1].map(it=>opt(it[0],padLbl(it[1]))).join("")+`</optgroup>`).join("")+   // padLbl: „Przester"/„Drive" is composed at paint time (rf-19)
    opt("none",PAD_Y_META.none.label);
}
const PP_FIRST_KEY="ribbitflip.synth.firstTouch";
function _ppFirstTouched(){try{return localStorage.getItem(PP_FIRST_KEY)==="1";}catch(e){return true;}}
function _ppFirstTouch(){try{localStorage.setItem(PP_FIRST_KEY,"1");}catch(e){}
  document.querySelectorAll(".pp-first-hint").forEach(el=>el.remove());}
function renderPlayPads(){
  const wrap=document.getElementById("playPads");if(!wrap)return;
  document.querySelectorAll(".playpad.fs").forEach(_padFsOff);   // a card parked in <body> must not outlive the rebuild
  wrap.innerHTML="";
  const devs=padDevList();
  const baseOpts=sel=>[24,36,48,60,72].map(n=>`<option value="${n}"${n===sel?" selected":""}>od ${miNoteName(n)}</option>`).join("");
  const octOpts=sel=>[1,2,3,4].map(n=>`<option value="${n}"${n===sel?" selected":""}>${n} okt.</option>`).join("");
  const onlyOne=XPAD.pads.length<=1;
  for(const p of XPAD.pads){
    if(!p.gate||typeof p.gate!=="object")p.gate={type:"always",thr:30,bpm:120};   // defensive (older runtime pad)
    const card=document.createElement("div");card.className="playpad";card.dataset.id=p.id;
    card.innerHTML=
      `<div class="playpad-h"><span class="pp-frog" aria-hidden="true">🐸</span>`+
        // Nazwa jest tu napisem, a pole do jej zmiany, tło, skala i żaby stoją w zwijaku „Wygląd pada” (L4a).
        `<b class="pp-title" data-noi18n>${esc(p.name)}</b>`+
        `<select class="pp-sound" title="Brzmienie tego pada">${padSoundOptionsHTML(p.sound)}</select>`+
        `<button class="btn sm playpad-side-btn" type="button" aria-expanded="false" title="Pokaż albo schowaj ustawienia pada"><span class="bic bic-gear" aria-hidden="true"></span>Ustawienia</button>`+
        `<button class="playpad-fs" type="button" title="Pełny ekran pada (Esc — wyjście)" aria-label="Pełny ekran">⛶</button>`+
        `<button class="playpad-rm" type="button" title="${onlyOne?'Musi zostać co najmniej jeden pad':'Usuń ten pad grający'}"${onlyOne?' disabled':''} aria-label="Usuń">✕</button></div>`+
      // one line over the first pad until the first touch (localStorage), so a first try knows what the pad does
      (p===XPAD.pads[0]&&!_ppFirstTouched()?`<p class="hint pp-first-hint">Przeciągnij palcem albo rusz kapslem. Lewo i prawo zmienia nutę, góra i dół barwę.</p>`:``)+
      `<div class="playpad-body">`+
        `<div class="playpad-canvaswrap"><button class="pp-edge" type="button" title="Pokaż ustawienia pada"><span class="bic bic-gear" aria-hidden="true"></span><span class="pp-edge-t">Ustawienia</span></button><canvas class="playpad-cv"></canvas></div>`+
        `<div class="playpad-side">`+
      /* Najpierw grasz, potem ustawiasz: głośność, kto gra (ruch kapsli) i same kapsle stoją na górze szuflady,
         skala, bramka i oś Y pod nimi. Klasy zostają, zmienia się tylko kolejność. */
      `<div class="playpad-ctrls pp-top">`+
        `<label class="pp-fld pp-wide"><span>🔊 Głośność</span><input class="pp-vol" type="range" min="0" max="100" value="${p.vol}"></label>`+
      `</div>`+
      `<div class="playpad-btns pp-who"><div class="pp-group"><span class="pp-group-lbl">Kto gra</span>`+
        `<button class="btn sm pp-motion" type="button" title="Graj z ruchu przypisanych kapsli">▶ Graj z ruchu</button>`+
      `</div></div>`+
      `<div class="playpad-caps"></div>`+
      /* UX 261120 L4a (piętra): na wierzchu szuflady zostają głośność, „Kto gra” i kapsle. Reszta to piętro 2,
         trzy zwinięte zwijaki z bieżącymi wartościami w nagłówku i „Przywróć domyślne” (rfTier, `_ppTiers`).
         Klasy i kolejność pól w środku bez zmian, więc obsługa zdarzeń niżej działa jak dawniej. */
      `<details class="cardfold inset pp-fold" data-fold="skala"><summary>Skala i nuty</summary><div class="cardfold-body">`+
      `<div class="playpad-ctrls">`+
        `<label class="pp-fld"><span>Od nuty</span><select class="pp-base">${baseOpts(p.base)}</select></label>`+
        `<label class="pp-fld"><span>Oktawy</span><select class="pp-oct">${octOpts(p.oct)}</select></label>`+
        `<label class="pp-fld"><span>Tonika</span><select class="pp-scale-root">${MI_ROOTS.map((r,i)=>`<option value="${i}"${i===((p.scaleRoot|0)%12)?" selected":""}>${r}</option>`).join("")}</select></label>`+
        `<label class="pp-fld pp-wide"><span>Skala pada</span><select class="pp-scale">${MI_SCALES.map(s=>`<option value="${s[0]}"${s[0]===(p.scale||"chromatic")?" selected":""}>${esc(s[1])}</option>`).join("")}</select></label>`+
      `</div>`+
      `<div class="playpad-btns">`+
        `<div class="pp-group"><span class="pp-group-lbl">Przejścia</span>`+
          `<div class="seg pp-glide" role="group" aria-label="Przejścia między dźwiękami">`+
            // ⊓⊓ (U+2293), not ▯▯ (U+25AF): the white vertical rectangle draws exactly what its
            // name says — two empty boxes — which on screen is indistinguishable from a missing
            // glyph. ⊓⊓ reads as a square wave, next to 〜 (sine) and ∿ (a smoother one).
            `<button type="button" data-v="hard" title="Skokowe: natychmiastowy skok na kolejną nutę skali, bez ślizgu">⊓⊓ Skokowe</button>`+
            `<button type="button" data-v="smooth" title="Płynne: portamento — dźwięk zjeżdża między nutami, tym dłużej im większy skok">〜 Płynne</button>`+
            `<button type="button" data-v="free" title="Superpłynne: bez skali i bez nut — cała szerokość padu to jedno pasmo wysokości, dźwięk idzie za palcem bez żadnych progów">∿ Superpłynne</button>`+
          `</div></div>`+
      `</div></div></details>`+
      `<details class="cardfold inset pp-fold" data-fold="dzwiek"><summary>Oś Y i efekty</summary><div class="cardfold-body">`+
      `<div class="playpad-ctrls">`+
        `<label class="pp-fld pp-wide"><span>↕ Oś Y steruje</span><select class="pp-yparam" title="Co zmienia pionowe położenie na padzie — od barwy i głośności po rezonans, atak, wybrzmienie, rozstrojenie i przester. „Nic” zostawia Y bez wpływu na dźwięk: pad gra wtedy samą wysokością.">`+
          _ppYOptsHTML(p.yParam||"both")+
        `</select><small class="pp-yhint"></small></label>`+
        `<label class="pp-fld pp-wide pp-yrange" title="Wycinek zakresu tego parametru, na który rozciąga się wysokość pada. Dół padu = pierwsza liczba, góra = druga. Można je odwrócić — wtedy na dole jest więcej.">`+
          `<span>↕ Zakres osi Y</span>`+
          `<span class="pp-yrange-row"><input class="pp-ylo" type="number" min="0" max="100" step="5" value="${p.yLo!=null?p.yLo:0}">`+
          `<b>–</b><input class="pp-yhi" type="number" min="0" max="100" step="5" value="${p.yHi!=null?p.yHi:100}"><small>%</small></span></label>`+
      `</div>`+
      /* Eight buttons in one wrapping row read as a pile: three of them were one choice pretending
         to be three switches, and the rest mixed "who plays this pad" with "how it sounds" and "what
         the finger leaves behind". Now: the mutually exclusive one IS one control (a segment, the
         same as everywhere else in the app), and the switches sit in named groups. */
      `<div class="playpad-btns">`+
        `<div class="pp-group"><span class="pp-group-lbl">Brzmienie</span>`+
          `<button class="btn sm pp-echo" type="button" role="switch" aria-checked="${p.echo?"true":"false"}" title="Echo">〰 Echo</button>`+
          `<button class="btn sm pp-vib" type="button" title="Wibrato z obrotu">≈ Wibrato</button>`+
        `</div>`+
        `<div class="pp-group"><span class="pp-group-lbl">Po puszczeniu</span>`+
          `<button class="btn sm pp-latch" type="button" title="Zatrzask: po puszczeniu żaba zostaje i gra — wyłącz zatrzask albo Kill, by ją zwolnić">∞ Zatrzask</button>`+
          `<button class="btn sm pp-momentum" type="button" title="Momentum (trackball): po puszczeniu żaba zachowuje pęd i sunie dalej z wytracaniem, odbijając się od krawędzi — jak podkręcona kula. Zatrzask ma pierwszeństwo. To zachowanie instrumentu, nie dekoracja (działa też przy „ograniczonym ruchu”).">🎳 Momentum</button>`+
        `</div>`+
      `</div>`+
      `<div class="playpad-fx"><span class="pp-fx-lbl">Efekty pada:</span>`+
        _ppFxRowHtml(p,"bright","pp-bright","Jasność","Jasność — włącznik efektu")+
        _ppFxRowHtml(p,"hp","pp-hp","Cięcie basu","Cięcie basu — włącznik efektu")+
        _ppFxRowHtml(p,"tremolo","pp-trem","Tremolo","Tremolo — włącznik efektu")+
      `</div></div></details>`+
      `<details class="cardfold inset pp-fold" data-fold="bramka"><summary>Kiedy gra i dotyk</summary><div class="cardfold-body">`+
      `<div class="playpad-ctrls">`+
        `<div class="pp-gate-wrap"><span class="pp-gate-hdr">🚦 Kiedy pad gra<span class="pp-gate-summary"></span></span>`+
          `<div class="pp-gate-editor"></div></div>`+
        `<label class="pp-fld pp-wide"><span>🖱 Drag dotyku</span><input class="pp-drag" type="range" min="0" max="100" value="${p.drag}"></label>`+
      `</div>`+
      `<div class="playpad-btns"><div class="pp-group">`+
        `<button class="btn sm pp-velmotion" type="button" title="Velocity z ruchu: głośność NOWEJ nuty rośnie z energią gestu — szybki ruch kapsla/dotyku gra głośniej, spokojne wejście ciszej. Nie zmienia brzmienia, gdy wyłączone.">💥 Velocity z ruchu</button>`+
      `</div></div>`+
      `</div></details>`+
      `<details class="cardfold inset pp-fold" data-fold="wyglad"><summary>Wygląd pada</summary><div class="cardfold-body">`+
      `<div class="playpad-ctrls">`+
        `<label class="pp-fld pp-wide"><span>Nazwa pada</span><input class="pp-name" value="${esc(p.name)}" maxlength="24"></label>`+
        `<label class="pp-fld pp-wide"><span>Tło pada</span><select class="pp-plate" title="Tło pada — reaguje na dźwięk tego pada">${padPlateOptionsHTML(p.plate)}</select></label>`+
      `</div>`+
      `<div class="playpad-btns"><div class="pp-group"><span class="pp-group-lbl">Na padzie</span>`+
        `<button class="btn sm pp-sv${p.scaleView!==false?" on":""}" type="button" role="switch" aria-checked="${p.scaleView!==false}" title="Pokaż albo schowaj widok skali: kolumny nut, linie pomocnicze i nazwy nut">Skala</button>`+
        `<button class="btn sm pp-fv${p.frogView!==false?" on":""}" type="button" role="switch" aria-checked="${p.frogView!==false}" title="Pokaż albo schowaj żaby na tym padzie" aria-label="Żaby"><span class="pp-fv-ic" aria-hidden="true"></span>Żaby</button>`+
      `</div></div>`+
      `</div></details>`+
        `</div>`+   /* .playpad-side */
      `</div>`;     /* .playpad-body */
    const q=s=>card.querySelector(s);
    q(".pp-name").oninput=e=>{p.name=e.target.value||p.name;const t=q(".pp-title");if(t)t.textContent=p.name;padSave();renderFxPads();};   // fx-pad target labels follow
    q(".pp-sound").onchange=e=>{p.sound=e.target.value;PadAudio.resume();PadAudio.gateOffPad(p);p.act={};padSave();};
    q(".pp-plate").onchange=e=>{p.plate=e.target.value;padSave();if(window._padWake)window._padWake();};
    {const sv=q(".pp-sv");sv.onclick=()=>{p.scaleView=p.scaleView===false;
      sv.classList.toggle("on",p.scaleView);sv.setAttribute("aria-checked",String(p.scaleView));padSave();};}
    // the frogs on the pad (owner, 10-02): an icon toggle next to the scale, on by default; off hides only the drawing,
    // the frogs still play and still steer the background
    {const fv=q(".pp-fv");fv.onclick=()=>{p.frogView=p.frogView===false;
      fv.classList.toggle("on",p.frogView);fv.setAttribute("aria-checked",String(p.frogView));padSave();};}
    {const fh=q(".pp-first-hint");if(fh)q(".playpad-cv").addEventListener("pointerdown",_ppFirstTouch,{once:true});}
    q(".playpad-side-btn").onclick=()=>_padFsSide(card,!card.classList.contains("side-open"));
    q(".pp-edge").onclick=()=>_padFsSide(card,true);
    q(".pp-base").onchange=e=>{p.base=+e.target.value||48;padSave();};
    q(".pp-oct").onchange=e=>{p.oct=Math.max(1,Math.min(4,+e.target.value||2));padSave();};
    q(".pp-scale-root").onchange=e=>{p.scaleRoot=(+e.target.value||0)%12;padSave();};
    q(".pp-scale").onchange=e=>{p.scale=PAD_PCS[e.target.value]?e.target.value:"chromatic";padSave();};
    renderGateEditor(card,p);
    // Targets like detune or overdrive need nodes that are built when a voice starts, so a note held
    // across the change would keep the old wiring. Dropping the pad's voices (same idiom as changing
    // the sound) makes the next note the first one you hear under the new target.
    q(".pp-yparam").onchange=e=>{p.yParam=padYOK(e.target.value)?e.target.value:"both";
      PadAudio.gateOffPad(p);p.act={};reflectPlayPads();padSave();};
    // clamp AND write back: typing 900 used to leave "900" sitting in the box while the pad had
    // quietly stored 100 — the number on screen has to be the number in effect
    {const cl=v=>Math.max(0,Math.min(100,Math.round(+v||0)));
     const wire=(sel,key)=>{const el=q(sel);if(!el)return;
       el.oninput=e=>{p[key]=cl(e.target.value);padSave();};
       el.onblur=e=>{const v=cl(e.target.value);p[key]=v;if(String(v)!==e.target.value)e.target.value=v;padSave();};};
     wire(".pp-ylo","yLo");wire(".pp-yhi","yHi");}
    q(".pp-drag").oninput=e=>{p.drag=+e.target.value||0;padSave();};
    q(".pp-vol").oninput=e=>{p.vol=+e.target.value||0;PadAudio.setVol(p);padSave();};
    q(".pp-motion").onclick=()=>{p.motion=!p.motion;PadAudio.resume();reflectPlayPads();padSave();};
    for(const b of card.querySelectorAll(".pp-glide button"))
      b.onclick=()=>{p.glideMode=b.dataset.v;reflectPlayPads();padSave();};
    q(".pp-echo").onclick=()=>{p.echo=!p.echo;PadAudio.setEcho(p);reflectPlayPads();padSave();};
    q(".pp-vib").onclick=()=>{p.vib=!p.vib;reflectPlayPads();padSave();};
    q(".pp-latch").onclick=()=>{p.latch=!p.latch;if(!p.latch)p.latched=null;reflectPlayPads();padSave();};
    q(".pp-momentum").onclick=()=>{p.momentum=!p.momentum;if(!p.momentum)p._mom=null;reflectPlayPads();padSave();};
    q(".pp-velmotion").onclick=()=>{p.velMotion=!p.velMotion;reflectPlayPads();padSave();};
    q(".pp-bright").oninput=e=>{p.fx.bright=(+e.target.value||0)/100;_ppFxApply(p,"bright");padSave();};
    q(".pp-hp").oninput=e=>{p.fx.hp=(+e.target.value||0)/100;_ppFxApply(p,"hp");padSave();};
    q(".pp-trem").oninput=e=>{p.fx.tremolo=(+e.target.value||0)/100;_ppFxApply(p,"tremolo");padSave();};
    // effect switches — bypass on/off; the slider keeps its level so switching back restores it
    card.querySelectorAll(".pp-fxsw").forEach(b=>b.onclick=()=>{
      const k=b.dataset.fx;if(!fxSwitchable(k))return;
      if(!p.fxOn||typeof p.fxOn!=="object")p.fxOn={};
      p.fxOn[k]=!padFxOn(p,k);
      _ppFxApply(p,k);_ppFxReflect(card,p);padSave();
      if(window._padWake)window._padWake();   // ECONOMY MODE: let the fx loop pick the change up at once
    });
    if(!onlyOne)q(".playpad-rm").onclick=()=>removePlayPad(p);
    const fsBtn=q(".playpad-fs");if(fsBtn)fsBtn.onclick=()=>_padCardFS(card);
    _renderCapMappers(p.dev,q(".playpad-caps"),devs,true);   // per-capsule axes + drag (capsules default ON for play pads)
    _playPadBindPointer(q(".playpad-cv"),p);
    _ppFxReflect(card,p);   // seeds the switch label cache while the card is still detached (no i18n flicker)
    wrap.appendChild(card);
    _ppTiers(card,p);
  }
  reflectPlayPads();
}
// ===== UX 261120 L4a: piętro 2 szuflady pada (rfTier, rf-28d) =====
// Domyślne = świeży pad świeżego syntha: padDefaults() z pentatoniką dur od C (rf-20, pierwszy pad).
// Pola każdego zwijaka są polami modelu `p`, więc licznik i „Przywróć domyślne” liczą się z modelu,
// a nie z kontrolek (przełączniki `.btn.on` nie mają wartości do porównania).
const PP_FOLDS={
  skala:["base","oct","scaleRoot","scale","glideMode"],
  dzwiek:["yParam","yLo","yHi","echo","vib","latch","momentum","fx","fxOn"],
  bramka:["gate","drag","velMotion"],
  wyglad:["plate","scaleView","frogView"],
};
function _ppDef(){return Object.assign(padDefaults(),{scale:"pentatonic_major",scaleRoot:0});}
function _ppPick(p,keys){const o={};for(const k of keys)o[k]=p[k];return o;}
function _ppChanged(p,keys){const d=_ppDef();let n=0;
  for(const k of keys){
    if(k==="fx"||k==="fxOn"){for(const e in FX_OFF_VAL){const a=(p[k]||{})[e],b=d[k][e];if(k==="fx"?Math.abs((+a||0)-(+b||0))>1e-6:!!a!==!!b)n++;}continue;}
    if(k==="gate"){if(JSON.stringify(p.gate)!==JSON.stringify(d.gate))n++;continue;}
    if(String(p[k])!==String(d[k]))n++;}
  return n;}
// Po zmianie wielu pól naraz: dźwięk dostaje nowe ustawienia od razu, a karta rysuje się od nowa.
function _ppApply(p,vals){
  Object.assign(p,JSON.parse(JSON.stringify(vals)));
  if(typeof PadAudio!=="undefined"){PadAudio.gateOffPad(p);PadAudio.setEcho(p);for(const k in FX_OFF_VAL)_ppFxApply(p,k);}
  p.act={};if(!p.latch)p.latched=null;if(!p.momentum)p._mom=null;
  renderPlayPads();renderFxPads();padSave();
}
// Bez emoji i znaków z początku napisu przycisku albo opcji: podsumowanie jest zdaniem.
function _ppTx(el){return el?String(el.textContent||"").replace(/^[^\p{L}\p{N}]+/u,"").trim():"";}
function _ppTiers(card,p){
  if(typeof rfTier!=="function")return;
  const q=s=>card.querySelector(s),opt=s=>{const el=q(s);return el?_ppTx(el.options[el.selectedIndex]):"";};
  const sums={
    skala:()=>[opt(".pp-scale-root")+" "+opt(".pp-scale"),opt(".pp-base"),opt(".pp-oct"),_ppTx(q(".pp-glide button.on")).toLowerCase()].filter(Boolean).join(" · "),
    dzwiek:()=>{const on=[".pp-echo",".pp-vib",".pp-latch",".pp-momentum"].map(s=>q(s)).filter(b=>b&&b.classList.contains("on")).map(_ppTx);
      card.querySelectorAll(".pp-fx-fld:not(.is-off) .pp-fx-name").forEach(l=>on.push(_ppTx(l)));
      return [_gl("Oś Y: ","Y axis: ")+opt(".pp-yparam").toLowerCase()].concat(on.map(t=>t.toLowerCase())).join(" · ");},
    bramka:()=>{const g=_ppTx(q(".pp-gate-summary"));
      return [g||(_gateActive(p.gate)?_gl("z warunkiem","with a condition"):_gl("gra zawsze","always plays")),_gl("drag dotyku ","touch drag ")+p.drag,
        p.velMotion?_gl("velocity z ruchu","motion velocity"):""].filter(Boolean).join(" · ");},
    wyglad:()=>[p.name,_gl("tło: ","background: ")+opt(".pp-plate").toLowerCase(),
      p.scaleView===false?_gl("bez skali","no scale"):"",p.frogView===false?_gl("bez żab","no frogs"):""].filter(Boolean).join(" · "),
  };
  card.querySelectorAll("details.pp-fold[data-fold]").forEach(det=>{
    const k=det.dataset.fold,keys=PP_FOLDS[k];if(!keys)return;
    rfTier(det,"synth.pad."+k,{sum:sums[k],changed:()=>_ppChanged(p,keys),
      reset:()=>_ppApply(p,_ppPick(_ppDef(),keys)),take:()=>_ppPick(p,keys),restore:s=>_ppApply(p,s)});
  });
}
function reflectPlayPads(){
  const wrap=document.getElementById("playPads");if(!wrap)return;
  for(const p of XPAD.pads){
    const card=wrap.querySelector('.playpad[data-id="'+p.id+'"]');if(!card)continue;
    const q=s=>card.querySelector(s);
    const mb=q(".pp-motion");if(mb){mb.classList.toggle("on",p.motion);
      mb.classList.toggle("live",XPAD.enabled&&p.motion&&padAnyFresh(p));
      const t=p.motion?"⏹ Graj z ruchu":"▶ Graj z ruchu";if(mb._t!==t){mb._t=t;mb.textContent=t;}}
    for(const b of card.querySelectorAll(".pp-glide button")){
      const on=(b.dataset.v===p.glideMode);
      b.classList.toggle("on",on);b.setAttribute("aria-pressed",on?"true":"false");}
    // Y steering nothing means its range steers nothing either — grey the pair out rather than
    // leaving two live-looking boxes that do not reach the sound
    {const yp=card.querySelector(".pp-yparam"),yr=card.querySelector(".pp-yrange"),yh=card.querySelector(".pp-yhint");
     const ym=p.yParam||"both";
     if(yp&&yp.value!==ym)yp.value=ym;
     // one line saying what the chosen target actually does with the height — including the two that
     // land on the NEXT note and the ones a noise sound has nothing to apply them to
     if(yh){const t=(PAD_Y_META[ym]||PAD_Y_META.both).hint||"";
       if(yh._t!==t){yh._t=t;yh.textContent=t;}}   // cached — a blind rewrite would fight the i18n observer
     if(yr){const off=(ym==="none");
       yr.style.opacity=off?".45":"";
       for(const i of yr.querySelectorAll("input"))i.disabled=off;}}
    // the scale and root pick which notes exist — in free mode nothing does, so say so instead of
    // leaving two live-looking selects that change nothing
    const _sc=card.querySelector(".pp-scale"),_rt=card.querySelector(".pp-scale-root");
    for(const el of [_sc,_rt]){if(!el)continue;
      const off=(p.glideMode==="free");
      el.disabled=off;el.title=off?"Superpłynne gra bez skali — skala i tonika nic tu nie zmieniają":"";
      const lab=el.closest(".pp-fld");if(lab)lab.style.opacity=off?".45":"";}
    const eb=q(".pp-echo");if(eb){eb.classList.toggle("on",p.echo);eb.setAttribute("aria-checked",p.echo?"true":"false");}
    const vb=q(".pp-vib");if(vb)vb.classList.toggle("on",p.vib);
    const lb=q(".pp-latch");if(lb)lb.classList.toggle("on",p.latch);
    const mo=q(".pp-momentum");if(mo)mo.classList.toggle("on",p.momentum);
    const vm=q(".pp-velmotion");if(vm)vm.classList.toggle("on",p.velMotion);
    _ppFxReflect(card,p);   // effect switches follow the model (import / undo / setup load)
  }
}
function addPlayPad(){
  const ref=XPAD.pads[0];   // a new pad starts from the current pad's scale, then edits independently
  const p=mkPad(ref?{scale:ref.scale,scaleRoot:ref.scaleRoot}:{});XPAD.pads.push(p);
  renderPlayPads();renderFxPads();padSave();
  const wrap=document.getElementById("playPads");
  const card=wrap&&wrap.querySelector('.playpad[data-id="'+p.id+'"]');
  if(card&&card.scrollIntoView)try{card.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(e){}
  if(card&&window.rfPopNew)window.rfPopNew(card);   // ONLY the freshly added pad animates (not the whole list)
}
function removePlayPad(p){
  if(!p||XPAD.pads.length<=1)return;   // always keep at least one pad
  const at=XPAD.pads.indexOf(p),fx=XPAD.fxPads.filter(fp=>fp.target===p.id).map(fp=>fp.id);
  const run=()=>{
    p.act={};PadAudio.disposeBus(p.id);   // hard-kills every live voice + tail deterministically
    XPAD.pads=XPAD.pads.filter(x=>x!==p);
    for(const fp of XPAD.fxPads)if(fp.target===p.id)fp.target=XPAD.pads[0].id;   // fx pads fall back to the first pad
    renderPlayPads();renderFxPads();padSave();};
  // "Cofnij" (rfUndo, rf-06): the same pad object goes back to its place, with the effects pads that pointed at it;
  // its bus is rebuilt on the next note
  if(typeof window.rfUndo!=="function"){run();return;}
  window.rfUndo({msg:_gl("Usunięto pad „"+p.name+"”","Deleted the pad “"+p.name+"”"),clone:false,take:()=>p,run,
    restore:q=>{if(XPAD.pads.includes(q))return;q.act={};q.ptr=null;q._pid=null;q.latched=null;q._mom=null;
      XPAD.pads.splice(Math.min(at<0?XPAD.pads.length:at,XPAD.pads.length),0,q);
      for(const fp of XPAD.fxPads)if(fx.includes(fp.id))fp.target=q.id;
      renderPlayPads();renderFxPads();padSave();}});
}
// Repaint for a language switch WITHOUT saving (setLang in rf-01 calls this next to miRelang/poseRelang).
// The effects-pad and Y-axis selects carry „Przester"/„Drive" composed with _gl() at paint time (rf-19:
// FX_PARAMS.drive is a getter), so the DOM walker has no key to translate them by: without a repaint an
// EN-composed „Drive" stays in a Polish panel, and a PL-composed „Przester" gets the SOUND's pair
// („Overdrive") from the dictionary. padSave() is deliberately absent — a language switch changes nothing.
function padRelang(){
  try{renderPlayPads();}catch(e){}
  try{if(typeof renderSeqPads==="function")renderSeqPads();}catch(e){}
  try{renderFxPads();}catch(e){}
}

