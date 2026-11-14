"use strict";
// ===================== MYSZ: LINIA GOTOWOŚCI I WARUNKI PUDEŁEK (UX 261120) =====================
// Karta Myszy mówiła o swoim stanie trzema głosami: chip „○ wyłączony", zdanie „włącz przełącznikiem
// On…" i notki w zwinięciach. Pod spodem stała jeszcze notka „Zatrzymaj kursor, a aplikacja kliknie"
// także przy wyłączonej Myszy, choć silnik liczy bezruch tylko wtedy, gdy kapsel naprawdę prowadzi
// kursor. Teraz:
//   · linia gotowości nad kartą (wspólny `rfReady`, rf-28c): Mysz włączona, sterowanie włączone,
//     kapsel, a gdy wszystko gra, zdanie ze skrótem awaryjnym (kursor, który ucieka, trzeba czymś
//     zatrzymać, a jedyny włącznik trzeba by trafić tym samym kursorem),
//   · pod pudełkami „Klik bez klikania" i „Przycisk kapsla klika" uczciwy warunek z przyciskiem,
//     który klika tę samą kontrolkę co człowiek (#mEnable, #trigEnable, #armBtn),
//   · suwak „Ile trzeba wychylić…" i podsumowanie zwiniętego „Dostrajania ruchu".
// Linia i warunki liczą się z tych samych stanów, dlatego mieszkają w jednym pliku i odświeżają się
// razem (linia co sekundę, warunki przy każdym mFill i przy każdym liczeniu linii).
// Napisy przez _gl: składane w JS, więc bez kluczy w I18N_EN, a gospodarze mają data-noi18n.

// Czy ruch kapsla prowadzi teraz kursor (a nie pad na ekranie Kontroler).
function mDrivesCursor(){
  const m=(typeof state!=="undefined"&&state.mouse)||{};
  return !!(m.enabled&&m.mode==="mouse");
}

// Warunek pod pudełkiem: zdanie i przyciski. `need` = lista {pl,en,click} albo null, gdy wszystko
// gra; wtedy pudełko pokazuje zwykłe zdanie `okText` (z klasą `ok`, jeśli funkcja jest włączona).
// Odcisk chroni przed przerysowaniem przy każdym liczeniu (ognisko klawiatury na przycisku).
function _mCondRender(host,need,okText,on,extra){
  if(!host)return;
  const lang=(typeof _lang!=="undefined"?_lang:"pl");
  const sig=lang+"|"+(need?need.text+"|"+need.btns.map(b=>b.click).join(","):"ok|"+okText+"|"+on)+"|"+(extra?extra.click||"x":"");
  if(host.dataset.sig===sig)return;
  host.dataset.sig=sig;
  host.className="mouse-avail col2"+(need?" mcond":(on?" ok":""));
  host.textContent="";
  const tx=document.createElement("span");
  tx.className="mcond-tx";
  tx.textContent=need?need.text:okText;
  host.appendChild(tx);
  const btns=(need?need.btns:[]).concat(extra?[extra]:[]);
  btns.forEach(b=>{
    const el=document.createElement("button");
    el.type="button";el.className="btn xs"+(b.ghost?" ghost":"");
    el.textContent=_gl(b.pl,b.en);
    el.onclick=()=>{
      if(b.click){const t=document.querySelector(b.click);if(t)t.click();}
      else if(typeof b.run==="function")b.run();
      host.dataset.sig="";setTimeout(mMouseCondSync,150);
    };
    host.appendChild(el);
  });
}

