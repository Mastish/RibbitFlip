"use strict";
// ============== Uslugi sieciowe (REST API) — application cards, actions, sending, log ==========
// This file owns: the per-application cards with their sub-tabs (Actions · Triggers · Settings),
// the action library, request building with {{placeholder}} substitution, sending through
// POST /rest/send, and the send log with secret masking.
// Consumes from the vault/model file: RESTAPI.cfg, restSave(), restVaultState(), restGetCred(),
// restCredList(), restMask(), restRoot. Provides restRenderApis(), restAddApi(), restResolve(),
// restBuildRequest(), restRunAction(), restTestConnection(), restLog()/restRenderLog().
// Triggers and service packs live in later files; here they are only optional hooks, called when
// the corresponding function happens to be defined.
//
// SECURITY RULE: secret values never reach console/localStorage/DOM except through the vault's own
// password fields. The preview and the log ALWAYS go through _ra3Mask() (global restMask plus the
// values used by this particular request). In the preview, authorization headers are masked
// ENTIRELY, and the log does not show headers at all.

// ---------- runtime state (deliberately OUTSIDE cfg, so it never reaches the file on disk) ----------
// The active sub-tab per API lives in a runtime map, NOT in RESTAPI.cfg: restSave() serializes cfg
// wholesale and there is no "before save" hook, so any field parked in cfg eventually lands on disk
// and comes back through the sanitizer. A runtime map cannot leak by construction.
const _ra3Tab=Object.create(null);        // apiId → "actions" | "triggers" | "settings"
const _ra3EditOpen=new Set();             // actionIds whose edit form is expanded
const _ra3PrevOpen=new Set();             // actionIds whose request preview is expanded
const _ra3LogOpen=new Set();              // log-entry ids whose response is expanded
const _ra3Log=[];                         // the log VIEW — RAM only (the disk copy is written separately)
const RA3_LOG_MAX=100;                    // how many entries the view keeps
const RA3_MAX_INFLIGHT=4;                 // hard cap on concurrent sends
const RA3_LED_MS=280;                     // API card LED blink duration
const RA3_BODY_PREVIEW=4000;              // how many response characters the log shows
const RA3_METHODS=["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"];
const RA3_BODY_TYPES=[["json","JSON","JSON"],["text","tekst","text"],["form","formularz","form"],["none","brak","none"]];
const RA3_SECRET_HDR=/^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|x-auth-token|x-access-token)$/i;
const RA3_KEEP={};                        // sentinel: leave the token literally, its warning is already queued
const RA3_BANNED_HDR=/^(host|content-length|transfer-encoding)$/i;   // the sending proxy sets these itself
let _ra3InFlight=0;                       // how many requests are in flight
let _ra3Counter=0;                        // {{counter}} — starts at 1 each session, never persisted
let _ra3LogSeq=0;

// ---------- bridges to the vault/model file (all typeof-guarded, so a missing piece degrades instead of throwing) ----------
function _ra3Cfg(){
  try{if(typeof RESTAPI!=="undefined"&&RESTAPI&&RESTAPI.cfg&&typeof RESTAPI.cfg==="object")return RESTAPI.cfg;}catch(e){}
  try{if(window.RESTAPI&&window.RESTAPI.cfg)return window.RESTAPI.cfg;}catch(e){}
  return null;
}
function _ra3Root(){
  try{if(typeof restRoot!=="undefined"&&restRoot)return restRoot;}catch(e){}
  try{if(window.RESTAPI&&window.RESTAPI.root)return window.RESTAPI.root;}catch(e){}
  return document.getElementById("tab-restapi")||null;
}
function _ra3Save(){try{if(typeof restSave==="function")restSave();}catch(e){}}
function _ra3Touch(){try{if(typeof _raTouch==="function")_raTouch();}catch(e){}}   // push back the vault's idle auto-lock
function _ra3T(pl,en){try{if(typeof _gl==="function")return _gl(pl,en);}catch(e){}return pl;}
function _ra3Esc(s){
  try{if(typeof esc==="function")return esc(s);}catch(e){}
  return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];});
}
function _ra3NewId(pfx){
  try{if(typeof _raNewId==="function")return _raNewId(pfx);}catch(e){}
  return pfx+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);
}
function _ra3Toast(msg,tone){try{if(typeof rfToast==="function")rfToast(msg,tone?{tone:tone}:undefined);}catch(e){}}
function _ra3Say(msg){try{if(typeof rfSkullSay==="function")rfSkullSay(msg,{tone:"danger"});}catch(e){}}
function _ra3Confirm(msg,opt){
  try{if(typeof rfConfirm==="function")return rfConfirm(msg,opt);}catch(e){}
  return Promise.resolve(true);
}
// Vault state. restVaultState() returns an OBJECT {state,bg,ready,count,cryptoOk}; a bare string is
// also accepted so this file keeps working if that contract is ever narrowed.
function _ra3Vault(){
  let v=null;
  try{if(typeof restVaultState==="function")v=restVaultState();}catch(e){}
  if(typeof v==="string")v={state:v,bg:false,count:0,cryptoOk:true,
    ready:(v==="unlocked"||v==="odblokowany")};
  if(!v||typeof v!=="object")v={state:"none",bg:false,count:0,cryptoOk:false,ready:false};
  if(v.ready==null)v.ready=(v.state==="unlocked"||v.state==="odblokowany");
  return v;
}
function _ra3CredList(){
  try{if(typeof restCredList==="function"){const l=restCredList();if(Array.isArray(l))return l;}}catch(e){}
  return [];
}
function _ra3GetCred(id){
  try{if(typeof restGetCred==="function")return restGetCred(id);}catch(e){}
  return null;
}
function _ra3MaskStr(){try{if(typeof RA_MASK==="string"&&RA_MASK)return RA_MASK;}catch(e){}return "••••";}
// Masking runs twice: first the global restMask (every secret in the vault), then the values used by
// THIS request — a fallback for the case where the vault has already locked by the time the entry
// is rendered, at which point restMask has nothing left to match against.
function _ra3Mask(s,extra){
  let out=(s==null)?"":String(s);
  try{if(typeof restMask==="function")out=String(restMask(out));}catch(e){}
  if(extra&&extra.length){
    const M=_ra3MaskStr();
    // longest first, otherwise a short secret contained in a longer one breaks the longer match
    const list=Array.prototype.slice.call(extra).sort(function(a,b){return String(b==null?"":b).length-String(a==null?"":a).length;});
    for(const v of list){const t=String(v==null?"":v);if(t.length<3)continue;if(out.indexOf(t)>=0)out=out.split(t).join(M);}
  }
  return out;
}

