"use strict";
// ======= Uslugi sieciowe — triggers (Mapping rules + own motion thresholds) =======
// This file owns the "Triggers" sub-tab of an API card and the engine behind it: rules coming from the
// Mapping tab (kind:"rule") and self-contained motion thresholds (kind:"motion").
// It provides restRenderTriggers(api,wrap), called by the API card renderer, plus two hooks that
// routeEvent calls on incoming packets: restOnTrigFire(dev,m) for "tf" and restOnPose(dev,m) for "pv".
//
// RULES OF THE ENGINE:
//  • Engine state (over/since/fired/lastFire) lives ONLY in RAM (the _ra4St Map), never in RESTAPI.cfg:
//    cfg is written to disk and the sanitizer would drop it anyway.
//  • Source values are computed in RAW UNITS (tilt/pitch/roll in °, twist in °/s, CH0–CH5 in LSB),
//    not normalized to 0..1, because the user's threshold is entered in those same units.
//  • CH0–CH5 exist ONLY for the active slot. For any other slot this counts as no data: do not fire
//    and do NOT substitute zero.
//  • Missing data never "releases" a condition — the state is left exactly as it was, so a gap in the
//    stream can never cause a false re-arm and a spurious second send.

// ---------- engine constants ----------
const RA4_HYST=0.05;                 // re-arm hysteresis: 5% of the threshold…
const RA4_HYST_MIN=0.5;              // …but never below 0.5 units, which protects a threshold of (or near) zero
const RA4_CLOCK_JUMP=5;              // [s] a stream-clock jump larger than this rebases the state (server restart)
const RA4_LIVE_MS=160;               // throttle for the live readout (~6 Hz)
const RA4_WATCH_MS=400;              // watchdog interval that falls back to "—" once the stream goes quiet
const RA4_STALE_MS=1500;             // no "pv" packet for this long ⇒ data is stale ⇒ show "—"
const RA4_STALE_S=RA4_STALE_MS/1000; // same value in stream-clock seconds (freshness of "s" samples for CH0–CH5)
const RA4_GC_MS=5000;                // how often the state map is swept
const RA4_MAX_TRIG=120;
/* PODŁOGA ODSTĘPU DLA „CIĄGŁEGO". Serwer wymusza 200 ms dla reguły bez klawisza
   (`NOACTION_MIN_INTERVAL_MS`) i robi to dokładnie z myślą o Usługach sieciowych: bez tego jeden
   wyzwalacz potrafi zasypać cudze API. Warunek liczony w przeglądarce omijał tę bramkę — pole
   przyjmowało 0 ms, czyli żądanie na każdy pakiet pozycji. Ta sama liczba, ta sama ochrona. */
const RA4_CONT_MIN_MS=200;              // triggers per API — must match the config sanitizer's own limit
const RA4_FLASH_MS=280;              // row blink on fire
const RA4_THR_LIM=1e7;               // sane threshold range (raw gyro LSB values get large)
const RA4_MAX_HITS=64;               // sufit listy zbocz dla „X razy w czasie" / „N puknięć"
// Źródła warunku — [klucz, etykieta PL, etykieta EN, jednostka, krok pola, min suwaka, max suwaka].
//
// Kolejność i NAZWY są takie same jak w Mapowaniu (rf-10 `FILTER_METRICS`), bo to jeden i ten sam
// pomiar; dwie nazwy na jedną rzecz zmuszają człowieka do tłumaczenia sobie ekranu na ekran.
// Zakresy suwaków też stamtąd: pochylenie 0–180 (serwer: `POSE_AXIS_FULL`), przechyły ±90,
// obrót ±720, wirowanie 0–30000 LSB.
//
// ⚠️ „Pochylenie (0–90°)" było NIEPRAWDĄ — serwer liczy 0..180 i suwak w Mapowaniu tam sięga.
// Kto chciał wyzwalacza „pochylenie > 120°", czytał tutaj, że taka wartość nie istnieje.
/* ⭐ JEDNO ŹRÓDŁO NAZW I LICZB, NIE TRZECIA KOPIA.
   Do 12.09 ta tablica była przepisana ręcznie — i to była TRZECIA równoległa kopia tego samego
   słownika (rf-10 `FILTER_METRICS` dla Mapowania, rf-35 `RA_SOURCES` dla sanityzatora, ta tutaj
   dla karty). Kopie realnie się rozjeżdżały i wiadomo, ile to kosztowało: „Wirowanie" istniało
   w Mapowaniu, a w Usługach było nieosiągalne, dopóki ktoś nie dopisał go ręcznie w drugim
   miejscu; „Pochylenie (0–90°)" mówiło tu nieprawdę, bo serwer liczy 0..180 — kto chciał progu
   „pochylenie > 120°", czytał tutaj, że taka wartość nie istnieje.
   Teraz polskie nazwy, jednostki i zakresy suwaków przychodzą Z `FILTER_METRICS`. Lokalne zostaje
   WYŁĄCZNIE to, czego tamta tablica nie ma: nazwa angielska i krok suwaka. Kolejność pozycji jest
   wypisana wprost, bo w rozwijaku Usług pochyły stoją obok siebie (tilt · pitch · roll), a w
   `FILTER_METRICS` obrót wchodzi między nie — a zmiana kolejności pozycji w liście, na którą ktoś
   patrzy od miesięcy, to zmiana widoczna, nie refaktor.
   ⚠️ Kanałów CH0–CH5 w `FILTER_METRICS` nie ma i mieć nie będzie: to nie są wielkości filtra
   orientacji, tylko surowe kanały czujnika. Zostają wypisane tutaj, tak jak wypisuje je karta
   warunku Mapowania. */
const RA4_POSE_ORDER=["tilt","pitch","roll","twist","spin"];
const RA4_POSE_EN={tilt:"Tilt",pitch:"Pitch (front-back)",roll:"Roll (side to side)",
                   twist:"Twist",spin:"Spin (|gyro|)"};
const RA4_POSE_STEP={tilt:1,pitch:1,roll:1,twist:5,spin:100};
const RA4_SRC=(function(){
  const fm=(typeof FILTER_METRICS!=="undefined")?FILTER_METRICS:[];
  const wg={};
  fm.forEach(function(m){wg[m[0]]=m;});
  const out=[];
  RA4_POSE_ORDER.forEach(function(k){
    const m=wg[k];
    if(!m)return;                                 // metryka zniknęła ze wspólnego słownika
    out.push(["pose."+k,m[1],RA4_POSE_EN[k]||m[1],m[2],RA4_POSE_STEP[k]||1,m[3],m[4]]);
  });
  [["ch0","żyro X","gyro X"],["ch1","żyro Y","gyro Y"],["ch2","żyro Z","gyro Z"],
   ["ch3","akcel X","accel X"],["ch4","akcel Y","accel Y"],["ch5","akcel Z","accel Z"]]
    .forEach(function(c){
      const nr=c[0].toUpperCase();
      out.push([c[0],nr+" · "+c[1],nr+" · "+c[2],"LSB",100,-32768,32768]);
    });
  return out;
})();
// Sześć operatorów karty warunku Mapowania, co do znaku i co do słowa (rf-12 `condCardHtml`).
const RA4_CMPS=[[">","wart. > próg","value > threshold"],
                ["<","wart. < próg","value < threshold"],
                [">=","wart. ≥ próg","value ≥ threshold"],
                ["<=","wart. ≤ próg","value ≤ threshold"],
                ["in","w zakresie x..y","within x..y"],
                ["out","poza zakresem x..y","outside x..y"]];
// Zachowania — nazwy z paska „Zachowanie" w Mapowaniu. Brakuje dwóch z siedmiu i to jest decyzja,
// nie przeoczenie: „Przytrzymaj" opisuje TRZYMANIE (naciśnięcie i puszczenie), a „Przełącznik" —
// STAN, natomiast żądanie HTTP jest pojedynczym zdarzeniem i nie ma czym puścić ani czym trwać.
//
// ⚠️ TU STAŁO ZDANIE NIEPRAWDZIWE: „kto ich potrzebuje, bierze źródło «Reguła z Mapowania» —
// reguła niesie oba". NIE NIESIE. Zdarzenie `tf`, z którego żyje ta droga, publikuje się na
// serwerze WYŁĄCZNIE dla `kind in ("tap","down")` (`_do_action` w ribbitflip_monitor.py), więc
// puszczenie „Przytrzymaj" nie wysyła stąd nic. Przy „Przełączniku" `tf` leci na OBU stronach,
// ale pakiet jest identyczny — wyzwalacz nie odróżni włączenia od wyłączenia. Czyli: „żądanie
// przy puszczeniu" i „raz włącz / raz wyłącz" są dziś nieosiągalne ŻADNĄ drogą. Brak tych dwóch
// pozycji zostaje (bo są bez sensu dla żądania HTTP), ale nie odsyłamy już po nie donikąd.
const RA4_MODES=[["once","Jednorazowo","Once"],
                 ["continuous","Ciągłe","Continuous"],
                 ["dwell","Po odczekaniu","After a wait"],
                 ["multi","X razy w czasie","N times within"],
                 ["taps","Dokładnie N puknięć","Exactly N taps"]];
const RA4_KINDS=[["rule","Reguła z Mapowania","Rule from Mapping"],
                 ["motion","Własny próg ruchu","Own motion threshold"]];

// ---------- runtime state (OUTSIDE cfg — none of this reaches the disk) ----------
const _ra4St=new Map();              // "apiId|trigId|devId" → {over,since,fired,lastFire,tPrev}
const _ra4Fires=new Map();           // "apiId|trigId" → fire counter (summed over capsules, UI only)
const _ra4Live=[];                   // [{el,apiId,tid,last}] — live readouts currently shown in the UI
const _ra4PoseAt=Object.create(null);// devId → Date.now() of its last "pv" packet (readout freshness)
let _ra4TickAt=0;                    // throttle for the live readout
let _ra4Watch=0;                     // watchdog interval id (0 = not running)
let _ra4GcAt=0;                      // when the state map was last swept

// ---------- bridges to the other REST files (typeof-guarded so a missing piece degrades gracefully) ----------
function _ra4Cfg(){
  try{if(typeof RESTAPI!=="undefined"&&RESTAPI&&RESTAPI.cfg&&typeof RESTAPI.cfg==="object")return RESTAPI.cfg;}catch(e){}
  try{if(window.RESTAPI&&window.RESTAPI.cfg)return window.RESTAPI.cfg;}catch(e){}
  return null;
}
function _ra4Root(){
  try{if(typeof restRoot!=="undefined"&&restRoot)return restRoot;}catch(e){}
  try{if(window.RESTAPI&&window.RESTAPI.root)return window.RESTAPI.root;}catch(e){}
  try{return document.getElementById("tab-restapi")||null;}catch(e){}
  return null;
}
function _ra4Save(){try{if(typeof restSave==="function")restSave();}catch(e){}}
function _ra4Touch(){try{if(typeof _raTouch==="function")_raTouch();}catch(e){}}
function _ra4T(pl,en){try{if(typeof _gl==="function")return _gl(pl,en);}catch(e){}return pl;}
function _ra4Toast(msg,tone){try{if(typeof rfToast==="function")rfToast(msg,tone?{tone:tone}:undefined);}catch(e){}}
function _ra4Confirm(msg,opt){
  try{if(typeof rfConfirm==="function")return rfConfirm(msg,opt);}catch(e){}
  return Promise.resolve(true);
}
function _ra4NewId(pfx){
  try{if(typeof _raNewId==="function")return _raNewId(pfx);}catch(e){}
  return pfx+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);
}
function _ra4EmptyEl(title,sub,ctaLab,ctaFn,ctaIcon){
  try{if(typeof _raEmpty==="function")return _raEmpty(title,sub,ctaLab,ctaFn,ctaIcon);}catch(e){}
  const d=document.createElement("div");d.className="ra-empty";
  const b=document.createElement("b");b.textContent=title;d.appendChild(b);
  if(sub){const s=document.createElement("span");s.textContent=sub;d.appendChild(s);}
  if(ctaLab){const w=document.createElement("div");w.className="ra-empty-cta";
    const btn=document.createElement("button");btn.type="button";btn.className="btn sm primary";_ra4Btn(btn,ctaLab,ctaIcon);
    btn.addEventListener("click",ctaFn);w.appendChild(btn);d.appendChild(w);}
  return d;
}
// icon (.bic-*) + plain label on a button — see _raBtnLabel in rf-35; the fallback keeps the text alone
function _ra4Btn(btn,label,icon){try{if(typeof _raBtnLabel==="function")return _raBtnLabel(btn,label,icon);}catch(e){}btn.textContent=label;return btn;}

