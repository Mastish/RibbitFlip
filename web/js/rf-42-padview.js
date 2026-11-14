"use strict";
// ============================================================================
//  THE CONTROLLER, LIT — one drawing of the virtual pad per capsule.
//
//  RibbitFlip presses buttons on a pad that does not exist as an object you can
//  look at: `vgamepad` plugs a virtual Xbox 360 controller into Windows and this
//  app writes to it. Everything downstream of that is invisible, which is why
//  "nothing happens in the game" is the single hardest thing to diagnose here.
//  This widget makes it visible, and it answers three separate questions at once:
//
//    * WHICH buttons a setup uses at all — a ring, in the capsule's own colour,
//      around every button some rule of this capsule points at. That is the
//      schematic: you can read a set you wrote a month ago off the picture.
//    * WHAT is going down right now — the artwork's own pressed state.
//    * WHETHER IT LEFT THE APP — a fire whose `sent` is false lights RED. That
//      is the difference between "my rule is broken" and "the output group is
//      switched off", and until now the panel only said it in small print.
//
//  It is fed by the app's OWN stream, not by the browser's Gamepad API. Two
//  reasons, and the second one is the important one: (1) a page only sees a pad
//  after the user has touched one, and an overlay nobody clicks in would stay
//  blank; (2) reading the pad back would show only what actually went out, so
//  with the output group off — the state you are *supposed* to test in, see
//  .github/CONTRIBUTING.md — the drawing would be dead. Driving it from intent means the
//  picture works with every output disarmed, and says so in red.
//
//  Lives in the cheat-sheet column, which means the overlay windows get it for
//  free (rf-41 turns it on and off as the `pad` part) — the same deal every
//  other widget in that column has.
//
//  ARTWORK: third-party, MIT, by Michaël "e7d" Ferrand (github.com/e7d/gamepad-viewer),
//  reworked from mrmcpowned's originals for gamepadviewer.com. See
//  web/assets/gamepad/README.md, docs/CREDITS.md and third_party_licenses/.
//  Nothing of upstream's JavaScript is used; the geometry is in 14b-gamepad.css.
// ============================================================================

const RF_GPV_I18N={
 "Wirtualny kontroler: cyfra = który to kontroler, obwódka = przycisk używany przez regułę, zapalony = wciśnięty teraz, czerwony = nic nie wyszło z aplikacji":
   "The virtual controller: the digit = which controller this is, a ring = a button some rule uses, lit = going down right now, red = nothing left the app",
 "Kontroler":"Controller",
 "nic nie wysłano: sprawdź włącznik modułu Kontroler w nagłówku karty, uzbrojenie i czy kapsel nie jest wstrzymany":
   "nothing was sent: check the Controller module switch in the card's head, the arming, and whether the capsule is on hold",
 "Nic jeszcze nie jest podpięte pod kontroler":"Nothing is mapped to the controller yet",
 // The pad's own resting caption. Named, not a bare „czeka": it shares a cheat-sheet column with
 // four other boxes that are also waiting for something.
 "pad: czeka":"pad: waiting",
};
try{Object.assign(I18N_EN,RF_GPV_I18N);}catch(e){}

// The pad's own vocabulary, mirroring GamepadEmitter.PAD_ALIAS/PAD_BUTTONS in
// ribbitflip_monitor.py. It has to be mirrored rather than fetched because a set
// written on a DualSense says `pad:cross`, and a drawing that shrugged at the
// spec the server happily presses would be worse than no drawing.
const GPV_ALIAS={cross:"a",circle:"b",square:"x",triangle:"y",
  l1:"lb",r1:"rb",l2:"lt",r2:"rt",lbumper:"lb",rbumper:"rb",shoulderleft:"lb",shoulderright:"rb",
  ltrigger:"lt",rtrigger:"rt",triggerleft:"lt",triggerright:"rt",
  l3:"ls",r3:"rs",lstick:"ls",rstick:"rs",lthumb:"ls",rthumb:"rs",thumbleft:"ls",thumbright:"rs",
  select:"back",view:"back",share:"back",menu:"start",options:"start",
  dpadup:"up",dpaddown:"down",dpadleft:"left",dpadright:"right",
  xbox:"guide",home:"guide",ps:"guide",
  tp:"touchpad",touch:"touchpad",touchpadclick:"touchpad",tpclick:"touchpad",touchclick:"touchpad"};
