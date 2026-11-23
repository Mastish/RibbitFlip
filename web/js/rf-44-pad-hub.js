"use strict";
// ============================================================================
//  THE PAD HUB — who plays on which pad, and the one drawing that shows it.
//
//  The Kontroler tab used to open with one tile per CAPSULE, each carrying its
//  own little pad drawing. That answered "what does this capsule do" and left
//  the real question unanswered: what does the GAME see? A game sees pads, not
//  capsules — and with `mouse.padShare` two capsules can be one pad, which on
//  the capsule tiles showed up as two identical drawings with the same number,
//  a picture the owner read as "I only got one controller and I don't know why".
//
//  So the tab is pad-centric now, in three pieces this file owns two of:
//
//    * THE STRIP (#padHubList) — one box per pad the game will see, straight
//      from the server's registry (state.pads): a controller is a THING you
//      make, name and remove, not a side effect of who owns whom. "+ Utwórz
//      wirtualny kontroler" adds one — empty, waiting — and capsules are then
//      plugged in: the picker on a chip, a drag onto another box, or the
//      "+ przypisz kapsel" picker on an empty one. The capsules sit INSIDE the
//      boxes as chips, so two chips in one box IS the picture of two hands on
//      one controller, no badge needed. Every one of those writes goes to
//      POST /pads, which moves the capsule's own `mouse.padShare`, re-wires the
//      emitters and tells every other open dashboard.
//
//    * THE MAP (#padViewBox + #padLegend) — ONE big drawing of the pad being
//      viewed, fed by EVERY capsule plugged into it. Each input wears a ring
//      in the colour of the capsule whose rule or motion uses it — that is the
//      "which cable does this come through" answer — lit while it goes down,
//      red when the press never left the app. The legend under it names each
//      capsule, says what it contributes, and is the click that switches the
//      panel to editing that capsule. The drawing itself is the menu of the
//      RIGHT column: rf-43 owns what a click opens (padPartClick).
//
//  The right column (the part panel, the rule lists, the borrowed editor) is
//  rf-43's. The split line between the files is the split line on the screen.
// ============================================================================

const RF_PADHUB_I18N={
 "Utwórz wirtualny kontroler":"Create a virtual controller",
 "Nowy pad, do którego przypniesz jeden albo kilka kapsli":
   "A new pad you plug one or several capsules into",
 "Nowy kontroler gotowy — przypisz do niego kapsel":
   "New controller ready — plug a capsule into it",
 "Na którym kontrolerze gra ten kapsel":"Which controller this capsule plays on",
 "Przypisz kapsel do tego kontrolera":"Plug a capsule into this controller",
 "+ przypisz kapsel":"+ plug a capsule in",
 "brak kapsli":"no capsules yet",
 "czeka na pierwszy kapsel":"waiting for a first capsule",
 "Zmień nazwę kontrolera":"Rename this controller",
 "Usuń kontroler":"Remove this controller",
 // Bez pary „Usuń": ten słownik trafia do globalnego I18N_EN i „Usuń"→„Remove" przykrywało wszystkie
 // przyciski „Usuń" panelu (= „Delete"). Okno usuwania kontrolera podaje „Remove" jawnie przez _gl().
 "Jakim padem jest ten kontroler":"Which pad this controller is",
 "Typ nowego kontrolera":"Type of the new controller",
 "typ:":"type:",
 "Zmień typ kontrolera":"Change the controller type",
 "Zmień":"Change",
 "Mapowania zostają bez zmian.":"Your mappings stay exactly as they are.",
 "Windows zobaczy, że stary kontroler znika, a na jego miejsce wchodzi nowy. Gra, która już działa, może potrzebować ponownego wykrycia pada.":
   "Windows will see the old controller unplug and a new one take its place. A game that is already running may need to pick the pad up again.",
 "Typ zmieniony.":"Type changed.",
 "żyroskop":"gyroscope",
 "żyroskop włączony":"gyroscope on",
 "żyroskop wyłączony":"gyroscope off",
 "nazwa (np. lewa ręka)":"name (e.g. left hand)",
 "Nazwa kontrolera":"Controller name",
 "Kilka kapsli gra na tym jednym kontrolerze — gra widzi jednego gracza":
   "Several capsules play on this one controller — the game sees a single player",
 "Serwer nieosiągalny":"Server unreachable",
 "wspólny":"shared",
 "Pokaż ten kontroler":"Show this controller",
 "edytujesz teraz":"editing now",
 "Kliknij, aby ustawiać ten kapsel":"Click to edit this capsule",
 "lewy drążek":"left stick","prawy drążek":"right stick","krzyżak":"d-pad",
 "krzyżak → klawiatura":"d-pad → keyboard","drążek → klawiatura (WSAD)":"stick → keyboard (WASD)",
 "nic jeszcze nie podpięte":"nothing plugged in yet",
 "steruje teraz myszą":"drives the mouse right now",
 // the tray: capsules on no controller
 "Kapsle bez kontrolera":"Capsules with no controller",
 "bez kontrolera:":"no controller:",
 "bez kontrolera":"no controller",
 "wszystkie kapsle grają":"every capsule is plugged in",
 "przeciągnij tu kapsel, żeby go odpiąć":"drag a capsule here to unplug it",
 "Kapsel bez kontrolera. Kliknij, aby go ustawiać; przeciągnij na kontroler, aby przypiąć.":
   "A capsule on no controller. Click to edit it; drag it onto a controller to plug it in.",
 "Przypnij ten kapsel do kontrolera":"Plug this capsule into a controller",
 "przypnij do…":"plug into…",
 "Odepnij ten kapsel od kontrolera":"Unplug this capsule from the controller",
};
try{Object.assign(I18N_EN,RF_PADHUB_I18N);}catch(e){}