// Co brakuje, żeby kursor klikał sam (Klik bez klikania): kapsel musi prowadzić kursor, a sterowanie
// musi być włączone (silnik: live = emitter i enabled i armed).
function _mDwellNeed(){
  const m=state.mouse||{};
  if(!mDrivesCursor()){
    const pad=!!(m.enabled&&m.mode!=="mouse");
    return {text:_gl("Kliknie dopiero, gdy kapsel prowadzi kursor."+(pad?" Teraz prowadzi pad na ekranie Kontroler.":""),
                     "It clicks only while the capsule moves the cursor."+(pad?" Right now it drives the pad on the Controller screen.":"")),
      btns:[{pl:pad?"Przełącz na kursor":"Włącz Mysz",en:pad?"Switch to cursor":"Turn the mouse on",click:"#mEnable"}]};
  }
  if(!state.armed)return {text:_gl("Kliknie dopiero, gdy sterowanie jest włączone.","It clicks only while control is on."),
      btns:[{pl:"Włącz sterowanie",en:"Turn control on",click:"#armBtn"}]};
  return null;
}
// Przycisk kapsla klika przez cztery reguły Mapowania, więc warunkiem jest moduł Mapowanie
// (a nie Mysz) i włączone sterowanie.
function _mBtnNeed(){
  if(!state.trigEnabled)return {text:_gl("Działa, gdy Mapowanie jest włączone.","Works while Mapping is on."),
      btns:[{pl:"Włącz Mapowanie",en:"Turn Mapping on",click:"#trigEnable"}]};
  if(!state.armed)return {text:_gl("Działa, gdy sterowanie jest włączone.","Works while control is on."),
      btns:[{pl:"Włącz sterowanie",en:"Turn control on",click:"#armBtn"}]};
  return null;
}
const _M_SEE_RULES={pl:"Zobacz te ruchy w Mapowaniu",en:"See these moves in Mapping",ghost:true,
  run:()=>{if(window.rfReady)rfReady.goTab("mapowanie");}};

function mMouseCondSync(){
  if(typeof state==="undefined"||!state.mouse)return;
  const $=id=>document.getElementById(id),m=state.mouse;
  {const host=$("mDwellNote");
   if(host){
     let ok;
     if(!m.dwellOn)ok=_gl("Wyłączone. Kursor sam z siebie nic nie kliknie.","Off. The cursor will not click anything by itself.");
     else{
       const nazwa={left:["lewym","the left button"],right:["prawym","the right button"],
                    middle:["środkowym","the middle button"],double:["dwuklikiem","a double-click"]}[m.dwellClick]
                   ||["lewym","the left button"];
       const sec=(typeof _mDwellSec==="function")?_mDwellSec(m.dwellMs):(m.dwellMs/1000)+" s";
       ok=_gl("Zatrzymaj kursor na "+sec+", a aplikacja kliknie "+nazwa[0]+". Klika raz. Na kolejny klik trzeba najpierw ruszyć kursorem poza promień spokoju.",
              "Hold the cursor still for "+sec+" and the app clicks "+nazwa[1]+". It clicks once. The next click needs the cursor to leave the calm radius first.");
     }
     _mCondRender(host,_mDwellNeed(),ok,!!m.dwellOn);}}
  {const host=$("mBtnClicksNote");
   if(host){
     const on=(typeof mbtnOn==="function")&&mbtnOn();
     let ok;
     if(!on)ok=_gl("Wyłączone. Przycisk kapsla nie klika myszą.","Off. The capsule button does not click the mouse.");
     else{
       const t=(typeof _mbtnTimes==="function")?_mbtnTimes():{win:400};
       const custom=(typeof _mbtnCustom==="function")&&_mbtnCustom();
       ok=_gl("Pojedynczy klik idzie po "+_mSec2(t.win)+", bo aplikacja czeka, czy nie przyjdzie drugie puknięcie."
               +(custom?" Zestaw jest przerobiony w Mapowaniu, tu zmieniasz już tylko czasy.":""),
              "A single click arrives after "+_mSec2(t.win)+", because the app waits to see whether a second tap is coming."
               +(custom?" The set has been edited in Mapping, here you only change the times.":""));
     }
     // „Zobacz te ruchy" ma sens dopiero, gdy reguły istnieją (po pierwszym włączeniu).
     const have=(typeof _mbtnRules==="function")&&Object.keys(_mbtnRules()).length>0;
     _mCondRender(host,_mBtnNeed(),ok,on,have?_M_SEE_RULES:null);}}
}
// Sekundy z dwoma miejscami po przecinku (0,40 s): czasy puknięć różnią się o 50 ms.
function _mSec2(ms){
  const s=(Math.max(0,+ms||0)/1000).toFixed(2);
  return ((typeof _lang!=="undefined"&&_lang==="en")?s:s.replace(".",","))+" s";
}

