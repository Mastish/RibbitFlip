"use strict";
/* ===== in-theme tooltip + shared app state (devices, fetch shim) =====
   The tooltip replaces native title popups: every [title] is stripped and re-published as
   [data-rftip] (plus aria-label when the element has no accessible name), so the browser
   never draws its own bubble. A MutationObserver re-runs the sweep because most of the UI
   is re-rendered from strings at runtime. */
(function(){
  var TIP=null,cur=null,mx=0,my=0,raf=0,kb=false;   // kb = dymek pokazany klawiaturą (focus), nie myszą
  function ensure(){if(TIP)return TIP;TIP=document.createElement("div");TIP.id="rf-tip";
    TIP.setAttribute("role","tooltip");TIP.setAttribute("aria-hidden","true");
    (document.body||document.documentElement).appendChild(TIP);return TIP;}
  // WCAG 2.5.3 „Label in Name": a control that SHOWS its name must keep that text in its
  // accessible name. Borrowing the tooltip as `aria-label` REPLACED it — a screen reader and
  // voice control heard „Nadaj nazwę temu, co masz teraz…" for a button that says „Utwórz preset",
  // so „click Utwórz preset" could not work. The tooltip is a DESCRIPTION, and that is where it
  // goes now. Only a control with no words of its own (an icon, a lone glyph like „⏸" or „×")
  // still takes the tooltip as its label — there it is the only name there is.
  var WORD=/[0-9A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/, DSEQ=0;
  function ownName(el){
    // PRZEŁĄCZNIK MODUŁU NIE NAZYWA SIĘ „OffOn”. Napisy Off/On w `.rf-tg-lbl` to WSKAŹNIK STANU —
    // stan niesie już aria-checked, a czytnik mówił „OffOn przełącznik włączony” trzynaście razy,
    // za każdym razem o innym module. Traktujemy taki przełącznik jak ikonę: jedyną nazwą, jaką ma,
    // jest jego podpowiedź, więc `strip()` wpisze ją w aria-label (i przetłumaczy walker rf-01).
    // WHY: Off/On is the state indicator (aria-checked already carries it), not the switch's name;
    // like an icon-only control, the switch takes its tooltip as its accessible name.
    if(el.classList&&el.classList.contains("rf-toggle"))return "";
    var t=(el.textContent||"").replace(/\s+/g," ").trim();
    return WORD.test(t)?t:"";}
  // One off-screen host for every description node: aria-describedby needs a real element with an
  // id, and hanging it INSIDE the control would put the sentence back into the name via contents.
  function describe(el,t){
    var host=document.getElementById("rf-tipdesc");
    if(!host){host=document.createElement("div");host.id="rf-tipdesc";
      host.style.cssText="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
      (document.body||document.documentElement).appendChild(host);}
    var id=el.getAttribute("data-rftip-d"),n=id?document.getElementById(id):null;
    if(!n){id="rf-tipd-"+(++DSEQ);n=document.createElement("span");n.id=id;host.appendChild(n);
      el.setAttribute("data-rftip-d",id);}
    if(n.textContent!==t)n.textContent=t;   // the i18n walker translates it like any other text node
    var db=el.getAttribute("aria-describedby")||"";
    if(db.split(/\s+/).indexOf(id)<0)el.setAttribute("aria-describedby",(db?db+" ":"")+id);
  }
  // The i18n walker (rf-01) may already have translated `title` into English and cached the Polish
  // original in el._i18nA.title. The attributes derived here must be seeded from THAT original, not
  // from the translated value: otherwise the English text became the "original" of data-rftip /
  // aria-label / the description node, and a switch back to PL restored English (measured
  // 2026-09-03: ~160 tooltips stuck in English after EN -> PL). Writing the Polish source and letting
  // the walker's observer translate it again keeps both directions of the toggle honest.
  function strip(el){var t=el.getAttribute("title");if(t==null)return;el.removeAttribute("title");
    if(t==="")return;
    var st=el._i18nA,src=(st&&("title" in st))?st.title:t;
    if(st&&("title" in st))delete st.title;
    el.setAttribute("data-rftip",src);
    if(el.getAttribute("aria-label")||el.getAttribute("aria-labelledby"))return;
    if(ownName(el))describe(el,src); else el.setAttribute("aria-label",src);}
  function sweep(root){if(!root||root.nodeType!==1)return;
    if(root.hasAttribute&&root.hasAttribute("title"))strip(root);
    var l=root.querySelectorAll?root.querySelectorAll("[title]"):[];for(var i=0;i<l.length;i++)strip(l[i]);}
  function place(){raf=0;if(!TIP||TIP.style.display!=="block")return;
    var w=TIP.offsetWidth,h=TIP.offsetHeight,vw=innerWidth,vh=innerHeight;
    var x=mx+20,y=my+16;                        // right of + below the foam hand
    if(x+w>vw-6)x=mx-w-18;                       // near right edge -> flip left of the hand
    if(x<6)x=6;
    if(y+h>vh-6)y=my-h-14;                       // near bottom -> flip above the fingertip
    if(y<6)y=6;
    TIP.style.left=x+"px";TIP.style.top=y+"px";}
  function show(el){var t=el.getAttribute("data-rftip");if(!t)return;cur=el;ensure();
    // Translate at show time: tooltips can be attached to nodes created after applyLang ran,
    // so repeat the same exact-match dictionary lookup here.
    if(typeof _lang!=="undefined"&&_lang==="en"&&typeof I18N_EN!=="undefined"){var _k=t.replace(/\s+/g,' ').trim();if(I18N_EN[_k]!=null)t=I18N_EN[_k];}
    // DLACZEGO: najdłuższe podpowiedzi (Momentum, „Napęd części", Zestawy › plik) mają 200-240
    // znaków, a domyślne 264 px łamało je na 6-7 wierszy — oko gubi wiersz przy powrocie do lewej
    // krawędzi. Powyżej 160 znaków dymek dostaje szerszą miarę, tak jak wariant z obrazkiem ma
    // swoje 320 px. Mierzymy PRZETŁUMACZONY tekst, bo EN bywa dłuższy od PL.
    // WHY: the longest tips run 200-240 characters and wrapped to 6-7 lines in the 264px bubble;
    // a wider measure brings them back to four or five. place() already flips off the right edge.
    TIP.classList.toggle("rf-tip-long",t.length>160);
    // Optional picture, from data-rftip-ic: a class name, never markup. Built as nodes rather than
    // innerHTML so nothing in a label can turn into HTML, and filtered to class characters because
    // the attribute is the only part of this that a future caller could get creative with.
    var ic=(el.getAttribute("data-rftip-ic")||"").replace(/[^A-Za-z0-9 _-]/g,"").trim();
    TIP.textContent="";
    if(ic){
      var row=document.createElement("div");row.className="rf-tip-row";
      var im=document.createElement("span");im.className="rf-tip-ic "+ic;im.setAttribute("aria-hidden","true");
      var tx=document.createElement("span");tx.textContent=t;
      row.appendChild(im);row.appendChild(tx);TIP.appendChild(row);
    }else TIP.textContent=t;
    TIP.style.display="block";TIP.setAttribute("aria-hidden","false");place();}
  function hide(){cur=null;kb=false;if(TIP){TIP.style.display="none";TIP.setAttribute("aria-hidden","true");}}
  /* ⚠️ DYMEK ZOSTAWAŁ NA EKRANIE, GDY JEGO KOTWICA ZNIKAŁA PRZY PRZERYSOWANIU.
     Wszystkie dotychczasowe drogi do `hide()` wychodzą od CZŁOWIEKA: `mouseout`, `focusout`,
     `mousedown`, `wheel`, klawisz. Żadna z nich nie zachodzi, kiedy panel przebudowuje kawałek
     siebie przez `innerHTML=""` — element pod kursorem po prostu przestaje istnieć, `mouseout`
     nie ma już z czego polecieć, a chmurka zostaje: w tym samym miejscu, z nieaktualnym tekstem,
     NAD świeżą treścią. Najlepiej widać to w Usługach sieciowych, gdzie lista wyzwalaczy
     przerysowuje się przy każdej zmianie i przy każdym wysłanym żądaniu — ale dotyczy to całego
     panelu, bo prawie wszystko jest tu budowane ze stringów.
     Wariant klawiaturowy jest gorszy: dymka pokazanego fokusem nie chowa ani ruch myszy, ani
     `mouseout` (patrz `kb` niżej), więc zostaje aż do kolejnego klawisza.
     Sprzątamy tam, gdzie problem naprawdę jest — w obserwatorze, który i tak już chodzi. */
  function hideIfGone(){if(cur&&!cur.isConnected)hide();}
  // WCAG 1.4.13 „Content on Hover or Focus": podpowiedź, którą widać TYLKO pod myszą, nie istnieje
  // dla człowieka chodzącego po panelu klawiszem Tab — a w pigułce kapsla, na kropkach nawigacji
  // i przy „×" podpowiedź jest jedyną nazwą przycisku (patrz ownName/strip wyżej). Fokus pokazuje
  // ten sam dymek co najechanie, przy dolnej krawędzi elementu, i chowa go dopiero przy zejściu
  // fokusa albo przy klawiszu, który coś robi (Tab i same modyfikatory zostawiają dymek widoczny,
  // bo Tab właśnie przenosi fokus na kolejny przycisk, a Shift/Alt/Ctrl są tylko połową skrótu).
  // WHY: a tooltip that only appears under the mouse does not exist for a keyboard user, and for
  // icon-only controls it is the accessible name itself; focus shows the same bubble.
  document.addEventListener("focusin",function(e){
    var t=e.target;if(!t||!t.closest)return;
    // Pola tekstowe mają własną etykietę i podpowiedź czyta czytnik z aria-describedby — dymek
    // przykrywałby tam to, co człowiek właśnie pisze.
    if(t.matches&&t.matches("input,textarea,select,[contenteditable],[contenteditable=true]"))return;
    var el=t.closest("[data-rftip]");if(!el)return;
    // :focus-visible = fokus, który przeglądarka uznała za „z klawiatury"; po kliknięciu myszą
    // przycisk też dostaje fokus, a wtedy dymek już pokazał mouseover (albo człowiek go nie chce).
    try{if(!t.matches(":focus-visible"))return;}catch(_e){}
    var r=el.getBoundingClientRect();
    mx=r.left+r.width/2;my=r.bottom;      // środek dolnej krawędzi — place() liczy resztę
    kb=true;show(el);
  },true);
  document.addEventListener("focusout",function(e){
    if(!kb||!cur)return;
    if(e.target===cur||(cur.contains&&e.target&&cur.contains(e.target)))hide();
  },true);
  document.addEventListener("mouseover",function(e){
    var el=e.target&&e.target.closest?e.target.closest("[data-rftip]"):null;
    if(!el||el===cur)return;
    kb=false;                                    // mysz przejmuje dymek od klawiatury
    // Take the position from THIS event. mouseover fires before the first mousemove over the new
    // element, so placing from the stored mx/my put the bubble wherever the hand was LAST — and it
    // stayed there until the hand moved again. Land on something without moving further (or with
    // nothing recorded yet, mx/my still 0,0) and the tooltip flew in from the top-left corner.
    if(e.isTrusted||e.clientX||e.clientY){mx=e.clientX;my=e.clientY;}
    show(el);},true);
  document.addEventListener("mouseout",function(e){
    if(!cur||kb)return;var to=e.relatedTarget;   // dymek klawiaturowy chowa dopiero focusout
    if(!to||!(to.closest&&to.closest("[data-rftip]")===cur))hide();},true);
  document.addEventListener("mousemove",function(e){mx=e.clientX;my=e.clientY;
    if(cur&&!kb&&!raf)raf=requestAnimationFrame(place);},true);   // ruch myszy nie przestawia dymka spod fokusa
  ["mousedown","wheel"].forEach(function(ev){document.addEventListener(ev,hide,true);});
  // Tab i same modyfikatory NIE chowają dymka: Tab przenosi fokus na kolejny przycisk (focusin pokaże
  // jego podpowiedź), a Shift/Alt/Ctrl/Meta to dopiero połowa skrótu. Reszta klawiszy chowa jak dawniej.
  // Bez stopPropagation/preventDefault — Escape ma nadal dochodzić do dialogów, które go nasłuchują.
  var KBKEEP={Tab:1,Shift:1,Alt:1,Control:1,Meta:1,CapsLock:1,OS:1};
  document.addEventListener("keydown",function(e){if(!KBKEEP[e.key])hide();},true);
  function init(){ensure();sweep(document.body);
    new MutationObserver(function(muts){var znikalo=false;
      for(var i=0;i<muts.length;i++){var m=muts[i];
        if(m.type==="attributes"){if(m.target.getAttribute&&m.target.getAttribute("title")!=null)strip(m.target);}
        else{for(var j=0;j<m.addedNodes.length;j++)sweep(m.addedNodes[j]);
             if(m.removedNodes&&m.removedNodes.length)znikalo=true;}}
      // Pytamy o `isConnected` RAZ na porcję zmian, a nie raz na usunięty węzeł: przerysowanie
      // listy potrafi usunąć setki węzłów naraz, a odpowiedź jest dla wszystkich ta sama.
      if(znikalo)hideIfGone();})
      .observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["title"]});}
  // Jedna nazwa na zewnątrz — dla kodu, który BURZY DOM świadomie i woli schować dymek od razu,
  // nie czekając na porcję obserwatora. Reszta panelu nie musi o tym wiedzieć.
  try{window.rfTipHide=function(){hide();};}catch(e){}
  if(document.body)init();else document.addEventListener("DOMContentLoaded",init);})();


