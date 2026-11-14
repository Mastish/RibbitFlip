"use strict";
// ===== battery saving, trigger presets and 3D axis presets =====
// Three small settings surfaces that all persist server-side: sleep/wake for the puck,
// named presets of the whole trigger config, and named 3D axis calibrations.

// ===================== BATTERY SAVING =====================
function onPower(m){
  const D=devEntry(m.dev||state.activeDeviceId||"d0"); D.powerCfg=m;
  if(m.dev&&m.dev!==state.viewDev)return;   // battery-saving panel shows the VIEWED capsule
  state.power={autoSleep:!!m.autoSleep,idleMin:m.idleMin,wakeHex:m.wakeHex||"",
    parked:!!m.parked,batterySec:m.batterySec!=null?m.batterySec:state.power.batterySec,
    autoPause:!!m.autoPause,
    autoPauseSec:m.autoPauseSec!=null?m.autoPauseSec:state.power.autoPauseSec};
  const a=document.getElementById("pwAuto");if(a&&document.activeElement!==a)a.checked=state.power.autoSleep;
  const i=document.getElementById("pwIdle");if(i&&document.activeElement!==i)i.value=state.power.idleMin;
  const w=document.getElementById("pwWake");if(w&&document.activeElement!==w)w.value=state.power.wakeHex;
  const bt=document.getElementById("pwBatt");if(bt&&document.activeElement!==bt&&m.batterySec!=null)bt.value=Math.round(m.batterySec);
  const ap=document.getElementById("pwAutoPause");if(ap&&document.activeElement!==ap)ap.checked=state.power.autoPause;
  const as=document.getElementById("pwAutoPauseSec");
  if(as&&document.activeElement!==as&&m.autoPauseSec!=null)as.value=Math.round(m.autoPauseSec);
  renderAutoPauseVal();
  renderPowerGates();
  renderPowerState();
  if(_pwTierSync)_pwTierSync();
  if(_connAdvSync)_connAdvSync();
}
// "30 s" up to a minute, "2 min" above it — a slider that reads 90 s makes you do the arithmetic
// yourself, and the number under it is the whole point of the control.
function fmtIdleSecs(s){
  s=Math.max(0,Math.round(+s||0));
  if(s<60)return s+" s";
  const m=Math.floor(s/60),r=s%60;
  return r?_gl(m+" min "+r+" s",m+" min "+r+" s"):_gl(m+" min",m+" min");
}
function renderAutoPauseVal(){
  const as=document.getElementById("pwAutoPauseSec"),out=document.getElementById("pwAutoPauseVal");
  if(as&&out)out.textContent=fmtIdleSecs(as.value);
}
function renderPowerGates(){
  const pairs=[["pwAuto","pwIdle"],["pwAutoPause","pwAutoPauseSec"]];
  for(const [boxId,fldId] of pairs){
    const box=document.getElementById(boxId), fld=document.getElementById(fldId);
    if(!box||!fld)continue;
    const off=!box.checked;
    if(fld.disabled!==off)fld.disabled=off;
    // Podpis liczby przy suwaku ma gasnąć razem z nim — inaczej „60 s" stoi w pełnym kontraście
    // nad wygaszonym suwakiem i wygląda na wartość, która obowiązuje. Ale TYLKO wtedy, gdy w tej
    // samej etykiecie nie siedzi przełącznik, który to wyłączył: „Auto-uśpienie po [5] min" jest
    // jedną etykietą razem z własnym haczykiem, a wygaszenie haczyka odebrałoby jedyną drogę
    // z powrotem.
    const lab=fld.closest("label");
    if(lab)lab.classList.toggle("is-off",off&&!lab.contains(box));
  }
}
function renderPowerState(){
  const parked=state.power.parked;
  const sb=document.getElementById("sleepBtn"),wb=document.getElementById("wakeBtn");
  if(sb)sb.style.display=parked?"none":"";
  if(wb)wb.style.display=parked?"":"none";
  const st=document.getElementById("pwState");
  if(st){st.textContent=parked?"Uśpiony, nie wysyła danych":"● Aktywny, przesyła dane";   // UX 261120 B5b: bez pauz (F-G6-09)
    // KOLOR STANU NALEŻY DO ARKUSZA, NIE DO TEJ FUNKCJI. Inline `cv('--ok')` wstawiał tu
    // rysunkowy zielony (3,2:1 na kremie) i — jako styl w atrybucie — nie dał się poprawić
    // z CSS-a. Dwie klasy mówią STAN, a 08-felt-components.css dobiera do niego atrament.
    // WHY: the inline colour was the drawing green (3.2:1 on cream) and, being an attribute
    // style, no stylesheet could fix it; the state is a class now and the sheet picks the ink.
    st.classList.toggle("is-on",!parked);
    st.classList.toggle("is-parked",parked);
    st.style.color="";}
}
function flashPw(t){const el=document.getElementById("pwMsg");if(!el)return;
  el.textContent=t;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("show"),1600);}
