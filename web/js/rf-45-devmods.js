"use strict";
// ===== "Moduły" — the capsule × module matrix =======================================
// One place that answers "what is switched on, and on which capsule". Before this the answer was
// spread across five tabs, and every one of them shows ONE capsule (the active one) — so with
// three capsules paired, checking the rig meant walking fifteen screens. The matrix is the map;
// the tabs stay the place where a module is CONFIGURED.
//
// The "whole capsule" column is the hold switch that used to sit on the pill. It moved here
// because it asks the same KIND of question as the other five ("does anything come out of this?")
// and because the pill carried six buttons, two of which ("hold" and "sleep") looked equally like
// "off" while meaning different things. One of them now lives where its siblings are.
//
// Everything here is per capsule and read FROM THE SERVER, not from `state.*`: state.trigEnabled,
// state.mouse and state.midi describe the ACTIVE capsule only, which is exactly the blind spot
// this section exists to cover.
//
// Nothing in here is translated by the i18n walker (the container carries data-noi18n): the rows
// are composed with _gl() while painting, so a language switch redraws them through dmRelang().

// grp = the key rfGroupName() understands, and the key the simulation gate is told the group by.
// `pl`/`en` only where the column is NOT one of the server's output groups.
const DM_COLS=[
  {key:"whole",grp:"",       ic:"hd-ic-donttouch",pl:"Cały kapsel",   en:"Whole capsule"},
  {key:"rules",grp:"mapping",ic:"hd-ic-map"},
  // Koło wyboru jest osobnym modułem (własna zakładka, własny przełącznik, własny plik
  // konfiguracji), więc ma tu własną kolumnę. Doklejone do „Mapowania" mówiłoby nieprawdę:
  // wyłączenie reguł nie wyłącza koła i odwrotnie.
  {key:"wheel",grp:"wheel",  ic:"hd-ic-radial"},
  {key:"mouse",grp:"motion", ic:"hd-ic-mmouse"},
  {key:"midi", grp:"midi",   ic:"hd-ic-midi"},
  {key:"osc",  grp:"osc",    ic:"hd-ic-osc"},
  // USŁUGI SIECIOWE — the one column that is NOT per capsule. `app:true` says so out loud, because
  // everything else in this table answers „what is switched on ON THIS CAPSULE" and this one cannot:
  // there is a single switch (`RESTAPI.cfg.enabled`) for the whole application, so every row shows
  // the same state and flipping any of them flips the module. It gets a row per capsule anyway
  // — a gap in the grid would read as „not available here", which is the opposite of the truth.
  // Named „Usługi", like the tab: `rfGroupName("rest")` says „Usługi sieciowe" and a header that
  // long sets the width of a `white-space:nowrap` column for no gain.
  {key:"rest", grp:"rest",   ic:"hd-ic-rest",     pl:"Usługi",         en:"Services", app:true},
  // „DŹWIĘK (SYNTH)", not „Synth" like the tab. `rfGroupName("pad")` says „Synth", but a header
  // that reads like the module would promise what every other column does: switch the module off
  // for this capsule. This cell cannot — it flips the MUTE of ONE capsule (`toggleMute` in rf-11,
  // see `dmApplyOne`); the synth engine is one switch for the whole app and is only ever turned ON
  // from here (never off, that would silence everybody else). So the header names the thing the
  // cell really controls — the sound — and keeps „Synth" in brackets to say where it lives.
  {key:"sound",grp:"pad",    ic:"hd-ic-synth",    pl:"Dźwięk (Synth)",en:"Sound (Synth)"}
].filter(c=>typeof rfModGroupOn!=="function"||rfModGroupOn(c.grp));   // moduł wyłączony przy starcie: bez kolumny (rf-00b)
const DM_LSKEY="ribbitflip.devmods.open";

// dev -> {rules,mouse,midi,osc: true|false|null, mode:""}. null = not asked yet, drawn as off but
// marked "checking" so a switch that is really on cannot be reported as off with any confidence.
const _dmSrv=Object.create(null);
const _dmBusy=Object.create(null);     // dev -> true while its three GETs are in flight
// dev -> true once dmFetchDev has ACTUALLY run for it. Osobny zbiór, bo `_dmSrv[id]` zakłada też
// `dmOnEvent`: pojedyncze zdarzenie ze strumienia (`trigen`, `mouse_cfg`) tworzy wiersz z jednym
// znanym polem i samymi `null`. Dopóki warunek brzmiał „nie ma wiersza → zapytaj", taki kapsel
// nigdy nie doczekał się swoich GET-ów i cztery z siedmiu komórek zostawały na „sprawdzam…" na
// zawsze — a że zdarzenia przychodzą dla WSZYSTKICH slotów, trafiało to zwykle w kapsel, którego
// nikt nie tknął.
const _dmAsked=Object.create(null);
let _dmOpen=false, _dmBuilt=false, _dmMidiTid=0;

