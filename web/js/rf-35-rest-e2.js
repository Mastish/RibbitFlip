"use strict";
// ========== Uslugi sieciowe — HTTP (and OBS Studio) sending to other applications ==========
// This file owns the data model (+ sanitizer), the credential vault and the tab's header/vault UI.
// Non-secret configuration (applications / actions / triggers) is stored on the server as plain
// JSON: GET|POST /rest/config. Credentials go to a vault instead: an encrypted blob at
// GET|POST /rest/vault, encrypted by the BROWSER (native crypto.subtle: PBKDF2-SHA-256 →
// AES-GCM 256), so neither the password nor any plaintext ever reaches the server.
// Plaintext secrets exist ONLY inside the _RaVault closure — never on window, localStorage or console.
const RA_ITER_NEW=310000;                 // PBKDF2 rounds for a NEW vault (an existing one keeps the count stored in its blob)
const RA_IDLE_MS=15*60*1000;              // full auto-lock after this much module inactivity
const RA_MASK="\u2022\u2022\u2022\u2022"; // ●●●● — what a secret is replaced with in previews and the log
// KINDS. The first four are HTTP: each one names a place in the request where its value goes, and
// restBuildRequest puts it there. `obspass` is NOT one of them — it is the OBS Studio password, and
// it is never attached to anything, because obs-websocket does not take a password: it sends a
// challenge and takes a digest. The OBS card computes that digest (see rf-38b-obs.js) and the
// password itself never leaves this browser, exactly like every other secret here.
const RA_KINDS=[["bearer","Token (Bearer)","Token (Bearer)"],["basic","Login i hasło (Basic)","Username & password (Basic)"],
                ["header","Własny nagłówek","Custom header"],["query","Parametr w adresie","Query parameter"],
                ["obspass","Hasło OBS (WebSocket)","OBS password (WebSocket)"]];
const RA_FIELDS={bearer:[["token","Token","Token"]],
                 basic:[["user","Login","Username"],["pass","Hasło","Password"]],
                 header:[["hname","Nazwa nagłówka","Header name"],["value","Wartość","Value"]],
                 query:[["pname","Nazwa parametru","Parameter name"],["value","Wartość","Value"]],
                 obspass:[["password","Hasło serwera WebSocket w OBS","OBS WebSocket server password"]]};
const RA_SECRET_FIELDS={bearer:["token"],basic:["pass"],header:["value"],query:["value"],
                        obspass:["password"]};   // rendered as password inputs and redacted from the log
const RA_METHODS=["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"];
const RA_BODY_TYPES=["json","text","form","none"];
// Źródła, operatory i zachowania warunku ruchu. Słownik jest CELOWO ten sam, co w Mapowaniu
// (rf-10 `FILTER_METRICS`, rf-12 `condCardHtml`, rf-12 pasek zachowań) — „wyzwalacz w Usługach
// konfiguruje się inaczej niż reguła" było błędem, nie cechą.
// `pose.spin` (wirowanie, energia ruchu żyroskopu) jedzie w tym samym pakiecie `pv`, co reszta
// pozy — brakowało go tu, nie w danych, więc „potrząśnięcie" było w Mapowaniu jednym warunkiem,
// a w Usługach nieosiągalne.
const RA_SOURCES=["pose.tilt","pose.pitch","pose.roll","pose.twist","pose.spin",
                  "ch0","ch1","ch2","ch3","ch4","ch5"];
const RA_CMPS=[">","<",">=","<=","in","out"];          // te same sześć, co w karcie warunku Mapowania
// Zachowania nazwane słowami Mapowania. Stare nazwy („cross", „while") zostają na wejściu NA ZAWSZE:
// migracja bez nich znaczy, że każdy istniejący wyzwalacz po aktualizacji cicho wraca do „Jednorazowo".
const RA_MODES=["once","continuous","dwell","multi","taps"];
const RA_MODE_OLD={cross:"once",while:"continuous"};
function _raMode(m){m=String(m||"");if(RA_MODE_OLD[m])m=RA_MODE_OLD[m];
  return RA_MODES.indexOf(m)>=0?m:"once";}
let restRoot=null;        // the tab panel element (#tab-restapi); stays null until initRest runs
let _raInited=false;
let _raSeq=0;             // id counter, seeded from the highest existing id so restored configs never collide

// ---------- model sanitizing (config v2) ----------
function _raStr(v,max){return (typeof v==="string")?v.slice(0,max||500):"";}
function _raInt(v,lo,hi,dflt){const n=parseInt(v,10);return isFinite(n)?Math.min(hi,Math.max(lo,n)):dflt;}
function _raNum(v,dflt){const n=parseFloat(v);return isFinite(n)?n:dflt;}
function _raPairs(v){const out=[];if(!Array.isArray(v))return out;
  for(const p of v.slice(0,50)){if(!Array.isArray(p))continue;const k=_raStr(p[0],200);if(!k)continue;out.push([k,_raStr(p[1],4000)]);}
  return out;}
function _raId(id,pfx,seen){          // keep a valid id, regenerate empty/duplicate/tampered ones
  let v=(typeof id==="string")?id.replace(/[^A-Za-z0-9_-]/g,"").slice(0,24):"";
  if(!v||seen.has(v)){do{v=pfx+(++_raSeq);}while(seen.has(v));}
  seen.add(v);return v;}
function _raNewId(pfx){return pfx+(++_raSeq);}
function _raSeedSeq(o,depth){         // seed the counter from the highest existing id — BEFORE anything is regenerated
  if(!o||typeof o!=="object"||(depth||0)>4)return;
  if(typeof o.id==="string"){const n=parseInt(o.id.replace(/\D/g,""),10);if(isFinite(n)&&n>_raSeq)_raSeq=n;}
  for(const k of ["apis","actions","triggers"]){const a=o[k];if(Array.isArray(a))for(const x of a)_raSeedSeq(x,(depth||0)+1);}}
function _raDefObs(){return {host:"127.0.0.1",port:4455,credId:""};}   // where OBS is + which vault entry holds its password
function _raDefCfg(){return {v:2,enabled:false,configName:"",apis:[],vars:{},
  settings:{keepUnlockedForSend:true,obs:_raDefObs()}};}   // configName = nazwa noszonego presetu (rf-49n)
function _raMethod(m){m=String(m||"").toUpperCase();return RA_METHODS.indexOf(m)>=0?m:"POST";}
function _raBodyType(b){b=String(b||"");return RA_BODY_TYPES.indexOf(b)>=0?b:"json";}
// JEDNO miejsce, w którym spisany jest kształt warunku ruchu.
//
// DLACZEGO JEDNO. Ten obiekt był budowany od zera w SIEDMIU miejscach (sanitizer tutaj, `_ra4DefTrig`
// i `_ra4Fix` i przełącznik rodzaju w rf-37, eksport i podgląd importu i scalanie w rf-39). Pole
// dopisane do sześciu z nich znikało dokładnie w jednym przepływie i działało w pozostałych — czyli
// objawiało się jako „u mnie działa". Teraz wszystkie siedem woła tę funkcję; jeśli dokładasz pole,
// dokładasz je TUTAJ i nigdzie indziej.
//
// ⚠️ Sanitizer działa wyłącznie przy ODCZYCIE. Zapis (`_raPostCfg`) serializuje żywy obiekt, więc
// pole spoza tej listy dojeżdża na dysk i działa przez całą sesję — ginie dopiero po przeładowaniu
// panelu. Weryfikacja nowego pola BEZ F5 niczego nie dowodzi.
function _raSanMotion(s){
  s=(s&&typeof s==="object")?s:{};
  const cmp=(RA_CMPS.indexOf(s.cmp)>=0)?s.cmp:">";
  const rng=(cmp==="in"||cmp==="out");
  return {
    source:(RA_SOURCES.indexOf(s.source)>=0?s.source:"pose.tilt"),
    cmp:cmp,
    threshold:_raNum(s.threshold,0),
    // Górna granica istnieje TYLKO dla zakresu. Trzymamy tę samą regułę, co serwer przy regułach
    // Mapowania (kasuje `thresholdHi`, gdy operator nie jest zakresowy) — inaczej przełączenie
    // operatora tam i z powrotem zostawia zakres o zerowej szerokości.
    thresholdHi:rng?_raNum(s.thresholdHi,_raNum(s.threshold,0)):null,
    abs:s.abs===true,
    neg:s.neg===true,
    mode:_raMode(s.mode),
    dwellMs:_raInt(s.dwellMs,0,600000,400),
    crossings:_raInt(s.crossings,1,20,2),      // „X razy w czasie" / „Dokładnie N puknięć"
    windowMs:_raInt(s.windowMs,50,60000,600)
  };
}
function _raSanSrc(s){                // trigger source: shape validation only, evaluation lives in the trigger runtime
  s=(s&&typeof s==="object")?s:{};
  const dev=_raStr(s.dev,24)||"any";
  if(s.kind==="motion")return Object.assign({kind:"motion",dev:dev},_raSanMotion(s));
  return {kind:"rule",dev:dev,ruleId:_raStr(s.ruleId,40)||"any"};}