function postPower(path,body){
  return fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},
    body:body?JSON.stringify(body):"{}"}).then(r=>r.json());
}
function savePower(){
  postPower("/power",{autoSleep:document.getElementById("pwAuto").checked,
    idleMin:+document.getElementById("pwIdle").value||5,
    wakeHex:document.getElementById("pwWake").value.trim(),
    batterySec:+document.getElementById("pwBatt").value||120,
    autoPause:document.getElementById("pwAutoPause").checked,
    autoPauseSec:+document.getElementById("pwAutoPauseSec").value||60})
    .then(()=>flashPw("Zapisano")).catch(()=>flashPw("Serwer nieosiągalny"));
}
function initPower(){
  document.getElementById("sleepBtn").onclick=()=>postPower("/sleep").then(()=>flashPw("Usypiam…")).catch(()=>flashPw("Serwer nieosiągalny"));
  document.getElementById("wakeBtn").onclick=()=>postPower("/wake").then(()=>flashPw("Wznawiam…")).catch(()=>flashPw("Serwer nieosiągalny"));
  // Przełącznik najpierw wygasza (albo odsłania) swoją liczbę, a dopiero potem zapisuje: kolejność
  // odwrotna zostawiała pole czynne aż do odpowiedzi serwera.
  document.getElementById("pwAuto").onchange=()=>{renderPowerGates();savePower();};
  document.getElementById("pwIdle").onchange=savePower;
  document.getElementById("pwWake").onchange=savePower;
  document.getElementById("pwBatt").onchange=savePower;
  document.getElementById("pwAutoPause").onchange=()=>{renderPowerGates();savePower();};
  // `oninput` paints the number while the thumb is moving, `onchange` is the one that saves —
  // a POST per pixel of drag would hammer the server and re-emit power on every step.
  document.getElementById("pwAutoPauseSec").oninput=renderAutoPauseVal;
  document.getElementById("pwAutoPauseSec").onchange=savePower;
  document.getElementById("pwWakeReset").onclick=()=>{document.getElementById("pwWake").value="201000d007340003";savePower();};
  renderAutoPauseVal();
  renderPowerGates();
  renderPowerState();
  initConnTiers();
}

