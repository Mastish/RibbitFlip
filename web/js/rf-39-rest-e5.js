"use strict";
// ========== Uslugi sieciowe — variables, action packs, built-in templates ==========
// This file owns three things: the "Variables" card (cfg.vars), import/export of action packs with a
// preview dialog shown BEFORE anything is imported, and the built-in service templates (REST_PACKS)
// together with the setup guide rendered inside an application card.
//
// It reuses rather than duplicates: RESTAPI.cfg, restSave(), restRoot, _raNewId(), restMask(),
// rfConfirm/rfToast/rfSkullSay/rfmReopen/rfmClose, restAddApi(), restRenderApis(), _ra3ApiCard(),
// _ra3RerenderApi(). Every reference is soft (typeof …==="function"), so a missing piece degrades a
// feature instead of breaking the page.
//
// This file defines functions only — it runs nothing on load. The two wrappers that actually hook it
// up (around restRenderApis and _ra3ApiCard) live in rf-40-boot.js, because they can only be applied
// once every file has loaded. Without them the "Variables" card and the setup-guide section simply
// never render, with zero console errors to hint at why.

// ---------- constants ----------
const RA5_MAX_VARS=100;               // variable limit — must match the config sanitizer
const RA5_VAR_KEY_MAX=60;             // max variable name length (likewise)
const RA5_VAR_VAL_MAX=2000;           // max variable value length (likewise)
const RA5_KEY_RE=/^[A-Za-z0-9_]{1,60}$/;   // variable name: letters, digits, underscore
const RA5_MAX_ACTIONS=120;            // actions per API — must match the action editor and sanitizer
const RA5_MAX_FILE=1048576;           // 1 MB — a larger pack file is not read at all
const RA5_METHODS=["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"];
const RA5_BODY_TYPES=["json","text","form","none"];
const RA5_AUTH_HDR=/^(authorization|proxy-authorization)$/i;                 // secrets belong in the vault, never in a pack
const RA5_PACK_APP="ribbitflip";
const RA5_PACK_KIND="rest-actions";
// v2 = the pack also carries the MOVEMENTS (triggers), not just the bare HTTP calls. Bumped rather
// than smuggled in under v1 on purpose: an older build reading a v2 pack says out loud that it comes
// from a newer RibbitFlip and that it is skipping fields it does not know, which is exactly right —
// it imports the actions and silently has no movements. Under v1 it would do the same thing without
// telling anyone. A v1 pack read by this build is unaffected: no `triggers` key, no movements.
const RA5_PACK_VER=2;
const RA5_MAX_TRIG=120;               // movements per API — must match RA4_MAX_TRIG in rf-37
const RA5_VAR_TOKEN=/\{\{\s*var\.([^{}\r\n]{1,120}?)\s*\}\}/g;              // {{var.NAME}} inside action content
const RA5_SECRET_TOKEN=/\{\{\s*secret\.([^{}\r\n]{1,120}?)\s*\}\}/g;        // {{secret.ID}} — a value from the vault
const RA5_ABS_URL=/^https?:\/\//i;
const RA5_ANY_SCHEME=/^[a-z][a-z0-9+.\-]*:/i;

let _ra5Rows=null;                    // working state of the variables editor: [[key,value]…]
let _ra5RowEls=[];                    // row elements of the current render (revalidation without a redraw)
let _ra5Seq=0;                        // fallback id sequence when the shared _raNewId is unavailable
let _ra5ImportApiId="";               // which API the hidden file input's result belongs to
let _ra5TplPaint=null;                // repaints the OPEN "From a template…" dialog after a language switch
const _ra5GuideOpen=new Set();        // apiIds whose setup-guide section is expanded

// ---------- soft bridges to the other REST files (the module also works without them) ----------
function _ra5Cfg(){
  try{if(window.RESTAPI&&window.RESTAPI.cfg)return window.RESTAPI.cfg;}catch(e){}
  try{if(typeof RESTAPI!=="undefined"&&RESTAPI&&RESTAPI.cfg)return RESTAPI.cfg;}catch(e){}
  return null;
}
function _ra5Root(){
  try{if(typeof restRoot!=="undefined"&&restRoot)return restRoot;}catch(e){}
  try{return document.getElementById("tab-restapi");}catch(e){}
  return null;
}
function _ra5Save(){try{if(typeof restSave==="function")restSave();}catch(e){}}
function _ra5Touch(){try{if(typeof _raTouch==="function")_raTouch();}catch(e){}}
function _ra5T(pl,en){try{if(typeof _gl==="function")return _gl(pl,en);}catch(e){}return pl;}
function _ra5Toast(msg,tone){try{if(typeof rfToast==="function")rfToast(msg,tone?{tone:tone}:undefined);}catch(e){}}
function _ra5Say(msg){try{if(typeof rfSkullSay==="function")rfSkullSay(msg,{tone:"danger"});else _ra5Toast(msg,"danger");}catch(e){}}
function _ra5Mask(s){
  const t=String(s==null?"":s);
  try{if(typeof restMask==="function")return restMask(t);}catch(e){}
  return t;
}
// Does comparing `_ra5Mask(json)!==json` actually PROVE anything?
// restMask only knows values currently held in RAM. With the vault locked — the default state after a
// reload and after leaving the tab — there is nothing to match against, so "I found nothing" is NOT
// evidence that an action is free of secrets. Returns "" when the check is meaningful, otherwise the
// reason to refuse the export.
function _ra5VaultBlind(){
  let st=null;
  try{if(typeof restVaultState==="function")st=restVaultState();}catch(e){st=null;}
  if(!st||typeof st!=="object")return "";                    // no vault module ⇒ no values that could leak
  if(st.ready===true)return "";                              // secrets are in RAM (including the background-send soft lock)
  if(st.vaultLoaded===true&&st.hasVault===false)return "";   // a vault definitely does NOT exist ⇒ nothing to compare
  if(st.vaultLoaded===undefined&&st.state==="none")return ""; // older state shape, without vaultLoaded
  if(st.state==="nocrypto")return "nocrypto";
  // "unknown"/"checking": GET /rest/vault has not answered, or the vault file is unreadable. That is
  // NOT proof the vault is absent, so treat it as blind and refuse rather than export on a guess.
  return (st.state==="unknown"||st.state==="checking"||st.vaultLoaded!==true)?"unknown":"locked";
}
function _ra5NewId(pfx){
  try{if(typeof _raNewId==="function")return _raNewId(pfx);}catch(e){}
  _ra5Seq++;return String(pfx)+"e5"+_ra5Seq;
}
function _ra5Packs(){                 // REST_PACKS is a lexical const: even typeof throws in its TDZ, hence try/catch
  try{if(typeof REST_PACKS!=="undefined"&&Array.isArray(REST_PACKS))return REST_PACKS;}catch(e){}
  return [];
}

// ---------- template content in English ----------
// The module's own interface is bilingual through the usual i18n keys, but template CONTENT (guides,
// caveats, credential descriptions, action names and descriptions) lives in REST_PACKS. The English
// layer sits in ONE nested `pack.en` field ({name,desc,credential,guide,caveats,actions:[{name,desc}]})
// so that the action objects keep exactly the field list the action normalizer copies into the user's
// own configuration.
// RULE: a missing translation, or an empty string, falls back to the POLISH original — never to blank.
function _ra5EN(){                    // is the interface in English (asked through the same gate as everything else)
  try{return _ra5T("pl","en")==="en";}catch(e){return false;}
}
function _ra5Pick(pl,en){
  const p=_ra5Str(pl);
  if(!_ra5EN())return p;
  return (typeof en==="string"&&en.trim())?en:p;
}
function _ra5PackTxt(p,f){            // f: name | desc | credential | caveats | guide
  if(!p)return "";
  const pl=(f==="guide")?p.guidePL:p[f];               // the Polish guide field is named guidePL, not guide
  return _ra5Pick(pl,(p.en&&typeof p.en==="object")?p.en[f]:null);
}
function _ra5PackActTxt(p,i,f){       // f: name | desc — action i of template p; EN is matched BY INDEX
  const a=(p&&Array.isArray(p.actions))?p.actions[i]:null;
  const ea=(p&&p.en&&Array.isArray(p.en.actions))?p.en.actions[i]:null;
  return _ra5Pick(a?a[f]:"",ea?ea[f]:null);
}
function _ra5PackActs(p){             // template actions in the INTERFACE LANGUAGE — used when creating an application
  const src=(p&&Array.isArray(p.actions))?p.actions:[];
  return src.map(function(a,i){
    const o={};
    for(const k in a)if(Object.prototype.hasOwnProperty.call(a,k))o[k]=a[k];
    o.name=_ra5PackActTxt(p,i,"name");
    o.desc=_ra5PackActTxt(p,i,"desc");
    return o;                          // the action normalizer only lets whitelisted fields through anyway
  });
}