// Per-trigger Windows notification: {on, mode}. "active" (a notification on the condition's rising
// and falling edge) only makes sense for an own motion threshold — a trigger riding on a Mapping
// rule has no state of its own, and that rule already offers the same option in its own editor.
function _raSanToast(v,src){
  const on=!!(v&&typeof v==="object"&&v.on);
  const motion=!!(src&&src.kind==="motion");
  const mode=(v&&v.mode==="active"&&motion)?"active":"fire";
  return {on:on,mode:mode,silent:!(v&&v.silent===false),   // silent unless explicitly turned off
          text:_raStr(v&&v.text,120)};}
function _raSanApi(a,seen){
  if(!a||typeof a!=="object"||Array.isArray(a))return null;
  const api={id:_raId(a.id,"a",seen),name:_raStr(a.name,80)||"API",baseUrl:_raStr(a.baseUrl,500),
    headers:_raPairs(a.headers),credId:_raStr(a.credId,40),timeoutMs:_raInt(a.timeoutMs,1,30000,10000),
    actions:[],triggers:[]};
  const _pk=_raStr(a.pack,40).replace(/[^A-Za-z0-9_-]/g,"");   // key of the built-in service pack this API came from (drives its setup guide)
  if(_pk)api.pack=_pk;
  // HOW this application talks. "http" is everything the tab has ever done and stays the default,
  // so an older config normalises to it without a migration. "ws" means OBS Studio over
  // obs-websocket: no URL, no method, no headers — a request name and a JSON object. Written only
  // when it is NOT the default, so a plain REST application keeps the exact shape it always had.
  if(a.transport==="ws")api.transport="ws";
  const aSeen=new Set();
  for(const x of (Array.isArray(a.actions)?a.actions:[]).slice(0,120)){
    if(!x||typeof x!=="object")continue;
    const act={id:_raId(x.id,"c",aSeen),name:_raStr(x.name,80)||"Akcja",desc:_raStr(x.desc,200),
      method:_raMethod(x.method),path:_raStr(x.path,1000),query:_raPairs(x.query),headers:_raPairs(x.headers),
      bodyType:_raBodyType(x.bodyType),body:_raStr(x.body,20000),credId:_raStr(x.credId,40)};
    // Only a `ws` action has one; on an http action the field simply never appears.
    const _rt=_raStr(x.requestType,64);
    if(_rt)act.requestType=_rt;
    api.actions.push(act);}
  const tSeen=new Set();
  for(const t of (Array.isArray(a.triggers)?a.triggers:[]).slice(0,120)){
    if(!t||typeof t!=="object")continue;
    const _src=_raSanSrc(t.src);
    // `label` — własna nazwa wyzwalacza. Bez niej listę kilkunastu wyzwalaczy czyta się po
    // automatycznym opisie warunku („Pochylenie > 30°"), czyli po tym, KIEDY działa, a nigdy po tym,
    // PO CO istnieje. Reguła w Mapowaniu ma to pole od zawsze. 60 znaków — tyle, co tam.
    api.triggers.push({id:_raId(t.id,"g",tSeen),actionId:_raStr(t.actionId,40),on:t.on!==false,
      label:_raStr(t.label,60),
      minIntervalMs:_raInt(t.minIntervalMs,0,3600000,250),src:_src,toast:_raSanToast(t.toast,_src)});}
  return api;}
// Migration v1→v2: flat targets/messages/bindings become apis[], each owning its actions[]/triggers[].
function _raMigrateV1(o){
  const out={v:2,enabled:o.enabled===true,apis:[],vars:o.vars,settings:o.settings},byId={},home={};
  const own={id:"aOwn",name:"Własne adresy",baseUrl:"",headers:[],credId:"",timeoutMs:10000,actions:[],triggers:[]};
  for(const t of (Array.isArray(o.targets)?o.targets:[])){
    if(!t||typeof t!=="object")continue;
    const api={id:t.id,name:t.name,baseUrl:t.baseUrl,headers:t.headers,credId:t.credId,timeoutMs:t.timeoutMs,actions:[],triggers:[]};
    out.apis.push(api);if(typeof t.id==="string")byId[t.id]=api;}
  for(const m of (Array.isArray(o.messages)?o.messages:[])){
    if(!m||typeof m!=="object")continue;
    const host=m.urlOverride?own:(byId[m.targetId]||own);       // a v1 urlOverride has no base URL to belong to → park it in the catch-all API
    host.actions.push({id:m.id,name:m.name,desc:"",method:m.method,path:(m.urlOverride||m.path),
      query:m.query,headers:m.headers,bodyType:m.bodyType,body:m.body,credId:m.credId});
    if(typeof m.id==="string")home[m.id]=host;}
  if(own.actions.length)out.apis.push(own);
  for(const b of (Array.isArray(o.bindings)?o.bindings:[])){
    if(!b||typeof b!=="object")continue;
    const host=home[b.msgId];if(!host)continue;
    host.triggers.push({id:b.id,actionId:b.msgId,on:b.on!==false,minIntervalMs:b.minIntervalMs,
      src:{kind:"rule",dev:b.dev,ruleId:b.ruleId}});}
  return out;}
function _raSanCfg(raw){              // unknown / corrupt shape → default config; must NEVER throw
  const def=_raDefCfg();
  let src=raw;
  try{
    if(!src||typeof src!=="object"||Array.isArray(src))return def;
    if(src.v===1)src=_raMigrateV1(src);
    _raSeedSeq(src,0);
    const out=_raDefCfg();
    out.enabled=src.enabled===true;
    const seen=new Set();
    for(const a of (Array.isArray(src.apis)?src.apis:[]).slice(0,60)){const api=_raSanApi(a,seen);if(api)out.apis.push(api);}
    if(src.vars&&typeof src.vars==="object"&&!Array.isArray(src.vars)){
      let n=0;
      for(const k of Object.keys(src.vars)){if(n++>=100)break;const kk=_raStr(k,60);if(!kk)continue;out.vars[kk]=_raStr(src.vars[k],2000);}}
    const st=(src.settings&&typeof src.settings==="object")?src.settings:{};
    out.settings.keepUnlockedForSend=(st.keepUnlockedForSend!==false);
    out.settings.logBody=(st.logBody===true);   // opt-in: also persist response bodies to the log file
    // WHERE OBS is, not whether it is connected: the socket itself is never restored on start-up.
    // Only the password stays out of here — like every secret, it lives in the vault, and this
    // keeps its id, not its value.
    const ob=(st.obs&&typeof st.obs==="object"&&!Array.isArray(st.obs))?st.obs:{};
    out.settings.obs={host:_raStr(ob.host,80)||"127.0.0.1",
                      port:_raInt(ob.port,1,65535,4455),
                      credId:_raStr(ob.credId,40)};
    // NAZWA NOSZONEJ KONFIGURACJI (presety Usług sieciowych, 2026-08-31). Musi przejść przez
    // sanitizer, bo ten buduje wynik od zera z `_raDefCfg()` i wszystko, czego nie przepisze,
    // znika przy pierwszym zapisie z panelu — moduł zgubiłby nazwę presetu w chwili, w której
    // ktoś dotknie dowolnego pola. Ta sama zasada, co `configName` w konfiguracji myszy i MIDI:
    // nazwa jest polem configu, bo to ona odpowiada na pytanie „co jest teraz włączone".
    out.configName=_raStr(src.configName,80);
    return out;
  }catch(e){return def;}}