// Suwak „Ile trzeba wychylić…": widoczny przy źródle „Filtr 3D" (przy „Oś" ten slot zajmują Czułość X
// i Y), podpis zależy od trybu, bo przy „Położeniu" ta sama liczba znaczy brzeg obszaru.
function mMouseScaleSync(){
  const $=id=>document.getElementById(id),m=state.mouse||{};
  const fld=$("mMouseScaleFld");if(!fld)return;
  const filter=(m.mouseSource==="filter"), abs=!!m.mouseAbsolute&&filter;
  fld.style.display=filter?"":"none";
  const tx=$("mMouseScaleTx");
  if(tx){const t=abs?_gl("Ile trzeba wychylić, żeby dojść do brzegu obszaru","Tilt needed to reach the edge of the area")
                    :_gl("Ile trzeba wychylić do pełnej prędkości","Tilt needed for full speed");
    if(tx.textContent!==t)tx.textContent=t;}
  const v=$("mMouseFilterScalev");if(v)v.textContent=Math.round(+m.mouseFilterScale||0)+"°";
}

// Podsumowanie zwiniętego „Dostrajania ruchu": źródło, wygładzanie, krzywa.
let _mTuneSum=null;
function _mTuneSummary(){
  const m=state.mouse||{};
  const src=(m.mouseSource==="filter")?_gl("Filtr 3D","3D filter"):_gl("Oś","Axis");
  const sm=(m.smoothMode==="oneeuro")?_gl("wygładzanie adaptacyjne","adaptive smoothing"):_gl("wygładzanie klasyczne","classic smoothing");
  let ex=(+m.mouseExpo||1).toFixed(2);
  if(typeof _lang==="undefined"||_lang!=="en")ex=ex.replace(".",",");
  return src+" · "+sm+" · "+_gl("krzywa ","curve ")+ex;
}

// Piętro „Dostrajania ruchu" (rfTier, rf-28d): kontrolka → pole state.mouse. Domyślne to migawka
// state.mouse z chwili wczytania pliku (lustro AirMouse.DEFAULTS w rf-02; konfiguracja z serwera
// przychodzi dopiero po starcie). Licznik liczy tylko pola widoczne w bieżącym źródle ruchu.
const _M_TUNE={mMouseSource:"mouseSource",mAxisX:"mouseAxisX",mAxisY:"mouseAxisY",mDead:"mouseDeadzone",
  mMouseMetricX:"mouseMetricX",mMouseMetricY:"mouseMetricY",mMouseEdge:"mouseEdgeFollow",mSmoothMode:"smoothMode",
  mSmooth:"smooth",mOeMin:"oeMinCutoff",mOeBeta:"oeBeta",mMax:"maxStep",mMouseExpo:"mouseExpo",mTighten:"tighten",
  mAccelOn:"accelOn",mSensFast:"sensFast",mAccelLo:"accelThrLo",mAccelHi:"accelThrHi",mScroll:"scroll",
  mScrollAxis:"scrollAxis",mScrollThr:"scrollThreshold",mScrollSens:"scrollSens",mAutoTare:"autoTare"};
const _M_TUNE_DEF=(function(){const m=(typeof state!=="undefined"&&state.mouse)||{},d={};
  for(const id in _M_TUNE)d[_M_TUNE[id]]=m[_M_TUNE[id]];return d;})();
