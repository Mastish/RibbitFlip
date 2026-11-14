"use strict";
// ===================== 3D AXIS CALIBRATION =====================
// Panel that maps each IMU axis to one of the device's six channels (+ sign inversion), plus filter
// responsiveness, gain and mirroring. Feeds the 3D preview AND every consumer of the pose filter
// (triggers, stick, d-pad, MIDI/OSC). Persisted to localStorage (cache) and to the server (authoritative).
const CAL_AXES=[
  ['acc',0,'Akcel · Pitch (przód/tył)'],
  ['acc',1,'Akcel · Roll (lewo/prawo)'],
  ['acc',2,'Akcel · Oś kapsla (pion)'],
  ['gyr',0,'Żyro · oś Pitch'],
  ['gyr',1,'Żyro · oś Roll'],
  ['gyr',2,'Żyro · Twist (obrót)'],
];
function poseCalDefault(){return {acc:[[3,1],[4,1],[5,1]],gyr:[[0,1],[1,1],[2,1]]};}   // all-positive = the owner's real capsules (default since 2026-08-20; sim generators emit this convention)
// Invariant: the 6 IMU axes (3 accel + 3 gyro) MUST map to 6 DIFFERENT channels 0-5. One physical
// channel cannot be accel and gyro at once — if channels repeat (e.g. an accel axis points at a gyro
// channel) the "up" vector is fed gyro data and the preview goes haywire on every rotation. Such a
// config is physically impossible, so reject it and fall back to the default map.
function _calChannelsOk(cal){
  if(!cal||!Array.isArray(cal.acc)||!Array.isArray(cal.gyr)||cal.acc.length<3||cal.gyr.length<3)return false;
  const chs=[];
  for(const grp of [cal.acc,cal.gyr])for(let i=0;i<3;i++){
    const p=grp[i];
    if(!Array.isArray(p)||p.length<2)return false;
    const ch=p[0],sg=p[1];
    if(!Number.isInteger(ch)||ch<0||ch>5||(sg!==-1&&sg!==1))return false;
    chs.push(ch);
  }
  return new Set(chs).size===6;
}
// Cache key PER CAPSULE. It used to be one key for every slot, so two capsules with different axis
// maps kept overwriting each other's cached calibration and the wrong one was restored on reload.
function _poseCacheKey(dev){return 'ribbitflip.posecal.'+(dev||'d0');}
function loadPoseCal(dev){try{
  let s=localStorage.getItem(_poseCacheKey(dev));
  if(!s&&(dev||'d0')==='d0')s=localStorage.getItem('ribbitflip.posecal');   // pre-multi-capsule cache
  if(s){const c=JSON.parse(s);
  if(_calChannelsOk(c))return c;
  if(c&&typeof c==='object'){console.warn('[pose] kalibracja osi nieprawidłowa (kanały nie są rozłączne) — przywracam domyślną mapę CH3-5/CH0-2');
    return Object.assign({},c,poseCalDefault());}   // keep resp/gain/smoothLvl/mirror/mode, reset only the channel map
}}catch(e){}return poseCalDefault();}
function poseInv(){return {pitch:!!(POSE.inv&&POSE.inv.pitch),roll:!!(POSE.inv&&POSE.inv.roll)};}
function poseCacheWrite(){try{localStorage.setItem(_poseCacheKey(POSE.dev),JSON.stringify({acc:POSE.cal.acc,gyr:POSE.cal.gyr,resp:POSE.resp,gain:POSE.gain,smoothLvl:POSE.smoothLvl,mirror:POSE.mirror,inv:poseInv(),axes:poseAxesAll(),chans:poseChansAll(),mode:POSE.mode}));}catch(e){}}
// localStorage (cache) + auto-save on the server + the identity bar above the panel, which has to
// notice that the axes no longer match the configuration they are named after („zmienione"). This
// is the ONE place every knob, slider and field of the panel goes through, so hooking it here is
// what makes the bar tell the truth without each control having to remember about it.
function savePoseCal(){poseCacheWrite();pushPoseConfig();
  if(typeof poseCfgSync==="function")try{poseCfgSync();}catch(e){}}
