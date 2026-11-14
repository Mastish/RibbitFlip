"use strict";
// ===================== SIGNAL TUNING — ONE CHAIN PER AXIS AND PER CHANNEL =====================
// A folded block of the "Osie 3D" card, under „Kula kręci się odwrotnie?" (order: rf-33, decision
// D19): a signal chain
// (smoothing -> zero -> dead zone -> range -> curve) for each of the FOUR filter axes AND each of
// the SIX raw sensor channels (accelerometer + gyroscope). This file is the model + the editor;
// the shaping itself runs SERVER-SIDE (PoseFilter.pose / PoseFilter.shape_channels) and the two
// live pictures live in rf-33c.
//
// Why both families: the filter axes are computed values, the channels are what the sensor really
// sends — and a channel is a source in its own right (triggers, MIDI/OSC, stick/d-pad/mouse, pad
// gates can all read a bare CH). Until they got the chain too, half the app could be tuned and the
// other half could not.
// Load order does not matter: nothing here runs until renderPoseCal() paints the panel.

// Runtime translation for strings the DOM walker cannot reach: values composed with numbers (they
// never match a dictionary key whole) and canvas text (not DOM at all). Guarded, so a change in
// script order cannot turn the panel Polish-only.
const _axT=(pl,en)=>(typeof _gl==='function'?_gl(pl,en):pl);

// ---- WHAT THERE IS TO TUNE -----------------------------------------------------------------
const PAX_KEYS=['tilt','twist','pitch','roll'];              // the 3D filter's own metrics
const PCH_KEYS=['ch0','ch1','ch2','ch3','ch4','ch5'];        // raw sensor channels
const PAX_ALL=PAX_KEYS.concat(PCH_KEYS);
const PCH_FULL=32768;                                        // int16 span — same one the trigger sliders use
const PAX_FULL={tilt:180,twist:720,pitch:90,roll:90};
const PAX_UNIT={tilt:'°',twist:'°/s',pitch:'°',roll:'°'};
const PAX_LABEL={tilt:'Pochylenie',twist:'Obrót (twist)',pitch:'Przechył przód/tył',roll:'Przechył w bok'};
const PAX_LABEL_EN={tilt:'Tilt',twist:'Spin (twist)',pitch:'Lean front/back',roll:'Lean sideways'};
const PAX_SHORT={tilt:['Pochylenie','Tilt'],twist:['Obrót','Spin'],pitch:['Przód/tył','Front/back'],roll:['W bok','Sideways']};
// Which IMU axis a channel is carrying is not fixed — it comes from the channel map above this
// block, so the label is resolved live instead of hard-coded.
const PCH_ROLE=[['acc',0,'Akcel przód/tył','Accel front/back'],
                ['acc',1,'Akcel lewo/prawo','Accel left/right'],
                ['acc',2,'Akcel oś kapsla','Accel capsule axis'],
                ['gyr',0,'Żyro oś przód/tył','Gyro front/back axis'],
                ['gyr',1,'Żyro oś lewo/prawo','Gyro left/right axis'],
                ['gyr',2,'Żyro twist (obrót)','Gyro twist (spin)']];
// Which axis cards are unfolded, kept across re-renders (capsule switch, language switch).
// The tuning block folds again (UX 261120, D19): its closed header lists what is tuned, so the
// feature stays visible without taking half the screen. The individual axes stay folded — ten cards' worth
// of plots at once is a wall, and the live number in every header already says which axis is
// doing what.
const PAX_OPEN={};
const _paxIsCh=k=>k.length===3&&k[0]==='c'&&k[1]==='h';
const _paxChIdx=k=>+k[2];
function paxFull(k){return _paxIsCh(k)?PCH_FULL:PAX_FULL[k];}
function paxUnit(k){return _paxIsCh(k)?'':PAX_UNIT[k];}
function paxUni(k){return k==='tilt';}                       // unipolar: below zero simply means "level"
function paxFloor(k){return _paxIsCh(k)?500:(k==='twist'?40:10);}   // smallest sensible trace window
function paxColor(k){
  if(_paxIsCh(k))return (typeof AXES!=='undefined'&&AXES[_paxChIdx(k)])?AXES[_paxChIdx(k)].color:cv('--az');
  return (typeof FCOLOR==='object'&&FCOLOR[k])||cv('--az');
}
function paxChRole(i){
  const C=(typeof POSE==='object'&&POSE.cal)||null;
  if(C)for(const [grp,idx,pl,en] of PCH_ROLE){
    const p=C[grp]&&C[grp][idx];
    if(p&&p[0]===i)return _axT(pl,en);
  }
  return _axT('nieprzypisany','unassigned');
}
function paxLabel(k){return _paxIsCh(k)?('CH'+_paxChIdx(k)+' · '+paxChRole(_paxChIdx(k)))
                                       :_axT(PAX_LABEL[k],PAX_LABEL_EN[k]);}
