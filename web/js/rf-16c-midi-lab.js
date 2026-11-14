"use strict";
// ======================= LABORATORIUM ZAKRESU (edytor MIDI / OSC) =======================
//  Zakres to nie pole formularza — to wykres, na którym widać własny ruch.
//
//  Trzy pasy w jednej sekcji edytora (.mi-rng):
//    A. WEJŚCIE  — oś w jednostkach źródła (° / °/s / LSB), okno [inLo, inHi], wartość teraz,
//                  pas „obserwowane" z ostatnich ~20 s. W trybie progu zamienia się w przebieg
//                  czasowy z linią progu — tym samym językiem wizualnym co edytor wyzwalaczy.
//    B. KRZYWA   — istniejący podgląd z rf-16 (miDrawCurvePrev), tylko z podpisanymi końcami osi.
//    C. WYJŚCIE  — pasek w jednostkach ODBIORNIKA (CC, nuta, µs serwa, procent…), nie w 0..1.
//
//  ⚠️ Wykres, który kłamie o silniku, jest gorszy niż brak wykresu. Dlatego wartość wejścia
//  bierzemy Z SERWERA (klucz `x` w zdarzeniu `mo` — sygnał po P2–P5, w jednostkach fizycznych),
//  a bufor kliencki jest tylko awaryjny i wtedy JEST PODPISANY jako „surowe": panel czyta pozę
//  zaokrągloną i bez znaku kalibracji osi, więc nie wolno go podawać za to samo.
//
//  Nauka zakresu liczy się WYŁĄCZNIE na serwerze (POST /midi/learn) — klient nie próbkuje nic
//  własnego, bo osie mają znak kalibracji tylko po tamtej stronie i nauka kliencka wyszłaby
//  odwrotnie. Tu jest jedynie przycisk, odliczanie i pasek propozycji.
//
//  Plik płaski (klasyczny skrypt, bez IIFE i modułów) — jak reszta rf-*.

// ── Oś źródła: jednostka, widoczny zakres, domyślne okno ────────────────────────────────────
// Domyślne okna są LUSTREM `_sanitize_map` w ribbitflip_monitor.py — na nich opiera się ciche
// przeliczenie przy zmianie źródła (pułapka: user przełącza „Pochylenie 0–90" na „Oś ±16000"
// i zostaje z zakresem, w którym mapowanie jest zawsze nasycone).
const MI_LAB_AXES={
  tilt: {unit:"°",   lo:0,      hi:180,   dLo:0,      dHi:90,     name:"Pochylenie"},
  twist:{unit:"°/s", lo:-720,   hi:720,   dLo:-90,    dHi:90,     name:"Obrót",   sym:true},
  pitch:{unit:"°",   lo:-180,   hi:180,   dLo:-90,    dHi:90,     name:"Pitch",   sym:true},
  roll: {unit:"°",   lo:-180,   hi:180,   dLo:-90,    dHi:90,     name:"Roll",    sym:true},
  spin: {unit:"LSB", lo:0,      hi:28000, dLo:0,      dHi:12000,  name:"Energia ruchu"},
  axis: {unit:"LSB", lo:-32768, hi:32767, dLo:-16000, dHi:16000,  name:"Oś",      sym:true}};
function miLabAxis(m){
  const a=(m&&m.srcKind==="filter")?(MI_LAB_AXES[m.metric]||MI_LAB_AXES.tilt):MI_LAB_AXES.axis;
  return a;
}
// Domyślne okno dla BIEŻĄCEGO źródła — dokładnie ta para, którą wpisałby serwer.
function miLabDefaults(m){const a=miLabAxis(m);return {inLo:a.dLo,inHi:a.dHi};}
// Czy para (inLo, inHi) to nietknięte domyślne KTÓREGOKOLWIEK źródła. Jeżeli tak, wolno ją po
// cichu przeliczyć; jeżeli nie — user wpisał liczby ręcznie i kasowanie ich byłoby kradzieżą.
function miLabIsDefaultPair(lo,hi){
  for(const k in MI_LAB_AXES){const a=MI_LAB_AXES[k];
    if(Math.abs(lo-a.dLo)<1e-9&&Math.abs(hi-a.dHi)<1e-9)return true;}
  return false;
}
// 131 LSB = 1 °/s — jedyny przelicznik, który realnie pomaga przy surowych kanałach żyroskopu.
function miLabAxisNote(m){
  if(m.srcKind==="filter")return (m.metric==="spin")?_gl("surowe LSB żyroskopu · 131 LSB = 1 °/s",
                                                         "raw gyroscope LSB · 131 LSB = 1 °/s"):"";
  return ((m.ch|0)<=2)?_gl("131 LSB = 1 °/s","131 LSB = 1 °/s"):"";
}
// WIDOCZNY ZAKRES OSI PASA A — jedna funkcja dla płótna I dla suwaków pod nim. Gdyby każde liczyło
// swoje, uchwyty stałyby obok krawędzi jasnego prostokąta, a to jest dokładnie ta obietnica, którą
// laboratorium składa: „to, co widzisz, to to, co ustawiasz".
// Oś musi zmieścić okno, obserwowane i wartość teraz — inaczej „poza oknem" bywa niewidoczne.
function miLabAxisView(m,obs,val){
  const a=miLabAxis(m);
  const lo0=Math.min(+m.inLo,+m.inHi),hi0=Math.max(+m.inLo,+m.inHi);
  let axLo=a.lo,axHi=a.hi;
  if(a.sym&&a.unit==="°/s"){const r=Math.max(Math.abs(lo0),Math.abs(hi0),
      obs?Math.max(Math.abs(obs.lo),Math.abs(obs.hi)):0,30)*1.2;axLo=-r;axHi=r;}
  if(isFinite(lo0))axLo=Math.min(axLo,lo0);
  if(isFinite(hi0))axHi=Math.max(axHi,hi0);
  if(obs){axLo=Math.min(axLo,obs.lo);axHi=Math.max(axHi,obs.hi);}
  if(val&&val.v!=null&&isFinite(+val.v)){axLo=Math.min(axLo,+val.v);axHi=Math.max(axHi,+val.v);}
  if(!(axHi>axLo))axHi=axLo+1;
  return {lo:axLo,hi:axHi};
}
// Krok suwaka wejścia. Stopień to najmniejsza różnica, którą człowiek czuje w ruchu kapsla; przy
// surowych LSB (±32768) krok 1 znaczyłby 65 tysięcy pozycji na 240 pikselach — czyli nic.
function miLabStep(a){return (a.unit==="LSB")?10:(a.unit==="°/s")?0.5:1;}

