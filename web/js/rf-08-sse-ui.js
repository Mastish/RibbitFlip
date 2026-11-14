"use strict";
// ===== SSE intake + sensor UI =====
// Builds the per-axis cards / legends / status-byte grid, opens the /stream EventSource and
// routes every incoming event to its handler. Telemetry is buffered per capsule; the panels
// paint whichever capsule is being VIEWED, while mapping/pad/motion follow the ACTIVE slot.

// ---------- UI construction ----------
// Etykieta `.grp` mówi „oś:", a nie „oś czujnika:": `.grp` jest w kapitalikach 10 px i stoi w jednym
// wierszu z „CHn", więc dłuższa wersja łamała się na trzy-cztery wiersze przy 1280-1440 px i rosła
// wysokość każdej z sześciu kart (119 → 143 px). Karta ma już tytuł „CHn", a po dwukropku stoi
// nazwa osi (gx/ay) — samo „oś:" jest jednoznaczne i mieści się w jednym wierszu.
// WHY: the longer label wrapped to 3-4 uppercase lines and out-shouted the card's own heading.
function buildAxisCards(){
  const el=document.getElementById("axes");el.innerHTML="";
  for(const a of AXES){
    const d=document.createElement("div");d.className="axis";d.id="ax-"+a.k;
    d.innerHTML=`<div class="top"><span class="sw" style="background:${a.color}"></span>
      <span class="nm" style="color:${a.color}">CH${a.ch}</span><span class="grp">${_gl("oś:","axis:")} ${a.re}</span></div>
      <div class="raw num" id="raw-${a.k}">0</div>
      <div class="cv" id="cv-${a.k}"><span class="tag-st" id="tag-${a.k}">—</span> <span id="ms-${a.k}" style="color:var(--dim)"></span></div>
      <div class="meter"><div class="mid"></div><div class="fill" id="bar-${a.k}" style="background:${a.color}"></div></div>`;
    el.appendChild(d);
  }
}
// ---------- legendy przebiegów: duże karty ORAZ miniatura w prawej kolumnie ----------
// JEDEN builder na DWA komplety chipów, bo od 2026-08-29 ten sam przełącznik stoi w dwóch
// miejscach: przy dużej karcie w zakładce Czujnik i pod mini-wykresem w prawej kolumnie.
//
// DLACZEGO CHIP NIE MOŻE JUŻ PAMIĘTAĆ SIEBIE. Poprzednia wersja trzymała stan w domknięciu:
// `chip.onclick=()=>{s.visible=!s.visible; chip.classList.toggle("off",...)}`. Działało, dopóki
// chip był jeden — flaga globalna, klasa lokalna, jedno i drugie zawsze zgodne. Przy dwóch
// kompletach ten skrót kłamie: kliknięty chip miniatury zgasi serię WSZĘDZIE (pętla rysująca
// czyta `SERIES`/`FVIS` co klatkę), ale klasę `.off` zapali tylko sobie — bliźniak na dużej
// karcie dalej będzie wyglądał na włączony przy zgaszonej linii.
//
// Dlatego chip nie pamięta niczego. Nosi klucz serii w `data-lk` (+ rodzaj w `data-lkind`),
// a po kliknięciu przestawia JEDYNE źródło prawdy (`SERIES[k].visible` / `FVIS[k]`) i woła
// `legendSync()`, które PRZEPISUJE klasę wszystkim chipom z tego źródła. Drugiej kopii stanu
// nie ma i nie może być — synchronizacja działa więc w obie strony za darmo, a dołożenie
// trzeciego kompletu legend nie wymaga już niczego poza wywołaniem `fill*Legend`.
function _legClear(el){while(el.firstChild)el.removeChild(el.firstChild);}
// Struktura chipa 1:1 jak dawny `innerHTML`: `<span class="sw">` + goły węzeł tekstowy z etykietą.
// To nie jest kosmetyka — walker i18n tłumaczy napisy filtra po DOKŁADNEJ treści węzła tekstowego
// („Wirowanie"→„Spin"), więc etykieta musi zostać osobnym, nieopakowanym tekstem. Dzięki temu
// legenda miniatury łapie te same klucze co duża karta i nie trzeba było dokładać ani jednego.
function _legChip(k,kind,color,label){
  const chip=document.createElement("span");
  chip.className="chip";chip.dataset.lk=k;chip.dataset.lkind=kind;
  const sw=document.createElement("span");sw.className="sw";sw.style.background=color;
  chip.appendChild(sw);chip.appendChild(document.createTextNode(label));
  chip.onclick=()=>{
    if(kind==="flt")FVIS[k]=!FVIS[k];else SERIES[k].visible=!SERIES[k].visible;
    legendSync();
  };
  return chip;
}
// Jedyne miejsce, które ustawia `.off` — na WSZYSTKICH kompletach naraz, zawsze z flag.
// ⚠️ `root` NIE jest ozdobnikiem. Legenda miniatury powstaje w ODŁĄCZONYM poddrzewie: `build()`
// z rf-34c składa całą siatkę kafli i dopiero ZWRACA ją rf-34b, który ją wiesza. Chipy zbudowane
// w tym oknie są jeszcze poza dokumentem, więc `document.querySelectorAll` ich nie widzi i sync
// po budowie cicho je omija. Objaw jest dokładnie taki, jakiego ta funkcja miała nie dopuścić:
// „Wirowanie" startuje ukryte (`FVIS.spin=false`), duży chip dostaje `.off`, a bliźniak
// w miniaturze wygląda na włączony przy nienarysowanej linii. Dlatego `fill*Legend` synchronizuje
// KONTENER, który właśnie wypełnił, a klik (już w dokumencie) — cały dokument.
function legendSync(root){
  for(const c of (root||document).querySelectorAll("[data-lk]")){
    const k=c.dataset.lk;
    const on=(c.dataset.lkind==="flt")?!!FVIS[k]:!!(SERIES[k]&&SERIES[k].visible);
    c.classList.toggle("off",!on);
  }
}
// Wypełnia DOWOLNY kontener legendą kanałów jednej karty ("accel" = kanały 0-2 / żyroskop,
// "gyro" = kanały 3-5 / akcelerometr — nazwy `scope` są historyczne i odwrócone, patrz rf-02).
function fillChanLegend(el,scope){
  if(!el||typeof AXES==="undefined")return;_legClear(el);
  for(const a of AXES){if(a.scope!==scope)continue;const s=SERIES[a.k];
    el.appendChild(_legChip(a.k,"ser",s.color,s.label));}
  legendSync(el);
}
// To samo dla oscyloskopu „Filtr 3D — osie" (klik = pokaż/ukryj serię). `Wirowanie` startuje
// ukryte (`FVIS.spin=false` w rf-10) — `legendSync()` odda to klasą `.off` od pierwszej klatki,
// w każdym komplecie legend, bez osobnego kodu startowego.
function fillFilterLegend(el){
  if(!el||typeof FSCOPE==="undefined")return;_legClear(el);
  for(const s of FSCOPE)el.appendChild(_legChip(s.k,"flt",FCOLOR[s.k],s.label));
  legendSync(el);
}
function buildLegends(){
  fillChanLegend(document.getElementById("legAccel"),"accel");
  fillChanLegend(document.getElementById("legGyro"),"gyro");
}
function buildFilterLegend(){fillFilterLegend(document.getElementById("legFilter"));}
function buildStatusBytes(){
  const el=document.getElementById("stBytes");el.innerHTML="";
  for(let i=0;i<5;i++){
    const d=document.createElement("div");d.className="byte";d.id="byte-"+i;
    d.innerHTML=`<div class="bi">B${i}</div><div class="hx" id="bhx-${i}">··</div>
      <div class="dec" id="bdec-${i}">—</div>
      <div class="bits">${Array.from({length:8},(_,b)=>`<span class="bit" id="bit-${i}-${7-b}"></span>`).join("")}</div>`;
    el.appendChild(d);
  }
}