const GPV_BTNS=["a","b","x","y","lb","rb","lt","rt","back","start","ls","rs","guide","up","down","left","right","touchpad"];
// Buttons only SOME devices have — mirrors GamepadEmitter.PAD_ONLY. An Xbox pad has no touchpad,
// so the drawing must not offer one: a ring around a part that can never fire would be the picture
// telling a lie the server refuses to tell (pressing it there raises, it does not quietly do nothing).
const GPV_ONLY={touchpad:["ds4","wii"]};
function gpvHas(b,kind){const k=GPV_ONLY[b];return !k||k.indexOf(kind||"x360")>=0;}
// What the caption calls each one. Short, because it shares a line with the rule's
// name. Resolved at PAINT time, not at load: the four d-pad ones are words, and the
// language switch has to reach a caption that is already on screen.
const GPV_LABEL={a:"A",b:"B",x:"X",y:"Y",lb:"LB",rb:"RB",lt:"LT",rt:"RT",
  back:"Back",start:"Start",ls:"L3",rs:"R3",guide:"Guide",touchpad:"Touchpad"};
// The SAME buttons, under the names printed on the other pad. A controller set to DualShock
// presses Cross when a rule says `pad:a`, and a caption still reading "A" would be describing a
// device nobody is holding. Only the wording moves: the mappings, and everything that reads them,
// stay on the one canonical set of names.
const GPV_LABEL_DS4={a:"✕",b:"○",x:"□",y:"△",lb:"L1",rb:"R1",lt:"L2",rt:"R2",
  back:"Share",start:"Options",ls:"L3",rs:"R3",guide:"PS",touchpad:"Touchpad"};
// …and under the names printed on a Wii Remote and its Nunchuk, which share nothing at all with
// the other two. Four of them have no counterpart on that hardware (R1/R2/R3 and the touch
// surface): those go out on the DSU wire and an emulator can bind them, so they keep a name — and
// it says DSU, which is the honest answer to "where is this on my remote?". A pair is [pl, en].
const GPV_LABEL_WII={a:"A",b:["B (spust)","B (trigger)"],x:"1",y:"2",
  lb:"C",lt:"Z",back:"−",start:"+",guide:"HOME",
  ls:["Drążek (Nunchuk)","Stick (Nunchuk)"],
  rb:"R1 · DSU",rt:"R2 · DSU",rs:"R3 · DSU",
  touchpad:["Dotyk · DSU (wskaźnik)","Touch · DSU (pointer)"]};
function gpvLabel(b,kind){
  const T=(kind==="ds4")?GPV_LABEL_DS4:(kind==="wii")?GPV_LABEL_WII:GPV_LABEL;
  if(T[b])return Array.isArray(T[b])?_gl(T[b][0],T[b][1]):T[b];
  const D={up:["krzyżak ↑","d-pad ↑"],down:["krzyżak ↓","d-pad ↓"],
           left:["krzyżak ←","d-pad ←"],right:["krzyżak →","d-pad →"]}[b];
  return D?_gl(D[0],D[1]):b;
}
// The type of the pad a CAPSULE plays on — what its own drawing and captions should be speaking.
function gpvKind(dev){
  return (typeof padKindOf==="function")?padKindOf(gpvPadId(dev)):"x360";
}

const GPV_FLASH_MS=300;      // one activation = one flash, same length as the cheat-sheet LEDs
const GPV_CAP_MS=2400;       // how long the caption keeps the last thing that fired
const GPV_STICK_PX=26;       // full deflection, in the artwork's own 750x630 units

const _gpvFlash={};          // dev -> {btn: {until, blocked}} — blocked is per BUTTON, not per
                             // capsule: two rules can fire inside the same 300 ms, one of them
                             // blocked, and painting both red would accuse the innocent one.
const _gpvHold={};           // dev -> {btn: true}  (macro `down` without its `up` yet)
const _gpvCap={};            // dev -> {txt, blocked, until}

// 'pad:L1' / 'l1' -> 'lb'; null when this pad has no such button.
// A NAME resolver, and only that: it answers "which button is this called?", never "is this a
// pad mapping at all?". Deliberately as forgiving as the server's own PadEmitter.pad_name, which
// it mirrors — that one is handed the text AFTER `pad:` and has to take `L1`, `l 1` and `l-1`.
function gpvName(spec){
  let n=String(spec||"").trim().toLowerCase();
  if(n.startsWith("pad:"))n=n.slice(4).trim();
  n=n.replace(/[\s_-]/g,"");
  n=GPV_ALIAS[n]||n;
  return GPV_BTNS.indexOf(n)>=0?n:null;
}
// …and the question gpvName must NOT be asked: IS THIS SPEC A PAD PRESS?
// ⚠️ THE BUG THIS FIXES (owner, 2026-09-08: "po dodaniu kapsla Triki 2 jest w nim przycisk Start
// na kontrolerze Xbox aktywny, mimo że nic nie jest w mapowaniu kontrolera"). A whole-spec test
// was being done with the name resolver above, and that resolver strips an OPTIONAL `pad:` — so
// every keyboard mapping whose key happens to share a name with a pad button was read as a
// controller mapping and ringed on the drawing. The overlap is not exotic, it is most of a
// keyboard's useful keys: `menu` and `options` alias to START (which is what the owner saw),
// `home` to Guide, `select`/`share` to Back, the four ARROW KEYS to the d-pad, and the bare
// letters `a`, `b`, `x`, `y` to the face buttons.
// The server has never been confused about this — `spec_is_pad()` there is one line and it reads
// `startswith("pad:")`, with pad_name() called only afterwards. This is that line, and the two
// have to keep saying the same thing: a mapping is a pad press when, and only when, it says so.
function gpvPadSpec(spec){
  const s=String(spec||"").trim().toLowerCase();
  return s.startsWith("pad:")?gpvName(s):null;
}
// Every pad button a rule points at, including the ones buried in a macro's steps
// (`down pad:lt; wait 200; pad:a`) — those are presses too, and a schematic that
// ignored them would quietly under-report the set.
function gpvRuleButtons(r){
  const out=[];
  const one=gpvPadSpec(r.keySpec); if(one)out.push(one);
  const seq=String(r.sequence||"");
  // The macro scan was always strict — the regex itself demands `pad:` — so `gpvName` is the
  // right call here: what it is handed is already the text after the prefix.
  if(seq){const re=/pad:\s*([a-z0-9]+)/gi;let mm;
    while((mm=re.exec(seq))){const b=gpvName(mm[1]); if(b&&out.indexOf(b)<0)out.push(b);}}
  return out;
}