// ---------- CREDENTIAL VAULT (WebCrypto) ----------
// The only place in the whole app that holds secret plaintext. Only functions escape this closure.
const _RaVault=(function(){
  let _sec=null;              // {creds:[{id,name,kind,fields}]} — plaintext, and ONLY inside this closure
  let _key=null;              // CryptoKey AES-GCM 256, so re-saving does not re-prompt for the password
  let _salt=null;             // Uint8Array(16) — salt of the current vault
  let _iter=RA_ITER_NEW;
  let _blob=null;             // last blob seen from the server (null = no vault)
  let _loaded=false;          // did /rest/vault answer UNAMBIGUOUSLY (false = we do NOT know whether a vault exists)
  let _probing=true;          // read in flight — the first paint happens before the answer, so do not alarm the user
  let _uiOpen=false;          // is the UI showing contents (soft-lock clears ONLY this)
  let _bg=false;              // secrets kept in RAM solely for background sending
  let _idleTid=0,_pTid=0,_pPending=false;
  function _sub(){try{return (window.crypto&&window.crypto.subtle)||null;}catch(e){return null;}}
  function _b64e(buf){const b=new Uint8Array(buf);let s="";for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s);}
  function _b64d(str){const s=atob(String(str||""));const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b;}
  async function _derive(pass,salt,iter){
    const sub=_sub();if(!sub)throw new Error("nocrypto");
    const base=await sub.importKey("raw",new TextEncoder().encode(String(pass==null?"":pass)),{name:"PBKDF2"},false,["deriveKey"]);
    return sub.deriveKey({name:"PBKDF2",salt:salt,iterations:iter,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);}
  function _normSec(o){
    const out={creds:[]},seen=new Set();
    for(const c of ((o&&Array.isArray(o.creds))?o.creds:[]).slice(0,100)){
      if(!c||typeof c!=="object")continue;
      const kind=RA_FIELDS[c.kind]?c.kind:"bearer",f={};
      for(const p of RA_FIELDS[kind])f[p[0]]=_raStr(c.fields&&c.fields[p[0]],4000);
      out.creds.push({id:_raId(c.id,"s",seen),name:_raStr(c.name,80)||"Poświadczenie",kind:kind,fields:f});}
    return out;}
  // DRUGIE OKNO PANELU. Kopia sejfu w tej karcie pochodzi z chwili startu albo odblokowania, a serwer
  // zapisuje plik bezwarunkowo. Okno, które nie widziało zmian z drugiego okna, nadpisywało nowszy
  // sejf starszą treścią albo pustym sejfem. Przed każdym zapisem czytamy więc plik z serwera: zapis
  // idzie tylko wtedy, gdy na dysku leży dokładnie ta wersja, od której ta karta zaczęła (albo, przy
  // zakładaniu, nie ma żadnej). Rozbieżność = odmowa i blokada sejfu w tej karcie; odblokowanie
  // czyta już aktualny plik.
  function _vaultOf(j){const v=j&&j.vault;return (v&&typeof v==="object"&&v.data&&v.salt&&v.iv)?v:null;}
  function _sameBlob(a,b){if(!a||!b)return !a&&!b;return a.iv===b.iv&&a.data===b.data&&a.salt===b.salt;}
  async function _serverBlob(){
    const r=await fetch("/rest/vault",{cache:"no-store"});const j=await r.json();
    if(!j||j.ok!==true)throw new Error("unknown");
    return _vaultOf(j);}
  async function _persist(){          // key/salt read SYNCHRONOUSLY, so a lock racing this write cannot corrupt it
    const sub=_sub(),key=_key,sec=_sec,salt=_salt,iter=_iter;
    if(!sub||!key||!sec||!salt)throw new Error("nokey");
    const base=_blob,cur=await _serverBlob();
    if(!_sameBlob(cur,base)){
      _blob=cur;_loaded=true;_wipe();
      try{_raRenderVault();_raRenderHeader();}catch(e){}
      throw new Error("stale");}
    const iv=window.crypto.getRandomValues(new Uint8Array(12));            // a FRESH IV per write — AES-GCM must never reuse one under the same key
    const ct=await sub.encrypt({name:"AES-GCM",iv:iv},key,new TextEncoder().encode(JSON.stringify(sec)));
    const blob={v:1,iter:iter,salt:_b64e(salt),iv:_b64e(iv),data:_b64e(ct)};
    const r=await fetch("/rest/vault",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({vault:blob})});
    const j=await r.json();
    if(!j||j.ok!==true)throw new Error((j&&j.error)||"zapis");
    _blob=blob;return true;}
  function _persistSoon(){_pPending=true;clearTimeout(_pTid);
    _pTid=setTimeout(function(){_pPending=false;_persist().catch(function(e){
      try{rfToast((e&&e.message==="stale")?_raErrMsg(e):_gl("Nie udało się zapisać sejfu.","Could not save the vault."),
                  {tone:"danger",ms:12000});}catch(x){}});},400);}
  function flush(){if(!_pPending)return Promise.resolve();_pPending=false;clearTimeout(_pTid);return _persist().catch(function(){});}
  function _wipe(){_sec=null;_key=null;_salt=null;_uiOpen=false;_bg=false;clearTimeout(_idleTid);_idleTid=0;}
  // SEJF W TLE NIE GAŚNIE (przegląd modułów 2026-11-17). „Trzymaj odblokowane do wysyłki w tle”
  // ruszało ten sam 15-minutowy licznik bezczynności, a odświeżał go tylko klik albo klawisz na
  // ekranie Usługi. Streamer ustawiał wyzwalacz, wracał do gry i po kwadransie żądania z hasłem
  // przestawały wychodzić bez słowa. Z zaznaczoną opcją i zamkniętym widokiem sejfu licznik nie
  // biegnie: sekrety trzyma pamięć karty do jej zamknięcia, ręcznego „Zablokuj” albo wyłączenia
  // modułu (to robi `softLock(false)` / `lockNow`). Otwarty widok sejfu dalej blokuje się po 15 min.
  function _arm(){clearTimeout(_idleTid);_idleTid=0;
    if(_bg&&!_uiOpen)return;
    _idleTid=setTimeout(function(){flush().then(function(){_wipe();
      try{_raRenderVault();_raRenderHeader();}catch(e){}
      try{rfToast(_gl("Sejf zablokowany po 15 minutach bezczynności.","Vault locked after 15 minutes of inactivity."));}catch(e){}});},RA_IDLE_MS);}
  return {
    cryptoOk:function(){return !!_sub();},
    hasVault:function(){return !!_blob;},
    loaded:function(){return _loaded;},                        // is the vault's existence known at all
    ready:function(){return !!_sec&&(_uiOpen||_bg);},          // are secrets in RAM (i.e. can we send)
    bg:function(){return !!(_bg&&_sec);},
    count:function(){return _sec?_sec.creds.length:0;},
    // "unknown" = GET /rest/vault has not answered yet, OR answered with an error. It is a state of
    // its own so the UI can never show "vault not set up" (whose only button overwrites the file)
    // merely because the read failed. Everything else gates on `ready`, so this state affects only
    // the UI and the service-pack export.
    state:function(){
      if(!_sub())return "nocrypto";
      if(!_loaded)return _probing?"checking":"unknown";
      if(!_blob)return "none";
      return _uiOpen?"unlocked":"locked";},
    // `_loaded` is set ONLY after a successful, unambiguous server answer. A failed read (network,
    // server restart, HTTP 500, vault file present but unparseable) must leave "we do NOT know
    // whether a vault exists" rather than "there is no vault": otherwise the UI offers "Set vault
    // password" as the only action, and that OVERWRITES a healthy file with an empty vault —
    // irreversibly losing every stored credential.
    load:async function(){
      _probing=true;
      try{const r=await fetch("/rest/vault");const j=await r.json();
        // server unsure / file unreadable → the state is unknown again, also after an earlier
        // success: a stale "there is no vault" would offer the button that creates an empty one
        if(!j||j.ok!==true){_blob=null;_loaded=false;return false;}
        _blob=_vaultOf(j);
        _loaded=true;
      }catch(e){_blob=null;_loaded=false;}
      finally{_probing=false;}
      return !!_blob;},
    create:async function(pass){
      if(!_sub())throw new Error("nocrypto");
      await this.load();                        // another window may have created one since this tab started
      if(!_loaded)throw new Error("unknown");   // vault file may exist → refuse to overwrite it
      if(_blob)throw new Error("exists");       // a vault is already there — changing the password is change(), not create()
      const salt=window.crypto.getRandomValues(new Uint8Array(16));
      const key=await _derive(pass,salt,RA_ITER_NEW);
      _salt=salt;_iter=RA_ITER_NEW;_key=key;_sec={creds:[]};
      await _persist();_uiOpen=true;_bg=false;_arm();return true;},
    unlock:async function(pass){
      if(!_sub())throw new Error("nocrypto");
      await this.load();                        // always the CURRENT file, not the copy from tab start
      if(!_loaded)throw new Error("unknown");
      if(!_blob)throw new Error("novault");
      const salt=_b64d(_blob.salt),iv=_b64d(_blob.iv),data=_b64d(_blob.data);
      const iter=(typeof _blob.iter==="number"&&_blob.iter>=1000)?_blob.iter:RA_ITER_NEW;
      const key=await _derive(pass,salt,iter);
      let obj=null;
      try{obj=JSON.parse(new TextDecoder().decode(await _sub().decrypt({name:"AES-GCM",iv:iv},key,data)));}
      catch(e){throw new Error("badpass");}                    // GCM auth failure / garbage plaintext = wrong password
      _sec=_normSec(obj);_key=key;_salt=salt;_iter=iter;_uiOpen=true;_bg=false;_arm();return true;},
    change:async function(oldPass,newPass){
      // Atomic: the new password's key reaches RAM only after the vault file has been written.
      // If anything fails we restore EXACTLY the previous state (old key + same lock status);
      // otherwise the next debounced write would re-encrypt the file under a password nobody knows.
      await flush();                                           // finish any debounced write with the OLD key first
      const pSec=_sec,pKey=_key,pSalt=_salt,pIter=_iter,pOpen=_uiOpen,pBg=_bg;
      const _rollback=function(){
        if(pSec&&(pOpen||pBg)){_sec=pSec;_key=pKey;_salt=pSalt;_iter=pIter;_uiOpen=pOpen;_bg=pBg;_arm();}
        else _wipe();};                                        // it was locked before → it stays locked
      try{
        await this.unlock(oldPass);                            // throws "badpass" if the old password is wrong
        const salt=window.crypto.getRandomValues(new Uint8Array(16));   // NEW salt on every password change
        const key=await _derive(newPass,salt,RA_ITER_NEW);
        _salt=salt;_iter=RA_ITER_NEW;_key=key;
        await _persist();
      }catch(e){if(!(e&&e.message==="stale"))_rollback();throw e;}   // stale: this tab's copy is old, stay locked
      _arm();return true;},
    destroy:async function(){
      clearTimeout(_pTid);_pPending=false;
      const r=await fetch("/rest/vault",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clear:true})});
      const j=await r.json();
      if(!j||j.ok!==true)throw new Error((j&&j.error)||"usuwanie");
      _wipe();_blob=null;return true;},
    softLock:function(keep){if(!_sec)return;_uiOpen=false;if(keep){_bg=true;_arm();}else{flush();_wipe();}},
    lockNow:function(){flush();_wipe();},
    // Wysyłka w tle istnieje tylko przy włączonym module. Moduł gaszony poza tym ekranem (Stop
    // awaryjny, rf-45, przełącznik) zostawiał sekrety w pamięci; dopóki biegł 15-minutowy licznik,
    // sprzątał je on. Teraz sprząta to wywołanie z `_raRenderHeader`, które idzie po każdej zmianie.
    dropBg:function(){if(_bg&&!_uiOpen&&_sec){flush();_wipe();}},
    touch:function(){if(_sec)_arm();},
    flush:flush,
    list:function(){return _sec?_sec.creds.map(function(c){return {id:c.id,name:c.name,kind:c.kind};}):[];},
    get:function(id){
      if(!_sec||!(_uiOpen||_bg))return null;
      const c=_sec.creds.find(function(x){return x.id===id;});
      return c?{id:c.id,name:c.name,kind:c.kind,fields:Object.assign({},c.fields)}:null;},
    forRender:function(){return (_uiOpen&&_sec)?_sec.creds:[];},   // hands out live plaintext — for the unlocked UI ONLY
    add:function(){
      if(!_sec)return null;
      const id=_raId(null,"s",new Set(_sec.creds.map(function(c){return c.id;})));
      _sec.creds.push({id:id,name:_gl("Nowe poświadczenie","New credential"),kind:"bearer",fields:{token:""}});
      _persistSoon();return id;},
    update:function(id,patch){
      if(!_sec||!patch)return false;
      const c=_sec.creds.find(function(x){return x.id===id;});
      if(!c)return false;
      if(typeof patch.name==="string")c.name=patch.name.slice(0,80);
      if(typeof patch.kind==="string"&&RA_FIELDS[patch.kind]&&patch.kind!==c.kind){
        c.kind=patch.kind;const f={};for(const p of RA_FIELDS[c.kind])f[p[0]]="";c.fields=f;}
      if(patch.fields&&typeof patch.fields==="object")
        for(const p of RA_FIELDS[c.kind])if(typeof patch.fields[p[0]]==="string")c.fields[p[0]]=patch.fields[p[0]].slice(0,4000);
      _persistSoon();return true;},
    remove:function(id){
      if(!_sec)return false;
      const i=_sec.creds.findIndex(function(x){return x.id===id;});
      if(i<0)return false;
      _sec.creds.splice(i,1);_persistSoon();return true;},
    // Values to redact from previews, the log and the service-pack export.
    // EVERY secret is listed twice: raw, and JSON-escaped. Without the second form a token like
    // ab"cd — which is stored as ab\"cd inside a JSON body, and comes back that way from
    // JSON.stringify — slips past the mask. That was a real leak in the pack export.
    // Sorted longest-first so a secret that contains another is masked before its substring.
    maskValues:function(){
      const out=[];
      const add=function(v){
        if(typeof v!=="string"||v.length<3)return;
        if(out.indexOf(v)<0)out.push(v);
        let j="";
        try{j=JSON.stringify(v);j=j.slice(1,j.length-1);}catch(e){j="";}
        if(j&&j!==v&&j.length>=3&&out.indexOf(j)<0)out.push(j);
      };
      if(!_sec)return [];
      for(const c of _sec.creds){
        for(const k of Object.keys(c.fields||{}))add(c.fields[k]);
        if(c.kind==="basic"){try{add(btoa((c.fields.user||"")+":"+(c.fields.pass||"")));}catch(e){}}}
      return out.sort(function(a,b){return b.length-a.length;});}
  };
})();