function _dmL(pl,en){return (typeof _gl==="function")?_gl(pl,en):pl;}
function _dmEsc(s){return (typeof esc==="function")?esc(s):String(s==null?"":s);}
function _dmToast(msg,tone){try{if(typeof rfToast==="function")rfToast(msg,{tone:tone||"danger"});}catch(e){}}

// Column caption. The four output groups borrow rfGroupName() rather than repeating themselves,
// so a column and the toast that announces switching it on can never disagree on what it is called.
function dmColName(c){
  if(c.pl)return _dmL(c.pl,c.en);
  return (typeof rfGroupName==="function")?rfGroupName(c.grp):c.key;
}
function dmColTip(c){
  const t={
    whole:[ "Wstrzymuje albo wznawia cały kapsel. Wstrzymany nie wysyła niczego.",
            "Puts the whole capsule on hold, or resumes it. On hold it sends nothing."],
    rules:[ "Reguły „ruch kapsla to klawisz” z ekranu Mapowanie.",
            "The “capsule motion is a key” rules from the Mapping screen."],
    wheel:[ "Koło wyboru na przycisku tego kapsla. Wyzwalaczy nie dotyczy.",
            "The selection wheel on this capsule's button. The triggers are not affected."],
    mouse:[ "Sterowanie kursorem albo padem z ruchu tego kapsla.",
            "Cursor or pad control from this capsule's motion."],
    midi:[  "Wysyłka MIDI z tego kapsla.","MIDI output from this capsule."],
    osc:[   "Wysyłka OSC z tego kapsla.","OSC output from this capsule."],
    rest:[  "Włącznik Usług sieciowych (HTTP i OBS Studio). Jeden na całą aplikację: przestawienie go w dowolnym wierszu dotyczy wszystkich kapsli.",
            "The switch of Network services (HTTP and OBS Studio). One for the whole application: flipping it in any row applies to every capsule."],
    sound:[ "Dźwięk syntezatora z tego kapsla. Klawiszy ani MIDI nie dotyczy.",
            "The synth sound from this capsule. Keystrokes and MIDI are not affected."]
  }[c.key]||["",""];
  return _dmL(t[0],t[1]);
}
function dmDevs(){
  try{return Object.values(state.devices).sort((a,b)=>(a.meta.slot||0)-(b.meta.slot||0));}catch(e){return [];}
}
function dmName(D){return (D&&D.meta&&(D.meta.label||D.meta.name))||(D&&D.meta&&D.meta.dev)||"";}
// devStateWord() always answers in Polish and the i18n walker is deliberately kept out of this
// subtree (data-noi18n), so the word is mapped here. Without it the state column would be the one
// Polish thing left in an English table. Same words the dictionary uses for the pill.
const DM_WORDS={"wstrzymany":"on hold","wstrzymany (bezczynność)":"on hold (idle)",
                "parowanie":"pairing","uśpiony":"asleep","szukam":"searching",
                "niesparowany":"unpaired","rozłączony":"disconnected"};
function dmStateWord(D){
  const w=(typeof devStateWord==="function")?devStateWord(D):"";
  return w?_dmL(w,DM_WORDS[w]||w):"";
}

