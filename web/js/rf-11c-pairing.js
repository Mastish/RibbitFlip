"use strict";
// ===================== PAIRING: adding another capsule =====================
//  "+ Dodaj urządzenie" -> POST /pair (the server opens a new slot in pairing mode) -> a separate
//  "searching" screen (same waves/pulse as the main no-connection view) -> the slot flips to
//  connected/sim (routeEvent 'st') -> pairSucceeded().
//
//  WHAT CHANGED ON 2026-08-21 AND WHY. The scan takes the STRONGEST unclaimed capsule, which with
//  four of them on the desk is rarely the one you had in mind. The old screen then flashed
//  "Connected: Triki 3. Switching to it…" for 1.55 s and closed itself, so the answer to "which one
//  did it take, and did it work?" scrolled past before you could read it. Now the result STAYS on
//  screen, names the capsule with its address and signal, and offers the two things you actually
//  want at that moment: prove which physical capsule this is (shake it, or blink its LED), and
//  "that's not the one, keep looking" — which rejects that address and scans again, so the retry
//  reaches for a different capsule instead of grabbing the same loudest one.
let _pairTarget=null, _pairRAF=0, _pairDone=false, _pairSwitchTid=0, _pairArmedAt=0;
// A status packet from the slot we just dropped can still be in flight when "keep looking" arms the
// next one, and it says "connected" — which would slam the previous result back onto the screen
// before the new search has even started. Nothing real can be found this fast (the BLE scan takes
// seconds), so anything claiming success within this window of arming is a leftover.
const PAIR_SETTLE_MS=250;
function openPairing(){
  if(_pairTarget)return;   // already open
  let ov=document.getElementById("pairModal");
  if(!ov){ov=document.createElement("div");ov.id="pairModal";document.body.appendChild(ov);}
  const sim=!!(state.cfg&&state.cfg.simulate);
  ov.innerHTML=`<div class="pm-box">
    <div class="pm-cap"><span class="pm-ring"></span><span class="pm-dot"></span></div>
    <canvas class="pm-scope" id="pmScope"></canvas>
    <h3 id="pmTitle">${_gl("Szukam kapsla…","Searching for a capsule…")}</h3>
    <p class="pm-hint" id="pmHint">${sim
      ? _gl("<b>Symulacja</b> — żaden prawdziwy kapsel nie jest szukany. Za chwilę dostaniesz kolejny kapsel syntetyczny, na którym przećwiczysz ustawienia dla kilku urządzeń.","<b>Simulation</b> — no real capsule is being searched for. In a moment you get another synthetic capsule, to practise settings for several devices on.")
      : _gl("<b>Obudź albo naciśnij środek</b> kapsla, który chcesz dodać, i trzymaj go blisko komputera. Jeśli w pobliżu jest kilka kapsli, wezmę ten o najmocniejszym sygnale, a potem pokażę Ci, który to.","<b>Wake or press the centre</b> of the capsule you want to add and keep it close to the computer. If several capsules are nearby I take the one with the strongest signal, then show you which one it was.")}</p>
    <div class="pm-act"><button class="btn" id="pmCancel" type="button">${_gl("Anuluj","Cancel")}</button></div></div>`;
  ov.style.display="flex"; window.rfmReopen&&window.rfmReopen(ov);
  _pairDone=false; _pairTarget="…";   // placeholder until /pair responds (blocks double opening)
  document.getElementById("pmCancel").onclick=()=>cancelPairing();
  ov.onclick=e=>{if(e.target===ov)_pairDismiss();};
  document.addEventListener("keydown",_pairKey,true);
  fetch("/pair",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})
    .then(r=>r.ok?r.json():Promise.reject(r.status))
    .then(j=>_pairArm(j))
    .catch(err=>{
      _pairTarget=null;
      const h=document.getElementById("pmHint");
      if(h)h.innerHTML=(err===409)
        ? _gl("⚠ Parowanie innego urządzenia już trwa — dokończ je najpierw.","⚠ Pairing of another device is already in progress — finish it first.")
        : _gl("⚠ Nie udało się rozpocząć parowania. Sprawdź, czy serwer RibbitFlip działa.","⚠ Could not start pairing. Check that the RibbitFlip server is running.");
    });
  if(_pairRAF)cancelAnimationFrame(_pairRAF);
  _pairDraw();
}
// Point the open screen at the slot the server just created. Shared by the first /pair and by every
// "keep looking" retry, which creates a fresh slot the same way.
function _pairArm(j){
  _pairTarget=j.dev;
  _pairArmedAt=(typeof performance!=="undefined"?performance.now():Date.now());
  const D=devEntry(j.dev);
  D.meta={dev:j.dev,slot:(j.slot!=null?j.slot:999),name:j.name||j.dev,color:j.color||"#36c5f0",
          label:j.label||"",muted:!!j.muted,paused:!!j.paused,bound:false};
  D.conn="pairing";
  const t=document.getElementById("pmTitle");
  if(t)t.textContent=_gl("Szukam: ","Searching: ")+(j.name||j.dev);
  renderDeviceSelector();
}
function _pairDraw(){
  const cv2=document.getElementById("pmScope");
  if(cv2){
    const r=cv2.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
    cv2.width=Math.max(2,Math.round(r.width*dpr)); cv2.height=Math.max(2,Math.round(r.height*dpr));
    const ctx=cv2.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
    drawPairScope(ctx,r.width,r.height);
  }
  const ov=document.getElementById("pairModal");
  // _pairRAF back to 0 when the loop stops, so "keep looking" can tell it apart from a running one
  // and restart the waves instead of leaving a dead canvas.
  if(ov&&ov.style.display!=="none"&&!_pairDone)_pairRAF=requestAnimationFrame(_pairDraw);
  else _pairRAF=0;
}
// "searching" placeholder waves (sine/square/sine) — same visual language as the main no-connection screen
function drawPairScope(ctx,w,h){
  const now=_prefersReducedMotion()?0:_now(), pad=10, midY=h/2, pw=w-2*pad, A=h*0.30;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle=cv('--line');ctx.globalAlpha=.18;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(pad,midY);ctx.lineTo(pad+pw,midY);ctx.stroke();ctx.globalAlpha=1;
  const D=_pairTarget&&state.devices[_pairTarget];
  const base=(D&&D.meta&&D.meta.color)||cv('--az')||'#36c5f0';
  const cols=[base, cv('--ay')||'#ffcb05', cv('--ax')||'#ff5a5a'];
  ctx.lineWidth=1.8;ctx.lineJoin="round";
  cols.forEach((col,si)=>{
    const freq=1.6+si*0.5, speed=0.55+si*0.23, phase=now*speed*2*Math.PI+si*1.9;
    ctx.strokeStyle=col;ctx.globalAlpha=.85;ctx.beginPath();
    for(let px=0;px<=pw;px+=2){
      const tt=px/pw, u=tt*freq*2*Math.PI+phase, s=(si===1)?(Math.sin(u)>=0?1:-1):Math.sin(u);
      const x=pad+px, y=midY-s*A; if(px===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
  });
  ctx.globalAlpha=1;
}
// RSSI as bars + dBm, the same reading as the Connection tab — "strongest signal wins" is the rule
// the scan follows, so the screen shows the number that decided it.
function _pairRssiHtml(r){
  if(r==null)return "—";
  const n=r>=-55?4:r>=-65?3:r>=-72?2:r>=-82?1:0;
  return `<span class="bars">${[6,9,12,15].map((h,i)=>`<i class="${i<n?'on':''}" style="height:${h}px"></i>`).join("")}</span><small>${r} dBm</small>`;
}
// The result card. It replaces the whole box body, because almost nothing from the searching state
// belongs here — different question, different buttons.
function pairSucceeded(){
  if(_pairDone||!_pairTarget||_pairTarget==="…")return;
  const now=(typeof performance!=="undefined"?performance.now():Date.now());
  if(now-_pairArmedAt<PAIR_SETTLE_MS)return;   // leftover packet from the slot we just dropped
  _pairDone=true;
  const tgt=_pairTarget, D=state.devices[tgt];
  if(_pairRAF){cancelAnimationFrame(_pairRAF);_pairRAF=0;}
  if(_pairSwitchTid){clearTimeout(_pairSwitchTid);_pairSwitchTid=0;}
  _pairRenderResult(tgt,D);
}
function _pairRenderResult(tgt,D){
  const box=document.querySelector("#pairModal .pm-box"); if(!box)return;
  const nm=(D&&D.meta&&(D.meta.label||D.meta.name))||tgt;
  const info=(D&&D.devInfo)||{};
  const capUrl=capImgBig(D&&D.meta&&D.meta.cap);   // 96 px card, so the big artwork (see rf-03)
  const col=(D&&D.meta&&D.meta.color)||"#36c5f0";
  const sim=!!(state.cfg&&state.cfg.simulate);
  box.classList.add("ok");
  box.innerHTML=`
    <div class="pm-found" style="--pcol:${esc(col)}">
      <span class="pm-found-cap" role="img" aria-label="${esc(_gl("Sparowany kapsel","Paired capsule"))}"
            style="${capUrl?`background-image:url(${capUrl})`:""}"></span>
      <span class="rf-cel-ic pm-found-ok" role="img" aria-label="OK"></span>
    </div>
    <h3 id="pmTitle">${esc(_gl("Połączono: ","Connected: ")+nm)}</h3>
    <div class="pm-idlist">
      <div class="pm-idrow"><span class="k">${_gl("Nazwa","Name")}</span><span class="v">${esc(info.name||nm)}</span></div>
      <div class="pm-idrow"><span class="k">${_gl("Adres","Address")}</span><span class="v mono">${esc(info.address||"—")}</span></div>
      <div class="pm-idrow"><span class="k">${_gl("Sygnał","Signal")}</span><span class="v">${_pairRssiHtml(info.rssi)}</span></div>
    </div>
    <p class="pm-hint" id="pmHint">${sim
      ? _gl("To kapsel syntetyczny — w symulacji nie ma czego potrząsać, a adres i sygnał zostają puste. Zostaw go, żeby przećwiczyć ustawienia na kilku kapslach.","This capsule is synthetic — in simulation there is nothing to shake, and the address and signal stay empty. Keep it to practise settings on several capsules.")
      : _gl("Nie wiesz, który to kapsel? Potrząśnij którymkolwiek z nich, a jego pigułka w pasku „Kapsle Triki” zamiga.","Not sure which capsule this is? Give any of them a shake and its pill in the “Triki capsules” bar lights up.")}</p>
    <div class="pm-act pm-act-result">
      <button class="btn pm-retry" id="pmRetry" type="button">${_gl("To nie ten, szukaj dalej","Not this one, keep looking")}</button>
      ${sim?"":`<button class="btn" id="pmBlink" type="button">${_gl("Mrugnij diodą","Blink its LED")}</button>`}
      <button class="btn primary" id="pmOk" type="button">${_gl("Tak, to ten","Yes, that one")}</button>
    </div>`;
  const ok=document.getElementById("pmOk"); if(ok){ok.onclick=()=>pairConfirm();ok.focus();}
  const rt=document.getElementById("pmRetry"); if(rt)rt.onclick=()=>pairRetry();
  const bl=document.getElementById("pmBlink"); if(bl)bl.onclick=()=>devBlinkLed(tgt);
  // The BLE 'dev' packet (name/address/RSSI) and the 'st' packet that brought us here race each
  // other. If the details were not in yet, repaint once they are rather than leaving three dashes.
  if(!info.address)setTimeout(()=>{
    if(_pairDone&&_pairTarget===tgt&&state.devices[tgt]&&state.devices[tgt].devInfo)
      _pairRenderResult(tgt,state.devices[tgt]);
  },900);
}
// "Yes, that one" — the slot stops being provisional, the screen closes and the capsule becomes
// the one being edited (which is what the old auto-switch did, only now you asked for it).
function pairConfirm(){
  const tgt=_pairTarget;
  if(tgt&&tgt!=="…")fetch("/pair/confirm?dev="+encodeURIComponent(tgt),{method:"POST"}).catch(()=>{});
  closePairing(false);
  if(tgt&&tgt!=="…"&&state.devices[tgt])switchDevice(tgt);
}
// "Not this one, keep looking" — the server rejects the address it just bound and opens a fresh
// pairing slot, so the next scan cannot pick the same capsule again.
function pairRetry(){
  const tgt=_pairTarget;
  if(!tgt||tgt==="…")return;
  const box=document.querySelector("#pairModal .pm-box");
  // Removing the slot fires 'devgone' for it. onDevGone would read that as "the capsule being
  // paired vanished" and close this screen, so tell it a retry is in flight.
  window._pairRetrying=true;
  _pairDone=false; _pairTarget="…";
  _pairArmedAt=(typeof performance!=="undefined"?performance.now():Date.now());
  if(box){
    box.classList.remove("ok");
    box.innerHTML=`<div class="pm-cap"><span class="pm-ring"></span><span class="pm-dot"></span></div>
      <canvas class="pm-scope" id="pmScope"></canvas>
      <h3 id="pmTitle">${_gl("Szukam innego kapsla…","Looking for a different capsule…")}</h3>
      <p class="pm-hint" id="pmHint">${_gl("Tamten kapsel zostaje pominięty do końca tego parowania. Obudź ten, o który Ci chodzi, i przysuń go bliżej komputera niż pozostałe.","That capsule is skipped for the rest of this pairing. Wake the one you actually want and bring it closer to the computer than the others.")}</p>
      <div class="pm-act"><button class="btn" id="pmCancel" type="button">${_gl("Anuluj","Cancel")}</button></div>`;
    const c=document.getElementById("pmCancel"); if(c)c.onclick=()=>cancelPairing();
  }
  if(_pairRAF)cancelAnimationFrame(_pairRAF);
  _pairRAF=0; _pairDraw();                 // the canvas was just recreated — start the waves on it
  fetch("/pair/retry?dev="+encodeURIComponent(tgt),{method:"POST"})
    .then(r=>r.ok?r.json():Promise.reject(r.status))
    .then(j=>_pairArm(j))
    .catch(()=>{
      _pairTarget=null;
      const h=document.getElementById("pmHint");
      if(h)h.textContent=_gl("Nie udało się wznowić szukania. Zamknij to okno i spróbuj jeszcze raz.",
                             "Could not resume the search. Close this window and try again.");
    })
    .finally(()=>{window._pairRetrying=false;});
}
function closePairing(cancelServer){
  const tgt=_pairTarget; _pairTarget=null; _pairDone=false;
  // Cancel MUST cancel: kill any pending hop so Esc/Cancel cannot force-switch the active device.
  if(_pairSwitchTid){clearTimeout(_pairSwitchTid);_pairSwitchTid=0;}
  if(_pairRAF){cancelAnimationFrame(_pairRAF);_pairRAF=0;}
  document.removeEventListener("keydown",_pairKey,true);
  const ov=document.getElementById("pairModal");
  if(ov){ if(window.rfmClose) window.rfmClose(ov,()=>{ov.style.display="none";}); else ov.style.display="none"; }
  if(cancelServer&&tgt&&tgt!=="…")
    fetch("/pair/cancel?dev="+encodeURIComponent(tgt),{method:"POST"}).catch(()=>{});
}
function cancelPairing(){closePairing(true);}
// Esc / clicking the backdrop = "no". The slot the scan opened stays PROVISIONAL until „Tak, to ten",
// so dismissing the question has to take it away with it — until 2026-09-03 Esc silently kept the
// capsule (audit: a stray „Triki 3" left in the bar after pressing Escape), which is the one answer
// the dialog never offered. cancel_pairing() on the server removes a slot that was never confirmed.
function _pairDismiss(){ cancelPairing(); }
function _pairKey(e){if(e.key==="Escape"){e.preventDefault();e.stopPropagation();_pairDismiss();}}

// ===================== LINIA GOTOWOŚCI EKRANU „POŁĄCZENIE” =====================
// Przeniesiona z rf-28c (UX 261120 B5b, P-G6-09 część P0), bo prowadzi dalej do dwóch rzeczy
// z tego pliku i z diagnozy: kroki szukania kończyły się na liście, a człowiek, któremu nic z nich
// nie pomogło, nie miał dokąd pójść. Teraz:
//   · szukanie to stan „trwa" (⏳), nie błąd: aplikacja sama próbuje,
//   · po 60 s nieprzerwanego szukania dochodzi wiersz „Zgłoś problem" (wcześniej by straszył),
//   · bez żadnego sparowanego kapsla wiersz „Dodaj kapsel" klika ten sam przycisk, co człowiek.
let _connScanSince=0;
const CONN_REPORT_AFTER_MS=60000;
function _connViewed(){
  if(typeof state==="undefined"||!state.devices)return null;
  return state.devices[state.viewDev||state.activeDeviceId||"d0"]||null;
}
function _connAnyPaired(){
  return Object.values((typeof state!=="undefined"&&state.devices)||{}).some(D=>D&&D.meta&&D.meta.bound);
}
// rf-28c (rfReady) ładuje się PO tym pliku, więc rejestracja czeka na koniec wczytywania skryptów.
function _connReadyRegister(){if(typeof rfReady!=="object"||!rfReady)return;rfReady.register({
  id:"rfReadyConn",
  anchor:()=>rfReady.headOf("polaczenie"),
  sim:false,
  allOk:()=>rfReady.isSim()
    ?["Symulacja: kapsel udaje aplikacja. Prawdziwy podłączysz przełącznikiem LIVE u góry.",
      "Simulation: the app fakes the capsule. Connect a real one with the LIVE switch at the top."]
    :["Kapsel jest połączony i przysyła dane.","The capsule is connected and sending data."],
  rows:()=>{
    const D=_connViewed();
    if(!D)return [];
    if(!D.scanning)_connScanSince=0;
    // UX 261120 L4b: „Wznów” stoi teraz w pierwszej karcie ekranu, a wiersz klika go sam.
    if(D.parked)return [{ok:false,pl:"Kapsel śpi, żeby oszczędzać baterię",en:"The capsule is asleep to save battery",
      fix:{pl:"Wznów",en:"Resume",click:"#wakeBtn"},
      steps:[["Obudź go przyciskiem „Wznów” albo ruszając kapslem.",
              "Wake it with “Resume”, or by moving the capsule."]]}];
    if(D.scanning){
      if(!_connScanSince)_connScanSince=Date.now();
      const rows=[{ok:false,wait:true,
        pl:"Szukam kapsla. Próbuję sam co chwilę, nic nie musisz klikać",
        en:"Looking for the capsule. I keep trying on my own, you do not need to click anything",
        steps:[["Rusz kapslem albo naciśnij jego przycisk, żeby się obudził.","Move the capsule or press its button to wake it up."],
               ["Zamknij Żappkę na telefonie i inne programy sterujące kapslem: kapsel przyjmuje jedno połączenie naraz.","Close Żappka on your phone and any other app that controls the capsule: it accepts one connection at a time."],
               ["Sprawdź, czy Bluetooth w Windows jest włączony.","Check that Bluetooth is on in Windows."],
               ["Przysuń kapsel bliżej komputera; przy słabej baterii zasięg spada.","Bring the capsule closer to the computer; range drops when the battery is low."]]}];
      if(!_connAnyPaired()&&!rfReady.isSim())rows.push({ok:false,
        pl:"Nie masz jeszcze sparowanego kapsla",en:"You have no paired capsule yet",
        fix:{pl:"Dodaj kapsel",en:"Add a capsule",click:"#deviceAddBtn",run:()=>{if(typeof openPairing==="function")openPairing();}}});
      if(Date.now()-_connScanSince>=CONN_REPORT_AFTER_MS)rows.push({ok:false,
        pl:"Nadal nic? Zgłoś problem: aplikacja zbuduje paczkę diagnostyczną na Twoim dysku",
        en:"Still nothing? Report a problem: the app builds a diagnostic bundle on your disk",
        fix:{pl:"Zgłoś problem",en:"Report a problem",run:()=>{if(typeof rfDiagOpen==="function")rfDiagOpen();}}});
      return rows;
    }
    return [{ok:true,pl:"Kapsel połączony",en:"Capsule connected"}];
  }
});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",_connReadyRegister);
else setTimeout(_connReadyRegister,0);