state.masterArmed=true;
state.detailView=false;          // preview: false=compact, true=details (condition timeline + progress)
try{state.detailView=localStorage.getItem("ribbitflip.detailView")==="1";}catch(e){}
state.clockNow=0;                 // max ts ACROSS ALL slots (shared broadcaster clock) — countdown in the cheat sheet doesn't freeze when the active slot is asleep
state.ovPoseH=160;                // 3D preview height in the cheat sheet (px) — adjustable by drag
try{const _h=+localStorage.getItem("ribbitflip.ovPoseH");if(_h>=90&&_h<=520)state.ovPoseH=_h;}catch(e){}
// MIDI/OSC CONTROLLER — independent output group (per-slot 'enabled' switch, like motion control)
state.trigEnabled=true;     // "Mapping" group (triggers) — independent switch
// MAPPING LAYERS: which of the capsule's rule sets is listening (1..4). Rules carry `layer`:
// 0 = „Zawsze" (every layer, and the default for everything written before layers existed).
// Server-owned — this is a mirror of the last `trig`/`rules` packet, never the source of truth.
state.activeLayer=1;
// per-slot, opt-in (OFF by default). 'enabled' = MIDI out, 'oscEnabled' = OSC out — two independent switches.
// `configName` = jak się ten zestaw mapowań nazywa (pasek tożsamości, rf-49d). Klucz MUSI stać
// tutaj, a nie tylko przychodzić z serwera: miFetchState odbudowuje state.midi pole po polu, więc
// nazwa bez miejsca w modelu ginęłaby przy pierwszym przełączeniu kapsla.
state.midi={enabled:false,oscEnabled:false,midiChannel:0,oscPrefix:"/ribbitflip",scaleRoot:0,scale:"chromatic",mappings:[],configName:""};
state.midiEnv={midiAvail:false,midiActive:false,midiPort:-1,oscAvail:false,
               oscHost:"127.0.0.1",oscPort:9000,ports:[]};