// ---- reading the current state ---------------------------------------------------------------
// `whole` and `sound` are inverted flags the front already holds live (devmeta arrives for every
// slot), the other four have to be fetched. Returns true / false / null, where null means
// "not asked yet" — never guessed, because a switch drawn off while it is on is a lie a person
// acts on.
function dmCellOn(id,key){
  const D=state.devices&&state.devices[id]; if(!D)return null;
  // MANUAL hold only, deliberately: `autoPaused` is NOT read here. This cell is a switch the user
  // owns — drawing it off because the capsule was put down for a minute would say "you turned this
  // capsule off", and flipping it back would then write a state the user never chose. The idle
  // hold is REPORTED instead, in the state column (dmStateWord) and on the pill.
  if(key==="whole")return !(D.meta&&D.meta.paused);
  // DŹWIĘK MA DWIE BRAMKI I OBIE MUSZĄ BYĆ OTWARTE. Ta kolumna czytała wyłącznie `muted`, czyli
  // wyciszenie POJEDYNCZEGO kapsla, i mówiła „włączone" przy zgaszonym przełączniku całego
  // syntezatora — a kropka „Synth" w nawigacji czyta ten sam przełącznik i mówiła „wyłączone".
  // Ten sam kapsel, ta sama chwila, dwie odpowiedzi. Prawdą jest przełącznik z paska modułu
  // (`XPAD.enabled`, rf-23), więc obie odpowiedzi liczą się teraz z niego I z wyciszenia kapsla:
  // „czy z tego kapsla wychodzi dźwięk". Przełącznik jest wspólny dla całej aplikacji (jest jeden
  // silnik audio w przeglądarce), wyciszenie jest per kapsel — stąd iloczyn, a nie wybór jednego.
  if(key==="sound")return dmSynthOn()&&!(D.meta&&D.meta.muted);
  // ONE SWITCH FOR THE WHOLE APPLICATION. Network services have no per-capsule state: the config
  // lives in `RESTAPI.cfg` (rf-35), not in a slot on the server, so `id` means nothing here and
  // every row is lit the same way. Same shape as `dmSynthOn` above: with the module absent (the
  // overlay window) the answer is „off", not a permanent „checking…".
  if(key==="rest")return dmRestOn();
  const s=_dmSrv[id]; if(!s)return null;
  return (s[key]==null)?null:!!s[key];
}
// Przełącznik syntezatora — jeden na aplikację, mieszka w przeglądarce (rf-19/rf-23), nie na
// serwerze, więc nie ma go w `_dmSrv`. Przez `typeof`, bo macierz stoi też w okienku nakładki,
// gdzie modułu dźwięku nie ma wcale.
function dmSynthOn(){return (typeof XPAD!=="undefined"&&XPAD)?!!XPAD.enabled:false;}
// The same shape for Network services — `RESTAPI` is built in rf-35 and also lives in the browser.
function dmRestOn(){
  try{if(typeof RESTAPI!=="undefined"&&RESTAPI&&RESTAPI.cfg)return !!RESTAPI.cfg.enabled;}catch(e){}
  return false;
}
// Three GETs per capsule, in one place. /midi is the odd one out: its two switches sit INSIDE
// `slot`, not at the top level of the response (the top level carries the port/availability
// environment), so reading m.enabled here would silently yield undefined for every capsule.
async function dmFetchDev(id){
  if(_dmBusy[id])return;
  _dmBusy[id]=true;
  _dmAsked[id]=true;   // patrz `_dmAsked` — obecność wiersza w `_dmSrv` NIE znaczy „zapytaliśmy"
  const q="?dev="+encodeURIComponent(id);
  const s=_dmSrv[id]||(_dmSrv[id]={rules:null,wheel:null,mouse:null,midi:null,osc:null,mode:""});
  try{const r=await fetch("/rules"+q).then(x=>x.json()); if(r&&r.enabled!=null)s.rules=!!r.enabled;}catch(e){}
  try{const wl=await fetch("/wheel"+q).then(x=>x.json()); if(wl&&wl.enabled!=null)s.wheel=!!wl.enabled;}catch(e){}
  try{const a=await fetch("/airmouse"+q).then(x=>x.json());
      if(a){if(a.enabled!=null)s.mouse=!!a.enabled; s.mode=String(a.mode||"");}}catch(e){}
  try{const m=await fetch("/midi"+q).then(x=>x.json());
      const sl=(m&&m.slot)||{};
      if(sl.enabled!=null)s.midi=!!sl.enabled;
      // Older servers had ONE switch for both — mirror it rather than drawing OSC off on a rig
      // where it is running.
      s.osc=(sl.oscEnabled!=null)?!!sl.oscEnabled:((sl.enabled!=null)?!!sl.enabled:s.osc);
  }catch(e){}
  _dmBusy[id]=false;
  dmPaint();
}
function dmFetchAll(){dmDevs().forEach(D=>dmFetchDev(D.meta.dev));}