// ===== UX 261120 L4b: piętra ekranu Połączenie =====
// Piętro 1: stan łącza, Uśpij/Wznów i „Dodaj kapsel” (akcja główna). Piętro 2: „Nazwa i dioda”
// oraz „Oszczędzanie baterii” (#powerCard), zwinięte, z wartościami w nagłówku. Piętro 3:
// „Zaawansowane” (#connAdv) z licznikami, komendą wybudzenia, komendami hex i CSV.
const PW_DEF={pwAuto:false,pwIdle:5,pwBatt:120,pwAutoPause:false,pwAutoPauseSec:60};
const PW_WAKE_DEF="201000d007340003";
let _pwTierSync=null,_connAdvSync=null;
function _pwVals(){
  const $=id=>document.getElementById(id),o={};
  for(const id in PW_DEF){const e=$(id);if(e)o[id]=(e.type==="checkbox")?e.checked:e.value;}
  return o;
}
function _pwApply(v){
  const $=id=>document.getElementById(id);
  for(const id in v){const e=$(id);if(!e)continue;if(e.type==="checkbox")e.checked=!!v[id];else e.value=v[id];}
  renderAutoPauseVal();renderPowerGates();savePower();
}
function _pwSummary(){
  const v=_pwVals();
  return (v.pwAuto?_gl("Auto-uśpienie po "+v.pwIdle+" min","Auto-sleep after "+v.pwIdle+" min"):_gl("Auto-uśpienie: wył.","Auto-sleep: off"))+
    " · "+_gl("bateria co "+v.pwBatt+" s","battery every "+v.pwBatt+" s")+
    " · "+(v.pwAutoPause?_gl("wstrzymanie po "+fmtIdleSecs(v.pwAutoPauseSec),"pause after "+fmtIdleSecs(v.pwAutoPauseSec))
                        :_gl("wstrzymanie: wył.","pause: off"));
}
function _pwWakeChanged(){
  const e=document.getElementById("pwWake"),v=((e&&e.value)||"").replace(/\s+/g,"").toLowerCase();
  return (v&&v!==PW_WAKE_DEF)?1:0;
}
function initConnTiers(){
  const $=id=>document.getElementById(id);
  const add=$("connAddBtn");
  if(add)add.onclick=()=>{const b=$("deviceAddBtn");if(b)b.click();else if(typeof openPairing==="function")openPairing();};
  const ed=$("connEditBtn");
  if(ed)ed.onclick=()=>{const id=state.viewDev||state.activeDeviceId;if(id&&typeof openDeviceEditor==="function")openDeviceEditor(id);};
  if(typeof rfTier!=="function")return;
  rfTier($("connNameFold"),"polaczenie.nazwa",{
    sum:()=>{const n=$("dName");return (n&&n.textContent.trim())||"—";},
    changed:()=>0});
  _pwTierSync=rfTier($("powerCard"),"polaczenie.bateria",{
    sum:_pwSummary,
    changed:()=>{const v=_pwVals();let n=0;for(const id in PW_DEF)if(id in v&&!rfTier.same(v[id],PW_DEF[id]))n++;return n;},
    reset:()=>_pwApply(Object.assign({},PW_DEF)),take:_pwVals,restore:_pwApply});
  _connAdvSync=rfTier($("connAdv"),"polaczenie.zaawansowane",{changed:_pwWakeChanged});
}
// (koniec sekcji L4b)

// ===================== TRIGGER PRESETS (once called "profiles") =====================
// The files and the endpoints still say "profile" — renaming those would break saved libraries and
// the server contract. What the user READS says "konfiguracja", because that is what the hub above
// the trigger list calls it.
//
// ⚠️ 2026-08-28: THE „Presety wyzwalaczy" ROW THAT USED TO LIVE HERE IS GONE, and so is everything
// that only served it (initProfiles, and the #profSelect filling below). Mapping had THREE surfaces
// for one job — that row, the thin identity bar (rf-49) and the Library tab — each saving the same
// file under a different word. The hub (rf-49i, mounted by rf-49b) took over all of it: choosing
// and loading are the tiles and their pickers, saving is the „+" tile and „Zapisz zmiany", deleting
// is the ✕ on a tile, and „Wymiana" moved into the hub's header keeping its id.
//
// This function STAYS, because it is not part of that row: it fetches the preset library into
// state.trigPresets, which the hub, the Library tab and the sharing window all read. It is called
// from initTrigCfgHub (first fill), from the editor and from the Library after a save.
function loadProfileList(selName){
  fetch("/profiles").then(r=>r.json()).then(j=>{
    // The hub needs the presets' CONTENTS, not just their names: „zmienione" is a comparison and a
    // name cannot answer it, and the tile shows the description and the rule count. An older server
    // sends names only — then the hub simply has nothing to compare against and stays quiet, which
    // is better than a second request that would also fail.
    state.trigPresets=Array.isArray(j.items)?j.items:(j.profiles||[]).map(n=>({name:n,rules:null,desc:""}));
    // Ile znaków może mieć opis — z serwera, żeby pole tekstowe nie trzymało własnej kopii limitu.
    if(j.descMax!=null)state.trigDescMax=+j.descMax||0;
    if(typeof trigCfgSync==="function")trigCfgSync();
  }).catch(()=>{});
}

