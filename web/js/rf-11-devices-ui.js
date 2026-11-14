"use strict";
// ===================== multi-device: selector + cheat sheet =====================
// Device pills (differential renderer + one delegated listener), the device editor overlay,
// the pairing screen for adding a slot, and the read-only "cheat sheet" overview that shows
// the mappings of every slot at once.
function connWord(c){return ({connected:"● połączony",sim:"● symulacja",parked:"uśpiony",
  scanning:"○ szukam",disconnected:"○ rozłączony",init:"○ start",
  pairing:"◌ parowanie…",idle:"○ niesparowany"}[c]||c||"—");}

// The server applies an automatic game setup to the capsule the panel has selected, so it has to
// be told which one that is (POST /ui-active). Overlay and overview windows run this code too but
// never choose a capsule for the user, so they stay quiet; the same id is not sent twice.
let _rfUiActiveSent=null;
function rfReportActiveDev(id){
  try{if(/[?&](overlay=1|view=overview)/.test(location.search||""))return;}catch(e){}
  if(!id||id===_rfUiActiveSent)return;
  _rfUiActiveSent=id;
  try{fetch("/ui-active",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({dev:id})}).catch(function(){_rfUiActiveSent=null;});}catch(e){_rfUiActiveSent=null;}
}
function switchDevice(id){
  if(!state.devices[id]||id===state.activeDeviceId)return;
  state.activeDeviceId=id;
  rfReportActiveDev(id);
  const D=devEntry(id);
  state.rules=D.rules; state.rt=D.rt; state.seqProg=D.seqProg||{};   // without this the multi countdown would freeze after switching
  state.activeLayer=D.activeLayer||1;   // each capsule sits on its own mapping layer
  state.statusPkt=D.statusPkt||null;    // button-condition preview reads the global mirror; stale packet would show the previous capsule's button
  // Mirror the new active capsule into the legacy globals (Mapping filter preview / Overview / Pad
  //  read these as "the active slot"). Buffers PERSIST per capsule now — no clearing, no stream
  //  reconnect (one global /stream carries every slot).
  state.buf=D.buf; state.poseBuf=D.poseBuf; state.pose=D.pose; state.last=D.last||{};
  if(D.nowTs)state.nowTs=D.nowTs;
  renderRules(); renderDeviceSelector(); updateKeysNote();
  if(typeof mUpdateNote==="function")mUpdateNote();
  // Every panel that keeps its capsule's configuration in ONE shared object has to be pointed at the
  // new capsule and re-read. Rules travel per capsule in state.devices and arrive over SSE; motion,
  // MIDI/OSC and the 3D axes do not — they are single objects whose save posts the WHOLE config, so
  // leaving them on the previous capsule means the next click overwrites this one's settings.
  if(typeof mouseFetchState==="function")mouseFetchState(id);
  if(typeof wheelFetchState==="function")wheelFetchState(id);
  if(typeof miFetchState==="function")miFetchState(id);
  if(typeof scanFetchState==="function")scanFetchState(id);
  // PRZEŁĄCZNIK GRUPY MAPOWANIE też należy do kapsla, a `state.trigEnabled` to jedno pole na cały
  // panel. Bez tego #trigEnable, jego lustro w Kontrolerze, kropka zakładki i linia gotowości
  // pokazywały stan POPRZEDNIEGO kapsla, a pierwszy klik wysyłał to, co serwer już miał. Od razu
  // z tego, co przyszło strumieniem (`rules`/`trigen` niosą `enabled` każdego kapsla), potem prawda
  // z serwera; odpowiedź spóźniona po kolejnym przełączeniu nie nadpisuje nowego kapsla.
  if(typeof setTrigEnabled==="function"){
    if(typeof D.trigEnabled==="boolean")setTrigEnabled(D.trigEnabled,true);
    try{
      fetch("/rules?dev="+encodeURIComponent(id)).then(r=>r.json()).then(d=>{
        if(!d||typeof d.enabled!=="boolean")return;
        D.trigEnabled=d.enabled;
        if(state.activeDeviceId===id)setTrigEnabled(d.enabled,true);
      }).catch(()=>{});
    }catch(e){}
  }
  // ONE current device: Sensor/Connection always follow the active slot.
  setViewDev(id);
}

// Point the Sensor+Connection panels at capsule `id` (kept in sync with the active slot).
function setViewDev(id){
  if(!state.devices[id])return;
  state.viewDev=id;
  const D=devEntry(id);
  state.scanning=D.scanning; state.parked=D.parked;
  // repaint the connection panel + status text from the viewed capsule's remembered snapshots
  const ds=document.getElementById("dStatus");
  if(ds)ds.textContent=({connected:"● Połączono",sim:"● Symulacja",parked:"Uśpiony",
    scanning:"○ Szukam…",disconnected:"○ Rozłączono",init:"○ Start"}[D.conn]||D.conn||"—");
  if(D.conn==="connected"||D.conn==="sim")setConn("live",D._connMsg||(D.conn==="sim"?"symulacja":"połączono"));
  else if(D.conn==="parked")setConn("scan",D._connMsg||"uśpiony");
  else if(D.conn==="scanning"||D.conn==="init"||!D.conn)setConn("scan",D._connMsg||"szukam…");
  else setConn("off",D._connMsg||"rozłączono");
  if(D.devInfo)onDev(D.devInfo);
  if(D.stats)onStats(D.stats);
  if(D.powerCfg&&typeof onPower==="function")onPower(D.powerCfg);
  if(typeof vpSyncView==="function")vpSyncView();   // manual control is per capsule — re-read whose hand is on which
  // The 3D axis configuration is per capsule too, and the panel holds exactly one of them. Without
  // this it keeps showing whoever was selected when the page loaded, and the next edit saves THAT
  // capsule's channel map onto this one.
  if(typeof loadPoseForDevice==="function")loadPoseForDevice(id);
  const feed=document.getElementById("feed"); if(feed)feed.innerHTML="";   // feed is per-view; start clean
  const sc=document.getElementById("stCount"); if(sc)sc.textContent=(D.statusPkt?D.statusPkt.count:0)+" "+_gl("pakietów","packets");
  if(D.statusPkt&&D.statusPkt.bytes)renderStatusBytes(D.statusPkt.bytes,D.statusPkt.prev||null);
  // Portret kapsla nad modułami (rf-34b) mówi o TYM kapslu — przełączenie musi go dosięgnąć od
  // razu, a nie dopiero przy najbliższym odświeżeniu pigułek.
  try{if(typeof rfNavCapSync==="function")rfNavCapSync();}catch(e){}
}