// ---------- small helpers ----------
function _ra3Str(v,max){if(v==null)return "";const s=(typeof v==="string")?v:String(v);return max?s.slice(0,max):s;}
function _ra3Int(v,lo,hi,dflt){const n=parseInt(v,10);return isFinite(n)?Math.min(hi,Math.max(lo,n)):dflt;}
function _ra3Method(m){m=String(m||"").toUpperCase();return RA3_METHODS.indexOf(m)>=0?m:"POST";}
function _ra3BodyType(b){b=String(b||"");return RA3_BODY_TYPES.some(function(x){return x[0]===b;})?b:"json";}
function _ra3PairsOf(v){const out=[];if(!Array.isArray(v))return out;for(const p of v)if(Array.isArray(p))out.push(p);return out;}
function _ra3PairsClone(v){const out=[];for(const p of _ra3PairsOf(v).slice(0,50)){const k=_ra3Str(p[0],200);if(!k)continue;out.push([k,_ra3Str(p[1],4000)]);}return out;}
function _ra3Uniq(a){const seen=new Set(),out=[];for(const x of a){const k=String(x);if(seen.has(k))continue;seen.add(k);out.push(x);}return out;}
function _ra3Err(msg,code){const e=new Error(msg);e.raCode=code||"";return e;}
function _ra3ErrText(e){
  if(!e)return _ra3T("Nieznany błąd.","Unknown error.");
  const m=(typeof e==="string")?e:(e.message||String(e));
  return m||_ra3T("Nieznany błąd.","Unknown error.");
}
// Polish plural forms (1 akcja / 2 akcje / 5 akcji) — Polish picks a different noun form by count.
function _ra3Pl(n,f1,f2,f5){
  n=Math.abs(n|0);if(n===1)return f1;
  const d=n%10,h=n%100;
  return (d>=2&&d<=4&&!(h>=12&&h<=14))?f2:f5;
}
function _ra3B64Utf8(s){
  const bytes=new TextEncoder().encode(String(s==null?"":s));
  let bin="";for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);
  return btoa(bin);
}
// A secret must be registered for masking in EVERY form it can take inside a request: raw,
// percent-encoded and JSON-escaped. Without that, encodeURIComponent in query parameters slips past
// the mask (ab+cd/ef== reaches the URL as ab%2Bcd%2Fef%3D%3D), and a token containing a quote or a
// backslash shows up verbatim in the log (ab"cd is stored as ab\"cd, which the raw match misses).
function _ra3JsonEsc(v){                 // the value as the INSIDE of a JSON string literal (no surrounding quotes)
  const s=JSON.stringify(String(v==null?"":v));
  return s.slice(1,s.length-1);
}
function _ra3PushSecret(arr,v){
  if(!arr||v==null)return;
  const s=String(v);
  if(s.length<3)return;
  if(arr.indexOf(s)<0)arr.push(s);
  let enc="";
  try{enc=encodeURIComponent(s);}catch(e){enc="";}
  if(enc&&enc!==s&&enc.length>=3&&arr.indexOf(enc)<0)arr.push(enc);
  let je="";
  try{je=_ra3JsonEsc(s);}catch(e){je="";}
  if(je&&je!==s&&je.length>=3&&arr.indexOf(je)<0)arr.push(je);
}
function _ra3Apis(){const c=_ra3Cfg();if(!c)return [];if(!Array.isArray(c.apis))c.apis=[];return c.apis;}
function _ra3Api(id){for(const a of _ra3Apis())if(a&&a.id===id)return a;return null;}
function _ra3Action(api,id){if(!api||!Array.isArray(api.actions))return null;for(const x of api.actions)if(x&&x.id===id)return x;return null;}
function _ra3Sel(id){return String(id==null?"":id).replace(/["\\\]]/g,"");}   // ids should be [A-Za-z0-9_-]; strip anyway before use in a CSS selector
function _ra3IsWs(api){return !!(api&&api.transport==="ws");}                 // OBS Studio over obs-websocket, instead of HTTP
function _ra3EmptyEl(title,sub,ctaLab,ctaFn,ctaIcon){
  try{if(typeof _raEmpty==="function")return _raEmpty(title,sub,ctaLab,ctaFn,ctaIcon);}catch(e){}
  const d=document.createElement("div");d.className="ra-empty";
  const b=document.createElement("b");b.textContent=title;d.appendChild(b);
  if(sub){const s=document.createElement("span");s.textContent=sub;d.appendChild(s);}
  if(ctaLab){const w=document.createElement("div");w.className="ra-empty-cta";
    const btn=document.createElement("button");btn.type="button";btn.className="btn sm primary";_ra3Btn(btn,ctaLab,ctaIcon);
    btn.addEventListener("click",ctaFn);w.appendChild(btn);d.appendChild(w);}
  return d;
}
// icon (.bic-*) + plain label on a button — see _raBtnLabel in rf-35; the fallback keeps the text alone
function _ra3Btn(btn,label,icon){try{if(typeof _raBtnLabel==="function")return _raBtnLabel(btn,label,icon);}catch(e){}btn.textContent=label;return btn;}

// ===================== {{…}} PLACEHOLDERS =====================
// The context is assembled by restBuildRequest and by the trigger runtime:
//   {dev, pose, raw, trigger:{label,key,fires}, _now, _counter, apiName, actionName, _secretsUsed[]}
// Returns {out, warnings[]}. An unknown token is left literally and produces a warning.
// {{secret.ID}} against a locked vault THROWS — never an empty substitution, and never a request
// that goes out missing the credential it was supposed to carry.
function _ra3Dev(ctx){
  const d=ctx&&ctx.dev;
  if(d&&d!=="any")return String(d);
  try{if(typeof state!=="undefined"&&state&&state.activeDeviceId)return state.activeDeviceId;}catch(e){}
  return "d0";
}
function _ra3DevName(ctx){
  const id=_ra3Dev(ctx);
  try{
    if(typeof devEntry==="function"){
      const D=devEntry(id);
      const n=D&&D.meta&&(D.meta.name||D.meta.label);
      if(n)return String(n);
    }
  }catch(e){}
  return id;
}
// Pose: the active slot reads state.pose (~50 Hz), the others read their slower poseLive (~12 Hz).
function _ra3Pose(ctx){
  if(ctx&&ctx.pose&&typeof ctx.pose==="object")return ctx.pose;
  const id=_ra3Dev(ctx);
  try{
    if(typeof state!=="undefined"&&state){
      if(id===state.activeDeviceId&&state.pose)return state.pose;
      if(state.devices&&state.devices[id])return state.devices[id].poseLive||state.devices[id].pose||null;
    }
  }catch(e){}
  return null;
}
// Raw channels CH0..CH5 exist ONLY for the active slot (state.last); other slots never carry them.
function _ra3Raw(ctx){
  if(ctx&&ctx.raw&&typeof ctx.raw==="object")return ctx.raw;
  const id=_ra3Dev(ctx);
  try{if(typeof state!=="undefined"&&state&&id===state.activeDeviceId)return state.last||null;}catch(e){}
  return null;
}
function _ra3ChKey(idx){
  try{if(typeof RE_NAME!=="undefined"&&RE_NAME&&RE_NAME[idx])return RE_NAME[idx];}catch(e){}
  return ["ax","ay","az","gx","gy","gz"][idx];
}
function _ra3CredMain(c){
  const f=(c&&c.fields)||{};
  if(typeof f.token==="string"&&f.token)return f.token;
  if(typeof f.pass==="string"&&f.pass)return f.pass;
  if(typeof f.value==="string"&&f.value)return f.value;
  return "";
}
function _ra3Token(tok,ctx,warnings){
  if(tok==="counter")return String(ctx._counter!=null?ctx._counter:(_ra3Counter+1));
  if(tok==="ts.iso"){try{return new Date(ctx._now||Date.now()).toISOString();}catch(e){return "";}}
  if(tok==="ts.unix")return String(Math.floor((ctx._now||Date.now())/1000));
  if(tok==="api.name")return _ra3Str(ctx.apiName);
  if(tok==="action.name")return _ra3Str(ctx.actionName);
  if(tok==="device.id")return _ra3Dev(ctx);
  if(tok==="device.name")return _ra3DevName(ctx);
  // Trigger fields: empty string on a manual send, deliberately and without a warning.
  if(tok==="trigger.label")return _ra3Str(ctx.trigger&&ctx.trigger.label);
  if(tok==="trigger.key")return _ra3Str(ctx.trigger&&ctx.trigger.key);
  if(tok==="trigger.fires")return (ctx.trigger&&ctx.trigger.fires!=null)?String(ctx.trigger.fires):"";
  if(tok.indexOf("pose.")===0){
    const k=tok.slice(5);
    if(["tilt","pitch","roll","twist"].indexOf(k)<0)return undefined;
    const p=_ra3Pose(ctx),v=p?p[k]:null;
    if(v==null||!isFinite(v)){
      warnings.push(_ra3T("Brak danych z kapsla — {{pose.*}} podstawiono jako 0.",
                          "No capsule data — {{pose.*}} substituted as 0."));
      return "0.00";
    }
    return (Math.round(Number(v)*100)/100).toFixed(2);
  }
  if(/^ch[0-5]$/.test(tok)){
    const idx=+tok.slice(2),key=_ra3ChKey(idx),raw=_ra3Raw(ctx);
    const v=raw?raw[key]:null;
    if(v==null||!isFinite(v)){
      warnings.push(_ra3T("Surowe kanały CH0–CH5 są dostępne tylko dla aktywnego kapsla — podstawiono 0.",
                          "Raw channels CH0–CH5 are available only for the active capsule — substituted 0."));
      return "0";
    }
    return String(v);
  }
  if(tok.indexOf("var.")===0){
    const n=tok.slice(4),cfg=_ra3Cfg(),vars=(cfg&&cfg.vars&&typeof cfg.vars==="object")?cfg.vars:{};
    if(Object.prototype.hasOwnProperty.call(vars,n))return _ra3Str(vars[n]);
    // A MISSING VARIABLE BLOCKS THE SEND. Leaving the token in the address only looked harmless:
    // the request went out to a literal ".../webhook/{{var.N8N_PATH}}", the foreign server answered
    // 404, and the reason sat folded away in a log row nobody opens. The dry-run PREVIEW is the one
    // caller that still wants to see the token left in place — nothing leaves the machine there.
    if(ctx&&ctx.preview){
      warnings.push(_ra3T("Nie ma zmiennej „"+n+"” — token zostaje w treści.",
                          "There is no variable “"+n+"” — the token stays in the content."));
      return RA3_KEEP;                                                 // keep literally; the warning above is enough
    }
    throw _ra3Err(_ra3T("Nie ma zmiennej „"+n+"” — dodaj ją w sekcji Zmienne albo popraw akcję.",
                        "There is no variable “"+n+"” — add it in the Variables section or fix the action."),"var-missing");
  }
  if(tok.indexOf("secret.")===0){
    const id=tok.slice(7),vs=_ra3Vault();
    if(!vs.ready)throw _ra3Err(_ra3T("Sejf jest zamknięty — odblokuj go, aby użyć {{secret.…}}.",
                                     "The vault is locked — unlock it to use {{secret.…}}."),"vault-locked");
    const c=_ra3GetCred(id);
    if(!c)throw _ra3Err(_ra3T("Nie znaleziono poświadczenia „"+id+"” w sejfie.",
                              "Credential “"+id+"” was not found in the vault."),"cred-missing");
    const v=_ra3CredMain(c);
    if(!v)throw _ra3Err(_ra3T("Poświadczenie „"+(c.name||id)+"” nie ma wartości do wstawienia.",
                              "Credential “"+(c.name||id)+"” has no value to insert."),"cred-empty");
    if(ctx&&Array.isArray(ctx._secretsUsed))_ra3PushSecret(ctx._secretsUsed,v);
    return v;
  }
  return undefined;
}
// opt.json===true switches on JSON-aware substitution. A value landing INSIDE a JSON string literal
// is escaped, so a quote, backslash or newline in a rule/device/variable name cannot break the body,
// cannot silently become a control character, and cannot inject extra fields into the object being
// sent (the classic ok","channel":"#general payload). Outside a literal — e.g. {"n": {{trigger.fires}}}
// — the value goes in raw, otherwise a number would turn into a string. Validating with JSON.parse
// afterwards does NOT catch this: a successful injection is still perfectly valid JSON.
function restResolve(str,ctx,opt){
  ctx=ctx||{};
  const warnings=[];
  if(str==null)return {out:"",warnings:warnings};
  const src=String(str);
  const jsonMode=!!(opt&&opt.json);
  // Forward-only scanner tracking whether a given offset sits inside a JSON string literal.
  // It only ever moves forward because the regex below walks the source left to right.
  let _scan=0,_inStr=false;
  const _insideString=function(upTo){
    for(;_scan<upTo;_scan++){
      const ch=src.charAt(_scan);
      if(_inStr){
        if(ch==="\\"){_scan++;continue;}              // an escaped quote does not close the literal
        if(ch==='"')_inStr=false;
      }else if(ch==='"')_inStr=true;
    }
    return _inStr;
  };
  const out=src.replace(/\{\{\s*([^{}\r\n]{1,160}?)\s*\}\}/g,function(full,tok,offset){
    const q=jsonMode?_insideString(offset):false;
    if(jsonMode)_scan=offset+full.length;             // the token text is replaced, so never scan it
    const t=String(tok).trim();
    const r=_ra3Token(t,ctx,warnings);
    if(r===RA3_KEEP)return full;                      // known token without a value — already warned
    if(r===undefined){
      warnings.push(_ra3T("Nieznany placeholder: "+full,"Unknown placeholder: "+full));
      return full;                                   // leave it literally
    }
    return q?_ra3JsonEsc(r):r;
  });
  return {out:out,warnings:_ra3Uniq(warnings)};
}

// ===================== REQUEST BUILDING =====================
// Returns {url, method, headers, body, timeoutMs, warnings[], secretsUsed[]}. Throws when the request
// cannot be built (locked vault, no address, invalid JSON) — in which case NOTHING reaches the network.
function restBuildRequest(api,action,ctx){
  if(!api||!action)throw _ra3Err(_ra3T("Brak API albo akcji.","Missing API or action."),"no-target");
  ctx=Object.assign({},ctx||{});
  if(ctx._now==null)ctx._now=Date.now();
  if(ctx._counter==null)ctx._counter=_ra3Counter+1;
  ctx.apiName=_ra3Str(api.name);
  ctx.actionName=_ra3Str(action.name);
  const secretsUsed=[];ctx._secretsUsed=secretsUsed;
  const warns=[];
  const R=function(s){const r=restResolve(s,ctx);for(const w of r.warnings)warns.push(w);return r.out;};
  // JSON bodies are substituted in string-literal-aware mode — see restResolve().
  const RJ=function(s){const r=restResolve(s,ctx,{json:true});for(const w of r.warnings)warns.push(w);return r.out;};
  const method=_ra3Method(action.method);

  // --- OBS Studio: a different transport, therefore a different request altogether.
  // No URL, no method, no headers and no credential — obs-websocket authenticates once, when the
  // socket opens (the OBS card), not per request. What travels is a request NAME and one JSON
  // object, and the socket itself is held by the server, because this page's CSP (connect-src
  // 'self') forbids the browser from opening ws://127.0.0.1:4455 at all.
  if(_ra3IsWs(api)){
    const rt=_ra3Str(action.requestType,64).trim();
    if(!rt)throw _ra3Err(_ra3T("Ta akcja nie ma nazwy żądania OBS — uzupełnij pole „Żądanie OBS” w edytorze akcji.",
                               "This action has no OBS request name — fill in the “OBS request” field in the action editor."),"no-requesttype");
    let data={};
    if(_ra3BodyType(action.bodyType)!=="none"){
      const t=RJ(action.body||"").trim();
      if(t!==""){
        // Same masking reasoning as the HTTP body below: V8 quotes the input in its parse error,
        // so a {{secret.*}} value would otherwise land in the log in clear text.
        try{data=JSON.parse(t);}
        catch(e){throw _ra3Err(_ra3T("Dane żądania OBS nie są poprawnym JSON-em po podstawieniu placeholderów: ",
                                     "The OBS request data is not valid JSON after placeholder substitution: ")
                               +_ra3Mask(_ra3ErrText(e),secretsUsed),"bad-json");}
        if(!data||typeof data!=="object"||Array.isArray(data))
          throw _ra3Err(_ra3T("Dane żądania OBS muszą być obiektem JSON, np. {\"sceneName\":\"Kamera\"}.",
                              "The OBS request data must be a JSON object, e.g. {\"sceneName\":\"Camera\"}."),"bad-json");
      }
    }
    const pretty=Object.keys(data).length?JSON.stringify(data):null;
    // url/method/headers are filled in with something readable rather than left out: the preview,
    // the send log and its filters all read those fields, and half-empty entries would be the
    // only place in the module where the log stops explaining itself.
    return {ws:true,requestType:rt,requestData:data,
            url:"obs-websocket://"+rt,method:"OBS",headers:{},body:pretty,
            timeoutMs:_ra3Int(api.timeoutMs,1,30000,10000),
            warnings:_ra3Uniq(warns),secretsUsed:secretsUsed};
  }
  // An OBS action that ended up in an HTTP application (a shared pack imported into the wrong one)
  // would otherwise go out as a POST to an empty path and fail with something unreadable.
  if(_ra3Str(action.requestType).trim())
    throw _ra3Err(_ra3T("To jest akcja OBS, a ta aplikacja wysyła HTTP. Utwórz aplikację OBS z szablonu i wczytaj paczkę do niej.",
                        "This is an OBS action, but this application sends HTTP. Create an OBS application from a template and load the pack into that one."),"wrong-transport");

  // --- credential: the action's setting overrides the API's
  const credId=_ra3Str(action.credId)||_ra3Str(api.credId)||"";
  let cred=null;
  if(credId){
    const vs=_ra3Vault();
    if(!vs.ready)throw _ra3Err(_ra3T("Sejf jest zamknięty — odblokuj go, aby wysłać z poświadczeniem.",
                                     "The vault is locked — unlock it to send with a credential."),"vault-locked");
    cred=_ra3GetCred(credId);
    if(!cred)throw _ra3Err(_ra3T("Nie znaleziono poświadczenia przypisanego do tej akcji.",
                                 "The credential assigned to this action was not found."),"cred-missing");
  }

  // --- address: an absolute http(s):// path wins over the API base URL
  const path=R(action.path||"").trim();
  let url;
  if(/^https?:\/\//i.test(path)){
    // Defence in depth against a smuggled host: if the STORED path was not an absolute URL and
    // only became one after {{…}} expansion, someone hid a destination inside a placeholder
    // (e.g. path="{{action.name}}" with name="https://evil/…"). Such an address is INVISIBLE in
    // the editor and in the import dialog, so the user never had a chance to judge it → block.
    // A literally typed absolute address is visible and flagged on import, so it is allowed:
    // we warn about the risk and leave the decision to the user.
    if(!/^https?:\/\//i.test(String(action.path||"").trim()))
      throw _ra3Err(_ra3T("Ścieżka akcji stała się pełnym adresem dopiero po podstawieniu {{…}} — to ukryty adres, wysyłka zablokowana. Wpisz adres docelowy wprost w ścieżce akcji.",
                          "The action path became a full URL only after {{…}} substitution — that is a hidden address, sending blocked. Put the target address literally in the action path."),"hidden-host");
    url=path;
  }
  else{
    const base=R(api.baseUrl||"").trim().replace(/\/+$/,"");
    if(!base)throw _ra3Err(_ra3T("Brak adresu — uzupełnij „Adres bazowy” w ustawieniach API albo podaj pełny adres w ścieżce akcji.",
                                 "No address — fill in the API base URL or give a full address in the action path."),"no-url");
    if(!/^https?:\/\//i.test(base))throw _ra3Err(_ra3T("Adres bazowy musi zaczynać się od http:// albo https://.",
                                                       "The base URL must start with http:// or https://."),"bad-scheme");
    url=base+(path?(path.charAt(0)==="/"?path:"/"+path):"");
  }
  // A vault credential is SCOPED to the host of the API's base URL. An action whose absolute path
  // points at a DIFFERENT host (typically one that arrived in an imported pack) gets no
  // Authorization header and no key — otherwise a pack from a stranger would exfiltrate a secret
  // on the first send. The request still goes out, WITHOUT the credential, plus a warning.
  if(cred){
    const _h=function(u){const m=/^https?:\/\/([^/?#]+)/i.exec(u||"");return m?m[1].toLowerCase():"";};
    const hu=_h(url),hb=_h(_ra3Str(api.baseUrl).trim());
    if(hu&&hb&&hu!==hb){
      cred=null;
      warns.push(_ra3T("Adres akcji wskazuje inny host ("+hu+") niż adres bazowy API ("+hb+") — poświadczenie z sejfu NIE zostało dołączone.",
                       "The action address points at a different host ("+hu+") than the API base URL ("+hb+") — the vault credential was NOT attached."));
    }
  }

  // --- query parameters
  const qs=[];
  for(const p of _ra3PairsOf(action.query)){
    const k=R(p[0]);if(!k)continue;
    qs.push(encodeURIComponent(k)+"="+encodeURIComponent(R(p[1])));
  }
  if(cred&&cred.kind==="query"){
    const pn=_ra3Str(cred.fields&&cred.fields.pname).trim(),pv=_ra3Str(cred.fields&&cred.fields.value);
    if(pn){qs.push(encodeURIComponent(pn)+"="+encodeURIComponent(pv));_ra3PushSecret(secretsUsed,pv);}
    else warns.push(_ra3T("Poświadczenie „parametr w adresie” nie ma nazwy parametru — pominięto.",
                          "The “query parameter” credential has no parameter name — skipped."));
  }
  if(qs.length){
    const hi=url.indexOf("#"),hash=(hi>=0)?url.slice(hi):"",head=(hi>=0)?url.slice(0,hi):url;
    url=head+(head.indexOf("?")>=0?"&":"?")+qs.join("&")+hash;
  }

  // --- headers, applied in order: API → action (overrides) → credential (wins outright).
  // hset() is case-insensitive on purpose: HTTP header names are, so "authorization" from an
  // action must not survive next to the credential's "Authorization".
  const headers={};
  const hset=function(k,v){
    const key=String(k==null?"":k).trim();if(!key)return;
    const lk=key.toLowerCase();
    for(const ex of Object.keys(headers))if(ex.toLowerCase()===lk)delete headers[ex];
    headers[key]=String(v==null?"":v);
  };
  const hhas=function(k){
    const lk=String(k).toLowerCase();
    return Object.keys(headers).some(function(x){return x.toLowerCase()===lk;});
  };
  for(const p of _ra3PairsOf(api.headers))hset(R(p[0]),R(p[1]));
  for(const p of _ra3PairsOf(action.headers))hset(R(p[0]),R(p[1]));
  if(cred){
    if(cred.kind==="bearer"){
      const t=_ra3Str(cred.fields&&cred.fields.token);
      if(!t)warns.push(_ra3T("Poświadczenie Bearer nie ma tokenu.","The Bearer credential has no token."));
      hset("Authorization","Bearer "+t);
      _ra3PushSecret(secretsUsed,t);
    }else if(cred.kind==="basic"){
      const u=_ra3Str(cred.fields&&cred.fields.user),pw=_ra3Str(cred.fields&&cred.fields.pass);
      let b64="";
      try{b64=_ra3B64Utf8(u+":"+pw);}                                   // UTF-8 → bytes → base64 (btoa alone breaks on non-ASCII)
      catch(e){throw _ra3Err(_ra3T("Nie udało się zakodować loginu i hasła.","Could not encode the username and password."),"b64");}
      hset("Authorization","Basic "+b64);
      _ra3PushSecret(secretsUsed,pw);
      _ra3PushSecret(secretsUsed,b64);                                  // mask the encoded form as well
    }else if(cred.kind==="header"){
      const hn=_ra3Str(cred.fields&&cred.fields.hname).trim(),hv=_ra3Str(cred.fields&&cred.fields.value);
      if(hn){hset(hn,hv);_ra3PushSecret(secretsUsed,hv);}
      else warns.push(_ra3T("Poświadczenie „własny nagłówek” nie ma nazwy nagłówka — pominięto.",
                            "The “custom header” credential has no header name — skipped."));
    }else if(cred.kind==="obspass"){
      // Deliberately attached to NOTHING. The OBS password is used once, by the OBS card, to sign
      // the challenge when the socket opens; HTTP has no place to put it and inventing one would
      // send the password to whatever host this action points at.
      _ra3PushSecret(secretsUsed,_ra3Str(cred.fields&&cred.fields.password));
      warns.push(_ra3T("Wybrane poświadczenie to hasło OBS — do żądania HTTP nie jest dołączane. Używa go wyłącznie karta „OBS Studio”.",
                       "The selected credential is the OBS password — it is not attached to an HTTP request. Only the “OBS Studio” card uses it."));
    }
  }
  for(const k of Object.keys(headers))if(RA3_BANNED_HDR.test(k)){
    delete headers[k];
    warns.push(_ra3T("Nagłówek „"+k+"” ustawia serwer — usunięto go z żądania.",
                     "Header “"+k+"” is set by the server — removed from the request."));
  }

  // --- body
  let body=null;
  const bt=_ra3BodyType(action.bodyType);
  if(bt==="json"){
    const t=RJ(action.body||"");
    if(t.trim()==="")warns.push(_ra3T("Treść JSON jest pusta — wysyłam bez treści.","The JSON body is empty — sending without a body."));
    else{
      try{JSON.parse(t);}
      // V8's parse error quotes ~30 characters of the input, so a value substituted by
      // {{secret.*}} would otherwise reach the log and the preview in clear text. Mask it right
      // here, where it is raised, so the secret never enters the Error object at all.
      catch(e){throw _ra3Err(_ra3T("Treść JSON jest nieprawidłowa po podstawieniu placeholderów: ",
                                   "Invalid JSON body after placeholder substitution: ")
                             +_ra3Mask(_ra3ErrText(e),secretsUsed),"bad-json");}
      body=t;
      if(!hhas("content-type"))hset("Content-Type","application/json; charset=utf-8");
    }
  }else if(bt==="text"){
    const t=R(action.body||"");
    if(t!==""){body=t;if(!hhas("content-type"))hset("Content-Type","text/plain; charset=utf-8");}
  }else if(bt==="form"){
    const t=R(action.body||""),parts=[];
    for(const line of t.split(/\r?\n/)){
      const s=line.trim();
      if(!s||s.charAt(0)==="#")continue;                                // '#' starts a comment line in the form template
      const i=s.indexOf("="),k=(i<0?s:s.slice(0,i)).trim(),v=(i<0?"":s.slice(i+1));
      if(!k)continue;
      parts.push(encodeURIComponent(k)+"="+encodeURIComponent(v));
    }
    if(parts.length){
      body=parts.join("&");
      if(!hhas("content-type"))hset("Content-Type","application/x-www-form-urlencoded; charset=utf-8");
    }else warns.push(_ra3T("Formularz nie ma żadnej pary „nazwa=wartość” — wysyłam bez treści.",
                           "The form has no “name=value” pair — sending without a body."));
  }
  if(body!=null&&(method==="GET"||method==="HEAD"))
    warns.push(_ra3T("Metoda "+method+" zwykle nie przyjmuje treści — część serwerów ją zignoruje.",
                     "The "+method+" method usually takes no body — some servers will ignore it."));

  return {url:url,method:method,headers:headers,body:body,
          timeoutMs:_ra3Int(api.timeoutMs,1,30000,10000),
          warnings:_ra3Uniq(warns),secretsUsed:secretsUsed};
}

// ===================== SENDING =====================
// Always through the local server's proxy — the page's CSP allows connect-src 'self' only, and the
// global fetch wrapper attaches the session token itself.
function _ra3Send(api,actionName,req,manual){
  _ra3InFlight++;
  const t0=(window.performance&&performance.now)?performance.now():Date.now();
  const el=function(){return Math.max(0,Math.round(((window.performance&&performance.now)?performance.now():Date.now())-t0));};
  const fin=function(v){_ra3InFlight=Math.max(0,_ra3InFlight-1);return v;};
  restFlashApiLed(api&&api.id);
  // Two transports, ONE answer shape. /obs/send replies with the same keys /rest/send does
  // (ok / status / reason / ms / body / error), so everything below — the log entry, the masking,
  // the toast on a manual send — is written once and does not know which one it is reading.
  const ws=!!req.ws;
  const endpoint=ws?"/obs/send":"/rest/send";
  const payload=ws?{requestType:req.requestType,requestData:req.requestData}
                  :{url:req.url,method:req.method,headers:req.headers,body:req.body,timeoutMs:req.timeoutMs};
  const _mt=req._meta||{};   // ids + trigger context, carried only into the persistent log
  const base={apiName:_ra3Str(api&&api.name),actionName:_ra3Str(actionName),method:req.method,
              url:_ra3Mask(req.url,req.secretsUsed),manual:!!manual,
              apiId:_mt.apiId,actionId:_mt.actionId,dev:_mt.dev,trigger:_mt.trigger,
              warn:(req.warnings&&req.warnings.length)?req.warnings:undefined};
  let httpStatus=0;
  return fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
    .then(function(r){httpStatus=r.status;return r.json().catch(function(){return null;});})
    .then(function(res){
      if(!res||typeof res!=="object"){
        restLog(Object.assign({},base,{ok:false,ms:el(),
          err:_ra3T("Serwer zwrócił nieczytelną odpowiedź (HTTP "+httpStatus+").",
                    "The server returned an unreadable response (HTTP "+httpStatus+").")}));
        if(manual)_ra3Say(_ra3T("Serwer RibbitFlip zwrócił nieczytelną odpowiedź.","The RibbitFlip server returned an unreadable response."));
        return fin(null);
      }
      const ok=res.ok===true;
      const ms=(typeof res.ms==="number"&&isFinite(res.ms))?Math.round(res.ms):el();
      const entry=Object.assign({},base,{ok:ok,ms:ms});
      if(ok){
        entry.status=res.status|0;
        entry.reason=_ra3Str(res.reason,80);
        entry.ctype=_ra3Str(res.headers&&res.headers["content-type"],120);
        // Location often echoes our own URL, credential query parameter included — mask it like a URL.
        entry.location=_ra3Mask(_ra3Str(res.headers&&res.headers.location,500),req.secretsUsed);
        entry.truncated=!!res.truncated;
        entry.body=_ra3Mask(_ra3Str(res.body).slice(0,RA3_BODY_PREVIEW),req.secretsUsed);
      }else{
        // a server-side error description can quote the address — mask it too
        // the server's gate refusals carry an English twin (errorEn); show it in the English panel
        const _err=(typeof _lang!=="undefined"&&_lang==="en"&&res.errorEn)?res.errorEn:res.error;
        entry.err=_ra3Mask(_ra3Str(_err,400),req.secretsUsed)||_ra3T("Wysyłka się nie udała.","The request failed.");
        // The OBS transport answers with a CODE as well. The server writes Polish without
        // diacritics (its whole file does, for the console), and this line is read in the send
        // log, not in a console — so the panel says it properly, in the panel's own language.
        if(ws){
          const c=_ra3Str(res.code,32);
          if(c==="no-link")entry.err=_ra3T("Nie połączono z OBS — otwórz połączenie w karcie „OBS Studio” u góry ekranu.",
                                           "Not connected to OBS — open the connection in the “OBS Studio” card at the top of this screen.");
          else if(c==="link-lost")entry.err=_ra3T("Połączenie z OBS zostało zerwane — połącz się jeszcze raz.",
                                                  "The connection to OBS was lost — connect again.");
          else if(c==="timeout")entry.err=_ra3T("OBS nie odpowiedział w wyznaczonym czasie.",
                                                "OBS did not answer in time.");
          else if(c==="bad-data")entry.err=_ra3T("Dane żądania OBS muszą być obiektem JSON.",
                                                 "The OBS request data must be a JSON object.");
          else if(c==="no-requesttype")entry.err=_ra3T("Ta akcja nie ma nazwy żądania OBS.",
                                                       "This action has no OBS request name.");
          else if(c==="obs-refused"){
            const cm=_ra3Str(res.comment,300);
            entry.err=_ra3T("OBS odmówił (kod "+(res.status|0)+")","OBS refused (code "+(res.status|0)+")")
                      +(cm?(": "+cm):".");
          }
        }
        if(manual)_ra3Say(entry.err);
      }
      try{restLog(entry);}catch(e){}                                     // a logging failure must never strand the in-flight counter
      return fin(res);
    },function(){
      restLog(Object.assign({},base,{ok:false,ms:el(),
        err:_ra3T("Nie udało się połączyć z serwerem RibbitFlip.","Could not reach the RibbitFlip server.")}));
      if(manual)_ra3Say(_ra3T("Nie udało się połączyć z serwerem RibbitFlip.","Could not reach the RibbitFlip server."));
      return fin(null);
    });
}
// THE MODULE SWITCH GATES EVERY SEND, the hand-fired one included. It used to gate only triggers,
// which made this the one module in the app whose "Off" did not mean "nothing leaves here": the bar
// said Off, the overview would have said Off, and ▶ Wyślij still put a real request on the network.
// A trigger blocked this way stays SILENT (one can fire many times a second and would flood the
// log); a hand-fired send says so, in the log and in the panel, because somebody is watching.
function _ra3ModuleOff(){const c=_ra3Cfg();return !(c&&c.enabled);}
function _ra3SayOff(apiName,actionName){
  const msg=_ra3T("nie wysłano — moduł Usługi wyłączony","not sent — the Services module is off");
  restLog({apiName:_ra3Str(apiName),actionName:_ra3Str(actionName),skipped:true,note:msg});
  _ra3Say(_ra3T("Nie wysłano — moduł „Usługi sieciowe” jest wyłączony. Włącz go przełącznikiem w pasku modułu.",
                "Not sent — the “Network services” module is off. Turn it on with the switch in the module bar."));
  return Promise.resolve(null);
}
// manual=false (a trigger firing) and manual=true both require the module switch, cfg.enabled.
function restRunAction(apiId,actionId,ctx,opt){
  opt=opt||{};
  const manual=!!opt.manual;
  const api=_ra3Api(apiId),act=api?_ra3Action(api,actionId):null;
  if(!api||!act){
    restLog({apiName:_ra3Str((api&&api.name)||apiId),actionName:_ra3Str(actionId),ok:false,
      err:_ra3T("Nie znaleziono akcji o tym identyfikatorze.","No action with this id.")});
    return Promise.resolve(null);
  }
  const cfg=_ra3Cfg();
  if(!(cfg&&cfg.enabled)){
    if(!manual)return Promise.resolve(null);                           // trigger: the module is off, and silently so
    return _ra3SayOff(api.name,act.name);
  }
  if(_ra3InFlight>=RA3_MAX_INFLIGHT){
    restLog({apiName:api.name,actionName:act.name,skipped:true,
      note:_ra3T("pominięto (zajęte)","skipped (busy)")});
    return Promise.resolve(null);
  }
  const c=(++_ra3Counter);
  let req;
  try{req=restBuildRequest(api,act,Object.assign({},ctx||{},{_counter:c,manual:manual}));
    req._meta={apiId:api.id,actionId:act.id,dev:(ctx&&ctx.dev)||null,trigger:(ctx&&ctx.trigger)||null};}
  catch(e){
    const m=_ra3Mask(_ra3ErrText(e));                                   // second layer: no vault secret escapes through an error message
    restLog({apiName:api.name,actionName:act.name,ok:false,err:m});
    if(manual)_ra3Say(m);
    return Promise.resolve(null);
  }
  return _ra3Send(api,act.name,req,manual);
}
// "Connection test" — a GET at the bare base URL, carrying the API's headers and credential.
// For an OBS application there is no URL to GET, so the equivalent question is asked of OBS
// itself: GetVersion, the one request every build answers and nothing in the scene notices.
function restTestConnection(apiId){
  const api=_ra3Api(apiId);
  if(!api)return Promise.resolve(null);
  const ws=_ra3IsWs(api);
  const name=_ra3T("Test połączenia","Connection test");
  if(_ra3ModuleOff())return _ra3SayOff(api.name,name);   // the test is a real request — same gate as ▶ Wyślij
  if(!ws&&!_ra3Str(api.baseUrl).trim()){
    _ra3Say(_ra3T("Najpierw podaj adres bazowy tego API.","Give this API a base URL first."));
    return Promise.resolve(null);
  }
  if(_ra3InFlight>=RA3_MAX_INFLIGHT){
    restLog({apiName:api.name,actionName:name,skipped:true,note:_ra3T("pominięto (zajęte)","skipped (busy)")});
    return Promise.resolve(null);
  }
  const synth=ws
    ?{id:"__test",name:name,desc:"",requestType:"GetVersion",method:"GET",path:"",query:[],headers:[],bodyType:"none",body:"",credId:""}
    :{id:"__test",name:name,desc:"",method:"GET",path:"",query:[],headers:[],bodyType:"none",body:"",credId:""};
  let req;
  try{req=restBuildRequest(api,synth,{manual:true});
    req._meta={apiId:api.id,actionId:"__test"};}
  catch(e){
    const m=_ra3Mask(_ra3ErrText(e));
    restLog({apiName:api.name,actionName:name,ok:false,err:m});
    _ra3Say(m);
    return Promise.resolve(null);
  }
  return _ra3Send(api,name,req,true);
}
function restFlashApiLed(apiId){
  try{
    const root=_ra3Root();if(!root||!apiId)return;
    const led=root.querySelector('.ra-app[data-id="'+_ra3Sel(apiId)+'"] .ra-app-head .led');
    if(!led)return;
    led.classList.add("fired");
    setTimeout(function(){try{led.classList.remove("fired");}catch(e){}},RA3_LED_MS);
  }catch(e){}
}

// ===================== SEND LOG (RAM view + persistent copy on disk) =====================
// The view keeps the last RA3_LOG_MAX entries. EVERY entry is also written — after passing through
// the stateless redactor below — to Settings/ribbitflip_rest_log.jsonl (POST /rest/log, batched with
// an 800 ms debounce plus a keepalive flush when the page is hidden). The server enforces the shape,
// the limits and the rotation.
let _ra3DiskBuf=[],_ra3DiskT=0;
// Stateless redactor: the only layer that still works when the vault is LOCKED (maskValues() then
// returns [] and restMask masks nothing), and the only one that catches secrets RibbitFlip does not
// know about — tokens typed straight into an address, or OAuth responses from a foreign server whose
// access_token/code it issued itself.
const _RA3_RED_KEYS=/^(?:.*(?:access|refresh|id)_?token.*|api[_-]?key|x[_-]?api[_-]?key|secret|client_secret|password|passwd|pass|authorization|auth|token|key|signature|sig|code)$/i;
function _ra3Redact(s){
  s=_ra3Str(s);if(!s)return s;
  s=s.replace(/([?&#])([^=&#\s]{1,40})=([^&#\s]{4,})/g,function(m,p,k,v){
    return _RA3_RED_KEYS.test(k)?(p+k+"="+RA_MASK):m;});
  s=s.replace(/"([^"]{1,40})"\s*:\s*"[^"]*"/g,function(m,k){
    return _RA3_RED_KEYS.test(k)?('"'+k+'":"'+RA_MASK+'"'):m;});
  s=s.replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g,"Bearer "+RA_MASK);
  s=s.replace(/eyJ[A-Za-z0-9._-]{20,}/g,RA_MASK);   // JWT (they always start with the base64 of '{"')
  return s;
}
function _ra3DiskFlush(unload){
  while(_ra3DiskBuf.length){
    const batch=_ra3DiskBuf.splice(0,50);
    try{
      fetch("/rest/log",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({entries:batch}),keepalive:!!unload}).catch(function(){});
    }catch(e){}
  }
}
function _ra3DiskPush(e){
  const d={t:e.t,apiId:_ra3Str(e.apiId,40),apiName:_ra3Str(e.apiName,120),
    actionId:_ra3Str(e.actionId,40),actionName:_ra3Str(e.actionName,120)};
  if(e.method)d.method=e.method;
  if(e.url)d.url=_ra3Redact(e.url).slice(0,1000);
  if(e.manual!=null)d.manual=!!e.manual;
  if(e.ok!=null)d.ok=!!e.ok;
  if(e.skipped)d.skipped=true;
  if(e.note)d.note=_ra3Str(e.note,120);
  if(e.ms!=null)d.ms=e.ms|0;
  if(e.status!=null)d.status=e.status|0;
  if(e.reason)d.reason=_ra3Str(e.reason,80);
  if(e.ctype)d.ctype=_ra3Str(e.ctype,120);
  // Location: only scheme://host/path reaches the disk. The query and fragment can carry ?code= or
  // #access_token= issued by the FOREIGN server, which is outside secretsUsed and cannot be masked.
  if(e.location)d.location=_ra3Str(e.location,500).replace(/[?#].*$/,"");
  if(e.truncated)d.truncated=true;
  if(e.err)d.err=_ra3Redact(e.err).slice(0,400);
  if(e.dev)d.dev=_ra3Str(e.dev,12);
  if(e.trigger&&typeof e.trigger==="object")
    d.trigger={label:_ra3Str(e.trigger.label,80),key:_ra3Str(e.trigger.key,80),fires:e.trigger.fires|0};
  if(Array.isArray(e.warn)&&e.warn.length)
    d.warn=e.warn.slice(0,8).map(function(w){return _ra3Redact(_ra3Str(w,200));});
  // A foreign server's response body is the biggest PERSISTENT leak risk, so it is stored only on
  // an explicit opt-in (settings.logBody), truncated to 512 characters and redacted first.
  const st=(_ra3Cfg()&&_ra3Cfg().settings)||{};
  if(e.body&&st.logBody===true)d.body=_ra3Redact(_ra3Str(e.body)).slice(0,512);
  _ra3DiskBuf.push(d);
  clearTimeout(_ra3DiskT);_ra3DiskT=setTimeout(function(){_ra3DiskFlush(false);},800);
}
window.addEventListener("pagehide",function(){_ra3DiskFlush(true);});
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")_ra3DiskFlush(true);});
function restLog(entry){
  const e=Object.assign({},entry||{});
  e._id="l"+(++_ra3LogSeq);
  if(e.t==null)e.t=Date.now();
  _ra3Log.unshift(e);
  while(_ra3Log.length>RA3_LOG_MAX){const drop=_ra3Log.pop();if(drop)_ra3LogOpen.delete(drop._id);}
  restRenderLog();
  try{_ra3DiskPush(e);}catch(x){}
  return e;
}
function restClearLog(){_ra3Log.length=0;_ra3LogOpen.clear();restRenderLog();}
// Polish plural forms, borrowed from rf-39 so the two cards count the same way. Guarded by
// `typeof`, because rf-39 loads after this file and a build without it must not lose the whole line.
function _ra3Pl(n,f1,f2,f5){
  try{if(typeof _ra5Pl==="function")return _ra5Pl(n,f1,f2,f5);}catch(e){}
  return (n===1)?f1:f5;
}
function _ra3LogStats(){
  const el=document.querySelector("#raLogCard .ra-log-stats");if(!el)return;
  fetch("/rest/log?stats=1").then(function(r){return r.json();}).then(function(j){
    if(!j||j.ok!==true)return;
    const bytes=j.bytes|0,n=j.entries|0;
    // THE SIZE HAS TO BE TRUE. The old `Math.max(1,…)` reported "1 KB" for a log that does not
    // exist at all and for a freshly cleared one (56 bytes of header) alike — a number somebody
    // could go and check on disk, and not find. No file on disk gets said outright; a real file
    // under a kilobyte gets "<1 KB" rather than being rounded up into existence.
    const noFile=!Array.isArray(j.files)||!j.files.length;
    const size=noFile?_ra3T("plik jeszcze nie powstał","the file does not exist yet")
                     :(bytes<1024?"<1 KB":(Math.round(bytes/1024)+" KB"));
    el.textContent="Settings/ribbitflip_rest_log.jsonl · "+size+" · "
      +n+" "+_ra3T(_ra3Pl(n,"wpis","wpisy","wpisów"),(n===1?"entry":"entries"));
    el.removeAttribute("title");
    // The warning compares sends counted by the SERVER since it started with the lines actually in
    // the file. A gap means sends that never made it into the log — the browser was closed before
    // it flushed them, the queue overflowed, or a rotation dropped the file they were written to.
    const miss=(j.sentTotal|0)-n;
    if(miss>0){
      const w=document.createElement("span");
      w.className="ra-log-warn";
      w.textContent=" · ⚠ "+miss+" "+_ra3T(_ra3Pl(miss,"wysyłka","wysyłki","wysyłek"),(miss===1?"send":"sends"))
        +" "+_ra3T("bez wpisu","without an entry");
      w.title=_ra3T("Serwer policzył tyle wysyłek więcej, niż jest wierszy w pliku — te wysyłki nie zapisały się w dzienniku (panel zamknięto przed zapisem, kolejka się przepełniła albo plik przeszedł rotację).",
                    "The server counted this many more sends than there are lines in the file — those sends were not recorded in the log (the panel closed before the flush, the queue overflowed, or the file was rotated).");
      el.appendChild(w);
    }
  }).catch(function(){});
}
function _ra3LogList(){
  const root=_ra3Root();if(!root)return null;
  let card=root.querySelector("#raLogCard");
  if(!card){
    card=document.createElement("div");card.className="card";card.id="raLogCard";
    card.innerHTML=
      '<div class="head"><h2><span class="ra-ic" aria-hidden="true">📜</span>Dziennik wysyłek</h2>'+
        '<span class="hint">sekrety zamaskowane · zapis na dysku z rotacją</span>'+
        '<span class="ra-log-stats hint"></span>'+
        '<button type="button" class="btn xs ra-log-open" title="Otwórz folder Settings z plikiem dziennika"><span class="bic bic-folder" aria-hidden="true"></span>'+_ra3T("Folder","Folder")+'</button>'+
        '<button type="button" class="btn xs ra-log-export" title="Pobierz cały dziennik jako plik JSONL"><span class="bic bic-export" aria-hidden="true"></span>'+_ra3T("Eksportuj","Export")+'</button>'+
        '<button type="button" class="btn xs ra-log-clear" title="Wyczyść dziennik (widok ORAZ plik na dysku)">Wyczyść</button></div>'+
      '<div class="ra-body"><label class="ra-log-body-opt"><input type="checkbox" class="ra-log-bodycb">'+
        _ra3T("Zapisuj ciało odpowiedzi do pliku (⚠ odpowiedzi obcych serwerów mogą nieść ich własne tokeny)",
              "Store the response body on disk (⚠ foreign servers’ responses may carry their own tokens)")+'</label>'+
      '<div class="ra-log" id="raLogList" aria-label="Dziennik wysyłek"></div></div>';
    // Piętro 3: dziennik stoi w „Zaawansowane” (rf-35 #raAdvBody), pod sejfem.
    (root.querySelector("#raAdvBody")||root.querySelector(".ra-wrap")||root).appendChild(card);
    const cb=card.querySelector(".ra-log-clear");
    // "Clear" MUST clear the file too. Clearing only the view while the file survives is the worst
    // possible message to send: the user believes a sensitive log is gone when it is still on disk.
    // Because it DOES delete a file from disk, it asks first — the same dialog the vault and the
    // presets use for their deletions, so an irreversible click looks the same everywhere.
    if(cb)cb.addEventListener("click",async function(){
      _ra3Touch();
      let ok=true;
      try{
        if(typeof rfConfirm==="function")ok=await rfConfirm(
          _ra3T("Zniknie zarówno lista na ekranie, jak i plik Settings/ribbitflip_rest_log.jsonl na dysku. Tego nie da się cofnąć.",
                "Both the list on screen and the file Settings/ribbitflip_rest_log.jsonl on disk will be gone. This cannot be undone."),
          {title:_ra3T("Wyczyścić dziennik wysyłek?","Clear the send log?"),
           icon:'<span class="rfm-bin"></span>',tone:"danger",
           confirmLabel:_ra3T("Wyczyść dziennik","Clear the log"),cancelLabel:_ra3T("Anuluj","Cancel")});
      }catch(e){}
      if(!ok)return;
      restClearLog();_ra3Touch();
      fetch("/rest/log/clear",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})
        .then(function(r){return r.json();})
        .then(function(){_ra3LogStats();})
        .catch(function(){});
    });
    const ob=card.querySelector(".ra-log-open");
    // ODPOWIEDŹ SERWERA JEST CZYTANA (2026-09-12). Do tej pory to było `fetch(...).catch(()=>{})`:
    // zero `.then`, pusty `.catch`. Serwer odsyłał `{"ok":false,"error":"…"}` albo otwierał okno,
    // które nie mogło wejść na wierzch — a na ekranie w obu przypadkach nie działo się NIC, więc
    // przycisk czytało się jako zepsuty. Trzy odpowiedzi, trzy różne zdania:
    //   okno wyszło na wierzch  → milczymy, bo widać efekt (drugi komunikat byłby hałasem),
    //   okno się otwarło z tyłu → mówimy, gdzie go szukać, i dajemy ścieżkę do schowka,
    //   nie otwarło się wcale   → mówimy, co powiedział system.
    // WHY: the button answered with silence whatever happened — success, failure and
    // "opened behind the browser" were indistinguishable.
    if(ob)ob.addEventListener("click",function(){_ra3Touch();
      fetch("/rest/log/open",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})
        .then(function(r){return r.json();})
        .then(function(j){
          j=j||{};
          const where=_ra3Str(j.path,400)||"Settings";
          const copy={label:_ra3T("Kopiuj ścieżkę","Copy the path"),
                      onClick:function(){try{navigator.clipboard&&navigator.clipboard.writeText(where);}catch(e){}}};
          if(j.ok!==true){
            _ra3Toast(_ra3T("Nie udało się otworzyć folderu","Could not open the folder")
              +(j.error?(": "+String(j.error).slice(0,160)):"."),"danger");
            return;
          }
          if(j.fronted===false)
            rfToast(_ra3T("Folder z dziennikiem jest otwarty, ale okno nie weszło na wierzch — poszukaj go na pasku zadań.",
                          "The log folder is open, but its window did not come to the front — look for it on the taskbar."),
                    {action:copy});
        })
        .catch(function(){
          _ra3Toast(_ra3T("Nie udało się otworzyć folderu — aplikacja nie odpowiedziała.",
                          "Could not open the folder — the application did not answer."),"danger");
        });});
    const eb=card.querySelector(".ra-log-export");
    if(eb)eb.addEventListener("click",function(){_ra3Touch();
      fetch("/rest/log?limit=0").then(function(r){return r.json();}).then(function(j){
        if(!j||j.ok!==true)return;
        const txt=(j.entries||[]).map(function(e){return JSON.stringify(e);}).join("\n");
        const blob=new Blob([txt],{type:"application/x-ndjson"});
        const a=document.createElement("a");a.href=URL.createObjectURL(blob);
        a.download="ribbitflip-rest-log.jsonl";a.click();
        setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
      }).catch(function(){});});
    const bc=card.querySelector(".ra-log-bodycb");
    if(bc){
      const st=(_ra3Cfg()&&_ra3Cfg().settings)||{};
      bc.checked=st.logBody===true;
      bc.addEventListener("change",function(){
        const cfg=_ra3Cfg();if(!cfg)return;
        cfg.settings=cfg.settings||{};cfg.settings.logBody=bc.checked;
        if(typeof restSave==="function")restSave();
        _ra3Touch();
      });
    }
    _ra3LogStats();
  }
  return card.querySelector("#raLogList");
}
function _ra3LogCls(e){
  if(e.skipped)return "warn";
  if(e.ok!==true)return "bad";
  const s=e.status|0;
  if(s>=200&&s<300)return "ok";
  if(s>=300&&s<400)return "warn";                                      // the proxy does not follow redirects, so a 3xx is worth flagging
  return "bad";
}
function _ra3Clock(ts){
  try{
    const d=new Date(ts),p=function(n){return (n<10?"0":"")+n;};
    return p(d.getHours())+":"+p(d.getMinutes())+":"+p(d.getSeconds());
  }catch(e){return "";}
}
function restRenderLog(){
  const list=_ra3LogList();
  if(!list)return;
  list.innerHTML="";
  if(!_ra3Log.length){
    list.appendChild(_ra3EmptyEl(_ra3T("Dziennik jest pusty.","The log is empty."),
      _ra3T("Wyślij akcję przyciskiem ▶ albo sprawdź adres przyciskiem „Test połączenia”. Wynik pojawi się tutaj.",
            "Send an action with ▶ or check the address with “Connection test”. The result will show up here.")));
    return;
  }
  for(const e of _ra3Log){
    const cls=_ra3LogCls(e);
    const row=document.createElement("div");
    row.className="ra-log-row "+cls+(e._hist?" hist":"");   // entries restored from disk are greyed out
    const t=document.createElement("span");t.className="ra-log-t";t.textContent=_ra3Clock(e.t);
    const src=document.createElement("span");src.className="ra-log-src";
    src.textContent=(_ra3Str(e.apiName)||"—")+" · "+(_ra3Str(e.actionName)||"—");
    src.title=src.textContent;
    const req=document.createElement("span");req.className="ra-log-req";
    if(e.method){const m=document.createElement("b");m.textContent=e.method;req.appendChild(m);}
    const u=document.createElement("span");u.className="ra-log-url";u.textContent=_ra3Str(e.url);u.title=u.textContent;
    req.appendChild(u);
    const st=document.createElement("span");st.className="ra-log-st";
    if(e.skipped)st.textContent=_ra3Str(e.note)||_ra3T("pominięto","skipped");
    else if(e.ok===true)st.textContent=(e.status|0)+(e.reason?(" "+e.reason):"");
    else st.textContent=_ra3T("błąd","error");
    const ms=document.createElement("span");ms.className="ra-log-ms";
    ms.textContent=(e.ms!=null)?(e.ms+" ms"):"";
    row.appendChild(t);row.appendChild(src);row.appendChild(req);row.appendChild(st);row.appendChild(ms);
    const detail=(e.ok===true)?_ra3Str(e.body):_ra3Str(e.err);
    const box=document.createElement("div");box.className="ra-log-detail";
    const open=_ra3LogOpen.has(e._id);
    box.hidden=!open;
    if(detail||e.location){
      const x=document.createElement("button");
      x.type="button";x.className="ra-log-x";x.textContent=open?"▴":"▾";
      x.title="Pokaż lub ukryj odpowiedź";x.setAttribute("aria-label",x.title);
      x.setAttribute("aria-expanded",open?"true":"false");
      x.addEventListener("click",function(){
        const now=!_ra3LogOpen.has(e._id);
        if(now)_ra3LogOpen.add(e._id);else _ra3LogOpen.delete(e._id);
        box.hidden=!now;x.textContent=now?"▴":"▾";x.setAttribute("aria-expanded",now?"true":"false");
      });
      row.appendChild(x);
      const meta=[];
      if(e.ctype)meta.push(e.ctype);
      if(e.location)meta.push("Location: "+e.location);
      if(e.truncated)meta.push(_ra3T("odpowiedź obcięta","response truncated"));
      if(meta.length){const mm=document.createElement("div");mm.className="ra-log-meta";mm.textContent=meta.join(" · ");box.appendChild(mm);}
      const pre=document.createElement("div");pre.className="ra-pre";pre.textContent=detail;box.appendChild(pre);
    }else{
      const sp=document.createElement("span");sp.className="ra-log-x ra-log-x-off";sp.setAttribute("aria-hidden","true");sp.textContent="";
      row.appendChild(sp);
    }
    list.appendChild(row);
    if(box.childNodes.length)list.appendChild(box);
  }
}

// ===================== UI — the list of APIs =====================
function _ra3ApisBox(){
  const root=_ra3Root();if(!root)return null;
  let box=root.querySelector("#raApisBody");
  if(box)return box;
  let card=root.querySelector("#raApisCard");
  if(!card){                                                           // fallback: build the card if the shell did not
    card=document.createElement("div");card.className="card";card.id="raApisCard";
    card.innerHTML='<div class="head"><h2><span class="ra-ic" aria-hidden="true">⚡</span>Aplikacje i usługi</h2>'+
      '<span class="hint">biblioteka akcji i wyzwalaczy, osobno dla każdej aplikacji</span></div>'+
      '<div class="ra-body" id="raApisBody"></div>';
    (root.querySelector(".ra-wrap")||root).appendChild(card);
  }
  return card.querySelector("#raApisBody");
}
function restRenderApis(){
  const box=_ra3ApisBox();
  if(box){
    box.innerHTML="";
    // THE TEMPLATE IS THE MAIN WAY IN (P-G3-13). Most people come for Discord, ntfy or OBS, and a
    // template brings the actions and the address with it; an empty application of one's own is
    // the second door. Same pair in the empty state below.
    const hasTpl=(typeof restAddApiFromTemplate==="function");
    const openTpl=function(){_ra3Touch();try{restAddApiFromTemplate();}catch(e){}};
    const addOwn=function(){_ra3Touch();restAddApi(null);};
    const bar=document.createElement("div");bar.className="ra-toolbar";
    const apis=_ra3Apis();
    // Pusta lista ma oba przyciski w pustym stanie niżej, więc pasek nie rysuje ich drugi raz:
    // na ekranie stoi jedna akcja główna (rf-cta), a nie dwie różowe obok siebie.
    if(hasTpl&&apis.length){                                           // optional: built-in service packs
      const tpl=document.createElement("button");
      tpl.type="button";tpl.className="btn rf-cta";
      _ra3Btn(tpl,_ra3T("Wybierz szablon","Pick a template"),"bic-plus");
      tpl.title="Utwórz aplikację z gotowego szablonu";
      tpl.addEventListener("click",openTpl);
      bar.appendChild(tpl);
    }
    if(apis.length){
      const add=document.createElement("button");
      add.type="button";add.className="btn sm"+(hasTpl?"":" rf-cta");
      _ra3Btn(add,_ra3T("Dodaj własne API","Add your own API"),hasTpl?null:"bic-plus");
      add.title="Dodaj pustą aplikację docelową";
      add.addEventListener("click",addOwn);
      bar.appendChild(add);
    }
    const cnt=document.createElement("span");cnt.className="ra-toolbar-cnt";
    const n=apis.length;
    cnt.textContent=_ra3T(n+" "+_ra3Pl(n,"aplikacja","aplikacje","aplikacji"),n+" "+(n===1?"application":"applications"));
    bar.appendChild(cnt);
    box.appendChild(bar);
    if(!apis.length){
      const em=_ra3EmptyEl(
        _ra3T("Nie masz jeszcze żadnej aplikacji.","You have no applications yet."),
        _ra3T("Wysyłaj żądania HTTP do aplikacji lokalnej albo w sieci. Najszybciej zaczniesz od gotowego szablonu: ma już akcje i adres.",
              "Send HTTP requests to an app on this computer or on the network. A ready template is the fastest start: it already has the actions and the address."),
        hasTpl?_ra3T("Wybierz szablon","Pick a template"):_ra3T("Dodaj własne API","Add your own API"),
        hasTpl?openTpl:addOwn,"bic-plus");
      // the second door, quieter, next to the first
      const cta=em.querySelector(".ra-empty-cta");
      const main=cta&&cta.querySelector("button.btn");
      if(main){main.classList.remove("sm","primary");main.classList.add("rf-cta");}
      if(cta&&hasTpl){const own=document.createElement("button");own.type="button";own.className="btn sm";
        _ra3Btn(own,_ra3T("Dodaj własne API","Add your own API"));own.addEventListener("click",addOwn);cta.appendChild(own);}
      box.appendChild(em);
    }else{
      const list=document.createElement("div");list.className="ra-apps";
      for(const a of apis)if(a&&a.id)list.appendChild(_ra3ApiCard(a));
      box.appendChild(list);
    }
  }
  restRenderLog();
}
function _ra3RerenderApi(apiId){
  const api=_ra3Api(apiId);
  const root=_ra3Root();
  if(!root)return;
  const old=root.querySelector('.ra-app[data-id="'+_ra3Sel(apiId)+'"]');
  if(!old||!api){restRenderApis();return;}
  const fresh=_ra3ApiCard(api);
  old.parentNode.replaceChild(fresh,old);
}
function _ra3ShortUrl(u){
  const s=_ra3Str(u).replace(/^https?:\/\//i,"");
  return s.length>46?(s.slice(0,44)+"…"):s;
}
function _ra3ApiCard(api){
  const card=document.createElement("div");
  card.className="ra-app";
  card.dataset.id=api.id;
  card.innerHTML=
    '<div class="ra-app-head">'+
      '<span class="led" aria-hidden="true"></span>'+
      '<input type="text" class="ra-app-name" maxlength="80" title="Nazwa aplikacji" aria-label="Nazwa aplikacji">'+
      '<span class="ra-app-url" title="Adres bazowy"></span>'+
      '<span class="ra-app-cnt"></span>'+
      '<button type="button" class="ra-app-x" title="Usuń tę aplikację" aria-label="Usuń tę aplikację">✕</button>'+
    '</div>'+
    '<div class="ra-subtabs" role="tablist" aria-label="Kolejne kroki: akcja, wyzwalacz, ustawienia i test"></div>'+
    '<div class="ra-stpanel" role="tabpanel" tabindex="0"></div>';
  const nameEl=card.querySelector(".ra-app-name");
  nameEl.value=_ra3Str(api.name);
  nameEl.addEventListener("input",function(){
    api.name=_ra3Str(nameEl.value,80);_ra3Save();_ra3Touch();
  });
  const x=card.querySelector(".ra-app-x");
  x.addEventListener("click",function(){restRemoveApi(api.id);});
  // sub-tabs: ARIA tablist with roving tabindex, so arrow keys move between them
  //
  // Trzy zakładki SĄ drogą do działającego wyzwalacza, więc stoją w kolejności i rozdzielają je
  // strzałki: akcja (co wysłać) › wyzwalacz (kiedy wysłać) › ustawienia i test (czy dochodzi).
  // Osobny pasek kroków nad nimi mówił dokładnie to samo i prowadził w te same trzy miejsca —
  // więc go nie ma: robił to samo co przyciski na dole.
  // Podpowiedź pod słowem („co wysłać") została, bo to ona niosła sens; numer zastąpiła strzałka.
  const tabs=card.querySelector(".ra-subtabs");
  const defs=[["actions","Akcje","Actions","co wysłać","what to send"],
              ["triggers","Wyzwalacze","Triggers","kiedy wysłać","when to send"],
              ["settings","Ustawienia i test","Settings & test","czy dochodzi","does it arrive"]];
  defs.forEach(function(d,di){
    if(di){
      const sep=document.createElement("span");
      sep.className="ra-st-sep";sep.setAttribute("aria-hidden","true");sep.textContent="›";
      tabs.appendChild(sep);
    }
    const b=document.createElement("button");
    b.type="button";b.className="ra-st";b.dataset.st=d[0];
    b.setAttribute("role","tab");
    b.id="raSt-"+api.id+"-"+d[0];
    b.setAttribute("aria-controls","raPanel-"+api.id);
    const w=document.createElement("span");
    w.className="ra-st-w";w.textContent=_ra3T(d[1],d[2]);
    const h=document.createElement("span");
    h.className="ra-st-h";h.textContent=_ra3T(d[3],d[4]);
    b.appendChild(w);b.appendChild(h);
    // Numer kroku jest tu, a nie na ekranie: strzałka wystarczy oku, a czytnik ekranu i tak czyta
    // przyciski po kolei. Bez kropki na końcu — jednozdaniowe title są tego pilnowane testem.
    b.title=_ra3T("Krok","Step")+" "+(di+1)+": "+_ra3T(d[1],d[2])+" — "+_ra3T(d[3],d[4]);
    b.addEventListener("click",function(){_ra3Tab[api.id]=d[0];_ra3Touch();_ra3SyncTabs(api,card);});
    b.addEventListener("keydown",function(ev){
      const k=ev.key;
      if(k!=="ArrowRight"&&k!=="ArrowLeft"&&k!=="Home"&&k!=="End")return;
      ev.preventDefault();
      const all=Array.prototype.slice.call(tabs.querySelectorAll(".ra-st"));
      let i=all.indexOf(b);
      if(k==="ArrowRight")i=(i+1)%all.length;
      else if(k==="ArrowLeft")i=(i-1+all.length)%all.length;
      else if(k==="Home")i=0;else i=all.length-1;
      all[i].focus();all[i].click();
    });
    tabs.appendChild(b);
  });
  _ra3SyncTabs(api,card);
  return card;
}
// ── Droga do działającego wyzwalacza: Akcje › Wyzwalacze › Ustawienia i test ────────────
//
// Ta droga NIE ma już własnego paska. Do 13.09 stał nad pod-zakładkami osobny rząd kroków
// „① Akcja › ② Wyzwalacz › ③ Test", który prowadził dokładnie w te same trzy miejsca, co zakładki
// pod nim — dwa rzędy przycisków o tym samym znaczeniu, jeden nad drugim, więc górny
// rząd zniknął. Kolejność niosą teraz same
// zakładki: stoją w ustalonym porządku, rozdzielają je strzałki, a każda ma pod słowem podpowiedź,
// po co się do niej wchodzi. Trzecia dostaje nazwę „Ustawienia i test", bo to w niej stoi przycisk
// próby połączenia — wcześniej ostatni krok drogi wskazywał na inną zakładkę niż swój przycisk.
function _ra3SyncTabs(api,card){
  const tab=_ra3Tab[api.id]||"actions";
  const btns=card.querySelectorAll(".ra-st");
  for(const b of btns){
    const on=(b.dataset.st===tab);
    b.classList.toggle("on",on);
    b.setAttribute("aria-selected",on?"true":"false");
    b.tabIndex=on?0:-1;
  }
  // header counters
  const nA=(Array.isArray(api.actions)?api.actions.length:0);
  const nT=(Array.isArray(api.triggers)?api.triggers.length:0);
  const cnt=card.querySelector(".ra-app-cnt");
  if(cnt)cnt.textContent=_ra3T(
    nA+" "+_ra3Pl(nA,"akcja","akcje","akcji")+" · "+nT+" "+_ra3Pl(nT,"wyzwalacz","wyzwalacze","wyzwalaczy"),
    nA+" "+(nA===1?"action":"actions")+" · "+nT+" "+(nT===1?"trigger":"triggers"));
  const u=card.querySelector(".ra-app-url");
  if(u){
    // For OBS this slot says what it IS, not where it points: an OBS application has no address
    // of its own, and "bez adresu" next to it would read as something the user forgot to fill in.
    if(_ra3IsWs(api)){
      u.textContent="OBS Studio (obs-websocket)";
      u.classList.remove("none");
      u.title=_ra3T("Połączenie ustawiasz w karcie „OBS Studio” u góry ekranu",
                    "You set the connection up in the “OBS Studio” card at the top of this screen");
    }else{
      const s=_ra3ShortUrl(api.baseUrl);
      u.textContent=s||_ra3T("bez adresu","no address");
      u.classList.toggle("none",!s);
      u.title=_ra3Str(api.baseUrl)||_ra3T("Uzupełnij adres bazowy w zakładce Ustawienia i test","Fill in the base URL in the Settings & test tab");
    }
  }
  const panel=card.querySelector(".ra-stpanel");
  if(!panel)return;
  panel.id="raPanel-"+api.id;
  panel.setAttribute("aria-labelledby","raSt-"+api.id+"-"+tab);
  panel.innerHTML="";
  if(tab==="actions")_ra3RenderActions(api,panel);
  else if(tab==="settings")_ra3RenderSettings(api,panel);
  else{
    const wrap=document.createElement("div");
    wrap.className="ra-trigwrap";
    wrap.dataset.apiId=api.id;
    panel.appendChild(wrap);
    if(typeof restRenderTriggers==="function"){                        // filled in by the triggers file, if loaded
      try{restRenderTriggers(api,wrap);}
      catch(err){wrap.appendChild(_ra3EmptyEl(_ra3T("Nie udało się narysować wyzwalaczy.","Could not draw the triggers."),_ra3ErrText(err)));}
    }else{
      wrap.appendChild(_ra3EmptyEl(
        _ra3T("Wyzwalacze — dodamy w kolejnym kroku.","Triggers — coming in the next step."),
        _ra3T("Tutaj powiążesz akcje tego API z regułami z ekranu Mapowanie albo z własnym progiem ruchu.",
              "Here you will bind this API's actions to rules from the Mapping screen or to your own motion threshold.")));
    }
  }
}

// ---------- APIs: add / remove ----------
function restAddApi(seed){
  const cfg=_ra3Cfg();
  if(!cfg){_ra3Say(_ra3T("Moduł Usługi sieciowe nie jest jeszcze gotowy.","The Network services module is not ready yet."));return null;}
  if(!Array.isArray(cfg.apis))cfg.apis=[];
  if(cfg.apis.length>=40){
    _ra3Toast(_ra3T("Limit 40 aplikacji został osiągnięty.","The limit of 40 applications has been reached."),"danger");
    return null;
  }
  seed=(seed&&typeof seed==="object")?seed:{};
  const api={id:_ra3NewId("a"),
    name:_ra3Str(seed.name,80)||_ra3T("Nowe API","New API"),
    baseUrl:_ra3Str(seed.baseUrl,500),
    headers:_ra3PairsClone(seed.headers),
    credId:"",                                                          // a credential NEVER comes from a seed or an imported pack
    timeoutMs:_ra3Int(seed.timeoutMs,1,30000,10000),
    actions:[],triggers:[]};
  if(seed.transport==="ws")api.transport="ws";                          // OBS Studio, from the built-in template
  if(Array.isArray(seed.actions))for(const a of seed.actions.slice(0,120)){
    const na=_ra3NormAction(a);
    if(na)api.actions.push(na);
  }
  cfg.apis.push(api);
  // Without an address nothing can be sent, so open Settings first. An OBS application has no
  // address to give — its connection is made once, in the OBS card — so it opens on its actions.
  _ra3Tab[api.id]=(api.baseUrl||_ra3IsWs(api))?"actions":"settings";
  _ra3Save();
  restRenderApis();
  try{
    const el=_ra3Root().querySelector('.ra-app[data-id="'+_ra3Sel(api.id)+'"] .ra-app-name');
    if(el){el.focus();el.select();}
  }catch(e){}
  return api;
}
function restRemoveApi(apiId){
  const api=_ra3Api(apiId);
  if(!api)return Promise.resolve(false);
  return _ra3Confirm(_ra3T("Usunąć aplikację „"+_ra3Str(api.name)+"” razem z jej akcjami i wyzwalaczami?",
                           "Remove the application “"+_ra3Str(api.name)+"” together with its actions and triggers?"),
    {title:_ra3T("Usuń aplikację","Remove application"),tone:"danger",
     icon:'<span class="rfm-bin"></span>',
     confirmLabel:_ra3T("Usuń","Remove"),cancelLabel:_ra3T("Zostaw","Keep")}).then(function(ok){
    if(!ok)return false;
    const cfg=_ra3Cfg();
    if(!cfg||!Array.isArray(cfg.apis))return false;
    const i=cfg.apis.indexOf(api);
    if(i<0)return false;
    cfg.apis.splice(i,1);
    delete _ra3Tab[api.id];
    for(const a of (api.actions||[])){_ra3EditOpen.delete(a.id);_ra3PrevOpen.delete(a.id);}
    _ra3Save();
    restRenderApis();
    return true;
  });
}

// ---------- actions: model ----------
function _ra3NormAction(a){
  if(!a||typeof a!=="object"||Array.isArray(a))return null;
  const out={id:_ra3NewId("c"),
    name:_ra3Str(a.name,80)||_ra3T("Akcja","Action"),
    desc:_ra3Str(a.desc,200),
    method:_ra3Method(a.method),
    path:_ra3Str(a.path,1000),
    query:_ra3PairsClone(a.query),
    headers:_ra3PairsClone(a.headers),
    bodyType:_ra3BodyType(a.bodyType),
    body:_ra3Str(a.body,20000),
    credId:""};                                                         // packs and templates never carry credentials
  const rt=_ra3Str(a.requestType,64);                                   // an OBS action; absent on every HTTP one
  if(rt)out.requestType=rt;
  return out;
}
function restAddAction(apiId,seed){
  const api=_ra3Api(apiId);
  if(!api)return null;
  if(!Array.isArray(api.actions))api.actions=[];
  if(api.actions.length>=120){
    _ra3Toast(_ra3T("Limit 120 akcji w jednym API został osiągnięty.","The limit of 120 actions per API has been reached."),"danger");
    return null;
  }
  const act=seed?_ra3NormAction(seed):{id:_ra3NewId("c"),name:_ra3T("Nowa akcja","New action"),desc:"",
    method:"POST",path:"",query:[],headers:[],bodyType:"json",
    body:"{\n  \"tekst\": \"Cześć od RibbitFlipa\"\n}",credId:""};
  if(!act)return null;
  api.actions.push(act);
  _ra3EditOpen.add(act.id);
  _ra3Save();
  _ra3RerenderApi(api.id);
  try{
    const el=_ra3Root().querySelector('.ra-act[data-aid="'+_ra3Sel(act.id)+'"] .ra-f-name');
    if(el){el.focus();el.select();}
  }catch(e){}
  return act;
}
function restDuplicateAction(apiId,actionId){
  const api=_ra3Api(apiId),act=api?_ra3Action(api,actionId):null;
  if(!api||!act)return null;
  const copy=_ra3NormAction(act);
  if(!copy)return null;
  copy.name=_ra3Str(act.name,74)+" (2)";
  copy.credId=_ra3Str(act.credId,40);                                   // duplicating WITHIN one application, so the credential may stay
  api.actions.splice(api.actions.indexOf(act)+1,0,copy);
  _ra3Save();
  _ra3RerenderApi(api.id);
  return copy;
}
function restRemoveAction(apiId,actionId){
  const api=_ra3Api(apiId),act=api?_ra3Action(api,actionId):null;
  if(!api||!act)return Promise.resolve(false);
  const used=(Array.isArray(api.triggers)?api.triggers:[]).filter(function(t){return t&&t.actionId===act.id;}).length;
  const extra=used?_ra3T(" Usunę też "+used+" "+_ra3Pl(used,"wyzwalacz","wyzwalacze","wyzwalaczy")+", które z niej korzystają.",
                         " I will also remove "+used+" "+(used===1?"trigger":"triggers")+" that use it."):"";
  return _ra3Confirm(_ra3T("Usunąć akcję „"+_ra3Str(act.name)+"”?","Remove the action “"+_ra3Str(act.name)+"”?")+extra,
    {title:_ra3T("Usuń akcję","Remove action"),tone:"danger",
     icon:'<span class="rfm-bin"></span>',
     confirmLabel:_ra3T("Usuń","Remove"),cancelLabel:_ra3T("Zostaw","Keep")}).then(function(ok){
    if(!ok)return false;
    const i=api.actions.indexOf(act);
    if(i<0)return false;
    api.actions.splice(i,1);
    if(Array.isArray(api.triggers))
      api.triggers=api.triggers.filter(function(t){return !(t&&t.actionId===act.id);});
    _ra3EditOpen.delete(act.id);_ra3PrevOpen.delete(act.id);
    _ra3Save();
    _ra3RerenderApi(api.id);
    return true;
  });
}

// ---------- actions: render ----------
function _ra3RenderActions(api,host){
  const bar=document.createElement("div");
  bar.className="ra-toolbar";
  const add=document.createElement("button");
  add.type="button";add.className="btn sm primary";
  _ra3Btn(add,_ra3T("Nowa akcja","New action"),"bic-plus");
  add.title="Dodaj nową akcję do biblioteki tej aplikacji";
  add.addEventListener("click",function(){_ra3Touch();restAddAction(api.id);});
  bar.appendChild(add);
  // The card's own pack Import/Export buttons are gone: the exchange window below covers both ends
  // (its "Weź paczkę od kogoś" row opens the take-window with a disk picker, its footer downloads
  // the .json through the same restExportActions gates), so two extra buttons here were the last
  // place where file mechanics duplicated the one pattern used everywhere else.
  // The exchange door, in the third place things are saved (see rf-39l). It carries the application
  // it sits in, because a pack is always somebody's application, never a free-floating file.
  // Label, icon and tooltip match every other exchange door in the app, so the same action looks
  // the same wherever things get saved. Both strings are written in Polish and translated by the
  // dictionary: _ra3T()/_gl() in an ATTRIBUTE freezes in whatever language the card was built in,
  // because the i18n walker only ever translates from Polish.
  if(typeof rfShareHubOpen==="function"){
    const dc=document.createElement("button");
    dc.type="button";dc.className="btn sm";
    dc.setAttribute("aria-haspopup","dialog");dc.setAttribute("aria-expanded","false");
    dc.title="Podziel się na forum, zobacz cudze albo wczytaj od kogoś";
    const dcIc=document.createElement("span");
    dcIc.className="bic bic-swap";dcIc.setAttribute("aria-hidden","true");
    dc.appendChild(dcIc);dc.appendChild(document.createTextNode("Wymiana"));
    dc.addEventListener("click",function(){_ra3Touch();try{rfShareHubOpen("pack",{api:api,opener:dc});}catch(e){}});
    bar.appendChild(dc);
  }
  host.appendChild(bar);
  const acts=Array.isArray(api.actions)?api.actions:[];
  if(!acts.length){
    host.appendChild(_ra3EmptyEl(
      _ra3T("Ta aplikacja nie ma jeszcze żadnej akcji.","This application has no actions yet."),
      _ra3T("Akcja to jedna gotowa wiadomość — np. „wyślij powiadomienie”. Możesz ją wysłać ręcznie albo powiązać z wyzwalaczem.",
            "An action is one ready-made message — e.g. “send a notification”. You can send it manually or bind it to a trigger."),
      _ra3T("Nowa akcja","New action"),function(){restAddAction(api.id);},"bic-plus"));
    return;
  }
  const list=document.createElement("div");list.className="ra-acts-list";
  for(const a of acts)if(a&&a.id)list.appendChild(_ra3ActionRow(api,a));
  host.appendChild(list);
}
function _ra3SyncActHead(row,act,api){
  const n=row.querySelector(".ra-act-name");
  if(n)n.textContent=_ra3Str(act.name)||_ra3T("(bez nazwy)","(unnamed)");
  const d=row.querySelector(".ra-act-desc");
  if(d)d.textContent=_ra3Str(act.desc);
  // The right-hand pair says WHAT will go out. For HTTP that is method + path; for OBS there is
  // neither, and the honest equivalent is the request name — the only thing OBS is told.
  const ws=_ra3IsWs(api);
  const m=row.querySelector(".ra-met");
  if(m){
    const t=ws?"OBS":_ra3Method(act.method);
    m.textContent=t;m.dataset.m=t;
  }
  const p=row.querySelector(".ra-path");
  if(p){
    const s=ws?_ra3Str(act.requestType):_ra3Str(act.path);
    const dflt=ws?_ra3T("(brak żądania)","(no request)"):"/";
    p.textContent=s||dflt;
    p.title=s||dflt;
  }
}
function _ra3ActionRow(api,act){
  const row=document.createElement("div");
  row.className="ra-act";
  row.dataset.aid=act.id;
  row.innerHTML=
    '<div class="ra-act-row">'+
      '<span class="ra-act-main"><b class="ra-act-name"></b><span class="ra-act-desc"></span></span>'+
      '<span class="ra-act-ep"><span class="ra-met"></span><span class="ra-path"></span></span>'+
      '<span class="ra-act-btns">'+
        '<button type="button" class="btn xs ra-run" title="Wyślij tę akcję teraz">▶ Wyślij</button>'+
        '<button type="button" class="btn xs ra-prev" title="Podgląd żądania bez wysyłki" aria-expanded="false">👁 Podgląd</button>'+
        '<button type="button" class="btn xs ra-edit" title="Edytuj akcję" aria-label="Edytuj akcję" aria-expanded="false">✎</button>'+
        '<button type="button" class="btn xs ra-dup" title="Duplikuj akcję" aria-label="Duplikuj akcję">⧉</button>'+
        '<button type="button" class="btn xs ra-del" title="Usuń akcję" aria-label="Usuń akcję">✕</button>'+
      '</span>'+
    '</div>'+
    '<div class="ra-act-prev" hidden></div>'+
    '<div class="ra-act-edit" hidden></div>';
  _ra3SyncActHead(row,act,api);
  const prevBox=row.querySelector(".ra-act-prev");
  const editBox=row.querySelector(".ra-act-edit");
  const bPrev=row.querySelector(".ra-prev");
  const bEdit=row.querySelector(".ra-edit");
  row.querySelector(".ra-run").addEventListener("click",function(){
    _ra3Touch();
    restRunAction(api.id,act.id,{manual:true},{manual:true});
  });
  bPrev.addEventListener("click",function(){
    _ra3Touch();
    const open=!_ra3PrevOpen.has(act.id);
    if(open){_ra3PrevOpen.add(act.id);_ra3RenderPreview(api,act,prevBox);}
    else _ra3PrevOpen.delete(act.id);
    prevBox.hidden=!open;
    bPrev.setAttribute("aria-expanded",open?"true":"false");
    bPrev.classList.toggle("on",open);
  });
  bEdit.addEventListener("click",function(){
    _ra3Touch();
    const open=!_ra3EditOpen.has(act.id);
    if(open){_ra3EditOpen.add(act.id);_ra3RenderEdit(api,act,editBox,row);}
    else _ra3EditOpen.delete(act.id);
    editBox.hidden=!open;
    bEdit.setAttribute("aria-expanded",open?"true":"false");
    bEdit.classList.toggle("on",open);
  });
  row.querySelector(".ra-dup").addEventListener("click",function(){_ra3Touch();restDuplicateAction(api.id,act.id);});
  row.querySelector(".ra-del").addEventListener("click",function(){_ra3Touch();restRemoveAction(api.id,act.id);});
  if(_ra3EditOpen.has(act.id)){
    _ra3RenderEdit(api,act,editBox,row);
    editBox.hidden=false;bEdit.setAttribute("aria-expanded","true");bEdit.classList.add("on");
  }
  if(_ra3PrevOpen.has(act.id)){
    _ra3RenderPreview(api,act,prevBox);
    prevBox.hidden=false;bPrev.setAttribute("aria-expanded","true");bPrev.classList.add("on");
  }
  return row;
}

// ---------- key/value pair editor ----------
function _ra3Kv(host,arr,opt){
  opt=opt||{};
  host.innerHTML="";
  const list=document.createElement("div");
  list.className="ra-kv-list";
  host.appendChild(list);
  const draw=function(){
    list.innerHTML="";
    if(!arr.length){
      const e=document.createElement("span");
      e.className="ra-kv-none";
      e.textContent=opt.noneLab||_ra3T("— brak —","— none —");
      list.appendChild(e);
    }
    arr.forEach(function(pair,i){
      const r=document.createElement("div");r.className="ra-kv-row";
      const k=document.createElement("input");
      k.type="text";k.className="ra-kv-k";k.maxLength=200;k.value=_ra3Str(pair[0]);
      k.placeholder=opt.kPh||"nazwa";k.setAttribute("aria-label",opt.kPh||"nazwa");
      const v=document.createElement("input");
      v.type="text";v.className="ra-kv-v";v.maxLength=4000;v.value=_ra3Str(pair[1]);
      v.placeholder=opt.vPh||"wartość";v.setAttribute("aria-label",opt.vPh||"wartość");
      const x=document.createElement("button");
      x.type="button";x.className="ra-kv-x";x.textContent="✕";
      x.title="Usuń ten wiersz";x.setAttribute("aria-label","Usuń ten wiersz");
      k.addEventListener("input",function(){pair[0]=k.value;_ra3Save();_ra3Touch();if(opt.onChange)opt.onChange();});
      v.addEventListener("input",function(){pair[1]=v.value;_ra3Save();_ra3Touch();if(opt.onChange)opt.onChange();});
      x.addEventListener("click",function(){arr.splice(i,1);draw();_ra3Save();_ra3Touch();if(opt.onChange)opt.onChange();});
      r.appendChild(k);r.appendChild(v);r.appendChild(x);
      list.appendChild(r);
    });
  };
  const add=document.createElement("button");
  add.type="button";add.className="btn xs ra-kv-add";
  _ra3Btn(add,opt.addLab||_ra3T("wiersz","row"),"bic-plus");
  add.addEventListener("click",function(){
    if(arr.length>=50){_ra3Toast(_ra3T("Limit 50 wierszy został osiągnięty.","The limit of 50 rows has been reached."),"danger");return;}
    arr.push(["",""]);draw();_ra3Save();_ra3Touch();
    const inp=list.querySelectorAll(".ra-kv-k");
    if(inp.length)inp[inp.length-1].focus();
    if(opt.onChange)opt.onChange();
  });
  host.appendChild(add);
  draw();
}

// ---------- placeholder chips ----------
function _ra3ChipList(){
  const out=[
    ["{{pose.tilt}}","Pochylenie kapsla 0–90°"],
    ["{{pose.pitch}}","Przechył przód-tył"],
    ["{{pose.roll}}","Przechył boczny"],
    ["{{pose.twist}}","Obrót w °/s"],
    ["{{device.id}}","Identyfikator slotu (d0, d1…)"],
    ["{{device.name}}","Nazwa kapsla"],
    ["{{trigger.label}}","Nazwa wyzwalacza (puste przy wysyłce ręcznej)"],
    ["{{trigger.key}}","Klawisz wyzwalacza"],
    ["{{trigger.fires}}","Ile razy wyzwalacz się odpalił"],
    ["{{ts.iso}}","Czas wysyłki w formacie ISO"],
    ["{{ts.unix}}","Czas wysyłki w sekundach UNIX"],
    ["{{counter}}","Licznik wysyłek w tej sesji"],
    ["{{api.name}}","Nazwa tej aplikacji"],
    ["{{action.name}}","Nazwa tej akcji"]
  ];
  for(let i=0;i<6;i++)out.push(["{{ch"+i+"}}","Surowy kanał CH"+i+" — tylko aktywny kapsel"]);
  const cfg=_ra3Cfg(),vars=(cfg&&cfg.vars&&typeof cfg.vars==="object")?cfg.vars:{};
  const keys=Object.keys(vars).slice(0,30);
  if(keys.length)for(const k of keys)out.push(["{{var."+k+"}}",_ra3T("Twoja zmienna","Your variable")+": "+k]);
  else out.push(["{{var.nazwa}}",_ra3T("Twoja zmienna — dodaj ją w karcie Zmienne","Your variable — add it in the Variables card")]);
  for(const c of _ra3CredList())out.push(["{{secret."+c.id+"}}",_ra3T("Sekret z sejfu","Secret from the vault")+": "+_ra3Str(c.name)]);
  return out;
}
function _ra3InsertToken(el,token){
  try{
    const s=(el.selectionStart==null)?el.value.length:el.selectionStart;
    const e=(el.selectionEnd==null)?s:el.selectionEnd;
    const v=el.value;
    el.value=v.slice(0,s)+token+v.slice(e);
    el.selectionStart=el.selectionEnd=s+token.length;
  }catch(err){el.value=el.value+token;}
  el.focus();
  try{el.dispatchEvent(new Event("input",{bubbles:true}));}catch(err){}
}
function _ra3Chips(host,ta){
  host.innerHTML="";
  for(const it of _ra3ChipList()){
    const b=document.createElement("button");
    b.type="button";b.className="ra-chip";
    b.textContent=it[0];b.title=it[1];b.setAttribute("aria-label",it[0]+" — "+it[1]);
    b.addEventListener("mousedown",function(ev){ev.preventDefault();});   // keep focus (and the caret) in the textarea
    b.addEventListener("click",function(){_ra3InsertToken(ta,it[0]);_ra3Touch();});
    host.appendChild(b);
  }
}

// ---------- credential picker ----------
function _ra3CredSelect(sel,current,inheritLab){
  sel.innerHTML="";
  const o0=document.createElement("option");
  o0.value="";o0.textContent=inheritLab;
  sel.appendChild(o0);
  const list=_ra3CredList();
  let found=false;
  for(const c of list){
    const o=document.createElement("option");
    o.value=c.id;
    o.textContent=_ra3Str(c.name)||c.id;
    if(c.id===current){o.selected=true;found=true;}
    sel.appendChild(o);
  }
  // Keep the stored id selected even when it cannot be resolved (vault locked, or credential
  // deleted) — dropping it here would silently rewrite the action to "no credential" on next save.
  if(current&&!found){
    const o=document.createElement("option");
    o.value=current;o.selected=true;
    o.textContent=_ra3T("(niedostępne — sejf zamknięty)","(unavailable — vault locked)");
    sel.appendChild(o);
  }
  sel.value=current||"";
}

// ---------- action edit form ----------
function _ra3RenderEdit(api,act,box,row){
  box.innerHTML=
    '<div class="ra-grid">'+
      '<label class="ra-fld"><span>Nazwa akcji</span><input type="text" class="ra-f-name" maxlength="80"></label>'+
      '<label class="ra-fld ra-wide"><span>Opis — co ta akcja robi</span><input type="text" class="ra-f-desc" maxlength="200" placeholder="np. wysyła powiadomienie na telefon"></label>'+
      '<label class="ra-fld ra-http-only"><span>Metoda</span><select class="ra-f-method"></select></label>'+
      '<label class="ra-fld ra-wide ra-http-only"><span>Ścieżka</span><input type="text" class="ra-f-path ra-mono" placeholder="/webhook/moj-hak — albo pełny adres https://…"></label>'+
      '<label class="ra-fld ra-wide ra-ws-only" hidden><span>Żądanie OBS</span><input type="text" class="ra-f-rt ra-mono" maxlength="64" placeholder="SetCurrentProgramScene"></label>'+
    '</div>'+
    '<div class="ra-sub ra-http-only"><span class="ra-sub-h">Parametry adresu</span><div class="ra-kv" data-kv="query"></div></div>'+
    '<div class="ra-sub ra-http-only"><span class="ra-sub-h">Nagłówki tej akcji</span><div class="ra-kv" data-kv="headers"></div></div>'+
    '<div class="ra-sub">'+
      '<span class="ra-sub-h ra-body-h">Treść wiadomości</span>'+
      '<div class="seg ra-seg ra-f-btype" role="radiogroup" aria-label="Typ treści"></div>'+
      '<textarea class="ra-f-body ra-mono" rows="7" spellcheck="false" aria-label="Szablon treści"></textarea>'+
      '<div class="ra-chips-h">Wstaw dane z kapsla — kliknij, żeby dodać w miejscu kursora:</div>'+
      '<div class="ra-chips"></div>'+
    '</div>'+
    '<label class="ra-fld ra-wide ra-http-only"><span>Poświadczenie tej akcji</span><select class="ra-f-cred"></select></label>';
  const q=function(s){return box.querySelector(s);};
  // The preview is the only place showing what will REALLY go on the wire, so it has to track the
  // edits: without this you would edit the body with the preview open and read a stale request.
  const prevBox=row?row.querySelector(".ra-act-prev"):null;
  const refreshPrev=function(){
    if(prevBox&&_ra3PrevOpen.has(act.id))_ra3RenderPreview(api,act,prevBox);
  };
  // OBS has no method, no path, no query, no headers and no per-action credential: it takes a
  // request NAME and one JSON object. Everything that does not exist over this transport is
  // hidden rather than disabled — a greyed-out "Metoda" would still be a question about OBS
  // that OBS never asked.
  const ws=_ra3IsWs(api);
  for(const el of box.querySelectorAll(ws?".ra-http-only":".ra-ws-only"))el.hidden=true;
  if(ws){
    for(const el of box.querySelectorAll(".ra-ws-only"))el.hidden=false;
    const bh=q(".ra-body-h");
    if(bh)bh.textContent=_ra3T("Dane żądania (JSON)","Request data (JSON)");
    const rt=q(".ra-f-rt");
    rt.value=_ra3Str(act.requestType);
    rt.addEventListener("input",function(){
      const v=_ra3Str(rt.value,64);
      if(v)act.requestType=v;else delete act.requestType;
      _ra3SyncActHead(row,act,api);_ra3Save();_ra3Touch();refreshPrev();});
  }
  const nm=q(".ra-f-name");nm.value=_ra3Str(act.name);
  nm.addEventListener("input",function(){act.name=_ra3Str(nm.value,80);_ra3SyncActHead(row,act,api);_ra3Save();_ra3Touch();refreshPrev();});
  const de=q(".ra-f-desc");de.value=_ra3Str(act.desc);
  de.addEventListener("input",function(){act.desc=_ra3Str(de.value,200);_ra3SyncActHead(row,act,api);_ra3Save();_ra3Touch();});
  const me=q(".ra-f-method");
  for(const m of RA3_METHODS){
    const o=document.createElement("option");o.value=m;o.textContent=m;
    if(m===_ra3Method(act.method))o.selected=true;
    me.appendChild(o);
  }
  me.addEventListener("change",function(){act.method=_ra3Method(me.value);_ra3SyncActHead(row,act,api);_ra3Save();_ra3Touch();refreshPrev();});
  const pa=q(".ra-f-path");pa.value=_ra3Str(act.path);
  pa.addEventListener("input",function(){act.path=_ra3Str(pa.value,1000);_ra3SyncActHead(row,act,api);_ra3Save();_ra3Touch();refreshPrev();});
  if(!Array.isArray(act.query))act.query=[];
  if(!Array.isArray(act.headers))act.headers=[];
  _ra3Kv(q('.ra-kv[data-kv="query"]'),act.query,
    {kPh:"nazwa parametru",vPh:"wartość",addLab:_ra3T("parametr","parameter"),onChange:refreshPrev});
  _ra3Kv(q('.ra-kv[data-kv="headers"]'),act.headers,
    {kPh:"nazwa nagłówka",vPh:"wartość",addLab:_ra3T("nagłówek","header"),onChange:refreshPrev});
  // body type (segmented radiogroup)
  const seg=q(".ra-f-btype"),ta=q(".ra-f-body");
  const syncSeg=function(){
    for(const b of seg.querySelectorAll("button")){
      const on=(b.dataset.bt===_ra3BodyType(act.bodyType));
      b.classList.toggle("on",on);
      b.setAttribute("aria-checked",on?"true":"false");
      b.tabIndex=on?0:-1;
    }
    const none=(_ra3BodyType(act.bodyType)==="none");
    ta.disabled=none;
    ta.classList.toggle("off",none);
    ta.placeholder=_ra3BodyPh(act.bodyType,ws);
  };
  // obs-websocket carries `requestData`, which is an object or nothing at all — "tekst" and
  // "formularz" have no meaning on this transport, so they are not offered.
  for(const bt of (ws?RA3_BODY_TYPES.filter(function(x){return x[0]==="json"||x[0]==="none";}):RA3_BODY_TYPES)){
    const b=document.createElement("button");
    b.type="button";b.dataset.bt=bt[0];
    b.setAttribute("role","radio");
    b.textContent=_ra3T(bt[1],bt[2]);
    b.addEventListener("click",function(){act.bodyType=bt[0];syncSeg();_ra3Save();_ra3Touch();refreshPrev();});
    // A roving-tabindex radiogroup without arrow-key handling leaves the unselected options
    // unreachable by keyboard, since Tab only enters the checked one. Same pattern as the sub-tabs.
    b.addEventListener("keydown",function(ev){
      const k=ev.key;
      if(k!=="ArrowRight"&&k!=="ArrowLeft"&&k!=="ArrowDown"&&k!=="ArrowUp"&&k!=="Home"&&k!=="End")return;
      ev.preventDefault();
      const all=Array.prototype.slice.call(seg.querySelectorAll("button"));
      let i=all.indexOf(b);
      if(k==="ArrowRight"||k==="ArrowDown")i=(i+1)%all.length;
      else if(k==="ArrowLeft"||k==="ArrowUp")i=(i-1+all.length)%all.length;
      else if(k==="Home")i=0;else i=all.length-1;
      all[i].focus();all[i].click();
    });
    seg.appendChild(b);
  }
  ta.value=_ra3Str(act.body);
  ta.addEventListener("input",function(){act.body=_ra3Str(ta.value,20000);_ra3Save();_ra3Touch();refreshPrev();});
  syncSeg();
  _ra3Chips(q(".ra-chips"),ta);
  const cs=q(".ra-f-cred");
  _ra3CredSelect(cs,_ra3Str(act.credId),_ra3T("— jak w ustawieniach API —","— same as API settings —"));
  cs.addEventListener("change",function(){act.credId=_ra3Str(cs.value,40);_ra3Save();_ra3Touch();refreshPrev();});
}
function _ra3BodyPh(bt,ws){
  bt=_ra3BodyType(bt);
  if(ws)return (bt==="none")?"To żądanie nie potrzebuje danych."
                           :"{\n  \"sceneName\": \"{{var.OBS_SCENA}}\"\n}";
  if(bt==="json")return "{\n  \"tekst\": \"🐸 {{trigger.label}}\"\n}";
  if(bt==="form")return "nazwa=wartość\ntemat={{var.temat}}";
  if(bt==="none")return "Ta akcja nie wysyła treści.";
  return "Zwykły tekst — możesz użyć {{placeholderów}}.";
}

// ---------- request preview (dry run — builds the request but never sends it) ----------
function _ra3RenderPreview(api,act,box){
  box.innerHTML="";
  let req=null,err=null;
  try{req=restBuildRequest(api,act,{manual:true,preview:true});}
  catch(e){err=e;}
  if(err){
    const bad=document.createElement("div");
    bad.className="ra-pre bad";
    bad.textContent=_ra3T("Nie mogę zbudować żądania: ","Cannot build the request: ")+_ra3Mask(_ra3ErrText(err));
    box.appendChild(bad);
    return;
  }
  // An OBS request has no method line and no headers, so showing an empty one would be showing a
  // shape it does not have. It is quoted the way it goes on the wire instead: op 6 with a name.
  const lines=req.ws
    ?["obs-websocket → "+_ra3Str(req.requestType)]
    :[req.method+" "+_ra3Mask(req.url,req.secretsUsed)];
  if(!req.ws)for(const k of Object.keys(req.headers)){
    // authorization headers are masked ENTIRELY — not even the scheme plus a partial value
    lines.push(k+": "+(RA3_SECRET_HDR.test(k)?_ra3MaskStr():_ra3Mask(req.headers[k],req.secretsUsed)));
  }
  if(req.body!=null){lines.push("");lines.push(_ra3Mask(req.body,req.secretsUsed));}
  else if(req.ws)lines.push(_ra3T("(bez danych)","(no data)"));
  const pre=document.createElement("div");
  pre.className="ra-pre";
  pre.textContent=lines.join("\n");
  box.appendChild(pre);
  const info=document.createElement("div");
  info.className="ra-prev-note";
  info.textContent=_ra3T("Podgląd — nic nie zostało wysłane. Sekrety są zamaskowane; limit czasu: "+req.timeoutMs+" ms.",
                         "Preview — nothing was sent. Secrets are masked; timeout: "+req.timeoutMs+" ms.");
  box.appendChild(info);
  if(req.warnings.length){
    const w=document.createElement("ul");
    w.className="ra-warns";
    for(const t of req.warnings){const li=document.createElement("li");li.textContent="⚠ "+t;w.appendChild(li);}
    box.appendChild(w);
  }
}

// ---------- "Settings" sub-tab ----------
function _ra3RenderSettings(api,host){
  const box=document.createElement("div");
  box.className="ra-set";
  box.innerHTML=
    '<div class="ra-grid">'+
      '<label class="ra-fld ra-wide ra-http-only"><span>Adres bazowy</span><input type="text" class="ra-s-url ra-mono" maxlength="500" placeholder="https://127.0.0.1:8123 — albo pełny adres webhooka"></label>'+
      '<label class="ra-fld ra-http-only"><span>Poświadczenie</span><select class="ra-s-cred"></select></label>'+
      '<label class="ra-fld"><span>Limit czasu (ms)</span><input type="number" class="ra-s-to" min="1" max="30000" step="100"></label>'+
    '</div>'+
    '<div class="ra-sub ra-http-only"><span class="ra-sub-h">Nagłówki wspólne dla wszystkich akcji</span><div class="ra-kv" data-kv="apih"></div></div>'+
    '<div class="ra-set-bar">'+
      '<button type="button" class="btn sm ra-s-test" title="Wyślij GET na adres bazowy i sprawdź, czy aplikacja odpowiada"><span class="bic bic-connect" aria-hidden="true"></span>Test połączenia</button>'+
      '<span class="ra-set-note"></span>'+
    '</div>';
  const q=function(s){return box.querySelector(s);};
  // An OBS application has no address, no headers and no credential of its own: its connection is
  // made once, by hand, in the „OBS Studio” card at the top of this tab. Only the time limit still
  // means something — how long to wait for OBS to answer one request.
  const ws=_ra3IsWs(api);
  if(ws){
    for(const el of box.querySelectorAll(".ra-http-only"))el.hidden=true;
    const tb=q(".ra-s-test");
    _ra3Btn(tb,_ra3T("Zapytaj OBS o wersję","Ask OBS for its version"),"bic-connect");
    tb.title="Wyśle do OBS żądanie GetVersion — sprawdza samo połączenie, w scenie nic się nie zmienia";
  }
  const u=q(".ra-s-url");u.value=_ra3Str(api.baseUrl);
  u.addEventListener("input",function(){
    api.baseUrl=_ra3Str(u.value,500);_ra3Save();_ra3Touch();
    const card=host.closest?host.closest(".ra-app"):null;
    if(card){
      const el=card.querySelector(".ra-app-url");
      if(el){
        const s=_ra3ShortUrl(api.baseUrl);
        el.textContent=s||_ra3T("bez adresu","no address");
        el.classList.toggle("none",!s);
        el.title=_ra3Str(api.baseUrl);
      }
    }
  });
  const cs=q(".ra-s-cred");
  _ra3CredSelect(cs,_ra3Str(api.credId),_ra3T("— brak —","— none —"));
  cs.addEventListener("change",function(){api.credId=_ra3Str(cs.value,40);_ra3Save();_ra3Touch();});
  const to=q(".ra-s-to");to.value=_ra3Int(api.timeoutMs,1,30000,10000);
  to.addEventListener("change",function(){
    api.timeoutMs=_ra3Int(to.value,1,30000,10000);
    to.value=api.timeoutMs;_ra3Save();_ra3Touch();
  });
  if(!Array.isArray(api.headers))api.headers=[];
  _ra3Kv(q('.ra-kv[data-kv="apih"]'),api.headers,
    {kPh:"nazwa nagłówka",vPh:"wartość",addLab:_ra3T("nagłówek","header")});
  q(".ra-s-test").addEventListener("click",function(){_ra3Touch();restTestConnection(api.id);});
  const note=q(".ra-set-note");
  const vs=_ra3Vault();
  if(ws)
    note.textContent=_ra3T("Połączenie z OBS ustawiasz w karcie „OBS Studio” u góry ekranu. Wynik testu trafia do dziennika wysyłek na dole.",
                           "You set the OBS connection up in the “OBS Studio” card at the top of this screen. The test result lands in the send log at the bottom.");
  else if(api.credId&&!vs.ready)
    note.textContent=_ra3T("Sejf jest zamknięty — akcje z poświadczeniem nie wyjdą, dopóki go nie odblokujesz.",
                           "The vault is locked — actions with a credential will not go out until you unlock it.");
  else
    note.textContent=_ra3T("Wynik testu trafia do dziennika wysyłek na dole ekranu.",
                           "The test result lands in the send log at the bottom of the screen.");
  host.appendChild(box);
}