// ---------------------------------------------------------------------------
//  THE PAD MODEL — controllers are objects; capsules plug into them
//
//  The list comes from the server (GET /pads, then the "pads" SSE event) and
//  lives in state.pads. WHICH controller a capsule is on is that capsule's own
//  setting (mouse.padShare, read through gpvPadId in rf-42), so membership is
//  live from the same stream that already carries every other capsule setting
//  — and an EMPTY controller still shows up, because the registry knows it even
//  though no capsule mentions it.
// ---------------------------------------------------------------------------
// A capsule's colour, for the rings on the drawing and the chips everywhere else. meta.color is
// the user's own pick (device editor); the fallback palette is keyed to the SLOT, not to the list
// position, so a capsule keeps its colour when another one is forgotten.
const PAD_CAP_COLORS=["#e3506f","#3f9bd8","#61b136","#eaa32b","#8e6fe6","#2aa198"];
function padCapColor(dev){
  const D=state.devices&&state.devices[dev], meta=(D&&D.meta)||{};
  if(/^#[0-9a-fA-F]{6}$/.test(meta.color||""))return meta.color;
  const slot=(meta.slot!=null)?meta.slot:(parseInt(String(dev).replace(/[^0-9]/g,""),10)||0);
  return PAD_CAP_COLORS[slot%PAD_CAP_COLORS.length];
}
function padCapName(dev){
  const D=state.devices&&state.devices[dev];
  return ((D&&D.meta)||{}).name||dev;
}
// One capsule's motion config, wherever it currently lives: the ACTIVE capsule's is the object
// being edited (state.mouse — fresher than any stash), the others come from the SSE stash or the
// slow per-capsule fetch (ovMotionCfg -> D.mouseCfg). Same order gpvSnapshot resolves in.
function padCfgOf(dev){
  if(dev===state.activeDeviceId&&state.mouse&&state.mouseDev===dev)return state.mouse;
  const D=state.devices&&state.devices[dev];
  return (typeof ovMotionCfg==="function"?ovMotionCfg(D||{}):null)||(D&&D.mouseCfg)||{};
}
// The controllers that exist right now, in the server's order.
function padList(){return Array.isArray(state.pads)?state.pads:[];}
function padById(id){return padList().find(p=>p.id===id)||null;}
function padOwners(){return padList().map(p=>p.id);}
// WHICH CONTROLLER this is. The list comes from the server (pads_state -> `kinds`) rather than
// being written out here, because the answer is a fact about what the SERVER can build: two pads
// ViGEmBus makes into Windows devices, and one that is not a Windows device at all. Offering a
// fourth in the interface would only teach people to expect something that cannot be made. The
// fallback below is for the moment before the first reply lands.
const PAD_KIND_FALLBACK=[{id:"x360",label:"Xbox 360"},{id:"ds4",label:"DualShock 4"},
                         {id:"wii",label:"Wii (emulator)"}];
function padKinds(){
  const k=state.padKinds;
  return (Array.isArray(k)&&k.length)?k:PAD_KIND_FALLBACK;
}
function padKindOf(id){
  const p=padById(id);
  return (p&&p.kind)||"x360";
}
// One sentence per type, and the only place the difference is stated BEFORE you commit to it.
// The Wii line leads with what it does NOT do, because that is the misunderstanding that costs
// somebody an evening: it is not a controller Windows holds, so no ordinary game will see it.
function padKindWhy(kind){
  if(kind==="wii")return _gl("nie widzi go Windows ani zwykła gra, tylko emulator (Dolphin, Cemu…); bez sterownika, za to z prawdziwym ruchem",
                             "invisible to Windows and to ordinary games, only an emulator sees it (Dolphin, Cemu…); no driver, but real motion");
  if(kind==="ds4")return _gl("pad, którego widzi gra; bierz go, gdy gra ignoruje pady Xboxa; ma żyroskop",
                             "a pad games see; reach for it when a game ignores Xbox pads; it has a gyroscope");
  return _gl("pad, którego widzi niemal każda gra; najbezpieczniejszy wybór",
             "a pad nearly every game sees; the safe choice");
}
function padKindLabel(kind){
  const k=padKinds().find(x=>x.id===kind);
  return k?k.label:(kind||"Xbox 360");
}
function padNumOf(id){
  const L=padList(), i=L.findIndex(p=>p.id===id);
  return (i>=0)?(L[i].num!=null?L[i].num:i+1):1;
}
// "Kontroler 2" — plus the name, when the user gave it one. Used on the tile, in every picker and
// in the sentences about moving capsules, so that all of them say the same thing about one pad.
function padLabel(id){
  const p=padById(id), base=_gl("Kontroler ","Controller ")+padNumOf(id);
  return (p&&p.name)?(base+" · "+p.name):base;
}
// The capsules plugged into one controller, in slot order. Several is the POINT (one player, two
// hands), not an edge case — and none at all is legal too: a controller made and not filled yet.
function padMembers(padId){
  return Object.keys(state.devices||{}).sort()
    .filter(d=>(typeof gpvPadId==="function"?gpvPadId(d):"")===padId);
}
// …and the ones plugged into NOTHING, which is the same question with the same answer source.
// Derived here rather than read straight off state.padFree so that a capsule can never be in a box
// AND in the tray: gpvPadId is the one function that decides where a capsule is, and it already
// weighs the registry's own list against the capsule's config.
function padFreeMembers(){
  return Object.keys(state.devices||{}).sort()
    .filter(d=>(typeof gpvPadId==="function"?gpvPadId(d):"p1")==="");
}
// How many of a capsule's rules press a pad button — the number worth saying out loud when it is
// about to stop reaching one.
function padRuleCount(dev){
  const D=state.devices&&state.devices[dev], rules=(D&&D.rules)||[];
  if(typeof gpvRuleButtons!=="function")return 0;
  return rules.filter(r=>(gpvRuleButtons(r)||[]).length).length;
}

// WHICH pad the map shows. Follows the active capsule by default — the person editing a capsule is
// almost always asking about ITS controller — and only remembers a different choice for as long as
// that choice stays valid (a controller can be deleted while it is the one on screen).
function padViewOwner(){
  const own=padOwners();
  if(!own.length)return null;
  const v=state._padView;
  if(v&&own.indexOf(v)>=0)return v;
  const act=(state.activeDeviceId&&typeof gpvPadId==="function")?gpvPadId(state.activeDeviceId):null;
  return (act&&own.indexOf(act)>=0)?act:own[0];
}
function padViewSelect(owner){
  state._padView=owner||null;
  padCtlRender();
}
function padViewMembers(){
  const o=padViewOwner();
  return o?padMembers(o):[];
}

// ---------------------------------------------------------------------------
//  WHO DRIVES A MOTION PART — the "which cable" answer for the stick / d-pad
// ---------------------------------------------------------------------------
// For 'ls' | 'rs' | 'dpad' on the VIEWED pad: which member capsule is set up to feed it. `live`
// means the motion group is on and this is really going into the pad; `aimed` means it is set up
// and silent. A live driver always outranks an aimed one — with two capsules configured for the
// same stick (one running, one left over from an old set) the running one is the true answer.
function padPartDriver(part){
  const kind=(part==="ls"||part==="rs")?"stick":(part==="dpad")?"dpad"
            :(part==="touchpad")?"touchpad":null;
  if(!kind)return null;
  let aimed=null;
  for(const dev of padViewMembers()){
    const cfg=padCfgOf(dev)||{};
    // The touchpad is the STICK mode with another way out (stickBackend), so the two have to be
    // told apart here or a capsule aiming a finger would also claim the analog stick.
    const hit=(kind==="stick")
      ? (cfg.mode==="stick"&&cfg.stickBackend==="gamepad"&&(((cfg.stickWhich==="right")?"rs":"ls")===part))
      : (kind==="touchpad")
      ? (cfg.mode==="stick"&&cfg.stickBackend==="touchpad")
      : (cfg.mode==="dpad"&&cfg.dpadBackend==="gamepad");
    if(!hit)continue;
    if(cfg.enabled)return {dev,live:true};
    if(!aimed)aimed={dev,live:false};
  }
  return aimed;
}
// Every pad-button rule of every member aiming at one of `btns`, with its capsule. The active
// capsule's rules come first — those are the editable ones.
function padPartRulesAll(btns){
  const out=[],act=state.activeDeviceId;
  const mem=padViewMembers().slice().sort((a,b)=>(a===act?-1:0)-(b===act?-1:0));
  for(const dev of mem){
    const D=state.devices[dev]; if(!D)continue;
    for(const r of (D.rules||[])){
      const bs=(typeof gpvRuleButtons==="function")?gpvRuleButtons(r):[];
      if(bs.some(b=>btns.indexOf(b)>=0))out.push({dev,rule:r});
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
//  THE MERGED SNAPSHOT — one pad, several capsules' worth of state
// ---------------------------------------------------------------------------
// gpvSnapshot (rf-42) answers for ONE capsule; the map needs the union over the pad's members,
// remembering for every input WHICH capsule put it there (`src` — the ring colour). Two members
// on one button is legal (each capsule's rule presses it); the ring then falls back to the neutral
// colour and the legend carries the detail. Unlike a single capsule, a merged pad can have BOTH
// sticks deflected at once — one per member — so `sticks` is a list.
function padMergedSnap(owner){
  const out={mapped:{},live:{},blocked:{},press:{},src:{},multi:{},sticks:[],cap:null,capDev:null};
  for(const dev of padMembers(owner)){
    const D=state.devices[dev]; if(!D)continue;
    let s=null;
    try{s=gpvSnapshot(D);}catch(e){continue;}
    for(const b in s.mapped){
      if(out.mapped[b]){if(out.src[b]!==dev)out.multi[b]=true;}
      else{out.mapped[b]=true;out.src[b]=dev;}
    }
    for(const b in s.live)out.live[b]=true;
    for(const b in s.press){out.press[b]=true;if(s.blocked[b])out.blocked[b]=true;}
    for(const b in s.blocked)out.blocked[b]=true;
    if(s.stick)out.sticks.push({btn:s.stick.btn,x:s.stick.x,y:s.stick.y});
    if(s.cap&&(!out.cap||s.cap.until>out.cap.until)){out.cap=s.cap;out.capDev=dev;}
  }
  return out;
}

// ---------------------------------------------------------------------------
//  THE STRIP — one box per pad, capsules as chips
// ---------------------------------------------------------------------------
function padHubRender(){
  const box=document.getElementById("padHubList"); if(!box)return;
  box.innerHTML="";
  const owners=padOwners(), ids=Object.keys(state.devices||{}).sort();
  const view=padViewOwner();
  for(const pid of owners){
    const mem=padMembers(pid), shared=mem.length>1;
    const b=document.createElement("div");
    b.className="ph-box"+(pid===view?" viewed":"")+(shared?" shared":"")+(mem.length?"":" empty");
    b.dataset.owner=pid;
    b.setAttribute("role","button");b.tabIndex=0;
    b.title=_gl("Pokaż ten kontroler","Show this controller");
    b.appendChild(_padHead(pid,shared,owners.length));
    const chips=document.createElement("div");chips.className="ph-chips";
    for(const dev of mem)chips.appendChild(_padChip(dev,pid,owners));
    // A controller with nobody on it is not a fault — it is the second half of "create one, then
    // plug capsules in". It says so, and carries the shortest way to do it.
    if(!mem.length)chips.appendChild(_padEmptySlot(pid,ids));
    b.appendChild(chips);
    const open=()=>{
      if(mem.length&&mem.indexOf(state.activeDeviceId)<0&&typeof switchDevice==="function")switchDevice(mem[0]);
      padViewSelect(pid);
    };
    b.onclick=e=>{if(e.target&&e.target.closest&&e.target.closest("button,select,input"))return;open();};
    b.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}};
    // DRAG A CAPSULE ONTO A CONTROLLER — the picker on the chip does the same thing and is what
    // keyboard and screen-reader users get; this is the shortcut for a mouse, never the only way.
    b.addEventListener("dragover",e=>{
      if(!state._padDrag)return;
      e.preventDefault();e.dataTransfer.dropEffect="move";b.classList.add("drop");});
    b.addEventListener("dragleave",()=>b.classList.remove("drop"));
    b.addEventListener("drop",e=>{
      b.classList.remove("drop");
      const dev=(e.dataTransfer&&e.dataTransfer.getData("text/plain"))||state._padDrag;
      if(!dev)return;
      e.preventDefault();
      if((typeof gpvPadId==="function"?gpvPadId(dev):"")!==pid)padAssign(dev,pid);});
    box.appendChild(b);
  }
  box.appendChild(_padAddTile(owners.length));
  padFreeRender();
  // ONE ROW FOR ONE CONTROLLER (F-G3-03). With a single controller and no capsule left on the
  // tray, the section head and its tray say nothing the tile does not, and on a 720 px screen they
  // pushed the drawing of the pad under the fold. The head comes back the moment there is a choice
  // to make: a second controller or a capsule on no controller.
  const card=document.getElementById("padCard");
  if(card)card.classList.toggle("pad-one",owners.length===1&&!padFreeMembers().length);
}

// THE TRAY — capsules on no controller, at the head of the strip.
//
// It is a SOURCE and a TARGET: drag a chip out of a box onto it and the capsule is unplugged,
// drag one back and it plays again. Every drag here has a click-sized twin (the ✕ on a chip, the
// picker on a tray chip), because a drag is a mouse-only gesture and this is the only way to say
// "this capsule presses no pad at all".
//
// It stays on screen when empty, and that is deliberate twice over: an empty drop target you can
// see is what makes the gesture discoverable, and its sentence is the only place the interface
// says out loud that a capsule may have no controller.
function padFreeRender(){
  const box=document.getElementById("padHubFree"); if(!box)return;
  const free=padFreeMembers();
  box.innerHTML="";
  box.classList.toggle("empty",!free.length);
  const lab=document.createElement("span");lab.className="ph-free-lab";
  lab.textContent=free.length?_gl("bez kontrolera:","no controller:")
                             :_gl("wszystkie kapsle grają","every capsule is plugged in");
  box.appendChild(lab);
  if(!free.length){
    const hint=document.createElement("span");hint.className="ph-free-hint";
    hint.textContent=_gl("przeciągnij tu kapsel, żeby go odpiąć","drag a capsule here to unplug it");
    box.appendChild(hint);
  }else for(const dev of free)box.appendChild(_padFreeChip(dev));
  if(box._wired)return;
  box._wired=true;
  box.addEventListener("dragover",e=>{
    if(!state._padDrag)return;
    if((typeof gpvPadId==="function"?gpvPadId(state._padDrag):"")==="")return;  // already here
    e.preventDefault();e.dataTransfer.dropEffect="move";box.classList.add("drop");});
  box.addEventListener("dragleave",()=>box.classList.remove("drop"));
  box.addEventListener("drop",e=>{
    box.classList.remove("drop");
    const dev=(e.dataTransfer&&e.dataTransfer.getData("text/plain"))||state._padDrag;
    if(!dev)return;
    e.preventDefault();
    if((typeof gpvPadId==="function"?gpvPadId(dev):"")!=="")padDetach(dev);});
}

// One capsule waiting in the tray. Same chip as in a box, minus the ✕ (it is already off) and
// with the picker turned round: instead of "which controller are you on" it asks "which one do
// you want", starting on a placeholder so that opening it changes nothing by itself.
function _padFreeChip(dev){
  const chip=document.createElement("div");
  chip.className="ph-chip free"+(dev===state.activeDeviceId?" active":"");
  chip.dataset.dev=dev;
  chip.style.setProperty("--dcol",padCapColor(dev));
  chip.title=_gl("Kapsel bez kontrolera. Kliknij, aby go ustawiać; przeciągnij na kontroler, aby przypiąć.",
                 "A capsule on no controller. Click to edit it; drag it onto a controller to plug it in.");
  chip.innerHTML=(typeof capImgSpan==="function"?capImgSpan(dev,18):"")+
    '<b>'+esc(padCapName(dev))+'</b>';
  const owners=padOwners();
  if(owners.length){
    const sel=document.createElement("select");
    sel.className="ph-share";
    sel.title=_gl("Przypnij ten kapsel do kontrolera","Plug this capsule into a controller");
    sel.setAttribute("aria-label",_gl("Przypnij kapsel ","Plug in capsule ")+padCapName(dev));
    sel.innerHTML='<option value="">'+esc(_gl("przypnij do…","plug into…"))+'</option>'+
      owners.map(o=>'<option value="'+esc(o)+'">'+esc(padLabel(o))+'</option>').join("");
    sel.value="";
    sel.onchange=()=>{if(sel.value)padAssign(dev,sel.value);};
    sel.onclick=e=>e.stopPropagation();
    chip.appendChild(sel);
  }
  chip.draggable=true;
  chip.addEventListener("dragstart",e=>{
    state._padDrag=dev;chip.classList.add("dragging");
    try{e.dataTransfer.setData("text/plain",dev);e.dataTransfer.effectAllowed="move";}catch(_){}});
  chip.addEventListener("dragend",()=>{state._padDrag=null;chip.classList.remove("dragging");
    document.querySelectorAll(".ph-box.drop").forEach(n=>n.classList.remove("drop"));});
  chip.onclick=e=>{
    if(e.target&&e.target.closest&&e.target.closest("select"))return;
    e.stopPropagation();
    if(typeof switchDevice==="function")switchDevice(dev);
  };
  return chip;
}

// The tile's head: which controller this is, whether it is shared, and the two things you can do
// to the controller ITSELF (rename, remove). Both are buttons rather than a menu — with at most
// four tiles on screen a menu would hide two clicks behind three.
// NAKŁADKA TEGO KONTROLERA — okno oznaczone jego identyfikatorem (`cfg.pad`, patrz
// OVERLAY_WIN_DEFAULTS w ribbitflip_monitor.py). Jedno na kontroler wystarcza temu przyciskowi:
// gdyby ktoś zrobił ich kilka z ekranu „Nakładka", sterujemy najstarszym, a resztą stamtąd.
function _padOvlWin(pid){
  if(typeof ovmWindows!=="function")return null;
  try{return ovmWindows().find(w=>w.cfg&&w.cfg.pad===pid&&!w.wheel)||null;}catch(e){return null;}
}
// Klik w ikonę nakładki przy kontrolerze: pokaż albo schowaj. Okna jeszcze nie ma? Zrób je —
// pytanie „czy chcesz je najpierw utworzyć" nie ma drugiej sensownej odpowiedzi.
function padOverlayToggle(pid){
  const mem=padMembers(pid); if(!mem.length)return;
  const win=_padOvlWin(pid);
  if(!win||!win.exists){
    if(typeof _ovgAddCtl==="function")_ovgAddCtl(mem[0],pid,null);
    return;
  }
  if(typeof ovlPost!=="function")return;
  ovlPost({act:"toggle",win:win.wid,dev:win.dev}).then(x=>{
    if(x&&x.error&&typeof rfToast==="function")rfToast(x.error,{tone:"danger",ms:5000});
    if(typeof ovlPanelSync==="function")try{ovlPanelSync(x);}catch(e){}
    padCtlRender();
  });
}
function _padHead(pid,shared,count){
  const head=document.createElement("div");head.className="ph-head";
  const num=document.createElement("span");num.className="ph-num";
  num.textContent=_gl("Kontroler ","Controller ")+padNumOf(pid);
  head.appendChild(num);
  const p=padById(pid);
  if(p&&p.name){const nm=document.createElement("span");nm.className="ph-name";nm.textContent=p.name;head.appendChild(nm);}
  if(shared){const s=document.createElement("span");s.className="ph-shared";
    s.textContent=_gl("wspólny","shared");
    s.title=_gl("Kilka kapsli gra na tym jednym kontrolerze — gra widzi jednego gracza",
                "Several capsules play on this one controller — the game sees a single player");
    head.appendChild(s);}
  // WHICH PAD this is. A picker rather than a label, because the answer is worth changing: a
  // game that ignores the Xbox pad often takes the DualShock, and the way to find out is to try
  // both. It sits in the head next to the number, since it describes the controller itself.
  const kind=document.createElement("select");kind.className="ph-kind";
  kind.title=_gl("Jakim padem jest ten kontroler","Which pad this controller is");
  kind.setAttribute("aria-label",_gl("Typ kontrolera ","Type of controller ")+padNumOf(pid));
  kind.innerHTML=padKinds().map(k=>'<option value="'+esc(k.id)+'">'+esc(k.label)+'</option>').join("");
  kind.value=padKindOf(pid);
  kind.onclick=e=>e.stopPropagation();
  kind.onchange=()=>padSetKind(pid,kind.value);
  head.appendChild(kind);
  // THE GYROSCOPE. Only a DualShock has one — an Xbox pad has nowhere to put motion — so the
  // tick-box exists only on the pads that can honour it, rather than sitting there greyed out
  // asking to be clicked. Off by default: it turns a pad that costs nothing until used into one
  // that streams a report every frame.
  const p2=padById(pid);
  if(p2&&p2.canMotion&&p2.kind!=="wii"){
    const lab=document.createElement("label");lab.className="ph-motion";
    lab.title=_gl("Pad wysyła też swój żyroskop i akcelerometr, tak jak prawdziwy DualShock. Czyta to Steam Input i Cemu; Dolphin na Windowsie nie, on bierze ruch z karty „Ruch do emulatorów”.",
                  "The pad also sends its gyroscope and accelerometer, the way a real DualShock does. Steam Input and Cemu read it; Dolphin on Windows does not, it takes motion from the “Motion to emulators” card.");
    const cb=document.createElement("input");cb.type="checkbox";cb.checked=!!p2.motion;
    cb.onclick=e=>e.stopPropagation();
    cb.onchange=()=>padSetMotion(pid,cb.checked);
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(_gl("żyroskop","gyroscope")));
    head.appendChild(lab);
  }
  const tools=document.createElement("div");tools.className="ph-tools";
  // NAD GRĘ — TEN KONTROLER (2026-09-11). Stoi tutaj, bo tutaj stoi RZECZ, o którą chodzi: pod
  // spodem jest scalony rysunek pada ze wszystkimi kapslami, a to jest zdanie „ten, nad grą".
  // Ta sama ikona i ten sam gest, co na kapslu w „Twoje urządzenia" (`.dp-ovl`, rf-11) — więc nie
  // ma tu nowej wiedzy do przekazania, tylko drugi przedmiot, który umie to samo.
  //
  // Zgłoszenie, z którego to wyszło: „aktywuję nakładkę z kontrolerem na kapslu 2, a kontroler
  // obsługiwany jest przez kapsel 1 i 2 — widzę tylko input z kapsla 2". Droga przez kapsel
  // prowadziła do okna JEDNEJ ręki; ta prowadzi do okna całego kontrolera.
  const ovl=document.createElement("button");ovl.type="button";ovl.className="ph-tool ph-ovl";
  ovl.innerHTML='<span class="rfic ovl-ic" aria-hidden="true"></span>';
  {const win=_padOvlWin(pid);
   ovl.classList.toggle("is-on",!!(win&&win.running));
   ovl.title=win?(win.running?_gl("Zamknij okienko tego kontrolera znad gry.","Take this controller's little window off the game.")
                             :_gl("Pokaż ten kontroler nad grą — wszystkie kapsle, które na nim grają, na jednym rysunku.",
                                  "Show this controller over the game — every capsule that plays on it, on one drawing."))
                :_gl("Pokaż ten kontroler nad grą — wszystkie kapsle, które na nim grają, na jednym rysunku.",
                     "Show this controller over the game — every capsule that plays on it, on one drawing.");
   ovl.setAttribute("aria-label",ovl.title);
   // Kontroler bez kapsla nie ma czego pokazać — przycisk zostaje na miejscu i mówi dlaczego,
   // zamiast znikać (ta sama zasada, co przy ✕ ostatniego kontrolera niżej).
   if(!padMembers(pid).length){ovl.disabled=true;
     ovl.title=_gl("Najpierw wepnij w ten kontroler kapsel — pusty nie ma czego pokazać nad grą.",
                   "Plug a capsule into this controller first — an empty one has nothing to show over the game.");
     ovl.setAttribute("aria-label",ovl.title);}
   ovl.onclick=e=>{e.stopPropagation();padOverlayToggle(pid);};}
  tools.appendChild(ovl);
  const ren=document.createElement("button");ren.type="button";ren.className="ph-tool";
  ren.innerHTML='<span aria-hidden="true">✎</span>';
  ren.title=_gl("Zmień nazwę kontrolera","Rename this controller");
  ren.setAttribute("aria-label",ren.title);
  ren.onclick=e=>{e.stopPropagation();padRenameStart(pid,head);};
  tools.appendChild(ren);
  // ✕ IS ALWAYS DRAWN, even on the only controller — where it is drawn DISABLED, saying why.
  // It used to be absent there, so the guide's "✕ go usuwa" described a button that was not on
  // the screen and the reader was left looking for it. The rule itself is the server's and is not
  // negotiable (pad_delete: "Musi zostać co najmniej jeden kontroler") — a capsule with no
  // controller to plug back into would have no way home — so the honest interface is the control
  // present and explaining itself, not the control missing.
  // The bin, not ✕: on this same tile ✕ on a capsule chip means "unplug", and the bin means
  // "remove" everywhere else in the app.
  const del=document.createElement("button");del.type="button";del.className="ph-tool danger";
  del.innerHTML='<span class="bic bic-bin" aria-hidden="true"></span>';
  if(count>1){
    del.title=_gl("Usuń kontroler","Remove this controller");
    del.setAttribute("aria-label",_gl("Usuń kontroler","Remove this controller"));
    del.onclick=e=>{e.stopPropagation();padDelete(pid);};
  }else{
    del.disabled=true;
    del.title=_gl("Ostatniego kontrolera nie da się usunąć — musi zostać co najmniej jeden. Kapsel odpinasz ✕ na jego chipie: ląduje wtedy na tacce „Kapsle bez kontrolera”.",
                  "The last controller cannot be removed — at least one has to stay. To unplug a capsule use the ✕ on its chip: it lands in the “Capsules with no controller” tray.");
    del.setAttribute("aria-label",del.title);
  }
  tools.appendChild(del);
  head.appendChild(tools);
  return head;
}

// One capsule, on the controller it plays on. The picker is the assignment: every controller in
// the list, so moving a capsule is one choice rather than a rule about who owns what.
function _padChip(dev,pid,owners){
  const chip=document.createElement("div");
  chip.className="ph-chip"+(dev===state.activeDeviceId?" active":"");
  chip.dataset.dev=dev;
  chip.style.setProperty("--dcol",padCapColor(dev));
  chip.title=_gl("Kliknij, aby ustawiać ten kapsel","Click to edit this capsule");
  chip.innerHTML=(typeof capImgSpan==="function"?capImgSpan(dev,18):"")+
    '<b>'+esc(padCapName(dev))+'</b>';
  if(owners.length>1){
    const sel=document.createElement("select");
    sel.className="ph-share";
    sel.title=_gl("Na którym kontrolerze gra ten kapsel","Which controller this capsule plays on");
    sel.setAttribute("aria-label",_gl("Kontroler dla kapsla ","Controller for capsule ")+padCapName(dev));
    // …and "none of them", which is the ✕ next to it said in a way a keyboard can reach.
    sel.innerHTML=owners.map(o=>'<option value="'+esc(o)+'">'+esc(padLabel(o))+'</option>').join("")+
      '<option value="'+GPV_PAD_OFF+'">'+esc(_gl("bez kontrolera","no controller"))+'</option>';
    sel.value=pid;
    sel.onchange=()=>{if(sel.value===GPV_PAD_OFF)padDetach(dev);else padAssign(dev,sel.value);};
    sel.onclick=e=>e.stopPropagation();       // opening the picker must not re-target the map
    chip.appendChild(sel);
  }
  // UNPLUG. On every chip, including the one on a single controller — with one pad the picker
  // above is not drawn, and this is then the only way to say "this capsule presses no pad".
  const off=document.createElement("button");off.type="button";off.className="ph-chip-off";
  off.innerHTML='<span aria-hidden="true">✕</span>';
  off.title=_gl("Odepnij ten kapsel od kontrolera","Unplug this capsule from the controller");
  off.setAttribute("aria-label",off.title+": "+padCapName(dev));
  off.onclick=e=>{e.stopPropagation();padDetach(dev);};
  chip.appendChild(off);
  chip.draggable=true;
  chip.addEventListener("dragstart",e=>{
    state._padDrag=dev;chip.classList.add("dragging");
    try{e.dataTransfer.setData("text/plain",dev);e.dataTransfer.effectAllowed="move";}catch(_){}});
  chip.addEventListener("dragend",()=>{state._padDrag=null;chip.classList.remove("dragging");
    document.querySelectorAll(".ph-box.drop").forEach(n=>n.classList.remove("drop"));});
  chip.onclick=e=>{
    if(e.target&&e.target.closest&&e.target.closest("select"))return;
    e.stopPropagation();
    if(typeof switchDevice==="function")switchDevice(dev);
    padViewSelect(pid);
  };
  return chip;
}

// WHAT A WII CONTROLLER NEEDS OUTSIDE THE APP. It needs no driver, it needs an ADDRESS, so under
// the drawing it gets where to point the emulator, whether one turned up, and the port. The driver
// of an Xbox or DualShock pad is not in this slot: the readiness line names it and the one
// "missing" box under that line (rf-15 mUpdateAvail) explains it, so it is said once per screen.
function padWiiPanelSync(){
  const owner=padViewOwner();
  const wii=!!owner&&padKindOf(owner)==="wii";
  const pokaz=(id,on)=>{const e=document.getElementById(id);if(e)e.style.display=on?"":"none";};
  pokaz("padWiiAvail",wii);pokaz("padWiiSetup",wii);
  // A type change can make the driver unnecessary (or necessary again): redraw that box now.
  if(typeof mUpdateAvail==="function")try{mUpdateAvail();}catch(e){}
  if(!wii)return;
  const p=padById(owner)||{}, port=p.dsuPort||26760, addr="127.0.0.1:"+port;
  const av=document.getElementById("padWiiAvail");
  if(av){
    const n=p.dsuClients|0;
    let t,cls="",tip="";
    // THE ERROR IS A STATE, NOT A CRASH. It used to be printed as whatever Python said —
    // "⚠ OSError: [WinError 10048] Tylko jedno użycie każdego adresu gniazda…" — which is the
    // one string on this tile that answers none of the three questions the tile exists for.
    // The server now names its own failures (DsuServer.bind_error) and stamps a CODE, so the
    // sentence can be said in the reader's language; the raw text goes to the tooltip, where a
    // bug report can still find it. The ADDRESS stays in the line in every state, because the
    // instructions below tell you to type it and a tile that hides it mid-error is a tile you
    // cannot follow.
    if(p.dsuError){
      cls="warn";tip=p.dsuError;
      const code=p.dsuErrorCode||"";
      t="⚠ "+addr+" — "+(
        (code==="busy")
          ? _gl("port "+port+" jest zajęty: działa już inny serwer DSU albo druga kopia aplikacji. Zamknij go albo zmień port niżej.",
                "port "+port+" is taken: another DSU server, or a second copy of this app, already holds it. Close it or change the port below.")
        :(code==="bind")
          ? _gl("nie udało się otworzyć portu "+port+". Zmień port niżej albo zwolnij ten.",
                "the port "+port+" could not be opened. Change the port below, or free that one.")
          : _gl("serwer ruchu zgłosił błąd. Szczegóły w dymku; zmień port niżej albo uruchom aplikację ponownie.",
                "the motion server reported a problem. Details in the tooltip; change the port below or restart the app."));
    }
    else if(!p.dsuRunning){t="⚠ "+addr+" — "+_gl("serwer ruchu nie działa, kontroler nic nie wyśle.",
                                                 "the motion server is not running, this controller sends nothing.");cls="warn";}
    else if(n<=0){t=_gl("🎮 Serwer ruchu działa na "+addr+" — czeka, aż podłączy się emulator.",
                        "🎮 The motion server is running on "+addr+" — waiting for an emulator.");}
    else{t=(n===1)?_gl("🎮 Emulator podłączony do "+addr+" — kontroler działa.",
                       "🎮 An emulator is connected to "+addr+" — the controller is live.")
                 :_gl("🎮 Podłączone emulatory: "+n+" ("+addr+").","Emulators connected: "+n+" ("+addr+").");
         cls="ok";}
    av.textContent=t;av.className="mouse-avail"+(cls?" "+cls:"");
    if(tip)av.title=tip;else av.removeAttribute("title");
  }
  const st=document.getElementById("padWiiSetup");
  // The instructions carry the port field, which is the way OUT of the error above — so the first
  // time an error appears the fold opens itself. Once only (`_errOpen`), or it would spring back
  // open every second under somebody who closed it on purpose.
  if(st&&p.dsuError&&!st._errOpen){st._errOpen=true;st.open=true;}
  if(st&&!p.dsuError)st._errOpen=false;
  // The rebuild key carries the LANGUAGE as well as the address. Keyed on the address alone, the
  // whole panel — the warning, the Dolphin and Cemu steps, the port row — kept whichever language
  // it happened to be built in: switching the interface to English left a page of Polish
  // instructions sitting under an English summary, because the address had not changed and
  // nothing asked for a redraw. setLang() re-runs padCtlRender, which reaches here.
  const stKey=addr+"|"+((typeof _lang!=="undefined")?_lang:"pl");
  if(st&&st._addr!==stKey){
    const wasOpen=st.open;st._addr=stKey;
    st.innerHTML='<summary><span class="rfic info-ic" aria-hidden="true"></span>'+
      esc(_gl("Kontroler Wii — jak podłączyć emulator i skąd wziąć adres",
              "The Wii controller — how to connect an emulator, and where the address comes from"))+
      ' <span class="setup-badge">'+esc(_gl("przeczytaj","read"))+'</span></summary>'+
      '<div class="setup-body">'+_padWiiHowto(addr,port)+'</div>';
    st.open=wasOpen;
    const pi=st.querySelector(".ph-wii-port input");
    if(pi)pi.onchange=()=>{
      const v=parseInt(pi.value,10);
      if(!(v>=1024&&v<=65535)){pi.value=port;if(typeof rfToast==="function")rfToast("Port musi być z zakresu 1024-65535",{tone:"danger"});return;}  // say WHY the old port came back — the server's own sentence (rf-01 has its EN), not a silent reset
      if(v===port)return;
      fetch("/dsu",{method:"POST",headers:{"Content-Type":"application/json"},
                    body:JSON.stringify({port:v})})
        .then(r=>r.json()).then(m=>{
          if(m&&m.error&&typeof rfToast==="function")rfToast(m.error);
          padsFetch();
        }).catch(()=>{});
    };
  }
}

// Written out rather than linked: both emulators put the setting somewhere nobody guesses
// (Dolphin's is at the BOTTOM of the controller window, under a heading with no "motion" in it),
// and the address to type is ours to state.
function _padWiiHowto(addr, port){
  // The warning comes FIRST and in its own voice, because it is the one thing that turns a
  // correct setup into a wasted evening: this controller is not a device Windows holds.
  const ostrz=_gl(
    "<p class=\"ph-wii-warn\"><b>Tego kontrolera nie widzi Windows.</b> Odbiera go wyłącznie emulator "+
    "mówiący DSU: Dolphin (Wii, GameCube), Cemu (Wii U), Citra, yuzu, Ryujinx, PPSSPP. Zwykła gra ze "+
    "Steama go nie zobaczy — do niej służy kontroler Xbox 360 albo DualShock 4 z tego samego pasa. "+
    "Za to nie wymaga żadnego sterownika i jako jedyny niesie prawdziwy ruch.</p>",
    "<p class=\"ph-wii-warn\"><b>Windows does not see this controller.</b> Only an emulator that speaks "+
    "DSU picks it up: Dolphin (Wii, GameCube), Cemu (Wii U), Citra, yuzu, Ryujinx, PPSSPP. An ordinary "+
    "Steam game will not see it — that is what an Xbox 360 or DualShock 4 controller from the same "+
    "strip is for. In exchange it needs no driver at all, and it is the only one carrying real motion.</p>");
  // The port sits with the instructions rather than in a settings screen: it is the second half of
  // the address you are being told to type, and the only reason to change it is that another DSU
  // server already holds the default.
  const portRow='<label class="ph-wii-port">'+esc(_gl("port serwera","server port"))+
    '<input type="number" min="1024" max="65535" value="'+(port||26760)+'"></label>';
  return ostrz+portRow+_gl(
    "<p><b>Dolphin (Wii, GameCube)</b></p><ol>"+
    "<li>Opcje → <b>Ustawienia kontrolerów</b>, na samym dole sekcja <b>Alternate Input Sources</b>: zaznacz <b>Enable</b> i wpisz <code>"+addr+"</code>.</li>"+
    "<li>Jako <b>Wiilot 1</b> wybierz <b>Emulated Wii Remote</b> i kliknij <b>Configure</b>.</li>"+
    "<li>W polu <b>Device</b> wybierz pozycję <code>DSUClient/…</code>.</li>"+
    "<li>Rozwiń <b>Motion Input</b> i klikaj kolejne pola, ruszając kapslem w stronę, którą pole opisuje. Dolphin sam wpisze oś. Przyciski mapujesz tak samo.</li>"+
    "<li>Celowanie na ekranie: <b>Motion Simulation → Point</b> liczy je z żyroskopu, bez paska sensora.</li>"+
    "</ol><p><b>Cemu (Wii U)</b></p><ol>"+
    "<li>Options → <b>Input settings</b> → źródło ruchu <b>DSU1</b>, adres <code>"+addr+"</code>, potem <b>Refresh</b>.</li>"+
    "</ol><p>Ten sam adres przyjmą Citra, yuzu, Ryujinx i PPSSPP, bo protokół jest jeden.</p>",

    "<p><b>Dolphin (Wii, GameCube)</b></p><ol>"+
    "<li>Options → <b>Controller Settings</b>, at the very bottom the <b>Alternate Input Sources</b> section: tick <b>Enable</b> and enter <code>"+addr+"</code>.</li>"+
    "<li>Set <b>Wii Remote 1</b> to <b>Emulated Wii Remote</b> and click <b>Configure</b>.</li>"+
    "<li>In <b>Device</b> pick the <code>DSUClient/…</code> entry.</li>"+
    "<li>Expand <b>Motion Input</b> and click each field while moving the capsule the way that field describes. Dolphin fills the axis in for you. Buttons map the same way.</li>"+
    "<li>Pointing at the screen: <b>Motion Simulation → Point</b> derives it from the gyroscope, with no sensor bar.</li>"+
    "</ol><p><b>Cemu (Wii U)</b></p><ol>"+
    "<li>Options → <b>Input settings</b> → motion source <b>DSU1</b>, address <code>"+addr+"</code>, then <b>Refresh</b>.</li>"+
    "</ol><p>The same address works for Citra, yuzu, Ryujinx and PPSSPP, it is one protocol.</p>");
}

// The empty controller's own row: what it is waiting for, and a picker that fills it.
function _padEmptySlot(pid,ids){
  const wrap=document.createElement("div");wrap.className="ph-emptyslot";
  const t=document.createElement("span");t.className="ph-emptytxt";
  t.textContent=ids.length?_gl("brak kapsli","no capsules yet")
                          :_gl("czeka na pierwszy kapsel","waiting for a first capsule");
  wrap.appendChild(t);
  if(ids.length){
    const sel=document.createElement("select");sel.className="ph-share ph-add";
    sel.title=_gl("Przypisz kapsel do tego kontrolera","Plug a capsule into this controller");
    sel.setAttribute("aria-label",_gl("Przypisz kapsel do tego kontrolera","Plug a capsule into this controller"));
    sel.innerHTML='<option value="">'+esc(_gl("+ przypisz kapsel","+ plug a capsule in"))+'</option>'+
      ids.map(d=>'<option value="'+esc(d)+'">'+esc(padCapName(d))+'</option>').join("");
    sel.onchange=()=>{const d=sel.value;sel.value="";if(d)padAssign(d,pid);};
    sel.onclick=e=>e.stopPropagation();
    wrap.appendChild(sel);
  }
  return wrap;
}

// "+ Kontroler", and the pad it will be. A small button rather than a tile the size of a
// controller (F-G3-03): a second controller is rare, and the big tile pushed the drawing of the pad
// below the fold. The type picker stays right next to it, so the choice is made BEFORE the click,
// and the one-line "why this type" moved into the picker's tooltip. Disabled at the ceiling WITH
// the reason on it: four is Windows' limit, not ours.
function _padAddTile(count){
  const max=(state.padMax||4), full=(count>=max);
  const wrap=document.createElement("div");wrap.className="ph-add-wrap";
  const t=document.createElement("button");
  t.type="button";t.className="btn sm ph-add-tile";
  t.innerHTML='<span class="bic bic-plus" aria-hidden="true"></span><span>'+esc(_gl("Kontroler","Controller"))+'</span>';
  t.setAttribute("aria-label",_gl("Utwórz wirtualny kontroler","Create a virtual controller"));
  if(full){
    t.disabled=true;
    t.title=_gl("Windows pokazuje grze najwyżej "+max+" kontrolery, usuń jeden, żeby dodać nowy",
                "Windows shows a game at most "+max+" controllers, remove one to add another");
  }else{
    t.title=_gl("Nowy pad, do którego przypniesz jeden albo kilka kapsli",
                "A new pad you plug one or several capsules into");
  }
  const row=document.createElement("label");row.className="ph-add-kind";
  const cap=document.createElement("span");cap.textContent=_gl("typ:","type:");
  const sel=document.createElement("select");
  sel.setAttribute("aria-label",_gl("Typ nowego kontrolera","Type of the new controller"));
  sel.innerHTML=padKinds().map(k=>'<option value="'+esc(k.id)+'">'+esc(k.label)+'</option>').join("");
  sel.value=state.padNewKind||"x360";
  sel.disabled=full;
  // Remembered for the next click only (not saved): the picker is next to the button, so what it
  // says IS the answer, and a type persisted behind the scenes would be a decision nobody made.
  const setWhy=()=>{sel.title=padKindWhy(sel.value);};
  sel.onchange=()=>{state.padNewKind=sel.value;setWhy();};
  sel.onclick=e=>e.stopPropagation();
  setWhy();
  row.appendChild(cap);row.appendChild(sel);
  t.onclick=e=>{e.stopPropagation();padCreate(sel.value);};
  wrap.appendChild(t);wrap.appendChild(row);
  return wrap;
}

// ---------------------------------------------------------------------------
//  THE REGISTRY — create / rename / remove / plug in
// ---------------------------------------------------------------------------
// One shape for every call: the server answers with the WHOLE registry, so the strip redraws from
// the reply instead of guessing, and the same payload reaches every other open dashboard as the
// "pads" event.
function _padsPost(body){
  return fetch("/pads",{method:"POST",headers:{"Content-Type":"application/json"},
                        body:JSON.stringify(body)})
    .then(r=>r.json())
    .then(m=>{
      if(m&&Array.isArray(m.pads))_padsTake(m);
      if(m&&m.ok===false&&m.error&&typeof rfToast==="function")rfToast(m.error);
      return m;
    })
    .catch(()=>{if(typeof rfToast==="function")rfToast(_gl("Serwer nieosiągalny","Server unreachable"));return null;});
}
function _padsTake(m){
  state.pads=Array.isArray(m.pads)?m.pads:[];
  if(m.max)state.padMax=m.max;
  if(Array.isArray(m.free))state.padFree=m.free;
  if(Array.isArray(m.kinds)&&m.kinds.length)state.padKinds=m.kinds;
  padCtlRender();
}
function padsFetch(){
  fetch("/pads").then(r=>r.json()).then(m=>{if(m&&Array.isArray(m.pads))_padsTake(m);}).catch(()=>{});
}
// The "pads" SSE event (rf-08): another window added, renamed or removed a controller.
function onPads(m){ _padsTake(m||{}); }

function padCreate(kind){
  _padsPost({action:"create",kind:kind||"x360"}).then(m=>{
    if(m&&m.ok&&m.id){padViewSelect(m.id);
      if(typeof rfToast==="function")rfToast(_gl("Nowy kontroler gotowy — przypisz do niego kapsel",
                                                 "New controller ready — plug a capsule into it"));}
  });
}
// Swapping the device a controller IS. It asks first, because the pad already in front of a game
// does not morph: the old one unplugs and a new one appears, and a game mid-session can react to
// that. What does NOT change is worth saying in the same breath, since it is the thing people
// fear: the mappings stay, `pad:a` is simply Cross on the DualShock.
function padSetKind(pid,kind){
  const want=String(kind||""), have=padKindOf(pid);
  if(!want||want===have){padCtlRender();return;}
  const go=()=>_padsPost({action:"kind",id:pid,kind:want}).then(m=>{
    if(m&&m.ok&&m.changed&&typeof rfToast==="function")
      rfToast(_gl("Typ zmieniony.","Type changed.")+" "+padLabel(pid)+": "+padKindLabel(want));
  });
  const toWii=(want==="wii"), fromWii=(have==="wii");
  const what=(toWii||fromWii)
    ? _gl("To zmienia drogę, którą ten kontroler wychodzi. "+
          (toWii?"Przestanie być urządzeniem Windows i zobaczy go tylko emulator mówiący DSU."
                :"Stanie się zwykłym padem, który widzi Windows, i przestanie odpowiadać emulatorowi."),
          "This changes the road this controller goes out by. "+
          (toWii?"It stops being a Windows device, and only an emulator speaking DSU will see it."
                :"It becomes an ordinary pad Windows holds, and stops answering the emulator."))
    : _gl("Windows zobaczy, że stary kontroler znika, a na jego miejsce wchodzi nowy. Gra, która już działa, może potrzebować ponownego wykrycia pada.",
          "Windows will see the old controller unplug and a new one take its place. A game that is already running may need to pick the pad up again.");
  const msg=_gl(padLabel(pid)+" zmieni się na "+padKindLabel(want)+". ","Switch "+padLabel(pid)+" to "+padKindLabel(want)+". ")+
    what+" "+_gl("Mapowania zostają bez zmian.","Your mappings stay exactly as they are.");
  if(typeof rfConfirm==="function"){
    rfConfirm(msg,{title:_gl("Zmień typ kontrolera","Change the controller type"),
                   confirmLabel:_gl("Zmień","Change")})
      .then(ok=>{if(ok)go();else padCtlRender();});   // no = put the picker back where it was
  }else go();
}
// The gyroscope tick-box. No confirmation: unlike the pad TYPE this changes nothing about the
// device Windows is holding, only what its report carries, so a game sees the same controller
// with motion appearing or going quiet.
function padSetMotion(pid,on){
  _padsPost({action:"motion",id:pid,motion:!!on}).then(m=>{
    if(m&&m.ok&&m.changed&&typeof rfToast==="function")
      rfToast(padLabel(pid)+": "+(on?_gl("żyroskop włączony","gyroscope on")
                                    :_gl("żyroskop wyłączony","gyroscope off")));
    if(m&&m.ok===false)padCtlRender();     // refused (an Xbox pad) — put the box back
  });
}
// A REFUSAL IS SAID OUT LOUD (2026-09-07). Both of these used to return in silence when the server
// answered `ok:false` or did not answer at all — the chip stayed where it was and the person at the
// keyboard was left with "drag and drop does not work" and no way to tell that from a bug. Reported
// exactly in those words; the sentence below is what would have answered it.
function _padRefused(m,what){
  if(typeof rfToast!=="function")return;
  const why=(m&&m.error)?String(m.error):_gl("brak odpowiedzi RibbitFlipa","no answer from RibbitFlip");
  rfToast(what+": "+why);
}
function padAssign(dev,pid){
  if(!dev||!pid)return;
  _padsPost({action:"assign",dev:dev,pad:pid}).then(m=>{
    if(!m||m.ok===false){_padRefused(m,_gl("Nie udało się przypiąć "+padCapName(dev),"Could not plug in "+padCapName(dev)));padCtlRender();return;}
    // Keep the local copies in step with the server rather than waiting for the echo: the strip,
    // the drawing and the Motion card all read the capsule's own config, not the registry.
    const D=state.devices&&state.devices[dev];
    if(D){D.padShare=pid;D.mouseCfg=Object.assign({},D.mouseCfg||{},{padShare:pid});}
    if(dev===state.activeDeviceId&&state.mouse)state.mouse.padShare=pid;
    padViewSelect(pid);
    if(typeof mFill==="function")try{mFill();}catch(e){}
  });
}
// UNPLUG — the ✕ on a chip, and the other half of a drag onto the tray. Not a confirmation
// dialog: it is one click to undo (drag it back, or pick a controller on the chip in the tray),
// and the thing it costs is said in the toast instead of asked about in a modal. The count is
// there because "my buttons stopped working" a day later is the failure this sentence prevents.
function padDetach(dev){
  if(!dev)return;
  const n=padRuleCount(dev);
  _padsPost({action:"assign",dev:dev,pad:GPV_PAD_OFF}).then(m=>{
    if(!m||m.ok===false){_padRefused(m,_gl("Nie udało się odpiąć "+padCapName(dev),"Could not unplug "+padCapName(dev)));padCtlRender();return;}
    const D=state.devices&&state.devices[dev];
    if(D){D.padShare=GPV_PAD_OFF;D.mouseCfg=Object.assign({},D.mouseCfg||{},{padShare:GPV_PAD_OFF});}
    if(dev===state.activeDeviceId&&state.mouse)state.mouse.padShare=GPV_PAD_OFF;
    if(typeof mFill==="function")try{mFill();}catch(e){}
    padCtlRender();
    if(typeof rfToast==="function"){
      rfToast(n
        ? _gl(padCapName(dev)+" bez kontrolera. "+_padMapsWord(n)+" bez wyjścia, na rysunku czerwone.",
              padCapName(dev)+" is on no controller. "+_padMapsWord(n)+" with nowhere to go, red on the drawing.")
        : _gl(padCapName(dev)+" bez kontrolera. Klawiatura, mysz i makra działają dalej.",
              padCapName(dev)+" is on no controller. Keyboard, mouse and macros still work."));
    }
  });
}
function padDelete(pid){
  const mem=padMembers(pid), rest=padOwners().filter(o=>o!==pid);
  if(!rest.length)return;
  const to=rest[0];
  const msg=mem.length
    ? _gl("Usunąć "+padLabel(pid)+"? Kapsle na nim ("+mem.map(padCapName).join(", ")+
          ") przejdą na "+padLabel(to)+".",
          "Remove "+padLabel(pid)+"? The capsules on it ("+mem.map(padCapName).join(", ")+
          ") will move to "+padLabel(to)+".")
    : _gl("Usunąć "+padLabel(pid)+"? Nie gra na nim żaden kapsel.",
          "Remove "+padLabel(pid)+"? No capsule is playing on it.");
  const go=()=>_padsPost({action:"delete",id:pid,moveTo:to}).then(m=>{
    if(m&&m.ok&&state._padView===pid)padViewSelect(to);
  });
  if(typeof rfConfirm==="function"){
    rfConfirm(msg,{title:_gl("Usuń kontroler","Remove controller"),tone:"danger",
                   confirmLabel:_gl("Usuń","Remove")}).then(ok=>{if(ok)go();});
  }else go();
}
// Rename in place: the head turns into one input. A modal for a single short word would be three
// interactions where one is enough, and the name is visible right where it is being typed.
function padRenameStart(pid,head){
  if(!head||head.querySelector(".ph-rename"))return;
  const p=padById(pid);
  const inp=document.createElement("input");
  inp.type="text";inp.className="ph-rename";inp.maxLength=40;
  inp.value=(p&&p.name)||"";
  inp.placeholder=_gl("nazwa (np. lewa ręka)","name (e.g. left hand)");
  inp.setAttribute("aria-label",_gl("Nazwa kontrolera","Controller name"));
  const done=(save)=>{
    if(inp._gone)return; inp._gone=true;
    const v=inp.value.trim();
    inp.remove();
    if(save&&v!==((p&&p.name)||""))_padsPost({action:"rename",id:pid,name:v});
    else padCtlRender();
  };
  inp.onclick=e=>e.stopPropagation();
  inp.onkeydown=e=>{
    e.stopPropagation();
    if(e.key==="Enter"){e.preventDefault();done(true);}
    else if(e.key==="Escape"){e.preventDefault();done(false);}
  };
  inp.onblur=()=>done(true);
  head.appendChild(inp);
  setTimeout(()=>{inp.focus();inp.select();},10);
}

// ---------------------------------------------------------------------------
//  THE MAP — one merged drawing of the viewed pad, plus the legend
// ---------------------------------------------------------------------------
function padViewRender(){
  const box=document.getElementById("padViewBox"); if(!box)return;
  const owner=padViewOwner();
  _padCfgHeadSync(owner);
  if(!owner){box.innerHTML="";const lg=document.getElementById("padLegend");if(lg)lg.innerHTML="";return;}
  // Rebuilt only when the map moves to ANOTHER controller — the drawing is painted per frame
  // (padViewFrame), and rebuilding it there would throw away the per-element caches mid-press.
  // The rebuild key carries the TYPE as well as the pad. Without it, switching a controller from
  // Xbox to DualShock left the old drawing on screen — the pad id had not changed, so nothing
  // asked for a redraw, and the picture went on describing a controller that no longer existed.
  const kind=padKindOf(owner);
  if(box.dataset.owner!==owner||box.dataset.kind!==kind){
    box.dataset.owner=owner;box.dataset.kind=kind;
    // gpvHtml wants a capsule (it stamps data-dev on the widget). The map belongs to the PAD, so it
    // gets the first capsule plugged in — and nothing at all when the controller is still empty,
    // which keeps the cheat-sheet painter (gpvFrame, keyed on data-dev) out of this drawing.
    const first=padMembers(owner)[0]||"";
    box.innerHTML='<div class="pad-map editable">'+((typeof gpvHtml==="function")?gpvHtml(first,kind):"")+'</div>';
    // The cheat-sheet widget carries a long explanatory tooltip; on the interactive map it pops
    // over the very parts being aimed at (and over the green plus), and the legend below already
    // says everything it said.
    const tp=box.querySelector(".ov-pad"); if(tp)tp.removeAttribute("title");
  }
  _padPartsA11y(box,kind);
  _padDpadToggleSync(box);
  padWiiPanelSync();
  padLegendRender();
  padCtlMarkSel();
}

// ---------------------------------------------------------------------------
//  THE DRAWING, FOR SOMEBODY NOT USING A MOUSE
// ---------------------------------------------------------------------------
// The drawing is this screen's main navigation — "rysunek to spis: kliknij część pada" — and it
// was built out of bare <span>s: no name, no role, no tab stop. A pointer could reach every part
// and a keyboard could reach none, and a screen reader was told there was nothing there at all.
// So each part becomes a button in the accessibility tree, with the name of the thing it opens.
//
// The names are written HERE rather than taken from gpvLabel alone because two of them differ
// from the button's lettering: clicking a stick opens the STICK (its tuning), not "L3", and with
// the cross set to one module clicking an arrow opens the D-PAD, not "krzyżak ↑". The label has
// to say what the click will do, or it is a button lying about itself.
function _padPartAria(b,kind,dpm){
  if(b==="ls"||b==="rs"){
    if(kind==="wii")return (b==="rs")?_gl("Prawy drążek · DSU","Right stick · DSU")
                                     :_gl("Drążek Nunchuka","Nunchuk stick");
    return (b==="rs")?_gl("Prawy drążek","Right stick"):_gl("Lewy drążek","Left stick");
  }
  if(dpm&&(b==="up"||b==="down"||b==="left"||b==="right"))return _gl("Krzyżak","D-pad");
  return (typeof gpvLabel==="function")?gpvLabel(b,kind):b;
}
function _padPartsA11y(box,kind){
  const dpm=(typeof _dpadModuleOn==="function")?_dpadModuleOn():true;
  const openHint=_gl("kliknij albo naciśnij Enter, aby otworzyć ustawienia tej części",
                     "click, or press Enter, to open this part's settings");
  const mapHint=_gl("kliknij albo naciśnij Enter, aby dodać albo otworzyć mapowanie",
                    "click, or press Enter, to add or open a mapping");
  for(const sp of box.querySelectorAll(".gpv span[data-b]")){
    const b=sp.dataset.b;
    // A part this controller does not have (an Xbox pad's touchpad) is hidden by CSS and must not
    // become a tab stop that opens a panel for a thing that is not there.
    const has=(typeof gpvHas==="function")?gpvHas(b,kind):true;
    if(!has){sp.removeAttribute("role");sp.removeAttribute("tabindex");
             sp.setAttribute("aria-hidden","true");sp.removeAttribute("title");continue;}
    sp.removeAttribute("aria-hidden");
    if(sp.getAttribute("role")!=="button")sp.setAttribute("role","button");
    if(sp.getAttribute("tabindex")!=="0")sp.setAttribute("tabindex","0");
    const name=_padPartAria(b,kind,dpm);
    const module=(b==="ls"||b==="rs"||(dpm&&(b==="up"||b==="down"||b==="left"||b==="right")));
    const title=name+" — "+(module?openHint:mapHint);
    // rf-05 moves `title` into `data-rftip` right after render (that is how this app's tooltips
    // work), so the guard has to look at both — otherwise every render would write a title back
    // for the tooltip module to move again.
    if(sp.title!==title&&sp.getAttribute("data-rftip")!==title)sp.title=title;
    // The Guide part's aria-label belongs to the frame painter — it carries the controller NUMBER
    // ("Kontroler 2"), which is the one thing on this drawing a game actually sees. Left alone.
    if(b!=="guide"&&sp.getAttribute("aria-label")!==name)sp.setAttribute("aria-label",name);
  }
}

// The head of the SECOND section, naming the controller it configures ("Kontroler 2 · nazwa").
// It keeps the strip and the map below reading as two sections and answers "which controller am
// I editing" without looking back at the strip. Under it, the one instruction of the screen,
// until a part of the drawing is picked: after that the right column names the part, and the
// sentence would only repeat what was just done. Composed with _gl() on every render, so a
// language switch rewrites it; with no controller to show, the head and the sentence hide.
function _padCfgHeadSync(owner){
  const head=document.getElementById("padCfgHead"); if(!head)return;
  const lead=document.getElementById("padCfgHint");
  head.style.display=owner?"":"none";
  if(lead)lead.hidden=!owner||!!state._padPart;
  if(!owner)return;
  const t=document.getElementById("padCfgTitle");
  const txt=padLabel(owner);
  if(t&&t.textContent!==txt)t.textContent=txt;
  const hint=_gl("Kliknij gałkę, krzyżak albo przycisk na rysunku, żeby go ustawić.",
                 "Click a stick, the d-pad or a button on the drawing to set it up.");
  if(lead&&lead.textContent!==hint)lead.textContent=hint;
}

// THE PRESET BAR WAITS FOR SOMETHING TO NAME (F-G3-03). "These settings have no name, save them as
// a preset" stood above everything on a screen where nothing had been set yet, and on a 720 px
// window it was one of the strips that pushed the drawing below the fold. The client has no copy
// of the factory defaults to compare against, so "nothing set yet" is read from the two things a
// person does first here: switching the motion onto the pad and adding a pad mapping. The
// Library tab keeps "Save as preset" at all times.
function _padFreshSync(){
  const tab=document.getElementById("tab-kontroler"); if(!tab)return;
  const m=state.mouse||{};
  const fresh=!(m.enabled&&m.mode!=="mouse")&&!padRuleCount(state.activeDeviceId);
  tab.classList.toggle("pad-fresh",fresh);
}

// The d-pad's own toggle: is the cross ONE motion module (click any arrow -> the d-pad
// configurator) or FOUR separate buttons (click an arrow -> map that arrow, green plus and all)?
// A view preference (rf-43 _dpadModuleOn), not engine config — flipping it never touches rules or
// the motion mode.
// It used to float ON the drawing, absolutely positioned at 1.5%/76%, where it covered the pad's
// left grip and had to be shoved somewhere else again for the Wii body. Now it sits in the flow
// UNDER the drawing, above the caption: it is a caption about the drawing, and a caption does not
// have to stand on the thing it describes.
function _padDpadToggleSync(box){
  const pad=box.querySelector(".ov-pad"), wrap=box.querySelector(".pad-map");
  if(!pad||!wrap)return;
  const on=(typeof _dpadModuleOn==="function")?_dpadModuleOn():true;
  wrap.classList.toggle("dpm",on);
  let t=wrap.querySelector(".pm-dpm");
  if(!t){
    t=document.createElement("label");
    t.className="pm-dpm";
    t.innerHTML='<input type="checkbox"><span class="pm-dpm-lbl"></span>';
    t.querySelector("input").addEventListener("change",e=>padDpadModuleSet(!!e.target.checked));
    const bx=wrap.querySelector(".ov-padbox"), cap=wrap.querySelector(".ov-pad-cap");
    if(bx&&cap)bx.insertBefore(t,cap); else (bx||wrap).appendChild(t);
  }
  const inp=t.querySelector("input"), lbl=t.querySelector(".pm-dpm-lbl");
  if(inp.checked!==on)inp.checked=on;
  const txt=_gl("Krzyżak jako moduł ruchu","D-pad as one motion module");
  if(lbl.textContent!==txt)lbl.textContent=txt;
  const tip=_gl("Włączone: cały krzyżak to jeden moduł sterowany ruchem kapsla — klik na krzyżaku otwiera jego ustawienia. Wyłączone: każda strzałka to osobny przycisk pada — klik strzałki zakłada jej mapowanie.",
                "On: the whole d-pad is one module driven by the capsule's motion — clicking the cross opens its settings. Off: each arrow is a separate pad button — clicking an arrow starts its mapping.");
  if(t.title!==tip){t.title=tip;inp.setAttribute("aria-label",txt+" — "+tip);}
}
function padDpadModuleSet(on){
  state._dpadModule=!!on;
  try{localStorage.setItem("ribbitflip.dpadModule",on?"1":"0");}catch(e){}
  // Renormalise the selection through the new lens: a module selection cannot survive buttons
  // mode (it clears), an arrow selection collapses into the module the moment it becomes one.
  const p=state._padPart;
  if(typeof padPartSelect==="function"){
    if(!on&&p==="dpad")padPartSelect(null);
    else if(on&&(p==="up"||p==="down"||p==="left"||p==="right"))padPartSelect(p);
  }
  padCtlRender();
}

// The legend: every capsule plugged into the viewed pad — its colour, what it contributes, and
// whether its motion is really running. It is ALSO the switch: clicking a row makes that capsule
// the one being edited, which is what the right column edits. The sentences are composed with
// _gl() at build time; setLang() re-runs padCtlRender, so they follow the language.
function padLegendRender(){
  const lg=document.getElementById("padLegend"); if(!lg)return;
  lg.innerHTML="";
  const mem=padViewMembers(); if(!mem.length)return;
  for(const dev of mem){
    const D=state.devices[dev]; if(!D)continue;
    const cfg=padCfgOf(dev)||{};
    const parts=[];
    if(cfg.mode==="stick"){
      if(cfg.stickBackend==="gamepad")parts.push((cfg.stickWhich==="right")?_gl("prawy drążek","right stick"):_gl("lewy drążek","left stick"));
      else if(cfg.stickBackend==="touchpad")parts.push(_gl("palec na touchpadzie","a finger on the touchpad"));
      else parts.push(_gl("drążek → klawiatura (WSAD)","stick → keyboard (WASD)"));
    }else if(cfg.mode==="dpad"){
      parts.push((cfg.dpadBackend==="gamepad")?_gl("krzyżak","d-pad"):_gl("krzyżak → klawiatura","d-pad → keyboard"));
    }else if(cfg.mode==="mouse"&&cfg.enabled){
      parts.push(_gl("steruje teraz myszą","drives the mouse right now"));
    }
    let nRules=0;
    for(const r of (D.rules||[]))if((typeof gpvRuleButtons==="function")&&gpvRuleButtons(r).length)nRules++;
    if(nRules)parts.push(_padMapsWord(nRules));
    const row=document.createElement("div");
    row.className="pl-row"+(dev===state.activeDeviceId?" active":"");
    row.dataset.dev=dev;
    row.style.setProperty("--dcol",padCapColor(dev));
    row.setAttribute("role","button");row.tabIndex=0;
    row.title=_gl("Kliknij, aby ustawiać ten kapsel","Click to edit this capsule");
    // Kropka mówi „ten kapsel PROWADZI ruch na tym padzie", a nie „moduł ma włącznik na On" —
    // zaparkowany ruch (`padPark`) nie prowadzi niczego, choć moduł jest włączony i przyciski jadą.
    const liveMotion=!!(cfg.enabled&&cfg.mode!=="mouse"&&!cfg.padPark);
    row.innerHTML='<span class="pl-dot'+(liveMotion?" on":"")+'" aria-hidden="true"></span>'+
      (typeof capImgSpan==="function"?capImgSpan(dev,18):"")+
      '<b>'+esc(padCapName(dev))+'</b>'+
      '<span class="pl-what">'+esc(parts.length?parts.join(" · "):_gl("nic jeszcze nie podpięte","nothing plugged in yet"))+'</span>'+
      (dev===state.activeDeviceId?'<span class="pl-you">'+esc(_gl("edytujesz teraz","editing now"))+'</span>':'');
    const pick=()=>{
      if(dev!==state.activeDeviceId&&typeof switchDevice==="function")switchDevice(dev);
      padCtlRender();
    };
    row.onclick=pick;
    row.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick();}};
    lg.appendChild(row);
  }
}
// "3 mapowania przycisków" — the number and the noun agree in both languages.
function _padMapsWord(n){
  if(typeof _lang!=="undefined"&&_lang==="en")return n+(n===1?" button mapping":" button mappings");
  if(n===1)return "1 mapowanie przycisku";
  const d=n%10,h=n%100;
  return n+((d>=2&&d<=4&&!(h>=12&&h<=14))?" mapowania przycisków":" mapowań przycisków");
}