// ---- writing --------------------------------------------------------------------------------
// One capsule, one column. Returns false when the POST failed, so the bulk path can stop on the
// capsule that failed instead of walking on behind a green bubble.
async function dmApplyOne(id,key,want){
  if(key==="whole"){ if(typeof togglePause==="function")togglePause(id,!want); return true; }
  if(key==="sound"){
    // Włączenie musi otworzyć OBIE bramki, które czyta `dmCellOn`: wspólny przełącznik
    // syntezatora i wyciszenie tego kapsla. Bez pierwszej połowy kliknięcie w komórkę nie
    // robiłoby nic widocznego — odciszałoby kapsel przy zgaszonym silniku dźwięku.
    // Wyłączenie zostaje przy samym wyciszeniu: komórka dotyczy JEDNEGO kapsla, a zgaszenie
    // wspólnego przełącznika uciszyłoby przy okazji wszystkie pozostałe.
    if(want&&!dmSynthOn()&&typeof padSetEnabled==="function")padSetEnabled(true);
    if(typeof toggleMute==="function")toggleMute(id,!want);
    dmPaint(); return true; }
  if(key==="rest"){
    // ONE SWITCH, so the write ignores `id` too - exactly what the module bar on the Usługi tab
    // does with the very same click (rf-35, #raEnable): flip the flag, let the debounced save
    // carry it to disk, then repaint the header and the navigation dot, so all three answers to
    // "is it on" change in the same frame instead of drifting until the next tick.
    try{
      if(typeof RESTAPI==="undefined"||!RESTAPI||!RESTAPI.cfg)return false;
      RESTAPI.cfg.enabled=!!want;
      if(typeof restSave==="function")restSave();
      if(typeof _raRenderHeader==="function")_raRenderHeader();
      if(window.updateTabDots)updateTabDots();
    }catch(e){return false;}
    dmPaint(); return true; }
  const q="?dev="+encodeURIComponent(id);
  let url=null,body=null;
  if(key==="rules"){url="/trig-enable"+q;body={enabled:!!want};}
  else if(key==="wheel"){
    // ONLY `enabled`. Sanitize merges it into whatever this capsule already has, so the slice
    // tree, the timings and the place the wheel is drawn stay exactly as they were — a matrix
    // cell must not be a way to quietly reset the setup behind a switch.
    // A wheel with fewer than two slices REFUSES to switch on (see POST /wheel), so the optimistic
    // paint below is corrected by the next fetch rather than left lying.
    url="/wheel"+q;body={enabled:!!want};
  }else if(key==="mouse"){
    // ONLY `enabled`. The rest of this capsule's motion configuration (mode, speed, dead zone,
    // the monitor it is allowed onto) stays on the server — a matrix cell must not be a way to
    // quietly reset the tuning behind a switch.
    url="/airmouse"+q;body={enabled:!!want};
  }else if(key==="midi"||key==="osc"){
    // MIDI and OSC share one config object, and set_config treats a lone `enabled` as "the old
    // shared switch" — so the current pair is read first and only the wanted half is changed.
    // Switching MIDI on must not switch OSC on with it. Same read-modify-write as _rfSwitchEnable
    // in rf-29, with the `slot` unwrapping that endpoint actually needs.
    let cur={};
    try{const m=await fetch("/midi"+q).then(x=>x.json());cur=(m&&m.slot)||{};}catch(e){}
    const curMidi=(cur.enabled!=null)?!!cur.enabled:!!(_dmSrv[id]&&_dmSrv[id].midi);
    const curOsc=(cur.oscEnabled!=null)?!!cur.oscEnabled:!!(_dmSrv[id]&&_dmSrv[id].osc);
    url="/midi"+q;
    body={enabled:(key==="midi")?!!want:curMidi, oscEnabled:(key==="osc")?!!want:curOsc};
  }
  if(!url)return true;
  const s=_dmSrv[id]||(_dmSrv[id]={rules:null,wheel:null,mouse:null,midi:null,osc:null,mode:""});
  const before=s[key];
  s[key]=!!want; dmPaint();                       // optimistic: SSE (or the next fetch) confirms
  try{
    const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},
                             body:JSON.stringify(body)});
    if(!r.ok){s[key]=before;dmPaint();return false;}
  }catch(e){s[key]=before;dmPaint();return false;}
  return true;
}
// Every switch-ON goes through the same gate as every other one in the app: in simulation the
// motion is fake but the outputs are not, so it asks first. OFF is never gated.
function dmGate(want,apply,grp){
  if(typeof rfSimConfirmOn==="function")rfSimConfirmOn(!!want,apply,grp||"");
  else apply();
}
function dmToggleCell(id,key,want){
  const col=DM_COLS.find(c=>c.key===key)||{};
  dmGate(want,async()=>{
    const ok=await dmApplyOne(id,key,want);
    if(!ok)_dmToast(_dmL("Nie udało się przełączyć: ","Could not switch: ")+dmName(state.devices[id])+
                    " · "+dmColName(col)+".");
  },col.grp);
}
// The master. Sequential on purpose, exactly like the "switch on now" button in rf-29: these are
// a handful of small POSTs, and doing them one after another means a failure stops on the capsule
// that failed instead of half-arming the rig. ONE gate for the whole batch, not one per capsule.
function dmToggleAll(key,want){
  const col=DM_COLS.find(c=>c.key===key)||{};
  dmGate(want,async()=>{
    const bad=[];
    for(const D of dmDevs()){
      const id=D.meta.dev;
      if(dmCellOn(id,key)===!!want)continue;      // already there — no POST, no gate fatigue
      const ok=await dmApplyOne(id,key,want);
      if(!ok){bad.push(dmName(D));break;}
    }
    if(bad.length)_dmToast(_dmL("Zatrzymano na kapslu: ","Stopped at capsule: ")+bad[0]+
                           " · "+dmColName(col)+".");
  },col.grp);
}
// off | on | mixed, counting only capsules whose value is KNOWN. Nothing known yet reads as off,
// and the header cell says "checking" while that is the case.
function dmMasterState(key){
  let on=0,off=0,unk=0;
  for(const D of dmDevs()){
    const v=dmCellOn(D.meta.dev,key);
    if(v==null)unk++; else if(v)on++; else off++;
  }
  if(!on&&!off)return {st:"off",unk:true};
  if(on&&!off)return {st:"on",unk:!!unk};
  if(off&&!on)return {st:"off",unk:!!unk};
  return {st:"mixed",unk:!!unk};
}