// USUNIĘTY PASEK „Aktualnie edytowany: <kapsel>" (2026-08-30): ta sama informacja jest już
// po prawej, więc pasek u góry tylko ją dublował.
//
// Do przebudowy na trzy kolumny pasek był jedyną odpowiedzią na pytanie „czyj to ekran": lista
// kapsli stała w jednym miejscu strony, a zakładka mogła być przewinięta daleko od niej, więc bez
// paska dwa kapsle dawały dwie identycznie wyglądające zakładki MIDI. Od przeprowadzki kapsli do
// PRAWEJ KOLUMNY (rf-34b/rf-34c) pytanie nie ma jak zostać bez odpowiedzi: kolumna jest przyklejona
// i widać ją zawsze, edytowany kapsel świeci własnym kolorem i grubszą obwódką, a po zwinięciu
// panelu zostaje kwadratem z pierścieniem. Pasek powtarzał to samo drugi raz, na najlepszym miejscu
// ekranu.
//
// Zdanie z hubu kapsli, które to rozstrzyga i obowiązywało tu od początku:
// „saying it twice in one glance is noise". Moduły z presetami miały już zresztą własny wyjątek
// (`.rfpc-main>.tab-owner{display:none}` w 21-presets.css), bo tam to samo mówiły okruszki.
//
// Powrót, gdyby kolumna kiedyś zniknęła: `_backups/260830-plakietka-i-kula/rf-11-devices-ui.js`
// (tam komplet: OWNER_TABS, mountOwnerBadges, renderEditingBadge) plus reguły `.tab-owner`
// w 07-felt-core.css.
// Derived target state for ONE device pill — the single source computed once per device,
// consumed by both the create path (_devpillHtml/_devpillCreate) and the in-place diff (_devpillUpdate).
function _devpillState(D){
  const id=D.meta.dev, active=(id===state.activeDeviceId);
  const idle=(D.meta.bound===false)&&(D.conn==="idle"||D.conn==="disconnected");
  const online=(D.conn==="connected"||D.conn==="sim");
  const hand=!!D.virt;   // a hand is on THIS capsule (manual control of the simulation)
  const paused=!!D.meta.paused;
  const autoPaused=!!D.meta.autoPaused;
  // `muted` no longer dims the pill. Muting is the app's own sound and nothing else, so a muted
  // capsule must still LOOK like a working one — it is. Only `paused` (and an unpaired slot) fades,
  // because those really are inert.
  // An idle hold is just as inert, so it borrows the same `.paused` class to grey the pill out:
  // what the LOOK means is "nothing is leaving this capsule", and that is equally true either
  // way. Which of the two it is, is said in words — in the state word and in the tooltip.
  const cls="devpill"+(active?" active":"")+(D.meta.muted?" muted":"")+((paused||autoPaused)?" paused":"")+
    (D.conn==="pairing"?" pairing":"")+(idle?" idle":"")+(online?" online":"")+(hand?" vhand":"");
  const capKey=(D.meta.cap!=null?String(D.meta.cap):"");
  const parked=(D.conn==="parked");   // asleep: the link is down, so the sleep button offers "wake"
  return {
    id, active, cls,
    dcol:D.meta.color||"#8aa0b5",
    // NAZWA JEST TU OD 2026-08-29 (etap 6c). Do tej pory dymek zaczynał się od etykiety TYLKO gdy
    // ktoś ją nadał — bo nazwa kapsla i tak stała obok, w pigułce. W zwiniętym pasku pigułka jest
    // kwadratem z samym rysunkiem i dymek został JEDYNYM miejscem, gdzie pada nazwa; bez niej
    // najazd na kafel odpowiadał „● symulacja", nie mówiąc, KTÓREGO kapsla to dotyczy.
    // Kolejność źródeł: własna etykieta bije nazwę domyślną, a gdy nie ma żadnej — identyfikator
    // slotu, żeby dymek nigdy nie zaczynał się od samego separatora.
    title:((D.meta.label||D.meta.name||id)+" · ")+connWord(D.conn)+
      (paused?" · wstrzymany (nic z niego nie wychodzi)":"")+
      // Says the CAUSE, not just the state: this hold undoes itself, so the tooltip has to stop
      // the user hunting for a switch to flip. (Both can be up at once — then both are listed.)
      (autoPaused?" · wstrzymany, bo leży nieruchomo (rusz nim, żeby wrócił)":"")+
      (D.meta.muted?" · bez dźwięku":"")+(hand?" · sterowany ręcznie":""),
    name:D.meta.name||id,
    capKey,
    capUrl:(D.meta.cap&&CAP_IMG[D.meta.cap])||"",
    muted:!!D.meta.muted,
    // Hold has no BUTTON on the pill any more (it moved to the „Moduły" matrix, first column),
    // but the pill still SHOWS it: the class greys the pill out, the mark stays, and the state
    // word says "wstrzymany". Reading the state and changing it are two different jobs, and only
    // the second one moved.
    paused,
    stateWord:(typeof devStateWord==="function"?devStateWord(D):""),
    muteLbl:D.meta.muted?"Wznów dźwięk":"Wycisz dźwięk",
    // Sleep is the OTHER kind of "off" and the only one still on the pill, so its tooltip has to
    // say which one it is: the link goes down and the capsule stops draining its battery, at the
    // price of connecting it again afterwards. (Hold leaves the link up and only cuts the signal.)
    sleepOn:parked,
    sleepLbl:parked?"Obudź kapsla. Trzeba go połączyć na nowo."
                   :"Uśpij i odłącz. Kapsel przechodzi w tryb uśpienia i nie zużywa baterii, ale wymaga ponownego podłączenia.",
    // The overlay, from the capsule itself. It lives in the cheat sheet's header too, which is a
    // screen away from the place a person is actually looking at this capsule — and "show this one
    // above the game" is a thought you have about A CAPSULE, so the button belongs on the capsule.
    ovlOn:(typeof ovlIsRunning==="function")&&ovlIsRunning(id),
    ovlAvail:(typeof ovlIsAvail==="function")?ovlIsAvail():true,
    ovlLbl:((typeof ovlIsRunning==="function")&&ovlIsRunning(id))
             ?"Schowaj okienko tego kapsla znad gry."
             :"Pokaż ten kapsel nad grą — małe okienko na wierzchu, do grania i na stream."
  };
}
// Inner markup (dp-main + dp-actions) for one pill — the ORIGINAL template, visually unchanged.
// (data-cap on .dp-cap is an inert key used only by the in-place diff to tell caps apart
//  without parsing the background-image URL back out of the style attribute.)
function _devpillHtml(S){
  return `<span class="dp-main">`+
      (S.capUrl?`<span class="dp-cap" data-cap="${esc(S.capKey)}" title="${esc(_gl("Kliknij: wygląd i edycja kapsla","Click: capsule look and editing"))}" style="background-image:url(${S.capUrl})"></span>`:`<span class="dp-dot"></span>`)+
      `<span class="dp-name">${esc(S.name)}</span>`+
      // The two switches leave a PERMANENT mark on the pill, not just a look on a button that is
      // hidden until you hover. Both are always in the markup and shown by CSS (.muted / .paused) —
      // same reason as .dp-edited: the in-place diff must never add or remove nodes here, or a
      // mid-hover update would yank the slide-out actions bar out from under the cursor.
      `<span class="dp-mark dp-mark-mute" aria-hidden="true"></span>`+
      `<span class="dp-mark dp-mark-pause" aria-hidden="true"></span>`+
      // State in words. Empty (and hidden) when the capsule is simply connected and working.
      `<span class="dp-state" data-pl="${esc(S.stateWord||"")}">${esc(S.stateWord||"")}</span>`+
      `<span class="dp-edited" aria-hidden="true">edytowany</span>`+
    `</span>`+
    // Order is deliberate: edit · sleep · mute · remove. The everyday action sits
    // first and the destructive one stays last, farthest from the cursor's first stop. Hold left
    // this bar on 2026-08-25 for the „Moduły" matrix below the pills, where it stands next to the
    // other five switches of the same capsule instead of impersonating "sleep" next to it.
    `<div class="dp-actions">`+
      // data-rftip-ic: the picture the tooltip repeats, bigger. These are the actions a person has
      // to tell apart in a hurry, so each one carries a drawing — the picture separates them faster
      // than the sentence does.
      // The overlay switch wears the felt drawing, not the stroked mark it used to: it stands in a
      // row of five felt pictures, and the one piece of line art among them read as a stray glyph
      // rather than a sibling. The stroked mark stays in the cheat sheet's header, where it has to
      // take the capsule's own colour — a picture cannot.
      `<button type="button" class="dp-act dp-ovl${S.ovlOn?" is-on":""}${S.ovlAvail?"":" is-off"}" aria-label="${esc(S.ovlLbl)}" title="${esc(S.ovlLbl)}" data-rftip-ic="ric-overlay"><span class="rfic ovl-ic" aria-hidden="true"></span></button>`+
      `<button type="button" class="dp-act dp-edit" aria-label="Edytuj kapsel" title="Edytuj kapsel" data-rftip-ic="ric-spray"><span class="rfic spray-ic" aria-hidden="true"></span></button>`+
      `<button type="button" class="dp-act dp-sleep${S.sleepOn?" is-asleep":""}" aria-label="${esc(S.sleepLbl)}" title="${esc(S.sleepLbl)}" data-rftip-ic="ric-zzz"><span class="bic bic-zzz" aria-hidden="true"></span></button>`+
      `<button type="button" class="dp-act dp-mute${S.muted?" is-muted":""}" aria-label="${esc(S.muteLbl)}" title="${esc(S.muteLbl)}" data-rftip-ic="ric-mega"><span class="bic bic-mega" aria-hidden="true"></span></button>`+
      `<button type="button" class="dp-act dp-del" aria-label="Usuń kapsel" title="Usuń kapsel" data-rftip-ic="ric-bin"><span class="bic bic-bin" aria-hidden="true"></span></button>`+
    `</div>`;
}
// Build a fresh pill node from target state (used only for devices that don't have a node yet).
function _devpillCreate(S){
  const pill=document.createElement("div");
  pill.className=S.cls;
  pill.dataset.dev=S.id;                              // stable hook for delegated clicks/keys
  pill.setAttribute("role","tab");
  pill.setAttribute("aria-selected",S.active?"true":"false");
  pill.tabIndex=0;
  pill.style.setProperty("--dcol",S.dcol);
  pill.title=S.title;
  pill.innerHTML=_devpillHtml(S);
  // NO per-element handlers — every click/key is resolved by the ONE delegated listener on #deviceSel (_wireDeviceSel).
  return pill;
}
// Update an EXISTING pill node in place — writes only what actually changed, so unchanged pills
// keep their :hover slide-out bar, keyboard focus, and running animations (pmpulse/devOnline).
function _devpillUpdate(node,S){
  if(node.className!==S.cls)node.className=S.cls;
  const aria=S.active?"true":"false";
  if(node.getAttribute("aria-selected")!==aria)node.setAttribute("aria-selected",aria);
  if(node.title!==S.title)node.title=S.title;
  // The tooltip helper republishes `title` as `data-rftip` on every pass but writes `aria-label`
  // only when there is none — so a label captured once, before the name and the link state arrived,
  // froze at „d0 · —" while the bubble stayed live. The pill's own text is its accessible name
  // today, yet if anything ever hands it a label it has to say exactly what the bubble says.
  if(node.hasAttribute("aria-label")&&node.getAttribute("aria-label")!==S.title)node.setAttribute("aria-label",S.title);
  if(node.style.getPropertyValue("--dcol")!==S.dcol)node.style.setProperty("--dcol",S.dcol);
  const nm=node.querySelector(".dp-name");
  if(nm&&nm.textContent!==S.name)nm.textContent=S.name;
  // Leading indicator: capsule image vs plain dot (identity tracked by data-cap key).
  const main=node.querySelector(".dp-main");
  if(main){
    const lead=main.firstElementChild;   // .dp-cap or .dp-dot
    if(S.capUrl){
      if(lead&&lead.classList.contains("dp-cap")){
        if(lead.getAttribute("data-cap")!==S.capKey){
          lead.setAttribute("data-cap",S.capKey);
          lead.style.backgroundImage=`url(${S.capUrl})`;
        }
      }else{
        const cap=document.createElement("span");
        cap.className="dp-cap"; cap.setAttribute("data-cap",S.capKey);
        cap.title=_gl("Kliknij: wygląd i edycja kapsla","Click: capsule look and editing");
        cap.style.backgroundImage=`url(${S.capUrl})`;
        if(lead)lead.replaceWith(cap); else main.insertBefore(cap,main.firstChild);
      }
    }else if(!lead||!lead.classList.contains("dp-dot")){
      const dot=document.createElement("span"); dot.className="dp-dot";
      if(lead)lead.replaceWith(dot); else main.insertBefore(dot,main.firstChild);
    }
  }
  // State word ("szukam", "wstrzymany", …). Written, not rebuilt: the node is always there.
  // Compared against data-pl, not the rendered text: in English the walker has already replaced the
  // text, so comparing the two would differ on every pass and rewrite the node forever.
  const st=node.querySelector(".dp-state");
  if(st&&st.getAttribute("data-pl")!==(S.stateWord||"")){
    st.setAttribute("data-pl",S.stateWord||"");
    st.textContent=S.stateWord||"";
    if(typeof applyLang==="function"){try{applyLang(st);}catch(e){}}
  }
  // Button states — the only part of .dp-actions we sync (never rebuild the bar, or hover breaks).
  const mute=node.querySelector(".dp-mute");
  if(mute){
    if(mute.classList.contains("is-muted")!==S.muted)mute.classList.toggle("is-muted",S.muted);
    if(mute.getAttribute("aria-label")!==S.muteLbl){mute.setAttribute("aria-label",S.muteLbl);mute.title=S.muteLbl;}
  }
  const sleep=node.querySelector(".dp-sleep");
  if(sleep){
    if(sleep.classList.contains("is-asleep")!==S.sleepOn)sleep.classList.toggle("is-asleep",S.sleepOn);
    if(sleep.getAttribute("aria-label")!==S.sleepLbl){sleep.setAttribute("aria-label",S.sleepLbl);sleep.title=S.sleepLbl;}
  }
  const ovl=node.querySelector(".dp-ovl");
  if(ovl){
    if(ovl.classList.contains("is-on")!==S.ovlOn)ovl.classList.toggle("is-on",S.ovlOn);
    if(ovl.classList.contains("is-off")===S.ovlAvail)ovl.classList.toggle("is-off",!S.ovlAvail);
    // This tooltip SWAPS ("show" ↔ "hide") rather than merely being written once, and the i18n
    // walker keeps the first Polish it saw for each attribute so it can put it back on the way to
    // Polish. Left alone, the new sentence would be looked up under the old one and the button
    // would go on saying "show" in English after opening. Forget the old original, write the new
    // one, translate it now.
    if(ovl.getAttribute("aria-label")!==S.ovlLbl){
      if(ovl._i18nA){delete ovl._i18nA["aria-label"];delete ovl._i18nA["title"];delete ovl._i18nA["data-rftip"];}
      ovl.setAttribute("aria-label",S.ovlLbl);
      ovl.setAttribute("data-rftip",S.ovlLbl);
      if(typeof applyLang==="function"){try{applyLang(ovl);}catch(e){}}
    }
  }
}
// Differential render (key-by-data-dev): reconcile the existing pills toward the target device list
// instead of blowing away el.innerHTML. Unchanged pills are NOT touched, so a mid-hover SSE devmeta/st
// tick can't yank the slide-out actions bar or steal keyboard focus.
// "Is there any capsule at all?" — a paired slot, a connected one (LIVE or simulation) or one in
// the middle of pairing counts; idle unpaired slots do not. Pure, so a test can ask it directly.
function _devAddFirst(devs){
  return !(devs||[]).some(D=>{const m=(D&&D.meta)||{}; const c=D&&D.conn;
    return !!m.bound||c==="connected"||c==="sim"||c==="pairing";});
}
function renderDeviceSelector(){
  const el=document.getElementById("deviceSel"); if(!el)return;
  const devs=Object.values(state.devices).sort((a,b)=>(a.meta.slot||0)-(b.meta.slot||0));
  // ALWAYS visible (even with 1 device) — so the "+ Add device" button sits next to the first pill
  el.style.display="flex";

  // "+ Add device" — persistent pill, created once and always kept last (never rebuilt).
  let add=el.querySelector(".devpill.add");
  if(!add){
    add=document.createElement("button");
    add.className="devpill add"; add.id="deviceAddBtn"; add.type="button";
    add.innerHTML=`<span class="dp-plus">+</span><span class="dp-add-txt"></span>`;
    // no per-render onclick — the delegated listener on #deviceSel handles the add pill too
    el.appendChild(add);
  }
  // No capsule anywhere (first run, or the only slot is unpaired): adding one is the only thing
  // to do here, so the button says so and stands out, instead of a quiet "+ Add device" beside
  // an idle slot. The server pairs that idle slot itself rather than opening a second one.
  const first=_devAddFirst(devs);
  const txt=first?_gl("Dodaj pierwszy kapsel","Add the first capsule"):_gl("Dodaj kapsel","Add a capsule");
  const ttl=first?_gl("Sparuj swój pierwszy kapsel — okienko parowania samo go poszuka","Pair your first capsule — the pairing window finds it for you")
                 :_gl("Dodaj kolejny kapsel — okienko parowania samo go poszuka","Add another capsule — the pairing window finds it for you");
  add.classList.toggle("first",first);
  const at=add.querySelector(".dp-add-txt");
  if(at&&at.textContent!==txt)at.textContent=txt;
  if(add.title!==ttl)add.title=ttl;

  // Index existing device pills by their stable data-dev key.
  const byId=Object.create(null);
  el.querySelectorAll(".devpill[data-dev]").forEach(n=>{byId[n.dataset.dev]=n;});

  // Drop pills whose device disappeared.
  const wanted=new Set(devs.map(D=>D.meta.dev));
  for(const id in byId){ if(!wanted.has(id))byId[id].remove(); }

  // Reconcile order + in-place state; create missing pills, move a pill only when out of position.
  let prev=null;
  for(const D of devs){
    const S=_devpillState(D);
    let node=byId[S.id];
    if(node)_devpillUpdate(node,S); else node=_devpillCreate(S);
    const expectedNext=prev?prev.nextElementSibling:el.firstElementChild;
    if(node!==expectedNext)el.insertBefore(node,expectedNext);
    prev=node;
  }

  // Keep the add pill last.
  if(el.lastElementChild!==add)el.appendChild(add);
  // (był tu `renderEditingBadge()` — pasek „Aktualnie edytowany" zdjęty 2026-08-30, patrz komentarz wyżej)

  // …i ten sam portret, ale z DRUGIEGO powodu: tędy wchodzą zmiany nazwy i rysunku z edytora,
  // stan połączenia z SSE oraz dodanie/usunięcie slotu (to od niego zależy, czy strzałki żyją).
  // Odświeżenie jest różnicowe i odcięte sygnaturą, więc wolno je wołać na każdym tiku.
  try{if(typeof rfNavCapSync==="function")rfNavCapSync();}catch(e){}
  if(typeof renderPlayPads==="function"){renderPlayPads();renderFxPads();}   // rebuild per-capsule controls when devices change
  if(typeof refreshPoseCopyFrom==="function")refreshPoseCopyFrom();   // refresh "copy 3D axes from another Triki" picker
  // pairing (or forgetting) a capsule is what makes a multi-capsule set possible — the Library's
  // second save line appears at two and disappears at one, without waiting for a tab switch
  try{if(typeof rfBundleRowSync==="function")rfBundleRowSync();}catch(e){}
  // ...and for the same reason: the capsule→controller hub IS one tile per capsule, and "shared
  // with" only means something at two of them. (The frame loop would catch this on its own, but
  // only while that tab is on screen — this keeps it true whichever tab you pair from.)
  try{if(typeof padCtlRender==="function")padCtlRender();}catch(e){}
}
// ONE-TIME event delegation for the device selector. Attached to the persistent #deviceSel container
// (survives every innerHTML rebuild AND the initTabs relocation from header → devices panel), so clicks
// landing on pill padding/gaps — the old "dead zones" — always resolve to the right action.
(function _wireDeviceSel(){
  const el=document.getElementById("deviceSel"); if(!el||el._rfDelegated)return; el._rfDelegated=true;
  el.addEventListener("click",e=>{
    const sleep=e.target.closest(".dp-sleep");
    if(sleep){const p=sleep.closest(".devpill[data-dev]"); if(p)toggleDeviceSleep(p.dataset.dev); return;}
    const mute=e.target.closest(".dp-mute");
    if(mute){const p=mute.closest(".devpill[data-dev]"); if(p){const d=state.devices[p.dataset.dev];toggleMute(p.dataset.dev,!(d&&d.meta.muted));} return;}
    const ovl=e.target.closest(".dp-ovl");
    if(ovl){const p=ovl.closest(".devpill[data-dev]");
      if(p&&typeof ovlToggleFor==="function")ovlToggleFor(p.dataset.dev); return;}
    const edit=e.target.closest(".dp-edit");
    if(edit){const p=edit.closest(".devpill[data-dev]"); if(p)openDeviceEditor(p.dataset.dev); return;}
    const del=e.target.closest(".dp-del");
    if(del){const p=del.closest(".devpill[data-dev]"); if(p)forgetDevice(p.dataset.dev); return;}
    if(e.target.closest(".devpill.add")){openPairing(); return;}
    // grafika kapsla w pigułce: przełącza na ten kapsel i otwiera menu wyglądu i edycji (openCapMenu)
    const capEl=e.target.closest(".dp-cap");
    if(capEl){const p=capEl.closest(".devpill[data-dev]");
      if(p){const r=capEl.getBoundingClientRect();switchDevice(p.dataset.dev);openCapMenu(p.dataset.dev,r);} return;}
    const pill=e.target.closest(".devpill[data-dev]");
    if(pill)switchDevice(pill.dataset.dev);
  });
  el.addEventListener("keydown",e=>{
    if(e.key!=="Enter"&&e.key!==" "&&e.key!=="Spacebar")return;
    // Action buttons (mute/edit) inside the pill fire their own native Enter/Space -> synthesized click
    // -> delegated click handler above. Don't hijack those keys for device-switching (would preventDefault
    // the native activation AND switch the active device). Only the switch zone / pill itself switches.
    if(e.target.closest&&e.target.closest(".dp-act"))return;
    const pill=e.target.closest&&e.target.closest(".devpill[data-dev]");
    if(pill){e.preventDefault();switchDevice(pill.dataset.dev);}
  });
})();
// Felt checkbox/radio "pop" — fire ONLY on a genuine user toggle-on, via a one-shot class added here.
// Do not bind the animation to :checked instead: an innerHTML rebuild (device selector, sound pads,
// #rfInc rows) recreates already-checked inputs and would replay the pop for every one of them.
(function _wireCheckPop(){
  document.addEventListener("change",e=>{
    const t=e.target;
    if(!t||t.tagName!=="INPUT"||(t.type!=="checkbox"&&t.type!=="radio")||!t.checked)return;
    t.classList.remove("rf-checkpop"); void t.offsetWidth;   // restart if rapidly re-toggled
    t.classList.add("rf-checkpop");
  },true);
  document.addEventListener("animationend",e=>{
    const t=e.target;
    if(e.animationName==="rf-pop"&&t&&t.classList&&t.classList.contains("rf-checkpop"))
      t.classList.remove("rf-checkpop");
  },true);
})();
// SOUND. Nothing else: a muted capsule still drives keys, the mouse, MIDI and OSC, and its pill
// stays fully lit. Until 2026-08-21 this one switch also disarmed the engines, so "mute the sound"
// quietly stopped the keyboard too — two jobs behind one megaphone.
function toggleMute(id,muted){
  const D=state.devices[id]; if(D){D.meta.muted=muted;renderDeviceSelector();renderOverview();updateKeysNote();
    if(typeof padCapsSyncMuted==="function")padCapsSyncMuted();    // pad rows mirror the pill (tick off + locked)
    // Kropka „Synth" w nawigacji czyta wyciszenie WYBRANEGO kapsla (rf-34 `updateTabDots`) — tak
    // samo jak kolumna „Dźwięk (Synth)" w macierzy. Bez tego wywołania obie rozjeżdżały się do
    // najbliższego przełączenia czegokolwiek innego.
    try{if(typeof updateTabDots==="function")updateTabDots();}catch(e){}}
  fetch("/mute?dev="+encodeURIComponent(id),{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({muted})}).catch(()=>{});
}
// HANDS OFF THIS CAPSULE. Everything it sends stops: keys, mouse, pad, MIDI, OSC and the app's own
// sound. The server disarms the slot (which also releases anything held down); the browser silences
// its pads through the same path mute uses. This is the switch that greys the pill out — a paused
// capsule really is inert, so it should look it.
// KEPT after the pill's hold button was removed (2026-08-25): the „Moduły" matrix drives this same
// function from its „Cały kapsel" column, so the skull note and the optimistic repaint below are
// still the one implementation of "hold".
// "Sleep / disconnect" on the pill: put THIS capsule to sleep, or wake it if it already is.
// A toggle and no confirmation, unlike "forget device": it is undone by pressing the same button,
// and the button says which way it goes. No optimistic repaint — the pill follows the server's
// connection state, and showing "asleep" on a capsule that never got the command would be a lie.
// Distinct from "hold" (togglePause), which cuts the OUTPUT and leaves the link up.
function toggleDeviceSleep(id){
  const D=state.devices[id];
  if(!D)return;
  const wake=(D.conn==="parked");
  const nm=(D.meta&&(D.meta.label||D.meta.name))||id;
  fetch((wake?"/wake?dev=":"/sleep?dev=")+encodeURIComponent(id),{method:"POST",
    headers:{"Content-Type":"application/json"},body:"{}"})
    .then(r=>r.json())
    .then(j=>{if(!j||!j.ok)throw 0;
      if(typeof rfToast==="function")
        rfToast(wake?_gl(nm+": budzę…",nm+": waking…"):_gl(nm+": usypiam, strumień się zatrzyma.",nm+": going to sleep, the stream will stop."),{ms:2600});})
    .catch(()=>{if(typeof rfToast==="function")rfToast(_gl("Nie udało się wysłać polecenia do kapsla.","Could not send the command to the capsule."),{tone:"danger"});});
}
function togglePause(id,paused){
  const D=state.devices[id];
  // Resuming by hand clears the idle hold too (the server does the same in set_paused) — mirrored
  // here so the pill does not stay greyed for the round trip and look like the click missed.
  if(D){D.meta.paused=paused;if(!paused)D.meta.autoPaused=false;
    renderDeviceSelector();renderOverview();updateKeysNote();
    if(typeof padCapsSyncMuted==="function")padCapsSyncMuted();}
  fetch("/pause?dev="+encodeURIComponent(id),{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({paused})}).catch(()=>{});
  if(typeof rfSkullNote==="function"){
    const nm=(D&&D.meta&&(D.meta.label||D.meta.name))||id;
    rfSkullNote(paused?_gl(nm+" wstrzymany. Nic z niego nie wychodzi.",nm+" is on hold. Nothing gets out of it.")
                      :_gl(nm+" znowu działa.",nm+" is working again."));
  }
}
// Shared "forget device" path used by the pill delete button (and mirrored by the editor's forget).
function forgetDevice(id){
  const D=state.devices[id]; if(!D)return;
  const nm=D.meta.name||id;
  if(Object.keys(state.devices||{}).length<=1){ rfSkullSay("Nie można usunąć ostatniego kapsla.",{tone:"danger"}); return; }
  // confirmLabel przez _gl: słownikowe „Usuń" to „Delete" (skasowanie zapisanego wpisu), a tu kapsel
  // tylko SCHODZI z listy — hub mówi „Remove capsule", więc i przycisk okna mówi „Remove".
  rfConfirm("Slot „"+nm+"” zniknie, a jego kapsel będzie można sparować od nowa.",
    {title:"Usunąć kapsel?",icon:'<span class="rfm-bin"></span>',tone:"danger",confirmLabel:_gl("Usuń","Remove"),cancelLabel:"Anuluj"})
  .then(ok=>{ if(!ok)return;
    fetch("/device/forget?dev="+encodeURIComponent(id),{method:"POST"})
      .then(r=>_forgetAnswer(id,r)).catch(()=>{});
  });
}
// The server's answer to "forget this slot". 404 = it has no such slot: the pill was a ghost (a
// slot forgotten a moment ago, rebuilt by a late event) — drop it here, there is nothing to remove.
// 409 = the last slot, which stays. Shared by the pill's bin and the editor's "forget".
function _forgetAnswer(id,r){
  if(r.ok)return;
  if(r.status===404){
    onDevGone(id);
    rfSkullSay(_gl("Tego wpisu już nie było — zdjęty z listy.","That entry was already gone — dropped from the list."));
    return;
  }
  rfSkullSay("Nie można usunąć ostatniego kapsla.",{tone:"danger"});
}
// Bring the editor's capsule to life: an idle rock, and a random animation when you click it.
// NO cursor parallax (removed 2026-08-21 on purpose): tilting a flat picture by rotateX/rotateY
// does not read as a solid object turning, it reads as a sticker being skewed — the artwork has one
// baked lighting direction, so the tilt fights it and the whole thing looks cheap. What sells the
// capsule as a physical thing is the idle rock and the click reactions, and those stay.
function _wireLivingCap(ov){
  const cap=ov&&ov.querySelector(".de-caphead-cap");
  if(!cap)return;
  cap.title=_gl("kliknij mnie","click me");
  const RM=window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  if(RM)return;
  const anims=["cap-anim-flick","cap-anim-spin","cap-anim-wobble","cap-anim-pop","cap-anim-nod"];
  const animating=()=>anims.some(a=>cap.classList.contains(a));
  let last="";
  cap.classList.add("is-idle");
  cap.addEventListener("click",e=>{
    e.stopPropagation();
    let pick; do{pick=anims[Math.floor(Math.random()*anims.length)];}while(pick===last&&anims.length>1);
    last=pick;
    anims.forEach(a=>cap.classList.remove(a)); cap.classList.remove("is-idle");
    void cap.offsetWidth; cap.classList.add(pick);
  });
  cap.addEventListener("animationend",()=>{
    if(!animating())return;
    anims.forEach(a=>cap.classList.remove(a)); cap.classList.add("is-idle");
  });
}
// KAPSEL 3D W OKNIE EDYCJI (2026-11-20, „przy wyborze wyglądu kapsla pokaż preview 3d, a nie grafikę 2d”).
// Duży kapsel to płótno: model z rf-14d w skinie wybranej grafiki, obracający się powoli wokół
// własnej osi, widziany z góry pod kątem jak na grafikach. Grafika 2D zostaje tłem płótna i widać ją
// tylko wtedy, gdy model jeszcze się ściąga albo nie ma WebGL (`KAPSEL3D.draw` zwraca false).
// Pętla kończy się sama, gdy okno się zamknie albo płótno zniknie (ponowne otwarcie = nowe płótno).
function _deCap3d(ov,capOf){
  const cv=ov.querySelector("canvas.de-caphead-cap"); if(!cv||typeof KAPSEL3D==="undefined")return;
  const RM=window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  const EL=56*Math.PI/180, ce=Math.cos(EL), se=Math.sin(EL), t0=performance.now();
  let bg=null;
  const frame=now=>{
    if(!cv.isConnected||ov.style.display==="none")return;
    const css=cv.clientWidth||124, dpr=Math.min(2,window.devicePixelRatio||1), px=Math.round(css*dpr);
    if(cv.width!==px){cv.width=cv.height=px;}
    const ctx=cv.getContext("2d"); ctx.clearRect(0,0,px,px);
    // obrót wokół osi kapsla (+Z), potem kamera nad kapslem: +X w prawo, +Z w górę i ku widzowi
    const a=RM?-0.5:-0.5+(now-t0)/1000*0.5, c=Math.cos(a), s=Math.sin(a);
    // wiersze macierzy (ekran ← kapsel): x = (c, −s, 0), y = (se·s, se·c, ce), z = (−ce·s, −ce·c, se)
    const C=[c,-s,0, se*s,se*c,ce, -ce*s,-ce*c,se];
    const sk=(typeof CAP_SKIN!=="undefined"&&CAP_SKIN[capOf()])||"";
    const ok=KAPSEL3D.draw(ctx,px/2,px/2,px/2*0.98,C,1,sk);
    const want=ok?"none":(cv.dataset.img||cv.style.backgroundImage);
    if(want!==bg){bg=want;cv.style.backgroundImage=want;}
    requestAnimationFrame(frame);   // też przy ograniczonym ruchu: kąt stały, ale zmiana grafiki ma być widać
  };
  requestAnimationFrame(frame);
}
// MENU GRAFIKI KAPSLA (2026-11-20). Kliknięcie w grafikę kapsla w pigułce (lewy górny róg) otwiera
// pod nią dymek: rząd grafik i „Edytuj kapsel…”. Wybór grafiki zapisuje się od razu (to samo POST
// /device co „Zapisz” w edytorze, tylko z samym polem cap) i zmienia też skin kapsla 3D; dymek zostaje
// otwarty, żeby było widać zmianę. „Edytuj kapsel…” otwiera pełny edytor (nazwa, kolor, etykieta).
// To samo menu otwiera duży kapsel w kolumnie „Nawigacja” (rf-34b buildNavCap). Kliknięcie w nazwę
// pigułki dalej tylko przełącza kapsel. Zamyka: Esc, klik obok, drugi klik w grafikę.
function closeCapMenu(){
  const m=document.getElementById("capMenu"); if(!m)return false;
  if(m._off)m._off(); m.remove(); return true;
}
function openCapMenu(id,r,ret){
  const D=state.devices[id]; if(!D||typeof CAP_IDS==="undefined")return;
  const was=document.getElementById("capMenu"), same=was&&was.dataset.dev===id;
  closeCapMenu(); if(same)return;   // drugi klik w tę samą grafikę zamyka dymek
  const cur=String(D.meta.cap||"");
  const nm=c=>{const k=(typeof KAPSEL_SKINY!=="undefined")&&KAPSEL_SKINY.find(x=>x[0]===c);return k?k[1]:c;};
  const m=document.createElement("div"); m.id="capMenu"; m.dataset.dev=id;
  m.setAttribute("role","dialog"); m.setAttribute("aria-label","Wygląd kapsla");
  m.innerHTML=`<p class="cm-title"><span data-noi18n>${esc(D.meta.name||id)}</span> · <span>Wygląd kapsla</span></p>
    <div class="cm-skins" role="radiogroup" aria-label="Wygląd kapsla">${CAP_IDS.map(c=>`<button type="button" class="cm-skin" role="radio" data-cap="${c}"`+
      ` aria-checked="${c===cur}" tabindex="${c===cur||(!CAP_IMG[cur]&&c===CAP_IDS[0])?0:-1}" title="${esc(nm(c))}" aria-label="${esc(nm(c))}"`+
      ` style="background-image:url(${CAP_IMG[c]})"></button>`).join("")}</div>
    <button type="button" class="btn xs cm-edit">Edytuj kapsel…</button>`;
  document.body.appendChild(m);
  if(typeof applyLang==="function"){try{applyLang(m);}catch(e){}}
  // pod grafiką, wyrównany do jej lewej krawędzi, ale nigdy poza oknem
  const w=m.offsetWidth,h=m.offsetHeight;
  let x=Math.max(8,Math.min(r.left-6,innerWidth-w-8)), y=r.bottom+8;
  if(y+h>innerHeight-8)y=Math.max(8,r.top-h-8);
  m.style.left=x+"px"; m.style.top=y+"px";
  const btns=[...m.querySelectorAll(".cm-skin")];
  const pick=(c,focus)=>{
    for(const b of btns){const on=b.dataset.cap===c;b.setAttribute("aria-checked",on);b.tabIndex=on?0:-1;if(on&&focus)b.focus();}
    if(String(D.meta.cap||"")===c)return;
    D.meta.cap=c; renderDeviceSelector(); renderOverview();
    fetch("/device?dev="+encodeURIComponent(id),{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({cap:c})}).catch(()=>{});
  };
  for(const b of btns){
    b.onclick=()=>pick(b.dataset.cap,false);
    b.onkeydown=e=>{const d={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key]; if(!d)return;
      e.preventDefault(); const i=btns.indexOf(b); pick(btns[(i+d+btns.length)%btns.length].dataset.cap,true);};
  }
  const back=()=>{const t=(ret&&ret.isConnected)?ret:document.querySelector('.devpill[data-dev="'+String(id).replace(/"/g,'')+'"] .dp-edit');if(t){try{t.focus();}catch(e){}}};
  m.querySelector(".cm-edit").onclick=()=>{closeCapMenu();openDeviceEditor(id);};
  const onDown=e=>{if(!m.contains(e.target)&&!(e.target.closest&&e.target.closest(".dp-cap,.rf-navcap-art")))closeCapMenu();};
  const onKey=e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();closeCapMenu();back();}};
  const onMove=()=>closeCapMenu();   // zmiana rozmiaru okna odkleja dymek od grafiki
  document.addEventListener("pointerdown",onDown,true); document.addEventListener("keydown",onKey,true);
  window.addEventListener("resize",onMove);
  m._off=()=>{document.removeEventListener("pointerdown",onDown,true);document.removeEventListener("keydown",onKey,true);
    window.removeEventListener("resize",onMove);};
  const f=btns.find(b=>b.tabIndex===0)||btns[0]; if(f){try{f.focus({preventScroll:true});}catch(e){}}
}
function openDeviceEditor(id){
  const D=state.devices[id]; if(!D)return;
  let ov=document.getElementById("devEdit");
  if(!ov){ov=document.createElement("div");ov.id="devEdit";document.body.appendChild(ov);}
  const _pcol=/^#[0-9a-fA-F]{6}$/.test(D.meta.color||"")?D.meta.color:"#8aa0b5";
  // A slot with no avatar (never got one, or lost it) would open as an empty glow with a 124 px
  // invisible hole in the middle of it. Hand it one here rather than show the hole — _ensureCap
  // sets meta.cap straight away and persists it in the background.
  if(!D.meta.cap&&typeof _ensureCap==="function")_ensureCap(id);
  const _capImg=capImgBig(D.meta.cap);   // shown at 124 px — the 96 px pill artwork looked soft here
  // WYBÓR GRAFIKI (2026-11-20). Dotąd kapsel dostawał grafikę losowo i nie dało się jej zmienić.
  // Rząd miniatur pod dużym kapslem; wybór podmienia duży obrazek od razu, a zapisuje się z resztą
  // pól pod „Zapisz” (Anuluj nic nie zmienia). Ta sama grafika wyznacza skin kapsla 3D (rf-03 CAP_SKIN).
  let _capSel=String(D.meta.cap||"");
  const _capName=c=>{const k=(typeof KAPSEL_SKINY!=="undefined")&&KAPSEL_SKINY.find(x=>x[0]===c);return k?k[1]:c;};
  const _capRow=CAP_IDS.map(c=>`<button type="button" class="de-capskin" role="radio" data-cap="${c}" aria-checked="${c===_capSel}"`+
    ` tabindex="${c===_capSel||(!_capSel&&c===CAP_IDS[0])?0:-1}" title="${esc(_capName(c))}" aria-label="${esc(_capName(c))}"`+
    ` style="background-image:url(${CAP_IMG[c]})"></button>`).join("");
  const _ret=document.activeElement;   // kto otworzył edytor — do niego wraca fokus po zamknięciu
  ov.innerHTML=`<div class="de-box" role="dialog" aria-modal="true" aria-labelledby="deTitle">
    <div class="de-caphead" style="--pcol:${_pcol}"><canvas class="de-caphead-cap" style="${_capImg?`background-image:url(${_capImg})`:""}" role="img" aria-label="Grafika kapsla"></canvas></div>
    <div class="de-capskins" role="radiogroup" aria-label="Wygląd kapsla">${_capRow}</div>
    <p class="de-note de-capnote">Ta sama grafika w pigułce i w podglądzie 3D.</p>
    <h3 id="deTitle">${esc(D.meta.name||id)} <span class="de-slot" data-noi18n>slot ${esc(id)}</span></h3>
    <label>Nazwa <input type="text" id="deName" maxlength="40" value="${esc(D.meta.name||"")}"></label>
    <p class="de-note">Nazwa — tak kapsel podpisuje się wszędzie w aplikacji.</p>
    <label>Kolor <input type="color" id="deColor" value="${/^#[0-9a-fA-F]{6}$/.test(D.meta.color||"")?D.meta.color:"#ffcb05"}"></label>
    <label>Etykieta <input type="text" id="deLabel" maxlength="40" placeholder="np. Lewa ręka / Gracz 1" value="${esc(D.meta.label||"")}"></label>
    <p class="de-note">Etykieta — nieobowiązkowy dopisek dla siebie, np. „Lewa ręka”. Widać go tylko w dymku pigułki.</p>
    <div class="de-act"><button class="btn de-forget" id="deForget" title="Zapomnij ten kapsel i usuń slot"><span class="rfic de-bin-ic" aria-hidden="true"></span>Usuń kapsel</button>
      <button class="btn" id="deCancel">Anuluj</button>
      <button class="btn primary" id="deSave"><span class="bic bic-save" aria-hidden="true"></span>Zapisz</button></div></div>`;
  ov.style.display="flex"; window.rfmReopen&&window.rfmReopen(ov); _wireLivingCap(ov);
  const _capBtns=[...ov.querySelectorAll(".de-capskin")];
  const _pickCap=(c,focus)=>{
    _capSel=c;
    for(const b of _capBtns){const on=b.dataset.cap===c;b.setAttribute("aria-checked",on);b.tabIndex=on?0:-1;if(on&&focus)b.focus();}
    const big=ov.querySelector(".de-caphead-cap"); if(big)big.dataset.img="url("+capImgBig(c)+")";
  };
  _deCap3d(ov,()=>_capSel);
  for(const b of _capBtns){
    b.onclick=()=>_pickCap(b.dataset.cap,false);
    b.onkeydown=e=>{   // radiogroup: strzałki chodzą po grafikach
      const d={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key]; if(!d)return;
      e.preventDefault(); const i=_capBtns.indexOf(b);
      _pickCap(_capBtns[(i+d+_capBtns.length)%_capBtns.length].dataset.cap,true);
    };
  }
  // FOKUS WCHODZI DO OKNA. Dotąd zostawał na pigułce pod spodem: użytkownik klawiatury otwierał
  // edytor i tabował przez całą stronę, zanim trafił w pole nazwy. Pierwsze pole jest tym, po co
  // się tu przyszło, więc zaznaczamy też jego treść — nowa nazwa nadpisuje starą jednym pisaniem.
  // WHY: focus must enter the dialog; the name field is what this window is for.
  const _deName=document.getElementById("deName");
  if(_deName){try{_deName.focus();_deName.select();}catch(e){}}
  const _deKey=e=>{
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close();return;}
    // PUŁAPKA FOKUSA (wzorzec _ra5Modal w rf-39-rest-e5.js): okno jest modalne — przykrywa panel
    // i łapie kliknięcia w tło, więc Tab też nie ma z niego wychodzić w treść, której nie widać.
    // WHY: the window is modal (backdrop click closes it), so Tab has to cycle inside it.
    if(e.key!=="Tab")return;
    if(document.querySelector(".rfm-backdrop"))return;   // dialog nad oknem ma własną pułapkę (rf-06) — nie przeciągamy mu fokusa
    const box=ov.querySelector(".de-box"); if(!box)return;
    const f=box.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]');
    if(!f.length)return;
    const first=f[0],last=f[f.length-1],a=document.activeElement;
    if(!box.contains(a)){e.preventDefault();first.focus();}
    else if(e.shiftKey&&a===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&a===last){e.preventDefault();first.focus();}
  };
  // ODDANIE FOKUSA. Pigułki bywają PRZEBUDOWANE po „Zapisz” (renderDeviceSelector), więc nie da się
  // trzymać referencji do przycisku — pytamy o niego DOM ponownie po id slotu. Po „Usuń kapsel”
  // pigułki już nie ma i jedynym sensownym miejscem jest „Dodaj kapsel”.
  // WHY: the pills are rebuilt after Save, so the return target is looked up again, not remembered.
  const close=(to)=>{ document.removeEventListener("keydown",_deKey,true); if(window.rfmClose) window.rfmClose(ov,()=>{ov.style.display="none";}); else ov.style.display="none";
    setTimeout(()=>{
      let t=(to==="add")?document.getElementById("deviceAddBtn"):null;
      if(!t)t=document.querySelector('.devpill[data-dev="'+String(id).replace(/"/g,'')+'"] .dp-edit');
      if(!t&&_ret&&_ret.isConnected&&_ret!==document.body)t=_ret;
      if(t&&t.focus){try{t.focus();}catch(e){}}
    },0);
  };
  ov.onclick=e=>{if(e.target===ov)close();};
  document.addEventListener("keydown",_deKey,true);   // Esc closes — consistent with every other RibbitFlip overlay
  document.getElementById("deCancel").onclick=()=>close();   // bez przekazywania zdarzenia jako celu fokusa
  // Cap is random + fixed (shown big at the top of this editor, not editable here).
  const fg=document.getElementById("deForget");
  if(fg)fg.onclick=async ()=>{
    if(Object.keys(state.devices||{}).length<=1){ rfSkullSay("Nie można usunąć ostatniego kapsla.",{tone:"danger"}); return; }
    const ok=await rfConfirm("Slot „"+(D.meta.name||id)+"” zniknie, a jego kapsel będzie można sparować od nowa.",
      {title:"Usunąć kapsel?",icon:'<span class="rfm-bin"></span>',tone:"danger",confirmLabel:_gl("Usuń","Remove"),cancelLabel:"Anuluj"});
    if(!ok)return;
    close("add");
    fetch("/device/forget?dev="+encodeURIComponent(id),{method:"POST"})
      .then(r=>_forgetAnswer(id,r)).catch(()=>{});
  };
  document.getElementById("deSave").onclick=()=>{
    const name=document.getElementById("deName").value.slice(0,40);
    const color=document.getElementById("deColor").value;
    const label=document.getElementById("deLabel").value.slice(0,40);
    const cap=CAP_IMG[_capSel]?_capSel:String(D.meta.cap||"");
    D.meta.name=name;D.meta.color=color;D.meta.label=label;D.meta.cap=cap;
    renderDeviceSelector();renderOverview();close();
    fetch("/device?dev="+encodeURIComponent(id),{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name,color,label,cap})}).catch(()=>{});
  };
}