// The ring on the selected part. The d-pad is one selection with four faces — all four light up,
// because that is the control. gpvFrame-style painters never touch .sel, so the mark survives the
// 60 fps repaint without a fight.
function padCtlMarkSel(){
  const box=document.getElementById("padViewBox"); if(!box)return;
  const p=(typeof _padPartNorm==="function")?_padPartNorm(state._padPart):null;
  for(const sp of box.querySelectorAll(".gpv span[data-b]")){
    const b=sp.dataset.b;
    const on=!!p&&((p==="dpad")?(b==="up"||b==="down"||b==="left"||b==="right"):(b===p));
    sp.classList.toggle("sel",on);
  }
}

// ---------------------------------------------------------------------------
//  THE FRAME — paint the merged drawing (called every frame from rf-09)
// ---------------------------------------------------------------------------
let _padHubSig=null;
// Everything the strip, the map container and the legend are BUILT from. Deliberately cheap and
// deliberately not the live pad state — buttons going down are the painter's job, and putting them
// in here would rebuild the strip on every press, throwing away an open <select> mid-choice.
function _padHubSigNow(){
  const ids=Object.keys(state.devices||{}).sort();
  return JSON.stringify([ids.map(id=>{
    const D=state.devices[id],meta=(D&&D.meta)||{},cfg=padCfgOf(id)||{};
    return [id,meta.name||"",meta.color||"",meta.cap||"",meta.slot==null?"":meta.slot,
      (typeof gpvPadId==="function")?gpvPadId(id):id,
      // the legend repeats these, so a change must rebuild it
      cfg.mode||"",!!cfg.enabled,cfg.stickWhich||"",cfg.stickBackend||"",cfg.dpadBackend||"",
      (D.rules||[]).length];
  }),
  // The registry itself: a controller can be created, renamed, retyped or removed with no capsule
  // moving, and the strip is the only thing that would show it. The type is in here because every
  // button caption is written in the vocabulary of the pad it belongs to.
  padList().map(p=>[p.id,p.name||"",p.kind||"",!!p.motion,!!p.canMotion,
                    p.dsuPort||0,!!p.dsuRunning,p.dsuClients|0,p.dsuError||"",
                    // …i czy nakładka TEGO kontrolera stoi na ekranie: ikona w nagłówku pudełka
                    // ma świecić razem z oknem, a okno bywa zamykane z zasobnika albo z ekranu
                    // „Nakładka", czyli bez niczyjego kliknięcia w tej zakładce.
                    (function(){const w=_padOvlWin(p.id);return w?(w.wid+(w.running?"!":"")):"";})()]),
  state.activeDeviceId||"",state._padView||"",(typeof _lang!=="undefined")?_lang:""]);
}
function padCtlRender(){
  _padHubSig=_padHubSigNow();
  padHubRender();
  _padFreshSync();
  padViewRender();
  if(typeof padPartSync==="function")try{padPartSync();}catch(e){}
}
function padCtlFrame(){
  const panel=document.getElementById("tab-kontroler");
  if(!panel||!panel.classList.contains("active"))return;
  if(_padHubSigNow()!==_padHubSig)padCtlRender();
  padViewFrame();
}
function padViewFrame(){
  const box=document.getElementById("padViewBox"); if(!box)return;
  const owner=box.dataset.owner; if(!owner||!padById(owner))return;
  const wrap=box.firstElementChild; if(!wrap)return;
  if(!wrap.querySelector(".gpv"))return;        // an empty controller has no drawing to paint
  if(!wrap._m){                                // one lookup per rebuild, kept on the element
    wrap._m={};
    for(const el of wrap.querySelectorAll(".gpv span[data-b]"))wrap._m[el.dataset.b]=el;
    wrap._pad=wrap.querySelector(".ov-pad");
    wrap._num=wrap.querySelector(".gpv-num");
    wrap._txt=wrap.querySelector(".ov-pad-txt");
    wrap._capEl=wrap.querySelector(".ov-pad-cap");
    const bx=wrap.querySelector(".ov-padbox"); if(bx)bx.classList.add("on");
  }
  if(!wrap._pad||!wrap._pad.offsetParent)return;
  // the number — it can change without a rebuild (a controller ahead of this one is removed)
  if(wrap._num){
    const n=padNumOf(owner);
    const shared=padMembers(owner).length>1;
    const key=n+(shared?"s":"");
    if(wrap._numV!==key){
      wrap._numV=key;wrap._num.textContent=String(n);
      wrap._num.parentNode.setAttribute("aria-label",
        _gl("Kontroler ","Controller ")+n+(shared?_gl(" (wspólny)"," (shared)"):""));
      const bx=wrap.querySelector(".ov-padbox"); if(bx)bx.classList.toggle("shared",shared);
    }
  }
  const w=wrap._pad.clientWidth;
  const aw=(typeof gpvArtW==="function")?gpvArtW(padKindOf(owner)):750;
  if(w&&(wrap._w!==w||wrap._aw!==aw)){wrap._w=w;wrap._aw=aw;
    wrap._pad.firstElementChild.style.setProperty("--gpvK",(w/aw).toFixed(4));}

  const snap=padMergedSnap(owner);
  const any=Object.keys(snap.mapped).length>0;
  if(wrap._empty!==!any){wrap.classList.toggle("empty",!any);wrap._empty=!any;}
  for(const b of GPV_BTNS){
    const el=wrap._m[b]; if(!el)continue;
    const down=!!(snap.live[b]||snap.press[b]);
    // the ring's colour is the capsule the input comes through — the "cable". Two capsules on one
    // input fall back to the neutral ring; the legend carries the detail.
    const col=(snap.mapped[b]&&!snap.multi[b])?padCapColor(snap.src[b]):"";
    const st=(down?"d":"")+(snap.mapped[b]?"m":"")+(snap.press[b]?"f":"")+
             (snap.blocked[b]?"b":"")+(snap.live[b]?"l":"")+"|"+col;
    if(el._st===st)continue;
    el._st=st;
    el.setAttribute("data-pressed",down?"true":"false");
    el.classList.toggle("mapped",!!snap.mapped[b]);
    el.classList.toggle("fired",!!snap.press[b]);
    el.classList.toggle("live",!!snap.live[b]&&!snap.blocked[b]);
    el.classList.toggle("blocked",!!snap.blocked[b]);
    if(col)el.style.setProperty("--dcol",col);else el.style.removeProperty("--dcol");
    if(b==="lt"||b==="rt")el.style.setProperty("--v",down?"1":"0");
  }
  // stick deflection — a merged pad can carry BOTH sticks at once, one per member
  const key=snap.sticks.map(s=>s.btn+":"+s.x.toFixed(2)+":"+s.y.toFixed(2)).join("|");
  if(wrap._sk!==key){
    wrap._sk=key;
    for(const b of ["ls","rs"]){const el=wrap._m[b]; if(el)el.style.translate="";}
    for(const s of snap.sticks){
      const el=wrap._m[s.btn]; if(!el)continue;
      const dx=Math.max(-1,Math.min(1,s.x))*GPV_STICK_PX;
      const dy=Math.max(-1,Math.min(1,s.y))*GPV_STICK_PX;
      el.style.translate=dx.toFixed(1)+"px "+dy.toFixed(1)+"px";
    }
  }
  // the caption — the last thing that fired, with the capsule's name when the pad has two
  const c=snap.cap;
  const many=padMembers(owner).length>1;
  // The idle line used to be the single word „czeka", sitting under a drawing with no subject in
  // sight: waits for what? It says which of the two waits it is now — the switch in the card head
  // being off is the answer nine times out of ten, and it is the one the word never gave.
  const txt=c?((many&&c.until&&snap.capDev?padCapName(snap.capDev)+" · ":"")+gpvLabel(c.btn,padKindOf(owner))+(c.txt?" · "+c.txt:"")+
        (c.blocked?" · "+_gl("nic nie wysłano: sprawdź włącznik modułu Kontroler w nagłówku karty, uzbrojenie i czy kapsel nie jest wstrzymany",
                             "nothing was sent: check the Controller module switch in the card's head, the arming, and whether the capsule is on hold"):""))
      :(any?_padIdleCaption():_gl("Nic jeszcze nie jest podpięte pod kontroler","Nothing is mapped to the controller yet"));
  if(wrap._txt&&wrap._txt._t!==txt){wrap._txt.textContent=txt;wrap._txt._t=txt;}
  const bl=!!(c&&c.blocked);
  if(wrap._bl!==bl&&wrap._capEl){wrap._capEl.classList.toggle("blocked",bl);wrap._bl=bl;}
}