// ---------- module API (global, consumed by the other REST files) ----------
// `renderApis` is deliberately absent from this literal: restRenderApis is declared in a LATER
// script file, and function hoisting does not cross <script> boundaries, so naming it here would
// throw a ReferenceError at load time. rf-40-boot.js attaches it once every file has loaded.
window.RESTAPI={cfg:_raDefCfg(),root:null,save:restSave,vaultState:restVaultState,
  getCred:restGetCred,credList:restCredList,mask:restMask};
let _raSaveTid=0,_raSavePending=false;
function _raPostCfg(keepalive){_raSavePending=false;
  // The server refuses a config larger than 500 000 B with {ok:false}. Swallowing that answer used
  // to be a silent failure: no save ever landed and the old config came back after a restart, which
  // looks to the user like "my settings keep resetting". The rejection must stay visible.
  try{fetch("/rest/config",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({config:RESTAPI.cfg}),keepalive:!!keepalive})
    .then(function(r){return r&&r.json();})
    .then(function(j){
      if(j&&j.ok===false&&typeof _ra3Say==="function")
        _ra3Say(_gl("Serwer ODRZUCIŁ zapis ustawień REST: ","The server REJECTED saving the REST config: ")+(j.error||"?")+
                _gl(" — zmiany przepadną po odświeżeniu strony."," — changes will be lost on page reload."));
    })
    .catch(function(){});}catch(e){}}
function restSave(){_raSavePending=true;clearTimeout(_raSaveTid);_raSaveTid=setTimeout(function(){_raPostCfg(false);},400);
  // „Zmienione" liczy się z ODCISKU configu, a nie z zapisu — więc lista presetów i blok stanu
  // muszą się dowiedzieć NATYCHMIAST, a nie po 400 ms razem z wysyłką. Wołane bez opóźnienia
  // celowo: człowiek przestawia pole i od razu ma widzieć, że jest co zapisać (rf-49n).
  try{if(typeof restCfgSync==="function")restCfgSync();}catch(e){}}
