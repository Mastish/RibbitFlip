"use strict";
// ===================== MOTION CONTROL MODE (mouse / stick / d-pad) =====================
// Builds and wires the motion-control settings panel. Each mode keeps its OWN axes, inversion
// and dead zone (never shared), so switching modes must always read/write the mode-prefixed
// state.mouse.<mode>* fields rather than the flat ones.
// The settings live in ONE object with ONE `mode`, but the panel shows them in TWO tabs: Mysz
// (mode "mouse") and Kontroler (mode "stick" | "dpad"). The Kontroler tab therefore needs an answer
// to "which pad mode are you editing?" even while the engine is running the mouse — otherwise its
// fields would have nothing to read. That answer is kept here, remembered across reloads, and only
// becomes the engine's mode when somebody switches the pad on.
// _padMode (the half being VIEWED) wins over the engine's mode on purpose: with the stick live you
// can still open the d-pad's panel to read it, and every field fills for the half on screen. The
// engine is only the fallback before anything set _padMode — and onMouseCfg keeps _padMode in step
// whenever a capsule arrives already running stick/dpad, so the two only differ while browsing.
function padMode(){const m=state.mouse,pm=state._padMode;
  return (pm==="stick"||pm==="dpad")?pm:((m&&m.mode!=="mouse")?m.mode:"stick");}