// ── Skala pasa C: w jednostkach ODBIORNIKA, nie w 0..1 ──────────────────────────────────────
// „88" na skali 0–127 i „88" na skali 0–16383 to dwie różne rzeczy; pasek, który nie mówi której,
// nie mówi nic. Nuty pokazujemy nazwą (miNoteName), bo numer 60 nikomu nic nie mówi.
function miLabOutScale(m){
  const num=(v,d)=>{const x=parseFloat(v);return isFinite(x)?x:d;};
  const d=m.dest,thr=(m.mode==="threshold");
  if(d==="cc"||d==="aftertouch")
    return {lo:num(m.outLo,0),hi:num(m.outHi,127),unit:"",fmt:v=>String(Math.round(v))};
  // 14-bit: silnik skaluje do `outLo14`/`outHi14` (domyślnie pełne 0–16383). Panel tych pól nie
  // edytuje, ale set z innej maszyny może je nieść — czytamy je, żeby pas nie obiecywał skali,
  // której silnik nie użyje. Podpis „pełna rozdzielczość" tylko wtedy, gdy zakres realnie pełny.
  if(d==="cc14"||d==="pitchbend"){
    const lo=num(m.outLo14,0),hi=num(m.outHi14,16383),full=(lo===0&&hi===16383);
    const r={lo:lo,hi:hi,unit:"",fmt:v=>String(Math.round(v)),locked:full};
    if(d==="pitchbend")r.mid=8192;
    return r;
  }
  if(d==="program")
    return {lo:0,hi:127,unit:"",fmt:v=>String(Math.round(v))};
  if(d==="note"){
    if(thr)return {lo:num(m.note,60),hi:num(m.note,60),unit:"",one:true,fmt:v=>miNoteName(Math.round(v))};
    return {lo:num(m.loNote,48),hi:num(m.hiNote,72),unit:"",fmt:v=>miNoteName(Math.round(v))};
  }
  // OSC — typ argumentu i zakres pochodzą z profilu odbiornika (miOscVals liczy je tak jak silnik)
  const v=miOscVals(m),p=miOscProf(m);
  const unit=(p[0]==="free")?"":(/µs/.test(p[1])?"µs":(/%/.test(p[1])?"%":(/°/.test(p[1])?"°":"")));
  if(m.oscType==="bool")
    return {lo:0,hi:1,unit:"",bool:true,fmt:x=>(x>=0.5?"true":"false")};
  const isInt=(m.oscType==="int");
  return {lo:v.nLo,hi:v.nHi,unit:unit,
          fmt:x=>isInt?String(Math.round(x)):(Math.round(x*1000)/1000).toFixed(3)};
}

// ── Zakres wyjścia: które pola nim są i w jakich granicach chodzi suwak ─────────────────────
// Pola zakresu wyjścia MIESZKAJĄ W PASIE C (przeniesione z sekcji celu), bo to ten pasek pokazuje,
// co z nich wychodzi. Zachowują swoje id — `wireMidiEditor` czyta formularz PO ID, więc przenosiny
// są dla zapisu niewidoczne, a literówka byłaby cicha.
// Nuta: `miNoteOptions` w rf-16 wypisuje 24…96, więc suwak MUSI trzymać się tych samych granic —
// wartość spoza listy ustawiłaby `<select>` na pusty i zapisała nutę 0.
const MI_LAB_NOTE_LO=24,MI_LAB_NOTE_HI=96;
function _miLabOutFieldIds(m,isThr){
  const thr=(isThr==null)?(m.mode==="threshold"):!!isThr;
  if(m.dest==="cc"||m.dest==="aftertouch")return ["mieOutLo","mieOutHi"];
  if(m.dest==="note")return thr?null:["mieLoNote","mieHiNote"];
  if(m.dest==="osc")return miLabOutBounds(m,isThr)?["mieOutLoF","mieOutHiF"]:null;
  return null;                                   // cc14 / pitchbend / program — skala jest stała
}
// Granice suwaka wyjścia. `null` = ten cel nie ma czego regulować (14-bit, pitch bend, program,
// nuta progowa, wartość logiczna) — pas C pokazuje wtedy sam pasek, bez sterowania.
function miLabOutBounds(m,isThr){
  const thr=(isThr==null)?(m.mode==="threshold"):!!isThr;
  if(m.dest==="cc"||m.dest==="aftertouch")return {lo:0,hi:127,step:1};
  if(m.dest==="note")return thr?null:{lo:MI_LAB_NOTE_LO,hi:MI_LAB_NOTE_HI,step:1};
  if(m.dest!=="osc")return null;
  const p=miOscProf(m),isInt=(m.oscType==="int"),ranged=(isInt||m.oscType==="floatrange");
  const canNarrow=miOscRanged(p),step=isInt?1:0.01;
  if(!canNarrow&&!ranged)return null;             // bool oraz float 0..1 są w silniku przypięte
  // Profil zna pełne możliwości urządzenia — suwak chodzi po nich, a nie po wpisanym wycinku,
  // bo inaczej nie dałoby się wycinka poszerzyć.
  if(canNarrow)return {lo:Math.min(p[3],p[4]),hi:Math.max(p[3],p[4]),step:step,
    locked:(p[0]!=="free")&&!m.oscRangeCustom,canNarrow:true,span:true};
  // „Własny" nie ma profilu, więc granicami są wpisane liczby poszerzone o 0..1 — suwak zawsze
  // obejmuje to, co user już wpisał, i nie zawęża mu pola manewru.
  const x=parseFloat(m.outLoF),y=parseFloat(m.outHiF);
  const A=isFinite(x)?x:0,B=isFinite(y)?y:1;
  return {lo:Math.min(A,B,0),hi:Math.max(A,B,1),step:step,locked:false,canNarrow:false,span:false};
}

// ── Wartość wejścia „teraz" ──────────────────────────────────────────────────────────────────
// Pierwszy wybór: `x` z serwera (po P2–P5, ze znakiem kalibracji). Awaryjnie bufor panelu — i
// wtedy z etykietą „surowe", żeby nikt nie brał go za to samo.
function miLabVal(m){
  const it=state.midiOut&&state.midiOut[m.id];
  if(it&&it.x!=null&&isFinite(+it.x))return {v:+it.x,raw:false};
  if(m.srcKind==="filter"){const p=state.pose;
    if(p&&p[m.metric]!=null&&isFinite(+p[m.metric]))return {v:+p[m.metric],raw:true};}
  else{const k=AKEYS[Math.max(0,Math.min(5,m.ch|0))],l=state.last;
    if(l&&l[k]!=null&&isFinite(+l[k]))return {v:+l[k],raw:true};}
  return null;
}
// Przebieg czasowy dla trybu progu — ten sam bufor, z którego rysuje edytor wyzwalaczy.
function miLabTraceBuf(m){
  if(m.srcKind==="filter")return (state.poseBuf&&state.poseBuf[m.metric])||[];
  const k=AKEYS[Math.max(0,Math.min(5,m.ch|0))];
  return (typeof chanSrcBuf==="function"&&chanSrcBuf(state.devices[state.activeDeviceId],k))
         ||(state.buf&&state.buf[k])||[];
}