// ---- markup ----------------------------------------------------------------------------------
function _dmCellHtml(id,key,on,unk,label){
  const cls="rf-toggle dm-tg"+(on?" on":"")+(unk?" unknown":"");
  return `<span class="${cls}" role="switch" aria-checked="${on?"true":"false"}" tabindex="0"`+
         ` data-dev="${_dmEsc(id)}" data-col="${_dmEsc(key)}"`+
         ` aria-label="${_dmEsc(label)}" title="${_dmEsc(label)}">`+
         `<span class="rf-tg-knob"></span></span>`;
}
function _dmMasterHtml(key,ms,label){
  const cls="rf-toggle dm-tg dm-master"+(ms.st==="on"?" on":"")+(ms.st==="mixed"?" mixed":"")+
            (ms.unk?" unknown":"");
  return `<span class="${cls}" role="checkbox" aria-checked="${ms.st==="mixed"?"mixed":(ms.st==="on"?"true":"false")}"`+
         ` tabindex="0" data-dev="*" data-col="${_dmEsc(key)}"`+
         ` aria-label="${_dmEsc(label)}" title="${_dmEsc(label)}">`+
         `<span class="rf-tg-knob"></span></span>`;
}
// What one cell says when you hover it or a screen reader reaches it: whose switch, which module,
// which way it is. The mouse column adds the mode, because "on" answers a different question there
// ("on, but is it driving the cursor or the pad?").
function dmCellLabel(D,c,on,unk){
  const nm=dmName(D), col=dmColName(c);
  let s=nm+" · "+col+" · "+(unk?_dmL("sprawdzam…","checking…")
                               :(on?_dmL("włączone","on"):_dmL("wyłączone","off")));
  // App-wide column: the label has to say so, or a row reading "Triki 2 · Usługi · on" promises
  // a switch that belongs to Triki 2.
  if(c.app)s+=" · "+_dmL("wspólne dla wszystkich kapsli","shared by every capsule");
  if(c.key==="mouse"&&!unk){
    const md=(_dmSrv[D.meta.dev]||{}).mode;
    if(md)s+=" · "+_dmL("tryb: ","mode: ")+(md==="mouse"?_dmL("mysz","mouse"):_dmL("kontroler","controller"));
  }
  return s;
}
function dmBuild(box){
  const devs=dmDevs();
  const many=devs.length>1;
  let h='<table class="dm-tab"><thead><tr>'+
        `<th scope="col" class="dm-hcap">${_dmEsc(_dmL("Kapsel","Capsule"))}</th>`;
  for(const c of DM_COLS){
    // THE GLOBE = app-wide. Every other column is a switch of THIS capsule; this one is shared,
    // and a table of identical-looking switches has to say which of them are not per row. Marked
    // on the HEADER rather than in each cell: it is a fact about the column, and repeating it once
    // per row would be that many times the noise. Hidden from assistive tech - the same sentence
    // is in the header's `title` (its description) and in every cell's label (dmCellLabel).
    const glob=c.app?(' <span class="dm-hglob" aria-hidden="true" title="'+
      _dmEsc(_dmL("wspólny włącznik dla wszystkich kapsli","one switch shared by every capsule"))+
      '">🌍</span>'):"";
    h+=`<th scope="col" title="${_dmEsc(dmColTip(c))}">`+
       `<span class="rfic hd-ic ${c.ic}" aria-hidden="true"></span>`+
       `<span class="dm-hlbl">${_dmEsc(dmColName(c))}${glob}</span></th>`;
  }
  h+="</tr></thead><tbody>";
  if(many){
    h+=`<tr class="dm-row dm-allrow"><th scope="row" class="dm-cap">`+
       `<span class="dm-allname">${_dmEsc(_dmL("Wszystkie","All capsules"))}</span></th>`;
    for(const c of DM_COLS){
      const ms=dmMasterState(c.key);
      h+=`<td>${_dmMasterHtml(c.key,ms,dmColName(c)+" · "+_dmL("wszystkie kapsle","all capsules"))}</td>`;
    }
    h+="</tr>";
  }
  for(const D of devs){
    const id=D.meta.dev;
    const capUrl=(D.meta.cap&&typeof CAP_IMG!=="undefined"&&CAP_IMG[D.meta.cap])||"";
    const word=dmStateWord(D);
    h+=`<tr class="dm-row" data-dev="${_dmEsc(id)}" style="--dcol:${_dmEsc(D.meta.color||"#8aa0b5")}">`+
       `<th scope="row" class="dm-cap">`+
       (capUrl?`<span class="dm-capimg" style="background-image:url(${_dmEsc(capUrl)})"></span>`
              :`<span class="dm-capdot"></span>`)+
       `<span class="dm-capname">${_dmEsc(dmName(D))}</span>`+
       `<span class="dm-state">${_dmEsc(word)}</span></th>`;
    for(const c of DM_COLS){
      const v=dmCellOn(id,c.key);
      h+=`<td>${_dmCellHtml(id,c.key,v===true,v==null,dmCellLabel(D,c,v===true,v==null))}</td>`;
    }
    h+="</tr>";
  }
  h+="</tbody></table>";
  // LEGENDA. Przełącznik w komórce ma TRZY stany — włączony, wyłączony i „jeszcze nie wiem"
  // (`.dm-tg.unknown`, przygaszony) — a trzeci jest rysunkiem, którego nigdzie indziej w aplikacji
  // nie ma, więc nie da się go skądś znać. Jedna linijka pod tabelą, a nie podpowiedź w komórce:
  // pytanie „co znaczy ten blady?" zadaje się raz, patrząc na całą siatkę.
  h+=`<p class="dm-legend">`
    +`<span class="dm-lg"><span class="dm-lg-sw on"></span>${_dmEsc(_dmL("włączone","on"))}</span>`
    +`<span class="dm-lg"><span class="dm-lg-sw"></span>${_dmEsc(_dmL("wyłączone","off"))}</span>`
    +`<span class="dm-lg"><span class="dm-lg-sw unknown"></span>${_dmEsc(_dmL("sprawdzam…","checking…"))}</span>`
    +`</p>`;
  box.innerHTML=h;
  box._dmKey=devs.map(D=>D.meta.dev).join(",")+"|"+devs.length+"|"+
             ((typeof _gl==="function")?_gl("pl","en"):"pl");
}
// Cheap pass for the common case: the same capsules, only their switches moved. Rebuilding the
// table on every devmeta/SSE tick would steal keyboard focus out of a cell mid-use.
function dmSync(box){
  const devs=dmDevs();
  for(const D of devs){
    const id=D.meta.dev;
    const row=box.querySelector('.dm-row[data-dev="'+CSS.escape(id)+'"]');
    if(!row)continue;
    row.style.setProperty("--dcol",D.meta.color||"#8aa0b5");
    const nmEl=row.querySelector(".dm-capname"); const nm=dmName(D);
    if(nmEl&&nmEl.textContent!==nm)nmEl.textContent=nm;
    const stEl=row.querySelector(".dm-state");
    const word=dmStateWord(D);
    if(stEl&&stEl.textContent!==word)stEl.textContent=word;
    for(const c of DM_COLS){
      const cell=row.querySelector('.dm-tg[data-col="'+CSS.escape(c.key)+'"]');
      if(!cell)continue;
      const v=dmCellOn(id,c.key), on=(v===true), unk=(v==null);
      cell.classList.toggle("on",on);
      cell.classList.toggle("unknown",unk);
      cell.setAttribute("aria-checked",on?"true":"false");
      const lbl=dmCellLabel(D,c,on,unk);
      if(cell.getAttribute("aria-label")!==lbl){cell.setAttribute("aria-label",lbl);cell.title=lbl;}
    }
  }
  for(const c of DM_COLS){
    const m=box.querySelector('.dm-master[data-col="'+CSS.escape(c.key)+'"]');
    if(!m)continue;
    const ms=dmMasterState(c.key);
    m.classList.toggle("on",ms.st==="on");
    m.classList.toggle("mixed",ms.st==="mixed");
    m.classList.toggle("unknown",!!ms.unk);
    m.setAttribute("aria-checked",ms.st==="mixed"?"mixed":(ms.st==="on"?"true":"false"));
  }
}
// The one entry point everything else calls. Builds when the shape changed (a capsule appeared,
// disappeared, or the language did), syncs otherwise, and does nothing at all while the section
// is closed — the whole point of folding it away is that it costs nothing folded.
function dmPaint(){
  const wrap=document.getElementById("devModsWrap");
  const btn=document.getElementById("devModsBtn");
  if(!wrap)return;
  const devs=dmDevs();
  const show=devs.length>0;
  // „No capsules" is not „closed": the fold goes this instant, animation and all (rfFoldHide).
  // Otherwise `display` is left alone — dmSetOpen owns it, and this function runs at the START of
  // the closing slide, so writing `display:none` here would cut the retraction off at frame one.
  if(!show)rfFoldHide(wrap);
  if(btn)btn.style.display=show?"":"none";
  if(!show||!_dmOpen)return;
  const box=document.getElementById("devModsBox"); if(!box)return;
  // SCHOWANA MACIERZ SIĘ NIE ODŚWIEŻA. Od 2026-08-28 macierz ma własny ekran („Przegląd wszystkich
  // kapsli"), a `_dmOpen` jest przy nim zapalone NA STAŁE (patrz koniec pliku: obecność #devModsHost
  // wymusza `true`) — więc każdy `renderDeviceSelector` przepuszczał `dmSync`, czyli 7 × (N+1)
  // querySelectorów po siatce, której w tej chwili nikt nie ogląda, bo stoi w nieaktywnej zakładce.
  // `offsetParent === null` to jedno spojrzenie i zamyka całą tę robotę. Wejście na Przegląd
  // przerysowuje siatkę tak czy owak: setTab woła renderDeviceSelector.
  if(box.offsetParent===null)return;
  const key=devs.map(D=>D.meta.dev).join(",")+"|"+devs.length+"|"+
            ((typeof _gl==="function")?_gl("pl","en"):"pl");
  if(box._dmKey!==key)dmBuild(box); else dmSync(box);
  for(const D of devs)if(!_dmAsked[D.meta.dev])dmFetchDev(D.meta.dev);   // a capsule we never asked about
}
// Language switch: the rows are _gl() at paint time, so they need a real rebuild, not a walker pass.
function dmRelang(){
  const btn=document.getElementById("devModsBtn");
  if(btn){
    const lbl=btn.querySelector(".dm-btn-lbl"); if(lbl)lbl.textContent=_dmL("Moduły","Modules");
    btn.title=_dmL("Włącz i wyłącz moduły osobno na każdym kapslu: mapowanie, koło wyboru, mysz i kontroler, MIDI, OSC, usługi sieciowe, dźwięk.",
                   "Switch modules on and off per capsule: mapping, selection wheel, mouse and controller, MIDI, OSC, network services, sound.");
  }
  const box=document.getElementById("devModsBox"); if(box)box._dmKey="";
  dmPaint();
}