// ---------- SSE ----------
let es;
function connect(){
  // NO ?dev -> server sends high-freq telemetry (s/mouse) for ALL slots, tagged with 'dev'.
  // We buffer per-capsule so the Sensor/Connection tabs can show any capsule (viewDev),
  // independent of the global active slot. (Backend: _raw_dev()=None => everything.)
  es=new EventSource("/stream");
  es.onopen=()=>{setConn("scan","łączę ze strumieniem…");rfOfflineSet(false);};
  es.onerror=()=>{state.scanning=true;setConn("off","serwer offline — wznawiam…");rfOfflineSoon();};   // offline -> loading animation
  es.onmessage=e=>{rfOfflineSet(false);let m;try{m=JSON.parse(e.data);}catch{return;}routeEvent(m);};
}
// APLIKACJA NIE ODPOWIADA (UX 261120, F-G0-02). Zamknięta z zasobnika przy otwartej karcie zostawiała
// panel, który wyglądał na żywy: plakietka połączenia jest w symulacji schowana, a „Uzbrojone”
// świeciło dalej. Po ok. 3 s bez strumienia pod paskiem staje komunikat z `rfNeedHtml` (brakuje
// rzeczy spoza panelu: działającej aplikacji), a główny przełącznik gaśnie z napisem, dlaczego.
// Próg 3 s jest po to, żeby pasek nie mignął przy zwykłym przeładowaniu strony albo restarcie
// po przełączeniu LIVE/Symulacja. Znika sam przy pierwszej wiadomości ze strumienia.
// WHY: a 3 s grace period, cleared by the first message, so a reload never flashes the bar.
let _rfOffTmr=0,_rfOff=false;
function rfOfflineSoon(){
  if(_rfOff||_rfOffTmr)return;
  _rfOffTmr=setTimeout(()=>{_rfOffTmr=0;if(!es||es.readyState!==1)rfOfflineSet(true);},3000);
}
function rfOfflineSet(on){
  if(!on){clearTimeout(_rfOffTmr);_rfOffTmr=0;}
  if(on===_rfOff)return;
  _rfOff=on;
  let bar=document.getElementById("rfOffline");
  if(on&&!bar){
    const hd=document.querySelector("header");
    if(!hd||typeof rfNeedHtml!=="function")return;
    bar=document.createElement("div");bar.id="rfOffline";bar.className="rf-need block rf-offline";
    bar.setAttribute("role","alert");
    bar.innerHTML=rfNeedHtml({titleHtml:"RibbitFlip nie odpowiada.",
      whyHtml:"Uruchom aplikację ponownie z pliku RibbitFlip.exe albo z ikony przy zegarze."});
    hd.parentNode.insertBefore(bar,hd.nextSibling);
    if(typeof applyLang==="function")try{applyLang(bar);}catch(e){}
  }
  if(bar)bar.hidden=!on;
  const a=document.getElementById("armBtn");
  if(a){
    a.disabled=on;
    if(on){a.textContent="⏻ Brak połączenia z aplikacją";a.classList.remove("on");
      if(typeof applyLang==="function")try{applyLang(a);}catch(e){}}
    else if(typeof setArmed==="function")setArmed(!!state.armed,true);   // napis i kolor wracają z prawdziwego stanu
  }
}
// Multi-device router: global events (cfg/master) -> global handlers; the rest tagged
//  with the 'dev' field. We track rules/triggers for ALL slots (selector + cheat sheet);
//  full telemetry (scopes/readouts/feed/mouse/power) only for the ACTIVE slot.
function routeEvent(m){
  const t=m.t;
  if(m.ts&&m.ts>state.clockNow)state.clockNow=m.ts;   // clock shared by all slots
  // WHICH RUN IS TALKING. The first `cfg` of every stream carries the server's boot id; a page
  // written by another run holds a token that run will refuse, so it reloads (rf-05) instead of
  // going on to look alive while nothing it does sticks.
  if(t==="cfg"){
    if(m.boot&&window.RIBBITFLIP_BOOT&&m.boot!==window.RIBBITFLIP_BOOT&&typeof rfStaleReload==="function"){rfStaleReload("boot");return;}
    return onConfig(m);
  }
  if(t==="master")return onMaster(m);
  // Emergency stop — global by definition (every capsule at once) and often triggered from
  // OUTSIDE this page, by the system-wide hotkey, so the panel has to be told rather than
  // left to infer it from the capsules going quiet one devmeta at a time.
  if(t==="panic"){if(typeof rfOnPanic==="function")rfOnPanic(m);return;}
  // Asystent AI (MCP) właśnie coś zmienił. Człowiek ma to ZOBACZYĆ, a nie odkryć po fakcie
  // (rf-39c-mcp-ui.js, `rfOnMcpAction`).
  if(t==="mcp_action"){if(typeof rfOnMcpAction==="function")rfOnMcpAction(m);return;}
  // Emergency-hotkey settings changed (possibly in another window). Global, and the reminder
  // shown when an output group goes on quotes the combination, so a stale copy misinforms.
  if(t==="hotkey"){if(typeof rfOnHotkeyCfg==="function")rfOnHotkeyCfg(m);return;}
  // Okno skanera nad pulpitem zostało zamknięte SPOZA panelu — skrótem Shift+R+F (rf-39j
  // `rfScanHotkeyKeys`, serwer: `scan_overlay_stop`). Globalne jak stop awaryjny i z tego samego
  // powodu: człowiek jest wtedy w grze, a nie w panelu, więc karta musi zostać POWIADOMIONA.
  // Bez tego segment „Gdzie jest skaner" stałby na „Na pulpicie" do najbliższego odpytania (5 s)
  // i przez ten czas pokazywałby okno, którego już nie ma.
  if(t==="scan_okno"){if(typeof rfOnScanOkno==="function")rfOnScanOkno(m);return;}
  // ZRZUT PLANSZY ZROBIONY SKRÓTEM (Alt+R+1…9, serwer: `scan_zrzut_skrotem`). Łapany TUTAJ, nad
  // linią, w której z wiadomości wygrzebuje się kapsel: zdarzenie NIESIE własne `dev`, a handler
  // sam porównuje je z oglądanym kapslem i mówi, gdzie plansza wylądowała. Globalne z tego samego
  // powodu co `scan_okno` — skrót naciska się spod gry, więc panel musi zostać POWIADOMIONY,
  // zamiast czekać, aż ktoś do niego wróci i odświeży kartę ręcznie.
  // ⚠️ To nie jest `scan_cfg`: tamto leci przy każdym zapisie pokrętła i przerysowanie karty
  // z niego cofałoby suwaki pod palcem. Karta ma własne zdarzenie i tylko to jedno.
  if(t==="scan_zrzut"){if(typeof rfOnScanZrzut==="function")rfOnScanZrzut(m);return;}
  // KLIKNIĘCIE W POWIADOMIENIE SYSTEMOWE (serwer: `notify_goto`). Też nad linią z kapslem: `dev`
  // w tym zdarzeniu mówi, NA KTÓRY kapsel przejść, a nie od którego przyszło (rf-39q).
  if(t==="goto"){if(typeof rfNotifyGoto==="function")rfNotifyGoto(m);return;}
  // Ustawienia tego skrótu zmieniły się (możliwe, że w drugim oknie panelu). Osobno od `hotkey`,
  // żeby nie przerysowywać karty „Stop awaryjny" cudzym stanem (patrz `rfOnHotkeyCfg`).
  if(t==="hotkey_zrzut"){if(typeof rfOnHotkeyZrzut==="function")rfOnHotkeyZrzut(m);return;}
  // The virtual controllers changed (added, renamed, removed, or a capsule plugged into another
  // one). Global — a pad belongs to the machine, not to a capsule — and it arrives here rather
  // than being inferred from each capsule's mouse_cfg, because an EMPTY controller has no capsule
  // to arrive with and would otherwise be invisible until something was plugged into it.
  if(t==="pads"){if(typeof onPads==="function")onPads(m);return;}
  // Nazwane urządzenia OSC — dodane, przemianowane, przeniesione pod inny adres albo usunięte.
  // Globalne dokładnie tak jak kontrolery: urządzenie należy do maszyny, nie do kapsla, a puste
  // (takie, do którego nic jeszcze nie mówi) nie ma z czym przyjechać i byłoby niewidoczne.
  if(t==="osctargets"){if(typeof onOscTargets==="function")onOscTargets(m);return;}
  // A game came to the front and the app either loaded its set or found more than one and wants
  // to be told which. Global by definition — a window is in front of the whole machine, not of
  // one capsule — so it has to be caught HERE, above the line where a device id is dug out of
  // the message. Below it, an event with no 'dev' would be filed under d0 and never delivered.
  if(t==="game"){if(typeof onGameSwitch==="function")onGameSwitch(m);return;}
  const dev=m.dev||((typeof devKnownId==="function"&&devKnownId(state.activeDeviceId))||"d0");
  if(t==="devgone"){onDevGone(dev);return;}   // slot removed (cancel pairing / forget device)
  // Only `devmeta` may introduce a slot to the panel. Any other event about an id the panel does
  // not know is a leftover of a slot just forgotten (its loop could still say "scanning" once on
  // the way out) — an entry made for it resurrected the pill as a ghost the server never had, and
  // "remove" on that ghost could only ever answer "cannot remove the last device".
  if(t!=="devmeta"&&!state.devices[dev])return;
  const D=devEntry(dev);
  const activeNow=(dev===state.activeDeviceId);
  if(t==="devmeta"){onDevMeta(m,D);return;}
  // Przód kapsla zmieniony (panel, inne okno nakładki) — kropla i jej ustawienia w obu miejscach (rf-41e).
  if(t==="front"){if(typeof frontOnEvent==="function")frontOnEvent(dev,m);return;}
  // Recorded gestures (rf-12d): a verdict on a movement (`gest`), recording progress (`grec`) or
  // one point of the recorder's live picture (`gene` — motion energy + the segmenter's state,
  // ~25/s while a gesture editor is open, and nothing at all when none is).
  // Per capsule, like `trig`; only the active capsule's are drawn, the module decides.
  if(t==="gest"||t==="grec"||t==="gene"){if(typeof gestOnEvent==="function")try{gestOnEvent(dev,m);}catch(e){console.error("[gest]",e);}return;}
  if(t==="rules"){
    D.rules=Array.isArray(m.rules)?m.rules:[];
    // The Mapping group switch of THIS capsule — kept per slot for the warning strip in the
    // Kontroler tab (rf-43 padOffNoteSync): a pad shared by two capsules can have one of them
    // muted, and the strip has to name which.
    if(typeof m.enabled==="boolean")D.trigEnabled=m.enabled;
    if(m.activeLayer!=null)D.activeLayer=+m.activeLayer||1;   // per capsule, mirrored for the switch
    // …and the NAME this set carries. It travels with the rules for the same reason the layer does:
    // read a beat later, the bar would name the previous capsule's configuration.
    if(m.configName!=null)D.cfgName=String(m.configName||"");
    {const ids=new Set(D.rules.map(r=>r.id));   // drop buffers belonging to deleted rules
      if(D.condBuf)for(const k of Object.keys(D.condBuf))if(!ids.has(k))delete D.condBuf[k];
      if(D.valBuf)for(const k of Object.keys(D.valBuf))if(!ids.has(k))delete D.valBuf[k];}
    // PODMIANA CAŁEJ TABLICY, nie jej zawartości — każdy widok, który zamknął w domknięciu obiekt
    // reguły, trzyma od tej chwili sierotę. Sekcja wyzwalaczy skanera szuka reguł po `id` właśnie
    // dlatego, a tu dostaje sygnał, żeby odświeżyć to, co narysowane.
    if(activeNow){state.rules=D.rules;onRules(m);
      if(typeof scanSignalsOnRules==="function")try{scanSignalsOnRules();}catch(e){}}
    renderOverview();
    // Osobno od onRules, bo tamto milczy w trakcie edycji reguły (state.editing) — a nazwa
    // i „zmienione" mają być prawdziwe także wtedy.
    if(typeof trigCfgSync==="function")trigCfgSync();
    return;
  }
  if(t==="trig"){
    const nowT=m.ts;
    // The active mapping layer rides along with the rule states, because it decides WHICH of them
    // count — read a beat later, the list would dim the wrong rows for a frame.
    if(m.activeLayer!=null)D.activeLayer=+m.activeLayer||1;
    for(const it of (m.st||[])){
      const id=it[0],over=!!it[1],prev=D.rt[id];
      // CSV: record the MOMENT a rule flips or fires, not every message. The server re-sends the
      // full state on a timer, so logging all of it would bury one button press under a wall of
      // identical rows. The first sighting of a rule is kept as a baseline (it names the rule ids).
      if(state.recording&&recWants("trig")&&(dev===state.viewDev||recWants("alldev"))
         &&(!prev||!!prev.active!==over||prev.fires!==it[2]))
        recPush({ts:nowT.toFixed(4),type:"trig",dev:dev,rule:id,over:over?1:0,fires:it[2]});
      D.rt[id]={active:it[1],fires:it[2],conds:it[3]||[],
                overSince:(over?((prev&&prev.overSince)||nowT):0)};   // when it started being active (dwell/continuous)
    }
    if(activeNow){if(state.rt!==D.rt)state.rt=D.rt;onTrig(m);}
    overviewTrig(dev,m);
    return;
  }
  if(t==="tf"){
    if(activeNow)onTrigFire(m);
    overviewFire(dev,m);
    if(typeof rfKofiNudge==="function")try{rfKofiNudge();}catch(e){}              // ☕ mug rocks once
    if(typeof restOnTrigFire==="function")try{restOnTrigFire(dev,m);}catch(e){}   // 🌐 REST API
    return;
  }
  if(t==="virt"){   // manual control of the simulated capsule switched on/off (per slot)
    D.virt=!!m.on;
    if(dev===(state.viewDev||state.activeDeviceId||"d0")&&typeof vpOnServerState==="function")vpOnServerState(D.virt);
    renderDeviceSelector();   // the capsule pill says which one a hand is on
    return;
  }
  if(t==="seqp"){   // multi-count progress -- per-device (countdown in the cheat sheet for ALL slots)
    const sp={}; for(const p of (m.prog||[]))sp[p[0]]=[p[1],p[2],p[3]]; D.seqProg=sp;
    if(activeNow){state.seqProg=sp;onSeqProgress(m);}
    return;
  }
  if(t==="pv"){   // pose (3D per controller) + condition values + motion snapshot -- per slot, ~12 Hz
    if(m.pose)D.poseLive=m.pose;
    // Hidden tab: rAF is paused and timers are throttled, so drive the XY pad (notes + effects)
    // straight off the incoming pose packets — a background capsule keeps playing in time.
    if(m.pose){if(document.hidden){if(typeof padTick==="function")padTick();if(typeof fxTick==="function")fxTick();}
      else if(typeof _padMotionArmed==="function"&&_padMotionArmed())_padWake();}   // visible + motion-armed: wake the rAF loop instead
    if(m.mouse)D.mouseLive=m.mouse;
    if(m.vals){
      D.valBuf=D.valBuf||{};
      const now=m.ts;
      for(const rid in m.vals){
        const buf=D.valBuf[rid]||(D.valBuf[rid]=[]);
        buf.push([now, m.vals[rid]]);
        const lo=now-8; let i=0; while(i<buf.length&&buf[i][0]<lo)i++; if(i)buf.splice(0,i);
      }
    }
    if(typeof restOnPose==="function")try{restOnPose(dev,m);}catch(e){}           // 🌐 REST API
    return;
  }
  if(t==="st"&&m.conn){const ch=(D.conn!==m.conn);D.conn=m.conn;
    D.scanning=!(m.conn==="connected"||m.conn==="sim"); D.parked=(m.conn==="parked");
    if(ch){renderDeviceSelector();renderOverview();}
    // pairing: when the target slot flips to connected/simulation -> pairing-screen success
    if(dev===_pairTarget&&(m.conn==="connected"||m.conn==="sim"))pairSucceeded();}
  // Sensor telemetry (scopes/pose/status-bytes): buffered PER CAPSULE for every slot.
  if(t==="s"){onSample(m);return;}
  if(t==="b"){onStatusPkt(m);return;}
  // Connection info (low-freq, already broadcast for all slots): store per capsule,
  //  paint the Sensor/Connection tabs only for the VIEWED capsule (handlers gate internally).
  // The capsule's light changed (a rule's flash, a macro, "which one is this", a hand-typed hex).
  // Kept for EVERY slot, before the active-capsule gate: switching capsules must not lose the badge.
  if(t==="led"){D.led={on:!!m.on,sim:!!m.sim,ts:(m.ts||state.clockNow||0),at:(typeof performance!=="undefined"?performance.now():Date.now())};return;}
  if(t==="st"){onStatus(m);return;}
  if(t==="dev"){onDev(m);return;}
  if(t==="stats"){onStats(m);return;}
  if(t==="power"){onPower(m);return;}
  // WHOSE controller this capsule drives — kept for EVERY slot, before the gate below, for the
  // same reason the LED is: the pad drawing is painted for all capsules at once and has to
  // number them correctly, while `mouse_cfg` for a capsule that is not active would be dropped.
  if(t==="mouse_cfg"&&m.padShare!==undefined)D.padShare=m.padShare;
  // KONFIGURACJA RUCHU I ZESTAW MIDI/OSC KAŻDEGO KAPSLA — kept for EVERY slot, above the
  // active-capsule gate, i z tego samego powodu, co koło wyżej: hub konfiguracji (rf-49i) rysuje
  // chip KAŻDEGO kapsla i przy każdym z osobna stawia kropkę „zmienione", a ta jest porównaniem
  // ustawień TAMTEGO kapsla z presetem. Bez tej linijki jedynym źródłem cudzych ustawień byłby
  // wolny GET co kilka sekund (rf-49c/rf-49d) — czyli kropka gasłaby i zapalała się z opóźnieniem,
  // którego nikt by nie umiał wytłumaczyć. Dla kapsla EDYTOWANEGO nie ruszamy nic: jego kopię
  // trzyma już `onMouseCfg` (świeższą, bo scaloną z tym, co panel właśnie wysłał).
  if((t==="mouse_cfg"||t==="midi_cfg")&&!activeNow){
    const K=(t==="mouse_cfg")?"mouseCfg":"midiCfg";
    D[K]=Object.assign({},D[K]||{},m);
    return;
  }
  // KOŁO WYBORU — kept for EVERY slot, above the active-capsule gate, for the same reason the
  // LED and the pad are: the cheat sheet draws all capsules at once, and a wheel opened on the
  // capsule you are NOT editing still has to appear in its column (and in its overlay window).
  if(t==="wheel"){D.wheelLive=m;return;}
  // SKANER — sygnał („teraz"), a nie stan. Też ponad bramką aktywnego kapsla i z mocniejszego
  // powodu niż koło: to jest NACIŚNIĘCIE PRZEŁĄCZNIKA przez człowieka, który może nie mieć innej
  // drogi do komputera. Zgubienie go dlatego, że akurat edytowany jest inny kapsel, byłoby
  // zgubieniem jedynego wejścia. Odbiera skaner — w karcie albo w oknie nad pulpitem.
  if(t==="scan"){if(typeof scanSignalArrived==="function")scanSignalArrived(m);return;}
  // KONFIGURACJA KOŁA — też dla KAŻDEGO kapsla, i z tego samego powodu: ściąga rysuje spis wycinków
  // wszystkich naraz, a karta ustawień pobiera tylko ten kapsel, który jest edytowany. Bez tego
  // kolumna kapsla, którego nikt nie edytuje, nie miałaby skąd wziąć jego koła.
  if(t==="wheel_cfg"){if(typeof wheelCfgArrived==="function")wheelCfgArrived(D,m);else D.wheelCfg=m;return;}
  // Everything else (mapping/motion/midi/pad/macros) follows the global ACTIVE capsule.
  // …the same switch when it is flipped later, for every slot (the active one goes on to
  // onTrigEnable below, which drives the two toggles).
  if(t==="trigen"&&typeof m.enabled==="boolean"){D.trigEnabled=m.enabled;
    if(typeof padOffNoteSync==="function")try{padOffNoteSync();}catch(e){}}
  if(!activeNow)return;
  ({seqc:onSeqCount,seqm:onSeqMacro,
    mouse:onMouse,mouse_cfg:onMouseCfg,cmd:onCmd,
    midi_cfg:onMidiCfg,mo:onMidiOut,trigen:onTrigEnable}[t]||(()=>{}))(m);
}
// GŁÓWNY PRZEŁĄCZNIK WYJŚCIA znowu ma odbiorcę. Zdarzenie było ignorowane („każda grupa ma własny
// przełącznik"), a razem z nim zniknął przycisk #armBtn, więc rozbrojonej aplikacji NIE BYŁO CZYM
// uzbroić z powrotem inaczej niż restartem. (Stop awaryjny tej bramy nie rusza: `panic_stop`
// wyłącza przełączniki modułów, a ⏻ zostaje uzbrojony.) Serwer trzyma tę bramę cały czas (`DeviceManager.master_armed`,
// `POST /arm`), tylko panel przestał o niej mówić. `fromServer` = nie odsyłaj tego, co właśnie
// przyszło; ta sama umowa co przy każdym innym echu ze strumienia.
function onMaster(m){ if(m&&m.armed!=null&&typeof setArmed==="function")setArmed(!!m.armed,true); }
function onDevMeta(m,D){
  D.meta={dev:m.dev,slot:(m.slot!=null?m.slot:D.meta.slot),name:m.name||m.dev,
          color:m.color||D.meta.color,
          // Keep the avatar we already know, exactly like name/colour/slot above. A devmeta that
          // arrives without `cap` used to blank it: the capsule vanished from the editor (an empty
          // glow where the picture belongs) and _ensureCap then quietly handed the slot a DIFFERENT
          // random cap — the same capsule changing its face behind the user's back.
          label:m.label||"",cap:m.cap||(D.meta&&D.meta.cap)||"",muted:!!m.muted,
          // Two separate switches: `muted` = the app's sound, `paused` = every output of this
          // capsule. They arrive together in one devmeta so a second tab can never show one of them
          // stale (that was the bug when a single flag pretended to do both jobs).
          paused:!!m.paused,
          // The idle hold, set by the capsule itself and NOT by the user. Carried separately from
          // `paused` for the same reason it is separate on the server: the pill has to be able to
          // say WHY a capsule went quiet, and the „Moduły" matrix must not draw the hand-set
          // switch as flipped because the capsule was put down for a minute.
          autoPaused:!!m.autoPaused,
          bound:(m.bound!=null?!!m.bound:!!(D.meta&&D.meta.bound))};
  // CONFIRMED BY THE SERVER. devEntry() creates an entry for whatever id it is handed, so this
  // flag is the only thing that tells a slot the app really has from one the panel guessed at
  // boot (state.activeDeviceId before the first devmeta) and then filled with the answers to its
  // own questions. Without the difference a guess draws a pill for a capsule nobody paired.
  D.known=true;
  _ensureCap(m.dev);          // give a fresh slot a random (unused) bottle-cap avatar
  // …and if the panel IS sitting on a guess, this is the moment to move off it. The id normally
  // comes injected and is right (rf-02 RF_BOOT_DEV); it can still be stale — a capsule forgotten
  // in another window, a page opened straight off disk — and then every per-capsule request goes
  // to a slot that does not exist. switchDevice() re-reads motion/MIDI/3D for the real one.
  if(!(state.devices[state.activeDeviceId]||{}).known){
    for(const k of Object.keys(state.devices))if(!state.devices[k].known)delete state.devices[k];
    if(typeof switchDevice==="function")switchDevice(m.dev);
    else{state.activeDeviceId=m.dev;state.viewDev=m.dev;}
  }
  if(typeof rfReportActiveDev==="function")rfReportActiveDev(state.activeDeviceId);   // the capsule a game setup lands on
  renderDeviceSelector();
  renderOverview();
  // Mute can also arrive from elsewhere (another tab, the tray) — the pad's capsule ticks mirror it.
  if(typeof padCapsSyncMuted==="function")padCapsSyncMuted();
}
// Which caps are already taken by OTHER capsules (so we don't repeat them).
function _capUsed(exceptId){
  const used=new Set();
  for(const k in state.devices){if(k===exceptId)continue;const c=state.devices[k].meta&&state.devices[k].meta.cap;if(c)used.add(c);}
  return used;
}
// Assign a random UNUSED cap to a capsule that has none, and persist it server-side.
function _ensureCap(id){
  const D=state.devices[id]; if(!D||(D.meta&&D.meta.cap)||D._capAssigning)return;
  const used=_capUsed(id);
  let pool=CAP_IDS.filter(c=>!used.has(c));
  if(!pool.length)pool=CAP_IDS.slice();   // more capsules than caps → repeats become unavoidable
  const cap=pool[Math.floor(Math.random()*pool.length)];
  D._capAssigning=true; D.meta.cap=cap;
  fetch("/device?dev="+encodeURIComponent(id),{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({cap})}).finally(()=>{D._capAssigning=false;});
}
// STOPKA „parametry: …". Wyniesiona z `onConfig`, bo mówi teraz także o GŁÓWNYM PRZEŁĄCZNIKU
// WYJŚCIA, a ten zmienia się bez żadnego `cfg` — po kliknięciu ⏻ w nagłówku, po `POST /arm`
// albo po zdarzeniu `master` z drugiego okna. Zdanie budowane w jednym miejscu, żeby stopka i
// przycisk nie mogły powiedzieć czegoś innego o tym samym.
function rfCfgLineSync(){
  const el=document.getElementById("cfgLine"); if(!el)return;
  const c=state.cfg;
  el.innerHTML=
    `tryb <b>${c.simulate?"symulacja":"LIVE (realny Triki)"}</b> · `+
    // Simulation sends for real too — the line used to say "bez wysyłki", which stopped being true.
    `sterowanie klawiaturą/myszą <b>${c.sendKeys?"WŁĄCZONE":"podgląd (--no-keys)"}</b>`+
    // Główny przełącznik zamyka linijkę, bo unieważnia wszystko, co przed nim.
    (state.armed?"":` · <b class="cfg-off">wyjście wstrzymane</b>`)+
    // „mapowania ustawiasz w „Mapowanie"" STĄD ZNIKŁO (2026-09-04): stopka mówiła, w której
    // zakładce są mapowania, a ta zakładka stoi w nawigacji obok, pod własną nazwą.
    // The version belongs where someone reporting a problem will actually look. `data-noi18n`
    // because "RibbitFlip 1.0.0" is a name and a number, not a sentence to translate.
    // Separator W OSOBNYM WĘŹLE. Doklejony do zdania obok robił z niego „… w „Mapowanie" ·",
    // czyli klucz, którego w słowniku nie ma — i cała ta część linijki zostawała po polsku
    // w trybie angielskim, mimo pary „· mapowania ustawiasz w „Mapowanie"". Teraz zdanie jest
    // całym węzłem, a kropka stoi obok niego.
    (window.RIBBITFLIP_VERSION?`<span data-noi18n> · </span><span class="cfg-ver" data-noi18n>RibbitFlip ${miEsc(window.RIBBITFLIP_VERSION)}</span>`:"");
  if(typeof applyLang==="function")try{applyLang(el);}catch(e){}
}
function onConfig(m){Object.assign(state.cfg,m);
  if(typeof miApplyAvail==="function")miApplyAvail();   // show/hide the MIDI toggle + tab per the --no-midi flag
  // The mode switch mirrors simulate/LIVE; in simulation the connection badge is hidden so the
  // same information is not shown twice.
  const mt=document.getElementById("modeToggle");
  if(mt&&!mt.classList.contains("busy"))mt.setAttribute("aria-checked",m.simulate?"true":"false");
  const cb=document.getElementById("connBadge");
  if(cb)cb.style.display=m.simulate?"none":"";
  rfCfgLineSync();
  updateKeysNote();
  if(typeof mUpdateNote==="function")mUpdateNote();   // mouse mode depends on simulate/sendKeys
  if(typeof vpUpdateUi==="function")vpUpdateUi();     // manual control is offered in simulation only
  // `state.cfg`, nie samo `m`: zdarzenie niesie tylko to, co się zmieniło, a ta funkcja pyta
  // o CAŁĄ konfigurację (`simulate` bywa w innym pakiecie niż `sendKeys`). Zmienna wróciła tu po
  // tym, jak zdanie stopki wyjechało do `rfCfgLineSync` i zabrało ze sobą dawne `const c`.
  const c=state.cfg;
  if(typeof rfSimStartup==="function")rfSimStartup(c); // simulation: silence the pads too (server already did its groups)
}
function onStatus(m){
  if(!m.conn)return;
  const D=devEntry(m.dev||state.activeDeviceId||"d0");
  // "searching" = any state other than a real stream (connected/sim) -> loading animation
  D.scanning=!(m.conn==="connected"||m.conn==="sim");
  D.parked=(m.conn==="parked");   // asleep (connected, battery saving) — different message than "searching"
  D._connMsg=m.msg||"";
  // ANNOUNCE the change for EVERY slot, before the "viewed capsule" gate below. With four capsules
  // the one that just connected is usually not the one on screen, and the ring on its pill is easy
  // to miss — so the answer to "did it connect?" is said out loud, naming the capsule.
  devAnnounceConn(D,m.conn);
  if(m.dev&&m.dev!==state.viewDev)return;   // paint the badge/status only for the VIEWED capsule
  state.scanning=D.scanning; state.parked=D.parked;
  if(m.conn==="connected"||m.conn==="sim")setConn("live",m.msg||(m.conn==="sim"?"symulacja":"połączono"));
  else if(m.conn==="parked")setConn("scan",m.msg||"uśpiony");
  else if(m.conn==="scanning"||m.conn==="init")setConn("scan",m.msg||"szukam…");
  else setConn("off",m.msg||"rozłączono");
  const ds=document.getElementById("dStatus"); if(ds)ds.textContent=
    ({connected:"● Połączono",sim:"● Symulacja",parked:"Uśpiony",scanning:"○ Szukam…",disconnected:"○ Rozłączono",init:"○ Start"}[m.conn]||m.conn);
  if(m.conn==="connected"&&!D._wasConnected)celebrateConnect();
  D._wasConnected=(m.conn==="connected");
  if(typeof vpSrcPill==="function")vpSrcPill();   // "where the movement comes from" follows the connection
}
// ---- device-connected celebration: checks_out waves + felt-particle burst ----
function celebrateConnect(){
  if(document.getElementById("rfConnCelebrate"))return;
  const ov=document.createElement("div");ov.id="rfConnCelebrate";ov.className="rf-celebrate";
  ov.innerHTML='<canvas class="rf-cel-cvs"></canvas><div class="rf-cel-card">'+
    '<span class="rf-cel-ic" role="img" aria-label="OK"></span>'+
    '<span class="rf-cel-msg">'+_gl("Połączono urządzenie","Device connected")+'</span></div>';
  document.body.appendChild(ov);
  try{_celParticles(ov.querySelector(".rf-cel-cvs"));}catch(e){}
  setTimeout(()=>{const o=document.getElementById("rfConnCelebrate");if(o)o.classList.add("rf-cel-out");},2100);
  setTimeout(()=>{const o=document.getElementById("rfConnCelebrate");if(o)o.remove();},2520);
}
function _celParticles(cvs){
  if(_prefersReducedMotion())return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const W=cvs.width=Math.round(window.innerWidth*dpr),H=cvs.height=Math.round(window.innerHeight*dpr);
  cvs.style.width=window.innerWidth+"px";cvs.style.height=window.innerHeight+"px";
  const g=cvs.getContext("2d"),cx=W/2,cy=H/2-24*dpr;
  const cols=["#6cb33f","#ec1a83","#eaa32b","#faf6ee","#46781f","#a4105c","#a6d861"];
  const P=[];for(let i=0;i<52;i++){const a=Math.random()*Math.PI*2,sp=(4.5+Math.random()*7)*dpr;
    P.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-3.5*dpr,s:(3+Math.random()*4)*dpr,
      rot:Math.random()*6,vr:(Math.random()-0.5)*0.5,col:cols[i%cols.length]});}
  const t0=performance.now();
  (function step(now){const el=(now-t0)/1000;g.clearRect(0,0,W,H);let alive=false;
    for(const p of P){const life=Math.max(0,1-el/1.25);if(life<=0)continue;alive=true;
      p.vy+=0.30*dpr;p.vx*=0.986;p.vy*=0.986;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;
      g.save();g.globalAlpha=life;g.translate(p.x,p.y);g.rotate(p.rot);g.fillStyle=p.col;
      g.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.72);g.restore();}
    if(alive&&document.getElementById("rfConnCelebrate"))requestAnimationFrame(step);})(t0);
}
function setConn(kind,txt){const b=document.getElementById("connBadge");
  state.connKind=kind;   // remembered for the 3D "connection lost" placeholder
  b.className="badge "+(kind==="live"?"live":kind==="scan"?"scan":"off");
  document.getElementById("connText").textContent=txt;
  document.getElementById("connHint").textContent=txt;}