// ── Pas „obserwowane" — min/max z ostatnich ~20 s, bufor wyłącznie kliencki ──────────────────
const MI_LAB_OBS_S=20;
let _miLabObs=null;                       // {id, pts:[[t,v],…]}
function miLabReset(){_miLabObs=null;miLabLearnClear();}
function miLabObsPush(id,v){
  const t=(typeof performance!=="undefined"?performance.now():Date.now())/1000;
  if(!_miLabObs||_miLabObs.id!==id)_miLabObs={id:id,pts:[]};
  const p=_miLabObs.pts;p.push([t,v]);
  const cut=t-MI_LAB_OBS_S;
  let i=0;while(i<p.length&&p[i][0]<cut)i++;
  if(i)p.splice(0,i);
}
function miLabObsRange(id){
  if(!_miLabObs||_miLabObs.id!==id||!_miLabObs.pts.length)return null;
  let lo=Infinity,hi=-Infinity;
  for(const q of _miLabObs.pts){if(q[1]<lo)lo=q[1];if(q[1]>hi)hi=q[1];}
  return (lo<=hi)?{lo:lo,hi:hi}:null;
}

// ── Nauka zakresu — cała po stronie serwera ─────────────────────────────────────────────────
const MI_LAB_LEARN_S=5;
let _miLabLearn=null;                     // {id, lo, hi, n, left} — ostatnia migawka z `mo`
let _miLabLearnRes=null;                  // propozycja po zakończeniu (wynik z GET /midi/learn)
let _miLabLearnDone=false;
function miLabLearnClear(){_miLabLearn=null;_miLabLearnRes=null;_miLabLearnDone=false;}
function _miLabPost(body){
  return fetch("/midi/learn",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)}).then(r=>r.json());
}
function _miLabSay(t,bad){
  if(typeof rfToast==="function")rfToast(t,bad?{tone:"danger"}:undefined);
  else if(typeof miFlash==="function")miFlash(t);
}
// Wariant nauki: „pełny zakres" / „symetrycznie wokół zera" / domyślny wg metryki. Dwubiegunowe
// wielkości (obrót, pitch, roll, surowa oś) domyślnie symetryzujemy — inaczej pozycja spoczynkowa
// kapsla wypada poza środkiem wyjścia, co dyskwalifikuje pitch bend i środek serwa.
function miLabLearnStart(variant){
  const m=state._midiDraft;if(!m)return;
  const sym=(variant==="sym")?true:(variant==="full")?false:!!miLabAxis(m).sym;
  miLabLearnClear();
  _miLabPost({action:"start",id:m.id,seconds:MI_LAB_LEARN_S,mode:"p2p98",
              symmetric:sym,marginPct:5}).then(r=>{
    if(!r||!r.ok){_miLabSay((r&&r.error)||_gl("Nie udało się zacząć nauki","Could not start learning"),true);return;}
    _miLabLearn={id:m.id,lo:null,hi:null,n:0,left:(r.seconds||MI_LAB_LEARN_S)*1000};
    miLabRenderLearn();
  }).catch(()=>_miLabSay(_gl("Serwer nieosiągalny","Server unreachable"),true));
}
function miLabLearnCancel(){
  _miLabPost({action:"cancel"}).catch(()=>{});
  miLabLearnClear();miLabRenderLearn();
}
// Zamknięcie edytora: sesja na serwerze musi zgasnąć, ale tylko jeżeli JEST — pusty POST przy
// każdym zamknięciu formularza to zapytanie bez powodu.
function miLabLearnAbort(){
  if(_miLabLearn&&!_miLabLearnRes)_miLabPost({action:"cancel"}).catch(()=>{});
  miLabLearnClear();
}
// Podgląd na żywo jedzie na istniejącym zdarzeniu `mo` (klucz `learn`) — zero nowych kanałów.
function miLabLearnTick(l){
  if(!l)return;
  _miLabLearn=l;
  if(l.left<=0&&!_miLabLearnDone){
    _miLabLearnDone=true;
    fetch("/midi/learn").then(r=>r.json()).then(r=>{
      const st=r&&r.learn;_miLabLearnRes=(st&&st.result)||null;
      if(_miLabLearnRes&&!_miLabLearnRes.ok)
        _miLabSay(_miLabLearnRes.error||_gl("Nauka się nie udała","Learning failed"),true);
      miLabRenderLearn();
    }).catch(()=>{miLabRenderLearn();});
  }
  miLabRenderLearn();
}
function miLabLearnApply(){
  const m=state._midiDraft,r=_miLabLearnRes;if(!m||!r||!r.ok)return;
  _miLabPost({action:"apply",id:m.id}).then(res=>{
    if(!res||!res.ok){_miLabSay((res&&res.error)||_gl("Nie zapisano","Not saved"),true);return;}
    // Serwer już zapisał i rozesłał `midi_cfg`, ale w edytorze leży SZKIC — bez tych dwóch
    // przypisań „Zapisz mapowanie" nadpisałoby świeżo nauczony zakres starymi liczbami.
    m.inLo=res.inLo;m.inHi=res.inHi;
    const a=document.getElementById("mieInLo"),b=document.getElementById("mieInHi");
    if(a)a.value=String(res.inLo);
    if(b)b.value=String(res.inHi);
    miLabLearnClear();miLabRenderLearn();
    _miLabSay(_gl("Zakres nauczony ✓","Range learned ✓"));
  }).catch(()=>_miLabSay(_gl("Serwer nieosiągalny","Server unreachable"),true));
}
// Nagłówek nauki: przycisk, odliczanie, pasek propozycji. Przerysowywany z `mo` (~15 Hz).
function miLabRenderLearn(){
  const host=document.getElementById("miRngLearn");if(!host)return;
  const m=state._midiDraft;if(!m)return;
  // Nauka wpisuje `inLo`/`inHi`, a tryb progu tej pary w ogóle nie czyta — porównuje wartość
  // z `threshold`. Przycisk byłby więc obietnicą bez pokrycia: pomiar by się udał, liczby by
  // wskoczyły w pola i NIC by się nie zmieniło. W progu nie ma go wcale.
  if(m.mode==="threshold"){miLabLearnAbort();host.innerHTML="";return;}
  const saved=!!(state.midi.mappings||[]).find(x=>x.id===m.id);
  if(_miLabLearn&&!_miLabLearnRes){
    const s=Math.max(0,_miLabLearn.left/1000);
    const got=(_miLabLearn.lo!=null&&_miLabLearn.hi!=null)
      ? (miLabNum(_miLabLearn.lo)+" … "+miLabNum(_miLabLearn.hi)) : "—";
    host.innerHTML=`<button type="button" class="btn xs" id="miRngStop">${
      _gl("⏹ Zatrzymaj (","⏹ Stop (")+s.toFixed(1)+_gl(" s)"," s)")}</button>`+
      `<span class="mi-rng-learnhint">${_gl("Ruszaj kapslem tak, jak będziesz grać. Skrajne położenia powoli.",
        "Move the capsule the way you will play. Take the extremes slowly.")} <b>${miEsc(got)}</b></span>`;
    const st=document.getElementById("miRngStop");if(st)st.onclick=miLabLearnCancel;
    return;
  }
  if(_miLabLearnRes&&_miLabLearnRes.ok){
    const r=_miLabLearnRes;
    host.innerHTML=`<span class="mi-rng-learnres">${
      _gl("Złapano ","Caught ")}<b>${miLabNum(r.inLo)} … ${miLabNum(r.inHi)}</b>${
      _gl(" (rozpiętość "," (span ")}${miLabNum(r.span)})</span>`+
      `<button type="button" class="btn xs primary" id="miRngUse">${_gl("✓ Użyj","✓ Use it")}</button>`+
      `<button type="button" class="btn xs" id="miRngDrop">${_gl("Anuluj","Cancel")}</button>`;
    const u=document.getElementById("miRngUse");if(u)u.onclick=miLabLearnApply;
    const d=document.getElementById("miRngDrop");if(d)d.onclick=()=>{miLabLearnClear();miLabRenderLearn();};
    return;
  }
  // Serwer uczy tylko mapowania ZAPISANEGO i włączonego — świeży szkic nie ma jeszcze wiersza
  // w konfiguracji, więc łańcuch nigdy nie policzy dla niego wartości i nauka zebrałaby zero próbek.
  host.innerHTML=`<button type="button" class="btn xs" id="miRngLearnBtn"${saved?"":" disabled"} title="${
    miEsc(saved?_gl("Pomiar 5 s: pomacham kapslem, panel zaproponuje zakres","A 5 s measurement: wave the capsule, the panel proposes a range")
                :_gl("Najpierw dodaj mapowanie, potem naucz zakresu","Add the mapping first, then learn the range"))
    }">🎓 ${_gl("Naucz się zakresu","Learn the range")}</button>`+
    `<select class="mi-rng-lvar" id="miRngLearnVar" aria-label="${miEsc(_gl("Wariant nauki","Learning variant"))}"${saved?"":" disabled"}>
       <option value="auto">${_gl("wg wielkości","by metric")}</option>
       <option value="full">${_gl("pełny zakres","full range")}</option>
       <option value="sym">${_gl("symetrycznie wokół zera","symmetric around zero")}</option>
     </select>`;
  const b=document.getElementById("miRngLearnBtn");
  if(b)b.onclick=()=>{const v=document.getElementById("miRngLearnVar");
    miLabLearnStart(v?v.value:"auto");};
}
function miLabNum(v){
  if(v==null||!isFinite(+v))return "—";
  const x=+v,a=Math.abs(x);
  return (a>=1000)?String(Math.round(x)):(Math.round(x*10)/10).toFixed(1);
}