// WHICH controller this capsule plays on. Controllers are objects of their own now (the server's
// pad registry, `state.pads`), and a capsule carries the id of the one it is plugged into in
// `mouse.padShare` — so two capsules can legitimately show the SAME number. That is the point of
// writing it down: one glance says whether the game is being handed one controller or two, which
// no other part of this drawing could ever tell you.
// `mouse.padShare` when the capsule is plugged into NO controller. The server's own word for it
// (PAD_SHARE_OFF) — kept in one constant here so the three places that ask "is this one unplugged"
// cannot drift into three spellings of the same string.
const GPV_PAD_OFF="off";
function gpvPadId(dev){
  // Three sources, freshest first: the capsule being edited holds the live object, the SSE stash
  // lands the moment any capsule's setting is saved, and the per-capsule config fetch
  // (ovMotionCfg -> D.mouseCfg) covers one whose mouse_cfg has not arrived yet — which is every
  // capsule but the active one, right after a reload.
  const D=state.devices&&state.devices[dev];
  let want="";
  if(dev===state.activeDeviceId&&state.mouse&&state.mouseDev===dev)want=state.mouse.padShare||"";
  if(!want)want=(D&&D.padShare)||(D&&D.mouseCfg&&D.mouseCfg.padShare)||"";
  // UNPLUGGED ON PURPOSE — the tray at the head of the Kontrolery strip. Answered before the
  // registry is consulted, because the fallback below deliberately puts an unknown value on the
  // FIRST pad, and that fallback would drag every unplugged capsule straight back onto it.
  if(want===GPV_PAD_OFF)return "";
  const pads=(state.pads&&state.pads.length)?state.pads:null;
  if(pads&&pads.some(p=>p.id===want))return want;
  // …and the REGISTRY knows it too, which is the answer for a capsule whose own config has not
  // arrived yet — every capsule but the active one, right after a reload. Asked before the
  // fallback below, or an unplugged capsule would spend those first seconds sitting in the first
  // controller's box AND in the tray, which is one capsule in two places.
  if(Array.isArray(state.padFree)&&state.padFree.indexOf(dev)>=0)return "";
  // The registry has not arrived (or the value is one the server has not translated yet): fall
  // back to the FIRST pad, which is where the server puts an unresolvable value too.
  if(pads)return pads[0].id;
  return want||"p1";
}
function gpvPadNum(dev){
  const id=gpvPadId(dev), pads=state.pads||[];
  const i=pads.findIndex(p=>p.id===id);
  if(i>=0)return (pads[i].num!=null)?pads[i].num:(i+1);
  return parseInt(String(id).replace(/[^0-9]/g,""),10)||1;   // no registry yet: the id says it
}
// Is this capsule sharing its controller with another one? (Two hands, one player.)
function gpvPadShared(dev){
  const id=gpvPadId(dev);
  let n=0;
  for(const k in (state.devices||{}))if(gpvPadId(k)===id)n++;
  return n>1;
}
// What the drawing calls itself. THREE kinds, three bodies — the badge no longer carries the
// difference on its own, which it had to while `wii` was drawn with the DualShock skin. It stays
// because it still answers something the picture cannot: which ROAD the controller goes out by.
// Two of them are devices Windows holds; the Wii one is a protocol on a socket, and that is worth
// saying in a corner of a drawing that otherwise looks exactly like hardware.
const GPV_KIND_BADGE={x360:"Xbox 360",ds4:"DualShock 4",wii:"Wii · DSU"};
function gpvKindBadge(kind){return GPV_KIND_BADGE[kind]||GPV_KIND_BADGE.x360;}
// How wide the ARTWORK is in its own units. Every coordinate in 14b-gamepad.css is written at
// that scale and the whole drawing is then scaled to the column by --gpvK, so a body of another
// size needs its own divisor — the Xbox skin is 750 wide, the DualShock and the Wii ones 806
// (the Wii drawing is ours, tools/wii_art.py, and was given the DualShock's canvas on purpose so
// that this table and the box's aspect ratio needed nothing new). Getting this wrong does not
// break anything visibly at first: the pad simply sits at the wrong size inside its box, and
// every hotspot with it.
const GPV_ART_W={x360:750,ds4:806,wii:806};
function gpvArtW(kind){return GPV_ART_W[kind]||750;}