try{const _pm=localStorage.getItem("ribbitflip.padMode");if(_pm==="stick"||_pm==="dpad")state._padMode=_pm;}catch(e){}
function setPadMode(v){
  if(v!=="stick"&&v!=="dpad")return;
  state._padMode=v;
  try{localStorage.setItem("ribbitflip.padMode",v);}catch(e){}
}
function chOptions(sel){return [0,1,2,3,4,5].map(i=>`<option value="${i}" ${sel===i?"selected":""}>CH${i} (${RE_LABEL[i]})</option>`).join("");}
const MMETRICS=[["tilt","Pochylenie"],["twist","Obrót"],["pitch","Pitch"],["roll","Roll"]];
function metricOptions(sel){return MMETRICS.map(m=>`<option value="${m[0]}" ${sel===m[0]?"selected":""}>${m[1]}</option>`).join("");}
function buildMouseControls(){
  const $=id=>document.getElementById(id),m=state.mouse,pm=padMode();
  // Each card owns a FIXED slice of the per-mode fields: the Mysz tab is always "mouse*", the
  // Kontroler tab is always the pad mode it is showing. Neither ever renders the other's axes.
  if($("mAxisX"))$("mAxisX").innerHTML=chOptions(m.mouseAxisX);
  if($("mAxisY"))$("mAxisY").innerHTML=chOptions(m.mouseAxisY);
  if($("kAxisX"))$("kAxisX").innerHTML=chOptions(m[pm+"AxisX"]);
  if($("kAxisY"))$("kAxisY").innerHTML=chOptions(m[pm+"AxisY"]);
  if($("mScrollAxis"))$("mScrollAxis").innerHTML=chOptions(m.scrollAxis);
  if($("mStickMetricX"))$("mStickMetricX").innerHTML=metricOptions(m.stickMetricX);
  if($("mStickMetricY"))$("mStickMetricY").innerHTML=metricOptions(m.stickMetricY);
  if($("mDpadMetricX"))$("mDpadMetricX").innerHTML=metricOptions(m.dpadMetricX);
  if($("mDpadMetricY"))$("mDpadMetricY").innerHTML=metricOptions(m.dpadMetricY);
  if($("mMouseMetricX"))$("mMouseMetricX").innerHTML=metricOptions(m.mouseMetricX);
  if($("mMouseMetricY"))$("mMouseMetricY").innerHTML=metricOptions(m.mouseMetricY);
  if($("mSwitchMetric"))$("mSwitchMetric").innerHTML=metricOptions(m.switchMetric);
  if($("mSwitchChannel"))$("mSwitchChannel").innerHTML=chOptions(m.switchChannel);
}
// 0,00× TO OŚ WYŁĄCZONA. Suwak czułości sięga zera (wcześniej czułość
// drążków osi x i y dawało się zejść tylko do 0,1), bo drążek, który jeździ
// tylko na boki, to normalne ustawienie celowania, a nie awaria. Wcześniej silnik podnosił zero do
// 0,1 właśnie po to, żeby „gałka nie działa" nie zapadło po cichu — tę rolę przejmuje ta nota:
// mówi, KTÓRA oś stoi, i robi się bursztynowa. Ta sama zasada, co przy #mDpadDiagNote — dwa stany,
// dwa zdania, zero zgadywania. Wołana i z mFill, i wprost z suwaka (rf-31), żeby zdanie zmieniało
// się pod palcem, a nie po echu konfiguracji z serwera.
function mStickSensNoteSync(){
  const m=state.mouse,nt=document.getElementById("mStickSensNote"),sm=nt&&nt.querySelector("small");
  if(!sm)return;
  const zx=+m.stickSensX===0,zy=+m.stickSensY===0;
  const t=(zx&&zy)
    ?_gl("Obie osie na 0,00× — drążek stoi w miejscu, choćby wyjście było włączone.",
         "Both axes at 0.00× — the stick stays at rest even with the output on.")
    :zx?_gl("Oś X na 0,00× — drążek nie wychyla się na boki, działa tylko pion.",
            "Axis X at 0.00× — the stick no longer moves sideways, only up and down.")
    :zy?_gl("Oś Y na 0,00× — drążek nie wychyla się w pionie, działa tylko na boki.",
            "Axis Y at 0.00× — the stick no longer moves up and down, only sideways.")
    :_gl("1,00 = bez zmian · niżej = trzeba pochylić dalej i oś nie dochodzi do końca · 0,00 = oś wyłączona · do celowania zwykle X wyżej niż Y",
         "1.00 = unchanged · lower = you tilt further and the axis stops short of full · 0.00 = axis off · for aiming, X is usually higher than Y");
  if(sm.textContent!==t)sm.textContent=t;
  sm.style.color=(zx||zy)?"var(--warn)":"var(--dim)";
}
function mFill(){
  const m=state.mouse,$=id=>document.getElementById(id);
  const set=(id,v)=>{const e=$(id);if(e&&document.activeElement!==e)e.value=v;};
  const setc=(id,v)=>{const e=$(id);if(e&&document.activeElement!==e)e.checked=v;};
  const txt=(id,v)=>{const e=$(id);if(e)e.textContent=v;};
  // source — axes/inversion/dead zone, per mode and never shared. The Mysz card is hard-wired to
  // the "mouse*" fields; the Kontroler card follows padMode() (the pad half it is showing).
  const _pm=padMode();
  set("mAxisX",m.mouseAxisX);set("mAxisY",m.mouseAxisY);setc("mInvX",m.mouseInvertX);setc("mInvY",m.mouseInvertY);set("mDead",m.mouseDeadzone);
  set("kAxisX",m[_pm+"AxisX"]);set("kAxisY",m[_pm+"AxisY"]);setc("kInvX",m[_pm+"InvertX"]);setc("kInvY",m[_pm+"InvertY"]);set("kDead",m[_pm+"Deadzone"]);
  // mouse: motion source (axis / 3D filter) + metrics + edge-follow
  set("mMouseSource",m.mouseSource);set("mMouseMetricX",m.mouseMetricX);set("mMouseMetricY",m.mouseMetricY);
  set("mMouseFilterScale",m.mouseFilterScale);setc("mMouseEdge",m.mouseEdgeFollow);
  // where the cursor may go — the fence, and the target the pointing mode aims into
  set("mArea",m.mouseArea);setc("mAreaWork",m.mouseAreaWork);set("mAreaPad",m.mouseAreaPad);
  set("mRectX",m.mouseRectX);set("mRectY",m.mouseRectY);set("mRectW",m.mouseRectW);set("mRectH",m.mouseRectH);
  // klik bez klikania — dwa suwaki, przełącznik i rodzaj kliknięcia (rf-31c rysuje podpisy)
  setc("mDwellOn",m.dwellOn);set("mDwellMs",m.dwellMs);set("mDwellRad",m.dwellRadius);set("mDwellClick",m.dwellClick);
  if(typeof mDwellSync==="function")mDwellSync();
  // the <select> of monitors and the note under the map need the server's answer (GET /screens),
  // which is rf-31's poll — guarded by name so the cheat-sheet view (no rf-31) does not throw
  if(typeof mAreaSync==="function")mAreaSync();
  // mouse
  set("mSensX",m.sensX);set("mSensY",m.sensY);set("mSmooth",m.smooth);set("mMax",m.maxStep);
  set("mSmoothMode",m.smoothMode);set("mOeMin",m.oeMinCutoff);set("mOeBeta",m.oeBeta);
  set("mScrollAxis",m.scrollAxis);set("mScrollThr",m.scrollThreshold);set("mScrollSens",m.scrollSens);setc("mScroll",m.scroll);
  txt("mSensXv",(+m.sensX).toFixed(3));txt("mSensYv",(+m.sensY).toFixed(3));
  txt("mSmoothv",(+m.smooth).toFixed(2));txt("mScrollSensv",(+m.scrollSens).toFixed(2));
  txt("mOeMinv",(+m.oeMinCutoff).toFixed(2));txt("mOeBetav",(+m.oeBeta).toFixed(3));
  // response shaping: expo / tightening / two-zone acceleration / angular dead zone / auto-tare
  set("mMouseExpo",m.mouseExpo);set("mTighten",m.tighten);setc("mAccelOn",m.accelOn);
  set("mSensFast",m.sensFast);set("mAccelLo",m.accelThrLo);set("mAccelHi",m.accelThrHi);
  // one field, two boxes: auto-tare is about the capsule, not about which output it drives
  set("mMouseFilterDead",m.mouseFilterDead);set("mDpadFilterDead",m.dpadFilterDead);
  setc("mAutoTare",m.autoTare);setc("kAutoTare",m.autoTare);
  txt("mMouseExpov",(+m.mouseExpo).toFixed(2));txt("mTightenv",Math.round(m.tighten));txt("mSensFastv",(+m.sensFast).toFixed(3));
  // analog stick
  set("mStickBackend",m.stickBackend);set("mStickWhich",m.stickWhich);set("mStickRange",m.stickRange);
  set("mStickInner",m.stickInner);set("mStickOuter",m.stickOuter);set("mStickExpo",m.stickExpo);set("mStickWsadThr",m.stickWsadThr);
  set("mStickSource",m.stickSource);set("mStickMetricX",m.stickMetricX);set("mStickMetricY",m.stickMetricY);
  set("mStickFilterScale",m.stickFilterScale);set("mStickAccel",m.stickAccel);
  set("mStickSensX",m.stickSensX);set("mStickSensY",m.stickSensY);
  txt("mStickRangev",Math.round(m.stickRange));txt("mStickInnerv",Math.round(m.stickInner*100)+"%");
  txt("mStickOuterv",Math.round(m.stickOuter*100)+"%");txt("mStickExpov",(+m.stickExpo).toFixed(1));
  txt("mStickSensXv",(+m.stickSensX).toFixed(2)+"×");txt("mStickSensYv",(+m.stickSensY).toFixed(2)+"×");
  txt("mStickWsadThrv",Math.round(m.stickWsadThr*100)+"%");txt("mStickAccelv",Math.round(m.stickAccel*100)+"%");
  // auto mode switching
  setc("mAutoSwitch",m.autoSwitch);set("mSwitchKind",m.switchKind);set("mSwitchMetric",m.switchMetric);
  set("mSwitchChannel",m.switchChannel);set("mSwitchCmp",m.switchCmp);set("mSwitchThreshold",m.switchThreshold);
  setc("mSwitchAbs",m.switchAbs);set("mSwitchHyst",m.switchHyst);set("mModeTrue",m.modeTrue);set("mModeFalse",m.modeFalse);
  txt("mSwitchUnit",m.switchKind==="axis"?"LSB":"°");
  // d-pad
  set("mDpadBackend",m.dpadBackend);set("mDpadRange",m.dpadRange);set("mDpadInner",m.dpadInner);
  // "one key at a time" vs diagonals — one choice, two named states, so nobody has to work out what
  // an unticked "Skosy" box does to the number of keys held down
  {const sg=$("mDpadDiagSeg");
   if(sg)for(const b of sg.querySelectorAll("button")){const on=(b.dataset.v==="1")===!!m.dpadDiagonal;
     b.classList.toggle("on",on);b.setAttribute("aria-pressed",on?"true":"false");}
   const nt=$("mDpadDiagNote");
   if(nt)nt.textContent=m.dpadDiagonal
     ? "Na skosie trzymane są DWA klawisze naraz (np. ↑ + →). Niektóre gry tego nie lubią."
     : "Zawsze najwyżej jeden wciśnięty klawisz — przekątna wybiera kierunek o większym wychyleniu.";}
  setc("mDpadZones",state.dpadZones!==false);
  set("mDpadSource",m.dpadSource);set("mDpadMetricX",m.dpadMetricX);set("mDpadMetricY",m.dpadMetricY);set("mDpadFilterScale",m.dpadFilterScale);
  txt("mDpadRangev",Math.round(m.dpadRange));txt("mDpadInnerv",Math.round(m.dpadInner*100)+"%");
  // the dead zone lives INSIDE "pełne", so the box cannot offer more than the pad has (the engine
  // clamps it anyway — but a number you can type and never get is a small lie)
  {const e=$("mDpadFilterDead");if(e)e.max=(0.9*Math.max(2,+m.dpadFilterScale||45)).toFixed(1);}
  // key labels (d-pad + WSAD stick)
  const gl={mDpadUp:"↑",mDpadDown:"↓",mDpadLeft:"←",mDpadRight:"→",mStickUp:"↑",mStickDown:"↓",mStickLeft:"←",mStickRight:"→"};
  for(const [id,key] of [["mDpadUp","dpadUp"],["mDpadDown","dpadDown"],["mDpadLeft","dpadLeft"],["mDpadRight","dpadRight"],
                         ["mStickUp","stickUp"],["mStickDown","stickDown"],["mStickLeft","stickLeft"],["mStickRight","stickRight"]]){
    const e=$(id);if(e&&!e.classList.contains("cap"))e.textContent=gl[id]+" "+(m[key]||"—");}
  const show=(id,on)=>{const e=$(id);if(e)e.style.display=on?"":"none";};
  // The Mysz card shows its settings unconditionally: they are the mouse settings whether or not the
  // capsule is currently driving the cursor, and hiding a card's only contents because the other tab
  // holds the engine would make the tab look broken.
  //
  // WHAT IS *NOT* HERE, on purpose: the four top-level containers of the Kontroler tab
  // (#mGrpStick, #mGrpDpad, #kGrpSource, #kGrpInvert), #mAutoFold, the part panel itself and the
  // spis of every pad mapping. Their visibility follows the PART clicked on the pad drawing, which
  // only rf-43 knows — padPartSync() at the bottom of this function is the single owner. Two owners
  // of one display property is a fight, and the one that ran second would win at random. Everything
  // INSIDE those containers stays here: that is value logic (which backend, which source), not
  // layout. ONE exception, noted where it used to live: #mStickWhichFld.
  show("mGrpMouse",true);
  // "source — axes" groups only when that mode reads a RAW AXIS (the 3D filter path has no channels)
  const mFilter=(m.mouseSource==="filter"), mAbs=!!m.mouseAbsolute&&mFilter;
  show("mGrpSource",m.mouseSource==="axis");
  show("mMouseFilterFld",mFilter);
  show("mMouseFilterDeadFld",mFilter);
  // PRĘDKOŚĆ czy POŁOŻENIE — dwa nazwane stany plus zdanie, co to znaczy (jak „Klawisze naraz”)
  {const sg=$("mAbsSeg");
   if(sg)for(const b of sg.querySelectorAll("button")){const on=(b.dataset.v==="1")===!!m.mouseAbsolute;
     b.classList.toggle("on",on);b.setAttribute("aria-pressed",on?"true":"false");}
   const nt=$("mAbsNote");
   if(nt){
     if(m.mouseAbsolute&&!mFilter)
       nt.textContent=_gl("Wskazywanie potrzebuje źródła 🧭 Filtr 3D — z osi kursor jest przesuwany jak zwykle. Przełącz źródło niżej.",
                          "Pointing needs the 🧭 3D filter source — from a raw axis the cursor is simply moved as usual. Switch the source below.");
     else if(m.mouseAbsolute)
       nt.textContent=_gl("Kursor stoi tam, gdzie celujesz kapslem; wychylenie z pola niżej sięga brzegu obszaru. Kapsel w bezruchu oddaje kursor zwykłej myszy.",
                          "The cursor sits wherever the capsule points; the tilt set below reaches the edge of the area. A capsule lying still hands the cursor back to the real mouse.");
     else
       nt.textContent=_gl("Wychylenie zadaje prędkość: kursor jedzie, dopóki trzymasz kapsel pochylony, i zostaje tam, gdzie dojechał.",
                          "The tilt sets a speed: the cursor travels while you hold the capsule over, and stays where it got to.");
     nt.style.color=(m.mouseAbsolute&&!mFilter)?"var(--warn)":"";}}
  // …AND THE SAME THING SAID WHERE IT HAPPENED. Choosing „Położenie" moves „Źródło ruchu" from
  // „📈 Oś" to „🧭 Filtr 3D" and takes Czułość X/Y, Stabilizacja, Akceleracja and Scroll off the
  // screen with it. The switch is necessary (pointing needs an angle and only the filter has one)
  // and it was announced by a toast that appears in ANOTHER tab — so from this card it looked like
  // half the settings had simply gone missing. A line under the picker, for as long as pointing is
  // on, plus the „Oś" option itself saying why it cannot be chosen.
  {const nt=$("mMouseSrcNote");
   if(nt){
     nt.style.display=m.mouseAbsolute?"":"none";
     if(m.mouseAbsolute)nt.textContent=
       _gl("Wskazywanie działa tylko ze źródłem 🧭 Filtr 3D — przełączono. Czułość X/Y, stabilizacja kursora, akceleracja i scroll należą do źródła 📈 Oś, więc są teraz ukryte.",
           "Pointing only works with the 🧭 3D filter source — switched over. Sensitivity X/Y, cursor stabilisation, acceleration and scrolling belong to the 📈 Axis source, so they are hidden now.");
   }}
  {const sel=$("mMouseSource"),opt=sel&&sel.querySelector('option[value="axis"]');
   if(opt){
     opt.disabled=!!m.mouseAbsolute;
     const why=_gl("Niedostępne przy „Położenie (wskazywanie)”: wskazywanie potrzebuje kąta pochylenia, a zna go tylko filtr 3D. Wróć do „Prędkość”, żeby wybrać oś.",
                   "Unavailable with “Position (pointing)”: pointing needs a tilt angle, and only the 3D filter knows one. Go back to “Speed” to pick an axis.");
     if(m.mouseAbsolute){if(opt.title!==why)opt.title=why;}
     else if(opt.title)opt.removeAttribute("title");
   }}
  // Pokrętła, których silnik w danym układzie NIE CZYTA, znikają. „Czułość” przy filtrze 3D nie
  // robiła nic od zawsze (prędkość liczy się z „Maks. krok” × wychylenie), a suwak, którym można
  // kręcić bez skutku, czyta się jak zepsuta aplikacja. Tak samo stabilizacja i akceleracja
  // (silnik pomija je w filtrze) oraz scroll, który działa wyłącznie ze źródła „Oś”.
  const mVelAxis=(!mFilter&&!mAbs);
  show("mSensXFld",mVelAxis);show("mSensYFld",mVelAxis);
  show("mTightenFld",mVelAxis);show("mAccelFold",mVelAxis);show("mScrollFold",mVelAxis);
  show("mMaxFld",!mAbs);                       // „jak daleko na próbkę” — położenie nie ma prędkości
  show("mMouseEdgeFld",mFilter&&!mAbs);        // edge-follow to pomysł prędkościowy
  show("mMouseExpoFld",!mAbs||mFilter);        // krzywa działa w obu (w położeniu kształtuje precyzję środka)
  {const e=$("mMouseScaleLbl");if(e)e.textContent=mAbs?_gl("brzeg obszaru przy","the edge of the area at")
                                                     :_gl("pełna prędkość przy","full speed at");}
  {const e=$("mMaxNote");if(e)e.textContent=mFilter?_gl("px na próbkę — przy pełnym wychyleniu","px per sample — at full tilt")
                                                  :_gl("px","px");}
  // area group: monitor picker only when a monitor is being picked, rectangle only for a rectangle,
  // "skip the taskbar" only where there IS one screen's work area to take
  show("mMonitorFld",m.mouseArea==="monitor");
  show("mRectFld",m.mouseArea==="custom");
  show("mAreaWorkFld",m.mouseArea==="monitor"||m.mouseArea==="cursor");
  // auto-switching is configured in the Kontroler tab, so the Mysz tab only gets told about it
  show("mAutoHint",!!m.autoSwitch);
  // smoothing mode: classic (EMA slider) vs One-Euro (two adaptive sliders)
  const _oe=m.smoothMode==="oneeuro";show("mSmoothFld",!_oe);show("mOeMinFld",_oe);show("mOeBetaFld",_oe);
  show("mDpadKeysRow",m.dpadBackend!=="gamepad");
  // d-pad source: 3D filter -> metrics + full tilt + the dead zone in degrees; axis -> full
  // deflection (LSB) + the dead zone as a share of it. Two units, one idea: leave the zone, fire.
  const dFilter=m.dpadSource==="filter";show("mDpadFilterFld",dFilter);show("mDpadFilterDeadFld",dFilter);
  show("mDpadRangeFld",!dFilter);show("mDpadInnerFld",!dFilter);
  // stick: gamepad/touchpad -> the ViGEmBus note (both go out through the driver);
  // wsad -> threshold + WSAD keys; touchpad -> what a finger on the glass actually is
  const wsad=m.stickBackend==="wsad", tp=m.stickBackend==="touchpad";
  // The driver is never explained here: the readiness line names it and the one box under that
  // line explains it (mUpdateAvail). This line only speaks when it says something of its own
  // (no controller for this capsule, the pad live or parked), see `data-say` below.
  {const sa=$("mStickAvail");show("mStickAvail",!wsad&&!!(sa&&sa.dataset.say));}
  show("mStickThrFld",wsad);show("mStickKeysRow",wsad);
  show("mStickTpNote",tp);
  // THE SECTION IS NAMED AFTER ITS OUTPUT. With „🖐 Palec na touchpadzie" chosen the heading still
  // read GAŁKA ANALOGOWA and the panel still offered the stick's anti-deadzone — a control that
  // jumps over a GAME's stick dead zone, of which a finger on a touch surface has none.
  {const gl=$("mStickGrpLbl");
   if(gl){const t=tp?_gl("Palec na touchpadzie","A finger on the touchpad")
                  :wsad?_gl("Gałka → klawiatura (WSAD)","Stick → keyboard (WASD)")
                       :_gl("Gałka analogowa","Analog stick");
     if(gl.textContent!==t)gl.textContent=t;}}
  show("mStickOuterFld",!tp);
  // Czułość osi — tylko przy wyjściu „drążek analogowy", bo tylko tam silnik ją czyta
  // (_shape_stick): palec na touchpadzie celuje w MIEJSCE na szkle, a WSAD ma własny próg. Suwak,
  // którym można kręcić bez skutku, czyta się jak zepsuta aplikacja — ta sama zasada, co przy
  // czułości myszy w filtrze 3D.
  for(const id of ["mStickSensXFld","mStickSensYFld","mStickSensNote"])show(id,!tp&&!wsad);
  mStickSensNoteSync();
  // #mStickWhichFld IS INSIDE #mGrpStick and therefore ought to be this function's, by the rule
  // stated below: containers belong to rf-43, their contents belong here. It moved out anyway, and
  // deliberately — WHICH stick stopped being a value the user types into this panel the moment the
  // pad drawing became the way to pick one (padPartSelect writes m.stickWhich from the click). The
  // row would have shown „Prawy (RS)" under a heading reading „Lewy drążek" whenever the two got
  // out of step, which is exactly what the owner reported. So padPartSync hides it unconditionally
  // and this line is gone rather than fighting it every time the backend changes: `set("mStickWhich",
  // …)` above still keeps the field's VALUE right, which is all anything reading it needs.
  // stick source: 3D filter -> metrics+scale; axis -> full stick deflection (LSB)
  const sFilter=m.stickSource==="filter";
  show("mStickFilterFld",sFilter);show("mStickRangeFld",!sFilter);
  // auto-switch: filter condition -> metric; axis -> channel
  show("mSwitchMetricFld",m.switchKind!=="axis");show("mSwitchChannelFld",m.switchKind==="axis");
  // anti-leak: if the captured button was just hidden, cancel the listener
  if(typeof _dirCapBtn!=="undefined"&&_dirCapBtn&&!_dirCapBtn.offsetParent)cancelDirCapture();
  // The two switches are ONE engine flag plus the mode: "on" means "the motion is going into MY
  // output". Both lit at once would promise a capsule can drive a cursor and a stick at the same
  // time, which no amount of UI can make true.
  const _mouseOn=!!(m.enabled&&m.mode==="mouse"), _padOn=!!(m.enabled&&m.mode!=="mouse");
  for(const [id,on] of [["mEnable",_mouseOn],["kEnable",_padOn]]){
    const en=$(id);if(!en)continue;
    en.classList.toggle("on",on);en.setAttribute("aria-checked",on?"true":"false");}
  // …and the lamp on the TAB, in the same breath as the switch itself. The click handler flips the
  // flag and calls this function straight away, so the switch moved instantly while its dot waited
  // for the server's echo to come back — a fraction of a second in which the app looked like it had
  // not heard the click. Every other group already refreshes its dot from its own reflect function
  // (Mapowanie in trigReflectEnable, MIDI/OSC, Synth, REST); motion was the one that did not.
  if(window.updateTabDots)updateTabDots();
  mUpdateAvail();mUpdateNote();if(typeof mUpdateAutoState==="function")mUpdateAutoState();
  // LAST, and after the values are in: the Kontroler tab's panel shows one PART of the pad, and
  // which controls belong to that part is rf-43's question. It reads the fields this function just
  // filled (the stick's source, the d-pad's source), so it cannot run first. Guarded by name —
  // rf-43 is a late file and the overlay window does not load it at all.
  if(typeof padPartSync==="function")try{padPartSync();}catch(e){}
  // Pasek tożsamości konfiguracji (rf-49c). Tutaj, bo mFill to JEDYNE wejście „przerysuj panel
  // z state.mouse" — woła je onMouseCfg (strumień `mouse_cfg` ORAZ przełączenie kapsla przez
  // mouseFetchState), więc nazwa i „zmienione" nie mogą się rozjechać z tym, co widać.
  if(typeof mouseCfgSync==="function")try{mouseCfgSync();}catch(e){}
}
// Two cards, two status lines. Only ONE of them can be the live one, so the other says where the
// motion actually went — "wyłączone" on the Kontroler tab while the cursor is being driven would
// read as a fault, when it is simply the other tab's turn.
function mUpdateNote(){
  const c=state.cfg,m=state.mouse;
  const _side=(m.mode==="mouse")?"m":"k";     // which card currently owns the engine
  // Each card gets ITS OWN noun. Deriving it from m.mode alone put "(kursor)" in the Kontroler
  // card's off-line whenever the engine sat in mouse mode — a controller card telling you to turn
  // on the cursor. The mouse card always talks about the cursor; the controller card talks about
  // whichever of its two halves is selected (padMode), which equals m.mode whenever it is live.
  const _nounOf=side=>(side==="m")?_gl("kursor","the cursor")
    :(padMode()==="dpad"?_gl("krzyżak","the d-pad"):_gl("drążek","the stick"));
  // RUCH ZAPARKOWANY — TRZECI STAN TEJ KARTY, i dlatego ma własne zdanie. Moduł Kontroler jest
  // włączony (mapowania `pad:` wychodzą), ale ruch kapsla nie prowadzi drążka: „⚠ NA ŻYWO" byłoby
  // tu nieprawdą, a „włącz przełącznikiem On" odesłałoby człowieka do przełącznika, który JEST na On.
  const _park=!!(m.padPark&&m.mode!=="mouse");
  let warn=false;
  const _lineFor=(noun,side)=>{
    // Chip #mState/#kState already says "○ wyłączony"; repeating "wyłączone" here read as two states in one
    // row. The line now says WHERE the switch is instead (card header, On) and what the capsule will drive.
    if(!m.enabled)return _gl("włącz przełącznikiem On w nagłówku karty, a kapsel poprowadzi ","turn the On switch in the card header on and the capsule will drive ")+noun;
    // Rzeczownik przychodzi w MIANOWNIKU („drążek", „krzyżak"), bo w pozostałych zdaniach jest
    // podmiotem („drążek sterowany kapslem"). Zdanie musi być więc tak ułożone, żeby i tu nim był —
    // „nie prowadzi drążek" to nie jest polski, a odmienianie rzeczownika w trzech miejscach naraz
    // skończyłoby się słownikiem przypadków dla dwóch słów.
    if(side==="k"&&_park)return _gl("moduł włączony — przyciski pada działają, ale ruch jest zaparkowany: ",
                                    "the module is on — the pad buttons work, but the motion is parked: ")
                                +noun+_gl(" stoi. Włącz go przełącznikiem przy wybranej części pada.",
                                          " is standing still. Switch it back on with the toggle beside the selected part of the pad.");
    if(!c.sendKeys)return _gl("podgląd (--no-keys) — ","preview (--no-keys) — ")+noun+_gl(" nie działa"," does not work");
    // Simulation drives the cursor/stick/d-pad for real — it just says WHAT is driving them.
    if(c.simulate){warn=true;return _gl("⚠ SYMULACJA NA ŻYWO — ","⚠ SIMULATION LIVE — ")+noun
        +_gl(" sterowany symulacją"," driven by the simulation");}
    warn=true;return _gl("⚠ NA ŻYWO — ","⚠ LIVE — ")+noun+_gl(" sterowany kapslem"," controlled by the capsule");
  };
  // the idle card's line: where the motion is, not that it is missing
  // …chyba że ruch stoi zaparkowany po stronie Kontrolera — wtedy nie prowadzi NICZEGO, a zdanie
  // „ruch steruje teraz kontrolerem" byłoby na karcie Myszy zwykłą nieprawdą.
  const _away=(_side==="m")
    ? _gl("ruch steruje teraz kursorem (ekran Mysz)","the motion is driving the cursor right now (Mouse screen)")
    : _park
    ? _gl("ruch należy do Kontrolera, ale jest tam zaparkowany — nie prowadzi teraz niczego",
          "the motion belongs to the Controller, but it is parked there — it is driving nothing right now")
    : _gl("ruch steruje teraz kontrolerem (ekran Kontroler)","the motion is driving the controller right now (Controller screen)");
  for(const side of ["m","k"]){
    const mine=(side===_side), lit=m.enabled&&mine&&!(side==="k"&&_park);
    const note=document.getElementById(side+"Note");
    if(note){note.textContent=(!m.enabled||mine)?_lineFor(_nounOf(side),side):_away;
      note.style.color=(warn&&mine)?"var(--warn)":"";}
    const en=document.getElementById(side+"Enable");if(en)en.classList.toggle("live",warn&&mine);
    const st=document.getElementById(side+"State");
    if(st){let s=m.enabled?"○ nieaktywny":"○ wyłączony";const p=state.mousePrev||{};
      // Zaparkowany ruch to nie „nieaktywny": nieaktywny znaczy „czeka na ruch ręki", a tu ruch
      // ręki nic nie zrobi, dopóki człowiek nie odparkuje. Dwa stany, dwa napisy.
      if(side==="k"&&_park&&m.enabled)s="○ ruch zaparkowany";
      if(lit){
        if(m.mode==="mouse")s=p.scroll?"🖱 scroll":"🖱 ruch";
        else if(m.mode==="stick")s="🎮 "+(m.stickWhich==="right"?"RS":"LS");
        else{const d=p.dirs||{},on=["up","down","left","right"].filter(k=>d[k]);
          s=on.length?"✛ "+on.map(k=>({up:"↑",down:"↓",left:"←",right:"→"}[k])).join(""):"✛ —";}}
      st.textContent=s;st.style.color=lit?cv('--ok'):cv('--dim');}
  }
}
const MOUSE_KEYS=["enabled","mode","axisX","axisY","sensX","sensY","invertX","invertY","deadzone","smoothMode","smooth","oeMinCutoff","oeBeta","maxStep",
  "mouseAxisX","mouseAxisY","mouseInvertX","mouseInvertY","mouseDeadzone","mouseSource","mouseMetricX","mouseMetricY","mouseFilterScale","mouseEdgeFollow",
  // cursor area (fence / pointing target) + pointing itself — same lesson as padShare: a key that
  // is not on this list never survives a reload, because state.mouse is rebuilt from it
  "mouseArea","mouseMonitor","mouseAreaWork","mouseAreaPad","mouseRectX","mouseRectY","mouseRectW","mouseRectH","mouseAbsolute",
  // Klik bez klikania — ta sama lekcja co wyżej: klucz spoza tej listy nie przeżywa odświeżenia
  "dwellOn","dwellMs","dwellRadius","dwellClick",
  "stickAxisX","stickAxisY","stickInvertX","stickInvertY","stickDeadzone","dpadAxisX","dpadAxisY","dpadInvertX","dpadInvertY","dpadDeadzone",
  "scroll","scrollAxis","scrollSens","scrollThreshold","stickBackend","stickSource","stickMetricX","stickMetricY","stickFilterScale","stickAccel",
  "stickWhich","stickRange","stickInner","stickOuter","stickExpo","stickSensX","stickSensY",
  "stickWsadThr","stickUp","stickDown","stickLeft","stickRight",
  "dpadBackend","dpadDiagonal","dpadRange","dpadInner","dpadUp","dpadDown","dpadLeft","dpadRight",
  // Źródło krzyżaka i jego strojenie w stopniach. Brakowało ich tu od zawsze, więc po każdym
  // odświeżeniu panel pokazywał domyślne „filtr 3D / 45°" niezależnie od tego, co kapsel ma
  // naprawdę — a pierwszy ruch dowolnym suwakiem odsyłał tę domyślną wartość z powrotem na serwer
  // (postMouse wysyła CAŁE state.mouse). Ta sama lekcja co przy padShare, tylko cichsza.
  "dpadSource","dpadMetricX","dpadMetricY","dpadFilterScale",
  "autoSwitch","switchKind","switchMetric","switchChannel","switchCmp","switchThreshold","switchAbs","switchHyst","modeTrue","modeFalse",
  "mouseExpo","tighten","accelOn","sensFast","accelThrLo","accelThrHi","mouseFilterDead","dpadFilterDead","autoTare",
  // Whose controller this capsule's pad output lands on. It was missing here, so after a reload
  // state.mouse.padShare was undefined until somebody touched the picker — and the Kontroler hub
  // reads it to say which capsule shares with which.
  "padShare",
  // RUCH ZAPARKOWANY — moduł Kontroler włączony, ruch nie prowadzi drążka ani krzyżaka. Ta sama
  // lekcja co przy padShare: klucz spoza tej listy nie przeżywa odświeżenia, a tu kosztowałoby to
  // szczególnie drogo — po F5 zaparkowany drążek ożyłby sam z siebie.
  "padPark",
  // JAK SIĘ TA KONFIGURACJA NAZYWA (pasek tożsamości, rf-49c). Klucz configu jak każdy inny, więc
  // musi być na tej liście — bez tego nazwa znikałaby przy odświeżeniu, a kapsel wyglądałby na
  // nigdy niezapisany pod żadną nazwą.
  "configName"];