function onDevGone(dev){
  delete state.devices[dev];
  // Disappeared during pairing -> close the screen. EXCEPT while a "keep looking" retry is in
  // flight: that deliberately removes the rejected slot and opens a new one, and closing the screen
  // underneath it would end the pairing the user is in the middle of.
  if(_pairTarget===dev&&!window._pairRetrying){_pairTarget=null;closePairing(false);}
  const ids=Object.keys(state.devices);
  const next=state.devices["d0"]?"d0":(ids[0]||null);
  if(state.activeDeviceId===dev){   // active one removed -> go back to d0/first
    if(next&&state.devices[next])switchDevice(next);
    else state.activeDeviceId=next||"d0";
  }
  // The Sensor/Connection view lets go of the slot too. VB() reads state.viewDev, and a stale id
  // there rebuilt the forgotten capsule as a ghost pill on the very next repaint.
  if(state.viewDev===dev){ if(next&&state.devices[next])setViewDev(next); else state.viewDev=next||"d0"; }
  renderDeviceSelector(); renderOverview();
}

// CHEAT SHEET: read-only overview of mappings + activations of ALL slots (key reference for the player)
function renderOverview(){
  const wrap=document.getElementById("overviewWrap"); if(!wrap)return;
  const devs=Object.values(state.devices).sort((a,b)=>(a.meta.slot||0)-(b.meta.slot||0));
  if(!devs.length){wrap.innerHTML='<div class="ov-empty">Brak urządzeń.</div>';return;}
  wrap.style.setProperty("--ovPoseH",(state.ovPoseH||160)+"px");   // 3D preview height (drag)
  wrap.innerHTML="";
  wrap.insertAdjacentHTML("beforeend", overviewBarHtml());
  // JEDNA KOLUMNA NA KAPSEL, W BOK. Do czterech kapsli wygląda to jak zawsze (kolumny dzielą
  // szerokość okna po równo), od piątego pas jedzie w prawo zamiast zawijać się do drugiego
  // rzędu — bo ściąga ma pokazywać wszystkie kapsle NARAZ, a rząd niżej to już przewijanie
  // strony w dół i utrata z oczu tych pierwszych. Szerokości pilnuje CSS (.ov-scroll), tutaj
  // zostaje sam pojemnik: pasek narzędzi ma stać nad pasem i się z nim NIE przewijać.
  // MINIMALNA SZEROKOŚĆ KOLUMNY WŁĄCZA SIĘ DOPIERO OD PIĄTEGO KAPSLA — do czterech kolumny
  // ściskają się jak dotąd (minmax(0,1fr)), więc na wąskim oknie nie pojawia się pasek tam,
  // gdzie go nigdy nie było. Od piątego kapsel dostaje swoje 320 px i pas zaczyna jechać w bok.
  const strip=document.createElement("div");strip.className="ov-scroll";
  strip.style.setProperty("--ovColMin",devs.length>4?"320px":"0px");
  wrap.appendChild(strip);
  for(const D of devs){
    const dev=D.meta.dev, rules=D.rules||[];
    const col=document.createElement("div");col.className="ov-col";
    col.style.setProperty("--dcol",D.meta.color||"#8aa0b5");
    let body="";
    if(!rules.length)body='<div class="ov-none">— brak mapowań —</div>';
    else for(const r of rules){const rt=(D.rt||{})[r.id]||{};
      body+=`<div class="ov-rule-wrap"><div class="ov-rule${rt.active?" active":""}${r.enabled?"":" off"}" id="ov-rule-${esc(dev)}-${esc(r.id)}">
        <span class="ov-led" id="ov-led-${esc(dev)}-${esc(r.id)}"></span>
        <span class="ov-key">${esc(ruleKeyLabel(r))}</span>
        <span class="ov-fires" id="ov-fires-${esc(dev)}-${esc(r.id)}">${rt.fires||0}</span>
        <span class="ov-cond">${esc(r.label?r.label+" · ":"")}${esc(ruleSrcLabel(r))} · ${esc(ruleCondLabel(r))} · ${esc(ruleBehLabel(r))}</span>
      </div>${progRowHtml(dev,r)}${state.detailView?detailHtml(dev,r):""}</div>`;}
    col.innerHTML=`<div class="ov-head">${capImgSpan(dev,20)}<b>${esc(D.meta.name||dev)}</b>`+
      (D.meta.label?`<span class="ov-lbl">${esc(D.meta.label)}</span>`:"")+
      `<span class="ov-conn ${(D.conn==="connected"||D.conn==="sim")?"on":""}">${connWord(D.conn)}</span>`+
      // Two marks, two meanings: no sound, versus nothing at all. On the cheat sheet, where you
      // read every slot at once, saying only "muted" for a held capsule would be a lie.
      (D.meta.muted?`<span class="ov-mute" title="wyciszony dźwięk">🔇</span>`:"")+
      (D.meta.paused?`<span class="ov-hold" title="wstrzymany, nic z niego nie wychodzi"><span class="rfic dt-ic" aria-hidden="true"></span></span>`:"")+
      // Same mark, different sentence: on the cheat sheet you are reading every slot at once, and
      // a capsule that will come back by itself is not the same news as one somebody switched off.
      (!D.meta.paused&&D.meta.autoPaused?`<span class="ov-hold" title="wstrzymany, bo leży nieruchomo — rusz nim, żeby wrócił"><span class="rfic dt-ic" aria-hidden="true"></span></span>`:"")+
      `</div><canvas class="ov-pose" data-dev="${esc(dev)}" title="Orientacja 3D — nachylenie + obrót"></canvas>`+
      `<div class="ov-pose-grip" title="Przeciągnij, by zmienić wysokość podglądu 3D">⇕</div>`+
      // PRZÓD KAPSLA (rf-41e): kropla pokazująca, gdzie jest przód i czy kapsel w niego mierzy.
      // Tylko w nakładce (w panelu CSS ją chowa) i tylko, gdy okno ją włączyło (`show.front`).
      `<canvas class="ov-front" data-dev="${esc(dev)}" title="Przód kapsla: kropla uspokaja się i zielenieje, gdy kapsel mierzy w przód"></canvas>`+
      // NOTATKA GRACZA (rf-41 `ovlNoteHtml`): klawiszologia napisana przez człowieka dla TEGO okna.
      // Tylko w nakładce (w panelu CSS ją chowa) i tylko, gdy okno ją włączyło (`show.note`).
      `<div class="ov-note" data-dev="${esc(dev)}">${typeof ovlNoteHtml==="function"?ovlNoteHtml():""}</div>`+
      `<canvas class="ov-mouse" data-dev="${esc(dev)}" title="Podgląd sterowania ruchem (mysz / gałka / krzyżak)" style="display:none"></canvas>`+
      // THE BUTTON, live. Hidden everywhere by default and switched on per overlay window (the
      // `press` part in rf-41) — mid-game the one thing that is genuinely hard to be sure about is
      // whether a press registered and whether it was long enough for a "Po czasie" trigger. The
      // panel already answers that on the Sensor tab; this is the same answer where you can see it
      // without leaving the game. Duration first, because that is the part a lamp cannot say.
      `<div class="ov-press" data-dev="${esc(dev)}" title="Naciśnięcia przycisku kapsla: kropka świeci, gdy trzymasz, liczba to długość naciśnięcia, paski to ostatnie 6 sekund">`+
        `<span class="ov-press-dot" aria-hidden="true"></span>`+
        `<span class="ov-press-val">–</span>`+
        `<canvas class="ov-press-lane" data-dev="${esc(dev)}"></canvas>`+
      `</div>`+
      // THE VIRTUAL CONTROLLER (rf-42). Last of the pictures and directly above the rule list,
      // because that is where the signal ends up: the capsule moves, its button is pressed, a rule
      // decides — and this is what Windows finally sees. Shows itself only when something is
      // actually mapped to the pad; in an overlay it stays, faded (see gpvFrame).
      (typeof gpvHtml==="function"?gpvHtml(dev):"")+
      // KOŁO WYBORU (rf-46). Ostatnie z rysunków i tuż nad listą wyzwalaczy, bo pojawia się
      // dokładnie na czas jednego naciśnięcia i wtedy jest najważniejszą rzeczą na kaflu.
      // Poza tą chwilą element jest schowany, żeby nie trzymał pustego kwadratu w kolumnie.
      (typeof wheelOverviewHtml==="function"?wheelOverviewHtml(dev):"")+
      // …a POD rysunkiem spis tego, co na tym kole jest (rf-46g). Rysunek widać przez sekundy
      // wyboru, spis stoi zawsze — bo ściąga odpowiada „co ten kapsel wysyła", a wycinki koła są
      // taką samą odpowiedzią jak reguły niżej. Kapsel bez koła nie dostaje tu nic.
      (typeof wheelColumnHtml==="function"?wheelColumnHtml(dev):"")+
      `<div class="ov-rules">${body}</div>`+overviewMidiHtml(dev);
    strip.appendChild(col);
  }
  ovStripBar(strip, wrap);
}
// DRUGI PASEK PRZEWIJANIA, przyklejony do dołu ekranu (patrz .ov-scrollbar w 13-dialogs-overview).
// Pusty element o szerokości pasa: przeglądarka rysuje mu własny pasek, a my przepisujemy pozycję
// w obie strony. Chowa się sam, kiedy wszystkie kapsle i tak się mieszczą — pasek, którym nie da
// się nic przesunąć, mówiłby nieprawdę.
function ovStripBar(strip, wrap){
  const bar=document.createElement("div");bar.className="ov-scrollbar";bar.setAttribute("aria-hidden","true");
  const inner=document.createElement("div");bar.appendChild(inner);wrap.appendChild(bar);
  const fit=()=>{inner.style.width=strip.scrollWidth+"px";
    bar.classList.toggle("off",strip.scrollWidth<=strip.clientWidth+1);};
  // Jedna blokada na obie strony — bez niej przepisanie pozycji budzi zdarzenie drugiego elementu
  // i pas z paskiem szarpią się o tę samą liczbę.
  let lock=false;
  const link=(from,to)=>from.addEventListener("scroll",()=>{if(lock)return;lock=true;to.scrollLeft=from.scrollLeft;lock=false;});
  link(strip,bar);link(bar,strip);
  if(typeof ResizeObserver==="function")new ResizeObserver(fit).observe(strip);
  fit();
}
// MIDI/OSC in the cheat sheet — shows mappings of the active slot, when the MIDI/OSC group is enabled.
// (Frontend keeps MIDI config only for the active slot — skipped for the rest.)
function overviewMidiHtml(dev){
  // MIDI and OSC are independent groups — show a mapping row only if ITS group is enabled
  if(dev!==state.activeDeviceId || (!state.midi.enabled&&!state.midi.oscEnabled))return "";
  const ms=(state.midi.mappings||[]).filter(m=>m.enabled!==false)
    .filter(m=>(m.dest==="osc")?state.midi.oscEnabled:state.midi.enabled);
  if(!ms.length)return "";
  const rows=ms.map(m=>`<div class="ov-midi-row" id="ovmi-${esc(dev)}-${esc(m.id)}">`+
    `<span class="ov-midi-src">${esc(miSrcLabel(m))}</span>`+
    `<span class="ov-midi-arr">→</span>`+
    `<span class="ov-midi-dest">${esc(miDestLabel(m))}</span>`+
    `<span class="ov-midi-val" id="ovmiv-${esc(dev)}-${esc(m.id)}"></span></div>`).join("");
  return `<div class="ov-midi"><div class="ov-midi-head">🎛 MIDI / OSC</div>${rows}</div>`;
}
function overviewTrig(dev,m){
  for(const it of (m.st||[])){const id=it[0];
    const row=document.getElementById("ov-rule-"+dev+"-"+id); if(row)row.classList.toggle("active",!!it[1]);
    const fe=document.getElementById("ov-fires-"+dev+"-"+id); if(fe)fe.textContent=it[2];
  }
}
function overviewFire(dev,m){
  const led=document.getElementById("ov-led-"+dev+"-"+m.id);
  if(led){led.classList.add("fired");setTimeout(()=>led.classList.remove("fired"),300);}
  // …and the same activation on the drawing of the pad, where a `sent:false` turns red.
  if(typeof gpvFire==="function")try{gpvFire(dev,m);}catch(e){}
}