state.midiEditing=null; state._midiDraft=null; state.midiOut={}; state.midiOutLive=false;
const IS_OVERVIEW=/[?&]view=overview/.test(location.search);   // separate "cheat sheet" window
// A device id the panel actually KNOWS. devEntry() below CREATES a slot as a side effect, so every
// fallback of the kind "show d0 when nothing is selected" has to pass through here first: after a
// slot is forgotten, a bare devEntry("d0") rebuilt it as a ghost pill the server has never heard
// of — one that "remove" could only answer with "cannot remove the last device".
function devKnownId(id){
  const devs=state.devices||{};
  if(id&&devs[id])return id;
  if(state.activeDeviceId&&devs[state.activeDeviceId])return state.activeDeviceId;
  const k=Object.keys(devs);
  return k.length?k[0]:null;
}
function devEntry(id){
  let d=state.devices[id];
  if(!d){
    d=state.devices[id]={meta:{dev:id,slot:999,name:id,color:"#8aa0b5",label:"",muted:false,paused:false,bound:false},
                         // cfgName = nazwa konfiguracji, którą ten kapsel NOSI (rf-49b). Obok reguł,
                         // bo przychodzi razem z nimi w zdarzeniu `rules` i dotyczy dokładnie ich.
                         conn:"",rules:[],cfgName:"",rt:{},
                         // per-capsule telemetry (Sensor/Connection tabs render the VIEWED one)
                         buf:mkBuf(),poseBuf:{tilt:[],twist:[],pitch:[],roll:[],spin:[]},pose:null,last:{},
                         // raw channels AFTER their tuning chain — present only while some channel
                         // is tuned (the server omits the key otherwise, see Pipeline.handle)
                         chan:null,chanBuf:{ch0:[],ch1:[],ch2:[],ch3:[],ch4:[],ch5:[]},lastSh:null,
                         nowTs:0,statusPkt:null,events:[],btnPresses:[],devInfo:null,stats:null,powerCfg:null,
                         scanning:true,parked:false};
  }
  return d;
}
// SHIM: append ?dev=<active slot> to per-device endpoints (one place instead of
//  ~18 fetch calls). /arm and /devices are GLOBAL -> no dev. Calls that already
//  have ?dev (e.g. mute/device for a specific slot) are skipped (they contain "?").
const _DEV_FETCH=new Set(["/rules","/layer","/power","/airmouse","/airmouse/calibrate",
  "/sleep","/wake","/command","/test-key","/profile/save","/profile/load",
  // Profile myszy dotyczą tego kapsla, który jest AKTYWNY (kartę Mysz edytuje się dla niego),
  // dokładnie jak /airmouse obok. Zapis czyta konfigurację kapsla, gdy pytanie nie niesie własnej.
  "/mouse-preset/save","/mouse-preset/load",
  // …i tak samo presety MIDI/OSC: zestaw mapowań należy do kapsla, który jest AKTYWNY (obie
  // zakładki, MIDI i OSC, edytuje się dla niego). Bez tego wpisu wczytanie z Biblioteki trafiłoby
  // w d0 niezależnie od tego, kogo człowiek ma na ekranie.
  "/midi-preset/save","/midi-preset/load",
  "/mute","/pause","/identify","/device","/midi","/test-midi","/trig-enable",
  "/setup","/setup/save","/setup/load","/setup/delete"]);
