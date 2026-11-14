"use strict";
// ============================================================================
//  MCP SERVER CARD — the opt-in switch for the AI-assistant endpoint (/mcp).
//  Lives in the "Biblioteka" tab, right under the Library card: an assistant's
//  whole job here is composing Setups, so the switch belongs next to the place
//  where Setups are saved and shared.
//  Polish is authored here; English comes from the pairs below, merged into the
//  global I18N_EN BEFORE initI18n() runs (same contract as rf-39b-guides.js).
//  Server state is the only source of truth — nothing is assumed before GET /mcp/config.
// ============================================================================
const RF_MCP_I18N={
 "Serwer MCP (asystenci AI)":"MCP server (AI assistants)",
 "pozwól asystentowi AI czytać i układać Twoje zestawy":"let an AI assistant read and compose your setups",
 "Asystent AI (np. Claude Code) może odczytać Twoją konfigurację i ułożyć zestaw pod konkretną grę. Wszystko zostaje na tym komputerze, a makra i skróty systemowe wymagają Twojej zgody.":"An AI assistant (Claude Code for example) can read your configuration and compose a setup for a specific game. Everything stays on this computer, and macros and system shortcuts need your consent.",
 "Serwer MCP":"MCP server",
 "Adres dla klienta MCP":"Address for the MCP client",
 "Włącz/wyłącz serwer MCP dla asystentów AI":"Turn the MCP server for AI assistants on/off",
 "Skopiuj adres do schowka":"Copy the address to the clipboard",
 "Kopiuj adres":"Copy address",
 "Skopiowano adres":"Address copied",
 "Nie udało się skopiować":"Could not copy",
 "Wyłączony":"Off",
 "Zablokowany (--no-mcp)":"Locked (--no-mcp)",
 "Nie udało się zmienić ustawienia MCP":"Could not change the MCP setting",
 "Asystent może uzbrajać":"Assistant may arm",
 "Pozwól asystentowi uzbrajać aplikację, włączać Skaner i Koło oraz wczytywać ryzykowne reguły":"Let the assistant arm the app, switch the Scanner and the Wheel on and load risky rules",
 "Wyłączone: asystent tylko układa ustawienia. Uzbrajasz Ty, przyciskiem w nagłówku i włącznikami modułów.":"Off: the assistant only composes settings. You arm it, with the header button and the module switches.",
 "Włączone: asystent może sam uzbroić aplikację, włączyć Skaner albo Koło i wczytać makra.":"On: the assistant may arm the app itself, switch the Scanner or the Wheel on and load macros.",
};
try{Object.assign(I18N_EN,RF_MCP_I18N);}catch(e){}   // i18n module may be absent in the cheat-sheet view

// Last state received from the server: {enabled, locked, url, allowArm}. Never guessed client-side.
// `allowArm` (2026-10-16) — zgoda na to, żeby asystent sam uzbrajał aplikację, włączał Skaner albo
// Koło i wczytywał reguły ryzykowne. Domyślnie wyłączona; serwer odmawia bez niej
// (ribbitflip_mcp._require_consent), więc ten włącznik to jedyna droga do takich zmian przez MCP.
let _mcpCfg={enabled:false,locked:false,url:"",allowArm:false};