function gpvHtml(dev,kind){
  const P=(cls,b)=>`<span class="${cls}" data-b="${b}"></span>`;
  const k=kind||((typeof gpvKind==="function"&&dev)?gpvKind(dev):"x360");
  return `<div class="ov-padbox" data-dev="${esc(dev)}" data-kind="${esc(k)}">`+
    `<span class="gpv-kind">${esc(gpvKindBadge(k))}</span>`+
    `<div class="ov-pad" title="Wirtualny kontroler: cyfra = który to kontroler, obwódka = przycisk używany przez regułę, zapalony = wciśnięty teraz, czerwony = nic nie wyszło z aplikacji">`+
      `<div class="gpv">`+
        P("gt l","lt")+P("gt r","rt")+
        P("gb l","lb")+P("gb r","rb")+
        `<span class="gg" data-b="guide"><b class="gpv-num" aria-hidden="true"></b></span>`+
        P("gs back","back")+P("gs start","start")+
        P("gf a","a")+P("gf b","b")+P("gf x","x")+P("gf y","y")+
        P("gk l","ls")+P("gk r","rs")+
        P("gd up","up")+P("gd down","down")+P("gd left","left")+P("gd right","right")+
        // The touchpad carries a child of its own — the finger. Hidden with the part on an Xbox
        // pad (CSS), which has neither.
        `<span class="gtp" data-b="touchpad"><b class="gtp-dot" aria-hidden="true"></b></span>`+
      `</div>`+
    `</div>`+
    // „PAD: CZEKA", not a bare „czeka". This caption sits under the pad drawing in a cheat sheet
    // where four other boxes are also waiting for something, and one lonely verb does not say
    // WHICH of them it is about. Two words, because the box is one narrow line.
    `<div class="ov-pad-cap"><span class="ov-pad-txt">${esc(_gl("pad: czeka","pad: waiting"))}</span></div>`+
    // KTO NA NIM GRA (2026-09-11) — jeden wiersz chipów w kolorach kapsli wpiętych w ten kontroler.
    // Wypełnia go WYŁĄCZNIE malowanie pada scalonego (`gpvFramePad`), więc w kolumnie panelu i na
    // mapie w zakładce „Kontroler" element zostaje pusty, a pusty jest schowany (CSS `:empty`).
    // To jest cała legenda tej nakładki: rysunek mówi CO jest wciśnięte, chipy mówią PRZEZ KOGO —
    // tym samym kolorem, którym obwiedziony jest przycisk.
    `<div class="ov-pad-who" aria-hidden="true"></div>`+
  `</div>`;
}