function paxShort(k){return _paxIsCh(k)?('CH'+_paxChIdx(k)):_axT(PAX_SHORT[k][0],PAX_SHORT[k][1]);}

// ---- THE STORED CHAIN ------------------------------------------------------------------------
// Two stores, one shape. POSE.axes is the filter family, POSE.chans the channels; both are merged
// with the factory values on read, so a config that predates a field cannot leave it undefined.
function _paxDefault(k){const f=paxFull(k);
  return {on:false,smooth:'ema',smoothMs:0,zero:0,dead:0,inHi:f,outHi:f,expo:1};}
function poseAxDefault(k){return _paxDefault(k);}
function poseChanDefault(k){return _paxDefault(k);}
function _paxStore(k){
  if(_paxIsCh(k)){POSE.chans=POSE.chans||{};return POSE.chans;}
  POSE.axes=POSE.axes||{};return POSE.axes;
}
function paxGet(k){
  const a=_paxStore(k)[k]||{},d=_paxDefault(k),o={};
  for(const f in d)o[f]=(a[f]===undefined||a[f]===null)?d[f]:a[f];
  o.on=!!o.on; o.smooth=(o.smooth==='adapt')?'adapt':'ema';
  for(const f of ['smoothMs','zero','dead','inHi','outHi','expo']){const v=+o[f];o[f]=isFinite(v)?v:d[f];}
  return o;
}
function poseAx(k){return paxGet(k);}
function poseAxesAll(){const o={};for(const k of PAX_KEYS)o[k]=paxGet(k);return o;}
function poseChansAll(){const o={};for(const k of PCH_KEYS)o[k]=paxGet(k);return o;}
function paxAnyChanOn(){return PCH_KEYS.some(k=>paxGet(k).on);}

// ---- FORMATTING ------------------------------------------------------------------------------
const _pnum=v=>{const r=Math.round(v*100)/100;return String(r).replace('.',',');};
// A channel counts in raw LSB up to 32768 — two decimals there are noise, not precision.
function paxVal(k,v){
  if(_paxIsCh(k))return String(Math.round(v));
  return _pnum(Math.round(v*10)/10)+PAX_UNIT[k];
}
// One line saying what this axis actually does now — so a folded block still tells the truth.
function poseAxSummary(k){
  const a=paxGet(k),f=paxFull(k),u=paxUnit(k),p=[];
  if(!a.on)return _axT('wyłączone','off');
  if(a.smoothMs>0)p.push(_axT('wygładzanie ','smoothing ')+(a.smooth==='adapt'?_axT('adapt. ','adaptive '):'')+Math.round(a.smoothMs)+' ms');
  if(a.zero)p.push('zero '+paxVal(k,a.zero));
  if(a.dead>0)p.push(_axT('martwa strefa ','dead zone ')+paxVal(k,a.dead));
  if(a.inHi!==f||a.outHi!==f)p.push(_axT('pełne przy ','full at ')+paxVal(k,a.inHi)+' → '+paxVal(k,a.outHi));
  if(a.expo!==1)p.push(_axT('krzywa ×','curve ×')+_pnum(a.expo));
  return p.length?p.join(' · '):_axT('włączone, bez zmian','on, nothing changed');
}
// Slider + the number next to it, and the number is editable (click = type). A slider answers
// "which way and how far" at a glance while dragging; typing answers "exactly 30". Neither alone
// is enough, which is why the responsiveness/gain rows above have had both from the start.
const PAX_FIELDS={smoothMs:[0,2000,10,'ms'],zero:[null,null,null,null],dead:[0,null,null,null],
                  inHi:[1,null,null,null],outHi:[0,null,null,null],expo:[0.3,3,0.05,'×']};