// Karta stoi w zakładce „Konfiguracja" (`tab-ustawienia`) — od 2026-08-31, kiedy ustawienia
// samego programu wyprowadzono z „Zestawów". Wcześniej trzeba było przewinąć całą bibliotekę
// zestawów, żeby dojść do włącznika serwera MCP.
function initMcpUi(){
  const panel=document.getElementById("tab-ustawienia");
  if(!panel||document.getElementById("mcpCard"))return;   // no panels in the ?view=overview cheat sheet
  const card=document.createElement("div");card.className="card";card.id="mcpCard";
  card.innerHTML=
    '<div class="head"><h2><span class="rfic hd-ic hd-ic-atom" aria-hidden="true"></span>Serwer MCP (asystenci AI)</h2>'+
      '<span class="hint">pozwól asystentowi AI czytać i układać Twoje zestawy</span></div>'+
    '<div class="ra-lead">Asystent AI (np. Claude Code) może odczytać Twoją konfigurację i ułożyć zestaw pod konkretną grę. Wszystko zostaje na tym komputerze, a makra i skróty systemowe wymagają Twojej zgody.</div>'+
    '<div class="setupbar mcpbar">'+
      '<span class="setuplbl">Serwer MCP</span>'+
      '<div class="rf-toggle" id="mcpEnable" role="switch" aria-checked="false" tabindex="0" title="Włącz/wyłącz serwer MCP dla asystentów AI">'+
        '<span class="rf-tg-lbl off">Wył.</span><span class="rf-tg-knob"></span><span class="rf-tg-lbl on">Wł.</span></div>'+
      '<span class="ra-pill" id="mcpPill"></span>'+
      '<span class="setupmsg" id="mcpMsg" role="status" aria-live="polite"></span>'+
    '</div>'+
    '<div class="setupbar mcpbar" id="mcpArmRow">'+
      '<span class="setuplbl">Asystent może uzbrajać</span>'+
      '<div class="rf-toggle" id="mcpAllowArm" role="switch" aria-checked="false" tabindex="0" title="Pozwól asystentowi uzbrajać aplikację, włączać Skaner i Koło oraz wczytywać ryzykowne reguły">'+
        '<span class="rf-tg-lbl off">Wył.</span><span class="rf-tg-knob"></span><span class="rf-tg-lbl on">Wł.</span></div>'+
      '<span class="hint" id="mcpArmHint"></span>'+
    '</div>'+
    '<div class="setupbar mcpbar" id="mcpUrlRow">'+
      '<span class="setuplbl">Adres dla klienta MCP</span>'+
      '<input type="text" id="mcpUrl" readonly value="">'+
      '<button class="btn sm" id="mcpCopy" title="Skopiuj adres do schowka"><span class="ra-ic" aria-hidden="true">📋</span>Kopiuj adres</button>'+
    '</div>'+
    '<div class="setup-note" id="mcpLockNote" style="display:none">Aplikację uruchomiono z --no-mcp, więc przełącznik jest zablokowany do końca sesji.</div>';
  // PIĘTRO 3 (UX 261120 L4c): serwer MCP to sprawa dla dociekliwych, więc karta stoi w jedynym
  // „Zaawansowane” ekranu Ustawienia, na samym dole (rfUstawOrder w rf-40 trzyma je na końcu).
  let adv=document.getElementById("usAdv");
  if(!adv){adv=document.createElement("details");adv.className="cardfold adv";adv.id="usAdv";
    adv.innerHTML='<summary>Zaawansowane</summary><div class="cardfold-body"></div>';panel.appendChild(adv);
    try{if(typeof rfTier==="function")rfTier(adv,"ustawienia.zaawansowane");}catch(e){}}
  adv.querySelector(".cardfold-body").appendChild(card);
  const tg=card.querySelector("#mcpEnable");
  if(tg)tg.addEventListener("click",_mcpToggle);        // Enter/Space handled globally for .rf-toggle (rf-27-fx-draw.js)
  const ta=card.querySelector("#mcpAllowArm");
  if(ta)ta.addEventListener("click",_mcpToggleArm);
  const cp=card.querySelector("#mcpCopy");
  if(cp)cp.addEventListener("click",_mcpCopyUrl);
  _mcpFetchState();
}

function _mcpFetchState(){
  fetch("/mcp/config").then(r=>r.json()).then(function(j){
    if(!j||!j.ok)return;
    _mcpCfg={enabled:!!j.enabled,locked:!!j.locked,url:j.url||"",allowArm:!!j.allowArm};
    _mcpRender();
  }).catch(function(){});
}

function _mcpToggle(){
  if(_mcpCfg.locked)return;
  const want=!_mcpCfg.enabled;
  fetch("/mcp/config",{method:"POST",headers:{"Content-Type":"application/json"},
                       body:JSON.stringify({enabled:want})})
    .then(r=>r.json()).then(function(j){
      if(!j||!j.ok){_mcpMsg("Nie udało się zmienić ustawienia MCP");}
      _mcpFetchState();                                  // re-read: the server decides, not us
    }).catch(function(){_mcpMsg("Nie udało się zmienić ustawienia MCP");});
}

function _mcpToggleArm(){
  if(_mcpCfg.locked)return;
  fetch("/mcp/config",{method:"POST",headers:{"Content-Type":"application/json"},
                       body:JSON.stringify({allowArm:!_mcpCfg.allowArm})})
    .then(r=>r.json()).then(function(j){
      if(!j||!j.ok){_mcpMsg("Nie udało się zmienić ustawienia MCP");}
      _mcpFetchState();
    }).catch(function(){_mcpMsg("Nie udało się zmienić ustawienia MCP");});
}