// ---------- small helpers (kept local so this file stands on its own) ----------
function _ra5Str(v,max){
  if(v==null)return "";
  const s=(typeof v==="string")?v:String(v);
  return max?s.slice(0,max):s;
}
function _ra5Method(m){m=String(m||"").toUpperCase();return RA5_METHODS.indexOf(m)>=0?m:"POST";}
function _ra5BodyType(b){b=String(b||"");return RA5_BODY_TYPES.indexOf(b)>=0?b:"json";}
function _ra5Pairs(v){
  const out=[];
  if(!Array.isArray(v))return out;
  for(const p of v.slice(0,50)){
    if(!Array.isArray(p))continue;
    const k=_ra5Str(p[0],200);
    if(!k)continue;
    out.push([k,_ra5Str(p[1],4000)]);
  }
  return out;
}
function _ra5Int(v,lo,hi,dflt){
  const n=parseInt(v,10);
  if(!isFinite(n))return dflt;
  return Math.max(lo,Math.min(hi,n));
}
function _ra5Num(v,dflt){
  const n=parseFloat(v);
  return isFinite(n)?n:dflt;
}
// Kształt warunku ruchu — JEDEN spis pól dla całej aplikacji (`_raSanMotion`, rf-35).
// Paczka akcji ma trzy własne miejsca, w których wyzwalacz jest budowany od zera (eksport, podgląd
// importu, scalanie), i dopóki każde z nich przepisywało pola ręcznie, nowe pole potrafiło działać
// u autora i nie dojechać do nikogo innego. `_ra5Motion` jest cienką przejściówką, żeby te trzy
// miejsca nie miały już własnego zdania na temat tego, z czego składa się warunek.
function _ra5Motion(s){
  try{if(typeof _raSanMotion==="function")return _raSanMotion(s);}catch(e){}
  s=(s&&typeof s==="object")?s:{};
  const cmp=_ra5Str(s.cmp,4)||">",rng=(cmp==="in"||cmp==="out"),thr=_ra5Num(s.threshold,0);
  return {source:_ra5Str(s.source,40),cmp:cmp,threshold:thr,
          thresholdHi:rng?_ra5Num(s.thresholdHi,thr):null,
          abs:s.abs===true,neg:s.neg===true,mode:_ra5Str(s.mode,12),
          dwellMs:_ra5Int(s.dwellMs,0,600000,400),
          crossings:_ra5Int(s.crossings,1,20,2),windowMs:_ra5Int(s.windowMs,50,60000,600)};
}
function _ra5Sel(id){return String(id==null?"":id).replace(/["\\\]]/g,"");}
function _ra5Pl(n,f1,f2,f5){
  const a=Math.abs(n)%100,b=a%10;
  if(a===1)return f1;
  if(b>=2&&b<=4&&(a<12||a>14))return f2;
  return f5;
}
function _ra5Host(u){
  const m=RA5_ABS_URL.test(_ra5Str(u).trim())?/^https?:\/\/([^/?#]+)/i.exec(_ra5Str(u).trim()):null;
  return m?m[1]:"";
}
function _ra5SameHost(a,b){return String(a).toLowerCase()===String(b).toLowerCase();}
function _ra5Apis(){
  const c=_ra5Cfg();
  if(!c)return [];
  if(!Array.isArray(c.apis))c.apis=[];
  return c.apis;
}
function _ra5Api(id){for(const a of _ra5Apis())if(a&&a.id===id)return a;return null;}
function _ra5Scroll(el){
  if(!el||!el.scrollIntoView)return;
  // Cel bywa w zwiniętym zwijaku (Zmienne na piętrze 2, sejf w „Zaawansowane”): najpierw go otwórz.
  for(let d=el.closest&&el.closest("details");d;d=d.parentElement&&d.parentElement.closest("details"))d.open=true;
  if(el.tagName==="DETAILS")el.open=true;
  let smooth=true;
  try{smooth=!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);}catch(e){}
  try{el.scrollIntoView({block:"nearest",behavior:smooth?"smooth":"auto"});}catch(e){try{el.scrollIntoView();}catch(e2){}}
}
function _ra5Empty(title,sub,ctaLab,ctaFn){
  const d=document.createElement("div");d.className="ra-empty";
  const b=document.createElement("b");b.textContent=title;d.appendChild(b);
  if(sub){const s=document.createElement("span");s.textContent=sub;d.appendChild(s);}
  if(ctaLab){
    const w=document.createElement("div");w.className="ra-empty-cta";
    const btn=document.createElement("button");btn.type="button";btn.className="btn sm primary";
    btn.textContent=ctaLab;btn.addEventListener("click",ctaFn);
    w.appendChild(btn);d.appendChild(w);
  }
  return d;
}
// `plus` = the .bic-plus PNG before the label, the one "add" icon of the whole panel (no textual "+ ")
function _ra5Btn(label,cls,title,fn,plus){
  const b=document.createElement("button");
  b.type="button";b.className="btn "+(cls||"sm");
  if(plus&&typeof _raBtnLabel==="function")_raBtnLabel(b,label,"bic-plus");else b.textContent=label;
  if(title)b.title=title;
  if(fn)b.addEventListener("click",fn);
  return b;
}
function _ra5RepaintApi(apiId){
  try{
    if(typeof _ra3RerenderApi==="function"){_ra3RerenderApi(apiId);return;}
    if(typeof restRenderApis==="function")restRenderApis();
  }catch(e){}
}

// =====================================================================
// A) THE "VARIABLES" CARD (cfg.vars)
// Model: cfg.vars is a flat {name:"value"} object. The editor works on a separate array of pairs
// (_ra5Rows) so a name can be typed character by character, and so half-finished rows (empty,
// invalid or duplicate name) can exist without losing what the user already typed. ONLY rows with a
// valid, unique name are committed to cfg.vars; the rest stay in the editor with a message.
// =====================================================================
function _ra5Vars(){
  const c=_ra5Cfg();
  if(!c)return {};
  if(!c.vars||typeof c.vars!=="object"||Array.isArray(c.vars))c.vars={};
  return c.vars;
}
function _ra5VarKeyOk(k){return RA5_KEY_RE.test(String(k==null?"":k));}
function _ra5SyncRows(){              // merge editor state with the model; the model is the source of truth
  const vars=_ra5Vars();
  if(!Array.isArray(_ra5Rows))_ra5Rows=[];
  const out=[],seen=new Set();
  for(const r of _ra5Rows){
    const k=_ra5Str(r&&r[0],RA5_VAR_KEY_MAX);
    if(k&&Object.prototype.hasOwnProperty.call(vars,k)){
      if(seen.has(k))continue;                                  // duplicate created by an outside write
      seen.add(k);out.push([k,_ra5Str(vars[k],RA5_VAR_VAL_MAX)]);
    }else out.push([k,_ra5Str(r&&r[1],RA5_VAR_VAL_MAX)]);       // row not committed yet
  }
  for(const k of Object.keys(vars)){
    if(seen.has(k))continue;
    seen.add(k);out.push([k,_ra5Str(vars[k],RA5_VAR_VAL_MAX)]);
  }
  _ra5Rows=out;
  return out;
}
function _ra5CommitVars(){            // editor → model; never throws, always persists through restSave()
  const cfg=_ra5Cfg();
  if(!cfg)return false;
  const out={},seen=new Set();
  let n=0;
  for(const r of (_ra5Rows||[])){
    const k=_ra5Str(r&&r[0],RA5_VAR_KEY_MAX);
    if(!_ra5VarKeyOk(k)||seen.has(k))continue;
    if(n>=RA5_MAX_VARS)break;
    seen.add(k);out[k]=_ra5Str(r&&r[1],RA5_VAR_VAL_MAX);n++;
  }
  cfg.vars=out;
  _ra5Save();
  return true;
}
function restSetVar(key,value){       // public: add or overwrite a variable (also used by the "missing variables" chips)
  const cfg=_ra5Cfg();
  if(!cfg)return {ok:false,error:_ra5T("Moduł Usługi sieciowe nie jest jeszcze gotowy.","The Network services module is not ready yet.")};
  const k=_ra5Str(key,RA5_VAR_KEY_MAX).trim();
  if(!_ra5VarKeyOk(k))
    return {ok:false,error:_ra5T("Nazwa zmiennej może mieć tylko litery, cyfry i podkreślenie.",
                                 "A variable name may contain only letters, digits and underscores.")};
  const vars=_ra5Vars();
  const isNew=!Object.prototype.hasOwnProperty.call(vars,k);
  if(isNew&&Object.keys(vars).length>=RA5_MAX_VARS)
    return {ok:false,error:_ra5T("Limit "+RA5_MAX_VARS+" zmiennych został osiągnięty.",
                                 "The limit of "+RA5_MAX_VARS+" variables has been reached.")};
  vars[k]=_ra5Str(value,RA5_VAR_VAL_MAX);
  _ra5SyncRows();
  _ra5Save();
  return {ok:true,key:k,added:isNew};
}
function restRemoveVar(key){
  const vars=_ra5Vars(),k=_ra5Str(key,RA5_VAR_KEY_MAX);
  if(!Object.prototype.hasOwnProperty.call(vars,k))return false;
  delete vars[k];
  if(Array.isArray(_ra5Rows))_ra5Rows=_ra5Rows.filter(function(r){return _ra5Str(r&&r[0])!==k;});
  _ra5Save();
  return true;
}
function _ra5ScanVarTokens(s,out){
  if(typeof s!=="string"||s.indexOf("{{")<0)return;
  RA5_VAR_TOKEN.lastIndex=0;
  let m;
  while((m=RA5_VAR_TOKEN.exec(s))!==null)out.add(m[1]);
}
function _ra5UsedVars(){              // {{var.X}} names actually referenced somewhere in the configuration
  const out=new Set();
  for(const api of _ra5Apis()){
    if(!api||typeof api!=="object")continue;
    _ra5ScanVarTokens(api.baseUrl,out);
    for(const p of _ra5Pairs(api.headers)){_ra5ScanVarTokens(p[0],out);_ra5ScanVarTokens(p[1],out);}
    for(const a of (Array.isArray(api.actions)?api.actions:[])){
      if(!a||typeof a!=="object")continue;
      _ra5ScanVarTokens(a.path,out);
      _ra5ScanVarTokens(a.body,out);
      for(const p of _ra5Pairs(a.query)){_ra5ScanVarTokens(p[0],out);_ra5ScanVarTokens(p[1],out);}
      for(const p of _ra5Pairs(a.headers)){_ra5ScanVarTokens(p[0],out);_ra5ScanVarTokens(p[1],out);}
    }
  }
  return Array.from(out);
}
function _ra5MissingVars(){
  const vars=_ra5Vars();
  return _ra5UsedVars().filter(function(k){
    return _ra5VarKeyOk(k)&&!Object.prototype.hasOwnProperty.call(vars,k);
  }).sort();
}
function _ra5RowState(i){             // validation state of a single editor row
  const rows=_ra5Rows||[],r=rows[i]||["",""];
  const k=_ra5Str(r[0],RA5_VAR_KEY_MAX),v=_ra5Str(r[1],RA5_VAR_VAL_MAX);
  if(!k)return v?{cls:"bad",msg:_ra5T("Podaj nazwę zmiennej — bez niej wartość nie zostanie zapisana.",
                                      "Give the variable a name — without it the value will not be saved.")}
                :{cls:"",msg:""};
  if(!_ra5VarKeyOk(k))return {cls:"bad",msg:_ra5T("Dozwolone są tylko litery, cyfry i podkreślenie (bez spacji i kropek).",
                                                  "Only letters, digits and underscores are allowed (no spaces or dots).")};
  for(let j=0;j<i;j++){
    const other=_ra5Str(rows[j]&&rows[j][0],RA5_VAR_KEY_MAX);
    if(other===k)return {cls:"bad",msg:_ra5T("Taka zmienna już jest wyżej — ta linia nie zostanie zapisana.",
                                             "This variable already exists above — this line will not be saved.")};
  }
  if(!v)return {cls:"warn",msg:_ra5T("Pusta wartość — token {{var."+k+"}} podstawi pusty tekst.",
                                     "Empty value — the {{var."+k+"}} token will insert empty text.")};
  return {cls:"",msg:""};
}
function _ra5Revalidate(){            // refresh EVERY row's message in place, without moving the caret
  for(let i=0;i<_ra5RowEls.length;i++){
    const el=_ra5RowEls[i];
    if(!el||!el.parentNode)continue;
    const st=_ra5RowState(i);
    el.classList.toggle("bad",st.cls==="bad");
    el.classList.toggle("warn",st.cls==="warn");
    const msg=el.querySelector(".ra-var-msg");
    if(msg)msg.textContent=st.msg;
    const tok=el.querySelector(".ra-var-tok");
    if(tok){
      const k=_ra5Str((_ra5Rows[i]||[])[0],RA5_VAR_KEY_MAX);
      tok.textContent=(k&&_ra5VarKeyOk(k))?("{{var."+k+"}}"):"";
    }
  }
}
function _ra5VarsCard(){              // built once, BEFORE the vault (P-G3-13), and before the log card so the log stays last
  const root=_ra5Root();
  if(!root)return null;
  let card=root.querySelector("#raVarsCard");
  if(card)return card;
  const wrap=root.querySelector(".ra-wrap")||root;
  // PIĘTRO 2 (UX 261120 L4c): zwijak w karcie aplikacji, za OBS-em (#raTier2 z rf-35).
  // W nagłówku liczba zmiennych i ile brakuje, więc brak zmiennej widać bez otwierania.
  card=document.createElement("details");
  card.className="cardfold inset ra-fold";card.id="raVarsCard";
  card.innerHTML=
    '<summary>Zmienne</summary>'+
    '<div class="cardfold-body"><p class="hint ra-fold-hint">własne wartości wstawiane w akcjach przez {{var.nazwa}}</p>'+
    '<div class="ra-body" id="raVarsBody"></div></div>';
  const slot=wrap.querySelector("#raTier2");
  const next=wrap.querySelector("#raAdv")||wrap.querySelector("#raVaultCard")||wrap.querySelector("#raLogCard");
  if(slot)slot.appendChild(card);
  else if(next&&next.parentNode===wrap)wrap.insertBefore(card,next);
  else wrap.appendChild(card);
  try{if(typeof rfTier==="function")_ra5VarsSync=rfTier(card,"uslugi.zmienne",{sum:_ra5VarsSum,changed:function(){return 0;}});}catch(e){}
  return card;
}
let _ra5VarsSync=null;
function _ra5VarsSum(){
  const n=Object.keys(_ra5Vars()||{}).length,miss=_ra5MissingVars().length;
  let t=_ra5T(n+" "+_ra5Pl(n,"zmienna","zmienne","zmiennych"),n+" "+(n===1?"variable":"variables"));
  if(miss)t+=" · "+_ra5T("brakuje: "+miss,"missing: "+miss);
  return t;
}
function _ra5VarRow(i){
  const row=document.createElement("div");
  row.className="ra-var";
  row.innerHTML=
    '<input type="text" class="ra-var-k" maxlength="60" placeholder="nazwa" '+
      'autocomplete="off" spellcheck="false" aria-label="Nazwa zmiennej">'+
    '<span class="ra-var-eq" aria-hidden="true">=</span>'+
    '<input type="text" class="ra-var-v" maxlength="2000" placeholder="wartość" '+
      'autocomplete="off" spellcheck="false" aria-label="Wartość zmiennej">'+
    '<code class="ra-var-tok" title="Ten token wstawiasz w treści akcji"></code>'+
    '<button type="button" class="ra-var-x" title="Usuń tę zmienną" aria-label="Usuń tę zmienną">✕</button>'+
    '<div class="ra-var-msg" role="status"></div>';
  const k=row.querySelector(".ra-var-k"),v=row.querySelector(".ra-var-v");
  k.value=_ra5Str((_ra5Rows[i]||[])[0],RA5_VAR_KEY_MAX);
  v.value=_ra5Str((_ra5Rows[i]||[])[1],RA5_VAR_VAL_MAX);
  k.addEventListener("input",function(){
    if(!_ra5Rows[i])_ra5Rows[i]=["",""];
    _ra5Rows[i][0]=_ra5Str(k.value,RA5_VAR_KEY_MAX).trim();
    _ra5CommitVars();_ra5Revalidate();_ra5Touch();
  });
  v.addEventListener("input",function(){
    if(!_ra5Rows[i])_ra5Rows[i]=["",""];
    _ra5Rows[i][1]=_ra5Str(v.value,RA5_VAR_VAL_MAX);
    _ra5CommitVars();_ra5Revalidate();_ra5Touch();
  });
  row.querySelector(".ra-var-x").addEventListener("click",function(){
    _ra5Rows.splice(i,1);
    _ra5CommitVars();_ra5Touch();restRenderVars();
  });
  return row;
}
function _ra5AddVarRow(key,value,focusValue){
  _ra5SyncRows();
  _ra5Rows.push([_ra5Str(key,RA5_VAR_KEY_MAX),_ra5Str(value,RA5_VAR_VAL_MAX)]);
  _ra5CommitVars();
  restRenderVars();
  try{
    const els=_ra5RowEls[_ra5RowEls.length-1];
    const inp=els&&els.querySelector(focusValue?".ra-var-v":".ra-var-k");
    if(inp){inp.focus();inp.select();}
  }catch(e){}
}
function restRenderVars(){
  const card=_ra5VarsCard();
  if(!card)return;
  const box=card.querySelector("#raVarsBody");
  if(!box)return;
  _ra5SyncRows();
  _ra5RowEls=[];
  box.innerHTML="";

  const lead=document.createElement("div");
  lead.className="ra-note";
  lead.textContent=_ra5T(
    "Zmienna to Twoja własna wartość: identyfikator webhooka, temat powiadomienia, treść wiadomości. "+
    "W akcji wpisujesz {{var.nazwa}}, a przy wysyłce podstawia się to, co masz tutaj. Dzięki temu jedną wartość "+
    "zmieniasz w jednym miejscu, a nie w dziesięciu akcjach. Sekrety (tokeny, hasła) trzymaj w sejfie, nie tutaj.",
    "A variable is your own value: a webhook id, a notification topic, a message text. In an action you type "+
    "{{var.name}} and on sending it is replaced with what you keep here. One value, one place to change it. "+
    "Keep secrets (tokens, passwords) in the vault, not here.");
  box.appendChild(lead);

  const miss=_ra5MissingVars();
  if(miss.length){
    const mw=document.createElement("div");
    mw.className="ra-var-miss";
    const b=document.createElement("b");
    b.textContent=_ra5T("Twoje akcje używają zmiennych, których jeszcze nie masz:",
                        "Your actions use variables you do not have yet:");
    mw.appendChild(b);
    const chips=document.createElement("div");
    chips.className="ra-var-chips";
    for(const k of miss.slice(0,40)){
      const c=document.createElement("button");
      c.type="button";c.className="ra-chip ra-var-chip";
      c.textContent="+ "+k;
      c.title=_ra5T("Dodaj zmienną „"+k+"” i wpisz jej wartość","Add the variable “"+k+"” and type its value");
      c.addEventListener("click",function(){_ra5Touch();_ra5AddVarRow(k,"",true);});
      chips.appendChild(c);
    }
    mw.appendChild(chips);
    if(miss.length>1){
      const all=_ra5Btn(_ra5T("Dodaj wszystkie","Add all"),"xs",
        _ra5T("Dodaj wszystkie brakujące nazwy — wartości uzupełnisz sam",
              "Add all the missing names — you fill in the values yourself"),
        function(){
          _ra5Touch();_ra5SyncRows();
          for(const k of miss.slice(0,RA5_MAX_VARS))_ra5Rows.push([k,""]);
          _ra5CommitVars();restRenderVars();
        },true);
      mw.appendChild(all);
    }
    box.appendChild(mw);
  }

  // NO BUTTON IN THE EMPTY STATE. „Nowa zmienna" stands in the bar two rows below and does exactly
  // the same thing; with the „+ NAZWA" chips above (the names the actions are actually missing) the
  // card offered three ways to add a variable at once, one of them a duplicate of another.
  if(!_ra5Rows.length){
    box.appendChild(_ra5Empty(
      _ra5T("Nie masz jeszcze żadnej zmiennej.","You have no variables yet."),
      _ra5T("Szablony usług (Discord, ntfy, Telegram…) proszą o takie wartości jak identyfikator webhooka "+
            "czy temat powiadomienia. Dodaj je tutaj przyciskiem „Nowa zmienna”, a akcje z {{var.…}} zaczną działać.",
            "Service templates (Discord, ntfy, Telegram…) ask for values such as a webhook id or a notification "+
            "topic. Add them here with “New variable” and actions using {{var.…}} will start working.")));
  }else{
    const list=document.createElement("div");
    list.className="ra-vars";
    for(let i=0;i<_ra5Rows.length;i++){
      const row=_ra5VarRow(i);
      _ra5RowEls.push(row);
      list.appendChild(row);
    }
    box.appendChild(list);
  }

  const bar=document.createElement("div");
  bar.className="ra-toolbar ra-var-bar";
  bar.appendChild(_ra5Btn(_ra5T("Nowa zmienna","New variable"),"sm",
    _ra5T("Dodaj pustą parę nazwa/wartość","Add an empty name/value pair"),
    function(){
      _ra5Touch();
      if(_ra5Rows.length>=RA5_MAX_VARS){
        _ra5Toast(_ra5T("Limit "+RA5_MAX_VARS+" zmiennych został osiągnięty.",
                        "The limit of "+RA5_MAX_VARS+" variables has been reached."),"danger");
        return;
      }
      _ra5AddVarRow("","",false);
    },true));
  const cnt=document.createElement("span");
  cnt.className="ra-toolbar-cnt";
  const n=Object.keys(_ra5Vars()).length;
  cnt.textContent=_ra5T(n+" "+_ra5Pl(n,"zmienna","zmienne","zmiennych"),
                        n+" "+(n===1?"variable":"variables"));
  bar.appendChild(cnt);
  box.appendChild(bar);

  _ra5Revalidate();
  try{if(_ra5VarsSync)_ra5VarsSync();}catch(e){}
}

// =====================================================================
// B) ACTION PACKS — export and import of one API's action library
// Envelope: {app:"ribbitflip", kind:"rest-actions", version:1, api:{…}, actions:[…]}
// Secrets NEVER enter a pack: credId is dropped in both directions, and a literal authorization
// header value is cleared on export, leaving only the header name behind.
// =====================================================================
function _ra5Slug(s){
  const map={"ą":"a","ć":"c","ę":"e","ł":"l","ń":"n","ó":"o","ś":"s","ź":"z","ż":"z",
             "Ą":"a","Ć":"c","Ę":"e","Ł":"l","Ń":"n","Ó":"o","Ś":"s","Ź":"z","Ż":"z"};
  let x="";
  for(const ch of _ra5Str(s,80))x+=(map[ch]!=null?map[ch]:ch);
  x=x.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  return x||"api";
}
function _ra5IsRef(v){return /\{\{\s*(secret|var)\./.test(String(v==null?"":v));}
function _ra5ScrubHdr(pairs){          // a literal authorization header value must NOT leave the app
  const out=[];
  let stripped=0;
  for(const p of _ra5Pairs(pairs)){
    const k=_ra5Str(p[0],200),v=_ra5Str(p[1],4000);
    if(RA5_AUTH_HDR.test(k.trim())&&v&&!_ra5IsRef(v)){out.push([k,""]);stripped++;continue;}
    out.push([k,v]);
  }
  return {pairs:out,stripped:stripped};
}
function _ra5CountStripped(api){
  let n=0;
  for(const a of ((api&&Array.isArray(api.actions))?api.actions:[]))
    if(a)n+=_ra5ScrubHdr(a.headers).stripped;
  return n;
}
// The MOVEMENTS. "Tilt past 30° fires the next-track call" is the half of a shared configuration
// that actually took somebody an evening, and until now it stayed on their machine while only the
// bare HTTP call travelled. What may NOT travel is anything naming something local:
//   • src.dev — a capsule slot id (d1, d2). Whoever imports this has different capsules.
//   • src.ruleId — a Mapping rule id out of the author's config. It does not exist on the importing
//     machine, and rewriting it to "any rule" would fire the call on EVERY rule that person has,
//     which is emphatically not what the author built. Such movements travel, but switched off.
// A movement points at its action BY INDEX, never by id: the importer mints fresh action ids, and an
// id copied out of a foreign config would either dangle or, worse, collide with a local one.
function _ra5TrigsFromApi(api,idx){
  const out=[];
  const src=(api&&Array.isArray(api.triggers))?api.triggers:[];
  for(const t of src.slice(0,RA5_MAX_TRIG)){
    if(!t||typeof t!=="object"||Array.isArray(t))continue;
    const ai=idx[_ra5Str(t.actionId,40)];
    if(ai==null)continue;              // points at an action that is not in this pack
    const s=(t.src&&typeof t.src==="object"&&!Array.isArray(t.src))?t.src:{};
    const motion=(s.kind==="motion");
    const row={actionIdx:ai,on:(t.on!==false),label:_ra5Str(t.label,60),
               minIntervalMs:_ra5Int(t.minIntervalMs,0,3600000,250),
               src:{kind:motion?"motion":"rule"}};           // dev and ruleId DELIBERATELY omitted
    // Pełny kształt warunku ruchu bierzemy z JEDYNEGO spisu pól (`_raSanMotion`, rf-35). Wcześniej
    // były tu przepisane ręcznie cztery pola i każde nowe ginęło dokładnie w tym przepływie:
    // ustawienie działało u autora, a po wyeksportowaniu paczki nie docierało do nikogo.
    if(motion)Object.assign(row.src,_ra5Motion(s));
    const to=(t.toast&&typeof t.toast==="object")?t.toast:null;
    if(to&&to.on)row.toast={on:true,mode:(to.mode==="active"?"active":"fire"),
                            silent:(to.silent!==false),text:_ra5Str(to.text,120)};
    out.push(row);
  }
  return out;
}
function restPackFromApi(api){         // pure function — touches no DOM and copies no secrets
  const actions=[];
  const idx=Object.create(null);       // action id → its index in `actions`, for the movements below
  const src=(api&&Array.isArray(api.actions))?api.actions:[];
  for(const a of src.slice(0,RA5_MAX_ACTIONS)){
    if(!a||typeof a!=="object"||Array.isArray(a))continue;
    const h=_ra5ScrubHdr(a.headers);
    if(a.id)idx[_ra5Str(a.id,40)]=actions.length;
    const pa={
      name:_ra5Str(a.name,80)||"Akcja",
      desc:_ra5Str(a.desc,200),
      method:_ra5Method(a.method),
      path:_ra5Str(a.path,1000),
      query:_ra5Pairs(a.query),
      headers:h.pairs,
      bodyType:_ra5BodyType(a.bodyType),
      body:_ra5Str(a.body,20000)
    };                                                      // credId DELIBERATELY omitted
    const prt=_ra5Str(a.requestType,64);                    // OBS action; absent on every HTTP one
    if(prt)pa.requestType=prt;
    actions.push(pa);
  }
  return {
    app:RA5_PACK_APP,kind:RA5_PACK_KIND,version:RA5_PACK_VER,
    appVersion:window.RIBBITFLIP_VERSION||"",
    api:{
      name:_ra5Str(api&&api.name,80),
      baseUrlHint:_ra5Str(api&&api.baseUrl,500),
      transport:((api&&api.transport==="ws")?"ws":"http"),
      note:_ra5T("Paczka akcji z RibbitFlip — bez tokenów i haseł; po imporcie ustaw adres bazowy, "+
                 "poświadczenie w sejfie i zmienne {{var.…}}.",
                 "A RibbitFlip action pack — no tokens or passwords; after importing set the base URL, "+
                 "the vault credential and the {{var.…}} variables.")
    },
    actions:actions,
    triggers:_ra5TrigsFromApi(api,idx)
  };
}
// Checking "is a vault value written out literally" MUST walk the MODEL FIELDS, not the finished
// JSON. JSON.stringify escapes quotes, backslashes, newlines, tabs and every control character,
// while restMask looks for the RAW form — so a password like ab"cd-SECRET appears in the file as
// ab\"cd-SECRET and `_ra5Mask(json)!==json` does NOT catch it. Left to the JSON check alone, a file
// containing a secret really did download while the toast claimed "without credentials".
function _ra5Leaks(v){
  const s=_ra5Str(v);
  if(s.length<3)return false;
  return _ra5Mask(s)!==s;
}
function _ra5PackLeaks(pack){          // "" when clean; otherwise the NAME of the offending field — never its value
  if(!pack||typeof pack!=="object")return "";
  const meta=(pack.api&&typeof pack.api==="object")?pack.api:{};
  if(_ra5Leaks(meta.name))return _ra5T("nazwa aplikacji","the application name");
  if(_ra5Leaks(meta.baseUrlHint))return _ra5T("adres bazowy aplikacji","the application base URL");
  if(_ra5Leaks(meta.note))return _ra5T("notatka paczki","the pack note");
  for(const a of (Array.isArray(pack.actions)?pack.actions:[])){
    if(!a||typeof a!=="object")continue;
    const nm=_ra5Str(a.name,80)||"?";
    if(_ra5Leaks(a.name))return _ra5T("nazwa akcji","an action name");
    if(_ra5Leaks(a.desc))return _ra5T("opis akcji „"+nm+"”","the description of action “"+nm+"”");
    if(_ra5Leaks(a.path))return _ra5T("ścieżka akcji „"+nm+"”","the path of action “"+nm+"”");
    if(_ra5Leaks(a.body))return _ra5T("treść akcji „"+nm+"”","the body of action “"+nm+"”");
    for(const p of _ra5Pairs(a.query))
      if(_ra5Leaks(p[0])||_ra5Leaks(p[1]))
        return _ra5T("parametr adresu w akcji „"+nm+"”","a query parameter in action “"+nm+"”");
    for(const p of _ra5Pairs(a.headers))
      if(_ra5Leaks(p[0])||_ra5Leaks(p[1]))
        return _ra5T("nagłówek w akcji „"+nm+"”","a header in action “"+nm+"”");
  }
  // The movements carry free-text fields the user types into — the notification text and (since
  // 2026-09-12) the movement's own NAME — and a free-text field is the kind of place a password gets
  // pasted "just to test it". They go through the same mask check as everything else, or the export
  // gate has a hole in it. Każde nowe pole tekstowe wyzwalacza MUSI trafić tutaj, inaczej komunikat
  // „bez tokenów i haseł" przestaje być prawdą.
  for(const t of (Array.isArray(pack.triggers)?pack.triggers:[])){
    if(t&&t.toast&&_ra5Leaks(t.toast.text))
      return _ra5T("tekst powiadomienia przy ruchu","the notification text of a movement");
    if(t&&_ra5Leaks(t.label))
      return _ra5T("nazwa ruchu","the name of a movement");
  }
  return "";
}
function restExportActions(api){
  api=(api&&typeof api==="object")?api:null;
  if(!api){_ra5Say(_ra5T("Nie wiem, którą aplikację wyeksportować.","I do not know which application to export."));return false;}
  const acts=Array.isArray(api.actions)?api.actions:[];
  if(!acts.length){
    _ra5Toast(_ra5T("Ta aplikacja nie ma jeszcze żadnej akcji do wyeksportowania.",
                    "This application has no actions to export yet."),"danger");
    return false;
  }
  const blind=_ra5VaultBlind();         // with the vault locked the mask check proves nothing → refuse to export blindly
  if(blind){
    _ra5Say(blind==="unknown"
      ? _ra5T("Nie wiem, czy sejf istnieje (serwer nie odpowiedział albo plik sejfu jest nieczytelny), "+
              "więc nie sprawdzę, czy w treści akcji nie ma wpisanej wprost wartości z sejfu. "+
              "Sprawdź stan sejfu i spróbuj ponownie.",
              "I do not know whether the vault exists (the server did not answer, or the vault file is unreadable), "+
              "so I cannot check whether an action has a value from the vault written out in plain text. "+
              "Check the vault status and try again.")
      : blind==="nocrypto"
      ? _ra5T("Sejf jest niedostępny w tym połączeniu (szyfrowanie działa tylko na 127.0.0.1/localhost), "+
              "więc nie sprawdzę, czy w treści akcji nie ma wpisanej wprost wartości z sejfu. "+
              "Wyeksportuj paczkę z komputera, na którym działa RibbitFlip.",
              "The vault is unavailable over this connection (encryption works only on 127.0.0.1/localhost), "+
              "so I cannot check whether an action has a value from the vault written out in plain text. "+
              "Export the pack from the computer running RibbitFlip.")
      : _ra5T("Sejf jest zamknięty, więc nie sprawdzę, czy w treści akcji nie ma wpisanej wprost wartości "+
              "z sejfu — nie wyeksportuję paczki na ślepo. Odblokuj sejf i spróbuj ponownie.",
              "The vault is locked, so I cannot check whether an action has a value from the vault written out "+
              "in plain text — I will not export the pack blindly. Unlock the vault and try again."));
    return false;
  }
  const pack=restPackFromApi(api);
  const json=JSON.stringify(pack,null,2);
  // Hard requirement: no real vault value may leave in the file. Checked per FIELD (which catches
  // secrets whose characters JSON escapes) and again over the whole JSON as a belt-and-braces pass.
  const leak=_ra5PackLeaks(pack);
  if(leak||_ra5Mask(json)!==json){
    _ra5Say(_ra5T("W treści akcji jest wpisana wprost wartość z sejfu"+(leak?(" — "+leak):"")+
                  ". Nie wyeksportuję takiej paczki. Zamień tę wartość na token {{secret.…}} i spróbuj ponownie.",
                  "An action contains a value from the vault written out in plain text"+(leak?(" — "+leak):"")+
                  ". I will not export such a pack. Replace it with a {{secret.…}} token and try again."));
    return false;
  }
  const stripped=_ra5CountStripped(api);
  try{
    const blob=new Blob([json],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="ribbitflip-akcje-"+_ra5Slug(api.name)+".json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1500);
  }catch(e){
    _ra5Say(_ra5T("Nie udało się zapisać pliku paczki.","Could not save the pack file."));
    return false;
  }
  const n=pack.actions.length,g=pack.triggers.length;
  _ra5Toast(_ra5T("Wyeksportowano "+n+" "+_ra5Pl(n,"akcję","akcje","akcji")+
                  (g?(" i "+g+" "+_ra5Pl(g,"ruch","ruchy","ruchów")):"")+" bez poświadczeń."+
                  (stripped?(" Wyczyszczono "+stripped+" "+_ra5Pl(stripped,"nagłówek autoryzacji","nagłówki autoryzacji","nagłówków autoryzacji")+"."):""),
                  "Exported "+n+" action(s)"+(g?(" and "+g+" movement(s)"):"")+" without credentials."+
                  (stripped?(" Cleared "+stripped+" authorization header(s)."):"")),"ok");
  return true;
}

// ---------- import: analysis (pure function; all validation lives here) ----------
// Which vault credentials an action from a pack wants to inject into its request. A {{secret.ID}}
// token works INDEPENDENTLY of credId — restResolve expands it straight from the vault — and
// credential ids are sequential (s1, s2, …), so the author of a foreign pack can simply guess them
// while knowing nothing about the victim. Such a token in an imported pack is therefore always a
// warning that requires explicit confirmation.
function _ra5SecretIds(row){
  const out=[];
  const add=function(v){
    const t=_ra5Str(v);
    if(!t||t.indexOf("{{")<0)return;
    RA5_SECRET_TOKEN.lastIndex=0;
    let m;
    while((m=RA5_SECRET_TOKEN.exec(t))!==null){
      const lab="{{secret."+_ra5Str(m[1],40).trim()+"}}";
      if(out.length<8&&out.indexOf(lab)<0)out.push(lab);
    }
  };
  add(row&&row.path);add(row&&row.body);
  for(const p of ((row&&row.query)||[])){add(p[0]);add(p[1]);}
  for(const p of ((row&&row.headers)||[])){add(p[0]);add(p[1]);}
  return out;
}
// {{var.*}} in a pack closes the same exfiltration path: the export note tells the user to fill the
// values into "Variables", so an imported pack reading them must be flagged just like a secret token.
function _ra5VarIds(row){
  const out=[];const re=/\{\{\s*var\.([^}|\s]{1,60})/g;
  const add=function(v){const t=_ra5Str(v);if(!t||t.indexOf("{{")<0)return;
    re.lastIndex=0;let m;
    while((m=re.exec(t))!==null){const lab="{{var."+_ra5Str(m[1],40).trim()+"}}";
      if(out.length<8&&out.indexOf(lab)<0)out.push(lab);}};
  add(row&&row.path);add(row&&row.body);
  for(const p of ((row&&row.query)||[])){add(p[0]);add(p[1]);}
  for(const p of ((row&&row.headers)||[])){add(p[0]);add(p[1]);}
  return out;
}
function restPackAnalyze(raw,api){
  const res={ok:false,error:"",warnings:[],info:[],rows:[],total:0,dropped:0,risky:0,warnRows:0,
             apiName:"",baseUrlHint:"",note:"",capacity:RA5_MAX_ACTIONS,
             trigs:[],trigOff:0,trigDropped:0,trigCapacity:RA5_MAX_TRIG};
  if(typeof raw==="string"){
    if(raw.length>RA5_MAX_FILE){
      res.error=_ra5T("Plik jest za duży jak na paczkę akcji.","The file is too large for an action pack.");
      return res;
    }
    try{raw=JSON.parse(raw);}
    catch(e){res.error=_ra5T("To nie jest poprawny plik JSON.","This is not valid JSON.");return res;}
  }
  if(!raw||typeof raw!=="object"||Array.isArray(raw)){
    res.error=_ra5T("Plik nie zawiera paczki akcji.","The file does not contain an action pack.");
    return res;
  }
  if(raw.app==null)
    res.warnings.push(_ra5T("Plik nie ma oznaczenia aplikacji — sprawdź, skąd pochodzi.",
                            "The file has no application marker — check where it came from."));
  else if(String(raw.app)!==RA5_PACK_APP){
    res.error=_ra5T("Ten plik nie pochodzi z RibbitFlip.","This file does not come from RibbitFlip.");
    return res;
  }
  if(String(raw.kind||"")!==RA5_PACK_KIND){
    res.error=_ra5T("To nie jest paczka akcji REST (inny rodzaj pliku).",
                    "This is not a REST action pack (a different kind of file).");
    return res;
  }
  const ver=parseInt(raw.version,10);
  if(!isFinite(ver)||ver<1)
    res.warnings.push(_ra5T("Paczka nie ma numeru wersji — wczytam ją zachowawczo.",
                            "The pack has no version number — I will load it conservatively."));
  else if(ver>RA5_PACK_VER)
    res.warnings.push(_ra5T("Paczka pochodzi z nowszej wersji RibbitFlip — nieznane pola pominę.",
                            "The pack comes from a newer RibbitFlip — I will skip unknown fields."));
  const list=Array.isArray(raw.actions)?raw.actions:null;
  if(!list||!list.length){
    res.error=_ra5T("Paczka nie zawiera żadnych akcji.","The pack contains no actions.");
    return res;
  }
  res.total=list.length;
  const meta=(raw.api&&typeof raw.api==="object"&&!Array.isArray(raw.api))?raw.api:{};
  res.apiName=_ra5Str(meta.name,80);
  res.baseUrlHint=_ra5Str(meta.baseUrlHint,500);
  res.note=_ra5Str(meta.note,300);
  const host=_ra5Host(api&&api.baseUrl);
  res.capacity=Math.max(0,RA5_MAX_ACTIONS-((api&&Array.isArray(api.actions))?api.actions.length:0));

  let credSeen=false;
  // `packIdx` is carried on every row because the movements point at their action BY INDEX into the
  // pack's own array, while `res.rows` skips malformed entries — so row position and pack position
  // drift apart the moment anything is dropped, and a movement would end up wired to its neighbour.
  const slice=list.slice(0,RA5_MAX_ACTIONS);
  for(let pi=0;pi<slice.length;pi++){
    const a=slice[pi];
    if(!a||typeof a!=="object"||Array.isArray(a)){res.dropped++;continue;}
    if(a.credId)credSeen=true;                               // a credId inside a pack is IGNORED, only reported
    const row={
      packIdx:pi,
      name:_ra5Str(a.name,80)||_ra5T("Akcja","Action"),
      desc:_ra5Str(a.desc,200),
      method:_ra5Method(a.method),
      path:_ra5Str(a.path,1000),
      query:_ra5Pairs(a.query),
      headers:_ra5Pairs(a.headers),
      bodyType:_ra5BodyType(a.bodyType),
      body:_ra5Str(a.body,20000),
      requestType:_ra5Str(a.requestType,64),
      warn:[],risky:false,
      // Nie każde ostrzeżenie ma rozbrajać ruch: „ustaw poświadczenie w sejfie” to uwaga
      // wdrożeniowa, a nie powód, dla którego żądanie miałoby pójść nie tam, gdzie trzeba.
      armBlock:false
    };
    // Test the TRIMMED path: a leading space, tab or BOM defeats the regex's ^https? anchor while
    // the send path trims anyway, so an untrimmed check let a request reach a foreign host with NO
    // warning in this dialog. Separately, a path containing {{…}} can smuggle a full address that
    // only materializes at send time, so flag every such path as risky.
    const pTrim=row.path.trim();
    if(/\{\{/.test(row.path)){
      row.warn.push(_ra5T("ścieżka zawiera {{…}} — jej ostateczny adres powstanie dopiero przy wysyłce i może wskazać obcy serwer",
                          "the path contains {{…}} — its final address is resolved at send time and may point at a foreign server"));
      row.risky=true;row.armBlock=true;
    }
    if(RA5_ABS_URL.test(pTrim)){
      const h2=_ra5Host(pTrim);
      if(host&&h2&&!_ra5SameHost(h2,host)){
        row.warn.push(_ra5T("ścieżka prowadzi na INNY host niż adres bazowy tej aplikacji: "+h2,
                            "the path points at a host DIFFERENT from this application's base URL: "+h2));
        row.risky=true;row.armBlock=true;
      }else if(!host&&h2){
        // An empty base URL is the NORMAL state of a fresh application (and of a v1→v2 migration).
        // Having no reference point must NOT silence the warning: an absolute path beats the base
        // URL at send time regardless, so the request will go EXACTLY there.
        row.warn.push(_ra5T("ścieżka wskazuje pełny adres serwera: "+h2+" — to tam pójdzie wysyłka",
                            "the path points at a full server address: "+h2+" — that is where the request will go"));
        row.risky=true;row.armBlock=true;
      }
    }else if(RA5_ANY_SCHEME.test(pTrim)){
      row.warn.push(_ra5T("ścieżka używa protokołu innego niż http/https — wysyłka zostanie odrzucona",
                          "the path uses a protocol other than http/https — sending will be rejected"));
      row.risky=true;row.armBlock=true;
    }
    for(const p of row.headers){
      if(RA5_AUTH_HDR.test(_ra5Str(p[0]).trim())){
        row.warn.push(_ra5T("paczka próbuje ustawić nagłówek autoryzacji — usuń go i użyj sejfu",
                            "the pack tries to set an authorization header — remove it and use the vault"));
        row.risky=true;
      }
    }
    const sec=_ra5SecretIds(row);
    if(sec.length){
      row.warn.push(_ra5T("akcja wstawia wartość z Twojego sejfu ("+sec.join(", ")+") — po imporcie "+
                          "wyszłaby jawnym tekstem pod adres z tej paczki",
                          "the action inserts a value from your vault ("+sec.join(", ")+") — after importing "+
                          "it would be sent in plain text to the address from this pack"));
      row.risky=true;row.armBlock=true;
    }
    const vids=_ra5VarIds(row);
    if(vids.length){
      row.warn.push(_ra5T("akcja czyta Twoje „Zmienne” ("+vids.join(", ")+") — jeśli trzymasz tam wartości wrażliwe, "+
                          "po imporcie wyszłyby pod adres z tej paczki",
                          "the action reads your “Variables” ("+vids.join(", ")+") — if you keep sensitive values there, "+
                          "after importing they would be sent to the address from this pack"));
      row.risky=true;row.armBlock=true;
    }
    if(row.risky)res.risky++;
    if(row.warn.length)res.warnRows++;
    res.rows.push(row);
  }
  if(list.length>RA5_MAX_ACTIONS)
    res.warnings.push(_ra5T("Paczka ma więcej niż "+RA5_MAX_ACTIONS+" akcji — wczytam pierwsze "+RA5_MAX_ACTIONS+".",
                            "The pack has more than "+RA5_MAX_ACTIONS+" actions — I will load the first "+RA5_MAX_ACTIONS+"."));
  if(res.dropped)
    res.warnings.push(_ra5T("Pominięto "+res.dropped+" "+_ra5Pl(res.dropped,"pozycję","pozycje","pozycji")+" o złym formacie.",
                            "Skipped "+res.dropped+" malformed item(s)."));
  if(credSeen)
    res.info.push(_ra5T("Paczka wskazuje poświadczenia — zostaną pominięte. Poświadczenie wybierzesz sam w ustawieniach aplikacji.",
                        "The pack references credentials — they will be skipped. You pick the credential yourself in the application settings."));
  if(!res.rows.length){
    res.error=_ra5T("Żadnej akcji z tej paczki nie da się wczytać.","No action from this pack can be loaded.");
    return res;
  }
  if(res.capacity<res.rows.length)
    res.warnings.push(_ra5T("W tej aplikacji zmieści się jeszcze "+res.capacity+" "+
                            _ra5Pl(res.capacity,"akcja","akcje","akcji")+" — resztę pominę.",
                            "This application has room for "+res.capacity+" more action(s) — I will skip the rest."));

  // ---- movements (v2 packs). A v1 pack simply has none, and that is not an error.
  res.trigCapacity=Math.max(0,RA5_MAX_TRIG-((api&&Array.isArray(api.triggers))?api.triggers.length:0));
  const byPackIdx=Object.create(null);
  for(let i=0;i<res.rows.length;i++)byPackIdx[res.rows[i].packIdx]=i;
  for(const t of (Array.isArray(raw.triggers)?raw.triggers:[]).slice(0,RA5_MAX_TRIG)){
    if(!t||typeof t!=="object"||Array.isArray(t)){res.trigDropped++;continue;}
    const rowIdx=byPackIdx[_ra5Int(t.actionIdx,0,RA5_MAX_ACTIONS,-1)];
    if(rowIdx==null){res.trigDropped++;continue;}             // its action did not survive the checks above
    const row=res.rows[rowIdx];
    const s=(t.src&&typeof t.src==="object"&&!Array.isArray(t.src))?t.src:{};
    const motion=(s.kind==="motion");
    const g={rowIdx:rowIdx,actionName:row.name,label:_ra5Str(t.label,60),
             minIntervalMs:_ra5Int(t.minIntervalMs,0,3600000,250),
             kind:motion?"motion":"rule",why:""};
    if(motion)Object.assign(g,_ra5Motion(s));    // ten sam spis pól, co przy eksporcie
    const to=(t.toast&&typeof t.toast==="object")?t.toast:null;
    g.toast=(to&&to.on)?{on:true,mode:(to.mode==="active"?"active":"fire"),
                         silent:(to.silent!==false),text:_ra5Str(to.text,120)}:null;
    // Two reasons a movement arrives SWITCHED OFF, and both are about not doing something on the
    // importer's behalf that they never asked for:
    //  • a rule-kind movement lost the Mapping rule it named at export, so here it would mean
    //    "any rule", i.e. fire this request on everything the person has mapped,
    //  • an action whose review above says the request could go somewhere it should not, or could
    //    carry the importer's own secrets (foreign host, {{…}} in the path, a vault or variable
    //    token) must never end up armed to a body movement — that is a request leaving the machine
    //    on a tilt of the wrist, decided by a file.
    // NOT among those reasons: "the pack sets an authorization header". Every pack this app exports
    // trips that one, because the export blanks the header VALUE and leaves its NAME as a hint about
    // how the API authenticates. Disarming on it meant an ordinary, honest Spotify pack arrived with
    // every movement switched off, which is the feature not working rather than the feature being
    // careful. It is a setup note, so it warns and nothing more.
    if(!motion){g.on=false;g.why="rule";}
    else if(row.armBlock){g.on=false;g.why="risky";}
    else g.on=(t.on!==false);
    if(!g.on)res.trigOff++;
    res.trigs.push(g);
  }
  if(res.trigDropped)
    res.warnings.push(_ra5T("Pominięto "+res.trigDropped+" "+_ra5Pl(res.trigDropped,"ruch","ruchy","ruchów")+
                            " — wskazywały akcję, której nie wczytuję.",
                            "Skipped "+res.trigDropped+" movement(s) — they pointed at an action I am not loading."));
  if(res.trigs.length>res.trigCapacity)
    res.warnings.push(_ra5T("W tej aplikacji zmieści się jeszcze "+res.trigCapacity+" "+
                            _ra5Pl(res.trigCapacity,"ruch","ruchy","ruchów")+" — resztę pominę.",
                            "This application has room for "+res.trigCapacity+" more movement(s) — I will skip the rest."));
  res.ok=true;
  return res;
}

// A movement written out the way a person would say it: "Tilt above 30°, held for a time → Next
// track, no more often than every 250 ms". Falls back to the raw source name when rf-37 is absent
// (the ?view=overview cheat sheet loads a subset of the files).
function _ra5TrigLabel(g){
  const own=_ra5Str(g.label,60).trim();
  const act=" → "+(g.actionName||"?");
  const rate=(g.minIntervalMs?(_ra5T(", nie częściej niż co ",", no more often than every ")+g.minIntervalMs+" ms"):"");
  if(own)return own+act+rate;            // autor nazwał ten ruch — jego słowa są lepsze od naszego opisu
  if(g.kind!=="motion")
    return _ra5T("Reguła z Mapowania","A rule from Mapping")+act+rate;
  // Opis warunku składamy TĄ SAMĄ funkcją, którą rysuje go panel (`_ra4MotionLabel`) — inaczej
  // podgląd importu i wiersz wyzwalacza po imporcie mówiłyby o jednej rzeczy dwoma zdaniami,
  // a przy zakresie, |x| i NIE ten drugi opis byłby po prostu nieprawdziwy.
  let cond="";
  try{if(typeof _ra4MotionLabel==="function")cond=_ra4MotionLabel(g);}catch(e){}
  if(!cond)cond=String(g.source||"?")+" "+String(g.cmp||">")+" "+_ra5Num(g.threshold,0);
  let mode="";
  const m=String(g.mode||"");
  if(m==="dwell")mode=_ra5T(", utrzymane "+g.dwellMs+" ms",", held for "+g.dwellMs+" ms");
  else if(m==="while"||m==="continuous")mode=_ra5T(", cyklicznie póki spełnione",", repeatedly while met");
  else if(m==="multi")mode=_ra5T(", "+g.crossings+"× w "+g.windowMs+" ms",", "+g.crossings+"× within "+g.windowMs+" ms");
  else if(m==="taps")mode=_ra5T(", dokładnie "+g.crossings+" puknięć w "+g.windowMs+" ms",
                                ", exactly "+g.crossings+" taps within "+g.windowMs+" ms");
  return cond+mode+act+rate;
}
function _ra5UniqName(taken,name){
  const base=_ra5Str(name,80)||_ra5T("Akcja","Action");
  if(!taken.has(base))return base;
  for(let i=2;i<200;i++){
    const sfx=" ("+i+")";
    const cand=(base.length+sfx.length>80?base.slice(0,80-sfx.length):base)+sfx;
    if(!taken.has(cand))return cand;
  }
  return base.slice(0,74)+" (…)";
}
function _ra5TakenNames(api){
  const s=new Set();
  for(const a of ((api&&Array.isArray(api.actions))?api.actions:[]))if(a)s.add(_ra5Str(a.name,80));
  return s;
}
// `ids` comes back aligned with `rows` (empty string where a row was skipped). The movements are
// wired from it: they arrive pointing at a pack INDEX and have to end up pointing at the action id
// this merge just minted, and nothing else in the config knows that correspondence.
function restPackMerge(api,rows){      // append actions to an API's library; a name collision gets a numeric suffix
  const res={added:0,skipped:0,names:[],ids:[]};
  if(!api||typeof api!=="object"||!Array.isArray(rows))return res;
  if(!Array.isArray(api.actions))api.actions=[];
  const taken=_ra5TakenNames(api);
  for(const r of rows){
    if(!r||typeof r!=="object"){res.skipped++;res.ids.push("");continue;}
    if(api.actions.length>=RA5_MAX_ACTIONS){res.skipped++;res.ids.push("");continue;}
    const name=_ra5UniqName(taken,r.name);
    taken.add(name);
    const nid=_ra5NewId("c");
    res.ids.push(nid);
    const na={
      id:nid,
      name:name,
      desc:_ra5Str(r.desc,200),
      method:_ra5Method(r.method),
      path:_ra5Str(r.path,1000),
      query:_ra5Pairs(r.query),
      headers:_ra5Pairs(r.headers),
      bodyType:_ra5BodyType(r.bodyType),
      body:_ra5Str(r.body,20000),
      credId:""                                              // a credential NEVER comes from a pack
    };
    // An OBS action, carried so a shared OBS pack survives the round trip. It is NOT written when
    // empty: an HTTP action does not have one, and a field spelled out as "" would be a claim.
    const nrt=_ra5Str(r.requestType,64);
    if(nrt)na.requestType=nrt;
    api.actions.push(na);
    res.added++;res.names.push(name);
  }
  return res;
}

// Wire the movements onto the actions that restPackMerge just created. `on` is preserved for an
// ordinary motion movement, and that is deliberate: a movement is configuration INSIDE the group,
// like a Mapping rule, not the group's own switch. The switch that decides whether anything actually
// leaves this machine — automatic sending — stays exactly where the user left it, and the request
// cannot succeed anyway until they put a credential in the vault. What does NOT arrive armed is
// spelled out in restPackAnalyze: rule-kind movements and anything hanging off a flagged action.
function restTrigMerge(api,trigs,ids){
  const res={added:0,off:0,skipped:0};
  if(!api||typeof api!=="object"||!Array.isArray(trigs))return res;
  if(!Array.isArray(api.triggers))api.triggers=[];
  for(const g of trigs){
    if(!g||typeof g!=="object"){res.skipped++;continue;}
    if(api.triggers.length>=RA5_MAX_TRIG){res.skipped++;continue;}
    const aid=(Array.isArray(ids)&&g.rowIdx!=null)?ids[g.rowIdx]:"";
    if(!aid){res.skipped++;continue;}                        // its action was skipped by the merge
    const motion=(g.kind==="motion");
    const t={
      id:_ra5NewId("g"),
      actionId:aid,
      on:!!g.on,
      label:_ra5Str(g.label,60),
      minIntervalMs:_ra5Int(g.minIntervalMs,0,3600000,250),
      toast:{on:!!(g.toast&&g.toast.on),
             mode:((g.toast&&g.toast.mode==="active"&&motion)?"active":"fire"),
             silent:!(g.toast&&g.toast.silent===false),
             text:_ra5Str(g.toast&&g.toast.text,120)},
      // "any" on both counts, and it is the only honest answer: the pack never carried a capsule
      // slot or a rule id, because neither means anything outside the machine it came from.
      src:motion
        ? Object.assign({kind:"motion",dev:"any"},_ra5Motion(g))
        : {kind:"rule",dev:"any",ruleId:"any"}
    };
    // The engine's own repair pass has the last word on shape — the same one every trigger reaching
    // it by another route goes through, so an odd pack cannot invent a state the engine has not seen.
    try{if(typeof _ra4Fix==="function")_ra4Fix(t);}catch(e){}
    api.triggers.push(t);
    res.added++;
    if(!t.on)res.off++;
  }
  return res;
}

// ---------- shared modal shell (pack preview, template list): backdrop, Escape, focus trap ----------
function _ra5Modal(id,boxCls,labelledBy){
  const old=document.getElementById(id);
  if(old)old.remove();
  const ov=document.createElement("div");
  ov.id=id;ov.className="ra-modal";
  const box=document.createElement("div");
  box.className=boxCls;
  box.setAttribute("role","dialog");
  box.setAttribute("aria-modal","true");
  if(labelledBy)box.setAttribute("aria-labelledby",labelledBy);
  ov.appendChild(box);
  document.body.appendChild(ov);
  const close=function(){
    document.removeEventListener("keydown",key,true);
    try{
      if(window.rfmClose)window.rfmClose(ov,function(){try{ov.remove();}catch(e){}});
      else ov.remove();
    }catch(e){try{ov.remove();}catch(e2){}}
  };
  const key=function(ev){
    if(ev.key==="Escape"){ev.preventDefault();close();return;}
    if(ev.key!=="Tab")return;
    const f=box.querySelectorAll('button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]');
    if(!f.length)return;
    const first=f[0],last=f[f.length-1];
    if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}
    else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}
  };
  ov.addEventListener("click",function(ev){if(ev.target===ov)close();});
  document.addEventListener("keydown",key,true);
  try{if(window.rfmReopen)window.rfmReopen(ov);}catch(e){}
  return {ov:ov,box:box,close:close};
}
function _ra5MetChip(method){
  const s=document.createElement("span");
  s.className="ra-met";s.textContent=_ra5Method(method);s.dataset.m=_ra5Method(method);
  return s;
}

// ---------- import: the preview dialog shown BEFORE anything is imported ----------
function _ra5PackModal(a,api){
  // Warnings are counted per ROW, not from `a.risky` alone. When the red border, the blocking
  // "I understand the warnings" checkbox and the header counter all hung off `a.risky`, a row that
  // carried a warning could still produce a "1 action · 0 warnings" header and an enabled button.
  const _warnRows=(typeof a.warnRows==="number")?a.warnRows
    :((a.rows||[]).filter(function(r){return r&&r.warn&&r.warn.length;}).length);
  const _flag=Math.max(a.risky|0,_warnRows|0);
  const m=_ra5Modal("raPack","ra-pk-box","raPkTitle");
  const head=document.createElement("div");
  head.className="ra-pk-head";
  const h=document.createElement("h3");
  h.id="raPkTitle";
  h.textContent=_ra5T("Import paczki akcji","Import an action pack");
  head.appendChild(h);
  const sum=document.createElement("span");
  sum.className="ra-pk-sum";
  sum.textContent=_ra5T(a.rows.length+" "+_ra5Pl(a.rows.length,"akcja","akcje","akcji")+" · "+
                        _flag+" "+_ra5Pl(_flag,"ostrzeżenie","ostrzeżenia","ostrzeżeń"),
                        a.rows.length+" action(s) · "+_flag+" warning(s)");
  head.appendChild(sum);
  m.box.appendChild(head);

  const src=document.createElement("div");
  src.className="ra-pk-src";
  const bits=[];
  if(a.apiName)bits.push(_ra5T("z paczki: ","from pack: ")+a.apiName);
  if(a.baseUrlHint)bits.push(_ra5T("adres w paczce: ","address in pack: ")+a.baseUrlHint);
  bits.push(_ra5T("dodaję do: ","adding to: ")+(_ra5Str(api&&api.name,80)||_ra5T("(bez nazwy)","(unnamed)")));
  src.textContent=bits.join(" · ");
  m.box.appendChild(src);
  if(a.note){
    const nt=document.createElement("div");
    nt.className="ra-pk-note";nt.textContent=a.note;
    m.box.appendChild(nt);
  }

  if(_flag){
    const w=document.createElement("div");
    w.className="ra-pk-warn";
    w.textContent=_ra5T("⚠️ Sprawdź zaznaczone wiersze. Paczka to zwykły plik JSON, ale potrafi wskazać obcy "+
                        "serwer albo podstawić własny nagłówek autoryzacji. Importuj tylko z zaufanego źródła.",
                        "⚠️ Check the highlighted rows. A pack is plain JSON, but it can point at a foreign server "+
                        "or set its own authorization header. Import only from a source you trust.");
    m.box.appendChild(w);
  }
  for(const t of a.warnings){
    const w=document.createElement("div");
    w.className="ra-pk-note ra-pk-alert";w.textContent="⚠ "+t;
    m.box.appendChild(w);
  }
  for(const t of a.info){
    const w=document.createElement("div");
    w.className="ra-pk-note";w.textContent="ℹ " + t;
    m.box.appendChild(w);
  }

  const list=document.createElement("div");
  list.className="ra-pk-list";
  const taken=_ra5TakenNames(api);
  let room=a.capacity;
  for(const r of a.rows){
    const row=document.createElement("div");
    row.className="ra-pk-row"+((r.risky||(r.warn&&r.warn.length))?" bad":"");
    const top=document.createElement("div");
    top.className="ra-pk-top";
    top.appendChild(_ra5MetChip(r.method));
    const nm=document.createElement("b");
    nm.className="ra-pk-name";
    const finalName=(room>0)?_ra5UniqName(taken,r.name):r.name;
    if(room>0)taken.add(finalName);
    nm.textContent=finalName;
    top.appendChild(nm);
    if(finalName!==r.name&&room>0){
      const ren=document.createElement("span");
      ren.className="ra-pk-ren";
      ren.textContent=_ra5T("(nazwa zajęta — zmieniam)","(name taken — renaming)");
      top.appendChild(ren);
    }
    if(room<=0){
      const sk=document.createElement("span");
      sk.className="ra-pk-ren";
      sk.textContent=_ra5T("(brak miejsca — pominę)","(no room — will skip)");
      top.appendChild(sk);
    }
    const bt=document.createElement("span");
    bt.className="ra-pk-bt";
    bt.textContent=r.bodyType;
    top.appendChild(bt);
    row.appendChild(top);
    const pt=document.createElement("div");
    pt.className="ra-pk-path";
    pt.textContent=r.path||"/";
    row.appendChild(pt);
    // Query parameters, headers and body: without them the user could not see what the pack really
    // sends — a {{secret.…}} token hidden in `query` was invisible here, and the request preview
    // would later mask it anyway. This dialog deliberately shows the values exactly as they sit in
    // the file, because judging whether to trust the pack is the whole point of it.
    const _det=function(txt){
      const d=document.createElement("div");
      d.className="ra-pk-path";
      d.textContent=_ra5Str(txt,300);
      row.appendChild(d);
    };
    for(const p of (r.query||[])) _det("? "+_ra5Str(p[0],80)+" = "+_ra5Str(p[1],160));
    for(const p of (r.headers||[])) _det("⇥ "+_ra5Str(p[0],80)+": "+_ra5Str(p[1],160));
    if(r.bodyType!=="none"&&_ra5Str(r.body).trim()) _det("≡ "+_ra5Str(r.body,240).replace(/\s+/g," "));
    if(r.desc){
      const d=document.createElement("div");
      d.className="ra-pk-desc";d.textContent=r.desc;
      row.appendChild(d);
    }
    for(const wtxt of r.warn){
      const w=document.createElement("div");
      w.className="ra-pk-why";w.textContent="⚠ "+wtxt;
      row.appendChild(w);
    }
    list.appendChild(row);
    room--;
  }
  m.box.appendChild(list);

  // The movements, listed the way a person would say them. They belong in this dialog for the same
  // reason the request body does: what arrives is not just "some HTTP calls" but "your wrist now
  // fires them", and that is the part somebody should be able to read before agreeing to it.
  if(a.trigs&&a.trigs.length){
    const th=document.createElement("div");
    th.className="ra-pk-note";
    th.textContent=_ra5T("Gotowe ruchy w paczce ("+a.trigs.length+"):",
                         "Ready-made movements in the pack (" + a.trigs.length + "):");
    m.box.appendChild(th);
    const tl=document.createElement("div");
    tl.className="ra-pk-list ra-pk-trigs";
    let troom=a.trigCapacity;
    for(const g of a.trigs){
      const row=document.createElement("div");
      row.className="ra-pk-row"+(g.on?"":" off");
      const top=document.createElement("div");
      top.className="ra-pk-top";
      const nm=document.createElement("b");
      nm.className="ra-pk-name";
      nm.textContent=_ra5TrigLabel(g);
      top.appendChild(nm);
      if(troom<=0){
        const sk=document.createElement("span");
        sk.className="ra-pk-ren";
        sk.textContent=_ra5T("(brak miejsca — pominę)","(no room — will skip)");
        top.appendChild(sk);
      }
      row.appendChild(top);
      if(!g.on){
        const w=document.createElement("div");
        w.className="ra-pk-why";
        w.textContent="⚠ "+(g.why==="risky"
          ? _ra5T("wczytam wyłączony: jego akcja jest wyżej oznaczona ostrzeżeniem, a ruch ciała nie ma jej uzbrajać za Ciebie",
                  "arrives switched off: its action is flagged above, and a body movement is not going to arm it for you")
          : _ra5T("wczytam wyłączony: reagował na konkretną regułę Mapowania autora, której u Ciebie nie ma. Wskaż własną regułę i włącz go sam",
                  "arrives switched off: it responded to one specific Mapping rule of the author's, which you do not have. Point it at a rule of yours and switch it on yourself"));
        row.appendChild(w);
      }
      if(g.toast&&g.toast.on&&g.toast.text){
        const d=document.createElement("div");
        d.className="ra-pk-desc";
        d.textContent=_ra5T("powiadomienie: ","notification: ")+g.toast.text;
        row.appendChild(d);
      }
      tl.appendChild(row);
      troom--;
    }
    m.box.appendChild(tl);
    const tn=document.createElement("div");
    tn.className="ra-pk-note";
    tn.textContent=_ra5T("Ruchy nie wysyłają niczego, dopóki nie ustawisz poświadczenia w sejfie, a "+
                         "automatyczna wysyłka zostaje tam, gdzie ją masz — paczka jej nie włącza.",
                         "The movements send nothing until you set a credential in the vault, and automatic "+
                         "sending stays where you have it — a pack does not switch it on.");
    m.box.appendChild(tn);
  }

  const act=document.createElement("div");
  act.className="ra-pk-act";
  let ackBox=null;
  if(_flag){
    const lab=document.createElement("label");
    lab.className="ra-pk-ack";
    ackBox=document.createElement("input");
    ackBox.type="checkbox";
    lab.appendChild(ackBox);
    lab.appendChild(document.createTextNode(
      _ra5T("Rozumiem ostrzeżenia — ufam źródłu tej paczki","I understand the warnings — I trust the source of this pack")));
    m.box.appendChild(lab);
  }
  const cancel=_ra5Btn(_ra5T("Anuluj","Cancel"),"sm",null,function(){m.close();});
  const okN=Math.min(a.rows.length,a.capacity);
  const okG=Math.min((a.trigs||[]).length,a.trigCapacity||0);
  const go=_ra5Btn(_ra5T("⬇ Importuj "+okN+" "+_ra5Pl(okN,"akcję","akcje","akcji")+
                         (okG?(" i "+okG+" "+_ra5Pl(okG,"ruch","ruchy","ruchów")):""),
                         "⬇ Import "+okN+" action(s)"+(okG?(" and "+okG+" movement(s)"):"")),
    "sm primary",null,function(){
      if(go.disabled)return;
      m.close();
      const r=restPackMerge(api,a.rows);
      const g=restTrigMerge(api,a.trigs,r.ids);
      _ra5Save();
      _ra5RepaintApi(api.id);
      try{restRenderVars();}catch(e){}
      if(r.added)_ra5Toast(_ra5T("Dodano "+r.added+" "+_ra5Pl(r.added,"akcję","akcje","akcji")+
                                 (g.added?(" i "+g.added+" "+_ra5Pl(g.added,"ruch","ruchy","ruchów")+
                                           (g.off?(" ("+g.off+" wyłączone)"):"")):"")+
                                 (r.skipped?(", pominięto "+r.skipped):"")+".",
                                 "Added "+r.added+" action(s)"+
                                 (g.added?(" and "+g.added+" movement(s)"+(g.off?(" ("+g.off+" switched off)"):"")):"")+
                                 (r.skipped?(", skipped "+r.skipped):"")+"."),"ok");
      else _ra5Toast(_ra5T("Nie dodano żadnej akcji.","No action was added."),"danger");
    });
  if(ackBox){
    go.disabled=true;
    ackBox.addEventListener("change",function(){go.disabled=!ackBox.checked;});
  }
  if(!okN)go.disabled=true;
  act.appendChild(cancel);act.appendChild(go);
  m.box.appendChild(act);
  try{cancel.focus();}catch(e){}
  return m;
}
function _ra5FileInput(){              // ONE hidden input for the whole module, so cancelling leaves no orphans behind
  let inp=document.getElementById("raPackFile");
  if(inp)return inp;
  inp=document.createElement("input");
  inp.type="file";inp.id="raPackFile";
  inp.accept=".json,application/json";
  inp.style.position="fixed";inp.style.left="-9999px";inp.style.width="1px";inp.style.height="1px";
  inp.setAttribute("aria-hidden","true");inp.tabIndex=-1;
  document.body.appendChild(inp);
  inp.addEventListener("change",function(){
    const f=inp.files&&inp.files[0];
    const api=_ra5Api(_ra5ImportApiId);
    inp.value="";
    if(!f)return;
    if(!api){_ra5Say(_ra5T("Aplikacja zniknęła w trakcie wyboru pliku.","The application disappeared while the file was being picked."));return;}
    if(f.size>RA5_MAX_FILE){
      _ra5Say(_ra5T("Ten plik jest za duży jak na paczkę akcji (limit 1 MB).",
                    "This file is too large for an action pack (1 MB limit)."));
      return;
    }
    const fr=new FileReader();
    fr.onerror=function(){_ra5Say(_ra5T("Nie udało się odczytać pliku.","Could not read the file."));};
    fr.onload=function(){
      const a=restPackAnalyze(String(fr.result==null?"":fr.result),api);
      if(!a.ok){_ra5Say(a.error||_ra5T("Nie udało się wczytać paczki.","Could not load the pack."));return;}
      _ra5PackModal(a,api);
    };
    try{fr.readAsText(f);}
    catch(e){_ra5Say(_ra5T("Nie udało się odczytać pliku.","Could not read the file."));}
  });
  return inp;
}
// The same import, for bytes that did not come off a disk — the link importer fetches a pack from
// a forum post and hands the text over here. One entry point, so the review modal (which drops
// malformed rows and refuses to arm a movement onto a flagged action) cannot be bypassed by the
// newer route.
function restImportPackText(api,raw){
  if(!api||typeof api!=="object"){
    _ra5Say(_ra5T("Nie wiem, do której aplikacji zaimportować paczkę.","I do not know which application to import into."));
    return false;
  }
  const a=restPackAnalyze(String(raw==null?"":raw),api);
  if(!a.ok){_ra5Say(a.error||_ra5T("Nie udało się wczytać paczki.","Could not load the pack."));return false;}
  _ra5PackModal(a,api);
  return true;
}
function restImportPack(api){
  if(!api||typeof api!=="object"){
    _ra5Say(_ra5T("Nie wiem, do której aplikacji zaimportować paczkę.","I do not know which application to import into."));
    return;
  }
  _ra5ImportApiId=_ra5Str(api.id,40);
  const inp=_ra5FileInput();
  if(!inp)return;
  inp.value="";
  try{inp.click();}catch(e){}
}
// ---------- the same import, for a pack that arrived from somewhere other than an application card
// A pack file says what it IS but not where it GOES: "which application" is not written in it. That
// used to make it the one kind of file the app could recognise and then refuse — dropped on the
// window it produced a toast telling you to go and do it somewhere else. So the module answers the
// question itself: it asks only when the answer is not obvious (one application is not a choice),
// and when there is nothing to choose FROM it says so with the name of the button that fixes it.
// The application does NOT have to hold actions already — a pack adds to it.
function _ra5Tab(){try{if(window.setTabById)window.setTabById("restapi");}catch(e){}}
function restImportPackFile(file){
  if(!file)return false;
  if(file.size>RA5_MAX_FILE){
    _ra5Say(_ra5T("Ten plik jest za duży jak na paczkę akcji (limit 1 MB).",
                  "This file is too large for an action pack (1 MB limit)."));
    return false;
  }
  const fr=new FileReader();
  fr.onerror=function(){_ra5Say(_ra5T("Nie udało się odczytać pliku.","Could not read the file."));};
  fr.onload=function(){_ra5PackToApi(String(fr.result==null?"":fr.result));};
  try{fr.readAsText(file);}
  catch(e){_ra5Say(_ra5T("Nie udało się odczytać pliku.","Could not read the file."));return false;}
  return true;
}
function _ra5PackToApi(text){
  const apis=_ra5Apis().filter(function(a){return a&&a.id;});
  // The tab switch is part of the answer, not decoration: whatever happens next — a review modal,
  // a chooser, or a message naming a button — happens on this tab, and the person got here from
  // somewhere else entirely.
  _ra5Tab();
  if(!apis.length){
    // rfToast rather than _ra5Say: this is a missing prerequisite with a named next move, and it
    // has to stay up long enough to read two button names off it.
    try{if(typeof rfToast==="function")rfToast(
      _ra5T("Najpierw dodaj aplikację na ekranie Usługi sieciowe: przycisk „Dodaj API” albo „Z szablonu”.",
            "Add an application on the Network services screen first: the “Add API” or “From a template” button."),
      {tone:"danger",ms:7000});}catch(e){}
    return;
  }
  if(apis.length===1){restImportPackText(apis[0],text);return;}
  _ra5PickApiModal(apis,function(api){restImportPackText(api,text);});
}
let _ra5PickClose=null;                // the open chooser, so a second file cannot stack two of them
// WHICH application takes the pack. Same felt chrome and the same keyboard contract as the other
// exchange windows (rfk-*: Escape closes, Tab stays inside, the backdrop is a way out), because
// this is a step in that journey — not a REST dialog that looks different for no reason.
function _ra5PickApiModal(apis,onPick){
  try{if(_ra5PickClose)_ra5PickClose();}catch(e){}
  const prev=document.activeElement;
  const back=document.createElement("div");
  back.className="rfk-back";back.setAttribute("role","presentation");
  const card=document.createElement("div");
  card.className="rfk-card";
  card.setAttribute("role","dialog");card.setAttribute("aria-modal","true");
  const ttl=_ra5T("Do której aplikacji wczytać paczkę?","Which application should take the pack?");
  card.setAttribute("aria-label",ttl);

  const head=document.createElement("div");head.className="rfk-head";
  const h=document.createElement("h3");h.className="rfk-title";h.textContent=ttl;
  const x=document.createElement("button");x.type="button";x.className="rfk-x";
  x.setAttribute("aria-label",_ra5T("Zamknij","Close"));x.textContent="×";
  head.appendChild(h);head.appendChild(x);

  const body=document.createElement("div");body.className="rfl-body";
  const intro=document.createElement("p");intro.className="rfs-intro";
  intro.textContent=_ra5T("Paczka dodaje akcje do istniejącej aplikacji. Wybierz, do której.",
                          "A pack adds actions to an application you already have. Pick which one.");
  body.appendChild(intro);
  const lab=document.createElement("label");lab.className="rfs-lab";
  lab.textContent=_ra5T("Aplikacja","Application");
  const sel=document.createElement("select");sel.className="rfs-field";
  for(const a of apis){
    const o=document.createElement("option");
    o.value=_ra5Str(a.id,40);
    // The name is the USER'S text, not an interface label — the i18n walker must leave it alone.
    o.setAttribute("data-noi18n","");
    o.textContent=_ra5Str(a.name,80)||_ra5T("(bez nazwy)","(unnamed)");
    sel.appendChild(o);
  }
  lab.appendChild(sel);body.appendChild(lab);

  // Both classes on purpose: .rfk-foot brings the window's padding, .ra-pk-act the right-aligned
  // button pair every other import dialog in this module ends with.
  const foot=document.createElement("div");foot.className="rfk-foot ra-pk-act";
  let onKey=null;
  const close=function(){
    if(_ra5PickClose===close)_ra5PickClose=null;
    if(onKey)document.removeEventListener("keydown",onKey,true);
    back.classList.add("out");
    setTimeout(function(){try{back.remove();}catch(e){}},160);
    try{if(prev&&prev.focus)prev.focus();}catch(e){}
  };
  x.addEventListener("click",close);
  const cancel=_ra5Btn(_ra5T("Anuluj","Cancel"),"sm",null,close);
  const go=_ra5Btn(_ra5T("Dalej","Next"),"sm primary",null,function(){
    const api=_ra5Api(sel.value);
    close();
    if(!api){_ra5Say(_ra5T("Aplikacja zniknęła w trakcie wyboru.","The application disappeared while it was being picked."));return;}
    try{onPick(api);}catch(e){}
  });
  foot.appendChild(cancel);foot.appendChild(go);

  card.appendChild(head);card.appendChild(body);card.appendChild(foot);
  back.appendChild(card);
  back.addEventListener("mousedown",function(e){if(e.target===back)close();});
  onKey=function(e){
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close();return;}
    if(e.key!=="Tab")return;
    const f=Array.prototype.filter.call(
      card.querySelectorAll("button:not([disabled]),select,input,textarea,a[href]"),
      function(el){return el.offsetParent!==null;});
    if(!f.length)return;
    const first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  document.addEventListener("keydown",onKey,true);
  document.body.appendChild(back);
  _ra5PickClose=close;
  setTimeout(function(){try{sel.focus();}catch(e){}},30);
  return close;
}

// =====================================================================
// C) BUILT-IN TEMPLATES (REST_PACKS) — the service list plus the guide inside an application card
// =====================================================================
function _ra5PackByKey(key){
  const k=_ra5Str(key,40);
  if(!k)return null;
  for(const p of _ra5Packs())if(p&&p.key===k)return p;
  return null;
}
function _ra5ApiPack(api){return (api&&api.pack)?_ra5PackByKey(api.pack):null;}
// DOES THIS TEMPLATE ACTUALLY NEED A SECRET? `credential` is prose, not a flag: four packs use it to
// say "Brak — …" ("None — the local API works without any key"), and keying the 🔐 badge off its mere
// presence stamped every one of the sixteen with "needs a credential" — the demo whose own
// description reads "bez żadnych kluczy" included. Packs that need none carry `needsCred:false`.
function _ra5PackNeedsCred(p){
  if(!p)return false;
  if(p.needsCred!=null)return !!p.needsCred;
  return !!p.credential;
}
function _ra5PackVars(pack){           // the {{var.X}} names a template requires
  const out=new Set();
  for(const a of ((pack&&Array.isArray(pack.actions))?pack.actions:[])){
    if(!a)continue;
    _ra5ScanVarTokens(a.path,out);
    _ra5ScanVarTokens(a.body,out);
    for(const p of _ra5Pairs(a.query)){_ra5ScanVarTokens(p[0],out);_ra5ScanVarTokens(p[1],out);}
    for(const p of _ra5Pairs(a.headers)){_ra5ScanVarTokens(p[0],out);_ra5ScanVarTokens(p[1],out);}
  }
  return Array.from(out).sort();
}
function restCreateApiFromPack(key){
  const p=_ra5PackByKey(key);
  if(!p){_ra5Say(_ra5T("Nie znam takiego szablonu.","I do not know such a template."));return null;}
  if(typeof restAddApi!=="function"){
    _ra5Say(_ra5T("Edytor aplikacji nie jest gotowy.","The application editor is not ready."));
    return null;
  }
  // The application name and the action names/descriptions are a SNAPSHOT in whatever language the
  // user created the application in. From this moment they are the USER'S data — editable, referenced
  // by trigger.actionId, and included in a pack export — so they deliberately do NOT retranslate on a
  // language switch. Only what is read live from the catalogue does: the template list and the setup
  // guide, which work because the application stores `pack` (the template KEY), not copied text.
  const nazwa=_ra5PackTxt(p,"name");
  // `transport` travels with the template, not with the language: an OBS application has to BE an
  // OBS application from the moment it is created, or its actions land in the HTTP path and fail
  // at the first send with something nobody could act on.
  const api=restAddApi({name:nazwa,baseUrl:p.baseUrlHint,transport:p.transport,actions:_ra5PackActs(p)});
  if(!api)return null;
  api.pack=p.key;                      // remembering the template key is what enables the setup-guide section
  _ra5GuideOpen.add(api.id);           // expand the guide immediately after creation
  _ra5Save();
  try{if(typeof restRenderApis==="function")restRenderApis();}catch(e){}
  const n=(api.actions||[]).length;
  _ra5Toast(_ra5T("Utworzono „"+nazwa+"” — "+n+" "+_ra5Pl(n,"akcja","akcje","akcji")+
                  ". Instrukcja jest w karcie aplikacji.",
                  "Created “"+nazwa+"” — "+n+" action(s). The guide is inside the application card."),"ok");
  try{
    const root=_ra5Root();
    const card=root&&root.querySelector('.ra-app[data-id="'+_ra5Sel(api.id)+'"]');
    if(card)_ra5Scroll(card);
  }catch(e){}
  return api;
}
function _ra5TplRow(p,close){
  const b=document.createElement("button");
  b.type="button";b.className="ra-tpl-row";
  b.dataset.k=p.key;
  // Catalogue content, not an interface label: the i18n walker must skip it. The language is chosen
  // by _ra5PackTxt while building, and a language switch redraws these rows from scratch.
  b.setAttribute("data-noi18n","");
  const top=document.createElement("div");
  top.className="ra-tpl-top";
  const nm=document.createElement("b");
  nm.className="ra-tpl-name";nm.textContent=_ra5Str(_ra5PackTxt(p,"name"),80);
  top.appendChild(nm);
  const n=(Array.isArray(p.actions)?p.actions.length:0);
  const cnt=document.createElement("span");
  cnt.className="ra-tpl-cnt";
  cnt.textContent=n+" "+(_lang==="en"?(n===1?"action":"actions"):_ra5Pl(n,"akcja","akcje","akcji"));   // the row is data-noi18n (pack names), so the walker cannot do it
  top.appendChild(cnt);
  if(_ra5PackNeedsCred(p)){
    const c=document.createElement("span");
    c.className="ra-tpl-badge";
    c.textContent=_ra5T("🔐 wymaga poświadczenia","🔐 needs a credential");
    c.title=_ra5T("Ta usługa nie zadziała bez tokenu, klucza albo hasła — wpis w sejfie jest konieczny",
                  "This service will not work without a token, key or password — a vault entry is required");
    top.appendChild(c);
  }
  if(!p.verified){
    // A badge, not a sentence in brackets: one word on the chip, the long form in the tooltip.
    const u=document.createElement("span");
    u.className="ra-tpl-badge ra-tpl-unv";
    u.textContent=_ra5T("niezweryfikowane","unverified");
    u.title=_ra5T("Napisane z dokumentacji dostawcy, nie sprawdzone na żywym koncie — adresy i pola mogły się zmienić, szablon może wymagać dostosowania",
                  "Written from the provider's documentation, not tested on a live account — addresses and fields may have changed, this template may need adjusting");
    top.appendChild(u);
  }
  b.appendChild(top);
  const opis=_ra5PackTxt(p,"desc");
  if(opis){
    const d=document.createElement("div");
    d.className="ra-tpl-desc";d.textContent=_ra5Str(opis,300);
    b.appendChild(d);
  }
  const u=document.createElement("div");
  u.className="ra-tpl-url";u.textContent=_ra5Str(p.baseUrlHint,500);
  b.appendChild(u);
  b.addEventListener("click",function(){
    _ra5Touch();
    if(close)close();
    restCreateApiFromPack(p.key);
  });
  return b;
}
function restAddApiFromTemplate(){
  const packs=_ra5Packs();
  if(!packs.length){
    _ra5Say(_ra5T("Brak wbudowanych szablonów w tej wersji.","No built-in templates in this build."));
    return null;
  }
  const m=_ra5Modal("raTpl","ra-tpl-box","raTplTitle");
  const head=document.createElement("div");
  head.className="ra-pk-head";
  const h=document.createElement("h3");
  h.id="raTplTitle";
  head.appendChild(h);
  const sum=document.createElement("span");
  sum.className="ra-pk-sum";
  head.appendChild(sum);
  m.box.appendChild(head);

  const note=document.createElement("div");
  note.className="ra-pk-note";
  m.box.appendChild(note);

  const search=document.createElement("input");
  search.type="text";search.className="ra-tpl-search";
  search.autocomplete="off";
  m.box.appendChild(search);

  const list=document.createElement("div");
  list.className="ra-tpl-list";
  m.box.appendChild(list);

  const none=document.createElement("div");
  none.className="ra-pk-note ra-tpl-none";
  none.hidden=true;
  m.box.appendChild(none);

  const filter=function(){
    const q=search.value.trim().toLowerCase();
    let shown=0;
    for(const row of list.querySelectorAll(".ra-tpl-row")){
      const hit=!q||row.textContent.toLowerCase().indexOf(q)>=0;
      row.hidden=!hit;
      if(hit)shown++;
    }
    none.hidden=(shown>0);
  };
  search.addEventListener("input",filter);

  const act=document.createElement("div");
  act.className="ra-pk-act";
  const cancel=_ra5Btn("","sm",null,function(){m.close();});
  act.appendChild(cancel);
  m.box.appendChild(act);

  // ALL of the dialog's text is produced here, so a language switch just calls this again. The typed
  // filter survives because filter() runs at the end. Service names and descriptions come from the
  // template's `en` layer, the dialog's own labels from the usual i18n helper.
  const paint=function(){
    h.textContent=_ra5T("Wybierz szablon aplikacji","Pick an application template");
    sum.textContent=_ra5T(packs.length+" "+_ra5Pl(packs.length,"usługa","usługi","usług"),
                          packs.length+" service(s)");
    note.textContent=_ra5T("Szablon tworzy aplikację z gotowymi akcjami i adresem bazowym do podmiany. "+
                           "Instrukcja krok po kroku pojawi się w karcie aplikacji.",
                           "A template creates an application with ready actions and a base URL to replace. "+
                           "A step-by-step guide will appear inside the application card.");
    search.placeholder=_ra5T("szukaj usługi…","search for a service…");
    search.setAttribute("aria-label",_ra5T("Szukaj usługi","Search for a service"));
    none.textContent=_ra5T("Nic nie pasuje do tego, co wpisujesz.","Nothing matches that search.");
    cancel.textContent=_ra5T("Anuluj","Cancel");
    list.innerHTML="";
    for(const p of packs)if(p&&p.key)list.appendChild(_ra5TplRow(p,m.close));
    filter();
  };
  paint();
  _ra5TplPaint=paint;                  // cleared by _ra5OnLangChange once the dialog leaves the DOM
  try{search.focus();}catch(e){}
  return m;
}
// After a language switch, redraw everything that is read live from the template catalogue.
// Called from rf-40-boot.js, which wraps setLang — this file itself runs nothing on load.
function _ra5OnLangChange(){
  try{
    if(_ra5TplPaint){
      if(document.getElementById("raTpl"))_ra5TplPaint();   // the "From a template…" dialog is open
      else _ra5TplPaint=null;                               // closed — release the closure
    }
  }catch(e){_ra5TplPaint=null;}
  // Application cards: the setup-guide section is created while the card renders, so a full
  // re-render is the simplest and only route needed here.
  try{if(typeof restRenderApis==="function"&&_ra5Root())restRenderApis();}catch(e){}
}

// ---------- the setup-guide section inside an application card ----------
// All template content goes through textContent — ZERO innerHTML from data. Line breaks in the guide
// survive via CSS (.ra-guide-txt{white-space:pre-wrap}), not via markup.
function restApiGuide(api,card){
  if(!api||!card||!card.querySelector)return null;
  const p=_ra5ApiPack(api);
  if(!p)return null;
  if(card.querySelector(".ra-guide"))return null;
  const d=document.createElement("details");
  d.className="ra-guide";
  // Catalogue content (guide / caveats / credential description): the i18n walker must NOT touch it.
  // The language is chosen by _ra5PackTxt while building, and a language switch redraws the card.
  d.setAttribute("data-noi18n","");
  if(_ra5GuideOpen.has(api.id))d.open=true;
  d.addEventListener("toggle",function(){
    if(d.open)_ra5GuideOpen.add(api.id);else _ra5GuideOpen.delete(api.id);
  });
  const s=document.createElement("summary");
  s.className="ra-guide-h";
  s.textContent=_ra5T("📖 Instrukcja konfiguracji","📖 Setup guide")+" — "+_ra5Str(_ra5PackTxt(p,"name"),80);
  d.appendChild(s);

  const body=document.createElement("div");
  body.className="ra-guide-body";

  if(!p.verified){
    const u=document.createElement("div");
    u.className="ra-guide-cav";
    u.textContent="⚠ "+_ra5T("Ten szablon jest niezweryfikowany — adresy i pola mogły się w usłudze zmienić, "+
                             "może wymagać dostosowania.",
                             "This template is unverified — the service's addresses and fields may have changed, "+
                             "it may need adjusting.");
    body.appendChild(u);
  }

  const cred=_ra5PackTxt(p,"credential");
  if(cred){
    // The heading follows the FLAG, not the presence of the text: for a pack that needs nothing the
    // paragraph explains WHY there is nothing to set up, and a "needs a credential" title over it
    // would contradict its own first word.
    const need=_ra5PackNeedsCred(p);
    const c=document.createElement("div");
    c.className="ra-guide-cred"+(need?"":" is-none");
    const t=document.createElement("b");
    t.textContent=need?_ra5T("🔐 Ta usługa wymaga poświadczenia","🔐 This service needs a credential")
                      :_ra5T("🔓 Ta usługa nie wymaga poświadczenia","🔓 This service needs no credential");
    c.appendChild(t);
    const txt=document.createElement("div");
    txt.className="ra-guide-txt";
    txt.textContent=_ra5Str(cred,4000);
    c.appendChild(txt);
    if(need)c.appendChild(_ra5Btn(_ra5T("🔐 Przejdź do sejfu","🔐 Go to the vault"),"xs",
      _ra5T("Sejf poświadczeń jest na tym ekranie, w „Zaawansowane” na dole","The credential vault is on this screen, under “Advanced” at the bottom"),
      function(){
        const root=_ra5Root();
        const v=root&&root.querySelector("#raVaultCard");
        if(v)_ra5Scroll(v);
      }));
    body.appendChild(c);
  }

  const g=document.createElement("div");
  g.className="ra-guide-txt";
  g.textContent=_ra5Str(_ra5PackTxt(p,"guide"),20000);
  body.appendChild(g);

  const need=_ra5PackVars(p);
  if(need.length){
    const nv=document.createElement("div");
    nv.className="ra-guide-vars";
    const b=document.createElement("b");
    b.textContent=_ra5T("Zmienne używane przez ten szablon:","Variables used by this template:");
    nv.appendChild(b);
    const names=document.createElement("code");
    names.className="ra-guide-varlist";
    names.textContent=need.join(" · ");
    nv.appendChild(names);
    nv.appendChild(_ra5Btn(_ra5T("🔤 Uzupełnij w karcie Zmienne","🔤 Fill them in the Variables card"),"xs",
      _ra5T("Przewiń do karty Zmienne","Scroll to the Variables card"),
      function(){
        try{restRenderVars();}catch(e){}
        const c=_ra5VarsCard();
        if(c)_ra5Scroll(c);
      }));
    body.appendChild(nv);
  }

  const caveats=_ra5PackTxt(p,"caveats");
  if(caveats){
    const cav=document.createElement("div");
    cav.className="ra-guide-cav";
    cav.textContent="⚠ "+_ra5Str(caveats,4000);
    body.appendChild(cav);
  }

  d.appendChild(body);
  const head=card.querySelector(".ra-app-head");
  if(head&&head.nextSibling)card.insertBefore(d,head.nextSibling);
  else if(head)card.appendChild(d);
  else card.insertBefore(d,card.firstChild);
  return d;
}

// The wrappers that wire restRenderVars() and restApiGuide() into the API-card render live in
// rf-40-boot.js — see the note at the top of this file.