function restFlushSave(){if(_raSavePending){clearTimeout(_raSaveTid);_raPostCfg(true);}}
function restVaultState(){return {state:_RaVault.state(),bg:_RaVault.bg(),ready:_RaVault.ready(),
  count:_RaVault.count(),cryptoOk:_RaVault.cryptoOk(),
  hasVault:_RaVault.hasVault(),vaultLoaded:_RaVault.loaded()};}   // hasVault/vaultLoaded gate the service-pack export
function restGetCred(id){try{return _RaVault.get(id);}catch(e){return null;}}
function restCredList(){try{return _RaVault.list();}catch(e){return [];}}
function restMask(s){                 // replace every secret value occurring in the string with the mask
  let out=String(s==null?"":s),vals;
  try{vals=_RaVault.maskValues();}catch(e){vals=[];}
  for(const v of vals)if(v&&v.length>=3&&out.indexOf(v)>=0)out=out.split(v).join(RA_MASK);
  return out;}
window.addEventListener("pagehide",function(){restFlushSave();try{_RaVault.flush();}catch(e){}});
document.addEventListener("visibilitychange",function(){
  if(document.visibilityState==="hidden"){restFlushSave();try{_RaVault.flush();}catch(e){}}});

// ---------- UI ----------
// Button label = optional PNG icon (a .bic-* class) + plain text. This replaced the textual "+ …"
// and the emoji (🔓 🔁 🗑 🔌 📦 …) on the buttons of this module (UX consistency audit, 2026-09-04):
// every other screen draws its "add" as the .bic-plus PNG and its verbs without a pictogram, and a
// prefix glued into the label made every such button its own I18N key.
function _raBtnLabel(btn,label,icon){
  btn.textContent="";
  if(icon){const ic=document.createElement("span");ic.className="bic "+icon;ic.setAttribute("aria-hidden","true");btn.appendChild(ic);}
  btn.appendChild(document.createTextNode(label));
  return btn;}
function _raEmpty(title,sub,ctaLab,ctaFn,ctaIcon){
  const d=document.createElement("div");d.className="ra-empty";
  const b=document.createElement("b");b.textContent=title;d.appendChild(b);
  if(sub){const s=document.createElement("span");s.textContent=sub;d.appendChild(s);}
  if(ctaLab){const w=document.createElement("div");w.className="ra-empty-cta";
    const btn=document.createElement("button");btn.type="button";btn.className="btn sm primary";_raBtnLabel(btn,ctaLab,ctaIcon);
    btn.addEventListener("click",ctaFn);w.appendChild(btn);d.appendChild(w);}
  return d;}
function _raBuildUI(){
  const w=document.createElement("div");w.className="ra-wrap";
  // ORDER OF THE CARDS (P-G3-13): what a person comes for first. Applications, then OBS, the
  // variables, the vault and the log. The vault used to open the screen with a lecture on
  // encryption most people never need, and the applications started under the fold. OBS slots in
  // right after the applications (rf-38b), the variables right before the vault (rf-39) and the
  // log goes last (rf-36), so this shell only fixes the two ends.
  // No intro card: the module bar carries the name, the switch and the pill "Shared by all
  // capsules" (REST_CFG_ADAPTER.sharedChip), and the intro sentence lives in the empty state of
  // the applications. The switch is parked in a bare holder: rf-49m moves it into the module bar
  // and drops the holder once it is empty.
  w.innerHTML=
    '<div class="ra-enable-slot">'+
      '<div class="rf-toggle" id="raEnable" role="switch" aria-checked="false" tabindex="0"><span class="rf-tg-lbl off">Wył.</span><span class="rf-tg-knob"></span><span class="rf-tg-lbl on">Wł.</span></div></div>'+
    '<div class="card" id="raApisCard">'+
      '<div class="head"><h2><span class="ra-ic" aria-hidden="true">⚡</span>Aplikacje i usługi</h2>'+
        '<span class="hint">biblioteka akcji i wyzwalaczy, osobno dla każdej aplikacji</span></div>'+
      '<div class="ra-body" id="raApisBody"></div>'+
      // PIĘTRO 2 (UX 261120 L4c): OBS (rf-38b) i Zmienne (rf-39) jako zwijaki w tej karcie,
      // ustawiane raz. Same budują swoje zwijaki i wkładają je tutaj.
      '<div class="ra-tier2" id="raTier2"></div></div>'+
    // PIĘTRO 3: Sejf i Dziennik wysyłek (rf-36) pod jednym „Zaawansowane” na dole ekranu.
    '<details class="cardfold adv" id="raAdv"><summary>Zaawansowane</summary><div class="cardfold-body" id="raAdvBody">'+
    // ONE SET OF VAULT CONTROLS, and it stands on the card that holds the credentials themselves.
    '<div class="card" id="raVaultCard">'+
      '<div class="head"><h2><span class="ra-ic" aria-hidden="true">🔐</span>Sejf poświadczeń</h2>'+
        '<span class="hint">tokeny, hasła i klucze API, szyfrowane na tym komputerze</span></div>'+
      '<div class="ra-bar">'+
        '<span class="ra-pill" id="raPill"></span>'+
        '<span class="ra-acts" id="raVaultBtns"></span>'+
      '</div>'+
      '<div class="ra-body" id="raVaultBody"></div></div>'+
    '</div></details>';
  restRoot.appendChild(w);
  try{if(typeof rfTier==="function")rfTier(w.querySelector("#raAdv"),"uslugi.zaawansowane");}catch(e){}
  const en=w.querySelector("#raEnable");
  if(en){
    // Po polsku, bez _gl: `title` tłumaczy spacer i18n (para w rf-01), a on jeden umie też wrócić
    // na polski po przełączeniu języka — napis złożony przez _gl zostałby po angielsku na zawsze.
    en.title="Włącznik całego modułu. Na Off nic stąd nie wychodzi: ani wyzwalacze, ani ręczne ▶ Wyślij. Wspólny dla wszystkich kapsli.";
    en.addEventListener("click",function(){
      RESTAPI.cfg.enabled=!RESTAPI.cfg.enabled;restSave();
      // Same reminder every other output module gives when it is switched on (rf-39j). This one
      // reaches real services over the network, so the way out is worth knowing here most of all.
      if(RESTAPI.cfg.enabled&&typeof rfHotkeyReminder==="function")rfHotkeyReminder("rest");
      _raRenderHeader();if(window.updateTabDots)updateTabDots();});}}