// CO ZROBIŁ ASYSTENT — dymek przy każdym zapisie przez MCP (zdarzenie `mcp_action`, serwer:
// ribbitflip_mcp._note_action). Do 2026-10-16 serwer je nadawał, a panel milczał, więc zmiana
// konfiguracji przez asystenta była widoczna dopiero wtedy, gdy ktoś sam na nią trafił.
const RF_MCP_TOOL_WORDS={
  set_rules:["zmienił reguły Mapowania","changed the Mapping rules"],
  apply_setup:["wczytał zestaw","loaded a setup"],
  save_setup:["zapisał zestaw w Bibliotece","saved a setup to the Library"],
  set_output:["zmienił wyjścia (uzbrojenie, port MIDI albo OSC)","changed the outputs (arming, MIDI port or OSC)"],
  set_module_config:["zmienił ustawienia Skanera albo Koła","changed the Scanner or Wheel settings"],
  set_scanner_layout:["zmienił układ skanera","changed the scanner layout"]
};
function rfOnMcpAction(m){
  const w=RF_MCP_TOOL_WORDS[(m&&m.tool)||""]||["zmienił konfigurację","changed the configuration"];
  const gl=(typeof _gl==="function")?_gl:function(pl){return pl;};
  const who=gl("Asystent AI ","AI assistant ");
  const dev=(m&&m.dev&&m.dev!=="d0")?" ("+m.dev+")":"";
  try{ if(typeof window.rfToast==="function")window.rfToast(who+gl(w[0],w[1])+dev); }catch(e){}
}

function _mcpCopyUrl(){
  const t=_mcpCfg.url||"";
  if(!t)return;
  try{
    navigator.clipboard&&navigator.clipboard.writeText(t);
    _mcpMsg("Skopiowano adres");
  }catch(e){_mcpMsg("Nie udało się skopiować");}
}

function _mcpMsg(pl){
  const m=document.getElementById("mcpMsg");
  if(!m)return;
  m.textContent=pl;                                      // PL text + I18N pair -> the walker translates it
  setTimeout(function(){if(m.textContent===pl)m.textContent="";},2600);
}

function _mcpRender(){
  const card=document.getElementById("mcpCard");
  if(!card)return;
  const on=!!_mcpCfg.enabled,locked=!!_mcpCfg.locked;
  const tg=card.querySelector("#mcpEnable");
  if(tg){
    tg.classList.toggle("on",on);
    tg.setAttribute("aria-checked",on?"true":"false");
    tg.setAttribute("aria-disabled",locked?"true":"false");
    tg.style.opacity=locked?"0.45":"";
    tg.style.pointerEvents=locked?"none":"";
  }
  const pill=card.querySelector("#mcpPill");
  if(pill){
    // Not a bare repeat of the switch: says what the server is actually doing right now.
    pill.textContent=locked?"Zablokowany (--no-mcp)":(on?"Włączony, nasłuchuje lokalnie":"Wyłączony");
    pill.className="ra-pill "+(locked?"warn":(on?"ok":"bad"));
  }
  const u=card.querySelector("#mcpUrl");
  if(u)u.value=_mcpCfg.url||"";
  const row=card.querySelector("#mcpUrlRow");
  if(row)row.style.display=on?"":"none";                 // the address only means something while it answers
  const ta=card.querySelector("#mcpAllowArm");
  if(ta){
    const arm=!!_mcpCfg.allowArm;
    ta.classList.toggle("on",arm);
    ta.setAttribute("aria-checked",arm?"true":"false");
    ta.setAttribute("aria-disabled",locked?"true":"false");
    ta.style.opacity=locked?"0.45":"";
    ta.style.pointerEvents=locked?"none":"";
    const h=card.querySelector("#mcpArmHint");
    if(h)h.textContent=arm?"Włączone: asystent może sam uzbroić aplikację, włączyć Skaner albo Koło i wczytać makra."
                          :"Wyłączone: asystent tylko układa ustawienia. Uzbrajasz Ty, przyciskiem w nagłówku i włącznikami modułów.";
  }
  const armRow=card.querySelector("#mcpArmRow");
  if(armRow)armRow.style.display=on?"":"none";           // the consent only means something while MCP answers
  const note=card.querySelector("#mcpLockNote");
  if(note)note.style.display=locked?"":"none";
}