function _padIdleCaption(){
  const on=!!(state.mouse&&state.mouse.enabled&&state.mouse.mode!=="mouse");
  return on?_gl("Pad: czeka na ruch albo wciśnięcie","Pad: waiting for motion or a press")
           :_gl("Pad: czeka na włączenie sterowania (przełącznik w nagłówku karty)",
                "Pad: waiting for control to be switched on (the toggle in the card header)");
}

// ---------------------------------------------------------------------------
//  WIRING
// ---------------------------------------------------------------------------
// THE READINESS LINE OF THIS SCREEN (rf-28c rfReady). Rows in the order things depend on each
// other: the driver Windows needs, a capsule on a controller, the module switch, the main control
// switch, the capsule itself. No row "a controller exists": with no controller the line is not
// drawn at all (the empty state leads), so that row could only ever be green. The driver row is
// the only place that names ViGEmBus; when it is missing, the box under the line explains it
// (rf-15 mUpdateAvail). A Wii controller talks to an emulator and needs no driver.
function padReadyRegister(){
  if(typeof rfReady==="undefined")return;
  rfReady.register({
    id:"rfReadyPad",
    anchor:()=>rfReady.headOf("kontroler"),
    allOk:["Gra widzi wirtualny pad, a ruch kapsla nim steruje.",
           "The game sees the virtual pad and the capsule motion drives it."],
    empty:()=>!padList().length,
    rows:()=>{
      const rows=[];
      const pads=padList();
      const needsDrv=pads.some(p=>!/wii|dsu/i.test(String(p&&p.kind||"")));
      const need=(needsDrv&&typeof mPadNeed==="function")?mPadNeed(state.mouseGp):null;
      // Sam brak modułu vgamepad (sterownik jest albo nie wiadomo) to nie jest „brak sterownika”:
      // wiersz mówi wtedy o module i prowadzi do ramki z instrukcją, a nie do pobierania ViGEmBus.
      const gp=state.mouseGp||{};
      const modOnly=!!(need&&!gp.mod&&(!gp.why||gp.why==="module")&&gp.drv!==false);
      if(needsDrv)rows.push(modOnly
        ?{ok:false,pl:"Moduł vgamepad zainstalowany",en:"The vgamepad module is installed",
          fix:{pl:"Pokaż",en:"Show",run:()=>rfReady.show("padCtlAvail")}}
        :{ok:!need,pl:need?"Sterownik ViGEmBus działa":"Sterownik ViGEmBus zainstalowany",
          en:need?"The ViGEmBus driver works":"The ViGEmBus driver is installed",
          fix:{pl:"Pobierz ViGEmBus",en:"Download ViGEmBus",
               run:()=>window.open((need&&need.url)||"https://github.com/nefarius/ViGEmBus/releases","_blank","noopener")}});
      const pinned=pads.some(p=>padMembers(p.id).length>0);
      rows.push({ok:pinned,pl:"Kapsel jest przypięty do kontrolera",en:"A capsule is plugged into the controller",
        fix:{pl:"Pokaż",en:"Show",run:()=>rfReady.show("padHubList")}});
      const m=state.mouse||{};
      const padOn=!!(m.enabled&&m.mode!=="mouse");
      const mouseHas=!!(m.enabled&&m.mode==="mouse");
      rows.push({ok:padOn,
        pl:mouseHas?"Ruch prowadzi pad (teraz prowadzi kursor na ekranie Mysz)":"Kontroler włączony",
        en:mouseHas?"The motion drives the pad (it drives the cursor on the Mouse screen now)":"The controller is on",
        fix:{pl:mouseHas?"Przełącz na pad":"Włącz Kontroler",en:mouseHas?"Switch to pad":"Turn the controller on",click:"#kEnable"}});
      rows.push(rfReady.armedRow());
      rows.push(rfReady.capsuleRow());
      return rows;
    }
  });
}