function _mTunePick(){const m=state.mouse||{},o={};for(const id in _M_TUNE)o[_M_TUNE[id]]=m[_M_TUNE[id]];return o;}
function _mTuneApply(v){Object.assign(state.mouse,v);mFill();mMouseLayoutSync();commitMouse();}
function _mTuneChanged(){
  const det=document.getElementById("mTune"),m=state.mouse||{};let n=0;
  for(const id in _M_TUNE){const el=document.getElementById(id),k=_M_TUNE[id];
    if(!el||!rfTier.shown(el,det))continue;
    if(!rfTier.same(m[k],_M_TUNE_DEF[k]))n++;}
  return n;
}

// ----- PIĘTRO 2 (UX 261120 L4d): zwijaki „ustawiasz raz” -----
// Ten sam wzór co „Dostrajanie ruchu”: kontrolka → pole state.mouse, domyślne = migawka z chwili
// wczytania pliku, licznik tylko z pól widocznych w bieżącym trybie. Podsumowanie liczy rfTier sam
// (etykieta + wartość kontrolek), oprócz przycisku kapsla, który stanu w state.mouse nie ma.
function _mTierMap(detId,map){
  const def={},m0=(typeof state!=="undefined"&&state.mouse)||{};
  for(const id in map)def[map[id]]=m0[map[id]];
  const pick=()=>{const m=state.mouse||{},o={};for(const id in map)o[map[id]]=m[map[id]];return o;};
  const apply=v=>{Object.assign(state.mouse,v);mFill();mMouseLayoutSync();commitMouse();};
  return {def:def,take:pick,restore:apply,reset:()=>apply(Object.assign({},def)),
    changed:()=>{const det=document.getElementById(detId),m=state.mouse||{};let n=0;
      for(const id in map){const el=document.getElementById(id);
        if(!el||!rfTier.shown(el,det))continue;
        if(!rfTier.same(m[map[id]],def[map[id]]))n++;}
      return n;}};
}
const _M_FOLDS=[
  ["mSensFold","mysz.czulosc",{mMouseFilterScale:"mouseFilterScale",mSensX:"sensX",mSensY:"sensY",
    mInvX:"mouseInvertX",mInvY:"mouseInvertY",mMouseFilterDead:"mouseFilterDead"}],
  ["mDwellFold","mysz.klik",{mDwellMs:"dwellMs",mDwellRad:"dwellRadius",mDwellClickSeg:"dwellClick"}],
  ["mAreaFold","mysz.obszar",{mArea:"mouseArea",mMonitor:"mouseMonitor",mAreaWork:"mouseAreaWork",mAreaPad:"mouseAreaPad"}]
];
let _mFoldSyncs=null;
// Nagłówek „Czułość i kierunek”: krótko, bo pełna nazwa suwaka sama zajmuje 40 znaków.
function _mSensSummary(){
  const m=state.mouse||{},en=(typeof _lang!=="undefined"&&_lang==="en");
  const dec=v=>en?String(v):String(v).replace(".",",");
  const filter=(m.mouseSource==="filter"),abs=!!m.mouseAbsolute&&filter;
  const p=[];
  if(filter)p.push((abs?_gl("brzeg obszaru przy ","area edge at "):_gl("pełna prędkość przy ","full speed at "))+Math.round(+m.mouseFilterScale||0)+"°");
  else p.push(_gl("czułość ","sensitivity ")+dec((+m.sensX).toFixed(3))+" / "+dec((+m.sensY).toFixed(3)));
  const ix=!!m.mouseInvertX,iy=!!m.mouseInvertY;
  p.push(_gl("odwrócone: ","inverted: ")+(ix&&iy?_gl("oba kierunki","both"):ix?_gl("lewo i prawo","left and right"):iy?_gl("góra i dół","up and down"):_gl("nie","no")));
  if(filter)p.push(_gl("martwa strefa ","dead zone ")+Math.round(+m.mouseFilterDead||0)+"°");
  const out=p.join(" · ");
  return out.charAt(0).toUpperCase()+out.slice(1);
}
// Nagłówek „Przycisk kapsla klika”: działa czy nie, a gdy czegoś brakuje, to samo zdanie co warunek.
function _mBtnSummary(){
  const on=(typeof mbtnOn==="function")&&mbtnOn();
  if(!on)return _gl("wyłączony","off");
  const need=_mBtnNeed();
  if(need)return need.text;
  const t=(typeof _mbtnTimes==="function")?_mbtnTimes():{win:400};
  return _gl("włączony · okno puknięć ","on · tap window ")+_mSec2(t.win);
}