function _paxRange(k,f){
  const full=paxFull(k),d=PAX_FIELDS[f];
  let min=(d[0]===null?-full:d[0]);
  const max=(d[1]===null?full:d[1]);
  // step follows the size of the axis: 0.5° is a meaningful nudge, 0.5 LSB out of 32768 is not
  const step=d[2]!==null?d[2]:(full>1000?32:(f==='dead'?0.5:1));
  // A range input only lands on min + n·step, so the MAXIMUM has to sit on that grid — otherwise
  // the default (which IS the maximum, that is what makes an untouched chain an identity) is not
  // reachable and the first drag would quietly shave a bit off it. Nudging `min` up is safe: it
  // stays well inside what the server accepts.
  const rest=(max-min)%step;
  if(rest>step/1000&&rest<step*0.999)min+=rest;
  return {min,max,step,unit:(d[3]===null?paxUnit(k):d[3])};
}
// „30°" i „×1,6", nie „30 °" ani „1,6 ×" — the multiplier reads as a prefix and degrees take no space.
function _paxFmt(k,f,v){const u=_paxRange(k,f).unit;
  if(u==='×')return '×'+_pnum(v);
  if(u==='ms')return _pnum(v)+' ms';
  return _paxIsCh(k)?String(Math.round(v)):(_pnum(v)+u);}

// ---- LIVE VALUES FOR THE TWO PICTURES (rf-33c asks through these) ----------------------------
// Both come back in the ORIENTED frame — the one the fields are typed in and the one the shaping
// runs in. The channel buffers are stored raw (like every scope), hence the sign.
// Sign of one channel in the map above — needed when the server is sending nothing tuned yet and
// the panel falls back to the plain scope buffers, which are stored raw.
function paxChSign(i){
  const C=(typeof POSE==='object'&&POSE.cal)||{};
  for(const g of ['acc','gyr'])for(let j=0;j<3;j++){
    const p=C[g]&&C[g][j];
    if(p&&p[0]===i)return p[1]<0?-1:1;}
  return 1;
}
function paxLive(k){
  const B=(typeof VB==='function')?VB():null; if(!B)return null;
  if(_paxIsCh(k)){
    const c=B.chan,i=_paxChIdx(k);
    if(c&&c.src)return {inV:+c.src[i],outV:+c.out[i]};
    // Nothing tuned on this capsule yet — the channel still HAS a value, and a header full of
    // dashes would be useless exactly when someone is looking for the axis that moves.
    const raw=B.last&&B.last[AKEYS[i]];
    if(raw==null)return null;
    const v=paxChSign(i)*(+raw);
    return {inV:v,outV:v};
  }
  const p=B.pose;
  if(!p||!p.src)return null;
  return {inV:+p.src[k],outV:+p[k]};
}
function paxTrace(k){
  const B=(typeof VB==='function')?VB():null;
  const now=(B&&B.nowTs)||0;
  if(!B)return {buf:[],sg:1,now};
  if(_paxIsCh(k)){
    const i=_paxChIdx(k),tuned=(typeof chanSrcBuf==='function')?chanSrcBuf(B,AKEYS[i]):null;
    // Untuned: the plain scope buffer. Its entries are [ts,v] with no third slot, so the "input"
    // line and the smoothing ribbon simply do not draw — there is nothing to compare against yet.
    return {buf:tuned||(B.buf&&B.buf[AKEYS[i]])||[],sg:tuned?((B.chan&&B.chan.sg&&B.chan.sg[i])||1):paxChSign(i),now};
  }
  return {buf:(B.poseBuf&&B.poseBuf[k])||[],sg:1,now};
}

// ---- MARKUP ----------------------------------------------------------------------------------
function _paxSlider(k,f){
  const a=paxGet(k),r=_paxRange(k,f);
  return `<input type="range" class="pcal-rng" data-k="${k}" data-f="${f}" min="${r.min}" max="${r.max}" step="${r.step}" value="${a[f]}"${a.on?'':' disabled'}>
    <span class="num pcal-numv" data-k="${k}" data-f="${f}">${_paxFmt(k,f,a[f])}</span>`;}
function _paxFld(k,f,label,hint,extra){
  return `<div class="paxf" title="${esc(hint)}">
    <div class="paxf-l"><span>${label}</span>${extra||''}</div>
    <div class="paxf-c">${_paxSlider(k,f)}</div></div>`;}