// A rule fired (routeEvent's "tf" branch, via overviewFire in rf-11). `sent`
// false means the app decided to press and nothing went out — that is what the
// red state is for, and it is the reason this hook does not filter on it.
function gpvFire(dev,m){
  const D=state.devices&&state.devices[dev]; if(!D)return;
  const r=(D.rules||[]).find(x=>x.id===m.id);
  let btns=r?gpvRuleButtons(r):[];
  if(!btns.length){const b=gpvPadSpec(m.key); if(b)btns=[b];}
  if(!btns.length)return;                              // a keyboard rule — not our business
  // A macro lights its steps one at a time from `seqm`; flashing all of them at
  // once here would show a chord that never happened.
  const now=(typeof performance!=="undefined"?performance.now():Date.now());
  const f=_gpvFlash[dev]||(_gpvFlash[dev]={});
  if(!(r&&r.sequence))for(const b of btns)f[b]={until:now+GPV_FLASH_MS,blocked:(m.sent===false)};
  const who=(r&&r.label)||(typeof ruleSrcLabel==="function"&&r?ruleSrcLabel(r):"")||"";
  _gpvCap[dev]={btn:btns[0],txt:who,blocked:(m.sent===false),until:now+GPV_CAP_MS};
  if(m.sent===false)gpvBlockedToast(dev,btns[0]);
}
// A PRESS THAT WENT NOWHERE, SAID OUT LOUD (2026-09-08). The red flash on the drawing only helps
// somebody looking at the drawing; the person testing on a gamepad tester or in a game is looking
// THERE and sees nothing at all. One toast per capsule per 8 s, naming the reason in the order the
// server refuses things: no controller, group off, outputs not armed, capsule on hold.
const _gpvBlockedT={};
function gpvBlockedToast(dev,btn){
  if(typeof rfToast!=="function")return;
  const now=Date.now();
  if(_gpvBlockedT[dev]&&now-_gpvBlockedT[dev]<8000)return;
  _gpvBlockedT[dev]=now;
  const D=state.devices&&state.devices[dev];
  const nm=(typeof padCapName==="function")?padCapName(dev):dev;
  const noPad=(gpvPadId(dev)==="");
  const c=(typeof padCfgOf==="function")?(padCfgOf(dev)||{}):{};
  const off=!(c.enabled&&c.mode!=="mouse");        // the Controller module — the pad's one switch
  const why=noPad?_gl("kapsel nie jest przypięty do żadnego kontrolera (ekran Kontroler)","the capsule is plugged into no controller (Controller screen)")
    :off?_gl("moduł Kontroler tego kapsla jest wyłączony — włącznik w nagłówku karty Kontroler","this capsule’s Controller module is off — the switch in the head of the Controller card")
    :!state.armed?_gl("wyjścia nie są uzbrojone","the outputs are not armed")
    :_gl("kapsel jest wstrzymany albo wyjście odmówiło","the capsule is on hold or the output refused");
  rfToast(nm+": "+gpvLabel(btn,gpvKind(dev))+" "+_gl("nie wyszedł do gry — ","did not reach the game — ")+why,{tone:"warn",ms:7000});
}
// A macro step (routeEvent -> onSeqMacro in rf-32). `act` down/up is a real hold,
// so it stays lit until its `up`; a step without `act` is a tap and just flashes.
// `m.key` is the step's RAW spec, straight off the wire (the server publishes `"key": val`), so
// a macro that types the letter `a` sends exactly "a" — hence gpvPadSpec, not gpvName. Read
// loosely, a `down a` step lit the pad's A button and, having no matching `up pad:a`, held it
// lit for the rest of the macro.
function gpvSeq(m){
  const dev=m.dev||(state&&state.activeDeviceId)||"d0";
  if(m.phase==="done"||m.phase==="abort"){delete _gpvHold[dev];return;}
  if(m.phase!=="key")return;
  const b=gpvPadSpec(m.key); if(!b)return;
  const now=(typeof performance!=="undefined"?performance.now():Date.now());
  const h=_gpvHold[dev]||(_gpvHold[dev]={});
  if(m.act==="down")h[b]=true;
  else if(m.act==="up")delete h[b];
  else (_gpvFlash[dev]||(_gpvFlash[dev]={}))[b]={until:now+GPV_FLASH_MS,blocked:false};
  const cap=_gpvCap[dev];
  _gpvCap[dev]={btn:b,txt:(cap&&cap.txt)||"",blocked:false,until:now+GPV_CAP_MS};
}

// What the drawing should show for this capsule, right now. Kept separate from
// the painting so the rules of the thing are readable in one screen.
function gpvSnapshot(D){
  const mapped={},live={},blocked={},press={};
  const dev=D.meta.dev;
  const now=(typeof performance!=="undefined"?performance.now():Date.now());
  for(const r of (D.rules||[])){
    const btns=gpvRuleButtons(r); if(!btns.length)continue;
    const rt=(D.rt||{})[r.id]||{};
    for(const b of btns){
      mapped[b]=true;
      // Only `hold` genuinely keeps the button down for as long as the condition
      // is met. For the others the server taps and lets go, so a lamp that stayed
      // on while the condition held would be showing a press that is long over.
      if(r.enabled!==false&&rt.active&&r.behavior==="hold")live[b]=true;
    }
  }
  const h=_gpvHold[dev]||{}; for(const b in h){live[b]=true;mapped[b]=true;}
  const f=_gpvFlash[dev]||{};
  for(const b in f){
    if(f[b].until>now){press[b]=true; if(f[b].blocked)blocked[b]=true;}
    else delete f[b];
  }
  const cap=_gpvCap[dev];

  // MOTION — the stick and the d-pad come from the motion section of the "Kontroler"
  // tab, not from a rule, and they are the two the player watches most.
  const mv=D.mouseLive||{}, cfg=(typeof ovMotionCfg==="function"?ovMotionCfg(D):null)||{};
  // WHAT this capsule is set up to drive comes from its CONFIGURATION; the live snapshot only says
  // what it is driving right now. The two are not the same before the group is switched on: the
  // snapshot does not exist yet, so a capsule whose entire job is the stick used to show no
  // controller at all — precisely when somebody is checking whether a freshly loaded two-capsule
  // set landed on the right hands.
  const mode=mv.mode||cfg.mode||"";
  const backend=(mode==="stick") ? (mv.backend||cfg.stickBackend)
              : (mode==="dpad")  ? (mv.backend||cfg.dpadBackend) : "";
  let stick=null,touch=null;
  if(mode==="stick"&&backend==="gamepad"){
    const which=(cfg.stickWhich==="right")?"rs":"ls";
    mapped[which]=true;
    if(mv.enabled)stick={btn:which,x:+mv.sx||0,y:+mv.sy||0};
  }else if(mode==="stick"&&backend==="touchpad"){
    // The FINGER, which is not the click: the plate is ringed as "in play" because the motion is
    // aimed at it, and `touch` is where the finger is — absent while it is off the glass, because
    // that is a real state here and not the same as "at the centre".
    mapped.touchpad=true;
    if(mv.enabled&&mv.tp)touch={x:+mv.tp[0]||0,y:+mv.tp[1]||0};
  }else if(mode==="dpad"&&backend==="gamepad"){
    for(const d of ["up","down","left","right"]){
      mapped[d]=true;
      if(mv.enabled&&mv.dirs&&mv.dirs[d])live[d]=true;
    }
  }
  return {mapped,live,blocked,press,stick,touch,cap:(cap&&cap.until>now)?cap:null};
}