let _raAdvShown=false;
function _raRenderHeader(){
  try{if(RESTAPI.cfg&&!RESTAPI.cfg.enabled)_RaVault.dropBg();}catch(e){}
  if(!restRoot)return;
  // The OBS card's password picker lists vault entries, so it goes stale the moment the vault
  // locks or unlocks — and this runs on both. Soft call: a build without rf-38b keeps going.
  try{if(typeof _raObsFillCreds==="function")_raObsFillCreds();}catch(e){}
  const en=restRoot.querySelector("#raEnable");
  if(en){const on=!!(RESTAPI.cfg&&RESTAPI.cfg.enabled);
    en.classList.toggle("on",on);en.setAttribute("aria-checked",on?"true":"false");}
  const st=_RaVault.state(),pill=restRoot.querySelector("#raPill");
  if(pill){
    let txt,cls="";
    // Three states, three different padlocks — and the OPEN padlock is never used for "not set up".
    // 🔓 means "the secrets are readable right now"; a vault that does not exist yet is ⚪.
    if(st==="nocrypto"){txt=_gl("⛔ Sejf niedostępny","⛔ Vault unavailable");cls="bad";}
    else if(st==="checking"){txt=_gl("⏳ Sprawdzam sejf…","⏳ Checking the vault…");}
    else if(st==="unknown"){txt=_gl("❓ Nie wiem, czy sejf istnieje","❓ Vault status unknown");cls="warn";}
    else if(st==="none"){txt=_gl("⚪ nieustawiony","⚪ not set up");}
    else if(st==="unlocked"){txt=_gl("🔓 odblokowany","🔓 unlocked");cls="ok";}
    else if(_RaVault.bg()){txt=_gl("🔒 zablokowany (wysyłka w tle aktywna)","🔒 locked (background sending active)");cls="warn";}
    else txt=_gl("🔒 zablokowany","🔒 locked");
    pill.textContent=txt;pill.className="ra-pill"+(cls?(" "+cls):"");
    // Błąd sejfu nie może siedzieć w zwiniętym „Zaawansowane”: przy pierwszym takim stanie
    // w sesji zwijak otwiera się sam (potem decyduje człowiek).
    if(st==="nocrypto"||st==="unknown"){const adv=restRoot.querySelector("#raAdv");
      if(adv&&!adv.open&&!_raAdvShown){_raAdvShown=true;adv.open=true;}}}
  const box=restRoot.querySelector("#raVaultBtns");
  if(!box)return;
  box.innerHTML="";
  if(st==="nocrypto"||st==="checking")return;
  const _mkb=function(lab,fn,cls,icon){const b=document.createElement("button");b.type="button";
    b.className="btn sm"+(cls?(" "+cls):"");_raBtnLabel(b,lab,icon);b.addEventListener("click",fn);box.appendChild(b);return b;};
  // Unknown state: the ONLY button is a re-read. Never "Set password" here — that is the action
  // that would overwrite an existing, healthy vault file with an empty one.
  // Bez różu: sejf stoi w „Zaawansowane”, a róż na ekranie ma tylko „Wybierz szablon”.
  if(st==="unknown"){_mkb(_gl("Sprawdź sejf ponownie","Re-check the vault"),_raRetryLoad);return;}
  if(st==="none"){_mkb(_gl("Ustaw hasło sejfu","Set vault password"),_raSetPass);return;}
  if(st==="locked")_mkb(_gl("Odblokuj sejf","Unlock vault"),_raUnlock);
  else _mkb(_gl("Zablokuj teraz","Lock now"),_raLockNow);
  _mkb(_gl("Zmień hasło","Change password"),_raChangePass);
  _mkb(_gl("Usuń sejf","Delete vault"),_raDeleteVault,"","bic-bin");}
function _raSettingsRow(){
  const lab=document.createElement("label");lab.className="ra-opt";
  const cb=document.createElement("input");cb.type="checkbox";
  cb.checked=!!(RESTAPI.cfg.settings&&RESTAPI.cfg.settings.keepUnlockedForSend);
  cb.addEventListener("change",function(){
    RESTAPI.cfg.settings=RESTAPI.cfg.settings||{};
    RESTAPI.cfg.settings.keepUnlockedForSend=cb.checked;restSave();_raRenderHeader();});
  lab.appendChild(cb);
  lab.appendChild(document.createTextNode(_gl("Trzymaj odblokowane do wysyłki w tle","Keep unlocked for background sending")));
  return lab;}
function _raIdleNote(){
  const d=document.createElement("div");d.className="ra-note";
  d.textContent=_gl("Sejf blokuje się sam po 15 minutach bezczynności oraz przy wyjściu z tego ekranu. Przy zaznaczonej opcji powyżej sekrety zostają w pamięci do wysyłki w tle, dopóki ta karta przeglądarki jest otwarta i włącznik modułu stoi na On. Wyzwalacze liczy panel, więc po zamknięciu karty nic nie wyjdzie.",
    "The vault locks itself after 15 minutes of inactivity and when you leave this screen. With the option above checked the secrets stay in memory for background sending while this browser tab stays open and the module switch is On. The panel runs the triggers, so nothing is sent once the tab is closed.");
  return d;}
function _raCredRow(c){
  const row=document.createElement("div");row.className="ra-cred";row.dataset.id=c.id;
  const h=document.createElement("div");h.className="ra-cred-h";
  const nm=document.createElement("input");nm.type="text";nm.maxLength=80;nm.value=c.name||"";
  nm.className="ra-cname-inp";nm.setAttribute("aria-label",_gl("Nazwa poświadczenia","Credential name"));
  nm.addEventListener("change",function(){_RaVault.update(c.id,{name:nm.value});_RaVault.touch();});
  const kd=document.createElement("select");kd.setAttribute("aria-label",_gl("Typ poświadczenia","Credential type"));
  for(const k of RA_KINDS){const o=document.createElement("option");o.value=k[0];o.textContent=_gl(k[1],k[2]);
    if(k[0]===c.kind)o.selected=true;kd.appendChild(o);}
  kd.addEventListener("change",function(){_RaVault.update(c.id,{kind:kd.value});_RaVault.touch();_raRenderVault();});
  const idl=document.createElement("code");idl.className="ra-kind";idl.textContent=c.id;
  const del=document.createElement("button");del.type="button";del.className="icon-btn";del.textContent="✕";
  del.title=_gl("Usuń poświadczenie","Remove credential");
  del.setAttribute("aria-label",_gl("Usuń poświadczenie","Remove credential"));
  del.addEventListener("click",async function(){
    const ok=await rfConfirm(_gl("Poświadczenie „","Credential “")+(c.name||c.id)+_gl("” zniknie z sejfu bezpowrotnie.","” will be gone from the vault for good."),
      {title:_gl("Usunąć poświadczenie?","Remove credential?"),icon:'<span class="rfm-bin"></span>',tone:"danger",
       confirmLabel:_gl("Usuń","Remove"),cancelLabel:_gl("Anuluj","Cancel")});
    if(!ok)return;
    _RaVault.remove(c.id);_RaVault.touch();_raRenderVault();});
  h.appendChild(nm);h.appendChild(kd);h.appendChild(idl);h.appendChild(del);row.appendChild(h);
  const fw=document.createElement("div");fw.className="ra-fields";
  for(const p of (RA_FIELDS[c.kind]||[])){
    const isSecret=(RA_SECRET_FIELDS[c.kind]||[]).indexOf(p[0])>=0;
    const fld=document.createElement("label");fld.className="ra-fld";
    const lab=document.createElement("span");lab.textContent=_gl(p[1],p[2]);fld.appendChild(lab);
    const sw=document.createElement("span");sw.className="ra-secret";
    const inp=document.createElement("input");inp.type=isSecret?"password":"text";inp.maxLength=4000;
    inp.value=(c.fields&&c.fields[p[0]])||"";inp.autocomplete="off";inp.spellcheck=false;
    inp.addEventListener("change",function(){const patch={fields:{}};patch.fields[p[0]]=inp.value;
      _RaVault.update(c.id,patch);_RaVault.touch();});
    sw.appendChild(inp);
    if(isSecret){
      const eye=document.createElement("button");eye.type="button";eye.className="icon-btn";eye.textContent="👁";
      eye.title=_gl("Pokaż / ukryj wartość","Show / hide the value");
      eye.setAttribute("aria-label",_gl("Pokaż / ukryj wartość","Show / hide the value"));
      eye.addEventListener("click",function(){inp.type=(inp.type==="password")?"text":"password";_RaVault.touch();});
      sw.appendChild(eye);}
    fld.appendChild(sw);fw.appendChild(fld);}
  row.appendChild(fw);
  return row;}