function _paxSmoothSeg(k){
  const a=paxGet(k);
  return `<span class="seg seg-sm paxseg" role="group" aria-label="${esc(_axT('rodzaj wygładzania','smoothing kind'))}">
    <button type="button" class="paxsegb${a.smooth==='ema'?' on':''}" data-k="${k}" data-f="smooth" data-v="ema"${a.on?'':' disabled'}>${_axT('stałe','steady')}</button>
    <button type="button" class="paxsegb${a.smooth==='adapt'?' on':''}" data-k="${k}" data-f="smooth" data-v="adapt"${a.on?'':' disabled'}>${_axT('adaptacyjne','adaptive')}</button></span>`;}
function _paxHtml(k){
  const a=paxGet(k),u=paxUnit(k)||_axT('LSB','LSB');
  return `<details class="pcal-ax${a.on?' is-on':' is-off'}" data-ax="${k}" style="--axc:${paxColor(k)}"${PAX_OPEN[k]?' open':''}>
    <summary>
      <span class="pcal-axdot" aria-hidden="true"></span>
      <span class="pcal-axname">${paxLabel(k)}</span>
      <span class="pcal-axsum" data-sum="${k}">${poseAxSummary(k)}</span>
      <span class="pcal-axnow" data-now="${k}" title="${esc(_axT('co ta oś raportuje w tej chwili','what this axis reports right now'))}">—</span>
      <button type="button" class="paxsw" role="switch" aria-checked="${a.on?'true':'false'}" data-k="${k}" data-f="on"
        title="${esc(_axT('Włącz tor sygnału tej osi','Switch this axis chain on'))}"><span class="paxsw-k"></span></button>
      <span class="pcal-axchev" aria-hidden="true">${_paxChevSvg()}</span>
    </summary>
    <div class="pcal-axbody">
      <div class="pcal-plotwrap">
        <div class="pcal-plotgrid">
          <div class="pcal-plotcell"><span class="pcal-plotcap">${_axT('kształt toru','chain shape')}
            <i class="pcal-lg pcal-lg-ref">${_axT('bez toru','untuned')}</i></span>
            <canvas class="pcal-plot" data-plot="${k}"></canvas></div>
          <div class="pcal-plotcell"><span class="pcal-plotcap">${_axT('na żywo','live')}
            <i class="pcal-lg pcal-lg-pre">${_axT('wejście','input')}</i> <i class="pcal-lg pcal-lg-out">${_axT('po torze','after the chain')}</i></span>
            <canvas class="pcal-trace" data-trace="${k}"></canvas></div>
        </div>
        <div class="pcal-plotread" data-read="${k}">—</div></div>
      <div class="paxgrid">
        ${_paxFld(k,'smoothMs',_axT('Wygładzanie','Smoothing'),
          _axT('Uspokaja oś, zanim cokolwiek ją przeskaluje. Stałe = równe opóźnienie. Adaptacyjne = mocno wygładza w spoczynku, prawie bez opóźnienia gdy naprawdę ruszasz. 0 ms = brak.',
               'Calms the axis before anything rescales it. Steady = even lag. Adaptive = heavy smoothing at rest, almost no lag once you really move. 0 ms = off.'),
          _paxSmoothSeg(k))}
        ${_paxFld(k,'zero',_axT('Punkt zerowy (trym)','Zero point (trim)'),
          _axT('Przesuwa punkt zerowy osi — gdy trzymasz kapsel pod naturalnym kątem i chcesz, żeby to było „zero”',
               'Moves the axis zero — for when you hold the capsule at a natural angle and want that to read as zero'))}
        ${_paxFld(k,'dead',_axT('Martwa strefa','Dead zone'),
          _axT('Poniżej tej wartości oś raportuje 0 — gasi drżenie ręki. Reszta zakresu jest przeskalowana, więc pełne wychylenie nadal osiągasz.',
               'Below this the axis reports 0 — it kills hand tremor. The rest of the range is rescaled, so full deflection is still reachable.'))}
        ${_paxFld(k,'inHi',_axT('Pełne wychylenie przy','Full deflection at'),
          _axT('Przy jakim wychyleniu oś ma osiągnąć maksimum. Mniej = czulej. Powyżej tej wartości oś się nasyca.',
               'How far you must lean for the axis to hit its maximum. Less = touchier. Past it the axis saturates.'))}
        ${_paxFld(k,'outHi',_axT('Maksimum na wyjściu','Output maximum'),
          _axT('Ile wynosi to maksimum na wyjściu. Para „pełne przy → maksimum” to całe mapowanie zakresu tej osi.',
               'What that maximum is on the way out. The pair "full at → maximum" is this axis’s whole range mapping.'))}
        ${_paxFld(k,'expo',_axT('Krzywa (expo)','Curve (expo)'),
          _axT('Kształt odpowiedzi. 1 = liniowo. Powyżej 1 = precyzyjniej przy zerze, mocniej dopiero przy dużym wychyleniu. Poniżej 1 = odwrotnie.',
               'Shape of the response. 1 = linear. Above 1 = finer near zero, stronger only at a big lean. Below 1 = the other way round.'))}
      </div>
      <div class="paxrow-foot">
        <span class="paxunit">${_axT('jednostka','unit')}: <b>${u}</b> · ${_axT('zakres','range')} <b>${paxUni(k)?'0':'±'+paxFull(k)}${paxUni(k)?'…'+paxFull(k):''}</b></span>
        <button type="button" class="btn sm pcal-axreset" data-reset="${k}">↺ ${_axT('Domyślne dla tej osi','Defaults for this axis')}</button>
      </div>
    </div>
  </details>`;
}
function _paxGroupHtml(id,title,sub,keys){
  if(!keys.length)return '';
  const on=keys.filter(k=>paxGet(k).on).length;
  return `<section class="paxgrp" data-grp="${id}">
    <h4 class="paxgrp-h"><span class="paxgrp-t">${title}</span>
      <span class="paxgrp-s">${sub}</span>
      <span class="paxgrp-n" data-grpn="${id}">${on?on+'/'+keys.length+' '+_axT('dostrojone','tuned'):_axT('bez zmian','untouched')}</span></h4>
    <div class="paxgrp-b">${keys.map(_paxHtml).join('')}</div></section>`;
}
// Which channel carries which IMU axis comes from the map at the top of this card, so the two
// groups below are built from it rather than assumed — remap the channels and they follow.
function paxChanGroups(){
  const C=(typeof POSE==='object'&&POSE.cal)||{},acc=[],gyr=[],rest=[],seen={};
  for(const g of ['acc','gyr'])for(let i=0;i<3;i++){
    const p=C[g]&&C[g][i];
    if(p&&p[0]>=0&&p[0]<=5&&!seen[p[0]]){seen[p[0]]=1;(g==='acc'?acc:gyr).push('ch'+p[0]);}}
  for(let i=0;i<6;i++)if(!seen[i])rest.push('ch'+i);
  return {acc,gyr,rest};
}
function _paxAdvBadge(){
  const on=PAX_ALL.filter(k=>paxGet(k).on);
  if(!on.length)return `<i class="paxchip paxchip-off">${_axT('nic nie dostrojone','nothing tuned')}</i>`;
  return on.map(k=>`<i class="paxchip" style="--axc:${paxColor(k)}">${paxShort(k)}</i>`).join('');
}
// The head every block of this panel wears — the app's own card head: emoji + title on the left,
// live chips saying what is set right now, description on the right. Shared with the channel map
// and the filter behaviour (rf-33); before, the tuning block was a felt banner of its own and the
// other two were bare underlined captions, so one panel read as one feature and two footnotes.
// The tuning block and the channel map now fold (`cardfold`) and carry their chips in the summary;
// the filter behaviour keeps this banner.
// GROT ROZWIJANIA OSI — TA SAMA IKONA, CO PRZY ZWIJANIU PANELI (2026-08-31: strzałki w czujnikach
// mają wyglądać jak grot paneli po prawej). Stał tu ZNAK TYPOGRAFICZNY „▾"
// z fontu, a kanon aplikacji dla interaktywnego UI to ikony SVG (od 2026-06-21) —
// dokładnie ten sam powód, dla którego znak «/» zniknął z grotu paneli (rf-34b). Ścieżka jest ta
// sama co tam, tylko obrócona: tamten wskazuje w bok, ten w dół. Obraca się SAMA IKONA, nie
// pudełko — inaczej razem z nią jechałby ścieg i cień przycisku.
function _paxChevSvg(){
  return '<svg class="rfx-chev" viewBox="0 0 16 16" aria-hidden="true" focusable="false">'
    + '<path d="M3.3 5.9 8 10.6l4.7-4.7" fill="none" stroke="currentColor" stroke-width="1.9"'
    + ' stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function paxBanner(icon,title,sub,badgeId,badge){
  return `<div class="head"><h2><span class="ra-ic" aria-hidden="true">${icon}</span>${title}</h2>
    <span class="pcal-chips" id="${badgeId}">${badge}</span>
    <span class="hint">${sub}</span></div>`;
}
function _paxAllHtml(){
  const g=paxChanGroups();
  // UX 261120 B5b: blok jest zwijakiem `cardfold` (zamknięty, stan pamięta rfFold w rf-33), bo
  // nowa osoba zmienia go rzadko, a zajmował pół ekranu. Zwinięty nagłówek mówi chipami, co
  // jest dostrojone, więc nie trzeba go otwierać, żeby to sprawdzić.
  return `<details class="cardfold inset pcal-adv" id="pcalAdvFold">
    <summary><span class="ra-ic" aria-hidden="true">📈</span>${_axT('Dostrajanie sygnału','Signal tuning')}<span class="cardfold-sum pcal-chips" id="pcalAdvSum">${_paxAdvBadge()}</span></summary>
    <div class="cardfold-body">
      <div class="pcal-hint">${_axT('Wygładzanie, punkt zerowy, martwa strefa, zakres i krzywa osobno dla każdej osi. Zacznij od tego, gdy ruch drga albo jest zbyt czuły.',
        'Smoothing, zero point, dead zone, range and curve for each axis. Start here when the motion is jittery or too sensitive.')}</div>
      <div class="pcal-hint">${_axT(
        'Tor działa na <b>wyjściach</b>: oscyloskopy, wyzwalacze, gałka, krzyżak, mysz w trybie filtra, MIDI/OSC i bramki padów czytają tę samą, dostrojoną wartość. Podgląd 3D zostaje bez zmian: kula pokazuje realne położenie kapsla. Każda oś startuje wyłączona, a włączenie jej bez ruszania pól niczego nie zmienia.',
        'The chain works on the <b>outputs</b>: the oscilloscopes, triggers, the stick, the d-pad, the mouse in filter mode, MIDI/OSC and the pad gates all read the same tuned value. The 3D preview is left alone: the ball shows where the capsule really is. Every axis starts switched off, and switching one on without touching a field changes nothing.')}</div>
      ${_paxGroupHtml('filter',_axT('Osie filtru 3D','3D filter axes'),
        _axT('policzone z orientacji kapsla','computed from the capsule’s orientation'),PAX_KEYS)}
      ${_paxGroupHtml('acc',_axT('Akcelerometr','Accelerometer'),
        _axT('surowe kanały, wprost z czujnika','raw channels, straight from the sensor'),g.acc)}
      ${_paxGroupHtml('gyr',_axT('Żyroskop','Gyroscope'),
        _axT('surowe kanały, wprost z czujnika','raw channels, straight from the sensor'),g.gyr)}
      ${_paxGroupHtml('rest',_axT('Kanały nieprzypisane','Unassigned channels'),
        _axT('nie występują w mapie kanałów powyżej','not present in the channel map above'),g.rest)}
      <div class="paxfoot">
        <button type="button" class="btn sm" id="pcalAxAllOff">↺ ${_axT('Wyłącz i wyzeruj wszystkie tory','Switch off and reset every chain')}</button>
        <span class="paxfoot-n">${_axT('Tory zapisują się w konfiguracji osi razem z presetami i zestawem, osobno dla każdego kapsla.',
                                       'The chains are part of the axis configuration and travel with the presets and the set, per capsule.')}</span>
      </div>
    </div></details>`;
}

