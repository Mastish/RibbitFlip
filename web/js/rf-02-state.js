"use strict";
// ===== sensor axis table + the global `state` singleton =====
// `state` is a top-level const shared by every rf-* file through the global lexical scope
// (classic scripts, one scope, no modules) — it is deliberately NOT on window.
// AXES maps the six sensor channels: k = internal key, ch = channel index in packet order
// (CH0..CH2 come from the packet's a[] array, CH3..CH5 from g[]), re = which sensor axis the
// channel actually IS, scope = chart group.
// Samples are raw LSB counts; converting to g / deg/s needs the per-sensor scale factor.
// ⚠️ `k` and the wire names a[]/g[] are HISTORICAL and say the opposite of the truth: they date
// from before the channel order was measured. CH0-2 are the GYROSCOPE and CH3-5 the
// ACCELEROMETER — confirmed on a real puck (flat and still: ~-2065 LSB on CH5, one g at
// 2048 LSB/g, CH0-2 at zero) and independently by AND-Y0's protocol notes. Only `re` is shown to
// anybody, so only `re` was corrected: renaming `k` would reach into stored settings and every
// `raw-ax`/`bar-ax` element id for no gain, and `scope` must stay as it is because it routes a
// trace to a canvas whose element id is equally historical ("scopeAccel" sits in the card
// titled "Kanały 0-2", i.e. the gyroscope one).
const AXES=[
  {k:"ax",ch:0,re:"gx",color:cv('--ax'),scope:"accel"},
  {k:"ay",ch:1,re:"gy",color:cv('--ay'),scope:"accel"},
  {k:"az",ch:2,re:"gz",color:cv('--az'),scope:"accel"},
  {k:"gx",ch:3,re:"ax",color:cv('--gx'),scope:"gyro"},
  {k:"gy",ch:4,re:"ay",color:cv('--gy'),scope:"gyro"},
  {k:"gz",ch:5,re:"az",color:cv('--gz'),scope:"gyro"},
];
const SERIES=Object.fromEntries(AXES.map(a=>[a.k,{label:"CH"+a.ch,color:a.color,scope:a.scope,visible:true}]));
const AKEYS=AXES.map(a=>a.k);
// ax..gz -> the channel key the tuning chain (and the server) uses for the same signal.
const CHIDX=Object.fromEntries(AXES.map(a=>[a.k,a.ch]));
const CHKEY=Object.fromEntries(AXES.map(a=>[a.k,"ch"+a.ch]));
// The history of ONE channel the way an output sees it: after its tuning chain when it HAS one
// (RAW frame, so thresholds and the scope grid still line up), null otherwise — callers fall back
// to the plain buffer. The `on` flags come from the server: the packet carries all six channels
// whenever any of them is tuned, and an identity chain is indistinguishable from an untouched one.
function chanSrcBuf(D,k){
  const c=D&&D.chan;
  if(!c||!c.on||!c.on[CHIDX[k]])return null;
  const a=D.chanBuf&&D.chanBuf[CHKEY[k]];
  return (a&&a.length)?a:null;
}