// The capsule the Sensor tab is pointed at right now.
function poseViewDev(){return (typeof state!=='undefined'&&(state.viewDev||state.activeDeviceId))||'d0';}
// Put a config (server answer, cache or preset) into POSE. Everything the config does NOT carry goes
// back to the factory value — otherwise switching from a capsule that has, say, an inverted axis to
// one that has not would leave the inversion behind and quietly attach it to the wrong capsule.
function applyPoseCfgToState(c){
  POSE.cal=poseCalDefault();POSE.resp=0.34;POSE.gain=1.0;POSE.smoothLvl=1.0;POSE.mirror=false;
  POSE.inv={pitch:false,roll:false};POSE.axes={};POSE.axes=poseAxesAll();
  POSE.chans={};POSE.chans=poseChansAll();POSE.mode='mahony';
  if(!c)return;
  if(typeof c.gain==='number')POSE.gain=Math.max(0.3,Math.min(4,c.gain));
  if(_calChannelsOk(c.cal))POSE.cal={acc:c.cal.acc,gyr:c.cal.gyr};
  else if(c.cal)console.warn('[pose] konfiguracja osi ma nieprawidłową kalibrację (kanały nie rozłączne) — używam domyślnej mapy CH3-5/CH0-2');
  if(typeof c.resp==='number')POSE.resp=Math.max(0,Math.min(1,c.resp));
  if(typeof c.smoothLvl==='number')POSE.smoothLvl=Math.max(0,Math.min(1,c.smoothLvl));
  if(typeof c.mirror==='boolean')POSE.mirror=c.mirror;
  if(c.inv&&typeof c.inv==='object')POSE.inv={pitch:!!c.inv.pitch,roll:!!c.inv.roll};
  if(c.axes&&typeof c.axes==='object'){POSE.axes=c.axes;POSE.axes=poseAxesAll();}
  if(c.chans&&typeof c.chans==='object'){POSE.chans=c.chans;POSE.chans=poseChansAll();}
  if(['filter','accel','gyro','mahony'].includes(c.mode))POSE.mode=c.mode;
}
// Language switch: the axis summaries, the plot readout and the canvas labels are composed with
// numbers, so they never match a dictionary key and the DOM walker cannot touch them. They are built
// with _gl() instead, which means the panel simply has to be painted again. Same hook the MIDI list
// and the gamepad help use (setLang in rf-01).
function poseRelang(){syncPoseControls();}
// Re-render the panel + the two controls that live outside it, unless a field is being typed into.
function syncPoseControls(){
  const sl=document.getElementById('poseSmoothLvl');if(sl&&document.activeElement!==sl)sl.value=POSE.smoothLvl;
  const pm=document.getElementById('poseMode');if(pm)pm.value=POSE.view2d?'2d':POSE.mode;
  const box=document.querySelector('.posecal');
  if(box&&!box.querySelector('input:focus'))renderPoseCal(box);
}
// Point the axis panel at capsule `dev` and load ITS configuration. Called on every capsule switch —
// without it the panel keeps showing (and saving) whoever was selected when the page loaded.
function loadPoseForDevice(dev){
  dev=dev||'d0';
  if(POSE.dev===dev&&_poseLoaded[dev])return Promise.resolve();
  POSE.dev=null;                                  // nothing may be written while we do not know whose it is
  applyPoseCfgToState(loadPoseCal(dev));          // cache first, so the panel is not blank during the fetch
  POSE.seeded=false;syncPoseControls();
  return fetch('/pose?dev='+encodeURIComponent(dev)).then(r=>r.json()).then(d=>{
    if(d&&!d.error){applyPoseCfgToState(d);       // server = authoritative
      // The NAME this capsule carries on its axes. It is kept next to the capsule rather than in
      // POSE, because POSE is one object for every capsule and is seeded from the localStorage
      // cache (which does not know the name) a moment before this answer arrives — see rf-49h.
      if(typeof devEntry==='function')devEntry(dev).poseCfgName=String(d.configName||'');}
    _poseLoaded[dev]=true;
  }).catch(()=>{}).then(()=>{
    POSE.dev=dev;POSE.seeded=false;               // re-bootstrap the filter with this capsule's axis map
    poseCacheWrite();syncPoseControls();
    if(typeof poseCfgSync==='function')try{poseCfgSync();}catch(e){}
  });
}
const _poseLoaded={};
// ACTIVE 3D axis config — auto-saves the FULL config on the server (durable, Settings/ribbitflip_pose.json).
// This is the "current" config (separate from the named PRESETS in Library/AxisPresets/). Gain also feeds PoseFilter
// (triggers/stick/oscilloscope). 200ms debounce + flush (keepalive) before the page unloads.
let _poseCfgT=null,_poseCfgPending=false;
// THE axis configuration, in one place. Anything that saves it — the auto-save below, an axis
// preset, a Setup — must send all of it, or the parts it forgets come back as factory defaults on
// the next load. (The preset button used to build its own literal and silently dropped the axis
// direction and both tuning chains; see rf-13-power-profiles.)
function poseCfgObj(){return {gain:POSE.gain,cal:POSE.cal,resp:POSE.resp,smoothLvl:POSE.smoothLvl,
  mirror:POSE.mirror,inv:poseInv(),axes:poseAxesAll(),chans:poseChansAll(),mode:POSE.mode};}
function _poseCfgBody(){return JSON.stringify(poseCfgObj());}
// The capsule is named in the URL rather than left to the generic ?dev= shim: this body carries the
// WHOLE configuration, so sending it to the wrong slot does not just miss — it overwrites that
// slot's channel map, gain and smoothing with this one's.
function _postPoseConfig(keepalive){_poseCfgPending=false;
  const dev=POSE.dev;
  if(!dev)return;
  try{fetch('/pose?dev='+encodeURIComponent(dev),{method:'POST',headers:{'Content-Type':'application/json'},body:_poseCfgBody(),keepalive:!!keepalive}).then(r=>r&&r.json()).catch(()=>{});}catch(e){}}
function pushPoseConfig(){
  if(POSE.dev!==poseViewDev())return;   // another capsule's config is still loading — do not write it here
  _poseCfgPending=true;clearTimeout(_poseCfgT);_poseCfgT=setTimeout(()=>_postPoseConfig(false),200);}