function mMouseLayoutSync(){
  if(!document.getElementById("mouseCard"))return;
  mMouseScaleSync();
  if(!_mTuneSum&&typeof rfTier==="function")_mTuneSum=rfTier(document.getElementById("mTune"),"mysz.dostrajanie",{
    sum:_mTuneSummary, changed:_mTuneChanged,
    reset:()=>_mTuneApply(Object.assign({},_M_TUNE_DEF)), take:_mTunePick, restore:_mTuneApply});
  if(_mTuneSum)_mTuneSum();
  if(!_mFoldSyncs&&typeof rfTier==="function"){
    _mFoldSyncs=_M_FOLDS.map(f=>{const t=_mTierMap(f[0],f[2]);
      return rfTier(document.getElementById(f[0]),f[1],{changed:t.changed,reset:t.reset,take:t.take,restore:t.restore,
        sum:f[0]==="mSensFold"?_mSensSummary:undefined});});
    _mFoldSyncs.push(rfTier(document.getElementById("mBtnFold"),"mysz.przycisk",{sum:_mBtnSummary}));
  }
  if(_mFoldSyncs)_mFoldSyncs.forEach(f=>f());
  mMouseCondSync();
}

function initMouseReady(){
  const $=id=>document.getElementById(id);
  {const e=$("mMouseFilterScale");
   if(e)e.addEventListener("input",()=>mMouseScaleSync());}
  mMouseLayoutSync();
}

// ----- LINIA GOTOWOŚCI -----
if(window.rfReady)rfReady.register({
  id:"rfReadyMysz",
  anchor:()=>rfReady.headOf("mysz"),
  allOk:()=>{
    const k=(typeof rfHotkeyKeys==="function")?rfHotkeyKeys():null;
    return k
      ? ["Kapsel prowadzi kursor. Zwykła mysz działa dalej. Zatrzymasz go skrótem "+k.join(" + ")+".",
         "The capsule moves the cursor. Your normal mouse still works. Stop it with "+k.join(" + ")+"."]
      : ["Kapsel prowadzi kursor. Zwykła mysz działa dalej.","The capsule moves the cursor. Your normal mouse still works."];
  },
  rows:()=>{
    const m=(typeof state!=="undefined"&&state.mouse)||{};
    const pad=!!(m.enabled&&m.mode!=="mouse");
    const rows=[{ok:mDrivesCursor(),
      pl:pad?"Ruch prowadzi kursor (teraz prowadzi pad na ekranie Kontroler)":"Mysz włączona",
      en:pad?"The motion drives the cursor (it drives the pad on the Controller screen now)":"The mouse is on",
      fix:{pl:pad?"Przełącz na kursor":"Włącz Mysz",en:pad?"Switch to cursor":"Turn the mouse on",click:"#mEnable"}},
      rfReady.armedRow(),rfReady.capsuleRow()];
    // Kopia uruchomiona z --no-keys tylko pokazuje ruch: to wiadomość, nie brak do naprawienia.
    const c=(typeof state!=="undefined"&&state.cfg)||{};
    if(c.sendKeys===false)rows.push({ok:false,info:true,
      pl:"Ta kopia aplikacji tylko pokazuje ruch i nie przesuwa kursora",
      en:"This copy of the app only shows the motion and does not move the cursor"});
    // Warunki pudełek zależą od tych samych stanów (sterowanie, Mapowanie), a te zmieniają się
    // także bez mFill, więc liczą się razem z linią.
    try{mMouseCondSync();}catch(e){}
    return rows;
  }
});