const state={
  cfg:{simulate:false,sendKeys:false},
  buf:Object.fromEntries(AKEYS.map(k=>[k,[]])),
  events:[],
  dev:{}, stats:{}, statusPkt:null,
  last:{ax:0,ay:0,az:0,gx:0,gy:0,gz:0}, lastRaw:"—",
  nowTs:0, windowSec:10, paused:false, frozenTs:null, hover:null,
  scanning:true,   // true while searching/connecting to the puck (loading animation instead of data)
  rawSkip:0,
  offset:Object.fromEntries(["ax","ay","az","gx","gy","gz"].map(k=>[k,0])), tareOn:false,
  rec:[], recording:false,   // CSV recording: OFF by default (manual start/stop, not from page start)
  recPick:null,              // which streams go into the file — filled from localStorage below
  // triggers (threshold -> key/mouse) — the only input system
  rules:[], rt:{}, armed:true, editing:null, _draft:null,
  // Presety wyzwalaczy Z ICH TREŚCIĄ ([{name,rules}], z GET /profiles). Nazwy same wystarczały
  // liście rozwijanej, ale nie odpowiedzi „czy ten kapsel jest jeszcze taki, jak zapisany" —
  // a to jest porównanie i potrzebuje obu stron (rf-49b). Jeden pobór dla obu pasków.
  trigPresets:[],
  // battery saving
  power:{autoSleep:false,idleMin:5,wakeHex:"",parked:false,batterySec:120,
         autoPause:false,autoPauseSec:60},
  // motion control mode (mouse / analog stick / d-pad)
  mouse:{enabled:false,mode:"mouse",axisX:5,axisY:4,sensX:0.035,sensY:0.035,invertX:false,invertY:false,
         deadzone:35,smoothMode:"classic",smooth:0.70,oeMinCutoff:1.0,oeBeta:0.007,maxStep:35,scroll:false,scrollAxis:3,scrollSens:0.22,scrollThreshold:2200,
         // PER-MODE axes/inversion/dead zone (separate for mouse/stick/d-pad — NOT shared)
         mouseAxisX:5,mouseAxisY:4,mouseInvertX:false,mouseInvertY:false,mouseDeadzone:35,
         // Mouse, stick and d-pad all read the 3D filter by default (mirror of AirMouse.DEFAULTS):
         // roll -> X, pitch -> Y. One calibrated orientation feeds all three instead of three
         // hand-aimed raw channels.
         mouseSource:"filter",mouseMetricX:"roll",mouseMetricY:"pitch",mouseFilterScale:30,mouseEdgeFollow:true,
         // WHERE the cursor may go (the fence + the target of the pointing mode) — mirror of
         // AirMouse.DEFAULTS. "desktop" with no margin = no fence at all, which is what the mouse
         // always did; padShare taught us that a key missing here is a setting lost on reload.
         mouseArea:"desktop",mouseMonitor:"",mouseAreaWork:false,mouseAreaPad:0,
         mouseRectX:0,mouseRectY:0,mouseRectW:0,mouseRectH:0,mouseAbsolute:false,
         // KLIK BEZ KLIKANIA — kursor, który przystanie, klika sam (dostępność + zajęte ręce)
         dwellOn:false,dwellMs:900,dwellRadius:12,dwellClick:"left",
         stickAxisX:5,stickAxisY:4,stickInvertX:false,stickInvertY:false,stickDeadzone:35,
         dpadAxisX:5,dpadAxisY:4,dpadInvertX:false,dpadInvertY:false,dpadDeadzone:35,
         stickBackend:"gamepad",stickSource:"filter",stickMetricX:"roll",stickMetricY:"pitch",stickFilterScale:45,stickAccel:0.7,
         stickWhich:"left",stickRange:8000,stickInner:0.08,stickOuter:0,stickExpo:1.6,
         // czułość osobno na każdą oś (mnożnik wychylenia, 1 = jak było) — mirror of AirMouse.DEFAULTS
         stickSensX:1,stickSensY:1,
         stickWsadThr:0.5,stickUp:"w",stickDown:"s",stickLeft:"a",stickRight:"d",
         dpadBackend:"keyboard",dpadDiagonal:false,dpadRange:10000,dpadInner:0.30,dpadSource:"filter",dpadMetricX:"roll",dpadMetricY:"pitch",dpadFilterScale:45,
         dpadUp:"up",dpadDown:"down",dpadLeft:"left",dpadRight:"right",
         autoSwitch:false,switchKind:"filter",switchMetric:"tilt",switchChannel:5,switchCmp:">",
         switchThreshold:45,switchAbs:false,switchHyst:5,modeTrue:"stick",modeFalse:"dpad",
         // gyro-aim response shaping; defaults are neutral (expo 1.0, no tightening, accel off)
         mouseExpo:1.0,tighten:0,accelOn:false,sensFast:0.035,accelThrLo:40,accelThrHi:4000,
         mouseFilterDead:3,dpadFilterDead:22.5,autoTare:false},
  mousePrev:{enabled:false,live:false,mode:"mouse",dx:0,dy:0,fx:0,fy:0,scroll:false,scrollY:0,
         sx:0,sy:0,dirs:{up:false,down:false,left:false,right:false},backend:"keyboard",gpMod:false,gpOn:false,
         // d-pad only: the raw input vector plus the press/release thresholds it is compared against
         // (source unit: LSB for an axis, -1..1 for the 3D filter) -> the preview draws real zones
         vx:0,vy:0,thr:1,rel:0.6,diag:false},
  // panel-only view preference (never posted to the server): draw the key zones over the d-pad preview
  dpadZones:true,
  // timing in sequences (multi countdown + macro playback)
  seqProg:{},         // id -> [count,need,remainMs] (multi)
  seqRun:null,        // current macro {id,label,steps,cur,total,waitUntil,waitMs,send}
};
// MAXKEEP: seconds of samples kept per channel ring buffer (older ones are pruned).
// MAXREC: hard cap on recorded CSV rows; past it the buffer scrolls (oldest row dropped).
const MAXKEEP=40, MAXREC=120000, live=()=>!state.paused;