// ---------------------------------------------------------------------------
//  CAŁY KONTROLER NA JEDNYM RYSUNKU (2026-09-11)
// ---------------------------------------------------------------------------
// ZGŁOSZENIE: „aktywuję nakładkę z kontrolerem na kapslu 2, a kontroler obsługiwany jest przez
// kapsel 1 i 2 — widzę tylko input z kapsla 2". I tak było: nakładka to kolumna JEDNEGO kapsla
// (ovlColumns w rf-41), a `gpvSnapshot` czyta reguły i ruch tego jednego. Rysunek pokazywał więc
// połowę przedmiotu, którego druga połowa jest niewidoczna — a gra widzi go w całości, jako
// jednego gracza.
//
// SCALANIE JUŻ ISTNIAŁO, tylko nie tutaj: zakładka „Kontroler" rysuje mapę pada z `padMergedSnap`
// (rf-44) od dnia, w którym hub stał się pad-centryczny. Ta funkcja podaje ten sam scalony obraz
// widgetowi ze ściągi — obwódka w kolorze kapsla, który dany przycisk obsługuje, przycisk
// obsługiwany przez dwa kapsle na neutralnej, a pod rysunkiem wiersz chipów „kto na nim gra".
// Nie ma tu drugiej matematyki: gdyby powstała, rozjechałaby się z mapą w panelu w pierwszym
// tygodniu (ten projekt ma już taki przypadek — dwie listy wyglądów koła, patrz RF_LOOKS w rf-41).
//
// Zwraca `true`, gdy pomalowała — `false` znaczy „ten pad nie istnieje w rejestrze", i wtedy
// wołający wraca do zwykłej ścieżki jednego kapsla.
function gpvPaintMerged(box,padId,keep){
  if(typeof padById!=="function"||typeof padMergedSnap!=="function"||!padById(padId))return false;
  const mem=padMembers(padId), kind=padKindOf(padId), shared=mem.length>1;
  if(box._num){
    const n=padNumOf(padId), key="P"+n+(shared?"s":"");
    if(box._numV!==key){
      box._numV=key; box._num.textContent=String(n);
      box._num.parentNode.setAttribute("aria-label",
        _gl("Kontroler ","Controller ")+n+(shared?_gl(" (wspólny)"," (shared)"):""));
      box.classList.toggle("shared",shared);
    }
  }
  const snap=padMergedSnap(padId);
  const any=Object.keys(snap.mapped).length>0;
  const ovl=document.documentElement.classList.contains("rf-ovl");
  const show=any||ovl||keep;
  if(box._on!==show){box.classList.toggle("on",show);box._on=show;}
  if(box._empty!==!any){box.classList.toggle("empty",!any);box._empty=!any;}
  // KTO NA NIM GRA — przepisywane tylko przy realnej zmianie składu albo nazw, bo to innerHTML
  // w pętli klatek. Jeden kapsel nie dostaje żadnego wiersza: chip mówiący „tylko ja" to podpis
  // pod rysunkiem, który i tak nie ma z czym się pomylić.
  if(box._who){
    const sig=shared?mem.map(d=>d+":"+padCapColor(d)+":"+padCapName(d)).join("|"):"";
    if(box._whoV!==sig){
      box._whoV=sig;
      box._who.innerHTML=sig?mem.map(d=>'<span class="ov-pad-chip" style="--dcol:'+esc(padCapColor(d))+'">'+
        '<i class="ov-pad-chip-dot" aria-hidden="true"></i>'+esc(padCapName(d))+'</span>').join(""):"";
    }
  }
  if(!show||!box._pad||!box._pad.offsetParent)return true;
  const w=box._pad.clientWidth, aw=gpvArtW(kind);
  if(w&&(box._w!==w||box._aw!==aw)){box._w=w;box._aw=aw;
    box._pad.firstElementChild.style.setProperty("--gpvK",(w/aw).toFixed(4));}
  for(const b of GPV_BTNS){
    const el=box._m[b]; if(!el)continue;
    if(!gpvHas(b,kind)){if(el._st!==""){el._st="";el.className=el.className.replace(/\s*(mapped|fired|live|blocked)\b/g,"");el.setAttribute("data-pressed","false");}continue;}
    const down=!!(snap.live[b]||snap.press[b]);
    // Kolor obwódki = kapsel, którym ten przycisk wchodzi. Przycisk obsługiwany przez dwa kapsle
    // wraca na neutralną — dwa kolory na jednym pierścieniu nie powiedziałyby nic, a wiersz chipów
    // pod spodem i tak wymienia obu. Lustro `padViewFrame` w rf-44.
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
  // DWA DRĄŻKI NARAZ. Scalony pad bywa sterowany dwiema rękami — po jednym drążku na kapsel —
  // więc wychylenia są tablicą, a nie jednym polem jak przy pojedynczym kapslu.
  const key=snap.sticks.map(s=>s.btn+":"+s.x.toFixed(2)+":"+s.y.toFixed(2)).join("|");
  if(box._sk!==key){
    box._sk=key;
    for(const b of ["ls","rs"]){const el=box._m[b]; if(el)el.style.translate="";}
    for(const s of snap.sticks){
      const el=box._m[s.btn]; if(!el)continue;
      const dx=Math.max(-1,Math.min(1,s.x))*GPV_STICK_PX;
      const dy=Math.max(-1,Math.min(1,s.y))*GPV_STICK_PX;
      el.style.translate=dx.toFixed(1)+"px "+dy.toFixed(1)+"px";
    }
  }
  const c=snap.cap;
  const txt=c?((shared&&snap.capDev?padCapName(snap.capDev)+" · ":"")+gpvLabel(c.btn,kind)+(c.txt?" · "+c.txt:"")+
      (c.blocked?" · "+_gl("nic nie wysłano: sprawdź włącznik modułu Kontroler w nagłówku karty, uzbrojenie i czy kapsel nie jest wstrzymany",
                          "nothing was sent: check the Controller module switch in the card's head, the arming, and whether the capsule is on hold"):""))
    :(any?_gl("pad: czeka","pad: waiting"):_gl("Nic jeszcze nie jest podpięte pod kontroler","Nothing is mapped to the controller yet"));
  if(box._txt&&box._txt._t!==txt){box._txt.textContent=txt;box._txt._t=txt;}
  const bl=!!(c&&c.blocked);
  if(box._bl!==bl&&box._cap){box._cap.classList.toggle("blocked",bl);box._bl=bl;}
  return true;
}

// Per-frame paint, called from the cheat-sheet frame loop (rf-12). Writes to the
// DOM only where something changed: this runs at 60 fps next to everything else
// in that loop, and blind writes here cost a layout on every capsule, every frame.
// `opts.keep` — do not hide a pad nobody maps. The cheat sheet drops those (clutter), but the
// Kontroler tab's hub is a list OF THE CONTROLLERS: a tile whose drawing vanished because no rule
// points at that capsule yet would look like a missing capsule, which is the opposite of the truth.
function gpvFrame(root,opts){
  root=root||document;
  const keep=!!(opts&&opts.keep);
  for(const box of root.querySelectorAll(".ov-padbox")){
    const dev=box.dataset.dev, D=state.devices&&state.devices[dev];
    if(!D){box.classList.remove("on");continue;}
    if(!box._m){   // one lookup per widget, kept on the element
      box._m={};
      for(const el of box.querySelectorAll(".gpv span"))box._m[el.dataset.b]=el;
      box._pad=box.querySelector(".ov-pad");
      box._num=box.querySelector(".gpv-num");
      box._txt=box.querySelector(".ov-pad-txt");
      box._cap=box.querySelector(".ov-pad-cap");
      box._who=box.querySelector(".ov-pad-who");
    }
    // PAD SCALONY — cały kontroler, nie jeden kapsel (2026-09-11). Ustawiane przez nakładkę
    // (`ovlPadBox` w rf-41), więc w panelu nie zmienia się nic. Osobną ścieżką, a nie warunkami
    // wplecionymi w tę niżej: tamta pyta o JEDEN kapsel w dziesięciu miejscach, ta scala kilka.
    if(box.dataset.pad&&gpvPaintMerged(box,box.dataset.pad,keep))continue;
    // The number can change without anything being pressed (the capsule is plugged into another
    // controller in the "Kontroler" tab, or one is added/removed), so it is refreshed here rather
    // than at build time — guarded, because this runs 60 times a second for every capsule on
    // screen. The guard key carries the SHARED flag too: a second capsule joining this pad leaves
    // the number alone and must still light the "shared" mark.
    if(box._num){
      const n=gpvPadNum(dev), shared=gpvPadShared(dev), key=n+(shared?"s":"");
      if(box._numV!==key){
        box._numV=key; box._num.textContent=String(n);
        box._num.parentNode.setAttribute("aria-label",
          _gl("Kontroler ","Controller ")+n+(shared?_gl(" (wspólny)"," (shared)"):""));
        box.classList.toggle("shared",shared);
      }
    }
    const snap=gpvSnapshot(D);
    const any=Object.keys(snap.mapped).length>0;
    // In the panel a pad nobody maps is clutter, so it is simply not there. In an
    // overlay it stays (faded): a box appearing and vanishing mid-game is worse.
    const ovl=document.documentElement.classList.contains("rf-ovl");
    const show=any||ovl||keep;
    if(box._on!==show){box.classList.toggle("on",show);box._on=show;}
    if(box._empty!==!any){box.classList.toggle("empty",!any);box._empty=!any;}
    if(!show||!box.offsetParent)continue;
    // The artwork is 750 px wide whatever the column is; scale it to fit.
    const w=box._pad.clientWidth;
    const aw=gpvArtW(gpvKind(dev));
    if(w&&(box._w!==w||box._aw!==aw)){box._w=w;box._aw=aw;
      box._pad.firstElementChild.style.setProperty("--gpvK",(w/aw).toFixed(4));}

    const _k=gpvKind(dev);
    for(const b of GPV_BTNS){
      const el=box._m[b]; if(!el)continue;
      // A part this device does not have is left entirely alone — not ringed, not lit, not
      // marked as mapped. CSS hides it; this makes sure nothing is written into it either.
      if(!gpvHas(b,_k)){if(el._st!==""){el._st="";el.className=el.className.replace(/\s*(mapped|fired|live|blocked)\b/g,"");el.setAttribute("data-pressed","false");}continue;}
      const down=!!(snap.live[b]||snap.press[b]);
      const st=(down?"d":"")+(snap.mapped[b]?"m":"")+(snap.press[b]?"f":"")+
               (snap.blocked[b]?"b":"")+(snap.live[b]?"l":"");
      if(el._st===st)continue;                 // nothing about this button changed
      el._st=st;
      el.setAttribute("data-pressed",down?"true":"false");
      el.classList.toggle("mapped",!!snap.mapped[b]);
      el.classList.toggle("fired",!!snap.press[b]);
      el.classList.toggle("live",!!snap.live[b]&&!snap.blocked[b]);
      el.classList.toggle("blocked",!!snap.blocked[b]);
      if(b==="lt"||b==="rt")el.style.setProperty("--v",down?"1":"0");
    }
    // the stick's deflection (a `translate`, so it does not fight the mirroring
    // transform the right-hand parts carry)
    const sk=snap.stick;
    const key=sk?(sk.btn+":"+sk.x.toFixed(2)+":"+sk.y.toFixed(2)):"";
    if(box._sk!==key){
      box._sk=key;
      for(const b of ["ls","rs"]){const el=box._m[b]; if(el)el.style.translate="";}
      if(sk&&box._m[sk.btn]){
        const dx=Math.max(-1,Math.min(1,sk.x))*GPV_STICK_PX;
        const dy=Math.max(-1,Math.min(1,sk.y))*GPV_STICK_PX;
        box._m[sk.btn].style.translate=dx.toFixed(1)+"px "+dy.toFixed(1)+"px";
      }
    }
    // the finger on the touchpad — a place, or nowhere at all (see gpvSnapshot)
    const tp=snap.touch, tpEl=box._m.touchpad;
    const tkey=tp?(tp.x.toFixed(3)+":"+tp.y.toFixed(3)):"";
    if(tpEl&&box._tp!==tkey){
      box._tp=tkey;
      tpEl.classList.toggle("has-touch",!!tp);
      if(tp){
        tpEl.style.setProperty("--tx",Math.max(0,Math.min(1,tp.x)).toFixed(4));
        tpEl.style.setProperty("--ty",Math.max(0,Math.min(1,tp.y)).toFixed(4));
      }
    }
    // the caption
    const c=snap.cap;
    const txt=c?(gpvLabel(c.btn,gpvKind(dev))+(c.txt?" · "+c.txt:"")+(c.blocked?" · "+_gl("nic nie wysłano: sprawdź włącznik modułu Kontroler w nagłówku karty, uzbrojenie i czy kapsel nie jest wstrzymany","nothing was sent: check the Controller module switch in the card's head, the arming, and whether the capsule is on hold"):""))
              :(any?_gl("pad: czeka","pad: waiting"):_gl("Nic jeszcze nie jest podpięte pod kontroler","Nothing is mapped to the controller yet"));
    if(box._txt&&box._txt._t!==txt){box._txt.textContent=txt;box._txt._t=txt;}
    const bl=!!(c&&c.blocked);
    if(box._bl!==bl){box._cap.classList.toggle("blocked",bl);box._bl=bl;}
  }
}
