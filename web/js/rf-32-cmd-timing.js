"use strict";
// Three related pieces of the Connection/Mapping tabs: raw hex commands sent to the device,
// live feedback for time-window triggers and macro playback, and the macro editor
// (token library + key recorder).
// ===================== LED / DEVICE COMMANDS (raw hex) =====================
function onCmd(m){
  const $=id=>document.getElementById(id);
  const ok=!!m.ok, sim=!!m.sim, res=$("cmdResult");
  if(res){res.textContent=(sim?"○ symulacja (brak urządzenia): ":(ok?"✔ wysłano: ":"✕ błąd: "))+(m.hex||"")
      +((m.error&&(!ok||sim))?(" — "+m.error):"");
    res.className="cmd-result "+(sim?"":(ok?"ok":"bad"));}
  const log=$("cmdLog");
  if(log){const r=document.createElement("div");r.className="row";
    r.textContent=`${(m.ts!=null?(+m.ts).toFixed(2):"")}s  ${ok?(sim?"○":"✔"):"✕"} ${m.hex||""} → ${String(m.uuid||"").slice(0,8)}…`;
    log.prepend(r);while(log.children.length>30)log.removeChild(log.lastChild);}
}
function initCmd(){
  const $=id=>document.getElementById(id);
  const uuidSel=$("cmdUuid"),customFld=$("cmdUuidCustomFld"),customInp=$("cmdUuidCustom");
  if(uuidSel)uuidSel.onchange=()=>{const c=uuidSel.value==="__custom";if(customFld)customFld.style.display=c?"":"none";};
  const curUuid=()=>{if(!uuidSel)return "";if(uuidSel.value==="__custom")return (customInp&&customInp.value.trim())||"";return uuidSel.value;};
  const setRes=(t,cls)=>{const r=$("cmdResult");if(r){r.textContent=t;r.className="cmd-result "+(cls||"");}};
  function send(hex,uuid){
    const body={hex};const u=uuid||curUuid();if(u)body.uuid=u;
    fetch("/command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
      .then(r=>r.json()).then(j=>{if(!j||!j.ok)setRes("✕ "+((j&&j.error)||"błąd"),"bad");})
      .catch(()=>setRes("✕ serwer nieosiągalny","bad"));
  }
  if($("cmdSend"))$("cmdSend").onclick=()=>{const hx=(($("cmdHex")&&$("cmdHex").value)||"").trim();
    if(!hx){if(typeof flashTrigMsg==="function")flashTrigMsg("Wpisz hex");return;}send(hx);};
  for(const b of document.querySelectorAll(".cmd-preset"))b.onclick=()=>{
    const hex=b.dataset.hex,uuid=b.dataset.uuid;
    if($("cmdHex"))$("cmdHex").value=hex;
    if(uuid&&uuidSel){const opt=[...uuidSel.options].find(o=>o.value===uuid);
      if(opt){uuidSel.value=uuid;if(customFld)customFld.style.display="none";}
      else{uuidSel.value="__custom";if(customFld)customFld.style.display="";if(customInp)customInp.value=uuid;}}
    send(hex,uuid);};
}

// ===================== TIMING: multi countdown + macro playback =====================
function onSeqProgress(m){
  state.seqProg={};
  for(const r of state.rules){const e=document.getElementById("rseq-"+r.id);if(e){e.classList.remove("on");e.textContent="";}}
  for(const p of (m.prog||[])){const id=p[0],count=p[1],need=p[2],remain=p[3];
    state.seqProg[id]=[count,need,remain];
    const e=document.getElementById("rseq-"+id);
    if(e){e.classList.add("on");e.textContent=`⏱ ${count}/${need} · ${(remain/1000).toFixed(1)}s`;}}
}
function onSeqCount(m){
  const txt=({start:"▶ liczę czas…",expire:"⛔ okno minęło (reset)",fire:"✔ zebrano "+m.need})[m.phase]||m.phase;
  const log=document.getElementById("trigLog");
  if(log){const r=document.createElement("div");r.className="ev";
    r.innerHTML=`<span class="t">${m.ts.toFixed(2)}s</span><span>${m.phase==="fire"?"⌨":"⏱"}</span>`+
      `<span>${esc(m.label||"")}</span><span style="color:var(--dim)">${esc(txt)}</span>`;
    log.prepend(r);while(log.children.length>40)log.removeChild(log.lastChild);}
  if(m.phase!=="start"){const e=document.getElementById("rseq-"+m.id);if(e){e.classList.remove("on");e.textContent="";}}
}
// A token per macro run: a late "hide" timer from an earlier run must never hide a newer one.
let _seqRunTok=0,_seqRunHideT=null;
function onSeqMacro(m){
  // A macro presses its steps one at a time, so the drawing of the pad follows it step by step
  // (rf-42) instead of flashing the whole chord the moment the rule fires. Its own guard: a macro
  // must keep running even if the picture throws.
  if(typeof gpvSeq==="function")try{gpvSeq(m);}catch(e){}
  if(m.phase==="start"){
    clearTimeout(_seqRunHideT);   // cancel pending hide from the previous run
    state.seqRun={id:m.id,label:m.label||"makro",total:m.steps,list:m.list||[],cur:-1,
      waitUntil:0,waitMs:0,send:!!m.send,done:false,tok:++_seqRunTok};
    document.getElementById("seqRun").classList.add("on");renderSeqRun();return;
  }
  const s=state.seqRun;if(!s||s.id!==m.id)return;
  if(m.phase==="key"){s.cur=m.i;s.waitUntil=0;s.waitMs=0;}
  else if(m.phase==="wait"){s.cur=m.i;s.waitMs=m.ms;s.waitUntil=performance.now()+m.ms;}
  else if(m.phase==="done"||m.phase==="abort"){s.cur=s.total;s.done=true;
    const tok=s.tok;clearTimeout(_seqRunHideT);   // hide only if this is still THAT run
    _seqRunHideT=setTimeout(()=>{if(state.seqRun&&state.seqRun.tok===tok)hideSeqRun();},800);}
  renderSeqRun();
}
function hideSeqRun(){document.getElementById("seqRun").classList.remove("on");state.seqRun=null;}
function renderSeqRun(){
  const s=state.seqRun;if(!s)return;
  document.getElementById("seqRunLabel").textContent=s.label;
  document.getElementById("seqRunTag").textContent=s.send?"⌨ wysyłane":"podgląd (bez wysyłki)";
  document.getElementById("seqRunSteps").innerHTML=(s.list||[]).map((st,i)=>{
    const cls=s.done?"done":i<s.cur?"done":i===s.cur?"cur":"";
    const wcls=st.k==="wait"?"wait":"";
    const lab=st.k==="wait"?("⏱"+st.v+"ms"):keyLabel(st.v);
    return `<span class="sqs ${cls} ${wcls}">${esc(lab)}</span>`;}).join("");
}
function updateSeqRun(){
  const s=state.seqRun;if(!s)return;const bar=document.getElementById("seqRunBar");if(!bar)return;
  if(s.done){bar.style.width="100%";}
  else if(s.waitUntil&&s.waitMs){const rem=Math.max(0,s.waitUntil-performance.now());
    bar.style.width=(100*(1-rem/s.waitMs)).toFixed(1)+"%";}
  else{bar.style.width=s.total?(100*Math.max(0,s.cur)/s.total).toFixed(1)+"%":"0%";}
}

// ===================== MACRO EDITOR: library + recording =====================
const SEQLIB={
  keys:[["a","a"],["w","w"],["s","s"],["d","d"],["space","␣ spacja"],["enter","⏎ enter"],["esc","⎋ esc"],["right","→"],["left","←"],["up","↑"],["down","↓"],["tab","⭾ tab"]],
  combos:[["ctrl+c","Ctrl+C"],["ctrl+v","Ctrl+V"],["ctrl+x","Ctrl+X"],["ctrl+z","Ctrl+Z"],["alt+tab","Alt+Tab"],["ctrl+shift+esc","Ctrl+Shift+Esc"]],
  hold:[["down space","⬇ trzymaj ␣"],["up space","⬆ puść ␣"],["down w","⬇ trzymaj w"],["up w","⬆ puść w"],
        ["down shift","⬇ trzymaj Shift"],["up shift","⬆ puść Shift"],["down mouse:left","⬇ trzymaj 🖱L"],["up mouse:left","⬆ puść 🖱L"],["wait 500","⏱ 500ms"]],
  media:[["media_play_pause","⏯"],["media_volume_up","🔊 +"],["media_volume_down","🔉 −"],["media_next","⏭"],["media_previous","⏮"],["media_volume_mute","🔇"]],
  // "@point" is not a step — it opens the point panel, which then adds the step it builds.
  // A coordinate cannot be a ready-made chip the way "🖱 L" can: it is different every time.
  mouse:[["mouse:left","🖱 L"],["mouse:right","🖱 P"],["mouse:double","🖱 ×2"],["mouse:scrollup","🖱 ↑"],["mouse:scrolldown","🖱 ↓"],["mouse:moveup","🖱 kursor ↑"],["mouse:movedown","🖱 kursor ↓"],
         ["@point","🖱 punkt na ekranie…"],["mouse:move@50%,50%","🖱 kursor na środek"]],
  pad:[["pad:a","🎮 A"],["pad:b","🎮 B"],["pad:x","🎮 X"],["pad:y","🎮 Y"],
       ["pad:lb","🎮 LB"],["pad:rb","🎮 RB"],["pad:lt","🎮 LT"],["pad:rt","🎮 RT"],
       ["pad:up","🎮 krzyżak ↑"],["pad:down","🎮 krzyżak ↓"],["pad:left","🎮 krzyżak ←"],["pad:right","🎮 krzyżak →"],
       ["pad:start","🎮 Start"],["pad:back","🎮 Back"],
       ["down pad:rt","⬇ trzymaj 🎮 RT"],["up pad:rt","⬆ puść 🎮 RT"]],
  led:[["led on","💡 LED ON"],["led off","💡 LED OFF"]],
  wait:[["wait 50","⏱ 50ms"],["wait 100","⏱ 100ms"],["wait 250","⏱ 250ms"],["wait 500","⏱ 500ms"],["wait 1000","⏱ 1s"]],
};
// ===== CEL EDYTORA MAKRA =====================================================================
// Biblioteka chipow i rejestrator pracowaly do 2026-08-26 na SZTYWNYCH identyfikatorach pol
// edytora wyzwalacza (#edSeq, #edSeqPrev, #seqRec, #seqRecHint). Drugie miejsce, w ktorym pisze sie
// makro - wycinek kola wyboru - nie mialo jak z nich skorzystac, a skopiowanie rejestratora
// oznaczaloby dwie implementacje "co znaczy przytrzymanie klawisza", ktore rozjada sie przy
// pierwszej poprawce jednej z nich.
//
// Dlatego cel jest teraz PARAMETREM: {ta, prev, btn, hint, onChange}. Brak celu = edytor
// wyzwalacza, dokladnie jak dotad - to on zostal pierwszym klientem tej samej maszynerii, a nie
// wyjatkiem obok niej.
let _seqTarget=null;
function seqSetTarget(t){
  // Zmiana celu w trakcie nagrywania zapisywalaby klawisze w polu, ktorego juz nikt nie oglada.
  if(_seqRec)stopSeqRec();
  _seqTarget=t||null;
}
function seqTarget(){return _seqTarget;}
function _seqT(){
  if(_seqTarget)return _seqTarget;
  return {
    ta:document.getElementById("edSeq"),
    prev:document.getElementById("edSeqPrev"),
    btn:document.getElementById("seqRec"),
    hint:document.getElementById("seqRecHint"),
    // To, co bylo wpisane wprost w insertSeqToken/_seqRecAppend: szkic reguly i przypomnienie
    // o sterowniku pada. Nalezy do TEGO celu, nie do rejestratora.
    onChange:function(v){
      if(state._draft)state._draft.sequence=v;
      if(typeof updPadNote==="function")updPadNote();
    },
  };
}

function renderSeqLib(sel,box){
  // Wołane też WPROST jako obsługa zdarzenia (`onchange=renderSeqLib`), a wtedy pierwszym argumentem
  // jest Event, nie element. Bez tego sprawdzenia lista kategorii czytałaby `event.value`, czyli nic,
  // i biblioteka chipów robiła się pusta — po cichu, bo pusty <div> nie jest błędem.
  if(sel&&!sel.tagName)sel=null;
  if(box&&!box.tagName)box=null;
  sel=sel||document.getElementById("seqLib");
  box=box||document.getElementById("seqChips");
  if(!sel||!box)return;
  state._seqLibCat=sel.value;   // remembered across re-renders of the editor (see seqHtml)
  box.innerHTML=(SEQLIB[sel.value]||[]).map(p=>{const v=p[0],l=p[1];
    const cls=(v.startsWith("mouse:")||v==="@point")?"mouse":v.startsWith("wait")?"wait":/(^|\s)pad:/.test(v)?"pad":"";
    return `<button type="button" class="seqchip ${cls}" data-v="${esc(v)}">${esc(l)}</button>`;}).join("");
  box.querySelectorAll(".seqchip").forEach(b=>b.onclick=()=>{
    if(b.dataset.v==="@point"){if(typeof ptOpen==="function")ptOpen("seq");return;}
    insertSeqToken(b.dataset.v);});
}
// Jedno miejsce, w ktorym tekst makra trafia do pola, podgladu i do obslugi zmian pola (onChange).
function _seqWrite(t,v){
  t.ta.value=v;
  if(t.prev)t.prev.textContent=(typeof seqPreview==="function")?seqPreview(v):v;
  if(typeof t.onChange==="function")t.onChange(v);
}
function insertSeqToken(tok){
  const t=_seqT();if(!t||!t.ta)return;
  let v=t.ta.value.trim();v=v?(v.replace(/;\s*$/,"")+"; "+tok):tok;
  _seqWrite(t,v);
  t.ta.focus();
}
let _seqRec=null;
// key name for recording down/up (modifiers are also separate keys to hold)
function _recKeyName(e){const k=e.key;
  if(k==="Control")return "ctrl"; if(k==="Shift")return "shift"; if(k==="Alt")return "alt"; if(k==="Meta")return "cmd";
  if(JSKEY[k]!==undefined)return JSKEY[k];
  if(/^F\d{1,2}$/.test(k))return k.toLowerCase();
  if(k.length===1)return k.toLowerCase();
  return null;}
function _seqRecAppend(tok){
  const now=performance.now(),gap=Math.round(now-_seqRec.last);_seqRec.last=now;
  const t=_seqRec.t;if(!t||!t.ta)return;
  let v=t.ta.value.trim();const parts=[];
  if(v&&gap>=20&&gap<=10000)parts.push("wait "+gap);
  parts.push(tok);
  v=v?(v.replace(/;\s*$/,"")+"; "+parts.join("; ")):parts.join("; ");
  _seqWrite(t,v);
}
function toggleSeqRec(){_seqRec?stopSeqRec():startSeqRec();}
function startSeqRec(){
  const t=_seqT();
  if(!t||!t.ta||!t.btn)return;
  // CEL JEST ZAPAMIĘTANY NA CZAS NAGRANIA, a nie odczytywany przy każdym klawiszu: gdyby w trakcie
  // coś przestawiło aktywny cel, połowa sekwencji wylądowałaby w innym polu niż początek.
  _seqRec={last:performance.now(),down:new Set(),t:t};
  t.btn.classList.add("rec");t.btn.textContent="⏹ Zatrzymaj nagrywanie";
  if(t.hint)t.hint.innerHTML="<b>nagrywam</b> — rejestruję <b>wciśnięcie i puszczenie</b> (przytrzymanie = down…up); Esc kończy";
  // keydown = 'down <key>' (ignore auto-repeat); keyup = 'up <key>' -> faithful hold-downs
  _seqRec.kd=e=>{
    // POLE MOGŁO ZNIKNĄĆ spod nagrania: przełączenie zakładki, przerysowanie listy, zmiana kapsla.
    // Nasłuch na oknie połyka wtedy KAŻDY klawisz w aplikacji, więc koniec jest tu, a nie w nadziei,
    // że ktoś pamiętał zawołać stopSeqRec.
    if(!_seqRec.t.ta||!document.contains(_seqRec.t.ta)||_seqRec.t.ta.offsetParent===null){
      stopSeqRec();return;
    }
    e.preventDefault();e.stopPropagation();
    if(e.key==="Escape"){stopSeqRec();return;}
    if(e.repeat)return;
    const spec=_recKeyName(e);if(!spec||_seqRec.down.has(spec))return;
    _seqRec.down.add(spec);_seqRecAppend("down "+spec);
  };
  _seqRec.ku=e=>{
    const spec=_recKeyName(e);if(!spec||!_seqRec.down.has(spec))return;
    _seqRec.down.delete(spec);_seqRecAppend("up "+spec);
  };
  window.addEventListener("keydown",_seqRec.kd,true);
  window.addEventListener("keyup",_seqRec.ku,true);
}
function stopSeqRec(){
  if(!_seqRec)return;
  const t=_seqRec.t;
  // close out pending presses (balanced macro — no 'down' without 'up')
  for(const spec of Array.from(_seqRec.down))_seqRecAppend("up "+spec);
  window.removeEventListener("keydown",_seqRec.kd,true);
  window.removeEventListener("keyup",_seqRec.ku,true);
  _seqRec=null;
  if(t&&t.btn){t.btn.classList.remove("rec");
    t.btn.textContent=t.recLabel||"Nagraj klawisze";}
  if(t&&t.hint)t.hint.textContent=t.hintLabel||"nagrywa wciśnięcie+puszczenie (przytrzymanie)";
}