function flushPoseConfig(){if(_poseCfgPending){clearTimeout(_poseCfgT);_postPoseConfig(true);}}
window.addEventListener('pagehide',flushPoseConfig);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushPoseConfig();});
// Editable slider value: click the number → type manually (Enter/blur=confirm, Esc=cancel).
function attachNumEdit(el,opts){
  if(!el||el._numEdit)return;el._numEdit=true;
  el.classList.add("num-editable");el.title="Kliknij, aby wpisać wartość";
  el.addEventListener("click",()=>{
    if(el.querySelector("input"))return;
    const inp=document.createElement("input");inp.type="number";inp.className="num-edit-inp";
    inp.value=opts.value();if(opts.min!=null)inp.min=opts.min;if(opts.max!=null)inp.max=opts.max;if(opts.step!=null)inp.step=opts.step;
    el.textContent="";el.appendChild(inp);inp.focus();inp.select();
    let done=false;
    const finish=save=>{if(done)return;done=true;
      if(save){let v=parseFloat(inp.value);if(isFinite(v)){if(opts.min!=null)v=Math.max(opts.min,v);if(opts.max!=null)v=Math.min(opts.max,v);opts.apply(v);}}
      el.textContent=opts.format(opts.value());};
    inp.addEventListener("keydown",e=>{e.stopPropagation();if(e.key==="Enter")finish(true);else if(e.key==="Escape")finish(false);});
    inp.addEventListener("blur",()=>finish(true));
  });
}
function onCalChange(){POSE.seeded=false;savePoseCal();updateCalCfg();updateCalBadges();}   // re-bootstrap + save
function _calCfgHtml(){const cfg='config: '+JSON.stringify(POSE.cal);
  return _calChannelsOk(POSE.cal)?cfg
    :('<span style="color:var(--warn)">⚠ Kanały osi powtarzają się, więc podgląd będzie szaleć. Kliknij „Przywróć fabryczne osie”.</span><br>'+cfg);}
function updateCalCfg(){const el=document.getElementById('pcalCfg');if(el)el.innerHTML=_calCfgHtml();}
// The chips in the two banners. Same idea as the tuning block's: a header has to say what the
// block is SET TO, or the eye has to open it to find out — which is exactly what these blocks no
// longer do. Refreshed in place after every edit (a re-render would eat the focus).
// Two decimals, like the numbers next to the sliders — a chip saying „0,9" beside a field saying
// „0.90" reads as two different values.
const _pcalNum=v=>(+v).toFixed(2).replace('.',',');
function _pcalMapBadge(){
  if(!_calChannelsOk(POSE.cal))
    return `<i class="paxchip paxchip-warn">⚠ ${_gl('kanały się powtarzają','channels repeat')}</i>`;
  const chs=g=>POSE.cal[g].map(p=>'CH'+p[0]).join('·');
  const inv=POSE.cal.acc.concat(POSE.cal.gyr).filter(p=>p[1]<0).length;
  return `<i class="paxchip paxchip-off">${_gl('akcel','accel')} ${chs('acc')}</i>`
    +`<i class="paxchip paxchip-off">${_gl('żyro','gyro')} ${chs('gyr')}</i>`
    +(inv?`<i class="paxchip paxchip-off">${inv}× ${_gl('odwrócone','flipped')}</i>`:'');
}
function _pcalFiltBadge(){
  return `<i class="paxchip paxchip-off">${_gl('czułość','responsiveness')} ${_pcalNum(POSE.resp)}</i>`
    +`<i class="paxchip paxchip-off">${_gl('wychylenie','deflection')} ×${_pcalNum(POSE.gain)}</i>`;
}
function updateCalBadges(){
  const m=document.getElementById('pcalMapSum');if(m)m.innerHTML=_pcalMapBadge();
  const f=document.getElementById('pcalFiltSum');if(f)f.innerHTML=_pcalFiltBadge();
}
// „Kula kręci się odwrotnie?" (UX 261120 B5b, P-G6-02 i decyzja D19): trzy ruchy z dźwignią każdy.
// Dźwignie to TE SAME pola znaku, co w mapie kanałów niżej (data-g/data-i/data-f="sign"), tylko
// opisane ruchem ręki zamiast nazwą kanału: pochylenie przód/tył = akcelerometr oś 0, na boki = oś 1,
// obrót wokół osi kapsla = żyroskop oś 2 (twist liczy się z rzutu żyroskopu na pion).
const PCAL_FLIP=[
  ['acc',0,'Pochyl kapsel do przodu. Kula pochyla się do tyłu? Włącz.'],
  ['acc',1,'Pochyl kapsel w lewo. Kula pochyla się w prawo? Włącz.'],
  ['gyr',2,'Obróć kapsel w prawo. Kula obraca się w lewo? Włącz.'],
];
function _pcalFlipHtml(){
  const sw=(g,i)=>`<label class="pcal-inv"><input class="rf-swi" type="checkbox" data-g="${g}" data-i="${i}" data-f="sign" ${POSE.cal[g][i][1]<0?'checked':''}> odwróć</label>`;
  return `<section class="card pcal-sec pcal-flip">
    <div class="head"><h2><span class="ra-ic" aria-hidden="true">🔀</span>Kula kręci się odwrotnie?</h2>
      <span class="hint">zrób trzy ruchy i patrz na kulę; gdzie idzie na odwrót, włącz przełącznik</span></div>
    <div class="pcal-body pcal-body-rows">`
  +PCAL_FLIP.map(([g,i,txt])=>`<div class="pcal-row pcal-flip-row"><span class="pcal-lab">${txt}</span>${sw(g,i)}</div>`).join('')
  +`<div class="pcal-row pcal-flip-row"><span class="pcal-lab">Cały obraz jest odbity jak w lustrze</span>
      <label class="pcal-inv"><input class="rf-swi" type="checkbox" id="pcalMirror" ${POSE.mirror?'checked':''}> włącz</label></div>
    <div class="pcal-row pcal-flip-row" title="Odwraca ZNAK osi przechyłu na wyjściu: gałka, krzyżak, mysz (filtr 3D), wyzwalacze, MIDI/OSC, bramki padów i oscyloskop. Podgląd orientacji zostaje bez zmian, kula zawsze pokazuje realne położenie kapsla.">
      <span class="pcal-lab">Kula jest dobra, ale mysz i klawisze idą w złą stronę</span>
      <label class="pcal-inv"><input class="rf-swi" type="checkbox" id="pcalInvPitch" ${poseInv().pitch?'checked':''}> przód i tył</label>
      <label class="pcal-inv"><input class="rf-swi" type="checkbox" id="pcalInvRoll" ${poseInv().roll?'checked':''}> lewo i prawo</label></div>
    </div></section>`;
}
// Piętro 3 (L4a): kopiowanie i surowy podgląd `config:`. Odczyt `#pcalLive` pisze rf-14.
function _pcalAdvHtml(){
  return `<div class="pcal-foot pcal-advfoot">
      <button class="btn sm" id="pcalCopy">Kopiuj konfigurację</button>
      <span class="pcal-live" id="pcalLive">—</span></div>
    <div class="pcal-cfg" id="pcalCfg"></div>`;
}
// Piętro 2 (L4a): trzy zwijaki osi dostają licznik „zmienione: N” i „Przywróć domyślne” (rfTier,
// rf-28d). Nagłówek dalej pokazuje chipy: `sum` oddaje ich tekst, więc rfTier ich nie nadpisuje.
const PCAL_RESP_DEF=0.34,PCAL_GAIN_DEF=1.0;
// Szukane w `box`, nie w dokumencie: przy pierwszym rysowaniu panel nie jest jeszcze podpięty.
function _pcalChipSum(box,id){return ()=>{const el=box.querySelector('#'+id);return el?el.textContent:'';};}
function _pcalMapChanged(){const d=poseCalDefault();let n=0;
  for(const g of ['acc','gyr'])for(let i=0;i<3;i++){const a=POSE.cal[g][i],b=d[g][i];if(a[0]!==b[0]||a[1]!==b[1])n++;}
  return n;}