// ---- WIRING ----------------------------------------------------------------------------------
// Update in place after an edit: a full re-render would eat the focus you are typing into.
function _paxRefresh(box,k){
  const a=paxGet(k),det=box.querySelector(`.pcal-ax[data-ax="${k}"]`);
  if(det){det.classList.toggle('is-off',!a.on);det.classList.toggle('is-on',a.on);
    det.querySelectorAll('input.pcal-rng,select,.paxsegb').forEach(el=>{el.disabled=!a.on;});
    det.querySelectorAll('.paxsegb').forEach(el=>{el.classList.toggle('on',el.dataset.v===a.smooth);});
    const sw=det.querySelector('.paxsw');if(sw)sw.setAttribute('aria-checked',a.on?'true':'false');
    det.querySelectorAll('.pcal-numv').forEach(el=>{
      if(el.querySelector('input'))return;                       // mid-typing — leave it alone
      el.textContent=_paxFmt(k,el.dataset.f,a[el.dataset.f]);});
    const s=det.querySelector(`[data-sum="${k}"]`);if(s)s.textContent=poseAxSummary(k);
    if(det.open&&typeof paxDrawOne==='function')paxDrawOne(det);}
  const adv=box.querySelector('#pcalAdvSum');
  if(adv)adv.innerHTML=_paxAdvBadge();
  const g=paxChanGroups(),groups={filter:PAX_KEYS,acc:g.acc,gyr:g.gyr,rest:g.rest};
  for(const id in groups){const el=box.querySelector(`[data-grpn="${id}"]`);
    if(!el||!groups[id].length)continue;
    const on=groups[id].filter(x=>paxGet(x).on).length;
    el.textContent=on?on+'/'+groups[id].length+' '+_axT('dostrojone','tuned'):_axT('bez zmian','untouched');}
}
// Wires the controls of the tuning block. Called from renderPoseCal() after it paints the panel.
function wireAxisTuning(box){
  const adv=box.querySelector('.pcal-adv');
  if(!adv)return;
  adv.querySelectorAll('.pcal-ax').forEach(dt=>dt.addEventListener('toggle',()=>{
    PAX_OPEN[dt.dataset.ax]=dt.open;
    // A folded block draws nothing; unfolding one must paint it at once, not on the next packet.
    if(dt.open&&typeof paxDrawOne==='function')paxDrawOne(dt);
  }));
  const _paxSet=(k,f,v)=>{
    const st=_paxStore(k),cur=paxGet(k);cur[f]=v;st[k]=cur;
    savePoseCal();_paxRefresh(box,k);
  };
  // Sliders report on `input` so the curve moves WHILE you drag — that is the whole point of
  // drawing it. The write itself is already debounced (pushPoseConfig), so dragging is not a flood.
  adv.addEventListener('input',e=>{
    const el=e.target;
    if(!el.classList||!el.classList.contains('pcal-rng'))return;
    const v=parseFloat(el.value);
    if(isFinite(v))_paxSet(el.dataset.k,el.dataset.f,v);
  });
  // Click the number to type an exact value — same affordance as the two sliders above this block.
  adv.querySelectorAll('.pcal-numv').forEach(el=>{
    const k=el.dataset.k,f=el.dataset.f,r=_paxRange(k,f);
    attachNumEdit(el,{min:r.min,max:r.max,step:r.step,
      value:()=>paxGet(k)[f], format:v=>_paxFmt(k,f,v),
      apply:v=>{_paxSet(k,f,v);
        const s=adv.querySelector(`input.pcal-rng[data-k="${k}"][data-f="${f}"]`);if(s)s.value=v;}});
  });
  adv.addEventListener('click',e=>{
    const t=e.target;
    // ON/OFF lives INSIDE the header so an axis can be switched without unfolding it — which means
    // the click must be kept away from the <summary> underneath, or every toggle would also fold.
    const sw=t.closest&&t.closest('.paxsw');
    if(sw){e.preventDefault();e.stopPropagation();
      const k=sw.dataset.k;_paxSet(k,'on',sw.getAttribute('aria-checked')!=='true');return;}
    const seg=t.closest&&t.closest('.paxsegb');
    if(seg){e.preventDefault();e.stopPropagation();
      if(seg.disabled)return;
      _paxSet(seg.dataset.k,'smooth',seg.dataset.v==='adapt'?'adapt':'ema');return;}
    const rs=t.closest&&t.closest('[data-reset]');
    if(rs){e.preventDefault();
      const k=rs.dataset.reset;_paxStore(k)[k]=_paxDefault(k);savePoseCal();
      const det=box.querySelector(`.pcal-ax[data-ax="${k}"]`);
      if(det){const wasOpen=det.open;PAX_OPEN[k]=wasOpen;renderPoseCal(box);}   // every field changed at once
      return;}
    if(t.closest&&t.closest('#pcalAxAllOff')){e.preventDefault();
      for(const k of PAX_ALL)_paxStore(k)[k]=_paxDefault(k);
      savePoseCal();renderPoseCal(box);}
  });
  // Space/Enter on the switch — a role="switch" that only answers the mouse is not a switch.
  adv.addEventListener('keydown',e=>{
    const sw=e.target.closest&&e.target.closest('.paxsw');
    if(!sw||(e.key!==' '&&e.key!=='Enter'))return;
    e.preventDefault();e.stopPropagation();
    _paxSet(sw.dataset.k,'on',sw.getAttribute('aria-checked')!=='true');
  });
}