// ===================== 3D AXIS CONFIGURATION PRESETS =====================
// SEPARATE from trigger presets (Library/Profiles/): different endpoints /pose-preset/*, different directory Library/AxisPresets/, different UI IDs.
function loadPosePresetList(selName){
  fetch("/pose-presets").then(r=>r.json()).then(j=>{
    // ONE fetch feeds BOTH bars. This row needs the names; the identity bar above the panel
    // (rf-49h) needs the presets' CONTENTS, because „zmienione" is a comparison and a name cannot
    // answer it. An older server sends names only — then the bar simply has nothing to compare
    // against and says nothing, which is better than a second request that would also fail.
    state.posePresets=Array.isArray(j.items)?j.items:(j.presets||[]).map(n=>({name:n,config:null}));
    if(typeof poseCfgSync==="function")poseCfgSync();
    const s=document.getElementById("posePresetSelect");if(!s)return;
    const cur=selName||s.value;
    s.innerHTML='<option value="">— wybierz —</option>'+
      (j.presets||[]).map(p=>`<option value="${esc(p)}" ${p===cur?"selected":""}>${esc(p)}</option>`).join("");
  }).catch(()=>{});
}
// Apply the loaded preset to the active state + UI. Does NOT call savePoseCal (server already saved
// the active config on /pose-preset/load) — only saves the localStorage cache, without a repeat POST.
function applyPoseConfig(c){
  if(!c)return;
  applyPoseCfgToState(c);      // same reader the panel and every capsule switch use
  POSE.seeded=false;
  poseCacheWrite();            // cache of the CURRENTLY viewed capsule (per-slot key)
  syncPoseControls();
}
// Komunikaty tego pliku mówi czaszka (`rfSay`, UX 261120 A1): przyciski stoją w Czujniku,
// a `#trigMsg` w karcie Mapowania, której stąd nie widać.
// Fill the "copy 3D axes from another Triki" picker + bind its button once; show the row only when ≥2 devices exist.
function refreshPoseCopyFrom(){
  const row=document.getElementById("poseCopyRow"),sel=document.getElementById("poseCopyFrom");
  if(!row||!sel)return;
  const btn=document.getElementById("poseCopyBtn");
  if(btn&&!btn._wired){btn._wired=true;btn.onclick=()=>{
    const srcId=sel.value;
    if(!srcId){rfSay("Wybierz Triki, z którego skopiować osie 3D",{tone:"warn"});return;}
    const D=state.devices[srcId],nm=(D&&D.meta&&(D.meta.label||D.meta.name))||srcId;
    fetch("/pose?dev="+encodeURIComponent(srcId)).then(r=>r.json())
      .then(cfg=>{if(!cfg||!_calChannelsOk(cfg.cal)){rfSay("Ten Triki nie ma zapisanych osi 3D",{tone:"warn"});return;}
        applyPoseConfig(cfg);savePoseCal();
        // Ten kapsel ma teraz DOKŁADNIE tę konfigurację, więc nosi też jej nazwę. Bez tego pasek
        // tożsamości pokazywałby starą nazwę nad cudzymi osiami — czyli kłamałby. Osobne pytanie,
        // bo savePoseCal() wysyła same osie: nazwa nie jedzie w poseCfgObj (patrz rf-49h).
        if(typeof poseCfgTakeName==="function")poseCfgTakeName(String(cfg.configName||""));
        rfSay("Wczytano osie 3D z: "+nm,{tone:"ok"});})
      .catch(()=>rfSay("Serwer nieosiągalny",{tone:"danger"}));
  };}
  const others=Object.values(state.devices||{}).filter(D=>D&&D.meta&&D.meta.dev!==state.activeDeviceId)
    .sort((a,b)=>(a.meta.slot||0)-(b.meta.slot||0));
  if(!others.length){row.style.display="none";sel.innerHTML='<option value="">— inny Triki —</option>';return;}
  const cur=sel.value;
  sel.innerHTML='<option value="">— inny Triki —</option>'+others.map(D=>`<option value="${esc(D.meta.dev)}">${esc(D.meta.label||D.meta.name||D.meta.dev)}</option>`).join("");
  if([...sel.options].some(o=>o.value===cur))sel.value=cur;
  const _pcp=document.getElementById("poseCopyPrev");
  const _pcSet=()=>{if(_pcp)_pcp.innerHTML=sel.value?capImgSpan(sel.value,20):"";};
  if(!sel._prevWired){sel._prevWired=true;sel.addEventListener("change",_pcSet);}
  _pcSet();
  row.style.display="";
}
function initPosePresets(){
  if(!document.getElementById("posePresetSelect"))return;
  loadPosePresetList();
  document.getElementById("posePresetSave").onclick=()=>{
    const name=(document.getElementById("posePresetName").value||document.getElementById("posePresetSelect").value||"").trim();
    if(!name){rfSay("Podaj nazwę presetu osi",{tone:"warn"});return;}
    fetch("/pose-preset/save",{method:"POST",headers:{"Content-Type":"application/json"},
      // poseCfgObj() = the WHOLE axis configuration (rf-33). Hand-listing the fields here meant a
      // preset quietly dropped the axis direction and the tuning chains, and loading it reset them.
      body:JSON.stringify({name,config:poseCfgObj()})}).then(r=>r.json())
      .then(j=>{if(j.ok){rfSay("Zapisano preset osi: "+name,{tone:"ok"});document.getElementById("posePresetName").value="";loadPosePresetList(name);}
        else rfSay("Błąd zapisu presetu osi",{tone:"danger"});}).catch(()=>rfSay("Serwer nieosiągalny",{tone:"danger"}));
  };
  document.getElementById("posePresetLoad").onclick=()=>{
    const name=document.getElementById("posePresetSelect").value;
    if(!name){rfSay("Wybierz preset osi z listy",{tone:"warn"});return;}
    fetch("/pose-preset/load",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name})}).then(r=>r.json())
      .then(async j=>{if(j.ok&&j.config){
          // poseCfgObj() still reads the OLD axes until applyPoseConfig runs, so the snapshot goes here.
          await _rfUndoStash("pose");
          applyPoseConfig(j.config);
          // Serwer nadał kapslowi nazwę wczytanego presetu (apply_pose_preset) — pasek tożsamości
          // nad panelem musi się o tym dowiedzieć, bo żaden strumień mu tego nie powie.
          if(typeof poseCfgAdopt==="function")poseCfgAdopt(j.config);
          _rfUndoShowToast(_gl("Wczytano preset osi 3D „","Loaded the 3D axis preset “")+name+"”.");}
        else rfSay(j.error||"Błąd wczytania presetu",{tone:"danger"});}).catch(()=>rfSay("Serwer nieosiągalny",{tone:"danger"}));
  };
  document.getElementById("posePresetDel").onclick=async ()=>{
    const name=document.getElementById("posePresetSelect").value;
    if(!name){rfSay("Wybierz preset osi do usunięcia",{tone:"warn"});return;}
    if(!await rfConfirm("Preset osi „"+name+"” zostanie trwale usunięty.",{title:"Usunąć preset osi?",icon:'<span class="rfm-bin"></span>',tone:"danger",confirmLabel:"Usuń",cancelLabel:"Anuluj"}))return;
    fetch("/pose-preset/delete",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name})}).then(r=>r.json())
      .then(()=>{rfSay("Usunięto preset osi: "+name,{tone:"ok"});loadPosePresetList("");}).catch(()=>rfSay("Serwer nieosiągalny",{tone:"danger"}));
  };
}