function _raRenderVault(){
  if(!restRoot)return;
  const box=restRoot.querySelector("#raVaultBody");
  if(!box)return;
  box.innerHTML="";
  const st=_RaVault.state();
  if(st==="nocrypto"){
    box.appendChild(_raEmpty(_gl("Szyfrowanie niedostępne w tej przeglądarce.","Encryption is unavailable in this browser."),
      _gl("Sejf używa crypto.subtle, które działa tylko w bezpiecznym kontekście — otwórz panel przez http://127.0.0.1:… (localhost) albo HTTPS.",
          "The vault uses crypto.subtle, which only works in a secure context — open the panel via http://127.0.0.1:… (localhost) or HTTPS.")));
    return;}
  if(st==="checking"){
    box.appendChild(_raEmpty(_gl("Sprawdzam sejf…","Checking the vault…"),
      _gl("Za chwilę pokażę, czy na dysku jest już plik sejfu.","In a moment I will show whether a vault file exists on disk.")));
    return;}
  // ⚠️ THE THREE STATES BELOW CARRY NO BUTTON OF THEIR OWN. „Sprawdź ponownie", „Ustaw hasło sejfu"
  // and „Odblokuj sejf" all stand in the bar right above this body (#raVaultBtns, painted by
  // _raRenderHeader) — repeating them here is what gave this card two of every control.
  if(st==="unknown"){
    box.appendChild(_raEmpty(_gl("Nie udało się sprawdzić, czy sejf istnieje.","I could not check whether the vault exists."),
      _gl("Serwer nie odpowiedział na pytanie o plik sejfu (albo plik jest nieczytelny). NIE proponuję tu „Ustaw hasło”, bo gdyby sejf jednak istniał, założenie nowego skasowałoby wszystkie poświadczenia. Sprawdź, czy RibbitFlip działa, i spróbuj ponownie przyciskiem u góry karty.",
          "The server did not answer about the vault file (or the file is unreadable). I am NOT offering “Set password” here: if the vault does exist, creating a new one would wipe every credential. Check that RibbitFlip is running and try again with the button at the top of this card.")));
    return;}
  if(st==="none"){
    box.appendChild(_raEmpty(_gl("Sejf nie jest jeszcze ustawiony.","The vault is not set up yet."),
      _gl("Tokeny i hasła są szyfrowane na tym komputerze. Hasła sejfu nie da się odzyskać.",
          "Tokens and passwords are encrypted on this computer. The vault password cannot be recovered.")));
    return;}
  if(st==="locked"){
    // NOT „🔒 zablokowany" again — that word is on the pill 40 px higher. This line says what the
    // lock MEANS for what is (not) on the screen below it.
    box.appendChild(_raEmpty(_RaVault.bg()?_gl("Poświadczenia są ukryte — wysyłka w tle nadal działa.","The credentials are hidden — background sending still works.")
                                          :_gl("Poświadczenia są ukryte.","The credentials are hidden."),
      _gl("Podaj hasło przyciskiem „Odblokuj sejf” u góry karty, żeby zobaczyć i edytować poświadczenia.",
          "Enter the password with the “Unlock vault” button at the top of this card to view and edit the credentials.")));
    box.appendChild(_raSettingsRow());box.appendChild(_raIdleNote());
    return;}
  const creds=_RaVault.forRender();
  if(!creds.length)box.appendChild(_raEmpty(_gl("Sejf jest pusty.","The vault is empty."),
    _gl("Dodaj token, login z hasłem albo własny nagłówek — przypiszesz je do aplikacji w kolejnym kroku.",
        "Add a token, a username with password or a custom header — you will attach them to applications in the next step.")));
  else for(const c of creds)box.appendChild(_raCredRow(c));
  const bar=document.createElement("div");bar.className="ra-acts";
  const add=document.createElement("button");add.type="button";add.className="btn sm primary";
  _raBtnLabel(add,_gl("Dodaj poświadczenie","Add credential"),"bic-plus");
  add.addEventListener("click",function(){_RaVault.add();_RaVault.touch();_raRenderVault();});
  bar.appendChild(add);box.appendChild(bar);
  box.appendChild(_raSettingsRow());box.appendChild(_raIdleNote());}

// ---------- password modal (#raPass): unlock / create / change ----------
function _raPassCheck(mode,v){
  if(mode==="unlock")return v[0]?"":_gl("Podaj hasło.","Enter the password.");
  if(mode==="change"){
    if(!v[0])return _gl("Podaj stare hasło.","Enter the old password.");
    if(!v[1]||v[1].length<8)return _gl("Nowe hasło musi mieć co najmniej 8 znaków.","The new password must be at least 8 characters.");
    if(v[1]!==v[2])return _gl("Hasła nie są takie same.","The passwords do not match.");
    return "";}
  if(!v[0]||v[0].length<8)return _gl("Hasło musi mieć co najmniej 8 znaków.","The password must be at least 8 characters.");
  if(v[0]!==v[1])return _gl("Hasła nie są takie same.","The passwords do not match.");
  return "";}
function _raErrMsg(e){
  const m=(e&&e.message)?String(e.message):"";
  if(m==="badpass")return _gl("Nieprawidłowe hasło.","Wrong password.");
  if(m==="nocrypto")return _gl("Szyfrowanie niedostępne — otwórz panel przez 127.0.0.1 albo HTTPS.","Encryption unavailable — open the panel via 127.0.0.1 or HTTPS.");
  if(m==="novault")return _gl("Sejf nie istnieje.","The vault does not exist.");
  if(m==="nokey")return _gl("Sejf jest zablokowany.","The vault is locked.");
  if(m==="unknown")return _gl("Nie wiem, czy sejf już istnieje — nie założę nowego, żeby nie skasować starego. Sprawdź połączenie z RibbitFlip i spróbuj ponownie.",
                              "I do not know whether a vault already exists — I will not create a new one and risk wiping the old. Check the connection to RibbitFlip and try again.");
  if(m==="stale")return _gl("Sejf zmienił się w innym oknie panelu. Nic nie zapisałem, żeby nie nadpisać nowszych poświadczeń. Odblokuj sejf ponownie i powtórz zmianę.",
                            "The vault changed in another panel window. I saved nothing, so newer credentials are not overwritten. Unlock the vault again and repeat the change.");
  if(m==="exists")return _gl("Sejf już istnieje — użyj „Odblokuj sejf” albo „Zmień hasło”.",
                             "The vault already exists — use “Unlock vault” or “Change password”.");
  return _gl("Nie udało się: ","Failed: ")+(m||_gl("nieznany błąd","unknown error"));}