function onDev(m){
  const D=devEntry(m.dev||state.activeDeviceId||"d0"); D.devInfo=m;
  if(m.dev&&m.dev!==state.viewDev)return;   // device panel shows the VIEWED capsule
  state.dev=m;
  document.getElementById("dName").textContent=m.name||"—";
  document.getElementById("dAddr").textContent=m.address||"—";
  document.getElementById("dMtu").textContent=m.mtu!=null?m.mtu:"—";
  // RSSI -> bars
  const r=m.rssi;const rb=document.getElementById("dRssi");
  if(r==null){rb.innerHTML="—";}
  else{const n=r>=-55?4:r>=-65?3:r>=-72?2:r>=-82?1:0;
    rb.innerHTML=`<span class="bars">${[6,9,12,15].map((h,i)=>`<i class="${i<n?'on':''}" style="height:${h}px"></i>`).join("")}</span><small>${r} dBm</small>`;}
  // battery
  const bb=document.getElementById("dBatt");
  if(m.battery==null)bb.innerHTML="—";
  else{const col=m.battery<20?cv('--bad'):m.battery<50?cv('--warn'):cv('--ok');
    bb.innerHTML=`<span class="batt"><span class="shell"><span class="lvl" style="width:${m.battery}%;background:${col}"></span></span></span><small>${m.battery}%</small>`;}
}
function onStats(m){
  const D=devEntry(m.dev||state.activeDeviceId||"d0"); D.stats=m;
  if(m.dev&&m.dev!==state.viewDev)return;   // stats panel shows the VIEWED capsule
  state.stats=m;
  document.getElementById("sHz").textContent=m.hz;
  document.getElementById("sBps").textContent=m.bps;
  document.getElementById("sImu").textContent=m.imu;
  document.getElementById("sStat").textContent=m.status;
  document.getElementById("sUnk").textContent=m.unknown;
  document.getElementById("sUp").textContent=(m.uptime||0).toFixed(0)+"s";
}