// ===================== CSV recorder: which streams end up in the file ===============
// Ticked in the Connection tab ("Nagrywanie danych"), remembered per browser. Recording
// everything at 50 Hz buries a rare event (one button press) under thousands of motion rows,
// so the picker exists to make a file that answers ONE question.
// `alldev` is the odd one out: it does not add a stream, it widens WHOSE streams are taken.
// Default off = the historical behaviour (viewed capsule only), but with 2+ capsules paired it
// is the difference between "the press never arrived" and "the press landed on the other one".
const REC_STREAMS=[
  {k:"imu",   dflt:true,  cols:["ch0","ch1","ch2","ch3","ch4","ch5"]},
  {k:"stat",  dflt:true,  cols:["b0","b1","b2","b3","b4"]},
  {k:"pose",  dflt:false, cols:["tilt","twist","pitch","roll"]},
  {k:"trig",  dflt:false, cols:["rule","over","fires"]},
  {k:"hex",   dflt:true,  cols:["hex"]},
  {k:"alldev",dflt:false, cols:[]},
];
const REC_PICK_LS="ribbitflip.rec.pick";
state.recPick=(function(){
  const d={};for(const s of REC_STREAMS)d[s.k]=s.dflt;
  try{const raw=JSON.parse(localStorage.getItem(REC_PICK_LS)||"null");
    if(raw&&typeof raw==="object")for(const s of REC_STREAMS)if(typeof raw[s.k]==="boolean")d[s.k]=raw[s.k];
  }catch(e){}
  return d;
})();
function recWants(k){return !!(state.recPick&&state.recPick[k]);}
function recSavePick(){try{localStorage.setItem(REC_PICK_LS,JSON.stringify(state.recPick));}catch(e){}}
// One row = one plain object; the download builder turns it into columns. Objects rather than
// positional arrays because the column set now depends on the ticks, and a padded array whose
// meaning shifts with a checkbox is exactly how a CSV starts lying about what is in it.
function recPush(row){
  if(!state.recording)return;
  if(state.rec.length>=MAXREC)state.rec.shift();
  state.rec.push(row);
}

// ===================== multi-device layer (Triki slots) =====================
//  One shared SSE stream carries events from ALL slots (each with a
//  'dev' field). Full telemetry (scopes/readings/feed) concerns the ACTIVE slot;
//  for ALL slots we keep meta+rules+trigger state (selector + cheat sheet).
state.devices={};               // id -> {meta:{dev,slot,name,color,label,muted}, conn, rules:[], rt:{}, condBuf:{}}
// The VIRTUAL CONTROLLERS, in the server's order: [{id:"p1", name:"", num:1, caps:[devIds]}].
// A controller is its own thing — capsules plug into it (one, or several for one player with two
// hands), and which one a capsule is on is that capsule's `mouse.padShare`. Filled from GET /pads
// and kept fresh by the "pads" SSE event, so every open dashboard shows the same set.
state.pads=[];
state.padMax=4;                 // XInput shows a game four controllers; the server says so too
// The capsules plugged into NO controller — the tray at the head of the Kontrolery strip. Sent by
// the server as its own list rather than worked out here by subtraction: "in no box" and "the
// registry has not arrived yet" would otherwise look identical, and one of them must not put a
// capsule in the tray. A capsule sitting here keeps its keyboard, mouse, macro and MIDI outputs —
// only its `pad:` mappings have nowhere to go, and they say so in red.
state.padFree=[];
// WHICH SLOT THE PANEL OPENS ON. Injected into <head> by the server (_serve_html), because the
// boot chain asks ~15 per-capsule endpoints (/pose, /airmouse, /wheel, /midi…) before the first
// `devmeta` can arrive over the stream — a guess here is a guess in every one of those requests.
// It used to be the constant "d0", and the server opens ONLY the remembered slots: somebody whose
// capsule lives in d4 has no d0 at all, so the panel asked about a slot that did not exist and
// devEntry() fabricated it — a pill named „d0" in the hub, on every start. "d0" stays as the
// fallback for the one case where nothing injected it (the file opened straight off disk).
const RF_BOOT_DEV=(typeof window!=="undefined"&&/^d\d+$/.test(String(window.RIBBITFLIP_DEV||"")))
                  ?String(window.RIBBITFLIP_DEV):"d0";
state.activeDeviceId=RF_BOOT_DEV;
// Which capsule the Sensor+Connection panels display. Kept in sync with the active slot
// (one current device — the Devices hub above the live preview switches it everywhere).
state.viewDev=RF_BOOT_DEV;
function mkBuf(){return {ax:[],ay:[],az:[],gx:[],gy:[],gz:[]};}
// VB() = the telemetry bundle of the currently-VIEWED capsule (Sensor/Connection tabs).
// Through devKnownId (rf-05): a stale viewDev after a forgotten slot must fall back to a slot the
// panel has, not resurrect the forgotten one. Only with NO slots at all does it still create one.
function VB(){const id=(typeof devKnownId==="function")?devKnownId(state.viewDev):null;return devEntry(id||state.viewDev||state.activeDeviceId||"d0");}