// ---- open / close ----------------------------------------------------------------------------
function dmSetOpen(open){
  _dmOpen=!!open;
  try{localStorage.setItem(DM_LSKEY,_dmOpen?"1":"0");}catch(e){}
  const btn=document.getElementById("devModsBtn");
  if(btn)btn.setAttribute("aria-expanded",_dmOpen?"true":"false");
  if(_dmOpen&&!_dmBuilt){_dmBuilt=true;dmFetchAll();}   // lazy: nothing is fetched until first opened
  // Content FIRST, slide second: dmPaint() is what builds the table, and a slide started before it
  // would animate an empty box and let the matrix appear in a jump afterwards.
  dmPaint();
  // Shared with „Widoczność" (rf-48) — same gesture, same three states, one implementation in
  // rf-00. „No capsules" wins over „open": dmPaint has already folded it away in that case, and
  // asking for it back here would undo that.
  rfFoldSetOpen(document.getElementById("devModsWrap"),_dmOpen&&dmDevs().length>0);
}

// ---- SSE ------------------------------------------------------------------------------------
// routeEvent is WRAPPED rather than having handlers added to its map, for one reason: the map sits
// behind `if(!activeNow)return;`, so trigen/mouse_cfg for any capsule that is not the active one
// never reach it — and those are precisely the rows this section exists to show. Wrapping sees
// every event for every slot and touches nothing in rf-08.
function dmOnEvent(m){
  if(!m||!m.t)return;
  const t=m.t;
  if(t==="devgone"){const _g=m.dev||"d0";delete _dmSrv[_g];delete _dmAsked[_g];dmPaint();return;}
  if(!_dmOpen)return;                      // closed: remember nothing, redraw nothing
  if(t==="trigen"){
    const id=m.dev||"d0";
    const s=_dmSrv[id]||(_dmSrv[id]={rules:null,wheel:null,mouse:null,midi:null,osc:null,mode:""});
    s.rules=!!m.enabled; dmPaint(); return;
  }
  if(t==="mouse_cfg"){
    const id=m.dev||"d0";
    const s=_dmSrv[id]||(_dmSrv[id]={rules:null,wheel:null,mouse:null,midi:null,osc:null,mode:""});
    if(m.enabled!=null)s.mouse=!!m.enabled;
    if(m.mode!=null)s.mode=String(m.mode||"");
    dmPaint(); return;
  }
  if(t==="midi_cfg"){
    // This event carries NO `dev` (the emitter publishes its own config, not the slot's id), so
    // there is nothing to route it by — the only honest answer is to re-read every capsule.
    // Debounced, because one mapping edit publishes a burst of them.
    clearTimeout(_dmMidiTid);
    _dmMidiTid=setTimeout(()=>{dmDevs().forEach(D=>dmFetchDev(D.meta.dev));},300);
    return;
  }
}
if(typeof routeEvent==="function"){
  const _dmPrevRoute=routeEvent;
  routeEvent=function(m){
    const r=_dmPrevRoute.apply(this,arguments);
    try{dmOnEvent(m);}catch(e){}
    return r;
  };
}
// The Usługi switch does not live on the server, so no event carries it. `_raRenderHeader` (rf-35)
// is the single funnel every change of it goes through - the click in the module bar and the first
// load of /rest-config - so the matrix learns about it there. Same wrapping trick as below, and the
// same reason: one place that already runs on every reason to redraw beats a second list of them.
if(typeof _raRenderHeader==="function"){
  const _dmPrevRestHdr=_raRenderHeader;
  _raRenderHeader=function(){
    const r=_dmPrevRestHdr.apply(this,arguments);
    try{dmPaint();}catch(e){}
    return r;
  };
}
// The pill renderer already runs on everything that changes a capsule's name, colour, hold, mute,
// or its very existence. Wrapping it means the matrix follows all of that for free instead of
// keeping a second, slightly different list of reasons to redraw.
if(typeof renderDeviceSelector==="function"){
  const _dmPrevRenderDev=renderDeviceSelector;
  renderDeviceSelector=function(){
    const r=_dmPrevRenderDev.apply(this,arguments);
    try{dmPaint();}catch(e){}
    return r;
  };
}