function onSample(m){
  const dev=m.dev||state.activeDeviceId||"d0";
  const D=devEntry(dev), ts=m.ts, B=D.buf, lo=ts-MAXKEEP;
  const isActive=(dev===state.activeDeviceId), isView=(dev===state.viewDev);
  D.nowTs=ts;
  B.ax.push([ts,m.a[0]]);B.ay.push([ts,m.a[1]]);B.az.push([ts,m.a[2]]);
  B.gx.push([ts,m.g[0]]);B.gy.push([ts,m.g[1]]);B.gz.push([ts,m.g[2]]);
  D.last={ax:m.a[0],ay:m.a[1],az:m.a[2],gx:m.g[0],gy:m.g[1],gz:m.g[2]};
  if(m.raw)D.lastRaw=m.raw;
  // "Which capsule is which?" — give it a shake and its pill answers (rf-11b). pose.spin is the
  // calibrated |gyro| the server already computes, so this costs one comparison per sample.
  if(m.pose&&typeof devActivityPing==="function")devActivityPing(dev,m.pose.spin);
  // output of the server-side orientation filter — feeds the "Filter" trigger source + its preview
  if(m.pose){
    D.pose=m.pose;
    const pb=D.poseBuf, _pre=m.pose.pre;
    // [ts, reported value, value BEFORE this axis's smoothing]. The third slot is what lets the
    // axis-tuning panel draw the smoothing as the gap between two lines; every older reader takes
    // [1] and is unaffected.
    // `spin` rides along even though it has no tuning chain (hence no `pre` line for it): a rule
    // can use it as a condition, and a condition the panel cannot DRAW is a threshold set blind.
    for(const k of ["tilt","twist","pitch","roll","spin"]){const a=pb[k];if(!a)continue;
      a.push([ts,m.pose[k],_pre?_pre[k]:undefined]);
      let i=0;while(i<a.length&&a[i][0]<lo)i++;if(i)a.splice(0,i);}
  }
  // Raw channels AFTER their tuning chain. Sent only while at least one channel is tuned, so the
  // absent key means "nothing is shaped" and every reader falls back to the raw value. Buffer entry
  // is [ts, what the channel reports, what came in] — same shape as poseBuf, same two-line picture.
  // Stored in the RAW frame, like state.buf: the scopes, the condition graphs and every threshold
  // live there. `sg` (from the calibration) flips it back for the tuning panel, which shows — and
  // is typed into — the ORIENTED frame the shaping actually runs in.
  if(m.ch){
    D.chan=m.ch;
    const _sg=m.ch.sg||[1,1,1,1,1,1],_o=m.ch.out,_p=m.ch.pre,cb=D.chanBuf;
    D.lastSh={ax:_sg[0]*_o[0],ay:_sg[1]*_o[1],az:_sg[2]*_o[2],gx:_sg[3]*_o[3],gy:_sg[4]*_o[4],gz:_sg[5]*_o[5]};
    for(let i=0;i<6;i++){const a=cb["ch"+i];a.push([ts,_sg[i]*_o[i],_sg[i]*_p[i]]);
      let j=0;while(j<a.length&&a[j][0]<lo)j++;if(j)a.splice(0,j);}
  }else if(D.chan){D.chan=null;D.lastSh=null;for(let i=0;i<6;i++)D.chanBuf["ch"+i].length=0;}
  // prune THIS capsule's axis buffers + per-capsule events/button marks
  for(const k of AKEYS){const a=B[k];let i=0;while(i<a.length&&a[i][0]<lo)i++;if(i)a.splice(0,i);}
  {let i=0;while(i<D.events.length&&D.events[i].ts<lo)i++;if(i)D.events.splice(0,i);}
  // Presses are {a:down, b:up|null} — the open one at the end must survive the prune however long
  // it is being held, or a press held across the whole window would vanish from the lane it is
  // supposed to be showing. Dropped only once its RELEASE has scrolled off.
  {let j=0;while(j<D.btnPresses.length&&D.btnPresses[j].b!=null&&D.btnPresses[j].b<lo)j++;if(j)D.btnPresses.splice(0,j);}
  // mirror the ACTIVE capsule into the legacy globals — Mapping filter preview, Overview and
  // the Pad still read state.pose/state.last/state.buf as "the active slot".
  if(isActive){
    state.nowTs=ts; state.buf=B; state.last=D.last; state.pose=D.pose; state.poseBuf=D.poseBuf;
    state.lastSh=D.lastSh; state.chan=D.chan;   // tuned channels of the ACTIVE slot (pad gates, previews)
    if(m.raw)state.lastRaw=m.raw;
    // hidden tab: rAF paused / timers throttled, but SSE keeps flowing — drive the XY-pad audio
    if(m.pose){if(document.hidden){if(typeof padTick==="function")padTick();if(typeof fxTick==="function")fxTick();}
      else if(typeof _padMotionArmed==="function"&&_padMotionArmed())_padWake();}   // visible + motion-armed: wake the rAF loop instead
  }
  // CSV recording + raw feed follow the VIEWED capsule (both live in the Sensor/Connection tabs).
  // Recording widens to every capsule when "all capsules" is ticked; the on-screen feed never does,
  // because two capsules interleaved in one scrolling list is unreadable.
  if(isView||recWants("alldev")){
    // Sensor channels and 3D-filter axes describe the SAME sample, so they share one row instead
    // of doubling the file. Ticking neither means motion is simply not what this recording is about.
    if(state.recording&&(recWants("imu")||recWants("pose"))){
      const row={ts:ts.toFixed(4),type:recWants("imu")?"imu":"pose",dev:dev};
      if(recWants("imu")){row.ch0=m.a[0];row.ch1=m.a[1];row.ch2=m.a[2];
                          row.ch3=m.g[0];row.ch4=m.g[1];row.ch5=m.g[2];}
      if(recWants("pose")&&m.pose){row.tilt=m.pose.tilt;row.twist=m.pose.twist;
                                   row.pitch=m.pose.pitch;row.roll=m.pose.roll;}
      if(recWants("hex"))row.hex=m.raw||"";
      recPush(row);
    }
    if(isView&&live()&&m.raw&&(++state.rawSkip%6===0))pushFeed(ts,"imu","IMU",m.raw);
  }
}
// Not called internally (onSample prunes inline); kept as a helper for the viewed capsule.
function prune(ts){const D=VB(),lo=ts-MAXKEEP;
  for(const k of AKEYS){const a=D.buf[k];let i=0;while(i<a.length&&a[i][0]<lo)i++;if(i)a.splice(0,i);}}