// Endpoints that follow the VIEWED capsule (Sensor/Connection tabs) rather than the active slot.
// The axis configuration and its presets belong here: they are edited in the Sensor tab, which shows
// one capsule at a time, and their payload is a WHOLE calibration — sent to the wrong slot it does
// not merely miss, it overwrites that slot's channel map. (/pose itself names the slot explicitly in
// rf-33 for the same reason; it stays listed so nothing here silently falls back to the active one.)
const _VIEW_FETCH=new Set(["/sleep","/wake","/command","/power","/virtual","/pose",
  "/pose-preset/save","/pose-preset/load"]);
// A PAGE FROM THE PREVIOUS RUN (2026-09-07). The server hands out a new anti-CSRF token every time it
// starts, and a tab that was open across that restart still holds the old one. It does not LOOK stale:
// the stream reconnects by itself and the numbers keep moving — but every write comes back 403, so
// dragging a capsule onto a controller, picking one on its chip, saving a rule all "do nothing", and
// the only trace was a toast blaming the server. Reported in exactly those words after a rebuild.
// Two ways of noticing, one answer: the stream says which run is talking (rf-08 compares `boot` with
// the id injected into this page), and a 403 on a request that carried our token is the same news
// arriving late. Either way the page reloads itself — once — and says so after it is back.
var _rfStaleT=null;
function rfStaleReload(why){
  if(_rfStaleT)return;
  try{sessionStorage.setItem("rf.staleReload",String(why||"1"));}catch(e){}
  try{if(typeof rfToast==="function")rfToast((typeof _gl==="function")
    ?_gl("RibbitFlip został uruchomiony na nowo — odświeżam panel","RibbitFlip was restarted — reloading the panel")
    :"RibbitFlip został uruchomiony na nowo — odświeżam panel");}catch(e){}
  _rfStaleT=setTimeout(function(){try{location.reload();}catch(e){}},700);
}
// …and after the reload, one sentence about what just happened, so a panel that blinked is not a
// mystery. Read and cleared at once: a second reload for any other reason must not repeat it.
document.addEventListener("DOMContentLoaded",function(){
  var why=null;
  try{why=sessionStorage.getItem("rf.staleReload");if(why!=null)sessionStorage.removeItem("rf.staleReload");}catch(e){}
  if(why==null)return;
  setTimeout(function(){if(typeof rfToast==="function")rfToast((typeof _gl==="function")
    ?_gl("Panel odświeżony po ponownym uruchomieniu RibbitFlipa","Panel reloaded after RibbitFlip restarted")
    :"Panel odświeżony po ponownym uruchomieniu RibbitFlipa");},1500);
});
const _origFetch=window.fetch.bind(window);
window.fetch=function(url,opts){
  opts=opts||{};
  try{
    if(typeof url==="string"&&url[0]==="/"&&url.indexOf("?")<0){
      // Connection actions (sleep/wake/command/battery) target the VIEWED capsule (Connection tab);
      //  everything else per-capsule targets the global ACTIVE slot.
      if(_VIEW_FETCH.has(url)) url=url+"?dev="+encodeURIComponent(state.viewDev||state.activeDeviceId||"d0");
      else if(_DEV_FETCH.has(url)) url=url+"?dev="+encodeURIComponent(state.activeDeviceId||"d0");
    }
    // Attach the session token to mutating requests (same-origin) — anti-CSRF gate.
    // A foreign website doesn't know the token and cannot send its own X-RibbitFlip-Token header
    // (a custom header forces a CORS preflight, which the server doesn't handle).
    var _m=((opts.method||"GET")+"").toUpperCase();
    if(typeof url==="string"&&url[0]==="/"&&_m!=="GET"&&_m!=="HEAD"&&window.RIBBITFLIP_TOKEN){
      var _h=opts.headers||{};
      if(_h instanceof Headers){_h.set("X-RibbitFlip-Token",window.RIBBITFLIP_TOKEN);}
      else{_h=Object.assign({},_h);_h["X-RibbitFlip-Token"]=window.RIBBITFLIP_TOKEN;opts.headers=_h;}
    }
  }catch(e){}
  var _p=_origFetch(url,opts);
  // A 403 on a request that CARRIED our token can only mean the token is from another run of the
  // program (see rfStaleReload above). Observed on a branch of the promise, so the caller still
  // gets the response it asked for.
  try{
    if(typeof url==="string"&&url[0]==="/"&&_m!=="GET"&&_m!=="HEAD"&&window.RIBBITFLIP_TOKEN)
      _p.then(function(r){if(r&&r.status===403)rfStaleReload("403");}).catch(function(){});
  }catch(e){}
  return _p;
};