// ---- build + wire ----------------------------------------------------------------------------
function initDevMods(){
  // GDZIE MIESZKA MACIERZ (zmiana 2026-08-29). Do 2026-08-28 wisiała jako zwijany blok w hubie
  // kapsli i zabierała miejsce nad KAŻDĄ zakładką. Teraz ma własny ekran w środkowej kolumnie
  // („Przegląd", karta #devModsHost budowana przez rf-34), a wchodzi się do niego przyciskiem
  // „Przegląd wszystkich kapsli" pod kapslami. Stary hub zostaje jako awaryjne zaczepienie:
  // gdyby ekranu przeglądu nie było, macierz nadal się gdzieś zmontuje, zamiast zniknąć.
  const host=document.getElementById("devModsHost");
  const panel=host||document.querySelector(".devices-panel");
  const head=panel&&panel.querySelector(host?".head":".devices-h");
  if(!panel||!head||document.getElementById("devModsBtn"))return;
  // Na własnym ekranie macierz JEST treścią, więc stoi otwarta i nie dostaje przycisku zwijania:
  // zwinięta zostawiałaby pustą kartę z jednym przyciskiem, po tym jak się w nią weszło.
  try{_dmOpen=host?true:(localStorage.getItem(DM_LSKEY)==="1");}catch(e){_dmOpen=!!host;}

  if(!host){
    const btn=document.createElement("button");
    btn.type="button"; btn.className="btn sm dm-btn"; btn.id="devModsBtn";
    btn.setAttribute("aria-expanded",_dmOpen?"true":"false");
    btn.setAttribute("aria-controls","devModsBox");
    btn.setAttribute("data-noi18n","");     // composed with _gl(); dmRelang redraws it
    btn.innerHTML='<span class="dm-chev" aria-hidden="true"></span>'+
                  '<span class="dm-btn-lbl">'+_dmEsc(_dmL("Moduły","Modules"))+'</span>';
    btn.title=_dmL("Włącz i wyłącz moduły osobno na każdym kapslu: mapowanie, koło wyboru, mysz i kontroler, MIDI, OSC, usługi sieciowe, dźwięk.",
                   "Switch modules on and off per capsule: mapping, selection wheel, mouse and controller, MIDI, OSC, network services, sound.");
    head.appendChild(btn);                  // after .devices-hint, which owns the margin-left:auto
    btn.addEventListener("click",()=>dmSetOpen(!_dmOpen));
  }

  const wrap=document.createElement("div");
  // Restored open from localStorage arrives at 1fr straight away — both classes at once, no frame
  // in between. A page that slides its own furniture out on load looks like it is still loading.
  wrap.className="dm-wrap"+(_dmOpen?" on open":""); wrap.id="devModsWrap";
  wrap.setAttribute("data-noi18n","");
  const box=document.createElement("div");
  box.className="dm-box"; box.id="devModsBox";
  wrap.appendChild(box);
  // Zaraz pod nagłówkiem: na własnym ekranie („Przegląd") to po prostu treść karty, a w awaryjnym
  // miejscu — pod nagłówkiem z przyciskiem, który ją otwiera, i NAD pigułkami, bo szuflada
  // otwierająca się daleko od klikniętej rzeczy czyta się jak coś innego, co się właśnie pojawiło.
  head.insertAdjacentElement("afterend",wrap);

  // ONE delegated listener for the whole matrix — the table is rebuilt whenever the capsule set
  // changes, and per-cell handlers would have to be re-attached every time.
  const hit=e=>{
    const tg=e.target.closest&&e.target.closest(".dm-tg"); if(!tg)return null;
    const dev=tg.getAttribute("data-dev"), col=tg.getAttribute("data-col");
    if(!dev||!col)return null;
    return {tg,dev,col};
  };
  box.addEventListener("click",e=>{
    const h=hit(e); if(!h)return;
    if(h.dev==="*"){
      const ms=dmMasterState(h.col);
      // all on → switch every one off; mixed or all off → switch every one on. "Mixed means on"
      // is the choice that never surprises: the click that follows a half-lit column is almost
      // always "make the rest match", not "silence the ones that work".
      dmToggleAll(h.col,ms.st!=="on");
    }else{
      dmToggleCell(h.dev,h.col,dmCellOn(h.dev,h.col)!==true);
    }
  });
  box.addEventListener("keydown",e=>{
    if(e.key!=="Enter"&&e.key!==" "&&e.key!=="Spacebar")return;
    const h=hit(e); if(!h)return;
    e.preventDefault(); h.tg.click();
  });

  if(_dmOpen){_dmBuilt=true;dmFetchAll();}
  dmPaint();
}