function _pcalTuneChanged(){
  if(typeof PAX_ALL==='undefined')return 0;
  return PAX_ALL.filter(k=>JSON.stringify(paxGet(k))!==JSON.stringify(_paxDefault(k))).length;}
function _pcalTiers(box){
  if(typeof rfTier!=='function'){
    if(typeof rfFold==='function'){rfFold(box.querySelector('#pcalMapFold'),'czujnik.mapa');rfFold(box.querySelector('#pcalAdvFold'),'czujnik.dostrajanie');}
    return;}
  const setSl=(id,v)=>{const el=box.querySelector('#'+id);if(!el)return;el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};
  rfTier(box.querySelector('#pcalFiltFold'),'czujnik.filtr',{sum:_pcalChipSum(box,'pcalFiltSum'),
    def:()=>({pcalResp:PCAL_RESP_DEF,pcalGain:PCAL_GAIN_DEF}),
    reset:()=>{setSl('pcalResp',PCAL_RESP_DEF);setSl('pcalGain',PCAL_GAIN_DEF);}});
  rfTier(box.querySelector('#pcalMapFold'),'czujnik.mapa',{sum:_pcalChipSum(box,'pcalMapSum'),changed:_pcalMapChanged,
    reset:()=>{POSE.cal=poseCalDefault();onCalChange();renderPoseCal(box);},
    take:()=>POSE.cal, restore:c=>{POSE.cal=c;onCalChange();renderPoseCal(box);}});
  // Dostrajanie ma własne „Wyłącz i wyzeruj wszystkie tory” w środku, więc tu tylko licznik.
  rfTier(box.querySelector('#pcalAdvFold'),'czujnik.dostrajanie',{sum:_pcalChipSum(box,'pcalAdvSum'),changed:_pcalTuneChanged});
}
// Cały blok „Osie 3D” to też piętro 2 (L4a, spec: „blok osi domyślnie zwinięty”): w nagłówku mapa,
// czułość, wychylenie i liczba dostrojonych torów, licznik zbiera zmiany z trzech zwijaków w środku.
// „Przywróć fabryczne osie” (`#pcalReset`) zostaje w środku jako jego przycisk domyślnych.
function _pcalOsieSum(){
  const map=!_calChannelsOk(POSE.cal)?_gl('⚠ kanały się powtarzają','⚠ channels repeat')
    :(_pcalMapChanged()?_gl('mapa zmieniona','custom map'):_gl('mapa fabryczna','factory map'));
  const num=v=>_gl(_pcalNum(v),(+v).toFixed(2));
  return map+' · '+_gl('czułość ','response ')+num(POSE.resp)+' · '+_gl('wychylenie ×','deflection ×')+num(POSE.gain)
    +' · '+_gl('tory: ','chains: ')+_pcalTuneChanged();
}
function _pcalOsieChanged(){
  return _pcalMapChanged()+_pcalTuneChanged()+(Math.abs(POSE.resp-PCAL_RESP_DEF)>1e-9?1:0)+(Math.abs(POSE.gain-PCAL_GAIN_DEF)>1e-9?1:0);
}
function poseOsieTier(fold){
  if(typeof rfTier==='function')return rfTier(fold,'czujnik.osie',{sum:_pcalOsieSum,changed:_pcalOsieChanged});
  if(typeof rfFold==='function')rfFold(fold,'czujnik.osie');
  return function(){return 0;};
}
function renderPoseCal(box){
  if(!box)return;
  // Kolejność (decyzja D19, odwraca dawną zasadę „najpierw dostrajanie"): na górze odpowiedź na
  // najczęstszy problem, czyli kula kręcąca się na odwrót. Dostrajanie torów i mapa kanałów to
  // ustawienia na raz i na długo, więc stoją niżej w zamkniętych zwijakach (`cardfold`, stan
  // pamięta rfFold). Zachowanie filtra zostaje na wierzchu: suwaki czułości zmienia się częściej.
  // UX 261120 L4a: karta „Kula kręci się odwrotnie?” stoi na wierzchu Czujnika (piętro 1, `_flipHost`),
  // a „Kopiuj konfigurację” z surowym `config:` w jego „Zaawansowanych” (piętro 3, `_advHost`).
  // Gospodarzy daje rf-34; bez nich wszystko zostaje w `box`. Zdarzenia wiążemy na obu korzeniach.
  const flipHost=box._flipHost||null,advHost=box._advHost||null;
  const roots=[box].concat(flipHost?[flipHost]:[],advHost?[advHost]:[]);
  const q1=s=>{for(const r of roots){const e=r.querySelector(s);if(e)return e;}return null;};
  const qa=s=>roots.reduce((a,r)=>a.concat(Array.from(r.querySelectorAll(s))),[]);
  if(flipHost)flipHost.innerHTML=_pcalFlipHtml();
  if(advHost)advHost.innerHTML=_pcalAdvHtml();
  box.innerHTML=(flipHost?'':_pcalFlipHtml())+_paxAllHtml()
  +`<details class="cardfold inset pcal-mapfold" id="pcalMapFold">
    <summary><span class="ra-ic" aria-hidden="true">🔀</span>Mapa kanałów<span class="cardfold-sum pcal-chips" id="pcalMapSum">${_pcalMapBadge()}</span></summary>
    <div class="cardfold-body pcal-body-rows">
    <div class="pcal-hint">Który kanał niesie którą oś czujnika.</div>`
  +CAL_AXES.map(([grp,idx,lab])=>{
    const cur=POSE.cal[grp][idx];
    const opts=[0,1,2,3,4,5].map(i=>`<option value="${i}" ${i===cur[0]?'selected':''}>CH${i}</option>`).join('');
    return `<div class="pcal-row pcal-map"><span class="pcal-lab">${lab}</span>
      <select data-g="${grp}" data-i="${idx}" data-f="src">${opts}</select>
      <label class="pcal-inv"><input class="rf-swi" type="checkbox" data-g="${grp}" data-i="${idx}" data-f="sign" ${cur[1]<0?'checked':''}> odwróć</label></div>`;
  }).join('')+`<div class="pcal-hint"><b>Mapowanie kanałów</b> stroi podgląd 3D (kulę): ruszaj kapslem, dobierz kanał i „odwróć” dla każdej osi, aż kula odda realne położenie. Twist to obrót wokół osi kapsla.</div>
    </div></details>
    <details class="cardfold inset pcal-filtfold" id="pcalFiltFold">
    <summary><span class="ra-ic" aria-hidden="true">🎚️</span>${_gl('Zachowanie filtra 3D','3D filter behaviour')}<span class="cardfold-sum pcal-chips" id="pcalFiltSum">${_pcalFiltBadge()}</span></summary>
    <div class="cardfold-body pcal-body-rows">
    <div class="pcal-hint">${_gl('Wspólne dla wszystkich czterech osi filtra.','Shared by all four filter axes.')}</div>
    <div class="pcal-row pcal-resp" title="Szybkość reakcji filtra 3D. Steruje też WYJŚCIAMI: gałka, mysz (filtr 3D), krzyżak, MIDI/OSC i wyzwalacze"><span class="pcal-lab">Czułość filtra (gładko ↔ ostro)</span>
      <input type="range" id="pcalResp" min="0" max="1" step="0.02" value="${POSE.resp}">
      <span class="num" id="pcalRespV">${(+POSE.resp).toFixed(2)}</span></div>
    <div class="pcal-row pcal-resp"><span class="pcal-lab">Przyspieszenie wychylenia (czułość osi 3D)</span>
      <input type="range" id="pcalGain" min="0.3" max="4" step="0.05" value="${POSE.gain}">
      <span class="num" id="pcalGainV">×${(+POSE.gain).toFixed(2)}</span></div>
    <div class="pcal-hint"><b>Przyspieszenie wychylenia</b> (zakres <b>0,3–4×</b>) skaluje wartości osi filtra (Pochylenie / Obrót / Pitch / Roll) używane przez wyzwalacze, gałkę i oscyloskop „Filtr 3D: osie”: <b>&gt;1×</b> = szybciej osiągasz wychylenie, <b>&lt;1×</b> = wolniej. Efekt widać na oscyloskopie „Filtr 3D: osie” w pasku u góry.</div>
    </div></details>
    <div class="pcal-foot">
      <button class="btn sm" id="pcalReset" title="Przywraca fabryczną mapę kanałów, czułość, przyspieszenie, odbicie i kierunki przechyłu. Dostrajania torów nie rusza">Przywróć fabryczne osie</button></div>
    ${advHost?'':_pcalAdvHtml()}`;
  _pcalTiers(box);
  box.querySelectorAll('select[data-f=src]').forEach(s=>s.onchange=e=>{
    POSE.cal[e.target.dataset.g][+e.target.dataset.i][0]=+e.target.value;onCalChange();});
  // Ten sam znak ma dwie dźwignie (karta „Kula kręci się odwrotnie?" i mapa kanałów), więc po
  // zmianie jednej druga dostaje ten sam stan.
  qa('input[data-f=sign]').forEach(c=>c.onchange=e=>{
    const g=e.target.dataset.g,i=e.target.dataset.i;
    POSE.cal[g][+i][1]=e.target.checked?-1:1;
    qa(`input[data-f=sign][data-g="${g}"][data-i="${i}"]`).forEach(x=>{if(x!==e.target)x.checked=e.target.checked;});
    onCalChange();});
  // NOTE: bind via box.querySelector (not document.getElementById) — renderPoseCal is called
  // BEFORE the panel is attached to the DOM (initTabs), so getElementById would return null and handlers
  // wouldn't bind (sensitivity slider / gain / mirror / reset wouldn't respond).
  const rs=box.querySelector('#pcalResp');
  if(rs)rs.oninput=e=>{POSE.resp=+e.target.value;const v=box.querySelector('#pcalRespV');if(v)v.textContent=POSE.resp.toFixed(2);savePoseCal();updateCalBadges();};
  const gs=box.querySelector('#pcalGain');
  if(gs)gs.oninput=e=>{POSE.gain=+e.target.value;const v=box.querySelector('#pcalGainV');if(v)v.textContent='×'+POSE.gain.toFixed(2);savePoseCal();updateCalBadges();};
  attachNumEdit(box.querySelector('#pcalRespV'),{min:0,max:1,step:0.02,value:()=>POSE.resp,format:v=>(+v).toFixed(2),
    apply:v=>{POSE.resp=v;const s=box.querySelector('#pcalResp');if(s)s.value=v;savePoseCal();updateCalBadges();}});
  attachNumEdit(box.querySelector('#pcalGainV'),{min:0.3,max:4,step:0.05,value:()=>POSE.gain,format:v=>'×'+(+v).toFixed(2),
    apply:v=>{POSE.gain=v;const s=box.querySelector('#pcalGain');if(s)s.value=v;savePoseCal();updateCalBadges();}});
  const pm=q1('#pcalMirror');
  if(pm)pm.onchange=e=>{POSE.mirror=e.target.checked;savePoseCal();updateCalBadges();};
  // Direction of the lean axes. No onCalChange() here: the channel map is untouched, so re-seeding
  // the filter would only make the ball jump for nothing — the sign flips server-side on the next packet.
  for(const [id,k] of [['#pcalInvPitch','pitch'],['#pcalInvRoll','roll']]){
    const c=q1(id);
    if(c)c.onchange=e=>{POSE.inv=Object.assign(poseInv(),{[k]:e.target.checked});savePoseCal();updateCalBadges();};
  }
  wireAxisTuning(box);   // per-axis tuning block (rf-33b) wires its own controls
  // „Przywróć fabryczne osie" działa od razu, a „Cofnij" w bąblu oddaje całą konfigurację sprzed
  // kliknięcia (F-G6-03). Migawka to `poseCfgObj()`, ta sama, którą zapisują presety i autozapis.
  const rst=box.querySelector('#pcalReset');if(rst)rst.onclick=()=>{
    const doReset=()=>{POSE.cal=poseCalDefault();POSE.resp=0.34;POSE.gain=1.0;POSE.mirror=false;POSE.inv={pitch:false,roll:false};
      POSE.axes=poseAxesAll();for(const k of PAX_KEYS)POSE.axes[k]=poseAxDefault(k);
      POSE.chans=poseChansAll();for(const k of PCH_KEYS)POSE.chans[k]=poseChanDefault(k);
      onCalChange();renderPoseCal(box);};
    if(typeof rfUndo!=='function'){doReset();return;}
    rfUndo({msg:_gl('Przywrócono fabryczne osie: mapę kanałów, czułość i kierunki. Dostrajanie torów zostaje.',
                    'Factory axes restored: channel map, responsiveness and directions. Signal tuning stays.'),
      take:()=>poseCfgObj(), run:doReset,
      restore:c=>{applyPoseConfig(c);savePoseCal();}});};
  const cpy=q1('#pcalCopy');if(cpy)cpy.onclick=e=>{const t=JSON.stringify(POSE.cal);
    try{navigator.clipboard&&navigator.clipboard.writeText(t);}catch(err){}
    if(typeof rfSay==='function')rfSay(_gl('Skopiowano konfigurację osi do schowka.','Axis setup copied to the clipboard.'),
      {tone:'ok',at:e.currentTarget,atText:_gl('Skopiowano','Copied')});};
  const cfgEl=q1('#pcalCfg');if(cfgEl)cfgEl.innerHTML=_calCfgHtml();
}