// ---------- small helpers ----------
function _ra4Str(v,max){if(v==null)return "";const s=(typeof v==="string")?v:String(v);return max?s.slice(0,max):s;}
function _ra4Int(v,lo,hi,dflt){const n=parseInt(v,10);return isFinite(n)?Math.min(hi,Math.max(lo,n)):dflt;}
function _ra4Num(v,dflt){const n=parseFloat(v);return isFinite(n)?n:dflt;}
function _ra4Sel(id){return String(id==null?"":id).replace(/["\\\]]/g,"");}   // ids should be [A-Za-z0-9_-]; strip anyway before use in a CSS selector
function _ra4Pl(n,f1,f2,f5){
  n=Math.abs(n|0);if(n===1)return f1;
  const d=n%10,h=n%100;
  return (d>=2&&d<=4&&!(h>=12&&h<=14))?f2:f5;
}
function _ra4Apis(){const c=_ra4Cfg();if(!c)return [];if(!Array.isArray(c.apis))c.apis=[];return c.apis;}
function _ra4Api(id){for(const a of _ra4Apis())if(a&&a.id===id)return a;return null;}
function _ra4Trig(api,id){if(!api||!Array.isArray(api.triggers))return null;for(const t of api.triggers)if(t&&t.id===id)return t;return null;}
// Normalizacja zachowania idzie przez rf-35 (`_raMode`), żeby stare nazwy („cross", „while")
// były tłumaczone w JEDNYM miejscu — inaczej config zapisany przed tą zmianą wracałby po
// aktualizacji jako „Jednorazowo" i nikt by nie wiedział, dlaczego wyzwalacz przestał powtarzać.
function _ra4Mode(m){try{if(typeof _raMode==="function")return _raMode(m);}catch(e){}
  for(const x of RA4_MODES)if(x[0]===m)return m;return "once";}
function _ra4Cmp(c){for(const x of RA4_CMPS)if(x[0]===c)return c;return ">";}
function _ra4IsRange(c){c=_ra4Cmp(c);return c==="in"||c==="out";}
function _ra4CmpLab(c){c=_ra4Cmp(c);for(const x of RA4_CMPS)if(x[0]===c)return _ra4T(x[1],x[2]);return c;}
function _ra4Source(s){for(const x of RA4_SRC)if(x[0]===s)return s;return "pose.tilt";}
function _ra4SrcRow(s){s=_ra4Source(s);for(const x of RA4_SRC)if(x[0]===s)return x;return RA4_SRC[0];}
function _ra4SrcLab(s){const r=_ra4SrcRow(s);return _ra4T(r[1],r[2]);}
function _ra4Unit(s){return _ra4SrcRow(s)[3];}
function _ra4Step4(s){return _ra4SrcRow(s)[4];}
// Zakres suwaka progu. `abs` ścina dół do zera — wartość bezwzględna nigdy nie zejdzie niżej,
// a suwak sięgający −90 przy włączonym |x| pokazywałby połowę skali, po której nic nie chodzi.
function _ra4SrcMin(s,abs){const r=_ra4SrcRow(s);return abs?0:r[5];}
function _ra4SrcMax(s){return _ra4SrcRow(s)[6];}
function _ra4IsCh(s){s=String(s||"");return s.charAt(0)==="c"&&s.charAt(1)==="h";}
// Kształt warunku ruchu w JEDNYM miejscu (`_raSanMotion` z rf-35). Ten obiekt był kiedyś pisany
// literałem w siedmiu plikach naraz i każde nowe pole ginęło dokładnie w jednym przepływie.
// Fallback na wypadek, gdyby rf-35 nie zdążył się załadować, ma ten sam zestaw pól — celowo,
// bo cichy brak pola jest gorszy od braku funkcji.
function _ra4Motion(s){
  try{if(typeof _raSanMotion==="function")return _raSanMotion(s);}catch(e){}
  s=(s&&typeof s==="object")?s:{};
  const cmp=_ra4Cmp(s.cmp),rng=_ra4IsRange(cmp),thr=_ra4Num(s.threshold,0);
  return {source:_ra4Source(s.source),cmp:cmp,threshold:thr,
          thresholdHi:rng?_ra4Num(s.thresholdHi,thr):null,
          abs:s.abs===true,neg:s.neg===true,mode:_ra4Mode(s.mode),
          dwellMs:_ra4Int(s.dwellMs,0,600000,400),
          crossings:_ra4Int(s.crossings,1,20,2),windowMs:_ra4Int(s.windowMs,50,60000,600)};
}
function _ra4NewMotionSrc(dev){
  return Object.assign({kind:"motion",dev:_ra4Str(dev,24)||"any"},
                       _ra4Motion({source:"pose.tilt",cmp:">",threshold:30,mode:"once"}));
}
// Default shape of a new trigger — must match exactly what the config sanitizer expects.
function _ra4DefTrig(actionId){
  return {id:_ra4NewId("g"),actionId:_ra4Str(actionId,40),on:true,label:"",minIntervalMs:250,
          toast:{on:false,mode:"fire",silent:true},
          src:_ra4NewMotionSrc("any")};
}
// Repairs a trigger loaded from an odd config. The config sanitizer does the same job on load; this
// is the runtime safety net for objects that reach the engine by another route.
function _ra4Fix(t){
  if(!t||typeof t!=="object")return null;
  if(!t.src||typeof t.src!=="object")t.src={kind:"rule",dev:"any",ruleId:"any"};
  const s=t.src;
  if(s.kind!=="motion"&&s.kind!=="rule")s.kind="rule";
  if(typeof s.dev!=="string"||!s.dev)s.dev="any";
  if(s.kind==="motion"){
    // Naprawa W MIEJSCU (nie podmiana obiektu) — inne miejsca trzymają referencję do `t.src`.
    const fixed=_ra4Motion(s);
    for(const k in fixed)s[k]=fixed[k];
  }else if(typeof s.ruleId!=="string"||!s.ruleId)s.ruleId="any";
  t.on=(t.on!==false);
  t.label=_ra4Str(t.label,60);
  t.minIntervalMs=_ra4Int(t.minIntervalMs,0,3600000,250);
  t.actionId=_ra4Str(t.actionId,40);
  t.toast=_ra4FixToast(t.toast,s);
  return t;
}
// Windows notification for this trigger. "active" needs a condition with a state of its own, which
// only the motion kind has — a rule-kind trigger falls back to "fire" (the Mapping rule itself
// carries the "is active" option, and duplicating it here would notify twice for one state).
function _ra4FixToast(v,src){
  const on=!!(v&&typeof v==="object"&&v.on);
  const motion=!!(src&&src.kind==="motion");
  return {on:on,mode:((v&&v.mode==="active"&&motion)?"active":"fire"),
          silent:!(v&&v.silent===false),    // quiet by default, including for older configs
          text:_ra4Str(v&&v.text,120)};
}

// ---------- telemetry: where a source value comes from ----------
function _ra4ChKey(idx){
  try{if(typeof RE_NAME!=="undefined"&&RE_NAME&&RE_NAME[idx])return RE_NAME[idx];}catch(e){}
  return ["ax","ay","az","gx","gy","gz"][idx];
}
function _ra4ActiveDev(){
  try{if(typeof state!=="undefined"&&state&&state.activeDeviceId)return state.activeDeviceId;}catch(e){}
  return "d0";
}
// Which slot the UI shows a value for when the trigger says "any capsule". UI preview only — the
// engine handles every capsule separately and must not use this.
function _ra4LiveDev(dev){return (dev&&dev!=="any")?String(dev):_ra4ActiveDev();}
// Pose for any slot: the active one reads state.pose (~50 Hz), the others their poseLive (~12 Hz).
function _ra4PoseOf(dev){
  try{
    if(typeof state==="undefined"||!state)return null;
    if(dev===state.activeDeviceId&&state.pose)return state.pose;
    const D=state.devices&&state.devices[dev];
    if(D)return D.poseLive||D.pose||null;
  }catch(e){}
  return null;
}
// Kanały CH0–CH5 — dla KAŻDEGO slotu i PO STROJENIU OSI, czyli tak, jak czyta je Mapowanie.
//
// Dwie naprawy naraz (2026-09-12):
//  • „tylko aktywny kapsel" było ograniczeniem SAMONAŁOŻONYM, nie brakiem danych: strumień `/stream`
//    jest otwierany bez `?dev`, a `onSample` (rf-08) trzyma `D.last`, `D.lastSh` i `D.nowTs` dla
//    każdego slotu z osobna. Wyzwalacz na drugim kapslu po prostu nigdy nie działał, a karta
//    tłumaczyła to zdaniem, które mówiło nieprawdę o możliwościach aplikacji.
//  • `D.lastSh` to wartości PO torze strojenia kanału i ze znakiem z kalibracji 3D — dokładnie te,
//    z którymi serwer porównuje próg reguły Mapowania. Czytanie samego `D.last` (surowego) znaczyło,
//    że ten sam próg wpisany w dwóch miejscach aplikacji mierzy dwie różne wielkości, po cichu.
//    `lastSh` istnieje tylko wtedy, gdy cokolwiek jest strojone — brak klucza znaczy „nic nie kształtuje"
//    i wtedy wartość surowa JEST wartością po torze (tak samo zachowuje się reszta czytelników).
//
// Careful: the dashboard initializes state.last to an object of ALL ZEROS and only replaces it on the
// first sample. state.last alone therefore cannot tell "no data" from "a genuine zero", and a
// condition like "CH3 < 500" would be satisfied by those zeros and fire with no capsule attached.
// So freshness is judged by the TIMESTAMP of the last sample instead (the slot's nowTs, falling back
// to the global one before the slot entry exists). No sample, or a sample older than the current
// packet by RA4_STALE_S, counts as NO DATA.
// `now` (optional) is the stream clock from the packet — the same clock nowTs is measured against.
function _ra4RawOf(dev,now){
  try{
    if(typeof state==="undefined"||!state)return null;
    const D=state.devices&&state.devices[dev];
    const active=(dev===state.activeDeviceId);
    const ts=D?D.nowTs:(active?state.nowTs:null);
    if(!ts||!isFinite(ts))return null;                       // not one sample yet → never substitute zeros
    if(typeof now==="number"&&isFinite(now)&&(now-ts)>RA4_STALE_S)return null;
    if(D)return D.lastSh||D.last||null;
    return active?(state.lastSh||state.last||null):null;
  }catch(e){}
  return null;
}
// Source value in raw units; null means NO DATA (do not fire, do not substitute zero).
function _ra4Val(source,pose,raw){
  const s=String(source||"");
  if(_ra4IsCh(s)){
    const idx=parseInt(s.slice(2),10);
    if(!isFinite(idx)||idx<0||idx>5||!raw)return null;
    const v=raw[_ra4ChKey(idx)];
    return (typeof v==="number"&&isFinite(v))?v:null;
  }
  if(s.indexOf("pose.")!==0||!pose)return null;
  const v=pose[s.slice(5)];
  return (typeof v==="number"&&isFinite(v))?v:null;
}
function _ra4Fmt(v,source){
  if(v==null)return "—";
  return _ra4IsCh(source)?String(Math.round(v)):(Math.round(v*10)/10).toFixed(1);
}
// Is this slot's data fresh? "pv" packets arrive at ~12 Hz, so a 1.5 s gap means the stream stopped.
function _ra4Fresh(dev){
  const at=_ra4PoseAt[dev];
  return !!at&&(Date.now()-at)<RA4_STALE_MS;
}

// ---------- engine: state per trigger AND per capsule ----------
// The state key MUST include the capsule. Under "any capsule" (the DEFAULT) two streaming capsules
// would otherwise share one episode, and a packet from the capsule below the threshold would clear
// the over/since/fired set by the one above it. Observed consequences:
//   • "on crossing" degenerated into a repeat send every minIntervalMs,
//   • "held for a time" never fired at all, because `since` was reset before the dwell elapsed,
//   • in the rule branch a shared lastFire swallowed a simultaneous fire of the same rule on the
//     second capsule, contradicting the UI's promise that the rule fires for every capsule.
// The visible "×N" counter stays SHARED per trigger (_ra4Fires) — the user sees one total.
function _ra4Key(apiId,tid){return String(apiId)+"|"+String(tid);}
function _ra4KeyD(apiId,tid,dev){return _ra4Key(apiId,tid)+"|"+String(dev==null?"":dev).replace(/\|/g,"/");}
function _ra4TrigKey(k){const i=String(k).lastIndexOf("|");return (i<0)?String(k):String(k).slice(0,i);}
// `hits` — znaczniki czasu zbocz narastających, dla „X razy w czasie" i „Dokładnie N puknięć".
// Jak reszta stanu żyje WYŁĄCZNIE w pamięci; sanitizer configu i tak by tego nie przyjął.
function _ra4NewSt(now){return {over:false,since:0,fired:false,lastFire:-1e9,tPrev:now,hits:[]};}
function _ra4State(apiId,tid,dev,now){
  const k=_ra4KeyD(apiId,tid,dev);
  let st=_ra4St.get(k);
  if(!st){st=_ra4NewSt(now);_ra4St.set(k,st);}
  return st;
}
function _ra4Bump(apiId,tid){          // fire counter (summed over capsules) — UI only
  const k=_ra4Key(apiId,tid);
  const n=(_ra4Fires.get(k)||0)+1;
  _ra4Fires.set(k,n);
  return n;
}
function _ra4Drop(apiId,tid){          // clears this trigger's state for EVERY capsule, plus its counter
  const pfx=_ra4Key(apiId,tid);
  for(const k of Array.from(_ra4St.keys()))if(_ra4TrigKey(k)===pfx)_ra4St.delete(k);
  _ra4Fires.delete(pfx);
}
// Sweep: only keys of existing, enabled triggers may survive in the map. Without this every edit or
// removal would leave an entry behind forever — a slow memory leak.
function _ra4Gc(){
  _ra4GcAt=Date.now();
  if(!_ra4St.size&&!_ra4Fires.size)return;
  const live=new Set();
  for(const api of _ra4Apis()){
    if(!api||!Array.isArray(api.triggers))continue;
    for(const t of api.triggers)if(t&&t.id&&t.on!==false)live.add(_ra4Key(api.id,t.id));
  }
  for(const k of Array.from(_ra4St.keys()))if(!live.has(_ra4TrigKey(k)))_ra4St.delete(k);
  for(const k of Array.from(_ra4Fires.keys()))if(!live.has(k))_ra4Fires.delete(k);
}
// The stream clock (m.ts, seconds) restarts from zero when the server restarts. Rather than clearing
// the state we SHIFT it, preserving the elapsed times already measured.
// On the server side every slot's clock delegates to one shared broadcaster clock, so ALL slots run
// on a single time base and switching capsules does NOT trigger a rebase — dwell and gap keep
// counting continuously. Were each slot to keep its own base, alternating packets from two capsules
// would reset elapsed on every switch.
function _ra4Rebase(st,now){
  const p=st.tPrev;
  if(p==null||!isFinite(p)){st.tPrev=now;return;}
  const d=now-p;
  if(d>=0&&d<=RA4_CLOCK_JUMP){st.tPrev=now;return;}      // stream running normally
  const elFire=Math.max(0,p-st.lastFire);
  const elSince=st.since?Math.max(0,p-st.since):null;
  st.lastFire=now-elFire;
  if(elSince!=null)st.since=now-elSince;
  st.tPrev=now;
}
// Hysteresis margin: 5% of the threshold, at least 0.5 units. The absolute value keeps a negative
// threshold's margin positive, and the floor stops a threshold of 0 from producing a margin of 0 —
// which would let jitter on the boundary fire on every single packet.
// Przy zakresie (in/out) liczymy z większej co do wartości granicy — margines ma odpowiadać skali,
// w której ten warunek się porusza, a nie temu, która liczba stoi w polu „Od".
function _ra4Margin(src){
  const a=Math.abs(_ra4Num(src&&src.threshold,0));
  const b=_ra4IsRange(src&&src.cmp)?Math.abs(_ra4Num(src&&src.thresholdHi,a)):a;
  return Math.max(RA4_HYST_MIN,Math.max(a,b)*RA4_HYST);
}
// Czy warunek jest spełniony. Sześć operatorów Mapowania + |x| + NIE.
//
// `relax` to LUZ Schmitta, wyrażony w jednostkach źródła i przykładany NA ZEWNĄTRZ warunku:
// dodatni rozszerza go (łatwiej zostać spełnionym), ujemny zawęża. Wywołujący podaje +margines,
// gdy epizod TRWA — dzięki temu warunek puszcza dopiero po cofnięciu się o cały margines za próg,
// a nie w chwili muśnięcia granicy. Przy zaznaczonym NIE znak luzu jest odwracany przez wywołującego,
// bo „trzymać się stanu" znaczy wtedy coś przeciwnego względem warunku wewnętrznego.
function _ra4Met(v,src,relax){
  const x=(src&&src.abs===true)?Math.abs(v):v;
  const r=_ra4Num(relax,0);
  const cmp=_ra4Cmp(src&&src.cmp);
  const a=_ra4Num(src&&src.threshold,0);
  const b=_ra4IsRange(cmp)?_ra4Num(src&&src.thresholdHi,a):a;
  const lo=Math.min(a,b),hi=Math.max(a,b);
  let m;
  if(cmp==="<")       m=(x<a+r);
  else if(cmp==="<=") m=(x<=a+r);
  else if(cmp===">=") m=(x>=a-r);
  else if(cmp==="in") m=(x>=lo-r&&x<=hi+r);
  else if(cmp==="out")m=(x<lo+r||x>hi-r);
  else                m=(x>a-r);
  return (src&&src.neg===true)?!m:m;
}
// One engine step. Mutates `st`, returns true to FIRE. `now` is in SECONDS.
//
// Pięć zachowań, nazwanych i liczonych tak, jak w Mapowaniu:
//   Jednorazowo        — raz na epizod (od spełnienia do puszczenia warunku),
//   Ciągłe             — wciąż, póki spełnione, nie częściej niż „min. odstęp",
//   Po odczekaniu      — raz, po nieprzerwanym spełnieniu przez „czas utrzymania",
//   X razy w czasie    — po N przekroczeniach w przesuwnym oknie (odpala w chwili N-tego),
//   Dokładnie N puknięć— decyzja na KOŃCU okna: dokładnie N i ani jednego więcej.
// Dwa ostatnie liczą ZBOCZA, nie stan, więc muszą działać także wtedy, gdy warunek właśnie ustał —
// stąd ich gałąź stoi przed sprawdzeniem `st.over`.
function _ra4Step(st,v,src,trig,now){
  const neg=!!(src&&src.neg===true);
  const marg=_ra4Margin(src);
  const met=_ra4Met(v,src,st.over?(neg?-marg:marg):0);
  const mode=_ra4Mode(src&&src.mode);
  const counts=(mode==="multi"||mode==="taps");
  if(!st.over){
    if(met){
      st.over=true;st.since=now;st.fired=false;
      if(counts){
        if(!st.hits)st.hits=[];
        if(st.hits.length<RA4_MAX_HITS)st.hits.push(now);   // sufit: przy drganiu lista nie rośnie bez końca
      }
    }
  }else if(!met){st.over=false;st.since=0;st.fired=false;}
  const minS=_ra4Int(trig&&trig.minIntervalMs,0,3600000,250)/1000;
  if(counts){
    const winS=_ra4Int(src&&src.windowMs,50,60000,600)/1000;
    const need=_ra4Int(src&&src.crossings,1,20,2);
    const h=st.hits||(st.hits=[]);
    if(mode==="multi"){
      while(h.length&&(now-h[0])>winS)h.shift();            // okno przesuwne
      if(h.length>=need&&(now-st.lastFire)>=minS){h.length=0;st.lastFire=now;return true;}
      return false;
    }
    // „Dokładnie N puknięć": okno zaczyna PIERWSZE puknięcie i dopiero jego koniec rozstrzyga —
    // po to jest to zachowanie. Dzięki temu jedno puknięcie i dwuklik mogą stać na dwóch różnych
    // akcjach, bo pojedyncze czeka, czy nie przyjdzie drugie.
    // ⚠️ Ziarno decyzji to odstęp pakietów „pv" (~80 ms), nie 5 ms serwerowego ticku — okno krótsze
    // niż kilka pakietów będzie tu mierzone zgrubnie.
    if(!h.length)return false;
    if((now-h[0])<winS)return false;
    const n=h.length;h.length=0;
    if(n===need&&(now-st.lastFire)>=minS){st.lastFire=now;return true;}
    return false;
  }
  if(!st.over)return false;
  // minIntervalMs is a per-trigger rate guard and applies in EVERY mode.
  if(now-st.lastFire<minS)return false;
  if(mode==="continuous"){st.lastFire=now;return true;}
  if(st.fired)return false;                                 // once/dwell: one fire per episode, until re-armed
  if(mode==="dwell"){
    const need=_ra4Int(src&&src.dwellMs,0,600000,400)/1000;
    if(now-st.since<need)return false;
  }
  st.fired=true;st.lastFire=now;return true;
}
// Arming, done on create / enable / parameter change: if the condition is ALREADY satisfied, record
// it as an episode already in progress with its fire ticked off. Otherwise merely switching a
// trigger on — with the capsule perfectly still — would look like a fresh threshold crossing and
// immediately send something.
// Which capsules to arm: under "any capsule" the state is SEPARATE per slot, so each one is armed
// individually against its own current value. Otherwise a tilted capsule d1 would fire on its very
// first packet after you added "tilt > 30°" while watching a stationary d0 — exactly what arming
// exists to prevent.
function _ra4PrimeDevs(dev){
  if(dev&&dev!=="any")return [String(dev)];
  const out=[_ra4ActiveDev()];
  try{
    const d=(typeof state!=="undefined"&&state&&state.devices)?state.devices:null;
    if(d)for(const k in d)if(out.indexOf(k)<0)out.push(k);
  }catch(e){}
  return out;
}
function _ra4Prime(apiId,trig){
  if(!trig||!trig.src||trig.src.kind!=="motion")return;
  const pfx=_ra4Key(apiId,trig.id);
  for(const k of Array.from(_ra4St.keys()))if(_ra4TrigKey(k)===pfx)_ra4St.delete(k);   // discard old episodes
  const now=Date.now()/1000;
  for(const dev of _ra4PrimeDevs(trig.src.dev)){
    if(dev==null||dev==="")continue;
    const st=_ra4NewSt(now);
    const v=_ra4Val(trig.src.source,_ra4PoseOf(dev),_ra4RawOf(dev));
    if(v!=null&&_ra4Met(v,trig.src,0)){st.over=true;st.since=now;st.fired=true;st.lastFire=now;}
    _ra4St.set(_ra4KeyD(apiId,trig.id,dev),st);
  }
}

// ---------- engine: firing ----------
// Zdanie opisujące warunek — czyta się je w dymku powiadomienia i na liście wyzwalaczy.
// Składane z tych samych klocków, co karta warunku, więc opis i ustawienie zawsze mówią to samo.
function _ra4MotionLabel(src){
  const s=_ra4Source(src&&src.source),u=_ra4Unit(s);
  const cmp=_ra4Cmp(src&&src.cmp);
  const a=_ra4Num(src&&src.threshold,0);
  let what=_ra4SrcLab(s);
  if(src&&src.abs===true)what="|"+what+"|";
  let cond;
  if(_ra4IsRange(cmp)){
    const b=_ra4Num(src&&src.thresholdHi,a);
    cond=(cmp==="in"?_ra4T("w zakresie","within"):_ra4T("poza zakresem","outside"))
         +" "+Math.min(a,b)+".."+Math.max(a,b)+u;
  }else cond=cmp+" "+a+u;
  return (src&&src.neg===true?_ra4T("NIE ","NOT "):"")+what+" "+cond;
}
function _ra4Enabled(){const c=_ra4Cfg();return !!(c&&c.enabled);}
// Bramka symulacji zatrzymała wyzwalacz — zapamiętaj to i POWIEDZ. Do tej pory funkcja kończyła się
// tu cichym `return`: bez żądania, bez wpisu w dzienniku, bez migotania i bez licznika. Na ekranie
// wyglądało to identycznie jak literówka w adresie, jak wyłączony moduł i jak zepsuty wyzwalacz —
// cztery różne przyczyny, jeden obraz: nic. W całym module nie było ANI JEDNEGO zdania o tej bramce.
let _ra4SimSaid=false;
const _ra4Muted=new Map();          // "apiId|tid" → powód wyciszenia (czyta go panel „dlaczego")
function _ra4MuteNote(apiId,tid,why){
  _ra4Muted.set(_ra4Key(apiId,tid),why);
  try{if(typeof _ra4WhyPaint==="function")_ra4WhyPaint(apiId);}catch(e){}
}
// JEDNO OKNO WYSYŁA. Wyzwalacze liczy każda otwarta strona panelu, więc przy dwóch oknach
// (okno aplikacji i karta przeglądarki) każde żądanie wychodziło dwa razy, a akcja typu
// „przełącz” znosiła się sama. Okna wybierają nadawcę przez wpis w localStorage z odświeżanym
// znacznikiem czasu: pierwsze okno go bierze i odświeża co RA4_LEAD_BEAT_MS; gdy przestanie
// (zamknięte, uśpione), po RA4_LEAD_TTL_MS przejmuje inne. Okno z odblokowanym sejfem ma
// pierwszeństwo przed oknem z zamkniętym, bo tylko ono wyśle akcję z hasłem. Pozostałe okna
// wyzwalaczy nie wysyłają, tylko podświetlają wiersz. Bez localStorage (harness, tryb prywatny
// z blokadą) każde okno jest nadawcą, jak dotąd.
const RA4_LEAD_KEY="ribbitflip.rest.sender";
const RA4_LEAD_TTL_MS=4000;
const RA4_LEAD_BEAT_MS=1500;
const _ra4Me=Math.random().toString(36).slice(2)+Date.now().toString(36);
let _ra4LeadTid=0;
function _ra4LeadRead(){
  try{const v=JSON.parse(localStorage.getItem(RA4_LEAD_KEY)||"null");return (v&&typeof v==="object")?v:null;}
  catch(e){return null;}
}
function _ra4VaultReady(){try{return !!(typeof _RaVault!=="undefined"&&_RaVault.ready());}catch(e){return false;}}
// Bierze albo odświeża rolę nadawcy, gdy wolno; oddaje, czy to okno jest teraz nadawcą.
function _ra4LeadClaim(){
  const now=Date.now(),v=_ra4VaultReady(),cur=_ra4LeadRead();
  const free=!cur||cur.id===_ra4Me||(now-(+cur.t||0))>RA4_LEAD_TTL_MS||(v&&!cur.v);
  if(!free)return false;
  try{localStorage.setItem(RA4_LEAD_KEY,JSON.stringify({id:_ra4Me,t:now,v:v}));}catch(e){return true;}
  const back=_ra4LeadRead();
  return !back||back.id===_ra4Me;
}
function _ra4IsSender(){
  // Okno nakładki i ściągi to tylko podgląd: nie bierze roli nadawcy, żeby nie zabrać jej panelowi.
  try{if(/[?&](overlay=1|view=overview)/.test(location.search||""))return false;}catch(e){}
  if(typeof localStorage==="undefined")return true;
  _ra4LeadStart();
  return _ra4LeadClaim();
}
// Bez zapisu: czy nadawcą jest teraz inne, żywe okno (dla listy „dlaczego”).
function _ra4OtherSends(){
  const cur=_ra4LeadRead();
  return !!(cur&&cur.id!==_ra4Me&&(Date.now()-(+cur.t||0))<=RA4_LEAD_TTL_MS);
}
function _ra4LeadStart(){
  if(_ra4LeadTid||typeof localStorage==="undefined")return;
  _ra4LeadClaim();
  _ra4LeadTid=setInterval(_ra4LeadClaim,RA4_LEAD_BEAT_MS);
  try{window.addEventListener("pagehide",function(){
    const cur=_ra4LeadRead();
    if(cur&&cur.id===_ra4Me){try{localStorage.removeItem(RA4_LEAD_KEY);}catch(e){}}
  });}catch(e){}
}
function _ra4Fire(api,trig,info,opt){
  // SIMULATION: REST has no group switch of its own, so without this it would call real services
  // off synthetic motion the moment the panel opened. Muted until the user confirms the simulation
  // output gate (rf-39f) — outside simulation the check is a no-op.
  // Ręczny test (`opt.test`) przechodzi: to JEDNO żądanie, o które człowiek właśnie poprosił
  // kliknięciem — dokładnie tak, jak działa „▶ Wyślij" przy akcji.
  const test=!!(opt&&opt.test);
  if(!test&&typeof rfSimOutputsAllowed==="function"&&!rfSimOutputsAllowed()){
    _ra4MuteNote(api.id,trig.id,"sim");
    if(!_ra4SimSaid){
      _ra4SimSaid=true;
      _ra4Toast(_ra4T("Wyzwalacz zadziałał, ale w symulacji żądania nie wychodzą, dopóki nie potwierdzisz wyjść. Sprawdź go przyciskiem „▶ Testuj” albo włącz wyjścia w „Przeglądzie wszystkich kapsli”.",
                      "The trigger went off, but in simulation requests do not leave until you confirm the outputs. Check it with “▶ Test”, or turn the outputs on in “All capsules”."),"danger");
    }
    return;
  }
  // Inne okno panelu jest nadawcą: ono wyśle to samo żądanie. Tutaj tylko podświetlenie wiersza.
  if(!test&&!_ra4IsSender()){
    _ra4MuteNote(api.id,trig.id,"other");
    if(_ra4Enabled())_ra4Flash(api.id,trig.id,info.fires);
    return;
  }
  _ra4Muted.delete(_ra4Key(api.id,trig.id));
  const ctx={dev:info.dev,trigger:{label:info.label,key:info.key||"",fires:info.fires}};
  if(info.pose)ctx.pose=info.pose;
  if(info.raw)ctx.raw=info.raw;
  // `manual` decyduje, czy człowiek dostanie odpowiedź na ekranie. Przy teście — tak, bo o to
  // w teście chodzi; przy zadziałaniu z ruchu — nie, bo nikt nie patrzy na ten ekran.
  try{if(typeof restRunAction==="function")restRunAction(api.id,trig.actionId,ctx,{manual:test});}catch(e){}
  // 🔔 Windows notification (opt-in per trigger). Gated the same way as the row blink: with sending
  // off nothing actually leaves the machine, so announcing a send would be a lie.
  if(!test&&_ra4Enabled()&&typeof rfNotifyRestFire==="function")
    try{rfNotifyRestFire(api,trig,info);}catch(e){}
  if(_ra4Enabled())_ra4Flash(api.id,trig.id,info.fires);   // with sending off nothing goes out, so do not blink
}
// Blink the row and update its counter — only if the row happens to be on screen, and via plain
// textContent so nothing is re-rendered under the user's cursor.
function _ra4Flash(apiId,tid,fires){
  try{
    const root=_ra4Root();if(!root)return;
    const row=root.querySelector('.ra-trig[data-tid="'+_ra4Sel(tid)+'"][data-api-id="'+_ra4Sel(apiId)+'"]');
    if(!row)return;
    const c=row.querySelector(".ra-trig-cnt");
    if(c&&fires!=null)c.textContent="×"+fires;
    row.classList.add("fired");
    setTimeout(function(){try{row.classList.remove("fired");}catch(e){}},RA4_FLASH_MS);
  }catch(e){}
}
// Time source: the stream clock (m.ts, seconds) — the same one the Mapping rule engine measures
// dwell with. Falls back to wall-clock when a packet carries no timestamp; _ra4Rebase() then absorbs
// the difference between the two bases.
function _ra4Ts(m){
  const t=m&&m.ts;
  return (typeof t==="number"&&isFinite(t))?t:(Date.now()/1000);
}
function _ra4DevMatch(srcDev,dev){return (!srcDev||srcDev==="any")?true:(srcDev===dev);}
function _ra4RuleFires(dev,rid){
  try{
    if(typeof state==="undefined"||!state||!state.devices)return null;
    const D=state.devices[dev];
    const rt=D&&D.rt&&D.rt[rid];
    if(rt&&typeof rt.fires==="number"&&isFinite(rt.fires))return rt.fires;
  }catch(e){}
  return null;
}
function _ra4RuleLabel(dev,rid,m){
  const lab=m&&m.label;
  if(lab)return String(lab);
  const r=_ra4RuleById(dev,rid);
  if(r){
    if(r.label)return String(r.label);
    try{if(typeof ruleSrcLabel==="function")return String(ruleSrcLabel(r));}catch(e){}
  }
  return (m&&m.key)?String(m.key):String(rid||"");
}
function _ra4RuleById(dev,rid){
  for(const r of _ra4Rules(dev))if(r&&String(r.id)===String(rid))return r;
  return null;
}

// ---------- HOOK 1: a Mapping rule fired (routeEvent, branch t==="tf") ----------
function restOnTrigFire(dev,m){
  try{
    const apis=_ra4Apis();
    if(!apis.length)return;
    const rid=(m&&m.id!=null)?String(m.id):"";
    const now=_ra4Ts(m);
    for(const api of apis){
      if(!api||!Array.isArray(api.triggers)||!api.triggers.length)continue;
      for(const t of api.triggers){
        if(!t||t.on===false||!t.actionId)continue;
        const s=t.src;
        if(!s||s.kind!=="rule")continue;
        if(!_ra4DevMatch(s.dev,dev))continue;
        if(s.ruleId&&s.ruleId!=="any"&&String(s.ruleId)!==rid)continue;
        const st=_ra4State(api.id,t.id,dev,now);           // state (and rate guard) PER CAPSULE — see _ra4KeyD
        _ra4Rebase(st,now);
        const minS=_ra4Int(t.minIntervalMs,0,3600000,250)/1000;
        if(now-st.lastFire<minS)continue;                  // same rate guard as for motion triggers
        st.lastFire=now;
        const fn=_ra4Bump(api.id,t.id);
        const rf=_ra4RuleFires(dev,rid);
        _ra4Fire(api,t,{dev:dev,label:_ra4RuleLabel(dev,rid,m),key:(m&&m.key)||"",
                        fires:(rf!=null?rf:fn)});
      }
    }
  }catch(e){}
}

// ---------- HOOK 2: own motion threshold (routeEvent, branch t==="pv") ----------
function restOnPose(dev,m){
  try{
    const pose=(m&&m.pose&&typeof m.pose==="object")?m.pose:null;
    if(pose)_ra4PoseAt[dev]=Date.now();
    const now=_ra4Ts(m);
    const apis=_ra4Apis();
    if(apis.length){
      const hasTs=!!(m&&typeof m.ts==="number"&&isFinite(m.ts));
      const raw=_ra4RawOf(dev,hasTs?now:null);   // compare freshness ONLY when the packet carried a stream clock
      for(const api of apis){
        if(!api||!Array.isArray(api.triggers)||!api.triggers.length)continue;
        for(const t of api.triggers){
          if(!t||t.on===false||!t.actionId)continue;
          const s=t.src;
          if(!s||s.kind!=="motion")continue;
          if(!_ra4DevMatch(s.dev,dev))continue;
          const v=_ra4Val(s.source,pose,raw);
          if(v==null)continue;                              // no data → leave the state alone, never fire
          const st=_ra4State(api.id,t.id,dev,now);          // episode PER CAPSULE — see _ra4KeyD
          _ra4Rebase(st,now);
          const wasOver=st.over;                            // 🔔 read BEFORE the step mutates it
          const fired=_ra4Step(st,v,s,t,now);
          // "while the condition is met" notification: the two EDGES of the episode. A system
          // notification cannot hang for the duration, so its beginning and its end are what there
          // is to report — and the hysteresis in _ra4Step is what keeps the edges from chattering.
          // Gated on the sending switch exactly like the fire notification: with sending off the
          // trigger changes nothing, and announcing it would be noise about a no-op.
          if(st.over!==wasOver&&_ra4Enabled()&&typeof rfNotifyRestActive==="function")
            try{rfNotifyRestActive(api,t,dev,st.over,_ra4MotionLabel(s));}catch(e){}
          if(!fired)continue;
          _ra4Fire(api,t,{dev:dev,pose:pose,raw:raw,label:_ra4MotionLabel(s),key:"",
                          fires:_ra4Bump(api.id,t.id)});
        }
      }
    }
    if(Date.now()-_ra4GcAt>RA4_GC_MS)_ra4Gc();
    _ra4LiveTick();
  }catch(e){}
}

// ---------- live readout of the source value ----------
function _ra4Conn(el){
  if(!el)return false;
  if(typeof el.isConnected==="boolean")return el.isConnected;
  try{return document.contains(el);}catch(e){}
  return false;
}
// `born` grants a grace period: the row is built while still detached from the document (the API
// card is only inserted after it has been rendered), so for the first second a registration is not
// discarded merely for being absent from the DOM.
function _ra4RegLive(el,apiId,tid){
  const rec={el:el,apiId:apiId,tid:tid,last:null,met:null,val:null,born:Date.now()};
  _ra4Live.push(rec);
  _ra4Paint(rec);
  _ra4ArmWatch();
  return rec;      // wywołujący czyta z niego `val` — to jest źródło dla „↧ ustaw na bieżącą"
}
function _ra4Dead(rec){
  return !_ra4Conn(rec.el)&&(Date.now()-rec.born)>1000;
}
// Updates the textContent of a SINGLE node — the row itself is never re-rendered.
function _ra4Paint(rec){
  const api=_ra4Api(rec.apiId),t=api?_ra4Trig(api,rec.tid):null;
  const s=t&&t.src;
  if(!s||s.kind!=="motion"){_ra4PaintNone(rec,"");return;}
  const dev=_ra4LiveDev(s.dev);
  const v=_ra4Fresh(dev)?_ra4Val(s.source,_ra4PoseOf(dev),_ra4RawOf(dev)):null;
  if(v==null){_ra4PaintNone(rec,_ra4T("Brak danych z kapsla.","No data from the capsule."));return;}
  const txt=_ra4Fmt(v,s.source)+" "+_ra4Unit(s.source);
  if(rec.last!==txt){rec.el.textContent=txt;rec.last=txt;}
  rec.val=v;                                   // ostatni odczyt — bierze go przycisk „↧ ustaw na bieżącą"
  const met=_ra4Met(v,s,0);
  if(rec.met!==met){
    rec.el.classList.toggle("on",met);
    rec.el.title=met?_ra4T("Warunek jest teraz spełniony","The condition is met right now")
                    :_ra4T("Warunek nie jest teraz spełniony","The condition is not met right now");
    rec.met=met;
  }
}
function _ra4PaintNone(rec,why){
  rec.val=null;                                  // „↧" nie może wziąć liczby, której już nie ma
  if(rec.last!=="—"){rec.el.textContent="—";rec.last="—";}
  if(rec.met!==false){rec.el.classList.remove("on");rec.met=false;}
  // ⚠️ STRAŻNIK, TAK JAK PRZY `last` I `met` OBOK. Bez niego ta linijka pisała `title` przy KAŻDYM
  // takcie (~6 Hz na widoczny wiersz), a globalny obserwator dymków nasłuchuje na atrybucie
  // `title` i po każdym zapisie przenosi go z powrotem do `data-rftip` — czyli sześć razy na
  // sekundę, na każdy odczyt, bez powodu.
  if(rec.tipWhy!==(why||"")){rec.tipWhy=why||"";rec.el.title=rec.tipWhy;}
}
function _ra4LiveTick(){
  if(!_ra4Live.length)return;
  const now=Date.now();
  if(now-_ra4TickAt<RA4_LIVE_MS)return;
  _ra4TickAt=now;
  for(let i=_ra4Live.length-1;i>=0;i--){
    const r=_ra4Live[i];
    if(_ra4Dead(r)){_ra4Live.splice(i,1);continue;}          // row is gone (re-render / another sub-tab)
    let vis=true;
    try{vis=(r.el.offsetParent!==null);}catch(e){}
    if(!vis)continue;                                       // tab hidden — compute nothing
    _ra4Paint(r);
  }
  if(!_ra4Live.length&&_ra4Watch){clearInterval(_ra4Watch);_ra4Watch=0;}
}
// Watchdog: when the "pv" stream goes quiet (capsule disconnected) the readout must fall back to "—",
// which packet-driven updates alone can never do. Stops itself once no live readout is left.
function _ra4ArmWatch(){
  if(_ra4Watch)return;
  try{
    _ra4Watch=setInterval(function(){
      for(let i=_ra4Live.length-1;i>=0;i--)if(_ra4Dead(_ra4Live[i]))_ra4Live.splice(i,1);
      if(!_ra4Live.length){clearInterval(_ra4Watch);_ra4Watch=0;return;}
      _ra4LiveTick();
    },RA4_WATCH_MS);
  }catch(e){_ra4Watch=0;}
}

// ---------- lists feeding the dropdowns ----------
function _ra4Devices(){
  const out=[];
  try{
    const d=(typeof state!=="undefined"&&state&&state.devices)?state.devices:null;
    if(!d)return out;
    for(const k in d){
      const D=d[k];if(!D)continue;
      const meta=D.meta||{};
      out.push({id:meta.dev||k,slot:(typeof meta.slot==="number")?meta.slot:999,
                name:meta.label||meta.name||meta.dev||k});
    }
    out.sort(function(a,b){return (a.slot-b.slot)||(a.id<b.id?-1:1);});
  }catch(e){}
  return out;
}
// Do NOT call devEntry(id) here: it CREATES a missing slot in state.devices as a side effect, and
// merely rendering a dropdown must not invent devices.
function _ra4Rules(dev){
  try{
    if(typeof state==="undefined"||!state)return [];
    const D=state.devices&&state.devices[dev];
    if(D&&Array.isArray(D.rules))return D.rules;
    if(dev===state.activeDeviceId&&Array.isArray(state.rules))return state.rules;
  }catch(e){}
  return [];
}
function _ra4RuleLab(r){
  if(!r)return "";
  if(r.label)return String(r.label);
  try{if(typeof ruleSrcLabel==="function"){const s=ruleSrcLabel(r);if(s)return String(s);}}catch(e){}
  if(r.key)return String(r.key);
  return String(r.id||"");
}

// ---------- UI: the "Triggers" sub-tab (called from the API card renderer) ----------
function restRenderTriggers(api,wrap){
  if(!api||!wrap)return;
  if(!Array.isArray(api.triggers))api.triggers=[];
  wrap.innerHTML="";
  _ra4Gc();
  const bar=document.createElement("div");
  bar.className="ra-toolbar";
  const add=document.createElement("button");
  add.type="button";add.className="btn sm primary";
  _ra4Btn(add,_ra4T("Dodaj wyzwalacz","Add trigger"),"bic-plus");
  add.title="Dodaj wyzwalacz, który sam wyśle wybraną akcję";
  add.addEventListener("click",function(){_ra4Touch();restAddTrigger(api.id);});
  bar.appendChild(add);
  // Zdanie o Mapowaniu stało tu BEZWARUNKOWO — także wtedy, gdy człowiek patrzył na próg ruchu
  // ustawiony w całości tutaj. To jedno z tych zdań, które budują wrażenie, że moduł robi to samo
  // dwa razy. Teraz mówi to, co jest prawdą dla TEJ listy: ile wyzwalaczy jedzie z reguł.
  const zRegul=(api.triggers||[]).filter(function(x){return x&&x.src&&x.src.kind==="rule";}).length;
  if(zRegul){
    const hint=document.createElement("span");
    hint.className="ra-trig-hint";
    hint.textContent=(zRegul===1)
      ? _ra4T("Jeden z nich jedzie z reguły Mapowania.","One of these rides on a Mapping rule.")
      : _ra4T(zRegul+" z nich jedzie z reguł Mapowania.",zRegul+" of these ride on Mapping rules.");
    bar.appendChild(hint);
  }
  wrap.appendChild(bar);
  const acts=Array.isArray(api.actions)?api.actions:[];
  if(!acts.length){
    wrap.appendChild(_ra4EmptyEl(
      _ra4T("Najpierw dodaj choć jedną akcję.","Add at least one action first."),
      _ra4T("Wyzwalacz uruchamia gotową akcję tej aplikacji — bez akcji nie ma czego wysłać.",
            "A trigger runs a ready-made action of this application — with no action there is nothing to send."),
      _ra4T("Przejdź do akcji","Go to actions"),function(){_ra4GoActions(api.id);}));
    wrap.appendChild(_ra4WhyEl(api));          // rachunek bramek należy się TAKŻE przy pustym stanie
    return;
  }
  if(!api.triggers.length){
    wrap.appendChild(_ra4EmptyEl(
      _ra4T("Ta aplikacja nie ma jeszcze wyzwalacza.","This application has no trigger yet."),
      _ra4T("Wyzwalacz sam wysyła akcję — po regule z Mapowania albo po własnym progu ruchu (jak pady w Synth).",
            "A trigger sends an action by itself — from a Mapping rule or from your own motion threshold (like the Synth pads)."),
      _ra4T("Dodaj wyzwalacz","Add trigger"),function(){restAddTrigger(api.id);},"bic-plus"));
    wrap.appendChild(_ra4WhyEl(api));
    return;
  }
  const list=document.createElement("div");
  list.className="ra-trigs";
  for(const t of api.triggers)if(_ra4Fix(t))list.appendChild(_ra4Row(api,t));
  wrap.appendChild(list);
  wrap.appendChild(_ra4WhyEl(api));
}
// ── „Dlaczego to jeszcze nie zadziała" ─────────────────────────────────────────────────────────
//
// Pod listą stało dotąd JEDNO zdanie o włączniku modułu, z trzema wadami naraz: rysowało się dopiero,
// gdy istniał już wyzwalacz (czyli nowy użytkownik nie widział go ani razu), nie odświeżało się po
// przełączeniu włącznika (zostawało nieprawdziwe) i mówiło o „wysyłce automatycznej" — nazwie, której
// nie ma nigdzie w UI. Bramek, które potrafią uciszyć wyzwalacz, jest natomiast kilka, a wszystkie
// dają na ekranie ten sam obraz: nic się nie dzieje.
//
// Ten panel wypisuje je wprost i na bieżąco. Odświeża go własny zegar, a nie podpięcie się pod
// przełącznik — `RESTAPI.cfg.enabled` zmienia się w CZTERECH miejscach (pasek modułu, kolumna
// „Usługi" w Przeglądzie, wczytanie presetu, stop awaryjny) i podpięcie do jednego z nich
// zostawiłoby panel kłamiący po trzech pozostałych.
function _ra4WhyEl(api){
  const box=document.createElement("div");
  box.className="ra-why";
  box.dataset.apiId=api.id;
  const h=document.createElement("div");
  h.className="ra-sub-h";
  h.textContent="Żeby wyzwalacz naprawdę wysłał";
  box.appendChild(h);
  const ul=document.createElement("div");
  ul.className="ra-why-list";
  box.appendChild(ul);
  _ra4WhyFill(ul,api.id);
  _ra4WhyArm();
  return box;
}
// Jeden warunek = jeden wiersz. `ok:null` znaczy „nie dotyczy" i wiersz wtedy nie powstaje.
function _ra4WhyRows(apiId){
  const api=_ra4Api(apiId);
  const rows=[];
  if(!api)return rows;
  const acts=Array.isArray(api.actions)?api.actions:[];
  const trigs=Array.isArray(api.triggers)?api.triggers:[];
  const armed=trigs.filter(function(t){return t&&t.on!==false&&t.actionId;});
  rows.push({ok:acts.length>0,
             pl:"Aplikacja ma choć jedną akcję",en:"The application has at least one action"});
  rows.push({ok:armed.length>0,
             pl:"Jest włączony wyzwalacz ze wskazaną akcją",
             en:"There is an enabled trigger with an action chosen"});
  rows.push({ok:_ra4Enabled(),
             pl:"Moduł „Usługi sieciowe” jest włączony (przełącznik u góry ekranu)",
             en:"The “Network services” module is on (the switch at the top of the screen)"});
  // Kapsel: wyzwalacz na własnym progu ruchu potrzebuje strumienia; wyzwalacz na regule z Mapowania
  // potrzebuje, żeby ta reguła miała z czego zadziałać — w obu wypadkach pytanie jest to samo.
  const devs={};
  for(const t of armed)if(t.src)devs[_ra4LiveDev(t.src.dev)]=true;
  const fresh=Object.keys(devs).some(function(d){return _ra4Fresh(d);});
  if(armed.length)rows.push({ok:fresh,
    pl:"Kapsel przysyła ruch (bez tego nie ma czego mierzyć)",
    en:"The capsule is sending motion (without it there is nothing to measure)"});
  // Dwa warunki, o których lista milczała (przegląd modułów 2026-11-17): akcja z hasłem nie wyjdzie
  // przy zamkniętym sejfie, a żaden wyzwalacz nie wyjdzie po zamknięciu karty, bo liczy je panel.
  const usesVault=armed.some(function(t){
    const a=acts.find(function(x){return x&&x.id===t.actionId;});
    if(!a)return false;
    if(a.credId||api.credId)return true;
    try{return JSON.stringify(a).indexOf("{{secret.")>=0;}catch(e){return false;}});
  if(usesVault){let ok=false;try{ok=_RaVault.ready();}catch(e){}
    rows.push({ok:ok,
      pl:"Sejf jest odblokowany (akcja używa hasła); do pracy w tle zaznacz „Trzymaj odblokowane do wysyłki w tle”",
      en:"The vault is unlocked (the action uses a password); for background work tick “Keep unlocked for background sending”"});}
  if(armed.length)rows.push({ok:true,
    pl:"Ta karta przeglądarki zostaje otwarta: wyzwalacze liczy panel, po jej zamknięciu nic nie wyjdzie",
    en:"This browser tab stays open: the panel runs the triggers, nothing is sent once it is closed"});
  if(armed.length&&_ra4OtherSends())rows.push({ok:true,
    pl:"Panel jest otwarty w kilku oknach: żądania wysyła jedno z nich, to okno tylko podświetla wyzwalacze",
    en:"The panel is open in several windows: one of them sends the requests, this one only highlights the triggers"});
  // Bramka symulacji — jedyna, o której w całym module nie było ani jednego zdania.
  // Dwa brzmienia, bo to dwie różne wiadomości: „może cię to spotkać” i „już cię to spotkało”.
  // To drugie jest mocniejsze i rozwiewa najgorszą wątpliwość („czy mój warunek w ogóle działa?”):
  // skoro wyzwalacz został WYCISZONY, to znaczy, że zadziałał.
  let sim=false;
  try{sim=(typeof rfSimOutputsAllowed==="function")&&!rfSimOutputsAllowed();}catch(e){}
  if(sim){
    const hit=trigs.some(function(t){return t&&_ra4Muted.has(_ra4Key(apiId,t.id));});
    rows.push(hit
      ? {ok:false,
         pl:"Symulacja: wyzwalacz JUŻ zadziałał, ale żądanie nie wyszło — wyjścia są niepotwierdzone. Warunek masz więc dobry. Przycisk „▶ Testuj” wysyła mimo tego",
         en:"Simulation: the trigger HAS gone off, but the request did not leave — the outputs are unconfirmed. So your condition is fine. The “▶ Test” button sends anyway"}
      : {ok:false,
         pl:"Symulacja: wyjścia są niepotwierdzone, więc żądania NIE wychodzą. Przycisk „▶ Testuj” działa mimo tego",
         en:"Simulation: the outputs are unconfirmed, so requests do NOT leave. The “▶ Test” button works anyway"});
  }
  return rows;
}
function _ra4WhyFill(ul,apiId){
  const rows=_ra4WhyRows(apiId);
  const txt=rows.map(function(r){return (r.ok?"1":"0")+r.pl;}).join("|");
  if(ul.dataset.sig===txt)return;               // nic się nie zmieniło — nie ruszaj DOM-u
  ul.dataset.sig=txt;
  ul.innerHTML="";
  for(const r of rows){
    const li=document.createElement("div");
    li.className="ra-why-row"+(r.ok?" ok":" no");
    const ic=document.createElement("span");
    ic.className="ra-why-ic";ic.setAttribute("aria-hidden","true");
    ic.textContent=r.ok?"✓":"✗";
    const tx=document.createElement("span");
    tx.textContent=_ra4T(r.pl,r.en);
    li.appendChild(ic);li.appendChild(tx);
    li.setAttribute("role","listitem");
    li.setAttribute("aria-label",(r.ok?_ra4T("spełnione: ","met: "):_ra4T("brakuje: ","missing: "))+_ra4T(r.pl,r.en));
    ul.appendChild(li);
  }
}
let _ra4WhyTimer=0;
function _ra4WhyArm(){
  if(_ra4WhyTimer)return;
  _ra4WhyTimer=setInterval(function(){
    const all=document.querySelectorAll(".ra-why");
    if(!all.length){clearInterval(_ra4WhyTimer);_ra4WhyTimer=0;return;}   // panel zniknął — zegar też
    for(const b of all){
      const ul=b.querySelector(".ra-why-list");
      if(ul)_ra4WhyFill(ul,b.dataset.apiId);
    }
  },1000);
}
function _ra4WhyPaint(apiId){
  const b=document.querySelector('.ra-why[data-api-id="'+_ra4Sel(apiId)+'"]');
  const ul=b&&b.querySelector(".ra-why-list");
  if(ul)_ra4WhyFill(ul,apiId);
}
function _ra4GoActions(apiId){
  try{if(typeof _ra3Tab!=="undefined"&&_ra3Tab)_ra3Tab[apiId]="actions";}catch(e){}
  try{if(typeof _ra3RerenderApi==="function"){_ra3RerenderApi(apiId);return;}}catch(e){}
  _ra4Redraw(apiId);
}
// Redraw just the trigger list, leaving the surrounding card alone so scroll position and focus survive.
function _ra4Redraw(apiId,focusTid){
  const api=_ra4Api(apiId);if(!api)return;
  const root=_ra4Root();if(!root)return;
  const wrap=root.querySelector('.ra-trigwrap[data-api-id="'+_ra4Sel(apiId)+'"]');
  if(!wrap){
    try{if(typeof _ra3RerenderApi==="function")_ra3RerenderApi(apiId);}catch(e){}
    return;
  }
  restRenderTriggers(api,wrap);
  _ra4SyncCount(api,wrap);
  if(focusTid){
    try{
      const el=wrap.querySelector('.ra-trig[data-tid="'+_ra4Sel(focusTid)+'"] .ra-t-act');
      if(el)el.focus();
    }catch(e){}
  }
}
// The "N actions · M triggers" counter in the API card header, kept in sync after a local redraw.
function _ra4SyncCount(api,wrap){
  try{
    const card=wrap.closest?wrap.closest(".ra-app"):null;
    const cnt=card?card.querySelector(".ra-app-cnt"):null;
    if(!cnt)return;
    const nA=Array.isArray(api.actions)?api.actions.length:0;
    const nT=Array.isArray(api.triggers)?api.triggers.length:0;
    cnt.textContent=_ra4T(
      nA+" "+_ra4Pl(nA,"akcja","akcje","akcji")+" · "+nT+" "+_ra4Pl(nT,"wyzwalacz","wyzwalacze","wyzwalaczy"),
      nA+" "+(nA===1?"action":"actions")+" · "+nT+" "+(nT===1?"trigger":"triggers"));
  }catch(e){}
}

// ---------- UI: model (add / remove) ----------
function restAddTrigger(apiId,seed){
  const api=_ra4Api(apiId);
  if(!api)return null;
  if(!Array.isArray(api.triggers))api.triggers=[];
  if(api.triggers.length>=RA4_MAX_TRIG){
    _ra4Toast(_ra4T("Limit "+RA4_MAX_TRIG+" wyzwalaczy w jednym API został osiągnięty.",
                    "The limit of "+RA4_MAX_TRIG+" triggers per API has been reached."),"danger");
    return null;
  }
  const first=(Array.isArray(api.actions)&&api.actions[0])?api.actions[0].id:"";
  const t=_ra4Fix(Object.assign(_ra4DefTrig(first),(seed&&typeof seed==="object")?seed:{}));
  if(!t)return null;
  if(!t.id)t.id=_ra4NewId("g");
  api.triggers.push(t);
  _ra4Prime(api.id,t);
  _ra4Save();
  _ra4Redraw(api.id,t.id);
  return t;
}
function restRemoveTrigger(apiId,tid){
  const api=_ra4Api(apiId),t=api?_ra4Trig(api,tid):null;
  if(!api||!t)return Promise.resolve(false);
  return _ra4Confirm(_ra4T("Usunąć ten wyzwalacz?","Remove this trigger?"),
    {title:_ra4T("Usuń wyzwalacz","Remove trigger"),tone:"danger",
     icon:'<span class="rfm-bin"></span>',
     confirmLabel:_ra4T("Usuń","Remove"),cancelLabel:_ra4T("Zostaw","Keep")}).then(function(ok){
    if(!ok)return false;
    const i=api.triggers.indexOf(t);
    if(i<0)return false;
    api.triggers.splice(i,1);
    _ra4Drop(api.id,t.id);                                  // engine state goes WITH the trigger
    _ra4Save();
    _ra4Redraw(api.id);
    return true;
  });
}

// ---------- UI: a single trigger row ----------
function _ra4Row(api,t){
  t.toast=_ra4FixToast(t.toast,t.src);   // a trigger reaching the UI by another route still gets the field
  const row=document.createElement("div");
  row.className="ra-trig"+(t.on?"":" off");
  row.dataset.tid=t.id;
  row.dataset.apiId=api.id;
  // Three bands, the same reading order as the Mapping rule editor: WHAT it sends (head, with the
  // row's own on/off and counter) → WHEN it fires (source, its parameters, the rate limit) → HOW it
  // tells you (the Windows notification with its own wording and mute). Notification fields used to
  // sit in the head between "action" and "how often", which read as if they configured the sending.
  row.innerHTML=
    '<div class="ra-trig-head">'+
      '<label class="ra-tf ra-tf-name"><span class="ra-tf-lab">Nazwa</span>'+
        '<input type="text" class="ra-t-name" maxlength="60" placeholder="puste = opis warunku"></label>'+
      '<label class="ra-tf ra-tf-act"><span class="ra-tf-lab">Akcja</span><select class="ra-t-act"></select></label>'+
      '<button type="button" class="btn xs ra-t-test" title="Wyślij tę akcję tak, jak zrobiłby to wyzwalacz">▶ Testuj</button>'+
      '<span class="ra-trig-cnt" data-noi18n title="Ile razy ten wyzwalacz zadziałał w tej sesji"></span>'+
      '<button type="button" class="ra-tsw" role="switch" aria-checked="true" title="Włącz lub wyłącz ten wyzwalacz">'+
        '<span class="ra-tsw-dot" aria-hidden="true"></span><span class="ra-tsw-lab"></span></button>'+
      '<button type="button" class="ra-trig-x" title="Usuń ten wyzwalacz" aria-label="Usuń ten wyzwalacz">✕</button>'+
    '</div>'+
    '<div class="ra-tsec">'+
      '<span class="ra-sub-h">Kiedy ma zadziałać</span>'+
      '<div class="ra-ksw-row"><span class="ra-tf-lab">Źródło</span>'+
        '<div class="seg ra-ksw" role="radiogroup" aria-label="Rodzaj źródła wyzwalacza"></div>'+
        '<label class="ra-tf ra-tf-min"><span class="ra-tf-lab">Min. odstęp (ms)</span>'+
          '<input type="number" class="ra-t-min ra-mono" min="0" max="3600000" step="1"></label></div>'+
      '<div class="ra-trig-body"></div>'+
    '</div>'+
    '<div class="ra-tsec ra-tsec-notify">'+
      '<span class="ra-sub-h">🔔 Powiadomienie Windows</span>'+
      '<div class="ra-trow">'+
        '<label class="ra-tf ra-tf-notify"><span class="ra-tf-lab">kiedy</span>'+
          '<select class="ra-t-notify"></select></label>'+
        '<span class="ra-t-silent-l"><input type="checkbox" class="ra-t-silent"> bez dźwięku</span>'+
        '<label class="ra-tf ra-tf-ntext"><span class="ra-tf-lab">Treść powiadomienia</span>'+
          '<input type="text" class="ra-t-ntext" maxlength="120" placeholder="puste = nazwa wyzwalacza i akcji"></label>'+
      '</div>'+
    '</div>';
  const q=function(s){return row.querySelector(s);};
  // — nazwa wyzwalacza —
  // Bez niej listę kilkunastu wyzwalaczy czyta się po automatycznym opisie warunku („Pochylenie > 30°"),
  // czyli po tym, KIEDY działa, a nigdy po tym, PO CO istnieje. Reguła w Mapowaniu ma to pole od zawsze.
  const nm=q(".ra-t-name");
  nm.value=_ra4Str(t.label,60);
  nm.addEventListener("change",function(){t.label=_ra4Str(nm.value,60);nm.value=t.label;_ra4Save();_ra4Touch();});
  // — action —
  const sa=q(".ra-t-act");
  _ra4ActSelect(sa,api,t);
  sa.addEventListener("change",function(){
    t.actionId=_ra4Str(sa.value,40);
    row.classList.toggle("warn",!t.actionId);
    _ra4Save();_ra4Touch();
    _ra4SyncTest(row,t);
  });
  // — ▶ Testuj — trzeci krok ścieżki „Akcja › Wyzwalacz › Test", którego do tej pory NIE BYŁO.
  //
  // Idzie tą samą funkcją co silnik (`_ra4Fire`), a nie skrótem przez `restRunAction` — inaczej test
  // świeciłby na zielono przy wyzwalaczu, który realnie nie wychodzi, bo sprawdzałby wszystko POZA
  // ścieżką wyzwalacza. Placeholdery `{{trigger.label}}` i `{{trigger.fires}}` też podstawią się
  // tak, jak przy prawdziwym zadziałaniu.
  //
  // Czego test NIE sprawdza: samego WARUNKU. Tego nie da się kliknąć — trzeba poruszyć kapslem.
  // Przycisk mówi to wprost w swoim dymku, żeby zielony wynik nie znaczył więcej, niż znaczy.
  const tb=q(".ra-t-test");
  tb.addEventListener("click",function(){
    _ra4Touch();
    if(!t.actionId){
      _ra4Toast(_ra4T("Ten wyzwalacz nie ma jeszcze wybranej akcji — nie ma czego wysłać.",
                      "This trigger has no action chosen yet — there is nothing to send."),"danger");
      return;
    }
    const dev=_ra4LiveDev(t.src&&t.src.dev);
    _ra4Fire(api,t,{dev:dev,pose:_ra4PoseOf(dev),raw:_ra4RawOf(dev),
                    label:_ra4TrigLabel(t),key:"",
                    fires:(_ra4Fires.get(_ra4Key(api.id,t.id))||0)},{test:true});
  });
  // — minimum gap between sends —
  //
  // ⚠️ PRZY „CIĄGŁYM" PODŁOGA WYNOSI 200 ms i to nie jest kaprys interfejsu. Reguła bez klawisza
  // dostaje tę samą podłogę na serwerze (`NOACTION_MIN_INTERVAL_MS`), wprowadzoną dokładnie
  // z myślą o Usługach sieciowych. Warunek liczony w przeglądarce omijał tę bramkę, więc dało się
  // tu ustawić 0 ms — czyli żądanie na każdy pakiet pozycji, kilkanaście razy na sekundę, w cudze
  // API. Pozostałe zachowania wysyłają z natury rzadko, więc ich podłoga zostaje przy zerze.
  const mi=q(".ra-t-min");
  const minDol=function(){
    return (t.src&&t.src.kind==="motion"&&t.src.mode==="continuous")?RA4_CONT_MIN_MS:0;
  };
  const syncMin=function(){
    const d=minDol();
    mi.min=String(d);
    if(_ra4Int(t.minIntervalMs,0,3600000,250)<d){
      t.minIntervalMs=d;                         // podniesienie zapisujemy — inaczej wróciłoby po F5
      _ra4Save();
    }
    mi.value=_ra4Int(t.minIntervalMs,d,3600000,250);
    mi.title=d
      ? _ra4T("Nie częściej niż raz na tyle milisekund. Przy „Ciągłym” nie mniej niż "+RA4_CONT_MIN_MS+" ms — tyle samo wymusza serwer dla reguły bez klawisza.",
              "No more often than once per this many milliseconds. With “Continuous”, no less than "+RA4_CONT_MIN_MS+" ms — the same floor the server enforces for a rule with no key.")
      : _ra4T("Nie częściej niż raz na tyle milisekund — dotyczy wszystkich trybów",
              "No more often than once per this many milliseconds — applies to every mode");
  };
  syncMin();
  t._syncMin=syncMin;                            // ciało ruchu woła to po zmianie zachowania
  mi.addEventListener("change",function(){
    t.minIntervalMs=_ra4Int(mi.value,minDol(),3600000,250);
    mi.value=t.minIntervalMs;_ra4Save();_ra4Touch();
  });
  // — Windows notification for this trigger —
  const nt=q(".ra-t-notify"),ns=q(".ra-t-silent"),nsl=q(".ra-t-silent-l");
  const ntx=q(".ra-t-ntext"),ntxf=q(".ra-tf-ntext");
  ntx.value=_ra4Str(t.toast&&t.toast.text,120);
  const syncNotify=function(){
    _ra4NotifySelect(nt,t);
    ns.checked=(t.toast.silent!==false);
    nsl.hidden=!t.toast.on;                                 // no notification -> no sound to mute
    ntxf.hidden=!t.toast.on;                                // ...and nothing to word
  };
  syncNotify();
  nt.addEventListener("change",function(){
    const v=nt.value;
    t.toast={on:(v!=="off"),mode:(v==="active"?"active":"fire"),
             silent:(t.toast.silent!==false),text:t.toast.text};
    t.toast=_ra4FixToast(t.toast,t.src);
    syncNotify();                                           // the sanitizer may have downgraded "active"
    _ra4Save();_ra4Touch();
    if(t.toast.on&&typeof rfNotifyPreviewRest==="function")
      rfNotifyPreviewRest(api,t,_ra4TrigLabel(t));
  });
  ns.addEventListener("change",function(){
    t.toast=_ra4FixToast({on:t.toast.on,mode:t.toast.mode,silent:ns.checked,text:t.toast.text},t.src);
    _ra4Save();_ra4Touch();
    if(t.toast.on&&typeof rfNotifyPreviewRest==="function")
      rfNotifyPreviewRest(api,t,_ra4TrigLabel(t));
  });
  ntx.addEventListener("change",function(){
    t.toast=_ra4FixToast({on:t.toast.on,mode:t.toast.mode,silent:t.toast.silent,text:ntx.value},t.src);
    ntx.value=t.toast.text;
    _ra4Save();_ra4Touch();
    if(t.toast.on&&typeof rfNotifyPreviewRest==="function")
      rfNotifyPreviewRest(api,t,_ra4TrigLabel(t));
  });
  // — on/off switch —
  const sw=q(".ra-tsw");
  const syncSw=function(){
    sw.classList.toggle("on",!!t.on);
    sw.setAttribute("aria-checked",t.on?"true":"false");
    sw.querySelector(".ra-tsw-lab").textContent=t.on?_ra4T("Wł.","On"):_ra4T("Wył.","Off");
    row.classList.toggle("off",!t.on);
  };
  syncSw();
  sw.addEventListener("click",function(){
    t.on=!t.on;
    _ra4Drop(api.id,t.id);                                  // a disabled trigger leaves NO entry in the state map
    if(t.on)_ra4Prime(api.id,t);                            // enabling arms it against the current value
    syncSw();_ra4Save();_ra4Touch();
  });
  // — removal —
  q(".ra-trig-x").addEventListener("click",function(){_ra4Touch();restRemoveTrigger(api.id,t.id);});
  // — source kind switch —
  const ksw=q(".ra-ksw");
  const body=q(".ra-trig-body");
  const syncK=function(){
    for(const b of ksw.querySelectorAll("button")){
      const on=(b.dataset.k===t.src.kind);
      b.classList.toggle("on",on);
      b.setAttribute("aria-checked",on?"true":"false");
      b.tabIndex=on?0:-1;
    }
  };
  for(const k of RA4_KINDS){
    const b=document.createElement("button");
    b.type="button";b.dataset.k=k[0];b.setAttribute("role","radio");
    b.textContent=_ra4T(k[1],k[2]);
    b.addEventListener("click",function(){
      if(t.src.kind===k[0])return;
      t.src=(k[0]==="motion")
        ? _ra4NewMotionSrc(t.src.dev)
        : {kind:"rule",dev:_ra4Str(t.src.dev,24)||"any",ruleId:"any"};
      _ra4Drop(api.id,t.id);
      if(k[0]==="motion")_ra4Prime(api.id,t);
      t.toast=_ra4FixToast(t.toast,t.src);       // "active" is motion-only — leaving that kind downgrades it
      syncNotify();
      syncK();_ra4Body(api,t,body,row);
      _ra4Save();_ra4Touch();
    });
    b.addEventListener("keydown",function(ev){
      const key=ev.key;
      if(key!=="ArrowRight"&&key!=="ArrowLeft"&&key!=="Home"&&key!=="End")return;
      ev.preventDefault();
      const all=Array.prototype.slice.call(ksw.querySelectorAll("button"));
      let i=all.indexOf(b);
      if(key==="ArrowRight")i=(i+1)%all.length;
      else if(key==="ArrowLeft")i=(i-1+all.length)%all.length;
      else if(key==="Home")i=0;else i=all.length-1;
      all[i].focus();all[i].click();
    });
    ksw.appendChild(b);
  }
  syncK();
  _ra4Body(api,t,body,row);
  row.classList.toggle("warn",!t.actionId);
  _ra4SyncTest(row,t);
  // Licznik „×N" był tworzony PUSTY i wypełniany wyłącznie przez `_ra4Flash`, czyli dopiero przy
  // pierwszym zadziałaniu — po przerysowaniu listy (każde przełączenie zakładki) wracał do pustki
  // i wyglądał, jakby wyzwalacz nigdy nie zadziałał.
  {const n=_ra4Fires.get(_ra4Key(api.id,t.id))||0;
   const c=row.querySelector(".ra-trig-cnt");
   if(c&&n)c.textContent="×"+n;}
  return row;
}
// Przycisk próby ma sens tylko wtedy, gdy jest co wysłać.
function _ra4SyncTest(row,t){
  const b=row&&row.querySelector(".ra-t-test");
  if(!b)return;
  const ok=!!(t&&t.actionId);
  b.disabled=!ok;
  b.title=ok?_ra4T("Wyślij tę akcję tak, jak zrobiłby to wyzwalacz — sprawdza akcję, adres i sejf, ale NIE warunek",
                   "Send this action the way the trigger would — it checks the action, the address and the vault, but NOT the condition")
            :_ra4T("Najpierw wybierz akcję","Choose an action first");
}
function _ra4ActSelect(sel,api,t){
  sel.innerHTML="";
  const acts=Array.isArray(api.actions)?api.actions:[];
  const known=acts.some(function(a){return a&&a.id===t.actionId;});
  if(!t.actionId||!known){
    const o=document.createElement("option");
    o.value="";o.textContent=_ra4T("— wybierz akcję —","— pick an action —");
    sel.appendChild(o);
    if(!known)t.actionId="";
  }
  for(const a of acts){
    if(!a||!a.id)continue;
    const o=document.createElement("option");
    o.value=a.id;o.textContent=_ra4Str(a.name)||_ra4T("(bez nazwy)","(unnamed)");
    if(a.id===t.actionId)o.selected=true;
    sel.appendChild(o);
  }
}
// Short human name of a trigger, used as the notification's body text.
// Własna nazwa wygrywa z automatycznym opisem warunku — tak samo, jak etykieta reguły w Mapowaniu
// wygrywa z jej `keySpec`. Człowiek nazywa wyzwalacz po tym, PO CO on jest; opis warunku mówi tylko,
// KIEDY działa, i jest odpowiedzią na inne pytanie.
function _ra4TrigLabel(t){
  if(!t||!t.src)return "";
  const own=_ra4Str(t.label,60).trim();
  if(own)return own;
  if(t.src.kind==="motion")return _ra4MotionLabel(t.src);
  if(t.src.ruleId&&t.src.ruleId!=="any"){
    const r=_ra4RuleById(_ra4LiveDev(t.src.dev),t.src.ruleId);
    if(r)return _ra4RuleLab(r);
  }
  return _ra4T("dowolna reguła z Mapowania","any rule from Mapping");
}
// The notification picker. "Gdy aktywny" is offered ONLY for an own motion threshold: a rule-kind
// trigger has no state of its own, and the Mapping rule it rides on already carries that option —
// so the entry stays visible but disabled, saying where it lives instead of silently vanishing.
function _ra4NotifySelect(sel,t){
  const cfg=(t&&t.toast)||{on:false,mode:"fire"};
  const motion=!!(t&&t.src&&t.src.kind==="motion");
  sel.innerHTML="";
  const add=function(v,pl,en,dis){
    const o=document.createElement("option");
    o.value=v;o.textContent=_ra4T(pl,en);
    if(dis)o.disabled=true;
    sel.appendChild(o);
  };
  add("off","— bez powiadomienia —","— no notification —",false);
  add("fire","przy zadziałaniu","when it goes off",false);
  add("active",
      motion?"gdy warunek jest spełniony (i gdy mija)":"gdy aktywny — ustaw to przy samej regule w Mapowaniu",
      motion?"while the condition is met (and when it ends)":"while active — set that on the rule itself, in Mapping",
      !motion);
  sel.value=cfg.on?(cfg.mode==="active"?"active":"fire"):"off";
  sel.title=_ra4T("Dymek Windows z ikony w zasobniku — widoczny też, gdy panel jest schowany za grą. Nie częściej niż raz na 3 s.",
                  "A Windows balloon from the tray icon — visible even with the dashboard behind a game. No more often than once every 3 s.");
}
function _ra4DevSelect(sel,t,onChange){
  sel.innerHTML="";
  const o0=document.createElement("option");
  o0.value="any";o0.textContent=_ra4T("Dowolny kapsel","Any capsule");
  sel.appendChild(o0);
  const list=_ra4Devices();
  let found=false;
  for(const d of list){
    const o=document.createElement("option");
    o.value=d.id;o.textContent=d.name+" · "+d.id;
    if(d.id===t.src.dev){o.selected=true;found=true;}
    sel.appendChild(o);
  }
  if(t.src.dev&&t.src.dev!=="any"&&!found){                 // slot stored in the config but not connected right now
    const o=document.createElement("option");
    o.value=t.src.dev;o.selected=true;
    o.textContent=_ra4T(t.src.dev+" (niepodłączony)",t.src.dev+" (not connected)");
    sel.appendChild(o);
  }
  if(t.src.dev==="any"||!t.src.dev)o0.selected=true;
  sel.addEventListener("change",function(){
    t.src.dev=_ra4Str(sel.value,24)||"any";
    onChange();
  });
}
function _ra4Body(api,t,box,row){
  box.innerHTML="";
  if(t.src.kind==="rule")_ra4BodyRule(api,t,box,row);
  else _ra4BodyMotion(api,t,box,row);
}
// — source: a rule from the Mapping tab —
function _ra4BodyRule(api,t,box,row){
  box.innerHTML=
    '<div class="ra-trow">'+
      '<label class="ra-tf ra-tf-dev"><span class="ra-tf-lab">Kapsel</span><select class="ra-t-dev"></select></label>'+
      '<label class="ra-tf ra-tf-wide"><span class="ra-tf-lab">Reguła</span><select class="ra-t-rule"></select></label>'+
      '<button type="button" class="btn sm ra-t-newrule" title="Napisz regułę, która niczego nie naciska i służy tylko temu wyzwalaczowi">＋ Nowa reguła</button>'+
      '<button type="button" class="btn sm ra-t-editrule" title="Otwórz wskazaną regułę w Mapowaniu">✎ Edytuj</button>'+
    '</div>'+
    '<div class="ra-t-blok"></div>'+
    '<div class="ra-trig-note"></div>';
  const q=function(s){return box.querySelector(s);};
  // Changing the capsule rebuilds the rule list, and therefore the very dropdown just used.
  // Focus is restored to the new element so a keyboard selection does not eject the user.
  const redraw=function(){
    _ra4Save();_ra4Touch();_ra4BodyRule(api,t,box,row);
    try{const el=box.querySelector(".ra-t-dev");if(el)el.focus();}catch(e){}
  };
  _ra4DevSelect(q(".ra-t-dev"),t,redraw);
  const sr=q(".ra-t-rule");
  const dev=_ra4LiveDev(t.src.dev);
  const rules=_ra4Rules(dev);
  const o0=document.createElement("option");
  o0.value="any";o0.textContent=_ra4T("Dowolna reguła","Any rule");
  sr.appendChild(o0);
  let found=false;
  for(const r of rules){
    if(!r||r.id==null)continue;
    const o=document.createElement("option");
    o.value=String(r.id);o.textContent=_ra4RuleLab(r);
    if(String(r.id)===String(t.src.ruleId)){o.selected=true;found=true;}
    sr.appendChild(o);
  }
  if(t.src.ruleId&&t.src.ruleId!=="any"&&!found){
    const o=document.createElement("option");
    o.value=t.src.ruleId;o.selected=true;
    o.textContent=_ra4T("spoza listy: "+t.src.ruleId,"outside the list: "+t.src.ruleId);
    sr.appendChild(o);
  }
  if(!t.src.ruleId||t.src.ruleId==="any")o0.selected=true;
  sr.addEventListener("change",function(){t.src.ruleId=_ra4Str(sr.value,40)||"any";_ra4Save();_ra4Touch();_ra4SyncRuleBtns(box,t);});
  // — dwa przyciski, które robią z tego źródła drogę, a nie ślepy zaułek —
  //
  // Do tej pory „Reguła z Mapowania" mówiła tylko „idź to zrobić gdzie indziej", a żeby reguła
  // w ogóle dała się zapisać, musiała NACISKAĆ jakiś klawisz — czyli wyzwalacz w Usługach kupowało
  // się kosztem przypadkowego wciśnięcia w grze. Reguła bez klawisza zdjęła ten koszt, a te dwa
  // przyciski skracają drogę do niej z „przejdź, znajdź, wróć" do jednego kliknięcia.
  q(".ra-t-newrule").addEventListener("click",function(){_ra4NewRule(api,t);});
  q(".ra-t-editrule").addEventListener("click",function(){
    const r=_ra4RuleById(_ra4LiveDev(t.src.dev),t.src.ruleId);
    if(r)_ra4GoRule(r);
  });
  _ra4SyncRuleBtns(box,t);
  const note=q(".ra-trig-note");
  const parts=[_ra4T("Wyzwalacz zadziała wtedy, kiedy zadziała wybrana reguła z Mapowania. Tą drogą masz cały słownik reguły: przycisk kapsla, nagrany gest, kilka warunków połączonych ORAZ/LUB i warstwy.",
                     "The trigger goes off when the chosen Mapping rule goes off. This way you get the rule's whole vocabulary: a capsule button, a recorded gesture, several conditions joined with AND/OR, and layers."),
               _ra4T("„＋ Nowa reguła” pisze regułę, która NICZEGO nie naciska — istnieje tylko po to, żeby ten wyzwalacz miał się na czym oprzeć.",
                     "“＋ New rule” writes a rule that presses NOTHING — it exists only so this trigger has something to ride on."),
               // A recorded gesture cannot be judged here (the recordings live on the server, in
               // the Mapping rule) — so the way to „gesture → request" is the rule itself.
               _ra4T("Gest kapsla? Nagraj go jako regułę w Mapowaniu (przycisk „Nagraj gest”) i wskaż ją tutaj — reguły z gestem mają na liście znak ✋.",
                     "A capsule gesture? Record it as a Mapping rule (the “Record a gesture” button) and pick it here — rules with a gesture carry ✋ in the list.")];
  if(t.src.dev==="any")parts.push(_ra4T("Lista reguł pochodzi z aktywnego kapsla; przy „Dowolnym kapslu” liczy się identyfikator reguły — zadziała ta sama reguła w każdym kapslu.",
                                        "The rule list comes from the active capsule; with “Any capsule” the rule id is what matters — the same rule in every capsule will fire."));
  if(!rules.length)parts.push(_ra4T("Ten kapsel nie ma jeszcze żadnej reguły — dodasz ją na ekranie Mapowanie.",
                                    "This capsule has no rule yet — you add one on the Mapping screen."));
  _ra4NoteList(note,parts);
}
// „✎ Edytuj" ma sens tylko przy WSKAZANEJ regule — przy „Dowolnej" nie ma czego otworzyć.
/* ⚠️ POWÓD BLOKADY MUSI STAĆ W DOM, NIE W `title`. Wygaszony przycisk nie dostaje zdarzeń myszy
   ANI nie da się na niego wejść Tabem, więc jego podpowiedzi nie zobaczy nikt — ani myszą, ani
   klawiaturą, ani czytnikiem ekranu. Przez to „✎ Edytuj" było po prostu szare i milczące.
   Zdanie idzie teraz obok przycisku, tak samo jak pas bramki w karcie
   skanera (`.sk-wyzw-brama`). */
/* NOTKA JAKO LISTA, NIE AKAPIT. `parts.join(" ")` sklejało trzy–cztery niezależne zdania w jeden
   blok 11 px, biegnący przez całą szerokość karty (~170 znaków w wierszu). Każde z tych zdań mówi
   o czymś innym — jedno o tym, skąd bierze się sygnał, drugie o przycisku obok, trzecie o znaku ✋
   na liście — więc sklejone czytały się jak jedna długa dygresja i nikt ich nie czytał. Osobne
   punkty czyta się wybiórczo, a tego się od takiej notki oczekuje. */
function _ra4NoteList(el,parts){
  if(!el)return;
  el.innerHTML="";
  const lista=(parts||[]).map(function(x){return String(x||"").trim();}).filter(Boolean);
  if(!lista.length)return;
  if(lista.length===1){el.textContent=lista[0];return;}
  const ul=document.createElement("ul");
  lista.forEach(function(z){
    const li=document.createElement("li");
    li.textContent=z;
    ul.appendChild(li);
  });
  el.appendChild(ul);
}
function _ra4SyncRuleBtns(box,t){
  const b=box.querySelector(".ra-t-editrule");
  if(!b)return;
  const rid=t&&t.src&&t.src.ruleId;
  const ok=!!(rid&&rid!=="any"&&_ra4RuleById(_ra4LiveDev(t.src.dev),rid));
  b.disabled=!ok;
  b.title=ok?_ra4T("Otwórz wskazaną regułę w Mapowaniu","Open the chosen rule on the Mapping screen")
            :_ra4T("Najpierw wskaż konkretną regułę","Pick a specific rule first");
  const blok=box.querySelector(".ra-t-blok");
  if(blok)blok.textContent=ok?"":_ra4T(
    "„✎ Edytuj” czeka na wskazanie konkretnej reguły — przy „Dowolnej regule” nie ma czego otworzyć.",
    "“✎ Edit” is waiting for a specific rule — with “Any rule” there is nothing to open.");
}
// Przejście na ekran Mapowanie z otwartym edytorem. `openEditor` zawsze oddaje obietnicę —
// przy niezapisanym wyzwalaczu pyta najpierw o porzucenie zmian i wtedy oddaje `false`.
function _ra4GoRule(rule){
  try{
    if(typeof openEditor!=="function")return;
    // ⚠️ ZAKŁADKĘ WYBIERAMY WEDŁUG AKCJI REGUŁY, nie na sztywno. `#ruleEditor` jest w całej
    // aplikacji JEDEN i opakowanie `openEditor` z rf-43 PRZENOSI go do kolumny Kontrolera, gdy
    // reguła naciska przycisk pada. Bezwarunkowe „idź na Mapowanie" dawało wtedy pusty ekran:
    // człowiek klikał ✎ i lądował na zakładce, w której edytora akurat nie było.
    const pad=(typeof specIsPad==="function"&&rule&&specIsPad(rule.keySpec));
    // Przejście PO odpowiedzi edytora: przy niezapisanym szkicu `openEditor` najpierw pyta,
    // a „Wróć do edycji" (`false`) ma zostawić człowieka tam, gdzie stał.
    Promise.resolve(openEditor(rule||null)).then(function(ok){
      if(ok===false)return;
      if(typeof setTabById==="function")setTabById(pad?"kontroler":"mapowanie");
    }).catch(function(){});
  }catch(e){}
}
// Nowa reguła OD RAZU w kształcie „tylko wyzwalacz": bez klawisza i z nazwą mówiącą, po co jest.
// Domyślnych ustawia `openEditor(null)`; my dokładamy tylko intencję i etykietę, a potem prosimy
// edytor o przerysowanie — lista rozwijana sama trafi wtedy w pozycję „— bez klawisza —”,
// bo czyta `noAction`, a nie `keySpec` (patrz `singleKeyHtml` w rf-12).
function _ra4NewRule(api,t){
  try{
    if(typeof openEditor!=="function"){
      _ra4Toast(_ra4T("Edytor reguł jest niedostępny w tym widoku.","The rule editor is not available in this view."),"danger");
      return;
    }
    // Zapamiętujemy, DO CZEGO ta reguła wraca. Bez tego obietnica z komentarza wyżej („jedno
    // kliknięcie zamiast przejdź-znajdź-wróć") nie była dotrzymana: reguła powstawała, ale
    // wyzwalacz zostawał przy „Dowolnej regule", a nowa pozycja nie pojawiała się nawet
    // w rozwijaku, dopóki ktoś nie przerysował listy ręcznie.
    const apiId=api&&api.id, tid=t&&t.id;
    Promise.resolve(openEditor(null)).then(function(ok){
      if(ok===false)return;                       // człowiek cofnął się do niezapisanego wyzwalacza
      try{
        if(typeof setTabById==="function")setTabById("mapowanie");
        if(typeof state==="undefined"||!state||!state._draft)return;
        state._draft.noAction=true;
        state._draft.keySpec="";
        if(!String(state._draft.label||"").trim())
          state._draft.label=_ra4T("Wyzwalacz dla ","Trigger for ")+_ra4Str(api&&api.name,40);
        // ⚠️ MIGAWKA CZYSTEGO SZKICU PO NASZYCH ZMIANACH. `_openEditorNow` robi ją PRZED
        // wywołaniem `after`, więc bez tego wiersza reguła liczyłaby się jako „zmieniona ręką
        // człowieka" od pierwszej klatki i zamykanie edytora pytałoby o porzucenie zmian,
        // których nikt nie wprowadził.
        state._draftBase=JSON.stringify(state._draft);
        const rid=state._draft.id;
        if(typeof renderEditor==="function")renderEditor();
        // Powrót: gdy ta reguła zostanie ZAPISANA, wpinamy ją w wyzwalacz, dla którego powstała.
        if(rid&&apiId&&tid)_ra4AwaitRule(apiId,tid,rid);
      }catch(e){}
    }).catch(function(){});
  }catch(e){}
}

/* Czekanie na zapis nowej reguły. Edytor nie ma haka „zapisano", a `state.rules` i tak podmienia
   się CAŁE przy echu ze strumienia — więc pytamy o obecność `id` w świeżej liście. Pętla gaśnie
   sama: po wpięciu, po minucie bez zapisu, albo gdy wyzwalacz zniknie. To tanie (raz na sekundę,
   jeden `find`) i nie trzyma niczego przy życiu. */
function _ra4AwaitRule(apiId,tid,ruleId){
  let zostalo=60;
  const tik=setInterval(function(){
    if(--zostalo<0){clearInterval(tik);return;}
    const api=_ra4Api(apiId);
    const t=api&&(api.triggers||[]).find(function(x){return x.id===tid;});
    if(!api||!t){clearInterval(tik);return;}
    const r=(typeof state==="object"&&state&&Array.isArray(state.rules))
      ? state.rules.find(function(x){return x&&x.id===ruleId;}) : null;
    if(!r)return;                                  // jeszcze nie zapisana
    clearInterval(tik);
    if(t.src&&t.src.kind==="rule"){
      t.src.ruleId=ruleId;
      _ra4Save();
      _ra4Redraw(apiId,tid);
      _ra4Toast(_ra4T("Nowa reguła jest już wpięta w ten wyzwalacz.",
                      "The new rule is now wired into this trigger."));
    }
  },1000);
}
// — source: an own motion threshold —
//
// Słownik ten sam, co w karcie warunku Mapowania (rf-12 `condCardHtml`): sześć operatorów wraz
// z zakresem, |x|, NIE, suwak ze skalą metryki i „↧ ustaw na bieżącą". Wcześniej stały tu dwa
// operatory i gołe pole liczbowe — a użytkownik, który nauczył się warunku w Mapowaniu, wracał
// tutaj i nie znajdował połowy tego, czego się nauczył. Wyzwalacze mają się
// konfigurować tak samo jak w Mapowaniu.
//
// ⚠️ Nic tutaj NIE przerysowuje całej karty. Przełączenie operatora tylko odsłania pole „Do (y)",
// zmiana zachowania tylko odsłania swoje pola czasowe. Przebudowa DOM-u przy każdym znaku wyrwałaby
// fokus spod kursora — tę pułapkę ma edytor Mapowania i nie ma sensu jej tu powtarzać.
function _ra4BodyMotion(api,t,box,row){
  box.innerHTML=
    '<div class="ra-trow">'+
      '<label class="ra-tf ra-tf-dev"><span class="ra-tf-lab">Kapsel</span><select class="ra-t-dev"></select></label>'+
      '<label class="ra-tf ra-tf-srcsel"><span class="ra-tf-lab">Źródło ruchu</span><select class="ra-t-src"></select></label>'+
      '<label class="ra-tf ra-tf-cmp"><span class="ra-tf-lab">Warunek</span><select class="ra-t-cmp"></select></label>'+
      '<label class="ra-tf ra-tf-thr"><span class="ra-tf-lab ra-lab-lo">Próg</span>'+
        '<span class="ra-thr"><input type="number" class="ra-t-thr ra-mono" step="any">'+
        '<span class="ra-unit"></span>'+
        '<button type="button" class="btn sm ra-t-setlo" title="Ustaw na bieżącą wartość">↧</button></span></label>'+
      '<label class="ra-tf ra-tf-thr ra-tf-hi"><span class="ra-tf-lab">Do (y)</span>'+
        '<span class="ra-thr"><input type="number" class="ra-t-thrhi ra-mono" step="any">'+
        '<span class="ra-unit-hi"></span>'+
        '<button type="button" class="btn sm ra-t-sethi" title="Ustaw na bieżącą wartość">↧</button></span></label>'+
      '<div class="ra-tf ra-tf-live"><span class="ra-tf-lab">Teraz</span>'+
        '<span class="ra-live" data-noi18n>—</span></div>'+
      '<span class="ra-t-flag ra-t-flag-abs"><label><input type="checkbox" class="ra-t-abs"> |x|</label></span>'+
      '<span class="ra-t-flag ra-t-flag-neg"><label><input type="checkbox" class="ra-t-neg"> NIE</label></span>'+
    '</div>'+
    '<div class="ra-cond-slider ra-sl-lo"><span class="ra-sl-cap ra-lab-lo2">próg</span>'+
      '<input type="range" class="ra-t-range"><span class="num ra-t-rangev" data-noi18n></span></div>'+
    '<div class="ra-cond-slider ra-sl-hi"><span class="ra-sl-cap">do</span>'+
      '<input type="range" class="ra-t-rangehi"><span class="num ra-t-rangehiv" data-noi18n></span></div>'+
    '<div class="ra-trow">'+
      '<label class="ra-tf ra-tf-mode"><span class="ra-tf-lab">Zachowanie</span><select class="ra-t-mode"></select></label>'+
      '<label class="ra-tf ra-tf-dwell"><span class="ra-tf-lab">Czas utrzymania (ms)</span>'+
        '<input type="number" class="ra-t-dwell ra-mono" min="0" max="600000" step="1"></label>'+
      '<label class="ra-tf ra-tf-cross"><span class="ra-tf-lab">Ile razy</span>'+
        '<input type="number" class="ra-t-cross ra-mono" min="1" max="20" step="1"></label>'+
      '<label class="ra-tf ra-tf-win"><span class="ra-tf-lab">W czasie (ms)</span>'+
        '<input type="number" class="ra-t-win ra-mono" min="50" max="60000" step="10"></label>'+
    '</div>'+
    '<div class="ra-trig-note"></div>';
  const q=function(sel){return box.querySelector(sel);};
  const s=t.src;
  const reprime=function(){_ra4Drop(api.id,t.id);_ra4Prime(api.id,t);};
  const note=q(".ra-trig-note");
  const live=_ra4RegLive(q(".ra-live"),api.id,t.id);

  // — jedna funkcja odsłaniająca to, co w danej chwili ma znaczenie —
  const syncShape=function(){
    const rng=_ra4IsRange(s.cmp),mode=_ra4Mode(s.mode);
    q(".ra-tf-hi").hidden=!rng;
    q(".ra-sl-hi").hidden=!rng;
    q(".ra-tf-dwell").hidden=(mode!=="dwell");
    q(".ra-tf-cross").hidden=!(mode==="multi"||mode==="taps");
    q(".ra-tf-win").hidden=!(mode==="multi"||mode==="taps");
    q(".ra-lab-lo").textContent=rng?"Od (x)":"Próg";
    q(".ra-lab-lo2").textContent=rng?"od":"próg";
    const u=_ra4Unit(s.source);
    q(".ra-unit").textContent=u;
    q(".ra-unit-hi").textContent=u;
  };
  // — suwaki: zakres bierze się ze skali METRYKI, ta sama co w Mapowaniu —
  const syncRange=function(){
    const lo=_ra4SrcMin(s.source,s.abs===true),hi=_ra4SrcMax(s.source),st4=_ra4Step4(s.source);
    const r1=q(".ra-t-range"),r2=q(".ra-t-rangehi");
    if(r1){r1.min=lo;r1.max=hi;r1.step=st4;
      r1.setAttribute("aria-label",_ra4IsRange(s.cmp)?"Od (x)":"Próg");}
    if(r2){r2.min=lo;r2.max=hi;r2.step=st4;r2.setAttribute("aria-label","Do (y)");}
    syncNums();
  };
  const syncNums=function(){
    const a=_ra4Num(s.threshold,0);
    const b=_ra4Num(s.thresholdHi,a);
    q(".ra-t-thr").value=a;q(".ra-t-range").value=a;q(".ra-t-rangev").textContent=String(a);
    q(".ra-t-thrhi").value=b;q(".ra-t-rangehi").value=b;q(".ra-t-rangehiv").textContent=String(b);
  };
  const syncNote=function(){
    const parts=[];
    const marg=_ra4Margin(s);
    const mode=_ra4Mode(s.mode);
    parts.push(_ra4T("Histereza: warunek puści dopiero po cofnięciu o "+(Math.round(marg*10)/10)+" "+_ra4Unit(s.source)+" za próg (5% progu, min. 0,5). W Mapowaniu tego zapasu nie ma — tutaj jest, bo każde drgnięcie na granicy kosztowałoby prawdziwe żądanie sieciowe.",
                      "Hysteresis: the condition clears only after the value falls back by "+(Math.round(marg*10)/10)+" "+_ra4Unit(s.source)+" past the threshold (5% of the threshold, min. 0.5). Mapping has no such margin — here it does, because every wobble on the boundary would cost a real network request."));
    if(mode==="continuous")parts.push(_ra4T("„Ciągłe” wysyła nie częściej niż co „min. odstęp”.",
                                            "“Continuous” sends no more often than the “min. gap”."));
    if(mode==="taps")parts.push(_ra4T("„Dokładnie N puknięć” rozstrzyga na KOŃCU okna, więc jedno puknięcie i dwuklik mogą stać na dwóch różnych akcjach.",
                                      "“Exactly N taps” decides at the END of the window, so a single tap and a double tap can sit on two different actions."));
    if(_ra4IsCh(s.source))parts.push(_ra4T("Kanały CH0–CH5 czytamy po strojeniu osi, tak jak Mapowanie. Przy wyłączonym strojeniu wartość jest surowa, bez znaku z kalibracji 3D — jeśli zależy Ci na dokładnie tym samym progu co w regule, użyj źródła „Reguła z Mapowania”.",
                                            "Channels CH0–CH5 are read after axis tuning, the same as Mapping. With tuning off the value is raw, without the sign from the 3D calibration — if you need exactly the same threshold as a rule, use the “Rule from Mapping” source."));
    _ra4NoteList(note,parts);
  };
  const after=function(){reprime();_ra4Save();_ra4Touch();syncShape();syncNote();};

  _ra4DevSelect(q(".ra-t-dev"),t,function(){after();});

  // — źródło —
  const ss=q(".ra-t-src");
  for(const r of RA4_SRC){
    const o=document.createElement("option");
    o.value=r[0];o.textContent=_ra4T(r[1],r[2]);
    if(r[0]===_ra4Source(s.source))o.selected=true;
    ss.appendChild(o);
  }
  ss.addEventListener("change",function(){s.source=_ra4Source(ss.value);syncRange();after();});

  // — operator —
  const sc=q(".ra-t-cmp");
  for(const c of RA4_CMPS){
    const o=document.createElement("option");
    o.value=c[0];o.textContent=_ra4T(c[1],c[2]);
    if(c[0]===_ra4Cmp(s.cmp))o.selected=true;
    sc.appendChild(o);
  }
  sc.addEventListener("change",function(){
    s.cmp=_ra4Cmp(sc.value);
    // Ta sama reguła, co po stronie serwera przy regułach Mapowania: górna granica istnieje TYLKO
    // dla zakresu. Bez tego przełączenie operatora tam i z powrotem zostawia zakres o zerowej szerokości.
    s.thresholdHi=_ra4IsRange(s.cmp)?_ra4Num(s.thresholdHi,_ra4Num(s.threshold,0)):null;
    syncNums();syncRange();after();
  });

  // — próg i górna granica: pole liczbowe i suwak są DWOMA widokami tej samej liczby —
  const setLo=function(v,fromSlider){
    if(!isFinite(v))return;
    s.threshold=Math.max(-RA4_THR_LIM,Math.min(RA4_THR_LIM,v));
    q(".ra-t-range").value=s.threshold;q(".ra-t-rangev").textContent=String(s.threshold);
    if(fromSlider)q(".ra-t-thr").value=s.threshold;
    reprime();_ra4Save();_ra4Touch();syncNote();
  };
  const setHi=function(v,fromSlider){
    if(!isFinite(v))return;
    s.thresholdHi=Math.max(-RA4_THR_LIM,Math.min(RA4_THR_LIM,v));
    q(".ra-t-rangehi").value=s.thresholdHi;q(".ra-t-rangehiv").textContent=String(s.thresholdHi);
    if(fromSlider)q(".ra-t-thrhi").value=s.thresholdHi;
    reprime();_ra4Save();_ra4Touch();syncNote();
  };
  const thr=q(".ra-t-thr");
  thr.title=_ra4T("Próg w jednostkach źródła: stopnie, stopnie na sekundę albo LSB kanału",
                  "Threshold in the source's units: degrees, degrees per second or channel LSB");
  thr.addEventListener("input",function(){const v=parseFloat(thr.value);if(isFinite(v))setLo(v,false);});
  thr.addEventListener("change",function(){thr.value=_ra4Num(s.threshold,0);});
  const thrHi=q(".ra-t-thrhi");
  thrHi.addEventListener("input",function(){const v=parseFloat(thrHi.value);if(isFinite(v))setHi(v,false);});
  thrHi.addEventListener("change",function(){thrHi.value=_ra4Num(s.thresholdHi,_ra4Num(s.threshold,0));});
  q(".ra-t-range").addEventListener("input",function(){setLo(parseFloat(this.value),true);});
  q(".ra-t-rangehi").addEventListener("input",function(){setHi(parseFloat(this.value),true);});

  // — „↧ ustaw na bieżącą wartość": najprostszy sposób ustawienia progu to przechylić kapsel
  //   i wziąć tę liczbę. Do tej pory trzeba ją było przepisać ręcznie z odczytu obok.
  const cur=function(){
    const v=live&&live.val;
    if(typeof v!=="number"||!isFinite(v)){
      _ra4Toast(_ra4T("Nie mam bieżącej wartości — kapsel nie przysyła teraz danych.",
                      "I have no current value — the capsule is not sending data right now."),"danger");
      return null;
    }
    return _ra4IsCh(s.source)?Math.round(v):(Math.round(v*10)/10);
  };
  q(".ra-t-setlo").addEventListener("click",function(){const v=cur();if(v!=null){setLo(v,true);thr.value=v;}});
  q(".ra-t-sethi").addEventListener("click",function(){const v=cur();if(v!=null){setHi(v,true);thrHi.value=v;}});

  // — |x| i NIE —
  const ab=q(".ra-t-abs"),ng=q(".ra-t-neg");
  ab.checked=(s.abs===true);ng.checked=(s.neg===true);
  q(".ra-t-flag-abs").title=_ra4T("Porównuj wartość bezwzględną — „w którąkolwiek stronę”",
                                  "Compare the absolute value — “either way”");
  q(".ra-t-flag-neg").title=_ra4T("Spełniony wtedy, gdy warunek NIE jest spełniony",
                                  "Met when the condition is NOT met");
  ab.addEventListener("change",function(){s.abs=ab.checked;syncRange();after();});
  ng.addEventListener("change",function(){s.neg=ng.checked;after();});

  // — zachowanie —
  const sm=q(".ra-t-mode");
  for(const m of RA4_MODES){
    const o=document.createElement("option");
    o.value=m[0];o.textContent=_ra4T(m[1],m[2]);
    if(m[0]===_ra4Mode(s.mode))o.selected=true;
    sm.appendChild(o);
  }
  sm.addEventListener("change",function(){
    s.mode=_ra4Mode(sm.value);
    // Podłoga „min. odstępu" zależy od zachowania, a pole stoi w INNYM paśmie wiersza (w głowie
    // „Kiedy ma zadziałać"), więc trzeba je powiadomić — samo się nie przerysuje.
    if(typeof t._syncMin==="function")try{t._syncMin();}catch(e){}
    after();
  });
  const dw=q(".ra-t-dwell");
  dw.value=_ra4Int(s.dwellMs,0,600000,400);
  dw.addEventListener("change",function(){s.dwellMs=_ra4Int(dw.value,0,600000,400);dw.value=s.dwellMs;after();});
  const cr=q(".ra-t-cross");
  cr.value=_ra4Int(s.crossings,1,20,2);
  cr.addEventListener("change",function(){s.crossings=_ra4Int(cr.value,1,20,2);cr.value=s.crossings;after();});
  const wn=q(".ra-t-win");
  wn.value=_ra4Int(s.windowMs,50,60000,600);
  wn.addEventListener("change",function(){s.windowMs=_ra4Int(wn.value,50,60000,600);wn.value=s.windowMs;after();});

  syncNums();syncRange();syncShape();syncNote();
}