function initPadCtl(){
  padReadyRegister();
  // THE DRAWING IS THE MENU. Delegated on the container, not on the parts: the drawing is thrown
  // away and rebuilt whenever the viewed pad changes hands, so a listener on a part would outlive
  // its element by exactly one rebuild and then be gone.
  const box=document.getElementById("padViewBox");
  if(box)box.addEventListener("click",e=>{
    const sp=e.target&&e.target.closest&&e.target.closest(".gpv span[data-b]"); if(!sp)return;
    if(typeof padPartClick==="function")padPartClick(sp.dataset.b);
  });
  // …and the same menu from the keyboard. The parts are role="button" now (_padPartsA11y), and a
  // button that a screen reader announces but Enter does not work on is worse than no button:
  // it promises a way in and then has none. Delegated for the same reason the click is.
  if(box)box.addEventListener("keydown",e=>{
    if(e.key!=="Enter"&&e.key!==" "&&e.key!=="Spacebar")return;
    const sp=e.target&&e.target.closest&&e.target.closest(".gpv span[data-b]"); if(!sp)return;
    if(sp.getAttribute("role")!=="button")return;
    e.preventDefault();                       // Space would scroll the column out from under it
    if(typeof padPartClick==="function")padPartClick(sp.dataset.b);
  });
  if(typeof initPadParts==="function")initPadParts();   // the right column's own wiring (rf-43)
  padCtlRender();
  // The controllers themselves. Fetched once here and kept fresh by the "pads" SSE event: an
  // EMPTY controller is in no capsule's config, so without this call the strip would not know it
  // exists until something was plugged into it.
  padsFetch();
}