// "?" popover next to the 3D preview — click toggles it (far too much text for a native tooltip).
function showPoseHelp(){
  let ov=document.getElementById('poseHelpBox');
  if(ov){ov.remove();return;}
  ov=document.createElement('div');ov.id='poseHelpBox';
  ov.innerHTML=`<div class="phb-card"><button class="phb-x" title="Zamknij">×</button>
    <div class="phb-grid">
      <aside class="phb-art">
        <div class="phb-orb" aria-hidden="true"></div>
      </aside>
      <div class="phb-body">${_gl(`
        <h3>🧭 Jak działa podgląd orientacji</h3>
        <p>Urządzenie ma 6-osiowy IMU <b>bez magnetometru (kompasu)</b>, dlatego:</p>
        <ul>
          <li><b>Pochylenie</b> liczone <b>wprost z grawitacji</b> (akcelerometr) — dokładne i natychmiastowe.</li>
          <li><b>Obrót wokół osi kapsla</b> jest nieobserwowalny z grawitacji → liczony z <b>żyroskopu</b>. Jest <b>względny</b> i może z czasem dryfować — użyj „Wyśrodkuj”.</li>
        </ul>
        <p><b>Na podglądzie 3D:</b> złota kropka = oś kapsla (biegun), złoty południk + czerwona kropka = obrót, cyjan = równik. Gdy obracasz kapsel — kula obraca się razem z nim.</p>
        <h4>Tryby (wybór po lewej):</h4>
        <ul>
          <li><b>Standardowy (zalecany)</b>: filtr Mahony'ego, czyli całkowanie żyroskopu z korektą akcelerometrem, która dociąga „górę”. Stabilny, z lekkim opóźnieniem. Tak kula startuje u każdego.</li>
          <li><b>Filtr (akcel+żyro)</b> — stabilne pochylenie z akcelerometru + obrót z żyroskopu.</li>
          <li><b>Akcel (CH3-5)</b> — wyłącznie z akcelerometru: samo pochylenie (bez obrotu). Czyste „co widzi grawitacja”.</li>
          <li><b>Żyro (CH0-2)</b> — surowa integracja całego żyroskopu: obrót wprost z czujnika, ale <b>dryfuje</b>.</li>
        </ul>
        <h4>Sterowanie ręczne (tylko w symulacji)</h4>
        <p>Przycisk <b>„Steruj ręcznie”</b> w nagłówku daje Ci kapsel do ręki: <b>lewy przycisk</b> pochyla (od siebie = dalsza krawędź w dół), <b>litery osi</b> (X, −X, Y, −Y, Z, −Z) są uchwytami: chwyć literę i zakręć wokół niej, a kapsel obróci się wyłącznie wokół tej osi — Z to jego własna oś, X i Y to przewroty. <b>Prawy przycisk</b> zostaje jako skrót na obrót wokół pionu. <b>Kółko</b> obraca co 6°, <b>strzałki i Q/E</b> robią to samo z klawiatury, <b>spacja</b> to przycisk kapsla. Puszczone po szybkim obrocie — kręci się dalej. Pełna ściąga jest pod kulą, w „Jak sterować?”.</p>
        <p>To nie jest podgląd: taki kapsel wysyła <b>prawdziwe pakiety</b> tą samą drogą co sprzęt, więc wyzwalacze, MIDI, OSC i pad reagują naprawdę (klawisze i mysz zostają w aplikacji — tak działa symulacja). Ustawiasz osobno dla każdego kapsla, a wyjście z trybu oddaje go z powrotem własnemu ruchowi symulacji.</p>
        <p>Plakietka przy tytule mówi, <b>skąd bierze się ruch</b>: „ruch: kapsel”, „ruch: animacja” albo „ruch: ręcznie”. Kąty pod kulą można <b>kliknąć i wpisać</b>, <b>Ctrl</b> przy przeciąganiu ustawia co 5°, a <b>Alt</b> spowalnia ruch do ćwierci.</p>`,`
        <h3>🧭 How the orientation preview works</h3>
        <p>The device has a 6-axis IMU <b>with no magnetometer (compass)</b>, therefore:</p>
        <ul>
          <li><b>Tilt</b> is computed <b>directly from gravity</b> (accelerometer) — accurate and instant.</li>
          <li><b>Rotation around the capsule axis</b> is unobservable from gravity → integrated from the <b>gyroscope</b>. It is <b>relative</b> and may drift over time — use “Recenter”.</li>
        </ul>
        <p><b>On the 3D preview:</b> gold dot = capsule axis (pole), gold meridian + red dot = rotation, cyan = equator. Rotate the capsule — the sphere rotates with it.</p>
        <h4>Modes (picker on the left):</h4>
        <ul>
          <li><b>Standard (recommended)</b>: the Mahony filter, gyro integration with an accelerometer correction that pulls “up” back. Stable, slightly delayed. Every capsule starts in this mode.</li>
          <li><b>Filter (accel+gyro)</b> — stable tilt from the accelerometer + rotation from the gyro.</li>
          <li><b>Accel (CH3-5)</b> — accelerometer only: tilt alone (no rotation). Pure “what gravity sees”.</li>
          <li><b>Gyro (CH0-2)</b> — raw integration of the whole gyroscope: rotation straight from the sensor, but it <b>drifts</b>.</li>
        </ul>
        <h4>Manual control (simulation only)</h4>
        <p>The <b>“Take control”</b> button in the header hands you the capsule: the <b>left button</b> tilts it (away from you = the far edge goes down), the <b>axis letters</b> (X, −X, Y, −Y, Z, −Z) are handles: grab one and turn around it, and the capsule rotates about that axis alone — Z is its own axis, X and Y roll it over. The <b>right button</b> stays as a shortcut for turning about the vertical. The <b>wheel</b> rotates in 6° steps, <b>arrows and Q/E</b> do the same from the keyboard, <b>space</b> is the capsule's button. Let go after a fast spin and it keeps spinning. The full cheat sheet sits under the sphere, in “How do I drive it?”.</p>
        <p>This is not a preview: such a capsule sends <b>real packets</b> down the same path the hardware uses, so triggers, MIDI, OSC and the pad all react for real (keys and mouse stay inside the app — that is what simulation means). It is set per capsule, and leaving the mode gives it back to the simulation's own movement.</p>
        <p>The pill next to the title says <b>where the movement comes from</b>: “moved by capsule”, “moved by animation” or “moved by hand”. The angles under the sphere can be <b>clicked and typed</b>, <b>Ctrl</b> while dragging lands on 5° steps, and <b>Alt</b> slows the travel to a quarter.</p>`)}
      </div>
    </div></div>`;
  document.body.appendChild(ov);
  const close=()=>{const e=document.getElementById('poseHelpBox');if(e)e.remove();window.removeEventListener('keydown',esc);};
  function esc(ev){if(ev.key==='Escape')close();}
  ov.addEventListener('click',ev=>{if(ev.target===ov)close();});
  ov.querySelector('.phb-x').onclick=close;
  window.addEventListener('keydown',esc);
}
// Runs on load rather than from the bootstrap list in rf-40-boot.js, so it is NOT covered by that
// file's per-init try/catch — a throw here kills the rest of this script (later files still load).
(function initPose3D(){
  // One load path for the panel, shared with every capsule switch (see loadPoseForDevice) — the axis
  // configuration is per capsule, so "which one" is an argument, never an assumption.
  loadPoseForDevice(poseViewDev());
  const ps=document.getElementById("poseSmooth");
  if(ps){POSE.smooth=ps.checked;ps.addEventListener("change",e=>{POSE.smooth=e.target.checked;});}
  const psl=document.getElementById("poseSmoothLvl");
  if(psl){psl.value=POSE.smoothLvl;psl.addEventListener("input",e=>{POSE.smoothLvl=Math.max(0,Math.min(1,+e.target.value));savePoseCal();});}
  const rb=document.getElementById("poseRecenter");
  if(rb)rb.addEventListener("click",poseRecenter);
  // display mode selector: 4 3D modes + "2D — 3D filter"; 2D remembered in localStorage
  try{POSE.view2d=localStorage.getItem("ribbitflip.pose2d")==="1";}catch(e){}
  const pm=document.getElementById("poseMode");
  if(pm){pm.value=POSE.view2d?"2d":POSE.mode;
    pm.addEventListener("change",e=>{const v=e.target.value;
      if(v==="2d"){POSE.view2d=true;}                                   // 2D inclinometer based on the filter
      else{POSE.view2d=false;POSE.mode=v;POSE.qGyroSeeded=false;savePoseCal();}
      try{localStorage.setItem("ribbitflip.pose2d",POSE.view2d?"1":"0");}catch(_){}
    });}
  const ph=document.getElementById("poseHelp");
  if(ph)ph.addEventListener("click",showPoseHelp);
  // ⚙ — pin/unpin control panel (for click/touch; hover alone also shows it)
  const pg=document.getElementById("poseGear"),pc=document.getElementById("pose3dControls");
  if(pg&&pc)pg.addEventListener("click",e=>{e.stopPropagation();pg.classList.toggle("on",pc.classList.toggle("pinned"));});
})();