// ── Markup sekcji ───────────────────────────────────────────────────────────────────────────
// Pola liczbowe ZOSTAJĄ pierwszoplanowe i zachowują swoje id (mieInLo/mieInHi/mieCmp/mieThr/
// mieAbs/mieInvert) — wireMidiEditor czyta je po id i nie wolno tego zerwać.
//
// UKŁAD: wykres i suwak są RODZEŃSTWEM w jednym kontenerze (.mi-rng-plot) o pełnej szerokości,
// a wiersz liczb stoi NAD suwakiem. Poprzedni układ (pole ◀ suwak ▶ pole w jednym wierszu) dawał
// suwakowi tyle, ile zostało po polach: zmierzone w przeglądarce płótno 291–1031 px, tor 389–770 px,
// czyli uchwyty stały ~45 px obok krawędzi jasnego prostokąta, który opisują. Wyrównanie do
// piksela robi CSS: tor dostaje marginesy równe wewnętrznym marginesom kreślenia płótna (Pl/Pr
// z `_miLabDrawRange` / `_miLabDrawThr`), pomniejszone o pół kciuka — przeglądarka mapuje min/max
// na `szerokość − kciuk`, więc bez tej poprawki skrajne wartości leżałyby o pół kciuka do środka.
function miLabSectionHtml(m,isThr){
  const a=miLabAxis(m),note=miLabAxisNote(m),vw=miLabAxisView(m),st=miLabStep(a);
  const u=`<span class="mi-rng-u">${a.unit}</span>`;
  // „odwróć kierunek" musi istnieć DOKŁADNIE RAZ. Dwa wiersze sterowania schowane przez
  // `display:none` dałyby dwa elementy o tym samym id, a `wireMidiEditor` czyta pierwszy z brzegu
  // — mapowanie zapisywałoby się z pola, którego user nie widzi. Dlatego wiersz jest jeden,
  // budowany zależnie od trybu, a nie dwa naprzemiennie ukrywane.
  const invert=`<label class="fld row" title="Zamienia końce zakresu miejscami — największe wychylenie daje najmniejszą wartość"><input type="checkbox" id="mieInvert"${m.invert?" checked":""}> odwróć kierunek</label>`;
  const nums=isThr?`
          <div class="mi-rng-row mi-rng-ctl mi-rng-nums" id="miRngThrRow">
            <label class="fld mi-rng-numw" id="mieThrW">Próg ${u}
              <input type="number" class="mi-rng-num" id="mieThr" step="any" value="${m.threshold}"></label>
            <span class="mi-rng-numsmid">
              <label class="fld" id="mieCmpW">Warunek
                <select id="mieCmp"><option value=">"${m.cmp===">"?" selected":""}>powyżej &gt;</option>
                  <option value="<"${m.cmp==="<"?" selected":""}>poniżej &lt;</option></select></label>
              <label class="fld row" id="mieAbsW"><input type="checkbox" id="mieAbs"${m.absVal?" checked":""}> |wartość| bezwzgl.</label>
              ${invert}
            </span>
          </div>`:`
          <div class="mi-rng-row mi-rng-ctl mi-rng-nums" id="miRngInRow">
            <label class="fld mi-rng-numw" id="mieInLoW">min ${u}
              <input type="number" class="mi-rng-num" id="mieInLo" step="any" value="${m.inLo}"></label>
            <span class="mi-rng-numsmid">${invert}</span>
            <label class="fld mi-rng-numw" id="mieInHiW">max ${u}
              <input type="number" class="mi-rng-num" id="mieInHi" step="any" value="${m.inHi}"></label>
          </div>`;
  const slider=isThr?`
          <span class="mi-rng-one"><input type="range" class="mi-rng-slider" id="miRngThrR"
                 min="${vw.lo}" max="${vw.hi}" step="${st}" value="${m.threshold}" aria-label="Próg"></span>`:`
          <span class="mi-rng-dual" id="miRngInDual">
            <input type="range" id="mieInLoR" min="${vw.lo}" max="${vw.hi}" step="${st}" value="${m.inLo}" aria-label="Wejście min">
            <input type="range" id="mieInHiR" min="${vw.lo}" max="${vw.hi}" step="${st}" value="${m.inHi}" aria-label="Wejście max">
          </span>`;
  const fitRow=isThr?"":`
      <div class="mi-rng-row mi-rng-fitrow" id="miRngFitRow">
        <span class="mi-rng-obs" id="miRngObs"></span>
        <button type="button" class="btn xs" id="miRngFit" title="Wpisze do pól to, co kapsel realnie pokrył w ostatnich sekundach, z 5% zapasu">⤢ Dopasuj do obserwowanego</button>
      </div>`;
  return `
    <section class="mie-sec mi-rng" id="miRng">
      <h4 class="mie-sec-h">${isThr?"Próg — kiedy mapowanie się odzywa":"Zakres — co ma pokryć całą skalę wyjścia"}
        <span class="mi-rng-tools" id="miRngLearn"></span></h4>
      <p class="mie-sec-hint">${isThr
        ?"Przebieg pokazuje ostatnie sekundy ruchu. Komunikat leci w chwili przekroczenia progu, nie przez cały czas."
        :"Jasny prostokąt to okno, które ma pokryć całą skalę wyjścia. Kropka to wartość teraz, blady pas to zakres realnie wykorzystany w ostatnich sekundach."}</p>
      <div class="mi-rng-lane">
        <div class="mi-rng-cap"><span>Wejście</span>
          <label class="fld mi-rng-src" id="mieMetricW" style="${m.srcKind==="filter"?"":"display:none"}">Wielkość
            <select id="mieMetric">${MI_METRICS.map(x=>`<option value="${x[0]}"${m.metric===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select></label>
          <label class="fld mi-rng-src" id="mieChW" style="${m.srcKind==="filter"?"display:none":""}">Kanał (oś)
            <select id="mieCh">${MI_SRC_AXIS.map(x=>`<option value="${x[0]}"${String(m.ch)===x[0]?" selected":""}>${x[1]}</option>`).join("")}</select></label>
          <span class="mi-rng-head" id="miRngHead">—</span></div>
        <div class="mi-rng-plot${isThr?" is-thr":""}" id="miRngPlotA">
          <canvas class="mi-rng-cv" id="miLabCv" aria-hidden="true"></canvas>${miLabMismatchHtml(m,isThr)}${nums}${slider}
        </div>
        ${note?`<span class="mi-rng-note">${note}</span>`:""}
      </div>${fitRow}
      <div class="mi-rng-lane mi-rng-outlane">
        <div class="mi-rng-cap"><span>Wyjście</span><span class="mi-rng-head" id="miRngOutHead">—</span></div>
        <div class="mi-rng-plot mi-rng-plot-out" id="miRngPlotC">
          <div class="mi-rng-outbar"><i class="mi-rng-fill" id="miRngFill"></i><i class="mi-rng-mid" id="miRngMid" style="display:none"></i></div>
          <div class="mi-rng-ends"><span id="miRngOutLo">—</span><span id="miRngOutHi">—</span></div>${miLabOutRowHtml(m,isThr)}
        </div>
      </div>
    </section>`;
}
// Chip niedopasowania MIESZKA W LABORATORIUM i jest liczony przy KAŻDYM renderze. Wcześniej
// dokładał go `renderMidiEditor` osobnym wyrażeniem obok sekcji, na warunku tak wąskim, że okno
// „−5 … 73" na osi ±32768 nigdy go nie spełniało. Pusty host zostaje w drzewie
// (`.mi-rng-warn:empty` go chowa), więc nie ma dwóch dróg renderu tego samego ostrzeżenia.
function miLabMismatchHtml(m,isThr){
  const t=isThr?null:miLabMismatch(m);
  return `
          <div class="mi-rng-warn" id="miRngMismatch">${t?`⚠️ ${miEsc(t)}<button type="button" class="btn xs" id="mieRngFix">${_gl("Dopasuj","Fit it")}</button>`:""}</div>`;
}
// Wiersz sterowania pasa C. Ten sam układ co w pasie A (liczby nad torem, tor na całą szerokość
// paska wyjścia), żeby oba czytało się tak samo — a przede wszystkim: pola zakresu stoją przy
// pasku, który pokazuje ich skutek.
function miLabOutRowHtml(m,isThr){
  const b=miLabOutBounds(m,isThr),ids=_miLabOutFieldIds(m,isThr);
  if(!b||!ids)return "";
  const sc=miLabOutScale(m),u=sc.unit?` <span class="mi-rng-u">${sc.unit}</span>`:"";
  const dis=b.locked?" disabled":"";
  const cl=v=>{const x=parseFloat(v);return isFinite(x)?Math.min(b.hi,Math.max(b.lo,x)):b.lo;};
  let loF,hiF,loV,hiV;
  if(ids[0]==="mieLoNote"){
    loV=cl(m.loNote);hiV=cl(m.hiNote);
    loF=`<select id="mieLoNote">${miNoteOptions(m.loNote)}</select>`;
    hiF=`<select id="mieHiNote">${miNoteOptions(m.hiNote)}</select>`;
  }else if(ids[0]==="mieOutLo"){
    loV=cl(m.outLo);hiV=cl(m.outHi);
    loF=`<input type="number" class="mi-rng-num" id="mieOutLo" min="0" max="127" value="${m.outLo}">`;
    hiF=`<input type="number" class="mi-rng-num" id="mieOutHi" min="0" max="127" value="${m.outHi}">`;
  }else{
    loV=cl(m.outLoF);hiV=cl(m.outHiF);
    const sp=b.span?` min="${b.lo}" max="${b.hi}"`:"";
    loF=`<input type="number" class="mi-rng-num" id="mieOutLoF" step="any" value="${m.outLoF}"${dis}${sp}>`;
    hiF=`<input type="number" class="mi-rng-num" id="mieOutHiF" step="any" value="${m.outHiF}"${dis}${sp}>`;
  }
  // Przełącznik „własny zakres roboczy" stoi PRZY zakresie, którego dotyczy — w karcie profilu
  // był o pół formularza od pól, które odblokowuje.
  const cust=(m.dest==="osc"&&b.canNarrow)
    ? `<label class="fld row" id="mieRangeCustW"><input type="checkbox" id="mieRangeCust"${m.oscRangeCustom?" checked":""}> własny zakres roboczy</label>`:"";
  // Lista nut jest szersza niż pole liczbowe („C#4 (61)"), więc nie dostaje wąskiej ramki.
  const nw=(ids[0]==="mieLoNote")?"":" mi-rng-numw";
  return `
          <div class="mi-rng-row mi-rng-ctl mi-rng-nums" id="miRngOutRow">
            <label class="fld${nw}" id="mieOutLoW">min${u}
              ${loF}</label>
            <span class="mi-rng-numsmid">${cust}</span>
            <label class="fld${nw}" id="mieOutHiW">max${u}
              ${hiF}</label>
          </div>
          <span class="mi-rng-dual" id="miRngOutDual">
            <input type="range" id="mieOutLoR" min="${b.lo}" max="${b.hi}" step="${b.step}" value="${loV}" aria-label="Wyjście min"${dis}>
            <input type="range" id="mieOutHiR" min="${b.lo}" max="${b.hi}" step="${b.step}" value="${hiV}" aria-label="Wyjście max"${dis}>
          </span>`;
}
// ── Podpięcie ───────────────────────────────────────────────────────────────────────────────
// Wołane z wireMidiEditor po zbudowaniu formularza. `upd` to ta sama funkcja, która czyta pola.
function miLabWire(m,upd,rerender){
  const g=id=>document.getElementById(id);
  // Suwak ↔ pole w obie strony. Po ruchu suwakiem wołamy `upd()` — to DOKŁADNIE ta funkcja, którą
  // wywołałby listener `input` pola, więc nie ma dwóch dróg zapisu formularza (i nie potrzeba
  // sztucznego zdarzenia, którego harness testowy i tak nie ma). `<select>` z nutami przyjmuje
  // tylko wartości z listy, stąd zaokrąglenie.
  const bind=(rid,fid,whole)=>{
    const r=g(rid),f=g(fid);if(!r||!f)return;
    r.addEventListener("input",()=>{f.value=whole?String(Math.round(+r.value)):r.value;upd();});
    const back=()=>{const x=parseFloat(f.value);if(isFinite(x))r.value=String(x);};
    f.addEventListener("input",back);f.addEventListener("change",back);
  };
  bind("miRngThrR","mieThr");
  bind("mieInLoR","mieInLo");bind("mieInHiR","mieInHi");
  const oi=_miLabOutFieldIds(m);
  if(oi){bind("mieOutLoR",oi[0],oi[0]==="mieLoNote");bind("mieOutHiR",oi[1],oi[1]==="mieHiNote");}
  const fit=g("miRngFit");
  if(fit)fit.onclick=()=>{
    const o=miLabObsRange(m.id);
    if(!o||!(o.hi>o.lo)){_miLabSay(_gl("Za mało ruchu — pomachaj kapslem chwilę dłużej",
                                       "Not enough movement — wave the capsule a moment longer"));return;}
    const mar=(o.hi-o.lo)*0.05,a=miLabAxis(m);
    let lo=o.lo-mar,hi=o.hi+mar;
    if(a.lo>=0&&lo<0)lo=0;                       // wielkości nieujemne z definicji (pochylenie, energia)
    const A=g("mieInLo"),B=g("mieInHi");
    if(A)A.value=String(Math.round(lo*100)/100);
    if(B)B.value=String(Math.round(hi*100)/100);
    upd();
  };
  miLabRenderLearn();
  if(typeof rerender==="function"){/* zarezerwowane: przebudowa po zmianie źródła robi to rf-16 */}
}
// Pułapka: zmiana źródła (filtr↔oś, inna wielkość, inny kanał) zostawiała stary zakres. Jeżeli
// user go nie tknął (równa się domyślnym JAKIEGOKOLWIEK źródła) — przeliczamy po cichu. Jeżeli
// tknął — zostawiamy jego liczby i mówimy o niedopasowaniu chipem nad polami.
function miLabRetune(m){
  if(!miLabIsDefaultPair(+m.inLo,+m.inHi))return false;
  const d=miLabDefaults(m);
  if(Math.abs(d.inLo-(+m.inLo))<1e-9&&Math.abs(d.inHi-(+m.inHi))<1e-9)return false;
  m.inLo=d.inLo;m.inHi=d.inHi;
  m.threshold=(d.inLo+d.inHi)/2;                 // ta sama domyślna, którą liczy _sanitize_map
  return true;
}
// Chip ostrzegawczy — okno nie ma sensu w jednostkach BIEŻĄCEGO źródła.
//
// Poprzednie kryterium („całkiem poza osią albo półtora raza szersze niż oś") było tak wąskie, że
// realny przypadek z klik-through go nie spełniał: „Pochylenie −5 … 73" przełączone na „Oś (kanał)"
// leży grzecznie w środku ±32768, więc chip milczał, a mapowanie było praktycznie martwe — 78 LSB
// na 65 536 to jedna tysięczna skali. Dlatego liczymy trzy rzeczy, każdą z osobna wystarczającą:
//   • okno leży CAŁE poza widocznym zakresem osi,
//   • okno pokrywa mniej niż 5 % tego zakresu (mapowanie stoi w miejscu albo jest nasycone),
//   • okno się w nim nie mieści — dla wielkości nieujemnych (pochylenie, energia ruchu) to
//     dokładnie przypadek `inLo < 0`.
// Chip niesie parę, którą wpisze „Dopasuj" — czyli domyślne okno nowego źródła, nie kres osi.
const MI_LAB_MIN_COVER=0.05;
function miLabMismatch(m){
  const a=miLabAxis(m),lo=Math.min(+m.inLo,+m.inHi),hi=Math.max(+m.inLo,+m.inHi);
  if(!isFinite(lo)||!isFinite(hi))return null;
  const span=a.hi-a.lo,win=hi-lo;
  const outside=(hi<a.lo||lo>a.hi);                       // całe okno poza osią
  const tiny=(span>0)&&(win<span*MI_LAB_MIN_COVER);       // mniej niż 5 % widocznego zakresu
  const spill=(lo<a.lo||hi>a.hi);                         // nie mieści się (tilt/spin: inLo<0)
  if(!(outside||tiny||spill))return null;
  const d=miLabDefaults(m);
  return _gl(`Zakres ${miLabNum(m.inLo)}…${miLabNum(m.inHi)} nie pasuje do wielkości „${a.name}” (${miLabNum(d.inLo)}…${miLabNum(d.inHi)} ${a.unit})`,
             `The range ${miLabNum(m.inLo)}…${miLabNum(m.inHi)} does not fit “${a.name}” (${miLabNum(d.inLo)}…${miLabNum(d.inHi)} ${a.unit})`);
}

// ── Rysowanie (wołane z frame() w rf-09) ────────────────────────────────────────────────────
function miLabDraw(){
  const m=state._midiDraft;if(!m)return;
  const c=document.getElementById("miLabCv");if(!c)return;
  const ff=fit(c);const ctx=ff.ctx,w=ff.w,h=ff.h;if(!w||!h)return;
  ctx.clearRect(0,0,w,h);
  const val=miLabVal(m);
  if(val)miLabObsPush(m.id,val.v);
  if(m.mode==="threshold")_miLabDrawThr(ctx,w,h,m,val);
  else _miLabDrawRange(ctx,w,h,m,val);
  _miLabDrawOut(m);
}
function _miLabTag(val){
  return val&&val.raw?_gl(" · surowe"," · raw"):"";
}
// Suwaki idą za polami i za widoczną osią. Wołane z pętli rysowania, bo uchwyt ma stać dokładnie
// pod krawędzią jasnego prostokąta — a oś potrafi się rozciągnąć na wartość spoza okna. Elementu,
// który user właśnie trzyma, nie ruszamy: przestawianie skali pod palcem to skok wartości.
function _miLabSyncCtl(view,step,pairs){
  const act=(typeof document!=="undefined")?document.activeElement:null;
  for(const p of pairs){
    const r=document.getElementById(p[0]);if(!r)continue;
    if(r===act)continue;
    if(view){const L=String(view.lo),H=String(view.hi),S=String(step);
      if(r.min!==L)r.min=L;if(r.max!==H)r.max=H;if(r.step!==S)r.step=S;}
    const f=document.getElementById(p[1]);if(!f)continue;
    const x=parseFloat(f.value);
    if(isFinite(x)&&r.value!==String(x))r.value=String(x);
  }
}
function _miLabDrawRange(ctx,w,h,m,val){
  const a=miLabAxis(m);
  const lo0=Math.min(+m.inLo,+m.inHi),hi0=Math.max(+m.inLo,+m.inHi);
  const obs=miLabObsRange(m.id);
  const view=miLabAxisView(m,obs,val),axLo=view.lo,axHi=view.hi;
  _miLabSyncCtl(view,miLabStep(a),[["mieInLoR","mieInLo"],["mieInHiR","mieInHi"]]);
  const Pl=8,Pr=8,pw=w-Pl-Pr,yBar=Math.round(h*0.42),bh=Math.max(14,Math.round(h*0.34));
  const X=v=>Pl+(v-axLo)/(axHi-axLo)*pw;
  ctx.fillStyle=cv('--line');ctx.globalAlpha=.35;ctx.fillRect(Pl,yBar,pw,bh);ctx.globalAlpha=1;
  if(obs){                                        // ▨ obserwowane — półprzezroczysty pas
    const x0=X(obs.lo),x1=X(obs.hi);
    ctx.fillStyle=cv('--az');ctx.globalAlpha=.16;ctx.fillRect(x0,yBar,Math.max(1,x1-x0),bh);ctx.globalAlpha=1;}
  const wx0=X(lo0),wx1=X(hi0);                    // okno [inLo, inHi]
  ctx.fillStyle=cv('--az');ctx.globalAlpha=.30;ctx.fillRect(wx0,yBar,Math.max(2,wx1-wx0),bh);ctx.globalAlpha=1;
  ctx.strokeStyle=cv('--az');ctx.lineWidth=1.6;
  ctx.strokeRect(wx0+0.5,yBar+0.5,Math.max(2,wx1-wx0)-1,bh-1);
  ctx.font="9px "+cv('--mono');ctx.textBaseline="top";     // podziałka w jednostkach źródła
  for(const tv of niceTicks(axLo,axHi,5)){const xx=Math.round(X(tv))+0.5;
    ctx.strokeStyle=cv('--line');ctx.globalAlpha=.45;ctx.beginPath();
    ctx.moveTo(xx,yBar+bh);ctx.lineTo(xx,yBar+bh+3);ctx.stroke();ctx.globalAlpha=1;
    ctx.fillStyle=cv('--dim');ctx.textAlign="center";ctx.fillText(fmtTick(tv),xx,yBar+bh+5);}
  let outside=false;
  if(val){                                        // ● wartość teraz
    outside=(val.v<lo0||val.v>hi0);
    const cx=Math.max(Pl,Math.min(Pl+pw,X(val.v)));
    ctx.fillStyle=outside?cv('--bad'):cv('--pink');
    ctx.beginPath();ctx.arc(cx,yBar+bh/2,5,0,7);ctx.fill();
    ctx.strokeStyle="#fff";ctx.lineWidth=1.2;ctx.stroke();}
  const head=document.getElementById("miRngHead");
  if(head){
    head.textContent=val
      ?(_cvT("teraz")+" "+miLabNum(val.v)+" "+a.unit+_miLabTag(val)
        +(outside?_gl(" · poza oknem, przycięte"," · outside the window, clamped"):""))
      :_gl("brak danych z kapsla","no data from the capsule");
    head.style.color=outside?cv('--bad'):cv('--dim');}
  const ob=document.getElementById("miRngObs");
  if(ob)ob.textContent=obs?(_gl("obserwowane: ","observed: ")+miLabNum(obs.lo)+" … "+miLabNum(obs.hi)+" "+a.unit):"";
  const c2=document.getElementById("miLabCv");
  if(c2)c2.style.boxShadow=(_miLabLearn&&!_miLabLearnRes)?("inset 0 0 0 2px "+cv('--pink')):"none";
}
function _miLabDrawThr(ctx,w,h,m,val){
  const a=miLabAxis(m),buf=miLabTraceBuf(m);
  const tr=v=>m.absVal?Math.abs(v):v;
  const thr=+m.threshold||0,win=state.windowSec||10,end=state.nowTs,start=end-win;
  // Suwak progu chodzi po tej samej osi co pas A w trybie ciągłym, poszerzonej o sam próg — inaczej
  // próg wpisany ręcznie poza zakresem wielkości nie dałby się już suwakiem odzyskać.
  _miLabSyncCtl(miLabAxisView(m,null,{v:thr}),miLabStep(a),[["miRngThrR","mieThr"]]);
  const Pl=44,Pr=8,Pt=8,Pb=12,pw=w-Pl-Pr,ph=h-Pt-Pb;
  let ymin=thr,ymax=thr;
  for(let i=buf.length-1;i>=0;i--){if(buf[i][0]<start-0.5)break;const v=tr(buf[i][1]);
    if(v<ymin)ymin=v;if(v>ymax)ymax=v;}
  const cur=val?tr(val.v):null;
  if(cur!=null){if(cur<ymin)ymin=cur;if(cur>ymax)ymax=cur;}
  if(ymax-ymin<1){ymin-=(a.unit==="LSB")?500:5;ymax+=(a.unit==="LSB")?500:5;}
  const pad=(ymax-ymin)*0.14;ymin-=pad;ymax+=pad;if(m.absVal&&ymin<0)ymin=0;
  const X=ts=>Pl+(ts-start)/win*pw,Y=v=>Pt+(1-(v-ymin)/(ymax-ymin))*ph;
  const gt=(m.cmp!=="<");
  ctx.fillStyle=cv('--warn');ctx.globalAlpha=.09;              // strefa wyzwolenia
  if(gt)ctx.fillRect(Pl,Pt,pw,Math.max(0,Y(thr)-Pt));
  else ctx.fillRect(Pl,Y(thr),pw,Math.max(0,Pt+ph-Y(thr)));
  ctx.globalAlpha=1;
  ctx.font="9px "+cv('--mono');ctx.textBaseline="middle";
  for(const tv of niceTicks(ymin,ymax,4)){const yy=Math.round(Y(tv))+0.5;
    ctx.strokeStyle=cv('--line');ctx.globalAlpha=.25;ctx.beginPath();
    ctx.moveTo(Pl,yy);ctx.lineTo(Pl+pw,yy);ctx.stroke();ctx.globalAlpha=1;
    ctx.fillStyle=cv('--dim');ctx.textAlign="right";ctx.fillText(fmtTick(tv),Pl-4,yy);}
  const line=(v,lab,thin)=>{const ty=Y(v);
    ctx.strokeStyle=cv('--warn');ctx.lineWidth=thin?0.9:1.4;ctx.setLineDash([5,3]);
    ctx.beginPath();ctx.moveTo(Pl,ty);ctx.lineTo(Pl+pw,ty);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=cv('--warn');ctx.textAlign="left";ctx.fillText(lab,Pl+3,(ty-7<Pt+5)?ty+8:ty-7);};
  line(thr,"⟵ "+_cvT("próg")+" "+miLabNum(thr));
  const hy=+m.hystIn||0;                                        // druga, cieńsza linia: zwolnienie
  if(hy>0)line(gt?thr-hy:thr+hy,"⟵ "+_cvT("zwolnienie")+" "+miLabNum(gt?thr-hy:thr+hy),true);
  ctx.strokeStyle=cv('--gz');ctx.lineWidth=1.7;ctx.lineJoin="round";ctx.beginPath();
  let st=false;
  for(let i=0;i<buf.length;i++){const t=buf[i][0];if(t<start-0.5)continue;
    const px=X(t),py=Y(tr(buf[i][1]));if(!st){ctx.moveTo(px,py);st=true;}else ctx.lineTo(px,py);}
  ctx.stroke();
  const over=(cur!=null)&&(gt?cur>thr:cur<thr);
  if(cur!=null){ctx.fillStyle=over?cv('--warn'):cv('--gz');
    ctx.beginPath();ctx.arc(Pl+pw-1,Y(cur),3.6,0,7);ctx.fill();}
  const head=document.getElementById("miRngHead");
  if(head){
    // Dla OSC to samo „powyżej progu" znaczy co innego zależnie od zbocza — mówimy to wprost.
    const edge=(m.dest==="osc")?{bang:_gl(" · impuls przy przekroczeniu"," · a pulse on crossing"),
      gate:_gl(" · trzyma, dopóki powyżej"," · holds while above"),
      toggle:_gl(" · przełącza przy każdym przekroczeniu"," · flips at every crossing"),
      pulse:_gl(" · impuls "," · pulse ")+(m.pulseMs|0)+" ms"}[m.oscEdge||"bang"]||"":"";
    head.textContent=(over?_gl("● WYZWALA — teraz ","● TRIGGERS — now "):_gl("– poniżej — teraz ","– below — now "))
      +(cur==null?"?":miLabNum(cur))+" "+a.unit+_miLabTag(val)+edge;
    head.style.color=over?cv('--warn'):cv('--dim');}
  const c2=document.getElementById("miLabCv");
  if(c2)c2.style.boxShadow=over?("inset 0 0 0 2px "+cv('--warn')):"none";
}
// Czy ZAPISANE mapowanie liczy `o` w tej samej skali, co szkic w edytorze. Tylko wtedy liczba
// z serwera znaczy to samo, co podpis pod nią.
function _miLabOutSame(m,saved){
  if(!saved||saved.dest!==m.dest)return false;
  const a=miLabOutScale(m),b=miLabOutScale(saved);
  return a.lo===b.lo&&a.hi===b.hi;
}
// Wartość „teraz" pasa C. ⚠️ `it.o` przychodzi z mapowania ZAPISANEGO — po zmianie celu albo
// zakresu w edytorze to stara liczba pod nową jednostką (realny błąd: „teraz 104 µs", gdzie 104
// pochodziło ze skali CC 0–127, a podpis mówił o serwie 1000–2000 µs). Dlatego domyślnie liczymy
// z `it.v` — czyli z 0..1 po krzywej, wspólnego dla KAŻDEGO celu — przez skalę SZKICU, dokładnie
// tak, jak robi to stopień wyjściowy silnika. `o` bierzemy tylko wtedy, gdy to ta sama liczba
// (wtedy jest dokładniejsza: uwzględnia limit tempa i kwantyzację).
function _miLabOutNow(m,it,sc,v){
  if(!it)return {txt:"—",pend:true};                    // brak wpisu = mapowania jeszcze nie ma w silniku
  const saved=(state.midi.mappings||[]).find(x=>x.id===m.id)||null;
  const sameDest=!!saved&&saved.dest===m.dest;
  const scaled=()=>sc.fmt(sc.lo+(sc.hi-sc.lo)*v);
  if(m.dest==="note"||m.dest==="program"){              // cele ZDARZENIOWE — `o` to indeks, nie wartość
    if(sameDest&&it.o!=null&&it.o>=0)
      return {txt:(m.dest==="note")?miNoteName(it.o):String(it.o),pend:false};
    if(m.mode==="threshold")return {txt:"—",pend:true};  // zdarzenie progowe policzy dopiero silnik
    return {txt:scaled(),pend:false};
  }
  if(sameDest&&it.o!=null&&_miLabOutSame(m,saved))return {txt:String(it.o),pend:false};
  return {txt:scaled(),pend:false};
}
// Pas C — w jednostkach odbiornika. Zielony błysk w chwili faktycznej wysyłki, jak `.mi-bar.sent`.
function _miLabDrawOut(m){
  const sc=miLabOutScale(m),it=state.midiOut&&state.midiOut[m.id];
  const lo=document.getElementById("miRngOutLo"),hi=document.getElementById("miRngOutHi"),
        fill=document.getElementById("miRngFill"),head=document.getElementById("miRngOutHead"),
        mid=document.getElementById("miRngMid");
  const oi=_miLabOutFieldIds(m);                  // suwaki zakresu wyjścia idą za swoimi polami
  if(oi)_miLabSyncCtl(null,0,[["mieOutLoR",oi[0]],["mieOutHiR",oi[1]]]);
  if(!fill)return;
  if(lo)lo.textContent=sc.one?"":sc.fmt(sc.lo)+(sc.unit?(" "+sc.unit):"");
  if(hi)hi.textContent=sc.one?"":sc.fmt(sc.hi)+(sc.unit?(" "+sc.unit):"");
  if(mid){const on=(sc.mid!=null);mid.style.display=on?"":"none";
    if(on)mid.style.left=(((sc.mid-sc.lo)/((sc.hi-sc.lo)||1))*100).toFixed(1)+"%";}
  const v=it?Math.max(0,Math.min(1,+it.v||0)):0;
  fill.style.width=(v*100).toFixed(1)+"%";
  fill.classList.toggle("sent",!!(it&&it.s));
  fill.classList.toggle("rev",sc.hi<sc.lo);
  if(head){
    const label=miDestLabel(m),now=_miLabOutNow(m,it,sc,v);
    head.textContent=label+" · "+_cvT("teraz")+" "+now.txt
      +(!now.pend&&sc.unit&&m.dest==="osc"?(" "+sc.unit):"")
      +(now.pend?_gl(" · po zapisie"," · after saving"):"")
      +(sc.locked?_gl(" · pełna rozdzielczość 0–16383"," · full resolution 0–16383"):"");}
}