function _raPassModal(mode,run){      // run(vals) → Promise; a rejection shows its message and leaves the modal open
  return new Promise(function(resolve){
    let ov=document.getElementById("raPass");
    if(!ov){ov=document.createElement("div");ov.id="raPass";document.body.appendChild(ov);}
    const TT={unlock:[_gl("Odblokuj sejf","Unlock the vault"),_gl("Odblokuj","Unlock")],
              create:[_gl("Ustaw hasło sejfu","Set the vault password"),_gl("Ustaw hasło","Set password")],
              change:[_gl("Zmień hasło sejfu","Change the vault password"),_gl("Zmień hasło","Change password")]}[mode]
             ||[_gl("Sejf poświadczeń","Credential vault"),"OK"];
    const rows=[];
    if(mode==="change")rows.push(["p0",_gl("Stare hasło","Old password")]);
    rows.push(["p1",mode==="unlock"?_gl("Hasło","Password"):_gl("Nowe hasło","New password")]);
    if(mode!=="unlock")rows.push(["p2",_gl("Powtórz hasło","Repeat the password")]);
    const hint=(mode==="unlock")
      ? _gl("Hasło nie opuszcza tej przeglądarki — serwer widzi wyłącznie zaszyfrowany plik.","The password never leaves this browser — the server only sees the encrypted file.")
      : _gl("Minimum 8 znaków. Hasła nie da się odzyskać — bez niego sejfu nie otworzy nikt, także Ty.","At least 8 characters. The password cannot be recovered — without it nobody opens the vault, you included.");
    ov.innerHTML='<div class="ra-pass-box" role="dialog" aria-modal="true" aria-labelledby="raPassT">'+
      '<h3 id="raPassT">'+esc(TT[0])+'</h3>'+
      rows.map(function(r){return '<label>'+esc(r[1])+'<input type="password" id="ra'+r[0]+'" autocomplete="off" spellcheck="false"></label>';}).join("")+
      '<div class="ra-note">'+esc(hint)+'</div>'+
      '<div class="ra-pass-err" id="raPassErr" role="alert" aria-live="assertive"></div>'+
      '<div class="ra-pass-act"><button class="btn" type="button" id="raPassCancel">'+esc(_gl("Anuluj","Cancel"))+'</button>'+
      '<button class="btn primary" type="button" id="raPassOk">'+esc(TT[1])+'</button></div></div>';
    ov.style.display="flex";if(window.rfmReopen)window.rfmReopen(ov);
    const bx=ov.querySelector(".ra-pass-box"),err=ov.querySelector("#raPassErr"),okB=ov.querySelector("#raPassOk");
    const inps=rows.map(function(r){return ov.querySelector("#ra"+r[0]);});
    let done=false;
    function close(v){
      if(done)return;done=true;
      document.removeEventListener("keydown",key,true);
      for(const i of inps)i.value="";                       // never leave the password sitting in the DOM
      if(window.rfmClose)window.rfmClose(ov,function(){ov.style.display="none";});else ov.style.display="none";
      resolve(v);}
    function clearF(){for(const i of inps)i.value="";if(inps[0])inps[0].focus();}
    async function ok(){
      const vals=inps.map(function(i){return i.value;});
      const bad=_raPassCheck(mode,vals);
      if(bad){err.textContent=bad;return;}
      okB.disabled=true;err.textContent=_gl("Pracuję…","Working…");
      try{await run(vals);close(true);}
      catch(ex){okB.disabled=false;err.textContent=_raErrMsg(ex);clearF();}}
    function key(e){
      if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close(false);return;}
      if(e.key==="Enter"&&ov.contains(e.target)){e.preventDefault();ok();return;}
      if(e.key==="Tab"){                                    // simple focus trap inside the dialog box
        const f=bx.querySelectorAll("input,button");
        if(!f.length)return;
        const first=f[0],last=f[f.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
    ov.onclick=function(e){if(e.target===ov)close(false);};   // click on the backdrop = cancel
    ov.querySelector("#raPassCancel").onclick=function(){close(false);};
    okB.onclick=ok;
    document.addEventListener("keydown",key,true);
    setTimeout(function(){if(inps[0])inps[0].focus();},30);});}
function _raSetPass(){_raPassModal("create",function(v){return _RaVault.create(v[0]);}).then(function(done){
  if(!done)return;_raRenderVault();_raRenderHeader();
  try{rfToast(_gl("Sejf utworzony i odblokowany.","Vault created and unlocked."),{tone:"ok"});}catch(e){}});}
function _raUnlock(){_raPassModal("unlock",function(v){return _RaVault.unlock(v[0]);}).then(function(done){
  if(done){_raRenderVault();_raRenderHeader();}});}
function _raChangePass(){_raPassModal("change",function(v){return _RaVault.change(v[0],v[1]);}).then(function(done){
  _raRenderVault();_raRenderHeader();                 // refresh even on cancel — change() may have unlocked the vault before failing
  if(!done)return;
  try{rfToast(_gl("Hasło sejfu zmienione.","Vault password changed."),{tone:"ok"});}catch(e){}});}
function _raLockNow(){_RaVault.lockNow();_raRenderVault();_raRenderHeader();}
// Retry reading the vault file (the "unknown" state). Short of a page reload this is the only way
// out of it: _RaVault.load() is otherwise called exactly once, from initRest, with no retry.
function _raRetryLoad(){
  _RaVault.load().then(function(){
    _raRenderVault();_raRenderHeader();
    const st=_RaVault.state();
    try{
      if(st==="unknown")rfToast(_gl("Nadal nie wiem, czy sejf istnieje — serwer nie odpowiada.",
                                    "I still do not know whether the vault exists — the server is not answering."),{tone:"danger"});
      else if(st==="none")rfToast(_gl("Sejfu nie ma — możesz ustawić hasło.","There is no vault — you can set a password."));
      else rfToast(_gl("Sejf odnaleziony.","Vault found."),{tone:"ok"});
    }catch(e){}
  });
}
async function _raDeleteVault(){
  const ok=await rfConfirm(_gl("Wszystkie poświadczenia znikną bezpowrotnie, a aplikacje stracą przypisane klucze.",
      "All credentials will be gone for good and the applications will lose their assigned keys."),
    {title:_gl("Usunąć sejf?","Delete the vault?"),icon:'<span class="rfm-bin"></span>',tone:"danger",
     confirmLabel:_gl("Usuń sejf","Delete vault"),cancelLabel:_gl("Anuluj","Cancel")});
  if(!ok)return;
  try{
    await _RaVault.destroy();
    let touched=false;                    // clear credIds now dangling at a vault that no longer exists
    for(const a of (RESTAPI.cfg.apis||[])){
      if(a.credId){a.credId="";touched=true;}
      for(const ac of (a.actions||[]))if(ac.credId){ac.credId="";touched=true;}}
    if(touched)restSave();
    _raRenderVault();_raRenderHeader();restRenderApis();
    try{rfToast(_gl("Sejf usunięty.","Vault deleted."));}catch(e){}
  }catch(e){try{rfSkullSay(_raErrMsg(e),{tone:"danger"});}catch(e2){}}}

// ---------- language switch ----------
// The vault pill („🔒 zablokowany" / „🔓 odblokowany" / „⚪ nieustawiony"), its buttons and the empty
// states are composed with _gl() when the card is PAINTED, so without a repaint they keep whichever
// language they were painted in — the i18n walker cannot reach a string that no longer exists in the
// other language. Same reason and same shape as restObsRelang for the OBS card next door.
// The credential rows are NOT rebuilt while somebody is typing in one: a repaint would take the
// caret out of the field mid-word.
function restRelang(){
  if(!restRoot)return;
  try{_raRenderHeader();}catch(e){}
  try{
    const a=document.activeElement;
    if(!(a&&a.closest&&a.closest("#raVaultBody")))_raRenderVault();
  }catch(e){}
}

// ---------- soft-lock on leaving the tab + bootstrap ----------
// Leaving the REST tab always hides the secrets. They survive in RAM only when the user opted into
// background sending AND automatic sending is on; otherwise the vault is wiped outright.
function restOnLeaveTab(){
  if(!_raInited)return;
  const keep=!!(RESTAPI.cfg&&RESTAPI.cfg.settings&&RESTAPI.cfg.settings.keepUnlockedForSend&&RESTAPI.cfg.enabled);
  try{_RaVault.softLock(keep);_raRenderVault();_raRenderHeader();}catch(e){}}
function _raTouch(){try{_RaVault.touch();}catch(e){}}
function initRest(){
  if(_raInited)return;
  restRoot=document.getElementById("tab-restapi");
  if(!restRoot)return;                   // cheat-sheet mode (?view=overview) has no tabs at all
  _raInited=true;
  try{window.RESTAPI.root=restRoot;}catch(e){}
  // Wybór jednego okna-nadawcy wyzwalaczy (rf-37 `_ra4LeadStart`) rusza od razu, nie przy
  // pierwszym zadziałaniu: okno, które otwarto pierwsze, zostaje nadawcą, a drugie to widzi.
  try{if(typeof _ra4LeadStart==="function"&&!/[?&]overlay=1/.test(location.search||""))_ra4LeadStart();}catch(e){}
  _raBuildUI();
  restRoot.addEventListener("pointerdown",_raTouch,true);   // any interaction with the tab pushes back the idle auto-lock
  restRoot.addEventListener("keydown",_raTouch,true);
  _raRenderHeader();_raRenderVault();restRenderApis();
  // The OBS card (rf-38b). Soft call: a build without that file keeps the rest of the tab.
  try{if(typeof restObsInit==="function")restObsInit();}catch(e){}
  fetch("/rest/config").then(function(r){return r.json();})
    .then(function(j){try{RESTAPI.cfg=_raSanCfg(j&&j.ok===true?j.config:null);}catch(e){RESTAPI.cfg=_raDefCfg();}})
    .catch(function(){RESTAPI.cfg=_raDefCfg();})
    .then(function(){_raRenderHeader();restRenderApis();if(window.updateTabDots)updateTabDots();
      // Config dojeżdża PO zbudowaniu ramki modułu, więc dopóki tu nie dotrze, blok stanu i lista
      // presetów opisują pusty config sprzed pobrania. Jedno wywołanie je poprawia (rf-49n).
      try{if(typeof restCfgSync==="function")restCfgSync();}catch(e){}});
  // Log history from disk (Settings/ribbitflip_rest_log.jsonl): entries from earlier sessions,
  // tagged _hist so the UI greys them out. The file is oldest-first, the view newest-first.
  if(typeof _ra3Log!=="undefined")
    fetch("/rest/log?limit=100").then(function(r){return r.json();}).then(function(j){
      if(!j||j.ok!==true||!Array.isArray(j.entries)||!j.entries.length)return;
      for(const e of j.entries){e._hist=true;e._id="h"+(e.seq||Math.random());}
      for(let i=j.entries.length-1;i>=0;i--)_ra3Log.push(j.entries[i]);
      while(_ra3Log.length>RA3_LOG_MAX)_ra3Log.pop();
      if(typeof restRenderLog==="function")restRenderLog();
      if(typeof _ra3LogStats==="function")_ra3LogStats();
    }).catch(function(){});
  _RaVault.load().then(function(){_raRenderVault();_raRenderHeader();}).catch(function(){});}