// Which byte/bit of a status packet IS the button. The learn flow writes it here (same key the
// trigger editor reads when it offers a button condition), so the two never disagree about what
// they are looking at. Default B1·bit0 — where a real capsule's frame flag and the simulation both
// put it. Cached because this is asked on every status packet; the learn flow clears the cache.
let _btnBitCache=null;
function _btnBit(){
  if(_btnBitCache)return _btnBitCache;
  let bb={byte:1,bit:0};
  try{const sv=localStorage.getItem("ribbitflip.btnbit");if(sv){const p=JSON.parse(sv);
    if(p&&p.byte>=1&&p.byte<=4&&p.bit>=0&&p.bit<=7)bb={byte:+p.byte,bit:+p.bit};}}catch(e){}
  return (_btnBitCache=bb);
}
function onStatusPkt(m){
  const dev=m.dev||state.activeDeviceId||"d0", D=devEntry(dev);
  const isActive=(dev===state.activeDeviceId), isView=(dev===state.viewDev);
  const prev=D.statusPkt?D.statusPkt.bytes:null;
  D.statusPkt={bytes:m.bytes,prev,ts:m.ts,count:(D.statusPkt?.count||0)+1};
  // The multi-capsule refactor moved status packets onto the per-device entry, but three readers
  // (button-condition preview via curVal, the synth gate, pad tick) still look at the GLOBAL
  // state.statusPkt — which nothing had assigned since, so a button rule showed "released"
  // forever. Mirror the active capsule's packet there, same as pose/last do.
  if(isActive)state.statusPkt=D.statusPkt;
  if(isView){const sc=document.getElementById("stCount");if(sc)sc.textContent=D.statusPkt.count+" "+_gl("pakietów","packets");}
  const b=m.bytes;
  // LEARN button: first set bit beyond the header (B0) = physical button on the puck.
  // Mapping editor targets the ACTIVE capsule → only learn from its packets.
  // state._learnBtn = condition card index (-1 main, 0.. additional) or null.
  if(isActive&&typeof state._learnBtn==='number'&&state._draft){
    const cc=state._learnBtn, cond=cc<0?state._draft:(state._draft.extraConditions||[])[cc];
    if(!cond)state._learnBtn=null;
    else{let done=false;
      for(let by=1;by<=4&&!done;by++){if(!b[by])continue;
        for(let bit=0;bit<8;bit++){if((b[by]>>bit)&1){
          const _h=(cond.source&&cond.source.holdMs!=null)?cond.source.holdMs:250;
          cond.source={kind:"button",any:false,holdMs:_h,byte:by,bit:bit};state._learnBtn=null;done=true;
          try{localStorage.setItem("ribbitflip.btnbit",JSON.stringify({byte:by,bit:bit}));}catch(e){}
          _btnBitCache=null;    // the lane reads this too — it must not keep watching the old bit
          if(typeof renderEditor==="function")renderEditor();
          if(typeof flashTrigMsg==="function")flashTrigMsg("Wykryto przycisk: B"+by+"·bit"+bit);break;}}}
    }
  }
  // BUTTON PRESSES → time bar under the scopes (per capsule; the scope draws the viewed one).
  // Both edges, not just the down: how LONG a button was held is the difference between a tap and
  // a hold, and the lane used to draw a tap and a two-second press as the same hairline. The up
  // edge closes the entry that the down edge opened; anything still open is being held right now.
  //
  // ONE bit decides, not "any bit in bytes 1..4". Byte 3 of a status packet is a counter — it
  // changes on every keepalive — so scanning the whole range put a mark on the lane roughly twice
  // a second with nobody touching anything, and as a BAR that noise would read as a press being
  // held. The bit is the learned one when the capsule reports somewhere unusual (that is what
  // learning it is for), and B1·bit0 otherwise: the byte both a real capsule's frame flag and the
  // simulation put the button in.
  const _bb=_btnBit(), _bMask=1<<_bb.bit, _bBy=_bb.byte;
  const _btnDown=!!prev&&(((b[_bBy]||0)&~(prev[_bBy]||0))&_bMask)!==0;
  const _btnUp=!!prev&&(((prev[_bBy]||0)&~(b[_bBy]||0))&_bMask)!==0;
  if(_btnUp){const last=D.btnPresses[D.btnPresses.length-1];if(last&&last.b==null)last.b=m.ts;}
  if(_btnDown){
    // A down with an entry still open means we never saw the up (a dropped packet, a reconnect);
    // close it at its own start rather than letting one stale press swallow the whole lane.
    {const last=D.btnPresses[D.btnPresses.length-1];if(last&&last.b==null)last.b=last.a;}
    D.btnPresses.push({a:m.ts,b:null});
    // Pressing the centre is the other way to say "this one" — the pill lights up for it too,
    // and unlike a shake it works on a capsule lying flat on the table. NOT in simulation: the
    // synthetic waveform fakes button presses on every slot, so all four pills would blink in
    // unison and the flash would read as decoration instead of "this is the one you touched".
    if(typeof devIdentifyPing==="function"&&!(state.cfg&&state.cfg.simulate))devIdentifyPing(dev);
  }
  // Status-byte display and the raw feed follow the VIEWED capsule; recording may follow all.
  if(state.recording&&recWants("stat")&&(isView||recWants("alldev"))){
    const row={ts:m.ts.toFixed(4),type:"stat",dev:dev,
               b0:b[0],b1:b[1],b2:b[2],b3:b[3],b4:b[4]};
    if(recWants("hex"))row.hex=m.hex;
    recPush(row);
  }
  if(isView&&live()){renderStatusBytes(m.bytes,prev);pushFeed(m.ts,"stat","STAT",m.hex);}
}
function renderStatusBytes(bytes,prev){
  for(let i=0;i<5;i++){
    const v=bytes[i]??0,pv=prev?prev[i]:v;
    document.getElementById("bhx-"+i).textContent=v.toString(16).padStart(2,"0");
    document.getElementById("bdec-"+i).textContent=v+(i===2&&v<=100?" (bat?)":"");
    for(let b=0;b<8;b++){const el=document.getElementById(`bit-${i}-${b}`);
      const on=(v>>b)&1, chg=((v>>b)&1)!==((pv>>b)&1);
      el.classList.toggle("one",!!on);el.classList.toggle("chg",chg&&prev!=null);}
  }
}

function pushFeed(ts,cls,tag,hex){
  const feed=document.getElementById("feed");const r=document.createElement("div");r.className="row";
  r.innerHTML=`<span class="t">${ts.toFixed(2)}</span><span class="tag ${cls}">${tag}</span><span class="hex">${hex}</span>`;
  feed.prepend(r);while(feed.children.length>60)feed.removeChild(feed.lastChild);
}