function _mouseGp(m){
  state.mouseGp=state.mouseGp||{mod:false,on:false};
  if(m.gpMod!=null)state.mouseGp.mod=!!m.gpMod;
  if(m.gpOn!=null)state.mouseGp.on=!!m.gpOn;
  // NO CONTROLLER AT ALL is a different answer from "no driver", and until the tray existed the
  // two could not be told apart here: a capsule with no pad reports mod=false, on=false, which
  // used to print "install vgamepad" at somebody who had it installed all along.
  if(m.gpNone!=null)state.mouseGp.none=!!m.gpNone;
  // Sterownik ViGEmBus osobno od modułu vgamepad (serwer: gpDrv, tylko w zdarzeniu konfiguracji):
  // true / false / null = „nie umiem sprawdzić". Bez tego panel nie umiał powiedzieć „brakuje sterownika".
  if(m.gpDrv!==undefined)state.mouseGp.drv=m.gpDrv;
}
function onMouseCfg(m,arrived){
  const prevMode=state.mouse.mode;
  for(const k of MOUSE_KEYS)if(m[k]!=null)state.mouse[k]=m[k];
  // A capsule arriving in stick/d-pad mode decides which half the Kontroler tab shows — otherwise
  // loading a d-pad setup would open that tab on the stick and hide the settings that are running.
  // ONLY on a genuine arrival (capsule switch fetch) or when the mode actually moved, though: this
  // handler also receives the echo of every config we just posted, and an unconditional sync let
  // that echo yank the viewed half (and with it the part selection) back to the engine's mode a
  // quarter-second after someone clicked the other one.
  if((state.mouse.mode==="stick"||state.mouse.mode==="dpad")&&(arrived||state.mouse.mode!==prevMode))
    setPadMode(state.mouse.mode);
  // The cheat sheet and the overlays draw this capsule's stick/d-pad/mouse from a per-capsule copy
  // (ovMotionCfg), refreshed on a slow timer. Hand it the new settings now, or a dead zone dragged
  // in the tab would take up to three seconds to move in the picture right next to it.
  {const D=state.devices[state.activeDeviceId];if(D)D.mouseCfg=Object.assign({},state.mouse);}
  _mouseGp(m);buildMouseControls();mFill();
}
// NOTE: we do NOT sync state.mouse.mode from this event — it is a fast preview stream (~25 Hz)
// that lags behind the POST and would overwrite a mode the user just picked. The authoritative
// mode comes from the UI and the mouse_cfg event.
function onMouse(m){state.mousePrev=m;_mouseGp(m);mUpdateNote();mUpdateAvail();mUpdateAutoState();}
// Live auto-switch state: which mode is active + whether the condition is met
function mUpdateAutoState(){
  const el=document.getElementById("mAutoState");if(!el)return;
  const m=state.mouse,p=state.mousePrev||{};
  if(!m.autoSwitch){el.textContent="wyłączone — tryb wybierasz przełącznikiem powyżej";el.className="mouse-avail col2";return;}
  const lbl={mouse:"🖱 Mysz",stick:"🎮 Gałka",dpad:"✛ Krzyżak"}[p.mode||m.modeFalse]||(p.mode||"—");
  el.textContent=`▶ Aktywny: ${lbl} · warunek ${p.cond?"SPEŁNIONY":"niespełniony"}`;
  el.className="mouse-avail col2 "+(p.cond?"ok":"");
}
// Czego brakuje do wirtualnego pada Xbox / DualShock — null, gdy niczego (albo pad już działa).
// What is missing for the virtual pad, as a rfNeedHtml() description; null when nothing is.
function mPadNeed(gp){
  if(!gp||gp.on||gp.none)return null;
  const url="https://github.com/nefarius/ViGEmBus/releases";
  if(!gp.mod)return {url,urlLabel:_gl("Sterownik ViGEmBus ↗","ViGEmBus driver ↗"),
    titleHtml:_gl("Brakuje modułu vgamepad i sterownika ViGEmBus","The vgamepad module and the ViGEmBus driver are missing"),
    whyHtml:_gl("Bez nich wirtualny pad nie powstanie: gałka zostaje podglądem na ekranie, a przyciski kontrolera nigdzie nie polecą.",
                "Without them no virtual pad is created: the stick stays an on-screen preview and controller buttons go nowhere."),
    fixHtml:_gl("W wersji uruchamianej ze źródeł wpisz <code>pip install vgamepad</code>, zainstaluj ViGEmBus i uruchom aplikację ponownie.",
                "When running from source, type <code>pip install vgamepad</code>, install ViGEmBus and restart the app.")};
  if(gp.drv===false)return {url,urlLabel:_gl("Pobierz ViGEmBus ↗","Download ViGEmBus ↗"),recheck:"mouseFetchState",
    titleHtml:_gl("Brakuje sterownika ViGEmBus","The ViGEmBus driver is missing"),
    whyHtml:_gl("Bez niego Windows nie zobaczy wirtualnego pada Xbox ani DualShock: gałka zostaje podglądem na ekranie, krzyżak zadziała tylko przez klawiaturę, a przyciski kontrolera nigdzie nie polecą. Kontroler Wii (emulator) sterownika nie potrzebuje.",
                "Without it Windows cannot see a virtual Xbox or DualShock pad: the stick stays an on-screen preview, the d-pad works only through the keyboard and controller buttons go nowhere. The Wii controller (emulator) does not need the driver."),
    fixHtml:_gl("Pobierz instalator (plik <code>ViGEmBus_…_x64.msi</code>), zainstaluj go i kliknij „Sprawdź ponownie”. Czasem Windows prosi o restart.",
                "Download the installer (the <code>ViGEmBus_…_x64.msi</code> file), install it and click “Check again”. Windows sometimes asks for a restart.")};
  return null;
}
// Virtual controller accessibility message (stick / d-pad)
function mUpdateAvail(){
  const gp=state.mouseGp||{mod:false,on:false},$=id=>document.getElementById(id);
  // `gp.on` mówi, że pad ISTNIEJE w Windowsie — a to nie to samo, co „drążek nim steruje".
  // Przy zaparkowanym ruchu pad żyje i przyciski przez niego wychodzą, tylko drążek stoi; zdanie
  // „drążek steruje padem" byłoby wtedy nieprawdą wypisaną na zielono.
  const _park=!!(state.mouse&&state.mouse.padPark&&state.mouse.mode!=="mouse");
  // ONE MESSAGE ABOUT THE DRIVER PER SCREEN (P-G3-02). The readiness line has the row
  // "ViGEmBus driver installed"; when it is missing, #padCtlAvail right under that line is the
  // single "something outside the app is missing" box with the download. With the driver there,
  // nothing else repeats it: the stick group's line stays quiet and only speaks about what is its
  // own (this capsule on no controller, the pad live or parked).
  const need=mPadNeed(gp);
  const sa=$("mStickAvail");
  if(sa){let t="",cls="";
    if(gp.none){t="🔌 Ten kapsel nie gra na żadnym kontrolerze, więc drążek nie ma dokąd wyjść. Przypnij go w sekcji Kontrolery.";cls="warn";}
    else if(gp.on&&_park){t="🎮 Wirtualny kontroler aktywny. Przyciski wychodzą, ale ruch kapsla nie prowadzi drążka (zaparkowany).";}
    else if(gp.on){t="🎮 Wirtualny kontroler aktywny, drążek steruje padem.";cls="ok";}
    sa.textContent=t;sa.className="mouse-avail col2"+(cls?" "+cls:"");
    if(t)sa.dataset.say="1";else delete sa.dataset.say;
    sa.style.display=(t&&state.mouse&&state.mouse.stickBackend!=="wsad")?"":"none";}
  const ca=$("padCtlAvail");
  if(ca){
    // Only pads that need the driver count: a Wii controller talks to an emulator, no driver.
    const pads=(typeof padList==="function")?padList():[];
    const needsDrv=!pads.length||pads.some(p=>!/wii|dsu/i.test(String(p&&p.kind||"")));
    const on=!!(need&&needsDrv&&typeof rfNeedHtml==="function");
    ca.hidden=!on;
    if(on){const html=rfNeedHtml(need);
      if(ca._rfNeed!==html){ca._rfNeed=html;ca.className="mouse-avail rf-need";ca.setAttribute("role","status");ca.innerHTML=html;}}
    else{ca._rfNeed="";ca.innerHTML="";}}
  const da=$("mDpadAvail");
  if(da){const m=state.mouse;let t,cls="";
    if(m.dpadBackend==="gamepad"){
      if(gp.none){t="🔌 Ten kapsel nie gra na żadnym kontrolerze, więc krzyżak nie ma dokąd wyjść. Przypnij go w sekcji Kontrolery albo przełącz na „Klawiatura”.";cls="warn";}
      else if(gp.on&&_park){t="🎮 Wirtualny kontroler aktywny — przyciski wychodzą, ale ruch kapsla nie prowadzi krzyżaka (zaparkowany).";}
      else if(gp.on){t="🎮 Krzyżak steruje D-padem wirtualnego kontrolera (skosy natywnie).";cls="ok";}
      else if(gp.mod){t="🎮 Pad utworzy się przy starcie (potrzebny ViGEmBus). Bez niego przełącz na „Klawiatura”.";}
      else{t="⚠ Brak modułu vgamepad — wybierz „Klawiatura” albo zainstaluj vgamepad + ViGEmBus.";cls="warn";}
    }else{t=m.dpadDiagonal?"⌨ Krzyżak wysyła klawisze kierunków. Skosy (8 kier.) = dwa klawisze naraz."
                          :"⌨ Krzyżak wysyła klawisze kierunków — najwyżej jeden naraz (bez skosów).";}
    da.textContent=t;da.className="mouse-avail col2"+(cls?" "+cls:"");}
}
// WHOSE motion settings `state.mouse` is holding. The server keeps one config per capsule while this
// tab keeps a single object, and postMouse() sends the WHOLE thing — so a click made before the new
// capsule's config has arrived would write the previous capsule's settings over it. Re-read on every
// capsule switch (mouseFetchState) and refuse to write while the answer is "nobody's".
function mouseFetchState(dev){
  dev=dev||state.activeDeviceId||"d0";
  state.mouseDev=null;
  return fetch("/airmouse?dev="+encodeURIComponent(dev)).then(r=>r.json())
    .then(m=>{if(m&&!m.error)onMouseCfg(m,true);}).catch(()=>{})
    .then(()=>{state.mouseDev=dev;});
}
function postMouse(){
  const dev=state.mouseDev;
  if(!dev||dev!==(state.activeDeviceId||"d0"))return;   // another capsule's config is loaded — never write it here
  fetch("/airmouse?dev="+encodeURIComponent(dev),{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify(state.mouse)}).then(r=>r.json()).catch(()=>{});}
let _mouseT=null;
// Zapis jest opóźniony (żeby ciągnięcie suwaka nie było serią zapytań), ale „zmienione" na pasku
// nie ma prawa czekać na echo z serwera: człowiek widzi skutek swojego ruchu OD RAZU, więc pasek
// też musi. Większość pokręteł zmienia state.mouse i woła TYLKO to, bez przerysowania panelu.
function commitMouse(){clearTimeout(_mouseT);_mouseT=setTimeout(postMouse,180);
  if(typeof mouseCfgSync==="function")try{mouseCfgSync();}catch(e){}}

